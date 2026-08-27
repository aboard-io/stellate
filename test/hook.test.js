// test/hook.test.js — DOES PRESSING REWRITE CHANGE THE TUNE? (2026-08-27)
//
// Paul, on staging: "No matter how many times I hit REWRITE the hook is the
// same on Iranian pop." He was right, and it was never an Iranian pop bug:
// measured over 191 anchors x 8 seeds, NOT ONE anchor's hook changed its
// rhythm and NOT ONE changed its degrees. The seed reached compose(), moved
// the arrangement, and died before the tune — `cellOf` took no seed at all and
// `Id.toPhrase` is pure and memoised on the words it was handed.
//
// This gate is the ear's question asked in numbers, and it asks it of the
// ARTIFACT: it reads the `play` and `deg` rows of the DOCUMENT precompose
// hands back, not the words that made them, because a reading that printed
// three new words and rendered the same sixteen steps would be the same
// complaint with better paperwork.
//
// FIVE THINGS, in order:
//   1  ten rewrites of iranpop are ten hooks
//   2  the whole catalog moves, not one genre
//   3  nothing became a coin toss (same seed -> byte-identical record)
//   4  an anchor that states what its music is keeps it at every reading
//   5  a record already written down does not move at all
"use strict";
const assert = require("assert");
const path = require("path");
const crypto = require("crypto");
const R = (p) => require(path.join(__dirname, "..", "nukernel", p));

const NG = R("genres.js"), K = R("kernel.js"), Id = R("ideas-kit.js");
const Doc = R("document.js"), P = R("precompose.js"), NuSongs = R("songs.js");
const { GENRES } = NG;

let pass = 0, fail = 0;
const ok = (name, fn) => {
  try { fn(); pass++; console.log("ok    " + name); }
  catch (e) { fail++; console.log("FAIL  " + name + "\n      " + e.message); }
};

const ANCHORS = P.anchors();
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const J = (x) => JSON.stringify(x);
const sha = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);

/* THE HOOK, off the document. `material.cells.hook` is slot 0 — the idiom
   itself, KINDS.hook = {} — and a record that deals no hook slot falls back to
   its first line cell, because "a record is never cell-less" is precompose's
   own law and this gate must not skip the records it protects. */
function hookOf(doc) {
  const cells = (doc.material && doc.material.cells) || {};
  return cells.hook || Object.values(cells).find((c) => c && c.kind === "line");
}
// the RHYTHM, as the document spells it: n a note, h held, r a rest
const rhythmOf = (c) => c.play.join("");
// what an ear would call the hook: which steps sound, and on which degree
const hookLine = (c) => {
  const out = [];
  for (let i = 0; i < c.play.length; i++) if (c.play[i] === "n") out.push(i + ":" + c.deg[i]);
  return out.join(" ");
};
const onsetsIn = (c) => c.play.filter((x) => x === "n").length;

console.log("hook — " + ANCHORS.length + " anchors, seeds " + SEEDS.join(",") + "\n");

/* ======================================================================
   1 · TEN REWRITES OF IRANIAN POP ARE TEN HOOKS
   ====================================================================== */
ok("iranpop: 10 rewrites, >= 8 distinct hooks and >= 5 distinct rhythms", () => {
  const lines = [], rhythms = [];
  console.log("\n  the ten readings of iranpop — rhythm, then step:degree\n");
  for (let s = 1; s <= 10; s++) {
    const d = P.genreToDocument("iranpop", s);
    const c = hookOf(d);
    lines.push(hookLine(c)); rhythms.push(rhythmOf(c));
    console.log("    seed " + String(s).padStart(2) + "  key " +
                String(d.alphabet.key).padStart(3) + "  " +
                rhythmOf(c).replace(/r/g, ".") + "   " + hookLine(c));
  }
  console.log("");
  const dh = new Set(lines).size, dr = new Set(rhythms).size;
  console.log("    distinct hooks " + dh + "/10   distinct rhythms " + dr + "/10\n");
  assert(dh >= 8, "only " + dh + " distinct hooks in ten rewrites");
  assert(dr >= 5, "only " + dr + " distinct rhythms in ten rewrites — the ear " +
                  "names the rhythm, and half of ten is the floor");
});

/* ======================================================================
   2 · THE WHOLE CATALOG MOVES
   ======================================================================
   Not iranpop: every anchor in the box, across eight readings. The FRACTION
   is the number, because the bug was universal and a fix that reached one
   family would be the same bug on a shorter list.

   THE FIVE THAT DO NOT MOVE THEIR RHYTHM ARE NAMED, and named here rather
   than counted, because they are a DECISION: drone, dub, ambient, enka and
   arabesk each state `cell: "long"` on their own IDIOM_ANCHOR row, `long` is
   alone in its density band (two onsets in the bar — precompose §6b), and a
   band of one is a pin. A drone is a drone. They move on contour, landing and
   key like everything else. */
