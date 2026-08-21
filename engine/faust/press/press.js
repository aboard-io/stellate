#!/usr/bin/env node
// faust/press/press.js — full-length offline "pressing" of a kernel state.
//
//   node faust/press/press.js <state.json> <out.wav> [--dur seconds]
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
// fsPath || samplePath || found/<id>.64.mp3 (then .mp3, .wav) relative to the repo root.
// Verify output: ffmpeg volumedetect (printed at the end).
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync, execFile, spawnSync } = require("child_process");

const FAUST = path.join(__dirname, "..");           // engine/faust/ — dsp/, dist/, voices/, codec/, data/
const ROOT = path.join(__dirname, "..", "..");      // engine/ — kernel modules live here
const SITE = path.join(__dirname, "..", "..", ".."); // repo root — found/ + samplePath assets live here
const E = require(path.join(ROOT, "csd-engine.js"));
const SE = require(path.join(FAUST, "voices", "state-engine.js"));
const FP = require(path.join(FAUST, "voices", "found-player.js"));
const SP = require(path.join(FAUST, "voices", "sampler.js"));
const WAV = require(path.join(FAUST, "codec", "wav.js"));
// the per-unit pool/legato/insert render walk — extracted to render-core.js
// (ZERO-STATIC Stage 3 prerequisite, byte-parity gated) so the 16-bar stem
// cache's Worker can drive the identical loop; press injects mkProc/rootOf.
const RC = require(path.join(__dirname, "render-core.js"));

const SR = 44100, BS = 64;
const SPAN = RC.SPAN_MAX;   // batched change-free render span (see render-core.js)
const FOUND_CAP_SEC = 180; // bound decode memory; offsets are fractions of what we load

// ---------------------------------------------------------------- helpers
function ffdecode(file) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR),
    "-t", String(FOUND_CAP_SEC), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  const x = new Float32Array(raw.length >> 2);
  x.set(new Float32Array(raw.buffer, raw.byteOffset, x.length));
  return x;
}
// Async twin for the decode POOL (ENGINE-AUDIT Tier 1/3): identical
// ffmpeg invocation, so the PCM per file is byte-identical to ffdecode's —
// only the spawn scheduling changes (process startup ~130ms dominates small
// zone wavs; measured ~3x on a 25-source state decoded 8-wide).
function ffdecodeAsync(file) {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR),
      "-t", String(FOUND_CAP_SEC), "-f", "f32le", "-"],
      { maxBuffer: 1 << 30, encoding: "buffer" }, (err, stdout) => {
        if (err) return reject(err);
        const x = new Float32Array(stdout.length >> 2);
        x.set(new Float32Array(stdout.buffer, stdout.byteOffset, x.length));
        resolve(x);
      });
  });
}
const DECODE_POOL = 8;
function writeWav(file, L, R) {
  // ENGINE-AUDIT Tier 3: one upfront allocation + Int16Array stores
  // replace 2 bounds-checked writeInt16LE calls per frame plus a full
  // Buffer.concat re-copy (~0.3-0.9s per press). Same WAV.toInt16(x,"trunc")
  // quantizer — press TRUNCATES (`*32767|0`), see faust/wav.js note — and
  // typed-array stores are little-endian on every supported platform, so the
  // written bytes are identical. (Buffer.alloc is never pooled: byteOffset 0,
  // and the 44-byte header keeps the sample view 2-byte aligned.)
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  WAV.header(SR, 2, n * 4).copy(buf, 0);
  const v = new Int16Array(buf.buffer, buf.byteOffset + 44, n * 2);
  for (let i = 0; i < n; i++) {
    v[2 * i] = WAV.toInt16(L[i], "trunc");
    v[2 * i + 1] = WAV.toInt16(R[i], "trunc");
  }
  fs.writeFileSync(file, buf);
}

