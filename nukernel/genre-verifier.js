#!/usr/bin/env node
// genre-verifier.js — is a genre still recognisable as itself, in the score?
//
//   node nukernel/genre-verifier.js matrix        the confusion matrix (default)
//   node nukernel/genre-verifier.js matrix --full print all 110x110 cells
//   node nukernel/genre-verifier.js one acid      one genre: features + rivals
//   node nukernel/genre-verifier.js drift         current anchors vs the baked profiles
//   node nukernel/genre-verifier.js bake          re-measure genre-profiles.json
//
// THE PARENT HAS HAD THIS ALL ALONG and nukernel did not: engine/genre-verifier.js
// scores every anchor against feature targets and prints a confusion matrix that
// has to stay diagonal-dominant, which is what stops one genre being quietly
// tuned into its neighbour. nukernel grew to 110 anchors with no such check, and
// the bill came due on Chicago 1987 — its 303 had resonance and envmod backed off
// to about half of what the instrument does, the squelch was gone, and nothing in
// the repo could say so. A genre had been tuned into blandness and every gate was
// green, because every gate asked "does this render" rather than "does this still
// sound like acid house and not like everything else in the club family".
//
// NO AUDIO IS RENDERED HERE, and that is the design, not a shortcut (Paul, this
// week: "you need to analyze the scores created and evaluate genres that way,
// using deterministic analysis methods"). The thing a genre IS lives in the score
// it writes — where the kick falls, how far the line leaps, whether the bass
// walks — and the score is available in a millisecond, exactly, with no sample
// rate and no classifier's opinion in the way. So the input is the real emitted
// artifact: compose(genre, seed) writes a whole record and ui/derive.js songBars
// buckets it into bars, which is the same pair of calls the transport plays.
//
// HOW IT DECIDES. Every genre is measured on three composed records (seeds 1-3)
// into one feature vector of four groups:
//
//   r_  RHYTHM    the kit: lane shares, four-on-the-floor, the backbeat, off-beat
//                 and sixteenth syncopation, how far the hand sits off the grid,
//                 accents, dynamics, and the tempo the record is written at
//   m_  MELODY    the line: density, register and ambitus, articulation, interval
//                 size, steps against leaps, contour turns, how much rest is in it
//   h_  HARMONY   the changes: harmony kind, the mode's own third, pitch-class
//                 spread, and the bass — density, register, root motion
//   v_  VOICE     the one thing a score cannot show — what it is played ON: the
//                 tone block, the signature synth's own knobs, the mouth. THIS is
//                 the group the bland 303 moved, and it is a full quarter of the
//                 distance so that moving it registers
//
// The four groups carry EQUAL weight. Without that the twenty-odd rhythm numbers
// would drown the six that say what the record is played on, and a verifier that
// cannot feel a filter close is the verifier that missed the 303.
//
// The comparison is LEAVE-ONE-OUT, because a profile measured from the same
// render it then scores is a tautology. For each held-out seed, every genre's
// profile is the mean of its OTHER two seeds; the held-out vector is scored
// against all 110 profiles; the three folds are averaged. A genre is
// diagonal-dominant when its own profile is the closest one — which is the whole
// question, asked once per genre: does this record look more like itself than
// like anything else on the shelf.
//
// Distance is per-group RMS in z-units (each feature divided by its own spread
// across the 110 anchors, so a knob with a small range still counts), averaged
// over the four groups, and reported as a score of 100·e^(−d²/2). The margin is
// self-score minus the best rival's, and the margins are what erode first: a
// genre keeps winning its own row for a long time while quietly moving in with
// the neighbours, which is exactly the shape the acid failure had.
//
// genre-profiles.json is the COMMITTED baseline — centroids, spreads, margins and
// the known-failing rows. `drift` diffs the live table against it, which is the
// alarm the matrix alone cannot ring: if an anchor is dulled, its own profile
// moves with it and the matrix shrugs, but the frozen centroid does not move and
// the drift report names the genre and the feature. Re-bake deliberately, read
// the diff, and the record of what changed is in git.
//
// WHAT IT SAID THE FIRST TIME IT RAN — 101 of the 110 win their own row, and the
// nine that do not fail in two completely different ways, which is the finding:
//
//   ONE genre is genuinely confused. blueeyedsoul and citypop sit 0.25 apart in
//   a space whose median nearest neighbour is 0.77, and 64 of the 77 features
//   agree to within a quarter of a spread: Philadelphia 1976 and Tokyo 1984 are
//   currently the same record with two labels. (isley~steely 0.41 and
//   yachtrock~coastrock 0.42 are the next two, still winning their rows.)
//
//   The other EIGHT fail the opposite way: they are not crowded, they are loose.
//   simple, fugue, counterpoint, drone, folkduo and the three `parts` rooms
//   (vocal, backing, riff) scatter 0.87-0.95 from their own middle against a
//   catalog median of 0.29 — three records that do not agree with each other, so
//   the held-out one lands on a neighbour that is two spreads away. Six of them
//   are the anchors that were never meant to be a record: the kernel's zero, the
//   two contrapuntal twins that trade places, and the roles a song is assembled
//   FROM. That they are loose is honest; that they are counted is deliberate.

