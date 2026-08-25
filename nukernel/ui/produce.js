// nukernel/ui/produce.js — THE PRODUCER, BACK ON THE EIGHT-AXES PAGE.
//
// (Paul, 2026-08-24: "we've lost the producer entirely.")
//
// The engine was never lost. `nukernel/producer.js` is 1,700 lines of vector
// step in genre space — six verbs, a subject tree that goes all the way down,
// 122 anchors and 30 adjectives as descriptors, an asymptotic ladder whose
// MINUS is the exact algebraic inverse of its PLUS. What went missing was its
// CAST, its SEAM and its PAGE. This file is all three, and it adds no
// arithmetic: every number below comes out of producer.js, every word out of a
// table, and the only new sentence in the slice is H5's.
//
// THE PROJECTION, AND WHY IT IS ONE-WAY. producer.js's whole field law is
// dotted into a SECTION GENRE — `g.drumkit`, `kit.k`, `g.chairs.N.tone`,
// `song.bpm` — and a section genre is exactly what `document.js toGenre` builds
// and `ui/eight.js push()` registers as `GENRES["lab.eight."+i]`. The two
// worlds are not parallel below the cast; they are the same object. So the
// producer is a COMPILE STAGE — DOC -> toGenre -> run() -> GENRES[GK+i] —
// nothing is written back into the document except the NOTE, and undo is
// deleting a line and recompiling. The alternative (a native producer writing
// into the eight axes) would have to invent a document home for ~25 kernel
// fields the anchor supplies through the `...GENRES[DOC.basis]` spread, which
// is a second field law beside producer.js's own.
//
// WHAT THE PROJECTION GENUINELY CANNOT REACH, named rather than faked: the
// motifs (`DOC.material.cells`) and the form (bars, roles, order). producer.js
// forbids both by name — ":165, a producer does not re-count the bar" — so this
// is not a hole, it is the same fence in two files. The one native move worth
// taking back IS taken back: "take away the cantor" is the document's own
// development word `out` (songs.js:63, `[["drop", 1]]`, "a voice can be silent
// for a section without leaving the record"), compiled by the document's own
// compiler and handed to producer.js through the `S.out` seam (H4).
//
// TAPPED, NEVER TYPED. There is no text box and no parser anywhere in this
// file. The sentence is ASSEMBLED by three taps — verb, scope, target — so
// every sentence the page offers is one producer.js can actually make, and an
// unsayable one is never offered rather than guessed at.
import { GENRES, render, NuDocument, NuDeskDoc, Prod } from "./deps.js";
// ONE OPTION IS A MENU, AND THIS IS THE ONE PLACE THE SHIPPED PAGE HAS ONE.
// Same name, same signature: ui/selects.js re-exports ui/sheets.js's `sheet`
// through a router that draws a <select> for any spec offering one option and
// the lit sheet for every other (Paul, 2026-08-24, evening: "in general where
// there is ONE option a dropdown is preferred"). Measured, three taps in —
// add -> cantor -> "add cantor — like what?" — `prod.bare` draws a grid
// containing exactly one word; every other sheet on this page has several and
// is untouched.
import { sheet } from "./selects.js";
import { SYNTH_NAMES } from "../audio/to-engine.js";

const el = (tag, text, cls) => { const n = document.createElement(tag);
  if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };

const LINES = (doc) => doc.voices.filter((v) => v.kind === "line");
const BASSV = (doc) => doc.voices.find((v) => v.kind === "bass");
const DRUMV = (doc) => doc.voices.find((v) => v.kind === "drums");
const wordAt = (doc, v, i) =>
  (v && v.development && v.development[(doc.form.sections[i] || {}).id]) || "";

// THE FLEET, ONCE. document.js cannot ask audio/to-engine.js which instrument
// names are modelled Faust voices (it is UMD and requiring an ES module would
// stop it being node-requirable), so the caller says. ui/eight.js hands its own
// `genreFor` in at the push() seam; when nothing hands one in — the page's own
// draw(), a node gate — this is the compiler, and it is the SAME call.
let FLEET = null;
const fleet = () => (FLEET || (FLEET = SYNTH_NAMES()));
const compilerFor = (doc) => (si) => NuDocument.toGenre(doc, si, GENRES, fleet());

/* ================= THE HELD SET ========================================
   `model.song.knobs` is what THE HAND owns, and producer.js refuses to touch
   any field named in it (`:1183`, `:870`). It is a TABLE — one row per control
   this page draws, naming the kernel field that control writes — because a
   note that silently contradicts a visible control is exactly the fault the
   one-owner law exists to prevent. producer.js already forbids itself most of
   these by name (`:165-181`); the three it does NOT and this table takes away
   are `scale`, `diatonic` and `humanize`, and each of them has a control.

   ADDING A CONTROL TO THE PAGE MEANS ADDING A ROW HERE. Two deliberate
   absences, both named so nobody adds them by reflex:
     bpm      the producer's own `faster`/`slower` IS the tempo, and push()
              writes `setBpm(R.bpm)` — the note is visible and undoable.
     instr    "put the cantor on ahh choir" is the CAST verb and the only way a
              cast can be audible (audio/plan.js:207 reads the chair first).
              It contradicts the instrument sheet on purpose, in one visible
              line you can take off. */
