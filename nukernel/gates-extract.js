#!/usr/bin/env node
/* nukernel/gates-extract.js — WHICH OPTION IS UNREACHABLE, MEASURED.
 *
 * (Paul, 2026-08-24: "when an option makes another one unaccessible gray it
 * out.")
 *
 * The same species as nukernel/vocabulary.js and for the same reason: a table
 * of dependencies that somebody TYPES is a fourth source of truth, and it rots
 * the first time a kernel operator changes. So this is a program that plays the
 * box and writes down what it heard. `nukernel/gates.js` is its output and
 * carries a DO-NOT-EDIT banner; `--check` re-derives the table and exits
 * non-zero if the shipped file disagrees, which is vocabulary.js's own contract
 * restated one file over.
 *
 * NODE ONLY, in no script tag, in no service-worker list. What ships beside the
 * page is gates.js.
 *
 *     node nukernel/gates-extract.js [--out FILE] [--rolls N] [--holdout N]
 *                                    [--anchors N] [--sample N] [--check] [-v]
 *
 * ---------------------------------------------------------------------------
 * WHAT IS MEASURED, AND WHY IT IS TWO THINGS
 *
 * ONE: DOES SAYING IT DO ANYTHING. Set the option on a clone, compile the whole
 * record, diff the event list against the record's own. This is the question a
 * greyed word answers, and it finds the two per-option gates design 02 named:
 *
 *   · a `pad` voice cannot be transposed. Measured on the shipped chant:
 *     `at the fifth`, `in wider steps` and `thinned` move not one event, while
 *     `out` and `backwards` move plenty — because kernel.js:1388 voices the
 *     sounding chord and never reads `deg`, but still reads `p.gate`. It is
 *     chair.js:326's law ("A PAD DOES NOT HEAR THE BAR") from the other end,
 *     and it is PER OPTION, not per sheet, which is exactly why it had to be
 *     measured rather than guessed.
 *   · the chord-quality sheet is dead unless the harmony is a cycle AND
 *     somebody is voicing a chord. kernel.js:671 (`if (!g.prog || g.harmony
 *     !== "cycle")`) throws the progression away, and a record of pure lines
 *     renders byte-identically under every quality even when it does not.
 *
 * TWO: IS THERE ANYTHING TO SAY IT ABOUT. A sheet declares its `kind` — what it
 * operates on, as an event kind — and the measurement is whether the record
 * makes any sound of that kind when the sheet's own answer is taken away. A
 * sheet whose subject is silent is a sheet with nothing to say. This is the
 * drummer gate, and it needs the second question because the first one gives
 * the WRONG answer here, measured: with the drummer switched off, 65 of 68
 * KITLABEL words still move the score. They move it because `document.js
 * boxesOf` writes the section's kit word onto the box whether or not
 * `cast.on`, and `ui/derive.js:236` then reads "a kit word on a kitless genre
 * implies a four underneath" and BUILDS A KIT OUT OF NOTHING. That is a defect
 * in boxesOf — `toGenre` strips every kit field when the drummer is off
 * (`noKit`, document.js: "when a concern is absent, every field of it has to
 * go, not just the headline one") and boxesOf does not — and it is written up
 * as a recipe rather than fixed here, because this slice does not own that
 * file. The sheet gate is right either way: with no drummer there is no kit,
 * and the words that operate on one are greyed.
 *
 * THE SCORE IS THE PAGE'S OWN. `ui/derive.js sectionEvents` is what ui/state.js
 * hands the engine, so the corpus is compiled through it — document.js's
 * genres, document.js's phrases, document.js's boxes, derive.js's fold. Not a
 * second scorer: a second scorer would measure a record nobody plays.
 * ---------------------------------------------------------------------------
 */
"use strict";

const fs = require("fs"), path = require("path");
const HERE = __dirname;

/* ---------- the classic tier, on a stub window --------------------------
   test/unit/nukernel.test.js:2688's own trick, verified working: the data tier
   is UMD and publishes onto `window`, and ui/derive.js reads globals through
   ui/deps.js. Standing them up here is what lets a pure-node tool compile a
   record exactly the way the page does. */
global.window = global;
window.NuKernel      = require("./kernel.js");
window.NuGenres      = require("./genres.js");
window.NuFields      = require("./fields.js");
window.NuSong        = require("./song.js");
window.NuSongs       = require("./songs.js");
window.NuDocument    = require("./document.js");
window.NuInstruments = require("./instruments.js");
window.NuCompose     = require("./compose.js");
window.PRESETS       = require("./presets.js");
// the ARRANGER, for the anchor rows of the corpus — see `corpus` below
const PC = require("./precompose.js");
const Avail = require("./avail.js");
const { fitRule } = require("./vocabulary.js");

const K = window.NuKernel, NG = window.NuGenres, NF = window.NuFields;
const D = window.NuDocument, NuSongs = window.NuSongs;
const { GENRES } = NG;
const { SHEETS, docFeatures, evalRule } = Avail;

const J = (v) => JSON.stringify(v === undefined ? null : v);
// a diagnostic, not a feature: `--dump sheet.key,option` prints the raw
// measurement behind one option so a fit that came back opaque can be read
const DUMP = (process.argv.indexOf("--dump") > 0
  ? process.argv[process.argv.indexOf("--dump") + 1].split(",") : null);
const clone = (x) => JSON.parse(JSON.stringify(x));
// seeded, so a run reproduces — the same generator vocabulary.js:101 uses,
// for the same reason: a table that changes when nothing changed is a table
// `--check` can only ever fail on.
const roller = (s0) => { let s = s0 >>> 0;
  return () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; }; };
// ...AND A SEED THAT IS A FUNCTION OF WHAT IS BEING MEASURED. FNV-1a over the
// (record, sheet) pair, so `measure` can give every sheet its own roller — see
// the note over `measure` for the measurement that forced it.
const hash32 = (str) => { let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0; };
const pick = (rnd, list) => list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];
// a seeded subset that keeps the LIST'S OWN ORDER — order is a contract for
// every sheet (design 02 §6.7) and it must be one here too, or two runs that
// sampled the same values in a different order would fit the same rule twice
// and print two different tables.
function sample(rnd, list, n) {
  if (list.length <= n) return list.slice();
  const ix = new Set();
  while (ix.size < n) ix.add(Math.floor(rnd() * list.length));
  return [...ix].sort((a, b) => a - b).map((i) => list[i]);
}

/* ====================================================================
   THE SCORE — the page's own compile, through the page's own modules.
   ==================================================================== */
const GK = "x.gates.";
let sectionEvents = null, FLEET = [];

async function boot() {
  const derive = await import("./ui/derive.js");
  sectionEvents = derive.sectionEvents;
  // THE FLEET IS ASKED FOR, NOT COPIED. audio/to-engine.js SYNTH is the only
  // table that knows which instrument names are modelled Faust voices; it is an
  // ES module with no static imports, so node can import it bare (its own
  // header says so: "a pure-node gate import this file bare"). An empty fleet
  // here would silently make `voice.native` false for every voice in the
  // corpus, so it is asserted rather than trusted.
  const te = await import("./audio/to-engine.js");
  FLEET = te.SYNTH_NAMES();
  if (!FLEET.length) throw new Error("the Faust fleet came back empty — " +
    "audio/to-engine.js SYNTH_NAMES() is what voice.native is measured against");
}