"use strict";

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "..");
const PROFILES = path.join(__dirname, "genre-profiles.json");
const SEEDS = [1, 2, 3];
// HOW FAR AN ANCHOR MAY MOVE and still be the same genre: one full catalog
// spread of the feature that moved most. Measured against the case this file was
// written for — the half-strength 303 is 2.11 spreads on v_res and 2.02 on
// v_env, so a threshold of one flags it twice over while leaving the ordinary
// wobble of a re-voiced anchor alone.
const DRIFT_Z = 1;

// ---- the data tier, on a stub window ---------------------------------------
// nukernel's data files are UMD classic scripts and ui/derive.js is a real ES
// module that reads them off `window` — the same stub the §31 gate builds, for
// the same reason: measuring through a hand-copied mirror of derive.js is how a
// measurement and an engine drift apart, and then the number is about the mirror.
let _tier = null;
async function tier() {
  if (_tier) return _tier;
  globalThis.window = globalThis;
  window.NuKernel = require("./kernel.js");
  window.NuGenres = require("./genres.js");
  window.NuFields = require("./fields.js");
  window.NuSong = require("./song.js");
  window.NuInstruments = require("./instruments.js");
  window.NuCompose = require("./compose.js");
  window.PRESETS = require("./presets.js").PRESETS;
  // ui/deps.js snapshots the big engine's sampler registry the moment it first
  // evaluates, which is the import below
  window.__REGISTRY = require(path.join(ROOT, "engine", "registry-data.js"));
  const D = await import(pathToFileURL(path.join(__dirname, "ui", "derive.js")).href);
  return (_tier = { D, G: window.NuGenres, C: window.NuCompose });
}

// ---- small honest statistics ------------------------------------------------
const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
// the mean is taken ONCE. Written the pretty way (mean inside the map) this is
// quadratic in the event list, and a genre's hits run to thousands — it cost
// more than composing the record.
const sd = a => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map(x => (x - m) ** 2)));
};
const frac = (a, p) => (a.length ? a.filter(p).length / a.length : 0);
const pct = (a, q) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
};
const lg = (x, lo, hi) => Math.max(0, Math.min(1, (Math.log2(Math.max(1e-6, x)) - lo) / (hi - lo)));
const clamp01 = x => Math.max(0, Math.min(1, x));
// a feature is never allowed to be NaN: an empty lane is a zero, not a hole,
// and one NaN poisons every distance it ever appears in
const num = x => (Number.isFinite(x) ? x : 0);

