// ui/deps.js — the SOLE reader of window.*. Everything the classic-script tier
// publishes (kernel-daw.html loads registry-data, sampler, kernel, genres,
// fields, song, instruments, compose, presets before any module runs) is read
// off window HERE, once, and re-exported as named bindings. No other module in
// ui/ or audio/ touches a global — so when the data tier one day becomes ESM,
// the conversion is this one file.
//
// This is safe by construction: a <script type="module"> is deferred, so it
// always evaluates AFTER every classic <script src> above it in the page —
// a stronger ordering guarantee than app/'s classic tier ever had.
//
// LAYER GRAPH (one-way, stated once here and enforced by import direction):
//   deps -> state -> derive -> audio/graph -> audio/assets -> audio/voices
//        -> audio/mixer -> audio/transport -> ui views (readout,
//        songrow, palette, editor, mixtbl, chrome) -> main
// audio never imports a ui VIEW module; ui views may import audio; state
// publishes events, it does not draw; derive is pure over its arguments.

// ---- the algebra (kernel.js) ----
export const { harm, render, drums, bass, ROMAN, word, KITOPS,
               envelope, edges, groove, withCadence, partOf,
               chordAt, chordsOf, MODE, harmonizeStage,
               // the time layer's own three: the tempo map's closed-form warp,
               // the one-note seating law the lead-in pickups share with the
               // harmonize stage, and the seeded dice both of them roll
               tempoWarp, seatNote, prng, TOMS } = window.NuKernel;

// ---- the genre table (genres.js) ----
export const { DEFAULT, GENRES, DRUMNAME, MODES, MODELABEL,
               SCALES, SCALELABEL, PROGS, FAMILIES } = window.NuGenres;

// ---- the control vocabulary (fields.js) — ONE definition of every control ----
export const NuFields = window.NuFields;
export const { NSLOTS, MAX_LEN, MAX_NUDGE, MAX_FX,
               OPS, OPLABEL, ENVLABEL, MOTLABEL, INLABEL, OUTLABEL,
               RATES, RATELABEL, SWINGS, SWINGLABEL, GROOVELABEL,
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
               SINGLABEL, INSTRCHOICES, POOLCHAIRS,
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
               // the per-family DYNAMIC RESPONSE (audio/voices.js) — the same
               // family walk stripFor uses, answering timbre instead of mix.
               // `dynCurve` is the arithmetic; the player only writes it onto
               // AudioParams, so the table and the sound cannot drift apart
               dynFor, dynCurve, DYN_ATK } = window.NuInstruments;

// ---- arranger policy (compose.js) + the shipped songs (presets.js) ----
export const { compose } = window.NuCompose;
export const PRESETS = window.PRESETS;

// ---- the singer as data (sing.js) ----
// The plan tier: syllables, the word banks, the measured espeak pitch ladders,
// which note gets which word in which voice. audio/sing.js renders it.
export const SING = window.NuSing || null;

// ---- the big engine's sampled layer ----
// engine/faust/voices/sampler.js is the same SamplerLive live.js drives, and
// __REGISTRY carries the same zone tables the main app plays.
export const SP = window.FaustSampler;
export const REG = window.__REGISTRY;
export const SAMPLERS = (REG && REG.SAMPLERS) || {};

// ---- the big engine's SPEECH and FOUND organs ----
// Two more borrowings from the parent, and they are read HERE for the same
// reason everything else is: audio/sing.js must not touch a global.
//   CsdSpeech  engine/speech.js — deterministic espeak-ng, the fresh-instance
//              law, the single-flight queue, the shared cache key. It lazily
//              dynamic-imports the ~1.7 MB wasm, so referencing it costs
//              nothing until something actually sings.
//   FoundPlayer engine/faust/voices/found-player.js — read for f0Profile /
//              detectMedianHz ONLY, the deterministic clip-snap's measuring
//              half. Nothing here fetches a found source or builds a grain.
// Both are optional: a page served without them degrades to a silent singer
// (audio/sing.js counts it) rather than to a thrown module.
export const CS = window.CsdSpeech || null;
export const FP = window.FoundPlayer || null;

// ---- the bench (nukernel/lab.js), LOADED ON DEMAND ----
// The LAB tab's engine and its two oracles are ~123 KB of analysis tier that
// most sessions never open, so they are not in kernel-daw.html's classic list:
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
