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
const SE = G.FaustStateEngine, NI = G.NuInstruments;

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
const SYNTH = {
  modeld:    { model: "modeld", role: "melody" },
  tb303:     { model: "tb303",  role: "melody", rename: { resonance: "res" } },
  supersaw:  { model: "stack",  role: "melody", rename: { detune: "spread" }, waveIndex: true },
  pad_saw:   { model: "saw",    role: "pad" },
  juno60:    { model: "juno60", rename: { spread: "chorusSpread" } },
  lead_fuzz: { model: "fuzz",   role: "melody" },
  dx7_alg5:  { model: "rhodes", role: "melody" },
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
  // the instruments you PLAY rather than recordings you edit. No `role`: a
  // guitar holds chords and plays lines, and so does a marimba (minimalism has
  // two of them doing both), and so does a piano.
  stk_guitar: { model: "eguitar" },
  stk_piano:  { model: "piano" },
  gtr_amp:    { model: "eguitar" },   // the hand-rolled string, kept nameable
  mallet:     { model: "mallet" },
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
function toneRecipe(tone) {
  if (!tone) return {};
  const out = {};
  if (tone.cut != null) out.cutoff = clamp(tone.cut, 60, 16000);
  if (tone.q != null) out.res = clamp((tone.q - 0.7) / 12, 0, 0.9);
  if (tone.atk != null) out.attack = clamp(tone.atk, 0.001, 5);
  if (tone.rel != null) out.release = clamp(tone.rel, 0.01, 3);
  if (tone.gain != null) out.level = clamp(tone.gain * 2.2, 0.15, 1);
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
  stk_guitar:  2.55,
  stk_piano:   2.35,
  mallet:      2.16,
  voice_lead:  8.2,
  voice_choir: 15,
  // DERIVED, not measured on the page — the second row here that is, and it says
  // so for stk_piano's reason. tract_voice.dsp's own header states the fit: with
  // both modules at their defaults voice_lead peaks 0.39 and the tract babbles at
  // 0.33, which is 1.4 dB under, so the page's deficit for one is the page's
  // deficit for the other times that ratio. It is waiting on ears like the piano.
  tract_voice: 9.7,
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
const trimRoute = (u) => {
  const T = pageTrim(u.module || "");
  if (T === 1) return u;
  u.dry = (u.dry != null ? u.dry : 1) * T;
  u.rev = (u.rev || 0) * T;
  u.del = (u.del || 0) * T;
  u.pageTrim = T;
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
const liveModel = (dsp) => dsp === "stk_guitar"
  // a slide on a waveguide is a real portamento: the string's delay length IS
  // its pitch, so `glide` bends it rather than crossfading two notes
  ? { dyn: LIVE_DYN.stk_guitar, slideParam: "glide", slideSec: 0.06, amp: LIVE_AMP }
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
    breath: dial(M.air, choir ? 0.22 : 0.07, 0.6),
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
    level: clamp((t.gain != null ? t.gain : 0.28) * 2.8, 0.35, 0.92),
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
//     does not move: kraftwerk's vocoder chorale and dance post-punk's held
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
    level: clamp((t.gain != null ? t.gain : 0.28) * 2.8, 0.35, 0.92),
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
    level: clamp((t.gain != null ? t.gain : 0.28) * 2.8 * (P.mul || 1), 0.35, 0.92),
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
    level: clamp((t.gain != null ? t.gain : 0.28) * 2.8, 0.5, 0.92),
    set: P.set(T) };
}

// a {dsp, level, set} spec — a genre's own `synth` block or a patch row above —
// as the parent's recipe. ONE conversion for both, because a spec is written in
// the DSP's param names either way and SYNTH's rename table is the only
// dictionary between that and the parent's recipe keys.
function synthRecipe(sy, tone, role) {
  const S = SYNTH[sy.dsp];
  if (!S) return null;
  const m = { ...tone, model: S.model,
    level: clamp(sy.level != null ? sy.level : 0.8, 0.05, 1) };
  for (const [k, v] of Object.entries(sy.set || {})) {
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
  if (mouth) return { ...synthRecipe(mouth, tone, role), source: "mouth:" + seat.instr };
  if (wantSynth) return { ...synthRecipe(sy, tone, role), source: "synth:" + sy.dsp };
  // the patch table, and NO SILENT FALLBACK out of it: a row naming a dsp the
  // SYNTH dictionary has no entry for is reported, never quietly sampled — that
  // is precisely the failure that put a one-zone whistle where a pad belonged.
  const patch = patchForInstr(seat.instr, seat.tone, role === "pad");
  if (patch) {
    const r = synthRecipe(patch, tone, role);
    if (r) return { ...r, source: "patch:" + seat.instr + ">" + patch.dsp };
    unrouted.push({ what: "patch:" + seat.instr,
      why: "no parent model names dsp " + patch.dsp, chair });
  }
  const spec = lib[seat.instr];
  if (!spec) {
    unrouted.push({ what: "instrument:" + seat.instr, why: "not in the parent sampler library", chair });
    return { role, m: { ...tone }, source: "unrouted" };
  }
  // spec.synth = the parent is running a SYNTH FONT, so the "sampled" library
  // answered with a synth voice. Let the parent's own dispatch have it.
  if (spec.synth) return { role, m: { ...tone, ...spec.params, model: spec.synth, dx7: spec.dx7 || null },
    source: "font:" + spec.synth };
  return { role, m: { ...tone, model: "sampler", sampler: spec }, source: "sampler:" + seat.instr };
}

/**
 * Translate a run of nukernel bars into the parent engine's event shape.
 *
 * plan:
 *   bars    the bar list from ui/derive.js songBars() (one bar, one box, or the
 *           whole song — every event's `off` is already warped)
 *   bpm     the song tempo
 *   seat(v) -> { chair, instr, synth, tone } for global voice index v. The
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
    const c = { key: "v" + v, chair, role, m, source };
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
        pitched.push({ voice: c.key, beat, dur: durB, pch: pchOf(e.n),
          amp: pitchAmp(e.vel, e.acc), accent: e.acc ? 1 : 0, slide: e.sld ? 1 : 0,
          ...(e.mut ? { mute: e.mut } : {}) });
        if (e.vox) notes.push("vox");
      } else if (e.kind === "bass") {
        if (e.n == null || !bassSeat) continue;
        pitched.push({ voice: "bass", beat, dur: durB, pch: pchOf(e.n),
          amp: pitchAmp(e.vel, e.acc), accent: e.acc ? 1 : 0, slide: e.sld ? 1 : 0,
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
        const d = { drum: L.unit, beat, dur: L.dur,
          amp: drumAmp(e.vel, e.acc) * (L.gain || 1) };
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

  // ---- 6. the unit table ---------------------------------------------------
  // The parent builds the whole table (drums, the perc lane, stab, sfx, the
  // mastering pan/carve/balance passes, the CPU budget trim) — this only adds
  // one pitched unit per nukernel chair on top, through the parent's OWN
  // pitchedUnit, so every strip, every insert chain and every register law is
  // the parent's and not a copy of it.
  const units = SE.voiceUnits(E, state);
  for (const c of chairs.values()) units[c.key] = trimRoute(SE.pitchedUnit(c.role, c.m, state));
  if (bassSeat) units.bass = trimRoute(SE.pitchedUnit("bass", bassSeat.m, state));
  else delete units.bass;
  delete units.pad; delete units.melody;         // the placeholders; the chairs above are the real voices
  // stereo placement + the same-timbre carve, re-run over the FINAL table: two
  // chairs that resolved the same GM instrument read as soup otherwise, and
  // voiceUnits ran its pass before these chairs existed.
  for (const c of chairs.values()) {
    // BASS IS CENTRE and the parent says so by having no MASTER_PAN entry for it
    // — reading the melody seat for a bass chair would put the low end off axis,
    // which is the one placement no mix makes.
    if (c.role === "bass") continue;
    const p = SE.MASTER_PAN[c.role === "pad" ? "pad" : "melody"];
    if (p != null) units[c.key].pan = p * (1 + 0.6 * ((c.key.charCodeAt(1) % 3) - 1));
  }
  SE.collisionCarve(units);
  for (const [k, u] of Object.entries(units))
    if (u && !u.__meta && !u.drum && !u.sampler && !u.module)
      unrouted.push({ what: "unit:" + k, why: "resolved to no parent module" });

  return { state, ev: { pitched, drums, found: [], sfx: [], srcById: {}, totalBeats },
    units, unrouted, notes: notes.length ? ["per-note vox knobs are nukernel's own and do not cross"] : [] };
}

// The whole point, in one call: translate and hand the result straight to the
// parent's mapper. `opts` is mapEvents' own (lo/hi window, bedAll) — the live
// scheduler windows a bar at a time, the offline press takes the lot.
export function mapWithEngine(plan, deps, opts) {
  const t = toEngine(plan, deps);
  return { ...t, schedule: deps.SE.mapEvents(deps.E, t.state, t.ev, { units: t.units, ...(opts || {}) }) };
}
