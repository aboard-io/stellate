#!/usr/bin/env node
// test/unit/kernel-coverage.test.js — CAN YOU GET TO THE WHOLE KERNEL BY
// ANSWERING QUESTIONS?
//
// The band is a question graph over a kernel, and the honest question about
// that arrangement is: how much of the kernel can the graph actually reach?
// Not "does it work" — WHICH KNOBS EXIST THAT NOBODY CAN TURN.
//
// So this gate reads both ends and holds them against each other:
//   · the KERNEL's own read set, scraped from kernel.js (`g.<field>`), split
//     into DATA fields (a value a question could set) and the six that are
//     CALLED AS FUNCTIONS (entry/part/period/realize/reg/word — a genre
//     supplies behaviour there, and no finite question tree can name an
//     arbitrary function; the chairs supply them from tables, which is the
//     right shape and not a coverage gap)
//   · the GRAPH's own write set, collected by walking every chair, every
//     question, every answer and every section question, and diffing what
//     the section genre comes out as
//
// Then: every data field is either REACHED by some answer, or listed below
// with the reason it is not. The list is the work; the gate is what stops it
// growing behind our backs — a kernel that gains a knob no question turns
// fails here, and so does a chair that loses one it used to reach.
"use strict";
let pass = 0, fails = 0;
const ok = (b, msg) => { if (b) pass++; else { fails++; console.log("  ✗ " + msg); } };

const fs = require("fs"), path = require("path");
const Band = require("../../nukernel/band-kit.js");
const { MODES } = require("../../nukernel/genres.js");
const on = () => ({ ...Band.blank(), on: true });
Band.toSong(on(), MODES);

/* ---------- what the kernel reads --------------------------------------- */
const src = fs.readFileSync(path.join(__dirname, "../../nukernel/kernel.js"), "utf8");
const READS = new Set();
for (const m of src.matchAll(/\bg\.([A-Za-z_][A-Za-z0-9_]*)/g)) READS.add(m[1]);
const isFn = (r) => new RegExp("g\\." + r + "\\s*\\(").test(src);
const FNS = [...READS].filter(isFn).sort();
const DATA = [...READS].filter((r) => !isFn(r)).sort();

/* ---------- what the graph writes --------------------------------------- */
// every answer, one hop: what did the section genre come out as, and which
// fields moved? (Plus the melody's own genre, which is a layer of its own.)
const RECORDS = Object.values(Band.GENRES).map((g) => g.w);
const fieldsOf = (m) => {
  const out = {};
  for (const s of Band.toSong(m, MODES)) {
    for (const [k2, v] of Object.entries(s.genre)) out[k2] = JSON.stringify(v) || "fn";
    if (s.melody) for (const [k2, v] of Object.entries(s.melody.genre))
      out["mel:" + k2] = JSON.stringify(v) || "fn";
  }
  return out;
};
const REACHED = new Set();
const note = (a, b) => {
  for (const k2 of new Set([...Object.keys(a), ...Object.keys(b)]))
    if (a[k2] !== b[k2]) REACHED.add(k2.replace(/^mel:/, ""));
};
for (const rec of RECORDS) {
  const seed = Band.answer(on(), "arranger", "genre", rec);
  const base = fieldsOf(seed);
  note(fieldsOf(on()), base);                       // the record itself moves fields
  for (const seat of Band.SEATS) {
    for (const d of Band.seatDecisions(seed, seat)) {
      for (const o of d.opts)
        note(base, fieldsOf(Band.answer(seed, seat, d.id, o.w)));
      // ...and the tray, which is where most of a chair's vocabulary is
      for (const i of Band.catalog(seed, seat)) {
        if (!i.changes) continue;
        note(base, fieldsOf(Band.say(seed, seat, i.id)));
      }
    }
  }
  // the sections, where the arranging happens
  const gk = Band.GENRES[Object.keys(Band.GENRES).find((k2) => Band.GENRES[k2].w === rec)];
  const withForm = Band.answer(seed, "arranger", "form", Band.FORMS[gk.forms[0]].w);
  const b2 = fieldsOf(withForm);
  for (let i = 0; i < Band.toSong(withForm, MODES).length; i++)
    for (const a of Band.sectionAsks(withForm, i))
      for (const o of a.opts)
        note(b2, fieldsOf(Band.setSection(withForm, i, a.id, o.key)));
}

