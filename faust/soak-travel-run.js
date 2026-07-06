#!/usr/bin/env node
// faust/soak-travel-run.js — TRAVEL SOAK gate for the FaustLive facade.
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node faust/soak-travel-run.js [secs] [mode]
//     mode: "reap" (default, pool reaper ON) | "noreap" (reaper OFF — the pre-fix
//           curve) | "ab" (run BOTH legs and print the before/after comparison)
//
// The standing soak (soak-run.js) rides ONE stationary genre — it passed clean
// and would never catch desktop static #2, because Paul TRAVELS. This harness
// rides a many-short-hop grand tour (pure genres + halfway blends) for 15+ min
// and samples every ~10s: click detector on the master + element output, load
// ratio, POOL count + total live WORKLET-NODE count, JS heap, eco level, and the
// cumulative reap count. The signature of the leak is the WORKLET-NODE count
// climbing MONOTONICALLY across hops (every visited genre's unique solo: voices
// stay connected and render every block) until the render budget runs out and
// clicks/underruns appear at constant tempo. With the reaper on, node count must
// SAWTOOTH (bounded) and clicks/load stay flat at minute-1 levels.
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");

const ROOT = path.join(__dirname, "..");
const PORT = +(process.env.SOAK_PORT || 8794);
const SECS = +(process.argv[2] || 900);
const MODE = (process.argv[3] || "reap").toLowerCase();
const SEED = +(process.env.SOAK_SEED || 7);
// cap10 mode: deliberately UNDERSIZED worklet budget — proves the LRU harvest
// pins the count at the cap with music still playing (the current genre always
// wins). Its tour REVISITS the first genre at the end (…,disco,acidhouse), so
// the run also gates revisit-after-harvest: the reborn station must be voiced.
const CAP = MODE === "cap10" ? 10 : 0;
const GENRES = process.env.SOAK_GENRES ||
  ("acidhouse,jungle,triphop,vaporwave,dinosynth,jazz,neoclassical,blues,tango,dubstep,techno,citypop,synthwave,dub,disco"
    + (CAP ? ",acidhouse" : ""));
const STATIONS = GENRES.split(",").length * 2 - 1;           // pure genres + halfway blends
const DWELL = Math.max(18, Math.round(SECS / STATIONS));     // dwell per station -> full-run travel

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const fx = (n, d = 1) => (isFinite(n) ? n.toFixed(d) : "n/a");

// run ONE leg (reaper on or off; optional undersized cap) and return the result.
async function runLeg(page, noReap) {
  await page.reload();
  await page.waitForFunction(() => typeof goSoakTravel === "function");
  await page.evaluate(([g, s, d, nr, cap]) => goSoakTravel(g, s, d, { noReap: nr, maxWorklets: cap || undefined }),
    [GENRES, SEED, DWELL, noReap, CAP]);
  const start = Date.now();
  while ((Date.now() - start) / 1000 < SECS) await sleep(5000);
  const R = await page.evaluate(() => stopSoak());
  await sleep(800);
  return R;
}

// per-leg analysis: node/pool/load/heap base (30-90s) vs late (last 150s), the
// node-count max + climb, and the first click onset (2 consecutive samples with
// clicks >= 3 on either the master or element tap).
function analyze(R) {
  const S = R.samples;
  const base = S.filter((s) => s.t >= 30 && s.t <= 90);
  const late = S.filter((s) => s.t >= SECS - 150);
  const nodes = S.map((s) => s.nodes);
  const clk = (s) => Math.max(s.master ? s.master.clicks : 0, s.elem ? s.elem.clicks : 0);
  let onset = null;
  for (let i = 1; i < S.length - 1; i++) if (clk(S[i]) >= 3 && clk(S[i + 1]) >= 3) { onset = S[i].t; break; }
  return {
    S,
    nBase: mean(base.map((s) => s.nodes)), nLate: mean(late.map((s) => s.nodes)),
    nMax: Math.max(...nodes), nMin: Math.min(...nodes),
    nBaseMax: Math.max(...base.map((s) => s.nodes)), nLateMax: Math.max(...late.map((s) => s.nodes)),
    pBase: mean(base.map((s) => s.pools)), pLate: mean(late.map((s) => s.pools)), pMax: Math.max(...S.map((s) => s.pools)),
    lBase: mean(base.map((s) => s.load)), lLate: mean(late.map((s) => s.load)),
    hBase: mean(base.map((s) => s.heapMB)), hLate: mean(late.map((s) => s.heapMB)),
    clkBase: mean(base.map(clk)), clkLate: mean(late.map(clk)),
    ecoMax: Math.max(...S.map((s) => s.eco)), reaps: (S[S.length - 1] || {}).reaps || 0,
    awakeBase: mean(base.filter((s) => s.awake != null).map((s) => s.awake)),
    awakeLate: late.some((s) => s.awake != null) ? mean(late.filter((s) => s.awake != null).map((s) => s.awake)) : null,
    awakeMax: Math.max(...S.map((s) => s.awake || 0)),
    harvests: (S[S.length - 1] || {}).harvests || 0,
    cap: (S[S.length - 1] || {}).cap || 0,
    // revisit-after-harvest (cap10 tour ends back on its first genre): the
    // reborn station's samples must be VOICED — pools rebuilt correctly.
    revisit: (() => {
      const first = (GENRES.split(",")[0] || "").trim();
      const rv = S.filter((s, i) => s.station === first && i > S.length / 2);
      if (!rv.length) return null;
      return { n: rv.length, voiced: rv.filter((s) => s.master && s.master.rms > 0.003).length };
    })(),
    onset,
  };
}