// ---- the score, as this file reads it ---------------------------------------
// Everything below is measured on the bar list ui/derive.js songBars returns —
// the same buckets audio/transport.js schedules. `off` is the event's position
// inside its bar in GRID steps, so pos is where in the bar it lands, 0..1, and
// pos·16 is the sixteenth it is nearest. That normalisation matters: a half-rate
// genre writes 32 steps to the bar and a straight one 16, and "on the backbeat"
// has to mean the same thing in both.
function readScore(bars) {
  const hits = [], lines = [], basses = [];
  bars.forEach((b, bi) => {
    const steps = b.steps || 16;
    for (const e of b.ev) {
      const pos = ((e.off % steps) + steps) % steps / steps;
      const at = pos * 16, near = Math.round(at);
      // WHICH BAR, carried on every event. Without it "how many onsets are
      // there" collapses every bar of the record onto one sixteen-step grid,
      // and a three-minute song saturates it — the rest and the polyphony both
      // came out the same number for all 110 genres, which is a feature that is
      // not a feature.
      const rec = { bi, pos, at, dev: Math.abs(at - near),
                    beats: steps / 4, n: e.n, vel: num(e.vel), dur: num(e.dur),
                    v: e.v, acc: !!e.acc, d: e.d, pad: !!e.pad, grace: !!e.grace };
      if (e.kind === "hit") hits.push(rec);
      else if (e.kind === "bass" && e.n != null) basses.push(rec);
      else if (e.kind === "line" && e.n != null) lines.push(rec);
    }
  });
  return { hits, lines, basses, nBars: Math.max(1, bars.length) };
}

// consecutive intervals inside each voice — a melodic interval is only an
// interval if the same player played both notes
function intervals(notes) {
  const byV = new Map();
  for (const e of notes) {
    let a = byV.get(e.v); if (!a) byV.set(e.v, a = []); a.push(e);
  }
  const out = [];
  for (const a of byV.values()) {
    a.sort((x, y) => x.pos - y.pos);
    for (let i = 1; i < a.length; i++) out.push(a[i].n - a[i - 1].n);
  }
  return out;
}

const entropy12 = notes => {
  if (!notes.length) return 0;
  const h = new Array(12).fill(0);
  for (const e of notes) h[((Math.round(e.n) % 12) + 12) % 12]++;
  let H = 0;
  for (const c of h) if (c) { const p = c / notes.length; H -= p * Math.log2(p); }
  return H / Math.log2(12);
};

