#!/usr/bin/env node
// test/written-bass.test.js — THE BASS HOLDS A LINE (wave D).
//
//   node test/written-bass.test.js
//
// WHY THIS EXISTS. `docs/REDESIGN-SCOPE.md` §10, off the Coach House
// walkthrough, where a composer could not give the bass its own written figure
// and worked around it by hiring a fake line part with a fretless sample:
//
//   > Both compilers hand `K.bass` the first line's compiled phrase, so a bass
//   > cell that named a motif named it into nothing — the sheet says so
//   > honestly today, which is the right refusal for a wrong architecture.
//   > Either the kernel lets a bass read its own material, or the column says
//   > where the choice would be.
//
// THE END TAKEN WAS THE FIRST, and the measurement that decided it is in
// `kernel.js bass()`'s own comment: `bassFig` — a bass line written out rather
// than described, shipped the night before for salsa's tumbao and grunge's
// octaves — is ALREADY the shape of a cell. Where the note is, which degree it
// takes over the chord, which octave, whether it is accented, whether it
// slides. Opening the bass was therefore one argument and a five-key shape
// conversion, not a second bass: `bass(subj, g, bars, own)`, where `subj` goes
// on being the HARMONIC authority (the record has one progression) and `own`
// is the bass voice's own compiled cell, read as a figure over it.
//
// TEST THE ARTIFACT. Every assertion below reads RENDERED EVENTS — pitches,
// onsets, velocities, durations — and not one reads the precedence expression
// or the branch that produced them. W3 checks the pitches against the MOTIF'S
// OWN DEGREES, arithmetic done in the gate off `g.mode`, so the claim "a
// written bass is audibly that line" is a number and not a hope.
//
// WHAT IS ASSERTED
//   W1  ABSENT IS TODAY, over every anchor, against a freeze taken from the
//       commit before this wave (`test/fixtures/bass-pre-waveD.json`). Same
//       event count; same time, pitch, velocity, accent and slide, note for
//       note; same durations for every note that HAD one. The one thing that
//       moves is the other half of this round — see W2.
//   W2  NO BASS NOTE CARRIES `dur: NaN`. It is the bug `scratch/genre-qa/
//       SHIFT-5.md` found and left ("worth a round of its own"): `spans(grid)`
//       is sixteen slots long and the loop read it up to `N = 32`. 39,063 of
//       91,855 events — 42.5%, on half the catalogue's anchors — and
//       `to-engine.js` reads `(e.dur || 0)` with NaN FALSY, so every one
//       played at the
//       0.02-beat floor. The freeze records exactly which notes those were and
//       W1 demands the set has not grown by one.
//   W3  A WRITTEN BASS IS THAT LINE. Its onsets are the cell's own gate, its
//       pitches are the cell's own degrees over the chord sounding under each
//       one, its accents are the cell's accents and its velocities the cell's
//       velocities. Not one of them is the first line's phrase wearing a bass.
//   W4  THE TWO COMPILERS AGREE. `ui/derive.js sectionEvents` — the one the
//       page plays through — renders the same bass, note for note, as
//       `document.js scoreOf`, through the `bslot` seam.
//   W5  IT FOLLOWS THE CHANGES. The same written step over two different
//       chords is two different notes, each the written degree over that
//       chord's own root.
//   W6  A WRITTEN CELL OUTRANKS THE STYLE, including `walk`, and clearing it
//       restores the untouched record's bass note for note.
//   W7  THE THREE REFUSALS: a drum cell, a name that is not in the bank, and
//       an empty name all leave the bass playing the genre's own part.
"use strict";
const path = require("path");
const fs = require("fs");
const R = (p) => path.join(__dirname, "..", p);

let fails = 0, checks = 0;
const ok = (cond, what, detail) => {
  checks++;
  if (cond) { console.log("  ok   " + what); return true; }
  fails++; console.log("  FAIL " + what + (detail ? "\n       " + detail : ""));
  return false;
};

