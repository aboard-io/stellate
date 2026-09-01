// audio/to-engine.js — THE BRIDGE. nukernel's score, said in the parent
// engine's own language.
//
// nukernel keeps its kernel, its genres, its composer and its UI. It stops
// making its own sound. The parent engine (engine/faust/) eats exactly ONE
// shape — the four arrays engine/csd-engine.js buildEvents returns,
// {pitched, drums, found, sfx} — and engine/faust/voices/state-engine.js maps
// that onto precompiled dist/ voice modules with no audio involved at all.
// So the whole job here is TRANSLATION: a nukernel bar list in, that shape
// out, plus the parent-shaped `state` its unit table is resolved from.
//
// Nothing in this file synthesizes, schedules, or opens an AudioContext. It is
// pure over its arguments the way ui/derive.js is pure over its own — which is
// what lets a node gate prove the translation without a browser, and what lets
// the live path and the offline bounce read one translator instead of two.
//
// THE THREE CONVENTIONS, because getting any of them wrong is silent and
// sounds like a bug in the music:
//
//   PITCH   the parent speaks csound `pch` — OCTAVE.SEMITONE, where 8.00 is
//           middle C. state-engine's cpspch reads it as
//           261.625565 · 2^((oct−8) + semi/12). nukernel speaks MIDI. pchOf()
//           is the whole conversion and it is exact: the semitone half is an
//           integer, so no float rounds the wrong way.
//   TIME    the parent schedules in BEATS. nukernel schedules in STEPS, and a
//           step is a sixteenth (audio/plan.js stepDur = 60/bpm/4), so
//           beats = steps/4 and nothing else. The tempo map has already been
//           integrated into `bar.barSteps` and every event's `off` by
//           ui/derive.js warpBars, so dividing by four carries the rubato
//           through untouched — the bridge must NOT re-derive a bar length
//           from the bar count.
//   AMP     nukernel velocities are 0..9 (an integer level, a tracker column).
//           The parent's buildEvents emits amps around 0.14–0.26 pitched and
//           0.1–0.7 drums, and every unit's gain is amp × the unit's own level.
//           The two scales below put a velocity 9 at the top of the parent's
//           own range rather than at 1.0, which would ride the master limiter.
//
// NO SILENT FALLBACKS. Anything this file cannot route to a parent voice comes
// back in `unrouted`, named, for the readout to show — it is never quietly
// dropped and never quietly handed back to the old WebAudio path.

// ---- the parent's own pitch spelling ---------------------------------------
// MIDI -> csound pch. 60 -> 8.00, 71 -> 8.11, 59 -> 7.11. Fractional MIDI (the
// bend/microtone case) rounds to the nearest semitone here and carries the
// remainder in `bend`, which the parent's sampler lane honours and its Faust
// modules ignore by contract (VOICES.md, the blue-note bend).
export function pchOf(midi) {
  const m = Math.round(midi);
  const oct = 8 + Math.floor((m - 60) / 12);
  const semi = m - 60 - 12 * (oct - 8);
  return oct + semi / 100;
}
// THE CENTS THAT ROUNDING THREW AWAY (2026-08-30, the pitch wall). pchOf
// rounds a fractional MIDI note to the nearest semitone — the pch encoding
// is a 12-TET spelling and stays one — so the remainder is carried BESIDE
// the pch as integer cents (-50..+50), and mapEvents multiplies it back into
// the note's Hz for EVERY voice (freq is freq: synth slider, model delay
// line, sampler rate alike). An integer note has zero remainder, writes no
// key, and its event object is byte-identical to yesterday's.
export const centsOf = (midi) => Math.round((midi - Math.round(midi)) * 100);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
const STEPS_PER_BEAT = 4;

// ---- the parent's tables and the instrument rows, READ rather than mirrored -
// This bridge used to keep byte-for-byte COPIES of the parent's physical-
// control tables (MODEL_DYN, TRACT_DYN, VOICE_TYPE, the vowel alphabet, the
// dyn amp window) with unit gates diffing every copy against the parent's own
// source text — a maintenance tax paid on every retune, and a silent-drift
// hazard the moment a gate was loosened. The copies are gone: the parent
// exports the tables now and this file reads them, so the page and the tape
// play one instrument by CONSTRUCTION instead of by two files agreeing.
//
// HOW THE PARENT ARRIVES, without giving up the node gates: this is
// audio/plan.js's own `need` idiom. A BROWSER page has instruments.js as a
// classic script already (kernel-daw/band/drums all load it before any module
// runs) and takes state-engine.js as a one-time dynamic import that the UMD
// header publishes onto window — the same URL plan.js loads, so it is fetched
// and executed exactly once between them. NODE has neither global and takes
// both through CommonJS interop (`m.default` is the api), which is what lets
// a pure-node gate import this file bare and call patchForInstr with no
// window, no stub and no browser. Top-level await makes the handles
// synchronous for everything below; the module graph simply finishes when
// they have.
const G = typeof window !== "undefined" ? window : globalThis;
if (!G.FaustStateEngine) {
  const m = await import("../../engine/faust/voices/state-engine.js");
  if (!G.FaustStateEngine) G.FaustStateEngine = (m && (m.default || m)) || G.FaustStateEngine;
}
if (!G.NuInstruments) {
  const m = await import("../instruments.js");
  if (!G.NuInstruments) G.NuInstruments = (m && (m.default || m)) || G.NuInstruments;
}
// ...and the two tables the VOICE KNOBS need, by the same door and for the same
// reason (2026-08-28, the round that wired them). `NuFields` owns the WORDS —
// VOX's five vocabularies and the normalized position each word names, and
// VOXPARAM's ordered list of DSP params a knob may ride. `NuKnobs` owns the
// RANGE those positions are measured against: it is generated by
// nukernel/knobs-extract.js, which probes this same parent at both ends of every
// candidate key and publishes the outermost pair of values at which the param
// still MOVES. Taking the range from there rather than typing one is the whole
// difference between a knob and a drawing of a knob: the extractor has already
// trimmed the dead travel off both ends, so "dark" and "screaming" are the ends
// of the audible travel, not the ends of a slider that stops doing anything at
// 40%.
if (!G.NuFields) {
  const m = await import("../fields.js");
  if (!G.NuFields) G.NuFields = (m && (m.default || m)) || G.NuFields;
}
if (!G.NuKnobs) {
  const m = await import("../knobs.js");
  if (!G.NuKnobs) G.NuKnobs = (m && (m.default || m)) || G.NuKnobs;
}
const SE = G.FaustStateEngine, NI = G.NuInstruments, NF = G.NuFields, NK = G.NuKnobs;

// velocity 0..9 -> the parent's amp range (see AMP above). THE WINDOW IS THE
// PARENT'S OWN DYN_AMP_LO/HI — the two numbers mapEvents normalises a note's
// amp over before writing a physical control — so a velocity-9 note lands ON
// the top of the plectrum by construction. (0.26 − 0.06 === 0.2 exactly in
// IEEE doubles, checked, so the derived span is byte-identical to the literal
// 0.20 this file used to carry.)
const PITCH_AMP_FLOOR = SE.DYN_AMP_LO, PITCH_AMP_SPAN = SE.DYN_AMP_HI - SE.DYN_AMP_LO;
const DRUM_AMP_FLOOR = 0.12, DRUM_AMP_SPAN = 0.52;
const ACCENT_LIFT = 1.15;
const pitchAmp = (vel, acc) => clamp((PITCH_AMP_FLOOR + PITCH_AMP_SPAN * clamp(vel, 0, 9) / 9) *
  (acc ? ACCENT_LIFT : 1), 0.01, 0.34);
// EXPORTED: the live page hits with this too, because velocity has to mean one
// thing whichever engine is holding the stick.
export const drumAmp = (vel, acc) => clamp((DRUM_AMP_FLOOR + DRUM_AMP_SPAN * clamp(vel, 0, 9) / 9) *
  (acc ? ACCENT_LIFT : 1), 0.02, 0.8);

// ---- the kit, lane by lane -------------------------------------------------
// nukernel writes twelve lanes (kernel.js DRUM_LANES); the parent resolves
// nine drum UNITS (kick/snare/hat/tom always, and clap/rim/ride/crash/perc
// only when `state.perc` is set — see state-engine voiceUnits).
//
// THE SUBSTITUTIONS ARE GONE. There were two, and they were the last place the
// page and the tape played different drums for the same kit: `f` was a closed
// hat made short and quiet because the parent's hat had no third zone, and
// t/m/l were the middle tom repitched across the whole range because the
// parent's kit named one tom. Meanwhile this page, loading the same directory
// off disk, played hatPedal.wav and tomHi.wav and tomLo.wav — the real
// recordings, sitting there, that the record could not name. So the parent's
// DRUMKITS overlay widened to the whole extraction (twelve hits, not nine) and
// these lanes now ASK FOR THE FILE:
//   f      `pedal` selects the pedal zone, which sits under the closed hat in
//          the kit's keymap. A drum MACHINE has no pedal hat and none is
//          invented: the flag is inert without a sampler and `f` is a closed
//          hat on a 909, which is what a 909 is.
//   t/m/l  the tom lanes ask for the drum by NAME (`tom`), and toEngine below
//          turns that into the pitch of that kit's own drum, read off the kit
//          spec — a power floor tom and an acoustic one are not the same pitch,
//          so the number cannot live in this table. The `pitch` here is the
//          fallback for a kit that has no recordings to name (the machines, and
//          the stand-in voices), where a repitched membrane is the whole point.
export const LANE = {
  k: { unit: "kick",  dur: 0.30 },
  s: { unit: "snare", dur: 0.25 },
  p: { unit: "rim",   dur: 0.15, perc: true },
  c: { unit: "clap",  dur: 0.25, perc: true },
  h: { unit: "hat",   dur: 0.10, open: false },
  o: { unit: "hat",   dur: 0.45, open: true },
  f: { unit: "hat",   dur: 0.09, open: false, pedal: true },
  r: { unit: "ride",  dur: 0.40, perc: true },
  x: { unit: "crash", dur: 1.40, perc: true },
  t: { unit: "tom",   dur: 0.28, pitch: 132, tom: "tomHi" },
  m: { unit: "tom",   dur: 0.28, pitch: 105, tom: "tom" },    // 105 Hz = the parent's tom root
  l: { unit: "tom",   dur: 0.32, pitch: 88,  tom: "tomLo" },
};

// ---- the kit, as a whole ---------------------------------------------------
// Six of nukernel's ten kit names ARE the parent's sampled kits, byte for byte
// (genre-kernel DRUMKITS: acoustic/room/power/electronic/jazz/brush), so they
// resolve to real recorded one-shots through K.drumKitSpec. The other FOUR are
// DRUM MACHINES, and the parent already owns every one of them as a synthesis
// model — kickModel/snareModel/hatModel is its own vocabulary (state-engine
// voiceUnits), and `tune` is the one knob its three kick modules take.
//
// THIS TABLE IS THE WHOLE DRUM SYSTEM AND THERE IS NO OTHER. It used to name
// three machines here for the tape while the page voiced four of its own out of
// a bank of oscillators — so a tr909 song was one drum machine live and a
// different one on the record, and tr606 (which nothing here named) was a real
// 606 live and the default kit on the tape. There is one engine now and it resolves its
// live hits from this same table through drumVoice() below: one row per box,
// read twice.
//
// tr606 IS THE NEAREST-VOICE ROW, said out loud: the Drumatix kick is thin and
// mid-forward with no boom in it, so it is `boom` tuned UP rather than the 808's
// long fall; its snare is noise-led; its famous hats are square-wave metal like
// every other box here.
export const MACHINE_KIT = {
  tr909: { kickModel: "909",  snareModel: "crack", hatModel: "metal", tune: 1.00 },
  tr808: { kickModel: "808",  snareModel: "noise", hatModel: "metal", tune: 0.92 },
  tr606: { kickModel: "boom", snareModel: "noise", hatModel: "metal", tune: 1.25 },
  cr78:  { kickModel: "boom", snareModel: "noise", hatModel: "metal", tune: 0.88 },
};
// which kit names are machines rather than directories of recorded one-shots.
// Exported because the loaders ask it: a machine has nothing to fetch.
export const isMachine = (kit) => !!MACHINE_KIT[kit];

// ---- a lane, as a parent MODULE --------------------------------------------
// state-engine voiceUnits' own three model maps and its four fixed perc voices,
// mirrored here and nowhere else, so the page and the tape name the same drum
// for the same kit. UNIT_LVL is voiceUnits' own per-voice level (the hat rides
// at 0.7, the cymbals at 0.9); the parent's mastering trims on top of it are the
// tape's, the way nukernel's desk on top of it is the page's.
const KICK_MODULE  = { boom: "kick_boom", "808": "kick_808", "909": "kick909" };
const SNARE_MODULE = { noise: "snare_noise", crack: "snare_crack", clap: "snare_clap" };
const HAT_MODULE   = { noise: "hat_noise", metal: "hat_metal" };
const UNIT_MODULE  = { tom: "tom", clap: "snare_clap", rim: "snare_crack",
                       ride: "hat_metal", crash: "hat_metal" };
const UNIT_LVL = { hat: 0.7, ride: 0.9, crash: 0.9 };

/**
 * Which parent voice a nukernel drum lane is, under a given kit.
 *
 * Returns { unit, module, durB, lvl, gain, pitch, open } or null for a lane no
 * parent voice covers — NEVER a quiet substitute. `durB` is in BEATS (the
 * parent's drum events are, and mapEvents multiplies by the seconds-per-beat to
 * get the module's `decay`), so a live caller must do the same multiplication or
 * the page rings for a different length than the record.
 *
 * A SAMPLED kit answers the same modules: they are the metadata the parent
 * keeps behind `u.sampler`, and they are what a lane falls back to when the
 * recording never decoded.
 */
export function drumVoice(kit, lane) {
  const L = LANE[lane];
  if (!L) return null;
  const M = MACHINE_KIT[kit] || {};
  const module = L.unit === "kick" ? (KICK_MODULE[M.kickModel] || "kick_boom")
    : L.unit === "snare" ? (SNARE_MODULE[M.snareModel] || "snare_noise")
    : L.unit === "hat" ? (HAT_MODULE[M.hatModel] || "hat_noise")
    : UNIT_MODULE[L.unit];
  if (!module) return null;
  return { unit: L.unit, module, durB: L.dur, lvl: UNIT_LVL[L.unit] || 1,
    gain: L.gain || 1, pitch: L.pitch || 0, open: !!L.open,
    tune: L.unit === "kick" ? (M.tune || 1) : 1 };
}

// ---- the chair, as a parent ROLE -------------------------------------------
// nukernel seats seven chairs (kernel.js PARTS); the parent resolves four roles
// (pad/bass/melody/solo), and a role is not a name — it selects the channel
// strip, the pool size, the send lift and the register law. The mapping is by
// what the chair DOES:
//   pad, drone   the held harmony -> `pad` (chorus + phaser, 120 Hz HPF)
//   stab         a chord, rhythmically -> `pad` too. A stab is a chord voicing;
//                on the `melody` strip its 200 Hz high-pass takes the body out
//                of it and it stops being a chord.
//   line, lead, riff, counter -> `melody` (the lead strip: presence lift,
//                faster comp, the delay/leslie air)
const CHAIR_ROLE = { pad: "pad", drone: "pad", stab: "pad",
  line: "melody", lead: "melody", riff: "melody", counter: "melody" };

// ---- a nukernel `synth` block, as a parent RECIPE ---------------------------
// nukernel's genres already name parent dsp ids (genres.js `synth: {dsp}`), and
// a `set` block is written in the DSP's OWN param names — that is the spelling
// the parent writes these straight onto the worklet, so they have to be.
// The renames below are the places the parent's RECIPE spells the same knob
// differently, and `role` is the one thing that cannot be inferred: the parent
// picks pad_saw vs supersaw from the ROLE, and modeld/tb303/synclead are mono
// voices it will only build for a lead. So a genre that names a lead dsp gets a
// lead chair for that voice, whatever the chair said.
export const SYNTH_NAMES = () => Object.keys(SYNTH);
const SYNTH = {
  modeld:    { model: "modeld", role: "melody" },
  tb303:     { model: "tb303",  role: "melody", rename: { resonance: "res" } },
  supersaw:  { model: "stack",  role: "melody", rename: { detune: "spread" }, waveIndex: true },
  pad_saw:   { model: "saw",    role: "pad" },
  juno60:    { model: "juno60", rename: { spread: "chorusSpread" } },
  lead_fuzz: { model: "fuzz",   role: "melody" },
  dx7_alg5:  { model: "rhodes", role: "melody" },
  // TWO-OPERATOR FM, WHICH THIS BOX COULD PLAY AND COULD NOT NAME. Paul,
  // 2026-08-25: "I feel also we're just not using FM enough" — and the reason
  // was not cost. Measured (VOICE.md §9): COST.fm2op is 0.53 against a BUDGET
  // of 40, which is 1.3% of a record's whole voice budget and cheaper than
  // everything in this table except the organ and the choir; one DX7 voice is
  // 6.4, and a tract is 9.6. What FM did not have was a NAME: `fm2op` had no
  // row here and no PATCH_* row, so there was no string a document could write
  // that reached it, and the only FM in the catalogue was `dx7_alg5` pinned to
  // one cartridge and seated by exactly one anchor in 139 (vaporwave). One line
  // makes it seatable by any document and puts it in the instrument menu, which
  // reads `SYNTH_NAMES()` through avail.js instrOptions. No role: two operators
  // hold a pad as happily as they play a lead, and the parent's `fm` case
  // builds `module: "fm2op"` for both.
  fm2op:     { model: "fm" },
  // the rest of the fleet the patch table reaches for. Nothing here is new
  // synthesis — every one is a precompiled dist/ module the parent has been
  // able to play all along and nothing in nukernel had ever asked for.
  solina:    { model: "solina",   rename: { tone: "cutoff" } },
  oberheim:  { model: "oberheim", rename: { detune: "obDetune" } },
  ppg:       { model: "ppg" },
  vp330:     { model: "vp330",    rename: { detune: "vpDetune" } },
  casiocz:   { model: "casiocz",  rename: { wave: "czWave", detune: "czDetune" } },
  synclead:  { model: "synclead", role: "melody", rename: { detune: "syncDetune" } },
  bell:      { model: "bell" },
  // THE PIPE ORGAN, which was compiled and playable and simply unnamed here.
  // faust/dsp/organ.dsp is additive — partials 1, 2, 3, 4 and 6 through a
  // lowpass, with a long release and a slow wow — and `model: "organ"` has
  // been in the parent's vocabulary all along (csd-engine.js). No role: an
  // organ holds the chord AND plays the line, which is the whole point of it
  // in a fugue.
  organ:     { model: "organ" },
  // …and the voices, on the same terms: compiled, playable, unnamed here.
  choir:     { model: "choir" },
  hammond:   { model: "hammond" },
  // the instruments you PLAY rather than recordings you edit. No `role`: a
  // guitar holds chords and plays lines, and so does a marimba (minimalism has
  // two of them doing both), and so does a piano.
  stk_guitar: { model: "eguitar" },
  stk_piano:  { model: "piano" },
  gtr_amp:    { model: "eguitar" },   // the hand-rolled string, kept nameable
  mallet:     { model: "mallet" },
  // …and the BOW (2026-08-30, the registry lane). The one instrument in this
  // dictionary that exists because it could NOT be a recording: every soundfont
  // in the tree is GM bank 0, all 128 presets measured, and GM has no erhu, no
  // dizi, no pipa and no sheng — which is the whole of genres.js's refusal of
  // the `guoyue` cell. No `role`, for the guitar's reason: a fiddle carries the
  // tune and it also holds a drone under somebody else's.
  erhu:       { model: "erhu" },
  // THE THROAT. Both roles are declared, because a singer and a section are not
  // interchangeable seatings of one thing the way pad_saw and supersaw are: a
  // lead follows the TUNE and a choir holds the HARMONY, and the parent's `pad`
  // strip is the one that does not high-pass the body out of four people.
  voice_lead:  { model: "singer",  role: "melody" },
  voice_choir: { model: "chorale", role: "pad" },
  // and the THIRD seating of a mouth, which is the one that can shut: the
  // Kelly-Lochbaum tube (engine/faust/dsp/tract_voice.dsp), where the two above
  // are formant banks. `role: "melody"` is not a preference here the way it is
  // for the singer, it is the COST: the parent will only build this module for a
  // line, and falls a pad through to the choir, because one tract is most of what
  // a phone has left. See PATCH_MOUTH below for who gets one and why.
  tract_voice: { model: "mouth",   role: "melody" },
  // THE TWO SYNTH BASSES, which the tape could not play at all until the
  // one-engine round. nukernel's BASSSYNTH names them by their dsp file
  // (bass_reese / bass_wobble) and the parent names them by their SEAT — its
  // bass switch reads `model` "reese" / "wobble" and hands back exactly those
  // modules — so the two tables never met and every reese and every wobble came
  // back `unrouted`. A reese IS its detuned beating and a wobble IS its LFO;
  // neither can be a sample, so an unrouted one is not a quieter bass, it is a
  // different song. Role stated: the parent only reaches this switch for a bass.
  bass_reese:  { model: "reese",  role: "bass" },
  bass_wobble: { model: "wobble", role: "bass" },
};
// the parent's own oscillator alphabet — the same four words in the same order,
// read off the api rather than spelled a second time
const WAVES = SE.WAVES;

