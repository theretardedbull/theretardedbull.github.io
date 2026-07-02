// Rug Vault worker — production save pipeline (Cloudflare Worker + R2).
// User pastes an x.com URL → this stores it in FOUR independent places:
//   1. Screenshot PNG + JSON record in YOUR R2 bucket (you control it)
//   2. Wayback Machine snapshot (third-party proof)
//   3. archive.today snapshot (second third-party proof)
//   4. Optional: JSON receipt committed to your GitHub repo (tamper-evident)
//
// SETUP (Cloudflare dashboard):
//   Workers → Create → paste this file.
//   R2 → Create bucket "rug-vault" → Worker Settings → Bindings → R2 bucket, name: BUCKET
//   Worker Settings → Variables:
//     SCREENSHOTONE_KEY  (required — from screenshotone.com, $17/mo plan)
//     PUBLIC_BASE        (optional — custom domain for links, else worker URL is used)
//     GH_TOKEN + REPO    (optional — fine-grained token w/ Contents:write, e.g. "user/rug-vault")
//
// API:
//   POST /            {"url": "https://x.com/handle/status/123"} → save, returns record JSON
//   GET  /vault/<id>.json  → the record
//   GET  /shot/<id>.png    → the screenshot (immutable, cache-forever)

import { uploadToArweave } from "./arweave-lite.js";
import { renderSnapshotSVG } from "./snapshot-svg.js";
import { renderReceiptPage } from "./receipt-page.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type"
};

// What goes on Arweave: the post's testimony only — no nulls, no plumbing.
function sealedCopy(rec) {
  const s = {
    post_id: rec.post_id, handle: rec.handle, author_name: rec.author_name,
    url: rec.url, text: rec.text,
    posted_at: rec.posted_at, saved_at: rec.saved_at
  };
  if (rec.author_avatar) s.author_avatar = rec.author_avatar;
  if (rec.photo) s.photo = rec.photo;
  if (rec.stats && Object.values(rec.stats).some((v) => v != null)) s.stats = rec.stats;
  return s;
}

