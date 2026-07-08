#!/usr/bin/env node
// faust/wavout-test-run.js — headless WAV-FIRST gate (gate 3, updated for v3).
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node faust/wavout-test-run.js
//
// TWO passes in chromium (the pinned build), both booting faust/live-test.html with
// ?wavOut=1 (forces the WAV-FIRST audible path on desktop chromium — the test hatch):
//
//   PASS A — mse-mp3 (v3 default). ONE <audio> element fed a continuous MP3 stream via
//     classic MediaSource (chromium has no ManagedMediaSource; that's the iOS device
//     path). Asserts: outputRoute "mse-mp3", single element, boots to sound, RMS sampled
//     tightly (100ms) with NO silent run >= 300ms across >= 3 append batches + a SECTION
//     boundary + a genre STEER (new gen opens + its audio plays), buffered range bounded
//     (< 120s), zeroPlayable == 0, zero console/page errors.
//   PASS B — ?segAB=1 (the v2 A/B element fallback). Asserts the v2 path still passes its
//     v2 criteria: outputRoute "segAB", boots, continuity with >= 3 seam crossings, a
//     section boundary + steer, zeroPlayable == 0, zero errors.
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");

const ROOT = path.join(__dirname, "..");
const PORT = 8794;

// tight in-page RMS sampler that also snapshots the wavOut segment/gen/buffer state.
const sample = (page, n, gapMs) => page.evaluate(async ({ n, gapMs }) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    let rms = 0, st = null;
    try { rms = window.handle.rms(); } catch (e) {}
    try { st = window.handle.__wavState ? window.handle.__wavState() : null; } catch (e) {}
    out.push({ t: performance.now() / 1000, rms, segs: st ? st.receivedSegs : 0, gen: st ? st.curGen : 0,
      cursor: st ? st.playCursor : -1, single: st ? st.singleEl : false, buffered: st ? (st.bufferedSec || 0) : 0 });
    await new Promise((r) => setTimeout(r, gapMs));
  }
  return out;
}, { n, gapMs });

