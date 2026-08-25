// nukernel/ui/eight.js — THE EIGHT AXES, AS A PAGE. One record on the front
// door — "Terms and Conditions", songs.js — and a control for every axis it
// is made of, in the order the axes are evaluated (nukernel/AXES.md):
//
//   Time · Alphabet · Material · Form · Development · Cast · Sound · Performance
//
// THE BLOCKS BELOW STAND IN THAT ORDER TOO, and that is the only organising
// principle this file has: whatever draw() calls Nth is defined Nth. After two
// integrations it had stopped being true — the chord chart was written after
// the kit and the staves after both — and a file whose sections do not match
// its own stated order is a file nobody can find anything in.
//
// THREE THINGS ON THIS PAGE ARE NOT AXES, and each is drawn where it is named
// rather than smuggled into the eight: the PRODUCER's block at the foot of #app
// is a session fact, "the eight plus what was said" (AXES.md:113); the ATLAS
// above #app is a way IN to a record, not a part of one; and the BOARD under it
// is what the record lands on. Only the first is inside #app, because only the
// first edits the document.
//
// PLAIN HTML, AND ONE STYLESHEET (Paul, 2026-08-24: "keep the raw plain HTML
// but use more controls and a little bit of CSS. use more grid lines in tables,
// it will help"). This reverses 2026-08-23's "use simple HTML with no CSS or
// styling", and the measurement that reversed it is worth keeping: at 375px on
// 2026-08-24 this page scrolled 15px sideways, its 23 buttons were 21px tall,
// its 11 selects 19px, and its 96 radios 13x13. What is emitted here is still
// nothing but the elements a browser ships with — headings, paragraphs, tables,
// labels, fieldsets, radios, checkboxes, ranges, outputs, menus and buttons.
// (This counted them, and ended "and NOT ONE <select>: the eleven this file
// drew are the sheets now". It is rewritten rather than corrected because the
// count moved twice in one day and both moves were right — see A SHEET OR A
// MENU, AND WHICH ONE IS PAUL'S SENTENCE below. A census that has to be
// re-typed every time a control changes shape is a comment that will be wrong
// by tomorrow; what is worth writing down is the RULE, and the rule is there.)
// The sheet is nukernel/nu.css, it is the ONLY one, and
// this file styles nothing: it only emits nu.css's class names (§2.4). Three
// structures exist for the sheet's sake and are named where they are built —
// `axis()` (a sticky heading needs a containing block), `pane()` (a wide table
// scrolls inside itself or it scrolls the document) and index.html's .nu-bar.
//
// WHAT THE CLOCK MAY WRITE, AND IT IS A LAW OF THE WHOLE FILE (Paul,
// 2026-08-24: "When playing -- Don't change motifs visually or change the
// editing interface. It's too confusing when it changes. Instead, show the
// fully composed motif ABOVE the editable version of the motif."):
//
//   THE TRANSPORT FEED MAY ONLY WRITE INSIDE AN ELEMENT CARRYING `data-live`,
//   OR OUTSIDE #app ENTIRELY. Everything else in #app changes only in response
//   to a gesture of yours.
//
// There are TWO `data-live` values, and the count moved twice in two days:
// "count" is a playhead cell (see mark(), which refuses to mark anything else)
// and "score" is the two-measure system of the whole band at the top of the
// axis (Paul, 2026-08-25: "add a section ABOVE motifs which is the current
// playing music, two measures at a time, but ALL"). A third value, "played",
// existed for one day — a composed staff per voice inside every motif block —
// and it is gone, by Paul's own instruction the next morning: "you don't need
// to show me the interpreted notation for a motif, only the pure
// representation, because now I have the sheet music." Both paragraphs this
// replaces argued the COUNT ("there are exactly two and there is no third",
// then "what a third value costs is exactly one line"), and both were arguing
// about the wrong thing. The rule never was a number:
//
//   THE TRANSPORT FEED MAY ONLY WRITE INSIDE AN ELEMENT CARRYING `data-live`,
//   OR OUTSIDE #app ENTIRELY. Everything else in #app changes only in response
//   to a gesture of yours.
//
// A surface the clock writes on declares itself, in the HTML, where the gate
// can read the declaration — and window.__eightFrozen empties whatever
// declared itself, so values may come and go without one line changing there.
// Outside #app, and therefore free to move: the engine readout, the board's
// meters, the play button. Everything else — every fieldset, every radio,
// every slider, the written staff, the drum grid, the form table, the
// producer's notes — is FROZEN while the record plays, and a gesture-caused
// rebuild is not a violation: a page that moves because you touched it is a
// page doing what you said. The gate is test/motif-frozen.js, which asks the
// page itself what it marked live (window.__eightFrozen) rather than inventing
// an exclusion of its own, and it is the reason the two `draw()` calls that
// used to hang off the transport feed are `repaintScore()` now.
//
// DETERMINISM. Nothing here generates anything: every option in every menu
// comes from a table — songs.js WORDS for development, fields.js for keys,
// modes, instruments, kits and the section's own shape, askable.js for the
// three performance questions, kernel.js for the chord qualities. The page can
// only put the document into states the tables already name, so the record it
// describes is reproducible from the document alone, by anybody, forever.
import { GENRES, MODES, KEYS, ROLES, DRUMNAME,
         // WHAT CAN BE SAID HERE, AND WHAT SAYING IT WOULD DO. Sixteen option
         // tables left this file with the sixteen <select>s that read them —
         // KEYLABEL, MODELABEL, METERLABEL, SWINGLABEL, RATES, RATELABEL,
         // BASSOPS, KITLABEL, DRUMKITS, INSTRCHOICES — because a menu the page
         // assembles from one list and the gate measures from another is two
         // lists, and the second one is the one that is wrong. nukernel/avail.js
         // SHEETS is now the only place any of them is read for an option list.
         // (GENRES, MODES, KEYS and ROLES stay: the staff's engraving options,
         // the roman numerals and the form table read them as DATA, not as
         // menus. DRUMNAME arrives for the same reason the labels left — it is
         // genres.js's own name for a lane and this file had a nine-row copy.)
         NuAvail, NuGates,
         // HOW A DOCUMENT BECOMES A SCORE now lives in nukernel/document.js and
         // this file keeps no copy of it. It moved out because it was arithmetic
         // living in a view: `genreFor` was the document->genre compiler, it had
         // already been copied once into scratch/play-song.js (stale by months),
         // and three slices of this round have to call it from node where there
         // is no page. `SWINGS` and `METERS` left the import list with it —
         // genreFor was their only reader here.
         NuDocument, NuDeskDoc,
         // THE REGISTRY ITSELF, for `nudgesFor` — which of the eight axes a
         // control belongs to and the question a musician would ask it with.
         // The whole module rather than five more destructured names, for the
         // reason NuDocument takes one.
         NuFields,
         // THE SHIPPED RECORD (songs.js). It was read straight off window in
         // this file, which predated deps.js's own law; ui/atlas.js needs the
         // same table for "back to Rome 600", and a SECOND direct window read
         // is how a law stops being one, so both come through deps.js now.
         TERMS,
         NuSong } from "./deps.js";
import { adoptSong, SONG, SLOTS, putPhrase, on, commit, setBpm, setSwing,
         setMeter, setGroove, setMaster, setBuses, vol, setVol,
         // WHICH SECTION YOU ARE WRITING, adopted rather than reinvented.
         // ui/state.js has had this concept since audio/live.js:229 wrote the
         // reason down a month early — "The playhead marks which box is
         // SOUNDING; it must not move the SELECTION, or a click lands on
         // whatever bar happened to be playing" — and this page never took it
         // up: it kept a private `atSec` meaning both things at once, which is
         // exactly the confusion Paul named on 2026-08-24. Both names are
         // already exported, so this costs ui/state.js nothing, and two things
         // come free: adoptSong resets viewSec to 0, so a record swapped from
         // the atlas lands on section 1 by itself, and the daw and this page
         // end up meaning the same thing by "the section I am looking at".
         viewSec, setViewSec,
         // the mix-offset layer, which is the producer's own hand (D4)
         clearMixOffsets, setMixOffset,
         // the two song facts sectionRender needs and cannot see from a box
         GROOVE, SWING } from "./state.js";
// THE RENDERED EVENT STREAM, for the console hooks at the foot of this file
// only. D7's gate has to read what the band actually plays — velocities after
// the envelope, the intro and the outro have had their say — and that stream
// exists nowhere else (nukernel/document.js scoreOf is the PURE half and
// applies no envelope by design). Drawing never calls it.
import { sectionRender } from "./derive.js";
import { startAt, stop, playing, warmup, getPosition, passAt,
         engineLine } from "../audio/live.js";
import { registerSW, warmShell, warmCache } from "../audio/offline.js";
// ...AND THE SAME COMPILER ASSEMBLING A WHOLE SYSTEM. `toScore` is the score
// block's half of ui/abc.js: several parts under one head, barred together.
import { toEngraving, toScore } from "./abc.js";
import { SYNTH_NAMES } from "../audio/to-engine.js";
// ONE NAME, NOT TWO. `sheet` came with `sheetRow` and had no call site here —
// every question this page asks it asks two or three at a time, which is what
// `sheetRow` is for (see the `sh` note in THE MENU ERA below). It stays
// exported from ui/sheets.js, which is §2.3's fixed API; what came out is the
// import, because an unused name in an import list reads as a second way to do
// something and there is only one.
// ...AND A SECOND WIDGET FOR THE FACTS THAT ARE NOT A COMPARISON (2026-08-24,
// evening: "We can return some things to select menus … in general where there
// is ONE option a dropdown is preferred"). `sheetRow` comes from selects.js
// now: it is ui/sheets.js's own name and signature, re-exported through a
// router that draws a <select> for any spec offering one option and a lit sheet
// for every other. So this line, and not seven call sites, is where the
// one-option law is adopted. `selectRow` and `selectEl` are the controls Paul
// named by hand — a labelled row of them, and a bare one for a table cell.
import { selectRow, selectEl, sheetRow, keyCircle } from "./selects.js";
// THE ENGINEER (inside a voice's own sheet) and THE BOARD (at the foot of the
// page). Two surfaces because they are two things: `engineer` is per-voice
// sound, `mount` is the console. `paintBoard` repaints the automation meters
// from the position feed — a view is never handed the audio's clock.
import { engineer, mount as mountBoard, paintBoard } from "./engineer.js";
// THE PRODUCER (D4) — "somebody with taste saying a few things about the record
// the eight describe". It is not a ninth axis and it is not a second compiler:
// `produced()` is `genreFor` with the note stack applied, so push() below has
// exactly one place where a genre is registered, as it always did.
import { produced as producedDoc, revise as reviseProd,
         mount as mountProduce } from "./produce.js";
// THE ATLAS (D6), above #app: a time slider and a world map. It composes
// nothing itself — it picks a genre key, calls precompose.js and hands the
// whole record to CTX.setDocument.
import { mount as mountAtlas } from "./atlas.js";

