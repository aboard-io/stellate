#!/usr/bin/env node
/* test/dynfigure.test.js — THE FIGURE VOCABULARY, AND THE FOUR THINGS IT MUST
 * NOT BREAK (2026-09-06, the dynamics flood shift 1; docs/DYNAMICS-FLOOD.md).
 *
 * The census of 2026-09-05 measured the whole dynamic alphabet of 3,991
 * composed line cells as {5, 6, 8} — one hard-coded line in `ideas-kit.js` —
 * and 2,651 of 2,672 accents as downbeat-only, one hard-coded line in
 * `precompose.js`. Both lines are a NAMED FIGURE now (`genres-tables.js`
 * FIGURES) and a row quotes one by name in `dyn`. Four claims hold that seam:
 *
 *   §A  the vocabulary and the catalogue agree — every figure is used by a
 *       row, every row's figure exists, and nothing names a figure that is not
 *       in the table (the build refuses that too, this is the other end).
 *   §B  two named families do not share a figure by accident. If funk and
 *       chant come out the same the flood did not happen.
 *   §C  ABSENT IS THE OLD LINE. A row that names no figure composes
 *       byte-identically to the same row naming `lean`, on every row in the
 *       catalogue — which is what makes "479 rows unchanged before any data
 *       was written" a fact rather than a hope. And the two spellings of the
 *       lean itself (this table's, and `ideas-kit.js`'s own fallback for a
 *       phrase asked for without a catalogue) agree on every (j, n) a bar of
 *       this box can have, so the pair cannot drift apart.
 *   §D  THE MACHINES DID NOT MOVE. The fourteen `DYNAMICS: null` rows compose
 *       to the same bytes they composed on 0178335, the commit before the
 *       flood — held by fingerprint, not by argument.
 *
 * Wave 1: node, no DOM, no audio, no browser.
 */
"use strict";
const path = require("path");
const crypto = require("crypto");
const assert = require("assert");
const R = (p) => require(path.join(__dirname, "..", "nukernel", p));
const NG = R("genres.js"), P = R("precompose.js"), Doc = R("document.js");
const Id = R("ideas-kit.js");
const { GENRES, FIGURES, DYNAMICS } = NG;

let pass = 0, fail = 0;
const ok = (name, fn) => {
  try { fn(); pass++; console.log("ok    " + name); }
  catch (e) { fail++; console.log("FAIL  " + name + "\n      " + e.message); }
};
const fp = (k) => crypto.createHash("sha1")
  .update(JSON.stringify(Doc.normalize(P.genreToDocument(k, 1))))
  .digest("hex").slice(0, 16);
/* compose a row as if it declared exactly this `dyn` (or none). The catalogue
   object is what `precompose` reads, so the swap is on the row itself and it
   is put back afterwards — no second door into the compiler. */
function asIf(k, dyn) {
  const g = GENRES[k], had = Object.prototype.hasOwnProperty.call(g, "dyn"), was = g.dyn;
  if (dyn == null) delete g.dyn; else g.dyn = dyn;
  try { return fp(k); }
  finally { if (had) g.dyn = was; else delete g.dyn; }
}
const KEYS = Object.keys(GENRES);

/* ---- §A the vocabulary and the catalogue agree --------------------------- */
ok("§A1 every row's `dyn` names a figure that exists", () => {
  const bad = KEYS.filter((k) => GENRES[k].dyn != null && !FIGURES[GENRES[k].dyn]);
  assert.deepStrictEqual(bad, [], "rows naming no figure: " + bad.join(","));
});
ok("§A2 every figure in the vocabulary is used by at least one row", () => {
  const used = new Set(KEYS.map((k) => GENRES[k].dyn).filter(Boolean));
  /* `lean` is the absent case AND an argued row (march, waltz, polka, musette,
     riff say it out loud, because a tier above would otherwise have taken it
     away), so it is held to the same standard as the other eight rather than
     excused. A figure nobody uses is a figure nobody maintains. */
  const unused = Object.keys(FIGURES).filter((f) => !used.has(f));
  assert.deepStrictEqual(unused, [], "figures no row quotes: " + unused.join(","));
});
ok("§A3 every figure answers with a legal level and a legal accent", () => {
  for (const f of Object.keys(FIGURES)) {
    const F = FIGURES[f];
    assert.strictEqual(F.k, f, f + ": the name stamp is wrong");
    assert.strictEqual(typeof F.w, "string", f + ": no word for it");
    for (const N of [12, 16]) for (let n = 1; n <= N; n++) {
      const at = []; for (let x = 0; x < n; x++) at.push(Math.floor(x * N / n));
      for (let j = 0; j < n; j++) for (const b of [0, 1, 2, 3]) {
        const v = F.vel(j, n, at[j], b, N, at), a = F.acc(j, n, at[j], b, N, at);
        assert(Number.isInteger(v) && v >= 0 && v <= 9,
          `${f}: vel(${j},${n},${at[j]},${b},${N}) = ${v}, not a level 0..9`);
        assert(a === 0 || a === 1 || a === true || a === false,
          `${f}: acc(${j},${n},${at[j]},${b},${N}) = ${a}, not an accent`);
      }
    }
  }
});

