// receipt-page — renders a saved post as an X-style tweet card with the
// Arweave proof underneath. Draws entirely from the saved record, so it
// looks like the tweet forever — even after the delete button gets pressed.

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  }[c]));
}

function fmtWhen(iso) {
  if (!iso) return "time unrecovered";
  const d = new Date(iso);
  if (isNaN(d)) return "time unrecovered";
  const t = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${t} · ${day} · UTC`;
}

function fmtNum(n) {
  if (n == null) return null;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export function renderReceiptPage(rec) {
  const name = rec.author_name && rec.author_name !== "@" + rec.handle ? rec.author_name : rec.handle;
  const textHtml = esc(rec.text || "")
    .split(/\n/).map((l) => l || "&nbsp;").join("<br>");
  const missing = !rec.text;
  const initial = (rec.handle || "?").slice(0, 1).toUpperCase();
  const avatar = rec.avatar_url
    ? `<img class="av" src="${esc(rec.avatar_url.replace("_normal", "_200x200"))}" alt="" onerror="this.outerHTML='<div class=&quot;av avf&quot;>${esc(initial)}</div>'">`
    : `<div class="av avf">${esc(initial)}</div>`;
  const photo = rec.photo && rec.photo.url
    ? `<img class="ph" src="${esc(rec.photo.url)}" alt="" onerror="this.remove()">`
    : "";
  const s = rec.stats || {};
  const statBits = [
    s.replies != null ? `<span><b>${fmtNum(s.replies)}</b> replies</span>` : "",
    s.reposts != null ? `<span><b>${fmtNum(s.reposts)}</b> reposts</span>` : "",
    s.likes != null ? `<span><b>${fmtNum(s.likes)}</b> likes</span>` : "",
    s.views != null ? `<span><b>${fmtNum(s.views)}</b> views</span>` : "",
  ].filter(Boolean).join(" · ");
  const arTx = rec.arweave_tx || (rec.arweave || "").split("/").pop() || "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>@${esc(rec.handle)} — archived post · The Retarded Bull Gazette</title>
<meta property="og:title" content="@${esc(rec.handle)} — archived forever">
<meta property="og:description" content="${esc((rec.text || "post archived by the Gazette").slice(0, 160))}">
<style>
*{box-sizing:border-box;margin:0}
body{background:radial-gradient(ellipse at 50% 20%, #f7f0de 0%, #efe5cb 62%, #e7dab9 100%);min-height:100vh;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  display:flex;flex-direction:column;align-items:center;padding:34px 16px 60px;color:#231d14}
.mast{font-family:Georgia,'Times New Roman',serif;font-weight:700;font-variant:small-caps;font-size:22px;
  letter-spacing:.04em;margin-bottom:6px}
.case{font-family:'Courier New',monospace;font-size:13px;letter-spacing:.08em;color:#3d3426;margin-bottom:18px;text-align:center}
.cell{position:relative;max-width:720px;width:100%;padding:26px 60px;display:flex;justify-content:center}
.bars{position:absolute;inset:0;pointer-events:none;z-index:1;display:flex;justify-content:space-between;padding:0 10px}
.bars i{width:13px;border-radius:7px;
  background:linear-gradient(90deg,#17120b 0%,#453a28 42%,#71614a 50%,#453a28 58%,#17120b 100%);
  box-shadow:3px 0 7px rgba(20,15,8,.35)}
.rail{position:absolute;left:0;right:0;height:15px;border-radius:8px;z-index:4;pointer-events:none;
  background:linear-gradient(180deg,#17120b 0%,#453a28 40%,#71614a 50%,#453a28 60%,#17120b 100%);
  box-shadow:0 4px 8px rgba(20,15,8,.3)}
.rail.top{top:0}.rail.bot{bottom:0}
.gotcha{position:absolute;top:-6px;right:-12px;transform:rotate(-9deg);z-index:5;
  border:3.5px solid #7a1f1f;color:#7a1f1f;font-family:'Courier New',monospace;font-weight:700;
  font-size:27px;letter-spacing:.22em;padding:7px 18px;background:rgba(251,246,232,.94);
  box-shadow:4px 5px 0 rgba(35,29,20,.28)}
.card{position:relative;z-index:2;background:#fff;border:1px solid #e3e6e8;border-radius:16px;width:min(560px,100%);
  padding:18px 20px 14px;box-shadow:0 10px 26px rgba(35,29,20,.30)}
.head{display:flex;align-items:center;gap:10px}
.av{width:48px;height:48px;border-radius:50%;object-fit:cover;flex:none}
.avf{background:#7a1f1f;color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700}
.who{flex:1;min-width:0;line-height:1.25}
.nm{font-weight:700;font-size:15.5px;color:#0f1419;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hd{font-size:15px;color:#536471}
.x{font-size:22px;color:#0f1419;text-decoration:none;flex:none;font-weight:700}
.txt{font-size:${(rec.text || "").length > 130 ? 17 : 23}px;line-height:1.35;color:#0f1419;margin-top:14px;overflow-wrap:break-word}
.txt.missing{color:#536471;font-style:italic;font-size:17px}
.ph{margin-top:14px;width:100%;border-radius:16px;border:1px solid #e3e6e8;display:block}
.when{margin-top:14px;font-size:15px;color:#536471}
.stats{margin-top:10px;padding-top:10px;border-top:1px solid #eff3f4;font-size:14px;color:#536471;display:flex;gap:0;flex-wrap:wrap}
.stats span{margin-right:14px}
.stats b{color:#0f1419;font-weight:700}
.proof{max-width:598px;width:100%;margin-top:18px;border:2px dashed #231d14;background:#f2ead2;padding:14px 18px;
  font-family:'Courier New',monospace;font-size:13px;line-height:1.7;color:#231d14}
.proof .stamp{display:inline-block;border:2.5px solid #7a1f1f;color:#7a1f1f;background:rgba(251,246,232,.9);
  padding:3px 10px;font-weight:700;letter-spacing:.14em;font-size:12px;transform:rotate(-1.5deg);margin-bottom:8px}
.proof a{color:#7a1f1f;word-break:break-all}
.proof .muted{color:#5c4f38}
.foot{margin-top:22px;font-family:Georgia,serif;font-size:12.5px;color:#3d3426;font-style:italic;text-align:center}
.foot a{color:#231d14}
</style>
</head>
<body>
  <div class="mast">The Retarded Bull Gazette</div>
  <div class="case">CASE №${esc(rec.id)} · THE PEOPLE OF SOL YORK vs @${esc(rec.handle)}</div>

  <div class="cell">
  <div class="rail top"></div>
  <div class="card">
    <div class="head">
      ${avatar}
      <div class="who">
        <div class="nm">${esc(name)}</div>
        <div class="hd">@${esc(rec.handle)}</div>
      </div>
      <span class="x">𝕏</span>
    </div>
    <div class="txt${missing ? " missing" : ""}">${missing ? "The words were already gone when the editor arrived — but the filing stands." : textHtml}</div>
    ${photo}
    <div class="when">${esc(fmtWhen(rec.posted_at))}</div>
    ${statBits ? `<div class="stats">${statBits}</div>` : ""}
  </div>
  <div class="bars"><i></i><i></i><i></i><i></i><i></i><i></i></div>
  <div class="rail bot"></div>
  <div class="gotcha">GOTCHA</div>
  </div>

  <div class="proof">
    <span class="stamp">FOREVER MEANS ARWEAVE</span><br>
    <span class="muted">this record is sealed on the arweave permanent network at address:</span><br>
    <a href="${esc(rec.arweave || "#")}" style="font-size:15px;font-weight:700">ar://${esc(arTx || "")}</a><br>
    <span class="muted">posted ${esc(rec.posted_at || "?")} · filed ${esc(rec.saved_at || "?")} · original: </span><a href="${esc(rec.url)}">${esc(rec.url)}</a><br>
    <span class="muted">once filed, the delete button can't reach it.</span>
  </div>

  <div class="foot">a document, not a verdict — <a href="https://theretardedbull.xyz">theretardedbull.xyz</a></div>
</body>
</html>`;
}
