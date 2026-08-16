#!/usr/bin/env node
// genealogy.js — THE FIT for the lineage annotations in genres.js.
//
//   node nukernel/genealogy.js          # prints the report AND writes
//                                       # nukernel/GENEALOGY.md (a finding,
//                                       # committed — not build output)
//
// Every real anchor in genres.js declares `parents` (weighted references to
// earlier anchors) and `wants` (parents the catalog does not hold yet). This
// script asks the anchors themselves whether the claims hold up: it extracts
// a numeric feature vector per anchor FROM THE ANCHOR DATA — nothing rendered,
// nothing subjective — and for each child fits non-negative weights over its
// declared parents' vectors (projected-gradient NNLS, zero deps). What the
// parents explain is heredity; the residue is the invention. "Liverpool 1962
// is X% its parents; Y% is what the Beatles invented."
//
// HAND-RUN, like tools/genre's analysis half: nothing in the app, the engine
// or the gates depends on its OUTPUT — but test/unit/nukernel.test.js §48
// does require this module and asserts the fit produces finite numbers, so
// the script cannot rot silently.
//
// THE FEATURES, each with the anchor field it reads (normalized ~[0,1]):
//   tempo      compose.js BPM[key] — where tempo actually lives; (bpm-70)/90
//   rate       g.rate (phrase rate multiplier), as-is (0.25..1)
//   bars       log2(g.bars)/4 — form length (2..12 bars)
//   voices     (g.voices-1)/7 (1..8)
//   swing      (g.swing||0)*3 — 1/3 triplet swing → 1
//   kick       kit lane density: mean of union(k) over 16 steps
//   backbeat   union(s,c) density
//   hats       union(h,o,r) density
//   perc       union(p,f,t,m,l,x) density
//   hand       drummer's hand: kitVel .4 + kitProb .3 + ghost .3 (presence)
//   bass       nobass ? 0 : 1
//   bassmotion bassStyle mapped (pedal .1 … sixteenths 1), bassGrid density
//              based when style absent, .3 for the default root-per-chord
//   harmtype   harmony: modal 0, emergent .5, cycle 1
//   harmrate   root changes per bar of the cycle (wrapping), else 0
//   seventh    g.prog carries any "7"/"dom7" quality → 1
//   bright     mode brightness: (sum(mode)-sum(phrygian))/(sum(lydian)-sum(phrygian));
//              default mode = natural minor
//   width      subject alphabet chromatic width: (12/scale.length)/6;
//              default scale = minor pentatonic (kernel.js PENT)
//   sustain    artic: staccato 0, absent 1/3, legato 2/3, tie 1
//   verb       tone.verb, as-is
//   cut        log-normalized tone.cut over the table's own 520..3200 range
//   dirt       fx crunch → 1, else distortion/overdrive instr → .7, else 0
//   wash       fraction of voices realized as "pad"
//   stagger    max entry(v)/8, clamped — staggered-arrival architecture
//   wordload   mean operators per (voice, section 0..3) in the word, /3
//   stress     g.stress||0 — the stamped dynamics (machines are 0)
//   phrase     g.phrase||0
//   touch      (g.touch ? g.touch.t : 0)*10, clamped — the hand's timing
"use strict";
const path = require("path");
const { GENRES } = require(path.join(__dirname, "genres.js"));
const { BPM } = require(path.join(__dirname, "compose.js"));

const FUNCTION_ANCHORS = new Set(["simple", "solo", "vocal", "backing", "riff", "pad"]);
const REAL = Object.keys(GENRES).filter(k => !FUNCTION_ANCHORS.has(k));

const PENT = [0, 3, 5, 7, 10];               // kernel.js's default subject alphabet
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];      // the default mode
const sum = a => a.reduce((x, y) => x + y, 0);
const clamp01 = x => Math.max(0, Math.min(1, x));

// union density over a set of kit lanes: a step counts once however many of
// the named lanes hit it (a clap doubling the snare is one backbeat)
const laneUnion = (kit, names) => {
  if (!kit) return 0;
  let n = 0;
  for (let i = 0; i < 16; i++)
    if (names.some(nm => kit[nm] && kit[nm][i % kit[nm].length])) n++;
  return n / 16;
};

const BASS_MOTION = { pedal: 0.1, fifths: 0.4, octaves: 0.5, walk: 0.7,
                      eighths: 0.8, sixteenths: 1.0 };