async function runPass(browser, url, label, expectRoute, checkDrift) {
  const page = await browser.newPage();
  const pageErrors = capturePageErrors(page);
  await page.goto(url);
  console.log(`\n[${label}] page loaded (${url}); going live (wavOut) on jungle…`);
  await page.evaluate(() => goLive("jungle", 3));
  await page.waitForTimeout(11000);
  const preSwap = await sample(page, 70, 100);   // ~7s tight sampling across batches/seams
  const before = await page.evaluate(() => window.handle.__wavState());
  const seg0 = await page.evaluate(() => window.handle.segStats());
  const route = await page.evaluate(() => window.handle.outputRoute);
  console.log(`[${label}] route ${route}; pre-swap gen ${before.curGen}, segs ${before.receivedSegs}, cursor ${before.playCursor}, singleEl ${before.singleEl}, zeroPlayable ${seg0.zeroPlayable}`);

  await page.evaluate(() => swapTo("house", 3));
  console.log(`[${label}] steered to house; sampling across the cutover…`);
  const postSwap = await sample(page, 110, 100);   // ~11s across the cutover + new-gen flow
  const after = await page.evaluate(() => window.handle.__wavState());
  const segS = await page.evaluate(() => window.handle.segStats());
  console.log(`[${label}] post-steer gen ${after.curGen}, segs ${after.receivedSegs}, cursor ${after.playCursor}, singleEl ${after.singleEl}, zeroPlayable ${segS.zeroPlayable}`);

  // v4 LURCH GATE (fMP4 route): extend to a 30s+ run and assert stitchDriftSec stays
  // < 0.05 — with explicit tfdt the UA can't infer/drift timestamps (mms-mp3's defect).
  let finalW = after, driftOk = true;
  if (checkDrift) {
    await page.waitForTimeout(9000);
    finalW = await page.evaluate(() => window.handle.__wavState());
    driftOk = finalW.stitchDriftSec != null && Math.abs(finalW.stitchDriftSec) < 0.05;
    console.log(`[${label}] LURCH: appendedSec ${finalW.appendedSec}, bufferedEnd ${(finalW.bufferedEnd || 0).toFixed(2)}, stitchDriftSec ${finalW.stitchDriftSec} (< 0.05: ${driftOk})`);
  }

  const bars = await page.evaluate(() => window.TEST.bars.map((b) => b.section));
  const boot = await page.evaluate(() => window.handle.bootStats ? window.handle.bootStats() : null);
  const T = await page.evaluate(() => stopLive());
  await page.waitForTimeout(300);
  await page.close();

  const all = preSwap.concat(postSwap);
  const errs = [...T.errors, ...pageErrors];

  // v3.1: first sound must arrive within a generous-but-real bound (open-immediately +
  // stream-buffers-in means boot no longer waits on any found/sampler fetch).
  const FIRST_SOUND_BOUND_MS = 8000;
  const firstSoundOk = !!boot && boot.firstSound > 0 && boot.firstSound <= FIRST_SOUND_BOUND_MS;

  const bootOk = preSwap.filter((s) => s.rms > 0.001).length >= 6;
  let seams = 0; for (let i = 1; i < all.length; i++) if (all[i].cursor > all[i - 1].cursor) seams++;
  const started = all.findIndex((s) => s.rms > 0.001);
  let worstRun = 0, run = 0;
  for (let i = Math.max(0, started); i < all.length; i++) {
    if (all[i].rms <= 0.0008) { run++; worstRun = Math.max(worstRun, run); } else run = 0;
  }
  const continuityOk = started >= 0 && worstRun < 3 && seams >= 3;
  const sections = [...new Set(bars.filter(Boolean))];
  const sectionOk = sections.length >= 2;
  const swapTookEffect = after.curGen > before.curGen && after.receivedSegs > before.receivedSegs;
  const noStall = (segS.zeroPlayable || 0) === 0;
  const routeOk = route === expectRoute;
  const appendRoute = /^(mms|mse)-/.test(expectRoute);   // the continuous single-element append routes
  const singleOk = appendRoute ? all.every((s) => s.single) : true;
  const maxBuffered = Math.max(0, ...all.map((s) => s.buffered || 0));
  const bufferedOk = appendRoute ? (maxBuffered > 0 && maxBuffered < 120) : true;
  const nzFrac = all.filter((s) => s.rms > 0.001).length / all.length;

  console.log(`[${label}] RMS samples ${all.length}, nonzero ${(nzFrac * 100).toFixed(0)}%, longest silent run ${worstRun} (x100ms), batches/seams ${seams}, max buffered ${maxBuffered.toFixed(1)}s`);
  console.log(`[${label}] sections: [${sections.join(", ")}]`);
  console.log(`[${label}] boot stages (ms): ${boot ? JSON.stringify(boot) : "n/a"}; firstSound<=${FIRST_SOUND_BOUND_MS}:${firstSoundOk}`);
  console.log(`[${label}] route(${expectRoute}):${routeOk} boot:${bootOk} continuity:${continuityOk} section:${sectionOk} steer:${swapTookEffect} single:${singleOk} bounded:${bufferedOk} noStall:${noStall}${checkDrift ? " drift<0.05:" + driftOk : ""}`);
  console.log(`[${label}] errors: ${errs.length}${errs.length ? "\n  " + errs.slice(0, 8).join("\n  ") : ""}`);

  const pass = routeOk && bootOk && continuityOk && sectionOk && swapTookEffect && singleOk && bufferedOk && noStall && firstSoundOk && driftOk && errs.length === 0;
  console.log(`[${label}] ${pass ? "PASS" : "FAIL"}`);
  return pass;
}