// The genre's `tone` block is nukernel's WebAudio voicing — one filter, one
// envelope, one send. Every field of it has a parent recipe key, so it carries
// the genre's colour across instead of being thrown away: `q` is a biquad Q
// (0.7 flat, ~12 screaming) against the parent's 0..0.95 resonance, and `gain`
// is a WebAudio node gain against the parent's 0..1 voice level.
/* ---- ONE OWNER FOR "HOW LOUD IS tone.gain", 2026-08-27 (FUTURE.md Phase 0).
 * The engineer counted twelve multiplicative owners of one voice's loudness,
 * and FOUR of them were this file scaling the same knob four different ways:
 * the sampled lane read `gain * 2.2` into [0.15, 1] (toneRecipe below), the
 * modelled voice and mouth lanes read `(gain ?? 0.28) * 2.8` into [0.35, 0.92],
 * the struck/electric lane read the same times its per-instrument ring tax
 * `P.mul`, and the GM synth lane read it into [0.5, 0.92]. Four spellings,
 * four places to drift, no name.
 *
 * NOW there is one function and the four scalings are ONE VISIBLE TABLE. The
 * numbers are NOT merged: each row was fitted against its own lane's output
 * trim (the sampled path's own gain staging vs. pitchedUnit's level clamp),
 * and collapsing them to one row would re-level the whole catalog — the frozen
 * fixture (test/levelof-frozen.fixture.js) holds every genre's engine state
 * byte-identical across this consolidation (measured 2026-08-27: 199 catalog
 * anchors, 43,502 fixture bytes, sha256 equal before and after — and the
 * fixture is proven SENSITIVE: nudging any lane's scale or clamp moves the
 * hash), which is the gate that proves the change is structural and not tonal. Merging the rows is future work behind a
 * measured re-fit, and when it happens it happens HERE, in one place.
 *   sampled: no default on purpose — an absent tone.gain writes no `level` key
 *            and the sampler's own trim stands (absent-is-today);
 *   model:   `mul` is modelForInstr's ring tax, applied INSIDE the clamp as it
 *            always was.
 *
 * ...AND IT HAPPENED, 2026-08-27, THE SAME DAY, AND IT IS A RE-LEVEL AND NOT A
 * MERGE. Paul, listening: *"voices seem to be mixed really hot and
 * saturated"*, and when asked to let it be measured first, *"Just turn down
 * saturation my ears aren't wrong."* He is right and the mechanism is this
 * table. EVERY ROW IS MULTIPLIED BY 0.75 — a uniform -2.50 dB, clamps and all,
 * so the four lanes keep every relative balance they were separately fitted
 * for and only the level into the master moves.
 *
 *   lane      scale          lo               hi
 *   sampled   2.2  -> 1.65   0.15  -> 0.1125  1    -> 0.75
 *   model     2.8  -> 2.1    0.35  -> 0.2625  0.92 -> 0.69
 *   synth     2.8  -> 2.1    0.5   -> 0.375   0.92 -> 0.69
 *
 * THE CLAMPS MOVE WITH THE SCALE OR THE CUT IS NOT A CUT. Measured first with
 * `scale` alone: every voice the old `lo` had been holding up simply sat on
 * the floor and gave back nothing, so the trim was a trim for the loud voices
 * and nothing for the quiet ones — which is a re-BALANCE, the one thing this
 * change must not be.
 *
 * WHY THE GAIN STAGING IS THE SATURATION, WHICH IS THE WHOLE ARGUMENT FOR
 * TOUCHING A LEVEL TABLE WHEN THE COMPLAINT WAS TIMBRE. fx_bus ends every
 * record in the Bram de Jong soft clip at 0.95: LINEAR below 0.475 (-6.47
 * dBFS), a saturating knee above it, asymptotic to 0.7125 (-2.94 dBFS). It is
 * unconditional — `ceiling` never reached it (audio/desk.js says so, and the
 * measurement below confirms it) — so it is on for all 199 anchors. Measured
 * on the rendered artifact at 8 bars, five of six records peaked between -3.16
 * and -4.09 dBFS: inside the knee, within 1.2 dB of the asymptote. What proves
 * it is a clip and not a mix is that TRIMMING THE INPUT BARELY MOVES THE PEAK
 * AND MOVES THE CREST INSTEAD — at -2.0 dB into this table the peak fell
 * 0.10-0.24 dB while the crest ROSE 0.67-1.47 dB, and at -3.0 dB the crest rose
 * 1.97 dB on jazzrock. Roughly a dB of transient was being handed to the clipper
 * per 2 dB of level, and getting it back is heard as "less saturated" rather
 * than as "quieter", because that is exactly what it is.
 *
 * WHAT WAS RULED OUT FIRST, each by rendering with it neutralised (the press is
 * nukernel/export/_satpress.js, driven by _satdrive.cjs):
 *   * the per-voice channel strip's tanh — NO AUTHORITY. It is level-
 *     preserving (`tanh(x*g)/g`) and the voices run far below its knee: sat 0
 *     and sat 1/satDrive 12/satMix 1 both render within 0.14 dB of the shipped
 *     value on every statistic.
 *   * `GLUES`' makeup and `CEILINGS`' push — DO NOT REACH. fields.js
 *     resolveMaster has no caller; audio/desk.js masterState reads its own
 *     GLUE_COMP and never these. Both render bit-identical when zeroed.
 *   * the tape head (`tsat`, on every record at 0.18) — REAL BUT SMALL:
 *     removing it entirely returns 0.29-0.87 dB of RMS and 0.02-0.04 dB of the
 *     2-8k/300-3k harmonic ratio. Left alone; turning down a stage that is not
 *     the cause is theatre.
 * The two that ARE turned down are this table and fields.js DRIVES, each at
 * its own owner, and neither is a global trim.
 */
// EXPORTED SINCE 2026-08-27, for the reason the table exists at all: the gate
// that holds it (test/tape-reach R6) used to carry a hand-written copy of the
// four scalings, which is one table in two places the day either moves — and it
// moved. It reads THIS now, and asserts the shape and the uniformity of the
// turn-down instead of the literals.
/* QUIETER BY HALF, 2026-08-28. Paul: *"Kindly mix everything much much
   quieter all over. It's all just saturated IN THE MIX. Nothing is gentle."*

   THE NUMBER IS NOT TASTE, IT IS A MEASUREMENT. With the master bypassed
   this morning, every record arrived at the master ALREADY over full scale:
   iranpop +4.29 dBFS, rock +8.27, jazzrock +6.70, hymn +2.86. So the mix was
   being made by the clipper - 6 to 12 dB of it - and a soft clipper working
   that hard is the "recorded on a very hot mic" sound Paul has now reported
   three times. The earlier cut here (x0.75, -2.5 dB) was measured against a
   master that was still flattening everything, so it could not be felt.

   -6 dB (x0.5) is chosen to land the worst offender under unity with room to
   spare: rock's +8.27 becomes +2.3 raw, and everything else lands negative.
   The clamps travel with the scale, because scaling `scale` alone lets every
   voice the old floor was holding up sit on the floor and give nothing back -
   that was measured when this table was first cut.

   THE HEADROOM IS THE POINT, NOT THE LOUDNESS. What comes back is the room
   between the parts: a record that arrives at -6 lets the master's stages be
   a choice rather than a rescue, which is what "nothing is gentle" was
   describing. Absent-is-today is deliberately suspended - Paul asked every
   record to change. */
export const LEVEL_LANES = {
  sampled: { dflt: null, scale: 0.825, lo: 0.0563, hi: 0.375 },
  model:   { dflt: 0.28, scale: 1.05,  lo: 0.1313, hi: 0.345 },
  synth:   { dflt: 0.28, scale: 1.05,  lo: 0.1875, hi: 0.345 },
};
export function levelOf(tone, lane, mul) {
  const L = LEVEL_LANES[lane] || LEVEL_LANES.model;
  const g = tone && tone.gain != null ? tone.gain : L.dflt;
  if (g == null) return null;
  return clamp(g * L.scale * (mul == null ? 1 : mul), L.lo, L.hi);
}
function toneRecipe(tone) {
  if (!tone) return {};
  const out = {};
  if (tone.cut != null) out.cutoff = clamp(tone.cut, 60, 16000);
  if (tone.q != null) out.res = clamp((tone.q - 0.7) / 12, 0, 0.9);
  if (tone.atk != null) out.attack = clamp(tone.atk, 0.001, 5);
  if (tone.rel != null) out.release = clamp(tone.rel, 0.01, 3);
  { const lv = levelOf(tone, "sampled"); if (lv != null) out.level = lv; }
  if (tone.verb != null) out.send = clamp(tone.verb * 1.4, 0, 1.2);
  return out;
}

// ---- THE TONE BLOCK IS A SYNTHESISER — the story, the thirteen GM synth
// rows it argues for, and the SWEEP constants they share, all live in
// nukernel/instruments.js now (PATCHES, and the essay above it): every row is
// an instrument-keyed fact and the instrument-keyed facts live with RANGES and
// STRIPS. What stays HERE is the arithmetic that drives the rows — the T and M
// tone-block translations in synthForInstr/modelForInstr below are keyed by
// parent DSP and by this bridge's own conventions, not by instrument.

// the parent's oscillator alphabet has no triangle. A triangle is a sine with a
// little edge on it, so `sine` is the honest nearest and `saw` would be a lie —
// and measured across the table, no genre that reaches a wave-bearing row here
// asks for one anyway.
const WAVEOF = { sawtooth: "saw", saw: "saw", square: "square",
                 pulse: "pulse", triangle: "sine", sine: "sine" };
// THE FOUR TABLES, under their old names. Keyed by KIND first in
// instruments.js because `synth_voice` honestly appears twice — the VP-330
// photograph in `synth` (a pad's reading) and the talking tract in `mouth`
// (a line's) — and the CHAIR, not the data, decides which a genre meant
// (see patchForInstr below).
const { synth: PATCH_SYNTH, model: PATCH_MODEL,
        voice: PATCH_VOICE, mouth: PATCH_MOUTH } = NI.PATCHES;

// ---- WHAT VELOCITY MOVES ON AN INSTRUMENT YOU PLAY -------------------------
// On a synth, velocity opens a filter. On a string, a bar and a throat it moves
// the thing that EXCITES them — the plectrum, the mallet head, the glottal fold
// — and that is a different sound at the same loudness, which is the whole
// argument for the two tables below this one.
//
// The ranges are the parent's own engine/faust/voices/state-engine.js
// MODEL_DYN (and VOICE_TYPE below for who is singing and how high they go) —
// READ off the api now, not mirrored. The rows used to be copied here because
// the page loaded no state-engine; it loads it at the top of this file (the
// same one-time import plan.js makes), so a mirror that could drift became a
// read that cannot: a retune of the plectrum in the parent IS the retune on
// this page, and test/unit/nukernel.test.js §75 still holds what
// patchForInstr hands the live player against the parent's own source text —
// the artifact, not the wiring.
const LIVE_DYN = SE.MODEL_DYN;
// THE TUBE'S OWN ROW, and it is beside the table rather than in it for the same
// reason the parent keeps it beside MODEL_DYN rather than in it: that table is
// the models a chair reaches BY NAME, and every reader of it takes "an
// instrument id is enough to cast this". A tract is reached by an id AND a
// chair — GM 54 on a line, never on a pad — so a row in the table above would
// promise a seating that does not exist. Same axis as the singers': `push` is
// the glottal fold, which is the spectral tilt and not the level. Wider than
// voice_lead's at both ends, because a talker's soft end is nearly a whisper
// and its loud end is a shout. The parent's own row (state-engine.js
// TRACT_DYN), read for LIVE_DYN's reason: one copy, one instrument.
const TRACT_DYN = SE.TRACT_DYN;
/**
 * THE PAGE'S OWN A/B, per module: what puts a played instrument level with the
 * recording it stands in for ON THIS PAGE.
 *
 * The modules' own output trims (the `*3.7` at the end of voice_lead.dsp and
 * its three siblings) were fitted against the parent's press — its recipe
 * level, its master chain, its makeup. nukernel's page is a different chain
 * with its own sampler gain staging and its own master, and measured on it the
 * same modules land well under the zones they replace. So the page carries one
 * number per module, and it is a ROUTE gain, not a
 * louder `level` or a hotter `gain`: on the guitar amp `gain` is the input of
 * the shaper, so lifting it would buy level by adding dirt, and `level` has
 * only 3 dB of headroom left anyway. Trimming the route moves nothing but the
 * volume.
 *
 * MEASURED, on captured page output, one chair sounding and no drums — which
 * is what the one-voice genres (Solo, Riff, Vocal, Backing vocals) are for.
 * Each row is the deficit that measurement found:
 *   stk_guitar   Solo (overdrive) -7.4 dB, Riff (palm-muted) -8.8 dB — measured
 *                on the waveguide this module replaced, and inherited because
 *                the replacement was fitted level with it note for note
 *                (stk_guitar.dsp's own two trims, worst residual 0.9 dB)
 *   mallet       Riff cast to a vibraphone, -6.7 dB
 *   stk_piano    NOT MEASURED ON THE PAGE, and the only row here that is not.
 *                Its number is the average of the two that were, because both
 *                of those deficits are a staging offset between the press's
 *                master chain and this page's rather than anything about the
 *                instrument. It is the one line in this file waiting on ears.
 *   voice_lead   Vocal (solo_vox), -18.3 dB
 *   voice_choir  Backing vocals -27.2 dB, Rome 600 -19.5 dB. The spread is the
 *                instrument being an instrument: an /u/ through a formant bank
 *                really is quieter than an /a/, and no single number can be
 *                right for both vowels. This one splits them.
 */
