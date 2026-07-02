# The Retarded Bull Gazette

A satirical "living newspaper" that permanently archives pump-and-dump shill tweets before they're deleted. Front page is a 1930s broadsheet construction edition with a working **Saver**: paste an x.com status URL and it's validated, filed to the vault ledger, and pushed to the Wayback Machine.

## Structure

- `index.html` — the live site (static, no build step). Option 4a from the design handoff.
- `bull-editor.svg` — the editor at his typewriter.
- `vault-kit/` — production archive pipeline (Cloudflare Worker + R2 + ScreenshotOne + Wayback + archive.today). Deployable as-is when ready; see its README.
- `design/` — full design handoff: the multi-option design canvas, spec README, and future-phase dossier/registry concepts (1a/1b).

## Running locally

Open `index.html` in a browser, or:

```sh
python3 -m http.server 8000
```

## Deploying

GitHub Pages, serving `main` branch root. No build command — it's plain HTML.

Custom domain (registrar: Porkbun) — DNS records:

| Type | Host | Answer |
|---|---|---|
| A | apex (`@`) | 185.199.108.153 |
| A | apex (`@`) | 185.199.109.153 |
| A | apex (`@`) | 185.199.110.153 |
| A | apex (`@`) | 185.199.111.153 |
| CNAME | `www` | `<github-username>.github.io` |

Delete Porkbun's default parked ALIAS/CNAME records first, set the custom domain in repo Settings → Pages, then tick **Enforce HTTPS** once the certificate issues.

The site works on any static host (Vercel/Netlify/Cloudflare Pages) the same way.

## What this site is not

Static HTML only. It stores tweet **URLs** — in the visitor's own browser (localStorage) and as JSON receipts in this public repo. No wallet connection, no token, no accounts, no cookies, no analytics, no data collection. Outbound links go to web.archive.org, archive.ph, and github.com. Disputes: bullitchloser@gmail.com (72h review); see `.well-known/security.txt`.

## Config

Two settings at the top of the inline script in `index.html`:

- `GITHUB_REPO` — set to `"owner/repo"` to route saves through the vault-kit GitHub issue bot instead of a direct Wayback tab.
- `REDACT_HANDLES` — `true` blurs all @handles (legal-safe screenshot mode).

## House rules

We publish documents, not verdicts: archived posts, timestamps, public on-chain transactions. Disputes: bullitchloser@gmail.com — 72h review. Errors are delisted with a printed correction.
