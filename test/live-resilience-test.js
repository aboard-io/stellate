#!/usr/bin/env node
// faust/live-resilience-test.js — the WAV-FIRST DECODE-THEN-RENDER gate (iOS pitched-voice bug).
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node faust/live-resilience-test.js
//
// Reproduces + guards THE core-experience bug (Paul, iPhone device tests): the NEW wav engine
// survives backgrounding but plays only drums+bass — the sampled melody/pad/lead voices are
// SILENT — and stalls. Root cause: the v3.1 wav producer opened with EMPTY sample buffers and
// baked bars IMMEDIATELY, relying on an addBuffers "pop-in" to fill FUTURE bars. But the
// bakeNative found/sampler layers are filtered/summed against the buffer table AT bake time
// (stream-renderer), so a bar baked+encoded+appended BEFORE its sample decoded is PERMANENTLY
// silent for that voice. On iOS decodeAudioData is slow enough that most pitched-sample bars
// baked silent. Chromium/node decode fast, so the bug never showed on the dev box.
//
// THE FIX (this gate proves it): the producer now DECODES this gen's needed found/sampler PCM
// through the shared concurrency gate BEFORE it opens, and ships the decoded buffers in the
// open payload — so the buffers are present from bar 0, mirroring the proven-good ring path
// (which decodes JIT and never renders a bar until its buffers are ready). A brief capped boot
// "decoding…" wait is accepted (completeness over instant start). `?decodeFirst=0` reverts to
// the v3.1 open-immediately behaviour — the SAME shipped code runs BOTH modes, so the before/
// after is baked into ONE gate (no git-stash needed).
//
// We drive the real live wav path in the pinned chromium (?wavOut=1&codec=mp3 = the single-
// element MSE append route with a GLOBAL currentTime timeline) and MONKEYPATCH the decode path
// (FaustSampler.decodeUrlRaw + FoundPlayer.decodeUrlToBuffer) to model iOS: ~1.2 s per decode,
// a fraction of transient (first-attempt) drops, and a live in-flight counter. Two scenes:
//
//   PITCHED — spokenword (bed + felt_piano/sax samplers — a pitched-sampler-heavy, low-synth-
//     floor genre) under an iOS decode storm, run BOTH ways on the same code. Because the
//     arrangement is DETERMINISTIC (same seed), the sampled layer's energy is isolated by
//     comparing RMS at the SAME global currentTime across the two modes. ASSERT (the "present
//     from the start, not eventually" proof): decode-then-render ordering holds ON (firstSound
//     ≥ decodeDone — buffers baked, not popped-in) and is VIOLATED OFF (opens before decode);
//     the early sampled-layer presence (RMS over currentTime 0.5–5 s) is materially HIGHER ON
//     than OFF; the conductor CAPS decode concurrency and RETRIES transient drops (zero
//     permanently-failed voices); audio is continuous across a genre STEER (no permanent voice
//     loss); zero console errors.
//   STALL — electro seed1 (vocoder + sp_system speech carrier): the carrier decodes SLOWLY
//     (9 s) but the open must NOT block on it (found/sampler decode-then-render never waits on
//     the ONE carrier). ASSERT first sound arrives well before the carrier, the carrier folds
//     in, and there is no long silent run.
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");

const ROOT = path.join(__dirname, "..");
const PORT = 8796;

