#!/usr/bin/env node
// test/table.test.js — THE TABLE, WAVE 1: THE MODEL (nukernel/TABLE.md §8).
//
// Paul, 2026-09-03: "a song can be understood as a grid with sections as rows
// and instruments as columns … Each cell can be understood as a vector … The
// producer becomes basically a vector manipulator across the table."
//
// Wave 1 builds the MODEL and changes nothing a hand can see. Three gates,
// and TABLE.md §7 wrote all three before a line of it existed:
//
//   T1 SHAPE       a saved record round-trips through the model byte-
//                  identically, and every field of §1 is reachable from
//                  exactly one tier. The tier table is DATA — `document.js
//                  TIERS` — so this gate reads the claim instead of restating
//                  it, and the places §1 turned out to be wrong about the
//                  shipped document are recorded there as `note`s that this
//                  gate PRINTS. The spec is corrected by measurement.
//   T2 INHERIT     nothing changes until a hand does. Every anchor at seeds
//                  1-3, rendered through the new resolver, against a worktree
//                  of the commit before this wave: the document byte for byte
//                  (bar the one key the wave adds), every section's compiled
//                  GENRE portrait — which is where `entry` and `reg` actually
//                  live, as closures — and the kernel's own EVENTS on a
//                  sample. Then the same walk with an override written, which
//                  MUST move the sound: the declared-but-never-arriving law
//                  says a field nobody can measure is a field that is not
//                  there.
//   T3 PROVENANCE  every motif in every bank carries one of `own`,
//                  `guest:<genre>`, `hand`; a guest's genre exists and is not
//                  younger than its host (compose.js eraOK's own rule); and
//                  the hand's two doors both arrive.
//
// WAVE 2a (2026-09-04) ADDS T4, AND MOVES T2's BASELINE (v264, then v265). This is the
// first wave whose job is to MOVE THE SOUND: `genreToDocument`'s section
// projection was dropping nine fields the composer deals — intro, outro, mot,
// mode, prog, key, fx, rev, echo — and carrying them is the point. So T2 now
// compares against v264 with THIS WAVE'S ROW FIELDS STRIPPED BACK OFF (an
// unintended change is still caught; a deliberate one is not mistaken for
// one), and T4 measures the deliberate one.
//
//   T4 THE SOUND    read off the RENDERED path and not off `scoreOf`, which
//                  has zero references to intro/outro/mot and is structurally
//                  blind to the carry. The stub-window recipe from
//                  nukernel/desk-gate.js stands the data tier up and imports
//                  the real ui/derive.js (`edges` replaces the first and last
//                  bars), audio/desk.js (`compileAuto` turns `mot` into the
//                  section's lanes; `deskUnits` finishes the chain) and
//                  audio/plan.js (PACE_RATE at the clock). Nine gates, one
//                  per claim the wave makes, each of them also asserting that
//                  the override reaches NO OTHER SECTION.
//
// TEST THE ARTIFACT. T2's identity is taken off the RENDER — the genre a
// section compiles to and the events the kernel emits from it — and never off
// the document alone, because three features have shipped broken in this repo
// while every structural check passed.
//
// PURE NODE. No DOM, no audio, no browser.
"use strict";
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const cp = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const N = (p) => require(path.join(ROOT, "nukernel", p));
const D = N("document.js"), P = N("precompose.js"), NG = N("genres.js");
const NI = N("instruments.js"), K = N("kernel.js"), NK = N("knobs.js");
// the ONE owner of what a THROAT word may be (T4o asks it), and of every other
// vocabulary this gate's doors are held to
const NF = N("fields.js");
const NC = N("compose.js"), Songs = N("songs.js");
const { GENRES } = NG;

let pass = 0, fail = 0;
/* `--only=<text>` RUNS THE GATES WHOSE NAME CONTAINS IT (2026-09-05). T2 walks
   479 anchors through TWO trees and takes minutes; a round that is writing one
   new claim should be able to read that claim back in seconds. It skips the
   BODIES only — the base worktree still stands up, so a run with `--only` can
   never pass by not building — and a full run says nothing about it. */
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);
let skipped = 0;
const ok = (name, fn) => {
  if (ONLY && !name.includes(ONLY)) { skipped++; return; }
  try { fn(); pass++; console.log("  ok   " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); }
};
const J = (x) => JSON.parse(JSON.stringify(x));
const ANCHORS = P.anchors();
const SEEDS = [1, 2, 3];
const FULL = process.argv.includes("--full");

/* THE BASELINE, PINNED — AND MOVED ON PURPOSE (2026-09-04, wave 2a).
   It read `c6b6208` (v263, the commit that shipped TABLE.md itself and not a
   line of its model) under the rule "a future wave that legitimately changes
   the sound moves this sha and says why in the same edit". This is that wave
   and this is that edit.

   WHY IT MOVES: wave 2a is the first wave whose whole job is to MOVE THE
   SOUND. `genreToDocument`'s section projection was dropping nine fields the
   composer deals — `intro` `outro` `mot` `mode` `prog` `key` `fx` `rev`
   `echo` — and carrying them is the point, so an identity gate against v263
   would fail for the reason the wave exists and prove nothing about anything
   else. The sha is now v264, the commit before this one.

   WHAT THE GATE STILL PROVES, which is the part worth having: every anchor at
   seeds 1-3 with THIS WAVE'S ROW FIELDS STRIPPED BACK OFF is byte-identical to
   v264 — the document, every section's compiled genre with its closures
   called, and the kernel's own events. So an unintended change is still caught
   against v264 for everything except the fields this wave deliberately
   carries, which is exactly the claim the wave is allowed to make. */
/* BASE MOVED 2026-09-04 to e4d44dd (v265): wave 2a carried intro/outro/mot
   and the row fields on purpose (T4 gates that sound), and the singer round
   changed three rows' mouths (girlgroup, nuevacancion, doowop) on purpose —
   T2b read those three sections against v264 and was right to. Everything
   else must still be byte-identical to THIS base until a hand writes. */
/* BASE MOVED AGAIN 2026-09-05, to 04d06e4 (v278), AND THE REASON IS A NAME
   RATHER THAN A NOTE — which is the first time that has been true, so it is
   worth saying exactly what moved.

   `7cf0d37` (the text pass: one catalogue of 878 keys) reworded two entries in
   `nukernel/ideas-kit.js` — `ext.w` "one more time on the way out" -> "one
   more on the way out", and `arpturn.w` "turns through the chord to the ninth"
   -> "turns up to the ninth". Those words are not decoration: a motif's word
   IS its name, `precompose` names the cell with it, and the name is the KEY in
   `material.cells` and `material.prov` and the string a voice's `material`
   points at. So a shorter sentence renames a cell in every record that deals
   that idea.

   MEASURED, before the base moved (the sweep is in the round's scratch, and
   anyone can redo it against ee8366d):
     · 564 of 1437 documents differ from ee8366d;
     · 0 of those differences are anything but those two strings — no deg, no
       play, no vel, no cast, no section field;
     · and all 564 are byte-identical to the base once the two words are
       renamed back, which is the whole claim in one line.
   The fingerprints agree with it: `material.prov.<name>.fp` is unchanged under
   the new key, so the box knows it is the same tune with a shorter name.

   WHY THAT IS ALLOWED. [[verification-philosophy]]: byte-stability is a tool,
   not a law, and fixture drift is acceptable when the round that caused it is
   the round that was shipped. A rename of the composer's own vocabulary is
   what the text pass was FOR, T2c re-rendered the events and they did not
   move, and holding the old base would only mean asserting that no idea may
   ever be renamed again. */
/* BASE MOVED AGAIN 2026-09-05, to 5672e84 (v284), FOR THE SAME KIND OF REASON
   AS THE LAST TWO: the CATALOGUE moved on purpose between v278 and v284 and the
   base was still v278, so T2a/T2b were reporting the rounds that shipped.

   MEASURED against 04d06e4 before the base moved:
     · T2a: 18 of 1437 documents differ — viennadownbeat, chillout, versailles;
     · T2b: 24 of 180 rendered sections compile to a different genre —
       politicalhiphop, northernsoul, viennadownbeat;
   and every one of those five anchors is a file this window edited on purpose:
   `0669383` ("the swings that never reached a kit") and `bce7b13` ("two rows
   that named a drummer and gave him nothing to play") rewrote
   nukernel/genres/{viennadownbeat,chillout,versailles,politicalhiphop,
   northernsoul}.json — `git diff --name-only 04d06e4..5672e84 -- nukernel/
   genres/` names all five. A row that gained a kit is a sound moved on purpose,
   gated in its own round, and the same [[verification-philosophy]] sentence the
   move to 04d06e4 leaned on applies: byte-stability is a tool, not a law, and
   holding a base older than the catalogue only asserts that no row may ever
   gain a drummer. The strip set below is asked of the base, so it re-derives
   itself; T4j renders both sides and is base-aware already. */
/* BASE MOVED AGAIN 2026-09-06, to 0178335 (v289), FOR THE DYNAMICS FLOOD —
   SHIFT 1 (docs/DYNAMICS-FLOOD.md, "THE MOTIF'S OWN DYNAMICS"). This is the
   largest deliberate catalogue move the base has ever absorbed and it is worth
   saying exactly what it is.

   THE CENSUS (scratchpad/census-dynamics-chords/REPORT.md, 2026-09-05)
   measured the motif tier of all 479 composed records: the WHOLE dynamic
   alphabet of 3,991 line cells was {5, 6, 8} — one hard-coded line in
   `ideas-kit.js` — and 2,651 of 2,672 accents fell on a barline, one
   hard-coded line in `precompose.js`. A funk record and a chant played the
   same figure. Both lines are a NAMED FIGURE now (`genres-tables.js` FIGURES,
   nine of them) and 416 rows quote one in `dyn`.

   MEASURED, on the same 3,991 cells, before the base moved:
     · the velocity alphabet went from {5, 6, 8} to {4, 5, 6, 7, 8, 9};
     · accents off the downbeat went from 21 to 7,001 of 9,384, and the cells
       carrying one at all from 2,672 of 3,991 to 3,450;
     · 416 rows name a figure, and 409 of 479 anchors compile to a different
       document — 1,227 of the 1,437 T2a itself walks. The 70 anchors that do
       not move are exactly the 14 frozen `DYNAMICS: null` machines plus the
       56 rows whose figure IS the old line;
     · with no `dyn` written anywhere, all 479 were byte-identical — the seam
       was fingerprinted before the data was (test/dynfigure.test.js §C2 keeps
       that claim runnable).

   WHY THAT IS ALLOWED, and it is the same sentence the last three moves
   leaned on: [[verification-philosophy]] — byte-stability is a tool, not a
   law, and fixture drift is acceptable when the round that caused it is the
   round that was shipped. Holding a base older than the flood would only
   assert that no genre may ever have its own dynamics.

   AND THE PIN IS ONE COMMIT BEHIND, which on this one round it has to be:
   0178335 is the commit immediately BEFORE this shift, so T2a/T2b/T2c report
   the flood ITSELF — every anchor that gained a figure — until the shift lands
   and the pin moves onto its own commit. That is the one state this comment
   cannot resolve on its own, and it is written down rather than papered over:
   the three reds are expected here, they are this round, and the reviewer's
   job is to check the counts above against the run, not to look for a fourth
   cause. */
const BASE_SHA = "b908c18";  // genre QA shift 5, ON ITS OWN COMMIT (2026-09-06): salsa's bass figure, soft rock's chorus and city, the flanger's amount, Door 5 (an amplifier is never dealt — 284 dealt dirty chairs to 0), and grunge's tempo, singer and bass. 629 of 1446 documents over 251 anchors moved, and every one is a sound Paul asked to change. Was 1c5e8db — the dynamics flood, shift 1: 416 rows gained a `dyn` figure and 409 anchors took it (2026-09-06). The pin was written during the round and could only name v289, so T2a-c reported the flood itself until the round landed; it names the flood`s own commit now and the three are green again. Was 0178335 (v289); was 4bab683 — scoreOf windows a section (T2c moves with it, as §12c predicted). Was 5672e84 (v284) 2026-09-05. Was 04d06e4 (v278) 2026-09-05; Was ee8366d 2026-09-05 (chord durations, kit re-seating on the meter, glyph cells — every one a sound moved on purpose and gated in its own round); the text pass renamed two ideas and 564 documents took the new name
/* WHAT MAY BE STRIPPED IS A QUESTION ABOUT THE BASE, AND IT IS ASKED, NOT
   TYPED (2026-09-04). The list below is every ROW field any wave has ever
   carried onto a section — wave 2a's nine plus the two the row may override
   with nothing carried into them (swing, groove) — and stripping it from a
   head document used to be unconditional. That was right against v264, which
   carried none of them, and WRONG the moment the base moved to e4d44dd, which
   carries all of them: the gate then compared a stripped head against an
   unstripped base and reported three failures that were the strip's own.
     SO THE STRIP SET IS DERIVED FROM THE PINNED BASE. `stripSetFor` composes
   the BASE's own catalogue and keeps only the fields the base never writes —
   "strip what this base cannot have said, and nothing else". With base
   e4d44dd that set is EMPTY and the head must equal the base byte for byte;
   with a base predating a wave it is exactly that wave's fields, which is what
   the paragraph above always meant. One rule, no sha-keyed table to update the
   next time the base moves. */
const ROW_FIELDS_ANY_WAVE =
  ["intro", "outro", "mot", "mode", "prog", "key",
   "fx", "rev", "echo", "swing", "groove", "room", "dtime", "pan"];
function stripSetFor(base) {
  const seen = new Set();
  for (const gk of ANCHORS) {
    let d; try { d = base.D.normalize(base.P.genreToDocument(gk, 1)); } catch (e) { continue; }
    for (const s of d.form.sections)
      for (const f of ROW_FIELDS_ANY_WAVE) if (s[f] != null) seen.add(f);
  }
  return ROW_FIELDS_ANY_WAVE.filter((f) => !seen.has(f));
}
let STRIP = ROW_FIELDS_ANY_WAVE;               // replaced once the base loads
const stripRows = (doc) => {
  for (const s of doc.form.sections) for (const f of STRIP) delete s[f];
  return doc;
};

/* ...AND THE ONE FIELD THIS ROUND MOVES ON PURPOSE (2026-09-04, the singer
   round). `precompose.js` §7d seats a SUNG chair at the register its throat
   actually sings — the fold `audio/plan.js` was applying after the fact,
   written down where the staff, the piano roll and the notated .mid can read
   it. So `voices[i].cast.reg` differs from the base on 1,354 of 2,459 sung
   chairs and every reader of the WRITTEN line differs with it, by a whole
   number of octaves, by design.
     T2 therefore masks `cast.reg` on the chairs a person sings — and ONLY on
   those — and T4j below holds the whole claim in its place: the written line
   moved by exact octaves, the sung line did not move at all, and the fold that
   was moving it is gone. Masking without T4j would be a hole; T4j is a
   stronger statement than the byte identity it replaces, because it is taken
   off the notes rather than off the field. */
const SUNG = (v) => v.kind === "line" && !!(NI.PATCHES.voice || {})[v.instrument];
const maskSungReg = (doc) => {
  for (const v of doc.voices) if (SUNG(v) && v.cast) v.cast.reg = "sung";
  return doc;
};

/* ...AND THE FIELD THE NEXT ROUND MOVES ON PURPOSE (2026-09-04, the per-CHAIR
   singer round). A chair may now name its own throat — `cast.voice`,
   `document.js TIERS.voice`, written from the row's `throat` closure — and
   fifteen rows in the catalogue state one. On those rows the throat changes,
   so `precompose` §7d seats the chair against a DIFFERENT compass, so
   `cast.reg` moves and so does the written line. THE SOUND MOVES: a bass
   singer sings bass now, which is the whole of what the round is for.

   THE EXCLUSION IS DERIVED FROM THE BASE, NOT TYPED — the same rule
   `stripSetFor` above keeps, and for the same reason. `voiceStrip` deletes
   `cast.voice` from a head chair ONLY where the pinned base's own document has
   none there, so a field the base never carried cannot fail an identity gate
   for existing, and a field the base DID carry is still compared. Since no
   base before this round carries one at all, the set it strips is exactly the
   chairs this round writes — "changed rows only", asked rather than listed.

   WHAT IS LEFT UNMASKED, said out loud so the hole is a shape and not a gap:
   `cast.reg` on those chairs is already masked for every sung chair (above),
   and T2c already CUTS the sung lanes out of the event comparison. So T2 says
   nothing at all about where a singer is written — it never did after §7d —
   and T4j and the new T4o are what hold it: T4j that no sung chair is written
   outside its compass, T4o that each of the fifteen rows seats the throats and
   the registers it says it does, chair by chair, at three seeds. */
const voiceStrip = (mine, theirs) => {
  for (let i = 0; i < mine.voices.length; i++) {
    const a2 = mine.voices[i], b2 = theirs.voices[i];
    if (a2 && a2.cast && a2.cast.voice != null &&
        !(b2 && b2.cast && b2.cast.voice != null)) delete a2.cast.voice;
  }
  return mine;
};
/* WHICH ROWS THIS ROUND ACTUALLY MOVED, measured off the CATALOGUE and not off
   a list in this file: a row whose `throat` closure answers for any chair it
   seats. T2b uses it to mask the one thing a throat changes in a compiled
   genre — the chairs seam and the chair's own register — and T4o pins it. */
const VOICEROWS = ANCHORS.filter((gk) => typeof (GENRES[gk] || {}).throat === "function");
const WT = path.join("/tmp", "nu-table-base-" + BASE_SHA);
function baseTree() {
  if (!fs.existsSync(path.join(WT, "nukernel", "document.js"))) {
    cp.execFileSync("git", ["worktree", "add", "--detach", WT, BASE_SHA],
                    { cwd: ROOT, stdio: "pipe" });
  }
  const B = (p) => require(path.join(WT, "nukernel", p));
  return { D: B("document.js"), P: B("precompose.js"), GENRES: B("genres.js").GENRES,
           // T4j renders BOTH sides, each through its own kernel and its own
           // instrument table: the claim is about two records, not about one
           // record read twice.
           K: B("kernel.js"), NI: B("instruments.js") };
}

console.log("test/table.test.js — TABLE.md wave 1: the model\n");

/* ======================================================================
   T1 · SHAPE
   ====================================================================== */
console.log("T1 — shape: one tier per field, and the record round-trips\n");

/* T1a — THE TIER TABLE IS DATA AND IT IS COMPLETE. Every field names exactly
   one tier out of the four the law knows, and it either has an ADDRESS in the
   document today or names the WAVE that will give it one. A field that is
   neither is a control the table would draw with nothing under it — §4's
   refused-control law ("no silent grey") applied to the model. */
ok("T1a every field names exactly one tier, and one address or one wave", () => {
  const TIERS = D.TIERS, keys = Object.keys(TIERS);
  assert.ok(keys.length >= 40, "the tier table lost its rows: " + keys.length);
  const legal = { row: 1, column: 1, cell: 1, record: 1 };
  for (const k of keys) {
    const t = TIERS[k];
    assert.ok(legal[t.tier], k + ": tier " + t.tier + " is not one of §2's four");
    assert.ok(!!t.at !== !!t.wave,
      k + ": must have an address OR a wave, not both and not neither");
    if (t.wave) assert.ok(t.wave >= 2 && t.wave <= 4, k + ": wave " + t.wave);
  }
});

