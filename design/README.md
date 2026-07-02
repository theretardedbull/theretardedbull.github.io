# Handoff: The Rug Report / The Retarded Bull Gazette — tweet-receipt vault + construction front page

## Overview
A satirical "living newspaper" site that permanently archives pump-and-dump shill tweets before they're deleted. Two deliverables:

1. **The site** — an old-school 1930s broadsheet ("The Retarded Bull Gazette", Sol York bureau) with a working "Saver": any user pastes an x.com status URL → it's validated, stored, and archived to multiple independent stores. Front page is an under-construction teaser; dossier/registry layouts exist as approved concepts for later.
2. **The save pipeline** — production backend in `vault-kit/` (Cloudflare Worker + R2 + ScreenshotOne + Wayback + archive.today + optional GitHub receipts). This part IS production-ready code, not a mock.

## About the Design Files
The HTML files here are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. Recreate them in the target codebase's environment using its patterns and libraries; if no environment exists yet, pick the best fit (a static site + one Cloudflare Worker is enough — no framework strictly required). Exception: `vault-kit/worker.js` and `vault-kit/save-tweet.yml` are real, deployable code.

`The Rug Report.dc.html` is a multi-option design canvas. Options are stacked newest-first, each labeled with a badge id:

- **4a — The Retarded Bull Gazette (PRIMARY — build this)**: minimal construction front page. Masthead, UNDER CONSTRUCTION stamp, framed bull illustration, the Saver, vault ledger, footer.
- **3a — Notice of Construction**: fuller variant of 4a (public-notice panel, engraved Sol York skyline band, 3-portrait newsroom, works-progress bar). Source of secondary patterns.
- **1a / 1b — dossier registry concepts (future phase)**: broadsheet front page & dark "bounty board" with hover-alive portrait dossiers (tweet receipt + chart + on-chain ledger + cleared/green entries + dispute links).
- **2a — neon Sol York construction page: DEPRECATED. Client rejected the colored/neon direction. Do not build.**

## Fidelity
**High-fidelity.** Colors, type, spacing, and copy in 4a/3a are final — recreate pixel-perfectly. 1a/1b are approved directions but content is placeholder (fictional handles). 2a is dead.

## Screens / Views

### 4a — The Retarded Bull Gazette (primary, 1240px desktop)
Aged-paper page, `radial-gradient(ellipse at 50% 20%, #f7f0de 0%, #efe5cb 62%, #e7dab9 100%)`, ink `#231d14`, serif `'Old Standard TT'`.

Top→bottom:
1. **Rule row** — 1px ink bottom border; 3 uppercase labels (11.5px, letter-spacing .14em): "Demonstration edition" · "Sol York bureau — <date>" · "Price: two lamports". Padding 10px 28px 6px.
2. **Masthead** — centered, 3px double ink bottom border, padding 22px 28px 12px. Title "The Retarded Bull Gazette": 64px, weight 700, `font-variant: small-caps`, line-height 1. Motto under (12.5px, ls .18em, uppercase): "All the rugs that's fit to print — presses arriving soon™". **UNDER CONSTRUCTION stamp** absolute top 16px right 34px: 2.5px solid `#7a1f1f`, same text color, IBM Plex Mono 600 12px ls .16em, padding 4px 10px, `rotate(-6deg)`, bg `rgba(251,246,232,.9)`.
3. **Editor plate** — centered column width 480px, padding 34px 28px 8px. Frame: 1px solid ink + `box-shadow: 0 0 0 6px #efe6d0, 0 0 0 7px #231d14, 6px 8px 0 rgba(35,29,20,.18)`; height 420px; contains the bull illustration `bull-editor.svg` (image is user-replaceable by an AI image drop — keep that slot behavior). Caption under (Special Elite 12.5px, `#3d3426`, centered): "the editor, typing out the rugs — cigar break №4 of 9".
4. **The Saver** — box `margin: 20px 120px 0`, 2px dashed ink border, bg `#f2ead2`, padding 16px 20px:
   - Header row (space-between, baseline): "The Saver — open during construction" (24px, 700, small-caps) · "IN THE VAULT: <b>N</b> TWEETS" (Special Elite 12px).
   - Input row (flex, gap 12px, margin-top 12px): text input flex:1 (1px solid ink, bg `#fbf6e8`, Special Elite 13px, padding 12px 14px; focus: `box-shadow: 3px 3px 0 rgba(35,29,20,.25)`), placeholder "https://x.com/handle/status/1234567890". **FILE IT** stamp-button: 2.5px solid `#7a1f1f`, text `#7a1f1f`, bg `rgba(251,246,232,.9)`, IBM Plex Mono 600 13px ls .18em, padding 10px 22px, `rotate(-1.5deg)`; hover inverts (bg `#7a1f1f`, text `#f0e6cd`); active adds `translateY(1px)`.
   - Status line (IBM Plex Mono 11.5px, min-height 15px): ink `#231d14` on success, `#7a1f1f` on error. Messages: success "✓ SAVED LOCALLY — WAYBACK SNAPSHOT OPENING IN NEW TAB (LET IT FINISH)"; error "✗ X.COM / TWITTER.COM STATUS LINKS ONLY — PASTE THE FULL TWEET URL".
   - **Small print** (11px italic, ls .04em, `#5c4f38`): "*** to save a tweet — paste the URL of the post BEFORE it is deleted; once filed, the delete button can't reach it ***"
   - **Vault ledger** (margin-top 10px, 1px solid ink, bg `#fbf6e8`): one row per saved tweet (flex, gap 12px, padding 8px 12px, 1px `#d8cba6` top border between rows, Special Elite 12px, ink): `@handle` (700) · tweet id (`#5c4f38`) · **tweet-text ticker** (flex:1, min-width:0, 1px `#d8cba6` left+right borders, padding 0 10px; inner span duplicated twice, `animation: ticker 26s linear infinite` translating −50%; shows "“<tweet text>” — <author>", fallback "reading the words back from the archive…") · time (`#5c4f38`) · "saved ✓" (700) · links: "wayback ↗" + "arch.today ↗" (`#7a1f1f`, underline) + "view ↗" (ink, underline). **No green, no yellow — strictly ink/sepia/oxblood.**
