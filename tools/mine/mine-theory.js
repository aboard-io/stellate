#!/usr/bin/env node
// mine-theory.js — harmony transition tables mined from the MIDI corpus DB
// (tools/mine/corpus-db.js), in exactly the shape theory.js's functional walk
// consumes: FUNC_NEXT (T/S/D 3x3) + POOL (degree weights per function), one
// set per mode family (major / minor).
//
//   node tools/mine/mine-theory.js [--db path] [--min-margin 0.01] [--json out] [--splice]
//
// Method, and the honesty rails:
//   1. DEDUP FIRST — near() proved the trove holds many transcriptions of the
//      same piece (Moonlight x6). Files are bucketed by (key, mode, ~bpm) and
//      greedy-clustered at cosine >= 0.995; one representative per cluster.
//   2. Chords are ESTIMATED (mine-midi chordsOf) per bar, roots taken relative
//      to the DETECTED key (only files with key margin >= --min-margin count),
//      consecutive repeats collapsed, and only DIATONIC roots enter the
//      bigrams — a chromatic bar breaks the chain rather than faking an edge.
//   3. HELD-OUT GATE — files split by id parity AFTER dedup; tables fit on the
//      train half must beat theory.js's hand-written tables on mean held-out
//      log-likelihood, else the mined tables have no business shipping.
//      (test/unit/theory-tables.test.js re-runs this claim against the stored
//      per-mode metrics.)
//
// --splice regenerates the MINED-TABLES block in engine/theory.js between its
// markers (genre-tool style). The tables are OPT-IN at runtime
// (state.theory.tables==="corpus") — absent the flag, theory output stays
// byte-identical, per the standing law.
"use strict";
const fs = require("fs");
const path = require("path");
const Mine = require("./mine-midi.js");
const C = require("./corpus-db.js");

const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
const DEG_FUNC = ["T", "S", "T", "S", "D", "T", "D"];   // theory.js's own pools: T={0,2,5} S={1,3} D={4,6}
const FUNCS = ["T", "S", "D"];

// theory.js's hand tables, for the held-out comparison (kept in sync by the
// theory-tables test, which reads the real ones off the module)
const HAND_FUNC_NEXT = { T: { T: 0.15, S: 0.50, D: 0.35 }, S: { S: 0.15, D: 0.60, T: 0.25 }, D: { D: 0.10, T: 0.75, S: 0.15 } };
const HAND_POOL = { T: [[0, 0.60], [5, 0.25], [2, 0.15]], S: [[3, 0.60], [1, 0.40]], D: [[4, 0.75], [6, 0.25]] };

function degreeSeq(bars, tonic, scale) {
  const rel = [];
  for (const b of bars) { const r = ((b.root - tonic) % 12 + 12) % 12; if (!rel.length || rel[rel.length - 1] !== r) rel.push(r); }
  return rel.map(r => { const d = scale.indexOf(r); return d >= 0 ? d : null; });   // null = chromatic, breaks the chain
}

function fitTables(bigrams) {
  // ML fit of the walk's generative form: P(d1->d2) = FUNC_NEXT[F1][F2] * POOL[F2][d2]
  const fn = {}; for (const f of FUNCS) { fn[f] = {}; for (const g of FUNCS) fn[f][g] = 0.5; }   // Laplace
  const pool = {}; for (const f of FUNCS) { pool[f] = {}; for (let d = 0; d < 7; d++) if (DEG_FUNC[d] === f) pool[f][d] = 0.5; }
  for (const [key, n] of Object.entries(bigrams)) {
    const [d1, d2] = key.split(",").map(Number);
    fn[DEG_FUNC[d1]][DEG_FUNC[d2]] += n;
    pool[DEG_FUNC[d2]][d2] += n;
  }
  for (const f of FUNCS) {
    const tot = FUNCS.reduce((s, g) => s + fn[f][g], 0);
    for (const g of FUNCS) fn[f][g] = +(fn[f][g] / tot).toFixed(4);
    const pt = Object.values(pool[f]).reduce((a, b) => a + b, 0);
    for (const d in pool[f]) pool[f][d] = +(pool[f][d] / pt).toFixed(4);
  }
  return { FUNC_NEXT: fn, POOL: pool };
}
const asPairs = (poolObj) => { const out = {}; for (const f of FUNCS) out[f] = Object.entries(poolObj[f]).map(([d, w]) => [+d, w]); return out; };

