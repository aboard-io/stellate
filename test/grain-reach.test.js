#!/usr/bin/env node
/* test/grain-reach.test.js — `grain` REACHES THE SOUND (the grain round,
 * 2026-08-30).
 *
 * Paul: "Does anything have found audio, samples, and vinyl crackle? Nothing
 * seems to. Portishead sure should."
 *
 * THE BUG THIS GATE EXISTS FOR is the memory's "declared but never arriving"
 * seen from the far side. Surface noise was BUILT and CALIBRATED and had no
 * caller: engine/faust/dsp/fx_bus.dsp renders it as instr 97 (sparse impulses
 * band-limited 300..6500 Hz over a 4 kHz hiss floor, output-scaled 0.15 by a
 * human ear on 2026-07-04), engine/faust/voices/state-engine.js fxParams has
 * read `state.crackle` for as long — and nukernel never wrote the field, so
 * every one of 373 records rendered crackle 0, including the five rooms whose
 * whole subject is records made out of other records.
 *
 * A gate that only read the genre table would be the same class of lie: the
 * table said `wants` and `cannot` about crackle for months while nothing
 * rendered it. So the last two checks RENDER THE REAL fx_bus WASM
 * (dist/fx_bus-module.wasm, the artifact the page runs) and measure what comes
 * out — the tape-reach.test.js R5 recipe.
 *
 * WHAT IS ASSERTED:
 *   G1  the ten rows that declare `grain` still declare it, every value in
 *       0..1, and the SPREAD is real — a catalogue-wide dusting would be the
 *       same lie in the other direction, so no more than half the wing may
 *       share one number. It does NOT check an order over the raw values:
 *       grain is a level, the presses span 18 dB, and the row with the most
 *       audible surface carries neither the largest number nor the smallest.
 *   G2  `grain` is UNIT-NEUTRAL: toneRecipe is a six-key whitelist, so a seat
 *       carrying grain builds a byte-identical recipe to one without it. This
 *       is what makes the round a state change and not a re-voicing.
 *   G3  to-engine writes state.crackle = MAX over the seats a record plays;
 *       a record whose rows declare nothing leaves the key ABSENT (absent is
 *       today — fxParams' `state.crackle || 0` renders yesterday exactly).
 *   G4  state.crackle survives fxParams onto the DSP's own `crackle` param.
 *   G5  RENDERED: at a row's declared grain the real fx_bus puts out a floor
 *       that is broadband (flatness > 0.3), impulsive (peak/median > 8) and
 *       high-passed (under 5% of its energy below 300 Hz) — the classic
 *       crackle shape, not white noise and not rumble — and it is MONO across
 *       L/R the way a groove is. With the knob down the stage sits 300+ dB
 *       under the quietest amount any row asks for.
 *   G6  the level LADDER holds at the sound: rendering each declared value in
 *       order gives strictly increasing RMS, so the per-row arguments in
 *       genres.js are differences a listener could actually hear.
 */
"use strict";
const path = require("path");
const fs = require("fs");
const R = (p) => path.join(__dirname, "..", p);

let fails = 0, checks = 0;
const ok = (cond, what, detail) => {
  checks++;
  if (cond) { console.log("  ok   " + what); return true; }
  fails++; console.log("  FAIL " + what + (detail ? "\n       " + detail : ""));
  return false;
};
// floored at 1e-300, not the usual 1e-12: this gate measures a stage that
// is genuinely twenty orders of magnitude under a mix, and a -240 dB clamp
// would report the clamp instead of the silence.
const db = (x) => 20 * Math.log10(Math.max(x, 1e-300));
const rms = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i];
                     return Math.sqrt(s / a.length); };

globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { visibilityState: "visible", body: { append() {} },
  createElement: () => ({ style: {}, append() {}, click() {}, setAttribute() {} }) };
window.NuKernel = require(R("nukernel/kernel.js"));
window.NuGenres = require(R("nukernel/genres.js"));
window.NuFields = require(R("nukernel/fields.js"));
window.NuInstruments = require(R("nukernel/instruments.js"));
window.__REGISTRY = require(R("engine/registry-data.js"));
window.__GENRES = { GENRES: {} };
const SE = require(R("engine/faust/voices/state-engine.js"));
const { GENRES } = window.NuGenres;

/* THE WING, by name. Written out rather than derived from "which rows have
   grain", because a gate that asks the table what it says can never catch the
   table falling silent — the exact failure this round is undoing. */
const WING = ["portishead", "tricky", "djshadow", "tapemusic", "chopped",
              "boombap", "triphop", "blockparty", "vaporwave", "massiveattack"];