function json(obj, status) {
  return new Response(JSON.stringify(obj, null, 2), {
    status: status || 200,
    headers: { ...CORS, "content-type": "application/json" }
  });
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const u = new URL(req.url);

    // ---- read endpoints ----
    if (req.method === "GET" && u.pathname.startsWith("/vault/")) {
      if (!env.BUCKET) return Response.redirect((env.SITE_BASE || "https://theretardedbull.xyz") + u.pathname, 302);
      const obj = await env.BUCKET.get("vault/" + u.pathname.split("/").pop());
      if (!obj) return json({ ok: false, error: "not in vault" }, 404);
      return new Response(obj.body, { headers: { ...CORS, "content-type": "application/json" } });
    }
    if (req.method === "GET" && u.pathname.startsWith("/shot/")) {
      if (!env.BUCKET) return new Response("image pipeline not configured", { status: 404, headers: CORS });
      const obj = await env.BUCKET.get("shots/" + u.pathname.split("/").pop());
      if (!obj) return new Response("not found", { status: 404, headers: CORS });
      return new Response(obj.body, {
        headers: { ...CORS, "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" }
      });
    }
    // ---- the receipt page, served directly (also lives on the site as receipt.html) ----
    if (req.method === "GET" && u.pathname.startsWith("/receipt/")) {
      const rid = (u.pathname.split("/").pop() || "").replace(/\.html$/, "");
      if (!/^\d{1,25}$/.test(rid)) return json({ ok: false, error: "bad id" }, 400);
      let rec = null;
      try {
        const r = await fetch("https://raw.githubusercontent.com/" + env.REPO + "/main/vault/" + rid + ".json", {
          headers: { "user-agent": "gazette-vault-worker" }
        });
        if (r.ok) rec = await r.json();
      } catch (e) {}
      if (!rec) return json({ ok: false, error: "not in vault" }, 404);
      return new Response(renderReceiptPage(rec), {
        headers: { ...CORS, "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=120" }
      });
    }

    // ---- single record, fresh from git (feeds the site's receipt page) ----
    if (req.method === "GET" && u.pathname.startsWith("/record/")) {
      const rid = (u.pathname.split("/").pop() || "").replace(/\.json$/, "");
      if (!/^\d{1,25}$/.test(rid)) return json({ ok: false, error: "bad id" }, 400);
      try {
        const r = await fetch("https://raw.githubusercontent.com/" + env.REPO + "/main/vault/" + rid + ".json", {
          headers: { "user-agent": "gazette-vault-worker" }
        });
        if (r.ok) return new Response(await r.text(), {
          headers: { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
        });
      } catch (e) {}
      return json({ ok: false, error: "not in vault" }, 404);
    }

    // ---- live ledger: straight from git, no Pages deploy in the path ----
    if (req.method === "GET" && u.pathname === "/ledger") {
      try {
        const r = await fetch("https://raw.githubusercontent.com/" + env.REPO + "/main/vault/index.json", {
          headers: { "user-agent": "gazette-vault-worker" }
        });
        if (r.ok) return new Response(await r.text(), {
          headers: { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
        });
      } catch (e) {}
      return json([], 200);
    }

    // ---- receipt doorway: serves Arweave content via our domain (home-ISP filters
    // block some public gateways; Cloudflare's network isn't filtered) ----
    if (req.method === "GET" && u.pathname.startsWith("/ar/")) {
      const txid = u.pathname.split("/").pop() || "";
      if (!/^[A-Za-z0-9_-]{20,60}$/.test(txid)) return json({ ok: false, error: "bad tx id" }, 400);
      const cacheKey = new Request(u.origin + "/ar/" + txid);
      const hit = await caches.default.match(cacheKey);
      if (hit) return hit;
      let upstream = null;
      for (const gw of ["https://arweave.net/raw/", "https://turbo-gateway.com/raw/", "https://turbo-gateway.com/", "https://gateway.irys.xyz/"]) {
        try {
          const r = await fetch(gw + txid, { redirect: "follow" });
          const ct = r.headers.get("content-type") || "";
          if (r.ok && !ct.includes("text/html")) { upstream = r; break; }
        } catch (e) {}
      }
      if (!upstream) return json({ ok: false, error: "not yet retrievable from gateways — try again shortly", tx: txid }, 503);
      const body = await upstream.arrayBuffer();
      const resp = new Response(body, {
        headers: {
          ...CORS,
          "content-type": ((upstream.headers.get("content-type") || "application/json").includes("json") ? "application/json; charset=utf-8" : upstream.headers.get("content-type")),
          "cache-control": "public, max-age=31536000, immutable",
          "x-arweave-tx": txid
        }
      });
      ctx.waitUntil(caches.default.put(cacheKey, resp.clone()));
      return resp;
    }

    // ---- the exhibit: renders the saved post as an image, from the permanent record ----
    if (req.method === "GET" && u.pathname.startsWith("/snapshot/")) {
      const sid = (u.pathname.split("/").pop() || "").replace(/\.svg$/, "");
      if (!/^\d{1,25}$/.test(sid)) return json({ ok: false, error: "bad id" }, 400);
      const cacheKey = new Request(u.origin + "/snapshot/" + sid + ".svg?v=3");
      const hit = await caches.default.match(cacheKey);
      if (hit) return hit;
      let rec = null;
      try {
        const r = await fetch("https://raw.githubusercontent.com/" + env.REPO + "/main/vault/" + sid + ".json", {
          headers: { "user-agent": "gazette-vault-worker" }
        });
        if (r.ok) rec = await r.json();
      } catch (e) {}
      if (!rec) return json({ ok: false, error: "not in vault" }, 404);
      const svg = await renderSnapshotSVG({
        text: rec.text, authorName: rec.author_name, handle: rec.handle,
        avatarUrl: rec.author_avatar || rec.avatar_url || null, photo: rec.photo || null,
        postedAt: rec.posted_at, url: rec.url, id: rec.post_id || rec.id
      });
      const resp = new Response(svg, {
        headers: { ...CORS, "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=86400" }
      });
      ctx.waitUntil(caches.default.put(cacheKey, resp.clone()));
      return resp;
    }

    if (req.method !== "POST") return json({ ok: false, error: "POST {\"url\":\"https://x.com/handle/status/123\"}" }, 405);

    // ---- 0a. soft anti-spam: one save per IP per 10 seconds ----
    const ip = req.headers.get("cf-connecting-ip") || "unknown";
    const coolKey = new Request(u.origin + "/__cooldown/" + encodeURIComponent(ip));
    if (await caches.default.match(coolKey)) {
      return json({ ok: false, error: "easy, editor — one filing per 10 seconds" }, 429);
    }
    ctx.waitUntil(caches.default.put(coolKey, new Response("1", { headers: { "cache-control": "max-age=10" } })));

    // ---- 0. validate (reject anything that isn't a tweet URL) ----
    let body = {};
    try { body = await req.json(); } catch (e) {}
    const m = String(body.url || "").match(/^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/i);
    if (!m) return json({ ok: false, error: "x.com / twitter.com status links only" }, 400);
    const handle = m[1], id = m[2];
    const clean = "https://x.com/" + handle + "/status/" + id;
    const base = (env.PUBLIC_BASE || u.origin).replace(/\/$/, "");

    const gh = (path, init) => fetch("https://api.github.com/repos/" + env.REPO + "/contents/" + path, Object.assign({}, init, {
      headers: Object.assign({
        "authorization": "Bearer " + env.GH_TOKEN,
        "user-agent": "rug-vault-worker",
        "accept": "application/vnd.github+json"
      }, (init && init.headers) || {})
    }));

    // ---- 1. dedupe: one record per post, first save wins ----
    if (env.BUCKET) {
      const existing = await env.BUCKET.get("vault/" + id + ".json");
      if (existing) {
        const rec = JSON.parse(await existing.text());
        return json({ ok: true, duplicate: true, ...rec });
      }
    } else if (env.GH_TOKEN && env.REPO) {
      const existing = await gh("vault/" + id + ".json?ref=main");
      if (existing.ok) return json({ ok: true, duplicate: true, id: id, record: "/vault/" + id + ".json" });
    }

    const warnings = [];

    // ---- 2. screenshot via ScreenshotOne (renders the official embed page — no login wall) ----
    let imageSaved = false;
    // Single query param on purpose: ampersand-free URLs survive Wayback's path-style /save/ endpoint
    const embedUrl = "https://platform.twitter.com/embed/Tweet.html?id=" + id;
    if (env.SCREENSHOTONE_KEY && env.BUCKET) { // optional image pipeline — dormant in text-only mode
      const shotApi = "https://api.screenshotone.com/take"
        + "?access_key=" + env.SCREENSHOTONE_KEY
        + "&url=" + encodeURIComponent(embedUrl)
        + "&format=png&viewport_width=600&viewport_height=900&device_scale_factor=2"
        + "&delay=4&full_page=true&block_ads=true&block_cookie_banners=true";
      try {
        const r = await fetch(shotApi);
        if (r.ok) {
          await env.BUCKET.put("shots/" + id + ".png", r.body, { httpMetadata: { contentType: "image/png" } });
          imageSaved = true;
        } else {
          warnings.push("screenshot failed: http " + r.status + " — retry later via POST again after deleting vault/" + id + ".json");
        }
      } catch (e) {
        warnings.push("screenshot error: " + (e && e.message));
      }
    }

    // ---- 3. post data: FxTwitter primary (keyless, no captcha, full JSON), oEmbed fallback ----
    let text = null, author = null, postedAt = null, tweetHtml = null, avatarUrl = null, photo = null, stats = null;
    try {
      const r = await fetch("https://api.fxtwitter.com/" + handle + "/status/" + id, {
        headers: { "user-agent": "gazette-vault-worker" }
      });
      if (r.ok) {
        const j = await r.json();
        const t = j && j.tweet;
        if (t) {
          text = t.text || null;
          const nm = t.author && t.author.name;
          author = (nm && nm.replace(/[\s.]/g, "").length ? nm : null) || (t.author && t.author.screen_name ? "@" + t.author.screen_name : null);
          if (t.created_timestamp) postedAt = new Date(t.created_timestamp * 1000).toISOString();
          avatarUrl = (t.author && t.author.avatar_url) || null;
          const ph = t.media && t.media.photos && t.media.photos[0];
          photo = ph ? { url: ph.url, width: ph.width || 0, height: ph.height || 0 } : null;
          stats = {
            replies: t.replies ?? null, reposts: t.retweets ?? null,
            likes: t.likes ?? null, views: t.views ?? null
          };
        }
      } else warnings.push("fxtwitter http " + r.status);
    } catch (e) { warnings.push("fxtwitter unreachable"); }
    if (!text) {
      try {
        const r = await fetch("https://publish.twitter.com/oembed?omit_script=true&url=" + encodeURIComponent(clean));
        if (r.ok) {
          const o = await r.json();
          tweetHtml = (o && o.html) || null;
          author = author || (o && o.author_name) || null;
          text = tweetHtml ? tweetHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : null;
        }
      } catch (e) {}
      if (!text) warnings.push("post text unavailable (fxtwitter + oembed) — may already be deleted; archives may have it");
    }
    // X ids are snowflakes: the id itself encodes the original post time (fallback source)
    if (!postedAt) {
      try { postedAt = new Date(Number((BigInt(id) >> 22n) + 1288834974657n)).toISOString(); } catch (e) {}
    }

    // ---- 4. third-party archives (best-effort bonus copies; never block the save) ----
    // X blocks archive crawlers on x.com post pages, so Wayback targets the PUBLIC embed
    // page instead — and only via the authenticated Save Page Now API (keys make it reliable).
    if (env.WAYBACK_KEYS) {
      ctx.waitUntil(fetch("https://web.archive.org/save", {
        method: "POST",
        headers: {
          "authorization": "LOW " + env.WAYBACK_KEYS,
          "accept": "application/json",
          "content-type": "application/x-www-form-urlencoded"
        },
        body: "url=" + encodeURIComponent(embedUrl)
      }).catch(function () {}));
    } else {
      ctx.waitUntil(fetch("https://web.archive.org/save/" + embedUrl).catch(function () {}));
    }

    // ---- 5. the permanent record (clean schema — audited) ----
    const rec = {
      post_id: id,
      handle: handle,
      author_name: author,
      author_avatar: avatarUrl,
      url: clean,
      text: text,
      photo: photo,
      stats: stats,
      posted_at: postedAt,
      saved_at: new Date().toISOString(),
      post_missing_at_save: !text,
      receipt_page: (env.SITE_BASE || "https://theretardedbull.xyz") + "/receipt.html?id=" + id,
      snapshot: base + "/snapshot/" + id + ".svg",
      pipeline_version: 6
    };
    // ---- 5.5 the permanent text receipt on Arweave (paid in SOL, ~1/25 of a cent) ----
    rec.arweave = null;
    if (env.ARWEAVE_KEY) {
      try {
        const key = Uint8Array.from(JSON.parse(env.ARWEAVE_KEY));
        const ar = await uploadToArweave(new TextEncoder().encode(JSON.stringify(sealedCopy(rec))), [
          { name: "Content-Type", value: "application/json" },
          { name: "App-Name", value: "retarded-bull-gazette" },
          { name: "Type", value: "post-receipt" },
          { name: "Post-Id", value: id }
        ], key);
        rec.arweave_tx = ar.id;
        rec.arweave = "https://arweave.net/" + ar.id;
        rec.arweave_gateway = base + "/ar/" + ar.id;
        rec.arweave_deadline_height = ar.deadlineHeight;
      } catch (e) { warnings.push("arweave: " + (e && e.message)); }
    } else warnings.push("arweave key not configured");

    if (env.BUCKET) {
      await env.BUCKET.put("vault/" + id + ".json", JSON.stringify(rec, null, 2), {
        httpMetadata: { contentType: "application/json" }
      });
    }

    // ---- 6. tamper-evident receipts in git: the record + the public ledger index ----
    // Awaited (not fire-and-forget): the site's shared ledger is built from these files,
    // so a git failure must surface in warnings, never pass silently.
    if (env.GH_TOKEN && env.REPO) {
      const b64e = (s) => btoa(unescape(encodeURIComponent(s)));
      const b64d = (s) => decodeURIComponent(escape(atob(String(s).replace(/\n/g, ""))));
      const put = (path, content, sha, note) => gh(path, {
        method: "PUT",
        body: JSON.stringify(Object.assign({
          message: "vault: @" + handle + " status " + id + (note || ""),
          content: b64e(content),
          committer: { name: "vault-bot", email: "vault-bot@users.noreply.github.com" }
        }, sha ? { sha: sha } : {}))
      });
      try {
        const r1 = await put("vault/" + id + ".json", JSON.stringify(rec, null, 1));
        if (!r1.ok) warnings.push("git record write http " + r1.status);
        const entry = {
          post_id: id, id: id, handle: handle, url: clean,
          author_name: rec.author_name, text: text,
          snapshot: rec.snapshot, receipt_page: rec.receipt_page,
          arweave: rec.arweave, arweave_tx: rec.arweave_tx, arweave_gateway: rec.arweave_gateway,
          posted_at: rec.posted_at, saved_at: rec.saved_at,
          post_missing_at_save: rec.post_missing_at_save
        };
        for (let attempt = 0; attempt < 2; attempt++) {
          const cur = await gh("vault/index.json?ref=main");
          let list = [], sha;
          if (cur.ok) {
            const j = await cur.json();
            sha = j.sha;
            try { list = JSON.parse(b64d(j.content)); } catch (e) { list = []; }
          }
          list = [entry].concat(list.filter(function (x) { return x.id !== id; }));
          list.sort(function (a, b) {
            return String(b.posted_at || b.saved_at || "").localeCompare(String(a.posted_at || a.saved_at || ""));
          });
          const r2 = await put("vault/index.json", JSON.stringify(list, null, 1), sha, " (index)");
          if (r2.ok) break;
          if (r2.status !== 409) { warnings.push("git index write http " + r2.status); break; }
        }
        // The raw record is live on github the instant it commits — archive it at the
        // Internet Archive so an independent, timestamped copy of the receipt exists.
        ctx.waitUntil(fetch("https://web.archive.org/save/https://raw.githubusercontent.com/" + env.REPO + "/main/vault/" + id + ".json").catch(function () {}));
      } catch (e) {
        warnings.push("git receipt error: " + (e && e.message));
      }
    } else {
      warnings.push("git receipts not configured (set GH_TOKEN + REPO)");
    }

    return json({ ok: true, warnings: warnings, ...rec });
  },

  // Every 30 min: ask Arweave's own index about unconfirmed receipts. Confirmed →
  // stamp block+bundle into the record forever. Deadline blown → re-upload (self-heal).
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      if (!(env.GH_TOKEN && env.REPO)) return;
      const ua = { "user-agent": "gazette-vault-worker" };
      const api = (path, init) => fetch("https://api.github.com/repos/" + env.REPO + "/contents/" + path, Object.assign({}, init, {
        headers: Object.assign({ authorization: "Bearer " + env.GH_TOKEN, accept: "application/vnd.github+json" }, ua, (init && init.headers) || {})
      }));
      const b64e = (s) => btoa(unescape(encodeURIComponent(s)));
      const b64d = (s) => decodeURIComponent(escape(atob(String(s).replace(/\n/g, ""))));

      const ir = await fetch("https://raw.githubusercontent.com/" + env.REPO + "/main/vault/index.json", { headers: ua });
      if (!ir.ok) return;
      const index = await ir.json();
      const needs = index.filter((e) => e.arweave_tx && !e.arweave_block).slice(0, 8);
      if (!needs.length) return;

      let height = 0;
      try { height = ((await (await fetch("https://arweave.net/info")).json()) || {}).height || 0; } catch (e) {}

      const patches = {};
      for (const e of needs) {
        let t = null;
        try {
          const g = await fetch("https://arweave.net/graphql", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ query: '{ transaction(id: "' + e.arweave_tx + '") { id bundledIn { id } block { height } } }' })
          });
          t = (((await g.json()) || {}).data || {}).transaction;
        } catch (err) {}

        const fr = await api("vault/" + e.id + ".json");
        if (!fr.ok) continue;
        const fj = await fr.json();
        let rec;
        try { rec = JSON.parse(b64d(fj.content)); } catch (err) { continue; }

        if (t && t.block && t.block.height) {
          rec.arweave_block = t.block.height;
          rec.arweave_bundle = (t.bundledIn && t.bundledIn.id) || null;
          patches[e.id] = { arweave_block: rec.arweave_block };
          await api("vault/" + e.id + ".json", { method: "PUT", body: JSON.stringify({
            message: "arweave confirmed: " + e.id + " @ block " + rec.arweave_block,
            content: b64e(JSON.stringify(rec, null, 1)), sha: fj.sha,
            committer: { name: "vault-bot", email: "vault-bot@users.noreply.github.com" }
          }) });
        } else if (!t && height && rec.arweave_deadline_height && height > rec.arweave_deadline_height + 30 && env.ARWEAVE_KEY) {
          try {
            const key = Uint8Array.from(JSON.parse(env.ARWEAVE_KEY));
            const ar = await uploadToArweave(new TextEncoder().encode(JSON.stringify(sealedCopy(rec))), [
              { name: "Content-Type", value: "application/json" },
              { name: "App-Name", value: "retarded-bull-gazette" },
              { name: "Type", value: "post-receipt" },
              { name: "Post-Id", value: e.id }
            ], key);
            rec.arweave_tx = ar.id;
            rec.arweave = "https://gazette-vault.theretardedbull.workers.dev/ar/" + ar.id;
            rec.arweave_deadline_height = ar.deadlineHeight;
            patches[e.id] = { arweave_tx: ar.id, arweave: rec.arweave };
            await api("vault/" + e.id + ".json", { method: "PUT", body: JSON.stringify({
              message: "arweave re-sealed (deadline passed): " + e.id,
              content: b64e(JSON.stringify(rec, null, 1)), sha: fj.sha,
              committer: { name: "vault-bot", email: "vault-bot@users.noreply.github.com" }
            }) });
          } catch (err) {}
        }
      }

      if (Object.keys(patches).length) {
        const cr = await api("vault/index.json");
        if (cr.ok) {
          const cj = await cr.json();
          let list;
          try { list = JSON.parse(b64d(cj.content)); } catch (err) { return; }
          list.forEach((x) => { if (patches[x.id]) Object.assign(x, patches[x.id]); });
          await api("vault/index.json", { method: "PUT", body: JSON.stringify({
            message: "vault: arweave confirmations (index)",
            content: b64e(JSON.stringify(list, null, 1)), sha: cj.sha,
            committer: { name: "vault-bot", email: "vault-bot@users.noreply.github.com" }
          }) });
        }
      }
    })());
  }
};
