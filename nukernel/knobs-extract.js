#!/usr/bin/env node
// nukernel/knobs-extract.js — WHAT A VOICE'S OWN KNOBS ARE, MEASURED.
//
//   node nukernel/knobs-extract.js            rewrite nukernel/knobs.js
//   node nukernel/knobs-extract.js --check    fail if it and the engine disagree
//   node nukernel/knobs-extract.js --report   print the census, write nothing
//
// THE EXTRACTION IS A MEASUREMENT, NOT A PARSE, and that is the whole reason
// this file exists (VOICE.md §2). A parser was tried and it is wrong:
// `state-engine.js` delegates `modeld` and `tb303` to helper functions
// (`modeldUnit`, `tb303Unit`), so scraping `mp("x")` out of a case body reports
// `modeld 0/17` when the truth is eleven. So nothing here believes the source
// text about what a key DOES. It probes the parent:
//
//     base = voiceUnit(dsp, {},        state)      the derived answer
//     a    = voiceUnit(dsp, {[k]: lo}, state)
//     b    = voiceUnit(dsp, {[k]: hi}, state)
//     the key is REAL iff some field of a differs from the same field of b
//
// and the fields it compares are `params.*` plus the three places a `set` key
// reaches that are NOT params — `vowels`, `vowelEvery` and the compass
// (`freqMin`/`freqMax`, which `voice` moves). VOICE.md measured that
// `vowelEvery` and `voice` reach exactly there and nowhere else.
//
// THE SOURCE TEXT IS READ FOR TWO THINGS ONLY, and both are hypotheses the
// probe then confirms or throws away:
//   * WHICH WORDS TO TRY. The candidate list is the union of the module's own
//     `dist/*-meta.json` slider labels and every identifier the parent reads as
//     `mp("k")` or `m.k`. A candidate that moves nothing is simply not a row.
//   * WHERE TO START SWEEPING. `mp("k", d, lo, hi)` declares a range in RECIPE
//     space, which is the space a `set` key is written in; the module's meta
//     declares one in PARAM space. Both are guesses at a bracket. The row's
//     own min/max are then found by SWEEPING that bracket and trimming the dead
//     travel off both ends — the published range is the outermost pair of
//     values at which the parameter still moves, so no slider on this page has
//     a stretch at either end where nothing happens.
//
// WHAT IT FINDS THAT NO HAND-WRITTEN TABLE WOULD HAVE (all three re-measured
// here every run, none of them typed):
//   * RENAMES the SYNTH table does not carry — `nasal` -> `velum`,
//     `wobbleBars` -> `wobbleHz`, `damp` -> `ring`, `res` -> `resonance`.
//   * ONE RECIPE WORD MEANING DIFFERENT THINGS ON DIFFERENT VOICES —
//     `fenvAmount` moves `params.envAmount` on juno60 and `params.fenvAmount`
//     on pad_saw. So a row's LABEL comes from the param and its document key
//     from the recipe word, and the two are not the same string. It is also why
//     INERT is keyed by `(module, param)` and never by word.
//   * NON-PARAM REACH — `vowelEvery` moves `unit.vowelEvery`; `voice` moves the
//     compass as well as `params.voice`.
//
// THE INERT LIST BELOW IS THE ONE THING IN HERE THAT IS DATA AND NOT A PROBE,
// and every row of it carries the measurement that put it there. A probe can
// only see whether a NUMBER CHANGED; it cannot hear whether anything happened.
// The dB figures come from VOICE.md's offline sweeps. A knob that does nothing
// is worse than no knob, so a measured-silent key is not drawn as a control —
// it is drawn as its reason (`ui/eight.js`, VOICE.md §5 row four).

"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

/* ---------- MEASURED SILENT. `(module, param)` and never a word. ----------
   Every number here is from VOICE.md's offline sweeps: the module rendered at
   both ends of the key and the peak-band level compared. `fenv*` on the six
   modules that map it to a uniform `fenvAmount` slider measured 0.0 dB across
   the whole range — the parent gave every filter-bearing model those sliders
   "fenvAmount default 0 = bit-exact off" and on these six nothing downstream
   reads them. `vp330/breath` is the costly one: it is the PAD reading of
   "synth voice", it is where a hand goes looking for a breath knob, and it is
   0.4 dB across 0..1. It comes out anyway and the row prints its number. */
const INERT = [
  ["fm2op", "fenvAmount", "0.0 dB across the whole range, measured"],
  ["fm2op", "fenvAttack", "0.0 dB across the whole range, measured"],
  ["fm2op", "fenvDecay", "0.0 dB across the whole range, measured"],
  ["vp330", "fenvAmount", "0.0 dB across the whole range, measured"],
  ["vp330", "fenvAttack", "0.0 dB across the whole range, measured"],
  ["vp330", "fenvDecay", "0.0 dB across the whole range, measured"],
  ["solina", "fenvAmount", "0.0 dB across the whole range, measured"],
  ["solina", "fenvAttack", "0.0 dB across the whole range, measured"],
  ["solina", "fenvDecay", "0.0 dB across the whole range, measured"],
  ["casiocz", "fenvAmount", "0.0 dB across the whole range, measured"],
  ["casiocz", "fenvAttack", "0.0 dB across the whole range, measured"],
  ["casiocz", "fenvDecay", "0.0 dB across the whole range, measured"],
  ["supersaw", "fenvAmount", "0.0 dB across the whole range, measured"],
  ["supersaw", "fenvAttack", "0.0 dB across the whole range, measured"],
  ["supersaw", "fenvDecay", "0.0 dB across the whole range, measured"],
  ["pad_saw", "fenvAmount", "0.0 dB across the whole range, measured"],
  ["pad_saw", "fenvAttack", "0.0 dB across the whole range, measured"],
  ["pad_saw", "fenvDecay", "0.0 dB across the whole range, measured"],
  ["vp330", "breath",
    "the VP-330's own breath control does almost nothing — 0.4 dB across its whole range, measured"],
  ["vp330", "detune", "0.2 dB across its whole range, measured"],
];
const inertOf = (mod, param) => {
  const r = INERT.find((x) => x[0] === mod && x[1] === param);
  return r ? r[2] : null;
};

/* ---------- TWO OWNERS. Not inert — SPOKEN FOR. --------------------------
   `freq` and `gate` are the note. `gain` and `level` are the fader: the voice
   already carries a `level` (document.js:63 — `synthRecipe` writes `m.level`
   from it before the `set` loop could overwrite it) and the board's fader is
   the other half of that one number. A third level control on one channel is
   what the desk round spent a day deleting, so this list is about ownership
   and not about audibility (VOICE.md §2, last paragraph). */
const OWNED = new Set(["freq", "gate", "gain", "level", "note", "trig"]);

/* ---------- WHAT A KEY IS GATED BY (VOICE.md §5, row three) --------------
   Not a probe's business: a probe sees `tongue` move `params.tongue` at every
   setting of `babble`, because it does. What it cannot see is that at
   `babble` 1 the seeded driver has already taken the articulators — measured,
   `artic` is a 10 dB control at babble 0.4 and a 0.1 dB one at babble 1. So
   these rows draw DISABLED, with the sentence, when their gate is shut, and
   drawing five live-looking sliders the driver has already taken is exactly
   the lie this page forbids. Keyed by (module, key) like INERT, for the
   `fenvAmount` reason. `on` means "live only while the gate key is above zero";
   `off` means "live only while it is AT zero". */
