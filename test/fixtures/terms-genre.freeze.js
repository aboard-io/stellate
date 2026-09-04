// test/fixtures/terms-genre.freeze.js — HOW terms-genre.json WAS MADE, kept so
// the fixture is a derivation and not a hand-typed claim.
//
// PROGRAM.md §3 WAVE 1 asks for "a frozen capture of TODAY's genreFor(i) for
// songs.js TERMS at every section index, taken BEFORE the change". `git stash`
// is forbidden and `ui/eight.js` was dirty in the working tree, so the capture
// was taken by COPYING the pre-edit file aside and EVALUATING ITS OWN SOURCE
// TEXT — not by retyping the compiler into a test, which would have frozen my
// reading of it rather than the page's arithmetic.
//
//   cp nukernel/ui/eight.js /tmp/eight.pre.js        # before any edit
//   node test/fixtures/terms-genre.freeze.js /tmp/eight.pre.js \
//        > test/fixtures/terms-genre.json
//
// To reproduce it later, recover the pre-move file from git:
//   git show 28eed03:nukernel/ui/eight.js > /tmp/eight.pre.js
// (28eed03 is the last commit before this round; the working tree also carried
// uncommitted edits to eight.js, and it was the WORKING TREE that was frozen,
// because "today" is what the page does today.)
//
// It slices the pre-move file between four anchors and runs the slice in a
// `new Function` with the tables injected, so `genreFor` and `phrase` execute
// exactly as written. `DOC` is the page's own deep copy of songs.js TERMS.
//
// WHY THE FIXTURE LOOKS LIKE THIS — FUNCTIONS DO NOT SURVIVE JSON.
// A genre object carries four functions (`entry`, `reg`, `realize`, `word`), so
// `JSON.stringify` would drop the half of it that decides who plays what. The
// choice made here is to CALL them and freeze the answers:
//
//   · `entry(v)`, `reg(v)`, `realize(v)` return plain values for every voice
//     index the genre declares — frozen as they come.
//   · `word(v)` returns kernel OPERATORS, which are functions too. Freezing a
//     count would have passed while the operators changed underneath it, so the
//     freeze is BEHAVIOURAL: the ops are applied to one fixed reference phrase
//     with `K.word(REF, ops)` and the resulting vectors are what is stored.
//     That is why section 3 of the chant ("in retrograde") has a visibly
//     different `applied.deg` from section 1 ("as written") in the file — the
//     fixture can tell the five sections apart, which a count could not.
//   · `__v` is EXCLUDED. It is `++ver`, a module-level counter, so it differs
//     between two runs of the same code by construction; the test asserts its
//     shape (strictly increasing integers) separately instead.
//   · Everything else is compared after a JSON round-trip on BOTH sides, so
//     `drumkit: undefined` — which the no-drummer branch sets on purpose — is
//     an absent key on both sides rather than a spurious difference.
//
// THE ONE TIME THE FROZEN FILE MOVED, AND WHAT MOVED IT (2026-08-25).
// This fixture exists to prove that a round did NOT change the shipped record,
// so a change to it has to be an event with a reason attached. There has been
// exactly one: `songs.js` seated the chant's cantor with twelve numbers in
// `set`, and two of them — `vowel: 1.4` and `push: 0.42` — reached no engine
// (state-engine.js writes `vowel` from the vowel walk every syllable and drives
// `push` from velocity every note; see the long note at the deletion site in
// songs.js). They came out of the record, so they came out of its portrait.
//
// AND A SECOND TIME (2026-08-28), for one added key and nothing else.
// `document.js toGenre` now hands the kernel `part: (v) => lines[v].cast.part`
// — until this round it handed `realize` alone, so kernel.js partOf fell back
// to its two-value shim and the document's own casting sheet reached no sound
// (the part axis was inert on the 104 anchors with no `part` scheme, and read
// the ANCHOR's array, wrapped, on the other 95). A new function on the genre
// is a new row in the portrait, so `calls.part` appears. THE CHANT DID NOT
// MOVE: its two chairs are cast `line`, PARTS.line is the empty policy, and
// every other row of all five sections — `reg` included — is character for
// character what it was. The proof is the diff: 20 inserted lines, 5 sections
// x 4 lines of one new key, 0 deletions, 0 changes.
//
// THE UPDATE WAS DERIVED, NOT RETYPED, because this file cannot be re-run: its
// CLI half slices a PRE-MOVE `ui/eight.js` that no longer exists in the tree or
// in git (eight.js was rewritten this round and is not yet committed), and
// pointing it at today's file fails loudly at its own anchor regex rather than
// quietly freezing something else — which is the correct behaviour for a
// freezer. So the fixture was transformed by exactly the edit the source took:
// delete the keys `vowel` and `push` wherever they appear under a `synth.set`,
// and nothing else. The proof is the diff — 10 deleted lines, 5 sections x 2
// keys, 0 insertions, 0 other changes — and G7a passing on everything that was
// left.
//
// AND A THIRD TIME (2026-08-30, the deep-time round), for one field's value
// and nothing else. `gregorian` declared its first parent — `oxyrhynchus`
// (Oxyrhynchus 300, the oldest notated Christian music; the argument is a
// dated paragraph on the anchor itself) — so the chant's portrait carries
// `parents: { oxyrhynchus: 0.25 }` where it carried `parents: {}`. THE CHANT
// DID NOT MOVE: `parents` is genealogy data, it reaches no cell, cast, call
// or synth row, and the proof is the diff — the same one-line substitution in
// each of the five sections, 0 other changes — applied by exactly the edit
// the source took (the same derived-not-retyped procedure as 2026-08-25,
// since the CLI half still cannot be re-run).
// AND A FOURTH TIME (2026-09-04, TABLE.md wave 4), for one added key and
// nothing else — the `part` precedent above, repeated exactly. `document.js
// toGenre` now hands the kernel `cell: (v) => ...`, the table's CELL tier for
// the five fields §1 moved off the box (artic · oct · rate · scale · clamp):
// one closure, answering `null` for a chair with nothing written in it, which
// is every chair of the shipped chant and of every record until a hand writes.
// A new function on the genre is a new row in the portrait, so `calls.cell`
// appears. THE CHANT DID NOT MOVE: every one of its five sections answers
// `[null, null]`, `fields` gains no key (all five reach the genre through
// present-only spreads and the chant's rows say none of them), and every other
// row of all five sections is character for character what it was. The proof
// is the diff — 20 inserted lines, 5 sections x 4 lines of one new key, 0
// deletions, 0 changes — and G1 passing on everything that was left.
"use strict";
const fs = require("fs");
const path = require("path");
const R = path.resolve(__dirname, "../..");