const PAGE_TRIM = {
  /* stk_guitar WAS 2.55, CUT ×0.70 (-3.1 dB) 2026-08-30. Paul, listening:
     "In general the riff and solo guitars are about 30 percent too loud
     everywhere." The row's own provenance above already confessed the risk —
     the 2.55 was "measured on the waveguide this module replaced, and
     inherited", i.e. fitted against a chain this page no longer runs (the
     lane table has since been cut ×0.375 and the master rebuilt) — the same
     ancestry the stk_piano row admits outright. MEASURED before cutting
     (test/_chairtap.cjs, mute-complement at the ring output, upstream of the
     make-up rider that hands cuts back; 48 bars, seed 1): the guitar chairs'
     active RMS sat -0.0..-4.0 dB against the whole rest of their own band
     (garagerock -0.86, jazzrock -0.01, rock -3.02, rocknroll -4.00) while
     every equivalent non-guitar melodic chair sat far under it (jazz
     sax+trumpet -11.8, funk brass -21.5, and — the discriminator that
     acquits the LANE — detroitsoul's modelled mallet -12.4). Instrument-shaped,
     not lane-shaped or role-shaped, so the cut lands on this one row and
     LEVEL_LANES / SITS / DEPTH stay untouched. The lever was proven live
     first: this row ×0.5 in flight moved exactly the guitar chairs -5.9 dB
     and the rest of the band 0.00. All six guitar ids (clean/jazz/palm/
     crunch/overdrive/distortion) route through this module, which is what
     "everywhere" is.
     RE-MEASURED AFTER THE CUT, same probe: guitar chairs now sit -1.8..-6.6
     vs band (delivered -1.9..-2.6 dB of the asked 3.1 — the channel strip's
     compressor hands ~1 dB back on the dense riffs; if the ear still says
     hot, this row is still the owner). Controls held: jazz 0.00 dB
     (byte-identical — no guitar), ambient and hymn byte-identical under an
     in-flight restore of 2.55, funk -0.16 dB (its own booked rhythm-guitar
     layer taking the cut). */
  /* supersaw ADDED 2026-08-31, and it is the reason Paul said "You never added
     arpeggios to young galaxy" about a record whose staff was full of them.
     MEASURED with test/_chairtap.cjs, the mute-complement — the only harness
     here that answers "is this chair audible": the arp chair's contribution to
     the record was 0.02 dB. Two hundredths. Muting it changed nothing, it sat
     18.69 dB under the band, and I had spent three rounds reading ABC strings
     that said sixteen notes a bar.

     THE CAUSE IS THIS TABLE'S OWN SUBJECT: every voice module carries a page
     deficit and the SYNTH ONES HAD NO ROW. Voices run 4.11-7.52 here and
     guitars 1.78, while `supersaw` ran at 1.0 — so a synth line sat 12 to 17 dB
     under a sung one before any desk word was spoken. That is not Young
     Galaxy's bug; it is every arpeggio, pad_saw lead and machine line in the
     catalogue.

     2.8 IS MEASURED, NOT PICKED: +8.9 dB, which takes the chair from 18.7 dB
     under the band to about 10 under it — a bed that swirls beneath the song,
     which is what Paul asked for ("fade down a little"), rather than a part
     nobody can hear. Re-measured after: see the commit. */
  supersaw:    4.2,
  /* juno60 ADDED THE SAME DAY AND FOR THE SAME REASON as supersaw above: the
     synth models had no rows in this table at all. Measured with the
     mute-complement once the Young Galaxy arpeggio moved onto the Juno, it
     contributed 0.10 dB at -13.06 vs band — quieter even than the stack it
     replaced, because a Juno's filter takes energy off the top where a
     detuned stack has none taken off. 2.0 is +6.0 dB, which puts it just
     above where the two guitars sit and lets it read as the bed that runs
     under the whole record rather than a part that comes and goes. */
  juno60:      2.0,
  /* tb303 — THE THIRD SYNTH ROW IN TWO DAYS, and by now the pattern is the
     finding: this table had NO synth models in it at all, so every machine
     voice in the catalogue has been playing 12-18 dB under a sung one since it
     was written. Moving Young Galaxy's arpeggio onto the 303 dropped it
     straight back to 0.06 dB contribution at -18.16 vs band — inaudible again,
     for the third instrument in a row, for the same reason. 3.5 is +10.9 dB,
     measured to land it beside the guitars where the Juno sat. */
  tb303:       3.5,
  /* THE REST OF THE SYNTH WING, measured 2026-09-01 with the mute-complement,
     one representative record each. This table had NO synth rows at all until
     this week; these are the four remaining models that are actually seated
     and could be measured on a LINE seat.
         solina   newwave           0.10 dB   -11.95 vs band  -> 1.6  (+4.1 dB)
         synclead techno            0.17 dB   -13.65          -> 1.9  (+5.6)
         modeld   dusseldorfschool         0.06 dB   ~-17.3          -> 2.8  (+8.9)
         casiocz  industrialmetal   0.02 dB   ~-18.2          -> 3.2  (+10.1)
     Each lands near -8 vs band, where the guitars sit and where the three
     synths trimmed earlier this week were put.
     `ppg` AND `vp330` ARE NOT HERE, and that is deliberate: both are seated on
     PAD chairs, which test/_chairtap.cjs only targets as line seats, so it
     answered "no target chairs" for them. I am not writing a number I could
     not measure — that is the whole discipline this week was about. */
  solina:      1.6,
  synclead:    1.9,
  modeld:      2.8,
  casiocz:     3.2,
  stk_guitar:  1.78,
  /* stk_piano WAS 2.35, CUT ×0.766 (-2.32 dB) 2026-08-30. Paul: fix the
     +2.3 dB the ear round measured against its whole band. The row's own
     provenance above always confessed it ("NOT MEASURED ON THE PAGE, and the
     only row here that is not… the one line in this file waiting on ears") —
     the ears arrived. MEASURED before cutting (test/_deskreach.cjs,
     mute-complement at the ring, upstream of the make-up rider; 8 bars,
     seed 1, targets = every unit whose module is stk_piano, any chair):
     the piano chairs' active RMS against the whole rest of their own band —
     jazz +0.92, tradjazz +2.39 (Paul's number), parlor -0.81,
     songwriterpiano -1.52 — where the guitar round's balanced melodic
     chairs sit -11..-21 on the same metric. Instrument-shaped: the lever
     was proven in flight first (this row ×0.766 moved exactly the piano
     chairs and the rest of each band 0.00 to a hundredth).
     RE-MEASURED AFTER THE CUT, same probe: jazz -1.05, tradjazz +0.26,
     parlor -2.93, songwriterpiano -3.74 vs band; delivered -1.97..-2.22 dB
     of the asked 2.32 — the channel strip's compressor hands back
     0.1..0.35 dB on the dense stab bars, the same hand-back the guitar
     round documented at ~1 dB. If the ear still says hot, this row is
     still the owner. Controls held to a tenth: every record's
     rest-of-band RMS byte-stable under the in-flight A/B, and records
     with no stk_piano chair press byte-identical (deck.test D3). */
  stk_piano:   1.80,
  mallet:      2.16,
  /* erhu — DERIVED, not measured on the page, and it says so for stk_piano's
     and tract_voice's reason. The module was LEVEL-FITTED against stk_guitar
     at extraction (erhu.dsp's own trim note): with both at their own defaults
     at A4 through the same offline renderer, erhu comes back at 0.0039 RMS /
     0.0111 peak against stk_guitar's 0.0039 / 0.0231, so the page's deficit
     for one is the page's deficit for the other. It takes stk_guitar's row
     unchanged and will need re-measuring the first time a record casts it —
     which nothing does yet.

     A RECORD CASTS IT NOW, AND THE PREDICTION WAS RIGHT (2026-08-30, hours
     later): `sizhu` seats the erhu on voice 1, and measured through the
     renderer's own gain chain at A4/vel 7 against the sampled `fiddle` it
     replaced, the module delivered 0.00317 RMS where the fiddle delivered
     0.01713 — 14.7 dB down on a row whose whole identity is four AUDIBLE
     voices. The level-fit against stk_guitar was honest about RMS and blind
     about PEAK: 0.0111 against 0.0231 is 6.4 dB of crest the derived row
     never accounted for, and a bowed sustain spends its energy where a
     plucked string does not.
     1.78 -> 9.63 closes it from that one row's measurement, which lands the
     erhu among the other two DERIVED-then-corrected rows (voice_lead 8.2,
     tract_voice 9.7) rather than out at the plucked end. STILL DERIVED FROM
     ONE RECORD: the day a second row casts an erhu, this wants re-measuring
     across both, and Paul's ears are the only gate that can call it done. */
  erhu:        9.63,
  /* THE THREE SINGERS WERE CUT x0.5012 (-6.00 dB) 2026-08-30, all three by the
     same number, and it is Paul's own. Having fixed one record by hand: *"Air
     (as a band) is good but the main vocals are 2x too loud and the other vocal
     line should be about 20% quieter"* — then, generalising it himself: *"Same
     all over. Voices just too loud everywhere. Portishead good example."* He
     had said it once before, of iranpop: *"Everything is hot."* 2x is -6.02 dB;
     these rows are that number, flat, on every voice the box can sing with.

     THE ROWS' OWN PROVENANCE ALREADY CONFESSED THE RISK, exactly as
     stk_guitar's did the same morning: the numbers above were fitted as a
     DEFICIT against the recordings the modules stand in for (voice_lead "Vocal
     (solo_vox), -18.3 dB", voice_choir "Backing vocals -27.2 dB, Rome 600
     -19.5 dB"), measured one chair at a time with no drums — i.e. against a
     SOLO, which is the one context in which a singer cannot be too loud. Put
     the same chair in a band and the make-up that made it level with a record
     makes it the whole record.

     MEASURED BEFORE THE CUT, two ways, and they agree:
     · STRUCTURE, over all 379 records at seed 1 (test/_voxtap.cjs --census: the
       compiled unit table, `units[k].lvl * units[k].dry`, which is what the
       renderer multiplies into every sample). 490 vocal units, median +7.64 dB,
       p10 +3.11, p90 +12.57; 4905 band units, median -3.10, p10 -14.87, p90
       0.00. EVERY vocal unit in the catalogue sits above the loudest decile of
       the band it plays in, and the median singer is 10.7 dB over the median
       chair beside it.
     · RENDERED, mute-complement at the ring, 8 bars, seed 1 (test/_voxtap.cjs)
       — each record's vocal chairs against its own band with every voice muted:
           noirhop +15.76   hymn +18.74   air +13.88   doowop +11.30
           iranpop +8.71
       and the 300 Hz-3 kHz share of the whole mix with the voices in and out:
       noirhop 97.2% / 20.0%, air 83.4% / 20.8%, doowop 69.2% / 5.7%,
       iranpop 78.7% / 16.4%. On noirhop one chair is 96.6% of the record's
       energy. The guitar round's own yardstick, on the same metric and the same
       probe family: the guitars Paul called "30 percent too loud" sat -0.9 to
       -4.0 against their band, and a balanced melodic chair sits -12.

     WHY -6 AND NOT THE -10 THE SPREAD ARGUES FOR, said out loud because the
     alternative was measured: a flat -10 would land the five at -1.3 to +8.7,
     which is where a mix engineer would put them, and it is 4 dB past what
     Paul asked for. His two hand-calibrations both say +9: the air fix he
     describes (its vocoder -6, its sung line -1.9, its choir untouched) leaves
     air's vocals ~+9.4 over its band and he called that record good, and
     iranpop — the complaint he made and the one round already fixed — sits at
     +8.7 today. So -6 is not a rounding of his sentence, it is the number two
     of his own judgements land on, and going deeper would be arguing past his
     ear on a metric this file invented. RE-MEASURED AFTER (the round's report
     has the table): noirhop +15.76 -> +7.5, air +13.88 -> +7.2, doowop
     +11.30 -> ~+5, iranpop +8.71 -> +0.7, hymn +18.74 -> ~+12 with the voices
     still carrying 10.3 dB of the record — the choir record is still a choir
     record, which is the control that had to hold. If the ear still says hot,
     these three rows are the owner and -10 is the next rung, already measured.

     ALL THREE BY THE SAME AMOUNT, and the ruling that says so: the census has
     voice_choir 3.2 dB HIGHER than voice_lead in composed gain (median +9.47 vs
     +6.30), which looks like a backing sitting on top of its own lead and was
     nearly cut as one. It does not survive to the ear — rendered, the choir is
     the QUIETEST vocal chair on every record that has both (air: choir -3.5,
     singer -0.7, vocoder +3.2 against the rest of the band; doowop: choirs
     +4.7/+6.4, singer +11.0), because a room of /a/ and /u/ through a formant
     bank really is quieter than one throat. The composed inversion is the
     make-up doing its job, so a deeper choir cut would have been taste with a
     measurement standing next to it saying no. */
  voice_lead:  4.11,
  voice_choir: 7.52,
  // DERIVED, not measured on the page — the second row here that is, and it says
  // so for stk_piano's reason. tract_voice.dsp's own header states the fit: with
  // both modules at their defaults voice_lead peaks 0.39 and the tract babbles at
  // 0.33, which is 1.4 dB under, so the page's deficit for one is the page's
  // deficit for the other times that ratio. THE EARS ARRIVED FOR THIS ONE: air's
  // vocoder lead IS this module, it is the chair Paul's "the main vocals are 2x
  // too loud" names, and measured at the ring it was the loudest vocal chair on
  // that record (+13.4 against the instrumental band, 2.8 dB over the sung line
  // beside it). It takes the singers' -6.00 dB, keeping its derived ratio to
  // voice_lead (9.7/8.2 = 1.183, 4.86/4.11 = 1.182).
  tract_voice: 4.86,
};
/** the page's trim for a pooled module, by dsp id — 1 for everything else. */
export const pageTrim = (dsp) => PAGE_TRIM[dsp] || 1;
// ...AND THE TABLE'S CONSUMER, which it had lost. The route these numbers were
// measured for was the old audio tier's own graph, and when that engine came
// out (2026-08-18) the GainNode that read them went with it — pageTrim was
// exported and NOTHING called it, so every modelled voice shipped at the raw
// deficit the table records. Nobody heard it until a record put a MODELLED
// voice at the FRONT: the Yesterday session's singer (voice_lead) carried the
// tune at -18.3 dB under the sampled band — "the audio has no melody at all" —
// while its events, its unit and its module were all present and correct
// (the engine's own audit read the voice at rms 0.02 against a 0.21 mix).
// The trim lands where the comment above says it must: on the ROUTE — the
// unit's dry tap, which the renderer multiplies into every sample the module
// puts out (stream-renderer/render-core `dg = (u.dry ?? 1) * curOut`) — never
// on `gain` (the shaper's input: dirt) and never on `level` (3 dB of headroom).
// `u.pageTrim` rides along so audio/desk.js can lift the sends it composes per
// bar by the same gain, keeping the voice in the same room as the band.
/* ---- ...AND THE SECOND KEY THE ROUTE NEEDS: THE INSTRUMENT --------------
 * (Paul, 2026-08-30, verbatim — he typed the then-key: "Wherever you use
 * overdrive guitar bring it down 12. Throw it to some mild reverb and delay.
 * I did this for massiveattack and it did wonders." The row is keyed
 * `bristolsound` since 2026-09-01.)
 *
 * WHERE HIS CHANGE LIVED, because the first job was to find it and there is
 * nothing to find: he made it on the BOARD, and the board's offset layer is
 * `ui/state.js MIXER` — held in memory, written to `localStorage`
 * ("nukernel.song.v1"), and adopted only from a document that carries its own
 * `mix`. Nothing in the repository holds it. `bristolsound`'s own row
 * (genres.js) names no send and no level for the chair, and 0 of the
 * precomposed documents carry a `mix`. So the numbers below are derived from
 * the sentence, not read off his desk: -12 dB is his, and "mild" is answered
 * from the catalogue below rather than invented.
 *
 * WHY THIS TABLE IS NOT PAGE_TRIM AND NOT instruments.js STRIPS. Three owners
 * were possible and two of them are wrong for a reason each file states about
 * itself:
 *   · PAGE_TRIM above is keyed by MODULE, and `stk_guitar` is six instruments
 *     — clean, jazz, palm-muted, crunch, overdrive and distortion all route
 *     through it (its own row says so: "All six guitar ids … route through this
 *     module, which is what 'everywhere' is"). Paul named ONE of the six.
 *   · instruments.js STRIPS is keyed by FAMILY, and its own header carries the
 *     measurement that disqualifies it: "every `dirty` id
 *     (crunch/distortion/overdrive_guitar) … is claimed upstream by
 *     PATCH_MODEL/PATCH_VOICE — they resolve to stk_guitar … and a modelled
 *     voice never enters the sampler's strip at all." A level written there
 *     would be a knob that cannot reach the sound, which is the one thing this
 *     page forbids outright. (It is also family-keyed, so it could not tell
 *     the overdrive from the distortion beside it.)
 * What is left is the ROUTE, and the route already has exactly one owner —
 * `trimRoute` below, the single seam where a unit's dry tap and its sends are
 * scaled together. The seat handing it a unit knows the INSTRUMENT ID
 * (`c.instr`, which already rides for the seating plan's familyOf), so the
 * route gains a second key rather than the fact being scattered.
 *
 * THE LEVEL: -12.0 dB = x0.2512, his number, flat, and MEASURED BEFORE IT WAS
 * TAKEN (test/_odpress.cjs, mute-complement at the ring, 8 bars, seed 1). The
 * overdrive chair's own active RMS against the whole rest of its band:
 *     spaghettiwestern +5.30   bristolsound +3.94   sludge +0.69
 *     shoegaze  -0.48   heavymetal       -2.09
 * — where the balanced melodic chairs the guitar round already measured on the
 * same metric sit at -11.8 (jazz sax+trumpet), -12.4 (detroitsoul's mallet) and
 * -21.5 (funk brass). The overdrive guitar was sitting ten to twenty dB above
 * where an equivalent chair sits, on every record that plays one. -12 dB lands
 * the five at -6.7..-14.1, i.e. INSIDE that range and still ordered the same
 * way: the rows where the guitar is the subject were already the loudest
 * against their band and stay the loudest after the cut. That is why the flat
 * number he asked for survived the measurement and no role split was written —
 * see the ROLE RULING note at the end of this block.
 *
 * "MILD" IS 0.12, AND IT IS THE PAGE'S OWN WORD RATHER THAN A NEW NUMBER.
 * fields.js SENDS is the whole send vocabulary — { none: 0, touch: 0.12,
 * some: 0.3, wet: 0.55, drown: 0.9 } — and `touch` is its lowest non-zero
 * step. MEASURED over the catalogue (test/_odguitar.cjs, every anchor at
 * seed 1: 378 records, 2097 seated chairs, the sends the desk actually hands
 * the engine, read as the ratio send/dry so a route trim cannot flatter it):
 *     rev   min 0.06  p10 0.18  p25 0.25  med 0.30  p75 0.44  p90 0.55  max 1.0
 *     del   2063 of 2097 chairs are ZERO; all 34 non-zero are exactly 0.30
 * So 0.12 of reverb is UNDER the tenth percentile of what a chair already
 * gets, and 0.12 of delay is one word below the only delay any record asks
 * for. Mild at the low end of what real rows ask for, in both buses, without
 * inventing a number.
 *
 * BOTH BUSES ARE OPEN, which is the "declared but never arriving" check this
 * table had to pass before it was written. Bus 1 is shut unless a record opens
 * it — audio/plan.js hands toEngine `reverb: 0` on purpose — but precompose.js
 * `busesOf` now writes `buses.rev.ret` on every anchor from its own tone.verb,
 * so the reverb return is open on all 378. Bus 2's return is UNITY when absent
 * (state-engine fxParams emits `dgain: 1` and to-engine falls back to
 * { beats: .75, feedback: .25 }), so a delay send lands on a record that never
 * named an echo. Both are re-measured on the rendered artifact in the round's
 * report; neither is taken on trust.
 *
 * ABSENT IS TODAY, AND EXPLICIT WINS. A row that names its own send for the
 * chair holding this id keeps it: audio/desk.js drops the mild send on any
 * bus the chair's own part already asks for (the four goth rows whose echo
 * lands on their overdrive chair keep their 0.30 and are not given 0.42).
 * Every id this table does not name takes the byte-identical old path.
 *
 * ROLE RULING, MADE AND DECLINED, in writing because the alternative was
 * specified: the honest split would have been "a subject guitar keeps more,
 * a texture guitar takes the full cut", and there is no seat fact to hang it
 * on — every one of the 109 seated overdrive chairs is chair `line`, not one
 * is `lead` or `pad`. The measurement then said it was not needed: a flat cut
 * preserves the 7.4 dB spread between where these chairs sit, and the rows
 * where the guitar IS the record (spaghettiwestern, bristolsound) are the ones
 * sitting highest, so they end up highest. The rows that lose most are the
 * ones with two other guitars still at full level beside them (heavymetal keeps
 * its distortion_guitar and its palm-muted). If the ear disagrees, this row
 * is the owner and a second column is where the split would go. */
