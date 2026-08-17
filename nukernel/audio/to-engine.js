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
//           step is a sixteenth (audio/transport.js stepDur = 60/bpm/4), so
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

// velocity 0..9 -> the parent's amp range (see AMP above)
const PITCH_AMP_FLOOR = 0.06, PITCH_AMP_SPAN = 0.20;
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
// 606 live and the default kit on the tape. Now audio/voices.js resolves its
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
// audio/voices.js driveSynth writes straight onto the worklet, so it has to be.
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
};
const WAVES = ["sine", "saw", "square", "pulse"];

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

// ---- THE TONE BLOCK IS A SYNTHESISER, and it always was ---------------------
// Every one of the 110 genres carries a `tone` block, and under nukernel's own
// WebAudio voice that block WAS the sound: two oscillators of `wave`, detuned a
// few cents, into a resonant lowpass that opened at cut x 3.4 and shut to `cut`
// across the note, under an atk/rel envelope at `gain`. A subtractive synth,
// one per genre, written out in seven numbers.
//
// Crossing to the parent, the tone block became DECORATION — four recipe keys
// riding on a sampled General MIDI patch — and only the 15 genres that also
// declared a `synth` block reached a synthesiser at all. So a genre whose whole
// identity was a saw through a filter played whatever GM instrument its `instr`
// id happened to name, and the worst of those name synths: measured on the
// shipped registry, `polysynth`, `warm_pad`, `halo_pad` and `metal_pad` are
// ONE ZONE each, rooted at MIDI 84. A pad written at MIDI 45 is that single
// high sample dragged down two and a half octaves, which is not a pad — it is
// a breathy whistle. That is the "flute everywhere" Paul heard, and it is a
// photograph of a synthesiser standing in for the synthesiser.
//
// THE FIX IS A RE-MAP, NOT NEW SYNTHESIS. The parent owns the real instruments
// under their real names (engine/faust/dsp, VOICES.md), so a GM synth PATCH id
// resolves to the analog voice it is a recording of, and the genre's own tone
// block drives it. Everything else — a guitar, a piano, a choir, a horn
// section, a gospel organ — is a RECORDED instrument and stays sampled, which
// is the parent's default sound for good reason. The test is what the id names:
// only the twelve GM synth patches below are in here, and each row is that
// patch's own instrument.
//
// The sweep is the loudest thing the tone block ever said, and both spellings
// of it are the SAME sweep: the parent's saw/fuzz voices take `fenv` as a
// multiplier above cutoff (cut x (1 + fenv)), its analog fleet takes
// `envAmount` in OCTAVES. 2.4 and log2(3.4) are cut x 3.4 said twice.
const SWEEP = 2.4, SWEEP_OCT = 1.77;
// the parent's oscillator alphabet has no triangle. A triangle is a sine with a
// little edge on it, so `sine` is the honest nearest and `saw` would be a lie —
// and measured across the table, no genre that reaches a wave-bearing row here
// asks for one anyway.
const WAVEOF = { sawtooth: "saw", saw: "saw", square: "square",
                 pulse: "pulse", triangle: "sine", sine: "sine" };
