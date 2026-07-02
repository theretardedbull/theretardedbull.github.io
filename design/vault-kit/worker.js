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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type"
};

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
      const obj = await env.BUCKET.get("vault/" + u.pathname.split("/").pop());
      if (!obj) return json({ ok: false, error: "not in vault" }, 404);
      return new Response(obj.body, { headers: { ...CORS, "content-type": "application/json" } });
    }
    if (req.method === "GET" && u.pathname.startsWith("/shot/")) {
      const obj = await env.BUCKET.get("shots/" + u.pathname.split("/").pop());
      if (!obj) return new Response("not found", { status: 404, headers: CORS });
      return new Response(obj.body, {
        headers: { ...CORS, "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" }
      });
    }
    if (req.method !== "POST") return json({ ok: false, error: "POST {\"url\":\"https://x.com/handle/status/123\"}" }, 405);

    // ---- 0. validate (reject anything that isn't a tweet URL) ----
    let body = {};
    try { body = await req.json(); } catch (e) {}
    const m = String(body.url || "").match(/^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/i);
    if (!m) return json({ ok: false, error: "x.com / twitter.com status links only" }, 400);
    const handle = m[1], id = m[2];
    const clean = "https://x.com/" + handle + "/status/" + id;
    const base = (env.PUBLIC_BASE || u.origin).replace(/\/$/, "");

    // ---- 1. dedupe: one record per tweet, first save wins ----
    const existing = await env.BUCKET.get("vault/" + id + ".json");
    if (existing) {
      const rec = JSON.parse(await existing.text());
      return json({ ok: true, duplicate: true, ...rec });
    }

    const warnings = [];

    // ---- 2. screenshot via ScreenshotOne (renders the official embed page — no login wall) ----
    let imageSaved = false;
    const embedUrl = "https://platform.twitter.com/embed/Tweet.html?dnt=true&theme=light&width=550&id=" + id;
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

    // ---- 3. tweet text via official oEmbed (no login, no key) ----
    let oembed = null;
    try {
      const r = await fetch("https://publish.twitter.com/oembed?omit_script=true&url=" + encodeURIComponent(clean));
      if (r.ok) oembed = await r.json();
      else warnings.push("oembed http " + r.status + " — tweet may already be deleted; archives may still have it");
    } catch (e) {
      warnings.push("oembed error");
    }

    // ---- 4. third-party archives (fire-and-forget, never block the save) ----
    ctx.waitUntil(fetch("https://web.archive.org/save/" + clean).catch(function () {}));
    ctx.waitUntil(fetch("https://archive.ph/submit/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "url=" + encodeURIComponent(clean)
    }).catch(function () {}));

    // ---- 5. the permanent record ----
    const rec = {
      id: id,
      handle: handle,
      url: clean,
      saved_at: new Date().toISOString(),
      image: imageSaved ? base + "/shot/" + id + ".png" : null,
      record: base + "/vault/" + id + ".json",
      author_name: oembed && oembed.author_name || null,
      tweet_html: oembed && oembed.html || null,
      tweet_missing_at_save: !(oembed && oembed.html),
      wayback: "https://web.archive.org/web/2*/" + clean,
      archive_today: "https://archive.ph/newest/" + clean,
      pipeline_version: 2
    };
    await env.BUCKET.put("vault/" + id + ".json", JSON.stringify(rec, null, 2), {
      httpMetadata: { contentType: "application/json" }
    });

    // ---- 6. optional tamper-evident receipt on GitHub ----
    if (env.GH_TOKEN && env.REPO) {
      ctx.waitUntil(fetch("https://api.github.com/repos/" + env.REPO + "/contents/vault/" + id + ".json", {
        method: "PUT",
        headers: {
          "authorization": "Bearer " + env.GH_TOKEN,
          "user-agent": "rug-vault-worker",
          "accept": "application/vnd.github+json"
        },
        body: JSON.stringify({
          message: "vault: @" + handle + " status " + id,
          content: btoa(unescape(encodeURIComponent(JSON.stringify(rec, null, 2))))
        })
      }).catch(function () {}));
    }

    return json({ ok: true, warnings: warnings, ...rec });
  }
};
