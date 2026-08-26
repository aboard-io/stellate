// ui/deps.js — the SOLE reader of window.*. Everything the classic-script tier
// publishes (nukernel/index.html loads registry-data, sampler, found-player,
// theory, kernel, genres, askable, fields, song, instruments, compose, presets,
// songs, document, desk-doc, avail, gates, chair, ideas-kit, precompose,
// bass-kit, producer, atlas and atlas-land before any module runs) is read
// off window HERE, once, and re-exported as named bindings. No other module in
// ui/ or audio/ touches a global — so when the data tier one day becomes ESM,
// the conversion is this one file.
//
// This is safe by construction: a <script type="module"> is deferred, so it
// always evaluates AFTER every classic <script src> above it in the page —
// a stronger ordering guarantee than app/'s classic tier ever had.
//
// LAYER GRAPH (one-way, stated once here and enforced by import direction):
//   deps -> state -> derive -> audio/to-engine -> audio/desk -> audio/plan
//        -> audio/live -> ui views (readout,
//        songrow, palette, editor, mixer, chrome) -> main
// audio never imports a ui VIEW module; ui views may import audio; state
// publishes events, it does not draw; derive is pure over its arguments.

// ---- the algebra (kernel.js) ----
export const { harm, render, drums, bass, ROMAN, word, KITOPS,
               envelope, edges, groove, withCadence, partOf,
               chordAt, chordsOf, MODE, harmonizeStage,
               // the time layer's own three: the tempo map's closed-form warp,
               // the one-note seating law the lead-in pickups share with the
               // harmonize stage, and the seeded dice both of them roll
               tempoWarp, seatNote, prng, TOMS,
               // HOW A BAR COUNTS: the two-number meter and its readers.
               // Absent from a genre = the sixteen steps of four this box
               // counted in for its whole life (kernel.js METERS).
               METERS, MET4, metOf, stepsIn, pulseIn } = window.NuKernel;

// ---- the genre table (genres.js) ----
export const { DEFAULT, GENRES, DRUMNAME, MODES, MODELABEL,
               SCALES, SCALELABEL, PROGS, FAMILIES } = window.NuGenres;

// ---- the control vocabulary (fields.js) — ONE definition of every control ----
export const NuFields = window.NuFields;
export const { NSLOTS, MAX_LEN, MAX_NUDGE, MAX_FX,
               OPS, OPLABEL, ENVLABEL, MOTLABEL, INLABEL, OUTLABEL,
               RATES, RATELABEL, SWINGS, SWINGLABEL, GROOVELABEL, METERLABEL,
               KITLABEL, DRUMKITS, BASSOPS,
               FX, fxChain, FXSEND, fxMix, fxSendable,
               SENDS, SENDLABEL, VERBS,
               DTIMES, DTLABEL, LEVELS, LEVELLABEL, PANS, PANLABEL,
               VOX, VOXPARAM, OCTAVES, ARTICS, CMODES, CLAMPLABEL,
               KEYS, KEYLABEL, PROGCHOICES, PROGLABEL, PERIODS, PERIODLABEL,
               BREATHS, BREATHLABEL, PIPESETS, PIPELABEL, PARTCHOICES,
               PARTNAMES, PARTLABEL, PARTMIX, PARTMIXBY, MAX_CHAIRS,
               okPartKey, partChairLabel, chairKeys, resolvePartMix, faderDb,
               EQ_BANDS, BUS_EQ_BANDS, EQ_RANGE, eqDb, resolveEq, eqIsFlat,
               resolveMaster, masterIsDefault, resolveBuses, busesIsDefault,
               AUTOPARAMS, AUTOPARAMLABEL, AUTOSHAPELABEL, autoShape,
               INSTRCHOICES, POOLCHAIRS,
               ROLES } = window.NuFields;
