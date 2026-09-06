#!/usr/bin/env node
/* test/sampler-adsr.test.js — THE SAMPLED LANE'S FOUR STAGES, MEASURED ON
 * RENDERED PCM (2026-09-06).
 *
 * Paul: *"Samples should have full Adsr why don't they"*
 *
 * They do, and this is the gate that says so in numbers rather than in wiring
 * reads — the memory law this repo runs every capability through ("six params
 * declared, costed and reaching no sound; measure, never trust a slider"), and
 * the one the round itself failed twice before it passed:
 *
 *   · a SUSTAIN with no decay rendered susRatio 1.0000 — `shaped` read
 *     `dcyN > 0 && susL < 1`, and the decay's derived value is 0, so a hand
 *     that dragged only the sustain handle moved a control that changed
 *     nothing while the editor drew the cliff it had asked for;
 *   · engine/faust/press/press.js was the FOURTH reader of `u.sampler` and the
 *     only one that did not carry `dcy`/`sus` onto the note, so a record with
 *     a fall heard it live and pressed a flat one.
 *
 * THE SOURCE IS A DC BUFFER, on purpose: with the sample itself a constant 1,
 * `mixPCM`'s output IS the gain envelope, sample for sample, so every number
 * below is the envelope and not a proxy for it.
 *
 *   S1  ATTACK  moves the peak's arrival.
 *   S2  DECAY   moves when the level reaches the sustain.
 *   S3  SUSTAIN moves the held level — WITH a decay and, the regression,
 *       WITHOUT one (a decay of 0 is an instant fall, which is what the
 *       editor's own curve draws).
 *   S4  RELEASE moves the tail's length.
 *   S5  ...AND A ONE-SHOT CANNOT HOLD. On a 0.35 s recording held for 2 s the
 *       sound ends with the recording whatever the four handles say, and the
 *       release tail is never heard — which is the measured ground under the
 *       page's refusal of the sustain handle there (ui/eight.js `sustainWhy`).
 *   S6  ABSENT IS TODAY, BIT FOR BIT: a note with no dcy/sus is byte-identical
 *       to one carrying sus 1, and to the A-H-R this lane was.
 *   S7  THE WHOLE WIRE: voice.sound -> document.js chairs seam -> to-engine
 *       samplerVox -> recipe m.attack/decay/sustain/release -> state-engine
 *       samplerUnit u.sampler.atk/dcy/sus/rel.
 *   S8  ONE OWNER, EVERY READER. Every place in engine/ that lifts
 *       `u.sampler.atk` onto a note must lift all four — the check that would
 *       have caught press.js on the day it was written.
 *
 * RUN:  node test/sampler-adsr.test.js
 */
"use strict";
const path = require("path");
const fs = require("fs");
const assert = require("assert");
const R = (p) => path.join(__dirname, "..", p);

let pass = 0, fail = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log("  ok   " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); } };

const SP = require(R("engine/faust/voices/sampler.js"));
const SR = 44100;

/* ---------- the rig: a DC sample, so the output IS the envelope ---------- */
const LONG = new Float32Array(4 * SR).fill(1);
const SHORT = new Float32Array(Math.round(0.35 * SR)).fill(1);
const BUFS = { long: LONG, short: SHORT };
const LOOPED = { srcId: "long", root: 69, lo: 0, hi: 127, loop: 1,
                 loopStart: 1000, loopEnd: LONG.length - 1000,
                 len: LONG.length, sr: SR };
const ONESHOT = { srcId: "short", root: 69, lo: 0, hi: 127, loop: 0,
                  loopStart: 0, loopEnd: 0, len: SHORT.length, sr: SR };
const DUR = 2.0;                       // the note is held two seconds

