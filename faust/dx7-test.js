#!/usr/bin/env node
// dx7-test.js — offline proof that decoded cartridge presets actually drive
// dx7.lib: renders each preset in dx7-presets.json (E.PIANO 1 / TUB BELLS on
// alg5, SYN-BASS 2 on alg17, BRASS 2 on alg22) playing a short phrase,
// concatenates to dx7-render.wav, and prints per-preset RMS + spectral
// centroid (the four should be audibly/measurably DIFFERENT timbres).
"use strict";
const fs = require("fs");
const path = require("path");
const presets = require("./dx7-presets.json");

const SR = 44100, BS = 64, SEG = 3.0, NOTES = [[0.0, 220], [0.7, 277.18], [1.4, 329.63]]; // A3 C#4 E4

async function loadFactory(name) {
  const code = fs.readFileSync(path.join(__dirname, "dist", `${name}-module.wasm`));
  return { cfactory: 0, code: new Uint8Array(code), module: await WebAssembly.compile(code),
           json: fs.readFileSync(path.join(__dirname, "dist", `${name}-meta.json`), "utf8"), poly: false };
}

async function main() {
  const { FaustMonoDspGenerator } = await import(
    path.join(__dirname, "node_modules/@grame/faustwasm/dist/esm/index.js"));
  const gen = new FaustMonoDspGenerator();
  const segs = [];
  for (const [name, pre] of Object.entries(presets)) {
    const proc = await gen.createOfflineProcessor(SR, BS, await loadFactory(`dx7_alg${pre.alg}`));
    for (const [suffix, v] of Object.entries(pre.params)) proc.setParamValue("/DX7" + suffix, v);
    proc.setParamValue("/DX7/gain", 0.9);
    const total = Math.floor(SEG * SR), out = new Float32Array(total);
    const evs = [];
    for (const [t, f] of NOTES) {
      evs.push([Math.floor(t * SR) - BS, "/DX7/freq", f], [Math.floor(t * SR), "/DX7/gate", 1],
               [Math.floor((t + 0.5) * SR), "/DX7/gate", 0]);
    }
    evs.sort((a, b) => a[0] - b[0]);
    let ci = 0;
    for (let s = 0; s < total; s += BS) {
      const len = Math.min(BS, total - s);
      while (ci < evs.length && evs[ci][0] < s + len) { proc.setParamValue(evs[ci][1], evs[ci][2]); ci++; }
      out.set(proc.render([], len)[0], s);
    }
    let rms = 0, cw = 0, cs = 0;
    for (let i = 0; i < total; i++) rms += out[i] * out[i];
    // crude spectral centroid via zero-crossing-weighted diff energy
    for (let i = 1; i < total; i++) { const d = out[i] - out[i - 1]; cw += d * d; cs += out[i] * out[i]; }
    const centroid = Math.sqrt(cw / (cs || 1)) * SR / (2 * Math.PI); // Hz-ish brightness proxy
    console.log(`${name.padEnd(11)} alg${String(pre.alg).padEnd(3)} RMS=${Math.sqrt(rms / total).toFixed(4)}  brightness~${centroid.toFixed(0)}Hz`);
    segs.push(out);
  }
  const total = segs.reduce((n, s) => n + s.length, 0);
  const data = Buffer.alloc(total * 2); let o = 0;
  for (const s of segs) for (let i = 0; i < s.length; i++) { data.writeInt16LE(Math.max(-1, Math.min(1, s[i])) * 32767 | 0, o); o += 2; }
  const hdr = Buffer.alloc(44);
  hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write("WAVEfmt ", 8);
  hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22);
  hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34);
  hdr.write("data", 36); hdr.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(__dirname, "dx7-render.wav"), Buffer.concat([hdr, data]));
  console.log("wrote dx7-render.wav");
}
main().catch(e => { console.error(e); process.exit(1); });