// state.dx7 contract: any algorithm 1..32 may be requested; only the ones a
// preset has needed so far are precompiled. Generate the (6-line) per-algorithm
// .dsp and build just that module, synchronously, the first time it's asked for.
function ensureDx7Module(mod) {
  const m = /^dx7_alg([0-9]+)$/.exec(mod);
  if (!m) return;
  const alg = +m[1];
  if (alg < 1 || alg > 32) throw new Error("dx7 algorithm out of range: " + alg);
  const dspPath = path.join(FAUST, "dsp", `${mod}.dsp`);
  if (!fs.existsSync(dspPath))
    fs.writeFileSync(dspPath, `// ${mod} — generated on demand for the state.dx7 contract (see dx7_alg5.dsp:
// per-algorithm builds because the runtime 32-algo switch OOMs libfaust-wasm).
declare name "${mod}";
import("stdfaust.lib");
process = dx.algorithm(${alg});
`);
  console.log(`  dx7: compiling ${mod} (first use)…`);
  execFileSync(process.execPath, [path.join(FAUST, "build", "build.js"), mod], { stdio: "inherit" });
}

let _gen = null;
const _factories = {};
async function factory(mod) {
  if (!_factories[mod]) {
    if (!fs.existsSync(path.join(FAUST, "dist", `${mod}-module.wasm`))) ensureDx7Module(mod);
    const code = fs.readFileSync(path.join(FAUST, "dist", `${mod}-module.wasm`));
    _factories[mod] = { cfactory: 0, code: new Uint8Array(code), module: await WebAssembly.compile(code),
      json: fs.readFileSync(path.join(FAUST, "dist", `${mod}-meta.json`), "utf8"), poly: false };
  }
  return _factories[mod];
}
async function mkProc(mod) {
  if (!_gen) {
    const { FaustMonoDspGenerator } = await import(
      path.join(FAUST, "node_modules/@grame/faustwasm/dist/esm/index.js"));
    _gen = new FaustMonoDspGenerator();
  }
  return _gen.createOfflineProcessor(SR, BS, await factory(mod));
}
// PARAM ROOT off the UI tree, not the declared name — see render-core.paramRoot
// (dx7.lib's top-level "DX7" group renames the path root; everything else matches).
const rootOf = (mod) => RC.paramRoot(_factories[mod].json);

// dx7 cartridge presets (node fs). Shared by press + the segment-parity gate.
function loadDx7Presets() {
  return fs.existsSync(path.join(FAUST, "data", "dx7-presets.json"))
    ? JSON.parse(fs.readFileSync(path.join(FAUST, "data", "dx7-presets.json"), "utf8")) : {};
}

// ---------------------------------------------------------------- decode (node)
// The node-only input decode (ffmpeg -> f32le mono): found-source buffers +
// the vocoder speech input. Split out of press() so test/unit/segment-parity.test.js
// (and, later, the stream renderer's node adapter) can decode identically and
// inject the PCM into the environment-agnostic assembly core below.
// SPEECH organ (engine/speech.js): a foundSource may carry `synthText`
// {text, voice, variant, pitch, speed} instead of a file. Synthesize the SAME
// PCM the browser hears (the artifact's fresh-instance cross-runtime
// guarantee — see vendor/espeak-ng/README.md). Lazy require + availability
// probe so a clean clone WITHOUT vendor/ presses everything else fine: the
// synthText source is skipped with a warning (graceful-degrade posture).
let _speechOrgan; // undefined = unprobed, null = unavailable, else the module
async function speechOrgan() {
  if (_speechOrgan !== undefined) return _speechOrgan;
  try {
    const CS = require(path.join(ROOT, "speech.js"));
    _speechOrgan = (await CS.available()) ? CS : null;
    if (!_speechOrgan) console.warn("  speech: vendor/espeak-ng missing — synthText sources skipped");
  } catch (e) {
    _speechOrgan = null;
    console.warn("  speech: organ unavailable (" + String(e && e.message).slice(0, 80) + ") — synthText sources skipped");
  }
  return _speechOrgan;
}
async function synthPCM(spec) {
  const CS = await speechOrgan();
  if (!CS) return null;
  const { pcm } = await CS.synth(spec.text, spec);
  return pcm && pcm.length ? pcm : null;
}

