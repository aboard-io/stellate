#!/usr/bin/env node
// test/browser/blend-arrival.test.js — THE LIVE-BLEND ARRIVAL GATE. Arriving at 99%
// reggae from fugue must not leave a harpsichord playing slow, out of sync,
// with NO DRUMS.
//
// The repro that caught it: goLive parked on FUGUE (an all-drums-off genre),
// ride a few bars, then re-park the path on REGGAE and listen. Four mechanisms
// conspired to keep the destination from ever arriving:
//   1. the "sample" flip replaced foundSources wholesale and carried only the
//      pad/bass/melody sampler zones — the playing kit's drum_* one-shots
//      vanished from the crate (targeting.js "sample" flip);
//   2. the "drum kit" flip only rewrote sections whose drums were already ON —
//      from fugue it was a no-op that erased its own diff (targeting.js);
//   3. a sampler zone whose source wasn't in that bar's foundSources cached
//      samplerBufs[srcId]=null FOREVER, so drums stayed silent even after the
//      sources arrived (faust/live.js kickSamplerBuf — probe measured 233 fed
//      drum events, 0 SamplerLive.note() calls);
//   4. the flip queue re-rolled its order every travel retarget, so "form"
//      (the flip that revives drum sections) landed at bar ~118 of 128.
//
// This gate drives the REAL app headless (probe-harness: static server +
// pinned chromium) and asserts the arrival contract:
//   (a) drum note() calls reach the audio graph within DRUM_BARS of re-park
//       (tap on FaustSampler.SamplerLive; drum notes carry the drum strip,
//       hpf===28 — the layer3b instrument);
//   (b) the playing state's kit + lead + bpm match the TARGET within ARRIVE_BARS;
//   (c) RMS stays real throughout and the page logs zero errors;
//   (d) the fugue side still plays correctly first (no start-of-set regression).
//
//   node test/browser/blend-arrival.test.js
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8944;
const DRUM_BARS = 12;     // drums must SOUND within this many bars of the re-park
const ARRIVE_BARS = 12;   // kit/lead/bpm must MATCH the target within this many bars
const RIDE_BARS = 16;     // how long we ride the parked destination
const RMS_FLOOR = 0.0008; // "real sound" (same floor the boot meter trusts)