const HELD = [
  { field: "key",      control: "alphabet.key" },
  { field: "mode",     control: "alphabet.mode" },
  { field: "scale",    control: "alphabet.mode (document.js writes scale from it)" },
  { field: "harmony",  control: "alphabet.harmony" },
  { field: "diatonic", control: "the diatonic checkbox" },
  { field: "prog",     control: "the chord grid" },
  { field: "roots",    control: "the chord grid" },
  { field: "meter",    control: "time.meter" },
  { field: "swing",    control: "time.swing" },
  { field: "rate",     control: "time.rate" },
  { field: "humanize", control: "the humanize slider" },
  { field: "voices",   control: "the cast — one line voice, one voice" },
];
const KNOBS = {}; for (const r of HELD) KNOBS[r.field] = r.control;
const modelOf = (doc) => ({ song: { bpm: doc.time.bpm, knobs: KNOBS } });
/** The held set, so a gate can assert the hand wins without retyping it. */
export const held = () => ({ ...KNOBS });

/* ================= THE CAST ============================================
   producer.js ships SEVENTEEN subjects and they are band-kit's band: keys,
   guitar, amp, voice, tune. Measured against the shipped chant, FIVE of the
   ten subjects offered for "make" do not exist on that record and NEITHER of
   the two voices that do was offered. So the cast is built from the DOCUMENT.

   REUSE MEANS REUSE. Every fixed row below is taken BY REFERENCE out of
   producer.js's own SUBJ, never retyped — and it is captured here, once, at
   module load, because `install()` empties `Prod.SUBJ`/`Prod.SUB` and a cast
   that left the drums out would leave the next cast unable to find them. */
const BASEROW = {}; for (const r of Prod.SUBJ) BASEROW[r.id] = r;
const BASEFIELDS = { ...Prod.SCOPEFIELDS };

// WHICH ADJECTIVE FAMILY AN INSTRUMENT BELONGS TO — producer.js's own FAM
// regexes, walked in producer.js's own order (FAM.tune is /./, the catch-all,
// and it is last in that object). Derived, never listed: a family added there
// is honoured here by existing.
const famOf = (instr) => {
  const s = String(instr == null ? "" : instr);
  for (const k of Object.keys(Prod.FAM)) if (Prod.FAM[k].test(s)) return k;
  return "tune";
};

/* THE DOCUMENT'S OWN WORD FOR SILENCE, COMPILED BY THE DOCUMENT'S OWN COMPILER.
   `out` is songs.js:63 — `[["drop", 1]]` — and what a Development word MEANS is
   `document.js opsOf`, which is not exported and must not be re-implemented
   here (that is the conversion done by hand, and it drifts). So this asks the
   compiler: a probe document whose every line voice says `out` everywhere,
   compiled once per revision, and `g.word(0, 0)` is the answer. */
function outOpsOf(doc) {
  const probe = { ...doc, voices: doc.voices.map((v) => v.kind !== "line" ? v
    : { ...v, development: Object.fromEntries(
        Object.keys(v.development || {}).map((k) => [k, "out"])) }) };
  try { return NuDocument.toGenre(probe, 0, GENRES, fleet()).word(0, 0); }
  catch (e) { return []; }
}

/* WHICH VOICE ACTUALLY SOUNDS, PER SECTION. `soundsOf` (producer.js:626) asks
   the kernel the same question about band-kit's four chairs — "does anything
   come out of this chair" — and it is allowed to, because here the render IS
   the subject. The eight-axes record has no `sec.pattern`/`sec.guitar`, so
   without this every projected voice reads as not playing and every sentence
   answers "the cantor is not playing on this record" WHILE THE RECORD MOVES.
   Measured once per revision; producer.js's own several-hundred-probe offering
   shares the answer through its WeakMap. */
function playsOf(doc, base, lines) {
  const cb = NuDocument.barsOf(doc);
  return base.map((sec, si) => {
    const on = new Set();
    const secId = (doc.form.sections[si] || {}).id;
    const total = Math.max(1, (sec.bars || 1) * cb);
    lines.forEach((c, ix) => {
      const ph = NuDocument.toPhrase(doc, NuDocument.materialAt(c, secId));
      let evs;
      // a throw is playable()'s problem, not the offering's — producer.js
      // `emits` takes the same view and for the same reason
      try { evs = render(ph, sec.genre, total); } catch (e) { on.add(ix); return; }
      for (const e of evs) if (e.v === ix) { on.add(ix); return; }
    });
    return on;
  });
}

