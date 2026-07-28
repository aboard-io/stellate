#!/usr/bin/env node
// margin-sentinel.js — the fragile-margin regression tripwire (ROADMAP §1.2.3).
//
// validate-genres.js gate 3 (gateDominanceAndMargin) computes, per scored
// genre, the mean self-score-minus-best-rival "separation margin". A genre can
// still WIN every seed (matrix stays 249/249) while its margin quietly erodes
// toward the tie line — the exact failure the aggregate win-rate gate can't see
// until it's too late. This module freezes a COMMITTED baseline of those
// margins (test/lib/margin-baseline.json) and WARNs when any margin regresses
// beyond a delta versus the baseline, catching the erosion one edit at a time.
//
//   node margin-sentinel.js check              recompute + diff vs baseline
//   node margin-sentinel.js check --delta 1.5  custom regression tolerance (pts)
//   node margin-sentinel.js --update-baseline  re-capture the committed baseline
//   node margin-sentinel.js capture            alias for --update-baseline
//   node margin-sentinel.js print              print current margins, no diff
//     [--seeds 1,2,3] [--json]
//
// Margins are computed exactly as gate 3 does (V.scoreAgainst self vs best
// rival, mean over seeds, rounded 2dp), over a FIXED seed set stored in the
// baseline (default 1,2,3 — the fully-cached set) so the reference is
// reproducible regardless of how validate-genres is invoked (--seeds varies).
// Feature vectors come from the persisted verify cache first, falling back to a
// deterministic K.track + V.features build for any (genre,seed) not cached.
//
// Zero deps; READ-ONLY (never mutates GENRES or renders). Deterministic:
// same tree + same seeds -> identical margins, no Date.now/Math.random.

"use strict";
const fs = require("fs");
const path = require("path");
const K = require("../genre-kernel.js");
const V = require("../genre-verifier.js");
const L = require("../verify-lib.js");

const BASELINE = path.join(__dirname, "..", "..", "test", "lib", "margin-baseline.json");
const DEFAULT_SEEDS = [1, 2, 3];
const DEFAULT_DELTA = 1.0;   // points a margin may drop before it WARNs

// gate 3's rounding, verbatim: +fmt(mean, 2)
const round2 = (x) => +(Math.round(x * 100) / 100).toFixed(2);

// The scored universe = anchors with verifier target ranges (gate 2-5's set).
function scoredGenres() {
  return Object.keys(K.GENRES).filter((g) => V.TARGETS[g]);
}

// Feature vector for (genre, seed): persisted cache first, then a deterministic
// live build. `feats` is a mutable in-run cache shared across the call.
function featOf(g, seed, disk, feats) {
  const key = g + ":" + seed;
  if (key in feats) return feats[key];
  if (disk && key in disk) return (feats[key] = disk[key]);
  let f = null;
  try { f = V.features(K.track(g, { seed })); } catch (e) { f = null; }
  return (feats[key] = f);
}

// Per-genre mean separation margin, computed EXACTLY as gate 3
// (gateDominanceAndMargin): self-score minus best-rival score, mean over seeds.
// Returns { margins:{g:num}, seeds, genres, missing:[{genre,seed}] }.
function computeMargins(opts) {
  opts = opts || {};
  const seeds = opts.seeds || DEFAULT_SEEDS;
  const disk = opts.noCache ? {} : (opts.disk || L.loadFeats());
  const feats = opts.feats || {};
  const genres = scoredGenres();
  const margins = {};
  const missing = [];
  for (const g of genres) {
    const ms = [];
    for (const seed of seeds) {
      const f = featOf(g, seed, disk, feats);
      if (!f) { missing.push({ genre: g, seed }); continue; }
      let self = null, bestOther = -1;
      for (const tgt of genres) {
        const s = V.scoreAgainst(f, tgt).score;
        if (tgt === g) self = s;
        else if (s > bestOther) bestOther = s;
      }
      if (self != null) ms.push(self - bestOther);
    }
    const mean = ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : 0;
    margins[g] = round2(mean);
  }
  return { margins, seeds, genres, missing };
}

// Capture (or re-capture) the committed baseline. Deterministic; mirrors
// test/lib/fixtures.js capture. Writes { seeds, delta, count, margins }.
function captureBaseline(opts) {
  opts = opts || {};
  const seeds = opts.seeds || DEFAULT_SEEDS;
  const delta = opts.delta != null ? opts.delta : DEFAULT_DELTA;
  const { margins, missing } = computeMargins({ seeds, noCache: opts.noCache });
  const payload = {
    seeds,
    delta,
    count: Object.keys(margins).length,
    margins,
  };
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
  fs.writeFileSync(BASELINE, JSON.stringify(payload, null, 1) + "\n");
  return { path: BASELINE, count: payload.count, seeds, missing };
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE)) return null;
  return JSON.parse(fs.readFileSync(BASELINE, "utf8"));
}

