#!/usr/bin/env node
// faust/ring-test-run.js — HEADLESS GATE for the ring player.
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node faust/ring-test-run.js [--soak 65]
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node faust/ring-test-run.js --phase4 [--soak 135]
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node faust/ring-test-run.js --all
//
// PHASE 3 (default): loads faust/ring-test.html, starts ONE continuous stream
// through the SharedArrayBuffer ring + ring-player worklet, plays it for ≥60 s, and
// asserts the click-free-by-construction playback primitive:
//   (a) ZERO underruns at steady state;
//   (b) the read cursor advances monotonically at ~SR samples/sec (no stall/runaway);
//   (c) GAPLESS / CLICK-FREE output — offline seam analysis over the captured PCM
//       shows NO discontinuity at any chunk boundary, no exact-zero dropout runs.
//
// PHASE 4 (--phase4): loads faust/ring-test.html?phase4=1, which drives a SCRIPTED
// sequence of state changes (incl. a rapid BURST) with the two-producer crossfade,
// and asserts over the whole run: (a) ZERO underruns; (b) the read cursor stays
// monotonic across every crossfade/swap; (c) at each crossfade the captured PCM
// shows no level collapse (equal-power → RMS stays between the two steady levels),
// no |Δ| discontinuity beyond program slope, no dropout; (d) after each change only
// the new stream is audible (the retired ring's read cursor is frozen during steady
// playback); (e) the rapid-change burst coalesces to its final target without
// underrun or a stuck state.
//
// DEVIATION FROM THE BRIEF: probe-harness.js `serve` sends only ACAO, NOT the
// COOP/COEP headers SharedArrayBuffer needs (verified in the file). Rather than
// edit that shared helper, this gate stands up its own cross-origin-ISOLATED
// server here (COOP:same-origin + COEP:require-corp + CORP:same-origin) and still
// borrows launchChromium/capturePageErrors from probe-harness.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { launchChromium, capturePageErrors, MIME } = require("./probe-harness.js");
const WAV = require("./wav.js");

const ROOT = path.join(__dirname, "..");
const PORT = 8811;
const SR = 44100;
const args = process.argv.slice(2);
const soakIx = args.indexOf("--soak");
const WANT_P4 = args.includes("--phase4");
const WANT_GLIDE = args.includes("--glide");
const WANT_ALL = args.includes("--all");
const SOAK = soakIx >= 0 ? parseFloat(args[soakIx + 1]) : (WANT_P4 && !WANT_ALL ? 135 : 65);

// cross-origin-ISOLATED static server (the only difference from probe-harness.serve)
function coiServe(root, port) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      if (req.url === "/favicon.ico") { rsp.writeHead(204); return rsp.end(); }
      const p = path.normalize(path.join(root, decodeURIComponent(req.url.split("?")[0])));
      if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, {
        "Content-Type": MIME[path.extname(p)] || "application/octet-stream",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(port, () => res(srv));
  });
}

