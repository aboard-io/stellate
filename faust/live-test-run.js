#!/usr/bin/env node
// faust/live-test-run.js — headless live gate for the FaustLive facade.
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node faust/live-test-run.js
//
// Serves the repo root on a local port, drives faust/live-test.html in
// headless chromium (playwright, autoplay allowed): goes live on jungle for
// ~30s with a jungle->house state swap at 15s, then asserts:
//   - AnalyserNode RMS nonzero (music actually played)
//   - load ratio >= 0.97 (audio clock kept up with wall clock)
//   - zero engine/page errors across the swap (the glide is param-only)
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");

const ROOT = path.join(__dirname, "..");
const PORT = 8791;

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });   // strict: throw if the pinned build is missing
  const page = await browser.newPage();
  const pageErrors = capturePageErrors(page);

  await page.goto(`http://localhost:${PORT}/faust/live-test.html`);
  console.log("page loaded; going live on jungle…");
  await page.evaluate(() => goLive("jungle", 3));
  await page.waitForTimeout(15000);
  const midRms = await page.evaluate(() => TEST.rms.slice(-6));
  console.log("15s in — swapping to house. recent RMS:", midRms.map(v => v.toFixed(3)).join(" "));
  await page.evaluate(() => swapTo("house", 3));
  await page.waitForTimeout(15000);
  const T = await page.evaluate(() => stopLive());
  await page.waitForTimeout(500);
  await browser.close();
  srv.close();

  const rmsNZ = T.rms.filter(v => v > 0.001).length, rmsMax = Math.max(...T.rms, 0);
  const rmsPost = T.rms.slice(Math.floor(T.rms.length / 2)).filter(v => v > 0.001).length;
  const lr = T.loads.map(l => l.r), loadLast = lr[lr.length - 1];
  const t0 = T.loads.length ? T.loads[0].t : 0;
  const steady = T.loads.filter(l => l.t - t0 > 5);
  const loadMin = Math.min(...steady.map(l => l.r));
  console.log("load trace:", T.loads.map(l => `${(l.t - t0).toFixed(0)}:${l.r.toFixed(2)}`).join(" "));
  const sections = [...new Set(T.bars.map(b => b.section))];
  const errs = [...T.errors, ...pageErrors];

  console.log(`bars scheduled: ${T.bars.length} (sections: ${sections.join(", ")})`);
  console.log(`RMS samples: ${T.rms.length}, nonzero: ${rmsNZ}, max ${rmsMax.toFixed(3)}, nonzero after swap: ${rmsPost}`);
  console.log(`load ratio: min(steady, t>5s) ${isFinite(loadMin) ? loadMin.toFixed(3) : "n/a"}, last ${loadLast && loadLast.toFixed(3)}`);
  console.log(`errors: ${errs.length}${errs.length ? "\n  " + errs.slice(0, 8).join("\n  ") : ""}`);

  // L/R balance: the main analyser downmixes to mono and is blind to panning
  // bugs (the hard-left dry bus shipped through it). Over the loud samples,
  // the quieter channel must hold >= 40% of the louder one's RMS — mono
  // material sits ~1.0, stereo voices decorrelate but never gut a channel.
  const loud = (T.bal || []).filter(b => Math.max(b.l, b.r) > 0.01);
  const balMin = loud.length ? Math.min(...loud.map(b => Math.min(b.l, b.r) / Math.max(b.l, b.r))) : NaN;
  const balMean = loud.length ? loud.reduce((s, b) => s + Math.min(b.l, b.r) / Math.max(b.l, b.r), 0) / loud.length : NaN;
  console.log(`L/R balance: ${loud.length} loud samples, mean ratio ${isFinite(balMean) ? balMean.toFixed(3) : "n/a"}, min ${isFinite(balMin) ? balMin.toFixed(3) : "n/a"}`);
  const balOk = loud.length > 5 && balMean >= 0.4;

  const pass = rmsNZ > 10 && rmsPost > 5 && loadMin >= 0.97 && errs.length === 0 && T.bars.length >= 8 && balOk;
  console.log(pass ? "LIVE GATE: PASS" : "LIVE GATE: FAIL" + (balOk ? "" : " (L/R balance)"));
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
