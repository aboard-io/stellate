#!/usr/bin/env node
// test/browser/nukernel-audio.test.js — THE NUKERNEL AUDIO GATE.
//
//   node test/browser/nukernel-audio.test.js
//
// test/unit/nukernel.test.js proves the kernel emits the right EVENTS. It cannot
// see what happens to them afterwards, and everything that has actually gone
// wrong in the audio path went wrong after the events were correct:
//
//   * a Faust freq param has a declared range (DX7 stops at 1000 Hz,
//     bass_reese at 500) and writing past it does not throw, it CLAMPS — so
//     vaporwave's line put five different pitches on the same 1000 Hz and the
//     kernel was blameless;
//   * the WebAudio graph can be built, connected and scheduled and still emit
//     silence, which no event-level check can tell from music.
//
// So this gate asks two questions of the real browser:
//   (A) NOTHING CLAMPS. Every value written to a synth's freq param sits
//       strictly inside that param's own [minValue, maxValue]. Landing exactly
//       on a boundary is the signature of a clamp, and it is a failure.
//   (B) IT MAKES A SOUND. An AnalyserNode on the destination measures real
//       output RMS per genre — the artifact, not the intent.
//   (C) IT IS THE REAL INSTRUMENTS. The page keeps a hand-rolled oscillator
//       voice as a fallback for a zone that failed to decode. That fallback is
//       audible — it is why a mix of piano and organ once still sounded like
//       boops — and it fires silently. If it fires at all, the sampled or synth
//       path did not cover something, and this fails.
//
//       COUNTING createOscillator NO LONGER MEASURES THAT. Since the mixer
//       landed, a section carries a real insert chain (SP.buildInsertNodes, the
//       same one live.js builds), and a chorus, a phaser, a tremolo and a leslie
//       are all LFOs — which are oscillators, started legitimately, dozens of
//       them. So the page counts its own fallback voices in window.__nuFallback,
//       incremented inside line() and hit() themselves, and that is what this
//       asserts. window.__osc is still captured and printed, because "how many
//       oscillators is this page running" is worth seeing, but it is no longer
//       the pass/fail question.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8971;
const RMS_FLOOR = 0.01;                 // silence is ~1e-4; music here runs 0.2..0.6
// EVERY genre, not a sample of them. Each one is a different instrument, a
// different kit and a different set of voices, and the failure this gate exists
// to catch — a zone that does not decode, a freq param that clamps — is per
// genre by construction.
const GENRES = ["Simple", "Fugue", "Acid house", "New Wave", "Vaporwave", "Blues",
                "Rock", "Gregorian", "Bulgarian", "Spem in alium", "Counterpoint",
                "Neoclassical", "Drone", "Sludge"];

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

// Taps installed BEFORE any page script runs: wrap AudioWorkletNode so every
// param write is recorded against that param's declared range, and hang an
// analyser off whatever connects to the destination.
function taps() {
  window.__param = [];      // {node, path, value, min, max}
  window.__nodes = [];
  window.__osc = 0;         // hand-rolled fallback voices that actually started
  const OW = window.AudioWorkletNode;
  window.AudioWorkletNode = function (ctx, name, opts) {
    const n = new OW(ctx, name, opts);
    window.__nodes.push(name);
    try {
      for (const [p, a] of n.parameters) {
        const set = a.setValueAtTime.bind(a);
        a.setValueAtTime = (v, t) => {
          window.__param.push({ node: name, path: p, value: v,
                                min: a.minValue, max: a.maxValue });
          return set(v, t);
        };
      }
    } catch (e) { /* a node with no enumerable params */ }
    return n;
  };
  window.AudioWorkletNode.prototype = OW.prototype;

  const AC = window.AudioContext || window.webkitAudioContext;
  window.AudioContext = function (...a) {
    const c = new AC(...a);
    const an = c.createAnalyser(); an.fftSize = 2048;
    const orig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest === c.destination) { try { orig.call(this, an); } catch (e) {} }
      return orig.call(this, dest, ...rest);
    };
    const co = c.createOscillator.bind(c);
    c.createOscillator = () => {
      const o = co(); const s = o.start.bind(o);
      o.start = (...x) => { window.__osc++; return s(...x); };
      return o;
    };
    window.__rms = () => {
      const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d);
      let s = 0; for (const v of d) s += v * v;
      return Math.sqrt(s / d.length);
    };
    // SPECTRUM, not level. The master bus ends in a compressor and a brickwall
    // limiter — which is the point of it — so a mix change that only moves the
    // LEVEL is exactly what the master exists to flatten, and measuring loudness
    // to prove the mixer works measures the limiter instead. Where the energy
    // SITS is not something a broadband limiter can put back: the fraction of it
    // above ~4 kHz answers "did the sound change", and distortion, a filter and
    // a reverb tail all move it.
    window.__hf = () => {
      const n = an.frequencyBinCount, d = new Float32Array(n);
      an.getFloatFrequencyData(d);                       // dBFS per bin
      const hz = c.sampleRate / 2 / n;
      let hi = 0, all = 0;
      for (let i = 1; i < n; i++) {
        const p = Math.pow(10, d[i] / 10);                // dB -> power
        all += p; if (i * hz >= 4000) hi += p;
      }
      return all > 0 ? hi / all : 0;
    };
    return c;
  };
}

