#!/usr/bin/env node
// genre-specs.test.js — the spec folder must describe the genres that ship.
//
//   node test/genre-specs.test.js
//
// genre-specs/ was one-directional for its whole life: genre-tool wrote a spec
// when a genre was born, every later edit happened by hand in the kernel, and
// nothing was ever written back. The folder decayed exactly as you would
// predict — 135 files for 274 genres, 115 of them drifted from what shipped,
// and all 135 labels stale after a rename wave that never touched them. A spec
// folder that lies is worse than no spec folder, because people read it.
//
// `genre-tool.js export` is the missing direction. This gate is what stops the
// drift coming back: it re-derives every spec from the live kernel and asserts
// the folder ALREADY says that. Edit an anchor and forget to re-export, and
// this fails with the genre named.
//
//   node tools/genre-tool.js export --all      # the fix, when it fails
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const SPECS = path.join(ROOT, "genre-specs");
const K = require(path.join(ROOT, "engine", "genre-kernel.js"));

let fails = 0;
const gate = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) fails++;
};

const genres = Object.keys(K.GENRES);
const files = fs.readdirSync(SPECS).filter((f) => f.endsWith(".json"));

// 1. COVERAGE — one spec per genre, and no orphans describing genres that are gone.
const missing = genres.filter((g) => !fs.existsSync(path.join(SPECS, g + ".json")));
gate("every_genre_has_a_spec", missing.length === 0,
  missing.length ? `${missing.length} missing: ${missing.slice(0, 8).join(", ")}` : `${genres.length}/${genres.length}`);
const orphans = files.map((f) => f.replace(/\.json$/, "")).filter((n) => !K.GENRES[n]);
gate("no_orphan_specs", orphans.length === 0,
  orphans.length ? `${orphans.length} describe genres that no longer exist: ${orphans.join(", ")}` : `${files.length} files, all live`);

// 2. SHAPE — the keys every spec must carry, and the four that were retired.
// clips/materials/invented/damp are inert: GENRE_CLIPS is gone and nothing reads
// the other three, so a spec carrying them is describing machinery that does not
// exist — the same class of lie as a stale label.
const REQUIRED = ["name", "label", "info", "anchor"];
const RETIRED = ["clips", "materials", "invented", "damp"];
let badShape = [], carriesRetired = [], noNewline = [];
for (const f of files) {
  const raw = fs.readFileSync(path.join(SPECS, f), "utf8");
  if (!raw.endsWith("\n")) noNewline.push(f);
  let j; try { j = JSON.parse(raw); } catch (e) { badShape.push(f + " (unparseable: " + e.message + ")"); continue; }
  for (const k of REQUIRED) if (!(k in j)) badShape.push(f + " (no " + k + ")");
  if (j.name !== f.replace(/\.json$/, "")) badShape.push(f + " (name field is " + j.name + ")");
  for (const k of RETIRED) if (k in j) carriesRetired.push(f + ":" + k);
}
gate("spec_shape", badShape.length === 0, badShape.length ? badShape.slice(0, 5).join("; ") : `${files.length} specs carry ${REQUIRED.join("/")}`);
gate("no_retired_keys", carriesRetired.length === 0,
  carriesRetired.length ? carriesRetired.slice(0, 6).join(", ") : `none carry ${RETIRED.join("/")}`);
gate("trailing_newline", noNewline.length === 0, noNewline.length ? `${noNewline.length} without one` : `${files.length} end with a newline`);

// 3. ROUND-TRIP — the whole point. Re-derive from the live kernel and require the
// folder to already match, byte for byte. This is what makes the format
// bidirectional rather than a pile of receipts.
let drift = "(export did not run)";
let roundTrips = false;
try {
  const out = execFileSync("node", [path.join(ROOT, "tools", "genre-tool.js"), "export", "--all", "--dry-run"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const m = out.match(/export:\s*(\d+)\s+would change/);
  const changed = m ? +m[1] : -1;
  roundTrips = changed === 0;
  drift = changed === 0 ? `all ${genres.length} specs match the live kernel`
    : `${changed} spec(s) differ from the kernel — run: node tools/genre-tool.js export --all`;
} catch (e) { drift = "export failed: " + (e.stderr || e.message); }
gate("specs_round_trip", roundTrips, drift);

console.log(fails ? `\nGENRE-SPECS: FAIL (${fails})` : "\nGENRE-SPECS: PASS");
process.exit(fails ? 1 : 0);