async function decodeInputs(state, sched, opts) {
  const TOTAL = opts.TOTAL;
  // top-level beds ship as MP3 since the payload diet (HOSTING.md §3); prefer
  // found/<id>.mp3 and keep the .wav fallback for any not-yet-converted tree
  const bedPath = (id) => {
    // beds carry their bitrate in the name (immutable-by-name; see
    // tools/build/transcode-beds.js). Try the current encode, then the pre-rename
    // name, then wav, so a partially-converted tree still renders.
    for (const ext of [".64.mp3", ".mp3", ".wav"]) {
      const p = path.join(SITE, "found", id + ext);
      if (fs.existsSync(p)) return p;
    }
    return path.join(SITE, "found", id + ".mp3");
  };
  // ---- found layer sources ----
  const usedSrc = new Set(sched.found.map(f => f.srcId));
  // sampler units' zone wavs ride foundSources at vol 0 — decode them too
  for (const u of Object.values(sched.units))
    if (u && u.sampler) for (const z of u.sampler.zones) usedSrc.add(z.srcId);
  const buffers = {};
  const fileSrcs = [];   // ffmpeg-decoded sources, gathered for the pool below
  for (const s of state.foundSources || []) {
    if (!usedSrc.has(s.id)) continue;
    if (s.synthText) {   // SPEECH organ: synthesize instead of ffmpeg-decoding a file
      try {
        const pcm = await synthPCM(s.synthText);
        if (pcm) buffers[s.id] = pcm;
        else console.warn(`  found: speech organ unavailable — skipping ${s.id}`);
      } catch (e) { console.warn(`  found: cannot synth ${s.id} (${String(e.message).slice(0, 80)}) — skipping`); }
      continue;
    }
    fileSrcs.push({ id: s.id, p: s.fsPath || (s.samplePath ? path.join(SITE, s.samplePath) : bedPath(s.id)) });
  }
  // ENGINE-AUDIT Tier 1/3: file sources decode through an async ffmpeg
  // POOL (8-wide) instead of one execFileSync at a time — process startup
  // dominates the small drum/GM-zone wavs (audit measured 4.0s -> 1.35s on a
  // 25-source state). PCM per file is identical (same ffmpeg args), buffers
  // stay keyed by srcId and are assigned in the original source order, and the
  // downstream mixing order is untouched — pressed bytes do not move.
  {
    const results = new Array(fileSrcs.length);
    let next = 0;
    const worker = async () => {
      for (;;) {
        const i = next++;
        if (i >= fileSrcs.length) return;
        try { results[i] = { pcm: await ffdecodeAsync(fileSrcs[i].p) }; }
        catch (e) { results[i] = { err: e }; }
      }
    };
    await Promise.all(Array.from({ length: Math.min(DECODE_POOL, fileSrcs.length) }, worker));
    for (let i = 0; i < fileSrcs.length; i++) {
      const r = results[i];
      if (r && r.pcm) buffers[fileSrcs[i].id] = r.pcm;
      else console.warn(`  found: cannot decode ${fileSrcs[i].p} (${String(r && r.err && r.err.message).slice(0, 80)}) — skipping ${fileSrcs[i].id}`);
    }
  }
  // ---- vocoder speech input (robot_choir has 1 audio input) ----
  let speech = null;
  const needVoc = Object.values(sched.units).some(u => u && u.vocoder);
  if (needVoc) {
    const vs = (state.foundSources || []).find(s => s.id === state.vocoderSourceId)
      || (state.foundSources || []).find(s => /^(sp_|vx_|vox_)/.test(s.id || ""));
    if (vs) {
      try {
        const raw = vs.synthText   // SPEECH organ carrier: same PCM as the browser
          ? await synthPCM(vs.synthText)
          : ffdecode(vs.fsPath || (vs.samplePath ? path.join(SITE, vs.samplePath) : bedPath(vs.id)));
        if (!raw) throw new Error("speech organ unavailable");
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
// rootOf/buffers/speech/dx7Presets arrive via `env`, so test/unit/segment-parity.test.js
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
  // MASTERING: units carrying `pan` (state-engine applyMasterPan) ride the
  // same wide buses stereo voices use — so a panned mix allocates them too.
  const anyStereo = Object.values(sched.units).some(u => u && (u.stereo || u.pan || u.panSpread));
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
        gain: (u.lvl != null ? u.lvl : 0.5) * (e.sets.gain != null ? e.sets.gain : 0.13),
        // VELOCITY-LAYER selection runs off the MUSICAL amp (e.amp), not this
        // mix gain — SP.selVel is the one formula live.js uses too
        // (ENGINE-AUDIT Tier 2).
        vel: SP.selVelOf(e),
        atk: u.sampler.atk, rel: u.sampler.rel, zones: u.sampler.zones,
        swell: !!u.sampler.swell,
        mello: u.sampler.mello || null,   // MELLOTRON: LFO phase off note tSec (deterministic)
        bendFrom: e.bend ? e.bend.from : 0, bendMs: e.bend ? e.bend.ms : 0,
        pan: SE.notePan(u, e.sets.freq),  // MASTERING: unit pan + pad pitch spread
      })).filter(n => n.tSec < totalSec);
      // INSERTS-ON-SAMPLED-VOICES: a sampled unit carrying its declared insert
      // chain (state-engine samplerUnit — explicit kernel inserts, distort
      // excluded) renders through the SAME dist/ insert modules synth units use,
      // under render-core's exact insert law: notes mix PRE-SEND into a
      // unit-local buffer (per-note gain + channel strip inside mixPCM), the
      // chain processes it whole-song (LFO phase + tails continuous), THEN the
      // dry/rev/del sends apply. Units without inserts keep the original
      // direct-mix path untouched (bit-identical, the absent-law).
      if (u.inserts && u.inserts.length) {
        const ubuf = new Float32Array(TOTAL);
        SP.mixPCM(notes, buffers, SR, { dry: ubuf, rev: ubuf, del: ubuf },
          { dry: 1, rev: 0, del: 0, strip: u.sampler.strip, granularOverSt: u.sampler.granularOverSt, grainSec: u.sampler.grainSec });
        for (const eff of u.inserts) {
          const ip = await mkProc(eff.module);
          const IR = "/" + rootOf(eff.module) + "/";
          for (const [k, pv] of Object.entries(eff.params)) ip.setParamValue(IR + k, pv);
          if (eff.barSec) ip.setParamValue(IR + "barSec", 4 * spb); // tempo-synced LFO
          // BATCHED SPAN (ENGINE-AUDIT Tier 4, see render-core SPAN_MAX): fixed
          // params for the whole song, so the per-64 walk is one change-free run
          // — faustwasm chunks the compute at BS internally either way.
          for (let s = 0; s < TOTAL; s += SPAN) {
            const span = Math.min(SPAN, TOTAL - s);
            const o = ip.render([ubuf.subarray(s, s + span)], span)[0];
            for (let i = 0; i < span; i++) ubuf[s + i] = o[i];
          }
        }
        const dg = u.dry != null ? u.dry : 1, rg = u.rev || 0, lg = u.del || 0;
        // MASTERING pan (unit-level for insert-carrying sampled units — the
        // per-note spread is lost through the mono insert chain, accepted)
        const pgi = (u.pan && wL) ? RC.panLR(u.pan) : null;
        for (let i = 0; i < TOTAL; i++) {
          const x = ubuf[i];
          if (pgi) { const xd = x * dg; wL[i] += xd * pgi.l; wR[i] += xd * pgi.r; }
          else dry[i] += x * dg;
          rev[i] += x * rg; del[i] += x * lg;
        }
        console.log(`  ${key}: ${notes.length} ev -> sampler:${u.sampler.id} (native PCM, ${u.sampler.zones.length} zones)` +
          ` [inserts: ${u.inserts.map(i => i.type).join(">")}]`);
        continue;
      }
      SP.mixPCM(notes, buffers, SR, { dry, rev, del, dryL: wL, dryR: wR },
        { dry: u.dry != null ? u.dry : 1, rev: u.rev || 0, del: u.del || 0, strip: u.sampler.strip, granularOverSt: u.sampler.granularOverSt, grainSec: u.sampler.grainSec });
      console.log(`  ${key}: ${notes.length} ev -> sampler:${u.sampler.id} (native PCM, ${u.sampler.zones.length} zones)` +
        (u.carve ? ` [carve: shares ${u.carve} — HPF/mud-dip]` : "") + (u.pan ? ` [pan ${u.pan}]` : ""));
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
    for (let s = 0; s < TOTAL; s += SPAN) {
      const span = Math.min(SPAN, TOTAL - s);
      const o = bp.render([del.subarray(s, s + span), pp.subarray(s, s + span)], span);
      bleed.set(o[0].subarray(0, span), s);
    }
    const revColorIn = new Float32Array(TOTAL);
    for (let i = 0; i < TOTAL; i++) revColorIn[i] = rev[i] + bleed[i];

    const rp = await mkProc(rc.module);
    const RR = "/" + rootOf(rc.module) + "/";
    rp.setParamValue(RR + "rgain", rc.rgain);
    rp.setParamValue(RR + "rtone", rc.rtone);
    wetL = new Float32Array(TOTAL); wetR = new Float32Array(TOTAL);
    for (let s = 0; s < TOTAL; s += SPAN) {
      const span = Math.min(SPAN, TOTAL - s);
      const o = rp.render([revColorIn.subarray(s, s + span), revColorIn.subarray(s, s + span)], span);
      wetL.set(o[0].subarray(0, span), s); wetR.set((o[1] || o[0]).subarray(0, span), s);
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
  // fx_bus dry L/R inputs: mono dry duplicated, plus the stereo voices' width
  // AND the reverb-color wet (folded into dry so it rides the master chain).
  const dryL = (wL || wetL) ? (() => { const b = new Float32Array(TOTAL); for (let i = 0; i < TOTAL; i++) b[i] = dry[i] + (wL ? wL[i] : 0) + (wetL ? wetL[i] : 0); return b; })() : dry;
  const dryRch = (wR || wetR) ? (() => { const b = new Float32Array(TOTAL); for (let i = 0; i < TOTAL; i++) b[i] = dry[i] + (wR ? wR[i] : 0) + (wetR ? wetR[i] : 0); return b; })() : dry;
  // BATCHED SPAN (ENGINE-AUDIT Tier 4): the mcut walk still runs per BLOCK, but
  // consecutive blocks that set the SAME mcut (i.e. every block outside a live
  // sweep — and every block at all when a state has no sweeps) render in one
  // call. setParamValue with an unchanged value is a no-op write, so the DSP
  // state sequence — and the output — is identical to the per-64 loop. The
  // 6th (unused) fx_bus input is omitted: faustwasm zero-fills a missing input.
  let mcut = 21000, swi = 0; const activeSw = [];
  let spanStart = 0, lastSet = null;
  const fxFlush = (end) => {
    if (end <= spanStart) return;
    const s = spanStart, span = end - s;
    const o = fx.render([dryL.subarray(s, s + span), dryRch.subarray(s, s + span),
      rev.subarray(s, s + span), del.subarray(s, s + span), pp.subarray(s, s + span)], span);
    L.set(o[0], s); Rr.set(o[1], s);
    spanStart = end;
  };
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
      const mv = Math.min(21000, Math.max(180, mcut));
      if (lastSet === null || mv !== lastSet) { fxFlush(s); fx.setParamValue("/fx_bus/mcut", mv); lastSet = mv; }
    }
    if (s + len - spanStart >= SPAN) fxFlush(s + len);
  }
  fxFlush(TOTAL);

  // ---- MULTIBAND MASTER COMP (fx wings stage 4): opt-in post-pass over the
  // fx_bus output (state.masterComp > 0, e.g. disco). Genres without it never
  // build the module — the fx_bus output above IS the master (byte-identical,
  // committed fx_bus bytes). See state-engine masterMb for why it is NOT baked
  // into fx_bus (always-on cost measured against the live load gate).
  const mb = SE.masterMb(state);
  if (mb) {
    const mp = await mkProc(mb.module);
    mp.setParamValue("/" + rootOf(mb.module) + "/mbdrive", mb.mbdrive);
    for (let s = 0; s < TOTAL; s += SPAN) {
      const span = Math.min(SPAN, TOTAL - s);
      const o = mp.render([L.subarray(s, s + span), Rr.subarray(s, s + span)], span);
      L.set(o[0].subarray(0, span), s); Rr.set(o[1].subarray(0, span), s);
    }
    console.log(`  master mb: ${mb.module}, mbdrive=${mb.mbdrive.toFixed(2)}`);
  }

  return { L, Rr, TOTAL };
}