/* ---------- the stub window (test/meter.test.js's own harness) ------------ */
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { visibilityState: "visible", body: { append() {} },
  createElement: () => ({ style: {}, append() {}, click() {}, setAttribute() {} }) };
window.NuKernel = require(R("nukernel/kernel.js"));
window.NuGenres = require(R("nukernel/genres.js"));
window.NuFields = require(R("nukernel/fields.js"));
window.NuSong = require(R("nukernel/song.js"));
window.NuInstruments = require(R("nukernel/instruments.js"));
window.NuCompose = require(R("nukernel/compose.js"));
window.PRESETS = require(R("nukernel/presets.js")).PRESETS;
window.NuDocument = require(R("nukernel/document.js"));
window.NuSongs = require(R("nukernel/songs.js"));

const K = window.NuKernel;
const { GENRES } = window.NuGenres;
const D = window.NuDocument;
const P = require(R("nukernel/precompose.js"));
const crypto = require("crypto");
const h = (x) => crypto.createHash("sha256").update(x).digest("hex").slice(0, 16);

const bassOf = (sc) => sc.events.filter((e) => e.kind === "bass");

/* EVERYTHING `bass()` CAN READ, FOR ONE ANCHOR, AS ONE STRING. The freeze
   this gate compares against was taken from the commit before wave D, and
   this tree's catalogue does not hold still: `nukernel/genres.js` is
   GENERATED and other rounds re-argue rows in it while this one runs. A gate
   that pinned the rendered bass without pinning its INPUTS would go red the
   next time somebody moved a tempo, and the red would say nothing about the
   bass. So the freeze carries a signature of the inputs beside the output,
   and an anchor whose inputs have moved is REPORTED and skipped rather than
   silently failed or silently passed — the same distinction test/table.js
   T2's own "row(s) do not exist at BASE_SHA" line draws.

   THE LIST IS `bass()`'s OWN READS, in the order the function makes them: the
   document (which is the phrase, the form and the cast), then, per section,
   every genre field the function or its callees touch. */
function bassSig(Doc, P, GENRES, a) {
  const doc = P.genreToDocument(a, 1);
  const F = ["nobass", "bassStyle", "bassGrid", "bassFig", "bassBars", "bassArtic",
             "bassReg", "bassNudge", "key", "mode", "scale", "prog", "roots",
             "harmony", "rate", "meter", "swing", "stress", "touch", "phrase",
             "voices", "bars", "cellBars", "period"];
  const per = doc.form.sections.map((_s, i) => {
    const g = Doc.toGenre(doc, i, GENRES);
    return F.map((k) => JSON.stringify(g[k] === undefined ? null : g[k])).join("|");
  });
  return JSON.stringify(doc) + "§" + per.join("§");
}

