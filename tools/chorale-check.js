#!/usr/bin/env node
/* chorale-check.js — the part-writing rules of a four-part chorale, as tests.
 *
 *   node tools/chorale-check.js <score.json>            check it
 *   node tools/chorale-check.js <score.json> --ly       …and print LilyPond
 *
 * WHY THIS EXISTS (2026-09-06). Paul sent The Bach Benchmark
 * (aug5th.substack.com/p/the-bach-benchmark), which asks for a four-part
 * chorale in LilyPond and marks it on things that are not matters of taste:
 * parallel octaves and fifths, voices outside their ranges, "absurd"
 * part-writing, and notes that conflict inside a chord. Every one of those is
 * mechanically checkable, so writing the chorale WITHOUT checking it would be
 * exactly the failure this repo legislates against — a claim where a
 * measurement was available.
 *
 * ONE OWNER, AND IT IS THE DATA. The score is a table of MIDI numbers with a
 * chord named beside each column. The checker reads that table and the
 * LilyPond is PRINTED FROM THE SAME TABLE, so the engraved page and the
 * checked notes cannot disagree — which is the failure mode of writing
 * LilyPond by hand and reasoning about it in your head.
 *
 * WHAT IT DOES NOT DO. It has no opinion about whether the music is any good,
 * and it does not pretend to: the rules it runs (now `Theory.faults`, see
 * below) are the ones a first-year harmony class is marked on and the
 * benchmark names. A chorale can pass every one of them and be dull. It
 * cannot fail one of them and be Bach.
 */
"use strict";
const fs = require("fs");
const Theory = require("./theory.js");

/* ---- THE RULES LIVE IN tools/theory.js NOW (2026-09-06) -----------------
   Nine rules, moved not rewritten, because docs/THEORY.md §1 says the
   checker and the generation pass must read ONE copy of them or they will
   drift: the box would repair a parallel the checker never saw, or the
   checker would report one the box was never told about. What is left in
   this file is what only this file knows — the score's on-disk shape, the
   beat/bar names it prints, and the two engravings.

   THE VOICES AND THE CHORD WORDS moved with them (`Theory.CHORALE_VOICES`,
   `Theory.CHORALE_QUAL`), so a chorale's ranges are stated once. The
   printed output of this command is unchanged and gated on the committed
   chorale; the fault TEXTS now come from theory.js and are the same strings
   they were, which is the whole point of a move rather than a rewrite. */
const VOICE = Theory.CHORALE_VOICES;
const QUAL = Theory.CHORALE_QUAL;
const pc = (n) => ((n % 12) + 12) % 12;

function chordTones(ch) {
  const q = QUAL[ch.qual];
  if (!q) throw new Error("unknown quality: " + ch.qual);
  return q.map((iv) => pc(ch.root + iv));
}

/* ---- THE RUN OF THE RULES, AND WHERE EACH FAULT HAPPENED -----------------
   theory.js answers WHAT is wrong and between which columns; the location
   string is this file's, because only this file knows the score has bars
   and beats. Three shapes, exactly as before: a single column names its
   chord, a parallel names both bars, and the melodic rules name the beats
   alone — a parallel is worth a bar number to go and look at, a leap is
   not. */
function whereOf(score, f) {
  const beatName = (i) => {
    const c = score.chords[i];
    return "beat " + (i + 1) + " (bar " + c.bar + ", " + c.name + ")";
  };
  if (f.at.j == null) return beatName(f.at.i);
  const beats = "beats " + (f.at.i + 1) + "\u2013" + (f.at.j + 1);
  if (f.code === "parallel5" || f.code === "parallel8")
    return beats + " (bars " + score.chords[f.at.i].bar + "\u2013" +
           score.chords[f.at.j].bar + ")";
  return beats;
}

