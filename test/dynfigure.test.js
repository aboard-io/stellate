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
   the second is worth a failure too. */
const FROZEN = {
  techno: "9fcfbeedd8d51e1c", acid: "79810bb9e20a21a7", house: "5aa405df88fc70e3",
  trap: "0d3692b201de1516", electro: "f3d0d61db5c6e143", tapemusic: "99777da27cf1a1c7",
  italodisco: "f8de629f00eed78c", miamibass: "ff3b0f736cacfd9c", crunk: "dd253e2ea1ab2d2e",
  grime: "071f5db0a1d194db", dubstep: "b05ff830f6b9d2c8", footwork: "9c7802d431b4c468",
  gqom: "38e64788f9a34b5a", tromso: "0f31a041bd8dce77",
};
ok("§D1 the `DYNAMICS: null` machines declare no figure", () => {
  const nulls = Object.keys(DYNAMICS).filter((k) => DYNAMICS[k] === null);
  assert.strictEqual(nulls.length, Object.keys(FROZEN).length,
    "the null set moved (" + nulls.length + "); the fingerprints below name " +
    Object.keys(FROZEN).length);
  const spoke = nulls.filter((k) => GENRES[k].dyn != null);
  assert.deepStrictEqual(spoke, [], "a machine started breathing: " + spoke.join(","));
});
ok("§D2 the machines compose to the same bytes as they did on 0178335", () => {
  const moved = [];
  for (const k of Object.keys(FROZEN)) {
    const now = fp(k);
    if (now !== FROZEN[k]) moved.push(k + " " + FROZEN[k] + " -> " + now);
  }
  assert.deepStrictEqual(moved, [], "machines moved:\n      " + moved.join("\n      "));
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