/** The cast this document has: `{ key, subj, fields, sounds }`. */
export function castOf(doc, base) {
  const b = base || project(doc);
  const lines = LINES(doc), drums = DRUMV(doc), bass = BASSV(doc);
  const keys = NuDeskDoc.chairsOf(doc, GENRES);   // the desk's own address walk
  const plays = playsOf(doc, b, lines);
  const OUT = outOpsOf(doc);
  const hasDrums = !!(drums && drums.cast && drums.cast.on);
  const subj = [BASEROW.record];
  if (hasDrums) for (const id of ["drums", "kick", "snare", "hats", "toms",
                                  "cymbals", "perc"]) subj.push(BASEROW[id]);
  if (bass) for (const id of ["bass", "line", "bamp"]) subj.push(BASEROW[id]);
  const voiceRows = lines.map((v, ix) => voiceRow(doc, v, ix, keys[ix], plays, OUT, lines));
  for (const r of voiceRows) subj.push(r);
  subj.push(BASEROW.mix);

  const fields = {};
  if (hasDrums) for (const id of ["drums", "kick", "snare", "hats", "toms",
                                  "cymbals", "perc"]) fields[id] = BASEFIELDS[id];
  if (bass) for (const id of ["bass", "line", "bamp"]) fields[id] = BASEFIELDS[id];
  for (const r of voiceRows)
    fields[r.id] = () => [
      ["g.chairs." + r.ix + ".instr", "noun", (A) => Prod.pickInstr(A, r.as)],
      ["g.chairs." + r.ix + ".tone",  "obj",  (A) => A.tone]];
  fields.mix = () => [];
  // EVERYTHING BAND-KIT GAVE A CHAIR THAT IS A RECORD-LEVEL FACT HERE. `g.tone`,
  // `g.maxHold`, `g.phrase`, `g.orn`, `g.artic` are one statement for the whole
  // document (there is no per-voice slot for any of them), so they belong to
  // the record and to nothing else — one owner per fact.
  fields.record = () => [
    ...(hasDrums ? fields.drums() : []),
    ...(bass ? fields.bass() : []),
    ...voiceRows.flatMap((r) => fields[r.id]()),
    ["g.tone",    "obj",  (A) => A.tone],
    ["g.orn",     "obj",  (A) => A.orn],
    ["g.artic",   "noun", (A) => A.artic],
    ["g.maxHold", "num",  (A) => A.maxHold],
    ["g.phrase",  "num",  (A) => A.phrase],
    ["song.bpm",  "num",  (A) => A.bpm],
  ];

  const sounds = new Set();
  for (const s of plays) for (const ix of s) sounds.add("v:" + lines[ix].name);
  const key = JSON.stringify([doc.basis, lines.map((v) => [v.name, v.instrument,
    keys[lines.indexOf(v)], v.cast.part]), hasDrums, !!bass]);
  return { key, subj, fields, sounds };
}

/* ONE ROW PER VOICE — the only NEW row in the cast, and it is nine lines
   because the vocabulary was already there. */
