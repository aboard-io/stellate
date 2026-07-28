#!/usr/bin/env node
// test/gates/live-walk-parity.test.js — THE SEAM GATE (docs/TIMING-AUDIT-2026-07 finding 1).
//
//   node test/gates/live-walk-parity.test.js [--bars 24] [--all] [--verbose]
//
// The hole this closes, in the audit's own words: "test/unit/segment-parity.test.js
// proves worker-rendered segments equal the press bytes WITHIN one generation.
// Nothing anywhere compares the LIVE per-bar walk's event stream to the PRESS
// event stream over a boundary. The gate tests inside a unit, never across the
// join."
//
// WHAT GOES WRONG (measured). faust/live.js makeWalk regenerates the
// WHOLE collapsed section every chord bar with a DIFFERENT seed and slices one
// half-open beat window out of it, while faust/state-engine.mapEvents windowed on
// the POST-groove beat. An event sitting ON a chord-bar boundary therefore lived in
// two generations that had each drawn their humanize jitter INDEPENDENTLY:
//
//     bar k-1 plays it iff its copy jittered to beat <  L
//     bar k   plays it iff its copy jittered to beat >= L
//
// Two independent symmetric draws => 25% neither bar plays it, 25% both do. Replayed
// over 205 genres that measured kick 24.5% LOST / 25.2% DOUBLED, pad 26.8/22.5,
// bass 27.2/24.8 — a coin flip on the single most structurally important hit in the
// bar, re-flipped at every chord change, LIVE ONLY (press generates the whole song
// in one pass, so the export never had it and never showed it).
//
// THE INVARIANT THIS GATE ASSERTS: across a chord-bar join, every event fires
// EXACTLY ONCE. Deliberately black-box — it identifies the boundary events from
// their PLAYED beats and the state's own declared groove bounds (humanize·0.04 +
// pushPull), never from the `beat0` field the fix introduced, so it measures the
// behaviour and not the implementation, and it bites on any future scheme too.
//
// GATE A  seam_exactly_once   — for every structural event on an interior chord-bar
//                               boundary, the two adjacent generations' windows
//                               between them emit it once. 0 lost, 0 doubled.
// GATE B  window_partition    — within ONE generation, the nch chord-bar windows of
//                               a cycle tile that generation's PRESS-path map (the
//                               same mapEvents with no window) exactly: every event
//                               claimed by exactly one bar, none invented.
// GATE C  seam_coverage       — the corpus actually exercised enough seams for A to
//                               mean something (a silent walk must not pass).
"use strict";
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
// live.js is a browser classic script; it only needs a `location` to resolve BASE.
if (typeof global.location === "undefined") global.location = { origin: "file:///stellate" };
const E = require(path.join(ROOT, "engine", "csd-engine.js"));
const K = require(path.join(ROOT, "engine", "genre-kernel.js"));
const SE = require(path.join(ROOT, "engine", "faust", "voices", "state-engine.js"));
require(path.join(ROOT, "engine", "faust", "live", "live.js"));
const makeWalk = global.FaustLive.makeWalk;

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const BARS = +argOf("bars", 24);
const SEED = +argOf("seed", 7);
const VERBOSE = args.includes("--verbose");
const ALL = args.includes("--all");

// A spread that reaches every beat-moving stage of buildEvents: plain 4/4, swing,
// pushPull lanes, rubato (the beat WARP), pipes (harmonize/echo copies), thunk
// (events cloned off a grooved note), odd meter, chops/found, oversized chord bars.
const GENRES = ALL ? Object.keys(K.GENRES) : [
  "house", "techno", "jungle", "vaporwave", "synthwave", "lofi",
  "jazz", "blues", "dub", "triphop", "bossanova", "sludgemetal",
  "neoclassical", "prelude", "newage",
  "salondawdle", "greasepaintoompah",
  "ambient", "spokenword", "ragtime", "folk", "gabber",
];