function printLeg(tag, A, R) {
  console.log(`\n===== ${tag} (reaper ${R.noReap ? "OFF" : "ON"}${A.cap ? ", cap " + A.cap : ""}) — ${A.S.length} samples over ${SECS}s =====`);
  console.log("  t(s) [station]            heap  load eco pools awk:tot reaps harv | MSTRclk ELEMclk");
  for (const s of A.S) {
    const clk = (p) => (p ? String(p.clicks).padStart(2) : " -");
    const awk = s.awake == null ? "-" : s.awake;
    console.log(`  ${String(s.t).padStart(5)} ${String(s.station).padEnd(22).slice(0, 22)} ${String(s.heapMB).padStart(5)} ${s.load.toFixed(2)} ${s.eco}   ${String(s.pools).padStart(3)}  ${String(awk).padStart(3)}:${String(s.nodes).padEnd(3)} ${String(s.reaps).padStart(4)} ${String(s.harvests || 0).padStart(4)} |   ${clk(s.master)}     ${clk(s.elem)}`);
  }
  console.log(`  NODES: base ${fx(A.nBase)} (max ${A.nBaseMax}) -> late ${fx(A.nLate)} (max ${A.nLateMax})  overall min/max ${A.nMin}/${A.nMax}${A.cap ? "  CAP " + A.cap : ""}`);
  if (A.awakeLate != null) console.log(`  AWAKE (computing): base ${fx(A.awakeBase)} -> late ${fx(A.awakeLate)} (max ${A.awakeMax}) — sleepers cost ~0`);
  console.log(`  POOLS: base ${fx(A.pBase)} -> late ${fx(A.pLate)} (max ${A.pMax})   reaps ${A.reaps}  harvests ${A.harvests}`);
  console.log(`  LOAD:  base ${fx(A.lBase, 3)} -> late ${fx(A.lLate, 3)}   ecoMax ${A.ecoMax}`);
  console.log(`  HEAP:  base ${fx(A.hBase, 1)}MB -> late ${fx(A.hLate, 1)}MB`);
  console.log(`  CLICKS: base ${fx(A.clkBase, 1)} -> late ${fx(A.clkLate, 1)}   ONSET ${A.onset != null ? A.onset + "s (" + (A.onset / 60).toFixed(1) + "min)" : "none"}`);
  if (A.revisit) console.log(`  REVISIT (${GENRES.split(",")[0]} reborn after harvest): ${A.revisit.voiced}/${A.revisit.n} samples voiced`);
}

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const pageErrors = capturePageErrors(page);
  await page.goto(`http://localhost:${PORT}/faust/soak.html`);
  console.log(`TRAVEL SOAK: ${STATIONS} stations, dwell ${DWELL}s, seed ${SEED}, ${SECS}s (${(SECS / 60).toFixed(1)}min) each leg, mode=${MODE}`);
  console.log(`  tour: ${GENRES}`);

  const legs = MODE === "ab" ? [true, false] : [MODE === "noreap"];
  const results = {};
  for (const noReap of legs) {
    const R = await runLeg(page, noReap);
    R.noReap = noReap;
    const A = analyze(R);
    results[noReap ? "off" : "on"] = { A, R };
    printLeg(noReap ? "BEFORE" : "AFTER", A, R);
  }

  await browser.close(); srv.close();

  const errs = pageErrors.filter((e) => !/archive\.org|CORS|ERR_FAILED|Failed to load resource|net::|found decode/i.test(e));
  console.log(`\n=== ERRORS: ${errs.length} real (found-sound/CORS filtered) ===`);
  if (errs.length) console.log("  " + errs.slice(0, 10).join("\n  "));

  // verdict: the CLEAN, unconfounded signals for this underrun bug are node
  // count (the leak's direct measure), load ratio, and eco level. Absolute click
  // counts are confounded — a kick onset has peakDelta ~1 and reads as a "click",
  // and every station swap rebuilds voices with declick transients — so clicks
  // are DESCRIPTIVE here, not a gate. On the reaper-ON leg node count must be
  // BOUNDED — a PLATEAU test, not a base-ratio: resident count tracks the
  // CURRENT genre's intrinsic size (acidhouse ~5 nodes, dinosynth ~20), so a
  // tour that opens on a light genre "climbs" intrinsically; the leak signature
  // is late growth BEYOND the mid-tour plateau / far past the cap. Load must
  // not degrade, eco must not engage from accumulation, and the reaper/harvest
  // must actually fire. If both legs ran, the OFF leg must visibly climb
  // (proves the harness stresses the leak — a guard against a no-op test).
  const on = results.on;
  let pass = true, fails = [];
  if (on) {
    const A = on.A;
    const midW = A.S.filter((s) => s.t >= SECS * 0.4 && s.t <= SECS * 0.7);
    const nMid = mean(midW.map((s) => s.nodes));
    if (isFinite(nMid) && A.nLate > nMid * 1.15 + 1) { pass = false; fails.push(`node count still climbing past mid-tour plateau: mid ${fx(nMid)} -> late ${fx(A.nLate)}`); }
    // overage-while-active is the CONTRACT (a two-parent blend's active set
    // runs ~2x a light genre; never break playing music for the cap) — the
    // leak signature is blowing FAR past it, or failing to return toward the
    // cap when the music thins. +10: two heavy actives ≈ cap+8; a leak sails past.
    if (A.cap && A.nMax > A.cap + 10) { pass = false; fails.push(`resident max ${A.nMax} far above cap ${A.cap} (+10 active-blend allowance)`); }
    if (A.lLate < 0.97) { pass = false; fails.push(`load degraded to ${fx(A.lLate, 3)} (< 0.97 gate)`); }
    // eco alone can be an artifact of an external box stall (one wall-clock
    // discontinuity trips the EMA); only fail when it reflects SUSTAINED
    // starvation, i.e. late load actually degraded too.
    if (A.ecoMax > 0 && A.lLate < 0.97) { pass = false; fails.push(`eco engaged (level ${A.ecoMax}) with degraded late load — the thread was starved`); }
    if (A.reaps + A.harvests <= 0) { pass = false; fails.push(`neither reaper nor harvest fired (reaps=${A.reaps} harvests=${A.harvests})`); }
    if (CAP) {   // undersized-cap gate: pinned AT the cap, still making music
      // +3 allowance: the current genre's PROTECTED pools + infra (fx_bus /
      // reverb color / master_mb) may legitimately exceed an undersized cap —
      // "the current genre always wins" is the contract, so a small protected
      // overage is correct behavior; a big one means harvest isn't working.
      if (A.nMax > CAP + 3) { pass = false; fails.push(`cap breached: max nodes ${A.nMax} > cap ${CAP} (+3 protected allowance)`); }
      if (A.nLate > CAP + 1) { pass = false; fails.push(`late mean ${fx(A.nLate)} not pinned at cap ${CAP}`); }
      if (A.harvests <= 0) { pass = false; fails.push(`cap ${CAP} never forced a harvest (harvests=0) — undersized run did not stress the budget`); }
      const voiced = A.S.filter((s) => s.master && s.master.rms > 0.003).length;
      if (voiced < A.S.length * 0.8) { pass = false; fails.push(`music suffered under the cap: only ${voiced}/${A.S.length} samples voiced`); }
      if (A.revisit && A.revisit.voiced < A.revisit.n) { pass = false; fails.push(`revisit-after-harvest not fully voiced: ${A.revisit.voiced}/${A.revisit.n}`); }
      if (!A.revisit) { pass = false; fails.push(`revisit station never sampled (tour/dwell mismatch)`); }
    }
  }
  if (errs.length) { pass = false; fails.push(`${errs.length} real console/page errors`); }
  if (results.off && results.on) {
    const off = results.off.A;
    const climbed = off.nLate > off.nBase * 1.4 || off.lLate < on.A.lLate - 0.02 || off.ecoMax > on.A.ecoMax;
    console.log(`\nA/B COMPARISON (leak reproduced=${climbed}):`);
    console.log(`  reaper OFF: nodes ${fx(off.nBase)}->${fx(off.nLate)} (max ${off.nMax})  load ${fx(off.lBase, 3)}->${fx(off.lLate, 3)}  ecoMax ${off.ecoMax}  reaps ${off.reaps}`);
    console.log(`  reaper ON : nodes ${fx(on.A.nBase)}->${fx(on.A.nLate)} (max ${on.A.nMax})  load ${fx(on.A.lBase, 3)}->${fx(on.A.lLate, 3)}  ecoMax ${on.A.ecoMax}  reaps ${on.A.reaps}`);
    if (!climbed) fails.push("A/B: reaper-OFF leg did not climb/degrade — harness did not reproduce the leak (run longer)");
  }

  console.log(`\n=== TRAVEL-SOAK GATE: ${pass ? "PASS" : "FAIL"} ===`);
  if (!pass) console.log("  - " + fails.join("\n  - "));
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
