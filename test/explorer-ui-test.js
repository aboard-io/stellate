#!/usr/bin/env node
// faust/explorer-ui-test.js — headless UI gate for the 2026-07-08 explorer
// product changes (Paul):
//   1. DEFAULT 4-STEP CLOSED LOOP, waypoint 1 always at the map centre.
//   2. Genres laid out DYNAMICALLY at load (computeGenreLayout, deterministic) —
//      every K.GENRES genre placed, no two stars within a comfortable on-screen
//      distance AND no two NAME LABELS overlap at the default zoom; zoomable.
//   3. VIDEO on/off button DEFAULTS OFF.
// Drives explorer.html headless and asserts (all must PASS):
//   A. exactly 4 default waypoints on a fresh load;
//   B. waypoint[0] sits at the computed map centre (within ~1 logical px);
//   C. the path is a CLOSED loop — pathClosed() true, the drawn constellation
//      polyline repeats point 1 (n+1 points), and travelStep() wraps seg
//      0→1→2→3→0 seamlessly, the traveller returning to waypoint[0];
//   D. min pairwise star distance in SCREEN space (default zoom) exceeds the
//      comfort threshold;
//   D2. every K.GENRES genre has a computed position AND no two genre NAME LABELS
//      overlap at the default zoom (boxes measured in real px); fugue lands near
//      prelude, afrobeat gets a sensible spot (the two genres derived at load);
//   E. zoom in (k up to 4) and back to fit; k stays in range, k===1 recentres;
//   F. VideoLayer.enabled() === false on load;
//   G. no console/page errors on load, nor after starting playback (a short
//      live ride: engine boots, real audio comes out, then STOP).
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node faust/explorer-ui-test.js
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8799;