// ONE OWNER OF THE PORTRAIT SHAPE. test/document.test.js requires this rather
// than keeping its own copy: a fixture and the assertion that reads it must be
// two views of one function or they drift, which is the whole lesson of the
// file this round is extracting.
const REF = { deg: [0,1,2,3,4,5,6,7,6,5,4,3,2,1,0,1],
  oct: new Array(16).fill(0), vel: new Array(16).fill(5),
  inc: new Array(16).fill(0), stk: new Array(16).fill(0),
  gate: new Array(16).fill(1), acc: new Array(16).fill(0),
  sld: new Array(16).fill(0) };

function portrait(g, K) {
  const fields = {}, calls = {}, nv = g.voices;
  for (const k of Object.keys(g).sort()) {
    if (k === "__v") continue;
    const v = g[k];
    if (typeof v !== "function") { fields[k] = v; continue; }
    const rows = [];
    for (let i = 0; i < nv; i++) {
      let r; try { r = v(i); } catch (e) { r = "throw:" + e.message; }
      rows.push(freeze(r, K));
    }
    calls[k] = rows;
  }
  return { fields, calls };
}
function freeze(r, K) {
  if (r == null || typeof r === "number" || typeof r === "string" ||
      typeof r === "boolean") return r;
  // a list of kernel operators: freeze what they DO, not what they are
  if (Array.isArray(r) && r.every((x) => typeof x === "function"))
    return { applied: K.word(REF, r) };
  return JSON.parse(JSON.stringify(r));
}
module.exports = { portrait, freeze, REF };

/* ---- the CLI half: only runs when this file is the entry point ---- */
if (require.main === module) (async () => {
  const pre = process.argv[2];
  if (!pre) { console.error("usage: terms-genre.freeze.js <pre-move ui/eight.js>"); process.exit(2); }
  const K  = require(R + "/nukernel/kernel.js");
  const NG = require(R + "/nukernel/genres.js");
  const NF = require(R + "/nukernel/fields.js");
  const NS = require(R + "/nukernel/song.js");
  const Songs = require(R + "/nukernel/songs.js");
  const TE = await import(R + "/nukernel/audio/to-engine.js");

  const src = fs.readFileSync(pre, "utf8").split("\n");
  const at = (re) => { const i = src.findIndex((l) => re.test(l));
    if (i < 0) throw new Error("terms-genre.freeze: anchor not found: " + re); return i; };
  const a0 = at(/^const synthOf = \(\) =>/), a1 = at(/^const wordAt = /);
  const b0 = at(/^const opsOf = /), bp = at(/^function phrase\(name\) \{/);
  let b1 = bp; while (src[b1] !== "}") b1++;            // the line that closes phrase()
  const body = src.slice(a0, a1 + 1).join("\n") + "\n" + src.slice(b0, b1 + 1).join("\n");

  const make = new Function("DOC", "GENRES", "MODES", "KEYS", "SWINGS", "METERS",
    "WORDS", "K", "NuSong", "SYNTH_NAMES",
    body + "\nreturn { genreFor, phrase };");
  const DOC = JSON.parse(JSON.stringify(Songs.TERMS));
  const { genreFor, phrase } = make(DOC, NG.GENRES, NG.MODES, NF.KEYS, NF.SWINGS,
    K.METERS, Songs.WORDS, K, NS, TE.SYNTH_NAMES);

  const out = { sections: [], phrases: {} };
  DOC.form.sections.forEach((s, i) => out.sections.push(portrait(genreFor(i), K)));
  for (const n of Object.keys(DOC.material.cells)) out.phrases[n] = phrase(n);
  process.stdout.write(JSON.stringify(out, null, 1) + "\n");
})();