function check(score) {
  const V = score.voices;
  const voices = VOICE.map((r, vi) => ({ name: r.name, lo: r.lo, hi: r.hi, notes: V[vi] }));
  const chords = score.chords.map((ch) => {
    const tones = chordTones(ch);
    return { pcs: tones, rootPc: pc(ch.root), thirdPc: pc(ch.root + QUAL[ch.qual][1]) };
  });
  return Theory.faults(voices, {
    chords,
    leadingTone: score.leadingTone,
    tonic: score.tonic,
    aug2Pair: score.aug2Pair,
    aug2: score.aug2 !== false,
  }).map((f) => ({ where: whereOf(score, f), what: f.text }));
}

/* ---- THE ENGRAVING, PRINTED FROM THE SAME TABLE ------------------------- */
const NAMES = { 0: "c", 1: "des", 2: "d", 3: "ees", 4: "e", 5: "f", 6: "fis",
                7: "g", 8: "aes", 9: "a", 10: "bes", 11: "b" };
function ly(p) {
  const name = NAMES[pc(p)];
  /* LILYPOND'S OWN ZERO IS `c` = C3 (MIDI 48), and `c'` is middle C. The
     first draft wrote `oct + 1` marks and put the whole chorale an octave
     high — caught by reading the printed page against the table it came
     from, which is the entire reason both are printed from one table. */
  const oct = Math.floor(p / 12) - 4;           // 48..59 -> 0 marks; 60..71 -> "'"
  return name + (oct > 0 ? "'".repeat(oct) : oct < 0 ? ",".repeat(-oct) : "");
}
const DUR = { 1: "4", 2: "2", 3: "2." };
function lilypond(score) {
  const line = (vi) => score.voices[vi].map((p, i) => {
    const c = score.chords[i];
    return ly(p) + DUR[c.beats || 1] + (c.fermata ? "\\fermata" : "");
  }).join(" ");
  return `\\version "2.24.0"
% ${score.title}
% Printed from ${score.source} — the checked notes and this page are one table.
global = { \\key ${score.key} \\time ${score.time} }
soprano = \\relative { \\global \\voiceOne ${line(0)} \\bar "|." }
alto    = \\relative { \\global \\voiceTwo ${line(1)} }
tenor   = \\relative { \\global \\voiceOne ${line(2)} }
bass    = \\relative { \\global \\voiceTwo ${line(3)} \\bar "|." }
\\score {
  \\new ChoirStaff <<
    \\new Staff = "up" << \\new Voice = "s" \\soprano \\new Voice = "a" \\alto >>
    \\new Staff = "down" { \\clef bass << \\new Voice = "t" \\tenor \\new Voice = "b" \\bass >> }
  >>
  \\layout { }
  \\midi { \\tempo 4 = 72 }
}
`;
}

/* ---- …AND IN ABC, WHICH THIS REPO CAN ACTUALLY ENGRAVE ------------------
   Paul: *"You could redo the test in ABC to avoid a new dependency."* Right,
   and it is more than a convenience: `lilypond` is not installed on this box,
   so a LilyPond file is a claim nobody here can check, while `vendor/abcjs`
   is already loaded by the page and driven by the gates — an ABC score can be
   PARSED AND ENGRAVED in this tree, which turns "it compiles" from a promise
   into a measurement. Both are printed from the one table, so the LilyPond a
   benchmark asked for and the ABC we can verify are the same music by
   construction rather than by care.

   FOUR VOICES IN ABC ARE FOUR `V:` PARTS with `%%score` grouping them onto
   two staves, which is how abcjs draws a chorale. The key is stated once in
   `K:` and every accidental that is not in the signature is written on the
   note — abc has no "the chord said so", so the spelling table below is the
   one owner of what a pitch class is called. */
const ABCNAME = { 0: "C", 1: "_D", 2: "D", 3: "_E", 4: "E", 5: "F", 6: "^F",
                  7: "G", 8: "_A", 9: "A", 10: "_B", 11: "=B" };