const ART = "the tube is one uniform pipe until artic opens — there is nothing for the tongue to shape";
const DRIVER = "the seeded driver has the articulators — turn babble down to shape them by hand";
const GATED = {
  // THE ARTICULATORS ARE GATED TWICE, and both gates are real. `artic` is how
  // far the mouth moves at all — at 0 the tube is one uniform pipe and a tongue
  // position shapes nothing — and `babble` is WHO is moving it: at 1 the seeded
  // driver owns them outright.
  "tract_voice/tongue": [["artic", "on", ART], ["babble", "off", DRIVER]],
  "tract_voice/tongueD": [["artic", "on", ART], ["babble", "off", DRIVER]],
  "tract_voice/tongueL": [["artic", "on", ART], ["babble", "off", DRIVER]],
  "tract_voice/lips": [["artic", "on", ART], ["babble", "off", DRIVER]],
  "tract_voice/fricX": [["artic", "on",
    "the tube is one uniform pipe until artic opens — there is nothing for the hiss to sit in front of"]],
  "tract_voice/rate": [["babble", "on",
    "nothing is babbling, so there is no speed for it to babble at"]],
  "tract_voice/seed": [["babble", "on",
    "nothing is babbling, so there is no sentence for it to say"]],
};
const gateOf = (dsp, key) => {
  const g = GATED[dsp + "/" + key];
  return g ? g.map(([by, when, why]) => ({ by, when, why })) : null;
};

/* ---------- A FLOOR THIS PAGE PUTS ON A MODULE'S OWN RANGE ---------------
   ONE row, written down here rather than discovered later (VOICE.md §6).
   `tract_voice/voiced` at 0 is not a whisper, it is DIGITAL SILENCE, -180 dB:
   the tube stops phonating. That is a real sound and a real footgun, so the
   floor is 0.02 and the reason prints beside it. Clamping a control's floor
   away from a silence the module allows is a departure and this is the whole
   list of them. */
const FLOOR = {
  "tract_voice/voiced": [0.02,
    "take it right down and the tube whispers; at zero it stops making a sound at all"],
};

/* ---------- AND A CEILING, WHICH IS A DIFFERENT KIND OF DEPARTURE --------
   Paul, 2026-08-26: *"it's also ALWAYS hissy -- i think hiss is probably 5x
   too much for the range of use."* His number is not a figure of speech. It is
   the measurement.

   THE SWEEP AND ITS RULE. Rendered offline, one held note at 220 Hz, at the
   push and the cutoff the CHAIR actually sends (audio/to-engine.js:572, :711),
   with the voiced part and the aspirate part separated exactly rather than
   estimated: the noise is deterministic per render, so `out(b) - (1-b)*out(0)`
   is the aspiration alone, sample for sample. The quantity is the one
   `to-engine.js:560` already argues in — APERIODIC ENERGY ABOVE 4 kHz AGAINST
   HARMONIC ENERGY THERE — and that paragraph carries the two judgements this
   ceiling is read off:
     -9.1 dB  the seat it chose. "tone first, air on top."   (measured here as
              -8.5 dB at the same numbers, which is what says this harness and
              that one are measuring the same thing)
     -2.8 dB  the seat it REJECTED, on nearly every record:
              "a whisper's balance, not a singer's."
   So the taste ceiling is ONE STEP PAST THE ONE ALREADY CALLED TOO MUCH: the
   breath at which the air first stands +3 dB OVER the tone above 4 kHz. Past
   that the sound is a whisper, and a whisper is a different instrument that
   `voiced` already owns on the tube (FLOOR, above).

   WHAT IT COMES TO, and the two voices agree without being made to:
     tract_voice  -9.8 dB at .060 · -0.5 at .150 · +2.4 at .195 · +3.3 at .210
                  → 0.2 of a declared 1.0
     voice_lead   -6.2 dB at .050 · +0.8 at .100 · +2.7 at .120 · +3.6 at .130
                  → 0.12 of a declared 0.6
   ONE FIFTH, BOTH TIMES, FROM ONE RULE. Paul's 5x is the arithmetic.

   AND IT IS ONLY A CEILING ON THE CONTROL. The module still reaches 1.0 and a
   genre's `air` still writes what it writes; what this says is that four
   fifths of the SLIDER was travel nobody would stop on, which is a broken knob
   even though every value in it "works". Both derived values are comfortably
   inside — the tube's 0.06 sits 30% up the new slider, the singer's 0.05 sits
   42% up, and the chant's own `breath: 0.07` (songs.js:302) sits at 35%.

   VOICE_CHOIR IS NOT IN THIS TABLE AND THAT IS THE FINDING, not an omission.
   The same rule puts its ceiling at 0.012 — BELOW its own derived 0.08, which
   already measures +17.6 dB of air over tone above 4 kHz. A slider whose top
   is under the number the record is already holding is the lie this page
   exists to not tell, so the range stands and the module is what wants
   looking at. Written down here rather than discovered later. */
const CEILING = {
  "tract_voice/breath": [0.2,
    "past here it is a whisper rather than a voice — the air stands over the " +
    "tone above 4 kHz, measured"],
  "voice_lead/breath": [0.12,
    "past here it is a whisper rather than a voice — the air stands over the " +
    "tone above 4 kHz, measured"],
};

/* ---------- WHAT THE READOUT SAYS, AND IT SAYS THE MUSICAL THING ---------
   VOICE.md §3: "No invented units." A unit is a fact about the PARAM — seconds
   are seconds on every module — so the table is by param name and the row
   carries the answer as data, which is what keeps `ui/eight.js` from growing a
   switch over parameter names. `null` is "a plain 0..1 dial, its own number". */
const UNIT = {
  attack: "s", release: "s", decay: "s", sustain: null, cutoff: "Hz",
  envAttack: "s", envDecay: "s", fenvAttack: "s", fenvDecay: "s",
  dcwAttack: "s", dcwDecay: "s", percDecay: "s", syncDecay: "s",
  rate: "hz", vibRate: "hz", chorusRate: "hz", wowRate: "hz",
  flutterRate: "hz", swayRate: "hz", scanRate: "hz", lfoRate: "hz",
  wobbleHz: "hz", vibRise: "s", ring: "s", glide: "s", grainSec: "s",
  vowelEvery: "beats", seed: "take", obDetune: "cents",
  syncDetune: "cents", czDetune: "cents", drift: "cents",
  fenvAmount: "oct", envAmount: "oct", freq: "Hz",
  // A DEPTH IN THE VOWEL TABLES IS NOT A DETUNE IN CENTS. Same word, two
  // meanings, and the dsp/key override is how one table says both.
  "voice_choir/drift": null, "voice_lead/drift": null,
  wobbleBars: "bars",
  // …AND ONE PARAM WHOSE UNIT IS NOT THE SAME ON TWO MODULES, which is why the
  // lookup takes a `dsp/key` override before it takes the bare name. The Model
  // D's own dsp/modeld.dsp declares `hslider("glide", 0, 0, 500, 1)` and its
  // comment says "portamento, ms"; the tube and the singer take `glide` in
  // SECONDS off `slideSec`. Same word, three orders of magnitude apart.
  "modeld/glide": "ms",
};
// FIRST HIT WINS, EVEN WHEN IT IS `null` — an override that says "this one has
// no unit" has to beat the bare param name, which `||` cannot express.
function unitOf(dsp, key, param) {
  for (const k of [dsp + "/" + key, dsp + "/" + param, key, param])
    if (Object.prototype.hasOwnProperty.call(UNIT, k)) return UNIT[k];
  return null;
}
/* WHAT A ROW IS CALLED. The param's plain English, and only where plain
   English is not already the param's own name — `nasal` writes `nasal` and the
   row says "the nose" (VOICE.md §3). Anything absent falls back to the recipe
   word itself, which is how 237 rows are nameable without 237 lines here. */