const ID_ROUTE = {
  // Paul, 2026-08-30, having done it by hand on `bristolsound`: down 12,
  // into a mild reverb and a mild delay. 109 records seat this id at seed 1
  // (15 declare it; the rest arrive through the pool), which is why it is
  // here and not on any of them.
  overdrive_guitar: { trim: 0.2512, rev: 0.12, del: 0.12 },
  /* Paul, 2026-08-31: "You love that palm chug guitar. You use it everywhere.
     Wherever you use it, bring it down 20% and add some reverb and a little
     delay." The first sentence is measurable and he is right: 97 of the 377
     anchors seat `palm_muted_guitar` at seed 1, and only TWO of them declare
     it (ska and riff) — the other 95 arrive through the pool, which is exactly
     why this belongs here and not on any row. Same shape, and the same reason,
     as the overdrive line above.

     0.8 IS THE TWENTY PER CENT, read as amplitude (-1.94 dB), not as dB.
     The sends sit between the two SENDS words either side of what he asked
     for: fields.js has touch 0.12 and some 0.30, and "some reverb" against
     "a little delay" is the difference between them, so reverb takes 0.18 and
     delay 0.10. I stayed under a literal `some` deliberately — this lands on
     ninety-seven records at once and a wash on all of them is a bigger claim
     than the ask — and these are the two numbers to move if it is still shy. */
  palm_muted_guitar: { trim: 0.8, rev: 0.18, del: 0.10 },
  /* Paul, 2026-09-01: "Whenever you bring in guitar it's like 2x too loud and
     needs more tail, it's a loud plink every time." Six rows follow, and the
     table grows a THIRD kind of number to carry the second half of the ask:
     `rel` is a FLOOR on the recipe's release in seconds, applied in recipeFor
     between recipeBase and worded (so a chair's own VOX `rel` word still lands
     after it and wins — the recipe-seam version of desk law O3). A floor and
     not a set, so postrock's 2.0 and dub's 1.4 pass through untouched; a flat
     floor over the genre's own tone.rel and not an absent-only default,
     because 156/156 guitar-declaring rows write tone.rel — an explicit-wins
     carve-out here would reach zero records, the same shape as the overdrive
     trim being flat over its 109. Arrival is the proven lane both ways:
     model -> m.release -> PATCH_MODEL M.rel (stk_guitar keeps the name,
     clamp 0.05..1.8); sampled -> toneRecipe release -> samplerUnit
     mp("release") -> sampler.js n.rel (clamp 0.02..6, the 2026-08-28 words
     round proved the wire). palm_muted_guitar's row above stays rel-less ON
     PURPOSE: its 0.06 s release IS the mute, and a tail floor there would
     un-chug the chug.

     "2x" is measurable and he is right where the chair is dense. Pressed at
     the ring (test/_odpress.cjs mute-complement, 8 bars, seed 1; vsBand =
     the guitar alone against the rest of the band; the balanced-chair
     yardstick from the header above is -11.8..-21.5 dB):
       clean_guitar      rocknroll -5.69, citypop -7.37, hambone -9.99 —
                         4..6 dB over the top of the range, with the plink
                         signature (solo crest 19.6..26.4 dB where the
                         sustained distortion chairs measure 9.4..10.5);
       distortion_guitar heavymetal +4.37, punk +7.16, doom +3.52, nwobhm +1.93
                         — ABOVE the band, exactly yesterday's overdrive
                         (+5.3..-2.1 before its -12);
       crunch_guitar     garagerock -5.58, glam -10.79, rock -11.10 — over
                         the line, re-pressed 2026-09-01 before landing
                         because the 2026-08-21 re-stage already took -2.7 dB
                         at the insert;
       steel/nylon       -9.6..-16.7 / -12.6..-15.2 — IN RANGE, so the
                         sampled pair takes tail and a touch of reverb only,
                         no trim; jazz_guitar likewise (its drive-.04 neck
                         box was fitted quiet, eff +0.7 dB vs catalog med).
     -6.0 dB (0.5012) IS the "2x", amplitude read as he said it; distortion
     takes the overdrive's own -12 for the overdrive's own measured reason.
     Floors double the tail where it is shortest (distortion tone.rel med
     0.35 -> 0.7, steel 0.5 -> 0.9, clean bottom half 0.5 -> 0.9). */
  clean_guitar:        { trim: 0.5012, rev: 0.12, rel: 0.9 },  // lands -11.7/-13.4/-16.0
  distortion_guitar:   { trim: 0.2512, rev: 0.12, del: 0.12, rel: 0.7 },  // lands -5.8..-10.1; guitar-IS-the-record rows stay loudest, the ROLE RULING's shape
  crunch_guitar:       { trim: 0.5012, rev: 0.12, rel: 0.9 },  // lands -11.6/-16.8/-17.1
  jazz_guitar:         { rel: 0.9 },                           // NO trim, tail only
  nylon_string_guitar: { rel: 1.1, rev: 0.12 },                // NO trim: already in range
  steel_string_guitar: { rel: 0.9, rev: 0.12 },                // NO trim: already in range
};
/** the instrument's own route offset, by instrument id — null for every other. */
export const idRoute = (id) => ID_ROUTE[id] || null;
const trimRoute = (u, instr) => {
  const R = ID_ROUTE[instr] || null;
  // ONE ROUTE GAIN, not two. The module's page deficit and the instrument's
  // own offset are the same kind of number on the same wire, so they multiply
  // into the single field the desk already reads (`u.pageTrim`) rather than
  // opening a second multiply nobody would remember to apply. For
  // overdrive_guitar that is 1.78 x 0.2512 = 0.4471 — the module still gets
  // its measured page make-up, and the instrument still sits 12.0 dB under
  // where it sat this morning.
  /* A FOUND SAMPLE HAS NO MODULE, SO IT HAD NO TRIM (2026-08-31). PAGE_TRIM is
     keyed by DSP module and a one-zone found sampler has none — `u.module` is
     empty — so pageTrim("") returns 1 and the whole crate plays at whatever
     level the file happens to sit at. Measured the moment two rows finally
     named a sample: industrialbreaks' Apollo stab contributed 0.01 dB at
     -23.67 vs band. Inaudible, exactly like the three SYNTH models this week
     and for the same structural reason: a lane with no row in the trim table.
     6.0 is +15.6 dB. It applies ONLY to `found:` ids — the GM sampler library
     is a different lane with its own levels and is untouched. */
  const foundTrim = /^found:/.test(String(instr || "")) ? 6.0 : 1;
  // `R.trim != null`, not `R`: since 2026-09-01 a row may carry only a tail
  // floor and a send (jazz/nylon/steel), and `undefined` in this product
  // would be NaN on the whole route — a silent chair wearing a mild reverb.
  const T = pageTrim(u.module || "") * (R && R.trim != null ? R.trim : 1) * foundTrim;
  if (T !== 1) {
    u.dry = (u.dry != null ? u.dry : 1) * T;
    u.rev = (u.rev || 0) * T;
    u.del = (u.del || 0) * T;
    u.pageTrim = T;
  }
  // ...and the sends ride as their own two fields, because they are ADDED and
  // not multiplied: a send is a proportion of the unit's output, so the desk
  // adds these into the base it composes and then scales the whole route by
  // the trim above — which leaves the wet/dry RATIO at exactly (composed +
  // 0.12), independent of how far down the instrument sits.
  if (R) { if (R.rev) u.idRev = R.rev; if (R.del) u.idDel = R.del; }
  return u;
};
// the five voice types as the formant tables index them, and their compass. The
// index is which singer; the compass is the register law — a bass's formants
// over a soprano's line is a chipmunk, so a part that runs off the top of a
// voice is folded into it rather than sung where nobody has that throat.
// The parent's own table, read for LIVE_DYN's reason.
const VOICE_TYPE = SE.VOICE_TYPE;
// the vowel alphabet — the parent's own, spelled exactly once in the whole
// tree now (state-engine.js VOWELS). A mouth is easier to read as a word than
// as [0,3], and this binding is the only thing in nukernel that knows which
// letter is which row of the formant table.
const VOWELS = SE.VOWELS;
// ...and the SAME FIVE LETTERS IN THE TUBE'S ORDER, because the tract does not
// read the formant tables. tract.lib's fitted table is indexed i-e-a-o-u — the
// vowel triangle, so that a continuous glide between two of them is a walk a
// real mouth could make — where the CSOUND tables the singers read are a-e-i-o-u.
// Two rows swapped, and nothing would ever fail: a genre asking for "a" would
// simply say "i" for the whole record. The parent keeps the same array under the
// same name (state-engine.js TRACT_ROW) and the gate holds the two together.
const TRACT_ROW = [2, 1, 0, 3, 4];
// WHAT THE LIVE PLAYER NEEDS AND THE RECIPE DOES NOT. The old live player
// driveSynth writes a spec's `set` straight onto the worklet's AudioParams;
// the parent's recipe reads the same `set` as WORDS and resolves them in its
// own unit table (a voice type is a name there, an index here). So a spec that
// is an instrument carries a second, numeric half — `live` — and the two
// readers never have to agree about anything except the module's name.
//
// HOW LOUD, ON AN INSTRUMENT. `gain` on these four modules is not a fader — it
// is the input of the guitar amp's shaper and the strike/breath term of the bar
// and the throat — so the note's own amp rides it, over exactly the range this
// bridge already maps a velocity onto for the tape (see AMP at the top). The
// module's `level` stays where its author fitted it and velocity does not touch
// it. What the page needs ON TOP of that is a level trim, and it is not here:
// it is PAGE_TRIM above, on the route, because a trim written into `gain` would
// buy volume by driving the guitar amp's shaper harder — which is dirt, not
// level.
const LIVE_AMP = [PITCH_AMP_FLOOR, PITCH_AMP_FLOOR + PITCH_AMP_SPAN];
// A SLIDE ON A WAVEGUIDE IS A REAL PORTAMENTO: the string's delay length IS its
// pitch, so `glide` bends a sounding note rather than crossfading two. The two
// modules that can do it are listed with the SAME numbers the parent's own unit
// factory writes (state-engine `case "eguitar"` / `case "erhu"`), because two
// spellings of one fact is a fact waiting to disagree — the erhu's 0.09 s is
// longer than the guitar's 0.06 because hua yin is a gesture and a guitar's
// slide is a repair.
const LIVE_SLIDE = { stk_guitar: 0.06, erhu: 0.09 };
const liveModel = (dsp) => LIVE_SLIDE[dsp] != null
  ? { dyn: LIVE_DYN[dsp], slideParam: "glide", slideSec: LIVE_SLIDE[dsp], amp: LIVE_AMP }
  : { dyn: LIVE_DYN[dsp], amp: LIVE_AMP };

/**
 * The SINGER a vocal GM id names — voice type, vowels and all — or null for
 * every id that is not a person.
 *
 * Same `{dsp, root, level, set}` shape and the same contract as synthForInstr
 * and modelForInstr beside it, so one translation serves the page and the tape.
 *
 * THE MOUTH IS THE GENRE'S, and it arrives in the genre's own `tone` block
 * (genres.js MOUTHS) because that block is the one thing this bridge is already
 * handed for every chair, on both paths — press-window's `seat.tone` and
 * transport.js's `bar.g.tone` — and because `tone` is already a NOUN in that
 * file's own doctrine: it snaps, it does not blend. A mouth is five dials and a
 * word: which of the five voice types, which vowels, how much they wobble, how
 * much air is in it, and (for a section) how ragged they are. That is what
 * makes a crooner, a boy band, a plainchant and a Bulgarian choir four
 * different singers rather than four volumes of the same one.
 *
 * ONE THING TO KNOW BEFORE CASTING ANOTHER GENRE ONTO THIS, written here
 * because this is where the next person will look: A VOICE HAS A COMPASS AND
 * THE LINE IS MOVED TO IT, but only by whole octaves. audio/plan.js windowOf
 * reads the `freqMin`/`freqMax` a voice unit declares — the same two numbers
 * the parent's PER-NOTE fold reads (state-engine mapEvents) — and homeFor moves
 * the WHOLE part into that window before the fold ever runs. What the fold then
 * rewrites is whatever a single octave cannot fix: a part WIDER than the throat
 * still wraps at one end or the other, and the widest of the five throats is 25
 * semitones. So the question to ask of a candidate is still "how wide is the
 * part", it is just no longer "and where does it sit": measured over the shipped
 * roster, the home takes the worst part in the table from 75% of its intervals
 * rewritten to 49%, `hymn` — four parts each 31 semitones wide — from 51% to
 * 19%, and a dozen parts to 0%. test/unit/nukernel.test.js §77(f) prints the
 * pair per cast part.
 */
export function voiceForInstr(id, tone) {
  /* THE CHORUS POSITION DECLINES THE TRACT (2026-08-30). Paul: "Add another
     option to the instrumentation switcher... just the classic sampled oohs
     and ahs replacing the tract voices" / "Chorus basically." instruments.js
     voicedAs("chorus") hands the chair its OWN id back with tone.recorded set,
     and this one line is what makes that mean anything: with all four of
     mouth/synth/model/voice answering null, recipeBase falls to the sampler
     library — the classic sound reached through routing the box already has,
     not a second instrument table. Absent = today, byte for byte: a vox press
     on a build with this line is bit-identical to one without. */
  if (tone && tone.recorded) return null;
  const P = PATCH_VOICE[id];
  if (!P) return null;
  const t = tone || {};
  const M = t.mouth || {};
  const choir = P.dsp === "voice_choir";
  // the dials, 0..1 as a genre writes them, against each module's own declared
  // range. Held off the TOP for the reason the bounds paragraph above gives —
  // two readers write these numbers and one of them writes them onto a param —
  // but not off the bottom, because zero vibrato is not a rounding error: it is
  // plainchant, and it is the Bulgarian sound, and both of them are ruined by a
  // wobble nobody asked for.
  const dial = (v, d, hi) => clamp((v != null ? v : d) * hi, 0, hi * 0.98);
  // A VOICE'S `cut` IS THE MIC AND THE ROOM, not a synth filter, and it needs
  // the same lift the guitar cabinet needed: a formant bank's top formants live
  // at 3-5 kHz, so a genre writing cut 1400 read literally would take the
  // consonants and the air off every singer in the catalogue. The floor is
  // where a close ribbon sits and the ceiling where a condenser stops.
  const cut = clamp((t.cut != null ? t.cut : 2600) * 2.2, 2400, 12000);
  const word = String(M.vowels || P.vowels || "a");
  const ph = (P.phase || 0) % word.length;
  const set = {
    // WHO IS SINGING. `voice` is the formant TABLE — five throats, and the
    // parent's VOICE_TYPE carries each one's compass beside it, so the choice
    // moves the register fold too (state-engine's singer case reads it back
    // out as freqMin/freqMax and a line that runs off the top of a bass is
    // folded rather than sung where nobody has that throat). A genre may say it
    // in its mouth block; the CHAIR says it flat, because a panel word writes
    // one key on the tone (chair.js) and a voice type is not a mouth's shape,
    // it is whose mouth it is.
    voice: M.voice || t.voice || P.voice,
    vowels: word.slice(ph) + word.slice(0, ph),
    vowelEvery: M.syll != null ? M.syll : P.syll,
    // AIR IS SEASONING, NOT THE TONE. This dial was 0.14 (a breath of 0.084
    // against the module's 0..0.6) and the voice read airy on nearly every
    // record — measured on the module at the velocity the chair actually
    // sends (push 0.653), the aperiodic energy above 4 kHz was 2.8 dB UNDER
    // the harmonic energy there and ABOVE it at the softer end of the melody
    // layer's own velocities. That is a whisper's balance, not a singer's.
    // Halved to 0.07 (breath 0.042), which lands the same measurement at
    // -9.1 dB above 4 kHz and -21.9 dB above 2 kHz: tone first, air on top.
    // A WHISPER IS STILL REACHABLE — a genre writing air 1 gets 0.588, and
    // the module's own breath-before-the-vowel (voice_tract.lib `fric` rides
    // the gate for ~30 ms) is untouched, which is the h the chair's "a breath
    // first" is actually asking for.
    // ...AND THE SOLO SINGER'S AIR IS CLAMPED AT THE PUBLISHED CEILING, 0.12
    // (2026-08-27, Paul: "very high tones get shrieky"). knobs-extract.js:197
    // publishes `voice_lead/breath` 0.12 as a MEASURED ceiling — "past here it
    // is a whisper rather than a voice — the air stands over the tone above 4
    // kHz" — and twelve MOUTHS rows walked straight past it, because a mouth
    // writes 0..1 and this line multiplied by the module's 0.6 range: falsetto
    // 0.42 -> 0.252, dreamchoir 0.4 -> 0.24, skiffler 0.34 -> 0.204, up to
    // twice the ceiling. That was flagged when the ceiling was derived and left
    // for Paul's ear; his ear has now spoken, and the fricative band is the
    // shriek. The mouths keep their numbers (they still ORDER the singers —
    // plainchant is airier than bulgar at 0.30 against 0.10) and the ceiling
    // decides where the order stops.
    //   THE CHOIR IS DELIBERATELY NOT CLAMPED. Its own rule-derived ceiling is
    // 0.012, BELOW the 0.08 breath its shipped default already holds, and
    // knobs-extract says in as many words that a slider whose top is under the
    // number the record is holding is a different problem and the module is
    // what wants looking at. Clamping it here would be re-mixing every choir
    // record on a number nobody has agreed.
    breath: choir ? dial(M.air, 0.22, 0.6)
                  : Math.min(dial(M.air, 0.07, 0.6), 0.12),
    // THE VOICE MOVES. A formant bank holds one spectrum for the length of a
    // note, which is the one thing this model does worse than a recording.
    // `sway` is a slow LFO on the glottal fold and `vowelSway` the same LFO on
    // the filterbank — the formant centres themselves — and the module's header
    // carries the measurement that chose them over the free alternative (an
    // insert_filtersweep on the unit, which buys a third of the colour for
    // twice the level wobble). Subtle by default rather than off, because what
    // it fixes is what the voice sounds like when nobody has said anything.
    //   ONE WORD, TWO AXES. The chair says how much the tone moves and the
    // ratio is decided here, where a musical judgement belongs: the mouth
    // carries five times the fold, and it is CAPPED at 0.9 of a vowel step so
    // that "let it swell and fade" is still singing the genre's own vowel.
    // Neither can make the voice airier — the drift is one-sided (see the
    // module) — so no answer here can undo the breath number above.
    sway: clamp(t.sway != null ? t.sway : 0.12, 0, 0.5),
    vowelSway: clamp((t.sway != null ? t.sway : 0.12) * 5, 0, 0.9),
    cutoff: cut,
    // a mouth cannot open in three milliseconds and a section cannot open in
    // thirty, so the genre's attack is a floor away from the module's edge
    attack: clamp(t.atk != null ? t.atk : 0.05, choir ? 0.12 : 0.03, choir ? 3 : 2),
    release: clamp(t.rel != null ? t.rel : (choir ? 0.7 : 0.3), 0.05, choir ? 4 : 3),
  };
  if (choir) {
    set.vibrato = dial(M.vib, 0.3, 0.04);
    // ONE DIAL FOR THE SECTION: `blend` is how ragged they are, and it moves
    // the detune and the entry stagger together because those are the same
    // fact about a choir — a tight studio stack is close in tune AND on the
    // beat, and a room full of people is neither.
    const b = M.blend != null ? M.blend : 0.75;
    set.spread = clamp(b * 1.4, 0.05, 2);
    set.drift = clamp(b * 1.3, 0.02, 1.5);
    set.width = clamp(0.45 + b * 0.5, 0.1, 1);
  } else {
    set.vibrato = dial(M.vib, 0.45, 0.05);
    set.vibRate = clamp(M.vibRate != null ? M.vibRate : 5.4, 3.1, 7.9);
    set.vibRise = clamp(M.vibRise != null ? M.vibRise : 0.6, 0.06, 2.9);
  }
  // the numeric half, for the player that writes onto params (see `live`
  // above): who is singing, their compass, and the walk itself as table rows.
  const V = VOICE_TYPE[set.voice] || VOICE_TYPE[P.voice] || VOICE_TYPE.tenor;
  const walk = [...set.vowels].map(ch => VOWELS.indexOf(ch)).filter(i => i >= 0);
  return { dsp: P.dsp, root: P.dsp,
    level: levelOf(t, "model"),
    set,
    live: { dyn: LIVE_DYN[P.dsp], amp: LIVE_AMP, voice: V.n, lo: V.lo, hi: V.hi,
      vowels: walk.length ? walk : [0], vowelEvery: set.vowelEvery,
      // a soloist bends between notes; a section does not slide as one person
      ...(choir ? {} : { slideParam: "glide", slideSec: 0.09 }) } };
}

// ---- AND THE MOUTH THAT TALKS ---------------------------------------------
// GM 54 IS "SYNTH VOICE" AND THE NAME HAS TWO HONEST READINGS. Both are real
// records; the CHAIR is what decides which one a genre meant.
//
//   ON A PAD it is the machine that SINGS — a Roland VP-330, a string choir
//     holding a vowel behind the band, which is what the preset meant on a pad
//     in 1979 and what PATCH_SYNTH above has always played it as. That reading
//     does not move: dusseldorfschool's vocoder chorale and dance post-punk's held
//     sequence are both pads, and both keep their string machine.
//   ON A LINE it is the machine that TALKS — the formant speech synthesiser
//     that put a robot at the FRONT of a record in 1978. That is a tube with a
//     tongue in it, and until engine/faust/dsp/tract_voice.dsp there was nothing
//     in the tree that could play one, so those three lines were being sung by
//     a string ensemble holding one vowel: the same complaint the whole vocal
//     round started from ("the vocals are just squeaky"), one table over.
//
// THE CHAIR IS ALSO THE COST CEILING, and that is why this is a rule rather
// than a habit. Measured at 48 kHz on the machine that wrote this, tract_voice
// renders 0.353x realtime against voice_lead's 0.089x and stk_piano's 0.035x —
// about TWO simultaneous voices, where the formant singer affords eleven. A pad
// is a held chord and wants three or four of whatever it is given, so a pad must
// not be able to ask for a tube, and here it cannot: mouthForInstr refuses
// `padish`, the parent's own switch falls a pad through to the choir even if a
// later reader forgets the flag, and the unit it builds for a line is `mono`
// with `pool: 1`. Three locks, none of them a comment.
//
// (The table half — PATCH_MOUTH's one row and why a tract has no voice types —
// lives with the other patch rows in nukernel/instruments.js; what belongs
// HERE is the chair law above, because the chair is this dispatch's argument.)
/**
 * The TALKING mouth a GM id names — or null for every id that is not one, and
 * for every chair that cannot afford one.
 *
 * Same `{dsp, root, level, set, live}` shape and the same contract as
 * voiceForInstr beside it, so one translation still serves the page and the
 * tape. It is asked FIRST (see patchForInstr), because a machine that talks is
 * a more specific claim than a machine that holds a chord.
 *
 * WHAT A GENRE MAY SAY, in its own `tone.mouth` block, beside the five dials a
 * SINGING mouth already takes. Every one of these is a real param on the module
 * and the parent resolves it in state-engine.js `case "mouth"`:
 *   talk    0..1, the driver's share. Writing 0 is how a genre OPTS OUT and
 *           keeps the string machine — a mouth that says nothing is not a tract.
 *   rate    syllables a second. ABSENT ON PURPOSE by default: the parent then
 *           takes it from the TEMPO (two syllables a beat), so the mouth speaks
 *           in eighths with the record instead of at a number somebody typed.
 *   seed    which sentence. Absent by default too, and then it is derived from
 *           the mouth itself (see below) — the module's own doctrine is that a
 *           seed IS a sentence, so this is the field to write when a record
 *           should say a particular thing forever.
 *   nasal   0..1, the velum
 *   hiss    0..1, the fricative
 *   voiced  0..1 — drop it and the tube whispers, which is a real vocal effect
 *           and one no formant bank in this tree can do
 *   vowels / syll / vib / air  read exactly as they are for a singer
 */
