#!/usr/bin/env node
/* test/hand.test.js — THE HAND PROBE. Who is humanized, who is exempt, and
 * whether the hand ARRIVES at the rendered events (2026-08-30, Paul:
 * "Shouldn't more genres be humanized").
 *
 * This gate exists because of two measured failures in one day:
 *
 *   1. DECLARED BUT NEVER ARRIVING (the box's characteristic bug). The kernel
 *      HAND LAW (kernel.js ~2357) gave acoustic kits a default 0.03 jitter —
 *      and the document compiler wrote `humanize: G.humanize || 0`
 *      (precompose.js:2417), so on the document path every anchor that said
 *      NOTHING arrived saying "exactly on the grid". Measured before the fix:
 *      vaporwave/rock/bulgarian/sludge/tango/deathmetal — ZERO off-grid drum
 *      hits through toGenre, while the same anchors jittered on the raw
 *      GENRES path. kernel.js drums() now reads a bare 0 as absent (the
 *      dated comment there says how a chosen zero is still recognised).
 *
 *   2. THE §39 LAW HAD NO GATE. genres.js promises "a club genre added
 *      without an entry resolves to nothing and renders flat forever, which
 *      is the failure this table exists to prevent; §39 fails on it by name"
 *      — and no runnable gate held it: `jpop` (Tokyo 1999, walls-down round)
 *      shipped in family `club` with no DYNAMICS row and renders flat.
 *      Section 1 below IS that gate now; jpop sits in a DATED debt list so
 *      the ledger is honest until genres.js gets its row.
 *
 * Everything here reads RENDERED EVENTS through the same seam the pages use
 * (P.genreToDocument -> Doc.toGenre -> K.render/K.drums), never a module's
 * opinion of what it would do. Machines are proven exempt by byte-comparison
 * against an explicit hand:"exact" control, not by reading a field.
 */
"use strict";
const path = require("path");
const R = (p) => require(path.join(__dirname, "..", "nukernel", p));
const NG = R("genres.js"), K = R("kernel.js"), Doc = R("document.js"),
      P = R("precompose.js");
const { GENRES, DYNAMICS, DYN_FAMILY } = NG;

let pass = 0, fail = 0;
const ok = (name, fn) => {
  try { fn(); pass++; console.log("ok    " + name); }
  catch (e) { fail++; console.log("FAIL  " + name + "\n      " + e.message); }
};
const assert = require("assert");

/* The kernel's own constants, restated. kernel.js does not export HAND_KITS /
 * HAND_HUM (they are the law's private numbers); this gate restates them WITH
 * this comment so a drift is a loud failure here rather than a silent one:
 * if the law's kit list or default changes, section 3's bounds break. */
const HAND_KITS = { room: 1, jazz: 1, power: 1, acoustic: 1, brush: 1 };
const HAND_HUM = 0.03;

/* ---- §1 RESOLUTION — the §39 law, finally runnable ---------------------- */
/* Every anchor resolves its dynamics to its own DYNAMICS row, to its family
 * row, or to a deliberate null. An anchor resolving to NOTHING renders flat
 * forever, silently. Known debt is DATED and named, not papered over. */
const DEBT_NO_DYNAMICS = [
  // 2026-08-30: jpop (Tokyo 1999) is family `club` — which deliberately has
  // no fallback row — and got no DYNAMICS row in the walls-down round. Its
  // own comment says it "files beside kpop"; the missing row is reported for
  // the genres.js owner (this round's fence excludes genres.js). Remove from
  // this list the day the row lands.
  "jpop",
];
ok("§1 every anchor resolves dynamics (own row | family row | dated null/debt)", () => {
  const naked = [];
  for (const k of Object.keys(GENRES)) {
    const own = Object.prototype.hasOwnProperty.call(DYNAMICS, k);
    if (own) continue;                       // a row, or a deliberate null
    if (DYN_FAMILY[GENRES[k].family]) continue;
    naked.push(k);
  }
  assert.deepStrictEqual(naked.sort(), DEBT_NO_DYNAMICS.slice().sort(),
    "anchors resolving to NO dynamics != the dated debt list: " +
    JSON.stringify(naked));
});
ok("§1b the stamped fields agree with the resolution", () => {
  for (const k of Object.keys(GENRES)) {
    const own = Object.prototype.hasOwnProperty.call(DYNAMICS, k);
    const d = own ? DYNAMICS[k] : DYN_FAMILY[GENRES[k].family];
    if (!d) {
      if (GENRES[k].touch != null && !own)
        throw new Error(k + " has touch but resolves to nothing");
      continue;
    }
    if (GENRES[k].touch !== d.touch || GENRES[k].stress !== d.stress)
      throw new Error(k + " stamped fields differ from its resolved row");
  }
});

/* ---- the artifact reader, the same seam precompose.test.js reads -------- */
function firstSection(gk, seed) {
  const doc = P.genreToDocument(gk, seed);
  const g = Doc.toGenre(doc, 0, GENRES);
  const lines = doc.voices.filter((v) => v.kind === "line");
  const ph = lines.length
    ? Doc.toPhrase(doc, Doc.materialAt(lines[0], doc.form.sections[0].id))
    : null;
  return { g, ph };
}
const J = JSON.stringify;