function voiceRow(doc, v, ix, chairKey, plays, OUT, lines) {
  const id = "v:" + v.name;
  // THE ADDRESS WRITTEN IS THE ADDRESS RESOLVED. `chairKey` came from
  // NuDeskDoc.chairsOf — the SAME walk audio/desk.js voiceRoster makes and
  // desk-gate G2 pins — so a fader the producer writes on `line2` lands on the
  // second line voice and not on a channel that never existed. It is a PART
  // chan (a bare key), never `unit:` — that prefix is the kit's (desk.js:589).
  const row = {
    id, w: "the " + v.name, bare: v.name,
    under: null, kind: "chair", chan: [chairKey], ix,
    // which ADJ rows this voice inherits: producer.js's own FAM verdict on its
    // instrument, read by H3's `asOf`
    as: famOf(v.instrument),
    sounds: () => plays.some((s) => s.has(ix)),
    // is it out EVERYWHERE? (H2 — chairOut). Read off the document's own
    // development words, which is where a voice's silence is actually said.
    silent: (base) => base.every((s) => wordAt(doc, v, s.i) === "out"),
  };
  // THE RUBIN VERBS, NATIVELY. `take away` is the document's word `out`, and
  // `keep only` (producer.js:847) then works unchanged — every OTHER subject
  // gets `out`. Copy-on-write goes through producer.js's own `ownGenre` so the
  // base record is never edited under the page.
  row.out = (sec) => {
    const g = Prod.ownGenre(sec, "g");
    const gone = g.__pOut || (g.__pOut = new Set());
    if (gone.has(ix)) return false;
    // ...AND A RECORD MUST STILL PLAY. "Permissive, but every result must be
    // PLAYABLE" — so the LAST thing making a sound cannot be taken out. The
    // desk still mutes it (an offset, not an edit, and undoable); what is
    // refused is deleting the last events in the section. Without this, two
    // `take away`s on a two-voice chant compile a section with no events at
    // all, which is the one thing the completeness property forbids.
    if (!stillPlays(sec, gone, ix, plays, lines)) return false;
    gone.add(ix);
    if (!g.__pWord) g.__pWord = g.word;
    const b = g.__pWord;
    g.word = (vi, s) => (gone.has(vi) ? OUT : b(vi, s));
    return true;
  };
  row.in = (sec) => {
    const g = Prod.ownGenre(sec, "g");
    const gone = g.__pOut;
    if (!gone || !gone.has(ix)) return false;
    gone.delete(ix);
    return true;
  };
  return row;
}
// is there anything left in this section once `ix` goes? A bass, a drum that is
// actually hit (producer.js's own liveLanes reads the ARTIFACT, schedule and
// fill included), or another line voice that is not already out.
function stillPlays(sec, gone, ix, plays, lines) {
  const g = sec.genre;
  if (g && !g.nobass) return true;
  if (Prod.liveLanes([sec]).size) return true;
  const here = plays[sec.i] || new Set();
  for (let v = 0; v < lines.length; v++)
    if (v !== ix && !gone.has(v) && here.has(v)) return true;
  return false;
}

/* ================= INSTALLING IT =======================================
   `SUBJ` / `SUB` / `SCOPEFIELDS` are exported LIVE references (producer.js:1679)
   looked up at call time, so replacing their contents needs no producer.js edit
   and is entirely reversible. THE LAW IT ASSUMES IS ONE DOCUMENT PER PAGE, and
   `install` runs before every `produced()`, keyed on `cast.key`. */
let INSTALLED = null;
function install(cast) {
  if (INSTALLED === cast.key) return;
  Prod.SUBJ.length = 0; Prod.SUBJ.push(...cast.subj);
  for (const k of Object.keys(Prod.SUB)) delete Prod.SUB[k];
  for (const r of cast.subj) Prod.SUB[r.id] = r;
  for (const k of Object.keys(Prod.SCOPEFIELDS)) delete Prod.SCOPEFIELDS[k];
  Object.assign(Prod.SCOPEFIELDS, cast.fields);
  INSTALLED = cast.key;
}

/* ================= THE PROJECTION ======================================
   `project` MUST return the same array object per revision. producer.js memoizes
   the offering on the IDENTITY of the sections it was handed (`idOf`, a WeakMap,
   :1636) and `targetsFor` walks 122 anchors per subject per verb — a fresh array
   per call turns one redraw into several hundred full stack runs. */
let REV = 0, CACHE = null;
/** Bump the revision. `ui/eight.js changed()` calls this. */
export function revise() { REV++; CACHE = null; INSTALLED = null; }

function state(doc, genreFor) {
  if (CACHE && CACHE.rev === REV && CACHE.doc === doc) return CACHE;
  const gf = genreFor || compilerFor(doc);
  const base = doc.form.sections.map((s, i) => ({
    // the shape band-kit's toSong hands back, narrowed to what producer.js
    // actually reads: `role`, `i`, `genre`, `bars`. `i` is load-bearing — it is
    // how a row's own `out` knows which section it is in after `clone`.
    i, role: s.role, bars: s.bars, genre: gf(i) }));
  CACHE = { rev: REV, doc, base, cast: castOf(doc, base), probe: null, out: null };
  return CACHE;
}

/** The record as the document alone describes it — byte-identical to what
 *  `push()` compiled before this file existed. */
export function project(doc, genreFor) { return state(doc, genreFor).base; }

/* THE CHAIRS, ENRICHED — and ONLY on the produced copy. `touchChairs`
   (producer.js:523) rebinds `g.reg` and `g.realize` to read the COPIED chairs
   array, and document.js's chairs are `{synth}` / `{instr}` / `{}` with no
   `reg` and no `part` — so after one note `g.reg(0)` returned undefined where
   it had returned 0, and a moved register is a fact nobody hears. Enriched, the
   rebinding is a no-op and K.render is byte-identical (measured).

   NO `tone: {}` HERE, and that is a measurement rather than a preference:
   audio/plan.js:219 reads `(ch && ch.tone) || G.tone`, so an EMPTY tone object
   is truthy and OUTRANKS the genre's own — the shipped chant would have lost
   `verb 0.78` and `cut 2100` the moment a chair grew an empty tone. `sanitize`
   strips the empty one `touchChairs` adds for the same reason.

   And it is on the COPY, not in `toGenre`, for two reasons: the no-notes path
   stays byte-identical down to the key set (the absent-is-today law at its
   strongest), and `test/fixtures/terms-genre.json` — a frozen capture of
   `genreFor(i)` — pins `chairs` exactly, so enriching in document.js breaks
   `node test/document.test.js`. Verified: it does. */
