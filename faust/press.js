#!/usr/bin/env node
// faust/press.js — full-length offline "pressing" of a kernel state.
//
//   node faust/press.js <state.json> <out.wav> [--dur seconds]
//
// Renders the ENTIRE song (state's section math -> totalBeats) through:
//   - the precompiled dist/ Faust voice modules via faustwasm OFFLINE
//     processors (same artifacts the browser runs; no libfaust),
//   - the native found-sound layer: node has no OfflineAudioContext, so
//     instr 3 (granular bed) and instr 5 (slice chopper) are mixed as decoded
//     PCM in plain JS (found-player.js mixPCM — documented approach),
//   - the fx_bus module for the whole master section (reverb/delay/pingpong/
//     pump/crackle/grit/comp/tone/mcut sweeps), fed [dryL,dryR,rev,del,pp,0].
//
// Found sources decode via ffmpeg (f32le mono 44100), resolved from the state's
// fsPath || samplePath || found/<id>.wav relative to the repo root.
// Verify output: ffmpeg volumedetect (printed at the end).
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const E = require(path.join(ROOT, "csd-engine.js"));
const SE = require(path.join(__dirname, "state-engine.js"));
const FP = require(path.join(__dirname, "found-player.js"));
const SP = require(path.join(__dirname, "sampler.js"));
const WAV = require(path.join(__dirname, "wav.js"));
// the per-unit pool/legato/insert render walk — extracted to render-core.js
// (ZERO-STATIC Stage 3 prerequisite, byte-parity gated) so the 16-bar stem
// cache's Worker can drive the identical loop; press injects mkProc/rootOf.
const RC = require(path.join(__dirname, "render-core.js"));

const SR = 44100, BS = 64;
const FOUND_CAP_SEC = 180; // bound decode memory; offsets are fractions of what we load

// ---------------------------------------------------------------- helpers
function ffdecode(file) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR),
    "-t", String(FOUND_CAP_SEC), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  const x = new Float32Array(raw.length >> 2);
  x.set(new Float32Array(raw.buffer, raw.byteOffset, x.length));
  return x;
}
function writeWav(file, L, R) {
  const n = L.length, data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(WAV.toInt16(L[i], "trunc"), i * 4);   // press TRUNCATES (`*32767|0`) — see faust/wav.js note
    data.writeInt16LE(WAV.toInt16(R[i], "trunc"), i * 4 + 2);
  }
  fs.writeFileSync(file, Buffer.concat([WAV.header(SR, 2, data.length), data]));
}

// state.dx7 contract: any algorithm 1..32 may be requested; only the ones a
// preset has needed so far are precompiled. Generate the (6-line) per-algorithm
// .dsp and build just that module, synchronously, the first time it's asked for.
function ensureDx7Module(mod) {
  const m = /^dx7_alg([0-9]+)$/.exec(mod);
  if (!m) return;
  const alg = +m[1];
  if (alg < 1 || alg > 32) throw new Error("dx7 algorithm out of range: " + alg);
  const dspPath = path.join(__dirname, "dsp", `${mod}.dsp`);
  if (!fs.existsSync(dspPath))
    fs.writeFileSync(dspPath, `// ${mod} — generated on demand for the state.dx7 contract (see dx7_alg5.dsp:
// per-algorithm builds because the runtime 32-algo switch OOMs libfaust-wasm).
declare name "${mod}";
import("stdfaust.lib");
process = dx.algorithm(${alg});
`);
  console.log(`  dx7: compiling ${mod} (first use)…`);
  execFileSync(process.execPath, [path.join(__dirname, "build.js"), mod], { stdio: "inherit" });
}

let _gen = null;
const _factories = {};
async function factory(mod) {
  if (!_factories[mod]) {
    if (!fs.existsSync(path.join(__dirname, "dist", `${mod}-module.wasm`))) ensureDx7Module(mod);
    const code = fs.readFileSync(path.join(__dirname, "dist", `${mod}-module.wasm`));
    _factories[mod] = { cfactory: 0, code: new Uint8Array(code), module: await WebAssembly.compile(code),
      json: fs.readFileSync(path.join(__dirname, "dist", `${mod}-meta.json`), "utf8"), poly: false };
  }
  return _factories[mod];
}
async function mkProc(mod) {
  if (!_gen) {
    const { FaustMonoDspGenerator } = await import(
      path.join(__dirname, "node_modules/@grame/faustwasm/dist/esm/index.js"));
    _gen = new FaustMonoDspGenerator();
  }
  return _gen.createOfflineProcessor(SR, BS, await factory(mod));
}
const rootOf = (mod) => JSON.parse(_factories[mod].json).name;