async function main() {
  const srv = await serve(ROOT, PORT);
  PORT = srv.port;   // the harness may have walked past a busy port
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  await page.goto(`http://localhost:${PORT}/screensaver.html`);
  await page.waitForFunction(() => window.__X && window.__S, { timeout: 20000 });
  await page.waitForTimeout(400);

  // deterministic seed + the note tap: count REAL SamplerLive.note() calls into
  // the audio graph, split drum (strip.hpf===28, the drum strip profile) vs
  // pitched. This is scheduling truth, not state truth — the exact tap that
  // measured 0/233 before the fix.
  await page.evaluate(() => {
    __S.seed = 42;
    window.__NOTES = { drum: 0, pitched: 0 };
    const SP = window.FaustSampler;
    const orig = SP.SamplerLive;
    SP.SamplerLive = (ctx, dests) => {
      const p = orig(ctx, dests);
      const on = p.note.bind(p);
      p.note = (buf, when, o) => {
        if (o && o.strip && o.strip.hpf === 28) window.__NOTES.drum++;
        else window.__NOTES.pitched++;
        return on(buf, when, o);
      };
      return p;
    };
  });

  // park on FUGUE (POS entries are [x,y] arrays) and go live
  await page.evaluate(() => {
    const p = __X.POS.fugue;
    __S.waypoints = [{ x: p[0], y: p[1] }, { x: p[0] + 1, y: p[1] + 1 }];
    __S.travel = { seg: 0, t: 0 };
    __X.retarget({ x: p[0], y: p[1] });
  });
  await page.evaluate(() => __X.goLive());

  const snap = () => page.evaluate(() => {
    const p = __S.playing || {}, t = __S.target || {};
    const lead = (st) => { const m = ((st.instruments || {}).melody) || {}; return (m.sampler && m.sampler.id) || m.model; };
    const kick = (st) => { const d = ((st.instruments || {}).drums) || {}; return d.kickSampler && d.kickSampler.id; };
    const h = window.FaustLive && FaustLive.lastHandle;
    return {
      bar: __S.barCount, live: __S.live,
      w: (__S.weights || []).slice(0, 2).map((w) => w.g + ":" + (+w.w).toFixed(2)),
      bpm: p.bpm, tBpm: t.bpm, kit: (p.genreMeta || {}).kit, tKit: (t.genreMeta || {}).kit,
      lead: lead(p), tLead: lead(t), kick: kick(p), tKick: kick(t),
      drumsOn: (p.sections || []).filter((s) => s.drums && s.drums !== "off").length + "/" + (p.sections || []).length,
      q: (__S.queue || []).length,
      notes: { ...window.__NOTES },
      rms: h ? +(+h.rms()).toFixed(4) : null,
      handleErrs: h ? h.errors.length : 0,
    };
  });

  // ── PHASE 1: the fugue side must PLAY (no start-of-set regression) ──
  let fugueOk = false, fuguePitched = 0;
  let deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const s = await snap();
    if (s.bar >= 4 && s.rms > RMS_FLOOR) {
      fugueOk = true; fuguePitched = s.notes.pitched;
      console.log("FUGUE OK:", JSON.stringify(s));
      break;
    }
    await page.waitForTimeout(500);
  }
  const fugueNotesOk = fuguePitched > 0;   // the harpsichord actually sounded (sampled voice notes reached the graph)

  // ── PHASE 2: RE-PARK on reggae (drag the loop onto the star) ──
  const park = await page.evaluate(() => {
    const r = __X.POS.reggae;
    __S.waypoints = [{ x: r[0], y: r[1] }, { x: r[0] + 1, y: r[1] + 1 }];
    __S.travel = { seg: 0, t: 0 };
    return { bar: __S.barCount, drum0: window.__NOTES.drum };
  });
  console.log("RE-PARKED on reggae at bar", park.bar);

  // ── PHASE 3: ride ~RIDE_BARS bars; measure bars-to-drums and bars-to-state ──
  let barsToDrums = -1, barsToState = -1, lastBar = -1;
  let lowRms = 0, rmsSamples = 0;
  deadline = Date.now() + 300000;
  while (Date.now() < deadline) {
    const s = await snap();
    if (s.rms != null && s.bar > 1) { rmsSamples++; if (s.rms <= RMS_FLOOR) lowRms++; }
    if (s.bar !== lastBar) {
      lastBar = s.bar;
      console.log("P", JSON.stringify(s));
      const rel = s.bar - park.bar;
      if (barsToDrums < 0 && s.notes.drum > park.drum0) barsToDrums = rel;
      const arrived = s.kit === s.tKit && s.lead === s.tLead && (!s.tKick || s.kick === s.tKick)
        && Math.abs((s.bpm || 0) - (s.tBpm || 0)) <= 1;
      if (barsToState < 0 && arrived) barsToState = rel;
      else if (barsToState >= 0 && !arrived) barsToState = -1;   // regressed — keep looking (must STICK)
      if (rel >= RIDE_BARS) break;
    }
    await page.waitForTimeout(1200);
  }

  const fin = await snap();
  console.log("\nFINAL:", JSON.stringify(fin, null, 1));
  try { await page.evaluate(() => __X.stopLive()); } catch (e) {}
  await browser.close(); srv.close();

  // ── VERDICT ──
  const drumsOk = barsToDrums >= 0 && barsToDrums <= DRUM_BARS;
  const stateOk = barsToState >= 0 && barsToState <= ARRIVE_BARS;
  const rmsOk = rmsSamples > 4 && lowRms <= 3;   // real sound throughout (a couple of quiet-section dips allowed)
  const errsOk = errs.length === 0;
  console.log(`fugue plays: ${fugueOk} (pitched notes: ${fuguePitched})`);
  console.log(`bars-to-drums: ${barsToDrums} (gate <= ${DRUM_BARS}), drum notes total: ${fin.notes.drum}`);
  console.log(`bars-to-kit/lead/bpm: ${barsToState} (gate <= ${ARRIVE_BARS})`);
  console.log(`rms real: ${rmsOk} (${lowRms}/${rmsSamples} low), page errors: ${errs.length}, handle errors: ${fin.handleErrs}`);
  if (errs.length) console.log("  " + errs.slice(0, 6).join("\n  "));
  const pass = fugueOk && fugueNotesOk && drumsOk && stateOk && rmsOk && errsOk;
  console.log(pass ? "BLEND-ARRIVAL GATE: PASS" : "BLEND-ARRIVAL GATE: FAIL");
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