function enrich(base, doc) {
  const lines = LINES(doc);
  return base.map((sec) => {
    const g = sec.genre;
    const chairs = (g.chairs || []).map((c, i) => {
      const cast = (lines[i] && lines[i].cast) || {};
      const pad = c.pad != null ? c.pad : cast.part === "pad";
      return { ...c,
        reg: c.reg != null ? c.reg : (cast.reg || 0),
        pad, part: c.part != null ? c.part : (pad ? "pad" : "line") };
    });
    return { ...sec, genre: { ...g, chairs } };
  });
}

/* ...and what has to be put back after the stack has run. Three repairs, each
   one measured:
     `tone: {}`      touchChairs gives every chair an empty tone; plan.js:219
                     lets it outrank the genre's own (above).
     `g.instr`       touchChairs writes `ch.map(c => c.instr)` at COPY time, so
                     it goes stale the moment applyRows switches a chair's
                     instrument (producer.js failure mode 6) — and a NATIVE
                     chair has no `instr` at all, so the array came back with a
                     hole where the chant's tract voice was. Recomputed off the
                     final chairs against the base's own list.
     `realize`/`part` touchChairs rebinds realize to `pad ? "pad" : "line"` and
                     ADDS `g.part`. This cast never moves a chair's part — the
                     Rubin verbs go through `S.out` instead — so the document's
                     own word is restored, and `g.part` is deleted unless the
                     basis anchor declared one. kernel.js:1387 applies PARTS'
                     ctr ±12 off `g.part`; inventing one MOVES THE MUSIC. */
function sanitize(secs, base) {
  secs.forEach((sec, i) => {
    const g = sec.genre, b = base[i] && base[i].genre;
    if (!g || !b || g === b) return;
    delete g.__pOut; delete g.__pWord;
    if (Array.isArray(g.chairs)) {
      for (const c of g.chairs)
        if (c && c.tone && typeof c.tone === "object" && !Object.keys(c.tone).length)
          delete c.tone;
      if (Array.isArray(b.instr))
        g.instr = g.chairs.map((c, ix) =>
          (c && c.instr != null) ? c.instr : b.instr[ix]);
    }
    g.realize = b.realize;
    if (!Object.prototype.hasOwnProperty.call(b, "part")) delete g.part;
  });
}

/** The record as the document PLUS what has been said about it.
 *  `{ secs, mix, bpm, said, base, cast, orphans }`. */
export function produced(doc, genreFor) {
  const st = state(doc, genreFor);
  if (st.out) return st.out;
  install(st.cast);
  const all = notes(doc);
  // A RENAMED VOICE ORPHANS ITS NOTES (`s: "v:cantor"` stops resolving). They
  // are dropped rather than thrown, and the page says so.
  const live = all.filter((n) => Prod.SUB[n.s]);
  const orphans = all.filter((n) => !Prod.SUB[n.s]);
  if (!live.length) {
    // ABSENT IS TODAY. `run` returns `secs0` BY REFERENCE with no notes
    // (producer.js:1187); this returns the projection itself, so `push()`
    // registers exactly the genres it registered before this file existed.
    st.out = { secs: st.base, mix: {}, bpm: doc.time.bpm, said: [],
               base: st.base, cast: st.cast, orphans };
    return st.out;
  }
  const R = Prod.run({ ...modelOf(doc), prod: live }, probeOf(st, doc));
  sanitize(R.secs, st.base);
  st.out = { ...R, base: st.base, cast: st.cast, orphans };
  return st.out;
}
// the sections the OFFERING and the MOVER both see: enriched once per revision,
// so producer.js's WeakMap caches key on one stable array
function probeOf(st, doc) {
  return st.probe || (st.probe = enrich(st.base, doc));
}

/* ================= THE NOTES ARE THE INTERFACE ========================= */
/** `DOC.produce`, producer.js's own note shape untranslated. Absent === []. */
export const notes = (doc) => (Array.isArray(doc.produce) ? doc.produce : []);
// null / [] DELETES the key, because absent is the only spelling of a default
// (PROGRAM.md §2.2, main:nukernel/ui/mixtbl.js:351).
function writeNotes(doc, list) {
  if (list && list.length) doc.produce = list; else delete doc.produce;
  revise();
}
const thru = (doc, fn) => writeNotes(doc, Prod.notesOf(fn({ prod: notes(doc) })));
/** Say a thing. Saying it again is a PUSH, not an eleventh line (producer.js:1657). */
export const say = (doc, verb, sid, dsc) =>
  thru(doc, (m) => Prod.addNote(m, verb, sid, dsc || null));