const LABEL = {
  velum: "the nose", fric: "the hiss", fricX: "where the hiss sits",
  voiced: "how much it phonates", open: "how open the glottis is",
  breath: "breath", push: "the fold", artic: "how far the mouth moves",
  babble: "how the mouth moves", rate: "how fast the mouth moves",
  vowelEvery: "how long it stays on one sound", vowels: "what the sounds are",
  seed: "which sentence it says", tongue: "the tongue",
  tongueD: "how far the tongue reaches", tongueL: "how long the tongue is",
  lips: "the lips", voice: "who is singing", vowel: "the vowel",
  cutoff: "the mic and the room", vibrato: "vibrato",
  vibRate: "how fast the vibrato is", vibRise: "how late the vibrato starts",
  oscMix: "the two oscillators", sub: "the sub", subLevel: "the sub",
  sawLevel: "the saw", pulseLevel: "the pulse", noiseLevel: "the noise",
  spread: "how wide", width: "how wide", ensemble: "the ensemble",
  chorus: "the chorus", leslie: "the leslie", perc: "the percussive tap",
  drive: "how hard it is driven", leak: "the drawbar leak",
  click: "the key click", keytrack: "how far the filter follows the key",
  envmod: "how far the envelope opens the filter",
  fenvAmount: "how far the envelope opens the filter",
  envAmount: "how far the envelope opens the filter",
  resonance: "resonance", res: "resonance",
  wobbleBars: "how often it wobbles", wobbleHz: "how often it wobbles",
  /* THE DRAWBARS, IN THE HAMMOND'S OWN VOCABULARY. Nine harmonics named by
     ORGAN PIPE LENGTH — the sub-octave, the fifth above it, the note itself,
     the octave, the twelfth, the fifteenth and the three mutations on top —
     which is the only naming under which "888000000" means anything. `bar513`
     is 5 1/3', spelled in the source the way a filename can be. */
  bar16: "16' — the sub-octave", bar513: "5 1/3' — the fifth",
  bar8: "8' — the note", bar4: "4' — the octave",
  bar223: "2 2/3' — the twelfth", bar2: "2' — the fifteenth",
  bar135: "1 3/5' — the seventeenth", bar113: "1 1/3' — the nineteenth",
  bar1: "1' — the twenty-second",
  // …and the rest of the plain English, one line per word the fleet uses.
  // A row with no entry says its own key, which is the right answer for
  // `attack`, `release`, `decay`, `sustain`, `vibrato`, `detune` and `glide` —
  // every one of them is already the word a musician uses.
  bright: "how bright", stiff: "how stiff the string is",
  ring: "how long it rings", tone: "the tone",
  pluckPos: "where it is plucked", pickup: "where the pickup is",
  exPos: "where it is struck", tilt: "how the partials tilt",
  wave: "the wave", waveform: "the wave", filterMode: "the filter",
  voices: "how many voices", octave: "the sub-octave",
  chorusRate: "how fast the chorus is", chorusDepth: "how deep the chorus is",
  scan: "where the wavetable is scanned", scanEnv: "how far the envelope scans",
  scanLfo: "how far the LFO scans", scanRate: "how fast it scans",
  index: "the index", dcwAmount: "how far the wave is distorted",
  dcwAttack: "how fast the distortion arrives", dcwDecay: "how fast it falls away",
  dcwSustain: "where the distortion rests",
  syncRatio: "the sync ratio", syncSweep: "how far the sync sweeps",
  syncDecay: "how fast the sync falls back",
  osc2tune: "the second oscillator", osc2lfo: "the LFO on the second oscillator",
  lfoRate: "how fast the LFO is", lfoToFilter: "the LFO on the filter",
  pmFM: "how much it phase-modulates", pmFilt: "how much it modulates the filter",
  pwmBase: "the pulse width", pwmLfo: "how far the pulse width moves",
  percHarm: "which harmonic the tap is", percDecay: "how fast the tap fades",
  envSustain: "where the filter envelope rests",
  sway: "how the fold drifts", swayRate: "how fast it drifts",
  vowelSway: "how the vowel drifts", fenv: "the filter zap",
  sustain: "where it rests", decay: "how fast it falls to that",
  ratio: "the ratio of the two operators", idx0: "how bright the attack is",
  idx1: "how bright it stays", idxTime: "how fast one becomes the other",
  dx7Preset: "the cartridge",
};

/* ---------- the word alphabets a `set` key may be spelled in -------------
   Three keys in the whole fleet are WORDS, and a numeric slider on a word is a
   silent lie: measured, `voice: "tenor"` gives `params.voice 4`, `"bass"` gives
   1, and `voice: 2` falls through to the default 4 — so a slider from 1 to 5
   would have a dead notch in the middle that nothing reports. Each alphabet is
   TRIED as a sweep like any number; a key only becomes a `word` row if the
   alphabet actually moved something. */
function wordAlphabets(SE) {
  return {
    wave: SE.WAVES.slice(),
    voice: Object.keys(SE.VOICE_TYPE),
    vowels: SE.VOWELS.split(""),
  };
}

/* ---------- the two things a probe compares ------------------------------ */
// EVERY FIELD OF `params`, plus the three non-param places a `set` key is
// measured to reach. Compared as JSON so an array (`vowels`) compares by value.
function shot(u) {
  if (!u) return null;
  const o = {};
  for (const [k, v] of Object.entries(u.params || {})) o["params." + k] = v;
  o.vowels = JSON.stringify(u.vowels || null);
  o.vowelEvery = u.vowelEvery == null ? null : u.vowelEvery;
  o.freqMin = u.freqMin == null ? null : u.freqMin;
  o.freqMax = u.freqMax == null ? null : u.freqMax;
  o.module = u.module || null;
  return o;
}
function moved(a, b) {
  const out = [];
  if (!a || !b) return out;
  for (const k of Object.keys(a)) if (a[k] !== b[k]) out.push(k);
  return out;
}

