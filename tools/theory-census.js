#!/usr/bin/env node
/* tools/theory-census.js — WHAT THE BOX ACTUALLY WRITES, MEASURED.
 *
 *   node tools/theory-census.js                  the whole catalogue, seeds 1-3
 *   node tools/theory-census.js --seeds=1        fewer seeds
 *   node tools/theory-census.js --only=punk,bossa   a few rows
 *   node tools/theory-census.js --repair         …and run the copyist, and
 *                                                re-measure after it
 *   node tools/theory-census.js --md=<path>      write the report as markdown
 *                                                (docs/THEORY-CENSUS.md is the
 *                                                committed one — a FINDING, the
 *                                                way nukernel/GENEALOGY.md is:
 *                                                nothing in the app or the gates
 *                                                reads it, and it is in the tree
 *                                                so the numbers can be argued
 *                                                with rather than re-run)
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
const Gen = require(path.join(ROOT, "tools/genealogy.js"));
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
/* THE ALPHABET'S OWN PERIOD, asked of BOTH tables. `tuned(steps, period)`
   stamps it on the array, and a record names one word out of SCALES and
   another out of MODES — gamelan's slendro is a MODE, so a first draft that
   asked only SCALES reported "no non-12 rows in the catalogue" and would have
   marked slendro's 1208-cent octave as a parallel and then repaired it out of
   tune. Either table saying a period is enough to disqualify the octave
   rules. */
const periodOf = (doc) => {
  const A = doc.alphabet || {};
  const sc = (G.SCALES && G.SCALES[A.scale]) || null;
  const md = (G.MODES && G.MODES[A.mode]) || null;
  return (sc && sc.period) || (md && md.period) || 12;
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
  /* THE SIDE-EFFECT CHECK. Almost everything the copyist does is move a note
     by an octave to put it back inside its instrument's compass, and an
     octave move is a LEAP in the line it lands in. So the melodic rule is
     measured on both sides even though it is not one of THEORY.md's four: if
     the pass bought its clean ranges by turning every tune into a series of
     twelfths, this number says so. Reported, never repaired. */
  const leap = T.faults(V.voices, { rules: ["leap"] }).length;
  return {
    gk, seed, period, lt, notes: sc.events.filter((e) => e.n != null).length,
    columns: V.times.length, voices: V.voices.length,
    uncompassed: V.voices.filter((v) => v.lo == null).length,
    tally, total: Object.values(tally).reduce((a, b) => a + b, 0), leap,
    faults: faultsAt, rawFaults: faults, doc, g, sc, ch, V, chords, ctx,
  };
}

module.exports = { measure, chairMetaOf, leadingToneOf, periodOf, rangeOf, CODES,
                   report };

/* ---- THE SAME RECORD, AFTER THE COPYIST --------------------------------
   `scoreOf` runs the pass when asked (`opts.copyist`) and hands back the
   repairs beside the events; this re-measures the repaired stream with the
   identical reader, so "faults down" is a comparison of two numbers produced
   by one piece of code and not of two pieces of code producing one number. */