export const pushNote = (doc, i) => thru(doc, (m) => Prod.bump(m, i, +1));
export const pullNote = (doc, i) => thru(doc, (m) => Prod.bump(m, i, -1));
export const offNote  = (doc, i) => thru(doc, (m) => Prod.drop(m, i));
export const forget   = (doc)    => thru(doc, (m) => Prod.clearNotes(m));

/* ================= WHAT MAY BE SAID, AND WHY NOT =======================
   Paul: "when an option makes another one unaccessible gray it out." The
   subject tree and the adjective sheet are drawn WHOLE, with the withheld words
   greyed and THE REASON PRINTED — a fixed vocabulary (17 rows, 30 words) gets
   learned, and a sheet that changes shape under your thumb cannot be.

   EVERY REASON IS ONE OF `speak`'s OWN SENTENCES (producer.js:1389-1419),
   VERBATIM, so the page and the mover cannot drift: if the page says a word is
   unavailable and the mover would refuse it, they say the same thing. The two
   this table adds are about the OFFERING rather than the move, and they exist
   because "nothing would happen" is a different fact from "there is nothing
   there". */
const WHY = {
  nodrums:  "there are no drums on this record",
  notplaying: (S) => S.w + (/s$/.test(S.bare) && !/ss$/.test(S.bare) ? " are" : " is") +
                     " not playing on this record",
  nothing:  "there is no ",
  spent:    (w) => "it's as " + w + " as it's going to get",
  nomove:   (S) => "nothing here would move " + S.w + " on this record",
  notverb:  (V) => "there is nothing on this record to " + V.w,
  // producer.js VERBSOF's own reasons, one level up: "keep only the sound" is
  // keep only everything, an amp is a CHARACTER and not an amount, and the bass
  // line is what the bass plays rather than a thing you add.
  notsaid:  (V, S) => "\u201c" + V.w + " " + S.w + "\u201d is not a sentence",
  dishonest:(S) => "that is not an honest word about " + S.w,
  ceiling:  (n) => "that is " + n + " things — take one off before you say another",
};

const offeredSubjects = (st, doc, verb) => new Set(
  Prod.subjectsFor(modelOf(doc), probeOf(st, doc), verb).map((x) => x.id));

/** The six verbs, each with whether this record has anything to say it about. */
export function verbs(doc, genreFor) {
  const st = state(doc, genreFor);
  install(st.cast);
  return Prod.VERBS.map((v) => {
    const on = offeredSubjects(st, doc, v.id).size > 0;
    return { id: v.id, w: v.w, says: v.says, on,
             why: on ? null : WHY.notverb(v) };
  });
}

/** The WHOLE subject tree, each row with `on` and, when off, `why`. */
export function subjects(doc, genreFor, verb) {
  const st = state(doc, genreFor);
  install(st.cast);
  const offered = offeredSubjects(st, doc, verb);
  const probe = probeOf(st, doc);
  const kitless = !Prod.liveLanes(probe).size;
  return st.cast.subj.map((row) => {
    const on = offered.has(row.id);
    let why = null;
    if (!on) {
      if (!Prod.takes(verb, row.id)) why = WHY.notsaid(Prod.VERB[verb], row);
      else if ((row.lane || row.id === "drums") && kitless) why = WHY.nodrums;
      else if (!Prod.livesOn(probe, row))
        why = row.kind === "chair" ? WHY.notplaying(row)
                                   : WHY.nothing + row.bare + " on this record";
      else why = Prod.VERB[verb].d === "no" ? WHY.spent(row.bare) : WHY.nomove(row);
    }
    return { row, on, why };
  });
}

/** The targets for one (verb, subject): `{ bare, adj, gen, hidden }`.
 *  ADJECTIVES ARE DRAWN WHOLE (thirty words, learnable); ANCHORS ARE
 *  OFFERED-ONLY plus a count, because 122 greyed radios is a wall, not a sheet. */
export function targets(doc, genreFor, verb, sid) {
  const st = state(doc, genreFor);
  install(st.cast);
  const S = Prod.SUB[sid];
  const list = S ? Prod.targetsFor(modelOf(doc), probeOf(st, doc), verb, sid) : [];
  const on = new Set(list.map((o) => o.id));
  const gen = list.filter((o) => o.kind === "genre")
    .map((o) => ({ id: o.id, w: o.w, label: o.label, on: true, why: null }));
  const bare = list.filter((o) => o.kind === "bare");
  const adj = verb !== "make" ? [] : Prod.ADJ.map((a) => {
    const honest = a.on.includes((S && S.as) || sid);
    return { id: a.id, w: a.w, said: a.said, on: on.has(a.id),
             why: on.has(a.id) ? null
                : !honest ? WHY.dishonest(S || { w: sid })
                          : WHY.spent(a.w) };
  });
  return { bare, adj, gen,
           hidden: verb === "make" ? Object.keys(GENRES).length - gen.length : 0 };
}

