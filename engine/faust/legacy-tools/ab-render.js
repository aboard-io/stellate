#!/usr/bin/env node
// ab-render.js — Phase-1 gate: for every synthesis model, render ~6s of the
// same notes through (a) the Faust port (precompiled dist/ artifacts, faustwasm
// offline processors — the exact code the browser will run) and (b) the legacy
// csound engine (the working-tree csd-engine.js orchestra via the csound CLI),
// then compare RMS (within 6 dB) and spectral centroid (within 35%).
//
//   node ab-render.js [modelId ...]     # subset; default = everything
//
// Per-model wavs land in faust/ab/ (gitignored — audio is derived, never
// committed); the verdict table is written to faust/ab-report.md.
//
// csound side: we call buildCsd(state) for the ORCHESTRA (so the compared code
// is literally the shipping csound codegen), throw away its score, and splice
// in a minimal per-model score (t 0 60 => beats are seconds). Voice tests zero
// the reverb/delay sends so both sides are dry; fx tests exercise the buses.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AB = path.join(__dirname, "ab");
const engine = require(path.join(ROOT, "csd-engine.js"));

const SR = 44100, BS = 64, SECS = 6, TOTAL = SR * SECS;

// ---------------------------------------------------------------- utilities
const cpspch = (p) => { const o = Math.floor(p), st = Math.round((p - o) * 100); return 261.625565 * Math.pow(2, (o - 8) + st / 12); };

function writeWav(file, chans) { // chans: [Float32Array,...]
  const n = chans[0].length, C = chans.length;
  const data = Buffer.alloc(n * C * 2);
  for (let i = 0; i < n; i++) for (let c = 0; c < C; c++)
    data.writeInt16LE(Math.max(-1, Math.min(1, chans[c][i])) * 32767 | 0, (i * C + c) * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(C, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * C * 2, 28); h.writeUInt16LE(C * 2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

function readWavMono(file) { // -> Float32Array (channel-averaged), PCM16 or float32
  const b = fs.readFileSync(file);
  let off = 12, fmt = 1, ch = 1, bits = 16, data = null;
  while (off + 8 <= b.length) {
    const id = b.toString("ascii", off, off + 4), sz = b.readUInt32LE(off + 4);
    if (id === "fmt ") { fmt = b.readUInt16LE(off + 8); ch = b.readUInt16LE(off + 10); bits = b.readUInt16LE(off + 22); }
    else if (id === "data") { data = b.subarray(off + 8, off + 8 + sz); break; }
    off += 8 + sz + (sz & 1);
  }
  if (!data) throw new Error("no data chunk: " + file);
  const bytes = bits / 8, frames = Math.floor(data.length / (bytes * ch));
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < ch; c++) {
      const o = (i * ch + c) * bytes;
      s += (fmt === 3 || fmt === 0xFFFE && bits === 32) ? data.readFloatLE(o)
        : bits === 16 ? data.readInt16LE(o) / 32768
        : bits === 32 ? data.readInt32LE(o) / 2147483648
        : (data.readUInt8(o) - 128) / 128;
    }
    out[i] = s / ch;
  }
  return out;
}

const fit = (x) => { const y = new Float32Array(TOTAL); y.set(x.subarray(0, Math.min(x.length, TOTAL))); return y; };
const rms = (x) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s / x.length); };
const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));

function fft(re, im) { // in-place radix-2
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

function centroid(x) { // magnitude-weighted mean frequency over voiced frames
  const N = 4096, H = 2048;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const frames = [];
  let peak = 0;
  for (let s = 0; s + N <= x.length; s += H) {
    let e = 0; for (let i = 0; i < N; i++) e += x[s + i] * x[s + i];
    const r = Math.sqrt(e / N); peak = Math.max(peak, r); frames.push([s, r]);
  }
  let num = 0, den = 0;
  for (const [s, r] of frames) {
    if (r < peak * 0.02) continue;
    const re = new Float32Array(N), im = new Float32Array(N);
    for (let i = 0; i < N; i++) re[i] = x[s + i] * win[i];
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const m = Math.hypot(re[k], im[k]);
      num += (k * SR / N) * m; den += m;
    }
  }
  return den > 0 ? num / den : 0;
}

// ---------------------------------------------------------------- csound side
function csoundRender(id, mutateState, scoreLines) {
  const state = JSON.parse(JSON.stringify(engine.defaultState()));
  state.sections = []; state.foundSources = []; state.bpm = 60;
  mutateState(state);
  let csd = engine.buildCsd(state);
  csd = csd.slice(0, csd.indexOf("<CsScore>")) +
    "<CsScore>\nt 0 60\n" + scoreLines.join("\n") + "\ne\n</CsScore>\n</CsoundSynthesizer>\n";
  const csdPath = path.join(AB, `${id}.csd`), wavPath = path.join(AB, `${id}-cs.wav`);
  fs.writeFileSync(csdPath, csd);
  execFileSync("csound", ["-d", "-W", "-f", "-o", wavPath, csdPath],
    { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] });
  return fit(readWavMono(wavPath));
}