// the fault injector, installed IN-PAGE before goLive (after the modules load). Wraps the two
// decode entry points the conductor calls; adds latency + transient failures + tracks the live
// in-flight count so the test can prove the conductor's concurrency cap holds.
function installFault(cfg) {
  const inj = { maxInFlight: 0, inFlight: 0, calls: 0, fails: 0, byUrl: {}, done: 0 };
  window.__inj = inj;
  const hash = (s) => { let a = 7; for (let i = 0; i < s.length; i++) a = (a * 31 + s.charCodeAt(i)) >>> 0; return a; };
  const wrap = (obj, key) => {
    if (!obj || typeof obj[key] !== "function" || obj["__wrapped_" + key]) return;
    const orig = obj[key];
    obj["__wrapped_" + key] = true;
    obj[key] = function (ctx, url) {
      inj.calls++;
      const isSpeech = /speech\//.test(url);
      const isSampler = key === "decodeUrlRaw";
      const attempts = (inj.byUrl[url] = (inj.byUrl[url] || 0) + 1);
      inj.inFlight++; if (inj.inFlight > inj.maxInFlight) inj.maxInFlight = inj.inFlight;
      const fin = () => { inj.inFlight--; inj.done++; };
      // latency model: speech is very slow (the carrier); sampler/found is the iOS ~1.2 s decode
      // (a slow SUBSET even slower, if cfg.slowPct set) — slow ENOUGH to outlast the producer's
      // bake-ahead window, so an open-immediately producer bakes early bars before they decode.
      let lat;
      if (isSpeech) lat = cfg.speechLat;
      else { const slow = cfg.slowPct && (hash(url) % 100) < cfg.slowPct; lat = slow ? cfg.slowLatMin + Math.random() * (cfg.slowLatMax - cfg.slowLatMin) : cfg.latMin + Math.random() * (cfg.latMax - cfg.latMin); }
      // transient failure: a fraction of sampler/found urls reject on their first attempt(s),
      // succeeding on retry — the iOS "decode dropped under contention" case.
      const failThis = (isSampler || key === "decodeUrlToBuffer") && !isSpeech && (hash(url + "f") % 100) < cfg.failPct;
      return new Promise((res, rej) => {
        setTimeout(() => {
          if (failThis && attempts <= cfg.failAttempts) { inj.fails++; fin(); rej(new Error("injected iOS decode drop attempt " + attempts)); return; }
          Promise.resolve().then(() => orig.call(this, ctx, url)).then((b) => { fin(); res(b); }, (e) => { fin(); rej(e); });
        }, lat);
      });
    };
  };
  wrap(window.FaustSampler, "decodeUrlRaw");
  wrap(window.FoundPlayer, "decodeUrlToBuffer");
  return true;
}

// RMS + global-currentTime sampler (mp3 route has a continuous timeline), plus decode forensics.
const sample = (page, n, gapMs) => page.evaluate(async ({ n, gapMs }) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    let rms = 0, st = null, inj = null;
    try { rms = window.handle.rms(); } catch (e) {}
    try { st = window.handle.__wavState ? window.handle.__wavState() : null; } catch (e) {}
    try { inj = window.__inj ? { maxInFlight: window.__inj.maxInFlight, inFlight: window.__inj.inFlight, fails: window.__inj.fails } : null; } catch (e) {}
    out.push({ t: performance.now() / 1000, rms, ct: st ? (st.currentTime || 0) : 0,
      route: st ? st.outputRoute : "?",
      samplerOk: st && st.decode ? st.decode.sampler.ok : 0, samplerFail: st && st.decode ? st.decode.sampler.fail : 0,
      gateMax: st && st.decode ? (st.decode.maxInFlight || 0) : 0, gateLimit: st && st.decode ? (st.decode.limit || 0) : 0,
      injMax: inj ? inj.maxInFlight : 0, injFails: inj ? inj.fails : 0 });
    await new Promise((r) => setTimeout(r, gapMs));
  }
  return out;
}, { n, gapMs });

// mean RMS over a GLOBAL-currentTime window [a,b) — the same music both modes (deterministic
// seed), so the delta isolates the sampled layer's contribution at matched song position.
function ctWindowMean(rows, a, b) {
  const xs = rows.filter((r) => r.ct >= a && r.ct < b).map((r) => r.rms);
  return { mean: xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : 0, n: xs.length };
}
// longest run of near-silence once sound starts, in samples (each `gapMs` apart).
function worstSilentRun(rows, gapMs) {
  const started = rows.findIndex((s) => s.rms > 0.002);
  if (started < 0) return { worstMs: rows.length * gapMs, startedIdx: -1 };
  let worst = 0, run = 0;
  for (let i = started; i < rows.length; i++) { if (rows[i].rms <= 0.0008) { run++; worst = Math.max(worst, run); } else run = 0; }
  return { worstMs: worst * gapMs, startedIdx: started };
}