// ═══════════════════════════════════════════════════════════ PHASE-3 GATE
async function runPhase3(browser, srv) {
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  const fails = [];

  await page.goto(`http://localhost:${PORT}/faust/ring-test.html`);

  // SAB requires cross-origin isolation — assert it, then wait for the worker to
  // prime the ring and the reader to start (C_STATE=running).
  const isolated = await page.evaluate(() => window.__ring && window.__ring.isolated());
  if (!isolated) fails.push("crossOriginIsolated=false — SharedArrayBuffer unavailable (COOP/COEP not applied)");
  console.log(`crossOriginIsolated=${isolated}`);

  await page.waitForFunction(() => window.__ring && (window.__ring.started || window.__ring.err), { timeout: 60000 });
  const bootErr = await page.evaluate(() => window.__ring.err);
  if (bootErr) { fails.push("boot error: " + bootErr); }
  const opened = await page.evaluate(() => ({ started: window.__ring.started, bounds: window.__ring.chunkBounds().length,
    filled: window.__ring.filled() }));
  console.log(`started=${opened.started}  chunkBounds=${opened.bounds}  primedFill=${(opened.filled / SR).toFixed(1)}s`);

  // ── steady-state soak: sample the read cursor + underruns + RMS once a second ──
  const samples = [];
  const t0 = Date.now();
  let lastCur = -1;
  while ((Date.now() - t0) / 1000 < SOAK) {
    const s = await page.evaluate(() => ({
      wall: performance.now(),
      cur: window.__ring.readCursor(),
      und: window.__ring.underruns(),
      undFlag: window.__ring.underrunFlag(),
      filled: window.__ring.filled(),
      captured: window.__ring.captured(),
      rms: +window.__ring.rms().toFixed(6),
      eos: window.__ring.eos,
    }));
    if (s.cur < lastCur) fails.push(`cursor went BACKWARDS: ${lastCur} -> ${s.cur}`);
    lastCur = s.cur;
    samples.push(s);
    await page.waitForTimeout(1000);
  }

  // ── cursor-rate + underrun assessment (skip the first 2 warmup polls) ──
  const body = samples.slice(2);
  const totalUnder = samples.length ? samples[samples.length - 1].und : -1;
  if (totalUnder !== 0) fails.push(`underruns=${totalUnder} (must be 0 at steady state)`);
  let minRate = Infinity, maxRate = 0, minAdvance = Infinity;
  for (let i = 1; i < body.length; i++) {
    const dCur = body[i].cur - body[i - 1].cur;
    const dSec = (body[i].wall - body[i - 1].wall) / 1000;
    const rate = dCur / dSec;
    minRate = Math.min(minRate, rate); maxRate = Math.max(maxRate, rate);
    minAdvance = Math.min(minAdvance, dCur);
  }
  const overall = body.length >= 2
    ? (body[body.length - 1].cur - body[0].cur) / ((body[body.length - 1].wall - body[0].wall) / 1000)
    : 0;
  // per-interval bounds are LOOSE (±10%): 1-second CDP polls sample a bursty
  // audio-buffer/render clock, so single-interval jitter is expected. The tight
  // lock/drift proof is the OVERALL rate (±1%) + zero underruns + monotonicity.
  if (minRate < 0.9 * SR) fails.push(`cursor STALL: min interval rate ${minRate.toFixed(0)} < ${(0.9 * SR).toFixed(0)} samp/s`);
  if (maxRate > 1.1 * SR) fails.push(`cursor RUNAWAY: max interval rate ${maxRate.toFixed(0)} > ${(1.1 * SR).toFixed(0)} samp/s`);
  if (overall < 0.99 * SR || overall > 1.01 * SR) fails.push(`overall cursor rate ${overall.toFixed(0)} not ≈ ${SR} samp/s (drift)`);
  console.log(`\nCURSOR: overall ${overall.toFixed(0)} samp/s (target ${SR}); interval rate min/max ${minRate.toFixed(0)}/${maxRate.toFixed(0)}; minAdvance/poll ${minAdvance}`);

  // ── RMS continuity (skip 2 warmup polls) ──
  const rmsBody = body.map((s) => s.rms);
  const rmsMin = rmsBody.length ? Math.min(...rmsBody) : -1;
  let quietRun = 0, maxQuiet = 0;
  for (const r of rmsBody) { if (r < 1e-4) { maxQuiet = Math.max(maxQuiet, ++quietRun); } else quietRun = 0; }
  if (maxQuiet > 0) fails.push(`RMS collapsed to ~0 for ${maxQuiet} consecutive polls (min=${rmsMin})`);
  console.log(`RMS: min ${rmsMin} over ${rmsBody.length} polls (no collapse => ${maxQuiet === 0})`);

  // ── offline seam / discontinuity analysis over the captured PCM ──
  const A = await page.evaluate(() => window.__ring.analyze());
  const seamMaxRatio = A.seams.length ? Math.max(...A.seams.map((s) => s.ratio)) : 0;
  const seamMaxDelta = A.seams.length ? Math.max(...A.seams.map((s) => s.delta)) : 0;
  console.log(`\nSEAMS: analysed ${A.seams.length} chunk boundaries in ${(A.cap / SR).toFixed(1)}s of captured PCM`);
  console.log(`  global max |Δ| = ${A.maxDelta.toExponential(3)} @${A.maxAt} (samples from nearest seam: ${A.maxAtNearSeam})`);
  console.log(`  seam |Δ| max = ${seamMaxDelta.toExponential(3)}; seam ratio (Δ / local-slope-max) max = ${seamMaxRatio.toFixed(3)}`);
  console.log(`  max exact-zero run (after 1s) = ${A.maxZeroRun} samples${A.maxZeroRunAt >= 0 ? " @" + A.maxZeroRunAt : ""}; capture→stream offset = ${A.off}`);
  for (const s of A.seams) console.log(`    seam stream@${s.streamPos} (${(s.streamPos / SR).toFixed(1)}s): Δ=${s.delta.toExponential(2)} localMax=${s.localMax.toExponential(2)} ratio=${s.ratio.toFixed(2)}`);
  if (A.seams.length < 3) fails.push(`only ${A.seams.length} chunk seams captured (want ≥3 to prove reassembly)`);
  if (seamMaxRatio >= 6) fails.push(`seam discontinuity: a chunk boundary has Δ ${seamMaxRatio.toFixed(1)}× the local slope (click at seam)`);
  if (A.maxAtNearSeam <= 4) fails.push(`the LARGEST sample jump sits at a chunk seam (@${A.maxAt}) — reassembly click`);
  if (A.maxZeroRun >= 128) fails.push(`dropout: exact-zero run of ${A.maxZeroRun} samples in loud program`);

  // ── artifact: dump the first 6 s of captured PCM (spans a chunk seam) as a WAV ──
  const snip = await page.evaluate(() => window.__ring.snippet(0, 6 * 44100));
  const n = snip.length / 2, data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) { data.writeInt16LE(WAV.toInt16(snip[i * 2], "trunc"), i * 4); data.writeInt16LE(WAV.toInt16(snip[i * 2 + 1], "trunc"), i * 4 + 2); }
  const scratch = path.join(ROOT, "scratch"); try { fs.mkdirSync(scratch); } catch (e) {}
  const wavPath = path.join(scratch, "ring-test-snippet.wav");
  fs.writeFileSync(wavPath, Buffer.concat([WAV.header(SR, 2, data.length), data]));
  console.log(`\nartifact: ${wavPath} (first 6s, crosses a chunk seam)`);

  const pageErrs = errs.filter((e) => !/favicon/i.test(e));
  if (pageErrs.length) fails.push(`${pageErrs.length} page/console errors: ${pageErrs.slice(0, 3).join(" | ")}`);

  await page.close();
  console.log(`\n=== PHASE-3 GATE ===`);
  if (fails.length) console.log("FAILURES:\n  - " + fails.join("\n  - "));
  console.log(`RING-PLAYER PHASE-3 GATE: ${fails.length === 0 ? "PASS" : "FAIL"}`);
  return fails.length === 0;
}