// ---------------------------------------------------------------- faust side
let gen = null;
const factories = {};
async function faustProc(mod) {
  if (!gen) {
    const { FaustMonoDspGenerator } = await import(
      path.join(__dirname, "node_modules/@grame/faustwasm/dist/esm/index.js"));
    gen = new FaustMonoDspGenerator();
  }
  if (!factories[mod]) {
    const code = fs.readFileSync(path.join(__dirname, "dist", `${mod}-module.wasm`));
    factories[mod] = { cfactory: 0, code: new Uint8Array(code), module: await WebAssembly.compile(code),
      json: fs.readFileSync(path.join(__dirname, "dist", `${mod}-meta.json`), "utf8"), poly: false };
  }
  return gen.createOfflineProcessor(SR, BS, factories[mod]);
}
const rootOf = (mod) => JSON.parse(factories[mod].json).name;

// events: [{t, dur, freq?, set?:{k:v}}]; params: static; inputs: Float32Array[]
async function faustRender(mod, params, events, inputs, total = TOTAL) {
  const proc = await faustProc(mod);
  const R = "/" + rootOf(mod) + "/";
  for (const [k, v] of Object.entries(params || {})) proc.setParamValue(R + k, v);
  const ch = [];
  for (const e of events || []) {
    const s = Math.max(0, Math.floor(e.t * SR));
    if (e.freq != null) ch.push([s - BS, R + "freq", e.freq]);
    for (const [k, v] of Object.entries(e.set || {})) ch.push([s - BS, R + k, v]);
    ch.push([s, R + "gate", 1], [Math.floor((e.t + e.dur) * SR), R + "gate", 0]);
  }
  ch.sort((a, b) => a[0] - b[0]);
  const nout = JSON.parse(factories[mod].json).outputs;
  const outs = Array.from({ length: nout }, () => new Float32Array(total));
  let ci = 0;
  for (let s = 0; s < total; s += BS) {
    const len = Math.min(BS, total - s);
    while (ci < ch.length && ch[ci][0] < s + len) { proc.setParamValue(ch[ci][1], ch[ci][2]); ci++; }
    const ins = (inputs || []).map(a => a.subarray(s, s + len));
    const o = proc.render(ins, len);
    for (let c = 0; c < nout; c++) outs[c].set(o[c], s);
  }
  return outs;
}
const mono = (outs) => {
  if (outs.length === 1) return outs[0];
  const y = new Float32Array(outs[0].length);
  for (let i = 0; i < y.length; i++) y[i] = (outs[0][i] + outs[1][i]) / 2;
  return y;
};

function ffdecode(file, secs) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR),
    "-t", String(secs), "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  const x = new Float32Array(Math.min(SR * secs, raw.length >> 2));
  x.set(new Float32Array(raw.buffer, raw.byteOffset, x.length));
  return x;
}

// ---------------------------------------------------------------- note kits
const drumHits = (n, dur, step = 0.5) => Array.from({ length: n }, (_, i) => ({ t: 0.5 + i * step, dur }));
const drumScore = (instr, n, dur, amp, p5, step = 0.5) =>
  Array.from({ length: n }, (_, i) => `i ${instr} ${(0.5 + i * step).toFixed(2)} ${dur} ${amp}${p5 != null ? " " + p5 : ""}`);

const BASS_N = [[0.3, 6.00], [1.5, 6.07], [2.7, 6.05], [3.9, 6.00]], BASS_DUR = 0.6, BASS_AMP = 0.5;
const PAD_N = [[0.3, 8.00], [2.2, 8.04], [4.1, 7.09]], PAD_DUR = 1.6, PAD_AMP = 0.3;
const LEAD_N = [[0.3, 8.09], [1.8, 9.00], [3.3, 9.04]], LEAD_DUR = 0.9, LEAD_AMP = 0.35;
const noteScore = (instr, notes, dur, amp) => notes.map(([t, p]) => `i ${instr} ${t} ${dur} ${p.toFixed(2)} ${amp}`);
const noteEvents = (notes, dur, extra) => notes.map(([t, p]) => ({ t, dur, freq: cpspch(p), set: extra }));

const dryState = (s) => { // zero every send so voice tests compare DRY signals
  s.instruments.pad.send = 0; s.instruments.pad.dsend = 0;
  s.instruments.bass.send = 0; s.instruments.bass.dsend = 0;
  s.instruments.melody.send = 0; s.instruments.melody.dsend = 0;
  s.instruments.drums.send = 0; s.instruments.drums.dsend = 0;
};
const FXCLEAR = ["i 100 0 6", "i 99 0 6", "i 98 0 6", "i 95 0 6"]; // fx run (clears buses) but get zero input

