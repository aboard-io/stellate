#!/usr/bin/env node
/* tools/theory-census.js — WHAT THE BOX ACTUALLY WRITES, MEASURED.
 *
 *   node tools/theory-census.js                  the whole catalogue, seeds 1-3
 *   node tools/theory-census.js --seeds=1        fewer seeds
 *   node tools/theory-census.js --only=punk,bossa   a few rows
 *   node tools/theory-census.js --repair         …and run the copyist, and
 *                                                re-measure after it
 *   node tools/theory-census.js --md=<path>      write the report as markdown
 *   node tools/theory-census.js --json=<path>    write the raw per-row numbers
 *
 * WHY THIS EXISTS (2026-09-06, docs/THEORY.md §2). The box compiles every
 * voice INDEPENDENTLY — a chair reads a motif through a word, at its own
 * register, with its own entry, and nothing looks at what the other chairs are
 * doing. So nothing prevents two lines moving in parallel octaves for eight
 * bars, a pad voicing that doubles the leading tone, or a voiced harmony that
 * never sounds its own third. THEORY.md's law is that the pass MEASURES FIRST
 * and that the census is the deliverable even if nothing is repaired, because
 * it says which genres have the problem and how badly.
 *
 * IT READS THE RENDER, NOT THE TABLES ([[test-the-artifact]]). Every number
 * below comes off `document.js scoreOf`'s events — the same events the tape,
 * the .mid and the staff are folded from — and the harmony it measures them
 * against comes off `document.js chordsIn`, which is what the record SAYS is
 * sounding. A census taken off the genre rows would be a census of the
 * catalogue's intentions.
 *
 * ---- WHAT A "VOICE" IS HERE, WHICH IS THE WHOLE DESIGN -------------------
 * A chorale has four voices and each of them sings one note. This box has
 * CHAIRS, and a chair may be either:
 *   · MONOPHONIC — `part` is line/lead/counter/etc: one note at a time, and
 *     the chair IS a voice. The bass is one of these.
 *   · A VOICED HARMONY — `part: "pad"`, or a chair whose part policy locks it
 *     to the chord (a stab, a skank, a comping hand): several notes at once.
 *     Those notes are not one voice, and they are not N unrelated voices
 *     either — `kernel.js voiceLead` moves them minimally chord to chord, so
 *     the SUB-VOICE IS THE PITCH RANK: the top note of the voicing is one
 *     voice, the next one down is another. That is the reading the kernel's
 *     own voice-leading memory already implies, and it is why a pad's
 *     parallels are findable at all.
 * A voice is therefore (chair, rank), and a column is a moment.
 * `tools/theory.js voicesOf` builds that matrix — it is the ONE owner, because
 * the copyist pass repairs exactly what this census measures and two copies of
 * "what a voice is" would eventually be measuring two different scores.
 *
 * ---- AND WHAT IS NOT MEASURED, SAID OUT LOUD -----------------------------
 * `tools/theory.js` knows nine part-writing rules and this census asks for
 * FOUR of them, the four THEORY.md §2 names: parallel fifths and octaves,
 * notes outside a chair's range, doubled leading tones, and chord tones
 * missing from a voiced harmony. The other five — voice crossing, spacing,
 * the melodic augmented second, the leap wider than an octave, the leading
 * tone's resolution — are CHORALE rules, and a band is not a chorale: a bass
 * crossing above a pad's bottom note, or a synth line leaping two octaves, is
 * ordinary music here and counting it would be crying wolf. They are one
 * argument away (`--rules=`) and the checker still holds a chorale to all
 * nine, which is where they belong.
 *
 * A ROW WHOSE ALPHABET DOES NOT REPEAT AT THE OCTAVE IS COUNTED SEPARATELY.
 * `period` (kernel.js degPitch) lets a row's scale close at 11.8 or 12.6
 * semitones instead of 12; in such a row "a perfect fifth" is not seven
 * semitones and "an octave" is not twelve, so the parallel rule is asking a
 * question in the wrong units. Those rows are listed and excluded from the
 * parallel counts rather than quietly given a score.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

globalThis.window = globalThis;
const K = require(path.join(ROOT, "nukernel/kernel.js"));
const G = require(path.join(ROOT, "nukernel/genres.js"));
const D = require(path.join(ROOT, "nukernel/document.js"));
const P = require(path.join(ROOT, "nukernel/precompose.js"));
const I = require(path.join(ROOT, "nukernel/instruments.js"));
const T = require(path.join(ROOT, "tools/theory.js"));

const pcw = (n) => ((n % 12) + 12) % 12;
const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith("--" + name + "="));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const flag = (name) => process.argv.includes("--" + name);

/* ---- THE CHAIRS, AND THE COMPASS EACH ONE HAS --------------------------
   A chair's range is its INSTRUMENT's, and the instrument's compass is
   `nukernel/instruments.js RANGES` — the table the register fold already
   uses, borrowed verbatim from the parent registry where the parent has a
   row. Asking any other table would mean this census marks a note out of
   range that the engine itself considers in range.

   AN UNLISTED INSTRUMENT HAS NO RANGE FAULT, and that is deliberate rather
   than lazy: RANGES does not list a synth (a synth has no compass), and
   scoring a saw lead against a number nobody wrote down would be inventing
   the fault. Those chairs are counted as "uncompassed" and reported. */