export function mouthForInstr(id, tone, padish) {
  const P = PATCH_MOUTH[id];
  // A PAD NEVER GETS ONE. First lock, and the cheapest: the caller already knows
  // whether the chair holds chords, so the answer is no before anything is built.
  if (!P || padish) return null;
  const t = tone || {};
  const M = t.mouth || {};
  const talk = clamp(M.talk != null ? M.talk : P.talk, 0, 1);
  if (talk <= 0) return null;          // opted out — PATCH_SYNTH's VP-330 stands
  const dial = (v, d, hi) => clamp((v != null ? v : d) * hi, 0, hi * 0.98);
  // A MOUTH'S `cut` IS THE MIC AND THE ROOM, and it needs MORE lift here than it
  // does on a singer: a formant bank's top formant sits around 3-5 kHz, but a
  // fricative is broadband to eight and beyond, and an /s/ rolled off at 2 kHz
  // is not a quieter consonant, it is a vowel with a click in front of it. So the
  // floor is above where the singers' is and the ceiling is a condenser's.
  const cut = clamp((t.cut != null ? t.cut : 2600) * 2.6, 3200, 14000);
  const word = String(M.vowels || P.vowels || "a");
  const set = {
    vowels: word,
    vowelEvery: M.syll != null ? M.syll : P.syll,
    babble: talk,
    nasal: dial(M.nasal, P.nasal, 1),
    fric: dial(M.hiss, P.hiss, 1),
    voiced: clamp(M.voiced != null ? M.voiced : 1, 0, 1),
    // 1, NOT THE SINGERS' 0.6, and that is the tube's own range rather than a
    // slip: tract_voice.dsp declares `breath` 0..1 where voice_lead declares it
    // 0..0.6, because a tract's breath is the glottal leak of a MODEL that also
    // has a fricative of its own and a whole mouth to shape it, while the
    // singer's is raw noise summed into a formant bank and 0.6 of that is
    // already past a whisper. Each dial is held against its OWN module's
    // declared top — checked, both — which is the whole point of the bounds
    // paragraph above.
    breath: dial(M.air, P.air, 1),
    vibrato: dial(M.vib, P.vib, 0.05),
    cutoff: cut,
    // a tube cannot open in two milliseconds — there is a whole glottis to start
    // — and it should not take a second either, because that is a swell and not
    // a syllable
    attack: clamp(t.atk != null ? t.atk : 0.03, 0.012, 0.4),
    release: clamp(t.rel != null ? t.rel : 0.22, 0.05, 1.2),
  };
  // THE RATE IS WRITTEN ONLY IF THE GENRE ASKED. Absent, the parent derives it
  // from the TEMPO — two syllables a beat — which is a better answer than any
  // number typed here, because it is the same answer at 92 and at 174.
  if (M.rate != null) set.rate = clamp(M.rate, 0.5, 12);
  // THE SENTENCE IS A FACT ABOUT THE RECORD, and this bridge is handed exactly
  // one fact about the record: its `tone` block. The parent's default is the
  // SONG's seed, which is the right answer and the one the press gets — but
  // audio/plan.js pins the engine's seed to 1 for every song on this page (the
  // sampled library has to be stable across a compile), so left alone all three
  // talking records would say the identical sentence at different speeds. So the
  // page supplies one from the mouth it was given. It is stable forever for a
  // given voicing, different between two genres that voice differently, and it
  // moves if somebody re-voices a genre — which is the correct behaviour for a
  // mouth rather than a bug: a different mouth is a different take.
  if (M.seed != null) set.seed = Math.round(clamp(M.seed, 0, 4096));
  else {
    let h = 2166136261;
    const txt = JSON.stringify(t) + "|" + id;
    for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
    set.seed = ((h >>> 0) % 4096);
  }
  return { dsp: P.dsp, root: P.dsp,
    level: levelOf(t, "model"),
    set,
    // the numeric half, for the reader that writes onto params. No `voice`: the
    // tube has no voice types, and its compass is the parent's TRACT_COMPASS —
    // one mouth, one register, F2 to roughly G4 — mirrored here for the reason
    // every number in this file is mirrored, and gated the same way.
    live: { dyn: TRACT_DYN, amp: LIVE_AMP, lo: 90, hi: 400,
            vowels: [...word].map(ch => TRACT_ROW[VOWELS.indexOf(ch)])
                             .filter(i => i != null && i >= 0),
            vowelEvery: set.vowelEvery,
            // a talker slurs between notes exactly as a soloist does
            slideParam: "glide", slideSec: 0.09 },
  };
}

/**
 * The instrument a GM id NAMES, played rather than replayed — or null for an id
 * whose sampled recording is the better sound (which is most of them).
 *
 * Same shape and same contract as synthForInstr below: a `{dsp, level, set}`
 * spec in the genre `synth:` shape, so one translation serves the page and the
 * tape and nothing has to learn a second dialect. It rides the same rail, and
 * inherits the same unfinished half — see synthForInstr's note about the pool.
 *
 * AND WHEN THAT LINE IS WRITTEN, the live path needs one more thing these two
 * modules have and no other voice does: the physical control velocity moves.
 * The ranges are FaustStateEngine.MODEL_DYN, keyed by dsp id, and the position
 * is the note's own velocity over nine — which is exactly what the tape
 * computes (amp runs 0.06 at velocity 0 to 0.26 at 9, and mapEvents normalises
 * over the same two numbers), so the two agree by construction rather than by
 * coincidence. Accent is a x1.15 on the way in, on both sides.
 */
export function modelForInstr(id, tone) {
  const P = PATCH_MODEL[id];
  if (!P) return null;
  const t = tone || {};
  // the tone block, read as an ACOUSTIC instruction rather than a filter
  // setting. A synth's cut sits at 1.1-4 kHz; a guitar cabinet's cliff and a
  // mallet's air are an octave or so above that, so the lift is the translation
  // and not a fudge — and both ends are clamped inside the modules' own slider
  // ranges, because a value written ON a declared edge is the failure the
  // bounds paragraph above exists to avoid.
  //   THE FLOOR IS LOAD-BEARING and was measured, not chosen. It sat at
  // 4.2 kHz because blues writes cut 1100, which read literally puts a 4x12
  // cabinet's cliff at 2.9 kHz and took every guitar in the catalogue back to
  // the blanket the brightness round existed to lift — and back then the
  // recipe cutoff was the ONLY brightness stage the family had. It is 3 kHz
  // now (the de-jangle round, 2026-08-21) because it no longer carries that
  // whole burden alone: every electric declares its own inserts — the dirty
  // ones the parent's staged insert_higain, whose own fixed 4x12 sim keeps
  // the cliff near 5 kHz whatever this number says — and the pick writes
  // drive per note (MODEL_DYN), so the attack survives a darker cabinet. The
  // law stays the same law: the genre's number TILTS the cabinet and does not
  // get to close it — 3 kHz still sits above the 2.9 kHz blanket that was
  // measured as the failure, and a guitar chair asking "dark" (cut 900 ->
  // 2340 literal) lands at the floor, audibly darker than the old 4.2 kHz
  // without becoming the blanket.
  const M = {
    cab:  clamp((t.cut != null ? t.cut : 2600) * 2.6, 3000, 9000),
    mcut: clamp((t.cut != null ? t.cut : 3000) * 2.6, 3000, 15000),
    rel:  clamp(t.rel != null ? t.rel : 0.3, 0.05, 1.8),
  };
  // `mul` is the per-instrument level A/B, and it is a RING tax: the modules'
  // own output trims were fitted on one setting each (a marimba, a clean amp),
  // and a bar told to ring four times longer puts four times the energy on the
  // tape for the same strike. Measured against the sampled zone each row stands
  // in for, the long-ringing three came back 5-6 dB hot; this is that, and
  // nothing else, which is why the two short ones do not carry one.
  const set = P.set(M);
  // a chair may say how long the STRING rings, per job (the guitarist's
  // chording jobs shorten it so a chord is a strike, not a five-second bend
  // magnet) — the recipe's own ring stands where nobody said
  if (t.ring != null) set.ring = clamp(t.ring, 0.05, 12);
  return { dsp: P.dsp, root: P.dsp,
    level: levelOf(t, "model", P.mul || 1),
    set, live: liveModel(P.dsp),
    // the recipe's own pedalboard — a non-empty inserts array on the unit
    // overrides the parent's defaultInserts entirely (its own law), which is
    // how a chording electric escapes the pad chain's chorus + leslie
    ...(P.inserts ? { inserts: P.inserts } : {}) };
}

/**
 * The synthesiser a GM synth-patch id is a recording of, driven by the genre's
 * own tone block — or null for an id that names a real recorded instrument.
 *
 * `padish` is whether the chair holds the chord: it only ever picks between two
 * seatings of one instrument (pad_saw / supersaw), never a different sound.
 *
 * Returns a spec in the genre `synth:{dsp, root, level, set}` shape ON PURPOSE:
 * that is the shape the old live player played and the shape
 * recipeFor already translates, so the page and the tape can read one table.
 * Exported for the same reason drumVoice is — the drum lanes learned the hard
 * way what two tables for one sound costs.
 *
 * THE PAGE HEARS THIS TABLE NOW, and it took more than the import. The live
 * scheduler always called synthForInstr and handed the spec to playSynth — but
 * playSynth looks the voice up in the pool (`synthNodes.get(synthKey(spec, v))`)
 * and returns false when it is not there, and the only thing that ever filled
 * that pool was ensureAssets' `wantSynth`, built from the genre's own `synth`
 * block, BASSSYNTH and the synth font — never from a patch. So every patched
 * note fell through to the sampled zone, silently, and the page played the
 * recording while the tape played the instrument. Measured, not read: eight
 * genres swept live built six worklets between them — the four drum machines
 * and acid's 303 — and not one juno60, synclead, guitar amp, marimba or throat.
 *
 * The list is warmed from patchForInstr below (voices.js songPatches feeds
 * ensureAssets and pruneSynths from the one chain), so the pool contains
 * whatever the song's cast resolves to and the recording is what a note falls
 * back to while the wasm is still arriving — which is what it should always
 * have been for.
 */
export function synthForInstr(id, tone, padish) {
  const P = PATCH_SYNTH[id];
  if (!P) return null;
  const dsp = (padish && P.padDsp) || P.dsp;
  const t = tone || {};
  // THE BOUNDS ARE THE NARROWEST OF THE FLEET, not the widest, and that is
  // deliberate: a spec written here is played by TWO readers — the parent's
  // recipe (which clamps) and the parent's own param write (which writes the
  // number straight onto the AudioParam, where a value ON the declared edge is
  // the exact failure the audio gate exists to catch). So resonance is held off
  // zero, the longest release stops short of the 3 s ceiling three of these
  // modules declare, and each row floors its own attack where its module asks.
  const T = {
    cut: clamp(t.cut != null ? t.cut : 1400, 60, 16000),
    res: clamp(((t.q != null ? t.q : 0.7) - 0.7) / 12, 0.02, 0.9),
    atk: clamp(t.atk != null ? t.atk : 0.01, 0.001, 5),
    rel: clamp(t.rel != null ? t.rel : 0.4, 0.05, 2.8),
    wave: Math.max(0, WAVES.indexOf(WAVEOF[t.wave] || P.wave || "saw")),
    // HOW FAR THE ENVELOPE OPENS THE FILTER. Every row that wants it derived
    // it from resonance (0.25 + res), which ties two knobs a 303 has always
    // had separately: you cannot ask for a wide sweep at low resonance, and
    // that is most of what a filter sound IS. Absent = the derived value, so
    // every row that does not say otherwise is byte-identical.
    env: t.env != null ? clamp(t.env, 0, 0.95) : null,
  };
  // the tone block's `gain` is a WebAudio node gain; the declared synths sit at
  // 0.75-0.9 voice level, and this puts a typical 0.28 in the same band rather
  // than at the sampled path's own trim
  return { dsp, root: dsp,
    level: levelOf(t, "synth"),
    set: P.set(T) };
}

/* ---- THE FIVE VOICE WORDS, AS THE PATCH (2026-08-28) --------------------
 * dark / warm / open / bright / screaming · soft / medium / hot / on the edge ·
 * none / low / mid / max · snap / short / long / drone · saw / square.
 *
 * PER LAYER, ONCE, AS A SETTING — and that was the open question, not a detail.
 * fields.js carried these five vocabularies, ui/derive.js compiled them per
 * layer, kernel.js put them on every event as `e.vox`, and toEngine dropped
 * them at the door with `notes.push("vox")` into a field no surface prints,
 * because nobody had said WHAT RATE a word runs at. Paul said it, 2026-08-28:
 * "Yes do that and wire all the other stuff too" — on the shape argued to him,
 * which is this one. The words describe a SETTING, not a gesture. The box
 * already owns the MOVEMENT somewhere else (the section's mot open/close/rise,
 * desk.js compileAuto), so per layer the knobs set the patch and the automation
 * performs it, which is how a 303 record is actually made. Per NOTE would put a
 * param write on every event and fight that automation for the same filter.
 *
 * WHICH FILTER WINS, BECAUSE TWO THINGS SAY "CUTOFF" AND THEY ARE NOT THE SAME
 * FILTER. Nothing is overwritten and nothing has to yield:
 *   · the layer's `cut` sets THIS VOICE'S OWN filter — the recipe key the
 *     module's cutoff slider is resolved from, one number for the song;
 *   · the section's `mot` (and any hand-drawn `cutoff` lane) compiles to a
 *     MASTER sweep — audio/desk.js sweepsFor emits an `ev.sfx` sweep entry and
 *     the parent walks fx_bus `mcut` across the bar, a lowpass on the whole mix
 *     AFTER every voice.
 * They are in series, so a dark 303 under a closing section is darker still,
 * which is what both words mean. The one place they meet on purpose is the
 * `filtersweep` insert chip: desk.js:635 reads the UNIT'S cutoff as the centre
 * its lo/hi octaves swing about, so a layer set `dark` sweeps around a dark
 * voice. That is the chip working, not a collision.
 *
 * A KNOB ABSENT STAYS ABSENT. `voxAll` (ui/derive.js) returns null for a layer
 * that said nothing, an unnamed knob contributes no key, and a `set` key that
 * is never written resolves byte-identically to today — the absent-law, held
 * on ten anchors.
 *
 * A DSP THAT OWNS NONE OF THEM IS NOT FED. The row list comes from
 * nukernel/knobs.js, which is MEASURED (knobs-extract.js probes pitchedUnit at
 * both ends of every candidate key and keeps the ones that moved a param), so:
 *   · tb303 answers all five (cutoff/resonance/envmod/decay/waveform);
 *   · modeld answers all five under its own spellings (res, fenvAmount ->
 *     envAmount, fenvDecay -> envDecay, oscMix), which is exactly why VOXPARAM
 *     is an ORDERED LIST of param names and not one name;
 *   · bass_reese answers three (no resonance, no wave) and bass_wobble four;
 *   · the DX7 answers NONE — its only knob is the cartridge — so it is left
 *     alone rather than handed a param it does not own. So is every sampled
 *     voice, which has no filter to set.
 * A row the extractor flagged `unreachable` is refused here too: a knob that
 * writes a number nothing reads is the same bug in a new coat.
 *
 * THE RANGE IS THE MEASURED ONE, and it is the reason this is not a table of
 * Hz. knobs.js publishes each key's min/max as "the outermost values at which
 * the parameter still moves", dead travel trimmed off both ends — so a word's
 * normalized position lands somewhere the module is still doing something. Only
 * `cut` is geometric (VOX.cut.log), because pitch and brightness are.
 */
export function voxSet(dsp, vox) {
  if (!vox || !NF || !NK) return null;
  const V = NF.VOX, VP = NF.VOXPARAM, KN = NK.voices && NK.voices[dsp];
  if (!V || !VP || !KN || !Array.isArray(KN.rows)) return null;
  const out = {};
  for (const knob of Object.keys(VP)) {
    const word = vox[knob];
    if (word == null) continue;                        // absent stays absent
    const spec = V[knob];
    const t = spec && spec.t ? spec.t[word] : null;
    if (t == null) continue;                           // not one of the words
    let row = null;
    for (const param of VP[knob]) {
      row = KN.rows.find((r) => r.param === param && r.kind === "number" && !r.unreachable);
      if (row) break;                                  // first that EXISTS wins
    }
    if (!row) continue;                                // this DSP owns none of them
    // A SIGNED RANGE IS HALF A KNOB, MEASURED 2026-08-28. Every one of the five
    // vocabularies is a MAGNITUDE — none/low/mid/max, soft/hot/on the edge,
    // snap/drone — and it reads "more" to the right. Three of the params they
    // ride are signed: `fenvAmount` on bass_reese/bass_wobble is filter-env
    // depth in OCTAVES with 0 meaning OFF and negative meaning the filter
    // CLOSES on the attack, and knobs.js honestly publishes the range as
    // [-4, 3]. Mapped across the whole of it, `emod: "none"` came out at
    // -3.86 octaves — not "no envelope" but a full inverted one, the loudest
    // thing on the record where the word said silence. So a range that
    // STRADDLES zero is travelled from zero up: the negative half is a
    // different effect, not less of this one, and no word in these five lists
    // names it. (Unsigned rows — tb303 `envmod` [0,1], modeld `envAmount`
    // [0,3], every cutoff, every decay — are untouched by this line.)
    const lo = (row.min < 0 && row.max > 0) ? 0 : row.min, hi = row.max;
    out[row.key] = (spec.log && lo > 0 && hi > lo)
      ? lo * Math.pow(hi / lo, t)
      : lo + (hi - lo) * t;
  }
  return Object.keys(out).length ? out : null;
}

// a {dsp, level, set} spec — a genre's own `synth` block or a patch row above —
// as the parent's recipe. ONE conversion for both, because a spec is written in
// the DSP's param names either way and SYNTH's rename table is the only
// dictionary between that and the parent's recipe keys.
//
// `vox` is the LAYER'S five words (voxSet above), and it is merged OVER the
// spec's own `set` on purpose: the genre's block is the patch the record ships
// with, and the chip is somebody turning that knob. A layer that says nothing
// merges nothing.
function synthRecipe(sy, tone, role, vox) {
  const S = SYNTH[sy.dsp];
  if (!S) return null;
  const vs = voxSet(sy.dsp, vox);
  const set = vs ? { ...(sy.set || {}), ...vs } : (sy.set || {});
  const m = { ...tone, model: S.model,
    level: clamp(sy.level != null ? sy.level : 0.8, 0.05, 1) };
  for (const [k, v] of Object.entries(set)) {
    const key = (S.rename && S.rename[k]) || k;
    m[key] = (S.waveIndex && key === "wave") ? (WAVES[v | 0] || "saw") : v;
  }
  // a spec that names its own pedalboard carries it onto the unit, where the
  // parent's insertChain law (non-empty array wins over defaultInserts) reads
  // it — absent, byte-identical, and the house default stands as before
  if (Array.isArray(sy.inserts) && sy.inserts.length) m.inserts = sy.inserts;
  return { role: S.role || role, m };
}

/**
 * THE ONE CHAIN, asked in one place. A GM id is a photograph of a synthesiser,
 * or the name of an instrument the parent can genuinely play, or the name of a
 * person — in that order, because a Roland string-choir is a machine before it
 * is a choir and a "synth voice" is not somebody singing.
 *
 * Every reader asks THIS, never the three tables one at a time: the tape
 * (recipeFor below) and the CAST that seats the whole song (audio/plan.js).
 * There used to be a third — a live scheduler with its own pool to warm — and
 * a reader that asked only the first of the three is exactly how the page came
 * to be playing recordings of the instruments the tape was playing. There is
 * one engine now, so there is one reader of each, which is the structural
 * version of the same promise.
 */