// ---- ONE FEATURE VECTOR -----------------------------------------------------
// Prefixes are load-bearing: r_/m_/h_/v_ is how the distance knows which group a
// number belongs to, and the groups are what keep the kit from outvoting the
// filter. Add a feature by naming it into its group; nothing else needs telling.
function features(D, C, G, gk, seed) {
  const g = G.GENRES[gk];
  const song = C.compose(gk, seed);
  const bars = D.songBars(song.song, song.slots, song.groove, song.swing);
  const { hits, lines, basses, nBars } = readScore(bars);

  const lane = L => frac(hits, e => e.d === L);
  const kicks = hits.filter(e => e.d === "k");
  const backs = hits.filter(e => e.d === "s" || e.d === "c");
  const onQ = e => Math.abs(e.at / 4 - Math.round(e.at / 4)) < 0.12;
  const quarterIx = e => ((Math.round(e.at / 4) % 4) + 4) % 4;
  const ints = intervals(lines);
  const turns = ints.slice(1).filter((x, i) => x * ints[i] < 0).length;
  const onsets = new Set(lines.map(e => e.bi + ":" + e.v + "@" + Math.round(e.at)));
  const tone = g.tone || {};
  const set = (g.synth && g.synth.set) || {};
  const mouth = tone.mouth || {};
  const md = g.mode || [0, 2, 3, 5, 7, 8, 10];
  const bassPcs = new Set(basses.map(e => ((Math.round(e.n) % 12) + 12) % 12));
  const bassInts = intervals(basses.map(e => ({ ...e, v: 0 })));

  return {
    // ---- r_ RHYTHM: what the kit is doing, and how fast -------------------
    r_dens:    num(hits.length / nBars) / 16,
    r_kick:    lane("k"), r_snare: lane("s"), r_hat: lane("h"), r_open: lane("o"),
    r_clap:    lane("c"), r_rim: lane("p"),
    r_tom:     lane("t") + lane("m") + lane("l"),
    r_cym:     lane("r") + lane("x"),
    r_lanes:   new Set(hits.map(e => e.d)).size / 12,
    r_four:    frac(kicks, onQ),                                  // four on the floor
    r_kickOne: frac(kicks, e => onQ(e) && quarterIx(e) === 0),
    r_back:    frac(backs, e => onQ(e) && (quarterIx(e) === 1 || quarterIx(e) === 3)),
    r_off8:    frac(hits, e => Math.round(e.at) % 2 === 1),        // the sixteenths between
    r_off4:    frac(hits, e => Math.round(e.at / 2) % 2 === 1),    // the eighths between
    r_micro:   mean(hits.map(e => e.dev)) / 0.5,                   // swing, groove, the hand
    r_acc:     frac(hits, e => e.acc),
    r_vel:     mean(hits.map(e => e.vel)) / 9,
    r_velSd:   sd(hits.map(e => e.vel)) / 4.5,
    r_grace:   frac(hits, e => e.grace),
    r_bpm:     clamp01((song.bpm - 60) / 110),

    // ---- m_ MELODY: the line itself --------------------------------------
    m_dens:    clamp01(lines.length / nBars / 16),
    m_voices:  clamp01(new Set(lines.map(e => e.v)).size / 8),
    m_poly:    clamp01(lines.length / Math.max(1, onsets.size) / 3),
    m_pad:     frac(lines, e => e.pad),
    m_reg:     clamp01((mean(lines.map(e => e.n)) - 36) / 48),
    m_regSd:   clamp01(sd(lines.map(e => e.n)) / 18),
    m_amb:     clamp01((pct(lines.map(e => e.n), 0.95) - pct(lines.map(e => e.n), 0.05)) / 36),
    m_leg:     clamp01(mean(lines.map(e => e.dur / Math.max(1e-6, e.beats)))),  // beats held
    m_int:     clamp01(mean(ints.map(Math.abs)) / 12),
    m_step:    frac(ints, x => Math.abs(x) > 0 && Math.abs(x) <= 2),
    m_leap:    frac(ints, x => Math.abs(x) >= 5),
    m_rep:     frac(ints, x => x === 0),
    m_turn:    ints.length > 1 ? turns / (ints.length - 1) : 0,
    m_off8:    frac(lines, e => Math.round(e.at) % 2 === 1),
    m_micro:   mean(lines.map(e => e.dev)) / 0.5,
    m_rest:    clamp01(1 - onsets.size / (nBars * 16)),
    m_acc:     frac(lines, e => e.acc),
    m_vel:     mean(lines.map(e => e.vel)) / 9,

    // ---- h_ HARMONY: the changes, and the bass that carries them ---------
    h_modal:   g.harmony === "modal" ? 1 : 0,
    h_cycle:   g.harmony === "cycle" ? 1 : 0,
    h_emerg:   g.harmony === "emergent" ? 1 : 0,
    h_diat:    g.diatonic ? 1 : 0,
    h_roots:   clamp01((g.roots ? g.roots.length : 0) / 8),
    h_prog:    g.prog ? 1 : 0,
    h_third:   md[2] >= 4 ? 1 : 0,                                 // the mode's own third
    h_seven:   md.length > 6 && md[6] >= 11 ? 1 : 0,               // and its leading note
    h_width:   clamp01((12 / (g.scale ? g.scale.length : 5)) / 6),  // the subject's alphabet
    h_pcEnt:   entropy12(lines),
    h_pcN:     new Set(lines.map(e => ((Math.round(e.n) % 12) + 12) % 12)).size / 12,
    h_bass:    clamp01(basses.length / nBars / 8),
    h_bassReg: basses.length ? clamp01((mean(basses.map(e => e.n)) - 24) / 36) : 0,
    h_bassPc:  bassPcs.size / 12,
    h_bassInt: clamp01(mean(bassInts.map(Math.abs)) / 12),
    h_bassOff: frac(basses, e => Math.round(e.at) % 2 === 1),

    // ---- v_ VOICE: what it is played on ----------------------------------
    v_cut:     lg(tone.cut || 1000, 8, 12.5),                      // 256 Hz .. 5.8 kHz
    v_q:       clamp01(Math.log2(1 + (tone.q || 0)) / 3.6),
    v_gain:    clamp01((tone.gain || 0) / 0.5),
    v_verb:    clamp01((tone.verb || 0) / 0.5),
    v_atk:     lg((tone.atk || 0.001) * 1000, -1, 8),
    v_rel:     lg((tone.rel || 0.1) * 1000, 4, 12),
    v_tri:     tone.wave === "triangle" ? 1 : 0,
    v_saw:     tone.wave === "sawtooth" ? 1 : 0,
    v_sqr:     tone.wave === "square" || tone.wave === "pulse" ? 1 : 0,
    // THE SIGNATURE SYNTH's own knobs — the group the bland 303 lived in. A
    // genre that declares a dsp is declaring that a sample cannot make this
    // sound, so what the knobs say is genre identity and belongs in the vector.
    v_synth:   g.synth ? 1 : 0,
    v_res:     clamp01(num(set.resonance != null ? set.resonance : set.res) / 1),
    v_env:     clamp01(num(set.envmod != null ? set.envmod : set.envAmount) / 1),
    v_scut:    g.synth && set.cutoff != null ? lg(set.cutoff, 6, 13) : 0,
    v_drive:   clamp01(num(set.drive)),
    v_glide:   clamp01(num(set.glide)),
    v_level:   g.synth ? clamp01(num(g.synth.level) / 1) : 0,
    v_mouth:   tone.mouth ? 1 : 0,
    v_vib:     clamp01(num(mouth.vib)),
    v_air:     clamp01(num(mouth.air)),
    v_blend:   clamp01(num(mouth.blend)),
    v_instr:   clamp01((Array.isArray(g.instr) ? g.instr.length : 1) / 4),
    v_fx:      clamp01((g.fx ? g.fx.length : 0) / 3),
  };
}

