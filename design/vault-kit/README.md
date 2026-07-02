# Rug Vault — the tweet never dies

One paste → four independent copies, in four failure domains:

| Copy | Where | Survives |
|---|---|---|
| Screenshot PNG + JSON record | Your Cloudflare R2 bucket | X deletions, account bans — anything except you not paying |
| Wayback Machine snapshot | web.archive.org (nonprofit, ~30 yrs) | You quitting the project entirely |
| archive.today snapshot | archive.ph | Same — independent second archive |
| JSON receipt in git history | Your GitHub repo (public) | Tampering — every edit is visible; anyone can fork/mirror |

No single "forever" vendor exists; four independent copies is what forever actually looks like.

## Path A — user-friendly, paid (recommended): `worker.js`

Accounts needed (≈30 min, ~$17–20/month):
1. **Cloudflare** (free): Workers + R2. Create bucket `rug-vault`, deploy `worker.js`, bind bucket as `BUCKET`.
2. **ScreenshotOne** ($17/mo, 2k shots): copy API key → worker variable `SCREENSHOTONE_KEY`.
3. **GitHub** (optional, free): fine-grained token, Contents: write → variables `GH_TOKEN` + `REPO`.

Then your site POSTs `{"url": "..."}` to the worker and gets back:
- `image` — PNG of the tweet (rendered from Twitter's official embed page — no login wall) to show on your site
- `record` — permanent JSON with text, author, timestamps, archive links
- `warnings` — anything that didn't complete (nothing fails silently)

Built-in "no mistakes" behavior: strict URL validation · dedupe (first save wins) ·
oEmbed text capture even if screenshot fails · archives fired on every save ·
immutable cache headers on images.

## Path B — free, no server: `save-tweet.yml`

GitHub-Issues-driven bot (see comments in the file). Submitters need GitHub accounts.
Good fallback / receipt layer; Path A is the user-friendly one.

## Launch checklist — run this BEFORE telling anyone

1. POST a real tweet URL → response `ok: true`, `warnings: []`.
2. Open the `image` link — the tweet renders as a clean PNG.
3. Open the `record` link — JSON has text + author.
4. POST the same URL again → `duplicate: true` (dedupe works).
5. POST garbage (`https://example.com`) → 400 rejected.
6. 10 minutes later: open the `wayback` link — a snapshot exists. If Wayback shows a login wall for x.com, archive.today is your reliable third-party copy — open the `archive_today` link too.
7. Delete nothing. Test tweet stays as save №1 — your genesis receipt.

## Monthly ritual (5 minutes)

- Spot-check 3 random records: image loads, archive links live.
- R2 dashboard → verify object count matches record count.
- Optional paranoia: sync the bucket to Backblaze B2 or a local drive (rclone one-liner).

## Cost at scale

2,000 saves/mo ≈ $17 (ScreenshotOne) + pennies (R2, ~50KB/PNG) + $0 (worker, archives, GitHub).
10,000 saves/mo ≈ $79 tier. Storage stays trivial.