const RANGES = I.RANGES || {};
function chairsOf(doc) {
  const lines = doc.voices.filter((v) => v.kind === "line");
  const bassV = doc.voices.find((v) => v.kind === "bass");
  return { lines, bassV };
}
const rangeOf = (instr) => {
  if (!instr) return null;
  const r = RANGES[instr];
  return Array.isArray(r) ? { lo: r[0], hi: r[1] } : null;
};

/* ---- THE VOICE MODEL LIVES IN tools/theory.js ---------------------------
   `Theory.voicesOf` turns a stream of events into voices and columns, and
   `Theory.missingTones` asks the fourth question. Both were written HERE
   first and moved, for the reason docs/THEORY.md §1 gives about the chorale
   checker: the copyist pass repairs what this census measures, and a census
   with its own copy of "what a voice is" would eventually measure a different
   score from the one the pass repaired. What is left in this file is what
   only this file knows — which rows to walk, which chair holds which
   instrument, and how to print the result. */

/* THE LEADING TONE, AND ONLY WHERE THERE IS ONE. A row in aeolian, dorian,
   mixolydian or any pentatonic has a SUBTONIC, a whole tone under the tonic,
   and doubling it is not a fault — it is the mode. So the leading tone is
   read off the record's own alphabet and is null unless the seventh degree is
   actually eleven semitones above the tonic. Measured before this rule was
   written: taking key+11 unconditionally reported a "doubled leading tone" in
   every modal row in the catalogue, which is the checker crying wolf on the
   music the catalogue was built to hold. */
function leadingToneOf(doc) {
  const A = doc.alphabet || {};
  const md = (G.MODES && G.MODES[A.mode]) || null;
  if (!md || !md.length) return null;
  const seventh = md[md.length - 1];
  return seventh === 11 ? pcw((A.key | 0) + 11) : null;
}
const periodOf = (doc) => {
  const A = doc.alphabet || {};
  const sc = (G.SCALES && G.SCALES[A.scale]) || null;
  return (sc && sc.period) || 12;
};

/* ---- ONE RECORD, MEASURED ---------------------------------------------- */
/* THE FIVE NUMBERS. Four are THEORY.md §2's own list; `unsounded` is the
   second, band-wide reading of its fourth ("chord tones missing from a voiced
   harmony"), counted beside the strict one because the phrase carries both
   meanings and the two answer very differently. `missing` is repairable and
   `unsounded` is not — see tools/theory.js. */
const CODES = ["parallel5", "parallel8", "range", "doubledLT", "missing", "unsounded"];