/* ================= W1 · ABSENT IS TODAY, AND W2 · NO NaN ================= */
console.log("\nW1/W2 — every anchor in the catalogue, none of which " +
            "names a bass cell\n");
{
  const FREEZE = JSON.parse(fs.readFileSync(R("test/fixtures/bass-pre-waveD.json"), "utf8"));
  const badShape = [], badDur = [], badCount = [], stillNan = [];
  const minted = [], reargued = [];
  let events = 0, healed = 0, anchors = 0;
  for (const a of P.anchors()) {
    const want = FREEZE[a] || null;
    let sc, sig;
    try { sig = h(bassSig(D, P, GENRES, a));
          sc = D.scoreOf(P.genreToDocument(a, 1), GENRES, []); } catch (e) { continue; }
    if (!want) {                               // a row minted after the freeze
      minted.push(a);
      for (const e of bassOf(sc)) if (!Number.isFinite(e.dur)) stillNan.push(a + "#new");
      continue;
    }
    const ev = bassOf(sc);
    /* W2 IS ASKED OF EVERY ANCHOR, INCLUDING THE ONES THE FREEZE NO LONGER
       SPEAKS FOR. "No bass note carries a NaN duration" is a claim about the
       code, not about a pin, so a row somebody re-argued this morning owes it
       just as much as one nobody has touched. */
    ev.forEach((e, i) => { if (!Number.isFinite(e.dur)) stillNan.push(a + "#" + i); });
    if (sig !== want.sig) { reargued.push(a); continue; }
    anchors++;
    events += ev.length;
    const shape = [], cnt = new Map();
    ev.forEach((e) => {
      shape.push([Math.round(e.t * 1e6), e.n, e.vel, e.acc ? 1 : 0, e.sld ? 1 : 0]);
      if (Number.isFinite(e.dur)) {
        const d = Math.round(e.dur * 1e6); cnt.set(d, (cnt.get(d) || 0) + 1);
      }
    });
    /* ...AND THE MULTISET OF DURATIONS, NOT THEIR ORDER (W1c). The reason is
       exact: the healed notes are interleaved with the ones that always had a
       duration, so a positional comparison would need the freeze to carry
       39,063 indices. What it carries instead is the old stream's finite
       durations as (value, count) pairs — six numbers for a whole record —
       and the claim is the one that matters: every duration a person could
       already hear is still there, the same number of times. A round that
       SHORTENED a hold would drop a count and fail here while W1b stayed
       green, which is why the two are separate checks. */
    const missing = (want.dsorted || []).filter(([d, k]) => (cnt.get(d) || 0) < k);
    if (missing.length) badDur.push(a + " " + JSON.stringify(missing[0]));
    if (ev.length !== want.n) badCount.push(a + " " + want.n + "->" + ev.length);
    else if (h(JSON.stringify(shape)) !== want.h) badShape.push(a);
    healed += want.k;
  }
  console.log("       " + anchors + " anchors compared · " + events +
              " bass events · " + healed + " of them carried dur: NaN before " +
              "this round" +
              (minted.length ? "\n       " + minted.length +
               " anchor(s) minted since the freeze: " + minted.slice(0, 8).join(", ") : "") +
              (reargued.length ? "\n       " + reargued.length +
               " anchor(s) re-argued since the freeze (inputs moved, not this " +
               "round's business): " + reargued.slice(0, 8).join(", ") : ""));
  ok(anchors > 400,
     "W1 the freeze still speaks for most of the catalogue (" + anchors +
     " of " + (anchors + minted.length + reargued.length) + " anchors)",
     String(anchors));
  ok(badCount.length === 0,
     "W1a every anchor renders the SAME NUMBER of bass notes it did before wave D",
     badCount.slice(0, 6).join(" · "));
  ok(badShape.length === 0,
     "W1b and the same time, pitch, velocity, accent and slide on every one of them",
     badShape.slice(0, 8).join(", "));
  ok(stillNan.length === 0,
     "W2 not one bass note in the catalogue carries a NaN duration",
     stillNan.length + " still do, first: " + stillNan.slice(0, 6).join(", "));
  ok(healed > 30000,
     "W2b the freeze remembers how many were broken (" + healed + " of " + events + ")",
     String(healed));
  ok(badDur.length === 0,
     "W1c every duration the old stream already had is still there, in the same counts",
     badDur.slice(0, 8).join(", "));
}

/* ================== the written bass, built by hand ====================== */
/* ONE FIGURE, WRITTEN OUT, AND IT IS NOT ANYTHING THE GENRE WOULD PLAY: a
   quarter-note arpeggio root - fifth - third - seventh, twice over the two-bar
   cell this record's bank is written in, accented on each downbeat. Degrees,
   because every pitch in this kernel is a degree of something. */
const NSTEPS = 32;
const FIG = [0, 4, 2, 6, 0, 4, 2, 6];               // one per quarter
function writtenCell(n = NSTEPS) {
  const deg = new Array(n).fill(0), play = new Array(n).fill("h");
  const vel = new Array(n).fill(5), acc = new Array(n).fill(0);
  for (let q = 0; q * 4 < n; q++) {
    const i = q * 4;
    play[i] = "n"; deg[i] = FIG[q % FIG.length];
    vel[i] = q % 4 === 0 ? 8 : 5;
    acc[i] = q % 4 === 0 ? 1 : 0;
  }
  return { kind: "line", deg, play, vel, acc };
}
const ANCHOR = "reggae";
const plainDoc = () => D.normalize(P.genreToDocument(ANCHOR, 1));
function writeBass(doc, cellName, cell) {
  if (cell) doc.material.cells[cellName] = cell;
  doc.voices.find((v) => v.kind === "bass").material = cellName;
  return doc;
}

