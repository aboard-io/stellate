#!/usr/bin/env node
// test/chords.test.js — THE CHORD VOCABULARY AND THE CHORD'S DURATION,
// MEASURED OFF THE RENDER (2026-09-05).
//
// Paul, the same morning, twice:
//   *"Don't we need the chord editor to handle duration of chords? It must."*
//   *"The number of chords is very low where are my maj7 and my min11 and so
//    forth?"*
//
// Both are claims about SOUND, so both are read off `K.render`'s events and
// not off the tables that feed it — [[test-the-artifact]]. A quality that
// parses and voices the wrong intervals, and a `beats` window that the
// document can store and no chair ever plays, are the two failures this file
// exists to catch, and the second one is the shape of the bug the catalogue
// had: `bossa`, `gospel` and `doowop` have declared a half-bar change since
// the progression landed and `precompose.js` flattened it away before it
// could reach a record.
//
// WHAT IS ASSERTED
//   Q1  `QUALFAM` is the one owner: QSTEPS is its step-spelled family, QFIX
//       the union of the rest, no key in both, every key named in QMARK.
//   Q2  the eight qualities that existed before this round keep their exact
//       keys and their exact intervals — the tripwire under "every anchor,
//       every PROGS entry and every saved record renders the bytes it did".
//   Q3  EVERY quality voices the intervals it names: a pad bar is rendered
//       per quality, in two different modes, and its sounding pitch classes
//       are compared with the set the table declares.
//   D1  a bar split in two sounds TWO chords, and the second one starts at
//       the step the first one's `beats` ends on.
//   D2  a `held` chord is one sound across two bars, where the same
//       progression without it is two.
//   D3  a slash bass puts a note UNDER the chord that the chord does not
//       own — which is the thing an inversion cannot say.
//   D4  absent is today: `beats: 0`, `held: false` and no `bass` render the
//       identical event stream, byte for byte, as the fields left off.
"use strict";
const path = require("path");
const R = (p) => path.join(__dirname, "..", p);

let fails = 0, checks = 0;
const ok = (cond, what, detail) => {
  checks++;
  if (cond) { console.log("  ok   " + what); return true; }
  fails++; console.log("  FAIL " + what + (detail ? "\n       " + detail : ""));
  return false;
};

globalThis.window = globalThis;
const K = require(R("nukernel/kernel.js"));
const G = require(R("nukernel/genres.js"));
const { MODES } = G;
const SUBJ = G.DEFAULT;
const pcw = (n) => ((n % 12) + 12) % 12;

console.log("test/chords.test.js — forty-two chords and a chord that lasts\n");

/* a one-voice PAD record whose only job is to voice the progression, so the
   events ARE the chord. Everything else is the rock row's, untouched. */
const padGenre = (prog, extra) => ({
  ...G.GENRES.rock, voices: 1, entry: () => 0, reg: () => 0,
  realize: () => "pad", word: () => [], harmony: "cycle", rate: 1,
  prog, roots: prog.map((s) => (Array.isArray(s) ? s[0] : s).d || 0),
  ...extra });
const padPcs = (ev) => new Set(ev.filter((e) => e.part === "pad").map((e) => pcw(e.n)));

/* ===== Q1 · ONE OWNER ==================================================== */
{
  const fams = Object.keys(K.QUALFAM);
  ok(K.QSTEPS === K.QUALFAM[K.QSTEPFAM],
     "Q1 · QSTEPS IS the step-spelled family, not a copy of it");
  const fixKeys = fams.filter((f) => f !== K.QSTEPFAM)
    .reduce((a, f) => a.concat(Object.keys(K.QUALFAM[f])), []);
  ok(fixKeys.length === Object.keys(K.QFIX).length &&
     fixKeys.every((k) => K.QFIX[k]),
     "Q1 · QFIX is exactly the union of the other " + (fams.length - 1) +
     " families (" + fixKeys.length + " words)");
  const step = Object.keys(K.QSTEPS);
  ok(!step.some((k) => K.QFIX[k]),
     "Q1 · no word is in both tables (a lookup order would decide the sound)");
  const all = step.concat(fixKeys);
  ok(all.every((k) => K.QMARK[k] != null),
     "Q1 · every one of the " + all.length + " words has a symbol in QMARK",
     all.filter((k) => K.QMARK[k] == null).join(" "));
  ok(new Set(all).size === all.length, "Q1 · no word is declared twice");
  console.log("       " + all.length + " qualities in " + fams.length +
              " families: " + fams.join(" · "));
}

/* ===== Q2 · THE EIGHT THAT WERE HERE BEFORE ============================== */
{
  const WAS = { triad: [0, 2, 4], "7": [0, 2, 4, 6], nine: [0, 2, 4, 6, 8],
                sus4: [0, 3, 4], six: [0, 2, 4, 5],
                maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dom7: [0, 4, 7, 10] };
  let bad = [];
  for (const k of Object.keys(WAS)) {
    const iv = K.QFIX[k] || K.QSTEPS[k];
    if (!iv || JSON.stringify(iv) !== JSON.stringify(WAS[k])) bad.push(k);
  }
  ok(!bad.length, "Q2 · the original eight keep their exact keys and intervals",
     bad.join(" "));
}