// THE ONE RENAME IN THIS FILE. fields.js calls the master-bus registry MASTER;
// ui/state.js calls the song's master-bus VALUES the same thing. One says what
// a global may be, the other says what it is, and importing both under one
// name is how a view ends up drawing chips from the store. The registry takes
// the longer name because it is the one with fewer readers.
export const MASTER_FIELDS = window.NuFields.MASTER;
// same rename, same reason: fields.js's BUSES is the rack REGISTRY; ui/state.js
// BUSES is the song's VALUES for it.
export const BUS_FIELDS = window.NuFields.BUSES;

// ---- how a document becomes a score (document.js) ----
// The whole module, under its own name, because it is a compiler and not a
// table: `toGenre`, `toPhrase`, `materialAt`, `barsOf`, `boxesOf`, `normalize`,
// `scoreOf`. It came out of ui/eight.js in the 2026-08-24 round, where it had
// been living in a VIEW and had already been copied once into
// scratch/play-song.js. Destructuring it here would have put seven more names
// into a file whose job is to be the ONE reader of window.*, and a view that
// wants two of them wants the third next week.
export const NuDocument = window.NuDocument;

// ---- where the sound axis lands on the desk (desk-doc.js) ----
// The whole module under its own name, for the reason NuDocument takes one: it
// is a wire, not a table — `channelVoicesOf`, `deskPartsOf`, `masterOf`,
// `busesOf`, `boxFxOf`, `deskIsDefault` and the four writers. Destructuring ten
// names into the file whose job is to be the ONE reader of window.* is how this
// file stops being short enough to read.
export const NuDeskDoc = window.NuDeskDoc;

// ---- what can be said here, and what saying it would do (avail.js, gates.js) ----
// Two names, not two destructurings, for the reason NuDocument gets one: they
// are a vocabulary and a measured table, and a view that wants `optionsFor`
// today wants `SHEETS` tomorrow. gates.js is GENERATED — the table a view reads
// through here is the one `node nukernel/gates-extract.js --check` holds
// against the running box.
export const NuAvail = window.NuAvail;
export const NuGates = window.NuGates;

// ---- what a seated voice's own knobs are (knobs.js, VOICE.md) ----
// Third table of the same kind and it arrives the same way: GENERATED, UMD,
// read off window. `node nukernel/knobs-extract.js --check` is what holds it
// against the engine, and no view module carries a second list of what an
// instrument editor may draw.
export const NuKnobs = window.NuKnobs;

// ---- what somebody with taste said about it (producer.js, D4) ----
// The whole module under its own name, for the reason NuDocument takes one: it
// is a mover, not a table. `run` is the one name the seam calls; `SUBJ`, `SUB`
// and `SCOPEFIELDS` are LIVE references ui/produce.js replaces in place to
// install a cast built from THIS document's voices, and destructuring them here
// would hand a view a snapshot of a cast that is about to be thrown away.
export const Prod = window.NuProducer;

// ---- set a genre, get a whole record (precompose.js, D5) ----
// The same whole-module treatment and for the same reason. `genreToDocument`
// is the one name a view calls; `anchors()` is what a view enumerates instead
// of `Object.keys(GENRES)`, because push() registers this page's own
// `lab.eight.N` rows into that same table and a menu built off the raw keys
// offers the composer a section of the record they are already looking at.
export const NuPrecompose = window.NuPrecompose;

// ---- where and when the records are (atlas.js, atlas-land.js, D6) ----
// Whole modules under their own names, for the reason NuPrecompose takes one:
// atlas.js exports twenty names and the view wants a different four each time
// it is edited. LAND may legally be [] — a map with no coastline is a worse
// map, a CDN would be a broken promise (the offline law).
export const NuAtlas = window.NuAtlas;
export const NuAtlasLand = window.NuAtlasLand;

// ---- the shipped record itself (songs.js) ----
// ui/eight.js read this off window directly, which predated this file's law and
// was the last global read left in ui/. The atlas needs TERMS too — "back to
// Rome 600" restores the shipped chant byte for byte — and a SECOND direct
// window read is how a law stops being one, so it comes through here and
// eight.js now imports it like everything else.
export const { TERMS } = window.NuSongs;