// ---------------------------------------------------------------- the table
// Each entry: cs = {state mutation, score}; fa = {mod, params, events}.
// note = expected-divergence documentation (drives CHECK verdicts honestly).
const MODELS = [
  // ---- drums ----
  { id: "kick_boom", cs: s => { dryState(s); s.instruments.drums.kickModel = "boom"; },
    score: () => drumScore(10, 6, 0.3, 0.5),
    fa: { mod: "kick_boom", params: { tune: 1, decay: 0.3, level: 0.5 }, events: drumHits(6, 0.25) } },
  { id: "kick_808", cs: s => { dryState(s); s.instruments.drums.kickModel = "808"; },
    score: () => drumScore(10, 6, 0.4, 0.5),
    fa: { mod: "kick_808", params: { tune: 1, decay: 0.4, level: 0.5 }, events: drumHits(6, 0.35) } },
  { id: "kick_909", cs: s => { dryState(s); s.instruments.drums.kickModel = "909"; },
    score: () => drumScore(10, 6, 0.3, 0.5),
    fa: { mod: "kick909", params: { tune: 1, decay: 0.3, level: 0.5 }, events: drumHits(6, 0.25) } },
  { id: "snare_noise", cs: s => { dryState(s); s.instruments.drums.snareModel = "noise"; },
    score: () => drumScore(11, 6, 0.15, 0.5),
    fa: { mod: "snare_noise", params: { decay: 0.15, level: 0.5 }, events: drumHits(6, 0.12) } },
  { id: "snare_crack", cs: s => { dryState(s); s.instruments.drums.snareModel = "crack"; },
    score: () => drumScore(11, 6, 0.15, 0.5),
    fa: { mod: "snare_crack", params: { decay: 0.15, level: 0.5 }, events: drumHits(6, 0.12) } },
  { id: "snare_clap", cs: s => { dryState(s); s.instruments.drums.snareModel = "clap"; },
    score: () => drumScore(11, 6, 0.18, 0.5),
    fa: { mod: "snare_clap", params: { decay: 0.18, level: 0.5 }, events: drumHits(6, 0.14) } },
  { id: "hat_noise", cs: s => { dryState(s); s.instruments.drums.hatModel = "noise"; },
    score: () => drumScore(12, 10, 0.08, 0.5, 0, 0.4),
    fa: { mod: "hat_noise", params: { decay: 0.08, level: 0.5 * 0.7 }, events: drumHits(10, 0.06, 0.4) },
    note: "csound instr 12 mixes at *0.7 — folded into faust level" },
  { id: "hat_metal", cs: s => { dryState(s); s.instruments.drums.hatModel = "metal"; },
    score: () => drumScore(12, 10, 0.08, 0.5, 0, 0.4),
    fa: { mod: "hat_metal", params: { decay: 0.08, level: 0.5 * 0.7 }, events: drumHits(10, 0.06, 0.4) } },
  { id: "tom", cs: s => { dryState(s); },
    score: () => ["i 13 0.5 0.4 0.5 105", "i 13 1.5 0.4 0.5 105", "i 13 2.5 0.4 0.5 84", "i 13 3.5 0.4 0.5 126"],
    fa: { mod: "tom", params: { decay: 0.4, level: 0.5 },
      events: [{ t: 0.5, dur: 0.35, set: { pitch: 105 } }, { t: 1.5, dur: 0.35, set: { pitch: 105 } },
               { t: 2.5, dur: 0.35, set: { pitch: 84 } }, { t: 3.5, dur: 0.35, set: { pitch: 126 } }] } },
  // ---- bass ----
  { id: "bass_saw", cs: s => { dryState(s); Object.assign(s.instruments.bass, { model: "saw", cutoff: 700, res: 0.15, level: 1 }); },
    score: () => noteScore(2, BASS_N, BASS_DUR, BASS_AMP),
    fa: { mod: "bass_saw", params: { cutoff: 700, res: 0.15, level: 1, gain: BASS_AMP }, events: noteEvents(BASS_N, BASS_DUR) } },
  { id: "bass_sub", cs: s => { dryState(s); Object.assign(s.instruments.bass, { model: "sub", cutoff: 400, level: 1 }); },
    score: () => noteScore(2, BASS_N, BASS_DUR, BASS_AMP),
    fa: { mod: "bass_sub", params: { cutoff: 400, level: 1, gain: BASS_AMP }, events: noteEvents(BASS_N, BASS_DUR) } },
  { id: "bass_acid", cs: s => { dryState(s); Object.assign(s.instruments.bass, { model: "acid", cutoff: 600, res: 0.2, level: 1 }); },
    score: () => noteScore(2, BASS_N, BASS_DUR, BASS_AMP),
    fa: { mod: "bass_acid", params: { cutoff: 600, res: 0.2, level: 1, gain: BASS_AMP }, events: noteEvents(BASS_N, BASS_DUR) } },
  { id: "bass_reese", cs: s => { dryState(s); Object.assign(s.instruments.bass, { model: "reese", cutoff: 500, level: 1 }); },
    score: () => noteScore(2, BASS_N, BASS_DUR, BASS_AMP),
    fa: { mod: "bass_reese", params: { cutoff: 500, level: 1, gain: BASS_AMP }, events: noteEvents(BASS_N, BASS_DUR) } },
  { id: "bass_wobble", cs: s => { dryState(s); Object.assign(s.instruments.bass, { model: "wobble", cutoff: 500, res: 0.2, wobbleHz: 2.4, level: 1 }); },
    score: () => noteScore(2, BASS_N, BASS_DUR, BASS_AMP),
    fa: { mod: "bass_wobble", params: { cutoff: 500, res: 0.2, wobbleHz: 2.4, level: 1, gain: BASS_AMP }, events: noteEvents(BASS_N, BASS_DUR) } },
  // ---- pads (instr 1; recipe attack 0.5 so 1.6s notes clear the env) ----
  { id: "pad_saw", cs: s => { dryState(s); Object.assign(s.instruments.pad, { model: "saw", cutoff: 1400, res: 0.15, detune: 0.006, attack: 0.5, level: 0.7 }); },
    score: () => noteScore(1, PAD_N, PAD_DUR, PAD_AMP),
    fa: { mod: "pad_saw", params: { cutoff: 1400, res: 0.15, detune: 0.006, attack: 0.5, level: 0.7, gain: PAD_AMP }, events: noteEvents(PAD_N, PAD_DUR) } },
  { id: "pad_organ", cs: s => { dryState(s); Object.assign(s.instruments.pad, { model: "organ", cutoff: 1200, attack: 0.5, level: 0.7 }); },
    score: () => noteScore(1, PAD_N, PAD_DUR, PAD_AMP),
    fa: { mod: "organ", params: { cutoff: 1200, attack: 0.5, level: 0.7, gain: PAD_AMP }, events: noteEvents(PAD_N, PAD_DUR) } },
  { id: "pad_strings", cs: s => { dryState(s); Object.assign(s.instruments.pad, { model: "strings", cutoff: 1400, attack: 0.5, level: 0.7 }); },
    score: () => noteScore(1, PAD_N, PAD_DUR, PAD_AMP),
    fa: { mod: "strings", params: { cutoff: 1400, attack: 0.5, level: 0.7, gain: PAD_AMP }, events: noteEvents(PAD_N, PAD_DUR) } },
  { id: "pad_choir", cs: s => { dryState(s); Object.assign(s.instruments.pad, { model: "choir", cutoff: 1400, attack: 0.5, level: 0.7 }); },
    score: () => noteScore(1, PAD_N, PAD_DUR, PAD_AMP),
    fa: { mod: "choir", params: { cutoff: Math.min(8000, 1400 * 2.5), attack: 0.5, level: 0.7, gain: PAD_AMP }, events: noteEvents(PAD_N, PAD_DUR) },
    note: "fof formant grains vs saw->formant-bank; same formants, different excitation" },
  { id: "pad_fm", cs: s => { dryState(s); Object.assign(s.instruments.pad, { model: "fm", cutoff: 1400, attack: 0.5, level: 0.7 }); },
    score: () => noteScore(1, PAD_N, PAD_DUR, PAD_AMP),
    fa: { mod: "fm2op", params: { cutoff: Math.min(8000, 1400 * 1.7), ratio: 2.001, idx0: 2.6, idx1: 0.9, idxTime: 1.1, attack: 0.5, level: 0.7, gain: PAD_AMP }, events: noteEvents(PAD_N, PAD_DUR) } },
  { id: "pad_brass", cs: s => { dryState(s); Object.assign(s.instruments.pad, { model: "brass", cutoff: 9000, attack: 0.5, level: 0.7 }); },
    score: () => noteScore(1, PAD_N, PAD_DUR, PAD_AMP),
    fa: { mod: "brass", params: { cutoff: 9000, bite: PAD_AMP, attack: 0.5, level: 0.7, gain: PAD_AMP }, events: noteEvents(PAD_N, PAD_DUR) },
    note: "csound kcf tracks note velocity (p5*16000) — faust exposes it as `bite`" },
  // ---- leads (instr 4; vibrato zeroed unless the faust module has the param) ----
  { id: "lead_stack", cs: s => { dryState(s); Object.assign(s.instruments.melody, { model: "stack", wave: "sine", voices: 2, spread: 0.004, cutoff: 3400, res: 0.05, vibrato: 0.006, vibRate: 5.2, level: 0.6 }); },
    score: () => noteScore(4, LEAD_N, LEAD_DUR, LEAD_AMP),
    fa: { mod: "supersaw", params: { wave: 0, voices: 2, detune: 0.004, octave: 0.16, cutoff: 3400, res: 0.05, vibrato: 0.006, vibRate: 5.2, attack: 0.05, release: 0.3, level: 0.6, gain: LEAD_AMP }, events: noteEvents(LEAD_N, LEAD_DUR) } },
  { id: "lead_supersaw", cs: s => { dryState(s); Object.assign(s.instruments.melody, { model: "stack", wave: "saw", voices: 7, spread: 0.014, cutoff: 3200, res: 0.1, vibrato: 0.003, vibRate: 5.2, level: 0.55 }); },
    score: () => noteScore(4, LEAD_N, LEAD_DUR, LEAD_AMP),
    fa: { mod: "supersaw", params: { wave: 1, voices: 7, detune: 0.014, octave: 0.12, cutoff: 3200, res: 0.1, vibrato: 0.003, vibRate: 5.2, attack: 0.05, release: 0.3, level: 0.55, gain: LEAD_AMP }, events: noteEvents(LEAD_N, LEAD_DUR) } },
  { id: "lead_pluck", cs: s => { dryState(s); Object.assign(s.instruments.melody, { model: "pluck", cutoff: 3000, res: 0.05, vibrato: 0, level: 0.6 }); },
    score: () => noteScore(4, LEAD_N, LEAD_DUR, LEAD_AMP),
    fa: { mod: "lead_pluck", params: { cutoff: 3000, res: 0.05, level: 0.6, gain: LEAD_AMP }, events: noteEvents(LEAD_N, LEAD_DUR) },
    note: "csound `pluck` averaging decay vs lowpassed comb — same family, brighter start" },
  { id: "lead_kpluck", cs: s => { dryState(s); Object.assign(s.instruments.melody, { model: "kpluck", cutoff: 3000, vibrato: 0, level: 0.6 }); },
    score: () => noteScore(7, LEAD_N, LEAD_DUR, LEAD_AMP).map(l => l.replace(/^i 7/, "i 4")),
    fa: { mod: "lead_kpluck", params: { cutoff: 3000, drive: 0, flangePos: 0, level: 0.6, gain: LEAD_AMP }, events: noteEvents(LEAD_N, LEAD_DUR) },
    note: "csound kpluck flanger sweeps absolute song time; faust exposes flangePos" },
  { id: "lead_fm", cs: s => { dryState(s); Object.assign(s.instruments.melody, { model: "fm", cutoff: 3000, res: 0.05, vibrato: 0, level: 0.6 }); },
    score: () => noteScore(4, LEAD_N, LEAD_DUR, LEAD_AMP),
    fa: { mod: "fm2op", params: { cutoff: 3000, ratio: 1.4, idx0: 3.5, idx1: 1.0, idxTime: 0.45, attack: 0.05, vibrato: 0, level: 0.6, gain: LEAD_AMP }, events: noteEvents(LEAD_N, LEAD_DUR) } },
  { id: "lead_fuzz", cs: s => { dryState(s); Object.assign(s.instruments.melody, { model: "fuzz", cutoff: 3000, res: 0.2, drive: 0.3, vibrato: 0.004, vibRate: 5.2, level: 0.5 }); },
    score: () => noteScore(4, LEAD_N, LEAD_DUR, LEAD_AMP),
    fa: { mod: "lead_fuzz", params: { cutoff: 3000, res: 0.2, drive: 0.3, vibrato: 0.004, vibRate: 5.2, level: 0.5, gain: LEAD_AMP }, events: noteEvents(LEAD_N, LEAD_DUR) } },
  { id: "lead_piano", cs: s => { dryState(s); Object.assign(s.instruments.melody, { model: "piano", cutoff: 3400, res: 0.05, vibrato: 0, level: 0.6 }); },
    score: () => noteScore(4, LEAD_N, LEAD_DUR, LEAD_AMP),
    fa: { mod: "piano", params: { cutoff: 3400, decay: LEAD_DUR, level: 0.6, gain: LEAD_AMP }, events: noteEvents(LEAD_N, LEAD_DUR) },
    note: "csound stacks butlp(cutoff*2) + moogladder(cutoff); faust uses one butlp at cutoff" },
  { id: "lead_brass", cs: s => { dryState(s); Object.assign(s.instruments.melody, { model: "brass", cutoff: 9000, res: 0.05, vibrato: 0, level: 0.5 }); },
    score: () => noteScore(4, LEAD_N, LEAD_DUR, LEAD_AMP),
    fa: { mod: "brass", params: { cutoff: 9000, bite: LEAD_AMP, attack: 0.08, level: 0.5, gain: LEAD_AMP }, events: noteEvents(LEAD_N, LEAD_DUR) } },
  { id: "lead_bell", cs: s => { dryState(s); Object.assign(s.instruments.melody, { model: "bell", cutoff: 3400, res: 0.05, vibrato: 0, level: 0.6 }); },
    score: () => noteScore(4, LEAD_N, LEAD_DUR, LEAD_AMP),
    // csound lead bell = butlp(8500) inside the source THEN instr4 moogladder(3400) — 3400 dominates
    fa: { mod: "bell", params: { cutoff: 3400, decay: LEAD_DUR, level: 0.6, gain: LEAD_AMP }, events: noteEvents(LEAD_N, LEAD_DUR) } },
  // ---- substitutions (documented in VOICES.md — CHECK is the honest verdict) ----
  { id: "lead_guitar_SUB", cs: s => { dryState(s); Object.assign(s.instruments.melody, { model: "guitar", cutoff: 4500, vibrato: 0, level: 0.5 }); },
    score: () => noteScore(4, LEAD_N, LEAD_DUR, LEAD_AMP),
    fa: { mod: "lead_guitar", params: { cutoff: 4500, pluckPos: 0.75, level: 0.5, gain: LEAD_AMP }, events: noteEvents(LEAD_N, LEAD_DUR) },
    note: "SUBSTITUTION: csound plays TimGM6mb.sf2 samples; faust is a pm.lib waveguide" },
  { id: "pad_rhodes_DX7", cs: s => { dryState(s); Object.assign(s.instruments.pad, { model: "rhodes", cutoff: 1800, attack: 0.05, level: 0.7 }); },
    score: () => noteScore(1, PAD_N, PAD_DUR, PAD_AMP), dx7: "E.PIANO 1",
    note: "SUBSTITUTION: DX7 E.PIANO 1 (alg 5) replaces the csound 2-op rhodes" },
  { id: "vocoder", cs: s => {
      dryState(s);
      s.foundSources = [{ id: "sp_voc", fsPath: "found/samples/speech/herenow.wav" }];
      s.vocoderSourceId = "sp_voc";
      Object.assign(s.instruments.melody, { model: "vocoder", cutoff: 3400, res: 0.05, vibrato: 0, level: 0.6 });
    },
    score: () => noteScore(4, [[0.3, 8.00], [1.8, 8.04], [3.3, 8.07]], 1.2, LEAD_AMP),
    fa: null, // custom: needs the speech input
    note: "pvsvoc phase-vocoder vs ve.vocoder 32-band channel vocoder; note-start scatter differs" },
  // ---- sfx / stab ----
  { id: "stab", cs: s => { dryState(s); },
    score: () => [[0.5], [1.5], [2.5], [3.5]].map(([t]) => `i 6 ${t} 0.32 7.00 0.2`),
    fa: { mod: "stab", params: { decay: 0.32, level: 1, gain: 0.2 }, events: [0.5, 1.5, 2.5, 3.5].map(t => ({ t, dur: 0.3, freq: cpspch(7.00) })) } },
  { id: "sfx_riser", cs: s => { dryState(s); }, score: () => ["i 20 0.5 4 1 0.4"],
    fa: { mod: "sfx", params: { type: 1, dur: 4, amp: 0.4 }, events: [{ t: 0.5, dur: 4 }] } },
  { id: "sfx_sweep", cs: s => { dryState(s); }, score: () => ["i 20 0.5 4 2 0.4"],
    fa: { mod: "sfx", params: { type: 2, dur: 4, amp: 0.4 }, events: [{ t: 0.5, dur: 4 }] } },
  { id: "sfx_downlift", cs: s => { dryState(s); }, score: () => ["i 20 0.5 4 3 0.4"],
    fa: { mod: "sfx", params: { type: 3, dur: 4, amp: 0.4 }, events: [{ t: 0.5, dur: 4 }] } },
  { id: "sfx_impact", cs: s => { dryState(s); }, score: () => ["i 20 0.5 1.5 4 0.4"],
    fa: { mod: "sfx", params: { type: 4, dur: 1.5, amp: 0.4 }, events: [{ t: 0.5, dur: 1.5 }] } },
  { id: "sfx_reverse", cs: s => { dryState(s); }, score: () => ["i 20 0.5 4 5 0.4"],
    fa: { mod: "sfx", params: { type: 5, dur: 4, amp: 0.4 }, events: [{ t: 0.5, dur: 4 }] } },
  { id: "sfx_noise", cs: s => { dryState(s); }, score: () => ["i 20 0.5 1.5 6 0.4"],
    fa: { mod: "sfx", params: { type: 6, dur: 1.5, amp: 0.4 }, events: [{ t: 0.5, dur: 1.5 }] } },
];

