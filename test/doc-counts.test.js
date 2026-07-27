#!/usr/bin/env node
// doc-counts.test.js — the docs must not lie about how big the space is.
//
// The anchor count has been wrong in the docs three times over (228, 240, 249
// while the kernel said something else), and it drifts silently because nothing
// reads it. CONTRIBUTING.md once said 274 and 249 twenty-eight lines apart, and
// the PR template asked every contributor to confirm a matrix size that had not
// existed for months — the first thing an outside contributor saw.
//
// So: any markdown that states the anchor count, or a "<N>/<N> diagonal
// dominant" matrix size, must state the REAL one. The real one is read from the
// kernel, never hardcoded here.
//
// Deliberately NOT checked: docs/history/ (dated records, allowed to be of their
// time) and any line that dates itself — "178 at the expansion's dawn" is true
// and useful. The rule is about claims in the present tense.
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
global.window = global;
require(path.join(ROOT, "engine/theory.js"));
require(path.join(ROOT, "engine/pipes.js"));
require(path.join(ROOT, "engine/csd-engine.js"));
const K = require(path.join(ROOT, "engine/genre-kernel.js"));
const V = require(path.join(ROOT, "engine/genre-verifier.js"));

const GENRES = Object.keys(K.GENRES).length;
const TARGETS = Object.keys(V.TARGETS || {}).length;

let failed = 0;
const fail = (msg) => { console.log("FAIL  " + msg); failed = 1; };
const pass = (msg) => console.log("PASS  " + msg);

// 0) the two catalogs must agree with each other before we police the prose
if (GENRES !== TARGETS) fail(`kernel/verifier disagree: ${GENRES} GENRES vs ${TARGETS} TARGETS`);
else pass(`catalogs agree — ${GENRES} anchors, ${GENRES} verifier target rows`);

// walk tracked markdown, skipping the places history is allowed to live
const SKIP = [/^docs\/history\//, /^docs\/TODO\.md$/, /^docs\/MUSICALITY\.md$/,
              /^docs\/ENGINE-AUDIT-/, /^docs\/TIMING-AUDIT-/, /^verifier-catalog\//,
              /^node_modules\//, /^found\//];
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === ".git" || e.name === "node_modules" || e.name === "found") continue;
    const p = path.join(dir, e.name);
    const rel = path.relative(ROOT, p);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".md") && !SKIP.some((r) => r.test(rel))) out.push(rel);
  }
  return out;
}
const files = walk(ROOT, []);

// A line dates itself if it says so. "178 at the expansion's dawn", "249 as of
// 2026-07-11" and "(the space's size when this was written)" are all fine.
const DATED = /\bas of\b|\bwhen this was written\b|\bthen\b|\bat the (expansion|time)|\bdawn\b|\bwas\b|\b20\d\d-\d\d/i;

// "N/N" next to diagonal/dominant/matrix language. Both halves must be the real
// count; "201/274 of the reharm genres" is a SUBSET ratio and never appears with
// this vocabulary, so it does not trip.
const MATRIX = /\b(\d{2,4})\s*[\/×x]\s*(\d{2,4})\b(?=[^\n]{0,40}(diagonal|dominant|matrix))/gi;
const MATRIX_PRE = /(diagonal[- ]dominant|diagonal dominant|confusion matrix)[^\n]{0,40}?\b(\d{2,4})\s*[\/×x]\s*(\d{2,4})\b/gi;
// Space-size claims only, in the two forms the docs actually use: the compound
// adjective "274-genre space", and the spaced plural "274 anchors"/"274 genres".
// Not matched, on purpose: "1,140 anchor resolutions" and "822 genre×seed rows"
// (singular, and counts of something else), and any number glued to a digit or
// comma, which is how a grouped thousand leaked in as a false hit.
const ANCHORS = /(?<![\d,])(\d{2,4})-genres?\b|(?<![\d,])(\d{2,4})\s+(?:anchors|genres)\b/gi;

const bad = [];
for (const rel of files) {
  const text = fs.readFileSync(path.join(ROOT, rel), "utf8").split("\n");
  text.forEach((line, i) => {
    if (DATED.test(line)) return;
    for (const re of [MATRIX, MATRIX_PRE]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) {
        const nums = m.slice(1).filter((x) => /^\d+$/.test(x)).map(Number);
        for (const n of nums) {
          if (n !== GENRES && n >= 100 && n <= 999) {
            bad.push(`${rel}:${i + 1}  matrix size ${n} (real ${GENRES}) — ${line.trim().slice(0, 90)}`);
          }
        }
      }
    }
    ANCHORS.lastIndex = 0;
    let a;
    while ((a = ANCHORS.exec(line))) {
      const n = Number(a[1] || a[2]);
      if (n && n !== GENRES && n >= 100 && n <= 999) {
        bad.push(`${rel}:${i + 1}  anchor count ${n} (real ${GENRES}) — ${line.trim().slice(0, 90)}`);
      }
    }
  });
}

if (bad.length) {
  fail(`${bad.length} stale count claim(s) in present-tense prose:`);
  for (const b of bad) console.log("        " + b);
  console.log("      (a line that dates itself — 'as of', a date, 'when this was written' — is exempt)");
} else {
  pass(`${files.length} markdown files carry no stale anchor/matrix counts`);
}

console.log(failed ? "\nDOC-COUNTS: FAIL" : "\nDOC-COUNTS: PASS");
process.exit(failed);
