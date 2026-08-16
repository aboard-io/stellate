#!/usr/bin/env node
// test/browser/nukernel-bounce.test.js — THE CARRIER RENDER BUDGET GATE.
//
//   node test/browser/nukernel-bounce.test.js
//
// nukernel-survival.test.js proves the carrier EXISTS and plays real music. It
// renders the DEFAULT song — one phrase in one box — which is four bars long,
// and four bars render in under a second whatever the code does. So the gate
// that proves the carrier works was structurally blind to the thing that broke
// it: a COMPOSED song, which is the song anybody actually listens to.
//
// Measured before this gate existed, on a composed beatles song of 141.6 s:
// 3.9 s of music cost 1.1 s to render, 15.5 s cost 14.1 s, 46.5 s cost 179 s.
// That is ~n^2.3, and the full song did not finish inside 300 seconds. On
// mobile the rendered tape IS the audible path (audio/bounce.js carrierFirst),
// so "the render did not finish" means "the phone never made a sound", and the
// background survival every other gate checks is waiting behind it.
//
// This gate asks the three questions that failure raises:
//
//   (A) A COMPOSED SONG RENDERS AT ALL, and in a time that is a fraction of its
//       own duration rather than a multiple. window.__nuRender reports the
//       ratio; the ceiling here is deliberately loose, because it is guarding
//       against the return of a superlinear term and not against a slow box.
//   (B) AN EDIT RE-RENDERS ONLY WHAT IT CHANGED, and lands inside the real
//       budget: N seconds of song in under N/4 seconds. The tape is a
//       concatenation of independently rendered windows, so a one-box edit is
//       a couple of window misses against a mostly-warm cache. This is the
//       number a phone actually lives with — every fader move re-renders.
//   (C) THE CACHE NEVER SERVES A STALE WINDOW. The whole optimisation is
//       "reuse the samples you already have", and the failure mode is a tape
//       that is fast and WRONG — the edit inaudible, or the previous take
//       playing under the new one. So the incremental tape is compared against
//       a COLD render of the same edited song, window by window.
//       (The 'test the artifact' law: three features shipped broken here while
//       every check passed, because the checks read intent and not output.)
//   (D) A SUNG LINE SURVIVES A WINDOW BOUNDARY. On mobile the tape IS the
//       audible path (carrierFirst), so a voice that only exists on the live
//       graph is silent on a phone — and the tape is cut into windows, so a
//       held syllable that starts in one window and ends in the next is
//       exactly the thing that vanishes silently. The pre-roll is supposed to
//       make that impossible by construction (a window renders the bar before
//       its own and throws that bar's output away, so a note that rings across
//       the seam really was played) — but "by construction" is what the three
//       broken features all claimed. So the same music is rendered with the
//       SEAMS IN DIFFERENT PLACES and the tapes are compared: if a syllable
//       falls down a crack, moving the cracks moves the tape.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8951;                 // a PREFERENCE — the harness walks past a busy port
const GENRE = "beatles";         // a full band: verses, choruses, a solo, an outro
// (A)'s ceiling. Not the budget — the budget is (B). This is the tripwire for
// the quadratic coming back, and it has to hold on a loaded CI box, so it is
// set well above the ~0.7x measured rather than next to it.
const COLD_MAX = 2.0;
// (B)'s budget, and the real one: a tape that takes longer than a quarter of
// its own duration to re-cut is an instrument you cannot play.
const WARM_MAX = 0.25;

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

