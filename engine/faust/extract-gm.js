#!/usr/bin/env node
// faust/extract-gm.js — extract EVERY bank-0 General MIDI melodic preset (all 128)
// from a FluidR3-class SoundFont in a SINGLE parse. The `sf2.js extract` CLI reparses
// the 151MB font per preset; 128× that is wasteful, so this parses once and loops.
// Zone logic MIRRORS sf2.js `extract` exactly (dedupe stereo twins, thin to --max-zones
// spread across the keymap, resample to 44100, effective root from coarse/fine tune,
// zones.json) so a dir written here is byte-shaped identically to one written by the CLI.
//
//   node faust/extract-gm.js <font.sf2> <outDir> [--max-zones N]
//
// Presets with <2 zones (SFX, single-note synth pads, DrawbarOrgan-class) still extract
// but are logged THIN — they pitch poorly across a keymap; usable as one-shot color only.
"use strict";
const fs = require("fs");
const path = require("path");
const SF2 = require(path.join(__dirname, "sf2.js"));

const [font, outBase] = process.argv.slice(2);
if (!font || !outBase) { console.error("usage: extract-gm.js <font.sf2> <outDir> [--max-zones N]"); process.exit(1); }
const MAXZ = process.argv.includes("--max-zones") ? +process.argv[process.argv.indexOf("--max-zones") + 1] : 6;
const OUT_SR = 44100;

const sf = SF2.parse(fs.readFileSync(font));
const bank0 = sf.presets.map((p, ix) => ({ p, ix })).filter((e) => e.p.bank === 0);
console.log(`bank-0 GM presets: ${bank0.length}`);

let ok = 0; const thin = [], summary = [];
for (const { p: P, ix } of bank0) {
  const slug = P.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  let zones = sf.zonesOf(ix);
  if (!zones.length) { summary.push({ slug, name: P.name, prog: P.preset, zones: 0 }); continue; }
  zones.sort((a, b) => a.root - b.root || a.keyLo - b.keyLo);
  const seen = new Set();
  zones = zones.filter((z) => { const k = z.keyLo + ":" + z.keyHi + ":" + z.root; if (seen.has(k)) return false; seen.add(k); return true; });
  if (zones.length > MAXZ) {
    const kept = [];
    for (let i = 0; i < MAXZ; i++) kept.push(zones[Math.round(i * (zones.length - 1) / (MAXZ - 1))]);
    zones = [...new Set(kept)];
  }
  const dir = path.join(outBase, slug);
  fs.mkdirSync(dir, { recursive: true });
  const meta = { name: P.name, sr: OUT_SR, zones: [] };
  zones.forEach((z, i) => {
    let pcm = sf.pcmOf(z.sample);
    let ls = z.sample.loopStart - z.sample.start, le = z.sample.loopEnd - z.sample.start;
    if (z.sample.rate !== OUT_SR) {
      const k = OUT_SR / z.sample.rate, n = Math.floor(pcm.length * k), r = new Float32Array(n);
      for (let j = 0; j < n; j++) { const x = j / k, x0 = Math.floor(x), f = x - x0; r[j] = pcm[x0] + f * ((pcm[x0 + 1] || 0) - pcm[x0]); }
      pcm = r; ls = Math.round(ls * k); le = Math.round(le * k);
    }
    // clamp the loop end INSIDE the written buffer (see gen-font.js — the
    // Montego "short envelopes" off-by-one: le=len+1 made the loop one-shot).
    le = Math.min(le, pcm.length); ls = Math.min(ls, Math.max(0, le - 1));
    const file = `z${String(i).padStart(2, "0")}_r${z.root}.wav`;
    const data = Buffer.alloc(pcm.length * 2);
    for (let j = 0; j < pcm.length; j++) data.writeInt16LE(Math.max(-1, Math.min(1, pcm[j])) * 32767 | 0, j * 2);
    const h = Buffer.alloc(44);
    h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(OUT_SR, 24); h.writeUInt32LE(OUT_SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
    h.write("data", 36); h.writeUInt32LE(data.length, 40);
    fs.writeFileSync(path.join(dir, file), Buffer.concat([h, data]));
    const rootEff = z.root - z.coarse - z.fine / 100;
    meta.zones.push({ file, root: Math.round(rootEff * 100) / 100, lo: z.keyLo, hi: z.keyHi,
      loop: z.loop && le > ls + 8, loopStart: ls, loopEnd: le, len: pcm.length });
  });
  fs.writeFileSync(path.join(dir, "zones.json"), JSON.stringify(meta, null, 1));
  ok++; summary.push({ slug, name: P.name, prog: P.preset, zones: meta.zones.length });
  if (meta.zones.length < 2) thin.push(slug);
}
fs.writeFileSync(path.join(outBase, "_gm-extract-summary.json"), JSON.stringify(summary, null, 1));
console.log(`extracted ${ok}/${bank0.length}; THIN (<2 zones, one-shot color only): ${thin.join(", ") || "none"}`);