// THE ONE GLOBAL LEFT IN THIS FILE, and it is deliberate rather than an
// oversight: `design()` calls `K[name](...)` with a name out of the DESIGNS
// table, so it wants the whole kernel module and not a list of destructured
// names, which is the one thing ui/deps.js cannot hand out.
// (WORDS left this file with `menuFor` — the development vocabulary is read by
//  nukernel/avail.js SHEETS["dev.line"] now, which is the same list the gate
//  measures against. TERMS was read off window here beside it until 2026-08-24;
//  the atlas needed the same table and it is imported from ui/deps.js above.)
const K = window.NuKernel;
const $ = (id) => document.getElementById(id);
// (the third argument is a CLASS, added 2026-08-25 and not a new idea here:
// ui/sheets.js:127 and ui/selects.js:87 have both spelled `el(tag, text, cls)`
// since they were written, and this file was the odd one out setting
// `.className` on the next line. Every existing two-argument call is unchanged.)
const el = (tag, text, cls) => { const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls; return n; };
// AND THE SAME THING IN THE OTHER NAMESPACE. `document.createElement("rect")`
// makes an HTMLUnknownElement that renders nothing — an SVG child has to be
// created in the SVG namespace or it is invisible and undebuggable. Spelled
// exactly as ui/atlas.js:182 and ui/globe.js:134 already spell it, because a
// third spelling of createElementNS is how the three drift.
const SVGNS = "http://www.w3.org/2000/svg";
const S = (tag, attrs) => { const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

// THE LIVE DOCUMENT. A deep copy, because songs.js is the shipped record and a
// page must never edit the table it was handed.
let DOC = JSON.parse(JSON.stringify(TERMS));
const GK = "lab.eight.";
// (`DEGREES = [0..6]` stood here. It was the degree menu's option list and it
//  outlived the menu by a round: the chord chart has been a SLIDER over the
//  same seven degrees since 2026-08-23 and read nothing from it.)
// (QUALITIES and PARTS came out 2026-08-24 with the two menus that read them:
//  avail.js SHEETS["alphabet.quality"] reads K.QSTEPS and K.QFIX and can say
//  which table a word came from, which the flat list could not, and
//  SHEETS["cast.part"] reads kernel.js PARTS — the same seven `realize` is read
//  against, in the kernel's own order rather than this file's.)
//
// A LANE'S NAME IS THE CATALOG'S. This was a nine-row table typed here, and the
// catalog uses EIGHTEEN keys: genres.js DRUMNAME names twelve (`f` pedal hat,
// `r` ride, `x` crash were all missing) and six more are SIDECARS — `?k` how
// often the kick sounds, `~r` how far the ride sits behind the grid, `!p` the
// grace note before the perc — which kernel.js:2304 reads WITH their lane and
// never as one of their own. A lane this page cannot name is still a lane, so
// it is drawn and it is round-tripped; what it is not is a checkbox.
const SIDECAR = { "?": "how often", "~": "how late", "!": "grace note" };
const laneName = (k) => SIDECAR[k[0]]
  ? (DRUMNAME[k.slice(1)] || k.slice(1)) + " · " + SIDECAR[k[0]]
  : (DRUMNAME[k] || k);
// A SIXTEEN-COLUMN GRID HAS TO FIT A PHONE, and the only lever plain HTML
// gives you is how many characters wide a cell is. So the columns are counted
// the way a drummer counts them — 1 e & a — which is one character, says where
// the beat is, and is the reason the table went from 423px to inside 390.
const COUNT = ["1","e","&","a","2","e","&","a","3","e","&","a","4","e","&","a"];

/* ---------- reading the document ----------------------------------------
   One object per voice, `kind` instead of special cases, words keyed by
   section id. Everything below asks through these six and nothing else
   reaches into the shape by hand. */
// the Faust voices this build can seat, by name — audio/to-engine.js SYNTH is
// the only table that knows, so it says so rather than the UI keeping a copy.
// It is handed to `toGenre` and put in `ENV` for the sheets, and those are its
// only two readers.
const NATIVE = SYNTH_NAMES();
// (`synthOf()` — the record's own synth, `doc.sound.synth` over the anchor's —
//  and `nativeOf(v)` — a voice's `{dsp, level, set}` if the fleet can seat it —
//  stood here. Both went dead in wave 1 without anybody noticing: document.js
//  toGenre does both jobs now, off the same `fleet` argument NATIVE is passed
//  in, and two spellings of "which synth" is exactly what the extraction was
//  for. Deleted 2026-08-24 rather than left as a second answer.)
const LINES  = () => DOC.voices.filter((v) => v.kind === "line");
const VOICE  = (name) => DOC.voices.find((v) => v.name === name);
const BASSV  = () => DOC.voices.find((v) => v.kind === "bass");
const DRUMV  = () => DOC.voices.find((v) => v.kind === "drums");
const SECID  = (i) => (DOC.form.sections[i] || {}).id;
const wordAt = (voice, i) => (voice && voice.development[SECID(i)]) || "";

/* ---------- the document becomes a genre, per section ---------- */
// The ANCHOR supplies every field no axis states — which is the whole claim of
// AXES.md made operational: a genre is a correlated point, the axes are the
// dimensions, and stating an axis moves the record off the anchor along it.
//
// THE COMPILER ITSELF IS NOT HERE ANY MORE. `genreFor`, `phrase`, the box map
// and `normalize` were seventy lines of pure arithmetic sitting in a drawing
// file, and scratch/play-song.js had a second, drifted copy of the same
// assembly. They are `nukernel/document.js` now — UMD, node-requirable, no DOM
// — and what is left below is the three-line binding that hands it this page's
// live document. Nothing about the record changed: test/document.test.js holds
// a capture of `genreFor(i)` taken off this file before the move and asserts
// `toGenre` still deep-equals it at every one of the five sections.
//
// THE FLEET IS PASSED IN. document.js cannot ask audio/to-engine.js which
// instrument names are modelled Faust voices — it is an ES module and a UMD
// file that requires it stops being node-requirable — so the view, which can
// import it, says. The chant's cantor is a `tract_voice`; get this wrong and
// its chair reaches audio/plan.js as a sampled `instr` instead of a synth.
const genreFor = (si) => NuDocument.toGenre(DOC, si, GENRES, NATIVE);
const phrase = (name) => NuDocument.toPhrase(DOC, name || cellSel);
const materialAt = NuDocument.materialAt;

// WHAT `cellSel` IS NOW. It said "which cell the maker is editing", and that
// was true while there was one maker and a strip to point it at. It has not
// been true since 2026-08-23 and it is less true than ever: there is one maker
// per CELL now, inside that cell's own block (motifs()), so there is no such
// thing as "the" cell being edited. What is left is a FALLBACK — the cell `phrase()` compiles when
// it is asked for nothing, and the cell a newly hired line is handed. Nothing
// on the page moves it; see the cell strip's tombstone below.
let cellSel = "hook";
const cellNames = () => Object.keys(DOC.material.cells);
// (`lineCells()` — the cells a LINE can read — stood here. Its only reader was
//  the cell strip below, and it was a second copy of avail.js:215's own
//  `lineCells(doc)`, which is the list the `cast.material` sheet offers and the
//  extractor measures. Deleted 2026-08-24 with the strip; a page that needs the
//  list again asks avail.js for it, so there is one list and not two.)
const cellOf = (name) => DOC.material.cells[name] || DOC.material.cells[cellNames()[0]];
/* A VOICE'S MATERIAL IS NOT ALWAYS A CELL NAME (PROGRAM.md §2.1, D5). It is a
   string OR a map of section id -> cell name, and every precomposed record
   writes the map — which the COMPILE path has always handled (`push` below
   calls `materialAt` per section) and the DRAW path did not. Measured on the
   rendered page at 390px on 2026-08-24, on a ska record loaded from the atlas:
   the staff's own label read `stab — [object Object] — as written`, and worse,
   `hookGrid` was handed that object as a cell NAME, so `cellOf` fell through to
   its "first cell" branch and the maker under bar 1 of the stab was editing
   somebody else's tune. Two helpers rather than a fix at each site, because
   there were six sites and they wanted two different questions asked:

   `cellAt(voice, si)` — WHICH CELL THIS VOICE READS IN THIS SECTION. That is
   what a staff engraves, what a maker edits and what the playhead counts bars
   against. A string voice returns its string, so the shipped chant is
   byte-identical — absent is today.
   `usesCell(v, name)` — WHETHER A VOICE READS THIS CELL AT ALL, in any section.
   That is what "shared with schola" and the fork button are about: sharing is a
   fact about the CELL, and a voice that reads `psalm` only in the verses is
   still sharing it. `===` on the material could only ever answer the first
   question, and on a map it answered neither. */
const cellAt = (voice, si) => materialAt(voice, SECID(si)) || cellNames()[0];
const usesCell = (v, name) => {
  const m = v && v.material;
  if (m == null) return false;
  if (typeof m === "string") return m === name;
  return Object.keys(m).some((k) => m[k] === name);
};

function push(first) {
  const secs = DOC.form.sections, NS = secs.length, lines = LINES();
  // THE PRODUCER IS A COMPILE STAGE, and this is the whole seam (D4). It is
  // handed `genreFor` and calls it once per section — the line that used to
  // stand here — so there is still exactly ONE place a genre is compiled. With
  // no notes `produced()` hands that projection straight back BY REFERENCE
  // (ui/produce.js:398), so `R.secs[i].genre === genreFor(i)`, `R.bpm ===
  // DOC.time.bpm`, `R.mix` is `{}`, and this page is byte-identical to the day
  // before the producer existed. That is producer G1, and it is the
  // absent-is-today law for the ninth top-level key.
  const R = producedDoc(DOC, genreFor);
  R.secs.forEach((s2, i) => { GENRES[GK + i] = s2.genre; });
  for (let i = NS; i < 64; i++) delete GENRES[GK + i];
  if (first) adoptSong({ v: NuSong.VERSION, bpm: R.bpm, genres: {},
    slots: [phrase(lines[0] && cellAt(lines[0], 0))],
    song: [{ ...NuSong.emptyBox(), stack: [{ g: GK + 0, slots: [0] }],
             len: secs[0].bars }] }, "eight");
  setBpm(R.bpm);
  setSwing(DOC.time.swing || null);
  setMeter(DOC.time.meter || null);
  // THE GROOVE IS A SONG FACT and this is the writer for it (ui/state.js:190),
  // which has existed since the day it was written and had never been called —
  // so no document could swing its backbeat however loudly it said so.
  // `setGroove` normalises anything GROOVELABEL does not name to null, so a
  // document that says nothing about groove is byte-identical to today.
  setGroove(DOC.time.groove || null);
  // ONE PHRASE PER VOICE PER SECTION, and the voice says which cell it reads.
  // ui/derive.js phrasesFor walks phrase index -> voice index, so slot v*NS+i
  // is voice v's material in section i — which is how two lines can be
  // genuinely different music rather than one subject seen twice.
  //
  // THE CELL IS ASKED FOR PER SECTION NOW. This banked ONE phrase into all of
  // a voice's slots, so `voice.material` could only ever be one cell for a
  // whole record — the banking machinery was already per section and the loop
  // was throwing that away. `materialAt` returns a string voice's string
  // untouched, so the shipped chant compiles the identical five slots per
  // voice; what it buys is a voice that can read `psalm` in the verses and
  // `neume` in the tag (PROGRAM.md §2.1, design 05 §2.1(a)).
  lines.forEach((c, v) => {
    for (let i = 0; i < NS; i++)
      putPhrase(v * NS + i, phrase(materialAt(c, secs[i].id))); });
  const boxes = NuDocument.boxesOf(DOC, GK);
  // THE SOUND AXIS, ONTO THE BOXES AND THE TWO SONG-LEVEL STORES. `parts` and
  // `fx` are the SAME objects on every box on purpose: the Sound axis is one
  // statement for the record, so a per-SECTION desk is not expressible and that
  // is the right answer for this axis until somebody wants a chorus louder than
  // a verse. What still moves per section is the DERIVED layer (audio/desk.js
  // shade() reads sec.lvl / sec.env), and the board shows it moving under a
  // fixed offset. All four are null / [] for a document that says nothing, which
  // is byte-identical to what this line produced before (desk-gate G1).
  const dparts = NuDeskDoc.deskPartsOf(DOC, GENRES), dfx = NuDeskDoc.boxFxOf(DOC);
  for (const b of boxes) { b.parts = dparts; b.fx = dfx; }
  setMaster(NuDeskDoc.masterOf(DOC));
  setBuses(NuDeskDoc.busesOf(DOC));
  // THE PRODUCER'S HAND ON THE DESK. Offsets ADD (audio/desk.js:593), so a note
  // that pulls the hats down cannot fight whoever is holding that fader on the
  // board — which is the whole reason the producer writes here and not into the
  // Sound axis. Cleared first because the layer is the WHOLE stack's, not a
  // running sum: taking a note off must take its fader off with it.
  clearMixOffsets();
  for (const [chan, vals] of Object.entries(R.mix))
    for (const [k, v] of Object.entries(vals)) setMixOffset(chan, k, v);
  SONG.length = 0; for (const b of boxes) SONG.push(b);
  commit("box"); commit("swing"); commit("transport");
  warmCache([]);
}

/* ---------- the page does not move under you --------------------------
   Pinning the tab strip once at the end of a redraw is not enough, and the
   reason is that the staves arrive LATE: abcjs is fetched and renders on a
   promise, so at the moment the rebuild finishes every staff host is an
   empty div and the page is hundreds of pixels shorter than it is about to
   be. Correcting the scroll then, and never again, is what made "up a step"
   jump — the correction was right for a page that had not finished existing.

   So the wanted position is REMEMBERED, and re-applied after every engrave
   that lands, for a second and a half. After that the window belongs to
   whoever is scrolling it.

   IT LOST ONE CALLER ON 2026-08-24 AND ANOTHER ON 2026-08-25, AND KEEPS THE
   REST. The composed staff's render callback ran on the CLOCK, and a scroll
   write on the clock is Paul's complaint in its most literal possible form —
   the page moving under a still thumb because a section changed — so that path
   never called this; the staff itself is gone now (THE MOTIF AS SHEET MUSIC,
   ONCE) and the score that replaced it does not call this either, for exactly
   the same reason. `transport:state` clears `anchorWant` outright when the
   transport starts, which is the belt over both braces. Everything else is exactly as real as it was: draw() still runs on
   every edit, every voice-tab tap and every section tap, the staves still
   arrive on a promise, and the page is still seventeen thousand pixels tall
   at 390px. This is insurance for the cold first load, not for the clock. */
let anchorWant = null, anchorAt = 0;
// WHICH ELEMENT IS BEING PINNED. It was always `#tabs`, because there was one
// rebuild and the voice tabs were the thing you had just touched. A section
// tap rebuilds the Material axis alone (drawMaterial, below) and the thing you
// have just touched is `#secs`, which is INSIDE what is being rebuilt — pinning
// the voice tabs there would hold still the one strip that is not moving and
// slide the staves you are looking at out from under you.
let anchorId = "tabs";
// ...and the window belongs to whoever is scrolling it the INSTANT they touch
// it. The correction is for a page that GREW UNDER A STILL THUMB; a moving
// thumb outranks it. (Measured 2026-08-24 on a warm local server: the
// correction is always <=1px, so this cancels nothing you can see — it is
// insurance for the cold first load and the slow phone, which is the only
// place the anchor can bite. Passive, because these listeners never prevent
// the scroll they are watching.)
// ANY TOUCH AT ALL, not just a scrolling one (Paul, 2026-08-24: "I click on
// the globe and you scroll me down the page. Stop scrolling when I touch the
// page in any way! I don't know where that's from."). It was from here. Only
// `wheel` and `touchmove` cancelled, so a TAP — which is a pointerdown and no
// move — left the correction armed; the tap then composed a whole new record,
// draw() armed the anchor on the old page's geometry, the staves arrived on
// their promise a beat later, and the page scrolled itself to put a tab strip
// where the previous record's tab strip had been. The user could not see the
// cause because the scroll happened hundreds of milliseconds after the tap.
//
// So the rule is now the one Paul stated, and it is the simpler rule anyway:
// the window belongs to whoever touched it, from the instant they touch it,
// whatever kind of touch it was.
for (const ev of ["wheel", "touchmove", "touchstart", "pointerdown", "keydown"])
  addEventListener(ev, () => { anchorWant = null; }, { passive: true });
/* ---------- WHICH HAND THE PAGE IS BEING USED WITH, AND WHY IT MATTERS ----
   Paul, 2026-08-25: *"When I select something the box just pops up again."*

   MEASURED, headed Chromium under Xvfb at 390x844, the whole of what the page
   does around one choice from a native menu (the X window count says whether a
   popup is open: 4 windows closed, 5 open):

     t+435ms  touchstart / pointerdown on select[data-k="sel|time.meter"]
     t+458ms  focus            — the platform's, the popup opens (4 -> 5)
     t+1520ms change           — the choice
     t+1577ms blur             — draw() has just emptied #app; THE SELECT IS GONE
     t+1792ms focus            — a BRAND NEW <select>, focused BY THIS PAGE,
                                 272ms after the gesture, from data-k

   The last line is the bug. A `<select>` that is focused is a `<select>` that
   is OPEN on iOS Safari — that is what the picker does when the element takes
   focus — so the page reaches back into a native popup a quarter of a second
   after the user has finished with it, and the box pops up again. Desktop
   Chromium does not re-present on focus (the count stays 4 after, measured),
   which is exactly why this only ever happened in Paul's hand.

   THE RULE, and it is the brief's own sentence: restoring focus is not a
   navigation and must never be a re-entry into a native popup. So a control
   with a picker behind it is not re-focused after a rebuild THAT A POINTER
   CAUSED. It IS re-focused after a rebuild a KEY caused, because arrowing a
   closed <select> fires `change` per step and a keyboard user who lost the
   control at the first arrow could not reach the second — and a key press is
   never the gesture that opens a picker on a touch device, because a touch
   device has no key to press.

   `<select>` is the only control on this page with a picker behind it: a
   range, a checkbox and a radio all take focus silently, and there is no
   date, colour or file input anywhere in nukernel/. */
let lastInputKind = "key";
for (const ev of ["wheel", "touchmove", "touchstart", "pointerdown"])
  addEventListener(ev, () => { lastInputKind = "pointer"; }, { passive: true });
addEventListener("keydown", () => { lastInputKind = "key"; }, { passive: true });
// ...AND `<select multiple>` IS NOT ONE OF THEM. A multi sheet draws one
// (ui/sheets.js, "Wherever we allow multiple selections use a standard
// multiselect form element please"), and a multiple select has no popup on any
// platform — on iOS it is a stacked list in the page, which sheets.js measured
// and wrote down. It is a listbox you keep your place in, so it is re-focused
// like every other control.
const opensAPicker = (n) => !!n && n.tagName === "SELECT" && !n.multiple;
// PUT THE THUMB BACK, UNLESS PUTTING IT BACK WOULD OPEN SOMETHING. One copy,
// because draw() and drawMaterial() must not be able to drift on this.
//
// AND WHEN IT DECLINES, IT DOES NOT JUST DROP YOU. Measured: with no focus put
// back at all, `document.activeElement` after choosing from a menu is <body> —
// which on a 17,000px page with a screen reader means the reader is at the top
// of the document and the person is nowhere near the menu they just used. So
// the focus goes to the nearest thing AROUND the control that has no picker
// behind it: the scroll pane it sits in if it has one (`.nu-pane` is already
// `tabIndex = 0`, because a region a mouse can scroll must be reachable from a
// keyboard), otherwise its axis — and an axis's first child is the sticky <h2>
// that names it, so what is announced is "3 · Sheet music" and not silence.
// `tabIndex = -1` is set on the axis at the moment of use rather than by
// axis(): it makes the section programmatically focusable and leaves it out of
// the tab order, and the next rebuild makes a section without it, so nothing
// accumulates.
function restoreFocus(root, wasKey, wasPicker) {
  if (!wasKey) return;
  const same = root.querySelector('[data-k="' + CSS.escape(wasKey) + '"]');
  if (!same) return;
  // preventScroll on every path here: restoring focus must not be a navigation
  if (!(wasPicker && lastInputKind !== "key")) {         // see opensAPicker
    same.focus({ preventScroll: true });
    return;
  }
  const near = same.closest(".nu-pane") || same.closest(".nu-ax");
  if (!near) return;
  if (!near.hasAttribute("tabindex")) near.tabIndex = -1;
  near.focus({ preventScroll: true });
}

/* ---------- A PANE KEEPS ITS SIDEWAYS SCROLL ACROSS A REBUILD ----------
   Paul, 2026-08-25: *"When I scroll right to edit motifs and tap something it
   snaps left even though I'm not done editing."*

   The motif edit itself no longer rebuilds anything (see `edited` below), so
   for THAT gesture this is not the answer — nothing is destroyed, so nothing
   has to be put back. This is for the rebuilds that are still real and still
   right, and there are plenty:

     CHOOSING A CHORD QUALITY in "the changes" changes what every other control
     may offer, so the page is rebuilt. That table is 379px wide in a 366px
     pane at 390 (13px over, 28 once a `nine` is in it; 83px over at 320) —
     small, and small is still the difference between reading bar 4 and reading
     bar 1. Measured 2026-08-25 at 320x844: scrolled to its own maximum of 83
     and a quality chosen inside it, the pane comes back at 83.
     RIDING A FADER re-mounts the board, which is one column per channel. The
     shipped chant has four and does not overflow at either width; a record
     with a dozen does.
     THE THIRD CASE WAS THE MOTIF GRID AND IT IS GONE, which is the honest way
     to say that this machinery lost its worst case rather than fixed it. It
     read: "TAPPING ANOTHER SECTION rebuilds the whole Material axis
     (drawMaterial) … the motif grid overflows its pane by 251px, the pane after
     the tap is a DIFFERENT element — and its sideways scroll now comes back at
     251 instead of 0." The rebuild is still real and still right; what changed
     is that the grid does not overflow anything any more (Paul, 2026-08-25:
     "Rotate the drum kits and motif editors to be vertical" — see `stepGrid`),
     so there is no sideways scroll left to lose. This is kept for the two
     panes above, which do still overflow.

   KEYED BY THE FIRST CONTROL INSIDE THE PANE, never by the pane's position.
   `data-k` is unique across a redraw and stable across one (PROGRAM.md §2.2),
   so "the pane whose first control is prog0d" survives a rebuild that adds a
   voice above it; "the third pane" does not. A pane with no control in it —
   the form table's read-only twin — keeps no scroll and needs none.

   AND A NEW RECORD IS A NEW PAGE: `setDocument` empties this, for the same
   reason it clears `anchorWant`. Restoring the old record's sideways scroll
   onto the new record's grids is not a correction, it is a guess. */
const paneScroll = new Map();
function keepPanes() {
  // ZERO IS A POSITION AND IT IS RECORDED LIKE ANY OTHER. Skipping it — "only
  // remember a pane that has been scrolled" — is a memory that cannot be
  // undone: swipe a grid to step 12, swipe it back to step 1, then change
  // something, and the page would put you back at step 12 because that was the
  // last position it thought worth writing down.
  for (const d of document.querySelectorAll(".nu-pane"))
    if (d.dataset.pane) paneScroll.set(d.dataset.pane, d.scrollLeft);
}
function putPanes() {
  for (const d of document.querySelectorAll(".nu-pane")) {
    if (!d.dataset.pane || !paneScroll.has(d.dataset.pane)) continue;
    // scrollLeft on a scroll container never moves the WINDOW, which is why
    // this can be done after the rebuild and before restoreAnchor(); and a
    // pane that came back NARROWER clamps its own value, so a grid that lost a
    // measure lands at its new end rather than out of bounds.
    d.scrollLeft = paneScroll.get(d.dataset.pane);
  }
}
// A CORRECTION IS SMALL BY DEFINITION, AND THIS IS THE CLAMP THAT SAYS SO.
// Measured 2026-08-24: the correction this exists for is <=1px on a warm
// server and a stave or two — call it a couple of hundred pixels — on a cold
// one. A tap on the globe replaces the WHOLE RECORD, and the "same" strip in
// the new page can be thousands of pixels from where the old one sat: measured
// from scrollY 300, a tap on London 1570 scrolled the window to 4795. That is
// not a correction, it is a navigation, and no arithmetic here can tell the
// difference after the fact. So the size says it: anything past MAX is a
// different page, and a different page keeps its own scroll.
const ANCHOR_MAX = 240;
/* AND WHAT THE CLAMP COST ON 2026-08-25, WRITTEN HERE BECAUSE THE NUMBER IS
   WHY `staffBox` EXISTS. Paul: "When I click tabs the page jumps around. It's
   endemic." He was right and this function was the trapdoor: the correction a
   band tab asked for grew with the record — 190px on the shipped chant, 286 at
   five tabs, 764 at ten — and the moment it passed 240 this declined, cleared
   `anchorWant`, and the whole jump landed on the page. A clamp that gives up
   hardest on the biggest page. The fix was NOT to widen it: the clamp is right
   and a big correction IS a navigation. The fix was to stop the page needing a
   big correction, by giving every staff its room before abcjs is asked for one
   (staffBox, above liveBlock). Measured after, at 390x844 and 1280x900, with
   `window.scrollBy` stubbed out so this function cannot help: every tab on the
   page moves the window 0px, up to ten voices. This is insurance again.

   HOW TO MEASURE A JUMP, SINCE TWO ROUNDS NOW HAVE MEASURED THE HARNESS
   INSTEAD. Playwright's `page.click()` calls the CDP scroll-into-view first,
   which CENTRES the target: from any scrollY, a click on the motif strip
   "landed" on 1851 and a band tab on 2933, and both are just
   `docTop + height/2 - innerHeight/2` for that button. The page had not moved
   — `scrollY` was already 1851 inside the pointerdown listener, before one
   line of this file ran. Tap the element at its own on-screen point
   (`mouse.click` / `touchscreen.tap` at its rect) and nothing is manufactured. */
/* ---------- AND #app IS NOT ALLOWED TO COLLAPSE WHILE IT IS REBUILT -----
   Paul, 2026-08-25: *"I click on 'leslie' and am immediately shot back up the
   page."*

   WHAT WAS MEASURED, and it is the honest half of this note. On desktop
   Chromium at 390x844 and 1280x900, choosing `leslie` in the engineer's
   character chips moves the window **0px** — before this change and after it.
   Measured with a real click at the option's own on-screen point and with a
   real touch (`touchscreen.tap`), from five scroll positions each, on the
   shipped chant and on a record with three and six extra voices, and at the
   very bottom of the page: `scrollY` 4311 → 4311, 4486 → 4486, 4233 → 4233,
   3980 → 3980 at 390; 4818 → 4818, 4638 → 4638, 4368 → 4368, 4098 → 4098 at
   1280. With `window.scrollBy` stubbed out, `restoreAnchor` was not asked for
   one pixel of correction either, and NO `scroll` EVENT FIRED AT ALL. So the
   mechanism is not one Chromium reproduces, and this file will not pretend it
   found it there.

   WHAT IS REAL AND IS FIXED HERE is the one thing `draw()` does that can lose a
   scroll position on any browser, and it is a different mechanism from this
   morning's staff-height reserve: `box.textContent = ""` COLLAPSES #app to
   nothing, and draw() then forces layout several times before it has refilled
   it (`reserveScoreCaption` and `fitSystem` both read a bounding box, and so
   does the anchor). Measured on the rendered page, 2026-08-25, on the shipped
   chant: emptying `#app` and forcing a read takes it from 3048px to **0** at
   390x844 and from 2959px to **0** at 1280x900, and the DOCUMENT with it, from
   6152 to 3099 and from 6257 to 3293. A browser that flushes layout in that
   gap must clamp `scrollY` to the new maximum, and a clamp is not reversible:
   `restoreAnchor` then sees a
   correction of thousands of pixels, which is past `ANCHOR_MAX` by design, so
   it declines and the whole jump lands on the page. That is "shot back up the
   page", exactly, and it is worse the further down the page the control is —
   which is where the engineer's chips are.

   THE FIX IS THE SAME SHAPE AS `staffBox` AND `scoreReserve`, one level up:
   the box is given the room it already had before it is emptied, and gives it
   back when the new page is standing. `min-height` and not `height`, so a
   rebuild that is genuinely taller is not clipped; released in a `finally`, so
   a throw inside draw() cannot leave the page propped open forever.

   With the hold applied, the same two reads give 3048 and 2959 — the box does
   not move at all, and the document comes back to 6147 and 6252, which is the
   same page to five pixels (the five is the <h2> margin the emptied section
   loses and gets back).

   IT CANNOT ITSELF CAUSE A JUMP. Between the reserve and the release the box
   is never SHORTER than it was, and a page that only ever grows during a
   rebuild is a page no scroll anchor has anything to correct. Measured after,
   at both widths: every control still moves the window 0px and the page height
   is unchanged to the pixel. */
function holdHeight(box) {
  if (!box) return () => {};
  const h = Math.ceil(box.getBoundingClientRect().height);
  if (!(h > 0)) return () => {};
  const was = box.style.minHeight;
  box.style.minHeight = h + "px";
  return () => { box.style.minHeight = was; };
}
function restoreAnchor() {
  if (anchorWant == null || Date.now() - anchorAt > 1500) return;
  const now = $(anchorId);
  if (!now) return;
  const moved = now.getBoundingClientRect().top - anchorWant;
  if (Math.abs(moved) > ANCHOR_MAX) { anchorWant = null; return; }
  if (Math.abs(moved) > 1) window.scrollBy(0, moved);
}
// ...and belt as well as braces: a redraw that is REPLACING THE RECORD arms no
// anchor in the first place. `draw()` calls restoreAnchor() at its own end, so
// clearing `anchorWant` after draw() returns is already too late — the scroll
// has happened synchronously inside it. This flag is read at both arming sites.
let anchorOff = false;

/* ---------- the controls ---------- */
// one paragraph per control, a label on every one, and the key it edits
// carried on the element so focus survives the redraw
const P = (parent, ...kids) => { const p = el("p");
  for (const k of kids) p.append(k); parent.append(p); return p; };
// THE ONE OWNER OF RECOMPILE, AND SINCE 2026-08-25 THERE IS A SECOND ROUTE
// PAST IT — written here rather than discovered, because the sentence this
// paragraph used to make was flat. It read: "Every control on this page — every
// sheet, every slider, every checkbox — ends here and nowhere else, which is
// what lets a view module redraw nothing itself (PROGRAM.md §2.2)." Both
// clauses still hold for every control OUTSIDE the two step grids, and the
// §2.2 clause holds absolutely: a VIEW MODULE still redraws nothing and still
// calls `ctx.changed()`, which is still this.
//
// What the grids do instead is `edited()`, below. It is not a second compiler
// and it is not a shortcut: it makes the same two calls this line makes —
// `reviseProd(); push();` — and then repaints the two staves the edit is
// visible in, instead of tearing down and rebuilding the page the finger is
// resting on. The argument, the measurement and the list of everything that
// reads a cell are on `edited` itself.
// ...and the producer is told the record moved. `produced()` memoizes on the
// revision because producer.js keys its offering cache on the IDENTITY of the
// sections it was handed (a WeakMap, producer.js:1636) and `targetsFor` walks
// 122 anchors — a fresh array per call turns one redraw into several hundred
// stack runs. Nothing else may bump it.
const changed = () => { reviseProd(); push(); draw(); };

/* ---------- AN EDIT THAT CHANGED ONE NUMBER DOES NOT REBUILD THE PAGE ----
   Paul, 2026-08-25: *"When I scroll right to edit motifs and tap something it
   snaps left even though I'm not done editing."*

   MEASURED at 390x844 with the motif pane swiped to step 12 (scrollLeft 251),
   nudging one degree slider through `changed()`: the pane you had swiped was a
   different element afterwards, its scrollLeft was 0, and the slider under your
   finger went from screen (170, 406) to (421, 216) — 251px off the right edge
   of a 390px phone and 190px up the page — for 174ms of frozen main thread.
   At 1280px the same nudge cost 212ms and moved the slider 197px up. That is
   MOTIF.md's "STILL NOT COVERED" item 1, and it is this.
   (HALF OF THAT MEASUREMENT CANNOT HAPPEN ANY MORE, and the half that can is
   why this is still here. The grid was rotated on 2026-08-25 and has no pane
   and no sideways scroll — so "swiped to step 12" and "251px off the right
   edge" describe a shape the page no longer has. THE JUMP UP THE PAGE AND THE
   174ms DO NOT DEPEND ON THE PANE: they are the whole document being rebuilt
   because you moved a number, and that is what everything below prevents.)

   THE CHEAP ANSWER WAS TO PUT THE SCROLL BACK. It is written and it is above
   (keepPanes/putPanes) — because rebuilds that ARE necessary still happen and
   they still throw the sideways scroll away. It is not the answer HERE. A
   degree is a number in a cell; the page has exactly three readers of it, and
   all three are inside the block the grid is already sitting in:

     the slider itself   the browser has already moved it, and `input` has
                         already moved its readout — nothing to do
     the written staff   re-engraved, by name, from the cell (reEngraveWritten)

   (A THIRD READER STOOD HERE — "the composed staves, repainted by the same pass
   the clock uses, with the same change detector (repaintPlayed)". Those staves
   were deleted on 2026-08-25 and the SCORE at the top of the axis is not a
   replacement reader: it draws the SOUNDING section from the engine's own
   stream and only the clock moves it, so an edit made while stopped shows up
   there on the next tick or the next play. That is the same standing that the
   producer's block has, three paragraphs down, and for the same reason.)

   Nothing else on the page reads a degree, AND THAT IS CHECKED RATHER THAN
   ASSUMED. The availability table takes exactly three facts from Material and
   here they are, all of them (nukernel/avail.js `factsOf`):

     f["material.cells"]       how MANY cells there are
     f["material.hasDrumCell"] whether any of them has kind "drum"
     f["voice.cellKind"]       the kind of the cell this voice reads

   A count and two kinds. Not one of them looks inside `deg`, `play`, `vel`,
   `acc` or a drum `lanes` array, so an edit to a cell's CONTENTS cannot change
   what any sheet or menu on the page may offer and cannot grey or ungrey a
   single option. Two other gestures in this block are NOT that: `give <voice>
   its own copy` makes a new cell and moves the count, and `± measure` changes
   how many grids and staves the block has. All three keep `push(); draw();`,
   and `reEngraveWritten` checks the bar count anyway.

   So none of them is torn down, which is stronger than putting the
   scroll back: the pane is the SAME ELEMENT, the slider is the SAME ELEMENT,
   your finger never leaves it, and the window is not touched at all.

   WHAT THIS DOES NOT REFRESH, SAID OUT LOUD. The producer's block (9) offers a
   list of targets computed against the record, and this leaves it standing.
   That is honest rather than lazy: the list is only ever COMPUTED when a verb
   and a subject have been picked, and picking either goes through
   `ctx.redraw()` — a full `draw()` — so the list a person can see was built by
   the tap that showed it. A record edited between that tap and the next is one
   gesture stale, and the next tap in the block rebuilds it.

   `reviseProd()` and `push()` are NOT optional and are the same two calls
   `changed()` makes: the document really did change, the producer's memo is
   keyed on the revision, and the engine has to be handed the new tune or the
   page would draw one thing and play another. What is dropped is `draw()`. */
const edited = (cellName) => {
  reviseProd(); push();
  reEngraveWritten(cellName);
};

/* THE VIEW-MODULE CONTEXT (PROGRAM.md §2.2), built once and handed to every
   module that draws. `doc` is a FUNCTION and never a field: DOC is reassigned
   when a record is swapped, and a module that captured it would be editing a
   document nobody is playing.
   `section` and `heading` are this file's own axis()/heading() (08-shell R6),
   not a second pair — the two signatures §2.2 fixes are exactly theirs, so
   ui/engineer.js's fallback to building its own <section class="nu-ax"> is
   now dead code rather than a second definition of what an axis looks like.
   (It was engineer.js:358 when this was written and it is :388 now, which the
   board's menus becoming sheets moved; the claim is about the fallback, not
   about the line, so the line is not quoted any more.) */
// THE MOUNTED ATLAS, held so that a document swap can move its ring. It is
// `let` and starts null because the atlas is mounted at the foot of the boot
// block, long after CTX is built — and CTX.setDocument is a closure, so it
// reads whatever is here when it is CALLED.
let ATLAS = null;

const CTX = {
  doc: () => DOC,
  changed: () => changed(),
  redraw: () => draw(),
  section: (parent, id, title) => axis(parent, id, title),
  heading: (parent, text) => heading(parent, text),
  // `showing` moves the `here` ring, snaps the slider to the record's year and
  // turns the globe to its place if the place is not already on screen. It
  // NEVER composes — the pick path is a tap or an Enter on a mark, never this
  // one — so this cannot loop back through setDocument.
  // AND A NEW RECORD IS A NEW PAGE, so nothing about the old one's scroll is
  // worth keeping. `draw()` arms the anchor from whatever geometry it finds;
  // clearing it AFTER the draw is what stops a globe tap from dragging the
  // window down to where the previous record's tab strip used to be. The
  // correction exists for a page that grew under a still thumb mid-edit, and
  // this is not that.
  setDocument: (next) => { stop(); DOC = next; normalize(); push(true);
                           anchorOff = true;                 // see ANCHOR_MAX
                           paneScroll.clear();      // a new record is a new page
                           staffBox.clear();        // …and so are its staves
                           try { draw(); } finally { anchorOff = false; }
                           anchorWant = null;
                           if (ATLAS) ATLAS.showing(DOC.basis); },
  // on() returns nothing today, so this returns undefined rather than an off().
  // Nothing mounted in W2 calls it — the board is painted from the page's own
  // on("pos") handler below — but a W3 module that wants to unsubscribe has to
  // be given something to unsubscribe WITH, and that is a change to ui/state.js.
  onPos: (fn) => on("pos", fn),
};

/* ---------- FOUR HELPERS THAT ARE NOT COMING BACK -----------------------
   Four helpers stood between `changed()` and the controls and every one of them
   existed to make a HAND-BUILT <select> bearable. They are named together
   because they went for one reason (2026-08-24, morning: "the options for each
   instrument in a song section are now just one thing in a dropdown. That's not
   effective."), and a reader who greps for one of them should find the other
   three beside it.

   THIS BLOCK SAID "THE MENU ERA, AND WHAT IS LEFT OF IT", AND THE ERA DID NOT
   END — Paul asked a named list of menus back the same evening and this file
   draws fifty-two of them. The heading is rewritten and the tombstones are
   kept, because what went is still gone and for a reason the reversal does not
   touch: these four assembled a menu BY HAND, out of a table this file chose,
   with the label placed by hand and the option list built here. A menu is drawn
   from a §2.3 spec now — `selectRow` / `selectEl` in ui/selects.js, off the
   same `optionsFor` result a sheet takes — so none of the four has a job even
   though the control they were written for is back on the page.

   `field(parent, key, label, node)` — one labelled paragraph per control — was
   `select`'s and only `select`'s. `number` and `check` each build their own
   <label> now, because each has a second child to place: the readout beside a
   slider, the word after a box.
   `opts(list, labels)` turned a table into an option list; that is avail.js's
   job now, because the extractor has to read the same list the page draws.
   `pick(key, options, value, set, aria)` was a <select> with no label of its
   own, for a table cell. Six of its seven call sites are sheets: eighty
   instruments and sixty-eight kit words never fitted in a table cell, which is
   exactly the complaint that opened this round. The seventh — the chord quality
   — is a <select> in a table cell again ("chord quality can be selects inside
   the 'the changes' table"), and it is `selectEl(shSpec(...))`: eight words DO
   fit in a cell, and what `pick` could not do was take an option list it had
   not been handed by hand.
   `sh(parent, key, scope, label)` — one sheet on its own — was written for a
   caller with a single question to ask and never found one: every site in this
   file asks two or three at once and goes through `sheetRow`. It came out
   2026-08-24 rather than being kept warm for a caller that has not arrived in
   three rounds; `sheetRow(parent, null, [shSpec(...)])` is the one-sheet form,
   and it still cannot be handed a spec that did not come from `optionsFor`.
   ui/sheets.js's own `sheet()` is the same story one level down: it is §2.3's
   API and stays exported, but this file stopped importing it on 2026-08-24
   because it had no call site either. */
/* ---------- A SHEET OR A MENU, AND WHICH ONE IS PAUL'S SENTENCE ---------
   TWO INSTRUCTIONS, SIXTEEN HOURS APART, AND NEITHER IS A CORRECTION OF THE
   OTHER. Both are quoted here because a reader who meets a lit sheet beside a
   dropdown must be able to see that the page is following a rule and not a mood.

     2026-08-24, MORNING — "the options for each instrument in a song section
     are now just one thing in a dropdown. That's not effective. sheets of
     organized options should light up. when an option makes another one
     unaccessible gray it out."
     2026-08-24, EVENING — "We can return some things to select menus: meter /
     reading speed / swing / key (although please spell things out like not just
     A# but A#/Bb) / mode / the changes / chord quality can be selects inside the
     'the changes' table … in the band 'form' section -- return to
     dropdowns/select … in voices -- plays, material, instrument --
     dropdowns/selects … in general where there is ONE option a dropdown is
     preferred."

   THE MORNING SENTENCE IS ABOUT THE DEVELOPMENT WORDS. `dev.line`, `dev.bass`
   and `dev.kit` are a per-voice, per-section choice among twenty-one melodic
   operators or sixty-eight kit words, and there you are SHOPPING: you want to
   see them all at once, and "you cannot say that here, because there is no
   drummer" is the most useful thing this page can tell you. They are lit sheets
   and this round did not touch them.

   THE EVENING SENTENCE IS ABOUT SETTLED PARAMETERS. The meter, the key, the
   mode, what a voice plays, which cell it reads, what a section IS — one value,
   decided once, that nobody browses. A lit sheet of twelve keys is twelve tap
   targets and 500px of page spent saying a thing that fits in a word. Those are
   menus, and each call site below quotes the clause that made it one.

   ...AND ONE OPTION IS ALWAYS A MENU, wherever it falls: `sheetRow` is imported
   from ui/selects.js, which re-exports ui/sheets.js's name and signature through
   a router that counts a spec's options. A lit grid of one is a label pretending
   to be a choice. Measured over all 130 genres, 25,650 sheet renders in these
   eight axes, ZERO with one option — so here it is a guard, and the one place
   the shipped page could reach it is the producer's third tap (ui/produce.js).

   ui/sheets.js IS NOT DEPRECATED and must not be deleted. Both widgets take the
   same spec (PROGRAM.md §2.3) precisely so a control can move between them on a
   sentence like tonight's without its data tier moving an inch — which is why
   this whole round is one word per call site and no change at all to avail.js's
   `optionsFor`, gates.js or the extractor.

   THIS IS THE WHOLE OF WHAT THIS FILE KNOWS ABOUT AVAILABILITY: it hands the
   live document, a scope and a bare sheet key to nukernel/avail.js and draws
   what comes back. Which option is greyed, and why, is measured — nothing in
   this file may decide it, and neither widget may be handed an option list this
   file assembled itself.

   THE KEY THE SHEET GETS IS SCOPE-QUALIFIED and the key `gates.js` is indexed
   by is BARE. A radio group's `name` is global to the document, so two voices'
   development sheets sharing the bare key `dev.line` would be ONE group and
   the second one drawn would silently uncheck the first — the same class of
   bug this page has already shipped once (`hookCells`, the shared header array
   in the hook maker). */
const ENV = { fleet: NATIVE };
const shKey = (key, scope) => [key, scope.voice, scope.section,
    scope.bar == null ? null : "bar" + scope.bar]
  .filter((x) => x != null).join("|");
// ONE SPEC, EITHER WIDGET, resolved but not appended. `sheetRow` and
// `selectRow` each take a list of these and `selectEl` takes one bare, for a
// table cell; nothing here knows or cares which is going to draw it, which is
// what let tonight's reversal be one word per call site (PROGRAM.md §2.3).
// (This said "`sh` is the one-sheet form that appends". `sh` came out on
// 2026-08-24 — see the tombstone above — so the reference went with it.)
function shSpec(key, scope, label) {
  const row = NuAvail.SHEETS[key];
  const r = NuAvail.optionsFor(DOC, scope, key, NuGates, ENV);
  return { key: shKey(key, scope), label: label == null ? row.label : label,
           options: r.options, value: r.value, why: r.why, ungated: r.ungated,
           // ONE OWNER FOR RECOMPILE, and it has survived both reversals:
           // neither widget ever redraws, `changed()` does — exactly as the
           // hand-built `select()` did before either of them existed.
           set: (v) => { row.set(DOC, scope, v, ENV); changed(); } };
}
/* THE ARRANGEMENT OF THE CIRCLE, WHICH IS THIS FILE'S JOB AND NOT THE WIDGET'S.
   ui/selects.js draws twenty-four radio-labels at twelve hours; WHICH key is at
   which hour, and which minor is relative to it, is arithmetic, and arithmetic
   about keys belongs to fields.js (FIFTHS, relMinorOf, RELMINNAME, minorish —
   see the block beside KEYNAMES for why the ring's fifths-proper spelling and
   the menu's both-ways spelling were never actually in conflict). What is left
   here is the one thing only this file can do: read the live document and say
   what is TRUE right now, and hand back the two `set`s that make it true.

   TAPPING AN INNER MINOR IS TWO WRITES AND ONE REDRAW. `changed()` is the one
   owner of recompile on this page, so the mode and the key move together in a
   single call and the engine is asked to rebuild once — the same shape the old
   band-kit circle had when it made two `answer()` calls on an immutable model.
   `aeolian` and not `minor`: avail.js offers the mode from genres.js MODES,
   whose name for natural minor is `aeolian` (fields.js's own KEYMODES adds a
   `minor` alias for a different table, and writing it here would put a word in
   `DOC.alphabet.mode` that the menu beside the circle could not show).

   AND THE RING STAYS LIT WHEN YOU COLOUR IT. `minorish` asks the interval table
   for a minor third rather than asking for the word "aeolian", so A dorian and
   A harmonic minor keep the Am position checked: you said minor with the
   circle and then said WHICH minor with the menu, and the page must not act
   like it forgot where you are standing. */
function fifthsRing() {
  const F = NuFields;
  return {
    outer: F.FIFTHS,
    inner: F.FIFTHS.map((k, hour) => {
      const tonic = F.relMinorOf(k);
      return {
        value: tonic,
        word: F.RELMINNAME[hour],
        // THE BOTH-WAYS SPELLING, SAID BUT NOT DRAWN. "D♯m" is what fits on the
        // tightest twelve positions on the page; "D♯/E♭ minor" is what a
        // screen reader gets beside it, built from the same KEYLABEL the outer
        // ring wears so the two can never drift. `.nu-vh` ADDS to what is
        // heard and never replaces it (nu.css).
        say: F.KEYLABEL[String(tonic)] + " minor",
        // `String()` on both sides because a record loaded from JSON can carry
        // its key as text and only becomes a number the first time avail.js's
        // `set` runs (`doc.alphabet.key = +v`). A ring that went dark on a
        // freshly-loaded song and lit on the second edit would be the worst
        // kind of bug: intermittent, and only in the picture.
        // ...and an UNSET mode is minorish, which is not a special case but the
        // engine's own default said out loud — kernel.js reads `g.mode || MODE`
        // and MODE is natural minor, so a record that has never named a mode
        // really is sounding one, and the ring says where it is standing.
        on: String(DOC.alphabet.key) === String(tonic) &&
            F.minorish(DOC.alphabet.mode),
        set: () => { DOC.alphabet.key = tonic; DOC.alphabet.mode = "aeolian";
                     changed(); },
      };
    }),
  };
}
// EVERY NUMBER IS A SLIDER (Paul, 2026-08-23: "use range sliders for numeric
// inputs"). A range with no readout is unusable, so each one carries its
// value as text beside it — and the two events do different jobs: `input`
// moves the readout as your finger moves, `change` commits and recompiles.
// Recompiling on every frame of a drag would thrash the engine mid-bar.
// ...AND `commit` IS WHICH REBUILD THIS SLIDER IS WORTH. It defaults to
// `changed()` — the whole page — because that is what every slider on the page
// cost until 2026-08-25, and most of them still should: moving the tempo can
// change what other controls may offer. The motif grid passes its own, because
// a degree is a number in a cell and nothing else on the page reads it except
// the two staves the grid sits between (see `edited`, below).
function range(key, value, set, min, max, step, aria, cls, fmt, wide, commit) {
  const r = document.createElement("input");
  r.type = "range"; r.min = String(min); r.max = String(max);
  r.step = String(step == null ? 1 : step);
  r.value = String(value);
  r.dataset.k = key;
  if (aria) r.setAttribute("aria-label", aria);
  /* ---------- THE FIVE WRITES THAT MADE A SLIDER VERTICAL, AND WHY THERE ARE
     NONE LEFT ------------------------------------------------------------
     This argument was called `vertical` and it wrote `orient="vertical"`
     (Firefox's attribute), `writing-mode: vertical-lr` (what every other
     browser reads) and `direction: rtl` (which puts the MAXIMUM at the top) on
     the element itself. The comment here defended them as GEOMETRY RATHER THAN
     STYLE — "a VERTICAL range does not exist in HTML … with CSS off, those
     three still draw a vertical slider with its maximum at the top, and the row
     still draws the tune" — and that was true for as long as the tune was drawn
     ACROSS.

     PAUL ROTATED THE GRID (2026-08-25: "Rotate the drum kits and motif editors
     to be vertical. They'll fit on a phone screen that way"), and a tune drawn
     DOWN the page wants its pitch along the row, which is what a plain
     horizontal <input type=range> already is. So all three writes are gone, and
     with them the `[orient=vertical]` exception in nu.css and the physical
     `width`/`height` pair that had to be spelled the awkward way because those
     elements' inline axis was the vertical one. The parameter that carried them
     is now `cls` and carries nothing but a CLASS — which is what the last two
     of the five had already become on 2026-08-25, when the height and the width
     went to the stylesheet: "a number that changes with taste belongs where the
     other tap-target numbers live". nu.css `.nu-hr-deg` / `.nu-hr-vel`.

     ONE THING TO KNOW IF A VERTICAL SLIDER IS EVER WANTED AGAIN: it is those
     three writes and not one, and `direction: rtl` is the one everybody
     forgets — without it the maximum is at the BOTTOM and the picture is the
     tune upside down. */
  if (cls) r.classList.add(cls);
  // AND ONE WIDTH SAID INLINE, for the one caller that is not in a step grid.
  // A horizontal range is 129px by browser default — not a designed number,
  // just a default — and two of them in one row with a three-letter readout
  // put the chord grid 12px past a phone. (This used to read "the same
  // concession sideways", beside a height; the height is gone with the
  // vertical sliders and this is what is left. It stays an inline `wide`
  // rather than a class because the chord chart's 84px is one number for one
  // table, where the step grids' two are a vocabulary nu.css names.)
  if (wide) r.style.width = wide;
  const say = (v) => (fmt ? fmt(+v) : String(v));
  const out = el("output", say(value));
  r.addEventListener("input", () => { out.textContent = say(r.value); });
  r.addEventListener("change", () => { set(+r.value); (commit || changed)(); });
  return { r, out };
}
/* ---------- THE QUESTION FIRST, THE CONTROL UNDER IT --------------------
   Paul, 2026-08-25: *"Put interactive elements on new lines below the titles
   or questions."*

   Both helpers used to put the words and the control on ONE line inside the
   <label> — `<label>tempo <input><output></label>` and `<label><input>
   diatonic</label>` — and at 390px that is a question and a widget fighting
   over 366px, with the question winning and the slider ending up 120px wide.
   Measured before this change: 41 controls at 390 and 56 at 1280 had their own
   label's text sharing a line with them.

   WHAT MOVED IS THE WORDS, NOT THE ASSOCIATION. The control is still INSIDE
   its <label>, so the association is implicit and needs no `for`/`id` pair to
   go stale — a screen reader still names the control, and tapping the words
   still works the control, which on a phone is the bigger target of the two.
   All that is new is a `<span class="nu-w">` around the words and a class on
   the paragraph; the stacking itself is one rule in nu.css (`.nu-field >
   label`), so the same two lines answer this for every field on the page
   rather than each caller deciding.

   `.nu-w` and not a new name: it is already §2.4's word for "the words of a
   control", it is already what ui/selects.js puts round a menu's label, and
   giving the same thing here a second name is how one vocabulary becomes two. */
const FIELD = (parent, ...kids) => { const p = P(parent, ...kids);
  p.className = "nu-field"; return p; };
function number(key, label, value, set, parent, min, max, step) {
  const { r, out } = range(key, value, set, min, max, step, label);
  const l = el("label");
  l.append(el("span", label, "nu-w"), r, document.createTextNode(" "), out);
  FIELD(parent, l);
  return r;
}
function check(key, label, value, set, parent) {
  const c = document.createElement("input");
  c.type = "checkbox"; c.checked = !!value;
  c.addEventListener("change", () => { set(c.checked); changed(); });
  // ...AND THE BOX GOES UNDER ITS SENTENCE TOO, which is the one case worth
  // arguing rather than asserting. A checkbox's words are usually READ as the
  // control's own name and kept beside it; on this page they are not names,
  // they are sentences — "the line stays in the key" — and a sentence is one
  // of Paul's "titles or questions". The whole <label> is still the tap
  // target, so the box under the sentence is a LARGER gesture than the box
  // beside it, not a smaller one.
  const l = el("label"); l.append(el("span", label, "nu-w"), c);
  FIELD(parent, l);
  c.dataset.k = key;
  return c;
}
/* ---------- the two wrappers the stylesheet cannot make itself ---------- */
// A STICKY HEADING NEEDS SOMETHING TO BE STICKY INSIDE OF. `position: sticky`
// releases at the bottom of its CONTAINING BLOCK, so while every <h2> was a
// direct child of #app the first heading would have pinned for all 3000px of
// the page and the last would never have pinned at all. One <section
// class="nu-ax"> per axis is that containing block, and the consequence is the
// feature: the heading on the screen is the heading of the axis you are inside.
// The signature is PROGRAM.md §2.2's `ctx.section(parent, id, title)` exactly.
function axis(parent, id, title) {
  const s = el("section");
  s.className = "nu-ax";
  if (id) s.id = id;
  s.append(el("h2", title));
  parent.append(s);
  return s;
}
// §2.2's `ctx.heading(parent, text)`. An <h3> is NOT sticky — two bands is
// 52 + 38 = 90px of a 667px phone already, and a third would be a quarter of
// the screen spent saying where you are instead of showing it.
function heading(parent, text) {
  const h = el("h3", text);
  parent.append(h);
  return h;
}
// A WIDE TABLE SCROLLS INSIDE ITSELF OR IT SCROLLS THE WHOLE DOCUMENT, and
// there is no third option. Measured 2026-08-24: two seventeen-column grids at
// 382px against a 375px phone put documentElement.scrollWidth at 390, so every
// vertical swipe on the page could drift sideways. ONE table per pane and
// never a pane inside a pane; never a sticky heading inside one either,
// because `overflow-x: auto` computes `overflow-y` to `auto` as well and the
// heading would stick to the pane instead of the page. Focusable because a
// region a mouse can scroll has to be reachable from a keyboard.
// (A third argument, `grid`, marked the sixteen-step tables and gave them the
//  `.nu-grid` class. It went with the rotation on 2026-08-25 — the step grids
//  do not overflow any more, so they do not take a pane; `stepGrid()` below is
//  where that class is put on now, and the note there says why.)
function pane(parent, table) {
  const d = el("div");
  d.className = "nu-pane";
  d.tabIndex = 0;
  // WHICH PANE THIS IS, ACROSS A REBUILD (keepPanes/putPanes, above). The
  // first control inside it: `data-k` is unique in the document and stable
  // across a redraw, and the table is already full by the time it gets here
  // — every caller appends its rows and then calls pane().
  const first = table.querySelector("[data-k]");
  if (first) d.dataset.pane = first.dataset.k;
  d.append(table);
  parent.append(d);
  return d;
}
/* ---------- ...AND A STEP GRID THAT NEEDS NO PANE AT ALL ----------------
   Paul, 2026-08-25: *"Rotate the drum kits and motif editors to be vertical.
   They'll fit on a phone screen that way."*

   `pane(parent, table, true)` used to be how a sixteen-step grid was drawn, and
   the third argument meant two things at once: put the `.nu-grid` class on, and
   wrap the table in a horizontal scroller. Steps run DOWN now, so the second
   half is not merely unnecessary, it is the thing to remove: measured at
   390x844 the rotated motif grid is 292.8px and the widest kit the catalog can
   draw is 272px, both inside the 366px column — and inside the 296px one a
   320px phone leaves — and an `overflow-x: auto` box around a
   table that cannot overflow is a scroll container that exists only to catch
   gestures. It caught them: "when I scroll right to edit motifs and tap
   something it snaps left even though I'm not done editing" was a pane
   restoring a scrollLeft nobody wanted, and keepPanes/putPanes is the machinery
   that had to be built to make that survivable.

   So the pane is GONE from these two grids rather than made to behave, and
   `pane()` above keeps the two callers that genuinely overflow (the chord chart
   at 379px, the board's channel strip at one column a channel). What follows
   from that and is NOT ours to fix here: `test/shell.js` asserts every <table>
   has a `.nu-pane` parent, which was true of every table on the page and is not
   true of these two any more. That assertion needs revisiting with reasons —
   see the round's report; it is not edited from here.

   A swipe on a rotated grid now scrolls the PAGE, because there is nothing
   between the finger and the document to swallow it. */
function stepGrid(parent, table) {
  table.className = "nu-grid";
  parent.append(table);
  return table;
}


/* ---------- THE CHANGES AS A GRID --------------------------------------
   A chord chart: one column per bar of the loop, the degree over its
   quality, and the bar that is sounding is marked. The loop is read
   cyclically by the kernel (`at(g.prog, bar)`), so four columns is four bars
   and then round again — which is what the header says. */
const INVNAME = (n) => ["root", "1st", "2nd", "3rd"][n] || String(n);
// THE QUALITY, AS A MUSICIAN WRITES IT. The numeral says the degree and the
// diatonic triad's own colour; these say what was built on top of it.
const QMARK = { triad: "", 7: "7", maj7: "maj7", m7: "m7", dom7: "7",
                nine: "9", sus4: "sus4", six: "6" };
// AN INVERSION IS FIGURED BASS, in this notation — not "/1st". A first
// inversion is a 6, a second is a 6/4, a third is a 4/2, and that is what
// somebody reading numerals expects to see. The SLIDER still says root / 1st
// / 2nd / 3rd, because a control should name what it does in words.
const INVFIG = ["", "6", "6/4", "4/2"];
const INVFIG7 = ["", "6/5", "4/3", "4/2"];
const SEVENTH = { 7: 1, maj7: 1, m7: 1, dom7: 1, nine: 1 };
function chordGrid(parent) {
  const P2 = DOC.alphabet.prog;
  // ROMAN NUMERALS, DERIVED FROM THE MODE — not a table of minor-key names.
  // kernel.js romanOf reads each degree's own third and fifth, so the case
  // and the °/+ marks are honest in whatever alphabet the record is in:
  // switch Alphabet from natural minor to major and i becomes I, VI becomes
  // vi, and nothing here had to know.
  const NUM = K.romanOf(MODES[DOC.alphabet.mode] || MODES.aeolian);
  const numeral = (d) => NUM[((d % NUM.length) + NUM.length) % NUM.length];
  // THE FIGURE REPLACES THE QUALITY MARK when the chord is inverted, which is
  // how figured bass has always worked: a root-position seventh is V7, its
  // first inversion is V6/5 — you do not write V7 6/5.
  const chordName = (c) => numeral(c.d) + (c.inv
    ? (SEVENTH[c.q] ? INVFIG7 : INVFIG)[c.inv] || ""
    : (QMARK[c.q] == null ? c.q : QMARK[c.q]));
  const t = el("table");
  const head = el("tr");
  for (const h of ["bar", "degree", "", "quality", "inversion", ""])
    head.append(el("th", h));
  t.append(head);
  chordCell = [];
  // the song-level reason the quality menus are refused, if they are; collected
  // in the row loop and printed ONCE below the table (see the note there)
  let qWhy = null;
  P2.forEach((c, i) => {
    const tr = el("tr");
    const th = countCell(String(i + 1));
    chordCell[i] = th; tr.append(th);
    // THE DEGREE IS A SLIDER because it is a NUMBER on a line — I, II, III…
    // up the scale — and dragging it walks the changes up and down. The
    // quality stays a menu: a triad and a maj7 are not two ends of anything.
    const d = range("prog" + i + "d", c.d, (v) => c.d = v, 0, 6, 1,
      "chord " + (i + 1) + " degree", false, numeral, "84px");
    const td = el("td"); td.append(d.r); tr.append(td);
    const to = el("td"); to.append(d.out); tr.append(to);
    // THE QUALITY IS BACK IN THE GRID, AND THAT IS A REVERSAL WRITTEN DOWN.
    // The comment here said "THE QUALITY LEFT THE GRID. Eight words in a table
    // cell was a menu because a menu is the only control that fits in one" —
    // and this evening Paul asked for exactly that menu back, in exactly that
    // cell: "chord quality can be selects inside the 'the changes' table"
    // (2026-08-24, evening). Both readings are right about different things.
    // Eight lit words per bar under the chart is a comparison nobody was
    // making; the quality of bar 3 is a settled parameter, and the place to
    // say it is beside bar 3. The column no longer has to choose between
    // reading the chord and editing it — a closed <select> shows the quality,
    // which is what the read-only cell was for.
    const qs = shSpec("alphabet.quality", { bar: i },
                      "bar " + (i + 1) + " quality");
    qWhy = qs.why || qWhy;
    const tq = el("td"); tq.append(selectEl(qs)); tr.append(tq);
    // INVERSION: which note of the chord is in the bass. The kernel has
    // carried it all along — chordsOf reads `inv` and takes the bass pitch as
    // pcs[inv % pcs.length] — so this is another field that only needed
    // somewhere to be said. A slider because the inversions are a LADDER
    // through the chord, and it names its rungs rather than counting them.
    const iv = range("prog" + i + "i", c.inv || 0, (v) => c.inv = v, 0, 3, 1,
      "chord " + (i + 1) + " inversion", false, INVNAME, "84px");
    const ti = el("td"); ti.append(iv.r); tr.append(ti);
    const tn = el("td"); tn.append(iv.out); tr.append(tn);
    t.append(tr);
  });
  pane(parent, t);                  // six columns, not sixteen: not a .nu-grid
  // ...and the whole loop on one line, which is how anybody would say it
  parent.append(el("p", P2.map(chordName).join("  –  ")));
  // ONE REASON UNDER THE TABLE, NOT EIGHT DOWN A COLUMN. `alphabet.quality` is
  // gated at SONG level — kernel.js:671 throws the whole progression away
  // unless the harmony is a cycle — so every row is refused for the same
  // sentence. selects.js has already refused each control and put the reason on
  // it (`data-why`, and spoken as part of its name); this is the visible copy,
  // said once. NO SILENT GREY is the law both widgets share, and in a table it
  // is the only shape it can take.
  if (qWhy) parent.append(el("p", qWhy, "nu-why"));
}

/* ---------- THE SCORE — THE WHOLE BAND, TWO MEASURES AT A TIME ----------
   Paul, 2026-08-25: *"add a section ABOVE motifs which is the current playing
   music, two measures at a time, but ALL"*.

   ALL IS THE WHOLE OF THE ASK, and it is what makes this a different object
   from the composed staff under it. A composed staff is a PART — one player's
   line, in that player's register, with that player's word applied — and the
   motif blocks below draw one per voice per motif, scattered down the axis
   because they are grouped by the tune they read. A SCORE is every part at
   once, stacked in the record's own order and barred through, so you can read
   DOWN a beat and see what the band is doing at that instant. Nobody has ever
   been able to see this record's counterpoint, its bass and its kit in one
   look, and two measures is the widest window a phone can hold at a size a
   person can read.

   WHERE ITS NOTES COME FROM, AND WHY IT IS NOT A SECOND OPINION. This does not
   re-derive anything: it reads `sectionRender(box, SLOTS, GROOVE, SWING).ev`,
   which is the stream ui/derive.js hands the transport and the bounce — the
   same one `window.__eightEvents` was added for, with the file's own note on
   it ("TEST THE ARTIFACT: three features have shipped broken here while every
   check passed"). It is the FIRST opinion, the engine's, and it is the only
   place in the box where a record's whole cast exists at once: line voices
   carry `v`, the bass arrives as `kind:"bass"` and the drummer as `kind:"hit"`
   with a lane. The composed staves cannot show either of those — a bass part
   has no material cell to develop and a kit is a lane grid, not a phrase — so
   a score built out of `voicePhrase` could never have said ALL.

   THE TWO PICTURES MAY THEREFORE DIFFER, AND THAT IS THE TRUTH RATHER THAN A
   BUG. The stream has been through the section's envelope, its intro and outro,
   each chair's `entry`, the harmonize stage and the groove; the composed staff
   is the theme with the word applied and nothing else. Read together they say
   what a conductor's score and a player's part have always said: here is your
   line, and here is what the room hears. Where they disagree the score is the
   report — it is what the speakers are doing.

   NOTATION QUANTIZES, and it always has. Swing, groove and the humanized hand
   put events between the steps; every one is drawn at its nearest step, which
   is what a copyist does with a recording and what the engraved bar means. The
   SOUND is untouched: nothing in this block is read by audio. */

// HOW A DRUM LANE IS WRITTEN DOWN. General MIDI's own percussion staff, which
// is what every drummer and every notation program already reads: the kick in
// the bottom space, the snare in the third, the toms between them, and
// everything struck with a stick — hats, ride, crash — as an x notehead above
// (the pedal hat below, because it is a foot). `!style=x!` is a note-level
// mark the vendored abcjs honours (measured 2026-08-25; the ABC `%%map` drum
// maps it does NOT). Lanes that share a place share it deliberately: a rim
// click and a clap are played where the snare is written.
const SCOREHEAD = { k: "F", s: "c", p: "c", c: "c",
                    t: "e", m: "d", l: "A",
                    h: "!style=x!g", o: "!style=x!g", f: "!style=x!D",
                    r: "!style=x!f", x: "!style=x!a" };
// SIXTEEN STEPS TO A MEASURE, the same sixteen the playhead counts
// (`lightStep`) and the composed staves engrave. Not `stepsIn(g)`: the score
// has to sit in the same measure the red note is walking through, and every
// other surface on this page — the maker grid, the kit, the composed staff —
// is built on sixteen. A genre in a twelve-step meter draws its score the way
// it draws its motifs, which is the disagreement to fix in one place if ever.
const SCORE_SPB = 16, SCORE_BARS = 2, SCORE_W = SCORE_SPB * SCORE_BARS;
/* ---------- TWO PICTURES, ONE VISIBLE, AND THAT IS THE RUNWAY -----------
   Paul, 2026-08-25: *"the sheet music appears about a half measure after the
   music starts. it should appear BEFORE the music starts, essentially I should
   see the current measure and the next and the moment the current measure is
   done, measure 2 becomes measure #1."*

   WHAT WAS MEASURED BEFORE THIS, on the shipped chant at 390px with the
   transport running and the page polled every 40ms: the window changed from
   bars 1-2 to bars 3-4 at t=17919ms and the playhead entered bar 3 at the same
   poll — **186ms LATE**, against a `SCORE_SETTLE` of 200ms. So the LATENESS is
   the settle and nothing else: the engrave landed inside the same 40ms poll
   (renderAbc median 23ms, measured 2026-08-25) and the walk contributed zero,
   because `scoreMeas` is computed in the very `on("pos")` handler that moves
   the red note — the window and the playhead share one clock and cannot
   disagree. The HALF MEASURE is a different thing and it was the rule itself:
   advancing two bars at a time meant that on every odd bar the sounding music
   was the picture's RIGHT half, i.e. the picture was already a bar old. Both
   are fixed here, and they needed two different fixes.

   THE RULE IS ROLLING NOW: the window starts at the sounding measure, so it is
   always [current, next] and it flips at every barline. That is the whole of
   "measure 2 becomes measure #1".

   WHICH BUYS THE LEAD TIME FOR FREE, and this is the part worth stating: a bar
   is on the page for one WHOLE MEASURE before it sounds, because it enters as
   the right half of the window whose left half is the bar in front of it. At
   the chant's tempo that is ~4.4 seconds of reading time. Nothing had to be
   predicted to get it; the window shape is the prediction.

   AND THE STROBE IS ANSWERED BY DOUBLE-BUFFERING. The two-at-a-time rule was
   chosen because "a window that re-centres every bar is a strobe", and that
   objection was real about a picture that goes blank and re-appears: abcjs
   renders into a host by emptying it, so a bar-by-bar re-engrave would show a
   hole at every barline. So there are TWO hosts stacked in the same grid cell,
   one visible and one not: the NEXT window is engraved into the hidden one
   while the current one is still on screen, and the flip is a class swap with
   no engrave in it at all. What a reader sees at the barline is the right-hand
   bar arriving on the left and one new bar arriving on the right — a shift,
   never a replacement, and never an empty frame.

   THE OTHER HALF OF THE STROBE ARGUMENT SURVIVES AND IS WHY THE SETTLE IS
   STILL HERE: `passAt` can report the last bar of a pass and then the first bar
   of the next one inside a tenth of a second (measured 2026-08-25 at 1280px: 0
   → 2 → 0 in 100ms). What is new is that only ONE kind of change can be
   trusted immediately — a step of exactly one window forward inside the same
   section, which is the only thing a barline can do — and everything else
   (a section change, a jump, a step backwards) still waits out `SCORE_SETTLE`.
   That is what takes the 186ms off the barline and leaves the flash
   impossible. */
let scoreBufs = [];                         // [{ el, key, abc, voices, els, ready }]
let scoreShown = 0;                         // which of the two is on screen
let scoreWant = "";                         // the window the page is asking for
let scoreHost = null, scoreCap = null;      // the box that holds the room; the sentence
let scoreLit = [];
let scoreWin = -1, scoreSec = -1;
let scoreMeas = 0;                          // the measure the playhead is in
let scoreReserve = 0;                       // the room the picture is given, px
// ...AND WHAT THAT ROOM WAS MEASURED FOR. A box is a fact about a RECORD at a
// WIDTH — eight staves need four times the room two do — so the number is kept
// with the two things it depends on and thrown away when either moves.
// Measured 2026-08-25, before this line existed: the chant's two-staff box
// (213px) was still in force when the atlas swapped in an eight-voice
// yachtrock record, and the whole band was drawn at 0.24 scale inside it.
let scoreReserveKey = "";
// how far the voice names push the system past the viewBox abcjs writes —
// measured once per record and width, never on the clock (see fitSystem)
let scoreGutter = 0;
// A SECOND ENGRAVING COUNT, AND IT IS DELIBERATE. `engraves` is the composed
// half's own number and test/motif-frozen.js A6 holds it to "at most one abcjs
// render per line voice per section boundary" — a claim about the motif
// blocks, which is exactly the claim that gate exists to make. Adding this
// surface's renders to that counter would make A6 pass or fail on a different
// surface's arithmetic. One counter per claim.
let scoreEngraves = 0;

/* WHICH TWO MEASURES: THE ONE THAT IS SOUNDING AND THE ONE AFTER IT.

   THIS REVERSES A RULE AND THE RULE IS QUOTED RATHER THAN DELETED, because its
   argument was good and half of it still holds. It read: *"A window that
   re-centres every bar is a strobe: at 96bpm the picture would be replaced
   every 2.5 seconds and the bar you were reading would slide out from under
   your eye mid-phrase. So the window ADVANCES BY TWO — measures 1-2, then 3-4
   — and every picture stands for its whole two bars, which is a page turn and
   is how printed music has always worked."*

   Paul overruled it on 2026-08-25: *"essentially I should see the current
   measure and the next and the moment the current measure is done, measure 2
   becomes measure #1."* And the objection is answered rather than ignored —
   see the double-buffer note over `scoreBufs`. A page turn REPLACES a picture
   and that is what strobes; this SHIFTS one, and the bar you are reading was
   already on the page for a whole measure before it arrived under your eye.

   THE CLAMP AT THE END OF A SECTION IS WHAT IS LEFT OF THE OLD EXCEPTION. In
   the last measure of a section there is no "next" inside the section, so the
   window holds at [M-2, M-1] and the sounding bar is the picture's right half.
   A five-bar section therefore ends showing bars 4-5 rather than 5 and a
   phantom rest, which is the same judgement the two-at-a-time rule made and
   the only honest one available: `scoreParts` reads ONE section's render. */
const scoreWinOf = (meas, M) =>
  Math.max(0, Math.min(meas, M - SCORE_BARS));

/* THE PARTS OF THE SYSTEM: one per voice of the record, in the record's own
   order, each holding exactly the two measures of the window. A voice with
   nothing in these bars — out, not yet entered, or simply resting — gets a
   phrase of rests rather than being dropped, so the system keeps its shape and
   the fourth staff down is the fourth voice in every window. */
function scoreParts(si, k) {
  const box = SONG[si];
  if (!box) return null;
  let R;
  try { R = sectionRender(box, SLOTS, GROOVE, SWING); } catch (err) { return null; }
  if (!R || !R.g || !R.ev) return null;
  const rate = R.g.rate || 1;
  const lines = LINES();
  const z = () => new Array(SCORE_W).fill(0);
  const bucket = new Map();                 // voice name -> the window's steps
  const mine = (name) => { let b = bucket.get(name);
    if (!b) bucket.set(name, b = { midi: new Array(SCORE_W).fill(null),
                                   gate: z(), hold: z() });
    return b; };
  const bassV = DOC.voices.find((v) => v.kind === "bass");
  const drumV = DOC.voices.find((v) => v.kind === "drums");
  for (const e of R.ev) {
    const voice = e.kind === "hit" ? drumV
                : e.kind === "bass" ? bassV
                : (e.v != null ? lines[e.v] : null);
    if (!voice) continue;                   // a layer with no chair of its own
    // THE EVENT'S OWN STEP. `t` is in the section's time units (a sixteenth at
    // rate 1, ui/derive.js barSteps), and the pattern step the playhead counts
    // is `t * rate` — the same multiplication on("pos") does to find `base`,
    // so the score's measures and the red note's measures are one arithmetic.
    const s = Math.round(e.t * rate);
    const meas = Math.floor(s / SCORE_SPB);
    if (meas < k || meas >= k + SCORE_BARS) continue;
    const i = (meas - k) * SCORE_SPB + (s - meas * SCORE_SPB);
    if (i < 0 || i >= SCORE_W) continue;
    const b = mine(voice.name);
    const head = e.kind === "hit" ? SCOREHEAD[e.d] : e.n;
    if (head == null) continue;
    // SIMULTANEOUS EVENTS IN ONE VOICE ARE A CHORD, not four staves' worth of
    // argument: a pad voices a triad and a drummer hits a kick and a hat
    // together, and both are one stem with several noteheads (ui/abc.js
    // headOf). Duplicates are dropped — a rim and a clap are written in the
    // same place and drawing two noteheads there would be a blot.
    const cur = b.midi[i];
    if (cur == null) b.midi[i] = head;
    else {
      const arr = Array.isArray(cur) ? cur : [cur];
      if (!arr.includes(head)) arr.push(head);
      b.midi[i] = arr;
    }
    b.gate[i] = 1;
    // HOW LONG IT IS HELD, off the event and not off a guess. `dur` is the
    // engine's own sounding length in the same units as `t` (kernel render
    // writes `hold * 0.92 / rate`, the articulation gap included), so the
    // written value is that length in steps, at least one. A pad's whole note
    // comes out a whole note and a hat's sixteenth comes out a sixteenth,
    // which is the difference between a score and a grid.
    const len = Math.max(1, Math.round((+e.dur || 0) * rate));
    if (len > b.hold[i]) b.hold[i] = len;
  }
  const parts = DOC.voices.map((v) => {
    const b = bucket.get(v.name) || { midi: new Array(SCORE_W).fill(null),
                                      gate: z(), hold: z() };
    return { name: v.name,
             // the bass reads in F and the kit on a percussion staff; every
             // other part takes ui/abc.js's own octave decision (8va / 8vb),
             // which keeps a high line off a stack of ledger lines
             clef: v.kind === "bass" ? "bass" : v.kind === "drums" ? "perc" : "",
             phrase: { deg: z(), oct: z(), vel: z(), gate: b.gate,
                       midi: b.midi, hold: b.hold } };
  });
  return parts;
}

/* THE CAPTION, WHICH IS THE ONLY OTHER THING THE CLOCK WRITES HERE. It has to
   say WHICH two measures, or a picture that changes every two bars is a
   picture you cannot place. Tense as the composed captions use it: stopped it
   is a prediction of the section you are writing, playing it is a report. */
function scoreCaption(si, ei, k, M, asPlayed) {
  const where = secName(si) + ", bars " + (k + 1) + "-" +
                Math.min(M, k + SCORE_BARS) + " of " + M;
  // ...and when the two disagree, WHICH ONE THIS IS. You can be writing the tag
  // while the second verse sounds, and a picture that does not say which
  // section it is showing is worse than no picture — the same sentence
  // `playedCaption` made one surface down until it was deleted with the
  // composed staves on 2026-08-25, which is why it is now made only here.
  // `asPlayed` and not `playing` READ HERE, and that is what makes the reserve
  // below honest: the sentence has to be measured in the tense it will be said
  // in. Measured 2026-08-25 at 390px — the stopped sentence is 52 characters
  // and the playing one ("…as played - you are writing head 1") is 76, which
  // wraps to a second line and moved the whole page down 16px the first time
  // the transport crossed into a section that was not the one being written.
  const t = asPlayed == null ? playing : asPlayed;
  const elsewhere = t && si !== ei ? " - you are writing " + secName(ei) : "";
  return "the whole band - " + where + ", " +
         (t ? "as played" : "as it will play") + elsewhere;
}

/* THE PICTURE MAY NOT CHANGE HEIGHT, EVER, and that is not a preference: the
   score sits ABOVE every editor on the page, so a system that grew by a ledger
   line at a section boundary would push the whole editing interface down while
   somebody's thumb was on it — 2026-08-24's complaint exactly, one surface
   higher up. test/motif-frozen.js A5 measures it from outside (`#ax-band` may
   not move across two boundaries).

   THE RESERVE IS MONOTONIC AND IT IS ON THE INNER HOST. Monotonic, so the box
   only ever takes the most room any window has needed and never gives it back
   mid-record. On the INNER host, because `window.__eightFrozen` empties every
   `[data-live]` and keeps its attributes: a style attribute on the live
   element itself would be part of the frozen picture and A3's byte-identity
   would fail the first time the reserve grew. Inside, it is invisible to the
   gate and still holds the room. */
function scoreReserveTo(px) {
  if (!scoreHost || !(px > scoreReserve)) return;
  scoreReserve = px;
  scoreHost.style.minHeight = px + "px";
}
// WHAT THE PICTURE HAD TO BE SHRUNK BY to fit, so the claim above is a number
// somebody can check rather than a promise: 1 is the box's own window, 0.83 is
// a system that needed a fifth more room than the box has.
const scoreFit = () => {
  const B = scoreBufs[scoreShown];
  const svg = B && B.el && B.el.querySelector("svg");
  if (!svg || !scoreReserve) return 1;
  const vb = (svg.getAttribute("viewBox") || "").trim().split(/\s+/).map(Number);
  const r = svg.getBoundingClientRect();
  if (vb.length !== 4 || !(vb[2] > 0) || !(r.width > 0)) return 1;
  return +Math.min(r.width / vb[2], r.height / vb[3]).toFixed(3);
};

/* REPAINTING THE SCORE, AND ONLY IT. Writes in exactly two places, both inside
   the one `[data-live="score"]` element: the caption's text and which of the
   two stacked hosts is visible.

   THREE GATES, CHEAPEST FIRST, and that has not changed: the window index and
   the section (an integer compare, four times a beat, which is what stops this
   touching the main thread at all on 15 of every 16 ticks); then, inside
   `engraveWindow`, the ABC string, so a window whose music is identical to the
   one before it — two bars of the same vamp — costs no abcjs render at all.

   WHAT IS NEW IS THE FOURTH THING IT DOES: after every landing it asks for the
   NEXT window to be engraved into the hidden host. That is the runway, and it
   is the reason a barline costs a class swap instead of a render. */
const SCORE_SETTLE = 200;
let scorePendKey = null, scorePendT = 0;
function repaintScore(force) {
  if (!scoreHost) return;
  const ei = editSec();
  // WHAT IS SOUNDING, OR — STOPPED — THE EDIT POSITION. A section that appeared
  // on play would be the interface changing, which is the thing Paul objected
  // to in the first place, so stopped it draws the first two measures of the
  // section you are writing and says so. The block is on the page, the same
  // size, whether the transport runs or not.
  const si = playing && atSec >= 0
    ? Math.min(atSec, DOC.form.sections.length - 1) : ei;
  const k = playing ? scoreWinOf(scoreMeas, scoreLen(si)) : 0;
  if (!force && k === scoreWin && si === scoreSec) {
    scorePendKey = null;
    scoreAhead(si, k);                     // keep the runway full
    return;
  }
  /* THE ONE CHANGE THAT NEVER WAITS, and it is the whole of the answer to "it
     should appear BEFORE the music starts". A step of exactly one window
     forward inside the same section is the only thing a barline can do, and it
     is already engraved and sitting in the hidden host — so it is painted on
     the spot and the 186ms of settle that used to sit on every page turn is
     gone. Everything else still waits: a section change, a jump, a step
     BACKWARDS. Those are the shapes `passAt`'s wall-clock estimate produces
     when it is wrong (measured: 0 → 2 → 0 in 100ms at a pass boundary), and
     nothing real happens in a tenth of a second. A GESTURE never waits either:
     play, stop and a rebuild pass `force`. */
  const oneStep = si === scoreSec && k === scoreWin + 1;
  if (!force && !oneStep) {
    // the settle: remember what the clock is claiming and come back to it. Only
    // the LAST claim survives — a second change inside the window replaces the
    // first, so a flicker cancels itself.
    const key = si + ":" + k;
    if (scorePendKey !== key) {
      scorePendKey = key;
      clearTimeout(scorePendT);
      scorePendT = setTimeout(() => { scorePendKey = null; repaintScore(true); },
                              SCORE_SETTLE);
    }
    return;
  }
  scorePendKey = null; clearTimeout(scorePendT);
  showWindow(si, k);
}

/* WHICH HOST IS ON SCREEN. One class, two elements, no layout: both hosts sit
   in the same grid cell (nu.css `.nu-stack`) so the box is the same height
   whichever is showing, and the one that is off is `visibility: hidden` —
   which takes it out of the accessibility tree as well as off the glass, so a
   screen reader is never read two scores. `display: none` would have been the
   other candidate and it is refused: a host with no box has `clientWidth` 0,
   and `clientWidth` is exactly what `renderAbc` is handed as its staff width,
   so the hidden buffer would engrave at 180px and be shown at 366. */
function swapTo(i) {
  if (i === scoreShown || !scoreBufs[i]) return;
  scoreBufs[scoreShown].el.classList.add("is-off");
  scoreBufs[i].el.classList.remove("is-off");
  scoreShown = i;
}

/* THE WINDOW THE PAGE WANTS, AND HOW IT GETS THERE. `scoreWant` is the key of
   that window and it is the only thing an in-flight engraving is allowed to
   check itself against — a second barline can land while abcjs is still being
   fetched, and the LAST window asked for is the one that is true. */
function showWindow(si, k) {
  const key = si + ":" + k;
  scoreWant = key;
  for (let i = 0; i < scoreBufs.length; i++)
    if (scoreBufs[i].key === key && scoreBufs[i].ready) { swapTo(i); landed(si, k); return; }
  engraveWindow(1 - scoreShown, si, k);
}
// HOW LONG THE SOUNDING SECTION IS, in measures, asked in one place. Every
// reader below needs it and none of them may keep a copy: `SONG[si].len` moves
// the moment the form does.
const scoreLen = (si) => Math.max(1, (SONG[si] || { len: 1 }).len | 0);

// THE PICTURE HAS LANDED: the caption, the playhead, and the ask for the next
// one. Nothing here engraves; `scoreAhead` decides whether anything has to.
function landed(si, k) {
  scoreWin = k; scoreSec = si;
  const text = scoreCaption(si, editSec(), k, scoreLen(si));
  if (scoreCap && scoreCap.textContent !== text) scoreCap.textContent = text;
  const B = scoreBufs[scoreShown];
  if (B) B.els = null;                  // a swapped-in host is a new element list
  if (atStep >= 0) lightScore(atStep);
  scoreAhead(si, k);
}

/* THE RUNWAY. One window ahead and never more, into whichever host is not on
   screen. Two cases and they are both real records: inside a section the next
   window is `k + 1`; at the LAST window of a section the next thing that will
   sound is the first window of the section after it, so that is what is
   prepared — which makes a section boundary a class swap too, instead of the
   one place a full engrave would still land on the barline.

   IT IS FREE WHEN THERE IS NOTHING TO DO. `engraveWindow` returns immediately
   if the host already holds that key, so this runs four times a beat and does
   arithmetic on 15 of every 16 of them. */
function scoreAhead(si, k) {
  if (!playing) return;
  const M = scoreLen(si);
  let nsi = si, nk = k + 1;
  if (nk > M - SCORE_BARS) {
    nsi = si + 1; nk = 0;
    if (!SONG[nsi]) { nsi = 0; }        // the record loops: the runway does too
  }
  engraveWindow(1 - scoreShown, nsi, nk, true);
}

/* ONE ENGRAVING INTO ONE HOST, and the three refusals that make it cheap.
   `quiet` is the runway's: it engraves and stops, where a demanded window
   swaps itself in the moment it is ready. */
function engraveWindow(i, si, k, quiet) {
  const B = scoreBufs[i];
  if (!B) return;
  const key = si + ":" + k;
  if (B.key === key) {                  // already drawn here, or already asked for
    if (!quiet && B.ready && scoreWant === key) { swapTo(i); landed(si, k); }
    return;
  }
  const parts = scoreParts(si, k);
  if (!parts) return;
  let sc;
  try { sc = toScore(parts, { key: KEYS[DOC.alphabet.key] || 0,
                              mode: MODES[DOC.alphabet.mode] || MODES.aeolian,
                              stepsPerBar: SCORE_SPB }); }
  catch (err) { return; }
  if (!sc) return;
  // THE CHANGE DETECTOR, AND IT LOOKS AT BOTH HOSTS. Two bars of the same vamp
  // engrave the same ABC, and the cheapest thing to do with a picture that is
  // already on the glass is to relabel it rather than draw it again.
  const shown = scoreBufs[scoreShown];
  if (shown && shown.ready && shown.abc === sc.abc) {
    shown.key = key;
    if (!quiet && scoreWant === key) landed(si, k);
    return;
  }
  B.key = key; B.abc = sc.abc; B.voices = []; B.els = null; B.ready = false;
  const host = B.el, want = sc.abc;
  loadStaffLib().then((A) => {
    // the promise race: a later window can land while abcjs is still being
    // fetched, and the LAST engraving asked for into this host is the true one
    if (!A || B.abc !== want || B.key !== key || !host.isConnected) return;
    try { A.renderAbc(host, want, { responsive: "resize", add_classes: true,
      staffwidth: Math.max(180, host.clientWidth - 8) }); }
    catch (err) { return; }
    scoreEngraves++;
    B.voices = sc.voices; B.els = null; B.ready = true;
    fitSystem(host);
    // ...AND THE BOX IS MEASURED ONLY WHEN THE CLOCK IS NOT RUNNING. Taking a
    // height is harmless; APPLYING one is a layout change, and a layout change
    // on the clock is the whole thing this page refuses to do. Stopped — at
    // boot, and after any rebuild your own gesture caused — the block may take
    // the room its picture needs; playing, the picture fits the room it has.
    if (!playing) scoreReserveTo(Math.ceil(host.getBoundingClientRect().height));
    if (scoreWant === key) { swapTo(i); landed(si, k); }
  }).catch(() => {});
}

/* THE SYSTEM IS WIDER THAN abcjs SAYS IT IS, AND THE RIGHT-HAND BARS WERE
   BEING CUT OFF. Measured 2026-08-25 on an eight-voice record at 390px: with
   `responsive: "resize"` the container is handed `viewBox="0 0 486.534 670.41"`
   while the drawing inside it runs from x=15 to x=588 — the voice NAMES in the
   left margin are laid out but not counted, so the last 100 units of every
   staff, which is most of the second measure, were outside the box and simply
   not drawn. It is not a scroll and not an overflow (documentElement.scrollWidth
   stayed 390): the picture was clipped.

   THE FIX IS TO ASK THE DRAWING HOW BIG IT IS. `getBBox()` is the SVG's own
   answer, exact and after layout, so the viewBox is widened to hold it and the
   responsive wrapper's aspect (a padding-bottom percentage, abcjs's own trick)
   is corrected to match — otherwise the picture would be stretched instead of
   scaled. The whole system then fits the column: at 390px the eight-staff score
   went from clipped-at-486 to complete at 593 units, 414px tall.

   IT RUNS ONCE PER ENGRAVING, never on a tick, and it touches nothing but the
   two numbers that say how the finished picture is scaled. */
function fitSystem(host) {
  const svg = host.querySelector("svg");
  if (!svg || !svg.getBBox) return;
  const vb = (svg.getAttribute("viewBox") || "").trim().split(/\s+/).map(Number);
  if (vb.length !== 4 || !(vb[2] > 0) || !(vb[3] > 0)) return;
  /* AND THE MEASUREMENT ITSELF IS NOT ALLOWED ON THE CLOCK. `getBBox()` forces
     a layout, and a layout of THIS page is not cheap — the eight-voice record
     is 16,000px tall with a thousand controls on it. Measured 2026-08-25 at
     390px: window turns that cost 110-140 ms of main thread with the bbox read
     in them, against a renderAbc of 23 ms median for the very same system.
     Nearly all of it was the reflow.

     What the bbox is FOR is one number — how far the voice names in the left
     margin push the music past the viewBox abcjs wrote (see above) — and that
     number is a fact about this record's names at this width, not about this
     window's notes. So it is measured once, while the transport is stopped,
     and carried; playing, the correction is applied without touching layout at
     all. If it is ever a little too generous the system is drawn a hair small
     with white paper to its right, which is what an engraver would do anyway;
     too small is the only failure it can have, and it cannot crop. */
  let w, h;
  if (!playing || !scoreGutter) {
    let bb;
    try { bb = svg.getBBox(); } catch (err) { return; }
    w = Math.ceil(Math.max(vb[2], bb.x + bb.width + 4));
    h = Math.ceil(Math.max(vb[3], bb.y + bb.height + 4));
    if (!playing) scoreGutter = Math.max(0, w - vb[2]);
  } else {
    w = Math.ceil(vb[2] + scoreGutter);
    h = Math.ceil(vb[3]);
  }
  svg.setAttribute("viewBox", "0 0 " + w + " " + h);
  // the picture is fitted INSIDE whatever box it is given, top-left, whole —
  // `meet` is the SVG word for "scale until it fits and never crop"
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
  const wrap = svg.parentNode;
  if (!wrap || !wrap.style) return;
  /* THE BOX IS FIXED AND THE MUSIC FITS ITSELF INTO IT — which is the only
     answer that survives the law this page lives under. Measured 2026-08-25 at
     390px on the shipped chant: three windows of the same two voices engraved
     196px, 231px and 235px tall, because rests are short and beamed notes with
     ledger lines are not. A block that took its natural height would therefore
     have grown 39px WHILE PLAYING, and everything below it — every motif, every
     editor, the whole band axis — would have been shoved down the page under a
     still thumb. That is 2026-08-24's complaint exactly.

     So the FIRST engraving sets the box (its own natural height, no number
     typed here) and every later one is scaled to fit inside it. Nothing is ever
     cropped: a denser window is drawn a little smaller, which is what a page of
     printed music does to a dense system anyway. The alternative — growing the
     box — is the one thing that is not allowed.

     THE FIRST ENGRAVING IS THE ONE AT BOOT, and a rebuild does not re-measure:
     `scoreReserve` outlives draw(), so the box a record settled on is the box
     it keeps. */
  if (!scoreReserve) {
    wrap.style.paddingBottom = (h / w * 100).toFixed(4) + "%";
    return;
  }
  wrap.style.paddingBottom = "0";
  wrap.style.height = scoreReserve + "px";
  svg.style.width = "100%";
  svg.style.height = "100%";
}

/* THE PLAYHEAD ON THE SCORE, AND IT IS THE ONLY ONE ON NOTATION NOW — the
   composed staves that used to carry a red notehead each were deleted on
   2026-08-25. Same rule about where it may be written — inside `[data-live]`, by the
   clock, and nowhere else. `abs` is the pattern step `lightStep` was handed, so
   the measure arithmetic is that function's own: which of the window's two
   measures is sounding, and which glyph in that voice is under the step.

   THE ELEMENT LISTS ARE CACHED PER RENDER. This runs four times a beat and a
   `querySelectorAll` per voice per tick on a seven-staff system is 28 walks of
   the SVG a beat for an answer that cannot change until the next engraving.
   `abcjs-vN` is abcjs's own per-voice class, N counting the `V:` lines in the
   order ui/abc.js toScore declares them — which is the order of `parts`, which
   is the order of `DOC.voices`. */
function lightScore(abs) {
  for (const x of scoreLit) x.removeAttribute("fill");
  scoreLit = [];
  const B = scoreBufs[scoreShown];
  if (!B || !B.ready || !B.voices.length || abs < 0) return;
  const meas = Math.floor(abs / SCORE_SPB) - scoreWin;
  if (meas < 0 || meas >= SCORE_BARS) return;     // the sounding bar is elsewhere
  const step = meas * SCORE_SPB + (Math.floor(abs) % SCORE_SPB);
  // THE ELEMENT LIST BELONGS TO THE HOST THAT IS SHOWING, and it is dropped by
  // `landed` on every swap: the two stacked hosts hold two different systems
  // and a cache taken off one would light noteheads that are not on the glass.
  if (!B.els)
    B.els = B.voices.map((v, i) =>
      [...B.el.querySelectorAll(".abcjs-note.abcjs-v" + i)]);
  B.voices.forEach((v, vi) => {
    let idx = -1;
    for (let n = 0; n < v.notes.length; n++) {
      const x = v.notes[n];
      if (x.at > step) break;
      if (step < x.at + x.len) idx = n;
    }
    if (idx < 0) return;
    const els = B.els[vi] || [];
    for (let g = 0; g < v.glyphs.length && g < els.length; g++)
      if (v.glyphs[g] === idx) { els[g].setAttribute("fill", "#c00"); scoreLit.push(els[g]); }
  });
}

/* THE BLOCK ITSELF. A heading that never changes, then ONE `[data-live]`
   element holding a caption and the system — and NOT ONE CONTROL, which is the
   law this page lives under (`test/motif-frozen.js` A1) and also the honest
   design: it is a picture of the music. It cannot be scrolled, zoomed, muted
   or soloed here, because every one of those is a control and a control inside
   a live block is how the frozen half stops being frozen.

   TWO HOSTS INSIDE THE ONE BOX (2026-08-25 — see TWO PICTURES, ONE VISIBLE,
   over `scoreBufs`). They are two elements and one picture: stacked in a single
   grid cell so the box is the same height whichever is showing, and the box —
   not either host — carries the reserve, so the room a record settled on is
   the room it keeps whichever buffer happens to be in front. */
function scoreBlock(parent) {
  heading(parent, "the score");
  const live = el("div");
  live.dataset.live = "score";
  live.className = "nu-score";
  const cap = el("p");
  cap.className = "nu-hint";
  const stack = el("div", null, "nu-stack");
  const a = el("div"), b = el("div", null, "is-off");
  stack.append(a, b);
  live.append(cap, stack);
  parent.append(live);
  scoreCap = cap; scoreHost = stack;
  scoreBufs = [a, b].map((n) => ({ el: n, key: "", abc: "", voices: [],
                                   els: null, ready: false }));
  scoreShown = 0; scoreWant = ""; scoreLit = [];
  scoreWin = -1; scoreSec = -1;
  const key = DOC.voices.length + "@" + Math.round(window.innerWidth);
  if (key !== scoreReserveKey) { scoreReserveKey = key; scoreReserve = 0; scoreGutter = 0; }
  // the room this record's score has already been measured to need, put back
  // before anything draws, so a rebuild does not collapse the page and then
  // grow it again under a thumb
  if (scoreReserve) stack.style.minHeight = scoreReserve + "px";
  reserveScoreCaption();
  repaintScore(true);
}

/* AND THE CAPTION GETS THE SAME TREATMENT THE COMPOSED ONES GET, for the same
   reason said one surface higher: a sentence that wraps to a second line when
   the section name gets longer moves every editor under it, on the clock. Set
   once to the longest thing it could ever say about this record, measured, and
   reserved. The law came from `reserveCaption`, which walked a list of voices
   and asked `playedCaption`; both went with the composed staves on 2026-08-25
   and this is the four lines of it that outlived them. */
function reserveScoreCaption() {
  if (!scoreCap) return;
  let longest = "";
  const NS = DOC.form.sections.length;
  for (let i = 0; i < NS; i++) {
    const M = Math.max(1, (SONG[i] || { len: 1 }).len | 0);
    // every section, both ends of it, both tenses, and both the case where the
    // sounding section IS the one you are writing and the case where it is not
    for (const k of [0, Math.max(0, M - SCORE_BARS)])
      for (const ei of [i, i === 0 ? Math.min(1, NS - 1) : 0])
        for (const asPlayed of [false, true]) {
          const t = scoreCaption(i, ei, k, M, asPlayed);
          if (t.length > longest.length) longest = t;
        }
  }
  scoreCap.textContent = longest;
  const h = Math.ceil(scoreCap.getBoundingClientRect().height);
  if (h) scoreCap.style.minHeight = h + "px";
  scoreCap.textContent = "";
}

/* ---------- THE MOTIF AS SHEET MUSIC, ONCE -----------------------------
   ONE MEASURE WIDE (Paul: "one measure wide on mobile"). The cell is sixteen
   steps and the bar is sixteen steps, so `barsPerLine: 1` is the whole of it
   — the staff is one measure at every width, and abcjs's `responsive:
   "resize"` scales that measure to whatever room the phone gives it.

   ONE STAFF PER MEASURE, AND THAT IS A REVERSAL OF THE REVERSAL ABOVE IT.
   This header said "TWO STAVES PER MEASURE, AND THAT IS A REVERSAL WRITTEN
   DOWN", and it is rewritten rather than deleted because both of the sentences
   it was built on are Paul's and neither has been withdrawn:

     2026-08-21 — "can you visually rewrite the themes for their actual notes
     as you play them" (PLAN.md Phase 4). The composed phrase belongs on the
     page, compiled the way the engine compiles it.
     2026-08-24 — "When playing -- Don't change motifs visually or change the
     editing interface. It's too confusing when it changes. Instead, show the
     fully composed motif ABOVE the editable version of the motif."

   Those two together are what put a COMPOSED staff above every WRITTEN one,
   captioned "as played in verse 3: in retrograde", inside every motif block.
   That was right on 2026-08-24 and it stopped being right the next morning,
   and the thing that ended it is not an argument — it is a feature that landed
   in between. Paul, 2026-08-25:

     "you don't need to show me the interpreted notation for a motif, only the
     pure representation, because now I have the sheet music."

   THE SCORE IS WHAT MADE IT REDUNDANT, and it is the whole reason this is a
   deletion rather than a regression. `scoreBlock` at the top of this axis
   (2026-08-25, "add a section ABOVE motifs which is the current playing
   music, two measures at a time, but ALL") draws the DEVELOPED music — every
   voice, barred together, through the section's own word, from the very
   `sectionRender` stream the engine plays. That is 2026-08-21's sentence
   answered better than a per-motif twin ever answered it: one system for the
   whole band instead of one staff per voice per motif, and it shows the
   counterpoint, which stacked twins could not. And 2026-08-24's sentence is
   answered by construction rather than by discipline — with no `[data-live]`
   inside a motif block at all, the clock cannot write on the editing
   interface even by accident.

   WHAT IS LEFT IN A MOTIF BLOCK is the PURE REPRESENTATION Paul named: the
   cell's own name and who reads it, the staff of the cell exactly as written,
   and the editor under it. No section, no voice, no word — a motif is a
   song-level fact and this block finally contains nothing else.

   WHAT WENT WITH THE COMPOSED HALF, named so nobody restores half of it by
   accident: `played` and `playedVoice` (the two registries), `liveBlock`,
   `voicePhrase`, `playedCaption`, `reserveCaption`, `REST16`/`barOrRest` (the
   bar of rests for a motif nobody plays here) and `repaintPlayed` (the
   transport's own repaint path). The playhead no longer lights a notehead in
   this axis at all; it lights the SCORE, which is one surface and the right
   one. */
// A SYSTEM OF STAVES, ONE PER MOTIF (2026-08-23, Paul: "how do I see and hear
// counterpoint"). The answer to that question is the score at the top of this
// axis now — several parts under one head, barred together — and this half of
// it is the tune you are writing, one staff per measure of one cell.
/* THE ONE REGISTRY IN THIS AXIS, and it was the third of three until the
   composed half was deleted this morning. Its own note was a reversal of a
   paragraph that no longer exists ("the written measures are registered
   NOWHERE … which makes 'the written staff is never touched by the clock' true
   by construction"), and the claim both were defending is now true for a
   simpler reason than either of them gave: THE CLOCK HAS NO PATH INTO THIS
   AXIS AT ALL. `repaintPlayed` is gone with the staves it repainted, and what
   the transport feed reaches in #app is `repaintScore` and `mark`, neither of
   which can see this map.

   WHY IT EXISTS. Until 2026-08-25 the written staff followed an edit because
   the WHOLE PAGE was rebuilt around it, and that rebuild is Paul's complaint
   ("it snaps left even though I'm not done editing"). Stop rebuilding and the
   staff has to be found by name, so it has to have been written down. Keyed by
   CELL — a cell has no section and no voice in it — with exactly one reader,
   `reEngraveWritten`, which has exactly one caller, `edited`, which is only
   ever reached from a control's own `change` handler. */
const written = new Map();     // cell name   -> { hosts: [{ host, then }], opts }
// HOW MANY TIMES abcjs HAS BEEN ASKED TO DRAW, for test/motif-frozen.js. A
// claim nobody can count is a claim nobody can check, so the count is on the
// page and not in the gate. (It used to be the cost argument for repainting
// the composed staves instead of rebuilding the page; those staves are gone,
// and what it counts now is exactly the written measures — one per redraw of a
// motif block and one per edit, and never one from the clock.)
let engraves = 0;
// (`atBar` stood here beside these two. It was assigned once a beat from the
//  transport feed and never read again — the chord chart marks its column
//  straight off `inBox` in the same handler.)
//
// `atSec` IS THE SOUNDING SECTION AND NOTHING ELSE, as of 2026-08-24. It used
// to mean both "what is sounding" and "what I am editing", and that conflation
// is what made a section boundary rebuild the whole page under a live finger:
// measured on the shipped chant, 436 ms of frozen main thread at 390px and
// 1516 ms at 1400px, every four to eight bars. What you are WRITING is
// `viewSec` (ui/state.js), and the tab strip above the staves moves it.
let atSec = 0, atStep = -1;
// ...clamped on every read, because a record swapped in from the atlas can
// bring a shorter form than the one the tab strip was built against.
const editSec = () => Math.max(0, Math.min(viewSec, DOC.form.sections.length - 1));
const engOpts = (chair) => ({
  barsPerLine: 1, stepsPerBar: 16, maxHold: 4,
  key: KEYS[DOC.alphabet.key] || 0,
  mode: MODES[DOC.alphabet.mode] || MODES.aeolian,
  reg: (chair || {}).reg | 0,
});
let abcLib = null;
function loadStaffLib() {
  if (window.ABCJS) return Promise.resolve(window.ABCJS);
  if (!abcLib) abcLib = new Promise((ok, no) => {
    const sc = document.createElement("script");
    sc.src = new URL("../../vendor/abcjs/abcjs-basic-min.js", import.meta.url).href;
    sc.async = true;
    sc.onload = () => ok(window.ABCJS);
    sc.onerror = () => { abcLib = null; sc.remove(); no(new Error("abcjs did not arrive")); };
    document.head.append(sc);
  });
  return abcLib;
}
// (`voicePhrase(voice, si, g)` stood here — `K.word(phrase(materialAt(voice,
//  SECID(si))), g.word(...))`, the DEVELOPED phrase, "compiled the way the
//  engine compiles it". It fed the composed staff and nothing else, and it went
//  with it on 2026-08-25 ("you don't need to show me the interpreted notation
//  for a motif, only the pure representation, because now I have the sheet
//  music"). The developed music is still on the page and is still compiled by
//  the engine's own path — `scoreParts` reads `sectionRender`, which is one
//  step further downstream than this was: the envelope, the intro and the
//  outro have had their say by then. Nothing was lost by deleting it, which is
//  why it is deleted rather than left for a caller that will never come.)
// (`writtenPhrase(voice, si)` stood here — `phrase(materialAt(voice,
//  SECID(si)))`, "the LOWER staff's phrase, the cell exactly as it is
//  written". The description was right and the ROUTE was the last of the
//  mistake Paul caught on 2026-08-24 ("i thought motifs were universal not per
//  voice?"): it reached a song-level fact through a player and a section, and
//  a cell has neither. The written staff is drawn once per CELL now and asks
//  `phrase(name)` for it — see motifs(). Deleted rather than left unused, so
//  nothing can route round a voice again by accident.)
// ONE MEASURE OF A VOICE: the sixteen steps of bar `m`, taken off the phrase
// AFTER its word has been applied, so what is engraved is what will sound.
const barSlice = (ph, m) => {
  const from = m * 16, cut = (v) => (v ? v.slice(from, from + 16) : undefined);
  const out = { deg: cut(ph.deg), oct: cut(ph.oct), vel: cut(ph.vel),
                inc: cut(ph.inc), stk: cut(ph.stk), gate: cut(ph.gate),
                acc: cut(ph.acc), sld: cut(ph.sld) };
  if (ph.hold) out.hold = ph.hold.slice(from, from + 16)
    .map((h, i) => (h ? Math.min(h, 16 - i) : 0));   // a tie stops at the barline
  return out;
};
// (`REST16` and `barOrRest(ph, m)` stood here — "a measure of the composed
//  phrase, or a bar's rest where it ran out", which is what kept the composed
//  block exactly as many measures tall as the written one whatever the
//  sounding section read. There is no composed block any more (see THE MOTIF AS
//  SHEET MUSIC, ONCE) and nothing else ever called them. The MEASUREMENT they
//  were built on is worth keeping and is not lost with the code: all 26
//  songs.js WORDS and all 47 kernel.js OPKEYS return a phrase the same length
//  as the one they were given — kernel.js:128 says so in prose, "the operators
//  stay closed" — so a development word can never change how many staves or how
//  many editors are on this page.)

/* ---------- WHICH SECTION YOU ARE WRITING — AND WHERE IT IS SAID NOW ----
   `#secs`, the tab strip that stood here, is DELETED. It was built exactly
   like the voice tabs below it, it wore the FORMGLYPH, it named each section's
   ROLE rather than its key, and every one of those decisions was right about
   the control it was. What was wrong was that there were TWO of them.

   Paul was asked to choose, on 2026-08-25, between letting the form list drive
   `editSec()` and keeping this strip; he said, verbatim: **"The first is
   good."** So the FORM LIST is the one owner of "where am I in the song" — you
   tap a section's number in the form tab, that section's questions come up,
   and that is also the section the composed staves are drawn for. One owner,
   which is this codebase's standing law against a second source of truth.

   THE COST, CHOSEN DELIBERATELY: moving the motif view to another section is
   now a trip to the form tab and back, where it used to be one tap over the
   staves. What pays for it is that a page cannot disagree with itself about
   which section you are in.

   TWO THINGS SURVIVED THE DELETION AND BOTH MATTER.

   `editSec()` keeps its name and its meaning — the section you are WRITING and
   never the sounding one, which is the promise that stops a section boundary
   shuffling a staff from one block to another. Only its INPUT changed: the
   form list calls `setViewSec`, where this strip did.

   And the motif block must still SAY which section it is drawing, because the
   control that said so is gone. The captions already did it and now carry the
   whole burden — "as played in verse 3: in retrograde — you are writing head
   1" (`playedCaption`) — which is why they name the section on BOTH sides of
   the sentence rather than only when the two disagree.

   THE ONE THING TO KNOW IF ANYBODY RESTORES IT: the reason a button could not
   go in the form table's number column was that those <th>s are the playhead's
   own live cells (`countCell`), and `mark()` empties a cell four times a beat.
   That objection was answered by NESTING rather than repealed — the live span
   now sits INSIDE the button. See `secNumber`. */

/* A WAY OUT OF THE SHARING, ONE PER READER. Under a voice's staff there was
   exactly one candidate and the button could name it ("give cantor its own
   copy"). A motif's block is shared by everyone who reads it, so every reader
   is a candidate and there is a button each —
   the same edit hookGrid makes, so there is one spelling of "fork a cell" and
   not two. */
function forkRow(parent, name, readers) {
  const p = el("p");
  for (const vn of readers) {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.k = "fork|" + name + "|" + vn;
    b.append(el("span", "give " + vn + " its own copy"));
    b.addEventListener("click", () => {
      const voice = DOC.voices.find((v) => v.name === vn);
      if (!voice) return;
      let n2 = 2, name2 = name + n2;
      while (DOC.material.cells[name2]) name2 = name + (++n2);
      DOC.material.cells[name2] = JSON.parse(JSON.stringify(DOC.material.cells[name]));
      // ...and a voice may read a different cell in each section, so the fork
      // replaces only the entries that pointed HERE — the same sentence
      // hookGrid's own fork makes, for the same reason.
      const m = voice.material;
      if (m && typeof m === "object")
        for (const k of Object.keys(m)) { if (m[k] === name) m[k] = name2; }
      else voice.material = name2;
      push(); draw();
    });
    p.append(b, document.createTextNode(" "));
  }
  parent.append(p);
}

/* ---------- THE MATERIAL AXIS, AND THE ONE NARROW REBUILD ---------------
   Everything `viewSec` governs is in here and nowhere else: which composed
   staves each motif's block is showing, and the drum grid. The form table and
   every dev sheet show ALL the sections and do not move when you change which
   one you are writing, which is what makes rebuilding this one <section> a
   complete answer rather than a shortcut.

   A MOTIF BLOCK IS BARELY GOVERNED BY `viewSec` AT ALL NOW, and this is what
   is left of a paragraph that said it was governed by half. It read: "a cell is
   the same cell in every section, so its written staff, its editor and its
   'read by' line are section-independent, and only the composed staves over it
   change when you tap another section." The composed staves are gone
   (2026-08-25), so the ONE thing the section still decides here is which
   voice's register the written staff is engraved in — `motifs()`'s `lead`, and
   nothing else. It is redrawn with the rest anyway, because the maker registry
   (`hookCells`) and the kit's (`stepCell`) are cleared at the top of this
   function and the playhead reads both: rebuilding half an axis and leaving
   the other half pointing at a stale registry is the bug that ordering note is
   about. `drawMaterial` pins the page on the axis's own <section>, whose top is
   above everything this function replaces.

   WHY THERE IS A SECOND ENTRY POINT AT ALL, with the number. A full `draw()`
   is the simple, correct answer and it keeps this file's "one owner of
   recompile" shape, so it was tried first and measured: a section tap costs
   248-341 ms at 390px and **404-595 ms at 1400px** of frozen main thread
   (2026-08-24, four taps at each width). That is the same order as the
   1516 ms rebuild this whole round exists to delete — and a round that killed
   the rebuild the clock caused, only to sell you one every time you look at
   another section, would have moved the complaint rather than answered it.
   Measured again with this in: **125-233 ms at 1400px and 114-165 ms at
   390px**, same four taps, same machine. Not free, and not a freeze.

   IT IS NOT A SECOND COMPILER. Nothing here decides anything: it calls the
   same three builders draw() calls, in the same order, into the same element.
   Every OTHER control on the page still ends at `changed()` -> `draw()`. */
function materialAxis(ax) {
  // A CONSTANT HEADING. This was a ternary — "the voices, as the verse plays
  // them" / "the voices, as written" — and it changed ON THE CLOCK, inside
  // #app, where nothing may (2026-08-24). Both facts it carried are said by the
  // SCORE's caption at the top of this axis, which names the section, the two
  // bars and the tense; they were said by the per-voice composed caption until
  // that staff was deleted on 2026-08-25. One owner per fact, and the owner
  // moved once.
  //
  // ...AND THERE IS ONE HEADING OVER THE MOTIFS, NOT TWO. For a few hours this
  // axis read "the motifs" — a stack of bare step grids — and then "the
  // voices", a stack of staves, so a motif's editor and a motif's notation
  // were two screens apart. Paul, 2026-08-24: "The motifs should stay with
  // their editors!!!" They do, in one run per motif (motifs(), below), so
  // there is nothing left for a second heading to name. The voices are not
  // lost with it: they are established in the band block, which is where Paul
  // said he expected to find them — "'the band' is where I thought voices
  // would be established, interpreting the progression, structure, and motif"
  // (2026-08-24). Material holds the tunes; Cast holds who reads them.
  //
  // the maker registry is cleared HERE, ahead of everything that draws into it
  hookCells = [];
  gridSeq = 0;
  // ...AND THE KIT'S, WHICH USED TO BE CLEARED BY `drumGrid` ITSELF because
  // `drumGrid` ran on every pass. It does not any more — it runs only when the
  // open motif IS a drum cell (2026-08-25, "make it part of motifs") — so a
  // record whose kit tab you have just left would leave sixteen detached <th>s
  // in the registry and the playhead would spend every beat writing into
  // elements that are not on the page. That is the exact bug `drumGrid`'s own
  // guard note describes, arriving from the other direction; it is cleared
  // where every other registry is cleared, once, before anything draws.
  stepCell = [];
  // THE SCORE COMES FIRST, because Paul said where it goes: "add a section
  // ABOVE motifs which is the current playing music". It is in MATERIAL rather
  // than in an axis of its own because what it draws is this axis's own stock
  // of tunes, played by the band — and because "above the motifs" is a
  // position on the page, not a new place in the eight.
  //
  // OUTSIDE `#staff`, and that is load-bearing: test/motif-frozen.js A2 counts
  // `#staff svg` against the measures this axis says it drew. The score is a
  // different kind of staff and belongs to neither side of that sum, so it
  // draws in its own element and the gate's arithmetic stays true. (The sum was
  // composed + written; it is one written staff per measure now, and the gate
  // needs the one-line edit named in this round's recipe.)
  scoreBlock(ax);
  heading(ax, "the motifs");
  // THE SECTION STRIP IS NOT HERE ANY MORE, AND THAT IS THE ROUND OF
  // 2026-08-25. It stood exactly here and its own note argued the position
  // well — "which composed staves a motif shows is decided by the section you
  // are WRITING, so the control that moves that belongs over them" — but the
  // form list moves that now, and one fact may have one owner. (Later the same
  // day the composed staves went too, so the strip has lost even the argument
  // it lost with.) See the
  // tombstone over `forkRow` for Paul's sentence and what it cost. What is
  // left in this axis is the motifs and their editors, which is all Paul ever
  // asked to find here ("The motifs should stay with their editors!!!").
  //
  // ONE MOTIF AT A TIME, CHOSEN FROM A STRIP (Paul, 2026-08-25: "organize the
  // motifs into a table with tabs, each motif a tab, like 'the band' section").
  // The strip is drawn BEFORE `#staff` because it is navigation and #staff is
  // notation; see motifTabRow.
  motifTabRow(ax);
  const sys = el("div"); sys.id = "staff";
  ax.append(sys);
  // THE SECTION YOU ARE WRITING, not the one that is sounding. `motifs(sys,
  // atSec)` is what made the editable half follow the playhead, and it was the
  // whole of the confusion Paul named. The written staff under each motif is
  // engraved from `phrase(name)` — the cell itself, with no section and no
  // voice in it — so a boundary cannot move a note in it; since 2026-08-25 it
  // cannot move anything in this axis at all, because there is no composed
  // staff left for it to move and `editSec()` decides only which register the
  // staff is drawn in.
  //
  // TWO PARENTS, AND `#staff` MEANS WHAT ITS NAME SAYS. The staves go in `sys`
  // and the chosen motif's EDITOR goes straight after it in the axis itself.
  // Until 2026-08-25 the editor was inside #staff too, and the seven designing
  // buttons becoming pictures is what made that untenable: test/motif-frozen.js
  // A2 counts `document.querySelectorAll("#staff svg")` and asserts it equals
  // composed + written measures, so seven <svg> icons per motif made an
  // engraving gate count buttons (measured: 27 svgs against 6 staves). The gate
  // is a contract and its arithmetic is right — #staff holds notation — so the
  // icons moved rather than the sum. Same judgement the score block made an
  // hour earlier when it drew outside #staff for the same reason.
  //
  // "The motifs should stay with their editors!!!" is untouched by this: it is
  // a statement about the ORDER things appear in on the page, which is
  // unchanged — staff, then the grid that writes it, adjacent and in that
  // order — and never was one about DOM nesting.
  motifs(sys, ax, editSec());
  // (`heading(ax, "the kit"); drumGrid(ax);` stood here — the drum grid as a
  //  block of its own at the foot of the axis. Paul, 2026-08-25: "don't just
  //  drop drum pattern in below; make it part of motifs." It is a motif block
  //  now, with a tab in the same strip, and `motifs()` calls `drumGrid` when
  //  the open tab is a drum cell. Nothing about the grid itself changed; what
  //  changed is that the page stopped saying, with its own layout, that a beat
  //  is a lesser kind of material than a tune.)
}
function drawMaterial() {
  const ax = $("ax-material");
  if (!ax) { draw(); return; }              // no axis yet: the page has not booted
  const wasKey = document.activeElement && document.activeElement.dataset
    ? document.activeElement.dataset.k : null;
  const wasPicker = opensAPicker(document.activeElement);
  keepPanes();
  // THE STICKY <h2> IS THE AXIS'S OWN and it is not rebuilt: it is what
  // `.nu-ax > h2` sticks with, and re-making it mid-scroll would flicker the
  // one band that is supposed to stay put.
  const h2 = ax.querySelector("h2");
  // …and this axis keeps ITS height while it is rebuilt, for the reason draw()
  // does (holdHeight): emptying it is what a scroll anchor reacts to.
  const release = holdHeight(ax);
  ax.textContent = "";
  ax.append(h2 || el("h2", "3 · Sheet music"));
  // THE STAVES STILL ARRIVE ON A PROMISE, so the axis is still shorter than it
  // is about to be, and the page must not jump when they land. This pinned
  // `#secs` — the strip you had just touched, which sat above everything being
  // rebuilt. The strip is gone (see the tombstone over `forkRow`), so the
  // anchor is the axis's own <section>, which is the element the strip was
  // standing in the top of and is the same guarantee said one level up: its
  // top is ABOVE every child this function replaces, so pinning it pins the
  // page while the axis grows underneath.
  anchorId = "ax-material";
  const anchor = $(anchorId);
  anchorWant = (anchorOff || !anchor) ? null : anchor.getBoundingClientRect().top;
  anchorAt = Date.now();
  try { materialAxis(ax); } finally { release(); }
  putPanes();
  restoreFocus(ax, wasKey, wasPicker);
  restoreAnchor();
}

/* ---------- ONE MOTIF, ONE BLOCK ---------------------------------------
   Paul, 2026-08-24, and the exclamation marks are his: *"The motifs should
   stay with their editors!!!"*

   WHAT THIS REWRITES, AND WHICH HALF OF IT WAS RIGHT. Earlier the same day
   Paul asked a question — "i thought motifs were universal not per voice? what
   made you change your mind?" — and the answer was that they ARE universal:
   there is ONE bank, `DOC.material.cells`, and a voice merely NAMES which cell
   it reads in each section (document.js `materialAt`). That answer was right
   and nothing here takes it back; the "read by cantor, schola" line below is
   that answer said out loud on the page, and it stays. What was wrong was
   ACTING on a question by restructuring a page nobody asked to have
   restructured: the editors were gathered into a block of their own at the top
   of the axis and the staves were left in another, so a motif's step grid sat
   under the heading "the motifs" and the same motif's notation sat under "the
   voices", two screens down. That also broke the pairing Paul HAD asked for
   that morning — "show the fully composed motif ABOVE the editable version of
   the motif" — because the editable half had walked out from under the
   composed half.

   So: one contiguous run per CELL, and the things that show and edit it are
   adjacent, in this order, top to bottom —

     the name             "psalm — read by cantor, schola".
     the notation         "as written": the cell itself, one staff per measure,
                          no section, no voice and no word in it. For a DRUM
                          cell there is no staff, because the sixteen-row grid
                          IS the notation and the editor at once.
     the editor           the step grid or the lane grid, the two rows of
                          designing icons, "+ measure", and the way out of the
                          sharing.

   THERE WAS A COMPOSED STAFF AT THE TOP OF THAT LIST FOR ONE DAY and it is
   written out rather than dropped, because it was asked for and then unasked
   for by name. It read: "the composed staff — what the engine is actually
   playing: this cell through the section's development word, in the reading
   voice's own register, captioned with which section and in what tense.
   `[data-live="played"]`, the only thing in this axis the clock may write."
   Paul, 2026-08-24: "show the fully composed motif ABOVE the editable version
   of the motif." Paul, 2026-08-25: "you don't need to show me the interpreted
   notation for a motif, only the pure representation, because now I have the
   sheet music." Between the two, the SCORE landed at the top of this axis and
   made it redundant — see THE MOTIF AS SHEET MUSIC, ONCE for the whole
   argument. There is now nothing in this axis the clock may write at all.

   WHERE THE BLOCK LIVES, which is the judgement this round asked for: in
   MATERIAL. That axis means "the record's stock of tunes", and a tune is what
   a cell is. Paul's other sentence the same day puts the players elsewhere and
   they are elsewhere — "'the band' is where I thought voices would be
   established, interpreting the progression, structure, and motif" — so
   bandBlock, in Cast, is where a voice is hired and where it picks the cell it
   reads per section. A motif is not a player's property; the NAMING is, and
   the naming is in the band.

   ONE TUNE, ONE EDITOR, HOWEVER MANY VOICES READ IT — and that is what the
   stack of composed staves was for. Two voices reading one subject used to get
   a composed staff each, stacked over the single written staff and the single
   editor they share, so that read downward the block said: here is what the
   cantor makes of it, here is what the schola makes of it, here is the tune
   itself, here is where you change it. The SHARING is still the point and it is
   still on the page — "read by cantor, schola" at the top of the block, and a
   `give <voice> its own copy` button per reader at the foot of it — but what
   each voice MAKES of the tune is the score's job now, where the two are
   barred together and you can read the counterpoint instead of inferring it
   from two stacked staves. The alternative this rejects is unchanged and is
   still wrong: a block per voice, which drew one tune twice with an editor
   under each, and made a song-level bank look per-voice.

   TWO PARAGRAPHS WENT WITH THE COMPOSED HALF and are recorded because both
   answered real objections. "WHICH BLOCK A VOICE'S COMPOSED STAFF SITS IN IS
   DECIDED BY THE SECTION YOU ARE WRITING, never by the one that is sounding" —
   membership was a moving fact, so a staff could otherwise have jumped blocks
   at a boundary. And "A MOTIF NOBODY PLAYS IN THE SECTION YOU ARE WRITING
   STILL GETS ITS COMPOSED STAFF — a bar of rests, captioned 'nobody plays
   neume in head 1'" — because dropping it would have changed the block's shape
   from section to section. Neither can happen any more: nothing in a motif
   block depends on which section is sounding, and the one thing that depends
   on the section you are WRITING is which reader's register the staff is drawn
   in, which cannot move an element.

   THE WRITTEN PHRASE HAS NO VOICE IN IT AT ALL. It was `writtenPhrase(voice,
   si)` — `phrase(materialAt(voice, SECID(si)))`, a song-level fact reached
   THROUGH a player — and it is now `phrase(name)`, the cell asked for by name.
   That one line was the last place the universality was still being routed
   round a voice, and deleting it is the part of this morning's answer that was
   worth keeping. (The REGISTER is still a player's: a staff has to be written
   in some clef, and there is no such thing as a clefless tune. The written
   staff uses the first reader's, and says who reads it directly above.)

   THE BLOCK IS CONTIGUOUS, NOT NESTED, and that is on purpose rather than by
   accident: every element of a motif is a direct child of `#staff`, in order,
   with a rule drawn over the block's name by nu.css (`.nu-motif`). Wrapping
   each block in a <div> would read the same to a person and would put the
   written staves one level deeper than `#staff > p > div`, which is the shape
   test/motif-frozen.js A2 counts. The gate is a contract; the grouping is
   presentation, and presentation is what a stylesheet is for. */

/* ---------- THE ROOM A STAFF WILL NEED, REMEMBERED ACROSS A REDRAW ------
   Paul, 2026-08-25: *"When I click tabs the page jumps around. It's endemic."*

   MEASURED at 390x844 with a real tap on the element's own on-screen point
   (never `page.click()`, which centres the target first and manufactures the
   jump it is looking for — see restoreAnchor). Tapping a band tab, with
   `window.scrollBy` stubbed out so the page's own reshape is visible:

     4 tabs (the shipped chant)   the page runs down  190px
     5 tabs                                           286px
     6 · 7 · 8 · 9 · 10 tabs      382 · 477 · 573 · 668 · 764px

   ~95px per voice, and 95px is one engraved measure. `draw()` empties #app and
   rebuilds it, and abcjs renders on a PROMISE — so at the instant draw()
   returns, every staff host above `#tabs` is an empty div and the page is
   short by one measure per composed staff. The staves then land, the page
   grows under the viewport, and Chromium's scroll anchoring pushes the window
   down by exactly that growth.

   `restoreAnchor()` was cancelling it and the shipped chant looked still: 190
   is under `ANCHOR_MAX` (240), so the correction ran and the net jump was 0px.
   At FIVE tabs the correction it is asked for is 286 — over the clamp — so it
   declines, clears `anchorWant`, and the later engraves find nothing armed.
   The whole 286px lands on the page. That is the cliff, and it is why Paul's
   word was "endemic": every band tab, every tap, on any record with three
   voices in it. The shipped chant had eleven pixels of margin.

   SO THE PAGE IS MADE NOT TO RESHAPE, rather than corrected after it has.
   A measure that has been engraved once says how tall it was, and the next
   redraw gives its host exactly that much room before abcjs is asked for
   anything. The page ends draw() at its settled height, restoreAnchor is asked
   for nothing at all — measured with `window.scrollBy` stubbed out, every tab
   still moves the window 0px — and there is no cliff to fall off.

   THIS IS THE SCORE'S OWN TRICK, one level down: `scoreReserve` already
   outlives draw() so "the box a record settled on is the box the next redraw
   starts in" (scoreBlock). The composed twins already reserve from their
   written measure — `if (!t.style.minHeight)` below — they just did it too
   LATE, inside the engrave callback, which is after draw() has returned and
   after restoreAnchor has already made its one decision.

   KEYED BY CELL AND MEASURE, never by position: `psalm#0` is the same music
   after a voice is added above it, "the third staff on the page" is not
   (PROGRAM.md 2.2). MEASURED FROM THE `<svg>` AND NOT THE HOST, because the
   host now carries a reserve and measuring it would read back the number we
   just wrote and ratchet it up forever; at 390px an engraved bar of rests is
   89px by either measure (measured 2026-08-25, svg 89 / host 89).
   THROWN AWAY AT A NEW WIDTH — a staff engraved for a phone is not the room a
   laptop needs — and at a NEW RECORD, for the same reason paneScroll is:
   reserving the old record's boxes on the new record's staves is a guess. */
const staffBox = new Map();
let staffBoxW = 0;
function staffBoxKeep() {
  if (innerWidth === staffBoxW) return;
  staffBoxW = innerWidth;
  staffBox.clear();
}
// ONE OWNER OF THE KEY, so the reader and the writer cannot drift apart.
const staffKey = (cell, m) => cell + "#" + m;
// `min-height` and not `height`, for the reason the twin reserve gives below:
// a measure that somehow needs MORE room must be readable rather than clipped.
// A measure nobody has engraved yet gets nothing, which is how the very first
// draw behaves exactly as it always did.
function staffRoom(host, cell, m) {
  const box = staffBox.get(staffKey(cell, m));
  if (box) host.style.minHeight = box + "px";
}

// (`liveBlock(parent, bars, twins, each, cell)` stood here — "a caption and
//  `bars` empty engraving hosts, in ONE contiguous [data-live] element". It was
//  the composed half's whole construction and it went with it on 2026-08-25.
//  Two things it argued are still true of this axis and are said here so they
//  are not re-discovered: a live element is ONE element per block, never
//  interleaved bar by bar with a still one, because that is what lets the
//  frozen half be defined by a single DOM operation (window.__eightFrozen);
//  and a staff that APPEARS on play pushes every editor below it down by 89px
//  at 390px, which is why the score block at the top of this axis is on the
//  page whether the transport runs or not.)
// ONE ENGRAVING, ONCE, AND NO REGISTRY. Both callers below draw a staff that
// nothing will ever repaint: the written measures and an unread motif's bar of
// rests. There is no `cur.abc !== eng.abc` guard because there is nothing to
// compare against — the only race left is a redraw landing between this promise
// and its resolution, and a redraw empties #app, which disconnects the host.
// That is the check. It is also why these staves are in no Map: the playhead
// cannot light what it cannot find, and that is the point (see lightStep).
function engrave(host, cut, opts, then) {
  let eng;
  try { eng = toEngraving(cut, opts); } catch (err) { return; }
  if (!eng) return;
  loadStaffLib().then((A) => {
    if (!A || !host.isConnected) return;
    try { A.renderAbc(host, eng.abc, { responsive: "resize", add_classes: true,
      staffwidth: Math.max(180, host.clientWidth - 8) }); }
    catch (err) { return; }
    engraves++;
    if (then) then();
  }).catch(() => {});
}

/* THE WRITTEN STAFF FOLLOWS THE EDIT, AND NOTHING ELSE MOVES. The one reader
   of `written`, called only by `edited` (above), never by the clock.

   IT IS THE SAME `engrave` AND THE SAME CALLBACK the boot pass used — one
   engraving path for this staff and not a refresh copy beside it, which is the
   mistake `repaintPlayed` was written to avoid on the composed half. The
   callback's reserve is `if (!t.style.minHeight)`, so a re-engrave cannot
   re-measure a composed twin and move it.

   A CELL THAT CHANGED LENGTH IS NOT AN EDIT, IT IS A DIFFERENT PAGE: `+
   measure` and `− measure` add and remove a whole grid and a whole staff, so
   they keep their `push(); draw();` and never arrive here. The length is
   checked anyway and falls back to the narrow rebuild, because a silent
   mismatch would engrave bar two of a one-bar cell into nothing. */
function reEngraveWritten(name) {
  const W = name && written.get(name);
  if (!W) return;
  const ph = phrase(name);
  const bars = Math.max(1, Math.round(ph.deg.length / 16));
  if (bars !== W.hosts.length) { drawMaterial(); return; }
  for (let m = 0; m < W.hosts.length; m++)
    engrave(W.hosts[m].host, barSlice(ph, m), W.opts, W.hosts[m].then);
}

/* ---------- WHICH MOTIF IS OPEN -----------------------------------------
   Paul, 2026-08-25: *"organize the motifs into a table with tabs, each motif a
   tab, like 'the band' section."*

   Before this the axis stacked every motif's whole block one after another: on
   the shipped chant that is three names, three composed staves, three written
   staves, three step grids and three rows of designing buttons in one column,
   and every one of them 8,357px worth of page you scroll past to reach the kit.
   Now the axis shows ONE, and the strip says which.

   IT IS A PAGE STATE, NEVER A DOCUMENT ONE — the same sentence `tab` and
   `formSec` carry, for the same reason: which motif you happen to be looking at
   is not a fact about the record, it never calls push(), and a second person
   opening the same record does not inherit your scroll position.

   KEYED BY THE MOTIF'S NAME, never by its index (PROGRAM.md §2.2). `cellNames()`
   is not a fixed list — `give <voice> its own copy` adds a cell and a fork can
   take one away — so an index would silently move you to a DIFFERENT motif when
   the bank changed underneath you, and `data-k="motiftab-3"` would restore focus
   to a button that is now a different button. A name does neither. */
let motifTab = null;
// THE MOTIFS, WHICH IS NOW EXACTLY THE CELLS. This said "WHICH IS NOT THE SAME
// LIST AS THE CELLS. A drum cell is a lane grid with its own editor at the foot
// of this axis (drumGrid) and hookGrid refuses one; it has never had a block
// here and must not get a tab." The second sentence was a fact about where the
// kit grid happened to be drawn, dressed up as a fact about what a motif IS,
// and Paul overruled it on 2026-08-25: *"motifs: give me a way to add a motif
// and a way to add a drum pattern. don't just drop drum pattern in below; make
// it part of motifs."* A beat and a tune are the same kind of thing in the
// document — both are named entries in `DOC.material.cells`, both are reached
// through `materialAt`, both belong to the record and not to a player — so they
// are the same kind of thing in the strip. What is still true is the clause
// about hookGrid: it refuses a drum cell, and `motifs()` sends one to
// `drumGrid` instead. One list, two editors.
const motifNames = () => cellNames();
// ...AND WHICH CELLS A VOICE OF THIS KIND MAY READ, which is the honest half of
// the same idea. A drum cell is LANES and a line cell is DEGREES: `toPhrase`
// hands back a blank for a drum cell ("a grid is not a line", document.js:230)
// and `document.js:133` reads `.lanes` off the drummer's cell and nothing else.
// So the offer is filtered by kind rather than by hope — see avail.js
// `cellsFor`, which is where the same rule is stated for the menus.
const drumCells = () => cellNames().filter((n) => DOC.material.cells[n].kind === "drum");
/* THE STRIP, BUILT LIKE THE BAND'S so the two surfaces are the same object and
   a person who has learned one has learned the other: a <p> of buttons, one per
   motif, `aria-pressed` saying which, and the chosen one wearing the same
   <mark> the playhead wears — the highlight the browser already has, which
   survives a stylesheet being turned off and a high-contrast mode being turned
   on. (bandBlock, below, is the original; nothing is factored out of the two
   because they differ in what a tab IS — a voice tab may also be `form` or
   `performance`, and a motif tab is only ever a cell name.)

   `drawMaterial()` AND NOT `draw()`: which motif is open changes exactly one
   axis, and drawMaterial is the narrow rebuild that already keeps the pane
   scrolls, the focus key and the scroll anchor (see drawMaterial). The band's
   strip calls draw() because a voice tab changes the mixer and the sheets too.

   WHAT SAYS "read by nobody" IS STILL THE BLOCK'S OWN LABEL and not the tab.
   A tab is a name you tap; the sentence about who reads it is a fact about the
   motif and belongs over the motif, where it was. */
function motifTabRow(parent) {
  const names = motifNames();
  if (!names.includes(motifTab)) motifTab = names[0] || null;
  if (!names.length) return;
  const bar = el("p");
  // an id and no class, exactly like the band's `#tabs`: a strip of buttons in
  // a <p> needs no rule at all — `button{min-height:var(--tap)}` at the top of
  // nu.css already sizes and targets them, and they wrap on their own.
  bar.id = "motif-tabs";
  for (const name of names) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.k = "motiftab-" + name;
    b.setAttribute("aria-pressed", String(name === motifTab));
    if (name === motifTab) b.append(el("mark", name));
    else b.append(el("span", name));
    b.addEventListener("click", () => { motifTab = name; drawMaterial(); });
    bar.append(b, document.createTextNode(" "));
  }
  /* ---------- AND TWO WAYS TO GROW THE BANK ------------------------------
     Paul, 2026-08-25: *"motifs: give me a way to add a motif and a way to add a
     drum pattern."*

     THIS IS A TOMBSTONE ANSWERED. `hookGrid`'s own note has said since
     2026-08-24: *"WHAT WENT WITH IT, NAMED SO IT CAN BE PUT BACK ON PURPOSE:
     the `+ cell` button. Adding a cell that no voice reads yet has no home on
     the page now — the only way to grow the material is `give <voice> its own
     copy` on a shared cell."* It has a home now, and it is this strip: a motif
     is a name you tap, so the place to make a new one is beside the names.

     IN THE STRIP AND NOT UNDER IT, exactly like the band's `+ line` / `+ bass`
     / `+ drums`, which live in `#tabs` beside the voice tabs. The two surfaces
     are deliberately the same object (see the note over this function), and a
     person who has learned "the add buttons are at the end of the strip" has
     learned both.

     THE NEW CELL IS A TABLE, NOT A GENERATION. `NEWMOTIF` and `DRUMGRID` are
     literals — determinism, tables not generation — so two people who tap this
     button get the same tune and the same beat, forever. A cell of sixteen
     rests would have been the other candidate and it is refused: every degree
     slider under it is disabled until you say "note" on its step, so the first
     thing a new motif would do is refuse to be edited.

     ...AND IT OPENS THE TAB IT MADE, which is the half that makes it a
     gesture rather than an announcement: `motifTab = n` before the redraw, so
     the block you are looking at afterwards is the one you just created. */
  for (const [label, kind] of [["+ motif", "line"], ["+ drum pattern", "drum"]]) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.k = kind === "drum" ? "adddrumcell" : "addcell";
    b.append(el("span", label));
    b.addEventListener("click", () => { motifTab = addCell(kind); push(); draw(); });
    bar.append(b, document.createTextNode(" "));
  }
  parent.append(bar);
}
/* A NEW MOTIF, AS A TABLE. Four quarter notes on the tonic and twelve rests —
   the plainest thing that is still a tune you can hear, edit and transform, and
   the same shape a metronome has. `DRUMGRID` (three lanes, four on the floor)
   is the drum half and it is the very literal `addVoice("drums")` already hires
   a kit with, so a beat added here and a beat added by hiring a drummer are the
   same sixteen steps and not two opinions. */