// PASS C — mmsStall injection. A shimmed ManagedMediaSource whose sourceopen never
// fires must AUTO-recover to segAB (no manual action) and still make sound. With the v4.1
// ladder, a sourceopen-never-fires walks the codec tiers first (each re-attach also stalls),
// so the expected errors are the "codec step-down x->y" transition lines PLUS exactly one
// terminal "demote->segAB" once the ladder is exhausted — and nothing else.
async function runStallPass(browser, url) {
  const page = await browser.newPage();
  const pageErrors = capturePageErrors(page);
  await page.goto(url);
  console.log(`\n[mmsStall] page loaded (${url}); going live (wavOut, stalled MMS)…`);
  await page.evaluate(() => goLive("jungle", 3));
  await page.waitForTimeout(17000);   // ladder walk (per-tier 4s sourceopen watchdogs) + segAB sound
  const samples = await sample(page, 50, 100);
  const st = await page.evaluate(() => window.handle.__wavState());
  const route = await page.evaluate(() => window.handle.outputRoute);
  const boot = await page.evaluate(() => window.handle.bootStats());
  const T = await page.evaluate(() => stopLive());
  await page.waitForTimeout(300);
  await page.close();

  const errs = [...T.errors, ...pageErrors];
  const demoteErrs = errs.filter((e) => /demote->segAB/.test(e));
  const stepErrs = errs.filter((e) => /codec step-down/.test(e));
  const otherErrs = errs.filter((e) => !/demote->segAB/.test(e) && !/codec step-down/.test(e));
  const demotedOk = st.demoted === true;
  const routeOk = route === "segAB";
  const soundOk = samples.filter((s) => s.rms > 0.001).length >= 6;
  const errsOk = demoteErrs.length === 1 && otherErrs.length === 0;

  console.log(`[mmsStall] route ${route}, demoted ${st.demoted} (${st.demoteReason || ""}), segs ${st.receivedSegs}, boot ${JSON.stringify(boot)}`);
  console.log(`[mmsStall] nonzero RMS samples ${samples.filter((s) => s.rms > 0.001).length}/${samples.length}`);
  console.log(`[mmsStall] step-downs ${stepErrs.length}${stepErrs.length ? " [" + stepErrs.join(" | ") + "]" : ""}, demote errors ${demoteErrs.length}, other errors ${otherErrs.length}${otherErrs.length ? "\n  " + otherErrs.slice(0, 8).join("\n  ") : ""}`);
  console.log(`[mmsStall] demoted:${demotedOk} route(segAB):${routeOk} sound:${soundOk} exactlyOneDemoteErr:${errsOk}`);

  const pass = demotedOk && routeOk && soundOk && errsOk;
  console.log(`[mmsStall] ${pass ? "PASS" : "FAIL"}`);
  return pass;
}

// PASS D — runtime codec step-down (v4.1 item 3). A shim (installed in live-test.html via
// ?failCodec=opus BEFORE live.js loads) throws on the FIRST appendBuffer for the opus
// SourceBuffer — the device's mms-aac first-append symptom, reproduced on chromium's opus
// route. The conductor must walk opus → mp3 on the SAME element, land mse-mp3 with sound
// (NOT segAB, NOT demoted), and emit exactly the expected diagnostics: one mp4diag line +
// one "codec step-down opus->mp3" line, nothing else.
async function runStepDownPass(browser, url) {
  const page = await browser.newPage();
  const pageErrors = capturePageErrors(page);
  await page.goto(url);
  console.log(`\n[stepDown] page loaded (${url}); going live (wavOut, opus first-append forced-fail)…`);
  await page.evaluate(() => goLive("jungle", 3));
  await page.waitForTimeout(12000);   // opus first-append throws → step down to mp3 → sound
  const samples = await sample(page, 40, 100);
  const st = await page.evaluate(() => window.handle.__wavState());
  const route = await page.evaluate(() => window.handle.outputRoute);
  const T = await page.evaluate(() => stopLive());
  await page.waitForTimeout(300);
  await page.close();

  const errs = [...T.errors, ...pageErrors];
  const stepErrs = errs.filter((e) => /codec step-down opus->mp3/.test(e));
  const diagErrs = errs.filter((e) => /^mp4diag /.test(e));
  const otherErrs = errs.filter((e) => !/codec step-down opus->mp3/.test(e) && !/^mp4diag /.test(e));
  const routeOk = route === "mse-mp3";
  const notDemoted = st.demoted !== true;
  const soundOk = samples.filter((s) => s.rms > 0.001).length >= 6;
  // the mp4diag must be the opus one, correctly codec-gated: adts=no (opus has no ADTS),
  // and a real init segment captured before the throw.
  const diag = diagErrs[0] || "";
  const diagOk = diagErrs.length === 1 && /codec=opus/.test(diag) && /adts=no/.test(diag) && /init=\d+B/.test(diag) && !/init=0B/.test(diag);
  const errsOk = stepErrs.length === 1 && otherErrs.length === 0;

  console.log(`[stepDown] route ${route}, demoted ${st.demoted}, segs ${st.receivedSegs}, appendedSec ${st.appendedSec}`);
  console.log(`[stepDown] nonzero RMS samples ${samples.filter((s) => s.rms > 0.001).length}/${samples.length}`);
  console.log(`[stepDown] mp4diag: ${diag || "(none)"}`);
  console.log(`[stepDown] step-downs ${stepErrs.length}, diag lines ${diagErrs.length}, other errors ${otherErrs.length}${otherErrs.length ? "\n  " + otherErrs.slice(0, 8).join("\n  ") : ""}`);
  console.log(`[stepDown] route(mse-mp3):${routeOk} notDemoted:${notDemoted} sound:${soundOk} diag:${diagOk} exactlyOneStepDown:${errsOk}`);

  const pass = routeOk && notDemoted && soundOk && diagOk && errsOk;
  console.log(`[stepDown] ${pass ? "PASS" : "FAIL"}`);
  return pass;
}