/* ===== Q3 · EVERY QUALITY VOICES WHAT IT NAMES, MEASURED ================= */
{
  let bad = [];
  for (const modeName of ["aeolian", "ionian"]) {
    const md = MODES[modeName];
    const mp = (d) => md[((d % md.length) + md.length) % md.length] +
                      (md.period || 12) * Math.floor(d / md.length);
    for (const fam of Object.keys(K.QUALFAM))
      for (const q of Object.keys(K.QUALFAM[fam])) {
        const iv = K.QUALFAM[fam][q];
        for (const d of [0, 2, 4]) {
          const want = new Set((K.QFIX[q]
            ? iv.map((x) => mp(d) + x)
            : iv.map((s) => mp(d + s))).map(pcw));
          const g = padGenre([{ d, q }], { mode: md });
          const got = padPcs(K.render(SUBJ, g, 1));
          const same = want.size === got.size &&
                       [...want].every((x) => got.has(x));
          if (!same) bad.push(modeName + " " + q + " on " + d + ": want {" +
            [...want].sort((a, b) => a - b) + "} got {" +
            [...got].sort((a, b) => a - b) + "}");
        }
      }
  }
  ok(!bad.length,
     "Q3 · every quality renders the pitch classes its spelling names, " +
     "in two modes on three degrees",
     bad.slice(0, 6).join("\n       "));
}

/* ===== D1 · A BAR HOLDS TWO CHORDS, AND THE SECOND ONE STARTS ON TIME ==== */
{
  const N = SUBJ.deg.length;                    // 16 steps to the bar
  const g = padGenre([[{ d: 0, q: "m7", beats: N / 2 }, { d: 3, q: "dom7" }]]);
  const ev = K.render(SUBJ, g, 1).filter((e) => e.part === "pad");
  const ts = [...new Set(ev.map((e) => e.t))].sort((a, b) => a - b);
  ok(ts.length === 2 && ts[0] === 0 && ts[1] === N / 2,
     "D1 · a split bar attacks twice, the second at step " + (N / 2) +
     " (beat 3)", "attacks at " + ts.join(", "));
  const md = K.MODE;
  const at = (d) => md[((d % md.length) + md.length) % md.length] +
                    12 * Math.floor(d / md.length);
  const second = new Set(ev.filter((e) => e.t === N / 2).map((e) => pcw(e.n)));
  const want = new Set(K.QFIX.dom7.map((x) => pcw(at(3) + x)));
  ok(want.size === second.size && [...want].every((x) => second.has(x)),
     "D1 · and the chord that starts at beat 3 is the one the bar names",
     "want {" + [...want] + "} got {" + [...second] + "}");
  // the whole bar is covered: the first chord's window ends where the second
  // one begins, so nothing between the two is silent
  const first = ev.filter((e) => e.t === 0);
  ok(first.length > 0 && first.every((e) => Math.abs(e.dur - N / 2) < 1e-9),
     "D1 · the first chord lasts exactly to the second, not to the bar line",
     "durs " + [...new Set(first.map((e) => e.dur))].join(","));
}

/* ===== D2 · A CHORD MAY LAST TWO BARS ==================================== */
{
  const N = SUBJ.deg.length;
  const struck = K.render(SUBJ, padGenre([{ d: 0 }, { d: 0 }]), 2)
    .filter((e) => e.part === "pad");
  const held = K.render(SUBJ, padGenre([{ d: 0 }, { d: 0, held: true }]), 2)
    .filter((e) => e.part === "pad");
  const tsA = [...new Set(struck.map((e) => e.t))].sort((a, b) => a - b);
  const tsB = [...new Set(held.map((e) => e.t))].sort((a, b) => a - b);
  ok(tsA.length === 2 && tsA[1] === N,
     "D2 · the same chord written twice is struck twice", tsA.join(", "));
  ok(tsB.length === 1 && tsB[0] === 0,
     "D2 · marked `held`, it is struck once", tsB.join(", "));
  ok(held.length && held.every((e) => Math.abs(e.dur - 2 * N) < 1e-9),
     "D2 · and it sounds for both bars (" +
     [...new Set(held.map((e) => e.dur))].join(",") + " steps of " + (2 * N) + ")");
  // the pitches are the same music either way — a hold is a duration, not a
  // different chord
  ok(JSON.stringify([...new Set(struck.map((e) => pcw(e.n)))].sort()) ===
     JSON.stringify([...new Set(held.map((e) => pcw(e.n)))].sort()),
     "D2 · a hold changes the duration and not one pitch class");
}

/* ===== D3 · THE SLASH BASS ============================================== */
{
  const g = padGenre([{ d: 0, q: "triad", bass: 3 }]);
  const c = K.chordAt(SUBJ, g, 0, 0);
  ok(!c.pcSet.has(pcw(c.bassPc)),
     "D3 · a slash bass is a note the chord does NOT own — which is the whole " +
     "difference from an inversion (bass " + c.bassPc + ", chord {" +
     [...c.pcSet] + "})");
  const inv = K.chordAt(SUBJ, padGenre([{ d: 0, q: "triad", inv: 1 }]), 0, 0);
  ok(inv.pcSet.has(pcw(inv.bassPc)) && inv.bassPc !== inv.rootPc,
     "D3 · and an inversion still puts one of the chord's OWN notes under it");
}

/* ===== D4 · ABSENT IS TODAY ============================================= */
{
  const bare = K.render(SUBJ, padGenre(
    [{ d: 0, q: "maj7" }, { d: 3, q: "m7" }, { d: 4, q: "dom7" }]), 6);
  const said = K.render(SUBJ, padGenre(
    [{ d: 0, q: "maj7", beats: 0, held: false },
     { d: 3, q: "m7", beats: 0, held: false },
     { d: 4, q: "dom7", beats: 0, held: false }]), 6);
  ok(JSON.stringify(bare) === JSON.stringify(said),
     "D4 · the new fields spelled as their own defaults render byte-identical " +
     "events (" + bare.length + ")");
}

console.log("\n" + (fails ? fails + " failed of " + checks
                          : "all " + checks + " checks pass"));
process.exit(fails ? 1 : 0);