// the key order of a vector IS the vector order — one literal, one sequence
const keysOf = v => Object.keys(v);
const groupOf = k => k.slice(0, 1);
const GROUPS = ["r", "m", "h", "v"];

// ---- distance ---------------------------------------------------------------
// Per-group RMS in z-units, then the mean of the four groups. Equal groups is
// the whole point: rhythm brings twenty numbers and voice brings sixteen, and a
// plain Euclidean sum would let the kit shout down the filter.
// The split into groups is memoised on the key list itself: this runs 110x110x3
// times per matrix, and re-filtering 78 names inside it cost more than composing
// all 330 records did.
const _byGroup = new WeakMap();
function grouped(keys) {
  let g = _byGroup.get(keys);
  if (!g) _byGroup.set(keys, g = GROUPS.map(G0 => keys.filter(k => groupOf(k) === G0)));
  return g;
}
function distance(a, b, scale, keys) {
  let d2 = 0;
  for (const ks of grouped(keys)) {
    let s = 0;
    for (const k of ks) { const z = (num(a[k]) - num(b[k])) / scale[k]; s += z * z; }
    d2 += (ks.length ? s / ks.length : 0) / GROUPS.length;
  }
  return Math.sqrt(d2);
}
const scoreOf = d => Math.round(100 * Math.exp(-(d * d) / 2));