/* T1b — AND EVERY ADDRESS IS REACHABLE, in the only sense a path can be:
   a value written there is read back by `addressOf`. Two ways to satisfy it,
   and the difference between them is a MEASUREMENT this gate prints rather
   than an assertion it makes — a field the composer states on some record is
   reachable AND dealt; a field only a hand can put there is reachable and
   NEVER DEALT, which is a real finding and not a failure (six of the section's
   own fields turn out to be in that state: compose draws them and precompose's
   section projection does not carry them, which is the same bug precompose's
   own `lvl`/`env` comment records having fixed in 2026-08-28). */
ok("T1b every declared address is reachable, and the census says which are dealt", () => {
  const stated = new Set(), addressed = Object.keys(D.TIERS).filter((k) => D.TIERS[k].at);
  for (const gk of ANCHORS) {
    const d = D.normalize(P.genreToDocument(gk, 1));
    for (const k of addressed) {
      if (stated.has(k)) continue;
      for (let si = 0; si < d.form.sections.length && !stated.has(k); si++)
        for (let vi = 0; vi < d.voices.length; vi++)
          if (D.addressOf(d, si, vi, k) !== undefined) { stated.add(k); break; }
    }
  }
  // ...and the ones no anchor deals are PROVED reachable by putting a value
  // there and reading it back through the same path.
  const probe = D.normalize(P.genreToDocument("reggae", 2));
  const setAt = (doc, si, vi, field, val) => {
    const T = D.TIERS[field], secId = doc.form.sections[si].id;
    const steps = T.at.split("."), keys = [];
    for (const st of steps) {
      const m = /^([A-Za-z]+)((?:\[[^\]]+\])*)$/.exec(st);
      keys.push(m[1]);
      for (const k of (m[2].match(/\[[^\]]+\]/g) || [])) {
        const key = k.slice(1, -1);
        keys.push(key === "si" ? si : key === "vi" ? vi : key === "secId" ? secId : key);
      }
    }
    let node = doc;
    for (let i = 0; i < keys.length - 1; i++) {
      if (node[keys[i]] == null) node[keys[i]] = {};
      node = node[keys[i]];
    }
    node[keys[keys.length - 1]] = val;
  };
  const dead = [], neverDealt = [];
  for (const k of addressed) {
    if (stated.has(k)) continue;
    neverDealt.push(k);
    setAt(probe, 1, 0, k, "\u0000probe");
    if (D.addressOf(probe, 1, 0, k) !== "\u0000probe") dead.push(k + " @ " + D.TIERS[k].at);
  }
  console.log("       dealt by the composer on some anchor: " + stated.size + " of " +
              addressed.length + "; never dealt: " + neverDealt.join(" "));
  assert.deepStrictEqual(dead, [], "declared and unreachable: " + dead.join(", "));
});

/* T1c — THE THREE CELL FIELDS ANSWER FROM THE TIER THEY SAY THEY DO, and the
   answer MOVES when a cell is written and comes back when it is cleared. This
   is §2's whole law in one assertion: `cell -> column -> row -> record ->
   genre`, first found wins, and "deleting a written value returns the cell to
   what it inherits". */
ok("T1c a written cell wins, a cleared cell inherits again", () => {
  const d = D.normalize(P.genreToDocument("reggae", 2));
  const vi = d.voices.findIndex((v) => v.kind === "line");
  const before = D.resolveFrom(d, 1, vi, "reg");
  assert.strictEqual(before.from, "column", "reg does not default from the column");
  assert.strictEqual(before.v, d.voices[vi].cast.reg);
  assert.strictEqual(D.putCell(d, 1, vi, "reg", -3), true);
  const after = D.resolveFrom(d, 1, vi, "reg");
  assert.strictEqual(after.from, "cell");
  assert.strictEqual(after.v, -3);
  // ...and ONLY in that cell: the column's other sections are untouched.
  assert.strictEqual(D.resolveFrom(d, 0, vi, "reg").from, "column");
  assert.strictEqual(D.putCell(d, 1, vi, "reg", null), true);
  assert.deepStrictEqual(D.resolveFrom(d, 1, vi, "reg"), before);
  // THE SPARSE LAW: the shell deletes itself, so "inherited" has one spelling.
  assert.ok(!("cells" in d.voices[vi]), "an emptied override map survived");
});

/* T1d — ...AND THE GENRE IS THE LAST TIER, not a hole. A voice with no cast at
   all falls all the way through to the anchor's own closures, which is what
   §2's fifth tier means and what a column op will lean on when it adds a chair
   with nothing said about it yet. */
ok("T1d a chair with no cast resolves off the genre's own row", () => {
  const d = D.normalize(P.genreToDocument("reggae", 2));
  const vi = d.voices.findIndex((v) => v.kind === "line");
  delete d.voices[vi].cast.reg; delete d.voices[vi].cast.entry;
  const r = D.resolveFrom(d, 0, vi, "reg"), e = D.resolveFrom(d, 0, vi, "entry");
  assert.strictEqual(r.from, "genre", "reg fell through to nothing");
  assert.strictEqual(e.from, "genre", "entry fell through to nothing");
  assert.ok(Number.isFinite(r.v) && Number.isFinite(e.v), "the genre answered NaN");
});

/* T1e — THE RECORD ROUND-TRIPS BYTE-IDENTICALLY through JSON and the door.
   The eight-axes document is not what localStorage holds (the store keeps
   phrases, boxes and session genres) but it IS what a share link replays, what
   `gates-extract.js` freezes and what every node caller hands around, so
   "saved" here means the whole trip: stringify, parse, normalize. A field the
   door drops or rewrites shows up as a diff. */
ok("T1e every anchor's record survives JSON + normalize byte-identically", () => {
  const bad = [];
  for (const gk of ANCHORS) {
    for (const s of SEEDS) {
      const d = D.normalize(P.genreToDocument(gk, s));
      const a = JSON.stringify(d);
      const b = JSON.stringify(D.normalize(JSON.parse(a)));
      if (a !== b) bad.push(gk + "/" + s);
    }
  }
  assert.deepStrictEqual(bad.slice(0, 8), [], bad.length + " records moved at the door");
});
ok("T1f the shipped chant round-trips, and normalize is still a no-op on it", () => {
  const T = J(Songs.TERMS), before = JSON.stringify(T);
  D.normalize(T);
  assert.strictEqual(JSON.stringify(T), before, "normalize moved the chant");
  assert.strictEqual(JSON.stringify(D.normalize(JSON.parse(before))), before);
  // ABSENT IS OWN: a hand-authored document carries no provenance map at all.
  assert.ok(!(T.material.prov), "the chant grew a provenance map");
  for (const n of Object.keys(T.material.cells))
    assert.strictEqual(D.provOf(T, n).p, "own", n + " is not own on a record with no map");
});

/* T1g — A CELL OVERRIDE SURVIVES THE DOOR, and a wrong one does not. Same
   paranoia song.js applies to every enum: a register from a build with a
   different range is a lie the kernel would play. */
ok("T1g the door keeps a legal override and drops an illegal one", () => {
  const d = D.normalize(P.genreToDocument("reggae", 2));
  const vi = d.voices.findIndex((v) => v.kind === "line");
  const id = d.form.sections[1].id;
  D.putCell(d, 1, vi, "reg", -2); D.putCell(d, 1, vi, "entry", 3);
  D.putCell(d, 1, vi, "focus", true);
  const kept = JSON.stringify(D.normalize(J(d)).voices[vi].cells);
  assert.strictEqual(kept, JSON.stringify({ [id]: { reg: -2, entry: 3, focus: true } }));
  /* `entry: -1` WAS THE ILLEGAL ONE HERE AND IS LEGAL NOW (2026-09-05, the
     review's item 9): a negative entry is a PICKUP, down to one bar, and the
     lead-in channel carries it. The illegal value is a chair that would enter
     more than a bar before its section, which is a chair in the previous
     section and not an anacrusis. */
  const pu = J(d);
  D.putCell(pu, 1, vi, "entry", -0.25);
  assert.strictEqual(D.normalize(pu).voices[vi].cells[id].entry, -0.25,
    "a quarter-bar pickup must survive the door");
  const bad = J(d);
  bad.voices[vi].cells[id] = { reg: 99, entry: -2, focus: "yes", nosuch: 1 };
  bad.voices[vi].cells.deadsection = { reg: 0 };
  D.normalize(bad);
  assert.ok(!("cells" in bad.voices[vi]), "the door kept garbage: " +
    JSON.stringify(bad.voices[vi].cells));
});

/* ======================================================================
   T2 · INHERIT — nothing changes until a hand does
   ====================================================================== */
console.log("\nT2 — inherit: the table changes nothing until a hand does\n");

const B = (() => { try { return baseTree(); } catch (e) {
  console.log("  FAIL T2 could not build the baseline worktree at " + BASE_SHA +
              "\n       " + e.message); fail++; return null; } })();
if (B) {
  STRIP = stripSetFor(B);
  console.log("  strip rule: base " + BASE_SHA + " writes " +
              (ROW_FIELDS_ANY_WAVE.length - STRIP.length) + " of " +
              ROW_FIELDS_ANY_WAVE.length + " row fields, so the head is stripped of " +
              (STRIP.length ? STRIP.join(" ") : "NOTHING — it must equal the base byte for byte"));
  console.log("  masked: cast.reg on the chairs a person sings (§7d seats them by throat; T4j holds it)\n");
}

/* THE PORTRAIT. A compiled genre carries four closures and a monotonic `__v`,
   neither of which survives JSON — the same problem `test/fixtures/
   terms-genre.freeze.js` solved for the extraction gate, solved the same way:
   CALL them, for every voice, and freeze the answers. `entry` and `reg` are
   exactly the two this wave rewrote, so they are the two that matter most. */
const portrait = (g, nv, sung, voiced) => {
  const o = {};
  for (const k of Object.keys(g)) {
    if (k === "__v" || typeof g[k] === "function") continue;
    o[k] = g[k];
  }
  /* THE CHAIRS SEAM CARRIES A THROAT NOW (2026-09-04) and on the fifteen rows
     that name one it is the field this round adds on purpose. Masked WHOLE
     rather than key by key, because a chair that gained a throat also gained
     the register that throat implies, and half a mask would report the second
     as an unexplained change. Only on those rows — `voiced` is the derived set
     — so every other record's chairs are compared to the byte. */
  if (voiced && Array.isArray(o.chairs)) o.chairs = "voiced";
  o.__closures = [];
  for (let v = 0; v < nv; v++) o.__closures.push({
    entry: g.entry ? g.entry(v) : null,
    // `reg` on a SUNG chair is the field §7d moves on purpose (see maskSungReg)
    reg:   (sung && sung.has(v)) ? "sung" : (g.reg ? g.reg(v) : null),
    part:  g.part  ? g.part(v)  : null,
    realize: g.realize ? g.realize(v) : null,
    word:  g.word  ? g.word(v).length : null,
  });
  return JSON.stringify(o);
};

/* THE ROWS THE BASE HAS TOO, AND ONLY THOSE (2026-09-06, the three starting
   points). T2a-c walk `ANCHORS` — this tree's catalogue — through BOTH trees,
   which was exact for as long as every round that added a row also moved
   BASE_SHA. A round that only ADDS rows must not: nothing existing moved, so
   the pin is still the right pin, and re-pinning it would quietly re-baseline
   478 records that nobody re-argued. What it must do instead is not ask the
   base a question the base cannot answer — `B.P.genreToDocument("dance", 1)`
   in a tree with no `dance` row is not a difference, it is a throw.

   SO THE COMPARISON IS THE INTERSECTION, said out loud on the artifact: the
   count and the names of the rows this run could NOT compare are printed, so
   "T2 is green" can never quietly mean "T2 compared nothing". A row that is
   new here is held instead by the gates that ask what it IS —
   test/document.test.js G16/G16b compile all three and read the notes back —
   and by the next round that moves this pin for its own reasons, when they
   join the identity like every other row. */
const BASEHAS = B ? ANCHORS.filter((gk) => !!B.GENRES[gk]) : ANCHORS;
if (B && BASEHAS.length !== ANCHORS.length) {
  const added = ANCHORS.filter((gk) => !B.GENRES[gk]);
  console.log("  T2 compares " + BASEHAS.length + " of " + ANCHORS.length +
              " anchors: " + added.length + " row(s) do not exist at " + BASE_SHA +
              " and cannot have moved — " + added.join(" "));
}

if (B) {
  ok("T2a every anchor's DOCUMENT is the pinned base's, once the base's own strip set is applied", () => {
    const bad = [];
    for (const gk of BASEHAS) for (const s of SEEDS) {
      const mine = maskSungReg(stripRows(D.normalize(P.genreToDocument(gk, s))));
      assert.ok(mine.material.prov, gk + "/" + s + ": no provenance map was stamped");
      // ...AND THE MAP IS COMPARED NOW, not deleted. Wave 1 deleted it here
      // because the baseline predated it; v264 stamps the same map, so the
      // provenance is part of the identity this gate holds rather than a hole
      // in it — a wave that moved a fingerprint would be caught.
      const theirs = maskSungReg(B.D.normalize(B.P.genreToDocument(gk, s)));
      voiceStrip(mine, theirs);
      if (JSON.stringify(mine) !== JSON.stringify(theirs)) bad.push(gk + "/" + s);
    }
    assert.deepStrictEqual(bad.slice(0, 8), [],
      bad.length + " of " + (BASEHAS.length * SEEDS.length) + " documents moved");
  });

  ok("T2b every section's compiled GENRE is the base's, closures and all, once stripped", () => {
    const bad = [];
    for (const gk of BASEHAS) for (const s of SEEDS) {
      const mine = stripRows(D.normalize(P.genreToDocument(gk, s)));
      const theirs = B.D.normalize(B.P.genreToDocument(gk, s));
      const ml = mine.voices.filter((v) => v.kind === "line");
      const nv = ml.length;
      const sung = new Set(ml.map((v, i) => (SUNG(v) ? i : -1)).filter((i) => i >= 0));
      const voiced = VOICEROWS.includes(gk);
      for (let i = 0; i < mine.form.sections.length; i++) {
        const a = portrait(D.toGenre(mine, i, GENRES), nv, sung, voiced);
        const b = portrait(B.D.toGenre(theirs, i, B.GENRES), nv, sung, voiced);
        if (a !== b) { bad.push(gk + "/" + s + "#" + i); break; }
      }
    }
    assert.deepStrictEqual(bad.slice(0, 8), [],
      bad.length + " sections compile to a different genre");
  });

  /* T2c — AND THE KERNEL'S OWN EVENTS. The portrait proves the table the
     kernel is handed; this proves what it plays. Every anchor under `--full`;
     otherwise a SAMPLE that is not arbitrary — every record carrying a guest
     motif (the only records this wave writes anything unusual on) plus an even
     stride across the catalogue. */
  ok("T2c the rendered EVENTS are the base's once stripped (the sung lanes are T4j's)", () => {
    const withGuest = BASEHAS.filter((gk) => {
      try {
        const d = D.normalize(P.genreToDocument(gk, 1));
        return Object.keys(d.material.cells)
          .some((n) => D.provOf(d, n).p === "guest");
      } catch (e) { return false; }
    });
    const stride = Math.max(1, Math.round(BASEHAS.length / 45));
    const sample = FULL ? BASEHAS
      : [...new Set([...withGuest, ...BASEHAS.filter((_, i) => i % stride === 0)])];
    const bad = [];
    for (const gk of sample) for (const s of SEEDS) {
      const md = stripRows(D.normalize(P.genreToDocument(gk, s)));
      const td = B.D.normalize(B.P.genreToDocument(gk, s));
      // THE SUNG LANES ARE NOT COMPARED HERE — they are compared in T4j, on the
      // notes rather than on the bytes, because their WRITTEN octave is the one
      // thing this round moves. `lv` is the kernel's voice index and the
      // document's line chairs are dealt round it, so the chair is `lv % nP`.
      const ml = md.voices.filter((v) => v.kind === "line"), nP = ml.length;
      const sung = new Set(ml.map((v, i) => (SUNG(v) ? i : -1)).filter((i) => i >= 0));
      const cut = (sc) => JSON.stringify(sc.events.filter(
        (e) => !(e.kind === "line" && sung.has(e.lv % nP))));
      const mine = cut(D.scoreOf(md, GENRES));
      const theirs = cut(B.D.scoreOf(td, B.GENRES));
      if (mine !== theirs) bad.push(gk + "/" + s);
    }
    console.log("       (" + sample.length + " anchors x " + SEEDS.length +
                " seeds rendered" + (FULL ? ", --full" : ", --full for all " +
                BASEHAS.length) + ")");
    assert.deepStrictEqual(bad.slice(0, 8), [], bad.length + " records render differently");
  });

  /* T2d — ...AND A HAND DOES CHANGE IT. The other half of the law, and the one
     the declared-but-never-arriving memo demands: a cell override that reaches
     no sound is a field that is not there. Both are read off the EVENTS. */
  ok("T2d an entry override delays the first note, a reg override moves the pitch", () => {
    const d = D.normalize(P.genreToDocument("reggae", 2));
    const lines = d.voices.map((v, i) => [v, i]).filter(([v]) => v.kind === "line");
    // a section long enough for an entry to be audible inside it
    const si = d.form.sections.findIndex((s) => s.bars >= 3);
    assert.ok(si >= 0, "no section of three bars to test an entry in");
    const [voice, vi] = lines[0];
    const lv = 0;                                    // the kernel index of lines[0]
    /* THE ENTRY IS ONE CELL, NOT TWO, AND THAT IS A MEASUREMENT (2026-09-05,
       the scoreOf window). `entry` counts CELLS — `kernel.js render` loops in
       PHRASE LENGTHS and reggae's cell is two bars — so `entry: 2` on this
       four-bar section is "enters at bar four of four", i.e. never. Asked of
       the PAGE, which is the only thing that answers for the sound:
       `ui/derive.js sectionEvents` renders 0 notes for that chair at
       `entry: 2` and 10 notes delayed by 32 steps at `entry: 1`. This check
       was green before the window because `scoreOf` alone let the silent
       chair spill into the sections after it; one cell is the entry that is
       audible INSIDE the section, which is what the check says it measures. */
    const first = (sc) => {
      const e = sc.events.filter((x) => x.sec === si && x.kind === "line" && x.lv === lv);
      return e.length ? { t: e[0].t, n: e.map((x) => x.n).filter((n) => n != null) } : null;
    };
    const before = first(D.scoreOf(d, GENRES));
    assert.ok(before, "the voice is silent in the section under test");

    D.putCell(d, si, vi, "entry", 1);
    const late = first(D.scoreOf(d, GENRES));
    assert.ok(late && late.t > before.t,
      "an entry override did not delay the first note (" +
      (late && late.t) + " vs " + before.t + ")");
    D.putCell(d, si, vi, "entry", null);
    assert.deepStrictEqual(first(D.scoreOf(d, GENRES)), before, "clearing did not restore");

    const reg0 = D.resolve(d, si, vi, "reg");
    D.putCell(d, si, vi, "reg", Math.max(-4, reg0 - 2));
    const low = first(D.scoreOf(d, GENRES));
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    assert.ok(avg(low.n) < avg(before.n) - 12,
      "a reg override moved the pitch by " + (avg(before.n) - avg(low.n)) + " semitones");
    // ...AND ONLY IN THAT CELL: the other sections are byte-identical.
    const other = d.form.sections.findIndex((s, i) => i !== si);
    const sc = D.scoreOf(d, GENRES), base = D.scoreOf(D.normalize(
      P.genreToDocument("reggae", 2)), GENRES);
    const cut = (s2) => JSON.stringify(s2.events.filter((e) => e.sec === other));
    assert.strictEqual(cut(sc), cut(base), "an override leaked into another section");
    D.putCell(d, si, vi, "reg", null);
    assert.deepStrictEqual(first(D.scoreOf(d, GENRES)), before, "clearing did not restore");
  });
  /* T2e — ...AND `focus` REACHES NOTHING, WHICH IS SAID OUT LOUD RATHER THAN
     HOPED. §1 calls focus "today a section index" and asks for the old index
     to be migrated onto the featured voice's cell. MEASURED: `box.focus` is a
     STACK index (ui/derive.js `focusOf` clamps it to `stack.length - 1`),
     `boxesOf` builds a ONE-entry stack, and `focusOf`/`focused` have no
     importer anywhere in the tree — so there was no per-section index to
     migrate and nothing downstream reads the flag. It is STORED and RESOLVED
     here so wave 2's table has a field to draw; this assertion pins the other
     half, that setting it moves no event, so the day a reader lands this test
     fails and somebody has to say what it now does. */
  ok("T2e a focus flag is stored, resolves, and (today) moves no event", () => {
    const d = D.normalize(P.genreToDocument("reggae", 2));
    const vi = d.voices.findIndex((v) => v.kind === "line");
    const before = JSON.stringify(D.scoreOf(d, GENRES));
    assert.strictEqual(D.putCell(d, 1, vi, "focus", true), true);
    assert.strictEqual(D.resolveFrom(d, 1, vi, "focus").from, "cell");
    assert.strictEqual(JSON.stringify(D.scoreOf(d, GENRES)), before,
      "focus reached the sound — say what it does and rewrite this test");
    // ...and the box the engine is handed still says nothing about it either.
    const bx = D.boxesOf(d, "t.");
    assert.ok(bx.every((b) => b.focus === undefined),
      "boxesOf grew a focus; box.focus is a STACK index and would be misread");
  });
}

/* ======================================================================
   T3 · PROVENANCE
   ====================================================================== */
console.log("\nT3 — provenance: own · guest:<genre> · hand\n");

ok("T3a every motif in every bank carries one of the three", () => {
  const bad = [];
  const seen = { own: 0, guest: 0, hand: 0 };
  for (const gk of ANCHORS) for (const s of SEEDS) {
    const d = D.normalize(P.genreToDocument(gk, s));
    for (const n of Object.keys(d.material.cells)) {
      const pr = D.provOf(d, n);
      if (!seen.hasOwnProperty(pr.p)) { bad.push(gk + "/" + s + " " + n + " " + pr.p); continue; }
      seen[pr.p]++;
      if (pr.p === "guest" && !pr.g) bad.push(gk + "/" + s + " " + n + ": guest with no genre");
    }
  }
  assert.deepStrictEqual(bad.slice(0, 8), [], bad.length + " motifs with no honest provenance");
  // a composed record has no hand in it — the composer is not a hand.
  assert.strictEqual(seen.hand, 0, seen.hand + " freshly composed motifs read as the hand's");
  assert.ok(seen.own > 0 && seen.guest > 0,
    "the catalogue produced " + seen.guest + " guest motifs — the derivation is dead");
});

ok("T3b a guest's genre exists and is not younger than its host (eraOK's rule)", () => {
  const bad = [];
  for (const gk of ANCHORS) for (const s of SEEDS) {
    const d = D.normalize(P.genreToDocument(gk, s));
    const host = NC.genreYear(gk);
    for (const n of Object.keys(d.material.cells)) {
      const pr = D.provOf(d, n);
      if (pr.p !== "guest") continue;
      if (!GENRES[pr.g]) { bad.push(gk + " <- " + pr.g + ": no such row"); continue; }
      const y = NC.genreYear(pr.g);
      if (host != null && y != null && y > host)
        bad.push(gk + " (" + host + ") <- " + pr.g + " (" + y + "): the guest postdates the host");
      // ...AND A GUEST IS A GENRE PROPER. An undated row is "a part and not a
      // place" (eraOK's own null branch) and is the record's OWN band — §3's
      // six role rows, corrected by measurement to the six UNDATED ones.
      if (y == null) bad.push(gk + " <- " + pr.g + ": an undated part row read as a guest");
    }
  }
  assert.deepStrictEqual(bad.slice(0, 8), [], bad.length + " guests break the era law");
});

ok("T3c a motif minted on the bench is the hand's, and one edited in place too", () => {
  const d = D.normalize(P.genreToDocument("reggae", 2));
  const names = Object.keys(d.material.cells);
  const dealt = names.find((n) => d.material.cells[n].kind !== "drum");
  assert.strictEqual(D.provOf(d, dealt).p, "own");
  // MINTED: the bench writes `DOC.material.cells[<new name>]` and deals
  // nothing, so a name the composer never dealt is a name a hand made up.
  d.material.cells.mine = J(d.material.cells[dealt]);
  assert.strictEqual(D.provOf(d, "mine").p, "hand", "a minted cell is not the hand's");
  // EDITED IN PLACE: §3, "a hand's edit of a dealt motif makes it the hand's".
  // Measured, not declared — nothing had to be told.
  d.material.cells[dealt].deg[0] = (d.material.cells[dealt].deg[0] + 3) % 7;
  assert.strictEqual(D.provOf(d, dealt).p, "hand", "an edited cell is still the composer's");
  // ...AND THE EXPLICIT DOOR, for a hand whose bytes happen not to move.
  const other = names.find((n) => n !== dealt && d.material.cells[n].kind !== "drum");
  assert.strictEqual(D.provOf(d, other).p, "own");
  assert.strictEqual(D.handWrote(d, other), true);
  assert.strictEqual(D.provOf(d, other).p, "hand");
  // A RECORD WITH NO MAP IS ALL OWN and the door leaves it alone, or every
  // OTHER cell in it would start reading as the hand's.
  const T = J(Songs.TERMS);
  assert.strictEqual(D.handWrote(T, "psalm"), false);
  assert.strictEqual(D.provOf(T, "psalm").p, "own");
});

ok("T3d provenance survives the door, a rename and a clear", () => {
  const d = D.normalize(P.genreToDocument("acid", 1));
  const guest = Object.keys(d.material.cells).find((n) => D.provOf(d, n).p === "guest");
  assert.ok(guest, "the fixture has no guest motif to carry");
  const g = D.provOf(d, guest).g;
  const round = D.normalize(JSON.parse(JSON.stringify(d)));
  assert.deepStrictEqual(D.provOf(round, guest), { p: "guest", g },
    "a guest lost its genre through JSON + the door");
  // THE RENAME IS ONE DOOR and the provenance map is a fifth thing that points
  // at the name (the 2026-09-01 law: never a second copy of the walk).
  assert.strictEqual(D.renameCell(round, guest, "visitor"), true);
  assert.deepStrictEqual(D.provOf(round, "visitor"), { p: "guest", g });
  // ...and an entry for a cell nobody kept is a claim about nothing.
  delete round.material.cells.visitor;
  D.normalize(round);
  assert.ok(!(round.material.prov && "visitor" in round.material.prov),
    "the door kept a provenance for a deleted motif");
});

/* ---- WHAT THE CATALOGUE ACTUALLY SAYS, printed every run (§3 asked for the
   census and this is it: the numbers are the argument). ------------------- */
{
  const by = {}, hosts = [];
  let cells = 0, guests = 0;
  for (const gk of ANCHORS) {
    const d = D.normalize(P.genreToDocument(gk, 1));
    const mine = [];
    for (const n of Object.keys(d.material.cells)) {
      cells++;
      const pr = D.provOf(d, n);
      if (pr.p !== "guest") continue;
      guests++; by[pr.g] = (by[pr.g] || 0) + 1; mine.push(n + " <- " + pr.g);
    }
    if (mine.length) hosts.push(gk + ": " + mine.join(", "));
  }
  console.log("\nTHE GUEST CENSUS — motifs a genre proper brought, seed 1, " +
              ANCHORS.length + " anchors\n");
  console.log("  " + guests + " of " + cells + " motifs (" +
              (100 * guests / cells).toFixed(2) + "%) on " + hosts.length + " records · " +
              Object.keys(by).sort((a, b) => by[b] - by[a])
                .map((k) => k + " x" + by[k]).join(" · "));
  for (const h of hosts) console.log("    " + h);
  console.log("\n  §3 named six role rows the record owns — vocal, backing, solo, pad,\n" +
              "  drone, counterpoint. Measured, the UNDATED rows are vocal, backing,\n" +
              "  simple, pad, riff, solo; `drone` (New York 1964) and `counterpoint`\n" +
              "  (Vienna 1725) are dated genres proper and are the two commonest\n" +
              "  guests in the catalogue. The predicate is the year, which is\n" +
              "  compose.js eraOK's own null branch.\n");
}

/* ---- ...AND WHERE §1 WAS CORRECTED BY MEASUREMENT ---------------------- */
{
  const notes = Object.keys(D.TIERS).filter((k) => D.TIERS[k].note);
  console.log("§1, CORRECTED BY MEASUREMENT — " + notes.length + " fields carry a note:\n");
  for (const k of notes)
    console.log("  " + k.padEnd(12) + D.TIERS[k].tier.padEnd(8) +
                (D.TIERS[k].wave ? "wave " + D.TIERS[k].wave + "  " : "") + D.TIERS[k].note);
  console.log("");
}

/* ======================================================================
   T4 · THE SOUND MOVES ON PURPOSE (TABLE.md wave 2a)
   ======================================================================
   WHY THIS BLOCK EXISTS AT ALL, and it is the whole lesson of the
   test-the-artifact memo. Everything above renders through
   `document.scoreOf`, which is "deliberately the SMALL half: no layers, no
   nudge, no lead-ins, no tempo warp, no swing override" — and, measured,
   ZERO references to `intro`, `outro` or `mot`. It is STRUCTURALLY BLIND to
   the three fields step 1 carries, so a green T2c proves nothing about them.

   The real consumers are one tier up and neither of them is pure node on its
   own: ui/derive.js `sectionEvents` (line 607: `edges(envelope(…), sec.intro,
   sec.outro, …)` — the intro and the outro REPLACE the first and last bars)
   and audio/desk.js `compileAuto` (line 128: `sec.mot` -> the section's
   `auto[]` lanes, which `deskSweeps` and `deskLevelAt` then play). So this
   block stands the data tier up on a stub window and imports the two real ES
   modules on top of it — nukernel/desk-gate.js's own recipe, which exists for
   exactly this reason ("a wiring change in the shipped file fails HERE") —
   and reads the RENDERED bars and the RENDERED lanes.

   It is async and therefore last, and it owns the summary and the exit code:
   a `process.exit` above it would take the run down before the sound was
   measured at all. */
(async () => {
  globalThis.window = globalThis;
  globalThis.addEventListener = () => {};
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.document = { visibilityState: "visible", body: { append() {} },
    createElement: () => ({ style: {}, append() {}, click() {}, setAttribute() {} }) };
  window.NuKernel = N("kernel.js"); window.NuGenres = NG;
  window.NuFields = N("fields.js"); window.NuSong = N("song.js");
  window.NuInstruments = N("instruments.js"); window.NuCompose = NC;
  window.NuDocument = D; window.NuSongs = Songs;
  window.PRESETS = N("presets.js").PRESETS;
  window.__REGISTRY = require(path.join(ROOT, "engine", "registry-data.js"));
  const SE = require(path.join(ROOT, "engine", "faust", "voices", "state-engine.js"));
  const NF = window.NuFields;
  const DER = await import(path.join(ROOT, "nukernel", "ui", "derive.js"));
  const DESK = await import(path.join(ROOT, "nukernel", "audio", "desk.js"));

  /* THE PAGE'S OWN COMPILE, in four lines — ui/eight.js `push()` registers one
     genre per section under a prefix and hands `boxesOf` the same prefix, and
     the phrase slots are laid out the way `boxesOf`'s stack indexes read them
     (voice v, section i -> slot v*NS+i). Nothing here is a second answer to
     "what does this record play": it is the same two functions the page calls. */
  const GK = "table.gate.";
  const DD = N("desk-doc.js");
  const boxesFor = (doc) => {
    doc.form.sections.forEach((s2, i) => {
      GENRES[GK + i] = D.toGenre(doc, i, GENRES, []);
    });
    const boxes = D.boxesOf(doc, GK);
    /* ...AND THE TWO THINGS `push()` WRITES ONTO A BOX THAT `boxesOf` DOES
       NOT. A desk address is not a document fact — the map from a voice to a
       CHANNEL is desk-doc.js's one walk — so the per-section cell lanes are
       laid on here exactly as ui/eight.js lays them on (TABLE.md wave 3).
       Absent on every composed record, so every T4 above reads the same boxes
       it read before this line existed. */
    boxes.forEach((b, i) => {
      const ca = DD.cellAutoOf(doc, GENRES, doc.form.sections[i].id);
      if (ca) b.cellauto = ca;
    });
    return boxes;
  };
  const slotsFor = (doc) => {
    const secs = doc.form.sections, lines = doc.voices.filter((v) => v.kind === "line");
    const out = [];
    lines.forEach((c, v) => secs.forEach((s2, i) => {
      out[v * secs.length + i] = D.toPhrase(doc, D.materialAt(c, s2.id));
    }));
    return out;
  };
  const barsOf = (doc) => {
    const slots = slotsFor(doc);
    return boxesFor(doc).map((b) =>
      DER.sectionEvents(b, slots, doc.time.groove, doc.time.swing).ev);
  };
  const clone = (d) => JSON.parse(JSON.stringify(d));

  console.log("\nT4 — the sound moves: the rendered bars and the rendered lanes\n");

  /* T4a — `mot` REACHES THE DESK'S AUTOMATION. Before this commit `boxesOf`
     wrote `mot: null` on every precomposed section, so `compileAuto` compiled
     an EMPTY lane list on all 4,859 of them and `deskSweeps` answered with its
     own "no filter" constant for every bar in the catalogue. */
  ok("T4a a mot section compiles a MOVING desk lane; stripped, it is flat again", () => {
    let sections = 0, moving = 0, flatWhenStripped = 0;
    const words = {};
    let example = null;
    // ONE STRIPPED RENDER PER RECORD, not one per section: `boxesFor` compiles
    // every section's genre, so asking it again inside the section loop made
    // this walk quadratic in the sections that move (measured: 501 extra full
    // compiles, and the gate ran for minutes rather than seconds).
    const flat = (b) => DESK.deskSweeps(b, 4, (x) => x)[0];
    for (const gk of ANCHORS) {
      const doc = D.normalize(P.genreToDocument(gk, 1));
      const boxes = boxesFor(doc);
      const mots = boxes.map((b) => b.mot);
      if (!mots.some(Boolean)) continue;
      const measured = boxes.map((b) => {
        const sw = flat(b);
        return { from: sw.from, to: sw.to, lo: DESK.deskLevelAt(b, 0),
                 mid: DESK.deskLevelAt(b, 0.5) };
      });
      // ...and the same record with the field stripped back off, which is the
      // world before this commit.
      const d0 = clone(doc);
      for (const s2 of d0.form.sections) delete s2.mot;
      const zero = boxesFor(d0).map((b) => {
        const sw = flat(b);
        return { from: sw.from, to: sw.to, mid: DESK.deskLevelAt(b, 0.5) };
      });
      for (let i = 0; i < boxes.length; i++) {
        if (!mots[i]) continue;
        sections++; words[mots[i]] = (words[mots[i]] || 0) + 1;
        const m = measured[i];
        if (m.from === m.to && m.lo === m.mid) continue;
        moving++;
        if (!example) example = gk + " #" + i + " " + mots[i];
        if (zero[i].from === zero[i].to && zero[i].mid === 1) flatWhenStripped++;
      }
    }
    console.log("       " + sections + " mot sections at seed 1 (" +
      Object.keys(words).map((w) => w + " x" + words[w]).join(" · ") + "); " +
      moving + " move a rendered lane, and all " + flatWhenStripped +
      " of them are flat with `mot` stripped. First: " + example);
    assert.ok(sections > 900, "the composer's motion is not on the document: " + sections);
    assert.ok(moving > 400, "only " + moving + " of " + sections + " mot sections move a lane");
    assert.strictEqual(flatWhenStripped, moving,
      "a lane survived stripping `mot` — something else is writing it");
    // THE ONE WORD WITH NO HOME, said out loud rather than counted as a pass:
    // `rise` compiles to a HIGHPASS sweep and audio/desk.js has no floor to
    // sweep ("it is named here and rendered by nothing"), so those sections
    // reach `auto[]` and not the filter. That is the parent's gap, not this
    // wave's, and it is why `moving` is not `sections`.
    assert.ok(words.rise && moving + words.rise >= sections,
      "the unrendered remainder is not the documented `rise` gap");
  });

  /* T4b — AND A `pump` MOVES THE LEVEL, which is the lane no composed record
     has (compose deals open/rise/close and never pump), so it is the hand's
     half of the same claim and it goes through `putRow`. */
  ok("T4b a hand's pump on one row moves that section's rendered level and no other's", () => {
    const doc = D.normalize(P.genreToDocument("acid", 1));
    const si = doc.form.sections.findIndex((s2, i) => !s2.mot && i > 0);
    assert.ok(si > 0, "no section without a motion to give one to");
    const before = boxesFor(doc).map((b) => [0, 0.25, 0.5].map((f) => DESK.deskLevelAt(b, f)));
    assert.strictEqual(D.putRow(doc, si, "mot", "pump"), true);
    const after = boxesFor(doc).map((b) => [0, 0.25, 0.5].map((f) => DESK.deskLevelAt(b, f)));
    assert.deepStrictEqual(before[si], [1, 1, 1], "the section was already automated");
    assert.ok(after[si][0] < 0.5 && after[si][2] > after[si][0],
      "a pump did not duck and recover: " + after[si].join("/"));
    for (let i = 0; i < before.length; i++) if (i !== si)
      assert.deepStrictEqual(after[i], before[i], "the pump leaked into section " + i);
    // ...and clearing it returns the row to what it inherits (§2).
    assert.strictEqual(D.putRow(doc, si, "mot", null), true);
    assert.deepStrictEqual(boxesFor(doc).map((b) =>
      [0, 0.25, 0.5].map((f) => DESK.deskLevelAt(b, f))), before, "clearing did not restore");
  });

  /* T4c — `intro` AND `outro` REPLACE THE FIRST AND LAST BARS OF THE SECTION
     THEY ARE ON. Read off the rendered bars, per anchor, against the same
     record with the two fields stripped. */
  /* THE COUNT IN THIS TITLE IS DERIVED (2026-09-06, the three starting points),
     for the reason test/genres-build.test.js G3's is: a literal here read
     "478 of 479" and the catalogue is 482. The ASSERTION was never the literal
     — it is `moved > 450` and the real pair is printed below it — so the title
     reads the catalogue rather than remembering it. */
  ok("T4c the carried intro and outro change the rendered bars, and nearly all " +
     ANCHORS.length + " records move", () => {
    let moved = 0, added = 0, removed = 0;
    let silenced = 0;
    const biggest = [];
    for (const gk of ANCHORS) {
      const doc = D.normalize(P.genreToDocument(gk, 1));
      const d0 = clone(doc);
      for (const s2 of d0.form.sections) { delete s2.intro; delete s2.outro; delete s2.mot; }
      const a = barsOf(doc), b = barsOf(d0);
      const na = a.reduce((x, y) => x + y.length, 0), nb = b.reduce((x, y) => x + y.length, 0);
      if (na === 0 && nb > 0) silenced++;
      if (JSON.stringify(a) === JSON.stringify(b)) continue;
      moved++; added += Math.max(0, na - nb); removed += Math.max(0, nb - na);
      biggest.push([gk, na - nb]);
    }
    biggest.sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
    console.log("       " + moved + " of " + ANCHORS.length +
      " anchors render different bars at seed 1: " + added + " events added, " +
      removed + " removed. Biggest: " +
      biggest.slice(0, 6).map((x) => x[0] + " " + (x[1] > 0 ? "+" : "") + x[1]).join(", "));
    assert.ok(moved > 450, "only " + moved + " records moved — the carry is not reaching derive");
    assert.strictEqual(silenced, 0, silenced + " records went silent");
  });

  /* T4d — A ROW `key` RENDERS IN THAT KEY, read off the PITCH CLASSES, and
     only in that section. This is step 2's claim and the composer's own
     modulation is the fixture: `beatgroup`'s last chorus is the truck-driver
     gear change compose.js:1711 deals and precompose used to drop. */
  ok("T4d a row key override renders in that key, and no other section moves", () => {
    const doc = D.normalize(P.genreToDocument("beatgroup", 1));
    const si = doc.form.sections.findIndex((s2) => s2.key != null);
    assert.ok(si >= 0, "the fixture no longer carries a composed modulation");
    const home = doc.alphabet.key, up = doc.form.sections[si].key;
    const shift = ((up - home) % 12 + 12) % 12;
    const notesIn = (sc, i) => sc.events.filter((e) => e.sec === i && e.n != null).map((e) => e.n);
    const withIt = D.scoreOf(doc, GENRES);
    const d0 = clone(doc); delete d0.form.sections[si].key;
    const without = D.scoreOf(d0, GENRES);
    const pcs = (a) => [...new Set(a.map((n) => ((n % 12) + 12) % 12))].sort((x, y) => x - y);
    const A2 = notesIn(withIt, si), B2 = notesIn(without, si);
    assert.strictEqual(A2.length, B2.length, "the modulation changed how many notes there are");
    const moved = A2.map((n, k) => n - B2[k]);
    assert.ok(moved.every((d) => d === shift - (shift > 6 ? 12 : 0) || d === shift),
      "the section did not transpose by the modulation: " +
      [...new Set(moved)].join(","));
    console.log("       beatgroup #" + si + ": key " + home + " -> " + up +
      ", pitch classes " + pcs(B2).join(" ") + " -> " + pcs(A2).join(" "));
    for (let i = 0; i < doc.form.sections.length; i++) if (i !== si)
      assert.deepStrictEqual(notesIn(withIt, i), notesIn(without, i),
        "the modulation leaked into section " + i);
    // ...AND A HAND'S OWN, through putRow, on a record that modulates nowhere.
    const d2 = D.normalize(P.genreToDocument("reggae", 2));
    assert.ok(d2.form.sections.every((s2) => s2.key == null), "the fixture modulates");
    const base = D.scoreOf(d2, GENRES);
    assert.strictEqual(D.putRow(d2, 1, "key", NF.wrapKey(d2.alphabet.key + 5)), true);
    const now = D.scoreOf(d2, GENRES);
    assert.notDeepStrictEqual(notesIn(now, 1), notesIn(base, 1), "a hand's key moved nothing");
    assert.deepStrictEqual(notesIn(now, 0), notesIn(base, 0), "it leaked into section 0");
    assert.strictEqual(D.putRow(d2, 1, "key", null), true);
    assert.deepStrictEqual(D.scoreOf(d2, GENRES), base, "clearing did not restore");
  });

  /* T4e — A ROW `swing` MOVES THE ODD SIXTEENTHS OF THAT SECTION ONLY.
     kernel.js:455 is the whole definition — `swing(g, i) = (i % 2) * g.swing`,
     added in `timeOf` — so a swung section is one whose ODD steps land off the
     grid and whose even ones do not. Counted, not asserted by eye. */
  ok("T4e a row swing override leans that section's odd sixteenths and no other's", () => {
    // A STRAIGHT FIXTURE, ON PURPOSE: the claim is that odd sixteenths move
    // OFF the grid, and a record that already swings has them off it before
    // the row says anything. `neoclassical` states no swing and no groove
    // (113 of the 479 anchors do); the assertion is about the lean, so the
    // fixture must have none to start with.
    const doc = D.normalize(P.genreToDocument("neoclassical", 2));
    assert.ok(!doc.time.swing || doc.time.swing === "straight",
      "the fixture already swings: " + doc.time.swing);
    /* THE MEASUREMENT IS THE DEFINITION, and "off the grid" is not it: the
       tape humanises every onset (a straight neoclassical bar already has 22
       of its 29 events at a fractional step), so an off-grid COUNT says
       nothing. kernel.js:455 says exactly what a swing is — `(i % 2) *
       g.swing` added to step i — so the honest reading is the PER-EVENT
       DELTA between the same render swung and straight: every onset moves by
       0 or by exactly the swing, and by the swing only if it sits on an odd
       sixteenth. Measured on this fixture: 6 of 29 move by 1/3 of a step and
       23 do not. */
    const before = barsOf(doc);
    const si = 1;
    assert.strictEqual(D.putRow(doc, si, "swing", "shuffle"), true);
    const boxes = boxesFor(doc);
    assert.strictEqual(boxes[si].swing, "shuffle", "boxesOf did not carry the row's swing");
    assert.ok(boxes.every((b, i) => i === si || b.swing === undefined),
      "the swing landed on a box that never asked");
    const after = barsOf(doc);
    const lean = NF.SWINGS.shuffle;
    assert.strictEqual(after[si].length, before[si].length,
      "a swing changed how many events there are");
    const deltas = after[si].map((e, k) => +(e.t - before[si][k].t).toFixed(6));
    const leaned = deltas.filter((d) => Math.abs(d - lean) < 1e-4).length;
    const still = deltas.filter((d) => d === 0).length;
    console.log("       neoclassical #" + si + ": " + leaned + " of " +
      deltas.length + " onsets lean by exactly " + lean.toFixed(4) +
      " of a step, " + still + " do not move");
    assert.ok(leaned > 0, "a shuffle leaned no sixteenth");
    assert.strictEqual(leaned + still, deltas.length,
      "an onset moved by something that is not the swing: " +
      [...new Set(deltas)].join(","));
    for (let i = 0; i < before.length; i++) if (i !== si)
      assert.deepStrictEqual(after[i], before[i], "the swing leaked into section " + i);
    assert.strictEqual(D.putRow(doc, si, "swing", null), true);
    assert.deepStrictEqual(barsOf(doc), before, "clearing did not restore");
    // ...and the groove through the same door, which derive reads beside it.
    assert.strictEqual(D.putRow(doc, si, "groove", "funk"), true);
    const g = barsOf(doc);
    assert.notDeepStrictEqual(g[si], before[si], "a row groove moved nothing");
    for (let i = 0; i < before.length; i++) if (i !== si)
      assert.deepStrictEqual(g[i], before[i], "the groove leaked into section " + i);
  });

  /* T4f — A ROW `fx` CHANGES THAT SECTION'S RENDERED CHAIN AND NO OTHER'S.
     Read off `deskUnits`, which is the last thing between the document and the
     parent's own unit table — the chips arrive as `u.inserts`, finished
     through state-engine `insertChain`. A recipe-level read and not a
     spectrum: the chain naming the chip IS the artifact at this tier, and the
     spectrum belongs to the browser gate that renders it. */
  ok("T4f a row fx override lands a real insert on that section's units only", () => {
    const doc = D.normalize(P.genreToDocument("reggae", 2));
    const units = { v0: { lvl: 1, module: "sampler", sampler: { id: "ahh_choir" } } };
    const addr = { v0: "lead" };
    const chainOf = (b) => JSON.stringify(
      (DESK.deskUnits(clone(units), addr, b, (x) => x, SE).v0 || {}).inserts || []);
    const si = doc.form.sections.findIndex((s2) => !s2.fx || !s2.fx.length);
    assert.ok(si >= 0, "every section already carries a chain");
    const before = boxesFor(doc).map(chainOf);
    assert.strictEqual(D.putRow(doc, si, "fx", ["crunch"]), true);
    const boxes = boxesFor(doc);
    assert.deepStrictEqual(boxes[si].fx, ["crunch"], "boxesOf did not carry the row's chain");
    const after = boxes.map(chainOf);
    assert.notStrictEqual(after[si], before[si], "the chip reached no insert");
    assert.ok(after[si].length > before[si].length, "the chain did not grow");
    for (let i = 0; i < before.length; i++) if (i !== si)
      assert.strictEqual(after[i], before[i], "the chain leaked into section " + i);
    console.log("       reggae #" + si + " inserts: " + before[si] + " -> " + after[si]);
    assert.strictEqual(D.putRow(doc, si, "fx", null), true);
    assert.deepStrictEqual(boxesFor(doc).map(chainOf), before, "clearing did not restore");
    // ...AND THE TWO SENDS AND THE PLACE, through the same door and read off
    // the composed channel — the numbers the strip draws and the unit takes.
    const chan = (b) => DESK.deskChannelBase(b, "lead");
    const base = boxesFor(doc).map(chan);
    D.putRow(doc, si, "rev", "drown"); D.putRow(doc, si, "echo", "wet");
    D.putRow(doc, si, "pan", "r");
    const now = boxesFor(doc).map(chan);
    assert.ok(now[si].rev > base[si].rev, "a row reverb send moved nothing");
    assert.ok(now[si].del > base[si].del, "a row echo send moved nothing");
    assert.ok(now[si].pan !== base[si].pan, "a row pan moved nothing");
    for (let i = 0; i < base.length; i++) if (i !== si)
      assert.deepStrictEqual(now[i], base[i], "a send leaked into section " + i);
  });

  /* T4g — AND THE CARRIED CHAIN IS ON THE CATALOGUE, not just on a fixture:
     the census the projection used to throw away. */
  ok("T4g the composer's own chains and sends reach the box on the catalogue", () => {
    const c = { fx: 0, rev: 0, echo: 0, mode: 0, prog: 0, key: 0 };
    const recs = { fx: new Set(), rev: new Set(), echo: new Set(), mode: new Set() };
    for (const gk of ANCHORS) {
      const boxes = boxesFor(D.normalize(P.genreToDocument(gk, 1)));
      for (const b of boxes) {
        if (b.fx && b.fx.length) { c.fx++; recs.fx.add(gk); }
        if (b.rev) { c.rev++; recs.rev.add(gk); }
        if (b.echo) { c.echo++; recs.echo.add(gk); }
      }
      const d = D.normalize(P.genreToDocument(gk, 1));
      for (const s2 of d.form.sections) {
        if (s2.mode) { c.mode++; recs.mode.add(gk); }
        if (s2.prog) c.prog++;
        if (s2.key != null) c.key++;
      }
    }
    console.log("       carried onto the box at seed 1 — fx " + c.fx + " sections/" +
      recs.fx.size + " records · rev " + c.rev + "/" + recs.rev.size +
      " · echo " + c.echo + "/" + recs.echo.size +
      "; and onto the row — mode " + c.mode + "/" + recs.mode.size +
      " · key " + c.key + " · prog " + c.prog);
    assert.ok(c.fx > 1000 && c.rev > 1500 && c.echo > 400,
      "the chains are not reaching the box: " + JSON.stringify(c));
    assert.ok(c.mode > 300 && c.key > 200, "the modulations are not on the row");
  });

  /* T4h — `pace` WAS ALREADY A ROW FIELD AND IS REACHABLE THROUGH THE
     RESOLVER. §1 moved it here from Time on 2026-09-03 and the tree had
     already done the work (compose.js dealPaces, the projection since
     2026-08-30, audio/plan.js PACE_RATE at the clock); what it lacked was a
     resolver call site, which is what a table cell asks through. The claim
     this gate makes is the narrow one: a pace on one row changes THAT
     section's bar seconds and nobody else's. */
  const PLANMOD = await import(path.join(ROOT, "nukernel", "audio", "plan.js"));
  ok("T4h a row pace changes that section's bar seconds only", () => {
    assert.ok(D.TIERS.pace && D.TIERS.pace.tier === "row" && D.TIERS.pace.at,
      "pace is not a row field with an address");
    // `await import`, never `require`: audio/plan.js is an ES module WITH
    // top-level await (it builds the Faust fleet), and node refuses to
    // `require` such a graph. Loaded once, above, and passed in here.
    const PLAN = PLANMOD;
    const doc = D.normalize(P.genreToDocument("reggae", 2));
    const bpm = doc.time.bpm;
    const secsFor = (bx) => bx.map((b) => DER.secsOf(b, bpm) / PLAN.paceRateOf(b.pace));
    const before = secsFor(boxesFor(doc));
    const si = doc.form.sections.findIndex((s2) => !s2.pace);
    assert.ok(si >= 0, "every section already paces");
    assert.strictEqual(D.resolveFrom(doc, si, 0, "pace").from, null,
      "an unset pace already answers from somewhere");
    assert.strictEqual(D.putRow(doc, si, "pace", "half"), true);
    assert.strictEqual(D.resolveFrom(doc, si, 0, "pace").from, "row");
    const boxes = boxesFor(doc);
    assert.strictEqual(boxes[si].pace, "half", "boxesOf did not carry the row's pace");
    const after = secsFor(boxes);
    assert.ok(Math.abs(after[si] - before[si] * 2) < 1e-9,
      "half pace did not double the section: " + before[si] + " -> " + after[si]);
    for (let i = 0; i < before.length; i++) if (i !== si)
      assert.strictEqual(after[i], before[i], "the pace leaked into section " + i);
    assert.strictEqual(D.putRow(doc, si, "pace", null), true);
    assert.deepStrictEqual(secsFor(boxesFor(doc)), before, "clearing did not restore");
  });

  /* T4j — A SUNG CHAIR IS WRITTEN WHERE IT SINGS (2026-09-04, the singer
     round; it is what T2 masks `cast.reg` for).

     THE CLAIM, IN THREE PARTS, all read off the NOTES and none off the field:
       1  THE SUNG LINE HAS NOT MOVED. For every sung chair on both sides, the
          notes the throat actually sounds — the rendered line PLUS the octave
          fold `homeFor` applies at the seat — are identical, note for note.
       2  THE FOLD IS GONE. On the head, that fold is 0: the written line is
          already inside the throat's compass, so the staff, the piano roll and
          the notated .mid draw what is sung instead of a line an octave above
          it. (Measured over the whole catalogue: 1,354 of 2,459 sung chairs
          folded before, 0 after; sung median moved on none of them.)
       3  AND THE MOVE IS AN EXACT OCTAVE. The head's written notes are the
          base's plus 12 x (the head's register minus the base's), which is
          what makes part 1 possible: the line was TRANSPOSED, not rewritten,
          so no contour, no interval and no accidental changed with it.

     WHAT IT MEANS FOR THE .MID, said out loud because it is a file somebody
     opens. The ⤓ button writes the PLAYED record (`export/smf.js`'s own
     header: "a .mid is a session another DAW presses play on") off
     `plan.timeline()`, which has the fold already applied — so the default
     export is byte-identical, and part 1 is the assertion that says so. The
     NOTATED export (`writeSmf` over `buildScore`) and the staff and the piano
     roll all read the WRITTEN line, and those DO move: a tenor lead's notated
     .mid now sits an octave lower than it did. That is the correction, not a
     regression — the old file wrote a C5 line no tenor in this box ever sang.

     The compass is read off `knobs.js`, the extraction of the parent's
     VOICE_TYPE, the same table §7d reads; the claim above is a comparison of
     two records and does not depend on that table being right. */
  ok("T4j a sung chair is written where it sings: the sung line is the base's, the fold is gone", () => {
    const midiOfHz = (hz) => Math.round(69 + 12 * Math.log2(hz / 440));
    const COMPASS = {};
    for (const dsp of ["voice_lead", "voice_choir"]) {
      const row = ((((NK.voices || {})[dsp] || {}).rows) || [])
        .find((r) => r && r.key === "voice" && r.compass);
      if (!row) continue;
      for (const w of Object.keys(row.compass)) {
        const [lo, hi] = row.compass[w] || [];
        if (lo > 0 && hi > 0) COMPASS[w] = [midiOfHz(lo), midiOfHz(hi)];
      }
    }
    assert.strictEqual(Object.keys(COMPASS).length, 5,
      "knobs.js no longer publishes the five throats' compasses");
    // whose throat a chair is, resolved as audio/plan.js castOf resolves it:
    // the owner's tone, a `mouth` on it winning, then the cast throat, then the
    // patch's default. A guest sings with its OWN row.
    /* ...AND SINCE 2026-09-04 IT ASKS THE CHAIR FIRST, through the one owner
       `instruments.js throatVoiceOf` — the per-chair round put a throat on
       `cast.voice` and a helper that read only the ROW would be measuring
       these records against a singer they are not seated for. The BASE has no
       such function and no such field, so its side keeps the walk that build
       performed; the two answers are identical everywhere the head writes no
       word, which is every row but fifteen. */
    const throatOf = (mod, GEN, gk, doc, li, chair) => {
      const P = (mod.NI.PATCHES.voice || {})[chair.instrument];
      if (!P) return null;
      const nBase = (GEN[gk] || {}).voices || 0;
      const owner = (li < nBase) ? gk : (GEN[chair.name] ? chair.name : gk);
      const t = (GEN[owner] || {}).tone || null;
      if (mod.NI.throatVoiceOf)
        return COMPASS[mod.NI.throatVoiceOf(t, owner, chair.instrument,
          (chair.cast && chair.cast.voice) || null) || ""] || null;
      const M = (t && t.mouth) || (t ? mod.NI.throatOf(owner, chair.instrument) : null);
      return COMPASS[(M && M.voice) || (t && t.voice) || P.voice] || null;
    };
    // the chair's own notes, over the record, in the bars the BOX plays
    // (ui/derive.js sectionRender rounds the section up to whole loops)
    const linesOf = (mod, GEN, gk, doc) => {
      const lines = doc.voices.filter((v) => v.kind === "line"), nP = lines.length;
      const per = lines.map(() => []);
      for (let i = 0; i < doc.form.sections.length; i++) {
        const g = mod.D.toGenre(doc, i, GEN), sec = doc.form.sections[i];
        const total = Math.ceil(Math.max(1, sec.bars || g.bars) / g.bars) * g.bars;
        lines.forEach((c, pi) => {
          if (!throatOf(mod, GEN, gk, doc, pi, c)) return;
          const evs = mod.K.render(mod.D.toPhrase(doc, mod.D.materialAt(c, sec.id)), g, total);
          for (let v = pi; v < g.voices; v += nP)
            for (const e of evs) if (e.v === v && e.n != null) per[pi].push(e.n);
        });
      }
      return { lines, per };
    };
    const HEAD = { D, K, NI }, BASE = { D: B.D, K: B.K, NI: B.NI };
    /* THE FIFTEEN VOICED ROWS ARE NOT THIS GATE'S (2026-09-04, the per-chair
       round). T4j's three claims are the SEAT round's invariant — the sung line
       did not move, the written one moved by exact octaves, and the fold is
       gone — and that invariant is deliberately broken on the rows where a
       chair now names its own throat: a bass singer sings bass, so the sung
       line moves, and it moves because the COMPASS moved rather than because
       anything was re-seated wrong. Excluded here and held by T4o instead,
       which pins each of those chairs' throat and register outright. The set is
       DERIVED from the catalogue (`VOICEROWS`), not typed, so a row that gains
       a `throat` closure tomorrow leaves this gate and joins that one without
       an edit here. */
    const stride = Math.max(1, Math.round(ANCHORS.length / 45));
    const pool = ANCHORS.filter((gk) => !VOICEROWS.includes(gk));
    const sample = FULL ? pool : pool.filter((_, i) => i % stride === 0);
    const moved = [], stillFolded = [], notOctave = [];
    let chairs = 0, rewritten = 0;
    for (const gk of sample) for (const s of SEEDS) {
      const md = D.normalize(P.genreToDocument(gk, s));
      const td = B.D.normalize(B.P.genreToDocument(gk, s));
      const m = linesOf(HEAD, GENRES, gk, md), t = linesOf(BASE, B.GENRES, gk, td);
      m.lines.forEach((c, pi) => {
        const win = throatOf(HEAD, GENRES, gk, md, pi, c);
        if (!win || !m.per[pi].length) return;
        chairs++;
        const dReg = c.cast.reg - t.lines[pi].cast.reg;
        if (dReg) rewritten++;
        const where = gk + "/" + s + " " + c.name;
        // 3 — the written line moved by exactly that many octaves
        if (m.per[pi].length !== t.per[pi].length ||
            m.per[pi].some((n, i) => n !== t.per[pi][i] + 12 * dReg)) notOctave.push(where);
        // 2 — and it now needs no fold at all
        const hHome = K.homeFor(m.per[pi], win);
        if (hHome !== 0) stillFolded.push(where + " (" + hHome + ")");
        // 1 — the SUNG line is the base's, note for note. BOTH sides are folded
        // with the head's `homeFor`, on purpose: at the base that function lived
        // in audio/plan.js (this round moved it to kernel.js unchanged), so the
        // base's kernel does not export it, and asking a different question of
        // the two sides would make the comparison meaningless. It is pure
        // arithmetic over notes and a window — the same arithmetic the base's
        // seat ran, byte for byte.
        const bHome = K.homeFor(t.per[pi], win);
        const sungM = m.per[pi].map((n) => n + 12 * hHome);
        const sungT = t.per[pi].map((n) => n + 12 * bHome);
        if (JSON.stringify(sungM) !== JSON.stringify(sungT)) moved.push(where);
      });
    }
    console.log("       (" + sample.length + " anchors x " + SEEDS.length + " seeds, " +
                chairs + " sung chairs, " + rewritten + " re-seated" +
                (FULL ? ", --full" : ", --full for all " + ANCHORS.length) + ")");
    assert.deepStrictEqual(moved.slice(0, 8), [],
      moved.length + " sung chairs sing a different line than they did");
    assert.deepStrictEqual(notOctave.slice(0, 8), [],
      notOctave.length + " written lines moved by something other than whole octaves");
    assert.deepStrictEqual(stillFolded.slice(0, 8), [],
      stillFolded.length + " sung chairs are still written outside their compass");
    /* THE RE-SEAT COUNT IS A CLAIM ABOUT THE BASE, NOT THE HEAD (2026-09-04
       night, when BASE_SHA moved onto a commit that already seats). Before
       §7d existed at the base, "no chair re-seated" meant §7d reached
       nothing; once the base seats too, zero is the ONLY right answer and
       parts 1–3 above are the whole claim. Read off the base's own source
       rather than remembered. */
    const baseSeats = /seatSungChairs/.test(
      fs.readFileSync(path.join(WT, "nukernel", "precompose.js"), "utf8"));
    if (baseSeats) assert.strictEqual(rewritten, 0,
      "the base already seats sung chairs, yet " + rewritten + " moved again");
    else assert.ok(rewritten > 0, "no chair was re-seated — §7d reached nothing");
  });

  /* T4o — EACH CHANGED ROW'S PER-CHAIR THROAT AND REGISTER, PINNED
     (2026-09-04, the per-chair singer round).

     THE ROUND'S CLAIM, and it is the opposite of the seat round's the day
     before: THE SOUND MOVES HERE, on purpose, on fifteen rows and nowhere
     else. A throat used to be a fact about the ROW — one `MOUTHS` row per
     record — and a four-part choir is the case that breaks it: `chorale`
     spread four voices over three octaves and every one of them sang with the
     same alto, `doowop`'s BASS SINGER was cast on the lead's countertenor and
     was written ABOVE him, and nine rows held a lead part in a bass's throat.
     A chair may name its own now (`document.js TIERS.voice`, written from the
     row's `throat` closure, GENRES.md §3), so a bass singer sings bass.

     T2 IS THEREFORE BLIND ON THESE ROWS and this is what replaces it. T2a
     strips `cast.voice` where the base has none, T2b masks the chairs seam on
     exactly these rows, and T2c has cut the sung lanes out of its event
     comparison since §7d. This gate is the whole statement in their place, and
     it is taken off the RESOLVED THROAT and the SEATED REGISTER rather than
     off the field: `instruments.js throatVoiceOf` is the same function that
     builds the seat `audio/plan.js` hands the engine, so what is pinned here
     is what the box sings.

     FOUR CLAIMS:
       1  every sung chair on every one of the fifteen rows resolves to the
          throat and sits at the register this table names, at seeds 1-3;
       2  where the ROW names a throat for a chair, that word is the one that
          wins — the chair outranks its own row's mouth;
       3  every one of them is written INSIDE that throat's compass (fold 0),
          which is §7d's law re-asked with the new throats;
       4  and it MOVED: against the pinned base, every one of the fifteen rows
          resolves at least one chair to a different throat than it did. A
          change nobody can measure is a change that is not there. */
/* FOUR REGISTERS RE-DERIVED 2026-09-05, and the reason is a round this table
   is OLDER than. The pin was written at 1d15649 (the per-chair throat round);
   `ee8366d` — the composer's asks, forty-two chord qualities, sixty-three
   scales and chords with durations — moved four of these chairs by exactly one
   octave, and when the T2 base moved onto that commit (ab7728e) this table was
   not re-asked with it. So it has been describing a build that no longer
   exists, which is the one thing a pin may never do.

   WHICH FOUR, AND BY HOW MUCH (measured at 1d15649 and again at ee8366d, mean
   written pitch of the chair over the whole record, seeds as named):
     doowop/3   backing   reg 1 -> 0    mean 70.45 -> 58.86  (-11.6)
     mbube/3    voice     reg 0 -> 1    mean 57.81 -> 69.62  (+11.8)
     sacredharp/2 voice4  reg 0 -> -1   mean 56.75 -> 45.25  (-11.5)
     georgian/1 voice     reg 0 -> 1    mean 56.68 -> 68.40  (+11.7)
   A whole octave in each case, and the underlying line barely moved (the means
   differ by a third of a semitone once the octave is taken out): the composer
   round changed a handful of notes under the new qualities and `K.homeFor`
   tipped to the neighbouring octave for those four chairs. Nothing after
   ee8366d touches them — probed at 8bb3fcf, 1bf703b, 7cf0d37 and 04d06e4, all
   four read what ee8366d reads — so this is one round's consequence and not a
   drift.

   THIS IS A RE-DERIVATION, NOT A WEAKENING. The gate's four claims are
   untouched: claim 2 still holds that a chair's own word outranks its row's,
   claim 3 still holds that every one of these lines is written INSIDE its
   throat's compass (fold 0, which is what says the new octave is the honest
   one and not a chair singing out of range), and claim 4 still holds that
   fifteen rows resolve a throat they did not resolve before. Only the twelve
   numbers-and-words this table remembers moved, and only where the seat moved
   them. */
const T4O_PIN = {
  "badakhyal/1":       "lead:tenor:0 vocal:alto:0",
  "badakhyal/2":       "lead:tenor:0 vocal:alto:1",
  "badakhyal/3":       "lead:tenor:-1 vocal:alto:0",
  "benga/1":           "lead:tenor:0 vocal:alto:1 backing:alto:0",
  "benga/2":           "lead:tenor:0 vocal:alto:0",
  "benga/3":           "lead:tenor:0 vocal:alto:0",
  /* GRUNGE JOINED THE VOICED ROWS on 2026-09-06, and it is the fifth note of
     that shift: Paul asked for "slow low vocals", the row named no singer at
     all, and `castOf` was seating whatever the pool had. Its lead is a tenor
     now and the pin says so at all three seeds. */
  "grunge/1":          "lead:tenor:0 vocal:alto:1",
  "grunge/2":          "lead:tenor:0 vocal:alto:0",
  "grunge/3":          "lead:tenor:0 vocal:alto:1 backing:alto:1",
  "chorale/1":         "voice:soprano:1 voice2:alto:1 voice3:tenor:0 voice4:bass:0 vocal:alto:1",
  "chorale/2":         "voice:soprano:1 voice2:alto:1 voice3:tenor:0 voice4:bass:0 vocal:alto:1",
  "chorale/3":         "voice:soprano:1 voice2:alto:1 voice3:tenor:0 voice4:bass:-1 vocal:alto:1",
  "doowop/1":          "stab:countertenor:0 riff:bass:0 lead:countertenor:1 vocal:alto:0 backing:alto:1",
  "doowop/2":          "stab:countertenor:0 riff:bass:-1 lead:countertenor:1 vocal:alto:1 backing:alto:1",
  "doowop/3":          "stab:countertenor:0 riff:bass:-1 lead:countertenor:0 backing:alto:0 vocal:alto:0",
  "francoflemish/1":   "voice:countertenor:1 voice2:countertenor:1 voice3:tenor:0 voice4:bass:0 vocal:alto:1",
  "francoflemish/2":   "voice:countertenor:0 voice2:countertenor:0 voice3:tenor:-1 voice4:bass:-1 vocal:alto:0",
  "francoflemish/3":   "voice:countertenor:0 voice2:countertenor:0 voice3:tenor:-1 voice4:bass:-1 vocal:alto:0",
  "georgian/1":        "voice:countertenor:1 voice2:tenor:0 voice3:bass:-1 vocal:alto:1",
  "georgian/2":        "voice:countertenor:1 voice2:tenor:0 voice3:bass:-1 vocal:alto:1",
  "georgian/3":        "voice:countertenor:1 voice2:tenor:0 voice3:bass:0 vocal:alto:1",
  "hymn/1":            "voice:soprano:1 voice2:tenor:0 voice3:bass:-1 vocal:alto:0",
  "hymn/2":            "voice:soprano:1 voice2:tenor:0 voice3:bass:-1 vocal:alto:0 gregorian:tenor:0",
  "hymn/3":            "voice:soprano:1 voice2:tenor:0 voice3:bass:-1 vocal:alto:0",
  "isorhythm/1":       "voice:countertenor:0 voice2:countertenor:0 voice3:tenor:0 voice4:bass:-1 vocal:alto:0",
  "isorhythm/2":       "voice:countertenor:1 voice2:countertenor:1 voice3:tenor:1 voice4:bass:0 vocal:alto:1",
  "isorhythm/3":       "voice:countertenor:0 voice2:countertenor:0 voice3:tenor:-1 voice4:bass:-1 vocal:alto:0",
  "kizomba/1":         "lead:tenor:0 vocal:alto:0",
  "kizomba/2":         "lead:tenor:0 vocal:alto:0",
  "kizomba/3":         "lead:tenor:0 vocal:alto:0",
  "mbube/1":           "voice:countertenor:0 voice2:tenor:0 voice3:bass:-1 voice4:bass:-1 vocal:alto:1",
  "mbube/2":           "voice:countertenor:1 voice2:tenor:0 voice3:bass:0 voice4:bass:-1 vocal:alto:0",
  "mbube/3":           "voice:countertenor:1 voice2:tenor:0 voice3:bass:-1 voice4:bass:-1 vocal:alto:0",
  "polychoral/1":      "voice:bass:0 voice2:tenor:0 voice3:alto:1 voice4:soprano:1 voice5:bass:0 voice6:tenor:0 voice7:alto:1 voice8:soprano:1",
  "polychoral/2":      "voice:bass:-1 voice2:tenor:0 voice3:alto:0 voice4:soprano:1 voice5:bass:-1 voice6:tenor:0 voice7:alto:0 voice8:soprano:1",
  "polychoral/3":      "voice:bass:-1 voice2:tenor:-1 voice3:alto:0 voice4:soprano:1 voice5:bass:-1 voice6:tenor:-1 voice7:alto:0 voice8:soprano:1",
  "sacredharp/1":      "voice:alto:1 voice2:soprano:1 voice3:tenor:0 voice4:bass:-1 vocal:alto:1",
  "sacredharp/2":      "voice:alto:1 voice2:soprano:1 voice3:tenor:0 voice4:bass:-1 vocal:alto:1",
  "sacredharp/3":      "voice:alto:1 voice2:soprano:1 voice3:tenor:0 voice4:bass:-1 vocal:alto:0",
  "sitcom/1":          "lead:tenor:0 vocal:alto:0",
  "sitcom/2":          "lead:tenor:0 vocal:alto:0",
  "sitcom/3":          "lead:tenor:0 vocal:alto:0 backing:alto:0",
  "softrock/1":        "lead:tenor:0 backing:alto:1",
  "softrock/2":        "lead:tenor:0 vocal:alto:1",
  "softrock/3":        "lead:tenor:0 vocal:alto:1",
  "spirituals/1":      "voice:soprano:1 voice2:alto:1 voice3:tenor:0 voice4:bass:0 vocal:alto:1",
  "spirituals/2":      "voice:soprano:1 voice2:alto:1 voice3:tenor:0 voice4:bass:0 vocal:alto:1",
  "spirituals/3":      "voice:soprano:1 voice2:alto:1 voice3:tenor:0 voice4:bass:-1 vocal:alto:0",
};
  ok("T4o the fifteen voiced rows seat the throats and registers they declare", () => {
    const midiOfHz = (hz) => Math.round(69 + 12 * Math.log2(hz / 440));
    const COMPASS = {};
    for (const dsp of ["voice_lead", "voice_choir"]) {
      const row = ((((NK.voices || {})[dsp] || {}).rows) || [])
        .find((r) => r && r.key === "voice" && r.compass);
      if (!row) continue;
      for (const w of Object.keys(row.compass)) {
        const [lo, hi] = row.compass[w] || [];
        if (lo > 0 && hi > 0) COMPASS[w] = [midiOfHz(lo), midiOfHz(hi)];
      }
    }
    // whose throat a chair is, through the ONE owner — the same call the seat
    // makes. The owner row is the record's basis for its own chairs and the
    // GUEST's own genre after them, which is how precompose seated them.
    const throatsOf = (GEN, gk, doc) => {
      const lines = doc.voices.filter((v) => v.kind === "line");
      const nBase = (GEN[gk] || {}).voices || 0;
      return lines.map((c, i) => {
        const owner = i < nBase ? gk : (GEN[c.name] ? c.name : gk);
        return NI.throatVoiceOf((GEN[owner] || {}).tone || null, owner,
                                c.instrument, (c.cast && c.cast.voice) || null);
      });
    };
    /* THE BASE IS ASKED IN ITS OWN WORDS. `instruments.js` at the pinned base
       has no `throatVoiceOf` — this round is what added it — so the walk is
       written out here exactly as that build performed it (the row's tone, a
       `mouth` on it winning, then the cast throat, then the patch's default),
       which is T4j's own helper. Asking the two sides different questions
       would make claim 4 meaningless. */
    const baseThroats = (gk, doc) => {
      const lines = doc.voices.filter((v) => v.kind === "line");
      const nBase = (B.GENRES[gk] || {}).voices || 0;
      return lines.map((c, i) => {
        const P2 = (B.NI.PATCHES.voice || {})[c.instrument];
        if (!P2) return null;
        const owner = i < nBase ? gk : (B.GENRES[c.name] ? c.name : gk);
        const t = (B.GENRES[owner] || {}).tone || null;
        const M = (t && t.mouth) || (t ? B.NI.throatOf(owner, c.instrument) : null);
        return (M && M.voice) || (t && t.voice) || P2.voice || null;
      });
    };
    // the chair's own notes, in the bars the BOX plays (T4j's own walk)
    const notesOf = (doc, GEN) => {
      const lines = doc.voices.filter((v) => v.kind === "line"), nP = lines.length;
      const per = lines.map(() => []);
      for (let i = 0; i < doc.form.sections.length; i++) {
        const g = D.toGenre(doc, i, GEN), sec = doc.form.sections[i];
        const total = Math.ceil(Math.max(1, sec.bars || g.bars) / g.bars) * g.bars;
        lines.forEach((c, pi) => {
          const evs = K.render(D.toPhrase(doc, D.materialAt(c, sec.id)), g, total);
          for (let v = pi; v < g.voices; v += nP)
            for (const e of evs) if (e.v === v && e.n != null) per[pi].push(e.n);
        });
      }
      return per;
    };
    assert.ok(VOICEROWS.length >= 15,
      "the catalogue lost its per-chair throats: " + VOICEROWS.length + " rows");
    const wrong = [], folded = [], stood = [];
    for (const gk of VOICEROWS) {
      let movedHere = 0;
      for (const s of SEEDS) {
        const md = D.normalize(P.genreToDocument(gk, s));
        const lines = md.voices.filter((v) => v.kind === "line");
        const ws = throatsOf(GENRES, gk, md);
        const per = notesOf(md, GENRES);
        // 1 — the pin, chair by chair
        const got = lines.map((c, i) => ws[i] ? c.name + ":" + ws[i] + ":" + c.cast.reg : null)
                         .filter(Boolean).join(" ");
        const want = T4O_PIN[gk + "/" + s];
        if (got !== want) wrong.push(gk + "/" + s + "\n         got  " + got +
                                     "\n         want " + want);
        // 2 — the row's word is the one that won
        lines.forEach((c, i) => {
          if (i >= ((GENRES[gk] || {}).voices || 0)) return;   // a guest, not this row's
          const said = GENRES[gk].throat(i);
          if (!ws[i] || !NF.isThroat(said)) return;            // not a person, or not named
          if (ws[i] !== said)
            wrong.push(gk + "/" + s + " chair " + i + ": row says " + said +
                       ", the seat sings " + ws[i]);
        });
        // 3 — and each one is written inside that throat's compass
        lines.forEach((c, i) => {
          if (!ws[i] || !per[i].length) return;
          const h = K.homeFor(per[i], COMPASS[ws[i]]);
          if (h !== 0) folded.push(gk + "/" + s + " " + c.name + " (" + h + ")");
        });
        // 4 — and it is DIFFERENT from the base
        if (B) {
          const td = B.D.normalize(B.P.genreToDocument(gk, s));
          const was = baseThroats(gk, td);
          movedHere += ws.filter((w, i) => w && w !== was[i]).length;
        }
      }
      /* …AND A ROW THAT JUST GAINED A THROAT COUNTS AS MOVED even when the
         seat lands on the same word (2026-09-06). This assertion was written
         for the re-seating round, where all fifteen rows had to move or the
         round had done nothing. `grunge` is the first row to JOIN the list:
         it declared no throat at all and `castOf` dealt it one, and the deal
         happened to be the tenor the row now names. The seat did not move and
         the FACT did — a dealt throat is whatever the pool holds that day, a
         declared one is the row's own claim — so the base's silence is the
         measurement here. */
      const gained = B && typeof ((B.GENRES || {})[gk] || {}).throat !== "function";
      if (B && !movedHere && !gained) stood.push(gk);
    }
    assert.deepStrictEqual(wrong.slice(0, 6), [],
      wrong.length + " chairs are not seated where this round says they are");
    assert.deepStrictEqual(folded.slice(0, 6), [],
      folded.length + " chairs are written outside the throat they now sing with");
    /* (THE THIRD CLAUSE IS RETIRED, 2026-09-06, and this is its tombstone.
       It read: every one of the fifteen rows must resolve a DIFFERENT throat
       than the base tree — "a change nobody can measure is a change that is
       not there". That was a true and useful claim for exactly one round, the
       2026-09-05 re-seating, while BASE_SHA still named a commit from before
       it. The pin has since moved twice, and it now names a commit that
       CONTAINS the re-seating, so the clause asks whether a round changed
       something it landed two days ago — it can only ever fail, or pass by
       accident of what else is uncommitted. What survives is what is durable:
       clause 1 pins every chair's throat and register, chair by chair, at
       three seeds, and clause 2 holds the row's own word to the seat it gets.
       `stood` is still computed and printed, because knowing which rows the
       base agrees with is worth reading; it is no longer an assertion.) */
    if (B) console.log("       (base agrees on the throats of: " +
                       (stood.join(" ") || "none") + ")");
    console.log("       (" + VOICEROWS.length + " rows x " + SEEDS.length +
                " seeds: " + VOICEROWS.join(" ") + ")");
  });

  /* T4i — `focus` STILL REACHES NOTHING, and this wave did not invent a
     reader for it. T2e already pins that it moves no event on the score; this
     is the same claim one tier up, where the box actually plays. */
  ok("T4i focus reaches nothing on the rendered path either", () => {
    const doc = D.normalize(P.genreToDocument("reggae", 2));
    const vi = doc.voices.findIndex((v) => v.kind === "line");
    const before = JSON.stringify(barsOf(doc));
    assert.strictEqual(D.putCell(doc, 1, vi, "focus", true), true);
    assert.strictEqual(JSON.stringify(barsOf(doc)), before,
      "focus reached the rendered bars — say what it does and rewrite this test");
    // ...and a row may not claim it: a cell flag has exactly one home.
    assert.strictEqual(D.putRow(doc, 1, "focus", true), false);
  });

  /* T4k — A CELL'S MIX LANE REACHES THE DESK, AS AN OFFSET ON THE ROW'S
     (TABLE.md wave 3, ¶A: "we still want per-section mix automation, with
     per-cell relative to that").

     READ OFF THE UNIT TABLE, which is the artifact the engine is handed:
     `deskUnits` is what audio/plan.js barPlan hands the renderer every bar,
     and `lvl` / `pan` / `rev` / `strip.hi` on a unit are the four numbers a
     cell lane can move. Reading `document.scoreOf` here would prove nothing —
     it is the small half and knows no desk at all — and reading the
     document back would be reading the plan. Same recipe as T4a/T4b.

     THE FOUR CLAIMS, in ¶A's own words:
       · the offset moves the voice it is written on, by the offset it says;
       · in the section it is written in, and in no other;
       · on that voice only, and no other voice of that section;
       · and clearing it puts the record back exactly where it was. */
  ok("T4k a cell mix offset moves that voice in that section only, by the offset", () => {
    const doc = D.normalize(P.genreToDocument("acid", 1));
    /* THE UNIT TABLE, PER BOX. A synthetic unit per seat rather than the
       engine's: `deskUnits` is a pure function of (units, addr, sec) and the
       thing under measurement is what it WRITES, so a flat unit at lvl 1 makes
       every number below a pure reading of the desk's own arithmetic. `addr`
       is voiceRoster's own answer — the same walk audio/plan.js castOf uses to
       build ADDR, and the one desk-gate G2 pins desk-doc.js `channelVoicesOf`
       to, so this is not a second opinion about which chair is which. */
    const unitsOf = (box) => {
      const addr = {}, units = {};
      for (const r of DESK.voiceRoster(box)) {
        addr["v" + r.v] = r.key; units["v" + r.v] = { lvl: 1, dry: 1 };
      }
      units.drums = { drum: true, lvl: 1 };
      const out = DESK.deskUnits(units, addr, box, (x) => x, null);
      const o = {};
      for (const k of Object.keys(units)) {
        const u = out[k];
        o[k] = { lvl: u.lvl, pan: u.pan == null ? null : u.pan, rev: u.rev || 0,
                 hi: (u.strip && u.strip.hi) || 0 };
      }
      return o;
    };
    const read = (d) => boxesFor(d).map(unitsOf);
    const before = read(doc);
    const si = 1, vi = doc.voices.findIndex((v) => v.kind === "line");
    assert.ok(vi >= 0 && doc.form.sections.length > 2,
      "the fixture has no line voice or too few sections to be absent from");
    const key = "v" + vi;                       // roster v === the line ordinal
    const d0 = JSON.stringify(doc);
    assert.strictEqual(
      D.putCell(doc, si, vi, "mixauto",
                { level: "+6", pan: "r", send: "more", cutoff: "darker" }), true);
    /* THE DIFF MOVES ONLY ITS OWN FIELD. One document write, one key — §5's
       "every op is one document write through the existing doors" measured as
       a diff rather than asserted. */
    const d1 = JSON.parse(d0), d2 = JSON.parse(JSON.stringify(doc));
    d1.voices[vi].cells = d2.voices[vi].cells;
    assert.strictEqual(JSON.stringify(d1), JSON.stringify(d2),
      "putCell(mixauto) moved something that is not a cell lane");
    assert.deepStrictEqual(Object.keys(d2.voices[vi].cells[doc.form.sections[si].id]),
      ["mixauto"], "the cell grew a second field");

    const after = read(doc);
    const dB = (a, b) => 20 * Math.log10(b / a);
    const A = before[si][key], B = after[si][key];
    // LEVEL: the desk's own unit gain, in dB, against the same unit unoffset.
    const moved = dB(A.lvl, B.lvl);
    assert.ok(Math.abs(moved - 6) < 0.01,
      "a +6 dB cell offset moved the rendered level " + moved.toFixed(3) + " dB");
    // PAN: cell + row + seat on one line, so an `r` is +0.35 on where it sat.
    assert.ok(Math.abs((B.pan || 0) - ((A.pan || 0) + 0.35)) < 1e-9,
      "pan " + A.pan + " -> " + B.pan + ", want +0.35");
    // SEND: half a step of SENDS onto bus 1, added to what the section sends.
    assert.ok(B.rev > A.rev, "the send did not open: " + A.rev + " -> " + B.rev);
    // CUTOFF: the board's high shelf, which is what darker means here.
    assert.strictEqual(B.hi - A.hi, -3, "darker moved the hi shelf " + (B.hi - A.hi));
    console.log("       acid seed 1, voice " + key + " in section " + si +
      ": level " + moved.toFixed(2) + " dB · pan " + (A.pan || 0) + " -> " + B.pan +
      " · rev " + A.rev.toFixed(3) + " -> " + B.rev.toFixed(3) +
      " · hi shelf " + A.hi + " -> " + B.hi + " dB");

    // ...AND NOWHERE ELSE. Every other section, and every other voice of this
    // one, reads exactly what it read before the cell was written.
    for (let i = 0; i < before.length; i++)
      for (const k of Object.keys(before[i]))
        if (i !== si || k !== key)
          assert.deepStrictEqual(after[i][k], before[i][k],
            "the cell lane leaked onto " + k + " in section " + i);

    // ...AND CLEARING IT PUTS THE RECORD BACK (§2's clear-to-inherit).
    assert.strictEqual(D.putCell(doc, si, vi, "mixauto", null), true);
    assert.deepStrictEqual(read(doc), before, "clearing the cell lane did not restore");
    assert.strictEqual(JSON.stringify(doc), d0, "clearing left something behind");
  });

  /* T4l — AND A ROW LANE AND A CELL OFFSET COMPOSE RATHER THAN REPLACE (¶A's
     "a cell that says nothing rides the section's curve exactly; a cell that
     says +3 dB rides it 3 dB up", and §4's "neither the Live export nor the
     desk may apply a curve twice").

     The row's `level` lane rides the NOTES (audio/desk.js deskAmp, per beat,
     because a `pump` is a per-beat sidechain) and the cell's offset rides the
     UNIT. So the proof that they compose once each is that with both set, the
     note gain is the row's alone and the unit gain is the cell's alone —
     neither number carries the other, and the product is the sum in dB. */
  ok("T4l the row's lane and the cell's offset compose, each applied once", () => {
    const doc = D.normalize(P.genreToDocument("acid", 1));
    const si = 1, vi = doc.voices.findIndex((v) => v.kind === "line");
    assert.strictEqual(D.putRow(doc, si, "mot", "pump"), true);
    const unitLvl = (d) => {
      const box = boxesFor(d)[si];
      const addr = {}, units = {};
      for (const r of DESK.voiceRoster(box)) {
        addr["v" + r.v] = r.key; units["v" + r.v] = { lvl: 1, dry: 1 };
      }
      const amp = DESK.deskAmp(box, addr, (x) => x);
      /* THE NOTE IS SAMPLED AT THE TOP OF THE BEAT, where a `pump` is at its
         DUCK (compileAuto writes [b, 0.32] then [b + 0.85, 1] and laneAt reads
         the curve exponentially between them). MEASURED 2026-09-04: sampling
         mid-beat instead reads 0.6255, which is a real point on a real ramp
         and says nothing about whether the lane is there. */
      return { unit: DESK.deskUnits(units, addr, box, (x) => x, null)["v" + vi].lvl,
               note: amp("v" + vi, 0), top: amp("v" + vi, 0.85) };
    };
    const rowOnly = unitLvl(doc);
    assert.ok(rowOnly.note < 0.5 && rowOnly.top > 0.95,
      "the row's pump is not ducking the notes: " + rowOnly.note + " -> " + rowOnly.top);
    assert.strictEqual(D.putCell(doc, si, vi, "mixauto", { level: "+6" }), true);
    const both = unitLvl(doc);
    // the ROW's curve is untouched by the cell — it is not multiplied in twice
    assert.strictEqual(both.note, rowOnly.note,
      "the cell offset reached the note gain as well as the unit gain — " +
      "that is the same curve applied twice");
    assert.strictEqual(both.top, rowOnly.top, "…at the top of the pump too");
    // ...and the CELL's offset is exactly 6 dB on the unit, whatever the row does
    const d6 = 20 * Math.log10(both.unit / rowOnly.unit);
    assert.ok(Math.abs(d6 - 6) < 0.01, "the cell offset came out " + d6.toFixed(3) + " dB");
    console.log("       a pump row + a +6 cell: the note gain is the row's " +
      rowOnly.note.toFixed(4) + " unchanged, the unit gain is +" + d6.toFixed(2) +
      " dB — one application each");
  });

  /* T4m — THE FIVE §1 MOVED FROM THE BOX TO THE CELL (TABLE.md wave 4).
     One claim per field and all of them at once: a cell word moves ONE key in
     the document, moves THAT chair in THAT section on the RENDERED path and
     nothing else on the record, and clearing it restores the bars byte for
     byte. The claim per field is named separately because "it moved" is not
     the claim — `artic` shortens the notes, `oct` moves the pitch by exactly
     twelve semitones, `scale` changes the pitch CLASSES, `rate` doubles or
     halves the chair's note count in that section, and `clamp` moves nothing
     at all, which is measured and said rather than hoped.

     THE PATH IS ui/derive.js, not `scoreOf`. Four of the five are read inside
     `kernel.js render` and reach both, but the gate reads the one the EAR is
     on, which is the recipe the whole T4 block exists for. */
  ok("T4m each of the five cell words moves that chair in that section and nothing else", () => {
    const base = D.normalize(P.genreToDocument("acid", 1));
    const si = 1, vi = base.voices.findIndex((v) => v.kind === "line");
    const sid = base.form.sections[si].id;
    const before = barsOf(base);
    const linesOfSec = (bars, s, v) => bars[s].filter(
      (e) => e.kind === "line" && e.lv === v)
      .map((e) => [+e.t.toFixed(6), e.n, +e.dur.toFixed(6)].join("/"));
    const wholeRecord = (bars) => JSON.stringify(bars.map((ev) => ev.map(
      (e) => [e.kind, e.lv, +e.t.toFixed(6), e.n,
       e.dur == null ? "" : +e.dur.toFixed(6)].join("/"))));
    const B = wholeRecord(before);
    const rows = [];
    for (const [field, word] of [["artic", "staccato"], ["oct", "1"],
                                 ["rate", "dbl"], ["scale", "whole"],
                                 ["clamp", "0"]]) {
      const doc = clone(base);
      assert.strictEqual(D.putCell(doc, si, vi, field, word), true,
        field + ": the door refused the word");
      // ...ONE KEY IN THE DOCUMENT, which is §5's "every op is one document
      // write" read as a diff rather than as a call count.
      const moved = [];
      /* THE DEEPEST PATH THAT MOVED, and it recurses through ARRAYS too — a
         cell override lives at `voices[vi].cells[secId]`, and a walk that
         stopped at the first array would report `.voices` and call the claim
         proven. */
      const isObj = (x) => !!x && typeof x === "object";
      const walk = (a, b2, at) => {
        if (JSON.stringify(a) === JSON.stringify(b2)) return;
        if (!isObj(a) && !isObj(b2)) { moved.push(at); return; }
        if (isObj(a) && isObj(b2) && Array.isArray(a) !== Array.isArray(b2)) {
          moved.push(at); return;
        }
        const A = isObj(a) ? a : {}, B2 = isObj(b2) ? b2 : {};
        for (const k of new Set([...Object.keys(A), ...Object.keys(B2)]))
          walk(A[k], B2[k], at + "." + k);
      };
      walk(base, doc, "");
      assert.deepStrictEqual(moved, [".voices." + vi + ".cells." + sid + "." + field],
        field + ": the write moved " + moved.length + " keys — " + moved.join(" "));
      const after = barsOf(doc);
      // ...AND ONLY THAT CHAIR IN THAT SECTION on the rendered path.
      const elsewhere = [];
      for (let s = 0; s < after.length; s++)
        for (const v of new Set(after[s].filter((e) => e.kind === "line")
                                        .map((e) => e.lv)))
          if ((s !== si || v !== vi) &&
              linesOfSec(after, s, v).join(",") !== linesOfSec(before, s, v).join(","))
            elsewhere.push("s" + s + "/v" + v);
      assert.deepStrictEqual(elsewhere.slice(0, 6), [],
        field + ": " + elsewhere.length + " other cells moved");
      const mine = linesOfSec(after, si, vi), was = linesOfSec(before, si, vi);
      const nA = after[si].filter((e) => e.kind === "line" && e.lv === vi);
      const nB = before[si].filter((e) => e.kind === "line" && e.lv === vi);
      if (field === "clamp") {
        /* THE ONE THAT MOVES NOTHING, AND IT IS MEASURED HERE RATHER THAN
           ASSUMED: `document.js toPhrase` writes `inc` and `stk` all-zero for
           every motif in every bank, so `kernel.js rampOf`'s raw ramp is zero
           and a limit has nothing to limit. Stored, resolved, drawn as a
           sentence in the cell sheet — `focus`'s treatment, for the same
           reason and with the same promise: the day a ramp column lands in the
           hook editor this assertion fails and the gate names it. */
        assert.strictEqual(mine.join(","), was.join(","),
          "clamp moved a note — the ramp columns have landed, light the control");
        const ramped = Object.keys(base.material.cells).filter((n) => {
          const ph = D.toPhrase(base, n);
          return (ph.inc || []).some(Boolean) || (ph.stk || []).some(Boolean);
        });
        assert.deepStrictEqual(ramped, [], "a document phrase carries a ramp now");
        rows.push("clamp    no note moved (0 of " +
          Object.keys(base.material.cells).length + " phrases carry a ramp)");
      } else assert.notStrictEqual(mine.join(","), was.join(","),
        field + ": the word reached no note — declared and never arriving");
      if (field === "artic") {
        const dA = nA.reduce((a, e) => a + e.dur, 0), dB = nB.reduce((a, e) => a + e.dur, 0);
        assert.ok(dA < dB * 0.7, "staccato did not shorten the notes: " +
          dB.toFixed(2) + " -> " + dA.toFixed(2));
        rows.push("artic    staccato: " + nA.length + " notes, " +
          dB.toFixed(2) + " -> " + dA.toFixed(2) + " steps of sound");
      }
      if (field === "oct") {
        assert.strictEqual(nA.length, nB.length, "an octave changed the note COUNT");
        const off = new Set(nA.map((e, k) => e.n - nB[k].n));
        assert.deepStrictEqual([...off], [12], "+1 moved the line by " + [...off].join(","));
        rows.push("oct      +1: every one of " + nA.length +
                  " notes exactly +12 semitones");
      }
      if (field === "scale") {
        assert.strictEqual(nA.length, nB.length, "an alphabet changed the note COUNT");
        const pcs = (l) => new Set(l.map((e) => ((e.n % 12) + 12) % 12));
        const a = [...pcs(nA)].sort((x, y) => x - y), b2 = [...pcs(nB)].sort((x, y) => x - y);
        assert.notDeepStrictEqual(a, b2, "the pitch classes did not move");
        rows.push("scale    whole tone: pitch classes {" + b2.join(" ") +
                  "} -> {" + a.join(" ") + "}");
      }
      if (field === "rate") {
        assert.strictEqual(nA.length, nB.length * 2,
          "dbl gave " + nA.length + " notes, not twice " + nB.length);
        const dA = nA.reduce((a, e) => a + e.dur, 0), dB = nB.reduce((a, e) => a + e.dur, 0);
        assert.ok(Math.abs(dA - dB) < 1e-6,
          "double time changed the total sounding length: " + dB + " -> " + dA);
        rows.push("rate     dbl: " + nB.length + " -> " + nA.length +
                  " notes, each half as long, same bar");
      }
      // ...AND CLEARING RESTORES THE RECORD BYTE FOR BYTE.
      assert.strictEqual(D.putCell(doc, si, vi, field, null), true,
        field + ": the clear-back did not move the document");
      assert.strictEqual(wholeRecord(barsOf(doc)), B,
        field + ": clearing did not restore the rendered bars");
    }
    for (const r of rows) console.log("       " + r);
  });

  /* T4n — ...AND THE ROW IS THEIR DEFAULT (§1 CELL: "become per cell with the
     row as default"). A word on the ROW reaches EVERY chair of that section
     and no other section, and a cell word on top of it outranks it for that
     chair alone — which is §2's ladder read from the other end. */
  ok("T4n a row word reaches every chair of its section, and a cell outranks it", () => {
    const base = D.normalize(P.genreToDocument("acid", 1));
    const si = 1, vi = base.voices.findIndex((v) => v.kind === "line");
    const before = barsOf(base);
    const pitches = (bars, s, v) => bars[s].filter(
      (e) => e.kind === "line" && e.lv === v).map((e) => e.n).join(",");
    const doc = clone(base);
    assert.strictEqual(D.putRow(doc, si, "oct", "1"), true);
    const rowed = barsOf(doc);
    const voices = [...new Set(before[si].filter((e) => e.kind === "line")
                                         .map((e) => e.lv))];
    assert.ok(voices.length > 1, "acid seats one line; this claim needs two");
    for (const v of voices)
      assert.notStrictEqual(pitches(rowed, si, v), pitches(before, si, v),
        "the row's octave missed chair " + v);
    for (let s = 0; s < before.length; s++) if (s !== si)
      for (const v of voices)
        assert.strictEqual(pitches(rowed, s, v), pitches(before, s, v),
          "the row's octave reached section " + s);
    // ...and the CELL outranks it, for that chair only, and is not ADDED to it
    assert.strictEqual(D.putCell(doc, si, vi, "oct", "-1"), true);
    const both = barsOf(doc);
    const mine = both[si].filter((e) => e.kind === "line" && e.lv === vi);
    const was = before[si].filter((e) => e.kind === "line" && e.lv === vi);
    const off = new Set(mine.map((e, k) => e.n - was[k].n));
    assert.deepStrictEqual([...off], [-12],
      "the cell did not outrank the row: the chair moved by " + [...off].join(","));
    for (const v of voices) if (v !== vi)
      assert.strictEqual(pitches(both, si, v), pitches(rowed, si, v),
        "the cell reached chair " + v);
    console.log("       row oct +1 moved all " + voices.length +
      " chairs of section " + si + " and no other section; a cell −1 on chair " +
      vi + " outranks it (−12, not 0 and not −24)");
  });

  /* T4p — THE PER-CHAIR SEAT IS THE WHOLE-RECORD SEAT (2026-09-05).
     `precompose.reseatVoice` is §7d's arithmetic asked about ONE chair, and it
     exists because the page's `sings as` door has to re-seat a chair a hand has
     just re-throated (ui/eight.js `putCast`). Two things could go wrong and
     both are silent:

       · IT COULD DISAGREE WITH THE PASS. The pass reads which ROW owns a chair
         off `genreToDocument`'s own `nBase`/`layerKeys`; the door has neither
         and reads it off the FINISHED record (basis for its own chairs, the
         guest's name-as-genre-key after them). If those two rules ever parted,
         a record would be re-seated onto a throat nobody sings.
       · IT COULD NOT BE IDEMPOTENT. The door is called on EVERY write of the
         field — including a clear-back — so a seat that moved a chair a second
         time would walk a line off the instrument one tap at a time.

     One measurement answers both, and it is the only one that can: call the
     door on every line chair of a freshly composed record and demand that it
     writes NOTHING. Measured over the whole catalogue at seeds 1-3 — 1,437
     records, 7,448 line chairs, 0 moved. */
  ok("T4p the per-chair seat agrees with the composer's and moves nothing on a seated record", () => {
    const list = FULL ? ANCHORS : ANCHORS.filter((_, i) => i % 12 === 0);
    const seeds = FULL ? SEEDS : [1];
    let docs = 0, chairs = 0, moved = 0; const ex = [];
    for (const gk of list) for (const s of seeds) {
      const doc = D.normalize(P.genreToDocument(gk, s));
      docs++;
      doc.voices.forEach((v, vi) => {
        if (v.kind !== "line") return;
        chairs++;
        const before = (v.cast || {}).reg;
        const k = P.reseatVoice(doc, vi);
        if (k) ex.push(gk + "/" + s + " " + v.name + " " + before + " -> " +
                       v.cast.reg + " (" + k + ")");
        if (k) moved++;
      });
      // ...AND A CHAIR NOBODY SINGS IS UNTOUCHED, which is the other half of
      // "the question has no meaning there": the bass and the kit are not
      // people and neither is a piano.
      doc.voices.forEach((v, vi) => {
        if (v.kind === "line") return;
        assert.strictEqual(P.reseatVoice(doc, vi), 0,
          "the seat moved a " + v.kind + " chair");
      });
    }
    assert.deepStrictEqual(ex.slice(0, 6), [],
      moved + " of " + chairs + " chairs moved on a record the composer " +
      "already seated — the door and the pass disagree");
    console.log("       " + docs + " records, " + chairs +
      " line chairs, 0 re-seated (the door is a no-op on a seated record)");
  });

  /* ================= THE REVIEW'S 4, 6 AND 7 (2026-09-05) ===============
     scratchpad/REVIEW.md, ranked items 4, 6 and 7 — three walls the engine
     could already have gone through and the surface had no word for. Each
     check MEASURES THE RENDERED STREAM (test-the-artifact), never the field
     that was written. */

  /* T4q — AN ENTRY IS BARS AND BEATS. The review: *"`enters at bar` is
     validated Number.isInteger … a pickup, a stretto, an answer on beat 3
     cannot exist."* Three claims, one render each:
       · 0.75 bars delays the chair's first note by three beats of four;
       · a STRETTO — one phrase, two chairs, entries 0 and 0.5 — renders two
         statements that OVERLAP (the review's own measurement law: counting
         a shared onset finds nothing, counting overlap finds the canon);
       · a NEGATIVE entry is refused at the document door and clamped at 0 by
         the kernel, because the walk windows a section at `[from, to)` and
         there is nothing before the first section to hold an anacrusis. */
  ok("T4q an entry of 0.75 bars comes in three beats late, and a stretto overlaps", () => {
    const evsOf = (doc, lv) => D.scoreOf(doc, GENRES).events
      .filter((e) => e.kind === "line" && e.sec === 0 && e.lv === lv)
      .sort((a, b) => a.t - b.t);
    const base = J(Songs.TERMS);
    const lead = base.voices.find((v) => v.kind === "line").name;
    const A = evsOf(base, 0);
    const late = J(base);
    late.voices.find((v) => v.name === lead).cast.entry = 0.75;
    D.normalize(late);
    assert.strictEqual(late.voices.find((v) => v.name === lead).cast.entry, 0.75,
      "normalize dropped a fractional entry");
    const B = evsOf(late, 0);
    const N0 = K.stepsIn({ meter: null });          // sixteen, the bar's grid
    assert.strictEqual(B[0].t - A[0].t, N0 * 0.75,
      "0.75 bars should delay the first note by " + (N0 * 0.75) + " steps");
    console.log("       entry 0.75: first note " + A[0].t + " -> " + B[0].t +
      " step units (" + (N0 * 0.75 / (N0 / 4)) + " beats of four)");

    /* THE STRETTO. Two chairs on ONE phrase, entries 0 and 0.5. */
    const st = J(base);
    const lines = st.voices.filter((v) => v.kind === "line");
    const [a, b] = lines;
    b.material = a.material;
    for (const id of Object.keys(b.development)) b.development[id] = a.development[id];
    b.cast.reg = a.cast.reg; b.cast.part = a.cast.part;
    a.cast.entry = 0; b.cast.entry = 0.5;
    D.normalize(st);
    const X = evsOf(st, 0), Y = evsOf(st, 1);
    assert.ok(X.length && Y.length, "a stretto needs two chairs sounding");
    assert.strictEqual(Y[0].t - X[0].t, N0 * 0.5,
      "the answer should enter half a bar after the subject");
    let ov = 0;
    for (const x of X) for (const y of Y)
      if (y.t < x.t + x.dur - 1e-9 && x.t < y.t + y.dur - 1e-9) ov++;
    assert.ok(ov > 0, "two entries half a bar apart must OVERLAP — " +
      "the exposition abutted instead of overlapping");
    console.log("       stretto: " + X.length + " + " + Y.length +
      " notes, " + ov + " overlapping pairs, answer " + (Y[0].t - X[0].t) +
      " steps after the subject");

    /* THE PICKUP, AND IT EXISTS NOW (2026-09-05, the review's item 9). This
       half of the gate asserted the REFUSAL — *"a negative entry must not be
       stored"* — with the tombstone naming what would lift it: *"what a
       lead-in channel would take is written down."* Item 9 built the channel
       (`ui/derive.js sectionEvents` returns `lead`, `songBars` puts it in the
       previous box's last bar or in a lead-in bar of the record's own), so a
       negative entry is stored, down to ONE BAR, and the kernel starts the
       chair's loop a statement early. T4u measures where it lands on the page;
       what is measured here is the door and the kernel. */
    const back = J(base);
    back.voices.find((v) => v.name === lead).cast.entry = -0.25;
    D.normalize(back);
    assert.strictEqual(back.voices.find((v) => v.name === lead).cast.entry, -0.25,
      "a pickup of a quarter bar must survive the door");
    const C = evsOf(back, 0);
    assert.ok(C[0].t < 0,
      "the pickup must sound BEFORE the section's own zero, not at it");
    assert.ok(Math.abs((A[0].t - C[0].t) - N0 * 0.25) < 0.5,
      "a quarter-bar pickup comes a quarter bar early");
    const deep = J(base);
    deep.voices.find((v) => v.name === lead).cast.entry = -2;
    D.normalize(deep);
    assert.strictEqual(deep.voices.find((v) => v.name === lead).cast.entry,
      undefined, "a chair entering two bars early is a chair in the previous " +
      "section, not an anacrusis — the door must refuse it");
    console.log("       pickup: entry -0.25 puts the first note at " +
      C[0].t.toFixed(2) + " steps, before the section's own zero (" +
      A[0].t.toFixed(2) + "); one bar is the ceiling and -2 is refused");
  });

  /* T4r — ACCENT AND ARTICULATION PER NOTE (review item 6). The `acc` vector
     was written by nobody and `art` did not exist; both are measured on the
     RENDERED events and on what the .mid writer makes of them. */
  ok("T4r an accent lifts the velocity and a mark changes the note's length", () => {
    const SCORE = require(path.join(ROOT, "nukernel", "export", "score.js"));
    const base = J(Songs.TERMS);
    const cellName = Object.keys(base.material.cells)[0];
    const sid = base.form.sections[0].id;
    const vi = base.voices.findIndex((v) => v.kind === "line");
    const evsOf = (doc) => D.scoreOf(doc, GENRES).events
      .filter((e) => e.kind === "line" && e.sec === 0 && e.lv === 0)
      .sort((a, b) => a.t - b.t);
    const at = (L, i) => L.find((e) => Math.abs(e.t - i) < 0.4);
    const mk = (f) => { const d = J(base); f(d); D.normalize(d); return d; };

    /* THE ACCENT. x1.15 at the engine (audio/to-engine.js ACCENT_LIFT, the
       one owner) and the same 1.15 on the way into the file. */
    const A = evsOf(base);
    const acc = evsOf(mk((d) => { const H = d.material.cells[cellName];
      H.acc = H.deg.map(() => 0); H.acc[0] = 1; }));
    assert.strictEqual(at(A, 0).acc, 0, "the fixture should start unaccented");
    assert.strictEqual(at(acc, 0).acc, 1, "the accent did not reach the event");
    const v0 = SCORE.velOfWritten(at(A, 0).vel, at(A, 0).acc);
    const v1 = SCORE.velOfWritten(at(acc, 0).vel, at(acc, 0).acc);
    assert.ok(v1 > v0, "the .mid velocity did not move");
    assert.strictEqual(v1, Math.max(1, Math.min(127,
      Math.round(at(acc, 0).vel / 9 * SCORE.VEL_TOP * SCORE.ACCENT_LIFT))),
      "the .mid velocity is not the written value x ACCENT_LIFT");
    console.log("       accent: .mid velocity " + v0 + " -> " + v1 +
      ", engine amp x" + SCORE.ACCENT_LIFT);

    /* THE MARKS, AGAINST A CHAIR TOLD STACCATO — which is the case that
       proves the mark OUTRANKS the chair's word rather than agreeing with
       it by luck. Step 10 of the psalm has no written hold; step 12 has. */
    const stac = mk((d) => {
      d.voices[vi].cells = { [sid]: { artic: "staccato" } }; });
    const S = evsOf(stac);
    const M = evsOf(mk((d) => {
      d.voices[vi].cells = { [sid]: { artic: "staccato" } };
      const H = d.material.cells[cellName];
      H.art = H.deg.map(() => 0); H.art[10] = 2; H.art[12] = 1; }));
    assert.ok(at(M, 10).dur > at(S, 10).dur,
      "a tenuto must lengthen a staccato chair's note");
    assert.strictEqual(at(M, 10).dur, 1, "a tenuto is the WHOLE step");
    assert.strictEqual(at(M, 12).dur, at(S, 12).dur / 2 * 1,
      "a staccato step should be half the length");
    console.log("       marks (a chair told staccato): tenuto " +
      at(S, 10).dur + " -> " + at(M, 10).dur + " steps; staccato " +
      at(S, 12).dur + " -> " + at(M, 12).dur + " steps");

    /* A STACCATO OUTRANKS A WRITTEN HOLD, because a hold is the note's VALUE
       and a mark is how much of it sounds. */
    const held = evsOf(mk((d) => { const H = d.material.cells[cellName];
      H.art = H.deg.map(() => 0); H.art[0] = 1; }));
    assert.strictEqual(held.find((e) => e.t === 0).dur,
      A.find((e) => e.t === 0).dur / 2,
      "a staccato on a held note must halve it");
  });

  /* T4s — A CHROMATIC CHANNEL (review item 7). One flag, one semitone,
     measured in the rendered pitch and printed as an accidental. */
  ok("T4s an accidental moves one step by exactly one semitone", () => {
    const base = J(Songs.TERMS);
    const cellName = Object.keys(base.material.cells)[0];
    const evsOf = (doc) => D.scoreOf(doc, GENRES).events
      .filter((e) => e.kind === "line" && e.sec === 0 && e.lv === 0)
      .sort((a, b) => a.t - b.t);
    const A = evsOf(base);
    for (const k of [1, -1]) {
      const d = J(base); const H = d.material.cells[cellName];
      H.alt = H.deg.map(() => 0); H.alt[0] = k;
      D.normalize(d);
      const B = evsOf(d);
      assert.strictEqual(B.length, A.length, "an accidental added or lost a note");
      /* THE MARK IS ON A STEP OF THE PHRASE, AND A PHRASE LOOPS. The cell is
         sixteen steps and the section is four bars, so step 0 sounds four
         times and every one of them carries the accidental — which is what a
         mark on a repeating figure means, and is why this walks the STEP
         rather than the event index. (The onsets are the humanised ones —
         swing, groove and the tape's drift are all in `t` — so the step is
         read by rounding, exactly as ui/eight.js `scoreParts` reads it.) */
      const N0 = A.length ? K.stepsIn({ meter: null }) : 16;
      let hit = 0;
      for (let i = 0; i < A.length; i++) {
        const step = ((Math.round(A[i].t) % N0) + N0) % N0;
        if (step === 0) { hit++;
          assert.strictEqual(B[i].n - A[i].n, k,
            "the marked step should move exactly " + k + " semitone"); }
        else assert.strictEqual(B[i].n, A[i].n,
          "an accidental moved a note it was not on (step " + step + ")");
      }
      assert.ok(hit > 0, "the marked step never sounded");
      if (k === 1) console.log("       accidental: " + hit + " soundings of " +
        "the marked step move " + A[0].n + " -> " + (A[0].n + 1) +
        " (and " + (A[0].n - 1) + " flat); the other " + (A.length - hit) +
        " notes do not move");
    }
  });

  /* T4t — INDEPENDENT PHRASE LENGTHS PER VOICE (review item 8). The review:
     *"All four lines must be the same length … a three-bar ostinato under a
     four-bar tune is not writable."* Three claims:
       · the document KEEPS two lengths (normalize does not flatten them) and
         the compiled genre stamps `cellBars` — the reference the chord
         schedule is aligned to — only when they disagree;
       · each chair loops on ITS OWN period inside one section: a 2-bar phrase
         states itself twice under a 4-bar section, a 4-bar phrase once, and
         the SECTION'S END cuts whatever is still running (read off the real
         `ui/derive.js` walk, which is the one that windows a box);
       · the chord under both chairs is the SAME chord in the same bar, which
         is what `cellBars` buys and the reason the old invariant existed. */
  ok("T4t two chairs with 2- and 4-bar phrases render their own periods", () => {
    const SPB = K.stepsIn({ meter: null });            // sixteen
    /* the fixture: TERMS with the two line chairs' cells grown, both singing
       in the FIRST section (the schola is written `out` there) */
    /* EACH ADDED MEASURE IS THE FIRST ONE A DEGREE HIGHER, so a phrase's own
       length is READABLE in what it plays: a 4-bar phrase whose bars 3-4 are
       its bars 1-2 again would be indistinguishable from a 2-bar phrase
       looping, and this gate would pass on a bug. */
    const grow = (H, times) => {
      for (const k of ["deg", "oct", "vel", "inc", "stk", "gate", "acc", "sld",
                       "play", "hold", "art", "alt"]) {
        if (!Array.isArray(H[k])) continue;
        const src = H[k].slice();
        for (let r = 1; r < times; r++)
          H[k] = H[k].concat(k === "deg" ? src.map((x) => x + r) : src);
      }
    };
    const mk = (a, b) => {
      const d = J(Songs.TERMS);
      const [v0, v1] = d.voices.filter((v) => v.kind === "line");
      grow(d.material.cells[v0.material], a);
      grow(d.material.cells[v1.material], b);
      // …and every OTHER cell in the bank to the first chair's length, so the
      // "same" fixture really is one length and the mixed one really is two
      for (const n of Object.keys(d.material.cells)) {
        const c = d.material.cells[n];
        if (!c || c.kind === "drum" || !c.deg) continue;
        if (n !== v0.material && n !== v1.material) grow(c, a);
      }
      for (const id of Object.keys(v1.development)) v1.development[id] = "as written";
      d.form.sections[0].bars = 4;
      return D.normalize(d);
    };
    const mixed = mk(2, 4), same = mk(2, 2);
    const cellOf = (d, i) => d.material.cells[
      d.voices.filter((v) => v.kind === "line")[i].material];
    assert.strictEqual(cellOf(mixed, 0).deg.length, 2 * SPB, "the 2-bar cell was flattened");
    assert.strictEqual(cellOf(mixed, 1).deg.length, 4 * SPB, "the 4-bar cell was flattened");
    const gm = D.toGenre(mixed, 0, GENRES), gs = D.toGenre(same, 0, GENRES);
    assert.strictEqual(gm.cellBars, 4, "the reference length was not stamped");
    assert.ok(!("cellBars" in gs),
      "a document whose cells agree must stamp NO reference length (absent is today)");

    /* THE RENDERED PERIODS, off the page's own walk. `sectionEvents` windows
       the box at its own length, which is the section's end doing the cutting. */
    const evsFor = (doc) => {
      const slots = slotsFor(doc), boxes = boxesFor(doc);
      const ev = DER.sectionEvents(boxes[0], slots, doc.time.groove, doc.time.swing).ev;
      /* THE ONSET AND THE NOTE, because a period is a claim about the MUSIC:
         two bars with the same rhythm and different pitches are two bars. */
      return [0, 1].map((lv) => ev.filter((e) => e.kind === "line" && e.lv === lv)
        .map((e) => ({ t: Math.round(e.t), n: e.n })).sort((x, y) => x.t - y.t));
    };
    const [A, B] = evsFor(mixed);
    assert.ok(A.length && B.length, "both chairs must sound");
    const span = 4 * SPB;
    assert.ok(Math.max(...A.map((e) => e.t), ...B.map((e) => e.t)) < span,
      "the section's end must cut: an onset landed past bar 4");
    /* A STATES ITSELF TWICE, B ONCE — read as the onset SET repeating at the
       phrase's own length and not at the other chair's. */
    const setOf = (L, from, to) => L.filter((e) => e.t >= from && e.t < to)
      .map((e) => (e.t - from) + ":" + e.n).join(",");
    assert.strictEqual(setOf(A, 0, 2 * SPB), setOf(A, 2 * SPB, 4 * SPB),
      "the 2-bar phrase did not restate itself in bars 3-4");
    assert.notStrictEqual(setOf(B, 0, 2 * SPB), setOf(B, 2 * SPB, 4 * SPB),
      "the 4-bar phrase repeated at two bars — it is not playing its own period");
    console.log("       periods: the 2-bar chair states " + A.length +
      " notes as two statements, the 4-bar chair " + B.length + " as one, " +
      "both cut at bar 4 (" + span + " steps)");

    /* AND THE HARMONY IS SHARED. Under a chord cycle two chairs must take the
       SAME chord in the same bar; without `cellBars` a short phrase takes a new
       chord every time it comes round, which is twice as often as a phrase
       twice its length. Measured on the kernel directly, which is where the
       one site is: the same one-bar phrase under the same chart, rendered with
       and without the reference length. */
    const cyc = J(mixed);
    cyc.alphabet.harmony = "cycle";
    cyc.alphabet.prog = [{ d: 0 }, { d: 3 }, { d: 4 }, { d: 5 }];
    D.normalize(cyc);
    const gc = D.toGenre(cyc, 0, GENRES);
    const one = D.toPhrase(cyc, Object.keys(cyc.material.cells)[0]);
    one.deg = one.deg.slice(0, SPB); one.gate = one.gate.slice(0, SPB);
    for (const k of ["oct", "vel", "inc", "stk", "acc", "sld"])
      if (Array.isArray(one[k])) one[k] = one[k].slice(0, SPB);
    const perBar = (g2) => {
      const E = K.render(one, g2, 4).filter((e) => e.v === 0);
      return [0, 1, 2, 3].map((b) => {
        const inB = E.filter((e) => e.t >= b * SPB && e.t < (b + 1) * SPB);
        return inB.length ? Math.min(...inB.map((e) => e.n)) : null;
      });
    };
    const loose = { ...gc }; delete loose.cellBars;      // today's law
    const tied = { ...gc, cellBars: 4 };                 // a 4-bar chair beside it
    const L = perBar(loose), T = perBar(tied);
    assert.ok(new Set(L).size > 1,
      "the chart must move the line bar to bar when the phrase IS the bar");
    assert.strictEqual(new Set(T).size, 1,
      "against a 4-bar reference the one-bar phrase must hold ONE chord for " +
      "four bars — it took " + JSON.stringify(T));
    console.log("       shared chart: a 1-bar phrase alone walks " +
      JSON.stringify(L) + "; beside a 4-bar chair it holds " +
      JSON.stringify(T) + " — one chord per reference phrase for both");
  });

  /* T4u — A FORM GRAMMAR (review item 9). *"Fifteen section roles and no way
     to say 'play it twice with a different last bar'."* Four claims, each read
     off `songBars` — the page's own walk from boxes to BARS, which is what the
     transport plays and what the exports unroll:
       · a section repeated x2 renders two statements of the same bars;
       · with a second ending, the two statements' LAST bars differ, because
         the last one stops short and the ending section plays in its place;
       · a coda plays ONCE, at the end, and the jump skips what lies between;
       · a pickup of one beat lands BEFORE the first bar — the record's first
         note is before beat 1, which is what a lead-in channel is for. */
  /* (async because claim 5 imports the engraver, which is an ES module. `ok`
     takes the promise's own failure through the same counter — a rejected
     body would otherwise pass silently, so it is awaited here rather than
     fired and forgotten.) */
  const ABC = await import(path.join(ROOT, "nukernel", "ui", "abc.js"));
  ok("T4u a repeat, a second ending, a coda and a pickup", () => {
    const walkOf = (doc) => DER.songBars(boxesFor(doc), slotsFor(doc),
      doc.time.groove, doc.time.swing, null, { pickups: false, rubato: false });
    const base = J(Songs.TERMS);
    const plain = walkOf(D.normalize(J(base)));
    const barsIn = (W, si) => W.filter((b) => b.si === si).length;

    /* 1 · THE REPEAT. The document keeps ONE section (the walk plays it
       twice), which is the whole point — a duplicated section is two sections
       to edit. */
    const rep = J(base); rep.form.sections[0].repeat = 2; D.normalize(rep);
    assert.strictEqual(rep.form.sections.length, base.form.sections.length,
      "a repeat must not duplicate the section in the document");
    const W2 = walkOf(rep);
    assert.strictEqual(barsIn(W2, 0), 2 * barsIn(plain, 0),
      "a section repeated x2 must render twice its bars");
    const sig = (b) => b.ev.map((e) => Math.round(e.off * 100) / 100 + ":" +
      (e.n == null ? e.d || "" : e.n)).join(",");
    const R = W2.filter((b) => b.si === 0), half = R.length / 2;
    assert.strictEqual(sig(R[0]), sig(R[half]),
      "the second statement must be the same music as the first");

    /* 2 · THE SECOND ENDING. A section of its own, marked `ending`, playing in
       place of the last bar(s) of the LAST repeat. */
    const alt = J(base);
    alt.form.sections[0].repeat = 2;
    alt.form.sections[1].ending = true;
    alt.form.sections[1].bars = 1;
    D.normalize(alt);
    assert.strictEqual(alt.form.sections[1].ending, true,
      "the ending was refused at the door");
    const W3 = walkOf(alt);
    const S0 = W3.filter((b) => b.si === 0), S1 = W3.filter((b) => b.si === 1);
    assert.strictEqual(S0.length, 2 * barsIn(plain, 0) - 1,
      "the last statement must stop one bar short for the ending");
    assert.strictEqual(S1.length, 1, "the ending is one bar, played once");
    const first = S0[barsIn(plain, 0) - 1];           // the FIRST ending's bar
    assert.notStrictEqual(sig(first), sig(S1[0]),
      "the two endings must not be the same bar of music");
    console.log("       repeat + ending: " + barsIn(plain, 0) + " bars x2 = " +
      S0.length + " played + a " + S1.length + "-bar second ending; " +
      "statement 1 ends " + (sig(first) ? "on its own bar" : "empty") +
      " and statement 2 on the alternative");

    /* 3 · THE CODA, and the jump. */
    const cod = J(base);
    cod.form.sections[cod.form.sections.length - 1].coda = true;
    cod.form.sections[0].repeat = 2;
    cod.form.sections[0].tocoda = true;
    D.normalize(cod);
    const W4 = walkOf(cod), last = cod.form.sections.length - 1;
    assert.ok(W4.length, "the walk went silent");
    assert.strictEqual(W4[W4.length - 1].si, last, "the coda must be last");
    assert.strictEqual(barsIn(W4, last), barsIn(plain, last),
      "the coda plays once, whole");
    for (let i = 1; i < last; i++)
      assert.strictEqual(barsIn(W4, i), 0,
        "section " + i + " is between the jump and the coda and must not play");
    console.log("       coda: the walk plays " +
      [...new Set(W4.map((b) => b.si))].join(",") +
      " — the repeat, then the coda, and " + (last - 1) + " sections jumped");

    /* 4 · THE PICKUP. A beat before bar one, on the record's own first
       section, which is where there is no previous bar to borrow. */
    const pu = J(base);
    pu.voices.find((v) => v.kind === "line").cast.entry = -0.25;
    D.normalize(pu);
    assert.strictEqual(pu.voices.find((v) => v.kind === "line").cast.entry, -0.25,
      "a pickup must survive the door now (it was refused before item 9)");
    const W5 = walkOf(pu);
    assert.ok(W5[0].lead, "the record must grow a lead-in bar");
    assert.ok(W5[0].ev.length, "the lead-in bar is empty — nothing led in");
    assert.strictEqual(W5.length, plain.length + 1,
      "the lead-in bar is ONE bar and the record is otherwise unchanged");
    const off0 = Math.min(...W5[0].ev.map((e) => e.off));
    assert.ok(off0 >= W5[0].barSteps * 0.5 && off0 < W5[0].barSteps,
      "a quarter-bar pickup sounds in the last quarter of the lead-in bar");
    /* AND THE SAME FACT ON THE NODE WALK, where a record has an absolute
       zero: the first note is BEFORE it. */
    const sc = D.scoreOf(pu, GENRES).events.filter((e) => e.kind === "line");
    const t0 = Math.min(...sc.map((e) => e.t));
    assert.ok(t0 < 0, "the record's first note must be before beat 1");
    console.log("       pickup: a lead-in bar with " + W5[0].ev.length +
      " notes at step " + off0.toFixed(2) + " of " + W5[0].barSteps +
      "; the record's first note is at " + t0.toFixed(2) + " steps (before 0)");

    /* 5 · THE MARKS ON THE PAPER. `ui/abc.js` is the engraver and `opts.form`
       is the form in bar numbers; the score stays AS WRITTEN (one statement
       per section) so a repeat is a sign and not eight bars. */
    const one = { name: "v", phrase: { deg: [0, 0, 0, 0], oct: [0, 0, 0, 0],
      vel: [5, 5, 5, 5], gate: [1, 1, 1, 1] } };
    const marked = ABC.toScore([one], { stepsPerBar: 1, close: "|]",
      form: { open: new Set([0]), close: new Set([2]), times: new Map([[0, 3]]),
              volta: new Map([[2, 1], [3, 2]]), coda: new Set([3]),
              tocoda: new Set([1]) } }).abc;
    for (const [mark, why] of [["|:", "the repeat's open"],
                               [":|", "the repeat's close"],
                               ["[1", "the first ending"],
                               ["[2", "the second ending"],
                               ["!coda!", "the coda sign"],
                               ["To Coda", "the jump"],
                               ["x3", "the number of times"]])
      assert.ok(marked.includes(mark), "the score does not print " + why);
    const bare = ABC.toScore([one], { stepsPerBar: 1, close: "|]" }).abc;
    assert.ok(!bare.includes("|:") && !bare.includes("[1"),
      "a record with no form must engrave no repeat marks");
    console.log("       score: " + marked.split("\n").pop().trim());

    /* 6 · ABSENT IS TODAY. A record that says none of the four walks the bar
       list it always did — the same claim T2 holds on the catalogue, said
       here on the fixture so this gate carries its own control. */
    /* (the SHAPE of the bar list, not the genre object hanging off every bar:
       `boxesFor` registers a fresh genre per call and its `__v` counter moves,
       which is a fact about the harness and not about the music.) */
    const shape = (W) => W.map((b) => b.si + "/" + (b.first ? "1" : "0") +
      (b.lead ? "L" : "") + ":" + b.barSteps + ":" + sig(b)).join("|");
    assert.strictEqual(shape(walkOf(D.normalize(J(base)))), shape(plain),
      "a record with no form words moved");
  });

  /* T4v — THE KOTEKAN, AGAINST THE OTHER CHAIR (the review's gamelan attempt).
     *"Measured on the shipped row, the interlock is exact in ONE BAR IN FOUR:
     the complement is taken against the phrase AS WRITTEN, and the other
     voice's rotate(2) and fill(2) move out from under it — shared onsets by
     bar: [], [1,7,10], [1,5,7,13,15], [1,5,7,10,13,15]."* `complementOf(0)`
     takes it against what chair 0 IS PLAYING, bar by bar, its own word and its
     own period included. Read off the rendered events, on the shipped row. */
  ok("T4v the gamelan's two chairs share no onset in any bar", () => {
    const g = GENRES.gamelan;
    assert.strictEqual(g.harmony, "modal", "the row changed under this gate");
    const subj = Songs.blank ? Songs.blank(16) : N("song.js").blank(16);
    subj.gate = [1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0];
    subj.deg = subj.deg.map((_, i) => i % 5);
    const ev = K.render(subj, g, 4);
    const steps = K.stepsIn(g);
    const onsets = (v) => {
      const out = [[], [], [], []];
      for (const e of ev) if (e.v === v) {
        const b = Math.floor(e.t / steps);
        if (out[b]) out[b].push(Math.round(e.t) % steps);
      }
      return out.map((a) => [...new Set(a)].sort((x, y) => x - y));
    };
    const A = onsets(0), B = onsets(1);
    const shared = A.map((a, i) => a.filter((x) => B[i].includes(x)));
    const sounding = B.filter((b) => b.length).length;
    assert.ok(sounding >= 2, "the interlocking chair never sounds");
    assert.deepStrictEqual(shared.map((x) => x.length), [0, 0, 0, 0],
      "the two chairs must never land on the same step: " + JSON.stringify(shared));
    console.log("       kotekan: chair 0 " + JSON.stringify(A) +
      "\n                chair 1 " + JSON.stringify(B) +
      "\n                shared  " + JSON.stringify(shared) +
      " (the review measured [], [1,7,10], [1,5,7,13,15], [1,5,7,10,13,15])");
  });

  /* T4w — `harmony: "emergent"`, MEASURED AND KEPT. The review: *"the fugue
     row's emergent harmony is INAUDIBLE — byte-identical event streams either
     way."* True, and the reason is that nothing on those rows consumes the
     roots. The word is not retired because a hand can add the consumer in one
     tap: with a pad chair, eight of the eleven move. This gate holds BOTH
     halves, so neither can rot into a claim nobody checks. */
  ok("T4w emergent is inert where no chair voices a chord, and live where one does", () => {
    const rows = ANCHORS.filter((k) => (GENRES[k] || {}).harmony === "emergent");
    assert.ok(rows.length >= 10, "the emergent rows went missing");
    const subj = N("song.js").blank(16);
    subj.gate = [1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0];
    subj.deg = subj.deg.map((_, i) => ((i * 3) % 7) - 3);
    const same = (g, h) => JSON.stringify(K.render(subj, g, 4)) ===
                           JSON.stringify(K.render(subj, { ...g, harmony: h }, 4));
    const withPad = (g, h) => ({ ...g, harmony: h, voices: g.voices + 1,
      realize: (v) => (v === g.voices ? "pad" : g.realize(v)),
      word: (v, s2) => (v === g.voices ? [] : g.word(v, s2)),
      reg: (v) => (v === g.voices ? 0 : g.reg(v)),
      entry: (v) => (v === g.voices ? 0 : g.entry(v)),
      /* `part` is a FUNCTION on some rows and an ARRAY on others (kernel.js
         `castAs` reads both), so the added chair is spliced through the same
         two readings rather than through one of them. */
      part: g.part
        ? (typeof g.part === "function"
            ? (v) => (v === g.voices ? "pad" : g.part(v))
            : [...g.part, "pad"])
        : undefined });
    const inert = [], live = [], wakes = [], asleep = [];
    for (const k of rows) {
      const g = GENRES[k];
      (same(g, "modal") ? inert : live).push(k);
      if (!same(g, "modal")) continue;
      const a = JSON.stringify(K.render(subj, withPad(g, "emergent"), 4));
      const b = JSON.stringify(K.render(subj, withPad(g, "modal"), 4));
      (a === b ? asleep : wakes).push(k);
    }
    assert.ok(wakes.length >= 6,
      "the word must reach the sound the moment a chair voices a chord — " +
      "only " + wakes.length + " of " + inert.length + " woke up");
    console.log("       emergent: " + rows.length + " rows, " + inert.length +
      " render exactly as modal as shipped (" + live.length + " move already); " +
      "with ONE pad chair added, " + wakes.length + " of them move: " +
      wakes.join(" ") + (asleep.length
        ? " — and " + asleep.join(" ") + " still do not, because their own " +
          "words never transpose and a root computed off a voice that does " +
          "not move does not move" : ""));
  });

  /* T4x — A LANE YOU CAN DRAW (review item 10). *"The cell's four mix lanes
     offer four fixed offsets each. There is no breakpoint, no start value, no
     end value, no curve … A DAW gives you a line you drag."* A drawn level
     lane from −6 dB at bar 0 to +6 dB at bar 4 on ONE cell, read off the DESK
     bar by bar — the same `deskUnits` walk the transport hands the engine — and
     nothing else may move. */
  /* (the export walk is an ES module, imported once beside the engraver) */
  const LD = await import(path.join(ROOT, "nukernel", "export", "live-devices.js"));
  ok("T4x a drawn level lane ramps that voice through the section, and nothing else", () => {
    const doc = D.normalize(P.genreToDocument("acid", 1));
    const si = 1, vi = doc.voices.findIndex((v) => v.kind === "line");
    const sec = doc.form.sections[si];
    const bars = Math.max(2, sec.bars | 0);
    const key = "v" + vi;
    /* the desk, asked at a BAR — `deskUnits` samples the lanes at
       `boxBeatOf(0)`, so the bar is handed in as that beat. */
    const unitsAt = (box, bar) => {
      const addr = {}, units = {};
      for (const r of DESK.voiceRoster(box)) {
        addr["v" + r.v] = r.key; units["v" + r.v] = { lvl: 1, dry: 1 };
      }
      const bpb = 4 / ((GENRES[box.stack[0].g] || {}).rate || 1);
      const out = DESK.deskUnits(units, addr, box, () => bar * bpb, null);
      const o = {};
      for (const k of Object.keys(units)) o[k] = out[k].lvl;
      return o;
    };
    const read = (d) => boxesFor(d).map((b, i) =>
      Array.from({ length: bars }, (_, bar) => unitsAt(b, bar)));
    const before = read(doc);
    assert.strictEqual(D.putCell(doc, si, vi, "mixauto",
      { level: { points: [[0, -6], [4, 6]] } }), true);
    const stored = doc.voices[vi].cells[sec.id].mixauto.level;
    assert.ok(stored && Array.isArray(stored.points),
      "the drawn lane was refused at the door");
    assert.deepStrictEqual(stored.points, [[0, -6], [4, 6]],
      "the door moved the points");
    const after = read(doc);
    /* THE RAMP. Bar by bar, the same chair's gain climbs, and the ends are the
       dB the hand drew: −6 at bar 0 and, four bars later, +6. */
    const dB = (a, b) => 20 * Math.log10(b / a);
    const ramp = after[si].map((u, bar) => dB(before[si][bar][key], u[key]));
    for (let b = 1; b < bars; b++)
      assert.ok(ramp[b] > ramp[b - 1] + 0.5,
        "the gain must climb bar to bar: " + JSON.stringify(ramp.map((x) => +x.toFixed(2))));
    assert.ok(Math.abs(ramp[0] + 6) < 0.05,
      "bar 0 must be the −6 dB the hand drew, not " + ramp[0].toFixed(2));
    const perBar = (ramp[bars - 1] - ramp[0]) / (bars - 1);
    assert.ok(Math.abs(perBar - 3) < 0.05,
      "a −6→+6 line over four bars is 3 dB a bar, not " + perBar.toFixed(2));
    /* AND NOTHING ELSE MOVED — not another chair in this section, not this
       chair in another one. */
    for (let i = 0; i < before.length; i++)
      for (let bar = 0; bar < bars; bar++)
        for (const k of Object.keys(before[i][bar]))
          if (!(i === si && k === key))
            assert.strictEqual(after[i][bar][k], before[i][bar][k],
              "a drawn lane moved " + k + " in section " + i + " bar " + bar);
    console.log("       drawn lane: " +
      ramp.map((x) => (x > 0 ? "+" : "") + x.toFixed(2)).join(" → ") +
      " dB across " + bars + " bars, " + perBar.toFixed(2) +
      " dB a bar; every other chair and section unmoved");

    /* THE EXPORT WRITES THE RAMP. `export/live-devices.js laneEvents` is the
       one walk both the .als envelope writer and this gate go through, and the
       cell's drawn lane rides in the `map` — which is handed the TIME now, so
       an offset that is itself a curve lands on the right breakpoint. */
    const pts = stored.points;
    const base = { curve: "lin", points: pts.map(([x]) => [x, 1]) };
    const evs = LD.laneEvents(base, 0, 4, (x, t) => {
      const i2 = pts.findIndex((p) => p[0] >= t);
      const [x1, y1] = pts[Math.max(0, i2)], [x0, y0] = pts[Math.max(0, i2 - 1)];
      const k = x1 > x0 ? (t - x0) / (x1 - x0) : 1;
      return x * Math.pow(10, (y0 + (y1 - y0) * k) / 20);
    });
    assert.ok(evs.length >= 2, "the exported envelope has no breakpoints");
    assert.ok(evs[evs.length - 1].value > evs[0].value * 3,
      "the exported envelope does not ramp: " +
      JSON.stringify(evs.map((e) => +e.value.toFixed(3))));
    console.log("       exported envelope: " +
      evs.map((e) => e.time + "→" + e.value.toFixed(3)).join(", "));
  });

  console.log("\n" + pass + " passed, " + fail + " failed" +
              (skipped ? ", " + skipped + " skipped (--only=" + ONLY + ")" : ""));
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.log("  FAIL the rendered-path block threw\n       " + (e && e.stack || e));
  console.log("\n" + pass + " passed, " + (fail + 1) + " failed");
  process.exit(1);
});
