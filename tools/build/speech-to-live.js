#!/usr/bin/env node
// speech-to-live.js — turn PRE-RENDERED espeak clips into LIVE synthesis.
//
//   node tools/build/speech-to-live.js [--write]
//
// Every kind:"speech" id in the registry is espeak output — sp_ (203), hp_ (24,
// the hogcore cast), wd_ (16, budstep strain names). Checked before touching
// anything: the Naropa readings (vx_, 49) and the BBC material carry NO kind at
// all, so they are not in this set and are never at risk. Those are real people
// under real licences and replacing one with a synthesizer would be the worst
// outcome available here.
//
// Because it is all espeak, the engine can just SAY it. A registry entry with
// synthText synthesizes through engine/speech.js at play time — that is what the
// transit PA already does, and genre-kernel's press path already knows
// (`if(s.synthText) continue`). So this rewrites REGISTRY ENTRIES and nothing
// else: the ids stay, so every genre pool referencing them keeps working with no
// edit at all.
//
// `file:` is deliberately LEFT IN PLACE. synthText wins at resolve time, so the
// clip is inert — but it is also the revert path, and it is how the durSec below
// was measured.
//
// WHAT DOES NOT CONVERT, and why it matters: saytransit's 11 station voices are
// not plain espeak. They are a three-voice harmonized robot choir — root, a
// fifth above, an octave below, pitch-shifted with rubberband and mixed
// time-aligned. No combination of espeak pitch/speed reproduces that, so those
// stay pre-rendered rather than getting quietly downgraded to a single voice.
//
// THE HONEST CAVEAT for everything that does convert: the clips were baked with
// ffmpeg post-processing — asetrate resamples (pitch AND duration), telephone
// band-passes, loudnorm. espeak's own pitch/speed get close but not identical.
// This is a sound change, not a byte-for-byte swap.
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const RECIPE = path.join(ROOT, "tools", "fetch", "fetch-found-samples.sh");
const REGISTRY = path.join(ROOT, "engine", "registry-data.js");
const WRITE = process.argv.includes("--write");

// ---- parse the say* calls out of the fetch recipe --------------------------
// Each helper has its own signature; the shell is the source of truth for what
// every clip actually says and in whose voice.
const sh = fs.readFileSync(RECIPE, "utf8");
const args = (line) => {
  const out = []; let i = 0;
  while (i < line.length) {
    while (i < line.length && /\s/.test(line[i])) i++;
    if (i >= line.length || line[i] === "#") break;
    if (line[i] === '"') { let j = i + 1, s = ""; while (j < line.length && line[j] !== '"') { s += line[j] === "\\" ? line[++j] : line[j]; j++; } out.push(s); i = j + 1; }
    else { let j = i; while (j < line.length && !/\s/.test(line[j])) j++; out.push(line.slice(i, j)); i = j; }
  }
  return out;
};
const splitVoice = (v) => {                 // "en+m3" -> {voice:"en", variant:"m3"}
  const p = String(v || "en-us").split("+");
  return { voice: p[0] || "en-us", variant: p[1] || "" };
};

const CLIPS = {};   // basename (as it appears in file:"speech/<base>.mp3") -> spec
const HARMONIZED = new Set();
for (const raw of sh.split("\n")) {
  const line = raw.trim();
  const a = args(line);
  if (!a.length) continue;
  const fn = a[0];
  if (fn === "say" && a.length >= 5)
    CLIPS[a[1]] = { text: a[2], ...splitVoice("en-us"), pitch: +a[3], speed: +a[4] };
  else if (fn === "sayca" && a.length >= 5)
    CLIPS[a[1]] = { text: a[2], ...splitVoice("en-ca"), pitch: +a[3], speed: +a[4] };
  else if (fn === "saystation" && a.length >= 3)
    CLIPS[a[1]] = { text: a[2], voice: "en-us", variant: "f3", pitch: 38, speed: 148 };
  else if (fn === "sayg" && a.length >= 6)
    CLIPS[a[1]] = { text: a[2], ...splitVoice(a[3]), pitch: +a[4], speed: +a[5] };
  else if (fn === "sayhp" && a.length >= 6)
    CLIPS["hp_" + a[1]] = { text: a[2], ...splitVoice(a[3]), pitch: +a[4], speed: +a[5] };
  else if (fn === "saybud" && a.length >= 3)
    CLIPS["wd_" + a[1]] = { text: a[2], ...splitVoice("en+m3"), pitch: +(a[3] || 28), speed: +(a[4] || 118) };
  else if (fn === "saytransit" && a.length >= 3)
    HARMONIZED.add(a[1]);   // the three-voice choir — left pre-rendered on purpose
}
console.log(`recipe: ${Object.keys(CLIPS).length} convertible clips, ${HARMONIZED.size} harmonized (left alone)`);

// ---- rewrite the registry --------------------------------------------------
let src = fs.readFileSync(REGISTRY, "utf8");
let converted = 0, skippedHarmonized = 0, noRecipe = [];
const out = src.split("\n").map((line) => {
  const m = line.match(/^(\s*)(\w+)\s*:\s*\{(.*)\},\s*$/);
  if (!m) return line;
  const [, indent, id, body] = m;
  if (!/kind:\s*"speech"/.test(body)) return line;
  if (/synthText/.test(body)) return line;                     // already live
  const f = body.match(/file:\s*"speech\/([^"]+)\.mp3"/);
  if (!f) return line;
  const base = f[1];
  if (HARMONIZED.has(base)) { skippedHarmonized++; return line; }
  const spec = CLIPS[base];
  if (!spec) { noRecipe.push(id); return line; }
  const st = `synthText:{text:${JSON.stringify(spec.text)},voice:${JSON.stringify(spec.voice)}`
    + (spec.variant ? `,variant:${JSON.stringify(spec.variant)}` : "")
    + `,pitch:${spec.pitch},speed:${spec.speed}}`;
  converted++;
  // insert after kind so the entry reads file / kind / synthText / durSec
  return `${indent}${id}:{${body.replace(/kind:\s*"speech"/, `kind:"speech", ${st}`)}},`;
});

console.log(`  converted        ${converted}`);
console.log(`  harmonized kept  ${skippedHarmonized}`);
if (noRecipe.length) console.log(`  NO recipe line   ${noRecipe.length}: ${noRecipe.slice(0, 8).join(", ")}`);
if (!WRITE) { console.log("\n(dry run — pass --write)"); process.exit(0); }
fs.writeFileSync(REGISTRY, out.join("\n"));
console.log(`\n✓ rewrote engine/registry-data.js`);
