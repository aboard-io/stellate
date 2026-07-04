#!/usr/bin/env node
// macro-live-run.js — headless check that MACRO sliders bend the LIVE state
// mid-performance: go live on vaporwave, snapshot, drag two macro sliders
// (energy + space), assert the target rebuilds and the playing state glides
// toward it within ~2 bars, with zero page/engine errors.
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node faust/macro-live-run.js
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8793;

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  page.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });

  await page.goto(`http://localhost:${PORT}/explorer.html`);
  await page.waitForFunction(() => window.__X && window.__S);
  // place the cursor on vaporwave, then go live
  await page.evaluate(() => { const p = __X.POS.vaporwave; __X.retarget({ x: p[0], y: p[1] }); });
  await page.evaluate(() => __X.goLive());
  await page.waitForFunction(() => __S.barCount >= 2, { timeout: 30000 });
  const pre = await page.evaluate(() => ({ bar: __S.barCount, macros: { ...__S.macros },
    tReverb: __S.target.reverb, tBpm: __S.target.bpm, pReverb: __S.playing.reverb, pBpm: __S.playing.bpm }));
  // DRAG two sliders mid-play
  await page.evaluate(() => { __X.setMacro("energy", 0.8); __X.setMacro("space", 0.8); });
  const applied = await page.evaluate(() => ({ macros: { ...__S.macros },
    tReverb: __S.target.reverb, tBpm: __S.target.bpm }));
  const barAt = pre.bar;
  await page.waitForFunction(b => __S.barCount >= b + 2, barAt, { timeout: 30000 });
  const post = await page.evaluate(() => ({ bar: __S.barCount, pReverb: __S.playing.reverb, pBpm: __S.playing.bpm }));
  await page.evaluate(() => __X.stopLive());
  await page.waitForTimeout(400);
  await browser.close(); srv.close();

  const macroSet = applied.macros.energy === 0.8 && applied.macros.space === 0.8;
  const targetMoved = applied.tReverb > pre.tReverb + 1e-4 && applied.tBpm !== pre.tBpm;
  const playingGlided = post.pReverb > pre.pReverb + 1e-4;   // eased toward the wetter target
  const within2 = post.bar - pre.bar <= 3;                    // change observed within ~2 bars
  const noErr = errs.length === 0;

  console.log(`pre : bar ${pre.bar} target reverb ${pre.tReverb.toFixed(3)} bpm ${pre.tBpm} | playing reverb ${pre.pReverb.toFixed(3)}`);
  console.log(`drag: macros ${JSON.stringify(applied.macros)}`);
  console.log(`     target reverb ${pre.tReverb.toFixed(3)} -> ${applied.tReverb.toFixed(3)}, bpm ${pre.tBpm} -> ${applied.tBpm}`);
  console.log(`post: bar ${post.bar} (+${post.bar - pre.bar}) playing reverb ${pre.pReverb.toFixed(3)} -> ${post.pReverb.toFixed(3)}`);
  console.log(`errors: ${errs.length}${errs.length ? "\n  " + errs.slice(0, 8).join("\n  ") : ""}`);
  const pass = macroSet && targetMoved && playingGlided && within2 && noErr;
  console.log(`checks: macroSet=${macroSet} targetMoved=${targetMoved} playingGlided=${playingGlided} within2bars=${within2} noErrors=${noErr}`);
  console.log(`MACRO LIVE GATE: ${pass ? "PASS" : "FAIL"}`);
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
