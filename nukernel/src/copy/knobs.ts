// nukernel/src/copy/knobs.ts — ONE PAGE OF THE CATALOGUE (strings.ts merges it).
//
// what a modelled instrument's own controls are called — the rows of
// nukernel/knobs.js, drawn by ui/eight.js's knob table, its tract pad and its
// envelope plate
//
// The voice is DESIGN.md §4; the budgets are a chip or a face ≤ 6 words and a
// sentence beside a refused control ≤ 12, held by test/copy.test.js. A key is
// a surface and a meaning (`cell.default`, `refuse.noArticle`), never a
// fragment of a sentence: whole sentences only, with {name} / {n} / {unit}
// placeholders, so a second language can put them in its own order.
//
// THE ROWS ARE MEASURED, THE NAMES ARE NOT. `nukernel/knobs-extract.js` probes
// the engine for which keys on a voice actually move something; what those keys
// are CALLED is copy, and it belongs here with the rest of the copy. So the
// extractor's own table maps a param to a KEY IN THIS FILE (`cutoff` ->
// `knobs.cutoff`), the generated `knobs.js` carries `labelKey` and no English at
// all, and `ui/eight.js` resolves it through `t()` at render time. The extractor
// reads this directory and REFUSES to write a row whose key is not here, so a
// new module cannot ship a control that prints its own key back at you.
//
// WHY THEY ARE NOUNS. DESIGN.md §4: nouns for things, and ≤ 6 words. These rows
// printed QUESTIONS — "how far the envelope opens the filter", "the mic and the
// room", "how much it phonates" — which is a caption under a control rather than
// a name on one, and untranslatable besides: a question has a word order that
// does not survive the trip. What a synthesist calls the knob wins, and where
// the instrument has its own word for it (a drawbar's footage, the Leslie, the
// bow) that word is the one used.
//
// FOUR OF THESE ROWS ARE NOT HERE and that is the point of `env.seg.*` in
// misc.ts: attack, decay, sustain and release are the envelope's own stages,
// named once, and a knob row that spelled them a second time would be the same
// handle under two names one line apart.

import type { Table } from "./api.js";

