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
//
//   (E/E2) THE MIXER AND THE MASTER ARE REAL. A section's insert chain, sends
//       and level are claims about NODES, and so are the song's master-bus
//       globals (fields.js MASTER — drive/glue/tape/space/width/tilt/ceiling).
//       Both are read back off the built graph through window.__nuMix and both
//       are held to the same spectral SHAPE witness, because the master ends in
//       a brickwall whose job is flattening the level difference a treatment
//       makes. E2 also holds the two budgets the master could quietly break:
//       `space` must cost no third convolver, and clearing every global must
//       restore the exact seven-node default chain (safety net included).
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8971;
const RMS_FLOOR = 0.01;                 // silence is ~1e-4; music here runs 0.2..0.6
// EVERY genre, not a sample of them — DERIVED from the data tier, so the
// claim stays true by construction. The list was a hand-maintained literal
// once, and the radio-dial batch left 22 of 45 genres with zero coverage for
// exactly the failures this gate exists to catch: a zone that does not
// decode, a freq param that clamps, a silent instrument — all per genre.
// genres.js is UMD (the unit gate already requires it) and the labels are
// the .pchip text the sweep clicks, exactly.
const NG = require("../../nukernel/genres.js");
const GENRES = Object.values(NG.GENRES).map(g => g.label);
const RATE_OF = Object.fromEntries(Object.values(NG.GENRES).map(g => [g.label, g.rate]));

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
    // the raw spectrum, for SHAPE comparisons. __hf's above-4kHz fraction is
    // the right read for a filter closing; it is blind to treatments that
    // relocate energy WITHIN bands (ring mod's sidebands, a mild saturation),
    // which is exactly what "is this chain in the signal path" must detect
    // whatever taste has done to the effect's intensity. Callers average
    // linear magnitudes over a window and correlate.
    window.__spec = () => {
      const n = an.frequencyBinCount, d = new Float32Array(n);
      an.getFloatFrequencyData(d);
      return Array.from(d.slice(0, 512), (db) => Math.pow(10, db / 20));
    };
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

  // THE CELL IS THE DOOR ("the row and the board", 2026-08-15): a song row is
  // a rank of named cells and each cell opens ITS OWN popup in #rowpop. The
  // helpers below take the path a finger takes — tap the cell, work in the
  // popup, Esc out. `row(n)` stays the GENRE cell: clicking it opens the
  // GENRE popup (the genre banks live there now) and dblclicking it still
  // loops the row, so every old `row(n)` gesture keeps its meaning.
  const row = (n) => page.locator(".box").nth(n).locator(".bgenre");
  const cellOf = (n, k) => page.locator(".box").nth(n).locator(`.bcell[data-cell="${k}"]`);
  const openCell = async (n, k) => {
    await cellOf(n, k).click();
    await page.waitForSelector("#rowpop:not([hidden])", { timeout: 10000 });
  };
  const closeCell = async () => {
    await page.keyboard.press("Escape");
    await page.waitForSelector("#rowpop", { state: "hidden" });
  };

  // THE PHRASE EDITOR IS A POPUP: #stepgrid / .slot / #seed live inside
  // #edpop, reached the way a finger reaches them — a PATTERN chip on the
  // row (the default song ships box 1 with phrase 1 on, so the chip exists).
  // Esc closes it; the deck behind is untouched.
  const openEditor = async () => {
    await page.locator(".box").first().locator(".bch").first().click();
    await page.waitForSelector("#edpop:not([hidden])", { timeout: 10000 });
  };
  const closeEditor = async () => {
    await page.keyboard.press("Escape");
    await page.waitForSelector("#edpop", { state: "hidden" });
  };

  // one phrase, in the one box, for every genre in turn. The default song
  // ships phrase 1 already switched ON in box 1 now (the fresh page must
  // sound), and a .slot click TOGGLES — so only click it in if it is out,
  // the same guard the survival gate's boot() carries.
  await openEditor();
  const slot0 = page.locator(".slot").nth(0);
  if ((await slot0.getAttribute("aria-pressed")) !== "true") await slot0.click();
  await page.click("#seed");
  await closeEditor();

  // SWITCH WHILE IT PLAYS for all but the first: assets used to be fetched only
  // by the transport start, so a genre chosen mid-play had no instrument and no
  // kit and fell straight through to the oscillator. That is the exact path a
  // person takes, and it was the only one not covered.
  const seen = { rms: {}, worst: null };
  let started = false, prev = null;
  for (const g of GENRES) {
    // the genre chips live in box 1's GENRE popup now — open it, click, Esc
    // (the popup's scrim would otherwise sit over #play). Genres STACK, so
    // switching means taking the previous one off after the new one lands —
    // clicking six in a row would otherwise build one six-deep box.
    await openCell(0, "genre");
    await page.locator(".pchip", { hasText: new RegExp("^" + g + "$") }).click();
    // SETTLE PAST THE PREDECESSOR, not a stopwatch. A genre switch lands on
    // the next bar line and cancels nothing already scheduled — at the page's
    // 126 bpm a rate-0.25 bucket is 7.6 s, plus the 150 ms lookahead and a
    // ~3.2 s release/verb tail. A fixed 3.5 s window could be FILLED by the
    // old genre still sounding, crediting the neighbour's audio to the genre
    // under test — a silent genre passed on Drone's leftovers about half the
    // time. So the wait covers the predecessor's whole bucket + tail first.
    let settle = 3500;
    if (prev && prev !== g) {
      await page.locator(".pchip", { hasText: new RegExp("^" + prev + "$") }).click();
      const prevBarMs = (16 / RATE_OF[prev]) * (60 / 126 / 4) * 1000;
      settle = Math.max(3500, prevBarMs + 150 + 3200) + 3500;
    }
    await closeCell();
    prev = g;
    if (!started) { await page.click("#play"); started = true; }
    await page.waitForTimeout(settle);               // predecessor gone + decode + bars
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
  // audible signature of their own — a dead trim changes nothing you can hear,
  // it just quietly stops working, and it had been dead since the stack refactor
  // because the guard still tested a field that no longer exists.
  //
  // REWRITTEN FOR THE SONG TABLE (Stage 2). The controls being checked are the
  // same two, doing the same thing to the same fields; what moved is where you
  // reach them. The song is a table of full-width rows at every width now, so
  // a row has no width to drag and the edge grips are gone with it — length and
  // nudge are steppers in the row's option sheet, which is also the only form
  // of them a touch screen ever had. So: open row 1, press the bars [+], and
  // assert the same aria-label bar count grows. Same property (the edges trim),
  // new reading (the popover steppers, not a pointer drag on a 10px handle).
  {
    const box = page.locator(".box").first();
    // read the ARIA LABEL, not a cell: "box 1, Simple, 4 bars" is the
    // machine-readable truth about length and already load-bearing API
    // The steppers live in their own cells' popups now: bars in BARS#, nudge
    // in TIMING (a nudge is a when, not a how-long).
    const before = await box.getAttribute("aria-label");
    await openCell(0, "bars");
    const pop = page.locator("#rowpop");
    if (!(await pop.isVisible())) fail("clicking the bars cell did not open its popup");
    else ok("the BARS cell opens its popup");
    const plus = pop.locator('.rpstep', { hasText: /bars/ })
                    .locator('button[aria-label="one bar more"]');
    if (!(await plus.count())) fail("the bars popup has no stepper — nothing trims the length");
    else {
      for (let i = 0; i < 4; i++) await plus.click();
      const after = await box.getAttribute("aria-label");
      const n = s => +(String(s).match(/(\d+) bars/) || [0, 0])[1];
      if (!(n(after) > n(before)))
        fail(`the bars stepper did not lengthen the box (${before} -> ${after})`);
      else ok(`bars stepper: ${before} -> ${after}`);
    }
    await closeCell();
    // ...and nudge, the other edge, in the TIMING cell's popup
    await openCell(0, "timing");
    const nud = pop.locator('.rpstep', { hasText: /nudge/ })
                   .locator('button[aria-label="one bar of nudge more"]');
    if (!(await nud.count())) fail("the timing popup has no nudge stepper");
    else ok("both edge controls (bars, nudge) are steppers in their cells' popups");
    await pop.locator(".rpx").click();
    if (await pop.isVisible()) fail("the popup's ✕ did not close it");
    else ok("the popup closes on ✕");
  }

  // (E) THE MIXER IS REAL. A section carries an insert chain, two sends and a
  // level, and every one of those is a claim about NODES that a screenshot of
  // the chips cannot check. buildInsertNodes reports the stages it actually
  // built, so a chip that lit up and did nothing is visible from here — which is
  // the whole failure mode this project keeps rediscovering.
  {
    const chip = (t) => page.locator(".pchip", { hasText: new RegExp("^" + t + "$") }).first();
    // THE BOX'S OWN MIX FIELDS live on the MIX page's SECTION row now (the
    // palette's fx tab went with pg-palette): tap the section row's cell,
    // click the chip in its popover. A one-of cell closes on the choice; the
    // effects cell stays open and Esc dismisses it.
    const secRow = page.locator(".mrow.msec");
    const mchip = (t) => page.locator(".mchip", { hasText: new RegExp("^" + t + "$") }).first();
    const secCell = async (f) => {
      await secRow.locator(`.mval[data-field="${f}"]`).click();
      await page.waitForSelector("#mixpop:not([hidden])", { timeout: 10000 });
    };
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
    await openCell(0, "genre");
    await chip("Acid house").click();
    await chip("Sludge").click();                        // take the previous one off
    await closeCell();
    await row(0).dblclick();                             // loops it AND starts it
    await secCell("fx");                                 // the chain stays open
    for (const f of ["chorus", "tape echo"]) await mchip(f).click();
    await page.keyboard.press("Escape");
    await secCell("rev");
    await mchip("drown").click();                        // the reverb send; one-of closes

    // WAIT FOR THE BAR, not for a stopwatch. A mix change lands on the next bar
    // line — deliberately, because rebuilding a channel under a sounding note is
    // a click — so the channel carrying these chips does not exist until the
    // section comes round. Polling for it is both correct and the difference
    // between a gate and a coin toss: headless chromium's audio clock does not
    // run at wall-clock rate, so "wait 2.5 seconds" is not a bar.
    const waitMix = async (pred, ms) => {
      const t0 = Date.now();
      let m = null;
      while (Date.now() - t0 < ms) {
        m = await page.evaluate(() => (window.__nuMix ? window.__nuMix() : null));
        if (m && pred(m)) return m;
        await page.waitForTimeout(250);
      }
      return m;
    };
    const mix = await waitMix(m => m.channels.some(x => x.fx.length === 2), 20000);
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
    // ...AND THE LEVEL IS A GAIN NODE, not a spec echo: __nuMix reports
    // c.lvl.gain.value (the one place lvl reaches audio, shared by live and
    // bounce), so a buildChannel that stopped applying it cannot hide behind
    // a level-blind RMS floor and a level-flattening master limiter — the
    // composed arc's "last chorus outweighs the first" rides this gain.
    {
      await secCell("lvl");
      await mchip("forward").click();                  // LEVELS.fwd = 1.35; one-of closes
      const lm = await waitMix(m => m.channels.some(x => Math.abs(x.level - 1.35) < 1e-3), 20000);
      if (!lm || !lm.channels.some(x => Math.abs(x.level - 1.35) < 1e-3))
        fail(`the "forward" level chip never reached a gain node ` +
             `(levels: ${lm && lm.channels.map(x => x.level).join(", ")})`);
      else ok("the level chip is a real gain: a channel's lvl.gain.value reads 1.35");
      await secCell("lvl");
      await mchip("forward").click();                  // back off for the spectrum read
    }

    // ...AND IT IS AUDIBLE — measured as spectral SHAPE, not the above-4kHz
    // fraction. The old read failed the moment taste turned the crunch down
    // (the 2026-08-14 retune left a one-stage half-mix amp that moves the HF
    // fraction by ~13%, under the old 25% bar), and ring mod fooled it too:
    // sidebands relocate energy WITHIN bands, 4% on the fraction. But "is the
    // chain in the signal path" is not a question about intensity. Averaged
    // linear spectra correlate at ~0.995 between two passes of the SAME sound
    // (measured); any real treatment — the tamed crunch included — bends the
    // shape to ~0.94. The 0.98 bar sits between with margin on both sides,
    // and a decorative chain, built then bypassed, cannot cross it.
    const spec = async (s) => {
      let acc = null, n = 0;
      for (let i = 0; i < s * 5; i++) {
        await page.waitForTimeout(200);
        const v = await page.evaluate(() => window.__spec());
        acc = acc ? acc.map((x, j) => x + v[j]) : v; n++;
      }
      return acc.map(x => x / n);
    };
    const corr = (a, b2) => {
      const ma = a.reduce((x, y) => x + y) / a.length, mb = b2.reduce((x, y) => x + y) / b2.length;
      let num = 0, da = 0, db = 0;
      for (let i = 0; i < a.length; i++) {
        const x = a[i] - ma, y = b2[i] - mb; num += x * y; da += x * x; db += y * y;
      }
      return num / Math.sqrt(da * db);
    };
    const clean = await spec(8);
    await secCell("fx");
    await mchip("crunch").click();
    await page.keyboard.press("Escape");
    await waitMix(m => m.channels.some(x => x.fx.length === 3), 20000);
    const dirty = await spec(8);

    // (E2) THE MASTER BUS — the same witness, one level up. A global is a
    // SESSION control (fields.js MASTER, the session bank on the SONG page):
    // drive, glue, tape, space, width, tilt and ceiling, every one of them a
    // stage of the parent's own fx_bus master section. The failure mode is
    // identical to the insert chain's and so is the proof: a select that lit up
    // and left the signal untouched is invisible to every other check here,
    // because the master bus ends in a compressor and a brickwall whose job is
    // to flatten exactly the level difference a treatment makes.
    //
    // The chain SWAPS rather than mutates (a wobble is delay nodes, a width is
    // a splitter), so this doubles as the crossfade's only witness: the page
    // must still be sounding on the other side of it.
    let mfail = null, mcorr = null, mrep = null, mfull = null;
    {
      await secCell("fx");
      await mchip("crunch").click();                   // back to the two-insert mix
      await page.keyboard.press("Escape");
      await waitMix(m => m.channels.some(x => x.fx.length === 2), 20000);
      const before = await spec(6);
      // set every global through the REAL controls, the way a finger would.
      // The masters are the MIX page's rack KNOBS now (ui/mixtbl.js buildKnob,
      // ids #m-<key> kept): role=slider, Home is the empty detent, ArrowRight
      // steps, data-value mirrors the detent — so a gate drives them blind.
      const setKnob = async (id, want) => {
        const k = page.locator("#" + id);
        await k.focus();
        await page.keyboard.press("Home");
        for (let i = 0; i < 12; i++) {
          if ((await k.getAttribute("data-value")) === (want || "")) return;
          await page.keyboard.press("ArrowRight");
        }
        if ((await k.getAttribute("data-value")) !== (want || ""))
          fail(`the rack knob #${id} never reached "${want}" by keyboard`);
      };
      for (const [id, v] of [["m-drive", "dirt"], ["m-tape", "worn"],
                             ["m-space", "hall"], ["m-tilt", "dark"],
                             ["m-width", "huge"], ["m-glue", "pump"],
                             ["m-ceiling", "loud"]])
        await setKnob(id, v);
      await page.waitForTimeout(1200);                 // past the chain crossfade
      mfull = await page.evaluate(() => window.__nuMix());
      mrep = mfull.master;
      const after = await spec(6);
      mcorr = corr(before, after);
      // …and turn them off again (Home = the empty detent, the one spelling of
      // absent), so nothing below inherits a treated master
      for (const id of ["m-drive", "m-tape", "m-space", "m-tilt", "m-width",
                        "m-glue", "m-ceiling"])
        await setKnob(id, "");
      await page.waitForTimeout(800);
      mfail = await page.evaluate(() => window.__nuMix().master);
    }

    await page.click("#play");
    const r = corr(clean, dirty);
    {
      if (!mrep) fail("__nuMix has no `master` object — the master bus reports nothing");
      else {
        const want = ["space", "drive", "glue", "tilt", "tape", "width", "ceiling"];
        const missing = want.filter(s => !mrep.stages.includes(s));
        if (missing.length)
          fail(`the session bank set every global but the master chain BUILT ` +
               `only [${mrep.stages}] — missing ${missing.join(",")}, i.e. a ` +
               `select that lit up and reached no node`);
        else ok(`the master chain built every stage asked for: [${mrep.stages}]`);
        // the numbers are the AudioParams', not the table's
        if (!(mrep.glue.ratio > 2.2) || !(mrep.ceiling.push > 1) ||
            !(mrep.tape && mrep.tape.wob > 0) || !(mrep.width > 1) ||
            !(mrep.tilt && mrep.tilt.lo > 0))
          fail(`the master report echoes a spec rather than the nodes: ` +
               JSON.stringify(mrep));
        else ok(`master params read off the nodes: glue ${mrep.glue.ratio}:1, ` +
                `push ${mrep.ceiling.push}, wob ${mrep.tape.wob}, width ${mrep.width}`);
      }
      // THE BUDGET SURVIVES THE MASTER. `space` is a master reverb, and the
      // cheap way to build one is a third ConvolverNode — which is exactly the
      // budget (H) below holds this page to. It is live.js's vapor wash
      // (pre-delay + three damped combs) for that reason, and this is the check
      // that keeps it that way.
      if (mfull && mfull.convolvers > 2)
        fail(`${mfull.convolvers} convolution reverbs with the master globals armed — ` +
             `\`space\` built a convolver instead of the delay wash, and the ` +
             `page's two-convolver budget is gone`);
      else if (mfull)
        ok(`the master room costs no convolver: ${mfull.convolvers} built, ` +
           `${mfull.worklets} worklets`);
      console.log(`  master shape corr     : plain vs treated ${mcorr.toFixed(4)}`);
      if (mcorr < 0.98)
        ok(`the master bus changes the rendered sound: shape correlation ${mcorr.toFixed(4)}`);
      else fail(`arming every master global left the spectral shape at ` +
                `${mcorr.toFixed(4)} correlation (>= 0.98 is indistinguishable from ` +
                `two passes of the same sound) — the chain is built but not in ` +
                `the signal path`);
      // ABSENT IS TODAY, from outside: clearing every select must put the chain
      // back to the SEVEN default nodes (input, busComp, makeup, limiter, lp,
      // safety, out — the safety net is unconditional since b1adc27; this line
      // said 6 for one commit and failed on the truth) and the shipped default
      // numbers — glue -22/2.2 into the RESTAGED x1.4 makeup (2026-08-16 gain
      // staging; fields.js GLUES carries the measurement), the brickwall at -1.5.
      if (!mfail) fail("__nuMix lost its `master` object after the globals were cleared");
      else if (mfail.stages.length || mfail.nodes !== 7 ||
               mfail.glue.threshold !== -22 || mfail.glue.ratio !== 2.2 ||
               mfail.glue.makeup !== 1.4 || mfail.ceiling.threshold !== -1.5 ||
               mfail.ceiling.push !== 1 || mfail.ceiling.clip !== 0)
        fail(`clearing every global did not restore the chain the page has always ` +
             `built (stages [${mfail.stages}], ${mfail.nodes} nodes, ` +
             `${JSON.stringify(mfail.glue)} / ${JSON.stringify(mfail.ceiling)}) — ` +
             `absent must be today, or every song saved before the globals changes sound`);
      else ok("clearing every global restores the seven-node chain at the shipped default numbers");
    }
    console.log(`  spectral shape corr   : clean vs crunch ${r.toFixed(4)} ` +
                `(same-sound drift measures ~0.995, any real treatment ~0.94)`);
    if (r < 0.98)
      ok(`the insert chain changes the rendered sound: shape correlation ${r.toFixed(4)}`);
    else fail(`switching on the crunch insert left the spectral shape at ` +
              `${r.toFixed(4)} correlation (>= 0.98 is indistinguishable from ` +
              `two passes of the same sound) — the chain is built but not in ` +
              `the signal path`);
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
    // VOLUME IS A DEVICE SETTING (2026-08-16): set the fader, then walk BOTH
    // adopt doors below (a shipped preset, then the composer) — the fader must
    // not move, because adoptSong no longer reads `vol` off an incoming song.
    await page.evaluate(() => {
      const v = document.getElementById("vol");
      v.value = "37"; v.dispatchEvent(new Event("input", { bubbles: true }));
    });
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

    // …and the fader stayed where the finger left it, on the glass AND in the
    // store the graph reads — through a preset load and a composed song
    const stick = await page.evaluate(async () => {
      const stm = await import("/nukernel/ui/state.js");
      return { glass: document.getElementById("vol").value, store: stm.vol,
               saved: localStorage.getItem("nukernel.vol.v1") };
    });
    if (stick.glass !== "37" || stick.store !== 37 || stick.saved !== "37")
      fail(`volume is not a device setting: after a preset and a composed song ` +
           `the fader reads ${stick.glass}, state ${stick.store}, ` +
           `localStorage ${stick.saved} (all should be 37)`);
    else ok("volume is sticky: preset + composer left the fader at 37 (glass, state, store)");
    // back to the default through the fader (its one writer), so the RMS
    // reads below measure the staging and not this check's quiet setting
    await page.evaluate(() => {
      const v = document.getElementById("vol");
      v.value = "80"; v.dispatchEvent(new Event("input", { bubbles: true }));
    });

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
    // THE MOVE KEYS LIVE IN THE PART POPUP now ("the row and the board"):
    // open the PART cell, press ↓ — and the same reorder is also on
    // ALT+ARROW over a focused row. The CLAIM here is unchanged and is the
    // one that matters: a finger with no drag and no modifier can reorder a
    // song in two plain clicks, because HTML5 dragstart does not fire on
    // touch at all.
    await openCell(0, "part");
    const sheet = page.locator("#rowpop");
    const later = sheet.locator('.rpk[aria-label="move box 1 later"]');
    if (!(await sheet.isVisible()) || !(await later.count()))
      fail("the PART popup has no move keys — touch cannot reorder a song");
    else {
      await later.click();
      const after = await roleAt();
      if (after[0] === before[0] && after[1] === before[1])
        fail(`the PART popup's move key did not reorder the song (${before.join(",")})`);
      else ok(`PART-popup move key reorders without dragging: ${before[0]},${before[1]} -> ${after[0]},${after[1]}`);
    }
    await sheet.locator(".rpx").click();
    await page.waitForTimeout(150);
    // and a value can go DOWN with an ordinary tap: tapping a value cell opens
    // the pop-up fader (ui/popfader.js) — which replaced the ± "Tap raises"
    // mode toggle — and the fader's ▼ key steps the SAME phrase vector down
    // through the same commit("phrase") path a scrub takes. The cells are in
    // the editor popup now, so open it first — the checks are unchanged.
    await openEditor();
    const cell = page.locator('.cell[aria-label^="step 3 deg"]').first();
    const read = async () => +(await cell.getAttribute("aria-label")).split(" ").pop();
    const v0 = await read();
    await cell.click();
    const pop = page.locator("#popfader");
    if (!(await pop.isVisible())) fail("tapping a value cell did not open the pop-up fader");
    else {
      await pop.locator(".pfdown").click();
      const v1 = await read();
      if (v1 < v0) ok(`the fader's step-down key lowers the value: ${v0} -> ${v1}`);
      else fail(`the pop-up fader's ▼ went ${v0} -> ${v1} — a value still cannot go down`);
      await pop.locator(".pfclose").click();
      if (await pop.isVisible()) fail("the pop-up fader's ✕ did not close it");
      else ok("the fader closes on ✕");
    }
    // ...while a BINARY cell keeps tap-to-toggle: no fader, just the flip
    const gcell = page.locator('.cell[aria-label^="step 3 gate"]').first();
    const gread = async () => (await gcell.getAttribute("aria-label")).split(" ").pop();
    const g0 = await gread();
    await gcell.click();
    const g1 = await gread();
    if (g1 !== g0 && !(await pop.isVisible()))
      ok(`a plain tap still toggles a gate: ${g0} -> ${g1}`);
    else fail(`tapping a gate cell went ${g0} -> ${g1}` +
              ((await pop.isVisible()) ? " and opened a fader" : ""));
    await gcell.click();                                  // put the groove back
    await closeEditor();
  }

  // (G2) THE INTERFACE IS ROTATED, AND IT IS ONE IDIOM.
  //
  // The standing design law: don't go left to right, go top to bottom, make
  // them tables — and NOT only on a phone. There is no desktop bench any more;
  // a wide screen gets the same two tables with more room. This page is 1400px
  // wide, which is exactly where the old layout put its lanes and its piano
  // roll SIDEWAYS, so it is the right place to measure the rotation rather
  // than admire it.
  //
  // Measured, not asserted by class name: in the pattern editor, step 2 sits
  // BELOW step 1 and the gate column sits RIGHT OF the deg column; in the
  // arrangement, tick 2 sits BELOW tick 1 and voice 2 sits RIGHT OF voice 1.
  // Plus the table semantics both surfaces now claim (grid / row /
  // columnheader / rowheader / gridcell), the 44px row floor, and — since the
  // pattern is a COLUMN you read down — the pop-up fader opening BESIDE the
  // cell instead of over the eight ticks under it.
  {
    // the editor is a POPUP: the table shape, the rotation and the fader
    // placement are the same questions, asked inside #edpop. Two things
    // CHANGED with the popup and are asserted the new way round: gate/acc/sld
    // lead the columns (deg sits RIGHT of gate now), and the rows are TIGHT —
    // markedly under the old 44px slabs, but still a finger target.
    await openEditor();
    await page.click("#rnd");            // varied values, so the bars can be read
    const ed = await page.evaluate(() => {
      const g = document.getElementById("stepgrid");
      const r = (s) => g.querySelector(s).getBoundingClientRect();
      const s1 = r('.cell[aria-label^="step 1 deg"]'), s2 = r('.cell[aria-label^="step 2 deg"]');
      const deg = r('.rowlab[data-row="deg"]'), gate = r('.rowlab[data-row="gate"]');
      // THE BAR IS THE VALUE — read the ARTIFACT: each vel cell's .cbar must
      // stand v/9 of the cell, and a bipolar cell's bar must sit on the right
      // side of the midline for its sign. Random values, exact law.
      const vel = [...g.querySelectorAll('.cell[data-row="vel"]')].map(c => {
        const v = +c.getAttribute("aria-label").split(" ").pop();
        const cr = c.getBoundingClientRect(), br = c.querySelector(".cbar").getBoundingClientRect();
        return { v, frac: br.height / cr.height };
      });
      const bip = [...g.querySelectorAll('.cell[data-row="deg"]')].map(c => {
        const v = +c.getAttribute("aria-label").split(" ").pop();
        const cr = c.getBoundingClientRect(), br = c.querySelector(".cbar").getBoundingClientRect();
        const mid = cr.top + cr.height / 2;
        // side by the ANCHORED edge, not a ±2px band: the bar grows FROM the
        // midline, so a + bar's bottom and a − bar's top both sit ON it, and
        // the other edge says the sign. A band test read a |v|=1 bar (~2px,
        // both edges inside the band) as "above" whichever side it hung.
        return { v, h: br.height,
          side: br.height < 1 ? 0
              : (Math.abs(br.bottom - mid) <= 1 && br.top < mid - 1) ? 1
              : (Math.abs(br.top - mid) <= 1 && br.bottom > mid + 1) ? -1 : 9 };
      });
      return { role: g.getAttribute("role"),
        rows: g.querySelectorAll('.prow[role="row"]').length,
        colh: g.querySelectorAll('[role="columnheader"]').length,
        rowh: g.querySelectorAll('[role="rowheader"]').length,
        cells: g.querySelectorAll('[role="gridcell"]').length,
        down: Math.round(s2.top - s1.top), across: Math.round(deg.left - gate.left),
        rowH: Math.round(s1.height), vel, bip };
    });
    if (ed.role !== "grid" || ed.rows !== 17 || ed.colh !== 9 || ed.rowh !== 16 || ed.cells !== 128)
      fail("the pattern editor is not a 16-row × 8-column table: " + JSON.stringify(
        { role: ed.role, rows: ed.rows, colh: ed.colh, rowh: ed.rowh, cells: ed.cells }));
    else ok(`the editor popup is a table: ${ed.rows - 1} step rows × ${ed.colh - 1} vector ` +
            `columns (${ed.cells} gridcells, ${ed.rowh} rowheaders)`);
    if (ed.down < 20 || ed.across <= 0)
      fail(`the editor's columns are wrong (step 2 is ${ed.down}px below step 1, ` +
           `deg is ${ed.across}px right of gate — the switches must lead)`);
    else ok(`time runs DOWN and gate/acc/sld LEAD the columns ` +
            `(+${ed.down}px per step, deg +${ed.across}px right of gate)`);
    if (ed.rowH < 20 || ed.rowH > 40)
      fail(`a step row is ${ed.rowH}px tall — the popup's cells must be tight ` +
           `(under the old 44px slabs) and still hittable (20px floor)`);
    else ok(`the rows are ${ed.rowH}px — markedly tighter than the 44px page was`);
    // the bar visualization, against the values the labels declare
    const velErr = Math.max(...ed.vel.map(c => Math.abs(c.frac - c.v / 9)));
    if (velErr > 0.15)
      fail(`a vel bar does not stand v/9 of its cell (worst error ${velErr.toFixed(2)})`);
    else ok(`vel bars are unipolar and proportional (worst error ${velErr.toFixed(2)})`);
    const bipBad = ed.bip.filter(c => (c.v > 0 && c.side !== 1) || (c.v < 0 && c.side !== -1) ||
                                      (c.v === 0 && c.h > 1));
    const signs = new Set(ed.bip.map(c => Math.sign(c.v)));
    if (bipBad.length || !ed.bip.some(c => c.v !== 0))
      fail(`${bipBad.length} deg bar(s) sit on the wrong side of the midline ` +
           `(e.g. ${JSON.stringify(bipBad[0] || null)})`);
    else ok(`deg bars are zero-centred: ${ed.bip.length} cells, ` +
            `signs seen ${[...signs].join("/")}, every bar on its value's side`);
    await page.click("#seed");           // the starter phrase back, for (K)

    // the fader beside the cell, not over the column below it
    await page.locator('.cell[aria-label^="step 5 deg"]').first().click();
    const side = await page.evaluate(() => {
      const c = document.querySelector('.cell[aria-label^="step 5 deg"]').getBoundingClientRect();
      const f = document.getElementById("popfader").getBoundingClientRect();
      return { beside: f.left >= c.right - 1 || f.right <= c.left + 1,
        overlapsY: f.top < c.bottom && f.bottom > c.top,
        gapX: Math.round(f.left - c.right) };
    });
    await page.locator("#popfader .pfclose").click();
    if (!side.beside)
      fail(`the pop-up fader still opens over the pattern column (gapX ${side.gapX})`);
    else ok(`the fader anchors beside the cell (${side.gapX}px clear, ` +
            `${side.overlapsY ? "level with it" : "clamped in view"})`);
    await closeEditor();
  }

  // (K) THE PLAYHEAD IS HONEST. The tracker pattern view is gone ("the row
  // and the board"), but its QUESTION survives, repointed at the surfaces
  // that now carry the position: the sounding row's fill bar sweeps (strictly
  // forward, with at most loop-wrap resets), exactly ONE row wears .live at a
  // time, and the position LCD's bar counter advances. Watched on a LOOPED
  // box across ~3s of real playback, because a lamp that lights once and
  // stops is the failure a static read cannot tell from a working one.
  {
    await row(0).dblclick();                              // loop it AND start it
    // WAIT FOR SOUND, don't sleep at it: the first play loads a soundfont, and
    // a fixed 1.2s here reads the loading screen on a busy machine and calls a
    // working playhead broken
    await page.waitForFunction(() => document.getElementById("lcdpos").textContent !== "--",
      null, { timeout: 30000 });
    await page.waitForTimeout(600);                       // past the start transient
    const seen = [], lives = [], lcds = [];
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(250);
      const s = await page.evaluate(() => {
        const live = document.querySelectorAll(".box.live");
        const f = live[0] && live[0].querySelector(".fillbar");
        return { n: live.length,
                 w: f ? f.getBoundingClientRect().width : -1,
                 lcd: document.getElementById("lcdpos").textContent };
      });
      seen.push(s.w); lives.push(s.n); lcds.push(s.lcd);
    }
    await page.click("#play");                            // stop
    if (lives.some((n) => n !== 1))
      fail(`not exactly one .box.live while playing (${lives.join(",")}) — ` +
           `the sounding lamp is leaking rows or dark`);
    else ok("exactly one row wears .live at every sample");
    const distinct = new Set(seen.map((w) => Math.round(w))).size;
    // strictly forward with at most wrap resets: every step either grows the
    // fill or wraps it back toward zero — a stuck bar fails on distinct
    let wraps = 0, backwards = 0;
    for (let i = 1; i < seen.length; i++) {
      if (seen[i] >= seen[i - 1]) continue;
      if (seen[i] < seen[i - 1] * 0.5) wraps++; else backwards++;
    }
    if (distinct < 3 || backwards > 0)
      fail(`the fill bar does not sweep (${seen.map((w) => Math.round(w)).join(",")}` +
           ` — ${distinct} distinct widths, ${backwards} backwards steps)`);
    else ok(`the fill bar sweeps the sounding row: ${distinct} widths over 3s` +
            (wraps ? `, ${wraps} loop wrap(s)` : ""));
    // the LCD is the other reading of the same clock: box·bar/len, moving
    const lcdset = new Set(lcds);
    if (!lcds.every((t) => /^\d+·\d+\/\d+$/.test(t)))
      fail(`the position LCD is not reading box·bar/len while playing: ${lcds.join(" ")}`);
    else if (lcdset.size < 2 && distinct < 6)
      fail(`the position LCD never advanced (${lcds[0]}) and the fill barely moved`);
    else ok(`the position LCD reads the clock: ${[...lcdset].slice(0, 4).join(" → ")}`);
  }

  // (H) THE COMPOSED SONG DOES NOT COST NINE TIMES WHAT IT SHOULD.
  //
  // This is the one failure in the whole page that no correctness check can see:
  // everything works, everything is audible, and it glitches. A Faust worklet
  // computes every 128-sample block whether or not a note is sounding, so the
  // size of the synth pool IS the CPU cost — and keying that pool by channel as
  // well as by voice, which per-section effects appear to require, multiplies it
  // by the number of distinct mixes in the song. A composed vaporwave track has
  // nine sections and about six distinct mixes, each wanting a two-voice DX7
  // plus whichever synth bass its drop asked for. Thirty-six always-on FM
  // voices, and thirty-six wasm compiles to get there.
  //
  // So the pool is global and the ROUTE moves instead. The number below is the
  // whole fix, and it is a number rather than a feeling.
  {
    await page.selectOption("#composeg", "vaporwave");
    await page.click("#compose");
    await page.click("#play");
    await page.waitForTimeout(9000);            // past the intro, into the drops
    const m = await page.evaluate(() => window.__nuMix());
    const boxes = await page.locator(".box").count();
    await page.click("#play");
    console.log(`  composed vaporwave    : ${boxes} sections, ${m.channels.length} channels, ` +
                `${m.worklets} worklets, ${m.convolvers} convolvers, ${m.routes} routes`);
    // eight is the voice-pool ceiling; a synth bass on top of a two-voice DX7
    // cannot need more than that however many sections ask for it
    if (m.worklets > 12)
      fail(`${m.worklets} Faust worklets are running for a ${boxes}-section song — ` +
           `the synth pool is being multiplied by the mix, and every one of those ` +
           `renders continuously`);
    else ok(`the synth pool did not multiply by the mix: ${m.worklets} worklets ` +
            `across ${m.channels.length} channels`);
    if (m.convolvers > 2)
      fail(`${m.convolvers} convolution reverbs are running — they are built on ` +
           `first use, so a song using one space should not be paying for three`);
    else ok(`${m.convolvers} convolver(s) built, on demand`);
  }

  // (I) THE SONG TABLE SHOWS THE SONG. A horizontally scrolling arrangement
  // means the second half of the piece does not exist until you go looking for
  // it, and this view's whole job is the shape of the thing at a glance.
  //
  // REWRITTEN FOR THE SONG TABLE (Stage 2). The old reading was "a section
  // capped at 240px and said its duration in words, and nothing spilled past
  // the row's content edge" — a claim about a horizontal rack of cards whose
  // WIDTH meant duration. There is no rack: sections are full-width rows, so
  // the same property is read where it now lives — the BARS CELL says the
  // length (in bars, and in mm:ss beside it), and the table never scrolls
  // sideways at all (#song scrollWidth <= clientWidth, the strongest form of
  // the old spill check rather than a weaker one).
  {
    // NOT `row` — that is the file-wide helper for section N's GENRE cell.
    // Shadowing it with the table
    // element made every later call a TypeError, which is how this check
    // reported "row is not a function" instead of anything about the song.
    const tableEl = page.locator("#song");
    const sideways = () => tableEl.evaluate(el =>
      ({ scroll: el.scrollWidth, client: el.clientWidth }));
    const s0 = await sideways();
    if (s0.scroll > s0.client)
      fail(`the song table scrolls sideways (${s0.scroll} > ${s0.client}) — ` +
           `sections are hidden off the right edge`);
    else ok(`the song table does not scroll sideways (${s0.scroll} <= ${s0.client})`);
    // make one section long, and check the row SAYS so instead of growing
    await openCell(0, "bars");
    const pop = page.locator("#rowpop");
    const plus = pop.locator('button[aria-label="one bar more"]');
    const before = await page.locator(".box").first().getAttribute("aria-label");
    for (let i = 0; i < 24; i++) await plus.click();     // ~11 s of real clicks
    await pop.locator(".rpx").click();
    await page.waitForTimeout(200);
    const first = page.locator(".box").first();
    const label = await first.getAttribute("aria-label");
    const bars = +(String(label).match(/(\d+) bars/) || [0, 0])[1];
    const cell = (await first.locator(".bbars").textContent()).trim();
    const s1 = await sideways();
    if (!(bars > 20))
      fail(`the bars stepper never lengthened the section past 20 bars ` +
           `(${before} -> ${label})`);
    else if (!new RegExp("(^|\\D)" + bars + " bars\\b").test(cell))
      fail(`the bars cell does not read the section's length: "${cell}" ` +
           `for a ${bars}-bar section`);
    else if (!/\d+:\d\d/.test(cell))
      fail(`the bars cell does not say how long the section runs: "${cell}"`);
    else if (s1.scroll > s1.client)
      fail(`a ${bars}-bar section made the table scroll sideways ` +
           `(${s1.scroll} > ${s1.client}) — the row is encoding duration as width again`);
    else ok(`a ${bars}-bar section reads "${cell}" in its bars cell and the table ` +
            `still does not scroll sideways (${s1.scroll} <= ${s1.client})`);
  }

  // (J) AUTOMATION IS REAL — appended by the P4 depth-to-the-fingers phase;
  // everything above is untouched. The registry grew an `auto` field
  // (fields.js AUTOPARAMS/autoShape), the mixer's channels went per-box and
  // arm point lists on every pass (audio/mixer.js armAutomation), and the
  // palette writes shapes. This drives the REAL surface — the auto chip rows
  // in the TRANSITIONS cell's popup — on a playing, looped section, then
  // asserts the two
  // artifacts: __nuMix reports the armed automation (a count, plus per-channel
  // key info — both ADDED keys, the old shape untouched), and the spectrum
  // moves. Same __hf discipline as (E): a lowpass that closes over the section
  // guts the energy above 4 kHz, which no level-flattening master stage can
  // put back — so a chip that validated, saved and armed NOTHING fails here.
  {
    const hf = async (secs) => {
      let s = 0, n = 0;
      for (let i = 0; i < secs * 5; i++) {
        await page.waitForTimeout(200);
        s += await page.evaluate(() => window.__hf()); n++;
      }
      return s / n;
    };
    const waitMix = async (pred, ms) => {
      const t0 = Date.now();
      let m = null;
      while (Date.now() - t0 < ms) {
        m = await page.evaluate(() => (window.__nuMix ? window.__nuMix() : null));
        if (m && pred(m)) return m;
        await page.waitForTimeout(250);
      }
      return m;
    };

    // a fresh composed song, and loop a VERSE alone: no mot, no inserts, a
    // full kit — so the baseline spectrum has highs to lose and both reads
    // cover the same four bars (the (E) discipline; an intro fades and an
    // outro already carries a closing filter, either would blur the claim)
    await page.selectOption("#composeg", "rock");
    await page.click("#compose");
    await page.waitForTimeout(400);
    const roles2 = await page.locator(".box .role").allTextContents();
    const vi = roles2.findIndex(r => /verse/.test(r));
    if (vi < 0) fail("the composed rock song has no verse to loop");
    const ti = vi < 0 ? 0 : vi;
    await row(ti).dblclick();                                     // loops AND starts it
    await page.waitForTimeout(2500);
    const m0 = await waitMix(m => m.channels.length > 0, 20000);
    if (!m0 || m0.automation == null)
      fail("__nuMix has no `automation` count — the mixer is not reporting what it arms");
    else ok(`__nuMix reports automation (${m0.automation} armed before the chip)`);
    const auto0 = m0 ? (m0.automation || 0) : 0;

    // PHASE-INDEPENDENT SPECTRUM READ. The close shape sweeps 16k -> 320 Hz
    // over the WHOLE section, and the section loops — so any fixed measuring
    // window reads a different part of the sweep depending on when the click
    // landed against the loop (an 8-bar verse is ~15 s; a 6 s window near the
    // top of the pass sees an almost-open filter and fails a real, audible
    // automation). So measure in 1 s buckets across at least one full pass and
    // compare the QUIETEST bucket to the LOUDEST: an armed close sweep must
    // gut the floor (min << max, and min far below the unarmed floor); an
    // unarmed section only varies by its fills. The unarmed floor is taken
    // the same way, so the two reads agree about what "quiet" means.
    const loopSec = await page.evaluate(() => {
      const b = document.querySelector(".box.looped") || document.querySelector(".box.live");
      const bars = b ? parseInt((b.getAttribute("aria-label") || "").match(/(\d+) bars/)?.[1] || 8, 10) : 8;
      return bars * 4 * 60 / +document.getElementById("bpm").value;
    });
    const span = Math.min(24, Math.max(8, loopSec * 1.3));
    const buckets = async () => {
      const out = [];
      for (let i = 0; i < span; i++) {
        let s = 0;
        for (let k = 0; k < 5; k++) { await page.waitForTimeout(200); s += await page.evaluate(() => window.__hf()); }
        out.push(s / 5);
      }
      return out;
    };
    const pre = await buckets();
    const floorPre = Math.min(...pre);
    await openCell(ti, "trans");           // the auto rows live in TRANSITIONS
    const shapeChip = page.locator('.pchip[data-kind="auto"][data-value="cutoff:close"]');
    if (!(await shapeChip.count()))
      fail("the auto shape row is missing from the TRANSITIONS popup — the banks never grew it");
    else {
      await shapeChip.click();
      const m1 = await waitMix(m => (m.automation || 0) > auto0 &&
        m.channels.some(c => c.auto > 0), 20000);
      const armed = m1 && m1.channels.find(c => c.auto > 0);
      if (!armed)
        fail(`the cutoff:close chip armed nothing (automation ${m1 && m1.automation}, ` +
             `channels ${m1 && JSON.stringify(m1.channels.map(c => c.auto))})`);
      else if (typeof armed.key !== "string" || !armed.key.includes("|"))
        fail(`a channel carries no per-box identity key: ${JSON.stringify(armed.key)}`);
      else ok(`automation armed: count ${auto0} -> ${m1.automation}, ` +
              `on channel ${armed.key.split("|")[0]} (per-box identity keys)`);

      const post = await buckets();
      const floorPost = Math.min(...post), peakPost = Math.max(...post);
      console.log(`  spectrum above 4 kHz  : unarmed floor ${floorPre.toFixed(4)}, ` +
                  `armed floor ${floorPost.toFixed(4)} / peak ${peakPost.toFixed(4)} ` +
                  `(${span.toFixed(0)}s buckets, loop ~${loopSec.toFixed(1)}s)`);
      if (floorPost < 0.4 * (peakPost || 1e-9) && floorPost < 0.6 * (floorPre || 1e-9))
        ok(`the armed automation is audible: the sweep guts the floor ` +
           `(${floorPre.toFixed(4)} -> ${floorPost.toFixed(4)}, peak ${peakPost.toFixed(4)})`);
      else fail(`a closing filter automation left the HF floor at ${floorPost.toFixed(4)} ` +
                `(unarmed ${floorPre.toFixed(4)}, armed peak ${peakPost.toFixed(4)}) — ` +
                `the point list is written but never armed on a node in the signal path`);

      // ...and "off" takes it back off, through the same chip row
      await page.locator('.pchip[data-kind="auto"][data-value="cutoff:off"]').click();
      const m2 = await waitMix(m => (m.automation || 0) <= auto0, 20000);
      if (m2 && (m2.automation || 0) <= auto0) ok("auto off disarms the shape");
      else fail(`auto off did not disarm (automation still ${m2 && m2.automation})`);
    }
    await closeCell();                     // the scrim would sit over #play
    await page.click("#play");                              // stop
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