/* ================= THE PAGE ============================================
   A ninth <h2> at the foot of the eight, saying in prose that it is NOT a ninth
   axis: the eight determine the SCORE, and this is a session fact — somebody
   with taste saying a few things about the record the eight describe
   (AXES.md:113, PROGRAM.md §2.1). */
let pverb = null, psubj = null;
const PASK = { make: "make what?", more: "more of what?", less: "less of what?",
               add: "add what?", away: "take away what?", only: "keep only what?" };

/** PROGRAM.md §2.2. Draws the producer into `parent`; returns a handle. */
export function mount(parent, ctx) {
  const doc = ctx.doc();
  const sec = ctx.section(parent, "ax-produce", "9 · The producer");
  sec.append(el("p",
    "Not one of the eight — this is somebody with taste saying a few things " +
    "about the record the eight describe. Every note is a step in genre space, " +
    "it remembers how far you pushed it, and taking it off puts the record back."));
  const R = produced(doc);
  // A LANDING clears the sentence being built, recompiles and redraws — the one
  // owner for recompile, exactly as `changed()` is for every sheet on the page.
  const land = () => { pverb = null; psubj = null; ctx.changed(); };

  if (R.orphans && R.orphans.length) sec.append(el("p",
    R.orphans.map((n) => n.s.replace(/^v:/, "") + " is gone — that note went " +
      "with it.").join(" "), "nu-hint"));

  if (R.said.length) notesTable(sec, R, ctx);

  const asked = el("div");
  sec.append(asked);
  if (notes(doc).length >= Prod.MAXNOTES && !pverb) {
    asked.append(el("p", WHY.ceiling(Prod.MAXNOTES), "nu-hint"));
    return;
  }
  if (!pverb) tapVerb(asked, doc, ctx);
  else if (!psubj) tapSubject(asked, doc, ctx, land);
  else tapTarget(asked, doc, ctx, land);
}

/* ---- WHAT HAS BEEN SAID, and what it did. THE NOTES ARE THE INTERFACE:
   a LIST the record remembers, each line carrying a continuous magnitude you
   push up and pull back, and the sentence in the band's own voice saying what
   it moved. The row heading is `sentence`, ASSEMBLED by the taps
   (producer.js:1443) and never parsed. */
function notesTable(parent, R, ctx) {
  const doc = ctx.doc();
  const t = el("table"); t.className = "nu-notes";
  t.append(el("caption", "what has been said"));
  const head = el("tr");
  for (const h of ["the note", "how far", "what it did", "change it"]) {
    const th = el("th", h); th.scope = "col"; head.append(th); }
  t.append(head);
  R.said.forEach((line, i) => {
    const tr = el("tr");
    const th = el("th"); th.scope = "row";
    const again = el("button", line.sentence);
    again.type = "button";
    again.dataset.k = "note|" + i;
    again.title = "say it again, harder";
    again.addEventListener("click", () => { pushNote(doc, i); ctx.changed(); });
    th.append(again); tr.append(th);
    // A REFUSED NOTE SAYS SO IN THE PERCENTAGE. `refused` is producer.js's own
    // flag (:1248) — read rather than matched on prose.
    const td1 = el("td");
    const pc = Prod.pct(line.note.w) + "%";
    td1.append(line.refused ? el("s", pc) : document.createTextNode(pc));
    tr.append(td1);
    tr.append(el("td", line.said.join(", ")));
    const td3 = el("td");
    const op = (word, k, fn) => {
      const b = el("button", word);
      b.type = "button"; b.dataset.k = k + "|" + i;
      // the sentence again, for a screen reader that hears only "more"
      const vh = el("span", " — " + line.sentence, "nu-vh");
      b.append(vh);
      b.addEventListener("click", () => { fn(doc, i); ctx.changed(); });
      td3.append(b, " ");
    };
    op("more", "pnup", pushNote);
    op("less", "pndn", pullNote);
    op("take it off", "pndel", offNote);
    tr.append(td3);
    t.append(tr);
  });
  const pane = el("div"); pane.className = "nu-pane"; pane.tabIndex = 0;
  // WHICH PANE THIS IS ACROSS A REBUILD (ui/eight.js keepPanes/putPanes,
  // 2026-08-25). The first control inside it, exactly as eight.js's own
  // `pane()` keys one: a note stack wider than the phone kept its sideways
  // scroll only by accident before, because every tap in it rebuilt the page
  // and the new pane started at 0.
  const p0 = t.querySelector("[data-k]");
  if (p0) pane.dataset.pane = p0.dataset.k;
  pane.append(t); parent.append(pane);
  const p = el("p");
  const clear = el("button", "forget all of it");
  clear.type = "button"; clear.dataset.k = "pclear";
  clear.title = "take every note off and hear the record the band made";
  clear.addEventListener("click", () => { forget(doc); ctx.changed(); });
  p.append(clear); parent.append(p);
}

