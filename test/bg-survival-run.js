#!/usr/bin/env node
// faust/bg-survival-run.js — headless probe for the background-survival state machine
// (faust/live.js goHidden/goVisible/onstatechange). Chromium can't reproduce the
// iOS "interrupted" state, but it CAN drive the same code paths:
//   1. fake visibility hidden  -> RMS must fall to ~0 (mute-at-source)
//   2. fake visibility visible -> RMS must recover (resume + unmute + refill)
//   3. real ctx.suspend() while "visible" -> the onstatechange handler must
//      mute, poke resume, and self-heal audio without any visibility event
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node faust/bg-survival-run.js
//
// This drives the DESKTOP ring path (?wavOut=0) — the survival machinery lives there;
// the WAV-FIRST mobile path is no-op-for-audio on hidden by design (WAV-FIRST.md).
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");

const ROOT = path.join(__dirname, "..");
const PORT = 8793;

const rmsN = (page, n, gapMs) => page.evaluate(async ({ n, gapMs }) => {
  const out = [];
  for (let i = 0; i < n; i++) { out.push(window.handle.rms()); await new Promise(r => setTimeout(r, gapMs)); }
  return out;
}, { n, gapMs });

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const pageErrors = capturePageErrors(page);

  // force the ring path (?wavOut=0) so the survival machinery under test is exercised
  await page.goto(`http://localhost:${PORT}/test/live-test.html?wavOut=0`);
  await page.evaluate(() => goLive("jungle", 3));
  await page.waitForTimeout(10000);

  const baseline = await rmsN(page, 6, 300);
  console.log("baseline RMS:", baseline.map(v => v.toFixed(3)).join(" "));

  // ── 1. fake hidden ──
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { get: () => window.__vis || "hidden", configurable: true });
    window.__vis = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(1500);
  const hiddenRms = await rmsN(page, 5, 300);
  console.log("hidden RMS:  ", hiddenRms.map(v => v.toFixed(4)).join(" "));

  // ── 2. fake visible again ──
  await page.evaluate(() => { window.__vis = "visible"; document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(3000);
  const backRms = await rmsN(page, 6, 300);
  console.log("return RMS:  ", backRms.map(v => v.toFixed(3)).join(" "));

  // ── 3. interruption: suspend the ctx with NO visibility event; the statechange
  // handler must mute + resume + restore on its own ──
  await page.evaluate(() => { window.handle.ctx.suspend(); });
  await page.waitForTimeout(4000);
  const healRms = await rmsN(page, 6, 300);
  const ctxState = await page.evaluate(() => window.handle.ctx.state);
  console.log("post-interruption RMS:", healRms.map(v => v.toFixed(3)).join(" "), "ctx.state:", ctxState);

  const T = await page.evaluate(() => stopLive());
  await browser.close();
  srv.close();

  const errs = [...T.errors, ...pageErrors];
  const basOk = baseline.filter(v => v > 0.001).length >= 4;
  const hidOk = Math.max(...hiddenRms) < 0.001;           // mute-at-source: true silence
  const retOk = backRms.filter(v => v > 0.001).length >= 4;
  const healOk = healRms.filter(v => v > 0.001).length >= 4 && ctxState === "running";
  console.log(`baseline audible: ${basOk}, hidden silent: ${hidOk}, return audible: ${retOk}, interruption self-heal: ${healOk}, errors: ${errs.length}`);
  if (errs.length) console.log("  " + errs.slice(0, 6).join("\n  "));
  const pass = basOk && hidOk && retOk && healOk && errs.length === 0;
  console.log(pass ? "BG-SURVIVAL PROBE: PASS" : "BG-SURVIVAL PROBE: FAIL");
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
