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

  // ---- THE MOUTHS ----------------------------------------------------------
  // WHO IS SINGING. A genre that casts a vocal instrument used to get one held
  // "aah" — six zones, one recording, one dynamic, one vowel it could never
  // leave — for a crooner, a plainchant, a boy band and a Bulgarian women's
  // choir alike, which is why every voice on the record sounded like the same
  // squeak with a different reverb on it. The engine now has a vocal tract
  // (engine/faust/dsp/voice_tract.lib) and the tract wants to be TOLD things,
  // so a mouth is what a genre says about its singer:
  //
  //   voice   which of the five voice types the formant tables know —
  //           alto, bass, countertenor, soprano, tenor. It picks the whole
  //           formant set AND the compass the line is folded into.
  //   vowels  what they sing, one per syllable, walked along the line. This is
  //           the field a sample cannot have at all.
  //   vib     how much they wobble, 0..1. 0 is a straight tone, which is not an
  //           absence of expression — it is plainchant, and it is the Bulgarian
  //           sound, and it is what makes both of them not sound like opera.
  //   air     how much breath is in it, 0..1.
  //   blend   sections only: how ragged they are, 0..1. It moves the detune and
  //           the entry stagger together, because a tight studio stack is close
  //           in tune AND on the beat and a room full of people is neither.
  //   syll    beats per syllable, where the default (half a beat for a line, a
  //           bar for a held chord) is wrong for the music.
  //
  // AND THE OTHER KIND OF MOUTH, added 2026-08-18: the two singers above are
  // FORMANT BANKS, which model a held vowel very well and a consonant not at
  // all, because a bank of filters cannot SHUT. The engine now also has a TUBE
  // — engine/faust/dsp/tract_voice.dsp, a Kelly-Lochbaum waveguide with a
  // tongue, a velum and a nose — and a tube can close, build pressure and let
  // go, which is what a consonant is. A genre reaches it by casting `synth_voice`
  // (GM 54, "synth voice") on a LINE chair, and it may say four more things:
  //
  //   talk    0..1, how much of the seeded syllable driver is steering the
  //           articulators. 1 is speech; 0 is a held vowel and OPTS OUT, back to
  //           the VP-330 string machine, because a tract that is not articulating
  //           is a formant bank that costs four times as much.
  //   hiss    0..1, the fricative — the s and the sh
  //   nasal   0..1, the velum
  //   voiced  0..1 — take it down and the tube whispers, which no formant bank
  //           in this tree can do at all
  //
  // (`rate` and `seed` are deliberately NOT in that list. Syllables a second
  // comes off the TEMPO, two to a beat, so a mouth speaks in eighths with the
  // record rather than at a number somebody typed over a ballad and a jungle
  // alike; and which sentence comes off the voicing, so a genre says the same
  // thing forever and two genres do not say the same thing. Both are overridable
  // and neither should need to be.)
  //
  // ON A PAD CHAIR THE SAME ID STILL MEANS THE STRING MACHINE, and that is not a
  // fallback, it is the other true reading of the name: "synth voice" on a pad in
  // 1979 was a Roland VP-330 holding a vowel, and on a lead in 1978 it was a
  // formant speech synthesiser. The chair decides. It is also the cost ceiling —
  // the tube renders at 0.353x realtime against the formant singer's 0.089x, so
  // it affords about TWO voices where the singer affords eleven, and a pad wants
  // four of whatever it is handed. Three records talk (electro, robotic pop,
  // EBM); the roster is pinned by name in test/unit/tract-cast.test.js.
  //
  // A mouth lives INSIDE the genre's `tone` block, which is where the bridge
  // (audio/to-engine.js voiceForInstr) is already handed the genre's voicing on
  // both the live path and the tape. `tone` is a NOUN in this file's own
  // doctrine — it snaps, it does not blend — and so is a singer.
  //
  // These are named after the RECORD and not after the vocal technique, the
  // same way the kits and the progressions are.
  const MOUTHS = {
    // the sacred ones, and what separates them is almost entirely the VIBRATO
    plainchant: { voice: "tenor",  vowels: "ae",  vib: 0,    air: 0.30, blend: 0.55 },
    motet:      { voice: "countertenor", vowels: "aeo", vib: 0.12, air: 0.26, blend: 0.7, syll: 8 },
    hymnal:     { voice: "alto",   vowels: "ao",  vib: 0.2,  air: 0.22, blend: 0.8 },
    // the fourth sacred one, and the least European-sounding: the open-throated
    // straight tone of a Bulgarian women's choir — no wobble at all, pressed
    // hard, and packed tight enough that the seconds grind
    bulgar:     { voice: "soprano", vowels: "eai", vib: 0,   air: 0.10, blend: 0.35, syll: 2 },
    // the American church and what came out of it
    gospelchoir:{ voice: "alto",   vowels: "aoe", vib: 0.55, air: 0.20, blend: 0.9 },
    // a man alone at a microphone in 1955: low, slow, and the vibrato arrives
    // late in the note, which is the whole trick
    crooning:   { voice: "bass",   vowels: "oau", vib: 0.7,  air: 0.18, vibRate: 4.6, vibRise: 1.1, syll: 1 },
    // four men round one mic, and the lead on top of them
    doowopstack:{ voice: "tenor",  vowels: "ou",  vib: 0.3,  air: 0.16, blend: 0.65, syll: 2 },
    // the British group harmony: bright, close, and only a little wobble
    merseystack:{ voice: "tenor",  vowels: "aou", vib: 0.25, air: 0.14, blend: 0.45, syll: 2 },
    // a boy band is a COUNTERTENOR pushed high and stacked TIGHT — the tightness
    // is the production, and it is what makes it sound like a machine of people
    boygroup:   { voice: "countertenor", vowels: "ieo", vib: 0.35, air: 0.12, blend: 0.25, syll: 1 },
    // one voice at the front of a big chorus, belting
    belter:     { voice: "soprano", vowels: "aei", vib: 0.75, air: 0.16, vibRate: 6.1, vibRise: 0.4, syll: 1 },
    // rough, close, and almost no air in it
    skiffler:   { voice: "tenor",  vowels: "eao", vib: 0.15, air: 0.34, vibRate: 5.9, syll: 0.5 },
    // the modern pop lead: bright, breathy, wobble late
    poplead:    { voice: "alto",   vowels: "aei", vib: 0.4,  air: 0.28, vibRise: 0.9, syll: 0.5 },
    // the soft dreaming ones — a wash of voices, barely articulated
    dreamchoir: { voice: "alto",   vowels: "uo",  vib: 0.25, air: 0.4,  blend: 0.85, syll: 8 },
    // and the room-in-the-back backing vocal: quiet, round, out of the way
    backingroom:{ voice: "alto",   vowels: "ou",  vib: 0.2,  air: 0.3,  blend: 0.7, syll: 4 },
    // THE THREE THAT WERE BEING SUNG BY A MACHINE. Each of these genres already
    // said in its own `words` that a PERSON was singing — "the melisma, with
    // its rests", "the falsetto, held over the changes", "telling the story" —
    // and each was cast on a synthesiser: two on `synth_voice` (the VP-330, a
    // Roland string-choir, which the bridge is right to refuse to model as a
    // person) and one on nothing at all.
    //   a nineties ballad lead holds ONE vowel over many notes, which is what
    // the word melisma means: `syll` 2 is two beats before the mouth moves, and
    // it is the only place in this table that number goes above one for a solo
    melisma:    { voice: "alto",   vowels: "aoe", vib: 0.5,  air: 0.24, vibRate: 5.7, vibRise: 0.5, syll: 2 },
    // the falsetto is a COUNTERTENOR by construction — that is what the fifth
    // formant set is — and it is nearly straight, because the wobble is the
    // thing a moody head-voice record deliberately does not have
    falsetto:   { voice: "countertenor", vowels: "uoa", vib: 0.12, air: 0.42, vibRate: 5.0, vibRise: 1.4, syll: 4 },
    // close, plain and full of breath: a voice a foot from the mic telling you
    // something. The wobble arrives late and never gets wide.
    confessional:{ voice: "alto",  vowels: "aoe", vib: 0.28, air: 0.32, vibRate: 5.2, vibRise: 0.85, syll: 0.5 },
  };

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

  // ---- LINEAGE — genre as a combination of earlier genres ------------------
  // Paul, 2026-08: "Beatles is counterpoint plus Bo Diddley plus skiffle…
  // that might be interesting if we started to see genre as mixing." Every
  // real (place-year) anchor below declares `parents`: weighted references to
  // OTHER anchors in this table, the weights a claim about SHARE (they sum to
  // 1) and the comment beside them the historical argument. Where a true
  // parent is not in the catalog yet — delta blues, mento, Moroder — `wants`
  // names it as a plain lowercase string: that list is the shopping order,
  // ancestors in their own names. It is a working list and not a monument:
  // phase 2 built the eight it demanded loudest (see THE ANCESTORS below),
  // and every anchor that had asked for one moved a name off `wants` and
  // into `parents` on the same day. A genuine root
  // (or an anchor whose every parent is missing) declares parents: {}
  // honestly and its comment says which of the two it is. The six FUNCTION
  // genres (simple/solo/vocal/backing/riff/pad) declare nothing: a role has
  // a job, not a history. ANNOTATION ONLY — nothing in kernel/compose/derive
  // reads these two fields, and the unit gate (§48) holds every rendered
  // schedule byte-identical with them stripped. The fit — how much of each
  // child its declared parents actually explain, feature by feature, and how
  // big the leftover invention is — is nukernel/genealogy.js (hand-run;
  // findings committed in nukernel/GENEALOGY.md).
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
      // LINEAGE: a fugue is species counterpoint set in MOTION — Bach taught
      // from Fux's Gradus — over subjects whose stepwise grammar is chant's;
      // the missing third is the Lutheran chorale his subjects harmonized.
      parents: { counterpoint: 0.7, gregorian: 0.3 },
      wants: ["chorale"],
      // A FUGUE IS PIPES. `rock_organ` is a Hammond with a rotary cabinet and
      // an overdrive on it — the right organ for sophisti-rock and the wrong
      // century for Leipzig. church_organ is the same six-zone extraction with
      // a flue rank in it, which is the instrument the subject was written for.
      instr: "church_organ",
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
      // LINEAGE: Phuture were house DJs — acid is house with the bassline
      // machine abused until the filter became the melody; the machine-funk
      // lean underneath is P-funk, and it reached Chicago through ELECTRO,
      // which is now in the table and takes its own share — a debt paid, not
      // an ancestor nobody thought about, so `wants` empties rather than
      // keeping a name it no longer needs.
      parents: { house: 0.7, electro: 0.15, funk: 0.15 },
      wants: [],
      // A CLEAN ELECTRIC GUITAR, on an acid record. Nothing played it — the
      // signature synth below covers both voices — but the desk said it, the
      // cast pool offered it, and casting one really did put a guitar where
      // the machine goes. GM 88 is "bass + lead", the one patch that names a
      // monosynth doing both jobs, and to-engine.js routes it to the same
      // tb303 declared below: the label and the sound are one thing again.
      instr: "bass_lead",
      // the kit vector below has always said "909, four on the floor" — and
      // the SOUND is the machine it names (the engine's kick909/snare_crack)
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
      // ...AND THE SQUELCH IS TURNED BACK UP. Measured on a rendered Chicago
      // 1987 (2026-08-18): the resonant peak moved 1.14 octaves and Essentia's
      // Discogs classifier heard Electro, Experimental and AMBIENT — no acid
      // house at all. A 303 line sweeps two to three octaves; that is the whole
      // sound. resonance 0.58 and envmod 0.42 are both about half of what the
      // instrument does, and the comment above admits the reason — the chirp was
      // read as a bleep and both knobs were backed off to stop it. That trade
      // removed the genre. envmod x resonance IS the squelch: a big envelope
      // into a near-self-oscillating filter, re-sweeping on every accented note.
      synth: { dsp: "tb303", root: "tb303", level: 0.85,
               set: { cutoff: 300, resonance: 0.86, envmod: 0.85, decay: 0.62, waveform: 0 } },
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],     // 909, four on the floor
             c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             o: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             h: [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1] },
      // THE DRUM MIX IS A HAND, not a switch: every lane at level 1 rendered
      // kick, hat tick, open hat and clap at one loudness — a drum machine
      // with every fader at unity. The 909 on an acid record sits kick-first
      // (9), the offbeat OPEN hat is the pump and rides just under it (7),
      // the closed 16th ticks are air between the beats (3, lifted to 4 into
      // beat 3), and the clap answers at 8. Velocity, not pattern: the grid
      // above is untouched.
      kitVel: { k: [9], c: [8], o: [7], h: [0,3,0,3, 0,4,0,3, 0,3,0,4, 0,3,0,3] },
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
      // LINEAGE: punk's clipped economy played by people who secretly loved
      // pop hooks (the Cars are beatlesque to the bone) over a straight
      // dance-floor eighth pulse disco normalized; the synth sheen on top is
      // Kraftwerk's, one row up — the smallest of that anchor's four edges,
      // taken off beatles and disco alike, because what disco gave new wave
      // is the four on the floor and not the timbre.
      parents: { punk: 0.4, beatles: 0.3, disco: 0.2, kraftwerk: 0.1 },
      wants: ["glam rock"],
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
      // LINEAGE: the records vaporwave actually slows down ARE city pop and
      // quiet-storm R&B; the stillness it slows them into is Eno's ambient.
      // The missing parents are the unglamorous ones — muzak, and the
      // chopped-and-screwed technique that taught it the wrong speed.
      parents: { citypop: 0.4, rnb: 0.3, ambient: 0.3 },
      wants: ["muzak", "chopped and screwed"],
      // THE PAD IS A STRING MACHINE, NOT AN ORCHESTRA. What vaporwave slows
      // down is a 1984 ballad, and the wash on that record is a Solina/ARP
      // ensemble — chorus and all — rather than a section of players. GM 51
      // is that machine's own patch id and to-engine.js plays it on the
      // parent's `solina`, so the pad stops being a sampled string section
      // pitched down and becomes the box it always was.
      instr: ["synth_strings_1", "legend_ep_2"],
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
      // actually made of; the pad stays off the DX7 because a DX7 node is
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
      // LINEAGE: a root UNDER PROTEST — Chess electrified the Delta, and
      // every actual parent (delta blues, boogie-woogie piano, jump blues)
      // is a missing anchor, so in this catalog the blues starts the tree.
      parents: {},
      wants: ["delta blues", "boogie-woogie", "jump blues"],
      // AN ARCHTOP AND A HARP, because the anchor is a BAND and not a porch:
      // Chess in 1952 is a hollow-body through a small valve amp with Little
      // Walter's amplified harmonica answering it. The steel-string acoustic
      // this used to cast is the Delta record the comment above says this
      // deliberately is not.
      instr: ["jazz_guitar", "harmonica"],
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
      //
      // AND THE SHUFFLE IS IN THE NUDGE LANE, NOT ON THE SWING DIAL. `swing`
      // bends ODD sixteenths; every hit on this kit is written on an EVEN one,
      // so for as long as the ride said "shuffled by swing" it was not shuffled
      // at all — the guitar swung its sixteenths and the drummer played
      // straight eighths underneath, two players 47 ms apart at this tempo,
      // which is what "the drums are completely off" sounds like. The off-beat
      // eighths (steps 2/6/10/14) are placed BY HAND, four ninths of a step
      // late, exactly as the `jazz` anchor places its "da" — the alphabet stops
      // at four because a hit nudged further is nearer the next step than its
      // own, so a literal 2:1 triplet is not sayable here and 1.6:1 is the
      // shuffle a rhythm section actually plays. The KICK'S and-of-2 is on that
      // same off-eighth and moves WITH the ride; leaving it on the grid would
      // flam it against the cymbal at the busiest point in the bar.
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             "~k":[0,0,0,0, 0,0,4,0, 0,0,0,0, 0,0,0,0],  // the and-of-2 rides along
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             r: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
             "~r":[0,0,4,0, 0,0,4,0, 0,0,4,0, 0,0,4,0],  // the "da", placed by hand
             f: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0] },  // the left foot
      // A HAND, NOT A GRID. Nothing else in the table moves off the grid at
      // all; a blues band is the one place where that reads as wrong rather
      // than as tight. Five hundredths of a step, redrawn every bar, seeded —
      // the same take every time you press play.
      humanize: 0.05,
      // ...and the turnaround gets the tom the twelfth bar has always had. Its
      // two off-eighth strokes (the snare's and-of-3, the low tom's and-of-4)
      // carry the same hand as the ride above; the beat-4 tom does not, because
      // it is on the beat.
      fill: { s: [0,0,0,0, 1,0,0,0, 0,0,1,0, 0,0,0,0],    // bar 12: the turnaround
              "~s":[0,0,0,0, 0,0,0,0, 0,0,4,0, 0,0,0,0],
              m: [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
              l: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0],
              "~l":[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,4,0],
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
      // LINEAGE: Zeppelin is Chess blues played louder by a British beat
      // band — the riff-over-backbeat is electric blues, the band format and
      // the songs are the Beatles' invasion. Both of the ancestors this
      // entry used to name are anchors now: the guitar LANGUAGE every British
      // riff band learned first is Chuck Berry's off 45s rather than Muddy's
      // off Chess LPs, and skiffle is why Page and Jones owned a guitar at
      // all — upstream of the music, which is why it takes a tenth and no
      // more.
      parents: { blues: 0.45, chuckberry: 0.2, beatles: 0.25, skiffle: 0.1 },
      wants: [],
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
      // LINEAGE: the one TRUE root. What chant descends from — synagogue
      // psalmody, Byzantine and Gallican practice — predates anything this
      // catalog could ever hold as an anchor, so the empty wants is honest.
      parents: {},
      wants: [],
      instr: "ahh_choir",
      entry: () => 0, reg: v => -v, realize: () => "line",
      kit: {}, nobass: true, harmony: "modal",
      intro: "solo",                 // chant begins as one voice, always
      mode: MODES.dorian, scale: DIATONIC,
      artic: "legato", incClamp: 2,
      tone: { wave: "triangle", cut: 2100, q: 0.7, atk: .09, rel: 2.2, gain: .26, verb: .78,
              // WHO SINGS: a hall of monks on one line: no vibrato at all, which is what makes it
              mouth: MOUTHS.plainchant },
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
      // LINEAGE: a root under protest — the radio choir ARRANGED a village
      // diaphony older than notation; the ison under it is Orthodox chant's,
      // and neither parent is in the catalog. Gregorian is chant, but the
      // wrong church: claiming it would be tidier than it is true.
      parents: {},
      wants: ["village diaphony", "orthodox chant"],
      instr: "ohh_voices",
      drumkit: "acoustic",
      entry: () => 0, reg: v => v, realize: () => "line",
      harmony: "modal", mode: MODES.phrygian, scale: DIATONIC,
      bassStyle: "pedal",
      bassGrid: [1,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,1,0],
      kit: { k: [1,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,1,0],
             p: [0,0,1,0, 1,0,0,0, 0,1,0,1, 0,0,0,1] },
      artic: "legato",
      tone: { wave: "sawtooth", cut: 2600, q: 1.4, atk: .03, rel: 1.1, gain: .26, verb: .5,
              // WHO SINGS: the open-throated straight tone, packed tight enough that the seconds grind
              mouth: MOUTHS.bulgar },
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
      // LINEAGE: Tudor polyphony is species counterpoint at architectural
      // scale over chant-shaped lines. The label years invert — Fux's 1725
      // textbook CODIFIES the Palestrina-era practice Tallis worked in — so
      // the practice precedes its anchor, which the comment law allows.
      parents: { counterpoint: 0.55, gregorian: 0.45 },
      wants: [],
      instr: "ahh_choir",
      entry: v => v, reg: v => (v % 4) - 1, realize: () => "line",
      kit: {}, nobass: true, harmony: "emergent",
      mode: MODES.dorian, scale: DIATONIC, artic: "legato",
      tone: { wave: "triangle", cut: 2400, q: 0.8, atk: .07, rel: 2.6, gain: .17, verb: .85,
              // WHO SINGS: forty parts of countertenor, one vowel to the phrase
              mouth: MOUTHS.motet },
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
      // LINEAGE: the cantus firmus IS a chant-shaped line — Fux's whole
      // method is rules for adding a voice to one, which is organum's move
      // formalized five centuries later. One parent, and it is the root.
      parents: { gregorian: 1 },
      wants: ["organum"],
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
      // LINEAGE: Frahm is ambient's production values and drone's patience
      // applied to a piano figure, with post-rock's slow-arrival arc; the
      // parent that owns the FIGURE is minimalism, now anchored: Frahm's and
      // Richter's left hand is a repeating cell turning over under a chord
      // that moves slower than it does, and its 0.2 comes almost entirely out
      // of drone — declared at 0.3 and fitted at 0.00, the largest
      // declared/fitted gap the table had. The romantic miniature (Satie,
      // Chopin's nocturnes) is still owed.
      parents: { ambient: 0.4, postrock: 0.25, minimalism: 0.2, drone: 0.15 },
      wants: ["romantic piano miniature"],
      // THE SENTENCE ABOVE IS THE CAST: "sustained strings holding one chord
      // a bar while a piano figure turns over them, and a second piano an
      // octave up". Voice 0 is the pad chair, so it is the strings; the felt
      // piano — still the anchor's own instrument — plays both figures.
      instr: ["slow_strings", "felt_piano", "felt_piano"],
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
      // LINEAGE: a root under protest — Young's held tones came from
      // Hindustani raga (he studied under Pran Nath), gagaku and organum's
      // sustained fifths, none of which the catalog holds. Chant is the
      // nearest anchor and still the wrong claim: chant MOVES.
      parents: {},
      wants: ["hindustani raga", "gagaku", "organum"],
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
      // LINEAGE: NOLA sludge is hardcore punk slowed into blues feel —
      // Eyehategod is a punk band playing at doom tempo with a blues hand;
      // the missing link between them is Sabbath, the doom that showed rock
      // where the bottom was.
      parents: { punk: 0.4, rock: 0.35, blues: 0.25 },
      wants: ["doom"],
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
      // LINEAGE: a root under protest — the habanera cell, the milonga it
      // sped up from, candombe's drums and the European salon harmony all
      // predate the catalog; the 3-3-2 arrived by boat and none of the boats
      // are anchors yet.
      parents: {},
      wants: ["habanera", "milonga", "candombe", "salon music"],
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
      // LINEAGE: the blast beat is hardcore's D-beat run past its limit and
      // the riff wall is rock's language forced chromatic — but the actual
      // parents, thrash and the NWOBHM it fed on, are the missing rungs of
      // the metal ladder.
      parents: { punk: 0.55, rock: 0.45 },
      wants: ["thrash metal", "nwobhm"],
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
      // LINEAGE: Basildon's machines with a soul singer over them — Lennox
      // is Motown phrasing on a synthpop chassis, and the bass pulse is
      // funk's octave engine sequenced; the machine aesthetic itself is
      // Kraftwerk's, and synthpop was carrying it as a proxy — so synthpop
      // gives the most back. Motown gives a nudge too: Lennox's phrasing is
      // Hitsville, but "a sequencer and a drum machine and nothing else in
      // the room" is a description of Kling Klang's floor plan. `wants` empties
      // — Düsseldorf was the whole of this anchor's shopping list.
      parents: { synthpop: 0.4, motown: 0.25, kraftwerk: 0.2, funk: 0.15 },
      wants: [],
      // "nothing else in the room" — so not a string ensemble. The riff is a
      // monosynth (the modeld below plays it) and the answer is a poly; both
      // ids route to real analog modules, which is what the sentence above
      // this entry has always claimed the room contains.
      instr: ["saw_wave", "polysynth"],
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
      // LINEAGE: church-trained voices (the brothers began in gospel), funk's
      // groove under the Rhodes, and the fuzz lead is rock's gift returned —
      // Hendrix was literally their sideman in 1964. The doo-wop they
      // actually started as is an anchor now and takes a tenth and a half,
      // mostly out of funk — the 3+3 groove was carrying both the pocket and
      // the vocal-group blend. (The fit asks for nearly twice that; 0.15 is
      // what the history claims, and the gap is the finding.)
      parents: { gospel: 0.3, funk: 0.3, rock: 0.25, doowop: 0.15 },
      wants: ["hendrix"],
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
      // LINEAGE: session players raised on Steely Dan's studio craft playing
      // a rock band's form over funk's pocket; the rolling tom lope is the
      // African percussion loop the record borrows and the catalog lacks.
      parents: { steely: 0.45, rock: 0.3, funk: 0.25 },
      wants: ["african percussion", "yacht rock"],
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
      label: "Charlotte 1991",
      rate: 1, bars: 4, voices: 2, swing: 0.28,
      // LINEAGE: gospel melisma from the Haileys' church over funk's pocket
      // quantized into a drum machine, with Motown's songcraft underneath;
      // the swung-sixteenth TECHNIQUE is Teddy Riley's new jack swing, and
      // the hip-hop drum programming it rode in on is missing too.
      parents: { gospel: 0.5, funk: 0.3, motown: 0.2 },
      wants: ["new jack swing", "hip-hop drum programming"],
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
      tone: { wave: "triangle", cut: 2400, q: 1.1, atk: .01, rel: 1.0, gain: .26, verb: .42,
              // WHO SINGS: the bed of voices under the Rhodes, barely articulated
              mouth: MOUTHS.dreamchoir },
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
      // LINEAGE — the program's FOUNDING EXAMPLE ("Beatles is counterpoint
      // plus Bo Diddley plus skiffle"): rhythm & blues learned off Chess
      // imports, Motown covers all over the early setlists, Nashville
      // fingerpicking in the guitars, and part-writing craft — the thirds,
      // the voice-leading — that is counterpoint by ear. ALL FOUR OF THE
      // ANCESTORS THIS ENTRY USED TO NAME ARE ANCHORS NOW, and between them
      // they take 55% — not because they are new ingredients but because they
      // are the DOORS the old four came through: the Quarrymen were a skiffle
      // group (that is the band's own first form, so it goes first), what
      // Liverpool heard of "the blues" was largely Chuck Berry 45s, the beat
      // under the early setlists is Bo Diddley's, and the stacked thirds
      // behind Lennon are the corner rather than counterpoint. So blues,
      // motown and countrypop each step back and counterpoint — the one claim
      // a rhythm figure and a harmony stack cannot explain, and the one the
      // fit keeps using — barely moves. Nothing is left on the list.
      parents: { skiffle: 0.18, chuckberry: 0.15, doowop: 0.12, bodiddley: 0.1,
                 blues: 0.12, motown: 0.1, countrypop: 0.08, counterpoint: 0.15 },
      wants: [],
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
      tone: { wave: "triangle", cut: 2600, q: 0.9, atk: .005, rel: .7, gain: .28, verb: .26,
              // WHO SINGS: three men round one microphone, bright and only a little wobble
              mouth: MOUTHS.merseystack },
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
      // LINEAGE: a rock band's format carrying blues changes dressed in
      // Motown's session polish — but the dorian IV7, the walking bass and
      // the shuffle all pointed at the catalog's one great hole: jazz. It is
      // filled, and jazz takes the largest single share almost entirely out of
      // BLUES (0.35 -> 0.10) — that is the honest bookkeeping, since all three
      // of those things arrive here through 52nd Street rather than through
      // Chess. The band format and the session polish barely move.
      parents: { jazz: 0.35, rock: 0.3, motown: 0.25, blues: 0.1 },
      wants: ["bacharach"],
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
      // LINEAGE: a rock band playing ambient's material — guitars, bass and
      // drums refusing the song in favour of the arc — through shoegaze's
      // wall of reverb; the motorik patience underneath is krautrock's, still
      // owed, and the additive build is minimalism's, which is anchored now.
      // Its 0.15 comes off shoegaze (which was standing in for an
      // arrival-shape it does not own — its claim is the wall) and off
      // ambient, itself downstream of the same source; rock is untouched.
      parents: { ambient: 0.35, rock: 0.3, shoegaze: 0.2, minimalism: 0.15 },
      wants: ["krautrock"],
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
      // LINEAGE: the `near` field already told the truth — boom bap's chops
      // ARE the Isley-shaped soul records it samples, its breaks are funk
      // and disco 45s. Boom bap does not sample electro, but electro is the
      // record that taught New York a track could be BUILT rather than
      // played, and the machine under the chopped loop is a direct
      // inheritance from the borough next door ten years earlier — a nickel
      // off each declared parent, no more. The sound-system culture that
      // taught them to loop is still owed.
      parents: { isley: 0.35, funk: 0.3, disco: 0.2, electro: 0.15 },
      wants: ["jamaican sound system"],
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
      // LINEAGE: Southern hip-hop is boom bap's one declared parent in the
      // catalog — but the 808 sub, the ties and the half-time snare came up
      // through Miami bass and crunk, the electro lineage the table lacks.
      parents: { boombap: 1 },
      wants: ["miami bass", "crunk"],
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
      // LINEAGE: house is disco's revenge — Knuckles re-editing disco
      // records for the Warehouse until the edit became the genre — with
      // gospel's piano hands (the stab IS a church chord) and funk's
      // syncopation in the machines; Italo disco supplied the drum machine
      // half and is missing.
      parents: { disco: 0.7, gospel: 0.15, funk: 0.15 },
      wants: ["italo disco"],
      // THE JUNO HOLDS THE CHORD AND THE PIANO PLAYS THE RIFF, which is the
      // way round a Chicago record is made: voice 0 is the one that voices
      // the chord, and a house stab is a poly (GM 91 -> the parent's juno60, chorus
      // and all), with the piano — still the sound of "Move Your Body" —
      // riding on top of it as the line. It was the other way round, so a
      // grand piano was the first thing you heard and the synth was buried.
      instr: ["polysynth", "bright_yamaha_grand"],
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
      // LINEAGE: fully parented IN-CATALOG, the only club genre that is —
      // 2-step is US garage house with the four removed, R&B vocal science
      // chopped over the top, and jungle's broken-drum editing at pop tempo.
      parents: { house: 0.45, rnb: 0.3, dnb: 0.25 },
      wants: [],
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
      tone: { wave: "triangle", cut: 2600, q: 1.4, atk: .004, rel: .4, gain: .27, verb: .24,
              // WHO SINGS: the diva sample the genre is built on, breathy and up top
              mouth: MOUTHS.poplead },
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
      // LINEAGE: jungle is soundsystem dub bass under funk breaks sped past
      // 160, launched off the hardcore-rave continuum house and techno
      // started; the rave itself and the Amen break's own record are the
      // missing citations.
      parents: { dub: 0.35, funk: 0.25, house: 0.2, techno: 0.2 },
      wants: ["hardcore rave", "the amen break"],
      // A REESE IS TWO SAWS BEATING AGAINST EACH OTHER, and the comment above
      // says the line is in reese register — so GM 82, which to-engine.js
      // plays on the parent's detuned `supersaw`, is literally that. The
      // synced-fifths lead it used to cast belongs to techno's stab and put an
      // interval nobody wrote into every jungle line.
      instr: ["saw_wave", "echo_drops"],
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
      // LINEAGE: funk's rhythm section made metronomic for the floor, under
      // Motown-descended pop song discipline and gospel's massed uplift; the
      // Philly-soul string section and the Latin percussion that actually
      // built the sound are missing anchors.
      parents: { funk: 0.45, motown: 0.35, gospel: 0.2 },
      wants: ["philly soul", "latin percussion"],
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
      // LINEAGE: James Brown took gospel's scream and blues' shout, kept
      // Motown's showband discipline, and threw the harmony away — the
      // one-chord groove is subtraction, and what it subtracted FROM is the
      // parentage; the New Orleans second line under the kit is missing.
      parents: { gospel: 0.45, blues: 0.35, motown: 0.2 },
      wants: ["new orleans second line", "jump blues"],
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
      // LINEAGE: gospel moved to the assembly line — the Funk Brothers were
      // church and jazz players, the writers blues-schooled — under pop
      // discipline whose actual teacher — doo-wop's harmony stack — is an
      // anchor now and takes the biggest single share any of these edits
      // moved: the Miracles, the Marvelettes and the Temptations were vocal
      // groups before Gordy signed them, so gospel and blues each step back.
      // (Fitted 0.39 against a declared 0.35: the data wants almost exactly
      // what the history claims.) Tin Pan Alley's song forms are still owed.
      parents: { gospel: 0.4, blues: 0.25, doowop: 0.35 },
      wants: ["tin pan alley"],
      // THE VIBES ARE THE FUNK BROTHERS' OWN COLOUR — Jack Ashford's bars on
      // the hook, beside the tambourine the kit already plays. A lone trumpet
      // answering a Motown vocal is a horn section that lost its section, and
      // ska two rows down is where the single horn actually lives.
      instr: ["upright_piano", "vibraphone"],
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
      // LINEAGE: Boyz II Men is the doo-wop revival sung with gospel
      // technique over Motown songcraft, arriving through new jack's door
      // (the jodeci share); doo-wop itself is an anchor now and the parent
      // this comment already named is real. What the revival kept is the FORM
      // — four voices and the a-cappella tag — and none of the measurable
      // surface (straight time, electronic kit, maj7s), which is why the
      // declared 0.2 fits at zero and is worth saying out loud. Quiet storm's
      // late-night radio format is still owed.
      parents: { gospel: 0.3, motown: 0.25, jodeci: 0.25, doowop: 0.2 },
      wants: ["quiet storm"],
      // THE MELISMA IS A PERSON. It was cast on `synth_voice`, and the round
      // that sorted that id kept it here on the theory that this was one of the
      // seven real vocoder records — it is not. A 1994 Philadelphia ballad is
      // three men and a bass singer round a microphone; the only machine on it
      // is the drum machine. The chord chair does not move, and that is the
      // point Paul made about this exact record: a Philadelphia soul record
      // without its EP is not an improvement, so the EP holds the sevenths
      // exactly as before and the voice takes the line chair it already had.
      instr: ["legend_ep_2", "solo_vox"],
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
      tone: { wave: "triangle", cut: 2200, q: 1.0, atk: .01, rel: .9, gain: .26, verb: .38,
              // WHO SINGS: one vowel held over many notes — that IS a melisma,
              // and it is the one thing the recording of an "aah" could fake
              // and the one thing the sung word could not
              mouth: MOUTHS.melisma },
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
      // LINEAGE: the label years invert and the claim survives it — Dorsey
      // was Georgia Tom, Ma Rainey's blues pianist, and carried the blues
      // HAND into church twenty years before the catalog's electric anchor;
      // the spirituals and hymnody he set it against are missing.
      parents: { blues: 1 },
      wants: ["spirituals", "hymnody"],
      // THE B-3, AND IT HAS SIX ZONES. `drawbarorgan` is a SINGLE sample
      // rooted at MIDI 96 — measured on the shipped registry — so the organ
      // holding this genre's chords was one C7 recording dragged three and a
      // half octaves down: no key click, no drawbar body, just breath. Its
      // whole tape came back with a spectral centroid of 249 Hz.
      // percussive_organ is the same extraction WITH the percussion stop, and
      // it is what a church organist plays with the left hand down.
      //
      // AND VOICE 1 IS ONE WOMAN, not four. Its own word has said "the lead
      // voice" since the day this genre was written and it was cast on the
      // SECTION patch, so the soloist and the choir answering her were the
      // same four detuned singers at two levels — which is precisely the
      // failure voice_choir.dsp's own header names ("a doubled voice that is
      // two identical copies is still one voice"), made twice over. solo_vox
      // is the tract seated on a line; ohh_voices behind it stays the section.
      // Nothing moves off the organ: the pad chair is untouched, which is the
      // whole test — a gospel record without its B-3 is not an improvement.
      instr: ["percussive_organ", "solo_vox", "ohh_voices"],
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
      tone: { wave: "triangle", cut: 2400, q: 0.9, atk: .02, rel: 1.2, gain: .26, verb: .45,
              // WHO SINGS: the widest wobble in the table, and a section that
              // never quite agrees. ONE mouth serves both seatings on purpose —
              // the soloist and the choir behind her are the same church, and
              // the bridge reads `blend` only for the section and `vibRate`
              // only for the soloist, so the row says both without conflict
              mouth: MOUTHS.gospelchoir },
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
      // LINEAGE: reggae is ska slowed twice — through rocksteady, the
      // missing intermediate — until the skank had room to breathe; the
      // mento underneath and the nyabinghi drumming that displaced the kick
      // are missing too. (`near: dub` is the CHILD, not the parent.)
      parents: { ska: 1 },
      wants: ["rocksteady", "mento", "nyabinghi"],
      // the skank is the guitar and the tune is the ORGAN — the bubble every
      // Kingston session keyboard player was hired for. The harmonica this
      // cast used to answer with is a Chicago instrument; it moves to dub,
      // one row down, where it stands in for Augustus Pablo's melodica.
      instr: ["clean_guitar", "percussive_organ"],
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
      // LINEAGE: the one lineage that is literally SUBTRACTION — a dub is a
      // reggae record with the song taken away at the desk, so the parent
      // list is complete at one and the wants list is honestly empty.
      parents: { reggae: 1 },
      wants: [],
      // THE MELODICA, as near as the library gets to one: a free reed blown
      // through a keyboard, which is a harmonica with a piano on it. Pablo's
      // is the melody instrument dub was built around, and it takes the echo
      // the way a struck bell never could — the tape repeats a BREATH.
      instr: ["clean_guitar", "harmonica"],
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
      // LINEAGE: the shuffle came off American R&B radio picked up from New
      // Orleans — the catalog's blues anchor carries that shuffle — but
      // everything CARIBBEAN about ska (mento, calypso) is still missing. The
      // other half is no longer: the Skatalites WERE a jazz band — Drummond,
      // McCook and Alphonso came off Alpha's and Kingston's jazz scene — and
      // everything ska plays that is not the shuffle is theirs, the unison
      // horn front line, the walking bass, the major turnaround. Fifty-fifty
      // is the historical claim; the fit puts all of it on jazz.
      parents: { jazz: 0.5, blues: 0.5 },
      wants: ["mento", "calypso"],
      // DON DRUMMOND PLAYED TROMBONE. The Skatalites' front line is a bone
      // out front with the trumpet behind it, and the squeak the register law
      // spent a round chasing was partly a casting fault: ska's horn line is
      // written high (as high as MIDI 100), so the instrument it folds into
      // decides where the horn actually sits. A trombone's window is ten
      // semitones lower and lands it an octave down.
      instr: ["palm_muted_guitar", "trombone"],
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
      // LINEAGE: Fela heard James Brown and built a bigger machine — the
      // one-chord modal groove is funk's own move, and it stays the plurality
      // — but the HORNS are not funk's horns: Fela wrote unison heads and blew
      // over changes, which is bebop's writing done twice over, so jazz takes
      // 0.3, the size of the horn section in the arrangement. Highlife (the
      // band he came FROM) and the Yoruba drumming the cross-rhythms quote
      // are still missing anchors.
      parents: { funk: 0.7, jazz: 0.3 },
      wants: ["highlife", "yoruba drumming"],
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
      // LINEAGE: it stops being a root under protest. Jobim and Gilberto
      // folded samba's rhythm and cool jazz's harmony into the apartment
      // voice; cool jazz is bebop's chamber wing and IS in the catalog now —
      // the ii7-V7 in half a bar, the sevenths everywhere, the understatement
      // — so the weight normalizes to 1 over what exists. Samba and choro,
      // the older Rio string tradition, are still owed. `near: steely` now
      // reads better: the neighbour is a SIBLING, both children of 1945.
      parents: { jazz: 1 },
      wants: ["samba", "choro"],
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
      // LINEAGE: bluegrass is Appalachian fiddle tunes driven with blues
      // phrasing and gospel's close harmony — the catalog holds the second
      // two and lacks the FIRST, which is the bigger half: the missing
      // Anglo-Celtic string band is this anchor's largest residue.
      parents: { gospel: 0.5, blues: 0.5 },
      wants: ["appalachian fiddle", "anglo-celtic balladry"],
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
      // LINEAGE: new wave with the guitars traded for sequencers and
      // disco's four still on the floor; the whole all-synth AESTHETIC is
      // Kraftwerk via Moroder, and one of those two ghosts is now an anchor.
      // Disco loses the larger share because half of what it was priced for
      // was the all-synth chassis, which was never disco's — what stays
      // disco's is the kick on every quarter, which Düsseldorf never played.
      // Note Kraftwerk reaches Basildon twice: 0.25 direct, plus 0.45 x 0.1
      // through new wave.
      parents: { newwave: 0.45, disco: 0.3, kraftwerk: 0.25 },
      wants: ["moroder"],
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
      // LINEAGE: the held-second blur is DRONE logic run under fuzz, the
      // engine is punk's wall, and the tunes underneath are sixties pop —
      // MBV covered by anyone comes out as a Beatles song. The Velvets,
      // who connected all three first, are the missing citation.
      parents: { punk: 0.4, drone: 0.3, beatles: 0.3 },
      wants: ["velvet underground", "dream pop"],
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
      // LINEAGE: the best-documented lineage in the table — Japanese
      // session players explicitly absorbing Toto's polish and Steely Dan's
      // changes over disco's floor; the boogie/Chic half of the groove is
      // the one missing citation.
      parents: { toto: 0.35, steely: 0.35, disco: 0.3 },
      wants: ["boogie"],
      // 1984 IN TOKYO IS AN FM ELECTRIC PIANO — the digital, bell-edged EP
      // that vaporwave two rows up literally slows a DX7 down to imitate.
      // Three genres were casting the same seventies Wurlitzer, and the one
      // that is a decade later and a continent away is the one that should
      // not have been.
      instr: ["legend_ep_2", "clean_guitar"],
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
      // LINEAGE: the Ramones are sixties pop played as fast and plainly as
      // possible — rock's power stripped of its solos, bubblegum hooks kept
      // whole. Chuck Berry's downstroke is an anchor now, but it arrives here
      // SECONDHAND — via the girl groups they adored — so it takes the
      // smallest share of that ancestor's three edges; the garage-rock middle
      // step and the girl groups themselves are still missing.
      parents: { rock: 0.45, beatles: 0.4, chuckberry: 0.15 },
      wants: ["garage rock", "girl groups"],
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
      // LINEAGE: Eno put a moving harmony inside drone's stillness — the
      // catalog's one parent — and minimalism's PROCESS, which is the other
      // thing he added: Music for Airports is loops of unequal length going
      // out of phase, which is Reich's phasing done with tape machines. Drone
      // keeps the larger share because the SOUND, held and slow and pulseless,
      // is Young's: ambient took the method and threw the pulse away. Satie's
      // furniture music and the tape loops are still named in liner notes.
      parents: { drone: 0.65, minimalism: 0.35 },
      wants: ["satie", "tape music"],
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
      // LINEAGE: Derrick May's own formula — "Kraftwerk and George Clinton
      // stuck in an elevator" — and BOTH halves of it are now in the table,
      // plus the road between them: Juan Atkins made Cybotron before he made
      // Model 500, so Detroit reached Düsseldorf through ELECTRO rather than
      // around it. Synthpop takes the big cut because it was the stand-in and
      // keeps a real sliver, since the Belleville Three genuinely did play the
      // British records; house keeps the floor but stops being the plurality.
      // (The fit corroborates kraftwerk at 0.27 against the declared 0.25 and
      // reads electro as already spanned by funk + synthpop + disco — which is
      // what electro IS, so the weight is the historical claim.)
      parents: { house: 0.3, kraftwerk: 0.25, electro: 0.2, funk: 0.2, synthpop: 0.05 },
      wants: [],
      // DETROIT IS SYNTHESIS, and `charang` is a fuzz GUITAR lead — the buzz
      // belongs to big beat, one row over, where a guitar sample really is
      // the sound. The stab here is GM 87, a saw hard-synced to its own fifth
      // (the parent's `synclead`): the interval lives in the oscillator, which
      // is what a Detroit riff is made of, over a Juno holding the chord.
      instr: ["fifth_sawtooth_wave", "polysynth"],
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

    // ---- THE ANCESTORS (phase 2) -----------------------------------------
    // GENEALOGY.md ended in a shopping order: the ancestors the declared
    // lineages ask for BY NAME and the catalog did not hold. These eight are
    // that order, filled. They sit here in one block rather than beside their
    // children, and they sit in CHRONOLOGICAL order by the year their label
    // names — 1945, three from 1955 (March, May, September), 1956, 1967, 1977,
    // 1982 — because an ancestor's whole claim is that it came first, and a
    // reader walking this section is walking the century. Everything above is
    // in the order it was written; this section is in the order it happened.
    //
    // Every one of them was demanded: each arrived on `wants` lists that are
    // now shorter, and the children's weights moved on the same day (see each
    // child's LINEAGE comment for where the share came from).

    // JAZZ. The catalog's largest hole: four anchors — steely, ska, afrobeat,
    // bossa — named it in `wants`, and it was the biggest residue in the fit
    // (1.048, half again the next one). What the four are asking for turns out
    // to be the SAME THREE THINGS, which is why one anchor pays all four:
    // extended chords (an m7/dom7/maj7 alphabet, not triads), a walking bass,
    // and the time carried on the RIDE. That triple names an era all by
    // itself. It is not Storyville — New Orleans has no walking four — and it
    // is not Kansas City, where the time was still in the hi-hat and the
    // chords were still triads with a sixth on top. It is BEBOP: the small
    // group that moved the pulse onto the cymbal, fed the bass drum in quietly
    // underneath it, and stacked the sevenths up into ninths.
    //
    // The band is a rhythm section and a front line, and both are arguments.
    // The piano is a STAB, not a pad: comping is punctuation, not a wash — it
    // plays the tune's own rhythm displaced and thinned, in the gaps the horns
    // leave, and it is the first anchor to use the stab for a KEYBOARD rather
    // than for a skank. The horns play the head IN UNISON — one line, two
    // instruments, which is the texture bebop actually is (Parker and Gillespie
    // on the same notes, no harmony anywhere until the solos). Both children
    // that asked for horns inherit exactly this: the Skatalites' front line and
    // Fela's are unison head-writing, done twice over.
    jazz: {
      // named "New York 1945" — 52nd Street and the Savoy/Guild sessions of
      // that November: Ko-Ko, Billie's Bounce, Now's the Time. The label years
      // invert against `blues` below, the way Tallis's do against Fux's.
      //
      // ...and the swing scalar is SMALL, because the RIDE carries the feel
      // instead (see the kit). At sixteen steps to the bar a step is a
      // sixteenth, and the eighth-note swing this music is actually made of
      // lands on even steps, where the scalar cannot reach it; 0.2 is the lean
      // it CAN say — the same lean its own descendant steely reads as feel
      // rather than as shuffle.
      label: "New York 1945", rate: 1, bars: 8, voices: 3, swing: 0.2,
      // LINEAGE: a parent under protest. Bebop's real ancestors are all
      // missing — the swing band's four-to-the-bar, ragtime's left hand, the
      // Tin Pan Alley song whose changes it plays over, and the New Orleans
      // polyphony under everything — and the catalog's `blues` is a Chess date
      // seven years LATER. But strip that anchor to what it holds and it is a
      // twelve-bar form played by a band with a jazz kit, a ride shuffle, a
      // walking bass and a dominant seventh on every chord: the right claim
      // wearing the wrong year. A third of the 1945 sessions is twelve-bar
      // blues, so it is also the honest one.
      parents: { blues: 1 },
      wants: ["swing", "ragtime", "tin pan alley", "new orleans jazz"],
      // MEASURED, and it is the declared parent — which is what a well-behaved
      // lineage looks like. Of the anchors the confusion metric compares, the
      // closest to this one is `blues`, against a 0.03 floor. Same band, same
      // kit, same walk. Two fields separate them and both are in this entry —
      // the ALPHABET (twelve bars of one dominant seventh against an eight-bar
      // turnaround of maj7/m7/dom7 that leaves the key on the VI7) and the
      // RIDE — both anchors place their "da" by hand in the nudge lane (there
      // is no shuffle to be had off the swing dial: it bends odd sixteenths and
      // both kits are written on even ones), but the blues rides straight
      // eighths and this one plays spang-a-lang, quarter then two.
      near: "blues",
      instr: ["bright_yamaha_grand", "tenor_sax", "trumpet"],
      drumkit: "jazz",
      entry: () => 0,
      // THE REGISTER COMES FROM THE ROLE, not from the voice index: the part
      // policy already lifts a lead an octave (PARTS.lead ctr +12), so one
      // number puts the comping hand at C3 where a pianist's voicings live and
      // both horns at C4, which is the middle of a tenor and the fat part of a
      // trumpet at the same time.
      reg: () => -1,
      part: ["stab", "lead", "lead"],
      realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      // THE TURNAROUND THAT NEVER LANDS — I vi ii V, twice, with the second vi
      // turned into a VI7. Eight bars of the cycle every standard is made of,
      // and the whole point is that it comes back round rather than resolving:
      // bar 8 is a dominant pointing at bar 1.
      roots: [0, 5, 1, 4, 2, 5, 1, 4],
      // ...and the CHORDS are the reason this anchor exists. Every one of them
      // is a chromatic quality — an absolute stack on the root, not a walk
      // through the mode — because that is what "extended chords" means and
      // what a diatonic "7" cannot say: the ii is a MINOR seventh where the
      // mode would hand back a minor triad plus its own sixth, the I is a
      // MAJOR seventh, and the VI7 in bar 6 is the one deliberate exit from
      // the key (a secondary dominant, the bebop move, an A7 in C where the
      // key only owns Am). The line stays diatonic and lets the piano and the
      // bass be the ones who say the raised third.
      prog: [{ d: 0, q: "maj7" }, { d: 5, q: "m7" }, { d: 1, q: "m7" }, { d: 4, q: "dom7" },
             { d: 2, q: "m7" }, { d: 5, q: "dom7" }, { d: 1, q: "m7" }, { d: 4, q: "dom7" }],
      bassStyle: "walk", artic: "legato",
      // a bebop phrase is a stream of eighths with air at the END of it, not a
      // held note; the cap is what puts the air there. (The stab is untouched —
      // a chord-locked voice reads its part policy, PARTS.stab maxHold 1.)
      maxHold: 3,
      // THE AVOID NOTE, which is the one thing a major key genuinely gets
      // wrong: the fourth degree held over a major seventh is a minor ninth
      // against the third, and it is the note every jazz teacher tells you not
      // to sit on. `anchor` is tango's own field doing tango's own job — a note
      // that SOUNDS through more than a step and a half has to be a chord tone.
      // Anything shorter is a passing tone and is left alone, which is where
      // bebop's chromaticism lives anyway.
      anchor: 1.5,
      kit: {
        // THE KICK IS FEATHERED. Four to the bar at level 2 — barely audible,
        // felt rather than heard, which is what a bebop drummer's right foot
        // does and what the level alphabet exists to say — plus a BOMB: one
        // loud accent off the beat that lands five bars in nine, because a
        // dropped bomb you can predict is not a bomb.
        k: [2,0,0,0, 2,0,0,0, 2,0,0,7, 2,0,0,0],
        "?k": [9,0,0,0, 9,0,0,0, 9,0,0,5, 9,0,0,0],
        // the left hand comps rather than backbeats — one answer, late in the
        // bar, two bars in three
        s: [0,0,0,0, 0,0,0,0, 0,0,4,0, 0,0,0,0],
        "?s": [0,0,0,0, 0,0,0,0, 0,0,6,0, 0,0,0,0],
        // SPANG-A-LANG, and where its "da" sits IS the genre. `swing` bends
        // odd sixteenths, so a note written on the eighth-offbeat — step 6,
        // even — cannot be swung by the scalar at all; a jazz ride's second
        // note has to be placed by hand, and the nudge lane is the hand. Four
        // ninths of a step (the alphabet's ceiling) puts it at 0.61 of the
        // beat: a 1.6-to-1 swing ratio, which is not a compromise but the
        // right number — the notional 2:1 triplet is a ballad ratio, and a
        // rhythm section measured at this tempo always comes back nearer 1.5.
        r: [1,0,0,0, 1,0,1,0, 1,0,0,0, 1,0,1,0],
        "~r": [0,0,0,0, 0,0,4,0, 0,0,0,0, 0,0,4,0],
        // and the left foot closes the hat on 2 and 4 — the quietest
        // load-bearing thing on the kit, same as the blues band's
        f: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      },
      // BAR 8 SETS UP THE NEXT CHORUS. The comping hand turns into a figure
      // that accelerates across the bar and hands off to the toms and a crash
      // on the last sixteenth — and the ride never stops, because in this music
      // the time is not allowed to.
      fill: { s: [0,0,0,0, 0,0,4,0, 0,0,5,0, 6,0,7,0],
              m: [0,0,0,0, 0,0,0,0, 0,0,0,5, 0,0,0,0],
              l: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,6,0],
              x: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,8] },
      // a hand, not a grid — the blues band's own number, one notch tighter,
      // because bebop time is faster and closer than a shuffle
      humanize: 0.04,
      tone: { wave: "sawtooth", cut: 2400, q: 1.2, atk: .01, rel: .6, gain: .26, verb: .32 },
      words: ["the piano, comping in the gaps", "the head, on the tenor",
              "the trumpet, in unison — off for half of every other bar"],
      // THE COMP IS THE TUNE'S OWN RHYTHM, DISPLACED AND THINNED TWICE. What
      // falls out of it is 1, the and of 2, the and of 3, and 4 — the
      // charleston cell with an answer, which is what a comping hand plays and
      // is nothing anyone had to hand-draw. The trumpet takes the odd bars
      // half off: two horns on one line is a texture, not a doubling machine.
      word: (v, s) => (v === 0 ? [only("gate", rotate(6)), drop(2), drop(3)]
                     : v === 2 && s % 2 ? [drop(2)] : []),
    },

    // BO DIDDLEY. The genre is a RHYTHM, and that is the reason it earns a row
    // in a table which otherwise insists a genre is four numbers and some
    // nouns: there is no progression here AT ALL. One chord, held for the
    // length of the record, and everything that would have been harmonic
    // motion has moved into the drums — the 3-2 clave, played on the floor tom,
    // doubled by the guitar, shaken over the top by a pair of maracas. It is
    // the one anchor in the band family with no backbeat: the snare answers the
    // clave's TWO-side and says nothing on beat 2, which is most of what a
    // listener means by "that beat".
    //
    // THE FIGURE, WRITTEN ONCE. On the record the clave is spread over two bars
    // at doubled tempo; this is the one-bar compression at 128, the reading
    // every cover of it uses (Not Fade Away, Magic Bus, Faith, Desire) and the
    // only one where a sixteen-step kit, a bass grid and a velocity hand can
    // all land on the same five hits: 1, the a of 1, the and of 2, the a of 3,
    // and 4.
    bodiddley: {
      // named "Chicago 1955" — Ellas McDaniel's first Chess single, cut in the
      // same room and for the same label as the electric-blues anchor three
      // years earlier, playing a rhythm nobody in that room had recorded.
      label: "Chicago 1955", rate: 1, bars: 4, voices: 2, swing: 0.12, near: "blues",
      // LINEAGE: Chess blues is the MATERIAL — the guitar language, the band,
      // the room, the amp — and the sanctified church is where the shouted
      // call-and-response and the body-percussion pulse come from. The beat
      // itself is hambone, the juba pattin' rhythm played on the thighs, whose
      // shape is the same clave the Afro-Cuban records of those years carried;
      // neither is an anchor, and between them they are what this genre adds.
      parents: { blues: 0.7, gospel: 0.3 },
      wants: ["hambone", "latin percussion", "jump blues"],
      instr: ["clean_guitar", "harmonica"],
      drumkit: "acoustic",
      entry: v => v * 2, reg: v => v, realize: () => "line",
      // ONE CHORD, FOREVER — `modal`, and not the drone's kind of modal: there
      // the stillness IS the piece, here the harmony simply is not the subject.
      // Mixolydian for the chord (a major third over a ♭7 — the E7 the guitar
      // bangs) and the blues scale for the tune, which stacks a minor third and
      // a ♭5 on top of that major third and never resolves either.
      harmony: "modal", mode: MODES.mixo, scale: BLUES,
      maxHold: 2,                 // a figure, not a melody: it stops to be answered
      // the low end states the THREE-side and leaves the two to the drums (and,
      // as everywhere, a phrase with accents of its own outranks this grid)
      bassGrid: [1,0,0,1, 0,0,1,0, 0,0,0,0, 0,0,0,0],
      kit: { k: [1,0,0,1, 0,0,1,0, 0,0,0,0, 0,0,0,0],    // the three
             s: [0,0,0,0, 0,0,0,0, 0,0,1,0, 1,0,0,0],    // the two — NO backbeat
             l: [1,0,0,1, 0,0,1,0, 0,0,1,0, 1,0,0,0],    // floor tom: all five
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },  // maracas, unbroken
      // THE MARACAS ARE THE HAT LANE, and that is a compromise said out loud:
      // there is no shaker among the twelve extracted samples, so the nearest
      // thing is a closed hat at sixteenths with the clave leaned on. The
      // ACCENTS are the part that matters — a flat sixteenth hat is a disco
      // record, and Jerome Green's hand is the second instrument on the single.
      kitVel: { h: [9,3,4,8, 3,4,8,3, 4,3,7,4, 8,3,4,4] },
      // a room in 1955, not a grid: four hundredths of a step, redrawn every
      // bar, seeded — the same take every time you press play
      humanize: 0.04,
      // BAR 4: the toms take the figure over and the crash hands it back. The
      // maracas do not stop, because on these records nothing stops them.
      fill: { s: [0,0,0,0, 0,0,0,0, 0,0,1,0, 1,0,1,0],
              t: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,1,0,1],
              m: [0,0,0,0, 0,0,0,1, 0,0,0,1, 0,0,0,0],
              l: [1,0,0,1, 0,0,1,0, 0,0,1,1, 1,0,0,0],
              x: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,8] },
      tone: { wave: "square", cut: 2000, q: 1.8, atk: .003, rel: .4, gain: .29, verb: .22 },
      words: ["the guitar, masked to the clave",
              "the harp, answering in the holes from bar 3"],
      // THE MASK IS THE GENRE. `breath` already says the exact thing a clave
      // is — an ABSOLUTE window in the bar, in the same place every bar, ANDed
      // with whatever rhythm the phrase brought — it was just written for a
      // singer's air instead of a rhythm figure. So the guitar keeps its own
      // tune and sounds it only where the figure lets it, the harp is masked to
      // the complement, and the two parts interlock by construction instead of
      // by luck.
      word: v => (v === 0
        ? [breath([1,0,0,1, 0,0,1,0, 0,0,1,0, 1,0,0,0])]
        : [breath([0,0,0,0, 1,1,0,0, 0,1,0,0, 0,0,1,1]), transpose(2)]),
      fx: ["tremolo"],            // the DeArmond Trem-Trol — Mona's amp, and the table's first
    },

    // CHUCK BERRY [rock]. The double stop is the whole idea, and it costs two
    // voices: one line played twice a FOURTH apart, one rhythm, one register —
    // two strings under one finger, not a lead and a harmony part. (The
    // Beatles' thirds are the other shape, a third up and an octave clear;
    // this one never leaves the guitarist's hand, which is why it is the only
    // place in the table where two voices share a register on purpose.) Under
    // it the boogie — root and fifth, alternating — a piano chording the tune's
    // own eighths, and over twelve bars with the quick change a backbeat that
    // is barely shuffled at all: the guitar plays straight, the piano plays
    // triplets, and the record splits the difference at swing 0.15. That split
    // is the genre — the one anchor here whose identity is a compromise about
    // TIME rather than a mode, a kit or a chord.
    chuckberry: {
      // named "St. Louis 1955" — the Sir John's Trio at the Cosmopolitan Club
      // in East St. Louis: guitar, piano, drums, no horns, which is the band
      // this anchor models. Maybellene was cut in Chicago that May; the group
      // that walked into Chess was St. Louis's, and Johnnie Johnson's piano is
      // the half of it everybody forgets.
      label: "St. Louis 1955", rate: 1, bars: 12, voices: 3, swing: 0.15, near: "rock",
      // LINEAGE: Chess blues played out of a hillbilly's songbook. Maybellene
      // is Ida Red, and the country side is not a costume — it is the straight
      // eighths, the major third and the diction that got him billed as a
      // hillbilly singer sight unseen. The three ancestors still owed: T-Bone
      // Walker, whose double stops these literally are; Louis Jordan's jump
      // shuffle, which is the tempo and the small band; and the boogie-woogie
      // left hand Johnnie Johnson brought to the piano stool.
      parents: { blues: 0.6, countrypop: 0.4 },
      wants: ["t-bone walker", "jump blues", "boogie-woogie"],
      instr: ["clean_guitar", "clean_guitar", "upright_piano"],
      drumkit: "room",
      // NO reg() TERM AT ALL, which is the point: voices 0 and 1 are `lead`
      // and take the part's own +12, the piano is a `stab` and takes none, so
      // it sits an octave under the guitars without this genre naming a
      // single number. The parts do the register work; the anchor only says
      // who is who.
      entry: () => 0, reg: () => 0, realize: v => (v === 2 ? "pad" : "line"),
      part: ["lead", "lead", "stab"],
      // MIXOLYDIAN, AND NO `diatonic`. The line follows the root by SEMITONES
      // — Berry slides the grip up to the IV rather than rethinking it — and
      // mixolydian is closed under exactly that move: C mixo up a fourth is F
      // mixo, up a fifth is G mixo, so one shape lands in tune on all three
      // chords. The ♭7 in the subject is the same ♭7 as in the chords, which
      // is why this alphabet can take the semitone follow the seven-note
      // genres had to give up.
      harmony: "cycle", mode: MODES.mixo, scale: MODES.mixo,
      roots: [0,3,0,0, 3,3,0,0, 4,3,0,4],
      // THE QUICK CHANGE — bar 2 goes to the IV and comes straight back — is
      // most of what separates a rock'n'roll twelve from the Chess twelve that
      // PROGS.blues12 writes. Every chord is still a dominant seventh: the
      // major third of the double stop against the ♭7 under it is the same
      // clash the blues is built on, taken at twice the speed.
      prog: [
        { d: 0, q: "dom7" }, { d: 3, q: "dom7" }, { d: 0, q: "dom7" }, { d: 0, q: "dom7" },
        { d: 3, q: "dom7" }, { d: 3, q: "dom7" }, { d: 0, q: "dom7" }, { d: 0, q: "dom7" },
        { d: 4, q: "dom7" }, { d: 3, q: "dom7" }, { d: 0, q: "dom7" }, { d: 4, q: "dom7" },
      ],
      // THE BOOGIE IS A DEGREE ALTERNATION, not a doubling: root, fifth, root,
      // fifth — Willie Dixon's slap upright and Johnnie Johnson's left hand
      // playing the same figure. The drive belongs to the piano and the hat;
      // the bass's job here is the shape.
      bassStyle: "fifths",
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0],   // one, three, and the push back to one
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],   // the backbeat
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      // THE HAND. The backbeat cracks at 9 — on these records it is the
      // loudest thing in the room — while the hat rides light and uneven, the
      // down-eighths at 7 and the swung up-eighths at 3. Velocity rather than
      // a second lane, because it is one drummer.
      kitVel: { s: [0,0,0,0, 9,0,0,0, 0,0,0,0, 9,0,0,0],
                h: [7,3,5,3, 6,3,5,3, 7,3,5,3, 6,3,5,4] },
      // BAR 12 IS THE TURNAROUND: the snare rolls into the crash on the last
      // sixteenth and the hand comes off the hats halfway through to play it.
      fill: { s: [0,0,0,0, 1,0,1,0, 1,0,1,0, 1,1,1,1],
              h: [1,0,1,0, 1,0,1,0, 1,0,0,0, 0,0,0,0],
              x: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,9] },
      tone: { wave: "sawtooth", cut: 2400, q: 1.5, atk: .003, rel: .5, gain: .29, verb: .14 },
      // THE GRIP, AND WHERE THE REGISTER LAW PUTS IT. Voice 1 is voice 0 three
      // DEGREES up, which in mixolydian is a perfect fourth from every degree
      // but the ♭7 — and the ♭7 gives a tritone, the blue note that is in the
      // grip on purpose. Then `fold` registers each line by its own mean, so
      // the pair renders a fourth ABOVE or a fifth BELOW depending on where
      // the phrase sits: the same two strings, the other position. It cannot
      // do anything else — both lines fold around the SAME centre, so the
      // interval is 5 or −7 and never an octave.
      words: ["the double stops", "the same grip, a fourth off, all the way",
              "the piano, on the tune's own eighths"],
      word: v => (v === 1 ? [transpose(3)]
                : v === 2 ? [only("gate", drop(2))] : []),
      // THE CHESS SLAPBACK: one short tape repeat over the band, which is not
      // reverb and not a decoration — 2120 Michigan Avenue is a dry room and
      // an echo chamber down the hall, and that pair IS the 1955 record.
      fx: ["echo"],
    },

    // DOO-WOP [motown]. The table's first vocal-group anchor, and the one with
    // no instrument in it at all: three singers, an upright and a drummer,
    // which is what a street corner has. It and Motown are both ionian
    // I-vi-IV-V machines — the ice-cream changes — so the fields that separate
    // them are the SHUFFLE and who is playing. Motown is a band with a snare on
    // all four; this is three voices over a shuffle in which the harmony
    // instrument IS the group.
    //
    // THREE PARTS, AND EACH IS A ROLE THE TABLE ALREADY HAD — which is the
    // whole argument for parts being an assignment rather than a transform:
    //   stab   the GROUP, and it is voice 0 because the record starts with
    //          them. This is the reggae skank's machine saying the other thing
    //          it could always say — chord-locked (they sing the chord, all of
    //          it), their own absolute rhythm, one syllable long. "Doo-wop,
    //          doo-wop" is a stab, and it is the only place the harmony sounds.
    //   riff   the BASS SINGER: low (the role's own −12 puts him at C3 with
    //          `reg` left flat), short, insistent, and he does not develop —
    //          "bom, ba-ba-bom" is a riff by the table's own definition.
    //   lead   the tenor, up top, entering at bar 3 over a group that has
    //          already been singing, which is why `entry` runs the other way
    //          round from every other genre here.
    // ...and NO `pipes`. The harmony in this music is SUNG by a part, not added
    // to a line by one: the group voice is the harmonizer, chord-locked, which
    // is exactly what harmonize would have had to become anyway.
    //
    // THE SHUFFLE IS WHERE THE GRID CAN SAY IT. A sixteen-step bar cannot hold
    // three-per-beat, so there is no exact 12/8 here and writing one would be a
    // lie in the data. What swing 1/3 does hold, exactly, is a 2:1 pair at the
    // SIXTEENTH — the triplet subdivision one level down — so the hat rides all
    // sixteen and every pair of them leans, which is the rolling 12/8 ride at
    // the resolution this kernel owns. `kitVel` puts the weight back on the
    // beat and the half-beat so the pulse stays legible underneath. Blues and
    // gospel already swing 1/3 and leave their kits straight; this is the same
    // knob answering the same problem from the other side.
    //
    // THE HARMONY IS THE OTHER HALF. Eight bars, and the second four swap the
    // ii in for the IV (I-vi-IV-V | I-vi-ii-V) — both halves of the cycle these
    // records turn over, rather than one of them twice. Every tonic and
    // subdominant is a SIXTH chord, which is the close-harmony sound itself:
    // four voices on a triad have a spare throat and it takes the sixth. The V
    // is the only chromatic thing in the genre, a real dom7, and the last bar
    // gives its final quarter back to the tonic — the "shoo-bop" tag that flips
    // the strain to the top, and the one bar of the form holding two chords.
    doowop: {
      // named "Harlem 1955" — the Cadillacs cutting "Speedoo" for Josie and the
      // Harptones working the Apollo, the year the corner went on record;
      // uptown New York, not the Penguins' LA or the Moonglows' Chicago.
      label: "Harlem 1955", rate: 1, bars: 8, voices: 3, swing: 1 / 3, near: "motown",
      // LINEAGE: the jubilee/gospel quartet is where the parts, the blend and
      // the bass singer come from — every one of these groups had been singing
      // in church first — and the band behind them is the blues, playing the
      // shuffle it had been playing since jump. The songs came from Tin Pan
      // Alley by way of the pop vocal groups, and barbershop is where the added
      // sixth was already sitting; neither of those is an anchor yet.
      parents: { gospel: 0.6, blues: 0.4 },
      wants: ["jubilee quartets", "barbershop", "tin pan alley", "jump blues"],
      // ONE GROUP IS ONE SOUND: the lead is a solo voice and the other two are
      // the recorded choir, closed vowel on top for the syllables and the
      // rounder one underneath for the bass, because that is literally what is
      // standing there. No piano, no sax — this is the corner, not the date.
      instr: ["ohh_voices", "ahh_choir", "solo_vox"],
      drumkit: "acoustic",
      // `reg` is flat and the PARTS do the registering: stab at 60, riff at 48,
      // lead at 72, which is a vocal group's spacing written once.
      entry: v => (v === 2 ? 2 : 0), reg: () => 0,
      part: ["stab", "riff", "lead"],
      // the stab declares itself "pad" to the realize() shim exactly as
      // motown's does — it is a chord, not a line, and the octave law reads it
      // that way
      realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", mode: MODES.ionian, scale: MODES.ionian, diatonic: true,
      roots: [0,5, 3,4, 0,5, 1,4],               // I vi IV V | I vi ii V
      prog: [{ d: 0, q: "six" }, { d: 5, q: "7" }, { d: 3, q: "six" }, { d: 4, q: "dom7" },
             { d: 0, q: "six" }, { d: 5, q: "7" }, { d: 1, q: "7" },
             [{ d: 4, q: "dom7", beats: 12 }, { d: 0, q: "six", beats: 4 }]],
      // CALL AND RESPONSE AS DATA — the per-voice `period`, which is what that
      // form of the field was for. Every second bar the tenor thins out and the
      // bass singer answers into the hole he left: the two-bar shape the whole
      // idiom is built out of. It also fires twice, alone, before the lead has
      // opened his mouth, and that is the intro.
      period: (v, s) => (s % 2 ? (v === 2 ? [drop(2)] : v === 1 ? [fill(3)] : []) : []),
      maxHold: 4, artic: "legato",
      // THE BASS SINGER IS NOT A PASSING TONE. The riff follows the changes by
      // DEGREE, which keeps him in the key and not necessarily on the chord, and
      // a bass voice holding the seventh under the upright's root is the one
      // clash three singers and a bass can actually make: measured, it was most
      // of the genre's dissonance census. `anchor: 2` is the ear's own rule —
      // sound through more than two steps and you have to be a chord tone.
      anchor: 2,
      // THE TWO-FEEL. An upright alternating root and fifth under the shuffle —
      // not a walk, which is the jump-blues band and Motown's Funk Brothers.
      // The doo-wop bass player holds the bottom still so the voices can move,
      // and where the phrase brings no accents of its own the grid is 1, 3 and
      // the push into the next bar.
      bassStyle: "fifths",
      bassGrid: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0],
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      kitVel: { h: [6,3,4,3, 7,3,4,3, 6,3,4,3, 7,3,4,4] },
      // the eighth bar: the snare picks the shuffle up off the hat and runs the
      // group back to the top — a roll into the turnaround is the one fill this
      // music has, and the only bar the drummer is not just keeping time in
      fill: { s: [0,0,0,0, 1,0,0,0, 1,1,0,1, 1,1,0,1] },
      // no `fx` either: a 1955 vocal record's only effect is the room it was
      // cut in, and the room is `verb`
      tone: { wave: "triangle", cut: 2400, q: 0.8, atk: .014, rel: 1.1, gain: .26, verb: .5,
              // WHO SINGS: the round 'ooh' under the lead, on the corner
              mouth: MOUTHS.doowopstack },
      words: ["the group — \"doo-wop\", the bar's chord, on their own grid",
              "the bass singer, under everything", "the lead tenor, from bar 3"],
      word: (v, s) => (v === 0 ? [breath([1,0,0,1, 0,0,0,0, 1,0,0,1, 0,0,0,0])]
        : v === 1 ? [breath([1,0,0,1, 0,0,1,0, 1,0,0,0, 0,0,1,0])]
        : [breath(SUNG)]),
    },

    // SKIFFLE [countrypop] — the genre with NO INSTRUMENTS, and every field
    // below is that one fact worked out. A washboard is a laundry board played
    // with sewing thimbles; a tea-chest bass is a packing crate, a broom handle
    // and one length of string; the guitar is the only object in the room
    // anybody paid money for. So there is no kick in this kit and no snare
    // either — the beat is a SCRUB, sixteenths across the ribs with the hand's
    // own down-and-return in `kitVel`, and two thimble clicks on the backbeat
    // that arrive twice because a thimble crossing a rib always does (`!p`, the
    // flam and the drag). Over it three major chords with no seventh anywhere:
    // the entire proposition of the music is that a boy with a fortnight of
    // practice can play it, and a seventh is a fortnight he does not have. The
    // guitar strums an eighth-note downstroke grid — fill(1) then drop(2), every
    // step and then every other one taken away, which is the one shape a right
    // hand that only goes DOWN can make — twenty years before punk claimed the
    // gesture and out of the same impulse.
    skiffle: {
      // named "London 1956" — Rock Island Line in the charts and the coffee
      // bars full of teenagers with tea chests; Liverpool 1957 (the Quarrymen,
      // and Lennon meeting McCartney at the Woolton fête) is the other
      // claimant, and it is the one the beatles anchor downstream is made of.
      label: "London 1956", rate: 1, bars: 8, voices: 3, swing: 0.15,
      near: "countrypop",
      // LINEAGE: skiffle is a STRING BAND playing American blues off imported
      // 78s — Nashville's banjo-and-two-beat machinery arriving at the same
      // music from the other side of the ocean (countrypop), Lead Belly's and
      // Broonzy's songs as the actual repertoire (blues), and the work-song
      // and spiritual half of that songbook, "Midnight Special" through "Rock
      // Island Line", which is church music with the church taken off it
      // (gospel). The missing parent is the one it was literally born inside:
      // the British trad-jazz revival, where a skiffle break was the interval
      // number Ken Colyer's and Chris Barber's bands played while the horns
      // put their instruments down.
      // ...and the want is named PRECISELY, because the `jazz` anchor two
      // rows up is the wrong jazz: 52nd Street in 1945 is bebop, and the
      // rooms these kids were standing in were playing New Orleans revival.
      parents: { countrypop: 0.4, blues: 0.4, gospel: 0.2 },
      wants: ["trad jazz revival", "delta blues", "work song"],
      instr: ["steel_string_guitar", "solo_vox", "banjo"],
      // BRUSHES, because a washboard is SCRAPED and every other sampled kit
      // here is struck: the brush kit is the only one whose snare is a sound
      // made by dragging something across a surface, which is the whole
      // instrument. The lanes it is asked for are a hat and a rim; the kick,
      // the snare and both cymbals are silent for the whole genre.
      drumkit: "brush",
      // REGISTER: the guitar chunks in the middle, the singer sits ON it, and
      // the banjo rolls UNDER the voice rather than over it — which is where a
      // banjo actually is on these records, a middle-register rhythm engine and
      // not a lead. The pentatonic alphabet is 2.4 semitones a degree, so every
      // voice here reads an octave wider than a seven-note one: this is written
      // two rungs lower than a diatonic genre would be for the same result.
      entry: v => (v === 2 ? 2 : 0), reg: v => (v === 0 ? -1 : v - 2),
      realize: v => (v === 0 ? "pad" : "line"),
      part: ["stab", "lead", "counter"],
      // MAJOR TRIADS UNDER A MAJOR PENTATONIC SUBJECT — and it is the first
      // anchor in the table to read the SCALES row `majpent` at all, which has
      // sat there unused since the major side was added. It is the alphabet of
      // the songs: an Anglo-Celtic ballad and a Lead Belly holler are both
      // five notes, and the friction the blues anchor gets from a flat third is
      // not available here because nobody in the band could find one.
      harmony: "cycle", mode: MODES.ionian, scale: SCALES.majpent,
      // THE EIGHT-BAR FOLK BLUES — I I IV I V IV I I, the shape of "Key to the
      // Highway" and of half the songbook. Not the twelve: skiffle got its
      // repertoire off records but its FORM off the page and the campfire, and
      // eight bars is the length of a verse somebody can remember.
      roots: [0,0, 3,0, 4,3, 0,0],
      // ...AND NO `prog`. Every other cycle in this half of the table says its
      // sevenths out loud; this one refuses on principle. Three major triads is
      // not a simplification of the harmony, it IS the harmony — the whole
      // point of the boom was that the chords were reachable.
      maxHold: 3,
      // the strummed chord is a RAKE, not a block: six strings under one
      // downstroke are a few milliseconds apart and that is what makes it a
      // guitar rather than an organ
      pipes: [{ id: "strum", spread: 0.05 }],
      // ROOT AND FIFTH, TWO TO THE BAR — the same figure whether the band has
      // a tea chest (one string, tuned by pulling the broom handle, so a fifth
      // is a lean of the wrist) or a borrowed double bass with Chris Barber
      // behind it. `bassGrid` is the floor under a phrase with no accents:
      // this part never stops being two in a bar.
      bassStyle: "fifths",
      bassGrid: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      kit: { h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],     // the scrub, unbroken
             p: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],     // thimbles, 2 and 4
             "!p": [0,0,0,0, 1,0,0,0, 0,0,0,0, 2,0,0,0] },// a flam, then a drag
      // THE HAND ON THE BOARD. Down-stroke on the beat, the return stroke
      // gathering into the next one — a scrub is a crescendo repeated four
      // times a bar, not a hat playing sixteenths at one level.
      kitVel: { h: [8,3,4,6, 7,3,4,6, 8,3,4,6, 7,3,5,7] },
      // and nothing in this band is on the grid: no metal, no machine, no
      // drummer — a hand on a laundry board is the loosest timekeeper the
      // table has, looser than the blues band it learned from
      humanize: 0.06,
      // BAR 8: the washboard breaks out of the backbeat and runs the thimbles
      // into the bar line. There are no toms to fall down and no crash to land
      // on; the only thing that can get louder is the board.
      fill: { p: [0,0,0,0, 1,0,1,0, 1,0,1,0, 1,1,1,0],
              "!p": [0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0] },
      tone: { wave: "triangle", cut: 3000, q: 1.0, atk: .004, rel: .45, gain: .28, verb: .16,
              // WHO SINGS: rough and close, more air in it than tone
              mouth: MOUTHS.skiffler },
      intro: "cold",                 // one voice counts it off and the band is in
      words: ["the strum — an eighth-note grid, all downstrokes",
              "the tune, hollered, as written",
              "the banjo roll, from bar 3 — a three grinding against the two"],
      word: v => [[fill(1), drop(2)], [], [fill(3), transpose(2)]][v],
    },

    // MINIMALISM. Two mechanisms, and both of them are `period` — the bar
    // schedule is the only type that can say "this bar is one step further
    // along than the last", which is what a PROCESS is.
    //   PHASE (Reich): voices 0 and 1 are the same figure, the same
    // instrument, the same octave, and voice 1 moves one sixteenth further
    // ahead every bar — 0, 1, 2 … 7 and home. A canon whose interval of
    // imitation is not a musical distance but a mechanical one, and the
    // harmony is whatever the figure makes against itself.
    //   ADDITIVE PROCESS (Glass): voice 2 plays a four-step cell for two bars,
    // an eight-step cell for two, twelve for two, then the whole sixteen. What
    // grows is the CELL, not the density — the tune is not stated and then
    // developed, it is built in front of you.
    // Under both, a pulse that never stops and never accents anything.
    minimalism: {
      // named "New York 1967" — Piano Phase at the Park Place Gallery: two
      // pianos, one figure, one player walking a sixteenth ahead. Glass's
      // additive cells (Two Pages, 1969) are the same downtown loft scene two
      // years on, which is why one anchor can honestly hold both.
      label: "New York 1967", rate: 1, bars: 8, voices: 3,
      // LINEAGE: Young's Theatre of Eternal Music is the room Riley and Reich
      // came out of, so drone is the catalog's one true ancestor here — and a
      // phase piece is also, exactly, a CANON, which is counterpoint's half:
      // the species machinery with the interval of imitation taken off the
      // grid. Declared near even because those are two halves, not a trunk and
      // a branch. It then fits worse than anything else in the table, and that
      // is the honest reading rather than a bug: what neither parent can
      // explain is the PULSE, and the two ancestors that would — Coltrane's
      // one-chord modal playing, which Reich credits by name, and the Ewe bell
      // patterns he went to Legon in 1970 to learn — are exactly the two the
      // catalog does not hold. The tape pieces where phase was found by
      // accident are the third.
      // and the first want is named PRECISELY for the same reason skiffle's
      // is: the `jazz` anchor in this section is bebop, and what Reich took
      // was the one-chord MODAL playing that came fourteen years after it.
      parents: { drone: 0.55, counterpoint: 0.45 },
      wants: ["modal jazz", "west african drumming", "tape music"],
      // Two marimbas and a piano. The phase pair must be the SAME instrument
      // in the SAME octave or the ear files them as two parts instead of one
      // figure coming apart, which is why `reg` is flat across 0 and 1 and
      // only the additive voice sits up an octave.
      instr: ["marimba", "marimba", "bright_yamaha_grand"],
      drumkit: "acoustic",
      // NOTHING ARRIVES. Every other genre in the drift family is built on
      // staggered entry — ambient surfaces at bar 5, post rock arrives one
      // guitar at a time, neoclassical's second piano waits four bars. Here
      // all three play from bar 1 and only the PROCESS changes: the piece does
      // not begin, it is already running when you get there.
      entry: () => 0, reg: v => (v === 2 ? 1 : 0),
      // AND NO PAD, which is the same family's other shared habit thrown out.
      // Everything is attack; the sustain is an illusion made of repetitions,
      // which is what a marimba ensemble is.
      realize: () => "line",
      harmony: "cycle", mode: MODES.dorian, scale: MODES.dorian, diatonic: true,
      // i · ♭VII four times, then IV · ♭VII: not a progression, a ROCKING. And
      // dorian because it has no leading tone — nothing here ever cadences,
      // the top of the loop is the only resolution the music offers.
      roots: [0, 6, 0, 6, 3, 6, 3, 6],
      // NO `prog`, and the absence is a decision rather than an omission: with
      // no pad and no stab nothing would voice a quality, so a chord table
      // here would be inert data — and minimalism's harmony genuinely is bare
      // roots under a figure. The chord you hear is the one the figure makes.
      // Short and capped, because a mallet is short: nothing is held over
      // anything, so every simultaneity in the piece is two attacks meeting.
      artic: "staccato", maxHold: 2,
      // The bass is not UNDER the pulse, it IS the pulse an octave down —
      // Glass's left hand doubles the figure's rhythm, it does not walk.
      bassStyle: "eighths",
      kit: { // maracas: sixteenths that never stop
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
             // claves, five strokes across the sixteen (3+3+3+3+4) — the
             // cross-rhythm the pulse gets measured against
             p: [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0],
             // and Clapping Music's second player: the identical cell, one
             // step over. The interference is the part.
             c: [0,1,0,0, 1,0,0,1, 0,0,1,0, 0,1,0,0] },
      // A PULSE WITH NO ACCENT IN IT — flat velocity vectors, on purpose, and
      // the only kit in the table written that way. Every other one leans on 1
      // and 3 to tell the ear where the beat is; this music's whole gift is
      // refusing to, so the ear does the grouping and hears a different metre
      // every minute. There is no kick and no snare either: a backbeat would
      // answer the question the piece exists to leave open.
      kitVel: { h: [4,4,4,4, 4,4,4,4, 4,4,4,4, 4,4,4,4],
                p: [6,6,6,6, 6,6,6,6, 6,6,6,6, 6,6,6,6],
                c: [5,5,5,5, 5,5,5,5, 5,5,5,5, 5,5,5,5] },
      // THE FILL IS A CUE, not a drum break: in Music for 18 Musicians the
      // vibraphone plays a figure that means "everybody move on now". Here the
      // claves and the claps double into the last bar and the ensemble is told
      // the process is over.
      fill: { p: [1,0,1,1, 0,1,1,0, 1,1,0,1, 1,0,1,0],
              c: [1,1,0,1, 1,0,1,1, 0,1,1,0, 1,1,0,1] },
      tone: { wave: "triangle", cut: 3400, q: 0.9, atk: .002, rel: .28, gain: .26, verb: .3 },
      words: ["the figure, steady, all the way through",
              "the same figure, a sixteenth further ahead every bar",
              "the additive voice: a four-step cell growing to sixteen"],
      // The word is EMPTY and the period carries all of it, which is the
      // argument for the sixth type written out in one anchor: an operator is
      // timeless and cannot know it is in bar 3, and a process that cannot
      // count bars is not a process.
      word: () => [],
      period: (v, s) => (v === 1 ? [rotate(s)]
        : v === 2 ? (s < 2 ? [excerpt(0, 4)] : s < 4 ? [excerpt(0, 8)]
                     : s < 6 ? [excerpt(0, 12)] : [])
        : []),
      // No `fx`, deliberately: the phase voice IS the delay, played rather
      // than patched, and a genre that hands its signature to an insert does
      // not own it.
    },

    // KRAFTWERK [synthpop]. The catalog's most-wanted ancestor — four children
    // named it at once (new wave, synth pop, Eurythmics, techno) and all four
    // had to route it through somebody else. What no proxy could carry: this
    // is a POP RECORD MADE BY A MACHINE, and both halves are load-bearing.
    // Against synth pop, the nearest neighbour and the child that inherited
    // most, the field that separates them is THE KICK. Basildon puts one on
    // every quarter — that is disco's gift and the reason it is dance music.
    // Düsseldorf puts one on 1 and 3 and pushes off the & of 3, which is a
    // train, and it is why nobody dances to this and everybody has heard it.
    //
    // Three machines switched on one at a time (entry 0, 2, 4 — a Kraftwerk
    // record is an accretion, not an arrangement): the SEQUENCE low and short,
    // the TUNE an octave over it, the VOCODER CHORALE underneath them both.
    // The band's own words for it were Roboterpop and Industrielle Volksmusik
    // — industrial folk music, which describes this anchor better than this
    // comment does.
    kraftwerk: {
      // named "Düsseldorf 1977" — Trans-Europe Express, the record every one
      // of the four children actually heard: Bowie carried it to Berlin,
      // Bambaataa cut it up in the Bronx, Detroit built a genre on it.
      // Autobahn 1974 is where the machine arrives; 1977 is what was
      // inherited, and a label on an ancestor should name the inheritance.
      label: "Düsseldorf 1977", rate: 1, bars: 8, voices: 3, near: "synthpop",
      // LINEAGE: three parents, and two of them were meant to be the whole
      // list — most of Kraftwerk's ancestry is ghosts here: Stockhausen's
      // studio an hour down the Rhine, the krautrock the band's own first
      // three albums are, and the European light music they always said they
      // were continuing. The third is the American minimalists' repeating
      // cell, which was on that ghost list until New York 1967 landed in this
      // same section ten rows up; an ancestor the table holds is a parent, so
      // it takes a quarter and drone gives most of it (they are the two
      // halves of the same claim, and the cell that MOVES is Reich's rather
      // than Young's). What the catalog holds beyond that is the two
      // decisions that made them Kraftwerk rather than one more tape project:
      // they wrote SONGS — verse, chorus, three minutes, a self-contained
      // four-piece with its own studio, which is the Beatles' template — and
      // they let the cell repeat past the point where anything happens, which
      // is the drone's. The pop half is the larger share because it is the
      // decision; the drone half is why the decision sounds like this. (With
      // only those two declared the fit read 58.1% and put ALL of it on
      // beatles, because none of the 27 features measures "a cell held past
      // event" and the drone half is carried by the word table the fit cannot
      // read. Naming the third parent is what fixed that rather than a bigger
      // weight: 76.0%, with minimalism fitted at 0.60 — the pulse and the
      // repeating cell were the missing measurable, and the declared 0.25 is
      // the conservative read of a fit that wants more.)
      parents: { beatles: 0.45, drone: 0.3, minimalism: 0.25 },
      wants: ["stockhausen", "krautrock", "schlager"],
      instr: ["square_lead", "saw_wave", "synth_voice"],
      // NOT the CR-78, and that is the point: all three synth children reach
      // for the preset box, which arrives in 1978, a year after this record.
      // Düsseldorf's percussion was hand-built — metal struck with sticks —
      // so it takes the sampled electronic kit, and the difference between a
      // machine somebody built and a machine somebody bought is audible in
      // one bar.
      drumkit: "electronic",
      // ONE MACHINE AT A TIME: the sequence alone, the tune from bar 3, the
      // chorale from bar 5, and four bars of the whole thing. reg is flat
      // because the PARTS do the register — riff sits an octave down, lead an
      // octave up (PARTS ctr), so the three voices stack 48 / 72 / 60 without
      // a single hand-written offset.
      entry: v => v * 2, reg: () => 0,
      realize: v => (v === 2 ? "pad" : "line"),
      part: ["riff", "lead", "pad"],
      // i - ♭VII - ♭VI - i, two bars each: the descending aeolian tetrachord
      // "Das Model" walks down, and the seed of both synth children's loops —
      // Eurythmics' i-VI vamp is one move out of it, synth pop's i-VI-III-VII
      // anthem its four corners. EIGHT bars because harmony is the slow layer
      // here: the sequence turns over every bar and the chord waits two.
      harmony: "cycle", roots: [0,0, 6,6, 5,5, 0,0],
      // stepwise and in one key. A Kraftwerk tune is a nursery melody played
      // by a machine — it steps, it does not leap — so the subject reads
      // through the full seven, and `diatonic` follows the chord by DEGREES
      // so nothing ever leaves the key. The robots do not modulate.
      scale: DIATONIC, diatonic: true,
      // NO `artic`, and it is the one field this anchor withholds on purpose:
      // new wave, synth pop and techno all say `staccato`, so the clip is
      // THEIRS, not inherited. Here only the riff is short, and the part
      // policy already caps it (maxHold 2) — the chorale has to hold.
      //
      // THE SEQUENCER DOES NOT KNOW THERE IS A SINGER: straight eighths on
      // the root, every one the same length and the same weight, for the
      // whole record. `eighths` is the one bass style that overrides the
      // melody's accents instead of reading them, and that override IS this
      // music.
      bassStyle: "eighths",
      // THE SIGNATURE-SYNTH LAW (see acid): a Model D, because these lead
      // lines are a Minimoog and a sample cannot slide from one note to the
      // next. Every number is set AGAINST drama — resonance 0.18 where acid
      // sits at 11 and the filter envelope barely a step, because the interest
      // here is the notes and their repetition, never the filter. `glide: 18`
      // is the sequencer's own slide and not a singer's swoop; `drift: 3` is a
      // fraction of what a real Model D wanders, because these machines were
      // tuned before every take. lineOnly, like vaporwave's DX7: the chorale
      // must be polyphonic and a Model D node is one voice.
      synth: { dsp: "modeld", root: "modeld", level: 0.8, lineOnly: true,
               set: { cutoff: 2100, res: 0.18, envAmount: 1.0, envAttack: 0.004,
                      envDecay: 0.28, envSustain: 0.6, oscMix: 0.7, drive: 0.15,
                      glide: 18, drift: 3 } },
      // THE TRAIN. Kick on 1 and 3 with a push off the & of 3 — the motorik
      // lean, a bar that is always arriving at the next one — the backbeat
      // exactly on 2 and 4, sixteenth hats that never stop, and a metal ping
      // on the & of 2 and the & of 4: the rim lane, because Flür's kit was
      // sheet metal on stands and this is the clack, not a hat.
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      // THE FLATTEST TABLE IN THE FILE, and it is the whole aesthetic. Every
      // other genre's kitVel is a HAND — disco and Toto lean on the pulse and
      // tuck the between-notes under, funk writes its ghosts as 2s between
      // 9s. Sixteen identical numbers per lane is the opposite claim, and it
      // has to be said out loud rather than left absent, because absent means
      // "take the tune's velocity" and the tune breathes.
      kitVel: { k: [9,9,9,9, 9,9,9,9, 9,9,9,9, 9,9,9,9],
                s: [8,8,8,8, 8,8,8,8, 8,8,8,8, 8,8,8,8],
                p: [7,7,7,7, 7,7,7,7, 7,7,7,7, 7,7,7,7],
                h: [5,5,5,5, 5,5,5,5, 5,5,5,5, 5,5,5,5] },
      // BAR 8: A MACHINE DOES NOT ROLL, IT SUBDIVIDES. No tom run, no snare
      // accelerando — the kick simply starts landing on every other sixteenth
      // and the metal goes to straight sixteenths for the last beat. Same
      // hits, finer grid, and it hands the form back on the bar line.
      fill: { k: [1,0,0,0, 0,0,0,0, 1,0,1,0, 1,0,1,0],
              p: [0,0,0,0, 0,0,1,0, 0,0,0,0, 1,1,1,1] },
      intro: "bassin",               // the pulse starts, then the machines join
      tone: { wave: "sawtooth", cut: 2400, q: 1.2, atk: .004, rel: .45, gain: .28, verb: .18 },
      words: ["the sequence, never once varied",
              "the tune, answered a third up every other bar",
              "the vocoder chorale"],
      // The least-transformed word in the table, and that is the design: what
      // you draw is what you hear, sixteen steps at a time, and the only move
      // is the one Kraftwerk actually make — the same figure restated a third
      // higher. The sequence and the chorale never take an operator at all.
      word: (v, s) => (v === 1 && s % 2 ? [transpose(2)] : []),
      fx: ["echo"],                  // the Kling Klang tape loop, and nothing else
    },

    // ELECTRO [trap] — and the neighbour is measured, not a joke: it is the
    // same machine. Electro is the missing middle of the club family, the
    // record where a Bronx funk DJ stopped playing breaks off other people's
    // 45s and PROGRAMMED one — Kraftwerk's melody, the 808's own kick, clap,
    // cowbell and congas, and nothing on the tape that a person played. What
    // it invents and hands on: the SYNCOPATED machine kick (1, the & of 2, 3,
    // the & of 4 — the body-pop, and the thing four-on-the-floor throws away),
    // the octave-jumping sequenced bass, and the sixteenth hats accented UP on
    // the offbeat. House and techno take the kick and straighten it; boom bap
    // takes the loop discipline; trap takes the 808 itself, twenty-one years
    // later, which is why the census puts them next to each other.
    //
    // THE FIRST CLUB GENRE THAT READS ALL SEVEN NOTES. Acid, house and techno
    // are pentatonic machines — a riff, not a tune. The whole point of "Planet
    // Rock" is that the tune on top is a EUROPEAN one, stepwise and diatonic
    // (it is Trans-Europe Express, note for note — two rows up), so the subject
    // reads through the full natural minor and `diatonic` moves the sequence by
    // DEGREES when the root moves, which is what a keyboard player transposing
    // a pattern does and what keeps a seven-note line in one key.
    electro: {
      // named "New York 1982" — Planet Rock's city and year. Detroit's own
      // half of it (Cybotron's "Clear") is the same year and the same machine;
      // the twelve-inch went out of New York, so the label follows it.
      label: "New York 1982", rate: 1, bars: 4, voices: 2, near: "trap",
      // LINEAGE: Bambaataa was a FUNK DJ first — the syncopation, the body and
      // the break are James Brown's and P-funk's — playing to a floor disco
      // built and to a twelve-inch disco invented. The fourth is the one this
      // record does not merely resemble but QUOTES: Planet Rock is Trans-
      // Europe Express with an 808 under it, so Düsseldorf is a declared
      // parent and not a want. Synthpop keeps a fifth beside it because the
      // all-synth chassis reached the Bronx as British pop records too, and
      // those were on the radio where the German twelve-inch was not.
      parents: { funk: 0.35, kraftwerk: 0.25, synthpop: 0.2, disco: 0.2 },
      wants: ["moroder", "yellow magic orchestra", "hip-hop dj culture"],
      // the square-wave sequencer and the vocoder: the two voices on every
      // electro record, and the second one is a MACHINE SINGING — which, from
      // 2026-08-18, it finally is. `synth_voice` on a LINE chair reaches the
      // vocal tract (audio/to-engine.js PATCH_MOUTH) where before it reached a
      // VP-330 holding one vowel, and the word this anchor already uses for the
      // part is its own argument: "eight steps of the phrase, EVERY OTHER NOTE
      // GONE". A hook that starts and stops eight times a bar is a mouth opening
      // and closing, and closing is the one thing a formant bank cannot do. The
      // cast did not move — the id was always right, there was nothing behind it.
      instr: ["square_lead", "synth_voice"],
      drumkit: "tr808",            // not a stand-in — the 808 IS the genre
      entry: v => v, reg: v => 1 - v, realize: () => "line",
      // TWO LINES, NO PAD. A pad is a held chord and electro does not have one
      // — the harmony is the bass and the sequence, which is why the parts are
      // a low insistent riff and a hook on top of it rather than line + wash.
      part: ["riff", "lead"],
      artic: "staccato",                       // gated, clipped, machine-short
      // i - i - ♭VI - ♭VII, and BARE TRIADS: no `prog`, because a seventh is a
      // soul chord and there is not one on a Cybotron record. Two bars of
      // tonic to lock the sequence in, then the two-chord lift that every
      // minor-key machine record uses to get back to the top.
      harmony: "cycle", roots: [0, 0, 5, 6],
      scale: DIATONIC, diatonic: true,
      // THE OCTAVE JUMP IS THE BASSLINE — Numbers, Al-Naafiysh, Nunk, all of
      // it: one note, alternating registers, on the phrase's own accents, so
      // the bass and the sequence are the same idea at two densities.
      bassStyle: "octaves",
      // THE 808 BAR. Kick on 1 and 3 with a push in front of each backbeat;
      // handclap on 2 and 4 (the 808 clap, never a snare); the cowbell
      // interlocking on the & of 1 and 3 and picking up the bar line;
      // sixteenth hats with the open hat sizzling into the next bar, and the
      // closed hat stepping out of its way.
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [0,0,1,0, 0,0,0,0, 0,0,1,0, 0,0,0,1],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,0,1],
             o: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0] },
      // THE ACCENT SWITCH, which is what an 808 has instead of a hand: the
      // hats lean on the OFFBEAT (steps 2/6/10/14 — that upward lean is the
      // body-pop), the claps hit at 9, and the two kick pushes sit under the
      // two downbeat kicks. Written as level, not as timing, because a machine
      // is exactly on the grid — see DYNAMICS, where electro is `null`.
      kitVel: { k: [9,0,0,0, 0,0,7,0, 8,0,0,0, 0,0,7,0],
                c: [0,0,0,0, 9,0,0,0, 0,0,0,0, 9,0,0,0],
                p: [0,0,6,0, 0,0,0,0, 0,0,6,0, 0,0,0,6],
                h: [6,3,8,3, 6,3,8,3, 6,3,8,3, 6,3,8,4] },
      // ...and bar 4 is the 808 CONGA RUN, high-high-mid-low across the kit,
      // with the clap answering itself into the bar line. Every electro record
      // has this fill and it is the one moment the machine sounds like a drummer.
      fill: { t: [0,0,0,0, 0,0,0,0, 1,0,1,0, 0,0,0,0],
              m: [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
              l: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0],
              c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,1,0] },
      tone: { wave: "square", cut: 2200, q: 3.2, atk: .002, rel: .28, gain: .28, verb: .08 },
      // DRY WITH A SLAP, not a room: the space on an electro record is a tape
      // delay on the hook, which is why `verb` is nearly off and the echo is
      // the genre's one effect.
      fx: ["echo"],
      words: ["the sequence, filled to eighths — a step higher every other section",
              "the vocoder hook: eight steps of the phrase, every other note gone"],
      // A SEQUENCER DOES NOT DEVELOP, it TRANSPOSES: voice 0 is the pattern
      // filled in to a running eighth and lifted one degree on the odd
      // sections (the pattern-transpose button, and the one move acid's rotate
      // has no equivalent for). Voice 1 is the vocoder — a fixed eight-step
      // cell, halved, that moves to the phrase's second half when the sequence
      // lifts, so the two of them change places rather than both restating.
      word: (v, s) => (v === 0 ? (s % 2 ? [fill(2), transpose(1)] : [fill(2)])
                               : [excerpt(s % 2 ? 8 : 0, 8), drop(2)]),
    },

    // ---- THE REST OF THE DIAL (2026-08-17) --------------------------------
    // Twenty-nine more rooms, each one asked for by an artist or a record and
    // translated into the STYLE it stands for rather than transcribed from
    // it — SOURCES.md's provenance law: an idiom, not a quotation. Where a
    // style's true ancestor is public domain (a hymn tune, a Christmas
    // standard's big-band dress) the comment says so by name; everywhere
    // else it names the movement, not the song. Parents are argued the same
    // way the phase-2 ancestors above were — what genuinely explains the
    // sound, sourced from anchors already in the table — and `wants` names
    // what still isn't. A few of these are one another's parents (crooner
    // feeds yuletide, folkduo feeds worldfolk, emo feeds screamo); JS
    // doesn't care about key order inside one object literal, so they are
    // grouped by ROOM rather than by dependency.

    // HYMN [gospel]. The congregation, not the choir: four voices in block
    // chords, homophonic rather than independent — fugue's own `wants` list
    // asked for a chorale twenty-some anchors ago ("the Lutheran chorale his
    // subjects harmonized"), and this is that answer, generalized past Bach's
    // own harmonizations to the plain SATB a hymnal prints. No kit, no bass
    // voice of its own — the bass part IS the fourth voice, exactly as
    // counterpoint and spem already declare it.
    hymn: {
      label: "Boston 1831", rate: 1, bars: 8, voices: 4, near: "gospel",
      // LINEAGE: the four-part harmonization craft is counterpoint's — Fux's
      // rules, sung rather than played — over chant-shaped stepwise lines,
      // with gospel's plagal warmth already arguing for itself (a hymn tune
      // IS a plagal cadence's native home, twenty years before Dorsey put a
      // shuffle under it). The Sternhold & Hopkins metrical psalter, which
      // taught English congregations to sing in the first place, is missing.
      parents: { counterpoint: 0.45, gregorian: 0.3, gospel: 0.25 },
      wants: ["metrical psalter"],
      // THE PIPES IN THE ROOM. This said "the drawbar organ, not a pipe
      // organ" and it was right about the century and wrong about the sound:
      // `drawbarorgan` is one zone rooted at MIDI 96, so four voices of a
      // hymn were four copies of one C7 sample stretched down past hearing —
      // measured, the whole tape peaked at 0.019 with nothing above 2.5 kHz
      // in it. A Boston meeting house in 1831 has pipes anyway.
      //
      // AND NOW THE CONGREGATION SINGS IT. This is the one genre in the table
      // whose own words name four SINGERS ("the soprano, the tune"), and it was
      // refused one for a measured reason: the four parts render at MIDI 79-110
      // / 52-83 / 24-55 / 7-38 — six octaves apart, each line 31 semitones wide
      // — against a formant throat no wider than 25, and all a voice module got
      // was the parent's PER-NOTE fold, which wrapped 44-51% of every part's
      // intervals. A sampler survived the same spread because audio/plan.js
      // homeFor moves a whole line by octaves with its contour intact, and
      // windowOf answered null for anything that was not one.
      //
      // windowOf now reads a voice's own declared compass, so the congregation
      // moves whole like everybody else, and the same measurement reads
      // 51/24/51% -> 19/24/12%: the fold is quieter than the tune. THE THROAT IS
      // ONE THROAT — a mouth is a genre fact, not a chair fact — so the voice
      // type is the one whose window holds all three sung parts after the home,
      // which measured across the five is the tenor (alto, the hymnal's own,
      // comes back 19/27/35%). And the BASS PART IS STILL THE PIPES: at MIDI
      // 7-38 it is nobody's part to sing, an organ is what holds a hymn's bass
      // in a meeting house anyway, and it keeps this record a band rather than
      // an a-cappella one.
      instr: ["ahh_choir", "ohh_voices", "ahh_choir", "church_organ"],
      entry: () => 0, reg: v => [2, 0, -2, -4][v], realize: () => "line",
      kit: {}, nobass: true, harmony: "cycle",
      mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      roots: [0, 3, 0, 4, 0, 5, 3, 4],           // I IV I V | I vi IV V
      artic: "legato", maxHold: 4,
      tone: { wave: "triangle", cut: 2200, q: 0.8, atk: .05, rel: 1.5, gain: .24, verb: .5,
              // WHO SINGS: the hymnal mouth — round vowels, a little wobble, and
              // the loosest blend in the table, because a pew is not a choir
              // stall — on the tenor throat the measurement above chose. The two
              // choir ids alternate so the three parts do not all arrive on the
              // same syllable: `ohh_voices` rotates the same word one place
              // (audio/to-engine.js PATCH_VOICE `phase`), which is a-o against
              // o-a, which is what a room full of people sounds like.
              mouth: { ...MOUTHS.hymnal, voice: "tenor" } },
      words: ["the soprano, the tune", "the alto, a third under",
              "the tenor, a fifth under", "the bass, the octave and the root"],
      // PARALLEL, NOT MIRRORED — the one field that separates a hymnal from
      // counterpoint's contrary-motion mirror above: every voice sings the
      // SAME tune, spaced by a fixed diatonic interval, because that is what
      // four amateurs in a pew can actually do. transpose() in degree-space
      // is a third/fifth/octave exactly because the scale is seven long.
      word: v => (v === 0 ? [] : [transpose([0, -2, -4, -7][v])]),
    },

    // CROONER. A solo voice out front of a dance orchestra, at ballad tempo
    // — half the rate of the band that plays behind it, so the singer can
    // phrase across the bar the way a horn section never would. `anchor`
    // does the SAME job here it does in tango: a note the voice sits on has
    // to be a chord tone, and everything shorter is just diction.
    crooner: {
      label: "Los Angeles 1953", rate: 0.5, bars: 8, voices: 2, swing: 0.15, near: "jazz",
      // LINEAGE: the changes and the walking rhythm section are bebop's own
      // vocabulary played straighter and slower for a singer to sit on; the
      // vocal-group blend behind the lead is doo-wop's, one voice standing
      // out front of it instead of three trading it; gospel supplies the
      // trained, held, unhurried breath. Tin Pan Alley's standard songbook
      // — the actual repertoire a crooner sings — is still uncredited.
      parents: { jazz: 0.55, doowop: 0.25, gospel: 0.2 },
      wants: ["tin pan alley"],
      instr: ["solo_vox", "slow_strings"],
      drumkit: "brush",
      entry: v => (v === 0 ? 2 : 0), reg: v => (v === 0 ? 0 : -1),
      realize: v => (v === 0 ? "line" : "pad"),
      part: ["lead", "pad"],
      harmony: "cycle", roots: [0, 5, 1, 4, 0, 5, 1, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      prog: [{ d: 0, q: "maj7" }, { d: 5, q: "m7" }, { d: 1, q: "m7" }, { d: 4, q: "dom7" }],
      artic: "legato", anchor: 2, maxHold: 4,
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             h: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             p: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0] },
      fill: { p: [0,0,0,0, 0,0,0,0, 1,0,1,0, 1,0,1,0] },
      tone: { wave: "triangle", cut: 2200, q: 0.9, atk: .02, rel: 1.2, gain: .24, verb: .4,
              // WHO SINGS: low and slow, and the vibrato arrives LATE in the note — the whole trick
              mouth: MOUTHS.crooning },
      words: ["the voice, held over the changes", "the strings, one wash under it"],
      word: v => (v === 0 ? [] : [drop(2)]),
    },

    // YULETIDE. Crooner in its December coat — the one place this table
    // names a specific season by name, because the ancestor really is public
    // domain the way gregorian's is: a carol's melodic shape (stepwise, small
    // range, built to be sung by a room that has never rehearsed) is
    // centuries older than any record of it, and a big-band Christmas
    // standard is just crooner's own dress plus one instrument: the bell.
    yuletide: {
      label: "New York 1942", rate: 0.5, bars: 8, voices: 3, near: "crooner",
      // LINEAGE: complete, and honestly so — a Christmas standard IS crooner
      // (the ballad-tempo dance-orchestra vocal) plus hymn (the carol's
      // stepwise, plagal-leaning tune), and nothing else needs naming.
      parents: { crooner: 0.5, hymn: 0.3, gospel: 0.2 },
      wants: [],
      instr: ["solo_vox", "slow_strings", "music_box"],
      drumkit: "brush",
      entry: v => [2, 0, 4][v], reg: v => [0, -1, 3][v],
      realize: v => (v === 1 ? "pad" : "line"),
      part: ["lead", "pad", "riff"],
      harmony: "cycle", roots: [0, 3, 0, 4, 0, 5, 1, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      artic: "legato", anchor: 2, maxHold: 3,
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             h: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             p: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0] },
      tone: { wave: "triangle", cut: 2400, q: 0.9, atk: .02, rel: 1.3, gain: .24, verb: .42,
              // WHO SINGS: a carol, sung by somebody who learned it in a church
              mouth: MOUTHS.hymnal },
      words: ["the voice, the carol tune", "the strings, holding the harmony",
              "the bells, sparkling on top"],
      word: v => (v === 0 ? [] : v === 1 ? [drop(2)]
                                          : [only("gate", excerpt(0, 8)), transpose(2)]),
    },

    // MERSEYBEAT [beatles]. Same city, one year earlier, and a wider room:
    // where the `beatles` anchor is one particular band's counterpoint-taught
    // thirds, this is the whole 1962-63 Cavern circuit — cleaner and plainer,
    // built on the OFFBEAT HANDCLAP hook and a call that gets an answer,
    // which is the field the two genres actually differ on.
    merseybeat: {
      label: "Liverpool 1963", rate: 1, bars: 4, voices: 2, near: "beatles",
      // LINEAGE: the beat-group format is the catalog's own `beatles` anchor
      // taken as a scene rather than one band; doo-wop's vocal-group answer
      // figure and Chuck Berry's downstroke are the two things every Cavern
      // band actually played covers of before writing their own. Skiffle is
      // the smallest share because by 1963 the tea-chest bass was long gone —
      // it is the door the scene walked in through, not what it still plays.
      parents: { beatles: 0.35, doowop: 0.3, chuckberry: 0.2, skiffle: 0.15 },
      wants: [],
      instr: ["clean_guitar", "ohh_voices"],
      drumkit: "room",
      entry: () => 0, reg: v => v, realize: () => "line",
      harmony: "cycle", roots: [0, 4, 3, 0], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             c: [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,1,0] },
      tone: { wave: "triangle", cut: 2400, q: 1.0, atk: .005, rel: .6, gain: .28, verb: .22,
              // WHO SINGS: the same close harmony as beatles, one town and two years earlier
              mouth: MOUTHS.merseystack },
      words: ["the tune, straight ahead",
              "the harmony, a third above — answering the handclap hook"],
      word: v => (v === 0 ? [] : [transpose(2), only("gate", offbeats(4))]),
    },

    // PSYCH POP [beatles]. The same songwriter, further out: an eight-bar
    // form that spends its first half as a plain verse and its second half
    // as one long vamp with a choir answering into it — postrock's shape
    // (one figure, arriving voice by voice, one crescendo) written for a pop
    // band with a gospel choir instead of a wall of guitars.
    psychpop: {
      label: "London 1968", rate: 1, bars: 8, voices: 2, near: "beatles",
      // LINEAGE: the songwriting craft is `beatles`' own, further along the
      // same career; the massed choir answering "na na na" into a long vamp
      // is gospel's call-and-response, not the band's own invention; and the
      // shape of the arrival — quiet, then one instrument at a time, then
      // everything — is postrock's structural move, borrowed forty years
      // before postrock existed to name it. The mellotron/orchestral half of
      // the record is still missing.
      parents: { beatles: 0.45, gospel: 0.35, postrock: 0.2 },
      wants: ["mellotron", "orchestral pop"],
      instr: ["clean_guitar", "ahh_choir"],
      drumkit: "room",
      entry: v => (v === 1 ? 4 : 0), reg: v => v, realize: () => "line",
      harmony: "cycle", roots: [0, 0, 3, 3, 4, 4, 0, 0], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      maxHold: 3,
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,1,0, 1,1,1,1],
              x: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,9] },
      tone: { wave: "triangle", cut: 2200, q: 0.9, atk: .01, rel: 1.0, gain: .27, verb: .4,
              // WHO SINGS: voices as a wash, which is what the studio was for
              mouth: MOUTHS.dreamchoir },
      words: ["the tune, the verse as written",
              "the choir, arriving at the vamp — na na na, a third up"],
      word: v => (v === 1 ? [transpose(2), only("gate", offbeats(2))] : []),
    },

    // BIG BEAT [techno]. The rave floor played by a punk band — techno's
    // machine kick and dnb's broken edit under a guitar sample distorted
    // past the point of subtlety. The field that separates it from techno is
    // the KICK ITSELF: broken and syncopated where techno's is a plain four,
    // because a breakbeat under a machine floor is the entire joke.
    bigbeat: {
      label: "Essex 1997", rate: 1, bars: 4, voices: 2, near: "techno",
      // LINEAGE: the machine floor is techno's, the guitar-sample aggression
      // and the couldn't-care-less attitude are punk's, and the broken kick
      // pattern is dnb's edit brought down to a dance-floor tempo. The
      // original rave-breakbeat continuum both of the electronic parents
      // actually came out of is still the missing rung.
      parents: { techno: 0.35, punk: 0.35, dnb: 0.3 },
      wants: ["rave breakbeat"],
      // the guitar sample, and beside it the BUZZ: GM 85 charang is a
      // guitar-synth lead and to-engine.js plays it on the parent's tanh-
      // driven `lead_fuzz`, which is the Essex lead that fights a distorted
      // sample and wins. (It came off techno, where a fuzz guitar lead was
      // never Detroit's sound.)
      instr: ["distortion_guitar", "charang"],
      drumkit: "power",
      entry: () => 0, reg: v => -v, realize: () => "line",
      harmony: "modal", mode: MODES.phrygian, scale: DIATONIC,
      artic: "staccato", maxHold: 2, bassStyle: "octaves",
      kit: { k: [1,0,0,1, 0,0,1,0, 0,0,1,0, 0,1,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,1, 1,0,0,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      fill: { x: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,9] },
      tone: { wave: "sawtooth", cut: 1000, q: 3.5, atk: .002, rel: .4, gain: .3, verb: .15 },
      words: ["the guitar stab, breaking the grid", "the synth hook, an octave under"],
      word: v => (v === 0 ? [only("gate", rotate(3))] : [drop(2)]),
    },

    // DRILL [trap]. Trap's half-time snare and tied 808 kept, the major
    // triads thrown out for harmonic minor's raised seventh (the eerie lift
    // that reads as menace rather than menace-lite), and the hats given a
    // ROLL — a fast unpredictable run that trap's steady sixteenth never
    // attempts, written as `kitProb` rather than a fixed subdivision because
    // a drill hat roll's whole character is that you cannot see it coming.
    drill: {
      label: "Chicago 2012", rate: 1, bars: 4, voices: 2, near: "trap",
      // LINEAGE: the 808 slide and the half-time snare are trap's own
      // vocabulary, inherited whole; the chopped, minor-key sample loop
      // underneath is boom bap's technique aimed at a darker crate; the
      // sub-bass glide under everything is jungle's pedal, sped down. The
      // scene's own regional rap traditions (Chicago drill, UK drill) are
      // both missing — this anchor is the shared technique, not either city.
      parents: { trap: 0.5, boombap: 0.3, dnb: 0.2 },
      wants: ["chicago drill", "uk drill"],
      instr: ["felt_piano", "warm_pad"],
      drumkit: "electronic",
      entry: () => 0, reg: v => -v, realize: () => "line",
      harmony: "modal", mode: MODES.harmonic, scale: MODES.harmonic,
      artic: "tie", bassStyle: "pedal",
      kit: { k: [1,0,0,0, 0,0,0,1, 0,0,0,1, 0,0,0,0],
             s: [0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      kitProb: { h: [9,9,9,9, 9,9,6,9, 9,9,9,9, 9,9,4,9] },
      fill: { s: [0,0,0,0, 0,0,0,0, 1,0,0,0, 1,1,1,1] },
      tone: { wave: "square", cut: 1800, q: 2.0, atk: .003, rel: .5, gain: .28, verb: .25 },
      words: ["the piano loop, dark and minor", "the sub, sliding under it"],
      word: v => (v === 0 ? [only("gate", rotate(5))] : [drop(3)]),
    },

    // CLUB POP [disco]. Same floor, four years later, with a SONG on top of
    // it: house's stab feel over disco's kick, but the harmony resolves the
    // way a pop chorus does (a plain I-vi-IV-V) rather than looping a modal
    // seventh forever — the field that actually separates a dance-pop single
    // from the club record it was cut for.
    clubpop: {
      label: "New York 1983", rate: 1, bars: 4, voices: 2, near: "disco",
      // LINEAGE: the floor (four kick, offbeat clap, the open hat) is
      // disco's, played through synthpop's all-electronic chassis; house's
      // piano-stab feel is present in spirit but the piano is a synth voice
      // here — the actual downtown-club scene the record came out of is
      // still missing.
      parents: { disco: 0.45, synthpop: 0.3, house: 0.25 },
      wants: ["danceteria"],
      // a 1983 dance-pop single is a JUNO and a string machine, not a choir
      // patch: the chord chair takes GM 91 (-> juno60, the chorus is the
      // instrument) and the line keeps the ensemble. `synth_voice` was cast on
      // twelve genres at once; it keeps the seven that really are vocoder
      // records and gives back the five, of which this is one, that are not.
      instr: ["polysynth", "synth_strings_1"],
      drumkit: "electronic",
      entry: v => v, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      part: ["stab", "lead"],
      harmony: "cycle", roots: [0, 5, 3, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      prog: [{ d: 0, q: "7" }, { d: 5, q: "7" }, { d: 3, q: "7" }, { d: 4, q: "7" }],
      maxHold: 2, bassStyle: "eighths",
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      fill: { c: [0,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,1,0] },
      tone: { wave: "sawtooth", cut: 2600, q: 1.6, atk: .004, rel: .5, gain: .28, verb: .24 },
      words: ["the vocal hook, on the tune's rhythm", "the synth strings, answering"],
      word: v => (v === 1 ? [only("gate", rotate(4))] : []),
    },

    // POWER BALLAD [crooner]. A ballad that WAITS — the verse a crooner's
    // arrangement, brushes and strings; the chorus rock's full backbeat with
    // the crash reintroduced. `kits`, dnb's own device for a schedule that
    // changes bar to bar, does the arriving here instead of the breaking a
    // jungle record needs it for: quiet on the even bars, huge on the odd.
    powerballad: {
      label: "Los Angeles 1991", rate: 1, bars: 8, voices: 2, near: "crooner",
      // LINEAGE: the sung, held, chord-tone-anchored lead over strings is
      // crooner's own arrangement grown an arena; the massed emotional
      // uplift and the plagal warmth under the chorus are gospel's; rock
      // supplies the drums that finally arrive. Broadway's belted theatrical
      // vocal, the actual training this style is sung with, is missing.
      parents: { gospel: 0.4, crooner: 0.35, rock: 0.25 },
      wants: ["broadway"],
      instr: ["solo_vox", "slow_strings"],
      drumkit: "power",
      entry: () => 0, reg: v => -v, realize: v => (v === 1 ? "pad" : "line"),
      harmony: "cycle", roots: [0, 5, 3, 4, 0, 5, 4, 0], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      artic: "legato", anchor: 2, maxHold: 4,
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             p: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0] },
      kits: [
        { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
          p: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0] },
        { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
          s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
          x: [9,0,0,0, 0,0,0,0, 8,0,0,0, 0,0,0,0] },
      ],
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,1,0, 1,1,1,1],
              x: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,9] },
      tone: { wave: "triangle", cut: 2000, q: 0.9, atk: .02, rel: 1.4, gain: .26, verb: .5,
              // WHO SINGS: the key change is coming and this is the voice that survives it
              mouth: MOUTHS.belter },
      words: ["the voice, soaring over the changes",
              "the strings and the band, quiet then huge"],
      word: () => [],
    },

    // RETRO FUNK POP [funk]. Funk's clavinet-and-horns groove wired to a
    // pop song that actually MOVES: where `funk` is one dorian chord for the
    // whole record because the groove is the song, this resolves a real
    // I-vi-IV-V every four bars — the field that separates a funk pastiche
    // from the funk band it is impersonating.
    retrofunkpop: {
      label: "Los Angeles 2013", rate: 1, bars: 4, voices: 2, swing: 0.1, near: "funk",
      // LINEAGE: the clavinet-and-horns vocabulary is funk's, played over
      // Motown's song discipline (a real changing progression rather than a
      // vamp) with disco's four-on-the-floor pop polish underneath.
      parents: { funk: 0.45, motown: 0.3, disco: 0.25 },
      wants: [],
      instr: ["clavinet", "brass_section"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: () => "line",
      harmony: "cycle", roots: [0, 5, 3, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      prog: [{ d: 0, q: "7" }, { d: 5, q: "7" }, { d: 3, q: "7" }, { d: 4, q: "7" }],
      maxHold: 2, artic: "staccato", bassStyle: "sixteenths",
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,1,1,0, 1,1,1,0, 1,1,1,0, 1,1,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,1, 0,0,1,0, 1,0,1,0] },
      tone: { wave: "square", cut: 2200, q: 1.8, atk: .003, rel: .35, gain: .28, verb: .16 },
      words: ["the clavinet, on the changes",
              "the horns, answering — the phrase's own gate, complemented"],
      // A TRUE ANSWER, not a doubling: `complement("gate")` fires the horns
      // exactly where the clavinet does not, so the two never land on the
      // same step and cannot read as one hook stated twice.
      word: v => (v === 1 ? [only("gate", complement("gate"))] : []),
    },

    // REGGAETON [reggae]. The one-drop's Caribbean cousin, played with a
    // hip-hop rhythm section: the DEMBOW — a two-kick, double-snare figure —
    // replaces the skank as the genre's absolute gate, sitting on top of a
    // minor two-chord vamp that never resolves anywhere, reggae's own
    // no-mode spareness kept exactly.
    reggaeton: {
      label: "San Juan 2004", rate: 1, bars: 4, voices: 2, near: "reggae",
      // LINEAGE: the one-drop skank's Caribbean root is reggae's; the
      // chopped, sample-built track underneath is boom bap's method aimed
      // at a different vocabulary; the sub-bass slide under it is trap's.
      // Dancehall — the actual Jamaican digital-riddim scene the dembow
      // itself came out of — is the missing rung between all three.
      parents: { reggae: 0.4, boombap: 0.35, trap: 0.25 },
      wants: ["dancehall"],
      // the dembow's top is a synth STAB — a poly chord hit hard and let go —
      // with a guitar line over it. A choir patch holding the pad made every
      // San Juan record breathe like a church.
      instr: ["polysynth", "clean_guitar"],
      drumkit: "electronic",
      entry: v => v, reg: v => v, realize: v => (v === 0 ? "pad" : "line"),
      part: ["stab", "lead"],
      harmony: "cycle", roots: [0, 0, 5, 3],
      artic: "staccato", maxHold: 2, bassStyle: "octaves",
      // THE DEMBOW, written once: kick doubled at 1 and the a-of-2, snare
      // doubled at the and-of-2 and 4 — "boom-ch-boom-chick" — the absolute
      // grid every reggaeton record sits on regardless of what plays over it.
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,1],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,1, 1,0,1,0, 1,1,1,1] },
      tone: { wave: "square", cut: 2000, q: 1.6, atk: .004, rel: .4, gain: .28, verb: .2 },
      words: ["the vocal hook, on the dembow's own rhythm",
              "the guitar, answering — the phrase's own gate, untouched"],
      word: v => (v === 0 ? [only("gate", excerpt(0, 8))] : []),
    },

    // LATIN POP [bossa]. A rock band's instrumentation carrying Latin
    // percussion and a melody that leans on the raised seventh — harmonic
    // minor rather than bossa's cool-jazz major sevenths, which is the field
    // that separates a Bogotá/Barranquilla pop-rock record from the Rio
    // apartment sound it shares a rhythm section with.
    latinpop: {
      label: "Miami 2001", rate: 1, bars: 4, voices: 2, near: "bossa",
      // LINEAGE: the sevenths-and-understatement harmonic language and the
      // rhythm-section restraint are bossa's own, transplanted out of the
      // apartment and into a rock band; the cross-rhythm percussion under
      // it is afrobeat's technique aimed at a different clave; rock supplies
      // the electric backbone. Cumbia, the actual Colombian floor this
      // style is built to move, is the missing parent.
      parents: { afrobeat: 0.35, rock: 0.35, bossa: 0.3 },
      wants: ["cumbia"],
      instr: ["nylon_string_guitar", "clean_guitar"],
      drumkit: "acoustic",
      entry: () => 0, reg: v => v, realize: () => "line",
      harmony: "cycle", roots: [0, 3, 4, 0], mode: MODES.harmonic,
      scale: MODES.harmonic, diatonic: true,
      artic: "staccato", maxHold: 3, bassStyle: "eighths",
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { p: [1,0,0,1, 0,1,1,0, 1,0,1,1, 1,0,1,0] },
      tone: { wave: "sawtooth", cut: 2400, q: 1.4, atk: .006, rel: .5, gain: .27, verb: .24 },
      words: ["the guitar, the hook", "the electric guitar, doubling an octave down"],
      word: v => (v === 1 ? [drop(2), transpose(-7)] : []),
    },

    // K-POP [synthpop]. A pop-song chassis built from three different
    // records at once — the synth-stab machine, the disco floor, the
    // stutter-edited hat roll a hip-hop verse needs — which is the genre's
    // own honest description: it is a production METHOD, assembling
    // whichever record the section needs, more than it is one groove.
    kpop: {
      label: "Seoul 2012", rate: 1, bars: 4, voices: 2, near: "synthpop",
      // LINEAGE: the all-synth stab chassis is synthpop's; the four-on-the-
      // floor pop-chorus floor is disco's; the stuttered, probability-edited
      // hat is boom bap's chopped hand brought to a machine kit; the vocal
      // stack that answers itself is R&B's. J-pop's own idol-record
      // tradition, the room this style first grew up next door to, is
      // uncredited.
      parents: { synthpop: 0.35, disco: 0.25, boombap: 0.2, rnb: 0.2 },
      wants: ["j-pop"],
      // the assembly method's two halves said as two instruments: a poly
      // holding the chorus chord and a bright square hook riding it. Both are
      // machines, which is the honest description of a genre that is a
      // production method — and neither is the choir patch it used to lead on.
      instr: ["polysynth", "square_lead"],
      drumkit: "electronic",
      entry: v => v, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      part: ["stab", "lead"],
      harmony: "cycle", roots: [0, 5, 3, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      prog: [{ d: 0, q: "7" }, { d: 5, q: "7" }, { d: 3, q: "7" }, { d: 4, q: "7" }],
      maxHold: 2, artic: "staccato", bassStyle: "eighths",
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      kitProb: { h: [9,6,9,6, 9,6,9,6, 9,6,9,6, 9,6,4,9] },
      fill: { s: [0,0,0,0, 1,0,0,1, 0,0,1,0, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 2800, q: 2.2, atk: .003, rel: .4, gain: .28, verb: .24 },
      words: ["the vocal hook, stabbing the changes", "the synth line, answering an octave up"],
      word: v => (v === 1 ? [only("gate", rotate(4)), transpose(2)] : []),
    },

    // BOY BAND [doowop]. Doo-wop's group-blend arithmetic (a lead and two
    // backing parts, a stab-and-riff-and-lead register scheme copied whole)
    // run through a nineties R&B production — the harmonize PIPE rnb already
    // declares (stacked sixths, chord-locked) does the backing-vocal work
    // here exactly as it does there, cited rather than reinvented.
    boyband: {
      label: "Orlando 1997", rate: 1, bars: 4, voices: 3, near: "doowop",
      // LINEAGE: the group-of-voices arithmetic (lead out front, a harmony
      // stack, a keyboard holding the changes) is doo-wop's own scheme,
      // inherited whole down to the `part` register spacing; the sixths-
      // stacked backing vocal technique and the straight-time feel are
      // R&B's; disco keeps the floor moving underneath. The vocal-audition
      // pop-factory system that actually assembled these groups has no
      // musical anchor to name.
      parents: { motown: 0.3, doowop: 0.3, rnb: 0.25, disco: 0.15 },
      wants: [],
      instr: ["solo_vox", "ohh_voices", "legend_ep_2"],
      drumkit: "electronic",
      entry: v => (v === 2 ? 2 : 0), reg: () => 0,
      realize: v => (v === 2 ? "pad" : "line"),
      part: ["lead", "riff", "stab"],
      harmony: "cycle", roots: [0, 5, 3, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      prog: [{ d: 0, q: "7" }, { d: 5, q: "7" }, { d: 3, q: "7" }, { d: 4, q: "7" }],
      maxHold: 2,
      pipes: [{ id: "harmonize", p: 0.5, gap: "sixth" }],
      kit: { k: [1,0,0,1, 0,0,0,0, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,0,1, 0,1,0,0, 1,0,0,1, 0,0,1,0] },
      fill: { h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2200, q: 1.0, atk: .008, rel: .8, gain: .27, verb: .32,
              // WHO SINGS: stacked TIGHT — the tightness is the production
              mouth: MOUTHS.boygroup },
      words: ["the lead, the hook", "the harmony stack, a sixth under",
              "the EP, holding the changes"],
      word: () => [],
    },

    // EMO [punk]. Punk's downstroked directness with the dynamics power
    // ballad already proved: `kits` alternates a quiet, arpeggiated verse
    // against a loud, crashing chorus — the field that actually separates
    // this from punk, which refuses to develop AT ALL. Confessional means
    // legato where punk is staccato: a chord let ring instead of chopped.
    emo: {
      label: "Chicago 1999", rate: 1, bars: 4, voices: 2, near: "punk",
      // LINEAGE: the format (guitar/bass/drums, verse-chorus, three minutes)
      // and the raw energy are punk's; the major-key-read vi-IV-I-V loop and
      // the song discipline underneath are rock's; the wash the loud chorus
      // opens into is shoegaze's blur, thinned to a backbeat. Midwest emo's
      // own tapped-arpeggio guitar language is still uncredited.
      parents: { punk: 0.45, rock: 0.3, shoegaze: 0.25 },
      wants: ["midwest emo"],
      instr: ["clean_guitar", "overdrive_guitar"],
      drumkit: "power",
      entry: () => 0, reg: v => v, realize: () => "line",
      harmony: "cycle", roots: [5, 3, 0, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "eighths",
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      kits: [
        { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
          s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
          h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
        { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
          s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
          h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
          x: [9,0,0,0, 0,0,0,0, 8,0,0,0, 0,0,0,0] },
      ],
      fill: { s: [0,0,0,0, 1,0,0,1, 0,0,1,0, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 2000, q: 1.6, atk: .006, rel: .6, gain: .29, verb: .22 },
      words: ["the guitar, arpeggiating the changes",
              "the second guitar, an octave under, doubling in the loud half"],
      word: v => (v === 1 ? [drop(2)] : []),
    },

    // SCREAMO [emo]. Emo's dynamics pushed past the point of song into the
    // point of collapse: death metal's ridden cymbal and locrian ♭5-is-home
    // scale (the exact array, cited whole — the ♭5 stays the point) under
    // TWO guitars reading DIFFERENT HALVES of the phrase — not the held-second
    // blur shoegaze and bulgarian use (a fixed transpose, against a wall that
    // fills every step, is one riff stated twice; the second half of the
    // subject is a different riff), at hardcore tempo instead of a drone's.
    screamo: {
      label: "San Diego 1994", rate: 1, bars: 4, voices: 2, near: "deathmetal",
      // LINEAGE: emo's confessional dynamics are the base, pushed to the
      // edge by punk's raw directness and death metal's chromatic dissonance
      // and ridden cymbal. Hardcore, the actual scene emo and screamo both
      // grew out of, is the one uncredited rung between all three.
      parents: { emo: 0.5, punk: 0.25, deathmetal: 0.25 },
      wants: ["hardcore"],
      instr: ["distortion_guitar", "distortion_guitar"],
      drumkit: "power",
      entry: () => 0, reg: v => -v, realize: () => "line",
      harmony: "cycle", roots: [0, 0, 1, 1], mode: MODES.phrygian,
      scale: [0, 1, 3, 5, 6, 8, 10],
      artic: "staccato", bassStyle: "sixteenths",
      kit: { k: [1,0,1,0, 0,0,1,0, 1,0,1,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             r: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      fill: { s: [1,0,1,0, 1,0,1,0, 1,1,1,1, 1,1,1,1],
              x: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,9] },
      tone: { wave: "sawtooth", cut: 1600, q: 2.2, atk: .002, rel: .35, gain: .3, verb: .18 },
      words: ["the riff, screamed through — every step",
              "the second guitar, the subject's own second half, a half-step under"],
      // A DIFFERENT RIFF, NOT A DOUBLING: a fixed transpose of the SAME notes
      // is one line restated, which against a wall that fills every step
      // reads as the identical guitar twice. `excerpt(8,8)` hands the second
      // guitar the phrase's own second half instead — a genuinely different
      // sequence of notes, the way two rhythm guitars in a real band play
      // related but not identical parts.
      word: v => (v === 0 ? [only("gate", fill(1))] : [excerpt(8, 8), transpose(-1)]),
      fx: ["crunch"],
    },

    // CONFESSIONAL POP [countrypop]. Country's fifths bass and storytelling
    // guitar kept whole, the banjo traded out one section at a time for a
    // synth as the arrangement modernizes — a verse that stays acoustic and
    // a chorus that lifts a fourth into the pop half is the same "the
    // record changes costume mid-song" device psychpop already uses.
    confessionalpop: {
      label: "Nashville 2008", rate: 1, bars: 4, voices: 3, near: "countrypop",
      // LINEAGE: the fifths bass, the storytelling verse and the acoustic
      // guitar are countrypop's, kept whole; rock supplies the full-band
      // arrangement a country radio ballad graduates into; synthpop supplies
      // the polished electronic chorus lift. Nothing about this reads as a
      // missing ancestor — it is countrypop modernizing itself in real time.
      parents: { countrypop: 0.4, rock: 0.3, synthpop: 0.3 },
      wants: [],
      // THE ONE GENRE HERE THAT GAINS A CHAIR RATHER THAN SWAPPING ONE. The
      // other three singers this round arrived by correcting a cast — a
      // section standing in for a soloist, a string machine standing in for a
      // throat — but a confessional record's problem was simpler: both of its
      // instruments are its identity (the acoustic guitar countrypop hands it
      // whole, and the synth that IS the turn from acoustic to pop), so there
      // was nothing a voice could take without taking the record with it.
      //
      // So the singer SITS BESIDE, in unison with the guitar: voice 2 is
      // written at voice 0's register with voice 0's word, which is one line
      // played and sung at once — the oldest arrangement there is, and the
      // only one that costs the guitar nothing. `reg` says that explicitly
      // rather than letting `v` run on to a third octave, where no throat is.
      instr: ["steel_string_guitar", "polysynth", "solo_vox"],
      drumkit: "room",
      entry: () => 0, reg: v => (v === 2 ? 0 : v), realize: () => "line",
      harmony: "cycle", roots: [3, 4, 5, 0], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "fifths",
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,1, 0,0,1,0, 1,0,1,0] },
      tone: { wave: "triangle", cut: 2600, q: 1.1, atk: .005, rel: .6, gain: .27, verb: .24,
              // WHO SINGS: close, plain, breathy, a foot from the microphone —
              // the wobble arrives late and never gets wide, because a voice
              // telling you something does not perform the note
              mouth: MOUTHS.confessional },
      words: ["the guitar, telling the story",
              "the synth, answering a fourth up — the turn from acoustic to pop",
              "the voice, singing the story with the guitar"],
      word: v => (v === 1 ? [transpose(3)] : []),
    },

    // DARK R&B [rnb]. R&B's maj7 ballad harmony traded for a moody dorian
    // pedal that never resolves — ambient's stillness and drone logic under
    // a falsetto that holds notes the way tango's `anchor` and crooner's
    // both already demand. `intro:"fade"` is ambient's own device: this
    // does not arrive, it surfaces.
    darkrnb: {
      label: "Toronto 2011", rate: 1, bars: 4, voices: 2, near: "rnb",
      // LINEAGE: the sung, chord-tone-anchored maj7 ballad lead is R&B's own
      // vocabulary sung darker; the pulseless, surfacing stillness under it
      // is ambient's, not R&B's straight-time pocket; synthpop supplies the
      // all-electronic chassis. Nothing here reads as missing — this is two
      // fully-anchored traditions meeting on purpose.
      parents: { rnb: 0.45, ambient: 0.3, synthpop: 0.25 },
      wants: [],
      // A FALSETTO IS A THROAT, not a string machine. Same correction as the
      // parent row: `synth_voice` is a VP-330 and the genre's own first word is
      // "the falsetto", which the formant tables have a whole voice type for.
      // The pad chair is untouched — the drifting halo under it is half the
      // record, and this genre is `intro:"fade"` precisely because that pad is
      // what surfaces first.
      instr: ["solo_vox", "halo_pad"],
      drumkit: "electronic",
      entry: v => v, reg: v => v - 1, realize: v => (v === 1 ? "pad" : "line"),
      intro: "fade",
      harmony: "cycle", roots: [0, 3, 5, 4], mode: MODES.dorian,
      scale: MODES.dorian, diatonic: true,
      artic: "legato", anchor: 2, maxHold: 4, bassStyle: "pedal",
      kit: { k: [1,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1] },
      fill: { s: [0,0,0,0, 0,0,0,0, 1,0,0,0, 1,1,1,1] },
      tone: { wave: "triangle", cut: 1600, q: 1.2, atk: .03, rel: 1.8, gain: .24, verb: .6,
              // WHO SINGS: head voice, nearly straight, and more air in it than
              // anything else in the table — the wobble arriving late and never
              // widening is what keeps a held note sounding cold
              mouth: MOUTHS.falsetto },
      words: ["the falsetto, held over the changes", "the pad, drifting under it"],
      word: v => (v === 1 ? [drop(2)] : []),
    },

    // BIG ROOM [techno]. An EDM drop written as `kits`' own alternation —
    // the device dnb uses for a two-bar break and power ballad uses for a
    // quiet-to-loud arc, here doing a BUILD (hats alone) against a DROP
    // (the full four-on-the-floor plus the open hat) — house's stab chord
    // and techno's kick-and-open-hat kit, aimed at a festival main stage.
    bigroom: {
      label: "Las Vegas 2012", rate: 1, bars: 8, voices: 2, near: "techno",
      // LINEAGE: the seventh-loop stab progression is house's; the kick-and-
      // open-hat floor is techno's, at festival scale; trap's half-time snare
      // supplies the drop's low-end weight. Dubstep's own bass-design
      // lineage, the other half of the "festival EDM" story, is missing.
      parents: { house: 0.4, techno: 0.35, trap: 0.25 },
      wants: ["dubstep"],
      instr: ["polysynth", "square_lead"],
      drumkit: "tr909",
      // THE DROP LEAD IS A SUPERSAW, the term itself — lineOnly, so only the
      // riding lead swaps (the stab underneath stays the sampled patch).
      synth: { dsp: "supersaw", root: "supersaw", level: 0.85, lineOnly: true,
               set: { voices: 5, wave: 1, detune: 0.35, octave: 1, cutoff: 4000,
                      res: 0.15, attack: 0.005, release: 0.25, sustain: 0.8 } },
      entry: v => v, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      part: ["stab", "lead"],
      harmony: "cycle", roots: [0, 5, 3, 4, 0, 5, 3, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "eighths",
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             o: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0] },
      // THE BUILD IS THINNER THAN THE DROP, on purpose: an even bar is a
      // held riser (hats alone, half the density), an odd bar is the floor
      // landing — which is also what makes the closing fill bar read as an
      // arrival rather than just one more bar of the same kit.
      kits: [
        { h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
        { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
          c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
          o: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0] },
      ],
      fill: { o: [0,0,1,0, 0,0,1,0, 1,0,1,0, 1,0,1,1] },
      tone: { wave: "sawtooth", cut: 2200, q: 2.4, atk: .003, rel: .4, gain: .29, verb: .2 },
      words: ["the stab, huge, on the drop", "the lead, an octave up, riding the build"],
      word: v => (v === 1 ? [transpose(2)] : []),
    },

    // BLUE-EYED SOUL [motown]. Motown's changes and stab-and-lead scheme
    // kept, the walking bass swapped for funk's sixteenth-note hand and the
    // snare-on-all-four thinned to a real backbeat — smoother, less showband,
    // more session — which is the whole genre in one sentence.
    blueeyedsoul: {
      label: "Philadelphia 1976", rate: 1, bars: 4, voices: 2, near: "motown",
      // LINEAGE: the changes (I-vi-IV-V-with-sevenths) and the stab-and-lead
      // register scheme are motown's own, kept nearly whole; funk supplies
      // the sixteenth-note bass hand in place of motown's walk; rock supplies
      // the smoother, guitar-forward session-band backbone.
      parents: { motown: 0.45, rock: 0.3, funk: 0.25 },
      wants: [],
      instr: ["electric_piano", "clean_guitar"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      part: ["stab", "lead"],
      harmony: "cycle", roots: [0, 5, 3, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      prog: [{ d: 0, q: "7" }, { d: 5, q: "7" }, { d: 3, q: "7" }, { d: 4, q: "7" }],
      maxHold: 2, artic: "legato", bassStyle: "sixteenths",
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1] },
      fill: { s: [0,0,0,0, 1,0,0,1, 0,0,1,0, 1,0,1,0] },
      tone: { wave: "triangle", cut: 2400, q: 1.0, atk: .006, rel: .7, gain: .27, verb: .28 },
      words: ["the EP, comping the changes", "the guitar, doubling the hook an octave up"],
      word: v => (v === 1 ? [transpose(7)] : []),
    },

    // FOLK DUO [skiffle]. Two voices in close harmony over one acoustic
    // guitar — MODAL, not counterpoint's emergent two-line machinery: a folk
    // duo does not compute contrary motion by rule, it just sings the tune a
    // third under, by ear, over one implied chord. `harmony:"emergent"` is
    // the counterpoint family's own roster (the §48 ruling names it exactly
    // fugue/spem/counterpoint) and a parallel third is a different, plainer
    // thing than that machinery — the same distinction drone draws against
    // gregorian one row up.
    folkduo: {
      label: "Greenwich Village 1964", rate: 1, bars: 8, voices: 2, near: "skiffle",
      // LINEAGE: the string-band-plays-American-song format is skiffle's;
      // countrypop's close vocal harmony and fifths-leaning guitar are the
      // other half; counterpoint contributes the two-voice-as-one-line
      // discipline, thinned from a mirror to a parallel third. The
      // Appalachian ballad tradition both duo and trio folk revivalists
      // actually drew their repertoire from is still uncredited.
      parents: { skiffle: 0.4, countrypop: 0.35, counterpoint: 0.25 },
      wants: ["appalachian ballad"],
      // A DUO IN THE VILLAGE PLAYS A STEEL-STRING. The nylon is a classical
      // and a bossa instrument (Rio, two rows up, keeps it); what is under
      // two voices singing a third apart in 1964 is a dreadnought with bronze
      // on it, and the difference is the whole top end of the record.
      instr: ["steel_string_guitar", "ohh_voices"],
      entry: () => 0, reg: v => 1 - v, realize: () => "line",
      kit: {}, nobass: true, harmony: "modal",
      intro: "solo",                 // the guitar states the tune before the harmony joins
      // MAJOR PENTATONIC — the actual alphabet an Appalachian ballad sings
      // in, and plainer than counterpoint's seven-note diatonic on purpose.
      scale: SCALES.majpent, artic: "legato",
      tone: { wave: "triangle", cut: 2400, q: 0.9, atk: .006, rel: .8, gain: .24, verb: .35,
              // WHO SINGS: two people who have sung together for years: closer than a choir
              mouth: { ...MOUTHS.hymnal, blend: 0.4, syll: 2 } },
      words: ["the guitar and the lead voice, the tune",
              "the harmony voice, a third below — parallel, not mirrored"],
      word: v => (v === 1 ? [transpose(-2)] : []),
    },

    // WORLD FOLK [afrobeat]. A folk duo's songwriting discipline carrying
    // West African guitar-and-kalimba interplay and cross-rhythm percussion
    // — afrobeat's threes against the four, thinned from a horn-led band to
    // two acoustic voices, in a bright mixolydian that reads as both
    // traditions' ♭VII at once.
    worldfolk: {
      label: "Johannesburg 1986", rate: 1, bars: 8, voices: 2, near: "afrobeat",
      // LINEAGE: the folk-song discipline (a story, a verse, one guitar
      // carrying it) is folkduo's; the cross-rhythm percussion and the
      // interlocking-guitar technique are afrobeat's, thinned from a big
      // band to a duo; countrypop's bright major-key optimism colours the
      // top. Mbaqanga, the South African street-pop the guitar language is
      // actually borrowed from, is the missing rung.
      parents: { afrobeat: 0.4, folkduo: 0.35, countrypop: 0.25 },
      wants: ["mbaqanga"],
      // THE COMMENT ALREADY NAMED THE BAND: "guitar-and-kalimba interplay".
      // The kalimba was sitting in the library unasked-for while a marimba
      // stood in for it, and the guitar in Johannesburg is a bright clean
      // ELECTRIC — the high, thin, picked tone of a mbaqanga session — not
      // the nylon a folk duo brings.
      instr: ["clean_guitar", "kalimba"],
      drumkit: "acoustic",
      entry: () => 0, reg: v => v, realize: () => "line",
      harmony: "cycle", roots: [0, 3, 4, 0, 0, 5, 3, 4], mode: MODES.mixo,
      scale: MODES.mixo, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "eighths",
      kit: { k: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             s: [0,0,0,0, 0,1,0,0, 0,0,0,0, 0,1,0,0],
             p: [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,1,0],
             h: [1,1,1,0, 1,1,1,0, 1,1,1,0, 1,1,1,0] },
      fill: { p: [1,0,1,1, 0,1,1,0, 1,0,1,1, 1,1,0,1] },
      tone: { wave: "triangle", cut: 2400, q: 1.0, atk: .006, rel: .7, gain: .26, verb: .3 },
      words: ["the guitar, the folk tune", "the marimba, the African line under it"],
      word: v => (v === 1 ? [rotate(4), drop(2)] : []),
    },

    // JAM BAND [blues]. A twin-guitar band that never stops soloing over the
    // same twelve bars blues already wrote — `PROGS.blues12` cited whole,
    // because a jam band's entire repertoire IS the blues form, played
    // longer and looser. Where blues' answer voice is one fixed rotate(8),
    // this rotates a DIFFERENT amount every time the form comes back round —
    // the sound of a solo that keeps discovering new material over the same
    // changes rather than repeating one lick.
    jamband: {
      label: "San Francisco 1972", rate: 1, bars: 12, voices: 2, swing: 0.15, near: "blues",
      // LINEAGE: the twelve-bar form and the electric-band instrumentation
      // are blues' own, taken whole; rock supplies the extended-form,
      // two-guitar-interplay format; jazz supplies the walking bass and the
      // idea that a chorus is a launching point rather than a fixed part.
      // Psychedelic rock's studio-born extended-jam ethos, the actual scene
      // this style grew out of, is the missing rung.
      parents: { blues: 0.4, rock: 0.35, jazz: 0.25 },
      wants: ["psychedelic rock"],
      instr: ["clean_guitar", "clean_guitar"],
      drumkit: "room",
      entry: () => 0, reg: v => -v, realize: () => "line",
      harmony: "cycle", bassStyle: "walk",
      roots: [0,0,0,0, 3,3,0,0, 4,3,0,4],
      prog: PROGS.blues12,
      maxHold: 5,
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 0,0,1,0, 0,0,0,0],
              x: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,8] },
      tone: { wave: "sawtooth", cut: 1600, q: 1.6, atk: .006, rel: 1.0, gain: .28, verb: .24 },
      words: ["the lead guitar, exploring the changes",
              "the second guitar, answering — rotated a different amount every chorus"],
      word: (v, s) => (v === 0 ? [] : [rotate((s % 4) + 2)]),
    },

    // SOPHISTI-ROCK [steely]. Steely's jazz-schooled changes and walking
    // bass, played on a Hammond instead of a Rhodes and a real backbeat
    // instead of a laid-back shuffle — a rock band with a jazz education
    // rather than a studio band with a rock format, which is the field
    // that separates the two.
    sophistirock: {
      label: "London 1986", rate: 1, bars: 8, voices: 2, swing: 0.15, near: "steely",
      // LINEAGE: the band format and the muscular backbeat are rock's own;
      // funk's syncopated hand colours the groove underneath; jazz supplies
      // the dorian changes and the walking bass, the same vocabulary steely
      // draws on but played harder. Progressive rock's extended-arrangement
      // ambition, the format this style actually grew up inside, is the
      // missing rung.
      parents: { rock: 0.35, funk: 0.3, jazz: 0.35 },
      wants: ["progressive rock"],
      instr: ["rock_organ", "clean_guitar"],
      drumkit: "room",
      entry: () => 0, reg: v => -v, realize: () => "line",
      harmony: "cycle", mode: MODES.dorian, scale: MODES.dorian, diatonic: true,
      roots: [0, 3, 4, 0, 0, 3, 4, 5],
      artic: "legato", maxHold: 3, bassStyle: "walk",
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1] },
      fill: { s: [0,0,0,0, 1,0,0,1, 1,0,1,0, 1,0,1,1] },
      tone: { wave: "square", cut: 2000, q: 1.4, atk: .008, rel: .8, gain: .28, verb: .26 },
      words: ["the organ, swirling through the changes", "the guitar, doubling low"],
      word: v => (v === 1 ? [drop(2), transpose(-7)] : []),
    },

    // MOTORIK [kraftwerk]. Kraftwerk's own machine pulse, before the pop
    // song arrived — kick and snare struck TOGETHER on every quarter
    // (Jaki Liebezeit's beat, not a four-on-the-floor: the snare answers the
    // kick rather than the backbeat answering it) under even, unaccented
    // sixteenths that never let up. NO FILL, ever, and that absence is the
    // whole discipline: the beat does not vary bar to bar, on principle.
    motorik: {
      label: "Düsseldorf 1974", rate: 1, bars: 8, voices: 2, near: "kraftwerk",
      // LINEAGE: kraftwerk's own machine-pulse half, isolated from the pop-
      // song half that anchor also carries; minimalism's repeating,
      // barely-developing cell is the other whole ancestor — motorik IS a
      // process piece with a rock band's instrumentation. Neu!, the actual
      // other half of this sound, has no separate anchor to cite.
      parents: { kraftwerk: 0.6, minimalism: 0.4 },
      wants: ["neu"],
      instr: ["polysynth", "synth_strings_1"],
      // THE PULSE IS A MOOG, not a keyboard patch pretending to be one — both
      // voices are line, so both get the real Model D kraftwerk's own line
      // plays; a sampled pad cannot repeat eight bars with a machine's
      // exactness, and that exactness is the whole genre.
      synth: { dsp: "modeld", root: "modeld", level: 0.78,
               set: { cutoff: 2000, res: 0.2, envAmount: 0.6, envAttack: 0.003,
                      envDecay: 0.12, envSustain: 0.7, oscMix: 0.3, drive: 0.18,
                      glide: 0, drift: 3 } },
      drumkit: "electronic",
      entry: v => (v === 1 ? 4 : 0), reg: v => v - 1, realize: () => "line",
      harmony: "modal", mode: MODES.mixo, scale: MODES.mixo,
      artic: "tie", swing: 0,
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             s: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 1800, q: 1.2, atk: .005, rel: .3, gain: .27, verb: .15 },
      words: ["the sequence, repeating exactly",
              "the second line, entering from bar 5 — the one change in eight bars"],
      word: () => [],
    },

    // ROBOTIC POP [kraftwerk]. Motorik's mechanical pulse folded back into
    // an actual verse-chorus SONG — synthpop's I-vi-IV-V-with-sevenths sung
    // by a vocoder rather than motorik's wordless process piece, which is
    // the field that separates the two Kraftwerk children.
    roboticpop: {
      label: "Düsseldorf 1978", rate: 1, bars: 4, voices: 2, near: "synthpop",
      // LINEAGE: the vocoder-and-sequencer chassis and the deadpan machine
      // delivery are kraftwerk's own; synthpop supplies the actual pop-song
      // form (a real changing progression, a hook) that anchor's motorik
      // sibling refuses to have.
      parents: { kraftwerk: 0.55, synthpop: 0.45 },
      wants: [],
      // DÜSSELDORF 1978 IS A FORMANT SPEECH SYNTHESISER, not a metaphor for one:
      // the deadpan machine at the front of those records is a Votrax, a Speak &
      // Spell — a tube driven by an articulatory table, which is exactly what
      // engine/faust/dsp/tract_voice.dsp is. `synth_voice` on voice 0's LINE chair
      // reaches it. The sequence answering an octave under keeps the Model D, so
      // the two parts stay two machines rather than one machine twice — and until
      // the mouth was asked BEFORE the signature synth (to-engine.js recipeFor),
      // the hook was a Model D too, doubling the part beside it.
      instr: ["synth_voice", "polysynth"],
      // the vocoder hook and the octave-under sequence are the same machine
      // playing two parts, not a sample bank standing in for it
      synth: { dsp: "modeld", root: "modeld", level: 0.8,
               set: { cutoff: 2600, res: 0.3, envAmount: 0.5, envAttack: 0.002,
                      envDecay: 0.12, envSustain: 0.6, oscMix: 0.2, drive: 0.25,
                      glide: 0, drift: 2 } },
      drumkit: "cr78",
      entry: v => v, reg: v => v - 1, realize: () => "line",
      harmony: "cycle", roots: [0, 5, 3, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      prog: [{ d: 0, q: "7" }, { d: 5, q: "7" }, { d: 3, q: "7" }, { d: 4, q: "7" }],
      artic: "staccato", maxHold: 2, bassStyle: "octaves",
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0] },
      tone: { wave: "square", cut: 2400, q: 2.4, atk: .002, rel: .3, gain: .28, verb: .24 },
      words: ["the vocoder, singing the hook, staccato",
              "the sequence, answering an octave under — the phrase's own gate, complemented"],
      // A CALL AND AN ANSWER, not the same hook twice: `complement("gate")`
      // fires the sequence exactly where the vocoder is silent, so an octave
      // doubling never lands on the SAME step as the line it doubles.
      word: v => (v === 1 ? [only("gate", complement("gate")), transpose(-7)] : []),
    },

    // INDUSTRIAL METAL [deathmetal]. Death metal's chromatic riff wall and
    // locrian ♭5-is-home scale, cited whole, played to a QUANTIZED machine
    // kick instead of a drummer's blast — the field that separates a band
    // playing to a sequencer from a band playing itself, which is exactly
    // what Kraftwerk's own inheritance argues.
    industrialmetal: {
      label: "Chicago 1988", rate: 1, bars: 8, voices: 2, near: "deathmetal",
      // LINEAGE: the chromatic riff wall and the ♭5-is-home locrian colour
      // are death metal's own, cited whole; kraftwerk supplies the machine-
      // sequenced, unwavering kick underneath in place of a drummer; punk
      // supplies the raw, unsubtle directness. EBM's own club-industrial
      // half is the missing rung — this anchor is the metal side of that
      // same argument.
      parents: { deathmetal: 0.4, kraftwerk: 0.35, punk: 0.25 },
      wants: ["EBM"],
      instr: ["distortion_guitar", "metal_pad"],
      drumkit: "electronic",
      entry: () => 0, reg: v => -v, realize: () => "line",
      harmony: "cycle", mode: MODES.phrygian, scale: [0, 1, 3, 5, 6, 8, 10],
      roots: [0, 0, 1, 1, 0, 0, 4, 4],
      artic: "staccato", bassStyle: "sixteenths",
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      fill: { s: [0,0,0,0, 1,0,0,1, 0,0,1,0, 1,1,1,1],
              x: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,9] },
      tone: { wave: "square", cut: 1400, q: 2.8, atk: .002, rel: .3, gain: .3, verb: .14 },
      words: ["the riff, chromatic, on the machine's grid",
              "the bass synth, doubling an octave under"],
      word: v => (v === 0 ? [only("gate", fill(1))] : [transpose(-7)]),
      fx: ["crunch"],
    },

    // EBM [techno]. Electronic Body Music: techno's kick-driven floor and
    // kraftwerk's machine pulse, made aggressive by a punk-direct vocal
    // chant — the two lines TRADE PLACES bar to bar (the sequence solid,
    // the chant on the offbeats, then a straight run answered by the
    // sequence stabbing back), the club's version of a call and response.
    ebm: {
      label: "Chicago 1989", rate: 1, bars: 4, voices: 2, near: "techno",
      // LINEAGE: the sequenced, pulsing bass and the four-on-the-floor club
      // discipline are techno's; kraftwerk supplies the machine chassis
      // underneath; punk supplies the shouted, direct chant vocal. New
      // beat, the slowed-down Belgian club scene this style traded records
      // with directly, is the missing rung.
      parents: { kraftwerk: 0.4, techno: 0.35, punk: 0.25 },
      wants: ["new beat"],
      // THE CHANT IS SHOUTED, AND A SHOUT IS MOSTLY CONSONANTS — and until
      // 2026-08-18 it was not even a voice: the Model D below is declared without
      // `lineOnly`, so the signature synth took BOTH chairs and the "vocal chant"
      // was a second copy of the sequence pulsing beside the first. (Before that
      // it was the VP-330, a string ensemble holding an "aah", which is the miscast
      // this GM id has always invited.) `synth_voice` on voice 1's LINE chair now
      // reaches the vocal tract, because to-engine.js recipeFor asks the mouth
      // BEFORE the signature synth. The anchor's own word operator is the rest of
      // the argument: `breath` is an AND against the phrase's own gate, which this
      // file already glosses as "a chant that answers what it is actually given",
      // and a mouth that shuts is what makes that audible.
      instr: ["square_lead", "synth_voice"],
      // the sequenced pulse is a resonant analog bass squeezed hard, which a
      // GM square-lead sample cannot squelch any more than acid's 303 can be
      // played on a guitar
      synth: { dsp: "modeld", root: "modeld", level: 0.82,
               set: { cutoff: 900, res: 0.55, envAmount: 0.8, envAttack: 0.002,
                      envDecay: 0.1, envSustain: 0.3, oscMix: 0.1, drive: 0.4,
                      glide: 0, drift: 1 } },
      drumkit: "tr909",
      entry: v => v, reg: v => -v, realize: () => "line",
      harmony: "modal", mode: MODES.phrygian, scale: MODES.phrygian,
      artic: "staccato", maxHold: 2, bassStyle: "sixteenths",
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      kitVel: { h: [8,4,8,4, 8,4,8,4, 8,4,8,4, 8,4,8,6] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0] },
      tone: { wave: "square", cut: 2000, q: 3.0, atk: .002, rel: .3, gain: .29, verb: .12 },
      words: ["the sequence, pulsing every sixteenth",
              "the vocal chant, the phrase's own rhythm ANDed with the offbeat"],
      // BREATH, NOT SKANK — the field that separates the chant from the
      // sequence: `fill(1)` is a total override (a machine that never
      // listens to what it is handed), `breath` is an AND against the
      // phrase's own gate (a chant that answers what it is actually given,
      // the way reggae's skank does NOT and a shouted vocal DOES).
      word: v => (v === 0 ? [only("gate", fill(1))] : [breath([0, 0, 1, 0])]),
    },

    // SYNTH DUO [synthpop]. Two people and a rack of machines, but LEGATO
    // where synthpop's stabs are staccato — a melodic, sustained hook over a
    // disco floor rather than a clipped anthem chord, which is the field
    // that turns a synth-pop record into a dance-floor one.
    synthduo: {
      label: "London 1985", rate: 1, bars: 4, voices: 2, near: "synthpop",
      // LINEAGE: the all-synth chassis and the anthem changes are synthpop's
      // own; disco supplies the four-on-the-floor club discipline and the
      // open hat where synthpop has none at all; kraftwerk supplies the
      // deadpan, detached vocal delivery underneath the melody.
      parents: { synthpop: 0.4, disco: 0.3, kraftwerk: 0.3 },
      wants: [],
      // LEGATO means a sustained SAW, not a choir: the hook is one held
      // monosynth line (the juno60 below rides it) over the string machine's
      // wash. The choir patch this used to lead on belongs to the records
      // that really are vocoders — kraftwerk, electro, robotic pop — and a
      // sustained melodic hook is the opposite of a voice holding a vowel.
      instr: ["saw_wave", "synth_strings_1"],
      drumkit: "tr909",
      // A JUNO, not a preset labelled "synth voice" — the melodic hook only
      // (lineOnly: the sweeping pad stays on the string machine — GM 51, which
      // to-engine.js plays on the parent's `solina`, so the wash under the
      // hook is an ARP ensemble and not a section). Vince Clarke's whole
      // discography is this one machine legato over a dance floor.
      synth: { dsp: "juno60", root: "juno60", level: 0.75, lineOnly: true,
               set: { sawLevel: 0.8, pulseLevel: 0.3, subLevel: 0.15,
                      cutoff: 2200, res: 0.18, envAmount: 0.3, attack: 0.01,
                      decay: 0.3, sustain: 0.7, release: 0.4, chorus: 1,
                      spread: 0.6 } },
      entry: v => v, reg: v => v - 1, realize: v => (v === 1 ? "pad" : "line"),
      harmony: "cycle", roots: [0, 5, 3, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      prog: [{ d: 0, q: "7" }, { d: 5, q: "7" }, { d: 3, q: "7" }, { d: 4, q: "7" }],
      artic: "legato", maxHold: 3, bassStyle: "eighths",
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             o: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      fill: { o: [0,0,1,0, 0,0,1,0, 1,0,1,0, 1,0,1,1] },
      tone: { wave: "triangle", cut: 2600, q: 1.6, atk: .01, rel: 1.0, gain: .27, verb: .32 },
      words: ["the voice, deadpan over the changes", "the strings, sweeping in a wash above"],
      word: v => (v === 1 ? [drop(2)] : []),
    },

    // ---- TWENTY-THREE MORE ROOMS (2026-08-17) ------------------------------
    // Paul named artists; every anchor below is the STYLE the artist stands
    // for, never the artist and never a transcription (SOURCES.md's
    // provenance law holds exactly as it did for the ancestors). Six of the
    // twenty-three are built OF a synthesizer and are given one — a real Faust
    // voice with a resonant filter, not a sampled stand-in wearing the name —
    // and the rest go the other way, close-mic'd sampled instruments played
    // clean. Both are the same discipline: the instrument IS the genre.

    // MUSIC HALL ROCK [The Kinks]. A rock band playing vaudeville changes —
    // I-vi-IV-V, the oldest hook in the songbook — on a bright upright piano
    // with the guitar doubling the turn. Skiffle's amateur string-band energy
    // is where the Kinks actually came from; doo-wop supplies the close vocal-
    // group harmony a music-hall chorus leans on. The Edwardian stage
    // tradition itself — the songs Ray Davies was actually parodying — has no
    // anchor here yet.
    musichallrock: {
      label: "Muswell Hill 1966", rate: 1, bars: 4, voices: 2,
      parents: { rock: 0.45, skiffle: 0.3, doowop: 0.25 },
      wants: ["music hall"],
      instr: ["upright_piano", "clean_guitar"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: () => "line",
      harmony: "cycle", roots: [0, 5, 3, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      // BASS STYLE: eighths, not a walk — the oom-pah two-beat a music-hall
      // piano actually plays, and it happens to be the field that keeps this
      // anchor clear of janglepop's own walking bass (both are I-vi-IV-V
      // major-key guitar-pop; the census gate measures a genre by everything
      // it renders, and a shared bass hand was most of what was left un-said).
      artic: "staccato", maxHold: 2, bassStyle: "eighths",
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,1,0] },
      tone: { wave: "triangle", cut: 2200, q: 1.0, atk: .006, rel: .5, gain: .27, verb: .22 },
      words: ["the piano, the vaudeville turn", "the guitar, doubling the hook an octave under"],
      word: v => (v === 1 ? [rotate(2), drop(2), transpose(-12)] : []),
    },

    // ORCHESTRAL PSYCH [Flaming Lips]. A pop song dressed in a string
    // section and a halo pad instead of a second guitar — the Beatles' own
    // psychedelic turn (strings on a rock rhythm section), carried through
    // post-rock's build-the-arrangement patience and neoclassical's real
    // orchestral voicing. Brian Wilson's chamber-pop arranging, the actual
    // missing rung between the three, has no anchor of its own yet.
    orchpsych: {
      label: "Oklahoma City 1999", rate: 1, bars: 4, voices: 3,
      parents: { beatles: 0.4, postrock: 0.35, neoclassical: 0.25 },
      wants: ["chamber pop"],
      instr: ["slow_strings", "clean_guitar", "halo_pad"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", roots: [0, 3, 4, 5], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      artic: "legato", maxHold: 4, bassStyle: "eighths",
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,0,1, 1,0,1,0],
              x: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,8] },
      tone: { wave: "sawtooth", cut: 1900, q: 1.1, atk: .02, rel: 1.6, gain: .24, verb: .55 },
      words: ["the strings, holding the changes", "the guitar, the hook",
              "the halo pad, shimmering an octave over"],
      word: v => (v === 2 ? [rotate(3), drop(2), transpose(12)] : []),
      fx: ["echo", "sweep"],
    },

    // ALT-COUNTRY [Wilco]. Country-pop's bright twang and rock's distorted
    // band format, argued out by blues' loose, unhurried backbeat — a
    // songwriter's record that happens to be played by a rock band rather
    // than a Nashville session. Gram Parsons' "cosmic American" fusion, the
    // scene this style actually grew out of, is the missing rung.
    altcountry: {
      label: "Chicago 1996", rate: 1, bars: 8, voices: 2, near: "countrypop",
      parents: { countrypop: 0.4, rock: 0.35, blues: 0.25 },
      wants: ["cosmic american music"],
      instr: ["clean_guitar", "fiddle"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: () => "line",
      harmony: "cycle", roots: [0,0, 3,3, 4,4, 0,0], mode: MODES.mixo,
      scale: MODES.mixo, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "walk",
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,1, 1,0,1,0, 1,0,1,1] },
      fill: { s: [0,0,0,0, 1,0,0,1, 0,0,1,0, 1,0,1,0] },
      tone: { wave: "sawtooth", cut: 1800, q: 1.4, atk: .01, rel: .8, gain: .26, verb: .3 },
      words: ["the guitar, the song", "the fiddle, the twang, an octave over"],
      word: v => (v === 1 ? [rotate(2), drop(2), transpose(12)] : []),
    },

    // YACHT SOUL [Boz Scaggs]. Isley's Rhodes-and-groove chassis, funk's
    // sixteenth-note hand under it in place of a slow shuffle, and Motown's
    // session polish over both — "Lowdown"'s whole argument in three
    // borrowed halves. Quiet storm, the smoother FM-radio format this style
    // fed directly, is the missing rung.
    yachtsoul: {
      label: "San Francisco 1976", rate: 1, bars: 8, voices: 2, near: "isley",
      parents: { isley: 0.4, funk: 0.3, motown: 0.3 },
      wants: ["quiet storm"],
      instr: ["rhodes_ep", "clean_guitar"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", roots: [0,0, 3,3, 0,0, 4,4], mode: MODES.dorian,
      scale: MODES.dorian, diatonic: true,
      prog: PROGS.soul7,
      artic: "legato", maxHold: 3, bassStyle: "sixteenths",
      pipes: [{ id: "strum", spread: 0.05 }],
      kit: { k: [1,0,0,1, 0,0,1,0, 1,0,0,0, 0,1,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      fill: { s: [0,0,0,0, 1,0,0,1, 0,0,1,0, 1,0,1,1] },
      tone: { wave: "triangle", cut: 2200, q: 1.0, atk: .008, rel: .7, gain: .26, verb: .3 },
      words: ["the Rhodes, comping the changes", "the guitar, the hook, up top"],
      word: v => (v === 1 ? [transpose(7)] : []),
    },

    // YACHT ROCK [Christopher Cross]. Toto and Steely's session-band
    // craftsmanship folded into a plainer, more Motown-major-key song than
    // either — the smooth-radio middle where studio chops meet a soul
    // changes-sense. The Doobie Brothers/Michael McDonald crossover this
    // sound is actually named for has no anchor of its own yet.
    yachtrock: {
      label: "Austin 1979", rate: 1, bars: 4, voices: 2, near: "toto",
      parents: { toto: 0.4, steely: 0.3, motown: 0.3 },
      wants: ["blue-eyed AOR"],
      instr: ["electric_piano", "clean_guitar"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", roots: [0, 5, 3, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "eighths",
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,0,1, 1,0,1,0] },
      tone: { wave: "triangle", cut: 2000, q: 1.0, atk: .01, rel: .9, gain: .25, verb: .3 },
      words: ["the EP, comping", "the guitar, the hook, an octave up"],
      word: v => (v === 1 ? [transpose(12), drop(3)] : []),
    },

    // SONGWRITER PIANO [Carole King]. Motown's Brill Building changes, sung
    // from the piano bench instead of cut for a girl group — gospel's
    // church-chord piano hand underneath, crooner's plain, close vocal
    // delivery on top. The Brill Building factory itself, the actual room
    // this record was written in before it was one artist's own, is the
    // missing rung.
    songwriterpiano: {
      label: "New York 1971", rate: 1, bars: 8, voices: 2, near: "crooner",
      parents: { motown: 0.4, gospel: 0.3, crooner: 0.3 },
      wants: ["brill building pop"],
      instr: ["upright_piano", "ohh_voices"],
      drumkit: "brush",
      entry: () => 0, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", roots: [0,5,3,4, 0,5,3,4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      artic: "legato", maxHold: 4, bassStyle: "walk",
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 0,0,1,0, 1,0,1,0] },
      tone: { wave: "triangle", cut: 2000, q: .9, atk: .02, rel: 1.0, gain: .24, verb: .3,
              // WHO SINGS: the voice at the back of the room, out of the piano's way
              mouth: MOUTHS.backingroom },
      words: ["the piano, the changes, sung from the bench",
              "the voice, wordless, a third above"],
      word: v => (v === 1 ? [transpose(4)] : []),
    },

    // SOFT FOLK [James Taylor]. A folk duo's two-voice discipline thinned to
    // one guitar and one singer, in the major pentatonic a folk melody
    // actually sings in — countrypop's warm, bright optimism colours the
    // top, plainer than folkduo's parallel-third harmony because there is
    // no second voice to harmonize WITH. Carolina fingerstyle guitar, the
    // actual technique this whole sound is built on, is the missing rung.
    softfolk: {
      label: "Chapel Hill 1970", rate: 1, bars: 8, voices: 2, near: "folkduo",
      parents: { folkduo: 0.45, countrypop: 0.3, crooner: 0.25 },
      wants: ["carolina fingerstyle"],
      instr: ["steel_string_guitar", "steel_string_guitar"],
      drumkit: "brush",
      entry: () => 0, reg: v => 1 - v, realize: () => "line",
      harmony: "modal", scale: SCALES.majpent, artic: "legato",
      intro: "solo",
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 0,0,1,0, 1,0,1,0] },
      tone: { wave: "triangle", cut: 2000, q: .8, atk: .01, rel: 1.0, gain: .22, verb: .32 },
      words: ["the guitar, fingerpicked, the tune", "the second guitar, a third under"],
      word: v => (v === 1 ? [transpose(-4)] : []),
    },

    // SINGER-SONGWRITER [Carly Simon]. A crooner's plain, direct vocal
    // delivery over funk's sixteenth-note groove hand and gospel's church
    // chords — a session band cut for one singer's record rather than a
    // genre unto itself, which is the whole "New York piano-rock" sound.
    // Laurel Canyon's communal songwriting scene, the actual milieu, is the
    // missing rung.
    singersongwriter: {
      label: "New York 1972", rate: 1, bars: 4, voices: 2, near: "yachtsoul",
      parents: { crooner: 0.35, funk: 0.35, gospel: 0.3 },
      wants: ["laurel canyon scene"],
      // A REAL GRAND, not an EP: a 1972 New York singer's record is cut
      // around a nine-foot piano in a studio, which is also what separates it
      // from yacht rock's Rhodes two rows up — those two had the same cast
      // and the same seating, so nothing but the drums told them apart.
      instr: ["yamaha_grand_piano", "clean_guitar"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", roots: [0, 5, 3, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "sixteenths",
      kit: { k: [1,0,0,1, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,1,0,1, 1,1,0,1, 1,1,0,1, 1,1,0,1] },
      fill: { s: [0,0,0,0, 1,0,0,1, 0,0,1,0, 1,0,1,1] },
      tone: { wave: "triangle", cut: 2100, q: 1.1, atk: .008, rel: .75, gain: .26, verb: .28 },
      words: ["the EP, the vamp", "the guitar, the answer, up top"],
      word: v => (v === 1 ? [transpose(7), drop(2)] : []),
    },

    // COAST ROCK [Fleetwood Mac]. A rock band's format carrying Motown's
    // major-key pop hooks and countrypop's fingerpicked, twangy top —
    // "Dreams"' whole trick, a studio band that never sounds like it is
    // trying. The Buckingham/Nicks California folk-rock crossover this genre
    // is actually named for has no anchor of its own.
    coastrock: {
      // "Sausalito 1977" — Record Plant Sausalito, where Rumours was
      // actually tracked; "Los Angeles 1977" was already steely's own label.
      label: "Sausalito 1977", rate: 1, bars: 4, voices: 2, near: "rock",
      parents: { rock: 0.35, motown: 0.3, countrypop: 0.35 },
      wants: ["california folk rock"],
      instr: ["clean_guitar", "electric_piano"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: v => (v === 1 ? "pad" : "line"),
      harmony: "cycle", roots: [0, 5, 3, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "eighths",
      pipes: [{ id: "strum", spread: 0.04 }],
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             o: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,1,0] },
      tone: { wave: "sawtooth", cut: 2000, q: 1.2, atk: .01, rel: .8, gain: .27, verb: .26 },
      words: ["the guitar, fingerpicked, the hook", "the piano, holding the changes"],
      word: v => (v === 0 ? [] : [drop(2)]),
    },

    // SPACE ROCK [Pink Floyd]. An arc, not a song — one held drone under a
    // slow, blues-schooled guitar line, argued through jazz's loose,
    // unhurried sense of time rather than a fixed form. `fx:["echo","sweep"]`
    // is the identity itself: a long automated filter opening across the
    // section is the "tape-speed drift" this style is built from, and the
    // echo send is the air around it. Berlin-school electronic minimalism,
    // the other half of this sound, is the missing rung.
    spacerock: {
      label: "London 1973", rate: .5, bars: 8, voices: 2, near: "drone",
      parents: { blues: 0.35, drone: 0.35, jazz: 0.3 },
      wants: ["berlin school electronics"],
      instr: ["warm_pad", "clean_guitar"],
      drumkit: "room",
      entry: v => v * 2, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", roots: [0,0, 5,5, 3,3, 4,4],
      artic: "legato", incClamp: 4, incMode: "reverse", bassStyle: "pedal",
      kit: { k: [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             h: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0] },
      fill: { s: [0,0,0,0, 0,0,0,0, 1,0,0,0, 1,0,1,0],
              x: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,8] },
      tone: { wave: "sawtooth", cut: 1200, q: 1.4, atk: .1, rel: 2.5, gain: .2, verb: .75 },
      words: ["the pad, holding the chord for bars at a time",
              "the guitar, a slow line that surfaces and recedes"],
      word: v => (v === 1 ? [drop(3)] : []),
      fx: ["echo", "sweep"],
    },

    // GREBO [Ned's Atomic Dustbin]. THE JOKE IS LITERAL: two bass voices,
    // not one doubled — `voices:3` puts a fuzzed guitar riff over TWO
    // independent basslines a fifth apart in register, one pulsing the root
    // and the other answering with its own contour, which is the entire
    // Stourbridge-scene gimmick made into an arrangement rather than a
    // caption. Punk's directness and rock's band format argue the rest;
    // funk supplies the syncopated pocket two basses need to not collide.
    grebo: {
      label: "Stourbridge 1990", rate: 1, bars: 4, voices: 3, near: "punk",
      parents: { punk: 0.4, rock: 0.35, funk: 0.25 },
      wants: ["stourbridge scene"],
      // TWO BASSISTS, TWO BASSES. The joke is that there are two of them, and
      // it only lands if they are different players: one PICKED, pulsing the
      // root, one FINGERED, answering with its own contour. Both voices were
      // an upright double bass, which is a jazz instrument standing where a
      // Stourbridge band's two Rickenbackers go.
      instr: ["distortion_guitar", "picked_bass", "finger_bass"],
      drumkit: "power",
      entry: v => (v === 0 ? 0 : v), reg: v => (v === 0 ? 0 : v === 1 ? -1 : -2),
      realize: () => "line",
      harmony: "cycle", roots: [0, 3, 0, 4],
      artic: "staccato", maxHold: 2,
      kit: { k: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      fill: { s: [0,0,0,0, 1,0,0,1, 1,0,1,0, 1,1,1,1],
              x: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,9] },
      tone: { wave: "sawtooth", cut: 1600, q: 2.0, atk: .003, rel: .4, gain: .3, verb: .16 },
      words: ["the guitar, the riff", "the first bass, pulsing the root",
              "the second bass, its own line, a fifth under and answering"],
      word: v => (v === 1 ? [only("gate", rotate(2))]
                : v === 2 ? [invert(0), rotate(5)] : []),
      fx: ["crunch"],
    },

    // MELODIC TECHNO [Orbital]. THE FILTER IS THE MELODY: one analog pad
    // synth (`pad_saw`, a real Faust ladder) covers both the chord voice and
    // the lead voice, and `fx:["sweep"]` automates its cutoff across the
    // section — a static tone.cut cannot say "the line rises," a moving
    // filter can. House and techno's floor argue the rhythm; ambient
    // supplies the melodicism neither of those alone would grant. Named for
    // the Hartnoll brothers' M25-orbital motorway, not a record.
    melodictechno: {
      label: "Kent 1991", rate: 1, bars: 8, voices: 2, near: "techno",
      parents: { house: 0.35, techno: 0.35, ambient: 0.3 },
      wants: ["berlin school electronics"],
      instr: ["warm_pad", "polysynth"],
      drumkit: "electronic",
      entry: v => v, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", roots: [0,5,3,4, 0,5,3,4], mode: MODES.dorian,
      scale: MODES.dorian, diatonic: true,
      artic: "legato", maxHold: 4, bassStyle: "eighths",
      synth: { dsp: "pad_saw", root: "pad_saw", level: 0.75,
               set: { cutoff: 900, res: 0.32, detune: 0.15, attack: 0.06 } },
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,1, 1,0,0,0],
             o: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { o: [0,0,1,0, 0,0,1,0, 1,0,1,0, 1,0,1,1] },
      tone: { wave: "sawtooth", cut: 900, q: 1.6, atk: .06, rel: 1.4, gain: .22, verb: .4 },
      words: ["the pad, the chord, opening across the section",
              "the line, riding above it"],
      word: v => (v === 1 ? [drop(2)] : []),
      fx: ["sweep"],
    },

    // BLEEP TECHNO [808 State]. NO SAMPLED INSTRUMENT ANYWHERE: one `tb303`
    // instance covers both voices — the bleep line up high, the sub bass an
    // octave-and-a-half under it, the SAME machine at two registers, which is
    // the actual bleep-techno trick (one box, two jobs). Techno's floor and
    // house's swing argue the rhythm; electro supplies the bare, mechanical
    // pulse. Sheffield's Warp/bleep scene, the genre's own real birthplace,
    // is the missing rung — Manchester's 808 State crossed over into it.
    bleeptechno: {
      label: "Manchester 1989", rate: 1, bars: 4, voices: 2, near: "acid",
      parents: { techno: 0.4, house: 0.3, electro: 0.3 },
      wants: ["sheffield bleep scene"],
      instr: ["square_lead", "saw_wave"],
      drumkit: "tr808",
      entry: v => v, reg: v => (v === 1 ? -3 : 1), realize: () => "line",
      harmony: "modal",
      artic: "staccato", maxHold: 1,
      synth: { dsp: "tb303", root: "tb303", level: 0.8,
               set: { cutoff: 1800, resonance: 0.35, envmod: 0.55, decay: 0.25, waveform: 1 } },
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             h: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0] },
      fill: { h: [0,0,1,0, 0,0,1,0, 0,0,1,1, 1,0,1,1] },
      tone: { wave: "square", cut: 1800, q: 3.0, atk: .002, rel: .2, gain: .28, verb: .1 },
      words: ["the bleep, up high", "the sub, an octave and a half under"],
      // the sub answers a step behind rather than under the SAME step — one
      // machine playing two parts must still be two parts, not one part
      // copied (the quote-box law §51 holds every genre to).
      word: v => (v === 1 ? [rotate(3)] : []),
    },

    // INDUSTRIAL BREAKS [Meat Beat Manifesto]. Drum & bass's broken kit and
    // techno's mechanical floor, run through a distorted `lead_fuzz` line
    // instead of a clean synth — noise and grit ARE the timbre, not an fx
    // chain bolted on after. Punk supplies the raw directness underneath.
    // The sample-collage industrial tradition this style actually descends
    // from has no anchor here yet.
    industrialbreaks: {
      label: "Swindon 1989", rate: 1, bars: 4, voices: 2, near: "bigbeat",
      parents: { dnb: 0.35, techno: 0.35, punk: 0.3 },
      wants: ["sample-collage industrial"],
      instr: ["distortion_guitar", "metal_pad"],
      drumkit: "power",
      entry: () => 0, reg: v => -v, realize: () => "line",
      harmony: "modal", mode: MODES.phrygian, scale: MODES.phrygian,
      artic: "staccato", bassStyle: "sixteenths",
      synth: { dsp: "lead_fuzz", root: "lead_fuzz", level: 0.85,
               set: { cutoff: 1100, res: 0.4, drive: 0.7, attack: 0.002, sustain: 0.3, release: 0.15 } },
      kit: { k: [1,0,0,1, 0,0,0,0, 0,1,0,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,1, 0,0,1,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [1,0,1,0, 1,0,1,0, 1,1,0,1, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 1100, q: 3.5, atk: .002, rel: .3, gain: .3, verb: .18 },
      words: ["the fuzz riff, the machine's own grid", "the pad, underneath, doubling low"],
      // rotated, not just transposed low — two identical machines are one
      // machine, and the quote-box law (§51) holds every genre to distinct
      // playing lanes once the band is stripped off.
      word: v => (v === 0 ? [] : [rotate(2), transpose(-7)]),
      fx: ["crunch", "sweep"],
    },

    // INDUSTRIAL ROCK [Nine Inch Nails]. Death metal's chromatic riff wall
    // sung as a real verse-chorus song instead of a headlong blast, played
    // to kraftwerk's quantized machine kick rather than a drummer's swing —
    // the same `lead_fuzz` voice as industrial breaks, distortion and a real
    // filter sweep as the identity itself, tuned longer and more sustained
    // for a wall of a riff instead of a clipped break-line stab. Ministry's
    // Wax Trax! industrial-rock scene, the actual missing rung, is not yet
    // an anchor.
    industrialrock: {
      label: "Cleveland 1989", rate: 1, bars: 4, voices: 2, near: "industrialmetal",
      parents: { deathmetal: 0.4, kraftwerk: 0.3, punk: 0.3 },
      wants: ["wax trax industrial"],
      instr: ["distortion_guitar", "metal_pad"],
      drumkit: "electronic",
      entry: () => 0, reg: v => -v, realize: () => "line",
      harmony: "cycle", roots: [0, 3, 0, 4],
      artic: "staccato", bassStyle: "sixteenths",
      synth: { dsp: "lead_fuzz", root: "lead_fuzz", level: 0.85,
               set: { cutoff: 1400, res: 0.3, drive: 0.85, attack: 0.004, sustain: 0.65, release: 0.4 } },
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      fill: { s: [0,0,0,0, 1,0,0,1, 1,0,1,0, 1,1,1,1],
              x: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,9] },
      tone: { wave: "sawtooth", cut: 1400, q: 2.4, atk: .004, rel: .8, gain: .3, verb: .3 },
      words: ["the riff wall, chromatic, on the machine's grid",
              "the bass line, doubling an octave under"],
      word: v => (v === 0 ? [only("gate", fill(1))] : [rotate(3), transpose(-7)]),
      fx: ["crunch", "sweep"],
    },

    // ANALOG SYNTH POP [Depeche Mode, Speak & Spell era]. THE FILTER IS
    // OPEN: a `tb303` set bright and low-resonance (waveform square, envmod
    // shallow) is the exact opposite performance from acid's squelch — thin,
    // sequenced, unmistakably one monosynth rather than a band. Synthpop's
    // anthem changes and kraftwerk's machine chassis argue the rest; disco's
    // four-on-the-floor gives it a dance floor to live on. New romantic
    // synth-pop, the wider scene this record broke out of, is missing.
    analogsynthpop: {
      // "Basildon 1980" — the year the band itself formed (as Composition of
      // Sound); "Basildon 1981" was already synthpop's own label, and
      // gothsynth below takes "Basildon 1990" for the same band nine years on.
      label: "Basildon 1980", rate: 1, bars: 4, voices: 2, near: "eurythmics",
      parents: { synthpop: 0.5, kraftwerk: 0.3, disco: 0.2 },
      wants: ["new romantic synth pop"],
      // "unmistakably one monosynth rather than a band" — so a thin square
      // sequence out front and a poly behind it, and not a choir patch. The
      // tb303 below plays both voices; these are the names the desk shows and
      // the sounds a recast chair gets, and they should agree with the record.
      instr: ["square_lead", "polysynth"],
      drumkit: "cr78",
      entry: v => v, reg: v => v - 1, realize: () => "line",
      harmony: "cycle", roots: [0, 5, 3, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "octaves",
      synth: { dsp: "tb303", root: "tb303", level: 0.85,
               set: { cutoff: 3400, resonance: 0.22, envmod: 0.28, decay: 0.5, waveform: 1 } },
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0] },
      tone: { wave: "square", cut: 3000, q: 1.6, atk: .003, rel: .3, gain: .27, verb: .18 },
      words: ["the sequence, thin and bright, the hook",
              "the strings, a wash answering underneath"],
      word: v => (v === 1 ? [drop(2)] : []),
    },

    // GOTH SYNTH [Depeche Mode, Violator era]. The same Basildon band nine
    // years on, and the filter tells the whole story: `modeld` set dark and
    // resonant (cutoff low, res pushed) is analog synth BASS with a real
    // ladder, not a preset pad, under a sampled guitar's crunch bite — the
    // huge plate is the tone.verb number, not an effect list. Gothic rock's
    // guitar-forward gloom is the missing rung this record actually leans on.
    gothsynth: {
      label: "Basildon 1990",
      rate: 1, bars: 4, voices: 2, near: "analogsynthpop",
      parents: { analogsynthpop: 0.45, rock: 0.3, kraftwerk: 0.25 },
      wants: ["gothic rock"],
      instr: ["crunch_guitar", "metal_pad"],
      drumkit: "electronic",
      entry: v => v, reg: v => (v === 0 ? 1 : -2), realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", roots: [0, 5, 3, 4],
      artic: "staccato", maxHold: 2,
      // THE LADDER IS THE IDENTITY; THE DRIVE WAS NOT. "The organs have gain
      // applied in Basildon 1990 and are very loud" (Paul, 2026-08-17) — and
      // he is describing this line, the held resonant modeld chord that reads
      // as a synth organ. Measured against the shipped table this was the
      // loudest and the most driven modeld in the catalogue at once: level
      // 0.85 where kraftwerk/motorik/roboticpop sit at 0.78-0.80, and drive
      // 0.4 where they sit at 0.15-0.25. And drive is not a colour knob —
      // modeld.dsp is `stack * (1 + drive*5) : tanh : *(1/(1 + drive*1.2))`,
      // so 0.4 pushed 3x into the saturator and came back a SQUARED-OFF wave,
      // which is both louder and harsher than the oscillators that went in;
      // and this voice plays two octaves down (reg -2) under a resonant corner
      // at 380 Hz, so all of that lands exactly where the bass and the kick
      // live. Level 0.62 with drive 0.2 is 2.6 dB down on the same line by
      // arithmetic and rather more by ear, because half the drive is also half
      // the squaring. What makes this genre ITSELF is the filter — cutoff 380
      // with res 0.55, "dark and resonant", the head comment's own words — and
      // every one of those numbers is untouched. Only the gain came down.
      synth: { dsp: "modeld", root: "modeld", level: 0.62, lineOnly: true,
               set: { cutoff: 380, res: 0.55, envAmount: 1.4, envAttack: 0.004,
                      envDecay: 0.4, envSustain: 0.35, oscMix: 0.3, drive: 0.2,
                      glide: 0.02, drift: 5 } },
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,1,1] },
      tone: { wave: "sawtooth", cut: 1200, q: 2.4, atk: .006, rel: .5, gain: .28, verb: .62 },
      words: ["the guitar, the bite, a chord at a time",
              "the bass synth, the real resonant low end"],
      word: v => (v === 0 ? [] : [drop(2)]),
    },

    // GOTHIC POP [The Cure]. Shoegaze's wall of reverbed guitar thinned
    // back to a real pop-song hook, dorian for the bright-inside-minor
    // colour the Cure lean on, synthpop's synth-string wash filling the
    // gaps a second guitar would take. Gothic rock, the scene this band is
    // usually filed under, is the missing rung — this anchor is its pop
    // half, the way gothsynth above is its synth half.
    gothicpop: {
      label: "Crawley 1987", rate: 1, bars: 4, voices: 2, near: "shoegaze",
      parents: { rock: 0.4, shoegaze: 0.3, synthpop: 0.3 },
      wants: ["gothic rock"],
      instr: ["clean_guitar", "synth_strings_1"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: v => (v === 1 ? "pad" : "line"),
      harmony: "cycle", roots: [0, 5, 3, 4], mode: MODES.dorian,
      scale: MODES.dorian, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "eighths",
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             o: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,0,1, 1,0,1,0] },
      tone: { wave: "sawtooth", cut: 1800, q: 1.6, atk: .015, rel: 1.0, gain: .25, verb: .4 },
      words: ["the guitar, chorused, the hook", "the strings, a wash underneath"],
      word: v => (v === 0 ? [] : [drop(2)]),
      fx: ["chorus"],
    },

    // POST-PUNK [Joy Division]. Punk's raw directness under kraftwerk's
    // machine-pulse discipline — kick and snare landing TOGETHER, the
    // motorik trick, but sung as a real song instead of held as one process
    // — with a synth line running its own countermelody a tenth below the
    // guitar rather than doubling it. Martin Hannett's spacious, dub-echoed
    // production, the actual missing rung, is `fx:["echo"]` made explicit
    // and still lacks its own anchor.
    postpunk: {
      label: "Manchester 1979", rate: 1, bars: 4, voices: 2, near: "kraftwerk",
      parents: { punk: 0.4, kraftwerk: 0.3, rock: 0.3 },
      wants: ["cold wave"],
      instr: ["clean_guitar", "synth_strings_1"],
      drumkit: "room",
      entry: v => v, reg: v => v - 2, realize: () => "line",
      harmony: "cycle", roots: [0, 3, 0, 4], mode: MODES.dorian,
      scale: MODES.dorian, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "eighths",
      kit: { k: [1,0,0,0, 1,0,0,0, 0,0,1,0, 1,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,1,1] },
      tone: { wave: "sawtooth", cut: 1600, q: 1.8, atk: .005, rel: .4, gain: .28, verb: .42 },
      words: ["the guitar, the line", "the synth, a tenth under, its own countermelody"],
      word: v => (v === 1 ? [rotate(5), transpose(-9)] : []),
      fx: ["echo"],
    },

    // DANCE POST-PUNK [New Order]. Post-punk's own machine chassis, sent
    // to disco's four-on-the-floor and open hat instead of a rock backbeat
    // — the exact turn "Blue Monday" makes, a band that used to be a band
    // becoming a sequencer act. Everything the record needs is already a
    // parent; nothing here is missing.
    dancepostpunk: {
      label: "Manchester 1983", rate: 1, bars: 4, voices: 2, near: "postpunk",
      parents: { postpunk: 0.4, disco: 0.3, kraftwerk: 0.3 },
      wants: [],
      instr: ["synth_voice", "polysynth"],
      drumkit: "electronic",
      entry: v => v, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      harmony: "cycle", roots: [0, 5, 3, 4],
      artic: "staccato", maxHold: 2, bassStyle: "octaves",
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             o: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      fill: { o: [0,0,1,0, 0,0,1,0, 1,0,1,0, 1,0,1,1] },
      tone: { wave: "square", cut: 2400, q: 2.0, atk: .003, rel: .35, gain: .28, verb: .24 },
      words: ["the sequence, the sequence, unchanged",
              "the lead, riding above it"],
      word: v => (v === 1 ? [drop(2)] : []),
      fx: ["echo"],
    },

    // MADCHESTER [Happy Mondays]. House's dance-floor discipline and
    // funk's loose sixteenth-note hand under a rock band, in mixolydian
    // for the bright, baggy sway — THE LOOSE LIVE BREAK is the explicit
    // `swing`, a real hand on the kit rather than a sequencer's certainty,
    // which is what separates this from house or techno's own machine
    // rows. The Hacienda's own DJ culture, the actual room this scene
    // happened in, is the missing rung.
    madchester: {
      label: "Manchester 1990", rate: 1, bars: 4, voices: 2, swing: 0.12, near: "house",
      parents: { house: 0.35, funk: 0.35, rock: 0.3 },
      wants: ["hacienda scene"],
      // the baggy organ is a Hammond with the percussion stop up, and
      // `drawbarorgan` is one zone rooted at MIDI 96 — a pad written at 45
      // was that sample dragged two and a half octaves down, which is the
      // breathy whistle Paul heard on every organ in the table.
      instr: ["clean_guitar", "percussive_organ"],
      drumkit: "power",
      entry: v => v, reg: v => v - 1, realize: v => (v === 1 ? "pad" : "line"),
      harmony: "cycle", roots: [0, 3, 4, 0], mode: MODES.mixo,
      scale: MODES.mixo, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "sixteenths",
      kit: { k: [1,0,0,1, 0,0,1,0, 1,0,0,0, 0,1,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,1,0, 1,0,0,0],
             h: [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,1, 1,0,1,0, 1,1,1,0] },
      tone: { wave: "triangle", cut: 2000, q: 1.2, atk: .01, rel: .75, gain: .27, verb: .3 },
      words: ["the guitar, the baggy hook", "the organ, swirling underneath"],
      word: v => (v === 0 ? [] : [drop(2)]),
    },

    // JANGLE POP [The Smiths]. Motown's melodic, singing bassline under two
    // interlocking rock guitars — Marr's multi-tracked chime, the one
    // decision that makes this itself, said here as a triplet `swing` on a
    // straight 4/4 grid: the compound-time lilt a real 6/8 would give
    // without the engine's meter machinery. The Byrds' 12-string jangle,
    // the actual root of the technique, has no anchor here.
    janglepop: {
      label: "Manchester 1984", rate: 1, bars: 4, voices: 2, swing: 1/3, near: "rock",
      parents: { rock: 0.4, motown: 0.35, folkduo: 0.25 },
      wants: ["byrds jangle"],
      instr: ["clean_guitar", "clean_guitar"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: () => "line",
      harmony: "cycle", roots: [0, 5, 3, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      artic: "legato", maxHold: 4, bassStyle: "walk",
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,0,1, 1,0,1,0] },
      tone: { wave: "triangle", cut: 2400, q: 1.0, atk: .008, rel: 1.1, gain: .26, verb: .34 },
      words: ["the first guitar, the chime", "the second, interlocking, a third above"],
      // INTERLOCKING, not doubled: a bare third-above would be one hook
      // played twice, and Marr's whole point was two guitars that fit
      // together rather than one guitar heard twice (the §51 quote-box law
      // catches exactly this — measured, this exact shape failed it).
      word: v => (v === 1 ? [rotate(2), transpose(4), drop(2)] : []),
      fx: ["chorus"],
    },

    // INDIE DANCE [Soup Dragons]. Madchester's baggy sway sent all the way
    // onto the floor — house's four-on-the-floor discipline in full rather
    // than borrowed, a walking bassline doing the melodic work a lead
    // instrument would elsewhere carry (jazz and isley's own walking-bass
    // idiom, read as the dance-floor's hook). Rock supplies the guitar body
    // underneath. Nothing named here is missing; the crossover itself IS
    // the genre.
    indiedance: {
      label: "Glasgow 1990", rate: 1, bars: 4, voices: 2, near: "madchester",
      parents: { madchester: 0.4, house: 0.35, rock: 0.25 },
      wants: [],
      instr: ["clean_guitar", "synth_strings_1"],
      drumkit: "power",
      entry: v => v, reg: v => v - 1, realize: v => (v === 1 ? "pad" : "line"),
      harmony: "cycle", roots: [0, 3, 4, 0], mode: MODES.mixo,
      scale: MODES.mixo, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "walk",
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             o: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { o: [0,0,1,0, 0,0,1,0, 1,0,1,0, 1,0,1,1] },
      tone: { wave: "sawtooth", cut: 2200, q: 1.4, atk: .008, rel: .6, gain: .27, verb: .28 },
      words: ["the guitar, the hook", "the strings, a wash underneath"],
      word: v => (v === 0 ? [] : [drop(2)]),
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
      tone: { wave: "triangle", cut: 2400, q: 0.9, atk: .03, rel: 1.1, gain: .28, verb: .40,
              // WHO SINGS: the layer you stack on anything, so it is the plain modern lead
              mouth: MOUTHS.poplead },
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
      tone: { wave: "triangle", cut: 2000, q: 0.8, atk: .06, rel: 1.6, gain: .24, verb: .55,
              // WHO SINGS: this whole genre IS the backing vocal, so it says so
              mouth: MOUTHS.backingroom },
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
    ["vox",    ["gregorian", "bulgarian", "spem", "counterpoint", "fugue", "hymn"]],
    ["club",   ["acid", "house", "techno", "garage", "dnb", "trap", "boombap",
                "electro", "bigbeat", "drill", "kpop", "bigroom", "ebm", "synthduo",
                // the five newcomers below are the SAME "no family fallback"
                // deal every existing member already signed: each gets its own
                // DYNAMICS row rather than resolving to nothing (§39's law).
                "melodictechno", "bleeptechno", "industrialbreaks", "madchester",
                "indiedance"]],
    ["soul",   ["doowop", "motown", "isley", "funk", "disco", "gospel", "rnb",
                "jodeci", "clubpop", "retrofunkpop", "boyband", "darkrnb",
                "blueeyedsoul"]],
    ["groove", ["reggae", "dub", "ska", "afrobeat", "bossa", "reggaeton", "latinpop"]],
    ["band",   ["rock", "punk", "blues", "bodiddley", "chuckberry", "newwave",
                "sludge", "deathmetal", "powerballad", "emo", "screamo",
                "jamband", "sophistirock", "industrialmetal",
                "musichallrock", "grebo", "janglepop", "industrialrock",
                "gothicpop", "postpunk"]],
    ["studio", ["beatles", "steely", "toto", "kraftwerk", "eurythmics",
                "synthpop", "citypop", "merseybeat", "psychpop", "motorik",
                "roboticpop", "confessionalpop",
                "coastrock", "yachtrock", "yachtsoul", "analogsynthpop",
                "gothsynth", "dancepostpunk", "orchpsych"]],
    ["drift",  ["ambient", "drone", "vaporwave", "shoegaze", "postrock",
                "neoclassical", "minimalism", "spacerock"]],
    // the pre-rock traditions, and the two ancestors that joined them are
    // exactly that: Buenos Aires 1935, Nashville 1945, New York 1945,
    // London 1956. Kling Klang is `studio` and not `club` for the same kind of
    // reason — Kraftwerk made a record, and the floor is what the children
    // built out of it.
    ["roots",  ["countrypop", "skiffle", "tango", "jazz", "crooner", "yuletide",
                "folkduo", "worldfolk",
                "altcountry", "songwriterpiano", "softfolk", "singersongwriter"]],
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
    // ...and ELECTRO is the fifth, which is the whole argument of that anchor
    // written as a null: an 808 has an ACCENT SWITCH where a drummer has a
    // hand, so everything it wants to say about weight is already in `kitVel`
    // and nothing is left for a performance layer to add.
    techno: null, acid: null, house: null, trap: null, electro: null,
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
    // the most PHRASE of anything in the table that has drums, and the loosest
    // hand after funk: a bebop line is all shape, and keeping the metre is
    // somebody else's job — that is what the rhythm section is for
    jazz:      { stress: 0.3,  phrase: 0.7,  touch: { t: 0.07,  v: 1 } },
    // skiffle is the amateur end of the table on purpose: teenagers playing as
    // hard as they can on objects, so the metre is felt hard, the line has
    // little arch, and both the time and the level move more than anywhere else
    skiffle:   { stress: 0.55, phrase: 0.4,  touch: { t: 0.075, v: 1.1 } },
    // a piano played by a person is the case the whole layer was written for
    neoclassical: { stress: 0.3, phrase: 0.8, touch: { t: 0.06, v: 0.8 } },
    // minimalism is players, not a machine, but it is the tightest players in
    // the table: the metre is deliberately not felt (that IS the piece), the
    // line has a process rather than an arch, and a phase that wanders is just
    // two people out of time
    minimalism: { stress: 0.12, phrase: 0.15, touch: { t: 0.012, v: 0.4 } },
    // drum machines with singers over them: the machine is the floor, the
    // performance is on top, so metre stays modest and the level moves
    jodeci:    { stress: 0.3,  phrase: 0.5,  touch: { t: 0.04,  v: 0.8 } },
    rnb:       { stress: 0.35, phrase: 0.55, touch: { t: 0.05,  v: 0.85 } },
    // KRAFTWERK is not `null` like the five club machines, and the difference
    // matters: this music was PLAYED — Flür hit metal with sticks, the tunes
    // were fingered on keyboards — it just refuses to lean. So it gets the
    // smallest hand in the table rather than no hand: four thousandths of a
    // step and a quarter of a velocity unit. The metre is genuinely felt (the
    // count is the point) and the phrase is nearly flat, because a Kraftwerk
    // line does not arch, it recurs.
    kraftwerk: { stress: 0.3,  phrase: 0.15, touch: { t: 0.004, v: 0.25 } },
    eurythmics:{ stress: 0.25, phrase: 0.35, touch: { t: 0.02,  v: 0.55 } },
    synthpop:  { stress: 0.25, phrase: 0.35, touch: { t: 0.02,  v: 0.5 } },
    // kraftwerk's two direct children keep its tiny hand rather than falling
    // back to `studio`'s — motorik is the purer form of the pulse (barely a
    // hand at all: the beat's whole discipline is that it does not lean),
    // roboticpop lets a little more song-phrase back in now there is a verse
    // and a chorus to shape.
    motorik:    { stress: 0.28, phrase: 0.08, touch: { t: 0.002, v: 0.12 } },
    roboticpop: { stress: 0.3,  phrase: 0.15, touch: { t: 0.005, v: 0.22 } },
    // ...and there is deliberately NO `club` row above these six, same as
    // there is none for the eight anchors already in that family: the floor
    // is a machine by construction and each newcomer disagrees about it
    // individually, so every one gets named here rather than inheriting a
    // fallback that does not exist.
    bigbeat:   { stress: 0.45, phrase: 0.2,  touch: { t: 0.03,  v: 0.9 } },
    drill:     { stress: 0.35, phrase: 0.2,  touch: { t: 0.02,  v: 0.7 } },
    kpop:      { stress: 0.28, phrase: 0.3,  touch: { t: 0.02,  v: 0.5 } },
    bigroom:   { stress: 0.3,  phrase: 0.25, touch: { t: 0.015, v: 0.45 } },
    ebm:       { stress: 0.3,  phrase: 0.15, touch: { t: 0.01,  v: 0.35 } },
    synthduo:  { stress: 0.28, phrase: 0.35, touch: { t: 0.02,  v: 0.5 } },
    // ...and the five rooms added 2026-08-17, same law, same reason: `club`
    // still has no fallback row, so a machine-floor newcomer that disagrees
    // (which every one of these does, in a different direction) is named here
    // rather than silently rendering flat.
    //
    // melodictechno and bleeptechno are the two REAL machines of the five —
    // one hand slowly turning a filter knob, one hand pressing a sequencer
    // key — so both sit near the five frozen machines' near-zero touch, not
    // near boombap's loose hand. industrialbreaks gets boombap's own reading
    // (a distortion pedal is a hand on a control, same as an MPC with the
    // quantize off). madchester and indiedance are the two SAMPLED corners of
    // this floor, same as boombap/garage already are — a baggy break played
    // by a drummer, not triggered by one — so they sit with those two, and
    // madchester sits a little looser (indiedance took itself all the way
    // onto the floor; madchester never fully left the stage).
    melodictechno:    { stress: 0.25, phrase: 0.4,  touch: { t: 0.02, v: 0.4 } },
    bleeptechno:      { stress: 0.3,  phrase: 0.1,  touch: { t: 0.01, v: 0.3 } },
    industrialbreaks: { stress: 0.4,  phrase: 0.15, touch: { t: 0.06, v: 0.9 } },
    madchester:       { stress: 0.4,  phrase: 0.35, touch: { t: 0.07, v: 0.9 } },
    indiedance:       { stress: 0.35, phrase: 0.3,  touch: { t: 0.05, v: 0.75 } },
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

  // ---- ORNAMENTS — what a style adds to a line it has already written ------
  // kernel.js's ninth type (ORNAMENTS) reads exactly one field, `g.orn`, and a
  // genre that does not appear in this table has none: no default, no family
  // fallback, nothing. That is the opposite of the DYNAMICS table above and it
  // is deliberate. Metre and touch are true of everyone — every music has a
  // downbeat and every player has hands — but a passing tone is a CLAIM about
  // an idiom, and a table that guessed one for all eighty-seven anchors would
  // put bebop chromaticism into plainchant. So this table is short on purpose
  // and stays that way; a genre earns a row by somebody deciding it should
  // have one.
  //
  // The five terms, each a probability per eligible note (kernel.js throws them
  // with the same positional dice as the kit, so a song ornaments identically
  // every time it is played):
  //   pass      fill a leap of a third or a fourth with the step between
  //   approach  land on a strong beat from a SEMITONE away
  //   grace     a quick neighbour of the scale, before the note
  //   flam      the doubled strike
  //   roll      re-strike a long note two or three times (the ratchet)
  //
  // NOT THE FIVE MACHINES. techno/acid/house/trap/electro are frozen by
  // fingerprint in the unit gate ("a machine genre that starts breathing fails
  // here by name") and that contract is the reason the dynamics layer stayed
  // honest, so the ratchets live on the genres either side of them instead —
  // dnb, drill, garage, bigbeat, boombap — which is also where a human finger
  // on a pad actually put them.
  const ORNAMENT = {
    // BEBOP, and the reason `approach` exists at all: the note a semitone
    // under the target, landing on the beat, is most of what the vocabulary IS.
    jazz:        { pass: 0.4,  approach: 0.45, grace: 0.15 },
    solo:        { pass: 0.35, approach: 0.2,  grace: 0.3 },
    // THE CRUSHED NOTE. A blues line leans into its thirds from underneath and
    // walks the gaps — the leaning is the style, the chromaticism is not.
    blues:       { pass: 0.3,  grace: 0.45 },
    bodiddley:   { grace: 0.3 },
    chuckberry:  { pass: 0.2,  grace: 0.35 },
    jamband:     { pass: 0.3,  grace: 0.2 },
    gospel:      { pass: 0.35, grace: 0.25 },
    countrypop:  { pass: 0.2,  grace: 0.4 },       // the hammer-on and the slide
    skiffle:     { grace: 0.25 },
    crooner:     { pass: 0.3,  grace: 0.2 },
    // Buenos Aires 1935: the appoggiatura onto the beat, from a semitone away
    tango:       { approach: 0.25, grace: 0.3 },
    // THE PLAINCHANT ANSWER, and it is a different answer: passing tones only,
    // read through the mode, no approach and no flam. Chant decorates by
    // filling the line, never by striking twice.
    gregorian:   { pass: 0.35 },
    spem:        { pass: 0.3 },
    counterpoint:{ pass: 0.35 },
    fugue:       { pass: 0.3 },
    hymn:        { pass: 0.2 },
    bulgarian:   { grace: 0.35 },                  // the ornament IS the style
    funk:        { grace: 0.2,  flam: 0.15 },
    motown:      { grace: 0.15, flam: 0.12 },
    isley:       { grace: 0.2 },
    reggae:      { grace: 0.15 },
    ska:         { grace: 0.15 },
    rock:        { grace: 0.2 },
    punk:        { flam: 0.12 },
    // THE RATCHET, which is a finger on a pad and not a hand on a string
    dnb:         { roll: 0.18 },
    drill:       { roll: 0.25 },
    garage:      { roll: 0.12 },
    bigbeat:     { roll: 0.15 },
    boombap:     { flam: 0.18 },
  };
  for (const k of Object.keys(ORNAMENT)) if (GENRES[k]) GENRES[k].orn = ORNAMENT[k];

  const api = { DEFAULT, GENRES, DRUMNAME, MODES, MODELABEL, SCALES, SCALELABEL,
                MOUTHS, PROGS, FAMILIES, DYNAMICS, DYN_FAMILY, ORNAMENT };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuGenres = api;
})(typeof window !== "undefined" ? window : globalThis);