/* ---------- THE ONE READER OF WHAT A SEATED VOICE SOUNDS LIKE ------------
 * VOICE.md §2: "the extraction is a MEASUREMENT, not a parse" — so
 * nukernel/knobs-extract.js has to be able to ASK the parent what a `set` key
 * does, and ui/eight.js has to be able to ask the same question at draw time to
 * print the DERIVED value a knob is overriding (VOICE.md §4.3, "the third cell
 * prints the derived value"). Both used to have to reimplement `synthRecipe`'s
 * rename table to do it, and a second copy of the rename table is exactly the
 * drift this file's header spends four paragraphs refusing.
 *
 * So: ONE function, here, where the table is. It takes the document's own
 * spelling — a dsp name and a `set` block, which is what `document.js`
 * `nativeOf` hands out — and returns the parent's unit, params and all.
 * `role` overrides the SYNTH row's own where a caller knows the chair.
 * Returns null for a name the fleet cannot seat, which is what a SAMPLED
 * instrument is (VOICE.md §5, row one).
 */
export const SYNTH_OF = (dsp) => SYNTH[dsp] || null;
export function voiceUnit(dsp, set, state, role) {
  const S = SYNTH[dsp];
  if (!S) return null;
  const r = synthRecipe({ dsp, set: set || {} }, null, role || S.role || "melody");
  return SE.pitchedUnit(r.role, r.m, state || { bpm: 120, seed: 1 });
}

export function patchForInstr(id, tone, padish) {
  // THE MOUTH GOES FIRST, and it is the only entry in this chain that reads the
  // CHAIR as well as the id. "This machine is talking" is a more specific claim
  // than "this preset is a photograph of a VP-330", and the two are the same GM
  // number; asking the specific one first is what lets one id mean both without
  // a second id that means neither. It answers null for a pad, for an id that is
  // not GM 54, and for a genre that wrote `talk: 0` — so every other chair in the
  // catalogue reaches exactly the row it reached before.
  return mouthForInstr(id, tone, padish)
    || synthForInstr(id, tone, padish)
    || modelForInstr(id, tone)
    || voiceForInstr(id, tone);
}

// EXPORTED for the same reason samplerLibFor is: the CAST has to probe a seat
// before there is a bar to translate (audio/plan.js resolves one unit per seat
// to read its register window off), and a probe that resolves a chair by its
// own shorter rule is a probe that measures a different instrument than the one
// that plays. One chain, two readers, no second opinion.
//
// a chair's recipe: the genre's signature synth where it declares one, then the
// synthesiser its GM patch id is a photograph of, then the INSTRUMENT that id
// names where the parent can play one better than a recording of it can
// (PATCH_MODEL — the electrics and the struck bars), then the SINGER for the
// four ids that name a person (PATCH_VOICE), then — for every other id, which
// is most of them — the sampled one, the parent's default sound.
export function recipeFor(chair, seat, lib, unrouted) {
  return pedalled(worded(relFloored(recipeBase(chair, seat, lib, unrouted), seat),
                         seat && seat.vox),
                  seat && seat.tone);
}

/* THE ID_ROUTE TAIL FLOOR (2026-09-01) — the other half of "it's a loud plink
   every time". The table's `rel` is a minimum on `m.release`, seated HERE and
   not in trimRoute because release is a recipe fact, not a desk fact: both
   lanes have already resolved the genre's tone.rel onto `m.release` by the
   time recipeBase returns (model: PATCH_MODEL M.rel; sampled: toneRecipe),
   and this is the one seam where the two lanes are still one object. Before
   `worded`, so a chair's own VOX `rel` word — the user's per-chair edit —
   spreads over it afterwards and wins. Math.max, so a genre that already
   rings longer than the floor is byte-identical. The parent's clamps hold it
   honest downstream (model 0.05..1.8, sampled 0.02..6). */
function relFloored(r, seat) {
  const R = ID_ROUTE[seat && seat.instr];
  if (!R || R.rel == null || !r || !r.m) return r;
  return { ...r, m: { ...r.m, release: Math.max(r.m.release || 0, R.rel) } };
}

/* ---------- THE THREE WORDS A RECORDING CAN HEAR (2026-08-28) -------------
   "I expect SOME control of the native sampled voices, envelopes, perhaps
   voice doubling, normal sampler options. Right now they are monolithic."

   `voxSet` above is the layer's five SYNTH knobs and it says in its own header
   why a sampled voice gets none of them: they ride a cutoff, a resonance, an
   envelope amount, a decay and an oscillator, and a recording has none. This is
   the other half — the words a RECORDING can answer — and the list is short
   because it was READ off the engine rather than invented:

     · `attack`  -> state-engine samplerUnit `atk: mp("attack", …, 0.003, 5)`,
                   which is sampler.js's `n.atk` — the gain envelope's linear
                   declick ramp (sampler.js:687, and the same number on the live
                   path at :1338).
     · `release` -> `rel: mp("release", …, 0.02, 6)` -> `n.rel`, the release
                   ramp (sampler.js:829/854).
     · `swell`   -> `swell: (m.swell || 0) >= 0.5` -> `n.swell`, which replaces
                   the linear attack ramp with the x² crescendo the sampled
                   string pads use. A different SHAPE, not a longer one.
     · an INSERT -> state-engine's INSERTS-ON-SAMPLED-VOICES: an explicit chain
                   on the recipe is normalized by insertChain and run on the
                   native PCM lane, in press and live both. `dbl` spends one
                   slot of it on a slow, shallow chorus, which is a second
                   detuned pass of the same take summed with the first — what
                   double-tracking IS, and the only unison this engine can pay
                   for (a real sampler unison would be a second zone read at a
                   second rate, and sampler.js has no lane for one).

   NOTHING ELSE IS OFFERED. Loop points, zone crossfade, key tracking, a filter
   — a normal sampler's other pages — have no port on this engine, and a word
   that writes a number nothing reads is the bug this file spends its whole
   header refusing.

   THEY REACH A SYNTH TOO, so no layer draws a dead chip: `attack`/`release` are
   recipe keys every pitched unit reads (state-engine:1234/1240) and an insert
   chain runs on every voice in the fleet. Only `swell` is sampler-only, and the
   word that sets it also sets a 1.2 s attack, so it is a slow swell either way.

   THE WORDS ARE fields.js's (VOX.atk / VOX.rel / VOX.dbl, and VOXDOUBLE for the
   chorus's numbers, which are FX.chorus's own scaled). This function is the
   dispatch and owns no vocabulary — the same division as voxSet. */
export function samplerVox(vox) {
  if (!vox || !NF || !NF.VOX) return null;
  const V = NF.VOX, out = {};
  const secs = (k) => { const w = vox[k], t = V[k] && V[k].t;
    return (w != null && t && t[w] != null) ? t[w] : null; };
  const a = secs("atk");
  // the x² crescendo is the WORD's, not a second chip: "swelling" is a shape
  if (a != null) { out.attack = a; if (vox.atk === "swell") out.swell = 1; }
  const r = secs("rel"); if (r != null) out.release = r;
  const d = NF.VOXDOUBLE && NF.VOXDOUBLE[vox.dbl];
  if (d) out.inserts = [{ type: "chorus", ...d }];
  /* THE LOOP WORDS (2026-08-30, the sampling round — the pinned contract).
     "NOTHING ELSE IS OFFERED. Loop points … have no port on this engine" was
     true when the header above was written and is not any more: state-engine
     samplerUnit now reads three per-unit params — `loopa` (loop start, 0..1
     fraction of the zone), `loopb` (loop end, 0..1), `loopon` (0 = the zone's
     own default, 1 = force loop, 2 = force one-shot) — stamps them onto the
     zones, and sampler.js resolveLoop (zero-cross snapped) is what they mean
     on BOTH play paths. This is the dispatch for the page's words — fields.js
     sheets `sound.loopin` / `sound.loopout` / `sound.looping`, and OWNS the
     vocabulary exactly as it owns atk/rel above; a word missing from its
     table (or a table not yet sheeted) writes nothing and is byte-identical.
     A NUMBER passes through directly, because a loop point is the one control
     here that is EDITABLE rather than worded — the page's loop handles hand
     0..1 fractions down the same channel the words ride, one owner, no
     second path. */
  const lv = (k) => { const w = vox[k]; if (w == null) return null;
    if (typeof w === "number" && isFinite(w)) return w;
    const t = V[k] && V[k].t; return (t && t[w] != null) ? t[w] : null; };
  const la = lv("loopin");  if (la != null) out.loopa = Math.min(1, Math.max(0, la));
  const lb = lv("loopout"); if (lb != null) out.loopb = Math.min(1, Math.max(0, lb));
  const lo = lv("looping"); if (lo === 1 || lo === 2) out.loopon = lo;
  return Object.keys(out).length ? out : null;
}

/* the layer's words onto a finished recipe. Applied BEFORE `pedalled` so the
   double sits with the instrument and the player's board runs after it — the
   same ordering argument the board already makes against an amp. A layer that
   named none of the three is byte-identical: an absent key adds nothing.
   (insertChain caps a chain at 2, so a chair carrying a full pedalboard AND a
   double will lose the last chip. That is the parent's cap and it is stated
   there; the alternative — silently dropping the double instead — would be a
   knob that reaches the sound only sometimes and says nothing about it.) */
function worded(r, vox) {
  const w = samplerVox(vox);
  if (!r || !r.m || !w) return r;
  const { inserts, ...rest } = w;
  const own = Array.isArray(r.m.inserts) ? r.m.inserts : [];
  return { ...r, m: { ...r.m, ...rest,
    ...(inserts ? { inserts: [...own, ...inserts] } : {}) } };
}

/* A CHAIR'S PEDALBOARD, AFTER THE INSTRUMENT'S OWN CHAIN (2026-08-23).
   "…and give me all effects chains for each instrument." The eleven inserts
   nukernel has always had (fields.js FX -> instruments.js BOARDS) are a
   PLAYER'S decision now, and this is the one seam where a chair's board meets
   what the instrument already declares:

     · a modelled electric names its own amp (`P.inserts`, the de-jangle
       round), and the DI names the staged high-gain the registry REQUIRES of
       it (SAMPLED_INSERTS). Those are not effects on the instrument, they ARE
       the instrument, so they keep the front of the chain;
     · the board goes after them — an effects loop, which is also the only
       ordering that is unambiguous: a chorus after a crunched guitar is a
       chorused crunch, and there is no reading of "board plus amp" that puts
       a modulation before the gain stage and still means one thing;
     · an instrument with no chain of its own simply gets the board.

   `tone.pedals` is a nukernel-side key that `toneRecipe` deliberately does not
   pass through (that function is the tone BLOCK's translation and knows six
   scalars), so this is the only reader, and a chair that named no pedal is
   byte-identical to before: an absent key adds nothing to a recipe. */
function pedalled(r, tone) {
  const board = tone && Array.isArray(tone.pedals) ? tone.pedals : null;
  if (!r || !r.m || !board || !board.length) return r;
  const own = Array.isArray(r.m.inserts) ? r.m.inserts : [];
  return { ...r, m: { ...r.m, inserts: [...own, ...board.map((c) => flatInsert(c, r.m)) ] } };
}

/* ONE CHIP, TWO SPELLINGS — and this is the one that reaches the parent.
   `insertChain` (state-engine) is the normalizer every unit's chain goes
   through, and it reads a chip's knobs FLAT off the row: `it.rate`,
   `it.depth`, `it.mix`. fields.js `fxChain` emits them NESTED under `params`,
   because its other reader — sampler.js buildInsertNodes, which builds
   WebAudio nodes from insertChain's OUTPUT — wants that shape. Handing the
   nested row to insertChain does not fail; it silently uses the module's
   DEFAULTS, which is worse (measured: nukernel's chorus declares
   rate 0.7 / depth 0.6 / mix 0.45 and arrived as 0.8 / 0.5 / 0.5).
   audio/desk.js already spans the two — `insertsFor` flattens
   `{type, ...it.params}` before it calls insertChain and converts the filter
   sweep's Hz endpoints — and this is the same conversion at the chair's seam.

   THE SWEEP IS THE ONE THAT IS NOT A RENAME. insertChain reads filtersweep's
   `lo`/`hi` as OCTAVES ABOUT THE UNIT'S CUTOFF; fields.js declares them in Hz
   (400 -> 5200). Passed through unconverted, `lo: 400` means 400 octaves up
   and clamps to the ceiling — a chip that sweeps nothing. The recipe's own
   cutoff is the base the parent will use, and it is right here on `m`. */
function flatInsert(c, m) {
  const p = { ...(c.params || {}) };
  if (c.type === "filtersweep" && p.lo > 20 && p.hi > p.lo) {
    const base = clamp(m.cutoff || 2000, 60, 12000);
    p.lo = Math.log2(p.lo / base);
    p.hi = Math.log2(p.hi / base);
  }
  return { type: c.type, ...p };
}

