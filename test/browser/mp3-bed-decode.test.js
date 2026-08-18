#!/usr/bin/env node
// test/browser/mp3-bed-decode.test.js — browser MP3-decode proof for the HOSTING.md §3
// payload diet (beds + speech ship as MP3; zones/breaks stay WAV).
//
// Drives the real explorer page headless, retargets to a BED-HEAVY genre
// (spokenword: vx_* narration beds + sp_* speech), rides >=5 bars, and asserts:
//   1. real audio (maxRms > 0.0008 — same floor as explorer-ui-test G1);
//   2. at least one network response for a found/*.mp3 URL returned 200
//      (the local-first bed path actually fetched an MP3, not a WAV);
//   3. no console/page errors mentioning "decode" (decodeAudioData took the
//      MP3 bytes; a failed decode surfaces as EncodingError/decode messages).
// This proves fetch + decodeAudioData of the converted MP3 beds in a real
// chromium, same-origin under COOP/COEP, exactly like production nginx.
//
//   node test/browser/mp3-bed-decode.test.js
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const ROOT = path.join(__dirname, "..", "..");
let PORT = 8931;

async function main() {
  const srv = await serve(ROOT, PORT);
  PORT = srv.port;   // the harness may have walked past a busy port
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 850 });
  const errs = capturePageErrors(page);
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); return cond; };

  // every response for a bed/speech MP3 (found/*.mp3 covers found/samples/speech/*.mp3 too)
  const mp3Responses = [];
  page.on("response", (r) => {
    if (/\/found\/.*\.mp3(\?|$)/.test(r.url())) mp3Responses.push({ url: r.url(), status: r.status() });
  });

  await page.goto(`http://localhost:${PORT}/screensaver.html`);
  await page.waitForFunction(() => window.__X && window.__S && window.__LOOP, { timeout: 20000 });
  await page.waitForTimeout(500);

  // park the whole travel path ON spokenword (bed-heavy: vx_* narration beds +
  // sp_* speech) — goLive snaps to waypoints[0], so replacing the waypoints is
  // what actually rides the genre (a bare retarget would be snapped back)
  const target = await page.evaluate(() => {
    const p = __X.POS.spokenword;
    __S.waypoints = [{ x: p[0], y: p[1] }, { x: p[0] + 30, y: p[1] + 30 }];
    __X.retarget({ x: p[0], y: p[1] });
    const w = __X.weightsAt({ x: p[0], y: p[1] });
    const top = (Array.isArray(w) ? w : []).map((e) => e.g + ":" + (e.w && e.w.toFixed ? e.w.toFixed(2) : e.w)).slice(0, 3);
    return { pos: p, top };
  });
  console.log(`parked loop on spokenword @ (${target.pos[0]},${target.pos[1]}) — weights: ${target.top.join(", ")}`);

  // LIVE: ride at least 5 bars, sampling the live handle's RMS
  await page.evaluate(() => __X.goLive());
  let maxRms = 0, bars = 0;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => {
      const h = window.FaustLive && FaustLive.lastHandle;
      return { bar: __S.barCount, rms: h ? +h.rms() : 0 };
    });
    maxRms = Math.max(maxRms, s.rms); bars = s.bar;
    if (bars >= 5 && maxRms > 0.0008 && mp3Responses.length > 0) break;
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => __X.stopLive()).catch(() => {});
  await page.waitForTimeout(300);

  const ok200 = mp3Responses.filter((r) => r.status === 200);
  const decodeErrs = errs.filter((e) => /decode/i.test(e));

  ok(bars >= 5, `rode only ${bars} bars (want >=5)`);
  ok(maxRms > 0.0008, `no real audio (maxRms=${maxRms.toFixed(5)}, want > 0.0008)`);
  ok(ok200.length > 0, `no found/*.mp3 response returned 200 (${mp3Responses.length} mp3 responses seen)`);
  ok(decodeErrs.length === 0, `decode errors in console: ${decodeErrs.slice(0, 3).join(" | ")}`);

  console.log(`\n=== MP3 DECODE PROOF ===`);
  console.log(`  bars=${bars}  maxRms=${maxRms.toFixed(5)}`);
  console.log(`  mp3 responses: ${mp3Responses.length} total, ${ok200.length} with status 200`);
  ok200.slice(0, 8).forEach((r) => console.log(`    200 ${r.url.replace(/^http:\/\/[^/]+\//, "")}`));
  console.log(`  console errors mentioning decode: ${decodeErrs.length}`);

  await browser.close(); srv.close();
  if (fails.length) { console.log(`\nFAILURES:\n  - ${fails.join("\n  - ")}\nMP3-BED-DECODE GATE: FAIL`); process.exit(1); }
  console.log(`MP3-BED-DECODE GATE: PASS`);
}

main().catch((e) => { console.error(e); process.exit(1); });