const FEATURES = ["tempo", "rate", "bars", "voices", "swing", "kick", "backbeat",
  "hats", "perc", "hand", "bass", "bassmotion", "harmtype", "harmrate",
  "seventh", "bright", "width", "sustain", "verb", "cut", "dirt", "wash",
  "stagger", "wordload", "stress", "phrase", "touch"];

function featuresOf(k) {
  const g = GENRES[k];
  const f = {};
  f.tempo = clamp01(((BPM[k] != null ? BPM[k] : 112) - 70) / 90);
  f.rate = g.rate;
  f.bars = Math.log2(g.bars) / 4;
  f.voices = (g.voices - 1) / 7;
  f.swing = clamp01((g.swing || 0) * 3);
  f.kick = laneUnion(g.kit, ["k"]);
  f.backbeat = laneUnion(g.kit, ["s", "c"]);
  f.hats = laneUnion(g.kit, ["h", "o", "r"]);
  f.perc = laneUnion(g.kit, ["p", "f", "t", "m", "l", "x"]);
  f.hand = (g.kitVel ? 0.4 : 0) + (g.kitProb ? 0.3 : 0) + (g.ghost ? 0.3 : 0);
  f.bass = g.nobass ? 0 : 1;
  f.bassmotion = g.nobass ? 0
    : g.bassStyle ? (BASS_MOTION[g.bassStyle] != null ? BASS_MOTION[g.bassStyle] : 0.3)
    : g.bassGrid ? 0.2 + sum(g.bassGrid) / 16
    : 0.3;
  f.harmtype = g.harmony === "cycle" ? 1 : g.harmony === "emergent" ? 0.5 : 0;
  if (g.harmony === "cycle" && Array.isArray(g.roots) && g.roots.length) {
    let ch = 0;
    for (let i = 0; i < g.roots.length; i++)
      if (g.roots[i] !== g.roots[(i + g.roots.length - 1) % g.roots.length]) ch++;
    f.harmrate = ch / g.roots.length;
  } else f.harmrate = 0;
  const flatProg = p => Array.isArray(p) ? p.flat(2) : [];
  f.seventh = flatProg(g.prog).some(c => c && /7/.test(c.q || "")) ? 1 : 0;
  const mode = g.mode || AEOLIAN;
  f.bright = clamp01((sum(mode) - 34) / 8);         // phrygian 34 … lydian 42
  const scale = g.scale || PENT;
  f.width = clamp01((12 / scale.length) / 6);       // quartal's 6 st/step = 1
  f.sustain = g.artic === "staccato" ? 0 : g.artic === "legato" ? 2 / 3
    : g.artic === "tie" ? 1 : 1 / 3;
  f.verb = g.tone.verb;
  f.cut = clamp01(Math.log(g.tone.cut / 500) / Math.log(3200 / 500));
  const instrs = Array.isArray(g.instr) ? g.instr : [g.instr];
  f.dirt = (g.fx || []).includes("crunch") ? 1
    : instrs.some(i => /distortion|overdrive/.test(i)) ? 0.7 : 0;
  let pads = 0, stag = 0, ops = 0, cells = 0;
  for (let v = 0; v < g.voices; v++) {
    if (g.realize(v) === "pad") pads++;
    stag = Math.max(stag, g.entry(v));
    for (let s = 0; s < 4; s++) { ops += g.word(v, s).length; cells++; }
  }
  f.wash = pads / g.voices;
  f.stagger = clamp01(stag / 8);
  f.wordload = clamp01(ops / cells / 3);
  f.stress = g.stress || 0;
  f.phrase = g.phrase || 0;
  f.touch = clamp01((g.touch ? g.touch.t : 0) * 10);
  return FEATURES.map(n => f[n]);
}

// ---- NNLS: min ||Aw - c||^2 s.t. w >= 0, by projected gradient -------------
// A is n x p (p parents, small), c is the child. Deterministic, exact enough:
// the step is 1/L with L an upper bound on the largest eigenvalue of A'A.
function nnls(A, c) {
  const n = A.length, p = A[0].length;
  // L <= max column-abs-sum of A'A (Gershgorin on a PSD matrix)
  const AtA = Array.from({ length: p }, (_, i) =>
    Array.from({ length: p }, (_, j) => {
      let s = 0; for (let r = 0; r < n; r++) s += A[r][i] * A[r][j]; return s;
    }));
  const Atc = Array.from({ length: p }, (_, i) => {
    let s = 0; for (let r = 0; r < n; r++) s += A[r][i] * c[r]; return s;
  });
  let L = 0;
  for (let i = 0; i < p; i++) L = Math.max(L, sum(AtA[i].map(Math.abs)));
  const step = 1 / (L || 1);
  let w = Array(p).fill(1 / p);
  for (let it = 0; it < 5000; it++) {
    for (let i = 0; i < p; i++) {
      let gr = -Atc[i];
      for (let j = 0; j < p; j++) gr += AtA[i][j] * w[j];
      w[i] = Math.max(0, w[i] - step * gr);
    }
  }
  return w;
}

