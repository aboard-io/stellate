#!/usr/bin/env node
// faust/cpu-meter-shot.js — screenshot the live CPU meter (Paul asked for it).
// Drives explorer.html headless, goes live, waits for a few bars so the meter
// has a real load/node reading, and captures the bottom-right chrome.
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node faust/cpu-meter-shot.js
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8799;
const SHOT = path.join(ROOT, "scratch", "cpu-meter.png");

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1100, height: 850 });
  const errs = capturePageErrors(page);
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => window.__X && window.__S);
  await page.evaluate(() => { const p = __X.POS.vaporwave; __X.retarget({ x: p[0], y: p[1] }); });
  await page.evaluate(() => __X.goLive());
  // wait for real pools (node count), not bars — slow-bpm genres run ~8s/bar
  await page.waitForFunction(() => { const h = window.FaustLive && FaustLive.lastHandle;
    return h && h.nodeCount && h.nodeCount() >= 6; }, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);   // let cpuMeterTick (1Hz) paint a real reading
  const meter = await page.evaluate(() => {
    const el = document.getElementById("cpu");
    return { visible: getComputedStyle(el).display !== "none",
      text: el.innerText.replace(/\n/g, " "), color: getComputedStyle(el).color };
  });
  // tight crop around the meter + chips
  await page.screenshot({ path: SHOT, clip: { x: 760, y: 700, width: 340, height: 150 } });
  await page.evaluate(() => __X.stopLive()).catch(() => {});
  await page.waitForTimeout(1600);   // the meter tick is 1Hz — give it a full beat to hide
  const hiddenAfterStop = await page.evaluate(() => getComputedStyle(document.getElementById("cpu")).display === "none");
  await browser.close(); srv.close();
  console.log(`meter visible live: ${meter.visible}  text: "${meter.text}"  color: ${meter.color}`);
  console.log(`meter hidden after stop: ${hiddenAfterStop}`);
  console.log(`errors: ${errs.filter(e => !/archive|CORS|net::|found|ERR_FAILED|Failed to load/.test(e)).length}`);
  console.log(`screenshot -> ${SHOT}`);
  process.exit(meter.visible && hiddenAfterStop ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
