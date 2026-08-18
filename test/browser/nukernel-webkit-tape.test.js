#!/usr/bin/env node
// test/browser/nukernel-webkit-tape.test.js — THE OTHER ENGINE.
//
//   node test/browser/nukernel-webkit-tape.test.js
//
// WHY THIS GATE EXISTS, and it is the reason the bug shipped rather than the
// bug itself: every browser gate in this repo launches chromium, and Paul
// listens on Safari. Thirty-odd gates were green while the carrier's full
// render never completed under WebKit at all — __nuBounce().state sat on
// "rendering" for ever, the stage never left the short insurance tape, and not
// one line of the suite had ever asked WebKit anything.
//
// WHAT HE HEARD (iPhone, Philadelphia 1976 — genre key blueeyedsoul, which is
// the song this gate writes): "starts, mix gets louder after a few beats.
// Second section has drums completely off rhythm and all over the place. Starts
// glitching as it goes on then the entire app reloads." Every one of those is
// the same fact — a render that never finishes keeps allocating offline
// contexts (the reload), keeps a main thread building and tearing down graphs
// (drums late and bunched), and never hands the ear anything.
//
// MEASURED HERE BEFORE THE FIX, headless webkit vs headless chromium, same box,
// same composed song (11 boxes, ~156 s, 26 windows), per window:
//
//   chromium   press 5.6-15.5 s   desk 1.5-3.3 s   ≈ 0.8-2.0x realtime
//   webkit     press 9.9-14.3 s   desk 7.4-8.8 s   ≈ 3.7x realtime
//
// — nine and a half minutes of rendering for under three minutes of music, and
// nothing in audio/bounce.js could tell that from a render still going well.
//
// SO THE CONTRACT IS SETTLEMENT, NOT COMPLETION. A gate that demanded
// stage="full" on every engine would be demanding something this hardware
// cannot do, and it would go red for cause on the day someone opened it on a
// slower phone. What the artifact owes, and what this holds it to, is:
//
//   (A) THE SHORT TAPE LANDS. The insurance a hidden tab needs exists in seconds.
//   (B) THE RENDER SETTLES. Inside the deadline the carrier is 'ready' and
//       either has the full song or has GIVEN UP ON IT IN WRITING — capped,
//       with the rate that decided it. What it may never be is 'rendering'
//       with no end, which is the shipped bug exactly.
//   (C) IT STAYS SETTLED. A capped render does not quietly start again: no new
//       attempt, no return to 'rendering', with nobody touching anything.
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
const SHORT_MS = 90000;                  // the insurance is supposed to be fast
// …and the render is supposed to END. Longer than audio/bounce.js's own
// TAPE_DEADLINE_MS on purpose: the gate must outlast the mechanism it is
// checking, or a pass would only mean "the deadline had not arrived yet". A
// box fast enough to press the whole song settles long before this.
const SETTLE_MS = 330000;
const HOLD_MS = 20000;                   // ...and stay ended
const RMS_FLOOR = 0.005;                 // silence is ~1e-4
const RMS_CEIL = 0.9;                    // the master's brickwall sits well under this

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

// an analyser on whatever reaches the destination — the artifact, not the
// intention (the same tap test/browser/nukernel-survival.test.js installs)
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
    rms: window.__rms ? window.__rms() : -1 }));
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

  // ── (A) the short tape lands ──
  {
    const s = await poll(SHORT_MS, (x) => x.b.state === "ready" && x.b.stage);
    if (!(s.b.state === "ready" && s.b.stage))
      fail(`no carrier within ${SHORT_MS / 1000}s under webkit (state '${s.b.state}', ` +
           `stage '${s.b.stage}', lastError '${s.b.lastError}') — the pocket is empty`);
    else ok(`short tape ready in ${Math.round((Date.now() - t0) / 1000)}s ` +
            `(${s.b.durSec.toFixed(1)}s loop, stage '${s.b.stage}')`);
  }

  // ── (B) the render SETTLES: finished, or given up on in writing ──
  const settled = await poll(SETTLE_MS - (Date.now() - t0),
    (x) => x.b.state !== "rendering" && (x.b.stage === "full" || x.b.capped));
  const secs = Math.round((Date.now() - t0) / 1000);
  if (settled.b.state === "rendering" && !settled.b.capped)
    fail(`the render is STILL going after ${secs}s (stage '${settled.b.stage}', ` +
         `chunks ${settled.r.chunks}, pressRate ${settled.b.pressRate}x, ` +
         `tries ${settled.b.tries}) — this is the shipped bug: a tape with no end ` +
         `and nothing that can tell`);
  else if (settled.b.stage === "full")
    ok(`the full tape landed in ${secs}s (pressRate ${settled.b.pressRate}x)`);
  else if (settled.b.capped) {
    const c = settled.b.capped;
    ok(`the full tape was given up on in ${secs}s and said so: ` +
       `"${c.why}", ${c.rate}x, ${c.gotSec}s of ${c.wantSec}s pressed`);
    // The demotion has to be LEGIBLE, or it is the silent failure wearing a
    // field. A cap for SLOWNESS is a measurement and must carry the rate that
    // made it; a cap for a STALL may honestly have no rate at all (nothing
    // finished, so nothing was measured) — but it still owes a reason.
    if (!c.why) fail("capped carries no reason — the give-up is silent after all");
    else if (/slower/.test(c.why) && !(c.rate > 0))
      fail("capped for slowness with no measured rate — that is a guess, not a measurement");
    else ok(`the cap is legible: "${c.why}", rate ${c.rate}, ${c.gotSec}s pressed`);
    if (settled.b.state !== "ready")
      fail(`capped but state is '${settled.b.state}' — the short tape is still a tape ` +
           `and the carrier should be ready on it`);
    else ok("capped and still ready: the short tape stands as insurance");
  }

  // ── (C) it stays settled — no retry loop behind the readout ──
  {
    const before = { tries: settled.b.tries, stage: settled.b.stage, capped: !!settled.b.capped };
    const after = await poll(HOLD_MS, () => false);
    if (before.capped && after.b.state === "rendering")
      fail(`a capped render started again with nobody touching anything ` +
           `(tries ${before.tries} -> ${after.b.tries}) — the ceiling does not hold`);
    else if (before.capped && after.b.tries > before.tries)
      fail(`full attempts kept climbing after the cap: ${before.tries} -> ${after.b.tries}`);
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