/* THE CHAIRS A RECORD SEATS, as `Theory.voicesOf` wants them: the compass
   each one has, and which part it is playing. The instrument is the
   document's for a line and the GENRE's for the bass — the bass chair
   carries no instrument in the document (`toGenre` resolves `bassInstr`),
   and reading `bassV.instrument` here answered `undefined` on every record,
   which is "declared but never arriving" said about a measurement instead of
   a sound. */
function chairMetaOf(doc, g) {
  const { lines, bassV } = chairsOf(doc);
  const out = {};
  const nP = Math.max(1, lines.length);
  const nv = Math.max(nP, (g && g.voices) | 0);
  for (let v = 0; v < nv; v++) {
    const c = lines[v % nP];
    const R = rangeOf(c && c.instrument);
    out["v" + v] = { name: "chair " + v + (c && c.instrument ? " (" + c.instrument + ")" : ""),
                     instr: (c && c.instrument) || null,
                     part: (c && c.cast && c.cast.part) || null,
                     lo: R ? R.lo : null, hi: R ? R.hi : null };
  }
  const bi = (g && g.bassInstr) || (bassV && bassV.instrument) || null;
  const BR = rangeOf(bi);
  out.bass = { name: "bass" + (bi ? " (" + bi + ")" : ""), instr: bi, part: "bass",
               lo: BR ? BR.lo : null, hi: BR ? BR.hi : null };
  return out;
}

/* ---- A FAULT IS COUNTED WHERE IT HAPPENS, NOT WHERE IT GOES ON SOUNDING --
   The first run of this census reported 3,813 missing chord tones and 382
   out-of-range notes across six records, and both numbers were the same
   handful of faults counted once per column they sustained through: a pad
   voicing holds for thirty-two columns, so one hole in one chord was
   thirty-two "faults". The vertical rules are therefore counted at ONSET —
   the column where one of the notes involved actually begins — which is what
   a musician means by "how many times does this happen". The parallel rules
   need no such filter: a parallel requires BOTH voices to move, so a
   sustained note is oblique and was never counted twice.

   THE HONEST UNIT IS PART OF THE MEASUREMENT and it is stated here rather
   than chosen quietly, because the difference between the two readings is a
   factor of thirty and either one could be made to look like the answer. */
function onsetMask(V) {
  return V.voices.map((v) => v.events.map((e, i) => !!e && (i === 0 || v.events[i - 1] !== e)));
}
function atOnset(V, faults, lt) {
  const on = onsetMask(V);
  const anyLT = (i) => V.voices.some((v, vi) =>
    on[vi][i] && v.notes[i] != null && lt != null && pcw(v.notes[i]) === pcw(lt));
  const anyChair = (i, chair) => V.voices.some((v, vi) => on[vi][i] && v.chair === chair);
  return faults.filter((f) => {
    if (f.code === "parallel5" || f.code === "parallel8") return true;
    const i = f.at && f.at.i;
    if (i == null) return true;
    if (f.code === "range") {
      const vi = (f.voices || [])[0];
      return vi == null ? true : !!on[vi][i];
    }
    if (f.code === "doubledLT") return anyLT(i);
    if (f.code === "missing") return anyChair(i, f.chair);
    if (f.code === "unsounded") return true;   // already counted at attacks
    return true;
  });
}

