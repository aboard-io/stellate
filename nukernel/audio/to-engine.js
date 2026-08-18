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
// only the thirteen GM synth patches below are in here, and each row is that
// patch's own instrument. (Twelve until the casting round — GM 88, "bass +
// lead", is the 303 by another name and had no row, so the one machine this
// whole table exists to defend was the one nobody could cast.)
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
  // GM 88 Lead 8 (bass + lead) — the one GM patch whose NAME is a monosynth
  // playing the bassline and the tune with the same voice, which is the 303's
  // entire job. So the id routes to tb303 and the SQUELCH becomes castable:
  // acid declares the machine as its own signature synth, and this is how any
  // other chair in any other genre can hire one.
  // Its ceilings are the module's own and not the table's — tb303 declares
  // cutoff 60..6000 and decay 0.03..2.5, both narrower than the T bounds
  // above, and a value written ON a declared edge is the failure the bounds
  // paragraph exists to avoid. `waveform` is a 0..1 morph, not an index: 0 is
  // the saw every acid record is, and only a tone block that says "square"
  // gets one.
  bass_lead:   { dsp: "tb303", wave: "saw", set: (T) => ({
    cutoff: Math.min(5800, T.cut), resonance: Math.min(0.92, 0.3 + T.res),
    envmod: Math.min(0.9, 0.25 + T.res), decay: Math.min(2.4, Math.max(0.1, T.rel)),
    waveform: WAVES[T.wave] === "square" || WAVES[T.wave] === "pulse" ? 1 : 0 }) },
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

// ---- WHAT VELOCITY MOVES ON AN INSTRUMENT YOU PLAY -------------------------
// On a synth, velocity opens a filter. On a string, a bar and a throat it moves
// the thing that EXCITES them — the plectrum, the mallet head, the glottal fold
// — and that is a different sound at the same loudness, which is the whole
// argument for the two tables below this one.
//
// The tape gets these ranges from the parent's own
// engine/faust/voices/state-engine.js MODEL_DYN (and VOICE_TYPE for who is
// singing and how high they go). The PAGE does not load state-engine — the
// press walk runs in a worker — so the rows are mirrored here, beside the
// tables that name the modules, exactly as PITCH_AMP_FLOOR/SPAN above mirror
// the parent's DYN_AMP_LO/HI. A mirror that drifts would make the page and the
// tape two different instruments wearing one name, so
// test/unit/nukernel.test.js holds all three tables against the parent's row
// for row and fails on the first number that moves.
const LIVE_DYN = {
  stk_guitar:  { pick: [0.12, 1] },
  stk_piano:   { hammer: [0.3, 1] },
  mallet:      { hard: [0.05, 1] },
  voice_lead:  { push: [0.06, 0.95] },
  voice_choir: { push: [0.05, 0.68] },
};
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
};
/** the page's trim for a pooled module, by dsp id — 1 for everything else. */
export const pageTrim = (dsp) => PAGE_TRIM[dsp] || 1;
// the five voice types as the formant tables index them, and their compass. The
// index is which singer; the compass is the register law — a bass's formants
// over a soprano's line is a chipmunk, so a part that runs off the top of a
// voice is folded into it rather than sung where nobody has that throat.
const VOICE_TYPE = {
  alto:         { n: 0, lo: 175, hi: 698 },
  bass:         { n: 1, lo: 82,  hi: 330 },
  countertenor: { n: 2, lo: 175, hi: 622 },
  soprano:      { n: 3, lo: 247, hi: 1047 },
  tenor:        { n: 4, lo: 123, hi: 494 },
};
// the vowel alphabet, spelled once. A mouth is easier to read as a word than as
// [0,3], and this is the only place in nukernel that knows which letter is which
// row of the formant table.
const VOWELS = "aeiou";
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