// ═══════════════════════════════════════════════════════════ PHASE-4 GATE
async function runPhase4(browser, srv) {
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  const fails = [];

  await page.goto(`http://localhost:${PORT}/faust/ring-test.html?phase4=1`);

  const isolated = await page.evaluate(() => window.__ring && window.__ring.isolated());
  if (!isolated) fails.push("crossOriginIsolated=false — SharedArrayBuffer unavailable");
  console.log(`crossOriginIsolated=${isolated}`);

  await page.waitForFunction(() => window.__ring && (window.__ring.started || window.__ring.err), { timeout: 90000 });
  const bootErr = await page.evaluate(() => window.__ring.err);
  if (bootErr) fails.push("boot error: " + bootErr);
  console.log(`started; running scripted sequence, soak ${SOAK}s`);

  // ── soak: sample cursor + underruns + phase + per-ring reads once a second ──
  // (d) is proven here: when playback is IDLE (no fade) with the SAME active ring
  //     across two polls, the OTHER (retired) ring's read cursor must NOT advance.
  const samples = [];
  const t0 = Date.now();
  let lastCur = -1, retiredAdvances = 0;
  while ((Date.now() - t0) / 1000 < SOAK) {
    const s = await page.evaluate(() => ({
      wall: performance.now(),
      cur: window.__ring.readCursor(),
      und: window.__ring.underruns(),
      undFlag: window.__ring.underrunFlag(),
      phase: window.__ring.condPhase(),
      active: window.__ring.activeRing(),
      r0: window.__ring.ringRead(0), r1: window.__ring.ringRead(1),
      xf: window.__ring.xfade(),
      nCross: window.__ring.crossfades().length,
      rms: +window.__ring.rms().toFixed(6),
      seqDone: window.__ring.seqDone,
      playingSig: window.__ring.playingSig(),
    }));
    if (s.cur < lastCur) fails.push(`cursor went BACKWARDS: ${lastCur} -> ${s.cur}`);
    lastCur = s.cur;
    // (d) retired-ring frozen check between two steady (idle, same-active) polls
    const p = samples[samples.length - 1];
    if (p && p.phase === "idle" && s.phase === "idle" && p.active === s.active) {
      const retired = s.active ^ 1;
      const prevR = retired === 0 ? p.r0 : p.r1, curR = retired === 0 ? s.r0 : s.r1;
      if (curR > prevR) { retiredAdvances++; fails.push(`retired ring${retired} read advanced during steady playback: ${prevR} -> ${curR} ((d) old stream still audible)`); }
    }
    samples.push(s);
    await page.waitForTimeout(1000);
  }

  const last = samples[samples.length - 1] || {};
  const body = samples.slice(2);

  // (a) underruns
  const totalUnder = last.und != null ? last.und : -1;
  if (totalUnder !== 0) fails.push(`underruns=${totalUnder} (must be 0)`);

  // (b) cursor monotonic + rate (checked above for backwards; verify overall rate)
  const overall = body.length >= 2
    ? (body[body.length - 1].cur - body[0].cur) / ((body[body.length - 1].wall - body[0].wall) / 1000)
    : 0;
  if (overall < 0.99 * SR || overall > 1.01 * SR) fails.push(`overall cursor rate ${overall.toFixed(0)} not ≈ ${SR} (drift/stall across the run)`);
  console.log(`\nCURSOR: overall ${overall.toFixed(0)} samp/s (target ${SR}); monotonic across ${samples.length} polls (backwards=${samples.length && fails.some(f => /BACKWARDS/.test(f)) ? "YES" : "no"})`);

  // (e) burst coalesced to its final target, no stuck state, ended playing
  const seqDone = await page.evaluate(() => window.__ring.seqDone);
  const endInfo = await page.evaluate(() => ({ phase: window.__ring.condPhase(), playingSig: window.__ring.playingSig(),
    v1: window.__ring.variantSig(1), nCross: window.__ring.crossfades().length }));
  if (!seqDone) fails.push("scripted sequence did not finish dispatching");
  if (endInfo.phase !== "idle") fails.push(`conductor stuck in phase "${endInfo.phase}" (expected idle after soak)`);
  if (endInfo.playingSig !== endInfo.v1) fails.push(`final playing state != burst's last target (variant 1) — burst did not coalesce correctly`);
  console.log(`BURST/COALESCE: seqDone=${seqDone} finalPhase=${endInfo.phase} finalTarget==variant1=${endInfo.playingSig === endInfo.v1} totalCrossfades=${endInfo.nCross}`);
  console.log(`RETIRED-RING (d): ${retiredAdvances === 0 ? "old ring frozen during steady playback (only new stream audible)" : retiredAdvances + " violations"}`);

  // (c) per-crossfade PCM analysis (equal-power: no dip, no click, no dropout)
  const metrics = await page.evaluate(() => window.__ring.crossfadeMetrics(0.25));
  if (metrics.length < 3) fails.push(`only ${metrics.length} crossfades analysed (want ≥3)`);
  console.log(`\nCROSSFADES: ${metrics.length} committed`);
  console.log(`  idx  dur(ms)  preRMS   postRMS  thru[min..max]      floor    ceil    Δratio  zeroRun  curAdv`);
  for (const m of metrics) {
    if (m.skipped) { console.log(`  #${m.index}  (region outside capture window — skipped)`); continue; }
    const dipOK = m.through_min >= m.floor, spikeOK = m.through_max <= m.ceil, stepOK = m.deltaRatio < 6, dropOK = m.maxZeroRun < 128, curOK = m.cursorAdvance > 0;
    console.log(`  #${String(m.index).padEnd(3)} ${(m.durFrames / SR * 1000).toFixed(0).padStart(6)}  ${m.pre.toFixed(5)}  ${m.post.toFixed(5)}  [${m.through_min.toFixed(5)}..${m.through_max.toFixed(5)}]  ${m.floor.toFixed(5)}  ${m.ceil.toFixed(5)}  ${m.deltaRatio.toFixed(2).padStart(5)}  ${String(m.maxZeroRun).padStart(6)}  ${String(m.cursorAdvance).padStart(6)}  ${dipOK && spikeOK && stepOK && dropOK && curOK ? "OK" : "**FAIL**"}`);
    if (!dipOK) fails.push(`crossfade #${m.index}: RMS collapsed through fade (min ${m.through_min.toFixed(5)} < 0.5×min-surround ${m.floor.toFixed(5)}) — level dip`);
    if (!spikeOK) fails.push(`crossfade #${m.index}: RMS spiked through fade (max ${m.through_max.toFixed(5)} > 1.5×max-surround ${m.ceil.toFixed(5)})`);
    if (!stepOK) fails.push(`crossfade #${m.index}: |Δ| discontinuity ${m.deltaRatio.toFixed(1)}× local program slope — click`);
    if (!dropOK) fails.push(`crossfade #${m.index}: dropout — exact-zero run ${m.maxZeroRun} samples`);
    if (!curOK) fails.push(`crossfade #${m.index}: cursor did not advance across the swap`);
  }

  // ── artifact: dump the region around the first crossfade as a WAV ──
  if (metrics.length && !metrics[0].skipped) {
    const m0 = metrics[0], M = Math.floor(0.4 * SR);
    const snip = await page.evaluate((r) => window.__ring.snippet(r.a, r.b), { a: Math.max(0, m0.capStart - M), b: m0.capEnd + M });
    const n = snip.length / 2, data = Buffer.alloc(n * 4);
    for (let i = 0; i < n; i++) { data.writeInt16LE(WAV.toInt16(snip[i * 2], "trunc"), i * 4); data.writeInt16LE(WAV.toInt16(snip[i * 2 + 1], "trunc"), i * 4 + 2); }
    const scratch = path.join(ROOT, "scratch"); try { fs.mkdirSync(scratch); } catch (e) {}
    const wavPath = path.join(scratch, "ring-crossfade-snippet.wav");
    fs.writeFileSync(wavPath, Buffer.concat([WAV.header(SR, 2, data.length), data]));
    console.log(`\nartifact: ${wavPath} (region around crossfade #0)`);
  }

  const pageErrs = errs.filter((e) => !/favicon/i.test(e));
  if (pageErrs.length) fails.push(`${pageErrs.length} page/console errors: ${pageErrs.slice(0, 3).join(" | ")}`);

  await page.close();
  console.log(`\n=== PHASE-4 GATE ===`);
  if (fails.length) console.log("FAILURES:\n  - " + fails.join("\n  - "));
  console.log(`RING-PLAYER PHASE-4 GATE: ${fails.length === 0 ? "PASS" : "FAIL"}`);
  return fails.length === 0;
}