// the spread of each feature ACROSS the anchors — a knob whose whole catalog
// range is 0.2 wide has to count as much as one that ranges over the unit
// interval, or the narrow-range identities (the mouth, the resonance) vanish.
// Floored, because a feature nobody varies must not divide by nothing.
function scalesOf(centroids, keys) {
  const scale = {};
  for (const k of keys) {
    const col = Object.values(centroids).map(c => num(c[k]));
    scale[k] = Math.max(0.02, sd(col));
  }
  return scale;
}

const meanVec = (vs, keys) => {
  const out = {};
  for (const k of keys) out[k] = mean(vs.map(v => num(v[k])));
  return out;
};

// ---- the measurement pass ---------------------------------------------------
// `only` measures a subset — one genre re-composed after a knob was moved. The
// spreads it returns are meaningless on a subset (a spread is a fact about the
// whole catalog), so a subset caller reads scale off the baked profile instead.
async function measure(seeds, only) {
  const { D, G, C } = await tier();
  const genres = only && only.length ? only : Object.keys(G.GENRES);
  const vecs = {};                            // genre -> [vector per seed]
  for (const gk of genres) vecs[gk] = (seeds || SEEDS).map(s => features(D, C, G, gk, s));
  const keys = keysOf(vecs[genres[0]][0]);
  const centroids = {};
  for (const gk of genres) centroids[gk] = meanVec(vecs[gk], keys);
  return { genres, vecs, keys, centroids, scale: scalesOf(centroids, keys),
           seeds: seeds || SEEDS };
}

// ---- THE CONFUSION MATRIX ---------------------------------------------------
// Leave one seed out, profile from the rest, score the held-out record against
// all 110 profiles, average the folds. A genre passes when its own row's
// highest score is its own column.
function matrixOf(m) {
  const { genres, vecs, keys, scale, seeds } = m;
  const folds = seeds.map((_, fi) => {
    const cent = {};
    for (const gk of genres) cent[gk] = meanVec(vecs[gk].filter((_, i) => i !== fi), keys);
    return cent;
  });
  const cells = {};
  for (const gk of genres) {
    const row = new Array(genres.length).fill(0);
    seeds.forEach((_, fi) => {
      const x = vecs[gk][fi], cent = folds[fi];
      genres.forEach((t, ti) => { row[ti] += scoreOf(distance(x, cent[t], scale, keys)); });
    });
    cells[gk] = row.map(v => Math.round(v / seeds.length));
  }
  const rows = genres.map((gk, gi) => {
    const row = cells[gk];
    let best = -1, bi = -1;
    row.forEach((v, i) => { if (i !== gi && v > best) { best = v; bi = i; } });
    return { g: gk, self: row[gi], rival: genres[bi], rivalScore: best,
             margin: row[gi] - best, ok: row[gi] > best };
  });
  // THE CROWDED PAIRS, which is a different list from the failing rows and the
  // more useful one to hand a person: two anchors sitting on top of each other
  // in the space are two anchors that will sound like each other long before
  // either loses its own row. Measured on the full centroids, not the folds.
  const seen = new Set(), pairs = [];
  for (const a of genres) for (const b of genres) {
    if (a === b || seen.has(b + "|" + a)) continue;
    seen.add(a + "|" + b);
    pairs.push({ a, b, d: distance(m.centroids[a], m.centroids[b], scale, keys) });
  }
  pairs.sort((x, y) => x.d - y.d);
  // and how far each genre's three records sit from its own middle — the anchor
  // that is loose rather than crowded
  const scatter = {};
  for (const gk of genres)
    scatter[gk] = mean(vecs[gk].map(v => distance(v, m.centroids[gk], scale, keys)));
  return { genres, cells, rows, pairs, scatter,
           dominant: rows.filter(r => r.ok).length };
}