// ---- AND THE ONES THAT ARE INSTRUMENTS, NOT PHOTOGRAPHS OF THEM ------------
// PATCH_SYNTH above is a rescue: those thirteen GM ids are recordings OF
// synthesisers, so playing the synthesiser instead is simply telling the truth.
// This table is a different claim, and a bigger one — that for a handful of
// REAL instruments a physical model is BETTER than the recording, because the
// thing those instruments do that a recording cannot is ANSWER THE PLAYER.
//
// The test is one question: is this instrument's character its DYNAMICS? Every
// sampler in the library is one velocity layer — six zones across the keyboard
// and one recording per zone — so on a sampled voice velocity is a fader and
// nothing else. That is fine for a piano (whose sampled zones are ten deep and
// whose character is its body) and it is a lie for the two families here:
//
//   THE ELECTRIC GUITAR is a string, a pickup and an AMPLIFIER, and the
//   amplifier is the part that answers how hard you hit it. A sampled
//   distortion guitar plays a quiet recording of a loud note; the model plays
//   a quiet note, which comes out clean, on the same instrument that screams
//   when you dig in. This is the "crunch" that was missing: not a fuzz box on
//   the strip, a gain structure inside the voice.
//   THE STRUCK BAR (marimba, vibraphone, kalimba tine) is nothing but its
//   strike: a soft yarn mallet excites the fundamental and a hard plastic one
//   rings the bar modes where the click lives. Measured on the tape at equal
//   loudness, a ghosted note and a hammered one differ by a factor of two in
//   spectral centroid; the sampled zone they replace differs by nothing.
//
// AND THE ACOUSTIC GUITARS ARE STILL NOT HERE, on purpose. A steel-string, a
// nylon and a banjo are BODIES — a soundboard, a back, a membrane head — and a
// recording of a body is exactly what a sample is good at. Neither the old
// waveguide nor the toolkit's string has a body at all, so both would give up
// the one thing that makes those three themselves. Same for the organs, whose
// sound is a rank of pipes and not an excitation.
//
// THE PIANOS USED TO BE IN THAT SENTENCE AND THEY ARE NOT ANY MORE. The reason
// given was "ten-deep zones", and it was wrong — counted, not remembered, the
// deepest piano in the library has ONE recording per key range like everything
// else. The piano rows below are what that correction bought.
//
// THREE MORE WERE TRIED AND MEASURED OUT, which is worth writing down because
// "we did not get to it" and "we got to it and it was worse" are different
// facts. Compiled against this repo's own libfaust and rendered:
//   pm.brassModel   SILENT below 300 Hz — a trumpet's bottom octave produces
//                   nothing at all — and it collapses above pressure 0.5 at
//                   330 Hz, so its usable window is a fifth wide and the
//                   failure mode outside it is silence. Its pitch also runs 5%
//                   sharp. The parent's saw-stack `brass` (which already takes
//                   its bite from the note's amp) keeps the horns.
//   pm.violinModel  loudness is NOT monotone in bow force: at 262 Hz the middle
//                   dynamic measured QUIETER than the softest one, and two of
//                   six pitches came back an octave out. A bowed string whose
//                   forte might be its pianissimo is not an instrument.
//   pm.clarinetModel is the one that works — pitch exact from 147 to 587 Hz and
//                   a reed that genuinely opens up (centroid 667 -> 1347 Hz
//                   across its breath range) — and it is not here because
//                   nothing in the catalogue casts a clarinet. A cylindrical
//                   reed standing in for the conical tenor sax two genres DO
//                   cast would be a different instrument wearing its name.
//
// AND THEN THE WHOLE FAUST SYNTHESIS TOOLKIT WAS MEASURED, 2026-08, because
// three hand-rolled models is not a good answer when the reference
// implementations exist. Nineteen faust-stk instruments, compiled against this
// repo's own libfaust (2.85.8) and rendered offline in node — never a browser,
// never a render farm, one note at a time through
// engine/faust/build/measure-instrument.js. Four could not compile at all
// (bass, harpsi, modalBar, voiceForm call C++ `ffunction` lookup tables, which
// wasm has no way to link; porting their .h files to Faust `waveform` tables is
// a day's work each and nobody has needed them yet). Of the fifteen that did:
//
//   ADOPTED
//   NLFeks          in tune to 0.0 CENTS at 82/165/330/659 Hz with no
//                   correction at all, and its own dynamic-level filter was
//                   commented out in the published file. -> stk_guitar
//   piano1          fundamental is the loudest partial, decay 1.0-1.4 s and it
//                   varies with register and with velocity, and its per-key
//                   soft/loud hammer tables were wired to the constant 1.
//                   -> stk_piano
//
//   MEASURED OUT
//   brass           the octave-and-a-fifth problem again, from the other
//                   direction: asked for 165 Hz it produced 347, asked for 330
//                   it produced 698, and at MIDI 76 it is silent below full
//                   pressure. Non-monotone at MIDI 52. Same verdict as
//                   pm.brassModel, now reached twice by two different codebases.
//   fluteStk        +19 to +49 cents at full pressure and a different OCTAVE at
//                   anything less; at 0.6 pressure a 262 Hz ask came back 574.
//   sitar           -11 to -15 cents and an octave error at MIDI 76. The jawari
//                   is a randomly modulated delay line and up top the modulation
//                   is a larger fraction of the period than the period.
//   tunedBar,       pitch is excellent (within 3 cents) and the bodies are pure,
//   uniBar,         but all four peak at 1e-3 to 1e-4 — 60-80 dB down — and
//   glassHarmonica, three of them are NON-MONOTONE in the strike at the top of
//   tibetanBowl     their range. `mallet` beside them is louder, monotone and
//                   already cast; these are colour nobody has asked for yet.
//
//   MEASURED GOOD AND PARKED, which is a third thing and worth writing down
//   clarinet        pitch -5 to -21 cents, 86-96% of its energy in the
//                   fundamental, monotone, and the reed genuinely opens.
//   saxophony       pitch +2 to +10 cents from 116 to 466 Hz, up to 92% body,
//                   monotone. tenor_sax is cast twice in this catalogue and
//                   this would be an improvement on the zone.
//                   BOTH have a hard speaking threshold — under about 0.75
//                   pressure they do not sound at all, which is physically
//                   correct for a reed and dangerous in a generative engine
//                   that will hand a voice any velocity. Adopting either means
//                   mapping velocity into a narrow band ABOVE the threshold and
//                   letting the note's amp carry the rest, which is a design
//                   decision and not a port. Next round.
//   bowed           +5 to +17 cents (consistently sharp, so fittable) and this
//                   time loudness IS monotone in bow force, unlike
//                   pm.violinModel. But its body share jumps between 0.6% and
//                   39% across three pitches at one bow pressure, which is the
//                   bow slipping between regimes. Not until that is understood.
//
// The genre's own tone block drives these too — `cut` becomes the speaker
// cabinet's corner (a guitar cab lives an octave or so above where a synth
// filter sits, hence the lift), `rel` how long the hand lets the note ring,
// `gain` the voice level — exactly as it drives the synth table above.
const PATCH_MODEL = {
  // ---- the electrics ----
  // THE STRING UNDER ALL SIX IS THE TOOLKIT'S NOW (engine/faust/dsp/
  // stk_guitar.dsp — Julius Smith's extended Karplus-Strong out of faust-stk,
  // through the amp and cabinet this repo fitted against the sampled zones).
  // The waveguide these rows were written for is still in the tree and it was
  // measured out: at MIDI 40 its loudest partial was the SEVENTH and the
  // fundamental was 34.6 dB down — 0.0% of the note's energy inside a semitone
  // of 82 Hz — which is the "plinky" this whole family was named for. The EKS
  // is in tune to under one cent from MIDI 40 to 96 with no fitted correction,
  // and its spectral centroid moves x1.5 to x2.7 across the plectrum where the
  // waveguide's moved x1.05.
  //
  // The six recipes below are the SAME SIX GUITARS, translated: `damp` (a loop
  // coefficient) becomes `ring` (the string's -60 dB time in seconds), `stiff`
  // becomes `bright` (the damping filter's tilt, which is what string stiffness
  // audibly is), and `pluckPos` is measured from the nearer end so 0.78 and
  // 0.22 are the same pluck. Nothing about which guitar is which has moved.
  //
  // GM 28 (clean electric). The most-cast instrument in the table by a factor
  // of four, and the one whose sampled version has the least to say: a clean
  // electric IS its pick attack, and the sample has one.
  clean_guitar:      { dsp: "stk_guitar", set: (M) => ({
    drive: 0.09, pluckPos: 0.22, pickup: 0.30, bright: 0.55, ring: 4.0,
    cutoff: M.cab, release: M.rel }) },
  // GM 27 (jazz electric) — neck pickup, no dirt, and the tone rolled off. The
  // pickup is the whole difference between this and the clean above.
  jazz_guitar:       { dsp: "stk_guitar", set: (M) => ({
    drive: 0.04, pluckPos: 0.38, pickup: 0.50, bright: 0.30, ring: 3.0,
    cutoff: Math.min(M.cab, 3200), release: M.rel }) },
  // GM 29 (palm muted) — the mute is the STRING's own decay and a short hand,
  // which is what a palm mute physically is, plus enough gain to chug. 0.23 s
  // of ring measures as a 140 ms chug on a real pluck; the old coefficient
  // spelling of the same idea left the string sustaining for a full second.
  palm_muted_guitar: { dsp: "stk_guitar", set: (M) => ({
    drive: 0.38, pluckPos: 0.10, pickup: 0.12, bright: 0.62, ring: 0.23,
    cutoff: M.cab, release: 0.06 }) },
  // crunch, overdrive, distortion: ONE instrument at three amounts of
  // amplifier, which is what those three words have always meant. The sampled
  // trio are three separate recordings pretending to be that, and none of them
  // can be played quietly.
  crunch_guitar:     { dsp: "stk_guitar", set: (M) => ({
    drive: 0.45, pluckPos: 0.16, pickup: 0.2, bright: 0.58, ring: 5.0,
    cutoff: M.cab, release: M.rel }) },
  overdrive_guitar:  { dsp: "stk_guitar", set: (M) => ({
    drive: 0.58, pluckPos: 0.16, pickup: 0.22, bright: 0.58, ring: 5.5,
    cutoff: M.cab, release: M.rel }) },
  distortion_guitar: { dsp: "stk_guitar", set: (M) => ({
    drive: 0.82, pluckPos: 0.12, pickup: 0.16, bright: 0.64, ring: 6.0,
    cutoff: Math.min(M.cab, 4600), release: M.rel }) },
  // ---- the pianos ----
  // AND THE PIANOS ARE HERE NOW, on a measurement that overturns the reason
  // they were not. The note that used to sit below this table said pianos stay
  // sampled because their "zones are ten deep" — ten VELOCITY layers, which
  // would make a recording the better piano. Counted on the shipped registry:
  // yamaha_grand_piano and bright_yamaha_grand are 6 zones and upright_piano
  // and felt_piano are 10, and in every one of the four the zones tile the
  // KEYBOARD with exactly ONE recording per key range. There is not a second
  // dynamic anywhere in the library. A sampled fortissimo is a sampled
  // pianissimo turned up, on the instrument whose entire expressive range is
  // the hammer.
  //
  // What plays them now is the FAUST-STK commuted waveguide piano — a
  // noise-excited soundboard through a frequency-dependent hammer into three
  // coupled strings per note, with the hammer's soft and loud filter poles
  // MEASURED per key and crossfaded by velocity. Dumped partial by partial at
  // MIDI 52: soft, the fundamental leads and the fourth harmonic is 17.8 dB
  // down; hard, the fourth harmonic IS the loudest thing in the note. That is
  // the sound a piano makes when you lean on it, and no zone can make it.
  //
  // `hammer` is not set here — the note's own velocity writes it, through
  // LIVE_DYN above, the same way the plectrum is written on the six guitars.
  // `bright`/`stiff`/`detune` are the four pianos' own characters.
  yamaha_grand_piano:  { dsp: "stk_piano", set: (M) => ({
    bright: 0.25, stiff: 0.28, detune: 0.10, cutoff: M.mcut, release: M.rel }) },
  bright_yamaha_grand: { dsp: "stk_piano", set: (M) => ({
    bright: 0.55, stiff: 0.34, detune: 0.12, cutoff: M.mcut, release: M.rel }) },
  // an upright is a shorter string in a smaller box: stiffer (more
  // inharmonicity per unit length), less unison spread, and it stops sooner.
  upright_piano:       { dsp: "stk_piano", set: (M) => ({
    bright: 0.32, stiff: 0.44, detune: 0.16, cutoff: Math.min(M.mcut, 7000),
    release: Math.min(M.rel, 0.4) }) },
  // felt is a strip of cloth between hammer and string — the top of the
  // spectrum simply does not happen, and the unisons drift because nobody
  // tunes a prepared piano twice.
  felt_piano:          { dsp: "stk_piano", set: (M) => ({
    bright: 0.0, stiff: 0.22, detune: 0.22, cutoff: Math.min(M.mcut, 4200),
    release: M.rel }) },
  // ---- the struck bars ----
  // GM 12 (marimba) — rosewood. `ring` is the T60 of the LOWEST bar mode and
  // the library's own 0.1 s is a bar that has stopped before the player's hand
  // has: measured against the sampled zone it stands in for, the model was 14 dB
  // down on the tape purely because the note was over. Half a second is a real
  // rosewood bar, and `tilt` still kills the upper modes first, which is what
  // makes it read short.
  marimba:    { dsp: "mallet", set: (M) => ({
    ring: 0.5, exPos: 1, tilt: 6, cutoff: M.mcut, release: 1.5 }) },
  // GM 11 (vibraphone) — aluminium bars and a pedal, so it rings for a second
  // and a half and note-off means something (the damper comes down).
  vibraphone: { dsp: "mallet", mul: 0.58, set: (M) => ({
    ring: 2.2, exPos: 1, tilt: 4, cutoff: M.mcut, release: 0.35 }) },
  // GM 108 (kalimba) — a plucked tine over a box: between the two, and softer
  // up top, because a thumb is the softest mallet there is.
  kalimba:    { dsp: "mallet", mul: 0.50, set: (M) => ({
    ring: 0.8, exPos: 1.4, tilt: 7, cutoff: Math.min(M.mcut, 7000), release: 1.5 }) },
  // AND NOT THE MUSIC BOX, which was in this table for a day. Every row here is
  // a bar over a RESONATOR TUBE, because that is what the model is; a music box
  // is a comb tooth screwed to a wooden case and has no tube at all, and the one
  // it was given pulled it down where a music box does not live — measured, a
  // centroid of 1145-2243 Hz against the sampled comb's 2788-3014. The zone
  // recording is the better music box and it keeps the job.
};