5. **Footer** — 3px double ink top border, space-between, 11.5px `#3d3426`: "We publish documents, not verdicts. Disputes: bullitchloser@gmail.com — 72h review." · "All handles fictional · bull crew local №420".

### 3a — Notice of Construction (secondary patterns)
Same paper/type system. Adds: black ink wire-ticker strip (Special Elite 13px cream text on `#231d14`, marquee 40s); double-border public-notice panel with centered small-caps headline; engraved city band (170px, bg `#f3ecd8`, flat ink `#2b2418` skyline blocks + palms + crane with swinging ◎ coin, label "— Sol York —" ls .5em); 3-frame newsroom grid (230px-tall framed slots, cigar-smoke wisp animation, Special Elite captions); works-progress bar (12% wide ink/paper hatch stripe animation, label "Works progress — 12% — pouring foundation"); milestone row ("✓ Now — the Saver (open) · Next — the vault ledger page · Then — dossiers · Soon — living portraits").

### 1a / 1b — dossier registry (future phase; keep for reference)
- 1a: broadsheet front page. Lead dossier = engraved portrait plate + headline "He Was 'Not Selling.' He Sold." + Exhibit A (typewriter tweet card w/ rotated DELETED stamp + archive line) + Exhibit B (SVG price chart, draw-in on hover, red sell marker "CREATOR SELLS 82% · 2:26 PM") + 3 stat stamps (est. dumped / rug score / promise-to-dump interval). Rogues' Gallery: 3 hover-alive cards (portrait desaturated `grayscale(.95) sepia(.32)` → color + slow ken-burns zoom on hover; receipt panel slides open, max-height 0→520px). Green-ink CLEARED row. Submit box. 3-column methodology footer.
- 1b: near-black `#14120e` ledger, gold `#d9b95c` masthead "THE RUGGED LEDGER", red wire strip `#5d1616`, mugshot plates on height-line background, case №s, thermal-paper tweet strips, exhibit C on-chain sell table, DUMPED rubber stamp, bounty board, gold CLEARED plaque.

## Interactions & Behavior
- **Saver flow (client)**: validate `^https?://(www.)?(x.com|twitter.com)/<handle>/status/<digits>` → canonicalize to `https://x.com/<handle>/<id>` → prepend row, persist → open archive tab → async fetch tweet text from `https://publish.twitter.com/oembed?omit_script=true&url=<url>` (strip HTML → plain text) for the ticker; Enter key submits; input clears on success.
- **Save targets (in priority order)**: production = POST to vault-kit worker (returns image + record URLs); interim = `https://web.archive.org/save/<url>` in new tab; optional = prefilled GitHub issue `title="save: <url>"` when a repo is configured.
- **Per-row archive links**: wayback save (`/save/`), archive.today prefill (`archive.ph/?url=`), wayback view (`/web/2*/`).
- **Hover-alive portraits (1a/1b/3a)**: card hover → portrait filter none + `kenburns 7s ease-in-out infinite alternate` (scale 1.01→1.08 translate −1.6%,−2.2%); receipt reveal max-height/opacity .65s; chart `stroke-dashoffset` 900→0 over 1.5s; "LIVING PORTRAIT" chip fades in (red dot pulse 1.1s).
- **Tickers**: duplicated inline content, translateX(0→−50%) linear infinite (wire strip 40s; ledger row 26s).
- **Tweakable props** (site-wide settings): `aliveMode` hover|always|still; `redactHandles` boolean (blurs all @handles 6px — legal-safe screenshot mode); `githubRepo` string.

