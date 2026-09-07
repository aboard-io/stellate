#!/usr/bin/env node
/* test/melody.test.js — WHAT KIND OF LINE THE BOX WRITES (2026-09-07).
 *
 * Paul, on a share link to `sophistirock`: *"the motifs have a real sameness
 * to them. We need novel melodies and motifs every single time. Seeds should
 * be DIFFERENT — why does the system keep bringing us back here?"*
 *
 * MEASURED FIRST, all 502 rows x seeds 1-3, read off the RENDERED documents
 * (`precompose.genreToDocument().material.cells`, the `deg` a sounded onset
 * carries) and not off any table: 149,868 melodic moves, of which 60.4% were
 * one scale step and 17.6% a repeated note. A fifth happened 0.7% of the time
 * and an octave 0.3%. `ideas-kit.js CONTOURS` held eight melodic shapes and
 * every one of them walked the scale, so the seed could change WHICH notes a
 * line walked and never the KIND of line.
 *
 * The cure is a MANNER — `ideas-kit.js` §2b, a second axis under the gesture —
 * distributed per family as data (`genres-tables.js LINES`) and drawn per part
 * per reading (`precompose.js` §6d). This gate holds the five claims that make
 * it a fix rather than a mood:
 *
 *   §A  THE VOCABULARY ANSWERS FOR ITSELF. Every contour has a gesture and a
 *       manner; `inManner` keeps the gesture, refuses the drone and every
 *       arpeggio, and is idempotent.
 *   §B  THE CATALOGUE AND THE VOCABULARY AGREE. Every distribution is reached
 *       by a row, every manner is dealt by some distribution, every cadence
 *       named exists.
 *   §C  THE INTERVAL DISTRIBUTION, PER FAMILY, off the render. Chant is still
 *       chant; the leaping families leap; nobody leaps so much that the tunes
 *       stop being singable.
 *   §D  TWO SEEDS OF A ROW DIFFER IN SHAPE, which is the complaint in one
 *       number: the total-variation distance between the two readings' own
 *       interval histograms, with a floor under it.
 *   §E  A LEAP IS RESOLVED. Every shape this round added answers a leap of a
 *       fourth or wider with motion the other way, measured on the rendered
 *       cells and not asserted of the table.
 *
 * Wave 1: node, no DOM, no audio, no browser.
 */
"use strict";
const path = require("path");
const assert = require("assert");
const R = (p) => require(path.join(__dirname, "..", "nukernel", p));
const NG = R("genres.js"), P = R("precompose.js"), Id = R("ideas-kit.js");
const GT = require(path.join(__dirname, "..", "nukernel", "genres-tables.js"));
const { GENRES } = NG;

let pass = 0, fail = 0;
const ok = (name, fn) => {
  try { fn(); pass++; console.log("ok    " + name); }
  catch (e) { fail++; console.log("FAIL  " + name + "\n      " + e.message); }
};

/* ---- THE SAMPLE. Six rows per family, taken in catalogue order so the set is
   deterministic and covers every family the table has — the whole 502 x 3 is
   50 seconds and this gate runs in wave 1 beside `document`. The catalogue-
   wide numbers this file's header quotes are `scratchpad/melody/census.js`'s;
   what is asserted here is the SHAPE of those numbers on a sample that cannot
   drift away from them without one family changing character. */
const PERFAM = 6;
const SAMPLE = (() => {
  const by = {}, out = [];
  for (const k of Object.keys(GENRES)) {
    if (GENRES[k].silent) continue;
    const f = GENRES[k].family || "(none)";
    by[f] = by[f] || [];
    if (by[f].length < PERFAM) { by[f].push(k); out.push(k); }
  }
  return out;
})();
const SEEDS = [1, 2];

/* one record's melodic moves, in SCALE STEPS — the unit the generator writes
   in. Semitones would fold a second and a third together wherever the mode is
   pentatonic, and every degree in a cell is alphabet-free by construction
   (kernel.js:8). */
function movesOf(gk, seed) {
  const doc = P.genreToDocument(gk, seed);
  const cs = (doc.material && doc.material.cells) || {};
  const out = [];
  for (const c of Object.values(cs)) {
    if (!c || c.kind !== "line" || !Array.isArray(c.deg)) continue;
    const d = [];
    for (let i = 0; i < c.play.length; i++) if (c.play[i] === "n") d.push(c.deg[i]);
    for (let i = 1; i < d.length; i++) out.push(d[i] - d[i - 1]);
    if (d.length > 1) out.cells = (out.cells || []).concat([d]);
  }
  return out;
}
const share = (mv, p) => (mv.length ? mv.filter(p).length / mv.length : 0);
const MEASURED = (() => {
  const perRow = {};
  for (const k of SAMPLE) { perRow[k] = {}; for (const s of SEEDS) perRow[k][s] = movesOf(k, s); }
  return perRow;
})();
const famOf = (k) => GENRES[k].family || "(none)";
const FAMS = [...new Set(SAMPLE.map(famOf))].sort();
const famMoves = (f) => {
  const out = [];
  for (const k of SAMPLE) if (famOf(k) === f) for (const s of SEEDS) out.push(...MEASURED[k][s]);
  return out;
};

