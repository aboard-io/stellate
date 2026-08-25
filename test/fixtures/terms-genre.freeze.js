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