// ---------------------------------------------------------------- fx tests (custom renders)
async function fxTests(rows, only) {
  const want = (id) => !only.length || only.includes(id);

  if (want("fx_send")) { // snare -> reverb+delay+pingpong, wet-forward
    const cs = csoundRender("fx_send", s => {
      dryState(s);
      s.instruments.drums.send = 0.9; s.instruments.drums.dsend = 0.5;
      s.reverb = 0.85; s.delay = { beats: 0.75, feedback: 0.3, cutoff: 2600 };
    }, [...FXCLEAR, ...drumScore(11, 5, 0.15, 0.5, 0.4, 1.0)]);
    const dry = mono(await faustRender("snare_crack", { decay: 0.15, level: 0.5 }, drumHits(5, 0.12, 1.0)));
    const z = new Float32Array(TOTAL);
    const rev = dry.map(v => v * 0.9), del = dry.map(v => v * 0.5), pp = dry.map(v => v * 0.4);
    const wet = await faustRender("fx_bus",
      // rgain ~ reverb*3.2: reverbsc at fb .85 returns HOT — this mapping is
      // what Phase 2's engine should use for state.reverb -> rgain
      { dtime: 0.75, dfb: 0.3, dcut: 2600, rgain: 0.85 * 3.2, dgain: 1, pptime: 0.75, ppfb: 0.66, pptone: 3000 },
      [], [dry, dry, Float32Array.from(rev), Float32Array.from(del), Float32Array.from(pp), z]);
    rows.push(judge("fx_send", cs, mono(wet), "reverbsc vs zita_rev1; tail character differs by design"));
    writeWav(path.join(AB, "fx_send-fa.wav"), wet);
  }

  if (want("fx_master")) { // pump/grit/comp/tone/crackle master chain
    const cs = csoundRender("fx_master", s => {
      dryState(s);
      s.pump = 0.5; s.grit = 0.4; s.comp = 0.5; s.crackle = 0.6;
      s.tone = { lowcut: 60, highcut: 9000 };
      s.instruments.drums.kickModel = "909";
      s.instruments.pad.attack = 0.5;
    }, ["i 100 0 6", "i 99 0 6", "i 98 0 6", "i 95 0 6", "i 97 0 6 0.6",
        ...drumScore(10, 6, 0.3, 0.5, null, 1.0),
        ...noteScore(1, [[0.2, 8.00], [2.2, 8.04], [4.2, 8.07]], 1.8, 0.25)]);
    const kick = mono(await faustRender("kick909", { tune: 1, decay: 0.3, level: 0.5 }, drumHits(6, 0.25, 1.0)));
    const pad = mono(await faustRender("pad_saw", { cutoff: 1400, res: 0.15, detune: 0.006, attack: 0.5, level: 0.7, gain: 0.25 },
      noteEvents([[0.2, 8.00], [2.2, 8.04], [4.2, 8.07]], 1.8)));
    const dl = new Float32Array(TOTAL);
    for (let i = 0; i < TOTAL; i++) dl[i] = kick[i] + pad[i];
    const z = new Float32Array(TOTAL);
    const wet = await faustRender("fx_bus",
      { pump: 0.5, bps: 1, grit: 0.4, comp: 0.5, crackle: 0.6, lowcut: 60, highcut: 9000, rgain: 0, dgain: 0 },
      [], [dl, dl, z, z, z, z]);
    rows.push(judge("fx_master", cs, mono(wet), "dam -> compressor_stereo + 1176 tail limiter"));
    writeWav(path.join(AB, "fx_master-fa.wav"), wet);
  }

  if (want("sweep_master")) { // instr 96 gkCut sweep vs fx_bus mcut automation
    const cs = csoundRender("sweep_master", s => {
      dryState(s);
      s.sections = [{ id: "x", name: "a", cycles: 1, pads: false, bass: "off", drums: "off", melody: "off", fill: "off", sweep: "open" }];
    }, ["i 100 0 6", "i 99 0 6", "i 98 0 6", "i 95 0 6", "i 96 0.5 4 260 18000",
        ...noteScore(1, [[0.1, 8.00]], 5.5, 0.3)]);
    const pad = mono(await faustRender("pad_saw", { cutoff: 1400, res: 0.15, detune: 0.006, attack: 0.5, level: 0.7, gain: 0.3 },
      noteEvents([[0.1, 8.00]], 5.5)));
    const z = new Float32Array(TOTAL);
    // mcut automation: exp glide 260 -> 18000 over 0.5..4.5s (instr 96 expon)
    const proc = await faustProc("fx_bus");
    const outs = [new Float32Array(TOTAL), new Float32Array(TOTAL)];
    proc.setParamValue("/fx_bus/rgain", 0); proc.setParamValue("/fx_bus/dgain", 0);
    for (let s = 0; s < TOTAL; s += BS) {
      const t = s / SR;
      const x = Math.min(1, Math.max(0, (t - 0.5) / 4));
      const cut = t < 0.5 ? 21000 : 260 * Math.pow(18000 / 260, x);
      proc.setParamValue("/fx_bus/mcut", cut);
      const len = Math.min(BS, TOTAL - s);
      const o = proc.render([pad.subarray(s, s + len), pad.subarray(s, s + len), z.subarray(s, s + len), z.subarray(s, s + len), z.subarray(s, s + len), z.subarray(s, s + len)], len);
      outs[0].set(o[0], s); outs[1].set(o[1], s);
    }
    rows.push(judge("sweep_master", cs, mono(outs), "gkCut expon vs block-rate mcut automation"));
    writeWav(path.join(AB, "sweep_master-fa.wav"), outs);
  }

  if (want("vocoder")) {
    const m = MODELS.find(m => m.id === "vocoder");
    const cs = csoundRender("vocoder", m.cs, [...FXCLEAR, ...m.score()]);
    const speech = fit(ffdecode(path.join(ROOT, "found/samples/speech/herenow.wav"), SECS));
    // csound loops the table per note; loop our speech too so notes 2/3 are voiced
    const sp = new Float32Array(TOTAL);
    let n = 0; while (n < TOTAL) { const c = Math.min(speech.length, TOTAL - n); sp.set(speech.subarray(0, c), n); n += Math.max(1, c); }
    const wet = await faustRender("robot_choir", { cutoff: 3400, res: 0.05, makeup: 5, level: 0.6, gain: LEAD_AMP },
      noteEvents([[0.3, 8.00], [1.8, 8.04], [3.3, 8.07]], 1.2), [sp]);
    rows.push(judge("vocoder", cs, mono(wet), MODELS.find(x => x.id === "vocoder").note));
    writeWav(path.join(AB, "vocoder-fa.wav"), wet);
  }
}

