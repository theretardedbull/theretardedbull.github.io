// arweave-lite — minimal ANS-104 DataItem builder for Solana (ed25519) signers.
// Zero dependencies, WebCrypto only: runs identically in Cloudflare Workers and Node 18+.
// Differential-tested byte-for-byte against @irys/bundles (the reference implementation).

const te = new TextEncoder();

const sha = async (alg, bytes) => new Uint8Array(await crypto.subtle.digest(alg, bytes));

function concat(arrs) {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

// Arweave deepHash: blob → H(H("blob"+len) ++ H(data)); list → fold H(acc ++ deepHash(item))
async function deepHash(data) {
  if (Array.isArray(data)) {
    let acc = await sha("SHA-384", concat([te.encode("list"), te.encode(String(data.length))]));
    for (const chunk of data) {
      acc = await sha("SHA-384", concat([acc, await deepHash(chunk)]));
    }
    return acc;
  }
  const tag = concat([te.encode("blob"), te.encode(String(data.byteLength))]);
  return sha("SHA-384", concat([await sha("SHA-384", tag), await sha("SHA-384", data)]));
}

// Avro-style tag serialization (zigzag varint), replicated exactly from the reference AVSCTap
function serializeTags(tags) {
  const buf = new Uint8Array(4096);
  let pos = 0;
  function writeLong(n) {
    let m = n >= 0 ? n << 1 : (~n << 1) | 1;
    do { buf[pos] = m & 0x7f; m >>= 7; } while (m && (buf[pos++] |= 0x80));
    pos++;
  }
  function writeString(s) {
    const b = te.encode(s);
    writeLong(b.length);
    buf.set(b, pos);
    pos += b.length;
  }
  if (tags.length) {
    writeLong(tags.length);
    for (const t of tags) { writeString(t.name); writeString(t.value); }
  }
  writeLong(0);
  return buf.slice(0, pos);
}

function u64le(n) {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setUint32(0, n >>> 0, true); // our sizes stay far below 2^32
  return b;
}

const PKCS8_ED25519_PREFIX = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

async function ed25519Sign(message, secretKey64) {
  const seed = secretKey64.slice(0, 32);
  const key = await crypto.subtle.importKey("pkcs8", concat([PKCS8_ED25519_PREFIX, seed]), { name: "Ed25519" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("Ed25519", key, message));
}

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Build + sign a Solana-type (2) DataItem. Returns { raw, id } — raw posts to an Irys uploader.
export async function createSignedDataItem(dataBytes, tags, secretKey64) {
  const owner = secretKey64.slice(32); // ed25519 public key
  const rawTags = serializeTags(tags);
  const empty = new Uint8Array(0);
  const sigData = await deepHash([
    te.encode("dataitem"), te.encode("1"), te.encode("2"),
    owner, empty, empty, rawTags, dataBytes,
  ]);
  const signature = await ed25519Sign(sigData, secretKey64);
  const raw = concat([
    Uint8Array.from([2, 0]),      // signature type 2 (ed25519/solana), little-endian u16
    signature,                     // 64 bytes
    owner,                         // 32 bytes
    Uint8Array.from([0]),          // no target
    Uint8Array.from([0]),          // no anchor
    u64le(tags.length),
    u64le(rawTags.length),
    rawTags,
    dataBytes,
  ]);
  return { raw, id: b64url(await sha("SHA-256", signature)) };
}

// Upload a signed DataItem to Irys (pays from the signer's funded Irys balance)
export async function uploadToArweave(dataBytes, tags, secretKey64, uploaderBase) {
  const { raw, id } = await createSignedDataItem(dataBytes, tags, secretKey64);
  const res = await fetch((uploaderBase || "https://uploader.irys.xyz") + "/tx/solana", {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: raw,
  });
  if (!res.ok) throw new Error("irys upload http " + res.status + ": " + (await res.text()).slice(0, 140));
  const body = await res.json().catch(() => ({}));
  return { id: body.id || id, url: "https://gateway.irys.xyz/" + (body.id || id) };
}
