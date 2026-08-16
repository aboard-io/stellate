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
// `instr` is one of the nouns: WHICH SAMPLED INSTRUMENT each voice plays, by
// registry id. A string is the whole genre; an ARRAY is read per voice with
// the last entry covering the rest (the Isley Brothers are a Rhodes and a fuzz
// guitar at the same time). It lives here beside kit and tone — instrument is
// genre identity — and instruments.js instrOf() THROWS on a genre without one:
// the old silent piano fallback is exactly how a rotted entry stayed hidden.
// (The choral four want a real recorded voice, and the extraction has two —
// aahs for the sustained music, oohs for the closer, brighter Bulgarian sound.)
//
// Loads AFTER kernel.js (see kernel-daw.html) — it is written in the operators.
(function (root) {
  "use strict";
  const K = (typeof module !== "undefined" && module.exports)
    ? require("./kernel.js") : root.NuKernel;
  const { rotate, reverse, transpose, invert, complement, excerpt, only, drop, fill, del,
          split, spread } = K;

  // The blues scale — minor pentatonic plus the flat five. The ♭5 is a passing
  // tone, not a chord tone, and it is the whole reason `scale` had to become a
  // genre field instead of a constant in kernel.js.
  const BLUES = [0, 3, 5, 6, 7, 10];
  // THE FULL SEVEN. Everything before the choral genres read the subject through
  // a five-note alphabet, which is what made every line leap: pentatonic has no
  // semitone, so there is no such thing as a step in it. Plainchant, counterpoint
  // and a Tallis motet are made almost entirely of steps — the whole grammar is
  // "move by one, leap rarely, resolve the leap by stepping back" — so they read
  // the subject through the mode itself. Same degrees, same contour, a completely
  // different music.
  const DIATONIC = [0, 2, 3, 5, 7, 8, 10];

  // MODES — the chord alphabet, offered as a per-section transform. Natural
  // minor is the default; these are the four that change the colour most and
  // still contain enough of the pentatonic that a subject stays in tune.
  const MODES = {
    dorian:   [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
    mixo:     [0, 2, 4, 5, 7, 9, 10],
    // THE MAJOR SIDE, which simply did not exist: mixolydian was the only
    // bright option and three genres leaned on it as a stand-in. Ionian is
    // major itself — motown, country, gospel, disco, ska, punk and most of the
    // pop canon were unreachable without it. Lydian is major with the raised
    // fourth (the film-score shimmer); melodic minor is the minor that can
    // still make a real dominant AND a major sixth on the way up.
    ionian:   [0, 2, 4, 5, 7, 9, 11],
    lydian:   [0, 2, 4, 6, 7, 9, 11],
    melodic:  [0, 2, 3, 5, 7, 9, 11],
  };
  const MODELABEL = { dorian: "dorian", phrygian: "phrygian",
                      harmonic: "harmonic", mixo: "mixolydian",
                      ionian: "major", lydian: "lydian", melodic: "melodic minor" };

  // SCALES — the SUBJECT's alphabet, offered per section. Swapping it changes
  // the chromatic width of a phrase without moving a single degree: the contour
  // is identical, the span is not. Width per degree-step is 12 / length, so
  // chromatic is the tightest reading of a phrase and quartal the widest.
  const SCALES = {
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],   // 1.0 semitone / step
    whole:     [0, 2, 4, 6, 8, 10],                       // 2.0
    augmented: [0, 4, 8],                                 // 4.0
    quartal:   [0, 5],                                    // 6.0
    // the two MAJOR subject alphabets, for the same reason the modes grew:
    // a subject cannot sing a major third it does not contain. majpent is the
    // consonant one — like the minor pentatonic it buys stretto for free.
    major:     [0, 2, 4, 5, 7, 9, 11],                    // 1.71
    majpent:   [0, 2, 4, 7, 9],                           // 2.4
  };
  const SCALELABEL = { chromatic: "chromatic", whole: "whole tone",
                       augmented: "augmented", quartal: "quartal",
                       major: "major", majpent: "major pent." };

  // ---- NAMED PROGRESSIONS --------------------------------------------------
  // Chord OBJECTS per bar (kernel.js chordsOf: {d, q, inv, borrow, beats}),
  // named so the composer can deal a DIFFERENT one per section role — the
  // thing that makes a chorus harmonically different from a verse. THE LAW for
  // a genre carrying both `prog` and `roots`: the prog's first-chord degrees
  // must equal the roots bar for bar (gated). `roots` stays the skeleton the
  // layers and the emergent machinery read; `prog` is what the pad, the bass
  // and the ramp actually voice. A prog without a genre is inert data — that
  // is the point, it is a vocabulary the arranger quotes by name.
  const PROGS = {
    // the real twelve bars: every chord a dominant seventh, which is the
    // whole difference between a blues and a minor mode loop. Same skeleton
    // as the old roots line, so nothing about the FORM moved.
    blues12: [
      { d: 0, q: "dom7" }, { d: 0, q: "dom7" }, { d: 0, q: "dom7" }, { d: 0, q: "dom7" },
      { d: 3, q: "dom7" }, { d: 3, q: "dom7" }, { d: 0, q: "dom7" }, { d: 0, q: "dom7" },
      { d: 4, q: "dom7" }, { d: 3, q: "dom7" }, { d: 0, q: "dom7" }, { d: 4, q: "dom7" },
    ],
    // soul sevenths — the diatonic "7", so dorian keeps its bright IV7
    soul7: [
      { d: 0, q: "7" }, { d: 0, q: "7" }, { d: 3, q: "7" }, { d: 3, q: "7" },
      { d: 0, q: "7" }, { d: 0, q: "7" }, { d: 4, q: "7" }, { d: 4, q: "7" },
    ],
    // new jack: the jodeci cycle with its sevenths said out loud
    jack7: [{ d: 0, q: "7" }, { d: 3, q: "7" }, { d: 0, q: "7" }, { d: 4, q: "7" }],
    // the beatles verse as written, and a chorus that finally goes to V —
    // the pair exists so a composed song can have two different harmonies
    beatlesV: [{ d: 0 }, { d: 0 }, { d: 6 }, { d: 6 }, { d: 3 }, { d: 3 }, { d: 0 }, { d: 0 }],
    beatlesC: [{ d: 0 }, { d: 0 }, { d: 6 }, { d: 6 }, { d: 3 }, { d: 3 }, { d: 4 }, { d: 0 }],
  };

  // THE SKANK — an absolute gate, written as its own total operator because no
  // palette op can SAY a grid: every existing gate op rearranges or thins the
  // gates the phrase already has, and the offbeat chop must not depend on what
  // those happen to be. offbeats(4) is the reggae upstroke (steps 2 6 10 14);
  // offbeats(2) is the double skank ska plays at speed. Total and pure like
  // every operator: pattern in, pattern out, nothing mutated.
  const offbeats = every => p =>
    ({ ...p, gate: p.gate.map((_, i) => (i % every === every / 2 ? 1 : 0)) });

  // THE BREATH — a gate MASK, and it is its own total operator for exactly the
  // reason the skank is: no operator in the palette can SAY "the singer stops
  // here". drop and del are periodic, rotate and reverse permute, and every one
  // of them is a function of the gates the phrase happens to carry. A breath is
  // an ABSOLUTE window in the bar, it is in the same place every bar, and it
  // must survive being handed a phrase that gated straight through it — so it
  // is an AND with the phrase's own rhythm rather than a rewrite of it. The
  // singer keeps their tune and loses only the air they need.
  //
  // Total, like every operator here: if the mask would silence the bar outright
  // the downbeat comes back, because "pattern in, valid pattern out" has no
  // exception for a phrase that happens to live in the gaps.
  const breath = mask => p => {
    const gate = p.gate.map((g, i) => (mask[i % mask.length] ? g : 0));
    if (!gate.some(Boolean)) gate[0] = 1;
    return { ...p, gate };
  };
  // Two four-beat phrases with air after each: the shape of a sung line, and
  // the same shape compose.js `rhythm` forces onto a topline. Here it is a
  // GENRE fact rather than a composed one, so the vocal breathes whatever
  // phrase it is handed — including a hand-drawn one.
  const SUNG = [1,1,1,1, 1,1,0,0, 1,1,1,1, 0,0,0,0];

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
      instr: "yamaha_grand_piano",
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
      // named "Leipzig 1725" — the subject/answer-at-the-fifth machinery is
      // Bach's, Thomaskantor at Leipzig by then.
      label: "Leipzig 1725", rate: 1, bars: 4, voices: 4,
      instr: "rock_organ",
      entry: v => v, reg: v => 1 - v, realize: () => "line",
      kit: {}, harmony: "emergent",            // the empty kit IS the genre fact
      // `intro` is the anchor's OPENING STATEMENT — read by the composer
      // (compose.js introSections), where it wins the chooser's coin a little
      // over half the time. Declared only where identity demands it: a fugue
      // that does not begin with the subject alone is not a fugue. Absent =
      // the family's own leaning, exactly as before the field existed.
      intro: "solo",
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
      // named "Chicago 1987" — Phuture's Acid Tracks: the 303 squelch this
      // anchor's signature-synth law exists for.
      label: "Chicago 1987", rate: 1, bars: 4, voices: 2,
      instr: "clean_guitar",
      // the kit vector below has always said "909, four on the floor" — now
      // the SOUND is the machine it names (synthesized, audio/machines.js)
      drumkit: "tr909",
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

    // NEW WAVE — the Buggles and the Cars, which is a different record from the
    // one this used to be. It was in DORIAN, i-VI-iv-v: moody, minor, closer to
    // post-punk than to "Video Killed the Radio Star". But the thing about that
    // music is that it is BRIGHT and it is CLIPPED — a major key, a staccato
    // eighth-note riff with no sustain in it at all, handclaps on the backbeat,
    // and a bass playing straight eighths underneath like a machine. Mixolydian
    // gives it the ♭VII that both bands lean on, and `diatonic` keeps the whole
    // thing in one key, which is what separates a pop record from a mode.
    // I - V - vi - IV, and the second voice answers a bar late and thinned.
    newwave: {
      // named "London 1979" for the Buggles (the comment's first reference and
      // the CR-78 preset-box year); Boston 1978 would have honoured the Cars.
      label: "London 1979", rate: 1, bars: 4, voices: 2,
      instr: ["clean_guitar", "synth_strings_1"],
      entry: v => v, reg: v => v - 1, realize: () => "line",
      harmony: "cycle", roots: [0, 4, 5, 3],     // I V vi IV
      mode: MODES.mixo, scale: MODES.mixo, diatonic: true,
      artic: "staccato",                         // no sustain anywhere
      drumkit: "cr78",             // 1979's preset box — the machine of the era
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],   // claps doubling the snare
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 0,0,1,0, 1,0,1,0] },
      bassStyle: "eighths",
      tone: { wave: "sawtooth", cut: 2600, q: 2.4, atk: .003, rel: .35, gain: .28, verb: .14 },
      words: ["the hook, clipped", "the answer, a bar late and thinned"],
      word: (v, s2) => (v === 0 ? [] : [only("gate", rotate(4)), drop(3)]),
    },

    // The inverted pipeline: the chord loop is the material and the phrase
    // decorates it. Also the only genre here reaching for the lossy operator —
    // excerpt keeps 8 of 16 steps and cycles them, which is the loop-a-fragment
    // move. Restatement rate is ~1 like acid; what separates them is rate,
    // realization and lossiness, which is why the dial is four numbers not one.
    vaporwave: {
      // named "Portland 2011" — Vektroid's Floral Shoppe: the slowed record
      // with the DX7 E.PIANO 1 this anchor literally loads.
      label: "Portland 2011", rate: .5, bars: 4, voices: 2,
      instr: "strings",
      drumkit: "room",              // the SAMPLED kit, not a sine and some noise
      // BOTH VOICES SIT LOW. The pad was always down here; the melody was an
      // octave above it, up where the DX7's declared freq ceiling (1000 Hz) is
      // close enough to matter and where a slowed-down sample stops sounding
      // slowed down. Vaporwave is a record playing at the wrong speed, and the
      // wrong speed is DOWN — the line belongs under the pad's top, not over it.
      entry: () => 0, reg: () => -1,
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
      // named "Chicago 1952" not the Delta — the anchor is a BAND: jazz kit,
      // ride shuffle, walking bass. That is Chess-era electric blues.
      label: "Chicago 1952", rate: 1, bars: 12, voices: 2, swing: 1 / 3,
      instr: "steel_string_guitar",
      drumkit: "jazz",              // the SAMPLED kit, not a sine and some noise
      scale: BLUES,
      entry: v => v * 4, reg: v => -v, realize: () => "line",
      harmony: "cycle", bassStyle: "walk",
      roots: [0,0,0,0, 3,3,0,0, 4,3,0,4],    // twelve bars, I IV V, turnaround
      // THE SEVENTHS. A blues where every chord is a dominant seventh is not a
      // decoration, it is the identity — the minor-pentatonic riff over an I7
      // with its major third is the clash the whole music is built on. The
      // walk sounds the ♭7 on the odd bars and the ramp can land on it.
      prog: PROGS.blues12,
      maxHold: 4,                             // a riff answers itself; it has to stop
      // THE RIDE, not the hats. A shuffle on a jazz kit is a stick on a ride
      // cymbal and a left foot closing the hat on 2 and 4 — that pairing is
      // most of what "sounds like a blues band" means, and neither lane
      // existed to write until the kit grew to twelve. The kick and snare are
      // untouched: the groove did not change, the metal did.
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             r: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],     // shuffled by swing
             f: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0] },   // the left foot
      // A HAND, NOT A GRID. Nothing else in the table moves off the grid at
      // all; a blues band is the one place where that reads as wrong rather
      // than as tight. Five hundredths of a step, redrawn every bar, seeded —
      // the same take every time you press play.
      humanize: 0.05,
      // ...and the turnaround gets the tom the twelfth bar has always had
      fill: { s: [0,0,0,0, 1,0,0,0, 0,0,1,0, 0,0,0,0],    // bar 12: the turnaround
              m: [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
              l: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0],
              x: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,8] },
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
      // named "London 1969" — a riff doubled at the octave (guitar+bass as one
      // line) over a backbeat and a tom-fill turnaround is Led Zeppelin's move.
      label: "London 1969", rate: 1, bars: 8, voices: 2,
      instr: "crunch_guitar",
      drumkit: "power",              // the SAMPLED kit, not a sine and some noise
      entry: () => 0, reg: v => v - 2, realize: () => "line",
      harmony: "cycle", roots: [0, 0, 6, 6, 3, 3, 0, 0],   // i i VII VII iv iv i i
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],      // the backbeat
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      // BAR 8 IS A TOM FILL AND A CRASH, which is what a rock drummer plays
      // there and what the six-lane kit could not say: the snare rolls, the
      // hand comes off the hats and down the toms, and the cymbal lands on the
      // last sixteenth to hand the loop back to bar 1.
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,0,0, 0,0,0,0],     // bar 8: the turnaround
              t: [0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
              m: [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
              l: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0],
              h: [1,0,1,0, 1,0,1,0, 1,0,0,0, 0,0,0,0],
              x: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,9] },
      tone: { wave: "sawtooth", cut: 1800, q: 1.6, atk: .003, rel: .8, gain: .30, verb: .10 },
      words: ["riff", "riff an octave up, thinned on odd bars"],
      word: (v, s) => (v === 1 && s % 2 ? [drop(2)] : []),
    },

    // ---- THE VOICES ------------------------------------------------------
    // Four genres that are all one thing — people singing, unaccompanied — and
    // are nonetheless four completely different pieces of machinery. Putting
    // them next to each other is the argument: the kernel's "genre" is a policy
    // about voices, entries and alphabets, and if that is true then chant and a
    // forty-part motet should be reachable from the same four numbers as acid
    // house. They are.

    // GREGORIAN. One line, doubled at the octave (the men-and-boys doubling every
    // schola has always used), free-flowing, no pulse to speak of and no harmony
    // at all — `modal`, which here means what it means in chant: one mode, no
    // motion, the whole piece is the melody. It is the emptiest genre in the
    // table and it is not the same emptiness as Simple: Simple has nothing
    // because it is a zero, this has nothing because everything was taken away.
    gregorian: {
      // named "Rome 600" for the name's own claim — Gregory's Rome and its
      // schola cantorum; the Frankish codification (~800, Metz) came later.
      label: "Rome 600", rate: 0.5, bars: 4, voices: 2,
      instr: "ahh_choir",
      entry: () => 0, reg: v => -v, realize: () => "line",
      kit: {}, nobass: true, harmony: "modal",
      intro: "solo",                 // chant begins as one voice, always
      mode: MODES.dorian, scale: DIATONIC,
      artic: "legato", incClamp: 2,
      tone: { wave: "triangle", cut: 2100, q: 0.7, atk: .09, rel: 2.2, gain: .26, verb: .78 },
      words: ["the chant", "the same line an octave below"],
      word: () => [],
    },

    // BULGARIAN. Le Mystère des Voix Bulgares, and the two things that make it
    // unmistakable are both cheap to say here. The first is the SECOND: the
    // upper voice sings a step above the melody and stays there — a dissonance
    // held as if it were a consonance, which is the sound. The second is the
    // LIMP: a kick on 1, 8 and 15 divides sixteen steps as 7+7+2, so the bar
    // never sits down where you expect. Underneath both, a pedal — the ison,
    // the drone the whole tradition is built over.
    bulgarian: {
      // named "Sofia 1975" — Le Mystère des Voix Bulgares (the comment's own
      // reference) is the Sofia state radio choir, first issued 1975.
      label: "Sofia 1975", rate: 1, bars: 4, voices: 2,
      instr: "ohh_voices",
      drumkit: "acoustic",
      entry: () => 0, reg: v => v, realize: () => "line",
      harmony: "modal", mode: MODES.phrygian, scale: DIATONIC,
      bassStyle: "pedal",
      bassGrid: [1,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,1,0],
      kit: { k: [1,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,1,0],
             p: [0,0,1,0, 1,0,0,0, 0,1,0,1, 0,0,0,1] },
      artic: "legato",
      tone: { wave: "sawtooth", cut: 2600, q: 1.4, atk: .03, rel: 1.1, gain: .26, verb: .5 },
      words: ["the melody", "a second above it, and staying there"],
      word: v => (v === 0 ? [] : [transpose(1)]),
    },

    // SPEM IN ALIUM — Tallis, forty voices in eight choirs, and the thing it is
    // famous for is not the counterpoint, it is the ARCHITECTURE: the entries
    // sweep around the room, choir by choir, and the piece is the wave rather
    // than any line in it. That is `entry: v => v` with eight voices and eight
    // bars, which is the fugue's own mechanism turned up until it stops being
    // imitation and becomes weather. Forty voices would be forty sampled choirs
    // and a dead browser; eight is one per choir, which is the structural unit
    // anyway. Harmony is emergent — nobody wrote the chords down, they are what
    // happens when eight transpositions of one line arrive on top of each other.
    spem: {
      // named "London 1570" — Tallis at the Chapel Royal; the forty-part motet
      // premiered in the Arundel/Nonsuch orbit around 1570.
      label: "London 1570", rate: 0.5, bars: 8, voices: 8,
      instr: "ahh_choir",
      entry: v => v, reg: v => (v % 4) - 1, realize: () => "line",
      kit: {}, nobass: true, harmony: "emergent",
      mode: MODES.dorian, scale: DIATONIC, artic: "legato",
      tone: { wave: "triangle", cut: 2400, q: 0.8, atk: .07, rel: 2.6, gain: .17, verb: .85 },
      words: ["choir 1", "choir 2", "choir 3", "choir 4",
              "choir 5", "choir 6", "choir 7", "choir 8"],
      word: (v, s) => [transpose([0, 4, 2, -3, 3, -2, 5, 1][v % 8]),
                       ...(s % 2 ? [rotate(2)] : [])],
    },

    // COUNTERPOINT — the species exercise, and deliberately NOT the fugue. A
    // fugue is four voices, staggered, each with its own word; this is two
    // voices that start together and are locked in CONTRARY MOTION for the whole
    // piece: where one rises the other falls, because that is what invert(4)
    // means. It is the smallest complete statement of the idea the fugue then
    // elaborates, and having both makes the difference legible.
    counterpoint: {
      // named "Vienna 1725" — Fux's Gradus ad Parnassum, the species exercise
      // this anchor implements, published in Vienna that year.
      label: "Vienna 1725", rate: 1, bars: 4, voices: 2,
      instr: "harpsichord",
      entry: () => 0, reg: v => 1 - v, realize: () => "line",
      kit: {}, nobass: true, harmony: "emergent",
      intro: "solo",                 // the cantus states itself before anything
      scale: DIATONIC, artic: "legato",
      tone: { wave: "square", cut: 2800, q: 1.0, atk: .006, rel: .6, gain: .22, verb: .3 },
      words: ["the line", "contrary motion — every rise is a fall"],
      // THE AXIS IS THE HARMONY. Both voices play the same rhythm, so every
      // note is a simultaneity and the vertical interval is decided entirely by
      // where the mirror is: invert(c) sends degree d to c-d, so the two voices
      // SUM to a constant and the interval is a function of that sum alone.
      // Measured over the composed banks, sums 2, 3 and 6 (mod 7) are the three
      // that put a semitone or a tritone on a common degree — and the old word,
      // invert(4) with transpose ±2, used sums 6 and 2, which is the worst axis
      // in the scale and the second worst. Sum 6 alone contributes two tritones
      // and a minor seventh on the tonic degree; what that sounds like is two
      // harpsichords out of tune with each other.
      //
      // Mirror about the third (sum 5) and about the tonic (sum 0) instead. The
      // alternation survives — it is what makes bar two a different bar — and
      // the piece is now 35% thirds and sixths with no unprepared clash at all,
      // which is what first-species contrary motion is supposed to sound like.
      // Written as two inversions rather than an inversion plus a transpose
      // because the sum is the only thing that was ever doing any work.
      word: (v, s) => (v === 0 ? [] : [invert(s % 2 ? 0 : 5)]),
    },

    // ---- THE SLOW ONES ---------------------------------------------------

    // NEOCLASSICAL. Sustained strings holding one chord a bar while a piano
    // figure turns over them, and a second piano an octave up that does not
    // arrive until bar 5 — the entry IS the arrangement, and it is the only
    // gesture the style really has. Eight bars of i-VI-III-VII, two bars each,
    // because the whole point is that the progression is slower than the figure.
    neoclassical: {
      // named "Berlin 2011" — Nils Frahm's Felt: the anchor's instrument IS
      // felt_piano, and that record is Berlin, 2011.
      label: "Berlin 2011", rate: 1, bars: 8, voices: 3,
      instr: "felt_piano",
      entry: v => (v === 2 ? 4 : 0), reg: v => (v === 0 ? -1 : v - 1),
      realize: v => (v === 0 ? "pad" : "line"),
      kit: {}, harmony: "cycle", roots: [0,0, 5,5, 2,2, 6,6],
      scale: DIATONIC, diatonic: true, artic: "legato",
      bassGrid: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      tone: { wave: "triangle", cut: 2600, q: 0.8, atk: .02, rel: 1.4, gain: .24, verb: .52 },
      words: ["strings, one chord a bar", "the piano figure",
              "the figure again, higher, from bar 5"],
      word: v => (v === 2 ? [transpose(2)] : []),
      fx: ["chorus"],
    },

    // DRONE. The genre that is a refusal: rate 0.25, so one loop of the phrase
    // takes four bars, `tie` so consecutive same-pitch notes fuse into one long
    // one, a pedal bass that never leaves the tonic, and a reverb you could lose
    // a coat in. The line is there — thinned to half its notes — precisely so
    // that it is not a pad-only genre: something has to move or there is nothing
    // to listen TO, and the ramp (clamped, reversing) is what moves it.
    drone: {
      // named "New York 1964" — La Monte Young's Theatre of Eternal Music:
      // strings holding tones over a pedal that never moves.
      label: "New York 1964", rate: 0.25, bars: 4, voices: 2,
      instr: "slow_strings",
      entry: () => 0, reg: v => v - 2, realize: v => (v === 0 ? "pad" : "line"),
      kit: {}, harmony: "modal", mode: MODES.dorian, scale: DIATONIC,
      intro: "padin",                // the drone IS the pad; it goes first
      artic: "tie", incClamp: 3, incMode: "reverse",
      bassStyle: "pedal", bassGrid: [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      tone: { wave: "sawtooth", cut: 900, q: 1.8, atk: .35, rel: 3.2, gain: .22, verb: .9 },
      words: ["the drone", "a line that barely moves"],
      word: v => (v === 1 ? [drop(2)] : []),
      fx: ["sweep"],
    },

    // SLUDGE. Half the speed of everything else, tuned into the floor (reg -3
    // and -2), and the progression is two chords: i and ♭II. That flat second is
    // the whole genre — it is why the mode is phrygian, because phrygian is the
    // only mode that contains it, and a doom riff walking up a semitone and
    // stopping there is a thing nothing else in this table can say. It ships
    // with `crunch` already on: a sampled guitar played clean is not sludge, and
    // the insert chain exists now, so the genre may as well ask for it.
    sludge: {
      // named "New Orleans 1991" — the half-speed phrygian ♭II riff under
      // crunch is NOLA sludge (Eyehategod/Crowbar), not Birmingham doom.
      label: "New Orleans 1991", rate: 0.5, bars: 8, voices: 2,
      instr: "overdrive_guitar",
      drumkit: "power",
      entry: () => 0, reg: v => v - 3, realize: () => "line",
      harmony: "cycle", mode: MODES.phrygian, roots: [0,0,0,0, 1,1,0,0],
      bassStyle: "octaves",
      kit: { k: [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             h: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0] },
      fill: { s: [0,0,0,0, 0,0,0,0, 1,0,0,0, 1,0,1,0] },
      tone: { wave: "sawtooth", cut: 900, q: 2.2, atk: .004, rel: 1.2, gain: .3, verb: .25 },
      words: ["the riff", "the riff an octave under, thinned"],
      word: v => (v === 1 ? [drop(2)] : []),
      fx: ["crunch"],
    },

    // TANGO. Two facts and the rest follows. The first is the RHYTHM: 3-3-2,
    // sixteen steps divided 0-3-6 / 8-11-14, which is the habanera underneath
    // every tango ever written and is the reason it limps forward instead of
    // marching. The second is the HARMONIC MINOR — the raised seventh, which is
    // the only note in the scale that can produce a real dominant, and a tango
    // is a series of dominants arriving. i · iv · V · i, and the V is a V and
    // not a v precisely because of that one note.
    // A bandoneón and a violin, which the per-voice INSTR table can finally say.
    tango: {
      // named "Buenos Aires 1935" — the golden age's dance-hall orquestas
      // (D'Arienzo's rise): bandoneón, violin, the habanera driving.
      label: "Buenos Aires 1935", rate: 1, bars: 4, voices: 3,
      instr: ["bandoneon", "violin", "bandoneon"],
      entry: v => (v === 2 ? 2 : 0), reg: v => (v === 1 ? 1 : v - 1),
      realize: v => (v === 0 ? "pad" : "line"),
      drumkit: "acoustic",
      harmony: "cycle", roots: [0, 3, 4, 0],
      mode: MODES.harmonic, scale: [0, 2, 3, 5, 7, 8, 11], diatonic: true,
      // THE DOMINANT IS THE ONE CHORD WHOSE SCALE IS NOT THE TONIC'S, and a
      // tango is nothing but dominants arriving. `diatonic` keeps the line in
      // the key, which is right, and in harmonic minor that means it keeps
      // offering the ♭6 and the ♭3 over the V — A♭ against its G, E♭ against
      // its D — and the answering voice's own transpose(-2) is a third below
      // the SCALE, so wherever the lead is on the root the answer is on the ♭6.
      // Measured: a held minor ninth against the pad in half the bars.
      // `anchor` says the held note has to be a chord tone; everything shorter
      // than a step and a half of actual sound is left alone, which is where
      // the ♭9 lives. Bar two still plays G A♭ B over the dominant — it just
      // no longer SITS on the A♭.
      anchor: 1.5,
      artic: "staccato",
      kit: { k: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],       // 3-3-2, twice
             p: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0] },
      fill: { p: [0,0,0,0, 1,0,0,0, 0,0,1,0, 1,0,1,0] },
      bassGrid: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],       // the bass IS the 3-3-2
      tone: { wave: "sawtooth", cut: 2400, q: 1.6, atk: .01, rel: .5, gain: .27, verb: .3 },
      words: ["the bandoneón chords", "the violin, singing over it",
              "the bandoneón answering, from bar 3"],
      word: (v, s) => (v === 2 ? [transpose(-2), drop(2)] : []),
    },

    // DEATH METAL. The genre is two techniques, and both of them are operators
    // this kernel already had. TREMOLO PICKING is `fill(1)` — every step gated,
    // one continuous sixteenth-note wall — and it is the whole guitar sound;
    // nothing else in this table sets every gate on purpose. The BLAST BEAT is
    // the same idea on the kit: kick and snare alternating at the eighth, hats
    // through it, no space anywhere. Locrian, because the flat five is not a
    // passing tone here, it is the tonic chord.
    deathmetal: {
      // named "Tampa 1990" — the Morrisound era: blast beats ridden on the
      // cymbal and tremolo-picked walls are the Florida school's two techniques.
      label: "Tampa 1990", rate: 1, bars: 8, voices: 2,
      instr: "distortion_guitar",
      drumkit: "power",
      entry: () => 0, reg: v => v - 3, realize: () => "line",
      harmony: "cycle", mode: MODES.phrygian, roots: [0,0,1,1, 0,0,4,4],
      scale: [0, 1, 3, 5, 6, 8, 10],                        // locrian: the ♭5 is home
      bassStyle: "sixteenths",
      kit: { k: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],       // the blast
             s: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             // A BLAST BEAT IS RIDDEN, NOT HATTED. The right hand is on the
             // cymbal for the whole bar because at this speed there is nowhere
             // else for it to be — and it is ONE hand, so the sixteenth hats
             // it used to play at the same time were a second drummer.
             r: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      fill: { s: [1,0,1,0, 1,0,1,0, 1,1,1,1, 1,1,1,1],      // bar 8: it doubles
              x: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,9] },
      tone: { wave: "sawtooth", cut: 1400, q: 2.6, atk: .002, rel: .3, gain: .3, verb: .12 },
      words: ["the riff, tremolo-picked — every step",
              "the same riff an octave under, as written"],
      word: v => (v === 0 ? [only("gate", fill(1))] : []),
      fx: ["crunch"],
    },

    // EURYTHMICS. A sequencer and a drum machine and nothing else in the room.
    // What makes it that and not acid is where the interest lives: acid's
    // sequence never varies and the FILTER moves, so it is one instrument
    // breathing; this has a hook that never varies and a HARMONY that does — the
    // two-chord vamp, i to VI, which is the entire song. The bass pulses in
    // octaves under it. Analog, from the Model D, because a sample cannot be a
    // monosynth any more than it can be a 303.
    eurythmics: {
      // named "London 1983" — Sweet Dreams: the two-chord i-VI vamp, the
      // sequencer that never varies, the drum machine and nothing else.
      label: "London 1983", rate: 1, bars: 4, voices: 2,
      instr: "synth_strings_1",
      // "a drum machine and nothing else in the room" — the CR-era box, not a
      // sampled kit pretending to be one
      drumkit: "cr78",
      entry: v => v, reg: v => v - 1, realize: () => "line",
      harmony: "cycle", roots: [0, 0, 5, 5],
      scale: DIATONIC, diatonic: true,
      bassStyle: "octaves",
      synth: { dsp: "modeld", root: "modeld", level: 0.8,
               set: { cutoff: 2600, res: 0.24, envAmount: 1.2, envAttack: 0.004,
                      envDecay: 0.32, envSustain: 0.5, oscMix: 0.35, drive: 0.22,
                      glide: 0, drift: 4 } },
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],       // the gated backbeat
             h: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,1,0] },
      tone: { wave: "sawtooth", cut: 2600, q: 2.0, atk: .004, rel: .5, gain: .28, verb: .22 },
      words: ["the sequence, unchanged all the way through",
              "the answer, a bar late and off the beat"],
      word: (v, s) => (v === 0 ? [] : [only("gate", rotate(6))]),
    },

    // THE ISLEY BROTHERS. The arrangement IS the group: a Rhodes laying down
    // extended chords, Ernie's fuzz guitar singing a whole octave above it, and
    // a third part filling underneath — which is why this is the genre that
    // needed a per-voice instrument table, because playing that lead on the
    // keyboard is not a small loss, it is the entire record. Dorian, for the
    // bright sixth that separates soul from a minor blues; a light sixteenth
    // shuffle, because nothing here lands exactly on the grid; and a bass that
    // syncopates rather than marches.
    isley: {
      // named "Teaneck 1973" — T-Neck Records IS Teaneck NJ, the Isleys' label
      // and home; the Rhodes-plus-fuzz-lead anchor is 3+3.
      label: "Teaneck 1973", rate: 1, bars: 8, voices: 3, swing: 0.16,
      instr: ["rhodes_ep", "overdrive_guitar", "rhodes_ep"],
      drumkit: "room",
      entry: v => (v === 1 ? 2 : 0), reg: v => (v === 1 ? 1 : v - 1),
      realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", roots: [0,0, 3,3, 0,0, 4,4], mode: MODES.dorian,
      scale: [0, 2, 3, 5, 7, 9, 10], diatonic: true,        // dorian, as the subject too
      // EXTENDED CHORDS ARE THE RHODES. A soul pad playing bare triads is a
      // rehearsal; the i7 and the bright IV7 are the record. Voice-led, so
      // consecutive chords move by steps the way a keyboard player's hand does
      // — and the chords ROLL: a strummed pad is what fingers on a Rhodes do.
      prog: PROGS.soul7,
      pipes: [{ id: "strum", spread: 0.06 }],
      maxHold: 4,                              // the guitar sings, and singers breathe
      artic: "legato",
      bassGrid: [1,0,0,1, 0,0,1,0, 1,0,0,0, 0,1,0,0],       // syncopated, never on 3
      kit: { k: [1,0,0,1, 0,0,1,0, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,1,0] },
      tone: { wave: "triangle", cut: 2200, q: 1.2, atk: .008, rel: .9, gain: .26, verb: .34 },
      words: ["the Rhodes, one chord a bar", "the guitar, an octave up, from bar 3",
              "the low part, underneath"],
      word: (v, s) => (v === 2 ? [drop(2), transpose(-2)] : []),
      fx: ["chorus"],
    },

    // ---- THE STUDIO ------------------------------------------------------
    // Five records made by people who could play, and the interesting thing is
    // that what separates them is almost never the notes. It is which MODE the
    // brightness comes from, where the shuffle sits, and who is playing what.

    // TOTO. The reference is "Africa" — the lope, not the shuffle. Toto has
    // two famous feels, and the OTHER one, the Rosanna half-time shuffle, is
    // deliberately not this anchor: it wore that groove for a while (swing a
    // full triplet third, shuffled hats) and read as the wrong song. Africa
    // sits nearly straight — a hair of swing at most — with the time in
    // steady sixteenth hats and the PULSE carried by a rolling tom figure, a
    // dotted cross-rhythm percolating under everything the way the record's
    // percussion loop does; the backbeat lands a ninth of a step behind the
    // grid, laid back but never swung. The rim taps `ghost` scatters between
    // the melody's accents stay — built for the shuffle era's notes-between-
    // the-notes, the lope hears them as more percussion. Over that,
    // unchanged: mixolydian, major with a ♭VII, so I-vi-IV-♭VII turns over
    // without ever leaving the key. A marimba carries the kalimba-ish hook, a
    // guitar answers it from bar 5, and a synth pad holds the chords, which
    // is three instruments and was one until INSTR learned to take a list.
    toto: {
      // named "Los Angeles 1982" — Toto IV: the Africa lope this comment
      // describes, cut by LA session players.
      label: "Los Angeles 1982", rate: 1, bars: 8, voices: 3, swing: 0.08,
      instr: ["synth_strings_1", "marimba", "clean_guitar"],
      drumkit: "room",
      entry: v => (v === 2 ? 4 : 0), reg: v => (v === 1 ? 1 : v - 1),
      realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", mode: MODES.mixo, scale: MODES.mixo, diatonic: true,
      roots: [0,0, 5,5, 3,3, 6,6],               // I vi IV ♭VII
      bassStyle: "eighths",
      kit: { k: [1,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             "~s": [0,0,0,0, 2,0,0,0, 0,0,0,0, 2,0,0,0],  // the relaxed backbeat
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],     // steady sixteenths
             t: [0,0,0,1, 0,0,1,0, 0,0,0,1, 0,0,1,0],     // the rolling figure:
             l: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0] },   // dotted cross-rhythm
      ghost: [only("acc", rotate(2))],           // rim taps: more percussion
      // THE HAT HAND. Even now the dynamics are the drummer's own, not the
      // tune's — a gentle lean on the eighth pulse, the between-notes tucked
      // under, a lope rather than the old shuffle's hard beats. Only the hats:
      // kick, snare and toms still ride the phrase like every other genre.
      kitVel: { h: [7,4,5,4, 6,4,5,4, 7,4,5,4, 6,4,5,4] },
      // BAR 8: the backbeat lands once, then the hand rolls down the toms —
      // t, m, l, gathering speed as it falls — while the sixteenth hats keep
      // going underneath, because on this record the time never stops for
      // the fill.
      fill: { s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0],
              t: [0,0,0,0, 1,0,1,0, 0,0,0,0, 0,0,0,0],
              m: [0,0,0,0, 0,0,0,0, 1,0,1,1, 0,0,0,0],
              l: [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2800, q: 1.0, atk: .006, rel: .8, gain: .27, verb: .3 },
      words: ["the pad, one chord a bar", "the marimba hook",
              "the guitar, answering from bar 5"],
      word: v => (v === 2 ? [transpose(2), drop(2)] : []),
      fx: ["chorus"],
    },

    // JODECI. New jack swing, which is one idea: play sixteenths and SWING them,
    // hard, on a drum machine that cannot swing on its own. Under it, dorian —
    // gospel's minor, the one with the bright sixth — and a stack of voices
    // holding the chord while a Rhodes plays around it. Slow; the tempo is the
    // point, and the composer knows it.
    jodeci: {
      // named "Charlotte 1991" — Forever My Lady's year, and the choir-over-808
      // anchor is the Hailey brothers' Charlotte church sound; the new jack
      // swing TECHNIQUE itself would be Harlem 1987 (Teddy Riley).
      label: "Charlotte 1991", rate: 1, bars: 4, voices: 2, swing: 0.28,
      instr: ["ahh_choir", "rhodes_ep"],
      // "a drum machine that cannot swing on its own" — the 808; the swing is
      // ours, exactly as new jack applied it
      drumkit: "tr808",
      entry: () => 0, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", mode: MODES.dorian, scale: MODES.dorian, diatonic: true,
      roots: [0, 3, 0, 4],                       // i IV i v — dorian's bright IV
      prog: PROGS.jack7,                         // the same cycle, sevenths said out loud
      maxHold: 3,                                // melisma is phrases WITH ENDS
      artic: "legato",
      bassGrid: [1,0,0,1, 0,0,1,0, 1,0,0,0, 0,1,0,0],
      kit: { k: [1,0,0,1, 0,0,1,0, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
             h: [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1] },
      fill: { s: [0,0,0,0, 1,0,0,1, 0,0,1,0, 1,1,1,0] },
      tone: { wave: "triangle", cut: 2400, q: 1.1, atk: .01, rel: 1.0, gain: .26, verb: .42 },
      words: ["the vocal stack, one chord a bar", "the Rhodes, playing around it"],
      word: () => [],
      fx: ["chorus"],
    },

    // THE BEATLES. Two things, and the second is the one nobody expects a
    // program to get: the ♭VII. I - ♭VII - IV - I is the move, it is why
    // mixolydian and not major, and it is most of what makes a bright three-chord
    // song sound like them rather than like everyone else. The first thing is
    // simpler — the second voice sings a THIRD above the first, which in a
    // seven-note alphabet is exactly transpose(2), and in parallel the whole way.
    beatles: {
      // named "Liverpool 1962" — Love Me Do: the ♭VII already in the tune and
      // two voices in thirds, before the studio years moved them to London.
      label: "Liverpool 1962", rate: 1, bars: 8, voices: 2,
      instr: ["steel_string_guitar", "ohh_voices"],
      drumkit: "acoustic",
      entry: () => 0, reg: v => v, realize: () => "line",
      harmony: "cycle", mode: MODES.mixo, scale: MODES.mixo, diatonic: true,
      roots: [0,0, 6,6, 3,3, 0,0],               // I ♭VII IV I
      // THE FOUR-BAR SENTENCE — the sixth type's first customer. Three bars as
      // written and a thinned fourth is how a sixties verse breathes: the
      // cadence bar makes room for the harmony to land. A per-bar schedule,
      // not a word closure, so the DAW's own palette could have said it.
      period: [[], [], [], [drop(3)]],
      progFamily: { verse: "beatlesV", chorus: "beatlesC" },
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,1,0] },
      tone: { wave: "triangle", cut: 2600, q: 0.9, atk: .005, rel: .7, gain: .28, verb: .26 },
      words: ["the tune", "the harmony, a third above, all the way"],
      word: v => (v === 1 ? [transpose(2)] : []),
    },

    // STEELY DAN. Dorian, and specifically dorian's MAJOR fourth — the one
    // bright chord in a minor key, which is the sound of half their catalogue
    // and is a mode fact rather than a chord substitution. Add the relative
    // major at the end of the form and you have i - IV - v - III, which turns
    // over forever and never resolves anywhere emphatic, which is the point. A
    // Rhodes, a jazz guitar over it, a walking bass, and a shuffle small enough
    // that it reads as feel rather than as swing.
    steely: {
      // named "Los Angeles 1977" — Aja: the Rhodes/jazz-guitar/walking-bass
      // session polish is the LA years, not the NY bar band of 1972.
      label: "Los Angeles 1977", rate: 1, bars: 8, voices: 3, swing: 0.2,
      instr: ["rhodes_ep", "jazz_guitar", "rhodes_ep"],
      drumkit: "jazz",
      entry: v => (v === 1 ? 2 : 0), reg: v => (v === 1 ? 1 : v - 1),
      realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", mode: MODES.dorian, scale: MODES.dorian, diatonic: true,
      roots: [0,0, 3,3, 4,4, 2,2],               // i IV v III
      bassStyle: "walk", artic: "legato",
      kit: { k: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1] },
      fill: { s: [0,0,0,0, 1,0,0,1, 0,0,1,0, 1,0,1,0] },
      tone: { wave: "triangle", cut: 2600, q: 1.0, atk: .007, rel: .8, gain: .26, verb: .3 },
      words: ["the Rhodes, one chord a bar", "the guitar, from bar 3",
              "the low part underneath"],
      word: v => (v === 2 ? [drop(2), transpose(-2)] : []),
      fx: ["chorus"],
    },

    // POST ROCK. The genre is a SHAPE, not a harmony: one figure, arriving one
    // voice at a time over eight bars, on a delay long enough that the
    // arpeggio plays against itself. So the harmony is the plainest thing in
    // the table — i VI iv v, four chords anyone would write — and everything
    // that makes it what it is lives elsewhere: half speed, legato, staggered
    // entries, a reverb you could lose an afternoon in, and the dotted-eighth
    // echo that IS the guitar sound, asked for by name.
    postrock: {
      // named "Austin 2003" — dotted-eighth echo on clean guitars arriving one
      // at a time is Explosions in the Sky; Glasgow 1997 was the other claimant.
      label: "Austin 2003", rate: 0.5, bars: 8, voices: 3,
      instr: ["slow_strings", "clean_guitar", "clean_guitar"],
      drumkit: "room",
      entry: v => v * 2, reg: v => v - 1,
      realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", scale: DIATONIC, diatonic: true,
      roots: [0,0, 5,5, 3,3, 4,4],               // i VI iv v
      artic: "legato", incClamp: 4, incMode: "reverse",
      kit: { k: [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             h: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0] },
      fill: { s: [0,0,0,0, 0,0,0,0, 1,0,0,0, 1,0,1,0] },
      tone: { wave: "triangle", cut: 2000, q: 1.2, atk: .03, rel: 2.0, gain: .24, verb: .72 },
      words: ["the strings, holding", "the first guitar", "the second, from bar 5"],
      word: v => (v === 2 ? [rotate(4), drop(2)] : []),
      fx: ["echo"],
    },

    // ---- THE RADIO DIAL ----------------------------------------------------
    // The table was strong on art music, studio rock and dance and near-empty
    // on the actual radio spectrum. Each genre below names its nearest existing
    // neighbour (`near:`, which the confusion gate reads) and its comment says
    // which FIELD separates them — that field is the genre, everything else is
    // orchestration. Between them they exercise every piece of the depth round:
    // reggae's skank proves PARTS, house's seventh loop proves PROGRESSION,
    // motown proves the major modes, dnb proves the kit schedule, garage
    // proves the period.

    // BOOM BAP [isley]. The nearest record is the soul record it would have
    // sampled, and the difference IS the sampling: the keys are a STAB whose
    // gate is excerpt(0,8) — half the phrase's rhythm looped like a chop
    // lifted off vinyl, voicing the sounding seventh chord, where isley plays
    // the whole tune live. The snare hand (kitVel) does the rest — every
    // backbeat at 9.
    boombap: {
      // named "New York 1994" — Illmatic-era: the chopped soul loop with the
      // snare hand at 9 on every backbeat.
      label: "New York 1994", rate: 1, bars: 4, voices: 2, swing: 0.2, near: "isley",
      instr: ["electric_piano", "muted_trumpet"],
      drumkit: "room",
      entry: v => v * 2, reg: v => v - 1,
      realize: v => (v === 0 ? "pad" : "line"),
      part: ["stab", "lead"],
      harmony: "cycle", roots: [0, 0, 3, 3], mode: MODES.dorian,
      scale: MODES.dorian, diatonic: true,
      prog: [{ d: 0, q: "7" }, { d: 0, q: "7" }, { d: 3, q: "7" }, { d: 3, q: "7" }],
      maxHold: 3,
      bassGrid: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
      kit: { k: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      kitVel: { s: [0,0,0,0, 9,0,0,0, 0,0,0,0, 9,0,0,0] },
      fill: { s: [0,0,0,0, 1,0,0,1, 0,0,1,0, 1,0,1,0] },
      tone: { wave: "triangle", cut: 2000, q: 1.4, atk: .006, rel: .6, gain: .28, verb: .2 },
      words: ["the chop — eight steps of the phrase's rhythm, chords on it",
              "the horn, answering from bar 3"],
      word: v => (v === 0 ? [excerpt(0, 8)] : [only("gate", rotate(8))]),
    },

    // TRAP [deathmetal] — and the neighbour is not a joke: both are minor,
    // fast, sixteenth-hat music. What separates them is the HALF-TIME SNARE:
    // one hit on beat 3 where death metal blasts eight, no distortion, and a
    // bell up top where the tremolo guitar was. The hats carry the hand
    // (kitVel) and the 808 ties.
    trap: {
      // named "Atlanta 2003" — T.I.'s Trap Muzik named the thing: 808 ties,
      // half-time snare, the bell up top.
      label: "Atlanta 2003", rate: 1, bars: 4, voices: 2, near: "deathmetal",
      instr: ["music_box", "square_lead"],
      drumkit: "tr808",            // "the 808 ties" — it does, and now it is one
      entry: v => v * 2, reg: v => 1 - 2 * v, realize: () => "line",
      harmony: "cycle", roots: [0, 0, 5, 5],
      artic: "tie",
      bassStyle: "octaves",
      kit: { k: [1,0,0,0, 0,0,0,0, 0,0,0,1, 0,0,0,0],
             s: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      kitVel: { h: [7,2,4,2, 6,2,4,2, 7,2,4,2, 6,2,5,3] },
      fill: { s: [0,0,0,0, 0,0,0,0, 1,0,0,0, 1,1,1,1] },
      tone: { wave: "square", cut: 2400, q: 1.8, atk: .003, rel: .5, gain: .28, verb: .3 },
      words: ["the bell, up top", "the sub line, tied"],
      word: v => (v === 0 ? [] : [only("gate", rotate(4)), drop(2)]),
    },

    // HOUSE [acid]. Acid is modal with a 303 and no chords; house is a SEVENTH
    // LOOP with piano stabs — the prog is the genre. ii7–V7–Imaj7–vi7 in a real
    // major key, a stab part on the phrase's own rhythm, and the open hat on
    // the offbeat doing the work acid's sixteenth hats did.
    house: {
      // named "Chicago 1986" not 1985 — the anchor's identity is the PIANO
      // STAB over the four, and that is Move Your Body's year.
      label: "Chicago 1986", rate: 1, bars: 4, voices: 2, near: "acid",
      instr: ["bright_yamaha_grand", "polysynth"],
      drumkit: "tr909",            // Chicago's four on the floor is a 909's
      entry: v => v, reg: v => v - 1,
      realize: v => (v === 0 ? "pad" : "line"),
      part: ["stab", "lead"],
      harmony: "cycle", roots: [1, 4, 0, 5], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      prog: [{ d: 1, q: "7" }, { d: 4, q: "7" }, { d: 0, q: "7" }, { d: 5, q: "7" }],
      bassStyle: "eighths",
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             o: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0] },
      fill: { c: [0,0,0,0, 1,0,0,0, 0,0,1,0, 1,0,1,0] },
      tone: { wave: "sawtooth", cut: 2400, q: 1.6, atk: .004, rel: .5, gain: .28, verb: .18 },
      words: ["the piano stabs, on the tune's own rhythm", "the lead over the loop"],
      word: () => [],
    },

    // UK GARAGE [house]. Same rave, different floor: the kick BREAKS (1 and
    // the a-of-2) instead of stamping fours, the second snare is displaced,
    // the swing is huge, and the two-bar shuffle is a PERIOD — the sixth type
    // saying what house's straight grid cannot.
    garage: {
      // named "London 1999" — the 2-step year (Re-Rewind): displaced second
      // snare, chopped vocal, the shuffle edited rather than played.
      label: "London 1999", rate: 1, bars: 4, voices: 2, swing: 0.28, near: "house",
      instr: ["electric_piano", "solo_vox"],
      drumkit: "electronic",
      entry: v => v, reg: v => v - 1, realize: () => "line",
      harmony: "cycle", roots: [0, 5, 3, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      prog: [{ d: 0, q: "7" }, { d: 5, q: "7" }, { d: 3, q: "7" }, { d: 4, q: "7" }],
      maxHold: 2,                              // the chopped vocal breathes
      bassStyle: "octaves",
      period: [[], [only("gate", rotate(1))], [], [drop(2)]],
      kit: { k: [1,0,0,0, 0,0,0,0, 0,1,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,1, 0,0,0,0],
             h: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,1] },
      // THE HAT THAT IS NOT ALWAYS THERE. Garage's shuffle is edited, not
      // played: the hand drops sixteenths and puts them back, which a fixed
      // vector cannot say and a per-bar CHANCE can. Seeded, so the drop-outs
      // are the same every time you press play and different every bar.
      kitProb: { h: [9,9,9,6, 9,9,8,5, 9,9,9,6, 9,9,7,7] },
      fill: { s: [0,0,0,0, 1,0,0,1, 0,0,1,1, 1,0,1,0] },
      tone: { wave: "triangle", cut: 2600, q: 1.4, atk: .004, rel: .4, gain: .27, verb: .24 },
      words: ["the chopped vocal", "the answer, shuffled off the beat"],
      word: v => (v === 0 ? [] : [only("gate", rotate(3)), drop(3)]),
    },

    // DRUM & BASS [house]. The founding move is the BREAK, and a break is two
    // bars, not one — so this is the kit schedule's proof genre: `kits` reads
    // a different bar of drums on the even and odd bars, ghost layer armed,
    // over a tied reese-register line and a pedal sub that refuses to move.
    dnb: {
      // named "London 1994" — the year jungle became drum & bass: the two-bar
      // break schedule over a reese and a pedal sub.
      label: "London 1994", rate: 1, bars: 4, voices: 2, near: "house",
      instr: ["fifth_sawtooth_wave", "echo_drops"],
      drumkit: "electronic",
      entry: v => v, reg: v => v - 2, realize: () => "line",
      harmony: "modal",
      artic: "tie", maxHold: 2,
      bassStyle: "pedal",
      bassGrid: [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
      kit: { k: [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      kits: [
        { k: [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
          s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
          h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
        { k: [1,0,0,1, 0,0,0,0, 0,1,0,0, 0,0,0,0],
          s: [0,0,0,0, 1,0,0,1, 0,0,1,0, 1,0,0,0],
          h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      ],
      ghost: [only("acc", rotate(1))],
      fill: { s: [1,0,1,0, 1,0,1,0, 1,1,0,1, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 1200, q: 3, atk: .003, rel: .5, gain: .28, verb: .16 },
      words: ["the reese line, tied", "the pads drifting over the break"],
      word: (v, s) => (v === 0 ? [] : [rotate(8), drop(2)]),
    },

    // DISCO [newwave]. Both are bright four-square pop machines; what
    // separates them is the SEVENTHS and the open hat. New wave is clipped
    // triads and closed eighths; disco is a dorian seventh cycle, an open hat
    // on EVERY offbeat, sixteenth hats under it, strings stabbing the chords
    // and an octave bass — the whole record leans forward.
    disco: {
      // named "New York 1977" — the peak-of-the-floor year; Philadelphia 1974
      // owns the proto-disco strings, but this anchor is the full club machine.
      label: "New York 1977", rate: 1, bars: 4, voices: 2, near: "newwave",
      instr: ["strings", "clean_guitar"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1,
      realize: v => (v === 0 ? "pad" : "line"),
      part: ["stab", "lead"],
      harmony: "cycle", roots: [0, 3, 2, 4], mode: MODES.dorian,
      scale: MODES.dorian, diatonic: true,
      prog: [{ d: 0, q: "7" }, { d: 3, q: "7" }, { d: 2, q: "7" }, { d: 4, q: "7" }],
      maxHold: 2,
      bassStyle: "octaves",
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             o: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      kitVel: { h: [8,3,5,3, 7,3,5,3, 8,3,5,3, 7,3,6,4] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,1,0, 1,1,1,0] },
      tone: { wave: "sawtooth", cut: 2800, q: 1.4, atk: .005, rel: .5, gain: .27, verb: .28 },
      words: ["the string stabs", "the guitar, answering"],
      word: v => (v === 1 ? [only("gate", rotate(4))] : []),
    },

    // FUNK [isley]. Soul with the harmony taken away: MODAL, one dorian chord
    // for the whole record, because the groove is the song. A clavinet where
    // the Rhodes was, a sixteenth bass with a hard rest cap, ghost snares as
    // a velocity fact (kitVel 2s between the 9s), and the ghost lane armed.
    funk: {
      // named "Cincinnati 1967" — Cold Sweat at King Records: the first
      // one-chord modal groove, which is exactly what this anchor is.
      label: "Cincinnati 1967", rate: 1, bars: 4, voices: 2, swing: 0.12, near: "isley",
      instr: ["clavinet", "brass_section"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: () => "line",
      harmony: "modal", mode: MODES.dorian, scale: MODES.dorian,
      artic: "staccato", maxHold: 2,
      bassStyle: "sixteenths",
      ghost: [only("acc", rotate(2))],
      kit: { k: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,1, 1,0,0,0, 0,0,1,0, 1,0,0,0],
             h: [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1] },
      kitVel: { s: [0,0,0,2, 9,0,0,0, 0,0,2,0, 9,0,0,0] },
      fill: { s: [0,0,0,1, 1,0,0,1, 0,0,1,0, 1,0,1,1] },
      tone: { wave: "square", cut: 2200, q: 2.2, atk: .003, rel: .3, gain: .28, verb: .14 },
      words: ["the clavinet, chopped", "the horns, rotated off the beat"],
      word: v => (v === 1 ? [only("gate", rotate(2)), drop(2)] : []),
    },

    // MOTOWN [beatles]. Both are bright sixties three-minute machines; the
    // field that separates them is the SNARE ON ALL FOUR — the Funk Brothers'
    // stamp, with the tambourine offbeats beside it — over a walking bass and
    // an ionian I-vi-IV-V said with its sevenths out loud.
    motown: {
      // named "Detroit 1965" — the Funk Brothers' snare-on-all-four at
      // Hitsville's peak.
      label: "Detroit 1965", rate: 1, bars: 4, voices: 2, swing: 0.12, near: "beatles",
      instr: ["upright_piano", "trumpet"],
      drumkit: "acoustic",
      entry: v => v, reg: v => v - 1,
      realize: v => (v === 0 ? "pad" : "line"),
      part: ["stab", "lead"],
      harmony: "cycle", roots: [0, 5, 3, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      prog: [{ d: 0, q: "7" }, { d: 5, q: "7" }, { d: 3, q: "7" }, { d: 4, q: "dom7" }],
      maxHold: 3,
      bassStyle: "walk",
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             p: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      // THE FUNK BROTHERS' TURNAROUND: the snare on all four, then the hand
      // walks down the toms into the next verse. A tom fill is the oldest fill
      // there is and this table could not write one until the kit grew.
      fill: { s: [1,0,0,0, 1,0,1,0, 1,0,0,0, 0,0,0,0],
              t: [0,0,0,0, 0,0,0,0, 0,0,1,0, 1,0,0,0],
              m: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,1,0,0],
              l: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,1] },
      tone: { wave: "triangle", cut: 2600, q: 1.0, atk: .005, rel: .6, gain: .28, verb: .26 },
      words: ["the piano, stabbing the changes", "the horn line over it"],
      word: () => [],
    },

    // R&B [jodeci]. Jodeci is new jack — swung, triadic, a drum machine
    // playing sixteenths. This is the other nineties: STRAIGHT time and
    // EXTENDED chords, Imaj7–iii7–vi7–IVmaj7, a rim on 3, an EP that holds,
    // and backing vocals that are a harmonize PIPE, chord-locked sixths.
    rnb: {
      // named "Philadelphia 1994" — the straight-time maj7 ballad with a rim
      // on 3 and stacked thirds is Boyz II Men's Philadelphia.
      label: "Philadelphia 1994", rate: 1, bars: 4, voices: 2, near: "jodeci",
      instr: ["legend_ep_2", "synth_voice"],
      drumkit: "electronic",
      entry: v => v, reg: v => v - 1,
      realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", roots: [0, 2, 5, 3], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      prog: [{ d: 0, q: "7" }, { d: 2, q: "7" }, { d: 5, q: "7" }, { d: 3, q: "7" }],
      maxHold: 2, artic: "legato",
      pipes: [{ id: "harmonize", p: 0.4, gap: "sixth" }],
      bassGrid: [1,0,0,1, 0,0,1,0, 0,0,1,0, 0,0,0,0],
      kit: { k: [1,0,0,1, 0,0,0,0, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             h: [1,0,0,1, 0,1,0,0, 1,0,0,1, 0,0,1,0] },
      fill: { h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2200, q: 1.0, atk: .01, rel: .9, gain: .26, verb: .38 },
      words: ["the EP, holding the sevenths", "the melisma, with its rests"],
      word: () => [],
    },

    // GOSPEL [motown]. Same church, one street over — and the field that
    // separates them is the SECONDARY DOMINANT: I goes to IV through its own
    // V7 (the one deliberate exit from the key), and the form ends on the
    // plagal amen, IV–I inside the last bar. Shuffled hard, organ under
    // everything, the answering choir arriving late a third up.
    gospel: {
      // named "Chicago 1932" — Thomas A. Dorsey at Pilgrim Baptist: the organ,
      // the shuffle, the secondary dominant and the plagal amen.
      label: "Chicago 1932", rate: 1, bars: 4, voices: 3, swing: 1 / 3, near: "motown",
      instr: ["drawbarorgan", "ahh_choir", "ohh_voices"],
      drumkit: "acoustic",
      entry: v => v * 2, reg: v => (v === 0 ? -1 : v - 1),
      realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", roots: [0, 0, 3, 3], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      prog: [{ d: 0, q: "7" }, { d: 0, q: "dom7" }, { d: 3, q: "7" },
             [{ d: 3, q: "six", beats: 8 }, { d: 0, q: "7", beats: 8 }]],
      maxHold: 4,
      bassStyle: "walk",
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,1,0, 1,0,1,0, 1,1,1,0] },
      tone: { wave: "triangle", cut: 2400, q: 0.9, atk: .02, rel: 1.2, gain: .26, verb: .45 },
      words: ["the organ, walking the changes", "the lead voice",
              "the choir, answering a third up from bar 5"],
      word: v => (v === 2 ? [transpose(2), drop(2)] : []),
    },

    // REGGAE [dub]. The pair share the one-drop; what separates THIS one is
    // that the harmony still moves (i–i–IV–v) while the kick refuses beat 1 —
    // no kick on the one is the whole drama of the kit. The skank is the
    // PARTS proof: a stab on an absolute offbeat gate, which was unsayable
    // while a chord could only fire once a bar.
    reggae: {
      // named "Kingston 1969" — the one-drop settling out of rocksteady the
      // year after Do the Reggay named it.
      label: "Kingston 1969", rate: 1, bars: 4, voices: 2, near: "dub",
      instr: ["clean_guitar", "harmonica"],
      drumkit: "room",
      entry: v => v, reg: v => v,
      realize: v => (v === 0 ? "pad" : "line"),
      part: ["stab", "lead"],
      harmony: "cycle", roots: [0, 0, 3, 4],
      maxHold: 6,
      bassGrid: [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
      kit: { k: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             p: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             h: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0] },
      fill: { s: [0,0,0,0, 0,0,0,0, 1,0,0,0, 1,0,1,0] },
      tone: { wave: "triangle", cut: 2000, q: 1.2, atk: .008, rel: .7, gain: .27, verb: .3 },
      words: ["the skank, offbeats only", "the melodica line, long notes"],
      word: v => (v === 0 ? [offbeats(4)] : []),
    },

    // DUB [reggae]. Same one-drop, same skank — the difference is REFUSAL:
    // the harmony collapses to one modal chord, the melody drops out two ways
    // at once, the bass sits on the pedal, and the tape echo is on the genre
    // (the sends are the instrument here, not the notes).
    dub: {
      // named "Kingston 1973" — King Tubby's mixing desk: the sends as the
      // instrument, the song taken away.
      label: "Kingston 1973", rate: 1, bars: 4, voices: 2, near: "reggae",
      instr: ["clean_guitar", "echo_drops"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1,
      realize: v => (v === 0 ? "pad" : "line"),
      part: ["stab", "lead"],
      harmony: "modal",
      intro: "bassin",               // dub walks in on the bass or not at all
      maxHold: 3,
      bassStyle: "pedal",
      kit: { k: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             p: [0,1,0,0, 0,0,0,1, 1,0,0,0, 0,0,1,0],
             h: [0,0,1,0, 0,0,0,0, 0,0,1,0, 0,0,0,0] },
      fill: { h: [0,0,1,0, 0,0,1,0, 1,0,1,0, 1,0,1,1] },
      tone: { wave: "triangle", cut: 1500, q: 1.6, atk: .01, rel: 1.4, gain: .26, verb: .7 },
      words: ["the skank, thinned", "the line, mostly dropped out"],
      word: (v, s) => (v === 0 ? [offbeats(4), drop(2)]
                              : [drop(2), ...(s % 2 ? [drop(3)] : [])]),
      fx: ["echo"],
    },

    // SKA [reggae]. The same offbeat chop played at twice the density and
    // twice the joy: the DOUBLE skank (every second step, not every fourth),
    // a kick that dares to land on 1 and 3, a real backbeat, a walking bass
    // and a major I-IV-V — reggae's rhythm cell in a completely different key
    // of feeling.
    ska: {
      // named "Kingston 1962" — independence year, the first-wave double skank
      // with horns (Skatalites forming out of Studio One's session floor).
      label: "Kingston 1962", rate: 1, bars: 4, voices: 2, near: "reggae",
      instr: ["palm_muted_guitar", "trumpet"],
      drumkit: "acoustic",
      entry: v => v, reg: v => v,
      realize: v => (v === 0 ? "pad" : "line"),
      part: ["stab", "lead"],
      harmony: "cycle", roots: [0, 3, 4, 0], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      artic: "staccato", maxHold: 2,
      bassStyle: "walk",
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,1,0, 1,1,1,1] },
      tone: { wave: "square", cut: 2600, q: 1.6, atk: .003, rel: .3, gain: .27, verb: .18 },
      words: ["the double skank", "the horn line"],
      word: v => (v === 0 ? [offbeats(2)] : []),
    },

    // AFROBEAT [funk]. Both are modal dorian groove machines; the field that
    // separates them is the CROSS-RHYTHM — 3-3-3-3-2-2 on the percussion lane
    // against the four, three staggered voices in rotated relations instead
    // of two locked ones, and an eight-bar form because the groove is a place
    // you stay, not a bar you loop.
    afrobeat: {
      // named "Lagos 1971" — Fela's Africa '70 at the Shrine: two drummers,
      // threes against the four, a groove you stay in.
      label: "Lagos 1971", rate: 1, bars: 8, voices: 3, near: "funk",
      instr: ["clean_guitar", "tenor_sax", "brass_section"],
      drumkit: "jazz",
      entry: v => v * 2, reg: v => v - 1, realize: () => "line",
      harmony: "modal", mode: MODES.dorian, scale: MODES.dorian,
      maxHold: 3,
      bassStyle: "eighths",
      kit: { k: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             s: [0,0,0,0, 0,1,0,0, 0,0,0,0, 0,1,0,0],
             p: [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,1,0],
             // TWO DRUMMERS, which is what an afrobeat band has: the tom hand
             // plays its own three-against-four figure beside the kit hand,
             // and it is a DRUM part rather than a percussion colour
             m: [0,0,0,0, 1,0,0,0, 0,0,0,1, 0,0,0,0],
             l: [0,0,1,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             h: [1,1,1,0, 1,1,1,0, 1,1,1,0, 1,1,1,0] },
      // and the hat hand does not hit every one of them every time round
      kitProb: { h: [9,7,8,0, 9,6,8,0, 9,7,8,0, 9,6,7,0] },
      fill: { s: [0,0,0,0, 0,1,0,1, 0,0,1,0, 1,1,0,1] },
      tone: { wave: "triangle", cut: 2400, q: 1.4, atk: .005, rel: .5, gain: .27, verb: .2 },
      words: ["the tenor guitar, chopping", "the sax, in threes against it",
              "the horns, further out of phase"],
      word: (v, s) => [[], [rotate(4), drop(2)], [rotate(8), drop(3)]][v],
    },

    // BOSSA NOVA [steely]. Both live on sevenths and understatement; the
    // field that separates them is the CLAVE — the rim figure the whole bar
    // hangs off — plus brushes, no snare at all, and the ii7–V7 packed into
    // HALF a bar (`beats: 8`), which is the turnaround steely spreads over
    // two whole bars.
    bossa: {
      // named "Rio de Janeiro 1958" — Chega de Saudade, cut in Rio that July:
      // the clave, the brushes, the ii7-V7 in half a bar.
      label: "Rio de Janeiro 1958", rate: 1, bars: 4, voices: 2, near: "steely",
      instr: ["nylon_string_guitar", "flute"],
      drumkit: "brush",
      entry: v => v, reg: v => v - 1,
      realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", roots: [0, 1, 0, 5], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      prog: [[{ d: 0, q: "7" }],
             [{ d: 1, q: "7", beats: 8 }, { d: 4, q: "dom7", beats: 8 }],
             [{ d: 0, q: "7" }], [{ d: 5, q: "7" }]],
      pipes: [{ id: "strum", spread: 0.04 }],
      artic: "legato", maxHold: 4,
      bassStyle: "fifths",
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             p: [1,0,0,1, 0,0,1,0, 0,0,1,0, 0,1,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
             // the left foot on 2 and 4 under the brushes — a bossa drummer's
             // hat is a FOOT, and it is the quietest load-bearing thing here
             f: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0] },
      fill: { p: [1,0,0,1, 0,0,1,0, 1,0,1,0, 1,1,0,1] },
      tone: { wave: "triangle", cut: 2400, q: 0.8, atk: .008, rel: .8, gain: .26, verb: .3 },
      words: ["the guitar, rolling the sevenths", "the flute, saying very little"],
      word: () => [],
    },

    // COUNTRY [beatles]. Both are I-loving guitar pop; the fields that
    // separate them are the TRAIN BEAT — brushes on every offbeat eighth, no
    // backbeat snare at all — and the FIFTHS bass, the boogie root-five
    // figure. The fiddle answers late instead of doubling in thirds all the
    // way, which is the difference between Nashville and Liverpool.
    countrypop: {
      // named "Nashville 1945" — voice 0's word is literally "the banjo roll",
      // and the roll is Earl Scruggs', debuted with Monroe at the Ryman in 1945.
      label: "Nashville 1945", rate: 1, bars: 4, voices: 2, swing: 0.1, near: "beatles",
      instr: ["banjo", "fiddle"],
      drumkit: "acoustic",
      entry: () => 0, reg: v => v, realize: () => "line",
      harmony: "cycle", roots: [0, 4, 5, 3], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      maxHold: 3,
      bassStyle: "fifths",
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,1,0, 0,0,1,0, 1,0,1,0, 1,1,1,0] },
      tone: { wave: "triangle", cut: 2800, q: 1.0, atk: .004, rel: .5, gain: .28, verb: .2 },
      words: ["the banjo roll", "the fiddle, answering a third up"],
      word: v => (v === 1 ? [only("gate", rotate(8)), transpose(2)] : []),
    },

    // SYNTH POP [eurythmics]. Eurythmics is a two-chord vamp with two lines;
    // this is the FOUR-chord aeolian anthem (i–VI–III–VII, the loop under
    // half the eighties) with a STAB where the second sequence was, a huge
    // gated snare and — the tell — no hats at all.
    synthpop: {
      // named "Basildon 1981" — early Depeche Mode: all-synth staccato stabs
      // on the CR-era box, the aeolian anthem loop.
      label: "Basildon 1981", rate: 1, bars: 4, voices: 2, near: "eurythmics",
      instr: ["polysynth", "saw_wave"],
      drumkit: "cr78",             // the CR-era anthem box, like its neighbour
      entry: v => v, reg: v => v - 1,
      realize: v => (v === 0 ? "pad" : "line"),
      part: ["stab", "lead"],
      harmony: "cycle", roots: [0, 5, 2, 6],
      scale: DIATONIC, diatonic: true,
      artic: "staccato",
      bassStyle: "eighths",
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0] },
      tone: { wave: "sawtooth", cut: 2600, q: 2.0, atk: .003, rel: .4, gain: .28, verb: .26 },
      words: ["the stab, on the tune's rhythm", "the hook, re-pitched every other bar"],
      word: (v, s) => (v === 1 && s % 2 ? [only("deg", rotate(4))] : []),
      fx: ["chorus"],
    },

    // SHOEGAZE [postrock]. Post rock is patience — half speed, staggered
    // arrivals, one crescendo. Shoegaze is the same reverb with a BACKBEAT
    // under it: full speed, a real snare, and both guitars playing the same
    // phrase ONE DEGREE APART (bulgarian's held second, under fuzz), which is
    // where the blur comes from — it is detune as counterpoint.
    shoegaze: {
      // named "London 1991" — Loveless: the held-second blur under fuzz, made
      // across a year of London studios (MBV formed in Dublin; the record is
      // London's).
      label: "London 1991", rate: 1, bars: 8, voices: 2, near: "postrock",
      instr: ["overdrive_guitar", "overdrive_guitar"],
      drumkit: "room",
      entry: () => 0, reg: v => v - 1, realize: () => "line",
      harmony: "cycle", roots: [0, 3, 5, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      artic: "legato", incClamp: 4, incMode: "reverse",
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,1,0] },
      tone: { wave: "sawtooth", cut: 1600, q: 1.6, atk: .02, rel: 1.6, gain: .26, verb: .8 },
      words: ["the tune", "the same tune a second up — the blur"],
      word: v => (v === 1 ? [transpose(1)] : []),
      fx: ["crunch", "chorus"],
    },

    // CITY POP [toto]. Session players either side of the Pacific; the field
    // that separates them is the SWING (a 0.1 lean, not the Porcaro triplet)
    // and the ROYAL ROAD — IVmaj7–V7–iii7–vi7, the progression this whole
    // project was once named after, finally in the table under its own flag.
    // Slap-tight sixteenth bass, an EP stab, no ghost lane.
    citypop: {
      // named "Tokyo 1984" — Plastic Love's year: the royal road with slap
      // sixteenths under it.
      label: "Tokyo 1984", rate: 1, bars: 4, voices: 2, swing: 0.1, near: "toto",
      instr: ["electric_piano", "clean_guitar"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1,
      realize: v => (v === 0 ? "pad" : "line"),
      part: ["stab", "lead"],
      harmony: "cycle", roots: [3, 4, 2, 5], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      prog: [{ d: 3, q: "7" }, { d: 4, q: "7" }, { d: 2, q: "7" }, { d: 5, q: "7" }],
      maxHold: 2,
      bassStyle: "sixteenths",
      kit: { k: [1,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,1, 1,0,1,0, 1,1,1,0, 1,0,1,0] },
      kitVel: { h: [8,3,5,3, 7,3,5,4, 8,3,6,3, 7,3,5,4] },
      fill: { s: [0,0,0,0, 1,0,0,1, 0,0,1,0, 1,0,1,0] },
      tone: { wave: "triangle", cut: 2800, q: 1.0, atk: .005, rel: .6, gain: .27, verb: .3 },
      words: ["the EP, stabbing the royal road", "the guitar, gliding over it"],
      word: () => [],
    },

    // PUNK [rock]. Rock develops a riff; punk REFUSES to — the whole guitar
    // is fill(2), every eighth a downstroke, staccato, no space and no
    // dynamics, over a kick on every quarter and a major I-IV-V because
    // subtlety is for prog. Three chords and the truth at 160.
    punk: {
      // named "New York 1976" — the Ramones' debut: every-eighth downstrokes
      // at 160 is Johnny's right hand, a year before London took it up.
      label: "New York 1976", rate: 1, bars: 4, voices: 2, near: "rock",
      instr: ["distortion_guitar", "crunch_guitar"],
      drumkit: "power",
      entry: () => 0, reg: v => -1 - v, realize: () => "line",
      harmony: "cycle", roots: [0, 3, 4, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      artic: "staccato",
      bassStyle: "eighths",
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
             // punk crashes on the ONE and keeps crashing: the cymbal is the
             // hat's louder twin here, not a punctuation mark
             x: [9,0,0,0, 0,0,0,0, 8,0,0,0, 0,0,0,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,1,0, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 2000, q: 1.8, atk: .002, rel: .3, gain: .3, verb: .1 },
      words: ["every eighth, downstrokes", "the same riff, an octave under, as written"],
      word: v => (v === 0 ? [only("gate", fill(2))] : []),
      // NO insert. The distortion IS the instruments — distortion_guitar and
      // crunch_guitar are recordings of amps already at the edge, and punk is
      // downstroked eighths through them. The crunch insert on top was the
      // one thing everyone heard first, and none of it was the song.
    },

    // AMBIENT [drone]. Drone is a pedal that refuses to move; ambient is the
    // same stillness with a HARMONY inside it — a lydian maj7 cycle two bars
    // to the chord, no drums, no bass at all, a line that surfaces four bars
    // in and barely moves. The moving chord is the entire difference.
    ambient: {
      // named "London 1978" — Music for Airports: the moving maj7 chord inside
      // the stillness, which this comment calls the entire difference.
      label: "London 1978", rate: 0.5, bars: 8, voices: 2, near: "drone",
      instr: ["halo_pad", "bowed_glass"],
      entry: v => v * 4, reg: v => v - 1,
      realize: v => (v === 0 ? "pad" : "line"),
      kit: {}, nobass: true,
      intro: "fade",                 // ambient does not arrive, it surfaces
      harmony: "cycle", roots: [0, 0, 3, 3, 5, 5, 4, 4],
      mode: MODES.lydian, scale: MODES.lydian, diatonic: true,
      prog: [{ d: 0, q: "7" }, { d: 0, q: "7" }, { d: 3, q: "7" }, { d: 3, q: "7" },
             { d: 5, q: "7" }, { d: 5, q: "7" }, { d: 4, q: "7" }, { d: 4, q: "7" }],
      artic: "tie", incClamp: 3, incMode: "reverse",
      tone: { wave: "triangle", cut: 1800, q: 0.8, atk: .3, rel: 3.0, gain: .22, verb: .92 },
      words: ["the pad, two bars to the chord", "a line that surfaces from bar 5"],
      word: v => (v === 1 ? [drop(2)] : []),
      fx: ["echo", "sweep"],
    },

    // TECHNO [acid]. Both are modal machines on a four; the field that
    // separates them is WHERE THE INTEREST LIVES. Acid is one instrument
    // breathing — the 303's filter is the melody. Techno strips even that:
    // no claps, no ghost lane, no sixteenth hats, just the kick, the offbeat
    // open hat, a staccato stab over a metal pad, and the section's own
    // filter sweep doing what the 303's envelope did.
    techno: {
      // named "Detroit 1988" — the Belleville Three's comp that named the
      // sound: the 909 kick and open hat, everything else stripped.
      label: "Detroit 1988", rate: 1, bars: 8, voices: 2, near: "acid",
      instr: ["charang", "metal_pad"],
      drumkit: "tr909",            // Detroit's kick-and-open-hat is the 909's
      entry: v => v * 2, reg: v => v - 2,
      realize: v => (v === 1 ? "pad" : "line"),
      harmony: "modal",
      artic: "staccato", maxHold: 2,
      bassStyle: "sixteenths",
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             o: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0] },
      fill: { o: [0,0,1,0, 0,0,1,0, 1,0,1,0, 1,0,1,1] },
      tone: { wave: "sawtooth", cut: 1400, q: 4, atk: .003, rel: .35, gain: .28, verb: .14 },
      words: ["the stab, thinned every other bar", "the pad underneath"],
      word: (v, s) => (v === 0 && s % 2 ? [del(2)] : []),
      fx: ["sweep"],
    },

    // ---- THE FUNCTION GENRES ---------------------------------------------
    // A genre whose identity is a ROLE and not a style. "What is a Beatles song
    // without a couple of solos" — and until now there was no way to say it: a
    // solo was a section where the host genre played its own line louder. Every
    // other entry in this table answers "what music is this"; these five answer
    // "what is this part DOING", and the answer is the same whatever it is
    // stacked on.
    //
    // WHY THEY ARE GENRES AND NOT A SIXTH FIELD, which is the same argument
    // every other type here had to make. A part is already a genre-shaped
    // thing: it has an instrument, a register, an articulation, a phrase-length
    // cap, a hand, an alphabet and an operator word — that is the whole of what
    // a genre is minus the kit and the bass, and both of those are exactly what
    // the stack already drops from a layer (ui/derive.js). A `solo:true` flag
    // on a box would have to re-invent all nine. Being genres also means they
    // stack, mix, save and appear in the palette with no new machinery
    // anywhere: a person can drag a vocal onto a techno box because the box
    // already knows how to hold a second genre.
    //
    // THE LAW THEY LIVE UNDER is the layer law, which was already written: a
    // stacked genre inherits the authority's harmony, roots, prog, key, mode,
    // rate and swing, and contributes only its pitched voices. So a function
    // genre carries NO prog, NO roots, NO kit and NO bass — nothing that would
    // fight the host — and declares `harmony: "modal"` for the one case where
    // it is the authority itself (a solo on its own is a line over a drone of
    // one chord, which is what an unaccompanied solo is).
    //
    // TWO REGISTER FACTS, both consequences of the layer path rather than
    // choices: a layer renders at `L.reg(v) + 1`, an octave above its standalone
    // self, so `reg` is written for the LAYER case (where these live) and the
    // standalone octave is the one that gives; and PARTS adds its own lean on
    // top (lead +12, riff −12), so the numbers below look one octave low.

    // SOLO. A lead line that rides whatever it is stacked on. Four bars that
    // GO SOMEWHERE — subdivide, fill in, subdivide again, take it up — because
    // a solo that plays the same bar four times is a riff. `anchor` is the
    // phrasing rule that makes it fit over a host it has never met: a note the
    // player SITS on has to be a chord tone, and everything shorter passes
    // exactly as written, which is what a lead player does over changes.
    //
    // THE ALPHABET IS THE HOUSE PENTATONIC and not the blues scale, which was
    // tried first and measured badly for a reason worth writing down: a lead
    // line is MONOPHONIC, so the only simultaneity it has is the hair of
    // overlap the hand's micro-timing leaves between consecutive notes, and
    // over that vanishing denominator the ♭5 landing against the 4 read as the
    // second-clashiest genre in the table (1.78% against a 1.5% bar). The
    // dissonance census is measuring a legato join as a sonority there — see
    // the report — but the pentatonic is the honest default regardless: it is
    // what the rest of the table reads, so a solo and its host share one
    // alphabet by construction, which is the §9e law.
    solo: {
      label: "Solo", rate: 1, bars: 8, voices: 1,
      instr: "overdrive_guitar",
      entry: () => 0, reg: () => -1, realize: () => "line",
      part: ["lead"],
      kit: {}, nobass: true, harmony: "modal",
      swing: 0.16,       // the sixteenths push; nobody solos straight
      // PICKED, NOT SUNG, and it is the axis that separates a solo from the
      // singer standing next to it: staccato and dense against legato and
      // breathing. It is also what makes the two measurably different music
      // rather than two labels on one line — a lead break is individual
      // articulated notes at speed, which is a fact about the stream and not
      // about the sample it is played on.
      artic: "staccato", anchor: 3, maxHold: 4,
      // A RAMP THAT NEVER TURNS AROUND LEAVES THE INSTRUMENT, and a solo is
      // the one part built to be handed the `climb` phrase — measured, the
      // default clamp of seven let a rock solo top out at MIDI 108, two
      // octaves over an overdrive guitar's own ceiling. Three rungs and back
      // down is a lick; seven and up is a siren.
      incClamp: 3, incMode: "reverse",
      intro: "solo",                   // the one genre for which this is a tautology
      tone: { wave: "sawtooth", cut: 3000, q: 1.6, atk: .004, rel: .8, gain: .30, verb: .34 },
      words: ["the break: subdivide, fill in, subdivide again, take it up"],
      // FOUR BARS THAT GO SOMEWHERE. The whole word is about DENSITY climbing:
      // a solo that plays the phrase as written for a bar is not soloing, it is
      // doubling whoever wrote it. Measured against `simple` — the other lone
      // pentatonic line in the table — the two sat 0.030 apart on the confusion
      // metric with the floor at 0.030; the density arc and the articulation
      // put them at 0.057, and both of those are the difference a listener
      // would name first.
      word: (v, s) => [[split(2)], [only("gate", fill(2))], [split(3)],
                       [split(4), transpose(2)]][s % 4],
    },

    // VOCAL. A sung topline, and the whole of what makes it one is WHERE IT
    // STOPS. Three things no instrumental line does, and all three are measured
    // on the rendered stream in §40 rather than asserted here:
    //   it BREATHES  — an absolute window in the bar, twice, whatever rhythm it
    //                  was handed (`breath`). Measured over the composer's own
    //                  toplines as the share of the section spent in a silence
    //                  of at least a beat: 15%, against ZERO for the solo, zero
    //                  for `simple` and zero for a band playing the same phrase.
    //                  Nothing else in the table stops.
    //   it does not LEAP — spread(0.5) halves every degree's distance from the
    //                  centre without moving a note off the alphabet, so the
    //                  contour it was handed survives and the reach does not.
    //                  Mean interval 3.8 semitones against the solo's 5.1 and
    //                  the Beatles' 11.3; 29% of its moves are leaps wider than
    //                  a third, against the solo's 45% and the band's 73%.
    //   it HOLDS     — legato, capped at three steps, so the cap makes a REST
    //                  rather than a longer note. The `breathe` pipe is the belt
    //                  to that brace: the last note of every bar stops short of
    //                  the bar line even where the phrase gated straight through.
    //
    // HOW CONVINCING THIS IS: it is a melody with a voice on it and the
    // phrasing of a singer, which is a real thing. It is not a SUNG melody —
    // there are no words, no consonants and no vibrato, and the sampled choir
    // does not slur between pitches the way a voice does. Read the report.
    vocal: {
      // RATE 0.5 — a sung phrase is TWO BARS of the band's time, not one. It is
      // the plainest difference between a topline and an instrumental line and
      // it costs nothing where the genre actually lives, because a layer takes
      // the authority's rate (the layer law): this is the tempo of a vocal
      // standing on its own. Measured, it is also most of what separates the
      // singer from `simple` on the confusion metric — 0.032 to 0.051.
      label: "Vocal", rate: 0.5, bars: 8, voices: 1,
      instr: "solo_vox",
      entry: () => 0, reg: () => -1, realize: () => "line",
      part: ["lead"],
      kit: {}, nobass: true, harmony: "modal",
      artic: "legato", maxHold: 3, anchor: 2,
      incClamp: 2, incMode: "reverse",   // a singer's range is two rungs, not seven
      intro: "solo",
      pipes: [{ id: "breathe" }],
      tone: { wave: "triangle", cut: 2400, q: 0.9, atk: .03, rel: 1.1, gain: .28, verb: .40 },
      words: ["the topline: two phrases and two breaths"],
      word: () => [spread(0.5), breath(SUNG)],
    },

    // BACKING VOCALS. The other half of a vocal arrangement, and it is not a
    // second melody — it is the SAME line in harmony. Written as the harmonize
    // pipe at probability 1 rather than as a second voice carrying transpose,
    // for the reason PIPES.harmonize exists at all: transpose(2) is parallel in
    // the ALPHABET and clashes with the chord, while the pipe locks its
    // interval to whatever is actually sounding. Slow (rate 0.5), because a
    // backing part holds while the lead moves.
    //
    // THIRDS, NOT SIXTHS, and the census is why. The mode this genre reads
    // contains a ♭6, the sixth-walk snaps it up to the fifth eleven semitones
    // away, and eleven semitones IS a major seventh — measured, backing in
    // sixths was the clashiest genre in the whole table at 7.91%, nearly double
    // blues. In thirds every degree of the mode resolves to a third, a fourth
    // or a fifth and the number is zero. Two singers in thirds is also just
    // what a backing part is.
    backing: {
      label: "Backing vocals", rate: 0.5, bars: 4, voices: 1,
      instr: "ahh_choir",
      entry: () => 0, reg: () => -1, realize: () => "line",
      part: ["counter"],
      kit: {}, nobass: true, harmony: "modal",
      scale: DIATONIC,                 // a choir sings the mode, not the pentatonic
      artic: "legato", maxHold: 4, anchor: 2,
      incClamp: 2, incMode: "reverse",
      intro: "swell",
      pipes: [{ id: "harmonize", p: 1 }],
      tone: { wave: "triangle", cut: 2000, q: 0.8, atk: .06, rel: 1.6, gain: .24, verb: .55 },
      words: ["the stack: the line, and a third over it"],
      word: () => [breath(SUNG), drop(3)],
    },

    // RIFF. The part that ANSWERS, and answering is a TWO-BAR shape: the figure
    // on the offbeats, then the phrase's own rhythm coming back at it a step
    // under. `only("gate", offbeats(4))` is the figure — an absolute grid rather
    // than the phrase's own, so it lands between the downbeats instead of
    // doubling them — and the bar after it is deliberately NOT that, because a
    // riff whose every bar is the same absolute grid has stopped reading the
    // phrase at all: hand it any tune and it plays the identical four notes.
    // Low, short (the two-step hold is what makes it a stab rather than a pad),
    // and it does not develop — a riff that develops is a solo.
    riff: {
      label: "Riff", rate: 1, bars: 2, voices: 1,
      instr: "palm_muted_guitar",
      entry: () => 0, reg: () => 0, realize: () => "line",
      part: ["riff"],
      kit: {}, nobass: true, harmony: "modal",
      artic: "staccato", maxHold: 2, anchor: 2,
      incClamp: 2, incMode: "reverse",   // a riff that walks away is not a riff
      intro: "cold",                   // a riff does not fade in
      tone: { wave: "sawtooth", cut: 1600, q: 1.8, atk: .003, rel: .35, gain: .30, verb: .12 },
      words: ["the figure on the offbeats, then the answer a step under"],
      word: (v, s) => (s % 2 ? [drop(3), transpose(-1)]
                             : [only("gate", offbeats(4))]),
    },

    // PAD. A wash, and the reason it is worth a genre of its own is the one
    // thing the pad path already does for free: it voices THE SOUNDING CHORD,
    // whatever the host's progression is, one voicing a bar, voice-led. Stacked
    // under anything with a prog it is a string section reading the chart. On
    // its own it is eight bars of one chord, which is honest — a pad alone is
    // not a piece of music, it is a pad.
    pad: {
      label: "Pad", rate: 0.5, bars: 8, voices: 1,
      instr: "warm_pad",
      entry: () => 0, reg: () => -1, realize: () => "pad",
      part: ["pad"],
      kit: {}, nobass: true, harmony: "modal",
      artic: "tie",
      // NO `intro` ANCHOR, deliberately, and it is the one place in the table
      // where leaving the field off is the decision rather than the default.
      // "The pad fades up" is the `parts` family's own lean and every other
      // family that owns a wash says it too — declaring it here as well means
      // the anchor coin (compose.js introSections, 0.55) is being asked to
      // choose between padin and padin. Measured: `pad` opened identically at
      // all eight seeds, which is precisely the failure the intro vocabulary
      // was rewritten to end.
      tone: { wave: "triangle", cut: 1600, q: 0.7, atk: .4, rel: 2.6, gain: .22, verb: .78 },
      words: ["the chord, held, one voicing a bar"],
      word: () => [],
    },
  };

  // THE ARRANGEMENT'S COLUMN HEADINGS, one per lane. `p` says "Ghost perc"
  // rather than "Rim" because the ghost layer writes to it and that is what a
  // person sees in the column; the other eleven say what they are.
  const DRUMNAME = { k: "Kick", s: "Snare", c: "Clap", o: "Open hat",
                     h: "Hat", p: "Ghost perc", f: "Pedal hat", r: "Ride",
                     x: "Crash", t: "High tom", m: "Mid tom", l: "Low tom" };

  // ---- FAMILIES — the palette's bank-select clusters -----------------------
  // Forty-five chips in one heap is not a menu, it is a haystack; the palette
  // groups them under these headers. ONE table, not a field written by hand on
  // each anchor: membership and display order are the same fact, a genre
  // cannot land in two families, and the stamp below writes `family` onto the
  // anchor so everything downstream reads it like any other genre field (the
  // unit gate holds every anchor to exactly one). The clusters follow the
  // MUSIC, not the machinery — jodeci and eurythmics are both drum machines,
  // but one is soul and the other is a studio record, and the ear files them
  // that way. `kernel` is simple alone, on purpose: it is the zero of the
  // table and belongs to no tradition.
  const FAMILIES = [
    ["kernel", ["simple"]],
    ["vox",    ["gregorian", "bulgarian", "spem", "counterpoint", "fugue"]],
    ["club",   ["acid", "house", "techno", "garage", "dnb", "trap", "boombap"]],
    ["soul",   ["motown", "isley", "funk", "disco", "gospel", "rnb", "jodeci"]],
    ["groove", ["reggae", "dub", "ska", "afrobeat", "bossa"]],
    ["band",   ["rock", "punk", "blues", "newwave", "sludge", "deathmetal"]],
    ["studio", ["beatles", "steely", "toto", "eurythmics", "synthpop", "citypop"]],
    ["drift",  ["ambient", "drone", "vaporwave", "shoegaze", "postrock", "neoclassical"]],
    ["roots",  ["countrypop", "tango"]],
    // ...and the one cluster that is not a tradition at all: the FUNCTION
    // genres, which are parts rather than styles. They sit last because that
    // is how they are used — you pick the music first and the part second.
    ["parts",  ["solo", "vocal", "backing", "riff", "pad"]],
  ];
  for (const [fam, keys] of FAMILIES)
    for (const k of keys) GENRES[k].family = fam;

  // ---- DYNAMICS — how much PLAYER each genre has in it ---------------------
  // The three fields kernel.js's performance layer reads: `stress` (how hard
  // the metre is felt), `phrase` (how much arch the line gets, agogic peak
  // included) and `touch` (the hand — seeded micro-timing in steps and
  // micro-level in velocity units, redrawn every bar). Absent is byte-identical
  // to the day before they existed, which is why the machines can simply say
  // nothing and stay exactly as they were.
  //
  // WRITTEN AS A TABLE AND STAMPED, exactly like `family` two lines above, and
  // for the same reason: family membership and dynamic temperament are both
  // facts about a whole CLUSTER first and about the individual anchor second.
  // A default per family plus the handful of anchors that genuinely disagree is
  // the honest shape; one hand-written triple per anchor would be one place per
  // anchor for it to rot, and the ones that matter are the exceptions.
  const DYN_FAMILY = {
    kernel: { stress: 0.35, phrase: 0.55, touch: { t: 0.05,  v: 0.7 } },
    // choral music is nearly all phrase and hardly any metre — the barline is a
    // scribe's convenience, the shape of the line is the music
    vox:    { stress: 0.22, phrase: 0.8,  touch: { t: 0.045, v: 0.55 } },
    // there is deliberately NO `club` row: the floor is a machine by
    // construction and its seven members disagree about it individually — four
    // are machines outright and three are the sampled corners where a hand is
    // in the loop — so every one of them is named below. A club genre added
    // without an entry resolves to nothing and renders flat forever, which is
    // the failure this table exists to prevent; §39 fails on it by name rather
    // than letting a default paper over it.
    soul:   { stress: 0.5,  phrase: 0.45, touch: { t: 0.07,  v: 1 } },
    groove: { stress: 0.42, phrase: 0.4,  touch: { t: 0.06,  v: 0.85 } },
    band:   { stress: 0.5,  phrase: 0.35, touch: { t: 0.05,  v: 0.95 } },
    // a studio record is played by people and then edited by people
    studio: { stress: 0.35, phrase: 0.4,  touch: { t: 0.035, v: 0.6 } },
    drift:  { stress: 0.12, phrase: 0.6,  touch: { t: 0.05,  v: 0.6 } },
    roots:  { stress: 0.45, phrase: 0.5,  touch: { t: 0.06,  v: 0.8 } },
    // A FUNCTION GENRE IS THE PLAYER, and that is nearly a definition: the part
    // that is stacked ON something is the one somebody is playing by hand over
    // a track. High phrase, real touch, and only as much metre as a soloist
    // leans on — the host is keeping time, that is what the host is for.
    parts:  { stress: 0.3,  phrase: 0.75, touch: { t: 0.06,  v: 1 } },
  };
  const DYNAMICS = {
    // THE MACHINES, and null means it: a 303 sequence and a four-on-the-floor
    // kick do not breathe, and making them breathe would be a costume. These
    // four render byte-for-byte what they rendered before the layer existed,
    // and the unit gate holds them to it by fingerprint.
    techno: null, acid: null, house: null, trap: null,
    // ...and the sampled corners of the same floor, which are hands: an MPC
    // with the quantize off, a garage shuffle, breaks cut by an editor rather
    // than played (tight time, real level moves).
    boombap: { stress: 0.35, phrase: 0.25, touch: { t: 0.06,  v: 0.9 } },
    garage:  { stress: 0.3,  phrase: 0.2,  touch: { t: 0.04,  v: 0.7 } },
    dnb:     { stress: 0.2,  phrase: 0.15, touch: { t: 0.015, v: 0.5 } },
    // plainchant has no metre AT ALL — the whole point — so the stress term is
    // nearly off and every drop of shape comes from the line
    gregorian: { stress: 0.06, phrase: 0.9, touch: { t: 0.06, v: 0.5 } },
    // a fugue is the tight end of the human range: four voices only stay
    // legible if they agree about where the beat is
    fugue:     { stress: 0.3,  phrase: 0.7,  touch: { t: 0.025, v: 0.4 } },
    // the drone refuses to move, and its `tie` is exactly the material the
    // timing hand must not touch (kernel.js perform, `ontime`) — level and the
    // long peak are the only dynamics a held note has
    drone:     { stress: 0.05, phrase: 0.35, touch: { t: 0,    v: 0.5 } },
    ambient:   { stress: 0.06, phrase: 0.65, touch: { t: 0.05, v: 0.5 } },
    // vaporwave is a RECORD being played back, not a band being recorded: a
    // little wow on the tape, almost no metre of its own
    vaporwave: { stress: 0.1,  phrase: 0.4,  touch: { t: 0.045, v: 0.4 } },
    // funk is the loosest thing in the table and it is loose ON PURPOSE — the
    // sixteenths are where the groove lives and no two of them are equal
    funk:      { stress: 0.6,  phrase: 0.4,  touch: { t: 0.085, v: 1.2 } },
    // punk plays tight and hits everything: the time barely moves, the level
    // moves a lot. Death metal is the same trade taken further.
    punk:      { stress: 0.55, phrase: 0.25, touch: { t: 0.03,  v: 1.1 } },
    deathmetal:{ stress: 0.6,  phrase: 0.2,  touch: { t: 0.02,  v: 1 } },
    blues:     { stress: 0.5,  phrase: 0.5,  touch: { t: 0.08,  v: 1.1 } },
    // rubato is the tango's signature — the line stretches and the band waits
    tango:     { stress: 0.4,  phrase: 0.75, touch: { t: 0.075, v: 0.9 } },
    // a piano played by a person is the case the whole layer was written for
    neoclassical: { stress: 0.3, phrase: 0.8, touch: { t: 0.06, v: 0.8 } },
    // drum machines with singers over them: the machine is the floor, the
    // performance is on top, so metre stays modest and the level moves
    jodeci:    { stress: 0.3,  phrase: 0.5,  touch: { t: 0.04,  v: 0.8 } },
    rnb:       { stress: 0.35, phrase: 0.55, touch: { t: 0.05,  v: 0.85 } },
    eurythmics:{ stress: 0.25, phrase: 0.35, touch: { t: 0.02,  v: 0.55 } },
    synthpop:  { stress: 0.25, phrase: 0.35, touch: { t: 0.02,  v: 0.5 } },
    // THE THREE FUNCTION GENRES THAT DISAGREE WITH THEIR FAMILY. A riff is
    // metre — it is the part that is NOT expressive, that is its job. A pad has
    // no metre and barely a hand (the chord path reads stress and touch and
    // nothing else, kernel.js chordFeel), so what is left is level. And a
    // singer is the most phrase and the least metre of anything in the table.
    riff:      { stress: 0.6,  phrase: 0.15, touch: { t: 0.03,  v: 0.9 } },
    pad:       { stress: 0.08, phrase: 0.4,  touch: { t: 0.02,  v: 0.6 } },
    vocal:     { stress: 0.18, phrase: 0.9,  touch: { t: 0.07,  v: 0.9 } },
  };
  // NO SILENT DEFAULT (the compose.js law, one tier down): a genre resolves to
  // its own row or to its family's, and `null` is a DECISION rather than an
  // omission. Nothing here invents a fallback for a genre that resolves to
  // neither — the gate names it instead.
  for (const k of Object.keys(GENRES)) {
    const d = Object.prototype.hasOwnProperty.call(DYNAMICS, k)
      ? DYNAMICS[k] : DYN_FAMILY[GENRES[k].family];
    if (!d) continue;
    GENRES[k].stress = d.stress; GENRES[k].phrase = d.phrase; GENRES[k].touch = d.touch;
  }

  const api = { DEFAULT, GENRES, DRUMNAME, MODES, MODELABEL, SCALES, SCALELABEL,
                PROGS, FAMILIES, DYNAMICS, DYN_FAMILY };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuGenres = api;
})(typeof window !== "undefined" ? window : globalThis);