function measure(gk, seed, opts) {
  const doc = P.genreToDocument(gk, seed);
  const g = D.toGenre(doc, 0, G.GENRES);
  const sc = D.scoreOf(doc, G.GENRES);
  const ch = D.chordsIn(doc, G.GENRES);
  const period = periodOf(doc);
  const lt = leadingToneOf(doc);
  const ctx = { chairs: chairMetaOf(doc, g), chords: ch.chords,
                leadingTone: lt, period };
  const V = T.voicesOf(sc.events, ctx);
  const chords = T.chordsAt(V.times, ch.chords);
  /* A ROW WHOSE ALPHABET DOES NOT REPEAT AT 2:1 IS NOT ASKED ABOUT
     PARALLELS. `period` (kernel.js degPitch) lets a scale close at 12.08
     semitones; there "a perfect fifth" is not seven semitones and "an octave"
     is not twelve, so the rule would be asking its question in the wrong
     units. Those rows are listed and left out of the parallel counts rather
     than quietly given a score. */
  const rules = (opts && opts.rules) ||
    (period === 12 ? ["parallel5", "parallel8", "range", "doubledLT"]
                   : ["range", "doubledLT"]);
  const faults = T.faults(V.voices, {
    chords, leadingTone: lt, tonic: pcw(doc.alphabet.key | 0), rules,
  }).concat(T.missingTones(V.voices, V.times, chords))
   .concat(T.unsoundedTones(V.voices, V.times, chords));
  const faultsAt = atOnset(V, faults, lt);
  const tally = Object.fromEntries(CODES.map((c) => [c, 0]));
  for (const f of faultsAt) if (tally[f.code] != null) tally[f.code]++;
  return {
    gk, seed, period, lt, notes: sc.events.filter((e) => e.n != null).length,
    columns: V.times.length, voices: V.voices.length,
    uncompassed: V.voices.filter((v) => v.lo == null).length,
    tally, total: Object.values(tally).reduce((a, b) => a + b, 0),
    faults: faultsAt, rawFaults: faults, doc, g, sc, ch, V, chords, ctx,
  };
}

module.exports = { measure, chairMetaOf, leadingToneOf, periodOf, rangeOf, CODES };

/* ---- THE RUN ------------------------------------------------------------ */
if (require.main === module) {
  const seeds = String(arg("seeds", "1,2,3")).split(",").map(Number);
  const only = arg("only", null);
  /* THE FIVE OTHER RULES ARE ONE ARGUMENT AWAY, and the header says so, so
     the argument has to exist: a promise in a comment with no code under it
     is the failure this repo calls "declared but never arriving". */
  const ruleArg = arg("rules", null);
  const opts = ruleArg ? { rules: ruleArg.split(",") } : null;
  const keys = only ? only.split(",") : Object.keys(G.GENRES);
  const rows = [];
  let t0 = Date.now();
  keys.forEach((gk, i) => {
    for (const s of seeds) {
      let m;
      try { m = measure(gk, s, opts); }
      catch (e) { rows.push({ gk, seed: s, error: e.message }); continue; }
      rows.push({ gk: m.gk, seed: m.seed, period: m.period, lt: m.lt,
                  notes: m.notes, columns: m.columns, voices: m.voices,
                  uncompassed: m.uncompassed, tally: m.tally, total: m.total });
    }
    if (!only && i % 40 === 0)
      process.stderr.write("  " + i + "/" + keys.length + " rows, " +
                           ((Date.now() - t0) / 1000).toFixed(0) + "s\n");
  });
  const jsonOut = arg("json", null);
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(rows, null, 1));
  const md = arg("md", null);
  process.stdout.write(report(rows, keys, seeds));
  if (md) { fs.writeFileSync(md, report(rows, keys, seeds)); }
}

/* ---- THE REPORT --------------------------------------------------------
   Rows are ranked on faults PER HUNDRED NOTES and not on the raw count,
   because a thirteen-section record with six chairs writes six times the
   notes of a two-chair drone and would top any list ranked on volume. The
   rate is what says "this row has the problem badly"; the raw count is
   printed beside it so nobody has to trust the division. */