console.log("\nW3 — a written bass is that line, note for note\n");
{
  const plain = plainDoc();
  const wrote = writeBass(plainDoc(), "bassline", writtenCell());
  const g = D.toGenre(wrote, 0, GENRES);
  const md = g.mode, key = g.key | 0;
  const a = bassOf(D.scoreOf(plain, GENRES, []));
  const b = bassOf(D.scoreOf(wrote, GENRES, []));
  console.log("       " + ANCHOR + ": genre bass " + a.length + " notes on steps " +
              [...new Set(a.map((e) => Math.round(e.t * g.rate) % NSTEPS))].sort((x, y) => x - y).join(",") +
              " · written bass " + b.length + " notes on steps " +
              [...new Set(b.map((e) => Math.round(e.t * g.rate) % NSTEPS))].sort((x, y) => x - y).join(","));
  ok(b.length > a.length, "W3a the written part is a different part from the genre's",
     a.length + " -> " + b.length);
  // W3b · THE ONSETS ARE THE CELL'S OWN GATE, folded into the cell
  const want = new Set(); for (let q = 0; q * 4 < NSTEPS; q++) want.add(q * 4);
  const got = new Set(b.map((e) => ((Math.round(e.t * g.rate) % NSTEPS) + NSTEPS) % NSTEPS));
  ok([...want].every((x) => got.has(x)) && [...got].every((x) => want.has(x)),
     "W3b every onset is a step the cell marks, and every marked step sounds",
     "wanted " + [...want].join(",") + " got " + [...got].join(","));
  /* W3c · THE PITCHES ARE THE CELL'S OWN DEGREES OVER THE CHORD UNDER THEM,
     and the expected pitch is arithmetic this gate does for itself: the mode
     the record is in, the degree the cell wrote, the chord the RECORD says is
     sounding at that step (`K.chordsOf`, the one owner of what a bar's chords
     are — asked here for its `deg` and its `borrow`, which is a fact about
     the harmony and not about the bass), folded into E1..G4. Nothing below
     reads a line of `bass()`. */
  const mpIn = (m, d) => { const n = m.length;
    return m[((d % n) + n) % n] + 12 * Math.floor(d / n); };
  const fold = (n, lo, hi) => { let x = n;
    while (x < lo) x += 12; while (x > hi) x -= 12; return x; };
  const lines = wrote.voices.filter((v) => v.kind === "line");
  const bad = [];
  let checked = 0;
  for (const p2 of D.planOf(wrote, GENRES, []).plan) {
    // THE SECTION'S OWN ALPHABET, not the record's first: a row may carry its
    // own mode (reggae seed 1 puts section 9 in dorian) and reading section
    // zero's here would have this gate accusing the kernel of a semitone the
    // record itself asked for.
    const pg = p2.g, pmd = pg.mode;
    const lead = D.toPhrase(wrote, D.materialAt(lines[0], p2.id));
    const n2 = lead.deg.length;
    const win = D.scoreOf(wrote, GENRES, [], { section: p2.si });
    for (const e of bassOf(win)) {
      const st = Math.round((e.t - win.t0) * pg.rate);
      if (st < 0) continue;                       // a pickup belongs to the bar before
      const bar = Math.floor(st / n2), i = ((st % n2) + n2) % n2;
      const fd = FIG[(i / 4) % FIG.length];
      if (i % 4 || !fd) continue;      // a written 0 is the chord's own bass note
      const cs = K.chordsOf(lead, pg, bar);
      const c = cs.length === 1 ? cs[0]
        : (cs.find((x) => i >= x.start && i < x.start + x.len) || cs[cs.length - 1]);
      const wantN = Math.max(24, fold(mpIn(pmd, (c.deg | 0) + fd) + (c.borrow | 0) +
                                      36 + (pg.key | 0), 28, 67));
      checked++;
      if (e.n !== wantN) bad.push("s" + p2.si + " step " + i + " deg " + fd +
                                  " over " + c.deg + " -> " + e.n + " want " + wantN);
    }
  }
  ok(bad.length === 0 && checked > 100,
     "W3c all " + checked + " written notes are the cell's own degree over the chord under them",
     bad.slice(0, 6).join(" · "));
  console.log("       first bar, rendered: " +
    b.filter((e) => e.t * g.rate < NSTEPS)
     .map((e) => "step " + Math.round(e.t * g.rate) + " deg " +
                 FIG[(Math.round(e.t * g.rate) / 4) % FIG.length] + " over " + e.r +
                 " = MIDI " + e.n + " vel " + e.vel + (e.acc ? "!" : "") +
                 " dur " + (+e.dur).toFixed(2)).join("  ·  "));
  // W3d · THE ACCENTS AND THE VELOCITIES ARE THE CELL'S
  const accSteps = new Set(b.filter((e) => e.acc).map((e) =>
    ((Math.round(e.t * g.rate) % NSTEPS) + NSTEPS) % NSTEPS));
  ok(accSteps.size === 2 && accSteps.has(0) && accSteps.has(16),
     "W3d the accents are the two the cell marks and no others",
     [...accSteps].join(","));
  ok(b.every((e) => Number.isFinite(e.dur) && e.dur > 0),
     "W3e every written note has a real duration");
  ok(b.every((e) => e.n >= 28 && e.n <= 67 + 12),
     "W3f the written line is still on a bass (E1..G4, plus the player's own octave)",
     "range " + Math.min(...b.map((e) => e.n)) + ".." + Math.max(...b.map((e) => e.n)));
}