function logLik(bigrams, fn, poolPairs) {
  let lp = 0, n = 0;
  const P = {}; for (const f of FUNCS) { P[f] = {}; for (const [d, w] of poolPairs[f]) P[f][d] = w; }
  for (const [key, c] of Object.entries(bigrams)) {
    const [d1, d2] = key.split(",").map(Number);
    const p = (fn[DEG_FUNC[d1]][DEG_FUNC[d2]] || 1e-6) * (P[DEG_FUNC[d2]][d2] || 1e-6);
    lp += c * Math.log(p); n += c;
  }
  return n ? lp / n : 0;
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
  const Sqlite = C.requireSqlite();
  const db = new Sqlite(opt("--db", "/mnt/sources/relocated/stellate-midi-corpus/corpus.db"), { readonly: true });
  const minMargin = +opt("--min-margin", 0.01);

  // ---- 1. dedup by vector similarity, bucketed by (key, mode, ~bpm) ----
  const files = db.prepare("SELECT id,rip,ppq,tsig,key_tonic,key_mode,key_margin,bpm,total_beats FROM files WHERE key_margin>=?").all(minMargin);
  const vecs = new Map(db.prepare("SELECT file_id,blob FROM vec").all()
    .map(r => [r.file_id, new Float32Array(r.blob.buffer, r.blob.byteOffset, r.blob.byteLength / 4)]));
  const buckets = new Map();
  for (const f of files) { const k = `${f.key_tonic}|${f.key_mode}|${Math.round(f.bpm / 5)}`; (buckets.get(k) || buckets.set(k, []).get(k)).push(f); }
  const kept = []; let dropped = 0;
  for (const group of buckets.values()) {
    const reps = [];
    for (const f of group) {
      const v = vecs.get(f.id);
      if (v && reps.some(r => C.cosine(v, vecs.get(r.id)) >= 0.995)) { dropped++; continue; }
      reps.push(f); kept.push(f);
    }
  }
  console.log(`dedup: ${files.length} keyed files -> ${kept.length} kept (${dropped} near-duplicates dropped)`);

  // ---- 2. degree bigrams per mode family, split by id parity ----
  const getNotes = db.prepare("SELECT blob FROM notes WHERE file_id=?");
  const B = { major: { train: {}, test: {} }, minor: { train: {}, test: {} } };
  const stats = { major: { files: 0, trans: 0, chromatic: 0, bars: 0 }, minor: { files: 0, trans: 0, chromatic: 0, bars: 0 } };
  let done = 0;
  for (const f of kept) {
    const scale = f.key_mode === "minor" ? MINOR : MAJOR;
    const blob = getNotes.get(f.id); if (!blob) continue;
    const notes = C.unpackNotes(blob.blob, f.ppq);
    const [nn, den] = (f.tsig || "4/4").split("/").map(Number);
    const parsed = { ppq: f.ppq, notes, totalBeats: f.total_beats, timeSigs: [{ tick: 0, nn: nn || 4, den: den || 4 }] };
    const { bars } = Mine.chordsOf(parsed);
    const seq = degreeSeq(bars, f.key_tonic, scale);
    const S = stats[f.key_mode === "minor" ? "minor" : "major"];
    const bag = B[f.key_mode === "minor" ? "minor" : "major"][f.id % 2 === 0 ? "train" : "test"];
    S.files++; S.bars += seq.length;
    for (let i = 0; i + 1 < seq.length; i++) {
      if (seq[i] == null || seq[i + 1] == null) { if (seq[i + 1] == null) S.chromatic++; continue; }
      if (seq[i] === seq[i + 1]) continue;
      bag[`${seq[i]},${seq[i + 1]}`] = (bag[`${seq[i]},${seq[i + 1]}`] || 0) + 1; S.trans++;
    }
    if (++done % 4000 === 0) console.log(`  ${done}/${kept.length} mined…`);
  }

  // ---- 3. fit on train, judge on test ----
  const out = { minMargin, dedup: { total: files.length, kept: kept.length, dropped }, modes: {} };
  for (const m of ["major", "minor"]) {
    const t = fitTables(B[m].train);
    const pairs = asPairs(t.POOL);
    const held = {
      mined: +logLik(B[m].test, t.FUNC_NEXT, pairs).toFixed(4),
      hand: +logLik(B[m].test, HAND_FUNC_NEXT, HAND_POOL).toFixed(4),
      uniform: +Math.log(1 / 7).toFixed(4),
    };
    const S = stats[m];
    out.modes[m] = { FUNC_NEXT: t.FUNC_NEXT, POOL: pairs, heldOutLogLik: held,
      files: S.files, transitions: S.trans, chromaticRate: +(S.chromatic / Math.max(1, S.bars)).toFixed(3) };
    console.log(`\n${m}: ${S.files} files, ${S.trans} transitions, chromatic-bar rate ${out.modes[m].chromaticRate}`);
    console.log(`  FUNC_NEXT ${JSON.stringify(t.FUNC_NEXT)}`);
    console.log(`  POOL      ${JSON.stringify(pairs)}`);
    console.log(`  held-out mean log-lik: mined ${held.mined}  hand ${held.hand}  uniform ${held.uniform}  ${held.mined > held.hand ? "MINED WINS" : "hand wins — DO NOT SPLICE"}`);
  }

  const ji = argv.indexOf("--json");
  if (ji >= 0) { fs.writeFileSync(argv[ji + 1], JSON.stringify(out, null, 1)); console.log("wrote", argv[ji + 1]); }

  // ---- 4. splice into theory.js (only when mined wins both modes) ----
  if (argv.includes("--splice")) {
    if (!(out.modes.major.heldOutLogLik.mined > out.modes.major.heldOutLogLik.hand &&
          out.modes.minor.heldOutLogLik.mined > out.modes.minor.heldOutLogLik.hand)) {
      console.error("splice refused: mined tables do not beat the hand tables on held-out data in both modes");
      process.exit(3);
    }
    const tj = path.join(__dirname, "..", "..", "engine", "theory.js");
    const src = fs.readFileSync(tj, "utf8");
    const BEGIN = "  // ---- MINED-TABLES BEGIN (tools/mine/mine-theory.js — do not hand-edit) ----";
    const END = "  // ---- MINED-TABLES END ----";
    const day = new Date().toISOString().slice(0, 10);
    const block = `${BEGIN}
  // Corpus-fit FUNC_NEXT/POOL (MIDIMAN trove via corpus-db, ${day}): ${out.modes.major.files}+${out.modes.minor.files}
  // deduped files, ${out.modes.major.transitions}+${out.modes.minor.transitions} diatonic root transitions. Held-out mean
  // log-lik (mined vs hand): major ${out.modes.major.heldOutLogLik.mined} vs ${out.modes.major.heldOutLogLik.hand}, minor ${out.modes.minor.heldOutLogLik.mined} vs ${out.modes.minor.heldOutLogLik.hand}.
  // OPT-IN via progress({tables:"corpus"}) / state.theory.tables — absent, the
  // hand tables above run byte-identically (test/unit/theory-tables.test.js).
  const MINED=${JSON.stringify({ major: { FUNC_NEXT: out.modes.major.FUNC_NEXT, POOL: out.modes.major.POOL },
                                 minor: { FUNC_NEXT: out.modes.minor.FUNC_NEXT, POOL: out.modes.minor.POOL } })};
${END}`;
    const b = src.indexOf(BEGIN), e = src.indexOf(END);
    let next;
    if (b >= 0 && e > b) next = src.slice(0, b) + block + src.slice(e + END.length);
    else {
      const anchor = "  function wpick(pairs,r)";
      if (!src.includes(anchor)) { console.error("splice: anchor not found in theory.js"); process.exit(3); }
      next = src.replace(anchor, block + "\n" + anchor);
    }
    fs.writeFileSync(tj, next);
    console.log("spliced MINED tables into engine/theory.js");
  }
}
main();
