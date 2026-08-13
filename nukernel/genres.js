// genres.js — the nukernel DATA: one seed phrase and three genre policies.
// Deliberately separate from kernel.js, the way genres-data.js is separate from
// genre-kernel.js, and for the same reason: measured on this kernel the algebra
// is ~40% of the lines and the genre table is the rest. Keeping them in one
// file hides which half is growing.
//
// A genre is FOUR things, and only the first three interpolate:
//   rate/voices/entry/reg   numbers — these blend
//   word(v, section)        which operators are licensed, per voice
//   harmony                 emergent | modal | cycle
//   kit/tone/realize        NOUNS — these snap; a fugue on a 303 is not a fugue
//
// Loads AFTER kernel.js (see kernel-daw.html) — it is written in the operators.
(function (root) {
  "use strict";
  const K = (typeof module !== "undefined" && module.exports)
    ? require("./kernel.js") : root.NuKernel;
  const { rotate, reverse, transpose, invert, complement, excerpt, only, drop } = K;

  // The blues scale — minor pentatonic plus the flat five. The ♭5 is a passing
  // tone, not a chord tone, and it is the whole reason `scale` had to become a
  // genre field instead of a constant in kernel.js.
  const BLUES = [0, 3, 5, 6, 7, 10];

  // MODES — the chord alphabet, offered as a per-section transform. Natural
  // minor is the default; these are the four that change the colour most and
  // still contain enough of the pentatonic that a subject stays in tune.
  const MODES = {
    dorian:   [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
    mixo:     [0, 2, 4, 5, 7, 9, 10],
  };
  const MODELABEL = { dorian: "dorian", phrygian: "phrygian",
                      harmonic: "harmonic", mixo: "mixolydian" };

  // SCALES — the SUBJECT's alphabet, offered per section. Swapping it changes
  // the chromatic width of a phrase without moving a single degree: the contour
  // is identical, the span is not. Width per degree-step is 12 / length, so
  // chromatic is the tightest reading of a phrase and quartal the widest.
  const SCALES = {
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],   // 1.0 semitone / step
    whole:     [0, 2, 4, 6, 8, 10],                       // 2.0
    augmented: [0, 4, 8],                                 // 4.0
    quartal:   [0, 5],                                    // 6.0
  };
  const SCALELABEL = { chromatic: "chromatic", whole: "whole tone",
                       augmented: "augmented", quartal: "quartal" };

  // ---- the seed phrase (16 steps) -----------------------------------------
  const DEFAULT = {
    deg:  [0, 3, 2, 0, 4, 3, 0, 2, 5, 3, 0, 4, 2, 0, 3, 1],
    oct:  [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    gate: [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0],
    vel:  [8, 5, 4, 8, 6, 4, 8, 5, 9, 6, 4, 6, 8, 4, 6, 4],
    inc:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    stk:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    acc:  [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    sld:  [0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0],
  };

  const GENRES = {
    // SIMPLE — the phrase and nothing else. One voice, one bar, no kit, no bass,
    // no harmonic motion, no operator word: the sixteen steps played as written
    // and looped. It is the zero of the genre table, and the useful kind of zero
    // — every other genre is legible as what it ADDS to this.
    simple: {
      // FOUR bars, not one: a per-loop ramp has nothing to accumulate over in a
      // one-bar form, so inc and stk were inert in the one genre people reach
      // for first. Simple is the phrase looping; four loops is the natural unit.
      label: "Simple", rate: 1, bars: 4, voices: 1,
      entry: () => 0, reg: () => 0, realize: () => "line",
      kit: {}, nobass: true, harmony: "modal",
      tone: { wave: "triangle", cut: 3200, q: 0.8, atk: .004, rel: .7, gain: .30, verb: .08 },
      words: ["the phrase, as written"],
      word: () => [],
    },

    // Transform-heavy, staggered entries, no drums. Restatement rate ~0:
    // literal repetition after the exposition is a mistake, so every voice
    // carries a different word. Harmony is never written down — it is computed
    // from how far each voice transposed the subject on entry, which yields
    // i - v - III - iv from four transposition amounts and a nearest-degree
    // lookup. (Known limit: it reads the ENTRY word, so the roots freeze once
    // all voices are in. Expositions genuinely work that way; episodes don't.)
    fugue: {
      label: "Fugue", rate: 1, bars: 4, voices: 4,
      entry: v => v, reg: v => 1 - v, realize: () => "line",
      kit: {}, harmony: "emergent",            // the empty kit IS the genre fact
      tone: { wave: "triangle", cut: 2600, q: 1.1, atk: .012, rel: .9, gain: .28, verb: .18 },
      words: ["subject", "answer @ 5th", "retrograde", "down a 5th"],
      word: (v, s) => [
        [[], [rotate(0)], [invert(4)]][s % 3],
        [[transpose(3)], [transpose(3), reverse()], [invert(4)]][s % 3],
        [[reverse()], [invert(2)], [transpose(3), rotate(2)]][s % 3],
        [[transpose(-3)], [reverse(), transpose(3)], [invert(4)]][s % 3],
      ][v],
    },

    // A sequencer, not a restatement. Voice 0 never varies for the whole track;
    // voice 1 rotates, which is the characteristically acid transformation and
    // the one with no fugal equivalent (cyclic, not reflective). Modal: the 303
    // line is simultaneously melody, bass and the entire harmony.
    acid: {
      label: "Acid house", rate: 1, bars: 4, voices: 2,
      drumkit: "electronic",              // the SAMPLED kit, not a sine and some noise
      entry: v => v, reg: v => -2 + v, realize: () => "line",
      harmony: "modal",
      // THE SIGNATURE-SYNTH LAW, from state-engine.js SIGNATURE_MODELS: a genre
      // whose identity IS a synthesis behaviour is never sampled. Acid is the
      // canonical case — "the whole point of acid house" — because the accent
      // and the slide are filter behaviour, and a sample cannot squelch.
      // The chirp is envmod x resonance: a big envelope amount into a near-self-
      // oscillating filter re-sweeps from scratch on every note, which reads as a
      // bleep rather than a bassline. Saw instead of square, a filter that opens
      // less far and closes slower, and the resonance backed off the edge.
      synth: { dsp: "tb303", root: "tb303", level: 0.85,
               set: { cutoff: 340, resonance: 0.58, envmod: 0.42, decay: 0.78, waveform: 0 } },
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],     // 909, four on the floor
             c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             o: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             h: [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1] },
      ghost: [only("acc", rotate(3))],         // accents alone, against an unrotated gate
      fill: { o: [0,0,1,0, 0,0,1,0, 0,0,1,0, 1,0,1,0],   // bar 4: hats double, clap answers
              c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,1,0] },
      tone: { wave: "sawtooth", cut: 520, q: 11, atk: .004, rel: .75, gain: .30, verb: .06 },
      words: ["subject, unchanged", "rotate(4·section)"],
      word: (v, s) => (v === 0 ? [] : [rotate(4 * s), ...(s % 2 ? [complement("acc")] : [])]),
    },

    // The inverted pipeline: the chord loop is the material and the phrase
    // decorates it. Also the only genre here reaching for the lossy operator —
    // excerpt keeps 8 of 16 steps and cycles them, which is the loop-a-fragment
    // move. Restatement rate is ~1 like acid; what separates them is rate,
    // realization and lossiness, which is why the dial is four numbers not one.
    vaporwave: {
      label: "Vaporwave", rate: .5, bars: 4, voices: 2,
      drumkit: "room",              // the SAMPLED kit, not a sine and some noise
      entry: () => 0, reg: v => (v === 0 ? -1 : 0),
      realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", roots: [3, 4, 2, 5],   // iv v III VI
      // FM, from a real cartridge. "E.PIANO 1" is the DX7 patch vaporwave is
      // actually made of; the pad stays sampled strings because a DX7 node is
      // monophonic and a chord would collapse onto one voice.
      synth: { dsp: "dx7_alg5", root: "DX7", preset: "E.PIANO 1", level: 0.9, lineOnly: true },
      kit: { k: [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],     // lazy, half-time at rate .5
             s: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             h: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0] },
      fill: { s: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0] }, // bar 4: the snare answers itself
      tone: { wave: "sawtooth", cut: 1500, q: 2.2, atk: .05, rel: 1.6, gain: .20, verb: .55 },
      words: ["chords from the harmony", "a moving 8-step window on the phrase"],
      // THE WINDOW MOVES. A fixed excerpt(2,8) looped ONE half-phrase for the
      // whole section — six pitches, eight times over — and threw steps 11..16
      // of the seed away entirely, so writing a melody changed almost nothing.
      // Sliding the window four steps a bar keeps the loop-a-fragment identity
      // that makes it vaporwave while letting the whole phrase through across
      // the section.
      word: (v, s) => [excerpt((s * 4) % 16, 8)],
    },

    // The first genre whose SCALE is not the default, and the first whose form
    // is longer than its loop instinct: twelve bars, I-IV-V, with the turnaround
    // in the last two. Building it settled a question — a "fixed form" is not a
    // fourth harmony mode, it is just a `cycle` whose length is the form. And
    // `swing` is the genuinely new thing: every other operator permutes the
    // grid, swing bends it.
    blues: {
      label: "Blues", rate: 1, bars: 12, voices: 2, swing: 1 / 3,
      drumkit: "jazz",              // the SAMPLED kit, not a sine and some noise
      scale: BLUES,
      entry: v => v * 4, reg: v => -v, realize: () => "line",
      harmony: "cycle", bassStyle: "walk",
      roots: [0,0,0,0, 3,3,0,0, 4,3,0,4],    // twelve bars, I IV V, turnaround
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },   // shuffled by swing
      fill: { s: [0,0,0,0, 1,0,0,0, 0,0,1,0, 1,0,1,0] },  // bar 12: the turnaround
      tone: { wave: "sawtooth", cut: 1100, q: 3.2, atk: .006, rel: .9, gain: .27, verb: .14 },
      words: ["subject", "answer — only(gate, rotate 8)"],
      word: (v, s) => (v === 0 ? [] : [only("gate", rotate(8))]),
    },

    // ROCK. The riff does not develop — restatement rate ~1, like acid — so what
    // carries the genre is the BACKBEAT (snare on 2 and 4, which nothing else
    // here has) and the octave doubling: two voices playing the same subject a
    // register apart, which is a guitar and a bass on one riff. Eight-bar form,
    // i-VII-iv, the modal rock cadence that natural minor already contains, so
    // rock needs no scale and no mode override at all — the first genre added
    // that changes nothing about the alphabets.
    rock: {
      label: "Rock", rate: 1, bars: 8, voices: 2,
      drumkit: "power",              // the SAMPLED kit, not a sine and some noise
      entry: () => 0, reg: v => v - 2, realize: () => "line",
      harmony: "cycle", roots: [0, 0, 6, 6, 3, 3, 0, 0],   // i i VII VII iv iv i i
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],      // the backbeat
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,1,0] },   // bar 8: the turnaround
      tone: { wave: "sawtooth", cut: 1800, q: 1.6, atk: .003, rel: .8, gain: .30, verb: .10 },
      words: ["riff", "riff an octave up, thinned on odd bars"],
      word: (v, s) => (v === 1 && s % 2 ? [drop(2)] : []),
    },
  };

  const DRUMNAME = { k: "Kick", s: "Snare", c: "Clap", o: "Open hat",
                     h: "Hat", p: "Ghost perc" };

  const api = { DEFAULT, GENRES, DRUMNAME, MODES, MODELABEL, SCALES, SCALELABEL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuGenres = api;
})(typeof window !== "undefined" ? window : globalThis);
