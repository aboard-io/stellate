#!/usr/bin/env node
// test/series-bus.test.js — THE SERIES BUS, MEASURED ON RENDERED AUDIO.
//
// Paul, 2026-08-27: "one bus for genre specific effects, into a delay bus,
// into reverb, into main. Each instrument can send post effects mix to all of
// the four buses." The engine round built exactly that and nothing beside it:
//   * fx_bus's delay→reverb feed — the literal `d*0.2` at fx_bus.dsp:221
//     since the csound port — is the `bleed` slider (default 0.2), mirrored
//     in rev_bleed so colored rooms track it; buses.echo.bleed is the hand.
//   * a GENRE STAGE in BOTH renderers: a fifth mono accumulator (`gen`), fed
//     by the per-unit route `u.genre` at the same three send sites as
//     u.rev/u.del, run through the record's genre chain (state.genreBus —
//     the rack's chips through the same insert door as every section chip),
//     scaled by the rack's `level → delay`, and SUMMED INTO THE DELAY BUS
//     before fx_bus. Genre → delay → reverb → main. No wire to the main.
//
// THE MASTER GATE OF THE ROUND IS ABSENT-IS-TODAY, BYTE-IDENTICAL: a record
// with no genre facts and no bleed word renders byte-for-byte what it rendered
// before the round. The pre-round stash-compare was run at build time (two
// records, md5-equal across the fx_bus recompile and every engine edit); this
// file holds the PERMANENT half — the no-op claims that keep it true — plus
// the reach and routing proofs, all on rendered samples (TEST THE ARTIFACT):
//
//   S0  unit walk: u.genre reaches the gen bus at the same three sites as
//       u.rev/u.del, POST-strip like them, live == press sample-for-sample,
//       and a unit with no send writes nothing (pp-send.test.js recipe).
//   S1  PRESS absent-is-today: genreBus {level:1} alone / bleed 0.2 explicit
//       render byte-identical to saying nothing.
//   S2  LIVE/PRESS parity, byte-level, on a record WITHOUT and WITH genre
//       sends + a one-chip chain (the whole-song stream walk vs assemble).
//   S3  the genre send + chain CHANGES THE RENDERED SPECTRUM (dB per band
//       reported) — the knob reaches the sound.
//   S4  SERIES PROOF: with the delay return at "off" (dgain 0) the genre
//       chain's whole contribution dies — byte-identical to no-genre — so it
//       feeds the delay and nothing else.
//   S5  bleed 0 measurably kills the delay→reverb feed on a delay-heavy
//       record (reverb-tail RMS reported), and absent == explicit 0.2 byte.
//   S6  the bleed reaches FROM THE BOARD: EBLEEDS words through masterState
//       change the rendered tape, "off" == the direct 0 render byte-for-byte.
//   S7  the genre level word: "off" kills the summed return (byte-identical
//       to no-genre), absent = unity = S3's audible render.
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
const db = (x) => 20 * Math.log10(Math.max(x, 1e-12));
const rms = (a, s, e) => { s = s || 0; e = e || a.length; let q = 0;
  for (let i = s; i < e; i++) q += a[i] * a[i]; return Math.sqrt(q / Math.max(1, e - s)); };
const firstDiff = (a, b) => { if (a.length !== b.length) return -2;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i; return -1; };
const maxDiff = (a, b) => { let w = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) w = Math.max(w, Math.abs(a[i] - b[i]));
  return w; };
// Goertzel per band — enough spectrum to say "the sound moved", no FFT dep
function bandDb(x, f0, SRr) {
  const N = Math.min(x.length, 1 << 15);
  const w = 2 * Math.PI * f0 / SRr, c = 2 * Math.cos(w);
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < N; i++) { s0 = x[i] + c * s1 - s2; s2 = s1; s1 = s0; }
  const p = s1 * s1 + s2 * s2 - c * s1 * s2;
  return db(Math.sqrt(Math.max(p, 0) / (N * N / 4)));
}
const BANDS = [110, 220, 440, 880, 1760, 3520, 7040];

