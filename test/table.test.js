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
const NC = N("compose.js"), Songs = N("songs.js");
const { GENRES } = NG;

let pass = 0, fail = 0;
const ok = (name, fn) => {
  try { fn(); pass++; console.log("  ok   " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); }
};
const J = (x) => JSON.parse(JSON.stringify(x));
const ANCHORS = P.anchors();
const SEEDS = [1, 2, 3];
const FULL = process.argv.includes("--full");

/* THE BASELINE, PINNED. T2's claim is "byte-identical to what the box played
   before the table existed", and `HEAD` stops being that the moment this wave
   is committed — so the commit is NAMED here rather than resolved. c6b6208 is
   v263, the commit that shipped TABLE.md itself and not a line of its model.
   A future wave that legitimately changes the sound moves this sha and says
   why in the same edit; a wave that does not, does not. */
const BASE_SHA = "c6b6208";
const WT = path.join("/tmp", "nu-table-base-" + BASE_SHA);
function baseTree() {
  if (!fs.existsSync(path.join(WT, "nukernel", "document.js"))) {
    cp.execFileSync("git", ["worktree", "add", "--detach", WT, BASE_SHA],
                    { cwd: ROOT, stdio: "pipe" });
  }
  const B = (p) => require(path.join(WT, "nukernel", p));
  return { D: B("document.js"), P: B("precompose.js"), GENRES: B("genres.js").GENRES };
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
  const bad = J(d);
  bad.voices[vi].cells[id] = { reg: 99, entry: -1, focus: "yes", nosuch: 1 };
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

/* THE PORTRAIT. A compiled genre carries four closures and a monotonic `__v`,
   neither of which survives JSON — the same problem `test/fixtures/
   terms-genre.freeze.js` solved for the extraction gate, solved the same way:
   CALL them, for every voice, and freeze the answers. `entry` and `reg` are
   exactly the two this wave rewrote, so they are the two that matter most. */
const portrait = (g, nv) => {
  const o = {};
  for (const k of Object.keys(g)) {
    if (k === "__v" || typeof g[k] === "function") continue;
    o[k] = g[k];
  }
  o.__closures = [];
  for (let v = 0; v < nv; v++) o.__closures.push({
    entry: g.entry ? g.entry(v) : null,
    reg:   g.reg   ? g.reg(v)   : null,
    part:  g.part  ? g.part(v)  : null,
    realize: g.realize ? g.realize(v) : null,
    word:  g.word  ? g.word(v).length : null,
  });
  return JSON.stringify(o);
};

if (B) {
  ok("T2a every anchor's DOCUMENT is the baseline's, bar the key the wave adds", () => {
    const bad = [];
    for (const gk of ANCHORS) for (const s of SEEDS) {
      const mine = D.normalize(P.genreToDocument(gk, s));
      const prov = mine.material.prov;
      assert.ok(prov, gk + "/" + s + ": no provenance map was stamped");
      delete mine.material.prov;
      const theirs = B.D.normalize(B.P.genreToDocument(gk, s));
      if (JSON.stringify(mine) !== JSON.stringify(theirs)) bad.push(gk + "/" + s);
      mine.material.prov = prov;
    }
    assert.deepStrictEqual(bad.slice(0, 8), [],
      bad.length + " of " + (ANCHORS.length * SEEDS.length) + " documents moved");
  });

  ok("T2b every section's compiled GENRE is the baseline's, closures and all", () => {
    const bad = [];
    for (const gk of ANCHORS) for (const s of SEEDS) {
      const mine = D.normalize(P.genreToDocument(gk, s));
      const theirs = B.D.normalize(B.P.genreToDocument(gk, s));
      const nv = mine.voices.filter((v) => v.kind === "line").length;
      for (let i = 0; i < mine.form.sections.length; i++) {
        const a = portrait(D.toGenre(mine, i, GENRES), nv);
        const b = portrait(B.D.toGenre(theirs, i, B.GENRES), nv);
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
  ok("T2c the rendered EVENTS are the baseline's", () => {
    const withGuest = ANCHORS.filter((gk) => {
      try {
        const d = D.normalize(P.genreToDocument(gk, 1));
        return Object.keys(d.material.cells)
          .some((n) => D.provOf(d, n).p === "guest");
      } catch (e) { return false; }
    });
    const stride = Math.max(1, Math.round(ANCHORS.length / 45));
    const sample = FULL ? ANCHORS
      : [...new Set([...withGuest, ...ANCHORS.filter((_, i) => i % stride === 0)])];
    const bad = [];
    for (const gk of sample) for (const s of SEEDS) {
      const mine = D.scoreOf(D.normalize(P.genreToDocument(gk, s)), GENRES);
      const theirs = B.D.scoreOf(B.D.normalize(B.P.genreToDocument(gk, s)), B.GENRES);
      if (JSON.stringify(mine) !== JSON.stringify(theirs)) bad.push(gk + "/" + s);
    }
    console.log("       (" + sample.length + " anchors x " + SEEDS.length +
                " seeds rendered" + (FULL ? ", --full" : ", --full for all " +
                ANCHORS.length) + ")");
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
    const first = (sc) => {
      const e = sc.events.filter((x) => x.sec === si && x.kind === "line" && x.lv === lv);
      return e.length ? { t: e[0].t, n: e.map((x) => x.n).filter((n) => n != null) } : null;
    };
    const before = first(D.scoreOf(d, GENRES));
    assert.ok(before, "the voice is silent in the section under test");

    D.putCell(d, si, vi, "entry", 2);
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

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
