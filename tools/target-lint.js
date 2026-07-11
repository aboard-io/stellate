#!/usr/bin/env node
// target-lint.js — TARGET-range linter (ROADMAP §1.2.1).
//
// For each genre it compares the verifier target box V.TARGETS[g] (a set of
// {feature:[lo,hi,weight]} fences) to that genre's OWN measured render spread —
// the [min,max] of each feature over the persisted seed cloud (seeds 1..3, the
// same population genre-geometry / the matrix are built over). It then flags:
//
//   (a) EXCLUDES  — a fence that rejects the genre's own renders. If any own
//                   render's value falls outside [lo,hi] the box is scoring the
//                   genre against itself; this is a real bug in the target.
//   (b) SLACK     — a fence far wider than the genre's own spread, i.e. loose
//                   enough to admit rivals. Reported per side with a concrete
//                   `rivalsInSlack` count: how many OTHER genres' render points
//                   sit in the unused slack band [lo,ownMin) ∪ (ownMax,hi].
//
// For every fence it emits a suggested tightened box = own-spread ± margin
// (margin = 0.15·ownSpread + 0.03·boxWidth, lower bound clamped to 0 since all
// TARGETS lows are ≥0). By construction the suggested box always contains the
// genre's own [min,max], so applying it can never (a)-exclude the genre.
//
// READ-ONLY + OFFLINE + DETERMINISTIC. Reads only the persisted feature cache
// (verify-lib loadFeats); any missing (genre,seed) point is filled via the
// verifier's own V.features(K.track(...)) path — the SAME path that seeded the
// cache, so numbers are identical whether cached or fresh. Never mutates
// K.GENRES, never runs during a render, no Date.now / Math.random.
//
//   node tools/target-lint.js               lint all genres, print summary
//   node tools/target-lint.js <genre>       full per-fence report for one genre
//   node tools/target-lint.js <genre> --json    machine-readable one genre
//   node tools/target-lint.js --json        machine-readable all genres

"use strict";
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const K = require(path.join(ROOT, "engine", "genre-kernel.js"));
const V = require(path.join(ROOT, "engine", "genre-verifier.js"));
const L = require(path.join(ROOT, "engine", "verify-lib.js"));

// Seed set matches genre-geometry.js SEEDS / the matrix command: the geometry,
// the cache and this lint all judge the same render population.
const SEEDS = [1, 2, 3];
const EPS = 1e-9;

// genres carrying BOTH a target box and a kernel anchor (verifier scoredGenres).
function scoredGenres() {
  return Object.keys(V.TARGETS).filter((g) => K.GENRES[g]);
}

// (genre -> [featureVector per seed]). Cache-first, verifier-fallback (identical
// path), never persisted from here.
let _cache = null;
function points(g) {
  if (!_cache) _cache = (L && L.loadFeats) ? L.loadFeats() : {};
  return SEEDS.map((s) => _cache[g + ":" + s] || V.features(K.track(g, { seed: s })));
}

// numeric own-spread of feature f over a point set.
function spread(pts, f) {
  const vs = pts.map((p) => p[f]).filter((x) => typeof x === "number");
  if (!vs.length) return null;
  return { min: Math.min(...vs), max: Math.max(...vs), n: vs.length };
}

function round(x, f) {
  if (f === "bpm") return Math.round(x);
  return Math.round(x * 1000) / 1000;
}

// Every OTHER genre's render points, cached across the run for rival counting.
let _rivalPts = null;
function rivalPointsExcluding(g) {
  if (!_rivalPts) {
    _rivalPts = {};
    for (const gg of scoredGenres()) _rivalPts[gg] = points(gg);
  }
  const out = [];
  for (const gg of scoredGenres()) if (gg !== g) for (const p of _rivalPts[gg]) out.push(p);
  return out;
}