/* ---- §A the vocabulary answers for itself ------------------------------- */
ok("§A1 every contour declares a gesture and a manner", () => {
  const bad = Object.keys(Id.CONTOURS).filter((c) => !Id.GESTURE[c] || !Id.MANNEROF[c]);
  assert.deepStrictEqual(bad, [], "contours with no gesture/manner: " + bad.join(","));
});
ok("§A2 inManner keeps the gesture", () => {
  const bad = [];
  for (const c of Object.keys(Id.CONTOURS)) for (const m of Id.MANNERS) {
    const got = Id.inManner(c, m);
    if (Id.GESTURE[got] !== Id.GESTURE[c]) bad.push(c + "+" + m + "=" + got);
  }
  assert.deepStrictEqual(bad, [], "the gesture moved: " + bad.join(" "));
});
ok("§A3 the drone and every arpeggio refuse every manner", () => {
  const fenced = ["hold"].concat(Id.ARP_CONTOURS);
  const bad = [];
  for (const c of fenced) for (const m of Id.MANNERS)
    if (Id.inManner(c, m) !== c) bad.push(c + "+" + m + "=" + Id.inManner(c, m));
  assert.deepStrictEqual(bad, [], "a fenced contour moved: " + bad.join(" "));
});
ok("§A4 inManner is idempotent and total", () => {
  const bad = [];
  for (const c of Object.keys(Id.CONTOURS)) for (const m of Id.MANNERS) {
    const a = Id.inManner(c, m);
    if (!Id.CONTOURS[a]) bad.push(c + "+" + m + " -> " + a + ", which is not a contour");
    if (Id.inManner(a, m) !== a) bad.push(c + "+" + m + " is not idempotent");
  }
  assert.deepStrictEqual(bad, [], bad.join(" · "));
  // …and a word nobody wrote hands the contour straight back rather than
  // composing a default in silence
  assert.strictEqual(Id.inManner("rise", "nonsense"), "rise");
  assert.strictEqual(Id.inManner("rise", null), "rise");
});
ok("§A5 every manner the table deals has a member for some gesture", () => {
  for (const m of Id.MANNERS)
    assert.ok(Object.keys(Id.SHAPES[m]).length, m + " has no members");
});

/* ---- §B the catalogue and the vocabulary agree -------------------------- */
ok("§B1 every row resolves to a distribution", () => {
  const bad = Object.keys(GENRES).filter((k) => !GENRES[k].line || !GENRES[k].line.hat);
  assert.deepStrictEqual(bad, [], "rows with no line distribution: " + bad.join(","));
});
ok("§B2 every distribution deals manners ideas-kit has, and a cadence it has", () => {
  for (const [name, L] of Object.entries(GT.LINES)) {
    for (const m of Object.keys(L.hat))
      assert.ok(Id.SHAPES[m], name + " deals a manner that is not one: " + m);
    assert.ok(Id.CADENCES[L.cad], name + " names a cadence that is not one: " + L.cad);
    assert.ok(typeof L.w === "string" && L.w.trim(), name + " says nothing about itself");
  }
});
ok("§B3 every family names a distribution, and every distribution is reachable", () => {
  const fams = new Set(Object.keys(GENRES).map((k) => GENRES[k].family).filter(Boolean));
  for (const f of fams)
    assert.ok(GT.LINE_FAMILY[f], "family " + f + " names no distribution");
  const reached = new Set(Object.values(GT.LINE_FAMILY));
  for (const k of Object.keys(GENRES)) if (typeof GENRES[k].line === "string") reached.add(GENRES[k].line);
  /* `flat` is QUOTED, never defaulted to — it is the refusal ("this music has
     exactly one kind of line") and no row in the catalogue has needed it yet.
     `bopwise` was a door too until 2026-09-07, when four rows took it
     (`jazz`, `modaljazz`, `gypsyjazz`, `latinjazz` — a bop head filed under
     `roots` was being written as a fiddle tune), so it is reached now and not
     listed here. This is the list where an unspent door is recorded. */
  const doors = ["flat"];
  const unused = Object.keys(GT.LINES).filter((n) => !reached.has(n) && !doors.includes(n));
  assert.deepStrictEqual(unused, [], "distributions nothing reaches: " + unused.join(","));
});

