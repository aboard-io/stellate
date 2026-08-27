#!/usr/bin/env node
// test/tape-reach.test.js — THE THREE REACH FIXES OF PHASE 0, MEASURED ON
// RENDERED AUDIO (FUTURE.md "PHASE 0 — THE TAPE", 2026-08-27).
//
// The finding this file exists for is the memory's "declared but never
// arriving" bug in its purest form: the board's per-channel fader, mute and
// solo were SILENT on every modelled voice. audio/desk.js composed `p.gain`
// into `v.lvl`, and `lvl` is read by sampled voices (stream-renderer.js:649,
// `gain: u.lvl * sets.gain`) and by drums (state-engine.js:2836,
// `level: u.lvl * amp`) AND BY NOTHING ELSE — a modelled pitched voice baked
// its level at cast time. Its only gate read the unit TABLE, which is exactly
// how the board EQ shipped broken for months (desk-gate G8b's own history).
//
// So every check here renders SAMPLES through the shipped mix paths and
// measures RMS — the desk-gate G8b / pp-send.test.js recipe: the DSP behind a
// stub proc handing back deterministic LCG noise, the mix loops the real ones
// (stream-renderer renderUnitWindow for a modelled unit, sampler mixPCM for a
// sampled one), no rng, no clock, no ears. The delay-return check goes one
// further and renders the REAL fx_bus WASM (dist/fx_bus-module.wasm, the same
// artifact the page runs) because the fact under test — `dgain` reaches the
// output — lives inside the DSP.
//
// WHAT IS ASSERTED:
//   R1  modelled chair: fader -12 dB moves rendered dry/rev/del by -12.04 dB
//       (the exact ratio the model claims via resolvedPart), TOGETHER — one
//       trim, all three sends. Before 2026-08-27 this moved 0.00 dB.
//   R2  modelled chair: mute renders SILENCE on all three buses; a solo on
//       another channel does the same.
//   R3  sampled chair: the same fader moves the rendered PCM by the same dB
//       (through mixPCM at the shipped note gain u.lvl * sets.gain); mute is
//       silence.
//   R4  drums: u.lvl moves by the same ratio (the shipped drum formulas both
//       multiply it in: sampled kits at stream-renderer:649, machine kits at
//       state-engine:2836), and the sampled-kit render proves it as RMS.
//   R5  delay return: masterState(ret) -> state.delay.gain -> fxParams dgain
//       -> rendered fx_bus output. Absent = byte-identical to the old literal
//       1; ret "off" makes the del return silent (difference RMS > 0, echo
//       energy gone).
//   R6  levelOf(): the four lanes are ONE table applied one way — the clamp
//       last, `mul` inside it — and the 2026-08-27 turn-down moved every row
//       by the SAME factor, so it is a level change and not a rebalance.
"use strict";
const path = require("path");
const R = (p) => path.join(__dirname, "..", p);

let fails = 0, checks = 0;
const ok = (cond, what, detail) => {
  checks++;
  if (cond) { console.log("  ok   " + what); return true; }
  fails++; console.log("  FAIL " + what + (detail ? "\n       " + detail : ""));
  return false;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const db = (x) => 20 * Math.log10(x);

/* ---------- the stub window (desk-gate's own harness) --------------------- */
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
window.NuCompose = require(R("nukernel/compose.js"));
window.PRESETS = require(R("nukernel/presets.js")).PRESETS;
window.NuDocument = require(R("nukernel/document.js"));
window.NuSongs = require(R("nukernel/songs.js"));
window.__REGISTRY = require(R("engine/registry-data.js"));

const { GENRES } = window.NuGenres;
const NuDoc = window.NuDocument;
const DD = require(R("nukernel/desk-doc.js"));
const { TERMS } = require(R("nukernel/songs.js"));
const SP = require(R("engine/faust/voices/sampler.js"));
const RC = require(R("engine/faust/press/render-core.js"));
const SRE = require(R("engine/faust/live/stream-renderer.js"));
const SE = require(R("engine/faust/voices/state-engine.js"));

const SR = 44100, BS = 64, N = 1 << 15;
const clone = (o) => JSON.parse(JSON.stringify(o));
const mkNoise = (seed) => { let x = seed >>> 0; const o = new Float32Array(N);
  for (let i = 0; i < N; i++) { x = (x * 1103515245 + 12345) >>> 0; o[i] = x / 2147483648 - 1; }
  return o; };
const NOISE = mkNoise(12345), NOISE_R = mkNoise(777);
const rms = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i];
                     return Math.sqrt(s / a.length); };