function render(n, zone) {
  const T = 6 * SR;
  const into = { dry: new Float32Array(T), rev: new Float32Array(T),
                 del: new Float32Array(T) };
  SP.mixPCM([Object.assign({ tSec: 0, durSec: DUR, freq: 440, gain: 0.5,
                             zones: [zone] }, n)],
            BUFS, SR, into, { dry: 1, rev: 0, del: 0 });
  return into.dry;
}
/** the envelope, read off the rendered samples and nowhere else. */
function env(a) {
  let peak = 0, pi = 0;
  for (let i = 0; i < a.length; i++) if (a[i] > peak) { peak = a[i]; pi = i; }
  const gate = Math.round(DUR * SR);
  const sus = a[gate - 220];                          // 5 ms before the gate
  let atSus = null;                                   // when it got there
  for (let i = pi; i < gate; i++)
    if (Math.abs(a[i] - sus) <= Math.abs(sus) * 0.01 + 1e-6) { atSus = i / SR; break; }
  let last = 0;
  for (let i = a.length - 1; i >= 0; i--) if (Math.abs(a[i]) > 1e-4) { last = i; break; }
  return { peak, peakAt: pi / SR, sus, ratio: sus / (peak || 1),
           atSus, tail: Math.max(0, (last - gate) / SR), endsAt: last / SR };
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const bytesEq = (a, b) => { if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };

console.log("test/sampler-adsr.test.js — four stages, measured on rendered PCM\n");

const BASE = env(render({ atk: 0.012, rel: 0.09 }, LOOPED));

/* ---------- S1 attack ----------------------------------------------------- */
ok("S1 attack moves the peak (12 ms -> 1.000 s)", () => {
  const e = env(render({ atk: 1.0, rel: 0.09 }, LOOPED));
  assert.ok(near(BASE.peakAt, 0.012, 0.002), "baseline peak at " + BASE.peakAt);
  assert.ok(near(e.peakAt, 1.0, 0.01), "peak at " + e.peakAt);
  console.log("       attack 12 ms -> peak @ " + BASE.peakAt.toFixed(3) + "s"
    + " · attack 1.0 s -> peak @ " + e.peakAt.toFixed(3) + "s");
});

/* ---------- S2 decay ------------------------------------------------------ */
ok("S2 decay moves when the fall lands (0.5 s -> at the level by 0.510 s)", () => {
  const e = env(render({ atk: 0.012, dcy: 0.5, sus: 0.3, rel: 0.09 }, LOOPED));
  assert.ok(near(e.atSus, 0.512, 0.02), "reached the sustain at " + e.atSus);
  const f = env(render({ atk: 0.012, dcy: 1.5, sus: 0.3, rel: 0.09 }, LOOPED));
  assert.ok(near(f.atSus, 1.512, 0.03), "a longer fall landed at " + f.atSus);
  console.log("       decay 0.5 s -> at the level @ " + e.atSus.toFixed(3) + "s"
    + " · decay 1.5 s -> " + f.atSus.toFixed(3) + "s");
});

/* ---------- S3 sustain, with a decay AND without one ---------------------- */
ok("S3 sustain moves the held level, with a decay and (the regression) without", () => {
  const withD = env(render({ atk: 0.012, dcy: 0.5, sus: 0.3, rel: 0.09 }, LOOPED));
  assert.ok(near(withD.ratio, 0.3, 0.005), "with a decay: " + withD.ratio);
  /* THE ONE THIS GATE EXISTS FOR. The decay's derived value is 0 and no genre
     writes one, so the sustain handle alone is the commonest gesture there is
     on this plate — and it rendered ratio 1.0000 for a day. */
  const alone = env(render({ atk: 0.012, sus: 0.3, rel: 0.09 }, LOOPED));
  assert.ok(near(alone.ratio, 0.3, 0.005),
    "sustain with no decay did not arrive: ratio " + alone.ratio.toFixed(4));
  assert.ok(alone.atSus <= 0.02,
    "an instant fall must be instant, landed at " + alone.atSus);
  const half = env(render({ atk: 0.012, sus: 0.7, rel: 0.09 }, LOOPED));
  assert.ok(near(half.ratio, 0.7, 0.005), "sus .7 -> " + half.ratio);
  console.log("       sus .3 with a fall -> " + withD.ratio.toFixed(4)
    + " of peak · sus .3 alone -> " + alone.ratio.toFixed(4)
    + " (instant, @ " + alone.atSus.toFixed(3) + "s) · sus .7 -> " + half.ratio.toFixed(4));
});

/* ---------- S4 release ---------------------------------------------------- */
ok("S4 release moves the tail (90 ms -> 1.500 s)", () => {
  const e = env(render({ atk: 0.012, rel: 1.5 }, LOOPED));
  assert.ok(near(BASE.tail, 0.09, 0.005), "baseline tail " + BASE.tail);
  assert.ok(near(e.tail, 1.5, 0.01), "tail " + e.tail);
  console.log("       release 90 ms -> tail " + BASE.tail.toFixed(3) + "s"
    + " · release 1.5 s -> " + e.tail.toFixed(3) + "s");
});

/* ---------- S5 a one-shot cannot hold ------------------------------------- */
ok("S5 a 0.35 s one-shot ends with the recording, whatever the four handles say", () => {
  const cases = [
    ["baseline", { atk: 0.012, rel: 0.09 }],
    ["attack 1.0 s", { atk: 1.0, rel: 0.09 }],
    ["decay .5 sus .3", { atk: 0.012, dcy: 0.5, sus: 0.3, rel: 0.09 }],
    ["sus .3 alone", { atk: 0.012, sus: 0.3, rel: 0.09 }],
    ["release 1.5 s", { atk: 0.012, rel: 1.5 }],
  ];
  const said = [];
  for (const [w, n] of cases) {
    const e = env(render(n, ONESHOT));
    assert.ok(near(e.endsAt, 0.35, 0.01),
      w + ": the sound ran to " + e.endsAt.toFixed(3) + "s, not the recording's 0.350");
    said.push(w + " ends " + e.endsAt.toFixed(3) + "s");
  }
  /* THE RELEASE IS NOT HEARD AT ALL: the note is let go at 2 s and there has
     been no sound since 0.35 s, so a 1.5 s tail is 1.5 s of nothing. */
  const rel = env(render({ atk: 0.012, rel: 1.5 }, ONESHOT));
  assert.strictEqual(rel.tail, 0, "a one-shot rendered " + rel.tail + "s of tail");
  /* ...and a long attack CLIPS it, which is the measured reason the other
     three handles stay live on a one-shot while the sustain does not. */
  const slow = env(render({ atk: 1.0, rel: 0.09 }, ONESHOT));
  assert.ok(slow.peak < BASE.peak * 0.45,
    "a 1 s attack on a 0.35 s stab peaked at " + slow.peak.toFixed(4));
  console.log("       " + said.join(" · "));
  console.log("       release tail on a one-shot: " + rel.tail.toFixed(3)
    + "s · a 1 s attack clips its peak " + BASE.peak.toFixed(4)
    + " -> " + slow.peak.toFixed(4));
});

/* ---------- S6 absent is today -------------------------------------------- */
ok("S6 absent is today, bit for bit (no dcy/sus === sus 1 === the old A-H-R)", () => {
  const a = render({ atk: 0.012, rel: 0.09 }, LOOPED);
  const b = render({ atk: 0.012, rel: 0.09, sus: 1 }, LOOPED);
  const c = render({ atk: 0.012, rel: 0.09, dcy: 0.5 }, LOOPED);   // a fall to 1 is no fall
  assert.ok(bytesEq(a, b), "sus 1 changed the bytes");
  assert.ok(bytesEq(a, c), "a decay with no sustain changed the bytes");
});

/* ---------- S7 the whole wire --------------------------------------------- */
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { visibilityState: "visible", body: { append() {} },
  createElement: () => ({ style: {}, append() {}, click() {}, setAttribute() {} }) };
window.NuKernel = require(R("nukernel/kernel.js"));
window.NuGenres = require(R("nukernel/genres.js"));
window.NuFields = require(R("nukernel/fields.js"));
window.NuSong = require(R("nukernel/song.js"));
window.NuInstruments = require(R("nukernel/instruments.js"));
window.NuSongs = require(R("nukernel/songs.js"));
window.NuDocument = require(R("nukernel/document.js"));
window.__REGISTRY = require(R("engine/registry-data.js"));
const K = require(R("engine/genre-kernel.js"));
const SE = require(R("engine/faust/voices/state-engine.js"));
const ND = window.NuDocument;
const { TERMS } = window.NuSongs;
const clone = (o) => JSON.parse(JSON.stringify(o));

(async () => {
const TE = await import(R("nukernel/audio/to-engine.js"));
const lib = TE.samplerLibFor(K, 1).samplerLib || {};

ok("S7 voice.sound's four numbers cross the seam and land on u.sampler", () => {
  const d = ND.normalize(clone(TERMS));
  const v = d.voices.find((x) => x.kind === "line");
  v.instrument = "atmosphere";                       // sampler-routed, looped zones
  v.sound = { atk: 0.02, dcy: 0.5, sus: 0.3, rel: 1.2 };
  const g = ND.toGenre(d, 0, []);
  const chair = g.chairs[d.voices.filter((x) => x.kind === "line").indexOf(v)];
  assert.deepStrictEqual(chair.vox, { atk: 0.02, dcy: 0.5, sus: 0.3, rel: 1.2 },
    "the chairs seam rewrote it: " + JSON.stringify(chair.vox));
  const r = TE.recipeFor("line", { instr: "atmosphere", vox: chair.vox }, lib, []);
  assert.strictEqual(r.m.attack, 0.02, "m.attack " + r.m.attack);
  assert.strictEqual(r.m.decay, 0.5, "m.decay " + r.m.decay);
  assert.strictEqual(r.m.sustain, 0.3, "m.sustain " + r.m.sustain);
  assert.strictEqual(r.m.release, 1.2, "m.release " + r.m.release);
  const u = SE.pitchedUnit(r.role || "melody", r.m, { bpm: 120, seed: 1 });
  assert.ok(u.sampler, "no sampler unit");
  assert.strictEqual(u.sampler.atk, 0.02, "u.atk " + u.sampler.atk);
  assert.strictEqual(u.sampler.dcy, 0.5, "u.dcy " + u.sampler.dcy);
  assert.strictEqual(u.sampler.sus, 0.3, "u.sus " + u.sampler.sus);
  assert.strictEqual(u.sampler.rel, 1.2, "u.rel " + u.sampler.rel);
  /* ...and a chair that said nothing stamps no keys (the absent-law at the
     owner, so S6's byte-identity is what every existing record gets). */
  const bare = SE.pitchedUnit("melody",
    TE.recipeFor("line", { instr: "atmosphere" }, lib, []).m, { bpm: 120, seed: 1 });
  assert.ok(!("dcy" in bare.sampler) && !("sus" in bare.sampler),
    "a silent chair stamped " + JSON.stringify({ dcy: bare.sampler.dcy, sus: bare.sampler.sus }));
});

/* ---------- S8 one owner, every reader ------------------------------------ */
ok("S8 every reader of u.sampler.atk carries all four stages onto the note", () => {
  const files = ["engine/faust/press/press.js",
                 "engine/faust/live/live.js",
                 "engine/faust/live/stream-renderer.js"];
  const bad = [];
  for (const f of files) {
    const src = fs.readFileSync(R(f), "utf8").split("\n");
    src.forEach((ln, i) => {
      if (ln.indexOf("u.sampler.atk") < 0) return;
      /* the note object is built across at most three lines here; read the
         window rather than the line, which is what press.js's own shape is. */
      const win = src.slice(i, i + 20).join(" ");
      const has = (k) => win.indexOf("u.sampler." + k) >= 0;
      if (!(has("rel") && has("dcy") && has("sus")))
        bad.push(f + ":" + (i + 1) + " -> " + ln.trim());
    });
  }
  assert.strictEqual(bad.length, 0,
    "a reader lifts the attack and drops a stage:\n       " + bad.join("\n       "));
});

/* ---------- the page's own refusal, on the fact it is measured from ------- */
ok("S9 the refused chairs are the ones whose zones never loop", () => {
  const S = window.__REGISTRY.SAMPLERS || {};
  const none = [], some = [];
  for (const id of Object.keys(S)) {
    const zs = (S[id] && S[id].zones) || [];
    if (!zs.length) continue;
    (zs.some((z) => z.loop) ? some : none).push(id);
  }
  assert.ok(none.length > 0 && some.length > 0,
    "the census is degenerate: " + none.length + " / " + some.length);
  /* ...AND ONLY THE SAMPLER-ROUTED ONES CAN CARRY THE REFUSAL. A one-shot the
     patch tables send to a Faust MODEL (marimba, woodblock, the two guitars)
     never reaches the sampled branch of `envSpecFor` at all, so counting the
     registry alone would overstate the reach of the page's own sentence. */
  const NI = window.NuInstruments;
  const routed = none.filter((id) => NI.sampledId(id));
  assert.ok(routed.length >= 8,
    "only " + routed.length + " one-shot ids are sampler-routed");
  console.log("       " + routed.length + " of the " + none.length
    + " one-shots are sampler-routed (the rest are Faust models): "
    + routed.join(" "));
  for (const id of ["xylophone", "orchestra_hit", "pizzicato_strings", "woodblock"])
    assert.ok(none.indexOf(id) >= 0, id + " was expected to be a one-shot");
  for (const id of ["atmosphere", "sea_shore", "strings", "warm_pad"])
    assert.ok(some.indexOf(id) >= 0, id + " was expected to loop");
  console.log("       " + some.length + " ids hold a note, " + none.length
    + " cannot: " + none.join(" "));
});

console.log("\n" + pass + " ok, " + fail + " failed");
process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
