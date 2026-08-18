#!/usr/bin/env node
// test/browser/nukernel-engine.test.js — ONE ENGINE.
//
//   node test/browser/nukernel-engine.test.js
//
// WHAT THIS REPLACED. There were four browser gates over nukernel's audio tier
// — nukernel-audio (the mixer's built nodes), nukernel-drums (an offline render
// through its own master chain and room), nukernel-bounce (the carrier's render
// budget) and nukernel-survival (the handoff from the tape back to the graph) —
// and every one of them was a gate over a SECOND ENGINE: ~7,700 lines of
// scheduler, channel strips, master chain, reverbs, voice routing and offline
// render sitting beside engine/faust/, which does all six.
//
// Paul, three times, and finally plainly: "Are you reusing the scheduler and
// audio engine we built Claude or making yet another one … They're the same
// except for the buses but those are trivial." He was right, and the
// measurement agreed: every bug of the two days before this round was a SEAM
// between the two engines — the desk absent from the tape, a different 606 on
// each path, velocity meaning a filter on one side and a fader on the other,
// and a render that never completed on WebKit, which killed the tab on iOS.
//
// So the four gates over the second engine are gone and this is the gate over
// having ONE. It asks the artifact, on the real page, in a real browser:
//
//   (A) IT PLAYS. Three genres, composed by the page's own composer, audible
//       and CONTINUOUS — no silent run longer than a rest — and no page error.
//   (B) IT IS THE PARENT'S ENGINE. The thing making the sound reports the
//       parent's own outputRoute, the parent's own load ratio and the parent's
//       own handle; and none of the nine deleted modules can be imported, so
//       there is no dormant copy to fall back into.
//   (C) THE BAND REACHES IT. Every unit the engine is handed resolves to a real
//       parent module or a real sampler — drums included — and the translation
//       reports nothing unrouted. A voice that reaches no module is a voice
//       nobody hears, and that is invisible from outside.
//   (D) THE DESK LANDS ON THE BUSES. This is the "trivial" part, and it is the
//       one real difference between the two engines, so it is measured rather
//       than asserted: a box's reverb send, its fader and a part MUTE each move
//       the numbers the engine is actually handed for that box's voices — and a
//       mute CUTS, which is a note that is never emitted at all.
//   (E) THE FAILURE IS BOUNDED. A deadline and a ceiling, both published and
//       finite, and a settled engine that stays settled. That is the half the
//       carrier never had and the half that killed the tab.
"use strict";
const { serve, launchBrowser, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8968;
const GENRES = ["blueeyedsoul", "house", "rock"];
const SETTLE_MS = 60000;          // the engine has this long to make a sound
const RMS_FLOOR = 0.004;          // silence is ~1e-4
const RMS_CEIL = 0.9;             // the master's brickwall sits well under this

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

// an analyser on whatever reaches the destination — the artifact, not the
// intention (the same tap the webkit gate installs)
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

// the nine modules that WERE the second engine. Importing one must fail: a
// dormant engine is exactly what this round exists to end, and this codebase
// has hidden bugs in dormant paths twice this week.
const GONE = ["transport", "graph", "mixer", "voices", "bounce", "survival",
              "press-window", "press-worker", "assets"];

(async () => {
  const srv = await serve(ROOT, PORT); PORT = srv.port;
  const browser = await launchBrowser("chromium");
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = capturePageErrors(page);
  await page.addInitScript(taps);
  await page.goto(`http://localhost:${PORT}/nukernel/kernel-daw.html`,
    { waitUntil: "networkidle" });
  ok("the page boots");

  const look = () => page.evaluate(() => ({
    b: window.__nuBounce(), e: window.__nuEngine(), m: window.__nuMix(),
    // TWO TAPS, and the honest reading is the louder. The destination tap sees
    // the DIRECT route (the graph ends at ctx.destination); the engine's own
    // analyser sees every route, including the media-element one WebKit takes,
    // where nothing is connected to ctx.destination at all and a destination tap
    // reads a flat zero over a perfectly audible song. Measuring the wrong node
    // and calling it silence is its own kind of shipped bug.
    rms: Math.max(window.__rms ? window.__rms() : -1,
                  (window.__nuEngine && window.__nuEngine().rms) || -1) }));

  for (const g of GENRES) {
    await page.evaluate((x) => { document.getElementById("composeg").value = x; }, g);
    await page.click("#compose");
    // ── (A) IT PLAYS ──
    const rms = [];
    let s = null;
    const stop = Date.now() + SETTLE_MS;
    while (Date.now() < stop) {
      await page.waitForTimeout(1500);
      s = await look();
      if (s.rms >= 0) rms.push(s.rms);
      if (s.b.state === "ready" && s.b.stage === "full" && rms.length >= 12) break;
      if (s.b.state === "failed") break;
    }
    if (!(s && s.b.state === "ready" && s.b.stage === "full")) {
      fail(`${g}: the engine never reached ready/full (state '${s && s.b.state}', ` +
           `capped ${s && s.b.capped ? s.b.capped.why : "none"})`);
      continue;
    }
    const hi = Math.max(...rms), lo = Math.min(...rms);
    let run = 0, worst = 0;
    for (const v of rms) { if (v < RMS_FLOOR) { run++; if (run > worst) worst = run; } else run = 0; }
    if (hi > RMS_CEIL) fail(`${g}: the level ran away — peak ${hi.toFixed(3)} over ${RMS_CEIL}`);
    else if (hi < RMS_FLOOR) fail(`${g}: the room stayed silent (peak ${hi.toFixed(4)})`);
    // a rest is music; a DROPOUT is several seconds of nothing in a row
    else if (worst >= 4) fail(`${g}: ${worst} consecutive silent samples — that is a dropout, ` +
                              `not a rest`);
    else ok(`${g}: sounding and continuous (${lo.toFixed(4)}..${hi.toFixed(3)}, ` +
            `longest gap ${worst} samples, route '${s.b.route}')`);

    // ── (B) IT IS THE PARENT'S ENGINE ──
    const parent = await page.evaluate(() => ({
      faustLive: typeof window.FaustLive === "object" && typeof window.FaustLive.exploreLive === "function",
      handle: !!(window.FaustLive && window.FaustLive.lastHandle),
      route: window.FaustLive && window.FaustLive.lastHandle
        ? window.FaustLive.lastHandle.outputRoute : null }));
    if (!parent.faustLive) fail(`${g}: FaustLive is not loaded — something else is making this sound`);
    else if (!parent.handle) fail(`${g}: FaustLive opened no handle — the page is not driving the parent`);
    else if (parent.route !== s.b.route)
      fail(`${g}: the page reports route '${s.b.route}' and the engine reports ` +
           `'${parent.route}' — two opinions about one output`);
    else ok(`${g}: the sound is FaustLive's own handle on route '${parent.route}'`);

    // ── (C) THE BAND REACHES IT ──
    {
      const m = s.m;
      const keys = Object.keys(m.units);
      const dead = keys.filter((k) => !m.units[k].module && !m.units[k].sampler);
      const drums = keys.filter((k) => m.units[k].drum);
      if (!keys.length) fail(`${g}: the engine was handed no units at all`);
      else if (dead.length) fail(`${g}: ${dead.length} unit(s) resolve to no parent module ` +
                                 `(${dead.slice(0, 4).join(", ")}) — voices nobody hears`);
      else if (!drums.length) fail(`${g}: the unit table has no drum lane`);
      else if (s.b.unrouted) fail(`${g}: the translation reports ${s.b.unrouted} unrouted voice(s)`);
      else ok(`${g}: ${keys.length} units, ${drums.length} drum lanes, nothing unrouted`);
    }
  }

  // ── (D) THE DESK LANDS ON THE BUSES ──
  // The three controls that used to live in a private WebAudio graph, measured
  // where they land now: on the numbers the engine is handed for that box's
  // voices. Read BEFORE and AFTER through the page's own writers, so this is
  // the shipped path and not a second opinion about it.
  {
    const move = await page.evaluate(async () => {
      const [ST, PL] = await Promise.all([
        import("/nukernel/ui/state.js"), import("/nukernel/audio/plan.js")]);
      const si = Math.max(0, window.__nuMix().si);
      const sec = ST.SONG[si];
      const read = () => { PL.compile(); return PL.barPlan(
        (() => { for (let i = 0; i < PL.barCount(); i++) if (PL.timeline()[i].si === si) return i;
                 return 0; })()); };
      const sum = (p, f) => Object.values(p.units).reduce((a, u) => a + (u && u[f] || 0), 0);
      const before = read();
      // (1) the reverb send
      sec.rev = "wet"; const wet = read();
      sec.rev = "dry"; const dry = read();
      delete sec.rev;
      // (2) the section fader
      sec.fader = -12; const down = read();
      delete sec.fader;
      // (3) a part MUTE — the one that has to CUT. Asked of EVERY track, not of
      // whichever one happens to be first: a box's opening bar need not sound
      // every chair the box seats, so "mute the first track and count" measures
      // the arrangement rather than the mute. The claim is the whole law —
      // muting the whole desk empties the bar, and muting one track that IS
      // sounding takes exactly its own notes out.
      const keys = (await import("/nukernel/audio/desk.js")).partKeysOf(sec);
      const notes = (p) => p.ev.pitched.length + p.ev.drums.length;
      sec.parts = {};
      for (const k of keys) sec.parts[k] = { mute: true };
      const allMuted = notes(read());
      const per = [];
      for (const k of keys) { sec.parts = { [k]: { mute: true } }; per.push([k, notes(read())]); }
      delete sec.parts;
      const after = read();
      return { revWet: sum(wet, "rev"), revDry: sum(dry, "rev"), revBase: sum(before, "rev"),
               lvlBase: sum(before, "lvl"), lvlDown: sum(down, "lvl"),
               notesBase: notes(before), allMuted, per,
               restored: JSON.stringify(Object.keys(after.units)) === JSON.stringify(Object.keys(before.units))
                 && Math.abs(sum(after, "lvl") - sum(before, "lvl")) < 1e-9 };
    });
    if (!(move.revWet > move.revDry))
      fail(`the reverb send does not reach the engine: wet ${move.revWet.toFixed(3)} ` +
           `vs dry ${move.revDry.toFixed(3)} on the units it is handed`);
    else ok(`the reverb send lands on the units' own \`rev\` (${move.revDry.toFixed(3)} -> ` +
            `${move.revWet.toFixed(3)})`);
    if (!(move.lvlDown < move.lvlBase * 0.75))
      fail(`a -12 dB section fader moved the engine's levels from ${move.lvlBase.toFixed(3)} ` +
           `to ${move.lvlDown.toFixed(3)} — that is not 12 dB`);
    else ok(`the section fader lands on the units' own \`lvl\``);
    if (move.allMuted !== 0)
      fail(`muting every track left ${move.allMuted} of ${move.notesBase} notes in the ` +
           `bar — a mute that does not cut is the desk missing from the tape again`);
    else {
      const cut = move.per.filter(([, n]) => n < move.notesBase);
      if (!cut.length)
        fail(`no single track's mute changed the bar (${move.per.map(([k, n]) => k + ":" + n)
          .join(", ")} against ${move.notesBase}) — the mute is all-or-nothing`);
      else ok(`a part mute CUTS: the whole desk muted is silence, and ` +
              `${cut.map(([k, n]) => `${k} ${move.notesBase}->${n}`).join(", ")}`);
    }
    if (!move.restored) fail("clearing the desk did not return the engine to what it was");
    else ok("clearing the desk returns the engine to exactly what it was");
  }

  // ── (E) THE FAILURE IS BOUNDED ──
  {
    const b = (await look()).b;
    if (!(b.deadlineMs > 0 && b.deadlineMs < 300000))
      fail(`the engine's deadline is ${b.deadlineMs} ms — a bound has to be a number ` +
           `a person would wait through`);
    else ok(`the engine has a deadline (${b.deadlineMs} ms)`);
    if (!(b.tries >= 1 && b.tries <= 2))
      fail(`the engine has started ${b.tries} times — the ceiling is two (the stream, ` +
           `then the media route) and there is no third`);
    else ok(`the engine started ${b.tries} time(s), inside the ceiling of 2`);
    const t0 = b.tries;
    await page.waitForTimeout(8000);
    const b2 = (await look()).b;
    if (b2.tries > t0) fail(`a settled engine started again on its own (${t0} -> ${b2.tries})`);
    else if (b2.deadlineMs !== b.deadlineMs) fail("the deadline moved mid-run");
    else ok("settled and stayed settled — no retry loop behind the readout");
  }

  if (errs.length) fail(`page errors:\n    ${errs.slice(0, 6).join("\n    ")}`);
  else ok("zero page errors");

  // ── (B, half) NO DORMANT ENGINE ──
  // LAST, deliberately: the proof is nine 404s, and a 404 is a page error. This
  // runs after the error assertion so the evidence does not read as the fault.
  {
    const alive = await page.evaluate(async (list) => {
      const out = [];
      for (const f of list) {
        try { await import("/nukernel/audio/" + f + ".js"); out.push(f); } catch (e) {}
      }
      return out;
    }, GONE);
    if (alive.length)
      fail(`the second engine is still importable: ${alive.join(", ")} — a dormant ` +
           `copy is what this round exists to end`);
    else ok(`all ${GONE.length} modules of the second engine are gone from the page`);
  }


  await browser.close();
  srv.close();
  console.log(process.exitCode ? "\nFAILED" : `\nPASS — ${checks} checks`);
})().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