const FROZEN_RHYTHM = ["ambient", "arabesk", "drone", "dub", "enka"];
ok("catalog: hook rhythm and degrees vary at nearly every anchor", () => {
  let rv = 0, dv = 0, kv = 0; const frozen = [];
  for (const g of ANCHORS) {
    const rs = new Set(), ds = new Set(), ks = new Set();
    for (const s of SEEDS) {
      const d = P.genreToDocument(g, s), c = hookOf(d);
      rs.add(rhythmOf(c)); ds.add(c.deg.join(",")); ks.add(d.alphabet.key);
    }
    if (rs.size > 1) rv++; else frozen.push(g);
    if (ds.size > 1) dv++;
    if (ks.size > 1) kv++;
  }
  const n = ANCHORS.length;
  console.log("\n    " + n + " anchors x " + SEEDS.length + " seeds");
  console.log("      hook RHYTHM varies   " + rv + "/" + n + "  " + (rv / n).toFixed(3));
  console.log("      hook DEGREES vary    " + dv + "/" + n + "  " + (dv / n).toFixed(3));
  console.log("      record KEY varies    " + kv + "/" + n + "  " + (kv / n).toFixed(3));
  console.log("      rhythm-frozen: " + (frozen.join(" ") || "none") + "\n");
  assert(n >= 50, "the sweep must cover at least 50 anchors, covered " + n);
  assert(rv / n >= 0.95, "hook rhythm varies at only " + (rv / n).toFixed(3) + " of anchors");
  assert(dv === n, "hook degrees frozen at " + (n - dv) + " anchors");
  assert(kv === n, "key frozen at " + (n - kv) + " anchors");
  assert.deepStrictEqual(frozen.slice().sort(), FROZEN_RHYTHM,
    "the rhythm-frozen list is a DECISION and it changed: " + frozen.join(" "));
});

/* ======================================================================
   3 · NOTHING BECAME A COIN TOSS
   ======================================================================
   The determinism law, asserted on the SERIALIZED document because that is
   what gets saved, shared and reloaded. Twice through, INTERLEAVED — the
   second pass runs after every other anchor has been composed, so a phrase
   cache keyed on too little (ideas-kit PHCACHE) fails here instead of in a
   browser three weeks from now. */
ok("determinism: same seed, byte-identical document, 20 anchors x 8 seeds", () => {
  const twenty = ANCHORS.filter((_, i) => i % Math.floor(ANCHORS.length / 20) === 0).slice(0, 20);
  const first = new Map();
  for (const g of twenty) for (const s of SEEDS) first.set(g + "/" + s, J(P.genreToDocument(g, s)));
  let n = 0;
  for (const g of twenty) for (const s of SEEDS) {
    const again = J(P.genreToDocument(g, s));
    assert.strictEqual(again, first.get(g + "/" + s), g + " seed " + s + " is not deterministic");
    n++;
  }
  console.log("    " + twenty.length + " anchors, " + n + " documents, all byte-identical on re-composition");
});

/* ======================================================================
   4 · AN ANCHOR KEEPS WHAT IT SAID ABOUT ITSELF
   ======================================================================
   IDIOM_ANCHOR is 54 rows of an anchor stating what ITS music is, and §6b
   binds each word differently: a stated `contour` is PINNED (the gesture),
   a stated `cell` binds its DENSITY BAND (the figure — "the 303 is a
   sixteenth-note machine" is a claim about density, not a serial number),
   a stated `land` is OPEN (a bop head that resolves to the root is still a
   bop head), and a stated `len`, `sent` or `reg` cannot reach a one-bar cell
   at all.

   READ BACK OFF THE ARTIFACT. This does not ask precompose what it drew: it
   builds every cell the anchor is ALLOWED to produce — the legal space —
   and asserts the cell in the document is one of them. A contour that leaked
   past its pin, or a cell that left its band, lands outside that space. The
   space is reported next to the full 10 x 8 x 5 = 400 so it is visible that
   the gate is constraining something. */