// dx7 cartridge presets (node fs). Shared by press + the segment-parity gate.
function loadDx7Presets() {
  return fs.existsSync(path.join(__dirname, "dx7-presets.json"))
    ? JSON.parse(fs.readFileSync(path.join(__dirname, "dx7-presets.json"), "utf8")) : {};
}

// ---------------------------------------------------------------- decode (node)
// The node-only input decode (ffmpeg -> f32le mono): found-source buffers +
// the vocoder speech input. Split out of press() so faust/segment-parity-test.js
// (and, later, the stream renderer's node adapter) can decode identically and
// inject the PCM into the environment-agnostic assembly core below.
async function decodeInputs(state, sched, opts) {
  const TOTAL = opts.TOTAL;
  // ---- found layer sources ----
  const usedSrc = new Set(sched.found.map(f => f.srcId));
  // sampler units' zone wavs ride foundSources at vol 0 — decode them too
  for (const u of Object.values(sched.units))
    if (u && u.sampler) for (const z of u.sampler.zones) usedSrc.add(z.srcId);
  const buffers = {};
  for (const s of state.foundSources || []) {
    if (!usedSrc.has(s.id)) continue;
    const p = s.fsPath || (s.samplePath ? path.join(ROOT, s.samplePath) : path.join(ROOT, "found", s.id + ".wav"));
    try { buffers[s.id] = ffdecode(p); }
    catch (e) { console.warn(`  found: cannot decode ${p} (${String(e.message).slice(0, 80)}) — skipping ${s.id}`); }
  }
  // ---- vocoder speech input (robot_choir has 1 audio input) ----
  let speech = null;
  const needVoc = Object.values(sched.units).some(u => u && u.vocoder);
  if (needVoc) {
    const vs = (state.foundSources || []).find(s => s.id === state.vocoderSourceId)
      || (state.foundSources || []).find(s => /^(sp_|vx_|vox_)/.test(s.id || ""));
    if (vs) {
      const p = vs.fsPath || (vs.samplePath ? path.join(ROOT, vs.samplePath) : path.join(ROOT, "found", vs.id + ".wav"));
      try {
        const raw = ffdecode(p);
        speech = new Float32Array(TOTAL);
        for (let i = 0; i < TOTAL; i++) speech[i] = raw[i % raw.length];
      } catch (e) { console.warn("  vocoder: speech decode failed — robot_choir will hum:", String(e.message).slice(0, 80)); }
    } else console.warn("  vocoder: no speech-ish source in state — robot_choir will hum");
  }
  return { buffers, speech };
}