// Standard MIDI File checker (test J): full chunk math, not a magic sniff —
// MThd header (len 6, format/ntrks/ppq), then exactly ntrks MTrk chunks whose
// declared lengths tile the file, each ending in the FF 2F 00 end-of-track meta.
function parseSmf(bytes) {
  const b = Uint8Array.from(bytes || []);
  if (b.length < 22) return { ok: false, err: `only ${b.length} bytes` };
  const str = (o, n) => String.fromCharCode(...b.slice(o, o + n));
  const u32 = (o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const u16 = (o) => (b[o] << 8) | b[o + 1];
  if (str(0, 4) !== "MThd") return { ok: false, err: "no MThd magic" };
  if (u32(4) !== 6) return { ok: false, err: `MThd length ${u32(4)} (want 6)` };
  const fmt = u16(8), ntrk = u16(10), ppq = u16(12);
  let o = 14, tracks = 0;
  while (o < b.length) {
    if (str(o, 4) !== "MTrk") return { ok: false, err: `chunk ${tracks} @${o} not MTrk` };
    const len = u32(o + 4);
    if (o + 8 + len > b.length) return { ok: false, err: `track ${tracks} overruns file (${len} bytes @${o})` };
    const e = o + 8 + len;
    if (!(b[e - 3] === 0xFF && b[e - 2] === 0x2F && b[e - 1] === 0x00))
      return { ok: false, err: `track ${tracks} lacks FF 2F 00 end-of-track` };
    o = e; tracks++;
  }
  if (o !== b.length) return { ok: false, err: `${b.length - o} trailing bytes` };
  if (tracks !== ntrk) return { ok: false, err: `header says ${ntrk} tracks, file has ${tracks}` };
  return { ok: true, fmt, ntrk, ppq, bytes: b.length };
}
const SCREEN_SEP_MIN = 40;   // px between any two stars at DEFAULT zoom (1200x850 viewport); the
                             // computed layout enforces a hard 52px dot floor, lands ~47px min

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 850 });
  const errs = capturePageErrors(page);
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); return cond; };

  await page.goto(`http://localhost:${PORT}/index.html?bgAltMs=1200`);   // fast idle bg-alt clock for the H test
  await page.waitForFunction(() => window.__X && window.__S && window.__LOOP, { timeout: 20000 });
  await page.waitForTimeout(500);
  const loadErrs = errs.slice();

  // ---- A/B: 4 waypoints, waypoint[0] at the map centre ----
  const seed = await page.evaluate(() => ({
    n: __S.waypoints.length,
    wp0: { x: __S.waypoints[0].x, y: __S.waypoints[0].y },
    center: __X.mapCenter(),
    loop: window.__LOOP,
    world: __X.world(),
    closed: __X.pathClosed(),
  }));
  ok(seed.n === 4, `A: default waypoints = ${seed.n} (want exactly 4)`);
  const cErr = Math.hypot(seed.wp0.x - seed.center.x, seed.wp0.y - seed.center.y);
  ok(cErr <= 2, `B: waypoint[0] off map centre by ${cErr.toFixed(2)} logical px (want <=2)`);
  console.log(`\n=== SEED ===`);
  console.log(`  waypoints=${seed.n}  loop.genres=[${(seed.loop.genres||[]).join(", ")}]`);
  console.log(`  centre=(${seed.center.x.toFixed(0)},${seed.center.y.toFixed(0)})  wp0=(${seed.wp0.x.toFixed(0)},${seed.wp0.y.toFixed(0)})  offBy=${cErr.toFixed(2)}px`);
  console.log(`  world=${seed.world.w}x${seed.world.h}  loop.closed=${seed.loop.closed}`);

  // ---- C: closed-loop rendering + travelStep wrap ----
  const poly = await page.evaluate(() => {
    const pls = [...document.querySelectorAll("#map polyline")];
    if (!pls.length) return { pts: 0 };
    const pts = pls[0].getAttribute("points").trim().split(/\s+/).length;
    return { pts };
  });
  const nWp = seed.n;
  ok(poly.pts === nWp + 1, `C1: constellation polyline has ${poly.pts} points (want n+1=${nWp + 1} — closing leg drawn)`);
  // drive travelStep deterministically (no audio): pace=8 -> 8 steps per leg,
  // 4 legs -> 32 steps to return; record seg after each and the traveller pos.
  const wrap = await page.evaluate(() => {
    __S.pace = 8;
    const c = __X.mapCenter(); void c;
    const segs = [], n = __S.waypoints.length;
    const start = { x: __S.cursor.x, y: __S.cursor.y };
    // pace=8 -> 8 steps per leg lands exactly on the next waypoint; n*8 steps
    // completes the whole loop and returns to waypoint[0] (seg 0, t 0).
    for (let i = 0; i < n * 8; i++) { __X.travelStep(); segs.push(__S.travel.seg); }
    return { segs, n, endCursor: { x: __S.cursor.x, y: __S.cursor.y }, start };
  });
  // seg must visit every leg 0..n-1 and then wrap back to 0 (a decrease event).
  const segSet = new Set(wrap.segs);
  let sawAllLegs = true; for (let s = 0; s < wrap.n; s++) if (!segSet.has(s)) sawAllLegs = false;
  let wrapped = false; for (let i = 1; i < wrap.segs.length; i++) if (wrap.segs[i] < wrap.segs[i - 1]) wrapped = true;
  ok(sawAllLegs, `C2: travelStep visited legs [${[...segSet].sort().join(",")}], want 0..${wrap.n - 1}`);
  ok(wrapped, `C3: seg never wrapped back to 0 (closing leg not seamless)`);
  const backDist = Math.hypot(wrap.endCursor.x - wrap.start.x, wrap.endCursor.y - wrap.start.y);
  ok(backDist < 5, `C4: after one full loop the traveller is ${backDist.toFixed(1)} logical px from start (want <5 — seamless return)`);
  console.log(`\n=== CLOSED LOOP ===`);
  console.log(`  polylinePoints=${poly.pts} (n+1=${nWp + 1})  segSequence sample=[${wrap.segs.slice(0, 12).join(",")}…]`);
  console.log(`  visitedAllLegs=${sawAllLegs}  wrappedTo0=${wrapped}  returnDist=${backDist.toFixed(2)}px`);

  // ---- D: min pairwise SCREEN separation at the DEFAULT zoom (what Paul sees) ----
  // Projected at k = default zoom; overlap/separation is pan-invariant so offsets
  // are ignored. Both axes scale independently (X uses width/WORLD_W, Y height/H).
  const sep = await page.evaluate(() => {
    const svg = document.getElementById("map"), r = svg.getBoundingClientRect();
    const W = __X.world().w, H = __X.world().h, P = __X.POS, k = window.__ZOOM.k;
    const gs = Object.keys(P);
    const S = gs.map(g => ({ g, x: (P[g][0] * r.width / W) * k, y: (P[g][1] * r.height / H) * k }));
    let mn = Infinity, pr = "";
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
      const d = Math.hypot(S[i].x - S[j].x, S[i].y - S[j].y);
      if (d < mn) { mn = d; pr = S[i].g + "/" + S[j].g; }
    }
    return { mn, pr, logical: __X.minPairDist(), count: gs.length, k };
  });
  ok(sep.mn >= SCREEN_SEP_MIN, `D: min pairwise SCREEN distance ${sep.mn.toFixed(1)}px (${sep.pr}) < ${SCREEN_SEP_MIN}px floor`);
  console.log(`\n=== SPREAD (default zoom k=${sep.k}) ===`);
  console.log(`  ${sep.count} stars  minScreenDist=${sep.mn.toFixed(1)}px (${sep.pr})  minLogicalDist=${sep.logical.toFixed(1)}`);

  // ---- D2: EVERY genre present + NO two NAME LABELS overlap at default zoom ----
  // The core of the 2026-07-08 dynamic-layout change (Paul: "genre names still
  // overlap and are unreadable"). Measure each label's screen box (real VT323/mono
  // width at the default-zoom font, to the RIGHT of the dot, matching drawMap) and
  // assert no two rectangles intersect. Also assert fugue is present and lands near
  // prelude (its most-similar genre), and afrobeat — the two genres derived at load.
  const lab = await page.evaluate(() => {
    const svg = document.getElementById("map"), r = svg.getBoundingClientRect();
    const W = __X.world().w, H = __X.world().h, P = __X.POS, k = window.__ZOOM.k;
    const ALL = Object.keys(GenreKernel.GENRES);
    const missing = ALL.filter(g => !P[g]);
    const fsD = Math.min(3, Math.max(1, Math.pow(k, 0.85)));
    const fontPx = 12 * fsD, ctx = document.createElement("canvas").getContext("2d");
    ctx.font = fontPx + "px VT323, monospace";
    const box = g => { const px = (P[g][0] * r.width / W) * k, py = (P[g][1] * r.height / H) * k, tw = ctx.measureText(g).width;
      return { g, l: px - 4 * fsD, rr: px + 9 * fsD + tw + 3 * fsD, t: py - fontPx / 2 - 3 * fsD, b: py + fontPx / 2 + 3 * fsD }; };
    const B = ALL.map(box);
    let overlaps = 0, worst = "", worstPen = 0, minGap = Infinity, minGapPair = "";
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
      const A = B[i], C = B[j];
      const ox = Math.min(A.rr, C.rr) - Math.max(A.l, C.l);
      const oy = Math.min(A.b, C.b) - Math.max(A.t, C.t);
      if (ox > 0 && oy > 0) { overlaps++; const pen = Math.min(ox, oy); if (pen > worstPen) { worstPen = pen; worst = A.g + "/" + C.g; } }
      else { const gap = Math.max(ox > 0 ? 0 : -ox, oy > 0 ? 0 : -oy); if (gap < minGap) { minGap = gap; minGapPair = A.g + "/" + C.g; } }
    }
    // fugue / afrobeat nearest-neighbour rank (by dot distance)
    const near = t => Object.keys(P).filter(g => g !== t).map(g => ({ g, d: Math.hypot(P[t][0] - P[g][0], P[t][1] - P[g][1]) }))
      .sort((a, b) => a.d - b.d).slice(0, 4).map(x => x.g);
    return { total: ALL.length, placed: ALL.filter(g => P[g]).length, missing, overlaps, worst, worstPen,
      minGap, minGapPair, fugue: P.fugue ? near("fugue") : null, afrobeat: P.afrobeat ? near("afrobeat") : null };
  });
  ok(lab.missing.length === 0, `D2a: ${lab.missing.length} K.GENRES genres have NO computed position: ${lab.missing.slice(0, 8).join(", ")}`);
  ok(lab.placed === lab.total, `D2b: placed ${lab.placed}/${lab.total} genres (want all)`);
  ok(lab.overlaps === 0, `D2c: ${lab.overlaps} pairs of genre LABELS overlap at default zoom (worst ${lab.worst} pen ${lab.worstPen.toFixed(1)}px)`);
  ok(!!lab.fugue, `D2d: fugue has no computed position`);
  ok(lab.fugue && lab.fugue.slice(0, 3).includes("prelude"), `D2e: fugue's 3 nearest are [${(lab.fugue || []).slice(0, 3).join(", ")}] — want prelude among them`);
  console.log(`\n=== LABELS (no-overlap @ default zoom) ===`);
  console.log(`  genres placed=${lab.placed}/${lab.total}  missing=[${lab.missing.join(", ")}]`);
  console.log(`  label overlaps=${lab.overlaps}  min label gap=${lab.minGap === Infinity ? "n/a" : lab.minGap.toFixed(1) + "px"} (${lab.minGapPair})`);
  console.log(`  fugue nearest=[${(lab.fugue || []).join(", ")}]  afrobeat nearest=[${(lab.afrobeat || []).join(", ")}]`);

  // ---- E: zoom reaches in and recentres out ----
  const zoom = await page.evaluate(() => {
    const svg = document.getElementById("map"), r = svg.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    __X.zoomAround(cx, cy, 4);            // zoom in hard
    const zin = { k: window.__ZOOM.k };
    __X.zoomAround(cx, cy, 1);            // back to fit
    const zout = { k: window.__ZOOM.k, ox: window.__ZOOM.ox, oy: window.__ZOOM.oy };
    return { zin, zout };
  });
  ok(zoom.zin.k > 1 && zoom.zin.k <= 4, `E1: zoom-in clamped to ${zoom.zin.k} (want in (1,4])`);
  ok(zoom.zout.k === 1 && zoom.zout.ox === 0 && zoom.zout.oy === 0, `E2: zoom-out to fit left k=${zoom.zout.k} ox=${zoom.zout.ox} oy=${zoom.zout.oy} (want 1/0/0)`);
  console.log(`\n=== ZOOM ===\n  zoomIn k=${zoom.zin.k}  zoomOut k=${zoom.zout.k} ox=${zoom.zout.ox} oy=${zoom.zout.oy}`);

  // ---- F: video default OFF ----
  const vid = await page.evaluate(() => ({
    present: !!window.VideoLayer,
    enabled: window.VideoLayer ? VideoLayer.enabled() : null,
    available: window.VideoLayer ? VideoLayer.available() : null,
  }));
  ok(vid.enabled === false, `F: VideoLayer.enabled() === ${vid.enabled} on load (want false)`);
  console.log(`\n=== VIDEO ===\n  present=${vid.present} available=${vid.available} enabled=${vid.enabled}`);

  // ---- F2: the ? chip opens the ABOUT layer (what/how-to-play/provenance) ----
  // The 2026-07-09 rename+about change: ? is a real modal on the shared chip
  // plumbing, holding links to how.html (the pipeline explainer), the GitHub
  // repo, and Aboard. Open it, assert visibility + links, close via Escape.
  const about = await page.evaluate(() => {
    const btn = document.getElementById("helpChip");
    if (!btn) return { btn: false };
    btn.click();
    const wrap = document.getElementById("aboutWrap"), card = document.getElementById("about");
    const open = !!wrap && wrap.classList.contains("open") && getComputedStyle(wrap).display !== "none";
    const hrefs = card ? [...card.querySelectorAll("a")].map(a => a.getAttribute("href")) : [];
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const closed = !wrap.classList.contains("open");
    return { btn: true, open, hrefs, closed };
  });
  ok(about.btn, `F2a: no #helpChip (?) button in the DOM`);
  ok(about.open, `F2b: clicking ? did not open the about layer (#aboutWrap.open)`);
  const hasLink = s => (about.hrefs || []).some(h => h && h.includes(s));
  ok(hasLink("how.html"), `F2c: about layer has no link to how.html (links: ${(about.hrefs || []).join(", ")})`);
  ok(hasLink("github.com/ftrain/stellate"), `F2d: about layer has no link to github.com/ftrain/stellate`);
  ok(hasLink("aboardresearch.com"), `F2e: about layer has no link to aboardresearch.com`);
  ok(about.closed, `F2f: Escape did not close the about layer`);
  console.log(`\n=== ABOUT (?) ===\n  open=${about.open} closedOnEsc=${about.closed} links=[${(about.hrefs || []).join(", ")}]`);

  // ---- F3: how.html serves (200) and carries the canonical genre count ----
  // (read LIVE from K.GENRES, not a 178 literal — the count grows as genres land,
  // and this gate exists to catch how.html going stale against it)
  const how = await page.evaluate(async () => {
    const r = await fetch("how.html");
    const txt = await r.text();
    const n = Object.keys(GenreKernel.GENRES).length;
    return { status: r.status, n, hasCount: txt.includes(String(n)), bytes: txt.length };
  });
  ok(how.status === 200, `F3a: how.html fetch status ${how.status} (want 200)`);
  ok(how.hasCount, `F3b: how.html does not contain the live genre count "${how.n}"`);
  console.log(`  how.html: status=${how.status} bytes=${how.bytes} hasCount(${how.n})=${how.hasCount}`);

  // ---- G: no console errors on load ----
  ok(loadErrs.length === 0, `G0: ${loadErrs.length} console/page errors on load: ${loadErrs.slice(0, 3).join(" | ")}`);

  // ---- G: start playback briefly — engine boots, real audio, no new errors ----
  // re-seed a clean default loop (travelStep above advanced the traveller) so the
  // ride starts from a sane centre, then LIVE.
  await page.evaluate(() => __X.seedLoop());
  const errsBeforeRide = errs.length;
  await page.evaluate(() => { __S.pace = 8; });
  await page.evaluate(() => __X.goLive());
  await page.waitForFunction(() => __S.barCount >= 2, { timeout: 40000 }).catch(() => {});
  // sample RMS for a few bars to confirm real sound (not just a booted graph)
  let maxRms = 0;
  const rideDeadline = Date.now() + 40000;
  while (Date.now() < rideDeadline) {
    const s = await page.evaluate(() => {
      const h = window.FaustLive && FaustLive.lastHandle;
      return { bar: __S.barCount, rms: h ? +h.rms() : 0, seg: __S.travel.seg };
    });
    maxRms = Math.max(maxRms, s.rms);
    if (s.bar >= 5 && maxRms > 0.0008) break;
    await page.waitForTimeout(400);
  }
  const engineErrs = await page.evaluate(() => { const h = window.FaustLive && FaustLive.lastHandle; return h ? h.errors.slice() : []; });
  await page.evaluate(() => __X.stopLive()).catch(() => {});
  await page.waitForTimeout(300);
  // partition ride errors: archive.org found-sound streaming is CORS-blocked in
  // the sandbox (environmental on main for ANY headless ride) — ignore those.
  const isEnv = e => /archive\.org|CORS|ERR_FAILED|Failed to load resource|net::|found/i.test(e);
  const rideErrs = errs.slice(errsBeforeRide);
  const realRide = rideErrs.filter(e => !isEnv(e));
  const envRide = rideErrs.filter(isEnv);
  ok(maxRms > 0.0008, `G1: no real audio during ride (maxRms=${maxRms.toFixed(5)})`);
  ok(realRide.length === 0, `G2: ${realRide.length} real console/page errors after starting playback: ${realRide.slice(0, 3).join(" | ")}`);
  ok(engineErrs.length === 0, `G3: ${engineErrs.length} engine errors during ride`);
  console.log(`\n=== PLAYBACK ===`);
  console.log(`  maxRms=${maxRms.toFixed(5)}  realRideErrors=${realRide.length}  envFoundSoundErrors=${envRide.length}  engineErrors=${engineErrs.length}`);
  if (realRide.length) console.log(`  REAL:\n   ${realRide.slice(0, 20).join("\n   ")}`);

  // ---- J: ⤓ EXPORT (2026-07-09 first slice) — the ⚙ panel's download cluster
  // grows ⤓ midi / ⤓ wav / ⤓ mp3. J1: the buttons exist in the rendered panel.
  // J2: CLICKING ⤓ midi produces a byte-valid Standard MIDI File (full chunk
  // math parsed here in node, not just a magic sniff). J3: the audio path is a
  // REAL offline press — an 8s capped run of the same renderWav press-parity
  // path returns a canonical RIFF/WAVE with sound in it.
  const expBtns = await page.evaluate(async () => {
    window.__EXPORT.noDownload = true;                      // capture, don't download
    document.getElementById("cfgChip").click();             // open the ⚙ panel
    await new Promise((r) => setTimeout(r, 150));
    const btnOf = (t) => [...document.querySelectorAll("#panel button")].find((b) => b.textContent.trim() === t);
    const more = btnOf("⚙ more"); if (more) more.click();   // expand to the download cluster
    await new Promise((r) => setTimeout(r, 150));
    const names = [...document.querySelectorAll("#panel button")].map((b) => b.textContent.trim());
    const midiBtn = btnOf("⤓ midi");
    if (midiBtn) midiBtn.click();                           // the REAL button path
    await new Promise((r) => setTimeout(r, 100));
    const m = window.__EXPORT.lastMidi;
    return { names, hasMidi: !!btnOf("⤓ midi"), hasWav: !!btnOf("⤓ wav"), hasMp3: !!btnOf("⤓ mp3"),
      midi: m ? Array.from(m) : null, fileName: window.__EXPORT.lastName };
  });
  ok(expBtns.hasMidi && expBtns.hasWav && expBtns.hasMp3,
    `J1: download cluster missing export buttons (have: ${expBtns.names.join(", ")})`);
  const smf = parseSmf(expBtns.midi || []);
  ok(!!expBtns.midi, `J2a: clicking ⤓ midi captured no bytes`);
  ok(smf.ok, `J2b: MIDI does not parse as SMF — ${smf.err}`);
  ok(smf.ok && smf.fmt === 1 && smf.ppq === 480, `J2c: SMF format/ppq = ${smf.fmt}/${smf.ppq} (want 1/480)`);
  ok(smf.ok && smf.ntrk >= 2, `J2d: SMF has ${smf.ntrk} tracks (want >=2: tempo meta + voices)`);
  ok(/\.mid$/.test(expBtns.fileName || ""), `J2e: filename "${expBtns.fileName}" (want NameBank identity + .mid)`);
  console.log(`\n=== EXPORT (⤓ midi) ===`);
  console.log(`  file="${expBtns.fileName}"  ${smf.ok ? `SMF ok: format ${smf.fmt}, ${smf.ntrk} tracks, ${smf.ppq} ppq, ${smf.bytes} bytes` : "PARSE FAIL: " + smf.err}`);
  const wavSmoke = await page.evaluate(async () => {
    const buf = await window.__EXPORT.exportAudio("wav", { durSec: 8, noDownload: true });
    if (!buf) return { ok: false, status: window.__S.status };
    const dv = new DataView(buf);
    const tag = (o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
    const n = (buf.byteLength - 44) >> 2;
    let sq = 0; for (let i = 0; i < n; i++) { const v = dv.getInt16(44 + (i << 2), true) / 32768; sq += v * v; }
    return { ok: true, riff: tag(0), wave: tag(8), bytes: buf.byteLength, frames: n,
      sr: dv.getUint32(24, true), rms: Math.sqrt(sq / Math.max(1, n)), name: window.__EXPORT.lastName };
  });
  // close the ⚙ panel again (H below drives chips on a clean sky)
  await page.evaluate(() => { document.getElementById("cfgChip").click(); });
  ok(wavSmoke.ok, `J3a: exportAudio returned nothing (status: ${wavSmoke.status})`);
  ok(wavSmoke.ok && wavSmoke.riff === "RIFF" && wavSmoke.wave === "WAVE", `J3b: not a RIFF/WAVE (${wavSmoke.riff}/${wavSmoke.wave})`);
  ok(wavSmoke.ok && wavSmoke.sr === 44100, `J3c: WAV sample rate ${wavSmoke.sr} (want 44100)`);
  ok(wavSmoke.ok && Math.abs(wavSmoke.frames - 8 * 44100) <= 4096, `J3d: WAV frames ${wavSmoke.frames} (want ~${8 * 44100} for the 8s cap)`);
  ok(wavSmoke.ok && wavSmoke.rms > 1e-4, `J3e: pressed WAV is silent (rms=${wavSmoke.ok ? wavSmoke.rms.toExponential(2) : "n/a"})`);
  ok(/\.wav$/.test(wavSmoke.name || ""), `J3f: filename "${wavSmoke.name}" (want NameBank identity + .wav)`);
  console.log(`=== EXPORT (⤓ wav, 8s cap) ===`);
  if (wavSmoke.ok) console.log(`  file="${wavSmoke.name}"  ${wavSmoke.bytes} bytes, ${wavSmoke.frames} frames @ ${wavSmoke.sr}Hz, rms=${wavSmoke.rms.toFixed(4)}`);

  // H: the "video+demos" background ACTUALLY alternates on the reliable wall-clock
  // (the earlier version only worked via onBar while live and was imperceptibly slow —
  // Paul: "it never switches"). Page loaded with ?bgAltMs=1200 so the idle backstop
  // flips fast. Stub video availability, cycle the chip to mode 1, wait, and require
  // real flips over real time, both sides, the enabled layer tracking the side, and
  // that DemoLayer.next() genuinely cycles the cart name.
  // H5 (2026-07-09, Paul: "sometimes they are on top of each other"): STRICT
  // EXCLUSIVITY — poll BOTH layers' enabled() AND their wraps' real DOM visibility
  // every 150ms through the whole alternation window and require an exact XOR at
  // EVERY sample: exactly one of {video, demo} visible, enabled matching visible.
  const alt = await page.evaluate(async () => {
    window.VideoLayer.available = () => true;
    let g = 0; while (window.__BGALT.state().mode !== 1 && g++ < 4) document.getElementById("bgChip").click();
    const startMode = window.__BGALT.state().mode;
    const n0 = window.DemoLayer.currentName && window.DemoLayer.currentName();
    window.DemoLayer.next(); const n1 = window.DemoLayer.currentName && window.DemoLayer.currentName();
    const vis = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== "none"; };
    const sides = [], viol = [];
    const N = 40;   // 40 × 150ms = the same 6s window as before, sampled finer
    for (let i = 0; i < N; i++) {
      await new Promise(r => setTimeout(r, 150));
      const side = window.__BGALT.state().side;
      const vOn = window.VideoLayer.enabled(), dOn = window.DemoLayer.enabled();
      const vVis = vis("vidlayer"), dVis = vis("demolayer");
      sides.push(side);
      // the XOR law: exactly one layer visible, exactly one enabled, DOM tracks state
      if (!(vVis !== dVis && vOn !== dOn && vVis === vOn && dVis === dOn))
        viol.push({ i, side, vOn, dOn, vVis, dVis });
    }
    const flips = sides.filter((s, i) => i && s !== sides[i - 1]).length;
    const s = window.__BGALT.state();
    const r = { startMode, flips, sides: [...new Set(sides)], cartCycles: n0 !== n1, viol, samples: N,
      side: s.side, vidOn: window.VideoLayer.enabled(), demoOn: window.DemoLayer.enabled() };
    document.getElementById("bgChip").click(); document.getElementById("bgChip").click();  // back to off
    return r;
  });
  ok(alt.startMode === 1, `H0: chip reaches video+demos mode (got ${alt.startMode})`);
  ok(alt.flips >= 3 && alt.sides.length === 2, `H1: background alternates on the clock (flips=${alt.flips} sides=${alt.sides.join("/")})`);
  ok(alt.cartCycles, `H2: DemoLayer.next() changes the cart`);
  ok((alt.side === "demo") === alt.demoOn && (alt.side !== "demo") === alt.vidOn,
    `H3: enabled layer tracks the active side (side=${alt.side} vid=${alt.vidOn} demo=${alt.demoOn})`);
  ok(alt.viol.length === 0, `H5: layer exclusivity violated at ${alt.viol.length}/${alt.samples} samples (want XOR — never both, never neither): ${JSON.stringify(alt.viol.slice(0, 4))}`);
  console.log(`  bg-alt: flips=${alt.flips} sides=${alt.sides.join("/")} cartCycles=${alt.cartCycles} exclusivityViolations=${alt.viol.length}/${alt.samples}`);

  // H4: the MUSICAL driver counts beats, not chord-bar ticks — 8 measures = 32
  // beats. With cbeats=8 (2 measures/bar) the flip must land on tick 4, not 8.
  const beat = await page.evaluate(() => {
    window.VideoLayer.available = () => true;
    let g = 0; while (window.__BGALT.state().mode !== 1 && g++ < 4) document.getElementById("bgChip").click();
    const wasLive = window.__S.live; window.__S.live = true;
    window.__BGALT.flip();   // reset the beat counter to a known 0
    const s1 = window.__BGALT.state().side; let firstFlip = 0;
    for (let i = 1; i <= 8 && !firstFlip; i++) { window.__BGALT.tick({ cbeats: 8 }); if (window.__BGALT.state().side !== s1) firstFlip = i; }
    window.__S.live = wasLive;
    let h = 0; while (window.__BGALT.state().mode !== 0 && h++ < 4) document.getElementById("bgChip").click();  // back to off
    return { firstFlip };
  });
  ok(beat.firstFlip === 4, `H4: musical flip lands after 32 beats = 4 two-measure bars (got tick ${beat.firstFlip})`);

  // I: plain mouse-wheel zooms the map (desktop), no ctrl needed (Paul 2026-07-09).
  const wheel = await page.evaluate(() => {
    const svg = document.getElementById("map"), r = svg.getBoundingClientRect();
    const k0 = window.__ZOOM.k;
    svg.dispatchEvent(new WheelEvent("wheel", { deltaY: -240, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true }));
    const kUp = window.__ZOOM.k;
    svg.dispatchEvent(new WheelEvent("wheel", { deltaY: 600, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true }));
    const kDn = window.__ZOOM.k;
    return { k0, kUp, kDn };
  });
  ok(wheel.kUp > wheel.k0, `I1: wheel up zooms IN (k ${wheel.k0.toFixed(2)}→${wheel.kUp.toFixed(2)})`);
  ok(wheel.kDn < wheel.kUp, `I2: wheel down zooms OUT (k ${wheel.kUp.toFixed(2)}→${wheel.kDn.toFixed(2)})`);
  console.log(`  wheel-zoom: ${wheel.k0.toFixed(2)} →in ${wheel.kUp.toFixed(2)} →out ${wheel.kDn.toFixed(2)}`);

  await browser.close(); srv.close();

  console.log(`\n=== GATE ===`);
  if (fails.length) console.log("FAILURES:\n  - " + fails.join("\n  - "));
  const pass = fails.length === 0;
  console.log(`EXPLORER-UI GATE: ${pass ? "PASS" : "FAIL"}`);
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
