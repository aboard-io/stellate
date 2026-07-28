#!/usr/bin/env node
// split-kernel-data.js — the ONE-TIME migration that lifted the inert data out
// of engine/genre-kernel.js (Stage E1).
//
//   node tools/build/split-kernel-data.js [--dry]
//
// Kept in the repo as the record of how the split was done, not as something to
// re-run: after it has run, genre-kernel.js no longer contains the literals, so
// a second run finds nothing and exits clean. engine/genres-data.js and
// engine/registry-data.js are the SOURCE OF TRUTH from then on — hand-edited,
// and spliced by genre-tool.js / invent-genres.js / rm-genre.js.
//
// WHY IT MOVES SOURCE TEXT AND NOT JSON. The obvious implementation is to load
// the kernel and JSON.stringify the objects. That is exactly the implementation
// that loses: JSON round-tripping reorders nothing today but normalizes -0 to 0,
// drops undefined, and reprints floats through the shortest-round-trip printer,
// so 0.30000000000000004 and 0.3 both come back as one of the two. Every seeded
// render and the whole confusion matrix are downstream of those bytes. So the
// migration brace-matches each literal in the SOURCE and moves the characters
// verbatim: whatever was there is what lands, byte for byte, and
// test/gates/kernel-data-identity.test.js proves it against HEAD.
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const KERNEL = path.join(ROOT, "engine", "genre-kernel.js");
const DRY = process.argv.includes("--dry");

// GENRES gets its own file (664 KB, the bulk); the registries share one.
const TO_GENRES = ["GENRES"];
const TO_REGISTRY = ["SOURCES", "SOURCE_POOLS", "SAMPLES", "VOXBANK", "SAMPLERS", "PERCBANK"];

const src = fs.readFileSync(KERNEL, "utf8");
const lines = src.split("\n");

// Find `  const NAME = {` … its matching close brace. Brace counting is enough
// here because the migration runs once, against a file we have just inspected:
// no literal in this kernel contains an unbalanced brace inside a string.
function findSpan(name) {
  const i = lines.findIndex((l) => new RegExp("^  const " + name + "\\s*=").test(l));
  if (i < 0) return null;
  let depth = 0, started = false;
  for (let j = i; j < lines.length; j++) {
    for (const ch of lines[j]) {
      if (ch === "{") { depth++; started = true; }
      else if (ch === "}") depth--;
    }
    if (started && depth === 0) return { start: i, end: j };
  }
  return null;
}

const spans = [];
for (const name of [...TO_GENRES, ...TO_REGISTRY]) {
  const s = findSpan(name);
  if (!s) { console.log(`  (${name} not inline — already split?)`); continue; }
  spans.push({ name, ...s, text: lines.slice(s.start, s.end + 1).join("\n") });
}
if (!spans.length) { console.log("nothing to split — genre-kernel.js carries no inline data blocks"); process.exit(0); }

// The literal text is `  const NAME = {...};` — re-head it as an assignment
// into the data module's namespace, keeping the body untouched.
const reHead = (sp) => sp.text.replace(/^  const (\w+)\s*=\s*/, "  D.$1 = ");

function emit(file, names, title, note, NS) {
  const body = spans.filter((s) => names.includes(s.name)).map(reHead).join("\n");
  const banner = `// ${path.basename(file)} — ${title}
//
// GENERATED ONCE by tools/build/split-kernel-data.js, and hand-edited ever since:
// this file is the SOURCE OF TRUTH for the data below, not a build artifact.
// genre-tool.js / invent-genres.js / rm-genre.js splice into it by the same
// /* genre-tool:<name>:genres */ markers they always used.
//
// ${note}
//
// Classic script on purpose, NOT JSON-over-fetch: app/entries/access.js and
// app/map/starmap.js read the kernel synchronously at module top level, so the data
// has to be present the moment genre-kernel.js runs. Loaded immediately BEFORE
// it in index.html / embed.html / access.html (test/gates/boot-smoke.test.js enforces order).
(function (root) {
  "use strict";
  const D = {};
${body}
  if (typeof module !== "undefined" && module.exports) module.exports = D;
  else root.${NS} = D;
})(typeof globalThis !== "undefined" ? globalThis : this);
`;
  if (!DRY) fs.writeFileSync(file, banner);
  console.log(`  ${DRY ? "would write" : "wrote"} ${path.relative(ROOT, file)}  ${(banner.length / 1024).toFixed(1)} KB`);
}

// ONE namespaced global each, rather than assigning the bare names onto window:
// GENRES / SOURCES / SAMPLES are far too generic to own on a shared page.
emit(path.join(ROOT, "engine", "genres-data.js"), TO_GENRES,
  "the 274 genre anchors",
  "Object.keys order is load-bearing: it drives the confusion-matrix row order and the star layout. Append, never reorder.",
  "__GENRES");
emit(path.join(ROOT, "engine", "registry-data.js"), TO_REGISTRY,
  "the found-sound, sample, instrument and percussion registries",
  "SOURCES / SOURCE_POOLS / SAMPLES / VOXBANK / SAMPLERS / PERCBANK — the ids the fetch recipes write and the engine resolves.",
  "__REGISTRY");

// Excise bottom-up so the earlier spans keep their line numbers.
let out = lines.slice();
for (const sp of spans.slice().sort((a, b) => b.start - a.start)) {
  out.splice(sp.start, sp.end - sp.start + 1, `  const ${sp.name} = DATA.${sp.name};`);
}
// Wire the data in, just after the engine handle the kernel already resolves.
const anchor = out.findIndex((l) => /const E = isNode \? require\("\.\/csd-engine\.js"\) : root\.CsdEngine;/.test(l));
if (anchor < 0) { console.error("could not find the engine-handle line to anchor the data require"); process.exit(1); }
out.splice(anchor + 1, 0,
  '  // THE DATA (Stage E1). 810 KB of inert literals live in generated classic',
  '  // scripts so this file stays a thing a person can read. Same synchronous',
  '  // contract as the engine handle above: present before the first statement',
  '  // that needs it, in node by require and in the browser by load order.',
  '  const DATA = isNode',
  '    ? Object.assign({}, require("./genres-data.js"), require("./registry-data.js"))',
  '    : Object.assign({}, root.__GENRES, root.__REGISTRY);');

if (!DRY) fs.writeFileSync(KERNEL, out.join("\n"));
const before = src.length, after = out.join("\n").length;
console.log(`  ${DRY ? "would shrink" : "shrank"} engine/genre-kernel.js  ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`);
console.log(`\nnow run: node test/gates/kernel-data-identity.test.js`);