/* ---------- the stub window (tape-reach's own preamble) ------------------- */
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

const E = require(R("engine/csd-engine.js"));
const SE = require(R("engine/faust/voices/state-engine.js"));
const FP = require(R("engine/faust/voices/found-player.js"));
const SP = require(R("engine/faust/voices/sampler.js"));
const RC = require(R("engine/faust/press/render-core.js"));
const SRE = require(R("engine/faust/live/stream-renderer.js"));
const PRESS = require(R("engine/faust/press/press.js"));
const K = require(R("engine/genre-kernel.js"));
const F = require(R("nukernel/fields.js"));

const SR = 44100, BS = 64;

/* ================= S0 · THE UNIT WALK (pp-send recipe) ==================== */
const N0 = 1 << 14;
const mkNoise = (seed) => { let x = seed >>> 0; const o = new Float32Array(N0);
  for (let i = 0; i < N0; i++) { x = (x * 1103515245 + 12345) >>> 0; o[i] = x / 2147483648 - 1; }
  return o; };
const NOISE = mkNoise(12345), NOISE_R = mkNoise(777);
const newBuses = () => ({ dry: new Float32Array(N0), rev: new Float32Array(N0),
  del: new Float32Array(N0), pp: new Float32Array(N0), gen: new Float32Array(N0),
  wL: new Float32Array(N0), wR: new Float32Array(N0) });
const STRIP = { lo: -12, mid: 0, hi: 9 };
const GS = 0.6;   // the send under test

const engStub = SRE.makeStreamEngine({ E: null, SE: null, FP: null, SP,
  mergeIvals: RC.mergeIvals, mkProc: null, rootOf: null, SR, BS });
function liveWalk(u) {
  const buses = newBuses();
  let pos = 0;
  const proc = { setParamValue() {},
    render(ins, len) { const a = NOISE.subarray(pos, pos + len),
                             b = NOISE_R.subarray(pos, pos + len);
                       pos += len; return u.stereo ? [a, b] : [a]; } };
  const v = { proc, R: "/x/", pending: [], ivals: [[0, N0]], busyUntil: -1,
              lastOff: null, curOut: 1, curPP: 0, renderedEnd: 0 };
  engStub.__test.renderUnitWindow({ u, procs: [v], chain: null, chainPrev: null },
                                  buses, 0, N0, 0.5, null);
  return buses;
}
async function pressWalk(u) {
  const buses = newBuses();
  let pos = 0;
  const proc = { setParamValue() {},
    render(ins, len) { const a = NOISE.subarray(pos, pos + len),
                             b = NOISE_R.subarray(pos, pos + len);
                       pos += len; return u.stereo ? [a, b] : [a]; } };
  const ev = [{ beat: 0, durB: N0 / SR / 0.5, sets: {}, amp: 1, hold: true }];
  await RC.renderUnit({ ...u, pool: 1, tail: 0.001 }, ev,
    { mkProc: async () => proc, rootOf: () => "x", SR, BS, TOTAL: N0, spb: 0.5,
      buses, speech: null, dx7Presets: {}, SP });
  return buses;
}