/* ---- TAP ONE: THE VERB. Six, and the MINUS half is as strong as the plus —
   less, thinner, drier, gone — because subtraction is the half of production
   that has no knob on a desk. */
function tapVerb(parent, doc, ctx) {
  sheet(parent, { key: "prod.verb", label: "what do you want to say?",
    value: "", ungated: true,
    options: verbs(doc).map((v) => ({ value: v.id, label: v.w,
      disabled: !v.on, why: v.on ? null : v.why })),
    set: (v) => { pverb = v; psubj = null; ctx.redraw(); } });
}

/* ---- TAP TWO: THE SCOPE, AND IT GOES ALL THE WAY DOWN. The record, each
   player, each player's own components, the mix. "More drums" and "more kick"
   are the same sentence at two depths, and the depth is the sheet's own group
   heading. The word is `bare` for more/less and `w` otherwise, so a two-tap
   sentence is English: "more cantor", "take away the cantor". */
function tapSubject(parent, doc, ctx, land) {
  const rows = subjects(doc, null, pverb);
  const V = Prod.VERB[pverb];
  sheet(parent, { key: "prod.scope", label: PASK[pverb] || "what?",
    value: "", ungated: true,
    options: rows.map(({ row, on, why }) => ({
      value: row.id,
      label: (pverb === "more" || pverb === "less") ? row.bare : row.w,
      group: row.under ? (Prod.SUB[row.under] || {}).w : null,
      disabled: !on, why: on ? null : why })),
    set: (sid) => {
      // A VERB THAT TAKES NO DESCRIPTOR LANDS THE NOTE ON THIS TAP.
      if (V.d === "no") { say(doc, pverb, sid, null); land(); return; }
      psubj = sid; ctx.redraw(); } });
  back(parent, ctx, "start again", () => { pverb = null; psubj = null; });
}

/* ---- TAP THREE: THE TARGET — a word, or a record. */
function tapTarget(parent, doc, ctx, land) {
  const S = Prod.SUB[psubj] || { w: psubj };
  const t = targets(doc, null, pverb, psubj);
  const legend = (pverb === "add" ? "add " + S.w + " — like what?"
                                  : "make " + S.w + " — what?");
  if (t.bare.length) sheet(parent, { key: "prod.bare", label: legend, value: "",
    ungated: true,
    options: t.bare.map((o) => ({ value: "@bare", label: o.w })),
    set: () => { say(doc, pverb, psubj, null); land(); } });
  if (t.adj.length) sheet(parent, { key: "prod.word",
    label: t.bare.length ? "in a word" : legend, value: "", ungated: true,
    options: t.adj.map((a) => ({ value: a.id, label: a.w,
      disabled: !a.on, why: a.on ? null : a.why })),
    set: (id) => { say(doc, pverb, psubj, id); land(); } });
  if (t.gen.length) {
    sheet(parent, { key: "prod.record",
      label: (t.adj.length || t.bare.length) ? "or like a record" : legend,
      value: "", ungated: true,
      // THE ANCHOR'S OWN LABEL IS WHAT THE WORD MEANS — "punk" is New York
      // 1976 — and it belongs ON the option. The old page put it in a `title`,
      // which is invisible on a phone, and that is the only place this page is
      // really read (sheets.js says the same thing about `why`).
      options: t.gen.map((g) => ({ value: g.id,
        label: g.label ? g.w + " · " + g.label : g.w })),
      set: (id) => { say(doc, pverb, psubj, id); land(); } });
    if (t.hidden > 0) parent.append(el("p",
      "…and " + t.hidden + " other records this would not move.", "nu-hint"));
  }
  if (!t.bare.length && !t.adj.length && !t.gen.length)
    parent.append(el("p", "nothing here would move " + S.w +
      " on this record. Try another one.", "nu-hint"));
  back(parent, ctx, "back", () => { psubj = null; });
}

function back(parent, ctx, word, fn) {
  const p = el("p");
  const b = el("button", word);
  b.type = "button"; b.dataset.k = "pback|" + word;
  b.addEventListener("click", () => { fn(); ctx.redraw(); });
  p.append(b); parent.append(p);
}

// the sentence being built, for a gate and for a console. It is VIEW state —
// which tap you are on is not something the record says — so it lives here and
// not in the document.
export const asking = () => ({ verb: pverb, subject: psubj });