export const KNOBS: Table = {
  /* ===== THE FILTER ===================================================== */
  "knobs.cutoff": "Filter cutoff",
  "knobs.resonance": "Resonance",
  "knobs.filterMode": "Filter mode",
  "knobs.filterEnvAmount": "Filter envelope amount",
  "knobs.filterEnvAttack": "Filter envelope attack",
  "knobs.filterEnvDecay": "Filter envelope decay",
  "knobs.filterEnvSustain": "Filter envelope sustain",
  "knobs.keyTracking": "Filter key tracking",
  "knobs.lfoToFilter": "LFO to filter",

  /* ===== THE OSCILLATORS ================================================ */
  "knobs.oscMix": "Oscillator mix",
  "knobs.waveform": "Waveform",
  "knobs.voiceCount": "Voices",
  "knobs.subLevel": "Sub level",
  "knobs.subOctave": "Sub-octave",
  /* the Solina's 8'/4' body, which is a FOOTING mix and not a sub. */
  "knobs.octaveMix": "Octave mix",
  "knobs.sawLevel": "Saw level",
  "knobs.pulseLevel": "Pulse level",
  "knobs.noiseLevel": "Noise level",
  "knobs.pulseWidth": "Pulse width",
  "knobs.pulseWidthDepth": "Pulse width depth",
  "knobs.detune": "Detune",
  /* a choir's `spread` is how far the throats are out of tune with each
     other; a Juno's is antiphase in the stereo field. One word, two facts —
     the extractor scopes them by module, exactly as it scopes a unit. */
  "knobs.detuneSpread": "Detune spread",
  "knobs.stereoWidth": "Stereo width",
  "knobs.drift": "Oscillator drift",
  "knobs.osc2Tune": "Oscillator 2 tune",
  "knobs.osc2Lfo": "Oscillator 2 LFO",
  "knobs.lfoRate": "LFO rate",
  /* the row is a TIME (ms on the fleet, seconds on a waveguide), so the noun
     says so — and `rule.headGlide` is the rules deck's own heading. */
  "knobs.glide": "Glide time",

  /* ===== FM, SYNC AND PHASE ============================================= */
  "knobs.fmRatio": "Operator ratio",
  "knobs.fmIndexStart": "Attack index",
  "knobs.fmIndexEnd": "Settled index",
  "knobs.fmIndexTime": "Index time",
  "knobs.phaseMod": "Phase modulation",
  "knobs.phaseModFilter": "Phase modulation to filter",
  "knobs.syncRatio": "Sync ratio",
  "knobs.syncSweep": "Sync sweep",
  "knobs.syncDecay": "Sync decay",

  /* ===== THE WAVETABLE AND THE PHASE-DISTORTION WAVE ==================== */
  "knobs.scanPosition": "Wavetable position",
  "knobs.scanEnv": "Scan envelope amount",
  "knobs.scanLfo": "Scan LFO amount",
  "knobs.scanRate": "Scan rate",
  "knobs.waveDistortion": "Wave distortion",
  "knobs.distortionEnvAmount": "Distortion envelope amount",
  "knobs.distortionAttack": "Distortion attack",
  "knobs.distortionDecay": "Distortion decay",
  "knobs.distortionSustain": "Distortion sustain",

  /* ===== TONE, DRIVE AND THE BUILT-IN EFFECTS ========================== */
  "knobs.tone": "Tone",
  "knobs.brightness": "Brightness",
  "knobs.drive": "Drive",
  "knobs.chorus": "Chorus",
  "knobs.chorusRate": "Chorus rate",
  "knobs.chorusDepth": "Chorus depth",
  "knobs.ensemble": "Ensemble",
  "knobs.leslie": "Leslie",
  "knobs.vibrato": "Vibrato",
  "knobs.vibratoRate": "Vibrato rate",
  "knobs.vibratoDelay": "Vibrato delay",
  "knobs.wobbleRate": "Wobble rate",

  /* ===== THE HAMMOND, IN ITS OWN VOCABULARY =============================
     Nine harmonics named by ORGAN PIPE LENGTH, which is the only naming under
     which "888000000" means anything, and the only one an organist uses. */
  "knobs.bar16": "16' sub-octave",
  "knobs.bar513": "5 1/3' fifth",
  "knobs.bar8": "8' fundamental",
  "knobs.bar4": "4' octave",
  "knobs.bar223": "2 2/3' twelfth",
  "knobs.bar2": "2' fifteenth",
  "knobs.bar135": "1 3/5' seventeenth",
  "knobs.bar113": "1 1/3' nineteenth",
  "knobs.bar1": "1' twenty-second",
  "knobs.percussion": "Percussion",
  "knobs.percussionHarmonic": "Percussion harmonic",
  "knobs.percussionDecay": "Percussion decay",
  "knobs.keyClick": "Key click",
  "knobs.leakage": "Drawbar leakage",

  /* ===== THE PHYSICAL MODELS: a string, a bar, a bow ==================== */
  "knobs.stiffness": "String stiffness",
  "knobs.ringTime": "Ring time",
  "knobs.pluckPosition": "Pluck position",
  "knobs.pickupPosition": "Pickup position",
  "knobs.strikePosition": "Strike position",
  "knobs.partialTilt": "Partial tilt",
  "knobs.bowPressure": "Bow pressure",
  "knobs.bowSpeed": "Bow speed",
  "knobs.bowPosition": "Bow position",
  /* the erhu's python skin is the radiator and the qin dian damps it. */
  "knobs.skin": "Skin resonance",
  "knobs.bridgePad": "Bridge pad",

  /* ===== THE THROAT AND THE TUBE ========================================
     A singer and a vocal tract, named for the organ rather than for the
     gesture: the control is a place or an amount, and "how far the mouth
     moves" was a caption. */
  "knobs.voiceType": "Voice type",
  "knobs.breath": "Breath",
  "knobs.glottis": "Glottis opening",
  "knobs.voicing": "Voicing",
  "knobs.nasality": "Nasality",
  "knobs.hiss": "Hiss",
  "knobs.hissPosition": "Hiss position",
  "knobs.articulation": "Articulation",
  "knobs.tonguePosition": "Tongue position",
  "knobs.tongueReach": "Tongue reach",
  "knobs.tongueLength": "Tongue length",
  "knobs.lips": "Lips",
  "knobs.vowel": "Vowel",
  "knobs.vowels": "Vowels",
  "knobs.syllableLength": "Syllable length",
  "knobs.vowelDrift": "Vowel drift",
  "knobs.foldDrift": "Fold drift",
  "knobs.foldDriftRate": "Fold drift rate",
  "knobs.babble": "Babble",
  "knobs.babbleRate": "Babble rate",
  "knobs.babbleSeed": "Babble seed",

  /* ===== A VOICE WHOSE ONE CONTROL IS A PATCH =========================== */
  "knobs.cartridge": "Cartridge",
};
