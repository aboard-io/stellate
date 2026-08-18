#!/usr/bin/env node
// test/browser/nukernel-webkit-tape.test.js — THE OTHER BROWSER.
//
//   node test/browser/nukernel-webkit-tape.test.js
//
// WHY THIS GATE EXISTS, and it is the reason the bug shipped rather than the
// bug itself: every browser gate in this repo launches chromium, and Paul
// listens on Safari. Thirty-odd gates were green while nukernel's own render
// never completed under WebKit at all — __nuBounce().state sat on "rendering"
// for ever, the stage never left the short insurance tape, and not one line of
// the suite had ever asked WebKit anything.
//
// WHAT HE HEARD (iPhone, Philadelphia 1976 — genre key blueeyedsoul, which is
// the song this gate writes): "starts, mix gets louder after a few beats.
// Second section has drums completely off rhythm and all over the place. Starts
// glitching as it goes on then the entire app reloads." Every one of those is
// the same fact — a render that never finishes keeps allocating offline
// contexts (the reload), keeps a main thread building and tearing down graphs
// (drums late and bunched), and never hands the ear anything.
//
// THE CAUSE WAS THE SECOND ENGINE, and it is gone (one engine, 2026-08-18).
// What could not finish was audio/bounce.js — nukernel's own offline render,
// pressing the whole song through an OfflineAudioContext that on WebKit cannot
// build a Faust worklet at all, with nothing bounding the retry. nukernel now
// plays through engine/faust/live/live.js, the same engine stellate.app has run
// on WebKit since WAV-FIRST, and the failure is BOUNDED: a deadline, a ceiling
// of two attempts (the stream, then the parent's own media route) and a
// demotion written down rather than retried. So this gate asks the same five
// questions of the one engine that it used to ask of the second one.
//
// MEASURED HERE BEFORE THE FIX, headless webkit vs headless chromium, same box,
// same composed song (11 boxes, ~156 s, 26 windows), per window:
//
//   chromium   press 5.6-15.5 s   desk 1.5-3.3 s   ≈ 0.8-2.0x realtime
//   webkit     press 9.9-14.3 s   desk 7.4-8.8 s   ≈ 3.7x realtime
//
// — nine and a half minutes of rendering for under three minutes of music, and
// nothing in audio/bounce.js could tell that from a render still going well.
// Both numbers are history now: nothing on this page renders a tape.
//
// SO THE CONTRACT IS SETTLEMENT, NOT COMPLETION. A gate that demanded
// stage="full" on every engine would be demanding something this hardware
// cannot do, and it would go red for cause on the day someone opened it on a
// slower phone. What the artifact owes, and what this holds it to, is:
//
//   (A) SOMETHING SOUNDS, SOON. The engine reaches a state and a route in
//       seconds rather than spending the first minute deciding.
//   (B) IT SETTLES. Inside the deadline the engine is 'ready' and either
//       sounding the whole song ('full') or has GIVEN UP ON IT IN WRITING —
//       capped, with a reason. What it may never be is 'starting' with no end,
//       which is the shipped bug exactly.
//   (C) IT STAYS SETTLED. A capped engine does not quietly start again: no new
//       attempt, no return to 'starting', with nobody touching anything, and
//       never more than the two attempts the ceiling allows.
//   (D) THE LEVEL DOES NOT RUN AWAY. Note what this does NOT assert: that the
//       level is flat. Measured on chromium, where the render is healthy and
//       finishes, RMS climbs 0.059 -> 0.256 over the same minute — because the
//       arrangement builds, which is the composer working. "The mix gets
//       louder" is a real report and a monotonic-climb assertion would have
//       been a false one; the honest claim is that the level stays inside the
//       band the master is built to hold, and never goes silent.
//   (E) NOTHING THROWS. Zero page errors under an engine the app had never met.
//
// WHAT A WEBKIT PASS PROVES AND DOES NOT. playwright's webkit is WebKit's own
// engine — its WebAudio, its OfflineAudioContext, its workers — built for this
// platform. It is the right instrument for "does this path exist and terminate
// there". It is not an iPhone, so no number here is a phone's number: this gate
// reads STATE, and the one clock it does read is a deadline generous enough to
// be about termination rather than about speed.
"use strict";
const { serve, launchBrowser, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8994;
const GENRE = "blueeyedsoul";            // Philadelphia 1976 — Paul's own report
const SHORT_MS = 90000;                  // opening the engine is supposed to be fast
// …and it is supposed to END. Longer than audio/live.js's own DEADLINE_MS on
// purpose: the gate must outlast the mechanism it is checking, or a pass would
// only mean "the deadline had not arrived yet".
const SETTLE_MS = 330000;
const HOLD_MS = 20000;                   // ...and stay ended
const RMS_FLOOR = 0.005;                 // silence is ~1e-4
const RMS_CEIL = 0.9;                    // the master's brickwall sits well under this

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

// an analyser on whatever reaches the destination — the artifact, not the
// intention (the same tap test/browser/nukernel-engine.test.js installs)
function taps() {
  const AC = window.AudioContext || window.webkitAudioContext;
  const W = function (...a) {
    const c = new AC(...a);
    const an = c.createAnalyser(); an.fftSize = 2048;
    const orig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest === c.destination) { try { orig.call(this, an); } catch (e) {} }
      return orig.call(this, dest, ...rest);
    };
    window.__rms = () => {
      const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d);
      let s = 0; for (const v of d) s += v * v;
      return Math.sqrt(s / d.length);
    };
    return c;
  };
  W.prototype = AC.prototype;
  window.AudioContext = W; window.webkitAudioContext = W;
}