// Lint one genre -> { genre, fences:[...], flagsA, flagsB }.
function lintGenre(g) {
  const T = V.TARGETS[g];
  if (!T) throw new Error("no target box for genre: " + g);
  if (!K.GENRES[g]) throw new Error("no kernel anchor for genre: " + g);
  const pts = points(g);
  const fences = [];
  let flagsA = 0, flagsB = 0;
  let rivals = null; // lazy, only when a slack fence needs a rival count

  for (const f of Object.keys(T)) {
    const [lo, hi, weight] = T[f];
    const sp = spread(pts, f);
    if (!sp) continue; // non-numeric / absent feature — nothing measurable
    const boxWidth = hi - lo;
    const ownSpread = sp.max - sp.min;

    // (a) does the box reject the genre's own renders?
    const excludeLo = sp.min < lo - EPS ? lo - sp.min : 0; // own dips this far below lo
    const excludeHi = sp.max > hi + EPS ? sp.max - hi : 0; // own rises this far above hi
    const flagA = excludeLo > 0 || excludeHi > 0;

    // suggested tightened box = own ± margin (never excludes own by construction).
    const margin = 0.15 * ownSpread + 0.03 * (boxWidth > 0 ? boxWidth : Math.abs(sp.max) || 1);
    let sugLo = sp.min - margin;
    let sugHi = sp.max + margin;
    if (lo >= 0) sugLo = Math.max(0, sugLo); // all TARGETS lows are ≥0

    // (b) slack: how far each current bound sits beyond own-spread+margin, as a
    // fraction of the box. >20% of the box unused on a side ⇒ loose fence.
    const slackBelow = boxWidth > 0 ? Math.max(0, sugLo - lo) : 0;
    const slackAbove = boxWidth > 0 ? Math.max(0, hi - sugHi) : 0;
    const fracBelow = boxWidth > 0 ? slackBelow / boxWidth : 0;
    const fracAbove = boxWidth > 0 ? slackAbove / boxWidth : 0;
    const flagB = fracBelow > 0.2 || fracAbove > 0.2;

    let rivalsBelow = 0, rivalsAbove = 0;
    if (flagB) {
      if (!rivals) rivals = rivalPointsExcluding(g);
      for (const p of rivals) {
        const v = p[f];
        if (typeof v !== "number") continue;
        if (v >= lo - EPS && v < sp.min - EPS) rivalsBelow++;      // in [lo, ownMin)
        else if (v > sp.max + EPS && v <= hi + EPS) rivalsAbove++; // in (ownMax, hi]
      }
    }

    if (flagA) flagsA++;
    if (flagB) flagsB++;

    fences.push({
      feature: f, weight,
      box: [round(lo, f), round(hi, f)],
      own: [round(sp.min, f), round(sp.max, f)],
      flagA, excludeLo: round(excludeLo, f), excludeHi: round(excludeHi, f),
      flagB, slackBelow: round(slackBelow, f), slackAbove: round(slackAbove, f),
      fracBelow: Math.round(fracBelow * 100) / 100, fracAbove: Math.round(fracAbove * 100) / 100,
      rivalsBelow, rivalsAbove,
      suggest: [round(sugLo, f), round(sugHi, f), weight],
    });
  }
  return { genre: g, seeds: SEEDS, fences, flagsA, flagsB };
}

// ---- rendering ----------------------------------------------------------
function fmtGenre(rep) {
  const L2 = [];
  L2.push(`target-lint: ${rep.genre}  (seeds ${rep.seeds.join(",")})`);
  L2.push(`  ${rep.flagsA} exclude-flag(s), ${rep.flagsB} slack-flag(s) over ${rep.fences.length} fence(s)`);
  for (const fe of rep.fences) {
    const tags = [];
    if (fe.flagA) tags.push("EXCLUDES");
    if (fe.flagB) tags.push("SLACK");
    const tag = tags.length ? "  [" + tags.join(",") + "]" : "";
    L2.push(`  ${fe.feature.padEnd(13)} box[${fe.box[0]}, ${fe.box[1]}]  own[${fe.own[0]}, ${fe.own[1]}]${tag}`);
    if (fe.flagA) {
      const parts = [];
      if (fe.excludeLo > 0) parts.push(`own dips ${fe.excludeLo} below lo`);
      if (fe.excludeHi > 0) parts.push(`own rises ${fe.excludeHi} above hi`);
      L2.push(`      (a) ${parts.join("; ")}`);
    }
    if (fe.flagB) {
      const parts = [];
      if (fe.slackBelow > 0) parts.push(`${fe.slackBelow} below (${Math.round(fe.fracBelow * 100)}% of box, ${fe.rivalsBelow} rival pts)`);
      if (fe.slackAbove > 0) parts.push(`${fe.slackAbove} above (${Math.round(fe.fracAbove * 100)}% of box, ${fe.rivalsAbove} rival pts)`);
      L2.push(`      (b) slack ${parts.join("; ")}`);
    }
    if (fe.flagA || fe.flagB) {
      L2.push(`      -> suggest [${fe.suggest[0]}, ${fe.suggest[1]}]  (weight ${fe.suggest[2]})`);
    }
  }
  return L2.join("\n");
}

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes("--json");
  const genre = argv.find((a) => !a.startsWith("--"));

  if (genre) {
    if (!V.TARGETS[genre]) { console.error("unknown genre (no target box): " + genre); process.exit(2); }
    const rep = lintGenre(genre);
    console.log(asJson ? JSON.stringify(rep, null, 2) : fmtGenre(rep));
    return;
  }

  // all genres
  const reps = scoredGenres().map(lintGenre);
  if (asJson) { console.log(JSON.stringify(reps, null, 2)); return; }
  const withA = reps.filter((r) => r.flagsA > 0);
  const withB = reps.filter((r) => r.flagsB > 0);
  const totA = reps.reduce((s, r) => s + r.flagsA, 0);
  const totB = reps.reduce((s, r) => s + r.flagsB, 0);
  console.log(`target-lint: ${reps.length} genres, seeds ${SEEDS.join(",")}`);
  console.log(`  (a) EXCLUDES : ${withA.length} genres, ${totA} fences reject their own renders`);
  console.log(`  (b) SLACK    : ${withB.length} genres, ${totB} fences wider than own-spread+margin`);
  console.log("");
  console.log("genres with (a) exclude-flags (fix these first):");
  for (const r of withA.sort((x, y) => y.flagsA - x.flagsA)) {
    const feats = r.fences.filter((f) => f.flagA).map((f) => f.feature).join(", ");
    console.log(`  ${r.genre.padEnd(16)} ${r.flagsA}  (${feats})`);
  }
  console.log("");
  console.log("run  node tools/target-lint.js <genre>  for per-fence detail + suggestions");
}

if (require.main === module) main();
module.exports = { lintGenre, scoredGenres, SEEDS };