/* ---- §2 THE EXEMPT SET, proven by bytes ---------------------------------- */
/* A machine's exactness is its identity. Two rings of exemption:
 *   (a) every anchor whose kit is a machine (or absent) renders its DRUMS
 *       byte-identical to an explicit hand:"exact" control — the law never
 *       reaches a kit it does not name;
 *   (b) the DYNAMICS nulls (techno, acid, house, trap, electro, tapemusic,
 *       and the walls-down additions) render their LINES byte-identical to a
 *       stripped control — no stress, no phrase, no touch arrives. */
ok("§2a no drum hand on any non-acoustic kit (all anchors, byte-proof)", () => {
  /* Classified by the DOCUMENT's own kit, not the anchor's: a record hires
   * its drummer (document.js writes `drumkit: drums.instrument`), so an
   * anchor with no kit of its own can still be handed at the artifact —
   * bolero, sizhu, carnatic and friends arrive with an acoustic kit the
   * compiler chose, and the hand reaching THEM is correct. The exemption is
   * a fact about the record as rendered. */
  const reached = [];
  let checked = 0;
  for (const gk of Object.keys(GENRES)) {
    let s; try { s = firstSection(gk, 1); } catch (e) { continue; }
    if (!s.ph) continue;
    if (HAND_KITS[s.g.drumkit] === 1) continue;    // handed at the artifact — §3
    const a = K.drums(s.ph, s.g, s.g.bars);
    const b = K.drums(s.ph, { ...s.g, hand: "exact" }, s.g.bars);
    checked++;
    if (J(a) !== J(b)) reached.push(gk);
  }
  assert(checked > 100, "the machine ring shrank to " + checked + " records");
  assert.deepStrictEqual(reached, [],
    "the hand reached machine/absent kits: " + reached.join(","));
});
ok("§2b DYNAMICS nulls render lines with no performance layer (byte-proof)", () => {
  const nulls = Object.keys(DYNAMICS).filter((k) => DYNAMICS[k] === null);
  assert(nulls.length >= 6, "the null set shrank: " + nulls.join(","));
  const moved = [];
  for (const gk of nulls) {
    let s; try { s = firstSection(gk, 1); } catch (e) { continue; }
    if (!s.ph) continue;
    const a = K.render(s.ph, s.g, s.g.bars);
    const b = K.render(s.ph,
      { ...s.g, stress: 0, phrase: 0, touch: null }, s.g.bars);
    if (J(a) !== J(b)) moved.push(gk);
  }
  assert.deepStrictEqual(moved, [],
    "a machine started breathing: " + moved.join(","));
});

/* ---- §3 THE HAND ARRIVES (document path) --------------------------------- */
/* One anchor per handed kit class, none of them a declarer: the drums must
 * MOVE against the exact control — bounded by the law's own number — and the
 * kernel stream must neither add nor remove a hit. Before 2026-08-30 every
 * one of these rendered byte-identical to its control through toGenre. */
/* The control is the CHOSEN ZERO (humanize 0 + touch 0 — the interview's own
 * trio, askable.js:125), not hand:"exact": exact also drops the HAND_VEL
 * accent contour, and this section is measuring the JITTER alone. */
ok("§3 acoustic kits jitter on the document path, within the law's bound", () => {
  const tried = [];
  for (const gk of ["vaporwave", "rock", "tango", "westernswing", "klezmer"]) {
    const s = firstSection(gk, 1);
    assert(GENRES[gk].humanize == null, gk + " declares humanize; pick another");
    assert(HAND_KITS[s.g.drumkit] === 1, gk + " is not handed at the artifact");
    const a = K.drums(s.ph, s.g, s.g.bars);
    const b = K.drums(s.ph, { ...s.g, humanize: 0, touch: 0 }, s.g.bars);
    assert(a.length > 0, gk + ": no drum hits to measure");
    assert.strictEqual(a.length, b.length,
      gk + ": the hand added or removed a hit");
    /* drums() sorts by t and the jitter can swap two near ties, so pairing is
     * PER LANE on sorted onsets (order statistics move by at most the jitter,
     * and one lane's hits sit at least a ninth of a step apart). */
    let moved = 0, n = 0;
    const lanes = [...new Set(a.map((e) => e.d))];
    for (const d of lanes) {
      const la = a.filter((e) => e.d === d).sort((x, y) => x.t - y.t);
      const lb = b.filter((e) => e.d === d).sort((x, y) => x.t - y.t);
      assert.strictEqual(la.length, lb.length, gk + ": lane " + d + " count moved");
      for (let i = 0; i < la.length; i++) {
        n++;
        const dt = Math.abs(la[i].t - lb[i].t) * s.g.rate;
        if (dt > HAND_HUM + 1e-9)
          throw new Error(gk + ": |dt| " + dt.toFixed(4) + " steps exceeds the law");
        if (dt > 1e-9) moved++;
        if (Math.abs((la[i].vel || 0) - (lb[i].vel || 0)) > 1)
          throw new Error(gk + ": lane " + d + " vel moved more than the ±1 die");
      }
    }
    tried.push(gk + " " + moved + "/" + n);
    assert(moved > n * 0.25,
      gk + " (" + s.g.drumkit + "): only " + moved + "/" + n +
      " hits moved — the hand is not arriving");
  }
});