/* ================== W5 · it follows the changes ========================== */
console.log("\nW5 — the same written step over two chords is two notes\n");
{
  const wrote = writeBass(plainDoc(), "bassline", writtenCell());
  const g = D.toGenre(wrote, 0, GENRES);
  const b = bassOf(D.scoreOf(wrote, GENRES, []));
  const byRoot = new Map();
  for (const e of b) {
    const step = ((Math.round(e.t * g.rate) % NSTEPS) + NSTEPS) % NSTEPS;
    if (step !== 4) continue;                     // the written FIFTH
    if (!byRoot.has(e.r)) byRoot.set(e.r, new Set());
    byRoot.get(e.r).add(e.n);
  }
  console.log("       the written fifth, by chord degree: " +
    [...byRoot.entries()].map(([r, s]) => "root " + r + " -> " + [...s].join("/")).join("  ·  "));
  ok(byRoot.size > 1, "W5a the record's chords do move under the figure", String(byRoot.size));
  ok([...byRoot.values()].every((s) => s.size === 1),
     "W5b one chord, one note: the written degree is not ambiguous under a root");
  const pitches = new Set([...byRoot.values()].map((s) => [...s][0]));
  ok(pitches.size === byRoot.size,
     "W5c a different chord gives a different note — the figure transposes with the changes",
     [...pitches].join(","));
}