function recipeBase(chair, seat, lib, unrouted) {
  const role = CHAIR_ROLE[chair] || "melody";
  const tone = toneRecipe(seat.tone);
  const sy = seat.synth;
  // lineOnly means only the RIDING lead swaps to the signature synth — the
  // chord underneath stays the sampled patch. It is nukernel's word for the
  // same law as the parent's SIGNATURE_MODELS: the synthesis is the identity of
  // ONE voice, not of the whole band.
  const wantSynth = sy && SYNTH[sy.dsp] && !(sy.lineOnly && role === "pad");
  if (sy && !SYNTH[sy.dsp])
    unrouted.push({ what: "synth:" + sy.dsp, why: "no parent model names this dsp", chair });
  // A SIGNATURE SYNTH DOES NOT DISPLACE A CHAIR THAT WAS CAST AS A VOICE, and
  // this is the same law `lineOnly` already states from the other side: the
  // synthesis is the identity of ONE voice, not of the whole band. Kraftwerk's
  // Model D is the sequence and the tune; it was never the thing at the front
  // saying words, and before this line every genre that declared a signature
  // synth was quietly playing it on the chair it had cast a machine VOICE on —
  // robotic pop's hook and EBM's chant were both a Minimoog doubling the part
  // beside them. Asked before `wantSynth` rather than after, because after is
  // the same as never.
  const mouth = mouthForInstr(seat.instr, seat.tone, role === "pad");
  // THE LAYER'S FIVE WORDS RIDE EVERY ONE OF THESE BRANCHES, because a chip is
  // turned on a CHAIR and not on a genre's signature block: the throat, the
  // declared synth and the synthesiser a GM id photographs all take them
  // (voxSet keeps whichever of the five that dsp actually owns and drops the
  // rest). The sampled branch below takes none, and that is the same law from
  // the other side — a recording has no filter to set.
  const vox = seat.vox || null;
  if (mouth) return { ...synthRecipe(mouth, tone, role, vox), source: "mouth:" + seat.instr };
  if (wantSynth) return { ...synthRecipe(sy, tone, role, vox), source: "synth:" + sy.dsp };
  // the patch table, and NO SILENT FALLBACK out of it: a row naming a dsp the
  // SYNTH dictionary has no entry for is reported, never quietly sampled — that
  // is precisely the failure that put a one-zone whistle where a pad belonged.
  const patch = patchForInstr(seat.instr, seat.tone, role === "pad");
  if (patch) {
    const r = synthRecipe(patch, tone, role, vox);
    if (r) return { ...r, source: "patch:" + seat.instr + ">" + patch.dsp };
    unrouted.push({ what: "patch:" + seat.instr,
      why: "no parent model names dsp " + patch.dsp, chair });
  }
  const spec = lib[seat.instr];
  if (!spec) {
    // ---- THE FOUND CRATE AS UNITS (2026-08-30, the sampling round) --------
    // Texture, vocal stabs and SFX: a chair may be seated on a found-crate id
    // — `found:bbc_arcade_85`, or the bare registry id once the GM library has
    // declined it — and it becomes a ONE-ZONE SAMPLER unit through the exact
    // lane every sampled instrument already rides: state-engine samplerUnit,
    // sampler.js on both play paths, the zone decode via state.foundSources
    // (press bedPath / live kickSamplerBuf — NO second decoder). The registry
    // (__REGISTRY.SOURCES = the beds, .SAMPLES = the one-shots) is the one
    // catalogue, exactly as it is for the bed layer.
    //   root 60: the file plays verbatim at middle C and repitches from there
    //   (rateFor's +16 st cap and the register fold both apply — honest).
    //   A BED loops by default (loopa 0 / loopb 1 — the whole file through
    //   resolveLoop's zero-cross snap, so the wrap doesn't click); a SAMPLE is
    //   a one-shot. Both yield to the unit's own loopa/loopb/loopon since the
    //   samplerUnit stamp spreads OVER the zone's keys — the loop-point
    //   overrides are the editor for found units too, one owner.
    // `foundSrc` rides the recipe so toEngine can put the file on
    // state.foundSources; the parent ignores unknown recipe keys.
    const fid = String(seat.instr || "").replace(/^found:/, "");
    const RGY = G.__REGISTRY || {};

    /* ---- THE COLLAGE CHOIR (2026-09-01) ---------------------------------
       Paul: "build the collage choir." The ask behind it is a `wants` line
       three rows in this catalogue have carried since they were written —
       electroindustrial's *"the sample collage a tape-splice record is made of"* —
       and the measurement that made it a job: **only 4 anchors of 387 seat a
       `found:` chair at all** (bigbeat, industrialbreaks, electroindustrial,
       tapemusic) and every one of them seats exactly ONE recording, on one
       chair, playing the line. One astronaut is not a collage.

       A COLLAGE IS NOT A NEW ENGINE, IT IS THE ZONE ARRAY USED AS INTENDED.
       The branch below already turns a found id into a sampler unit; its
       `zones` is an array and has only ever held one entry. Seat a chair on
       `found:collage:<pool>` and it holds the WHOLE POOL — the keyboard is
       cut into as many bands as the pool has members, each band a different
       recording. So the note the phrase writes chooses WHICH VOICE SPEAKS,
       and a line that moves is a line that splices. That is what a tape
       collage is: the same performance, re-cut, one fragment per edit.

       ROOT = THE BAND'S OWN CENTRE, which is the point of doing it this way
       rather than pitching one clip around. A found recording repitched two
       octaves is a chipmunk; a recording that plays at its own speed in the
       middle of its band is a voice. The register fold and rateFor's +16 st
       cap still apply at the edges, honestly.

       THE POOL IS THE REGISTRY'S OWN (`SOURCE_POOLS`), never a list typed
       here — the same law the kit sources are read under. A pool name that
       does not resolve, or resolves to rows the crate does not have, falls
       through to `unrouted` and says so, rather than seating a silent chair. */
    const oneSrc = (id) => {
      const row = (RGY.SOURCES || {})[id] || (RGY.SAMPLES || {})[id];
      if (!row) return null;
      const bed = !!(RGY.SOURCES || {})[id];
      const localBed = !row.file && /^[^:]*$/.test(row.url || ":");
      return { bed, row, src: { id, label: row.label || id,
        url: localBed ? "" : (row.url || ""),
        ...(row.file ? { samplePath: "found/samples/" + row.file,
                         kind: row.kind, durSec: row.durSec } : {}),
        ...(localBed ? { samplePath: row.url } : {}),
        vol: 0, pitch: 1, stretch: 0.5, cutoff: 18000 } };
    };
    const cm = /^collage(?::(.+))?$/.exec(fid);
    if (cm) {
      const poolName = cm[1] || "vocal_stab";
      /* LOCAL ROWS ONLY, AND THIS RAIL IS NOT OPTIONAL (2026-09-01). Most of
         the crate's SOURCES rows carry an archive.org address, and this page
         is served cross-origin-isolated (COEP require-corp) precisely so the
         ring engine gets SharedArrayBuffer — which means a remote row without
         CORP cannot be fetched at all. The first build of this branch pointed
         at the 24-row `voices` pool and **20 of its 24 rows were remote**: a
         chair seated on twenty recordings that can never decode is a silent
         chair, which is this box's characteristic bug and the exact failure
         `tapemusic` already shipped once (-64.1 dBFS, its three recordings
         contributing nothing). So the pool is filtered to what can sound
         before a zone is built, and if that leaves nothing the chair refuses
         in writing rather than seating silence. `vocal_stab` is 5/5 local. */
      const isLocal = (m) => !!(m.row.file) || /^[^:]*$/.test(m.row.url || ":");
      const all = ((RGY.SOURCE_POOLS || {})[poolName] || [])
        .map((id) => oneSrc(id)).filter(Boolean);
      const members = all.filter(isLocal);
      if (all.length && members.length < all.length)
        unrouted.push({ what: "instrument:" + seat.instr,
          why: "collage pool \"" + poolName + "\" dropped " + (all.length - members.length) +
               " of " + all.length + " rows: remote urls cannot decode under COEP", chair });
      if (members.length) {
        /* THE BANDS SIT WHERE THE LINE ACTUALLY PLAYS, and this is the whole
           difference between a collage and a gimmick. Cutting 0..127 into N
           equal bands puts a 24-row pool at five semitones each — and a
           counter line lives in about two octaves, so it would only ever
           reach four of the twenty-four recordings and the other twenty would
           be dead weight the page had loaded. Measured on the first build of
           this branch: `vx_timelady` rooted at MIDI 2, `vx_wwvh` at 8.
           So the pool is laid over the PLAYING WINDOW (MIDI 42..89, a shade
           under four octaves), which puts a 24-row pool at two semitones a
           band — nearly every step of a phrase is a different voice, which is
           the splice. The outer zones stretch to the keyboard's ends so a
           stray octave still speaks rather than falling into no zone. */
        /* ONE RECORDING PER SEMITONE, ROOTED ON ITS OWN KEY. Two earlier
           layouts were measured on the deployed page and both were wrong, in
           the same direction:
             · 24 bands over the whole keyboard (5 semitones each) — the chair
               plays MIDI 51..58, so it reached FOUR of the twenty-four and
               `vx_timelady` was rooted at MIDI 2.
             · 24 bands over a four-octave window (2 semitones each) — five of
               twenty-four.
           The chair's measured span is EIGHT SEMITONES, so no layout wider
           than one-per-semitone can reach more than eight recordings, and the
           honest grain is therefore the smallest one a zone table can express:
           a semitone. Every distinct pitch the phrase writes is a different
           voice, which is the splice; a repeated pitch is the same voice,
           which is what a tape loop is.
           ROOT = THE ZONE'S OWN KEY, so a found recording inside the window
           plays at EXACTLY natural speed and is never repitched at all. That
           matters more here than anywhere else in the box: these are speaking
           voices and a numbers station transposed a fifth is a cartoon.
           CENTRED ON MIDI 54, which is where the counter chair actually sits
           (measured 51..58 on electroindustrial). It is a constant because the
           recipe cannot see the phrase; the outer two zones stretch to the
           keyboard's ends so nothing falls into silence. */
        /* THE POOL SPREADS OVER THE LINE'S OWN SPAN — measured, not assumed:
           electroindustrial's counter chair plays MIDI 51..58 and writes FIVE
           distinct pitches. Ten semitones is that span with a little room, so
           the band is `10 / n` wide and never narrower than a semitone (which
           is all a zone table can express). A five-row pool gets two semitones
           a band and the phrase reaches all five; a twenty-four-row pool gets
           one and the phrase reaches as many as it has distinct pitches. One
           rule, both ends.
           A FIXED BAND OF ONE SEMITONE WAS THE VERSION BEFORE THIS and it
           measured 3 of 5: the two outer zones stretch to the keyboard's ends
           so nothing falls silent, and with a ten-semitone line against a
           five-semitone window that stretch swallowed both edges of the
           phrase. The window has to be at least as wide as the line.
           ROOT IS THE BAND'S CENTRE, so a speaking voice is never repitched
           by more than half a band — these are numbers stations and Apollo
           transmissions, and a transposed voice is a cartoon. */
        const n = members.length;
        const width = Math.max(1, Math.round(10 / n));
        const LO = 54 - ((n * width) >> 1);
        const zones = members.map((mem, i) => {
          const lo = LO + i * width, hi = lo + width - 1;
          return { srcId: mem.src.id, root: lo + (width >> 1),
                   lo: i === 0 ? 0 : lo, hi: i === n - 1 ? 127 : hi,
                   ...(mem.bed ? { loop: 1, loopa: 0, loopb: 1 } : {}) };
        });
        return { role, m: { ...tone, model: "sampler",
            sampler: { id: "found:collage:" + poolName, sr: 44100, zones },
            // AN ARRAY, and the two push sites below normalise — a collage is
            // the first recipe in this file that owns more than one file.
            foundSrc: members.map((mem) => mem.src) },
          /* "sampler:" BECAUSE IT IS ONE (2026-09-01). A found chair plays
             through samplerUnit + sampler.js on both paths — the recipe's own
             `model` says so two lines up — and the loop words land on found
             units (one owner). instruments.js `sampledId` answers true for
             the five found:* INSTRCHOICES ids by its complement-of-the-patch-
             tables law, which is what avail.js sampledVoice needs to draw the
             loop strip on a found chair; the source string was the one voice
             in the room saying otherwise (loop-words W1). No app code keys on
             the prefix — dispatch is on m.model, trimRoute's foundTrim on
             `instr` — so the string gets truthful and nothing else moves. */
          source: "sampler:found:collage:" + poolName };
      }
      unrouted.push({ what: "instrument:" + seat.instr,
                      why: "collage pool \"" + poolName + "\" is empty or unknown", chair });
      return { role, m: { ...tone }, source: "unrouted" };
    }

    const frow = (RGY.SOURCES || {})[fid] || (RGY.SAMPLES || {})[fid];
    if (frow) {
      const bed = !!(RGY.SOURCES || {})[fid];
      // a SOURCES row whose url has no scheme is a file in this repo (49 of
      // the 192; every BBC row and everything the fetch scripts localised)
      const localBed = !frow.file && /^[^:]*$/.test(frow.url || ":");
      // the src entry mirrors what the kernel itself writes for each family
      // (genre-kernel: a SOURCES bed decodes by url, a SAMPLES one-shot by
      // samplePath under found/samples/) — same fields, same decode doors.
      return { role, m: { ...tone, model: "sampler",
          sampler: { id: "found:" + fid, sr: 44100,
            zones: [{ srcId: fid, root: 60, lo: 0, hi: 127,
                      ...(bed ? { loop: 1, loopa: 0, loopb: 1 } : {}) }] },
          foundSrc: { id: fid, label: frow.label || fid,
                      // A LOCAL BED CARRIES NO `url`, and that is the whole
                      // difference between a chair that sounds and one that
                      // does not. See the note below: the decoders read
                      // `s.url || samplePath`, url FIRST, so leaving a
                      // repo-relative url in place defeats the samplePath
                      // beside it. This is the same shape the kit sources are
                      // written in twenty lines down (`url: ""`, samplePath
                      // set) — one convention for "the file is in the tree".
                      url: localBed ? "" : (frow.url || ""),
                      ...(frow.file ? { samplePath: "found/samples/" + frow.file,
                                        kind: frow.kind, durSec: frow.durSec } : {}),
                      // A LOCAL BED'S URL IS REPO-RELATIVE AND THE PAGE IS NOT
                      // (2026-08-30). Most of the crate's SOURCES rows carry an
                      // archive.org URL, but every BBC row — and every row the
                      // fetch scripts localised — carries a REPO-relative path
                      // instead ("found/bbc_clock_room.64.mp3"). The consumers
                      // do not agree about what that is relative to:
                      // export/_satpress decodeCrate resolves `samplePath`
                      // against the SITE root and uses `url` VERBATIM, so on
                      // nukernel/index.html a bare "found/…" resolves to
                      // /nukernel/found/… and 404s (measured: 404 there, 200 at
                      // the root). The zone then decodes against an empty buffer
                      // and the chair is SILENT — which is exactly what
                      // `tapemusic` pressed at first: -64.1 dBFS against
                      // -32.2 for the same record on GM patches, its three
                      // recordings contributing nothing.
                      //   So a bed with a local path gets `samplePath` too, and
                      // the site-root resolution every sampled zone already
                      // uses carries it. A row whose url has a scheme is
                      // untouched (it is a real remote address and the local
                      // convention resolves it elsewhere), and a SAMPLES row
                      // already set samplePath above, so this adds a key for
                      // exactly one case: the local bed.
                      ...(localBed ? { samplePath: frow.url } : {}),
                      vol: 0, pitch: 1, stretch: 0.5, cutoff: 18000 } },
        // "sampler:" for the collage's reason, one comment up.
        source: "sampler:found:" + fid };
    }
    unrouted.push({ what: "instrument:" + seat.instr, why: "not in the parent sampler library", chair });
    return { role, m: { ...tone }, source: "unrouted" };
  }
  // spec.synth = the parent is running a SYNTH FONT, so the "sampled" library
  // answered with a synth voice. Let the parent's own dispatch have it.
  if (spec.synth) return { role, m: { ...tone, ...spec.params, model: spec.synth, dx7: spec.dx7 || null },
    source: "font:" + spec.synth };
  // ...AND A SAMPLED VOICE MAY DECLARE A PEDALBOARD TOO (2026-08-22). Every
  // modelled electric names its own inserts and every recording arrived dry,
  // because the parent gives a sampler no default chain (absent-law) and this
  // branch never offered it one. It has honoured an EXPLICIT chain on the
  // native PCM lane all along (state-engine INSERTS-ON-SAMPLED-VOICES), which
  // is what makes `di_guitar` — the raw pickup the registry says to claim only
  // behind a staged amp — sayable at all. The table is instruments.js
  // SAMPLED_INSERTS, beside RANGES and STRIPS, where an id's rows live; an id
  // with no row is byte-identical to before, because an absent key adds
  // nothing to the recipe.
  const ped = (NI.SAMPLED_INSERTS || {})[seat.instr];
  // ...AND ITS FAMILY'S CHANNEL STRIP (2026-08-28). instruments.js STRIPS has
  // carried a strip per FAMILY since it was written — the dirty scoop, the vox
  // mud dip, the mallet air — and MEASURED 2026-08-27 not one of them reached a
  // speaker: zeroing the whole table rendered bit-identical, because the only
  // strip a sampled voice ever got was the one the parent's stripFor picks from
  // the ROLE (lead/pad/bass/drum). So a harpsichord, two guitars and a choir all
  // came back on the `lead` strip: high-passed at 200 Hz and lifted 3 dB at
  // 3 kHz, whatever they were. This line is the whole wiring — the courier hands
  // the family's strip over on the recipe, exactly the way SAMPLED_INSERTS above
  // hands over a declared pedalboard, and state-engine `stripFor` decides
  // whether the ROLE overrides it (it does for bass and drums; see there).
  //
  // REPLACES, NEVER COMPOSES, and that is the argument: a family strip and a
  // role profile are two answers to ONE question — what carve does this channel
  // get — not two different facts. Composed, an upright piano would take the
  // lead strip's 200 Hz high-pass AND the keys strip's 40 Hz one (the harder
  // wins, and it is the wrong one), and two presence lifts at 3 kHz and 2.6 kHz
  // an octave apart would read as one loud honk. STRIPS says so itself: these
  // are "the parent's own profiles re-cut per family".
  //
  // `familyOf` is asked ONCE, here, and it answers `pad` for any pad chair and
  // `lead` for an id in no family — both of which ARE the parent's own profiles
  // (STRIPS.pad/lead are copies of STRIP_PROFILES.pad/lead), so writing them
  // would only be a slightly staler copy of what the role already gives. Absent
  // is today there, deliberately: the TEN real families are what change.
  const fam = NI.familyOf(seat.instr, role === "pad");
  // ...and a bass chair declines it at the seam as well as at the owner: the
  // chair's own role is not known here (CHAIR_ROLE has no `bass` row, so a bass
  // recipe is built with role "melody" and re-roled by the caller), and
  // `contrabass` reads as the `bowed` family, which is a section strip, not a
  // bottom-end one.
  const famStrip = (chair === "bass" || fam === "pad" || fam === "lead")
    ? null : (NI.STRIPS || {})[fam];
  return { role, m: { ...tone, model: "sampler", sampler: spec,
                      ...(ped ? { inserts: ped } : {}),
                      ...(famStrip ? { strip: famStrip } : {}) },
           source: "sampler:" + seat.instr };
}

/**
 * Translate a run of nukernel bars into the parent engine's event shape.
 *
 * plan:
 *   bars    the bar list from ui/derive.js songBars() (one bar, one box, or the
 *           whole song — every event's `off` is already warped)
 *   bpm     the song tempo
 *   seat(v) -> { chair, instr, synth, tone, vox } for global voice index v. The
 *           caller owns this because WHO plays WHAT is a song fact (the cast
 *           pool), not a score fact — ui/derive.js chairOf/instrIdOf answers it.
 *           `chair` may be omitted; the event's own `part` is the fallback.
 *   bass    { instr, synth, tone } — the bass chair
 *   kit     the drumkit name (ui/derive.js kitOf)
 *   seed    determinism seed for the parent's hashed house FX
 *   reverb / delay — optional master fx scalars
 *
 * deps: { SE: FaustStateEngine, K: GenreKernel, E: CsdEngine }
 *
 * returns { state, ev, units, unrouted, notes }
 */
// the sampler library for (seed, active font), built once and kept. Cleared by
// nothing: a font switch changes the KEY, so the old entry simply stops being
// asked for and the new one is built on the next bar.
const libCache = new Map();
// EXPORTED, because the caller needs the same answer to probe a seat with
// before it ever builds a bar (audio/plan.js's register home resolves one unit
// per seat). Asking applySampledOnly again per seat is what made a compile take
// 1.7 seconds on a twenty-box song — the whole GM library, rebuilt per chair.
export function samplerLibFor(K, seed) { return libFor(K, seed); }
function libFor(K, seed) {
  const key = seed + "|" + (K.activeFont ? K.activeFont() : "");
  let v = libCache.get(key);
  if (!v) {
    v = { seed, foundSources: [] };
    K.applySampledOnly(v, seed);
    libCache.set(key, v);
  }
  return v;
}