const PATCH_SYNTH = {
  // ---- the leads ----
  // GM 82 Lead 2 / GM 81 Lead 1: literally "a sawtooth" and "a square". Two
  // voices, four cents apart, because that is what the old tone block built.
  // `padDsp` is the SAME instrument seated differently: two detuned saws under a
  // chord are pad_saw and under a line are supersaw, which is precisely the pair
  // the old tone block collapsed into one WebAudio voice. Naming the real module
  // rather than the parent's role-resolved "stack" is what keeps this spec
  // loadable by BOTH readers — a recipe key can be abstract, a `dist/` fetch and
  // a `/root/param` address cannot. (One spec, two modules, so the attack floor
  // is pad_saw's 5 ms; four milliseconds is not a sound either way.)
  saw_wave:    { dsp: "supersaw", padDsp: "pad_saw", wave: "saw", set: (T) => ({
    wave: T.wave, voices: 2, detune: 0.004, octave: 0.12,
    cutoff: T.cut, res: T.res, fenv: SWEEP,
    attack: Math.max(0.006, T.atk), release: T.rel, sustain: 0.85 }) },
  square_lead: { dsp: "supersaw", padDsp: "pad_saw", wave: "square", set: (T) => ({
    wave: T.wave, voices: 2, detune: 0.004, octave: 0.12,
    cutoff: T.cut, res: T.res, fenv: SWEEP,
    attack: Math.max(0.006, T.atk), release: T.rel, sustain: 0.85 }) },
  // GM 85 Lead 5 (charang) — the buzzing guitar-synth lead. lead_fuzz is the
  // parent's tanh-driven voice and the buzz IS the drive.
  // (lead_fuzz's own resonance stops at 0.47 — its tanh drive is doing half the
  // work a ladder would, and a tone block screaming q 11 must not be written
  // onto the ceiling)
  charang:     { dsp: "lead_fuzz", wave: "saw", set: (T) => ({
    cutoff: T.cut, res: Math.min(0.45, T.res), drive: 0.5, fenv: SWEEP,
    attack: T.atk, release: T.rel, sustain: 0.7 }) },
  // GM 87 Lead 7 (fifths) — a saw and its fifth. synclead hard-syncs at
  // syncRatio, and 1.5 is that fifth: the interval is in the oscillator rather
  // than in a second sample, which is the whole difference.
  fifth_sawtooth_wave: { dsp: "synclead", wave: "saw", set: (T) => ({
    cutoff: T.cut, res: T.res, syncRatio: 1.5, syncSweep: 1.2, syncDecay: 0.18,
    envAmount: SWEEP_OCT, envDecay: 0.16, detune: 8, drive: 0.3,
    attack: T.atk, release: T.rel, sustain: 0.8 }) },
  // GM 103 (echoes / echo drops) — a struck metallic ping that rings away. The
  // parent's `bell` takes its decay from the note length, which is what a drop
  // does; dub's delay send does the echoing, as it always did.
  echo_drops:  { dsp: "bell", set: (T) => ({ cutoff: T.cut, res: T.res }) },
  // ---- the pads ----
  // GM 91 Pad 3 (polysynth) — a poly analog. The Juno-60 is one, with its BBD
  // chorus, and the chorus is why a Juno pad sounds wide without a reverb.
  polysynth:   { dsp: "juno60", set: (T) => ({
    cutoff: T.cut, res: T.res, envAmount: SWEEP_OCT,
    sawLevel: 0.7, pulseLevel: 0.5, subLevel: 0.2, pwmBase: 0.48, pwmLfo: 0.15,
    chorus: 1.2, spread: 0.8,
    attack: T.atk, decay: 0.6, sustain: 0.6, release: T.rel }) },
  // GM 90 Pad 2 (warm) and GM 93 Pad 5 (bowed glass) are the SAME instrument
  // arriving differently — a Prophet/SEM-class poly — so they share `oberheim`
  // and differ where they actually differ: the bow takes a second and a half to
  // speak and half the sweep, the warm pad speaks at the tone block's own
  // attack. Naming two models to make a table look varied would be the lie.
  warm_pad:    { dsp: "oberheim", set: (T) => ({
    cutoff: T.cut, res: T.res, envAmount: SWEEP_OCT,
    envAttack: 0.6, envDecay: 1.4, envSustain: 0.7, detune: 9, drive: 0.12,
    attack: T.atk, release: T.rel, sustain: 0.8 }) },
  bowed_glass: { dsp: "oberheim", set: (T) => ({
    cutoff: T.cut, res: T.res, envAmount: SWEEP_OCT * 0.5,
    envAttack: 1.6, envDecay: 2.4, envSustain: 0.85, detune: 6, drive: 0.06,
    attack: Math.max(T.atk, 0.25), release: T.rel, sustain: 0.9 }) },
  // GM 95 Pad 7 (halo) — the bright scanning wash. ppg's `scan` is a wavetable
  // position and sweeping it slowly is what a halo is.
  halo_pad:    { dsp: "ppg", set: (T) => ({
    cutoff: T.cut, res: T.res, scan: 0.3, scanEnv: 0.35, scanLfo: 0.08,
    scanRate: 0.22, envAmount: SWEEP_OCT * 0.6, sub: 0.2, drive: 0.1,
    attack: T.atk, release: T.rel, sustain: 0.9 }) },
  // GM 94 Pad 6 (metallic) — the CZ's phase distortion is where that clangy
  // digital edge comes from, and `dcw*` is the contour that makes it metal.
  metal_pad:   { dsp: "casiocz", set: (T) => ({
    cutoff: T.cut, wave: 0.75, index: 0.45,
    dcwAmount: 0.8, dcwAttack: 0.004, dcwDecay: 0.5, dcwSustain: 0.3, detune: 7,
    attack: T.atk, decay: 0.3, sustain: 0.8, release: T.rel }) },
  // GM 55 (synth voice) — the VP-330 IS the synthesised choir, vowel and all.
  // (a choir cannot speak in two milliseconds and the module says so: vp330's
  // attack floor is 5 ms, so the tone block's snappiest is held just off it
  // rather than written onto it)
  synth_voice: { dsp: "vp330", set: (T) => ({
    cutoff: T.cut, vowel: 0.35, breath: 0.18, ensemble: 0.7, detune: 0.45,
    attack: Math.max(0.006, T.atk), sustain: 0.9, release: T.rel }) },
  // GM 51 (synth strings) — the Solina/ARP string ensemble, which is what every
  // record meaning "synth strings" was actually playing. Its chorus is the
  // instrument, so the parent drops inserts on it and so should we.
  synth_strings_1: { dsp: "solina", set: (T) => ({
    tone: T.cut, octave: 0.55, ensemble: 0.85, chorusRate: 0.62, chorusDepth: 0.9,
    attack: T.atk, release: T.rel }) },
};