// the same analyser tap the other nukernel gates install, and for the same
// reason: the page has to be PLAYING before a render means anything.
// OfflineAudioContext is deliberately not wrapped — the bounce must run
// against the real thing.
function taps() {
  const AC = window.AudioContext || window.webkitAudioContext;
  window.AudioContext = function (...a) {
    const c = new AC(...a);
    window.__ctx = c;
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
}

// NOT bit-equality. Measured: two cold renders of the same song already differ
// by ~1e-5 RMS — the master limiter and compressor carry float state and the
// last bit of it is not reproducible. A stale window is not a subtle thing (it
// is a box's drums present or absent), so the question is asked at 2%, which is
// far above that noise floor and far below any real difference.
const NOISE = 0.02;
const drift = (a, b) => {
  if (!a || !b || a.length !== b.length) return Infinity;
  let worst = 0;
  for (let i = 0; i < a.length; i++)
    worst = Math.max(worst, Math.abs(a[i] - b[i]) / Math.max(b[i], 1e-3));
  return worst;
};
const moved = (a, b) => a.reduce((n, v, i) =>
  n + (Math.abs(v - b[i]) / Math.max(b[i], 1e-3) > NOISE ? 1 : 0), 0);

(async () => {
  const srv = await serve(ROOT, PORT); PORT = srv.port;
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = capturePageErrors(page);
  await page.addInitScript(taps);
  // ?nobounce holds the automatic carrier renders off, so the only renders on
  // this page are the ones the gate asks for and times. Without it the debounce
  // fires a full render into the middle of a measurement.
  await page.goto(`http://localhost:${PORT}/nukernel/kernel-daw.html?nobounce`,
    { waitUntil: "networkidle" });

  // a WHOLE COMPOSED SONG, which is the case the default song cannot reach
  await page.selectOption("#composeg", GENRE);
  await page.click("#compose");
  await page.waitForTimeout(1200);
  await page.click("#play");
  await page.waitForFunction(() => window.__rms && window.__rms() > 0.003,
    null, { timeout: 30000 });

  if (!(await page.evaluate(() => typeof window.__nuRenderNow === "function")))
    { fail("window.__nuRenderNow is missing — the render budget cannot be measured"); }

  // THE DEFAULT SONG IS FOUR BOXES, and a composed one is many more. Measured
  // flake: the ✎ Write click occasionally lands before the genre select has
  // settled and the page is still holding the default — which renders in two
  // seconds and would let every budget below pass without measuring anything.
  let boxes = await page.evaluate(() => document.querySelectorAll("#song .box").length);
  if (boxes <= 4) {
    await page.selectOption("#composeg", GENRE);
    await page.click("#compose");
    await page.waitForTimeout(1500);
    boxes = await page.evaluate(() => document.querySelectorAll("#song .box").length);
  }
  if (boxes <= 4) fail(`the page is still on a ${boxes}-box song — ✎ Write did not compose, ` +
                       `so nothing below is measuring a real song`);
  else ok(`composed a ${GENRE} song of ${boxes} boxes`);

  // ── (A) the cold render: a whole composed song, from an empty cache ──
  const cold = await page.evaluate(() => window.__nuRenderNow(0, { cold: true }),
    null);
  if (!cold) { fail("the cold render returned nothing"); }
  else {
    const secs = (cold.ms / 1000).toFixed(1);
    if (cold.misses !== cold.chunks)
      fail(`cold render reused ${cold.hits} windows — { cold: true } did not empty the cache`);
    if (cold.ratio > COLD_MAX)
      fail(`cold render of ${cold.durSec.toFixed(1)}s took ${secs}s ` +
           `(${cold.ratio.toFixed(2)}x its own duration, ceiling ${COLD_MAX}x) — ` +
           `the superlinear term is back: check that audio/bounce.js is still ` +
           `rendering in windows and that CHUNK_SEC has not grown`);
    else
      ok(`cold render: ${cold.durSec.toFixed(1)}s of song in ${secs}s ` +
         `(${cold.ratio.toFixed(2)}x) over ${cold.chunks} windows`);
    if (!(cold.peak > 0.01))
      fail(`the cold tape peaks at ${cold.peak} — it rendered fast because it rendered silence`);
    else ok(`the cold tape is real audio (peak ${cold.peak})`);
  }

  // ── (E) THE TAPE CARRIES THE WHOLE BAND, AND WRAPS WHERE THE MUSIC DOES ──
  // Paul, on a phone: "I switch out of the browser. One phrase repeats over and
  // over — no drums — but there's no doubling." Nothing above could confirm or
  // deny that: the phases say how long the render took, the RMS windows say it
  // was not silent, and neither can tell a band from a bass line. So the render
  // now reports the channels' own laneIn ledger — which drum lanes really had a
  // hit routed to a strip — and this reads it against the live walk's score.
  // The score half is §50 in test/unit/nukernel.test.js; this is the half that
  // can only be asked of a real OfflineAudioContext.
  {
    const score = await page.evaluate(async () => {
      const t = await import("/nukernel/audio/transport.js");
      const TL = t.buildTimeline(), sd = t.stepDur();
      const lanes = new Set();
      for (const b of TL) for (const e of b.ev) if (e.kind === "hit") lanes.add(e.d);
      return { lanes: [...lanes].sort(),
               sec: TL.reduce((a, b) => a + b.barSteps, 0) * sd, bars: TL.length };
    });
    const got = (cold && cold.lanes) || [];
    // a machine lane earns its own strip key ("tr808|k"); a sampled one is the
    // bare letter. The claim is about LANES, so compare on the letter.
    const letters = new Set(got.map(k => k.split("|").pop()));
    const missing = score.lanes.filter(d => !letters.has(d));
    if (!got.length)
      fail(`the tape carries NO drum lane at all for a ${GENRE} song whose score ` +
           `plays ${score.lanes.length} of them (${score.lanes.join("")}) — this is ` +
           `"one phrase repeats over and over, no drums", measured on the render`);
    else if (missing.length)
      fail(`the tape is missing drum lane(s) ${missing.join(",")} that the live walk ` +
           `plays — the carrier is a different arrangement from the graph`);
    else ok(`the tape carries every drum lane the band plays (${score.lanes.join("")})`);
    // …AND IT IS THE WHOLE SONG. A tape shorter or longer than the bar list
    // loops early or late, which is the other half of the same report.
    if (!cold) fail("no cold tape to measure the loop point on");
    else if (Math.abs(cold.durSec - score.sec) > 0.001)
      fail(`the tape is ${(cold.durSec - score.sec).toFixed(3)} s off the live walk's ` +
           `${score.sec.toFixed(3)} s over ${score.bars} bars — the carrier's loop ` +
           `wrap is not where the music ends`);
    else ok(`the tape is exactly the song: ${cold.durSec.toFixed(3)} s over ` +
            `${score.bars} bars, to the millisecond`);
    // THE FRAGMENT, measured beside it. The short insurance stage renders the
    // song's head at or under its cap; audio/bounce.js carry() refuses to hand
    // it to the ear anywhere the live graph survives hiding, and this is the
    // number behind that refusal.
    // NOT { cold: true } — dropping the window cache here would make the warm
    // re-render below miss every window and fail for the gate's own reasons
    const frag = await page.evaluate(() => window.__nuRenderNow(4));
    if (!frag) fail("the short-stage render returned nothing");
    else {
      const fl = new Set((frag.lanes || []).map(k => k.split("|").pop()));
      console.log(`  the 4 s insurance tape: ${frag.durSec.toFixed(2)}s, drum lanes ` +
                  `{${[...fl].join("")}} against the song's {${score.lanes.join("")}}`);
      if (frag.durSec >= score.sec)
        fail(`the short stage rendered the whole song (${frag.durSec.toFixed(1)}s) — ` +
             `it is not a short stage`);
      else if (fl.size >= letters.size)
        fail(`the 4 s head carries as many drum lanes as the whole song — the ` +
             `measurement behind carry()'s refusal has gone stale, so re-derive ` +
             `whether the fragment may take the ear`);
      else ok(`the insurance tape really is a fragment: ${frag.durSec.toFixed(2)}s ` +
              `and ${fl.size} of ${letters.size} drum lanes`);
    }
  }

  // ── the warm no-edit render: every window already on disk ──
  const warm = await page.evaluate(() => window.__nuRenderNow(0));
  if (!warm) fail("the warm render returned nothing");
  else if (warm.hits !== warm.chunks)
    fail(`re-rendering an UNCHANGED song missed ${warm.misses} of ${warm.chunks} ` +
         `windows — the window cache budget cannot hold one song, so an edit ` +
         `pays for windows it did not touch`);
  else ok(`unchanged re-render reused all ${warm.chunks} windows in ${warm.ms} ms`);
  if (cold && warm && drift(warm.rms, cold.rms) > NOISE)
    fail("the cached tape is not the tape that was rendered — a window is stale");
  else if (cold && warm) ok("the cached tape matches the fresh one");

  // ── (B) one box edited: the number a phone lives with ──
  // A REAL edit through the real surface: open box `mid`'s RHYTHM cell popup
  // and click a drumkit chip ("the row and the board" — the LED strip this
  // used to click only mutated sec.focus, which was an accidental edit). The
  // chip toggles sec.drumkit either way, which must invalidate exactly that
  // box's windows.
  const mid = Math.max(0, Math.floor(boxes / 2));
  await page.locator("#song .box").nth(mid).locator('.bcell[data-cell="rhythm"]').click();
  await page.waitForSelector("#rowpop:not([hidden])", { timeout: 10000 });
  await page.locator('.pchip[data-kind="drumkit"]').first().click();
  await page.keyboard.press("Escape");
  await page.waitForSelector("#rowpop", { state: "hidden" });
  await page.waitForTimeout(600);
  const inc = await page.evaluate(() => window.__nuRenderNow(0));
  if (!inc) { fail("the incremental render returned nothing"); }
  else {
    if (inc.misses === 0)
      fail(`editing box ${mid + 1} invalidated NO window — the cache key does not ` +
           `see the edit, so the tape would still be playing the old take`);
    else if (inc.misses === inc.chunks)
      fail(`editing box ${mid + 1} invalidated every one of ${inc.chunks} windows — ` +
           `the key is keyed on something global (the whole song, or a bar index) ` +
           `instead of on what the window renders`);
    else ok(`editing box ${mid + 1} of ${boxes} re-rendered ${inc.misses} of ${inc.chunks} windows`);
    const budget = inc.durSec * WARM_MAX;
    if (inc.ms / 1000 > budget)
      fail(`a one-box edit re-rendered ${inc.durSec.toFixed(1)}s of song in ` +
           `${(inc.ms / 1000).toFixed(1)}s, over the ${budget.toFixed(1)}s budget ` +
           `(${WARM_MAX}x) — an edit the ear waits this long for is not an instrument`);
    else
      ok(`one-box edit: ${inc.durSec.toFixed(1)}s of song re-cut in ` +
         `${(inc.ms / 1000).toFixed(1)}s (${inc.ratio.toFixed(3)}x, budget ${WARM_MAX}x)`);
  }

  // ── (C) …and it is the RIGHT tape. Same song, rendered cold, must match ──
  const proof = await page.evaluate(() => window.__nuRenderNow(0, { cold: true }));
  if (!proof) fail("the cold proof render returned nothing");
  else if (!inc) fail("no incremental tape to prove");
  else {
    const d = drift(inc.rms, proof.rms);
    if (d > NOISE)
      fail(`the incrementally re-cut tape differs from a cold render of the same ` +
           `edited song by ${(d * 100).toFixed(1)}% — a reused window is stale, ` +
           `which is the one failure this whole optimisation can produce and the ` +
           `ear would hear as the old take`);
    else
      ok(`the incremental tape matches a cold render of the edited song ` +
         `(worst window ${(d * 100).toFixed(2)}%)`);
    // …and how much of the tape the edit actually moved. Informational: an edit
    // can legitimately change a box's spec without changing its sound, and this
    // gate is about the cache, not about the edit.
    if (cold) console.log(`  ..: the edit moved ${moved(proof.rms, cold.rms)} of ` +
                          `${cold.rms.length} tape windows`);
  }

  // ── (D) the singer, in the tape and across the seams ──
  {
    // every box sings. Written straight onto the store rather than clicked,
    // because the claim here is about the RENDER and not about the palette
    // (nukernel-drums (H) drives the plan through the real derive path).
    const planned = await page.evaluate(async () => {
      const [stm, dv] = await Promise.all([
        import("/nukernel/ui/state.js"), import("/nukernel/ui/derive.js")]);
      for (const b of stm.SONG) b.sing = "duet";
      stm.commit("song", { reason: "gate" });
      let n = 0;
      for (const b of stm.SONG)
        n += dv.sectionEvents(b, stm.SLOTS).ev.filter(e => e.kind === "sing").length;
      return n;
    });
    await page.waitForTimeout(400);
    if (!planned) fail("no box in this song plans a sung syllable — (D) measures nothing");
    else ok(`the song plans ${planned} sung syllables across ${boxes} boxes`);

    // A SHORT HEAD, on purpose. The one-window control has to render the same
    // music in a SINGLE OfflineAudioContext, and audio/bounce.js's own header
    // measures that path as ~n^2.3 — a whole composed song in one window does
    // not finish. Twelve seconds is many bars (so many seams at chunkSec 2)
    // and one cheap window at chunkSec 60.
    const HEAD = 12;
    const many = await page.evaluate((h) =>
      window.__nuRenderNow(h, { cold: true, chunkSec: 2 }), HEAD);
    const one = await page.evaluate((h) =>
      window.__nuRenderNow(h, { cold: true, chunkSec: 60 }), HEAD);
    if (!many || !one) fail("a seam render returned nothing");
    else {
      console.log(`  seam A/B: ${many.chunks} windows vs ${one.chunks}, ` +
                  `${many.durSec.toFixed(1)}s of song`);
      // THREE, not six: a window is a whole number of BARS (planChunks walks
      // the bar list), and a beatles bar at this tempo is ~4 s — so chunkSec 2
      // buys one bar per window and 11.8 s of head is three of them. Two
      // seams is what there is to test at this bar granularity, and two seams
      // is enough: a note lost at one moves the tape.
      if (many.chunks < 3)
        fail(`the many-window render only made ${many.chunks} window(s) — chunkSec ` +
             `did not take, so there are no seams to test`);
      else if (one.chunks !== 1)
        fail(`the control render made ${one.chunks} windows, not 1 — it is not a control`);
      else {
        const d = drift(many.rms, one.rms);
        if (d > NOISE)
          fail(`moving the window boundaries changed the tape by ${(d * 100).toFixed(1)}% — ` +
               `something is falling down a seam. A sung note longer than one bar is the ` +
               `likely culprit: audio/sing.js caps a syllable at the sounding bar precisely ` +
               `because the pre-roll is one bar deep`);
        else ok(`the tape is identical with ${many.chunks} seams and with none ` +
                `(worst window ${(d * 100).toFixed(2)}%)`);
      }
      if (!(many.sing && many.sing.notes > 0))
        fail(`the windowed render played ${many.sing && many.sing.notes} sung notes — ` +
             `the singer is not in the tape at all, which on a phone means silent`);
      else ok(`the windowed render sang ${many.sing.notes} notes ` +
              `(${many.sing.utterances} espeak utterances, ${many.sing.failed} failed)`);
    }

    // …AND IT IS AUDIBLE. The strongest available read without soloing a voice
    // out of a full mix: render the identical song with the singer off and
    // show the tape moved. A feature that renders and cannot be heard is the
    // failure this gate's own header is about.
    const off = await page.evaluate(async (h) => {
      const stm = await import("/nukernel/ui/state.js");
      for (const b of stm.SONG) b.sing = null;
      stm.commit("song", { reason: "gate" });
      return window.__nuRenderNow(h, { cold: true, chunkSec: 2 });
    }, HEAD);
    if (!off || !many) fail("the singer-off render returned nothing");
    else {
      const n = moved(many.rms, off.rms);
      console.log(`  singer on vs off: ${n}/${many.rms.length} tape windows moved by ` +
                  `more than ${NOISE * 100}%`);
      // THREE, and the bar is low on purpose. This is a WHOLE BAND mix through
      // a limiter, and one voice at 0.5 against it moves the tape by a few
      // percent in the windows it sings in — measured across runs at 5 to 36
      // of 64. The claim being made is "it is in there", not "it dominates";
      // (H) in nukernel-drums is where the voice is heard on its own.
      if (n < 3)
        fail(`switching the singer on changed only ${n} of ${many.rms.length} tape windows — ` +
             `it rendered, it cost espeak instances, and it is inaudible`);
      else ok(`the singer is audible in the tape: ${n}/${many.rms.length} windows moved`);
    }
  }

  if (errs.length) fail(`page errors: ${errs.slice(0, 3).join(" | ")}`);
  else ok("no page errors");

  await browser.close();
  await srv.close();
  console.log(process.exitCode ? `\nFAILED (${checks} passed)` : `\nPASS (${checks} checks)`);
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });
