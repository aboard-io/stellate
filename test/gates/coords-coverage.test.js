#!/usr/bin/env node
// test/gates/coords-coverage.test.js — the STAR-CRUISE COORD/CLUSTER COMPLETENESS gate.
// Plain-node, no browser. Sibling of test/gates/pos-coverage.test.js.
//
// THE BUG THIS CATCHES (same class as the folk POS outage): a genre
// added to the kernel (GenreKernel.GENRES) but NOT regenerated into the
// star-cruise DATA modules. app/starcruise/genre-coords.js (GENRE_COORDS) places
// one planet per genre and derives blend weights from the camera's distance to
// each; app/starcruise/genre-clusters.js (CLUSTER_OF) maps every genre to its
// star. A genre missing from GENRE_COORDS has no planet to fly to (and the
// clusterer falls back to a SYNTHESIZED coord); a genre missing from CLUSTER_OF
// has no star system at all. Both are silent — the flight mode just can't see
// that genre. This gate makes it loud: regenerate via
//   node tools/build/feature-layout3d.js && node tools/build/cluster-genres.js
// whenever GENRES changes.
//
// It STATICALLY parses `export const GENRE_COORDS = {…}` and
// `export const CLUSTER_OF = {…}` (both are pure-data ES modules, but we regex
// the keys rather than import so this stays plain CommonJS + zero-eval) and
// requires EVERY Object.keys(GenreKernel.GENRES) to be present in BOTH. FAIL
// loudly, listing every missing genre per file, exit nonzero.
//
//   node test/gates/coords-coverage.test.js
//
// Wired into verify.sh (the "coordscover" row, next to poscover). Zero deps;
// consumes engine/genre-kernel.js + the two starcruise data modules read-only.
"use strict";
const fs = require("fs");
const path = require("path");
const K = require("../../engine/genre-kernel.js");

const COORDS = path.join(__dirname, "..", "..", "app", "starcruise", "genre-coords.js");
const CLUSTERS = path.join(__dirname, "..", "..", "app", "starcruise", "genre-clusters.js");

// Extract an object literal's body by brace-matching from `export const <NAME> = {`
// (or `<NAME>={`), so a stray brace in a comment/nested array can't fool a naive
// split. Returns the text between the outermost braces.
function objectBody(src, name, file) {
  const decl = new RegExp("export\\s+const\\s+" + name + "\\s*=\\s*\\{");
  const mm = decl.exec(src);
  if (!mm) throw new Error("coords-coverage: could not find `export const " + name + " = {` in " + file);
  const open = src.indexOf("{", mm.index);
  let depth = 0, end = -1;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") { if (--depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error("coords-coverage: unbalanced braces in " + name + " (" + file + ")");
  return src.slice(open + 1, end);
}

// Pull every top-level `key:` — key is a plain identifier or a quoted string,
// followed by a value (array literal for GENRE_COORDS, number for CLUSTER_OF).
// Comments never match `<key>:` at a value position so they stay inert.
function keysOf(body) {
  const keys = new Set();
  const re = /(?:^|[\s,{])(?:([A-Za-z_$][\w$]*)|"([^"]+)")\s*:\s*(?:\[|-?\d)/g;
  let m;
  while ((m = re.exec(body)) !== null) keys.add(m[1] || m[2]);
  return keys;
}

const coordsSrc = fs.readFileSync(COORDS, "utf8");
const clustersSrc = fs.readFileSync(CLUSTERS, "utf8");
const coords = keysOf(objectBody(coordsSrc, "GENRE_COORDS", COORDS));
const clusterOf = keysOf(objectBody(clustersSrc, "CLUSTER_OF", CLUSTERS));

const genres = Object.keys(K.GENRES);

const missingCoords = genres.filter((g) => !coords.has(g));
const missingCluster = genres.filter((g) => !clusterOf.has(g));

// stray entries (a genre removed from the kernel but left behind) don't break the
// flight mode — they're dead planets/stars. Report as a WARN, never fail on them.
const orphanCoords = [...coords].filter((g) => !K.GENRES[g]);
const orphanCluster = [...clusterOf].filter((g) => !K.GENRES[g]);

console.log(`coords-coverage — ${genres.length} runtime genres, ${coords.size} GENRE_COORDS, ${clusterOf.size} CLUSTER_OF`);
if (orphanCoords.length) console.log(`  WARN: ${orphanCoords.length} GENRE_COORDS entr${orphanCoords.length === 1 ? "y" : "ies"} not in GENRES (dead planets): ${orphanCoords.join(", ")}`);
if (orphanCluster.length) console.log(`  WARN: ${orphanCluster.length} CLUSTER_OF entr${orphanCluster.length === 1 ? "y" : "ies"} not in GENRES (dead stars): ${orphanCluster.join(", ")}`);

if (missingCoords.length || missingCluster.length) {
  if (missingCoords.length) {
    console.error(`\n  FAIL: ${missingCoords.length} genre${missingCoords.length === 1 ? "" : "s"} in GenreKernel.GENRES MISSING from app/starcruise/genre-coords.js GENRE_COORDS:`);
    for (const g of missingCoords) console.error(`      - ${g}`);
  }
  if (missingCluster.length) {
    console.error(`\n  FAIL: ${missingCluster.length} genre${missingCluster.length === 1 ? "" : "s"} in GenreKernel.GENRES MISSING from app/starcruise/genre-clusters.js CLUSTER_OF:`);
    for (const g of missingCluster) console.error(`      - ${g}`);
  }
  console.error(`\n  A missing genre has no planet to fly to / no star system. Regenerate:`);
  console.error(`      node tools/build/feature-layout3d.js && node tools/build/cluster-genres.js`);
  process.exit(1);
}

console.log(`  PASS: every runtime genre has a GENRE_COORDS planet and a CLUSTER_OF star. (${genres.length}/${genres.length})`);
process.exit(0);