/**
 * The synthesiser a GM synth-patch id is a recording of, driven by the genre's
 * own tone block — or null for an id that names a real recorded instrument.
 *
 * `padish` is whether the chair holds the chord: it only ever picks between two
 * seatings of one instrument (pad_saw / supersaw), never a different sound.
 *
 * Returns a spec in the genre `synth:{dsp, root, level, set}` shape ON PURPOSE:
 * that is the shape audio/voices.js playSynth already plays and the shape
 * recipeFor already translates, so the page and the tape can read one table.
 * Exported for the same reason drumVoice is — the drum lanes learned the hard
 * way what two tables for one sound costs. NOTE for whoever wires the live
 * page: audio/transport.js scheduleBar still reaches for `playSampled(id)` on
 * every voice a genre has not declared a `synth` for, so today this table is
 * heard on the pressed tape (audio/press-window.js, and on mobile the tape IS
 * the audible path) and not yet under the live graph. One import here and one
 * branch there closes it — the same shape playSynth already takes.
 */
export function synthForInstr(id, tone, padish) {
  const P = PATCH_SYNTH[id];
  if (!P) return null;
  const dsp = (padish && P.padDsp) || P.dsp;
  const t = tone || {};
  // THE BOUNDS ARE THE NARROWEST OF THE FLEET, not the widest, and that is
  // deliberate: a spec written here is played by TWO readers — the parent's
  // recipe (which clamps) and audio/voices.js driveSynth (which writes the
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
  return { role: S.role || role, m };
}

// a chair's recipe: the genre's signature synth where it declares one, then the
// synthesiser its GM patch id is a photograph of, then — for every id that
// names a real recorded instrument — the sampled one, which is the parent's
// default sound too.
function recipeFor(chair, seat, lib, unrouted) {
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
  if (wantSynth) return { ...synthRecipe(sy, tone, role), source: "synth:" + sy.dsp };
  // the patch table, and NO SILENT FALLBACK out of it: a row naming a dsp the
  // SYNTH dictionary has no entry for is reported, never quietly sampled — that
  // is precisely the failure that put a one-zone whistle where a pad belonged.
  const patch = synthForInstr(seat.instr, seat.tone, role === "pad");
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
  const libState = { seed, foundSources: [] };
  K.applySampledOnly(libState, seed);
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
        pitched.push({ voice: c.key, beat, dur: durB, pch: pchOf(e.n),
          amp: pitchAmp(e.vel, e.acc), accent: e.acc ? 1 : 0, slide: e.sld ? 1 : 0 });
        if (e.vox) notes.push("vox");
      } else if (e.kind === "bass") {
        if (e.n == null || !bassSeat) continue;
        pitched.push({ voice: "bass", beat, dur: durB, pch: pchOf(e.n),
          amp: pitchAmp(e.vel, e.acc), accent: e.acc ? 1 : 0, slide: e.sld ? 1 : 0 });
      } else if (e.kind === "hit") {
        // A HIT AT ZERO IS SILENCE, on the record as on the page. The kit
        // velocity vectors and the groove profiles both write velocity 0
        // legitimately, and audio/voices.js has always played it as nothing;
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
  state.instruments.bass = bassSeat ? bassSeat.m : {};

  // ---- 6. the unit table ---------------------------------------------------
  // The parent builds the whole table (drums, the perc lane, stab, sfx, the
  // mastering pan/carve/balance passes, the CPU budget trim) — this only adds
  // one pitched unit per nukernel chair on top, through the parent's OWN
  // pitchedUnit, so every strip, every insert chain and every register law is
  // the parent's and not a copy of it.
  const units = SE.voiceUnits(E, state);
  for (const c of chairs.values()) units[c.key] = SE.pitchedUnit(c.role, c.m, state);
  if (bassSeat) units.bass = SE.pitchedUnit("bass", bassSeat.m, state);
  else delete units.bass;
  delete units.pad; delete units.melody;         // the placeholders; the chairs above are the real voices
  // stereo placement + the same-timbre carve, re-run over the FINAL table: two
  // chairs that resolved the same GM instrument read as soup otherwise, and
  // voiceUnits ran its pass before these chairs existed.
  for (const c of chairs.values()) {
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