const NEWMOTIF = { deg:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
                   vel:  [5,0,0,0, 5,0,0,0, 5,0,0,0, 5,0,0,0],
                   play: ["n","r","r","r", "n","r","r","r",
                          "n","r","r","r", "n","r","r","r"] };
// A NAME IS AN IDENTITY (the same sentence `freeName` makes about voices), so a
// cell is never given one the bank already holds — a second `beat` would make
// `cellOf` answer for whichever came first and a fork would overwrite a tune.
function addCell(kind) {
  const base = kind === "drum" ? "beat" : "motif";
  let n = base, i = 1;
  while (DOC.material.cells[n]) n = base + (++i);
  DOC.material.cells[n] = kind === "drum"
    ? { kind: "drum", lanes: JSON.parse(JSON.stringify(DRUMGRID)) }
    : JSON.parse(JSON.stringify(NEWMOTIF));
  return n;
}

// (`staves(parent, si)` stood here — one block per VOICE, and the makers in a
//  separate bank above. It is `motifs` now: one block per CELL, with the
//  voices that read it stacked inside it. The rename is the change, so the old
//  name is not left pointing at a different idea.)
//
// `deck` IS WHERE THE EDITOR GOES and `parent` is where the staves go; see the
// two-parents note in materialAxis for why they are different elements.
//
// `si` IS THE SECTION YOU ARE WRITING and it is down to ONE reader now: which
// voice's register the written staff is engraved in. Everything else it used to
// decide — which composed staves this block showed, and what their captions
// said — went with the composed half on 2026-08-25. A motif block is a
// song-level fact again, which is what it always was in the document.
//
// A DRUM CELL IS A MOTIF TOO (Paul, 2026-08-25: "don't just drop drum pattern
// in below; make it part of motifs"). The kit grid was a block of its own at
// the foot of this axis, under its own heading, which said with the page's
// layout that a beat is a different KIND of thing from a tune. It is not: both
// are entries in `DOC.material.cells`, both are named, both are read by a voice
// through `materialAt`, and both are the record's and not a player's. So a drum
// cell gets a tab in the same strip and a block in the same run — the same
// name line, the same "read by", the same fork buttons — and the only thing
// that differs is which editor goes under it, because lanes and degrees are
// genuinely different data. `drumGrid` draws one and `hookGrid` the other.
function motifs(parent, deck, si) {
  written.clear();
  staffBoxKeep();       // a staff engraved for a phone is not a laptop's room
  const lines = LINES();
  let firstBlock = true;
  // ONE BLOCK, THE ONE THE STRIP IS ON. The loop is kept rather than replaced
  // by a single lookup because everything inside it is written to be run any
  // number of times, and a record whose bank is empty must draw nothing rather
  // than throw. motifTabRow() has already chosen; this only obeys.
  for (const name of motifNames().filter((n) => n === motifTab)) {
    const H = DOC.material.cells[name];
    if (!H) continue;
    const isDrum = H.kind === "drum";
    // WHO READS IT, ACROSS THE WHOLE RECORD — the one line the restructure
    // added that was simply right, kept verbatim. `usesCell` asks about the
    // record and not about this section on purpose: a voice that reads `psalm`
    // only in the verses is still sharing it, and the fork buttons at the foot
    // of the block are about exactly that.
    const readers = DOC.voices.filter((v) => usesCell(v, name)).map((v) => v.name);
    const label = el("p", name + " — " +
      (readers.length ? "read by " + readers.join(", ") : "read by nobody"));
    // the block's own name, and the rule above it that makes "one block" a
    // thing you can SEE rather than a thing this comment claims (nu.css)
    label.className = "nu-motif" + (firstBlock ? " nu-first" : "");
    firstBlock = false;
    parent.append(label);

    if (isDrum) {
      // A GRID IS ITS OWN NOTATION. There is no staff over a drum cell and
      // there never was one: `toPhrase` returns a blank for a drum cell by
      // design ("a grid is not a line", document.js:230) and abcjs would be
      // handed sixteen zeros. The sixteen-row table IS the picture and the
      // editor at once, which is the one place on this page where those two
      // are honestly the same object.
      drumGrid(deck, name);
      if (readers.length > 1) forkRow(deck, name, readers);
      continue;
    }

    const ph = phrase(name);
    const bars = Math.max(1, Math.round(ph.deg.length / 16));
    // THE REGISTER THE STAFF IS ENGRAVED IN, and it is the only thing left in
    // this block that knows what a voice is. A staff needs a clef and a cell
    // does not have one, so it takes the register of whoever is reading this
    // cell in the section you are writing, and failing that of the first reader
    // anywhere in the record. `engOpts` tolerates no chair at all, which is
    // what a motif nobody reads has.
    const lead = lines.filter((v) => cellAt(v, si) === name)[0] ||
                 VOICE(readers[0]) || null;
    const opts = engOpts(lead && lead.cast);

    // THE CELL AS WRITTEN, AND NOW IT IS THE ONLY STAFF IN THE BLOCK. Its label
    // is a constant: this staff says one thing and says it always.
    const wl = el("p", "as written");
    wl.className = "nu-hint";
    parent.append(wl);
    // …and this cell's own staff, findable by name, so that changing a note can
    // re-engrave THIS and rebuild nothing (see `written`, `edited`)
    const wreg = { hosts: [], opts };
    written.set(name, wreg);
    for (let m = 0; m < bars; m++) {
      const host = el("div");
      staffRoom(host, name, m);         // …and the written staff's own room
      const wrap = el("p"); wrap.append(host); parent.append(wrap);
      const then = () => {
        restoreAnchor();                 // the page just grew by one staff
        // ...AND THE NEXT REDRAW STARTS AT THIS HEIGHT. Paul, 2026-08-25: "When
        // I click tabs the page jumps around. It's endemic." abcjs engraves on a
        // PROMISE, so at the instant draw() returns every staff host is an empty
        // div and the page is short by one measure per staff; the staves then
        // land, the page grows under the viewport, and the browser's scroll
        // anchoring pushes the window down by exactly that growth (measured:
        // ~95px per staff, 764px at ten voices). A measure that has been
        // engraved once says how tall it was, and `staffRoom` above gives the
        // host exactly that much room BEFORE abcjs is asked for anything.
        //
        // THE `<svg>` AND NOT THE HOST (staffBox, above): the host may already
        // be carrying the box this measure engraved to on the last redraw, and
        // measuring it back would ratchet the reserve up a little every time.
        // (This paragraph also gave every COMPOSED twin above this measure the
        //  same room — `for (const t of mine) if (!t.style.minHeight)` — with
        //  the measurement that forced it: a bar of notes engraves 108px and a
        //  bar of rests 89px, so a voice that was `out` in one section moved
        //  every editor below it by 19px at a boundary. There are no twins any
        //  more, so what is left is the reserve for the redraw. The measurement
        //  is kept because it is the reason the reserve is measured off the
        //  <svg> at all.)
        const px = Math.ceil(((host.querySelector("svg") || host)
                              .getBoundingClientRect()).height);
        staffBox.set(staffKey(name, m), px);  // …so the NEXT redraw starts here
      };
      wreg.hosts.push({ host, then });
      engrave(host, barSlice(ph, m), opts, then);
    }

    // THE EDITOR, UNDER THE STAFF IT WRITES AND INSIDE THE SAME BLOCK. This is
    // the whole of Paul's sentence: the motif stays with its editor.
    //
    // ALL MEASURES, NOT ONE. `barOnly` is null, so hookGrid draws every measure
    // of the cell — the branch it already has. Under a voice's staff the maker
    // was drawn per measure so the editor for bar two sat under bar two (Paul,
    // 2026-08-24, morning); here the whole tune is one editor under one staff,
    // and the panes still swipe a bar at a time.
    //
    // `voice` IS NULL: there is no one voice to fork FOR, so hookGrid draws no
    // fork button and forkRow below draws one per reader.
    //
    // `__grid` IS CLEARED BETWEEN CELLS. It is hookGrid's "have I already made
    // a registry entry for this maker" latch, written once and reused for every
    // later call — which is right when one maker draws its measures one call at
    // a time, and wrong here, where each cell is its own maker. Left set,
    // cell 2's header cells would overwrite cell 1's and the playhead would
    // light the wrong grid.
    hookCells.__grid = null;
    hookGrid(deck, name, hookCells, null, null, true);
    if (readers.length > 1) forkRow(deck, name, readers);
  }
}