// ---------------------------------------------------------------- makeup gain
// MASTERING STAGE §4: per-press GAIN STAGING. The catalog norm
// peaks at -3..-5 dBFS but quiet genres (fugue seed 3: max -22 dB) pressed
// badly under-gained. computeMakeup is the whole law: a press whose float
// master peaks BELOW the target window is lifted toward MASTER_TARGET_PEAK
// (-6 dBFS), capped at MASTER_MAX_MAKEUP; a press already at/above the target
// gets gain 1 — LOUD GENRES ARE BYTE-UNTOUCHED and nothing is ever turned
// down, so no squash and (since post-gain peak <= target < 1) no clipping.
// Applied in press() AFTER assemble(): assemble stays the segment-parity
// reference, and the streaming path (causal — it cannot know the whole-song
// peak) keeps its own gain structure (live has its own output chain).
const MASTER_TARGET_PEAK = 0.5;   // -6 dBFS
const MASTER_MAX_MAKEUP = 8;      // +18 dB ceiling — a near-silent press stays honest
function computeMakeup(peak) {
  if (!(peak > 1e-6) || peak >= MASTER_TARGET_PEAK) return 1;
  return Math.min(MASTER_TARGET_PEAK / peak, MASTER_MAX_MAKEUP);
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

  // MASTERING makeup (see computeMakeup above): lift under-gained presses
  // toward the catalog loudness window; loud presses pass byte-untouched.
  let peak = 0;
  for (let i = 0; i < TOTAL; i++) {
    const al = Math.abs(L[i]), ar = Math.abs(Rr[i]);
    if (al > peak) peak = al;
    if (ar > peak) peak = ar;
  }
  const makeup = computeMakeup(peak);
  if (makeup > 1) {
    for (let i = 0; i < TOTAL; i++) { L[i] *= makeup; Rr[i] *= makeup; }
    console.log(`  master makeup: peak ${(20 * Math.log10(Math.max(peak, 1e-9))).toFixed(1)} dBFS -> x${makeup.toFixed(2)} (${(20 * Math.log10(makeup)).toFixed(1)} dB) toward ${(20 * Math.log10(MASTER_TARGET_PEAK)).toFixed(0)} dBFS`);
  }

  writeWav(outPath, L, Rr);
  let sq = 0; for (let i = 0; i < TOTAL; i++) sq += L[i] * L[i];
  const rmsDb = 20 * Math.log10(Math.max(Math.sqrt(sq / TOTAL), 1e-9));
  console.log(`wrote ${outPath}: ${(TOTAL / SR).toFixed(1)}s, L-RMS ${rmsDb.toFixed(1)} dB, ${(Date.now() - t0) / 1000 | 0}s to render`);
  // ENGINE-AUDIT Tier 1: ONE spawnSync whose .stderr is readable on
  // success AND failure — the old execFileSync pair could only see stderr via
  // its catch path (volumedetect prints to stderr, ffmpeg exits 0), so the
  // first full-decode pass was always discarded and re-run via sh -c 2>&1.
  let vd = "";
  try {
    const r = spawnSync("ffmpeg", ["-i", outPath, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
    vd = String(r.stderr || "") + String(r.stdout || "");
  } catch (e) { vd = ""; }
  const m = vd.match(/mean_volume: ([-\d.]+) dB[\s\S]*?max_volume: ([-\d.]+) dB/);
  const meanDb = m ? parseFloat(m[1]) : null;
  if (m) console.log(`volumedetect: mean ${m[1]} dB, max ${m[2]} dB`);
  return { seconds: TOTAL / SR, rmsDb, meanDb, expectedSeconds: sched.totalBeats * spb };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const durIx = args.indexOf("--dur");
  const dur = durIx >= 0 ? parseFloat(args.splice(durIx, 2)[1]) : 0;
  if (args.length < 2) { console.error("usage: node faust/press/press.js <state.json> <out.wav> [--dur seconds]"); process.exit(1); }
  const state = JSON.parse(fs.readFileSync(args[0], "utf8"));
  press(state, args[1], { dur }).catch(e => { console.error(e); process.exit(1); });
}
module.exports = { press, assemble, decodeInputs, loadDx7Presets, mkProc, rootOf, SR, BS,
  computeMakeup, MASTER_TARGET_PEAK, MASTER_MAX_MAKEUP };