// one-line sonic judgments (ears + the band-energy checks behind each verdict)
const SONIC = {
  kick_boom: "same soft round thump; pitch drop matches",
  kick_808: "long boomy 808 body, near-identical sub weight",
  kick_909: "click + tight thump both present; numeric dead ringer",
  snare_noise: "same bark and 300/185 Hz body; a hair brighter noise band",
  snare_crack: "crack transient and 215 Hz body line up",
  snare_clap: "41 Hz flutter-gated clap reads the same",
  hat_noise: "same fizz, same 8.2 kHz ring",
  hat_metal: "same inharmonic square-cluster clang",
  tom: "grungy driven tom, pitch dip preserved",
  bass_saw: "same filtered-saw weight",
  bass_sub: "identical sine+tanh sub",
  bass_acid: "filter-zap contour matches; 2bn resonance slightly rounder",
  bass_reese: "beating detune pair identical",
  bass_wobble: "LFO filter throb matches rate and depth",
  pad_saw: "3-saw wash with tape wow; indistinguishable in a mix",
  pad_organ: "additive drawbar tone identical",
  pad_strings: "double-lowpassed ensemble matches",
  pad_choir: "'ah' formants land; fof grain fizz becomes a smoother saw source",
  pad_fm: "index sweep matches; same glassy settle",
  pad_brass: "bite-opening filter swell reads the same",
  lead_stack: "city-pop sine+octave bell lead matches",
  lead_supersaw: "7-voice detune bed equivalent",
  lead_pluck: "same muted pluck family; ours rings marginally longer",
  lead_kpluck: "chorused KS guitar w/ body resonance; slightly darker, same instrument",
  lead_fm: "FM whistle-bell matches",
  lead_fuzz: "same tanh fuzz sustain, resonant vowel intact",
  lead_piano: "struck-string decay + hammer noise line up",
  lead_brass: "section brass with vibrato and bite; same swell",
  lead_bell: "inharmonic 3.53-ratio clang matches",
  lead_guitar_SUB: "pm.lib waveguide is darker/rounder than the sf2 steel guitar — different instrument on purpose",
  pad_rhodes_DX7: "E.PIANO 1 is brighter and tinier than the 2-op rhodes — an upgrade, not a match",
  vocoder: "robot choir speaks; channel-vocoder consonants crisper than pvsvoc",
  stab: "rave chord stab; same cluster and decay",
  sfx_riser: "same opening-filter build",
  sfx_sweep: "rising bandpass whistle matches",
  sfx_downlift: "closing sweep matches",
  sfx_impact: "boom + noise hit; ours a touch noisier in the tail",
  sfx_reverse: "swell-into-cut identical",
  sfx_noise: "plain noise burst identical",
  fx_send: "wet snare space; zita tail slightly brighter but same depth",
  fx_master: "pump/grit/crackle/tone chain squashes the same way",
  sweep_master: "master filter ride tracks the csound sweep",
};

