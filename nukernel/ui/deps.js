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
               chordAt } = window.NuKernel;

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
               resolveMaster, masterIsDefault, resolveBuses, busesIsDefault,
               AUTOPARAMS, AUTOPARAMLABEL, AUTOSHAPELABEL, autoShape,
               SINGLABEL,
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
export const { instrOf, BASS_INSTR, DRUMDIR, DRUMFILE, FONTS, BASSSYNTH,
               STRIPS, stripFor, RANGES, STRETCH_UP, STRETCH_DOWN,
               DRUMMIX, DRUMBUS,
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
