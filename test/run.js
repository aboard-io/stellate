#!/usr/bin/env node
// test/run.js — RUN A FOLDER OF GATES CONCURRENTLY.
//
//   node test/run.js browser          # test/browser + test/starcruise (needs chromium)
//   node test/run.js unit             # test/unit — pure node, nothing else runs these
//   node test/run.js all              # both
//   node test/run.js browser -j 4     # cap the concurrency by hand
//
// WHY THIS EXISTS. verify.sh has forked its 13 rows concurrently for a long time and
// finishes in ~40 s. The browser suite did not: `npm run test:browser` was a serial
// for-loop over 34 gates, and the slow ones are not close to cheap —
//
//   font-rotation 236s   journey-crash 232s   blend-arrival 202s   hold-verify 200s
//   starcruise    177s   transit-arrival 149s wavout        145s   crossfade-seam 132s
//
// — so a full pass took the better part of an hour, which means in practice nobody
// runs it and regressions are found by deploying. Nothing here was redundant; it was
// just queued. Run them concurrently and the wall clock collapses to roughly the
// slowest single gate.
//
// WHAT MADE THIS SAFE. Every gate stands up its own static server on a port it names.
// Serially that is fine; concurrently they collide. probe-harness's serve() now walks
// past a busy port and reports the one it got, and every gate reads srv.port — which
// was needed anyway (./serve.sh sits on 8791 all day and used to kill live.test.js
// with EADDRINUSE). Concurrency came free with that fix.
//
// The cap is CPU-derived and deliberately conservative: each browser gate drives a
// real chromium, several render WebGL through SwiftShader, and a couple boot the audio
// engine under a wall-clock watchdog. Oversubscribe and gates start failing for want
// of CPU rather than for cause — which is exactly how a green suite turns red and
// teaches everyone to ignore it.
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const argv = process.argv.slice(2);
const which = argv.find((a) => !a.startsWith("-")) || "all";
const jFlag = argv.indexOf("-j");
// browser gates are heavy (chromium + SwiftShader + audio watchdogs); pure-node ones
// are not, so they get a wider lane.
const HEAVY = Math.max(2, Math.min(6, (os.cpus().length >> 1) || 2));
const LIGHT = Math.max(2, Math.min(12, os.cpus().length - 1));

const listing = (dir) => {
  try {
    return fs.readdirSync(path.join(ROOT, dir))
      .filter((f) => f.endsWith(".test.js"))
      .map((f) => path.join(dir, f));
  } catch (e) { return []; }
};

// GATES THAT MEASURE WALL CLOCK RUN ALONE. Some gates assert THROUGHPUT — "the render
// kept up with realtime", "the crossfade cost fewer than N underrun quanta", "encode
// stayed inside its budget" — and throughput is exactly what concurrency destroys.
// This list is measured, not guessed. On this 4-core box, run two-up:
//
//   wavout-seam           render+encode 57.3% against a 33% budget   (solo: comfortable)
//   crossfade-seam        197 and 1738 underrun quanta, budget 34    (solo: passes)
//   live / live-resilience / sampler-inserts-live / wedge-demo       (solo: all pass)
//   nukernel-bounce       the carrier's offline render, asserted as a fraction of
//                         the song's own duration — three whole-song renders of a
//                         composed beatles song, measured end to end. Two of those
//                         renders already run three OfflineAudioContexts at once
//                         (audio/bounce.js PARALLEL), so this gate is a full box on
//                         its own and cannot share one.
//
// Every one of them passes serially and fails only for want of CPU. Letting that stand
// would be the worst outcome available: a suite that goes red without a defect is a
// suite people stop believing, and then it protects nothing. They are held back and run
// one at a time at the end; the fast majority still overlaps.
//
// CONSEQUENCE, STATED HONESTLY: on a small box most of the EXPENSIVE browser gates are
// in this list, so the browser suite's parallel win is modest — the real win is
// test/unit (33 gates, 2.4x, and nothing ran them before at all). A machine with more
// cores can shrink this list; it is a property of the hardware, not of the gates.
// anchored on a path boundary: a bare `live` alternative also swallows
// speech-live.test.js, which runs fine two-up and should stay in the fast lane.
// live-audit-throttled rides a CDP-throttled link and asserts an anomaly ceiling —
// the decode-vs-bar-clock races it measures are exactly what a busy box distorts.
const SOLO = /(^|\/)(wavout-seam|wavout|stem-parity|crossfade-seam|live|live-resilience|live-audit-throttled|sampler-inserts-live|wedge-demo|nukernel-bounce)\.test\.js$/;

const SETS = {
  browser: { files: [...listing("test/browser"), ...listing("test/starcruise")], jobs: HEAVY,
    note: "real chromium — needs `npm install && npm run setup:browser`" },
  unit: { files: listing("test/unit"), jobs: LIGHT, note: "pure node" },
};
SETS.all = { files: [...SETS.unit.files, ...SETS.browser.files], jobs: HEAVY, note: "everything" };

const set = SETS[which];
if (!set) { console.error(`usage: node test/run.js [browser|unit|all] [-j N]\n  unknown set: ${which}`); process.exit(2); }
const JOBS = jFlag >= 0 ? Math.max(1, +argv[jFlag + 1] || 1) : set.jobs;

if (!set.files.length) { console.error(`no gates found for "${which}"`); process.exit(2); }

// parallel first, then the wall-clock-sensitive ones alone at the end
const parallelFiles = set.files.filter((f) => !SOLO.test(f));
const soloFiles = set.files.filter((f) => SOLO.test(f));
console.log(`test/run: ${set.files.length} gates, ${JOBS} at a time` +
  (soloFiles.length ? ` (+${soloFiles.length} timed gate${soloFiles.length > 1 ? "s" : ""} run alone)` : "") +
  ` — ${set.note}`);
const started = Date.now();
const results = [];
let queue = parallelFiles.slice();
let phase = "parallel";
let next = 0, running = 0;

function launch() {
  const cap = phase === "solo" ? 1 : JOBS;
  while (running < cap && next < queue.length) {
    const file = queue[next++];
    running++;
    const t0 = Date.now();
    const out = [];
    const p = spawn(process.execPath, [file], { cwd: ROOT, env: process.env });
    p.stdout.on("data", (d) => out.push(d));
    p.stderr.on("data", (d) => out.push(d));
    p.on("close", (code) => {
      const secs = Math.round((Date.now() - t0) / 1000);
      const okRun = code === 0;
      results.push({ file, code, secs, log: Buffer.concat(out).toString() });
      console.log(`  ${okRun ? "PASS" : "FAIL"}  ${path.basename(file).padEnd(34)} ${String(secs).padStart(4)}s`);
      running--;
      launch();
      if (!running && next >= queue.length) {
        if (phase === "parallel" && soloFiles.length) {
          phase = "solo"; queue = soloFiles; next = 0;
          console.log(`  — timed gates, one at a time —`);
          launch();
        } else finish();
      }
    });
  }
}

function finish() {
  const bad = results.filter((r) => r.code !== 0);
  const wall = Math.round((Date.now() - started) / 1000);
  const serial = results.reduce((a, r) => a + r.secs, 0);
  console.log(`\ntest/run: ${results.length - bad.length}/${results.length} passed in ${wall}s ` +
    `(serial would be ${serial}s — ${(serial / Math.max(1, wall)).toFixed(1)}x)`);
  if (bad.length) {
    for (const b of bad) {
      console.log(`\n───── ${b.file} (exit ${b.code}) ─────`);
      console.log(b.log.split("\n").slice(-25).join("\n"));
    }
    process.exit(1);
  }
}

launch();
