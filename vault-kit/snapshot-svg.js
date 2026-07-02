// snapshot-svg — renders a saved post as a self-contained SVG "exhibit" card.
// No browser, no screenshot service: pure string assembly from FxTwitter data,
// with avatar/media fetched and embedded as data URIs so the image is complete
// forever even after X deletes everything. Styled to the Gazette's paper tokens.

const W = 900, PAD = 40, TEXT_W_CHARS = 50;

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  }[c])).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
}

function wrap(text, width) {
  const out = [];
  for (const para of String(text || "").split(/\n/)) {
    if (!para.trim()) { out.push(""); continue; }
    let line = "";
    for (const word of para.split(/\s+/)) {
      let w = word;
      while (w.length > width) { // hard-break monster words/urls
        if (line) { out.push(line); line = ""; }
        out.push(w.slice(0, width));
        w = w.slice(width);
      }
      if (!line) line = w;
      else if ((line + " " + w).length <= width) line += " " + w;
      else { out.push(line); line = w; }
    }
    if (line) out.push(line);
  }
  return out.length ? out : ["(no words recovered)"];
}

async function toDataUri(url, maxBytes) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > (maxBytes || 400000)) return null;
    const type = r.headers.get("content-type") || "image/jpeg";
    let bin = "";
    for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
    return "data:" + type.split(";")[0] + ";base64," + btoa(bin);
  } catch (e) { return null; }
}

// tweet: { text, authorName, handle, avatarUrl, photo: {url,width,height}|null, postedAt, url, id }
export async function renderSnapshotSVG(tweet) {
  const lines = wrap(tweet.text, TEXT_W_CHARS);
  const [avatar, media] = await Promise.all([
    tweet.avatarUrl ? toDataUri(tweet.avatarUrl.replace("_normal", "_200x200"), 80000) : null,
    tweet.photo ? toDataUri(tweet.photo.url + (tweet.photo.url.includes("?") ? "&" : "?") + "name=small", 420000) : null,
  ]);

  const posted = tweet.postedAt
    ? new Date(tweet.postedAt).toUTCString().replace(" GMT", " UTC")
    : "date unrecovered";

  const mediaW = W - PAD * 2;
  let mediaH = 0;
  if (media && tweet.photo && tweet.photo.width > 0) {
    mediaH = Math.min(920, Math.round(tweet.photo.height * mediaW / tweet.photo.width));
  }

  const headH = 96, authorH = 92, lineH = 34, textH = lines.length * lineH + 12;
  const footH = 86;
  const H = headH + authorH + textH + (mediaH ? mediaH + 26 : 0) + footH + PAD;

  let y = headH + authorH + 30;
  const textSpans = lines.map((l) => {
    const t = `<text x="${PAD}" y="${y}" font-family="Georgia, 'Times New Roman', serif" font-size="24" fill="#231d14">${esc(l)}</text>`;
    y += lineH;
    return t;
  }).join("\n  ");

  let mediaBlock = "";
  if (media && mediaH) {
    mediaBlock = `<image x="${PAD}" y="${y + 2}" width="${mediaW}" height="${mediaH}" href="${media}" preserveAspectRatio="xMidYMid slice"/>
  <rect x="${PAD}" y="${y + 2}" width="${mediaW}" height="${mediaH}" fill="none" stroke="#231d14" stroke-width="1.5"/>`;
    y += mediaH + 26;
  }

  const footY = H - 46;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#f4edd9"/>
  <rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="none" stroke="#231d14" stroke-width="3"/>
  <rect x="17" y="17" width="${W - 34}" height="${H - 34}" fill="none" stroke="#231d14" stroke-width="1"/>

  <text x="${PAD}" y="62" font-family="Georgia, serif" font-weight="bold" font-size="26" letter-spacing="1" fill="#231d14">THE RETARDED BULL GAZETTE</text>
  <text x="${W - PAD}" y="62" text-anchor="end" font-family="'Courier New', monospace" font-size="16" fill="#7a1f1f">EXHIBIT — FILED FOREVER</text>
  <line x1="${PAD}" y1="${headH - 14}" x2="${W - PAD}" y2="${headH - 14}" stroke="#231d14" stroke-width="2.5"/>

  ${avatar ? `<clipPath id="av"><circle cx="${PAD + 30}" cy="${headH + 32}" r="30"/></clipPath>
  <image x="${PAD}" y="${headH + 2}" width="60" height="60" href="${avatar}" clip-path="url(#av)" preserveAspectRatio="xMidYMid slice"/>
  <circle cx="${PAD + 30}" cy="${headH + 32}" r="30" fill="none" stroke="#231d14" stroke-width="1.5"/>` : ""}
  <text x="${PAD + (avatar ? 78 : 0)}" y="${headH + 26}" font-family="Georgia, serif" font-weight="bold" font-size="23" fill="#231d14">${esc(tweet.authorName || "@" + tweet.handle)}</text>
  <text x="${PAD + (avatar ? 78 : 0)}" y="${headH + 54}" font-family="'Courier New', monospace" font-size="17" fill="#5c4f38">@${esc(tweet.handle)} · posted ${esc(posted)}</text>

  ${textSpans}
  ${mediaBlock}

  <line x1="${PAD}" y1="${footY - 26}" x2="${W - PAD}" y2="${footY - 26}" stroke="#231d14" stroke-width="1"/>
  <text x="${PAD}" y="${footY}" font-family="'Courier New', monospace" font-size="14" fill="#5c4f38">${esc(tweet.url)}</text>
  <text x="${PAD}" y="${footY + 22}" font-family="'Courier New', monospace" font-size="14" fill="#5c4f38">receipt №${esc(tweet.id)} · theretardedbull.xyz · the delete button can't reach it</text>
</svg>`;
}