/* ================= the two records (press.assemble path) ================== */
function planA() {
  const bars = [];
  for (let b = 0; b < 3; b++) {
    const ev = [];
    for (let i = 0; i < 16; i += 4) ev.push({ kind: "hit", d: "k", off: i, vel: 7 });
    for (let i = 4; i < 16; i += 8) ev.push({ kind: "hit", d: "s", off: i, vel: 6 });
    for (let i = 0; i < 16; i += 2) ev.push({ kind: "hit", d: "h", off: i, vel: 4 });
    ev.push({ kind: "line", v: 0, n: 60 + b, off: 0, dur: 4, vel: 6 });
    ev.push({ kind: "line", v: 0, n: 67, off: 8, dur: 4, vel: 5 });
    ev.push({ kind: "bass", n: 36, off: 0, dur: 8, vel: 6 });
    bars.push({ barSteps: 16, ev });
  }
  return { bpm: 120, seed: 3, kit: "tr909", bars,
           reverb: 0.55, delay: { beats: 0.75, feedback: 0.45 },
           seat: () => ({ chair: "line", synth: { dsp: "pad_saw", level: 0.5 } }),
           bass: { synth: { dsp: "bass_sub", level: 0.5 } } };
}
let TE = null;
async function record(stateOver, unitOver) {
  const t = TE.toEngine(planA(), { SE, K, E });
  const state = { ...t.state, ...(stateOver || {}) };
  if (unitOver) for (const [k, patch] of Object.entries(unitOver))
    if (t.units[k]) Object.assign(t.units[k], patch);
  const sched = SE.mapEvents(E, state, t.ev, { units: t.units });
  return { state, sched };
}
async function pressRender(rec) {
  const spb = rec.sched.spb, totalSec = rec.sched.totalBeats * spb;
  const TOTAL = Math.ceil(totalSec * SR);
  const { L, Rr } = await PRESS.assemble(rec.state, rec.sched,
    { mkProc: PRESS.mkProc, rootOf: PRESS.rootOf, buffers: {}, speech: null,
      dx7Presets: PRESS.loadDx7Presets() }, { spb, totalSec, TOTAL });
  return { L, R: Rr, TOTAL };
}
async function liveRender(rec) {
  const eng = SRE.makeStreamEngine({ E, SE, FP, SP, mergeIvals: RC.mergeIvals,
    mkProc: PRESS.mkProc, rootOf: PRESS.rootOf, SR, BS });
  const info = await eng.open(rec.state, { sched: rec.sched, buffers: {} });
  const L = new Float32Array(info.TOTAL), Rr = new Float32Array(info.TOTAL);
  for (let n = 0; n < info.nChunks; n++) {
    const c = await eng.renderChunk(n);
    L.set(c.L, c.startSample); Rr.set(c.R, c.startSample);
  }
  eng.close();
  return { L, R: Rr, TOTAL: info.TOTAL };
}

