#!/usr/bin/env node
// kernel-data-identity.test.js — the genre data must survive being moved.
//
//   node test/gates/kernel-data-identity.test.js
//
// Stage E1 lifts ~810 KB of inert data out of genre-kernel.js into generated
// classic scripts. The data is 99.8% literal, but a generator that round-trips
// through JSON can reorder keys, normalize -0 to 0, drop an `undefined`, or
// print 0.30000000000000004 for 0.3 — and determinism IS the product here:
// every seeded render, every fixture and the whole confusion matrix are
// downstream of these exact values in this exact order.
//
// So this compares the WORKING TREE's data against HEAD's, the way
// meter.test.js's head_byte_identity does. Before the split it is a no-op
// green. During the split it is the proof. Afterwards it self-heals on commit,
// so an intentional genre edit costs one commit rather than a re-baked
// fingerprint.
//
// THREE CHECKS, because they fail differently and a single hash cannot tell
// you which happened:
//   1. genre ORDER   — Object.keys(GENRES) drives the matrix row order and the
//                      star layout; a reordering is invisible to a sorted hash
//                      and catastrophic downstream.
//   2. exact bytes   — JSON.stringify of each registry, unsorted. Catches value
//                      drift AND within-anchor key reordering.
//   3. resolved behaviour — a few K.track() states, which is the only way to
//                      reach VOXBANK and PERCBANK (both module-private, so no
//                      serialization of the exports can see them).
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const HERE = __dirname, ROOT = path.join(HERE, "..", "..");
const J = (x) => JSON.stringify(x);
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

let failures = 0;
function gate(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
}

// The registries the split is allowed to move. Exported ones only — VOXBANK and
// PERCBANK are module-private and are covered by the behavioural check below.
const REGISTRIES = ["SOURCES", "SAMPLES", "SAMPLERS", "SOURCE_POOLS"];
// Deliberately spread across the kernel's shapes: a sampled anchor, an
// odd-meter one, a found/break-led one, and one of the corpus-tables reharm
// genres, so a data slip in any of those lanes surfaces here.
const TRACKS = [["jungle", 2], ["prelude", 3], ["blues", 1], ["gospel", 5], ["vaporwave", 7]];

function snapshot(K) {
  const out = { order: Object.keys(K.GENRES), genres: J(K.GENRES) };
  for (const r of REGISTRIES) out[r] = K[r] ? J(K[r]) : "ABSENT";
  out.tracks = TRACKS.map(([g, seed]) => {
    try { return J(K.track(g, { seed })); } catch (e) { return "THREW:" + e.message; }
  });
  return out;
}

// ---- HEAD, materialized into a temp dir (same approach as meter.test.js) ----
let headDir = null;
try {
  headDir = fs.mkdtempSync(path.join(os.tmpdir(), "kernel-data-"));
  fs.mkdirSync(path.join(headDir, "engine", "faust"), { recursive: true });
  // Whatever genre-kernel.js requires at load has to come along. Files absent
  // from HEAD are skipped rather than fatal: during the split the generated
  // data files exist in the working tree and not yet in HEAD, which is exactly
  // the state this gate is built to compare.
  const engine = ["genre-kernel.js", "csd-engine.js", "columns.js", "theory.js", "pipes.js",
                  "namebank.js", "speech.js", "genres-data.js", "registry-data.js"];
  for (const f of engine) {
    try {
      fs.writeFileSync(path.join(headDir, "engine", f),
        execFileSync("git", ["show", "HEAD:engine/" + f], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }));
    } catch (e) { /* not in HEAD — fine */ }
  }
  // dx7-presets.json lives at engine/faust/data/. An older HEAD may
  // predate the move, and the HEAD copy of genre-kernel.js requires whichever path
  // HEAD's tree used — so read from either and materialize BOTH.
  for (const rel of ["engine/faust/data/dx7-presets.json", "engine/faust/dx7-presets.json"]) {
    try {
      const presets = execFileSync("git", ["show", "HEAD:" + rel], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
      fs.mkdirSync(path.join(headDir, "engine", "faust", "data"), { recursive: true });
      fs.writeFileSync(path.join(headDir, "engine", "faust", "dx7-presets.json"), presets);
      fs.writeFileSync(path.join(headDir, "engine", "faust", "data", "dx7-presets.json"), presets);
      break;
    } catch (e) { /* optional */ }
  }
} catch (e) { headDir = null; }

const K1 = require(path.join(ROOT, "engine", "genre-kernel.js"));
const now = snapshot(K1);

console.log(`working tree: ${now.order.length} genres, GENRES ${now.genres.length} bytes (${sha(now.genres)})`);

if (!headDir) {
  console.log("SKIP  head_data_identity  (git/HEAD unavailable)");
} else {
  let K0 = null;
  try { K0 = require(path.join(headDir, "engine", "genre-kernel.js")); } catch (e) {
    console.log("SKIP  head_data_identity  (HEAD kernel would not load: " + e.message + ")");
  }
  if (K0) {
    const was = snapshot(K0);
    console.log(`HEAD:         ${was.order.length} genres, GENRES ${was.genres.length} bytes (${sha(was.genres)})`);

    // 1. ORDER
    const orderOk = J(was.order) === J(now.order);
    let orderDetail = `${now.order.length} genres in the same order`;
    if (!orderOk) {
      const add = now.order.filter((g) => !was.order.includes(g));
      const del = was.order.filter((g) => !now.order.includes(g));
      const moved = !add.length && !del.length;
      orderDetail = moved ? "SAME SET, DIFFERENT ORDER — the matrix rows and star layout move with it"
        : `added [${add.join(",")}] removed [${del.join(",")}]`;
    }
    gate("genre_order", orderOk, orderDetail);

    // 2. EXACT BYTES, per registry
    gate("genres_bytes", was.genres === now.genres,
      was.genres === now.genres ? `${sha(now.genres)} (${now.genres.length} bytes)`
        : `${sha(was.genres)} -> ${sha(now.genres)} — ${firstDiff(was.genres, now.genres)}`);
    for (const r of REGISTRIES) {
      gate("registry_" + r, was[r] === now[r],
        was[r] === now[r] ? `${sha(now[r])}` : `${sha(was[r])} -> ${sha(now[r])} — ${firstDiff(was[r], now[r])}`);
    }

    // 3. RESOLVED BEHAVIOUR — the only reach into VOXBANK/PERCBANK
    let drift = [];
    TRACKS.forEach(([g, seed], i) => { if (was.tracks[i] !== now.tracks[i]) drift.push(`${g}/s${seed}`); });
    gate("resolved_tracks", drift.length === 0,
      drift.length ? "state drift: " + drift.join(", ")
        : `${TRACKS.length} tracks byte-identical (reaches VOXBANK + PERCBANK)`);
  }
}

// Point at the first divergence rather than making someone diff 600 KB by eye.
function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0; while (i < n && a[i] === b[i]) i++;
  if (i === n && a.length === b.length) return "identical";
  const at = Math.max(0, i - 40);
  return `first diff at ${i}: …${a.slice(at, i + 40)}… vs …${b.slice(at, i + 40)}…`;
}

console.log(failures ? `\nKERNEL-DATA-IDENTITY: FAIL (${failures})` : "\nKERNEL-DATA-IDENTITY: PASS");
process.exit(failures ? 1 : 0);
