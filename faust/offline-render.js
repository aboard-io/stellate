#!/usr/bin/env node
// offline-render.js — proves the CLI "pressing" path (claim c): renders 10s of
// faust/fixture.json with faustwasm's OFFLINE processors (same precompiled
// dist/ artifacts as the browser — no libfaust, no AudioContext), applying the
// same param schedule the live page uses, then writes faust-render.wav.
// Verify: ffmpeg volumedetect (nonzero RMS) — run: node offline-render.js
"use strict";
const fs = require("fs");
const path = require("path");

const SR = 44100, BS = 64, SECS = 10, TOTAL = SR * SECS;
const OUT = path.join(__dirname, "faust-render.wav");
const fixture = require("./fixture.json");
const R = fixture.recipes, D = R.drums, spb = 60 / fixture.bpm;

async function loadFactory(name) {
  const code = fs.readFileSync(path.join(__dirname, "dist", `${name}-module.wasm`));
  return { cfactory: 0, code: new Uint8Array(code), module: await WebAssembly.compile(code),
           json: fs.readFileSync(path.join(__dirname, "dist", `${name}-meta.json`), "utf8"), poly: false };
}

async function main() {
  const { FaustMonoDspGenerator } = await import(
    path.join(__dirname, "node_modules/@grame/faustwasm/dist/esm/index.js"));
  const factories = {};
  for (const n of ["kick909", "snare_crack", "supersaw", "pad_saw", "fx_bus"])
    factories[n] = await loadFactory(n);
  const gen = new FaustMonoDspGenerator();
  const mkProc = (dsp) => gen.createOfflineProcessor(SR, BS, factories[dsp]);

  // voice instances mirror engine.js: mono pools, melody x2 / pad x4 round-robin
  const mk = async (dsp, params, dry, rev, del) => {
    const proc = await mkProc(dsp);
    for (const [k, v] of Object.entries(params)) proc.setParamValue(`/${dsp}/${k}`, v);
    return { dsp, proc, dry, rev, del, changes: [] };
  };
  const inst = {
    kick: [await mk("kick909", { level: Math.min(2, D.kick), tune: D.tune }, 1, D.send * 0.35, 0)],
    snare: [await mk("snare_crack", { level: Math.min(2, D.snare) }, 1, D.send, D.dsend)],
    hat: [await mk("snare_crack", { level: Math.min(2, D.hat * 0.45), decay: 0.03 }, 0.7, D.send * 0.3, D.dsend * 0.5)],
    bass: [await mk("supersaw", { cutoff: R.bass.cutoff, res: Math.min(0.95, R.bass.res), detune: 0.004, level: Math.min(1, R.bass.level * 0.5) }, 1, R.bass.send, R.bass.dsend)],
    melody: [await mk("supersaw", { cutoff: R.melody.cutoff, res: Math.min(0.95, R.melody.res), level: Math.min(1, R.melody.level) }, 1, R.melody.send, R.melody.dsend),
             await mk("supersaw", { cutoff: R.melody.cutoff, res: Math.min(0.95, R.melody.res), level: Math.min(1, R.melody.level) }, 1, R.melody.send, R.melody.dsend)],
    pad: await Promise.all([0, 1, 2, 3].map(() => mk("pad_saw", { cutoff: R.pad.cutoff, attack: Math.min(4, R.pad.attack), level: Math.min(1, R.pad.level) }, 1, R.pad.send, R.pad.dsend))),
  };

  // event -> per-instance param-change lists (sample-indexed, BS-quantized by the loop)
  const rr = { melody: 0, pad: 0 };
  for (const ev of fixture.events) {
    const t = ev.t * spb; if (t >= SECS - 0.05) continue;
    const pool = inst[ev.voice]; if (!pool) continue;
    const v = pool.length > 1 ? pool[rr[ev.voice]++ % pool.length] : pool[0];
    const s = Math.floor(t * SR);
    const isDrum = ev.voice === "kick" || ev.voice === "snare" || ev.voice === "hat";
    const off = s + Math.floor((isDrum ? 0.012 : Math.max(0.012, ev.dur * spb) - 0.008) * SR);
    if (ev.freq != null) v.changes.push([s - BS, `/${v.dsp}/freq`, ev.freq]);
    v.changes.push([s, `/${v.dsp}/gate`, 1], [off, `/${v.dsp}/gate`, 0]);
  }

  // render every instance in BS slices, applying due changes before each slice
  const all = Object.values(inst).flat();
  for (const v of all) {
    v.changes.sort((a, b) => a[0] - b[0]);
    v.out = new Float32Array(TOTAL);
    let ci = 0;
    for (let s = 0; s < TOTAL; s += BS) {
      const len = Math.min(BS, TOTAL - s);
      while (ci < v.changes.length && v.changes[ci][0] < s + len) { v.proc.setParamValue(v.changes[ci][1], v.changes[ci][2]); ci++; }
      v.out.set(v.proc.render([], len)[0], s);
    }
  }

  // fx bus (6 ins: dryL, dryR, rev, del, pingpong, sidechain) — dry is mixed
  // natively below, so only the rev/del sends are fed here
  const revIn = new Float32Array(TOTAL), delIn = new Float32Array(TOTAL), zero = new Float32Array(TOTAL);
  for (const v of all) for (let i = 0; i < TOTAL; i++) { revIn[i] += v.out[i] * v.rev; delIn[i] += v.out[i] * v.del; }
  const fx = await mkProc("fx_bus");
  fx.setParamValue("/fx_bus/dtime", Math.min(1.5, R.delayBeats * spb));
  fx.setParamValue("/fx_bus/dfb", R.delayFb);
  fx.setParamValue("/fx_bus/rgain", Math.min(2, R.reverb * 2.2));
  const wet = fx.render([zero, zero, revIn, delIn, zero, zero], TOTAL);

  // mix: dry (mono -> both channels) + wet, master 0.9, hard-clip guard
  const L = new Float32Array(TOTAL), Rt = new Float32Array(TOTAL);
  for (const v of all) for (let i = 0; i < TOTAL; i++) { L[i] += v.out[i] * v.dry; Rt[i] += v.out[i] * v.dry; }
  for (let i = 0; i < TOTAL; i++) {
    L[i] = Math.max(-1, Math.min(1, (L[i] + wet[0][i]) * 0.9));
    Rt[i] = Math.max(-1, Math.min(1, (Rt[i] + wet[1][i]) * 0.9));
  }

  // 16-bit stereo WAV
  const data = Buffer.alloc(TOTAL * 4);
  for (let i = 0; i < TOTAL; i++) { data.writeInt16LE(L[i] * 32767 | 0, i * 4); data.writeInt16LE(Rt[i] * 32767 | 0, i * 4 + 2); }
  const hdr = Buffer.alloc(44);
  hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write("WAVEfmt ", 8);
  hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
  hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34);
  hdr.write("data", 36); hdr.writeUInt32LE(data.length, 40);
  fs.writeFileSync(OUT, Buffer.concat([hdr, data]));

  let rms = 0; for (let i = 0; i < TOTAL; i++) rms += L[i] * L[i];
  console.log(`wrote ${OUT} (${SECS}s, ${all.length} voice procs + fx), L-RMS=${Math.sqrt(rms / TOTAL).toFixed(4)}`);
}
main().catch(e => { console.error(e); process.exit(1); });