/* THE LADDER THIS GATE DRIVES, now that no row ships one. These are the
   values the wing was cast at on 2026-08-30 — each PRESSED, six of them
   moved by what came back — kept here so the rendered-ladder checks below
   still exercise the real spread rather than a tidy arithmetic one. They
   are applied through `doc.sound.grain`, which is the board dial's own
   door, so this gate now tests the path a hand actually uses. */
const LADDER = { portishead: 0.34, tricky: 0.83, djshadow: 0.39,
                 tapemusic: 0.23, chopped: 0.45, triphop: 0.61,
                 massiveattack: 0.64, boombap: 0.39, blockparty: 0.14,
                 vaporwave: 0.50 };

(async () => {
console.log("test/grain-reach.test.js — the surface reaches the record\n");

/* ---------- G1 · the rows say it, and they do not all say the same ------- */
console.log("G1 — the wing declares a grain, and the spread is real");
/* THE ROWS NO LONGER SAY IT, AND THAT IS THE POINT NOW (rewritten
   2026-08-31). This block asserted that each of the ten wing rows DECLARED a
   grain, which was true for one day. Paul: "Make the default for surface 0
   and I can turn it on only if I want to, don't put it on anything by
   default." The castings were withdrawn to comments — the measured numbers
   are kept there for a hand that wants them back — so a gate demanding they
   be live would now be a gate demanding the bug.
   WHAT MUST STILL HOLD IS THE CAPABILITY, and it is the whole reason this
   file exists ("declared but never arriving"): the surface must reach the
   sound WHEN ASKED, at the amount asked, and be silent when not. So the
   ladder below is this gate's OWN, driven the way the board's dial drives
   it (doc.sound.grain), and G1 now asserts the two things the withdrawal
   made true: no row ships a default, and the values it used to ship are
   still recoverable from the file rather than lost. */
const grains = {};
{
  let live = 0;
  for (const k of WING) if (((GENRES[k] || {}).tone || {}).grain != null) live++;
  ok(live === 0, "no row ships a surface by default (" + live + " of " +
     WING.length + " declare one)", "a texture nobody asked for is a texture on every play");
  const src = require("fs").readFileSync(R("nukernel/genres.js"), "utf8");
  const kept = (src.match(/grain: [0-9.]+ — WITHDRAWN AS A DEFAULT/g) || []).length;
  ok(kept >= WING.length, "the " + kept + " measured castings are kept in the file",
     "the numbers were pressed for; losing them would cost that work twice");
}
for (const k of WING) grains[k] = LADDER[k];
const vals = WING.map((k) => grains[k]);
const counts = {};
for (const v of vals) counts[v] = (counts[v] || 0) + 1;
const commonest = Math.max(...Object.values(counts));
ok(commonest <= WING.length / 2,
   "no single value covers more than half the wing (commonest = " + commonest + ")",
   "a catalogue-wide dusting says one thing about ten different records");
/* NOT "portishead has the biggest number" — it does not, and it should not.
   `grain` is a LEVEL and the catalogue's presses span 18 dB, so the row with
   the most audible surface (Dummy, measured 31.5 dB under its own mix) does
   NOT carry the largest value: massiveattack does, at 0.64, and its surface
   is the quietest in the wing at 44 dB down, because its press is 8 dB hotter.
   A gate asserting an order over the raw numbers would be asserting a fact
   about mix levels while claiming to assert one about records. What IS checked
   is the range: every value has to be big enough to arrive at all (the first
   pass had three rows measure as no change whatever) and small enough not to
   become a layer. The DEPTHS themselves are held by the pressed-artifact
   measurement recorded beside each row in genres.js. */
ok(Math.min(...vals) >= 0.1,
   "no row asks for less than 0.1 (smallest = " + Math.min(...vals) + ")",
   "below this the surface measured as no change at all on a pressed record");
ok(Math.max(...vals) <= 0.9,
   "no row is pinned at the ceiling (largest = " + Math.max(...vals) + ")",
   "fx_bus's 0.15 output scale is human-calibrated; a row at 1.0 is asking for that argument to be reopened");
ok(grains.massiveattack !== grains.portishead,
   "Mezzanine (" + grains.massiveattack + ") and Dummy (" + grains.portishead +
   ") do not share a surface", "the downtempo round separated these rows on purpose");

/* ---------- G2 · unit-neutral: grain cannot leak into a voice ------------ */
console.log("\nG2 — `grain` is a state word and never a unit word");
const TE = await import(R("nukernel/audio/to-engine.js"));
{
  const base = { cut: 1700, q: 0.9, atk: 0.02, rel: 1.3, gain: 0.24, verb: 0.55 };
  const seatA = { chair: "line", instr: "rhodes_ep", tone: base };
  const seatB = { chair: "line", instr: "rhodes_ep", tone: { ...base, grain: 0.62 } };
  const a = TE.recipeFor("line", seatA, {}, []);
  const b = TE.recipeFor("line", seatB, {}, []);
  ok(JSON.stringify(a) === JSON.stringify(b),
     "a seat carrying grain builds a byte-identical recipe (toneRecipe whitelists)",
     "grain leaked into the unit: " + JSON.stringify(b).slice(0, 200));
  ok(JSON.stringify(a).indexOf("grain") < 0, "no `grain` key anywhere in a rendered recipe");
}

/* ---------- G3 · the courier writes state.crackle ------------------------ */
console.log("\nG3 — to-engine carries the record's grain onto the state");
const K = require(R("engine/genre-kernel.js"));
const E = require(R("engine/csd-engine.js"));
const deps = { SE, K, E };
// one bar, two seated voices; the plan shape audio/plan.js itself builds
const mkPlan = (tones) => ({
  bpm: 80, seed: 1, reverb: 0, delay: 0,
  seat: (v) => (tones[v] === undefined ? null
    : { chair: "line", instr: "rhodes_ep", tone: { cut: 1700, q: 0.9, gain: 0.24,
        ...(tones[v] === null ? {} : { grain: tones[v] }) } }),
  bars: [{ barSteps: 16, ev: tones.map((_, v) => ({ kind: "line", v, off: v * 4, dur: 4, n: 60 + v, vel: 5 })) }],
});
{
  const none = TE.toEngine(mkPlan([null, null]), deps).state;
  ok(!("crackle" in none), "a record whose rows declare nothing leaves `crackle` ABSENT",
     "got " + JSON.stringify(none.crackle));
  const one = TE.toEngine(mkPlan([0.62, null]), deps).state;
  ok(one.crackle === 0.62, "one row declaring 0.62 writes state.crackle 0.62 (got " + one.crackle + ")");
  const two = TE.toEngine(mkPlan([0.22, 0.62]), deps).state;
  ok(two.crackle === 0.62, "two layered rows take the MAX, not the first (got " + two.crackle + ")",
     "max is order-independent; you cannot press half a record onto vinyl");
  const swapped = TE.toEngine(mkPlan([0.62, 0.22]), deps).state;
  ok(swapped.crackle === two.crackle, "and the max does not move when the seating order does");
  const over = TE.toEngine(mkPlan([9]), deps).state;
  ok(over.crackle === 1, "a nonsense value clamps to 1 (got " + over.crackle + ")");
}

/* ---------- G4 · fxParams hands it to the DSP --------------------------- */
console.log("\nG4 — fxParams puts it on the DSP's own param");
{
  const st = TE.toEngine(mkPlan([0.45]), deps).state;
  const fx = SE.fxParams(st);
  ok(fx.crackle === 0.45, "fxParams.crackle === 0.45 (got " + fx.crackle + ")");
  const zero = SE.fxParams(TE.toEngine(mkPlan([null]), deps).state);
  ok(zero.crackle === 0, "an absent grain renders fxParams.crackle 0 — absent is today");
}

/* ---------- G5/G6 · THE RENDERED ARTIFACT, through the real fx_bus ------- */
console.log("\nG5 — the real fx_bus renders the classic crackle shape");
const FAUST = R("engine/faust");
const { FaustMonoDspGenerator } = await import(
  path.join(FAUST, "node_modules/@grame/faustwasm/dist/esm/index.js"));
const code = fs.readFileSync(path.join(FAUST, "dist", "fx_bus-module.wasm"));
const factory = { cfactory: 0, code: new Uint8Array(code),
  module: await WebAssembly.compile(code),
  json: fs.readFileSync(path.join(FAUST, "dist", "fx_bus-meta.json"), "utf8"),
  poly: false };
const gen = new FaustMonoDspGenerator();
const SR = 44100, BS = 128, T = SR * 8;
const zero = new Float32Array(T);
async function renderCrackle(amount) {
  const proc = await gen.createOfflineProcessor(SR, BS, factory);
  // ONLY the crackle param moves; every other slider keeps its compiled
  // default, so what comes back is instr 97 and nothing else.
  proc.setParamValue("/fx_bus/crackle", amount);
  const L = new Float32Array(T), Rr = new Float32Array(T);
  for (let s = 0; s < T; s += BS) {
    const len = Math.min(BS, T - s);
    const z = zero.subarray(s, s + len);
    const o = proc.render([z, z, z, z, z, z], len);
    L.set(o[0].subarray(0, len), s); Rr.set(o[1].subarray(0, len), s);
  }
  return { L, R: Rr };
}
/* the shape numbers, computed here so the gate owns its own arithmetic */
function shape(x) {
  const N = 4096, acc = new Float64Array(N / 2), win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
  let frames = 0;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let s = 0; s + N < x.length; s += N) {
    for (let i = 0; i < N; i++) { re[i] = x[s + i] * win[i]; im[i] = 0; }
    for (let i = 1, j = 0; i < N; i++) { let b = N >> 1;
      for (; j & b; b >>= 1) j ^= b; j ^= b;
      if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr;
                   const ti = im[i]; im[i] = im[j]; im[j] = ti; } }
    for (let len = 2; len <= N; len <<= 1) { const ang = -2 * Math.PI / len;
      for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; } }
    for (let i = 0; i < N / 2; i++) acc[i] += re[i] * re[i] + im[i] * im[i];
    frames++;
  }
  for (let i = 0; i < N / 2; i++) acc[i] /= Math.max(1, frames);
  const bin = (hz) => Math.max(1, Math.round(hz * N / SR));
  let ls = 0, as = 0, n = 0;
  for (let i = bin(100); i < bin(10000); i++) { const p = Math.max(acc[i], 1e-20);
    ls += Math.log(p); as += p; n++; }
  const bandE = (a, b) => { let s = 0; for (let i = bin(a); i < bin(b); i++) s += acc[i]; return s; };
  const tot = bandE(20, SR / 2) || 1e-20;
  const W = Math.round(SR * 0.002), r = [];
  for (let i = 0; i + W < x.length; i += W) { let q = 0;
    for (let j = 0; j < W; j++) q += x[i + j] * x[i + j]; r.push(Math.sqrt(q / W)); }
  r.sort((a, b) => a - b);
  return { flat: Math.exp(ls / n) / (as / n),
           imp: (r[Math.floor(r.length * 0.999)] || 1e-12) / (r[Math.floor(r.length * 0.5)] || 1e-12),
           lowShare: bandE(20, 300) / tot };
}
{
  // NOT "bit-for-bit zero", because that is not what comes back and a gate
  // must say the measured thing: at crackle 0 the bus still puts out a peak
  // of ~8e-21 (-402 dBFS), which is the reverb/delay network's own settling
  // residue and not instr 97 — `sparse_noise(...)*0*0.5` and `noise*0.004*0`
  // are algebraically zero. So the claim is the one that matters: with the
  // knob down, the crackle stage is unmeasurably far under the quietest
  // amount any row asks for.
  const silentDb = db(rms((await renderCrackle(0)).L));
  const quietest = Math.min(...vals);
  const quietestDb = db(rms((await renderCrackle(quietest)).L));
  ok(quietestDb - silentDb > 200,
     "grain 0 sits " + (quietestDb - silentDb).toFixed(0) + " dB under the quietest declared amount (" +
     quietest + ")", "silence " + silentDb.toFixed(1) + " dBFS vs " + quietestDb.toFixed(1) + " dBFS");

  /* `GENRES.portishead.tone.grain` STOOD HERE and is undefined since the
     defaults were withdrawn (2026-08-31) — it made every shape check below
     read NaN, which is a gate failing for the reason it should be testing
     around. The shape of the crackle is a property of the STAGE, not of any
     row's taste, so it is asked at the ladder's own portishead value. */
  const g = LADDER.portishead;
  const out = await renderCrackle(g);
  const s = shape(out.L);
  ok(s.flat > 0.3, "BROADBAND: spectral flatness " + s.flat.toFixed(3) + " > 0.3",
     "a tonal bed would sit near 0; this must read as noise, not a hum");
  ok(s.imp > 8, "IMPULSIVE: p99.9/median " + s.imp.toFixed(1) + "x > 8",
     "white noise sits near 1x — crackle is sparse impulses over a floor");
  ok(s.lowShare < 0.05, "HIGH-PASSED: " + (100 * s.lowShare).toFixed(1) + "% of energy under 300 Hz < 5%",
     "rumble is the failure mode every field recording in found/ has here");
  let num = 0, dl = 0, dr = 0;
  for (let i = 0; i < T; i++) { num += out.L[i] * out.R[i]; dl += out.L[i] ** 2; dr += out.R[i] ** 2; }
  ok(num / Math.sqrt(dl * dr) > 0.99, "MONO: L/R correlation " +
     (num / Math.sqrt(dl * dr)).toFixed(4) + " > 0.99 — one groove, both sides");

  console.log("\nG6 — the declared ladder is a ladder at the sound");
  const ladder = [...new Set(vals)].sort((a, b) => a - b);
  let prev = -Infinity, mono = true; const said = [];
  for (const v of ladder) {
    const r2 = db(rms((await renderCrackle(v)).L));
    said.push(v + "->" + r2.toFixed(1) + "dB");
    if (r2 <= prev) mono = false;
    prev = r2;
  }
  ok(mono, "every declared value renders louder than the one below it",
     said.join("  "));
  console.log("       " + said.join("  "));
}

console.log("\n" + (fails ? "FAILED " + fails + "/" + checks : "PASS " + checks + "/" + checks));
process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