(async () => {
  const srv = await serve(ROOT, PORT); PORT = srv.port;
  const browser = await launchBrowser("webkit");
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = capturePageErrors(page);
  await page.addInitScript(taps);
  await page.goto(`http://localhost:${PORT}/nukernel/kernel-daw.html`,
    { waitUntil: "networkidle" });
  ok("the page boots under webkit");

  // ── the song: a WHOLE ARRANGEMENT, not the default one-box page ──
  // The bug is a property of length — one box renders in one window and lands
  // everywhere. #compose is in the header at every width, and the click is the
  // gesture that unlocks the context and starts the transport (ui/chrome.js
  // composeNow ends in startAt(0)).
  await page.evaluate((g) => { document.getElementById("composeg").value = g; }, GENRE);
  await page.click("#compose");
  const boxes = await page.evaluate(() => document.querySelectorAll(".box").length);
  if (boxes < 4) fail(`the composer wrote ${boxes} box(es) — too short to render in windows, ` +
                      `so this gate would prove nothing`);
  else ok(`composed ${GENRE}: ${boxes} boxes`);

  const look = () => page.evaluate(() => ({
    b: window.__nuBounce(), r: window.__nuRender(),
    // TWO TAPS, and the honest reading is the louder. The destination tap sees
    // the DIRECT route (the graph ends at ctx.destination); the engine's own
    // analyser sees every route, including the media-element one WebKit takes,
    // where nothing is connected to ctx.destination at all and a destination tap
    // reads a flat zero over a perfectly audible song. Measuring the wrong node
    // and calling it silence is its own kind of shipped bug.
    rms: Math.max(window.__rms ? window.__rms() : -1,
                  (window.__nuEngine && window.__nuEngine().rms) || -1) }));
  const rms = [];
  const t0 = Date.now();
  const poll = async (ms, until) => {
    const stop = Date.now() + ms;
    let s = null;
    while (Date.now() < stop) {
      await page.waitForTimeout(2000);
      s = await look();
      if (s.rms >= 0) rms.push(s.rms);
      if (until(s)) return s;
    }
    return s;
  };

  // ── (A) something sounds, soon ──
  {
    const s = await poll(SHORT_MS, (x) => x.b.state === "ready" && x.b.stage);
    if (!(s.b.state === "ready" && s.b.stage))
      fail(`no engine within ${SHORT_MS / 1000}s under webkit (state '${s.b.state}', ` +
           `stage '${s.b.stage}', route '${s.b.route}', lastError '${s.b.lastError}') ` +
           `— the pocket is empty`);
    else ok(`the engine was sounding in ${Math.round((Date.now() - t0) / 1000)}s ` +
            `(${s.b.durSec.toFixed(1)}s of song, route '${s.b.route}')`);
  }

  // ── (B) the render SETTLES: finished, or given up on in writing ──
  const settled = await poll(SETTLE_MS - (Date.now() - t0),
    (x) => x.b.state !== "starting" && (x.b.stage === "full" || x.b.capped));
  const secs = Math.round((Date.now() - t0) / 1000);
  if (settled.b.state === "starting" && !settled.b.capped)
    fail(`the engine is STILL starting after ${secs}s (stage '${settled.b.stage}', ` +
         `bars ${settled.r.chunks}, route '${settled.b.route}', ` +
         `tries ${settled.b.tries}) — this is the shipped bug: a start with no end ` +
         `and nothing that can tell`);
  else if (settled.b.stage === "full")
    ok(`the whole song is sounding, settled in ${secs}s (route '${settled.b.route}')`);
  else if (settled.b.capped) {
    const c = settled.b.capped;
    ok(`the engine gave up in ${secs}s and said so: ` +
       `"${c.why}", ${c.rate}x, ${c.gotSec}s of ${c.wantSec}s`);
    // The demotion has to be LEGIBLE, or it is the silent failure wearing a
    // field. A cap for SLOWNESS is a measurement and must carry the rate that
    // made it; a cap for a STALL may honestly have no rate at all (nothing
    // finished, so nothing was measured) — but it still owes a reason.
    if (!c.why) fail("capped carries no reason — the give-up is silent after all");
    else if (/slower/.test(c.why) && !(c.rate > 0))
      fail("capped for slowness with no measured rate — that is a guess, not a measurement");
    else ok(`the cap is legible: "${c.why}", rate ${c.rate}, ${c.gotSec}s pressed`);
    if (settled.b.state === "ready")
      ok("capped on the stream and still ready: the media route stands as the output");
    else ok(`capped with no engine at all (state '${settled.b.state}') — honest, ` +
            `and bounded, which is the whole of what this gate demands`);
  }

  // ── (C) it stays settled — no retry loop behind the readout ──
  {
    const before = { tries: settled.b.tries, stage: settled.b.stage, capped: !!settled.b.capped };
    const after = await poll(HOLD_MS, () => false);
    if (before.capped && after.b.state === "starting")
      fail(`a capped engine started again with nobody touching anything ` +
           `(tries ${before.tries} -> ${after.b.tries}) — the ceiling does not hold`);
    else if (after.b.tries > before.tries)
      fail(`attempts kept climbing after settling: ${before.tries} -> ${after.b.tries}`);
    else if (after.b.tries > 2)
      fail(`the engine has started ${after.b.tries} times — the ceiling is two`);
    else ok(`settled and stayed settled for ${HOLD_MS / 1000}s ` +
            `(tries ${after.b.tries}, stage '${after.b.stage}')`);
    if (after.b.deadlineMs !== settled.b.deadlineMs)
      fail("the deadline moved mid-run");
  }

  // ── (D) the level stays inside the band ──
  {
    const lo = Math.min(...rms), hi = Math.max(...rms);
    const mid = rms.slice(Math.floor(rms.length / 2));
    const quiet = mid.filter((v) => v < RMS_FLOOR).length;
    if (hi > RMS_CEIL)
      fail(`the level ran away: peak window RMS ${hi.toFixed(3)} over ${RMS_CEIL} — ` +
           `something is summing twice`);
    else if (quiet > mid.length / 2)
      fail(`the room went quiet: ${quiet} of ${mid.length} late samples under ${RMS_FLOOR}`);
    else ok(`level stayed in band across ${rms.length} samples ` +
            `(${lo.toFixed(3)}..${hi.toFixed(3)}) — it builds, it does not run away`);
  }

  // ── (E) nothing threw ──
  if (errs.length) fail(`page errors under webkit:\n    ${errs.slice(0, 6).join("\n    ")}`);
  else ok("zero page errors under webkit");

  await browser.close();
  srv.close();
  console.log(process.exitCode ? "\nFAILED" : `\nPASS — ${checks} checks`);
})().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