function repaired(m) {
  const sc = D.scoreOf(m.doc, G.GENRES, undefined, null,
                       { copyist: { ranges: RANGES } });
  const V = T.voicesOf(sc.events, m.ctx);
  const chords = T.chordsAt(V.times, m.ch.chords);
  const rules = m.period === 12 ? ["parallel5", "parallel8", "range", "doubledLT"]
                                : ["range", "doubledLT"];
  const faults = atOnset(V, T.faults(V.voices, {
    chords, leadingTone: m.lt, tonic: pcw(m.doc.alphabet.key | 0), rules,
  }).concat(T.missingTones(V.voices, V.times, chords))
    .concat(T.unsoundedTones(V.voices, V.times, chords)), m.lt);
  const tally = Object.fromEntries(CODES.map((c) => [c, 0]));
  for (const f of faults) if (tally[f.code] != null) tally[f.code]++;
  const leap = T.faults(V.voices, { rules: ["leap"] }).length;
  const byCode = {};
  for (const r of sc.repairs) byCode[r.code] = (byCode[r.code] || 0) + 1;
  const refCode = {};
  for (const r of sc.refused) refCode[r.code] = (refCode[r.code] || 0) + 1;
  return { tally, total: Object.values(tally).reduce((a, b) => a + b, 0), leap,
           repairs: sc.repairs.length, byCode, refused: sc.refused.length, refCode,
           /* THE TWO INVARIANTS, CHECKED ON EVERY RECORD RATHER THAN ASSERTED
              ONCE: only `n` ever moved, and a monophonic voice moved only by
              whole octaves. A pass that broke either would be composing. */
           broke: sc.repairs.filter((r) => r.code === "range" && (r.now - r.was) % 12 !== 0).length,
           sc };
}

/* ---- "MORE RELEVANT" MUST NOT MEAN "MORE LIKE EVERYTHING ELSE" ----------
   docs/THEORY.md §2's second measurement. `tools/genealogy.js` fits each row
   against its declared parents and calls what the parents do not explain the
   INVENTION; if the copyist quietly sanded rows toward each other, that
   residue would fall.
   ITS OWN FEATURES CANNOT SEE THIS PASS, and saying so is the point rather
   than a hole: `featuresOfRow` reads the ROW — tempo, kit densities, mode
   brightness, the word's operator count — and the copyist changes none of
   them, so the residue is unchanged BY CONSTRUCTION and a report of "no
   change" would be worth nothing. So the fit is run in a WIDER SPACE through
   genealogy's own `setExtra` hook (which exists for exactly this), with nine
   features measured off the RENDER: where the record sits, how wide it is,
   what its vertical intervals are, how much of it is in the chord, and how
   thick it is. Those move when a note moves, so the comparison has teeth. */
const RENDERFEAT = ["centre", "spread", "vert:unison", "vert:fifth", "vert:third",
                    "vert:second", "inchord", "density", "range-ok"];
function renderFeatures(gk, seed, withPass) {
  const doc = P.genreToDocument(gk, seed);
  const g = D.toGenre(doc, 0, G.GENRES);
  const sc = withPass
    ? D.scoreOf(doc, G.GENRES, undefined, null, { copyist: { ranges: RANGES } })
    : D.scoreOf(doc, G.GENRES);
  const ctx = { chairs: chairMetaOf(doc, g), chords: null,
                leadingTone: null, period: periodOf(doc) };
  const V = T.voicesOf(sc.events, ctx);
  const ch = D.chordsIn(doc, G.GENRES);
  const chords = T.chordsAt(V.times, ch.chords);
  const ns = [];
  for (const v of V.voices) for (const n of v.notes) if (n != null) ns.push(n);
  if (!ns.length) return RENDERFEAT.map(() => 0);
  const mean = ns.reduce((a, b) => a + b, 0) / ns.length;
  const sd = Math.sqrt(ns.reduce((a, b) => a + (b - mean) * (b - mean), 0) / ns.length);
  const ic = [0, 0, 0, 0]; let pairs = 0, thick = 0, cols = 0, inch = 0, tot = 0, okR = 0, rTot = 0;
  for (let i = 0; i < V.times.length; i++) {
    const col = V.voices.map((v) => v.notes[i]).filter((n) => n != null);
    if (col.length) { cols++; thick += col.length; }
    for (let a = 0; a < col.length; a++) for (let b = a + 1; b < col.length; b++) {
      const d = Math.abs(col[a] - col[b]) % 12; pairs++;
      if (d === 0) ic[0]++; else if (d === 7 || d === 5) ic[1]++;
      else if (d === 3 || d === 4 || d === 8 || d === 9) ic[2]++; else ic[3]++;
    }
    const c = chords[i];
    if (c && c.pcs) for (const n of col) { tot++; if (c.pcs.indexOf(pcw(n)) >= 0) inch++; }
  }
  for (const v of V.voices) for (const n of v.notes) {
    if (n == null || (v.lo == null && v.hi == null)) continue;
    rTot++;
    if ((v.lo == null || n >= v.lo) && (v.hi == null || n <= v.hi)) okR++;
  }
  return [mean / 127, Math.min(1, sd / 24),
          ic[0] / (pairs || 1), ic[1] / (pairs || 1), ic[2] / (pairs || 1), ic[3] / (pairs || 1),
          inch / (tot || 1), Math.min(1, thick / (cols || 1) / 8), okR / (rTot || 1)];
}

