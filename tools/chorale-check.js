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
 * and it does not pretend to: the rules below are the ones a first-year
 * harmony class is marked on and the benchmark names. A chorale can pass every
 * one of them and be dull. It cannot fail one of them and be Bach.
 */
"use strict";
const fs = require("fs");

/* ---- THE VOICES, AND THE RANGES THEY ACTUALLY SING ---------------------
   Bach's chorale voices sit inside these; the numbers are the conservative
   union of what the 371 do, not the extremes a single tenor once reached.
   MIDI, middle C = 60. */
const VOICE = [
  { k: "S", name: "soprano", lo: 60, hi: 79 },   // c'  – g''
  { k: "A", name: "alto",    lo: 55, hi: 74 },   // g   – d''
  { k: "T", name: "tenor",   lo: 48, hi: 69 },   // c   – a'
  { k: "B", name: "bass",    lo: 40, hi: 62 },   // e,  – d'
];

/* THE CHORDS THIS CHECKER KNOWS, as pitch-class sets over a tonic. A chord is
   named in the score and the checker asks two things of it: every sounding
   note belongs to it, and its third is present. Nothing here is about taste;
   a triad missing its third is the "conflicting notes within chords" the
   benchmark names, said the other way round. */
const QUAL = {
  min:  [0, 3, 7], maj: [0, 4, 7], dim: [0, 3, 6], dom7: [0, 4, 7, 10],
  min7: [0, 3, 7, 10], halfdim: [0, 3, 6, 10],
};
const pc = (n) => ((n % 12) + 12) % 12;

function chordTones(ch) {
  const q = QUAL[ch.qual];
  if (!q) throw new Error("unknown quality: " + ch.qual);
  return q.map((iv) => pc(ch.root + iv));
}

