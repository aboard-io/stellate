#!/usr/bin/env node
// video-export-probe.js — smoke test for E (video export): go live, record a few
// seconds of the composited demoscene+video+audio via MediaRecorder, assert a
// non-empty webm Blob comes back. MediaRecorder is real-browser only, so this may
// not run under some headless configs — a clean "unsupported" is reported, not a
// hard fail on the code.
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node test/video-export-probe.js
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8803;

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 850 });
  const errs = capturePageErrors(page);
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); return c; };

  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => window.__X && window.__S && window.__VIDEO, { timeout: 20000 });
  await page.waitForTimeout(400);

  // the ⏺ video button exists in the settings panel
  const hasBtn = await page.evaluate(() => {
    document.getElementById("cfgChip").click();
    return [...document.querySelectorAll(".btns button")].some(b => /video/i.test(b.textContent));
  });
  ok(hasBtn, "V1: no ⏺ video button in the export row");

  // MediaRecorder support in this headless build?
  const mrOk = await page.evaluate(() => {
    if (typeof MediaRecorder === "undefined") return false;
    try { return ["video/webm;codecs=vp8,opus", "video/webm"].some(m => MediaRecorder.isTypeSupported(m)); } catch (e) { return false; }
  });

  // go live so there's audio + visuals to capture
  await page.evaluate(() => __X.goLive());
  await page.waitForFunction(() => window.__S.playing, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const res = await page.evaluate(async () => {
    try {
      const blob = await window.__VIDEO.recordVideo({ seconds: 6, noDownload: true });
      const V = window.__VIDEO.VIDEO || {};
      return { size: blob ? blob.size : 0, type: blob ? blob.type : null, status: window.__S.status,
        frames: V.frames || 0, hadAudio: !!V.hadAudio };
    } catch (e) { return { err: String(e) }; }
  });

  console.log(`\n=== VIDEO-EXPORT PROBE ===`);
  console.log(`  button=${hasBtn}  MediaRecorder=${mrOk}`);
  console.log(`  record -> size=${res.size || 0}B frames=${res.frames} audio=${res.hadAudio} type=${res.type || "-"} status="${res.status || res.err || ""}"`);

  if (mrOk) {
    ok(!res.err, `V2: recordVideo threw: ${res.err}`);
    // ~6 s at 30 fps ⇒ ~180 composited frames pushed (not a static one-frame file)
    ok((res.frames || 0) > 120, `V3: too few frames captured (${res.frames}) — the compositor isn't producing motion`);
    ok(res.hadAudio, `V4: NO audio track in the recording (audioStream/mediaEl both empty)`);
    // real animated 960×540 vp9 for 6 s is well over 100 KB (the broken take was a near-static ~200 KB)
    ok((res.size || 0) > 100000, `V5: video blob suspiciously small (${res.size}B) — likely near-static`);
  } else {
    console.log("  (MediaRecorder unavailable in this headless build — needs a real browser)");
  }
  const otherErrs = errs.filter(e => !/AudioContext|autoplay|user gesture/i.test(e));
  ok(otherErrs.length === 0, `page errors: ${otherErrs.join(" | ")}`);

  await browser.close(); srv.close();
  if (fails.length) { console.log(`\nFAIL:\n  ${fails.join("\n  ")}`); process.exit(1); }
  console.log(`\nVIDEO-EXPORT PROBE: PASS`);
}
main().catch(e => { console.error(e); process.exit(1); });
