#!/usr/bin/env node
// test/browser/sampler-inserts-live.test.js — headless gate for INSERTS-ON-SAMPLED-VOICES
// on the LIVE ring path.
//
//   node test/browser/sampler-inserts-live.test.js
//
// Rides citypop seed 2 (resolved anchor: chorus on the SAMPLED slap bass — the
// city-pop gloss) live for ~18s on the ring path and asserts:
//   - the per-unit insert-chain twin EXISTS in the graph (handle.__samplerInserts
//     reports unit "bass" with a built "chorus" stage — the declared chain is
//     wired between the unit's notes and its sends, not silently dropped)
//   - AnalyserNode RMS is real (music actually played through it)
//   - load ratio stayed healthy (no budget blowout from the chain)
//   - zero engine/page errors
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8797;

async function main() {
  const srv = await serve(ROOT, PORT);
  PORT = srv.port;   // the harness may have walked past a busy port
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const pageErrors = capturePageErrors(page);

  await page.goto(`http://localhost:${PORT}/test/browser/live-test.html?allSampled=1&wavOut=0`);
  console.log("page loaded; going live on citypop s2 (sampled slap bass + declared chorus)…");
  await page.evaluate(() => goLive("citypop", 2));
  await page.waitForTimeout(48000);
  const chains = await page.evaluate(() => window.handle && window.handle.__samplerInserts ? window.handle.__samplerInserts() : null);
  const load = await page.evaluate(() => window.handle ? window.handle.loadRatio() : 0);
  const T = await page.evaluate(() => stopLive());
  await page.waitForTimeout(400);
  await browser.close();
  srv.close();

  const rmsNZ = T.rms.filter((v) => v > 0.001).length, rmsMax = Math.max(...T.rms, 0);
  console.log(`rms: ${rmsNZ}/${T.rms.length} samples nonzero, max ${rmsMax.toFixed(3)}; load ${Number(load).toFixed(3)}`);
  console.log("samplerInserts:", JSON.stringify(chains));
  console.log("errors:", T.errors.length, pageErrors.length ? `page: ${pageErrors.join(" | ").slice(0, 300)}` : "(no page errors)");

  const bassChain = (chains || []).find((c) => c.unit === "bass");
  const checks = [
    ["insert chain in graph (bass, chorus stage built)", !!(bassChain && bassChain.types.indexOf("chorus") >= 0 && bassChain.stages.indexOf("chorus") >= 0)],
    ["rms real (>= half the samples nonzero)", rmsNZ >= T.rms.length / 2 && rmsMax > 0.005],
    ["load healthy (>= 0.9)", load >= 0.9],
    ["zero errors", T.errors.length === 0 && pageErrors.length === 0],
  ];
  let ok = true;
  for (const [name, pass] of checks) { console.log(`${pass ? "PASS" : "FAIL"}  ${name}`); ok = ok && pass; }
  console.log(ok ? "\nSAMPLER-INSERTS LIVE: ALL PASS" : "\nSAMPLER-INSERTS LIVE: FAILURES");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