/* The event list a document compiles to, per section, in the same units the
   kernel emits. Only the fields that carry MUSIC are kept: an event's object
   identity and its `prev` back-pointer are not facts about the record. */
function score(doc, only) {
  const secs = doc.form.sections, NS = secs.length;
  const lines = doc.voices.filter((v) => v.kind === "line");
  secs.forEach((s, i) => { GENRES[GK + i] = D.toGenre(doc, i, GENRES, FLEET); });
  for (let i = NS; i < 64; i++) delete GENRES[GK + i];
  const slots = [];
  lines.forEach((c, v) => { for (let i = 0; i < NS; i++)
    slots[v * NS + i] = D.toPhrase(doc, D.materialAt(c, secs[i].id)); });
  // ONE SECTION IS ENOUGH WHEN THE ANSWER IS A SECTION'S OWN. A development
  // word and a section role are keyed by section id and reach exactly one box,
  // so compiling the other four is four fifths of the cost of the whole run
  // spent proving that nothing happened there. Song-scoped sheets pass `only`
  // as null and get the whole record, which is the only honest thing for a
  // key change. (Measured on the first full run: dropping to one section took
  // the extraction from four minutes to under one.)
  return D.boxesOf(doc, GK).map((b, i) => {
    if (only != null && i !== only) return null;
    const r = sectionEvents(b, slots, null, doc.time.swing || null);
    return (r.ev || []).map((e) => [e.t, e.kind, e.n, e.v, e.vel, e.dur,
                                    e.lane, e.unit, e.pad ? 1 : 0, e.lv]);
  });
}
/* THE SIGNATURE OF WHAT THIS SHEET IS ABOUT, and not of the whole band.
   A voice-scoped sheet asks a question about ONE voice, and diffing the whole
   record to answer it makes every other voice's noise into evidence: measured,
   the pad gate — the crispest finding in this file, `at the fifth` dead on a
   pad in every controlled cell — came back `opaque` the moment the corpus
   started drawing random anchors, because a random anchor changes the drummer,
   the bass, the rate and the voice count all at once and any of them can move
   the event list while the pad sits there ignoring its transposition. The lens
   is the kernel's own voice arithmetic: `sectionEvents` renders phrase `pi`
   into kernel voices pi, pi+nP, pi+2nP… (derive.js `for (let v = pi; v <
   g.voices; v += nP)`), so line voice `pi` owns exactly the events whose `lv`
   is congruent to pi modulo the number of line voices. */
const KIND_AT = 1, LV_AT = 9;
const sigOf = (per, lens) => J(!lens ? per : per.map((sec) => sec && sec.filter(
  (e) => e[KIND_AT] === lens.kind &&
    (lens.kind !== "line" || (((e[LV_AT] % lens.of) + lens.of) % lens.of) === lens.pi))));
/* Which events a sheet is about, or null for "the whole record". A voice-scoped
   sheet on a LINE looks at that line only; on the bass or the kit it looks at
   that instrument, which is one voice by construction. A song-scoped sheet
   looks at everything, because that is what a key change is about. */
function lensFor(doc, row, scope) {
  if (!scope || scope.voice == null) return null;
  const v = doc.voices.find((x) => x.name === scope.voice);
  if (!v) return null;
  if (v.kind === "bass") return { kind: "bass" };
  if (v.kind === "drums") return { kind: "hit" };
  const lines = doc.voices.filter((x) => x.kind === "line");
  return { kind: "line", pi: lines.indexOf(v), of: Math.max(1, lines.length) };
}

/* ====================================================================
   THE CORPUS. TERMS, TERMS re-anchored on catalog genres, and seeded rolls
   that move exactly the axes design 02 §3.4 names — harmony, part, the
   drummer, the meter, the cell and the instrument — plus the two that make
   the drum and bass sheets exist at all: HIRING a drummer and a bass. A
   corpus with no drummer in it can say nothing about the kit words.
   ==================================================================== */
const DRUMGRID = { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
                   s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
                   h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] };
const ANCHORS = Object.keys(GENRES).filter((k) => !k.startsWith("x.gates."))
  .sort();

function hireDrums(doc, on) {
  let cell = Object.keys(doc.material.cells)
    .find((n) => doc.material.cells[n].kind === "drum");
  if (!cell) { cell = "beat";
    doc.material.cells[cell] = { kind: "drum", lanes: clone(DRUMGRID) }; }
  doc.voices.push({ name: "kit", kind: "drums", cast: { on },
    material: cell, instrument: "tr909", development: {} });
}
function hireBass(doc, style) {
  doc.voices.push({ name: "bass", kind: "bass",
    cast: { style }, development: {} });
}

/* THE DESIGNED CASES. A fit can only find a condition its corpus CONTAINS, and
   dice do not reliably produce a rare cross: on the run before this one, of 49
   chord-quality scopes exactly 2 had both a cycle and somebody to voice it, and
   the two-place rule everybody already knows is there came back `opaque`. So
   the cross is walked on purpose — harmony × chord-voice × drummer × bass, 36
   records — which is vocabulary.js's own shape ("every record the catalog
   CALLS, plus rolls"): the called records are the designed cases and the rolls
   are what keeps the fit from learning only them. Seeded variation in anchor,
   mode and cell keeps the holdout's copy of the cross a different draw. */
function designed() {
  const out = [], HARM = Avail.HARMONIES();
  // ONE THING AT A TIME. The first cross drew a random anchor and a random mode
  // per cell, and the noise it added was bigger than the effect it was there to
  // isolate: two cells differing only in whether the drummer was switched on
  // came back disagreeing about whether a line can be transposed, because they
  // were two different genres in two different modes. So the anchor, the mode
  // and the form are held still and each cross varies what it is about — and
  // they are TWO crosses rather than one product, because the alphabet and the
  // band do not interact and 3×2×2 + 3×2 is eighteen records where the full
  // product was seventy-two, at four seconds each.
  const base = (label, edit) => {
    const d = clone(NuSongs.TERMS);
    d.alphabet.prog = [{ d: 0, q: "triad" }, { d: 3, q: "triad" },
                       { d: 4, q: "7" }, { d: 0, q: "triad" }];
    edit(d);
    out.push({ label: "cross." + label, doc: D.normalize(d) });
  };
  // A · THE ALPHABET: harmony × whether the line is held to the key × whether
  // anybody is voicing a chord. This is where the quality gate and the pad
  // gate live, and both are conditions ON THE ALPHABET.
  for (const h of HARM) for (const dia of [true, false]) for (const pad of [true, false])
    base([h, dia ? "dia" : "free", pad ? "pad" : "lines"].join("."), (d) => {
      d.alphabet.harmony = h;
      d.alphabet.diatonic = dia;
      if (pad) d.voices.find((v) => v.kind === "line").cast.part = "pad";
      hireDrums(d, true); hireBass(d, "eighths");
    });
  // B · THE BAND: is there a drummer, is he switched on, is there a bass. This
  // is where the kit and bass sheets live, and none of it touches the alphabet.
  for (const kit of ["none", "on", "off"]) for (const bass of [true, false])
    base(["band", kit, bass ? "bass" : "nobass"].join("."), (d) => {
      if (kit !== "none") hireDrums(d, kit === "on");
      if (bass) hireBass(d, "eighths");
    });
  return out;
}