function abcNote(p) {
  const raw = ABCNAME[pc(p)];
  const acc = raw.length > 1 ? raw[0] : "";
  const letter = raw.length > 1 ? raw[1] : raw;
  const oct = Math.floor(p / 12) - 5;          // 60..71 -> 0 (C is c in abc's 4th octave)
  if (oct >= 1) return acc + letter.toLowerCase() + "'".repeat(oct - 1);
  return acc + letter + ",".repeat(-oct);
}
const ABCDUR = { 1: "", 2: "2", 3: "3" };
/* AN ACCIDENTAL IS ONLY WRITTEN WHERE A READER NEEDS ONE (2026-09-06). The
   first engraving put a flat on every B and E in a key signature that already
   has both — legal abc, and notation no copyist would set. Two rules do it:
   a note whose accidental the SIGNATURE already gives is written bare, and an
   accidental already stated on that letter EARLIER IN THE SAME BAR is not
   restated. A bar line clears the memory, which is what a bar line means. */
const SIGACC = { Gm: { B: "_", E: "_" }, Dm: { B: "_" }, Am: {}, Em: { F: "^" },
                 C: {}, F: { B: "_" }, G: { F: "^" } };
function abc(score) {
  const bars = [];
  let cur = [], barNo = score.chords[0].bar;
  const flush = () => { if (cur.length) bars.push(cur); cur = []; };
  const sig = SIGACC[score.abcKey] || {};
  const lineFor = (vi) => {
    const out = []; let bn = score.chords[0].bar, run = [], said = {};
    score.chords.forEach((c, i) => {
      if (c.bar !== bn) { out.push(run.join("")); run = []; bn = c.bar; said = {}; }
      const raw = abcNote(score.voices[vi][i]);
      const m = /^([_^=]?)([A-Ga-g])([,']*)$/.exec(raw);
      let acc = m[1], letter = m[2].toUpperCase(), tail = m[2] + m[3];
      const want = acc || "";                      // "" means "as the signature has it"
      const have = said[letter] != null ? said[letter] : (sig[letter] || "");
      if (want === have) acc = ""; else said[letter] = want;
      run.push((c.fermata ? "H" : "") + acc + tail + (ABCDUR[c.beats || 1] || ""));
    });
    out.push(run.join(""));
    return out.join(" | ") + " |]";
  };
  flush();
  return [
    "%abc-2.1",
    "X:1",
    "T:" + score.title,
    "C:" + (score.composer || ""),
    "%%score {(S A) | (T B)}",
    "M:" + score.time,
    "L:1/4",
    "Q:1/4=72",
    "K:" + score.abcKey,
    "V:S clef=treble name=\"S\"", lineFor(0),
    "V:A clef=treble name=\"A\"", lineFor(1),
    "V:T clef=bass name=\"T\"",   lineFor(2),
    "V:B clef=bass name=\"B\"",   lineFor(3),
  ].join("\n") + "\n";
}

/* ---- THE RUN ------------------------------------------------------------ */
const file = process.argv[2];
if (!file) { console.error("usage: chorale-check.js <score.json> [--ly]"); process.exit(2); }
const score = JSON.parse(fs.readFileSync(file, "utf8"));
if (process.argv.includes("--abc")) { process.stdout.write(abc(score)); process.exit(0); }
if (process.argv.includes("--ly")) {
  /* THE ENGRAVING IS PRINTED WITHOUT `\relative`'s trap: every pitch above is
     absolute, so the `\relative` wrapper would transpose the lot. It is
     written as absolute music and the wrapper is not used. */
  process.stdout.write(lilypond(score).replace(/\\relative \{/g, "{"));
  process.exit(0);
}
const faults = check(score);
const n = score.voices[0].length;
console.log(score.title + " — " + n + " chords, " +
            (score.chords[n - 1].bar) + " bars, " + score.key + ", " + score.time);
if (!faults.length) { console.log("clean: no fault found by any rule above."); process.exit(0); }
for (const f of faults) console.log("  FAULT  " + f.where + " · " + f.what);
console.log(faults.length + " fault(s)");
process.exit(1);