export function toEngine(plan, deps) {
  const { SE, K, E } = deps;
  const bpm = plan.bpm || 120;
  const bars = plan.bars || [];
  const seed = plan.seed != null ? plan.seed : 1;
  // `notes` is the honest-report channel and it is EMPTY on purpose since
  // 2026-08-28: its only writer was the vox drop retired at the bottom of this
  // function. Kept, not deleted — the return shape is a contract, and the next
  // thing this bridge cannot carry should say so here rather than in silence.
  const unrouted = [], notes = [];

  // ---- 1. the sampler library, from the parent, once ------------------------
  // applySampledOnly is the parent's own "sampled by default" pass. Handed a
  // state with NO `instruments` it does exactly the two things wanted here and
  // nothing else: it fills samplerLib with a spec per instrument id, and it
  // rides every zone wav in as a foundSource so both engines decode them
  // through the paths they already have. (With `instruments` present it would
  // also force a kit picked BY SEED, which is the one behaviour a caller that
  // names its own kit must not get.)
  //
  // MEMOIZED, because the LIVE path asks per BAR. applySampledOnly walks the
  // whole GM library and rides every zone of it onto `foundSources` — tens of
  // milliseconds, and the answer depends on exactly two things: the seed and
  // which soundfont is registered active. Neither moves inside a bar, so a
  // one-entry cache keyed on both is a memo of a pure function and nothing
  // more. (Before it, translating a two-second bar cost more than rendering
  // one.)
  const libState = libFor(K, seed);
  const lib = libState.samplerLib || {};

  // ---- 2. the chairs -------------------------------------------------------
  // One parent unit per nukernel voice, keyed "v<index>" — a chair name will
  // not do as a key, because two voices may sit in the same chair on different
  // instruments (a Rhodes and a fuzz guitar are both `line`, and that IS the
  // band). The unit still carries the parent `role`, which is what the strips,
  // the pan pass and the stem classer actually read.
  const seatOf = plan.seat || (() => null);
  const chairs = new Map();          // voice index -> { key, role, recipe, source }
  const seatFor = (v, part) => {
    if (chairs.has(v)) return chairs.get(v);
    const s = seatOf(v) || {};
    const chair = s.chair || part || "line";
    const { role, m, source } = recipeFor(chair, s, lib, unrouted);
    // THE BASS CHAIR IS A BASS ROLE, and until 2026-08-28 it was a LEAD one.
    // `bassSeat` below has always corrected this on the line under it, and the
    // comment at recipeBase's famStrip says why the correction is the caller's
    // job: CHAIR_ROLE has no `bass` row, so recipeFor builds a bass recipe with
    // role "melody" and the caller re-roles. THE OTHER CALLER NEVER DID.
    // audio/plan.js does not use `plan.bass` — it seats the bass through
    // `seatFor("bass", ...)` like any other voice (plan.js:256, `A["v"+seat] =
    // "bass"`), so every record in the catalogue arrived here with chair "bass"
    // and role "melody", and the parent's stripFor picked STRIP_PROFILES.lead
    // off the role: A 200 Hz HIGH-PASS AND A +3 dB LIFT AT 3 kHz ON THE BASS.
    // MEASURED 2026-08-28 on the rendered artifact (units of bar 0, iranpop /
    // jazzrock / rock): `acoustic_bass` came back carrying
    // {hpf:200, eq:{f:3000,gain:+3}, sat:0.30/0.44} — the lead carve — where
    // STRIP_PROFILES.bass is {hpf:30, lpf:5200, eq:{f:110,gain:+2.5}}. A bass
    // line lives at MIDI 28-52 (41-196 Hz): the corner was above the whole
    // fundamental range, so what reached the mix was the bass's SECOND and
    // THIRD harmonics with a presence lift on them and no top-cut, which is
    // both "there is no low end" and "everything sounds like a hot amp" in one
    // stage. Two more consequences fell out of the same wrong role: the
    // parent's AIR_REV gave the bass the melody lane's +10% reverb send, and
    // voiceFxStage gave it the lead's 20%-mix tape delay — the two things its
    // own header says a bass must never get ("bass/drums stay tight, no
    // leslie/delay mud").
    // Paul, 2026-08-28: "Everything is hot and needs more filtering …
    // everything sounds like it was recorded on very hot mic or amp."
    // ONE OWNER: this is the same line `bassSeat` runs, said once for both
    // callers, so a third caller cannot rediscover it.
    const c = { key: "v" + v, chair, role: chair === "bass" ? "bass" : role,
                m, source, instr: s.instr };   // instr rides for the seating plan's familyOf
    chairs.set(v, c);
    return c;
  };
  const bassSeat = plan.bass
    ? recipeFor("bass", plan.bass, lib, unrouted) : null;
  if (bassSeat) bassSeat.role = "bass";

  // ---- 3. the kit ----------------------------------------------------------
  const D = { ...E.defaultInstruments().drums, send: 0.18, dsend: 0.04 };
  let kitSpec = null;
  if (plan.kit) {
    if (MACHINE_KIT[plan.kit]) Object.assign(D, MACHINE_KIT[plan.kit]);
    else {
      kitSpec = K.drumKitSpec(plan.kit);
      if (kitSpec) Object.assign(D, kitSpec.overlay);
      else unrouted.push({ what: "kit:" + plan.kit, why: "neither a parent DRUMKITS name nor a machine" });
    }
  }

  // ---- 4. the state --------------------------------------------------------
  // Parent-shaped, and only as much of it as the unit resolution actually
  // reads: bpm (tempo-synced inserts + send times), instruments (the four
  // recipes mergedInstruments merges), perc (whether the parent builds the
  // clap/rim/ride/crash/perc lanes at all), sections (the reverb BUDGET reads
  // beat density off them), and the master fx scalars.
  const lanesUsed = new Set();
  for (const b of bars) for (const e of b.ev) if (e.kind === "hit" && e.d) lanesUsed.add(e.d);
  const wantsPerc = [...lanesUsed].some((d) => LANE[d] && LANE[d].perc);
  const firstOf = (want) => {
    for (const c of chairs.values()) if (c.role === want) return c.m;
    return null;
  };

  /* ---- THE RECORD'S GRAIN (2026-08-30) -----------------------------------
     Paul: "Does anything have found audio, samples, and vinyl crackle?
     Nothing seems to. Portishead sure should."

     MEASURED THE SAME DAY, and he is right in the exact way that matters: the
     surface noise was BUILT, CALIBRATED AND UNREACHABLE. `fx_bus.dsp` has
     carried instr 97 — `no.sparse_noise(30 + crackle*220)*crackle*0.5`
     band-limited 300..6500 Hz over a 4 kHz-capped hiss floor, output-scaled
     0.15 by a human ear on 2026-07-04 ("always make crackle half as loud as
     you are setting it now") — summed into `mixL/mixR` beside the reverb and
     the delay returns. state-engine `fxParams` has read `state.crackle` for
     just as long. AND NOTHING IN NUKERNEL EVER WROTE THE FIELD: grep the box
     for `crackle` before this line and the only hits are prose. So every
     record in the catalogue rendered `crackle: 0`, including the five rooms
     whose whole subject is records made out of other records.

     This is the memory's "declared but never arriving" bug seen from the far
     side — not a knob that reaches no sound, but a SOUND that no knob reaches
     — and the fix is the missing sentence, not a new stage. Nothing was built
     for this: the crate was searched first (the report at genres.js `grain`)
     and it holds no surface noise as a bed, which is why the generated one is
     the honest answer and why it is the one that already existed.

     WHY IT IS AN AMOUNT AND NOT A CHAIR. A chair costs a voice, sits in the
     register map, takes a strip and a pan, and gets an entry in the cast —
     all of which are true of a PLAYER. Crackle is the surface the whole
     record is played off: one bed under everything, mono like a groove is
     mono (fx_bus sums the same `crk` into both sides), and belonging to the
     master rather than to any lane. So a genre declares an AMOUNT, the way it
     declares `swing` or `verb`, and the master stage it lands on is the one
     the parent already owns.

     WHY IT RIDES THE `tone` BLOCK. This bridge is handed a PLAN, not a genre —
     `toEngine(plan, deps)` has no genre name anywhere in it — and the seat's
     `tone` is the one place a genre-level fact already crosses this seam. The
     MOUTH took this exact door for this exact reason (the header at
     `mouthForInstr`: the tone block "is the one thing this bridge is already
     handed for every chair"). It costs nothing downstream because
     `toneRecipe` is a WHITELIST of six keys — cut/q/atk/rel/gain/verb — so a
     seventh word cannot leak into a unit. MEASURED both ways rather than
     asserted: test/grain-reach.test.js G2 builds one recipe from a seat with
     grain and one from the same seat without, and they are byte-identical;
     and test/levelof-frozen.fixture.js, which hashes the tone translation of
     every catalogue row against a spread of GM ids, returns the SAME sha256
     for the tree WITH the ten grain declarations and for the identical tree
     with all ten stripped out (7fef78642d948c87e71d97e5a8d23018370aff502ba
     ad5da84c17f0bb330c378, 374 rows). That is what makes this a state change
     and not a re-voicing.

     MAX, NOT FIRST, over the seats the record actually plays. A nukernel song
     may layer sections from different genres, and the master bus needs ONE
     number; `max` is the only rule that is both order-independent (so it
     cannot change when the seating does) and true to the thing — you cannot
     press half a record onto vinyl, so if any layer says the record has a
     surface, the record has a surface. Absent is today: no row writing
     `grain` leaves the key off the state entirely and `fxParams`'
     `state.crackle || 0` renders exactly what it rendered yesterday. */
  const grain = (() => {
    let g = 0;
    const seen = new Set();
    for (const b of bars) for (const e of b.ev) {
      if (e.v == null || seen.has(e.v)) continue;
      seen.add(e.v);
      const t = (seatOf(e.v) || {}).tone;
      if (t && t.grain != null) g = Math.max(g, +t.grain || 0);
    }
    // the bass chair arrives beside the seats, not among them (plan.bass)
    const bt = plan.bass && plan.bass.tone;
    if (bt && bt.grain != null) g = Math.max(g, +bt.grain || 0);
    return clamp(g, 0, 1);
  })();

  const state = {
    bpm, seed, instrumentSeed: seed,
    sampledOnly: true, samplerLib: lib,
    foundSources: libState.foundSources.concat(kitSpec ? kitSpec.srcs.map((s) => ({
      id: s.id, label: kitSpec.label, url: "",
      samplePath: "found/samples/drums/" + kitSpec.dir + "/" + s.file,
      vol: 0, pitch: 1, stretch: 0.5, cutoff: 18000 })) : []),
    instruments: { pad: {}, bass: {}, melody: {}, drums: D },
    perc: wantsPerc ? { style: "nukernel", lanes: [...lanesUsed] } : null,
    reverb: plan.reverb != null ? plan.reverb : 0.4,
    delay: plan.delay || { beats: 0.75, feedback: 0.25 },
    // the surface the record is played off — absent unless a row asked for it,
    // so a catalogue that says nothing renders byte-for-byte as before
    ...(grain > 0 ? { crackle: grain } : {}),
    sections: bars.map((b) => ({
      drums: b.ev.some((e) => e.kind === "hit") ? "full" : "off",
      bass: b.ev.some((e) => e.kind === "bass") ? "root" : "off" })),
  };

  // ---- 5. the events -------------------------------------------------------
  const pitched = [], drums = [];
  let beat0 = 0, totalBeats = 0;
  for (const bar of bars) {
    const barBeats = bar.barSteps / STEPS_PER_BEAT;
    for (const e of bar.ev) {
      const beat = beat0 + (e.off || 0) / STEPS_PER_BEAT;
      const durB = Math.max(0.02, (e.dur || 0) / STEPS_PER_BEAT);
      if (e.kind === "line") {
        if (e.n == null) continue;
        const c = seatFor(e.v, e.part);
        // `mut` is the palm-mute mark (kernel ORN.mute) riding the note the
        // way acc/sld always have — carried as `mute` for the string model's
        // own hand-on-the-strings param. Absent, nothing is written and the
        // note object is byte-identical.
        // the cents key rides only a fractional note (centsOf comment above)
        const lc = centsOf(e.n);
        pitched.push({ voice: c.key, beat, dur: durB, pch: pchOf(e.n),
          amp: pitchAmp(e.vel, e.acc), accent: e.acc ? 1 : 0, slide: e.sld ? 1 : 0,
          ...(lc ? { cents: lc } : {}),
          ...(e.mut ? { mute: e.mut } : {}) });
      } else if (e.kind === "bass") {
        if (e.n == null || !bassSeat) continue;
        const bc = centsOf(e.n);
        pitched.push({ voice: "bass", beat, dur: durB, pch: pchOf(e.n),
          amp: pitchAmp(e.vel, e.acc), accent: e.acc ? 1 : 0, slide: e.sld ? 1 : 0,
          ...(bc ? { cents: bc } : {}),
          ...(e.mut ? { mute: e.mut } : {}) });
      } else if (e.kind === "hit") {
        // A HIT AT ZERO IS SILENCE, on the record as on the page. The kit
        // velocity vectors and the groove profiles both write velocity 0
        // legitimately, and the page has always played it as nothing;
        // the amp scale above has a FLOOR, so without this line the tape would
        // be the one path that hears them.
        if ((e.vel == null ? 5 : e.vel) <= 0.009) continue;
        const L = LANE[e.d];
        if (!L) { unrouted.push({ what: "lane:" + e.d, why: "no parent drum unit for this lane" }); continue; }
        // THE LANE'S OWN TRIM (2026-08-28, the dead-facts round). instruments.js
        // DRUMMIX/MACHINEMIX carried a hand-tuned level for each of the twelve
        // lanes and reached nothing — the WebAudio drum player it was written
        // for went out with the one-engine round, and the perturbation proof is
        // in that file's own tombstone. THIS is the half of it the parent can
        // receive, and it comes over the way the family strip came over three
        // hundred lines up: the courier puts it on the recipe and the parent
        // decides what to do with it.
        //
        // IT LANDS ON THE HIT'S `amp`, and it has to. A drum LANE is finer than
        // a drum CHANNEL — twelve lanes resolve to nine parent units (h/o/f are
        // all `hat`, t/m/l are all `tom`, LANE above) — so a per-lane fact
        // cannot ride the unit table without three of the twelve losing their
        // own answer. `amp` is per EVENT, which is exactly the granularity the
        // table was written at, and mapEvents multiplies it by the unit's own
        // `lvl` (`sets.level = u.lvl * d.amp`) so the parent's UNIT_LVL and the
        // desk's faders are untouched and unstacked-on.
        //
        // NO OWNER TO FIGHT: the parent's per-voice level is per UNIT (hat 0.7,
        // ride/crash 0.9) and `L.gain` here has never been set by a single row,
        // so a rim came out as loud as a snare, a pedal hat as loud as a closed
        // one, and a CR-78 as loud as a 909. `mixFor` is the one merge (the
        // machine's row over the kit's), so the sampled kits and the four drum
        // machines read the same table by the same rule.
        const lvl = (NI.mixFor(plan.kit, e.d) || {}).lvl;
        const d = { drum: L.unit, beat, dur: L.dur,
          amp: drumAmp(e.vel, e.acc) * (L.gain || 1) * (lvl != null ? lvl : 1) };
        if (L.open != null) d.open = L.open;
        if (L.pedal) d.pedal = 1;
        // THE TOM'S PITCH IS THE KIT'S TOM'S PITCH. Asking for a flat 88 Hz would
        // draw the floor tom on one kit and the middle one on another, and would
        // play whichever it drew at somebody else's pitch — so a recorded kit
        // answers with its own drum, from the same table the page loads.
        if (L.pitch) d.pitch = (kitSpec && L.tom && kitSpec.tomPitch
          && kitSpec.tomPitch[L.tom]) || L.pitch;
        drums.push(d);
      }
      // (a `sing` arm reported the sung line as unrouted here — honestly, since
      // the parent has no voice for espeak slices. The organ came out on
 // 2026-08-17; nothing emits that kind any more.)
    }
    beat0 += barBeats;
  }
  totalBeats = beat0;

  // the three merged recipes the parent's own voiceUnits will resolve. Every
  // chair gets its OWN unit below; these exist so the parent's pad/bass/melody
  // units, its fx sends and its budget accounting are resolved from something
  // real rather than from the empty default.
  state.instruments.pad = firstOf("pad") || {};
  state.instruments.melody = firstOf("melody") || {};
  // A BASS MAY BE A CHAIR. The `plan.bass` argument names one bass for a whole
  // run, which is right for a caller with one; a caller whose CAST is the song's
  // seats the bass like every other voice (audio/plan.js) and there may be two of
  // them. Either way the parent's own bass unit is resolved from something real,
  // because its reverb budget and its stereo pass read it.
  state.instruments.bass = bassSeat ? bassSeat.m : (firstOf("bass") || {});

  // FOUND UNITS RIDE THE CRATE. A chair seated on a found source (recipeBase's
  // found branch puts `foundSrc` on the recipe) needs its file in
  // state.foundSources — that list is the ONE decode registry on both engines
  // (press decodeInputs walks it; live kickSamplerBuf looks a zone's srcId up
  // in it, and an id absent at first ask would be silent for the session).
  // vol 0: the file arrives as a sampler ZONE, never as a bed behind the
  // record. No found chairs => no push => state byte-identical.
  // ...AND A RECIPE MAY OWN MORE THAN ONE FILE (2026-09-01, the collage
  // choir): `foundSrc` is one entry for a single found chair and an ARRAY for
  // a collage, so both push sites read it through the same normaliser. A
  // single entry takes the identical path it always did.
  const srcList = (m) => (m && m.foundSrc ? [].concat(m.foundSrc) : []);
  const pushSrc = (f) => { if (f && f.id && !state.foundSources.some((s) => s.id === f.id))
                             state.foundSources.push(f); };
  for (const c of chairs.values()) srcList(c.m).forEach(pushSrc);
  if (bassSeat) srcList(bassSeat.m).forEach(pushSrc);

  // ---- 6. the unit table ---------------------------------------------------
  // The parent builds the whole table (drums, the perc lane, stab, sfx, the
  // mastering pan/carve/balance passes, the CPU budget trim) — this only adds
  // one pitched unit per nukernel chair on top, through the parent's OWN
  // pitchedUnit, so every strip, every insert chain and every register law is
  // the parent's and not a copy of it.
  const units = SE.voiceUnits(E, state);
  for (const c of chairs.values()) units[c.key] = trimRoute(SE.pitchedUnit(c.role, c.m, state), c.instr);
  if (bassSeat) units.bass = trimRoute(SE.pitchedUnit("bass", bassSeat.m, state),
                                       plan.bass && plan.bass.instr);
  else delete units.bass;
  delete units.pad; delete units.melody;         // the placeholders; the chairs above are the real voices
  // ---- THE SEATING PLAN (2026-08-29) ---------------------------------------
  // REVERSED. This pass used to be one line:
  //     units[c.key].pan = p * (1 + 0.6 * ((c.key.charCodeAt(1) % 3) - 1));
  // — MASTER_PAN.melody/.pad scaled by charCode-of-key mod 3, a HASH, not a
  // plan. Measured at the ear (_livetap stereo tap, 2026-08-29, seed 1, 40 s):
  // every chair landed inside {-0.13..0.16}, rock's three stk_guitar chairs
  // sat at 0.04/0.10/0.10 — one seat, three guitars — and the records that
  // depend on chairs for width read near-mono: rock S/M -17.2 dB corr 0.969,
  // jazzrock -15.2/0.943, house -12.8/0.916, against neoclassical's -5.9 where
  // the sampled pad's panSpread does the work. And the whole image leant
  // right, because melody 0.10 outweighs pad -0.08 on every roster. So the
  // chairs are SEATED instead of hashed:
  //   · bass and drums stay centre (unchanged; the parent's kit pans stand)
  //   · voices sit near-centre — a singer is not an ensemble effect
  //   · instruments sit off-centre by FAMILY width, groups alternating sides
  //     in key order so the image balances instead of leaning
  //   · a REPEATED timbre alternates within its own group — two guitars are a
  //     left one and a right one, never one loud one. No extra widening per
  //     repeat: precompose's CHAIRPAN already deals `hl`/`hr` on a duplicated
  //     role's later chairs, and that word RIDES on this seat at the desk
  //     (audio/desk.js, where the seat also yields its SIDE to the word so
  //     the two separate the pair together instead of cancelling)
  //   · the `lead` chair sits at half its family width: front of the stage,
  //     just off axis
  // Widths stay <= 0.32 (constant-power ~8 dB L/R): the mono sum must survive,
  // and the re-measure holds every record's L/R correlation positive.
  // Deterministic by construction — key order and the cast alone decide.
  const SEAT_WIDTH = { vox: 0.06, bowed: 0.14, strings: 0.14, brass: 0.18, reed: 0.18,
                       keys: 0.24, organ: 0.24, mallet: 0.24, guitar: 0.26, dirty: 0.26,
                       pad: 0.30 };
  const SEAT_DEFAULT = 0.22, SEAT_CAP = 0.32;
  const seatGroups = new Map();   // resolved timbre -> { n, side }
  let seatSide = 1;               // group starting sides alternate, in key order
  for (const c of [...chairs.values()]
         .sort((a, b) => (a.key.length - b.key.length) || (a.key < b.key ? -1 : 1))) {
    // BASS IS CENTRE, as before — off-axis low end is the one placement no
    // mix makes. No pan field = the old byte path, same as the kick's.
    if (c.role === "bass") continue;
    const u = units[c.key]; if (!u) continue;
    const fam = NI.familyOf(c.instr, c.role === "pad");
    let w = SEAT_WIDTH[fam] != null ? SEAT_WIDTH[fam] : SEAT_DEFAULT;
    if (c.chair === "lead") w *= 0.5;
    const id = (u.sampler && u.sampler.id) || u.module || c.chair;
    let g = seatGroups.get(id);
    if (!g) { g = { n: 0, side: seatSide }; seatSide = -seatSide; seatGroups.set(id, g); }
    u.pan = (g.n % 2 ? -g.side : g.side) * Math.min(SEAT_CAP, w);
    g.n++;
  }
  /* ---- A FOUND CHAIR'S FILE, ONTO THE STATE (2026-08-30) ------------------
     THE SAMPLING ROUND WIRED HALF THIS PATH AND THE OTHER HALF WAS NEVER
     WRITTEN. recipeBase's found branch ends with the sentence "`foundSrc`
     rides the recipe so toEngine can put the file on state.foundSources" —
     and toEngine did not. `state.foundSources` was built once, at step 4,
     out of the GM library and the kit, and a chair seated on a crate id
     added nothing to it.

     WHAT THAT COST, measured 2026-08-30 on the pressed artifact: `tapemusic`
     cast on three BBC beds pressed at -64.1 dBFS against -32.2 dBFS for the
     same record on GM patches — a 32 dB drop, and the residue was not the
     recordings at all but this round's own crackle. The chairs were SILENT.
     The chain is short and every link needs the state entry: audio/plan.js
     `warmSources` collects a zone only `if (byId[z.srcId])`, byId being built
     from `STATE.foundSources`, so a missing entry means the PCM is never
     decoded, never handed to the stream worker, and the zone renders against
     an empty buffer table. That is the parent's documented failure mode for
     this exact omission ("like you inverted the mix", plan.js's own note).

     WHY IT IS HERE AND NOT AT STEP 4: `chairs` is filled LAZILY by seatFor
     as the events are walked, so at state-build time it is empty. The state
     object is not read by anything until the return below, so appending to
     its array after the walk is the same state, completed — and it is the
     one place that has seen every chair the record actually plays.

     This is why no genre row could name a `found:` id before today: the
     feature resolved perfectly and rendered nothing, which is the memory's
     "declared but never arriving" exactly. */
  {
    const have = new Set((state.foundSources || []).map((s2) => s2.id));
    // one entry or an array — see the normaliser above; the collage chair is
    // the reason this takes a list.
    const add = (m) => {
      for (const f of (m && m.foundSrc ? [].concat(m.foundSrc) : [])) {
        if (!f || !f.id || have.has(f.id)) continue;
        have.add(f.id);
        state.foundSources.push(f);
      }
    };
    for (const c of chairs.values()) add(c.m);
    if (bassSeat) add(bassSeat.m);
  }

  SE.collisionCarve(units);
  for (const [k, u] of Object.entries(units))
    if (u && !u.__meta && !u.drum && !u.sampler && !u.module)
      unrouted.push({ what: "unit:" + k, why: "resolved to no parent module" });

  /* THE VOICE KNOBS CROSS NOW, AND THE LINE THAT SAID THEY COULD NOT IS GONE.
     Two lines used to stand here and in the `line` arm above:

         if (e.vox) notes.push("vox");
         ... notes: notes.length ? ["per-note vox knobs are nukernel's own and do not cross"] : []

     — an honest report of a knob that could not reach the sound, emitted into a
     field no surface prints. Its complaint was real: compose.js:1304 writes
     `{cut:"bright", res:"hot", emod:"mid", dec:"short"}` onto the acid box's
     solo, so the record this box writes for its most filter-shaped genre was
     asking out loud and being refused in silence.

     REVERSED 2026-08-28. Paul: "Yes do that and wire all the other stuff too."
     The refusal was never about crossing, it was about RATE — a per-NOTE param
     write into a parent that resolves a unit once per song had no meaning, and
     nobody had chosen one. Per LAYER does: the words are a SETTING, the section
     automation is the MOVEMENT, and the two are different filters in series
     (see voxSet). So the words are resolved once, at the seat, where a unit's
     params are already decided — audio/plan.js castOf puts the layer's `vox` on
     the seat and into the seat's identity, recipeBase hands it to synthRecipe,
     and there is nothing left for an event to carry. `e.vox` still rides the
     event because ui/derive.js is the one thing that knows which layer a note
     came from and the cast is built by reading it; the SCHEDULER no longer
     looks at it, which is why no note is dropped any more. */
  return { state, ev: { pitched, drums, found: [], sfx: [], srcById: {}, totalBeats },
    units, unrouted, notes };
}

// The whole point, in one call: translate and hand the result straight to the
// parent's mapper. `opts` is mapEvents' own (lo/hi window, bedAll) — the live
// scheduler windows a bar at a time, the offline press takes the lot.
export function mapWithEngine(plan, deps, opts) {
  const t = toEngine(plan, deps);
  return { ...t, schedule: deps.SE.mapEvents(deps.E, t.state, t.ev, { units: t.units, ...(opts || {}) }) };
}
