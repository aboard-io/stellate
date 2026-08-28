// nukernel/ui/eight.js — THE EIGHT AXES, AS A PAGE. One record on the front
// door — "Terms and Conditions", songs.js — and a control for every axis it
// is made of, in the order the axes are evaluated (nukernel/AXES.md):
//
//   Time · Alphabet · Material · Form · Development · Cast · Sound · Performance
//
// THE BLOCKS BELOW STAND IN THAT ORDER TOO, and that is the only organising
// principle this file has: whatever the page draws Nth is defined Nth. After
// two integrations it had stopped being true — the chord chart was written
// after the kit and the staves after both — and a file whose sections do not
// match its own stated order is a file nobody can find anything in. (It said
// "whatever draw() calls Nth"; draw() calls ONE panel builder now — see THE
// NINE TABS — and the order the blocks stand in is the tab table's.)
//
// ...AND THE PAGE IS NINE TABS, 2026-08-27. Paul: *"Why don't we make tabs at
// the top level and let go of the idea of scrolling everything? The tabs are:
// Where / Tempo / Key / Motif / Band / Mix / Produce / Score / Export."* One
// panel is on the screen at a time, each is built the first time it is opened
// and rebuilt only when the record has moved under it, and the whole shell is
// one section of this file (search THE NINE TABS). nukernel/AXES.md carries
// the join from Paul's nine words to the eight axes; nu.css carries what the
// reversal cost the sticky heading.
//
// THREE THINGS ON THIS PAGE ARE NOT AXES, and each is drawn where it is named
// rather than smuggled into the eight: the PRODUCER's block is a session fact,
// "the eight plus what was said" (AXES.md:113); the ATLAS is a way IN to a
// record, not a part of one; and the BOARD is what the record lands on. NONE
// of the three is inside #app — the producer left it on 2026-08-27 for its own
// host (#produce), because FUTURE.md's page order is "producer last to say,
// score last to see": the last thing a hand can say about the record sits
// immediately above the last thing an eye sees of it. Paul's tab list keeps
// that reading — Produce · Score · Export — and puts the way OUT of a record
// after the two. (This sentence said "only the first is inside #app, because
// only the first edits the document" — editing the document was never the
// reason a block had to LIVE in #app, only the reason it is re-mounted, which
// the producer still is. It also said "above #app" and "under it", which were
// facts about a scroll and are now facts about a tab row.)
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
         // …AND WHICH KNOBS THE SEATED VOICE HAS. Same kind of table as
         // NuGates and it arrives the same way: GENERATED by
         // nukernel/knobs-extract.js, which MEASURES what a `set` key moves by
         // probing the parent rather than reading the parent's source text.
         // The only list of what an instrument editor may draw (VOICE.md §2).
         NuKnobs,
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
         engineLine,
         // WHERE AN EDIT ACTUALLY LANDS (2026-08-28). Paul: *"Make the logger
         // also have a countdown for when I change things, showing how many
         // beats before they take effect."* audio/live.js has computed that
         // number since the pending feed was written — the serial rule, the
         // section-scoped landing, the onBar clamp, the ticker that refuses to
         // count UP — and NOTHING HAS EVER CALLED IT. `grep announceChange`
         // over the whole box answered one line, its own export. It is the
         // house bug this page keeps a memory of ("declared but never
         // arriving"): a whole feed costed, wired to `emit`, reaching no
         // reader. `push()` is its caller now, which is where its own comment
         // always said the caller would be — "the UI calls this right after
         // push()".
         announceChange } from "../audio/live.js";
import { registerSW, warmShell, warmCache } from "../audio/offline.js";
// ...AND THE SAME COMPILER ASSEMBLING A WHOLE SYSTEM. `toScore` is the score
// block's half of ui/abc.js: several parts under one head, barred together.
import { toEngraving, toScore, toNotes, ottavaFor } from "./abc.js";
// …AND THE READING OF ONE, WHICH IS THE SAME NOTES OUT LOUD. `toNotes` is the
// timeline `toABC` folds into bars, so the motif you tap and the staff you are
// looking at cannot disagree about a pitch or a length (audio/audition.js).
import { playAudition, stopAudition, auditioning, auditioningKey,
         auditionVoice, auditionKit, zoneFilesFor,
         kitFilesFor } from "../audio/audition.js";
import { SYNTH_NAMES, voiceUnit } from "../audio/to-engine.js";
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
/* `engineer` LEFT THIS IMPORT LIST, 2026-08-28. It drew the read-only mirror
   table inside the band sheet and Paul asked for the table to go ("get rid of
   the engineer table"); the tombstone at its old call site in `bandBlock`
   carries the whole argument and what was lost with it. The export is still
   THERE — ui/engineer.js is fenced this round — and is now uncalled from
   anywhere; its deletion is the first item of the round's report. */
import { mount as mountBoard, paintBoard } from "./engineer.js";
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
// THE SCORE DECK's export seams (2026-08-27, nukernel/ideal/score-deck.html):
// the SMF writer reads the SAME toScore() fold the engraving is drawn from —
// one owner per note — and the deck's piano roll borrows its notehead→GM fold
// (`headGM` over SCOREHEAD) so a drum block lands on the same key in the file
// and on the roll. `songDurSec` is the score's own length in seconds, which is
// what the WAV press is measured against.
import { writeSmf, parseSmf, headGM } from "../export/smf.js";
/* ...AND WHAT THE ENGINE DID WITH A CHANNEL (`channelFacts`, 2026-08-28) —
   the engine's own answer about the seated voice, which is how `voiceSound`
   knows a voice is STEREO and refuses its insert slots with the reason rather
   than letting audio/desk.js `widthKept` strip the chain in silence. It is the
   same function ui/engineer.js reads for the same refusal; a second guess at
   "is this stereo" from the document would be the drift, since the answer is
   the parent's and not the record's. */
import { songDurSec, channelFacts } from "../audio/plan.js";
// THE MARKS ON THE TABS, AND THE ONE EXPLAINER (2026-08-28). Paul: "Please
// make all the tabs and top buttons into sensible icons to save space. Voice 2
// for example could be more symbol plus the number 2. Provide a simple long
// tap or hover tooltip to explain what they are." `KINDGLYPH` used to live in
// THIS file, three characters keyed by a voice's kind, with a comment on it
// about the last time it was copied — and ui/engineer.js obeyed that comment
// by refusing the glyphs and drawing its tabs as words. Paul asked for marks
// on every strip on the page, in four files, so the table is EXTRACTED to
// ui/glyph.js and imported here; nothing about the three characters changed.
import { GLYPH, kindGlyph, sayVoice, sayUp, sayLog, icon, paintIcon,
         wireSay } from "./glyph.js";

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
  // `fx` start as the SAME objects on every box: the stored strip is one
  // statement for the record. REWRITTEN 2026-08-27 (the one-board round). This
  // comment said "a per-SECTION desk is not expressible and that is the right
  // answer for this axis until somebody wants a chorus louder than a verse" —
  // and somebody did: Paul, quoted in FUTURE.md's one-board decision, "some
  // voices raise and some fall." The sentence named its own end condition and
  // met it, so it is rewritten rather than deleted, and the word grid below is
  // the writer it foresaw. What it got right stays true: the DERIVED layer
  // still moves per section (audio/desk.js shade() reads sec.lvl / sec.env),
  // and every store is null for a document that says nothing, which
  // is byte-identical to what this line produced before (desk-gate G1).
  // `dfx = NuDeskDoc.boxFxOf(DOC)` and `b.fx = dfx` CAME OFF HERE 2026-08-27,
  // with the record-wide Character chain itself. Paul: *"We can get rid of
  // Character right? We don't really use it any more do we?"* — the chip is
  // dealt to the chairs (precompose.js deskThe), an already-saved `sound.fx`
  // is folded onto them at the door (document.js normalize), and a box carries
  // no record-wide chain any more. desk-doc.js's tombstone has the whole
  // reason and the measurement.
  const dparts = NuDeskDoc.deskPartsOf(DOC, GENRES);
  for (const b of boxes) b.parts = dparts;
  // …EXCEPT WHERE THE SECTION GRID SAYS OTHERWISE (ideal/one-board.html §III:
  // "A word is a trim on the strip's fader for that section" — the reversal is
  // dated and quoted above). A box whose section carries a trim word for a voice gets its OWN
  // parts map, the entry overlaid through fields.js trimApply — a dB trim on
  // the stored fader through faderDb (the one clamp), or the cut for `out` —
  // so the grid reaches the sound on the exact wire the fader already proved
  // on rendered audio (test/tape-reach R1). A record with no trims takes the
  // branch above untouched: same shared reference, byte-identical boxes.
  {
    const chansV = NuDeskDoc.channelVoicesOf(DOC, GENRES);
    boxes.forEach((b, i) => {
      let P = null;
      for (const c of chansV) {
        const t = c.voice.desk && c.voice.desk.trim &&
          c.voice.desk.trim[secs[i].id];
        if (t == null ||
            !Object.prototype.hasOwnProperty.call(NuFields.TRIMS, String(t)))
          continue;
        if (!P) P = { ...(dparts || {}) };
        P[c.key] = NuFields.trimApply(P[c.key], t);
      }
      if (P) b.parts = P;
    });
  }
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
  // …AND THE MOTIFS GO IN THE WARM. audio/offline.js puts `extra` ahead of the
  // cast so a handful of files can never be crowded out, and this is what
  // makes "tap the motif and hear it" true with the wire cut: the record's own
  // instruments are warmed anyway (they are the cast), but a STAND-IN is not —
  // the chant's cantor is a Faust throat and its motif reads on a recorded
  // solo_vox that nothing else on the page ever asks for. One or two zones per
  // motif, because a sixteen-step tune spans one or two of a sampler's zones.
  warmCache(auditionWarm());
  /* ...AND THE LOG IS TOLD WHAT YOU JUST DID, AND THE ENGINE IS TOLD AN EDIT
     IS IN FLIGHT (2026-08-28). LAST in this function on purpose: `logEdit`
     calls audio/live.js `announceChange`, whose whole arithmetic is "the walk
     runs a runway ahead of the ear, so a change committed NOW first sounds at
     `lastAsked + 1`" — and the recompile that decides that is `commit("box")`
     eight lines up, which reaches the changed-law block synchronously. Asking
     before the recompile would be asking about the old score.

     `first` IS THE ONE PATH THAT DOES NOT LOG HERE, and it is not an
     exception, it is a different sentence: `push(true)` is the boot and
     `CTX.setDocument` — a whole record ARRIVING, not a field moving — and a
     record has its own line, written by `logRecord` where the record lands,
     with the record's own name in it. A boot writes nothing at all, because
     nobody did anything. */
  if (!first) logEdit();
}
// which files every motif in the bank would pull to be heard. Pure, and it
// asks `auditionOf` rather than re-deciding — one answer to "who reads this".
function auditionWarm() {
  const out = [];
  try {
    for (const name of cellNames()) {
      const A = auditionOf(name);
      if (!A) continue;
      if (A.hits) out.push(...kitFilesFor(A.hits.map((h) => h.lane), A.kit.dir));
      else out.push(...zoneFilesFor(A.notes.map((x) => x.midi), A.voice.id));
    }
  } catch (e) {}
  return out;
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
// keyboard), otherwise its axis — and an axis's first child is the <h2> that
// names it, so what is announced is "Motifs" and not silence. (It said "the
// STICKY <h2>". The heading stopped being sticky and became visually hidden on
// 2026-08-27 when the tab row took the second band over — nu.css, THE SECOND
// BAND IS THE TAB ROW — and this sentence did not have to change its claim,
// only that adjective: `.nu-vh` is hidden from the EYE and from nothing else,
// so the announcement is exactly what it was.)
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
  for (const d of document.querySelectorAll(".nu-pane")) {
    /* A PANE IN A SHUT TAB IS NOT A PANE AT 0 (2026-08-27). `display: none`
       reports `scrollLeft` 0 and eight of the nine panels are shut at any
       moment, so without this line every rebuild would write 0 over the
       remembered position of every pane on the page — and the note above,
       "ZERO IS A POSITION AND IT IS RECORDED LIKE ANY OTHER", would be
       recording a position nobody put it in. A shut pane's real position is
       whatever it had when its tab was last on the screen, and that is what
       stays in the map until `showTab` puts it back. */
    if (!d.getClientRects().length) continue;
    if (d.dataset.pane) paneScroll.set(d.dataset.pane, d.scrollLeft);
  }
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
  /* AND EVERY TAB YOU ARE NOT LOOKING AT IS NOW OLDER THAN THE RECORD
     (2026-08-27). This is the one line the tabs add to this function and it is
     the line without which they would introduce this repo's characteristic
     bug — DECLARED BUT NEVER ARRIVING. `edited` exists precisely BECAUSE it
     does not call `draw()`: a motif slider must not tear down the block your
     finger is on. But `draw()` is also where "the record moved, so every panel
     is stale" was written, so without this the score would engrave, the
     producer would list and the band would draw the tune this edit replaced,
     for as long as the page stayed up.
     The OPEN tab is deliberately not marked: this function's whole job is that
     the panel under your finger is repaired in place, by `reEngraveWritten`
     and `scoreChanged` below, and not rebuilt.
     (The paragraph above — "WHAT THIS DOES NOT REFRESH, SAID OUT LOUD: the
     producer's block … is one gesture stale" — is answered rather than
     restated: it is not stale for a gesture any more, it is rebuilt the moment
     it is next opened.) */
  for (const t of TABNAMES) if (BUILD[t] && t !== openTab) tabStale.add(t);
  reEngraveWritten(cellName);
  // …AND THE SCORE, WHICH IS A PICTURE OF THE WHOLE RECORD AND HAS JUST GONE
  // STALE. Paul, 2026-08-26: "you probably have to fully render the whole
  // score each time something changes." This is that seam: `scoreChanged` puts
  // the loader up now and re-engraves once your hand has stopped moving, which
  // is the only way a whole-record render can live behind a slider.
  scoreChanged();
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
  setDocument: (next) => { stop(); auditionOff(); DOC = next; normalize(); push(true);
                           anchorOff = true;                 // see ANCHOR_MAX
                           paneScroll.clear();      // a new record is a new page
                           staffBox.clear();        // …and so are its staves
                           try { draw(); } finally { anchorOff = false; }
                           anchorWant = null;
                           if (ATLAS) ATLAS.showing(DOC.basis);
                           /* AND THE LOG SAYS WHICH RECORD ARRIVED (2026-08-28).
                              AFTER draw(), because the record's name is read off
                              `#title` — the heading draw() writes — which is
                              this page's one owner of what a record is called,
                              and reading it here rather than re-deriving it is
                              the same discipline the action lines use: the log
                              says what the RENDERED page says. */
                           logRecord(); },
  /* THE ATLAS MOVED, SO THE ADDRESS DOES (see THE ADDRESS). It is a hook and
     not a subscription because the seed and the year live in ui/atlas.js and
     no event on ui/state.js's bus is fired for either — "box" is one call per
     user EDIT of the document, and moving the when-slider edits nothing. The
     write is debounced here, not there: the atlas does not know that an
     address is expensive to write. */
  moved: () => markLink(),
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

/* ---------- THE SCORE — THE WHOLE BAND, ON ONE MOVING RIBBON ----------
   Paul, 2026-08-25: *"add a section ABOVE motifs which is the current playing
   music, two measures at a time, but ALL"*.

   ALL IS THE WHOLE OF THE ASK, and it is what makes this a different object
   from the motif staves under it. A written staff is a PART — one player's
   line, as the cell stands — and the motif blocks below draw one per cell. A
   SCORE is every part at once, stacked in the record's own order and barred
   through, so you can read DOWN a beat and see what the band is doing at that
   instant. Nobody has ever been able to see this record's counterpoint, its
   bass and its kit in one look.

   AND IT MOVES NOW, WHICH IS THE ROUND OF 2026-08-25 EVENING. Paul:
   *"Switching measures is super jumpy so I thought you could [neatly] render
   it and scroll the score horizontally as the song progresses."* The old
   mechanism is written out below (see THE RIBBON REPLACES A WINDOW) rather
   than deleted, because its ask has not been withdrawn — you still see the
   current bar and the next — only its mechanism has.

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
   each chair's `entry`, the harmonize stage and the groove; the written staff
   is the theme as it stands and nothing else. Read together they say what a
   conductor's score and a player's part have always said: here is your line,
   and here is what the room hears. Where they disagree the score is the
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
// (`lightStep`) and the written staves engrave. Not `stepsIn(g)`: the score
// has to sit in the same measure the red note is walking through, and every
// other surface on this page — the maker grid, the kit, the written staff —
// is built on sixteen. A genre in a twelve-step meter draws its score the way
// it draws its motifs, which is the disagreement to fix in one place if ever.
const SCORE_SPB = 16;
// HOW MANY BARS THE SENTENCES SPEAK FOR, and it is no longer how much is
// DRAWN. The caption and the syllable line say "bars 2-3" — the bar that is
// sounding and the one after it, which is the ask of 2026-08-25 morning ("I
// should see the current measure and the next") and is still what is in front
// of you on the paper. The picture itself holds the WHOLE RECORD now; the
// words are a place in it, not a description of it.
const SCORE_BARS = 2;

/* ---------- ONE ENGRAVING, MOVED AT A STEADY SPEED ------------------------
   Paul, 2026-08-26, and this surface is those two sentences:

     "the music gets out of alignment as it scrolls because you're putting in
     notes above and below the staff. i think you probably have to fully
     render the whole score each time something changes. but that's okay. you
     can pop up a loader."

     "don't scroll the whole thing faster or slower. Just scroll at a steady
     speed BUT highlight notes in red. Get rid of the playhead."

   THE DIAGNOSIS IS EXACT, AND IT IS MEASURED RATHER THAN AGREED WITH. Until
   this round the picture was a ROW OF TILES — four bars each, engraved
   separately and laid end to end — and a tile is exactly as tall as the notes
   IN it: abcjs allocates the room above a staff from the highest thing that
   staff holds. Two four-bar tiles cut out of the SAME record and engraved the
   old way, measured 2026-08-26 on the precomposed reggae at 1280x900:

     bars 1-4   (plain)         height 556.99   staff one at y 75.74   gap 79.00
     bars 41-44 (ledger lines)  height 588.20   staff one at y 80.69   gap 80.08

   The ribbon answered the middle column by NUDGING each tile so that staff one
   landed where the last tile's did. That lines up ONE staff and lets every
   staff under it drift, because the third column moved too: 1.08px of extra
   space per staff is 6.5px by the seventh, so the bottom of a seven-voice
   system stepped up and down at every seam. And the tiles were then scaled
   INDIVIDUALLY into the box's fixed height — 556.99 against 588.20 is 5.6% —
   so consecutive four-bar stretches of one line of music were drawn at two
   different note sizes. That is "out of alignment as it scrolls"; it is a fact
   about the ENGRAVING and not about the placement, and no amount of nudging
   can reach it.

   SO THE WHOLE RECORD IS ONE ENGRAVING. One `renderAbc`, one system, every
   bar of every section of the record in it — abcjs then makes ONE decision
   about height, staff spacing and note size, off every note in the record at
   once, and the staves cannot fail to line up because there is only one of
   them per voice. What moves is a transform on that single picture, which is
   the same free motion the tiles had.

   AND THE COST IS PAID IN ONE LUMP, WHICH IS WHAT THE LOADER IS FOR. This was
   measured before the tiles were chosen and the measurement is why they were
   chosen: 36 bars x 2 staves = 134ms, 36 x 8 = 404ms, 60 x 8 = 742ms, 104 x 8
   = 1034ms (2026-08-25). Every one of those numbers is still true and none of
   them is an argument any more, because Paul has priced the freeze himself and
   bought it: "that's okay. you can pop up a loader." What the tiles bought
   with that second was a score that does not line up, which is not a bargain.
   Measured on the rendered page 2026-08-26 (chromium, vendored abcjs, and
   `window.__eightScoreMs()` prints it back on any record): the shipped chant
   — 36 bars, 2 voices, 5 sections — engraves whole in **132ms at 390x844 and
   169-212ms at 1280x900**, and the precomposed Kingston 1969 reggae — 152
   bars, 7 voices, 13 sections, the biggest record in the catalogue — in
   **1691-1833ms at 1280x900 and 1753ms at 390x844**. A re-render after a
   one-note edit on the chant is 126ms. That second number is a second and
   three quarters of frozen page, and it is the whole reason there is a
   loader.

   IT IS PAID ONLY WHEN THE MUSIC MOVES. The picture is kept, with its
   geometry, keyed on the ABC STRING — so a rebuild that draws the same record
   again (a resize, a tab, pressing play) re-hangs the SVG it already has and
   asks abcjs for nothing. What costs a render is an EDIT, which is exactly
   "each time something changes".

   WHAT THE TILES LEFT BEHIND, so nobody restores half of it: `TILE_BARS`,
   `SCORE_TILES`, `scoreLine`/`scoreTiles`, `engraveTile`, `tileReady`,
   `tileGeom`, `tileX`, `layoutRibbon`, `chunkOf`, `nextChunk`, `nextSec`,
   `scoreSee`, `scoreAhead` and `soundingTile`. Two of their arguments outlived
   them and are kept below: the CROP (a tile's left margin is paper with no
   time in it, and the pinned gutter that replaced it is now the only clef on
   a picture whose own clef scrolls away in four bars) and the reserve (the box
   takes its room once and the picture is scaled into it). */
/* THE PLAYHEAD IS GONE, AND IT WAS THE THING THAT SAID "HERE". Paul: "Get rid
   of the playhead." It was a 2px line at `SCORE_HEAD` of the box with the
   music passing under it, and it was honest only while the scroll was the
   music's own — a fixed line over a steady scroll would sit a bar away from
   the note that is sounding and claim to be pointing at it. What says "here"
   now is the RED NOTEHEAD, which is the truth in every case: it is on the note
   the engine is playing, and when four staves sound together it says so four
   times, which a line never could (see `lightScore`). */
/* THE SPEED IS CONSTANT AND IT IS THE RECORD'S OWN. Paul: "don't scroll the
   whole thing faster or slower. Just scroll at a steady speed."

   The paper moves at PIXELS PER STEP — a constant, re-set only where the
   record turns a corner (`pinSpeed` carries the measurement that decided
   that), so a section's paper takes exactly as long to pass as the section
   takes to play and nothing speeds up or slows down inside it. That is a
   REVERSAL of what the ribbon did: it put the sounding instant under a fixed
   line by reading the engraving's own x for that instant, so the scroll went
   fast through a bar of sixteenths and slow through a bar of whole notes,
   which is what "faster or slower" names.

   WHAT IT COSTS IS THAT THE PAPER AND THE EAR DRIFT APART, and the drift is
   measured rather than hoped for: printed music is not spaced proportionally
   to time (a bar of sixteenths is wide and a bar of whole notes is narrow), so
   the sounding note runs ahead of the steady scroll through sparse music and
   behind it through dense music. `pinSpeed` walks every instant abcjs laid
   out and takes the widest excursion either way; `headFor` then places the
   window so that the WHOLE excursion is on paper you can see. Measured
   2026-08-26: the chant's excursion is -22.3px to +11.5px and the reggae's is
   -69.6px to +35.0px, against 1120px of visible paper at 1280x900 and 266px at
   390x844 — so on both records at both widths every sounding note is on the
   screen, and the aim had to be given up only on the phone (174.5 -> 181.6px).
   ONE SPEED FOR THE WHOLE RECORD does not survive that measurement, which is
   why it is not what `pinSpeed` computes. */
// WHERE THE EAR IS AIMED, as a fraction of the paper the box shows, WHEN THE
// DRIFT LEAVES ROOM TO CHOOSE. Just over a quarter in: enough behind to see
// the bar you have just played and three quarters ahead for what is coming,
// which is what makes the next bars readable BEFORE they sound (Paul,
// 2026-08-25 morning). It is an aim and no longer a line — `headFor` moves off
// it by as much as the record's drift demands and no more.
const SCORE_HEAD = 0.28;
// …and how much paper is kept either side of the furthest-drifting note, so a
// note at the edge of the excursion is still a note and not half a stem.
const SCORE_PAD = 12;
/* HOW MUCH OF THE ONE ENGRAVING IS ON SCREEN AT A TIME, IN BARS, AND IT IS A
   FRAME BUDGET AND NOT A PICTURE. Everything above is about the ENGRAVING —
   one system, one staff spacing, one note size, which is what makes the score
   line up. This is about the PAINT, which is a different machine and has a
   different bound: measured 2026-08-26 at 1280x900 on the precomposed reggae,
   a 152-bar seven-voice system is 29,878px of SVG holding 9,611 elements, and
   translating that costs 27fps — the browser is repainting a picture eight
   screens wide to move it 0.7px. Hiding the bars that are nowhere near the box
   (the same record, the same engraving, `display: none` on everything past bar
   12) takes it back to 58fps, and stopped it is 60 either way, so the cost is
   the MOTION of a very large picture and nothing else.

   THIS IS NOT THE TILES COMING BACK, and the difference is the whole of what
   this round is. A tile was its OWN abcjs render, with its own idea of how
   tall a staff is and how big a notehead is, and that is what made consecutive
   tiles disagree. A chunk is a piece of ONE render: the staves are single
   full-width paths that every chunk shares, the spacing was decided once for
   the record, and hiding a chunk changes nothing about where anything is. It
   is a curtain, not a cut. */
const SCORE_CHUNK = 4;
/* WHEN A LOADER IS HONEST, AND IT IS NOT A PREFERENCE EITHER. 100ms is the
   line this page already draws between a frame and a freeze — test/motif-
   frozen.js A7 fails a main-thread task at 100ms, and everything on this
   surface has been budgeted against that number since the ribbon. So: a render
   this page predicts will cost less than one A7 task is drawn without a word,
   because a loader that flashes for 60ms is a flicker rather than an
   explanation; one that will cost more says so first. */
const SCORE_LOADER_MS = 100;
/* HOW TALL A MOTIF LABEL IS, in box pixels, and it is the one number the CSS
   and this file have to agree about (`#scoredeck .nu-mot` — a 2px rule with a
   9px/1.4 cap hanging under it). It is here because the ROOM for it is
   reserved in JavaScript, at creation, like every other height on this surface
   (`scoreReserveTo`): the labels hang UNDER each staff, and under the LAST
   staff the engraving's own bottom margin may not be deep enough to hold one.
   Measured 2026-08-27 at 390px on the shipped chant: the gap between two
   staves is 47.3px and the room under the last is 45.7, so nothing is added
   there — the number only earns its keep on a record engraved tighter. */
const SCORE_MOT_H = 15;
/* AND THE PREDICTION IS MEASURED, NOT GUESSED. A render costs about the same
   per BAR OF ONE VOICE wherever it lands, which is the only shape the
   measurements support: 134ms for 36x2 = 1.86 a cell, 404 for 36x8 = 1.40,
   742 for 60x8 = 1.55, 1034 for 104x8 = 1.24 (2026-08-25). The seed is the
   dearest of those, so the FIRST render of a session over-predicts rather than
   under-predicts and a slow phone gets its loader; every render after it
   replaces the number with what this device actually did. */
let scorePerCell = 1.9;
let scoreRun = null;              // the moving row (transform lives here)
let scorePaper = null;            // …and the one picture in it
let scoreSvg = null;              // THE PICTURE, kept across rebuilds of the block
let scoreHost = null;             // the clipping box, which holds the reserve
let scoreCap = null;              // the sentence
let scoreSyl = null;              // …and what the mouths are singing (VOICE.md §7)
let scoreLoad = null;             // the loader, which is a word and not a box
let scoreLit = [];
let scoreAbc = "";                // the ABC the picture on the page is of
let scoreMap = null;              // time -> x, for the whole record
let scoreVoices = [];             // per voice: its notes, and the two indexes
let scoreEls = null;              // …and its noteheads, cached per engraving
let scoreChunks = [];             // the curtains: [{ g, x0, x1 }], left to right
let scoreShown = "";              // which of them are up, so a frame writes nothing
let scoreW = 0, scoreX0 = 0, scoreSX = 0, scoreH = 0;
// (`scoreY0` — where staff one's top line sits — stood here and is not kept.
//  It was the number every LATER tile was nudged to match, and with one
//  engraving there is no later tile to nudge: the picture sits at the top of
//  the box and the staves are where abcjs put them. `paperGeom` still reads
//  `y0` off the tune, because a caller that needs it should read it there and
//  not from a copy nobody updates.)
let scoreS = 1;                   // what the picture had to be shrunk by to fit
let scorePW = 0;                  // the printed width, margin cropped off
let scoreSecAt = [];              // section -> the absolute step it starts on
// WHERE EACH STAFF SITS IN THE PICTURE, in the SVG's own user units: the top
// and bottom lines of staff i, which is voice i (one staff per voice, in
// `DOC.voices` order — the same order `lightScore` counts `abcjs-vN` in). Read
// off abcjs's own tune object in `paperGeom` and NEVER off the page: a
// `getBBox` here would cost the layout this whole surface exists to avoid. It
// is what hangs a motif label under the right part.
let scoreStaffY = [];
let scoreSteps = 0;               // how many steps the whole record is
let scoreSecX = [];               // section -> where its paper starts, px
let scoreSecV = [];               // section -> ITS OWN STEADY SPEED, px per step
let scoreV = 0;                   // …and the record's average, for the readout
let scoreHeadPx = 0;              // where the ear is aimed, px into the box
let scoreDrift = [0, 0];          // how far the paper runs behind / ahead of it
let scoreSec = -1;                // the section that is sounding
let scoreMeas = 0;                // the measure it is in
let scoreReserve = 0;             // the room the picture is given, px
let scoreX = null;                // the transform actually applied, px
// HOW WIDE THE BOX IS, MEASURED ONCE PER DRAW AND NEVER ON THE CLOCK. `place`
// runs every frame and it needs the box's width to know where the ear is
// aimed; `clientWidth` is a LAYOUT READ, and a layout of this page is not
// cheap (measured 2026-08-25: 110-140ms with a 16,000px document under it).
// The width is a fact about the COLUMN — it changes when the page is rebuilt
// or the window is resized, both of which rebuild this block — so it is taken
// where every other measurement in this file is taken, in the draw.
let scoreBoxW = 0;
let scoreGut = null, scoreGutW = 0;   // the pinned left margin, and how wide
// ...AND WHAT THAT ROOM WAS MEASURED FOR. A box is a fact about a RECORD at a
// WIDTH — eight staves need four times the room two do — so the number is kept
// with the two things it depends on and thrown away when either moves.
// Measured 2026-08-25, before this line existed: the chant's two-staff box
// (213px) was still in force when the atlas swapped in an eight-voice
// yachtrock record, and the whole band was drawn at 0.24 scale inside it.
let scoreReserveKey = "";
// A SECOND ENGRAVING COUNT, AND IT IS DELIBERATE. `engraves` is the motif
// staves' own number and test/motif-frozen.js A6 holds it to "at most one
// abcjs render per line voice per section boundary" — a claim about the motif
// blocks, which is exactly the claim that gate exists to make. Adding this
// surface's renders to that counter would make A6 pass or fail on a different
// surface's arithmetic. One counter per claim.
let scoreEngraves = 0;
const scoreMs = [];               // …and what each of the last twenty cost

/* THE PARTS OF ONE SECTION: one per voice of the record, in the record's own
   order, each holding `bars` measures of one section from measure `k`. A voice
   with nothing in these bars — out, not yet entered, or simply resting — gets a
   phrase of rests rather than being dropped, so the system keeps its shape and
   the fourth staff down is the fourth voice, everywhere in the record.

   (It cropped to two measures when the score was a window and to four when it
   was a row of tiles. It is called with a WHOLE SECTION now, once per section,
   and `recordParts` lays the answers end to end — the crop stays because the
   caller still says how much it wants, and nothing else in this file knows how
   to turn a section into staves.) */
function scoreParts(si, k, bars) {
  const box = SONG[si];
  if (!box) return null;
  let R;
  try { R = sectionRender(box, SLOTS, GROOVE, SWING); } catch (err) { return null; }
  if (!R || !R.g || !R.ev) return null;
  const rate = R.g.rate || 1;
  const lines = LINES();
  const W = bars * SCORE_SPB, from = k * SCORE_SPB;
  const z = () => new Array(W).fill(0);
  const bucket = new Map();                 // voice name -> the section's steps
  const mine = (name) => { let b = bucket.get(name);
    if (!b) bucket.set(name, b = { midi: new Array(W).fill(null),
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
    const i = Math.round(e.t * rate) - from;
    if (i < 0 || i >= W) continue;
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
    const b = bucket.get(v.name) || { midi: new Array(W).fill(null),
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

/* THE CAPTION, WHICH IS ONE OF THE TWO SENTENCES THE CLOCK WRITES HERE. It has
   to say WHICH bar, or a picture that never stops moving is a picture you
   cannot place. Tense as the written captions used it: stopped it is a
   prediction of the section you are writing, playing it is a report. */
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
   only ever takes the most room a picture of this record has needed and never
   gives it back mid-record. On the INNER host, because `window.__eightFrozen` empties every
   `[data-live]` and keeps its attributes: a style attribute on the live
   element itself would be part of the frozen picture and A3's byte-identity
   would fail the first time the reserve grew. Inside, it is invisible to the
   gate and still holds the room. */
function scoreReserveTo(px) {
  if (!scoreHost) return;
  /* THE RESERVE IS A HIGH-WATER MARK ONLY WHILE THE RECORD PLAYS — REWRITTEN
     TWICE, 2026-08-27 and 2026-08-28.

     It grows-only so the box cannot shrink under a thumb mid-bar; that law was
     written when the page was one scroll and the score was always laid out.
     Behind a TAB it produced two bugs on consecutive days, both Paul's:

       "The score cuts off at about 150px in height, I can see the top of one
       line and nothing else."   — a panel mounts HIDDEN, abcjs engraves into a
       box with no layout, every height comes back tiny, and the first call
       froze the box there forever.

       "Sometimes score is full but usually when I click the tab it's cut off
       vertically."   — the RACE the first repair left behind. Reveal fired
       once, and if it landed before the engraving had settled it locked a
       half-measured number that grows-only could never correct. Sometimes the
       layout won; usually it did not.

     So: a hidden host reserves nothing, and WHILE THE RECORD IS STOPPED the
     reserve is simply the measurement — it may shrink as well as grow, because
     correcting a wrong box between takes moves nothing anyone is watching. The
     grows-only law still holds under the clock, which is the only place it was
     ever protecting anything. */
  if (!scoreHost.offsetParent && scoreHost.getClientRects().length === 0) return;
  if (playing ? !(px > scoreReserve) : px === scoreReserve) return;
  scoreReserve = px;
  scoreHost.style.height = px + "px";
}
/* THE WATCH: two observers and no one-shot. Intersection catches the tab being
   opened; resize catches the engraving settling AFTER it was opened, which is
   the race above — abcjs lays out asynchronously and the first frame of a
   revealed panel is regularly not the last word on how tall the picture is.
   Neither disconnects: a record change, a rewrite and a width change all
   re-engrave, and each deserves the same correction. Both refuse while the
   clock runs (fitPaper's own guard), both are cheap (a fit, not an engrave),
   and neither is a control. */
let scoreObs = null, scoreRO = null, scoreFitQ = 0;
function scoreRefit() {
  if (playing) return;
  if (scoreFitQ) return;
  scoreFitQ = requestAnimationFrame(() => {
    scoreFitQ = 0;
    if (!scoreHost || playing) return;
    if (!scoreHost.offsetParent && scoreHost.getClientRects().length === 0) return;
    try { fitPaper(); } catch (err) {}
  });
}
function scoreWatch(box) {
  if (!box) return;
  if (scoreObs) { scoreObs.disconnect(); scoreObs = null; }
  if (scoreRO) { scoreRO.disconnect(); scoreRO = null; }
  if (typeof IntersectionObserver === "function") {
    scoreObs = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting && e.boundingClientRect.height) {
        scoreRefit(); return;
      }
    }, { threshold: 0 });
    scoreObs.observe(box);
  }
  if (typeof ResizeObserver === "function") {
    scoreRO = new ResizeObserver(() => scoreRefit());
    scoreRO.observe(box);
    if (scoreSvg && scoreSvg.parentNode) scoreRO.observe(scoreSvg.parentNode);
  }
}
// WHAT THE PICTURE HAD TO BE SHRUNK BY to fit, so the claim above is a number
// somebody can check rather than a promise: 1 is the box's own room, 0.83 is a
// system that needed a fifth more room than the box has.
const scoreFit = () => scoreS;

/* WHICH OCTAVE EACH STAFF IS WRITTEN IN, DECIDED ONCE FOR THE RECORD. The
   score is ONE line of music per voice, so a voice that took a plain treble
   clef in its first four bars (a bar of rests, nothing to decide) and an 8vb
   clef in its next four would change octave in the middle of its own staff —
   measured on the shipped chant, where the schola rests through head 1 and
   sings down at F3 in verse 2. So the decision is made over every pitch the
   voice plays in the WHOLE record and handed to every part.
   (It was written for the ribbon, where the danger was a SEAM between two
   engravings. One engraving cannot change clef mid-staff by accident — but it
   is still the same decision, made in the same place, and taking it out would
   mean `toScore` choosing an octave per call again.)

   IT IS ARITHMETIC, NOT ENGRAVING. `scoreParts` is the section stream folded
   into arrays and `sectionRender` is memoised (measured 2026-08-25: 0.1-0.5ms
   a section on a thirteen-section record), so this walks the record for well
   under a frame and never asks abcjs for anything. Kept per record and width,
   like the reserve, and thrown away with it. */
let scoreOtt = null;
function pinOttava() {
  if (scoreOtt) return scoreOtt;
  const per = DOC.voices.map(() => []);
  for (let si = 0; si < DOC.form.sections.length; si++) {
    const parts = scoreParts(si, 0, scoreLen(si));
    if (!parts) continue;
    parts.forEach((p, i) => { for (const m of p.phrase.midi) {
      if (typeof m === "number") per[i].push(m);
      else if (Array.isArray(m)) for (const x of m) if (typeof x === "number") per[i].push(x);
    } });
  }
  scoreOtt = DOC.voices.map((v, i) => ottavaFor(per[i],
    v.kind === "bass" ? "bass" : v.kind === "drums" ? "perc" : ""));
  return scoreOtt;
}

/* ---------- THE WHOLE RECORD, IN ONE VALUE ------------------------------
   Every voice's part for every section, concatenated in the order the record
   plays them — which is what makes the engraving below ONE system rather than
   a row of them. Three things come out of it and each has exactly one reader:

     parts   one entry per voice, its phrase running the whole record
     secAt   section -> the absolute step it starts on (the clock's own
             position is section-relative; this is what makes it a place on
             the paper)
     divide  the bars a SECTION ends on, so the picture keeps the thin double
             bar the tiles used to draw at their own edges (`close: "||"`).
             A section boundary is the one thing a reader of a very long line
             needs marked, and it is the only mark on it.

   IT IS ARITHMETIC AND NOT ENGRAVING. `sectionRender` is memoised (measured
   2026-08-25: 0.1-0.5ms a section on a thirteen-section record) and
   `scoreParts` is that stream folded into arrays, so this walks the whole
   record for well under a frame and asks abcjs for nothing. */
function recordParts() {
  const NS = DOC.form.sections.length;
  if (!NS || !DOC.voices.length) return null;
  const parts = DOC.voices.map((v) => ({
    name: v.name,
    clef: v.kind === "bass" ? "bass" : v.kind === "drums" ? "perc" : "",
    phrase: { deg: [], oct: [], vel: [], gate: [], midi: [], hold: [] } }));
  const secAt = [], divide = new Set();
  let step = 0, bars = 0;
  for (let si = 0; si < NS; si++) {
    const M = scoreLen(si);
    const got = scoreParts(si, 0, M);
    if (!got) return null;
    secAt[si] = step;
    got.forEach((p, i) => {
      const a = parts[i].phrase, b = p.phrase;
      for (const k of ["deg", "oct", "vel", "gate", "midi", "hold"])
        for (const x of b[k]) a[k].push(x);
    });
    step += M * SCORE_SPB;
    bars += M;
    if (si < NS - 1) divide.add(bars - 1);
  }
  return { parts, secAt, divide, bars, steps: step };
}

/* WHAT THE PAGE WOULD ENGRAVE IF IT ENGRAVED NOW, as a string. This is the
   CHANGE DETECTOR and it is the whole reason a full render can be afforded at
   all: it is compared byte for byte against the ABC the picture on the page is
   already of, and a rebuild that draws the same record again — a resize, a tab,
   pressing play — gets its own SVG back without abcjs being asked for
   anything. */
function buildScore() {
  const R = recordParts();
  if (!R) return null;
  const ott = pinOttava();
  R.parts.forEach((p, i) => { p.ott = ott[i]; });
  let sc;
  try { sc = toScore(R.parts, { key: KEYS[DOC.alphabet.key] || 0,
                                mode: MODES[DOC.alphabet.mode] || MODES.aeolian,
                                stepsPerBar: SCORE_SPB,
                                divide: R.divide, close: "|]" }); }
  catch (err) { return null; }
  if (!sc) return null;
  return { abc: sc.abc, voices: sc.voices, secAt: R.secAt, steps: R.steps,
           bars: R.bars };
}

/* THE GEOMETRY, READ OFF abcjs's OWN TUNE OBJECT and never off the page:

     w      how wide the system is, in the SVG's user units
     x0     where its left margin ends and its music starts
     y0     where the top line of the first staff sits
     map    time -> x, from every element abcjs laid out

   THAT IS THE WHOLE REASON THIS SURFACE CAN MOVE AT ALL. Reading geometry off
   the DOM forces a layout of the whole page, and a layout of THIS page is not
   cheap — measured 2026-08-25 at 390px, a `getBBox()` inside a window turn cost
   110-140ms of main thread against a `renderAbc` of 23ms for the same system.
   `tune.engraver.staffgroups[0]` carries the same numbers in plain JavaScript,
   computed during the render that already happened. */
function paperGeom(tune) {
  const g = tune && tune.engraver && tune.engraver.staffgroups &&
            tune.engraver.staffgroups[0];
  if (!g || !(g.w > 0)) return null;
  // WHERE A MOMENT IS, IN PAPER. Every voice of a system shares one x for one
  // musical instant (that is what barring through MEANS), so the map is built
  // by walking each voice's children and summing their durations — abcjs's own
  // `duration` is in whole notes, so a sixteenth is 0.0625 and our step is
  // `1 / SCORE_SPB`. The staff-extras (clef, meter) are skipped: they sit in
  // the left margin at time zero and their x would put the first note's
  // instant in the gutter. A NOTE BEATS A BARLINE at the same instant — the
  // barline is drawn a notehead's width to the left of the downbeat it
  // precedes, and it is the note that sounds.
  const at = new Map();
  for (const v of g.voices || []) {
    let t = 0;
    for (const c of v.children || []) {
      const extra = /staff-extra/.test(c.type || "");
      if (!extra && c.x != null) {
        const k = Math.round(t * 1e4);
        const bar = /bar/.test(c.type || "");
        const had = at.get(k);
        if (had == null || (had.bar && !bar)) at.set(k, { x: c.x, bar });
      }
      t += c.duration || 0;
    }
  }
  const map = [...at.entries()].map(([k, v]) => [k / 1e4, v.x])
                               .sort((a, b) => a[0] - b[0]);
  if (!map.length) return null;
  const staffs = g.staffs || [];
  /* WHERE THE PAPER STOPS BEING TIME. Everything left of the first note — the
     voice names, the clef, the key signature, the meter — is a LEFT MARGIN,
     and it is the one thing on this surface that has width without duration.
     Measured 2026-08-25 at 390px on a seven-voice reggae: 171px of it, which
     is a bar and a bit. It is cropped off here and drawn ONCE in the box's own
     gutter, out of this same engraving (`gutterFrom`) — which on a picture
     that is one system long is the only clef a reader will see after the first
     four bars have gone past. */
  const x0 = Math.max(0, map[0][1] - 6);
  // …and where the STAFF starts, which is the same margin with the voice
  // names taken off it. The gutter needs both: see `gutterFrom`.
  /* …AND WHERE EACH STAFF SITS, which is the fact a motif label under a PART
     is hung off. `topLine` / `bottomLine` are abcjs's own numbers for the
     outer two lines of staff i, in the same user units as `w` and the map, and
     they are exact: measured against the rendered `path.abcjs-staff` bounding
     boxes at 390px on 2026-08-27, 41.94/72.94 against 41.6/73.3 — the same two
     lines, read without asking the page for a layout. */
  return { w: g.w, x0, sx: Math.max(0, (g.startx || 0) - 2),
           y0: (staffs[0] || {}).absoluteY || 0, map,
           ys: staffs.map((s) => ({ top: +s.topLine || 0,
                                    bottom: +s.bottomLine || 0 })) };
}
// WHERE AN INSTANT IS ON THE PAPER, in the box's own pixels: linear between
// the instants abcjs laid out, which is exact at every one of them, and out to
// the closing barline past the last. Asked in one place, because the steady
// speed below is measured against it and the two may not disagree.
function paperX(step) {
  const map = scoreMap, t = step / SCORE_SPB;
  if (!map || !map.length) return 0;
  const mine = (x) => (x - scoreX0) * scoreS;
  if (t <= map[0][0]) return mine(map[0][1]);
  let lo = 0, hi = map.length - 1;
  while (lo < hi - 1) { const m = (lo + hi) >> 1;
    if (map[m][0] <= t) lo = m; else hi = m; }
  const a = map[lo], b = map[hi];
  if (t >= b[0]) {
    const endT = scoreSteps / SCORE_SPB;
    if (t >= endT || endT <= b[0]) return mine(scoreW);
    return mine(b[1] + (scoreW - b[1]) * (t - b[0]) / (endT - b[0]));
  }
  return mine(a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]));
}

/* ---------- THE STEADY SPEED, AND WHAT IT IS STEADY OVER -----------------
   Paul: "don't scroll the whole thing faster or slower. Just scroll at a
   steady speed." The paper moves at CONSTANT PIXELS PER STEP — it does not
   read the engraving's own x for the sounding instant any more, which is what
   made the old ribbon race through a bar of sixteenths and crawl through a bar
   of whole notes.

   AND THE SPEED IS A FACT ABOUT A SECTION, WHICH IS A MEASUREMENT AND NOT A
   PREFERENCE. One speed for the whole record was written first and measured
   first, because it is the plainest reading of the sentence: printed music is
   not spaced in proportion to time (a bar of sixteenths is wide, a bar of
   whole notes is narrow), so a single speed makes the SOUNDING NOTE drift away
   from wherever you aim it — ahead through sparse music, behind through dense.
   Measured 2026-08-26 at 1280x900 on the precomposed reggae (152 bars, 7
   voices, 13 sections): one speed for the record drifts -1181px to +638px, an
   excursion of 1818px across a box that is 1073px wide. The red notehead — the
   only thing that says "here" now — would spend whole sections off the screen,
   which throws away the other half of the ask.

   ONE SPEED PER SECTION, and the same measurement says it costs nothing: the
   worst section of that record drifts -70px to +35px, and most are inside
   ±45px. A section's bars resemble each other — that is roughly what a section
   IS — so within one, paper and time run together. The intro scrolls at
   6.8px/step and the last chorus at 14.6 because the intro really is half as
   busy; nothing SPEEDS UP as it goes past, and the one place the pace changes
   is the place the music changes. The position is continuous across that seam
   by construction (`paperAt` reads the section the STEP is in, not the section
   the clock last announced), so a boundary is a change of pace and never a
   jump. */
function pinSpeed() {
  const NS = scoreSecAt.length;
  scoreSecX = []; scoreSecV = [];
  for (let i = 0; i < NS; i++) {
    const s0 = scoreSecAt[i], s1 = i + 1 < NS ? scoreSecAt[i + 1] : scoreSteps;
    scoreSecX[i] = paperX(s0);
    scoreSecV[i] = (paperX(s1) - scoreSecX[i]) / Math.max(1, s1 - s0);
  }
  // the record's own average, kept for the readout and for nothing else: what
  // moves the picture is the section's speed, above.
  scoreV = scorePW / Math.max(1, scoreSteps);
  /* THE DRIFT IS THE PRICE, AND IT IS MEASURED RATHER THAN HOPED FOR. Every
     instant abcjs laid out — the same map the position is read from — against
     the steady line the picture will actually move along. It is zero at every
     section boundary by construction, because that is what dividing a
     section's paper by a section's time means. */
  let lo = 0, hi = 0;
  for (const [t, x] of scoreMap || []) {
    const d = (x - scoreX0) * scoreS - paperAt(t * SCORE_SPB);
    if (d < lo) lo = d;
    if (d > hi) hi = d;
  }
  scoreDrift = [lo, hi];
  headFor();
}
// WHICH SECTION A STEP IS IN, and it is the STEP that decides and never the
// clock: the transport announces a new section AT the boundary, and a position
// that waited for the announcement would hold still and then catch up (the
// ribbon did, measured 2026-08-25: two frames stopped, then 29px at once, once
// per section). Interpolating past the end of a section walks straight into
// the next one's paper at the next one's speed, which is where the music is
// going.
function secIdx(step) {
  const at = scoreSecAt;
  if (!at.length) return 0;
  let lo = 0, hi = at.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1;
    if (at[m] <= step) lo = m; else hi = m - 1; }
  return lo;
}
// WHERE THE PAPER IS AT A STEP, at the steady speed. One multiplication, and
// it is the only arithmetic between the clock and the transform.
function paperAt(step) {
  const i = secIdx(step);
  return (scoreSecX[i] || 0) + (scoreSecV[i] || 0) * (step - (scoreSecAt[i] || 0));
}
/* WHERE THE EAR IS AIMED, WITH THE DRIFT ALREADY KNOWN. The aim is
   `SCORE_HEAD` of the box — a quarter in, three quarters of what is coming —
   and it is then moved as little as the record's own drift demands so that the
   furthest-behind note is still on the paper at the left and the
   furthest-ahead one is still on it at the right. A record whose drift is
   wider than the box cannot have both, and then the excursion is CENTRED,
   which loses the least. There is nothing to write to the page here: the aim
   is a number `place` subtracts, and the line it used to draw is gone. */
function headFor() {
  const room = Math.max(1, scoreBoxW - scoreGutW);
  const [lo, hi] = scoreDrift;
  const aim = scoreGutW + SCORE_HEAD * room;
  const min = scoreGutW + SCORE_PAD - lo;         // keep the latest note on
  const max = scoreGutW + room - SCORE_PAD - hi;  // …and the earliest
  scoreHeadPx = max >= min ? Math.min(max, Math.max(min, aim))
                           : scoreGutW + room / 2 - (lo + hi) / 2;
}

/* ---------- THE RENDER, AND THE ONLY THING THAT TRIGGERS IT ---------------
   "you probably have to fully render the whole score each time something
   changes." So: this is called when the block is built (a draw, a record
   swap, a resize) and when a grid edit changes a note (`scoreChanged`), and
   from nowhere on the clock. The first thing it does is find out whether
   anything actually changed, which on most calls it has not. */
function scoreRender() {
  if (!scoreHost || !scorePaper) return;
  const built = buildScore();
  // A RECORD THAT CANNOT BE FOLDED KEEPS THE PICTURE IT HAS — and takes the
  // loader down, because a box that says it is working when nothing is going
  // to happen is worse than a stale picture.
  if (!built) { loading(false); return; }
  scoreSecAt = built.secAt;
  scoreSteps = built.steps;
  if (built.abc === scoreAbc && scoreSvg) {
    // THE SAME MUSIC, SO THE SAME PICTURE. It is re-hung rather than re-drawn:
    // a rebuild of this block makes a new host, and the SVG is a value that
    // outlives it. The numbers are taken again because the BOX may have moved
    // even though the music did not.
    if (!scoreVoices.length) scoreVoices = indexVoices(built.voices);
    if (scoreSvg.parentNode !== scorePaper) scorePaper.replaceChildren(scoreSvg);
    scoreEls = null;
    fitPaper();
    // …AND THE LOADER COMES DOWN EVEN THOUGH NOTHING WAS DRAWN. `scoreChanged`
    // raises it on the first keystroke, before anything knows whether the
    // music moved, and plenty of edits do not move it: a velocity is not in
    // the notation at all, so nudging one arrives here with a byte-identical
    // ABC. Without this line that edit would leave the word up forever.
    loading(false);
    return;
  }
  /* THE LOADER PAINTS FIRST, WHICH IS THE WHOLE OF ITS JOB. A render blocks
     the main thread for as long as it takes, so a loader shown in the same
     task as the render is a loader nobody ever sees — the only frame the
     browser draws is the finished one. Two frames of rAF is the page's own
     idiom for this and it is quoted rather than reinvented (ui/atlas.js
     `pick`: "the sentence paints FIRST and the work happens on the second
     frame — otherwise the only frame the browser renders is the finished one
     and the box looks frozen for half a second with no explanation"). */
  const heavy = predictMs(built) >= SCORE_LOADER_MS;
  loading(heavy);
  const go = () => engraveScore(built);
  if (heavy) requestAnimationFrame(() => requestAnimationFrame(() => whenIdle(go)));
  else whenIdle(go);
}
// WHAT THE NEXT RENDER WILL COST, in milliseconds, before it is paid: bars
// times voices times what a bar of one voice cost last time (see
// `scorePerCell`). It is asked before the ABC is even compared, because the
// answer decides whether a reader is told to wait.
const predictMs = (built) =>
  built.bars * Math.max(1, DOC.voices.length) * scorePerCell;
/* THE LOADER, WHICH MAY NOT RESIZE THE BOX. It is one absolutely-positioned
   word over the paper, inside the one `[data-live]` and holding no control —
   the box's height is `scoreReserve` and nothing here touches it, so the
   guarantee that this block never changes height survives the loader exactly
   as it survives the music (test/motif-frozen.js A5). */
function loading(on) {
  if (!scoreLoad) return;
  scoreLoad.hidden = !on;
  if (scoreRun) scoreRun.classList.toggle("is-waiting", !!on);
}
/* WHEN A RENDER IS ACTUALLY RUN, AND WHY IT IS NOT NOW. abcjs measures text by
   putting it in the document and asking how big it came out, so a render
   forces a LAYOUT of whatever is dirty — and on the beat, everything is: the
   playhead has just marked four grids and the board has just moved seven
   meters. Measured 2026-08-25 at 1280x900, engraving straight off the tick:
   27, 39, 40, 75 and 91ms for four bars, rising as the page got busier.
   `requestIdleCallback` runs AFTER the frame has been laid out and painted, so
   the layout abcjs asks about is already clean and the render pays for itself
   alone. `setTimeout` is the fallback for Safari, where requestIdleCallback
   has only shipped since 16.4 and this file supports older. */
function whenIdle(fn) {
  // STOPPED, IT DRAWS NOW. The dirty layout this dodges is the BEAT's, and
  // when nothing is sounding there is none; waiting would only mean the box
  // taking its room up to a second after `draw()` returned, which is the one
  // thing this axis may not do (see staffBox — a host that grows late is a
  // page that jumps).
  if (!playing || !window.requestIdleCallback) { fn(); return; }
  window.requestIdleCallback(fn, { timeout: 1200 });
}
// THE RENDER ITSELF, on the promise the vendored abcjs arrives on. The LAST
// music asked for is the true one: a second edit can land while the library is
// still being fetched, and the picture must be of the record as it is now.
function engraveScore(built) {
  const want = built.abc;
  scoreAbc = want;
  loadStaffLib().then((A) => {
    if (!A || scoreAbc !== want || !scorePaper || !scorePaper.isConnected) return;
    let tune;
    try {
      // `staffwidth: 1` IS THE NATURAL SPACING, not a mistake. abcjs justifies
      // a system OUT to the width it is given and never squeezes it in, so a
      // width smaller than the music needs is the way to ask for the width the
      // music needs (measured 2026-08-25: four dense bars asked for 200px came
      // back 907px). A whole record asked for one pixel comes back as wide as
      // the record is, which is exactly the paper this box scrolls.
      const t0 = performance.now();
      tune = A.renderAbc(scorePaper, want, { add_classes: true, staffwidth: 1 })[0];
      const ms = +(performance.now() - t0).toFixed(1);
      // WHAT IT COST, kept because it is the number this round turns on, and
      // fed back into the prediction so the loader's threshold is this
      // device's own arithmetic rather than a developer machine's.
      scoreMs.push(ms);
      if (scoreMs.length > 20) scoreMs.shift();
      const cells = built.bars * Math.max(1, DOC.voices.length);
      if (cells > 0) scorePerCell = ms / cells;
    // A RENDER THAT DID NOT LAND OWNS NOTHING. `scoreAbc` is the race token
    // AND the claim "this is what is on the page", so a failure has to give it
    // back or the next call would compare against music nobody ever drew.
    } catch (err) { scoreAbc = ""; loading(false); return; }
    scoreEngraves++;
    const g = paperGeom(tune);
    if (!g) { scoreAbc = ""; loading(false); return; }
    const svg = scorePaper.querySelector("svg");
    scoreSvg = svg;
    scoreH = svg ? Math.ceil(+svg.getAttribute("height") || 0) : 0;
    scoreW = g.w; scoreX0 = g.x0; scoreSX = g.sx || 0;
    scoreMap = g.map;
    scoreStaffY = g.ys || [];
    scoreVoices = indexVoices(built.voices);
    // THE CURTAINS, HUNG WHILE THE PICTURE IS OFF THE PAGE. `scoreS` is not
    // decided until `fitPaper` and the chunk spans are measured in box pixels,
    // so the grouping happens here and the spans are taken again down there.
    if (svg) { svg.remove(); chunkPaper(svg); scorePaper.append(svg); }
    scoreEls = null;
    scoreLit = [];                 // the old picture's red notes went with it
    scoreGutW = 0;
    if (scoreGut) scoreGut.dataset.k = "";
    fitPaper();
    loading(false);
  }).catch(() => { loading(false); });
}

/* THE PICTURE TAKES ITS PLACE. One engraving, so there is no aligning to do
   and nothing to lay out: the SVG is given a viewBox and an explicit size so
   the whole thing can be scaled by one factor — the box's height divided by
   the picture's own — and the margin is cropped off the left. Everything the
   ribbon did here to make separate tiles agree with each other is gone,
   because they were the misalignment. */
function fitPaper() {
  if (!scoreSvg || !scoreH) return;
  scoreSvg.setAttribute("viewBox", "0 0 " + Math.ceil(scoreW + 8) + " " + scoreH);
  scoreSvg.setAttribute("preserveAspectRatio", "xMinYMin meet");
  // THE BOX IS MEASURED ONLY WHEN THE CLOCK IS NOT RUNNING. Taking a height is
  // harmless; APPLYING one is a layout change, and a layout change on the clock
  // is the whole thing this page refuses to do. Stopped — at boot, and after
  // any rebuild your own gesture caused — the block may take the room its
  // picture needs; playing, the picture fits the room it has.
  /* …AND THE ROOM THE MOTIF LABELS NEED IS TAKEN WITH IT, AT CREATION. The
     labels hang under each staff (`motifLabels`), and between two staves the
     engraving's own leading is room enough — but under the LAST staff there is
     only whatever bottom margin abcjs left, and a label drawn past the box's
     edge is a label the reader never sees. So the box asks for the picture's
     height plus exactly what the last staff is short of, once, before anything
     is drawn: nothing appears later and nothing moves under a thumb, which is
     the same law `scoreReserveTo` was written for. It is measured off the
     picture and is usually zero (the chant leaves 45.7px under its last staff
     and a label is 15). */
  const lastY = scoreStaffY.length
    ? scoreStaffY[scoreStaffY.length - 1].bottom : scoreH;
  const motRoom = Math.max(0, SCORE_MOT_H - Math.max(0, scoreH - lastY));
  if (!playing) scoreReserveTo(scoreH + motRoom);
  scoreS = scoreReserve && scoreH > scoreReserve ? scoreReserve / scoreH : 1;
  scoreSvg.setAttribute("width", (scoreW + 8) * scoreS);
  scoreSvg.setAttribute("height", scoreH * scoreS);
  // THE CROP: the drawing is pushed left by its own margin, which is paper
  // with no time in it.
  scoreSvg.style.marginLeft = (-scoreX0 * scoreS) + "px";
  scorePW = (scoreW + 8 - scoreX0) * scoreS;
  scorePaper.style.width = scorePW + "px";
  // the curtains were hung before the scale was known, and their spans are in
  // the box's pixels — so they are taken again here, where `scoreS` is final
  for (const c of scoreChunks) {
    const k = +c.g.getAttribute("data-c");
    c.x0 = paperX(k * SCORE_CHUNK * SCORE_SPB);
    c.x1 = paperX(Math.min(scoreSteps, (k + 1) * SCORE_CHUNK * SCORE_SPB));
  }
  scoreShown = "";
  gutterFrom();
  pinSpeed();
  // …and the motif labels, which are geometry over this same paper and so
  // are re-hung exactly when the paper is (see `motifLabels`, the deck).
  motifLabels();
  place(true);
}

/* THE CURTAINS, HUNG ONCE PER ENGRAVING. abcjs writes its own measure number
   onto every element it draws (`abcjs-m17`, with `add_classes`), and the whole
   system is one flat list of nine thousand of them under a single wrapper. So
   the bars are gathered into groups of `SCORE_CHUNK` — a `<g>` per chunk, in
   order — and `curtain` below hides the ones the box is nowhere near.

   THE SIXTEEN ELEMENTS WITH NO MEASURE ON THEM ARE LEFT WHERE THEY ARE, and
   they are exactly the ones that must never be hidden: one full-width path per
   staff, the bracket down the left, and the voice names. They are also why
   this is cheap — the STAVES do not chunk, so a chunk is only its noteheads,
   stems, beams and barlines.

   …AND THE MARGIN IS LEFT WITH THEM, WHICH IS A BUG FIX AND NOT A TIDY-UP
   (2026-08-27, measured on the rendered page). The sentence above was written
   from a reading of the class list and the class list disagrees: abcjs stamps
   the clef and the meter `abcjs-staff-extra abcjs-clef abcjs-l0 **abcjs-m0**`
   — they carry the FIRST MEASURE's number, because that is the measure they
   are drawn in front of. So they were swept into chunk 0 like any notehead,
   and `gutterFrom` — which drops every chunk out of its clone to keep the copy
   at sixteen elements instead of nine thousand — dropped them with it. THE
   PINNED GUTTER HAS NEVER SHOWN A CLEF, A KEY OR A METER at any width: at
   390px on the shipped chant it was 52px of blank staff, which is exactly
   Paul's "I don't know which instrument or key I'm looking at" (2026-08-27).
   A `staff-extra` is margin and not music — `paperGeom` already skips these
   same elements when it builds the time map, for the same reason — so the test
   is the one that file already makes, said here too.

   IT IS DONE OFF THE PAGE. Nine thousand `append` calls on a live SVG is nine
   thousand invalidations of a picture that is already the biggest thing on the
   page; detached it is one. The node comes back the moment it is grouped, and
   the render that follows it is the first time the browser sees any of it. */
function chunkPaper(svg) {
  scoreChunks = []; scoreShown = "";
  const wrap = svg.querySelector(".abcjs-staff-wrapper");
  if (!wrap) return;
  const groups = new Map();
  for (const c of [...wrap.children]) {
    const cls = c.getAttribute("class") || "";
    if (/(?:^| )abcjs-staff-extra(?: |$)/.test(cls)) continue;   // margin, not music
    const m = /(?:^| )abcjs-m(\d+)(?: |$)/.exec(cls);
    if (!m) continue;
    const k = Math.floor(+m[1] / SCORE_CHUNK);
    let g = groups.get(k);
    if (!g) { g = S("g", { "data-c": k }); groups.set(k, g); }
    g.append(c);
  }
  for (const [k, g] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    wrap.append(g);
    // WHERE THE CHUNK IS, IN THE SAME PIXELS `place` MOVES IN — off the map,
    // not off the page: a `getBBox` here would cost the layout this whole
    // surface is built to avoid.
    const b0 = k * SCORE_CHUNK * SCORE_SPB;
    const b1 = Math.min(scoreSteps, (k + 1) * SCORE_CHUNK * SCORE_SPB);
    scoreChunks.push({ g, x0: paperX(b0), x1: paperX(b1) });
  }
}
/* AND THE CURTAIN ITSELF, WHICH RUNS ON THE FRAME AND WRITES ALMOST NEVER.
   What is shown is everything within half a box either side of what the box
   holds — a bar and a half of margin at a phone's width, so a chunk is always
   raised well before it is needed and dropped well after. The shown SET is
   kept as a string and compared: at 40px a second a chunk boundary goes past
   every few seconds, and between those there is nothing to write. */
function curtain(x) {
  if (!scoreChunks.length) return;
  const lo = x - scoreBoxW / 2, hi = x + scoreBoxW * 1.5;
  let a = -1, b = -1;
  for (let i = 0; i < scoreChunks.length; i++) {
    const c = scoreChunks[i];
    if (c.x1 >= lo && c.x0 <= hi) { if (a < 0) a = i; b = i; }
  }
  const want = a + ":" + b;
  if (want === scoreShown) return;
  scoreShown = want;
  for (let i = 0; i < scoreChunks.length; i++)
    scoreChunks[i].g.style.display = i >= a && i <= b ? "" : "none";
}

/* THE TWO INDEXES THE RED NOTEHEADS ARE READ THROUGH, built once per render.
   `lightScore` runs four times a beat, and on a whole record the lists it
   walks are the record's: 152 bars of nine voices is some twenty thousand
   notes, and a linear scan of that per voice per tick is the difference
   between a picture and a stutter. So the answer is precomputed in the shape
   the question has:

     byStep   step -> which note of this voice is SOUNDING then (-1 for none),
              held notes included, which is what makes a pad stay red for a
              whole bar
     byNote   note -> which glyphs are it, because one note can be several
              (a tie across a barline is two noteheads and one sound)

   Both are arrays of small integers over the record, which is tens of
   kilobytes and is thrown away with the picture. */
function indexVoices(voices) {
  return voices.map((v) => {
    const byStep = new Int32Array(Math.max(1, scoreSteps)).fill(-1);
    v.notes.forEach((nt, i) => {
      const end = Math.min(scoreSteps, nt.at + Math.max(1, nt.len));
      for (let s = Math.max(0, nt.at); s < end; s++) byStep[s] = i;
    });
    const byNote = [];
    v.glyphs.forEach((ni, g) => { (byNote[ni] || (byNote[ni] = [])).push(g); });
    return { name: v.name, notes: v.notes, glyphs: v.glyphs, byStep, byNote };
  });
}

/* THE MARGIN, DRAWN ONCE AND PINNED, AND IT MATTERS MORE THAN IT DID. On a
   picture that is one system long, the clef and the key are drawn exactly
   once, at the very beginning, and four bars later they have scrolled away for
   good. So the box keeps a COPY of them: a clone of the engraving's own left
   margin, sitting at the left edge with the music sliding behind it. It is a
   clone and not a render — the same picture, so the staves cannot fail to line
   up — and it is taken once per record and width. */
function gutterFrom() {
  if (!scoreGut || !scoreSvg || !scoreX0) return;
  if (scoreGut.dataset.k === scoreReserveKey && scoreGut.firstChild) return;
  /* WHAT A NARROW SCREEN KEEPS, REVERSED 2026-08-27 — Paul: *"The score cuts
     off in the wrong place on mobile so I don't know which instrument or key
     I'm looking at… I wonder what could work here maybe we put the key above
     the score."*

     THIS BLOCK USED TO SAY: *"the reggae record's margin is 171px of a 390px
     box — 44% of the paper — and 86px of it is the words `stab`, `vocal`,
     `simple` and `kit`. Past a third of the box the clone is cut at the
     STAFF's own start instead (abcjs's `startx`, which is exactly where the
     names stop), so what stays pinned is the clef, the key and the meter —
     the three things a reader cannot infer — and the names go with the music."*
     The measurement behind the third is kept; both halves of the conclusion
     were wrong, and each was wrong for its own reason:

     1  IT PINNED NOTHING. The clef and the meter carry `abcjs-m0` and were
        being dropped out of the clone with the chunks (see `chunkPaper`,
        2026-08-27) — so the 52px it cost at 390px on the chant held five
        blank staff lines. That is the bug half, and it is fixed there.
     2  AND THE CHOICE WAS THE WRONG WAY ROUND. A key can be said in WORDS
        above the picture and now is (`keyLine`, Paul's own suggestion); which
        staff is the bass CANNOT — it is a fact about a row of the picture,
        and the only place to say it is beside that row. So when the whole
        margin will not fit, it is now the NAMES that stay pinned and the
        clef/key/meter that go with the music.

     THE CUT IS AT ONE OF THE ENGRAVING'S OWN LANDMARKS, never at a number
     typed here: `scoreX0` is where the music starts (names + clef + key +
     meter) and `scoreSX` is abcjs's `startx`, where the staff lines — and so
     the clef — begin, which is exactly where the names stop. Measured at 390px
     on the shipped chant: whole margin 135.7px (37% of a 366px box, over the
     third), names 83.7px (23%). So the phone trades 83.7px for two part names
     it can read the whole way through the record, against 52px that said
     nothing — 31.7px of paper, about half a bar at this record's spacing.
     A wide screen is unchanged and now genuinely keeps both: at 1280 the whole
     136px margin fits inside the third, and after the chunk fix the clef and
     the meter are in it. */
  const full = scoreX0 * scoreS;              // names + clef + key + meter
  const names = scoreSX * scoreS;             // …and the half of it that is names
  const room = scoreBoxW / 3;
  // the widest landmark that fits, and never more than the third: a record
  // whose NAMES alone overrun a phone gets them clipped at the third rather
  // than given the paper, and a name is left-aligned, so what survives the
  // clip is the beginning of the word — enough to tell two parts apart.
  const keep = full <= room ? full : Math.min(names, room);
  const c = scoreSvg.cloneNode(true);
  // THE COPY KEEPS THE MARGIN AND THROWS THE MUSIC AWAY. What is pinned here
  // is the names, and — when the margin fits — the clef, the key and the
  // meter with them: every one of them a `staff-extra` element, which is
  // exactly what `chunkPaper` now leaves out of the chunks, so the chunks can
  // all be dropped out of the clone. It is the difference between a second
  // copy of nine thousand elements sitting behind the music and a copy of
  // sixteen. The clone is never SHIFTED any more — it starts at the left edge
  // of the picture and the box's own width is what cuts it — because both
  // landmarks are measured from that edge and a margin-left of anything but
  // zero would put the names off the screen, which is what it did.
  for (const g of c.querySelectorAll("g[data-c]")) g.remove();
  c.style.marginLeft = "0px";
  scoreGut.replaceChildren(c);
  scoreGut.dataset.k = scoreReserveKey;
  scoreGutW = Math.max(0, Math.round(keep));
  scoreGut.style.width = scoreGutW + "px";
}

// HOW LONG THE SOUNDING SECTION IS, in measures, asked in one place. Every
// reader below needs it and none of them may keep a copy: `SONG[si].len` moves
// the moment the form does.
const scoreLen = (si) => Math.max(1, (SONG[si] || { len: 1 }).len | 0);

/* THE TWO SENTENCES, on a landing. Nothing here engraves and nothing here
   measures: a caption and a syllable line, both text, both inside the one
   `[data-live]`, and both saying which BAR — which is the half of "the current
   measure and the next" that words can carry when the picture is a scroll
   rather than a page. */
function landed(si) {
  const text = scoreCaption(si, editSec(), scoreMeas, scoreLen(si));
  if (scoreCap && scoreCap.textContent !== text) scoreCap.textContent = text;
  // …and the syllables, on the same landing and under the same law: TEXT ONLY,
  // inside the one `[data-live]`, never a control.
  const syl = syllLine(si, scoreMeas);
  if (scoreSyl && scoreSyl.textContent !== syl) scoreSyl.textContent = syl;
}

/* ---------- WHERE THE MUSIC IS, THIS FRAME -------------------------------
   `scoreStep` is the pattern step the last "pos" tick reported and
   `scoreStamp` is when it said so; between ticks the position is INTERPOLATED
   against the wall clock at the record's own step rate. That is the whole of
   "smooth, not stepped": the scroll follows the beat position continuously and
   not the barline.

   IT CANNOT RUN AWAY. The feed ticks at least once a beat (audio/live.js
   `tickPos`, a 60ms interval), so the interpolation is never asked for more
   than a beat of guessing and is clamped to exactly that; a stall shows as the
   paper holding still, which is the truth, rather than as it sliding off into
   music that is not sounding. */
let scoreStep = 0, scoreStamp = 0, scoreRate = 0, scoreRaf = 0;
function stepNow() {
  if (!playing) return scoreStep;
  const dt = (performance.now() - scoreStamp) / 1000;
  return scoreStep + Math.max(0, Math.min(dt, 1 / Math.max(0.001, beatRate()))) * scoreRate;
}
// beats a second, from the rate the last tick was measured at — one place, so
// the clamp above and the walk cannot disagree
const beatRate = () => scoreRate / 4;
/* WHERE THE EAR IS ON THE PAPER, as ONE number: the step the record started
   this section on plus the step the clock is at inside it. The transport
   reports a SECTION-RELATIVE position and the paper is one long line, so this
   is the join between them — and it is also what makes a section boundary a
   non-event. The clock announces the new section AT the boundary, so between
   the last beat of a section and that announcement the interpolation simply
   walks on off the end of the section it knows about and lands, to within a
   pixel or two, exactly where the next section's paper begins. (Measured
   2026-08-25 on the ribbon, which had to be taught this: without it the
   picture stood still for two frames and then moved 29px at once, once per
   section.) */
function stepAbs() {
  const at = scoreSecAt[Math.max(0, scoreSec)] || 0;
  return at + (playing ? stepNow() : 0);
}
/* AND THE PICTURE IS PUT WHERE THAT SAYS, AT THE STEADY SPEED. One
   multiplication: the position in steps times pixels per step, less the aim.
   The engraving's own x for that instant is NOT read here and that is the
   change this round is — see `pinSpeed`. What is read from the engraving is
   the drift, once, when the picture lands. */
function place(force) {
  /* AND NOT AT ALL WHEN THE SCORE IS NOT ON THE PAGE (2026-08-27). Both views
     this function moves live in the Score tab, and eight tabs out of nine that
     panel is `display: none` — a transform written onto a box that is not laid
     out is a write nobody can see, sixty times a second, for as long as the
     record plays. The walk itself is left running rather than torn down and
     restarted: `stepNow` is arithmetic on the three numbers the "pos" feed
     writes, so there is no state to lose and nothing to resynchronise. Coming
     back to the tab lands the paper where the ear is because `showTab` calls
     `place(true)` on the way in. */
  if (openTab !== "Score") return;
  // THE ONE CLOCK, TWO VIEWS (score-deck.html decision 3): the piano roll is
  // repainted from the same frame walk that moves the paper, off the same
  // `stepAbs()`, so flipping the tab can never lose the place — there is only
  // one place. `drawRoll` no-ops unless the roll view is up.
  if (deckView === "roll") drawRoll(stepAbs());
  if (!scoreRun || !scoreHost || !scoreMap) return;
  const x = paperAt(stepAbs()) - scoreHeadPx;
  // A WRITE PER FRAME, AND THE GUARD IS ONLY AGAINST WRITING THE SAME NUMBER.
  // At the chant's tempo the paper moves 41px a second — 0.68px per frame at
  // 60Hz — so a half-pixel threshold skipped every other frame and turned 60
  // frames a second into 30 (measured 2026-08-25: 547 of 1199 frames moved).
  // A transform write on a composited layer is a matrix, not a paint.
  if (!force && scoreX != null && Math.abs(x - scoreX) < 0.02) return;
  scoreX = x;
  // …and the bars nowhere near the box are taken off the paint (see `curtain`),
  // which is the difference between 27 and 58 frames a second on a record that
  // is eight screens wide.
  curtain(x);
  // translate3d and not `left`: a transform is composited and touches no
  // layout, which is what lets this run every frame on a page that is 16,000px
  // tall with a thousand controls on it.
  scoreRun.style.transform = "translate3d(" + (-x).toFixed(2) + "px,0,0)";
}
function scoreWalk() {
  scoreRaf = 0;
  if (!playing) return;
  place();
  scoreRaf = requestAnimationFrame(scoreWalk);
}
function scoreStartWalk() {
  if (!scoreRaf) scoreRaf = requestAnimationFrame(scoreWalk);
}
function scoreStopWalk() {
  if (scoreRaf) cancelAnimationFrame(scoreRaf);
  scoreRaf = 0;
}

/* WHAT THE CLOCK SAYS, AND IT SAYS IT ONCE A BEAT. Everything the score does
   on the transport feed is here: which section is sounding and which step it
   is on. NO ENGRAVE — that is the point of one picture; no layout; and no DOM
   write except the two sentences, since the picture itself is moved by the
   walk above. */
function repaintScore() {
  if (!scoreHost) return;
  const ei = editSec();
  // WHAT IS SOUNDING, OR — STOPPED — THE EDIT POSITION. A section that appeared
  // on play would be the interface changing, which is the thing Paul objected
  // to in the first place, so stopped it shows the section you are writing from
  // its first bar and says so. The block is on the page, the same size, whether
  // the transport runs or not.
  const si = playing && atSec >= 0
    ? Math.min(atSec, DOC.form.sections.length - 1) : ei;
  if (!playing) { scoreStep = 0; scoreMeas = 0; scoreStopWalk(); }
  scoreSec = si;
  landed(si);
  place(true);
  if (playing) scoreStartWalk();
}

/* A MOTIF EDIT MOVES THE SCORE, AND IT IS THE ONLY THING THAT DOES. `edited`
   exists so that nudging one degree does not rebuild the page under your
   finger (see it, above) — and the price of that was a score showing music the
   record no longer has. "fully render the whole score each time something
   changes" is the fix and this is the seam.

   IT WAITS FOR YOUR HAND TO STOP. A slider dragged through ten values is ten
   edits, and ten whole-record renders is ten freezes for nine pictures nobody
   asked to see. So the loader goes up at the first edit and the render happens
   a moment after the last one — which is also what makes the wait honest: what
   you are waiting for is the note you just wrote. */
const SCORE_SETTLE = 250;
let scoreSoon = 0;
function scoreChanged() {
  if (!scoreHost) return;
  /* AND NOT WHEN THE SCORE IS BEHIND ANOTHER TAB (2026-08-27). An edit made on
     the Motif tab used to land here and engrave the whole record, because the
     whole page was one scroll and the score was three screens down it. Now it
     is the Score tab, `display: none` eight tabs out of nine, and engraving it
     there is wrong twice over: it is the expensive work the tab shell exists
     to defer (a whole-record render is the most expensive thing this page
     does), and it would MEASURE A ZERO-WIDTH BOX — `fitPaper` and
     `reserveScoreCaption` both read a bounding rect, and a picture fitted to
     a box that is not laid out is not a picture.
     NOTHING IS LOST, because `draw()` has already marked the Score tab stale
     and `buildTab` rebuilds it whole — engraving included — the moment it is
     next opened. That is the mount-on-demand law stated from the other end:
     the panel you are not looking at is not drawn, and it is not drawn WRONG
     either. */
  if (openTab !== "Score") { tabStale.add("Score"); return; }
  loading(true);
  clearTimeout(scoreSoon);
  scoreSoon = setTimeout(() => { scoreSoon = 0; scoreRender(); }, SCORE_SETTLE);
}

/* THE RED NOTEHEADS, WHICH ARE NOW THE ONLY THING THAT SAYS "HERE". Paul,
   2026-08-26: "highlight notes in red. Get rid of the playhead." The playhead
   line is gone (there is no element for it any more); this is what replaced
   it, and it was already here — the same red fill, on the same surface, lit by
   the same `lightStep` that lights the four grids, so there is one clock and
   one marker and not a second one written for this round.

   AND IT SAYS MORE THAN THE LINE COULD. A line points at an instant; this
   points at the NOTES, so a chord in four staves is four red noteheads, a pad
   holding a whole note stays red for the whole bar, and a voice that is
   resting says nothing at all — which is the truth about who is playing.

   IT IS THE ONLY PLAYHEAD ON NOTATION. The written staves have never had one,
   because "a notehead turning red under your finger is the picture changing
   while you write on it" (2026-08-24). Same rule about where it may be
   written: inside `[data-live]`, by the clock, and nowhere else.

   THE ELEMENT LIST IS CACHED PER RENDER. `abcjs-vN` is abcjs's own per-voice
   class, N counting the `V:` lines in the order ui/abc.js toScore declares
   them — which is the order of `parts`, which is the order of `DOC.voices`. */
function lightScore(abs) {
  for (const x of scoreLit) x.style.fill = "";
  scoreLit = [];
  if (abs < 0 || !scorePaper || !scoreVoices.length || !scoreSteps) return;
  // THE STEP ON THE PAPER, not in the section: the same join `stepAbs` makes,
  // made off the number the playhead was handed rather than off the clock, so
  // the note that is red is the note `lightStep` says is sounding. A tick that
  // runs past the end of its section walks into the next section's paper,
  // which is where the music is going.
  const s = (scoreSecAt[Math.max(0, scoreSec)] || 0) + Math.floor(abs);
  if (s < 0 || s >= scoreSteps) return;
  if (!scoreEls)
    scoreEls = scoreVoices.map((v, i) =>
      [...scorePaper.querySelectorAll(".abcjs-note.abcjs-v" + i)]);
  scoreVoices.forEach((v, vi) => {
    const n = v.byStep[s];
    if (n < 0) return;
    const els = scoreEls[vi] || [], gs = v.byNote[n] || [];
    // the CLOCK's own paint, off the one token owner (nu.css --clock). A style
    // property and not the old `setAttribute("fill", "#c00")`, because an
    // attribute cannot resolve var() and a second red would be a fifth paint.
    for (const g of gs) if (els[g]) {
      els[g].style.fill = "var(--clock)";
      scoreLit.push(els[g]);
    }
  });
}

/* THE BLOCK ITSELF. A heading that never changes, then ONE `[data-live]`
   element holding a caption, the picture and the syllable line — and NOT ONE
   CONTROL, which is the law this page lives under (`test/motif-frozen.js` A1)
   and also the honest design: it is a picture of the music. It cannot be
   scrolled, zoomed, muted or soloed here, because every one of those is a
   control and a control inside a live block is how the frozen half stops being
   frozen. (The loader is a word, not a button: it says the box is working and
   there is nothing to press.)

   AND IT IS NOT A SCROLLING PANE, WHICH IS THE TRAP THIS REPO HAS PAID FOR
   TWICE. The atlas's `touch-action: pan-y` left 28 of 62 places unreachable,
   and the grid rotation existed partly to delete a horizontal pane that made
   tapping snap. The box is `overflow: hidden` and its contents are moved by a
   transform: there is no scroll container here at all, so a finger dragged
   over the score — up, down or sideways — does exactly what a finger dragged
   over any other picture on the page does, which is scroll the page. The
   score's own motion is the clock's and nobody else's. */
function scoreBlock(parent) {
  // (the `heading(parent, "the score")` that opened this block moved to the
  //  deck's own <h2> on 2026-08-27 with the block itself — one heading over
  //  the two views, not one per view)
  // THE KEY, ABOVE THE SCORE, AND OUTSIDE THE LIVE BLOCK. It is a fact about
  // the RECORD and not about the instant, so the clock never touches it and it
  // may not sit where the clock writes (`keyLine`, and the A1 law).
  const kl = el("p", keyLine(), "nu-hint nu-keyline");
  parent.append(kl);
  const live = el("div");
  live.dataset.live = "score";
  live.className = "nu-score";
  const cap = el("p");
  cap.className = "nu-hint";
  const box = el("div", null, "nu-ribbon");
  const run = el("div", null, "nu-run");
  const paper = el("div", null, "nu-paper");
  const gut = el("div", null, "nu-gutter");
  const load = el("p", "engraving the whole score…", "nu-load");
  load.hidden = true;
  run.append(paper);
  box.append(run, gut, load);
  const syl = el("p");
  syl.className = "nu-hint nu-syll";
  live.append(cap, box, syl);
  parent.append(live);
  scoreCap = cap; scoreHost = box; scoreSyl = syl; scoreRun = run;
  scoreWatch(box);
  scorePaper = paper; scoreLoad = load;
  scoreGut = gut; scoreGutW = 0;
  scoreMots = null;              // the motif-label layer belongs to the old run
  scoreLit = []; scoreEls = null; scoreSec = -1; scoreX = null;
  const key = DOC.voices.length + "@" + Math.round(window.innerWidth);
  if (key !== scoreReserveKey) { scoreReserveKey = key; scoreReserve = 0; }
  scoreOtt = null;                 // a new record decides its own octaves
  // the room this record's score has already been measured to need, put back
  // before anything draws, so a rebuild does not collapse the page and then
  // grow it again under a thumb
  if (scoreReserve) box.style.height = scoreReserve + "px";
  scoreBoxW = box.clientWidth || Math.round(window.innerWidth);
  reserveScoreCaption();
  // THE PICTURE, WHICH IS USUALLY THE ONE IT ALREADY HAS. `scoreRender` starts
  // by comparing the ABC it would draw against the ABC on the page, so a
  // rebuild for any reason other than a changed note costs a fold of the
  // record and no engraving at all.
  scoreRender();
  repaintScore();
}

/* THE KEY, ABOVE THE SCORE (2026-08-27) — Paul: *"The score cuts off in the
   wrong place on mobile so I don't know which instrument or key I'm looking
   at… I wonder what could work here maybe we put the key above the score."*

   HIS OWN SUGGESTION, AND IT PAYS FOR THE OTHER HALF OF THE FIX. A key
   signature is three glyphs in a margin that a phone cannot afford to pin;
   said in WORDS it is thirty characters over the picture, costs one line of
   height that is taken at creation, and it frees the pinned gutter to carry
   the one thing words above the picture cannot — which staff is which
   (`gutterFrom`, reversed the same morning).

   EVERY WORD IN IT IS THE RECORD'S OWN, TAKEN WHERE THE MENUS TAKE THEIRS.
   `optionsFor` is the one resolution of "what can this axis say and what is it
   saying" (avail.js), so the key is the word the circle of fifths wears, the
   mode is the word in the menu beside it, and the meter is the word on the
   Time axis — spelled `A♯/B♭` and `natural minor` because those are the
   labels, not because anything here types them. Change the key and this line
   is the change; it cannot drift, because there is nothing here to drift.

   IT NAMES THE RECORD AND NOT THE PAPER, and where those two differ it is on
   purpose and it is `SCORE_SPB`'s difference, not this line's: the score is
   engraved in sixteen steps to the measure whatever the record counts in (see
   SCORE_SPB — "a genre in a twelve-step meter draws its score the way it draws
   its motifs, which is the disagreement to fix in one place if ever"). The
   reader asked which key they are looking at; the answer is the record's. */
function keyLine() {
  const A = NuAvail;
  const said = (k) => {
    const r = A.optionsFor(DOC, null, k, NuGates, ENV);
    const o = r.options.find((x) => String(x.value) === String(r.value));
    return { label: A.SHEETS[k].label, word: o ? o.label : String(r.value) };
  };
  const key = said("alphabet.key"), mode = said("alphabet.mode");
  const met = said("time.meter");
  return key.label + ": " + key.word + " " + mode.word +
         " · " + met.label + ": " + met.word;
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
    // …AND EVERY BAR OF IT, not just the two ends. The caption names the bar
    // under the sounding line and that line walks the whole section now, so
    // "bars 9-10 of 12" is a sentence this record can say and has to be
    // measured. A section is a dozen bars at most; the walk is arithmetic on
    // strings and runs once per rebuild.
    for (let k = 0; k < M; k++)
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
  /* …AND THE SYLLABLE LINE GETS THE IDENTICAL TREATMENT, because it is written
     ON THE CLOCK and it sits ABOVE every editor on the page. THE PAGE DOES NOT
     JUMP: a host that grows after `draw()` returns is the one thing this axis
     may not have, so the room is taken at creation, measured on the longest
     thing this record could ever make it say — every section, both windows,
     which is the same walk the caption above does. */
  if (!scoreSyl) return;
  let widest = "";
  for (let i = 0; i < NS; i++) {
    const M = Math.max(1, (SONG[i] || { len: 1 }).len | 0);
    for (let k = 0; k < M; k++) {
      const t = syllLine(i, k);
      if (t.length > widest.length) widest = t;
    }
  }
  scoreSyl.textContent = widest;
  const h2 = Math.ceil(scoreSyl.getBoundingClientRect().height);
  if (h2) scoreSyl.style.minHeight = h2 + "px";
  scoreSyl.textContent = syllLine(0, 0);
}

/* THE WALK, SAID IN LETTERS. `Math.round(beat0 / vowelEvery)` indexed into the
   voice's own word, wrapping — the parent's own three lines, with the letters
   put back through the measured `rowOf` map so a tract and a singer print the
   SAME letter for the same sound (their formant tables are indexed differently
   and that is knobs.js's job to know, not this one's).

   EIGHT SYLLABLES AND THEN AN ELLIPSIS. A choir on `vowelEvery: 8` sings one
   letter in two bars and a line at 0.5 sings sixteen; sixteen letters and a
   name is 40-odd characters, which wraps on a phone and would put the reserve
   above at two lines for every record. Eight is what fits, and the ellipsis is
   the honest way to say there are more. */
function syllLine(si, k) {
  const KN = NuKnobs;
  if (!KN) return "";
  let before = 0;
  for (let i = 0; i < si; i++) before += Math.max(1, (SONG[i] || { len: 1 }).len | 0);
  const bpb = beatsPerBar(), b0 = (before + k) * bpb, b1 = b0 + SCORE_BARS * bpb;
  const parts = [];
  for (const v of DOC.voices) {
    const V = typeof v.instrument === "string" ? KN.voices[v.instrument] : null;
    if (!V || !V.mouth) continue;
    const vw = V.rows.find((r) => r.kind === "vowels");
    const evR = V.rows.find((r) => r.key === "vowelEvery");
    if (!vw) continue;
    const word = (v.set && typeof v.set.vowels === "string" && v.set.vowels) ||
      vw.derivedWord || "a";
    const ev = v.set && v.set.vowelEvery != null ? +v.set.vowelEvery
      : (evR ? evR.derived : 1);
    if (!(ev > 0)) continue;
    const out = [];
    for (let st = Math.round(b0 / ev); st <= Math.round((b1 - 1e-9) / ev); st++) {
      if (out.length === 8) { out.push("…"); break; }
      out.push(word[((st % word.length) + word.length) % word.length]);
    }
    parts.push(v.name + ": " + out.join(" "));
  }
  if (!parts.length) return "";
  return "singing, bars " + (k + 1) + "-" + (k + SCORE_BARS) + " - " + parts.join("; ");
}

/* ================= THE SCORE DECK (2026-08-27) ============================
   nukernel/ideal/score-deck.html, made real at the foot of the page. The
   engraved score above this comment — the steady scroll, the red sounding
   ink, the reserved captions, all of it fought for across 2026-08-25/26 —
   did not change; it MOVED, from the top of the Material axis to a deck under
   the board, and gained three things the sketch decided:

     1  MOTIF NAMES UNDER EACH PART, extracted and never typed: each label's
        text is the material cell THAT VOICE reads in that section (`cellAt`,
        the same resolution `materialAt` gives the compiler), and its span is
        `scoreSecAt` → `paperX` — the same fold that bars the timeline. A gate
        can equal every label to a `material.cells` key for its own voice.
        (It was ONE bracket over the system carrying the LEAD's cell until
        2026-08-27 — Paul: "The names of the motifs should appear in the score
        below the parts when they are used as notes." See `motifLabels`.)
     2  A VERTICAL PIANO ROLL: pitch across (low left, high right), time
        pouring DOWN through a clock-red now-band a third from the top —
        "time runs downward in every grid; the engraved score is the ONE
        lawful horizontal scroller" (FUTURE.md, the two laws of 2026-08-27).
        It is a canvas repainted from the same frame walk as the paper
        (`place`), over the same `buildScore()` notes, inside its own
        `[data-live="roll"]` — a CLOCK surface holding no controls.
     3  THE EXPORT ROW, honest states wired where cheap: WAV pressed through
        the parent's own stream worker (export/wav.js), MIDI written by
        export/smf.js over this page's own score notes (toms distinct — the
        export-layer fix FUTURE.md asked for), MP3 and Ableton refused with
        their measured reasons.

   ONE CLOCK, TWO VIEWS. Notation and the roll read the same `stepAbs()`;
   the tab flip touches `hidden` and nothing else, so it cannot lose the
   place — there is only one place. The tabs and the export buttons live
   OUTSIDE the two `[data-live]` blocks (the A1 law, kept at the new
   address). */

let deckView = "not";           // "not" | "roll" — page state, survives draw()
let deckNotView = null, deckRollView = null;
/* (`let deckTabNot = null, deckTabRoll = null` stood here — the two buttons
   `setDeckView` repainted by hand. They are `scoreTrayItems` now: see
   THE STRIPE.) */
let rollHost = null, rollCv = null, rollCtx = null;
let rollW = 0, rollH = 0;
let rollKey = "", rollList = null, rollLo = 48, rollHi = 72;
let scoreMots = null;           // the motif-label layer, inside the run
let deckSay = null;             // the export row's status line (gesture-written)
const ROLL_PXSTEP = 13;         // steady: pixels per pattern step, time DOWN
const HEAD_GM = headGM(SCOREHEAD);   // notehead → GM key (export/smf.js fold)

// the paints, read off the ONE owner of the tokens (nu.css :root) — a canvas
// needs literals, and typing hexes here would be a second palette.
let deckPaint = null;
function paints() {
  if (deckPaint) return deckPaint;
  const cs = getComputedStyle(document.documentElement);
  const v = (k, fb) => (cs.getPropertyValue(k) || "").trim() || fb;
  deckPaint = { hand: v("--hand", "#1E45E0"), clock: v("--clock", "#E5330E"),
                meter: v("--meter", "#0B9B4E"), flag: v("--flag", "#FFC61A"),
                ink: v("--ink", "#191611"), paper: v("--paper", "#FFFFFF") };
  return deckPaint;
}
// WHICH PAINT A VOICE WEARS, on the roll and in the legend: the kit in ink,
// the bass in the meter's green, and the line voices alternating hand / flag —
// the same four paints the whole page speaks, no fifth.
function voicePaint(vi) {
  const P = paints(), v = DOC.voices[vi] || {};
  if (v.kind === "drums") return P.ink;
  if (v.kind === "bass") return P.meter;
  let li = 0;
  for (let i = 0; i < vi; i++) {
    const k = (DOC.voices[i] || {}).kind;
    if (k !== "drums" && k !== "bass") li++;
  }
  return li % 2 ? P.flag : P.hand;
}

/* ---- THE MOTIF NAMES, UNDER EACH PART, extracted -------------------------
   Paul, 2026-08-27: *"The names of the motifs should appear in the score
   below the parts when they are used as notes."*

   THIS REPLACES THE BRACKET ABOVE THE STAFF RATHER THAN JOINING IT, and the
   reason is the one-owner law and not tidiness. The old header said:

     *"THE MOTIF BRACKETS (decision 2). One span per section OVER the staff,
     carrying the NAME of the material cell the LEAD LINE reads there —
     `cellAt(lead, si)`."*

   That bracket is a special case of what is drawn here: the lead line is one
   of the parts, and if the bracket stayed, the lead's cell would be printed
   twice on one picture — once over the system and once under its own staff —
   which is two owners for one fact and the first thing to go stale. So the
   layer is the same layer (`.nu-mots` inside the moving run), the extraction
   is the same extraction, and what changed is that it is asked ONCE PER PART
   instead of once for the record.

   WHAT IT SAYS, AND WHOSE FACT IT IS. For each voice and each section:
   `cellAt(voice, si)` — the page's one resolution of "which cell does this
   voice read here" (document.js `materialAt` under it, the same answer the
   compiler gets and the same answer the band's form table prints in its
   `reads` column). Zero typed strings: rename a cell and every label is the
   rename.

   …EXCEPT THE BASS, WHICH READS SOMEBODY ELSE'S. `K.bass` is handed the FIRST
   LINE's compiled phrase in both compilers (document.js scoreOf:355,
   ui/derive.js:433 — "the bass reads accents, which only one line can own"),
   so a bass voice's own `material` reaches no note. Printing it under the bass
   staff would be the box's characteristic lie: a name declared and never
   arriving. The bass staff gets the LEAD's cell, which is the same sentence
   `bassReadsWhy` already says in words on the bass's own tab.

   "WHEN THEY ARE USED AS NOTES" IS THE OTHER HALF OF THE ASK, and it is
   measured off the engraving rather than assumed: a part with no note in a
   section — out, not yet entered, or resting through it — gets no label
   there, because a motif name over eight bars of rests names music nobody can
   hear. `scoreVoices[vi].byStep` is the index the red noteheads are read
   through, so the label and the ink agree by construction.

   THE GEOMETRY IS RESERVED, NOT DISCOVERED — AND IT IS THE GAP AND NOT THE
   LINE. The label hangs in the space between its own staff's bottom line and
   the next staff's top line (`scoreStaffY`, off abcjs's own tune object),
   two fifths of the way down it. Flush under the bottom LINE was drawn first
   and measured first, on the rendered chant at 390px: the cantor's noteheads
   sit a third below the staff and the rule went straight through them. Two
   fifths puts the label clear of this part's low notes and clear of the next
   part's high ones, and nearer the staff it names than the staff it does not,
   which is what says whose it is. The last staff's gap is the picture's own
   bottom margin, and `fitPaper` takes at creation whatever that margin is
   short of.

   HUNG IN THE RUN so it scrolls WITH the bars it names, rebuilt exactly when
   the paper is (`fitPaper`), inside [data-live="score"] and holding no
   control — the A1 law, unchanged from the bracket it replaces. */
function motifLabels() {
  if (!scoreRun) return;
  if (!scoreMots || scoreMots.parentNode !== scoreRun) {
    scoreMots = el("div", null, "nu-mots");
    scoreRun.append(scoreMots);
  } else scoreMots.textContent = "";
  if (!scoreMap || !scoreSecAt.length || !scoreStaffY.length) return;
  const NS = DOC.form.sections.length;
  const lead = LINES()[0];
  for (let si = 0; si < NS; si++) {
    const s0 = scoreSecAt[si];
    const s1 = si + 1 < NS ? scoreSecAt[si + 1] : scoreSteps;
    const x0 = paperX(s0), x1 = paperX(s1);
    if (!(x1 > x0 + 16)) continue;        // a sliver has no room for a word
    DOC.voices.forEach((v, vi) => {
      const y = scoreStaffY[vi];
      if (!y) return;                     // a voice with no staff of its own
      if (!soundsIn(vi, s0, s1)) return;  // …and one with nothing to name here
      // THE ONE RESOLUTION, and the bass's exception to it, said once.
      const src = v.kind === "bass" ? lead : v;
      const name = src ? cellAt(src, si) : null;   // a material.cells key
      if (!name) return;
      // the gap under this part, and where in it the label sits
      const under = (vi + 1 < scoreStaffY.length
        ? scoreStaffY[vi + 1].top : scoreH) - y.bottom;
      const b = el("span", null, "nu-mot");
      const w = Math.max(12, x1 - x0 - 10);
      b.style.left = (x0 + 3) + "px";
      b.style.top = (y.bottom * scoreS +
        Math.max(2, (under * scoreS - SCORE_MOT_H) * 0.4)) + "px";
      b.style.width = w + "px";
      b.dataset.v = v.name;               // whose staff this label hangs under
      b.dataset.si = si;                  // …and which section it starts on
      /* AND THE NAME IS SAID AGAIN EVERY SCREENFUL, which is the same lesson
         the pinned gutter is (`gutterFrom`): a word written once at the head
         of a section has scrolled away four bars later, and a reader arriving
         at bar 8 was looking at a blue rule with nothing on it — measured on
         the rendered page at 390px, 2026-08-27.

         THE SPACING IS THE ONE THAT ACTUALLY GUARANTEES IT, and the obvious
         one does not. Caps every `room` pixels from the start leaves the TAIL
         of a section nameless: at 1280 the chant's section is 780px inside a
         1120px window, so one cap at its head is enough to satisfy "a cap
         within a window" and still be off the left edge with 480px of rule
         showing (measured, and it is what the first cut of this drew). So the
         rule is DIVIDED: `n` equal steps no longer than four fifths of the
         room, caps at every division INCLUDING THE LAST — from anywhere in
         the section the next cap is at most one step away and the step is
         smaller than the window, so a cap is always on the screen. The final
         one hangs from the section's end instead of its start (`nu-end`, a
         translate rather than a measurement, because the width of a word is a
         thing only the browser knows). All of it is arithmetic done once per
         fit: the labels ride the paper, and nothing here writes on the
         clock. */
      const room = Math.max(80, scoreBoxW - scoreGutW);
      const n = Math.max(1, Math.ceil(w / (room * 0.8)));
      // …AND NOT TWICE AT A SEAM WHERE NOTHING CHANGES. A section that hands
      // the same motif on to the next one would print its end cap a
      // notehead's width from the next section's start cap — "psalm psalm",
      // measured at 1280 — and the second word is the first word. The end cap
      // is dropped there, and nothing is lost: the next section's own cap is
      // standing at the seam saying the same thing.
      const on = si + 1 < NS && soundsIn(vi, s1,
        si + 2 < NS ? scoreSecAt[si + 2] : scoreSteps)
        ? cellAt(src, si + 1) : null;
      for (let k = 0; k <= n; k++) {
        if (k === n && on === name) break;
        const cap = el("b", name);
        if (k === n) { cap.className = "nu-end"; cap.style.left = w + "px"; }
        else cap.style.left = (k * (w / n) - 2) + "px";
        b.append(cap);
      }
      scoreMots.append(b);
    });
  }
}
/* WHETHER A PART HAS A NOTE IN A STRETCH OF THE RECORD, asked off the SCORE
   and not off the document: `byStep` is the step-indexed note map the sounding
   red is read through (`indexVoices`), so "this part plays here" means the
   same thing to the label and to the ink. Linear over the section, which is
   the record's steps once per part per fit — a fold of small integers, and it
   runs where every other measurement on this surface runs, in the render. */
function soundsIn(vi, s0, s1) {
  const v = scoreVoices[vi];
  if (!v) return false;
  const end = Math.min(v.byStep.length, s1);
  for (let s = Math.max(0, s0); s < end; s++) if (v.byStep[s] >= 0) return true;
  return false;
}

/* ---- THE PIANO ROLL (decision 3): pitch across, time down ---------------- */
// the roll's notes are the SCORE's notes — the same `toScore` fold the staff
// is engraved from (`scoreVoices`), keyed on the same ABC string, so the two
// views cannot disagree about a single onset. A drum notehead takes its GM
// key through the same fold the .mid file takes (HEAD_GM).
function rollFold() {
  if (rollKey === scoreAbc && rollList) return rollList;
  const out = [];
  let lo = 127, hi = 0;
  scoreVoices.forEach((v, vi) => {
    const perc = (DOC.voices[vi] || {}).kind === "drums";
    for (const nt of v.notes) {
      const list = Array.isArray(nt.midi) ? nt.midi : [nt.midi];
      for (const m of list) {
        const pitch = typeof m === "number" ? m : (perc ? HEAD_GM[m] : null);
        if (pitch == null) continue;
        out.push({ at: nt.at, len: Math.max(1, nt.len), pitch, vi });
        if (pitch < lo) lo = pitch;
        if (pitch > hi) hi = pitch;
      }
    }
  });
  if (lo > hi) { lo = 48; hi = 72; }
  rollLo = lo; rollHi = hi; rollKey = scoreAbc; rollList = out;
  return out;
}
function sizeRoll() {
  if (!rollCv || !rollHost) return;
  const dpr = window.devicePixelRatio || 1;
  rollW = rollHost.clientWidth || 320;
  rollH = rollHost.clientHeight || 420;
  rollCv.width = Math.round(rollW * dpr);
  rollCv.height = Math.round(rollH * dpr);
  rollCtx = rollCv.getContext("2d");
  rollCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function drawRoll(abs) {
  if (!rollCtx || !rollHost || deckView !== "roll") return;
  if (!scoreSteps || !scoreVoices.length) return;
  const notes = rollFold(), P = paints(), ctx = rollCtx;
  const w = rollW, h = rollH;
  const NOWY = Math.round(h / 3);                 // fixed, a third from the top
  const L = 40, Rm = 8;
  const cols = rollHi - rollLo + 1;
  const colw = (w - L - Rm) / cols;
  const yAt = (step) => NOWY + (step - abs) * ROLL_PXSTEP;
  ctx.clearRect(0, 0, w, h);
  // pitch stripes, low LEFT → high RIGHT
  for (let r = 0; r < cols; r += 2) {
    ctx.fillStyle = "rgba(25,22,17,.05)";
    ctx.fillRect(L + r * colw, 0, colw, h);
  }
  // bar rules — TIME IS VERTICAL, so a barline is horizontal; a section
  // boundary is a bold rule wearing the section's own name in a flag cap
  ctx.font = "700 10px ui-monospace, Menlo, monospace";
  const bars = Math.ceil(scoreSteps / SCORE_SPB);
  for (let b = 0; b <= bars; b++) {
    const st = b * SCORE_SPB, y = yAt(st);
    if (y < -40 || y > h + 40) continue;
    const si = scoreSecAt.indexOf(st);
    const secStart = si >= 0 && b < bars;
    ctx.strokeStyle = secStart ? P.ink : "rgba(25,22,17,.25)";
    ctx.lineWidth = secStart ? 3 : 1;
    ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(w - Rm, y); ctx.stroke();
    if (b < bars) {
      ctx.fillStyle = "rgba(25,22,17,.6)"; ctx.textAlign = "right";
      ctx.fillText(String(b + 1), w - Rm - 2, y + 12); ctx.textAlign = "left";
    }
    if (secStart && si < DOC.form.sections.length) {
      const nm = secName(si);
      ctx.font = "800 12px system-ui, sans-serif";
      const wcap = Math.min(w - L - 20, Math.ceil(ctx.measureText(nm).width) + 12);
      ctx.fillStyle = P.flag; ctx.fillRect(L + 2, y + 4, wcap, 20);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2;
      ctx.strokeRect(L + 2, y + 4, wcap, 20);
      ctx.fillStyle = P.ink; ctx.fillText(nm, L + 8, y + 19);
      ctx.font = "700 10px ui-monospace, Menlo, monospace";
    }
  }
  // the notes: onset at its time-y, duration DOWNWARD; a note the record has
  // already played fades; a note that is SOUNDING wears the clock — the only
  // "now" on this surface besides the band itself (decision 1, kept here too)
  for (const n of notes) {
    const y0 = yAt(n.at), hh = Math.max(4, n.len * ROLL_PXSTEP - 2);
    if (y0 + hh < -8 || y0 > h + 8) continue;
    const lit = playing && abs >= n.at && abs < n.at + n.len;
    const past = n.at + n.len < abs;
    const x = L + (n.pitch - rollLo) * colw + 1, ww = Math.max(3, colw - 2);
    ctx.globalAlpha = past ? 0.4 : 1;
    ctx.fillStyle = lit ? P.clock : voicePaint(n.vi);
    ctx.fillRect(x, y0, ww, hh);
    ctx.strokeStyle = P.ink; ctx.lineWidth = lit ? 2 : 1;
    ctx.strokeRect(x + .5, y0 + .5, ww - 1, hh - 1);
    ctx.globalAlpha = 1;
  }
  // the now-band the content pours through
  ctx.fillStyle = "rgba(229,51,14,.14)"; ctx.fillRect(0, NOWY - 12, w, 24);
  ctx.fillStyle = P.clock; ctx.fillRect(0, NOWY - 2, w, 4);
  // the axes, said once each
  ctx.fillStyle = "rgba(25,22,17,.6)";
  ctx.fillText("low ◀", L, 12);
  ctx.textAlign = "right"; ctx.fillText("▶ high", w - Rm, 12);
  ctx.textAlign = "left"; ctx.fillText("time ▼", 4, h - 8);
}

/* ---- the toggle: one clock, never loses the place ------------------------ */
function setDeckView(v) {
  deckView = v;
  if (deckNotView) deckNotView.hidden = v !== "not";
  if (deckRollView) deckRollView.hidden = v !== "roll";
  /* THE MARK MOVES WITH THE STATE, and it is `paintTray` that moves it now.
     This held references to the two buttons and repainted them by hand; the
     pair is a LEVEL of the stripe since 2026-08-28, so the state is written
     here and read by `scoreTrayItems` — which is one owner rather than two
     copies of "which one is open". (Before the glyphs it set `aria-pressed`
     alone, which was the whole of the old skin when the button was a word.) */
  paintTray();
  markLink();
  if (v === "roll") { sizeRoll(); drawRoll(stepAbs()); }
}
addEventListener("resize", () => {
  // ...AND ONLY WHILE THE DECK IS ON THE PAGE (2026-08-27). Sizing a canvas
  // inside a `display: none` panel measures a zero-width box and throws the
  // roll away; `showTab` re-sizes it on the way back in.
  if (openTab === "Score" && deckView === "roll" && rollCv) {
    sizeRoll(); drawRoll(stepAbs());
  }
});

/* ---- the export row (decision 4): each button wears its true state ------- */
const deckFile = () => String(DOC.basis || "record").replace(/[^\w.-]+/g, "-");
function handOff(name, bytes, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes], { type }));
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
// the whole record as an SMF, over the page's OWN score fold — the very
// buildScore() the staff and the roll draw, so the file, the ink and the roll
// are one note list (a probe below hands a gate the same value).
function deckSmf() {
  const built = buildScore();
  if (!built) return null;
  const bytes = writeSmf({ bpm: DOC.time.bpm, beatsPerBar: beatsPerBar(),
    stepsPerBar: SCORE_SPB, voices: built.voices }, { drumMap: HEAD_GM });
  return { bytes, voices: built.voices, steps: built.steps };
}
function expSay(t) { if (deckSay) deckSay.textContent = t || ""; }
function exportCard(grid, glyph, cls, title, sub, mk) {
  const card = el("div", null, "nu-exp");
  const head = el("p", null, "nu-exp-head");
  head.append(el("b", glyph, "nu-glyph " + cls), el("span", title));
  const subEl = el("p", sub, "nu-hint");
  card.append(head, subEl);
  mk(card);
  grid.append(card);
  return card;
}
function exportRow(parent) {
  const grid = el("div", null, "nu-exports");
  // THE LINK — LIVE, AND FIRST, because it is the one export that always
  // works and the one Paul asked for three times (see THE ADDRESS).
  shareCard(grid);
  // WAV — LIVE. The press path exists (engine/faust/press + the stream
  // worker's PCM sink); export/wav.js is that machinery pointed at a file.
  exportCard(grid, "WAV", "nu-cap-meter", "the render",
    "44.1 kHz · 16-bit · the exact artifact the speakers get", (card) => {
    const b = el("button", "download .wav");
    b.type = "button"; b.dataset.k = "deck.exp.wav";
    b.addEventListener("click", () => {
      b.disabled = true; expSay("pressing…");
      import("../export/wav.js")
        .then((m) => m.pressWav(expSay))
        .then((r) => { handOff(deckFile() + ".wav", r.bytes, "audio/wav");
                       expSay("pressed — " + r.durSec.toFixed(1) + "s"); })
        .catch((e) => expSay("the press failed — " + ((e && e.message) || e)))
        .finally(() => { b.disabled = false; });
    });
    card.append(b);
  });
  // MIDI — LIVE. export/smf.js over the score's own notes; the toms come out
  // distinct (t/m/l → GM 50/47/45), which is the export-layer fix FUTURE.md
  // asked for — the engine's own folded mapping is untouched.
  exportCard(grid, "MID", "nu-cap-flag", "MIDI",
    "type 1 · one track per voice · the staff's own notes", (card) => {
    const b = el("button", "download .mid");
    b.type = "button"; b.dataset.k = "deck.exp.mid";
    b.addEventListener("click", () => {
      const r = deckSmf();
      if (!r) { expSay("the record would not fold to a score — nothing to write"); return; }
      handOff(deckFile() + ".mid", r.bytes, "audio/midi");
      expSay("written — " + r.voices.length + " tracks");
    });
    card.append(b);
  });
  // MP3 — REFUSED, with the measured reason. lamejs IS in the tree
  // (engine/faust/vendor/lamejs.min.js) and it already drives the phone's
  // rolling stream (engine/faust/codec/mp3-worker.js) — what does not exist
  // is a one-press encode of THIS render, and a button that pretended would
  // be the dead control this page forbids.
  exportCard(grid, "MP3", "nu-cap-flag", "MP3",
    "320 kbps · for the phone", (card) => {
    const b = el("button", "download .mp3");
    b.type = "button"; b.dataset.k = "deck.exp.mp3"; b.disabled = true;
    card.append(b, el("span", "the encoder is vendored — lamejs already " +
      "streams the phone's rolling MP3 — but no one-press encode of this " +
      "render is wired; the WAV is the record today", "nu-why"));
  });
  // ABLETON — REFUSED in-page: tools/ableton/export-als.js is a node CLI
  // (zlib, fs — its own header says "zero deps (zlib + string XML are built
  // in)"), so the button prints where the export actually lives.
  exportCard(grid, "ALS", "nu-cap-hand", "Ableton",
    "live set · donor-spliced .als", (card) => {
    const b = el("button", "download .als");
    b.type = "button"; b.dataset.k = "deck.exp.als"; b.disabled = true;
    card.append(b, el("span", "exports from the command line today — " +
      "node tools/ableton/export-als.js --genre <key> --out <file.als>; " +
      "the in-page splice is engine work", "nu-why"));
  });
  parent.append(grid);
  deckSay = el("p", "", "nu-hint");
  deckSay.setAttribute("role", "status");
  parent.append(deckSay);
}

/* ---- the deck itself, mounted at the page's foot (after the board) ------- */
function deckBlock(parent) {
  parent.textContent = "";
  const ax = el("section", null, "nu-ax");
  ax.id = "ax-deck";
  // "The score", initial cap, 2026-08-27 — the §5 table's own spelling for
  // the foot ("`Motifs` mid-page + `The score` at the foot"), and the one
  // case rule every heading now follows.
  ax.append(el("h2", "The score"));
  /* THE TWO VIEW BUTTONS LEFT THIS ROW, 2026-08-28, AND THE LEGEND STAYED.
     They were `deck.view.not` and `deck.view.roll` — "TWO MARKS THAT ARE ONE
     BOX TURNED: ▤ is ruled paper, the staff, which runs across; ▥ is the roll,
     blocks standing up the pitch axis. Turn one and you have the other, which
     is exactly what these two buttons do to the same record." They are the
     `score` LEVEL of `#nu-tray` (`scoreTrayItems`), because they are a set of
     siblings and a set of siblings is what the stripe draws.
     THE LEGEND IS NOT A LEVEL, so it did not move: it is who wears which paint
     on the roll, a caption on the picture below it, and it is the half of this
     row that was always the other kind of thing. `.nu-decktabs` keeps its
     class and its rule (`#scoredeck .nu-decktabs`, nu.css) because the row is
     still the row; it is one item shorter. */
  const row = el("div", null, "nu-row nu-decktabs");
  // the legend: who wears which paint on the roll — the voices' own names,
  // extracted from the record, beside the one clock-red word
  const leg = el("span", null, "nu-decklegend");
  DOC.voices.forEach((v, vi) => {
    const chip = el("i");
    chip.style.background = voicePaint(vi);
    const s = el("span", null, "nu-legv");
    s.append(chip, document.createTextNode(v.name));
    leg.append(s);
  });
  const lit = el("span", null, "nu-legv");
  const litChip = el("i");
  litChip.style.background = paints().clock;
  lit.append(litChip, document.createTextNode("sounding"));
  leg.append(lit);
  row.append(leg);
  ax.append(row);
  // NOTATION — the moved score block, verbatim (its own [data-live="score"])
  deckNotView = el("div");
  ax.append(deckNotView);
  // THE ROLL — a clock surface: one [data-live] block, one canvas, no control
  deckRollView = el("div");
  const live = el("div");
  live.dataset.live = "roll";
  live.className = "nu-roll";
  rollHost = el("div", null, "nu-rollwin");
  rollCv = document.createElement("canvas");
  rollCv.setAttribute("aria-label", "piano roll: pitch across, low left to " +
    "high right; time pours down through the fixed red now-band");
  rollHost.append(rollCv);
  live.append(rollHost);
  deckRollView.append(live);
  ax.append(deckRollView);
  parent.append(ax);
  rollKey = ""; rollList = null; deckPaint = null;
  scoreBlock(deckNotView);              // the notation view mounts LAST-known
  /* (`exportRow(ax)` stood here and it is a TAB now — Paul's list, 2026-08-27:
     "… Score / Export". The deck is the two VIEWS of the record, notation and
     roll, under one heading and one clock; the export row was the one block in
     it that was neither. See `exportBlock`.) */
  setDeckView(deckView);                // the flip you chose survives a draw()
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
  // THE SCORE IS NOT HERE ANY MORE — REWRITTEN 2026-08-27. It stood first in
  // this axis from 2026-08-25 ("add a section ABOVE motifs which is the
  // current playing music"), and it has MOVED, whole, to the SCORE DECK at
  // the foot of the page (`deckBlock`, mounted after the board; the design is
  // nukernel/ideal/score-deck.html and FUTURE.md Phase 3 names the move).
  // Nothing about the picture changed in transit — same `scoreBlock`, same
  // steady scroll, same red sounding ink, same captions — only its address:
  // the band plays its own sheet music at the bottom, beside the piano roll
  // and the export row, and this axis is left holding exactly what its
  // heading says: the tunes and their editors. What Paul asked for in the
  // 2026-08-25 sentence — the whole band, visible, moving — is answered
  // better one screen down, where it no longer pushes the editors around.
  //
  // ...AND THE "the motifs" <h3> WENT WITH IT, 2026-08-27: while the axis
  // heading read "Sheet music" and held the score too, the h3 said which half
  // of the section you had reached. The heading says "Motifs" itself now
  // (FUTURE.md §5), so a sub-heading repeating it was the second owner of one
  // word — deleted, not moved.
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
  /* (`motifTabRow(ax)` stood here — see the tombstone above. The bank is a
     level of the stripe now and the axis opens on the motif itself. What the
     strip also did on its way past was settle WHICH motif is open, and that
     is `settleMotifTab` now: one function, called here first, so the axis
     never waits on the navigation to know what it is drawing.) */
  settleMotifTab();
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
  ax.append(h2 || el("h2", "Motifs"));
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
  /* …AND THE BANK'S OWN LEVEL OF THE STRIPE, which is the strip this axis used
     to draw for itself (see the tombstone over `motifTabRow`). `paintTray`
     rebuilds only if the set of cells moved; opening another motif writes two
     attributes, which is what keeps `restoreFocus` — scoped to `#ax-material`
     and therefore blind to the stripe — from having a button to lose. */
  paintTray();
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
/* WHICH MOTIF IS OPEN, SETTLED IN ONE PLACE (2026-08-28). `motifTabRow` used
   to do this on its way to drawing the strip — "if (!names.includes(motifTab))
   motifTab = names[0] || null" — and TWO things needed the answer the moment
   the strip left this axis for the stripe: `materialAxis`, which draws the
   motif, and `motifTrayItems`, which draws the marks. Measured before this
   line existed: opening the Motif tab drew `<h2>Motifs</h2><div id="staff">`
   and nothing else, because the axis is built before the stripe is painted and
   `motifTab` was still null when `motifs()` asked. Two copies of one rule is
   what caused it and one function is the fix; the axis is the first caller, so
   the stripe can never be the thing that decides what the page draws. */
const settleMotifTab = () => { const n = motifNames();
  if (!n.includes(motifTab)) motifTab = n[0] || null;
  return n; };
// ...AND WHICH CELLS A VOICE OF THIS KIND MAY READ, which is the honest half of
// the same idea. A drum cell is LANES and a line cell is DEGREES: `toPhrase`
// hands back a blank for a drum cell ("a grid is not a line", document.js:230)
// and `document.js:133` reads `.lanes` off the drummer's cell and nothing else.
// So the offer is filtered by kind rather than by hope — see avail.js
// `cellsFor`, which is where the same rule is stated for the menus.
const drumCells = () => cellNames().filter((n) => DOC.material.cells[n].kind === "drum");
/* ---------- TAP A MOTIF TO HEAR IT --------------------------------------
   Paul, 2026-08-25: *"If I tap the motif play the motif in an associated
   voice. Give me a loop button to loop the motif."*

   THE TAP IS THE TAB, WHICH IS THE LITERAL READING AND IS THE POINT. Paul said
   "if I tap the motif", and the thing you tap to get a motif is its tab. So
   navigating the strip makes sound: every time you move from `psalm` to `bed`
   to look at one, it speaks. That is how a drum machine's pad works and it is
   NOT how a tab works anywhere else on this page, so it is built the way it was
   asked for and reported as a feel rather than defended as a design — a
   separate button would have been a quieter answer to a question that was not
   asked.

   WHICH VOICE IS "ASSOCIATED", AND THE PAGE ALREADY SAID SO. The block's own
   name line reads `psalm — read by cantor, schola`, and the audition takes the
   FIRST of those readers — its instrument, its register (`cast.reg`) and the
   record's own key and mode, which is `engOpts`, the very options the staff
   under it is engraved with. So the reading and the picture cannot disagree
   about a pitch, and when there are two readers the page says which one it
   took rather than choosing silently.

   THE THREE CASES THAT ARE NOT A PITCHED READER, each answered out loud:
     · A MOTIF NOBODY READS (`neume — read by nobody`) has no associated voice
       at all, so it is read by the RECORD's own default instrument — the same
       `instr` document.js hands the kernel for a voice that names nothing —
       and the line says "read by nobody, so the record's own <x> reads it".
     · A DRUM CELL is lanes, not degrees. It auditions on the KIT, from the
       drummer's own `instrument`, because a grid has no pitch to give a
       pitched voice (document.js:230: "a grid is not a line").
     · A THROAT THE ENGINE SYNTHESISES (the chant's cantor is a `tract_voice`)
       cannot be voiced by audio/audition.js at all — it holds recordings, not
       Faust (VOICE.md §8). It reads on the nearest RECORDING and says so.

   WHAT HAPPENS WHILE THE RECORD IS PLAYING: NOTHING, AND THE PAGE SAYS SO.
   An audition on top of a running transport is two musics at once — a motif at
   its own tempo, in its own key, with no relation to the bar — and this page
   has one engine and no mixer to put them through. Ducking would be a mix
   decision made by a tab; stopping the transport would be a tab stopping the
   record. So the audition REFUSES, the sentence under the strip says why, and
   the loop button greys with the same reason on it (the page's own rule: an
   unreachable control greys WITH ITS REASON PRINTED). What you hear while the
   record plays is the record, and the score at the top of this axis is the
   picture of it.

   WHERE THE SENTENCE LIVES, AND WHY IT CARRIES `data-live`. The audition ends
   on a TIMER, not on a gesture of yours — the phrase runs out and the line has
   to stop saying "sounding". That is the same property the transport feed has
   and it is what `data-live` declares, so the sentence declares it too and
   `window.__eightFrozen` empties it like any other. The LOOP BUTTON is a
   control and lives outside it, which is the law that keeps the frozen half
   frozen (test/motif-frozen.js A1). */
let motifLoop = null;         // the cell that is looping — page state, by NAME
let motifOnce = null;         // …and the cell whose ONE PASS was asked for, by NAME
let motifSay = null;          // the block's live sentence
let motifWho = "";            // …and the still half of it, kept for a redraw

// WHAT THE RECORD PLAYS WHEN NOBODY IS NAMED. document.js `toGenre` writes
// `instr` off each chair and falls back to the anchor's own `instr` for a
// chair that says "synth"; this is that fallback, asked for the record as a
// whole. An ARRAY is a band (instruments.js `instrOf`: "the Isley Brothers are
// a Rhodes and a fuzz guitar at the same time") and its first entry is the
// record's leading sound.
function recordInstr() {
  const e = (GENRES[DOC.basis] || {}).instr;
  return (Array.isArray(e) ? e[0] : e) || "";
}
// …AND WHAT "synth" MEANS FOR ONE VOICE: the record's signature Faust model,
// `doc.sound.synth` over the anchor's, which is the same order document.js
// reads them in.
function recordSynth() {
  const s = (DOC.sound && DOC.sound.synth) || (GENRES[DOC.basis] || {}).synth;
  return (s && s.dsp) || "";
}

/* THE AUDITION, RESOLVED. Everything the reading needs, and the two sentences
   that go with it: `who` (which voice, on what, and why that one) and `why`
   (the stand-in admission, when there is one). Pure — it decides nothing and
   sounds nothing, so a gate can read it. */
function auditionOf(name) {
  const H = DOC.material.cells[name];
  if (!H) return null;
  const readers = DOC.voices.filter((v) => usesCell(v, name));
  if (H.kind === "drum") {
    const drummer = readers.find((v) => v.kind === "drums") || DRUMV();
    const K = auditionKit(drummer && drummer.instrument);
    const lanes = H.lanes || {};
    const hits = [];
    let steps = 16;
    for (const lane of Object.keys(lanes)) {
      // A SIDECAR IS NOT A HIT — `?k`, `~r`, `!p` are how often, how late and
      // how graced, read WITH their lane by the kernel and never struck on
      // their own (drumGrid says the same thing about drawing them).
      if (SIDECAR[lane[0]]) continue;
      const arr = lanes[lane] || [];
      steps = Math.max(steps, arr.length);
      for (let i = 0; i < arr.length; i++)
        if (+arr[i] > 0) hits.push({ at: i, lane, vel: +arr[i] });
    }
    return { hits, kit: K, steps, bpm: DOC.time.bpm,
             who: (drummer ? drummer.name : "the kit") + " on " +
                  (drummer && drummer.instrument || K.dir),
             why: K.why };
  }
  const lead = readers[0] || null;
  const named = lead ? (lead.instrument === "synth" ? recordSynth() : lead.instrument)
                     : recordInstr();
  const V = auditionVoice(named);
  const ph = phrase(name);
  const opts = engOpts(lead && lead.cast);
  const notes = toNotes(ph, opts).notes;
  const who = lead
    ? (readers.length > 1
        ? lead.name + " reads it first, so this is " + lead.name + " on " + V.id
        : lead.name + " on " + V.id)
    : "nobody reads this one, so the record's own " + V.id + " reads it";
  return { notes, voice: V, steps: (ph.gate || []).length || 16,
           bpm: DOC.time.bpm, who, why: V.why };
}

// WHAT THE PAGE SAYS WHEN THE RECORD IS RUNNING. One string, two readers (the
// sentence and the reserve that gives it room), so a longer refusal cannot
// quietly outgrow the space measured for it.
// ("the score above" until 2026-08-27, when the score moved to the deck at
//  the page's foot — the sentence points where the picture now is)
const PLAYSAY = "the record is playing — the score at the foot of the page is what you hear";
// …and WHO would read this motif, without sounding a note. The reserve needs
// the sentence before there is anything to say.
const auditionWho = (name) => { const A = auditionOf(name); return A ? A.who : ""; };

// THE SENTENCE, WRITTEN IN ONE PLACE. Called after every rebuild of the block
// and at every change of state, so the line is always what is true — a redraw
// mid-loop must not lose the word "looping".
function auditionSay() {
  if (!motifSay) return;
  const t = !motifTab ? ""
    : playing ? PLAYSAY
    : motifLoop === motifTab ? "looping " + motifTab + " — " + motifWho
    : auditioning() && auditioningKey() === motifTab ? "sounding — " + motifWho
    : "";
  if (motifSay.textContent !== t) motifSay.textContent = t;
}

/* SOUND ONE MOTIF. `loop` is the button's state and not a second mode: the
   same reading, laid round and round, re-read from the document at the top of
   every lap so a step changed while it runs is heard on the next pass. */
function auditionMotif(name, loop) {
  if (playing) { auditionSay(); return false; }
  const A = auditionOf(name);
  if (!A) return false;
  motifWho = A.who;
  const ok = playAudition({
    notes: A.notes, hits: A.hits, bpm: A.bpm, voice: A.voice, kit: A.kit,
    steps: A.steps, key: name, loop: !!loop,
    // THE LAP RE-READS THE DOCUMENT, which is what makes a loop an editing
    // tool rather than a tape: `auditionOf` is called again at the top of each
    // pass, so the note you just moved is in the next one.
    again: () => { const B = auditionOf(name); return B ? {
      notes: B.notes, hits: B.hits, bpm: B.bpm, steps: B.steps } : null; },
  }, () => { auditionSay(); });
  auditionSay();
  return ok;
}
// STOPPING IS ONE VERB. A loop that is turned off, a tab that moves to another
// motif and a record that starts all end the same way.
function auditionOff() {
  motifLoop = null;
  motifOnce = null;
  stopAudition();
  auditionSay();
}

/* THE PLAY BUTTON — THREE STATES, ONE CONTROL.

   Paul, 2026-08-26: *"I can't play motifs. Why don't you add a play button that
   plays just the motif and has three states: play, play loop, not playing."*

   He could, in fact, play them: tapping a motif's TAB sounded it, and a probe
   of the deployed page on 2026-08-26 confirmed a buffer source firing on the
   tap. But an affordance nobody can see is not a control, and the only visible
   thing here said "loop" — so the plain single pass had no door at all. This
   button is that door, and the tab-tap is retired with it (which also answers
   the standing complaint that tapping the ALREADY-OPEN tab restarted the sound
   instead of stopping it — a tab is now for looking, and this is for hearing).

   THE STATES ARE OFF → ONCE → LOOP → OFF, cycled by tapping. State lives in two
   page variables keyed by the cell's NAME (PROGRAM.md §2.2 — an index would
   follow the wrong motif the moment the bank changed), so it survives a redraw.

   AND THE WORD ON THE BUTTON IS THE NEXT TAP, NOT THE CURRENT STATE. That is
   this surface's standing division of labour and it is here for a hard reason:
   a single pass ENDS BY ITSELF, and a button that named the state would have to
   be rewritten by the sound's own callback — a write into a control, which is
   the one thing the frozen-DOM law forbids (MOTIF.md; test/motif-frozen.js).
   So the button says what pressing it will do, which never goes stale, and the
   live sentence beside it — a `[data-live]` sibling, which the clock IS allowed
   to write — says what is happening. Between them the three states are legible
   without anything reshaping under a thumb. */
const PLAY_WORD = { off: "▶ play", once: "↻ loop", loop: "■ stop" };
const PLAY_NEXT = { off: "once", once: "loop", loop: "off" };
const playAt = (name) =>
  motifLoop === name ? "loop" : motifOnce === name ? "once" : "off";
function loopButton(parent, name) {
  const p = el("p");
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.k = "motifplay-" + name;
  const paint = () => {
    const at = playAt(name);
    b.setAttribute("aria-pressed", String(at !== "off"));
    b.dataset.at = at;
    b.setAttribute("aria-label",
      at === "loop" ? "stop looping " + name
      : at === "once" ? "loop " + name
      : "play " + name + " once");
    b.replaceChildren(el("span", PLAY_WORD[at]));
  };
  paint();
  if (playing) {
    const why = "the record is playing — stop it to hear one motif alone";
    b.disabled = true; b.setAttribute("aria-disabled", "true");
    b.dataset.why = why;
    b.setAttribute("aria-label", "play " + name + ", " + why);
  } else {
    b.addEventListener("click", () => {
      /* AND IT CAN STILL BE PRESSED AFTER THE RECORD STARTED, because the
         transport may not rewrite a control (that is the whole frozen-DOM
         law): this button was drawn while the record was stopped and it is
         still on the page, live, when somebody presses play. So the refusal is
         made HERE as well as at draw time, and the live sentence beside the
         button — which the clock IS allowed to write — is what says why. */
      if (playing) { auditionSay(); return; }
      const want = PLAY_NEXT[playAt(name)];
      motifOnce = want === "once" ? name : null;
      motifLoop = want === "loop" ? name : null;
      if (want === "off") auditionOff();
      else auditionMotif(name, want === "loop");
      // THE BUTTON REDRAWS ITSELF AND NOTHING ELSE. `drawMaterial()` would
      // rebuild every staff in the axis — three abcjs engravings on the chant
      // — for a word and an attribute, and the recipe's own law is that the
      // page does not reshape under a thumb.
      paint();
    });
  }
  p.append(b, document.createTextNode(" "));
  parent.append(p);
  /* THE LIVE SENTENCE IS THE BUTTON'S SIBLING, never a class on the button —
     a control the clock may write to is how the frozen half stops being frozen
     (the note over this block).

     AND IT IS GIVEN ITS ROOM AT CREATION, which is the same law the score's
     caption obeys one surface up and for the same reason: this line is written
     BY THE CLOCK (pressing play empties it and writes "the record is
     playing…"), it sits above the staff, the grid and every editor in the
     axis, and at 390px it wraps to two lines. Measured 2026-08-25 before this
     reserve existed: pressing play grew `#staff` from 206px to 224px and
     pushed the whole band axis 18px down the page — the clock moving the
     editing interface, which is the one thing this file may not do
     (test/motif-frozen.js A5, which caught it). So the longest thing this
     motif could ever make it say is written, measured, reserved, and then the
     true sentence goes in. One write pass, one read pass, never interleaved. */
  const say = el("p");
  say.dataset.live = "audition";
  say.className = "nu-hint";
  parent.append(say);
  motifSay = say;
  let longest = "";
  const who = auditionWho(name);
  for (const t of [PLAYSAY, "looping " + name + " — " + who, "sounding — " + who])
    if (t.length > longest.length) longest = t;
  say.textContent = longest;
  const h = Math.ceil(say.getBoundingClientRect().height);
  if (h) say.style.minHeight = h + "px";
  say.textContent = "";
  auditionSay();
  if (b.disabled) P(parent, el("span", b.dataset.why, "nu-why"));
}

/* ===== THE BANK'S STRIP LEFT THIS AXIS, 2026-08-28 ======================
   Paul: *"There should be one vertical stripe max with an 'up' icon to get to
   the parent level."* What stood here was `motifTabRow(parent)` and its
   `#motif-tabs` row — a `<p class="nu-row">` holding one mark per cell in the
   bank plus `+ motif` and `+ drum pattern`, 44.00px of horizontal band above
   the motif you were actually editing. It is the `motif` LEVEL of `#nu-tray`
   now (`motifTrayItems`, see THE STRIPE), which carries every argument this
   block made — the two kinds of mark, the digit as the cell's place in the
   bank, the name as the accessible name because "a motif's name is the
   composer's and no picture can carry it", "a tab is for looking" and the
   narrow `drawMaterial()` rebuild — quoted verbatim, because every one of them
   is still the reason.
   ITS TWO ADD BUTTONS WENT WITH IT, and the note that put them there is the
   note that justifies the move: "IN THE STRIP AND NOT UNDER IT, exactly like
   the band's `+ line` / `+ bass` / `+ drums`… the two surfaces are
   deliberately the same object and a person who has learned one strip has
   learned both." They are one object more literally than that could have
   meant it — two levels of one stripe, built by two functions that read the
   same way. `data-k` is unchanged on both (`addcell`, `adddrumcell`).
   WHAT SAYS "read by nobody" IS STILL THE BLOCK'S OWN LABEL and not the tab,
   which was true when the strip was here and is why nothing had to be added
   to the axis to pay for its going. */
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
  // the live sentence belongs to the block that is about to be built; the
  // LOOP belongs to the record you are looking at and outlives the redraw
  motifSay = null;
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
    // …AND THE WAY TO HEAR IT. The button is a control and sits outside the
    // live sentence beside it; the STAND-IN admission, when there is one, is a
    // fact about this motif's voice and not about what is sounding, so it is
    // printed here in plain text and not on the clock.
    loopButton(parent, name);
    const A0 = auditionOf(name);
    if (A0 && A0.why) P(parent, el("span", A0.why, "nu-why"));

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
/* ---------- AND THE SEVEN WEAR A SYMBOL, NOT A DRAWING ------------------
   A REVERSAL, WITH BOTH INSTRUCTIONS QUOTED, BECAUSE THE FIRST ONE WAS
   FOLLOWED EXACTLY AND STILL FAILED ON A READER.

   Paul, 2026-08-25: *"'backwards shift left shift right upside down up a step
   down a step wider' can be icons"*.
   Paul, 2026-08-26: *"the icons for motifs -- they're too hard to parse. just
   use arrows pointing in opposite directions for widen and so forth. Simple
   unicode symbols or a few of them arranged."*

   WHAT THE FIRST INSTRUCTION BUILT, AND WHY IT WAS A REASONABLE THING TO
   BUILD. Each icon was a MINIATURE OF THE TRANSFORM APPLIED TO A LITTLE TUNE:
   five notes drawn as blocks at their pitch heights, the original ghosted
   behind and the result solid in front, over the line the tune started on. The
   argument written here for it was that these seven are geometric operations
   on a shape the user is looking at, so the picture is the more legible of the
   two — "a reader who has never seen the row can work out what 'wider' does
   from the picture."

   THAT CLAIM WAS TESTED ON A READER AND IT IS FALSE. Paul looked at the
   shipped row and could not parse it. The reason is a thing no amount of care
   inside the drawing could fix: the whole picture is 40x32.5 px on glass and
   it holds TEN blocks in two weights of one ink. At that size the ghost and
   the result are two grey smudges at slightly different heights, and telling
   "up a step" from "wider" means resolving a three-pixel difference in the
   vertical offset of five four-pixel marks. The drawing was right about the
   IDEA and wrong about the SIZE, and the size is not negotiable — it is a
   thumb on a phone.

   SO THE FACE IS NOW ONE OR TWO GLYPHS, WHICH IS WHAT PAUL ASKED FOR AND ALSO
   WHAT SURVIVES 40px. An arrow is a single high-contrast stroke; two of them
   pointing opposite ways is the plainest statement of "apart" there is, and
   that is `wider` — his own example. Nothing here is a drawing of the tune any
   more; it is a MARK that names the operation, with the word behind it doing
   the work it was always doing (below).

   THE WORD STAYS IN THE DOM AND THAT IS UNCHANGED. Every one of these buttons
   still carries a `.nu-vh` span with `w` — the accessible name, the
   stylesheet-off label and the word a screen reader reads — so the row still
   reads as the seven words in order (test/sheets.js disables sheet 0 and
   asserts against innerText). The `title` is still hover-only and still not an
   accessible name. What changed is only what the sighted thumb sees at 40px.

   TWO WEIGHTS OF ONE INK SURVIVED THE REVERSAL, and it is the one idea worth
   keeping out of the drawing: where a face is a PAIR, the first glyph is drawn
   quiet (`g0`, `--rule`) and the second in full ink (`g`), so `∧∨` reads left
   to right as "this shape becomes that one" rather than as two shapes. Where
   one glyph says the whole thing there is no pair and no ghost.

   `op` IS STILL THE ONLY THING THAT DECIDES WHAT THE BUTTON DOES. The `art`
   function each row used to carry — the operation performed on the DRAWING,
   kept deliberately separate from `op`, the kernel operator that edits the
   record — is gone with the drawing it fed. A glyph cannot disagree with an
   operator the way a second implementation of it could, which is one whole
   class of drift this reversal removes. */
const DESIGNS = [
  // ⇄ — the two ends change places, which is what a retrograde is
  { w: "backwards",  op: ["reverse"],       moves: true,  g: "\u21c4" },
  { w: "shift left", op: ["rotate", 1],     moves: true,  g: "\u2190" },
  { w: "shift right",op: ["rotate", -1],    moves: true,  g: "\u2192" },
  // ∧∨ — a rising shape and the same shape mirrored. NOT an arrow pair: two
  // vertical arrows are `wider`, and the row may not spend its clearest
  // distinction twice.
  { w: "upside down",op: ["invert", 4],     moves: false, g0: "\u2227", g: "\u2228" },
  { w: "up a step",  op: ["transpose", 1],  moves: false, g: "\u2191" },
  { w: "down a step",op: ["transpose", -1], moves: false, g: "\u2193" },
  // ↕ — Paul's own example: "arrows pointing in opposite directions for widen".
  // The intervals open, so the arrows point apart, and the axis is VERTICAL
  // because on this row up and down are pitch.
  { w: "wider",      op: ["spread", 2],     moves: false, g: "\u2195" },
];
/* THE FACE, FOR ALL THREE ROWS. A `<span>` and not an `<svg>`: a glyph is text,
   it inherits the page's ink and its size, it survives forced colours with no
   media query, and it needs no viewBox arithmetic to be legible at 40px.

   `aria-hidden` AND `pointer-events: none` (nu.css) ARE BOTH LOAD-BEARING and
   both are what the <svg> carried for the same reasons: the glyph is decoration
   beside a `.nu-vh` word that is the real name, and the BUTTON is the tap
   target — a mark inside it that could take the press is the half-hour the
   globe round lost to a decorative stroke swallowing every tap. */
function face(d) {
  const s = el("span", null, "nu-tf");
  s.setAttribute("aria-hidden", "true");
  if (d.g0) s.append(el("span", d.g0, "nu-tf-was"));
  s.append(el("span", d.g, "nu-tf-is"));
  return s;
}
/* ---------- ...AND THE SAME ROW FOR RHYTHM -------------------------------
   Paul, 2026-08-25: *"just as there are icons for pitches create icons for
   tempo operations and add them and make them work."*

   THIS ROW IS RHYTHM AND NOT TEMPO, AND PAUL SAID SO ON 2026-08-26: *"The
   rhythm icon adjustments never happened."* Every icon below works and not one
   of them moves the clock — they change a PATTERN, which is a different
   instruction from "take it faster". The reasoning below is kept because it is
   right about what it built; what it was not is an answer to the ask. The
   tempo row is `TEMPOS` / `tempoRow`, under 1 - Time, next to the two facts
   that are actually tempo.

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

   THE PICTURE WAS THE OPERATOR ITSELF, AND IT IS NOT A PICTURE ANY MORE.
   Paul, 2026-08-26: *"the icons for motifs -- they're too hard to parse. just
   use arrows pointing in opposite directions for widen and so forth. Simple
   unicode symbols or a few of them arranged."* The argument the drawing was
   built on is kept above rather than deleted, and here is what it was: a gate
   vector IS a row of blocks at one-to-one, so `timeArt` ran the very operator
   its button runs over an eight-step toy phrase and drew what came back — "a
   picture that cannot disagree with its button". That was true and it is still
   the better principle; what defeated it is the same thing that defeated the
   pitch row's contour, and it is arithmetic rather than taste. Eight steps in
   40px is a five-pixel column, drawn twice in two weights of one ink, and the
   difference between `half as busy` and `drop every fourth` at that size is
   which of eight five-pixel marks is missing. Nobody reads that with a thumb
   in the way.

   SO THIS ROW WEARS GLYPHS TOO, and it keeps ONE thing from the drawing: `▪`
   is a step that sounds and `▫` is a step that does not, which is the same
   alphabet the drawing used, said in two marks instead of sixteen. Where a
   face is a pair the first half is quiet and the second is inked (`g0`/`g`,
   `face()` above) so it reads "was, then is". Where the operation is an
   AMOUNT rather than a pattern — twice as busy, half as busy — it says the
   amount: `\u00d72`, `\u00f72`. A count is the one thing a symbol says better than a
   drawing of eight boxes.

   `mk` IS UNTOUCHED AND IS STILL THE ONLY THING THAT DECIDES WHAT THE BUTTON
   DOES. `designTime` runs it against the cell; nothing below draws with it any
   more, so the toy phrase, its degrees and `timeToy` are gone with the picture
   they existed to feed. */
const TIMES = [
  // gateflip — the rhythm's own complement: every rest sounds and every note
  // rests. □■ is the row's alphabet saying the WORD: the beat is the empty
  // one and the off-beat is the one that sounds. (It was drawn as the whole
  // before/after, ■□ → □■, for one edit: four blocks measured 100px on a
  // 390px phone, the row wrapped to two lines, and with no gap between the
  // halves it read as a run of four rather than as a pair. Two glyphs say it.)
  { w: "off the beat",      mk: () => K.complement("gate"),
    g0: "\u25ab", g: "\u25aa" },
  // gat2 / the same with a negative turn — the RHYTHM moves against the degrees,
  // which is the one thing `only` exists to make expressible (kernel.js:122).
  // The arrow is the whole of it: the pattern slides, earlier or later.
  { w: "rhythm earlier",    mk: () => K.only("gate", K.rotate(2)),  g: "\u2190" },
  { w: "rhythm later",      mk: () => K.only("gate", K.rotate(-2)), g: "\u2192" },
  { w: "twice as busy",     mk: () => K.fill(2),  g: "\u00d72" },   // dens2
  { w: "half as busy",      mk: () => K.drop(2),  g: "\u00f72" },   // thin2
  // one note, drawn as two — both inked, because nothing here is silenced
  { w: "each note in two",  mk: () => K.split(2), g: "\u25aa\u25aa" },        // rep2
  // ¾ — three of every four survive, which is exactly what del(4) leaves. The
  // row's block alphabet would spell it ▪▪▪▫ and that is 100px of a 366px line.
  { w: "drop every fourth", mk: () => K.del(4), g: "\u00be" },              // del4
];
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

/* ==========================================================================
   THE BENCH (2026-08-27) — the step rows, rebuilt to nukernel/ideal/composer.html.

   Paul, 2026-08-27: "The original button structure with sliders was more novel
   and comprehensible." — and, later the same day: "Tighten it up. play/hold/
   rest, pitch offset −12 to 12, velocity 0 to 7, tightened to one line, and
   factor in different scales, and accidentals vs locking in scale degrees."

   REVERSAL, WRITTEN DOWN: the three radios and the two 30px range sliders per
   step (2026-08-25's rotation) are gone. Each step is now ONE 52px line —
   [count] [play/hold/rest as one segmented button] [a bipolar pitch bar]
   [a weight bar] — and the kit's checkboxes become velocity-fill cells. What
   does NOT reverse: the tune still runs DOWN the page, the count cells are
   still the playhead's registry (countCell / mark(), untouched), sync() is
   still the one owner of every stated fact, `edited()` is still the only
   commit, and the frozen-page law holds — nothing here is rebuilt or repainted
   by the clock (test/motif-frozen.js A1/A3).

   THE TOUCH LAW (composer.html "gestures"): every drag surface takes
   setPointerCapture on pointerdown, reads its value against its own rect, and
   declares touch-action on the control and only the control. The native
   <input type=range> stays inside each bar as the KEYBOARD channel —
   opacity 0, pointer-events none, focusable — one paint path for both.

   ---- THE VELOCITY MAPPING, THE ONE PLACE IT IS SAID -----------------------
   Paul's range is 0..7 ("velocity 0 to 7"). The DOCUMENT's range stays 0..9 —
   kernel.js clamps velocity at 9 (":424, :2697"), substitutes 5 (mezzo) for a
   missing one, and drums-kit.js's vocabulary is "a ghost is a 2 and an accent
   is a 9". THE SCHEMA IS NOT TOUCHED: old saves load unchanged, and the view
   maps at its own edge, both ways, here and nowhere else.
     view = round(doc * 7/9)   doc = round(view * 9/7)
   view→doc→view is the identity on all eight view values, and the three tap
   words land on the document's own words: ghost view 1 ↔ doc 1 (motif) — hit
   view 4 ↔ doc 5, the kernel's own mezzo — accent view 7 ↔ doc 9.
   DRUM LANES carry two special document values the linear map may not touch:
   1 is the old binary "on" that DEFERS to the hand (kernel.js reads it as
   "kitVel / HAND_VEL / the melody's vel"), and 2 is the kit's own ghost. So a
   lane READS 1 as view 4 (it sounds like the default hit) and 2 as view 1
   (the ghost), and WRITES view 1 as doc 2 — a lane is never handed a 1 by
   this surface, because writing the deferring value would be a bar whose
   width lies about the loudness. */
const V7 = (d) => Math.max(0, Math.min(7, Math.round(d * 7 / 9)));
const V9 = (v) => Math.max(0, Math.min(9, Math.round(v * 9 / 7)));
const laneV7 = (d) => (d <= 0 ? 0 : d === 1 ? 4 : d === 2 ? 1 : V7(d));
const laneV9 = (v) => (v <= 0 ? 0 : v === 1 ? 2 : V9(v));

/* THE PITCH BAR IS A VIEW OVER `deg`, AND THE LATTICE IS THE RECORD'S OWN
   ALPHABET — extracted, never typed. The document stores scale DEGREES
   (kernel vocabulary, clamped -7..7 by the designing buttons); the bar
   displays them at their SEMITONE positions, −12..+12 from the marked zero,
   read through `toGenre(DOC, editSec()).scale` — document.js's own resolution
   (A.scale, else the mode) — and `K.pitch(deg, scale)`, the kernel's own
   degree arithmetic. ONE OWNER: the Bench grows no scale select of its own
   (composer.html's select was a demo); change the Alphabet axis and the ticks
   redraw on the next draw(). A non-heptatonic alphabet (pentatonic, whole
   tone) maps some of deg −7..7 past ±12 semitones; those detents are not
   drawn and a drag cannot land on them, but the KEYBOARD channel (the native
   input, in deg units) still walks the document's full range, so no saved
   value is unreachable.
   THE BAR IS THE SCALE'S, AND THERE IS NO TOGGLE (rewritten 2026-08-28). This
   said "LOCKED MODE ONLY THIS WAVE: composer.html's 'accidentals allowed'
   needs the chromatic/cents alphabet extension (Phase 4), so the toggle is
   drawn REFUSED with its reason (benchRefusal, below) per the no-silent-grey
   law." Paul: *"accidentals need the chromatic alphabet - not wired; the bar
   locks to the scale -- get rid of that."* So the toggle is deleted — see the
   tombstone where `benchRefusal` stood — and what is left is not a locked
   mode, it is the only mode there is: the ticks a drag can land on are the
   record's own alphabet, and a chromatic bar is a document change nobody has
   asked for yet. The Phase 4 note lives in MOTIF.md, where plans live. */
function benchEnv() {
  const SC = (genreFor(editSec()).scale) || MODES[DOC.alphabet.mode] || MODES.aeolian;
  const L = SC.length;
  const semi = (d) => K.pitch(d, SC);
  const pct = (s) => (Math.max(-12, Math.min(12, s)) + 12) / 24 * 100;
  const dets = [];
  for (let d = -7; d <= 7; d++) {
    const s = semi(d);
    if (s >= -12 && s <= 12) dets.push({ d, s });
  }
  // the degree said as a musician says it: 1̂..L̂, with the octave marked
  const degName = (d) => {
    const o = Math.floor(d / L), n = ((d % L) + L) % L + 1;
    return n + "̂" + (o > 0 ? "+8va" : o < 0 ? "₋8va" : "");
  };
  return { SC, L, semi, pct, dets, degName };
}

/* ---- the bipolar pitch bar: fill grows from the marked zero; the ink ticks
   ARE the lattice and only they land; the cap stands on the tick it landed on.

   THE CAP CARRIES NO TEXT SINCE 2026-08-28. Paul: *"Let's get rid of the label
   strings on the pitch sliders."* It printed `3̂` and a `<small>` `+4` — the
   degree said as a musician says it and its semitones — parked at the value.
   WHERE THAT INFORMATION IS: the cap is parked AT the semitone, on a bar whose
   ink ticks are the record's own lattice and whose centre line is the marked
   zero, so the position IS the reading and it is the only reading a drag can
   produce. The <b> element STAYS, empty: it is the cap — the thing your thumb
   is on — and nu.css gives it the plate, the 38px height and the `--sl-grab`
   width. Deleting the element would have deleted the handle.
   AND THE WORDS ARE NOT GONE FROM THE PAGE, only from the glass: `aria-label`
   names the step and `aria-valuetext` still says "degree 3̂, +4 semitones" on
   every paint, which is what a screen reader reads and what test/bench.test.js
   B1 now measures the render against. ---- */
function benchPitch(key, aria, get, set, commitFn, ENV) {
  const wrap = el("span", null, "nu-pit");
  const bar = el("i", null, "nu-pb");
  for (const t of ENV.dets) {
    const tk = el("i", null, "nu-pbt");
    tk.style.insetInlineStart = ENV.pct(t.s) + "%";
    bar.append(tk);
  }
  const fill = el("i", null, "nu-pbf");
  const zero = el("i", null, "nu-pbz");
  bar.append(fill, zero);
  const badge = el("b", null, "nu-pbb");
  const inp = document.createElement("input");
  inp.type = "range"; inp.min = "-7"; inp.max = "7"; inp.step = "1";
  inp.className = "nu-pbin"; inp.dataset.k = key;
  inp.setAttribute("aria-label", aria);
  wrap.append(bar, badge, inp);
  function paint() {
    const v = get();
    inp.value = String(v);
    const s = ENV.semi(v), p = ENV.pct(s);
    if (s > 0) { fill.style.display = ""; fill.style.insetInlineStart = "50%";
                 fill.style.inlineSize = (p - 50) + "%"; }
    else if (s < 0) { fill.style.display = ""; fill.style.insetInlineStart = p + "%";
                      fill.style.inlineSize = (50 - p) + "%"; }
    else fill.style.display = "none";
    // the cap is empty and stays empty — see the block above; its POSITION is
    // the value, and `aria-valuetext` below is the same value in words
    badge.style.insetInlineStart = Math.max(10, Math.min(90, p)) + "%";
    inp.setAttribute("aria-valuetext",
      "degree " + ENV.degName(v) + ", " + (s >= 0 ? "+" : "") + s + " semitones");
  }
  // the touch law: capture, value against the bar's own rect, land on detents
  let moved = false, x0 = 0, dirty = false;
  const landAt = (e) => {
    const r = bar.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / (r.width || 1)));
    const sT = f * 24 - 12;
    let best = ENV.dets[0], bd = 99;
    for (const t of ENV.dets) {
      const d2 = Math.abs(t.s - sT);
      if (d2 < bd) { bd = d2; best = t; }
    }
    if (best && get() !== best.d) { set(best.d); paint(); dirty = true; }
  };
  wrap.addEventListener("pointerdown", (e) => {
    moved = false; x0 = e.clientX; dirty = false;
    try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
  });
  wrap.addEventListener("pointermove", (e) => {
    if (!wrap.hasPointerCapture || !wrap.hasPointerCapture(e.pointerId)) return;
    if (!moved && Math.abs(e.clientX - x0) < 6) return;
    moved = true; landAt(e);
  });
  wrap.addEventListener("pointerup", (e) => {
    if (!moved) landAt(e);                       // a tap jumps to that detent
    if (dirty) commitFn();
    dirty = false;
  });
  inp.addEventListener("input", () => { set(+inp.value); paint(); });
  inp.addEventListener("change", () => commitFn());
  return { el: wrap, paint, input: inp };
}

/* ---- the weight bar: width is the level, 0..7 view units; tap cycles
   ghost(1) → hit(4) → accent(7) → back where it started, NEVER to 0 —
   rest is the kind button's job (composer.html, "the velocity question") ---- */
function benchVel(key, aria, get, set, commitFn) {
  const wrap = el("span", null, "nu-velA");
  const bar = el("i", null, "nu-vab");
  const fill = el("i", null, "nu-vaf");
  bar.append(fill);
  const num = el("b", null, "nu-van");
  const inp = document.createElement("input");
  inp.type = "range"; inp.min = "0"; inp.max = "7"; inp.step = "1";
  inp.className = "nu-vain"; inp.dataset.k = key;
  inp.setAttribute("aria-label", aria);
  wrap.append(bar, num, inp);
  function paint() {
    const v = get();
    inp.value = String(v);
    wrap.dataset.v = v;
    const f = v / 7;
    fill.style.display = v ? "" : "none";
    fill.style.inlineSize = "calc(8px + (100% - 8px) * " + f.toFixed(4) + ")";
    num.textContent = String(v);
    wrap.classList.toggle("gh", v === 1);
    wrap.classList.toggle("acc", v >= 7);
    wrap.classList.toggle("hi", v >= 6);
    if (v >= 6) { num.style.insetInlineStart = ""; num.style.insetInlineEnd = "8px"; }
    else { num.style.insetInlineEnd = "";
           num.style.insetInlineStart =
             "calc(8px + (100% - 8px) * " + f.toFixed(4) + " + 5px)"; }
    inp.setAttribute("aria-valuetext", "velocity " + v +
      (v === 0 ? ", silent" : v === 1 ? ", ghost" : v >= 7 ? ", accent" : ", hit"));
  }
  let cycStart = 1;                    // where the 4th tap returns to; never 0
  const cycNext = (v) => {
    if (v === 1) return 4;
    if (v === 4) return 7;
    if (v === 7) return cycStart > 0 ? cycStart : 1;
    cycStart = v; return 1;
  };
  const write = (v) => { if (get() !== v) { set(v); paint(); dirty = true; } };
  let moved = false, x0 = 0, dirty = false;
  wrap.addEventListener("pointerdown", (e) => {
    moved = false; x0 = e.clientX; dirty = false;
    try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
  });
  wrap.addEventListener("pointermove", (e) => {
    if (!wrap.hasPointerCapture || !wrap.hasPointerCapture(e.pointerId)) return;
    if (!moved && Math.abs(e.clientX - x0) < 6) return;
    moved = true;
    const r = bar.getBoundingClientRect();
    const v = Math.round((e.clientX - r.left) / (r.width || 1) * 7);
    write(Math.max(0, Math.min(7, v)));
  });
  wrap.addEventListener("pointerup", () => {
    if (!moved) write(cycNext(get()));           // the tap cycle
    if (dirty) commitFn();
    dirty = false;
  });
  inp.addEventListener("input", () => { set(+inp.value); paint(); });
  inp.addEventListener("change", () => commitFn());
  return { el: wrap, paint, input: inp };
}

/* (`benchRefusal` STOOD HERE — a `.nu-benchbar` line above every motif's rows
   carrying "pitch lattice — aeolian, set under Harmony" and a permanently
   disabled `♯ accidentals` button with its reason printed beside it. DELETED
   2026-08-28. Paul: *"accidentals need the chromatic alphabet - not wired; the
   bar locks to the scale -- get rid of that."*

   WHICH OF THE TWO PERMITTED ANSWERS THIS IS, said plainly: THE CONTROL IS
   REMOVED, not made to work. Making it work needs a cents channel beside `deg`
   — a change to the document schema, the compiler and the kernel (the Phase 4
   alphabet extension) — which is another round's file and cannot be faked from
   here. A dead control may not stay drawn, so it is gone.

   AND THE NO-SILENT-GREY LAW IS NOT WEAKENED BY IT. That law says a control
   which cannot reach the sound is drawn REFUSED WITH ITS REASON; it never said
   a control must exist for every idea somebody has had. A toggle that has
   never had a second state is not a refused control — it is a note about the
   future wearing a 44px tap target, printed once per motif, sixteen rows above
   the bars. The plan is recorded where plans are recorded (MOTIF.md, STATE.md)
   and not in the furniture. Refusals that name a REAL state of the record —
   the hold segment on a step with nothing to hold, the two bars on a rest —
   are untouched and still carry their sentence; see `sync()` below, where they
   now carry it as `data-why` on the control itself.

   THE LATTICE POINTER WENT WITH IT for the same reason: the ink ticks on every
   pitch bar ARE that lattice, drawn at the scale's own semitones (benchEnv),
   and the Harmony axis is where the scale is set and says so where it is set.
   A sentence naming the scale over a row of bars that already draw it is the
   page saying a thing twice, once in words. */

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
  // THE RECORD'S OWN LATTICE, once per build — the alphabet only moves through
  // the Alphabet axis, and that is a full draw() (see benchEnv, above)
  const ENV = benchEnv();
  // the note a hold row is still ringing — the same cyclic walk holdOK makes
  const soundingAt = (i) => {
    for (let k = 0; k <= n; k++) {
      const j = ((i - k) % n + n) % n;
      if (H.play[j] === "n") return j;
      if (H.play[j] === "r") return null;
    }
    return null;
  };
  function sync() {
    for (let i = 0; i < steps.length; i++) {
      const s2 = steps[i];
      if (!s2) continue;
      const k = H.play[i];
      for (const [code] of PLAYS) {
        const b = s2.seg[code];
        if (!b) continue;
        b.setAttribute("aria-pressed", String(k === code));
        if (code === "h") b.disabled = !holdOK(i);
      }
      // KIND NEVER CHANGES THE ROW'S GEOMETRY (composer.html ann. 4): a rest
      // or a hold fades its two bars behind one measured line saying why they
      // sleep — classes and opacity only, one 52px line, sixteen times, so the
      // thumb's map of the bar holds. test/bench.test.js measures it.
      s2.row.classList.toggle("is-rest", k === "r");
      s2.row.classList.toggle("is-hold", k === "h");
      // A VELOCITY IS THE FORCE OF AN ATTACK, so it is live under exactly the
      // condition the degree is: a rest has no attack and a hold is the note
      // before it still sounding. Same `live`, computed once — the reason
      // sync() exists at all is that there is one copy of these rules.
      const live = k === "n";
      s2.pit.input.disabled = !live;
      s2.vel.input.disabled = !live;
      s2.pit.paint();
      s2.vel.paint();
      /* WHY A FADED ROW IS FADED — ON THE CONTROLS NOW, NOT PRINTED OVER THEM
         (rewritten 2026-08-28). This wrote a sentence into a `.nu-mutewhy`
         span lying across the pitch cell: "rest — nothing sounds", "held — 3̂
         still rings". Paul: *"Let's get rid of the label strings on the pitch
         sliders. held and rest and the stuff that appears on top."* The span
         is gone and so is the sentence's printing.

         WHAT WAS DELETED AND WHERE ITS INFORMATION IS: "rest" and "held" are
         the two OTHER segments of the kind button on the same row, one of
         which is pressed and blue while the sentence was being printed — the
         page was reading its own control aloud, sixteen times, in a column
         that has no room for it. THE INFORMATION IS VISIBLE IN THE CONTROL.

         AND THE REFUSAL LAW STILL HOLDS, which is the half that is not
         narration: the two bars on a rest row and the hold segment on a step
         with nothing to hold are genuinely REFUSED controls, so each keeps its
         reason ON ITSELF as `data-why` — this page's own refusal idiom
         (tempoRow, ui/selects.js), the thing a gate reads back off the
         rendered artifact (test/text-diet.js T3), and `title` for a hover.
         Deleted when the row is writable again, so no control ever carries a
         reason that has stopped being true. */
      const src = k === "h" ? soundingAt(i) : null;
      const why = k === "r"
        ? "a rest has no attack — say note on this step to write on it"
        : k === "h"
          ? "held — " + (src != null ? ENV.degName(H.deg[src]) + " is still "
              + "ringing" : "a silence is holding") + "; the note it continues "
            + "is where its pitch and weight are set"
          : "";
      for (const c2 of [s2.pit.input, s2.vel.input]) {
        if (why) { c2.dataset.why = why; c2.title = why; }
        else { delete c2.dataset.why; c2.removeAttribute("title"); }
      }
      const hb = s2.seg.h;
      if (hb) {
        if (hb.disabled) {
          hb.dataset.why = "nothing to hold — the step this one would " +
            "continue is a rest, and a silence cannot be held";
          hb.title = hb.dataset.why;
        } else { delete hb.dataset.why; hb.removeAttribute("title"); }
      }
    }
  }
  /* (THE WISDOM RAIL STOOD HERE and it is DELETED, 2026-08-28, with its whole
     plumbing: the `.nu-wisdom` <p> that read "tap a row — the step is read
     here" until you tapped one, the `speak(i)` that wrote a sentence into it
     from four callers, the `modeSet` it held the pitch class against, and the
     `tr.addEventListener("click", …)` on every one of the sixteen rows.

     Paul, 2026-08-28: *"The box that says tap a row - the step is read here
     should just go."*

     WHAT IT SAID AND WHERE THAT INFORMATION IS. Every fact in the sentence was
     already on the row it was about, in the control that owns it: the step and
     the beat are the count cell at the head of the row (big and centred since
     today, and the row goes dark when that step sounds); rest/held are the
     pressed segment of the kind button; the degree and its semitones are where
     the pitch bar's cap is standing on the lattice; the weight word is the
     width of the weight bar. The one fact that was NOT a reading of a control
     — "in the mode" / "the scale's own colour, outside the mode" — is a fact
     about the ALPHABET and is not needed here: the bar's ink ticks are the
     record's own lattice, so a degree that is off it cannot be reached by a
     drag at all, and the Harmony axis is where the alphabet is chosen.

     ITS RESERVE GOES WITH IT AND THAT IS THE MEASURED WIN: nu.css reserved the
     rail at its own worst sentence per width — `calc(3lh + .6em + 2*--bw)`,
     69.3px at 390 and 49.6px at 1280, per motif — so that a sentence changing
     moved nothing under it. A box that is not drawn reserves nothing.) */
  // ONE COMMIT FOR EVERY CONTROL IN THIS GRID, and it is not `changed()`.
  const commit = () => { sync(); edited(cellName); };
  // (THE `benchRefusal` LINE STOOD HERE, above the rows it governed. Deleted
  //  2026-08-28 with the control itself — see its tombstone above. Nothing
  //  prints above the rows now: the grid begins at step 1.)
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

       THE FIRST COLUMN IS THE COUNT, which inverts what this grid used to be.
       The count cells are still `countCell()` and still the playhead's
       registry — a playhead that marks a ROW instead of a column, with no
       change to `mark()` at all, because the registry was always a list of
       cells and never a claim about direction. */
    /* THE BENCH'S OWN SHAPE (2026-08-27, see the block above hookGrid): the
       three radio columns and the two slider columns become three cells —
       kind, pitch, weight — one 52px line per step. `.nu-bench` is the
       geometry's name in nu.css.
       (VELOCITY WAS A COLUMN OF SLIDERS here from 2026-08-25's rotation —
       "Add velocity to motif sliders" — and the column survives as the weight
       BAR: same question, same cell, a control whose width IS the answer.)
       `.nu-bench` is added AFTER stepGrid below — stepGrid assigns className.

       (THE HEADER ROW STOOD HERE and is DELETED, 2026-08-28: `<th>` `m2`,
       then `kind`, `pitch`, `vel`, one row of words over every motif on the
       page. Paul: *"Let's get rid of the label strings on the pitch sliders.
       held and rest and the stuff that appears on top."* WHERE ITS
       INFORMATION IS: `kind` is three segments carrying ♪ — · and an
       `aria-label` per segment; `pitch` is a bipolar bar with the scale's own
       ticks drawn in it and a cap standing on one of them; `vel` is a bar
       whose width is the number printed in its cap. Three words naming three
       controls that name themselves — narration, not labels, and the labels
       they were standing in for are all still in the DOM as `aria-label` and
       `.nu-vh`, so the stylesheet-off reading is unchanged.
        `m2` — the measure number on a multi-bar cell — went with it and its
       information is in the rows: a cell of two measures draws two tables,
       stacked in order, and the count restarting at `1` IS the bar line.
        THE COLUMN WIDTHS DID NOT GO WITH IT. `table-layout: fixed` takes its
       widths from the FIRST ROW whatever its cells are, so nu.css states them
       on the body row's own cells now — `.nu-bench th:first-child` (the count,
       unchanged, it was always the row's own <th>), `td.nu-kindTd` and
       `td.nu-velTd` — and the measured geometry is identical.) */
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
      const ref = steps[i] = { row: tr, seg: {}, pit: null, vel: null };
      /* THE KIND IS ONE SEGMENTED BUTTON (composer.html: "One segmented kind
         button"). The three radios' keys are kept verbatim on the three
         segments, so focus survives the change of face (PROGRAM.md §2.2).
         `aria-pressed` is sync()'s — the loop builds and never states. */
      const segTd = el("td", null, "nu-kindTd");
      const sg = el("span", null, "nu-seg");
      sg.setAttribute("role", "group");
      sg.setAttribute("aria-label", cellName + " step " + (i + 1) + " kind");
      PLAYS.forEach(([code, label]) => {
        const b2 = document.createElement("button");
        b2.type = "button"; b2.className = "nu-segb";
        b2.dataset.k = seq + cellName + "play" + i + code;
        b2.append(el("span", label.slice(0, 1)),
                  el("span", " " + label.slice(2), "nu-vh"));
        b2.setAttribute("aria-label", cellName + " step " + (i + 1) + " " + label.slice(2));
        ref.seg[code] = b2;               // `aria-pressed` / `disabled`: sync()
        b2.addEventListener("click", () => {
          if (b2.disabled || H.play[i] === code) return;
          H.play[i] = code;
          // ...and a rest orphans the holds behind it, so they go with it —
          // leaving them would be a document that says "keep sounding the
          // silence", which the compiler would have to guess about
          if (code === "r")
            for (let k = i + 1; k < n && H.play[k] === "h"; k++) H.play[k] = "r";
          commit();
        });
        sg.append(b2);
      });
      segTd.append(sg); tr.append(segTd);
      /* THE PITCH IS A BAR, NOT A SLIDER — a view over `deg` (the block above
         hookGrid says the whole mapping). A hold row draws the note still
         ringing and a rest row sleeps, both faint and neither writable —
         "don't let me set degree on held or rest notes" (Paul) survives as the
         setter's own guard plus sync()'s disable of the keyboard channel. */
      const pitTd = el("td", null, "nu-pitTd");
      ref.pit = benchPitch(seq + cellName + "deg" + i,
        cellName + " step " + (i + 1) + " degree",
        () => { const src = H.play[i] === "n" ? i : soundingAt(i);
                return src == null ? 0 : H.deg[src]; },
        (v) => { if (H.play[i] === "n") H.deg[i] = v; },
        () => commit(), ENV);
      pitTd.append(ref.pit.el);
      // (`.nu-mutewhy` — the one measured line lying across this cell that
      //  said why a faded row sleeps — was appended here. Deleted 2026-08-28;
      //  sync() above carries the whole argument and the refusal that survives
      //  it.)
      tr.append(pitTd);
      /* THE WEIGHT IS A BAR TOO — 0..7 at the view, 0..9 in the document (the
         one mapping, stated once at V7/V9). Tap cycles ghost/hit/accent and
         never lands on 0; drag writes the other levels. */
      const velTd = el("td", null, "nu-velTd");
      ref.vel = benchVel(seq + cellName + "vel" + i,
        cellName + " step " + (i + 1) + " velocity",
        () => { const src = H.play[i] === "n" ? i
                  : H.play[i] === "h" ? soundingAt(i) : null;
                return src == null ? 0 : V7(velOf(src)); },
        (v) => { if (H.play[i] === "n") velArr()[i] = V9(v); },
        () => commit());
      velTd.append(ref.vel.el);
      tr.append(velTd);
      // (`tr.addEventListener("click", () => speak(i))` stood here — sixteen
      //  listeners whose only job was to write the wisdom rail's sentence.
      //  Deleted 2026-08-28 with the rail; a tap on a row now does exactly
      //  what the control under the thumb does and nothing else.)
      t.append(tr);
    }
    stepGrid(parent, t);          // sixteen ROWS: no pane, and nothing to swipe
    t.classList.add("nu-bench");  // after stepGrid — it ASSIGNS className
  }
  // FIRST WEARING. Everything a cell's contents decide is said here and only
  // here — the loop above builds the controls and never states them.
  sync();
  if (withButtons === false) return;
  /* ===== THE TWO TRANSFORM ROWS LEFT THIS BLOCK, 2026-08-28 ===============
     Paul: *"When I'm in a motif, the motif operations should be the right nav
     elements on the view. The up arrow to take me home should take me back to
     the motif picker."*

     WHAT STOOD HERE: two `<p class="nu-row nu-tf-row">` under the sixteen
     rows — seven pitch operations (backwards, shift left, shift right, upside
     down, up a step, down a step, wider) and seven rhythm ones (off the beat,
     rhythm earlier, rhythm later, twice as busy, half as busy, each note in
     two, drop every fourth) — fourteen 46px marks in two wrapped bands under
     the tune they rewrite. They are the `motifops` LEVEL of `#nu-tray` now
     (`motifOpsTrayItems`, see THE STRIPE), which is the third depth of the
     gutter: root → the bank → this motif's operations.

     EVERY ARGUMENT THE ROWS MADE MOVED WITH THEM, unaltered, because every one
     of them is still the reason: the FACE is one or two glyphs and not a
     drawing ("ten marks in two weights of one ink inside a 40px box is a
     smudge at 40px"); the WORD is still in the DOM as the button's
     `aria-label` and its `.nu-vh` span, so the level still reads as its
     fourteen words in order with the stylesheet off; `op`/`mk` is still the
     only thing that decides what a button does; and the two SETS stay two
     sets — one moves the notes, one moves the beats — separated in the stripe
     by the order they are listed in rather than by a paragraph break, because
     a vertical column has no wrap to break.

     `data-k` MOVED ON PURPOSE AND IS SAID OUT LOUD. It was `g7psalm-backwards`
     — a per-draw sequence number, a cell name and the word — because two
     makers for one cell had to not collide inside one page. A gutter level
     draws ONE set for whichever motif is open, so the key is `motifop-
     backwards` / `motiftime-off the beat`: stable across a redraw, which is
     what `restoreFocus` needs (PROGRAM.md §2.2) and what lets `paintTray`
     repaint the level in place instead of rebuilding fourteen buttons every
     time you transform a tune. No gate presses the old keys (measured: grep).

     WHAT DID NOT GO WITH THEM, AND WHY: `+ measure` / `− measure` below. They
     are not operations ON the tune — they change how LONG the cell is, and
     they come with a reading ("2 measures") that is the answer to the press
     and has to be beside it. A transform rewrites sixteen steps you are
     looking at; a measure button changes how many steps there are, which is
     the same kind of act as `+ motif` in the bank, and that one is in the
     stripe because it grows the SET the stripe is showing. This grows the
     thing the PANEL is showing, so it stays in the panel with it. */
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
// (`kitWas` — a Map remembering WHAT A STEP WAS WORTH BEFORE YOU UNTICKED IT —
//  stood here, and it is a REVERSAL, dated 2026-08-27. A kit step is a LEVEL
//  (kernel.js:2320 reads 2..9 as "an operator said ghost or accent" and 1 as
//  the old binary on), and while the cell was a CHECKBOX the only honest
//  un-tick was 0 and the only honest re-tick was the level it left at — hence
//  the Map. The cell carries its level ON ITS FACE now (Paul, 2026-08-27:
//  "velocity 0 to 7" — composer.html's kit, "the fill's width is the level,
//  the number prints at the cell's edge"), so silencing and restoring are the
//  tap cycle's own arcs — rest → ghost → hit → accent → rest — and a level is
//  never overwritten by a boolean. The Map's job no longer exists.)
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
      /* THE CELL IS A VELOCITY, 0..7, WORN ON ITS FACE (2026-08-27, replacing
         the checkbox — composer.html's kit: "every cell is a chunky button
         that carries a velocity per step; the fill's width is the level, the
         number prints at the cell's edge"). The DOCUMENT keeps its 0..9 lane
         vocabulary untouched; laneV7/laneV9 (the one mapping, stated at V7/V9)
         translate at this edge, and this surface never writes the deferring
         `1`. Tap cycles rest → ghost(1) → hit(4) → accent(7) → rest; a
         sideways drag (pointer-captured) writes any of the eight.
         `touch-action: pan-y` (nu.css .nu-kc): sideways is the value,
         vertical is still the page.
         (The old change-handler's argument survives it: a lane step is a
         LEVEL in a drum cell and nothing on the page reads it but this cell —
         no staff is engraved from the kit and no sheet is gated on one — so
         the only thing to say afterwards is what the cell is now worth, which
         its face and label carry.) */
      const td = el("td", null, "nu-kcTd");
      const c = document.createElement("button");
      c.type = "button"; c.className = "nu-kc";
      c.dataset.k = "kit" + lane + i;
      const kf = el("i", null, "nu-kf"), kn2 = el("b", null, "nu-kn2");
      c.append(kf, kn2);
      const paintKc = () => {
        const dv = arr[i] | 0, v = laneV7(dv);
        c.dataset.v = v;
        kf.style.display = v ? "" : "none";
        kn2.style.display = v ? "" : "none";
        kf.style.inlineSize = "calc(8px + (100% - 20px) * " + (v / 7).toFixed(3) + ")";
        kf.classList.toggle("gh", v === 1);
        kf.classList.toggle("acc", v >= 7);
        kn2.textContent = String(v);
        const say = laneName(lane) + " step " + (i + 1) +
          (v ? ", level " + v + (v === 1 ? " ghost" : v >= 7 ? " accent" : "")
             : ", rest");
        c.setAttribute("aria-label", say); c.title = say;
      };
      // tap cycle: rest -> ghost(1) -> hit(4) -> accent(7) -> rest
      const cycKit = (v) => (v === 0 ? 1 : v <= 1 ? 4 : v <= 4 ? 7 : 0);
      c.addEventListener("click", () => {
        if (c._dragged) { c._dragged = false; return; }   // a drag is not a tap
        arr[i] = laneV9(cycKit(laneV7(arr[i] | 0)));
        paintKc(); edited(cellName);
      });
      // the touch law: capture on the cell, value against its own rect
      let kMoved = false, kX0 = 0, kDirty = false;
      c.addEventListener("pointerdown", (e) => {
        kMoved = false; kX0 = e.clientX; kDirty = false;
        try { c.setPointerCapture(e.pointerId); } catch (err) {}
      });
      c.addEventListener("pointermove", (e) => {
        if (!c.hasPointerCapture || !c.hasPointerCapture(e.pointerId)) return;
        if (!kMoved && Math.abs(e.clientX - kX0) < 6) return;
        kMoved = true; c._dragged = true;
        const r = c.getBoundingClientRect();
        const v = Math.max(0, Math.min(7,
          Math.round((e.clientX - r.left) / (r.width || 1) * 7)));
        if (laneV7(arr[i] | 0) !== v) { arr[i] = laneV9(v); paintKc(); kDirty = true; }
      });
      c.addEventListener("pointerup", () => {
        if (kDirty) edited(cellName);
        kDirty = false;
      });
      paintKc();
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
// BY KIND, AND THERE IS ONE TABLE — AND ON 2026-08-28 IT LEFT THIS FILE. The
// three sentences this block has always made are still true and are still the
// reason the table exists, so they are kept here rather than deleted: "The
// glyphs used to be keyed by NAME, from when the voices were called
// line/pad/bass/drums — so a LINE named 'bass' drew the bass mark. A name is
// the composer's; a kind is the machine's. That fix left a second table behind
// it (six keys, five of them a stale copy of these three and only `form` ever
// read), which is the drift this file spends its comments warning about, so it
// is one table and a constant now."
//
// WHAT MOVED AND WHY. `KINDGLYPH`, `FORMGLYPH` (▦ — the form tab is not a
// voice) and `PERFGLYPH` (◈ — "and neither is performance", Paul 2026-08-25)
// are the `kind` and `song` columns of `GLYPH` in ui/glyph.js now, character
// for character. They had to leave because Paul asked for marks on EVERY tab
// row on this page (2026-08-28) and three of those rows are drawn by other
// files — ui/engineer.js's own note says it drew its tabs as WORDS precisely
// so it would not have to copy these three characters out of here. A table two
// files cannot both read is a table that gets copied; extraction is the fix
// this file has recommended for the same hazard four times.
const FORMGLYPH = GLYPH.song.form.g;
const PERFGLYPH = GLYPH.song.performance.g;
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
  : kindGlyph((VOICE(name) || {}).kind);
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
/* ...AND WHICH VOICE IS OPEN, SETTLED IN ONE PLACE (2026-08-28), for the
   reason `settleMotifTab` carries: `bandBlock` and the stripe's `band` level
   both need the answer and neither may be the only one that has it. This
   was two identical lines at the top of two functions. */
const settleVoiceTab = () => { const t = voiceTabs();
  if (!t.includes(tab)) tab = t[0];
  return t; };
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
             <span class="nu-vh"> · yours</span></button></th>

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
  // " · yours", 2026-08-27 — FUTURE.md §5 compressed "1 — you are writing
  // this" to "the fact, not a sentence on a button". The table's own spelling
  // is "take 1 · yours"; the word "take" is not printed here because this
  // button numbers a SECTION, not a take (`performance.take` has its own
  // slider and readout), and a heading may not claim a fact it does not hold.
  if (here) b.append(el("span", " · yours", "nu-vh"));
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
  /* ONE TABLE, AND `reads` IS IN IT FOR EVERY VOICE (Paul, 2026-08-26: "In the
     band you have a table of sections and bars. Then what vocal reads, section
     by section" … "then what vocal does, section by section" … "those should
     all just be one table with the dropdowns right in the table").

     THIS NARROWS AN EARLIER RULE RATHER THAN REPEALING IT. The column used to
     be `kind === "drums"` only, on the argument that Paul's own law — "in
     general where there is ONE option a dropdown is preferred" (2026-08-24) —
     applies to a COLUMN too: thirteen menus that can only say what they
     already say are worse than no column, and the kit's table measured 644px
     with it against 407 without, inside a 366px pane. The `> 1` half of that
     was right and is kept. The `kind === "drums"` half was simply wrong: a
     LINE voice is the one that most often has several motifs to choose
     between — the shipped chant has three — and gating the column on the
     drummer meant the question "what does the cantor read here?" had no answer
     in the row, which is exactly what Paul is reporting.

     ORDER IS HIS ORDER: reads, then does. You pick the tune before you pick
     what happens to it, and that is also the evaluation order — Material
     before Development (AXES.md). */
  const reads = picks && NuAvail.cellsFor(DOC, kind).length > 1;
  const head = editable ? ["", "section", "bars"]
    : picks ? ["", "section", "bars", ...(reads ? ["reads"] : []), "does"]
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
      // ...AND IT IS `openSection` SINCE 2026-08-28, which is the same three
      // writes with the gutter's level added to them — the number in the table
      // and the mark in the stripe are two spellings of one intention, so they
      // are one function and a hand that used either lands in the same place.
      const n = secNumber(s2.id, String(i + 1), i === cur,
                          () => openSection(s2.id));
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
      // reads BEFORE does — the tune, then what happens to it
      if (reads) {
        const td2 = el("td");
        td2.append(selectEl(shSpec("material.cell",
          { voice: voice.name, section: s2.id },
          voice.name + " reads · " + s2.role + " " + (i + 1))));
        tr.append(td2);
      }
      const td = el("td");
      td.append(selectEl(shSpec(NuAvail.devSheetFor(kind),
        { voice: voice.name, section: s2.id },
        voice.name + " · " + s2.role + " " + (i + 1))));
      tr.append(td);
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

/* ---------- THE FORM AS A THING A HAND CAN CHANGE ------------------------
   Paul, 2026-08-28: *"Make the sections into nav items with the ability to add
   them and remove them and recharacterize and move them up and down."*

   THE FORM HAS NEVER BEEN EDITABLE ON THIS PAGE. `precompose` deals a record
   its sections and every control since has been about what happens INSIDE
   them — their role, their bars, their eight nudges, what each voice reads and
   does. There was no way to add a chorus, and no way to drop a section you did
   not want, short of editing JSON. These four functions are that, and every
   one of them is written against the two laws the rest of the document tier
   already keeps.

   LAW ONE: AN ID IS AN ADDRESS AND ADDRESSES DO NOT MOVE. Four maps in this
   record are keyed by `section.id` — every voice's `development`, every
   voice's `material` (the per-section half of `materialAt`'s two-shape value),
   every voice's `desk.trim` (the automation grid), and the page's own
   `formSec`. So REORDERING moves the objects and never the ids, and ADDING
   mints an id that has never been used in this document rather than `"s" +
   length`: `sid(3)` after a remove would collide with the `s3` that a voice's
   development still remembers, and the new section would silently inherit a
   dead one's words. The mint walks the existing `s<n>` ids and takes the
   next number above all of them, so it is unique by arithmetic and still
   reads like the ids `precompose` writes.

   LAW TWO: A DEAD ID IS PRUNED, AND `document.js normalize` IS WHERE. It
   already prunes `development` (fills every live id, deletes every dead one)
   and `desk.trim` (deletes any key that is not a live id, then deletes an
   emptied map and an emptied desk) — so `removeSection` calls it rather than
   repeating it, which is the one-owner law applied to a cleanup.
   THE ONE MAP normalize DOES NOT PRUNE IS `voice.material`, and that is
   MEASURED rather than assumed: its loop over voices touches `development`,
   `material` only when it is a STRING naming a dead cell, and `desk.trim`. A
   removed section therefore leaves an orphan key in every voice that named a
   motif for it — harmless to the SOUND (`materialAt` only ever looks up live
   ids) and a lie in the save, which is the kind of lie that becomes a bug the
   day somebody reuses an id. It is pruned HERE, at the one gesture that can
   create one, and the gap is reported to the round that owns document.js
   rather than patched from a file that does not.

   `push()` IS THE CALLER'S, not these functions'. They are pure edits to
   `DOC`; the four call sites in the gutter each `push(); draw();` the way
   `addVoice` and `addCell`'s do. */
const secMint = () => {
  let n = 0;
  for (const s2 of DOC.form.sections) {
    const m = /^s(\d+)$/.exec(String(s2.id));
    if (m) n = Math.max(n, +m[1] + 1);
  }
  // ...and a document whose ids are not `s<n>` at all still gets a free one,
  // because the loop below is a collision check and not a guess.
  let id = "s" + n;
  while (DOC.form.sections.some((s2) => s2.id === id)) id = "s" + (++n);
  return id;
};
/* ADDING ONE PUTS IT AFTER THE SECTION YOU ARE IN, which is what "add a
   chorus" means when you are standing in the verse before it — and at the END
   when you are standing nowhere, which is what the list itself is. It COPIES
   THE NEIGHBOUR'S LENGTH and takes the neighbour's role, because the useful
   default for "another one of these" is another one of these; a hand that
   wanted something else has the role menu and the bars slider one tap away, in
   the questions the new section opens on.
   AND IT OPENS IT. Same sentence `addVoice` makes about the tab it lands you
   on and `addCell` makes about the motif: you asked for a section, and here
   are its questions. */
function addSection() {
  const secs = DOC.form.sections;
  const i = secs.findIndex((s2) => s2.id === formSec);
  const at = i < 0 ? secs.length - 1 : i;
  const near = secs[at] || {};
  const s2 = { id: secMint(), role: near.role || "verse",
               bars: near.bars || 4 };
  secs.splice(at + 1, 0, s2);
  // EVERY VOICE GETS A WORD FOR IT — `normalize` fills `development` for every
  // live id with the kind's own default, which is the invariant `voiceWord`
  // and both compilers read against. Called here rather than left to `draw()`
  // so the record is legal the instant the splice lands.
  normalize();
  formSec = s2.id;
  setViewSec(secs.indexOf(s2));
  return s2.id;
}
/* MOVING ONE IS A SWAP AND NOT A SPLICE-AND-INSERT, because a swap is what the
   two buttons say ("this section trades places with the one before it") and
   because it is the only rearrangement that cannot renumber anything a hand
   was not looking at. Out of bounds is a NO-OP rather than a clamp: the marks
   that could ask for one are refused with their reason, and a silent clamp
   would make the refused button and the live one do the same thing. */
function moveSection(i, d) {
  const secs = DOC.form.sections, j = i + d;
  if (i < 0 || j < 0 || i >= secs.length || j >= secs.length) return false;
  const t = secs[i]; secs[i] = secs[j]; secs[j] = t;
  setViewSec(j);
  return true;
}
/* REMOVING ONE TAKES ITS WORDS WITH IT. The three maps and the two page
   states, in the order they have to happen: the material map first (this
   function is its only pruner — see LAW TWO), then the splice, then
   `normalize`, which is what prunes `development` and the automation grid off
   the ids that are now dead. `formSec` lands on the NEIGHBOUR rather than on
   nothing, because the gutter you are standing in is a list of sections and
   the honest answer to "I removed this one" is the one that took its place. */
function dropSection(id) {
  const secs = DOC.form.sections;
  if (secs.length < 2) return false;
  const i = secs.findIndex((s2) => s2.id === id);
  if (i < 0) return false;
  for (const v of DOC.voices) {
    const m = v.material;
    if (m && typeof m === "object" && !Array.isArray(m)) {
      delete m[id];
      // an emptied map that says nothing but its own default is still a map,
      // and `materialAt` reads `m[""]` off it — so only a map with NOTHING in
      // it collapses, which is `writeDesk`'s law said about this key.
      if (!Object.keys(m).length) delete v.material;
    }
  }
  secs.splice(i, 1);
  normalize();
  const next = secs[Math.min(i, secs.length - 1)];
  formSec = next ? next.id : null;
  setViewSec(Math.min(i, secs.length - 1));
  return true;
}
/* ...AND THE ONE GESTURE THAT OPENS A SECTION, wherever it is made from — the
   gutter's own mark, and the numbered button in the form table, which have
   been two spellings of one intention since the table got numbers. Three
   things move together because one tap caused all three: which section the
   panel is asking about, which section the STAVES are written in (`setViewSec`
   — Paul, 2026-08-25, choosing between the two: "The first is good"), and
   which level of the gutter you are standing on. */
function openSection(id) {
  const i = DOC.form.sections.findIndex((s2) => s2.id === id);
  if (i < 0) return;
  setViewSec(i);
  formSec = id;
  tab = "form";
  trayLevel = "section";
  draw();
  markLink();
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
  /* THE WAY BACK IS `↑`, AND IT IS THE GUTTER'S (2026-08-28). The sentence
     this replaces was right about the principle and wrong about the gesture:
     "THE WAY BACK IS THE TAB YOU CAME FROM, and it is said out loud because it
     is the one gesture on this page that no visible control performs. A 'back'
     button here would be a second owner of where you are." A visible control
     performs it now — the stripe's own `↑` — so the sentence is kept as the
     reason there is still no button in this panel, and the words change. This sentence
     read "tap ▦ form above for the list of sections", which was true while the
     form was one mark in a horizontal strip and the list was a panel state.
     The list is a LEVEL now — the marks beside this heading are this section's
     own three operations, and `↑` out of them is the sections, which is what
     the up button already says when you hold it ("up — out of verse 2, back to
     the sections"). A second sentence naming a second way back would be a
     second owner of where you are, which is what deleting `#secs` was about in
     the first place. So the hint names the LEVEL you are on rather than a
     gesture the gutter already carries. */
  parent.append(el("p", "the marks beside this heading move this section, " +
    "remove it, or add another; its name is the role menu below, and " +
    "↑ goes back to the sections", "nu-hint"));
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
/* ---------- ...AND THE ICONS THAT ARE ACTUALLY ABOUT TEMPO ---------------
   Paul asked twice. First: *"just as there are icons for pitches create icons
   for tempo operations and add them and make them work."* Then, having looked
   at what arrived: *"The rhythm icon adjustments never happened."*

   HE WAS RIGHT AND THE ROW ABOVE IS NOT WRONG. `TIMES` (seven icons, beside
   the motif grid) are RHYTHM operators — off the beat, rhythm earlier, twice as
   busy, each note in two — and every one of them works. They are also, every
   one of them, a change to a PATTERN. Not one of them moves the clock. A
   drummer told to play twice as busy plays twice as many notes at the same
   tempo, which is a different instruction from "take it faster", and the row
   over there answered the first while the ask was the second. So this row is
   the second answer rather than a correction of the first, and the comment on
   `TIMES` keeps its own reasoning with this sentence added to it.

   WHERE THEY LIVE, AND THIS IS THE HALF THAT DECIDED THE SHAPE. Every tempo
   fact this box has is a SONG fact:

     `time.bpm`    the clock, one number for the record (ui/eight.js `number`,
                   40..220 — and the bounds are this page's own, which is why
                   the ones that cannot move say so rather than clamping
                   silently)
     `time.rate`   the reading speed, one value for the record (fields.js
                   RATES = { half: 0.5, dbl: 2 }, plus "as written" = 1 and
                   absent = the anchor's own — avail.js SHEETS["time.rate"])

   There is NO per-section pace and NO per-motif tempo: `ui/derive.js` reads
   `stepsIn(g) / g.rate` for the bar length and `60 / bpm` for the beat, and
   both come off the song. So putting these beside the motif transforms would
   have promised a per-phrase tempo the box cannot express — a picture that
   lies about its own scope. They go under 1 · Time, next to the two facts they
   move, and the row is exactly as long as what the box can really do.

   THE TWO FAMILIES ARE DRAWN DIFFERENTLY BECAUSE THEY ARE DIFFERENT, and this
   is the distinction the row exists to make visible. `bpm` moves the CLOCK: the
   beats get closer together and the bar keeps its four of them. `rate` moves
   the READING: the beats stay where they are and the BAR gets shorter, so the
   pattern comes round twice as often. On a phone at 32px those are two
   pictures — closer ticks, against a nearer bar line — and drawing them the
   same would have been the "make them work" failure in picture form. */
// A METRONOME'S OWN DETENTS (Maelzel's scale, 40-208, extended to this page's
// 220 ceiling). "A little faster" has to mean SOMETHING, and +4 is not a
// musical amount at 60 or at 200 — the ladder is close-spaced where the ear is
// sensitive and wide where it is not, which is the whole reason a metronome is
// built that way. It is a physical table and it is written down rather than
// derived, like the inert list in knobs-extract.js: nothing in this repo can
// measure it.
const MM = [40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 63, 66, 69, 72, 76, 80,
            84, 88, 92, 96, 100, 104, 108, 112, 116, 120, 126, 132, 138, 144,
            152, 160, 168, 176, 184, 192, 200, 208, 220];
const BPM_LO = 40, BPM_HI = 220;
const mmUp = (b) => MM.find((x) => x > b + 0.001);
const mmDown = (b) => [...MM].reverse().find((x) => x < b - 0.001);
// WHAT A TEMPO OPERATION IS: a function from the record's two time facts to the
// same two facts. Nothing else — a tempo may not touch a note, and none of
// these does. `null` back means "this cannot be done from here", which is what
// greys the button and prints its reason.
/* THE FACES: ♩ IS THE CLOCK AND AN ARROW PAIR IS THE BAR, which is the whole
   distinction this row exists to make and the drawing it replaces needed a
   thicker stroke to make. The four tempo buttons all carry the quiet ♩ and
   differ only in their arrow — one for a detent, two for a doubling — so the
   family reads as a family. The reading-speed buttons carry no note at all,
   because the beat does not move: ←→ is the bar pulling apart (half time,
   twice as long) and →← is the bar closing up (double time). Paul's own
   sentence, on the axis where this row's meaning is horizontal: time. */
const TEMPOS = [
  { w: "a little slower", why: (t) => "40 is as slow as this box counts",
    g0: "\u266a", g: "\u2193",
    mk: (t) => (mmDown(t.bpm) == null ? null : { ...t, bpm: mmDown(t.bpm) }) },
  { w: "a little faster", why: (t) => "220 is as fast as this box counts",
    g0: "\u266a", g: "\u2191",
    mk: (t) => (mmUp(t.bpm) == null ? null : { ...t, bpm: mmUp(t.bpm) }) },
  { w: "half the tempo", why: (t) => "half of " + t.bpm + " is " +
      Math.round(t.bpm / 2) + ", and 40 is as slow as this box counts",
    g0: "\u266a", g: "\u2193\u2193",
    mk: (t) => (t.bpm / 2 < BPM_LO ? null : { ...t, bpm: Math.round(t.bpm / 2) }) },
  { w: "twice the tempo", why: (t) => "twice " + t.bpm + " is " + (t.bpm * 2) +
      ", and 220 is as fast as this box counts",
    g0: "\u266a", g: "\u2191\u2191",
    mk: (t) => (t.bpm * 2 > BPM_HI ? null : { ...t, bpm: Math.round(t.bpm * 2) }) },
  // …AND THE OTHER FAMILY: the same beat, read at a different speed. `rate` is
  // what `ui/derive.js` divides `stepsIn(g)` by to get a bar, so rate 2 is a
  // bar half as long — the pattern comes round twice as often over a clock that
  // has not moved. That is what a half-time feel IS, and it is not a tempo
  // change, which is why it is four separate buttons and not two.
  { w: "half time", why: () => "it is already read at half speed", g: "\u2190\u2192",
    mk: (t) => (t.rate === 0.5 ? null : { ...t, rate: 0.5 }) },
  { w: "double time", why: () => "it is already read at double speed", g: "\u2192\u2190",
    mk: (t) => (t.rate === 2 ? null : { ...t, rate: 2 }) },
  { w: "as written", why: () => "it is already read as written", g: "1\u00d7",
    mk: (t) => (t.rate === 1 ? null : { ...t, rate: 1 }) },
  /* …and back to ABSENT, which is the only spelling of a default a rate has.
     THE WORD IS PAUL'S, 2026-08-26: *"'the record's own' -- make that
     'default'."* It read "the record's own speed" here and "the genre's own" in
     the menu two lines below — two spellings of ONE option (`time.rate` absent,
     and this file's own comment already said so: "avail.js SHEETS['time.rate']
     carries the same three-way mapping… this button is the same fourth
     answer"). One owner per fact means one WORD per fact too, so both say
     `default` now. `↺` is the face: not a speed at all, but the way back.
     (`data-k` is "tempo-" + w, so this rename moves the key — test/knobs.js 8e
     presses it by that key and was moved with it.) */
  { w: "the default speed", why: () => "it is already the default", g: "\u21ba",
    mk: (t) => (t.rate == null ? null : { ...t, rate: null }) },
];
/* THE ROW. Same `.nu-tf-row`, same `.nu-vh` word inside the button, same
   `data-k` discipline — focus is put back by that key after every redraw. What
   is new is that a button here CAN be refused, and a refused button on this
   page greys WITH ITS REASON: the reason rides on the control as `data-why`
   (which is how a gate reads it back off the rendered artifact) and is spoken
   as part of the accessible name, and the visible copies are collected into ONE
   sentence under the row rather than eight sentences down it — ui/selects.js's
   own rule for a column of refusals, applied to a row of them. */
/* (`tempoRow(parent)` STOOD HERE — 2026-08-28, and it is the eight tempo
   operations as a `<p class="nu-row nu-tf-row">` under the bpm slider. Paul,
   the same day: *"When I'm in tempo, move the tempo nav to the right nav."*
   They are the `tempo` LEVEL of `#nu-tray` now — `tempoTrayItems`, which is
   this function's body turned inside out: the same `TEMPOS` table, the same
   `d.mk(now())` read twice (once to decide the refusal, once inside the
   listener, because the closure outlives the bpm it was built at), and the
   same three writes on a press.

   ITS ONE ARGUMENT MOVED WITH IT AND IS WORTH REPEATING, because it is the law
   this page keeps everywhere and the row was one of the three places that
   spelled it: "a button that cannot be pressed says WHY: the reason rides on
   the control as `data-why` (which is how a gate reads it back off the
   rendered artifact) and is spoken as part of the accessible name". The gutter
   could not say that at all until today — `icon()` had no refused state — so
   the spelling was EXTRACTED into ui/glyph.js `paintIcon`, the one owner of
   what a gutter button is, rather than copied into the tray. What is LOST is
   the collected sentence under the row (`refused.join(" · ")`, ui/selects.js's
   own rule for a column of refusals): a 56px stripe has no room for a
   paragraph, so the reason is on the mark — in `data-why`, in the accessible
   name, and in the explainer a long press opens — and nowhere else. That is a
   real narrowing and it is the price of the ask.

   `face(d)` went with it too. The stripe spells every mark ONE way (ui/glyph.js
   `icon`), so a two-glyph face is concatenated (`(d.g0 || "") + d.g`) exactly
   as `motifOpsTrayItems` concatenates a transform's — which loses the two
   weights of ink `face()` gave the pair and keeps the picture. Same loss, same
   reason, already argued at `motifOpsTrayItems`.

   `face()` ITSELF IS NOT DEAD: the motif grid still draws it. `TEMPOS` above
   is unchanged and is still the one owner of what a tempo operation is.) */

/* ========================================================================
   THE VOICE'S OWN KNOBS — ONE SYSTEM AT TWO SCALES (VOICE.md)
   ========================================================================
   Paul, 2026-08-25, three sentences that are one feature:

     "give me some UX for editing the human voice."
     "I want to cut breath, add babble, add syllables, and on and on"
     "Give me some basic instrument editors. I feel also we're just not
      using FM enough."

   The second one decides the shape. It names PARAMETERS — breath, babble,
   syllables — and then says "and on and on", so this is not a casting surface
   with a cast of singers on it: it is THE PARAMETERS THIS VOICE DECLARES, AS
   CONTROLS. The third ask is the same feature one level up. So there is one
   table here and the sung voice is its deepest case; the only thing a mouth
   has that nothing else has is a vowel per syllable.

   WHERE IT SITS: after the instrument menu, before the engineer. What the
   voice IS, then what is on it, then where it sits — down the column in
   signal order, which is the same argument `engineer(panel, CTX, name)` two
   lines below already made for putting a cantor's send next to the cantor.

   IT IS SOUND AND NOT SHEET MUSIC, VOWELS INCLUDED, and the reason is
   structural rather than taste: a `material.cells` entry is voice-agnostic and
   alphabet-free (kernel.js:8), and document.js:345 hands the same phrase to
   every line that names it — so two voices reading one cell sing DIFFERENT
   WORDS. A vowel is a property of the throat, not of the notes.

   NO NEW GRAMMAR. A <table> in a pane(): <th> the parameter, <td> the control
   and its readout, a third cell for the derived value — the shape
   ui/engineer.js already builds for a channel strip.

   AND THE LIST IS NOT TYPED. Every row comes from `NuKnobs` (nukernel/knobs.js,
   generated), which is a MEASUREMENT: the extractor probes the parent's own
   pitchedUnit at both ends of every candidate key and keeps the ones that moved
   a parameter. A parse claims `modeld` has 0 usable params; the truth is
   twelve. Nothing in this file decides what a voice can be asked. */

// A USER VALUE IS AN ABSOLUTE OVERRIDE, NEVER A SUM, and clearing back to
// absent returns the derived answer — audio/desk.js:212's own dim-vs-lit law,
// reused rather than reinvented. `voice.set` is the same field document.js:63
// already carries and to-engine.js `synthRecipe` already renames, so no engine
// change and no new document key for any of the 247.
// HOW MANY BEATS A BAR OF THIS RECORD IS — the meter's own pulse, read off the
// kernel's table so the syllable sentence counts bars the way the engine does.
const beatsPerBar = () => K.pulseIn({ meter: K.METERS[DOC.time.meter] });
const knobSet = (voice) => (voice && voice.set) || null;
function writeKnob(voice, key, v) {
  if (!voice.set) voice.set = {};
  voice.set[key] = v;
}
function clearKnob(voice, key) {
  if (!voice.set) return;
  delete voice.set[key];
  // …AND AN EMPTY `set` GOES TOO. Absent is today all the way down: a voice
  // that has had every knob cleared has to be the object it was before the
  // first one was turned, or the record is a different record for having been
  // looked at.
  if (!Object.keys(voice.set).length) delete voice.set;
}
// WHAT THE PARENT ANSWERS WHEN THIS KEY IS ABSENT — asked live, of the engine,
// through audio/to-engine.js `voiceUnit`, which is the one reader both this
// file and the extractor use. It is asked live and not read off knobs.js
// because some derived answers are FUNCTIONS OF ANOTHER AXIS: a mouth's `rate`
// is two syllables a beat (state-engine.js:1613), so the number you are
// overriding moves when you move the tempo, and you can see it move.
function knobDerived(voice, row) {
  const rest = { ...(voice.set || {}) };
  delete rest[row.key];
  const ask = (set) => { try { return voiceUnit(voice.instrument, set, knobState()); }
                         catch (e) { return null; } };
  const u = ask(rest);
  if (!u) return null;
  // A WORD ROW PRINTS ITS WORD. The param behind `voice` is a table index —
  // "tenor" is 4 — and 4 beside a menu of five words is the same silent lie a
  // numeric slider on a word would be. `derivedWord` is the word the extractor
  // measured as reproducing the untouched answer.
  if (row.kind === "vowels" || row.kind === "word") return row.derivedWord;
  if (row.key === "vowelEvery") return u.vowelEvery;
  if (row.param === "module") return u.dx7Preset || u.module;
  const p = u.params ? u.params[row.param] : null;
  if (p == null) return row.derived;
  if (!row.mapped) return p;
  /* FOUR ROWS IN THE FLEET ARE NOT WRITTEN IN THE UNITS THEY COME BACK IN, and
     on those the param is the wrong number to print beside a slider: a choir's
     `cutoff` is `Math.min(9000, c * 2.5)` and a wobble's `wobbleBars` is a bar
     fraction that becomes an LFO in hertz. knobs.js marks them (`mapped`,
     measured), and the answer is found by asking the parent the same question
     backwards — a ternary search for the recipe value that reproduces the
     derived param, on the row's own grid. Thirty-two probes on four rows in
     the whole catalogue, and `pitchedUnit` is pure arithmetic; the alternative
     was a static number that would stop being true the moment you moved the
     tempo, which for `wobbleBars` is exactly what it is a function of. */
  const val = (v) => { const w = ask({ ...rest, [row.key]: v });
    const x = w && w.params ? w.params[row.param] : null;
    return typeof x === "number" ? x : NaN; };
  let lo = row.min, hi = row.max;
  for (let i = 0; i < 32; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    if (Math.abs(val(m1) - p) <= Math.abs(val(m2) - p)) hi = m2; else lo = m1;
  }
  const v = row.min + Math.round(((lo + hi) / 2 - row.min) / row.step) * row.step;
  return Math.abs(val(v) - p) <= Math.abs(p) * 1e-3 + 1e-9 ? v : row.derived;
}
// THE STATE THE PARENT RESOLVES A UNIT AGAINST is this record's tempo and this
// record's take — the same two facts `audio/plan.js` hands it — so a derived
// syllable rate reads "default, 3.07 a second at 92" and not 4 at 120.
const knobState = () => ({ bpm: DOC.time.bpm, seed: takeSeed(DOC) });
// 0 AND 1 ARE BOTH TAKE ONE. Every document written before 2026-08-26 carries
// `take: 0` (songs.js), and the parent's own mouth seeds from `state.seed || 1`
// — so this is the same "absent is today" the rest of the block is built on,
// said once for both readers.
function takeSeed(doc) { return Math.max(1, (doc.performance.take | 0) || 1); }
// WHAT A KEY IS WORTH RIGHT NOW: what you said, or what the record says.
function knobNow(voice, row) {
  const S = knobSet(voice);
  if (S && S[row.key] != null) return S[row.key];
  const d = knobDerived(voice, row);
  return d == null ? (row.kind === "number" ? row.min : row.words && row.words[0]) : d;
}

/* ---------- WHAT THE READOUT SAYS, AND IT SAYS THE MUSICAL THING --------
   The unit is data on the row (knobs.js `unit`), measured out of the param, so
   this is a table and not a switch over parameter names. No invented units:
   a plain 0..1 dial says its own number. */
function knobFmt(row) {
  const u = row.unit;
  if (u === "s") return (v) => (v < 1 ? Math.round(v * 1000) + " ms" : v.toFixed(2) + " s");
  if (u === "ms") return (v) => Math.round(v) + " ms";
  if (u === "Hz") return (v) => (v >= 1000 ? (v / 1000).toFixed(1) + " kHz" : Math.round(v) + " Hz");
  if (u === "hz") return (v) => (v < 10 ? v.toFixed(1) : String(Math.round(v))) + " a second";
  if (u === "beats") return (v) => v + (v === 1 ? " beat a syllable" : " beats a syllable");
  if (u === "take") return (v) => "take " + Math.round(v);
  if (u === "cents") return (v) => Math.round(v) + " cents";
  if (u === "oct") return (v) => v.toFixed(2) + (Math.abs(v) === 1 ? " octave" : " octaves");
  if (u === "bars") return (v) => (+v).toFixed(2) + (v === 1 ? " bar a wobble" : " bars a wobble");
  return (v) => String(Math.round(v * 1000) / 1000);
}
const knobSay = (row, v) => (v == null ? "—"
  : typeof v === "number" ? knobFmt(row)(v) : String(v));

/* ---------- WHAT A KEY IS GATED BY, EVALUATED AGAINST THIS RECORD -------
   A probe cannot see this: it sees `tongue` move `params.tongue` at every
   setting of `babble`, because it does. What it cannot see is that at
   `babble` 1 the seeded driver has already taken the articulators — measured,
   `artic` is a 10 dB control at babble 0.4 and a 0.1 dB one at babble 1.
   `on` means live only above zero; `off` means live only AT zero. */
function knobShut(voice, row, byRow) {
  for (const g of (row.gate || [])) {
    const gr = byRow[g.by];
    if (!gr) continue;
    const now = +knobNow(voice, gr) || 0;
    if (g.when === "on" && !(now > 0)) return g.why;
    if (g.when === "off" && now > 0) return g.why;
  }
  return null;
}

/* ======================================================================
   A THROAT, DRAWN — THE PAD AND ITS RING
   Paul, 2026-08-26: *"Do you think you could come with a nice radial graph
   structure for editing the voice so I can work on multiple dimensions also
   why doesn't the tongue work"* — and, when the geometry was put to him:
   *"I'm fine with the pad idea for the voice editor."*

   THE GEOMETRY, AND WHY IT IS A PAD AND NOT A SPIDER. A spider chart gives
   every parameter one spoke and one number, which is exactly what the table
   under it already does, drawn round instead of down; the only thing it adds
   is a silhouette. The two tongue knobs are not two numbers. `tongue` and
   `tongueD` are a POSITION and a DIAMETER at that position — one constriction,
   two coordinates — and the vowels sit at particular places in that plane
   (tract.lib's own fitted table, `/a/` back and tight, `/i/` forward and
   tight, `/e/` half open). Separated onto two spokes, "move the constriction
   forward while opening it" is two gestures and the plane you are moving in is
   invisible. That is Pink Trombone's whole insight and it is why the pad is
   the middle of this picture and the spokes are the ring around it: the two
   coordinates that interact are a PLACE, and the eight that modify them are
   amounts.

   THE PAD IS NEVER THE ONLY WAY IN. Every value on it is a `<input
   type=range>` in the table directly below, and both write the same
   `voice.set` through the same `writeKnob`. With the stylesheet off the
   picture is a decorative <svg> and the sliders are the page; a screen reader
   is given the sliders and never the picture (`aria-hidden`), because an SVG
   you drag is not a control and pretending it is one is worse than not
   drawing it. THIS PAGE HAS ALREADY PAID FOR TWO VIEWS ON ONE STORE ONCE —
   `listening` and `volume` were two scales of one number and the record went
   silent — so there is exactly one store here and the picture reads it: the
   thumb and the knot are the same number, and during a drag the twin slider's
   own value and readout are moved as well, so the two cannot be seen
   disagreeing even for a frame.

   AND IT IS THE ANSWER TO "WHY DOESN'T THE TONGUE WORK", WHICH IS THE REASON
   IT EXISTS. tract_voice.dsp:104 is
     `a_tp = sm(xf(xf(ktVowTp(vowel), tongue, artic), b_tp, babble))`
   — your tongue is crossfaded against THE VOWEL TABLE's by `artic`, and that
   against THE BABBLER's by `babble`. At `artic: 0` the vowel owns it and the
   knob is inert; the chant's cantor ships `artic: 0.45, babble: 0.4`. The
   tongue is OUTVOTED, not broken. A disabled slider with a sentence beside it
   says so and Paul read past it. So the picture says it instead: the vowel's
   own point is drawn, your handle is drawn, and THE DOT ON THE LINE BETWEEN
   THEM IS WHERE THE TONGUE ACTUALLY GOES. At `artic: 0` that dot sits on the
   vowel, on top of it, and the line has no length — the picture is the
   measurement.
   ====================================================================== */
// THE RING RUNS FROM THE GLOTTIS TO THE LIPS, and the ring's own order is the
// tube's: `voiced`/`open`/`breath` are the glottis (drawn low and behind),
// `nasal` is the velum branch (up), `tongueL` is how long the constriction is,
// `fric`/`fricX` are the noise made at it, and `lips` is the way out (down and
// in front). Clockwise from the lower left — up the left side, over the top,
// down the right — which puts a sagittal head on the page: the source at the
// bottom, the palate over the top, the mouth in front on the right.
//
// AND `tongueL` IS ON A SPOKE FOR A REASON THAT HAS TO BE SAID OUT LOUD.
// It is 0.05..0.5 and it is THE TONGUE'S LENGTH — how much of the tube the
// constriction occupies. It is NOT the tract length, which is what reads as
// gender in Pink Trombone (shorten the tube and every formant rises), and this
// module has no tract length: there is no such slider in tract_voice.dsp.
// Putting `tongueL` on the pad's plane beside a position and a diameter would
// invite exactly that reading. It is an amount, so it is a spoke.
const TUBE = ["voiced", "open", "breath", "nasal", "tongueL", "fric", "fricX", "lips"];
/* WHAT IS NOT ON THE PICTURE, AND WHY EACH ONE IS NOT. `rate`, `seed`,
   `vowels` and `vowelEvery` are the CLOCK and the WORD — what it says and how
   fast, not what shape the throat is in. `attack`, `release`, `vibrato`,
   `vibRate`, `vibRise` and `cutoff` are the note and the microphone: they
   happen to the sound after the throat has made it. `babble` is a mode with a
   menu of its own, and `artic` is the line, not a point. Every one of them
   stays a slider in the table, where it always was. Nothing was taken away to
   make room for this. */
/* `grab` IS A RADIUS IN viewBox UNITS AND IT IS 22 FOR THE REASON THE REST OF
   THIS PAGE IS 44px. At 390 the picture is 366 CSS px for 360 units, so a
   22-unit reach is a 44.7px target — the isolated-control floor nu.css argues
   at the top. At 320 it is 36px and that is NOT a regression the way it would
   be on a button: WCAG 2.5.8's own exception is a control whose function is
   available through another control on the same page that does meet the floor,
   and every value on this picture is a 44px slider in the table under it. The
   picture is the second view; the table is the one that has to clear the bar
   on its own, and it does. */
/* …AND THE TWO DOTS INSIDE THE SQUARE REACH LESS FAR, WHICH IS THE OPPOSITE
   TRADE AND IS ALSO MEASURED. The face of the pad is ITSELF a target — a tap
   anywhere on it places the tongue — and at a 22-unit reach the `artic` dot's
   halo covered the middle of that square: measured on the rendered page, a drag
   from the face's own centre moved `artic` instead, because the dot was 17.6
   units away. So the ring's knots, which have nothing but empty air around
   them, keep 22; the handle and the dot, which sit inside a large target that
   does the same job coarsely, reach 11. Eleven units is 22px at 390 — the 24px
   dense-target floor, not the 44px isolated one, which is the right floor for
   an object inside another object, and 2.5.8's exception covers the rest: both
   are 44px sliders in the table. */
const PAD = { box: 360, r0: 74, r1: 128, lab: 138, grab: 22, grabIn: 11 };
PAD.c = PAD.box / 2;
/* THE viewBox IS CROPPED TO THE INK AND IT IS NOT SQUARE, which is worth the
   two lines of arithmetic it costs below. The picture is as WIDE as the labels
   need — "tongueL" starts at 0.383 of the label radius and runs outward — but
   the topmost and bottommost ink is only the ring at 52 and a word half a line
   past it. Left square it drew 40px of nothing over and under itself at every
   width, which on a phone is 80px of the screen spent on margin. The element
   keeps the cropped ratio (`block-size: auto` on a 360x278 viewBox), so
   preserveAspectRatio still has nothing to letterbox and the pointer arithmetic
   is still one scale factor per axis. */
PAD.vy0 = 42; PAD.vh = 278;
// THE PAD IS THE SQUARE INSCRIBED IN THE SPOKES' ZERO CIRCLE, so a spoke's
// track starts where the pad's own frame stops and the two never overlap: the
// eight angles below are all 22.5 degrees off the square's corners, which are
// the only four points where the square touches the circle.
PAD.side = 2 * PAD.r0 / Math.SQRT2;
// …and one number does for both axes: the square is centred in a picture whose
// horizontal centre is also its vertical one, so `PAD.x0` is the top edge as
// well as the left one.
PAD.x0 = PAD.c - PAD.side / 2;
const padX = (v) => PAD.x0 + v * PAD.side;
const padY = (v) => PAD.x0 + PAD.side - v * PAD.side;
const spokeAng = (i) => (112.5 + i * 45) * Math.PI / 180;
// A VALUE'S PLACE ON ITS OWN SPOKE, in the row's own bracket — knobs.js swept
// the dead travel off both ends, so 0 on the ring is the lowest setting that
// still moves the parameter and 1 is the highest, not the module's declared
// range.
const norm = (row, v) => (row.max === row.min ? 0
  : Math.max(0, Math.min(1, (v - row.min) / (row.max - row.min))));
const unnorm = (row, n) => row.min + Math.max(0, Math.min(1, n)) * (row.max - row.min);
// ...AND ON THE SAME GRID THE SLIDER USES. A pad that wrote 0.4173829 where the
// slider's step is 0.001 would be two views of one number that never show the
// same digits.
function padSnap(row, v) {
  const s = row.step || 0.001;
  const q = Math.min(row.max, Math.max(row.min,
    row.min + Math.round((v - row.min) / s) * s));
  // …AND ROUNDED TO THE STEP'S OWN DECIMALS BEFORE IT IS WRITTEN. Measured on
  // the rendered page: a drag that landed the tongue diameter on the same
  // notch the slider does wrote `0.35000000000000003` where the slider writes
  // `0.35`, because 350 * 0.001 is not 0.35 in binary and `+r.value` on the
  // string "0.35" is. Two views of one number that write different bytes into
  // the record is the whole failure this pad is built to not repeat.
  return +q.toFixed(Math.max(0, Math.min(9, Math.ceil(-Math.log10(s)))));
}

// THREE THINGS AND AN `and`, because the sentences under the picture are
// SENTENCES: "the tongue, how far the tongue reaches, the lips are greyed" is a
// list that reads as a sentence that has lost a verb. (One line here rather
// than in a shared place: nothing else on this page builds a list in prose —
// the sheets and the board all draw their lists as lists.)
const andList = (a) => a.length < 2 ? (a[0] || "")
  : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];

function tractPad(parent, voice, V, byRow, sliders) {
  const T = NuKnobs && NuKnobs.tract;
  const tp = byRow.tongue, td = byRow.tongueD, ar = byRow.artic, bb = byRow.babble;
  if (!T || !tp || !td || !ar) return;

  /* WHAT THE PICTURE IS SHOWING RIGHT NOW — read once, off the same
     `knobNow` the sliders are seated from, and then held in `cur` for the life
     of a drag. A drag does NOT write the document per frame and does NOT call
     draw(): the same split `range()` already keeps (`input` moves the readout,
     `change` commits) is the split here, because recompiling the record on
     every pointermove would thrash the engine mid-bar and rebuilding #app
     under your own finger would destroy the node you are dragging. */
  const cur = {};
  for (const k of ["tongue", "tongueD", "artic", ...TUBE])
    if (byRow[k]) cur[k] = +knobNow(voice, byRow[k]);
  const babble = bb ? +knobNow(voice, bb) : 0;

  // THE VOWELS THE RECORD IS ACTUALLY SAYING. `rowOf` is measured, per voice —
  // the singers' formant tables are indexed a-e-i-o-u and the tube's i-e-a-o-u
  // — so a letter is turned into a row by asking, never by counting.
  const vw = byRow.vowels;
  const word = ((knobSet(voice) || {}).vowels) ||
    (vw && vw.derivedWord) || "a";
  const rows = [...word].map((ch) => (vw && vw.rowOf && vw.rowOf[ch] != null
    ? vw.rowOf[ch] : 2)).filter((n) => n >= 0 && n < 5);
  const said = rows.length ? rows : [2];

  const shutTongue = knobShut(voice, tp, byRow);
  const svg = S("svg", { viewBox: "0 " + PAD.vy0 + " " + PAD.box + " " + PAD.vh,
    class: "nu-pad", "aria-hidden": "true", focusable: "false" });
  // THE ROOM IS TAKEN AT CREATION, which is this file's standing law about
  // anything that draws late (`staffBox`, `scoreReserve`): the <svg> carries
  // its own viewBox and nu.css gives it `block-size: auto`, so the browser
  // computes its height from the intrinsic ratio in the same layout pass that
  // creates it. Nothing here grows after draw() returns and nothing waits on a
  // promise, so there is no anchor for the browser to push the page off.
  const add = (tag, attrs, into) => { const n = S(tag, attrs);
    (into || svg).appendChild(n); return n; };

  /* THE SILHOUETTE FIRST, which is a statement about PAINT ORDER and not about
     reading order. It is the one thing a spider chart is genuinely good for —
     eight numbers as a single shape, so two settings of a throat can be told
     apart at a glance — and it is a translucent fill over half the picture, so
     it is created before everything it must not dim. Drawn last it greyed the
     pad's own face, its vowels and its own eight knots; measured on the
     rendered page at 1280 before this line moved. */
  const shape = add("polygon", { class: "nu-pad-shape" });

  /* ---------- WHERE THE DRIVER CAN GO, DRAWN EXACTLY ------------------
     `babble` does not pull the tongue toward a third POINT, it hands it to a
     seeded walk, and the walk's reachable set is knowable exactly rather than
     approximately: ktBabble (tract.lib:346) slides from a consonant's
     articulation to a vowel's on ONE smoothstep `m`, and position and diameter
     both ride that same `m`, so every place the tongue can be is on the
     straight segment between one of them and one of the five vowels. `ktConOt`
     says which consonants own the closure — a labial does not move the tongue,
     so /b/ /m/ /f/ hold the vowel's own place and contribute nothing. Five
     consonants by five vowels is twenty-five segments and that is the whole
     territory, drawn at the strength of `babble` itself.

     AND THE DRIVER PICKS ITS OWN VOWELS. `vi = floor(h(1)*4.999)` — the
     record's word is not consulted at all, which is the part of "the tongue
     doesn't work" that no slider could ever have said. */
  const web = add("g", { class: "nu-pad-web" });
  if (babble > 0) {
    web.setAttribute("style", "opacity:" + (0.1 + 0.5 * babble).toFixed(3));
    for (let c = 0; c < T.con.name.length; c++) {
      if (!T.con.ot[c]) continue;
      for (let v = 0; v < 5; v++)
        add("line", { x1: padX(T.con.pl[c]), y1: padY(T.con.di[c]),
                      x2: padX(T.vowel.tp[v]), y2: padY(T.vowel.td[v]) }, web);
    }
  }

  // the pad's own frame and its two axes, named on the picture in the words
  // the tube uses. The frame is drawn AFTER the web so the web reads as being
  // behind the glass.
  const face = add("rect", { class: "nu-pad-face", x: PAD.x0, y: PAD.x0,
                width: PAD.side, height: PAD.side, rx: 3 });
  const tick = (t) => {
    add("line", { class: "nu-pad-tick", x1: padX(t), y1: PAD.x0,
                  x2: padX(t), y2: PAD.x0 + PAD.side });
    add("line", { class: "nu-pad-tick", x1: PAD.x0, y1: padY(t),
                  x2: PAD.x0 + PAD.side, y2: padY(t) });
  };
  tick(0.5);
  /* WHICH WAY IS WHICH, ON THE PICTURE. The row labels knobs.js measured are
     sentences ("how far the tongue reaches") and a diagram cannot carry one on
     an axis, so the axis carries its ENDS instead — which is the thing a
     sentence about a direction is trying to say anyway. The four words are the
     tube's own anatomy and not a scale: `tongue` runs from the glottis to the
     lips (tract.lib's consonant table puts /g/ velar at 0.55 and /s/ alveolar
     at 0.84, so the number counts forward), and `tongueD` is a DIAMETER, wide
     at 1 and sealed at 0 — which is why the turbulence term is `(1 - a_td)²`
     and dies at a full closure. */
  const edge = (x, y, anchor, word) => {
    const t = add("text", { class: "nu-pad-edge", x, y, "text-anchor": anchor });
    t.textContent = word; };
  /* AND NOT ONE OF THE FOUR WORDS MAY BE A SPOKE'S WORD. The first cut said
     "throat / lips / open / shut" and two of them collided with the ring: the
     `lips` spoke is the LIP APERTURE and the `open` spoke is how open the
     GLOTTIS is, so the same word named two different numbers on one picture.
     `back`/`front` and `wide`/`closed` are unclaimed, and the sentence under
     the drawing still says which anatomy they mean. */
  const lo = PAD.x0, hi = PAD.x0 + PAD.side, mid = PAD.c;
  edge(lo - 5, mid, "end", "back");
  edge(hi + 5, mid, "start", "front");
  // …and 15 rather than 9 above and below the frame, because at `tongueD` 1 —
  // which is what the module answers with the key absent — the handle sits ON
  // the top edge and a word 9 away was under it.
  edge(mid, lo - 15, "middle", "wide");
  edge(mid, hi + 15, "middle", "closed");

  /* ---------- THE FIVE VOWELS, WHICH ARE THE MAP ----------------------
     Not decoration and not a legend: these are where tract.lib's fitted table
     puts the tongue for i, e, a, o and u, so the pad's plane is the plane the
     vowels live in and a hand can see that /a/ is back and tight and /i/ is
     forward and tight. The letters are the tube's own row order and the map
     from a record's letter to a row is the measured one. */
  // THE LETTER IS THE MARK, and that is a measurement rather than a taste.
  // /i/ and /u/ are 0.078 apart in tongue position and 0.008 in diameter —
  // nine pixels and one — so a dot with its letter beside it drew "u i" as one
  // word on the rendered page at both widths. A centred letter is its own
  // label and the two sit side by side instead of on top of each other.
  const saidLetters = [];
  for (let v = 0; v < 5; v++) {
    const on = said.includes(v);
    const t = add("text", { class: "nu-pad-vlab" + (on ? " is-said" : ""),
                  "text-anchor": "middle",
                  x: padX(T.vowel.tp[v]), y: padY(T.vowel.td[v]) });
    t.textContent = T.vowels[v];
    if (on) saidLetters.push(t);
  }
  // …AND THE WALK BETWEEN THEM, when the record says more than one sound. The
  // parent steps the word once every `vowelEvery` beats and WRAPS, so the path
  // is a closed round and not a line with an end.
  if (said.length > 1)
    add("polygon", { class: "nu-pad-word",
      points: said.map((v) => padX(T.vowel.tp[v]) + "," + padY(T.vowel.td[v])).join(" ") });

  // the ring: the zero circle, the full circle, and one track per spoke
  add("circle", { class: "nu-pad-ring", cx: PAD.c, cy: PAD.c, r: PAD.r0 });
  add("circle", { class: "nu-pad-ring", cx: PAD.c, cy: PAD.c, r: PAD.r1 });
  const knots = [], gated = new Map();
  TUBE.forEach((key, i) => {
    const row = byRow[key];
    if (!row) return;
    const a = spokeAng(i), ux = Math.cos(a), uy = Math.sin(a);
    const shut = knobShut(voice, row, byRow);
    if (shut) gated.set(row.label, shut);
    add("line", { class: "nu-pad-track" + (shut ? " is-off" : ""),
      x1: PAD.c + ux * PAD.r0, y1: PAD.c + uy * PAD.r0,
      x2: PAD.c + ux * PAD.r1, y2: PAD.c + uy * PAD.r1 });
    const t = add("text", { class: "nu-pad-lab" + (shut ? " is-off" : ""),
      x: PAD.c + ux * PAD.lab, y: PAD.c + uy * PAD.lab,
      "text-anchor": ux > 0 ? "start" : "end" });
    // THE WORD ON THE RING IS THE DOCUMENT'S OWN KEY, not a new short name.
    // The row's full label ("how much it phonates") is in the table under the
    // same value; inventing a third spelling for the ring is how one
    // vocabulary becomes two.
    t.textContent = key;
    const knot = add("circle", { class: "nu-pad-knot" + (shut ? " is-off" : ""), r: 6 });
    const at = () => { const n = norm(row, cur[key]), r = PAD.r0 + n * (PAD.r1 - PAD.r0);
      return { x: PAD.c + ux * r, y: PAD.c + uy * r }; };
    const put = () => { const p = at(); knot.setAttribute("cx", p.x); knot.setAttribute("cy", p.y); };
    // WHAT A DRAG ON A SPOKE MEANS: the projection of the pointer onto the
    // spoke's own line, clamped to its track. Distance from the centre alone
    // would let a finger that has wandered a quadrant away still drive the
    // knot, which is how a radial control feels broken.
    const drive = (x, y) => {
      const r = (x - PAD.c) * ux + (y - PAD.c) * uy;
      cur[key] = padSnap(row, unnorm(row, (r - PAD.r0) / (PAD.r1 - PAD.r0)));
    };
    knots.push({ row, key, at, put, drive, live: !shut, node: knot, reach: PAD.grab });
  });
  /* ---------- THE LINE THAT IS `artic` --------------------------------
     One per vowel the record says: from the vowel table's own tongue position
     to yours, with a dot at `artic` along it. THE DOT IS NOT AN ORNAMENT — it
     is `xf(vowel, yours, artic)`, which is literally what the module computes
     before the babbler is mixed in, so the dot is where the tongue goes. At
     artic 0 it is on the vowel and the line has no length: the picture is the
     reason the slider is disabled. Dragging the dot writes `artic`, which is
     the one control here that no gate ever shuts. */
  const arts = said.map((v) => {
    const vx = padX(T.vowel.tp[v]), vy = padY(T.vowel.td[v]);
    const ln = add("line", { class: "nu-pad-artic" });
    const dot = add("circle", { class: "nu-pad-eff", r: 5 });
    const at = () => ({ x: vx + (padX(cur.tongue) - vx) * cur.artic,
                        y: vy + (padY(cur.tongueD) - vy) * cur.artic });
    const put = () => { const p = at();
      ln.setAttribute("x1", vx); ln.setAttribute("y1", vy);
      ln.setAttribute("x2", padX(cur.tongue)); ln.setAttribute("y2", padY(cur.tongueD));
      dot.setAttribute("cx", p.x); dot.setAttribute("cy", p.y); };
    const drive = (x, y) => {
      const dx = padX(cur.tongue) - vx, dy = padY(cur.tongueD) - vy;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1) return;                 // your handle is on the vowel: no line to slide on
      cur.artic = padSnap(ar, Math.max(0, Math.min(1,
        ((x - vx) * dx + (y - vy) * dy) / len2)));
    };
    return { row: ar, key: "artic", at, put, drive, live: true, node: dot,
             reach: PAD.grabIn };
  });

  // YOUR OWN HANDLE, over everything it is being averaged against. (It was
  // "drawn LAST" until the letters this record says were brought forward of it
  // — see the note directly under. Two things are painted after it now and
  // both are deliberate: those letters, and the transparent grab surface,
  // which has no ink at all.)
  const hand = add("circle", { class: "nu-pad-hand" + (shutTongue ? " is-off" : ""), r: 9 });
  /* …AND THE LETTERS THIS RECORD SAYS COME BACK TO THE FRONT, which is a
     one-line move with a reading behind it. At `artic` 0 the effective dot sits
     EXACTLY on the vowel's letter, and drawn in creation order the dot covered
     the letter — measured on the rendered page, the `a` was invisible under it
     at the one setting where the picture's whole claim is "the vowel owns the
     tongue". With the letter on top the dot is subsumed INTO it at 0 and comes
     out from behind it as artic opens, which is the sentence the drawing is
     for. */
  for (const t of saidLetters) svg.appendChild(t);
  const handGrip = {
    row: tp, key: "tongue",
    at: () => ({ x: padX(cur.tongue), y: padY(cur.tongueD) }),
    put: () => { hand.setAttribute("cx", padX(cur.tongue));
                 hand.setAttribute("cy", padY(cur.tongueD)); },
    drive: (x, y) => {
      cur.tongue = padSnap(tp, (x - PAD.x0) / PAD.side);
      cur.tongueD = padSnap(td, 1 - (y - PAD.x0) / PAD.side);
    },
    live: !shutTongue, node: hand, keys: ["tongue", "tongueD"],
    reach: PAD.grabIn,
  };
  // THE HANDLE IS FIRST IN THE HIT ORDER so that at `artic` 1, where the
  // effective dot sits exactly on top of it, the thing under your finger is
  // the one that can still be moved in two dimensions.
  const grips = [handGrip, ...arts, ...knots];

  function paint() {
    for (const g of grips) g.put();
    shape.setAttribute("points", knots.map((k) => { const p = k.at();
      return p.x + "," + p.y; }).join(" "));
  }
  paint();

  /* ---------- ONE FINGER, AND THE PAGE KEEPS THE REST OF THE PICTURE ---
     ui/atlas.js paid for this lesson on the globe and the note there is the
     source: with `touch-action` left to the page, the COMPOSITOR decides whose
     a touch drag is before one line of JS runs, and `preventDefault` on a
     pointermove does not take it back. A pad needs BOTH axes — a vertical drag
     is the constriction opening — so the surfaces that are the control say
     `touch-action: none` (nu.css `.nu-pad-grab`, which is put on the pad's own
     face and on every LIVE grip) and nothing else in the picture does. A swipe
     on the ring's empty air or the margin still scrolls the page, which is
     most of the box — measured at 390 with a real CDP touch: a vertical drag
     inside the face moves the tongue and the window 0px, and the same drag on
     the ring's air scrolls the page 277px and writes nothing.

     WHERE THIS DELIBERATELY DIFFERS FROM THE GLOBE: the globe declines the
     pointer capture on touch, because a globe drag that turns out to be a page
     scroll has to be handed back. Here the gesture has already been decided by
     WHERE it started, so the capture is taken for every pointer type and the
     drag survives a finger that leaves the little square. */
  /* …AND THE FACE DECLINES THE SCROLL ONLY WHILE THE FACE IS A CONTROL.
     Paul, 2026-08-26: *"I can't get to the inside box with the vowels"* — and
     he is right twice over on the shipped chant. The cantor babbles at 0.4, so
     `tongue` and `tongueD` are gated and `handGrip.live` is false; the tap
     below then falls through `if (!best && handGrip.live && ...)` and writes
     nothing, while this rect went on carrying `touch-action: none` over the
     largest object in the picture. Measured on the rendered page at 1280 and
     at 390: a drag from the face's own centre moved no number at either width,
     and the swipe that would have scrolled the page was eaten as well. A dead
     square that also swallows the gesture is worse than no square.
       THE RECT STAYS EITHER WAY, because it is what DELIVERS the events: the
     `artic` dot is 5 units of ink inside an 11-unit reach, and measured,
     `elementFromPoint` at the dot's own centre comes back holding this
     rectangle. Take it away and the slop goes with it. So what is conditional
     is the CLASS — the one property (`touch-action: none`) that takes the
     gesture off the browser — and when the face cannot be moved a swipe over
     it scrolls the page like any other piece of the drawing, which is the rule
     nu.css already states for a greyed knot. */
  const grab = add("rect", { x: PAD.x0, y: PAD.x0, width: PAD.side,
                             height: PAD.side, fill: "transparent" });
  if (handGrip.live) grab.setAttribute("class", "nu-pad-grab");
  // …and a face that cannot be moved is GREYED, in the same ink and by the same
  // class as every other refusal on this page. It was the only dead object in
  // the picture still drawn at full strength, which is how a 158px target came
  // to look like the liveliest thing on it.
  else face.setAttribute("class", "nu-pad-face is-off");
  for (const g of grips) if (g.live) g.node.classList.add("nu-pad-grab");

  /* VIEWBOX COORDINATES FROM A CLIENT POINT, and the arithmetic is honest for
     one reason worth stating. This note used to read "the viewBox is square
     and nu.css keeps the element square, so one scale factor is exact" — and
     then the viewBox was cropped to the ink (PAD.vy0/PAD.vh) and stopped being
     square, which is the kind of change that silently puts a 42-unit offset
     into every hit test. It did: a touch harness written against the old shape
     grabbed the wrong dot until it was fixed. What is actually true, and is
     what the two lines below rely on, is that the ELEMENT keeps the viewBox's
     ratio (`inline-size: 100%; block-size: auto`), so preserveAspectRatio has
     nothing to letterbox and each axis has one exact scale factor — and the
     y axis carries the viewBox's own origin. If the element is ever given a
     height that is not the ratio's, this needs getScreenCTM(). */
  const toVB = (e) => { const b = svg.getBoundingClientRect();
    if (!b.width || !b.height) return null;
    return { x: (e.clientX - b.left) * PAD.box / b.width,
             y: PAD.vy0 + (e.clientY - b.top) * PAD.vh / b.height }; };

  let drag = null;
  const twin = (key) => {
    const s = sliders[key];
    if (!s) return;
    s.r.value = String(cur[key]);
    s.out.textContent = knobFmt(byRow[key])(cur[key]);
  };
  /* ONE POINTER AT A TIME, AND IT IS THE ONE THAT STARTED. A second finger
     landing mid-drag used to re-aim `drag` at whatever was under it, and then
     the FIRST finger's pointerup committed the second finger's number. The
     globe wants two pointers because a pinch is a gesture; a pad has one
     handle and a second finger on it is an accident. */
  svg.addEventListener("pointerdown", (e) => {
    if (drag) return;
    const v = toVB(e); if (!v) return;
    // NEAREST GRIP WITHIN ITS OWN REACH, and "nearest" is compared as a
    // FRACTION of each grip's reach rather than in pixels — otherwise a ring
    // knot 20 units away would beat a dot 12 away that is well inside its own
    // smaller halo. (ui/atlas.js's `nearest` makes the same move for the same
    // reason: what a thumb means by "that one" is relative to the target.)
    let best = null, bd = 1;
    for (const g of grips) {
      if (!g.live) continue;
      const p = g.at(), r = g.reach || PAD.grab;
      const d = ((p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y)) / (r * r);
      if (d < bd) { bd = d; best = g; }
    }
    // A TAP ON THE PAD'S FACE IS A COARSE PLACEMENT, the way a tap on the
    // globe is: nothing else on the page can put the tongue somewhere far away
    // in one gesture, and a knob you have to drag 100px to cross is a knob you
    // stop crossing. Only inside the face, and only when the face is live.
    if (!best && handGrip.live &&
        v.x >= PAD.x0 && v.x <= PAD.x0 + PAD.side &&
        v.y >= PAD.x0 && v.y <= PAD.x0 + PAD.side) best = handGrip;
    if (!best) return;
    drag = best; drag.id = e.pointerId;
    drag.drive(v.x, v.y);
    for (const k of (drag.keys || [drag.key])) twin(k);
    paint();
    try { svg.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const v = toVB(e); if (!v) return;
    drag.drive(v.x, v.y);
    for (const k of (drag.keys || [drag.key])) twin(k);
    paint();
    e.preventDefault();
  });
  // …and the one line the pointer events cannot deliver on a touch screen.
  // `touch-action: none` on the grab surfaces is what actually wins the
  // gesture; this is the belt to that pair of braces, and it is checked for
  // `cancelable` because once a scroll is under way the browser stops asking.
  svg.addEventListener("touchmove", (e) => {
    if (drag && e.cancelable) e.preventDefault();
  }, { passive: false });
  const done = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const g = drag; drag = null;
    try { svg.releasePointerCapture(e.pointerId); } catch (err) {}
    /* ONE RECOMPILE PER GESTURE, at the end of it, and NONE AT ALL IF THE
       NUMBER DID NOT MOVE — so a tap that lands on a knot is not an edit to
       the record. The test is the VALUE and not whether the pointer travelled:
       a flag counting pointermoves stood here and it was the wrong question,
       because a two-pixel wobble inside one step of the slider's grid is not a
       change and a tap on the pad's face a hundred pixels from the handle is. */
    const keys = g.keys || [g.key];
    let wrote = false;
    for (const k of keys) {
      const was = +knobNow(voice, byRow[k]);
      if (Math.abs(was - cur[k]) < 1e-9) continue;
      writeKnob(voice, k, cur[k]); wrote = true;
    }
    if (wrote) changed();
  };
  svg.addEventListener("pointerup", done);
  // A CANCEL IS THE BROWSER TAKING THE GESTURE, so the picture goes back to
  // what the document says rather than keeping half a drag nobody committed.
  svg.addEventListener("pointercancel", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    for (const k of ["tongue", "tongueD", "artic", ...TUBE])
      if (byRow[k]) { cur[k] = +knobNow(voice, byRow[k]); twin(k); }
    paint();
  });

  parent.appendChild(svg);

  /* ---------- WHAT THE PICTURE SAYS, IN WORDS -------------------------
     Because it is `aria-hidden` and because the page must read with the
     stylesheet off, every claim the drawing makes is also made here in the
     row's own measured words. Nothing below is typed twice: the labels and the
     gate sentences are knobs.js's. */
  /* WHAT THE SQUARE IS, BEFORE ANYTHING ABOUT HOW TO MOVE IT. Paul,
     2026-08-26: *"I can't really figure out what that's for."* The paragraph
     that stood here opened on "the five letters are where tract.lib's own
     table puts the tongue" — which is true, and is an answer to a question
     nobody asked first. The question is what the box IS, and the answer is the
     one thing this instrument has that no other voice on the page has: a vowel
     per syllable. So the vowel row is named here, in the row's own measured
     words, and the reader is pointed at the control that writes the word. */
  P(parent, el("span", "the square is the mouth. A vowel is a place to put the " +
    "tongue, and the five letters are where tract.lib's own table puts it for " +
    "i, e, a, o and u — so singing a word is walking between those letters, " +
    "and the dashed round is the walk this record is on. That walk is what " +
    "makes this a voice that SINGS rather than one that is played, and it is " +
    "written in the row called " + ((vw && vw.label) || "what the sounds are") +
    ", at the top of the table below. Everything on the ring outside the " +
    "square is an amount rather than a place.", "nu-why"));
  P(parent, el("span", "across the square is " + tp.label +
    " — the glottis at the left, the lips at the right; up the square is " +
    td.label + " — a wide tube at the top, a closure at the bottom. The hollow " +
    "circle is where your own hand has put the tongue; the dot on the line " +
    "from a letter to it is where the tongue actually goes, and how far along " +
    "that line it sits IS " + ar.label + ". " +
    // ONE CLAUSE, TWO STATES, AND THE DEAD ONE IS NOT SILENT. A page that
    // offers "tap anywhere in the square" while the square is gated is the lie
    // this file spent the round deleting; a page that simply drops the
    // sentence leaves a 158px object with nothing said about it, which is what
    // Paul was looking at.
    (shutTongue
      ? "The square is greyed with the tongue and a tap inside it does nothing " +
        "— the sentence under this picture says why."
      : "Drag any of them, or tap anywhere in the square to put the tongue " +
        "there.") +
    " The sliders below are the same values as numbers.", "nu-why"));
  for (const [why, labels] of (() => {
    const by = new Map();
    const put = (l, w) => { if (!by.has(w)) by.set(w, []); by.get(w).push(l); };
    if (shutTongue) { put(tp.label, shutTongue); put(td.label, shutTongue); }
    for (const [l, w] of gated) put(l, w);
    return [...by].map(([w, l]) => [w, l]);
  })())
    P(parent, el("span", andList(labels) + " " +
      (labels.length > 1 ? "are" : "is") + " greyed here and in the table " +
      "below — " + why + ".", "nu-why"));
  if (babble > 0 && bb)
    P(parent, el("span", "the faint web is every place the driver can put the " +
      "tongue: it slides from a closure to a vowel and both coordinates ride " +
      "the same slide, so that mesh is the whole territory, exactly. It picks " +
      "its own vowels too — the word this record says is not consulted while " +
      "it babbles. This record babbles at " + knobSay(bb, babble) + ".",
      "nu-why"));
}

/* ---------- THE BLOCK ---------------------------------------------------- */
function knobsBlock(parent, voice) {
  const K = NuKnobs;
  if (!K || !voice || typeof voice.instrument !== "string") return;
  const V = K.voices[voice.instrument] || null;
  heading(parent, V && V.mouth ? "the mouth" : "the instrument");

  /* WHAT A VOICE THAT CANNOT BE EDITED SAYS, and the block draws in all four
     cases. The precedent is the board drawing a dead control disabled with its
     reason printed; the counter-precedent is ui/engineer.js:262, where a
     refusal was DELETED the moment it stopped being true — "a control that
     works needs no apology". Both apply: no silent dead control, and no
     apology beside a live one. */
  if (!V) {
    P(parent, el("span", "a recording has one breath in it — this instrument is " +
      "a recording, so there is nothing here to turn. The fader, the EQ and the " +
      "sends are on the engineer below.", "nu-why"));
    return;
  }

  const byRow = {};
  for (const r of V.rows) byRow[r.key] = r;
  // THE OTHER VIEW'S THUMBS, KEPT BY KEY. The pad moves them as your finger
  // moves, so the two views cannot be seen disagreeing even for a frame — see
  // `tractPad` above, and the `listening`/`volume` failure it is guarding
  // against. Nothing else reads this map.
  const sliders = {};
  const t = el("table");
  t.className = "nu-knobs";
  const head = el("tr");
  // THE THIRD COLUMN IS THE VALUE THAT STANDS WHEN THIS VOICE SAYS NOTHING, and
  // `default` is the page's one word for that — Paul, 2026-08-26: *"'the
  // record's own' -- make that 'default'."* It read "the record's own" here and
  // in every cell under it (`thirdCell`), which is the same string in the same
  // table said twice.
  head.append(el("th", "what"), el("th", "how much"), el("th", "default"));
  t.append(head);

  const rowFor = (label, control, third, why) => {
    const tr = el("tr");
    tr.append(el("th", label));
    const td = el("td");
    for (const k of [].concat(control)) if (k) td.append(k);
    tr.append(td);
    const td3 = el("td");
    if (third) td3.append(third);
    tr.append(td3);
    t.append(tr);
    if (why) {
      const wr = el("tr"), wtd = el("td");
      wtd.colSpan = 3; wtd.append(el("span", why, "nu-why"));
      wr.append(wtd); t.append(wr);
    }
    return tr;
  };

  // THE THIRD CELL: the number you are overriding while you are overriding it,
  // and one gesture back to absent. A continuous slider has NO EMPTY DETENT —
  // ui/engineer.js:637 solves that for a detented list by seating "default"
  // at the default's own place in the run, and the trick does not
  // exist for a range. So the derived value is printed, always, and `clear` is
  // beside it only when the key is set.
  const thirdCell = (row) => {
    const S = knobSet(voice), set = S && S[row.key] != null;
    const box = el("span");
    // ALWAYS THE DEFAULT, set or not. VOICE.md §4.3 asks for the derived
    // value printed when the key is ABSENT and for "the number you are
    // overriding on screen the whole time" when it is set — which is the same
    // sentence in both states, so it is said the same way in both. A bare
    // number in the third column with no words on it would be indistinguishable
    // from the slider's own readout two cells to the left.
    box.append(el("span", "default, " +
      knobSay(row, knobDerived(voice, row)), "nu-why"));
    if (set) {
      const b = el("button");
      b.type = "button";
      b.dataset.k = "clear|" + voice.name + "|" + row.key;
      b.append(el("span", "clear"));
      b.setAttribute("aria-label", "clear " + row.label + " on " + voice.name);
      b.addEventListener("click", () => { clearKnob(voice, row.key); changed(); });
      box.append(document.createTextNode(" "), b);
    }
    return box;
  };

  for (const row of V.rows) {
    const shut = knobShut(voice, row, byRow);
    // A GATE FIRST, THEN THE TWO DEPARTURES THIS PAGE MAKES FROM A MODULE'S
    // OWN RANGE — `floorWhy` (a silence the module allows and the page will
    // not) and `ceilWhy` (travel past the point of taste). A gate wins because
    // it is about RIGHT NOW: a greyed row's reason is why it is not moving,
    // and the reason its end stops where it does can wait until it does move.
    const why = shut || row.floorWhy || row.ceilWhy || null;

    /* BABBLE IS A MODE, NOT A SLIDER AMONG EQUALS, because it gates four other
       rows: at 0 the tube holds a vowel, at 1 the seeded driver owns the
       articulators outright, and at 1 `artic` is a 0.1 dB control. Two rows,
       and the amount is still the real `babble` number writing `set.babble`. */
    if (row.key === "babble") {
      const S = knobSet(voice);
      const byHand = S && S.babble === 0;
      const sel = selectEl({
        key: "babble|" + voice.name, label: "how the mouth moves",
        value: byHand ? "hand" : "babble",
        options: [{ value: "hand", label: "by hand" },
                  { value: "babble", label: "it babbles" }],
        set: (v) => { if (v === "hand") writeKnob(voice, "babble", 0);
                      else clearKnob(voice, "babble"); changed(); },
      });
      // …and the third cell of the MODE row says the mode, not the amount: the
      // amount has its own row directly under it and saying "0.7" twice in two
      // rows is two answers to two different questions written identically.
      const modeCell = el("span");
      modeCell.append(el("span", "default, " +
        (+knobDerived(voice, row) > 0 ? "it babbles" : "by hand"), "nu-why"));
      rowFor(row.label, sel, modeCell);
      if (byHand) continue;                 // no amount to show: it is zero
      const now = +knobNow(voice, row);
      const { r, out } = range("babble#" + voice.name, now,
        (v) => writeKnob(voice, "babble", v), Math.max(row.min, 0.01), row.max,
        row.step, "how much it babbles, on " + voice.name, null, knobFmt(row));
      rowFor("how much", [r, document.createTextNode(" "), out], thirdCell(row));
      continue;
    }

    /* THE VOWELS. The word is an ORDERED sequence with repeats, so it is not a
       <select multiple> (that is a set) and this page has no free-text control.
       A slider for how many syllables the word is, and one <select> of five
       letters per syllable — one row, one control, which is what the rotated
       step grid already is. It reads with the stylesheet off and in a screen
       reader, and it can only produce words the alphabet names.

       THE OPTION VALUES ARE LETTERS AND THIS IS NOT A PREFERENCE. Measured
       (knobs.js `rowOf`): "a" is row 0 on a singer and row 2 on the tube,
       because voice_lead reads a CSOUND table indexed a-e-i-o-u and
       tract_voice reads tract.lib's, indexed i-e-a-o-u. A UI that wrote a
       vowel as a NUMBER would sing the wrong vowel on one of the two families
       and nothing would ever fail. */
    if (row.kind === "vowels") {
      const S = knobSet(voice);
      const word = (S && typeof S.vowels === "string" && S.vowels) ||
        row.derivedWord || "a";
      const kids = [];
      const len = range("vowlen#" + voice.name, word.length, (v) => {
        const n = Math.max(1, Math.min(8, v | 0));
        let w = word;
        while (w.length < n) w += w[w.length - 1];
        writeKnob(voice, "vowels", w.slice(0, n));
      }, 1, 8, 1, "how many syllables the word is, on " + voice.name,
        null, (v) => v + (v === 1 ? " syllable" : " syllables"));
      kids.push(len.r, document.createTextNode(" "), len.out);
      const box = el("span");
      box.className = "nu-vow";
      for (let i = 0; i < word.length; i++) {
        box.append(selectEl({
          key: "vow" + i + "|" + voice.name, label: "syllable " + (i + 1),
          value: word[i],
          options: row.words.map((w) => ({ value: w, label: w })),
          set: (v) => { const w = word.split(""); w[i] = v;
                        writeKnob(voice, "vowels", w.join("")); changed(); },
        }));
      }
      kids.push(box);
      rowFor(row.label, kids, thirdCell(row));
      // …AND WHAT THAT WORD ACTUALLY SINGS, derived and not editable. The walk
      // is `step = Math.round(beat / vowelEvery)` and it WRAPS
      // (state-engine.js:2697), so there is no end condition to design and the
      // sentence can always be said.
      const ev = byRow.vowelEvery ? +knobNow(voice, byRow.vowelEvery) : 1;
      const wr = el("tr"), wtd = el("td");
      wtd.colSpan = 3;
      wtd.append(el("span", word.split("").join("-") + ", then round again — one " +
        "every " + ev + (ev === 1 ? " beat" : " beats") + ", so bar 1 sings " +
        word[0] + " and bar 2 sings " +
        word[(Math.round(beatsPerBar() / ev)) % word.length] + ".", "nu-why"));
      wr.append(wtd); t.append(wr);
      continue;
    }

    /* 114 CARTRIDGES, WHICH ARE THE EDITOR FOR A DX7. Its own 147 operator
       sliders cannot be knobs and this is the reason, so nobody tries: the
       generic writer addresses a param as `"/" + root + "/" + label`
       (stream-renderer.js:83) and the DX7's addresses collapse to 32 unique
       last segments — six operators all have an `L1`. Only `dx7Params`, with
       full paths, reaches them. A preset menu IS the editor for a DX7, and 114
       is not a small vocabulary. */
    if (row.kind === "patch") {
      const S = knobSet(voice);
      const cur = (S && S.dx7Preset) || "";
      const sel = selectEl({
        key: "dx7|" + voice.name, label: row.label, value: cur,
        // `default`, AND NOT THE DERIVED WORD AFTER IT, 2026-08-26. This detent
        // read `"as it stands — " + knobSay(...)`, and it was wrong twice over.
        // Wrong in its word: Paul read the page and collapsed the box's two
        // spellings of absence into one — *"'as it stands' and 'nothing set'
        // are too much. get rid of them -- just use 'default' for 'nothing
        // set'"* — and ui/engineer.js:257 `optionsFor` now seats every empty
        // detent on the page under a `default` optgroup with `default` on it.
        // Wrong in its suffix: `thirdCell` two cells to the right already
        // prints "default, " + the same `knobSay(row, knobDerived(...))`, so
        // the derived word was the same string in the same row said twice —
        // the very thing the head-cell comment above objects to. One word, no
        // echo, and the third column keeps the job of saying what stands.
        options: [{ value: "", label: "default", group: "default" }].concat(
          row.words.map((w, i) => ({ value: row.patches[i].dx7Preset,
            label: w, group: "as you say" }))),
        set: (v) => {
          if (!v) { clearKnob(voice, "dx7Preset"); clearKnob(voice, "dx7Alg"); }
          else { const p = row.patches.find((x) => x.dx7Preset === v);
                 writeKnob(voice, "dx7Preset", p.dx7Preset);
                 writeKnob(voice, "dx7Alg", p.dx7Alg); }
          changed();
        },
      });
      rowFor(row.label, sel, thirdCell(row));
      continue;
    }

    /* A WORD IS A <select>, because a numeric slider on a word is a silent lie:
       measured, `voice: "tenor"` gives params.voice 4, `"bass"` gives 1, and
       `voice: 2` falls through to the default 4 — a slider from 1 to 5 with a
       dead notch in the middle that nothing reports. */
    if (row.kind === "word") {
      const S = knobSet(voice);
      const cur = S && S[row.key] != null ? String(S[row.key]) : "";
      const sel = selectEl({
        key: row.key + "|" + voice.name, label: row.label, value: cur,
        ...(why ? { why } : {}),
        // `default`, for the reason written out at the cartridge menu above:
        // one word for absence across the whole page, and no repeat of the
        // derived word that `thirdCell` is already printing in this same row.
        options: [{ value: "", label: "default", group: "default" }].concat(
          // …AND THE COMPASS IS IN THE OPTION, because `voice` does not only
          // change the COLOUR of the line, it moves it: a tenor is 123 to
          // 494 Hz and a soprano is 247 to 1047, and the parent re-folds every
          // note into the seated singer's range. A menu that did not say so
          // would be a menu whose notes moved for no visible reason. Measured
          // per word (knobs.js `compass`), never typed.
          row.words.map((w, i) => ({ value: String(row.values ? row.values[i] : w),
            label: w + (row.compass && row.compass[w]
              ? " — " + row.compass[w][0] + " to " + row.compass[w][1] + " Hz" : ""),
            group: "as you say" }))),
        set: (v) => { if (v === "") clearKnob(voice, row.key);
                      else writeKnob(voice, row.key, isNaN(+v) ? v : +v);
                      changed(); },
      });
      rowFor(row.label, sel, thirdCell(row), why);
      continue;
    }

    // …AND EVERY OTHER ROW IS A SLIDER WITH A READOUT THAT SAYS THE MUSICAL
    // THING. `range()` already carries an <output> and an aria-valuetext.
    const now = +knobNow(voice, row);
    const { r, out } = range(row.key + "#" + voice.name,
      Math.min(row.max, Math.max(row.min, now)),
      (v) => writeKnob(voice, row.key, v),
      row.min, row.max, row.step,
      row.label + ", on " + voice.name, null, knobFmt(row));
    sliders[row.key] = { r, out };
    if (shut) { r.disabled = true; r.setAttribute("aria-disabled", "true");
                r.dataset.why = shut;
                r.setAttribute("aria-label", row.label + ", on " + voice.name + ", " + shut); }
    rowFor(row.label, [r, document.createTextNode(" "), out], thirdCell(row), why);
  }

  /* THE PICTURE GOES OVER THE TABLE, AND IT IS NOT ASKED WHICH INSTRUMENT
     THIS IS. `tractPad` draws when the voice HAS a tongue position and a
     tongue diameter among its MEASURED rows and returns without a mark when it
     does not — which is the same rule the rest of this block runs on ("what a
     voice shows is decided by its `kind` and nothing else"). Today exactly one
     module in the fleet of 27 answers to that and it is `tract_voice`; a
     second tube would get the pad for free and a name check would not have
     given it one. */
  tractPad(parent, voice, V, byRow, sliders);

  pane(parent, t);

  /* A MODELLED VOICE THE PARENT READS ALMOST NOTHING OFF says so, and says it
     with the count in it so the sentence cannot go stale: the number is
     `V.rows.length`, which is what the extractor measured this morning. The
     module's other sliders exist — they are in its own dist/*-meta.json — and
     nothing in the parent's recipe carries them, which is a different fact
     from "this knob does nothing" and reads differently. */
  /* WHAT A DX7 IS EDITED WITH, and the honest budget sentence beside it. Paul
     is right that FM is underused and wrong about why. Measured: `fm2op` is
     one of the cheapest voices in the fleet and it had NO NAME — no SYNTH row
     and no PATCH row, so there was no string a document could write that
     reached it, and the only FM the box could name was one cartridge out of a
     bank of 114 seated by one anchor in 139. Cost was never what was stopping
     it, and the numbers are read off the parent (knobs.js `cost`, `budget` —
     the parent's own `unitCost` and `BUDGET`) rather than typed, so they
     cannot go stale under a retune. */
  const cart = V.rows.find((r) => r.kind === "patch");
  if (cart)
    P(parent, el("span", "the DX7's own 147 operator sliders cannot be " +
      "reached from here — six operators all have an L1, so the addresses " +
      "collapse and only a full path finds one. The cartridge IS the editor, " +
      "and there are " + cart.words.length + " of them. Seating this voice " +
      "costs " + V.cost + " of the record's " + K.budget + "; the two-operator " +
      "FM beside it costs " + (K.voices.fm2op ? K.voices.fm2op.cost : "?") + ".",
      "nu-why"));
  else if (voice.instrument === "fm2op")
    P(parent, el("span", "two operators, and the four numbers that are the " +
      "sound of them. Seating this voice costs " + V.cost + " of the record's " +
      K.budget + "; a DX7 costs " +
      (K.voices.dx7_alg5 ? K.voices.dx7_alg5.cost : "?") + ". Integer ratios " +
      "are tones; 0.25, 1.4 and 3.5 are bells — and none of it is audible " +
      "until you raise how bright it stays.", "nu-why"));
  if (!cart && V.rows.length && V.rows.length < 3)
    P(parent, el("span", "the parent reads only " +
      V.rows.map((r) => r.key).join(" and ") + " off a " +
      voice.instrument.replace(/_/g, " ") + ". The rest of the module's " +
      "sliders exist and nothing carries them yet.", "nu-why"));

  /* A KEY THAT EXISTS AND DOES NOTHING IS NOT DRAWN AS A CONTROL — it is drawn
     as its reason. A knob that does nothing is worse than no knob, and the
     costly one is `vp330/breath`: it is the PAD reading of "synth voice", it is
     exactly where a hand goes looking for a breath knob, and it is 0.4 dB
     across its whole range. So it comes out and says its number. */
  for (const q of V.quiet)
    P(parent, el("span", q.key + " — " + q.why, "nu-why"));

  /* …AND WHAT THIS RECORD SAYS THAT NEVER REACHES THE ENGINE. The `set` block
     is written by hand in the tree and by the atlas from a genre's own recipe,
     and a key nothing reads sits there invisibly — `songs.js` shipped the
     chant's cantor with `vowel: 1.4` and `push: 0.42` for months, and both were
     overwritten every note. This is how the next one gets found. */
  const live = new Set(V.rows.map((r) => r.key));
  live.add("dx7Alg");
  const dead = Object.keys(voice.set || {}).filter((k) => !live.has(k));
  if (dead.length)
    P(parent, el("span", "this record also says " +
      dead.map((k) => k + ": " + JSON.stringify(voice.set[k])).join(", ") +
      ". " + (dead.length === 1 ? "It does not reach" : "Neither reaches") +
      " the engine — nothing in this voice reads " +
      (dead.length === 1 ? "it" : "them") + ".", "nu-why"));

  /* HOW YOU HEAR ANY OF IT, AND THE TWO EXCEPTIONS, STATED RATHER THAN LEFT TO
     BE DISCOVERED. A knob turned while the record plays is heard AT THE TOP OF
     THE NEXT BAR with no rebuild — the path already exists and is traced in
     source: `changed()` -> `push()` -> `commit("box")` -> live.js's `on("box")`
     -> `compile()` -> `barPlan(n).units` -> stream-renderer.js's per-unit param
     GLIDE, changed keys only, `setParamValue` on the LIVE procs with the
     module's own `si.smooth` ramping the step. So there is no audition button
     here: a second way to hear one voice is a second engine on the page, and
     the one-engine law is why this box sounds the way it does. "Play this voice
     alone" already exists on the board below.
     The exceptions are the two things that are NOT a glide, and both of them
     are the instrument moving rather than a knob turning. */
  P(parent, el("span", "press play and turn one of these and you hear it at " +
    "the top of the next bar." +
    (V.rows.some((r) => r.compass)
      ? " Changing who is singing moves the NOTES as well as the colour — the " +
        "line is re-folded into the new voice's range."
      : "") +
    " Changing the instrument itself is a new stream rather than a glide, so " +
    "that one lands when the next bar is built.", "nu-why"));

  /* HELD TONES ON THIS THROAT HAVE GONE QUIET ON THIS PAGE BEFORE, and saying
     so is the honest half of a caveat VOICE.md §11 could not close: held
     eighteen seconds offline at the chant's own twelve numbers the tube is a
     3 dB wobble and not a decay, so the module sustains — and songs.js:252
     records that the RECORD did not. Implying you can hold a note on the tract
     would be a lie; calling the tube broken when the module is not would be
     another one. */
  if (voice.instrument === "tract_voice")
    P(parent, el("span", "held tones on this throat have gone quiet on this " +
      "page before. It is a talker, not a drone.", "nu-why"));
}

function performanceTab(parent) {
  const D = DOC;
  sheetRow(parent, "the feel and the sound",
    NuFields.nudgesFor("performance").map((r) => shSpec("performance." + r.key, {})));
  heading(parent, "the hand");
  /* ---------- A TAKE IS A SEED, AND THIS SLIDER USED TO MOVE NOTHING ------
     Paul, 2026-08-26: *"I can't seem to change seed and do a different take."*
     He was right twice over. `performance.take` was in every document, this
     slider wrote it, `ui/atlas.js:852` printed it — and NO COMPILER READ IT:
     `document.js toGenre` never emitted a seed of any kind, so every record
     this box has made was take one and two performances of one song were the
     same performance to the byte. The only re-roll on the page was the atlas's
     "another take", which does not move this field at all — it re-writes the
     whole record from the genre, which is a different record and not a
     different take. (That button is `#rewrite` in the .nu-bar now, under the
     name of the verb it was always performing.)

     `toGenre` spends it now (`takeOf`, document.js), on the kernel's own dice
     and on the pipe operators' seeds. WHAT MOVES: which chance hits land, the
     hand's seeded micro-timing, the per-hit velocity humanisation, the
     ornament rolls, and where a canon falls. WHAT DOES NOT: any decision —
     nothing the composer chose is downstream of a take, which is what makes
     "the same song, played again" true rather than hoped for.

     THIS SLIDER IS STILL THE VALUE'S ONLY STORE, and since 2026-08-27 it is
     not the only way to move it: the .nu-bar's `#take` button is a GESTURE
     that bumps this same field and plays (Paul: "The another take button
     should just be called take and should move up there"). It writes
     `DOC.performance.take` and calls `changed()`, so this slider is redrawn
     from the document and the two cannot disagree — one owner, two hands on
     it.

     THE READOUT SAYS WHICH TAKE, and 0 and 1 are both take one because absent
     has to be today: every record written before 2026-08-26 says 0. */
  const tk = range("take", D.performance.take,
    (v) => D.performance.take = v, 0, 99, 1, "which take of this record",
    null, (v) => "take " + Math.max(1, v | 0) +
      ((v | 0) <= 1 ? " — the reading it has always had" : ""));
  const tl = el("label");
  tl.append(el("span", "take", "nu-w"), tk.r, document.createTextNode(" "), tk.out);
  FIELD(parent, tl);
  // compressed 2026-08-27 (the text diet, FUTURE.md §2): the caption keeps
  // the two facts — deterministic seed, no chosen note moves — and loses the
  // enumeration the readout's own words already carry.
  P(parent, el("span", "a take is a seed — the hand moves, no chosen note does",
    "nu-why"));
  number("humanize", "humanize", D.performance.humanize,
    (v) => D.performance.humanize = v, parent, 0, 1, 0.05);
  check("ontime", "dead on the grid", D.performance.ontime,
    (v) => D.performance.ontime = v, parent);
}

/* ========================================================================
   THE VOICE'S STRIP, IN THE VOICE — WHAT USED TO BE IN THE MIXER
   ========================================================================
   Paul, 2026-08-28: *"Make a new voice section for all voices. This is where
   every voice is defined -- register, instrument, variables. get rid of the
   engineer table and simply move the sound controls out of the mixer and into
   this section."* And, in the same list: *"A voice has: Instrument voice with
   settings from the mixer (move them from the mixer)."*

   ===== TWO LIVE COPIES EXIST TODAY, AND THIS IS THE LOUD PART ============
   ui/engineer.js IS FENCED THIS ROUND — another slice of this week owns that
   file — so the board's per-voice strip is STILL DRAWN and is still writable.
   Until the follow-up lands, `desk.pan` (say) has two controls on this page:
   the one below and `b|pan|<voice>` on the board's strip. They are not two
   OWNERS of the fact — both go through `NuDeskDoc.writeDesk`, which is and
   remains the one writer — but they are two places a hand can reach it, which
   is exactly the condition this codebase legislates against, and it is stated
   here rather than discovered later. THE DELETION LIST IS IN THE ROUND'S
   REPORT and it is the whole per-voice half of `stripOf`: the three insert
   slots (`slotEl` / `seatSelect` / `b|fxw*` / `b|fxa*` / `b|fxb*`), the sends
   row (`b|genre|`, `b|echo|`, `b|rev|`, `b|main|`), the eq row (`b|eq*|`), the
   pan row (`b|pan|*`), the fader (`b|fader|`) and the mute/solo pair
   (`b|mute|`, `b|solo|`). What stays on the board is what is NOT a voice's:
   the four bus plates, the main strip, the word grid and the meter.

   THE KEYS DO NOT COLLIDE, and that is not luck. `data-k` is how focus is put
   back across a redraw (PROGRAM.md §2.2) and ui/selects.js CONSOLE-ERRORS on a
   duplicate select key in so many words ("two controls would share one
   data-k"), so this surface takes its own namespace — `v|…` for the two
   toggles and `desk.<field>|<voice>` for every menu — while the board keeps
   `b|…` and `ins|…`. The day the board's half goes, these keys stay put.

   WHY IT IS BUILT FROM `NuFields.PARTMIX`'S OWN TABLES AND NOT FROM
   ui/engineer.js. Every control below reads the same registry row the board
   reads — SENDS/SENDLABEL, PANS/PANLABEL, EQ_BANDS, FXWETS, FXPOTS, FXFACE —
   and writes through the same `writeDesk`. It is a second SPELLING of a
   control, which is a cost; it is not a second definition of a fact, which
   would be the bug. (The board's own widgets — `vknob`, `vnum`, `slotEl` —
   are module-private to a fenced file and could not be imported even if the
   fence were open.)

   THE SPELLING IS THIS PAGE'S, NOT THE BOARD'S, and that is the one deliberate
   departure. A send, a pan and a wet are SETTLED PARAMETERS — one value,
   decided once — which is the exact case Paul's own law names for a menu
   ("in general where there is ONE option a dropdown is preferred", 2026-08-24
   evening). The board draws them as vertical sliders because a console is a
   wall of faders and reads as one; a voice's page is a column of questions and
   reads as one. What is a NUMBER ON A LINE stays a slider — the four eq bands
   and the fader — which is the same law's other half (2026-08-23: "use range
   sliders for numeric inputs").

   EVERY REFUSAL IS MEASURED, none is decorative:
     · the MAIN send is refused because there is no such fact: the dry path to
       the main IS the fader, and a second control for it would be the second
       owner this whole block is about;
     · the three INSERT SLOTS are refused whole on a STEREO voice, because
       audio/desk.js `widthKept` drops the chain there — the renderer's insert
       path is mono — and a chip that is silently stripped is this box's
       characteristic bug (a control declared, drawn, costed, reaching no
       sound). `channelFacts` is the engine's own answer about the seated
       channel, read the same way the board reads it;
     · a slot's WET is refused when the chip declares no `mix` param
       (`NuFields.fxHasMix`) — a swept resonant lowpass is a replacement, not a
       blend, so there is no wet to move;
     · a slot's two FACE knobs are drawn only when `FXFACE` says the module has
       them, and are absent rather than refused when it does not: a chip with
       one face param has one knob, and an empty second is not a refusal, it is
       a control that was never declared. */
const deskOfV = (voice) => (voice && voice.desk) || {};
/* ONE MENU OVER ONE PARTMIX ROW. The empty detent is the word `default`
   everywhere on this page (Paul, 2026-08-26: *"just use 'default' for 'nothing
   set'"*), it is FIRST, and it is what `writeDesk` spells as deleting the key
   — so "absent is today" has exactly one spelling from the option to the save. */
function deskMenu(voice, field, table, labels, label, why) {
  const cur = deskOfV(voice)[field];
  return { key: "desk." + field + "|" + voice.name, label,
    options: [{ value: "", label: "default", group: "default" },
      ...Object.keys(table).map((k) => ({ value: k,
        label: (labels && labels[k]) || k, group: "as you say" }))],
    value: cur == null ? "" : String(cur),
    ...(why ? { why } : {}),
    set: (v) => { NuDeskDoc.writeDesk(voice, field, v || null); changed(); } };
}
/* ...AND A WHOLE MENU REFUSED, WITH ITS REASON ON IT. `selectEl` throws on a
   greyed option with no `why` and greys the control itself off `spec.why`, so
   a refusal here is one key and the widget does the rest — the reason rides in
   `data-why` where a gate reads it back off the rendered page, and it is
   spoken as part of the accessible name. */
const deskRefused = (voice, field, label, why) => ({
  key: "desk." + field + "|" + voice.name, label, why,
  options: [{ value: "", label: "default", disabled: true, why }],
  value: "", set: () => {} });

function voiceSound(parent, voice) {
  heading(parent, "the strip");
  const d = deskOfV(voice);
  const F = NuFields;
  /* WHICH CHANNEL THE ENGINE SEATED THIS VOICE IN — `NuDeskDoc.channelVoicesOf`
     is the desk's own roster walk and the same one the board makes, so "is
     this voice stereo" is answered by the engine and not guessed from a name.
     A voice with no channel (an unhired kit) simply has no facts, and the
     stereo refusal below does not fire. */
  let stereo = false;
  try {
    const me = NuDeskDoc.channelVoicesOf(DOC, GENRES)
      .find((c) => c.voice.name === voice.name);
    const facts = me ? (channelFacts(0) || {})[me.key] : null;
    stereo = !!(facts && facts.stereo);
  } catch (e) { stereo = false; }

  // ---- the inserts: up to three, in order ------------------------------
  const keys = (d.fx || []).filter((k) => F.FX[k]).slice(0, F.MAX_FX);
  const insWhy = stereo
    ? "this voice is stereo — the parent's insert path is mono, so the chain " +
      "is dropped rather than silently stripped"
    : null;
  const insSpecs = [];
  for (let i = 0; i < F.MAX_FX; i++) {
    const n = i + 1, here = keys[i] || "";
    /* THE SEAT ITSELF. Writing a seat REWRITES THE WHOLE LIST, because
       `desk.fx` is an ORDERED array and a chain with a hole in it is not a
       chain — clearing slot 2 of three moves slot 3 up into it, exactly as
       ui/engineer.js `writeSlots` does, and the knobs travel with the seat
       they belong to. A chip changed in a seat RESETS that seat's knobs: a
       fraction of another module's range is not a value, it is a coincidence. */
    insSpecs.push({ key: "desk.fx" + n + "|" + voice.name,
      label: "insert " + n,
      options: [{ value: "", label: "default", group: "default",
                  ...(insWhy ? { disabled: true, why: insWhy } : {}) },
        ...Object.keys(F.FX).map((k) => ({ value: k, label: F.FXLABEL[k] || k,
          group: "as you say",
          ...(insWhy ? { disabled: true, why: insWhy } : {}) }))],
      value: here, ...(insWhy ? { why: insWhy } : {}),
      set: (v) => {
        const slots = keys.map((k, j) => ({ k, w: d["fxw" + (j + 1)] || null,
          a: d["fxa" + (j + 1)] || null, b: d["fxb" + (j + 1)] || null }));
        if (v) slots[i] = { k: v, w: null, a: null, b: null };
        else slots.splice(i, 1);
        const live = slots.filter(Boolean).slice(0, F.MAX_FX);
        NuDeskDoc.writeDesk(voice, "fx", live.length ? live.map((x) => x.k) : null);
        for (let m = 1; m <= F.MAX_FX; m++) {
          const x = live[m - 1] || {};
          NuDeskDoc.writeDesk(voice, "fxw" + m, x.w || null);
          NuDeskDoc.writeDesk(voice, "fxa" + m, x.a || null);
          NuDeskDoc.writeDesk(voice, "fxb" + m, x.b || null);
        }
        changed();
      } });
    if (!here) continue;
    insSpecs.push(F.fxHasMix(here)
      ? deskMenu(voice, "fxw" + n, F.FXWETS, F.FXWETLABEL, "wet " + n)
      : deskRefused(voice, "fxw" + n, "wet " + n,
          (F.FXLABEL[here] || here) + " declares no mix param — it is a " +
          "replacement, not a blend, so there is no wet to move"));
    const face = F.FXFACE[here] || [];
    if (face[0]) insSpecs.push(deskMenu(voice, "fxa" + n, F.FXPOTS, F.FXPOTLABEL,
      face[0].label + " " + n));
    if (face[1]) insSpecs.push(deskMenu(voice, "fxb" + n, F.FXPOTS, F.FXPOTLABEL,
      face[1].label + " " + n));
  }
  selectRow(parent, null, insSpecs);

  // ---- the sends, post-insert ------------------------------------------
  // THE BUS NAMES ARE THE RECORD'S OWN (`busNameOf`), which is why they are
  // read and not typed: a record may rename a bus, and a label typed here
  // would go on saying "reverb" about a plate somebody called "the hall".
  const bn = (b) => F.busNameOf(F.BUSES, b);
  selectRow(parent, null, [
    deskMenu(voice, "genre", F.SENDS, F.SENDLABEL, "→ " + bn("genre")),
    deskMenu(voice, "echo",  F.SENDS, F.SENDLABEL, "→ " + bn("echo")),
    deskMenu(voice, "rev",   F.SENDS, F.SENDLABEL, "→ " + bn("rev")),
    deskMenu(voice, "room",  F.SENDS, F.SENDLABEL, "→ " + bn("room")),
    deskMenu(voice, "aux",   F.SENDS, F.SENDLABEL, "→ " + bn("aux")),
    deskRefused(voice, "main", "→ main",
      "the dry path to the main is the fader below — one owner, and a send " +
      "beside it would be a second"),
  ]);

  /* THREE OF THOSE SENDS AND THE `level` BELOW ARE NOT A MOVE, THEY ARE THE
     FIRST CONTROL THOSE FACTS HAVE EVER HAD, and it is said out loud because
     "move the sound controls out of the mixer" is a promise about a SET and
     this is bigger than that set. The board's strip draws three sends — genre,
     echo, reverb — and refuses the main. `room`, `aux` and `lvl` are declared
     in fields.js PARTMIX, are validated by song.js's registry walk, and every
     one of them reaches the sound; MEASURED in audio/desk.js rather than
     assumed:
       · `m.room` and `m.aux` are summed into buses 3 and 4 (desk.js:1690-1691,
         `feed.room += (m.room || 0) + …`, `feed.aux += (m.aux || 0) + S.aux`);
       · `m.lvl` is the part's own gain (desk.js:450, `resolvedPart` —
         `m.lvl * 10^((m.fader + t.db)/20)`), which is the level the FADER
         above rides on top of.
     So they were three facts a hand could only reach by editing JSON — the
     exact inverse of this box's characteristic bug, a fact that ARRIVES and
     was never declared on the page. They are declared now. (`main` is the one
     that stays refused, and its reason is that there is no such fact.) */
  // ---- where it sits, and how loud -------------------------------------
  selectRow(parent, null, [deskMenu(voice, "pan", F.PANS, F.PANLABEL, "pan"),
                           deskMenu(voice, "lvl", F.LEVELS, F.LEVELLABEL, "level")]);
  /* THE FADER IS AN OFFSET AND THE LABEL SAYS SO. It rides ON TOP of the
     record's own level automation (fields.js PARTMIX: "a user touch must not
     fight the automation"), which is why it is ±dB and not a level, and why
     0 is `writeDesk`'s spelling of absent — `!v` deletes the key, so dragging
     back to the middle is the same as never having touched it. */
  number("v|fader|" + voice.name, "fader (dB over the record's own level)",
    F.faderDb(d.fader), (v) => { NuDeskDoc.writeDesk(voice, "fader", v); },
    parent, -24, 12, 0.5);
  /* THE EQ IS ABSOLUTE, not an offset — tone is set and left, so there is no
     offset dance and no per-frame follower (fields.js PARTMIX). Flat
     normalizes to absent and absent builds zero filter nodes. Each band writes
     the WHOLE map, because `eq` is one field with a band->dB object in it and
     `writeDesk` takes fields, not sub-fields. */
  for (const b of F.EQ_BANDS)
    number("v|eq" + b.key + "|" + voice.name, b.label,
      (d.eq && d.eq[b.key]) || 0,
      (v) => { const next = { ...(deskOfV(voice).eq || {}) }; next[b.key] = v;
               NuDeskDoc.writeDesk(voice, "eq", next); },
      parent, -12, 12, 0.5);
  // ...AND THE DESK'S OWN PAIR. Not enums and not choices between values:
  // solo is the one control here that reaches OTHER voices (audio/desk.js
  // partsOf — any solo in the box mutes every part that is not soloed), which
  // is why the sentence says so rather than the word "solo" standing alone.
  check("v|mute|" + voice.name, "mute this voice", !!d.mute,
    (v) => { NuDeskDoc.writeDesk(voice, "mute", v); }, parent);
  check("v|solo|" + voice.name,
    "solo this voice — every voice that is not soloed goes quiet", !!d.solo,
    (v) => { NuDeskDoc.writeDesk(voice, "solo", v); }, parent);
}

function bandBlock(parent) {
  normalize();
  settleVoiceTab();
  /* ===== THE VOICE STRIP LEFT THIS PANEL, 2026-08-28 ====================
     Paul: *"There should be one vertical stripe max with an 'up' icon to get
     to the parent level."* What stood here was `#tabs` — a `<p class="nu-row">`
     holding form, performance, one mark per voice and the three add buttons,
     44.00px of horizontal band above every voice's own controls. It is the
     `band` LEVEL of `#nu-tray` now (see THE STRIPE, which carries every one of
     the comments that were in this block, verbatim, because every one of them
     is still the reason).
     NOTHING ELSE IN THIS FUNCTION MOVED. `tab` is still the page state that
     says which voice is open, `formSec` is still closed by arriving anywhere,
     `SONGTABS` is still what keeps a voice named "form" from being read as the
     form tab, and the `data-k` on every one of those buttons is byte-identical
     — test/shell.js hires a drummer through `[data-k="adddrums"]` and focus is
     put back across a redraw by that key. What the panel got back is the
     44.00px and the two lines of reading order: this block now opens on the
     voice's own facts instead of on a list of the other voices. */
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
  /* ===== A VOICE IS ASKED ONE QUESTION AT A TIME, 2026-08-28 =============
     Paul: *"A voice has: Instrument voice with settings from the mixer (move
     them from the mixer) / What it plays, register, material … / Per-section
     settings."* Three sentences, three FACETS, and `voiceFacet` is which of
     them the panel draws — the marks are the `voice` level of `#nu-tray` (see
     THE STRIPE), and this is the half of that gesture that is a panel.

     WHY IT IS A FILTER AND NOT THREE PANELS. Every control below is where it
     was, in the order it was in, and the two `if`s decide which RUN — so the
     reading order, the `data-k`s, the pane keys and every argument in this
     function's comments are untouched. What is gone is the scroll: the shipped
     chant's cantor measured one column of a cast table, three menus, a throat
     block, a console strip and a five-row picks table, which is the pile
     `sectionDetail` broke the form out of in August, made again one axis over.

     `onForm` AND `onPerf` DO NOT TAKE A FACET, because they are not voices:
     the form's own level is the sections and performance has no siblings at
     all. `SONGTABS` is still what keeps a voice CALLED "form" out of that
     branch, and `settleVoiceTab` is still what decides `tab`. */
  const fInst  = !voice || voiceFacet === "inst";
  const fPlays = !voice || voiceFacet === "plays";
  const fSec   = !voice || voiceFacet === "sec";
  const panel = el("div");
  const t = el("table");
  const row = (label, kid, kid2) => {
    const tr = el("tr");
    tr.append(el("th", label));
    const td = el("td"); td.append(kid);
    if (kid2) td.append(document.createTextNode(" "), kid2);
    tr.append(td); t.append(tr);
  };
  if (kind === "line" && fPlays) {
    const rg = range("reg" + voice.name, voice.cast.reg, (v) => voice.cast.reg = v,
      -2, 2, 1, voice.name + " register");
    row("register", rg.r, rg.out);
    const en = range("entry" + voice.name, voice.cast.entry,
      (v) => voice.cast.entry = Math.max(0, v), 0, 8, 1, voice.name + " enters at bar");
    row("enters at bar", en.r, en.out);
  } else if (kind === "drums" && fPlays) {
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
  /* THE THREE MENUS SPLIT ALONG PAUL'S OWN SENTENCE (2026-08-28). `cast.part`
     and `cast.material` are WHAT IT PLAYS; `sound.instrument` is WHAT IT IS.
     They were one row because they were three settled parameters in a column
     that had no other grouping; the facets are that grouping, and the row is
     two rows on two facets.

     ===== THE VOICE-LEVEL MATERIAL CONTROL STAYS, AND IT IS RELABELLED ======
     Paul: *"i should be able to have a voice play more than one kind of
     material right? We do that in per-section -- so maybe we get rid of
     material and let per-section handle it."* PER-SECTION IS ALREADY THE
     OWNER and has been since 2026-08-24 — `formTable`'s `reads` column is
     `material.cell`, scoped `voice.section`, one menu per row. What this
     control is is the OTHER half of that value, and the document's own shape
     says so: `voice.material` is either a string or a MAP whose `""` key is
     the answer for every section that does not override
     (`document.js materialAt`: `m[secId] != null ? m[secId] : m[""]`). Delete
     the control and `m[""]` becomes unreachable — a fact that decides what a
     voice plays in every section whose menu says "—", with nothing on the page
     that can change it. That is the hidden fact this box legislates against,
     so the control stays and stops pretending to be a second answer: it is
     labelled `default`, which is the exact word `cast.bassStyle` already wears
     for the same relationship ("the cast says `default: walking` and each
     section then says `default` or a departure from it"). One question, asked
     once, with the per-section menus reading against it. */
  if (!onForm && kind === "line" && fPlays)
    selectRow(panel, null, [shSpec("cast.part", { voice: voice.name }),
                            shSpec("cast.material", { voice: voice.name },
                                   "default material")]);
  if (!onForm && kind === "line" && fInst)
    selectRow(panel, null, [shSpec("sound.instrument", { voice: voice.name })]);
  // ...and these two are NOT on the evening list and stay sheets. The drum kit
  // in particular: Paul's question about it in the same message was "can i pick
  // more than one options for the drum kit?", and more-than-one is a row of
  // checkboxes (`multi`), which a <select multiple> is not.
  if (!onForm && kind === "bass" && fPlays)
    sheetRow(panel, null, [shSpec("cast.bassStyle", { voice: voice.name })]);
  // THE MACHINE AND THE BEAT IT READS BY DEFAULT (Paul, 2026-08-25: "show me
  // the options for machine, voice, engineer, levels"). `sound.drumkit` IS the
  // machine — its own label is "machine" — and `cast.material` beside it is the
  // drum cell this kit reads in every section that does not say otherwise, which
  // is the same fact a line's `cast.material` carries and was never offered to a
  // drummer until now. A menu and not a sheet, for the reason the evening of
  // 2026-08-24 gave: it is a settled parameter, one value decided once.
  // THE MACHINE IS WHAT THE KIT *IS* (`sound.drumkit`, its own label is
  // "machine") and the beat it reads by default is what it PLAYS, so the pair
  // that used to be two lines is one line on each of two facets.
  if (!onForm && kind === "drums" && fInst)
    sheetRow(panel, null, [shSpec("sound.drumkit", { voice: voice.name })]);
  if (!onForm && kind === "drums" && fPlays)
    selectRow(panel, null, [shSpec("cast.material", { voice: voice.name },
                                   "default material")]);
  // THE THROAT'S OWN KNOBS, between the instrument menu and the engineer, and
  // the order is the signal path: what the voice IS, then what is on it, then
  // where it sits (VOICE.md §1). Drawn for EVERY voice that names an
  // instrument, because it is one table and the vocal ones are not a special
  // case — a sampled instrument gets the same heading and the sentence that
  // says why there is nothing under it.
  if (!onForm && voice && voice.kind !== "drums" && fInst) knobsBlock(panel, voice);
  // THE STRIP, WHICH IS THE OTHER HALF OF "WHAT IS ON THIS VOICE" — the
  // inserts, the sends, the tone, where it sits and how loud. Drawn for EVERY
  // voice including the kit (a drummer has a channel like anybody else) and in
  // signal order after the throat: what the voice IS, then what is on it, then
  // where it sits (VOICE.md §1) — which is the order the deleted mirror was
  // placed by, kept.
  if (!onForm && voice && fInst) voiceSound(panel, voice);
  /* (`engineer(panel, CTX, voice.name)` STOOD HERE — 2026-08-28. Paul: *"get
     rid of the engineer table and simply move the sound controls out of the
     mixer and into this section."*

     WHAT IT WAS, and its own file's word for it: a `.nu-eng.nu-mirror` table,
     "read-only — set it on the board", printing eleven rows of what the
     record's desk says about this voice, bright where the document names a
     word and dim where the answer is derived, with a link to the board. It
     stopped being two writers on 2026-08-27 (the one-board round) and became
     a MIRROR, which is what it was until tonight.

     ITS OWN ARGUMENT WAS GOOD AND IS ANSWERED RATHER THAN OVERRULED: "a
     cantor's send is one more fact about the cantor, next to its register and
     its throat, not a room next door." Exactly — and a MIRROR of that fact is
     not the fact. `voiceSound` above is the controls themselves, in the place
     the mirror was pointing at, so the sentence is true now in a way a
     read-only table could never make it. A mirror beside the real thing would
     be a third copy of the same eleven rows on one page.

     THE THIRD COLUMN IS THE ONE REAL LOSS and it is named so it can come back:
     "what the value is riding on" — `derivedPartTone` and `deskChannelBase`
     read at the playing box, printing "riding -2.5 dB seated" beside the eq
     band and "the record seats it at -6.0 dB" beside the level. That is the
     best thing the mirror ever did and it is a READING, not a control, so it
     belongs beside these menus as the `nu-hint` half of each row rather than
     as a table of its own. It is in the round's report as the follow-up, with
     the two functions it needs named.

     `engineer` IS NOW AN UNCALLED EXPORT of a fenced file — grep answers 0 for
     `engineer(` outside its own definition. Its deletion is the report's first
     item, together with the per-voice half of the board's `stripOf`. It is NOT
     deleted from here, because ui/engineer.js belongs to another slice of this
     week and a fence is a fence.) */
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
  // EVERY VOICE GETS THE PICKS TABLE (Paul, 2026-08-26: "those should all just
  // be one table with the dropdowns right in the table"). `settingsFirst` was
  // carrying two decisions at once — WHERE the settings panel sits, and
  // WHETHER the section table is interactive — and only the first of those is
  // about a voice's kind. A line voice was getting the read-only variant, so
  // "what does the cantor read in verse 3?" was a sentence the row could not
  // say and could not answer. The panel's position still keys off kind, two
  // lines up and two lines down; the table is now interactive for everyone.
  else if (fSec) formTable(parent, voice, onForm, !!voice);
  // ...and what the bass reads, which is a sentence and not a control
  if (!onForm && kind === "bass" && fSec) bassReadsWhy(parent, voice);
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
  /* THE READS AND THE DOES ARE COLUMNS OF THE TABLE ABOVE, NOT BLOCKS OF THEIR
     OWN (Paul, 2026-08-26: "those should all just be one table with the
     dropdowns right in the table"). Two blocks used to stand here — "what
     <voice> reads, section by section" and "what <voice> does, section by
     section" — drawn only for a LINE, because a bass and a kit already had
     both as columns of `formTable`'s `picks` variant. A line voice now gets
     that same variant, so keeping these would be two controls for one fact:
     it was caught as `duplicate select key material.cell|cantor|c1 — two
     controls would share one data-k`, by the gate whose whole job is that
     the page never says a thing twice.

     WHAT THE BLOCKS SAID THAT THE COLUMNS MUST KEEP SAYING, and do: a menu
     and not a sheet, because "reads hook" is a settled parameter; the word
     beside it is what the voice DOES to what it reads; and the order is
     reads-then-does, which is Material before Development (AXES.md). */
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
// (THE ENGINE READOUT STOOD HERE — `paintEngine`, writing `<p id="engine">`
//  four lines under the transport. It is `logEngine` now, at THE ENGINE'S OWN
//  SENTENCE, WHICH IS NOW A LOG LINE, and its throttle, its one-owner rule and
//  its "only when it actually changed" test moved with it unaltered. Paul,
//  2026-08-28: *"Get rid of the media (mediaEl) held plays offline etc section
//  on the top; move that info to the logger."* This is the same call, from the
//  same feed, at the same rate; only the destination changed.)
on("pos", (d) => {
  clearStepTimers();
  logEngine();
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
  // WHERE THE SCORE IS, off the very number the playhead walks — so the paper
  // and the red note can never disagree about which bar this is. This is the
  // ONE place the transport writes the score's position: the step, when the
  // clock said so, and how fast the steps are going. Everything the score does
  // between beats it does by arithmetic on these three (see `stepNow`), which
  // is what makes the motion continuous without asking the audio thread
  // anything forty times a second.
  const stepSec = 60 / Math.max(30, d.bpm || DOC.time.bpm) / 4;
  scoreStep = base;
  scoreStamp = performance.now();
  scoreRate = rate / stepSec;              // pattern steps a second
  /* AND IT CANNOT BE A BAR THE SECTION HAS NOT GOT. `passAt` estimates the bar
     from the engine's own clock and it can report bar 5 of a four-bar box for
     a tick at the boundary — the runway is ahead of the ear. THIS IS A CLAMP ON
     WHAT THE PAGE SAYS, and it has stopped being a clamp on what the page
     draws. It was both: unclamped, bar 4 of a 4-bar section was a tile that
     was not on the ribbon, so the whole ribbon was rebuilt around a bar of
     rests and the picture jumped 338px once per section (measured 2026-08-25
     at 390px). The picture is the whole record now and cannot be asked for a
     bar it has not got — the position simply walks on into the next section's
     paper (`stepAbs`). What is left is the older half of the sentence, which
     the two-bar window made first inside `scoreWinOf`: the CAPTION names this
     bar, and "bars 5-6 of 4" is a sentence about a bar that does not exist. */
  scoreMeas = Math.max(0, Math.min(scoreLen(Math.max(0, atSec)) - 1,
                                   Math.floor(base / SCORE_SPB)));
  repaintScore();
  lightStep(base);
  for (let sub = 1; sub < 4; sub++)
    stepTimers.push(setTimeout(() => { if (playing) lightStep(base + sub * rate); },
      sub * stepSec * 1000));
  // the board's <meter>s are the AUTOMATION — the gain actually driving each
  // channel at the sounding box — and they move once a beat off this feed. A
  // view never installs its own rAF loop and audio never calls a view.
  // …AND ONLY WHILE THE BOARD IS ON THE PAGE (2026-08-27). Eight tabs out of
  // nine it is `display: none`, and a <meter> written once a beat inside a box
  // nobody is laying out is the same waste `place()` refuses one block up. The
  // meters catch up on the next tick — 60ms, audio/live.js `tickPos` — which
  // is sooner than a thumb can reach the first fader.
  if (openTab === "Mix") paintBoard();
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
  repaintScore(); say();
  // …AND A MOTIF SOUNDING ALONE IS OVER THE MOMENT THE RECORD IS NOT. Two
  // musics at once is the thing the audition refuses (see TAP A MOTIF TO HEAR
  // IT); the refusal has to hold when the transport starts UNDER a sounding
  // motif as well as when a tap arrives during one. The loop goes with it —
  // an editing loop that survived the press would come back the moment you
  // stopped, which is a surprise rather than a state.
  auditionOff();
  // (…AND THE READOUT WAS ASKED FOR HERE. It said: "'pos' stops ticking the
  //  moment the transport does: without this the page would still be claiming
  //  a runway after stop()." Still exactly true, and it is the LOGGER's own
  //  `transport:state` handler that makes the call now — because the log is an
  //  ordered list and the order is the meaning: "play" has to be written
  //  BEFORE the engine's answer to it, so the answer reads as a consequence
  //  rather than as the thing that happened first. This handler runs earlier
  //  in the file than that one, so the two lines would have come out in the
  //  wrong order if the ask stayed here.)
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
  if (h1) {
    h1.textContent = (GENRES[DOC.basis] || {}).label || DOC.basis;
    /* WHAT THIS RECORD IS, SOMEWHERE ELSE (Paul, 2026-08-26: "add actual
       Wikipedia links for each genre we have at the top by the title").
       Resolved at BUILD time against a local copy of the whole English
       Wikipedia — nukernel/wiki.js, derived by nukernel/wiki-extract.js — so
       this is the extraction law in its ordinary form: derive it, commit the
       derivation, ship the table. A LINK IS NOT A FETCH: the href costs no
       request until a reader clicks it, which is why it does not break the
       offline law (test/atlas.js G7 aborts every non-localhost request and
       stays green with 191 wikipedia hrefs in the DOM).

       `textContent =` wipes children, so the link cannot be appended once and
       left — it is rebuilt every draw, synchronously, onto an element that
       already exists. THE PAGE DOES NOT JUMP: nothing here is a host that
       grows after draw() returns, and `#title` is OUTSIDE `#app`, so MOTIF.md's
       frozen-DOM law is not touched either.

       TWO ANCHORS AND THE SIX ROLES GET NO LINK, on purpose: a wrong link is
       worse than none (nukernel/WIKI.md, and `NuWiki.MISSES` carries the
       paragraph for each). The title simply draws without one. */
    const W = window.NuWiki, w = W && W.WIKI[DOC.basis];
    if (w) {
      const a = el("a", w.title.replace(/_/g, " "), "nu-wiki");
      // PROPERTIES, NOT MARKUP: three titles carry an `&` (Contemporary R&B,
      // Alternative R&B, Speak & Spell) and a %26 in an attribute string would
      // need escaping. Assigning `href` escapes nothing and needs to.
      a.href = W.url(DOC.basis);
      a.rel = "noopener";
      a.target = "_blank";
      // WHAT KIND OF ARTICLE IT IS, IN THE DOM AND NOT ONLY IN A TOOLTIP.
      // 31 of the 191 rows are not a genre article: 20 point at the ACT
      // genres.js names in brackets, 4 at the ALBUM that is the era
      // (analogsynthpop -> Speak & Spell, gothsynth -> Violator: the same band
      // nine years apart, which one link to Depeche Mode would erase), 7 at an
      // article wider than the anchor. A reader who sees only "Lo-fi music"
      // beside "Los Angeles 2020" cannot tell which. `title` is NOT an
      // accessible name (this file's own note at :3032), so the word is a REAL
      // span in the DOM — visible, read aloud, and still there with the
      // stylesheet off. `.nu-vh` was the recipe's suggestion and is refused
      // here for one reason: a `::after` or a clipped span would need a
      // VISIBLE counterpart to do its job, and two spellings of one word is
      // the second owner this round exists to delete. 160 of the 191 rows are
      // plain genres and get no span at all.
      a.dataset.kind = w.kind;
      a.title = w.why;
      if (w.kind !== "genre") a.append(el("span", " · the " + w.kind, "nu-kind"));
      h1.append(" ", a);
    }
  }
  const wasKey = document.activeElement && document.activeElement.dataset
    ? document.activeElement.dataset.k : null;
  const wasPicker = opensAPicker(document.activeElement);
  keepPanes();          // ...and every pane's sideways scroll (keepPanes, above)
  // WHERE THE PAGE WAS, KEPT — AND WHO STILL NEEDS IT. The clock stopped
  // rebuilding this page on 2026-08-24 (see the two transport handlers), so
  // the question is fair: a page that is not redrawn under a live finger does
  // not need its focus put back. It is still needed, because draw() has not
  // gone anywhere — every EDIT rebuilds the document, and so does a voice tab,
  // a section tab, a design button and a record swapped in from the atlas.
  // What went is the rebuild NOBODY ASKED FOR; a rebuild you caused by
  // touching something still has to put your thumb back where it was.
  //
  // ...WITH ONE CONTROL EXEMPT SINCE 2026-08-25: a `<select>` a POINTER was
  // last on is not re-focused, because focusing a select re-opens its picker
  // on iOS and that is Paul's "when I select something the box just pops up
  // again". `restoreFocus` and `opensAPicker` carry the measurement.
  //
  /* WHAT THE ANCHOR IS PINNED TO, NOW THAT THE PAGE IS NINE TABS
     (2026-08-27). This read `anchorId = "tabs"` with the argument: "Two things
     then move the scroll: the panel under the tabs is a different height for a
     different voice, and `.focus()` scrolls its element into view. So the tab
     strip is measured against the viewport before the rebuild and put back
     exactly where it was after — everything above it is the same height, so
     pinning it pins the page." Every clause of that is still true INSIDE the
     Band panel, where `#tabs` is, and it is why `#tabs` is still the first
     choice. What is new is that `#tabs` is only on the page when the Band tab
     is open; on the other eight there is nothing at that address, and an
     anchor that resolves to nothing simply declines (`restoreAnchor` returns
     on `!now`). So the fallback is the PANEL HOST being rebuilt — the element
     whose top is above everything this rebuild replaces, which is the same
     guarantee said one level up and the same one `drawMaterial` makes with
     `#ax-material`. */
  /* AND `#tabs` IS NOT AN ADDRESS ANY MORE, 2026-08-28. This read
     `anchorId = $("tabs") ? "tabs" : (hostIdOf(openTab) || "app")` and the
     first branch was the band's voice strip — "everything above it is the same
     height, so pinning it pins the page". The strip is a level of the stripe
     now (see the tombstone in `bandBlock`), the stripe is `position: fixed`
     and therefore not in flow at all, and there is nothing at that address on
     any tab. So the fallback IS the rule: the panel host being rebuilt, whose
     top is above everything this rebuild replaces — the same guarantee said
     one level up, and the same one `drawMaterial` makes with `#ax-material`. */
  anchorId = hostIdOf(openTab) || "app";
  const anchor = $(anchorId);
  anchorWant = (anchorOff || !anchor) ? null : anchor.getBoundingClientRect().top;
  anchorAt = Date.now();
  /* EVERY PANEL IS NOW OLDER THAN THE RECORD, AND ONLY THE OPEN ONE IS
     REBUILT. This is the whole of what the tabs cost and the whole of what
     they buy. draw() means "the document moved"; before the tabs it meant
     "rebuild all of it", which on the shipped chant is four axis sections, a
     twelve-strip board, the producer's table and a whole-record engraving. Now
     it means "mark all nine stale and rebuild the one you are looking at" —
     the other eight are rebuilt at the moment they are next opened, and not
     before, which is the mount-on-demand half. A tab you open twice without
     editing anything in between is not stale and is not rebuilt at all, which
     is the other half: a switch is `display` and a scroll and nothing else.
     (`Where` is not in this set. The atlas is mounted ONCE, at boot, by
     ui/atlas.js, and a document swap moves its ring through `ATLAS.showing`
     rather than by redrawing it — see the boot block.) */
  for (const t of TABNAMES) if (BUILD[t]) tabStale.add(t);
  const box = hostOf(openTab) || $("app");
  // …and the panel keeps the height it had while it is being rebuilt
  // (holdHeight — the box that is emptied is the box that must not collapse,
  // and since 2026-08-27 that box is the open panel rather than #app)
  const release = holdHeight(box);
  try { buildTab(openTab); } finally { release(); }
  putPanes();
  // `document` and not `box`: the board is mounted into #deck, the producer
  // into #produce and the score into #scoredeck — all outside #app — and a
  // thumb that was on a fader or a verb chip is still a thumb that must come
  // back.
  /* AND THE STRIPE IS REPAINTED FROM THE RECORD (2026-08-28). Hiring a voice
     or making a motif changes which marks exist, and the roster it reads is
     the one this rebuild just settled — so it is painted AFTER the panel and
     before the focus goes back, which is what lets `restoreFocus` find the
     `+ drums` button it is about to put your thumb on. It is `paintTray` and
     not `trayRow`: the shape is compared, and a level whose keys did not move
     has two attributes written on it and nothing else. */
  paintTray();
  restoreFocus(document, wasKey, wasPicker);
  restoreAnchor();
}

/* ===== THE NINE TABS ====================================================
   Paul, 2026-08-27: *"Why don't we make tabs at the top level and let go of
   the idea of scrolling everything? The tabs are: Where / Tempo / Key / Motif
   / Band / Mix / Produce / Score / Export."*

   THE NAMES ARE HIS AND THIS TABLE IS THEIR ONE OWNER. The word on the button
   and the order of the nine both come from here, and from nowhere else —
   nukernel/index.html ships the nine hosts and NOT the nine names, precisely
   so there is no second copy to drift.

   THE HIDDEN `<h2>` IS A DIFFERENT WORD AND HAS A DIFFERENT OWNER, which is
   the one thing about this table that has to be said out loud. Each panel's
   heading is still the VOCABULARY's name for what is in it — `Time`,
   `Harmony`, `Motifs`, `The band`, `The board`, `The producer`, `The score` —
   passed to `axis()` by the builders below and, for two of them, by
   ui/engineer.js and ui/produce.js, which this file does not own. It is
   `.nu-vh` (nu.css), so it is announced, printed with the stylesheet off, and
   never a second VISIBLE name. nukernel/AXES.md's join table is where the two
   columns are laid beside each other; do not copy that table into this
   comment.

   WHAT EACH TAB IS, MAPPED ONTO WHAT THE PAGE ALREADY HAD:
     Where   the atlas (#atlas) — the globe and the when-slider, mounted once
     Tempo   the Time axis (#ax-time)
     Key     the Alphabet axis (#ax-alphabet, headed "Harmony" in the
             vocabulary) — Paul named Tempo and Key separately, so the pair
             that used to be two sections of one scroll is two tabs
     Motif   the Material axis (#ax-material) — the Bench and its motifs
     Band    the band block (#ax-band): Form x Cast x Development x Sound x
             Performance, with its own voice tabs inside it
     Mix     the board (#board) — ALREADY tabbed on its inside, one tab per
             voice then buses then main, and those stay NESTED
     Produce the producer (#ax-produce)
     Score   the deck's notation and piano-roll views (#ax-deck)
     Export  the deck's export row, promoted out of the deck to its own tab

   THE SECOND COLUMN IS THE HOST'S id, in nukernel/index.html. */
const TABS = [
  ["Where",   "atlas"],
  ["Tempo",   "pan-tempo"],
  ["Key",     "pan-key"],
  ["Motif",   "pan-motif"],
  ["Band",    "pan-band"],
  ["Mix",     "deck"],
  ["Produce", "produce"],
  ["Score",   "scoredeck"],
  ["Export",  "exportdeck"],
];
const TABNAMES = TABS.map((t) => t[0]);
const hostIdOf = (name) => (TABS.find((t) => t[0] === name) || [])[1];
const hostOf = (name) => { const id = hostIdOf(name); return id ? $(id) : null; };
/* WHICH TAB IS OPEN, AND WHY IT STARTS ON `Where`. It is first in Paul's list,
   and it is also where the page has always opened: the atlas was the front
   door of the scroll. It matters more than a preference, because ui/atlas.js
   mounts the globe at boot and a globe mounted inside a `display: none` panel
   would measure a zero-width box for its projection. The one panel that must
   be visible on the first frame is the one that is. */
let openTab = "Where";
/* THE PANELS WHOSE DOM IS OLDER THAN THE DOCUMENT. draw() fills this with all
   eight buildable tabs and empties exactly one of them. */
const tabStale = new Set();
/* AND WHERE YOU WERE ON EACH OF THEM (the anchor law's substance, new
   mechanism). Paul's own sentence about this page, 2026-08-24: "Stop scrolling
   when I touch the page in any way!" A tab you come back to gives you back the
   scroll you left it at; a tab you have never opened starts at the top, which
   is where its content starts. The window is scrolled EXACTLY ONCE per switch,
   synchronously, inside the gesture — never on a promise, never on a timer,
   and never by the clock. */
const tabScroll = new Map();
/* (`let tabRow = null, tabBtn = new Map()` stood here — the <p> the nine were
   drawn into and the map that let `paintTabs` move one <mark> without
   rebuilding it. The nine are a level of `#nu-tray` since 2026-08-28 and the
   map is `trayBtn`, which does the same job for four levels; see THE STRIPE.) */
/* HOW LONG THE LAST SWITCH TOOK, in milliseconds of main thread, for the gate
   and for the console. The claim the tabs make is that a switch is cheap —
   `display`, a scroll, and a rebuild only if the record moved under it — and
   this is the artifact that says what it actually cost. */
let tabMs = 0;

/* THE BUILDERS, one per tab, keyed by Paul's word. `Where` is null: the atlas
   is not rebuilt by draw() and never has been. */
const BUILD = {
  Where: null,
  Tempo: timeAxis,
  Key: alphaAxis,
  Motif: (host) => materialAxis(axis(host, "ax-material", "Motifs")),
  Band: (host) => bandBlock(axis(host, "ax-band", "The band")),
  Mix: (host) => mountBoard(host, CTX),
  Produce: (host) => mountProduce(host, CTX),
  Score: (host) => deckBlock(host),
  Export: (host) => exportBlock(host),
};

/* BUILD IT IF THE RECORD HAS MOVED UNDER IT, AND OTHERWISE LEAVE IT ALONE.
   The registries the clock writes into are per-panel and each has exactly one
   builder — `chordCell` is the Key panel's, `formCell` the Band panel's,
   `hookCells` and `stepCell` the Motif panel's — so a panel that is not
   rebuilt keeps a registry of cells that are still on the page and still get
   marked. That is why a shut panel keeps its DOM instead of being emptied. */
function buildTab(name) {
  const mk = BUILD[name], host = hostOf(name);
  if (!mk || !host || !tabStale.has(name)) return false;
  tabStale.delete(name);
  host.textContent = "";
  mk(host);
  return true;
}

/* ===== THE LOGGER: WHAT THE BOX HAS DONE ================================
   Paul, 2026-08-28: *"Add a logger on the bottom right. Log actions. Get rid
   of the media (mediaEl) held plays offline etc section on the top; move that
   info to the logger. Badge the logger with the number of lines it holds. Make
   the logger also have a countdown for when I change things, showing how many
   beats before they take effect."*

   "ON THE BOTTOM RIGHT" IS "AT THE FOOT OF THE GUTTER", AND THE GUTTER MOVED
   THE SAME AFTERNOON. Paul, hours later: *"Move the right nav to the left so
   it doesn't interfere with the scroll on the right."* The logger was asked
   for at the bottom right because that is where the stripe was; what he was
   naming is the foot of the navigation, so it went left with it and nothing
   about it had to change — it is `.nu-trayfoot`, the last block of `#nu-tray`,
   wherever `#nu-tray` is. nu.css keeps the list of what does have to follow
   the stripe, at `.nu-tray`.

   IT IS ONE SURFACE ANSWERING TWO QUESTIONS THAT WERE ALWAYS THE SAME QUESTION:
   what did I just do, and what did the box do about it. Before tonight the
   first had no answer anywhere on the page and the second had a paragraph
   under the transport that overwrote itself once a second — so a dropout at
   0:20 was unreadable at 0:21, and there was no way at all to see that the
   thing you changed two minutes ago was the thing that changed the sound. A
   log is the shape both of those want: newest first, nothing overwritten,
   nothing reserved when there is nothing to say.

   ===== HOW A LINE KNOWS WHAT TO CALL ITSELF ==============================
   AND THIS IS THE ONE DECISION IN HERE WORTH ARGUING WITH. A log line has to
   name what changed "in the page's own vocabulary". The obvious way to get
   that is to pass a word in at each call site — and `push()` has twenty-two of
   them, `changed()` is reached from every sheet, every select, every slider
   and every view module through `ctx.changed()`, and none of them takes a
   label today. Twenty-two strings typed into twenty-two call sites would be
   twenty-two SECOND OWNERS of names that are already written down: the sheet's
   <legend>, the select's `aria-label`, the slider's `<output>`. The first time
   somebody renamed a control the log would start lying, quietly, in a corner
   of the screen nobody diffs.

   SO THE LINE IS READ OFF THE CONTROL, NOT OFF THE CALL SITE. `describeHand`
   asks the element the gesture landed on what its name is and what it now
   says, using the page's own accessibility machinery — the label that points
   at it, the fieldset's legend, the selected option's text, the readout beside
   the range. That is the same string a screen reader is given, which is the
   strongest guarantee available that it is the word actually on the page: a
   renamed control is renamed in the log by being renamed, and a control with
   no name is a bug the log makes visible instead of papering over. It is also
   the one reading that survives this file's own habit — `draw()` rebuilds the
   page on every edit, so anything remembered ABOUT a control is stale by the
   time the log is written; the control is read BEFORE the rebuild, inside the
   gesture, and only the two strings are kept.
   (TEST THE ARTIFACT, which is this box's own standing law: the log says what
   the RENDERED control says. Nothing here consults a spec, a registry or a
   table of what the control was supposed to be called.)

   WHAT IS NOT LOGGED, AND WHY — three decisions, all of them arguable:
     · OPENING A TAB IS NOT AN ACTION. A tab is where you are LOOKING, and this
       file already says so about its neighbours: "`trayLevel` is a fact about
       the STRIPE … it never reaches the record", and `tabScroll` is where your
       thumb left a panel. The same test applies. What settles it is what a log
       is FOR: nine tabs and four levels are a dozen marks a thumb walks
       through on the way to one edit, and a log that recorded them would put
       the six things you actually did nine screens apart. Where you are is
       already said permanently, by the marked mark, six inches above this one.
     · THE ROOM SLIDER IS NOT AN ACTION. It does not reach the record — "room
       only — not saved" is the sentence the board's master strip carries about
       exactly this control — and it is the one thing in the transport a hand
       moves CONTINUOUSLY, so it would write a line a frame while everything
       that matters scrolled off the top.
     · A REFUSAL IS NOT AN ACTION EITHER, and it is already answered better
       than a log could: a refused option keeps its reason ON the page, beside
       the control, in `data-why` — the law this box has paid for most often.
       Nothing was changed, so there is nothing to record.
   What IS logged besides your edits: PLAY and STOP, which are not edits and
   are here anyway, because the engine's own sentences are answers to a
   question — "what is the sound doing" — that nobody can see was asked. A
   runway and a dropout under a bare "play" line read as consequences; the same
   two lines with no play above them read as weather.

   THE RESTING STATE IS QUIET AND THE BUTTON IS NOT. Paul: *"If nothing is
   pending and nothing has happened, the logger should be quiet rather than an
   empty box with a zero."* So: no badge at nought (`num: null`), no countdown
   when nothing is pending (the box is emptied and nu.css folds it away), and
   the panel, opened on an empty log, says one sentence instead of drawing an
   empty list. The BUTTON is there from boot regardless, at a size that never
   changes — that is geometry reserved at creation, and the alternative is a
   44px target materialising at the foot of the stripe under a thumb that was
   reaching for the mark above it. A control that appears is worse furniture
   than a control that is quiet. */
const LOG_MAX = 200;             // the tail a phone can hold without a scroll
                                 // through six thousand lines of engine prose
const logs = [];                 // newest first — the order IS the meaning
let logOpen = false;
let logBtn = null, logPanel = null, logList = null, logCountEl = null;
let logZero = 0;                 // the timer that clears a landed countdown
const LOG_REST = "nothing yet — this fills with what you change and what the "
               + "engine says about the sound.";

const two = (n) => (n < 10 ? "0" : "") + n;
const stampNow = () => { const d = new Date();
  return two(d.getHours()) + ":" + two(d.getMinutes()) + ":" + two(d.getSeconds()); };

/* ONE LINE, AND A REPEAT IS A COUNT AND NOT A SCREEN OF LINES. Nudging one
   slider six times is one gesture said six ways; six identical rows would bury
   the five other things you did. Consecutive lines with the same KIND and the
   same NAME collapse into the top row, which keeps the NEWEST value and wears
   a `×6` — so nothing is lost about what the control ended up saying, only
   about the path it took to get there, which is what a slider's own readout was
   showing you the whole time. Non-consecutive repeats do not collapse: coming
   back to a control after doing something else is a different act. */
function logPut(kind, what, value) {
  const top = logs[0];
  const same = !!(top && top.kind === kind && top.what === what);
  if (same) { top.value = value; top.at = stampNow(); top.n = (top.n || 1) + 1; }
  else {
    logs.unshift({ kind, what, value, at: stampNow(), n: 1 });
    if (logs.length > LOG_MAX) logs.length = LOG_MAX;
  }
  paintBadge();
  addRow(same);
}

/* THE ROW. A real <time> and a real <ol> (nu.css turns the numbering off, not
   the order): with the stylesheet off this is a numbered list of stamped
   sentences, which is exactly what it is with the stylesheet on. */
function logRow(L) {
  const li = el("li");
  li.dataset.kind = L.kind;
  li.append(el("time", L.at));
  const sp = el("span");
  sp.append(document.createTextNode(L.what));
  if (L.value != null && L.value !== "") {
    sp.append(document.createTextNode(" — "));
    sp.append(el("b", L.value));
  }
  if (L.n > 1) sp.append(document.createTextNode(" ×" + L.n));
  li.append(sp);
  return li;
}

/* TWO PAINTERS, AND THEY ARE SPLIT BECAUSE THEY ANSWER TO DIFFERENT EVENTS.
   The BADGE is repainted on every line and on every open/shut — it is the only
   part of the logger that is on the screen when the logger is shut. The LIST
   is repainted only while it is open, and then INCREMENTALLY: one row
   prepended, or the top row swapped when a line coalesced. A full rebuild
   would reset `scrollTop`, and a log that scrolls itself back to the top once
   a second while you are reading the middle of it is a log you cannot read.
   (THEY WERE ONE FUNCTION FOR AN HOUR AND THE SEAM IS WHY. `setLog` wants "the
   badge, and the whole list from scratch"; `logPut` wants "the badge, and ONE
   row". One function taking a flag did the second thing on the first call and
   prepended a duplicate of the newest line over a freshly-built list —
   measured on the rendered page at 390: three lines in, the panel drew the
   engine sentence twice and dropped the tempo edit off the end.) */
function paintBadge() {
  if (!logBtn) return;
  paintIcon(logBtn, { glyph: GLYPH.log.g, num: logs.length || null,
                      word: sayLog(logs.length), say: GLYPH.log.s, on: logOpen });
}
function addRow(coalesced) {
  if (!logPanel || !logOpen) return;
  if (!logList) { buildLog(); return; }      // the list was the resting sentence
  if (coalesced && logList.firstElementChild)
    logList.replaceChild(logRow(logs[0]), logList.firstElementChild);
  else {
    logList.prepend(logRow(logs[0]));
    while (logList.children.length > logs.length) logList.lastElementChild.remove();
  }
}

function buildLog() {
  if (!logPanel) return;
  logPanel.textContent = "";
  logList = null;
  if (!logs.length) { logPanel.append(el("p", LOG_REST)); return; }
  logList = el("ol");
  for (const L of logs) logList.append(logRow(L));
  logPanel.append(logList);
}

/* OPEN AND SHUT, AND THE BUTTON SAYS WHICH WITH `aria-pressed`. That is the
   gutter's own idiom for "this is the one that is open" — four levels of marks
   already say it that way — and `aria-expanded` beside it would be a fifth
   spelling of one state on one button in the same 47px column, which is the
   drift ui/glyph.js exists to stop. `aria-controls` names the sheet, so the
   two are joined for anyone who asks which. */
function setLog(open) {
  logOpen = !!open;
  if (logPanel) {
    logPanel.hidden = !logOpen;
    if (logOpen) buildLog(); else { logPanel.textContent = ""; logList = null; }
  }
  paintBadge();
}

/* THE COUNTDOWN — THE CLOCK SPEAKING, AND THE ONE PLACE IT SPEAKS IN HERE.
   `logCountEl` carries `data-live="pending"` and holds NO CONTROL; the badge
   and the button are outside it. The number is the SOONEST landing when more
   than one edit is in flight, because that is the one a hand is waiting on.
   THE ARITHMETIC IS NOT HERE AND MUST NOT COME HERE. audio/live.js owns where
   an edit lands — the serial rule (the walk runs a runway ahead of the ear, so
   a change first sounds at `lastAsked + 1`), the section-scoped advance to the
   box's next pass, the onBar clamp that ends a countdown the crossfade path
   brought in early, and the ticker's refusal to ever count UP by one. This
   reads `beatsLeft` off the feed and draws it. */
const pend = new Map();          // label -> beats left
function paintCount(landed) {
  if (!logCountEl) return;
  if (logZero) { clearTimeout(logZero); logZero = 0; }
  let least = null;
  for (const n of pend.values()) if (least == null || n < least) least = n;
  if (least != null) {
    logCountEl.replaceChildren(el("b", String(least)),
                               el("small", least === 1 ? "beat" : "beats"));
    return;
  }
  /* AND ZERO IS SHOWN BEFORE IT IS CLEARED. A countdown that vanished at 1
     would never be seen to arrive, and arriving is the whole thing it is
     reporting — "it is in the sound NOW" is the answer Paul asked the question
     to get. 700ms is about a beat and a half at this page's tempos: long
     enough to read, short enough that it is gone before the next bar line. */
  if (landed) {
    logCountEl.replaceChildren(el("b", "0"), el("small", "now"));
    logZero = setTimeout(() => { logZero = 0;
      if (logCountEl && !pend.size) logCountEl.replaceChildren(); }, 700);
  } else logCountEl.replaceChildren();
}
on("pending", (d) => {
  if (!d || !d.label) return;
  if (d.beatsLeft > 0) pend.set(d.label, d.beatsLeft);
  else pend.delete(d.label);
  paintCount(d.beatsLeft === 0);
});

/* ===== READING THE HAND =================================================
   WHICH CONTROL THE GESTURE LANDED ON. `pointerdown` in the capture phase, so
   it is recorded before any handler on the page runs and before `draw()` can
   destroy the element — and `keydown` beside it, because a menu changed with
   the arrow keys is a gesture too and never fires a pointer event.
   `document.activeElement` is the fallback and not the primary: a <label>
   wrapping a radio moves focus to the input (good), but a button pressed with
   a mouse is not focused on every engine (Safari), and the one thing this must
   never do is name the wrong control. The pointer record wins while it is
   fresh — two seconds, which is longer than any gesture and shorter than any
   pause between two of them. */
const HANDSEL = "button, select, input, textarea, [role=button]";
const handOf = (n) => (n && n.closest) ? n.closest(HANDSEL) : null;
let handEl = null, handMs = -1e9;
const noteHand = (t) => { const h = handOf(t);
  if (h) { handEl = h; handMs = performance.now(); } };
addEventListener("pointerdown", (e) => noteHand(e.target), true);
addEventListener("keydown", (e) => noteHand(e.target), true);
const theHand = () => ((performance.now() - handMs < 2000 && handEl)
  ? handEl : handOf(document.activeElement));

const CLEAN = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const CLIP = (s) => (s.length > 64 ? s.slice(0, 63) + "…" : s);

/* THE WORDS BESIDE A CONTROL, MINUS THE CONTROL. `el.labels` is the browser's
   own answer to "what labels this" (a `for=` or a wrapping <label>), and the
   control's own subtree is subtracted because a wrapping label contains the
   input and `textContent` would otherwise swallow its value. */
function labelWords(c) {
  let L = (c.labels && c.labels.length) ? c.labels[0] : null;
  if (!L && c.closest) L = c.closest("label");
  if (!L) return "";
  return CLEAN([...L.childNodes]
    .map((n) => (n === c || (n.contains && n.contains(c))) ? "" : (n.textContent || ""))
    .join(" "));
}

/* WHAT CHANGED, AND WHAT IT NOW SAYS. Four shapes, because this page draws
   four and each one keeps its name in a different place — and every one of
   those places is the accessible name, never a private field:
     a radio / checkbox   the QUESTION is the <fieldset>'s <legend>, the ANSWER
                          is the word beside the input (ui/sheets.js's shape)
     a <select>           `aria-label` is the question (ui/selects.js writes it
                          and folds any refusal into it), the answer is the
                          selected option's own text
     a range              `aria-label` is the question, and the answer is the
                          <output> beside it — the readout `range()` builds so
                          "a range with no readout is unusable", already
                          formatted by that slider's own `fmt`
     anything else        a button: its accessible name is the whole line, and
                          there is no value ("rewrite 6" is both halves at once) */
function describeHand(h) {
  if (!h) return null;
  const tag = h.tagName, type = String(h.type || "").toLowerCase();
  let what = "", value = null;
  if (type === "radio" || type === "checkbox") {
    const fs = h.closest("fieldset"), lg = fs && fs.querySelector("legend");
    what = CLEAN(lg ? lg.textContent : "") || CLEAN(h.getAttribute("aria-label"));
    value = labelWords(h) || CLEAN(h.value);
    if (type === "checkbox" && !h.checked) value = (value ? value + " — " : "") + "off";
    if (!what) { what = value; value = null; }
  } else if (tag === "SELECT") {
    what = CLEAN(h.getAttribute("aria-label")) || labelWords(h) || CLEAN(h.dataset.sel);
    const o = h.selectedOptions && h.selectedOptions[0];
    value = CLEAN(o ? o.textContent : h.value);
  } else if (type === "range") {
    what = CLEAN(h.getAttribute("aria-label")) || labelWords(h) || CLEAN(h.dataset.k);
    const out = h.parentElement && h.parentElement.querySelector("output");
    value = CLEAN(out ? out.textContent : h.value);
  } else {
    what = CLEAN(h.getAttribute("aria-label")) || CLEAN(h.textContent)
        || CLEAN(h.dataset.k);
  }
  what = CLIP(CLEAN(what));
  value = value ? CLIP(CLEAN(value)) : null;
  return what ? { what, value } : null;
}

/* THE ONE CALL `push()` MAKES, and it does two things with one reading of the
   hand: it writes the line, and it tells audio/live.js that an edit is in
   flight so the countdown has something to count. The LABEL it announces with
   is the control's own name, which is what makes two nudges of one slider ONE
   pending change (the map is keyed by label) and two different edits two.
   `announceChange` is a no-op while stopped, by its own first line, so there
   is no `playing` test here — the log line lands either way, which is right:
   an edit made with the transport off is still an edit you made. */
function logEdit() {
  const H = describeHand(theHand());
  /* AN EDIT THAT CANNOT NAME ITSELF IS STILL AN EDIT. A `push()` reached from
     somewhere with no live control under the hand — a view module's own
     button that was destroyed by the rebuild before we looked, a keyboard path
     nobody has met yet — gets one honest line rather than silence, because
     "something changed and I do not know what" is a fact worth having in a log
     and a missing line is a log that lies by omission. */
  const what = H ? H.what : "an edit";
  logPut("act", what, H ? H.value : null);
  announceChange(what, null, { who: what });
}

/* A WHOLE RECORD ARRIVING IS ONE LINE, NOT A HUNDRED. `CTX.setDocument` is
   the atlas landing a record — a globe tap, a rewrite, a link opened — and
   every field in the document changed at once, so naming the fields would be
   the log printing the record. What a reader wants is WHICH record, under the
   name the page calls it by, and WHOSE gesture fetched it: the hand is read
   the same way an edit's is, so a press on `rewrite` writes "rewrite 6" and a
   tap on the globe writes the mark's own name, with the record beside it.
   NOTHING AT BOOT. `booted` is false until the boot block has finished, and a
   page that opened on its own record has not been done anything to. */
let booted = false;
function logRecord() {
  if (!booted) return;
  const H = describeHand(theHand());
  const t = $("title");
  logPut("act", H ? H.what : "record", CLIP(CLEAN(t ? t.textContent : "")) || null);
  announceChange(H ? H.what : "record", null, {});
}

/* ===== THE ENGINE'S OWN SENTENCE, WHICH IS NOW A LOG LINE ===============
   This was `paintEngine`, four lines under the transport, and its argument is
   unchanged word for word: *"'pos' fires several times a beat and the sentence
   changes at most every few seconds, so it is throttled here rather than made
   cheaper: engineLine() reads six Atomics off the shared control block and
   there is no reason to do that forty times a second."* Same second, same one
   owner of the wording (audio/live.js `engineLine`), same "only when it
   actually changed" test — the destination is the only thing that moved.
   WHAT THE MOVE BUYS: the sentences no longer overwrite each other. A dropout
   at 0:20 was gone from the page at 0:21 and is now still readable at 4:00,
   with the edit that preceded it one line above. */
/* ...AND THE ONE RULE THIS FILE ADDS, WHICH IS ABOUT NEWS AND NOT ABOUT WORDS.
   `paintEngine` wrote the sentence into a paragraph that OVERWROTE ITSELF, so
   it could afford to redraw whenever anything moved. A log cannot: measured on
   the rendered page at 390 with the record playing, the sentence changed EVERY
   SECOND — "stream · runway 8.2s", "6.6s", "7.6s", "9.2s" — and one minute of
   listening buried every edit under sixty lines of the same claim.

   THE RUNWAY IS A GAUGE, NOT AN EVENT, and the box already knows this in its
   own words: test/soak-nukernel.js, on this exact number — *"it sawtooths
   between about 2.7 s and 8.1 s … it sawtooths, it is HEALTHY"*, because the
   producer publishes one chord bar at a time and the ring is eaten
   continuously in between. A healthy sawtooth is not sixty pieces of news.

   SO THE COMPARISON — AND ONLY THE COMPARISON — IGNORES IT. `NEWS` takes the
   runway's own reading out before asking "is this a different sentence", and
   what gets PRINTED is engineLine()'s string exactly as it was returned, with
   the real reading in it at the moment the line was written. audio/live.js is
   still the one owner of every word; this decides when a sentence is worth a
   row, which is a question a paragraph never had to answer.
   THE REGEX MATCHES A NUMBER AND NOTHING ELSE, so its failure mode is safe: a
   sentence live.js rewords in any way at all still logs — possibly more often
   than it needs to, never wrongly, and never silently. Everything else in the
   sentence stays inside the comparison and therefore still makes a line: the
   route (stream / media / capped / no engine), the hold's clause arriving, and
   a dropout, which is the one number in there that IS news. */
const NEWS = (s) => s.replace(/runway [0-9.]+s/g, "runway");
let engineAt = 0, engineSaid = "";
const logEngine = () => {
  const now = Date.now();
  if (now - engineAt < 1000) return;
  engineAt = now;
  let s = "";
  try { s = engineLine(); } catch (e) { s = ""; }
  if (!s || NEWS(s) === engineSaid) return;
  engineSaid = NEWS(s);
  logPut("engine", s, null);
};

/* AND THE PLAY / STOP LINE, which is the question the engine's sentences are
   answers to. `transport:state` is the transport's own event and the clock may
   flip it (the end of a record stops the transport with nobody touching
   anything) — a log is the one surface here where that is not a violation but
   the point: it records what happened, whoever did it. */
on("transport:state", (d) => {
  logPut("act", d && d.playing ? "play" : "stop", null);
  if (!d || !d.playing) { pend.clear(); paintCount(false); }
  /* …AND THE ENGINE IS ASKED IMMEDIATELY, not on the next "pos". Pressing play
     is exactly when a reader wants to know which engine they got. */
  engineAt = 0; logEngine();
});

/* THE GATE'S HAND. Same door the button uses, and the same reading the badge
   is drawn from — a gate that reached into `logs` and formatted its own line
   would be testing its own idea of the log rather than the log. */
window.__nuLog = () => logs.map((L) => ({ kind: L.kind, what: L.what,
                                          value: L.value, n: L.n, at: L.at }));
window.__nuLogOpen = (want) => { setLog(want == null ? !logOpen : !!want);
                                 return logOpen; };
window.__nuPending = () => ({ beats: (logCountEl && logCountEl.textContent) || "",
                              of: [...pend.entries()].map(([k, v]) => [k, v]) });

/* ===== THE STRIPE: ONE LEVEL AT A TIME, DOWN THE RIGHT EDGE ==============
   Paul, 2026-08-28: *"Come up with a strategy for running the nav icons for a
   given modality down the right of the interface but translucent. Put them in
   a translucent tray. They're sort of like scrabble letters now. There should
   be one vertical stripe max with an 'up' icon to get to the parent level."*
   And, the same hour: *"You know what don't make it translucent. Make it a
   fixed gutter"* and *"Dont let anything go under it."*

   WHAT THIS REPLACES, AND IT IS FOUR FUNCTIONS AND NOT ONE. What stood here
   was `tabsRow()` and `paintTabs()` — the nine top tabs, drawn as a wrapping
   horizontal band (`#toptabs`). Three more strips were drawn the same way one
   level down: `#tabs` in `bandBlock` (form, performance, the voices and the
   three add buttons), `#motif-tabs` in `motifTabRow` (the bank and its two add
   buttons), and the deck's notation/roll pair in `deckBlock`. All four are
   here now, as LEVELS, and only one of them is ever on the screen.

   THE HIERARCHY WAS ALREADY THERE AND WAS BEING DRAWN FLAT. Nine tabs, and
   inside three of them another set — so a reader on the Band tab was looking
   at nine marks plus seven, two bands of them, and no line anywhere saying
   which set was inside which. Drawing ONE level is what makes "one vertical
   stripe max" possible: never nine plus seven, only one set, and `↑` for the
   set it is inside.

   THE FIVE LEVELS, AT THREE DEPTHS (the third landed 2026-08-28):
     root      the nine (`TABS`) — Paul's own list, the one owner
     band      form · performance · every voice · + line/bass/drums
     motif     the bank, one mark per cell · + motif / + drum pattern
     motifops  the open motif's fourteen transforms — seven that move the
               notes, seven that move the beats — and `↑` from here is the
               BANK, not the root (Paul: *"When I'm in a motif, the motif
               operations should be the right nav elements on the view. The up
               arrow to take me home should take me back to the motif picker."*)
     score     notation · piano roll
   ONLY ONE SET IS EVER ON THE SCREEN, at three depths exactly as at two: the
   third depth is a level like the others, not a disclosure and not a second
   stripe. THE ARITHMETIC, measured on the rendered page the day it landed,
   because fourteen is the longest level this page has ever had and "one
   stripe" is a promise about a number:

     390 x 844   gutter 56 x 844 = head 55 + LIST 727 + foot 55
     1280 x 900  gutter 56 x 900 = head 55 + LIST 783 + foot 55
     the level   14 marks x 44px + 13 gaps x .3em (4.8px) = 678.4px

   So it FITS, with 48.6px to spare on the phone and 104.6px on the laptop, and
   `.nu-traylist.scrollHeight === clientHeight` at both widths — measured, not
   assumed: 727/727 and 783/783. The list is still the only `overflow-y: auto`
   in the stripe, so a longer level than this one scrolls inside the column
   rather than becoming a second column, which is what keeps "one vertical
   stripe max" true for a bank of motifs of any size as well.
   `Mix` has a fifth set of its own (`#boardtabs` — a strip per voice, then the
   buses, then main) and it is NOT here, because ui/engineer.js belongs to
   another round this week. It is the next level to absorb and its row is still
   a horizontal band inside the Mix panel; nothing else about the shape below
   has to change to take it.

   A LEVEL IS NOT A MODE. `trayLevel` is a fact about the STRIPE, exactly as
   `tabScroll` is a fact about where your thumb left a tab — it never reaches
   the record, it is never written by the clock, and `push()` is not called
   from anywhere in this block. What IS in the address is which voice / which
   motif / which view a panel has open, because that is a fact about what you
   are looking at (see THE ADDRESS).

   DESCEND BY ARRIVING, RETURN BY `↑`. Tapping `Band` in the root stripe opens
   the Band panel AND drops the stripe to the band level, because opening a tab
   IS going into it; `↑` puts the nine back with `Band` still marked and the
   panel still open. Tapping the marked tab again goes back down. There is no
   fifth gesture and no disclosure anywhere: at every moment the stripe is
   showing exactly one set of siblings, all of them visible at once, which is
   what "nothing is hidden" has meant on this page since it was one scroll.

   THERE IS NO `↑` AT THE ROOT, and the alternative was considered and refused.
   A DISABLED `↑` carrying `data-why` is this page's own refusal idiom and it
   is the wrong one here: that idiom exists for an option THE RECORD has made
   unreachable — untick the drummer and sixty-eight kit words grey with "no
   drummer" written on them — a fact that can change under you and therefore
   has to keep its sentence on the screen. "There is no level above the top" is
   not a fact about the record. It cannot change, no reader can act on it, and
   a permanently dead 44px target at the head of a 56px column is the most
   expensive piece of furniture on this page. What says where you are is the
   marked mark, which is on screen the whole time. (A refusal that keeps its
   sentence is still the law everywhere a REASON exists; this is the one place
   there is no reason, only a definition.)

   THE CLOCK MAY NOT REACH ANY OF THIS. Every function below is called from a
   button's `click`, from `showTab`, from `draw`/`drawMaterial`, or from
   `window.__eightTray` (a gate is a hand) — and from nowhere else. The <nav>
   is outside `#app` and outside every `[data-live]` subtree, so
   `window.__eightFrozen` never sees it and "playback mutates nothing outside
   [data-live]" is untouched by a stripe that redraws when you tap it. */
/* ---- THE THREE TABLES THE STRIPE IS STEERED BY, AND A THIRD DEPTH --------
   REWRITTEN 2026-08-28. Paul: *"When I'm in a motif, the motif operations
   should be the right nav elements on the view. The up arrow to take me home
   should take me back to the motif picker."*

   THAT SENTENCE IS A CORRECTION OF WHERE `Motif` LANDS YOU, and it is worth
   saying why, because the obvious reading builds the wrong thing. It read
   `Motif: "motif"` — tapping the tab put the BANK in the stripe and `↑` went
   home. Paul says `↑` should go to the picker; `↑` can only go to the picker
   if the picker is not where you already are. So arriving at the Motif tab
   lands you INSIDE the open motif, which is also what the tab honestly is:
   the panel draws exactly one cell's editor and there is no state "on the
   Motif tab, in no motif". Three depths, and the arrival is the deepest:

     root  ─ the nine tabs
       └ motif     ─ THE PICKER: every cell in the bank, + motif, + drum pattern
           └ motifops ─ THIS MOTIF'S OPERATIONS: the fourteen transforms

   `TRAYSUB` is where a TAB lands you, `TRAYUP` is where `↑` goes from a level,
   and `TRAYTAB` is which tab a level belongs to — one fact each, and the guard
   in `trayNow` is written against `TRAYTAB` rather than against `TRAYSUB` for
   exactly that reason: two levels now share one tab, so "does this level
   belong to the open tab" is no longer the same question as "is this the level
   that tab lands on".

   A DRUM CELL HAS NO OPERATIONS and that is handled by ARITHMETIC rather than
   by a special case in the caller: `motifOpsTrayItems` returns an empty list
   for a drum cell (design/designTime rewrite `deg`, which a kit does not have)
   and `trayNow` falls back to the picker when a level has nothing in it. So
   the Motif tab lands on the ops of a tune and on the bank of a beat, and
   nothing anywhere else has to know which kind is open. */
/* ===== FOUR MORE LEVELS, 2026-08-28 =====================================
   Paul, in one batch: *"Make a new voice section for all voices. This is where
   every voice is defined -- register, instrument, variables."*, *"Make the
   sections into nav items with the ability to add them and remove them and
   recharacterize and move them up and down. Then i tap on one of them and it
   brings up all the questions per section."*, *"When I'm in tempo, move the
   tempo nav to the right nav."*

   ALL THREE ARE THE SAME SENTENCE ABOUT THE GUTTER and none of them is a new
   kind of thing. The stripe already knew how to be a PICKER whose marks descend
   into a level of their own (`motif` -> `motifops`); it already knew how to be
   a level of ACTIONS with no marked sibling (`motifops`); and `showTab` already
   knew that arriving on a tab IS descending into it. What arrives here is those
   three shapes applied to the three surfaces Paul named, so the whole of it is:

     root  - the nine tabs
       |- tempo    - THE TEMPO OPERATIONS. Eight actions, no sibling marked;
       |             `Tempo` lands here, exactly as `Motif` lands in a motif.
       |- band     - the record's song-level pair and its players: sections,
       |    |        performance, one mark per voice, and the three ways to
       |    |        hire. UNCHANGED except that two of its marks now DESCEND.
       |    |- sections - EVERY SECTION BY NAME, plus `+ section`. This is the
       |    |    |        `form` mark's own level: tapping form used to draw a
       |    |    |        list of names in the panel, and the list is the level
       |    |    |        now. The panel still draws the table (bars, and the
       |    |    |        picks) because a name is not the only fact a section
       |    |    |        has - but WHICH SECTIONS THERE ARE is navigation.
       |    |    \- section  - ONE SECTION'S OPERATIONS: move up, move down,
       |    |                 remove. Its questions are on the page; these are
       |    |                 the three things you can do TO it, which are the
       |    |                 only facts about a section that are not a question
       |    |                 the detail already asks. `recharacterize` is NOT
       |    |                 here: changing a section's role is the `form.role`
       |    |                 <select> at the top of its own questions, and a
       |    |                 second owner of that word in the gutter is the one
       |    |                 thing this page legislates against.
       |    \- voice     - ONE VOICE'S FACETS: instrument, what it plays,
       |                   per-section. Paul's own three sentences about what a
       |                   voice has, as three marks, with the panel drawing
       |                   exactly the one you are standing on.
       |- motif ---- motifops   (2026-08-28, earlier the same day)
       \- score

   FIVE DEPTHS EXIST AND ONLY ONE LEVEL IS EVER DRAWN, which is the whole of
   "one vertical stripe max with an 'up' icon to get to the parent level": the
   promise was never about the depth of the tree, it was about how many columns
   of marks are on the screen, and that number is still one.

   A LEVEL THAT NAMES A THING NAMES IT WITH THE RECORD'S OWN WORD. The sections
   are `verse 2`, `chorus 3` - fields.js `ROLES` read through `secName`, which
   is the same string the form table prints - and never `s0`, which is an id and
   is nobody's name for anything (Paul: *"The sections are named so name
   them."*). */
const TRAYSUB = { Band: "band", Motif: "motifops", Score: "score",
                  Tempo: "tempo" };
const TRAYUP  = { band: "root", motif: "root", score: "root", motifops: "motif",
                  tempo: "root", sections: "band", section: "sections",
                  voice: "band" };
const TRAYTAB = { band: "Band", motif: "Motif", motifops: "Motif", score: "Score",
                  tempo: "Tempo", sections: "Band", section: "Band",
                  voice: "Band" };
let trayLevel = "root";
let trayHead = null, trayList = null, traySig = "", trayHeadSig = "";
let trayBtn = new Map();

/* THE ROOT LEVEL — Paul's nine, and `TABS` is still their one owner. This is
   `tabsRow`'s loop, unchanged except that it now hands back a description
   instead of appending a button. */
const rootTrayItems = () => TABS.map(([name]) => {
  const t = GLYPH.tab[name] || {};
  return { key: "toptab-" + name, glyph: t.g || "•", word: name, say: t.s,
           on: name === openTab, act: () => showTab(name) };
});

/* THE BAND LEVEL — `bandBlock`'s `#tabs` strip, moved whole. Its own comments
   moved with it, because every one of them is still the reason:

   "A MARK AND A NUMBER, AND THE NUMBER IS THE ONLY TEXT (Paul, 2026-08-28:
   'Voice 2 for example could be more symbol plus the number 2'). The mark says
   the KIND — ♪ a line, ▼ the bass, ◉ the kit, and ▦ / ◈ for the two tabs
   nobody plays — and the digit says WHICH. It is the voice's place in
   `DOC.voices`, the RECORD's own roster, and the board's tabs number the same
   players off the same list, so 'voice 2' means one player wherever you are
   looking (ui/glyph.js `sayVoice` carries that argument). THE WORD DID NOT GO
   ANYWHERE: it is the button's `aria-label` and its `.nu-vh` text, so a screen
   reader hears 'schola' and never 'eighth note', and with the stylesheet off
   this strip still reads as its names in order."

   "...AND TAPPING `form` IS THE WAY BACK (Paul, 2026-08-25: 'When you click
   form the list comes back up'). It is not a special case bolted on to one
   tab: `formSec` is which section's questions are open, and leaving the form —
   or arriving on it — closes them, which is the same line for every tab in the
   strip."

   "…AND THE THREE WAYS TO GROW THE BAND WEAR THE SAME MARKS. They are a PLUS
   and the KIND's own glyph, which is the one composition in the row that has
   to be read as two things: what you are about to do, and what you are about
   to do it to. `data-k` is UNCHANGED: test/shell.js hires a drummer through
   `[data-k='adddrums']` and focus is put back across a redraw by that key
   (PROGRAM.md §2.2), so the keys may not move because the geometry did."

   `normalize()` FIRST, for the reason `bandBlock` called it first: the stripe
   can be painted before the Band panel has ever been built (a link that opens
   on `t=band/bass` paints the level before `draw()` runs), and `voiceTabs()`
   reads a roster this fills in. */
function bandTrayItems() {
  normalize();
  const tabs = settleVoiceTab();
  const vTotal = DOC.voices.length;
  const out = tabs.map((name) => {
    const v = SONGTABS.includes(name) ? null : VOICE(name);
    const vi = v ? DOC.voices.indexOf(v) + 1 : null;
    /* THE `form` MARK IS CALLED `sections` NOW, AND ITS KEY IS NOT (2026-08-28,
       Paul: *"Make the sections into nav items … The sections are named so name
       them."*). The WORD is what a reader is asked to understand and "sections"
       is what is behind it; the `data-k` is `tabform` because `data-k` is an
       ADDRESS — three gates reach this mark by it and `restoreFocus` puts a
       thumb back on it across a redraw (PROGRAM.md §2.2). The page state is
       still `tab === "form"` and SONGTABS is still what keeps a voice CALLED
       "form" from being read as it. A name changed; nothing moved. */
    const song = name === "form"
      ? { w: GLYPH.sec.list.w, s: GLYPH.sec.list.s }
      : { w: name, s: (GLYPH.song[name] || {}).s };
    return { key: "tab" + name, glyph: glyphOf(name), num: vi,
             word: v ? name : song.w,
             say: v ? sayVoice(name, v.kind, vi, vTotal) : song.s,
             on: name === tab,
             /* AND IT SAYS SO IN THE ADDRESS (2026-08-28). `markLink` is
                the same debounced writer `showTab` uses and this is a hand
                reaching it, never the clock — a voice tab is a tap. */
             /* ...AND TWO OF THE THREE KINDS DESCEND (2026-08-28), which is the
                stripe's own "opening a thing is going into it" applied to the
                two marks that HAVE something inside them. `sections` opens the
                list of sections; a VOICE opens its three facets. `performance`
                does not, because it is one panel of song-level questions with
                no siblings to name — the same reason six of the nine tabs
                leave the stripe at the root. */
             act: () => { tab = name; formSec = null;
                          trayLevel = v ? "voice"
                                    : name === "form" ? "sections" : "band";
                          draw(); markLink(); } };
  });
  const offer = [["line", "+ line"]];
  if (!BASSV()) offer.push(["bass", "+ bass"]);
  if (!DRUMV()) offer.push(["drums", "+ drums"]);
  for (const [kind, label] of offer) {
    out.push({ key: kind === "line" ? "addvoice" : "add" + kind,
               glyph: "+" + kindGlyph(kind), word: label,
               say: label + " — hire another player and give them their own tab",
               act: () => { addVoice(kind); push(); draw(); } });
  }
  return out;
}

/* ---------- THE SECTIONS LEVEL, AND ONE SECTION'S OPERATIONS -------------
   Paul, 2026-08-28: *"Make the sections into nav items with the ability to add
   them and remove them and recharacterize and move them up and down. Then i
   tap on one of them and it brings up all the questions per section."* And,
   in the same breath: *"The sections are named so name them."*

   THE NAME IS `secName`'s, WHICH IS THE FORM TABLE'S OWN — `role + ordinal`,
   read through fields.js `ROLES`, so a mark says `verse 2` and never `s1`. An
   id is an address (the automation grid, the material maps and every voice's
   development are keyed by it) and it is nobody's name for anything. THE MARK
   IS ▦ + THE DIGIT, which is the gutter's one idiom said again: the picture
   says the KIND, the digit says WHICH, and the word says who.

   TAPPING ONE OPENS ITS QUESTIONS AND DESCENDS, both, because they are one
   gesture: `formSec` is which section's questions the panel draws (it has been
   since 2026-08-25) and `section` is the level whose marks are the three
   things you can do TO that section. Neither is new machinery — this is
   `motif` -> `motifops`, spelled with the form's own state.

   `+ section` IS ON THE LIST AND NOT IN THE DETAIL, and it does NOT descend,
   for the reason `+ motif` gives one level down: growing a list is a LIST
   operation and the answer to it is the list with one more thing in it. A
   stripe that dropped into the new section's operations would take the button
   out from under a thumb that is adding three. */
function sectionTrayItems() {
  const secs = DOC.form.sections;
  const out = secs.map((s2, i) => ({
    key: "secnav" + s2.id, glyph: GLYPH.sec.one.g, num: i + 1,
    word: secName(i),
    say: secName(i) + " — " + s2.bars + " bar" + (s2.bars === 1 ? "" : "s") +
         ", " + (i + 1) + " of " + secs.length + " in the record",
    /* WHAT IS MARKED HERE IS WHICH SECTION YOU ARE WRITING, and that is
       `editSec()` — the same fact the form table lights with `.nu-here` and
       the same one the Material axis engraves its staves in. It is NOT
       `formSec`, which is null the moment you come up out of a section's
       questions: a level whose marks are siblings must have exactly one of
       them marked (test/shell.js A6c), and "the section the record is
       currently open at" is true at every moment while "the section whose
       questions are on the screen" is not. Tapping a mark makes both true at
       once — `openSection` writes `setViewSec` and `formSec` together. */
    on: i === editSec(),
    act: () => { openSection(s2.id); } }));
  out.push({ key: "addsec", glyph: GLYPH.sec.add.g, word: GLYPH.sec.add.w,
             say: GLYPH.sec.add.s,
             act: () => { addSection(); push(); draw(); } });
  return out;
}

/* ONE SECTION'S OPERATIONS. Three actions, no sibling marked — the same
   declaration `motifops` makes, for the same reason: none of these is "open",
   pressing one is a WRITE, and three `aria-pressed="false"` buttons would tell
   a screen reader there is a state to be in. What says where you are is the
   head, which names the section: "up — out of verse 2, back to the sections".

   RECHARACTERIZE IS NOT ONE OF THEM, and that is the one-owner law rather than
   an omission. Paul asked for four verbs; three of them move or delete the
   section and have no control anywhere else on the page, and the fourth —
   changing its role — is the `form.role` <select> that has stood at the top of
   `sectionDetail` since 2026-08-25 and is the FIRST thing under the heading
   this level's marks sit beside. A mark here would be a second writable owner
   of one word, which is the failure this codebase has a standing law against.
   Said out loud so the next reader does not "restore" a verb nobody lost.

   EVERY REFUSAL CARRIES A MEASURED REASON (ui/glyph.js `paintIcon`, which grew
   the spelling today so this level and `tempo` share it): the first section
   cannot move up, the last cannot move down, and the only section cannot be
   removed — because `DOC.form.sections` with nothing in it is a record with no
   bars, which `scoreOf` would compile to silence and `barsOf` would answer 1
   for. The numbers in the sentences are read off the record at paint time.

   IT READS `formSec` AT CLICK TIME, exactly as `motifOpsTrayItems` reads
   `motifTab`: `paintTray` repaints a level in place when its keys have not
   moved — which is these three, always — so the listener bound on the first
   build is the one that runs after `move up` has changed which section you are
   standing on. */
function secOpsTrayItems() {
  const secs = DOC.form.sections;
  const i = secs.findIndex((s2) => s2.id === formSec);
  if (i < 0) return [];
  const n = secs.length, here = secName(i);
  const at = () => DOC.form.sections.findIndex((s2) => s2.id === formSec);
  return [
    { key: "secup", glyph: GLYPH.sec.up.g, word: GLYPH.sec.up.w,
      say: GLYPH.sec.up.s,
      why: i > 0 ? null : here + " is already the first section",
      act: () => { moveSection(at(), -1); push(); draw(); } },
    { key: "secdown", glyph: GLYPH.sec.down.g, word: GLYPH.sec.down.w,
      say: GLYPH.sec.down.s,
      why: i < n - 1 ? null : here + " is already the last section",
      act: () => { moveSection(at(), 1); push(); draw(); } },
    { key: "secdrop", glyph: GLYPH.sec.drop.g, word: GLYPH.sec.drop.w,
      say: GLYPH.sec.drop.s,
      why: n > 1 ? null
        : "this is the record's only section — a record with none has no bars",
      act: () => { dropSection(formSec); push(); draw(); } },
  ];
}

/* ---------- ONE VOICE'S FACETS -------------------------------------------
   Paul, 2026-08-28: *"A voice has: Instrument voice with settings from the
   mixer (move them from the mixer) / What it plays, register, material — i
   should be able to have a voice play more than one kind of material right? We
   do that in per-section — so maybe we get rid of material and let per-section
   handle it. / Per-section settings."*

   THREE SENTENCES, THREE MARKS, and the panel draws exactly the one you are
   standing on. This is the answer to the thing the band tab had become: a
   single column holding a voice's cast sliders, its three menus, its throat
   knobs, its whole console strip and a thirteen-row per-section table, which
   measured as one scroll nobody could hold in their head. Nothing was deleted
   to make it fit — it is the same controls, asked one question at a time,
   which is the same move `sectionDetail` made for the form in August.

   `voiceFacet` IS A PAGE FACT AND NEVER A DOCUMENT ONE — the same sentence
   `tab`, `formSec` and `trayLevel` each carry. It SURVIVES A CHANGE OF VOICE
   on purpose: comparing two players' instruments means moving between them
   with the same question open, and a facet that reset to the top on every tap
   would make that three taps instead of one. */
const FACETS = ["inst", "plays", "sec"];
let voiceFacet = "inst";
function voiceTrayItems() {
  const v = SONGTABS.includes(tab) ? null : VOICE(tab);
  if (!v) return [];
  return FACETS.map((f) => {
    const g = GLYPH.facet[f];
    return { key: "facet-" + f, glyph: g.g, word: g.w,
             say: v.name + " — " + g.s, on: voiceFacet === f,
             act: () => { voiceFacet = f; draw(); } };
  });
}

/* ---------- THE TEMPO LEVEL ----------------------------------------------
   Paul, 2026-08-28: *"When I'm in tempo, move the tempo nav to the right
   nav."* `TEMPOS` is unchanged and so is every one of its eight operations;
   what moved is where they are drawn. The row they were in — `tempoRow`, a
   `<p class="nu-row nu-tf-row">` under the bpm slider — is tombstoned at its
   own site, with the argument for the two FAMILIES of face (the clock's ♪ and
   the bar's arrows) kept where the table is.

   A LEVEL OF ACTIONS, `acts: true`, exactly like `motifops`: none of the eight
   is "open". The four that cannot be done at the current tempo carry their
   measured reason on the button (`d.why(t)` — "half of 84 is 42, and 40 is as
   slow as this box counts"), through the refusal spelling ui/glyph.js grew
   today so that this level and `section` say it the same way.

   IT READS THE TEMPO TWICE, and both readings are deliberate. `d.mk(now())` at
   PAINT time decides whether the mark is refused; `d.mk(now())` again inside
   the listener is what actually runs, because `paintTray` repaints in place
   and the closure outlives the bpm it was built at. */
function tempoTrayItems() {
  const now = () => ({ bpm: DOC.time.bpm,
                       rate: DOC.time.rate == null ? null : DOC.time.rate });
  return TEMPOS.map((d) => {
    const t = now(), next = d.mk(t);
    return { key: "tempo-" + d.w, glyph: (d.g0 || "") + d.g, word: d.w,
             say: d.w + " — " + (next
               ? "the record counts " + next.bpm + " a minute" +
                 (next.rate === t.rate ? ""
                   : ", read at " + (next.rate == null ? "the anchor's own speed"
                                                       : next.rate + "×"))
               : d.why(t)),
             why: next ? null : d.why(t),
             act: () => { const v = d.mk(now()); if (!v) return;
                          DOC.time.bpm = v.bpm; DOC.time.rate = v.rate;
                          changed(); } };
  });
}

/* THE MOTIF LEVEL — `motifTabRow`'s strip, moved whole, with its arguments:

   "A motif is one of two KINDS — a tune or a beat — and `H.kind === 'drum'` is
   the record's own word for which, so the strip borrows the voices' marks: ♪
   for a motif, ◉ for a drum pattern, off the one table in ui/glyph.js. The
   digit is the cell's place in the bank. The NAME is the accessible name, the
   `.nu-vh` word and what a hold prints, because a motif's name is the
   composer's and no picture can carry it — `psalm` and `neume` are the sort of
   word this box exists to let somebody choose. (The block under the strip
   prints it too — 'psalm — read by cantor' — so nothing about which motif is
   open depends on the tab alone.)"

   "A TAB IS FOR LOOKING. It used to sound the motif as well, which read as a
   drum pad while you were writing and as a trap while you were browsing.
   Hearing is the play button's job now, so moving tabs only ends what the last
   one was doing."

   "`drawMaterial()` AND NOT `draw()`: which motif is open changes exactly one
   axis, and drawMaterial is the narrow rebuild that already keeps the pane
   scrolls, the focus key and the scroll anchor."

   "AND TWO WAYS TO GROW THE BANK (Paul, 2026-08-25: 'motifs: give me a way to
   add a motif and a way to add a drum pattern')… IN THE STRIP AND NOT UNDER
   IT, exactly like the band's `+ line` / `+ bass` / `+ drums`. The two
   surfaces are deliberately the same object and a person who has learned one
   has learned both." They are one object more literally than that note could
   have meant it: both are levels of this stripe now, built by two functions
   that read the same way. */
function motifTrayItems() {
  const names = settleMotifTab();
  const out = names.map((name, i) => {
    const H = DOC.material.cells[name] || {};
    const drum = H.kind === "drum";
    return { key: "motiftab-" + name,
             glyph: kindGlyph(drum ? "drums" : "line"), num: i + 1, word: name,
             say: name + " — " + (drum ? "a drum pattern" : "a motif") +
                  ", " + (i + 1) + " of " + names.length + " in the bank",
             on: name === motifTab,
             /* AND TAPPING A MOTIF GOES INTO IT (2026-08-28), which is the
                stripe's own "descend by arriving" applied one level down:
                opening a tab IS going into it, and opening a motif is going
                into that motif. `↑` comes back here. Tapping the marked one
                descends too — it is the way back DOWN after `↑`, and it is
                the gesture `showTab` already gives the root level. */
             act: () => {
               const was = motifTab;
               motifTab = name;
               if (was !== name && (motifLoop || motifOnce)) auditionOff();
               trayLevel = "motifops";
               drawMaterial();
               markLink();
             } };
  });
  for (const [label, kind] of [["+ motif", "line"], ["+ drum pattern", "drum"]]) {
    out.push({ key: kind === "drum" ? "adddrumcell" : "addcell",
               glyph: "+" + kindGlyph(kind === "drum" ? "drums" : "line"),
               word: label,
               say: label + " — a new cell in the bank, opened as you make it",
               /* ...AND ADDING ONE DOES NOT DESCEND. Growing the bank is a
                  BANK operation and the answer to it is the bank with one more
                  thing in it — a stripe that dropped into the new cell's
                  transforms would take the `+ motif` button out from under a
                  thumb that is adding two. The cell is opened in the panel, as
                  it always was; tapping its mark goes in. */
               act: () => { motifTab = addCell(kind); push(); draw(); } });
  }
  return out;
}

/* THE MOTIF-OPERATIONS LEVEL — the two `.nu-tf-row` bands that used to sit
   under the sixteen rows (ui/eight.js hookGrid, where the tombstone carries
   the move and the reason for every argument that came with it).

   FOURTEEN MARKS, IN TWO SETS, IN ORDER: the seven that rewrite the NOTES
   (`DESIGNS`, `design`) and the seven that rewrite the RHYTHM (`TIMES`,
   `designTime`). The two sets were two paragraphs because "fourteen pictures
   in one wrapped paragraph is a wall"; in a column there is no wrapping to do,
   so what separates them is the order and the sentence each mark says when you
   hold it. THE FACE IS THE ROW'S OWN GLYPH, taken off the same table — where a
   face is a PAIR (`∧∨`, `▫▪`) the two glyphs are concatenated, which loses the
   two weights of ink `face()` gave them and keeps the mark. That is a real
   loss and it is the price of one spelling for every button in the gutter
   (ui/glyph.js `icon`): a second face-builder in here would be the fifth
   spelling that file exists to prevent.

   NOTHING IS MARKED AT THIS LEVEL, and that is a statement rather than an
   omission: these are ACTIONS, not siblings. `aria-pressed` is left off (no
   `on` key) rather than set false on all fourteen, because a row of fourteen
   `aria-pressed="false"` buttons tells a screen reader there is a state to be
   in. What says where you are here is the head: "up — out of psalm, back to
   the motifs".

   IT READS `motifTab` AT CLICK TIME AND NOT AT BUILD TIME. `paintTray` repaints
   a level in place when its keys have not moved — which is every one of these
   fourteen, every time — so the listener bound on the first build is the one
   that runs after you have moved to another motif. The cell is looked up when
   the press happens, which is also the only moment at which "which motif is
   open" is a question with an answer. */
function motifOpsTrayItems() {
  const name = motifTab;
  const H = name ? DOC.material.cells[name] : null;
  if (!H || H.kind === "drum") return [];        // a kit has no degrees to move
  const out = [];
  const face2 = (d) => (d.g0 || "") + d.g;
  const live = () => { const C = DOC.material.cells[motifTab];
                       return C && C.kind !== "drum" ? C : null; };
  for (const d of DESIGNS)
    out.push({ key: "motifop-" + d.w, glyph: face2(d), word: d.w,
               say: d.w + " — rewrites " + name + " itself: " + (d.moves
                 ? "the steps change places and their kinds travel with them"
                 : "the degrees move and the rhythm stays where it is"),
               act: () => { const C = live(); if (!C) return;
                            design(C, d); push(); draw(); } });
  for (const d of TIMES)
    out.push({ key: "motiftime-" + d.w, glyph: face2(d), word: d.w,
               say: d.w + " — rewrites " + name + "'s rhythm: which steps " +
                    "sound and when, with the degrees left where they are",
               act: () => { const C = live(); if (!C) return;
                            designTime(C, d); push(); draw(); } });
  return out;
}

/* THE SCORE LEVEL — the deck's own pair, and its argument, moved whole: "▤ is
   ruled paper — the staff, which runs across; ▥ is the roll — blocks standing
   up the pitch axis. Turn one and you have the other, which is exactly what
   these two buttons do to the same record." `setDeckView` is still the only
   thing that decides which is marked; what changed is that it repaints the
   stripe instead of two buttons it was holding references to. */
const scoreTrayItems = () => [
  { key: "deck.view.not", glyph: GLYPH.view.not.g, word: GLYPH.view.not.w,
    say: GLYPH.view.not.s, on: deckView === "not",
    act: () => setDeckView("not") },
  { key: "deck.view.roll", glyph: GLYPH.view.roll.g, word: GLYPH.view.roll.w,
    say: GLYPH.view.roll.s, on: deckView === "roll",
    act: () => setDeckView("roll") },
];

/* WHICH LEVEL IS SHOWING, AND THE GUARD THAT KEEPS IT HONEST. A sub-level only
   exists while its own tab is open — a `band` stripe over a Mix panel would be
   a set of siblings none of which is on the screen — so a mismatch falls back
   to the root rather than drawing a level nobody can be inside. It cannot
   happen through the buttons (`showTab` sets the level every time) and it is
   still checked, because the two states have two writers and one of them is a
   fragment. */
function trayNow() {
  if (trayLevel !== "root" && TRAYTAB[trayLevel] !== openTab) trayLevel = "root";
  /* THE TEMPO'S EIGHT, AND THE SECOND LEVEL OF ACTIONS ON THIS PAGE
     (2026-08-28). `acts: true` for the reason `motifops` gives below, in full:
     these are WRITES and none of them is a state to be in, so nothing is
     marked and it is the page SAYING so rather than a gate inferring it from
     an absence. */
  if (trayLevel === "tempo") return { level: "tempo", parent: "Tempo", up: "root",
                                      acts: true, items: tempoTrayItems() };
  /* THE THREE BAND LEVELS, DEEPEST FIRST, AND EACH ONE MAY HAND ITSELF BACK.
     Same arithmetic as `motifops` and the same reason: a level with nothing in
     it is not a level, and this is the one place that decision is made for the
     buttons, `showTab`, the address and the probe at once.
       · `voice`    is empty when `tab` is a song-level name, which is exactly
                    what `↑` out of a voice and then a tap on `sections` leaves
                    behind — so it stands at the band list instead.
       · `section`  is empty when `formSec` names no live section, which is what
                    `remove` leaves behind and what a record swapped in from the
                    atlas leaves behind. It stands at the section list, which is
                    the only honest place to be after the thing you were inside
                    stopped existing.
       · `sections` is never empty (a record always has at least one section and
                    the level carries `+ section` regardless), so it has no
                    fallback and needs none. */
  if (trayLevel === "voice") {
    const fs = voiceTrayItems();
    if (fs.length) return { level: "voice", parent: tab, up: "band",
                            back: "the band", items: fs };
    trayLevel = "band";
  }
  if (trayLevel === "section") {
    const ops = secOpsTrayItems();
    if (ops.length) {
      const i = DOC.form.sections.findIndex((s2) => s2.id === formSec);
      return { level: "section", parent: secName(i), up: "sections",
               back: "the sections", acts: true, items: ops };
    }
    trayLevel = "sections";
  }
  if (trayLevel === "sections")
    return { level: "sections", parent: "the sections", up: "band",
             back: "the band", items: sectionTrayItems() };
  if (trayLevel === "band")  return { level: "band",  parent: "Band", up: "root",
                                      items: bandTrayItems() };
  /* THE DEEPEST LEVEL IS TRIED FIRST AND MAY HAND ITSELF BACK. A drum cell has
     no transforms, so `motifOpsTrayItems` answers with an empty list and the
     stripe stands at the picker instead — a level with nothing in it is not a
     level, and this is the one place that decision can be made once for the
     buttons, `showTab`, the address and the probe at the same time.
     THE `↑` OF THIS LEVEL IS THE PICKER, NOT THE ROOT (`TRAYUP`), which is the
     whole of Paul's sentence; and its PARENT WORD is the motif's own name,
     because "out of psalm" is what you are doing and "out of Motif" is not. */
  if (trayLevel === "motifops") {
    const ops = motifOpsTrayItems();
    /* AND IT DECLARES THAT IT IS A LEVEL OF ACTIONS (2026-08-28). Every other
       level is a set of SIBLINGS, one of which is open and wears the mark —
       "what says you are here is the marked mark", which test/shell.js A6c
       asserts as exactly one `<mark>` and one `aria-pressed` in the stripe.
       Fourteen transforms have no such state: none of them is "open", pressing
       one is a WRITE, and fourteen `aria-pressed="false"` buttons would tell a
       screen reader there is a state to be in. What says where you are here is
       the head, which names the motif: "up — out of psalm, back to the
       motifs". `acts: true` is the page SAYING that, so the gate can ask
       rather than infer it from an absence — the same discipline as
       `data-live`: a surface declares what it is and the gate reads the
       declaration instead of inventing a permission. */
    if (ops.length) return { level: "motifops", parent: motifTab || "this motif",
                             up: "motif", back: "the motifs", acts: true,
                             items: ops };
    trayLevel = "motif";
  }
  if (trayLevel === "motif") return { level: "motif", parent: "Motif", up: "root",
                                      items: motifTrayItems() };
  if (trayLevel === "score") return { level: "score", parent: "Score", up: "root",
                                      items: scoreTrayItems() };
  return { level: "root", parent: null, up: null, items: rootTrayItems() };
}

/* BUILT ONCE, AT BOOT. The <nav> ships empty in nukernel/index.html; this puts
   its two boxes in it — the head, which holds `↑` and never scrolls, and the
   list, which is the only thing in the stripe that does. */
function trayRow() {
  const nav = $("nu-tray");
  if (!nav) return;
  nav.textContent = "";
  trayHead = el("div", null, "nu-trayhead");
  trayList = el("div", null, "nu-traylist");
  nav.append(trayHead, trayList);
  /* ...AND THE FOOT, WHICH IS THE LOGGER (2026-08-28). It is BUILT HERE and
     not shipped in index.html for the reason the head is built here: the
     gutter's contents are this file's, the empty <nav> is the document's. It
     is pinned to the bottom by BEING LAST — `.nu-traylist` is the only
     `flex: 1 1 auto` in the column, so it eats the slack and everything after
     it sits on the floor, with no `position` and no `margin: auto` anywhere
     (nu.css carries that argument).

     THREE THINGS, IN THIS ORDER, AND THE ORDER IS THE ARGUMENT:
       · a real <hr>, the same `.nu-traycut` the head uses, saying "what is
         below this line is a different kind of thing from the marks above it".
         A rule and not a border, so it says that with the stylesheet off too;
       · the COUNTDOWN, carrying `data-live="pending"` and holding no control —
         the clock's one square inch of the gutter, declared in the DOM where a
         gate can read the declaration rather than promised in a comment;
       · the BUTTON, which is a hand's and sits outside the live box.
     THE BUTTON NEVER MOVES. The countdown appears above it and the list above
     that gives up the pixels, so a thumb reaching for the log finds it in the
     same place whether or not an edit is in flight — which is the whole of
     "geometry reserved at creation" for a control that shares a column with
     something that comes and goes. */
  const foot = el("div", null, "nu-trayfoot");
  foot.append(el("hr", null, "nu-traycut"));
  logCountEl = el("div", null, "nu-count");
  logCountEl.dataset.live = "pending";
  foot.append(logCountEl);
  logBtn = icon({ k: "logger", glyph: GLYPH.log.g, word: sayLog(logs.length),
                  say: GLYPH.log.s, on: false });
  logBtn.setAttribute("aria-controls", "nu-log");
  logBtn.addEventListener("click", () => setLog(!logOpen));
  foot.append(logBtn);
  nav.append(foot);
  logPanel = $("nu-log");
  traySig = ""; trayHeadSig = "";
  trayBtn.clear();
  paintTray();
  paintBadge();
}

/* AND REPAINTED — IN PLACE WHEN THE SHAPE HOLDS, REBUILT WHEN IT MOVES. This
   is `paintTabs`'s promise kept at four levels instead of one. `paintTabs`
   existed because "rebuilding a strip of nine buttons on every keystroke would
   be nine buttons of garbage per edit for no change"; the same is true of a
   voice strip on every tab switch, and it matters more here, because
   `drawMaterial`'s `restoreFocus` is scoped to `#ax-material` and could not
   put your thumb back on a stripe button it had just destroyed.
   THE SIGNATURE IS THE LEVEL PLUS ITS KEYS, which is exactly the set of facts
   that decide what buttons exist. Marking a different voice does not change
   it (two attributes move, per `paintIcon`'s own short-circuit); hiring one
   does, and then `draw()`'s document-wide `restoreFocus` is what carries the
   focus over, by `data-k`, which is why the keys did not move. */
function paintTray() {
  if (!trayList) return;
  const L = trayNow();
  /* THE HEAD'S SIGNATURE IS WHAT IT SAYS PLUS WHERE IT GOES (2026-08-28). It
     was `L.parent` alone, which was exact while every `↑` went to the root;
     with three depths the DESTINATION is a second fact the button carries, in
     its listener and in its sentence, and a head that did not repaint when the
     destination changed would be a `↑` that says one thing and does another. */
  const headSig = (L.parent || "") + "|" + (L.up || "");
  if (headSig !== trayHeadSig) {
    trayHeadSig = headSig;
    trayHead.textContent = "";
    if (L.parent) {
      const up = L.up || "root";
      const u = icon({ k: "trayup", glyph: GLYPH.nav.up.g,
                       word: GLYPH.nav.up.w, say: sayUp(L.parent, L.back) });
      u.addEventListener("click", () => { trayLevel = up; paintTray(); });
      /* A REAL <hr>, not a border on the button. The rule says "what is above
         this line is a different kind of thing from what is below it", and
         that is a statement the document makes whether or not this stylesheet
         loads — with nu.css off the stripe reads `up`, a horizontal rule, then
         the level. A border would have said it only to an eye. */
      trayHead.append(u, el("hr", null, "nu-traycut"));
    }
  }
  const sig = L.level + "|" + L.items.map((i) => i.key).join(",");
  if (sig !== traySig) {
    traySig = sig;
    trayList.textContent = "";
    trayBtn.clear();
    for (const it of L.items) {
      /* `why` SINCE 2026-08-28 — a refused mark, spelled by ui/glyph.js (the
         one owner of what a gutter button is). The listener is bound on a
         refused button too and that is not an oversight: `disabled` is what
         refuses the press, the level repaints in place, and a mark that is
         live again after the tempo moved must already carry its handler. */
      const b = icon({ k: it.key, glyph: it.glyph, num: it.num, word: it.word,
                       say: it.say, on: it.on, why: it.why });
      b.addEventListener("click", it.act);
      /* THE LITERAL " " STAYS, and it is the same text node `motifTabRow` kept
         for the same reason: with the stylesheet off it is what keeps two
         marks from reading as one word. It generates no box in a flex column
         (white-space-only runs between flex items do not), so it costs the
         layout nothing. */
      trayList.append(b, document.createTextNode(" "));
      trayBtn.set(it.key, b);
    }
  } else {
    for (const it of L.items) {
      const b = trayBtn.get(it.key);
      if (b) paintIcon(b, { glyph: it.glyph, num: it.num, word: it.word,
                            say: it.say, on: it.on, why: it.why });
    }
  }
}

/* OPEN A TAB. Four things happen and no fifth: the tab you are leaving writes
   down where you were, the eight shut panels get `data-off` + `inert`, the one
   you asked for is built if the record has moved under it, and the window goes
   to the scroll you left this tab at.

   IT MAY NOT INTERRUPT PLAYBACK, AND IT CANNOT. Nothing here touches the
   transport, the engine or the document: `startAt`/`stop` are not called, no
   `push()` runs, and the score's own rAF walk keeps its place because the walk
   is arithmetic on `scoreStep`/`scoreStamp`/`scoreRate` (see `stepNow`) and
   those three are written by the "pos" feed alone. Coming BACK to the Score
   tab therefore lands the paper where the ear is, without asking the audio
   thread anything.

   AND THE CLOCK MAY NOT REACH THIS FUNCTION. It is called from a button's
   `click` and from `window.__eightTab` (a gate is a hand), and from nowhere
   else. That is what makes "playback mutates nothing outside [data-live]" and
   "a tab switch mutates the tab shell" two separate, provable claims instead
   of one muddled one.

   `anchorWant = null` FOR THE REASON `setDocument` CLEARS IT: a tab change is
   a NAVIGATION, not a correction. `restoreAnchor`'s whole job is to undo a
   scroll the page caused by growing under a still thumb, and it declines
   anything past `ANCHOR_MAX` because "that is not a correction, it is a
   navigation, and no arithmetic here can tell the difference after the fact".
   Here we know it is one, so we say so. */
function showTab(name) {
  if (!hostIdOf(name)) return;
  const t0 = performance.now();
  if (name !== openTab) tabScroll.set(openTab, window.scrollY);
  openTab = name;
  for (const [n, id] of TABS) {
    const h = $(id);
    if (!h) continue;
    if (n === name) { h.removeAttribute("data-off"); h.removeAttribute("inert"); }
    else { h.setAttribute("data-off", ""); h.setAttribute("inert", ""); }
  }
  /* AND THE STRIPE GOES DOWN A LEVEL WITH YOU, when there is one to go down
     to (2026-08-28). Opening a tab IS going into it, so `Band`, `Motif` and
     `Score` land you among their own siblings and `↑` puts the nine back with
     the tab still marked and the panel still open. The other six have no
     sub-level and the stripe stays at the root with them marked — which is
     also the reset that makes `trayNow`'s guard unreachable through a button.
     THIS LINE IS WHY THERE IS NO SEPARATE "descend" GESTURE: a stripe you had
     to open would be a disclosure, and no panel on this page is behind one.

     AND `Motif` LANDS TWO DEEP (2026-08-28), which is the one asymmetry in
     this line and is the tab being honest about itself: its panel draws
     exactly one cell's editor, so arriving at the tab IS arriving in a motif,
     and the level that names your siblings there is that motif's operations
     with the bank one `↑` above it. `TRAYSUB.Motif` is `motifops` and the
     table carries the argument; if the open cell is a drum pattern — which has
     no transforms — `trayNow` stands at the bank instead, by arithmetic and
     not by a branch here. */
  trayLevel = TRAYSUB[name] || "root";
  const built = buildTab(name);
  /* AND ITS PANES GET THEIR SIDEWAYS SCROLL BACK. A `display: none` scroll
     container comes back at 0 whether it was rebuilt or not, so this is not a
     rebuild-repair — it is the same promise `keepPanes` makes across an edit,
     made across a tab. Paul, 2026-08-25: *"When I scroll right to edit motifs
     and tap something it snaps left even though I'm not done editing."* */
  putPanes();
  paintTray();
  anchorWant = null;
  /* PUT THE READER BACK WHERE THEY LEFT THIS TAB. `scrollTo` and not
     `scrollIntoView`: the second one centres its target and is the harness lie
     `ANCHOR_MAX`'s note already had to warn about ("Playwright's page.click()
     calls the CDP scroll-into-view first, which CENTRES the target"). A tab
     that has never been opened has no entry and starts at 0, which is where
     the sticky bands are and where its content begins. `behavior: "instant"`
     because a smooth scroll is a scroll that is still happening after this
     function returns, and this page has spent two rounds proving that a scroll
     nobody can point at is the bug. */
  const y = tabScroll.has(name) ? tabScroll.get(name) : 0;
  window.scrollTo({ top: y, behavior: "instant" });
  /* AND THE SCORE IS TOLD IT IS BACK ON THE PAGE. Its box was `display: none`,
     so the paper's transform is against a geometry that was not being laid
     out; `place(true)` writes the one transform the walk would have written on
     its next frame. It is a write INSIDE `[data-live="score"]`, caused by your
     tap, which is a gesture and not the clock. */
  /* AND THE SCORE IS TOLD IT IS BACK ON THE PAGE. `setDeckView` re-sizes the
     roll's canvas (a canvas measured while its box was `display: none` is a
     canvas of nothing) and `place(true)` writes the one transform the walk
     would have written on its next frame. Only when the panel was NOT rebuilt:
     `deckBlock` ends on `setDeckView(deckView)` itself. */
  if (name === "Score" && !built) { setDeckView(deckView); place(true); }
  /* AND THE ADDRESS SAYS WHICH TAB YOU ARE ON (`#t=mix`), so a link opens on
     the view the sender was looking at. It goes through the same debounce as
     the atlas's writes — one writer, one timer — and it is a GESTURE reaching
     it, never the clock: this function is only ever called from a tab button
     and from `window.__eightTab`. */
  markLink();
  tabMs = performance.now() - t0;
}

/* ---------- the four axis panels ---------------------------------------
   These four were one function — `redrawApp`, which emptied #app and drew all
   of them one after another down a single scroll. It is four functions now,
   one per tab, and every line inside them is the line that was inside
   `redrawApp`, comments and all. What is NOT here any more is the paragraph
   that opened it, and it is worth quoting because it was the page's own
   description of the shape that just ended:

     "ONE <section class="nu-ax"> PER AXIS, and #app holds nothing but
      sections. This is not decoration: it is what makes the sticky heading say
      which axis you are reading."

   The first sentence is still true one level down — #app holds four PANELS and
   each panel holds nothing but its one section — and the second is retired
   with the sticky heading itself (nu.css, THE SECOND BAND IS THE TAB ROW). The
   count that paragraph kept correcting ("FOUR sections for eight axes", after
   "five", after "4-7") is now the tab table above, where nine names are
   written once. */
function timeAxis(box) {
  const D = DOC;
  /* TIME — THE ORDINALS CAME OFF EVERY HEADING, 2026-08-27 (FUTURE.md §5:
     "4–8" and "9 of eight" proved the numbering scheme broke; scroll order
     carries the sequence). The AXES order is unchanged — the headings just
     stopped counting themselves. */
  const axTime = axis(box, "ax-time", "Time");
  D.sound = D.sound || { level: 1 };
  // RECORD GAIN MOVED TO THE BOARD, 2026-08-27. The `level` slider stood here
  // since the axis existed and it was a SOUND fact filed under Time — the
  // rename table's "clearest 'spread everywhere' exhibit" (FUTURE.md §5:
  // "`level` (in Time) → `record gain`, on the master strip"). Same key
  // (`sound.level`), same write, same clamp; ui/engineer.js draws it on the
  // main plate. This pointer is what stays behind, so a hand that knew where
  // it lived is told where it went rather than left to conclude it is gone.
  /* AND SINCE 2026-08-27 IT OPENS THE TAB IT NAMES. `href="#board"` was a
     scroll on a page that was one scroll; the board is behind the Mix tab now,
     and a link that jumps to a fragment inside a `display: none` panel is a
     dead control — the one thing this page does not allow. So the click opens
     Mix, which is what the sentence promises, and the `href` STAYS: with no
     JavaScript, or with the stylesheet off (where every panel is visible and
     the page is one document again), the fragment is still the right answer.
     `preventDefault` only on the path that handled it. */
  { const pt = el("p", null, "nu-hint");
    const a = document.createElement("a");
    a.href = "#board"; a.textContent = "record gain — on the board's main strip";
    a.dataset.k = "goto.board";
    a.addEventListener("click", (e) => { e.preventDefault(); showTab("Mix"); });
    pt.append(a);
    axTime.append(pt); }
  number("bpm", "tempo", D.time.bpm, (v) => D.time.bpm = v, axTime, 40, 220);
  /* (`tempoRow(axTime)` STOOD HERE — "THE TEMPO ICONS, directly under the
     tempo slider and above the reading-speed menu — between the two facts they
     move, which is where a row that moves both belongs." Paul, 2026-08-28:
     *"When I'm in tempo, move the tempo nav to the right nav."* They are the
     `tempo` level of `#nu-tray` now, which is where the stripe puts every set
     of siblings the open tab has; the tombstone at `tempoRow`'s own site
     carries the whole argument and what was lost with it. The two facts they
     move — the bpm slider above and `time.rate`, which has no control of its
     own — are still on this panel, so the marks are still beside what they
     change: 56px to the left of it instead of directly under it.) */
  // THE THREE-WAY RATE MAPPING LIVES IN THE DATA TIER, AND STAYED THERE THROUGH
  // BOTH REVERSALS. "as written" is rate 1 and has no key in fields.js RATES, so
  // somebody has to carry it; that somebody is avail.js SHEETS["time.rate"],
  // where the extractor reads the same three cases the page draws. It moved out
  // of this file when the menu became a sheet and it did not move back when the
  // sheet became a menu again — which is the point of one spec for two widgets.
  // METER AND SWING — SETTLED PARAMETERS (2026-08-24, evening: "We can return
  // some things to select menus: meter / reading speed / swing"). Each is one
  // value for the whole record, decided once. A lit sheet is for comparing
  // many musical options at a time; there is nothing to compare in "is this
  // in three or in four".
  //
  // THE "reading speed" MENU IS DELETED, 2026-08-27 (FUTURE.md §5: "the
  // 1×/half/double buttons own the fact — one fact, one control"). Verified
  // on the rendered page before the cut: tempoRow above draws half time /
  // double time / as written / the default speed, each writing `time.rate`
  // through the same absent-is-default spelling — the menu was a second
  // writable owner of one fact. avail.js SHEETS["time.rate"] stays: it is the
  // data tier's three-way mapping, and the buttons read the same cases.
  // test/selects.js MENUS dropped the row in the same commit.
  selectRow(axTime, null, [shSpec("time.meter", {}), shSpec("time.swing", {})]);
}
function alphaAxis(box) {
  const D = DOC;
  /* ALPHABET — AND THE HEADING SAYS "HARMONY", 2026-08-27 (FUTURE.md §5:
     "key/mode/changes is harmony to a musician; key `alphabet` stays"). The
     AXIS is still Alphabet everywhere the vocabulary speaks — `doc.alphabet.*`,
     `#ax-alphabet`, avail.js's `alphabet.*` rows — exactly the Material→"Sheet
     music" precedent; AXES.md carries the join. */
  const axAlpha = axis(box, "ax-alphabet", "Harmony");
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
  // circle having to grow. The mode list is dorian, phrygian, harmonic minor,
  // mixolydian, major, lydian, melodic minor and natural minor — longer than
  // major-and-minor, and seven rings would be a worse object than the one
  // musicians actually keep in their heads.
  selectRow(axAlpha, null, [shSpec("alphabet.mode", {}),
                            shSpec("alphabet.harmony", {})]);
  check("diatonic", "the line stays in the key", D.alphabet.diatonic,
    (v) => D.alphabet.diatonic = v, axAlpha);
  heading(axAlpha, "the changes");
  chordGrid(axAlpha);
}

/* ---------- the export tab ---------------------------------------------
   THE EXPORT ROW LEFT THE DECK, 2026-08-27 (Paul's tab list: "… Score /
   Export"). It was `exportRow(ax)`, the last block of `deckBlock`, under the
   notation and the roll; Paul named it as its own place, so it has its own
   host, its own `.nu-ax` and its own hidden heading. Nothing about the four
   cards moved — `exportRow` is called here exactly as it was called there, and
   the WAV, MIDI, MP3 and ALS cards say what they always said, refusals
   included. What changed is that pressing "download .wav" no longer means
   scrolling past a whole engraved record to reach it. */
function exportBlock(parent) {
  parent.textContent = "";
  const ax = el("section", null, "nu-ax");
  ax.id = "ax-export";
  ax.append(el("h2", "Export"));
  exportRow(ax);
  parent.append(ax);
}
/* ===== THE ADDRESS: a place, a year, a seed and a tab ====================
   Paul asked for this three times on 2026-08-27: *"I'd like to be able to link
   to a place/time/seed"*, *"Update the url with those"*, *"You also need to
   give me the urls."* Three sentences, three halves of one feature — write it,
   read it, and hand it over — and all three live in this block so there is one
   spelling of the fragment and not three.

   IT IS A FRAGMENT AND NOT A QUERY, AND THAT IS DEPLOYMENT, NOT TASTE. This
   page is served through an nginx `alias` over a pruned tree (docs: the
   deploy+probe note), so a query string is a string the server has to be
   willing to see and the service worker has to be willing to key a cache by. A
   `#` never leaves the browser: no server config, no cache key, no 404, and it
   works identically off `file://` and off the staging box.

   WHAT IT CARRIES, AND WHY IT IS EXACTLY THIS:
     at  the PLACE, the word off the globe (`Kingston`, `New York`)
     y   the YEAR the when-slider is on
     s   the SEED — the one `#rewrite` rolls and prints, ui/atlas.js's own
     t   the TAB, lower-cased (`#t=mix` opens on the board) — and, since
         2026-08-28, the item its own level has open, after a slash:
         `#t=band/bass`, `#t=motif/psalm`, `#t=score/roll`.
   Three of those four are the whole input to the compose path
   (`recordAt(place, year)` -> gk, then `genreToDocument(gk, seed)`), which is
   why the SONG is never in here. A link is a recipe, not a recording: it is
   ~40 characters, it survives a change to a genre's own recipe, and it cannot
   go stale into a shape `song.js` would have to migrate.

   THE CLOCK NEVER WRITES THE ADDRESS. Nothing in this block subscribes to
   "pos" or to "transport:state". The three things that move it are the atlas
   (`ctx.moved`, which fires on the when-slider, on a globe tap and on a
   rewrite) and `showTab`, and both of those are a hand. A record that scrolled
   the address bar while it played would be a history entry per beat.

   AND IT IS ALWAYS `replaceState`. `pushState` would make the back button a
   maze of every knob turn — press back after a minute of moving the slider and
   you would walk out of the page one year at a time. `replaceState` keeps the
   address current and keeps the back button meaning "the page before this
   one", which is what a back button is for. The debounce is the other half of
   the same care: Safari throttles `replaceState` (and starts throwing on a
   burst), and a slider drag is thirty calls a second. */
const LINKMS = 250;
let linkTimer = 0;

/* THE TAB NAME, BOTH WAYS. `TABS` is the one owner of the nine words (see THE
   NINE TABS) and this only lower-cases them for the wire and matches back
   case-insensitively, so a tab renamed there is renamed in the URL with it and
   there is no second list to drift. */
const tabToWire = (name) => String(name || "").toLowerCase();
const tabFromWire = (w) => TABNAMES.find((n) => tabToWire(n) === tabToWire(w)) || null;

/* ===== AND WHICH ITEM OF ITS OWN LEVEL (2026-08-28) =====================
   Paul asked for a linkable sub-level with the stripe: *"one vertical stripe
   max with an 'up' icon to get to the parent level."* Three of the nine tabs
   have a level inside them and `t=` carries which item of it is open.

   IT IS A NAME AND NOT AN INDEX, which is a deviation from the shape the round
   was handed (`t=band/2`) and it is argued rather than assumed. This page's
   own law is PROGRAM.md §2.2 — "keyed by the section's ID, never by its
   index", the rule that keeps an open detail attached to the same section when
   the form is reordered underneath it — and a voice's place in the roster is
   exactly the number that moves when you hire a bass. A link that said
   `band/2` would open on whoever is second TODAY; `band/bass` opens on the
   bass. It is also what a person reads before they send it: `#t=motif/psalm`
   says what you are about to show somebody and `#t=motif/2` says nothing.
   (The one thing an index would have bought is a shorter fragment. The whole
   address is ~40 characters and this adds five.)

   WHY THE STRIPE'S OWN LEVEL IS *NOT* IN HERE, which is the other half of the
   decision. `trayLevel` is a fact about the stripe — the same kind of fact as
   `tabScroll`, where your thumb left a tab — and nobody wants to send a friend
   "I had the stripe folded up". What a sender means by a link is WHAT THEY ARE
   LOOKING AT, and that is which voice, which motif, which view. Arriving on
   one of those puts the stripe on that level, because arriving is descending
   (`showTab`), so the link does the visible thing without carrying the
   invisible state.

   A NAME WITH A SLASH IN IT IS THE ONE THING THIS CANNOT SAY, and it costs
   nothing: the value is split at its FIRST slash and the tab names are Paul's
   nine words, so `encodeURIComponent` on the item survives one decode by
   `URLSearchParams` and `motif/a%2Fb` comes back as the item `a/b`, whole. */
const subNow = () => openTab === "Band" ? tab
  : openTab === "Motif" ? motifTab
  : openTab === "Score" ? deckView : null;
/* ...AND SPENDING ONE. Matched case-insensitively against the level's own
   list, so a fragment somebody re-typed still lands; an item this record does
   not have is simply not applied, and the tab it named is still opened —
   a link that half-lands beats a link that refuses, and the stripe then shows
   the level with its own first item marked. */
function applySub(want) {
  const w = String(want || "").toLowerCase();
  const pick = (list) => list.find((n) => String(n).toLowerCase() === w) || null;
  if (openTab === "Band") {
    const n = pick(voiceTabs());
    if (n && n !== tab) { tab = n; formSec = null; draw(); }
    return !!n;
  }
  if (openTab === "Motif") {
    const n = pick(motifNames());
    if (n && n !== motifTab) { motifTab = n; drawMaterial(); }
    return !!n;
  }
  if (openTab === "Score") {
    const n = pick(["not", "roll"]);
    if (n && n !== deckView) setDeckView(n);
    return !!n;
  }
  return false;
}

/* THE FRAGMENT THIS PAGE IS, as a string. `s` is printed even when it is 1:
   the reading is a fact about the record and a link that only sometimes
   carried it would be a link whose meaning depended on how many times the
   sender had pressed rewrite. */
function linkFrag() {
  const st = ATLAS && ATLAS.link ? ATLAS.link() : null;
  const p = [];
  if (st && st.at) p.push("at=" + encodeURIComponent(st.at));
  if (st && st.y != null) p.push("y=" + encodeURIComponent(String(st.y)));
  if (st && st.s != null) p.push("s=" + encodeURIComponent(String(st.s)));
  const sub = subNow();
  p.push("t=" + encodeURIComponent(tabToWire(openTab)) +
         (sub ? "/" + encodeURIComponent(sub) : ""));
  return "#" + p.join("&");
}
/* ...AND THE WHOLE URL, which is what a person pastes into a message. Built
   off `location` rather than off `document.baseURI` so it carries whatever
   path the page is actually being served from — the nginx alias mounts this
   tree at a sub-path, and a URL that assumed the root would 404 for everyone
   but the developer. */
function shareUrl() {
  return location.origin + location.pathname + location.search + linkFrag();
}
/* ONE WRITER. `replaceState` can throw — a sandboxed frame, a `file://` page
   in some builds, a browser that has decided this page has called it too often
   — and an address bar that failed to update is not a reason to take the music
   down, so it is swallowed. The visible copy of the URL (the Export tab's
   field) is refreshed on the same line, so the field and the bar can never
   disagree. */
function writeLink() {
  clearTimeout(linkTimer); linkTimer = 0;
  const frag = linkFrag();
  try { history.replaceState(history.state, "", frag); } catch (e) { /* throttled */ }
  const f = $("sharelink");
  if (f) f.value = shareUrl();
}
function markLink() {
  clearTimeout(linkTimer);
  linkTimer = setTimeout(writeLink, LINKMS);
}
/* READ IT AT LOAD. `URLSearchParams` over the fragment's body is the whole
   parser — it decodes, it tolerates a stray `&`, and it is in every browser
   this page runs in, so no dependency arrives with the feature. An EMPTY
   fragment returns null and the boot falls through to whatever the box would
   have opened on by itself; a PRESENT one wins over that, which is the point
   (a shared link that showed the recipient their own song would be a link that
   does nothing, silently). */
function readLink() {
  let h = "";
  try { h = String(location.hash || "").replace(/^#/, ""); } catch (e) { return null; }
  if (!h) return null;
  let q;
  try { q = new URLSearchParams(h); } catch (e) { return null; }
  const at = q.get("at"), y = q.get("y"), s = q.get("s"), t = q.get("t");
  if (at == null && y == null && s == null && t == null) return null;
  /* THE FIRST SLASH AND ONLY THE FIRST. See the note over `subNow`: the tab is
     one of Paul's nine words and holds no slash, so everything after the first
     one is the item, whole, however many slashes are in its name. */
  const cut = t == null ? -1 : String(t).indexOf("/");
  return { at, y, s,
           t: cut < 0 ? t : String(t).slice(0, cut),
           sub: cut < 0 ? null : String(t).slice(cut + 1) };
}

/* ---------- and the door: copy link ------------------------------------
   IT LIVES IN THE EXPORT TAB, and the one-line argument is that a share link
   IS an export — it is the fourth thing you can take out of this box, beside
   the WAV, the MIDI and the (refused) MP3, and it is the only one of the four
   that costs nothing to make. The .nu-bar was the other candidate and it is
   full: index.html's own note says the strip holds four controls, may not
   wrap, and already clips a label below 430px to fit them, with test/shell.js
   pinning `--bar-h` at 52px. A fifth control there buys discoverability with
   the one measurement this page has promised twice not to break.

   THE FIELD IS THE FALLBACK, not decoration. `navigator.clipboard` is absent
   on an insecure origin and rejects when the page is not focused, so the URL
   is on the page as selectable text before the button is ever pressed: a
   refusal ends with the whole thing selected and "press Ctrl-C", which is a
   working path and not an apology. */
function shareCard(grid) {
  exportCard(grid, "URL", "nu-cap-hand", "the link",
    "this place, this year, this reading — and the tab you are on", (card) => {
    const f = el("input");
    f.type = "text";
    f.id = "sharelink";
    f.readOnly = true;
    f.dataset.k = "deck.exp.link";
    f.setAttribute("aria-label", "a link to this record");
    f.value = shareUrl();
    f.addEventListener("focus", () => f.select());
    const b = el("button", "copy link");
    b.type = "button"; b.dataset.k = "deck.exp.copy";
    b.addEventListener("click", () => {
      // the field is refreshed at the moment of the press, never trusted to be
      // current: the tab or the slider may have moved since it was drawn
      f.value = shareUrl();
      const done = () => expSay("copied — " + f.value);
      const hand = () => { f.focus(); f.select();
        expSay("this browser will not copy for us — the link is selected, "
             + "press Ctrl-C (Cmd-C on a Mac)"); };
      let p = null;
      try { p = navigator.clipboard && navigator.clipboard.writeText(f.value); }
      catch (e) { p = null; }
      if (p && typeof p.then === "function") p.then(done, hand);
      else hand();
    });
    card.append(f, b);
  });
}

/* ---------- transport ---------- */
const playBtn = $("play"), volEl = $("vol"),
      rewriteBtn = $("rewrite"), takeBtn = $("take");
/* ===== THE TRANSPORT WEARS MARKS (2026-08-28) ============================
   Paul: *"Please make all the tabs and top buttons into sensible icons to save
   space."* The strip is the one row on this page that may not wrap — `.nu-bar`
   is `flex-wrap: nowrap` and `--bar-h` is a PROMISE the tab row's `top`
   depends on — so its saving is not a line, it is WIDTH: 160.3px of button ink
   became 132.0, and the 28px went to the room slider, which is the control in
   here that had been squeezed to its 4em floor.

   ▶ AND ■ ARE ONE BUTTON IN TWO STATES, which is the tri-state play button's
   own law unchanged: "the word on it is the NEXT tap". The mark moves with the
   word, so ■ means "stop it" exactly as the word did, and `say()` is still the
   only thing that writes it. `aria-label` moves with it too — a screen reader
   is told "stop", never "black square" — and the `.nu-vh` word underneath is
   what the strip reads as with the stylesheet off: "play rewrite take room",
   as before.
   THE CLOCK MAY STILL FLIP IT, and that is the one write from the transport
   this page has always allowed (ideal/composer.html annotation 5: "the clock
   may move that line and the sentence beside the play button; it may not press
   a button"). Nothing about who writes changed here; only what is drawn. */
const paintPlay = (onNow) => {
  const a = (onNow || playing) ? GLYPH.act.stop : GLYPH.act.play;
  paintIcon(playBtn, { glyph: a.g, word: a.w, say: a.s });
};
const say = (onNow) => paintPlay(onNow);
paintIcon(takeBtn, { glyph: GLYPH.act.take.g, word: GLYPH.act.take.w,
                     say: GLYPH.act.take.s });
say();
/* #rewrite IS PAINTED BY HAND BECAUSE IT CARRIES A READOUT. `paintIcon` empties
   the button, and this one holds `<b id="reading">` — the seed, printed on the
   gesture that moves it (Paul, 2026-08-27: "I clicked rewrite multiple times
   and never saw a different seed"). So the face is PREPENDED and the digit is
   left exactly where it was, with its literal space still a real text node
   between them: with the stylesheet off this button reads "↻rewrite 5" and not
   "rewrite5", which is the joining bug the note over #rewrite in
   nukernel/index.html measured through CDP and fixed once already.
   AND THE ACCESSIBLE NAME KEEPS THE NUMBER. It used to be assembled from the
   content ("rewrite 5"); an `aria-label` would have frozen it at "rewrite", so
   `printReading` writes both — one number, two places, one writer. */
(() => {
  const a = GLYPH.act.rewrite, rd = $("reading");
  const box = el("span", null, "nu-ic");
  const g = el("span", a.g, "nu-g");
  g.setAttribute("aria-hidden", "true");
  box.append(g, el("span", a.w, "nu-vh"));
  while (rewriteBtn.firstChild && rewriteBtn.firstChild !== rd)
    rewriteBtn.removeChild(rewriteBtn.firstChild);
  rewriteBtn.prepend(box, document.createTextNode(" "));
  rewriteBtn.dataset.say = a.s;
  // the name before the first reading lands (`printReading()` runs at boot,
  // below, and replaces this with "rewrite 1")
  rewriteBtn.setAttribute("aria-label", a.w);
})();
/* AND THE EXPLAINER IS WIRED ONCE, HERE, FOR THE WHOLE PAGE. One delegated set
   of listeners on `document` (ui/glyph.js `wireSay`), so a row that grows a tab
   grows an explainer by saying `data-say` and nothing else — no view installs a
   handler of its own and no rebuild can leave one behind. */
wireSay();
playBtn.addEventListener("click", () => {
  if (playing) { stop(); say(false); } else { startAt(0); say(true); }
});
on("transport:state", () => say());
volEl.value = String(vol);
/* THE ROOM SLIDER PUBLISHES ITS OWN FILL (2026-08-27, with Paul's "the
   horizontal sliders should have the same handles and vibes as the vertical
   sliders"). nu.css paints every slider on the page itself — well, hand fill,
   cap — and for a NATIVE range it can reach the well and the cap through the
   shadow parts but NOT the fill: WebKit and Blink have no progress
   pseudo-element, and CSS cannot read a form control's value. So the one
   place that already knows the number says it out loud as `--p`, and the
   stylesheet does the rest. Two lines, no new state: `vol` is still the only
   owner of the level and this only mirrors it. */
const volFill = () => volEl.style.setProperty("--p", volEl.value + "%");
volFill();
volEl.addEventListener("input", () => { volFill(); setVol(+volEl.value); commit("transport"); });

/* ---------- THE TWO GESTURES BESIDE PLAY (2026-08-27) -------------------
   Paul: *"I'd like a button next to play that seeds a completely different
   version of the song. The another take button should just be called take and
   should move up there. Both those buttons should start playing right away."*

   TWO VERBS, AND THE PAGE HAD ONE LABEL FOR THEM. `#take` moves
   `performance.take`, which document.js `takeOf` spends on the kernel's own
   per-take dice — which chance hits land, the hand's micro-timing, the
   velocity humanisation, the ornament rolls. "It reaches the engine and not
   the model … a take cannot move a DECISION": the same record, played again.
   `#rewrite` bumps the atlas's seed and writes the record again from the same
   anchor — a different record, which is what the atlas's "another take" button
   always did under the other verb's name.

   ONE OWNER PER FACT, TWICE OVER, AND NEITHER BUTTON IS A STORE. The take's
   value lives in `DOC.performance.take` and is drawn by the Performance tab's
   slider (`performanceTab`); this button is a GESTURE that bumps that field
   and lets `changed()` redraw the slider off the document, so the two can
   never disagree. The seed lives in ui/atlas.js and is printed by #atlasSay
   ("· reading 2"); this button calls `ATLAS.reseed`, which is that counter's
   own door.

   AND BOTH USE #play's DOOR. `startAt(0)` is the one play path on this page —
   the same call the button above makes, so the tape wave's adoption, the
   gesture unlock and the pending-start queue are all reached the way they
   already were. A REWRITE INVALIDATES THE HELD PRE-RENDER and does not need a
   line here to do it: `CTX.setDocument` calls `stop()` and `push(true)`, and
   push ends in `commit("box")`, which is one of the events audio/live.js's
   changed-law block listens to — stopped, that is `discardPre()`. A take is
   the same story: `changed()` -> `push()` -> `commit("box")`. Verified on the
   rendered page rather than assumed (the round's two proofs).

   THE BUTTONS ARE CONTROLS AND THE CLOCK MAY NOT TOUCH THEM. They are in the
   .nu-bar, which is outside #app entirely, so no `[data-live]` subtree can
   contain them and `__eightFrozen` never sees them.

   THIS PARAGRAPH USED TO END: "and unlike #play, no handler on this page
   rewrites their text — the word 'take' is the gesture's name, never a
   readout of the value (the value's readout is the slider's <output>, which
   is the fact's owner)." REVERSED for #rewrite on 2026-08-27, and only for
   #rewrite. Paul, on staging: *"I clicked rewrite multiple times and never
   saw a different seed."* He could not: the seed's only readout was inside
   #atlasSay's sentence, which every compose overwrites, a scroll below the
   button on a phone.

   THE LAW THAT ALLOWS IT IS THE TRI-STATE PLAY BUTTON'S, and it is a law
   about WHO WRITES, not about whether a control may carry text: "the word on
   it is the NEXT tap", while "the clock may move that line and the sentence
   beside the play button; it may not press a button" (ideal/composer.html,
   annotation 5). #play's word is rewritten by `say()` off `playing` — which
   the CLOCK can flip at the end of a song — and it is legal because the word
   still names the next GESTURE. The seed is stricter than that: it moves on
   #rewrite and on a tap on the globe and on nothing else in the box, and this
   digit is repainted from `on("box")`, which ui/state.js declares as "one
   call per user edit". No transport event reaches it.

   ONE OWNER, STILL. `ui/atlas.js` holds the seed and `ATLAS.reading()` is a
   reader for it; `#reading` is repainted from that counter and never from a
   number this file kept. The take's value is the other half of the same law
   and did NOT change: it lives in `DOC.performance.take` and its readout is
   the Performance slider's own <output>. */
const startNow = () => { startAt(0); say(true); };

/* THE READING, PRINTED ON #rewrite. `on("box")` covers every path that can
   move the seed — this button (through `reseed`) and a tap on a mark the
   globe is already showing (ui/atlas.js `choose`) — because both end in
   `CTX.setDocument`, which is `push(true)` and `commit("box")`. Painted at
   boot too, where the answer is 1: absent has to be today, and a button that
   said nothing until you pressed it would be the readout Paul was missing. */
const readingEl = $("reading");
const printReading = () => {
  if (!readingEl || !ATLAS) return;
  const n = String(ATLAS.reading());
  readingEl.textContent = n;
  // the name a screen reader hears, and it is the same number: see the
  // hand-painted face above for why this is written rather than inherited.
  rewriteBtn.setAttribute("aria-label", GLYPH.act.rewrite.w + " " + n);
};
on("box", printReading);

takeBtn.addEventListener("click", () => {
  /* THE NEXT TAKE, AND WHY 0 GOES TO 2. The slider's own domain is 0..99 and
     its readout says "take 1 — the reading it has always had" for BOTH 0 and
     1, because absent has to be today (document.js: every record written
     before 2026-08-26 says 0). So stepping 0 -> 1 would be a button that
     changed the document and not the sound, which is the characteristic bug
     this box has been measured for. 0 goes to 2, and 99 wraps to 1 rather
     than sticking at the top of a slider nobody can see from here. */
  const t = DOC.performance.take | 0;
  DOC.performance.take = t < 1 ? 2 : (t >= 99 ? 1 : t + 1);
  changed();          // reviseProd + push + draw: the slider redraws from DOC
  startNow();
});

rewriteBtn.addEventListener("click", () => {
  /* THE ATLAS OWNS THE SEED, so this asks it — and it asks for `DOC.basis`
     rather than for the map's ring, because a role genre has no place on the
     map (genres.js: "a role has a job, not a history") and the record is
     rewritable either way. `reseed` returns false and says why in #atlasSay
     when it cannot; a refusal writes no record, so nothing plays. */
  if (!ATLAS) return;
  // the digit moves with the gesture, not two frames later when the record
  // lands: a press that has been taken is a press you can see was taken. A
  // refusal never gets here — `reseed` returns false without bumping.
  if (ATLAS.reseed(DOC.basis, startNow)) printReading();
});

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
// "count" (the playhead registries) and "score" (the one system of the whole
// band — the whole record of it — above the motifs). This function did not have to change a
// character to take the third one on, and it did not have to change one to see
// it go, which is the whole argument for asking the page rather than writing a
// list: it empties whatever declared itself, and a surface that forgets to
// declare itself fails the gate rather than sneaking past it.
window.__eightFrozen = () => {
  /* IT PARKS THE LIVE HALF RATHER THAN CLONING IT, and that is a cost fix with
     a measurement behind it. It read `$("app").cloneNode(true)` and then
     emptied every `[data-live]` IN THE CLONE — so the expensive half was
     copied and then thrown away, and once the score became a scrolling picture
     that half was several thousand SVG nodes (nine and a half thousand of them
     on the reggae as of 2026-08-26, when the picture became the whole record). Measured 2026-08-25 at 390x844
     with test/motif-frozen.js watching: 112ms, 105ms and 182ms of main thread
     landed while the gate was taking its snapshots, and A7 (which cannot tell
     the page's work from its own instrument's) failed on them.
     Now the children are MOVED into fragments, the empty shell is cloned, and
     they are moved back — all inside one task, so nothing is laid out or
     painted in between and no node loses its identity or its state. The string
     it returns is byte for byte the one the old code returned. */
  const app = $("app");
  const live = [...app.querySelectorAll("[data-live]")];
  const parked = live.map((n) => {
    const f = document.createDocumentFragment();
    while (n.firstChild) f.append(n.firstChild);
    return f;
  });
  try { return app.cloneNode(true).outerHTML; }
  finally { live.forEach((n, i) => n.append(parked[i])); }
};
/* ---------- THE TAB SHELL, FOR A GATE (2026-08-27) ----------------------
   A gate is a HAND, not a clock: `__eightTab` is the same call the button's
   own listener makes, so a gate that opens a tab has done exactly what a
   person does and nothing a person cannot. It is exported for the reason
   `__eightFrozen` is — a gate that reached into the page's private state to
   flip a panel would be testing its own idea of the shell rather than the
   shell. */
window.__eightTabs = () => TABNAMES.slice();
window.__eightTabNow = () => openTab;
window.__eightTab = (name) => { showTab(name); return openTab; };
// …AND WHAT THE LAST SWITCH COST, in milliseconds of main thread.
window.__eightTabMs = () => tabMs;
/* THE STRIPE, FOR A PROBE THAT CANNOT TAP (2026-08-28) — the same door
   `__eightTab` is, at the level below it. `__eightTray()` reads what is on
   screen: the level, the parent it would go up to, and the item keys in order.
   `__eightUp()` is the `↑` button pressed. Neither is a second owner: both
   call the functions the buttons call. */
window.__eightTray = () => { const L = trayNow();
  // `up` since 2026-08-28: with three depths, WHERE `↑` GOES is a fact a probe
  // has to be able to read, and it is the same `TRAYUP` entry the button holds.
  return { level: L.level, parent: L.parent, up: L.up || null,
           acts: !!L.acts,
           items: L.items.map((i) => i.key),
           on: (L.items.find((i) => i.on) || {}).key || null }; };
/* `__eightUp()` IS THE `↑` BUTTON PRESSED UNTIL THERE IS NO `↑` LEFT (rewritten
   2026-08-28, when the gutter grew a third depth). It assigned `"root"` in one
   line, which was the same thing while every level's parent WAS the root. Two
   gates ask for this — test/shell.js A6j ("no ↑ at the root") and
   test/text-diet.js T2 (the nine tabs, read off the root level) — and both of
   them mean "put the stripe back at the top", which is now a walk and not an
   assignment. It is still a HAND and still not a second owner: every step is
   `TRAYUP`, the table the button's own listener reads. */
window.__eightUp = () => {
  for (let i = 0; i < 8 && trayLevel !== "root"; i++)
    trayLevel = TRAYUP[trayLevel] || "root";
  paintTray();
  return trayLevel;
};
window.__eightEngraves = () => engraves;      // abcjs renders, ever
// ...AND THE SCORE'S OWN, which is a different claim on a different surface
// (see `scoreEngraves`): how many times the whole record has been engraved.
// Over a playthrough it is ZERO — the picture is of the record, not of a
// window into it, so the clock never asks for another one. What costs a render
// is an EDIT (see `scoreChanged`), and this is what counts them.
window.__eightScoreEngraves = () => scoreEngraves;
// …AND WHAT THEY COST, in milliseconds of main thread, last twenty first-hand.
// The claim this round makes is that a whole-record render is affordable if
// you say so out loud (`SCORE_LOADER_MS`); this is the artifact that says what
// it actually cost on THIS record at THIS width on THIS device, which is the
// only place that answer lives.
window.__eightScoreMs = () => scoreMs.slice();
window.__eightScore = () => ({
  abc: scoreAbc, sec: scoreSec, bar: scoreMeas,
  // THE PICTURE AS ONE LINE OF MUSIC: how wide it is printed, how many steps
  // it covers and the two numbers that make it move — the steady speed and
  // where the ear is aimed. A gate that wants to know whether the score MOVED
  // reads `x`; one that wants to know whether it was RE-DRAWN reads
  // __eightScoreEngraves; one that wants to know whether it can KEEP UP reads
  // `drift` against `boxW`.
  pw: +scorePW.toFixed(1), steps: scoreSteps, map: scoreMap ? scoreMap.length : 0,
  v: +scoreV.toFixed(4), secV: scoreSecV.map((v) => +v.toFixed(2)),
  head: +scoreHeadPx.toFixed(1),
  drift: scoreDrift.map((d) => +d.toFixed(1)), boxW: scoreBoxW, gut: scoreGutW,
  secAt: scoreSecAt.slice(),
  voices: scoreVoices.map((v) => v.name),
  lit: scoreLit.length, cap: scoreCap && scoreCap.textContent,
  loading: !!(scoreLoad && !scoreLoad.hidden),
  x: scoreX == null ? null : +scoreX.toFixed(2),
  step: +stepAbs().toFixed(3),
  box: scoreReserve, fit: +scoreFit().toFixed(3),
  // …and where the sounding note actually IS on the screen, which is the one
  // number the steady speed puts at risk: `head + drift` in box pixels.
  at: scoreMap ? +(paperX(stepAbs()) - (scoreX == null ? 0 : scoreX)).toFixed(1) : null });
// WHERE AN INSTANT IS ON THE PAPER, in box pixels, for a gate that wants to
// measure the one thing the steady speed puts at risk: how far the engraving's
// own x for a step is from the steady scroll's. `__eightScore().drift` is this
// function walked over the whole record; this is the same answer step by step,
// so a gate can say WHERE it happens as well as how big it is.
window.__eightScoreAt = (step) => paperX(+step || 0);
/* THE DECK'S OWN PROBES (test/deck.test.js). Everything a gate needs to hold
   the deck to its laws, read off the page rather than recomputed in the gate:
   which view is up, every bracket's text beside the material cell keys it must
   be a member of, the export buttons' states with their reasons, and the two
   export artifacts THEMSELVES — the .mid parsed back by our own reader beside
   the score fold it must equal, and the .wav pressed twice for byte-equality
   (TEST THE ARTIFACT: the gate reads bytes, not wiring). */
window.__deckState = () => ({
  view: deckView,
  step: +stepAbs().toFixed(3),
  brackets: scoreMots
    ? [...scoreMots.querySelectorAll(".nu-mot > b")].map((b) => b.textContent) : [],
  /* …AND WHOSE EACH ONE IS (2026-08-27). A label under a part is only true if
     it names the cell THAT PART reads, so the gate needs the pair and not just
     the word: the voice the label hangs under, the section it starts on, and
     what it says. `top` comes back with it because "under the part" is a claim
     about geometry that a gate should be able to check against the staff. */
  labels: scoreMots ? [...scoreMots.querySelectorAll(".nu-mot")].map((m) => ({
    voice: m.dataset.v, si: +m.dataset.si,
    text: (m.querySelector("b") || {}).textContent,
    left: Math.round(parseFloat(m.style.left) || 0),
    top: Math.round(parseFloat(m.style.top) || 0) })) : [],
  // where each staff is, in the same box pixels the labels are placed in, so
  // "under the part" is a claim a gate can measure rather than take on trust
  staves: scoreStaffY.map((y) => ({ top: +(y.top * scoreS).toFixed(1),
                                    bottom: +(y.bottom * scoreS).toFixed(1) })),
  // what each voice reads per section, resolved by the page's own `cellAt`
  // (and the bass's exception to it) — the answer the labels must equal
  reads: DOC.voices.map((v) => ({ voice: v.name, kind: v.kind,
    cells: DOC.form.sections.map((s2, si) => {
      const src = v.kind === "bass" ? LINES()[0] : v;
      return src ? cellAt(src, si) : null; }) })),
  cellsFor: DOC.voices.map((v) => NuAvail.cellsFor(DOC, v.kind)),
  // THE KEY LINE and THE PINNED GUTTER, the two halves of "I don't know which
  // instrument or key I'm looking at" — read off the page as text and pixels.
  keyline: (() => { const p2 = document.querySelector("#scoredeck .nu-keyline");
    return p2 ? p2.textContent : null; })(),
  gutter: (() => {
    const g = document.querySelector("#scoredeck .nu-gutter");
    if (!g) return null;
    const gb = g.getBoundingClientRect();
    return { w: Math.round(gb.width),
      names: [...g.querySelectorAll("text.abcjs-voice-name")].map((t) => {
        const r = t.getBoundingClientRect();
        return { text: t.textContent, left: Math.round(r.left),
                 right: Math.round(r.right), top: Math.round(r.top),
                 bottom: Math.round(r.bottom) }; }),
      clefs: g.querySelectorAll(".abcjs-clef").length,
      meters: g.querySelectorAll(".abcjs-time-signature").length };
  })(),
  cells: Object.keys(DOC.material.cells),
  rollNotes: (rollList || []).length,
  rollRange: [rollLo, rollHi],
  /* THE EXPORT CARDS ARE A TAB OF THEIR OWN SINCE 2026-08-27 (Paul's list:
     "… Score / Export"), so this reads `#exportdeck` and not `#scoredeck`.
     They are still reported HERE, in one call with the rest of the deck,
     because they are still one feature — the deck is what a record leaves by.
     The states and the reasons are DOM facts and need no layout, so a gate may
     read them with the Score tab up; what it may not do is read them before
     the Export tab has ever been opened, because until then there is nothing
     to read (mount on demand — ui/eight.js `buildTab`). */
  exports: [...document.querySelectorAll("#exportdeck .nu-exp")].map((c) => {
    const b = c.querySelector("button");
    return { k: b ? b.dataset.k : null, label: b ? b.textContent : "",
             disabled: !!(b && b.disabled),
             why: (c.querySelector(".nu-why") || { textContent: "" }).textContent };
  }),
});
window.__deckView = (v) => setDeckView(v);
window.__deckSmf = () => {
  const r = deckSmf();
  if (!r) return null;
  return { bytes: Array.from(r.bytes), parsed: parseSmf(r.bytes),
           drumMap: HEAD_GM, steps: r.steps,
           score: r.voices.map((v) => ({ name: v.name, clef: v.clef,
             notes: v.notes.map((n) => ({ at: n.at, len: n.len,
               midi: Array.isArray(n.midi) ? n.midi : [n.midi] })) })) };
};
window.__deckPressWav = async () => {
  const m = await import("../export/wav.js");
  const r = await m.pressWav();
  const dv = new DataView(r.bytes);
  const tag = (o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1),
                                         dv.getUint8(o + 2), dv.getUint8(o + 3));
  // the bytes DECODE: a canonical PCM wav is its own decoder — the header
  // fields and every Int16 sample are read back here, not assumed
  const head = { riff: tag(0), wave: tag(8), fmt: dv.getUint16(20, true),
                 ch: dv.getUint16(22, true), sr: dv.getUint32(24, true),
                 bits: dv.getUint16(34, true), dataLen: dv.getUint32(40, true) };
  let sum = 0;
  const n = head.dataLen >> 1;
  for (let i = 0; i < n; i++) { const s = dv.getInt16(44 + i * 2, true) / 32768; sum += s * s; }
  const sha = [...new Uint8Array(await crypto.subtle.digest("SHA-256", r.bytes))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  return { sha, size: r.bytes.byteLength, frames: r.frames,
           durSec: +r.durSec.toFixed(3), songSec: +r.songSec.toFixed(3),
           rms: +Math.sqrt(sum / Math.max(1, n)).toFixed(5), head };
};
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
// WHAT THE RECORD COMPILED TO, per section, for the one claim that cannot be
// read off DOC: a TAKE is spent in `document.js toGenre` (`takeOf`) and lands on
// `kitSeed` and the pipes' seeds, which are facts about the compiled GENRE and
// not about the document. `test/knobs.js` check 10c reads it back off the page
// after moving the take slider — the artifact, not the wiring. Functions and
// the `__v` counter are dropped: neither survives the bridge to a gate.
window.__eightGenres = () => { const out = {};
  for (const [k, g] of Object.entries(GENRES)) {
    if (!g || !k.startsWith(GK)) continue;
    out[k] = { kitSeed: g.kitSeed, bpm: g.bpm, rate: g.rate,
               pipes: g.pipes ? g.pipes.map((o) => o.seed) : null };
  }
  return out; };
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
/* THE STRIP BEFORE THE PANELS, AND `showTab` BEFORE `draw()`. Order matters
   exactly once, here: `showTab` is what puts `data-off` on the eight panels
   that are shut, and until it has run every one of them is open — nine panels
   of nothing, which is harmless, and the ATLAS visible, which is the one thing
   that has to be true when ui/atlas.js mounts the globe below. `showTab` then
   marks the open tab stale-free without building it (nothing is stale yet) and
   `draw()` builds it for the first time. */
/* THE LINK IS READ FIRST AND SPENT LAST (see THE ADDRESS). Read here because
   the rest of the boot is what it has to steer; spent below in two separate
   places, for one measured reason — THE ATLAS MOUNTS ON THE OPEN TAB.
   `Where` is the panel that must be visible on the first frame, because a
   globe mounted inside a `display: none` panel measures a zero-width box for
   its projection (the note on `openTab` above). So a link that names another
   tab does NOT open on it yet: the page boots on `Where` exactly as it always
   has, the globe is fitted, the record is landed, and only then does the tab
   move — one extra panel build, at boot, only for a link that asked for one. */
const LINK = readLink();
const LINKTAB = LINK ? tabFromWire(LINK.t) : null;
const LINKSUB = LINK ? LINK.sub : null;
trayRow();
showTab(openTab);
draw();
say();
// AFTER draw(), not before: the atlas's boot calls showing(DOC.basis), which
// wants the record already on the page. TERMS.basis is gregorian, so the map
// opens on Rome 600 — which is exactly what #title already says.
ATLAS = mountAtlas($("atlas"), CTX);
/* AND A LINK WINS OVER THE BOX'S OWN RECORD. `open()` returns `true` when it
   landed one, and THE REASON as a string when it refuses — the fragment names
   no place, an unreadable year, or a place with nothing on it — and the boot
   then falls through to the record this box would have opened on anyway and
   says why. An empty fragment never gets here at all. Nothing else on this
   page restores a record at boot (the /band page's `nu.band.session` is a
   different document in a different file), so this `if` is the whole of the
   precedence rule. */
if (ATLAS) {
  const why = LINK && LINK.at ? ATLAS.open(LINK) : false;
  if (why !== true) {
    ATLAS.showing(DOC.basis);
    // …AND THE REASON IS PRINTED AFTER THE FALLBACK, NOT BEFORE IT. `showing()`
    // ends in `sentence()`, which owns #atlasSay and would overwrite a refusal
    // written a statement earlier — measured, the line lasted less than a
    // frame and a thrown-away link looked exactly like an ordinary boot.
    if (typeof why === "string") ATLAS.note(why);
  }
}
printReading();                         // the bar prints reading 1 from boot
// ...and NOW the tab the link asked for, with the globe already fitted.
if (LINKTAB && LINKTAB !== openTab) showTab(LINKTAB);
/* ...AND THE ITEM OF ITS OWN LEVEL, AFTER THE TAB AND NEVER BEFORE IT: a voice
   is a fact about the Band panel and the panel has to be the open one for
   `applySub` to know which list to look in. `showTab` has already dropped the
   stripe to that level, so the link lands you among the siblings it named. */
if (LINKSUB) applySub(LINKSUB);
// The address is written once at boot whatever happened: a page that opened
// on its own record still has a URL worth copying, and a link that was
// refused must not go on claiming a place this box is not showing.
writeLink();

/* ===== THE LOG STARTS EMPTY, AND IT STARTS HERE (2026-08-28) ============
   Everything above this line is the box arriving, not a person doing
   something, so none of it is logged: `push(true)`, `showTab`, `draw()`, the
   atlas mounting and a link being spent are all the page becoming itself.
   `booted` is the switch, and it is thrown after the LAST of them — a link
   that opened on another record went through `CTX.setDocument` two statements
   ago and must not read as a rewrite somebody pressed.

   AND ONE ENGINE READING, ONCE, FOUR SECONDS IN. The engine's sentence is
   otherwise only asked for on the transport's own events — the "pos" feed and
   `transport:state` — so a box that is warmed and HELD but never played would
   never say "held — plays offline", which is exactly the sentence a hand wants
   before a tunnel and exactly the one Paul asked to be moved in here. The warm
   is a promise `warmup()` started at boot and `holdLine()` is derived from
   what it filed, so there is no event to subscribe to; four seconds is after
   the shell and the first cache walk on the machines this has been measured
   on, and if the warm is slower than that the next edit or the next play asks
   again. ONE timer, one shot, no polling: `logEngine` writes nothing when the
   sentence is empty or unchanged. */
booted = true;
setTimeout(logEngine, 4000);
/* ESCAPE SHUTS THE LOG, and only Escape and its own button do. The explainer
   (ui/glyph.js) also closes on the next press anywhere, and that is right for
   a popover that is covering the control it explains; it is wrong here. The
   log is a sheet you read WHILE you keep working — you look at what the last
   edit was called and then you go and make the next one — and a panel that
   vanished on the first press would be a panel you could never use for that.
   It covers no control: it stops at the gutter's inner rule and the gutter is
   where every mark on this page lives. */
addEventListener("keydown", (e) => { if (e.key === "Escape" && logOpen) setLog(false); });