// ---- reporting --------------------------------------------------------------
function printMatrix(mx, full) {
  const { genres, cells, rows } = mx;
  if (full) {
    console.log("".padEnd(18) + genres.map(g => g.slice(0, 6).padStart(7)).join(""));
    for (const g of genres) {
      const gi = genres.indexOf(g);
      console.log(g.padEnd(18) + cells[g].map((c, i) =>
        String(c).padStart(7 - (i === gi ? 1 : 0)) + (i === gi ? "*" : "")).join(""));
    }
    console.log("");
  }
  console.log(`diagonal dominant: ${mx.dominant}/${genres.length}`);
  for (const r of rows) if (!r.ok)
    console.log(`  x ${r.g}: self=${r.self} <= ${r.rival}=${r.rivalScore}`);
  const tight = rows.filter(r => r.ok).sort((a, b) => a.margin - b.margin).slice(0, 12);
  console.log("\ntightest margins (the ones moving in with the neighbours):");
  for (const r of tight)
    console.log(`  ${r.g.padEnd(18)} self ${String(r.self).padStart(3)}  ` +
                `+${String(r.margin).padStart(2)} over ${r.rival}`);
  // THE OTHER AXIS, and it is not the same question. A low self-score means the
  // three records this genre wrote do not agree with EACH OTHER — the anchor is
  // loose rather than crowded — and a genre can be perfectly distinct from all
  // 109 neighbours while being a different record every time you press compose.
  const loose = [...rows].sort((a, b) => a.self - b.self).slice(0, 8);
  const med = [...Object.values(mx.scatter)].sort((a, b) => a - b)[Math.floor(genres.length / 2)];
  console.log(`\nleast consistent with themselves across seeds (median scatter ${med.toFixed(2)}):`);
  for (const r of loose)
    console.log(`  ${r.g.padEnd(18)} self ${String(r.self).padStart(3)}  ` +
                `scatter ${mx.scatter[r.g].toFixed(2)}  (nearest other: ${r.rival} ${r.rivalScore})`);
  console.log("\nclosest pairs in the space (who is moving in with whom):");
  for (const p of mx.pairs.slice(0, 8))
    console.log(`  ${(p.a + " ~ " + p.b).padEnd(38)} d=${p.d.toFixed(2)}`);
}

// ---- the committed baseline -------------------------------------------------
const round6 = x => +num(x).toFixed(6);
function bake(m, mx) {
  const centroids = {};
  for (const gk of m.genres) {
    centroids[gk] = {};
    for (const k of m.keys) centroids[gk][k] = round6(m.centroids[gk][k]);
  }
  const scale = {}; for (const k of m.keys) scale[k] = round6(m.scale[k]);
  const margins = {}; for (const r of mx.rows) margins[r.g] = r.margin;
  return { note: "measured by nukernel/genre-verifier.js bake — the frozen shape of " +
                 "each genre, so a dulled anchor has something to be dull AGAINST",
           seeds: m.seeds, features: m.keys, scale, margins,
           failing: mx.rows.filter(r => !r.ok).map(r => r.g),
           centroids };
}

// how far each genre has moved off its baked centroid, and in which feature
function driftOf(m, base) {
  const keys = base.features.filter(k => m.keys.includes(k));
  const out = [];
  for (const gk of m.genres) {
    const b = base.centroids[gk];
    if (!b) { out.push({ g: gk, d: Infinity, worst: "(new genre)", by: 0 }); continue; }
    const d = distance(m.centroids[gk], b, base.scale, keys);
    let worst = "", by = 0;
    for (const k of keys) {
      const z = Math.abs(num(m.centroids[gk][k]) - num(b[k])) / base.scale[k];
      if (z > by) { by = z; worst = k; }
    }
    out.push({ g: gk, d, worst, by });
  }
  return out.sort((a, b) => b.d - a.d);
}

