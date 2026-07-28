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
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");
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

// TRACKED markdown only, straight from git. Walking the filesystem instead
// swept in a nested worktree someone had left in the tree and failed on ITS
// copies of the docs — a checkout that is not part of this commit cannot make
// this commit wrong.
// Every exemption below is about the file's JOB, not about it being
// inconvenient: docs/history/ holds planning records, of their time;
// docs/MUSICALITY.md and docs/TIMING-AUDIT-* are logs of measurement runs whose
// numbers ("205 genres × 24 bars") record what a run actually measured and
// would become lies if rewritten to today's count; docs/TODO.md is a queue that
// quotes the very drift this gate exists to stop. Everything else is covered —
// including docs/ENGINE-AUDIT-*, which used to be exempt for no stated reason
// and passes without one.
const SKIP = [/^docs\/history\//, /^docs\/TODO\.md$/, /^docs\/MUSICALITY\.md$/,
              /^docs\/TIMING-AUDIT-/];
const files = execFileSync("git", ["-C", ROOT, "ls-files", "*.md"], { encoding: "utf8" })
  .split("\n").filter(Boolean).filter((rel) => !SKIP.some((r) => r.test(rel)));

// A line dates itself if it says so. "178 at the expansion's dawn" and "249 as
// of 2026-07-11" are fine. NOT on this list: a bare "was" or "then", which used
// to exempt any sentence containing either word — that is most sentences, and
// it is how "then consider groove. 247 genres…" walked straight through. A
// claim earns the exemption by naming its date, not by using a past tense.
const DATED = /\bas of\b|\bwhen this was written\b|\bat the (expansion|time)|\bdawn\b|\b20\d\d-\d\d/i;

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
const ANCHORS = /(?<![\d,])(\d{2,4})-genres?\b|(?<![\d,])(\d{2,4})\s+(?:anchors|genres|specs|target rows|verifier rows)\b/gi;
// The PAIR LATTICE: "274×273/2 pairs". This is a catalog-size claim wearing a
// different hat, and it is exactly the form that survived three sweeps of the
// prose ("249×248/2" outlived 249 by two expansions) because no rule looked for
// a number times another number. Both halves are checked: N and N-1.
const PAIRS = /(?<![\d,])(\d{2,4})\s*[×x*]\s*(\d{2,4})\s*\/\s*2\b/g;
// "N of M genres" — the DENOMINATOR is the catalog claim; the numerator is a
// subset ("247 of 274 had no push/pull") and is nobody's business here.
const OF_N = /(?<![\d,])\d{2,4}\s+(?:of|out of)\s+(?<![\d,])(\d{2,4})\s+(?:genres|anchors)\b/gi;

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
    PAIRS.lastIndex = 0;
    let p;
    while ((p = PAIRS.exec(line))) {
      const lo = Number(p[1]), hi = Number(p[2]);
      if (lo >= 100 && lo <= 999 && (lo !== GENRES || hi !== GENRES - 1)) {
        bad.push(`${rel}:${i + 1}  pair lattice ${lo}×${hi}/2 (real ${GENRES}×${GENRES - 1}/2) — ${line.trim().slice(0, 90)}`);
      }
    }
    OF_N.lastIndex = 0;
    let o;
    while ((o = OF_N.exec(line))) {
      const n = Number(o[1]);
      if (n && n !== GENRES && n >= 100 && n <= 999) {
        bad.push(`${rel}:${i + 1}  catalog total ${n} (real ${GENRES}) — ${line.trim().slice(0, 90)}`);
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