/* ---------- the two ends, held against each other ----------------------- */
// WHAT NOBODY CAN TURN, and why. Moving a row out of here means a question
// somewhere now reaches it; adding one means writing down why it cannot be
// asked. Neither may happen silently.
const UNREACHED = {
  // ...because it is not a musical decision
  kitSeed:  "the dice, not a choice: the seed a genre's own kit chance draws from",
  anchor:   "an identity field the daw's own catalog uses; a session has no anchor",
  // ...because something else owns it
  swing:    "the SONG's, not the genre's — the word in a numeric field was the " +
            "NaN that stopped the engine dead, so it is routed through setSwing",
  bassGrid: "superseded by `bassFig`, which says where the notes fall AND which " +
            "octave, accent and slide each one takes",
  // ...because nobody has written the question yet. THIS IS THE WORK LIST.
  scale:    "TODO — melodies default to PENT and nothing can say otherwise",
  stress:   "TODO — metrical accent, the performance layer the drummer has " +
            "(humanize) and no pitched chair does",
  phrase:   "TODO — the line's own arch, same layer",
  touch:    "TODO — the HAND: seeded micro-timing and micro-level, same layer",
  orn:      "TODO — a genre's ornament policy (passing tones, grace notes)",
  ghost:    "TODO — a ghost line under the part",
  maxHold:  "TODO — how long a note may hold, which is what makes a rest real",
  kitProb:  "TODO — per-lane chance; the drummer says it per STEP (?lane) but " +
            "cannot say 'sometimes' about a whole lane",
  hand:     "TODO — the kit's hand (exact vs human), one notch above humanize",
  fill:     "TODO — the genre's own last-bar fill, which the drummer writes per bar",
  diatonic: "TODO — hold the line to the mode",
  incMode:  "TODO — how the line's `inc` steps are read",
  incClamp: "TODO — the ceiling on those steps",
};

console.log("the kernel reads " + READS.size + " genre fields: " + DATA.length +
            " data, " + FNS.length + " called as functions");
{
  // the six function fields: supplied from tables by the chairs, and that is
  // the right shape — a finite question tree cannot name an arbitrary function
  for (const f of FNS)
    ok(REACHED.has(f) || ["word", "period"].includes(f),
       "the function field `" + f + "` is never supplied by any chair");
}
{
  const missing = DATA.filter((f) => !REACHED.has(f) && !UNREACHED[f]);
  ok(missing.length === 0,
     "the kernel reads " + missing.join(", ") + " and no question reaches it — " +
     "either write the question or write down why it cannot be asked");
  const stale = Object.keys(UNREACHED).filter((f) => REACHED.has(f));
  ok(stale.length === 0,
     "listed as unreachable but the graph writes it now: " + stale.join(", ") +
     " — take the row out");
  const gone = Object.keys(UNREACHED).filter((f) => !DATA.includes(f) && !FNS.includes(f));
  ok(gone.length === 0, "listed as unreachable but the kernel no longer reads it: " +
     gone.join(", "));
}
/* ---------- and one level finer: is the field reached with any RANGE? ----
   A field can be written and still be one value forever. `prog` is the case
   that made this necessary: the melody layer writes it (the changes paired
   into a longer phrase), so the field counts as reached — while chord
   QUALITY, which is what `prog` is FOR (q/inv/borrow), is still unsayable.
   These are the value-level claims worth holding; each one is a sentence
   about what a musician can ask for. */
{
  const seen = { prog: new Set(), kit: new Set(), part: new Set(), instr: new Set() };
  for (const rec of RECORDS) {
    const seed = Band.answer(on(), "arranger", "genre", rec);
    for (const s of Band.toSong(seed, MODES)) {
      for (const slot of (s.genre.prog || []))
        for (const c of (Array.isArray(slot) ? slot : [slot]))
          seen.prog.add(c && c.q ? c.q : "triad");
      for (const l of Object.keys(s.genre.kit || {})) seen.kit.add(l);
      for (const v of [0, 1]) seen.part.add(s.genre.part(v));
      for (const i of [].concat(s.genre.instr || [])) seen.instr.add(i);
    }
  }
  ok(seen.kit.size >= 5, "the whole catalog only ever writes " + seen.kit.size + " drum lanes");
  ok(seen.part.size >= 4, "only " + seen.part.size + " kernel parts are ever played: " +
     [...seen.part].join(", "));
  ok(seen.instr.size >= 8, "only " + seen.instr.size + " instruments are ever cast");
  // THE ONE THAT IS NOT TRUE YET, written as the claim it will be:
  const qualities = [...seen.prog];
  console.log("    chord qualities reachable: " + qualities.join(", ") +
              (qualities.length < 2 ? "  ← the arranger calls roots, not chords" : ""));
}

{
  const got = DATA.filter((f) => REACHED.has(f));
  const todo = Object.entries(UNREACHED).filter(([, why]) => why.startsWith("TODO"));
  const pct = Math.round(got.length / DATA.length * 100);
  console.log("    reached by answering questions: " + got.length + "/" + DATA.length +
              " (" + pct + "%)");
  console.log("    not asked, on purpose: " +
              Object.keys(UNREACHED).filter((f) => !UNREACHED[f].startsWith("TODO")).join(", "));
  console.log("    not asked YET (" + todo.length + "): " + todo.map(([f]) => f).join(", "));
  // THE RATCHET: coverage may go up and may not go down. A number in a gate
  // is a promise; this is the one that keeps the graph growing toward the
  // kernel instead of away from it.
  ok(got.length >= 21, "coverage fell to " + got.length + " of " + DATA.length +
     " — the graph reaches less of the kernel than it did");
}

console.log(fails ? `\nkernel-coverage: FAIL — ${fails} of ${pass + fails}`
  : `\nkernel-coverage: PASS — ${pass} checks (every field the kernel reads is either answerable or written down as not)`);
process.exit(fails ? 1 : 0);