// The clean function for later wiring into validate-genres gate 3.
//   check({ margins, delta, seeds, baseline }) -> {
//     status: "PASS"|"WARN"|"SKIP",
//     regressions: [{ genre, baseline, current, drop, delta }],  // drop = base-cur
//     newGenres: [g...],       // present now, absent from baseline (info)
//     droppedGenres: [g...],   // in baseline, missing now (info)
//     improved: n, delta, seeds, note?
//   }
// Pass `margins` (e.g. result.gates.margin.margins) to skip recomputation when
// the caller already has them; otherwise the sentinel computes them itself.
function check(opts) {
  opts = opts || {};
  const baseline = opts.baseline || loadBaseline();
  if (!baseline) {
    return { status: "SKIP", note: "no baseline at " + BASELINE + " — run --update-baseline", regressions: [] };
  }
  const seeds = opts.seeds || baseline.seeds || DEFAULT_SEEDS;
  const delta = opts.delta != null ? opts.delta : (baseline.delta != null ? baseline.delta : DEFAULT_DELTA);
  const current = opts.margins || computeMargins({ seeds }).margins;

  const regressions = [], newGenres = [], droppedGenres = [];
  let improved = 0;
  for (const [g, base] of Object.entries(baseline.margins)) {
    if (!(g in current)) { droppedGenres.push(g); continue; }
    const cur = current[g];
    const drop = round2(base - cur);
    if (drop > delta) regressions.push({ genre: g, baseline: base, current: cur, drop, delta });
    else if (cur > base) improved++;
  }
  for (const g of Object.keys(current)) if (!(g in baseline.margins)) newGenres.push(g);
  regressions.sort((a, b) => b.drop - a.drop);
  const status = regressions.length ? "WARN" : "PASS";
  return { status, regressions, newGenres, droppedGenres, improved, delta, seeds,
    checked: Object.keys(baseline.margins).length };
}

module.exports = { computeMargins, captureBaseline, loadBaseline, check, BASELINE, DEFAULT_SEEDS, DEFAULT_DELTA };

// ---------- CLI ----------
if (require.main === module) {
  const argv = process.argv.slice(2);
  const has = (f) => argv.includes(f);
  const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  const JSON_OUT = has("--json");
  const seedsArg = val("--seeds", null);
  const seeds = seedsArg ? seedsArg.split(",").map((s) => parseInt(s, 10)).filter((n) => n > 0) : null;
  const deltaArg = val("--delta", null);
  const delta = deltaArg != null ? parseFloat(deltaArg) : null;
  const mode = argv.find((a) => !a.startsWith("--") && a !== seedsArg && a !== deltaArg) || "check";

  if (mode === "capture" || has("--update-baseline")) {
    const r = captureBaseline({ seeds, delta });
    if (JSON_OUT) { console.log(JSON.stringify(r, null, 2)); }
    else {
      console.log(`captured baseline: ${r.count} genre margins (seeds ${r.seeds.join(",")}) -> ${r.path}`);
      if (r.missing.length) console.log(`  (${r.missing.length} genre×seed feature builds fell back to live track)`);
    }
    process.exit(0);
  }

  if (mode === "print") {
    const { margins, seeds: sd } = computeMargins({ seeds });
    if (JSON_OUT) { console.log(JSON.stringify({ seeds: sd, margins }, null, 2)); }
    else {
      const rows = Object.entries(margins).sort((a, b) => a[1] - b[1]);
      console.log(`margins (seeds ${sd.join(",")}), tightest first:`);
      rows.slice(0, 15).forEach(([g, m]) => console.log(`  ${m >= 0 ? "+" : ""}${m}  ${g}`));
      console.log(`  ... ${rows.length} genres total`);
    }
    process.exit(0);
  }

  // default: check
  const r = check({ seeds, delta });
  if (JSON_OUT) { console.log(JSON.stringify(r, null, 2)); process.exit(r.status === "WARN" ? 1 : 0); }
  if (r.status === "SKIP") { console.log(`[SKIP] margin sentinel — ${r.note}`); process.exit(0); }
  console.log(`[${r.status}] margin sentinel — ${r.checked} genres, seeds ${r.seeds.join(",")}, delta ${r.delta}pt`);
  if (r.regressions.length) {
    r.regressions.forEach((x) =>
      console.log(`       x ${x.genre}: margin ${x.baseline} -> ${x.current} (dropped ${x.drop}, > ${x.delta})`));
  } else {
    console.log(`       no regressions (${r.improved} improved, ${r.newGenres.length} new, ${r.droppedGenres.length} dropped)`);
  }
  if (r.newGenres.length) console.log(`       ~ new (no baseline yet): ${r.newGenres.join(", ")}`);
  if (r.droppedGenres.length) console.log(`       ~ dropped (in baseline, gone now): ${r.droppedGenres.join(", ")}`);
  process.exit(r.status === "WARN" ? 1 : 0);
}
