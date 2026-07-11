#!/usr/bin/env node
// video-export-probe.js — smoke test for E (video export): go live, record a few
// seconds of the composited demoscene+video+audio via MediaRecorder, assert a
// non-empty video Blob comes back — PLUS the 2026-07-11 hardening:
//   * HARD-FAIL if MediaRecorder is missing in an env that SHOULD have it (the
//     pinned chromium-1217 does — a silent "unsupported" skip is how the earlier
//     1-frame regression shipped green).
//   * TAINT regression: tell the exporter the front clip is REMOTE (cross-origin)
//     and assert it DEGRADES to a non-empty demo-only file instead of compositing a
//     (silently taint-poisoned) video track.
//   * CONTAINER/EXTENSION: assert the download ext is derived from the recorder's
//     real mimeType (webm/mp4), not hard-coded.
//   * BACKGROUND-TAB: assert recording is REFUSED while the tab is hidden.
// MediaRecorder + canvas.captureStream are desktop-Chromium-shaped; what still needs
// a REAL browser/device is listed at the bottom of this file.
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

  // the ⤓ video button exists in the settings panel
  const hasBtn = await page.evaluate(() => {
    document.getElementById("cfgChip").click();
    return [...document.querySelectorAll(".btns button")].some(b => /video/i.test(b.textContent));
  });
  ok(hasBtn, "V1: no video button in the export row");

  // MediaRecorder + captureStream support. This pinned chromium HAS both; a missing
  // MediaRecorder here is an environment/regression failure, NOT a clean skip.
  const cap = await page.evaluate(() => ({
    mr: typeof MediaRecorder !== "undefined",
    webm: (typeof MediaRecorder !== "undefined") && (() => { try { return ["video/webm;codecs=vp8,opus", "video/webm"].some(m => MediaRecorder.isTypeSupported(m)); } catch (e) { return false; } })(),
    canRecord: !!(window.__VIDEO.canRecord && window.__VIDEO.canRecord()),
  }));
  ok(cap.mr, "V0: MediaRecorder MISSING in the pinned chromium — this path is unguarded headless (hard fail, not a silent skip)");
  ok(cap.canRecord, "V0b: canRecord() is false in an env that supports canvas.captureStream");

  // go live so there's audio + visuals to capture
  await page.evaluate(() => __X.goLive());
  await page.waitForFunction(() => window.__S.playing, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // ── main foreground take ──────────────────────────────────────────────────
  const res = await page.evaluate(async () => {
    try {
      const blob = await window.__VIDEO.recordVideo({ seconds: 6, noDownload: true });
      const V = window.__VIDEO.VIDEO || {};
      return { size: blob ? blob.size : 0, type: blob ? blob.type : null, status: window.__S.status,
        frames: V.frames || 0, hadAudio: !!V.hadAudio, mime: V.mime || null, ext: V.ext || null,
        videoComposited: !!V.videoComposited };
    } catch (e) { return { err: String(e) }; }
  });

  console.log(`\n=== VIDEO-EXPORT PROBE ===`);
  console.log(`  button=${hasBtn}  MediaRecorder=${cap.mr}  webm=${cap.webm}  canRecord=${cap.canRecord}`);
  console.log(`  record -> size=${res.size || 0}B frames=${res.frames} audio=${res.hadAudio} type=${res.type || "-"} mime=${res.mime || "-"} ext=${res.ext || "-"} videoComposited=${res.videoComposited} status="${res.status || res.err || ""}"`);

  ok(!res.err, `V2: recordVideo threw: ${res.err}`);
  // ~6 s at 30 fps ⇒ ~180 composited frames pushed (not a static one-frame file)
  ok((res.frames || 0) > 120, `V3: too few frames captured (${res.frames}) — the compositor isn't producing motion`);
  ok(res.hadAudio, `V4: NO audio track in the recording (audioStream/mediaEl both empty)`);
  // real animated 960×540 for 6 s is well over 100 KB (the broken take was near-static)
  ok((res.size || 0) > 100000, `V5: video blob suspiciously small (${res.size}B) — likely near-static`);

  // ── container/extension derived from the recorder's real mimeType ──────────
  const extForMime = (mt) => { mt = String(mt || "").toLowerCase(); return mt.indexOf("mp4") >= 0 ? "mp4" : "webm"; };
  ok(res.mime && /^video\//.test(res.mime), `V6: no container mimeType recorded (${res.mime})`);
  ok(["webm", "mp4"].includes(res.ext), `V7: bad download extension "${res.ext}"`);
  ok(res.ext === extForMime(res.mime), `V8: extension "${res.ext}" does not match container "${res.mime}"`);
  ok(res.type && extForMime(res.type) === res.ext, `V9: Blob type "${res.type}" inconsistent with ext "${res.ext}"`);

  // ── taint regression: front clip is REMOTE (cross-origin) → must NOT composite ──
  // Even with a ready <video> present, a remote-kind source must be skipped (drawImage
  // of a cross-origin <video> silently taints the canvas and yields a broken blob). The
  // take must degrade to a non-empty DEMO-ONLY file with videoComposited=false.
  const taint = await page.evaluate(async () => {
    const VL = window.VideoLayer; if (!VL) return { skip: "no VideoLayer" };
    const origKind = VL._frontKind, origEl = VL._frontEl;
    VL._frontKind = () => "remote";
    VL._frontEl = () => ({ readyState: 2, videoWidth: 640, videoHeight: 480 });   // ready, but remote → gate must skip it
    let out;
    try {
      const blob = await window.__VIDEO.recordVideo({ seconds: 3, noDownload: true });
      const V = window.__VIDEO.VIDEO || {};
      out = { size: blob ? blob.size : 0, videoComposited: !!V.videoComposited, err: null };
    } catch (e) { out = { err: String(e) }; }
    VL._frontKind = origKind; VL._frontEl = origEl;
    return out;
  });
  console.log(`  taint(remote front) -> size=${taint.size || 0}B videoComposited=${taint.videoComposited} ${taint.err ? "err=" + taint.err : ""}`);
  ok(!taint.err && !taint.skip, `V10: taint-regression take errored: ${taint.err || taint.skip}`);
  ok((taint.size || 0) > 1000, `V11: degraded (demo-only) take is empty (${taint.size}B) — should still record the demoscene+audio`);
  ok(taint.videoComposited === false, `V12: a REMOTE (cross-origin) clip was composited — silent-taint gate is broken`);

  // ── background-tab guard: recording must be REFUSED while hidden ────────────
  const hidden = await page.evaluate(async () => {
    const desc = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
    Object.defineProperty(document, "visibilityState", { get: () => "hidden", configurable: true });
    let blob, status;
    try { blob = await window.__VIDEO.recordVideo({ seconds: 3, noDownload: true }); status = window.__S.status; }
    finally { delete document.visibilityState; if (desc) Object.defineProperty(document, "visibilityState", desc); }
    return { refused: blob === null, status };
  });
  console.log(`  hidden-tab -> refused=${hidden.refused} status="${hidden.status}"`);
  ok(hidden.refused, `V13: recording was NOT refused while the tab was hidden`);
  ok(/foreground/i.test(hidden.status || ""), `V14: hidden-tab refusal lacks a "keep foreground" message (got "${hidden.status}")`);

  const otherErrs = errs.filter(e => !/AudioContext|autoplay|user gesture/i.test(e));
  ok(otherErrs.length === 0, `page errors: ${otherErrs.join(" | ")}`);

  await browser.close(); srv.close();
  if (fails.length) { console.log(`\nFAIL:\n  ${fails.join("\n  ")}`); process.exit(1); }
  console.log(`\nVIDEO-EXPORT PROBE: PASS`);
  console.log(`\nBROWSER/DEVICE-PENDING (cannot be proven headless):`);
  console.log(`  * Safari mp4 container path (pickMime -> video/mp4; ext/type derivation exercised only on webm here).`);
  console.log(`  * iOS Safari DISABLE path (no canvas.captureStream) — canRecord()===false is asserted, but the real-device UX is unverified.`);
  console.log(`  * A REAL remote archive.org <video> tainting the canvas (network + CORP/COEP dependent); the gate is proven via a forced remote _frontKind here.`);
  console.log(`  * Real background-throttle behaviour (~1fps) — we assert the REFUSAL, not the throttle itself.`);
}
main().catch(e => { console.error(e); process.exit(1); });
