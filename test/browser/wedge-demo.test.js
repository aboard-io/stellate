#!/usr/bin/env node
// test/browser/wedge-demo.test.js — deterministic proof of the "whole song stops /
// crashes out" mechanism. We make ONE voice module fail to instantiate (route
// its wasm to a 500), then travel blues->tango->neoclassical. If injectChord is
// not bar-isolated, the throw from ensurePool leaves nextTime un-advanced and
// the scheduler re-runs the same failing bar forever: barCount stalls, RMS
// collapses to silence (WEDGE). With the fix it logs the bad voice and keeps
// playing (SURVIVE).
//   node test/browser/wedge-demo.test.js
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const ROOT = path.join(__dirname, "..", "..");
let PORT = 8797;
const FAIL_MODULE = process.argv[2] || "kick_boom";   // module whose wasm we 500
const MODE = process.argv[3] || "stationary";          // "stationary" | "travel"
// stationary sits on blues (kick_boom is used EVERY bar) so the fault persists —
// the true permanent-wedge case; travel morphs the state so a faulty voice can
// be walked away from (a softer, self-recovering failure).

async function main() {
  const srv = await serve(ROOT, PORT);
  PORT = srv.port;   // the harness may have walked past a busy port
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  // fault injection: fail the target voice module's wasm so mkNode() rejects
  await page.route(`**/dist/${FAIL_MODULE}-module.wasm`, r => r.fulfill({ status: 500, body: "nope" }));

  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => window.__X && window.__S);
  await page.waitForTimeout(500);
  await page.evaluate((mode) => {
    __S.seed = 12345;
    if (mode === "travel") {
      const wp = ["blues", "tango", "neoclassical"].map(g => ({ x: __X.POS[g][0], y: __X.POS[g][1] }));
      __S.waypoints = wp; __S.pace = 8; __X.retarget(wp[0]);
    } else {
      __S.waypoints = []; const p = __X.POS.blues; __X.retarget({ x: p[0], y: p[1] });   // stationary on blues
    }
  }, MODE);
  await page.evaluate(() => __X.goLive());
  await page.waitForFunction(() => __S.barCount >= 1, { timeout: 30000 }).catch(() => {});

  const samples = [];
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => {
      const h = window.FaustLive && FaustLive.lastHandle;
      return { bar: __S.barCount, rms: h ? +h.rms().toFixed(5) : -1,
        nextAhead: 0, errN: h ? h.errors.length : -1,
        badVoiceErrs: h ? h.errors.filter(e => /^voice /.test(e)).length : 0,
        wedgeErrs: h ? h.errors.filter(e => /^injectChord@/.test(e)).length : 0 };
    });
    samples.push({ t: Date.now(), ...s });
    if (samples.length > 3 && s.bar >= 26) break;
    await page.waitForTimeout(1500);
  }
  await page.evaluate(() => __X.stopLive()).catch(() => {});
  await page.waitForTimeout(300);
  await browser.close(); srv.close();

  // did it keep advancing + stay audible after the fault module got introduced?
  const first = samples[0], last = samples[samples.length - 1];
  const barsAdvanced = last.bar - first.bar;
  const tail = samples.slice(-4);
  const tailAudible = tail.filter(s => s.rms > 0.0008).length;
  const wedged = barsAdvanced < 6 || tailAudible === 0;
  console.log(`fault: ${FAIL_MODULE}-module.wasm -> 500`);
  console.log("bar / rms / badVoiceErr / wedgeErr over time:");
  for (const s of samples) console.log(`  bar ${String(s.bar).padStart(3)} rms=${String(s.rms).padStart(7)} badVoice=${s.badVoiceErrs} wedge=${s.wedgeErrs}`);
  console.log(`barsAdvanced=${barsAdvanced} tailAudibleSamples=${tailAudible}/${tail.length} pageErrors=${errs.length}`);
  console.log(`RESULT: ${wedged ? "WEDGED (scheduler died)" : "SURVIVED (kept playing through the fault)"}`);
  process.exit(wedged ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
