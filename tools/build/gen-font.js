// gen-font.js — extract an ALTERNATE soundfont into a parallel instrument set
// for the runtime SOUNDFONT SWITCHER in the settings panel.
// For every kernel SAMPLERS slug it finds the matching GM preset in
// <font>, full-captures its zones (all key-zones + all velocity layers, via
// sf2.js), writes the wavs to found/samples/instruments-<key>/<slug>/, and emits
// engine/faust/data/font-<key>.json = { key, label, base, instr:{ slug:{sr,zones} } }.
// Slugs the font lacks are omitted -> the app falls back to the default (FluidR3)
// for those, so a font need not be a complete GM set.
//
//   node tools/build/gen-font.js <font.sf2> <key> "<Label>"
"use strict";
const fs = require("fs");
const path = require("path");
const SF2 = require("../../engine/faust/build/sf2.js");
const K = require("../../engine/genre-kernel.js");

const [font, key, label] = process.argv.slice(2);
if (!font || !key) { console.error('usage: gen-font.js <font.sf2> <key> "<Label>"'); process.exit(1); }
const OUT_SR = 44100;
const ROOT = path.join(__dirname, "..", "..");
const baseDir = "instruments-" + key;
const outRoot = path.join(ROOT, "found/samples", baseDir);
fs.mkdirSync(outRoot, { recursive: true });

const sf = SF2.parse(fs.readFileSync(font));
// Both fonts are GM, so program N is the same instrument even when the names
// differ wildly (FluidR3 "Yamaha Grand Piano" == SGM "Piano 1" == program 0).
// Map each kernel instrument to its GM PROGRAM via the FluidR3 reference, then
// pull that program from the target font. Specialty/custom slugs (crunch_guitar,
// upright_piano, tenor_sax…) aren't in the GM reference -> they fall back.
const REF = SF2.parse(fs.readFileSync(process.env.REF_FONT || "/tmp/FluidR3_GM_GS.sf2"));
const progOfGM = (gm) => { const w = gm.toUpperCase();
  let ix = REF.presets.findIndex((p) => p.bank === 0 && p.name.toUpperCase() === w);
  if (ix < 0) ix = REF.presets.findIndex((p) => p.bank === 0 && p.name.toUpperCase().includes(w));
  return ix >= 0 ? REF.presets[ix].preset : -1;
};
const findPreset = (gm) => {
  const prog = progOfGM(gm);
  if (prog >= 0) { const ix = sf.presets.findIndex((p) => p.bank === 0 && p.preset === prog); if (ix >= 0) return ix; }
  const w = gm.toUpperCase();
  let ix = sf.presets.findIndex((p) => p.bank === 0 && p.name.toUpperCase() === w);
  if (ix < 0) ix = sf.presets.findIndex((p) => p.bank === 0 && p.name.toUpperCase().includes(w));
  return ix;
};
const writeWav = (file, pcm) => {
  const data = Buffer.alloc(pcm.length * 2);
  for (let j = 0; j < pcm.length; j++) data.writeInt16LE(Math.max(-1, Math.min(1, pcm[j])) * 32767 | 0, j * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(OUT_SR, 24); h.writeUInt32LE(OUT_SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
};

const instr = {};
let ok = 0, miss = [];
for (const [slug, v] of Object.entries(K.SAMPLERS)) {
  const gm = (v.label || "").replace(/\s*\(.*\)\s*$/, "");
  const ix = findPreset(gm);
  if (ix < 0) { miss.push(slug + " (" + gm + ")"); continue; }
  let zones = sf.zonesOf(ix);
  if (!zones.length) { miss.push(slug + " (no zones)"); continue; }
  zones.sort((a, b) => a.velLo - b.velLo || a.root - b.root || a.keyLo - b.keyLo);
  const seen = new Set();
  zones = zones.filter((z) => { const k = z.keyLo + ":" + z.keyHi + ":" + z.root + ":" + z.velLo + ":" + z.velHi; if (seen.has(k)) return false; seen.add(k); return true; });
  const dir = path.join(outRoot, slug);
  fs.mkdirSync(dir, { recursive: true });
  const zmeta = [];
  zones.forEach((z, i) => {
    let pcm = sf.pcmOf(z.sample);
    let ls = z.sample.loopStart - z.sample.start, le = z.sample.loopEnd - z.sample.start;
    if (z.sample.rate !== OUT_SR) {
      const k = OUT_SR / z.sample.rate, n = Math.floor(pcm.length * k), r = new Float32Array(n);
      for (let j = 0; j < n; j++) { const x = j / k, x0 = Math.floor(x), f = x - x0; r[j] = pcm[x0] + f * ((pcm[x0 + 1] || 0) - pcm[x0]); }
      pcm = r; ls = Math.round(ls * k); le = Math.round(le * k);
    }
    // clamp the loop end INSIDE the written buffer — some SF2 loopEnds sit one
    // past the sample end (and resample rounding can nudge it over), which put
    // le = len+1 and made the runtime loop silently one-shot (the Turtle Beach /
    // Montego "short envelopes" bug). Never emit a loop point past the samples.
    le = Math.min(le, pcm.length); ls = Math.min(ls, Math.max(0, le - 1));
    const file = `z${String(i).padStart(2, "0")}_r${z.root}.wav`;
    writeWav(path.join(dir, file), pcm);
    const rootEff = z.root - z.coarse - z.fine / 100;
    zmeta.push({ file, root: Math.round(rootEff * 100) / 100, lo: z.keyLo, hi: z.keyHi,
      vlo: z.velLo, vhi: z.velHi, loop: (z.loop && le > ls + 8) ? 1 : 0, ls, le });
  });
  instr[slug] = { sr: OUT_SR, zones: zmeta };
  ok++;
  process.stdout.write(`\r  ${ok} instruments (${slug}: ${zmeta.length} zones)          `);
}
const out = { key, label: label || key, base: baseDir, instr };
fs.writeFileSync(path.join(ROOT, "engine/faust/data/font-" + key + ".json"), JSON.stringify(out));
// register in the manifest the app reads (idempotent: replace/append this key)
try {
  const mf = path.join(ROOT, "engine/faust/data/fonts.json");
  let list = []; try { list = JSON.parse(fs.readFileSync(mf, "utf8")); } catch (e) {}
  if (!list.length) list = [{ key: "fluidr3", label: "FluidR3 GM (default)" }];
  list = list.filter((f) => f.key !== key);
  list.push({ key, label: label || key });
  fs.writeFileSync(mf, JSON.stringify(list, null, 1) + "\n");
} catch (e) { console.warn("fonts.json update skipped:", e.message); }
console.log(`\n✓ font-${key}.json: ${ok} instruments, ${Object.values(instr).reduce((a, x) => a + x.zones.length, 0)} zones -> found/samples/${baseDir}/`);
if (miss.length) console.log("  fall back to default (not in this font): " + miss.join(", "));
