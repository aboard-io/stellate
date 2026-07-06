#!/usr/bin/env node
// faust/soak-run.js — long-run SOAK gate for the FaustLive facade.
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node faust/soak-run.js [genre] [seconds] [mode]
//     mode: "shipped" (media-element output route, default) | "direct" (bypass -> ctx.destination)
//
// Serves the repo root, drives faust/soak.html in headless chromium, goes live
// for N minutes and samples THREE taps over time (bass voice / graph master /
// real element output), plus load ratio + JS heap + tb303 node count. Captures a
// spectrum at ~min 1 and ~min 11 to see any broadband noise-floor rise. Reports
// the degradation onset + curve per tap.
//
// Reproduces Paul's report: "the audio gets very staticky and it builds over
// time, with ANY genre — like a buffering/memory issue."  The three taps + the
// shipped/direct A/B localize the accumulation (mono voice vs fx_bus vs the
// MediaStream output sink, which is invisible to a graph analyser).
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");

const ROOT = path.join(__dirname, "..");
const PORT = +(process.env.SOAK_PORT || 8793);
const GENRE = process.argv[2] || "acidhouse";
const SECS = +(process.argv[3] || 780);
const MODE = (process.argv[4] || "shipped").toLowerCase();
const DIRECT = MODE === "direct" || MODE === "directout";
const FORCE = MODE === "force" || MODE === "forcemediael";   // force the media route on (mobile-branch check on desktop headless)
const SEED = +(process.env.SOAK_SEED || 7);
const CAP1 = 60, CAP2 = Math.min(SECS - 20, 660);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const mean = (arr, path) => { const v = arr.map(path).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };
const fx = (n, d = 1) => (isFinite(n) ? n.toFixed(d) : "n/a");

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const pageErrors = capturePageErrors(page);
  await page.goto(`http://localhost:${PORT}/faust/soak.html`);
  const modeLabel = DIRECT ? "direct(bypass)" : FORCE ? "force(media-el on)" : "shipped(default gating)";
  console.log(`SOAK: ${GENRE} seed ${SEED} mode=${modeLabel} for ${SECS}s (${(SECS / 60).toFixed(1)} min); captures @${CAP1}s+${CAP2}s`);
  await page.evaluate(([g, s, d, f]) => goSoak(g, s, { directOut: d, forceMediaEl: f }), [GENRE, SEED, DIRECT, FORCE]);

  const start = Date.now();
  let c1 = false, c2 = false;
  while ((Date.now() - start) / 1000 < SECS) {
    const el = (Date.now() - start) / 1000;
    if (!c1 && el >= CAP1) { c1 = true; await page.evaluate((l) => captureSpectrum(l), "min1"); }
    if (!c2 && el >= CAP2) { c2 = true; await page.evaluate((l) => captureSpectrum(l), "min11"); }
    await sleep(5000);
  }
  const R = await page.evaluate(() => stopSoak());
  await sleep(600);
  await browser.close();
  srv.close();

  const S = R.samples, errs = [...R.errors, ...pageErrors];
  const isFound = (e) => /archive\.org|CORS|ERR_FAILED|Failed to load resource|found decode/i.test(e);
  const realErrs = errs.filter(e => !isFound(e)), foundErrs = errs.filter(isFound);

  // per-tap analysis: baseline over voiced samples in 20-130s, degradation onset,
  // and the late (last-90s) window for the clean/degraded verdict.
  const TAPS = ["bass", "master", "elem"];
  const has = (tap) => S.some(s => s[tap] && s[tap].nfloorDb != null);
  const baseWin = S.filter(s => s.t >= 20 && s.t <= 130);
  const lateWin = S.filter(s => s.t >= SECS - 90);
  const analysis = {};
  for (const tap of TAPS) {
    if (!has(tap)) { analysis[tap] = null; continue; }
    const bNf = mean(baseWin, s => s[tap] && s[tap].nfloorDb), bHfc = mean(baseWin, s => s[tap] && s[tap].hfc);
    const deg = (s) => s[tap] && s[tap].nfloorDb != null && ((s[tap].nfloorDb - bNf > 6) || (s[tap].hfc > bHfc * 1.5 && s[tap].hfc > 0.05) || s[tap].clicks >= 3);
    let onset = null;
    for (let i = 1; i < S.length - 1; i++) if (deg(S[i]) && deg(S[i + 1])) { onset = S[i].t; break; }
    const lNf = mean(lateWin, s => s[tap] && s[tap].nfloorDb), lHfc = mean(lateWin, s => s[tap] && s[tap].hfc), lClk = mean(lateWin, s => s[tap] && s[tap].clicks);
    analysis[tap] = { bNf, bHfc, onset, lNf, lHfc, lClk };
  }

  const bLoad = mean(baseWin, s => s.load), bHeap = mean(baseWin, s => s.heapMB);
  const lLoad = mean(lateWin, s => s.load), lHeap = mean(lateWin, s => s.heapMB);

  // table
  const cell = (p) => p ? `${fx(p.rms, 3)}/${p.nfloorDb == null ? "  -  " : String(p.nfloorDb).padStart(5)}/${p.hfc == null ? " - " : p.hfc.toFixed(2)}/${p.clicks}` : "    n/a    ";
  console.log("\n  t(s) heapMB load eco n/rc |    BASS rms/nf/hfc/clk    |   MASTER rms/nf/hfc/clk   |    ELEM rms/nf/hfc/clk");
  for (const s of S)
    console.log(`  ${String(s.t).padStart(5)} ${String(s.heapMB).padStart(6)} ${s.load.toFixed(2)} ${s.eco}  ${s.nodeCount}/${s.nodeRecreations} | ${cell(s.bass)} | ${cell(s.master)} | ${cell(s.elem)}`);

  // media-element clock drift: (ctxTime - ctxTime0) - (melTime - melTime0). A
  // growing magnitude = the element playback clock diverging from the audio
  // clock (the media-route static signature). Sampled against wall time too.
  const mel = S.filter(s => s.melTime != null && s.ctxTime != null);
  let driftStr = "no media element (direct mode)";
  if (mel.length >= 2) {
    const a = mel[0], z = mel[mel.length - 1];
    const ctxSpan = z.ctxTime - a.ctxTime, melSpan = z.melTime - a.melTime;
    const drift = ctxSpan - melSpan;
    // per-sample drift trace (every ~60s)
    const trace = mel.filter((s, i) => i % 12 === 0 || i === mel.length - 1)
      .map(s => `${s.t.toFixed(0)}:${((s.ctxTime - a.ctxTime) - (s.melTime - a.melTime)).toFixed(2)}`).join(" ");
    driftStr = `ctxSpan ${ctxSpan.toFixed(1)}s vs melSpan ${melSpan.toFixed(1)}s -> DRIFT ${drift.toFixed(2)}s over ${(z.t - a.t).toFixed(0)}s (${(drift / (z.t - a.t) * 1000).toFixed(1)}ms/s)\n  drift trace: ${trace}`;
  }

  console.log(`\n=== SOAK RESULT: ${GENRE} / ${modeLabel} / ${(SECS / 60).toFixed(1)}min ===`);
  console.log(`load: base ${fx(bLoad, 3)} -> late ${fx(lLoad, 3)}   heap: base ${fx(bHeap, 1)}MB -> late ${fx(lHeap, 1)}MB   bass-node recreations: ${(S[S.length - 1] || {}).nodeRecreations || 0}`);
  console.log(`media-el clock drift: ${driftStr}`);
  for (const tap of TAPS) {
    const a = analysis[tap];
    if (!a) { console.log(`${tap.toUpperCase().padEnd(6)}: no tap`); continue; }
    console.log(`${tap.toUpperCase().padEnd(6)}: noiseFloor ${fx(a.bNf)}dB -> ${fx(a.lNf)}dB (Δ${fx(a.lNf - a.bNf)})  hfc ${fx(a.bHfc, 3)} -> ${fx(a.lHfc, 3)}  lateClicks ${fx(a.lClk, 1)}  ONSET ${a.onset ? a.onset + "s (" + (a.onset / 60).toFixed(1) + "min)" : "none"}`);
  }

  // spectrum min1 vs min11 per tap
  const sp = R.spectra;
  if (sp.min1 && sp.min11) {
    console.log(`\nspectrum HF noise-floor (2.5-12kHz) rise, min1 -> min11:`);
    for (const tap of TAPS) {
      const a = sp.min1[tap], b = sp.min11[tap]; if (!a || !b) continue;
      const bh = sp.min1.sr / (a.bins * 2);
      const band = (spec) => { const lo = Math.max(1, Math.floor(2500 / bh)), hi = Math.min(spec.length - 1, Math.ceil(12000 / bh));
        let s = 0, n = 0; for (let i = lo; i <= hi; i++) { s += Math.pow(10, spec[i] / 10); n++; } return 10 * Math.log10(s / n + 1e-12); };
      console.log(`  ${tap.toUpperCase().padEnd(6)}: ${band(a.spec).toFixed(1)}dB -> ${band(b.spec).toFixed(1)}dB  (Δ${(band(b.spec) - band(a.spec)).toFixed(1)}dB)`);
    }
  }

  console.log(`\nbars: ${R.bars.length}, samples: ${S.length}, real errors: ${realErrs.length}, found-fetch errors: ${foundErrs.length}`);
  if (realErrs.length) console.log("  " + realErrs.slice(0, 10).join("\n  "));

  // overall verdict: any tap degraded?
  const anyOnset = TAPS.some(t => analysis[t] && analysis[t].onset);
  const worstTap = TAPS.filter(t => analysis[t] && analysis[t].onset).sort((a, b) => analysis[a].onset - analysis[b].onset)[0];
  console.log(anyOnset ? `\nDEGRADED — first onset in ${worstTap.toUpperCase()} @ ${analysis[worstTap].onset}s` : `\nCLEAN — no degradation across any tap over ${SECS}s`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