// ---- pure persistence (song.js) ----
export const NuSong = window.NuSong;
export const { blank, emptyBox } = window.NuSong;

// ---- the sound sources as data (instruments.js) ----
export const { instrOf, familyOf, BASS_INSTR, DRUMDIR, DRUMFILE, FONTS, BASSSYNTH,
               STRIPS, stripFor, RANGES, STRETCH_UP, STRETCH_DOWN,
               DRUMMIX, DRUMBUS,
               // the machine kits' place in that mix, and the ONE merge over
               // DRUMMIX that the kit desk and the drum player both read
               MACHINEMIX, mixFor, laneKey,
               // the per-family DYNAMIC RESPONSE (the parent's STRIP stage) — the same
               // family walk stripFor uses, answering timbre instead of mix.
               // `dynCurve` is the arithmetic; the player only writes it onto
               // AudioParams, so the table and the sound cannot drift apart
               dynFor, dynCurve, DYN_ATK } = window.NuInstruments;

// ---- arranger policy (compose.js) + the shipped songs (presets.js) ----
export const { compose } = window.NuCompose;
export const PRESETS = window.PRESETS;

// ---- the big engine's sampled layer ----
// engine/faust/voices/sampler.js is the same SamplerLive live.js drives, and
// __REGISTRY carries the same zone tables the main app plays.
export const SP = window.FaustSampler;
export const REG = window.__REGISTRY;
export const SAMPLERS = (REG && REG.SAMPLERS) || {};

// (window.CsdSpeech and window.FoundPlayer were read here, for the singer:
// the parent's espeak organ and found-player's pitch measurer. The singer
// came out on 2026-08-17 — the tombstone was in kernel-daw.html, which this
// branch no longer has (4a4d730, "the band, alone") — and with it the only
// reader either global ever had on this page. found-player is still
// SCRIPTED in, because audio/plan.js's need() takes window.FoundPlayer
// as a preload rather than importing it again.)

// ---- the bench (nukernel/lab.js), LOADED ON DEMAND ----
// NOT REACHABLE ON THIS BRANCH, AND KEPT DELIBERATELY. `4a4d730` ("the band,
// alone: band.html is index.html and everything else stays home") took lab.js,
// inherit.js, genealogy.js and kernel-daw.html off this branch, and nothing
// under ui/ has called `loadLab` since — ui/state.js:269 still describes the
// seam it hangs on, and its "a page served without the lab simply keeps the
// stand-ins" branch is now the ONLY branch this page takes. It stays because
// the seam is state.js's and deleting the loader here would leave that comment
// pointing at nothing; whoever brings the bench back brings these three files
// with it. Verified 2026-08-24: zero callers, so this import never runs.
// The LAB tab's engine and its two oracles are ~123 KB of analysis tier that
// most sessions never open, so they were never in the page's classic list:
// ui/lab.js awaits this the first time the tab is shown, and the page boots
// without paying for a bench nobody asked for. (The parent app does the same
// thing with the star-cruise controller — dynamic-imported on the first ✦, not
// on the boot path.)
//
// THE ORDER IS THE DEPENDENCY GRAPH and it is not optional: lab.js reads
// window.NuInherit and window.NuGenealogy in its own prologue, synchronously,
// as it evaluates. Each import is a <script type="module"> in all but name —
// the three files are CommonJS in node and module-scoped in the browser (see
// lab.js's TIER note), which is why they are imported for their SIDE EFFECT and
// destructured off window here rather than through named exports: adding
// `export` to those files would break `require` in node, where they are CLIs.
// This function is the only place in ui/ that may await them, for the same
// reason this file is the only place that may read a global.
let labP = null;
export const loadLab = () => (labP || (labP = (async () => {
  if (!window.NuLab) {
    await import("../inherit.js");
    await import("../genealogy.js");
    await import("../lab.js");
  }
  return window.NuLab;
})()));
