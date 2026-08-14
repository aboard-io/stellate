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
//        -> audio/mixer -> audio/transport -> ui views (readout, arrange,
//        songrow, palette, editor, chrome) -> main
// audio never imports a ui VIEW module; ui views may import audio; state
// publishes events, it does not draw; derive is pure over its arguments.

// ---- the algebra (kernel.js) ----
export const { harm, render, drums, bass, ROMAN, word, KITOPS,
               envelope, edges, groove, withCadence } = window.NuKernel;

// ---- the genre table (genres.js) ----
export const { DEFAULT, GENRES, DRUMNAME, MODES, MODELABEL,
               SCALES, SCALELABEL, PROGS } = window.NuGenres;

// ---- the control vocabulary (fields.js) — ONE definition of every control ----
export const NuFields = window.NuFields;
export const { NSLOTS, MAX_LEN, MAX_NUDGE, MAX_FX,
               OPS, OPLABEL, ENVLABEL, MOTLABEL, INLABEL, OUTLABEL,
               RATES, RATELABEL, SWINGS, SWINGLABEL, GROOVELABEL,
               KITLABEL, DRUMKITS, BASSOPS,
               FX, fxChain, SENDS, SENDLABEL, VERBS,
               DTIMES, DTLABEL, LEVELS, LEVELLABEL, PANS, PANLABEL,
               VOX, VOXPARAM, OCTAVES, ARTICS, CMODES, CLAMPLABEL,
               KEYS, KEYLABEL, PROGCHOICES, PROGLABEL, PERIODS, PERIODLABEL,
               BREATHS, BREATHLABEL, PIPESETS, PIPELABEL, PARTCHOICES,
               AUTOPARAMS, AUTOPARAMLABEL, AUTOSHAPELABEL, autoShape,
               ROLES } = window.NuFields;

// ---- pure persistence (song.js) ----
export const NuSong = window.NuSong;
export const { blank, emptyBox } = window.NuSong;

// ---- the sound sources as data (instruments.js) ----
export const { instrOf, BASS_INSTR, DRUMDIR, DRUMFILE, FONTS, BASSSYNTH,
               STRIPS } = window.NuInstruments;

// ---- arranger policy (compose.js) + the shipped songs (presets.js) ----
export const { compose } = window.NuCompose;
export const PRESETS = window.PRESETS;

// ---- the big engine's sampled layer ----
// engine/faust/voices/sampler.js is the same SamplerLive live.js drives, and
// __REGISTRY carries the same zone tables the main app plays.
export const SP = window.FaustSampler;
export const REG = window.__REGISTRY;
export const SAMPLERS = (REG && REG.SAMPLERS) || {};