// drive ONE mode (decodeFirst on/off) of the PITCHED scene: boot spokenword under the decode
// storm, sample the opening on a global timeline, STEER to jazz, keep sampling. Returns the
// measured discriminators.
async function pitchedMode(browser, base, decodeFirst) {
  const page = await browser.newPage();
  const errs0 = capturePageErrors(page);
  await page.goto(base + "&codec=mp3&decodeFirst=" + decodeFirst + "&bootDecodeCap=13000&genDecodeCap=8000");
  await page.evaluate(installFault, { latMin: 1150, latMax: 1250, slowPct: 0, slowLatMin: 0, slowLatMax: 0,
    speechLat: 0, failPct: 15, failAttempts: 1 });
  await page.evaluate(() => goLive("spokenword", 3));
  const r1 = await sample(page, 240, 80);     // ~19 s: boot + the opening (global currentTime ~0..10)
  const steerFailBefore = await page.evaluate(() => window.handle.__wavState().decode.sampler.fail);
  await page.evaluate(() => swapTo("jazz", 3));  // STEER to a new sampled genre — the gen cutover
  const r2 = await sample(page, 170, 80);     // ~14 s across the cutover
  const st = await page.evaluate(() => window.handle.__wavState());
  const boot = await page.evaluate(() => window.handle.bootStats());
  const inj = await page.evaluate(() => ({ maxInFlight: window.__inj.maxInFlight, fails: window.__inj.fails }));
  const T = await page.evaluate(() => stopLive());
  await page.waitForTimeout(200); await page.close();

  const rows = r1.concat(r2);
  const early = ctWindowMean(rows, 0.5, 5);    // the sampled-layer window (baked-or-not on cold boot)
  const late = ctWindowMean(rows, 10, 18);     // steady, after any pop-in
  const { worstMs } = worstSilentRun(rows, 80);
  const errs = [...T.errors, ...errs0];
  return {
    decodeFirst, route: st.outputRoute,
    firstSound: boot.firstSound, decodeDone: boot.decodeDone, fsGEdd: boot.firstSound >= boot.decodeDone,
    earlyCt: early.mean, nEarly: early.n, lateCt: late.mean, nLate: late.n,
    worstMs, samplerOk: st.decode.sampler.ok, samplerFail: st.decode.sampler.fail,
    steerFailBefore, gateMax: st.decode.maxInFlight, gateLimit: st.decode.limit,
    injMax: inj.maxInFlight, injFails: inj.fails, errors: errs.length, errList: errs.slice(0, 6),
  };
}

async function pitchedPass(browser, base) {
  const label = "PITCHED";
  console.log(`\n[${label}] spokenword (bed + felt_piano/sax samplers) under an iOS decode storm (~1.2 s/decode, 15% drop-once), A/B on the SAME code…`);
  const on = await pitchedMode(browser, base, 1);
  const off = await pitchedMode(browser, base, 0);
  const fmt = (m) => `route=${m.route} fs>=dd=${m.fsGEdd} (fs=${m.firstSound} dd=${m.decodeDone}) earlyCt[0.5,5]=${m.earlyCt.toFixed(5)}(n${m.nEarly}) lateCt[10,18]=${m.lateCt.toFixed(5)} worstSilent=${m.worstMs}ms sampler ok/FAIL=${m.samplerOk}/${m.samplerFail} gate=${m.gateMax}/${m.gateLimit} inj(max/fails)=${m.injMax}/${m.injFails} errs=${m.errors}`;
  console.log(`[${label}] ON  (decode-then-render):   ${fmt(on)}`);
  console.log(`[${label}] OFF (v3.1 open-immediately): ${fmt(off)}`);
  const ratio = off.earlyCt > 0 ? on.earlyCt / off.earlyCt : Infinity;
  console.log(`[${label}] EARLY sampled-layer presence (matched currentTime 0.5–5 s): ON ${on.earlyCt.toFixed(5)} vs OFF ${off.earlyCt.toFixed(5)}  -> ON is x${ratio.toFixed(2)} the OFF floor`);

  // ── ASSERTIONS ──
  // (1) decode-then-render ORDERING: ON bakes buffers BEFORE first sound (fs≥dd); OFF opens
  //     before decode (fs<dd). This is the mechanism — buffers present before the bars bake.
  const orderingOk = on.fsGEdd === true && off.fsGEdd === false;
  // (2) the "before" REPRODUCES the bug: OFF's early sampled-layer energy is a floor and is
  //     LOWER than its own later (post-pop-in) energy — present only EVENTUALLY.
  const reproducesBug = off.earlyCt < off.lateCt * 0.95;
  // (3) the FIX: ON carries the sampled layer FROM THE START — materially MORE early energy at
  //     the SAME deterministic song position (matched global currentTime) than OFF. This is the
  //     "present from the start, not eventually" proof: same music, the only difference is
  //     whether bar 0 was baked WITH its sample buffers.
  const presentEarlyOk = ratio >= 1.4;
  // (4) continuity across boot AND the genre STEER (no permanent voice loss / multi-bar dropout).
  const continuityOk = on.worstMs < 1000;
  // (5) concurrency capped + transient drops all retried (zero permanently-stranded voices),
  //     across the steer too (steer opened a NEW gen and it too decoded-then-rendered).
  const capOk = on.injMax <= on.gateLimit && on.gateMax <= on.gateLimit;
  const retryOk = on.injFails >= 2 && on.samplerFail === 0 && on.steerFailBefore === 0;
  const errsOk = on.errors === 0 && off.errors === 0;

  console.log(`[${label}] ordering ON fs>=dd ${on.fsGEdd} / OFF fs>=dd ${off.fsGEdd} -> ${orderingOk}; reproducesBug(OFF early<late) ${reproducesBug}`);
  console.log(`[${label}] presentEarly(x>=1.4 & not-collapsed) ${presentEarlyOk}; continuity(<1s) ${on.worstMs}ms ${continuityOk}`);
  console.log(`[${label}] cap ${capOk} (inj ${on.injMax}, gate ${on.gateMax}/${on.gateLimit}); retry ${retryOk} (drops ${on.injFails}, permaFail ${on.samplerFail}); errors ${on.errors}/${off.errors}`);
  if (on.errors || off.errors) console.log("  " + [...on.errList, ...off.errList].join("\n  "));
  const pass = orderingOk && reproducesBug && presentEarlyOk && continuityOk && capOk && retryOk && errsOk;
  console.log(`[${label}] ${pass ? "PASS" : "FAIL"}`);
  return pass;
}