/* (`reserveCaption`, `playedCaption` and `repaintPlayed` stood here — the
   composed half's caption machinery and its repaint path — and all three went
   on 2026-08-25 with the staves they served ("you don't need to show me the
   interpreted notation for a motif, only the pure representation, because now
   I have the sheet music"). THREE THINGS THEY ESTABLISHED ARE STILL LAW HERE
   and are kept rather than lost with the code, because the score at the top of
   this axis obeys all three and one surface up is where they now live:

     A CAPTION MAY NOT CHANGE HEIGHT. A sentence at the top of a live block
     that wraps to a second line moves every editor under it. Measured at 390px
     on 2026-08-24: "as head 1 plays it: as written" is 30 characters and "as
     played in verse 3: in retrograde — you are writing head 1" is 59. So a
     caption is set ONCE to the longest thing it could ever say about this
     record, measured, and reserved — one write pass, then one read pass, never
     interleaved, because reading a height forces layout. `reserveScoreCaption`
     is four lines of exactly this.

     TENSE IS THE HONEST DIFFERENCE. Present stopped ("as it will play"), past
     playing ("as played"): stopped, nothing is sounding and the picture is a
     prediction; playing, it is a report. `scoreCaption` says it in the same
     words.

     A PICTURE THAT DOES NOT SAY WHICH SECTION IT IS SHOWING IS WORSE THAN NO
     PICTURE, because you can be writing the tag while the second verse sounds.
     `scoreCaption`'s " - you are writing head 1" is that sentence.

   The CHANGE DETECTOR argument went with `repaintPlayed` too and is also still
   in force one surface up: `toEngraving`/`toScore` is pure arithmetic over a
   few small arrays and costs nothing, `renderAbc` is the expensive half, so
   the ABC string is compared before the render is asked for. `repaintScore`
   makes that comparison.) */