// ═══════════════════════════════════════════════════════════ PHASE-5a GLIDE GATE
async function runGlide(browser, srv) {
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  const fails = [];

  await page.goto(`http://localhost:${PORT}/faust/ring-test.html?glide=1`);

  const isolated = await page.evaluate(() => window.__ring && window.__ring.isolated());
  if (!isolated) fails.push("crossOriginIsolated=false — SharedArrayBuffer unavailable");
  console.log(`crossOriginIsolated=${isolated}`);

  await page.waitForFunction(() => window.__ring && (window.__ring.started || window.__ring.err), { timeout: 90000 });
  const bootErr = await page.evaluate(() => window.__ring.err);
  if (bootErr) fails.push("boot error: " + bootErr);
  const gi = await page.evaluate(() => window.__ring.glideInfo());
  console.log(`started; live glide: ${gi.nBars} bars of ${gi.barLen} samp (${(gi.barLen / SR).toFixed(3)}s), cutoff ${gi.c0}→${gi.c1} Hz; soak ${SOAK}s`);

  // ── soak: sample cursor + underruns + RMS once a second ──
  const samples = [];
  const t0 = Date.now();
  let lastCur = -1;
  while ((Date.now() - t0) / 1000 < SOAK) {
    const s = await page.evaluate(() => ({
      wall: performance.now(),
      cur: window.__ring.readCursor(),
      und: window.__ring.underruns(),
      filled: window.__ring.filled(),
      captured: window.__ring.captured(),
      rms: +window.__ring.rms().toFixed(6),
    }));
    if (s.cur < lastCur) fails.push(`cursor went BACKWARDS: ${lastCur} -> ${s.cur}`);
    lastCur = s.cur;
    samples.push(s);
    await page.waitForTimeout(1000);
  }

  const body = samples.slice(2);
  // (a) ZERO underruns
  const totalUnder = samples.length ? samples[samples.length - 1].und : -1;
  if (totalUnder !== 0) fails.push(`underruns=${totalUnder} (must be 0)`);
  // (b) cursor monotonic ~SR
  let minRate = Infinity, maxRate = 0;
  for (let i = 1; i < body.length; i++) {
    const rate = (body[i].cur - body[i - 1].cur) / ((body[i].wall - body[i - 1].wall) / 1000);
    minRate = Math.min(minRate, rate); maxRate = Math.max(maxRate, rate);
  }
  const overall = body.length >= 2
    ? (body[body.length - 1].cur - body[0].cur) / ((body[body.length - 1].wall - body[0].wall) / 1000) : 0;
  if (overall < 0.99 * SR || overall > 1.01 * SR) fails.push(`overall cursor rate ${overall.toFixed(0)} not ≈ ${SR} (drift/stall)`);
  console.log(`\nCURSOR: overall ${overall.toFixed(0)} samp/s (target ${SR}); interval min/max ${minRate.toFixed(0)}/${maxRate.toFixed(0)}; underruns ${totalUnder}`);

  // ── (c/d/e) offline analysis over the captured PCM ──
  const A = await page.evaluate(() => window.__ring.glideAnalyze());
  console.log(`\nGLIDE ANALYSIS over ${(A.cap / SR).toFixed(1)}s capture (${A.nBoundaries} bar boundaries after the 3s head-skip):`);
  console.log(`  (d) SEAM   max |Δ| / local-slope ratio = ${A.maxSeamRatio.toFixed(3)}  (click if ≥6); min boundary RMS = ${A.minBoundRms.toExponential(2)}`);
  console.log(`  (c) NO RE-ATTACK  bar-phase-folded RMS profile (${A.NPH} bins): band min/mean = ${A.profBandRatio.toFixed(3)}, peak-peak/mean = ${A.profPkPk.toFixed(3)}, seam-band = ${A.seamBand.toFixed(3)}, argMin @phase ${A.argMinPhase}/${A.NPH}  (a re-attack ⇒ deep dip at phase 0)`);
  console.log(`  (e) GLIDE  brightness(diff-energy/energy) early ${A.earlyBright.toExponential(3)} → late ${A.lateBright.toExponential(3)}  (×${(A.lateBright / (A.earlyBright || 1e-12)).toFixed(2)}); overall RMS ${A.allRms.toFixed(5)}`);

  if (A.nBoundaries < 10) fails.push(`only ${A.nBoundaries} bar boundaries analysed (want ≥10 to prove per-bar continuity)`);
  if (A.maxSeamRatio >= 6) fails.push(`(d) bar-boundary Δ ${A.maxSeamRatio.toFixed(1)}× the local slope — seam click`);
  // (c) the folded profile must stay in a tight band (no bar-periodic dip-then-swell)
  // AND the seam bins must not be depressed (a re-attack parks the minimum at phase 0).
  if (A.profBandRatio < 0.85) fails.push(`(c) RE-ATTACK: folded RMS band min/mean ${A.profBandRatio.toFixed(2)} < 0.85 — a bar-periodic dip (the pad must NOT re-trigger each bar)`);
  if (A.seamBand < 0.9) fails.push(`(c) RE-ATTACK: seam-phase RMS ${A.seamBand.toFixed(2)}× the bar mean (< 0.9) — RMS dips at the bar boundary`);
  if (A.minBoundRms < 1e-3) fails.push(`(c) pad went silent (${A.minBoundRms.toExponential(2)}) at a bar boundary — re-attack/dropout`);
  if (!(A.allRms > 1e-3)) fails.push(`(e) output is static/silent (allRms ${A.allRms.toExponential(2)})`);
  if (!(A.lateBright > A.earlyBright * 1.3)) fails.push(`(e) glide did NOT take effect: brightness late ${A.lateBright.toExponential(2)} not > 1.3× early ${A.earlyBright.toExponential(2)}`);

  // ── artifact: dump a mid-run 6 s slice (spans several bar seams) as a WAV ──
  const capNow = await page.evaluate(() => window.__ring.captured());
  const a = Math.min(capNow, Math.floor(SR * 20)), b = Math.min(capNow, a + 6 * SR);
  const snip = await page.evaluate((r) => window.__ring.snippet(r.a, r.b), { a, b });
  const n = snip.length / 2, data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) { data.writeInt16LE(WAV.toInt16(snip[i * 2], "trunc"), i * 4); data.writeInt16LE(WAV.toInt16(snip[i * 2 + 1], "trunc"), i * 4 + 2); }
  const scratch = path.join(ROOT, "scratch"); try { fs.mkdirSync(scratch); } catch (e) {}
  const wavPath = path.join(scratch, "ring-glide-snippet.wav");
  fs.writeFileSync(wavPath, Buffer.concat([WAV.header(SR, 2, data.length), data]));
  console.log(`\nartifact: ${wavPath} (6 s mid-run, spans bar seams)`);

  const pageErrs = errs.filter((e) => !/favicon/i.test(e));
  if (pageErrs.length) fails.push(`${pageErrs.length} page/console errors: ${pageErrs.slice(0, 3).join(" | ")}`);

  await page.close();
  console.log(`\n=== PHASE-5a GLIDE GATE ===`);
  if (fails.length) console.log("FAILURES:\n  - " + fails.join("\n  - "));
  console.log(`RING-PLAYER PHASE-5a GLIDE GATE: ${fails.length === 0 ? "PASS" : "FAIL"}`);
  return fails.length === 0;
}

async function main() {
  const srv = await coiServe(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  let ok = true;
  try {
    if (WANT_ALL) { ok = await runPhase3(browser, srv) && ok; ok = await runPhase4(browser, srv) && ok; ok = await runGlide(browser, srv) && ok; }
    else if (WANT_GLIDE) { ok = await runGlide(browser, srv); }
    else if (WANT_P4) { ok = await runPhase4(browser, srv); }
    else { ok = await runPhase3(browser, srv); }
  } finally {
    await browser.close(); srv.close();
  }
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