/* ---------- the source text, read for candidates and brackets only ------- */
function readSource(src) {
  const keys = new Set(), brack = {};
  const add = (k, body) => {
    // AN ARRAY SUBSCRIPT IS NOT A BOUND. `mp("fenvAmount", 0, fm.amt[1],
    // fm.amt[2])` reads its range out of a table, and a scan that took the last
    // two numerals published a filter-envelope slider that ran from 1 to 2.
    body = body.replace(/\[\s*\d+\s*\]/g, "[]");
    if (/\[\]/.test(body)) return;
    const nums = [...body.matchAll(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g)].map((x) => +x[0]);
    if (nums.length < 2) return;
    const hi = nums[nums.length - 1], lo = nums[nums.length - 2];
    if (hi > lo) (brack[k] = brack[k] || []).push([lo, hi]);
  };
  // THE THREE SPELLINGS OF "A RECIPE KEY WITH A RANGE", all three of which the
  // parent uses and the third of which is the one that bit: `vowelEvery` is
  // `clamp(m.vowelEvery || 0.5, 0.25, 8)` and has no `mp()` anywhere, so a
  // scan that only knew `mp()` handed the sweep a 0..1 bracket and published a
  // syllable slider that stopped at one beat.
  for (const m of src.matchAll(/\bmp\(\s*"([A-Za-z_$][\w$]*)"\s*,([^;]{0,200}?)\)\s*[,}\n]/g)) {
    keys.add(m[1]); add(m[1], m[2]);
  }
  for (const m of src.matchAll(/\bclamp\(\s*m\.([A-Za-z_$][\w$]*)\s*(?:\|\|[^,]{0,40})?,([^;()]{0,60}?)\)/g)) {
    keys.add(m[1]); add(m[1], m[2]);
  }
  for (const m of src.matchAll(/\bclamp\(\s*m\.([A-Za-z_$][\w$]*)\s*!=\s*null\s*\?[^,]{0,60},([^;()]{0,60}?)\)/g)) {
    keys.add(m[1]); add(m[1], m[2]);
  }
  for (const m of src.matchAll(/\bm\.([A-Za-z_$][\w$]*)/g)) keys.add(m[1]);
  return { keys: [...keys], brack };
}
function metaOf(module) {
  const p = path.join(ROOT, "engine/faust/dist", module + "-meta.json");
  if (!fs.existsSync(p)) return {};
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  const out = {};
  const walk = (u) => {
    if (!u) return;
    if (Array.isArray(u.items)) u.items.forEach(walk);
    else if (u.label && u.min != null && u.max != null)
      out[u.label] = { min: +u.min, max: +u.max, init: +u.init, step: +u.step };
  };
  (j.ui || []).forEach(walk);
  return out;
}

/* ---------- THE SWEEP, which is where a row's min and max come from ------
   A bracket is a guess; the row's range is what is left after the dead travel
   is trimmed off both ends. Thirty-three points across the bracket, then the
   outermost pair at which anything still moves, widened by one step so an end
   value is reachable. A bracket that moves nothing anywhere is not a row. */