const secName = (i) => { const s2 = DOC.form.sections[i];
  return s2 ? s2.role + " " + (i + 1) : "section " + (i + 1); };

/* ---------- THE HOOK AS A GRID -----------------------------------------
   The same sixteen columns as the kit, under the same count, so a step means
   the same thing in both and the same playhead lights both. FIVE rows per
   measure: note, hold and rest as one radio group per step, then the degree
   and its readout under them.

   (This said "two rows … the degree is a one-character text box, because a
   <select> or a number spinner is three times as wide as a checkbox". Both
   halves stopped being true on 2026-08-23 and the comment did not: "use range
   sliders for numeric inputs" made the degree a VERTICAL range — narrower than
   the text box was, and it draws the tune as it stands — and the play state
   became three radios rather than one field the moment "don't let me enter a
   held note after a rest" had to be a refusal you can see.)

   This header also sat over `cellStrip` alone and described a function ninety
   lines below it, which is how a comment stops being read. It now introduces
   the two pieces the maker is made of, in the order they are written below:
   the buttons that design a cell, and the grid.

   THE CELL STRIP WAS THE THIRD PIECE AND IT IS GONE — deleted 2026-08-24, and
   this is its tombstone rather than a silent removal. It said "Material is a
   map of named cells and a voice reads one of them. The strip picks which one
   the maker below is editing", and that sentence stopped being the design on
   2026-08-23, when Paul asked for "an edit grid under the editable measures":
   the maker moved under each voice's own staff and edits that voice's own cell,
   so there is nothing left for a page-level cursor to point at. `draw()` had
   already stopped calling it — measured, zero callers — and its private
   `lineCells()` was a SECOND copy of `avail.js:215 lineCells(doc)`, which is
   the list the `cast.material` sheet and the extractor both read.

   WHAT WENT WITH IT, NAMED SO IT CAN BE PUT BACK ON PURPOSE: the `+ cell`
   button. Adding a cell that no voice reads yet has no home on the page now —
   the only way to grow the material is `give <voice> its own copy` on a shared
   cell, below. `cellSel` survives because it is still the fallback `phrase()`
   compiles with and the cell a newly hired line is handed; it can no longer be
   moved from "hook", which is a smaller surface than it looks and is worth an
   item on STATE.md rather than a control invented here. */

const PLAYS = [["n", "\u266a note"], ["h", "\u2014 hold"], ["r", "\u00b7 rest"]];

/* THE DESIGNING BUTTONS (2026-08-23, Paul: "the hook edit should be
   programmable with the hook designing buttons"). The same operators the
   development words are made of, applied to the CELL ITSELF — writing rather
   than arranging. A word says "play it backwards in the chorus"; this button
   says "the tune IS backwards now".

   The kernel's two types decide what moves. POSITIONAL operators permute
   steps, so the note/hold/rest states travel with them — worked out by
   running the operator over an index vector and reading the order back, which
   is exact for any permutation and needs no second implementation. PITCH
   operators touch degrees only and leave the rhythm alone. */
/* ---------- AND THE SEVEN ARE DRAWN, NOT SPELLED ------------------------
   Paul, 2026-08-25: *"'backwards shift left shift right upside down up a step
   down a step wider' can be icons"*.

   THIS REVERSES A STATED LAW AND THE LAW IS QUOTED HERE RATHER THAN QUIETLY
   DROPPED. PLAN.md Phase 1: *"No icons anywhere: words instead (the dice ⚄
   becomes 'roll a record', ⟲ becomes 'start again', the play button says
   'play' / 'stop')."* That law still holds everywhere else on this page and
   nothing else in this file has been touched.

   WHAT MAKES THIS NARROW RATHER THAN A REPEAL. The old law was about actions
   with NO VISUAL FORM — you cannot draw "roll a record", so a glyph there is
   decoration standing where a word should be. These seven are GEOMETRIC
   OPERATIONS ON A SHAPE THE USER IS LOOKING AT. Backwards, upside down,
   wider: each has a picture, and the picture is the more legible of the two.
   Same move the circle of fifths made yesterday — draw the object rather than
   name it.

   SO THEY ARE NOT ARROWS. An arrow is a second symbol you also have to know.
   Each icon is a MINIATURE OF THE TRANSFORM APPLIED TO A LITTLE TUNE: five
   notes drawn as blocks at their pitch heights, the original ghosted behind
   and the result solid in front, over the line the tune started on. A reader
   who has never seen the row can work out what "wider" does from the picture
   — which is not true of the word, and not true of an arrow.

   ONE CONTOUR, SEVEN OPERATIONS, so the seven are visibly the SAME tune and
   cannot drift apart when one is edited. `art` is the operation on the
   drawing, kept separate from `op` on purpose: `op` is the kernel operator
   that edits the record and is the only thing that may decide what the button
   DOES. If the two ever disagree the picture is wrong, not the record.
   (`spread` opens the intervals by a factor; the drawing uses 1.6 because a
   whole-number scale on a five-step contour puts two of the blocks off the
   top of a 26-unit box.)

   THE WORD STAYS IN THE DOM. `hookGrid` gives every one of these a `.nu-vh`
   span carrying `w` — that is the accessible name, and with the stylesheet
   off it is simply visible text, so the row still reads as the seven words in
   order (test/sheets.js disables sheet 0 and asserts against innerText). A
   `title` is not an accessible name and a bare `aria-label` vanishes with the
   stylesheet; neither would have survived either gate. The <svg> is
   `aria-hidden` and `pointer-events: none` (nu.css) — the BUTTON is the tap
   target and the picture can never eat the tap, which is the half-hour the
   globe round lost to a decorative stroke swallowing every press. */
const TUNE = [-2, 0, 1, -1, 1];         // the little tune, in scale steps
const DESIGNS = [
  { w: "backwards",  op: ["reverse"],       moves: true,
    art: (c) => c.slice().reverse() },
  { w: "shift left", op: ["rotate", 1],     moves: true,
    art: (c) => c.slice(1).concat(c.slice(0, 1)) },
  { w: "shift right",op: ["rotate", -1],    moves: true,
    art: (c) => c.slice(-1).concat(c.slice(0, -1)) },
  { w: "upside down",op: ["invert", 4],     moves: false,
    art: (c) => c.map((v) => -v) },
  { w: "up a step",  op: ["transpose", 1],  moves: false,
    art: (c) => c.map((v) => v + 1) },
  { w: "down a step",op: ["transpose", -1], moves: false,
    art: (c) => c.map((v) => v - 1) },
  { w: "wider",      op: ["spread", 2],     moves: false,
    art: (c) => c.map((v) => Math.round(v * 1.6)) },
];
/* The box is 32x26 user units and the button decides how big that is on
   glass; every number below is in those units. A block is a note at its pitch
   height — five of them, six units apart — and the dashed rule is the pitch
   the tune's own step 0 sat on, which is what makes "up a step" and "down a
   step" different pictures rather than the same one twice.

   THE BLOCKS WERE FATTENED ON 2026-08-25 after looking at the row at its real
   size rather than at a 6x screenshot: 4.4x2.6 in a 32px-wide picture is a
   4.4x2.6-PIXEL note, and ten of them read as a smudge. 5x3.2 is the largest
   block that still leaves the full seven-step range (mid ± 3 steps of 3, plus
   the block's own height, is 23.6 of the 26 available) and still fits five
   across (2 + 4x6 + 5 = 31 of 32). The picture is drawn bigger on glass too —
   nu.css `.nu-tf`, because how big is presentation and this is geometry. */