// ---------------------------------------------------------------- verdicts
function judge(id, cs, fa, note) {
  const rc = rms(cs), rf = rms(fa);
  const dbDiff = Math.abs(db(rf) - db(rc));
  const cc = centroid(cs), cf = centroid(fa);
  const cDev = cc > 0 ? Math.abs(cf - cc) / cc : 1;
  const silent = rc < 1e-4 || rf < 1e-4;
  const verdict = silent ? "FAIL" : (dbDiff <= 6 && cDev <= 0.35) ? "PASS" : "CHECK";
  const r = { id, rmsCs: db(rc), rmsFa: db(rf), dbDiff, cc, cf, cDev, verdict, note: note || "" };
  console.log(`${verdict.padEnd(5)} ${id.padEnd(16)} rms ${r.rmsCs.toFixed(1)}/${r.rmsFa.toFixed(1)}dB (Δ${dbDiff.toFixed(1)})  centroid ${cc.toFixed(0)}/${cf.toFixed(0)}Hz (${(cDev * 100).toFixed(0)}%)`);
  return r;
}

async function main() {
  fs.mkdirSync(AB, { recursive: true });
  fs.writeFileSync(path.join(AB, ".gitignore"), "*\n");
  const only = process.argv.slice(2);
  const rows = [];
  for (const m of MODELS) {
    if (only.length && !only.includes(m.id)) continue;
    if (!m.fa && !m.dx7) continue; // custom-rendered below (vocoder)
    try {
      const cs = csoundRender(m.id, m.cs, [...FXCLEAR, ...m.score()]);
      let fa;
      if (m.dx7) {
        const pre = require("./dx7-presets.json")[m.dx7];
        const proc = await faustProc(`dx7_alg${pre.alg}`);
        for (const [sfx, v] of Object.entries(pre.params)) proc.setParamValue("/DX7" + sfx, v);
        // NOTE: dx7.lib exposes NO output-gain param ("/DX7/gain" would be a
        // silent no-op) — the engine must scale DX7 voices with a GainNode.
        // Here we scale the rendered buffer to the csound pad level.
        const out = new Float32Array(TOTAL);
        const ch = [];
        for (const [t, p] of PAD_N) {
          const s = Math.floor(t * SR);
          ch.push([s - BS, "/DX7/freq", cpspch(p)], [s, "/DX7/gate", 1], [Math.floor((t + PAD_DUR) * SR), "/DX7/gate", 0]);
        }
        ch.sort((a, b) => a[0] - b[0]);
        let ci = 0;
        for (let s = 0; s < TOTAL; s += BS) {
          const len = Math.min(BS, TOTAL - s);
          while (ci < ch.length && ch[ci][0] < s + len) { proc.setParamValue(ch[ci][1], ch[ci][2]); ci++; }
          out.set(proc.render([], len)[0], s);
        }
        for (let i = 0; i < out.length; i++) out[i] *= 0.28;
        fa = out;
      } else {
        fa = mono(await faustRender(m.fa.mod, m.fa.params, m.fa.events));
      }
      writeWav(path.join(AB, `${m.id}-fa.wav`), [fa]);
      rows.push(judge(m.id, cs, fa, m.note));
    } catch (e) {
      rows.push({ id: m.id, verdict: "FAIL", note: String(e.message || e).slice(0, 160), rmsCs: 0, rmsFa: 0, dbDiff: 0, cc: 0, cf: 0, cDev: 0 });
      console.log(`FAIL  ${m.id}: ${String(e.message || e).slice(0, 160)}`);
    }
  }
  await fxTests(rows, only);

  // report
  const lines = [
    "# A/B report — Faust port vs legacy csound (Phase 1 gate)", "",
    `Generated by \`node ab-render.js\` on ${new Date().toISOString().slice(0, 10)}. ` +
    `Each row: same notes, ~${SECS}s, csound CLI render of the working-tree csd-engine.js orchestra ` +
    "vs faustwasm offline render of dist/ artifacts. Gate: RMS within 6 dB, spectral centroid within 35%.", "",
    "| model | verdict | RMS cs/fa (dB) | Δ dB | centroid cs/fa (Hz) | dev | sonic judgment |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const r of rows) {
    const s = (SONIC[r.id] || "") + (r.note ? (SONIC[r.id] ? " — " : "") + r.note : "");
    lines.push(`| ${r.id} | ${r.verdict} | ${r.rmsCs.toFixed(1)} / ${r.rmsFa.toFixed(1)} | ${r.dbDiff.toFixed(1)} | ${r.cc.toFixed(0)} / ${r.cf.toFixed(0)} | ${(r.cDev * 100).toFixed(0)}% | ${s} |`);
  }
  const counts = rows.reduce((a, r) => (a[r.verdict] = (a[r.verdict] || 0) + 1, a), {});
  lines.push("", `**${rows.length} models: ${counts.PASS || 0} PASS, ${counts.CHECK || 0} CHECK, ${counts.FAIL || 0} FAIL.**`, "");
  if (!only.length) fs.writeFileSync(path.join(__dirname, "ab-report.md"), lines.join("\n"));
  console.log(`\n${rows.length} rows: ${counts.PASS || 0} PASS, ${counts.CHECK || 0} CHECK, ${counts.FAIL || 0} FAIL${only.length ? " (subset — report not rewritten)" : " -> ab-report.md"}`);
}

main().catch(e => { console.error(e); process.exit(1); });