function fitChild(k) {
  const g = GENRES[k];
  const parents = Object.keys(g.parents || {});
  const c = featuresOf(k);
  const mean = sum(c) / c.length;
  const sst = sum(c.map(x => (x - mean) * (x - mean)));
  if (!parents.length) {
    return { key: k, label: g.label, root: true, parents: [], declared: [],
             fitted: [], r2: 0, residRms: Math.sqrt(sst / c.length),
             wants: g.wants || [] };
  }
  const A = c.map((_, r) => parents.map(p => featuresOf(p)[r]));
  const w = nnls(A, c);
  const resid = c.map((x, r) => x - parents.reduce((s2, _, j) => s2 + A[r][j] * w[j], 0));
  const sse = sum(resid.map(x => x * x));
  const wsum = sum(w) || 1;
  return {
    key: k, label: g.label, root: false, parents,
    declared: parents.map(p => g.parents[p]),
    fitted: w.map(x => x / wsum), rawFitted: w,
    r2: sst > 0 ? Math.max(0, 1 - sse / sst) : 0,
    residRms: Math.sqrt(sse / c.length),
    wants: g.wants || [],
  };
}

function fitAll() { return REAL.map(fitChild); }

// ---- the report ------------------------------------------------------------
function report() {
  const fits = fitAll();
  const fitted = fits.filter(f => !f.root).sort((a, b) => b.r2 - a.r2);
  const roots = fits.filter(f => f.root);
  const pct = x => (x * 100).toFixed(1).padStart(5) + "%";
  const lines = [];
  const say = s => lines.push(s);

  say("# GENEALOGY — the fit of the declared parentage");
  say("");
  say("2026-08-16 — nukernel/genealogy.js over the " + REAL.length +
      " real anchors in nukernel/genres.js.");
  say("");
  say("Each anchor's " + FEATURES.length + " features are read off the anchor " +
      "data itself (the field-by-feature table is documented at the top of " +
      "genealogy.js); each child is then fitted as a non-negative combination " +
      "of its DECLARED parents' vectors. R² is how much of the child the " +
      "parents explain; the residue is the invention.");
  say("");
  say("## The children, best-explained first");
  say("");
  say("| child | R² | residue (rms) | fitted weights (declared) |");
  say("|---|---|---|---|");
  for (const f of fitted) {
    const w = f.parents.map((p, i) =>
      p + " " + f.fitted[i].toFixed(2) + " (" + f.declared[i].toFixed(2) + ")").join(", ");
    say("| " + f.key + " — " + f.label + " | " + pct(f.r2) + " | " +
        f.residRms.toFixed(3) + " | " + w + " |");
  }
  say("");

  // ---- WHAT PHASE 2 MOVED --------------------------------------------------
  // The fit before the eight ancestors landed, committed as data rather than
  // as prose, so this section is a MEASUREMENT and not a memory: PHASE1 is the
  // R²/residue of every child in the 44-anchor table (the run this file held
  // on 2026-08-16, before jazz/bodiddley/chuckberry/doowop/skiffle/minimalism/
  // kraftwerk/electro), and bossa is in it as a root, which is why it carries
  // a null R² and only its residue. A child not in the table below is one of
  // the eight themselves, or a child that has not moved because it never
  // wanted anything.
  const PHASE1 = {
    rock: [0.938, 0.082], newwave: [0.876, 0.127], neoclassical: [0.849, 0.135],
    beatles: [0.835, 0.131], rnb: [0.830, 0.143], citypop: [0.808, 0.150],
    eurythmics: [0.803, 0.142], jodeci: [0.792, 0.163], disco: [0.786, 0.160],
    synthpop: [0.779, 0.168], boombap: [0.763, 0.143], deathmetal: [0.762, 0.191],
    toto: [0.711, 0.166], gospel: [0.710, 0.175], steely: [0.679, 0.177],
    postrock: [0.673, 0.175], isley: [0.649, 0.176], shoegaze: [0.644, 0.216],
    counterpoint: [0.636, 0.184], reggae: [0.631, 0.194], house: [0.615, 0.233],
    punk: [0.610, 0.221], garage: [0.596, 0.218], motown: [0.595, 0.209],
    techno: [0.570, 0.223], afrobeat: [0.561, 0.205], vaporwave: [0.510, 0.214],
    sludge: [0.462, 0.231], fugue: [0.404, 0.238], spem: [0.401, 0.269],
    dnb: [0.393, 0.258], acid: [0.385, 0.234], dub: [0.339, 0.243],
    countrypop: [0.337, 0.272], trap: [0.232, 0.329], ska: [0.142, 0.323],
    funk: [0.096, 0.323], ambient: [0.000, 0.394], bossa: [null, 0.343],
  };
  const moved = fits
    .filter(f => PHASE1[f.key] && Math.abs(PHASE1[f.key][1] - f.residRms) > 0.0005)
    .sort((a, b) => (PHASE1[b.key][1] - b.residRms) - (PHASE1[a.key][1] - a.residRms));
  if (moved.length) {
    say("## What phase 2 moved — the residues, before and after");
    say("");
    say("| child | R² before | R² after | residue before | after | fell by |");
    say("|---|---|---|---|---|---|");
    let fell = 0;
    for (const f of moved) {
      const [r0, d0] = PHASE1[f.key];
      fell += d0 - f.residRms;
      say("| " + f.key + " | " + (r0 == null ? "(root)" : pct(r0)) + " | " +
          pct(f.r2) + " | " + d0.toFixed(3) + " | " + f.residRms.toFixed(3) +
          " | " + (d0 - f.residRms).toFixed(3) + " |");
    }
    say("");
    say("**" + moved.length + " children moved; " + fell.toFixed(3) +
        " of residue (rms, summed) came off the table** — the ancestors the " +
        "declarations were reaching for through proxies, built and wired in.");
    say("");
  }

  say("## The roots (parents: {})");
  say("");
  for (const f of roots)
    say("- **" + f.key + "** — " + f.label +
        (f.wants.length ? " (root under protest; wants: " + f.wants.join(", ") + ")"
                        : " (true root)"));
  say("");

  // demand for missing ancestors: appearances, and the residue their absence
  // leaves behind (sum of residRms over the children that want them)
  const demand = new Map();
  for (const f of fits) for (const w of f.wants) {
    if (!demand.has(w)) demand.set(w, { count: 0, resid: 0, kids: [] });
    const d = demand.get(w);
    d.count++; d.resid += f.residRms; d.kids.push(f.key);
  }
  const wanted = [...demand.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].resid - a[1].resid);
  say("## Phase 2's shopping order — the most-demanded missing ancestors");
  say("");
  say("| ancestor | asked for by | residue left behind |");
  say("|---|---|---|");
  for (const [w, d] of wanted)
    say("| " + w + " | " + d.count + " (" + d.kids.join(", ") + ") | " +
        d.resid.toFixed(3) + " |");
  say("");
  const best = fitted[0], worst = fitted[fitted.length - 1];
  const bigResid = [...fitted].sort((a, b) => b.residRms - a.residRms)[0];
  say("## Headlines");
  say("");
  say("- Most explained: **" + best.key + "** (" + best.label + ") — " +
      pct(best.r2).trim() + " its parents.");
  say("- Least explained among the fitted: **" + worst.key + "** (" +
      worst.label + ") — " + pct(worst.r2).trim() +
      "; the rest is what it invented.");
  say("- Biggest residue: **" + bigResid.key + "** (rms " +
      bigResid.residRms.toFixed(3) + ").");
  const b = fits.find(f => f.key === "beatles");
  // ...and the founding example's own sentence has to survive its shopping
  // list emptying, which is what happened the day the four ancestors it named
  // were built. An empty `wants` is a RESULT, not a missing value, so it gets
  // said rather than printed as an empty pair of brackets.
  say("- The founding example: **Liverpool 1962 is " + pct(b.r2).trim() +
      " its parents** (" + b.parents.join(" + ") + "); " +
      ((1 - b.r2) * 100).toFixed(1) + "% is what the Beatles invented — " +
      (b.wants.length
        ? "and the declared wants (" + b.wants.join(", ") + ") say where to " +
          "look for the rest."
        : "and it owes nothing further: every ancestor it once named is an " +
          "anchor in the table, so what is left is the invention."));
  say("");
  return lines.join("\n");
}

const api = { FEATURES, REAL, featuresOf, nnls, fitChild, fitAll, report };
if (require.main === module) {
  const md = report();
  console.log(md);
  require("fs").writeFileSync(path.join(__dirname, "GENEALOGY.md"), md + "\n");
  console.log("wrote nukernel/GENEALOGY.md");
} else module.exports = api;