/* ---- §B two families do not share a figure by accident ------------------- */
/* Said as PAIRS OF RECORDS rather than as a count, because the claim is about
   what the box plays: these are the six oppositions the shift exists to make
   audible, and each pair must differ in the SHAPE (which note is loudest and
   where the accent falls), not merely in the notes. */
const PAIRS = [
  ["funk", "gregorian", "the groove against the chant — the flood's own example"],
  ["rock", "romantic", "the backbeat against the swell"],
  ["jazz", "motorik", "the pickup against the machine that refuses to lean"],
  ["fugue", "reggae", "the terrace against the displacement"],
  ["gospel", "minimalism", "the church build against the process"],
  ["tango", "detroitsoul", "the rubato close against two and four"],
];
const profile = (k) => {
  const d = Doc.normalize(P.genreToDocument(k, 1));
  const cells = (d.material && d.material.cells) || {};
  const out = [];
  for (const n of Object.keys(cells).sort()) {
    const c = cells[n];
    if (c.kind === "drum") continue;
    const on = (c.play || []).map((p, i) => (p === "n" ? i : -1)).filter((i) => i >= 0);
    out.push(on.map((i) => (c.vel[i] || 0) + (c.acc[i] ? "!" : "")).join(" "));
  }
  return out.join(" | ");
};
ok("§B named oppositions render different dynamic profiles", () => {
  for (const [a, b, why] of PAIRS) {
    assert(GENRES[a] && GENRES[b], a + "/" + b + ": row missing");
    assert.notStrictEqual(GENRES[a].dyn || "lean", GENRES[b].dyn || "lean",
      `${a} and ${b} quote the same figure (${why})`);
    assert.notStrictEqual(profile(a), profile(b),
      `${a} and ${b} render the same per-note dynamics (${why})`);
  }
});
ok("§B2 the catalogue's alphabet is wider than the three levels it had", () => {
  const seen = new Set();
  let accOn = 0, accOff = 0;
  for (const k of KEYS) {
    let d; try { d = Doc.normalize(P.genreToDocument(k, 1)); } catch (e) { continue; }
    const cells = (d.material && d.material.cells) || {};
    for (const n of Object.keys(cells)) {
      const c = cells[n];
      if (c.kind === "drum") continue;
      const on = (c.play || []).map((p, i) => (p === "n" ? i : -1)).filter((i) => i >= 0);
      for (const i of on) { seen.add(c.vel[i]);
        if (c.acc[i]) (i % 16 === 0 ? accOn++ : accOff++); }
    }
  }
  /* measured on 2026-09-05: exactly {5, 6, 8} and 21 accents anywhere but a
     barline, over the same cells. Both numbers are floors, not equalities —
     a later round may widen either. */
  assert(seen.size >= 6, "the velocity alphabet is back down to " + [...seen].sort().join("/"));
  assert(accOff > 1000, "only " + accOff + " accents fall off the downbeat (was 21)");
  assert(accOn > 0, "nothing is accented on a barline any more, which is also wrong");
});