/* ---- §4 PRECEDENCE — a declaration outranks the law, exact outranks both - */
ok("§4 precedence: own humanize > hand:\"exact\"/chosen zero > the law", () => {
  /* At the law itself (raw GENRES row, which carries blues' kit) — the
   * document path may seat blues' drums in a drum CELL, which is hand-tapped
   * and deliberately exact (drumPattern's own comment). toGenre passing the
   * declaration through is asserted separately. */
  assert.strictEqual(firstSection("blues", 1).g.humanize, 0.05,
    "blues' declaration lost in toGenre");
  const g = GENRES.blues, N = K.stepsIn(g);
  const subj = { deg: Array.from({ length: N }, (_, i) => i % 5),
                 play: Array.from({ length: N }, () => "n"),
                 vel: Array.from({ length: N }, () => 5),
                 acc: Array.from({ length: N }, () => 0), spans: [] };
  const a = K.drums(subj, g, g.bars);
  assert(a.length > 0, "blues' own kit rendered no hits");
  const b = K.drums(subj, { ...g, humanize: 0, touch: 0 }, g.bars);
  let maxdt = 0;
  for (let i = 0; i < a.length; i++)
    maxdt = Math.max(maxdt, Math.abs(a[i].t - b[i].t) * g.rate);
  assert(maxdt > HAND_HUM + 1e-9,
    "blues' spread (" + maxdt.toFixed(4) + ") is not wider than the default — " +
    "its declaration is not winning");
  assert(maxdt <= 0.05 + 1e-9, "blues exceeds its own declaration");
  /* Precedence, as the law has always ordered it: the anchor's OWN humanize
   * outranks hand:"exact" (exact opts out of the DEFAULT, it does not gag a
   * declaration), and the chosen zero — the interview trio, humanize 0 with
   * touch 0 — means the grid even on an acoustic kit. */
  const noDecl = { ...g }; delete noDecl.humanize;
  const c = K.drums(subj, { ...noDecl, hand: "exact" }, g.bars);
  const d = K.drums(subj, { ...noDecl, hand: "exact", humanize: 0, touch: 0 }, g.bars);
  assert.strictEqual(J(c), J(d),
    "hand:\"exact\" and the chosen zero must both mean the grid");
});

/* ---- §5 DETERMINISM — the same box is the same performance every play ---- */
ok("§5 two compiles of one record render byte-identical (hand included)", () => {
  for (const gk of ["oldtime", "techno", "blues"]) {
    const x = firstSection(gk, 2), y = firstSection(gk, 2);
    assert.strictEqual(
      J(K.drums(x.ph, x.g, x.g.bars)) + J(K.render(x.ph, x.g, x.g.bars)),
      J(K.drums(y.ph, y.g, y.g.bars)) + J(K.render(y.ph, y.g, y.g.bars)),
      gk + " diverged between two identical compiles");
  }
});

/* ---- §6 THE LINE HAND is single-applied and bounded ----------------------- */
/* perform() is the one owner of the line's touch; a deviation beyond touch.t
 * would mean a second hand somewhere in the pipe (the double-apply the round
 * was told to rule out). Swing and groove are systematic, identical in both
 * renders, so they cancel in the control diff. */
ok("§6 line onset deviation is bounded by the genre's own touch.t (one hand)", () => {
  let measured = 0;
  for (const gk of ["oldtime", "gregorian", "waltz", "funk", "fugue"]) {
    const s = firstSection(gk, 1);
    if (!s.ph || !s.g.touch || !s.g.touch.t) continue;
    const a = K.render(s.ph, s.g, s.g.bars);
    if (!a.length) continue;    // a drum phrase in the first slot has no line
    const b = K.render(s.ph, { ...s.g, touch: { t: 0, v: s.g.touch.v } }, s.g.bars);
    assert.strictEqual(a.length, b.length, gk + ": touch changed the note count");
    let moved = 0;
    for (let i = 0; i < a.length; i++) {
      const dt = Math.abs(a[i].t - b[i].t) * s.g.rate;
      if (dt > s.g.touch.t + 1e-9)
        throw new Error(gk + ": line |dt| " + dt.toFixed(4) +
          " exceeds touch.t " + s.g.touch.t + " — a second hand is applying");
      if (dt > 1e-9) moved++;
    }
    // ontime (tied) material legally keeps its grid, so "arriving" is asserted
    // where at least one untied note exists to move
    if (moved > 0) measured++;
    else assert(a.every((e) => e.dur >= 1), gk + ": touch.t " + s.g.touch.t +
      " moves nothing and the material is not all-tied — never arriving");
  }
  assert(measured >= 3, "only " + measured + " of the sample had a moving hand");
});

console.log("\nhand probe: " + pass + " ok, " + fail + " failed");
process.exit(fail ? 1 : 0);