ok("idiom respect: every stated axis holds in every slot at every reading", () => {
  assert.strictEqual(P.CELL_BAR_CEILING, 1, "this gate reads one-bar cells");
  const cb = 1, steps = 16;
  const CELLS = Object.keys(Id.CELLS), CONT = Object.keys(Id.CONTOURS),
        LAND = Object.keys(Id.LANDINGS);
  const onsets = (c) => Id.CELLS[c].g.filter((v) => v === 1).length;
  const band = (c) => { const n = onsets(c);
    return n <= 2 ? "held" : n <= 3 ? "short" : n <= 5 ? "moving" : "running"; };
  const rows = Object.keys(P.IDIOM_ANCHOR).filter((g) => ANCHORS.includes(g));
  // EVERY SLOT, not only the hook: a KIND's own word pins every axis it
  // states, so `riff`, `pad` and `climb` are the tightest cases in the box
  // and skipping them would leave the pin untested where it matters most.
  const spaceCache = new Map();
  const spaceFor = (g, k) => {
    const ck = g + "/" + k;
    if (spaceCache.has(ck)) return spaceCache.get(ck);
    const own = P.IDIOM_ANCHOR[g], G = GENRES[g], row = P.idiomOf(g).row;
    const kind = P.KINDS[k] || {};
    const pool = (f, all) => kind[f] != null ? [kind[f]]
      : own[f] == null ? all
      : f === "contour" ? [own[f]]
      : f === "cell" ? all.filter((c) => band(c) === band(own[f]))
      : all;                                          // `land` is open
    const legal = new Set();
    for (const c of pool("cell", CELLS))
      for (const ct of pool("contour", CONT))
        for (const l of pool("land", LAND))
          legal.add(J(P.cellOf(row, k, cb, G, steps, { cell: c, contour: ct, land: l }).cell));
    spaceCache.set(ck, legal);
    return legal;
  };
  let checked = 0, spaceSum = 0, spaces = 0;
  const bandBust = [];
  for (const g of rows) {
    const own = P.IDIOM_ANCHOR[g];
    for (const s of SEEDS) {
      const cells = P.genreToDocument(g, s).material.cells;
      for (const k of Object.keys(cells)) {
        const c = cells[k];
        if (c.kind !== "line") continue;              // the kit is not a phrase
        const legal = spaceFor(g, k);
        assert(legal.has(J(c)), g + " seed " + s + " slot " + k + " composed a cell " +
               "outside what its IDIOM_ANCHOR row allows (" + J(own) + ")");
        // ...and the DENSITY claim, said in the document's own units
        const kindCell = (P.KINDS[k] || {}).cell;
        const want = kindCell != null ? band(kindCell) : own.cell != null ? band(own.cell) : null;
        if (want) {
          const n = onsetsIn(c);
          const got = n <= 2 ? "held" : n <= 3 ? "short" : n <= 5 ? "moving" : "running";
          if (got !== want) bandBust.push(g + "/" + s + "/" + k + " " + got + " != " + want);
        }
        checked++;
      }
    }
  }
  for (const v of spaceCache.values()) { spaceSum += v.size; spaces++; }
  assert.deepStrictEqual(bandBust.slice(0, 6), [], "cells left their density band");
  console.log("    " + rows.length + " anchor rows x " + SEEDS.length + " seeds = " +
              checked + " line cells, every one inside its own row's legal space");
  console.log("    mean legal space " + (spaceSum / spaces).toFixed(1) +
              " distinct cells per (anchor, slot), against 400 unconstrained\n");
});

/* ======================================================================
   5 · A RECORD ALREADY WRITTEN DOWN DOES NOT MOVE
   ======================================================================
   Reading variation happens at COMPOSE time. songs.js TERMS is the shipped
   chant — a document somebody wrote down, not a genre somebody composed —
   and no seed exists anywhere on its path. The risk is not that precompose
   edits it; the risk is the SHARED PHRASE CACHE: `Id.toPhrase` is memoised
   across the whole process, so a reading that composed a phrase under a key
   too narrow to tell two readings apart would hand the saved record somebody
   else's tune. So the saved record is rendered BEFORE any composition, then
   again after 199 anchors x 4 readings have gone through the same cache, and
   the two renders must be the same bytes. */
ok("old records: songs.js TERMS renders byte-identical before and after 796 readings", () => {
  const doc = NuSongs.TERMS;
  const render = () => {
    const out = [];
    doc.form.sections.forEach((sec, i) => {
      const g = Doc.toGenre(doc, i, GENRES);
      const lines = doc.voices.filter((v) => v.kind === "line");
      for (const c of lines) {
        const ph = Doc.toPhrase(doc, Doc.materialAt(c, sec.id));
        out.push(sec.id + "/" + c.name + "/" + J(ph));
      }
      out.push(sec.id + "/genre/" + J(g.mode) + "/" + g.bpm);
    });
    return out.join("\n");
  };
  const before = render(), beforeDoc = J(doc);
  let n = 0;
  for (const g of ANCHORS) for (const s of [1, 2, 3, 4]) { P.genreToDocument(g, s); n++; }
  const after = render();
  assert.strictEqual(sha(after), sha(before),
    "the shipped chant rendered differently after " + n + " compositions");
  assert.strictEqual(J(doc), beforeDoc, "composition mutated a saved document");
  console.log("    chant render " + sha(before) + " before, " + sha(after) +
              " after " + n + " compositions; the saved document is unmoved");
  // ...and a precomposed record, SAVED, is the same when it is loaded again:
  // a document is a value, and a reading is not stored inside it anywhere.
  const saved = J(P.genreToDocument("iranpop", 7));
  const reloaded = JSON.parse(saved);
  assert.strictEqual(J(reloaded), saved, "a saved document did not survive a round trip");
});

console.log("\n" + (fail ? "FAIL " + fail + " / " : "") + pass + " passed");
process.exit(fail ? 1 : 0);