const ART = { w: 32, h: 26, x0: 2, dx: 6, bw: 5, bh: 3.2, mid: 11.4, step: 3 };
function designArt(d) {
  const g = S("svg", { viewBox: "0 0 " + ART.w + " " + ART.h, width: ART.w,
                       height: ART.h, class: "nu-tf", "aria-hidden": "true",
                       focusable: "false" });
  g.appendChild(S("line", { class: "nu-tf-ref", x1: 0.5, y1: ART.mid + ART.bh / 2,
                            x2: ART.w - 0.5, y2: ART.mid + ART.bh / 2 }));
  const lay = (c, cls) => c.forEach((v, i) => g.appendChild(S("rect", {
    class: cls, x: ART.x0 + i * ART.dx, y: ART.mid - Math.max(-3, Math.min(3, v)) * ART.step,
    width: ART.bw, height: ART.bh, rx: 0.7 })));
  lay(TUNE, "nu-tf-was");               // where the tune was
  lay(d.art(TUNE), "nu-tf-is");         // where this button puts it
  return g;
}
/* ---------- ...AND THE SAME ROW FOR TIME ---------------------------------
   Paul, 2026-08-25: *"just as there are icons for pitches create icons for
   tempo operations and add them and make them work."*

   WHAT THE KERNEL ACTUALLY HAS, established before a single icon was drawn,
   because "make them work" is the load-bearing half of that sentence.
   `kernel.js` OPKEYS is the alphabet and it names these time operators:
   `gat2/gat4/gat8` (`only("gate", rotate(n))` — the RHYTHM moves and the
   degrees stay), `gateflip` (`complement("gate")`), `dens2/3/4` (`fill(n)`),
   `thin2/3/4` (`drop(n)`), `rep2..8` (`split(n)`) and `del2..8` (`del(n)`).
   Seven icons, one per family, so the row is the same length as the pitch row
   above it and every family is represented once.

   WHAT IS NOT HERE, AND WHY THERE IS NO ICON FOR IT. Augmentation and
   diminution — the two operations a musician asks for first — are NOT in that
   list and cannot be assembled from it: no operator in `kernel.js` maps step i
   to step 2i, and every operator in the family is CLOSED (kernel.js:132, "Both
   re-cycle to the original length"), so nothing here can make a phrase last
   twice as long. `split(2)` is the near miss and it is a different thing: it
   subdivides a note that is already long, which is an arpeggiator, not
   augmentation. Drawing an icon for augmentation and wiring it to `split`
   would be a picture that lies about what the button does, which is the one
   thing this row must not do. It is recorded as unavailable and it stays
   recorded.

   THE PICTURE IS THE OPERATOR ITSELF, and that is a departure from the pitch
   row directly above, which keeps `art` and `op` deliberately separate ("If
   the two ever disagree the picture is wrong, not the record"). The reason for
   the separation there is that a contour drawn five blocks wide has to be
   SIMPLIFIED to read at 32px — `spread` is drawn at 1.6 because a whole-number
   scale puts two blocks off the top of the box. A rhythm has no such problem:
   a gate vector IS a row of blocks, at one-to-one, so the honest drawing and
   the true answer are the same eight numbers. `timeArt` therefore runs the
   very operator the button runs, over a toy phrase, and draws what comes back.
   A picture that cannot disagree with its button is better than a picture that
   is checked against it.

   THE TOY PHRASE is eight steps, five of them sounding, carrying the same
   five-note contour `TUNE` gives the pitch row — so the two rows are visibly
   the same little tune and the difference between them is visibly the RHYTHM
   (Paul: "the same contour with its RHYTHM changed rather than its pitch").
   The three silent steps carry a degree of their own, which is not decoration:
   "a rest still carries a DEGREE — the deg vector has a value at every step,
   gated or not — so filling does not invent notes, it uncovers ones the phrase
   was already holding silent" (kernel.js:178). `twice as busy` uncovers one of
   them, and the picture shows exactly that. */
const TIMETUNE = { deg:  [-2, -2, 0, 1, 1, -1, -1, 1],
                   gate: [ 1,  0, 1, 1, 0,  1,  0, 1] };
const TIMES = [
  // gateflip — the rhythm's own complement: every rest sounds and every note rests
  { w: "off the beat",      mk: () => K.complement("gate") },
  // gat2 / the same with a negative turn — the RHYTHM moves against the degrees,
  // which is the one thing `only` exists to make expressible (kernel.js:122)
  { w: "rhythm earlier",    mk: () => K.only("gate", K.rotate(2)) },
  { w: "rhythm later",      mk: () => K.only("gate", K.rotate(-2)) },
  { w: "twice as busy",     mk: () => K.fill(2) },     // dens2
  { w: "half as busy",      mk: () => K.drop(2) },     // thin2
  { w: "each note in two",  mk: () => K.split(2) },    // rep2
  { w: "drop every fourth", mk: () => K.del(4) },      // del4
];
// EIGHT SLOTS IN THE SAME 32x26 BOX the pitch row uses, so the two rows are the
// same size on glass and share `.nu-tf`. 1 + 7x3.9 + 3 = 31.3 of 32.
const TART = { w: 32, h: 26, x0: 1, dx: 3.9, bw: 3, bh: 3.2, mid: 11.4, step: 3 };
// A TOY PHRASE THE OPERATORS WILL ACCEPT. `split` reads `inc` and `stk` and
// `del` moves every vector `mapv` knows about, so all eight are present — a
// missing one is not a smaller phrase, it is a throw inside the picture.
const timeToy = () => { const n = TIMETUNE.deg.length, z = () => zeros(n);
  return { deg: TIMETUNE.deg.slice(), oct: z(), vel: z(), inc: z(), stk: z(),
           gate: TIMETUNE.gate.slice(), acc: z(), sld: z() }; };
function timeArt(d) {
  const g = S("svg", { viewBox: "0 0 " + TART.w + " " + TART.h, width: TART.w,
                       height: TART.h, class: "nu-tf", "aria-hidden": "true",
                       focusable: "false" });
  g.appendChild(S("line", { class: "nu-tf-ref", x1: 0.5, y1: TART.mid + TART.bh / 2,
                            x2: TART.w - 0.5, y2: TART.mid + TART.bh / 2 }));
  const lay = (p, cls) => p.gate.forEach((on, i) => { if (!on) return;
    g.appendChild(S("rect", { class: cls, x: TART.x0 + i * TART.dx,
      y: TART.mid - Math.max(-3, Math.min(3, p.deg[i])) * TART.step,
      width: TART.bw, height: TART.bh, rx: 0.7 })); });
  const was = timeToy();
  lay(was, "nu-tf-was");                       // where the rhythm was
  let is2 = was;
  try { is2 = d.mk()(timeToy()); } catch (err) { is2 = was; }
  lay(is2, "nu-tf-is");                        // where this button puts it
  return g;
}
const zeros = (n) => new Array(n).fill(0);
/* APPLYING A TIME OPERATOR TO A CELL, which is a different write from `design`
   below it and not a special case of it. `design` moves DEGREES and carries the
   note/hold/rest states along by reading the permutation back off the operator;
   this moves the RHYTHM, so the thing that has to survive the trip is the cell's
   `play` vector and nothing else.

   THE GATE IS `play === "n"`, WHICH IS THE COMPILER'S OWN ARITHMETIC:
   `document.js` toPhrase:237 is literally `play.map((p) => (p === "n" ? 1 : 0))`.
   Reading it any other way here would mean the picture and the sound disagree
   about what the button did.

   A HOLD RIDES IN `stk`, which is the one trick in this function. `mapv` moves
   `stk` with every other vector (kernel.js:70), so a `del` that drags the
   phrase forward drags the holds with it instead of stranding them at the
   indices they used to be at. `stk` is otherwise untouched by every operator in
   TIMES and is not read by this page at all, so it costs nothing to borrow.

   AND ORPHANS ARE SWEPT, because "holding a silence is not a thing you can
   play" (hookGrid's own `holdOK`, verbatim). Rotating a gate can leave a hold
   whose note has moved out from under it; the sweep runs to a fixpoint, because
   turning one hold into a rest can orphan the hold behind it. The same walk
   hookGrid uses, cyclic, because the cell loops. */
function designTime(cell, d) {
  const n = cell.deg.length;
  if (!cell.play) cell.play = cell.deg.map(() => "n");
  const play = cell.play.slice();
  const base = { deg: cell.deg.slice(), oct: zeros(n), vel: (cell.vel || zeros(n)).slice(),
                 inc: zeros(n), stk: play.map((p) => (p === "h" ? 1 : 0)),
                 gate: play.map((p) => (p === "n" ? 1 : 0)),
                 acc: (cell.acc || zeros(n)).slice(), sld: zeros(n) };
  let out;
  try { out = d.mk()(base); } catch (err) { return; }
  if (!out || !out.gate || out.gate.length !== n) return;
  cell.deg = out.deg.map((x) => Math.max(-7, Math.min(7, x | 0)));
  cell.vel = out.vel; cell.acc = out.acc;
  const next = out.gate.map((g, i) => (g ? "n" : (out.stk && out.stk[i] ? "h" : "r")));
  const holds = (arr, i) => {
    for (let k = 1; k <= n; k++) {
      const q = arr[((i - k) % n + n) % n];
      if (q === "h") continue;
      return q === "n";
    }
    return false;                                     // nothing but holds
  };
  for (let pass = 0; pass < n; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++)
      if (next[i] === "h" && !holds(next, i)) { next[i] = "r"; moved = true; }
    if (!moved) break;
  }
  cell.play = next;
}
function design(cell, d) {
  const n = cell.deg.length, op = K[d.op[0]](...d.op.slice(1));
  const base = { deg: cell.deg.slice(), oct: zeros(n), vel: (cell.vel || zeros(n)).slice(),
                 gate: new Array(n).fill(1), acc: (cell.acc || zeros(n)).slice(),
                 sld: zeros(n) };
  const out = op(base);
  cell.deg = out.deg.map((x) => Math.max(-7, Math.min(7, x | 0)));
  cell.vel = out.vel; cell.acc = out.acc;
  if (!d.moves) return;
  // where each step CAME FROM, read off the operator itself
  const order = op({ deg: cell.deg.map((_, i) => i), oct: zeros(n), vel: zeros(n),
                     gate: new Array(n).fill(1), acc: zeros(n), sld: zeros(n) }).deg;
  const play = cell.play.slice();
  cell.play = order.map((i) => play[((i % n) + n) % n]);
}

/* ---------- THE MAKER, ONE PER CELL, UNDER ITS OWN STAFF ----------------
   One grid per CELL, inside that cell's own block in the Material axis
   (motifs(), above) and directly under the staff it writes, editing the
   record's own tune. It said "one grid per voice,
   directly under that voice's staff, editing that voice's own cell" — Paul,
   2026-08-23: "how to edit other parts? why don't you put an edit grid under
   the editable measures" — and that is rewritten rather than deleted because it
   was right about a maker sitting under the thing it writes and wrong about
   what the thing is. A cell is the RECORD's; two voices reading one cell got an
   editor each, drawing one tune twice. Paul, 2026-08-24: "i thought motifs were
   universal not per voice?" They are, and always were (document.js materialAt —
   a voice only NAMES a cell); only the drawing was in the wrong place. Two
   voices reading one cell still share one tune, and the block's own first line
   says who they are: "hook — read by cantor, schola". (Paul, 2026-08-24, on
   what came next: "The motifs should stay with their editors!!!" — for a few
   hours the makers were gathered into a block of their own at the top of the
   axis, away from the staves. They are back under the staff they write, and
   the cell is still the record's.)

   IT IS STILL CALLED WITH `barOnly`, and that branch is still live: it is what
   draws one measure at a time. motifs() passes null and gets every measure of
   the cell in one grid, which is the shape a whole tune wants.

   A CELL MAY BE SEVERAL MEASURES. ui/derive.js reads sixteen steps to the bar
   off the GENRE, never off the phrase, so a 32-step cell is deliberately two
   bars long — a shipped semantics this page simply had no way to ask for. One
   block of sixteen columns per measure. */
let gridSeq = 0;
function hookGrid(parent, cellName, hostCells, voice, barOnly, withButtons) {
  // this maker's own header cells, registered once so the playhead can find
  // them however many makers the page is showing
  let mine = hostCells && hostCells.__grid;
  // A RADIO GROUP IS NAMED, AND A NAME IS GLOBAL. Two voices sharing a cell
  // used to get an editor each, and both used the cell's name for their radio
  // groups — so the browser treated them as ONE group and the second grid drawn
  // silently unchecked the first. The bank draws one editor per cell now and
  // that collision can no longer happen, and the prefix STAYS ANYWAY: `data-k`
  // must be unique across a redraw (PROGRAM.md §2.2) and a sequence number is
  // the only thing that survives two makers for one cell arriving for any
  // reason at all. Do not replace `seq` with the cell name.
  const seq = "g" + (++gridSeq) + "-";
  const H = cellOf(cellName);
  if (!H || H.kind === "drum") return;
  if (!H.play) H.play = H.deg.map(() => "n");
  const n = H.deg.length, bars = Math.max(1, Math.round(n / 16));
  const only = barOnly == null ? null : barOnly;   // one measure, or all of them
  if (hostCells && !mine) { mine = { cells: [], len: n }; hostCells.push(mine);
                            hostCells.__grid = mine; }
  else if (mine) mine.len = n;
  // A HOLD HOLDS SOMETHING (Paul: "don't let me enter a held note after a
  // rest"). Walking back past any holds, the step this one continues is
  // either a note — in which case holding is what a longer note IS — or a
  // rest, and holding a silence is not a thing you can play. Cyclic, because
  // the cell loops: a hold in step 1 continues whatever the last step was.
  const holdOK = (i) => {
    for (let k = 1; k <= n; k++) {
      const p = H.play[((i - k) % n + n) % n];
      if (p === "h") continue;
      return p === "n";
    }
    return false;                                        // nothing but holds
  };
  /* ---------- THE GRID'S STATE IS COMPUTED ONCE AND WORN TWICE -----------
     Everything below that depends on WHAT IS IN THE CELL — which radio is
     checked, which hold is refused, whether the degree slider is live and what
     its readout says — is set by `sync()`, and `sync()` is called at build time
     and again after every edit. That is why there is no second copy of the
     rules in an update path: the page had exactly one way to show a cell's
     state before (build it) and it still has exactly one.

     WHY IT EXISTS AT ALL. Tapping `· rest` changes more than the radio you
     touched: the holds behind it are orphaned and become rests, the degree
     slider for that step is refused, and a hold that had something to hold may
     no longer. Until 2026-08-25 the page said all of that by rebuilding
     itself, and the rebuild is Paul's complaint (`edited`, above). */
  const steps = [];      // step -> { play: {code -> radio}, deg, out, vel, velOut }
  /* ---------- HOW LOUD THIS STEP IS, WHICH THE PAGE HAS NEVER ASKED --------
     Paul, 2026-08-25: *"Add velocity to motif sliders."*

     IT WAS ALREADY IN THE RECORD AND ALREADY READ. Every line cell in
     songs.js carries `vel` beside `deg` — the psalm's is `5,5,5,5,6,6,6,6,…` —
     document.js `toPhrase` passes it straight through, and kernel.js reads it
     in twenty-odd places (`leaned`, the ghosting, the fade, the accent). The
     one thing missing was a way to say it, so this is a control over a field,
     not a new field.

     ABSENT IS TODAY, AND HERE IS EXACTLY WHAT TODAY IS. `document.js:255`
     compiles a cell with no `vel` key as `(H.vel || z()).slice()` — z() is
     ZEROS, not fives. So `velOf` below reads an absent array as 0, which is
     what the compiler will use, and `velArr` materialises it as zeros on the
     first touch: the array that appears in the document is the array the
     record was already being played with, and every step except the one under
     the finger renders byte-identically. Showing 5 here would have been the
     page lying about what it is about to play. (Nothing in this branch's own
     data reaches that case — precompose.js:428, compose.js and songs.js all
     write `vel` — so it is a hand-written record's path, and it is still the
     path that had to be got right.)

     THE RANGE IS 0..9 because that is the clamp kernel.js applies at both ends
     (`Math.max(0, Math.min(9, …))`, kernel.js:424 and :2697); 5 is what the
     kernel substitutes for a missing one everywhere else it reads a NOTE
     (`vel(p,i)`, kernel.js:301), which is why a fresh step is not silent. */
  const velOf = (i) => (H.vel ? (H.vel[i] | 0) : 0);
  const velArr = () => (H.vel || (H.vel = H.deg.map(() => 0)));
  function sync() {
    for (let i = 0; i < steps.length; i++) {
      const s2 = steps[i];
      if (!s2) continue;
      for (const [code] of PLAYS) {
        const b = s2.play[code];
        if (!b) continue;
        b.checked = H.play[i] === code;
        if (code === "h") b.disabled = !holdOK(i);
      }
      const live = H.play[i] === "n";
      s2.deg.disabled = !live;
      s2.deg.value = String(H.deg[i]);
      s2.out.textContent = live ? String(H.deg[i]) : "–";
      // A VELOCITY IS THE FORCE OF AN ATTACK, so it is live under exactly the
      // condition the degree is: a rest has no attack and a hold is the note
      // before it still sounding. Same `live`, computed once — the reason
      // sync() exists at all is that there is one copy of these rules.
      s2.vel.disabled = !live;
      s2.vel.value = String(velOf(i));
      s2.velOut.textContent = live ? "v" + velOf(i) : "";
    }
  }
  // ONE COMMIT FOR EVERY CONTROL IN THIS GRID, and it is not `changed()`.
  const commit = () => { sync(); edited(cellName); };
  for (let bar = 0; bar < bars; bar++) {
    if (only != null && bar !== only) continue;
    const t = el("table");
    /* ---------- THE TUNE RUNS DOWN THE PAGE (Paul, 2026-08-25) --------------
       *"Rotate the drum kits and motif editors to be vertical. They'll fit on a
       phone screen that way."*

       HE IS RIGHT AND THE ARITHMETIC SAYS SO. Steps across, this table was
       1 + 16 columns at `--cell` 36px = 617px against a 366px column, so it
       lived in a `.nu-pane` and swiped sideways — which is the container that
       produced "when I scroll right to edit motifs and tap something it snaps
       left". Steps DOWN, the width is the number of QUESTIONS asked about a
       step (which play, what degree, how hard) and that is a fixed five
       columns: measured 292.8px at every viewport from 320 to 1280, inside a
       366px column at 390 and inside a 296px one at 320, and the pane is gone
       rather than fixed.

       THE HEADER ROW IS THE QUESTIONS AND THE FIRST COLUMN IS THE COUNT, which
       inverts what this grid used to be. The count cells are still
       `countCell()` and still the playhead's registry — a playhead that marks a
       ROW instead of a column, with no change to `mark()` at all, because the
       registry was always a list of cells and never a claim about direction.

       THE GLYPH IS THE COLUMN HEAD AND THE WORD RIDES BESIDE IT. `♪ note` in a
       header cell is 40px of column for a control that only needs 36, and three
       of them cost more than the readouts do; the glyph alone is the whole of
       what the eye needs once, and `.nu-vh` says the word to a screen reader
       (which also hears it in every radio's own aria-label). */
    const head = el("tr");
    head.append(el("th", bars > 1 ? "m" + (bar + 1) : ""));
    for (const [, label] of PLAYS) {
      const th = el("th");
      th.title = label.slice(2);
      th.append(el("span", label.slice(0, 1)), el("span", " " + label.slice(2), "nu-vh"));
      head.append(th);
    }
    /* ---------- VELOCITY IS A COLUMN, WHICH IS WHAT ROTATING BOUGHT ---------
       Paul, 2026-08-25: *"Add velocity to motif sliders."* It shipped that
       evening as a second VERTICAL slider squeezed into the degree's own cell,
       for a reason that was true of the old shape and is not true of this one:
       "every row of this grid is floored at 36px by nu.css `.nu-grid td`, so a
       fourth row would have cost 36px per measure". Rotated, the second
       question is a second COLUMN — one row per step, degree in one column,
       velocity in the next — which costs the block no height at all and is the
       shape the recipe named. The two 16px-wide sliders sharing a 34px content
       box are gone with it. */
    for (const w of ["deg", "vel"]) {
      const th = el("th");
      th.append(el("span", w));
      head.append(th);
    }
    t.append(head);
    for (let j = 0; j < 16; j++) {
      const i = bar * 16 + j;
      const tr = el("tr");
      // WHERE THE BEAT FALLS, AS A RULE AND NOT AS A TINT. Sixteen rows read as
      // one block without it; `1 e & a` says where you are but only if you are
      // already reading the labels. A heavier line every four rows is the same
      // thing a tracker draws and the same thing Paul asked the tables for
      // ("use more grid lines in tables, it will help", 2026-08-24). A zebra was
      // the other candidate and it is refused for the reason nu.css already
      // gives: a tint in a step grid fights the playhead.
      if (j % 4 === 0) tr.className = "nu-beat";
      const th = countCell(COUNT[j]);
      if (mine) mine.cells[i] = th;
      tr.append(th);
      const ref = steps[i] = { play: {}, deg: null, out: null };
      PLAYS.forEach(([code, label]) => {
        const td = el("td");
        const b2 = document.createElement("input");
        b2.type = "radio"; b2.name = seq + cellName + "play" + i; b2.value = code;
        b2.dataset.k = seq + cellName + "play" + i + code;
        b2.setAttribute("aria-label", cellName + " step " + (i + 1) + " " + label.slice(2));
        ref.play[code] = b2;                    // `checked` / `disabled`: sync()
        b2.addEventListener("change", () => {
          H.play[i] = code;
          // ...and a rest orphans the holds behind it, so they go with it —
          // leaving them would be a document that says "keep sounding the
          // silence", which the compiler would have to guess about
          if (code === "r")
            for (let k = i + 1; k < n && H.play[k] === "h"; k++) H.play[k] = "r";
          commit();
        });
        td.append(b2); tr.append(td);
      });
      // A HOLD HAS NO PITCH OF ITS OWN AND A REST HAS NONE AT ALL (Paul:
      // "don't let me set degree on held or rest notes"). The slider is
      // disabled unless the step is a note — say "note" first and it comes
      // live. It used to convert the step for you, which made every mis-drag
      // a new note. (`disabled` and the "–" readout are sync()'s now, so that
      // saying "rest" here refuses the slider beside it WITHOUT rebuilding the
      // grid the finger is standing on.)
      //   AND IT IS HORIZONTAL NOW, which is the whole of the answer to "make
      // motif sliders much less tall" (Paul, 2026-08-25). ROTATING ANSWERED IT
      // — the control that was 56px of height per row is 30px of height in a
      // 36px row, and the fifteen degrees are told apart along the row's own
      // width instead of stacked up it. It is deliberately NOT also shortened:
      // the request was about a picture that was too tall, and the picture is
      // not that shape any more.
      const x = range(seq + cellName + "deg" + i, H.deg[i],
        (v) => { H.deg[i] = v; }, -7, 7, 1,
        cellName + " step " + (i + 1) + " degree", "nu-hr-deg", null, null, commit);
      ref.deg = x.r; ref.out = x.out;
      // the `v` is part of the READOUT and therefore part of `fmt`, so that
      // the number your finger is dragging and the number sync() writes are
      // said in the same words — two spellings of one value is how a readout
      // starts disagreeing with itself mid-drag
      const y = range(seq + cellName + "vel" + i, velOf(i),
        (v) => { velArr()[i] = v; }, 0, 9, 1,
        cellName + " step " + (i + 1) + " velocity", "nu-hr-vel",
        (v) => "v" + v, null, commit);
      y.out.className = "nu-vel-out";
      ref.vel = y.r; ref.velOut = y.out;
      const td = el("td"); td.append(x.r, x.out); tr.append(td);
      const td2 = el("td"); td2.append(y.r, y.out); tr.append(td2);
      t.append(tr);
    }
    stepGrid(parent, t);          // sixteen ROWS: no pane, and nothing to swipe
  }
  // FIRST WEARING. Everything a cell's contents decide is said here and only
  // here — the loop above builds the controls and never states them.
  sync();
  if (withButtons === false) return;
  // the designing buttons, and the measure count
  // THE PICTURE AND THE WORD, BOTH, IN THAT ORDER. `designArt` is aria-hidden
  // decoration; the `.nu-vh` span is the button's accessible name, its
  // stylesheet-off label and the word a screen reader reads. `data-k` is
  // unchanged — focus is restored across a redraw by that key (PROGRAM.md
  // §2.2) and the row's keys must not move because its faces did.
  const p2 = el("p", null, "nu-tf-row");
  for (const d of DESIGNS) {
    const b2 = document.createElement("button");
    b2.type = "button"; b2.dataset.k = seq + cellName + "-" + d.w;
    b2.title = d.w;                    // hover only; NOT the accessible name
    b2.append(designArt(d), el("span", d.w, "nu-vh"));
    b2.addEventListener("click", () => { design(H, d); push(); draw(); });
    p2.append(b2, document.createTextNode(" "));
  }
  parent.append(p2);
  // ...AND THE SAME ROW FOR TIME (Paul, 2026-08-25: "just as there are icons
  // for pitches create icons for tempo operations and add them and make them
  // work"). A SECOND <p> and not seven more buttons in the first one: the two
  // rows answer two different questions — one moves the notes and one moves the
  // beats — and fourteen pictures in one wrapped paragraph is a wall. Same
  // class, same `.nu-vh` word, same `data-k` discipline; what differs is which
  // half of the cell the click rewrites (`designTime` against `design`).
  const p2b = el("p", null, "nu-tf-row");
  for (const d of TIMES) {
    const b3 = document.createElement("button");
    b3.type = "button"; b3.dataset.k = seq + cellName + "-" + d.w;
    b3.title = d.w;                    // hover only; NOT the accessible name
    b3.append(timeArt(d), el("span", d.w, "nu-vh"));
    b3.addEventListener("click", () => { designTime(H, d); push(); draw(); });
    p2b.append(b3, document.createTextNode(" "));
  }
  parent.append(p2b);
  const p3 = el("p");
  const grow = document.createElement("button");
  grow.type = "button"; grow.dataset.k = seq + cellName + "-addbar";
  grow.append(el("span", "+ measure"));
  grow.addEventListener("click", () => {
    // a new measure starts as a copy of the last one — a second bar is
    // written against the first, not from nothing
    const from = (bars - 1) * 16;
    for (const k of ["deg", "vel", "acc"])
      if (H[k]) H[k] = H[k].concat(H[k].slice(from, from + 16));
    H.play = H.play.concat(H.play.slice(from, from + 16));
    push(); draw();
  });
  p3.append(grow, document.createTextNode(" "));
  if (bars > 1) {
    const cut = document.createElement("button");
    cut.type = "button"; cut.dataset.k = seq + cellName + "-cutbar";
    cut.append(el("span", "− measure"));
    cut.addEventListener("click", () => {
      for (const k of ["deg", "vel", "acc"]) if (H[k]) H[k].length = (bars - 1) * 16;
      H.play.length = (bars - 1) * 16;
      push(); draw();
    });
    p3.append(cut, document.createTextNode(" "));
  }
  p3.append(el("span", bars + (bars > 1 ? " measures" : " measure")));
  // WHO ELSE THIS WRITES. A fugue shares its subject on purpose — three
  // voices reading one cell is the whole idea — so a design button changing
  // "every motif" is the sharing working, not a bug. But it has to be
  // sayable, and there has to be a way out: this forks the cell so the voice
  // owns its own copy and the buttons stop reaching anybody else.
  if (voice) {
    const shared = DOC.voices.filter((v) => usesCell(v, cellName) &&
                                            v.name !== voice.name).map((v) => v.name);
    if (shared.length) {
      const p4 = el("p");
      const fork = document.createElement("button");
      fork.type = "button"; fork.dataset.k = seq + "fork";
      fork.append(el("span", "give " + voice.name + " its own copy"));
      fork.addEventListener("click", () => {
        let n2 = 2, name2 = cellName + n2;
        while (DOC.material.cells[name2]) name2 = cellName + (++n2);
        DOC.material.cells[name2] = JSON.parse(JSON.stringify(H));
        // ...and a voice may read a different cell in each section, so the fork
        // replaces only the entries that pointed HERE. Rewriting the whole
        // field would flatten a record that reads `psalm` in the verses and
        // `neume` in the tag down to one cell for its whole length.
        const m = voice.material;
        if (m && typeof m === "object")
          for (const k of Object.keys(m)) { if (m[k] === cellName) m[k] = name2; }
        else voice.material = name2;
        push(); draw();
      });
      p4.append(fork);
      parent.append(p4);
    }
  }
  parent.append(p3);
}

/* ---------- THE KIT AS A GRID ------------------------------------------
   A grid IS a <table>, with the stylesheet or without it. (This said "a grid
   with NO stylesheet is a table", which was the whole argument on 2026-08-23;
   nu.css landed the next day and the table stayed, because what nu.css adds
   here is 36px cells and a sticky first column, not a different structure.)

   IT SAID "ONE ROW PER LANE, ONE COLUMN PER STEP, A CHECKBOX IN EVERY CELL",
   AND IT IS THE OTHER WAY ROUND NOW (Paul, 2026-08-25: *"Rotate the drum kits
   and motif editors to be vertical. They'll fit on a phone screen that way."*).
   The old shape was 1 + 16 columns at `--cell` 36px = 617px against a 366px
   column, so it lived in a `.nu-pane` and swiped sideways. Rotated, the width
   is the LANE COUNT: measured over all 130 genres the widest kit in the catalog
   is jazz's seven columns — k ?k s ?s r ~r f — which is 20 + 7 x 36 = 272px.
   Measured across 111 records reached from the globe at 320x844, the widest
   that actually turned up was Chicago 1955's k s l h at 165.2px. Every kit in
   the catalog is
   sixteen steps long (measured: 341 lanes, all 16), so sixteen rows is the
   whole table and there is no pane at all.

   THE FIRST COLUMN IS THE PLAYHEAD — the sounding step's count is wrapped in
   <mark>, which is the one highlight plain HTML gives you for free (the
   browser's own default, no rule anywhere). It marks a ROW now rather than a
   column header, and `mark()` did not have to change a character: the registry
   was always a list of cells and never a claim about direction. */
// WHAT A STEP WAS WORTH BEFORE YOU UNTICKED IT, per cell, per lane, per step.
// A kit step is a LEVEL (kernel.js:2320 reads 2..9 as "an operator said ghost
// or accent" and 1 as the old binary on), and a checkbox that writes `1` turns
// punk's crash — `9,…,8` — into a flat tap the moment a hand goes near it. So
// the level is remembered as the grid is drawn and put back when the box is
// re-ticked: tick-untick-tick is now the identity on any lane in the catalog.
// A page-level Map and not a document field, because it is undo, not music.
const kitWas = new Map();
// `cellName` IS AN ARGUMENT NOW, and that is the whole of what this function
// had to give up to become a motif block (Paul, 2026-08-25: "make it part of
// motifs"). It used to ask the DRUMMER which cell to draw —
//
//     const drums = DRUMV(); if (!drums) return;
//     const cellName = cellAt(drums, editSec());
//
// — which is a grid reached THROUGH a player, and it is the same mistake the
// written staff made until 2026-08-24 ("i thought motifs were universal not per
// voice?"). A drum cell is the record's; the strip says which one is open and
// this draws it. TWO CONSEQUENCES, both wanted: a record with no drummer can
// still be given a beat to hire one onto, and a record with TWO drum cells can
// edit the one nobody is playing yet.
//
// (WHAT THE OLD GUARD WAS FOR, kept because the bug it fixed is easy to make
//  again: the `if (!drums) return` used to stand sixteen lines further down,
//  after a whole header row had been built and registered into `stepCell` —
//  cells that were then never appended to anything, so the playhead spent every
//  beat marking sixteen <th>s that were not on the page. `stepCell` is still
//  cleared FIRST, before anything can register into it.)
//
// (AND THE SECTION IT NO LONGER READS: this took its cell from `cellAt(drums,
//  editSec())`, and before 2026-08-24 from `atSec` — the SOUNDING section — so
//  the grid swapped its cell out from under a thumb every time a boundary went
//  past. It reads neither now.)
function drumGrid(parent, cellName) {
  stepCell = [];
  const H = cellName ? DOC.material.cells[cellName] : null;
  if (!H || H.kind !== "drum") return;
  const lanes = H.lanes || {};
  const laneKeys = Object.keys(lanes);
  const t = el("table");
  // (cellpadding/cellspacing came off 2026-08-24. They were here because they
  //  were "the last sanctioned way to make a table compact without writing a
  //  rule", and nu.css writes the rule now: border-collapse plus a 2px pad.)
  // A SIDECAR IS NOT A HIT. `?k` is how often the kick sounds, `~r` is how far
  // behind the grid the ride sits, `!p` is a grace note before the perc —
  // kernel.js:2304 skips them in the lane loop and reads each one WITH its lane.
  // Drawn as their numbers and never as checkboxes, because there is no sense in
  // which "the ride is four ninths late" is ticked: a checkbox here wrote 1 over
  // the 4 and the swing came off the record. Read-only until somebody designs a
  // control for a ninth of a step; round-tripped exactly. (It used to be a whole
  // ROW that was skipped; it is a whole COLUMN now, and the test is the same
  // one character.)
  const head = el("tr");
  head.append(el("th", ""));
  for (const lane of laneKeys) {
    const lh = el("th");                  // the letter; its title says which
    lh.title = laneName(lane);
    if (SIDECAR[lane[0]]) lh.className = "nu-hint";
    lh.append(el("span", lane));
    head.append(lh);
  }
  t.append(head);
  for (let i = 0; i < 16; i++) {
    const tr = el("tr");
    // WHERE THE BEAT FALLS, AS A RULE AND NOT AS A TINT — the same four-row
    // rule the motif grid draws, for the same reason and out of the same class.
    if (i % 4 === 0) tr.className = "nu-beat";
    const th = countCell(COUNT[i]);
    stepCell.push(th);
    tr.append(th);
    for (const lane of laneKeys) {
      const arr = lanes[lane] || [];
      // A LANE SHORTER THAN THE COUNT GETS AN EMPTY CELL RATHER THAN A BOX.
      // Every kit in the shipped catalog is sixteen long, so this is a
      // hand-written record's path — and the old shape drew one cell per array
      // element under a fixed sixteen-column header, which for a short lane was
      // a ragged row and for a long one was columns nothing named. Absent is
      // absent: an empty cell says the lane has nothing to say at this step.
      if (i >= arr.length) { tr.append(el("td", "")); continue; }
      const on2 = arr[i];
      if (SIDECAR[lane[0]]) {
        const td = el("td", on2 ? String(on2) : "");
        td.className = "nu-hint";
        tr.append(td);
        continue;
      }
      const td = el("td");
      const c = document.createElement("input");
      c.type = "checkbox"; c.checked = !!on2;
      c.dataset.k = "kit" + lane + i;
      const mk = cellName + "|" + lane + "|" + i;
      if (on2) kitWas.set(mk, on2);
      // THE LEVEL IS IN THE LABEL, because a checkbox cannot show a 9 and a
      // 36px cell has no room for a digit beside one. A screen reader and a
      // hovering mouse both get the number the record actually carries.
      const say = laneName(lane) + " step " + (i + 1) + (on2 > 1 ? " · level " + on2 : "");
      c.setAttribute("aria-label", say);
      c.title = say;
      c.addEventListener("change", () => {
        // …and back it comes at the level it left at (kitWas, above).
        const v2 = arr[i] = c.checked ? (kitWas.get(mk) || 1) : 0;
        // THE SAME COMPLAINT, THE SAME ANSWER (see `edited`). The kit grid was
        // sixteen 36px columns in a pane too — 617px against a 351px phone —
        // so a tick used to snap it back to step 1 exactly as the motif grid
        // did. The pane is gone now that the steps run down, and this stays
        // anyway: a lane step is a LEVEL in a drum cell and nothing on the page
        // reads it but this checkbox: no staff is engraved from the kit
        // (motifs() skips drum cells outright) and no sheet is gated on one.
        // So the only thing to say afterwards is what this box is now worth,
        // which is what the label and the tooltip carry.
        const say2 = laneName(lane) + " step " + (i + 1) + (v2 > 1 ? " · level " + v2 : "");
        c.setAttribute("aria-label", say2); c.title = say2;
        edited(cellName); });
      td.append(c); tr.append(td);
    }
    t.append(tr);
  }
  stepGrid(parent, t);              // sixteen ROWS: no pane, and nothing to swipe
}