/* ============ W6 · it outranks the style, and clearing it restores ======== */
console.log("\nW6 — the written part beats the described one, and clears back\n");
{
  const plain = bassOf(D.scoreOf(plainDoc(), GENRES, []));
  const cleared = plainDoc();
  cleared.material.cells.bassline = writtenCell();     // in the bank, unread
  const clearedEv = bassOf(D.scoreOf(cleared, GENRES, []));
  ok(JSON.stringify(plain.map((e) => [e.t, e.n, e.vel, e.dur])) ===
     JSON.stringify(clearedEv.map((e) => [e.t, e.n, e.vel, e.dur])),
     "W6a a cell sitting in the bank that no bass names changes nothing");
  // ...and a bass told to WALK, holding a written part, plays the written part
  const walk = writeBass(plainDoc(), "bassline", writtenCell());
  walk.voices.find((v) => v.kind === "bass").cast.style = "walk";
  const walkPlain = plainDoc();
  walkPlain.voices.find((v) => v.kind === "bass").cast.style = "walk";
  const gw = D.toGenre(walk, 0, GENRES);
  const wEv = bassOf(D.scoreOf(walk, GENRES, []));
  const pEv = bassOf(D.scoreOf(walkPlain, GENRES, []));
  ok(pEv.some((e) => e.walk), "W6b the control record really is walking");
  ok(wEv.length && !wEv.some((e) => e.walk),
     "W6c a written cell outranks bassStyle: walk — no note is a walked note");
  const steps = new Set(wEv.map((e) => ((Math.round(e.t * gw.rate) % NSTEPS) + NSTEPS) % NSTEPS));
  ok([...steps].every((x) => x % 4 === 0) && steps.size === 8,
     "W6d and what it plays instead is the cell's own eight quarters",
     [...steps].sort((a2, b2) => a2 - b2).join(","));
}

/* ================== W7 · the three refusals ============================== */
console.log("\nW7 — what a bass may not read\n");
{
  const plain = JSON.stringify(bassOf(D.scoreOf(plainDoc(), GENRES, []))
    .map((e) => [e.t, e.n, e.vel, e.dur]));
  const same = (doc, what) => {
    const got = JSON.stringify(bassOf(D.scoreOf(doc, GENRES, []))
      .map((e) => [e.t, e.n, e.vel, e.dur]));
    ok(got === plain, what);
  };
  const drumCell = Object.keys(plainDoc().material.cells)
    .find((n) => plainDoc().material.cells[n].kind === "drum");
  same(writeBass(plainDoc(), drumCell), "W7a a bass pointed at a DRUM cell plays the genre's bass");
  same(writeBass(plainDoc(), "no-such-motif"),
       "W7b a bass pointed at a name the bank does not hold plays the genre's bass");
  same(writeBass(plainDoc(), ""), "W7c a bass naming nothing plays the genre's bass");
}