const N = 65;
function sweep(probe, lo, hi) {
  const at = (v) => JSON.stringify(probe(v));
  const xs = [], ys = [];
  for (let i = 0; i < N; i++) {
    const v = lo + (hi - lo) * (i / (N - 1));
    xs.push(v); ys.push(at(v));
  }
  let i = 0, j = N - 1;
  while (i < N - 1 && ys[i + 1] === ys[0]) i++;          // dead travel at the bottom
  while (j > 0 && ys[j - 1] === ys[N - 1]) j--;          // …and at the top
  if (i >= j) return null;                               // flat: nothing moves
  // …AND THEN TIGHTEN THE TWO ENDS, because a 65-point sweep of a cutoff
  // bracket is 250 Hz a step and an end published a quarter of a kilohertz
  // inside the module's real edge is a slider that cannot reach its own top.
  // Twelve bisections is the bracket width over four thousand.
  const edge = (dead, live) => {
    const y = at(dead);
    for (let k = 0; k < 12; k++) {
      const mid = (dead + live) / 2;
      if (at(mid) === y) dead = mid; else live = mid;
    }
    return dead;
  };
  const a = i > 0 ? edge(xs[i - 1] === undefined ? xs[0] : xs[i], xs[i + 1]) : xs[0];
  const b = j < N - 1 ? edge(xs[j], xs[j - 1]) : xs[N - 1];
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

// ONTO THE SLIDER'S OWN GRID — `min + k*step` and nothing between, so the
// number the row prints is a number the thumb can actually stand on.
const snap = (v, lo, step) => lo + Math.round((v - lo) / step) * step;
function round(v, step) {
  if (!isFinite(v)) return v;
  const d = step >= 1 ? 0 : Math.min(6, Math.max(0, Math.ceil(-Math.log10(step)) + 1));
  return +v.toFixed(d);
}
/* ---------- A SLIDER MUST BE ABLE TO SHOW THE RECORD'S OWN NUMBER --------
   An <input type=range> snaps to `min + k*step`, so a step that does not
   divide the distance from the floor to the derived value draws a thumb at a
   number the record does not say. Measured before this function was rewritten:
   the chant's cantor says `attack: 0.03` and the row drew 0.031. The ladder is
   NICE NUMBERS ONLY — a step of span/1000 exactly would be 0.0019972 and every
   readout on the page would be noise — and the result is then CHECKED against
   the derived value and refined until it lands. */
const LADDER = [1000, 100, 10, 1, 0.5, 0.1, 0.05, 0.01, 0.005, 0.001, 0.0005, 0.0001, 0.00005, 0.00001];
const onGrid = (v, lo, step) => {
  if (v == null || !isFinite(v)) return true;
  const k = (v - lo) / step;
  return Math.abs(k - Math.round(k)) < 1e-6;
};
/* WHICH ROWS ARE COUNTS IS MEASURED AND NOT GUESSED. This function used to
   answer "a row whose ends and answer are all whole numbers is a count" and it
   was wrong on the most legible control in the fleet: the tract's `artic` runs
   0 to 1 and derives 0, all three whole, so it published a step of ONE — an
   articulation knob with two positions, and the chant's own 0.45 drawn at 0.
   Whether a parameter is a count is something the parent will say if it is
   asked (`intStep`, above: hand it a fraction and see whether a whole number
   comes back), so it is asked. */
function stepFor(lo, hi, derived) {
  const span = Math.abs(hi - lo);
  let step = LADDER.find((x) => x <= span / 500) || 0.00001;
  for (let i = LADDER.indexOf(step); i < LADDER.length; i++) {
    if (onGrid(derived, lo, LADDER[i])) return LADDER[i];
  }
  return 0.00001;
}

/* ---------- THE TWO TABLES THE PAD IS DRAWN ON, READ OUT OF tract.lib ------
   A DEPARTURE FROM THIS FILE'S OWN LAW, ARGUED RATHER THAN SLIPPED IN. The
   banner above says "the extraction is a MEASUREMENT, not a parse", and that
   law is about not believing the source text about what a key DOES — a probe
   settles that, and it settles it better than a parser (`modeld 0/17`). This
   is a different question and no probe can answer it: `vowel` is crossfaded
   against the four tongue knobs INSIDE THE COMPILED MODULE
   (tract_voice.dsp:104), so `voiceUnit` never sees a vowel's tongue position
   and there is nothing to ask.

   WHY THE NUMBERS ARE NEEDED AT ALL. The pad in ui/eight.js plots your tongue
   against the VOWEL'S, because that is the whole reading of `artic`: at 0 the
   vowel owns the tongue and your handle does nothing, which is what Paul
   reported as "the tongue doesn't work" (2026-08-26). A picture that could not
   draw the vowel's own point could not draw the gate, and typing twenty
   numbers into a view module is the by-hand copy this codebase forbids —
   tract.lib is their one owner and `--check` now fails if it moves them.

   THE CONSONANTS COME TOO, and for a reason that is exactly as load-bearing:
   `ktBabble` walks from a consonant articulation to a vowel's on a smoothstep
   (tract.lib:363-367), and both coordinates move together on the same `m`, so
   the set of tongue positions the driver can reach is EXACTLY the union of the
   segments between each tongue-owning consonant and each vowel. `ktConOt` is
   which consonants those are — a labial does not move the tongue. That union
   is drawable, and drawing it is how `babble` says "the driver has this
   territory and you do not" instead of the page saying it in a sentence
   nobody reads. */
const TRACTLIB = "engine/faust/dsp/tract.lib";
function tractTables() {
  const src = fs.readFileSync(path.join(ROOT, TRACTLIB), "utf8");
  const list = (name) => {
    const m = src.match(new RegExp(
      name + "\\((\\w)\\) = \\1 : ba\\.listInterp\\(\\(([^)]*)\\)\\)"));
    if (!m) throw new Error(TRACTLIB + ": no listInterp for " + name);
    return m[2].split(",").map((s) => {
      const v = Number(s.trim());
      if (!Number.isFinite(v)) throw new Error(TRACTLIB + ": " + name + " has a non-number");
      return v;
    });
  };
  // THE CONSONANTS' NAMES ARE READ TOO, off the line the table documents
  // itself with ("0 /b/  1 /d/  2 /g/ …"), because a picture that labels a
  // closure has to call it something and eight letters typed here would be
  // eight letters that can go out of order with the table under them.
  const nm = src.match(/^\/\/\s+((?:\d \/\w\/\s*)+)$/m);
  if (!nm) throw new Error(TRACTLIB + ": no consonant name line");
  const names = [...nm[1].matchAll(/\/(\w)\//g)].map((m) => m[1]);
  const vowel = { tp: list("ktVowTp"), td: list("ktVowTd"),
                  tl: list("ktVowTl"), lp: list("ktVowLp") };
  const con = { pl: list("ktConPl"), di: list("ktConDi"), ot: list("ktConOt") };
  // THE ORDER IS THE VOWEL TRIANGLE, i-e-a-o-u (tract.lib), and it is NOT the
  // order a document writes a vowel in — the letters a record says are remapped
  // by TRACT_ROW. The row's own `rowOf` is the map and it is measured; this
  // list is only what row 0 through row 4 SOUND like, so a point can be labelled.
  const vowels = ["i", "e", "a", "o", "u"];
  for (const k in vowel) if (vowel[k].length !== 5)
    throw new Error(TRACTLIB + ": ktVow" + k + " is not five vowels");
  for (const k in con) if (con[k].length !== names.length)
    throw new Error(TRACTLIB + ": ktCon" + k + " and the name line disagree");
  return { from: TRACTLIB, vowels, vowel, con: { name: names, ...con } };
}

async function build() {
  const SE = require(path.join(ROOT, "engine/faust/voices/state-engine.js"));
  const TE = await import("file://" + path.join(ROOT, "nukernel/audio/to-engine.js"));
  const src = fs.readFileSync(path.join(ROOT, "engine/faust/voices/state-engine.js"), "utf8");
  const { keys: PARENTKEYS, brack } = readSource(src);
  const ALPHA = wordAlphabets(SE);
  const STATE = { bpm: 120, seed: 1 };
  const voices = {}, census = {};
  let total = 0;

  for (const dsp of TE.SYNTH_NAMES()) {
    const S = TE.SYNTH_OF(dsp);
    const role = S.role || "melody";
    const probe = (set) => { try { return TE.voiceUnit(dsp, set, STATE, role); } catch (e) { return null; } };
    const base = probe({});
    if (!base) continue;
    const b0 = shot(base);
    const module = base.module;
    const meta = metaOf(module);
    // the rename table's TARGETS are not candidates: writing `spread` on a
    // supersaw reaches the same param `detune` does, and two document keys for
    // one param is the two-owners bug in miniature.
    const targets = new Set(Object.values(S.rename || {}));
    // …and on a DX7 the three cartridge keys are spoken for by the preset menu
    // below: `dx7Alg` alone moves the module and would draw as a bare number
    // from 1 to 32, which is an algorithm nobody can hear the name of.
    if (base.dx7) { targets.add("dx7Alg"); targets.add("dx7Preset"); targets.add("dx7"); }
    const cand = [...new Set([...Object.keys(meta), ...PARENTKEYS,
      ...Object.keys(S.rename || {}), "vowels", "vowelEvery", "voice"])]
      .filter((k) => !OWNED.has(k) && !targets.has(k));

    let rows = [];
    /* ---------- 114 CARTRIDGES, WHICH ARE THE EDITOR FOR A DX7 ------------
       Why the module's own sliders cannot be rows, so nobody tries: the
       generic writer addresses a param as `"/" + root + "/" + label`
       (live/stream-renderer.js:83) and the DX7's 147 addresses collapse to 32
       unique last segments — six operators all have an `L1`. Only `dx7Params`,
       with full paths, reaches them, and a page cannot hold those. A PRESET
       MENU IS THE EDITOR FOR A DX7, and 114 is not a small vocabulary.
       Measured like everything else: seat the cartridge, and keep it only if
       the parent came back holding a different module or a different name. */
    if (base.dx7) {
      const bank = JSON.parse(fs.readFileSync(
        path.join(ROOT, "engine/faust/data/dx7-presets.json"), "utf8"));
      const names = Object.keys(bank), patches = [], live = [];
      for (const n of names) {
        const patch = { dx7Preset: n, dx7Alg: bank[n].alg };
        const u = probe(patch);
        if (u && (u.dx7Preset === n)) { live.push(n.trim() || n); patches.push(patch); }
      }
      if (live.length > 1)
        rows.push({ key: "dx7Preset", param: "module", kind: "patch",
          words: live, patches, moves: ["module"], reach: ["module"] });
    }
    for (const k of cand) {
      // WORDS FIRST, because a word key's numeric sweep can move a param by
      // accident (`voice: 2` is a number the parent throws away) and the word
      // sweep is the one that tells the truth.
      let row = null;
      for (const [an, words] of Object.entries(ALPHA)) {
        if (an === "vowels" && k !== "vowels") continue;
        if (an === "voice" && k !== "voice") continue;
        if (an === "wave" && !/^wave$|^waveform$/.test(k)) continue;
        // A WAVE IS A WORD THE DOCUMENT MAY HAVE TO SPELL AS A NUMBER.
        // `synthRecipe` turns `set.wave` into `WAVES[v|0]` for the three rows
        // that declare `waveIndex` — so the words are the same four and the
        // VALUE written is an index. Measured either way, never assumed.
        const vals = (an === "wave" && S.waveIndex && k === "wave")
          ? words.map((_, i) => i) : words;
        const seen = vals.map((v) => JSON.stringify(shot(probe({ [k]: v }))));
        const all = [...new Set(seen)];
        if (all.length < 2) continue;
        // COMPARE TWO WORDS THAT DIFFER, never a word against the base: on a
        // `voice_lead` the last voice type IS the default (tenor), so a probe
        // that diffed the last word against the absent answer found nothing
        // moved and dropped the one control that changes who is singing.
        const i0 = seen.indexOf(all[0]), i1 = seen.indexOf(all[1]);
        const m = moved(shot(probe({ [k]: vals[i0] })), shot(probe({ [k]: vals[i1] })));
        if (!m.length) continue;
        row = { kind: "word", words: words.slice(), values: vals.slice(), moves: m };
        break;
      }
      if (!row) {
        /* ONE BRACKET, THE UNION OF EVERY GUESS, AND THEN TRIMMED. Sweeping
           each guess in turn and taking the first that moved published a
           `vowelEvery` that stopped at 1 beat because 0..1 happened to move it
           — the parent's own `clamp(m.vowelEvery || 0.5, 0.25, 8)` was the
           bracket that mattered and it was third in the list. A union cannot
           be beaten by the order of the list, and the trim takes the clamp
           back off both ends anyway. */
        const pk = (S.rename && S.rename[k]) || k;
        let lo = Infinity, hi = -Infinity;
        const take = (a, b) => { lo = Math.min(lo, a); hi = Math.max(hi, b); };
        for (const [a, b] of (brack[k] || [])) take(a, b);
        if (meta[k]) take(meta[k].min, meta[k].max);
        if (meta[pk]) take(meta[pk].min, meta[pk].max);
        // …AND WHEN NOTHING DECLARES A RANGE, a bracket wide enough to hold
        // every clamp in the parent (the widest is `envAmount` at -4..6) so the
        // trim can find the real edges rather than a guess's edges.
        if (!isFinite(lo)) take(-8, 8);
        const best = sweep((v) => shot(probe({ [k]: v })), lo, hi);
        if (!best) continue;
        const m = moved(shot(probe({ [k]: best.min })), shot(probe({ [k]: best.max })));
        if (!m.length) continue;
        row = { kind: "number", min: best.min, max: best.max, moves: m };
      }
      // WHICH PARAM THIS ROW IS. The first `params.*` it moves, in the parent's
      // own emission order — which is signal order for free, and is why nobody
      // types an order for these tables (VOICE.md §2).
      const pm = row.moves.filter((x) => x.startsWith("params."))
        .map((x) => x.slice(7));
      const param = pm[0] || row.moves[0];
      if (OWNED.has(param)) continue;
      row.key = k; row.param = param;
      row.reach = row.moves;
      rows.push(row);
    }

    /* ---------- ONE OWNER PER PARAM, DECIDED BY WHO WINS --------------
       Two recipe words reaching one parameter is the two-owners bug in
       miniature, and the fleet has four of them: `wobbleBars` and `wobbleHz`
       both land on `wobbleHz`; `fenvAmount`/`fenvAttack`/`fenvDecay` land on
       `envAmount`/`envAttack`/`envDecay` on the models with a native envelope;
       `wave` and `waveform` both land on `waveform` on a 303. Which one is the
       row is not a taste question and it is not parsed: SET BOTH, and keep the
       one the parent actually obeyed. The loser is unreachable while the winner
       is present, which is a control that would silently do nothing. */
    const byParam = new Map();
    for (const r of rows) (byParam.get(r.param) || byParam.set(r.param, []).get(r.param)).push(r);
    const drop = new Set();
    for (const [, group] of byParam) {
      if (group.length < 2) continue;
      // THE TWO KEYS MUST BE SET TO VALUES THAT DISAGREE or the test proves
      // nothing: `bright` and `stiff` both land on `params.bright`, and setting
      // both to 1 gives 1 whoever won.
      // QUARTER POINTS AND NOT THE ENDS. A key's ends are exactly where its
      // clamp collapses, and one pair collapses onto the same two numbers: a
      // wobble at its fastest bar fraction and a wobble at its fastest hertz
      // are both 12 Hz, and at their slowest both 0.1 Hz — so asked at the ends
      // the parent answered the same thing four times and the test learned
      // nothing. A quarter in from each side is inside both clamps.
      const top = (r) => (r.kind === "word" ? r.values[r.values.length - 1]
        : r.min + (r.max - r.min) * 0.25);
      const bot = (r) => (r.kind === "word" ? r.values[0]
        : r.min + (r.max - r.min) * 0.75);
      const J = (o) => JSON.stringify(o);
      let winner = group[0];
      for (let a = 1; a < group.length; a++) {
        const X = winner, Y = group[a];
        const both = J(shot(probe({ [X.key]: top(X), [Y.key]: bot(Y) })));
        const onlyX = J(shot(probe({ [X.key]: top(X) })));
        const onlyY = J(shot(probe({ [Y.key]: bot(Y) })));
        if (both === onlyY && both !== onlyX) winner = Y;
        else if (both === onlyX && both !== onlyY) winner = X;
        else {
          /* THE FIRST ASK CAN COME BACK AMBIGUOUS BY COINCIDENCE, and one pair
             does: a wobble's top bar-fraction and a wobble's bottom hertz are
             the SAME LFO speed, so both keys and either key alone all answered
             0.1 Hz and the test said nothing. Asking the other way round
             separates them — and the tie-break that used to stand here (keep
             the key spelled like the param) got it exactly backwards, seating
             `wobbleHz` when the parent reads `m.wobbleBars != null ? … :
             (m.wobbleHz || 2.4)` and obeys the bar fraction. */
          const b2 = J(shot(probe({ [X.key]: bot(X), [Y.key]: top(Y) })));
          const oX2 = J(shot(probe({ [X.key]: bot(X) })));
          const oY2 = J(shot(probe({ [Y.key]: top(Y) })));
          if (b2 === oY2 && b2 !== oX2) winner = Y;
          else if (b2 !== oY2 && b2 === oX2) winner = X;
          else if (Y.key === Y.param && X.key !== X.param) winner = Y;
        }
      }
      for (const r of group) if (r !== winner) drop.add(r);
    }
    rows = rows.filter((r) => !drop.has(r));

    // THE ORDER IS THE PARENT'S OWN — the order `params` was built in.
    const order = Object.keys(base.params || {});
    const rank = (r) => {
      const i = order.indexOf(r.param);
      return i < 0 ? order.length + 1 : i;
    };
    rows.sort((a, b) => rank(a) - rank(b) || a.key.localeCompare(b.key));

    const out = [], quiet = [];
    for (const r of rows) {
      const why = inertOf(module, r.param) || inertOf(dsp, r.param);
      if (why) { quiet.push({ key: r.key, param: r.param, why }); continue; }
      const floor = FLOOR[dsp + "/" + r.key];
      const ceil = CEILING[dsp + "/" + r.key];
      // THE KEY IS ASKED FIRST AND THE PARAM SECOND, which reads backwards
      // against VOICE.md §3 ("the label comes from the PARAM") and gives the
      // same answer everywhere but one. The rule's PURPOSE is that a row is
      // named for what you hear rather than for how it happens to be spelled —
      // `nasal` has no entry and falls through to `velum`'s "the nose", which
      // is exactly the intended behaviour. The exception is `vowels`, whose
      // param is `vowel`: the param is ONE vowel and the control is the whole
      // WORD, so naming it after the param would be naming it after a fifth of
      // itself.
      const label = LABEL[r.key] || LABEL[r.param] || r.key;
      /* WHAT THE PARENT ANSWERS WITH THE KEY ABSENT — and where it answers
         NOTHING AT ALL, the module's own. The uniform `fenv*` surface is
         written onto the unit only when a recipe asks for it ("fenvAmount
         default 0 = bit-exact off"), so `params.fenvAmount` is simply not
         there on an untouched voice — and a row whose third cell said "—" is a
         row that will not tell you what you are overriding. `dist/*-meta.json`
         `init` IS the answer in that case: it is the number the module starts
         at, declared by the module. */
      const derived = b0["params." + r.param] != null ? b0["params." + r.param]
        : r.key === "vowelEvery" ? b0.vowelEvery
        : r.key === "vowels" ? JSON.parse(b0.vowels)
        : meta[r.param] && meta[r.param].init != null ? meta[r.param].init : null;
      const gate = gateOf(dsp, r.key);
      if (r.kind === "patch") {
        out.push({ key: r.key, param: r.param, label: "the cartridge", kind: "patch",
          words: r.words, patches: r.patches, derived: b0.module });
        continue;
      }
      if (r.kind === "word") {
        /* ---------- THE ROWS ARE SWAPPED, AND THE MAP IS MEASURED ---------
           `voice_lead`/`voice_choir` read CSOUND formant tables indexed
           a-e-i-o-u; `tract_voice` reads tract.lib's, indexed i-e-a-o-u, and
           the parent remaps with TRACT_ROW = [2,1,0,3,4]. So "aeo" is [0,1,3]
           on the singer and [2,1,3] on the tube. A UI THAT WROTE A VOWEL AS A
           NUMBER WOULD SING THE WRONG VOWEL ON ONE OF THE TWO FAMILIES AND
           NOTHING WOULD EVER FAIL. The select's option values are the LETTERS,
           and this map — letter -> the row the parent came back holding — is
           taken by asking, per voice, so the page can print back what a record
           that says nothing is singing. */
        /* …AND WHERE EACH WORD PUTS THE VOICE. `voice` is measured to move
           `freqMin`/`freqMax` as well as `params.voice` — a tenor is 123 to
           494 Hz and a soprano is 247 to 1047 — so it does not only change the
           colour, it RE-FOLDS THE LINE. A menu that did not say so would be a
           menu whose notes moved for no visible reason (VOICE.md §8). */
        const compass = {};
        if (r.moves.some((x) => x === "freqMin" || x === "freqMax"))
          for (let i = 0; i < r.words.length; i++) {
            const u = probe({ [r.key]: (r.values || r.words)[i] });
            if (u && u.freqMin != null)
              compass[r.words[i]] = [Math.round(u.freqMin), Math.round(u.freqMax)];
          }
        const rowOf = {}, seenRow = {};
        if (r.key === "vowels") for (const w of r.words) {
          const u = probe({ vowels: w });
          rowOf[w] = u && u.vowels ? u.vowels[0] : null;
          if (rowOf[w] != null) seenRow[rowOf[w]] = w;
        }
        let derivedWord = r.key === "vowels" && base.vowels
          ? base.vowels.map((n) => seenRow[n] || "?").join("") : null;
        // …AND FOR A PLAIN WORD ROW, WHICH WORD THE RECORD IS ALREADY SAYING.
        // The third cell must print "tenor", not 4: the param is a table INDEX
        // and printing it beside a menu of words is the same silent lie a
        // numeric slider on a word would be.
        if (r.key !== "vowels") {
          const vals = r.values || r.words;
          for (let i = 0; i < vals.length; i++)
            if (JSON.stringify(shot(probe({ [r.key]: vals[i] }))) === JSON.stringify(b0))
              { derivedWord = r.words[i]; break; }
        }
        out.push({ key: r.key, param: r.param, label, kind: r.key === "vowels" ? "vowels" : "word",
          words: r.words, values: r.values, derived, derivedWord, ...(gate ? { gate } : {}),
          ...(r.key === "vowels" ? { rowOf } : {}),
          ...(Object.keys(compass).length ? { compass } : {}) });
      } else {
        /* THE BISECTION LEAVES A MESSY EDGE and a messy edge is a messy grid:
           the singers' `vibRate` floor came back 2.999962, and `min + k*step`
           from there never lands on the module's own 5.4. So both ends are
           snapped INWARD onto the same nice grid the step will use — inward,
           never outward, so a snapped end can never reach past the last value
           the sweep measured as live. */
        let min = r.min, max = r.max;
        if (floor && min < floor[0]) min = floor[0];
        // …and the top comes IN, for taste rather than for audibility: the
        // sweep found the outermost value that still MOVES the parameter,
        // which is not the outermost value anybody would stop on. See CEILING.
        if (ceil && max > ceil[0]) max = ceil[0];
        const q = LADDER.find((x) => x <= Math.abs(max - min) / 500) || 0.00001;
        min = round(Math.ceil(min / q - 1e-9) * q, q);
        max = round(Math.floor(max / q + 1e-9) * q, q);
        /* ---------- THE RECIPE'S NUMBER, NOT THE PARAM'S ------------------
           `min` and `max` are in RECIPE space — the space a `set` key is
           written in — and the derived answer above was read out of `params`,
           which is PARAM space, and on some rows those are not the same
           number. A choir's `cutoff: clamp(Math.min(9000, c * 2.5), 200,
           12000)` answers 5000 when the recipe says nothing, and 5000 is
           outside the 80..3600 the recipe key can reach; a wobble's
           `wobbleBars` is a bar fraction answering an LFO in hertz. Drawing a
           thumb at the param's number would have put it off the end of its own
           slider. So the recipe value that REPRODUCES the derived answer is
           found by asking — the same sweep, read the other way round — and it
           is what the slider seats at and what the third cell prints. */
        const target = derived;
        let derivedAt = null, intStep = false;
        if (typeof target === "number") {
          const val = (v) => { const sh = shot(probe({ [r.key]: v }));
            const x = sh && sh["params." + r.param] != null ? sh["params." + r.param]
              : sh ? sh[r.param] : null;
            return typeof x === "number" ? x : NaN; };
          /* A PARAM THE PARENT ROUNDS IS A COUNT AND ITS SLIDER IS WHOLE.
             `seed` is `Math.round(clamp(m.seed, 0, 4096))`, so the inversion
             found "any value between 0.5 and 1.5" and published a take slider
             with a step of a half and a derived answer of take 0.5. Asked at a
             deliberately non-round point: if the parent hands back a whole
             number where it was given a fraction, the key is a count and its
             own number IS the param's. */
          const probeV = min + (max - min) * 0.3719;
          const rounded = Number.isInteger(val(probeV)) && !Number.isInteger(probeV);
          if (rounded) { derivedAt = target; intStep = true; }
          let bv = null, bd = rounded ? -1 : Infinity;
          for (let i = 0; i <= 128; i++) {
            const v = min + (max - min) * (i / 128), d = Math.abs(val(v) - target);
            if (d < bd) { bd = d; bv = v; }
          }
          if (bv != null) {
            let lo2 = Math.max(min, bv - (max - min) / 128);
            let hi2 = Math.min(max, bv + (max - min) / 128);
            // SIXTY AND NOT TWENTY. A ternary search narrows by two thirds a
            // step, so twenty left the bracket 4.8e-6 wide and `babble`'s own
            // 0.7 came back 0.6999988 and failed its own tolerance — the row
            // then published the PARAM number and called itself unreachable.
            for (let i = 0; i < 60; i++) {
              const m1 = lo2 + (hi2 - lo2) / 3, m2 = hi2 - (hi2 - lo2) / 3;
              if (Math.abs(val(m1) - target) <= Math.abs(val(m2) - target)) hi2 = m2; else lo2 = m1;
            }
            const cand = (lo2 + hi2) / 2;
            if (Math.abs(val(cand) - target) <= Math.abs(target) * 1e-6 + 1e-9) derivedAt = cand;
          }
        }
        const step = intStep ? 1 : stepFor(min, max, derivedAt == null
          ? (typeof derived === "number" ? derived : null)
          : Math.round(derivedAt / 0.00001) * 0.00001);
        // …and the published number is the RECIPE one wherever the parent could
        // be inverted, which is every row but the handful where the derived
        // answer is not reachable from the key at all.
        const shown = derivedAt == null ? derived : snap(derivedAt, min, step);
        /* IS THE RECIPE'S NUMBER THE PARAM'S NUMBER? On most rows it is, and
           the page can read the derived answer straight off `params` at draw
           time — which it MUST for the rows whose derived answer is a function
           of another axis (a mouth's `rate` is two syllables a beat, so it
           moves when the tempo moves). On the rest it is not: a choir's cutoff
           is 2.5x, a wobble's bar fraction is an LFO in hertz. Those rows are
           marked, so the page knows to ask the question the other way round
           rather than printing a param where a recipe belongs. */
        // …compared AFTER the snap, because a ternary search that lands on
        // 0.9999999 where the grid says 1 has found the same number, not a
        // different one.
        const mapped = derivedAt != null &&
          Math.abs(snap(derivedAt, min, step) - derived) > Math.abs(derived) * 1e-6 + 1e-9;
        out.push({ key: r.key, param: r.param, label, kind: "number",
          min: round(min, step), max: round(max, step), step,
          unit: unitOf(dsp, r.key, r.param),
          derived: typeof shown === "number" ? round(shown, step) : shown,
          ...(derivedAt == null && typeof derived === "number"
            // THE ONE HONEST "I CANNOT SEAT THIS": the derived answer is not
            // reachable from this key, so the thumb starts where the key's own
            // range starts and the row says what it is really overriding.
            ? { derivedParam: derived, unreachable: true } : {}),
          ...(mapped ? { mapped: true } : {}),
          ...(floor ? { floorWhy: floor[1] } : {}),
          ...(ceil ? { ceilWhy: ceil[1] } : {}),
          ...(gate ? { gate } : {}) });
      }
    }
    // A MOUTH IS A VOICE THE PARENT HANDS A VOWEL WALK TO, which is a fact the
    // probe can see (`unit.vowels`) rather than a list of three module names
    // somebody has to keep up to date. It is what puts "the mouth" over the
    // table instead of "the instrument".
    // WHAT SEATING THIS VOICE COSTS, against the record's whole voice budget —
    // `unitCost` and `BUDGET` are the parent's own, so the page can say "a DX7
    // voice costs 6.4 of the record's 40 and the two-operator FM beside it
    // costs 0.53" with numbers that cannot go stale. Paul is right that FM is
    // underused and wrong about why: it was never cost, it was that `fm2op`
    // had no name any document could write.
    voices[dsp] = { module, role, mouth: !!base.vowels,
      // WHAT THE SEAT COSTS, not what the module costs. `unitCost` multiplies
      // the module by its POOL — three voices for a lead, two for a bass — and
      // the pool is part of the price: a record's budget is spent on seats.
      // The inserts come off because a pedalboard is the engineer's, not the
      // instrument's, and this number is quoted next to an instrument's name.
      // (VOICE.md §9 quoted COST.fm2op = 0.53 for the FM and the SEATED 9.5
      // for the tract, which are two different measures side by side. One
      // measure, taken the same way for all 27.)
      cost: Math.round(SE.unitCost({ ...base, inserts: [] }) * 100) / 100,
      rows: out, quiet };
    census[dsp] = out.length;
    total += out.length;
  }
  return { voices, census, total, budget: SE.BUDGET, tract: tractTables() };
}

function banner(r) {
  const order = Object.entries(r.census).sort((a, b) => b[1] - a[1]);
  return "// nukernel/knobs.js — GENERATED BY nukernel/knobs-extract.js — DO NOT EDIT.\n" +
    "//\n" +
    "// WHAT A VOICE'S OWN KNOBS ARE. Not typed: MEASURED, by probing the parent's\n" +
    "// `pitchedUnit` at both ends of every candidate key and keeping the ones that\n" +
    "// moved a parameter. Re-derive with `node nukernel/knobs-extract.js`;\n" +
    "// `--check` fails if this file and the engine disagree.\n" +
    "//\n" +
    "//   key      what the document writes into `voice.set`\n" +
    "//   param    what it was measured to move (the LABEL comes from this, the\n" +
    "//            document key from the recipe word — `fenvAmount` moves\n" +
    "//            `envAmount` on a juno60 and `fenvAmount` on a pad_saw)\n" +
    "//   min/max  the outermost values at which the parameter still moves, found\n" +
    "//            by sweeping the parent's own declared bracket and trimming the\n" +
    "//            dead travel off both ends\n" +
    "//   derived  what the parent answers when the key is ABSENT — the number a\n" +
    "//            hand-turned knob is overriding (desk.js:212's dim-vs-lit law)\n" +
    "//   gate     drawn disabled, with `why` printed, when another key has taken\n" +
    "//            it — measured: `artic` is a 10 dB control at babble 0.4 and a\n" +
    "//            0.1 dB one at babble 1\n" +
    "//   quiet    a key that EXISTS and is measured silent. Never a control; the\n" +
    "//            row prints the reason instead, with its number in it.\n" +
    "//\n" +
    "//   tract    the vowel and consonant tables read out of\n" +
    "//            engine/faust/dsp/tract.lib. NOT a probe: `vowel` is crossfaded\n" +
    "//            against the tongue knobs inside the compiled module, so there\n" +
    "//            is nothing for `voiceUnit` to be asked. The pad in ui/eight.js\n" +
    "//            plots your tongue against the vowel's, which is what `artic` IS.\n" +
    "//\n" +
    "// THE CENSUS: " + r.total + " controls across " + Object.keys(r.census).length + " voices —\n" +
    order.map(([k, n]) => "//   " + k + " " + n).join("\n") + "\n";
}

function render(r) {
  return banner(r) +
    '(function (root, factory) {\n' +
    '  "use strict";\n' +
    '  const api = factory();\n' +
    '  if (typeof module !== "undefined" && module.exports) module.exports = api;\n' +
    '  else root.NuKnobs = api;\n' +
    '})(typeof self !== "undefined" ? self : this, function () {\n' +
    '  "use strict";\n' +
    '  return ' + JSON.stringify({ built: new Date().toISOString().slice(0, 10),
      from: "nukernel/knobs-extract.js", total: r.total, budget: r.budget,
      census: r.census, tract: r.tract, voices: r.voices }, null, 2).replace(/\n/g, "\n  ") + ";\n" +
    "});\n";
}

// strip the `built` date before comparing: a regenerate on a later day is not a
// disagreement with the engine, and `--check` is a claim about the ENGINE.
const bare = (s) => s.replace(/"built": "[^"]*"/, '"built": "-"');

build().then((r) => {
  const out = path.join(ROOT, "nukernel/knobs.js");
  const text = render(r);
  const argv = process.argv.slice(2);
  if (argv.includes("--report")) {
    console.log(banner(r));
    return;
  }
  if (argv.includes("--check")) {
    const have = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
    if (bare(have) !== bare(text)) {
      console.error("knobs.js is STALE — the engine and the table disagree. Run: node nukernel/knobs-extract.js");
      process.exit(1);
    }
    console.log("knobs.js OK — " + r.total + " controls across " + Object.keys(r.census).length + " voices");
    return;
  }
  fs.writeFileSync(out, text);
  console.log("wrote nukernel/knobs.js — " + r.total + " controls across " + Object.keys(r.census).length + " voices");
}).catch((e) => { console.error(e); process.exit(1); });