/* `cross` is false for the HOLDOUT. The designed cells are the cases the fit is
   allowed to learn from; handing the same eighteen records back as the holdout
   would be marking your own homework. The holdout is dice and anchors only —
   records drawn the same way but never seen — which is the pass that told us
   the first run's "the quality menu is alive when the mode is lydian" was a
   coincidence and not a law. */
function corpus(seed, n, anchors, cross) {
  const rnd = roller(seed), out = [];
  const base = () => clone(NuSongs.TERMS);
  out.push({ label: "TERMS", doc: D.normalize(base()) });
  if (cross) out.push(...designed());
  /* THE ANCHOR ROWS ARE REAL RECORDS, and until 2026-08-25 they were not.
     This read `const d = base(); d.basis = gk` — the shipped two-voice chant
     with its LABEL swapped — and swapping a label cannot change the shape,
     because every interesting rule in this table reads `cast.drumsOn` /
     `cast.hasBass` / `cast.hasPad`, which are facts about the BAND and not
     about the anchor. The shipped table's own header said so out loud
     (`{records: 55, anchors: 12, ...}`, twelve anchors all seen as the same
     plainchant) and INTERVIEW.md §3.3 measured the consequence: ONE question
     shape for all 139 anchors where the real precomposed documents give six.
     Re-measured here on 2026-08-25 over the scopes THIS file walks, which is
     the number that matters to the fit: TERMS with the basis swapped gives
     every one of the 139 anchors exactly 81 scopes and ONE distinct
     live-sheet set; the precomposed documents give 120..365 scopes, 49
     distinct counts and 3 distinct live-sheet sets. This is the table the
     page greys options from, so a corpus that has never seen a drummer, a
     bass, a chord cycle or an eight-voice cast was greying today's page off
     yesterday's chant.

     `precompose.genreToDocument(gk, seed)` is the record the page ITSELF
     writes when you pick that anchor off the globe (PROGRAM.md's law, "THE
     RECORD ARRIVES FINISHED"), so this is the same law the SCORE follows one
     level up: measure the record a person actually gets, not a stand-in. The
     precompose seed is the CORPUS seed, so the holdout's anchors — drawn from
     a different roller AND composed at `seed + 977` — are documents the fit
     has never seen even where the two draws overlap on a name. */
  for (const gk of anchors)
    out.push({ label: "basis:" + gk, doc: D.normalize(PC.genreToDocument(gk, seed)) });
  const HARM = Avail.HARMONIES(), PARTS = Avail.PARTS();
  const METERS = ["", ...Object.keys(K.METERS)];
  const BASS = Object.keys(NF.BASSOPS);
  const INSTR = Object.keys(NF.INSTRCHOICES);
  for (let i = 0; i < n; i++) {
    const d = base();
    d.basis = pick(rnd, ANCHORS);
    d.alphabet.harmony = pick(rnd, HARM);
    d.time.meter = pick(rnd, METERS) || null;
    d.alphabet.mode = pick(rnd, Object.keys(NG.MODES));
    d.time.swing = pick(rnd, ["", ...Object.keys(NF.SWINGLABEL)]) || null;
    d.time.rate  = pick(rnd, [null, 1, 0.5, 2]);
    d.alphabet.diatonic = rnd() < 0.5;
    // A CYCLE NEEDS SOMETHING TO CYCLE THROUGH. One chord is what the chant
    // ships; a fitted rule about the changes read off a corpus of one-chord
    // records would be a rule about nothing.
    const nb = 1 + Math.floor(rnd() * 4);
    d.alphabet.prog = [];
    for (let b = 0; b < nb; b++) d.alphabet.prog.push({
      d: Math.floor(rnd() * 7),
      q: pick(rnd, [...Object.keys(K.QSTEPS), ...Object.keys(K.QFIX)]) });
    for (const v of d.voices) {
      if (v.kind !== "line") continue;
      v.cast.part = pick(rnd, PARTS);
      v.material = pick(rnd, Avail.lineCells(d));
      if (rnd() < 0.5) v.instrument = pick(rnd, INSTR);
    }
    if (rnd() < 0.75) hireDrums(d, rnd() < 0.55);
    if (rnd() < 0.65) hireBass(d, pick(rnd, BASS));
    out.push({ label: "roll" + seed + "." + i, doc: D.normalize(d) });
  }
  return out;
}

/* ====================================================================
   THE SCOPES a sheet has on one document.
   ==================================================================== */
function scopesOf(doc, key) {
  const row = SHEETS[key], secs = doc.form.sections;
  const chairs = () => doc.voices.filter((v) => v.kind === row.chair);
  if (row.scope === "song") return [{}];
  if (row.scope === "song.bar") return (doc.alphabet.prog || []).map((_, b) => ({ bar: b }));
  if (row.scope === "section") return secs.map((s) => ({ section: s.id }));
  if (row.scope === "voice") return chairs().map((v) => ({ voice: v.name }));
  if (row.scope === "voice.section") {
    const out = [];
    for (const v of chairs()) for (const s of secs)
      out.push({ voice: v.name, section: s.id });
    return out;
  }
  return [];
}

/* ====================================================================
   THE MEASUREMENT. One row per (document, sheet, scope):
     avail   is there anything here to say something about
     moves   per option value, did saying it change the record
   ==================================================================== */
/* ONE ROLLER PER (RECORD, SHEET), NOT ONE PER RUN. This drew every scope
   sample and every option subset from a SINGLE roller consumed inside
   `for (const key of Object.keys(SHEETS))`, so the stream every sheet saw
   depended on how many sheets came before it in the object — and D7 measured
   the consequence on 2026-08-24: adding eleven nudge rows, with no change to
   any existing sheet and no new words, moved the sample for all sixteen old
   sheets and dropped `dev.line`'s `at the fifth` pad rule on the holdout. A
   measurement that changes because an UNRELATED question was added to the page
   is not a measurement of the music. The seed is now a hash of the record's
   label and the sheet's key, so a sheet's sample is a function of itself and
   adding, removing or renaming another sheet cannot move it. This re-fits every
   sheet once, on purpose, and the regenerated gates.js is what ships with it. */
