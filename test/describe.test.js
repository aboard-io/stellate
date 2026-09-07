#!/usr/bin/env node
/* test/describe.test.js — THE DESCRIPTION IS TRUE OF THE ROW.
 *
 * `tools/describe.js` exists so that 500 rows can be READ — and an audit run
 * off prose is worth exactly what the prose is worth. Four claims hold it:
 *
 *   §A  EVERY ROW ANSWERS. All 500 produce sentences; none throws, none is
 *       empty, none is a fragment. The catalogue is the fixture: a row added
 *       tomorrow is in this gate the moment it is in `_order.json`.
 *   §B  NO PLACEHOLDER AND NO RAW KEY. Not `undefined`, `null`, `NaN`,
 *       `[object Object]` or a `$src` escape; and not a registry id either —
 *       `clean_guitar` is a key, "clean guitar" is English. The one key that
 *       is allowed through on purpose is the row's own `near`, which names a
 *       sibling ROW and is the reader's handle on it.
 *   §C  A ROW THAT DECLARES X SAYS X. Fourteen facts, asserted over the whole
 *       catalogue rather than on one row apiece, because a description that
 *       is right about dub and silent about the other 499 is the failure this
 *       gate is for.
 *   §D  AND IT NEVER READS THE `note`. The file's own first law: the note is
 *       the row's ARGUMENT for itself, and an audit that reads it is circular.
 *       Held two ways — by source (no require of the row JSON) and by fact
 *       (a phrase that appears only in a note appears in no description).
 *
 * Node, no DOM, no audio.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const R = path.resolve(__dirname, "..");
const NG = require(R + "/nukernel/genres.js");
const NF = require(R + "/nukernel/fields.js");
const D  = require(R + "/tools/describe.js");
const { GENRES, FIGURES } = NG;

let pass = 0, fail = 0;
const ok = (name, fn) => {
  try { fn(); pass++; console.log("ok    " + name); }
  catch (e) { fail++; console.log("FAIL  " + name + "\n      " + e.message); }
};
const KEYS = Object.keys(GENRES);
const say = {};     // key -> description, computed once
const facts = {};

console.log("test/describe.test.js — the description is true of the row\n");

/* ---------------------------------------------------------------- §A ---- */

ok("§A1 all " + KEYS.length + " rows produce a description, and none throws", () => {
  const threw = [];
  for (const k of KEYS) {
    try { say[k] = D.describe(k); facts[k] = D.factsOf(k); }
    catch (e) { threw.push(k + ": " + e.message); }
  }
  assert.deepStrictEqual(threw, [], "threw:\n      " + threw.join("\n      "));
});

ok("§A2 every description is SENTENCES — eight or more, each ending in a stop", () => {
  const thin = [];
  for (const k of KEYS) {
    const s = say[k] || "";
    const n = (s.match(/\.\s|\.$/g) || []).length;
    if (n < 8) thin.push(k + " (" + n + " sentences)");
    if (!/\.$/.test(s.trim())) thin.push(k + " (unterminated)");
  }
  assert.deepStrictEqual(thin, [], thin.join(", "));
});

ok("§A3 every description is inside the reading budget (100–300 words)", () => {
  const out = [];
  for (const k of KEYS) {
    const w = (say[k] || "").split(/\s+/).filter(Boolean).length;
    if (w < 100 || w > 300) out.push(k + " " + w);
  }
  assert.deepStrictEqual(out, [], out.join(", "));
});

/* ---------------------------------------------------------------- §B ---- */