// ---- AND THE ONE INSTRUMENT EVERY LISTENER OWNS ----------------------------
// A voice is the only thing in the catalogue the ear grades against something
// it hears all day, and sampled it is the flattest sound in the library.
// Measured on the shipped registry: `solo_vox`, `ahh_choir` and `ohh_voices`
// are six zones and ONE recording each. So a sung line is that one held "aah"
// transposed — one dynamic, one vowel it can never leave, and the take's own
// vibrato baked in and beating against every other note in the chord. That is
// the squeak Paul heard ("the vocals are just squeaky"), and unlike the pads it
// is not even a bad recording: it is what a recording of a vowel IS.
//
// The parent grew a vocal tract for it (engine/faust/dsp/voice_tract.lib and
// its two seatings), and the point of a tract is that the VOWEL IS A SIGNAL: a
// line can move through it, a section can hold one, and the dynamic opens the
// voice instead of turning it up. Same claim as the guitar amp and the struck
// bar one table up, on the instrument where it matters most.
//
// WHICH ID IS WHICH SEATING is decided by what the id has always named:
// GM 85 "Lead 6 (voice)" is a soloist and gets the LEAD; GM 52/53/91 are choir
// aahs, voice oohs and a choir pad, and get the SECTION. GM 54 "synth voice" is
// NOT here on purpose — it is a photograph of a VP-330, an actual machine the
// parent owns, and PATCH_SYNTH already sends it there. A Roland string-choir is
// not a person and should not be modelled as one.
//
// The `vowels` on each row are what the GM id itself means — aahs are open,
// oohs are round — and they are what a genre with no mouth of its own sings.
//
// `phase` is what happens when a genre DOES have a mouth and casts two of these
// at once, which four of them do (gospel and doowop take both the aahs and the
// oohs). One mouth per genre is right — a group is one group — but two sections
// singing the identical syllable at the identical moment is one section twice.
// So the id ROTATES the genre's word: the aahs sing it from the top, the oohs a
// syllable behind. Doowop's "ou" comes out as o-u against u-o, which is what
// four men round a microphone actually do, and it costs no new vocabulary.
const PATCH_VOICE = {
  solo_vox:    { dsp: "voice_lead",  voice: "tenor", vowels: "ao", syll: 0.5, phase: 0 },
  ahh_choir:   { dsp: "voice_choir", voice: "alto",  vowels: "a",  syll: 4, phase: 0 },
  ohh_voices:  { dsp: "voice_choir", voice: "alto",  vowels: "ou", syll: 4, phase: 1 },
  space_voice: { dsp: "voice_choir", voice: "soprano", vowels: "u", syll: 8, phase: 2 },
};

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
 * ONE THING TO KNOW BEFORE CASTING ANOTHER GENRE ONTO THIS, measured on the
 * 2026-08-18 casting round and written here because this is where the next
 * person will look: A VOICE GETS NO WHOLE-LINE OCTAVE HOME. audio/plan.js
 * windowOf reads `unit.sampler` and returns null for anything that is not one —
 * "a synth voice folds by its own law" — so homeFor never moves a sung part,
 * and the only thing between the score and the throat is the parent's PER-NOTE
 * fold into `freqMin`/`freqMax` (state-engine mapEvents). A sampler's line is
 * moved whole with its contour intact; a singer's line is folded note by note,
 * which REWRITES the intervals of anything wider than the voice type's own
 * window — and the widest of the five is 25 semitones. So the question to ask
 * of a candidate is not "would this record have a singer" but "how wide is the
 * part": measured over the shipped 22, the fold rewrites 0% of a line that fits
 * and 75% of one that does not, and `hymn` — the most obviously vocal genre in
 * the table, four parts each 31 semitones wide — is uncastable for exactly this
 * reason. test/unit/nukernel.test.js §77(f) prints the number per cast part.
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
    voice: M.voice || P.voice,
    vowels: word.slice(ph) + word.slice(0, ph),
    vowelEvery: M.syll != null ? M.syll : P.syll,
    breath: dial(M.air, choir ? 0.22 : 0.14, 0.6),
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
  //   THE 4.2 kHz FLOOR IS LOAD-BEARING and was measured, not chosen: blues
  // writes cut 1100, which read literally puts a 4x12 cabinet's cliff at 2.9 kHz
  // and takes every guitar in the catalogue back to the blanket this whole round
  // exists to lift. A real cab dies around 5 kHz (which is where the parent's
  // own insert_higain puts its, fixed), so the genre's number tilts the cabinet
  // and does not get to close it.
  const M = {
    cab:  clamp((t.cut != null ? t.cut : 2600) * 2.6, 4200, 9000),
    mcut: clamp((t.cut != null ? t.cut : 3000) * 2.6, 3000, 15000),
    rel:  clamp(t.rel != null ? t.rel : 0.3, 0.05, 1.8),
  };
  // `mul` is the per-instrument level A/B, and it is a RING tax: the modules'
  // own output trims were fitted on one setting each (a marimba, a clean amp),
  // and a bar told to ring four times longer puts four times the energy on the
  // tape for the same strike. Measured against the sampled zone each row stands
  // in for, the long-ringing three came back 5-6 dB hot; this is that, and
  // nothing else, which is why the two short ones do not carry one.
  return { dsp: P.dsp, root: P.dsp,
    level: clamp((t.gain != null ? t.gain : 0.28) * 2.8 * (P.mul || 1), 0.35, 0.92),
    set: P.set(M), live: liveModel(P.dsp) };
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
  return synthForInstr(id, tone, padish)
    || modelForInstr(id, tone)
    || voiceForInstr(id, tone);
}

// a chair's recipe: the genre's signature synth where it declares one, then the
// synthesiser its GM patch id is a photograph of, then the INSTRUMENT that id
// names where the parent can play one better than a recording of it can
// (PATCH_MODEL — the electrics and the struck bars), then the SINGER for the
// four ids that name a person (PATCH_VOICE), then — for every other id, which
// is most of them — the sampled one, the parent's default sound.
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
  for (const c of chairs.values()) units[c.key] = SE.pitchedUnit(c.role, c.m, state);
  if (bassSeat) units.bass = SE.pitchedUnit("bass", bassSeat.m, state);
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
