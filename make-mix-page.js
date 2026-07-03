#!/usr/bin/env node
// make-mix-page.js — build mix/index.html + mix/mix.m3u from a rendered
// playlist directory (genre-kernel.js playlist ... --out mix --render-first N).
//   node make-mix-page.js [dir] [baseUrl]
"use strict";
const fs = require("fs");
const path = require("path");

const dir = process.argv[2] || "mix";
const base = (process.argv[3] || "https://aboardresearch.com/projects/vaporwave/" + dir).replace(/\/$/, "");
const pl = JSON.parse(fs.readFileSync(path.join(dir, "playlist.json"), "utf8"));
const tracks = pl.filter(t => fs.existsSync(path.join(dir, `track-${String(t.i + 1).padStart(2, "0")}.mp3`)));

const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const total = tracks.reduce((s, t) => s + t.seconds, 0);

// ---- M3U (extended, absolute URLs so it works in any player) ----
const m3u = ["#EXTM3U"];
for (const t of tracks) {
  const f = `track-${String(t.i + 1).padStart(2, "0")}.mp3`;
  m3u.push(`#EXTINF:${t.seconds},${t.from}→${t.to} t=${t.t} — ${t.bpm}bpm ${KEYS[t.key]} (${t.meta.kit}, ${t.meta.found})`);
  m3u.push(`${base}/${f}`);
}
fs.writeFileSync(path.join(dir, "mix.m3u"), m3u.join("\n") + "\n");

// ---- page ----
const rows = tracks.map(t => {
  const nn = String(t.i + 1).padStart(2, "0");
  const f = `track-${nn}.mp3`;
  const vid = fs.existsSync(path.join(dir, `track-${nn}.mp4`)) ? ` · <a href="track-${nn}.mp4">▶ video</a>` : "";
  const pos = t.t === 0 ? t.from : t.t === 1 ? t.to : `${t.from} → ${t.to} · t=${t.t}`;
  const blend = Array.isArray(t.weights)
    ? t.weights
        .map(w => ({ g: w.g, pct: Math.round(w.w * 100) }))
        .filter(w => w.pct >= 5)
        .sort((a, b) => b.pct - a.pct)
        .map(w => `${w.g} ${w.pct}%`).join(" · ")
    : "";
  const blendLine = blend ? `<br>\n        blend ${blend}` : "";
  return `    <div class="trk">
      <div class="n">${nn}</div>
      <div class="meta">
        <div class="pos">${pos}</div>
        <div class="coords">${t.bpm} bpm · ${KEYS[t.key]} · ${mmss(t.seconds)} · ${t.meta.form} form${vid}<br>
        kit ${t.meta.kit} · bass ${t.meta.bass} · lead ${t.meta.lead} · ${t.meta.progression}<br>
        sample ${t.meta.found} · hits ${t.meta.hits} · drums ${t.meta.drums}${blendLine}</div>
      </div>
      <audio controls preload="none" src="${f}"></audio>
    </div>`;
}).join("\n");
// long-form artifacts (genre-kernel.js journey --render --video)
const hasJourneyMp4 = fs.existsSync(path.join(dir, "journey.mp4"));
const journeyPlayer = hasJourneyMp4 ? `<div class="jv">
    <video controls preload="metadata" src="journey.mp4"></video>
    <div class="jv-cap">the whole journey, cuts locked to section downbeats</div>
  </div>
  ` : "";
// (journey.mp4 link is folded away: the player above embeds it when present)
const longLinks = [
  fs.existsSync(path.join(dir, "journey.mp3")) ? `<a class="m3u" href="journey.mp3">▶ journey.mp3 — the whole ride, one file</a>` : "",
].filter(Boolean).join("\n  ");

fs.writeFileSync(path.join(dir, "index.html"), `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CONSTELLATE — a generated mix</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=VT323&display=swap" rel="stylesheet">
<style>
  body{margin:0;min-height:100vh;background:#0c0a1a;color:#ece9ff;
    font:15px/1.6 ui-sans-serif,system-ui,sans-serif;padding:2rem 1rem 4rem}
  body::before{content:"";position:fixed;inset:0;z-index:-1;background:
    radial-gradient(70% 48% at 50% -10%,rgba(255,110,199,.16),transparent 60%),
    radial-gradient(95% 60% at 50% -10%,rgba(160,107,255,.12),transparent 72%)}
  .wrap{max-width:760px;margin:0 auto}
  h1{font-family:Orbitron,sans-serif;font-size:1.5rem;letter-spacing:.05em;margin:0 0 .2rem;
    background:linear-gradient(90deg,#ffd86b,#ff6ec7 52%,#45e0ff);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  .sub{color:#9b93c6;font-size:.85rem;margin:0 0 1.6rem;max-width:62ch}
  .m3u{display:inline-block;margin:0 0 1.8rem;padding:.5rem .9rem;border:1px solid #3b3568;border-radius:9px;
    color:#45e0ff;text-decoration:none;font-family:VT323,monospace;font-size:1.05rem}
  .m3u:hover{border-color:#45e0ff}
  .jv{margin:0 0 1.6rem}
  .jv video{display:block;width:100%;background:#15122c;border:1px solid #2c2750;border-radius:12px}
  .jv-cap{color:#9b93c6;font-family:VT323,monospace;font-size:1rem;margin-top:.35rem}
  .trk{display:flex;gap:.9rem;align-items:center;background:#15122c;border:1px solid #2c2750;
    border-radius:12px;padding:.85rem .95rem;margin:0 0 .7rem;flex-wrap:wrap}
  .n{font-family:VT323,monospace;font-size:1.6rem;color:#ff6ec7;min-width:2ch}
  .meta{flex:1;min-width:230px}
  .pos{font-family:Orbitron,sans-serif;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:#45e0ff}
  .coords{color:#9b93c6;font-size:.72rem;margin-top:.2rem}
  audio{width:100%;max-width:330px;height:36px}
  .foot{color:#9b93c6;font-size:.75rem;margin-top:2rem}
  a{color:#45e0ff}
</style>
</head>
<body>
<div class="wrap">
  <h1>CONSTELLATE — ${mmss(total)} generated mix</h1>
  <p class="sub">${tracks.length} tracks walking ${pl[0].from} → ${pl[pl.length - 1].to} through a
  multidimensional genre space. Every note, drum hit, filter sweep, sample chop, and spoken phrase is
  generated from a seeded state — no two tracks share a kit, progression, and lead. Coordinates shown
  per track are the actual resolved dimensions.</p>
  ${journeyPlayer}<a class="m3u" href="mix.m3u">▶ mix.m3u — open the whole set in your player</a>
  ${longLinks}
${rows}
  <p class="foot">Generated by the <a href="../explorer.html">CONSTELLATE</a> genre kernel
  (<a href="https://archive.org">found sound &amp; samples: Internet Archive</a>, credits in SOURCES.md).
  Each track's full state JSON sits next to its mp3.</p>
</div>
</body>
</html>
`);
console.log(`✓ ${dir}/index.html + ${dir}/mix.m3u (${tracks.length} tracks, ${mmss(total)})`);