// ---------------------------------------------------------------- assembly core
// The whole-song full-mix assembly, extracted verbatim from press() (byte-order
// preserved — the determinism gate is byte-level). Environment-agnostic: mkProc/
// rootOf/buffers/speech/dx7Presets arrive via `env`, so faust/segment-parity-test.js
// can drive it as the PRESS REFERENCE that faust/stream-renderer.js is gated against.
// Returns the float master L/R (pre-int16-quantization) so parity can be measured
// below the wav's 1/32768 floor.
async function assemble(state, sched, env, opts) {
  const { mkProc, rootOf, buffers, speech, dx7Presets } = env;
  const spb = opts.spb, totalSec = opts.totalSec, TOTAL = opts.TOTAL;

  // accumulator buses (mono dry -> fx_bus L/R; rev/del/pp sends stay mono).
  // STEREO voices (juno60/hammond/vp330, outputs===2) add their channel 0/1 to
  // the separate wide buses wL/wR, so the dry path carries their width into the
  // fx_bus L/R inputs while every mono voice stays centered (dry, duplicated).
  const dry = new Float32Array(TOTAL), rev = new Float32Array(TOTAL),
        del = new Float32Array(TOTAL), pp = new Float32Array(TOTAL);
  const anyStereo = Object.values(sched.units).some(u => u && u.stereo);
  const wL = anyStereo ? new Float32Array(TOTAL) : null;
  const wR = anyStereo ? new Float32Array(TOTAL) : null;

  // ---- found layer: pure-JS granular/chopper mix (buffers decoded by caller) ----
  const foundSec = sched.found
    .map(f => ({ ...f, tSec: f.beat * spb, durSec: f.durB * spb }))
    .filter(f => f.tSec < totalSec && buffers[f.srcId]);
  FP.mixPCM(foundSec, buffers, SR, { dry, rev, del, pp });
  console.log(`  found: ${foundSec.length} events from ${Object.keys(buffers).length} sources mixed (JS PCM)`);

  // ---- group events per unit, allocate to pools, render ----
  const byUnit = {};
  for (const e of sched.events) {
    if (e.beat * spb >= totalSec) continue;
    (byUnit[e.unit] = byUnit[e.unit] || []).push(e);
  }

  for (const [key, events] of Object.entries(byUnit)) {
    const u = sched.units[key];
    events.sort((a, b) => a.beat - b.beat);
    // SAMPLER units: no Faust module — pitched zone playback mixed as PCM
    // (faust/sampler.js mixPCM), same native path found sound uses.
    if (u.sampler) {
      const notes = events.map(e => ({
        tSec: e.beat * spb, durSec: e.durB * spb, freq: e.sets.freq,
        gain: (u.lvl || 0.5) * (e.sets.gain != null ? e.sets.gain : 0.13),
        atk: u.sampler.atk, rel: u.sampler.rel, zones: u.sampler.zones,
        swell: !!u.sampler.swell,
        mello: u.sampler.mello || null,   // MELLOTRON: LFO phase off note tSec (deterministic)
        bendFrom: e.bend ? e.bend.from : 0, bendMs: e.bend ? e.bend.ms : 0,
      })).filter(n => n.tSec < totalSec);
      SP.mixPCM(notes, buffers, SR, { dry, rev, del },
        { dry: u.dry != null ? u.dry : 1, rev: u.rev || 0, del: u.del || 0 });
      console.log(`  ${key}: ${notes.length} ev -> sampler:${u.sampler.id} (native PCM, ${u.sampler.zones.length} zones)`);
      continue;
    }
    // FAUST units: the whole pool/legato/insert walk lives in render-core.js
    // (shared verbatim with the future stem-cache Worker — parity is byte-level,
    // see its header). press's environment enters via mkProc/rootOf injection.
    const r = await RC.renderUnit(u, events, {
      mkProc, rootOf, SR, BS, TOTAL, spb,
      buses: { dry, rev, del, pp, wL, wR },
      speech, dx7Presets,
    });
    console.log(`  ${key}: ${events.length} ev -> ${u.module} x${r.pool}, ${(r.rendered / SR).toFixed(1)}s voiced` +
      (u.inserts && u.inserts.length ? ` [inserts: ${u.inserts.map(i => i.type).join(">")}]` : ""));
  }

  // ---- reverb COLOR: an external reverb module (dist/reverb_*) replaces the
  // fx_bus internal zita for genres that select one (state.reverbColor). Render
  // the whole (mono) rev-send bus through it and fold the stereo wet into the
  // dry path below so it flows through the master chain; fxParams has already
  // muted the internal rgain to 0. Deterministic (module LFO phases start at 0)
  // so same seed => same bytes; genres with no reverbColor skip this entirely.
  const rc = SE.reverbColor(state);
  let wetL = null, wetR = null;
  if (rc) {
    // DELAY/PP BLEED tap-out (reverb-color round): fx_bus feeds its INTERNAL
    // zita `rin = rev + d*0.2 + (ppl+ppr)*0.12`, but that zita is muted for
    // colored genres — so without this the color node would only get the RAW
    // rev send and lose the echo-tail-into-reverb glue uncolored genres keep.
    // rev_bleed recomputes EXACTLY that bleed term (same delay/pingpong DSP +
    // coefficients as fx_bus, same fxParams) from the del/pp send buses; we add
    // it to the color node's input. fx_bus itself is untouched (uncolored
    // byte-identical); `rev` passed to fx_bus below stays the raw send.
    const bleed = new Float32Array(TOTAL);
    const bp = await mkProc("rev_bleed");
    const bfx = SE.fxParams(state);
    for (const k of ["dtime", "dfb", "dcut", "dgain", "pptime", "ppfb", "pptone"])
      bp.setParamValue("/rev_bleed/" + k, bfx[k]);
    for (let s = 0; s < TOTAL; s += BS) {
      const len = Math.min(BS, TOTAL - s);
      const o = bp.render([del.subarray(s, s + len), pp.subarray(s, s + len)], len);
      bleed.set(o[0].subarray(0, len), s);
    }
    const revColorIn = new Float32Array(TOTAL);
    for (let i = 0; i < TOTAL; i++) revColorIn[i] = rev[i] + bleed[i];

    const rp = await mkProc(rc.module);
    const RR = "/" + rootOf(rc.module) + "/";
    rp.setParamValue(RR + "rgain", rc.rgain);
    rp.setParamValue(RR + "rtone", rc.rtone);
    wetL = new Float32Array(TOTAL); wetR = new Float32Array(TOTAL);
    for (let s = 0; s < TOTAL; s += BS) {
      const len = Math.min(BS, TOTAL - s);
      const o = rp.render([revColorIn.subarray(s, s + len), revColorIn.subarray(s, s + len)], len);
      wetL.set(o[0].subarray(0, len), s); wetR.set((o[1] || o[0]).subarray(0, len), s);
    }
    let be = 0; for (let i = 0; i < TOTAL; i++) be += bleed[i] * bleed[i];
    console.log(`  reverb color: ${rc.name} -> ${rc.module}, rgain=${rc.rgain.toFixed(2)} rtone=${rc.rtone}` +
      `; bleed RMS ${(20 * Math.log10(Math.max(Math.sqrt(be / TOTAL), 1e-9))).toFixed(1)} dB into color`);
  }

  // ---- fx_bus master section over the whole length ----
  const fx = await mkProc("fx_bus");
  const fxp = SE.fxParams(state);
  for (const [k, v] of Object.entries(fxp)) fx.setParamValue("/fx_bus/" + k, v);
  // mcut sweep automation (instr 96 expon): piecewise per block
  const sweeps = sched.sweeps.map(sw => ({ t0: sw.beat * spb, t1: (sw.beat + sw.durB) * spb, from: sw.from, to: sw.to }))
    .sort((a, b) => a.t0 - b.t0);
  const L = new Float32Array(TOTAL), Rr = new Float32Array(TOTAL);
  const zero = new Float32Array(BS);
  // fx_bus dry L/R inputs: mono dry duplicated, plus the stereo voices' width
  // AND the reverb-color wet (folded into dry so it rides the master chain).
  const dryL = (wL || wetL) ? (() => { const b = new Float32Array(TOTAL); for (let i = 0; i < TOTAL; i++) b[i] = dry[i] + (wL ? wL[i] : 0) + (wetL ? wetL[i] : 0); return b; })() : dry;
  const dryRch = (wR || wetR) ? (() => { const b = new Float32Array(TOTAL); for (let i = 0; i < TOTAL; i++) b[i] = dry[i] + (wR ? wR[i] : 0) + (wetR ? wetR[i] : 0); return b; })() : dry;
  let mcut = 21000, swi = 0; const activeSw = [];
  for (let s = 0; s < TOTAL; s += BS) {
    const len = Math.min(BS, TOTAL - s), t = s / SR;
    if (sweeps.length) {
      while (swi < sweeps.length && sweeps[swi].t0 <= t) activeSw.push(sweeps[swi++]);
      for (let i = activeSw.length - 1; i >= 0; i--) {
        const sw = activeSw[i];
        if (t >= sw.t1) { mcut = sw.to; activeSw.splice(i, 1); continue; }
        const x = (t - sw.t0) / Math.max(1e-6, sw.t1 - sw.t0);
        mcut = sw.from * Math.pow(sw.to / sw.from, x);
      }
      fx.setParamValue("/fx_bus/mcut", Math.min(21000, Math.max(180, mcut)));
    }
    const o = fx.render([dryL.subarray(s, s + len), dryRch.subarray(s, s + len),
      rev.subarray(s, s + len), del.subarray(s, s + len), pp.subarray(s, s + len), zero.subarray(0, len)], len);
    L.set(o[0], s); Rr.set(o[1], s);
  }

  // ---- MULTIBAND MASTER COMP (fx wings stage 4): opt-in post-pass over the
  // fx_bus output (state.masterComp > 0, e.g. disco). Genres without it never
  // build the module — the fx_bus output above IS the master (byte-identical,
  // committed fx_bus bytes). See state-engine masterMb for why it is NOT baked
  // into fx_bus (always-on cost measured against the live load gate).
  const mb = SE.masterMb(state);
  if (mb) {
    const mp = await mkProc(mb.module);
    mp.setParamValue("/" + rootOf(mb.module) + "/mbdrive", mb.mbdrive);
    for (let s = 0; s < TOTAL; s += BS) {
      const len = Math.min(BS, TOTAL - s);
      const o = mp.render([L.subarray(s, s + len), Rr.subarray(s, s + len)], len);
      L.set(o[0].subarray(0, len), s); Rr.set(o[1].subarray(0, len), s);
    }
    console.log(`  master mb: ${mb.module}, mbdrive=${mb.mbdrive.toFixed(2)}`);
  }

  return { L, Rr, TOTAL };
}

