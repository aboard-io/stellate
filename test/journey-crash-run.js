#!/usr/bin/env node
// faust/journey-crash-run.js — REPRO + GATE for Paul's blues->tango->neoclassical
// crash ("one half measure of guitar then silence, then it crashes out").
// Drives explorer.html headless, snaps the cursor blues -> tango -> neoclassical
// (the sampler->sampler->sampler lead ride), and traces per-bar RMS, the live
// error array, the voice pools, S.playing lead identity, and the flip queue.
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node faust/journey-crash-run.js
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8796;

const snap = () => `(() => {
  const h = window.FaustLive && FaustLive.lastHandle;
  const mel = __S.playing && __S.playing.instruments.melody;
  return {
    bar: __S.barCount,
    rms: h ? +h.rms().toFixed(5) : -1,
    bal: h ? (b => ({l:+b.l.toFixed(4), r:+b.r.toFixed(4)}))(h.balance()) : null,
    load: +(__S.load||0).toFixed(3),
    qlen: __S.queue.length,
    q: __S.queue.map(x => x[0]),
    lead: mel ? (mel.model + (mel.sampler? ":"+mel.sampler.id : "")) : "?",
    pad: __S.playing ? __S.playing.instruments.pad.model : "?",
    bass: __S.playing ? __S.playing.instruments.bass.model : "?",
    prog: __S.playing ? __S.playing.progression : "?",
    weights: (__S.weights||[]).map(w => w.g+":"+Math.round(w.w*100)),
    errN: h ? h.errors.length : -1,
    errs: h ? h.errors.slice(-4) : [],
    pools: h ? [...h._pools].map(([k,p]) => k+"="+p.module+"x"+p.nodes.length).join(",") : "",
    status: __S.status,
  };
})()`;

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  const warns = [];
  page.on("console", m => { if (m.type() === "warning") warns.push(m.text()); });

  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => window.__X && window.__S);
  await page.waitForTimeout(500);   // let the boot random-journey settle before we overwrite it

  // Draw the EXACT path Paul walked: blues -> tango -> neoclassical, and travel
  // it continuously (travelStep, not cursor snaps) so weightsAt returns blends
  // and the discrete flip queue fires as the traveler crosses each star. Seed
  // 12345: the lead is a SAMPLER across the whole ride (blues harmonica -> the
  // tango nylon_string_guitar/bandoneon -> neoclassical felt_piano) — the
  // sampler->sampler->sampler lead in the report. Small pace = fast transit.
  const TOTAL_BARS = 42;
  await page.evaluate(() => {
    __S.seed = 12345;
    const wp = ["blues", "tango", "neoclassical"].map(g => ({ x: __X.POS[g][0], y: __X.POS[g][1] }));
    __S.waypoints = wp; __S.pace = 8;
    __X.retarget(wp[0]);
  });
  await page.evaluate(() => __X.goLive());
  await page.waitForFunction(() => __S.barCount >= 1, { timeout: 30000 }).catch(() => {});

  const trace = [];
  const legName = (s) => (s.weights[0] || "").split(":")[0].toUpperCase();
  const deadline = Date.now() + TOTAL_BARS * 8000 + 15000;
  let lastBar = -1, startBar = await page.evaluate(() => __S.barCount);
  while (Date.now() < deadline) {
    const s = await page.evaluate(snap());
    if (s.bar !== lastBar) { lastBar = s.bar; trace.push({ leg: legName(s), ...s }); }
    if (s.bar >= startBar + TOTAL_BARS) break;
    await page.waitForTimeout(600);
  }
  const finalErrs = await page.evaluate(() => {
    const h = window.FaustLive && FaustLive.lastHandle;
    return h ? h.errors.slice() : [];
  });
  await page.evaluate(() => __X.stopLive()).catch(() => {});
  await page.waitForTimeout(400);
  await browser.close(); srv.close();

  console.log("\n=== TRACE (one row per bar advance) ===");
  for (const t of trace) {
    console.log(
      `${t.leg.padEnd(12)} bar${String(t.bar).padStart(3)} rms=${String(t.rms).padStart(7)} ` +
      `load=${t.load} q=${t.qlen}[${t.q.join(",")}] lead=${t.lead} pad=${t.pad} ` +
      `errN=${t.errN} pools=[${t.pools}]`);
    if (t.errs && t.errs.length) console.log(`      errs: ${t.errs.join(" | ")}`);
  }
  console.log("\n=== page errors (uncaught / console.error) ===");
  console.log(errs.length ? errs.slice(0, 20).join("\n") : "(none)");
  console.log("\n=== engine handle.errors (final) ===");
  console.log(finalErrs.length ? finalErrs.slice(0, 20).join("\n") : "(none)");
  console.log("\n=== console.warn (sampler/found decode etc.) ===");
  console.log(warns.length ? [...new Set(warns)].slice(0, 20).join("\n") : "(none)");

  // gate metrics: after the first ~2 warmup bars, RMS must never collapse to
  // silence and there must be zero errors. Also count the max consecutive
  // "quiet" bars (the "half measure then silence" symptom) and whether tango
  // (nylon_string_guitar / bandoneon) actually led.
  const body = trace.filter(t => t.bar >= startBar + 2);
  const rmsMin = body.length ? Math.min(...body.map(r => r.rms)) : -1;
  let maxQuietRun = 0, run = 0;
  for (const r of body) { if (r.rms < 0.0008) { run++; maxQuietRun = Math.max(maxQuietRun, run); } else run = 0; }
  const sawTangoSampler = trace.some(t => /nylon_string_guitar|bandoneon/.test(t.lead));
  const sawFeltPiano = trace.some(t => /felt_piano/.test(t.lead));

  // HOLD-RULE check: for each held voice, list the bars where its instrument
  // CHANGED and the min gap between changes. Paul's rule = a newly introduced
  // instrument lasts >= a few measures; with HOLD_BARS=4 a held voice must not
  // flip more often than that (arrivals may override, so we report, not hard-fail
  // on a single arrival-driven close pair).
  const holdReport = (field) => {
    const changes = [];
    for (let i = 1; i < trace.length; i++) if (trace[i][field] !== trace[i - 1][field]) changes.push(trace[i].bar);
    let minGap = Infinity;
    for (let i = 1; i < changes.length; i++) minGap = Math.min(minGap, changes[i] - changes[i - 1]);
    return { field, changes, n: changes.length, minGap: changes.length > 1 ? minGap : "-" };
  };
  const holdLead = holdReport("lead"), holdPad = holdReport("pad"), holdBass = holdReport("bass");
  console.log("\n=== HOLD RULE (instrument changes per voice) ===");
  for (const h of [holdLead, holdPad, holdBass])
    console.log(`  ${h.field.padEnd(5)} changed ${h.n}x at bars [${h.changes.join(",")}] minGap=${h.minGap}`);
  console.log("\n=== GATE ===");
  console.log(`bars traced=${trace.length} bodyRmsMin=${rmsMin} maxConsecutiveQuietBars=${maxQuietRun}`);
  console.log(`sawTangoSamplerLead=${sawTangoSampler} sawNeoFeltPianoLead=${sawFeltPiano}`);
  console.log(`pageErrors=${errs.length} engineErrors=${finalErrs.length}`);
  const pass = errs.length === 0 && finalErrs.length === 0 && maxQuietRun === 0 && body.length >= 10;
  console.log(`JOURNEY CRASH GATE: ${pass ? "PASS" : "FAIL"}`);
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