ok("§B1 no unresolved placeholder anywhere in 500 descriptions", () => {
  const bad = [];
  for (const k of KEYS) {
    const m = (say[k] || "").match(/undefined|NaN|\[object|\$src|\bnull\b/);
    if (m) bad.push(k + ": " + m[0]);
  }
  assert.deepStrictEqual(bad, [], bad.join(", "));
});

ok("§B2 no raw registry id — a key has an underscore or a colon, English does not", () => {
  const bad = [];
  for (const k of KEYS) {
    const s = say[k] || "";
    const u = s.match(/[A-Za-z]+_[A-Za-z_]+/g);
    const c = s.match(/\bfound:\S+/g);
    if (u) bad.push(k + ": " + u.join(" "));
    if (c) bad.push(k + ": " + c.join(" "));
  }
  assert.deepStrictEqual(bad, [], bad.join(", "));
});

ok("§B3 every vocabulary word printed is a LABEL, never the row's own key", () => {
  // The row speaks in keys (`stickside`, `crashback`, `bassin`, `d8`) and
  // every one of them has a display word. A key reaching the prose means a
  // table lookup missed, which is silent by construction — hence this gate.
  // Asked of the FACTS and not of the prose, because half the keys in these
  // tables ("soft", "four", "roll") are also ordinary English and a regex over
  // the sentences cannot tell the word from the key.
  const vals = (t) => new Set(Object.keys(t).map((k) => t[k]));
  const KIT = vals(NF.KITLABEL), IN = vals(NF.INLABEL), BASS = vals(NF.BASSOPS),
        FX = vals(NF.FXLABEL), ROLE = vals(NF.ROLES);
  const bad = [];
  for (const k of KEYS) {
    const f = facts[k];
    for (const w of f.kitMoves) if (!KIT.has(w)) bad.push(k + " kit:" + w);
    for (const w of f.fx) if (!FX.has(w)) bad.push(k + " fx:" + w);
    if (f.introWord && !IN.has(f.introWord)) bad.push(k + " intro:" + f.introWord);
    if (f.bassWord && !BASS.has(f.bassWord)) bad.push(k + " bass:" + f.bassWord);
    for (const s2 of f.sections)
      if (!NF.ROLES[s2.role]) bad.push(k + " role:" + s2.role);
  }
  assert.deepStrictEqual([...new Set(bad)].slice(0, 12), [], bad.join(", "));
});

/* ---------------------------------------------------------------- §C ---- */
/* A row that declares X says X — fourteen facts, over the whole catalogue.  */

const eachRow = (why, fn) => ok(why, () => {
  const bad = [];
  for (const k of KEYS) { const m = fn(GENRES[k], say[k], facts[k], k); if (m) bad.push(k + ": " + m); }
  assert.deepStrictEqual(bad.slice(0, 10), [], bad.length + " rows — " + bad.slice(0, 10).join("; "));
});

eachRow("§C1 the row's LABEL — its place and its year — is quoted verbatim",
  (G, s) => (s.includes(G.label) ? null : "label " + G.label + " missing"));

eachRow("§C2 the row's declared BPM is the number in the sentence",
  (G, s) => (new RegExp("\\b" + G.bpm + " BPM\\b").test(s) ? null : "bpm " + G.bpm));

eachRow("§C3 a row that names a DRUMKIT says which kit it is",
  (G, s) => (!G.drumkit ? null
    : s.includes(NF.DRUMKITS[G.drumkit] || G.drumkit) ? null : "kit " + G.drumkit));

eachRow("§C4 a `nobass` row says there is no bass, and no other row does",
  (G, s) => (!!G.nobass === /No bass at all/.test(s) ? null
    : (G.nobass ? "nobass unsaid" : "nobass claimed")));

eachRow("§C5 a row whose kit fires nothing says it writes no drum pattern",
  (G, s, f) => (!!f.kitLanes.length === !/No kit —/.test(s)
    ? null : "kit presence misstated"));

eachRow("§C6 an `instrumental` row says it has no singer",
  (G, s) => (!G.instrumental || /Instrumental — no singer/.test(s) ? null : "instrumental unsaid"));

eachRow("§C7 every `fx` chip the row buys is named in English",
  (G, s) => {
    const miss = (G.fx || []).filter((x) => !s.includes(NF.FXLABEL[x] || x));
    return miss.length ? "fx " + miss.join(",") : null;
  });

eachRow("§C8 the `dyn` figure's OWN sentence is the sentence printed",
  (G, s) => {
    const w = (FIGURES[G.dyn || "lean"] || {}).w;
    return w && s.includes(w) ? null : "figure " + (G.dyn || "lean");
  });

eachRow("§C9 a `cycle` row prints roman numerals; a modal one says the prog is dropped",
  (G, s, f) => {
    if (G.harmony === "cycle")
      return /harmony is cycle — a cycle of changes: \S/.test(s)
        && !/deg \d/.test(s) ? null : "no numerals";
    if (G.harmony === "emergent")
      return /no chord list is read at all/.test(s) ? null : "emergent unsaid";
    return /never read and every bar is the bare mode triad/.test(s)
      ? null : "modal drop unsaid";
  });

eachRow("§C10 a row that declares `cannot` says it refuses something",
  (G, s) => (!(G.cannot || []).length || /It refuses /.test(s) ? null : "refusal unsaid"));

eachRow("§C11 a `copyist` row names the part-writing pass it refuses",
  (G, s) => (!G.copyist || /part-writing pass/.test(s) ? null : "copyist unsaid"));

eachRow("§C12 a non-`normal` articulation is stated",
  (G, s) => (!G.artic || G.artic === "normal" || s.includes("Played " + G.artic)
    ? null : "artic " + G.artic));

eachRow("§C13 a row with a signature synth names the machine",
  (G, s) => (!G.synth || s.includes(String(G.synth.root || G.synth.dsp).replace(/_/g, "-"))
    ? null : "synth " + G.synth.dsp));

eachRow("§C14 the cast count in the prose is the record's own line-voice count",
  (G, s, f) => {
    if (!f.chairs.length) return null;
    const NUM = ["no", "one", "two", "three", "four", "five", "six", "seven",
                 "eight", "nine", "ten", "eleven", "twelve", "thirteen",
                 "fourteen", "fifteen", "sixteen"];
    const w = NUM[f.chairs.length] || String(f.chairs.length);
    const head = w[0].toUpperCase() + w.slice(1)
      + (f.chairs.length === 1 ? " chair:" : " chairs:");
    return s.includes(head) ? null : "cast " + f.chairs.length;
  });

eachRow("§C15 the rendered counts in the prose are the score's own",
  (G, s, f) => (!f.render ? null
    : s.includes("Renders " + f.render.line + " melodic notes, " + f.render.bass
        + " bass, " + f.render.hit + " hits over " + f.render.bars + " bars")
      ? null : "render counts"));

/* ---------------------------------------------------------------- §D ---- */

ok("§D1 the routine does not read a row's JSON — the `note` is not a source", () => {
  // COMMENTS OFF FIRST: this file's own header says the words "the row JSON"
  // and "note" out loud, which is the point of it, so the gate reads the CODE.
  const src = fs.readFileSync(R + "/tools/describe.js", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/genres\/[^"']*\.json|readFileSync\s*\([^)]*genres/.test(src),
    "describe.js reaches for the row JSON");
  assert.ok(!/\.note\b/.test(src), "describe.js reads a `note`");
});

ok("§D2 no description quotes a sentence that lives only in a note", () => {
  // Sampled rather than exhaustive: five rows whose notes carry a distinctive
  // phrase. If any of it appears in the prose the extraction has a second,
  // undeclared source.
  const dir = R + "/nukernel/genres";
  const bad = [];
  for (const k of ["dub", "gregorian", "techno", "bossa", "gospel"]) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, k + ".json"), "utf8"));
    const note = String(j.note || "");
    for (const line of note.split("\n")) {
      const t = line.trim();
      if (t.length > 30 && (say[k] || "").includes(t)) bad.push(k + ": " + t);
    }
  }
  assert.deepStrictEqual(bad, [], bad.join("; "));
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
