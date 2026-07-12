#!/usr/bin/env node
// pos-coverage.js — the STAR-MAP POS COMPLETENESS gate. Plain-node, no browser.
//
// THE BUG THIS CATCHES (prod outage 2026-07-11): a genre added to the kernel
// (GenreKernel.GENRES) but NOT to app/world.js POS. app/main.js boot() runs
// app/starmap.js computeGenreLayout(), which EARLY-RETURNS only when POS already
// covers every GENRES key; a single missing genre drops it into the O(N²)·N·40
// force-directed relaxation at module-eval — which under the real boot collapses
// the layout and CRASHES the WebGL renderer (blank app, no 🛸). The star-cruise
// headless probes stub app/main.js, so nothing symbolic caught it. This gate does.
//
// It parses app/world.js's `export const POS={...}` STATICALLY (world.js is an ES
// module that also imports nothing runnable under plain node, so we regex the POS
// keys rather than import it) and requires EVERY Object.keys(GenreKernel.GENRES)
// to be present. FAIL loudly, listing every missing genre, exit nonzero.
//
//   node test/pos-coverage.js
//
// Wired into verify.sh (the "poscover" row). Zero deps; consumes engine/
// genre-kernel.js + app/world.js read-only, so new genres are covered on land.
"use strict";
const fs = require("fs");
const path = require("path");
const K = require("../engine/genre-kernel.js");

const WORLD = path.join(__dirname, "..", "app", "world.js");

// Extract the POS object body by brace-matching from `export const POS={` so a
// stray brace in a comment can't fool a naive split. Then pull every top-level
// `identifier:[` key — genre keys are plain identifiers assigned array literals;
// comments never match `<ident>:[` so they're inert.
function posKeys(src) {
  const start = src.indexOf("export const POS={");
  if (start < 0) throw new Error("pos-coverage: could not find `export const POS={` in " + WORLD);
  const open = src.indexOf("{", start);
  let depth = 0, end = -1;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") { if (--depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error("pos-coverage: unbalanced braces in POS object");
  const body = src.slice(open + 1, end);
  const keys = new Set();
  const re = /(^|[\s,{])([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\[/g;
  let m;
  while ((m = re.exec(body)) !== null) keys.add(m[2]);
  return keys;
}

const src = fs.readFileSync(WORLD, "utf8");
const pos = posKeys(src);
const genres = Object.keys(K.GENRES);

const missing = genres.filter((g) => !pos.has(g));
// stray POS entries (a genre removed from the kernel but left in POS) don't crash
// boot, but they're dead map stars — report as a WARN, never fail on them.
const orphans = [...pos].filter((g) => !K.GENRES[g]);

console.log(`pos-coverage — ${genres.length} runtime genres, ${pos.size} POS entries`);
if (orphans.length) console.log(`  WARN: ${orphans.length} POS entr${orphans.length === 1 ? "y" : "ies"} not in GENRES (dead stars): ${orphans.join(", ")}`);

if (missing.length) {
  console.error(`\n  FAIL: ${missing.length} genre${missing.length === 1 ? "" : "s"} in GenreKernel.GENRES MISSING from app/world.js POS:`);
  for (const g of missing) console.error(`      - ${g}`);
  console.error(`\n  A missing genre drops app boot into computeGenreLayout's relaxation and`);
  console.error(`  CRASHES the renderer. Add each above to app/world.js POS (see`);
  console.error(`  docs/ADDING-A-GENRE.md — re-bake: boot the app, copy window.__X.POS back).`);
  process.exit(1);
}

console.log(`  PASS: every runtime genre has a POS entry.`);
process.exit(0);
