#!/usr/bin/env node
// faust/build/samplers-row.js — EMIT a registry-data.js `D.SAMPLERS` row for an
// instrument dir that already has zones on disk.
//
// WHY THIS EXISTS (2026-08-30, the registry lane). Eight FluidR3 SFX presets —
// gun_shot, helicopter, applause, telephone, bird_tweet, reverse_cymbal,
// breath_noise, fret_noise — were extracted by extract-gm.js months ago and have
// carried a `found/samples/instruments/<id>/zones.json` ever since, but no row in
// engine/registry-data.js, so `recipeFor` returned `unrouted` and no chair could
// be seated on one. The law is EXTRACTION, NEVER BY HAND: the row is a
// projection of zones.json, so this file performs the projection and prints the
// literal to splice, rather than a human copying nine numbers per zone out of a
// JSON file and into a one-line object.
//
// THE PROJECTION (measured off the committed rows, not asserted):
//     zones.json                     registry row
//     name .......................   label = name + " (FluidR3, MIT)"
//     <dirname> ..................   dir
//     sr .........................   sr
//     zones[].file/root/lo/hi ....   file/root/lo/hi verbatim
//     zones[].loop (bool) ........   loop 1|0
//     zones[].loopStart/loopEnd ..   ls/le
//     zones[].len ................   DROPPED — no committed row carries it
//                                    (123/123 measured; the decoder reads the
//                                    wav's own length, so a copy would be a
//                                    fact waiting to disagree)
//
// SELF-CHECK (`--check`): re-derives EVERY committed row from its own zones.json
// and reports which ones round-trip. 93 of 123 do; the other 30 are rows a human
// curated after extraction (a renamed `_fp` dir, thinned zones, a retuned root)
// and they are listed, not silently tolerated — a NEW row must round-trip
// exactly, which is what makes "extracted" checkable instead of claimed.
//
//   node engine/faust/build/samplers-row.js gun_shot helicopter ...
//   node engine/faust/build/samplers-row.js --check
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..", "..");
const BASE = path.join(ROOT, "found", "samples", "instruments");

function zonesOf(id) {
  const p = path.join(BASE, id, "zones.json");
  if (!fs.existsSync(p)) throw new Error("no zones.json for " + id + " (" + p + ")");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// the projection, as DATA (what a row's `zones` array must equal)
function zoneData(z) {
  return z.zones.map((x) => ({ file: x.file, root: x.root, lo: x.lo, hi: x.hi,
                               loop: x.loop ? 1 : 0, ls: x.loopStart, le: x.loopEnd }));
}
// the projection, as the SOURCE TEXT registry-data.js is written in
function rowText(id, label) {
  const z = zonesOf(id);
  const zs = zoneData(z).map((o) =>
    `{file:${JSON.stringify(o.file)},root:${o.root},lo:${o.lo},hi:${o.hi},loop:${o.loop},ls:${o.ls},le:${o.le}}`).join(",");
  const lab = label || (z.name + " (FluidR3, MIT)");
  return `    ${id}: { label:${JSON.stringify(lab)}, dir:${JSON.stringify(id)}, sr:${z.sr}, zones:[${zs}] },`;
}

module.exports = { rowText, zoneData, zonesOf };
if (require.main !== module) return;   // required as a library (test/sfx-shelf.test.js)

if (process.argv.includes("--check")) {
  const REG = require(path.join(ROOT, "engine", "registry-data.js"));
  const exact = [], curated = [];
  for (const [id, row] of Object.entries(REG.SAMPLERS)) {
    const built = JSON.stringify(zoneData(zonesOf(row.dir)));
    const have = JSON.stringify(row.zones.map((x) => ({ file: x.file, root: x.root, lo: x.lo,
      hi: x.hi, loop: x.loop ? 1 : 0, ls: x.ls, le: x.le })));
    (built === have ? exact : curated).push(id);
  }
  console.log(`round-trips exactly: ${exact.length}/${exact.length + curated.length}`);
  console.log(`curated after extraction (${curated.length}): ${curated.join(" ")}`);
  process.exit(0);
}

const ids = process.argv.slice(2);
if (!ids.length) { console.error("usage: samplers-row.js <id>... | --check"); process.exit(1); }
for (const id of ids) process.stdout.write(rowText(id) + "\n");