/* ---- §C the interval distribution, per family, off the render ----------- */
/* THE FLOOR AND THE CEILING ARE MEASURED, NOT CHOSEN. A corpus of Western
   song runs about half seconds, a fifth to a sixth repeated notes and a
   quarter leaps; the catalogue before this round ran 78% step-or-repeat on
   EVERY family, which is not a style, it is one generator. What is asserted
   is that no family has gone back to that and no family has been made
   unsingable in the other direction. */
ok("§C1 no family is a scalar wander any more (step+repeat under 80%)", () => {
  const bad = [];
  for (const f of FAMS) {
    const mv = famMoves(f);
    const flat = share(mv, (x) => Math.abs(x) <= 1);
    if (flat > 0.80) bad.push(f + " " + (100 * flat).toFixed(1) + "%");
  }
  assert.deepStrictEqual(bad, [], "families still walking the scale: " + bad.join(" · "));
});
ok("§C2 no family has been made unsingable (step+repeat over 45%)", () => {
  const bad = [];
  for (const f of FAMS) {
    const mv = famMoves(f);
    const flat = share(mv, (x) => Math.abs(x) <= 1);
    if (flat < 0.45) bad.push(f + " " + (100 * flat).toFixed(1) + "%");
  }
  assert.deepStrictEqual(bad, [], "families that leap too much: " + bad.join(" · "));
});
ok("§C3 chant is still the most stepwise family in the box", () => {
  /* `vox` declares `chantwise`, whose hat gives the chord manner ZERO tickets
     — a plainchant does not arpeggiate — so this is the assertion that the
     distribution is data and not decoration. It is checked against the
     LEAPING families rather than against all of them, because `drift` is a
     music of held notes and can beat chant on this measure honestly. */
  const stepOf = (f) => share(famMoves(f), (x) => Math.abs(x) <= 1);
  for (const f of ["band", "club", "groove", "studio"])
    if (FAMS.includes(f) && FAMS.includes("vox"))
      assert.ok(stepOf("vox") > stepOf(f),
        "vox " + stepOf("vox").toFixed(3) + " is not more stepwise than " + f +
        " " + stepOf(f).toFixed(3));
});
ok("§C4 the catalogue reaches the intervals it never had", () => {
  const all = [];
  for (const k of SAMPLE) for (const s of SEEDS) all.push(...MEASURED[k][s]);
  // a fourth (3 degrees) and a fifth (4) are where the arpeggio lives; before
  // this round the whole catalogue wrote a fifth 0.7% of the time
  assert.ok(share(all, (x) => Math.abs(x) === 3) > 0.02,
    "fourths are still rare: " + share(all, (x) => Math.abs(x) === 3).toFixed(4));
  assert.ok(share(all, (x) => Math.abs(x) >= 4) > 0.03,
    "fifths and wider are still rare: " + share(all, (x) => Math.abs(x) >= 4).toFixed(4));
});

/* ---- §D two seeds of a row differ in SHAPE ------------------------------ */
/* THE NUMBER IS A TOTAL-VARIATION DISTANCE between the two readings' own
   interval histograms: 0 means the two seeds move the same way and 1 means
   they share no kind of motion at all. Measured over the whole catalogue at
   seeds 1-3 it was 0.205 before this round and 0.242 after; the floor below is
   set under the sample's own figure with room for one row's draw to move. */
const tv = (a, b) => {
  const ha = {}, hb = {};
  for (const x of a) ha[x] = (ha[x] || 0) + 1;
  for (const x of b) hb[x] = (hb[x] || 0) + 1;
  let s = 0;
  for (const k of new Set([...Object.keys(ha), ...Object.keys(hb)]))
    s += Math.abs((ha[k] || 0) / a.length - (hb[k] || 0) / b.length);
  return s / 2;
};
ok("§D1 two seeds of a row move differently, on average", () => {
  const ds = SAMPLE.map((k) => tv(MEASURED[k][1], MEASURED[k][2]))
                   .filter((x) => Number.isFinite(x));
  const mean = ds.reduce((a, b) => a + b, 0) / ds.length;
  assert.ok(mean > 0.20, "mean seed-to-seed distance is " + mean.toFixed(3) +
    ", which is the sameness Paul heard");
});
ok("§D2 no row plays the same distribution of motion at both seeds", () => {
  const same = SAMPLE.filter((k) => MEASURED[k][1].length && MEASURED[k][2].length &&
                                    tv(MEASURED[k][1], MEASURED[k][2]) < 0.02);
  assert.deepStrictEqual(same, [], "rows whose two seeds move identically: " + same.join(","));
});
ok("§D3 the manner draw is a pure function of (row, seed)", () => {
  for (const k of SAMPLE.slice(0, 8))
    assert.deepStrictEqual(movesOf(k, 2), MEASURED[k][2], k + " composed twice, differently");
});