// probe the pinned chromium's WebCodecs AudioEncoder for opus IN A WORKER (the fMP4 gate
// route). Chromium ships opus encode; if a future build drops it, SKIP the fMP4 pass
// LOUDLY with instructions rather than failing the whole gate on a missing capability.
async function probeOpusEncode(browser) {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/faust/live-test.html`);
  const ok = await page.evaluate(async () => {
    const src = `self.onmessage = async () => { let ok=false; try { if (typeof AudioEncoder!=="undefined") ok = !!(await AudioEncoder.isConfigSupported({codec:"opus",sampleRate:44100,numberOfChannels:2,bitrate:192000})).supported; } catch(e){} self.postMessage(ok); };`;
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
    return await new Promise((r) => { w.onmessage = (e) => r(e.data); w.postMessage(0); });
  });
  await page.close();
  return ok;
}

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const base = `http://localhost:${PORT}/faust/live-test.html?wavOut=1&segSec=4&firstSegSec=3`;

  // PASS 0 — fMP4 (mse-opus): chromium lacks AAC ENCODE, so force ?codec=opus (identical
  // muxer/append, opus codec string). Asserts route mse-opus + the LURCH gate (stitchDriftSec
  // < 0.05 over a 30s+ run with a steer) — explicit tfdt vs. mms-mp3's inferred timestamps.
  const opusCap = await probeOpusEncode(browser);
  let fmp4 = true;
  if (opusCap) fmp4 = await runPass(browser, base + "&codec=opus", "mse-opus", "mse-opus", true);
  else console.log(`\n[mse-opus] *** SKIP: this chromium's worker AudioEncoder lacks opus encode. The fMP4 lurch gate could not run.\n  To run it, use a chromium build with WebCodecs opus encode (the pinned ms-playwright chromium-1217 ships it). On a real device the route is mms-aac/mse-aac (AAC encode present).`);

  // PASS A — mse-mp3 (v3, now a lower tier): force ?codec=mp3 (default would pick opus).
  const a = await runPass(browser, base + "&codec=mp3", "mse-mp3", "mse-mp3");
  // PASS B — segAB (v2 A/B element fallback).
  const b = await runPass(browser, base + "&segAB=1", "segAB", "segAB");
  // PASS C — mmsStall injection → ladder walk → auto-demotion to segAB.
  const c = await runStallPass(browser, base + "&mmsStall=1");
  // PASS D — runtime codec step-down: opus first-append forced-fail → lands mse-mp3 (v4.1).
  // Needs the opus encoder (the forced tier) to exist; skip loudly if this build lacks it.
  let d = true;
  if (opusCap) d = await runStepDownPass(browser, base + "&codec=opus&failCodec=opus");
  else console.log(`\n[stepDown] *** SKIP: no worker opus encode in this chromium, so the opus tier can't be exercised.`);
  await browser.close();
  srv.close();

  const pass = fmp4 && a && b && c && d;
  console.log(`\nWAVOUT GATE (mse-opus fMP4 lurch${opusCap ? "" : " SKIPPED"} + mse-mp3 forced + segAB fallback + mmsStall ladder→demote + step-down${opusCap ? "" : " SKIPPED"}): ${pass ? "PASS" : "FAIL"}`);
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