(async () => {
console.log("test/tape-reach.test.js — the tape hears the board\n");

const DESK = await import(R("nukernel/audio/desk.js"));
const { deskUnits, resolvedPart, masterState } = DESK;
const TE = await import(R("nukernel/audio/to-engine.js"));

/* ---------- the record: a sampled chair, a modelled chair, a kit ---------- */
// the shipped chant + a kit (desk-gate G2's own augmentation): voices[0] is
// the "line" chair, voices[1] "line2", the kit "drums". The unit fixture is
// desk-gate's mkUnits — the same three voice classes the catalog seats.
function record() {
  const d = clone(TERMS);
  d.voices.push({ name: "kit", kind: "drums", cast: { on: true },
    instrument: "acoustic", material: "beat", development: {} });
  d.material.cells.beat = { kind: "drum", lanes: { k: [1, 0, 0, 0] } };
  return NuDoc.normalize(d);
}
const GK = "tape.reach.";
function boxOf(doc) {
  doc.form.sections.forEach((s, i) => {
    GENRES[GK + i] = NuDoc.toGenre(doc, i, GENRES, []);
  });
  const boxes = NuDoc.boxesOf(doc, GK);
  // `fx = DD.boxFxOf(doc)` and `b.fx = fx` CAME OFF HERE 2026-08-27, with the
  // record-wide Character chain itself — Paul: *"We can get rid of Character
  // right? We don't really use it any more do we?"* This mirrors ui/eight.js
  // push() line for line and had to move with it: `boxFxOf` no longer exists,
  // so the line threw `DD.boxFxOf is not a function` and took every render
  // below with it. The chip's one owner is the chair's own `desk.fx` now
  // (desk-doc.js carries the tombstone), which arrives through `p.fxc` on the
  // same insertsFor door this file already renders through.
  const parts = DD.deskPartsOf(doc, GENRES);
  for (const b of boxes) b.parts = parts;
  return boxes[0];
}
const mkUnits = () => ({
  v0: { lvl: 1, module: "sampler", sampler: { id: "ahh_choir" } },
  v1: { lvl: 1, module: "tract_voice" },
  kick: { lvl: 1, drum: true, module: "drum" },
});
const ADDR = { v0: "line", v1: "line2", kick: "drums" };

/* ---------- the renders: the shipped mix loops ---------------------------- */
const eng = SRE.makeStreamEngine({ E: null, SE: null, FP: null, SP,
  mergeIvals: RC.mergeIvals, mkProc: null, rootOf: null, SR, BS });
function renderModelled(u) {
  const buses = { dry: new Float32Array(N), rev: new Float32Array(N),
                  del: new Float32Array(N), pp: new Float32Array(N),
                  wL: new Float32Array(N), wR: new Float32Array(N) };
  let pos = 0;
  const proc = { setParamValue() {},
    render(ins, len) { const a = NOISE.subarray(pos, pos + len),
                             b = NOISE_R.subarray(pos, pos + len);
                       pos += len; return u.stereo ? [a, b] : [a]; } };
  const v = { proc, R: "/x/", pending: [], ivals: [[0, N]], busyUntil: -1,
              lastOff: null, curOut: 1, curPP: 0, renderedEnd: 0 };
  eng.__test.renderUnitWindow({ u, procs: [v], chain: null, chainPrev: null },
                              buses, 0, N, 0.5, null);
  return buses;
}
// the sampled path: mixPCM (the shipped per-note PCM mixer) at the shipped
// note gain — stream-renderer.js:649 builds every sampled note with
// `gain: (u.lvl != null ? u.lvl : 0.5) * (e.sets.gain != null ? e.sets.gain : 0.13)`
// and hands u.dry/u.rev/u.del as the unit's sends. Both halves are cited
// rather than reinvented; the render itself is the real mixer.
const zone = { srcId: "z", root: 60, lo: 0, hi: 127, vlo: 0, vhi: 127,
               loop: false, loopStart: 0, loopEnd: 0, len: N, sr: SR };
function renderSampled(u) {
  const into = { dry: new Float32Array(N), rev: new Float32Array(N), del: new Float32Array(N) };
  const gain = (u.lvl != null ? u.lvl : 0.5) * 0.13;
  SP.mixPCM([{ freq: 261.625565, zones: [zone], tSec: 0, durSec: 0.6, gain,
               atk: 0.001, rel: 0.01, sr: SR }],
            { z: NOISE }, SR, into,
            { dry: u.dry != null ? u.dry : 1, rev: u.rev || 0, del: u.del || 0,
              strip: u.sampler && u.sampler.strip }, null, null);
  return into;
}

/* ---------- one setting of the board -> the three classes rendered -------- */
function renderAt(deskOf) {
  const doc = record();
  if (deskOf) for (const [i, d] of Object.entries(deskOf))
    doc.voices[i].desk = d;
  const box = boxOf(doc);
  const units = deskUnits(mkUnits(), ADDR, box, null, null);
  const m = renderModelled(units.v1);
  const s = renderSampled(units.v0);
  return { units, box,
    modelled: { dry: rms(m.dry), rev: rms(m.rev), del: rms(m.del) },
    sampled: { dry: rms(s.dry), rev: rms(s.rev), del: rms(s.del) },
    drumLvl: units.kick.lvl };
}

// TERMS voice index for each chair key (voices[0] -> "line", voices[1] ->
// "line2"; the kit is pushed last)
const doc0 = record();
const KIT = doc0.voices.length - 1;

console.log("R1/R2/R3/R4 — the per-channel strip reaches every voice class");
{
  // the modelled chair carries an echo send in BOTH settings (fader-only
  // otherwise: the chant sends nothing to bus 2 and 0/0 measures nothing) —
  // so all three of its buses carry signal and all three must move together
  const base = renderAt({ 1: { echo: "some" } });
  const fad = renderAt({ 1: { echo: "some", fader: -12 }, 0: { fader: -12 },
                         [KIT]: { fader: -12 } });
  // what the MODEL claims the move is worth, per class — resolvedPart is the
  // one truth the board's cap draws (audio/desk.js)
  const claim = (key) => {
    const b0 = boxOf(record());
    const d1 = record(); const vi = { line: 0, line2: 1, drums: KIT }[key];
    d1.voices[vi].desk = { fader: -12 };
    const b1 = boxOf(d1);
    return db(resolvedPart(b1, key).gain / resolvedPart(b0, key).gain);
  };
  const cM = claim("line2"), cS = claim("line"), cD = claim("drums");
  const dM = db(fad.modelled.dry / base.modelled.dry);
  const dMr = db(fad.modelled.rev / base.modelled.rev);
  const dMd = db(fad.modelled.del / base.modelled.del);
  const dS = db(fad.sampled.dry / base.sampled.dry);
  const dD = db(fad.drumLvl / base.drumLvl);
  ok(near(dM, cM, 0.1),
     "MODELLED chair: fader -12 dB moves the rendered dry by the claimed " +
     cM.toFixed(2) + " dB — measured " + dM.toFixed(2) + " dB " +
     "(was 0.00 dB before 2026-08-27)");
  ok(near(dMr, cM, 0.1) && near(dMd, cM, 0.1),
     "…and rev and del move WITH it (one trim, all three sends): rev " +
     dMr.toFixed(2) + " dB, del " + dMd.toFixed(2) + " dB");
  ok(near(dS, cS, 0.1),
     "SAMPLED chair: the same fader moves the rendered PCM by the claimed " +
     cS.toFixed(2) + " dB — measured " + dS.toFixed(2) + " dB");
  ok(near(dD, cD, 0.1),
     "DRUMS: u.lvl (the multiplier in BOTH shipped drum formulas) moves by " +
     "the claimed " + cD.toFixed(2) + " dB — measured " + dD.toFixed(2) + " dB");

  const mut = renderAt({ 1: { mute: true }, 0: { mute: true }, [KIT]: { mute: true } });
  ok(mut.modelled.dry === 0 && mut.modelled.rev === 0 && mut.modelled.del === 0,
     "MODELLED mute is SILENCE on all three buses",
     JSON.stringify(mut.modelled));
  ok(mut.sampled.dry === 0 && mut.drumLvl === 0,
     "…and so are the sampled chair (rendered) and the kit (u.lvl 0)",
     JSON.stringify({ sampled: mut.sampled.dry, drumLvl: mut.drumLvl }));

  const solo = renderAt({ [KIT]: { solo: true } });
  ok(solo.modelled.dry === 0 && solo.sampled.dry === 0 && solo.drumLvl > 0,
     "SOLO on the kit silences the modelled AND sampled chairs (rendered) " +
     "and leaves the kit standing",
     JSON.stringify({ m: solo.modelled.dry, s: solo.sampled.dry, d: solo.drumLvl }));

  // absent-is-today for the ROUTE: with no hand on the board, the modelled
  // unit's route trim is exactly the derived p.gain the board has always
  // DRAWN (resolvedPart), no more — so the only change on an untouched record
  // is that the printed number now sounds.
  const untouched = renderAt(null);
  const u1 = untouched.units.v1;
  const g0 = resolvedPart(untouched.box, "line2").gain;
  const want = g0 === 1 ? null : g0;
  ok((want == null && u1.dry == null) || near(u1.dry, want, 5e-4),
     "an untouched record's modelled route trim IS the number the board " +
     "prints (derived p.gain " + g0 + "), nothing else", "u.dry = " + u1.dry);
}

/* ---------- R5 · the delay return, through the real fx_bus WASM ----------- */
console.log("\nR5 — the echo bus `ret` knob reaches the rendered tape");
await (async () => {
  const fs = require("fs");
  const FAUST = R("engine/faust");
  const { FaustMonoDspGenerator } = await import(
    path.join(FAUST, "node_modules/@grame/faustwasm/dist/esm/index.js"));
  const code = fs.readFileSync(path.join(FAUST, "dist", "fx_bus-module.wasm"));
  const factory = { cfactory: 0, code: new Uint8Array(code),
    module: await WebAssembly.compile(code),
    json: fs.readFileSync(path.join(FAUST, "dist", "fx_bus-meta.json"), "utf8"),
    poly: false };
  const gen = new FaustMonoDspGenerator();
  const T = SR * 2;
  const del = new Float32Array(T), zero = new Float32Array(T);
  // a delay-heavy feed: two bars of eighth-note pings into the del bus (the
  // signal every unit's `u.del` send sums into)
  for (let n2 = 0; n2 < 8; n2++) {
    const s = Math.floor(n2 * 0.25 * SR);
    for (let i = 0; i < 400 && s + i < T; i++) del[s + i] = NOISE[i] * (1 - i / 400);
  }
  async function renderFx(state) {
    const proc = await gen.createOfflineProcessor(SR, BS, factory);
    const fx = SE.fxParams(state);
    for (const [k, v] of Object.entries(fx))
      if (typeof v === "number") proc.setParamValue("/fx_bus/" + k, v);
    const out = new Float32Array(T);
    for (let s = 0; s < T; s += BS) {
      const len = Math.min(BS, T - s);
      const o = proc.render([zero.subarray(s, s + len), zero.subarray(s, s + len),
                             zero.subarray(s, s + len), del.subarray(s, s + len),
                             zero.subarray(s, s + len), zero.subarray(s, s + len)], len);
      out.set(o[0].subarray(0, len), s);
    }
    return out;
  }
  const base = { bpm: 120, seed: 1, reverb: 0 };
  // ABSENT IS TODAY, byte for byte: a state with no delay.gain renders the
  // same samples as the literal 1 fxParams used to hard-code.
  const stAbsent = { ...base, ...(masterState(null, { echo: { time: "d8" } }) || {}) };
  const a = await renderFx(stAbsent);
  const b = await renderFx({ ...stAbsent, delay: { ...stAbsent.delay, gain: 1 } });
  let same = true; for (let i = 0; i < T; i++) if (a[i] !== b[i]) { same = false; break; }
  ok(same, "ret ABSENT renders byte-identical to the old literal dgain 1");
  // ...and the knob at its floor SHUTS the return: the difference signal is
  // the echo itself, and the rendered output loses its tail energy.
  const stOff = { ...base, ...(masterState(null, { echo: { time: "d8", ret: "off" } }) || {}) };
  ok(stOff.delay && stOff.delay.gain === 0,
     "masterState maps ret \"off\" -> state.delay.gain 0 (ERETURNS)",
     JSON.stringify(stOff.delay));
  const c = await renderFx(stOff);
  const diff = new Float32Array(T);
  for (let i = 0; i < T; i++) diff[i] = a[i] - c[i];
  const rd = rms(diff), ra = rms(a), rc = rms(c);
  ok(rd > 0 && ra > 0,
     "ret \"off\" vs default moves the RENDERED tape: |default - off| RMS = " +
     rd.toExponential(3) + " (default " + ra.toExponential(3) + ", off " +
     rc.toExponential(3) + " = " + db(rc / ra).toFixed(1) + " dB)");
  // the hot end reaches too — the knob is a range, not a switch
  const stHuge = { ...base, ...(masterState(null, { echo: { time: "d8", ret: "huge" } }) || {}) };
  const d = await renderFx(stHuge);
  ok(rms(d) > ra, "ret \"huge\" (dgain 2) renders HOTTER than unity: " +
     rms(d).toExponential(3) + " > " + ra.toExponential(3));
})();

/* ---------- R6 · the lane table, and that the turn-down was UNIFORM -------
   THIS CHECK IS A REWRITE, DATED 2026-08-27, AND ITS SUBJECT MOVED RATHER THAN
   ITS LAW. It read "all four lanes match their historical formulas" and drove
   the four literals the consolidation had replaced — `gain*2.2` into [0.15, 1],
   `(gain ?? .28)*2.8` into [0.35, .92] and [0.5, .92], the same times `mul` —
   because the round that wrote it was proving a CONSOLIDATION moved no sound.

   Then Paul listened: *"voices seem to be mixed really hot and saturated"*,
   and, when asked to let it be measured first, *"Just turn down saturation my
   ears aren't wrong."* The gain staging is the saturation on this box (the
   whole argument is in the levelOf comment in audio/to-engine.js: the mix sits
   inside fx_bus's soft-clip knee, and 2 dB off the front buys back 0.67-1.47 dB
   of crest while the peak barely moves), so every row of the table went to
   0.75 of itself — a uniform -2.50 dB, clamps included.

   A GATE THAT ONLY HELD THE OLD NUMBERS WOULD HAVE NOTHING LEFT TO SAY, so the
   two claims underneath it are stated instead, and both are stronger than the
   literals were:

     (a) THE SHAPE. levelOf reads the table and nothing else — `dflt` when the
         tone is silent, times `scale`, times `mul`, clamped LAST into
         [lo, hi] — driven per lane at nine gains, against the table itself
         rather than against a copy of its numbers. A second copy of the
         numbers here is how the two drift.
     (b) THE TURN-DOWN WAS A LEVEL MOVE AND NOT A REBALANCE. Every one of the
         nine numbers is exactly 0.75 of what it was on 2026-08-26, so the four
         lanes — separately fitted against their own output trims, which is why
         the rows were never merged — keep every ratio between them. If a later
         hand nudges one lane on its own, the ratios move and this fails, which
         is the finding this file exists to make: an insert that changes the
         BALANCE while claiming to change the LEVEL.
   Byte-identity across the catalog stays the frozen fixture's job
   (test/levelof-frozen.fixture.js), and after this change it is a fixture of
   the NEW table: the hashes deliberately differ from 2026-08-26's, which is
   what Paul asked for. */
console.log("\nR6 — the lane table, and the uniform -2.50 dB of 2026-08-27");
{
  const clampL = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const T = TE.LEVEL_LANES;
  const gains = [null, 0, 0.1, 0.28, 0.35, 0.5, 0.9, 1.3, 2];
  const bad = [];
  for (const g of gains) {
    const t = g == null ? {} : { gain: g };
    for (const lane of ["sampled", "model", "synth"]) {
      const L = T[lane];
      const raw = g == null ? L.dflt : g;
      const want = raw == null ? null : clampL(raw * L.scale, L.lo, L.hi);
      if (TE.levelOf(t, lane) !== want) bad.push(lane + " g=" + g);
      const wantM = raw == null ? null : clampL(raw * L.scale * 1.35, L.lo, L.hi);
      if (TE.levelOf(t, lane, 1.35) !== wantM) bad.push(lane + "*mul g=" + g);
    }
  }
  ok(!bad.length, "every lane is `dflt -> *scale -> *mul -> clamp(lo,hi)` off " +
     "the table itself, at " + gains.length + " gains — no lane carries " +
     "arithmetic of its own", bad.join(", "));
  // the table as it stood on 2026-08-26, the morning of the turn-down
  const WAS = {
    sampled: { dflt: null, scale: 2.2, lo: 0.15, hi: 1 },
    model:   { dflt: 0.28, scale: 2.8, lo: 0.35, hi: 0.92 },
    synth:   { dflt: 0.28, scale: 2.8, lo: 0.5,  hi: 0.92 },
  };
  const F = 0.75, off = [];
  for (const lane of Object.keys(WAS))
    for (const k of ["scale", "lo", "hi"]) {
      const want = WAS[lane][k] * F;
      if (Math.abs(T[lane][k] - want) > 1e-9)
        off.push(lane + "." + k + " " + T[lane][k] + " want " + +want.toFixed(6));
    }
  ok(!off.length, "…and every one of the nine numbers is EXACTLY 0.75 of what " +
     "it was on 2026-08-26 (-2.50 dB, clamps included) — Paul, 2026-08-27: " +
     "\"Just turn down saturation my ears aren't wrong\", and a uniform factor " +
     "is what makes that a level change instead of a remix", off.join(", "));
  // …and the four rows still say four different things, which is why the
  // consolidation kept them apart in the first place.
  ok(T.sampled.scale !== T.model.scale && T.model.lo !== T.synth.lo,
     "…and the lanes are still DISTINCT after it — sampled " + T.sampled.scale +
     " against model/synth " + T.model.scale + ", model floor " + T.model.lo +
     " against synth " + T.synth.lo + " — a uniform trim must not merge rows " +
     "that were fitted separately");
}

console.log("\n" + (fails ? "FAIL" : "ok") + " — " + checks + " checks, " + fails + " failures");
process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