/* ================== W4 · the two compilers agree ========================= */
(async () => {
console.log("\nW4 — the page's compiler and the score's compiler play one bass\n");
const DER = await import(R("nukernel/ui/derive.js"));
{
  const wrote = writeBass(plainDoc(), "bassline", writtenCell());
  const GK = "wb.";
  const boxes = D.boxesOf(wrote, GK);
  boxes.forEach((b, i) => { window.NuGenres.GENRES[GK + i] = D.toGenre(wrote, i, GENRES); });
  const slots = D.slotsOf(wrote);
  ok(boxes.every((b) => b.bslot != null),
     "W4a every box carries a pointer to the bass's own phrase (bslot)");
  ok(boxes.every((b) => slots[b.bslot] && slots[b.bslot].deg),
     "W4b and the bank slotsOf builds actually holds a phrase there");
  /* W4c · THE PAGE PLAYS THE WRITTEN PART, measured the way W3 measures the
     score's: the onsets `sectionEvents` renders fold to the cell's own eight
     quarters and to nothing else.

     WHY THIS IS NOT A NOTE-FOR-NOTE EQUALITY WITH `scoreOf`, said out loud
     rather than quietly softened: the two compilers already disagree about
     the bass on a record nobody has touched, and they disagree for a reason
     that predates this wave. `sectionEvents` applies the section's ENVELOPE
     (`drop` cuts the last bar's events) and `scoreOf` deliberately does not —
     measured on the untouched `reggae` seed 1, sections 3, 8, 9 and 10 come
     back 14/15/14/15 notes from the page against 16 from the score. So the
     claim this gate can honestly make is that BOTH compilers play the written
     cell rather than the first line's phrase, and W4d is the other half: the
     two agree on the SET of (step, pitch) pairs, which is what a written part
     actually is, with the envelope's cut allowed to thin it. */
  const foldStep = (t, g2) => ((Math.round(t * g2.rate) % NSTEPS) + NSTEPS) % NSTEPS;
  const badSteps = [], badSet = [], skipped = [];
  for (let i = 0; i < boxes.length; i++) {
    const g2 = window.NuGenres.GENRES[GK + i];
    const mine = DER.sectionEvents(boxes[i], slots, null, wrote.time.swing || null)
                    .ev.filter((e) => e.kind === "bass");
    if (!mine.length) continue;
    const st = new Set(mine.map((e) => foldStep(e.t, g2)));
    if ([...st].some((x) => x % 4)) badSteps.push("s" + i + " " + [...st].join(","));
    const win = D.scoreOf(wrote, GENRES, [], { section: i });
    const theirs = bassOf(win);
    const sig = (ev, t0) => new Set(ev.map((e) => foldStep(e.t - t0, g2) + ":" + e.n));
    const A = sig(mine, 0), B = sig(theirs, win.t0);
    /* ...EXCEPT WHERE THE SECTION CARRIES A `bassop` WORD, AND THAT EXCEPTION
       IS A BUG THIS ROUND MEASURED AND DID NOT FIX. `scratch/genre-qa/
       SHIFT-5.md` named it off the grunge round — "the hole reaches the desk
       and not the score": `ui/derive.js genreOf` spends the box's `bassop`
       (and `kit`) and `document.js toGenre` never has, so a breakdown's
       `nobass` still prints eight bass notes on the staff. It is not only the
       breakdown. Measured HERE, on `reggae` seed 1, an ordinary record with
       no drop in it: sections 5 and 11 carry `bassop: "octaves"`, the page
       alternates the register and the score does not, and the two compilers
       disagree about two of thirteen sections on a record nobody has touched.
       Censused across the catalogue: 1,656 of 4,882 sections carry a `bassop`
       word and 2,936 carry a `kit` word — 60% of every section in the
       catalogue — so the fix moves far more than a bass and belongs to the
       round that owns the section-word tier, with the drums beside it. This
       gate's job is to say WHERE the disagreement is, not to hide it: the
       skip is conditional on the word being present, so the day somebody
       spends it the exemption stops firing on its own. */
    if (boxes[i].bassop) { skipped.push("s" + i + ":" + boxes[i].bassop); continue; }
    if ([...A].some((x) => !B.has(x))) badSet.push("s" + i);
  }
  ok(badSteps.length === 0,
     "W4c the page's own compiler plays the cell's quarters and nothing between them",
     badSteps.slice(0, 4).join(" · "));
  ok(badSet.length === 0,
     "W4d every (step, pitch) the page plays is one the score plays — one written bass, two compilers",
     badSet.slice(0, 6).join(", "));
  console.log("       (" + skipped.length + " section(s) held out because the box's own " +
              "bassop word reaches one compiler and not the other — the named, " +
              "unfixed SHIFT-5 bug: " + skipped.join(", ") + ")");
  // AND WITHOUT THE BANK the page is exactly where it was: a bslot pointing
  // into a slots array that does not reach it (every caller that has not
  // adopted `slotsOf`) renders the bass the genre describes.
  const short = slots.slice(0, boxes.length * (wrote.voices.filter((v) => v.kind === "line").length));
  const plainBoxes = D.boxesOf(plainDoc(), GK);
  const plainSlots = D.slotsOf(plainDoc());
  const a = DER.sectionEvents(boxes[0], short, null, wrote.time.swing || null)
              .ev.filter((e) => e.kind === "bass");
  const c = DER.sectionEvents(plainBoxes[0], plainSlots, null, wrote.time.swing || null)
              .ev.filter((e) => e.kind === "bass");
  ok(JSON.stringify(a.map((e) => [e.t, e.n, e.vel, e.dur])) ===
     JSON.stringify(c.map((e) => [e.t, e.n, e.vel, e.dur])),
     "W4e a bslot the bank cannot reach renders the bass the page rendered yesterday",
     a.length + " vs " + c.length);
}

console.log("\n" + (fails ? "FAIL " + fails + " of " + checks + " checks"
                          : "PASS " + checks + " checks"));
process.exit(fails ? 1 : 0);
})();