/* ---- THE RULES ---------------------------------------------------------- */
function check(score) {
  const V = score.voices;                 // [S, A, T, B] arrays of MIDI
  const n = V[0].length;
  const out = [];
  const bad = (where, what) => out.push({ where, what });
  const beatName = (i) => {
    const c = score.chords[i];
    return "beat " + (i + 1) + " (bar " + c.bar + ", " + c.name + ")";
  };

  for (let i = 0; i < n; i++) {
    const col = V.map((v) => v[i]);
    /* 1 · RANGE. */
    col.forEach((p, vi) => {
      const R = VOICE[vi];
      if (p < R.lo || p > R.hi)
        bad(beatName(i), R.name + " sings " + p + ", outside " + R.lo + "–" + R.hi);
    });
    /* 2 · CROSSING, and the order is the definition of the voices. */
    for (let vi = 0; vi < 3; vi++)
      if (col[vi] < col[vi + 1])
        bad(beatName(i), VOICE[vi].name + " is below the " + VOICE[vi + 1].name);
    /* 3 · SPACING. More than an octave between two UPPER voices is the gap
       that makes a chorale stop sounding like one; tenor to bass may open. */
    if (col[0] - col[1] > 12) bad(beatName(i), "soprano and alto are more than an octave apart");
    if (col[1] - col[2] > 12) bad(beatName(i), "alto and tenor are more than an octave apart");
    /* 4 · EVERY NOTE BELONGS TO THE CHORD, and the third is there. */
    const ch = score.chords[i], tones = chordTones(ch);
    col.forEach((p, vi) => {
      if (tones.indexOf(pc(p)) < 0)
        bad(beatName(i), VOICE[vi].name + "'s " + pc(p) + " is not in the chord");
    });
    const third = pc(ch.root + (QUAL[ch.qual][1]));
    if (!col.some((p) => pc(p) === third)) bad(beatName(i), "the chord has no third");
    /* 5 · THE LEADING TONE IS NOT DOUBLED. */
    if (score.leadingTone != null) {
      const lt = col.filter((p) => pc(p) === pc(score.leadingTone)).length;
      if (lt > 1) bad(beatName(i), "the leading tone is doubled");
    }
  }

  /* 6 · PARALLEL PERFECT FIFTHS AND OCTAVES, between every pair, and the
     definition is strict: both voices move, in the same direction, and the
     interval class is the same perfect one on both sides. A perfect interval
     kept by OBLIQUE motion (one voice holding) is not a parallel and is not
     flagged — that is a rule about similar motion, and calling a held note a
     parallel is how a checker cries wolf. */
  const perfect = (a, b) => { const d = Math.abs(a - b) % 12; return d === 0 ? 8 : (d === 7 ? 5 : 0); };
  for (let i = 0; i + 1 < n; i++) {
    for (let x = 0; x < 4; x++) for (let y = x + 1; y < 4; y++) {
      const a1 = V[x][i], b1 = V[y][i], a2 = V[x][i + 1], b2 = V[y][i + 1];
      if (a1 === a2 || b1 === b2) continue;                 // oblique: not a parallel
      if ((a2 - a1) * (b2 - b1) < 0) continue;              // contrary: not a parallel
      const p1 = perfect(a1, b1), p2 = perfect(a2, b2);
      if (p1 && p1 === p2)
        bad("beats " + (i + 1) + "–" + (i + 2) + " (bars " + score.chords[i].bar +
            "–" + score.chords[i + 1].bar + ")",
            "parallel " + (p1 === 8 ? "octaves" : "fifths") + " between " +
            VOICE[x].name + " and " + VOICE[y].name);
    }
  }

  /* 7 · DIRECT (HIDDEN) OCTAVES AND FIFTHS IN THE OUTER VOICES: soprano and
     bass arriving at a perfect fifth or octave by similar motion with the
     soprano LEAPING. Bach does this constantly between inner voices and
     rarely on the outside, which is why the rule is outer-voice only here. */
  for (let i = 0; i + 1 < n; i++) {
    const s1 = V[0][i], b1 = V[3][i], s2 = V[0][i + 1], b2 = V[3][i + 1];
    if ((s2 - s1) * (b2 - b1) <= 0) continue;
    if (Math.abs(s2 - s1) <= 2) continue;                   // stepwise soprano: allowed
    const p = perfect(s2, b2);
    if (p) bad("beats " + (i + 1) + "–" + (i + 2),
               "direct " + (p === 8 ? "octave" : "fifth") + " into the outer voices, soprano leaping");
  }

  /* 8 · MELODIC RULES, the two that are not taste: no leap wider than an
     octave, and no augmented second — the interval a harmonic minor invites
     between its sixth and seventh degrees and the one thing a chorale never
     writes melodically. */
  for (let vi = 0; vi < 4; vi++) {
    for (let i = 0; i + 1 < n; i++) {
      const d = V[vi][i + 1] - V[vi][i], a = Math.abs(d);
      if (a > 12) bad("beats " + (i + 1) + "–" + (i + 2), VOICE[vi].name + " leaps " + a + " semitones");
      if (a === 3 && score.aug2 !== false) {
        const lo = pc(Math.min(V[vi][i], V[vi][i + 1])), hi = pc(Math.max(V[vi][i], V[vi][i + 1]));
        if (score.aug2Pair && lo === pc(score.aug2Pair[0]) && hi === pc(score.aug2Pair[1]))
          bad("beats " + (i + 1) + "–" + (i + 2), VOICE[vi].name + " leaps an augmented second");
      }
    }
  }

  /* 9 · THE LEADING TONE RESOLVES when it is in an outer voice. Inside, Bach
     frustrates it freely (the "frustrated leading tone"), so the rule is
     outer-voice only and says so rather than pretending to a stricter one. */
  if (score.leadingTone != null && score.tonic != null) {
    for (const vi of [0, 3]) {
      for (let i = 0; i + 1 < n; i++) {
        if (pc(V[vi][i]) !== pc(score.leadingTone)) continue;
        if (pc(V[vi][i + 1]) === pc(score.leadingTone)) continue;
        if (pc(V[vi][i + 1]) !== pc(score.tonic))
          bad("beats " + (i + 1) + "–" + (i + 2),
              VOICE[vi].name + "'s leading tone does not rise to the tonic");
      }
    }
  }
  return out;
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