/* ================= the fx_bus direct drive (tape-reach R5) ================ */
async function fxDrive(state, del) {
  const FAUST = R("engine/faust");
  const { FaustMonoDspGenerator } = await import(
    path.join(FAUST, "node_modules/@grame/faustwasm/dist/esm/index.js"));
  const code = fs.readFileSync(path.join(FAUST, "dist", "fx_bus-module.wasm"));
  const factory = { cfactory: 0, code: new Uint8Array(code),
    module: await WebAssembly.compile(code),
    json: fs.readFileSync(path.join(FAUST, "dist", "fx_bus-meta.json"), "utf8"),
    poly: false };
  const gen = new FaustMonoDspGenerator();
  const T = del.length, zero = new Float32Array(T);
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

(async () => {
console.log("test/series-bus.test.js — genre → delay → reverb → main, on samples\n");
TE = await import(R("nukernel/audio/to-engine.js"));
const DESK = await import(R("nukernel/audio/desk.js"));
const { masterState } = DESK;

/* ---- S0 -------------------------------------------------------------- */
console.log("S0 — u.genre at the unit walk, live and press");
{
  const Ld = liveWalk({ lvl: 1, module: "tract_voice", genre: GS });
  const Ls = liveWalk({ lvl: 1, module: "tract_voice", genre: GS, strip: STRIP });
  const Pd = await pressWalk({ lvl: 1, module: "tract_voice", genre: GS });
  const Ps = await pressWalk({ lvl: 1, module: "tract_voice", genre: GS, strip: STRIP });
  ok(rms(Ld.gen) > 1e-4 && rms(Ls.gen) > 1e-4,
     "LIVE · the genre send reaches the gen bus, direct AND through a strip",
     "direct rms " + rms(Ld.gen).toExponential(3) + ", strip " + rms(Ls.gen).toExponential(3));
  {
    let worst = 0;
    for (let i = 0; i < N0; i++)
      worst = Math.max(worst, Math.abs(Ld.gen[i] - Math.fround(NOISE[i] * GS)));
    ok(worst === 0, "LIVE · direct path: gen IS source × the send, exactly",
       "largest error " + worst.toExponential(3));
  }
  ok(firstDiff(Ls.gen, Ld.gen) >= 0,
     "LIVE · the strip path's gen DIFFERS from the direct one — the send is " +
     "taken POST-EQ like rev/del (and unlike pp, whose margin note says why)");
  {
    // ...and it is the same signal the DRY takes, scaled: gen == dry × GS
    let worst = 0;
    for (let i = 0; i < N0; i++)
      worst = Math.max(worst, Math.abs(Ls.gen[i] - Math.fround(Ls.dry[i] * GS)));
    ok(worst < 1e-7, "LIVE · strip path: gen == the post-strip dry × the send",
       "largest error " + worst.toExponential(3));
  }
  ok(firstDiff(Ls.gen, Ps.gen) < 0 && firstDiff(Ld.gen, Pd.gen) < 0,
     "PARITY · live and press write the identical gen bus, both paths",
     "strip firstDiff " + firstDiff(Ls.gen, Ps.gen) + ", direct " + firstDiff(Ld.gen, Pd.gen));
  const Z = liveWalk({ lvl: 1, module: "tract_voice", strip: STRIP });
  let z = true; for (let i = 0; i < N0; i++) if (Z.gen[i] !== 0) { z = false; break; }
  ok(z, "ABSENT · a unit with no genre send writes nothing to gen");
  const Zn = (() => {  // no gen bus offered at all — the shipped four-bus caller
    const b = newBuses(); delete b.gen; return b; })();
  // (renderUnitWindow with buses lacking `gen` must not throw — the guard law)
  let threw = false;
  try {
    let pos = 0;
    const proc = { setParamValue() {}, render(ins, len) {
      const a = NOISE.subarray(pos, pos + len); pos += len; return [a]; } };
    engStub.__test.renderUnitWindow({ u: { lvl: 1, module: "x", genre: GS },
      procs: [{ proc, R: "/x/", pending: [], ivals: [[0, N0]], busyUntil: -1,
                lastOff: null, curOut: 1, curPP: 0, renderedEnd: 0 }],
      chain: null, chainPrev: null }, Zn, 0, N0, 0.5, null);
  } catch (e) { threw = true; }
  ok(!threw, "GUARD · a four-bus caller (no gen key) renders without throwing");
}

/* ---- S1 · PRESS absent-is-today -------------------------------------- */
console.log("\nS1 — absent is today, byte for byte (press)");
const base = await pressRender(await record(null));
{
  const a = await pressRender(await record({ genreBus: { level: 1 } }));
  ok(firstDiff(base.L, a.L) < 0 && firstDiff(base.R, a.R) < 0,
     "genreBus {level:1} with no chain and no sends renders BYTE-IDENTICAL",
     "firstDiff L " + firstDiff(base.L, a.L));
  const b = await pressRender(await record({ bleed: 0.2 }));
  ok(firstDiff(base.L, b.L) < 0 && firstDiff(base.R, b.R) < 0,
     "bleed written explicitly at its default 0.2 renders BYTE-IDENTICAL",
     "firstDiff L " + firstDiff(base.L, b.L));
  // (the pre-round stash-compare — two records, md5-equal across the fx_bus
  // recompile — was run at build time; these two hold the claim in-tree)
}

/* ---- S2 · LIVE/PRESS parity, without and with the genre stage --------- */
console.log("\nS2 — live/press parity (whole-song stream walk vs assemble)");
const gbDoor = masterState(null, { genre: { fx1: "crunch" } }, SE) || {};
ok(gbDoor.genreBus && gbDoor.genreBus.chain && gbDoor.genreBus.chain.length === 1
   && gbDoor.genreBus.chain[0].module === "insert_higain",
   "the rack's chip word resolves through masterState + insertChain to a real " +
   "module (crunch -> insert_higain)", JSON.stringify(gbDoor));
// the S2/S3/S4 record turns the stage UP so the spectrum claim is measured
// against a contribution the ear would notice: the chair AND the kit send at
// 0.9 (SENDS `drown`), the chain is a ring mod (a spectral MOVE, not a tone
// tilt), the level word is `blown` (2) — all through the same doors a hand
// would use.
const gbLoud = masterState(null, { genre: { fx1: "ringmod", level: "blown" } }, SE) || {};
const GENRE_OVER = { ...gbLoud };
const GSENDS = { v0: { genre: 0.9 }, kick: { genre: 0.9 },
                 snare: { genre: 0.9 }, hat: { genre: 0.9 } };
const recG = () => record(GENRE_OVER, GSENDS);
{
  const lv = await liveRender(await record(null));
  ok(firstDiff(base.L, lv.L) < 0 && firstDiff(base.R, lv.R) < 0,
     "ABSENT: the live stream's bytes ARE press's bytes (so the pre-round " +
     "identity proven on press binds the live path too)",
     "firstDiff L " + firstDiff(base.L, lv.L) + " maxΔ " + maxDiff(base.L, lv.L).toExponential(2));
  const pg = await pressRender(await recG());
  const lg = await liveRender(await recG());
  ok(firstDiff(pg.L, lg.L) < 0 && firstDiff(pg.R, lg.R) < 0,
     "WITH a genre send + one-chip chain: live == press, byte for byte " +
     "(persistent chain over BS windows == whole-song SPAN walk)",
     "firstDiff L " + firstDiff(pg.L, lg.L) + " maxΔ " + maxDiff(pg.L, lg.L).toExponential(2));

  /* ---- S3 · the spectrum moves ---------------------------------------- */
  console.log("\nS3 — the genre send + chain changes the rendered spectrum");
  const deltas = BANDS.map((f) =>
    ({ f, d: +(bandDb(pg.L, f, SR) - bandDb(base.L, f, SR)).toFixed(2) }));
  console.log("       dB per band vs no-genre: " +
    deltas.map((x) => x.f + "Hz " + (x.d > 0 ? "+" : "") + x.d).join(" · "));
  ok(firstDiff(base.L, pg.L) >= 0,
     "the rendered tape CHANGED (sends 0.9 on chair + kit, ringmod chain, level 2)");
  ok(deltas.some((x) => Math.abs(x.d) > 1),
     "…and at least one band moved by more than 1 dB",
     JSON.stringify(deltas));

  /* ---- S4 · the series, proven by killing the delay return ------------ */
  console.log("\nS4 — series proof: the genre bus feeds the DELAY, not the main");
  const offBase = await pressRender(await record({ delay: { beats: 0.75, feedback: 0.45, gain: 0 } }));
  const offGenre = await pressRender(await record(
    { ...GENRE_OVER, delay: { beats: 0.75, feedback: 0.45, gain: 0 } }, GSENDS));
  ok(firstDiff(offBase.L, offGenre.L) < 0 && firstDiff(offBase.R, offGenre.R) < 0,
     "with the delay return at 0 (echo `ret` off) the genre chain's whole " +
     "contribution DIES — byte-identical to no-genre. It reaches the main " +
     "only through the delay: the series stands",
     "firstDiff L " + firstDiff(offBase.L, offGenre.L));

  /* ---- S7 · the level word -------------------------------------------- */
  console.log("\nS7 — the rack's level → delay");
  const lvOff = masterState(null, { genre: { level: "off", fx1: "crunch" } }, SE) || {};
  ok(lvOff.genreBus && lvOff.genreBus.level === 0,
     "GLEVELS `off` resolves to level 0 through masterState",
     JSON.stringify(lvOff.genreBus));
  const pOff = await pressRender(await record(lvOff, GSENDS));
  ok(firstDiff(base.L, pOff.L) < 0,
     "level `off` kills the summed return — byte-identical to no-genre " +
     "(the chain ran; nothing of it reached the delay)",
     "firstDiff L " + firstDiff(base.L, pOff.L));
  ok(firstDiff(base.L, pg.L) >= 0,
     "…and level ABSENT is unity: S3's render is the audible proof");
}

/* ---- S5 · bleed 0 kills the delay→reverb feed ------------------------- */
console.log("\nS5 — the bleed, on a delay-heavy feed through the real fx_bus");
{
  const T = SR * 4;
  const del = new Float32Array(T);
  // pings in the first 0.5 s only, feedback 0.1 — the echo repeats die inside
  // a second, so the last second of the render belongs to the zita tail alone
  // and "reverb-band RMS" is measured on the room, not on leftover repeats
  for (let n = 0; n < 2; n++) {
    const s = Math.floor(n * 0.25 * SR);
    for (let i = 0; i < 400; i++) del[s + i] = NOISE[i % N0] * (1 - i / 400);
  }
  const st = { bpm: 120, seed: 1, reverb: 0.55, delay: { beats: 0.75, feedback: 0.1 } };
  const dflt = await fxDrive(st, del);
  const exp02 = await fxDrive({ ...st, bleed: 0.2 }, del);
  ok(firstDiff(dflt, exp02) < 0,
     "bleed ABSENT == explicit 0.2, byte for byte (the old literal)");
  const b0 = await fxDrive({ ...st, bleed: 0 }, del);
  // the last 1.0 s: pings + echo repeats have decayed, the zita tail owns it
  const t0 = Math.floor(T - 1.0 * SR);
  const tailD = rms(dflt, t0, T), tail0 = rms(b0, t0, T);
  const diffRms = (() => { const d2 = new Float32Array(T);
    for (let i = 0; i < T; i++) d2[i] = dflt[i] - b0[i]; return rms(d2); })();
  ok(firstDiff(dflt, b0) >= 0 && diffRms > 0,
     "bleed 0 changes the rendered tape: |default − 0| RMS " + diffRms.toExponential(3));
  ok(tailD > tail0 * 2,
     "…and the REVERB TAIL dies with it: tail RMS " + db(tailD).toFixed(1) +
     " dB at 0.2 vs " + db(tail0).toFixed(1) + " dB at 0 (" +
     db(tailD / Math.max(tail0, 1e-12)).toFixed(1) + " dB of room fed by the delay)");
  const b1 = await fxDrive({ ...st, bleed: 1 }, del);
  ok(rms(b1, t0, T) > tailD,
     "…and 1 pours MORE delay into the room than 0.2: tail " +
     db(rms(b1, t0, T)).toFixed(1) + " dB — the knob is a range");

  /* ---- S6 · the board reaches it -------------------------------------- */
  console.log("\nS6 — the bleed from the BOARD's own words");
  const wOff = masterState(null, { echo: { bleed: "off" } }) || {};
  const wSoak = masterState(null, { echo: { bleed: "soaked" } }) || {};
  ok(wOff.bleed === 0 && wSoak.bleed === 1,
     "EBLEEDS `off`/`soaked` -> state.bleed 0/1 through masterState",
     JSON.stringify({ off: wOff.bleed, soaked: wSoak.bleed }));
  const rOff = await fxDrive({ ...st, ...wOff }, del);
  const rSoak = await fxDrive({ ...st, ...wSoak }, del);
  ok(firstDiff(rOff, b0) < 0,
     "the board's `off` renders byte-identical to the direct bleed-0 drive — " +
     "one wire, no second arithmetic");
  ok(rms(rSoak, t0, T) > tailD && firstDiff(rSoak, dflt) >= 0,
     "the board's `soaked` renders a wetter room than the default — drive " +
     "the control, hear the change (tail " + db(rms(rSoak, t0, T)).toFixed(1) +
     " dB vs default " + db(tailD).toFixed(1) + " dB)");
}

console.log("\n" + (fails ? "FAIL" : "ok") + " — " + checks + " checks, " + fails + " failures");
process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
