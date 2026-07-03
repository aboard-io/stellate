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
    data.writeInt16LE(Math.max(-1, Math.min(1, L[i])) * 32767 | 0, i * 4);
    data.writeInt16LE(Math.max(-1, Math.min(1, R[i])) * 32767 | 0, i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
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

// merge [start,end] intervals
function mergeIvals(ivals) {
  ivals.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const iv of ivals) {
    if (out.length && iv[0] <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], iv[1]);
    else out.push(iv.slice());
  }
  return out;
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

  // accumulator buses (mono dry; fx_bus gets it on both L/R inputs)
  const dry = new Float32Array(TOTAL), rev = new Float32Array(TOTAL),
        del = new Float32Array(TOTAL), pp = new Float32Array(TOTAL);

  // ---- found layer: decode + pure-JS granular/chopper mix ----
  const usedSrc = new Set(sched.found.map(f => f.srcId));
  // sampler units' zone wavs ride foundSources at vol 0 — decode them too
  for (const u of Object.values(sched.units))
    if (u.sampler) for (const z of u.sampler.zones) usedSrc.add(z.srcId);
  const buffers = {};
  for (const s of state.foundSources || []) {
    if (!usedSrc.has(s.id)) continue;
    const p = s.fsPath || (s.samplePath ? path.join(ROOT, s.samplePath) : path.join(ROOT, "found", s.id + ".wav"));
    try { buffers[s.id] = ffdecode(p); }
    catch (e) { console.warn(`  found: cannot decode ${p} (${String(e.message).slice(0, 80)}) — skipping ${s.id}`); }
  }
  const foundSec = sched.found
    .map(f => ({ ...f, tSec: f.beat * spb, durSec: f.durB * spb }))
    .filter(f => f.tSec < totalSec && buffers[f.srcId]);
  FP.mixPCM(foundSec, buffers, SR, { dry, rev, del, pp });
  console.log(`  found: ${foundSec.length} events from ${Object.keys(buffers).length} sources mixed (JS PCM)`);

  // ---- vocoder speech input (robot_choir has 1 audio input) ----
  let speech = null;
  const needVoc = Object.values(sched.units).some(u => u.vocoder);
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

  // ---- group events per unit, allocate to pools, render ----
  const byUnit = {};
  for (const e of sched.events) {
    if (e.beat * spb >= totalSec) continue;
    (byUnit[e.unit] = byUnit[e.unit] || []).push(e);
  }
  const dx7Presets = fs.existsSync(path.join(__dirname, "dx7-presets.json"))
    ? JSON.parse(fs.readFileSync(path.join(__dirname, "dx7-presets.json"), "utf8")) : {};

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
        bendFrom: e.bend ? e.bend.from : 0, bendMs: e.bend ? e.bend.ms : 0,
      })).filter(n => n.tSec < totalSec);
      SP.mixPCM(notes, buffers, SR, { dry, rev, del },
        { dry: u.dry != null ? u.dry : 1, rev: u.rev || 0, del: u.del || 0 });
      console.log(`  ${key}: ${notes.length} ev -> sampler:${u.sampler.id} (native PCM, ${u.sampler.zones.length} zones)`);
      continue;
    }
    const P = u.pool || 1;
    const procs = [];
    for (let i = 0; i < P; i++) {
      const proc = await mkProc(u.module);
      const R = "/" + rootOf(u.module) + "/";
      for (const [k, v] of Object.entries(u.params || {})) proc.setParamValue(R + k, v);
      const dxParams = u.dx7Params || (u.dx7Preset && dx7Presets[u.dx7Preset] && dx7Presets[u.dx7Preset].params);
      if (dxParams)
        for (const [sfx, v] of Object.entries(dxParams)) proc.setParamValue(sfx.startsWith("/DX7") ? sfx : "/DX7" + sfx, v);
      procs.push({ proc, R, changes: [], ivals: [], busyUntil: -1 });
    }
    // per-voice INSERT chain (state.instruments.<voice>.inserts contract):
    // voices accumulate into a unit-local buffer, the chain processes it
    // whole-song (LFO phase + tails continuous), THEN the layer/fx sends
    // apply — same insert point as live's node->chain->sends. Units without
    // inserts keep the original direct-mix path untouched (bit-identical).
    const hasIns = u.inserts && u.inserts.length;
    const ubuf = hasIns ? new Float32Array(TOTAL) : null;

    // supersaw release tail must survive the gate-off
    let tail = u.tail || 1;
    if (u.module === "supersaw") tail = Math.max(tail, (u.params.release || 0.3) + 0.3);
    const relTail = Math.ceil(tail * SR);

    // allocation: first free voice, else the one free soonest (round-robin-ish)
    for (const e of events) {
      const s = Math.max(BS, Math.floor(e.beat * spb * SR));
      const durS = e.durB * spb;
      const offS = e.hold ? s + Math.floor(durS * SR)
        : e.drum ? s + Math.floor(0.012 * SR)
        : s + Math.floor((Math.max(0.012, durS) - 0.008) * SR);
      let v = procs.find(p => p.busyUntil <= s) ||
              procs.reduce((a, b) => (a.busyUntil <= b.busyUntil ? a : b));
      for (const [k, val] of Object.entries(e.sets)) v.changes.push([s - BS, v.R + k, val]);
      // JS-side per-note gains ("@" pseudo-params, applied in the mix loop, not
      // setParamValue): @out = DX7 velocity (GainNode-equivalent, matches live's
      // min(1, extGainPerAmp*amp)); @pp = per-EVENT ping-pong send (snarePP).
      if (u.extGainPerAmp) v.changes.push([s - BS, "@out", Math.min(1, u.extGainPerAmp * (e.amp || 0.1))]);
      v.changes.push([s - BS, "@pp", e.pp || 0]);
      v.changes.push([s, v.R + "gate", 1], [offS, v.R + "gate", 0]);
      v.ivals.push([s - BS, Math.min(TOTAL, offS + relTail)]);
      v.busyUntil = offS;
    }

    // render each pool voice over its merged active segments only
    let rendered = 0;
    for (const v of procs) {
      if (!v.changes.length) continue;
      v.changes.sort((a, b) => a[0] - b[0]);
      const segs = mergeIvals(v.ivals);
      let ci = 0, curOut = 1, curPP = 0;
      const applyChange = (c) => {
        if (c[1] === "@out") curOut = c[2];
        else if (c[1] === "@pp") curPP = c[2];
        else v.proc.setParamValue(c[1], c[2]);
      };
      for (const [a, b] of segs) {
        const from = Math.max(0, Math.floor(a / BS) * BS), to = Math.min(TOTAL, b);
        // apply any changes that fell before this segment (kept in order)
        while (ci < v.changes.length && v.changes[ci][0] < from) { applyChange(v.changes[ci]); ci++; }
        for (let s = from; s < to; s += BS) {
          const len = Math.min(BS, TOTAL - s);
          while (ci < v.changes.length && v.changes[ci][0] < s + len) { applyChange(v.changes[ci]); ci++; }
          const ins = u.vocoder && speech ? [speech.subarray(s, s + len)] : (u.vocoder ? [new Float32Array(len)] : []);
          const o = v.proc.render(ins, len)[0];
          if (ubuf) {
            // pre-insert: only per-note out gain applies (matches live, where
            // the voice's out GainNode feeds the chain); sends come after.
            for (let i = 0; i < len; i++) ubuf[s + i] += o[i] * curOut;
          } else {
            const dg = (u.dry != null ? u.dry : 1) * curOut, rg = (u.rev || 0) * curOut,
                  lg = (u.del || 0) * curOut, pg = curPP * curOut;
            for (let i = 0; i < len; i++) {
              const x = o[i];
              dry[s + i] += x * dg; rev[s + i] += x * rg; del[s + i] += x * lg;
              if (pg) pp[s + i] += x * pg;
            }
          }
          rendered += len;
        }
      }
    }
    if (ubuf) {
      for (const eff of u.inserts) {
        const ip = await mkProc(eff.module);
        const IR = "/" + rootOf(eff.module) + "/";
        for (const [k, pv] of Object.entries(eff.params)) ip.setParamValue(IR + k, pv);
        if (eff.barSec) ip.setParamValue(IR + "barSec", 4 * spb); // tempo-synced LFO
        for (let s = 0; s < TOTAL; s += BS) {
          const len = Math.min(BS, TOTAL - s);
          const o = ip.render([ubuf.subarray(s, s + len)], len)[0];
          for (let i = 0; i < len; i++) ubuf[s + i] = o[i];
        }
      }
      const dg = u.dry != null ? u.dry : 1, rg = u.rev || 0, lg = u.del || 0;
      for (let i = 0; i < TOTAL; i++) {
        const x = ubuf[i];
        dry[i] += x * dg; rev[i] += x * rg; del[i] += x * lg;
      }
    }
    console.log(`  ${key}: ${events.length} ev -> ${u.module} x${P}, ${(rendered / SR).toFixed(1)}s voiced` +
      (hasIns ? ` [inserts: ${u.inserts.map(i => i.type).join(">")}]` : ""));
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
    const o = fx.render([dry.subarray(s, s + len), dry.subarray(s, s + len),
      rev.subarray(s, s + len), del.subarray(s, s + len), pp.subarray(s, s + len), zero.subarray(0, len)], len);
    L.set(o[0], s); Rr.set(o[1], s);
  }

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
module.exports = { press, SR };