let fails = 0, checks = 0;
const gate = (name, ok, note) => {
  checks++; if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? "  " + note : ""}`);
};

// ── the state's own maximum HUMANIZE displacement, in beats ────────────────────
// applyGroove jitters timing by ±humanize·0.04 (csd-engine.js). pushPull adds a
// DRAWLESS per-lane offset, so a lane's nominal boundary position is L + pp.
function grooveBounds(st) {
  const tf = st.timeFeel || {};
  const hum = tf.humanize || null;
  const ht = hum && hum.timing != null ? hum.timing : (st.humanize || 0);
  // push-pull may be declared in beats (tf.pushPull), in milliseconds
  // (tf.pushPullMs, folded at the state's own bpm), or both — E.resolvePushPull
  // IS the engine's fold, read here rather than re-derived so the gate can never
  // drift from applyGroove's actual offset.
  return { jit: ht * 0.04, pp: E.resolvePushPull(tf, st.bpm) };
}
const laneOf = (e) => e.drum || e.voice;
// the ornament tags CsdPipes stamps on the copies it makes (pipes.js) + solo lines
const KIND_TAGS = ["echo", "harm", "ghost", "pump", "solo", "open"];
const kindOf = (e) => KIND_TAGS.filter((t) => e[t]).join("+");
function groupByKind(list) {
  const m = new Map();
  for (const e of list) { const k = kindOf(e); (m.get(k) || m.set(k, []).get(k)).push(e); }
  return m;
}

// ── replay the REAL walk, keeping each bar's generation + its windowed map ─────
function replay(genre) {
  const st = K.track(genre, { seed: SEED });
  const TOL = grooveBounds(st).jit + 1e-9;
  const walk = makeWalk(() => st, E, SE, 0);
  const bars = [];
  for (let i = 0; i < BARS; i++) {
    const r = walk();
    // the PRESS-path map of this same generation: identical call, no beat window.
    const full = SE.mapEvents(E, r.one, r.ev, { units: r.units });
    bars.push({ lo: r.lo, hi: r.hi, ci: r.meta.ci, nch: r.meta.nch, one: r.one,
      ev: r.ev, events: r.events, full: full.events, units: r.units, tol: TOL });
  }
  return { st, bars };
}

// ── GATE A ────────────────────────────────────────────────────────────────────
// "Does THIS bar claim THIS event?" asked of the real predicate, by handing
// mapEvents a bundle holding the one event. Exact, and immune to the key
// ambiguity a beat match would have (pipes' harmonize/pump copies sit on their
// parent's beat, so beats are not unique).
function claims(bar, e, windowed) {
  const solo = { pitched: [], drums: [], found: [], sfx: [], srcById: bar.ev.srcById || {},
    totalBeats: bar.ev.totalBeats };
  (e.drum ? solo.drums : solo.pitched).push(e);
  const opts = windowed ? { lo: bar.lo, hi: bar.hi, units: bar.units } : { units: bar.units };
  return SE.mapEvents(E, bar.one, solo, opts).events.length;
}
const firedAt = (bar, e) => claims(bar, e, true);
const mappableAt = (bar, e) => claims(bar, e, false) > 0;

function seamScan(genre, out) {
  const { st, bars } = replay(genre);
  const { jit, pp } = grooveBounds(st);
  const TOL = jit + 1e-9;
  // an event ON the cycle end is a wrap join, owned by the next generation
  const cycEnd = bars.length ? bars[0].nch * (bars[0].hi - bars[0].lo) : 0;
  for (let k = 1; k < bars.length; k++) {
    const prev = bars[k - 1], cur = bars[k];
    if (Math.abs(prev.hi - cur.lo) > 1e-9) continue;      // not a contiguous interior join
    const L = cur.lo;
    const evsOf = (b) => [].concat(b.ev.pitched || [], b.ev.drums || []);
    const A0 = evsOf(prev), B0 = evsOf(cur);
    const lanes = new Set([...A0, ...B0].map(laneOf).filter(Boolean));
    for (const lane of lanes) {
      const nom = L + ((pp && pp[lane]) || 0);            // the lane's DRAWLESS boundary position
      const near = (arr, bar) => arr
        .filter((e) => laneOf(e) === lane && Math.abs(e.beat - nom) <= TOL
          && Math.abs(e.beat - cycEnd) > TOL && mappableAt(bar, e))
        .sort((a, b) => a.beat - b.beat);
      // A structural boundary event is one BOTH generations place there; pair them
      // (a chord puts several notes of a lane on the same downbeat, so the unit of
      // account is the EVENT, not the position) and ask how often the pair sounds.
      // Pair WITHIN a kind: a pipe's ornament copy sitting on the line is a
      // different animal from the note it decorates (an echoCanon copy sounding at
      // the line belongs to the bar its PARENT was in, and rightly plays there), so
      // matching one against the other would be comparing two different events.
      const A = groupByKind(near(A0, prev)), B = groupByKind(near(B0, cur));
      for (const [kind, av] of A) {
        const bv = B.get(kind); if (!bv) continue;
        const m = Math.min(av.length, bv.length);
        for (let i = 0; i < m; i++) {
          const played = firedAt(prev, av[i]) + firedAt(cur, bv[i]);
          out.seams++;
          if (played === 0) { out.lost++; out.badLanes[lane] = (out.badLanes[lane] || 0) + 1; if (VERBOSE && out.lost < 6) console.log(`    LOST    ${genre} bar${k} ${lane}${kind}@${L}`); }
          else if (played > 1) { out.doubled++; out.badLanes[lane] = (out.badLanes[lane] || 0) + 1; if (VERBOSE && out.doubled < 6) console.log(`    DOUBLED ${genre} bar${k} ${lane}${kind}@${L}`); }
        }
      }
    }
  }
  return bars;
}

// ── GATE B ────────────────────────────────────────────────────────────────────
// ONE generation, sliced by the nch chord-bar windows of its own cycle: the union
// must equal the press-path map of that generation, once each. This is the
// "live stream == press stream" half of the contract, inside a single generation.
function partitionScan(bars, out) {
  for (const b of bars) {
    const key = (m) => m.unit + "@" + m.beat;
    const seen = new Map(), want = new Map();
    for (let ci = 0; ci < b.nch; ci++) {
      const w = b.hi - b.lo, lo = ci * w, hi = lo + w;
      const slice = SE.mapEvents(E, b.one, b.ev, { lo, hi, units: b.units });
      for (const m of slice.events) seen.set(key(m), (seen.get(key(m)) || 0) + 1);
    }
    // Scoped off the two cycle EDGES by the groove bound: what happens within
    // `tol` of beat 0 and of the cycle end is a join between two GENERATIONS
    // (gate A's jurisdiction), not a partition inside this one.
    const cycBeats = b.nch * (b.hi - b.lo), tol = b.tol;
    for (const m of b.full) if (m.beat >= tol && m.beat < cycBeats - tol) want.set(key(m), (want.get(key(m)) || 0) + 1);
    for (const [k2, w2] of want) {
      out.refs += w2;
      const n = seen.get(k2) || 0;
      if (n !== w2) { out.bad += Math.abs(n - w2); if (VERBOSE && out.bad < 8) console.log(`    PARTITION ${k2}  press x${w2} live x${n}`); }
      seen.delete(k2);
    }
    for (const [k2, n] of seen) {
      const bt = +k2.slice(k2.lastIndexOf("@") + 1);
      if (!(bt >= tol && bt < cycBeats - tol)) continue;   // same edge scoping as `want`
      out.orphans += n; if (VERBOSE && out.orphans < 8) console.log(`    ORPHAN ${k2} x${n}`);
    }
    break;   // one generation per genre is enough — the predicate is state-independent
  }
}

// ── run ───────────────────────────────────────────────────────────────────────
const seam = { seams: 0, lost: 0, doubled: 0, badLanes: {} };
const part = { refs: 0, bad: 0, orphans: 0 };
const skipped = [];
for (const g of GENRES) {
  let bars;
  try { bars = seamScan(g, seam); } catch (e) { skipped.push(g + ": " + (e && e.message)); continue; }
  try { partitionScan(bars, part); } catch (e) { skipped.push(g + " (partition): " + (e && e.message)); }
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + "%" : "0%");
console.log(`\nlive-walk parity — ${GENRES.length - skipped.length} genres x ${BARS} bars, seed ${SEED}`);
if (skipped.length) console.log("  skipped: " + skipped.join("; "));
console.log(`  boundary events paired: ${seam.seams}   lost ${seam.lost} (${pct(seam.lost, seam.seams)})   doubled ${seam.doubled} (${pct(seam.doubled, seam.seams)})`);
if (seam.lost + seam.doubled) console.log("  lanes at fault: " + JSON.stringify(seam.badLanes));
console.log(`  single-generation window partition: ${part.refs} events, ${part.bad} miscounted, ${part.orphans} orphans\n`);

gate("seam_exactly_once", seam.lost === 0 && seam.doubled === 0,
  `${seam.seams} chord-bar boundary events, ${seam.lost} lost / ${seam.doubled} doubled`);
gate("window_partition", part.bad === 0 && part.orphans === 0,
  `${part.refs} press-path events tiled by the cycle's chord-bar windows`);
gate("seam_coverage", seam.seams >= 200 && part.refs >= 200,
  `${seam.seams} boundary events / ${part.refs} partition refs exercised`);

console.log(fails ? `\nFAIL: ${fails}/${checks} gates` : `\nPASS: all ${checks} live-walk parity gates green`);
process.exit(fails ? 1 : 0);