/* ---- §C absent is the old line ------------------------------------------ */
ok("§C1 `lean` and ideas-kit's own fallback agree on every (j, n)", () => {
  /* the fallback is `j === 0 ? 8 : (j === last ? 5 : 6)`, restated here with
     this comment so that a drift is a loud failure rather than a silent one —
     the same arrangement `test/hand.test.js` has with the kernel's HAND_KITS. */
  for (let n = 1; n <= 64; n++) for (let j = 0; j < n; j++)
    assert.strictEqual(FIGURES.lean.vel(j, n), j === 0 ? 8 : (j === n - 1 ? 5 : 6),
      `lean disagrees with the fallback at (${j}, ${n})`);
  for (const N of [12, 16]) for (let i = 0; i < N; i++)
    assert.strictEqual(!!FIGURES.lean.acc(0, 1, i, 0, N, [i]), i === 0,
      "lean's accent is no longer the top of the bar");
});
ok("§C2 a row that names nothing composes exactly as one that names `lean`", () => {
  const moved = [];
  for (const k of KEYS) {
    let a, b;
    try { a = asIf(k, null); b = asIf(k, "lean"); } catch (e) { continue; }
    if (a !== b) moved.push(k);
  }
  assert.deepStrictEqual(moved, [],
    "absent and `lean` are not the same record on: " + moved.join(","));
});
ok("§C3 the phrase cache tells two figures apart", () => {
  /* a memo keyed without the figure would hand the second caller the first
     one's levels — the failure this assertion exists to catch. */
  const m = { ...Id.blank(), cell: "even", len: "one" };
  const a = Id.toPhrase({ ...m }, null).vel.join(",");
  const b = Id.toPhrase({ ...m, dyn: FIGURES.swell }, null).vel.join(",");
  const c = Id.toPhrase({ ...m, dyn: FIGURES.agogic }, null).vel.join(",");
  assert.notStrictEqual(a, b, "the swell came back as the lean");
  assert.notStrictEqual(b, c, "the agogic close came back as the swell");
  assert.strictEqual(Id.toPhrase({ ...m }, null).vel.join(","), a,
    "asking again for the unfigured phrase gave a different answer");
});

