#!/usr/bin/env node
// test/browser/speech-live.test.js — browser proof for the SPEECH organ (engine/speech.js).
//
// Drives the real explorer page headless (probe-harness: same-origin static
// server with COOP/COEP + the pinned chromium-1217), parks the travel loop ON
// transitwave (whose toState adds the namebank PA source with `synthText`),
// rides >= 6 bars, and asserts:
//   1. CsdSpeech loaded (window.CsdSpeech — the organ script tag);
//   2. a synthText source actually SYNTHESIZED: window.__SPEECH.synths >= 1
//      and its key matches the canonical "speech:v=…" shape (the organ's
//      headless-verification hook increments per successful utterance — this
//      proves the lazy espeak wasm loaded, ran, and fed the found pipeline);
//   3. real audio (maxRms > 0.0008, the explorer-ui-test G1 floor);
//   4. zero console/page errors.
//
//   node test/browser/speech-live.test.js
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const ROOT = path.join(__dirname, "..", ".."), PORT = 8937;
const GEN = process.argv[2] || "transitwave";   // which member of the cast to prove

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 850 });
  const errs = capturePageErrors(page);
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); return cond; };

  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => window.__X && window.__S && window.__LOOP, { timeout: 20000 });
  await page.waitForTimeout(500);

  // park the whole travel path ON the target genre — goLive snaps to
  // waypoints[0], so replacing the waypoints is what actually rides the genre
  // (the mp3-bed-decode-run parking approach). The organ has a CAST now
  // (genre-kernel SPEAKERS), so the genre is an argument and defaults to the
  // transit PA this gate was written against:
  //   node test/browser/speech-live.test.js [genre]
  const target = await page.evaluate((GEN) => {
    const p = __X.POS[GEN];
    if (!p) throw new Error("no star for genre: " + GEN);
    __S.waypoints = [{ x: p[0], y: p[1] }, { x: p[0] + 30, y: p[1] + 30 }];
    __X.retarget({ x: p[0], y: p[1] });
    const w = __X.weightsAt({ x: p[0], y: p[1] });
    const top = (Array.isArray(w) ? w : []).map((e) => e.g + ":" + (e.w && e.w.toFixed ? e.w.toFixed(2) : e.w)).slice(0, 3);
    return { pos: p, top };
  }, GEN);
  console.log(`parked loop on ${GEN} @ (${target.pos[0]},${target.pos[1]}) — weights: ${target.top.join(", ")}`);

  // LIVE: ride >= 6 bars, sampling RMS + the organ's __SPEECH hook
  await page.evaluate(() => __X.goLive());
  let maxRms = 0, bars = 0, speech = { synths: 0, keys: [] };
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => {
      const h = window.FaustLive && FaustLive.lastHandle;
      return { bar: __S.barCount, rms: h ? +h.rms() : 0,
        organ: typeof window.CsdSpeech !== "undefined",
        speech: window.__SPEECH ? { synths: window.__SPEECH.synths, keys: window.__SPEECH.keys.slice(0, 4) } : null };
    });
    maxRms = Math.max(maxRms, s.rms); bars = s.bar;
    if (s.speech) speech = s.speech;
    if (bars >= 6 && maxRms > 0.0008 && speech.synths >= 1) break;
    await page.waitForTimeout(400);
  }
  const organLoaded = await page.evaluate(() => typeof window.CsdSpeech !== "undefined");
  const paSrc = await page.evaluate(() => {
    const st = window.__S && __S.playing;
    const s = st && (st.foundSources || []).find((x) => x.synthText);
    return s ? { id: s.id, text: s.synthText.text } : null;
  });
  await page.evaluate(() => __X.stopLive()).catch(() => {});
  await page.waitForTimeout(300);

  ok(organLoaded, "window.CsdSpeech not loaded (index.html script tag?)");
  ok(bars >= 6, `rode only ${bars} bars (want >=6)`);
  ok(maxRms > 0.0008, `no real audio (maxRms=${maxRms.toFixed(5)}, want > 0.0008)`);
  ok(speech.synths >= 1, `no synthText source synthesized (window.__SPEECH.synths=${speech.synths})`);
  ok(speech.keys.every((k) => /^speech:v=/.test(k)), `non-canonical speech key: ${speech.keys[0]}`);
  ok(errs.length === 0, `console/page errors: ${errs.slice(0, 3).join(" | ")}`);

  console.log(`\n=== SPEECH ORGAN LIVE PROOF ===`);
  console.log(`  bars=${bars}  maxRms=${maxRms.toFixed(5)}  synths=${speech.synths}`);
  if (paSrc) console.log(`  PA source: ${paSrc.id} — "${paSrc.text}"`);
  speech.keys.forEach((k) => console.log(`  key: ${k}`));
  console.log(`  console errors: ${errs.length}`);

  await browser.close(); srv.close();
  if (fails.length) { console.log(`\nFAILURES:\n  - ${fails.join("\n  - ")}\nSPEECH-LIVE GATE: FAIL`); process.exit(1); }
  console.log(`SPEECH-LIVE GATE: PASS`);
}

main().catch((e) => { console.error(e); process.exit(1); });