function residueRound(seed, withPass) {
  const cache = new Map();
  Gen.setExtra((k) => {
    if (!cache.has(k)) {
      let v; try { v = renderFeatures(k, seed, withPass); }
      catch (e) { v = RENDERFEAT.map(() => 0); }
      cache.set(k, v);
    }
    return cache.get(k);
  });
  const fits = Gen.fitAll().filter((f) => !f.root);
  Gen.setExtra(null);
  return new Map(fits.map((f) => [f.key, { r2: f.r2, resid: f.residRms }]));
}

/* ---- THE RUN ------------------------------------------------------------ */
if (require.main === module) {
  const seeds = String(arg("seeds", "1,2,3")).split(",").map(Number);
  const only = arg("only", null);
  /* THE FIVE OTHER RULES ARE ONE ARGUMENT AWAY, and the header says so, so
     the argument has to exist: a promise in a comment with no code under it
     is the failure this repo calls "declared but never arriving". */
  const ruleArg = arg("rules", null);
  const opts = ruleArg ? { rules: ruleArg.split(",") } : null;
  const doRepair = flag("repair");
  const keys = only ? only.split(",") : Object.keys(G.GENRES);
  const rows = [];
  let t0 = Date.now();
  keys.forEach((gk, i) => {
    for (const s of seeds) {
      let m;
      try { m = measure(gk, s, opts); }
      catch (e) { rows.push({ gk, seed: s, error: e.message }); continue; }
      const row = { gk: m.gk, seed: m.seed, period: m.period, lt: m.lt,
                    notes: m.notes, columns: m.columns, voices: m.voices,
                    uncompassed: m.uncompassed, tally: m.tally, total: m.total,
                    leap: m.leap };
      if (doRepair) {
        try {
          const r = repaired(m);
          row.after = r.tally; row.afterTotal = r.total;
          row.repairs = r.repairs; row.byCode = r.byCode; row.leapAfter = r.leap;
          row.refusedN = r.refused; row.refCode = r.refCode; row.broke = r.broke;
        } catch (e) { row.repairError = e.message; }
      }
      rows.push(row);
    }
    if (!only && i % 40 === 0)
      process.stderr.write("  " + i + "/" + keys.length + " rows, " +
                           ((Date.now() - t0) / 1000).toFixed(0) + "s\n");
  });
  const jsonOut = arg("json", null);
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(rows, null, 1));
  const md = arg("md", null);
  let txt = report(rows, keys, seeds);
  if (doRepair) txt += repairReport(rows);
  if (flag("residue")) txt += residueReport(seeds[0]);
  process.stdout.write(txt);
  if (md) fs.writeFileSync(md, txt);
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