function measure(recs, opt) {
  const rows = [];            // { key, label, feats, avail, moves: Map }
  let sigs = 0;
  for (const rec of recs) {
    for (const key of Object.keys(SHEETS)) {
      const rnd = roller(hash32(rec.label + "|" + key) ^ (opt.seed ^ 0x5eed));
      const row = SHEETS[key];
      const all = scopesOf(rec.doc, key);
      if (!all.length) continue;
      for (const scope of sample(rnd, all, opt.scopes)) {
        const feats = docFeatures(rec.doc, scope, { fleet: FLEET });
        const si = scope.section == null ? null
          : rec.doc.form.sections.findIndex((s) => s.id === scope.section);
        // -- DOES SAYING IT DO ANYTHING ---------------------------------
        // THE UNCHANGED RECORD IS COMPILED ONCE PER RESTRICTION, not once per
        // sheet: sixteen sheets asking the same document the same question
        // sixteen times was a third of the whole run.
        /* THE BASELINE IS THE SHEET SAYING NOTHING, WHERE THERE IS SUCH A
           THING. Measuring every word against the STANDING word made the
           measurement a fact about the standing word: on TERMS the schola is
           `out` in the head, so on that one scope every word in the sheet
           "moves" — it comes back from silence — and the pad gate this whole
           slice exists for came out `opaque`. With `absent` as the baseline the
           question is the one a composer asks: does this word do anything to
           the material. Sheets with no neutral answer (there is no "no part")
           still measure against the standing one, and the WRITES exclusion
           below is what keeps that from fitting a rule about it. */
        const doc0 = row.absent === undefined ? rec.doc : clone(rec.doc);
        if (row.absent !== undefined) {
          try { row.set(doc0, scope, row.absent); } catch (e) {} }
        const feats0 = row.absent === undefined ? feats
          : docFeatures(doc0, scope, { fleet: FLEET });
        const lens = lensFor(rec.doc, row, scope);
        const moves = new Map();
        const writes = new Set();
        let avail = true, base = null, basePer = null;
        const memo = rec.__base || (rec.__base = new Map());
        const mk = String(si) + "|" + J(lens) + "|" +
          (row.absent === undefined ? "" : key + J(scope));
        if (memo.has(mk)) { base = memo.get(mk)[0]; basePer = memo.get(mk)[1]; }
        else { try { basePer = score(doc0, si); base = sigOf(basePer, lens); sigs++; }
               catch (e) { base = null; basePer = null; }
               memo.set(mk, [base, basePer]); }
        /* IS THERE ANYTHING TO SAY IT ABOUT — and it is READ OFF THE BASELINE
           rather than compiled again, because the baseline IS the record with
           this sheet's answer taken away. A sheet whose subject makes no sound
           is a sheet with nothing to say: no drummer, no kit words.

           A SILENT VOICE CARRIES NO INFORMATION ABOUT ITS OWN WORDS, and that
           is the second thing this line fixes. Measured: on `basis:ska` and on
           one rolled record the cantor renders no events at all in the sampled
           section — a genre whose rate and entry put the voice outside it — so
           EVERY word came back "does not move", the pad gate picked up two
           counterexamples out of a hundred and ten, and the holdout dropped the
           crispest finding in the file. A row with no sound in it is not
           evidence that a word does nothing; it is no evidence at all, and it
           is now excluded rather than counted against the rule. */
        if (row.kind) avail = !!basePer && (si == null ? basePer.filter(Boolean).flat()
          : (basePer[si] || [])).some((e) => e[KIND_AT] === row.kind &&
            (!lens || lens.kind !== "line" ||
             (((e[LV_AT] % lens.of) + lens.of) % lens.of) === lens.pi));
        if (row.kind && !avail) { rows.push({ key, label: rec.label, feats: feats0,
                                              avail: false, moves, writes }); continue; }
        if (base != null) {
          const vals = row.values(doc0, scope, { fleet: FLEET }) || [];
          const cur = String(row.get(doc0, scope, { fleet: FLEET }));
          const take = sample(rnd, vals.filter((o) => String(o.value) !== cur),
                              opt.sample);
          for (const o of take) {
            const d1 = clone(doc0);
            let s1 = null;
            try { row.set(d1, scope, String(o.value));
                   s1 = sigOf(score(d1, si), lens); sigs++; }
            catch (e) { s1 = null; }
            // A THROW IS NOT A MOVE. A word that crashes the compiler is
            // unavailable for a reason no feature explains, and it is counted
            // as not-moving so the fit never learns a rule off a stack trace.
            moves.set(String(o.value), s1 != null && s1 !== base);
            // WHAT THIS SHEET WRITES, in feature terms — vocabulary.js PASS 2's
            // measurement (apply the option and diff) taken over the FEATURES
            // instead of the record. The fit is not allowed to explain a sheet
            // with the sheet's own answer, and this is how it is told which
            // column that is. Measured, not declared: the first run without it
            // said every chair but `pad` is unavailable unless the voice is a
            // pad, which is the baseline talking and not the music.
            if (s1 != null) {
              const f1 = docFeatures(d1, scope, { fleet: FLEET });
              for (const k2 of Object.keys(f1))
                if (J(f1[k2]) !== J(feats0[k2])) writes.add(k2);
            }
          }
          // A SHEET WITH NO EVENT KIND IS ALIVE WHEN ANY WORD IN IT MOVES THE
          // RECORD — but only a `sheetGate` row is allowed to be greyed on it
          // (see avail.js's note): everything else uses the same bit to fit
          // its OPTIONS and never its fieldset.
          if (!row.kind) avail = [...moves.values()].some(Boolean) || moves.size === 0;
        }
        rows.push({ key, label: rec.label, feats: feats0, avail, moves, writes });
      }
    }
  }
  return { rows, sigs };
}

/* ====================================================================
   THE FIT. vocabulary.js:320 fitRule, unchanged and required rather than
   reimplemented: (boolean vector, features, labels) in, a rule out.
   ==================================================================== */
const MIN_ROWS = 8;                 // below this a "rule" is a coincidence
/* A RULE ABOUT THE RECORD BEATS A RULE ABOUT THE RECORD IT WAS COPIED FROM.
   `docFeatures` publishes forty-odd `basis.*` columns — the anchor genre's own
   scalars — and any one of them can separate a corpus by accident, which is
   how the first full run came back saying the chord-quality sheet is alive
   "when alphabet.mode === lydian". So the fit is offered the document's own
   facts alone first, and only falls back to the anchor's when they explain
   nothing. It is vocabulary.js:377's own preference (record over genre over
   seat) applied to this file's namespace. */
/* ...AND A COLUMN THE MEASUREMENT CANNOT POSSIBLY BE ABOUT IS NOT OFFERED AT
   ALL. This is the same move as the `basis.` preference above, one step
   harder, and the real corpus forced it on 2026-08-25: with the anchor rows
   made real records (see `corpus`) the fit came back saying

     alphabet.harmony / cycle   available `when time.bpm == 58`
     dev.line / at the octave   available `when time.bpm == 98`

   — which would have greyed the word `cycle` in the harmony menu on every
   record in the catalog except the shipped chant, printing a tempo as the
   reason. It is a coincidence with the shape of a law, and it survived the
   holdout because 58 bpm IS the chant and the chant is where the designed
   cross lives, so the column separates the corpus perfectly and means
   nothing.

   AND IT IS PROVABLY A COINCIDENCE, not merely a suspicious one, which is why
   the column comes out rather than being written up. This file measures the
   score in STEP units (`score` above returns each event's `t` as a step) and
   the tempo is seconds-per-step, applied after the kernel has emitted every
   event. Measured, 8 precomposed records rewritten to a different bpm — punk
   160->58, dub 76->58, motown 122->58, marabi 105->58 and four more:
   8 of 8 compile to a BYTE-IDENTICAL event list. A feature that cannot move
   the measurement can only ever fingerprint the records that carry it, so a
   rule built on it is a rule about which record you are looking at.

   THE TEST IS "CAN THIS COLUMN MOVE THE THING BEING MEASURED", and only two
   columns fail it: the document's tempo and the anchor's. Everything else the
   fit is offered — the key, the meter, the mode, the cast, the roles — does
   move the score, so it stays offered and is held to the holdout like any
   other. This is deliberately NOT "hide every continuous quantity": the key is
   a continuous-looking integer that transposes every note, and hiding it
   because it looks like a number would throw away a real law. */