/* ---------- THE BAND: FORM x VOICES ------------------------------------
   (Paul, 2026-08-23: "Combine form and development and cast… make each voice
   a tab inside the development grid and our icons along the top. Let me
   define sound per voice.")

   Four axes meet here because three of them are indexed by the same two
   things. Development is a function of (section, voice). Form is the section
   half of that pair; Cast and Sound are the voice half. Laid out as separate
   lists they were the same table written three times, in three places, with
   nothing lining up. One grid: the form down the left, a tab per voice, and
   the voice's own facts at the top of its tab.

   A TAB, not a column, because a voice now carries four things per section
   and not one — four voices side by side would be twenty columns. And it is
   a page state, never a document one: which tab you are looking at is not a
   fact about the record. */
// BY KIND, AND THERE IS ONE TABLE. The glyphs used to be keyed by NAME, from
// when the voices were called line/pad/bass/drums — so a LINE named "bass" drew
// the bass mark. A name is the composer's; a kind is the machine's. That fix
// left a second table behind it (`GLYPH`, six keys, five of them a stale copy
// of these three and only `form` ever read), which is the drift this file
// spends its comments warning about, so it is one table and a constant now.
const FORMGLYPH = "▦";                   // the form tab is not a voice
// ...AND NEITHER IS PERFORMANCE (Paul, 2026-08-25: "Why don't you move
// performance in as a tab too"). There are two SONG-LEVEL tabs in front of the
// voices now, so both need a mark that is not a player's: ◈ beside ▦, from the
// same geometric family, because what those two have in common is that nobody
// plays them.
const PERFGLYPH = "◈";
const KINDGLYPH = { line: "♪", bass: "▼", drums: "◉" };
// THE SONG-LEVEL TABS, NAMED ONCE. `tab === "form"` was compared against a
// string literal in four places, and a voice may legally be CALLED "form" —
// `freeName` keeps voice names unique among THEMSELVES and knows nothing about
// the strip — so a record with a voice of that name drew the form tab and that
// voice's tab as one. One list, and `VOICE()` is never asked about a name on
// it (see `bandBlock`). Adding `performance` beside `form` is what made the
// latent hazard worth a line.
const SONGTABS = ["form", "performance"];
const glyphOf = (name) => name === "form" ? FORMGLYPH
  : name === "performance" ? PERFGLYPH
  : KINDGLYPH[(VOICE(name) || {}).kind] || "•";
// (WHAT EACH VOICE CAN BE TOLD used to be `menuFor(kind)` here — a ternary over
//  songs.js WORDS, fields.js BASSOPS and fields.js KITLABEL. It is
//  avail.js `devSheetFor(kind)` now, which answers with a sheet KEY instead of
//  an option list, so gates.js can say something different about each of the
//  three vocabularies — and it does: untick the drummer and every one of the
//  sixty-eight kit words greys with "no drummer" written on it.)
let tab = "line";
// THE FORM IS A TAB OF ITS OWN (Paul, 2026-08-23: "make section and bars non
// interactive when I switch voices"). It was editable inside every voice's
// tab, which put one song-level fact behind four doors and made a per-voice
// sheet look like a place to restructure the record. Now the form is edited
// in one place and READ AS TEXT everywhere else — still down the left of
// every voice, because that is the context a word is chosen against, just
// not a control any more.
const voiceTabs = () => [...SONGTABS, ...DOC.voices.map((v) => v.name)];
// WHICH SECTION'S QUESTIONS ARE OPEN, or null for the list of them. Paul,
// 2026-08-25: "Then make each section number tappable and when you tap it
// brings up the questions about the section … When you click form the list
// comes back up." So the form tab is ONE element with two states and this is
// the state.
//
// KEYED BY THE SECTION'S ID, never by its index (PROGRAM.md §2.2) — which is
// what keeps the open detail attached to the same section when the form is
// reordered underneath it. And it is a PAGE state, never a document one: the
// same sentence `tab` carries above it, and it never calls push().
let formSec = null;

// A DOCUMENT MAY HAVE ANY NUMBER OF VOICES, and everything downstream already
// generalized: `push` banks a phrase per chair per section, the boxes name
// `chairs.map(...)` slots, and `genreFor` sets `voices` from the list's own
// length. The only thing missing was a way to say so.
const DRUMGRID = { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
                   s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
                   h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] };
// A VOICE OF ANY KIND. `+ voice` could only make lines, so a record that
// dropped its drummer could never hire another — which is not a composition
// surface, it is a one-way door. One bass and one kit is the limit because
// the genre has one bass line and one grid; the buttons say so by not being
// there.
// a NAME IS AN IDENTITY, so it has to be unique whatever the kind — hiring a
// bass onto a record whose melody voice is called "bass" made two voices
// answer to one name and VOICE() found whichever came first
const freeName = (base) => { let n = base, i = 1;
  while (VOICE(n)) n = base + (++i); return n; };
function addVoice(kind) {
  if (kind === "bass") {
    const name = freeName("bass");
    DOC.voices.push({ name, kind: "bass",
      cast: { style: "eighths" }, development: {} });
    tab = name; return;
  }
  if (kind === "drums") {
    let cell = cellNames().find((n2) => DOC.material.cells[n2].kind === "drum");
    if (!cell) { cell = "beat";
      DOC.material.cells[cell] = { kind: "drum",
        lanes: JSON.parse(JSON.stringify(DRUMGRID)) }; }
    const name = freeName("kit");
    DOC.voices.push({ name, kind: "drums", cast: { on: true },
      material: cell, instrument: "tr909", development: {} });
    // ...AND THE BEAT IT WILL READ IS THE MOTIF THAT COMES UP. Since 2026-08-25
    // the kit grid is a motif block behind a tab ("make it part of motifs"), so
    // hiring a drummer onto a record with no drum cell used to leave the cell
    // it just invented three taps away, in a strip you would have to guess was
    // the right place to look. Two page states move together because one
    // gesture caused both: you asked for a drummer, and here is what it plays.
    // Same sentence `+ drum pattern` makes, and the same one `tab = name`
    // has always made about the band strip one line down.
    motifTab = cell;
    tab = name; return;
  }
  const name = freeName("voice" + (DOC.voices.length + 1));
  // a new line is a COUNTERSUBJECT by default: its own part, entering a bar
  // after the last one, answering at the fifth — the shape a canon wants
  const lines = LINES(), last = lines[lines.length - 1];
  DOC.voices.push({ name, kind: "line",
    cast: { part: "counter", reg: 0,
            entry: Math.min(8, ((last && last.cast.entry) | 0) + 1) },
    material: cellSel, instrument: (last && last.instrument) || "synth",
    development: {} });
  tab = name;
}
function dropVoice(name) {
  // ONE PLACE. This used to delete from three maps and could not rename at
  // all; a voice is one object now, so removing it is removing it.
  DOC.voices = DOC.voices.filter((v) => v.name !== name);
  tab = (DOC.voices[0] || {}).name || "form";
}
// EVERY VOICE HAS A WORD FOR EVERY SECTION, and the words are keyed by the
// section's ID — so adding, removing or reordering sections cannot shift a
// voice's part under it. Filled once, before anything draws.
//
// The document half of this is NuDocument.normalize; what stays here is the
// one line of it that was never about the record — `cellSel` is the page's own
// fallback cell (see its declaration above), a fact about a session and not
// about a song, and putting it in the data tier would have made the extracted
// module carry page state. It still has to be checked here, because a record
// swap can bring a document whose cells this page's fallback is not one of.
function normalize() {
  NuDocument.normalize(DOC);
  if (!DOC.material.cells[cellSel]) cellSel = cellNames()[0];
}

/* ---------- THE NUMBER, WHICH IS NOW A BUTTON WITH A PLAYHEAD IN IT -----
   Paul, 2026-08-25: *"make each section number tappable"*.

   THE OBJECTION THIS ANSWERS, KEPT IN FULL BECAUSE IT WAS A GOOD ONE. The
   deleted `#secs` note said the form table's number column was out of bounds:
   "those <th>s are the playhead's own live cells, so a button in one would be
   a control inside [data-live], which is the one thing that must never happen
   (see mark())." Every word of that is still true. `mark()` empties the cell it
   is handed four times a beat and appends fresh text, so a listener attached
   inside one lives about 250ms.

   WHAT CHANGED IS THE NESTING, NOT THE LAW. The live element is now INSIDE the
   button rather than the button inside the live element:

       <th><button data-k="secc2"><span data-live="count"><span>2</span></span>
             <span class="nu-vh"> — you are writing this</span></button></th>

   The clock still writes only inside [data-live] and still writes only text.
   The button, its listener and its `aria-pressed` sit OUTSIDE that span and
   survive every beat. `window.__eightFrozen` empties [data-live] with
   `replaceChildren()`, which keeps the element and every attribute — so the
   button is still in the frozen half of the page and a change to it is still
   caught by test/motif-frozen.js.

   AND "WHICH ONE AM I WRITING" IS SAID WITHOUT <mark>. Both tab strips use the
   browser's own highlight for "this one", and the playhead uses it here; a
   second <mark> in this cell would draw the SOUNDING section and the WRITTEN
   one identically, which is precisely the conflation 2026-08-24 spent a day
   undoing. So it is a rule down the row instead (nu.css `.nu-here`) — a rule
   and not a tint, for the reason nu.css already gives about zebra stripes and
   the playhead — plus `aria-pressed` for the accessibility tree, plus a
   clipped sentence that comes back when the stylesheet is off. */
function secNumber(sid, label, here, on) {
  const th = el("th");
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.k = "sec" + sid;
  b.setAttribute("aria-pressed", String(!!here));
  const live = el("span");
  live.dataset.live = "count";        // the playhead's, and nothing else's
  live.append(el("span", label));
  b.append(live);
  if (here) b.append(el("span", " — you are writing this", "nu-vh"));
  b.addEventListener("click", on);
  th.append(b);
  return { th, live };
}

/* ---------- THE FORM, DOWN THE LEFT OF EVERY TAB -----------------------
   In a VOICE's tab this is read as TEXT — the shape of the record standing
   beside the word this voice does in each section, which is the context a word
   is chosen against (Paul, 2026-08-23: "make section and bars non interactive
   when I switch voices"). Not a disabled control: a disabled select says "you
   may not", and this is not a refusal, it is the form standing still while
   something else is said about it. `ROLES[...]` on both sides, because the
   caption is the one owner of what a role is CALLED and a page that says
   "groove" here and "drums & bass" two tabs over is two pages.

   In the FORM's own tab exactly two things in the row are controls: the number
   is a button into that section's questions, and the name is a menu. Nothing
   else — the length is read as text here and edited in the detail, because a
   slider per row is a thirteen-row list growing a column of sliders, which is
   the shape this round exists to compress. */
/* ---------- ...AND FOR A BASS OR A KIT THE THIRD COLUMN IS A CONTROL -----
   Paul, 2026-08-25: *"now let's say I pick drums or bass / then show me the
   section/bars table but the third column is all the dropdowns / then show me
   the options for machine, voice, engineer, levels, etc."*

   `picks` IS THAT THIRD COLUMN. In a line's tab the row is read as text and the
   per-section choices are two blocks BELOW the table — a menu row for what it
   reads and a sheet row for what it does, one control per section in each. That
   is fifteen controls under a thirteen-row table for a reggae record, in two
   lists whose order you have to trust, and the table above them is the very
   list they are keyed by. Said Paul's way it is one table: the section, its
   length, and the choice, on one line.

   ONE OWNER, WHICH IS WHY THE SHEETS BELOW ARE NOT ALSO DRAWN for a voice whose
   table carries its picks. Two controls for one fact is the thing this codebase
   has a standing law against, and it would be worse here than usual: they would
   be a <select> and a lit sheet saying different-looking things about the same
   word.

   A SELECT AND NOT A SHEET, and that is Paul's word — "the third column is all
   the dropdowns" — but it is also the only thing that fits: the kit vocabulary
   is sixty-eight words, and a lit sheet of sixty-eight per row on a
   thirteen-row form is the page this round exists to compress. Nothing is lost
   to the greys: `selectEl` disables a refused option and joins the reason to
   its own text ("drum fill, no drummer"), which is the same NO SILENT GREY law
   the sheet keeps, said in the element that has room for it.

   AND A FOURTH COLUMN FOR THE KIT ALONE (Paul, same message: "then let me
   choose motifs for things like drums and bass too"). A drummer really can name
   a cell per section — `document.js:133` resolves `materialAt(drums, secId)`
   and reads `.lanes` off whatever it names, and has since the compiler was
   extracted — so it gets the same `material.cell` menu a line gets, offered
   among the DRUM cells (avail.js `cellsFor`). The bass gets a sentence instead
   of a menu; see `bassReadsWhy` for the measurement that forced that. */
function formTable(parent, voice, editable, picks) {
  const g = el("table");
  const gh = el("tr");
  const kind = voice ? voice.kind : null;
  /* THE `reads` COLUMN ONLY EXISTS WHEN THERE IS SOMETHING TO CHOOSE BETWEEN,
     and that is Paul's own law about menus applied to a COLUMN: "in general
     where there is ONE option a dropdown is preferred" (2026-08-24) — and where
     there is one option per row, five rows deep, what is preferred is no column
     at all. A record with one drum cell would otherwise get thirteen menus that
     can only say the thing they already say, and it would cost the width that
     makes the "does" column reachable on a phone: measured at 390x844, the
     kit's table is 644px wide with the column and 407 without it, inside a
     366px pane. The default is still settable — `cast.material` is in the
     settings below — and the column appears the moment a second beat exists,
     which is the moment it can answer anything. */
  const reads = picks && kind === "drums" &&
                NuAvail.cellsFor(DOC, kind).length > 1;
  // the fourth column is the voice's word; the form's own tab has no word in it
  const head = editable ? ["", "section", "bars"]
    : picks ? ["", "section", "bars", "does", ...(reads ? ["reads"] : [])]
    : ["", "section", "bars", ""];
  for (const x of head) gh.append(el("th", x));
  g.append(gh);
  const cur = editSec();
  DOC.form.sections.forEach((s2, i) => {
    const tr = el("tr");
    if (editable) {
      // ONE TAP DOES TWO THINGS AND THEY ARE THE SAME THING: it opens this
      // section's questions, AND it makes this the section you are WRITING.
      // Paul, asked on 2026-08-25 to choose between letting the form list drive
      // `editSec()` and keeping the strip over the staves: "The first is good."
      // `draw()` and not `drawMaterial()`, because this gesture changes two
      // axes at once — the register the Material axis engraves its staff in and
      // the whole of this tab — and a page that rebuilt half of what it changed
      // would be showing you a list you had just left. (It read "the composed
      // staves in Material"; those are gone, and `editSec()` still reaches that
      // axis through `motifs()`'s `lead`.)
      const n = secNumber(s2.id, String(i + 1), i === cur, () => {
        setViewSec(i); formSec = s2.id; draw(); });
      formCell[i] = n.live;
      tr.append(n.th);
      if (i === cur) tr.className = "nu-here";
      // THE NAME, IN THE ROW ("You can make the section names into dropdowns
      // inside the section list"). A section's name on this page IS its role —
      // `ROLES["groove"]` is "drums & bass" — and this is the very `form.role`
      // spec that stood in a row of its own under the table until today: same
      // key, same availability table, same greys, one fewer list to keep in
      // step with the rows above it.
      const tn = el("td");
      tn.append(selectEl(shSpec("form.role", { section: s2.id },
        "section " + (i + 1) + " name")));
      tr.append(tn);
      tr.append(el("td", s2.bars + " bars"));
    } else if (picks) {
      const th = countCell(String(i + 1));
      formCell[i] = th;
      tr.append(th, el("td", ROLES[s2.role] || s2.role),
                el("td", s2.bars + " bars"));
      const td = el("td");
      td.append(selectEl(shSpec(NuAvail.devSheetFor(kind),
        { voice: voice.name, section: s2.id },
        voice.name + " · " + s2.role + " " + (i + 1))));
      tr.append(td);
      if (reads) {
        const td2 = el("td");
        td2.append(selectEl(shSpec("material.cell",
          { voice: voice.name, section: s2.id },
          voice.name + " reads · " + s2.role + " " + (i + 1))));
        tr.append(td2);
      }
    } else {
      const th = countCell(String(i + 1));
      formCell[i] = th;
      tr.append(th, el("td", ROLES[s2.role] || s2.role),
                el("td", s2.bars + " bars"),
                el("td", wordAt(voice, i) || "as written"));
    }
    g.append(tr);
  });
  pane(parent, g);
}

/* WHY THE BASS IS TOLD RATHER THAN ASKED, and it is a measurement rather than a
   preference. Paul, 2026-08-25: *"then let me choose motifs for things like
   drums and bass too."* A drummer can be asked, and is (above). A bass cannot,
   and the reason is in both compilers, in the same words:

     `const lead = phrases[0];` … "Drums and bass follow the FIRST phrase — the
     kit is genre data anyway, and the bass reads accents, which only one line
     can own." (nukernel/document.js scoreOf:355, ui/derive.js:433)

   `K.bass(subj, g, bars)` is handed the FIRST LINE VOICE'S compiled phrase and
   reads its accents off it; `toGenre` gives the bass a `bassStyle` and a
   `nobass` flag and no material at all. So a bass that named a cell would name
   it into nothing: the menu would move, the record would not, and the page
   would be lying about what it can do — which is the exact failure the whole
   availability tier exists to prevent. An honest sentence beats a dead control.

   WHAT IT WOULD TAKE, so this is a job and not a shrug: a `bassMaterial` seam
   in `toGenre` and one line in each of the two compilers to pass the bass its
   own phrase instead of `phrases[0]`. Both files belong to another slice; the
   recipe is written and named in this round's report. */
function bassReadsWhy(parent, voice) {
  const lines = LINES(), lead = lines[0];
  const cell = lead ? cellAt(lead, editSec()) : null;
  parent.append(el("p", cell
    ? "the bass reads " + cell + " — the first line's motif, because it takes " +
      "its accents from the tune (document.js scoreOf, derive.js sectionEvents). " +
      "Give it a motif of its own by changing what " + lead.name + " reads."
    : "the bass has no motif to read: this record has no line voice for it to " +
      "take its accents from.", "nu-why"));
}

/* ---------- ONE SECTION'S OWN QUESTIONS --------------------------------
   Paul, 2026-08-25: *"when you tap it brings up the questions about the
   section"*.

   Everything a section can be asked, for ONE section, in fields.js's own
   registry order — what it is called, how long it is, and the eight edges and
   shapes the D7 round wired end to end (`derive.js:526` has always read
   `sec.env`, `sec.intro`, `sec.outro`, `sec.period`, `sec.pipe` and
   `sec.breath`). GROUPED BY SECTION AND NOT BY QUESTION, which is the argument
   the old layout already made and this one keeps: asked section by section it
   reads as a description of the record ("the second verse: it arches, it ends
   on a tom fill"), and question by question it reads as a spreadsheet. What
   changed is that you are now asked about one section at a time instead of all
   of them at once.

   The greys come with it untouched — "drum fill, no drummer" is words the
   <option> itself says (ui/selects.js `optionText`): measured 2026-08-25, ONE
   section's detail carries all seven drum-writing edges greyed and not one
   silent grey among them.

   WHAT FOLLOWS FROM THIS AND IS NOT OURS TO FIX HERE: `test/nudges.js` counts
   nudge controls on the BOOT page, which lands on the form list — and a list of
   names has no nudges in it, so the gate bails at "0 found" before it runs. The
   controls have not gone anywhere; they are one tap away. That gate needs a tap
   on a section's number before it counts, and again before each of its three
   `tap("tabform")` calls. Said in the round's report with the measurement, not
   edited from here. */
function sectionDetail(parent, s2) {
  const i = DOC.form.sections.indexOf(s2);
  /* THE HEADING ANSWERS TO THE BUTTON'S NAME, and that is how focus follows
     the panel without one line of new machinery. The button you pressed is not
     on the page any more, and `restoreFocus` puts a thumb back by `data-k`
     (`eight.js:474`) — so with nothing carrying `sec<id>` here, a keyboard user
     pressed Enter on section 3 and landed on <body>, with the next Tab starting
     again at the top of the document. Measured 2026-08-25 at 1280x900: a real
     touch on the number left `document.activeElement` as `BODY`.

     WHY NOT A `focus()` CALL AFTER `draw()`. Being findable by key beats
     calling focus() from a click handler, and the reason is order:
     `restoreFocus` runs INSIDE draw(), before `restoreAnchor()`, so whatever
     the rebuild did to the scroll is still corrected afterwards. A focus()
     from the handler lands after that correction and owns nothing.

     THE CAUSE THIS PARAGRAPH USED TO NAME WAS WRONG AND IS REWRITTEN RATHER
     THAN DELETED, because it was quoted forward twice. It read: "`h.focus({
     preventScroll: true })` … MOVED THE PAGE 607px at 390x844 — the same jump
     every control on this page makes from that scroll position, which is
     Chromium's scroll anchoring reacting to draw() emptying #app". Measured
     again on 2026-08-25 with a real tap at the element's own on-screen point:
     `focus({ preventScroll: true })` on an element 1,500px off screen moves the
     window 0px (from 4500, still 4500), and a BARE `focus()` moves it to 3045.
     preventScroll does exactly what it says. The 607 was a harness artefact of
     the same shape as the 1851 in restoreAnchor's note — `page.click()`
     centring its target before it clicks. The real endemic jump was the page
     RESHAPING because abcjs engraves on a promise, and it is fixed at the
     source now (staffBox). Same key, same `preventScroll`, and measured after
     this the window moves 0px.

     `tabIndex = -1` makes the heading focusable WITHOUT putting it in the tab
     order, which is the standard shape for "the thing that just replaced what
     you were looking at": a screen reader reads the section you opened and Tab
     goes on to its first question. The key is unique because the list and the
     detail are never on the page together. */
  const h = heading(parent, (i + 1) + " · " + (ROLES[s2.role] || s2.role) +
    ", " + s2.bars + " bars");
  h.dataset.k = "sec" + s2.id;
  h.tabIndex = -1;
  // THE WAY BACK IS THE TAB YOU CAME FROM, and it is said out loud because it
  // is the one gesture on this page that no visible control performs. A "back"
  // button here would be a second owner of where you are, which is what
  // deleting `#secs` was about.
  parent.append(el("p", "tap " + FORMGLYPH + " form above for the list of " +
    "sections", "nu-hint"));
  // THE NAME AGAIN, AND NOT A SECOND OWNER: the list and the detail are two
  // states of one element and never on the page together, so the same
  // `form.role` spec draws once either way and `data-k` stays unique.
  selectRow(parent, null, [shSpec("form.role", { section: s2.id })]);
  // HOW LONG IT IS. Keyed by the section's ID rather than its index, which is
  // PROGRAM.md §2.2 and is also what puts your thumb back on the right slider
  // when a redraw lands after a reorder. (`number()` and not a hand-built row:
  // it is a number on a line like every other, and it gets the question above
  // the control for free — 2026-08-25, "Put interactive elements on new lines
  // below the titles or questions.")
  number("bars" + s2.id, "bars", s2.bars, (v) => s2.bars = v, parent, 1, 32, 1);
  const nudges = [...NuFields.nudgesFor("form"), ...NuFields.nudgesFor("development")]
    .filter((r) => r.options)
    .map((r) => (r.axis === "form" ? "form." : "development.") + r.key);
  selectRow(parent, null, nudges.map((k) => shSpec(k, { section: s2.id })));
  // ...and the one nudge that is a number on a line, not a word from a list:
  // how many bars into the tune this section starts (derive.js:396), which is
  // how a chorus comes in on the second half of the phrase.
  const nr = NuFields.FIELD.nudge;
  number("nudge" + s2.id, nr.ask, s2.nudge | 0, (v) => { s2.nudge = v | 0; },
    parent, nr.min, nr.max, 1);
}

/* ---------- 8 · PERFORMANCE, AS A TAB ----------------------------------
   Paul, 2026-08-25: *"Why don't you move performance in as a tab too"*.

   WHY IT IS A PEER OF `form` AND NOT OF THE VOICES. AXES.md's scope column
   calls Performance "song" — take, humanize, ontime and the four D7 nudges are
   one value each for the whole record, exactly like the form is one shape for
   the whole record. The strip is `form · performance · <voice> · <voice> …`:
   the song-level tabs first, then one per player.

   THE DEPARTURE, RECORDED RATHER THAN HIDDEN, because a later reader will
   otherwise "restore" something nobody lost. The page's spine is the eight
   axes in evaluation order and AXES.md makes a point of that order being
   readable in ONE PASS. `4–7 · The band` was the first grouping — four axes
   under one tabbed surface, because Development is a function of (section,
   voice) and Form and Cast are its two halves. This is the SECOND grouping, so
   the page now shows FIVE headings for eight axes: 1 · Time, 2 · Alphabet,
   3 · Sheet music, 4–8 · The band, and the producer, who was never an axis at all
   (AXES.md:113). That is a deliberate choice made on 2026-08-25 and it has a
   reason: the grouping follows the real SCOPES rather than the enumeration.
   The numbers stay in the heading precisely so the enumeration is still
   readable through the grouping.

   The three sheets are askable.js's rows read through `nudgesFor("performance")`
   — the same list the coverage gate reads — and the hand is under its own
   heading, because "how many takes in" and "does the line breathe" are two
   questions. */
function performanceTab(parent) {
  const D = DOC;
  sheetRow(parent, "the feel and the sound",
    NuFields.nudgesFor("performance").map((r) => shSpec("performance." + r.key, {})));
  heading(parent, "the hand");
  number("take", "take", D.performance.take, (v) => D.performance.take = v,
    parent, 0, 99);
  number("humanize", "humanize", D.performance.humanize,
    (v) => D.performance.humanize = v, parent, 0, 1, 0.05);
  check("ontime", "dead on the grid", D.performance.ontime,
    (v) => D.performance.ontime = v, parent);
}

function bandBlock(parent) {
  normalize();
  const tabs = voiceTabs();
  if (!tabs.includes(tab)) tab = tabs[0];
  // the icons along the top. A button apiece, and the one you are on is
  // marked — the same <mark> the playhead uses, for the same reason: it is
  // the highlight the browser already has.
  const bar = el("p");
  bar.id = "tabs";
  for (const name of tabs) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.k = "tab" + name;
    b.setAttribute("aria-pressed", String(name === tab));
    const label = glyphOf(name) + " " + name;
    if (name === tab) b.append(el("mark", label)); else b.append(el("span", label));
    // ...AND TAPPING `form` IS THE WAY BACK (Paul, 2026-08-25: "When you
    // click form the list comes back up"). It is not a special case bolted on
    // to one tab: `formSec` is which section's questions are open, and leaving
    // the form — or arriving on it — closes them, which is the same line for
    // every tab in the strip. There is no separate "back" control, because a
    // second control for "where am I" is the second owner this round deleted
    // `#secs` to be rid of.
    b.addEventListener("click", () => { tab = name; formSec = null; draw(); });
    bar.append(b, document.createTextNode(" "));
  }
  const offer = [["line", "+ line"]];
  if (!BASSV()) offer.push(["bass", "+ bass"]);
  if (!DRUMV()) offer.push(["drums", "+ drums"]);
  for (const [kind, label] of offer) {
    const add = document.createElement("button");
    add.type = "button";
    add.dataset.k = kind === "line" ? "addvoice" : "add" + kind;
    add.append(el("span", label));
    add.addEventListener("click", () => { addVoice(kind); push(); draw(); });
    bar.append(add, document.createTextNode(" "));
  }
  parent.append(bar);
  // A NAME ON THE SONG-LEVEL LIST IS NEVER A VOICE, whatever a voice is
  // called. See SONGTABS.
  const onForm = tab === "form", onPerf = tab === "performance";
  const voice = SONGTABS.includes(tab) ? null : VOICE(tab);
  const kind = voice ? voice.kind : null;

  /* the voice's own facts: CAST, then MATERIAL, then SOUND. Down the page
     rather than across it — four controls in one row came to 478px against a
     phone's 390, and these are four different KINDS of fact. What a voice
     shows is decided by its `kind` and nothing else: no branch anywhere asks
     whether this is "the bass". */
  /* ---------- WHAT ORDER A VOICE'S TAB IS IN, AND IT IS NOT ONE ORDER ----
     Paul, 2026-08-25: *"now let's say I pick drums or bass / THEN show me the
     section/bars table but the third column is all the dropdowns / THEN show me
     the options for machine, voice, engineer, levels, etc."* The two "then"s
     are the instruction: for a bass or a kit, the record's shape comes first
     and the player's own settings come after it.

     A LINE'S TAB KEEPS THE ORDER IT HAD — settings, then the form — and that is
     a decision rather than an oversight. A line has THREE per-section lists
     (what it reads, what it does, and the form itself) and the two menus that
     decide them (`cast.material`, `cast.part`) are what those lists are read
     against; putting the table first would put thirteen rows between the
     question and its default. A bass and a kit have ONE per-section list and it
     is now IN the table, so there is nothing for the settings to be read
     against and Paul's order is simply better. Said out loud because a page
     that does two things needs to say which two. */
  const settingsFirst = kind === "line";
  const panel = el("div");
  const t = el("table");
  const row = (label, kid, kid2) => {
    const tr = el("tr");
    tr.append(el("th", label));
    const td = el("td"); td.append(kid);
    if (kid2) td.append(document.createTextNode(" "), kid2);
    tr.append(td); t.append(tr);
  };
  if (kind === "line") {
    const rg = range("reg" + voice.name, voice.cast.reg, (v) => voice.cast.reg = v,
      -2, 2, 1, voice.name + " register");
    row("register", rg.r, rg.out);
    const en = range("entry" + voice.name, voice.cast.entry,
      (v) => voice.cast.entry = Math.max(0, v), 0, 8, 1, voice.name + " enters at bar");
    row("enters at bar", en.r, en.out);
  } else if (kind === "drums") {
    const c = document.createElement("input");
    c.type = "checkbox"; c.checked = !!voice.cast.on; c.dataset.k = "drums";
    c.setAttribute("aria-label", "drums");
    c.addEventListener("change", () => { voice.cast.on = c.checked; changed(); });
    row("drums", c);
  }
  if (!onForm && t.firstChild) pane(panel, t);   // two columns, but a pane costs nothing
  // A CHOICE FROM A LIST IS EITHER A SHEET OR A MENU, AND WHICH ONE IS A
  // SENTENCE OF PAUL'S. The two that are a NUMBER ON A LINE stay sliders in
  // the little table above (2026-08-23: "use range sliders for numeric
  // inputs"). What a voice shows is still decided by its `kind` and nothing
  // else. `t.firstChild` is what keeps an empty <table> off the page for a
  // bass voice, which has no slider of its own at all.
  //
  // PLAYS, MATERIAL, INSTRUMENT ARE MENUS (2026-08-24, evening: "in voices --
  // plays, material, instrument -- dropdowns/selects"). Three facts about who
  // this player IS, said once and then left alone, and one of them offers 108
  // instruments: a sheet of 108 lit words is a page of them. The development
  // words below — the per-section thing this voice DOES — stay sheets, which
  // is the morning's instruction and is about a different kind of question
  // (see the header of ui/selects.js, where both sentences are side by side).
  if (!onForm && kind === "line")
    selectRow(panel, null, [shSpec("cast.part", { voice: voice.name }),
                            shSpec("cast.material", { voice: voice.name }),
                            shSpec("sound.instrument", { voice: voice.name })]);
  // ...and these two are NOT on the evening list and stay sheets. The drum kit
  // in particular: Paul's question about it in the same message was "can i pick
  // more than one options for the drum kit?", and more-than-one is a row of
  // checkboxes (`multi`), which a <select multiple> is not.
  if (!onForm && kind === "bass")
    sheetRow(panel, null, [shSpec("cast.bassStyle", { voice: voice.name })]);
  // THE MACHINE AND THE BEAT IT READS BY DEFAULT (Paul, 2026-08-25: "show me
  // the options for machine, voice, engineer, levels"). `sound.drumkit` IS the
  // machine — its own label is "machine" — and `cast.material` beside it is the
  // drum cell this kit reads in every section that does not say otherwise, which
  // is the same fact a line's `cast.material` carries and was never offered to a
  // drummer until now. A menu and not a sheet, for the reason the evening of
  // 2026-08-24 gave: it is a settled parameter, one value decided once.
  if (!onForm && kind === "drums") {
    sheetRow(panel, null, [shSpec("sound.drumkit", { voice: voice.name })]);
    selectRow(panel, null, [shSpec("cast.material", { voice: voice.name })]);
  }
  // THE ENGINEER, directly after the voice's cast/material/instrument sheets and
  // in the same column of the page — a cantor's send is one more fact about the
  // cantor, next to its register and its throat, not a room next door.
  if (!onForm && voice) engineer(panel, CTX, voice.name);
  if (voice && settingsFirst) parent.append(panel);

  /* ---------- THE FORM IS ONE ELEMENT WITH TWO STATES -------------------
     Paul, 2026-08-25, verbatim and in his order:

       "You can make the section names into dropdowns inside the section list
        Then make each section number tappable and when you tap it brings up
        the questions about the section
        When you click form the list comes back up
        This compresses tons of sections into one element
        Sections are rows
        Voices are tabs"

     THE LIST is one row per section — number, name, length — with the NAME as
     a <select> IN THE ROW, so renaming never leaves the list. THE DETAIL is
     one section's own questions and it REPLACES the list rather than expanding
     inside it. `formSec` is which of the two you are looking at.

     THE CASE THAT FORCED IT, and it is not hypothetical: `precompose` gives a
     reggae record THIRTEEN sections. Asked the old way that is thirteen
     section headings, thirteen bars sliders, thirteen nudge sliders and 104
     nudge menus in one tab. Asked this way it is thirteen rows and thirteen
     controls, and the questions are a tap away for the one section you are
     actually working on.

     "SECTIONS ARE ROWS. VOICES ARE TABS" is the rule underneath it, and it is
     the answer to 2026-08-24's "you mixed up voices and song sections": they
     are different kinds of thing and they no longer share a presentation. */
  // A SECTION THAT WAS OPEN AND HAS SINCE BEEN DELETED LEAVES YOU ON THE LIST,
  // which is the only honest place to be — and this is also what keeps a record
  // swapped in from the atlas (a different form entirely) from opening a
  // stranger's questions.
  const secOpen = onForm && formSec != null
    ? DOC.form.sections.find((s2) => s2.id === formSec) : null;
  if (onForm && formSec != null && !secOpen) formSec = null;
  // THE PLAYHEAD'S SECTION COLUMN IS EMPTIED FIRST AND FILLED BY WHOEVER DRAWS
  // THE FORM. Two of the four tab states do not draw it — a section's detail is
  // about ONE section and the performance tab is about none — and `mark()` on
  // an empty registry writes nothing, which is the honest answer: a view that
  // is not showing the form has no form column to light. (The `let chordCell,
  // formCell` note three hundred lines down is about the opposite mistake, a
  // registry that was empty by accident and marked forever.)
  formCell = [];
  if (secOpen) sectionDetail(parent, secOpen);
  else if (onPerf) performanceTab(parent);
  else formTable(parent, voice, onForm, !!voice && !settingsFirst);
  // ...and what the bass reads, which is a sentence and not a control
  if (!onForm && kind === "bass") bassReadsWhy(parent, voice);
  if (voice && !settingsFirst) parent.append(panel);
  // WHAT THIS VOICE DOES, SECTION BY SECTION. One sheet per section rather than
  // one menu per row: the vocabulary is twenty-one words for a line and
  // sixty-eight for a kit, and a menu was the only control that fitted in a
  // table cell — which is exactly the complaint. The form is still down the
  // left of the table above, read as text, because that is the context a word
  // is chosen against (Paul, 2026-08-23: "make section and bars non
  // interactive when I switch voices").
  //
  // THE KIND PICKS THE SHEET, and that is the whole of what `menuFor` used to
  // do: a pitched chair takes a melodic word, the bass takes a pattern, the kit
  // takes an operator. Three sheet keys instead of one ternary, so `gates.js`
  // can say something different about each — and it does: untick the drummer
  // and every one of the kit words greys with "no drummer" on it.
  // WHICH OF THE RECORD'S TUNES THIS VOICE TAKES, SECTION BY SECTION. The other
  // half of Paul's sentence on 2026-08-24: "'the band' is where I thought
  // voices would be established, interpreting the progression, structure, and
  // motif." Each motif is a block of its own in the Material axis — universal,
  // one editor each, which is what they always were — and the band tab is where
  // a player says which one it reads. A menu and not a sheet: "reads `hook`" is
  // a settled parameter, and the sheet next to it is the word the voice DOES to
  // what it reads, which is the comparison.
  if (voice && kind === "line")
    selectRow(parent, "what " + tab + " reads, section by section",
      DOC.form.sections.map((s2, i) =>
        shSpec("material.cell", { voice: voice.name, section: s2.id },
               (i + 1) + " · " + (ROLES[s2.role] || s2.role))));
  // ...AND ONLY A LINE STILL GETS IT AS A BLOCK OF ITS OWN. A bass's and a
  // kit's per-section word is the "does" column of the table above (formTable's
  // `picks`), and drawing it twice would be two controls for one fact — see the
  // ONE OWNER note there.
  if (voice && settingsFirst)
    sheetRow(parent, "what " + tab + " does, section by section",
      DOC.form.sections.map((s2, i) =>
        shSpec(NuAvail.devSheetFor(kind), { voice: voice.name, section: s2.id },
               tab + " · " + s2.role + " " + (i + 1))));
  if (voice && DOC.voices.length > 1) {
    const rm = document.createElement("button");
    rm.type = "button"; rm.dataset.k = "dropvoice";
    rm.append(el("span", "remove the " + voice.name));
    rm.addEventListener("click", () => { dropVoice(voice.name); push(); draw(); });
    const p2 = el("p"); p2.append(rm); parent.append(p2);
  }
}