async function stallPass(browser, base) {
  const label = "STALL";
  const page = await browser.newPage();
  const errs0 = capturePageErrors(page);
  await page.goto(base + "&codec=mp3&bootDecodeCap=13000");
  // the vocoder carrier decodes SLOWLY (9 s); sampler/found are quick. The open must NOT block on
  // the carrier (found/sampler decode-then-render never waits on the ONE speech carrier), so first
  // sound arrives FAR below 9 s and the carrier folds in later via setSpeech.
  await page.evaluate(installFault, { latMin: 150, latMax: 500, slowPct: 0, slowLatMin: 0, slowLatMax: 0,
    speechLat: 9000, failPct: 0, failAttempts: 1 });
  console.log(`\n[${label}] electro seed1 (vocoder, sp_system carrier) with a 9 s speech decode…`);
  await page.evaluate(() => goLive("electro", 1));
  await page.waitForTimeout(2000);
  const at2s = await page.evaluate(() => { try { return window.handle.rms(); } catch (e) { return -1; } });
  const rows = await sample(page, 200, 100);   // ~20 s (crosses the 9 s carrier landing)
  const st = await page.evaluate(() => window.handle.__wavState());
  const boot = await page.evaluate(() => window.handle.bootStats());
  const T = await page.evaluate(() => stopLive());
  await page.waitForTimeout(200); await page.close();

  const errs = [...T.errors, ...errs0];
  const { worstMs, startedIdx } = worstSilentRun(rows, 100);
  const firstSound = boot ? boot.firstSound : 0;
  // ASSERTIONS. The open must NOT wait on the 9 s carrier (found/sampler decode is quick here),
  // so first sound is FAR below the carrier latency; the carrier decodes + folds in eventually.
  const fastBootOk = firstSound > 0 && firstSound <= 7000;
  const earlySoundOk = startedIdx >= 0 && startedIdx <= 60;
  const continuityOk = worstMs < 1200;
  const speechOk = st.decode.speech.ok >= 1 && st.decode.speech.fail === 0;
  const errsOk = errs.length === 0;

  console.log(`[${label}] boot firstSound ${firstSound}ms (<=7000, well below the 9s carrier: ${fastBootOk}); rms@2s ${at2s.toFixed ? at2s.toFixed(4) : at2s}`);
  console.log(`[${label}] continuity: started sample #${startedIdx}, longest silent run ${worstMs}ms  -> ${continuityOk}`);
  console.log(`[${label}] speech carrier decode ok ${st.decode.speech.ok} fail ${st.decode.speech.fail}  -> foldedIn:${speechOk}`);
  console.log(`[${label}] route ${st.outputRoute}; errors ${errs.length}${errs.length ? "\n  " + errs.slice(0, 6).join("\n  ") : ""}`);
  const pass = fastBootOk && earlySoundOk && continuityOk && speechOk && errsOk;
  console.log(`[${label}] ${pass ? "PASS" : "FAIL"}`);
  return pass;
}

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const base = `http://localhost:${PORT}/test/live-test.html?wavOut=1&segSec=4&firstSegSec=3`;
  const a = await pitchedPass(browser, base);
  const b = await stallPass(browser, base);
  await browser.close();
  srv.close();
  const pass = a && b;
  console.log(`\nLIVE-RESILIENCE GATE (decode-then-render: pitched-voice presence A/B + cap/retry/continuity, carrier-gate stall): ${pass ? "PASS" : "FAIL"}`);
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