/* ---- §D the machines did not move --------------------------------------- */
/* THE FINGERPRINTS ARE HEAD'S. Measured on 0178335 — the commit before this
   shift — with `sha1(JSON.stringify(document.normalize(precompose
   .genreToDocument(key, 1)))).slice(0, 16)`, which is the artifact the flood
   acts on. A machine does not breathe: the fourteen `DYNAMICS: null` rows
   declare no `dyn` at all, so they keep the leaning first note and these
   sixteen hex digits each. If one of them moves, either a machine was given a
   figure or something else in the compiler moved underneath this shift — and
   the second is worth a failure too.

   TWO OF THE FOURTEEN WERE RE-PINNED ON 2026-09-06 (the genre-QA shift), and
   the alarm above did its job: `techno` and `tromso` moved, nothing was given
   a figure, and something in the compiler DID move underneath. Paul, on the
   real app: *"Soft rock ... has a lurch effect on it"* — measured as the
   record-wide chip landing on the bass and the drum kit, which on a room kit
   at the chorus's declared amount is 20.0 dB of comb ripple wobbling the
   rhythm section 1.4 times a second. precompose now keeps a record-wide chip
   off those two chairs unless the row declares `fxRhythm` (one row does:
   `minneapolissound`, whose note asked for the exception two rounds early).

   THE ARITHMETIC SAYS IT WAS THAT AND ONLY THAT. Of these fourteen rows, SIX
   declare an `fx` at all: `electro`, `tapemusic`, `dubstep` and `gqom` declare
   `echo`, which `precompose soundFxOf` has always filtered out (it became a
   send), and `techno` and `tromso` declare `sweep`, which it does not. Two
   rows carry a chip that reaches a chair; exactly those two moved; the other
   twelve are byte-identical. The new digits are the same measurement as the
   old — `sha1(JSON.stringify(document.normalize(precompose.genreToDocument(
   key, 1)))).slice(0, 16)` — taken with the narrowing in place.

   ELEVEN OF THE FOURTEEN WERE RE-PINNED ON 2026-09-07 (the engine audit, E5),
   and the alarm did its job again: nothing was given a figure, and something
   in the compiler moved underneath. `compose.js build()` deals a drop's kit
   and bass word out of two literal lists, and three of the words in them are
   DATED INVENTIONS rather than techniques — the amen break (1969), the Reese
   bass (1988) and the dubstep WOBBLE (2006). Measured before the gate: the
   wobble was dealt to 13 rows older than 2006, including `polka` (Prague
   1837). The lists are filtered on the label's own year now.

   AND THE THREE THAT DID NOT MOVE SAY THE RULE OUT LOUD. `footwork` (2013)
   and `gqom` (2016) POSTDATE the wobble, still draw it in two of their three
   drops, and are byte-identical; `tapemusic` (1948) has no kit at all, so the
   line that deals these words never runs on it. Every one of the other eleven
   is older than 2006 — `techno` 1988, `acid` 1987, `house` 1986, `electro`
   1982, `italodisco` 1982, `miamibass` 1986, `crunk` 1997, `tromso` 2001,
   `grime` 2003, `trap` 2003, `dubstep` 2005 — and stops reaching for a gesture
   that had not been invented. Detroit 1988 keeps its Reese: the test is "later
   than", not "on or later than", so the year the thing was made is not the year
   it becomes unavailable. The new digits are the same measurement as the old.

   THIRTEEN OF THE FOURTEEN WERE RE-PINNED ON 2026-09-07 (the twelve
   questions, 3), and the alarm did its job a third time: nothing was given a
   figure, and something in the compiler moved underneath. `precompose.js
   grooveOf` returned `push` for all thirteen of these rows — a word it reached
   by asking about `stress`, the tempo and whether the kit fires on offbeat
   sixteenths, none of which is a fact about what the DRUMS PLAY. The audit's
   E6 measured the cost at the other end of the same function: 40 of the 203
   records that read `backbeat` had nothing on 2 and 4 at all. The word is
   derived off `G.kit` now, and every one of these thirteen took the word its
   own grid states — `techno`, `acid`, `house`, `italodisco` and `tromso` a
   FOUR ON THE FLOOR (their kick is on every beat); `trap` and `dubstep` HALF
   TIME (the backbeat lane fires on the 3 alone); `grime` and `footwork` a
   TRESILLO (their kick is the 3+3+2); `electro`, `miamibass` and `crunk` a
   BACKBEAT they can actually be measured to play; `gqom` STRAIGHT, where it
   had been given `dub`'s mined drag for having an echo and a big room.
   `electro` and `italodisco` moved for a second reason as well, and it is in
   their own notes: both declare the eighth-note root-and-octave line as a
   written figure now (`bassFig: discoct`), where `bassStyle: "octaves"` was
   giving them four notes a bar under a word their own paragraphs call the
   signature of the sound.

   AND THE ONE THAT DID NOT MOVE SAYS THE RULE OUT LOUD AGAIN. `tapemusic`
   (Paris 1948) declares no kit at all, so `grooveOf` answered null for it
   before this round and answers null after: THE KIT SAYS NOTHING, which is
   the same sentence it was always making and is now the one the box prints.
   The new digits are the same measurement as the old. */
const FROZEN = {
  techno: "6962195da935614c", acid: "0b60c44ebcaba052", house: "e907c403371c0d92",
  trap: "03d353d28a5abe47", electro: "029a41c6bea26e51", tapemusic: "99777da27cf1a1c7",
  italodisco: "b59b5f0c99354079", miamibass: "e1d5b326f2e7365b", crunk: "e89e6a98febe55e6",
  grime: "18884350eaedb0f9", dubstep: "f9e3136caff0bb7f", footwork: "bffeb9bab49b8a14",
  gqom: "e2c589536d9d317e", tromso: "174b0c723ef13ca2",
};
ok("§D1 the `DYNAMICS: null` machines declare no figure", () => {
  const nulls = Object.keys(DYNAMICS).filter((k) => DYNAMICS[k] === null);
  assert.strictEqual(nulls.length, Object.keys(FROZEN).length,
    "the null set moved (" + nulls.length + "); the fingerprints below name " +
    Object.keys(FROZEN).length);
  const spoke = nulls.filter((k) => GENRES[k].dyn != null);
  assert.deepStrictEqual(spoke, [], "a machine started breathing: " + spoke.join(","));
});
ok("§D2 the machines compose to the same bytes as they did at the pin", () => {
  const moved = [];
  for (const k of Object.keys(FROZEN)) {
    const now = fp(k);
    if (now !== FROZEN[k]) moved.push(k + " " + FROZEN[k] + " -> " + now);
  }
  assert.deepStrictEqual(moved, [], "machines moved:\n      " + moved.join("\n      "));
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