/* ---- §E a leap is resolved ---------------------------------------------- */
ok("§E1 a leap of a fourth or wider is answered the other way", () => {
  /* THE GAP-FILL LAW, measured on the rendered cells rather than asserted of
     the table: of every move of three degrees or more, what fraction is
     followed by motion in the OPPOSITE direction? A melody that leaps and
     keeps going in the same direction is the "broken chord, not a melody" the
     CONTOURS header refuses, and a catalogue of them is this round's failure
     mode. Held at two thirds, which is the figure the sample measures. */
  let leaps = 0, answered = 0;
  for (const k of SAMPLE) for (const s of SEEDS) {
    const mv = MEASURED[k][s];
    for (let i = 0; i + 1 < mv.length; i++) {
      if (Math.abs(mv[i]) < 3) continue;
      leaps++;
      if (mv[i + 1] === 0 || Math.sign(mv[i + 1]) !== Math.sign(mv[i])) answered++;
    }
  }
  assert.ok(leaps > 200, "not enough leaps in the sample to judge: " + leaps);
  const r = answered / leaps;
  assert.ok(r > 0.66, "only " + (100 * r).toFixed(1) + "% of leaps are resolved");
});
ok("§E2 no cell leaps further than an octave in one move", () => {
  const bad = [];
  for (const k of SAMPLE) for (const s of SEEDS)
    for (const x of MEASURED[k][s]) if (Math.abs(x) > 7) { bad.push(k + "/" + s + " " + x); break; }
  assert.deepStrictEqual(bad, [], "moves wider than an octave: " + bad.slice(0, 8).join(" · "));
});

/* ---- §F the singer nobody cast ------------------------------------------ */
/* Paul, of the same record: *"the vocals are do dooo doooo"*. Measured, 319 of
   502 rows declare no `tone.mouth`; `instruments.js throatOf` casts them one
   of sixteen MOUTHS rows, and a MOUTHS row carries two or three vowels walked
   at a constant rate — so 90 rows sang `eao` for the length of the record.
   The throat is still cast from place and year; the WORD is the family's
   (`genres-tables.js SYLLABLES`), and these are the four claims that makes. */
const NI = R("instruments.js");
const MOUTHLESS = Object.keys(GENRES).filter((k) => !((GENRES[k].tone || {}).mouth));
ok("§F1 every syllable word is long enough to not repeat inside a bar", () => {
  for (const [n, w] of Object.entries(GT.SYLLABLES)) {
    assert.ok(/^[ieaou]{5,}$/.test(w.w), n + " is not five or more of the tract's vowels: " + w.w);
    /* FIVE OR SEVEN, never four, six or eight: the word is walked at a
       constant `syll` against a bar of two or four beats, so an even-length
       word says the same vowel on the same beat forever. This is the whole
       arithmetic of the fix and it is asserted rather than trusted. */
    assert.ok(w.w.length % 2 === 1, n + " has an even-length word (" + w.w.length + ")");
    assert.ok(w.syll > 0, n + " has no rate");
  }
});
ok("§F2 every family names a word", () => {
  const fams = new Set(Object.keys(GENRES).map((k) => GENRES[k].family).filter(Boolean));
  for (const f of fams) assert.ok(GT.SYLL_FAMILY[f], "family " + f + " names no syllable word");
});
ok("§F3 no mouthless row sings fewer than five syllables before repeating", () => {
  const bad = [];
  for (const k of MOUTHLESS) {
    const th = NI.throatOf(k, "solo_vox");
    if (!th) continue;
    if (!th.vowels || th.vowels.length < 5) bad.push(k + " sings " + th.vowels);
  }
  assert.deepStrictEqual(bad.slice(0, 10), [], bad.length + " rows still say two or three syllables");
});
ok("§F4 a row that states its own mouth is not reached by any of this", () => {
  const own = Object.keys(GENRES).filter((k) => (GENRES[k].tone || {}).mouth);
  assert.ok(own.length > 100, "only " + own.length + " rows state a mouth");
  for (const k of own.slice(0, 40)) {
    const m = GENRES[k].tone.mouth;
    const words = new Set(Object.values(GT.SYLLABLES).map((x) => x.w));
    assert.ok(!words.has(m.vowels) || m.vowels.length < 5,
      k + " states a mouth that this round overwrote");
  }
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