// ---- API + CLI --------------------------------------------------------------
const api = { measure, matrixOf, features, distance, scoreOf, bake, driftOf,
              PROFILES, SEEDS, DRIFT_Z, loadProfiles: () =>
                JSON.parse(fs.readFileSync(PROFILES, "utf8")) };
module.exports = api;

if (require.main === module) (async () => {
  const cmd = process.argv[2] || "matrix";
  const args = process.argv.slice(3);
  if (cmd === "matrix" || cmd === "bake") {
    const t0 = Date.now();
    const m = await measure();
    const mx = matrixOf(m);
    console.log(`nukernel genre verifier — ${m.genres.length} genres, ` +
                `seeds ${m.seeds.join(",")}, leave-one-out, ${m.keys.length} features, ` +
                `${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
    printMatrix(mx, args.includes("--full"));
    if (cmd === "bake") {
      fs.writeFileSync(PROFILES, JSON.stringify(bake(m, mx), null, 1) + "\n");
      console.log("\nbaked " + path.relative(ROOT, PROFILES));
    }
    process.exit(cmd === "bake" ? 0 : (mx.dominant === m.genres.length ? 0 : 1));
  } else if (cmd === "drift") {
    const base = api.loadProfiles();
    const m = await measure(base.seeds);
    const d = driftOf(m, base);
    const moved = d.filter(x => x.by >= DRIFT_Z);
    console.log(`drift vs ${path.relative(ROOT, PROFILES)} — ` +
                `${moved.length} of ${m.genres.length} genres moved a full spread ` +
                `in some feature\n`);
    // only the ones that actually moved: a hundred rows of 0.000 is not a report,
    // and a quarter of a spread is the smallest movement worth a person's eye
    const shown = d.filter(x => x.by >= 0.25).slice(0, 25);
    for (const x of shown)
      console.log(`  ${x.by >= DRIFT_Z ? "x" : " "} ${x.g.padEnd(18)} d=${x.d.toFixed(3)}` +
                  `  worst ${x.worst} (${x.by.toFixed(2)} spreads)`);
    if (!shown.length) console.log("  nothing has moved a quarter of a spread.");
    process.exit(moved.length ? 1 : 0);
  } else if (cmd === "one") {
    const gk = args[0];
    const m = await measure();
    if (!m.centroids[gk]) { console.error("no such genre: " + gk); process.exit(1); }
    const near = m.genres.filter(g => g !== gk)
      .map(g => ({ g, d: distance(m.centroids[gk], m.centroids[g], m.scale, m.keys) }))
      .sort((a, b) => a.d - b.d).slice(0, 8);
    console.log(gk + " — " + (await tier()).G.GENRES[gk].label + "\n");
    for (const k of m.keys)
      console.log(`  ${k.padEnd(10)} ${num(m.centroids[gk][k]).toFixed(3)}`);
    console.log("\n  nearest genres:");
    for (const n of near)
      console.log(`    ${n.g.padEnd(18)} d=${n.d.toFixed(3)}  score=${scoreOf(n.d)}`);
    // WHAT ACTUALLY SEPARATES THEM, which is the question a failing row raises.
    // A genre that has moved in with its neighbour will show a short list here
    // and a big number for "features agreeing" — that is what "tuned into its
    // neighbour" looks like written down.
    const rival = near[0].g;
    const gaps = m.keys.map(k => ({ k,
      z: Math.abs(num(m.centroids[gk][k]) - num(m.centroids[rival][k])) / m.scale[k] }))
      .sort((a, b) => b.z - a.z);
    console.log(`\n  what separates it from ${rival}:`);
    for (const x of gaps.slice(0, 8))
      console.log(`    ${x.k.padEnd(10)} ${x.z.toFixed(2)} spreads`);
    console.log(`    ...and ${gaps.filter(x => x.z < 0.25).length} of ${gaps.length} ` +
                `features agree to within a quarter spread.`);
  } else {
    console.log("usage: genre-verifier.js [matrix [--full] | bake | drift | one <genre>]");
  }
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