function report(rows, keys, seeds) {
  const L = [];
  const good = rows.filter((r) => !r.error);
  const bad = rows.filter((r) => r.error);
  const sum = Object.fromEntries(CODES.map((c) =>
    [c, good.reduce((a, r) => a + r.tally[c], 0)]));
  const notes = good.reduce((a, r) => a + r.notes, 0);
  const cols = good.reduce((a, r) => a + r.columns, 0);
  L.push("# THE FAULT CENSUS — " + keys.length + " rows x seeds " + seeds.join(",") +
         " = " + rows.length + " records");
  L.push("");
  L.push(notes.toLocaleString("en-US") + " sounding notes, " +
         cols.toLocaleString("en-US") + " columns, " + bad.length + " records would not compose");
  L.push("");
  L.push("| fault | count | per 1,000 notes |");
  L.push("|---|---:|---:|");
  for (const c of CODES)
    L.push("| " + c + " | " + sum[c] + " | " + (1000 * sum[c] / (notes || 1)).toFixed(1) + " |");
  L.push("");

  /* PER ROW, over its seeds — a row is the unit a hand edits, so the row is
     the unit this ranks. */
  const byRow = new Map();
  for (const r of good) {
    if (!byRow.has(r.gk)) byRow.set(r.gk, { gk: r.gk, notes: 0, n: 0, period: r.period,
                                            tally: Object.fromEntries(CODES.map((c) => [c, 0])) });
    const a = byRow.get(r.gk);
    a.notes += r.notes; a.n++;
    for (const c of CODES) a.tally[c] += r.tally[c];
  }
  const list = [...byRow.values()].map((a) => ({
    ...a, total: CODES.reduce((x, c) => x + a.tally[c], 0),
  })).map((a) => ({ ...a, rate: 1000 * a.total / (a.notes || 1) }));
  const line = (a) => "| `" + a.gk + "` | " + a.rate.toFixed(1) + " | " + a.total +
    " | " + a.notes + " | " + CODES.map((c) => a.tally[c]).join(" · ") + " |";
  const head = ["| row | per 1,000 | faults | notes | " + CODES.join(" · ") + " |",
                "|---|---:|---:|---:|---|"];
  L.push("## the ten worst rows");
  L.push(...head);
  for (const a of [...list].sort((x, y) => y.rate - x.rate).slice(0, 10)) L.push(line(a));
  L.push("");
  L.push("## the ten cleanest rows (of those that write enough notes to be judged)");
  L.push(...head);
  const judgeable = list.filter((a) => a.notes >= 300);
  for (const a of judgeable.sort((x, y) => x.rate - y.rate || y.notes - x.notes).slice(0, 10))
    L.push(line(a));
  L.push("");
  L.push("## by family");
  L.push("| family | rows | notes | per 1,000 | " + CODES.join(" · ") + " |");
  L.push("|---|---:|---:|---:|---|");
  const fam = new Map();
  for (const a of list) {
    const f = (G.GENRES[a.gk] && G.GENRES[a.gk].family) || "(none)";
    if (!fam.has(f)) fam.set(f, { f, rows: 0, notes: 0,
                                  tally: Object.fromEntries(CODES.map((c) => [c, 0])) });
    const x = fam.get(f);
    x.rows++; x.notes += a.notes;
    for (const c of CODES) x.tally[c] += a.tally[c];
  }
  for (const x of [...fam.values()].sort((a, b) =>
      (CODES.reduce((s, c) => s + b.tally[c], 0) / (b.notes || 1)) -
      (CODES.reduce((s, c) => s + a.tally[c], 0) / (a.notes || 1))))
    L.push("| " + x.f + " | " + x.rows + " | " + x.notes + " | " +
           (1000 * CODES.reduce((s, c) => s + x.tally[c], 0) / (x.notes || 1)).toFixed(1) +
           " | " + CODES.map((c) => x.tally[c]).join(" · ") + " |");
  L.push("");
  const per = list.filter((a) => a.period !== 12);
  L.push("Rows whose alphabet does not repeat at 2:1, and which are therefore not " +
         "asked about parallels: " + (per.length ? per.map((a) => a.gk).join(", ") : "none") + ".");
  if (bad.length) {
    L.push("");
    L.push("Records that would not compose: " +
           bad.slice(0, 20).map((b) => b.gk + "/" + b.seed).join(", "));
  }
  L.push("");
  return L.join("\n");
}