(async () => {
  const srv = await serve(ROOT, PORT); PORT = srv.port;
  const browser = await launchChromium();   // the harness already passes the autoplay flag
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = capturePageErrors(page);
  await page.addInitScript(taps);
  await page.goto(`http://localhost:${PORT}/nukernel/kernel-daw.html`,
    { waitUntil: "networkidle" });

  // one phrase, in the one box, for every genre in turn
  await page.locator(".slot").nth(0).click();
  await page.click("#seed");

  // SWITCH WHILE IT PLAYS for all but the first: assets used to be fetched only
  // by the transport start, so a genre chosen mid-play had no instrument and no
  // kit and fell straight through to the oscillator. That is the exact path a
  // person takes, and it was the only one not covered.
  const seen = { rms: {}, worst: null };
  let started = false, prev = null;
  for (const g of GENRES) {
    // genres STACK, so switching means taking the previous one off first —
    // clicking six in a row would otherwise build one six-deep box
    await page.locator(".pchip", { hasText: new RegExp("^" + g + "$") }).click();
    if (prev && prev !== g)
      await page.locator(".pchip", { hasText: new RegExp("^" + prev + "$") }).click();
    prev = g;
    if (!started) { await page.click("#play"); started = true; }
    await page.waitForTimeout(3500);                 // decode + a bar or two
    let peak = 0;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(180);
      const r = await page.evaluate(() => (window.__rms ? window.__rms() : 0));
      if (r > peak) peak = r;
    }
    seen.rms[g] = +peak.toFixed(4);
  }
  await page.click("#play");                          // stop

  // (A) nothing clamps
  const writes = await page.evaluate(() => window.__param.filter(p => /\/freq$/.test(p.path)));
  const nodes = await page.evaluate(() => [...new Set(window.__nodes)]);
  console.log("  worklets instantiated:", nodes.join(", ") || "(none)");
  console.log("  freq writes captured :", writes.length);
  if (!writes.length) fail("no synth freq writes captured — the synth path never ran");
  else ok(`${writes.length} freq writes across ${new Set(writes.map(w => w.node)).size} voice(s)`);

  const clamped = writes.filter(w => w.value <= w.min + 1e-6 || w.value >= w.max - 1e-6);
  if (clamped.length) {
    const c = clamped[0];
    fail(`${clamped.length} freq write(s) sit ON a param boundary — that is a clamp, ` +
         `and different notes collapse onto one pitch. e.g. ${c.path}=${c.value} ` +
         `in [${c.min}..${c.max}]`);
  } else ok("every freq write is strictly inside its param's declared range");

  const out = writes.filter(w => w.value < w.min || w.value > w.max);
  if (out.length) fail(`${out.length} freq write(s) outside the declared range entirely`);
  else ok("no freq write exceeds its range");

  // (B) it makes a sound
  for (const g of GENRES) {
    if (seen.rms[g] >= RMS_FLOOR) ok(`${g}: peak RMS ${seen.rms[g]}`);
    else fail(`${g}: peak RMS ${seen.rms[g]} — that is silence (floor ${RMS_FLOOR})`);
  }

  // (D) THE EDGES STILL TRIM. Length and nudge are the only controls with no
  // audible signature of their own — a dead grip changes nothing you can hear,
  // it just quietly stops working, and it had been dead since the stack refactor
  // because the guard still tested a field that no longer exists.
  {
    const box = page.locator(".box").first();
    const before = await page.locator(".bhead span").first().textContent();
    const g = await box.locator(".grip.r").boundingBox();
    if (!g) fail("the length grip does not exist");
    else {
      await page.mouse.move(g.x + 5, g.y + g.height / 2);
      await page.mouse.down();
      await page.mouse.move(g.x + 5 + 4 * 26, g.y + g.height / 2, { steps: 10 });
      await page.mouse.up();
      const after = await page.locator(".bhead span").first().textContent();
      if (after === before) fail(`the length grip did not change the box (${before})`);
      else ok(`length grip: ${before} -> ${after}`);
    }
    const l = await box.locator(".grip.l").boundingBox();
    if (!l) fail("the nudge grip does not exist");
    else ok("both edge grips exist");
  }

  // (E) THE MIXER IS REAL. A section carries an insert chain, two sends and a
  // level, and every one of those is a claim about NODES that a screenshot of
  // the chips cannot check. buildInsertNodes reports the stages it actually
  // built, so a chip that lit up and did nothing is visible from here — which is
  // the whole failure mode this project keeps rediscovering.
  {
    const chip = (t) => page.locator(".pchip", { hasText: new RegExp("^" + t + "$") }).first();
    const tab = (t) => page.locator(".ptab", { hasText: new RegExp("^" + t + "$") }).click();
    // average the spectrum over a few seconds of real playback
    const hf = async (secs) => {
      let s = 0, n = 0;
      for (let i = 0; i < secs * 5; i++) {
        await page.waitForTimeout(200);
        s += await page.evaluate(() => window.__hf()); n++;
      }
      return s / n;
    };
    // ONE SHORT SECTION, ON ITS OWN LOOP. The genre sweep above leaves the box
    // on the last genre it clicked, which is eight bars of half-time sludge —
    // about thirty seconds a pass. Sampling four seconds of that compares two
    // different parts of the song and calls the difference an effect. Acid is
    // four bars at rate 1, and a double-click loops that box alone, so both
    // measurements below cover the same music.
    await tab("sound");
    await chip("Acid house").click();
    await chip("Sludge").click();                        // take the previous one off
    await page.locator(".box").first().dblclick();
    await tab("effects");
    for (const f of ["chorus", "tape echo"]) await chip(f).click();
    await chip("drown").click();                         // the reverb send
    await page.click("#play");
    await page.waitForTimeout(2500);                     // decode + a bar

    // THE GRAPH. buildInsertNodes reports the stages it actually built, so a
    // chip that lit up and passed the signal dry is visible from here.
    const mix = await page.evaluate(() => (window.__nuMix ? window.__nuMix() : null));
    if (!mix) fail("window.__nuMix is missing — the page exposes no mixer at all");
    else {
      ok(`master bus built, reverbs: ${mix.verbs.join("/")}`);
      const c = mix.channels.find(x => x.fx.length === 2);
      if (!c) fail(`no channel carries the two effects that were switched on ` +
                   `(channels: ${JSON.stringify(mix.channels.map(x => x.fx))})`);
      else if (c.stages.join(",") !== "chorus,delay")
        fail(`the chain declared [${c.fx}] but BUILT [${c.stages}] — a chip lit up ` +
             `and passed the signal dry`);
      else ok(`insert chain declared ${JSON.stringify(c.fx)} and built [${c.stages}]`);
      const wet = mix.channels.find(x => x.rev >= 0.85);
      if (!wet) fail(`the "drown" reverb send did not reach a send gain ` +
                     `(saw ${mix.channels.map(x => x.rev).join(", ")})`);
      else ok(`reverb send is a real gain: ${wet.rev} into the ${wet.verb}`);
    }

    // ...AND IT IS AUDIBLE. `crunch` is the staged amp: three waveshaper stages
    // that add harmonics, then a 4x12 cab that rolls the top off. Those two pull
    // the spectrum in OPPOSITE directions, so "the highs go up" is not a
    // property of the module and asserting it would be asserting a coincidence.
    // What IS a property is that the sound changes — a decorative chain, one
    // built and then bypassed, moves the spectrum by nothing at all. Averaged
    // over a whole pass of the same four bars, a quarter is far outside the
    // few-percent drift between two passes.
    const clean = await hf(8);
    await chip("crunch").click();
    await page.waitForTimeout(2500);
    const dirty = await hf(8);
    await page.click("#play");
    const moved = Math.abs(dirty - clean) / (clean || 1);
    console.log(`  spectrum above 4 kHz  : clean ${clean.toFixed(4)} -> crunch ${dirty.toFixed(4)} ` +
                `(${(moved * 100).toFixed(0)}%)`);
    if (moved > 0.25)
      ok(`the insert chain changes the rendered sound: HF ${clean.toFixed(4)} -> ${dirty.toFixed(4)}`);
    else fail(`switching on a distortion insert moved the spectrum by ${(moved * 100).toFixed(0)}% — ` +
              `the chain is built but not in the signal path ` +
              `(HF ${clean.toFixed(4)} -> ${dirty.toFixed(4)})`);
  }

  // (F) ONE BUTTON, A WHOLE SONG. The composer is pure and seeded, and
  // test/unit/nukernel.test.js already checks 560 of its songs — what it cannot
  // check is the part that only exists in the browser: that its output survives
  // applyState (the same paranoid loader a file off the desktop goes through),
  // reaches the song row with its section labels, and PLAYS.
  {
    // THE SONGS THAT SHIP still load. Every mixer field added to a box widened
    // okBox, and a preset written before any of them exists is the exact input
    // that a too-strict validator drops on the floor — silently, since the whole
    // point of that path is that it refuses rather than half-loads.
    const first = await page.locator("#preset option").nth(1).getAttribute("value");
    await page.selectOption("#preset", first);
    await page.waitForTimeout(300);
    const pre = await page.locator("#readout").textContent();
    if (/failed to load/.test(pre)) fail(`the shipped preset "${first}" no longer loads`);
    else ok(`the shipped preset "${first}" still loads`);

    await page.selectOption("#composeg", "rock");
    await page.click("#compose");
    await page.waitForTimeout(400);
    const roles = await page.locator(".box .role").allTextContents();
    const readout = await page.locator("#readout").textContent();
    if (/rejected/.test(readout))
      fail(`the composer emitted a song its own loader refused: ${readout}`);
    else if (roles.length < 6)
      fail(`the composed song has ${roles.length} labelled sections — applyState ` +
           `took it but the roles did not survive`);
    else if (!/verse/.test(roles.join(" ")) || !/chorus/.test(roles.join(" ")))
      fail(`the composed arrangement has no verse or chorus: ${roles.join(" ")}`);
    else ok(`composed ${roles.length} labelled sections: ${roles.join(" → ")}`);

    // PAST THE INTRO. A composed song opens on a half-length intro that fades in
    // at a reduced level — which is the arrangement working — so a short sample
    // taken from the top measures the quietest bars in the song and calls the
    // result marginal.
    await page.click("#play");
    await page.waitForTimeout(9000);
    let peak = 0;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(200);
      const r = await page.evaluate(() => window.__rms());
      if (r > peak) peak = r;
    }
    await page.click("#play");
    if (peak >= RMS_FLOOR) ok(`the composed song plays: peak RMS ${peak.toFixed(4)}`);
    else fail(`the composed song is silent (peak RMS ${peak.toFixed(4)})`);
  }

  // (G) IT WORKS WITHOUT A MOUSE. Two controls had no touch equivalent at all:
  // lowering a value needed SHIFT-click, and reordering a box needed HTML5
  // drag-and-drop, which does not fire on touch in any browser. Both looked like
  // the page being broken rather than the page being desktop-only. These are the
  // replacements, and they are checked the way a finger would use them — one
  // plain click each, no modifier, no drag.
  {
    const roleAt = () => page.locator(".box .role").allTextContents();
    const before = await roleAt();
    const later = page.locator(".box").first().locator(".btools .t").first();
    if (!(await later.count())) fail("a box has no move buttons — touch cannot reorder a song");
    else {
      await later.click();
      const after = await roleAt();
      if (after[0] === before[0] && after[1] === before[1])
        fail(`the move button did not reorder the song (${before.join(",")})`);
      else ok(`move button reorders without dragging: ${before[0]},${before[1]} -> ${after[0]},${after[1]}`);
    }
    // and a value can go DOWN with an ordinary tap
    const cell = page.locator('.cell[aria-label^="step 3 deg"]').first();
    const read = async () => +(await cell.getAttribute("aria-label")).split(" ").pop();
    const v0 = await read();
    await page.click("#stepdir");
    await cell.click();
    const v1 = await read();
    if (v1 < v0) ok(`a plain tap lowers a value once the toggle is set: ${v0} -> ${v1}`);
    else fail(`with "tap lowers" set, tapping a cell went ${v0} -> ${v1} — ` +
              `lowering a value still needs a shift key`);
    await page.click("#stepdir");
    await cell.click();
    if ((await read()) > v1) ok("the toggle flips back and a tap raises again");
    else fail("the raise/lower toggle does not flip back");
  }

  // (C) no fallback fired
  const osc = await page.evaluate(() => window.__osc);
  const fb = await page.evaluate(() => window.__nuFallback);
  console.log(`  oscillators started   : ${osc} (effect LFOs + any fallback)`);
  if (fb == null) fail("window.__nuFallback is missing — the page is not counting its fallback voices");
  else if (fb) fail(`${fb} hand-rolled fallback voice(s) started — a sampled or synth ` +
                    `voice did not cover something, and the fallback is audibly wrong`);
  else ok("no fallback voice fired: every voice is a real instrument");

  if (errs.length) fail(`page errors: ${errs.slice(0, 3).join(" | ")}`);
  else ok("no page errors");

  await browser.close(); await srv.close();
  console.log(`\nnukernel-audio: ${checks} checks` +
              (process.exitCode ? " — FAILURES ABOVE" : " pass"));
})().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