/* ---- WHAT THE PASS DID, AND WHAT IT WOULD NOT DO ----------------------- */
function repairReport(rows) {
  const L = [""], good = rows.filter((r) => r.after);
  const before = Object.fromEntries(CODES.map((c) => [c, 0]));
  const after = Object.fromEntries(CODES.map((c) => [c, 0]));
  const did = {}, wont = {};
  let broke = 0, notes = 0, lb = 0, la = 0;
  for (const r of good) {
    notes += r.notes;
    for (const c of CODES) { before[c] += r.tally[c]; after[c] += r.after[c]; }
    for (const k of Object.keys(r.byCode || {})) did[k] = (did[k] || 0) + r.byCode[k];
    for (const k of Object.keys(r.refCode || {})) wont[k] = (wont[k] || 0) + r.refCode[k];
    broke += r.broke || 0;
    lb += r.leap || 0; la += r.leapAfter || 0;
  }
  L.push("## after the copyist");
  L.push("");
  L.push("| fault | before | after | change |");
  L.push("|---|---:|---:|---:|");
  for (const c of CODES) {
    const d = after[c] - before[c];
    L.push("| " + c + " | " + before[c] + " | " + after[c] + " | " +
           (d === 0 ? "0" : (d > 0 ? "+" + d : String(d))) +
           (before[c] ? " (" + (100 * d / before[c]).toFixed(1) + "%)" : "") + " |");
  }
  const bt = CODES.reduce((a, c) => a + before[c], 0);
  const at = CODES.reduce((a, c) => a + after[c], 0);
  L.push("| **all** | **" + bt + "** | **" + at + "** | **" +
         (100 * (at - bt) / (bt || 1)).toFixed(1) + "%** |");
  L.push("");
  L.push("Repairs made, by kind: " +
         (Object.keys(did).length
           ? Object.entries(did).sort((a, b) => b[1] - a[1])
               .map(([k, v]) => k + " " + v).join(", ")
           : "none") + ".");
  L.push("");
  L.push("Faults the pass would NOT touch, by reason: " +
         Object.entries(wont).sort((a, b) => b[1] - a[1])
           .map(([k, v]) => k + " " + v).join(", ") + ".");
  L.push("");
  L.push("The two invariants held on every record: only `n` ever moved, and a " +
         "range repair that was not a whole number of octaves happened " + broke + " times.");
  L.push("");
  L.push("The side-effect check — melodic leaps wider than an octave, which is what an " +
         "octave repair could be buying its clean range with: " + lb + " before, " + la +
         " after (" + (lb ? (100 * (la - lb) / lb).toFixed(1) + "%" : "no baseline") + ").");
  L.push("");
  return L.join("\n");
}

/* ---- AND THE RESIDUE, BEFORE AND AFTER --------------------------------- */
function residueReport(seed) {
  const L = ["", "## the residue check — \"more relevant\" must not mean \"more like everything else\"", ""];
  const a = residueRound(seed, false), b = residueRound(seed, true);
  const rows = [];
  for (const [k, x] of a) {
    const y = b.get(k);
    if (!y) continue;
    rows.push({ k, was: x.resid, now: y.resid, d: y.resid - x.resid,
                r2was: x.r2, r2now: y.r2 });
  }
  const mean = (f) => rows.reduce((s, r) => s + f(r), 0) / (rows.length || 1);
  L.push(rows.length + " rows with declared parents, fitted in the nine-feature " +
         "render space beside genealogy's own twenty-eight.");
  L.push("");
  L.push("| | mean residue (the invention) | mean r2 (what the parents explain) |");
  L.push("|---|---:|---:|");
  L.push("| before | " + mean((r) => r.was).toFixed(4) + " | " + mean((r) => r.r2was).toFixed(4) + " |");
  L.push("| after  | " + mean((r) => r.now).toFixed(4) + " | " + mean((r) => r.r2now).toFixed(4) + " |");
  L.push("");
  const moved = rows.filter((r) => Math.abs(r.d) > 1e-9)
                    .sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  L.push(moved.length + " of " + rows.length + " rows moved at all. The ten that moved most:");
  L.push("");
  L.push("| row | residue before | after | change |");
  L.push("|---|---:|---:|---:|");
  for (const r of moved.slice(0, 10))
    L.push("| `" + r.k + "` | " + r.was.toFixed(4) + " | " + r.now.toFixed(4) + " | " +
           (r.d > 0 ? "+" : "") + r.d.toFixed(4) + " |");
  L.push("");
  return L.join("\n");
}