const NOT_A_LAW = new Set(["time.bpm", "basis.bpm"]);
const own = (f, hide) => { const o = {};
  for (const k of Object.keys(f))
    if (!k.startsWith("basis.") && !NOT_A_LAW.has(k) && !(hide && hide.has(k))) o[k] = f[k];
  return o; };
const notMine = (f, hide) => { const o = {};
  for (const k of Object.keys(f))
    if (!NOT_A_LAW.has(k) && !(hide && hide.has(k))) o[k] = f[k];
  return o; };
/* ...AND A RULE THE PAGE CANNOT SAY OUT LOUD IS A RULE THE PAGE MUST NOT GREY
   WITH. This is the second guard the real corpus forced, and unlike the tempo
   column above it is about the SENTENCE the rule produces rather than its
   subject.

   THE LAW IT ENFORCES IS ALREADY WRITTEN: an unreachable option greys WITH ITS
   REASON PRINTED. avail.js owns the words — `WHY` is the one hand-authored
   table in that file, ~20 rows of English for ~20 facts a document carries —
   and it has a deliberate fallback for a fact it has no row for: print the raw
   column name, "AN UGLY STRING ON THE PAGE IS HOW A MISSING ROW GETS FIXED".
   That fallback is right for a rule a PERSON wrote and reported; it is not
   right for a rule a fitter INVENTED, because there is nobody to report it to
   and no claim behind it — it is the fitter naming a column it happened to
   like.

   WHAT IT CAUGHT, TWO RUNS RUNNING, and both were the same species: with the
   anchor rows made real records the corpus became two families, 19 documents
   derived from the shipped chant and 12 whole precomposed records, and ANY
   column constant across the chant family separates the two perfectly.

     run 1   alphabet.harmony / cycle   `when time.bpm == 58`
     run 2   alphabet.harmony / cycle   `when alphabet.key == 2`
     run 3   dev.kit / tomtime          `both(time.meter.four, not basis.instr)`

   58 bpm IS the chant and key 2 IS the chant; hiding the tempo column moved
   the same coincidence one column over, which is how you know the column was
   never the problem. The third greyed the word `tomtime` on the shipped page
   with the sentence " basis.instr" — a leading space and a column name, which
   is not a reason, and which `test/selects.js` and `test/sheets.js` both
   caught the moment it shipped.

   HOW IT IS DECIDED, AND IT IS NOT A LIST. An earlier version of this guard
   was a set of column names the WHY table could render, which meant this file
   kept its own second opinion about avail.js's vocabulary and would rot the
   first time a row was added there. So the candidate rule is RUN THROUGH THE
   PAGE'S OWN RENDERER — `Avail.whyOf(rule, feats)`, on the very feature rows
   the rule was fitted from — and if the sentence it produces on any row where
   the rule REFUSES still contains a raw column name, the rule is thrown away.
   Add a WHY row in avail.js and the same rule becomes fittable, with no edit
   here. A rejected fit falls through to the next strategy and then to null,
   which is §6.2's law — FAIL OPEN, because greying a live option is worse than
   showing a dead one. */