// ---------------------------------------------------------------- main
async function press(state, outPath, opts) {
  opts = opts || {};
  const t0 = Date.now();
  const sched = SE.buildSchedule(E, state);
  const spb = sched.spb;
  let totalSec = sched.totalBeats * spb;
  if (opts.dur) totalSec = Math.min(totalSec, opts.dur);
  const TOTAL = Math.ceil(totalSec * SR);
  console.log(`press: ${sched.totalBeats} beats @ ${state.bpm} bpm = ${(sched.totalBeats * spb).toFixed(1)}s` +
    (opts.dur ? ` (capped ${totalSec.toFixed(1)}s)` : "") +
    `; ${sched.events.length} synth events, ${sched.found.length} found events`);
  // CPU-budget guard (state-engine trimToBudget): report the cost + any shed list.
  const bud = sched.units && sched.units.__budget;
  if (bud) console.log(`  cpu-budget: cost ${bud.cost} / ${bud.budget}` +
    (bud.shed.length ? ` — SHED [${bud.shed.join(", ")}] (${bud.note})` : ` — ${bud.note}`));

  const { buffers, speech } = await decodeInputs(state, sched, { TOTAL });
  const dx7Presets = loadDx7Presets();
  const { L, Rr } = await assemble(state, sched,
    { mkProc, rootOf, buffers, speech, dx7Presets }, { spb, totalSec, TOTAL });

  writeWav(outPath, L, Rr);
  let sq = 0; for (let i = 0; i < TOTAL; i++) sq += L[i] * L[i];
  const rmsDb = 20 * Math.log10(Math.max(Math.sqrt(sq / TOTAL), 1e-9));
  console.log(`wrote ${outPath}: ${(TOTAL / SR).toFixed(1)}s, L-RMS ${rmsDb.toFixed(1)} dB, ${(Date.now() - t0) / 1000 | 0}s to render`);
  let vd = "";
  try { execFileSync("ffmpeg", ["-i", outPath, "-af", "volumedetect", "-f", "null", "-"],
    { stdio: ["ignore", "ignore", "pipe"] }); } catch (e) { vd = String(e.stderr || ""); }
  if (!vd) { try { vd = execFileSync("sh", ["-c", `ffmpeg -i ${JSON.stringify(outPath)} -af volumedetect -f null - 2>&1`]).toString(); } catch (e) { vd = String(e.stdout || ""); } }
  const m = vd.match(/mean_volume: ([-\d.]+) dB[\s\S]*?max_volume: ([-\d.]+) dB/);
  const meanDb = m ? parseFloat(m[1]) : null;
  if (m) console.log(`volumedetect: mean ${m[1]} dB, max ${m[2]} dB`);
  return { seconds: TOTAL / SR, rmsDb, meanDb, expectedSeconds: sched.totalBeats * spb };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const durIx = args.indexOf("--dur");
  const dur = durIx >= 0 ? parseFloat(args.splice(durIx, 2)[1]) : 0;
  if (args.length < 2) { console.error("usage: node faust/press.js <state.json> <out.wav> [--dur seconds]"); process.exit(1); }
  const state = JSON.parse(fs.readFileSync(args[0], "utf8"));
  press(state, args[1], { dur }).catch(e => { console.error(e); process.exit(1); });
}
module.exports = { press, assemble, decodeInputs, loadDx7Presets, mkProc, rootOf, SR, BS };
