#!/usr/bin/env node
// vocoder-test.js — listen-test for robot_choir.dsp (ve.vocoder channel
// vocoder) as the classic alternative to csd-engine's pvsvoc model.
// Feeds REAL speech (found/vx_*.mp3, decoded via ffmpeg to raw f32) as the
// processor's audio input while a note is held, renders 8s, and checks:
//   1. nonzero RMS,
//   2. the output envelope FOLLOWS the speech envelope (correlation) —
//      i.e. the carrier is actually being articulated by the speech, not
//      just leaking through.
// Writes vocoder-render.wav for ears. Usage: node vocoder-test.js [speech.wav]
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SR = 44100, BS = 64, SECS = 8, TOTAL = SR * SECS;
const speechWav = process.argv[2] || path.join(__dirname, "..", "found", "vx_fdr.mp3");

async function main() {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", speechWav, "-ac", "1", "-ar", String(SR),
    "-t", String(SECS), "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  const speech = new Float32Array(raw.buffer, raw.byteOffset, Math.min(TOTAL, raw.length >> 2));
  const { FaustMonoDspGenerator } = await import(
    path.join(__dirname, "..", "engine", "faust", "node_modules/@grame/faustwasm/dist/esm/index.js"));
  const code = fs.readFileSync(path.join(__dirname, "..", "engine", "faust", "dist", "robot_choir-module.wasm"));
  const factory = { cfactory: 0, code: new Uint8Array(code), module: await WebAssembly.compile(code),
    json: fs.readFileSync(path.join(__dirname, "..", "engine", "faust", "dist", "robot_choir-meta.json"), "utf8"), poly: false };
  const gen = new FaustMonoDspGenerator();
  const proc = await gen.createOfflineProcessor(SR, BS, factory);
  proc.setParamValue("/robot_choir/freq", 220);
  proc.setParamValue("/robot_choir/gate", 1);
  const out = proc.render([speech], TOTAL)[0];

  // block-envelope correlation, skipping the 40ms attack
  const W = 2048, skip = Math.floor(0.1 * SR / W);
  const envS = [], envO = [];
  for (let b = skip; (b + 1) * W <= TOTAL; b++) {
    let es = 0, eo = 0;
    for (let i = b * W; i < (b + 1) * W; i++) { es += (speech[i] || 0) ** 2; eo += out[i] ** 2; }
    envS.push(Math.sqrt(es / W)); envO.push(Math.sqrt(eo / W));
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const mS = mean(envS), mO = mean(envO);
  let num = 0, dS = 0, dO = 0;
  for (let i = 0; i < envS.length; i++) { num += (envS[i] - mS) * (envO[i] - mO); dS += (envS[i] - mS) ** 2; dO += (envO[i] - mO) ** 2; }
  const corr = num / Math.sqrt(dS * dO || 1);
  let rms = 0; for (let i = 0; i < TOTAL; i++) rms += out[i] * out[i];
  rms = Math.sqrt(rms / TOTAL);

  const data = Buffer.alloc(TOTAL * 2);
  for (let i = 0; i < TOTAL; i++) data.writeInt16LE(Math.max(-1, Math.min(1, out[i])) * 32767 | 0, i * 2);
  const hdr = Buffer.alloc(44);
  hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write("WAVEfmt ", 8);
  hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22);
  hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34);
  hdr.write("data", 36); hdr.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(__dirname, "vocoder-render.wav"), Buffer.concat([hdr, data]));
  console.log(`speech: ${path.basename(speechWav)}  out RMS=${rms.toFixed(4)}  envelope corr=${corr.toFixed(3)}  (want >0.6)`);
  console.log("wrote vocoder-render.wav");
}
main().catch(e => { console.error(e); process.exit(1); });