// a column name and never English: dotted, unspaced (`basis.instr`,
// `time.meter.four`). No row in avail.js WHY contains such a token.
const RAW_COLUMN = /(^|[\s,])[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+([\s,.]|$)/;
function unsayable(r, feats) {
  if (!r || typeof r !== "object" || r.rule === "always" || r.rule === "never") return false;
  for (const f of feats) {
    if (evalRule(r, f) !== false) continue;      // it offers the word here
    const why = Avail.whyOf(r, f);
    if (!why || RAW_COLUMN.test(why)) return true;
  }
  return false;
}
/* one predicate for "this fit produced nothing usable", so the four fallback
   stages below all ask the same question and a new guard lands in one place */
const unfit = (r, feats) => !r || r.rule === "opaque" || unsayable(r, feats);
/* ...AND A RULE NEEDS EVIDENCE ON THE SIDE IT IS MAKING A CLAIM ABOUT.
   `MIN_EXPLAINED` below says four DEAD rows are the fewest a safe rule may
   rest on ("below this, a 'safe rule' is a fluke"). Nothing said the same
   about the LIVE rows, and it is the live side that decides where a word is
   greyed: a rule fitted to "available when X" refuses the word everywhere ELSE,
   so one lucky mover is enough to grey a whole vocabulary.

   MEASURED, 2026-08-25, and this is what forced the line. With the real corpus
   in place the fit put a rule on `dev.line / at the octave` —
   `when is section.role.solo` — off a handful of measured scopes, which would
   have greyed "at the octave" on every verse, chorus and head in the catalog.
   Asked again over a fresh and far larger sample — 12 anchors x 2 seeds, every
   section, the first two line voices, 556 scopes — the word moves the events
   in NONE of them, solo sections included (0 of 36 solo, 0 of 520 other),
   while `backwards` and `out` move 556 of 556 and `up a degree` 552. The
   shipped table had it right and said so quietly: `inert`. The holdout could
   not catch it, because a word that moves almost nowhere does not move on the
   holdout either — the pass that separates a law from a coincidence needs the
   coincidence to recur, and this one had nothing to recur.

   So the same floor, applied to the same rule from the other end. Below it the
   answer is `null` and not `inert`: the measurement DID see the word move
   somewhere, so "this does nothing" would be its own small lie. No rule at all
   is §6.2's law — the word is offered, and nothing is claimed. */
function fitOne(present, feats, labels, hide) {
  if (present.length < MIN_ROWS) return null;
  const on = present.filter(Boolean).length;
  if (on === present.length || on === 0) return { rule: on ? "always" : "never" };
  if (on < MIN_EXPLAINED) return null;
  let r = fitRule(present, feats.map((f) => own(f, hide)), labels);
  if (unfit(r, feats))
    r = fitRule(present, feats.map((f) => notMine(f, hide)), labels);
  // ...AND IF THE CONDITION IS A NEGATED CONJUNCTION, FIT THE COMPLEMENT.
  // `fitRule` speaks AND and not OR, and half the real conditions here are
  // "available unless X and Y" — a pad may not be transposed unless the
  // harmony is emergent, which fitRule saw perfectly and could not say. The
  // complement of an OR is an AND, so the same fitter finds it by being asked
  // the opposite question, and avail.js's fifth rule form writes it down.
  if (unfit(r, feats)) {
    const no = present.map((x) => !x);
    let c = fitRule(no, feats.map((f) => own(f, hide)), labels);
    if (!c || c.rule === "opaque")
      c = fitRule(no, feats.map((f) => notMine(f, hide)), labels);
    if (c && c.rule === "both") r = { rule: "unless", a: c.a, b: c.b };
    else if (c && c.rule === "when" && (c.is || c.not))
      r = c.is ? { rule: "when", not: c.is } : { rule: "when", is: c.not };
    else r = null;
  }
  // ...AND IF NO EXACT RULE EXISTS, THE BEST SAFE ONE. `fitRule` is exact by
  // construction, and one row out of forty-eight is enough to make it say
  // `opaque` — which cost this file the pad gate three runs running: 47 scopes
  // agreed that `at the fifth` is dead on a pad and alive everywhere else, and
  // ONE lead reading the `neume` cell on one rolled anchor was dead where the
  // rule would have offered it. That is the HARMLESS direction (a word shown
  // that does nothing, which is every word on the page as it shipped
  // yesterday), and refusing to write the rule down because of it left a pad's
  // whole transposition menu lit and inert, which is the complaint. So the
  // fallback is one-sided: a rule may never grey a word the measurement saw
  // move, and it is scored on how many dead words it explains. `verify` is
  // strict about the same asymmetry, so a rule that greys a mover on the
  // HOLDOUT still dies.
  if (unfit(r, feats)) r = fitSafe(present, feats.map((f) => own(f, hide)));
  if (unfit(r, feats)) return null;                // FAIL OPEN. §6.2's law.
  delete r.alternatives;
  return r;
}

const MIN_EXPLAINED = 4;              // below this, a "safe rule" is a fluke
function fitSafe(present, feats) {
  const n = present.length, dead = present.filter((x) => !x).length;
  if (dead < MIN_EXPLAINED) return null;
  const keys = new Set();
  feats.forEach((f) => Object.keys(f).forEach((k) => keys.add(k)));
  // only fields that VARY can separate anything, and pairing over the rest is
  // how a two-place search becomes a three-hundred-squared one (vocabulary.js's
  // own note on the same loop)
  const varying = [...keys].filter((k) => {
    const vs = new Set(); for (let i = 0; i < n; i++) vs.add(J(feats[i][k]));
    return vs.size > 1;
  });
  let best = null;
  const offer = (rule, blocked) => {
    let score = 0;
    for (let i = 0; i < n; i++) {
      if (blocked[i] && present[i]) return;        // WOULD GREY A MOVER. Never.
      if (blocked[i]) score++;
    }
    if (score < MIN_EXPLAINED || score < dead * 0.5) return;
    if (!best || score > best.score) best = { rule, score };
  };
  for (const k of varying) {
    offer({ rule: "when", is: k }, feats.map((f) => !f[k]));
    offer({ rule: "when", not: k }, feats.map((f) => !!f[k]));
  }
  for (let x = 0; x < varying.length; x++)
    for (let y = x + 1; y < varying.length; y++)
      for (const sx of [true, false]) for (const sy of [true, false]) {
        const bl = feats.map((f) => (!!f[varying[x]] === sx) && (!!f[varying[y]] === sy));
        offer({ rule: "unless",
                a: sx ? { is: varying[x] } : { not: varying[x] },
                b: sy ? { is: varying[y] } : { not: varying[y] } }, bl);
      }
  return best && best.rule;
}

function fitAll(rows) {
  const out = {};
  for (const key of Object.keys(SHEETS)) {
    const mine = rows.filter((r) => r.key === key);
    const row = SHEETS[key];
    const sheet = { scope: row.scope, ...(row.chair ? { chair: row.chair } : {}),
                    ...(row.kind ? { kind: row.kind } : {}),
                    regenerates: true, options: {} };
    const mayGate = !!(row.kind || row.sheetGate);
    const hide = new Set();
    for (const r of mine) for (const w of (r.writes || [])) hide.add(w);
    const sr = mayGate ? fitOne(mine.map((r) => r.avail), mine.map((r) => r.feats),
                                mine.map((r) => r.label), hide) : null;
    sheet.census = { rows: mine.length, alive: mine.filter((r) => r.avail).length,
                     ...(hide.size ? { writes: [...hide].sort() } : {}) };
    // A SHEET THE COMPILE NEVER SEES MOVE. Said out loud rather than left to be
    // read out of a zero: a voice's instrument and a section's role are real
    // facts about a record that the EVENT LIST cannot carry — one is a timbre,
    // one is a name — so no rule about them can ever be measured here, and the
    // honest table says so instead of implying "always fine".
    if (!mayGate && !mine.filter((r) => r.avail).length) sheet.blind = true;
    if (!mayGate || !sr || sr.rule === "always") {
      // nothing to gate: the sheet is reachable wherever it is drawn
    } else if (sr.rule === "never") {
      // THE SCORER NEVER SAW IT. Not a law about the record — a hole in what
      // this tool can measure — so it greys NOTHING and says why out loud.
      sheet.regenerates = false;
      sheet.why = "the compile never shows this sheet's subject; nothing measured";
    } else {
      sheet.rule = sr;
    }
    if (DUMP && DUMP[0] === key) {
      const v = DUMP[1];
      for (const r of mine) if (r.moves.has(v))
        console.log("   dump " + key + " / " + v + "  moves=" +
          (r.moves.get(v) ? "Y" : "n") + "  part=" + r.feats["voice.part"] +
          " rhy=" + r.feats["voice.rhythmic"] + " cell=" + r.feats["voice.cell"] +
          "  " + r.label);
    }
    /* AN OPTION LIST THAT IS NOT A VOCABULARY GETS NO PER-OPTION TABLE.
       `gates.js` keys an option rule by the option's own VALUE, which is only
       meaningful when the values are a fixed vocabulary every record shares —
       songs.js WORDS, fields.js KEYS, kernel.js PARTS. The material rows are
       not that: their values are CELL NAMES the record invented, so `psalm` is
       a Gregorian tune in one document and could be a bassline in the next, and
       a rule fitted on one would be applied to the other by name alone.

       MEASURED, AND THAT IS WHY THIS IS HERE. `material.cell` landed on
       2026-08-24 (the band's voice tab saying which cell a voice reads per
       section) and the fit put a REFUSAL on `psalm` —
       `unless(not time.swing, is voice.native)` — over 165 rows. It is a
       coincidence with the shape of a law: what actually makes choosing `psalm`
       change nothing is that the voice ALREADY reads psalm there, which is a
       fact about that one document and not about swing. `cast.material` has the
       same option domain and fitted nothing at 110 rows, which is luck, not a
       difference. Greying a motif by name would be a wrong grey on the page
       with a machine sentence under it, and §6.10's 40%-inert rule is the same
       instinct one step further along: a fit over the wrong kind of value is a
       guess. The SHEET-level rule is untouched — "is there a line voice here at
       all" is a real measurement — and the census still counts every row. */
    if (row.local) { out[key] = sheet; continue; }
    // -- per option, restricted to where the sheet itself is alive ---------
    const live = mine.filter((r) => r.avail);
    const values = new Set();
    for (const r of live) for (const v of r.moves.keys()) values.add(v);
    let inertN = 0;
    for (const v of [...values].sort()) {
      const seen = live.filter((r) => r.moves.has(v));
      const rule = fitOne(seen.map((r) => r.moves.get(v)),
                          seen.map((r) => r.feats), seen.map((r) => r.label), hide);
      if (!rule) continue;
      if (rule.rule === "always") continue;                 // always says something
      if (rule.rule === "never") {
        // it says nothing ANYWHERE the sheet is alive: choosable, and the page
        // says so quietly. Greying it would claim a dependency there is none of.
        sheet.options[v] = { inert: { rule: "always" } };
        inertN++;
        continue;
      }
      sheet.options[v] = { rule };
    }
    // §6.10: A SHEET MORE THAN 40% INERT MEANS THE FIT FOUND A COINCIDENCE.
    // The inert rules come out and the census says so, because a page that
    // whispers "this does nothing" about half a vocabulary is not measuring,
    // it is guessing.
    if (values.size && inertN / values.size > 0.4) {
      for (const v of Object.keys(sheet.options))
        if (sheet.options[v].inert && !sheet.options[v].rule) delete sheet.options[v];
      sheet.census.inertDropped = inertN;
    }
    out[key] = sheet;
  }
  return out;
}

/* ====================================================================
   VERIFY, TWICE — vocabulary.js:1054's law. Every rule is RE-RUN against the
   measurement it came from, and then against a holdout the fit never saw,
   because a two-field condition that separates forty records will separate
   them again and only the second pass can tell a law from a coincidence.
   ==================================================================== */
/* NOT EVERY DISAGREEMENT IS THE SAME KIND OF WRONG, and the difference decides
   whether a rule survives. The thing this whole slice is protecting is a LIVE
   OPTION BEING GREYED — "greying a live option is worse than showing a dead
   one" (design 02 §6.2) — so:

     WRONG GREY   the rule says unavailable and the measurement says it moves.
                  A word a composer can use, refused. This kills the rule.
     OVER-OFFER   the rule says available and the measurement says it does
                  nothing here. The word is shown and it is a no-op — which is
                  exactly the page as it shipped yesterday, for every word.
                  Counted, printed, and NOT fatal.

   Measured, this is the difference between having the pad gate and not: of the
   48 scopes where `at the fifth` was measured, 47 agree that it is dead on a
   pad and alive everywhere else, and ONE — a lead reading the `neume` cell on
   one rolled anchor — is dead where the rule offers it. Throwing the rule away
   over that leaves a pad's transposition menu fully lit and doing nothing,
   which is the complaint. */
function verify(sheets, rows) {
  let ok = 0, moved = 0, over = 0;
  const bad = {};
  const slot = (key) => (bad[key] || (bad[key] = { options: [], over: 0 }));
  const noteSheet = (key, what, harmless) => { const b = slot(key);
    if (harmless) { b.over++; over++; return; }
    if (!b.sheet) b.sheet = what; moved++; };
  const noteOpt = (key, v, what, harmless) => { const b = slot(key);
    if (harmless) { b.over++; over++; return; }
    if (!b.options.includes(v)) b.options.push(v);
    if (!b.first) b.first = what; moved++; };
  for (const r of rows) {
    const s = sheets[r.key];
    if (!s || s.regenerates === false) continue;
    // ONLY A SHEET THAT MADE A CLAIM IS HELD TO ONE. A sheet with no rule says
    // nothing about when it is alive — a row that measured dead on TERMS and
    // greys nothing there is not a disagreement, it is a sheet that declined
    // to have an opinion, and counting it as a failure knocked four honest
    // rows out of the table on the first run that had this check.
    if (s.rule) {
      const want = evalRule(s.rule, r.feats) !== false;
      if (want === r.avail) ok++;
      else noteSheet(r.key, "the sheet is " + (r.avail ? "alive" : "dead") +
                            " on " + r.label + " and the rule says otherwise",
                     /* harmless when the rule OFFERS what measured dead */ want);
    }
    if (!r.avail) continue;
    for (const [v, did] of r.moves) {
      const og = s.options[v];
      if (!og) { ok++; continue; }
      if (og.rule) {
        const said = evalRule(og.rule, r.feats) !== false;
        if (said === did) ok++;
        else noteOpt(r.key, v, '"' + v + '" ' + (did ? "moves" : "does not move") +
                     " on " + r.label + " and the rule says otherwise", said);
      } else if (og.inert) {
        const said = evalRule(og.inert, r.feats) === true;
        if (said === !did) ok++;
        // an `inert` mark is never a refusal, so its disagreements are all of
        // the harmless kind: the worst it does is call a word quiet that spoke
        else noteOpt(r.key, v, '"' + v + '" inert rule disagrees on ' + r.label, true);
      }
    }
  }
  return { rows: ok + moved + over, identical: ok, moved, overOffered: over, bad };
}

/* ====================================================================
   THE TABLE
   ==================================================================== */
function extract(o) {
  const anchors = sample(roller(o.seed), ANCHORS, o.anchors);
  const fit  = corpus(o.seed, o.rolls, anchors, true);
  const held = corpus(o.seed + 977, o.holdout,
                      sample(roller(o.seed + 977), ANCHORS, o.anchors), false);
  const M  = measure(fit,  { seed: o.seed, scopes: o.scopes, sample: o.sample });
  const MH = measure(held, { seed: o.seed + 977, scopes: o.scopes, sample: o.sample });
  const sheets = fitAll(M.rows);
  const proof     = verify(sheets, M.rows);
  const proofHeld = verify(sheets, MH.rows);
  /* A RULE THAT CANNOT REPRODUCE ITSELF ON RECORDS IT NEVER SAW IS DELETED —
     a gate that cannot prove itself greys nothing, because greying a live
     option is worse than showing a dead one (design 02 §6.3).

     THE KNOCKOUT IS AT THE GRANULARITY OF THE THING THAT FAILED, and this
     reverses design 02 §6.3's own wording ("A sheet whose rules disagree
     ANYWHERE is emitted regenerates: false and with no rule at all"). Measured:
     one degenerate cell in the shipped chant — `bed`, sixteen copies of one
     degree, so reversing it or taking its tail returns the same sixteen notes
     — makes `the tail, turned` a no-op on a voice that is perfectly rhythmic,
     and under the old wording that single word threw away the whole `dev.line`
     sheet including the pad gate, which is the headline finding of this
     slice. So an OPTION that disagrees loses its own rule and nothing else; a
     SHEET whose own rule disagrees loses the sheet rule and is marked
     regenerates: false. Failing open is the law; failing open for twenty words
     because one of them is noisy is not. */
  for (const [key, bad] of Object.entries(proofHeld.bad)) {
    const s = sheets[key];
    if (bad.sheet) { s.regenerates = false; s.why = bad.sheet; delete s.rule; }
    for (const v of bad.options || []) delete s.options[v];
    if ((bad.options || []).length)
      s.census.openOptions = (bad.options || []).sort();
    if (bad.over) s.census.overOffered = bad.over;
  }
  const after = verify(sheets, MH.rows);
  return { from: "nukernel/gates-extract.js",
           corpus: { records: fit.length, anchors: anchors.length, rolls: o.rolls,
                     holdout: held.length, scopes: o.scopes, sample: o.sample,
                     seed: o.seed, compiles: M.sigs + MH.sigs },
           sheets, proof, proofHeld: after };
}

/* THE FILE. A banner, the table, and UMD — the page reads it as
   `window.NuGates` and node requires it, exactly as gates-extract reads it
   back for `--check`. */
function render(v) {
  return `// nukernel/gates.js — GENERATED BY nukernel/gates-extract.js — DO NOT EDIT.
//
// WHICH OPTION IS UNREACHABLE, AND WHY. Not typed: measured, by compiling
// ${v.corpus.compiles} records through the page's own compiler and diffing the
// event lists. Re-derive with \`node nukernel/gates-extract.js\`; \`--check\`
// fails if this file and the box disagree.
//
//   rule   when the sheet or the option IS AVAILABLE. Absent = always.
//   inert  when it is measured score-identical — choosable, said quietly.
//   regenerates: false — the fit could not reproduce itself on records it
//          never saw, so the row greys NOTHING. A gate that cannot prove
//          itself greys nothing (design 02 §6.3).
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuGates = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  return ${JSON.stringify(v, null, 2).split("\n").join("\n  ")};
});
`;
}

/* `built` is the one field that is not a measurement, and it is excluded from
   the comparison: a date that changes every midnight would make --check a gate
   that fails for the calendar. */
const cmp = (v) => { const x = { ...v }; delete x.built; return JSON.stringify(x); };

async function main() {
  const argv = process.argv.slice(2);
  const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
  await boot();
  const o = { seed: +arg("--seed", 20260824) >>> 0,
              rolls: +arg("--rolls", 24), holdout: +arg("--holdout", 20),
              anchors: +arg("--anchors", 12),
              /* HOW MUCH EVIDENCE PER SHEET, and both numbers moved on
                 2026-08-24 because a TRUE rule fell out of the table at the old
                 ones. `dev.line`'s "at the fifth is dead on a pad" is derived,
                 not statistical — kernel.js:1388 voices the sounding chord and
                 never reads `deg`, so the transposition changes not one event —
                 and it is the example design 02 was written around and
                 test/sheets.js asserts by name. At scopes 2 / sample 10 the fit
                 stopped finding it the moment D7 added eleven sheets; measured
                 at scopes 3 / sample 16 on the same tree it comes back, along
                 with five more option rules (15 carry one, up from 10), and the
                 holdout still says 0 wrongly greyed. 20 seconds of a 131-second
                 run bought a rule the page was previously getting wrong, which
                 is the whole trade. Do not lower these to make a run cheaper —
                 lower them and the table starts forgetting things it knows. */
              scopes: +arg("--scopes", 3),
              sample: +arg("--sample", 16) };
  const t0 = Date.now();
  const v = { built: new Date().toISOString().slice(0, 10), ...extract(o) };
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  const outJs = arg("--out", path.join(HERE, "gates.js"));
  const outJson = outJs.replace(/\.js$/, ".json");
  const check = argv.includes("--check");

  const gated = Object.entries(v.sheets).filter(([, s]) => s.rule).length;
  const opted = Object.values(v.sheets)
    .reduce((n, s) => n + Object.keys(s.options).length, 0);
  const blind = Object.entries(v.sheets).filter(([, s]) => s.regenerates === false);
  console.log("the option gates, measured on the running box  (" + secs + "s)");
  console.log("  " + Object.keys(v.sheets).length + " sheets, " +
    v.corpus.records + " records + " + v.corpus.holdout + " holdout, " +
    v.corpus.compiles + " compiles");
  console.log("  " + gated + " sheets carry a rule, " + opted + " options do");
  console.log("  verify   " + v.proof.identical + "/" + v.proof.rows + " identical, " +
    v.proof.moved + " wrongly greyed, " + v.proof.overOffered + " offered-and-inert");
  console.log("  holdout  " + v.proofHeld.identical + "/" + v.proofHeld.rows +
    " identical, " + v.proofHeld.moved + " wrongly greyed, " +
    v.proofHeld.overOffered + " offered-and-inert");
  for (const [k, s] of Object.entries(v.sheets)) {
    if (s.rule) console.log("  gate  " + k.padEnd(18) + J(s.rule));
    for (const [ov, og] of Object.entries(s.options))
      if (argv.includes("-v")) console.log("        " + k + " / " + ov + "  " + J(og));
  }
  for (const [k, s] of blind) console.log("  OPEN  " + k.padEnd(18) + s.why);
  for (const [k, s] of Object.entries(v.sheets))
    if (s.census && s.census.openOptions)
      console.log("  open  " + k.padEnd(18) + s.census.openOptions.length +
        " option rule(s) dropped on the holdout: " + J(s.census.openOptions));

  // THE WORDS AND THEIR FAMILIES, held here because this is the only gate that
  // reads songs.js as a vocabulary: a WORDS key with no WORDGROUP entry draws
  // an ungrouped option under whatever heading came before it, which is a
  // silent mislabel. every-head.test.js fails an askable.js row with no `head`
  // for the same reason (askable.js:66-71).
  const noGroup = Object.keys(NuSongs.WORDS)
    .filter((w) => !(NuSongs.WORDGROUP || {})[w]);
  const orphan = Object.keys(NuSongs.WORDGROUP || {})
    .filter((w) => !NuSongs.WORDS[w]);
  if (noGroup.length || orphan.length) {
    console.error("FAIL  songs.js WORDGROUP: " +
      (noGroup.length ? noGroup.length + " word(s) with no group " + J(noGroup) : "") +
      (orphan.length ? orphan.length + " group(s) for no word " + J(orphan) : ""));
    process.exit(1);
  }

  if (!check) {
    fs.writeFileSync(outJs, render(v));
    fs.writeFileSync(outJson, JSON.stringify(v, null, 1) + "\n");
    console.log("  wrote " + path.relative(process.cwd(), outJs) + " and .json");
    return;
  }

  let shipped = null;
  try { shipped = JSON.parse(fs.readFileSync(outJson, "utf8")); }
  catch (e) { console.error("FAIL  no shipped table at " + outJson); process.exit(1); }
  if (cmp(shipped) !== cmp(v)) {
    console.error("FAIL  the shipped gates.json is not what the box says today.");
    for (const k of Object.keys(v.sheets)) {
      const a = J((shipped.sheets || {})[k]), b = J(v.sheets[k]);
      if (a !== b) { console.error("      " + k); console.error("        shipped " + a);
                     console.error("        box     " + b); }
    }
    process.exit(1);
  }
  const liars = Object.entries(v.sheets)
    .filter(([, s]) => s.regenerates === true && s.rule)
    .filter(([k]) => v.proofHeld.bad[k] && v.proofHeld.bad[k].sheet);
  if (v.proofHeld.moved > 0 && liars.length) {
    console.error("FAIL  a sheet marked regenerates:true did not hold on the holdout");
    process.exit(1);
  }
  console.log("  OK  the shipped table is what the box says.");
}

main().catch((e) => { console.error(e); process.exit(1); });