/* ---------- ONE PLAYHEAD, EVERY SURFACE --------------------------------
   The engine's own per-beat feed (audio/live.js "pos") says which bar, beat
   and SECTION is sounding; a beat is four sixteenths, so three timers a beat
   carry the step between feeds. EVERY surface is lit from that one step — the
   kit grid, every voice's maker, the chord chart, the form column and the
   staves — because a page that lit two of them off two clocks would show the
   ear two different places at once. The grid marks its column; the staff fills
   the notehead that covers it. (This said "both surfaces" when there were two.)

   NO STYLESHEET EITHER: <mark> for the grid (the browser's own highlight)
   and the SVG `fill` ATTRIBUTE for the notehead — presentation carried on
   the element, which is how SVG has always coloured itself. */
// ONE MARKER, FOUR GRIDS. A cell is "lit" when its label is wrapped in
// <mark> — the browser's own highlight, and still the only one this page
// uses. Each grid hands its header cells and their labels; the index says
// which one is sounding, -1 lights none. (This and the four registries under
// it were declared inside the kit block, three hundred lines from their only
// reader, because the kit grid was the first surface to get a playhead. They
// belong to the playhead: every builder above WRITES its cells into one of
// them and nothing but `lightStep` and the two transport handlers reads them.)
// ...AND A CELL THE CLOCK MAY WRITE HAS TO SAY SO. The law of 2026-08-24 is
// that the clock writes inside `[data-live]` or outside #app, and nowhere
// else; `data-live="count"` is what a playhead cell carries, and `mark` is its
// only writer. A grid that registers a cell without one is REFUSED rather than
// marked — a dead playhead and a line in the console, instead of a surface
// quietly joining the live set and taking test/motif-frozen.js's only real
// assertion down with it. Complained about once per element, because this runs
// four times a beat.
const unmarked = new WeakSet();
const mark = (cells, idx, labels) => cells.forEach((c, i) => {
  if (!c || !c.dataset || c.dataset.live !== "count") {
    if (c && !unmarked.has(c)) {
      unmarked.add(c);
      console.error("eight.js: the playhead was handed a cell with no " +
                    "data-live=count, so it will not be marked", c);
    }
    return;
  }
  const on2 = i === idx;
  if (((c.firstChild || {}).tagName === "MARK") === on2) return;   // already right
  c.textContent = "";
  c.append(el(on2 ? "mark" : "span", labels[i]));
});
// THE PLAYHEAD'S OWN CELL, and the only way to make one. Four grids register
// one of these per step or per bar; the `data-live` is the page's own
// declaration that the clock may write here, and window.__eightFrozen reads
// that declaration rather than letting a gate invent an exclusion for itself.
const countCell = (label) => { const th = el("th");
  th.dataset.live = "count";
  th.append(el("span", label));
  return th; };
let stepCell = [];                       // step -> the <td> in the drum header
// ONE ARRAY PER GRID, not one for the page. Every voice's maker wrote its
// header cells into a single shared array, so with two voices only the LAST
// one kept its cells and every earlier voice's playhead vanished — the marks
// were being written into elements that had been overwritten in the list.
let hookCells = [];                      // [{ cells, len }] — one per maker
// ONE COLUMN, NOT TWO. `devCell` stood here beside these — the section column
// of a SECOND table, from when Development was a list of its own. 4-7 became
// one grid on 2026-08-23 and the array was never filled again, so the two
// `mark(devCell, ...)` calls in the transport handlers below had been
// marking an empty list ever since. Deleted 2026-08-24: the form column IS the
// development column, and lighting it once is the whole of what was wanted.
let chordCell = [], formCell = [];   // the bar of the loop, and the section
function lightStep(abs) {
  atStep = abs;
  const step = abs < 0 ? -1 : Math.floor(abs) % 16;
  mark(stepCell, step, COUNT);            // the kit
  // every maker on the page, each indexed across its own cell's measures
  for (const h of hookCells) {
    const labels = [];
    while (labels.length < h.cells.length) labels.push(...COUNT);
    mark(h.cells, abs < 0 ? -1 : Math.floor(abs) % h.len, labels);
  }
  // THE COMPOSED STAVES, AND NEVER THE WRITTEN ONE (2026-08-24). The written
  // staff is the one you are typing into; a notehead turning red under your
  // finger is the picture changing while you write on it. It is not in this
  // registry at all, so this is true by construction and not by a condition.
  // (The maker grids' count rows keep lighting either way — a count row is the
  //  BEAT, not a claim about these particular notes.)
  // THE SCORE, WHICH IS THE SAME PLAYHEAD ON A THIRD SURFACE. Written here and
  // not in the "pos" handler so that stop's `lightStep(-1)` clears it too, by
  // the same call that clears everything else.
  lightScore(abs);
  // (A LOOP OVER `played` STOOD HERE — the red notehead on every composed
  //  staff in the Material axis. It went on 2026-08-25 with the staves
  //  themselves. `lightScore` above is the whole playhead on notation now, and
  //  that is one surface rather than one per voice per motif: the same red
  //  fill, in the same place, on the picture that shows what is actually being
  //  played. The written staff has never been in this registry and still is
  //  not — "a notehead turning red under your finger is the picture changing
  //  while you write on it".)
}
let stepTimers = [];
const clearStepTimers = () => { for (const t of stepTimers) clearTimeout(t);
  stepTimers = []; };
// THE ENGINE READOUT, ONCE A SECOND. "pos" fires several times a beat and the
// sentence changes at most every few seconds, so it is throttled here rather
// than made cheaper: engineLine() reads six Atomics off the shared control
// block and there is no reason to do that forty times a second. This is the
// only view code in the file that talks to the engine's health, and it draws
// OUTSIDE #app (index.html), which is why draw() cannot take it away.
let engineAt = 0;
const paintEngine = () => {
  const p = $("engine");
  if (!p) return;
  const now = Date.now();
  if (now - engineAt < 1000) return;
  engineAt = now;
  const s = engineLine();
  if (p.textContent !== s) p.textContent = s;
};
on("pos", (d) => {
  clearStepTimers();
  paintEngine();
  // A SECTION BOUNDARY REPAINTS THE COMPOSED STAVES AND NOTHING ELSE (Paul,
  // 2026-08-24: "Don't change motifs visually or change the editing interface.
  // It's too confusing when it changes."). This was `draw()` — the whole page
  // torn down and rebuilt every four to eight bars, with focus put back across
  // it by data-k, which is the tell that somebody had already noticed the page
  // was being rebuilt under a live finger and treated the symptom. Measured on
  // the shipped chant: 436 ms of frozen main thread at 390px and 1516 ms at
  // 1400px, per boundary. Now two writes land, both inside [data-live].
  // A SECTION BOUNDARY IS A FACT THE SCORE READS, and it is recorded here and
  // acted on four lines down by `repaintScore()` — one write, inside the one
  // [data-live] element left in this axis. (This called `repaintPlayed()`
  // beside the assignment until 2026-08-25; before that it called `draw()`,
  // which was the whole page torn down and rebuilt every four to eight bars —
  // 436 ms of frozen main thread at 390px and 1516 ms at 1400px, measured.)
  if (d.si != null && d.si >= 0 && d.si !== atSec) atSec = d.si;
  // WHICH BAR OF THE LOOP the changes are on — bar WITHIN the box, which is
  // what the kernel indexes `prog` by (at(g.prog, bar)), not the running bar
  let inBox = 0;
  try { inBox = Math.max(0, (passAt(getPosition().now).bar || 1) - 1); } catch (e) {}
  mark(chordCell, inBox % Math.max(1, DOC.alphabet.prog.length),
       DOC.alphabet.prog.map((c, i) => String(i + 1)));
  const secLabels = DOC.form.sections.map((x, i) => String(i + 1));
  mark(formCell, d.si == null ? -1 : d.si, secLabels);
  // A BAR OF CLOCK IS NOT SIXTEEN STEPS OF THE PATTERN. `g.rate` is how fast
  // the phrase is read against the bar — the gregorian anchor ships 0.5, so
  // the pattern advances EIGHT steps a bar and a sixteen-step cell lasts two
  // of them. The playhead counted sixteenths, so on that record it ran at
  // double speed, wrapped in the middle of the cell, and lit notes that had
  // not sounded yet. It counts pattern steps now, and at rate 1 the arithmetic
  // is what it always was.
  const rate = (GENRES[GK + Math.max(0, d.si | 0)] || {}).rate || 1;
  const base = (inBox * 16 + (Math.max(1, d.beat || 1) - 1) * 4) * rate;
  // WHICH MEASURE THE SCORE IS SHOWING, off the very number the playhead walks
  // — so the window and the red note can never disagree about which bar this
  // is. `repaintScore` is called every tick and its first act is to compare two
  // integers (the window and the section); on a tick where they have not moved
  // it does nothing but ask the runway whether the NEXT window is engraved yet,
  // which is another integer compare (`engraveWindow`'s `B.key === key`). The
  // window moves once a BAR now rather than once every two (2026-08-25), and
  // the engraving still happens at most once per window and never on the
  // barline itself.
  scoreMeas = Math.max(0, Math.floor(base / SCORE_SPB));
  repaintScore();
  lightStep(base);
  const stepSec = 60 / Math.max(30, d.bpm || DOC.time.bpm) / 4;
  for (let sub = 1; sub < 4; sub++)
    stepTimers.push(setTimeout(() => { if (playing) lightStep(base + sub * rate); },
      sub * stepSec * 1000));
  // the board's <meter>s are the AUTOMATION — the gain actually driving each
  // channel at the sounding box — and they move once a beat off this feed. A
  // view never installs its own rAF loop and audio never calls a view.
  paintBoard();
});
on("transport:state", () => {
  // PLAY AND STOP REPAINT THE UPPER STAVES AND TOUCH NOTHING ELSE. This was
  // `draw()`, and it said so: "the staves say 'as written' when stopped and
  // name each voice's word when sounding, so the system has to be re-drawn
  // when the transport flips". Both halves of that reversed on 2026-08-24 —
  // the upper staff names the word whether the transport runs or not, and the
  // lower one says "as written" forever, so neither needs a rebuild. What
  // actually flips is the caption's tense, and which section it is engraving
  // if the sounding one is not the one you are writing. PRESSING PLAY MUST
  // CHANGE NOTHING ABOUT THE EDITABLE HALF, and a full redraw changed all of
  // it, 409 ms at a time.
  // ...AND THE SCORE, which shows the sounding section playing or the edit
  // position stopped, so the flip is exactly one caption and one system.
  repaintScore(true); say();
  // …and the readout, because "pos" stops ticking the moment the transport
  // does: without this the page would still be claiming a runway after stop().
  engineAt = 0; paintEngine();
  if (playing) {
    // THE CLOCK MAY NOT REACH window.scrollBy. `restoreAnchor` re-applies a
    // remembered scroll for a second and a half after every engrave that
    // lands, which is right for a page that grew under a still thumb on a cold
    // load — and wrong, absolutely, for the score re-engraving at a barline,
    // which is the page moving by itself for no reason. It has nothing to
    // correct there anyway (the score's box is reserved and its two buffers are
    // the same height), so this is the belt over that brace: one line, and the
    // clock cannot reach the scroll at all. (It said "for a composed staff
    // repainting on a boundary"; that staff was deleted on 2026-08-25 and the
    // sentence is true of its replacement word for word.)
    anchorWant = null;
    return;
  }
  clearStepTimers();
  lightStep(-1);
  mark(chordCell, -1, DOC.alphabet.prog.map((c, i) => String(i + 1)));
  const secLabels = DOC.form.sections.map((x, i) => String(i + 1));
  mark(formCell, -1, secLabels);
});

function draw() {
  // the record names the page, not the HTML: this is a composition surface,
  // and which composition is a fact about the document
  // A SONG IS NAMED BY ITS GENRE (2026-08-24). Not titled: a title is a claim
  // about a record, and what this page has is a point in genre space with
  // eight axes moved off it. The basis says its own name.
  const h1 = $("title");
  if (h1) h1.textContent = (GENRES[DOC.basis] || {}).label || DOC.basis;
  const box = $("app");
  const wasKey = document.activeElement && document.activeElement.dataset
    ? document.activeElement.dataset.k : null;
  const wasPicker = opensAPicker(document.activeElement);
  keepPanes();          // ...and every pane's sideways scroll (keepPanes, above)
  // WHERE THE PAGE WAS, KEPT — AND WHO STILL NEEDS IT. The clock stopped
  // rebuilding this page on 2026-08-24 (see the two transport handlers), so
  // the question is fair: a page that is not redrawn under a live finger does
  // not need its focus put back. It is still needed, because draw() has not
  // gone anywhere — every EDIT rebuilds the whole document, and so does a
  // voice tab, a section tab, a design button and a record swapped in from the
  // atlas. What went is the rebuild NOBODY ASKED FOR; a rebuild you caused by
  // touching something still has to put your thumb back where it was.
  //
  // Two things then move the scroll: the panel under the tabs is a different
  // height for a different voice, and `.focus()` scrolls its element into
  // view. So the tab strip is measured against the viewport before the
  // rebuild and put back exactly where it was after — everything above it is
  // the same height, so pinning it pins the page. Tapping a voice now changes
  // the panel under your thumb instead of throwing you up the page.
  //
  // ...WITH ONE CONTROL EXEMPT SINCE 2026-08-25: a `<select>` a POINTER was
  // last on is not re-focused, because focusing a select re-opens its picker
  // on iOS and that is Paul's "when I select something the box just pops up
  // again". `restoreFocus` and `opensAPicker` carry the measurement.
  anchorId = "tabs";
  const anchor = $(anchorId);
  anchorWant = (anchorOff || !anchor) ? null : anchor.getBoundingClientRect().top;
  anchorAt = Date.now();
  // …and the page keeps the height it had while it is being rebuilt (holdHeight)
  const release = holdHeight(box);
  try { redrawApp(box); } finally { release(); }
  putPanes();
  // `document` and not `box`: the board is mounted into #deck, outside #app,
  // and a thumb that was on a fader is still a thumb that must come back.
  restoreFocus(document, wasKey, wasPicker);
  restoreAnchor();
}
// THE REBUILD ITSELF, so that `draw()` can wrap it in exactly one try/finally
// and the reserve above cannot be left behind by an early return.
function redrawApp(box) {
  box.textContent = "";
  const D = DOC;

  // ONE <section class="nu-ax"> PER AXIS, and #app holds nothing but sections.
  // This is not decoration: it is what makes the sticky heading say which axis
  // you are reading. See axis() for the containing-block rule that forces it.
  // (WHERE FIVE ROUNDS OF RECIPE MET: 08-shell R12 turned these blocks into
  //  sections; the sheets slice replaced their <select>s with sheet rows on the
  //  morning of 2026-08-24; the selects slice put eleven of them back as menus
  //  that evening, by name, and left the development words alone; W3 added a
  //  section that is not an axis at all — the producer's, which is here rather
  //  than beside the board because it edits the document; and on 2026-08-25
  //  Performance became a TAB of the band block rather than a section of its
  //  own. FIVE sections for eight axes — 4-7 were one grid and always were, and
  //  8 joined them because its scope is the song, not the player. This said
  //  "six sections" and the count is corrected rather than the sentence
  //  deleted: see `performanceTab` for why the enumeration and the headings
  //  are allowed to disagree.)

  /* 1 TIME */
  const axTime = axis(box, "ax-time", "1 · Time");
  D.sound = D.sound || { level: 1 };
  number("level", "level", D.sound.level, (v) => D.sound.level = v, axTime, 0.5,
    +(1 / (((GENRES[D.basis] || {}).tone || { gain: 0.28 }).gain)).toFixed(2), 0.25);
  number("bpm", "tempo", D.time.bpm, (v) => D.time.bpm = v, axTime, 40, 220);
  // THE THREE-WAY RATE MAPPING LIVES IN THE DATA TIER, AND STAYED THERE THROUGH
  // BOTH REVERSALS. "as written" is rate 1 and has no key in fields.js RATES, so
  // somebody has to carry it; that somebody is avail.js SHEETS["time.rate"],
  // where the extractor reads the same three cases the page draws. It moved out
  // of this file when the menu became a sheet and it did not move back when the
  // sheet became a menu again — which is the point of one spec for two widgets.
  // METER, READING SPEED, SWING — SETTLED PARAMETERS, AND THE THREE PAUL NAMED
  // FIRST (2026-08-24, evening: "We can return some things to select menus:
  // meter / reading speed / swing"). Each is one value for the whole record,
  // decided once. A lit sheet is for comparing many musical options at a time;
  // there is nothing to compare in "is this in three or in four".
  selectRow(axTime, null, [shSpec("time.meter", {}), shSpec("time.rate", {}),
                           shSpec("time.swing", {})]);

  /* 2 ALPHABET */
  const axAlpha = axis(box, "ax-alphabet", "2 · Alphabet");
  // THE CHANGES ARE AN AXIS AND THE PAGE HAS NEVER OFFERED THEM. `harmony` has
  // been in the document since the first version (songs.js: "modal is the
  // anchor's own harmony and it means one mode, no changes") and there was no
  // control for it, so the one fact that decides whether the whole progression
  // is READ (kernel.js:671, `if (!g.prog || g.harmony !== "cycle")`) could only
  // be changed by editing JSON. The chord-quality sheet below is greyed on a
  // modal record; this is the way out of that grey, and greying THIS one would
  // be a trap — see avail.js's `sheetGate` note.
  // KEY, MODE, THE CHANGES — named in the same sentence ("key (although please
  // spell things out like not just A# but A#/Bb) / mode / the changes"), and
  // the key spells both names of every black note (fields.js KEYNAMES: "A♯/B♭",
  // not "A♯"), because ui/abc.js picks a signature by the copyist's convention
  // and would otherwise engrave a Bb over a control that said A♯.
  //
  // THE KEY IS DRAWN AS THE CIRCLE OF FIFTHS AND THE OTHER TWO ARE MENUS
  // (Paul, 2026-08-24: "Maybe put the circle of fifths back in there for key
  // selection, it was nice."). This line said `shSpec("alphabet.key", {})`
  // inside the row above until 2026-08-25 and the sentence that put it there
  // is not withdrawn — the key IS a settled parameter, one value decided once
  // that nobody browses, and that is still the reason it is not a lit sheet of
  // twelve. What the menu could not do is show a composer which keys are next
  // door to the one they are in, which is the only thing anybody ever wants to
  // know about a key while they are choosing one. Same spec, same `optionsFor`
  // result, same availability law, better picture. See ui/selects.js
  // `keyCircle` for the widget and the argument in full.
  keyCircle(axAlpha, shSpec("alphabet.key", {}), fifthsRing());
  // ...AND THE MODE STAYS ITS OWN MENU, BESIDE IT. That is this round's own
  // decision (2026-08-25) and not a sentence of Paul's, so it is written down
  // with its argument rather than as a quotation: tapping Am gives you A minor,
  // and you can still push it to A dorian with the menu next to it without the
  // circle having to grow. The mode list is dorian, phrygian, harmonic,
  // mixolydian, major, lydian, melodic minor and natural minor — longer than
  // major-and-minor, and seven rings would be a worse object than the one
  // musicians actually keep in their heads.
  selectRow(axAlpha, null, [shSpec("alphabet.mode", {}),
                            shSpec("alphabet.harmony", {})]);
  check("diatonic", "the line stays in the key", D.alphabet.diatonic,
    (v) => D.alphabet.diatonic = v, axAlpha);
  heading(axAlpha, "the changes");
  chordGrid(axAlpha);

  /* 3 MATERIAL */
  /* 3 MATERIAL — AND THE HEADING SAYS "SHEET MUSIC" (Paul, 2026-08-25:
     *"rename 'Material' to 'Sheet music'"*).

     THE HEADING MOVED AND THE AXIS DID NOT, and that is a decision rather than
     a shortcut. AXES.md's eight are the VOCABULARY — the names we talk about a
     record with — and "Material" is the word in every one of them that is also
     a KEY: `doc.material.cells`, `materialAt`, `avail.js`'s `material.cell` and
     `cast.material`, `gates.json`'s rules keyed by those two, `#ax-material`,
     and the fixtures that capture all of it. Renaming the model would be a data
     migration across six files this slice does not own, for a word nobody
     types. Renaming the HEADING costs one string and answers the whole of what
     was asked: what a reader sees over the score and the motifs is "3 · Sheet
     music", which is what the axis has actually contained since the score
     landed above the motifs this morning. AXES.md carries the note beside the
     Material row so the vocabulary and the page cannot drift.

     THE ID STAYS `ax-material` for the same reason the model does: it is the
     anchor `drawMaterial()` pins the page on and the handle three gates use. */
  materialAxis(axis(box, "ax-material", "3 · Sheet music"));

  /* 4-8 FORM x CAST x DEVELOPMENT x SOUND x PERFORMANCE */
  // `4–8` and not `4–7` since 2026-08-25: Performance moved in as a tab of this
  // block ("Why don't you move performance in as a tab too"), so the heading
  // has to say which axes are under it. The full argument, and the departure
  // from one-heading-per-axis it makes, is on `performanceTab`.
  bandBlock(axis(box, "ax-band", "4–8 · The band"));

  /* 9 THE PRODUCER — NOT A NINTH AXIS. The eight determine the SCORE; this is a
     session fact, "the eight plus what was said" (AXES.md:113). It draws last
     because it is a statement ABOUT the eight above it, and it is inside #app
     because it edits the document (`DOC.produce`) where the board does not. */
  mountProduce(box, CTX);

  /* THE BOARD ("an actual mixing board at the end is a nice idea"). Not one of
     the eight axes and not in their container: it is what the record lands on,
     so it gets its own host at the foot of the page. */
  const deck = $("deck");
  if (deck) { deck.textContent = ""; mountBoard(deck, CTX); }
}

/* ---------- transport ---------- */
const playBtn = $("play"), volEl = $("vol");
const say = (onNow) => { playBtn.textContent = (onNow || playing) ? "stop" : "play"; };
playBtn.addEventListener("click", () => {
  if (playing) { stop(); say(false); } else { startAt(0); say(true); }
});
on("transport:state", () => say());
volEl.value = String(vol);
volEl.addEventListener("input", () => { setVol(+volEl.value); commit("transport"); });

/* ---------- boot ---------- */
window.__eightDoc = () => DOC;          // the raw document, for a console
// THE FLEET THE CONTROLS WERE DRAWN WITH. `sound.instrument` offers one option
// per modelled Faust voice and audio/to-engine.js SYNTH is the only table that
// knows which those are — an ES module the data tier cannot require, which is
// why `ENV` exists at all. test/sheets.js checks that every sheet drew exactly
// as many options as avail.js says it should, and a gate that had to guess the
// empty fleet would count two short and call the page wrong. (`sound.instrument`
// is a <select> again since 2026-08-24's evening — "in voices -- plays,
// material, instrument -- dropdowns/selects" — and this paragraph did not have
// to change a word of its argument, only the noun: the fleet is what the OPTION
// LIST is made of, and both widgets take the same list.)
window.__eightEnv = () => ENV;
window.__eightPhrase = () => phrase();
window.__eightStep = () => atStep;
// THE FROZEN HALF, AS THE PAGE ITSELF DEFINES IT (test/motif-frozen.js). The
// gate may not be more permissive than the code: it cannot invent an exclusion
// of its own, it can only ask what this file marked live. `replaceChildren()`
// empties a live container and keeps the element and ALL of its attributes, so
// a change to the container itself is still caught, and no regex ever touches
// the HTML. A THIRD `data-live` value existed for one day — "played", one
// composed block per line voice — and was deleted on 2026-08-25. TWO remain:
// "count" (the playhead registries) and "score" (the one two-measure system of
// the whole band, above the motifs). This function did not have to change a
// character to take the third one on, and it did not have to change one to see
// it go, which is the whole argument for asking the page rather than writing a
// list: it empties whatever declared itself, and a surface that forgets to
// declare itself fails the gate rather than sneaking past it.
window.__eightFrozen = () => {
  const c = $("app").cloneNode(true);
  for (const n of c.querySelectorAll("[data-live]")) n.replaceChildren();
  return c.outerHTML;
};
window.__eightEngraves = () => engraves;      // abcjs renders, ever
// ...AND THE SCORE'S OWN, which is a different claim on a different surface
// (see `scoreEngraves`): how many times the two-measure system has been drawn.
// Over a playthrough it is one per two measures at most, and fewer wherever a
// window repeats the one before it.
window.__eightScoreEngraves = () => scoreEngraves;
window.__eightScore = () => ({ abc: (scoreBufs[scoreShown] || {}).abc || "",
                               win: scoreWin, sec: scoreSec,
                               ready: scoreBufs.map((b) => b.key + (b.ready ? "!" : "?")),
                               voices: ((scoreBufs[scoreShown] || {}).voices || [])
                                 .map((v) => v.name),
                               lit: scoreLit.length, cap: scoreCap &&
                               scoreCap.textContent,
                               box: scoreReserve, fit: scoreFit() });
window.__eightSec = () => atSec;              // the SOUNDING section
window.__eightViewSec = () => editSec();      // the section being WRITTEN
// ...and the live half, so a gate can prove a boundary happened twice over:
// once off the section index, and once off a caption that has to name it.
// THE NAME IS UNCHANGED AND WHAT IT READS HAS MOVED. It listed one caption per
// composed motif block; those blocks were deleted on 2026-08-25 and the SCORE's
// caption is the only sentence the clock writes in #app now. The hook keeps its
// name deliberately: test/motif-frozen.js A4 asserts that "a caption moved"
// across two section boundaries, and that assertion is TRUER of this caption
// than it was of those — the score's says which section AND which two bars, so
// it moves at every barline as well as at every boundary.
window.__eightCaptions = () => (scoreCap ? [scoreCap.textContent] : []);
window.__eightCells = () => hookCells.map((h) => h.cells.length).join(",");
window.__eightPhraseOf = (n) => phrase(n);   // a gate reads the COMPILED hook
window.__eightSong = () => SONG.map((b) => ({ g: b.stack[0].g, len: b.len, role: b.role }));
// WHAT THE BOX ACTUALLY CARRIES (D7). The nine section nudges are written onto
// the box by nukernel/document.js boxesOf and read by ui/derive.js; a gate that
// asserted on DOC would prove only that the page can store a string.
window.__eightNudges = () => SONG.map((b) => ({ env: b.env, intro: b.intro,
  outro: b.outro, mot: b.mot, lvl: b.lvl, breath: b.breath, pipe: b.pipe,
  period: b.period, nudge: b.nudge }));
// ...AND WHAT THE BAND PLAYS (D7). The envelope, the intro and the outro run in
// ui/derive.js sectionEvents and nowhere else, so "the arch moved the sound" is
// only answerable off this stream. TEST THE ARTIFACT: three features have
// shipped broken here while every check passed.
window.__eightEvents = (si) => {
  const b = SONG[si];
  if (!b) return [];
  return sectionRender(b, SLOTS, GROOVE, SWING).ev
    .map((e) => ({ t: e.t, vel: e.vel, kind: e.kind, lv: e.lv }));
};
// WHAT THE PRODUCER DID, for the artifact gate (test/producer.browser.js) — the
// same probe ui/band.js:2642 had. The notes, the tempo and the desk offsets it
// asked for, plus what it says it moved.
window.__eightProd = () => { const R = producedDoc(DOC);
  return { notes: R.said.map((l) => l.note), bpm: R.bpm, mix: R.mix,
           said: R.said.map((l) => ({ sentence: l.sentence, said: l.said,
                                      moved: l.moved, refused: l.refused })) }; };
registerSW(); warmShell();
normalize();
push(true);
warmup();
draw();
say();
// AFTER draw(), not before: the atlas's boot calls showing(DOC.basis), which
// wants the record already on the page. TERMS.basis is gregorian, so the map
// opens on Rome 600 — which is exactly what #title already says.
ATLAS = mountAtlas($("atlas"), CTX);
if (ATLAS) ATLAS.showing(DOC.basis);