## State Management
- `rows[]`: `{handle, id, url, time (HH:MM), status, text?, author?}` — newest first, cap 12 displayed / 50 persisted; localStorage key `rugreport_vault_v1`. Production should read the vault from the worker/R2 instead (records at `/vault/<id>.json`).
- `status` + `ok` for the last save attempt. No client dedupe — the worker dedupes (first save wins).
- Empty vault = ledger shows only its rules; no placeholder rows.

## Design Tokens
Paper: `#f7f0de → #efe5cb → #e7dab9` (radial) · card paper `#fbf6e8` · saver panel `#f2ead2` · engraved band `#f3ecd8` · frame mat `#efe6d0`.
Ink: `#231d14` (primary) · `#2b2418` (engraving) · `#5c4f38` (sepia muted) · `#3d3426` (body muted) · rules `#8a7a58` / ledger `#d8cba6`.
Accent: oxblood `#7a1f1f` (stamps, errors, links) — the ONLY accent on paper pages. Cream-on-ink `#f0e6cd`.
1b dark set: bg `#14120e`/`#0f0e0b`, gold `#d9b95c` (+`#6b5a26` shadow), khaki `#9c8a5e`, cream `#e9dfc8`/`#f3ead3`, red wire `#5d1616`, chart green `#57c785` / red `#e05353` (charts only).
Type: Old Standard TT (400/700 + italic) — masthead small-caps, headlines, body serif; Special Elite — tweets, ledger, captions; IBM Plex Mono (400–600) — stamps, buttons, data chips. Scale: masthead 64–88 / headline 44–46 / section 24–28 / body 14–17 / meta 10.5–13.
Radii: 0 everywhere on paper pages (sharp corners; the rotated-stamp trick supplies the character). Shadows: hard offset `6px 8px 0 rgba(35,29,20,.18)` + double-outline frames (see 4a plate).

## Assets
- `bull-editor.svg` — hand-drawn 1930s woodcut bull (fedora + PRESS card, cigar, typewriter; SMIL typing-tap + smoke loops; strictly `#241c12` ink / `#f3ecd8` paper / `#fbf6e8` sheet). Default art for the editor plate; user-dropped AI image replaces it.
- `image-slot.js` — drag-and-drop image slot web component used by every portrait frame (prototype-only; reimplement as a plain upload/img in production).
- Google Fonts: Old Standard TT, Special Elite, IBM Plex Mono (Archivo Black only in deprecated 2a).

## Backend (`vault-kit/` — deployable as-is)
- `worker.js` — Cloudflare Worker: `POST / {url}` → validate → dedupe → ScreenshotOne render of the tweet's official embed page (no login wall) → PNG to R2 `shots/<id>.png` → oEmbed text → fire Wayback + archive.today → record to R2 `vault/<id>.json` → optional GitHub receipt commit. `GET /vault/<id>.json`, `GET /shot/<id>.png` (immutable). Env: `BUCKET` (R2 binding), `SCREENSHOTONE_KEY`, optional `PUBLIC_BASE`, `GH_TOKEN`, `REPO`. Nothing fails silently — `warnings[]` in every response.
- `save-tweet.yml` — free fallback path: GitHub-issue-driven archive bot.
- `README.md` — permanence table (4 copies / 4 failure domains), launch checklist, monthly audit ritual, costs (~$17–20/mo at 2k saves).

## Legal guardrails (bake into all registry copy)
Publish documents, never verdicts: archived post + timestamps + public on-chain transactions. Never "scammer/fraud/criminal" on a dossier. Attribution confidence stated; dispute path (bullitchloser@gmail.com, 72h) on every page; errors delisted with printed correction. Demo handles are fictional and labeled as such.

## Files
- `The Rug Report.dc.html` — all design options (4a primary; open in browser; options stacked newest-first)
- `bull-editor.svg`, `image-slot.js` — assets above
- `vault-kit/worker.js`, `vault-kit/save-tweet.yml`, `vault-kit/README.md` — backend
