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
    // ...and NATURAL MINOR ITSELF, sayable at last: the band page's colour
    // question ("what kind of minor?") needed the word, and the table's own
    // header has claimed "natural minor is the default" since the day it was
    // written while carrying no key for it. The value IS this file's DIATONIC
    // — the same [0,2,3,5,7,8,10] kernel.js names MODE ("natural minor") —
    // shared by reference on purpose, not a lookalike literal: aeolian is not
    // a new alphabet, it is the default one finally wearing its name.
    aeolian:  DIATONIC,
  };
  // "harmonic minor", 2026-08-27 (FUTURE.md §5, the musicologist's row): its
  // sibling already read "melodic minor", and bare "harmonic" is a different
  // word in music. The KEY stays `harmonic` — labels are not storage.
  const MODELABEL = { dorian: "dorian", phrygian: "phrygian",
                      harmonic: "harmonic minor", mixo: "mixolydian",
                      ionian: "major", lydian: "lydian", melodic: "melodic minor",
                      aeolian: "natural minor" };

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
    // ...AND THE TWO THE TABLE COULD NOT NAME (2026-08-24, D5). Ninety-nine
    // anchors declare a subject alphabet and five of them wrote it out as a
    // literal array with no key in here to answer to — blues and bodiddley
    // spell [0,3,5,6,7,10], deathmetal, screamo and industrialmetal spell
    // [0,1,3,5,6,8,10]. That is not a shrug: a document says its alphabet by
    // NAME (`alphabet.scale`, PROGRAM.md §2.1), so an anchor whose scale has
    // no name cannot be written down, and precompose.js throws by name rather
    // than quietly substituting the mode. These two rows take the count to
    // 99/99. The values are copied from the anchors that already play them,
    // so nothing sounds different — the alphabets existed, only the words did
    // not.
    //
    // `blues` is the minor pentatonic plus the flat five, which is the same
    // set this file's own DIATONIC header describes at the top; `bluesx` is
    // that idea pushed onto the darker side — the flat second and the flat
    // sixth, which is what the three metal anchors are reaching for and why
    // none of them could say `blues`.
    blues:     [0, 3, 5, 6, 7, 10],                       // 2.0
    bluesx:    [0, 1, 3, 5, 6, 8, 10],                    // 1.71
  };
  const SCALELABEL = { chromatic: "chromatic", whole: "whole tone",
                       augmented: "augmented", quartal: "quartal",
                       major: "major", majpent: "major pent.",
                       blues: "blues", bluesx: "blues, flattened" };

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
    // THE OLD WORLD'S TWO (2026-08-21, the Rome-600 slate). A troubadour is
    // one man in a hall with no polish on him: a chant-trained tenor, open
    // vowels, a straight-ish tone with more breath than any church allows,
    // one syllable a beat because a canso is WORDS before it is line.
    trobar:     { voice: "tenor",  vowels: "aeo", vib: 0.15, air: 0.30, syll: 1 },
    // ...and Caccini's nuove musiche, four centuries later: the ornament
    // arrives LATE in the note (vibRise, the crooner's own trick avant la
    // lettre), the tone is trained and forward, and the syllable stretches to
    // two beats because the affect lives in the held vowel, not the diction.
    monody:     { voice: "soprano", vowels: "aei", vib: 0.35, air: 0.22, vibRise: 0.8, syll: 2 },
    // AND AFRICA'S TWO (2026-08-25, the Aksum-540 slate). The two ends of the
    // continent's sung music this catalog can hold, and both are the BASS
    // throat, which nothing else in this table but the crooner is: plainchant
    // and the motet are tenor and countertenor, and reaching for either of
    // them here would have made Aksum sound like Rome, which is the exact
    // error the round is undoing.
    //   zema is the older half of a däbtära choir: no wobble at all (the same
    // zero that makes plainchant not opera), less breath than plainchant has
    // because the tone is PRESSED rather than floated, and TWO BEATS a
    // syllable — the only sacred row in the table above one — because a
    // mələkkət sign stretches one syllable across a whole melodic formula.
    zemachant: { voice: "bass",   vowels: "aeo", vib: 0,    air: 0.20, blend: 0.5, syll: 2 },
    // ...and Johannesburg 1939 is the opposite room: a group of men close on
    // one microphone rather than a choir in a stone building. Air 0.14 — the
    // dry end of this table, level with the merseybeat stack and only the
    // Bulgarian choir and the boy band under it — against zema's 0.20 and
    // plainchant's 0.30, because a mic six inches away records no room. And
    // blend 0.75, the fourth-loosest here after the gospel choir, the dream
    // choir and the hymnal: they are a GROUP and not a section, and the
    // raggedness is what a record cut in one take in one afternoon sounds like.
    mbubestack:{ voice: "bass",   vowels: "oau", vib: 0.18, air: 0.14, blend: 0.75, syll: 1 },
    // AND THE WORLD ROUND'S THREE (2026-08-26). Three rows and not sixty:
    // a mouth is a MEASURED tract setting, and this round adds anchors, not
    // throats — fifty-seven of the sixty name a row that already exists and
    // the comment in each says which and why it is the nearest. These three
    // could not, because in each case the ROOM is the identity and no
    // existing row is the same room.
    //   the bolerista: the crooner's late-arriving wobble at half the width
    // and twice the breath, in a TENOR rather than a bass, one syllable a
    // beat — a bolero is a poem sung slowly and the diction is the point,
    // where a crooner is selling the tone.
    bolerista: { voice: "tenor", vowels: "aoe", vib: 0.45, air: 0.26, vibRate: 5.0,
                 vibRise: 0.9, syll: 1 },
    //   the qawwal: pushed hard, high in the tenor, more air than any sacred
    // row here because the lead is SHOUTING over a party by the end of it,
    // and the wobble arrives late and stays narrow. `blend` is set for the
    // party rather than the lead: 0.7, looser than a choir and tighter than
    // the gospel room, which is what men who sing together every week sound
    // like.
    qawwal:    { voice: "tenor", vowels: "aei", vib: 0.3, air: 0.36, blend: 0.7,
                 vibRise: 0.7, syll: 1 },
    //   the shape-note singing: the LOOSEST row in this table at 0.95,
    // past the gospel choir's 0.9, because a Sacred Harp singing is a
    // hundred untrained people at full volume in a wooden room facing each
    // other, and the raggedness is the sound rather than a defect in it.
    // Almost no vibrato — the tradition sings straight and loud — and two
    // beats a syllable, because the tunes are slow and the words are long.
    shapenote: { voice: "alto",  vowels: "aeo", vib: 0.08, air: 0.28, blend: 0.95, syll: 2 },
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
 // "Beatles is counterpoint plus Bo Diddley plus skiffle…
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
      label: "Simple", voices: 1,
      plan: "song", bpm: 112,
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
      label: "Leipzig 1725", voices: 4,
      plan: "arc", bpm: 108,
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
      label: "Chicago 1987",
      plan: "dance", bpm: 124,
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
 // 1987 : the resonant peak moved 1.14 octaves and Essentia's
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
      label: "London 1979",
      plan: "dance", bpm: 138,
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
      roots: [0, 4, 5, 3],     // I V vi IV
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
      label: "Portland 2011", rate: .5,
      plan: "dance", bpm: 88,
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
      roots: [3, 4, 2, 5],   // iv v III VI
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
      label: "Chicago 1952", bars: 12, swing: 1 / 3,
      plan: "song", bpm: 104,
      // LINEAGE: a root UNDER PROTEST — Chess electrified the Delta, and
      // every actual parent (delta blues, boogie-woogie piano, jump blues)
      // is a missing anchor, so in this catalog the blues starts the tree.
      //
      // AND THE SHOPPING LIST STOPPED AT THE MISSISSIPPI, which is the
      // deepest omission this table had (found 2026-08-25). blues is the root
      // that jazz, gospel, countrypop, rock, funk — and therefore afrobeat —
      // all inherit from, and every debt it declared was American. The banjo
      // is a West African string instrument that crossed on slave ships; the
      // field holler is the work song it crossed with; the griot's ngoni is
      // the banjo's own ancestor and is played in Bamako to this day, three
      // anchors down this file. None of them can be a place-year anchor and
      // none of them will ever be a `parents` weight — they are four
      // centuries with no place, no year and no recording — but they can be
      // NAMED, and naming a debt costs nothing and changes no fit. This is
      // the truest single line available to this table today.
      parents: {},
      wants: ["delta blues", "boogie-woogie", "jump blues",
              "field holler", "griot ngoni", "the banjo's west african line"],
      // AN ARCHTOP AND A HARP, because the anchor is a BAND and not a porch:
      // Chess in 1952 is a hollow-body through a small valve amp with Little
      // Walter's amplified harmonica answering it. The steel-string acoustic
      // this used to cast is the Delta record the comment above says this
      // deliberately is not.
      instr: ["jazz_guitar", "harmonica"],
      drumkit: "jazz",              // the SAMPLED kit, not a sine and some noise
      scale: BLUES,
      entry: v => v * 4, reg: v => -v, realize: () => "line",
      bassStyle: "walk",
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
      label: "London 1969", bars: 8,
      plan: "song", bpm: 132,
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
      roots: [0, 0, 6, 6, 3, 3, 0, 0],   // i i VII VII iv iv i i
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
      label: "Rome 600", rate: 0.5,
      plan: "arc", bpm: 76,
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
      label: "Sofia 1975",
      plan: "arc", bpm: 96,
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
      plan: "arc", bpm: 80,
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
      label: "Vienna 1725",
      plan: "arc", bpm: 100,
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
      label: "Berlin 2011", bars: 8, voices: 3,
      plan: "arc", bpm: 86,
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
      kit: {}, roots: [0,0, 5,5, 2,2, 6,6],
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
      label: "New York 1964", rate: 0.25,
      plan: "arc", bpm: 70,
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
      label: "New Orleans 1991", rate: 0.5, bars: 8,
      // 74: half of what "sounds like sludge" means is the tempo
      plan: "song", bpm: 74,
      // LINEAGE: NOLA sludge is hardcore punk slowed into blues feel —
      // Eyehategod is a punk band playing at doom tempo with a blues hand;
      // the missing link between them is Sabbath, the doom that showed rock
      // where the bottom was.
      parents: { punk: 0.4, rock: 0.35, blues: 0.25 },
      wants: ["doom"],
      instr: "overdrive_guitar",
      drumkit: "power",
      entry: () => 0, reg: v => v - 3, realize: () => "line",
      mode: MODES.phrygian, roots: [0,0,0,0, 1,1,0,0],
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
      label: "Buenos Aires 1935", voices: 3,
      // an arc and not a pop song
      plan: "arc", bpm: 118,
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
      roots: [0, 3, 4, 0],
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
      label: "Tampa 1990", bars: 8,
      plan: "song", bpm: 158,
      // LINEAGE: the blast beat is hardcore's D-beat run past its limit and
      // the riff wall is rock's language forced chromatic — but the actual
      // parents, thrash and the NWOBHM it fed on, are the missing rungs of
      // the metal ladder.
      parents: { punk: 0.55, rock: 0.45 },
      wants: ["thrash metal", "nwobhm"],
      instr: "distortion_guitar",
      drumkit: "power",
      entry: () => 0, reg: v => v - 3, realize: () => "line",
      mode: MODES.phrygian, roots: [0,0,1,1, 0,0,4,4],
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
      label: "London 1983",
      // a song by birthright but a DANCE record first — "Sweet Dreams" has a
      // drop where a bridge would be; and 126 is not a guess: it is the tempo
      // of "Sweet Dreams"
      plan: "dance", bpm: 126,
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
      roots: [0, 0, 5, 5],
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
      label: "Teaneck 1973", bars: 8, voices: 3, swing: 0.16,
      plan: "song", bpm: 96,
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
      roots: [0,0, 3,3, 0,0, 4,4], mode: MODES.dorian,
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
      label: "Los Angeles 1982", bars: 8, voices: 3, swing: 0.08,
      plan: "song", bpm: 92,
      // LINEAGE: session players raised on Steely Dan's studio craft playing
      // a rock band's form over funk's pocket; the rolling tom lope is the
      // African percussion loop the record borrows and the catalog lacks.
      parents: { steely: 0.45, rock: 0.3, funk: 0.25 },
      wants: ["african percussion", "yacht rock"],
      instr: ["synth_strings_1", "marimba", "clean_guitar"],
      drumkit: "room",
      entry: v => (v === 2 ? 4 : 0), reg: v => (v === 1 ? 1 : v - 1),
      realize: v => (v === 0 ? "pad" : "line"),
      mode: MODES.mixo, scale: MODES.mixo, diatonic: true,
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
      plan: "song", bpm: 74,
      swing: 0.28,
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
      mode: MODES.dorian, scale: MODES.dorian, diatonic: true,
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
      label: "Liverpool 1962", bars: 8,
      plan: "song", bpm: 124,
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
      mode: MODES.mixo, scale: MODES.mixo, diatonic: true,
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
      label: "Los Angeles 1977", bars: 8, voices: 3, swing: 0.2,
      plan: "song", bpm: 100,
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
      mode: MODES.dorian, scale: MODES.dorian, diatonic: true,
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
      // an arc by construction — it is one crescendo
      plan: "arc", bpm: 72,
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
      scale: DIATONIC, diatonic: true,
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
      label: "New York 1994", swing: 0.2, near: "isley",
      plan: "song", bpm: 92,
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
      roots: [0, 0, 3, 3], mode: MODES.dorian,
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
      label: "Atlanta 2003", near: "deathmetal",
      plan: "dance", bpm: 140,
      // LINEAGE: Southern hip-hop is boom bap's one declared parent in the
      // catalog — but the 808 sub, the ties and the half-time snare came up
      // through Miami bass and crunk, the electro lineage the table lacks.
      parents: { boombap: 1 },
      wants: ["miami bass", "crunk"],
      instr: ["music_box", "square_lead"],
      drumkit: "tr808",            // "the 808 ties" — it does, and now it is one
      entry: v => v * 2, reg: v => 1 - 2 * v, realize: () => "line",
      roots: [0, 0, 5, 5],
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
      label: "Chicago 1986", near: "acid",
      plan: "dance", bpm: 122,
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
      entry: v => v,
      // THE CHORD SITS ABOVE THE BASS, NOT UNDER IT (2026-08-28, Paul:
      // "Chicago house is a mess. Hyperlow bass. Melody in piano."). Read
      // symbolically, `v => v - 1` centred voice 0 — the STAB, the chord that
      // IS this genre — at MIDI 36, so the poly voiced E1..D2 UNDERNEATH a
      // bass that lives at A1..F#2. Nothing was hyperlow except the chord; the
      // bass was simply buried by four notes of juno sitting on top of it. The
      // stab comes up two octaves to ctr 60 (C3..D4, where a Chicago piano
      // chord is actually played) and the piano lead stays at ctr 72 above it,
      // which is the octave of separation the comment above always claimed.
      // A RAMP WOULD HAVE THROWN THE REST AT THE CEILING — the same arithmetic
      // techno was fixed with the same day — so this is CAPPED: nothing above
      // reg 1, and every voice past the second sits centred at 0.
      reg: v => Math.max(0, 1 - v),
      realize: v => (v === 0 ? "pad" : "line"),
      // FIVE CHAIRS GET SEATED, NOT TWO, and `partOf` reads this table MODULO
      // its length — so two entries were dealing stab/lead/stab/lead/stab
      // across the singer and the two guests a precomposed record adds. That
      // put the backing choir in chordLock beside the poly, and it stacked
      // PARTS.lead's +12 on top of a layer's own +1 register and sent the
      // guest riff to E5..F#6, screaming an octave over the piano. THE ANCHOR
      // NAMES THE TWO CHAIRS IT OWNS AND GIVES EVERY GUEST ONE NEUTRAL ROLE.
      // It stays an ARRAY — precompose reads `G.part[v]` to name the two base
      // chairs, and a function form silently renamed them "pad"/"voice" — but
      // the tail entries are all `counter` rather than a per-slot casting,
      // because the guest ORDER is not stable across seeds (seed 3 seats the
      // riff where seed 1 seats the singer), so a positional table sooner or
      // later puts a vocalist in `riff` at ctr 48 and a guitar in `lead` at
      // ctr 84. `counter` is register-NEUTRAL (PARTS.counter has no ctr), so
      // every guest keeps exactly the octave its own part-genre asked for,
      // which is what all 92 partless anchors already do — and it leaves the
      // piano as the top line of the record, which is "melody in piano".
      part: ["stab", "lead", "counter", "counter", "counter"],
      roots: [1, 4, 0, 5], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      prog: [{ d: 1, q: "7" }, { d: 4, q: "7" }, { d: 0, q: "7" }, { d: 5, q: "7" }],
      bassStyle: "eighths",
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             o: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0] },
      fill: { c: [0,0,0,0, 1,0,0,0, 0,0,1,0, 1,0,1,0] },
      tone: { wave: "sawtooth", cut: 2400, q: 1.6, atk: .004, rel: .5, gain: .28, verb: .18 },
      // ...AND THE WORDS NAME THE RIGHT CHAIR NOW. Voice 0 is the POLY and
      // voice 1 is the grand, so "the piano stabs" was written over the juno
      // and the piano was called "the lead" — the box was describing a record
      // it does not play.
      words: ["the juno holds the seventh, on the tune's own rhythm",
              "the piano riff over the loop"],
      word: () => [],
    },

    // UK GARAGE [house]. Same rave, different floor: the kick BREAKS (1 and
    // the a-of-2) instead of stamping fours, the second snare is displaced,
    // the swing is huge, and the two-bar shuffle is a PERIOD — the sixth type
    // saying what house's straight grid cannot.
    garage: {
      // named "London 1999" — the 2-step year (Re-Rewind): displaced second
      // snare, chopped vocal, the shuffle edited rather than played.
      label: "London 1999", swing: 0.28, near: "house",
      plan: "dance", bpm: 132,
      // LINEAGE: fully parented IN-CATALOG, the only club genre that is —
      // 2-step is US garage house with the four removed, R&B vocal science
      // chopped over the top, and jungle's broken-drum editing at pop tempo.
      parents: { house: 0.45, rnb: 0.3, dnb: 0.25 },
      wants: [],
      instr: ["electric_piano", "solo_vox"],
      drumkit: "electronic",
      entry: v => v, reg: v => v - 1, realize: () => "line",
      roots: [0, 5, 3, 4], mode: MODES.ionian,
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
      label: "London 1994", near: "house",
      // 160: the dial tops out there, so dnb sits ON the fence rather than past
      // it — the kit density says the rest
      plan: "dance", bpm: 160,
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
      label: "New York 1977", near: "newwave",
      plan: "dance", bpm: 118,
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
      roots: [0, 3, 2, 4], mode: MODES.dorian,
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
      label: "Cincinnati 1967", swing: 0.12, near: "isley",
      plan: "song", bpm: 100,
      // LINEAGE: James Brown took gospel's scream and blues' shout, kept
      // Motown's showband discipline, and threw the harmony away — the
      // one-chord groove is subtraction, and what it subtracted FROM is the
      // parentage; the New Orleans second line under the kit is missing.
      //
      // AND THE ONE THING NOT TO "FIX" HERE, written down 2026-08-25 so the
      // next hand does not do it. The Africa round corrected afrobeat's
      // inversion — Lagos 1971 had declared itself a child of this anchor —
      // and the tempting second move is an African parent ON funk, to close
      // the loop. THAT WOULD BE A WORSE LIE THAN THE ONE IT REPLACED. James
      // Brown did not learn from E.T. Mensah. Funk's African inheritance came
      // through the Atlantic slave trade, the ring shout, the second line and
      // the church — three or four centuries with no place, no year and no
      // recording, so it cannot be a place-year anchor and therefore cannot
      // be a `parents` edge, because `parents` is a genealogy of THIS
      // CATALOG'S ANCHORS and not of world music. The inversion disappears on
      // its own now that highlife, marabi and rumba have stopped hanging off
      // American anchors. See blues' own `wants`, which is where the debt is
      // now named in its own words.
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
      label: "Detroit 1965", swing: 0.12, near: "beatles",
      plan: "song", bpm: 122,
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
      roots: [0, 5, 3, 4], mode: MODES.ionian,
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
      label: "Philadelphia 1994", near: "jodeci",
      plan: "song", bpm: 72,
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
      roots: [0, 2, 5, 3], mode: MODES.ionian,
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
      label: "Chicago 1932", voices: 3, swing: 1 / 3, near: "motown",
      plan: "song", bpm: 76,
      // LINEAGE: the label years invert and the claim survives it — Dorsey
      // was Georgia Tom, Ma Rainey's blues pianist, and carried the blues
      // HAND into church twenty years before the catalog's electric anchor;
      // the spirituals he set it against are missing.
      //
      // HYMNODY WAS NOT MISSING, and this anchor's own `wants` had said
      // "hymnody" while `hymn` (Boston 1831) sat six hundred lines up the
      // file. Fixed 2026-08-25 with no new anchor: the material was already
      // here. 0.25 is deliberately the smaller share — what Dorsey brought
      // INTO church is the bigger half of the invention and the whole point
      // of the anchor — but a gospel record's four-part congregational
      // backbone is the hymnal's, and saying blues 1.0 scored that backbone
      // as invention. See hymn's own note: these two edits are one edit.
      parents: { blues: 0.75, hymn: 0.25 },
      wants: ["spirituals"],
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
      roots: [0, 0, 3, 3], mode: MODES.ionian,
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
      label: "Kingston 1969", near: "dub",
      plan: "song", bpm: 76,
      // LINEAGE: reggae is ska slowed twice — through rocksteady, the
      // missing intermediate — until the skank had room to breathe; the
      // mento underneath and the nyabinghi drumming that displaced the kick
      // are missing too. (`near: dub` is the CHILD, not the parent.)
      // LINEAGE, REPAIRED 2026-08-26. `{ ska: 1 }` with
      // `wants: ["rocksteady", ...]` said Kingston 1969 came straight off
      // Kingston 1962 and skipped the three years in between, which is the
      // one span of Jamaican music where the tempo halves and the bass
      // becomes the lead instrument. Rocksteady (Kingston 1966) is built and
      // takes the larger weight; ska keeps a real one because the skank is
      // still ska's. Mento reaches this record THROUGH both of them and comes
      // off the want list for that reason, not because the debt was denied.
      parents: { rocksteady: 0.7, ska: 0.3 },
      wants: ["nyabinghi"],
      // the skank is the guitar and the tune is the ORGAN — the bubble every
      // Kingston session keyboard player was hired for. The harmonica this
      // cast used to answer with is a Chicago instrument; it moves to dub,
      // one row down, where it stands in for Augustus Pablo's melodica.
      instr: ["clean_guitar", "percussive_organ"],
      drumkit: "room",
      entry: v => v, reg: v => v,
      realize: v => (v === 0 ? "pad" : "line"),
      part: ["stab", "lead"],
      roots: [0, 0, 3, 4],
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
      label: "Kingston 1973", near: "reggae",
      plan: "dance", bpm: 74,
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
      label: "Kingston 1962", near: "reggae",
      plan: "song", bpm: 156,
      // LINEAGE: the shuffle came off American R&B radio picked up from New
      // Orleans — the catalog's blues anchor carries that shuffle — but
      // everything CARIBBEAN about ska (mento, calypso) is still missing. The
      // other half is no longer: the Skatalites WERE a jazz band — Drummond,
      // McCook and Alphonso came off Alpha's and Kingston's jazz scene — and
      // everything ska plays that is not the shuffle is theirs, the unison
      // horn front line, the walking bass, the major turnaround. Fifty-fifty
      // is the historical claim; the fit puts all of it on jazz.
      // LINEAGE, REPAIRED 2026-08-26 (the world round). This read
      // `{ jazz: 0.5, blues: 0.5 }` with `wants: ["mento", "calypso"]`
      // beside it — the American half at full weight and the JAMAICAN half
      // on a wish list, which is a 1962 Kingston record described entirely
      // by what it imported. Both wants are now built: mento (Kingston 1952,
      // the first commercial recordings of Jamaican music of any kind) and
      // calypso (Port of Spain 1956). Mento takes the largest single weight
      // because ska is a mento band that heard R&B, not the other way round;
      // `jump blues` is what remains on the list, because Chicago 1952 is a
      // blues and not the jump band the horn writing actually comes from.
      parents: { mento: 0.35, blues: 0.25, jazz: 0.2, calypso: 0.2 },
      wants: ["jump blues"],
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
      roots: [0, 3, 4, 0], mode: MODES.ionian,
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
      label: "Lagos 1971", bars: 8, voices: 3, near: "funk",
      // an arc: a groove you stay inside while the horns arrive
      plan: "arc", bpm: 108,
      // LINEAGE, REPAIRED 2026-08-25 (Paul: "fix the afrobeat parents"). This
      // read `{ funk: 0.7, jazz: 0.3 }` — Lagos 1971 declared a child of
      // Cincinnati 1967 — and the comment beside it already named the
      // ancestor it was refusing to give the weight to. `wants` was the
      // confession and `parents` was the lie; both are fixed together now
      // that Accra 1957 exists to hold the weight.
      //
      // THE ARGUMENT IS A MATTER OF RECORD RATHER THAN OF TASTE. Koola
      // Lobitos, 1963-69, was a HIGHLIFE-JAZZ BAND. Fela came out of highlife
      // and played it for six years; the funk arrives AFTER the 1969 Los
      // Angeles trip and Sandra Izsadore. So highlife is the band, funk is
      // the groove laid over it, and jazz is the horn writing — the unison
      // heads and blowing over changes, which the paragraph above had right
      // and which survives this edit untouched. Highlife carries a horn
      // section too, which is why jazz stays at 0.2 rather than 0.3: leaving
      // it where it was would double-count the horns now that Accra is here.
      //
      // Yoruba drumming stays on `wants` and is NOT a parent, because there
      // is no anchor to point at: the dùndún bends pitch and `melodic_tom`
      // cannot, and a talking drum that cannot talk is not one. (Jùjú is a
      // sibling and not a parent either — Fela came through highlife and was
      // famously contemptuous of it; what the two share is the Yoruba
      // percussion substrate under both.) `near: "funk"` is a different field
      // with different semantics and is left exactly as it was.
      parents: { highlife: 0.45, funk: 0.35, jazz: 0.2 },
      wants: ["yoruba drumming"],
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
      label: "Rio de Janeiro 1958", near: "steely",
      plan: "song", bpm: 132,
      // LINEAGE: it stops being a root under protest. Jobim and Gilberto
      // folded samba's rhythm and cool jazz's harmony into the apartment
      // voice; cool jazz is bebop's chamber wing and IS in the catalog now —
      // the ii7-V7 in half a bar, the sevenths everywhere, the understatement
      // — so the weight normalizes to 1 over what exists. Samba and choro,
      // the older Rio string tradition, are still owed. `near: steely` now
      // reads better: the neighbour is a SIBLING, both children of 1945.
      // LINEAGE, REPAIRED 2026-08-26. `{ jazz: 1 }` with
      // `wants: ["samba", "choro"]` beside it made Rio 1958 a wholly
      // American descent, which is precisely backwards about the half of
      // bossa nova that is Brazilian: the rhythm. Both wants are built —
      // samba (Rio 1939) and choro (Rio 1900) — and samba takes the largest
      // weight, because the batida a bossa guitar plays is a samba bateria
      // reduced to one hand. Jazz keeps a real weight for the harmony, which
      // is genuinely what it brought.
      parents: { samba: 0.5, jazz: 0.3, choro: 0.2 },
      wants: [],
      instr: ["nylon_string_guitar", "flute"],
      drumkit: "brush",
      entry: v => v, reg: v => v - 1,
      realize: v => (v === 0 ? "pad" : "line"),
      roots: [0, 1, 0, 5], mode: MODES.ionian,
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
      label: "Nashville 1945", swing: 0.1, near: "beatles",
      plan: "song", bpm: 120,
      // LINEAGE: bluegrass is Appalachian fiddle tunes driven with blues
      // phrasing and gospel's close harmony — the catalog holds the second
      // two and lacks the FIRST, which is the bigger half: the missing
      // Anglo-Celtic string band is this anchor's largest residue.
      parents: { gospel: 0.5, blues: 0.5 },
      wants: ["appalachian fiddle", "anglo-celtic balladry"],
      instr: ["banjo", "fiddle"],
      drumkit: "acoustic",
      entry: () => 0, reg: v => v, realize: () => "line",
      roots: [0, 4, 5, 3], mode: MODES.ionian,
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
      label: "Basildon 1981", near: "eurythmics",
      plan: "song", bpm: 118,
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
      roots: [0, 5, 2, 6],
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
      label: "London 1991", bars: 8, near: "postrock",
      plan: "song", bpm: 104,
      // LINEAGE: the held-second blur is DRONE logic run under fuzz, the
      // engine is punk's wall, and the tunes underneath are sixties pop —
      // MBV covered by anyone comes out as a Beatles song. The Velvets,
      // who connected all three first, are the missing citation.
      parents: { punk: 0.4, drone: 0.3, beatles: 0.3 },
      wants: ["velvet underground", "dream pop"],
      instr: ["overdrive_guitar", "overdrive_guitar"],
      drumkit: "room",
      entry: () => 0, reg: v => v - 1, realize: () => "line",
      roots: [0, 3, 5, 4], mode: MODES.ionian,
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
      label: "Tokyo 1984", swing: 0.1, near: "toto",
      plan: "song", bpm: 108,
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
      roots: [3, 4, 2, 5], mode: MODES.ionian,
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
      label: "New York 1976", near: "rock",
      // 160: ON the dial's fence rather than past it, like dnb — the kit
      // density says the rest
      plan: "song", bpm: 160,
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
      roots: [0, 3, 4, 4], mode: MODES.ionian,
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
      label: "London 1978", rate: 0.5, bars: 8, near: "drone",
      // an arc: one long breath
      plan: "arc", bpm: 70,
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
      roots: [0, 0, 3, 3, 5, 5, 4, 4],
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
      label: "Detroit 1988", bars: 8, near: "acid",
      plan: "dance", bpm: 132,
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
      /* THE STAB AND THE PAD CAME UP TWO OCTAVES, 2026-08-28. Paul, listening:
         *"On techno, voice and pad are each two octaves too low."* This read
         `reg: v => v - 2`, which put voice 0 (the stab, `fifth_sawtooth_wave`
         — a saw hard-synced to its own fifth, a LEAD instrument) at −2 and the
         `polysynth` pad at −1. Two octaves under a Detroit stab is not a stab:
         it is the thing Paul reported earlier the same week as *"this very
         fuzzy bass synth that sounds like distant thunder … It just eats the
         song"*, and the two complaints are one fault heard twice. The ramp by
         voice index is kept — it is what stacks the pad above the stab — and
         only its floor moves: 0 for the stab, +1 for the pad, which is where
         `reg: v => v` would put them (kernel.js:1387 `ctr = 60 + 12 *
         g.reg(v)`) — but this anchor seats FOUR pitched voices, not two
         (`voice, pad, pad2, riff`), so an unbounded ramp raised for the first
         two throws the fourth to C7. THE RAMP IS CAPPED AT ONE OCTAVE: 60 for
         the stab, 72 for the pad and for everything stacked above it. Paul's
         two move the two octaves he named; the pads behind them gain one and
         stop. The bass is not affected: it is not seated from this ramp. */
      entry: v => v * 2, reg: v => Math.min(v, 1),
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
      label: "New York 1945", bars: 8, voices: 3, swing: 0.2,
      // a head, solos and the head again — a song whose middle is the blowing;
      // 144 is medium-up bebop, the tempo the jazz ride's 1.6:1 lean is
      // measured for
      plan: "song", bpm: 144,
      // LINEAGE: a parent under protest. Bebop's real ancestors are all
      // missing — the swing band's four-to-the-bar, ragtime's left hand, the
      // Tin Pan Alley song whose changes it plays over, and the New Orleans
      // polyphony under everything — and the catalog's `blues` is a Chess date
      // seven years LATER. But strip that anchor to what it holds and it is a
      // twelve-bar form played by a band with a jazz kit, a ride shuffle, a
      // walking bass and a dominant seventh on every chord: the right claim
      // wearing the wrong year. A third of the 1945 sessions is twelve-bar
      // blues, so it is also the honest one.
      // LINEAGE, REPAIRED 2026-08-26. `{ blues: 1 }` with
      // `wants: ["swing", "ragtime", ...]` was this anchor admitting in
      // prose that its two biggest ancestors were missing while declaring
      // one parent at full weight. Both are now built — Kansas City 1938 and
      // Sedalia 1899 — and swing takes the largest weight, which is the
      // whole argument of the comment above: Parker learned to play in the
      // town that record comes from.
      parents: { swing: 0.5, blues: 0.3, ragtime: 0.2 },
      wants: ["tin pan alley", "new orleans jazz"],
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
      mode: MODES.ionian, scale: SCALES.major, diatonic: true,
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
      label: "Chicago 1955", swing: 0.12, near: "blues",
      // 128 is the one-bar reading of the Bo Diddley clave
      plan: "song", bpm: 128,
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
      label: "St. Louis 1955", bars: 12, voices: 3, swing: 0.15, near: "rock",
      // 150 is the honest mid between "Roll Over Beethoven" and a "Johnny B.
      // Goode" past the dial's ceiling
      plan: "song", bpm: 150,
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
      mode: MODES.mixo, scale: MODES.mixo,
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
      label: "Harlem 1955", bars: 8, voices: 3, swing: 1 / 3, near: "motown",
      // 84 is the 12/8 side of doo-wop
      plan: "song", bpm: 84,
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
      mode: MODES.ionian, scale: MODES.ionian, diatonic: true,
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
      label: "London 1956", bars: 8, voices: 3, swing: 0.15,
      // 148 makes skiffle the fastest thing in the roots family, because these
      // records rush and nobody stops them
      plan: "song", bpm: 148,
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
      mode: MODES.ionian, scale: SCALES.majpent,
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
      label: "New York 1967", bars: 8, voices: 3,
      // the ancestor that is neither song nor dance: one process, one shape,
      // which is an arc — and NOT on compose.js STEADY, because the process
      // goes somewhere, which is the whole difference from drone and ambient.
      // 120 is where the sixteenths run at eight a second; under about 100 the
      // phase stops shimmering and just sounds late
      plan: "arc", bpm: 120,
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
      mode: MODES.dorian, scale: MODES.dorian, diatonic: true,
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
      label: "Düsseldorf 1977", bars: 8, voices: 3, near: "synthpop",
      // a song: Düsseldorf's half that is the Beatles is the half that decided
      // on verses and three minutes; 120 is Trans-Europe Express and the number
      // a metronome picks
      plan: "song", bpm: 120,
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
      roots: [0,0, 6,6, 5,5, 0,0],
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
      label: "New York 1982", near: "trap",
      // the one ancestor that is a floor record; 128 is Planet Rock — the same
      // one-bar clave reading as bodiddley
      plan: "dance", bpm: 128,
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
      roots: [0, 0, 5, 6],
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

 // ---- THE REST OF THE DIAL --------------------------------
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
      label: "Boston 1831", bars: 8, voices: 4, near: "gospel",
      // a chorale — one text, one shape, no chorus to come back to
      plan: "arc", bpm: 72,
      // LINEAGE: the four-part harmonization craft is counterpoint's — Fux's
      // rules, sung rather than played — over chant-shaped stepwise lines,
      // with gospel's plagal warmth already arguing for itself (a hymn tune
      // IS a plagal cadence's native home, twenty years before Dorsey put a
      // shuffle under it). The Sternhold & Hopkins metrical psalter, which
      // taught English congregations to sing in the first place, is missing.
      //
      // GOSPEL DROPPED 2026-08-25, and it was Paul's own inversion in the
      // American religious line: Boston 1831 declared 25% of itself from
      // Chicago 1932 — the CHILD as the parent, 101 years backwards. The
      // plagal warmth the old sentence argued for is real and it is a hymn
      // tune's native home; it did not need Dorsey's anchor to say so. The
      // weight redistributes over the two that remain IN THE RATIO THEY
      // ALREADY DECLARED (0.45 : 0.3 -> 0.6 : 0.4), so nothing about the
      // surviving claim moved. The other half of the repair is on gospel
      // itself, which now declares `hymn` — and the two edits had to land
      // TOGETHER, because either one alone would have made this table's first
      // cycle and nothing here would have noticed.
      parents: { counterpoint: 0.6, gregorian: 0.4 },
      wants: ["metrical psalter", "spirituals"],
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
      kit: {}, nobass: true,
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
      label: "Los Angeles 1953", rate: 0.5, bars: 8, swing: 0.15, near: "jazz",
      plan: "song", bpm: 88,
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
      roots: [0, 5, 1, 4, 0, 5, 1, 4], mode: MODES.ionian,
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
      plan: "song", bpm: 84,
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
      roots: [0, 3, 0, 4, 0, 5, 1, 4], mode: MODES.ionian,
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
      label: "Liverpool 1963", near: "beatles",
      // 148: rushes the way punk and skiffle already do
      plan: "song", bpm: 148,
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
      roots: [0, 4, 3, 0], mode: MODES.ionian,
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
      label: "London 1968", bars: 8, near: "beatles",
      plan: "song", bpm: 112,
      // LINEAGE: the songwriting craft is `beatles`' own, further along the
      // same career; the massed choir answering "na na na" into a long vamp
      // is gospel's call-and-response, not the band's own invention; and the
      // shape of the arrival — quiet, then one instrument at a time, then
      // everything — is a structural move this record makes on its own. The
      // mellotron/orchestral half of it is still missing.
      //
      // POSTROCK DROPPED 2026-08-25: London 1968 cannot descend from Austin
      // 2003, and unlike the twenty-odd other backwards edges in this table
      // there is no proxy argument available — jazz standing in for a blues
      // older than its own label year is defensible, post-rock standing in
      // for anything in 1968 is not, because post-rock is simply a later
      // thing. The old sentence gave the game away in its own words
      // ("borrowed forty years before postrock existed to name it"), which is
      // a description of INFLUENCE RUNNING THE OTHER WAY. The 0.2 goes back
      // to the two real parents in the ratio they already declared.
      parents: { beatles: 0.55, gospel: 0.45 },
      wants: ["mellotron", "orchestral pop"],
      instr: ["clean_guitar", "ahh_choir"],
      drumkit: "room",
      entry: v => (v === 1 ? 4 : 0), reg: v => v, realize: () => "line",
      roots: [0, 0, 3, 3, 4, 4, 0, 0], mode: MODES.ionian,
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
      label: "Essex 1997", near: "techno",
      // floor music with a breakdown where a bridge would be
      plan: "dance", bpm: 132,
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
      label: "Chicago 2012", near: "trap",
      // trap's half-time grandchild
      plan: "dance", bpm: 142,
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
      label: "New York 1983", near: "disco",
      // a twelve-inch with a singer on it
      plan: "dance", bpm: 120,
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
      roots: [0, 5, 3, 4], mode: MODES.ionian,
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
      label: "Los Angeles 1991", bars: 8, near: "crooner",
      plan: "song", bpm: 76,
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
      roots: [0, 5, 3, 4, 0, 5, 4, 0], mode: MODES.ionian,
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
      label: "Los Angeles 2013", swing: 0.1, near: "funk",
      // 116, the Graceland-era lope worldfolk sits at too
      plan: "song", bpm: 116,
      // LINEAGE: the clavinet-and-horns vocabulary is funk's, played over
      // Motown's song discipline (a real changing progression rather than a
      // vamp) with disco's four-on-the-floor pop polish underneath.
      parents: { funk: 0.45, motown: 0.3, disco: 0.25 },
      wants: [],
      instr: ["clavinet", "brass_section"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: () => "line",
      roots: [0, 5, 3, 4], mode: MODES.ionian,
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
      label: "San Juan 2004", near: "reggae",
      // a dembow that never stops
      plan: "dance", bpm: 94,
      // LINEAGE: the one-drop skank's Caribbean root is reggae's; the
      // chopped, sample-built track underneath is boom bap's method aimed
      // at a different vocabulary; the sub-bass slide under it is trap's.
      // Dancehall — the actual Jamaican digital-riddim scene the dembow
      // itself came out of — is the missing rung between all three.
      // LINEAGE, REPAIRED 2026-08-26. `reggae: 0.4` with
      // `wants: ["dancehall"]` beside it was Kingston 1969 standing in for
      // Kingston 1985 because 1985 was not in the catalog — the same shape
      // of substitution as worldfolk-for-bhangra, one island over. Dancehall
      // is built and takes the weight; reggae reaches this record through
      // it. What remains unbuilt is the Panamanian reggae en español that
      // put Spanish on the riddims in the first place.
      parents: { dancehall: 0.45, boombap: 0.3, trap: 0.25 },
      wants: ["reggae en español"],
      // the dembow's top is a synth STAB — a poly chord hit hard and let go —
      // with a guitar line over it. A choir patch holding the pad made every
      // San Juan record breathe like a church.
      instr: ["polysynth", "clean_guitar"],
      drumkit: "electronic",
      entry: v => v, reg: v => v, realize: v => (v === 0 ? "pad" : "line"),
      part: ["stab", "lead"],
      roots: [0, 0, 5, 3],
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
      label: "Miami 2001", near: "bossa",
      plan: "song", bpm: 102,
      // LINEAGE: the sevenths-and-understatement harmonic language and the
      // rhythm-section restraint are bossa's own, transplanted out of the
      // apartment and into a rock band; the cross-rhythm percussion under
      // it is afrobeat's technique aimed at a different clave; rock supplies
      // the electric backbone.
      //
      // FLAGGED AND NOT FIXED, 2026-08-25, which is the honest state of this
      // vector. "afrobeat's technique aimed at a different clave" is a
      // TECHNIQUE claim written into an ANCESTRY field, and Lagos 1971 is
      // this anchor's joint-largest parent while Miami 2001's percussion is
      // Cuban and Puerto Rican — son, salsa, the timbale — not Fela. The
      // Africa round could not repair it, because a weight is a reference to
      // an anchor and there is nothing in this catalog to move it TO: the
      // hole here is Cuba and Colombia and it is a different round. So the
      // missing ancestors are named on `wants` beside the cumbia that was
      // already there, and this paragraph is the marker for whoever builds
      // them. Moving the weight to `rock` and `bossa` to make the arithmetic
      // look better would only be a second fiction on top of the first.
      // LINEAGE, REPAIRED 2026-08-26, and `afrobeat: 0.35` on a Miami 2001
      // record was the THIRD cross-basin stand-in of the same species as the
      // two WORLD.md named: Lagos 1971 was holding the place of "the Latin
      // rhythm section", because in 2024 the catalog had no Cuban, Colombian
      // or Nuyorican anchor to put there and afrobeat was the nearest thing
      // with a percussion layer on it. All three wants are now built — salsa
      // (New York 1973), cumbia (Barranquilla 1960) and son (Havana 1928) —
      // and afrobeat comes out entirely rather than being reduced, because
      // the resemblance was never to West Africa.
      parents: { salsa: 0.35, cumbia: 0.2, son: 0.1, rock: 0.2, bossa: 0.15 },
      wants: [],
      instr: ["nylon_string_guitar", "clean_guitar"],
      drumkit: "acoustic",
      entry: () => 0, reg: v => v, realize: () => "line",
      roots: [0, 3, 4, 0], mode: MODES.harmonic,
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
      label: "Seoul 2012", near: "synthpop",
      // a SONG, and the one to argue with: it has the biggest dance break of
      // anything in its batch, but everything around the break is
      // verse-prechorus-chorus, and losing that would lose the genre; 128 is
      // where every four-to-the-floor record in that batch agrees to meet
      plan: "song", bpm: 128,
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
      roots: [0, 5, 3, 4], mode: MODES.ionian,
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
      label: "Orlando 1997", voices: 3, near: "doowop",
      plan: "song", bpm: 96,
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
      roots: [0, 5, 3, 4], mode: MODES.ionian,
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
      label: "Chicago 1999", near: "punk",
      // 148: rushes the way punk and skiffle already do
      plan: "song", bpm: 148,
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
      roots: [5, 3, 0, 4], mode: MODES.ionian,
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
      label: "San Diego 1994", near: "deathmetal",
      // 152: rushes the way punk and skiffle already do
      plan: "song", bpm: 152,
      // LINEAGE: emo's confessional dynamics are the base, pushed to the
      // edge by punk's raw directness and death metal's chromatic dissonance
      // and ridden cymbal. Hardcore, the actual scene emo and screamo both
      // grew out of, is the one uncredited rung between all three.
      parents: { emo: 0.5, punk: 0.25, deathmetal: 0.25 },
      wants: ["hardcore"],
      instr: ["distortion_guitar", "distortion_guitar"],
      drumkit: "power",
      entry: () => 0, reg: v => -v, realize: () => "line",
      roots: [0, 0, 1, 1], mode: MODES.phrygian,
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
      label: "Nashville 2008", voices: 3, near: "countrypop",
      plan: "song", bpm: 118,
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
      roots: [3, 4, 5, 0], mode: MODES.ionian,
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
      label: "Toronto 2011", near: "rnb",
      // a half-time record whose real pulse is 70 counted slow — ON the dial's
      // floor rather than past it
      plan: "song", bpm: 70,
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
      roots: [0, 3, 5, 4], mode: MODES.dorian,
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
      label: "Las Vegas 2012", bars: 8, near: "techno",
      // a genre named after its drop
      plan: "dance", bpm: 128,
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
      roots: [0, 5, 3, 4, 0, 5, 3, 4], mode: MODES.ionian,
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
      label: "Philadelphia 1976", near: "motown",
      plan: "song", bpm: 104,
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
      roots: [0, 5, 3, 4], mode: MODES.ionian,
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
      label: "Greenwich Village 1964", bars: 8, near: "skiffle",
      // 96 is the folk duo's guitar
      plan: "song", bpm: 96,
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
      label: "Johannesburg 1986", bars: 8, near: "afrobeat",
      // 116 is the Graceland lope
      plan: "song", bpm: 116,
      // LINEAGE, REPAIRED 2026-08-25. This declared `afrobeat: 0.4` — its
      // largest parent — and that was CONTINENT-AS-ONE-THING: this is
      // Graceland, a SOUTH AFRICAN record with the Boyoyo Boys, General M.D.
      // Shirinda and Ladysmith Black Mambazo singing isicathamiya on the
      // actual tape. Lagos and Johannesburg are not a lineage, and "afrobeat"
      // here meant "the African one", which is the exact thing the 2026-08-25
      // round exists to stop. The weight now goes to the two Johannesburg
      // anchors that ARE the guitar language and the choral half — marabi's
      // cycle running forward through mbaqanga, and mbube's four-part group
      // singing, which is literally what is on the record. The folk-song
      // discipline (a story, a verse, one guitar carrying it) is still
      // folkduo's and countrypop's bright major-key optimism still colours
      // the top. Mbaqanga itself stays the missing rung between marabi and
      // this, and stays on `wants`.
      // ...and mbaqanga arrived 2026-08-26, off this anchor's own want
      // list. The paragraph above already names "the cycle running forward
      // through mbaqanga" as the thing marabi was standing in for;
      // Johannesburg 1964 is now an anchor and takes the weight marabi was
      // holding on its behalf, which is why marabi drops rather than the
      // total moving.
      parents: { mbaqanga: 0.3, marabi: 0.15, mbube: 0.15, folkduo: 0.25, countrypop: 0.15 },
      wants: [],
      // THE COMMENT ALREADY NAMED THE BAND: "guitar-and-kalimba interplay".
      // The kalimba was sitting in the library unasked-for while a marimba
      // stood in for it, and the guitar in Johannesburg is a bright clean
      // ELECTRIC — the high, thin, picked tone of a mbaqanga session — not
      // the nylon a folk duo brings.
      instr: ["clean_guitar", "kalimba"],
      drumkit: "acoustic",
      entry: () => 0, reg: v => v, realize: () => "line",
      roots: [0, 3, 4, 0, 0, 5, 3, 4], mode: MODES.mixo,
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
      label: "San Francisco 1972", bars: 12, swing: 0.15, near: "blues",
      // a jam band's record is one crescendo with the solos inside it, which is
      // exactly what the arc plan is
      plan: "arc", bpm: 108,
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
      bassStyle: "walk",
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
      label: "London 1986", bars: 8, swing: 0.15, near: "steely",
      plan: "song", bpm: 104,
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
      mode: MODES.dorian, scale: MODES.dorian, diatonic: true,
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
      label: "Düsseldorf 1974", bars: 8, near: "kraftwerk",
      // one pulse held for eight minutes while things arrive on top of it (its
      // parent minimalism is an arc for the same reason, and like minimalism it
      // is NOT steady: the process goes somewhere); 144 is a motorik
      // eighth-note at the speed the pulse stops being heard as separate hits
      plan: "arc", bpm: 144,
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
      label: "Düsseldorf 1978", near: "synthpop",
      plan: "song", bpm: 120,
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
      roots: [0, 5, 3, 4], mode: MODES.ionian,
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
      label: "Chicago 1988", bars: 8, near: "deathmetal",
      plan: "song", bpm: 126,
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
      mode: MODES.phrygian, scale: [0, 1, 3, 5, 6, 8, 10],
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
      label: "Chicago 1989", near: "techno",
      // floor music with a breakdown where a bridge would be, like bigbeat
      plan: "dance", bpm: 134,
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
      label: "London 1985", near: "synthpop",
      plan: "song", bpm: 122,
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
      roots: [0, 5, 3, 4], mode: MODES.ionian,
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

 // ---- TWENTY-THREE MORE ROOMS ------------------------------
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
      label: "Muswell Hill 1966",
      plan: "song", bpm: 118,
      parents: { rock: 0.45, skiffle: 0.3, doowop: 0.25 },
      wants: ["music hall"],
      instr: ["upright_piano", "clean_guitar"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: () => "line",
      roots: [0, 5, 3, 4], mode: MODES.ionian,
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
      label: "Oklahoma City 1999", voices: 3, near: "postrock",
      plan: "song", bpm: 122,
      // LINEAGE, REPAIRED 2026-08-25, and this was the worst arithmetic in
      // the table: sixty per cent of Oklahoma City 1999 pointed at anchors
      // dated 2003 and 2011. `postrock` was standing in for the slow-build
      // arrangement and `neoclassical` for the string writing, and BOTH of
      // those features are already carried by London 1968, which is
      // orchestral psychedelia's own anchor and thirty-one years the right
      // side of this one. So psychopop takes the freed weight whole and
      // `beatles` keeps the 0.4 it always declared. The resemblance to Austin
      // 2003 is real and is now written in `near`, which is the field for it.
      // (This is the one weight in the 2026-08-25 slate I would call
      // contestable rather than settled — 0.6 is a large plurality, and a
      // reader who wants it split further has a case.)
      parents: { psychpop: 0.6, beatles: 0.4 },
      wants: ["chamber pop"],
      instr: ["slow_strings", "clean_guitar", "halo_pad"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      roots: [0, 3, 4, 5], mode: MODES.ionian,
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
      label: "Chicago 1996", bars: 8, near: "countrypop",
      plan: "song", bpm: 116,
      parents: { countrypop: 0.4, rock: 0.35, blues: 0.25 },
      wants: ["cosmic american music"],
      instr: ["clean_guitar", "fiddle"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: () => "line",
      roots: [0,0, 3,3, 4,4, 0,0], mode: MODES.mixo,
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
      label: "San Francisco 1976", bars: 8, near: "isley",
      plan: "song", bpm: 104,
      parents: { isley: 0.4, funk: 0.3, motown: 0.3 },
      wants: ["quiet storm"],
      instr: ["rhodes_ep", "clean_guitar"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      roots: [0,0, 3,3, 0,0, 4,4], mode: MODES.dorian,
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
      label: "Austin 1979", near: "toto",
      plan: "song", bpm: 100,
      parents: { toto: 0.4, steely: 0.3, motown: 0.3 },
      wants: ["blue-eyed AOR"],
      instr: ["electric_piano", "clean_guitar"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      roots: [0, 5, 3, 4], mode: MODES.ionian,
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
      label: "New York 1971", bars: 8, near: "crooner",
      // 82 is Tapestry counted slow
      plan: "song", bpm: 82,
      parents: { motown: 0.4, gospel: 0.3, crooner: 0.3 },
      wants: ["brill building pop"],
      instr: ["upright_piano", "ohh_voices"],
      drumkit: "brush",
      entry: () => 0, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      roots: [0,5,3,4, 0,5,3,4], mode: MODES.ionian,
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
      label: "Chapel Hill 1970", bars: 8, near: "folkduo",
      // 88 is "Sweet Baby James", a hair up from Tapestry
      plan: "song", bpm: 88,
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
      label: "New York 1972", near: "yachtsoul",
      plan: "song", bpm: 108,
      parents: { crooner: 0.35, funk: 0.35, gospel: 0.3 },
      wants: ["laurel canyon scene"],
      // A REAL GRAND, not an EP: a 1972 New York singer's record is cut
      // around a nine-foot piano in a studio, which is also what separates it
      // from yacht rock's Rhodes two rows up — those two had the same cast
      // and the same seating, so nothing but the drums told them apart.
      instr: ["yamaha_grand_piano", "clean_guitar"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      roots: [0, 5, 3, 4], mode: MODES.ionian,
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
      label: "Sausalito 1977", near: "rock",
      plan: "song", bpm: 122,
      parents: { rock: 0.35, motown: 0.3, countrypop: 0.35 },
      wants: ["california folk rock"],
      instr: ["clean_guitar", "electric_piano"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: v => (v === 1 ? "pad" : "line"),
      roots: [0, 5, 3, 4], mode: MODES.ionian,
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
      label: "London 1973", rate: .5, bars: 8, near: "drone",
      // postrock's own shape, not drone's — a slow line that DOES go somewhere,
      // the same guitar-solo climb postrock already arcs into, so it stays off
      // compose.js STEADY (that list is for the genres that refuse to arrive
      // anywhere at all); 70 sits ON the dial's floor, because a Floyd side
      // breathes slower than the floor wants to admit
      plan: "arc", bpm: 70,
      parents: { blues: 0.35, drone: 0.35, jazz: 0.3 },
      wants: ["berlin school electronics"],
      instr: ["warm_pad", "clean_guitar"],
      drumkit: "room",
      entry: v => v * 2, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      roots: [0,0, 5,5, 3,3, 4,4],
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
      label: "Stourbridge 1990", voices: 3, near: "punk",
      // 148 sits ON the dial's fence: a Stourbridge grebo record is punk's own
      // top speed
      plan: "song", bpm: 148,
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
      roots: [0, 3, 0, 4],
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
      label: "Kent 1991", bars: 8, near: "techno",
      // a machine floor — no bridge, a drop
      plan: "dance", bpm: 130,
      parents: { house: 0.35, techno: 0.35, ambient: 0.3 },
      wants: ["berlin school electronics"],
      instr: ["warm_pad", "polysynth"],
      drumkit: "electronic",
      entry: v => v, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      roots: [0,5,3,4, 0,5,3,4], mode: MODES.dorian,
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
      label: "Manchester 1989", near: "acid",
      // a machine floor — no bridge, a drop
      plan: "dance", bpm: 124,
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
      label: "Swindon 1989", near: "bigbeat",
      // a machine floor; 134 is its breakbeat's own meeting point with the
      // "Blue Monday" pulse next door
      plan: "dance", bpm: 134,
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
      label: "Cleveland 1989", near: "industrialmetal",
      plan: "song", bpm: 128,
      parents: { deathmetal: 0.4, kraftwerk: 0.3, punk: 0.3 },
      wants: ["wax trax industrial"],
      instr: ["distortion_guitar", "metal_pad"],
      drumkit: "electronic",
      entry: () => 0, reg: v => -v, realize: () => "line",
      roots: [0, 3, 0, 4],
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
      label: "Basildon 1980", near: "eurythmics",
      // a verse-chorus record on a different synthesizer is still a
      // verse-chorus record; 124 lands inside two bpm of madchester and indie
      // dance on purpose — that IS the early-90s crossover the three argue
      // about from different rooms
      plan: "song", bpm: 124,
      parents: { synthpop: 0.5, kraftwerk: 0.3, disco: 0.2 },
      wants: ["new romantic synth pop"],
      // "unmistakably one monosynth rather than a band" — so a thin square
      // sequence out front and a poly behind it, and not a choir patch. The
      // tb303 below plays both voices; these are the names the desk shows and
      // the sounds a recast chair gets, and they should agree with the record.
      instr: ["square_lead", "polysynth"],
      drumkit: "cr78",
      entry: v => v, reg: v => v - 1, realize: () => "line",
      roots: [0, 5, 3, 4], mode: MODES.ionian,
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
      // a verse-chorus record played on a different synthesizer is still a
      // verse-chorus record — the synth is a fact about the INSTRUMENT, not
      // about the FORM
      plan: "song", bpm: 122,
      near: "analogsynthpop",
      parents: { analogsynthpop: 0.45, rock: 0.3, kraftwerk: 0.25 },
      wants: ["gothic rock"],
      instr: ["crunch_guitar", "metal_pad"],
      drumkit: "electronic",
      entry: v => v, reg: v => (v === 0 ? 1 : -2), realize: v => (v === 0 ? "pad" : "line"),
      roots: [0, 5, 3, 4],
      artic: "staccato", maxHold: 2,
      // THE LADDER IS THE IDENTITY; THE DRIVE WAS NOT. "The organs have gain
 // applied in Basildon 1990 and are very loud" — and
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
      label: "Crawley 1987", near: "shoegaze",
      plan: "song", bpm: 118,
      parents: { rock: 0.4, shoegaze: 0.3, synthpop: 0.3 },
      wants: ["gothic rock"],
      instr: ["clean_guitar", "synth_strings_1"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: v => (v === 1 ? "pad" : "line"),
      roots: [0, 5, 3, 4], mode: MODES.dorian,
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
      label: "Manchester 1979", near: "kraftwerk",
      plan: "song", bpm: 138,
      parents: { punk: 0.4, kraftwerk: 0.3, rock: 0.3 },
      wants: ["cold wave"],
      instr: ["clean_guitar", "synth_strings_1"],
      drumkit: "room",
      entry: v => v, reg: v => v - 2, realize: () => "line",
      roots: [0, 3, 0, 4], mode: MODES.dorian,
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
      label: "Manchester 1983", near: "postpunk",
      // a machine floor — no bridge, a drop; 130 is the "Blue Monday" pulse
      plan: "dance", bpm: 130,
      parents: { postpunk: 0.4, disco: 0.3, kraftwerk: 0.3 },
      wants: [],
      instr: ["synth_voice", "polysynth"],
      drumkit: "electronic",
      entry: v => v, reg: v => v - 1, realize: v => (v === 0 ? "pad" : "line"),
      roots: [0, 5, 3, 4],
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
      label: "Manchester 1990", swing: 0.12, near: "house",
      // baggy: a band ON the machine floor — no bridge, a drop; 122 is the
      // baggy/dance cluster's shared home
      plan: "dance", bpm: 122,
      parents: { house: 0.35, funk: 0.35, rock: 0.3 },
      wants: ["hacienda scene"],
      // the baggy organ is a Hammond with the percussion stop up, and
      // `drawbarorgan` is one zone rooted at MIDI 96 — a pad written at 45
      // was that sample dragged two and a half octaves down, which is the
      // breathy whistle Paul heard on every organ in the table.
      instr: ["clean_guitar", "percussive_organ"],
      drumkit: "power",
      entry: v => v, reg: v => v - 1, realize: v => (v === 1 ? "pad" : "line"),
      roots: [0, 3, 4, 0], mode: MODES.mixo,
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
      label: "Manchester 1984", swing: 1/3, near: "rock",
      plan: "song", bpm: 126,
      parents: { rock: 0.4, motown: 0.35, folkduo: 0.25 },
      wants: ["byrds jangle"],
      instr: ["clean_guitar", "clean_guitar"],
      drumkit: "room",
      entry: v => v, reg: v => v - 1, realize: () => "line",
      roots: [0, 5, 3, 4], mode: MODES.ionian,
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
      label: "Glasgow 1990", near: "madchester",
      // a band ON the machine floor, like madchester — no bridge, a drop; 124
      // keeps it inside two bpm of the cluster on purpose
      plan: "dance", bpm: 124,
      parents: { madchester: 0.4, house: 0.35, rock: 0.25 },
      wants: [],
      instr: ["clean_guitar", "synth_strings_1"],
      drumkit: "power",
      entry: v => v, reg: v => v - 1, realize: v => (v === 1 ? "pad" : "line"),
      roots: [0, 3, 4, 0], mode: MODES.mixo,
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
      label: "Solo", bars: 8, voices: 1,
      // a part on its own has no verse and no chorus — there is nothing for it
      // to be the chorus OF — so an arc: one shape with a peak (a solo
      // composing its own record is the degenerate case, and the plan says so
      // rather than pretend it is a pop song); 128 because a solo is played
      // over an up record
      plan: "arc", bpm: 128,
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
      // an arc, like every FUNCTION genre; 96 because a singer is slower than
      // the band behind them
      plan: "arc", bpm: 96,
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
      label: "Backing vocals", rate: 0.5, voices: 1,
      // an arc, like every FUNCTION genre — one shape with a peak
      plan: "arc", bpm: 84,
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
      label: "Riff", bars: 2, voices: 1,
      // an arc, like every FUNCTION genre; 112 because a riff is a mid-tempo
      // thing
      plan: "arc", bpm: 112,
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
      // an arc, like every FUNCTION genre; 74 because a pad has nowhere to be
      plan: "arc", bpm: 74,
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

    // ---- THE OLD WORLD (2026-08-21) --------------------------------------
    // Twelve anchors, Rome 600 → New York 1892, filling the thirteen
    // centuries the catalog skipped between `gregorian` and its 1930s front
    // edge. Three standing `wants` debts are paid here by name — organum
    // (owed by counterpoint AND drone), the romantic piano miniature (owed by
    // neoclassical, → nocturne), and hymnody's parlor descendant — and every
    // instrument is the nearest REAL recording the registry has, said plainly
    // (lute = nylon_string_guitar, viol = viola/cello, violone =
    // acoustic_bass, fortepiano = yamaha_grand_piano) rather than pretended
    // away. The Viennese waltz was BLOCKED here on purpose, and the reason
    // has since half-expired: the kernel grew a meter on 2026-08-20
    // (kernel.js METERS — a twelve-step bar and the pulse that tells 3/4
    // from 6/8), and the BAND PAGE reaches a waltz through the front door
    // today (band-kit `waltz`, the eighteen-hundreds in a Vienna ballroom).
    // What is still owed HERE is a catalog job, not a kernel one: every
    // pattern, cell and phrase in this file is written on sixteen places, so
    // an anchor that counts in three needs twelve-step ones of its own plus
    // its rows in compose.js PLAN_OF and BPM. Until somebody writes those
    // the salon slot stays a barcarolle — which is honest, because a
    // barcarolle IS 6/8 — and `wants` keeps the debt on the books.

    // ORGANUM — the first debt paid. Notre Dame, Léonin/Pérotin: a voice
    // ADDED to the chant. The tenor HOLDS the chant below (a pad, because a
    // held cantus is a chord with one note in it), the vox organalis moves a
    // fifth above, and the third voice arrives at bar 5 a fourth up — the
    // staggered entry IS the history: that arrival is the moment Western
    // polyphony happens. Transpose in DEGREE space: +4 is the fifth, +3 the
    // fourth, hymn's own law (the scale is seven long).
    organum: {
      label: "Paris 1200", rate: 0.5, voices: 3,
      plan: "arc", bpm: 76,
      parents: { gregorian: 1 }, wants: [], near: "gregorian",
      instr: ["ahh_choir", "ahh_choir", "solo_vox"],
      entry: v => (v === 2 ? 4 : 0), reg: v => (v === 0 ? -1 : 0),
      realize: v => (v === 0 ? "pad" : "line"),
      kit: {}, nobass: true, harmony: "modal", intro: "solo",
      mode: MODES.dorian, scale: DIATONIC,
      artic: "tie", incClamp: 2,
      tone: { wave: "triangle", cut: 2000, q: 0.7, atk: .12, rel: 2.8, gain: .24, verb: .85,
              // WHO SINGS: the same monks as gregorian — no vibrato at all
              mouth: MOUTHS.plainchant },
      words: ["the tenor, held under everything", "a fifth above, moving with it",
              "the third voice, a fourth up, from bar 5"],
      word: v => (v === 0 ? [drop(2)] : v === 1 ? [transpose(4)] : [transpose(3)]),
    },

    // TROUBADOUR. A chant-trained voice singing its OWN words for a court —
    // secular monody, the canso. The lute IS the nylon-string here, said
    // plainly, shadowing the line an octave below rather than harmonizing it,
    // because harmony has not been invented as a thing an accompanist plays.
    // The missing Andalusi thread is named in `wants`, not claimed.
    troubadour: {
      // bars 8 and an unhurried 84: a canso strophe is LONG — and measured,
      // the near-duplicate gate put a 4-bar troubadour 0.022 from counterpoint,
      // which the length and the tempo of the real form honestly separate
      label: "Provence 1210", bars: 8,
      plan: "song", bpm: 76,
      parents: { gregorian: 1 }, wants: ["andalusi song"], near: "gregorian",
      instr: ["solo_vox", "nylon_string_guitar"],
      // the lute is a BORDUN, not a second line: medieval accompaniment
      // holds the mode under the song (the fiddle's drone string, the open
      // course), it does not shadow the tune in parallel — and a pad chair
      // is exactly what a held tone under a moving line is to this engine
      entry: () => 0, reg: v => (v === 0 ? 0 : -1),
      realize: v => (v === 0 ? "line" : "pad"),
      kit: {}, nobass: true, harmony: "modal", intro: "solo",
      mode: MODES.dorian, scale: DIATONIC,
      // THE RHYTHMIC MODES ARE TRIPLE. A 1210 melody moves in the long-short
      // trochee of modal rhythm, not in even eighths — swing 1/3 is the
      // kernel's own triplet reading of exactly that — and it is also what
      // the confusion gate hears: without the lilt this anchor rendered
      // 0.023 from counterpoint, two drumless diatonic line-pairs telling
      // the machine apart by tempo alone.
      swing: 0.33,
      artic: "legato", maxHold: 4,
      tone: { wave: "triangle", cut: 2400, q: 0.8, atk: .02, rel: 1.1, gain: .26, verb: .4,
              // WHO SINGS: one man, a hall, no polish
              mouth: MOUTHS.trobar },
      words: ["the canso, one voice", "the lute, holding the bordun"],
      word: () => [],
    },

    // ESTAMPIE — the first DRUM in the catalog's history: the one pre-1500
    // music that genuinely has one, and the engine voices it perfectly. Pipe
    // and struck strings over the tabor's dum, dum-dum; the vielle/hurdy-gurdy
    // drone is the bass chair on a pedal. The puncta go round and round with
    // open and close endings — the same line, ROTATED at the section turn,
    // which is what an ouvert/clos pair is before notation can say so.
    estampie: {
      label: "Paris 1300",
      // `arc`, NOT `dance`, on the plan policy's own words (compose.js): the
      // dance plan is the build-and-drop floor grammar, and a floor record
      // states its topline only through the singer layer — which the
      // INSTRUMENTAL table rightly denies a 1300 consort, so a quote intro
      // (roots' own lean votes for one) promised a hook the record could
      // never state. A run of puncta going round is "one shape end to end";
      // tango, the danced roots ancestor, is the precedent.
      plan: "arc", bpm: 120,
      parents: { troubadour: 0.6, gregorian: 0.4 }, wants: [], near: "troubadour",
      instr: ["recorder", "dulcimer"],
      drumkit: "room",
      entry: () => 0, reg: v => (v === 0 ? 0 : -1), realize: () => "line",
      harmony: "modal", mode: MODES.dorian, scale: DIATONIC,
      bassStyle: "pedal",
      bassGrid: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],   // the tabor: dum, dum-dum
             p: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0] },
      tone: { wave: "square", cut: 2600, q: 1.0, atk: .01, rel: .5, gain: .26, verb: .35 },
      words: ["the puncta, round and round", "the strings doubling below"],
      word: (v, s) => (v === 0 ? (s % 2 ? [rotate(2)] : []) : [drop(2)]),
    },

    // ARS NOVA — Machaut: organum's tenor made RHYTHMIC, the trouvère line on
    // top. The talea is genuinely rotate() — the same material re-entering
    // against itself one notch further round each section, cyclic rather than
    // reflective, which is exactly the operator the fugue's mirror grammar
    // never uses. This is the kernel expressing the history, not
    // approximating it.
    arsnova: {
      label: "Reims 1360", voices: 3, bars: 8,
      plan: "arc", bpm: 104,
      parents: { organum: 0.6, troubadour: 0.4 }, wants: [], near: "spem",
      instr: ["ahh_choir", "solo_vox", "recorder"],  // tenor / motetus / triplum
      entry: v => [0, 2, 4][v], reg: v => v - 1,
      realize: v => (v === 0 ? "pad" : "line"),
      kit: {}, nobass: true, harmony: "emergent",
      // NOT legato: hocket — the ars nova's signature articulation is the
      // note CUT so the other voice can strike between, which is the
      // default (detached) reading, not a tied line
      mode: MODES.dorian, scale: DIATONIC,
      tone: { wave: "triangle", cut: 2300, q: 0.8, atk: .06, rel: 2.0, gain: .2, verb: .7,
              // WHO SINGS: the motet mouth — spem's own, two centuries early
              mouth: MOUTHS.motet },
      words: ["the tenor: the talea, turning", "the motetus", "the triplum, high and quick"],
      word: (v, s) => (v === 0 ? [rotate(3 * s), drop(2)]
                    : v === 1 ? [transpose(2)]
                    : [transpose(4), rotate(5 * s)]),
    },

    // PAVANE — Susato's Danserye: the consort plays for DANCING. The lines
    // are polyphony's, the drum is the estampie's tabor grown up, and the
    // ground is the real passamezzo antico, mined from history rather than
    // invented — one chord a bar, eight bars, the progression the whole
    // Renaissance danced over. (Renaissance polyphony itself is NOT
    // re-anchored: spem + counterpoint own the idiom; this draws on spem.)
    pavane: {
      label: "Antwerp 1551", voices: 3, bars: 8,
      // `arc` for the estampie's reason (see that anchor): the kernel's dance
      // plan is club build-and-drop, whose topline arrives only on a singer,
      // and a consort has none — a processional danced through is one shape
      // end to end, tango's own plan.
      plan: "arc", bpm: 76,
      parents: { estampie: 0.4, spem: 0.35, troubadour: 0.25 }, wants: ["galliard"],
      near: "spem",
      instr: ["nylon_string_guitar", "recorder", "viola"],   // lute, pipe, viol
      drumkit: "room",
      entry: v => (v === 2 ? 2 : 0), reg: v => (v === 0 ? -1 : v - 1),
      realize: () => "line",
      roots: [0, 6, 0, 4, 2, 6, 4, 0],   // the passamezzo antico
      scale: DIATONIC, diatonic: true, maxHold: 2,
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             p: [0,0,0,0, 1,0,0,0, 0,0,1,0, 1,0,0,0] },
      bassGrid: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      tone: { wave: "triangle", cut: 2400, q: 0.9, atk: .015, rel: .8, gain: .26, verb: .4 },
      words: ["the lute, carrying the ground", "the pipe above", "the viol between"],
      word: v => (v === 1 ? [transpose(2)] : v === 2 ? [invert(5)] : []),
    },

    // CONTINUO — Florence 1602, Caccini's Le nuove musiche: polyphony
    // deliberately REFUSED. One voice, affect first, the chords reduced to an
    // accompaniment a harpsichord realizes from figures — and under it the
    // lamento tetrachord, falling by step, the bass line the whole Baroque
    // will cry over. The violone is the bass chair's own acoustic_bass,
    // honestly close.
    continuo: {
      label: "Florence 1602", rate: 0.5,
      plan: "song", bpm: 72,
      parents: { troubadour: 0.55, spem: 0.45 }, wants: ["opera seria"], near: "crooner",
      instr: ["solo_vox", "harpsichord"],
      entry: v => (v === 0 ? 2 : 0), reg: v => (v === 0 ? 0 : -1),
      realize: v => (v === 0 ? "line" : "pad"),
      kit: {},
      roots: [0, 6, 5, 4],                        // the lamento tetrachord
      scale: DIATONIC,
      artic: "legato", anchor: 2, maxHold: 4, intro: "solo",
      bassStyle: "pedal",
      tone: { wave: "triangle", cut: 2200, q: 0.9, atk: .03, rel: 1.4, gain: .24, verb: .45,
              // WHO SINGS: the ornament arrives late in the note
              mouth: MOUTHS.monody },
      words: ["the voice, held over the descent", "the harpsichord, realizing the figures"],
      word: v => (v === 0 ? [] : [drop(2)]),
    },

    // CONCERTO — Venice 1725, the high-Baroque BAND (fugue already owns the
    // organ loft): counterpoint's engine driving a dance pulse over a
    // continuo. The ritornello alternation is the form the classical style
    // inherits, and THE BAROQUE SEQUENCE is the word: the solo restates one
    // step lower each section — transpose(-1) per section is Vivaldi's whole
    // episode grammar. The walking continuo IS driving eighths on the
    // violone.
    concerto: {
      label: "Venice 1725", voices: 3, bars: 8,
      plan: "arc", bpm: 120,
      parents: { continuo: 0.4, counterpoint: 0.35, pavane: 0.25 }, wants: [],
      near: "fugue",
      instr: ["strings", "violin", "harpsichord"],   // tutti / solo / continuo
      entry: v => (v === 1 ? 4 : 0), reg: v => (v === 1 ? 1 : v === 2 ? 0 : -1),
      realize: v => (v === 2 ? "pad" : "line"),
      kit: {},
      roots: [0, 3, 4, 0, 5, 1, 4, 0],
      mode: MODES.harmonic, scale: DIATONIC, diatonic: true,
      bassStyle: "eighths",
      maxHold: 2,
      tone: { wave: "sawtooth", cut: 2600, q: 1.0, atk: .01, rel: .6, gain: .24, verb: .35 },
      words: ["the ritornello, tutti", "the solo, sequencing away from it", "the continuo"],
      word: (v, s) => (v === 1 ? [transpose(-(s % 3)), ...(s % 2 ? [rotate(2)] : [])] : []),
    },

    // CLASSICAL — Vienna 1785, the galant reaction: the concerto's clarity,
    // the fugue kept for development sections only, and the piano replacing
    // the harpsichord. The tune is periodic, the Alberti hand turns under it
    // low and short (a RIFF, which is what an Alberti bass is to this
    // engine), and the strings double the cadence. The fortepiano is the
    // grand, said plainly.
    classical: {
      label: "Vienna 1785", voices: 3, bars: 8,
      plan: "song", bpm: 120,
      parents: { concerto: 0.55, continuo: 0.25, fugue: 0.2 }, wants: [],
      near: "songwriterpiano",
      instr: ["yamaha_grand_piano", "yamaha_grand_piano", "slow_strings"],
      part: ["lead", "riff", "pad"],
      entry: v => (v === 2 ? 2 : 0), reg: v => [1, -1, 0][v],
      realize: v => (v === 2 ? "pad" : "line"),
      kit: {}, nobass: true,                      // the left hand IS the bass
      roots: [0, 3, 4, 0, 0, 5, 1, 4],
      mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      maxHold: 2,
      tone: { wave: "triangle", cut: 3000, q: 0.8, atk: .005, rel: .7, gain: .28, verb: .3 },
      words: ["the tune, periodic", "the Alberti hand under it", "strings, doubling the cadence"],
      word: (v, s) => (v === 1 ? [rotate(1), ...(s % 2 ? [] : [drop(2)])] : []),
    },

    // NOCTURNE — Paris 1835, Chopin: a bel-canto line (monody's thread, kept
    // in the lineage) over a widespread left hand. This is the romantic piano
    // miniature `neoclassical` has wanted since its own anchor was written —
    // the debt is paid here and neoclassical's `wants` can empty the day its
    // comment is next touched. Melodic minor because it is the minor that can
    // still make a real dominant AND sing a major sixth on the way up, which
    // is what a nocturne's fioritura does.
    nocturne: {
      label: "Paris 1835", rate: 0.5, bars: 8,
      plan: "arc", bpm: 72,
      parents: { classical: 0.6, continuo: 0.4 }, wants: ["bel canto opera"],
      near: "neoclassical",
      instr: "yamaha_grand_piano",
      part: ["lead", "pad"],
      entry: () => 0, reg: v => (v === 0 ? 1 : -1),
      realize: v => (v === 0 ? "line" : "pad"),
      kit: {}, nobass: true,
      roots: [0, 5, 3, 4, 0, 5, 1, 4],
      mode: MODES.melodic, scale: DIATONIC,
      artic: "legato", maxHold: 6, incClamp: 2,
      tone: { wave: "triangle", cut: 2600, q: 0.8, atk: .01, rel: 2.0, gain: .26, verb: .5 },
      words: ["the song, up high, taking its time", "the left hand, wide and low"],
      word: v => (v === 1 ? [drop(2)] : []),
    },

    // ROMANTIC — Vienna 1876, the orchestra: the body of strings, the tune in
    // the CELLO (the romantic register), horns answering at bar 5, and the
    // tremolo arriving last — which is how a climax is built. No fx block:
    // the era law (compose.js FX_YEAR) is right that 1876 has no filter
    // sweep, and the swell lives in the entries instead. Timpani exist in the
    // registry but the kit has twelve fixed lanes and no timpani file;
    // casting one as a pitched voice would make it melodic, so it waits for a
    // PERC lane rather than being faked.
    romantic: {
      label: "Vienna 1876", voices: 4, bars: 8,
      plan: "arc", bpm: 76,
      parents: { classical: 0.5, nocturne: 0.3, concerto: 0.2 },
      wants: ["opera orchestra"], near: "neoclassical",
      instr: ["slow_strings", "cello", "french_horns", "tremolo"],
      entry: v => [0, 0, 4, 6][v], reg: v => [-1, 0, -1, -2][v],
      realize: v => (v === 0 || v === 3 ? "pad" : "line"),
      kit: {},
      roots: [0, 5, 3, 4, 2, 5, 1, 4],
      mode: MODES.harmonic, scale: DIATONIC,
      artic: "legato", maxHold: 4,
      tone: { wave: "sawtooth", cut: 2000, q: 0.9, atk: .08, rel: 2.4, gain: .2, verb: .65 },
      words: ["the strings", "the cello, singing the tune", "the horns, answering",
              "tremolo, underneath, late"],
      word: v => (v === 2 ? [transpose(-3)] : v === 3 ? [drop(2)] : []),
    },

    // BARCAROLLE — the salon, honestly. The salon slot rocks in 6/8 rather
    // than waltzing (see the heading above: this file's cells are sixteen
    // places long, so a three-count anchor is a catalog job still owed), and
    // a barcarolle is the one salon form that lives there. Swing 1/3 is the
    // triplet shuffle standing in for the compound bar — the band page's own
    // barcarolle now says `meter: "six"` outright, which is what this anchor
    // wants the day its cells are rewritten in twelve. Voice, harp rolling
    // under it, a cello line between; `wants` keeps the waltz debt on the
    // books.
    barcarolle: {
      label: "Paris 1881", voices: 3, bars: 8, swing: 0.33,
      plan: "song", bpm: 76,
      parents: { nocturne: 0.55, classical: 0.45 }, wants: ["viennese waltz"],
      near: "nocturne",
      instr: ["solo_vox", "harp", "cello"],
      // THE CELLO WAITS WITH THE VOICE. Two LINE voices an octave apart
      // (reg 0 / -1) trading which of them owns the downbeat across the
      // entry seam is, to the root-fold gate, an unfolded root walk — the
      // first line note of the bar jumped 25 semitones where the harmony
      // moved 10. So the harp rocks the first two bars alone (a pad, so the
      // gate rightly ignores it) and the song and its cello line arrive
      // together — which is how the salon actually opens the form.
      entry: v => (v === 1 ? 0 : 2), reg: v => [0, 0, -1][v],
      realize: v => (v === 1 ? "pad" : "line"),
      kit: {}, roots: [0, 4, 0, 4, 3, 4, 0, 4],
      mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      bassStyle: "pedal",
      artic: "legato", anchor: 2, maxHold: 4,
      tone: { wave: "triangle", cut: 2400, q: 0.8, atk: .02, rel: 1.6, gain: .24, verb: .5,
              // WHO SINGS: the monody mouth, three centuries on — the salon
              // soprano is Caccini's daughter by direct descent
              mouth: MOUTHS.monody },
      words: ["the song, rocking on the tide", "the harp, rolling under it", "the cello line"],
      word: v => (v === 1 ? [drop(2)] : v === 2 ? [invert(5)] : []),
    },

    // PARLOR — New York 1892, the hinge into the existing catalog: the
    // hymnal's four-part habit sold as sheet music for the home piano. Its
    // I-vi-IV-V IS "the doo-wop changes" sixty years early, which stitches
    // this whole slate onto the catalog's 1950s front edge — hence
    // `near: "doowop"`, a claim about the future rather than the past.
    parlor: {
      label: "New York 1892",
      plan: "song", bpm: 96,
      parents: { hymn: 0.4, classical: 0.35, barcarolle: 0.25 }, wants: ["ragtime"],
      near: "doowop",
      instr: ["solo_vox", "upright_piano"],
      entry: () => 0, reg: v => (v === 0 ? 0 : -1),
      realize: () => "line",
      kit: {}, nobass: true,
      roots: [0, 5, 3, 4],                        // the fifties changes, at home in 1892
      mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      maxHold: 4,
      tone: { wave: "triangle", cut: 2600, q: 0.8, atk: .008, rel: .9, gain: .28, verb: .3,
              // WHO SINGS: the hymnal mouth, out of church and into the front room
              mouth: MOUTHS.hymnal },
      words: ["the song, sentimental on purpose", "the upright, oom and chord"],
      word: v => (v === 1 ? [rotate(1)] : []),
    },

    // ======================================================================
    // NOW — the 2020s, added 2026-08-24
    // ======================================================================
    // Paul: "'now' is a lie, it's the 2010s. Add the 2020s as now."
    //
    // He was right twice. atlas.js's ERAS said `{ w: "now", y: 2011 }` — so
    // the word "now" pointed at the 2010s — and the catalog's newest record
    // was Los Angeles 2013, so even fixing the word left the last decade and a
    // half of music missing. A slider whose right-hand end is 2013 is a map of
    // a world that stopped.
    //
    // WHY EIGHT AND NOT ONE. atlas.gate.js G6 requires every slider stop to
    // carry at least one exact record, so a decade you cannot compose in is a
    // dead stop — a worse lie than the one being fixed. And the map is the
    // argument for the spread. MEASURED on the catalog before this change: of
    // the 94 placed anchors dated 1950 or later, 79 are in a US or UK city —
    // 84%. That is defensible for 1962 and indefensible for 2021, because the
    // 2020s are the decade in which the biggest records were made furthest
    // from London and Los Angeles. So the eight below are drawn from the map's
    // OWN empty quarters — South Africa, West Africa, North Africa, South
    // Asia, Mexico and Brazil get a dot each, and the two Anglo entries are
    // the two that genuinely are Anglo. Measured after: 81 of 102, 79%. One
    // round does not fix a catalog; it moves it five points and stops adding
    // to the problem.
    //
    // Three of the places (Guadalajara, Chandigarh, Cairo) were coordinates
    // atlas.js did not have. It has them now: PLACES 62 -> 65 rows, WHEN
    // re-baked 116 -> 124, YEARS 65 -> 69 stops spanning 600..2023, and
    // `atlas.js` ERAS gaining the row it derives rather than types —
    // `{ w: "now", y: 2020 }`, which is the sentence at the top of this
    // comment finally being true. Verified: atlas.gate.js PASSED all 32.
    //
    // THE HONESTY TEST EACH ONE PASSES: a correlated point across the eight
    // axes (AXES.md), a real "City Year" label the atlas can extract, declared
    // weighted `parents` so the residue is nameable, and not one instrument
    // the registry cannot play — checked against engine/registry-data.js
    // SAMPLERS, which is where `accordian` (a font preset, not a sampler) was
    // rejected and `tuba`, `shenai` and `reed_organ` were confirmed — three
    // timbres no other anchor in the 122 casts, measured, and all three with
    // every zone file on disk (checked: 12 instruments, 0 missing zones, so
    // nothing here is a silent voice under the offline law).

    // AMAPIANO — Johannesburg 2020. The piano IS the genre's name and the
    // genre's sound: jazz voicings, held long, over a kick that only lands
    // twice a bar and a shaker that never stops. The log drum — the pitched,
    // sliding bass hit everyone recognises — is the bass chair playing
    // `octaves` under a chord that changes once a bar, because this kernel's
    // bass chair is one instrument (instruments.js BASS_INSTR) and a genre
    // cannot recast it. The SHAPE is what carries, and the shape is what the
    // ear names the genre by.
    amapiano: {
      label: "Johannesburg 2020", near: "house",
      // a floor record whose tempo is the whole trick: 112 is too slow to be
      // house and too fast to be hip-hop, and the space that opens between
      // them is where the shaker lives
      plan: "dance", bpm: 112,
      // LINEAGE: the deep, chord-led, endlessly-looping floor is house's, at
      // half its urgency; the seventh-and-ninth voicings held under the loop
      // are jazz's; the shaker-and-hand percussion layer that actually drives
      // the record is afrobeat's cross-rhythm hand. Kwaito — the Johannesburg
      // scene that slowed house down in the first place, thirty years before
      // this one slowed it again — WAS the missing rung, and this anchor's
      // 0.3 was on `afrobeat` for want of anything nearer. Kwaito landed
      // 2026-08-25 and the weight moved to it: Lagos 1971 was standing in for
      // the LOCAL rung, one city, twenty-six years and one machine floor away.
      parents: { house: 0.4, jazz: 0.3, kwaito: 0.3 },
      wants: [],
      instr: ["yamaha_grand_piano", "polysynth"],
      drumkit: "electronic",
      entry: v => v, reg: v => (v === 0 ? 0 : -1),
      realize: v => (v === 0 ? "line" : "pad"),
      part: ["lead", "pad"],
      roots: [0, 5, 2, 6], mode: MODES.dorian,
      scale: MODES.dorian, diatonic: true,
      prog: [{ d: 0, q: "m7" }, { d: 5, q: "maj7" }, { d: 2, q: "maj7" }, { d: 6, q: "7" }],
      artic: "legato", maxHold: 4, bassStyle: "octaves",
      // THE KICK ONLY LANDS TWICE. Everything the ear calls "amapiano" is in
      // the two lanes underneath it: an offbeat hat, and a shaker that is the
      // densest hand-percussion lane in the catalog — 10 hits of 16, where
      // afrobeat's own is 6 and the 23-anchor median is 4. Take the shaker out
      // and the same chords are a deep house record.
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             p: [1,0,1,1, 0,1,1,0, 1,0,1,1, 0,1,1,0] },
      fill: { p: [1,0,1,1, 0,1,1,0, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2200, q: 1.0, atk: .01, rel: 1.2, gain: .26, verb: .32 },
      words: ["the piano, the voicing held across the loop",
              "the pad, an octave under, moving only when the chord does"],
      word: v => (v === 1 ? [drop(2)] : []),
    },

    // AFROBEATS — Lagos 2021, and the plural matters: `afrobeat` (Lagos 1971)
    // is a twenty-minute horn band and this is a three-minute pop single that
    // borrowed its percussion and nothing else. What survived the fifty years
    // is the SHEKERE — the hand layer that plays across the kick rather than
    // with it — and what replaced the horns is a sung hook with R&B's own
    // sense of phrase and a Caribbean rhythm section's restraint.
    afrobeats: {
      label: "Lagos 2021", near: "afrobeat",
      plan: "song", bpm: 104,
      // LINEAGE: the cross-rhythm percussion bed and the modal, unresolving
      // vamp are afrobeat's own, cut down to pop length; the sung, melismatic
      // top line and the stacked answer are R&B's; the sparse, off-the-beat
      // rhythm-section discipline — play less than you can — is reggae's.
      // Highlife (the Ghanaian guitar tradition this melody actually comes
      // from) and dancehall (the digital riddim under the kick) are both
      // missing rungs.
      // ...and the highlife weight arrived 2026-08-25, off this anchor's own
      // `wants` and out of the sentence three lines above it: the file has
      // said "the Ghanaian guitar tradition this melody actually comes from"
      // since the day it was written and pointed the weight at Lagos instead.
      // afrobeat 0.4 -> 0.35 and reggae 0.3 -> 0.2 pay for it; reggae is
      // still standing in for dancehall, which stays on `wants`.
      // ...and dancehall arrived 2026-08-26 off this anchor's own want
      // list. Kingston 1985 is where the vocal cadence and the sparse
      // digital riddim come from and it is a nearer ancestor than Kingston
      // 1969, so reggae's weight goes to it rather than the total moving.
      parents: { afrobeat: 0.3, highlife: 0.2, rnb: 0.25, dancehall: 0.15, reggae: 0.1 },
      wants: [],
      instr: ["solo_vox", "clean_guitar"],
      drumkit: "room",
      entry: v => v, reg: v => (v === 0 ? 0 : -1), realize: () => "line",
      roots: [0, 3, 5, 4], mode: MODES.dorian,
      scale: MODES.dorian, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "eighths",
      // ONE CLAP, ON THREE. The backbeat is deliberately not there: a snare on
      // 2 and 4 would make this a pop record with percussion on it, and the
      // whole feel is that the kick and the hand layer disagree about where
      // the bar starts.
      kit: { k: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
             c: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
             p: [1,0,1,0, 1,0,1,1, 1,0,1,0, 1,1,1,0] },
      fill: { p: [1,0,1,0, 1,1,1,1, 1,0,1,1, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2600, q: 0.9, atk: .01, rel: .8, gain: .27, verb: .3 },
      words: ["the vocal, riding across the kick",
              "the guitar, answering — the phrase's own gate, complemented"],
      // the same TRUE ANSWER retrofunkpop uses, and for the same reason: the
      // guitar has to land where the voice does not or the two read as one
      // line doubled, which is exactly what this style never does.
      word: v => (v === 1 ? [only("gate", complement("gate")), transpose(-5)] : []),
    },

    // HYPERPOP — London 2021. Pop's own materials taken past the point where
    // they were designed to work: the supersaw at full brightness, the vocal
    // pitched up until it stops sounding like a body, everything short and
    // everything loud. Measured against the other 129: it ties dnb and punk
    // for the fastest tempo in the table (160), sits with bleeptechno and
    // bailefunk at the shortest hold (maxHold 1), and its filter is open
    // wider than anything else here (cut 4200, where the next brightest is
    // minimalism at 3400). All three of those ARE the genre, not production
    // choices laid over it.
    hyperpop: {
      label: "London 2021", near: "synthpop",
      plan: "song", bpm: 160,
      // LINEAGE: the all-synthetic chassis and the verse-chorus discipline
      // are synthpop's; the 808 sub and the stuttered hat are trap's; the
      // festival-scale supersaw lead is big room's, indoors and sped up. The
      // internet-native scenes this actually grew in — the PC Music label,
      // and the sped-up "nightcore" edit that taught it the tempo — have no
      // musical anchor to name.
      parents: { synthpop: 0.35, trap: 0.35, bigroom: 0.3 },
      wants: ["pc music", "nightcore"],
      instr: ["saw_wave", "solo_vox"],
      drumkit: "electronic",
      entry: v => v, reg: v => (v === 0 ? 1 : 0), realize: () => "line",
      part: ["lead", "lead"],
      roots: [0, 5, 3, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      prog: [{ d: 0, q: "nine" }, { d: 5, q: "nine" }, { d: 3, q: "nine" }, { d: 4, q: "7" }],
      artic: "staccato", maxHold: 1, bassStyle: "octaves",
      kit: { k: [1,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0],
             c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      // THE HAT IS NOT STEADY, which is trap's inheritance and drill's
      // neighbour: the holes are where the roll starts, and they move.
      kitProb: { h: [9,4,9,6, 9,4,9,9, 9,6,9,4, 9,9,4,9] },
      fill: { c: [0,0,0,0, 1,0,0,1, 1,0,1,0, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 4200, q: 2.6, atk: .002, rel: .18, gain: .29, verb: .18 },
      words: ["the supersaw, too bright and too short",
              "the voice, pitched up an octave over it"],
      word: v => (v === 1 ? [transpose(12), only("gate", rotate(2))] : []),
    },

    // BAILE FUNK — Rio de Janeiro 2022. The TAMBORZÃO, which is a samba
    // pattern played on a Miami-bass drum machine, and the reason this is a
    // separate anchor from `reggaeton` rather than a dialect of it: the dembow
    // doubles its snare on 2 and 4 and repeats identically every bar (compare
    // the `reggaeton` grid four hundred lines up), where the tamborzão's snare
    // walks a clave and lands on neither — steps 2, 5, 10 and 13 of sixteen.
    // The record on top is a chopped vocal and one synth stab, no changes at
    // all, which is why `harmony: "modal"`.
    bailefunk: {
      label: "Rio de Janeiro 2022", near: "electro",
      plan: "dance", bpm: 130,
      // LINEAGE: the 808 kit and the sub that IS the bassline are electro's,
      // by the direct Miami route the Rio DJs actually imported; the
      // one-riddim, no-changes floor and the chopped vocal over it are
      // reggaeton's shared Caribbean method; the clave the snare walks is
      // Brazilian, and `bossa` is the only anchor that carries it. Samba
      // itself — the percussion tradition the tamborzão is a sample OF — is
      // the missing rung, and it is a large one.
      parents: { electro: 0.4, reggaeton: 0.3, bossa: 0.3 },
      wants: ["samba", "miami bass"],
      instr: ["solo_vox", "square_lead"],
      drumkit: "tr808",
      entry: () => 0, reg: v => (v === 0 ? 0 : -1), realize: () => "line",
      harmony: "modal", mode: DIATONIC, scale: DIATONIC,
      artic: "staccato", maxHold: 1, bassStyle: "octaves",
      // the snare is the melody here. Written as the clave it is, not as a
      // backbeat with syncopation added: there is no 2 and no 4 in it.
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             s: [0,0,1,0, 0,1,0,0, 0,0,1,0, 0,1,0,0],
             p: [1,0,0,1, 0,0,1,0, 0,0,1,0, 0,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,1,0, 0,1,0,0, 1,0,1,1, 1,1,1,1] },
      tone: { wave: "square", cut: 2400, q: 2.0, atk: .002, rel: .25, gain: .29, verb: .14 },
      words: ["the vocal, chopped onto the tamborzão",
              "the stab, one note, answering the snare"],
      word: v => (v === 1 ? [only("gate", rotate(2)), excerpt(0, 8)] : []),
    },

    // CORRIDO TUMBADO — Guadalajara 2023, and the shortest description of it
    // is what it does NOT have: no drum kit, no bass guitar, no machine. A
    // requinto plays the tune, a tuba plays the floor, and the entire rhythm
    // section is those two instruments disagreeing about the beat. Nineteen
    // anchors carry `kit: {}` AND `nobass: true` and this is the only one of
    // them dated after 1892 — the other eighteen are chant, counterpoint, the
    // function genres and the old-world slate. That is not an accident of
    // filing: a sung story with an acoustic ensemble and no kit is a form
    // older than every rock anchor in the table, which is why the FAMILIES
    // row below puts a 2023 record in `roots`.
    corridotumbado: {
      label: "Guadalajara 2023", near: "countrypop",
      // slow, and a narrative: these are ballads, and the tempo is set by how
      // fast the words can be sung, not by anything a dancer needs
      plan: "song", bpm: 90,
      // LINEAGE: the sung story over plain major changes with a guitar
      // carrying it is country's own shape; the Latin pop-rock harmonic
      // language and the Spanish-language pop phrasing are latinpop's; the
      // all-acoustic, no-kit ensemble is worldfolk's arrangement law. Banda
      // and norteño — the actual Sinaloan brass and accordion traditions this
      // is a stripped-down argument with — are both missing rungs, and the
      // registry has no accordion sampler to build norteño on if they were
      // here (engine/registry-data.js SAMPLERS: `accordian` is a font preset
      // with no zones, which is a silent voice, so it is not cast).
      // LINEAGE, REPAIRED 2026-08-26 — the SECOND of the two edges WORLD.md
      // §4 caught. `worldfolk: 0.30`, Johannesburg 1986, on a Sinaloan
      // corrido, with `wants: ["banda", "norteño"]` sitting right beside it.
      // Both wants are now built — Mazatlán 1938 and Monterrey 1955 — and
      // both are the actual music: a corrido tumbado is a norteño requinto
      // line and a banda tuba with trap's phrasing on top. `countrypop` and
      // `latinpop` go with `worldfolk`: Nashville 1945 and Miami 2001 were
      // standing in for "a sung story" and "a Spanish-language record", and
      // this catalog can now name the real thing for each.
      parents: { nortena: 0.45, banda: 0.3, trap: 0.25 },
      wants: [],
      // THE ACTUAL ENSEMBLE, three deep and in that order: requinto, tuba,
      // bajo quinto. THREE entries and not two on purpose — the array's law is
      // that the last entry covers every remaining chair (this file's header),
      // and a two-entry array put a TUBA on all five chairs precompose seats,
      // measured. A corrido has one tuba. The bajo takes the rest.
      //
      // The tuba is the first one in this catalog — 123 samplers, six zones,
      // cast zero times until now. It has NO instruments.js RANGES row, so it
      // degrades to its zone window rather than to a tuba's real compass —
      // that file's own stated law for an unlisted id, and the row is filed as
      // a recipe rather than smuggled in from a slice that does not own
      // instruments.js. It plays honestly meanwhile: measured over three
      // seeds, voice 1 sits at MIDI 32..61 — well inside a tuba's own E1..F4.
      instr: ["nylon_string_guitar", "tuba", "steel_string_guitar"],
      entry: v => v, reg: v => (v === 0 ? 0 : v === 1 ? -1 : 0),
      realize: () => "line",
      kit: {}, nobass: true,
      roots: [0, 3, 4, 0], mode: MODES.ionian,
      scale: SCALES.major, diatonic: true,
      artic: "legato", maxHold: 3,
      tone: { wave: "triangle", cut: 2400, q: 0.8, atk: .008, rel: 1.0, gain: .28, verb: .26 },
      words: ["the requinto, telling it",
              "the tuba, an octave down, playing the floor"],
      // the tuba does not double the tune, it thins it to its bones: every
      // third note, exactly twelve semitones under (measured: the requinto
      // runs 44..73 and the tuba 32..61). That gap is the arrangement.
      word: v => (v === 1 ? [drop(3), transpose(-12)] : []),
    },

    // PUNJABI POP — Chandigarh 2022. THE FIRST DOT THIS MAP HAS EVER HAD IN
    // SOUTH ASIA: measured against the 62 coordinates the atlas carried before
    // this round, the nearest one is SEOUL, 4,627 km away. Whether this is the
    // right South Asian
    // record to put there is a judgement and it is mine — the argument is
    // that Chandigarh is where the industry actually is, and that the music
    // is a POINT rather than a category: one vamp, no changes (`harmony:
    // "modal"`, the same word plainchant uses and for the same reason), a
    // flat-seventh mode, and the DHOL — a two-headed drum whose low hand and
    // high hand are written below as separate lanes, because this table has
    // no other way to say that one player is playing both.
    punjabipop: {
      label: "Chandigarh 2022", near: "worldfolk",
      plan: "dance", bpm: 100,
      // LINEAGE: the modal folk tune and the acoustic ensemble it came out of
      // are worldfolk's; the doubled-time hat and the modern low end are
      // trap's; the one-riddim floor with a sung hook over it is reggaeton's
      // shared method. Bhangra — the Punjabi harvest-dance tradition that IS the
      // dhol pattern below, and its own 1990s British diaspora recording
      // history — is the missing rung, and it is the direct parent.
      // LINEAGE, REPAIRED 2026-08-26, AND THIS IS THE EDGE WORLD.md §4
      // CAUGHT RUNNING. It read `worldfolk: 0.40` — Johannesburg 1986 as the
      // LARGEST declared ancestor of a Punjabi record — with
      // `wants: ["bhangra"]` written underneath it. Nobody typed that as a
      // lie: the genealogy law demanded a parent, the true parent was
      // absent, and the nearest anchor was conscripted. `worldfolk` had two
      // children and neither was African. Bhangra (Southall 1986) is built
      // and takes the weight; `worldfolk` is not reduced, it is REMOVED,
      // because the resemblance it was standing for was never a resemblance
      // to Johannesburg at all.
      parents: { bhangra: 0.45, trap: 0.35, reggaeton: 0.2 },
      wants: [],
      // THE SHEHNAI, the double-reed that answers the singer at every wedding
      // this music is played at — six zones in the registry, cast zero times
      // before now — and behind it the HARMONIUM, which is what `reed_organ`
      // is. Three entries for the same reason the corrido above has three: the
      // last one covers every remaining chair, and five shehnais is a noise
      // nobody has ever made. Like the tuba, `shenai` carries no
      // instruments.js RANGES row and degrades to its zone window; the row is
      // filed as a recipe. Measured over three seeds its one chair sits at
      // MIDI 67..76, which is the piercing register the instrument is for.
      instr: ["solo_vox", "shenai", "reed_organ"],
      drumkit: "room",
      entry: v => v, reg: v => (v === 0 ? 0 : v === 1 ? 1 : 0),
      realize: () => "line",
      harmony: "modal", mode: MODES.mixo, scale: MODES.mixo, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "octaves",
      // THE DHOL'S TWO HANDS. `k` is the bass head (the "dha"), `p` is the
      // stick on the treble head running ahead of it — the chaal. They are
      // one drummer and one instrument, and splitting them into two lanes is
      // the only way this table can say so.
      kit: { k: [1,0,0,0, 1,0,1,0, 1,0,0,0, 1,0,1,0],
             p: [0,0,1,1, 0,0,1,1, 0,0,1,1, 0,0,1,1],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { p: [0,0,1,1, 0,1,1,1, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 2600, q: 1.6, atk: .006, rel: .5, gain: .28, verb: .24 },
      words: ["the vocal, on the one vamp",
              "the shehnai, answering it an octave up"],
      word: v => (v === 1 ? [transpose(12), only("gate", rotate(4))] : []),
    },

    // MAHRAGANAT — Cairo 2021. Egyptian street-wedding music made on a
    // cracked copy of a sequencer: a cheap organ patch carrying a maqam
    // melody over a maqsoum the drum machine plays harder than any tabla
    // could. Its melodic alphabet is HIJAZ, and this table has no key for it
    // — MODES carries the eight the rest of the catalog needs, and a ninth
    // row would change every mode menu in the building (fields.js KEYMODES is
    // derived from it) for the sake of one anchor, which is a menu change
    // nobody asked for. `phrygian` is the nearest named alphabet the box can
    // say: it shares the flat second that is the whole identifying interval,
    // and it is missing the raised third. Named honestly rather than smuggled
    // in as a literal array — PROGRAM.md §2.1, a document says its alphabet
    // by NAME.
    mahraganat: {
      label: "Cairo 2021", near: "electro",
      plan: "dance", bpm: 108,
      // LINEAGE: the drum-machine floor with no live kit anywhere near it is
      // electro's; the 808 low end and the processed, pitch-corrected vocal
      // are trap's; the ornamented, non-Western modal vocal line over a fast
      // folk groove is bulgarian's — a strange-looking parent geographically
      // and the right one musically, because it is the only anchor in this
      // catalog whose melody works that way.
      //
      // AND THAT SENTENCE CONVICTED ITSELF, 2026-08-25. "A strange-looking
      // parent geographically and the right one musically" is a description
      // of a RESEMBLANCE, and a resemblance is what `near` is for; writing it
      // into `parents` said Cairo street electronic is thirty per cent Sofia
      // 1975, which nobody believes and the fit tool on `main` cannot know is
      // a figure of speech. A Balkan women's choir was standing in for "a
      // vocal that is not Western" — the same species of error as afrobeat
      // standing in for "the African one", which is why it is fixed in the
      // same round. The 0.3 goes back to the two real parents evenly, and the
      // ornamented modal vocal is where it always was: on `wants`, in its own
      // name. Shaabi, the Cairo wedding tradition this is the electrified
      // argument with, is the missing rung and the ONLY honest home for it.
      // ...AND THE MISSING RUNG WAS BUILT, 2026-08-26. The paragraph above
      // ends "Shaabi … is the missing rung and the ONLY honest home for it",
      // and Cairo 1978 is now an anchor. It takes the largest single weight
      // — mahraganat is shaabi's own maqsoum and its own wedding voice on a
      // machine — and trap and electro give back what they were holding for
      // it. The want list is empty for the first time.
      parents: { shaabi: 0.4, trap: 0.3, electro: 0.3 },
      wants: [],
      instr: ["percussive_organ", "solo_vox"],
      drumkit: "electronic",
      entry: v => v, reg: v => (v === 0 ? 0 : -1), realize: () => "line",
      harmony: "modal", mode: MODES.phrygian, scale: MODES.phrygian, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "octaves",
      // THE MAQSOUM: dum on 1, dum on the and-of-2, taks filling the rest.
      // Written on a machine kit because that is what plays it — the point of
      // the genre is that nobody is holding a drum.
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,1,0, 1,0,0,0, 0,0,1,0, 1,0,1,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      kitProb: { h: [9,6,9,6, 9,6,9,6, 9,6,9,6, 9,6,9,4] },
      fill: { s: [0,0,1,0, 1,0,0,1, 1,0,1,0, 1,1,1,1] },
      tone: { wave: "square", cut: 2800, q: 2.2, atk: .004, rel: .3, gain: .28, verb: .2 },
      words: ["the organ, the maqam line, hard and cheap",
              "the vocal, doubling it a fourth under"],
      word: v => (v === 1 ? [transpose(-5)] : []),
    },

    // BEDROOM POP — Los Angeles 2020. The decade's quietest record and its
    // most-played: a whispered vocal an inch from the microphone, a felt
    // piano, a sub that is felt rather than heard, and a kit playing almost
    // nothing. It is the one anchor in this batch that is about DYNAMICS
    // rather than rhythm: gain 0.22 — the quiet end of the table, level with
    // counterpoint and under every other record that has drums — and a
    // performance row (stress 0.14) that puts it nearer plainchant than
    // nearer soul, which is exactly why it needed a row of its own. It sits
    // in `soul` next to darkrnb rather than in `drift` with the ambient music
    // it borrows its space from, because what it inherits is R&B's phrasing;
    // the space is a production.
    bedroompop: {
      label: "Los Angeles 2020", near: "darkrnb",
      plan: "song", bpm: 92,
      // LINEAGE: the sung phrasing, the stacked answer and the minor-key
      // intimacy are R&B's; the 808 sub and the half-time kit under it are
      // trap's; the long tails and the room that never quite closes are
      // ambient's; and the fact that it is one person and their own words is
      // the singer-songwriter's. Trip-hop — the whisper-over-sub-over-nothing
      // record that got here first, in Bristol, thirty years earlier — is the
      // missing rung, and the map already has the coordinates for it.
      parents: { rnb: 0.35, trap: 0.3, ambient: 0.2, singersongwriter: 0.15 },
      wants: ["trip-hop"],
      instr: ["solo_vox", "felt_piano"],
      drumkit: "electronic",
      entry: v => v, reg: v => (v === 0 ? 0 : -1), realize: () => "line",
      roots: [0, 5, 2, 6], mode: DIATONIC, scale: DIATONIC, diatonic: true,
      artic: "legato", maxHold: 4, bassStyle: "pedal",
      // NEARLY NOTHING, and the nothing is the arrangement: two kicks, the
      // plainest backbeat in the file, and a pedal hat on the offbeats that is
      // more air than hit. No open hat, no ghost perc, no crash — every lane
      // the other 129 reach for, left empty on purpose.
      kit: { k: [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             f: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0] },
      fill: { f: [0,0,1,0, 0,1,1,0, 0,1,1,0, 1,1,1,1] },
      tone: { wave: "triangle", cut: 1800, q: 0.7, atk: .02, rel: 1.8, gain: .22, verb: .48 },
      words: ["the voice, close and almost spoken",
              "the felt piano, under it, an octave down"],
      word: v => (v === 1 ? [drop(2), transpose(-12)] : []),
    },

    // ======================================================================
    // AFRICA — added 2026-08-25
    // ======================================================================
    // Paul: "Fix the afrobeat parents and add the missing African history."
    //
    // He was right twice, the same way he was right about "now". MEASURED on
    // the catalog the morning of the change: of 124 place-year anchors FIVE
    // were on the African continent (Lagos 1971, Johannesburg 1986,
    // Johannesburg 2020, Lagos 2021, Cairo 2021) — three cities, none older
    // than 1971 — against SIX in the Afro-diaspora (Kingston ×3, Rio ×2, San
    // Juan). The continent was represented by its export and by the last five
    // years of pop, and nothing else.
    //
    // AND THE GENEALOGY RAN BACKWARDS, which is the part that is not a
    // coverage gap but a false claim. `afrobeat` declared `{ funk: 0.7 }` —
    // Lagos 1971 as a child of Cincinnati 1967, when Koola Lobitos was a
    // highlife-jazz band from 1963 and the funk arrives AFTER the 1969 Los
    // Angeles trip. `parents` is annotation here and load-bearing on `main`
    // (genealogy.js fitChild reads it and prints the residue as "the
    // invention"), so a wrong parent is not a wrong sound — it is a wrong
    // measurement of originality, and afrobeat's published 44% residue was
    // inflated by exactly the ancestor the catalog refused to hold.
    //
    // WHAT MADE THIS ROUND POSSIBLE AND WHAT IT LEFT ON THE FLOOR. Three
    // blockers were checked before a line was written, and only one of them
    // lifted:
    //   · THE METRE. `kernel.js:349` defines `six: { steps: 12 }`, but every
    //     phrase, cell and kit vector in this file is written on SIXTEEN
    //     places and `drums()` takes its bar length from the SUBJECT
    //     (kernel.js:2289), so a 12-slot bell under the 16-step seed does not
    //     become a 12/8 bar — it PHASES, and takes three bars to come round.
    //     So the 12-pulse standard bell — Ewe agbadza, the mbira's 48-pulse
    //     cycle, gnawa's lila, the sabar rhythms of mbalax — cannot be
    //     written today at all, and no instrument work changes that. Every
    //     anchor below is in four, and every one of them genuinely is: the
    //     records that define dance-band highlife, Congolese rumba, marabi,
    //     mbube, ethio-jazz, kwaito and pop-raï are 4/4 records.
    //   · THE KIT. Twelve lanes, twelve WAVs (kernel.js:1776 = DRUMFILE), and
    //     no bell, no shaker and no hand drum among them. registry-data.js
    //     PERCBANK has 24 real percussion hits and nukernel does not read it
    //     (grepped: zero references). So the house answer, set twice already —
    //     bodiddley's maracas on the hat (`genres.js:2462`) and amapiano's
    //     shekere on the rim (`:5748`) — is the answer here: bell and claves
    //     to `p`, shaker to `h`, hand drums to the toms, and the compromise
    //     named in the comment every time rather than smuggled.
    //   · THE TUNING. Everything below is 12-TET on the records themselves —
    //     Mulatu's band played a vibraphone and a Hammond, the Rail Band
    //     played electric guitars — which is why these anchors and not the
    //     mbira, the masenqo or the older gasba raï.
    //
    // DEFERRED BY NAME, so nobody re-derives it: jeliya (no honest kora — the
    // GM harp is a soft orchestral pedal harp with no attack, and `koto` would
    // be a Japanese zither wearing a Malian name); jùjú (the dùndún bends
    // pitch and `melodic_tom` cannot, and a talking drum that cannot talk is
    // not one); taarab (Zanzibar 1928, Siti binti Saad — three arguable
    // stand-ins in one cast is a costume even when each defends itself);
    // gnawa and mbalax (two blockers each); chimurenga (Harare 1977 has no
    // tuning problem at all once Mapfumo puts the mbira on guitars — it is
    // metre-blocked alone, and it is the first thing to build the day a
    // twelve-step seed exists). And one PERMANENT limitation, which is not a
    // queue item: melody that follows lexical tone cannot be said here,
    // because `deg` is "SIGNED and alphabet-free… never an absolute pitch"
    // (kernel.js:8) and that is precisely the property that stops a text
    // constraining it.

    // ZEMA — Aksum 540, and it is now the oldest record in the catalog by
    // sixty years. The chant of the Ethiopian Orthodox Täwaḥədo Church:
    // unaccompanied, pentatonic, sung by two half-choirs answering each other,
    // and notated with the mələkkət — signs that name whole melodic formulae
    // rather than pitches.
    //
    // THE YEAR IS A TRADITIONAL ATTRIBUTION AND MUST BE SAID TO BE ONE. The
    // tradition gives zema to Saint Yared (c. 505–571) at Aksum in the reign
    // of Gebre Meskel; scholarship does not confirm it, and the notated
    // manuscripts are 16th-century. That is the SAME KIND OF CLAIM ON THE
    // SAME KIND OF EVIDENCE as "Rome 600", which attributes the chant to
    // Gregory I (d. 604) when the repertory as we have it is 8th–9th century
    // and Frankish. If the catalog will say one it must be willing to say the
    // other, and the honest alternative — Aksum 1550, the manuscript date —
    // would leave Rome sitting ten centuries earlier on identical evidence,
    // which is a worse error than the one it avoids.
    //
    // WHAT SEPARATES IT FROM ROME 600, in fields: the ALPHABET. Chant in this
    // table reads its subject through DIATONIC — seven notes, 1.71 semitones a
    // step, and the whole grammar is "move by one" — where zema reads through
    // `majpent`, five notes and 2.4 semitones a step, so the same contour
    // MOVES half again as far. Ethiopian sacred chant is described as
    // pentatonic; its three modes (gəʿəz, ʿəzl, araray) have no interval sets
    // this file can source, and they are NOT the secular qenet, so the anchor
    // claims ONE pentatonic and does not claim to distinguish them. Second
    // difference: Rome's two voices sing together an octave apart, and these
    // two ANSWER — `entry: v => v * 2` is the antiphony, which is what the
    // two halves of a däbtära choir actually do.
    zema: {
      label: "Aksum 540", rate: 0.5, near: "gregorian",
      plan: "arc", bpm: 72,
      // LINEAGE: a genuine ROOT, and the comment must say which kind. Not
      // "the ancestors are unbuilt" — the ancestor is a pre-catalog Eastern
      // Mediterranean liturgical practice nobody can place-and-year, the same
      // honest emptiness gregorian declares. It is NOT a child of Rome 600
      // and must never be written as one: they are two churches, and the
      // Frankish codification is two centuries the other side of this label.
      // ...AND THE ARRANGER NOW HONOURS THAT, which it did not (Paul,
      // 2026-08-25: "fix the zema organ thing"). This entry said the sentence
      // above while every seed of the composed record hired a church organ or
      // a harpsichord, and two of three hired a voice literally named
      // `gregorian` — the genealogy was right HERE and undone one layer down
      // by a guest list in the composer. compose.js `unaccompanied` and
      // `eraOK` are where the claim is enforced, and they enforce it off these
      // very fields: no kit, no bass, an `instr` that is nothing but voices,
      // and a year sixty earlier than Rome's.
      parents: {},
      wants: [],
      instr: "ahh_choir",
      entry: v => v * 2, reg: v => -v, realize: () => "line",
      kit: {}, nobass: true, harmony: "modal",
      intro: "solo",                 // the mergéta gives the line out alone
      mode: MODES.ionian, scale: SCALES.majpent,
      artic: "legato", incClamp: 2,
      // WHAT IS DELIBERATELY NOT CAST, which is not a gap but the music: the
      // begena (the ten-string lyre with the buzzing bridge) has no honest
      // stand-in — a GM harp shares nothing with it but strings — and the
      // tsenatsil and the kebero belong to aqʷaqʷam, the danced chant, not to
      // plain zema. Zema is properly unaccompanied and that is why `kit: {}`
      // is the truest line in this entry.
      tone: { wave: "triangle", cut: 1900, q: 0.7, atk: .11, rel: 2.4, gain: .25, verb: .8,
              // WHO SINGS: low, pressed, straight — the same absence of wobble
              // that makes plainchant not opera, taken further down and given
              // two beats a syllable, because a mələkkət sign stretches one
              // syllable across a whole formula
              mouth: MOUTHS.zemachant },
      words: ["the first half-choir", "the second, answering two bars later"],
      word: () => [],
    },

    // HIGHLIFE — Accra 1957, and it pays three debts this file had already
    // booked. Dance-band highlife is a West African brass-and-guitar orchestra
    // playing over a Cuban timeline: E.T. Mensah & the Tempos, horns in
    // parallel, a guitar picking thirds, and a hand-percussion layer that
    // never stops.
    //
    // THE YEAR is Ghana's independence in March 1957 and the peak of the
    // Tempos' reach across the coast — a decade's centre with a real event in
    // it, NOT a single record. (Louis Armstrong sat in with the Tempos in
    // Accra, but that was May 1956; the year here is not hanging on him.)
    //
    // WHAT SEPARATES IT FROM LAGOS 1971 — its own child — is the HARMONY and
    // the CLOCK. Afrobeat is `harmony: "modal"`, one dorian chord you stay
    // inside for eight bars at 108. Highlife MOVES: I–IV–V–I every four bars
    // in ionian at 120, because it is dance-band music for couples and a
    // dance band plays changes. The guitar in parallel thirds is the other
    // tell, and it puts this anchor in a small and specific company: the only
    // other records here that lock two voices at ONE fixed diatonic interval
    // for the whole song are the Beatles' thirds, Chuck Berry's fourths and
    // the hymnal's four parallel parts — every other pair in the table is
    // rotated, masked or thinned against each other rather than glued.
    highlife: {
      label: "Accra 1957", voices: 3, near: "afrobeat",
      plan: "song", bpm: 120,
      // LINEAGE: the catalog's first African ROOT, and honestly so. Dance-band
      // highlife is coastal adaha brass, palm-wine guitar, the Afro-Cuban 78s
      // that circulated in West Africa, and the SWING big band — and not one
      // of those four is here. `jazz` is New York 1945, which is bebop: the
      // wrong music twelve years early, and its own `wants` admits it is
      // missing swing. Reaching for it in the bossa style would be reaching
      // for the nearest anchor rather than the right one.
      // LINEAGE, REWRITTEN 2026-08-26 — and the paragraph above is kept
      // rather than deleted, because it was right on the day it was written
      // and it is the reason this repair was possible. It said: "the
      // catalog's first African ROOT, and honestly so. Dance-band highlife
      // is coastal adaha brass, palm-wine guitar, the Afro-Cuban 78s that
      // circulated in West Africa, and the SWING big band — and not one of
      // those four is here." THREE OF THE FOUR ARE NOW HERE. `wants` was a
      // specification and the world round built to it: palmwine (Freetown
      // 1950), son (Havana 1928) and swing (Kansas City 1938). Accra 1957
      // stops being a root, and the one thing still missing — the adaha
      // brass band of the coastal towns — stays named.
      parents: { palmwine: 0.4, son: 0.3, swing: 0.3 },
      wants: ["adaha brass band"],
      // A HOLLOW-BODY, not a solid one: `jazz_guitar` is closer to a 1950s
      // West African dance band than `clean_guitar`'s bright electric, and the
      // two horns are the Tempos' own front line.
      instr: ["jazz_guitar", "trumpet", "tenor_sax"],
      drumkit: "jazz",
      entry: v => v * 2, reg: v => v - 1, realize: () => "line",
      roots: [0, 3, 4, 0], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "walk",
      // THE TIMELINE IS THE RIM, and it is the most interesting fact about
      // this anchor: the figure on `p` is the clave family, and dance-band
      // highlife took it from the Cuban 78s the Tempos were covering — which
      // had taken it from West Africa in the first place. It is written as
      // ONE bar here (the three-side in the first eight steps, the two-side in
      // the second), where Kinshasa 1960 below spends two bars on the same
      // idea; that difference is real and it is the two anchors' clearest
      // separation in the kit.
      //
      // AND THE MARACAS ARE THE HAT LANE AGAIN — bodiddley's compromise, said
      // out loud a second time: there is no shaker among the twelve extracted
      // drums, so sixteen closed hats carry it and `kitVel` carries the hand.
      // The claps are not a stand-in at all; they are handclaps.
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,0,1, 0,0,1,0, 0,0,1,0, 1,0,0,0],
             c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      kitVel: { h: [9,4,6,4, 8,4,6,4, 9,4,6,4, 8,4,6,5] },
      fill: { p: [1,0,0,1, 0,0,1,0, 1,0,1,0, 1,1,0,1] },
      tone: { wave: "triangle", cut: 2500, q: 1.0, atk: .006, rel: .6, gain: .27, verb: .28 },
      words: ["the guitar, picking the tune",
              "the trumpet, a third above it",
              "the tenor, answering late"],
      word: v => (v === 1 ? [transpose(2)] : v === 2 ? [rotate(4), drop(2)] : []),
    },

    // MARABI — Johannesburg 1935. The shebeen keyboard music of the
    // slumyards: a pedal organ over one four-bar chord cycle that never ends,
    // a tin of pebbles keeping time, and a pennywhistle on top.
    //
    // THE YEAR NEEDS CARE AND THE COMMENT IS WHERE IT GOES. The music is
    // 1920s and it was ALMOST NEVER RECORDED — it was played in yards nobody
    // brought a machine to. It reaches a disc through the mid-1930s African
    // dance bands (the Jazz Maniacs, the Merry Blackbirds), and 1935 is that
    // moment. The music is 1920s; the recording is 1935; the label names the
    // recording, and a reader is entitled to know which.
    //
    // THE HIGHEST STRUCTURAL VALUE ON THIS PAGE, because marabi IS a harmonic
    // object rather than a percussion one, and this box computes harmony far
    // better than it computes hands. The identity is the endlessly repeating
    // I–IV–I⁶₄–V, and that six-four is the FIRST use of `inv` anywhere in the
    // catalog: 124 anchors, not one inversion between them until this line.
    // `inv: 2` puts the fifth in the bass (kernel.js:2574 — "an inversion puts
    // the third under the band"), which is exactly what makes a marabi cycle
    // lean forward into its V instead of sitting down on its I.
    marabi: {
      label: "Johannesburg 1935", voices: 3, near: "gospel",
      // a floor: the cycle is the form, and it does not go anywhere
      plan: "dance", bpm: 104,
      // LINEAGE: a root under protest, and the protest is the whole history —
      // marabi is Sotho and Zulu vocal cycles, American 78s heard through a
      // shebeen door, and kwela's own street ancestry, none of which is here.
      parents: {},
      wants: ["kwela", "american 78s", "sotho-zulu vocal cycle"],
      // THE CAST IS UNUSUALLY EXACT. The marabi instrument was the PEDAL
      // ORGAN and `reed_organ` is one (six zones, every file on disk —
      // confirmed at genres.js:5713 when punjabipop's harmonium wanted it).
      // The upright is an upright. The one STAND-IN is `recorder` for the
      // pennywhistle: right family — both are fipple flutes, which is why not
      // `whistle`, GM's recording of a person whistling — and what is lost is
      // the pennywhistle's shrill overblown top and its bent notes, which is
      // most of what a kwela player does with it.
      instr: ["reed_organ", "upright_piano", "recorder"],
      drumkit: "brush",
      entry: v => v, reg: v => (v === 0 ? -1 : v - 1),
      realize: v => (v === 0 ? "pad" : "line"),
      part: ["pad", "lead", "counter"],
      roots: [0, 3, 0, 4], mode: MODES.ionian,
      scale: SCALES.major, diatonic: true,
      prog: [{ d: 0 }, { d: 3 }, { d: 0, inv: 2 }, { d: 4 }],
      artic: "legato", maxHold: 4,
      // THE BASS IS AN ARGUMENT ABOUT WHICH YEAR THIS IS. In a 1920s yard the
      // bass is the organist's left hand and there is no bass player; on the
      // 1935 disc it is a dance band and there is one. The label names the
      // recording, so the record gets its upright.
      bassStyle: "walk",
      // THE DRUMS ARE NOT THE IDENTITY, and the kit says so: the thinnest
      // hand in this batch, brushes, and the tin of pebbles on the hat lane
      // (the same compromise as the maracas above, one country south).
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      kitVel: { h: [8,4,6,4, 8,4,6,4, 8,4,6,4, 8,4,6,5] },
      fill: { s: [0,0,0,0, 1,0,0,0, 0,0,1,0, 1,0,1,0] },
      tone: { wave: "triangle", cut: 2200, q: 0.9, atk: .02, rel: 1.1, gain: .26, verb: .34 },
      words: ["the pedal organ, holding the cycle",
              "the upright, the vamp on top of it",
              "the pennywhistle, an octave up and late"],
      word: v => (v === 1 ? [rotate(2)] : v === 2 ? [transpose(7), drop(2)] : []),
    },

    // MBUBE — Johannesburg 1939. Solomon Linda's Original Evening Birds cut
    // "Mbube" for Gallo, a documented recording and the most solid year on
    // this page; the record gave the style its name. (The brief said Durban:
    // Linda was Zulu, from Msinga in Natal, and the group worked and recorded
    // in Johannesburg. Isicathamiya — the softer, tiptoed later style — is a
    // different sound and a different decade, and building both would be
    // building one twice.)
    //
    // THE FOURTH UNACCOMPANIED SUNG ANCHOR, after Rome 600, Paris 1200 and
    // London 1570 — and the first outside Europe. `nobass: true` is
    // load-bearing rather than decorative here: in mbube the bass SINGERS are
    // the bass, and letting the bass chair pick up its default upright
    // (instruments.js BASS_INSTR) would put an instrument on a record that
    // has none. `kit: {}` for the same reason: the stamping belongs to
    // isicathamiya, not to 1939. THE ARRANGER READS EXACTLY THOSE TWO FIELDS
    // NOW (compose.js `unaccompanied`, 2026-08-25, "fix the zema organ
    // thing"): until it did, this record took a harpsichord on all three
    // seeds — the same instrument-on-a-record-that-has-none the two sentences
    // above refuse, arriving through a guest list instead of through a chair.
    //
    // WHAT SEPARATES IT FROM BOSTON 1831, its declared parent: hymn's four
    // voices move in exact homophony and its bottom part is an ORGAN, because
    // at MIDI 7–38 it is nobody's part to sing. Mbube's bottom part is three
    // men, its lead is one woman's worth of freedom over a block that moves at
    // half the lead's rate (`drop(2)` on voices 1–3), and it runs at 92 where
    // a chorale runs at 72. And it shares its four-bar cycle — I–IV–I⁶₄–V —
    // with marabi four years earlier and one suburb over, which is the
    // correlation worth writing in data rather than in prose.
    mbube: {
      label: "Johannesburg 1939", voices: 4, near: "hymn",
      plan: "song", bpm: 92,
      // LINEAGE: `{ hymn: 1 }` UNDER PROTEST, in the bossa house style, and
      // the protest said out loud: mission four-part hymnody is a real,
      // documented and major input to South African choral music and Boston
      // 1831 is in the catalog — but the ZULU side is the larger half, and it
      // is the half this file cannot name. The weight normalises to 1 over
      // what exists, which is not the same as saying it is all of it.
      parents: { hymn: 1 },
      wants: ["zulu wedding song", "ngoma"],
      instr: ["solo_vox", "ahh_choir"],
      entry: () => 0, reg: v => [1, 0, -2, -3][v], realize: () => "line",
      kit: {}, nobass: true,
      roots: [0, 3, 0, 4], mode: MODES.ionian,
      scale: SCALES.major, diatonic: true,
      prog: [{ d: 0 }, { d: 3 }, { d: 0, inv: 2 }, { d: 4, q: "7" }],
      artic: "legato", maxHold: 4,
      tone: { wave: "triangle", cut: 2300, q: 0.8, atk: .04, rel: 1.4, gain: .26, verb: .42,
              // WHO SINGS: the bass throat, close and resonant, almost no
              // wobble and almost no air — a room of men at one microphone in
              // 1939, ragged on purpose (blend 0.75, looser than every mouth
              // here but the three American church-and-wash ones), because
              // they are a group and not a section
              mouth: MOUTHS.mbubestack },
      words: ["the lead, over the top", "the top of the block",
              "the middle of it", "the bass singers, who are the bass"],
      word: v => (v === 0 ? [] : [transpose([0, -2, -4, -7][v]), drop(2)]),
    },

    // ETHIO-JAZZ — Addis Ababa 1969. Mulatu Astatke's vibraphone over a
    // Hammond and a tenor, an Ethiopian pentatonic mode on a jazz rhythm
    // section, and the darkest-sounding bright scale in the catalog.
    //
    // THE YEAR is an institutional event with the music on the other side of
    // it: Amha Eshete founded Amha Records in Addis Ababa in 1969 and broke
    // the Imperial government's recording monopoly, which is the moment the
    // scene could record at all. (1972 and *Mulatu of Ethiopia* is the other
    // defensible label; this one names the door opening.)
    //
    // NOTHING HERE IS WEARING A COSTUME, which is why it was built before the
    // harder ones: the VIBRAPHONE is Mulatu's own instrument and not a
    // stand-in for anything, and the tenor is the tenor. ONE substitution,
    // and it is a measured one rather than a taste one: the sessions ran on a
    // Hammond or a Farfisa, and `drawbarorgan` is the id that names that
    // sound — but it is ONE sample rooted at MIDI 96, which gospel measured
    // at genres.js:1739 as "one C7 recording dragged three and a half octaves
    // down… a spectral centroid of 249 Hz". `percussive_organ` is the same
    // extraction WITH the percussion stop and six zones, and the percussion
    // stop is on more of these sides than off it.
    //
    // THE MODE, answered as carefully as the sources allow. `tizita` is an
    // anhemitonic major pentatonic — 1 2 3 5 6 — which is `SCALES.majpent`
    // EXACTLY, so no new SCALES row is needed and none was guessed. The other
    // qenet (bati, ambassel, anchihoy) have no interval sets this repo can
    // source and none are invented here. And the honesty argument is stronger
    // than "it approximately fits": on a masenqo the intonation is inflected
    // and 12-TET would be a lie, but Mulatu's band played a vibraphone, an
    // electric organ and valved horns — for THIS record 12-TET is not an
    // approximation of the practice, it is the practice.
    //
    // AGAINST NEW YORK 1945, its largest parent: same horn writing, opposite
    // harmony. Bebop is a cycle of changes at 144; this is `harmony: "modal"`
    // — one mixolydian vamp, no changes — at 94, with the head doubled an
    // octave down rather than harmonised. On a five-note alphabet an octave IS
    // `transpose(-5)`, which is why the tenor's word looks like a fifth and
    // is not one. And it is NOT pointed at Aksum 540: church chant is not the
    // parent of a secular vibraphone record, and papering fourteen centuries
    // and one sacred/secular boundary over with an edge is exactly the move
    // this round exists to stop.
    ethiojazz: {
      label: "Addis Ababa 1969", bars: 8, voices: 3, near: "jazz",
      // an arc: a groove you stay inside while the horn arrives
      plan: "arc", bpm: 94,
      // LINEAGE: Mulatu trained in Britain and at Berklee and the band is a
      // jazz/Latin rhythm section under jazz horn writing; the one-chord
      // modal groove and the kit's discipline are funk's, which he heard the
      // same years everyone else did. Azmari song — the Ethiopian secular
      // tradition the modal half comes from — has no anchor and would need a
      // masenqo and a krar, neither of which the registry has.
      parents: { jazz: 0.6, funk: 0.4 },
      wants: ["azmari song"],
      instr: ["vibraphone", "percussive_organ", "tenor_sax"],
      drumkit: "acoustic",
      entry: v => v * 2, reg: v => (v === 1 ? -1 : v === 2 ? -1 : 0),
      realize: v => (v === 1 ? "pad" : "line"),
      part: ["lead", "pad", "counter"],
      harmony: "modal", mode: MODES.mixo, scale: SCALES.majpent,
      artic: "legato", maxHold: 4,
      // A LATIN-LEANING BAND. The bell figure is the rim, the congas are the
      // toms — a real struck membrane by family, wrong drum and right physics
      // — and beside afrobeat's two drummers this is the only other anchor
      // where the tom lanes carry a hand rather than a fill.
      bassGrid: [1,0,0,1, 0,0,1,0, 0,0,1,0, 0,1,0,0],
      kit: { k: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,0,1, 0,0,1,0, 0,0,1,0, 1,0,0,0],
             m: [0,0,1,0, 0,0,0,0, 1,0,0,0, 0,0,1,0],
             l: [0,0,0,0, 0,1,0,0, 0,0,0,1, 0,0,0,0],
             r: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { m: [0,0,1,0, 0,1,0,0, 1,0,1,0, 0,1,1,0] },
      tone: { wave: "triangle", cut: 2300, q: 1.1, atk: .008, rel: 1.4, gain: .27, verb: .36 },
      words: ["the vibraphone, the head",
              "the organ, holding the one chord under it",
              "the tenor, doubling the head an octave down"],
      word: v => (v === 1 ? [drop(2)] : v === 2 ? [transpose(-5)] : []),
    },

    // CONGOLESE RUMBA — Kinshasa 1960. Two electric guitars interlocking over
    // a clave, a tenor on the head, and a form that opens out into the
    // SEBENE — the section where the singers stop and the guitars take the
    // record over, which is the genre's whole architecture.
    //
    // THE YEAR is "Indépendance Cha Cha", Grand Kallé et l'African Jazz, cut
    // in 1960 — the most-cited record in the tradition and as datable as
    // mbube. THE CITY was Léopoldville in 1960 and became Kinshasa in 1966,
    // and the label says Kinshasa anyway: atlas.js:98 enforces ONE SPELLING
    // PER PLACE, and a second name for the same coordinates would put two
    // dots where there is one city. The old name belongs in a comment, which
    // is where it now is.
    //
    // THE FIFTH ANCHOR TO USE `kits`, and the first with a musical reason
    // that needs it: the clave is a TWO-BAR figure — three strokes in one bar
    // and two in the next — and a one-bar kit cannot say so. Accra 1957 above
    // compresses both halves into sixteen steps, which is a real and
    // different thing; this one spends the two bars the players spend. That
    // is the two anchors' clearest separation, and it is in the kit rather
    // than in the prose.
    //
    // AND THE CLAVE HERE IS NOT STANDING IN FOR AN AFRICAN BELL. It is
    // standing in for a CUBAN clave, which is what these players were
    // literally copying off the GV-series 78s sold in Léopoldville from the
    // late thirties — the rim lane is the compromise, the figure is not.
    congorumba: {
      label: "Kinshasa 1960", bars: 8, voices: 3, near: "highlife",
      plan: "arc", bpm: 116,
      // LINEAGE: a root, and both its parents are outside the catalog —
      // the Cuban son of the GV 78s, re-heard by Congolese guitarists over
      // the local maringa. Neither is here, and pointing this at `bossa` or
      // `jazz` because they are the nearest Latin-adjacent anchors would be
      // the resemblance-as-ancestry move this round is undoing.
      parents: {},
      wants: ["afro-cuban son", "maringa"],
      // THE SAME INSTRUMENT TWICE, on purpose: mi-solo and rhythm are two
      // guitars with one tone, and `instr` is read per voice
      // (instruments.js:36), so casting `clean_guitar` twice is the natural
      // spelling of a fact rather than a duplication.
      instr: ["clean_guitar", "clean_guitar", "tenor_sax"],
      drumkit: "acoustic",
      entry: v => v * 2, reg: v => v - 1, realize: () => "line",
      roots: [0, 5, 3, 4], mode: MODES.ionian,
      scale: MODES.ionian, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "eighths",
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,0,1, 0,0,1,0, 0,0,0,0, 0,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      // THE CLAVE, ACROSS ITS TWO BARS: the three-side, then the two-side.
      kits: [
        { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
          s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
          p: [1,0,0,1, 0,0,1,0, 0,0,0,0, 0,0,0,0],
          h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
        { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
          s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
          p: [0,0,0,0, 1,0,0,0, 0,0,1,0, 0,0,0,0],
          h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      ],
      fill: { h: [1,1,1,0, 1,1,1,0, 1,1,1,0, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2600, q: 1.0, atk: .005, rel: .5, gain: .27, verb: .3 },
      words: ["the mi-solo, and in the sebene it never stops",
              "the rhythm guitar, in the holes the mi-solo leaves",
              "the tenor, the head"],
      // THE SEBENE IS SAID IN DEVELOPMENT, NOT IN THE KIT — `word(v, s)` is
      // indexed by SECTION (AXES.md: Form comes before Development), so the
      // guitars change job when the record does. On the odd sections the
      // mi-solo fills every other step and stops being a part and starts
      // being the record; the rhythm guitar is masked to the complement of
      // the mi-solo's own gate throughout, which is what interlocking means
      // and what makes the two guitars one instrument with four hands.
      word: (v, s) => (v === 0 ? (s % 2 ? [fill(2)] : [])
                     : v === 1 ? [only("gate", complement("gate")), transpose(2)]
                               : [rotate(8), drop(2)]),
    },

    // KWAITO — Johannesburg 1994, and it pays a debt the file booked in its
    // own hand: `amapiano.wants` said ["kwaito"] and its comment called it
    // "the missing rung… the Johannesburg scene that slowed house down in the
    // first place, thirty years before this one slowed it again". This closes
    // it, and amapiano's afrobeat weight moves here where it belonged.
    //
    // THE YEAR is a decade's centre plus an event and not a record: kwaito's
    // window is 1993–96 (Boom Shaka's *It's About Time*, Arthur Mafokate's
    // "Kaffir"), and 1994 is the middle of it and the first democratic
    // election. Said plainly because the catalog's credibility rests on a
    // reader being able to tell a dated record from a dated decade.
    //
    // THE NUMBER THAT IS THE GENRE: 105. Every four-on-the-floor kick in the
    // `club` family is at 122 or above — house 122, acid 124, bleeptechno
    // 124, kpop 128, techno 132, ebm 134 — and this one is seventeen under
    // the slowest of them. Kwaito is house with the tempo taken out of it,
    // and everything else about the record follows the tempo: the bass has
    // room to be syncopated, the chant sits behind the beat instead of on it,
    // and the same offbeat hat that reads as urgency at 128 reads as swagger
    // here.
    kwaito: {
      label: "Johannesburg 1994", near: "house",
      plan: "dance", bpm: 105,
      // LINEAGE: the four-on-the-floor machine, the loop that is the form and
      // the pads over it are Chicago's, at five-sixths of the speed; the
      // bassline habit and the cycle underneath come down the mbaqanga line
      // from the shebeen organ — which is what the marabi weight means, and
      // it is in the data below as well as in this sentence.
      // ...and mbaqanga arrived 2026-08-26 off this anchor's own want list
      // too. Johannesburg 1964 is the township groove kwaito slowed down and
      // put on a 909, and it is a nearer ancestor than Johannesburg 1935 by
      // thirty years; marabi keeps a smaller weight because the endless
      // cycle is still marabi's idea. `bubblegum` stays unbuilt.
      parents: { house: 0.5, mbaqanga: 0.3, marabi: 0.2 },
      wants: ["bubblegum"],
      instr: ["polysynth", "rhodes_ep"],
      drumkit: "tr909",
      entry: v => v, reg: v => (v === 0 ? 0 : -1),
      realize: v => (v === 0 ? "pad" : "line"),
      part: ["stab", "lead"],
      // MARABI'S OWN CYCLE, READ MINOR. The roots are Johannesburg 1935's
      // I–IV–I–V exactly; the mode is dorian instead of ionian. Sixty years
      // and one mode apart, which is a more useful thing for the fit tool to
      // measure than a sentence claiming influence.
      roots: [0, 3, 0, 4], mode: MODES.dorian,
      scale: MODES.dorian, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "octaves",
      bassGrid: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             o: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             p: [0,0,0,1, 0,0,0,0, 0,1,0,0, 0,0,1,0] },
      fill: { p: [0,0,1,1, 0,1,0,0, 0,1,0,1, 1,0,1,1] },
      tone: { wave: "sawtooth", cut: 2000, q: 1.4, atk: .01, rel: .7, gain: .28, verb: .24 },
      words: ["the stab, on the cycle", "the lead, chanted over it"],
      word: v => (v === 1 ? [drop(2), rotate(2)] : []),
    },

    // MANDE GUITAR — Bamako 1970. The Rail Band at the Buffet Hôtel de la
    // Gare: state-sponsored, resident, and staffed by jelis — Salif Keïta and
    // Mory Kanté — moving jeliya onto electric guitars and horns themselves.
    // Long cyclic vamps, two guitars in an interlocking ostinato, a heptatonic
    // mode, no changes.
    //
    // NAMED FOR THE BAND AND NOT FOR THE TRADITION, deliberately: the anchor
    // is a guitar band and the key must not claim jeliya, which is booked on
    // `wants` in its own name. AND THE EMPIRE IS NOT THE LABEL. An anchor is a
    // correlated point across eight axes including Sound and Performance, and
    // nobody can state the 13th-century values of those for Mande music: the
    // transmission is oral, so a "Niani 1235" label would be a year attached
    // to a sound invented in 2026. Rome 600 gets away with its attribution
    // because chant came down NOTATED; this would not.
    //
    // THE KORA IS NOT HERE AND THAT IS THE POINT. `harp` is family-right (a
    // harp-lute is a harp) and timbre-wrong — GM's soft orchestral pedal harp
    // has no attack and no ostinato bite — and `koto` would be a Japanese
    // zither wearing a Malian name. Two of the three parts WOULD cast
    // honestly (`marimba` for balafon is close; `banjo` for ngoni may be the
    // most defensible stand-in in this file, since the ngoni is the banjo's
    // ancestor) — but the kora is the one people mean, so jeliya waits for a
    // sample and Mali reaches the map through the band that was on tape.
    //
    // AGAINST KINSHASA 1960, its nearest neighbour and the other two-guitar
    // anchor: Kinshasa CYCLES (I–vi–IV–V, `harmony: "cycle"`) and Bamako
    // VAMPS (`harmony: "modal"`, one mixolydian chord for the whole record) —
    // and the second guitar rotates by SIX rather than by four or eight, so
    // its figure lands off the first's everywhere but one step of the bar.
    // An even rotation cannot say interlocking; it just says doubled.
    mandeguitar: {
      label: "Bamako 1970", bars: 8, voices: 3, near: "congorumba",
      plan: "arc", bpm: 112,
      // LINEAGE: a root under protest. Jeliya — the hereditary praise-singing
      // the whole band is a continuation of — is the parent, and it is not in
      // the catalog; the Afro-Cuban son the Malian orchestras played beside it
      // is the other, and it is not here either.
      parents: {},
      wants: ["jeliya", "afro-cuban son"],
      instr: ["jazz_guitar", "clean_guitar", "trumpet"],
      drumkit: "acoustic",
      entry: v => v * 2, reg: v => v - 1, realize: () => "line",
      harmony: "modal", mode: MODES.mixo, scale: MODES.mixo, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "eighths",
      bassGrid: [1,0,0,0, 0,0,1,0, 0,1,0,0, 1,0,0,0],
      kit: { k: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,1,0, 0,1,0,0, 1,0,1,0, 0,1,0,0],
             h: [1,1,0,1, 1,1,0,1, 1,1,0,1, 1,1,0,1] },
      kitVel: { h: [9,4,0,5, 7,4,0,5, 9,4,0,5, 7,4,0,6] },
      fill: { p: [1,0,1,0, 1,1,0,1, 1,0,1,0, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2500, q: 1.0, atk: .005, rel: .6, gain: .27, verb: .3 },
      words: ["the first guitar, the ostinato",
              "the second, six steps off it",
              "the trumpet, the praise line"],
      word: v => (v === 1 ? [rotate(6)] : v === 2 ? [transpose(2), drop(3)] : []),
    },

    // RAÏ — Oran 1985. Pop-raï: a cheap drum machine, a synth, an accordion
    // and a trumpet under a singer, which is what the records actually are
    // and not a compromise this file arrived at.
    //
    // THE YEAR is the first officially sanctioned raï festival in Oran, 1985
    // — the moment the music became public rather than semi-clandestine.
    // (Bobigny 1988 is the other candidate and it is the diaspora; the
    // catalog needed the Algerian dot.)
    //
    // AND THE OLDER RAÏ IS A DIFFERENT ANCHOR AND IS NOT BUILDABLE. Bedoui
    // and cheikha raï — Cheikha Rimitti — is gasba and gallal with a
    // microtonal vocal: no instruments for it here and the wrong tuning
    // besides. This anchor is 1985 and claims 1985 only.
    //
    // THE MODE, and the caveat is the honest half of the entry. Pop-raï sits
    // largely in a 12-TET minor or in HIJAZ [0,1,4,5,7,8,10], which this
    // table has no key for — and mahraganat already argued that case and lost
    // it on purpose (genres.js:6001): a ninth MODES row changes every mode
    // menu in the building, because fields.js KEYMODES is derived from it,
    // for the sake of one anchor. There are two anchors now and the argument
    // has not changed enough to move; `phrygian` is the nearest NAMED
    // alphabet, it carries the flat second that is the identifying interval,
    // and it is missing the raised third. Named honestly rather than smuggled
    // in as a literal array (PROGRAM.md §2.1). Raï also uses sika and saba,
    // which have neutral intervals and are NOT 12-TET at all: this anchor
    // claims the 12-TET half of the repertory and no more of it.
    //
    // ONE INSTRUMENT IS NOT A STAND-IN AND ONE IS. The ACCORDION is genuinely
    // a pop-raï instrument, not a substitute for something absent. The
    // DERBOUKA is a stand-in: its dum and its tak are voiced across `k`, `s`
    // and `p` on a cr78, and what is lost is the goblet drum's pitch drop
    // between the two strokes and the finger rolls between them. What is NOT
    // lost is that a cheap early-eighties machine is exactly what those
    // records used, which is why the kit is cr78 and not `acoustic`.
    rai: {
      label: "Oran 1985", voices: 3, near: "synthpop",
      plan: "song", bpm: 116,
      // LINEAGE: `{ synthpop: 0.5, disco: 0.5 }` UNDER PROTEST, and the
      // protest is that these two are the AUDIBLE half and not the whole. The
      // drum machine, the synth brass and the four-square floor genuinely are
      // half of what a 1985 raï record is. The other half — the Oranese
      // cheikha tradition the vocal comes from and the Egyptian film
      // orchestra the horn writing comes from — has no anchor, so the weight
      // normalises to 1 over what exists, the way bossa's does.
      parents: { synthpop: 0.5, disco: 0.5 },
      wants: ["bedoui raï", "egyptian film orchestra"],
      instr: ["accordion", "polysynth", "trumpet"],
      drumkit: "cr78",
      entry: v => v, reg: v => (v === 1 ? -1 : v === 2 ? 1 : 0),
      realize: v => (v === 1 ? "pad" : "line"),
      part: ["lead", "pad", "counter"],
      harmony: "modal", mode: MODES.phrygian, scale: MODES.phrygian, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "octaves",
      // THE DERBOUKA, VOICED ACROSS THREE LANES: dum on the low kick, tak on
      // the rim, and the snare taking the answering stroke — one player and
      // one drum, which this table has no other way to say (punjabipop's dhol
      // is written the same way one round earlier, genres.js:5975).
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,1,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [0,0,1,1, 0,1,0,0, 0,0,1,1, 0,1,0,1],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { p: [0,0,1,1, 0,1,1,0, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 2700, q: 1.5, atk: .006, rel: .6, gain: .28, verb: .26 },
      words: ["the accordion, the vocal line's own tune",
              "the synth, holding under it",
              "the trumpet, answering an octave up"],
      word: v => (v === 1 ? [drop(2)] : v === 2 ? [transpose(7), rotate(4), drop(2)] : []),
    },
    /* ====================================================================
       FILL IN THE WORLD — TIER 1, the sixty anchors the box can honestly
       play today (Paul, 2026-08-26: "Fill in lots of world historical
       genres including non western stuff over a long period of time")
       ====================================================================

       MEASURED THE MORNING OF THE CHANGE, over the 133 place-year anchors
       the atlas holds: 107 of them (80.5%) are Western Europe or North
       America, the USA and the UK hold 88, and outside Europe the catalog
       knew the world almost entirely through the record industry. WORLD.md
       §4 wrote that down and called it "the catalog knows one deep tradition
       and knows the rest of the world only through the record industry".

       WHAT MADE THIS ROUND SAFE, AND DID NOT EXIST THE WEEK BEFORE. Three
       laws landed with the African slate on 2026-08-25 and every anchor
       below inherits them without saying anything:
         · the UNACCOMPANIED law (compose.js) — DERIVED from `kit`, `nobass`
           and `instr`, not a name list, so `sacredharp` below joins
           {gregorian, spem, organum, zema, mbube} the moment it is written
           and hires nobody, with nothing here to declare;
         · the ERA law for players AND instruments — a record may not hire a
           guest from after its own year, nor seat an instrument the catalog
           first hears later;
         · INSTR_YEAR, EXTRACTED as the earliest year any dated anchor
           claims each id. That is why a date below is never free: a label is
           also a CLAIM ABOUT AN INSTRUMENT, and writing an early one lowers
           the floor for everything that plays it. MEASURED, this round moves
           exactly ten floors and adds eight ids that had none —
             steel_string_guitar 1956 -> 1900 (a choro cavaquinho)
             flute               1958 -> 1900 (a choro flute)
             trumpet             1945 -> 1928 (the septeto's cornet)
             brass_section       1967 -> 1938 (a Sinaloa banda)
             tenor_sax           1945 -> 1938 (a Kansas City reed section)
             jazz_guitar         1952 -> 1938 (the same band's rhythm guitar)
             tuba                2023 -> 1938 (the same band's bass)
             accordion           1985 -> 1950 (a forró sanfona)
             crunch_guitar       1969 -> 1968 (a São Paulo fuzzbox)
             bass_lead           1987 -> 1985 (a Casio MT-40 preset)
           — and not one of those is in dispute as a claim about when the
           instrument existed. What a lowered floor BUYS is that older
           records may now hire that sound too, which is why the list is
           short and why every entry on it is a real instrument in a real
           year rather than a convenience.

       THE ORDER IS WORLD.md §6'S AND IT IS NOT NEGOTIABLE. **TIER 1 ONLY**:
       12-TET, and a metre this file can write. Three walls decided what is
       in and what is not, and each is a FACT about this box rather than an
       opinion about the music:

         · THE METRE. Every phrase, cell and kit vector in this file is
           written on SIXTEEN places, `drums()` takes its bar length from the
           subject (kernel.js:2289), and precompose.js:903 sets `meter: null`
           for all of them — so a 12-pulse bell, an aksak 7 or 9, a 12-beat
           flamenco compás and a tala PHASE against the seed instead of
           becoming a bar. Every anchor below is in four, and every one of
           them genuinely is: son, samba, mambo, filmi's keherwa, kroncong,
           enka, luk thung, arabesk's düyek and a Sinaloa polka are all
           records in four. `bulgarian` is the standing proof of the hazard
           in the other direction — "Sofia 1975", whose entire identity is
           the uneven bar, ships in 4/4 with a scale over it.
         · THE TUNING. WORLD.md §2's measurement table: 12-TET is a hard wall
           for exactly TWO families, quarter-tone maqam (50 cents, on the
           note that NAMES the maqam) and gamelan (40 cents, and no two
           ensembles agree). Turkish makam is 19c max / 6c mean, Chinese
           scale material 10c, Hindustani shruti 14c — all at or inside the
           10-20c melodic JND. That table is why Istanbul and Shanghai are
           below and Cairo's tarab is not.
         · THE INSTRUMENTS. 123 ids in the registry. `sitar`, `koto`,
           `shamisen`, `shakuhachi`, `steel_drums`, `pan_flute`, `clarinet`,
           `alto_sax`, `honky_tonk`, `timpani` and `melodic_tom` are all real,
           licensed and on disk, and NO anchor had ever said their names —
           WORLD.md §2 counted 41 such ids. Saying a name is all it takes to
           cast one, and MEASURED against the tree this round started from
           (66 ids cast by 139 anchors; 74 cast by 199) it says EIGHT of them:
           clarinet, alto_sax, steel_drums, pan_flute, shamisen, koto, sitar
           and honky_tonk, in that order, each numbered in the anchor that
           does it. `tuba` is a ninth case and a different one — it was cast
           exactly once, by a record from 2023, so what moved for it is the
           FLOOR and not the id. What this round does NOT do
           is put three stand-ins in one cast: that is the taarab refusal the
           African round wrote down, and it is why jiangnan sizhu, Cuban
           rumba and gamelan are named in §TIER 2 below rather than shipped.

       AND THE ONE THING THE RULE MUST NOT BE USED TO EXCLUDE. No anchor in
       this catalog has WORDS — the singers sing vowels and the tract does
       not read a text — so "the lyric matters here" is true of every
       tradition on the shelf and can never be a shipping blocker on its own.
       What separates `ghazal` (Tier 2) from `cantopop` (Tier 1) is not that
       one has a text and the other does not: in a ghazal the SETTING of the
       couplet's prosody IS the compositional act, and in Cantopop the
       lexical tone is a constraint ON a pop melody that is composed anyway.
       The first is a music this box cannot write; the second is a music it
       writes with one fact about it unsaid, declared in `cannot`.

       THE `cannot` FIELD, AND THE PRIMARY-FACT RULE (WORLD.md §7). `wants`
       names a missing ANCESTOR; `cannot` names a missing WORD IN THE
       LANGUAGE — a fact about the tradition this box has no way to state.
       Prose drifts from the data it labels, which is vocabulary.js's own
       argument, so the admission is DATA. And the rule that keeps Tier 2 out
       of Tier 1: **if a tradition's PRIMARY fact is in its own `cannot`, it
       does not ship under that name.** Ghazal's primary fact is the
       text-setting of a couplet, jingju's is banshi, gamelan's is slendro:
       none of them is below. Enka's primary fact is its yonanuki melody and
       not kobushi; qawwali's is the party, the harmonium and the clapped
       cycle and not the sargam taan; shaabi's is the wedding voice over the
       maqsoum and not the quarter tone. Those three ship, each carrying its
       admission.

       THE CARICATURE IS MEASURABLE, AND SEVENTEEN OF THE SIXTY ANCHORS
       BELOW EXIST TO PAY A DEBT SOMEBODY HAD ALREADY WRITTEN DOWN. The
       failure WORLD.md caught running was `worldfolk` (Johannesburg 1986)
       standing as the largest declared ancestor of a Punjabi record and of a
       Mexican one, because "the genealogy law demanded a parent, the true
       parent was absent, and the nearest anchor was conscripted". The fix is
       not a better guess — it is the missing rung. Every `wants` entry the
       catalog had written down and could not reach is a SPECIFICATION, and
       this round built to it: mento and calypso (ska wanted both),
       rocksteady (reggae), dancehall (reggaeton AND afrobeats), bhangra
       (punjabipop), banda and norteño (corrido tumbado wanted both), shaabi
       (mahraganat), samba and choro (bossa wanted both), cumbia, son and
       salsa (latin pop wanted all three), swing and ragtime (jazz wanted
       both), palm-wine, son and swing (highlife wanted three of its four),
       mbaqanga (worldfolk AND kwaito). Seventeen anchors, and THIRTEEN
       `parents` lines are REWRITTEN below the entries that owned them —
       ska, reggae, reggaeton, punjabipop, corridotumbado, mahraganat, bossa,
       latinpop, jazz, highlife, worldfolk, kwaito and afrobeats — never in
       silence, and each with the old claim quoted above the new one.

       AND THE MAP IS THE ALARM, NOT THE SPECIFICATION. Six new dots would
       bring every large city within 2,000 km of an anchor and six dots is
       exactly the costume. The coverage report this round prints is anchors
       per REGION per CENTURY, not dots.

       ====================================================================
       TIER 2 — NAMED WITH ITS WALL, AND NOT SHIPPED
       ====================================================================
       Nobody re-derives these; each is a name, a wall and the reason.

         TUNING (12-TET is the wall, WORLD.md §2's measured table):
           tarab / Arab classical (Cairo, Umm Kulthum) — rast and bayati put
             a ~50-cent note on the degree that NAMES the maqam;
           Turkish klasik makam (Istanbul) — 53-TET commas are inside the JND
             for pitch but NOT for notation, and the notation is the tradition;
           Persian dastgah (Tehran) — the koron is the same wall as bayati;
           shashmaqom (Bukhara) and Uyghur muqam (Kashgar);
           gamelan (Yogyakarta) — slendro/pelog PLUS a non-2:1 period, which
             `degPitch`'s `12*floor(d/len)` and `foldInto`'s step of 12 make
             unsayable at all; and no two ensembles are tuned alike, so there
             is no target to be correct about.
         METRE (this file's cells are sixteen places long):
           flamenco proper (Seville) — the soleá/bulería compás is twelve
             beats accented 3-6-8-10-12; `rumbacatalana` below is the 4/4
             corner of that family and says so;
           aksak — ruchenitsa, kopanitsa, daichovo (Sofia, Skopje), Turkish
             usul, Caucasian 6+5;
           Hindustani tala — teental is sixteen and would fit, but jhaptal,
             rupak and ektal are 10, 7 and 12;
           jigs, slip jigs and the mariachi sesquiáltera;
           jingju banshi, gagaku jo-ha-kyū, pansori — metre CHANGING inside
             one record, which precompose.js cannot yet write.
         FREE TIME (no entry in any metre table can say "no bar"):
           alap, taqsim, sanban, seán-nós, noh's ma, Mongolian urtiin duu.
         INSTRUMENTS (the taarab refusal: three stand-ins in one cast is a
         costume even when each one defends itself):
           jiangnan sizhu (Shanghai) — dizi, erhu, pipa and yangqin, and only
             the yangqin has an honest id (`dulcimer` IS a hammered dulcimer);
           Cuban rumba de cajón (Havana) — three tuned drums and a clave, and
             the box has twelve extracted kit WAVs with no hand drum among them;
           gnawa, mbalax, jeliya, jùjú, taarab and chimurenga — DEFERRED BY
             NAME by the African round on 2026-08-25 and not re-derived here;
           aboriginal Australian manikay (Yirrkala) — the yidaki has no id and
             its drone IS the music, and the metre is free besides.
         TIMBRE AS THE GENRE (WORLD.md §5.5 — no compromise offered):
           pansori's rasp, throat singing, jingju's role registers.
         TEXT-SETTING (WORLD.md §5.7 — melisma density is the only proxy and
         it is a crude one):
           ghazal (Delhi) — the couplet's prosody IS the composition, so by
             the primary-fact rule the name does not ship;
           qasida, and the Gregorian melisma this catalog already admits to.
         THE MAP ITSELF, which is a wall nobody had named until this round:
           `atlas-land.js` — the baked Natural Earth coastline — holds NO
           Pacific islands, no Lesser Antilles and no Ryukyus. Measured: the
           nearest baked land to Honolulu is 33.9 degrees away and to Honiara
           9.0. So hapa-haole (Honolulu 1915), Melanesian string band
           (Honiara 1975), zouk (Pointe-à-Pitre 1985) and Okinawan pop (Naha
           1992) are all Tier 1 MUSICALLY — 12-TET, in four, castable — and
           are held back because their dot would draw over open water and no
           gate could prove it stands on land. Australia and the Pacific is
           therefore this round's one EMPTY REGION, and the wall is the
           coastline bake, not the music. It is one re-bake away.
           ...AND ONE MORE, FOR A DIFFERENT MAP REASON: UK bhangra (Southall
           1986) — the daytimer circuit, Alaap and Heera, which is where the
           music actually was. Southall's dot measures 4.9 CSS px from Muswell
           Hill at the Britain arc, under atlas.gate.js G10's 8.5 px floor,
           and the two are SIBLING neighbourhoods of one city, which is the
           one relation `WITHIN` cannot declare. Birmingham measures 4.5 px
           from Stourbridge and Wolverhampton 3.8, so it is not a Southall
           problem — Britain is simply full. `bhangra` ships as Jalandhar
           1972 instead, which is the older and more directly ancestral label
           for what `punjabipop` was asking for anyway.
       ==================================================================== */

    /* ---- LATIN AMERICA AND THE CARIBBEAN ------------------------------
       Twenty-one anchors — twenty of which put a dot in this region and one
       of which, `salsa`, puts its dot in New York, because that is where the
       Fania tape is and the map does not get to pretend otherwise. The
       coverage report prints it under North America for the same reason.

       The region was already the best-served of the
       eight non-Euro-American ones (tango 1935, bossa 1958, latinpop 2001,
       reggaeton 2004, bailefunk 2022, corridotumbado 2023, plus Kingston's
       three) — which is exactly why the holes were so loud: the catalog held
       Rio and Kingston and Buenos Aires and had no Havana, no Mexico, no
       Colombia, no Hispaniola and no Trinidad, and five of the six anchors
       it did hold were the last seventy years of pop.

       ONE COMPROMISE IS MADE TWENTY-ONE TIMES AND IS NAMED HERE ONCE rather
       than smuggled anchor by anchor: THERE IS NO HAND PERCUSSION IN THE
       KIT. Twelve lanes, twelve extracted WAVs (kernel.js:1776 DRUMFILE),
       and no bell, no shaker, no scraper, no conga and no clave among them;
       registry-data.js PERCBANK holds 24 real percussion hits and nukernel
       reads none of them (grepped: zero references). So the house answer,
       set three times already — bodiddley's maracas on the hat
       (genres.js:2462), amapiano's shekere on the rim (:5748), highlife's
       maracas on the hat again (:6412) — is the answer here: the clave and
       the cáscara to `p`, the shaker, güira and guacharaca to `h`, the
       congas and the tambora to the toms, and the compromise SAID in the
       anchor that makes it. What is lost every time is the pitch difference
       between an open tone and a slap. */

    // SON — Havana 1928, and it is the trunk of nearly everything else in
    // this region. A septeto: tres and guitar interlocking, bongó, a bass
    // that ANTICIPATES (the note lands on the and-of-4 and again on 3, not
    // on the downbeat), a clave running under all of it, and a form in two
    // halves — the sung largo, then the montuno where the chorus takes a
    // short phrase and the lead answers over it forever.
    //
    // THE YEAR is the Sexteto Habanero's Victor sessions and the arrival of
    // the CORNET, which made a sexteto a septeto in 1927 and is the sound
    // everyone means by "son". A record and an instrument, not a decade's
    // midpoint.
    //
    // THE TRES IS `steel_string_guitar` AND THAT IS THE CLOSER OF THE TWO
    // GUITARS, not a shrug: a tres is three courses of DOUBLED METAL strings
    // played with a plectrum, so the nylon guitar — which this file reaches
    // for by reflex for anything Spanish — is the wrong string and the wrong
    // attack. The Spanish guitar beside it IS nylon. What is lost is the
    // octave doubling inside each course, which is most of what makes a tres
    // shimmer.
    //
    // LINEAGE: a genuine ROOT. The parents are the changüí of Guantánamo,
    // the Spanish canción and the African-derived rumba de cajón, and not
    // one of the three is here. Reaching for `tango` because it is the only
    // other Latin American anchor older than this one would be the exact
    // conscription this round exists to undo — Buenos Aires 1935 is a
    // different continent's worth of music away and is FIVE YEARS LATER.
    son: {
      label: "Havana 1928", voices: 3, bars: 8, near: "highlife",
      plan: "song", bpm: 96,
      parents: {},
      wants: ["changüí", "spanish canción", "rumba de cajón", "danzón"],
      cannot: ["the three tuned drums of a rumba and the difference between " +
               "an open tone and a slap — the kit has twelve extracted WAVs " +
               "and no hand drum among them"],
      instr: ["steel_string_guitar", "trumpet", "nylon_string_guitar"],
      drumkit: "acoustic",
      entry: v => v * 2, reg: v => (v === 1 ? 0 : v - 1), realize: () => "line",
      part: ["riff", "lead", "counter"],
      roots: [0, 0, 3, 3, 4, 4, 0, 0], mode: MODES.ionian,
      scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 2,
      // THE ANTICIPATED BASS is the single most identifying number in this
      // entry and it is written into the KICK rather than into a bass word,
      // because `bassStyle` has no "arrive early" in it: the marímbula and
      // then the double bass play a tumbao that lands on the and-of-4 of the
      // bar before and on the 3, and the kick is what a drum kit has to say
      // that with. `octaves` is the nearest bass word, and it is right about
      // the interval and silent about the placement.
      bassStyle: "octaves",
      // CLAVE 3-2 ON `p`, one bar, three strokes then two — the same lane
      // and the same reasoning as Accra 1957 one ocean east, which took the
      // figure from the Cuban 78s in the first place. `h` is the bongó's
      // martillo, and the two `s` strokes are the bongosero's slap.
      kit: { k: [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,1,0],
             s: [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,0,1, 0,0,1,0, 0,0,1,0, 1,0,0,0],
             h: [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1] },
      kitVel: { h: [8,0,5,6, 7,0,5,6, 8,0,5,6, 7,0,5,7] },
      fill: { p: [1,0,0,1, 0,0,1,0, 1,0,1,0, 1,1,0,1] },
      tone: { wave: "triangle", cut: 2600, q: 1.1, atk: .005, rel: .5, gain: .27, verb: .24 },
      words: ["the tres, the guajeo it never leaves",
              "the cornet, over the montuno",
              "the guitar, filling behind it"],
      word: v => (v === 1 ? [rotate(4), drop(2)] : v === 2 ? [transpose(-3)] : []),
    },

    // BOLERO — Havana 1948. The Latin American love song, and the one form
    // in this batch whose whole business is the VOICE and the guitar behind
    // it. Two guitars: a requinto (tuned a fourth up, playing the filigree
    // between the sung lines) and the rhythm guitar under it.
    //
    // THE YEAR is the Trío Los Panchos era — the requinto-led trio that made
    // the bolero continental — rather than Pepe Sánchez's "Tristezas" of the
    // 1880s, which is the origin and has no recording behind it. The label
    // names what is on tape, which is this file's standing rule for a year.
    //
    // WHAT SEPARATES IT FROM `crooner`, its nearest neighbour in feel: the
    // crooner is Los Angeles 1953 with a band and an arranger behind him and
    // he sings over CHANGES that move every two beats. A bolero is two
    // guitars, four bars of I-vi-ii-V, and a tempo half the crooner's — and
    // the requinto's filigree between the phrases is a SECOND LINE, which is
    // why `voices` is 3 and not 2.
    bolero: {
      label: "Havana 1948", voices: 3, near: "crooner",
      // 72 and not the 68 a bolero is often taken at: compose.js requires an
      // integer 70..160 and the floor is the floor.
      plan: "song", bpm: 72,
      // LINEAGE: son is the same city twenty years earlier and is genuinely
      // an input — the bongó, the clave feeling, the trio format — but the
      // MELODY is the Spanish-Cuban canción and the Italian-descended
      // sentimental song, which is why the weight is not larger.
      parents: { son: 0.55 },
      wants: ["canción cubana", "trova santiaguera"],
      instr: ["solo_vox", "steel_string_guitar", "nylon_string_guitar"],
      entry: v => v, reg: v => (v === 1 ? 1 : v === 2 ? -1 : 0),
      realize: v => (v === 2 ? "pad" : "line"),
      part: ["lead", "counter", "pad"],
      roots: [0, 5, 1, 4], mode: MODES.ionian,
      scale: SCALES.major, diatonic: true,
      artic: "legato", maxHold: 4, bassStyle: "octaves",
      // THE BOLERO RHYTHM IS THE ONE THING THE HANDS DO: bongó martillo on
      // the hat lane, and the cinquillo — the five-stroke figure the whole
      // Caribbean is built on — on `p`. No kick and no snare, because a
      // bolero trio has no drum kit and putting one there would make it a
      // dance record.
      kit: { p: [1,0,1,1, 0,1,0,0, 1,0,1,1, 0,1,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      kitVel: { h: [7,0,4,0, 6,0,4,0, 7,0,4,0, 6,0,5,0] },
      tone: { wave: "triangle", cut: 2200, q: 0.8, atk: .02, rel: 1.3, gain: .26, verb: .38,
              // WHO SINGS: a tenor a foot from the microphone, the wobble
              // arriving late in the note the way the crooner's does — the
              // two traditions learned it from the same decade of radio —
              // but with more breath in it and one syllable a beat, because
              // a bolero is a POEM sung slowly and the diction is the point.
              mouth: MOUTHS.bolerista },
      words: ["the singer", "the requinto, between the lines",
              "the rhythm guitar, holding the chord"],
      word: v => (v === 1 ? [transpose(5), rotate(8), drop(2)] : v === 2 ? [drop(4)] : []),
    },

    // MAMBO — Mexico City 1950. Pérez Prado's RCA sessions: a big band with
    // the saxes and the brass thrown at each other in two-bar blocks, a
    // rhythm section straight off the son, and a tempo nothing else in this
    // batch comes near.
    //
    // THE CITY IS MEXICO CITY AND THAT IS NOT AN ERROR. The mambo is Cuban
    // — Cachao and Arcaño in Havana in the late thirties, Prado arranging at
    // the Casino de la Playa — but Prado could not get the records made in
    // Havana and did get them made in Mexico City from 1949, and the mambo
    // the world heard is on RCA Mexico. The label names where the tape is.
    //
    // WHAT SEPARATES IT FROM `salsa`, which is the same rhythm section
    // twenty-three years later: mambo is a BRASS SECTION playing riffs in
    // block harmony over a vamp that does not modulate, at 132 — and salsa
    // is trombones and a piano montuno in dorian over an eight-bar cycle at
    // 100. The two anchors share a clave and disagree about everything else.
    mambo: {
      label: "Mexico City 1950", voices: 3, near: "son",
      plan: "dance", bpm: 132,
      // LINEAGE: son is the rhythm section, whole and undisguised. The other
      // half is the danzón's final section — where the mambo takes its name
      // — and the AMERICAN SWING BAND, which this catalog now holds (Kansas
      // City 1938, below), and Prado's block scoring is unmistakably that.
      parents: { son: 0.5, swing: 0.35 },
      wants: ["danzón"],
      instr: ["brass_section", "tenor_sax", "trumpet"],
      drumkit: "jazz",
      entry: v => v, reg: v => (v === 1 ? -1 : v === 2 ? 1 : 0),
      realize: () => "line",
      part: ["riff", "counter", "lead"],
      harmony: "modal", mode: MODES.mixo, scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 1, bassStyle: "octaves",
      // THE TIMBALES ARE THE TOMS, and this is the batch's other standing
      // compromise said once: the cáscara on the shell goes to `p`, the
      // abanico and the bell-driven mambo section go to the high and mid
      // toms, and what is lost is that a timbalero is playing METAL — the
      // shell and the cha-cha bell — where a tom is a head.
      kit: { k: [1,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,1,1, 0,1,1,0, 1,0,1,1, 0,1,1,0],
             t: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             m: [0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { t: [1,0,1,0, 1,0,0,0, 1,0,1,0, 1,1,0,0] },
      tone: { wave: "sawtooth", cut: 3000, q: 1.2, atk: .004, rel: .35, gain: .28, verb: .2 },
      words: ["the brass, in blocks",
              "the saxes, answering underneath",
              "the trumpet, screaming over the top"],
      word: v => (v === 1 ? [rotate(8), transpose(-5)] : v === 2 ? [transpose(12), drop(3)] : []),
    },

    // SALSA — New York 1973, and the label says New York because that is
    // where the tape is: Fania's sessions, made by Puerto Rican and Cuban
    // musicians in Manhattan, and the map should not pretend otherwise. This
    // is the round's one anchor whose city and whose music point at
    // different continents, and saying so is cheaper than moving the dot.
    //
    // THE YEAR is the Fania All-Stars at the Cheetah on tape and Willie
    // Colón and Héctor Lavoe at their peak — the moment the word "salsa"
    // stops being a marketing term and starts naming a sound.
    //
    // WHAT IT IS, IN FIELDS: a piano MONTUNO (a two-bar arpeggiated figure
    // that never stops), trombones instead of trumpets, and a minor-side
    // harmony — which is the audible difference between this and mambo,
    // which is a brass band in major sitting on one chord.
    salsa: {
      label: "New York 1973", voices: 3, bars: 8, near: "mambo",
      plan: "song", bpm: 100,
      // LINEAGE: son is the skeleton and mambo is the horn writing; the
      // third parent is the New York end of it — boogaloo and the R&B the
      // Nuyorican bands grew up on, which `funk` is the nearest anchor to
      // and is named at a small weight BECAUSE it is a resemblance and not a
      // descent. `latinpop` (Miami 2001) is this anchor's CHILD and its
      // parents line is corrected below.
      parents: { son: 0.4, mambo: 0.35, funk: 0.25 },
      wants: ["boogaloo", "plena", "bomba"],
      instr: ["bright_yamaha_grand", "trombone", "trumpet"],
      drumkit: "acoustic",
      entry: v => v * 2, reg: v => (v === 0 ? 0 : v === 1 ? -1 : 1),
      realize: () => "line",
      part: ["riff", "lead", "counter"],
      roots: [0, 3, 4, 0, 0, 3, 4, 4], mode: MODES.dorian,
      scale: MODES.dorian, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "octaves",
      // THE BELL IS THE HAT LANE — the campana's quarter notes with the
      // and-strokes between them, which is what a salsa record is counted by
      // — and the congas take the toms. Same compromise as the mambo above,
      // one lane over.
      kit: { k: [1,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,0,1, 0,0,1,0, 0,0,1,0, 1,0,0,0],
             m: [0,0,0,0, 0,0,1,1, 0,0,0,0, 0,0,1,1],
             l: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             h: [1,0,1,0, 1,0,1,1, 1,0,1,0, 1,0,1,1] },
      kitVel: { h: [9,0,5,0, 8,0,5,5, 9,0,5,0, 8,0,5,6] },
      fill: { m: [0,0,1,1, 0,0,1,1, 1,1,0,0, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2800, q: 1.2, atk: .005, rel: .45, gain: .28, verb: .22 },
      words: ["the piano montuno", "the trombones, in the holes",
              "the trumpet, on top of them"],
      word: v => (v === 1 ? [rotate(4), drop(2)] : v === 2 ? [transpose(7), drop(3)] : []),
    },

    // CUMBIA — Barranquilla 1960. The Discos Fuentes orquesta cumbia: a
    // clarinet or a sax on the tune where the gaita flute used to be, brass
    // answering, and underneath it the pattern the whole coast walks to —
    // the tambora on the beat and the llamador on every off-beat, which is
    // the figure that makes a cumbia impossible to mistake for a son.
    //
    // THE YEAR is the Fuentes big-band era in Barranquilla, when the coastal
    // music was arranged for a horn section and became national and then
    // continental. The village cumbia — gaitas, no harmony, no fixed pitch —
    // is a different music and is NOT what this anchor claims.
    //
    // THE CLARINET IS THE FIRST IN THE CATALOG, which is the fact worth
    // recording: `clarinet` has been a real, licensed, on-disk registry id
    // the whole time with SIX zones and a parent window of [50,91], and no
    // anchor in 139 had ever said its name. Nothing was built to cast it —
    // it just had to be asked for.
    cumbia: {
      label: "Barranquilla 1960", voices: 3, near: "son",
      plan: "dance", bpm: 92,
      // LINEAGE: a ROOT, and honestly one — coastal cumbia is Indigenous
      // gaita flutes, African drums and a Spanish song form, none of which
      // is in this catalog, and the orquesta arrangement it wears in 1960 is
      // the Cuban dance band, which IS here at a real weight.
      parents: { son: 0.3 },
      wants: ["gaita costeña", "porro", "chandé"],
      cannot: ["the gaita's own tuning — a kuisi is a beeswax-and-cane duct " +
               "flute with five holes and no temperament, and this box has " +
               "only 12-TET to offer it"],
      instr: ["clarinet", "trumpet", "nylon_string_guitar"],
      drumkit: "acoustic",
      entry: v => v, reg: v => (v === 2 ? -1 : 0), realize: () => "line",
      part: ["lead", "counter", "riff"],
      roots: [0, 4, 0, 4], mode: MODES.aeolian, scale: DIATONIC, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "octaves",
      // THE LLAMADOR IS ON EVERY OFF-BEAT and that is the whole identity:
      // `p` is the 2-4-6-8 of the eighth-note grid and nothing else, the
      // tambora is the kick and the alegre goes to the toms. The guacharaca
      // — a scraped ridged tube — is the hat lane, and what is lost is that
      // a scrape has a LENGTH where a hat has an attack.
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             s: [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             m: [0,0,0,0, 1,0,1,0, 0,0,0,0, 1,0,1,0],
             h: [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1] },
      kitVel: { h: [8,0,4,6, 7,0,4,6, 8,0,4,6, 7,0,4,7] },
      fill: { m: [1,0,1,0, 1,0,1,0, 1,1,1,0, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2400, q: 1.0, atk: .01, rel: .7, gain: .27, verb: .3 },
      words: ["the clarinet, where the gaita was",
              "the trumpet, answering the phrase",
              "the guitar, on the off-beat with the llamador"],
      word: v => (v === 1 ? [rotate(8), drop(2)] : v === 2 ? [only("acc", rotate(2))] : []),
    },

    // VALLENATO — Valledupar 1975. The other Colombian accordion music, and
    // the argument for holding both is that they are not the same ensemble:
    // a vallenato is THREE PEOPLE — a diatonic button accordion, a caja
    // vallenata and a guacharaca — where the cumbia above is an orchestra.
    // Three players and one of them is the whole harmony.
    //
    // THE YEAR is the Festival de la Leyenda Vallenata era and the decade
    // the paseo became a national radio form; the tradition is older and was
    // sung by walking men with no recording near it, which is the same shape
    // of claim marabi's entry makes about the 1920s.
    //
    // THE ACCORDION IS NOT A STAND-IN. It is the instrument, and the ONE
    // thing lost is that a vallenato accordion is DIATONIC — two rows, a
    // different note pushing than pulling — which is why its runs go where
    // they go. The registry's accordion is chromatic and will play anything.
    vallenato: {
      label: "Valledupar 1975", voices: 2, near: "cumbia",
      plan: "song", bpm: 108,
      parents: { cumbia: 0.5 },
      wants: ["paseo campesino", "colonial spanish décima"],
      cannot: ["the diatonic accordion's push-pull — a bisonoric button box " +
               "cannot play every note in both directions, and that is what " +
               "shapes a vallenato run"],
      instr: ["accordion", "steel_string_guitar"],
      drumkit: "acoustic",
      entry: v => v * 2, reg: v => -v, realize: () => "line",
      part: ["lead", "counter"],
      roots: [0, 4, 4, 0], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "eighths",
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      kitVel: { h: [8,4,5,4, 7,4,5,4, 8,4,5,4, 7,4,5,5] },
      fill: { s: [0,0,0,0, 1,0,0,1, 0,0,1,0, 1,0,1,0] },
      tone: { wave: "sawtooth", cut: 2500, q: 1.1, atk: .01, rel: .6, gain: .27, verb: .26 },
      words: ["the accordion, the whole harmony and the tune",
              "the guitar, doubling the run an octave down"],
      word: v => (v === 1 ? [transpose(-12), drop(2)] : []),
    },

    // SAMBA — Rio de Janeiro 1939. Estácio samba: the surdo on the second
    // beat, the tamborim's syncopated figure over it, a cavaquinho chopping
    // the chord and a seven-string guitar walking underneath. The catalog
    // has held Rio since bossa nova arrived and has never held the music
    // bossa nova is a quiet argument with.
    //
    // THE YEAR is Ary Barroso's "Aquarela do Brasil" and the samba-exaltação
    // moment, when the form went from the morro to the radio orchestra —
    // documented, dated, and on tape.
    //
    // THE CAVAQUINHO IS `steel_string_guitar` and the violão de sete cordas
    // is `nylon_string_guitar`: four steel strings played with a plectrum
    // against six nylon ones played with the thumb, which is the right
    // contrast even at the wrong sizes. What is lost is the cavaquinho's
    // register — it is a small instrument and sits an octave above where a
    // guitar sits — and the reg function below moves the whole chair up to
    // say so rather than pretending the sample is smaller than it is.
    samba: {
      label: "Rio de Janeiro 1939", voices: 3, near: "bossa",
      plan: "song", bpm: 100,
      // LINEAGE: a ROOT, and this is the one place in the batch where the
      // catalog's own habit had to be resisted hardest — `bossa` is Rio and
      // is right there and is TWENTY YEARS LATER; it is this anchor's child
      // and its parents line is rewritten below to say so.
      parents: {},
      wants: ["maxixe", "lundu", "partido alto", "batucada"],
      cannot: ["the bateria — a samba school is two hundred drums in six " +
               "named voices, and the kit has twelve lanes"],
      instr: ["solo_vox", "steel_string_guitar", "nylon_string_guitar"],
      drumkit: "acoustic",
      entry: v => v, reg: v => (v === 1 ? 1 : v === 2 ? -1 : 0),
      realize: () => "line",
      part: ["lead", "riff", "counter"],
      roots: [0, 5, 1, 4], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "octaves",
      // THE SURDO IS ON THE SECOND BEAT and that is the definition: the kick
      // is quiet on 1 and loud on 3 of the sixteen-step bar (which is beat 2
      // of each of the two 2/4 bars a samba is really counted in), the
      // tamborim's figure is on `p`, and the pandeiro's sixteenths are the
      // hat. The chocalho would be a shaker if there were one.
      kit: { k: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,1, 0,0,1,0, 0,0,0,1, 0,0,1,0],
             p: [1,0,0,1, 0,1,0,0, 1,0,0,1, 0,1,0,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      kitVel: { k: [4,0,0,0, 0,0,0,0, 9,0,0,0, 0,0,0,0],
                h: [8,4,6,4, 7,4,6,4, 8,4,6,4, 7,4,6,5] },
      fill: { p: [1,0,1,1, 0,1,1,0, 1,1,0,1, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2500, q: 1.0, atk: .006, rel: .5, gain: .27, verb: .28 },
      words: ["the singer", "the cavaquinho, chopping the chord",
              "the seven-string, walking under it"],
      word: v => (v === 1 ? [only("acc", rotate(3))] : v === 2 ? [transpose(-12), drop(2)] : []),
    },

    // CHORO — Rio de Janeiro 1900, and it is now the oldest record in the
    // Americas by seven years. Brazil's instrumental virtuoso music: a flute
    // (or later a mandolin, or a clarinet) playing a written, modulating,
    // fast tune in rondo form, a cavaquinho chopping, and the seven-string
    // guitar's BAIXARIA — a walking countermelody in the bass that is the
    // point of the whole ensemble and is why `bassStyle` is `walk` here and
    // in only fourteen other anchors.
    //
    // THE YEAR is the turn of the century and Chiquinha Gonzaga and Ernesto
    // Nazareth's published pieces — the moment choro is a written repertory
    // rather than a way of playing polkas. It is a PUBLICATION date, which
    // is the same kind of claim "Sedalia 1899" below makes and a weaker one
    // than a session date; the comment is where that belongs.
    //
    // WHAT SEPARATES IT FROM EVERY OTHER LATIN ANCHOR: it MODULATES. A choro
    // is AABBACCA with the C section in another key, and its eight-bar cycle
    // below goes to the relative and back, which nothing else in this batch
    // does. It is also the one that is not danced.
    choro: {
      label: "Rio de Janeiro 1900", voices: 3, bars: 8, near: "ragtime",
      plan: "arc", bpm: 116,
      // LINEAGE: a ROOT under protest. Choro is the European salon dances —
      // polka, schottische, waltz — played by Brazilian musicians with a
      // lundu underneath, and `parlor` (New York 1892) is the closest thing
      // this catalog holds to a salon repertory. It is named at a real but
      // small weight because the SHARED thing is the parlour piano culture
      // of the 1890s and not a line of descent: Rio was not listening to New
      // York, both were listening to Europe.
      parents: { parlor: 0.3 },
      wants: ["polka brasileira", "lundu", "maxixe", "modinha"],
      instr: ["flute", "steel_string_guitar", "nylon_string_guitar"],
      entry: v => v, reg: v => (v === 0 ? 1 : v === 1 ? 0 : -1),
      realize: () => "line",
      part: ["lead", "riff", "counter"],
      roots: [0, 4, 0, 4, 2, 5, 4, 0], mode: MODES.ionian,
      scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 1, bassStyle: "walk",
      // THE PANDEIRO IS THE ONLY DRUM and it is written as a hand rather
      // than a kit: thumb, fingers and heel across the hat lane with the
      // low strokes on `p`. There is no kick and no snare because there is
      // no drummer — one man holding one frame drum.
      kit: { p: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      kitVel: { h: [9,3,6,3, 8,3,6,3, 9,3,6,3, 8,3,6,4] },
      tone: { wave: "triangle", cut: 2900, q: 0.9, atk: .004, rel: .4, gain: .26, verb: .3 },
      words: ["the flute, the written tune",
              "the cavaquinho, chopping under it",
              "the seven-string's baixaria, walking against both"],
      word: v => (v === 1 ? [only("acc", rotate(2)), drop(2)]
                : v === 2 ? [invert(4), transpose(-12)] : []),
    },

    // FORRÓ — Recife 1950. Luiz Gonzaga's baião: an accordion, a zabumba
    // (one man, one two-headed drum, a mallet on top and a stick underneath)
    // and a triangle. Three players, and one of them plays the harmony, the
    // countermelody and the tune.
    //
    // THE YEAR is the height of Gonzaga's national reach, a decade after
    // "Baião" itself; the music is northeastern and older, and 1950 is when
    // Rio's radio carried it everywhere. Same shape of claim as marabi's.
    //
    // WHY `voices` IS 2 ON A THREE-PIECE BAND: the third player is a
    // triangle. The two pitched voices below are the accordion's two HANDS —
    // the right playing the tune, the left holding the chord — which is what
    // an accordion actually is and which nothing else in this catalog says.
    //
    // ONE CHORD AND A FLAT SEVEN. A baião does not move: `harmony: "modal"`
    // and mixolydian, because the flattened seventh over a stationary bass is
    // the sound, and giving it a cycle would make it a polka.
    forro: {
      label: "Recife 1950", voices: 2, near: "vallenato",
      plan: "dance", bpm: 118,
      parents: {},
      wants: ["baião de viola", "coco", "xote"],
      instr: "accordion",
      drumkit: "acoustic",
      entry: v => v, reg: v => (v === 1 ? -2 : 0),
      realize: v => (v === 1 ? "pad" : "line"),
      part: ["lead", "pad"],
      harmony: "modal", mode: MODES.mixo, scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "eighths",
      // THE ZABUMBA IS ONE PLAYER WITH TWO STICKS AND IT IS WRITTEN AS TWO
      // LANES: the mallet's deep stroke on the kick, the bacalhau's dry tap
      // on the underside on `p`, and the triangle's open-and-closed pattern
      // on the hat. The baião figure is the kick on 1 and the and-of-2, and
      // it is the most recognisable rhythm in Brazil after the samba's surdo.
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             p: [0,0,1,0, 0,1,0,1, 0,0,1,0, 0,1,0,1],
             h: [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1] },
      kitVel: { h: [9,0,4,6, 8,0,4,6, 9,0,4,6, 8,0,4,7] },
      fill: { p: [1,0,1,1, 0,1,1,1, 1,1,1,0, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 2600, q: 1.2, atk: .008, rel: .5, gain: .28, verb: .24 },
      words: ["the accordion's right hand, the tune",
              "the left hand, holding the chord under it"],
      word: v => (v === 1 ? [drop(4)] : []),
    },

    // MERENGUE — Santo Domingo 1955. The fastest thing in this batch and one
    // of the fastest records in the catalog: a saxophone playing a jaleo
    // figure over and over, a tambora played with one stick and one hand,
    // and a güira — a metal scraper — running sixteenths that never stop.
    //
    // THE YEAR is the Trujillo-era orquesta merengue, when the state made a
    // rural Cibao form the national music and put it in front of a horn
    // section. That is an unlovely reason for a year and it is the true one.
    //
    // THE ALTO SAX IS THE SECOND REGISTRY ID THIS ROUND UNLOCKS BY NAME:
    // `alto_sax` has six looped zones and a parent window of [49,82] and no
    // anchor had ever asked for it — the catalog's saxophone has been the
    // TENOR eleven times running, which is a jazz-and-soul habit and is the
    // wrong horn for this music.
    merengue: {
      label: "Santo Domingo 1955", voices: 3, near: "cumbia",
      // 148 and not 144: a merengue de orquesta is the fastest thing in this
      // batch and the four bpm are also four bpm of separation from Nairobi
      // 1972, which the measurement below the benga entry explains.
      plan: "dance", bpm: 148,
      parents: {},
      wants: ["merengue típico cibaeño", "danza"],
      instr: ["alto_sax", "trumpet", "accordion"],
      drumkit: "acoustic",
      entry: v => v, reg: v => (v === 2 ? -1 : 0), realize: () => "line",
      part: ["riff", "counter", "lead"],
      roots: [0, 4, 0, 4], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 1, bassStyle: "eighths",
      // THE TAMBORA IS TWO HANDS AND IT IS WRITTEN AS TWO LANES: the stick's
      // rim-and-head figure on `p` and the open hand on the low tom. The
      // güira is the hat lane at sixteenths, EVEN — no velocity arch at all,
      // which is unusual in this file and is exactly what a scraper sounds
      // like: a continuous surface, not a set of strokes.
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,1,1, 0,1,1,0, 1,0,1,1, 0,1,1,0],
             l: [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      kitVel: { h: [6,6,6,6, 6,6,6,6, 6,6,6,6, 6,6,6,6] },
      fill: { p: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 3100, q: 1.3, atk: .004, rel: .3, gain: .28, verb: .18 },
      words: ["the sax, the jaleo",
              "the trumpet, over the top of it",
              "the accordion, from the típico band"],
      word: v => (v === 1 ? [transpose(5), drop(2)] : v === 2 ? [rotate(4)] : []),
    },

    // BACHATA — Santo Domingo 1992. The same island forty years later and a
    // completely different room: a requinto guitar arpeggiating between the
    // sung lines, a segunda guitar answering it, a bongó and a güira, and
    // four bars of i-iv-V that go round forever.
    //
    // THE YEAR is Juan Luis Guerra's "Bachata Rosa" and the moment the music
    // stopped being called amargue and stopped being disreputable — a
    // documented record, which is the strongest kind of year this file has.
    //
    // WHAT SEPARATES IT FROM BOLERO, which is its declared parent and which
    // it sounds like at half attention: the bachata guitar is ELECTRIC and
    // arpeggiated in continuous eighths (`bassStyle: "eighths"`, `artic`
    // staccato, `maxHold` 2) where the bolero's requinto plays filigree in
    // the gaps and holds. And the tempo is nearly double.
    bachata: {
      label: "Santo Domingo 1992", voices: 3, near: "bolero",
      plan: "song", bpm: 128,
      // LINEAGE: bolero is the song and the guitar trio, whole; merengue is
      // the same island's rhythm section and the güira comes straight off it.
      parents: { bolero: 0.6, merengue: 0.4 },
      wants: [],
      instr: ["clean_guitar", "steel_string_guitar", "solo_vox"],
      drumkit: "acoustic",
      entry: v => v, reg: v => (v === 0 ? 1 : v === 1 ? 0 : -1),
      realize: () => "line",
      part: ["lead", "counter", "riff"],
      roots: [0, 3, 4, 0], mode: MODES.aeolian, scale: DIATONIC, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "eighths",
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      kitVel: { h: [7,5,7,5, 7,5,7,5, 7,5,7,5, 7,5,7,6] },
      fill: { s: [0,0,0,0, 1,0,1,0, 0,0,1,1, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2700, q: 1.1, atk: .004, rel: .45, gain: .27, verb: .3 },
      words: ["the requinto, between the lines",
              "the segunda, answering it",
              "the singer"],
      word: v => (v === 1 ? [rotate(4), transpose(-5)] : v === 2 ? [drop(2)] : []),
    },

    // CALYPSO — Port of Spain 1956. The calypsonian's verse-and-refrain over
    // a band, and the record that gives this anchor its year is "Jean and
    // Dinah" — Sparrow's Road March and Carnival win, and the moment the
    // form went from the tent to the world.
    //
    // THE STEEL PAN IS REAL AND IT IS THE THIRD ID THIS ROUND UNLOCKS.
    // `steel_drums` is a licensed on-disk registry id with a parent window
    // of [52,84], and no anchor in the catalog had said its name — so the
    // one instrument the world associates with Trinidad has been sitting on
    // the shelf unreachable. What is NOT claimed here is a steelband
    // (Tier 2, above): an orchestra of tuned oil drums in four sections is
    // not one chair playing a pan sample.
    calypso: {
      label: "Port of Spain 1956", voices: 3, near: "mento",
      plan: "song", bpm: 120,
      // LINEAGE: a ROOT. Calypso's parents are the kaiso of the Carnival
      // tents, the French-Creole belair and the chantwell tradition, and the
      // catalog holds none of the three. `mento` (Kingston 1952) is a
      // sibling and a cousin, not an ancestor, and it is `near` for exactly
      // that reason — the resemblance goes in the field that means resemblance.
      parents: {},
      wants: ["kaiso", "belair", "chantwell song"],
      cannot: ["a steelband — four sections of tuned oil drums answering " +
               "each other is an orchestra, and this is one chair with a " +
               "pan sample on it"],
      instr: ["solo_vox", "steel_drums", "trumpet"],
      drumkit: "acoustic",
      entry: v => v, reg: v => (v === 1 ? 1 : v === 2 ? 0 : 0),
      realize: () => "line",
      part: ["lead", "counter", "riff"],
      roots: [0, 0, 3, 4], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "octaves",
      // THE IRON IS THE HAT LANE. A calypso band's timekeeper is a brake
      // drum hit with a bolt — the "iron" — and it plays a two-bar figure,
      // not an even pulse; what is lost is that it is a piece of scrap metal
      // and rings like one. The congas take the toms, as everywhere in this
      // batch.
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,1,0, 0,1,0,1, 1,0,1,0, 0,1,0,1],
             m: [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,1,1],
             h: [1,0,1,1, 0,1,1,0, 1,0,1,1, 0,1,1,0] },
      kitVel: { h: [9,0,5,6, 0,5,7,0, 9,0,5,6, 0,5,7,0] },
      fill: { m: [0,0,1,1, 0,0,1,1, 1,1,0,0, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2800, q: 1.0, atk: .004, rel: .55, gain: .27, verb: .3 },
      words: ["the calypsonian", "the pan, answering the line",
              "the trumpet, on the refrain"],
      word: v => (v === 1 ? [transpose(12), rotate(4), drop(2)] : v === 2 ? [drop(3)] : []),
    },

    // SOCA — Port of Spain 1979. Lord Shorty's "soul of calypso": the same
    // island's carnival music with the tempo up, a kick on every beat and a
    // horn section written like a funk band's. It is where calypso goes when
    // it meets a rhythm section that has heard disco.
    //
    // THE YEAR is the turn of the decade when the word stuck and the form
    // stopped being one man's experiment.
    //
    // WHAT SEPARATES IT FROM CALYPSO IN FIELDS: the kick. Calypso above has
    // three kicks in sixteen steps and soca has FOUR ON THE FLOOR, plus a
    // tempo twelve bpm faster and a synthesiser where the pan was.
    soca: {
      label: "Port of Spain 1979", voices: 3, near: "disco",
      plan: "dance", bpm: 132,
      parents: { calypso: 0.55, disco: 0.25, funk: 0.2 },
      wants: [],
      instr: ["brass_section", "clean_guitar", "polysynth"],
      drumkit: "room",
      entry: v => v, reg: v => (v === 1 ? 0 : v === 2 ? -1 : 0),
      realize: v => (v === 2 ? "pad" : "line"),
      part: ["riff", "counter", "pad"],
      roots: [0, 0, 3, 4], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "octaves",
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,1,0, 0,1,0,1, 1,0,1,0, 0,1,0,1],
             o: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             h: [1,0,0,1, 1,0,0,1, 1,0,0,1, 1,0,0,1] },
      fill: { p: [1,1,1,1, 0,1,1,1, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 3000, q: 1.3, atk: .005, rel: .35, gain: .28, verb: .22 },
      words: ["the horns, in stabs", "the guitar, chopping between them",
              "the synth, holding the pad"],
      word: v => (v === 1 ? [only("acc", rotate(2))] : v === 2 ? [drop(4)] : []),
    },

    // MENTO — Kingston 1952. Jamaica's own country music, and the rung
    // underneath everything else the catalog holds from that island: banjo,
    // guitar, a bamboo fife or a hand-cut saxophone, a hand drum, and a
    // RHUMBA BOX — a big thumb piano you sit on, which plays the bass line
    // and is the reason a mento band needs no bass player.
    //
    // THE YEAR is the Stanley Motta 78s in Kingston, the first commercial
    // recordings of Jamaican music of any kind. Documented, and the earliest
    // Jamaican year the catalog can hold.
    //
    // THE ACCENT IS ON THE FOURTH BEAT. That is the fact everything else in
    // this file gets wrong by default — a backbeat lands on 2 and 4 and a
    // mento lands hardest on 4 alone — and the `kitVel` line below is where
    // it is said, because there is no word for it anywhere else.
    //
    // `ska` DECLARED `wants: ["mento", "calypso"]` AND NOW HAS BOTH. Its
    // parents line is rewritten below.
    mento: {
      label: "Kingston 1952", voices: 3, near: "calypso",
      plan: "song", bpm: 108,
      parents: {},
      wants: ["jonkanoo", "quadrille", "revival hymn"],
      cannot: ["the rhumba box — a box lamellophone the player sits on, " +
               "which is a bass instrument the registry has no id for; the " +
               "bass chair takes an upright instead and plays the same notes"],
      instr: ["banjo", "nylon_string_guitar", "solo_vox"],
      drumkit: "brush",
      entry: v => v, reg: v => (v === 0 ? 1 : v === 1 ? 0 : 0),
      realize: () => "line",
      part: ["riff", "counter", "lead"],
      roots: [0, 0, 4, 0], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 2,
      kit: { s: [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      kitVel: { p: [5,0,0,0, 5,0,0,0, 5,0,0,0, 9,0,0,0],
                h: [6,0,5,0, 6,0,5,0, 6,0,5,0, 6,0,5,0] },
      fill: { p: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2600, q: 0.9, atk: .004, rel: .5, gain: .26, verb: .32 },
      words: ["the banjo, picking the tune", "the guitar, under it",
              "the singer, telling the story"],
      word: v => (v === 1 ? [drop(2), transpose(-5)] : v === 2 ? [rotate(8)] : []),
    },

    // ROCKSTEADY — Kingston 1966, and it is the rung the catalog was missing
    // between Kingston 1962 and Kingston 1969: `reggae` has declared
    // `wants: ["rocksteady", ...]` since it was written.
    //
    // THE YEAR is the summer Alton Ellis cut "Rock Steady" and the whole
    // island slowed down — attributed to a heatwave, which is charming and
    // is not evidence; what IS evidence is that the tempo drops by half and
    // the bass becomes the lead instrument in the space of one season.
    //
    // WHAT SEPARATES IT FROM ITS TWO NEIGHBOURS, in fields, because three
    // Kingston anchors within seven years is exactly where a catalog starts
    // lying: ska (1962) runs at 156 with the horns on the off-beat and the
    // drums walking; rocksteady is 78 with the snare on 3 alone and a
    // WRITTEN, melodic, syncopated bass line — `bassStyle: "sixteenths"` is
    // the nearest word for a part that busy; reggae (1969) puts the kick
    // back on 3 with it (the one drop) and takes the organ's shuffle away.
    rocksteady: {
      label: "Kingston 1966", voices: 3, near: "reggae",
      plan: "song", bpm: 78,
      // LINEAGE: ska is the band and the island; motown is the other half
      // and it is not a guess — Jamaican producers were cutting versions of
      // Detroit records that year and the bass writing comes straight off
      // them.
      parents: { ska: 0.6, motown: 0.4 },
      wants: [],
      instr: ["clean_guitar", "percussive_organ", "trombone"],
      drumkit: "room",
      entry: v => v * 2, reg: v => (v === 1 ? -1 : v === 2 ? 0 : 0),
      realize: v => (v === 1 ? "pad" : "line"),
      part: ["riff", "pad", "lead"],
      roots: [0, 5, 3, 4], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "sixteenths",
      // THE SNARE IS ON 3 AND NOWHERE ELSE, which is the whole rhythmic
      // claim: no backbeat, one cross-stick in the middle of the bar, and
      // the guitar's skank filling 2 and 4 instead of the drummer.
      kit: { k: [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             p: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      kitVel: { h: [7,0,4,0, 7,0,4,0, 7,0,4,0, 7,0,5,0] },
      fill: { s: [0,0,0,0, 0,0,0,0, 1,0,1,0, 1,1,0,0] },
      tone: { wave: "triangle", cut: 2300, q: 1.0, atk: .008, rel: .7, gain: .27, verb: .34 },
      words: ["the guitar, skanking on 2 and 4",
              "the organ, holding the chord",
              "the trombone, on the head"],
      word: v => (v === 1 ? [drop(4)] : v === 2 ? [transpose(-5), drop(2)] : []),
    },

    // DANCEHALL — Kingston 1985, and it is the rung `reggaeton` and
    // `afrobeats` have BOTH declared `wants: ["dancehall"]` for.
    //
    // THE YEAR is "Under Mi Sleng Teng": Wayne Smith and Noel Davey over a
    // preset from a Casio MT-40 keyboard, King Jammy's, 1985. It is the most
    // precisely dated record in this batch and arguably in the catalog — one
    // riddim, one machine, one afternoon, and Jamaican music is digital from
    // then on. THE MACHINE IS THE ANCHOR'S IDENTITY, which is why the tone
    // block is a cheap square lead and the kit is `electronic`: the whole
    // point of Sleng Teng is that it sounds like a toy.
    //
    // A RIDDIM IS ONE CHORD AND EVERYBODY'S SONG. `harmony: "modal"` is the
    // honest reading of a form where fifty singers voice the same two-bar
    // loop: nothing modulates, because the backing track does not know which
    // song it is under.
    dancehall: {
      label: "Kingston 1985", voices: 2, near: "electro",
      plan: "dance", bpm: 100,
      parents: { reggae: 0.4, dub: 0.3, electro: 0.3 },
      wants: [],
      instr: ["bass_lead", "square_lead"],
      drumkit: "electronic",
      entry: v => v, reg: v => (v === 0 ? -1 : 0), realize: () => "line",
      part: ["riff", "lead"],
      harmony: "modal", mode: MODES.aeolian, scale: DIATONIC, diatonic: true,
      artic: "staccato", maxHold: 1, bassStyle: "octaves",
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1] },
      kitVel: { h: [8,0,5,0, 7,0,5,0, 8,0,5,0, 7,0,5,5] },
      fill: { k: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,1,0,0] },
      tone: { wave: "square", cut: 2400, q: 2.2, atk: .003, rel: .3, gain: .28, verb: .2 },
      words: ["the bass line, which is the riddim",
              "the melody preset over the top of it"],
      word: v => (v === 1 ? [transpose(12), drop(2)] : []),
    },

    // HUAYNO — Cusco 1965. The Andes' own song and dance, and the only
    // anchor in this batch whose alphabet is a MINOR PENTATONIC rather than
    // a European scale — which is not a decoration, it is the tradition: the
    // huayno melody moves in five notes and turns back on itself, and the
    // harmony under it is a Spanish import laid on afterwards.
    //
    // THE YEAR is the Andean migration recordings — the decade the music
    // came down to the coastal cities and onto 45s, which is when there is
    // anything to date at all.
    //
    // TWO OF THE THREE INSTRUMENTS ARE HONEST AND ONE IS NOT. The Andean
    // HARP is a real harp and `harp` is one; the siku IS a panpipe and
    // `pan_flute` is a recording of one — the fourth registry id this round
    // unlocks by name, with a parent window of [59,88] and no anchor that
    // had ever asked for it. The charango is the stand-in: a small
    // ten-string lute with a bright, tight, doubled sound, standing in as a
    // steel-string guitar, and what is lost is the octave-paired courses and
    // the size.
    huayno: {
      label: "Cusco 1965", voices: 3, near: "worldfolk",
      plan: "song", bpm: 124,
      parents: {},
      wants: ["pre-columbian andean song", "yaraví"],
      cannot: ["the siku's interlock — a panpipe pair is TWO players sharing " +
               "one scale a note each, and this box gives the whole scale to " +
               "one chair"],
      instr: ["pan_flute", "steel_string_guitar", "harp"],
      drumkit: "acoustic",
      entry: v => v, reg: v => (v === 0 ? 1 : v === 1 ? 0 : -1),
      realize: v => (v === 2 ? "pad" : "line"),
      part: ["lead", "counter", "pad"],
      roots: [0, 2, 0, 4], mode: MODES.aeolian,
      artic: "staccato", maxHold: 2, bassStyle: "eighths",
      // THE BOMBO IS THE ONLY DRUM: a big skin-headed drum played on the
      // head and the rim, so the kick carries the head and `p` the rim, and
      // there is no hat because there is no cymbal within a thousand miles
      // of the tradition.
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             p: [0,0,1,0, 1,0,0,0, 0,0,1,0, 1,0,0,0] },
      kitVel: { k: [9,0,0,0, 0,0,6,0, 9,0,0,0, 0,0,6,0] },
      fill: { p: [1,0,1,0, 1,0,1,0, 1,1,1,0, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2500, q: 1.0, atk: .01, rel: .8, gain: .26, verb: .42 },
      words: ["the siku, the tune", "the charango, doubling it faster",
              "the harp, holding the two chords"],
      word: v => (v === 1 ? [split(2), drop(2)] : v === 2 ? [drop(4)] : []),
    },

    // MARIACHI — Guadalajara 1950. The trumpet-era mariachi: two trumpets in
    // thirds, a section of violins, a vihuela chopping, a guitarrón walking
    // the bass in octaves, and a ranchera on top of it.
    //
    // THE YEAR is Mariachi Vargas at its RCA peak and the ranchera's film
    // decade — the moment the trumpet is standard, which it was not before
    // the 1930s. That instrument, not the ensemble, is what dates this.
    //
    // THE PRIMARY FACT IS THE ENSEMBLE, AND SO IT SHIPS. The sesquiáltera —
    // the son jalisciense's 6/8 crossed against 3/4, two players counting
    // differently in the same bar — is in `cannot` below and is NOT the
    // primary fact: a mariachi is a mariachi playing a ranchera in four, and
    // the metre it cannot say belongs to one corner of the repertory. That
    // is the primary-fact rule applied in the direction it is meant to go.
    //
    // NO DRUM KIT AT ALL. A mariachi has no percussion — the vihuela's
    // chop and the guitarrón are the rhythm section — so `kit: {}` here is
    // the same kind of truest-line-in-the-entry that zema's is, and for the
    // same reason: the absence IS the ensemble.
    mariachi: {
      label: "Guadalajara 1950", voices: 3, bars: 8, near: "nortena",
      plan: "song", bpm: 96,
      parents: {},
      wants: ["son jalisciense", "canción ranchera", "spanish romance"],
      cannot: ["the sesquiáltera — six-eight against three-four inside one " +
               "bar, which needs two metres at once and this file writes one"],
      instr: ["trumpet", "violin", "nylon_string_guitar"],
      entry: v => v, reg: v => (v === 0 ? 0 : v === 1 ? 1 : -1),
      realize: () => "line",
      part: ["lead", "counter", "riff"],
      roots: [0, 0, 4, 4, 0, 3, 4, 0], mode: MODES.ionian,
      scale: SCALES.major, diatonic: true,
      artic: "legato", maxHold: 3, kit: {},
      // THE GUITARRÓN WALKS IN OCTAVES, which is literally what it does —
      // six strings tuned so the player fingers one note and sounds two an
      // octave apart. `octaves` is not an approximation here, it is the
      // instrument's description.
      bassStyle: "octaves",
      tone: { wave: "sawtooth", cut: 2700, q: 1.0, atk: .01, rel: .8, gain: .27, verb: .4 },
      words: ["the first trumpet", "the violins, a third above",
              "the vihuela, chopping the chord"],
      word: v => (v === 1 ? [transpose(4)] : v === 2 ? [split(2), drop(3)] : []),
    },

    // NORTEÑA — Monterrey 1955. A conjunto norteño is two men: a diatonic
    // button accordion and a BAJO SEXTO, a twelve-string bass guitar that
    // plays the chords and the bass at once. The repertory is corridos and
    // rancheras over a polka the German and Czech settlers of the border
    // left behind, which is why the rhythm below is a polka and says so.
    //
    // THE YEAR is Los Alegres de Terán's Falcon and RCA sides, when the
    // accordion-and-bajo duet becomes the border's standard record.
    //
    // `corridotumbado` DECLARED `wants: ["banda", "norteño"]` AND NOW HAS
    // BOTH — its parents line, which named `worldfolk` (Johannesburg 1986)
    // at 0.30 because nothing nearer existed, is rewritten below. That edge
    // is one of the two WORLD.md §4 caught running.
    nortena: {
      label: "Monterrey 1955", voices: 3, near: "vallenato",
      plan: "song", bpm: 132,
      parents: {},
      wants: ["corrido fronterizo", "bohemian polka", "redova"],
      cannot: ["the diatonic accordion's push-pull, the same fact vallenato " +
               "declares one continent south"],
      instr: ["accordion", "steel_string_guitar", "solo_vox"],
      drumkit: "acoustic",
      entry: v => v, reg: v => (v === 1 ? -1 : 0), realize: () => "line",
      part: ["lead", "riff", "counter"],
      roots: [0, 4, 4, 0], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "fifths",
      // A POLKA, WRITTEN AS ONE: kick on the beat, snare on the off-beat,
      // nothing clever. The tololoche's oom-pah is in `bassStyle: "fifths"`
      // one line up, which is the only place in this catalog that word
      // means what it means in a brass band.
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,1,0, 0,0,1,0, 1,1,1,0] },
      tone: { wave: "sawtooth", cut: 2600, q: 1.2, atk: .008, rel: .5, gain: .28, verb: .24 },
      words: ["the accordion", "the bajo sexto, chords and bass at once",
              "the second voice, a third under the first"],
      word: v => (v === 1 ? [drop(3), transpose(-12)] : v === 2 ? [transpose(-3)] : []),
    },

    // BANDA — Mazatlán 1938. A Sinaloan brass band: clarinets on the tune,
    // trumpets and trombones answering, a TUBA playing the bass line on its
    // feet, and a tambora — a big two-headed drum — with a tarola beside it.
    // No strings, no electricity, and it has been the loudest music in
    // northwest Mexico for a century.
    //
    // THE YEAR is Banda El Recodo's founding in Mazatlán, 1938 — which is
    // documented and is also, deliberately, the same year as Kansas City
    // below: two brass bands on two continents in one year is a correlation
    // worth being able to see on the slider.
    //
    // TWO IDS AND A FLOOR. `tuba` was cast exactly once in 139 anchors — by
    // a record from 2023 — so the catalog's floor for it was 2023 and a
    // 1938 brass band could not have hired one. Extraction is a FLOOR OVER
    // THE CATALOG'S OWN CLAIMS and it moves when the catalog learns
    // something: a tuba in 1938 is not a claim anyone need argue with, and
    // `clarinet` (first cast by Barranquilla 1960 above) drops to 1938 with
    // it for the same reason.
    banda: {
      label: "Mazatlán 1938", voices: 3, near: "nortena",
      plan: "dance", bpm: 128,
      parents: {},
      wants: ["german military band", "son sinaloense"],
      instr: ["clarinet", "brass_section", "tuba"],
      drumkit: "acoustic",
      entry: v => v, reg: v => (v === 0 ? 1 : v === 1 ? 0 : -2),
      realize: () => "line",
      part: ["lead", "riff", "counter"],
      roots: [0, 4, 0, 4], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "fifths",
      // THE TAMBORA IS A KICK AND A LOW TOM AT ONCE — one drum, two heads,
      // one player hitting both — and the tarola's press roll is the snare.
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,1,0, 1,0,1,0, 0,0,1,0, 1,0,1,0],
             l: [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0],
             x: [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
      kitVel: { s: [4,0,4,0, 8,0,4,0, 4,0,4,0, 8,0,5,0] },
      fill: { s: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 2800, q: 1.1, atk: .01, rel: .6, gain: .28, verb: .36 },
      words: ["the clarinets, the tune", "the brass, answering in blocks",
              "the tuba, on its feet"],
      word: v => (v === 1 ? [rotate(8), transpose(-5)] : v === 2 ? [drop(4), transpose(-12)] : []),
    },

    // TROPICÁLIA — São Paulo 1968. Bossa nova's harmony, an electric rock
    // band, and an orchestral arranger, all on the same record and
    // deliberately not resolving. Caetano, Gil, Os Mutantes and Rogério
    // Duprat, and the record that names it is the manifesto album of 1968.
    //
    // WHAT THIS ANCHOR CAN AND CANNOT CLAIM. Tropicália's method is
    // COLLAGE — a berimbau against a fuzz guitar against a Strauss quote —
    // and a collage is a per-section decision the arranger makes, not an
    // anchor field. What this entry holds is the three ingredients: bossa's
    // chord vocabulary (`mode: mixo`, an eight-bar cycle that will not sit
    // on the tonic), a fuzz guitar, and a string section over the top.
    // The seams are in `cannot`.
    //
    // THE FUZZ MOVES A FLOOR BY ONE YEAR. `crunch_guitar` extracted to 1969
    // off London; a fuzzbox in São Paulo in 1968 is a year earlier and is
    // not in dispute.
    tropicalia: {
      label: "São Paulo 1968", voices: 3, bars: 8, near: "psychpop",
      plan: "arc", bpm: 104,
      // LINEAGE: bossa is the harmony and the language, psychpop is the
      // studio and the band, samba is underneath both of them and is named
      // because tropicália reached PAST bossa for it on purpose.
      parents: { bossa: 0.4, psychpop: 0.35, samba: 0.25 },
      wants: ["concrete poetry", "musique concrète"],
      cannot: ["the collage itself — a quotation cut against the record is " +
               "a per-section editorial decision and this file writes " +
               "anchors, not edits"],
      instr: ["nylon_string_guitar", "crunch_guitar", "strings"],
      drumkit: "room",
      entry: v => v * 2, reg: v => (v === 2 ? -1 : 0),
      realize: v => (v === 2 ? "pad" : "line"),
      part: ["lead", "riff", "pad"],
      roots: [0, 5, 1, 4, 2, 5, 3, 4], mode: MODES.mixo,
      scale: SCALES.major, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "walk",
      fx: ["sweep"],
      kit: { k: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,0,1, 0,1,0,0, 1,0,0,1, 0,1,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,1,0, 0,1,1,0, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 2200, q: 1.1, atk: .01, rel: .9, gain: .26, verb: .44 },
      words: ["the nylon guitar, the bossa half",
              "the fuzz, the rock half",
              "the strings, the arranger's half"],
      word: v => (v === 1 ? [transpose(-12), only("acc", rotate(2))]
                : v === 2 ? [drop(4)] : []),
    },

    /* ---- AFRICA, THE SECOND SLATE -------------------------------------
       Nine anchors on top of the ten the African round landed on 2026-08-25,
       and every one of them is a rung that round named or a `wants` entry it
       left on the books: palm-wine (highlife's own first `wants` line),
       kwela (marabi's), mbaqanga (worldfolk's AND kwaito's), soukous (the
       sebene congorumba's entry describes and stops short of), benga,
       makossa, hiplife, kizomba and coupé-décalé — and the last three take
       the continent's representation past 2001 for the first time.
       The six the round DEFERRED BY NAME — jeliya, jùjú, taarab,
       gnawa, mbalax, chimurenga — stay deferred, and their reasons are not
       re-derived here. Everything below is in four and in 12-TET for the
       same reason everything above it is. */

    // PALM-WINE — Freetown 1950, and it pays the FIRST line of highlife's
    // `wants`. The West African coastal guitar music the Kru sailors carried
    // up and down the Atlantic seaboard: a two-finger picked guitar, a voice,
    // a box the player sits on, and a saw or a bottle keeping time. It is the
    // grandparent of highlife, of jùjú and of half the guitar music on the
    // continent.
    //
    // THE YEAR is Ebenezer Calender's Sierra Leone Broadcasting sides, which
    // is where maringa/palm-wine is actually on tape. The music is older and
    // was played in bars nobody recorded, which is marabi's situation exactly
    // and gets marabi's treatment: the label names the recording.
    //
    // WHAT SEPARATES IT FROM ACCRA 1957, its own child: highlife is a DANCE
    // BAND — horns, changes every four bars, 120 bpm. This is one guitar and
    // one voice at 96 over two chords, and the two-finger pattern is the
    // whole style, which is why `word` gives voice 1 the same line thinned
    // and rotated rather than a harmony part.
    palmwine: {
      label: "Freetown 1950", voices: 2, near: "highlife",
      plan: "song", bpm: 96,
      // LINEAGE: a ROOT. The parents are the Kru sailors' guitar, the
      // Trinidadian and Cuban 78s that came off the same ships, and Krio
      // song, and the catalog holds none of them. `son` (Havana 1928) is a
      // named PARENT at a real weight and not a courtesy: those are literally
      // the records that circulated in West African ports.
      parents: { son: 0.3 },
      wants: ["kru sailors' guitar", "maringa", "krio song"],
      instr: ["nylon_string_guitar", "solo_vox"],
      drumkit: "brush",
      entry: v => v * 2, reg: v => -v, realize: () => "line",
      part: ["riff", "lead"],
      // THE LILT IS REAL AND IT IS ALSO A MEASUREMENT. Palm-wine guitar is
      // played with a long-short bounce and the swing dial at a third is this
      // file's only word for one — and drafted straight, on mento's own
      // three-chord cycle, this anchor sat 0.245 from Kingston 1952 in the
      // genealogy's 28-feature space, tighter than anything the catalog held
      // before this round. Two guitar-and-voice records from opposite sides
      // of the Atlantic SHOULD be neighbours; they should not be the same
      // point. The bounce and the two-chord cycle are both true of the music.
      swing: 0.33,
      roots: [0, 0, 0, 4], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 2,
      // A CARPENTER'S SAW AND A BOTTLE. The saw is scraped and goes to the
      // hat lane with the rest of this file's scrapers; the bottle struck
      // with a nail is `p`. There is no kick and no snare, because there is
      // no drummer — that is the whole texture.
      kit: { p: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      kitVel: { h: [7,0,5,0, 6,0,5,0, 7,0,5,0, 6,0,5,0] },
      tone: { wave: "triangle", cut: 2400, q: 0.9, atk: .005, rel: .6, gain: .26, verb: .34 },
      words: ["the guitar, two fingers and no plectrum",
              "the singer, over the top of it"],
      word: v => (v === 1 ? [rotate(4), drop(2)] : []),
    },

    // KWELA — Johannesburg 1955, and it pays marabi's `wants` line. Township
    // pennywhistle music: a boy on a cheap tin flute over a guitar, a
    // tea-chest bass and a hand on a suitcase, played on street corners
    // because a pennywhistle is what you can afford and a corner is where you
    // can watch for the police.
    //
    // THE YEAR is Spokes Mashiyane's "Ace Blues" and the kwela boom on Gallo
    // and Trutone — a documented, dated, commercial explosion.
    //
    // THE RECORDER IS THE SAME STAND-IN MARABI MADE and it is made here for
    // the same reason and with the same loss: right family (both are fipple
    // flutes, which is why not `whistle`, GM's recording of a person
    // whistling), and what is missing is the pennywhistle's overblown top and
    // its bent notes, which is most of what a kwela player does with it. The
    // difference from Johannesburg 1935 is that there the flute was a colour
    // on top of an organ and here it IS the record.
    kwela: {
      label: "Johannesburg 1955", voices: 3, near: "marabi",
      plan: "dance", bpm: 138,
      // LINEAGE: marabi is the four-bar cycle, verbatim — kwela plays
      // marabi's own I-IV-I⁶₄-V and this entry keeps the inversion to prove
      // it — and the American swing 78s that reached the townships are the
      // other half and are now in the catalog.
      parents: { marabi: 0.65, swing: 0.35 },
      wants: [],
      cannot: ["the pennywhistle's overblown top octave and its half-holed " +
               "bends, which is where a kwela player lives"],
      instr: ["recorder", "steel_string_guitar", "banjo"],
      drumkit: "brush",
      entry: v => v, reg: v => (v === 0 ? 1 : v === 1 ? 0 : -1),
      realize: () => "line",
      part: ["lead", "riff", "counter"],
      roots: [0, 3, 0, 4], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      prog: [{ d: 0 }, { d: 3 }, { d: 0, inv: 2 }, { d: 4 }],
      artic: "staccato", maxHold: 1, bassStyle: "walk",
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      kitVel: { h: [8,4,6,4, 8,4,6,4, 8,4,6,4, 8,4,6,5] },
      fill: { s: [0,0,0,0, 1,0,1,0, 0,0,1,1, 1,1,1,1] },
      tone: { wave: "triangle", cut: 3000, q: 1.1, atk: .004, rel: .4, gain: .27, verb: .3 },
      words: ["the pennywhistle, all of it",
              "the guitar, chopping the cycle",
              "the second guitar, in the holes"],
      word: v => (v === 1 ? [drop(2)] : v === 2 ? [rotate(4), transpose(-5), drop(3)] : []),
    },

    // MBAQANGA — Johannesburg 1964, and it is the rung TWO anchors have been
    // waiting for: `worldfolk` wants it and `kwaito` wants it. The Mavuthela
    // studio band's music — an electric guitar playing a cycling figure, a
    // saxophone, a groaning bass voice underneath, and a beat the labels
    // called "the sound of the city".
    //
    // THE YEAR is Gallo's Mavuthela sessions under Rupert Bopape, the moment
    // the studio band, the groaner and the female chorus become one house
    // style. The Makgona Tsohle Band is the ensemble the name attaches to.
    //
    // WHAT SEPARATES IT FROM ITS TWO NEIGHBOURS: kwela (1955) is a
    // pennywhistle and a swing feel at 138; this is an electric guitar and a
    // straight four at 116 with a bass playing sixteenths. And where marabi's
    // cycle is I-IV-I⁶₄-V, mbaqanga's is three chords that never resolve —
    // it just keeps going round, which is why `harmony` stays `cycle` and the
    // roots line has no dominant in it.
    mbaqanga: {
      label: "Johannesburg 1964", voices: 3, near: "kwela",
      plan: "dance", bpm: 116,
      parents: { kwela: 0.45, marabi: 0.3, mbube: 0.25 },
      wants: [],
      instr: ["clean_guitar", "tenor_sax", "ahh_choir"],
      drumkit: "room",
      entry: v => v, reg: v => (v === 0 ? 0 : v === 1 ? 0 : -1),
      realize: v => (v === 2 ? "pad" : "line"),
      part: ["riff", "lead", "pad"],
      roots: [0, 3, 4, 3], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "sixteenths",
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1] },
      kitVel: { h: [8,0,5,0, 7,0,5,0, 8,0,5,0, 7,0,5,5] },
      fill: { s: [0,0,0,0, 1,0,1,0, 0,0,1,0, 1,1,1,0] },
      tone: { wave: "triangle", cut: 2600, q: 1.2, atk: .005, rel: .45, gain: .27, verb: .28,
              // the female chorus behind the groaner: a room, not a section
              mouth: MOUTHS.mbubestack },
      words: ["the lead guitar, the cycling figure",
              "the sax, answering it",
              "the chorus behind the groaner"],
      word: v => (v === 1 ? [rotate(8), drop(2)] : v === 2 ? [drop(4)] : []),
    },

    // SOUKOUS — Kinshasa 1985. Congolese rumba with the rumba taken out and
    // the SEBENE left: the fast, cycling, interlocking guitar section a
    // rumba record used to arrive at after four minutes of singing, played
    // for the whole record at a tempo nothing in Kinshasa 1960 approaches.
    //
    // THE YEAR is the mid-eighties Paris-and-Kinshasa records — Kanda Bongo
    // Man's "Iyole" era — when the song half was dropped and the band went
    // straight to the guitars.
    //
    // ITS PARENT'S OWN ENTRY DESCRIBES IT. congorumba (Kinshasa 1960)
    // already writes a mi-solo "and in the sebene it never stops"; this is
    // that sentence made into a record, at 148 instead of 112, with the
    // animateur's shouted cues on the snare and a third guitar.
    soukous: {
      label: "Kinshasa 1985", voices: 3, near: "congorumba",
      plan: "dance", bpm: 148,
      parents: { congorumba: 0.8, disco: 0.2 },
      wants: [],
      instr: ["clean_guitar", "steel_string_guitar", "nylon_string_guitar"],
      drumkit: "room",
      entry: v => v, reg: v => (v === 0 ? 1 : v === 1 ? 0 : -1),
      realize: () => "line",
      part: ["lead", "counter", "riff"],
      roots: [0, 3, 4, 0], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 1, bassStyle: "sixteenths",
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,1,1, 0,1,1,0, 1,0,1,1, 0,1,1,0],
             o: [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      kitVel: { h: [8,5,6,5, 7,5,6,5, 8,5,6,5, 7,5,6,6] },
      fill: { p: [1,1,1,1, 1,1,1,0, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "triangle", cut: 3200, q: 1.1, atk: .003, rel: .3, gain: .27, verb: .24 },
      words: ["the solo guitar, running the sebene",
              "the mi-solo, interlocked a third under it",
              "the rhythm guitar, in what is left"],
      word: v => (v === 1 ? [transpose(-3), rotate(2)] : v === 2 ? [drop(2), rotate(6)] : []),
    },

    // BENGA — Nairobi 1972. Luo guitar music from western Kenya on Nairobi
    // labels: a bright, fast, treble-heavy guitar line that is a NYATITI
    // PART transferred to strings — the eight-string lyre's ostinato played
    // on a guitar, which is a documented, deliberate translation and not a
    // stand-in this file is inventing.
    //
    // THE YEAR is D.O. Misiani and Shirati Jazz's early-seventies sides, when
    // benga is the dominant Kenyan sound and is on record every week.
    //
    // WHY IT IS NOT A COPY OF SOUKOUS, thirteen years earlier and one country
    // west: benga is faster off the bass — the bass line is the LEAD melodic
    // voice for whole passages, which is why `bassStyle` is `sixteenths` here
    // as it is in Kinshasa but the reg function puts the guitar chairs HIGH
    // and thins them; and the harmony is two chords, not four.
    benga: {
      label: "Nairobi 1972", voices: 3, near: "soukous",
      plan: "dance", bpm: 140,
      // LINEAGE: a ROOT under protest, and the protest is the whole point.
      // Benga's parent is the nyatiti repertory and the Luo ohangla drum
      // tradition, neither of which is here. congorumba is named at 0.3
      // because Congolese records genuinely were the model for the guitar
      // sound in East Africa — that much is documented — and NOT because it
      // is the nearest African anchor, which is the reasoning this round
      // exists to stop.
      parents: { congorumba: 0.3 },
      wants: ["nyatiti", "ohangla", "dodo"],
      instr: ["clean_guitar", "steel_string_guitar", "solo_vox"],
      drumkit: "room",
      entry: v => v, reg: v => (v === 0 ? 1 : v === 1 ? 1 : 0),
      realize: () => "line",
      part: ["riff", "counter", "lead"],
      // TWO BARS A CHORD, not one: a benga cycle sits on the tonic for half
      // its length and then goes, which halves the harmonic rate against
      // `merengue`'s bar-by-bar alternation. Drafted as [0,4,0,4] the two
      // anchors sat 0.268 apart in the genealogy's feature space — two very
      // fast four-bar I-V records, one in Nairobi and one in Santo Domingo,
      // reading as one point.
      roots: [0, 0, 4, 4], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 1, bassStyle: "sixteenths",
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      kitVel: { h: [9,4,6,4, 8,4,6,4, 9,4,6,4, 8,4,6,5] },
      fill: { s: [0,0,0,0, 1,1,1,1, 0,0,0,0, 1,1,1,1] },
      tone: { wave: "triangle", cut: 3300, q: 1.2, atk: .003, rel: .3, gain: .27, verb: .22 },
      words: ["the guitar, the nyatiti figure moved onto strings",
              "the second guitar, a third above",
              "the singer, over both"],
      word: v => (v === 1 ? [transpose(4), drop(2)] : v === 2 ? [drop(3), rotate(8)] : []),
    },

    // MAKOSSA — Douala 1972. Cameroon's own dance music, and the record that
    // dates it is Manu Dibango's "Soul Makossa" — a saxophone over a bass
    // line, a guitar chopping, and a beat that turned out to be exportable
    // enough that American disco took it whole.
    //
    // WHAT SEPARATES IT FROM AFROBEAT, twelve months and one country apart:
    // afrobeat is one dorian chord and two drummers for eight minutes; this
    // is a four-bar major cycle at 118 with ONE drummer and a bass line that
    // is the hook. The horn is the same tenor and it is doing a different job
    // — riffing on the cycle rather than answering a call.
    makossa: {
      label: "Douala 1972", voices: 3, near: "afrobeat",
      plan: "dance", bpm: 118,
      // LINEAGE: a ROOT under protest. Makossa comes out of the ambasse bey
      // and the assiko of the Douala coast, and out of the Congolese records
      // that were everywhere in central Africa by 1960 — the second is here
      // and the first two are not. `funk` is NOT named: the funk arrives in
      // this music the same year the record does, from the same Atlantic
      // exchange, and calling Cincinnati 1967 its parent would repeat the
      // exact error afrobeat's own lineage was repaired for.
      parents: { congorumba: 0.35 },
      wants: ["ambasse bey", "assiko", "bikutsi"],
      instr: ["tenor_sax", "clean_guitar", "brass_section"],
      drumkit: "room",
      entry: v => v, reg: v => (v === 1 ? 0 : v === 2 ? -1 : 0),
      realize: () => "line",
      part: ["lead", "riff", "counter"],
      roots: [0, 3, 4, 0], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "sixteenths",
      kit: { k: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,1,0, 0,1,0,1, 1,0,1,0, 0,1,0,1],
             h: [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1] },
      kitVel: { h: [9,0,5,6, 8,0,5,6, 9,0,5,6, 8,0,5,7] },
      fill: { p: [1,1,1,0, 1,1,1,0, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 2900, q: 1.2, atk: .005, rel: .4, gain: .28, verb: .26 },
      words: ["the sax, the riff everyone knows",
              "the guitar, chopping under it",
              "the horns, on the turnaround"],
      word: v => (v === 1 ? [only("acc", rotate(2)), drop(2)] : v === 2 ? [rotate(12), drop(3)] : []),
    },

    // HIPLIFE — Accra 1998. Highlife's own grandchild: Reggie Rockstone
    // rapping in Twi over highlife guitar figures and a programmed kit. The
    // catalog holds Accra 1957 and nothing else Ghanaian for forty-one years.
    //
    // THE YEAR is "Makaa Maka", the record that names the form.
    hiplife: {
      label: "Accra 1998", voices: 2, near: "boombap",
      plan: "dance", bpm: 100,
      parents: { highlife: 0.4, boombap: 0.35, afrobeat: 0.25 },
      wants: [],
      instr: ["clean_guitar", "warm_pad"],
      drumkit: "electronic",
      entry: v => v, reg: v => -v, realize: v => (v === 1 ? "pad" : "line"),
      part: ["riff", "pad"],
      roots: [0, 3, 4, 0], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "octaves",
      kit: { k: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,0,1, 0,0,1,0, 0,0,1,0, 1,0,0,0],
             h: [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1] },
      fill: { s: [0,0,0,0, 1,0,1,0, 0,0,1,1, 1,1,0,0] },
      tone: { wave: "triangle", cut: 2500, q: 1.1, atk: .006, rel: .5, gain: .27, verb: .3 },
      words: ["the guitar, highlife's own figure",
              "the pad, under the rap"],
      word: v => (v === 1 ? [drop(4)] : []),
    },

    // KIZOMBA — Luanda 1995. Angola's slow couple dance: semba's language at
    // half the speed, with a drum machine and a Caribbean lilt in the bass.
    // The catalog has never held an Angolan record.
    //
    // THE YEAR is the mid-nineties, when the name settles and the form is
    // distinct from semba on record rather than in a dance hall.
    //
    // LINEAGE: `worldfolk` IS NOT NAMED HERE, which is worth saying out loud
    // in an entry that could easily have taken it: the parents are semba
    // (Luanda, absent, on `wants`) and the Antillean zouk of Kassav', which
    // is Tier 2 above because no dot for it can be proved on land. So this
    // anchor is honestly PARENTLESS on its Caribbean side and says so
    // rather than conscripting the nearest African anchor.
    kizomba: {
      label: "Luanda 1995", voices: 3, near: "rai",
      plan: "song", bpm: 92,
      parents: {},
      wants: ["semba", "zouk", "kilapanga"],
      instr: ["clean_guitar", "polysynth", "solo_vox"],
      drumkit: "electronic",
      entry: v => v, reg: v => (v === 1 ? -1 : 0),
      realize: v => (v === 1 ? "pad" : "line"),
      part: ["riff", "pad", "lead"],
      roots: [0, 5, 3, 4], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "octaves",
      kit: { k: [1,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             h: [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1] },
      kitVel: { h: [8,0,4,5, 7,0,4,5, 8,0,4,5, 7,0,4,6] },
      fill: { p: [0,0,1,1, 0,1,1,0, 1,0,1,1, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2300, q: 1.0, atk: .01, rel: .8, gain: .26, verb: .4 },
      words: ["the guitar, picking the cycle",
              "the synth pad under it",
              "the singer"],
      word: v => (v === 1 ? [drop(4)] : v === 2 ? [rotate(4), drop(2)] : []),
    },

    // COUPÉ-DÉCALÉ — Abidjan 2003. Ivorian club music made in the Paris
    // diaspora and sent home: a programmed floor, a shouted ad-lib culture,
    // a synth stab, and the atalaku's percussion breaks lifted straight off
    // Kinshasa's ndombolo. It is the newest African anchor in the catalog and
    // the only West African one after 2001.
    //
    // THE YEAR is the Jet Set's first records and the coining of the name in
    // 2002-03. Abidjan is the dot because that is where it landed and became
    // a national music, and the comment is where the Paris half belongs.
    coupedecale: {
      label: "Abidjan 2003", voices: 2, near: "amapiano",
      plan: "dance", bpm: 122,
      parents: { soukous: 0.45, house: 0.3, dancehall: 0.25 },
      wants: ["ndombolo", "zouglou"],
      instr: ["polysynth", "clean_guitar"],
      drumkit: "electronic",
      entry: v => v, reg: v => -v, realize: () => "line",
      part: ["riff", "counter"],
      harmony: "modal", mode: MODES.aeolian, scale: DIATONIC, diatonic: true,
      artic: "staccato", maxHold: 1, bassStyle: "octaves",
      kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             s: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,1,1, 0,1,1,0, 1,0,1,1, 0,1,1,1],
             h: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0] },
      fill: { p: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 3100, q: 1.6, atk: .003, rel: .25, gain: .28, verb: .2 },
      words: ["the synth stab", "the guitar, ndombolo's own figure"],
      word: v => (v === 1 ? [rotate(4), drop(2)] : []),
    },

    /* ---- EAST ASIA -----------------------------------------------------
       Five anchors, against the two the catalog held (Tokyo 1984, Seoul
       2012) — and the oldest of the two was a 1984 city-pop record, so East
       Asia's entire representation was the last forty years of pop.

       WHY THESE FIVE AND NOT THE ONES EVERYONE WOULD NAME FIRST. WORLD.md
       §2's measurement is that Chinese scale material sits 10 cents from
       12-TET at worst — the tuning is NOT the wall for East Asia. The walls
       are METRE (jingju's banshi and gagaku's jo-ha-kyū are a metre CHANGING
       inside one record, which precompose.js writes as `meter: null` for all
       139 anchors) and INSTRUMENTS (China has no id at all — no erhu, dizi,
       pipa, guzheng or suona). So what ships is the half of East Asia that
       is a Western dance band, a Western pop group or a shamisen and a
       string section: five records that genuinely are those things.

       AND THE ONE THAT DID NOT SHIP FOR A REASON THAT IS NOT MUSICAL:
       Okinawan pop (Naha 1992) is 12-TET, in four, and castable on
       `shamisen` — the sanshin is the shamisen's own ancestor — and it is
       held back only because `atlas-land.js` has no Ryukyus in it and the
       nearest baked land to Naha is 5.3 degrees away. See TIER 2 above. */

    // SHIDAIQU — Shanghai 1940, and it is the first Chinese record in the
    // catalog. "Yellow music": a Chinese pentatonic tune sung by a woman in
    // a high, light, unvibratoed voice over a Western dance band, cut in the
    // Shanghai studios of the late thirties and early forties.
    //
    // THE YEAR is Zhou Xuan's peak and the Pathé/EMI Shanghai sessions —
    // documented recordings, in a city with a recording industry.
    //
    // WHY IT IS TIER 1 WHEN CHINESE MUSIC GENERALLY IS NOT: this record is a
    // JAZZ BAND. The tuning is 12-TET because the band is playing Western
    // instruments in Western temperament; the metre is four because it is a
    // foxtrot; the melody is the Chinese half and its five notes are inside
    // the JND of a piano's five notes. Everything the box cannot say about
    // Chinese music — the erhu's portamento, the qin's timbre, the opera's
    // banshi — is absent from this repertory by construction.
    //
    // THE ALPHABET IS `majpent` AND THAT IS THE ANCHOR'S WHOLE CLAIM. Five
    // notes at 2.4 semitones a step against the band's seven — the same
    // device zema uses against Rome — so the tune MOVES differently from
    // everything else the dance band is playing.
    shidaiqu: {
      label: "Shanghai 1940", voices: 3, near: "crooner",
      plan: "song", bpm: 92,
      // LINEAGE: `swing` UNDER PROTEST, in the bossa and mbube house style.
      // The band, the arrangement and the recording chain are the American
      // dance band, whole, and Kansas City 1938 is now in the catalog two
      // years earlier. What the weight cannot say is the LARGER half — the
      // Chinese folk-song repertory the melodies come out of, which has no
      // anchor and cannot have one under this round's walls.
      parents: { swing: 0.6 },
      wants: ["chinese folk song", "shanghai opera"],
      cannot: ["the erhu's continuous portamento between the notes of the " +
               "pentatonic, which is the ornament this box has no channel for"],
      instr: ["solo_vox", "tenor_sax", "jazz_guitar"],
      drumkit: "jazz",
      swing: 0.33,
      entry: v => v, reg: v => (v === 1 ? -1 : 0), realize: () => "line",
      part: ["lead", "counter", "riff"],
      roots: [0, 5, 1, 4], mode: MODES.ionian, scale: SCALES.majpent,
      artic: "legato", maxHold: 3, bassStyle: "walk",
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             r: [1,0,0,1, 1,0,0,1, 1,0,0,1, 1,0,0,1],
             f: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0] },
      kitVel: { r: [8,0,0,5, 7,0,0,5, 8,0,0,5, 7,0,0,6] },
      tone: { wave: "triangle", cut: 2600, q: 0.9, atk: .01, rel: 1.0, gain: .26, verb: .4,
              // WHO SINGS: high, light, straight and forward — the Shanghai
              // singers' own sound, which is nearly the OPPOSITE of the
              // American belter of the same decade, and the row that gets
              // closest is the Bulgarian one for the same reason: no wobble,
              // very little air, and the tone pressed rather than floated.
              mouth: MOUTHS.bulgar },
      words: ["the singer", "the sax, answering the phrase",
              "the guitar, comping"],
      word: v => (v === 1 ? [rotate(8), drop(2)] : v === 2 ? [drop(3)] : []),
    },

    // ENKA — Tokyo 1969. The Japanese sentimental ballad: a minor
    // yonanuki scale (a five-note minor with the second and sixth taken
    // out), a shamisen and a string section, and a singer whose whole art is
    // the ornament on the way into the note.
    //
    // THE YEAR is the late-sixties enka boom — Fuji Keiko, Mori Shin'ichi —
    // when the word means this music rather than the Meiji protest song it
    // originally named.
    //
    // THE SHAMISEN IS REAL AND IS THE FIFTH ID THIS ROUND UNLOCKS BY NAME.
    // `shamisen` is a licensed on-disk registry id with a parent window of
    // [43,84] that no anchor had ever asked for. What is NOT claimed is the
    // sawari — the deliberate buzz where the lowest string touches the neck
    // — which is the Japanese equivalent of the sitar's jawari and which
    // this file has no way to ask for.
    //
    // THE PRIMARY FACT SHIPS AND THE ORNAMENT DOES NOT. Enka's primary fact
    // is the yonanuki melody and the ballad form, and both are here.
    // KOBUSHI — the rapid, wide, deliberately unstable ornament on the
    // approach to a note — is in `cannot`: `orn` below carries `grace` and
    // `approach`, which are ATTACK shapes, and kobushi is a pitch trajectory
    // INSIDE the note. That is WORLD.md §5.3's wall, stated in one anchor.
    enka: {
      label: "Tokyo 1969", voices: 3, near: "crooner",
      plan: "song", bpm: 72,
      // LINEAGE: a ROOT under protest, and both halves are real. Enka is the
      // Japanese ryūkōka of the twenties and thirties on one side and the
      // Western sentimental ballad orchestra on the other; `crooner` (Los
      // Angeles 1953) is genuinely the second half — the arrangement, the
      // microphone technique and the string writing — and is named at a
      // weight that says half and not all.
      parents: { crooner: 0.4 },
      wants: ["ryūkōka", "min'yō"],
      cannot: ["kobushi — the ornament that bends the pitch INSIDE the note, " +
               "where this box has seven attack shapes and no pitch " +
               "trajectory (the `orn` table is `grace` and `approach`)",
               "the shamisen's sawari buzz"],
      instr: ["solo_vox", "shamisen", "strings"],
      entry: v => v, reg: v => (v === 1 ? 0 : v === 2 ? -1 : 0),
      realize: v => (v === 2 ? "pad" : "line"),
      part: ["lead", "counter", "pad"],
      roots: [0, 3, 4, 0], mode: MODES.aeolian, scale: SCALES.majpent,
      artic: "legato", maxHold: 4, bassStyle: "pedal",
      orn: { grace: 0.4, approach: 0.3 },
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      kitVel: { h: [6,0,4,0, 6,0,4,0, 6,0,4,0, 6,0,4,0] },
      drumkit: "brush",
      tone: { wave: "triangle", cut: 2100, q: 0.8, atk: .02, rel: 1.4, gain: .26, verb: .46,
              // WHO SINGS: the melisma row — an alto holding one vowel over
              // several notes, two beats before the mouth moves — because
              // that is the closest this table gets to a voice whose whole
              // business is what happens between the syllables.
              mouth: MOUTHS.melisma },
      words: ["the singer", "the shamisen, answering the line",
              "the strings, underneath"],
      word: v => (v === 1 ? [rotate(8), drop(2)] : v === 2 ? [drop(4)] : []),
    },

    // TROT — Seoul 1965, and it gives the catalog a Korean record
    // forty-seven years older than the one it had. The Korean ballad in
    // duple time with a hard two-beat lilt, a minor pentatonic melody and a
    // trumpet or an accordion answering the singer.
    //
    // THE YEAR is the mid-sixties, when trot is the dominant Korean popular
    // form and the recording industry is domestic.
    //
    // WHAT SEPARATES IT FROM ENKA, which is a fair question and a
    // historically loaded one: the two forms grew up beside each other under
    // the same colonial recording industry and share the yonanuki scale.
    // In fields they differ in TEMPO and in FEEL — trot is 108 with a hard
    // two-beat bounce (the swing dial at a third, which is what this file has
    // for a lilt) where enka is 72 and rubato-leaning with a string pad; and
    // trot's cast is a horn where enka's is a shamisen.
    trot: {
      label: "Seoul 1965", voices: 3, near: "enka",
      plan: "song", bpm: 108,
      parents: { crooner: 0.35 },
      wants: ["pansori", "changga", "min'yo"],
      cannot: ["the kkeokkneun-mok — the same bent-inside-the-note ornament " +
               "enka calls kobushi, and the same missing channel"],
      instr: ["solo_vox", "trumpet", "accordion"],
      drumkit: "brush",
      swing: 0.33,
      entry: v => v, reg: v => (v === 2 ? -1 : 0), realize: () => "line",
      part: ["lead", "counter", "riff"],
      roots: [0, 3, 4, 0], mode: MODES.aeolian, scale: SCALES.majpent,
      artic: "legato", maxHold: 3, bassStyle: "octaves",
      orn: { grace: 0.35 },
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      kitVel: { k: [9,0,0,0, 0,0,0,0, 7,0,0,0, 0,0,0,0],
                h: [8,0,4,0, 7,0,4,0, 8,0,4,0, 7,0,5,0] },
      fill: { s: [0,0,0,0, 1,0,1,0, 0,0,1,0, 1,1,1,0] },
      tone: { wave: "triangle", cut: 2400, q: 0.9, atk: .012, rel: 1.0, gain: .27, verb: .38,
              mouth: MOUTHS.belter },
      words: ["the singer", "the trumpet, answering",
              "the accordion, holding the two-beat"],
      word: v => (v === 1 ? [rotate(8), drop(3)] : v === 2 ? [drop(2)] : []),
    },

    // CANTOPOP — Hong Kong 1984. The Cantonese ballad and mid-tempo pop of
    // the eighties: a synthesiser and a drum machine, a big reverbed
    // arrangement, and a melody that has to fit Cantonese's six tones, which
    // is a constraint no other pop tradition works under.
    //
    // THE YEAR is Leslie Cheung and Anita Mui's breakout — the moment
    // Cantopop stops being a local variant of Mandarin pop and becomes the
    // regional standard.
    //
    // AND THE TONE CONSTRAINT IS A PERMANENT LIMITATION, NOT A QUEUE ITEM,
    // and it is the same one the African round wrote down for the same
    // reason: a Cantopop melody must not fight the lexical tone of its own
    // lyric, and `deg` in this kernel is "SIGNED and alphabet-free… never an
    // absolute pitch" (kernel.js:8), which is precisely the property that
    // stops a TEXT constraining it. It is in `cannot` and it will stay there.
    cantopop: {
      label: "Hong Kong 1984", voices: 3, near: "citypop",
      plan: "song", bpm: 96,
      // LINEAGE: Shanghai 1940 is the Chinese-language pop song itself —
      // the shidaiqu singers moved to Hong Kong in 1949 and took the
      // industry with them, which is a migration and not a resemblance —
      // and Tokyo 1984 is the eighties production. `crooner` is the third
      // because the Cantopop ballad's microphone technique is that record's.
      // (`powerballad`, Los Angeles 1991, was the obvious third and is SEVEN
      // YEARS LATER than this label; a parent that postdates its child is
      // exactly the kind of claim the fit tool on `main` cannot know is
      // loose talk.)
      parents: { shidaiqu: 0.35, citypop: 0.35, crooner: 0.3 },
      wants: ["cantonese opera"],
      cannot: ["a melody bound to the lyric's own lexical tone — `deg` is " +
               "signed and alphabet-free and never an absolute pitch, which " +
               "is exactly what stops a text constraining it"],
      instr: ["solo_vox", "polysynth", "warm_pad"],
      drumkit: "electronic",
      entry: v => v, reg: v => (v === 2 ? -1 : 0),
      realize: v => (v === 2 ? "pad" : "line"),
      part: ["lead", "counter", "pad"],
      roots: [0, 5, 3, 4], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "legato", maxHold: 4, bassStyle: "octaves",
      fx: ["chorus"],
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
             o: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,1,0, 0,0,1,1, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 2400, q: 1.0, atk: .02, rel: 1.2, gain: .26, verb: .58,
              mouth: MOUTHS.melisma },
      words: ["the singer", "the synth, answering the line",
              "the pad, holding the chord"],
      word: v => (v === 1 ? [rotate(4), drop(2)] : v === 2 ? [drop(4)] : []),
    },

    // MANDOPOP — Taipei 2003. The Jay Chou moment: R&B phrasing and a hip-hop
    // kit under a Mandarin ballad, with a "Chinese style" pentatonic hook
    // played on something that is meant to sound like a guzheng.
    //
    // AND THAT LAST CLAUSE IS THE ANCHOR'S OWN ADMISSION. There is no
    // guzheng, no pipa and no erhu in the registry — China is the emptiest
    // instrument slot on the map after the maqam countries. `koto` is the
    // SIXTH id this round unlocks by name and it is a JAPANESE zither: a
    // long half-tube board zither with movable bridges, plucked, which is the
    // same INSTRUMENT FAMILY as the guzheng and a different country's
    // instrument with a different tuning convention. It is cast here with the
    // loss written down rather than left for a listener to notice, and it is
    // the only cast in this round that borrows an instrument across a border.
    mandopop: {
      label: "Taipei 2003", voices: 3, near: "darkrnb",
      plan: "song", bpm: 88,
      parents: { cantopop: 0.4, rnb: 0.35, boombap: 0.25 },
      wants: [],
      cannot: ["the guzheng, the pipa and the erhu — China has no id in the " +
               "registry, and the `koto` cast below is a Japanese zither " +
               "standing in for a Chinese one, which is a borrowed country " +
               "and not only a borrowed instrument"],
      instr: ["solo_vox", "koto", "rhodes_ep"],
      drumkit: "electronic",
      entry: v => v, reg: v => (v === 1 ? 1 : v === 2 ? -1 : 0),
      realize: v => (v === 2 ? "pad" : "line"),
      part: ["lead", "counter", "pad"],
      roots: [0, 5, 3, 4], mode: MODES.aeolian, scale: SCALES.majpent,
      artic: "legato", maxHold: 3, bassStyle: "octaves",
      kit: { k: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1] },
      kitVel: { h: [8,0,4,5, 7,0,4,5, 8,0,4,5, 7,0,4,6] },
      fill: { h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2300, q: 1.0, atk: .015, rel: 1.0, gain: .26, verb: .48,
              mouth: MOUTHS.falsetto },
      words: ["the singer", "the zither hook",
              "the electric piano, under the verse"],
      word: v => (v === 1 ? [transpose(12), drop(3)] : v === 2 ? [drop(4)] : []),
    },

    /* ---- SOUTHEAST ASIA ------------------------------------------------
       Six anchors into a region the catalog held ZERO of. Every one of them
       is a Western-instrument popular music of the twentieth century, which
       is not a coincidence and is not a dodge: gamelan is Tier 2 for two
       walls at once (tuning AND a non-2:1 period, which `degPitch`'s
       `12*floor(d/len)` makes unsayable), and mo lam and the Thai piphat are
       Tier 2 for metre and instruments. What is left is real, large, deeply
       loved and entirely playable: kroncong, dangdut, luk thung, Manila
       sound, nhạc vàng and Cambodian rock. */

    // KRONCONG — Jakarta 1935, and it is the oldest Southeast Asian record
    // the catalog can hold. A Portuguese-descended Indonesian chamber music:
    // a small plucked ukulele-like instrument (the kroncong itself, which
    // names the whole style) playing an interlocking figure with a second
    // one, a cello played PIZZICATO like a drum, a flute or a violin on the
    // counter-melody, and a singer over the top.
    //
    // THE YEAR is the pre-war Jakarta recording industry and "Bengawan Solo"
    // is five years the other side of it; 1935 is the decade's centre with
    // a studio in it.
    //
    // THE MOST SURPRISING TIER-1 ANCHOR IN THE BATCH, and the reason is
    // historical: kroncong descends from sixteenth-century Portuguese
    // sailors' music, is tuned in Western temperament, is in four, and is
    // played on instruments the registry actually has. It is the one
    // Indonesian music that is not behind the gamelan wall — and its
    // presence is the clearest possible statement of where that wall
    // actually runs.
    kroncong: {
      label: "Jakarta 1935", voices: 3, near: "choro",
      plan: "song", bpm: 84,
      parents: {},
      wants: ["portuguese fado of the sailors", "moresco", "stambul theatre song"],
      instr: ["solo_vox", "nylon_string_guitar", "flute"],
      entry: v => v, reg: v => (v === 1 ? 1 : v === 2 ? 1 : 0),
      realize: () => "line",
      part: ["lead", "riff", "counter"],
      roots: [0, 4, 0, 4], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "legato", maxHold: 3,
      // THE CELLO IS THE DRUM KIT. A kroncong ensemble has no percussion at
      // all — the pizzicato cello plays the rhythm — so `kit` is empty and
      // the pulse lives in the bass, which is why `bassStyle` is
      // `sixteenths` on a record at 84 bpm. That is not a busy bass line,
      // it is a drummer.
      kit: {}, bassStyle: "sixteenths",
      tone: { wave: "triangle", cut: 2500, q: 0.85, atk: .008, rel: .8, gain: .26, verb: .38,
              mouth: MOUTHS.monody },
      words: ["the singer", "the kroncong, the interlocking figure",
              "the flute, the counter-melody"],
      word: v => (v === 1 ? [split(2), drop(2)] : v === 2 ? [invert(4), drop(3)] : []),
    },

    // DANGDUT — Jakarta 1975. Indonesia's own mass popular music, named
    // after the sound of its drum: a gendang playing the DANG and the DUT
    // that give it the name, a suling flute curling round the vocal, an
    // electric guitar and a bass, and a melody with the Hindi film song and
    // the Malay orkes melayu in it in equal measure.
    //
    // THE YEAR is Rhoma Irama's Soneta Group era, when orkes melayu becomes
    // dangdut and the guitars arrive.
    //
    // THE DRUM IS THE GENRE AND IT IS TWO LANES. The gendang's two strokes
    // are the whole hook — a low open DANG on the and-of-4 into the bar and
    // a slapped DUT on the beat — so the kick carries one and `p` the other,
    // and the loss is the pitch bend a player gets by pressing the head with
    // a heel, which a sampled kick cannot do.
    dangdut: {
      label: "Jakarta 1975", voices: 3, near: "filmi",
      plan: "dance", bpm: 112,
      // LINEAGE: filmi is the melody and the string writing and it is not a
      // resemblance — Bombay films played in Indonesian cinemas throughout
      // the fifties and sixties and the debt is documented; kroncong is the
      // Indonesian half; rock is the guitars, which arrive with Rhoma Irama
      // and are the reason 1975 and not 1965.
      parents: { filmi: 0.4, kroncong: 0.3, rock: 0.3 },
      wants: ["orkes melayu", "qasidah"],
      cannot: ["the gendang's pressed pitch-bend between the dang and the " +
               "dut, which is a drum head being squeezed and this kit has " +
               "twelve fixed samples"],
      instr: ["solo_vox", "flute", "clean_guitar"],
      drumkit: "acoustic",
      entry: v => v, reg: v => (v === 1 ? 1 : v === 2 ? 0 : 0),
      realize: () => "line",
      part: ["lead", "counter", "riff"],
      roots: [0, 3, 4, 0], mode: MODES.aeolian, scale: DIATONIC, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "octaves",
      orn: { grace: 0.3, approach: 0.25 },
      kit: { k: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      kitVel: { k: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,9,0],
                p: [8,0,0,5, 0,0,7,0, 8,0,0,5, 0,0,7,0] },
      fill: { p: [1,0,1,1, 0,1,1,0, 1,1,0,1, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2600, q: 1.1, atk: .008, rel: .7, gain: .27, verb: .34,
              mouth: MOUTHS.melisma },
      words: ["the singer", "the suling, curling round the vocal",
              "the guitar, on the cycle"],
      word: v => (v === 1 ? [rotate(4), drop(2)] : v === 2 ? [drop(3)] : []),
    },

    // LUK THUNG — Bangkok 1970. Thai country song: a rural voice with a very
    // wide, very slow vibrato, a small Western band behind it, and a khaen
    // or a phin somewhere in the arrangement. It is the music of the Isan
    // migration to Bangkok and it is the biggest popular form in Thailand.
    //
    // THE YEAR is the Suraphon-to-Phumphuang transition and the decade luk
    // thung is named as a genre rather than described as "songs from the
    // fields".
    //
    // THE TUNING NEEDS A SENTENCE. Thai CLASSICAL music is seven equal
    // steps to the octave — genuinely not 12-TET and genuinely a wall — but
    // luk thung is played on Western instruments in Western temperament,
    // which is why it and not the piphat ensemble is what ships. The claim
    // this anchor makes is exactly that: the popular form, on a guitar band.
    lukthung: {
      label: "Bangkok 1970", voices: 3, near: "countrypop",
      plan: "song", bpm: 100,
      parents: {},
      wants: ["mo lam", "thai folk song", "luk krung"],
      cannot: ["the khaen — a bamboo mouth organ whose fixed pitches are " +
               "seven equal steps to the octave, which is not this box's " +
               "twelve"],
      instr: ["solo_vox", "clean_guitar", "brass_section"],
      drumkit: "acoustic",
      entry: v => v, reg: v => (v === 2 ? -1 : 0), realize: () => "line",
      part: ["lead", "riff", "counter"],
      roots: [0, 3, 4, 0], mode: MODES.ionian, scale: SCALES.majpent,
      artic: "legato", maxHold: 4, bassStyle: "eighths",
      orn: { grace: 0.45 },
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,1,0, 0,0,1,0, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2400, q: 1.0, atk: .012, rel: .9, gain: .27, verb: .42,
              // WHO SINGS: the widest, latest wobble in the table, which is
              // what a luk thung singer's ûan actually is
              mouth: MOUTHS.belter },
      words: ["the singer", "the guitar, on the cycle",
              "the horns, answering the line"],
      word: v => (v === 1 ? [drop(2)] : v === 2 ? [rotate(8), drop(3)] : []),
    },

    // MANILA SOUND — Manila 1976. Filipino soft rock and disco-pop sung in
    // Taglish: close harmony, a clean electric guitar, an electric piano and
    // a light kit. It is the beginning of what became OPM, and the catalog
    // has never held a Philippine record.
    //
    // THE YEAR is Hotdog's "Manila" and the Cinema Audio sessions.
    //
    // WHY NOT KUNDIMAN, which would be the older and the more obviously
    // "traditional" choice: the kundiman is in THREE, and this file's cells
    // are sixteen places long. It is named in Tier 2 above with the metre
    // wall, and this anchor is what the region has that the box can play.
    manilasound: {
      label: "Manila 1976", voices: 3, near: "yachtsoul",
      // 112, AN OPEN HAT AND A WALKING-EIGHTHS BASS, WHICH IS A MEASUREMENT
      // AND NOT A TASTE. Drafted at 108 with an octave bass and a plain hat
      // this anchor sat 0.234 from `cantopop` in the genealogy's own
      // 28-feature space — tighter than ANY pair the catalog held before this
      // round (yachtrock/coastrock, 0.311) and well inside the 0.380 the
      // African slate flagged zema at. The two records are not the same
      // music: Manila Sound is a live band in a room with a Rhodes and a
      // disco eighth-note bass, and Hong Kong 1984 is a drum machine and a
      // synthesiser in a big plate. Three fields say so.
      plan: "song", bpm: 112,
      // LINEAGE: Philadelphia 1976 is the smooth-soul arrangement and
      // Liverpool 1963 is the close harmony, both of which a Manila Sound
      // record wears openly. (`disco` was the obvious third and it is New
      // York 1977, one year AFTER this label — near enough to be tempting
      // and still the wrong direction, so Detroit 1965 takes the weight.)
      parents: { blueeyedsoul: 0.4, merseybeat: 0.3, motown: 0.3 },
      wants: ["kundiman", "rondalla"],
      instr: ["solo_vox", "clean_guitar", "rhodes_ep"],
      drumkit: "room",
      entry: v => v, reg: v => (v === 2 ? -1 : 0),
      realize: v => (v === 2 ? "pad" : "line"),
      part: ["lead", "riff", "pad"],
      roots: [0, 5, 1, 4], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "legato", maxHold: 3, bassStyle: "eighths",
      kit: { k: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             o: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
             h: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,1] },
      fill: { s: [0,0,0,0, 1,0,1,0, 0,0,1,0, 1,1,1,0] },
      tone: { wave: "triangle", cut: 2500, q: 1.0, atk: .01, rel: .8, gain: .26, verb: .36,
              mouth: MOUTHS.merseystack },
      words: ["the lead voice", "the guitar, clean and high",
              "the Rhodes, under both"],
      word: v => (v === 1 ? [rotate(4), drop(2)] : v === 2 ? [drop(4)] : []),
    },

    // NHẠC VÀNG — Ho Chi Minh City 1968. "Golden music": the Vietnamese
    // sentimental song of the pre-1975 south, sung slowly over a bolero
    // rhythm — literally a bolero, borrowed from Latin America through
    // French colonial radio and kept as the national ballad feel ever since.
    //
    // THE CITY IS SPELLED HO CHI MINH CITY THOUGH THE RECORD SAYS 1968,
    // when it was Saigon. That is the Kinshasa precedent applied unchanged:
    // atlas.js gate G3 enforces ONE SPELLING PER PLACE and a second name for
    // the same coordinates would put two dots where there is one city. The
    // old name is in this comment, which is where a historical fact that is
    // not a map dot belongs.
    //
    // ITS RHYTHM IS ITS COUSIN'S. The kit below is the bolero anchor's own
    // cinquillo, which is not a coincidence to be hidden — it is the
    // documented route, and putting the two anchors' `p` lanes side by side
    // is the clearest thing this catalog can say about it.
    nhacvang: {
      label: "Ho Chi Minh City 1968", voices: 3, near: "bolero",
      plan: "song", bpm: 70,
      parents: { bolero: 0.45, crooner: 0.25 },
      wants: ["cải lương", "ca trù", "french chanson"],
      cannot: ["the đàn bầu's monochord glide — one string and a lever, all " +
               "pitch and no fret, which is the continuous gesture WORLD.md " +
               "§5.3 says this box has no channel for"],
      instr: ["solo_vox", "nylon_string_guitar", "strings"],
      entry: v => v, reg: v => (v === 2 ? -1 : 0),
      realize: v => (v === 2 ? "pad" : "line"),
      part: ["lead", "counter", "pad"],
      roots: [0, 5, 1, 4], mode: MODES.aeolian, scale: DIATONIC, diatonic: true,
      artic: "legato", maxHold: 4, bassStyle: "octaves",
      kit: { p: [1,0,1,1, 0,1,0,0, 1,0,1,1, 0,1,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      kitVel: { h: [6,0,4,0, 6,0,4,0, 6,0,4,0, 6,0,4,0] },
      tone: { wave: "triangle", cut: 2200, q: 0.85, atk: .02, rel: 1.3, gain: .26, verb: .46,
              mouth: MOUTHS.melisma },
      words: ["the singer", "the guitar, between the lines",
              "the strings, underneath"],
      word: v => (v === 1 ? [transpose(5), rotate(8), drop(3)] : v === 2 ? [drop(4)] : []),
    },

    // KHMER ROCK — Phnom Penh 1970. Cambodian rock and roll: surf guitar and
    // a Farfisa organ under a Khmer vocal, made in a two-year window before
    // the musicians who made it were killed. Sinn Sisamouth, Ros Serey
    // Sothea, Pan Ron.
    //
    // THE YEAR is the peak of the Phnom Penh scene, and the honest thing to
    // note beside it is that the recordings survive as tape copies rather
    // than as masters — the archive is a diaspora reconstruction. That does
    // not change the date; it changes what "documented" means here, and a
    // reader is entitled to know which.
    //
    // WHAT SEPARATES IT FROM `psychpop` (London 1968), which is the nearest
    // thing in the catalog by sound: the melody. This anchor reads its
    // subject through a five-note alphabet where London reads seven, so the
    // same guitar band plays a line that MOVES half again as far per step —
    // the same device zema uses against Rome and shidaiqu uses against its
    // own dance band.
    khmerrock: {
      label: "Phnom Penh 1970", voices: 3, near: "psychpop",
      plan: "song", bpm: 124,
      parents: { psychpop: 0.35, rock: 0.3 },
      wants: ["khmer folk song", "mahori"],
      instr: ["clean_guitar", "percussive_organ", "solo_vox"],
      drumkit: "room",
      entry: v => v, reg: v => (v === 1 ? -1 : 0),
      realize: v => (v === 1 ? "pad" : "line"),
      part: ["riff", "pad", "lead"],
      roots: [0, 3, 4, 0], mode: MODES.aeolian, scale: SCALES.majpent,
      artic: "staccato", maxHold: 2, bassStyle: "eighths",
      fx: ["tremolo"],
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,1,0, 1,0,1,0, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 2700, q: 1.3, atk: .005, rel: .5, gain: .28, verb: .44,
              mouth: MOUTHS.poplead },
      words: ["the guitar, with the tremolo on it",
              "the organ, holding the chord",
              "the singer"],
      word: v => (v === 1 ? [drop(4)] : v === 2 ? [rotate(8), drop(2)] : []),
    },

    /* ---- SOUTH ASIA ----------------------------------------------------
       Three anchors into a region the catalog held ONE of, and that one was
       a 2022 record. WORLD.md §2 called filmi "the closest" thing in the
       whole program — "shruti is 14c max, inside the JND; the metre is
       mostly 4/4 or a 6/8 keherwa" — and it was right: the wall for South
       Asia was never tuning, it was the percussion kit and the fact that
       nobody had said `sitar` out loud.

       WHAT IS NOT HERE AND WHY, so nobody re-derives it: Hindustani and
       Carnatic classical music are Tier 2 because their primary fact is a
       DRONE plus a rāga that is not a scale — a rāga is a set of phrases,
       ascending and descending forms, and one note you lean on, and this
       box has an alphabet and a mode. Ghazal is Tier 2 under the
       primary-fact rule: its composition IS the setting of a couplet's
       prosody, which is WORLD.md §5.7's wall. Both are named in TIER 2
       above with those reasons and are not argued again. */

    // FILMI — Mumbai 1960. The Hindi film song: a playback singer over an
    // orchestra that has a violin section, a flute, a harmonium, a sitar and
    // a tabla in it at once, singing a melody built on a rāga's material in
    // a form built by a music director for a three-minute scene.
    //
    // THE CITY IS SPELLED MUMBAI THOUGH THE RECORD SAYS 1960, when it was
    // Bombay — the Kinshasa precedent again, and for the same gate.
    //
    // THE YEAR is the Shankar-Jaikishan and Naushad peak and "Mughal-e-Azam";
    // the golden age is roughly 1950-70 and 1960 is its centre with real
    // records either side of it.
    //
    // THE CAST IS UNUSUALLY HONEST FOR A NON-WESTERN ANCHOR AND THAT IS THE
    // POINT. `sitar` is a real licensed id with a parent window of [48,88] —
    // the seventh this round unlocks by name — and a filmi orchestra
    // genuinely has a sitar in it. `reed_organ` IS a harmonium (six zones,
    // every file on disk, confirmed at genres.js:5713). `strings` is a
    // Western string section and a filmi orchestra has one. Nothing here is
    // pretending.
    //
    // WHAT IS: the TABLA. There is no hand drum among the twelve extracted
    // kit WAVs, so keherwa's eight beats are voiced across the kick, the rim
    // and the toms, and the loss is the whole bol language — a tabla player
    // says NA, TIN, GE, DHA and the difference between them is timbre, not
    // level. That is in `cannot` and it is not a small admission.
    filmi: {
      label: "Mumbai 1960", voices: 4, bars: 8, near: "crooner",
      plan: "song", bpm: 92,
      // LINEAGE: a ROOT under protest, and the protest is the larger half.
      // The film song's parents are the Hindustani khayal and thumri, the
      // Parsi theatre song and the regional folk repertories, and none of
      // them can be an anchor under this round's walls. `romantic` (Vienna
      // 1876) is named at a real weight for the ORCHESTRA — the string
      // writing in a Naushad arrangement is nineteenth-century European and
      // is not a resemblance, it is what the arrangers were trained on.
      parents: { romantic: 0.3 },
      wants: ["khayal", "thumri", "parsi theatre song", "bhajan"],
      cannot: ["the tabla's bols — na, tin, ge and dha differ in TIMBRE and " +
               "this kit has twelve fixed samples and a velocity",
               "meend, the slide between the notes of a phrase, which is the " +
               "ornament WORLD.md §5.3 says this box has no channel for"],
      instr: ["solo_vox", "sitar", "strings", "reed_organ"],
      drumkit: "acoustic",
      entry: v => v, reg: v => (v === 1 ? 0 : v === 2 ? -1 : v === 3 ? -1 : 0),
      realize: v => (v >= 2 ? "pad" : "line"),
      part: ["lead", "counter", "pad", "pad"],
      roots: [0, 5, 3, 4, 0, 5, 4, 0], mode: MODES.harmonic,
      scale: DIATONIC, diatonic: true,
      artic: "legato", maxHold: 4, bassStyle: "pedal",
      orn: { grace: 0.5, approach: 0.35 },
      // KEHERWA, VOICED ACROSS FOUR LANES. Eight beats — DHA GE NA TI NA KA
      // DHI NA — with the bass stroke of the bāyāñ on the kick, the ringing
      // NA on the rim, and the closed strokes on the hat. It is written
      // twice in the sixteen-step bar, because a keherwa cycle is eight
      // beats and this bar is sixteen steps of two.
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             p: [1,0,1,0, 1,0,0,1, 1,0,1,0, 1,0,0,1],
             h: [0,0,1,0, 0,1,1,0, 0,0,1,0, 0,1,1,0] },
      kitVel: { p: [9,0,5,0, 7,0,0,4, 9,0,5,0, 7,0,0,5] },
      fill: { p: [1,0,1,1, 1,1,1,1, 1,1,1,0, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2400, q: 0.9, atk: .01, rel: 1.1, gain: .26, verb: .5,
              // WHO SINGS: high, light, forward and nearly straight — the
              // playback singer's sound, and the row that fits it is the
              // Bulgarian one for the third time in this round, because
              // "pressed rather than floated, almost no air" is a thing
              // several traditions do and only one of them is European.
              mouth: MOUTHS.bulgar },
      words: ["the playback singer", "the sitar, answering the line",
              "the strings, underneath", "the harmonium, holding the drone"],
      word: v => (v === 1 ? [rotate(8), drop(2)] : v === 2 ? [drop(4)]
                : v === 3 ? [drop(8)] : []),
    },

    // QAWWALI — Faisalabad 1988. Sufi devotional song: a lead voice, a party
    // of men clapping and singing the refrain back, two harmoniums and a
    // tabla, and a form that starts slow and accelerates for twenty minutes
    // until the room is somewhere else.
    //
    // THE YEAR is Nusrat Fateh Ali Khan's international recordings, when
    // qawwali is on tape at length and in one place.
    //
    // WHY THIS SHIPS AND GHAZAL DOES NOT, which is the primary-fact rule
    // doing exactly the job it was written for. Qawwali's primary facts are
    // the PARTY (a lead and a chorus answering), the HARMONIUM and the
    // CLAPPED CYCLE — and all three are sayable here with no stand-in at
    // all: `reed_organ` is a harmonium, `ahh_choir` is a group of people
    // singing, and the `c` lane is literally handclaps. What it cannot say —
    // the sargam taan, the improvised run on solfège syllables that a lead
    // qawwal builds the ecstatic section out of — is in `cannot`, and it is
    // an ornament, not the identity. Ghazal's missing fact is the identity.
    //
    // AND THE ACCELERATION IS IN `cannot` TOO. A qawwali speeds up across
    // its whole length and nothing in this file can say so: `pace` is a
    // WORLD.md §6 phase-2 field and does not exist yet, and `plan: "arc"` is
    // the nearest shape available — a form that builds, at one tempo.
    qawwali: {
      label: "Faisalabad 1988", voices: 3, bars: 8, near: "gospel",
      plan: "arc", bpm: 104,
      // LINEAGE: a ROOT under protest. The parents are the Chishti sama
      // tradition and Amir Khusrau's synthesis of Persian and Indian song,
      // seven centuries back and unplaceable as anchors. `filmi` is named at
      // a small weight and in one direction only — the recorded, arranged,
      // three-minute qawwali of the late twentieth century learned its
      // production from the film studio, which is a real and dateable debt
      // and is NOT a claim about where the music comes from.
      parents: { filmi: 0.25 },
      wants: ["sama", "khusrau's qaul", "kafi"],
      cannot: ["the sargam taan — the improvised run on solfège syllables " +
               "that is what a lead qawwal DOES, and this box writes " +
               "composed lines",
               "the acceleration across the whole form, which needs a per-" +
               "section pace and this file writes one tempo"],
      instr: ["solo_vox", "ahh_choir", "reed_organ"],
      entry: v => v * 2, reg: v => (v === 1 ? -1 : v === 2 ? -1 : 0),
      realize: v => (v === 2 ? "pad" : "line"),
      part: ["lead", "counter", "pad"],
      roots: [0, 0, 3, 3, 4, 4, 0, 0], mode: MODES.harmonic,
      scale: DIATONIC, diatonic: true,
      artic: "legato", maxHold: 4, nobass: true,
      orn: { grace: 0.55, approach: 0.3 },
      // THE HANDCLAPS ARE HANDCLAPS AND THE TABLA IS NOT A TABLA. `c` is the
      // party clapping on the beat, which is exact; `p` and `k` are the
      // tabla's keherwa again, with the same bol loss filmi declares. There
      // is no kit and no bass — `nobass` — because a qawwali party has
      // neither, and the harmonium's left hand is the only low sound in it.
      kit: { c: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
             k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             p: [1,0,1,0, 1,0,0,1, 1,0,1,0, 1,0,0,1] },
      kitVel: { c: [9,0,0,0, 7,0,0,0, 9,0,0,0, 8,0,0,0] },
      fill: { p: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2300, q: 0.9, atk: .015, rel: 1.2, gain: .27, verb: .56,
              // WHO SINGS: a tenor pushed hard with real air in it and the
              // wobble arriving late — and the party behind him is the
              // ROOM row, ragged on purpose, because a qawwali party is a
              // group of men and not a section
              mouth: MOUTHS.qawwal },
      words: ["the lead qawwal", "the party, answering the refrain",
              "the harmonium, under both"],
      word: v => (v === 1 ? [drop(2), transpose(-5)] : v === 2 ? [drop(8)] : []),
    },

    // BHANGRA — Jalandhar 1972, and it pays `punjabipop`'s own `wants` line.
    // The Punjabi harvest dance and its song repertory as the Punjab's own
    // record industry cut it: a dhol played with two sticks on two heads, a
    // tumbi's single high metal string, a harmonium, and boliyan — rhyming
    // couplets shouted and answered over the drum.
    //
    // THE CITY IS JALANDHAR AND NOT SOUTHALL, and the reason is worth
    // writing down because the first draft of this anchor was British.
    // UK bhangra — Southall 1986, the daytimer circuit, Alaap and Heera — is
    // Tier 1 musically in every respect and it is held back by the MAP: a
    // Southall dot lands 4.9 CSS px from Muswell Hill at the Britain arc,
    // under atlas.gate.js G10's 8.5 px floor, and the two are SIBLING
    // neighbourhoods of one city rather than one inside the other, which is
    // the one relation `WITHIN` cannot declare. Jalandhar is the older and
    // the more directly ancestral anchor anyway — it is the Punjab's own
    // recording centre, it is the same region and language as Chandigarh
    // 2022, and it is fifty years earlier.
    //
    // THE YEAR is the early-seventies Punjabi LP era, when the folk
    // repertory is being recorded commercially rather than danced at a
    // harvest.
    //
    // WHAT IT REPAIRS. `punjabipop` (Chandigarh 2022) declared
    // `worldfolk: 0.40` — Johannesburg 1986 as the largest ancestor of a
    // Punjabi record — because the true parent was absent and the nearest
    // anchor was conscripted. WORLD.md §4 caught that edge running. It is
    // rewritten below.
    bhangra: {
      label: "Jalandhar 1972", voices: 3, near: "punjabipop",
      plan: "dance", bpm: 120,
      // LINEAGE: a ROOT, and there is nothing to protest — the Punjabi folk
      // repertory has no ancestor in this catalog and no anchor here is
      // upstream of it in any direction. `filmi` (Mumbai 1960) is NOT named:
      // the film industry drew ON Punjabi folk music rather than the other
      // way round, and naming it here would run the borrowing backwards.
      parents: {},
      wants: ["boliyan", "punjabi folk song", "jhumar"],
      cannot: ["the tumbi — one string, one finger and no frets, which is a " +
               "continuous-pitch instrument and this box writes semitones",
               "the algoza's paired duct flutes, played by one man breathing " +
               "circularly into both"],
      instr: ["solo_vox", "reed_organ", "steel_string_guitar"],
      drumkit: "acoustic",
      entry: v => v, reg: v => (v === 1 ? -1 : v === 2 ? 1 : 0),
      realize: v => (v === 1 ? "pad" : "line"),
      part: ["lead", "pad", "counter"],
      harmony: "modal", mode: MODES.mixo, scale: SCALES.majpent,
      artic: "staccato", maxHold: 2, bassStyle: "pedal",
      orn: { grace: 0.4 },
      // THE DHOL IS TWO STICKS ON TWO HEADS AND IT GETS TWO LANES: the
      // dagga's bass stroke on the kick and the thilli's cane on the toms,
      // which is the same way punjabipop writes it (genres.js:5975) and the
      // same way raï writes its derbouka one round earlier. What is lost is
      // that one player is doing both and the two hands lock. There is no
      // snare and no hat, because there is no drum kit within a thousand
      // kilometres of a 1972 bhangra session — the chimta's jingles are the
      // only metal and they go on `p`.
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             t: [0,0,1,1, 0,1,0,0, 0,0,1,1, 0,1,0,1],
             p: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0] },
      kitVel: { t: [0,0,7,5, 0,6,0,0, 0,0,7,5, 0,6,0,6] },
      fill: { t: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2500, q: 1.1, atk: .008, rel: .7, gain: .27, verb: .36,
              mouth: MOUTHS.belter },
      words: ["the singer, calling the boli",
              "the harmonium, holding the drone",
              "the tumbi's figure, on one steel string"],
      word: v => (v === 1 ? [drop(8)] : v === 2 ? [transpose(12), split(2), drop(2)] : []),
    },

    /* ---- THE MIDDLE EAST, NORTH AFRICA AND CENTRAL ASIA ----------------
       Six anchors into a region the catalog held two of (Oran 1985, Cairo
       2021), and the round's hardest editorial line runs through it.

       THE LINE IS TUNING AND IT IS MEASURED, NOT FELT. WORLD.md §2: Arab
       rast and bayati put a ~50-cent note on the degree that NAMES the
       maqam, against a melodic JND of 10-20 cents — so tarab, the Arab
       classical tradition, is Tier 2 and is not shipped. But `raï` already
       showed the way out on 2026-08-25: pop-raï "sits largely in a 12-TET
       minor or in HIJAZ", and hijaz, nahawand, kurd and ajam have NO neutral
       intervals in them at all. So what ships here is the popular repertory
       in the twelve-tone maqamat, and every anchor says which maqam it is
       claiming and which it is not.

       AND TURKEY IS NOT EGYPT ON THIS QUESTION. The same table measures
       Turkish uşşak and rast at 19 cents max and 6 cents mean — at or inside
       the JND — so Istanbul is Tier 1 for PITCH. What Istanbul is not Tier 1
       for is NOTATION: the 53-comma system is the tradition's own way of
       writing itself down and this box has twelve names. Turkish classical
       makam is therefore in Tier 2 and arabesk, which is a string orchestra
       and a drum kit, is here.

       THE MODE PROBLEM, SAID ONCE FOR SIX ANCHORS. `MODES` has eight rows
       and none of them is hijaz [0,1,4,5,7,8,10]; adding a ninth changes
       every mode menu in the building because fields.js KEYMODES derives
       from it. That argument was made and lost by `mahraganat` in 2024 and
       again by `raï` in 2025, and two more anchors do not move it. So the
       anchors below name `phrygian` or `harmonic` — phrygian for the flat
       second, harmonic minor for the augmented second — each of which is the
       nearest NAMED alphabet, said by name rather than smuggled in as a
       literal array, and each of which is missing exactly one interval. */

    // SHAABI — Cairo 1978, and it pays `mahraganat`'s `wants` line, which
    // has read `["shaabi"]` since that anchor was written. Egyptian working-
    // class wedding music: a rough, loud, unbeautiful voice over a maqsoum,
    // an accordion or an organ, and a horn line, played at volume in a
    // street tent.
    //
    // THE YEAR is Ahmed Adaweyah's breakthrough — the moment a voice that
    // the state radio would not play sells more cassettes than the ones it
    // would.
    //
    // THE QUARTER TONE IS IN `cannot` AND IS NOT THE PRIMARY FACT. Shaabi
    // uses rast and bayati like everything else in Cairo, and this box
    // cannot say either. What it CAN say is what makes shaabi shaabi — the
    // wedding voice, the maqsoum, the volume and the cheapness — and the
    // maqam it claims here is nahawand, which is a natural minor and has no
    // neutral interval in it at all. The anchor claims the 12-TET half of
    // the repertory and no more of it, in raï's own words.
    shaabi: {
      label: "Cairo 1978", voices: 3, near: "rai",
      plan: "dance", bpm: 112,
      // LINEAGE: a ROOT under protest. Shaabi's parents are the mawwal, the
      // baladi wedding band and the Cairo tarab orchestra, and the third of
      // those is Tier 2 above. Nothing in this catalog is upstream of it, and
      // naming `disco` because Cairo 1978 had a rhythm section would be the
      // conscription this round exists to stop.
      parents: {},
      wants: ["tarab", "mawwal", "baladi"],
      cannot: ["the quarter tone — rast and bayati put a ~50-cent note on the " +
               "degree that names the maqam, and this anchor claims only the " +
               "12-TET half of the repertory"],
      instr: ["solo_vox", "accordion", "brass_section"],
      drumkit: "acoustic",
      entry: v => v, reg: v => (v === 2 ? -1 : 0), realize: () => "line",
      part: ["lead", "counter", "riff"],
      harmony: "modal", mode: MODES.aeolian, scale: DIATONIC, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "octaves",
      orn: { grace: 0.45, approach: 0.3 },
      // THE MAQSOUM, THE SAME FIGURE MAHRAGANAT WRITES FORTY-THREE YEARS
      // LATER: dum on 1, dum on the and-of-2, taks between. Written on an
      // ACOUSTIC kit here because in 1978 a person is holding the drum, which
      // is the one field that separates the two anchors' rhythm sections.
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,1,0, 1,0,0,0, 0,0,1,0, 1,0,1,0],
             p: [0,0,1,1, 0,1,0,1, 0,0,1,1, 0,1,0,1],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,1,0, 1,0,0,1, 1,0,1,0, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 2700, q: 1.3, atk: .006, rel: .5, gain: .28, verb: .32,
              mouth: MOUTHS.belter },
      words: ["the singer", "the accordion, answering the phrase",
              "the horns, on the refrain"],
      word: v => (v === 1 ? [rotate(4), drop(2)] : v === 2 ? [drop(3)] : []),
    },

    // AL-JIL — Cairo 1988. Egyptian synth pop: shaabi's rhythm section on a
    // drum machine, a sequenced bass, a synthesised horn line and a smooth
    // voice — the sound of the Cairo cassette industry at its commercial
    // height, and the direct middle rung between shaabi and mahraganat.
    //
    // THE YEAR is the Hamid El Shaeri / Ehab Tawfik era.
    //
    // WHAT SEPARATES IT FROM `raï`, its exact contemporary one Mediterranean
    // coast west: raï is a drum machine plus an ACCORDION and a trumpet, in
    // phrygian, at 116, and its identity is the Oranese vocal. This is a
    // drum machine plus a SEQUENCER, in harmonic minor for the augmented
    // second that names hijaz-kar, at 104, and its identity is the
    // production. They are cousins and they are not the same record.
    aljil: {
      label: "Cairo 1988", voices: 3, near: "rai",
      plan: "dance", bpm: 104,
      parents: { shaabi: 0.45, synthpop: 0.3, disco: 0.25 },
      wants: [],
      cannot: ["the quarter tone, the same admission shaabi makes ten years " +
               "earlier — `harmonic` carries the augmented second that names " +
               "hijaz and is missing the neutral third of rast"],
      instr: ["solo_vox", "polysynth", "saw_wave"],
      drumkit: "cr78",
      entry: v => v, reg: v => (v === 2 ? -1 : 0),
      realize: v => (v === 2 ? "pad" : "line"),
      part: ["lead", "riff", "pad"],
      harmony: "modal", mode: MODES.harmonic, scale: DIATONIC, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "sixteenths",
      orn: { grace: 0.35 },
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,1,0, 1,0,0,0, 0,0,1,0, 1,0,1,0],
             c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      kitProb: { h: [9,6,9,6, 9,6,9,6, 9,6,9,6, 9,6,9,4] },
      fill: { s: [0,0,1,0, 1,0,1,1, 1,0,1,0, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 3000, q: 1.6, atk: .004, rel: .4, gain: .28, verb: .28,
              mouth: MOUTHS.poplead },
      words: ["the singer", "the synth, on the hook",
              "the sequenced pad under it"],
      word: v => (v === 1 ? [rotate(8), drop(2)] : v === 2 ? [drop(4)] : []),
    },

    // ARABESK — Istanbul 1980. Turkey's great disreputable popular music: a
    // large string orchestra playing a makam melody in unison, a drum kit
    // and a darbuka underneath, and a voice singing about being crushed by
    // the city. Orhan Gencebay, Müslüm Gürses, Ferdi Tayfur.
    //
    // THE YEAR is the height of the arabesk cassette boom, when the state
    // broadcaster still would not play it and it was everywhere anyway.
    //
    // TIER 1 ON PITCH, AND THE MEASUREMENT IS WHY. Turkish uşşak and rast sit
    // 19 cents from 12-TET at worst and 6 on average (WORLD.md §2) — inside
    // the melodic JND — where Arab bayati sits at 50. So a Turkish popular
    // melody is sayable here in a way an Egyptian classical one is not, and
    // this anchor is the clearest evidence in the round that the tuning wall
    // has a shape rather than a side.
    //
    // WHAT IS NOT CLAIMED: the bağlama. A long-necked fretted lute with
    // movable frets set to commas has no honest id — `sitar` is the wrong
    // country and the wrong buzz, `banjo` the wrong body — so the anchor
    // casts what an arabesk record actually leads with, which is THE STRING
    // SECTION, and puts the saz on `wants` rather than on a chair.
    arabesk: {
      label: "Istanbul 1980", voices: 3, bars: 8, near: "romantic",
      plan: "arc", bpm: 88,
      parents: { filmi: 0.35, romantic: 0.2 },
      wants: ["türk sanat müziği", "bağlama âşık song", "egyptian film orchestra"],
      cannot: ["the 53-comma notation — Turkish makam writes itself in commas " +
               "and this box has twelve names, so the PITCH is inside the JND " +
               "and the WRITING is not sayable at all",
               "the bağlama's movable frets"],
      instr: ["solo_vox", "strings", "clean_guitar"],
      drumkit: "room",
      entry: v => v, reg: v => (v === 1 ? 0 : v === 2 ? -1 : 0),
      realize: v => (v === 1 ? "pad" : "line"),
      part: ["lead", "pad", "counter"],
      roots: [0, 0, 3, 3, 4, 4, 0, 0], mode: MODES.phrygian,
      scale: MODES.phrygian, diatonic: true,
      artic: "legato", maxHold: 4, bassStyle: "octaves",
      orn: { grace: 0.5, approach: 0.35 },
      // THE DÜYEK, VOICED ACROSS THREE LANES: düm on 1 and the and-of-2, tek
      // on 2 and 4, and the darbuka's fill between. The same one-player-two-
      // strokes compromise raï makes for its derbouka, said again.
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [0,0,1,1, 0,1,0,1, 0,0,1,1, 0,1,1,1],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { p: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 2200, q: 1.0, atk: .015, rel: 1.3, gain: .27, verb: .54,
              mouth: MOUTHS.belter },
      words: ["the singer", "the strings, in unison with the tune",
              "the guitar, on the off-beat"],
      word: v => (v === 1 ? [drop(4)] : v === 2 ? [only("acc", rotate(2)), drop(2)] : []),
    },

    // ANADOLU ROCK — Istanbul 1972. Turkish psychedelia: a fuzz guitar and a
    // Farfisa playing a folk melody in a makam over a rock rhythm section.
    // Erkin Koray, Barış Manço, Selda Bağcan, Moğollar.
    //
    // THE YEAR is Koray's "Elektronik Türküler" and the peak of the form.
    //
    // WHAT SEPARATES IT FROM `khmerrock`, which is the same idea two years
    // and four thousand kilometres away — and the fact that this catalog can
    // now hold BOTH is a small argument for the whole round: Phnom Penh 1970
    // is a five-note alphabet at 124 with a tremolo on the guitar; this is a
    // SEVEN-note phrygian at 106 with fuzz on it and a saz figure the guitar
    // is playing. Two guitar bands, two continents, two different melodies.
    anadolurock: {
      label: "Istanbul 1972", voices: 3, near: "psychpop",
      plan: "song", bpm: 106,
      parents: { psychpop: 0.35, rock: 0.35 },
      wants: ["türkü", "âşık song"],
      cannot: ["the bağlama's commas, the same wall arabesk declares eight " +
               "years later"],
      instr: ["crunch_guitar", "percussive_organ", "solo_vox"],
      drumkit: "room",
      entry: v => v, reg: v => (v === 1 ? -1 : 0),
      realize: v => (v === 1 ? "pad" : "line"),
      part: ["riff", "pad", "lead"],
      harmony: "modal", mode: MODES.phrygian, scale: MODES.phrygian, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "eighths",
      fx: ["sweep"],
      orn: { grace: 0.4 },
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [0,0,1,1, 0,1,0,0, 0,0,1,1, 0,1,0,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,1,0, 1,0,1,0, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 2500, q: 1.5, atk: .005, rel: .55, gain: .28, verb: .4,
              mouth: MOUTHS.skiffler },
      words: ["the fuzz guitar, playing the türkü",
              "the organ, holding the drone",
              "the singer"],
      word: v => (v === 1 ? [drop(8)] : v === 2 ? [rotate(8), drop(2)] : []),
    },

    // IRANPOP — Tehran 1974. Pre-revolutionary Iranian pop: a Persian melody
    // and a Persian poem over a Western orchestra with a rhythm section,
    // strings and a horn line. Googoosh, Dariush, Ebi.
    //
    // THE YEAR is Googoosh's peak and the last full decade of the Tehran
    // record industry.
    //
    // WHAT IT CLAIMS AND WHAT IT DOES NOT. The Persian classical dastgah
    // system has KORON — a note lowered by roughly a quarter tone — and
    // shur, the most common dastgah, has one on its second degree. That is
    // the bayati wall exactly, and this anchor does not claim it: it claims
    // the pop repertory, which sits in the 12-TET dastgahs (mahur is a major
    // scale, bayat-e esfahan is close to a harmonic minor) and was arranged
    // for an orchestra tuned to a piano. `harmonic` is the named alphabet
    // and the augmented second is the identifying interval it carries.
    iranpop: {
      label: "Tehran 1974", voices: 3, near: "filmi",
      plan: "song", bpm: 100,
      // LINEAGE: Mumbai 1960 is the arrangement and the debt is documented
      // — Hindi films played in Tehran cinemas through the fifties and
      // sixties — and Vienna 1876 is the string writing the Golha orchestra
      // was trained on. (`disco` is New York 1977, three years AFTER this
      // label, so it is not named however much a 1974 Tehran rhythm section
      // sounds like one; `crooner` carries that weight instead.)
      parents: { filmi: 0.3, romantic: 0.2, crooner: 0.2 },
      wants: ["dastgah", "tasnif", "golha radio orchestra"],
      cannot: ["the koron — the quarter-flat second that defines dastgah-e " +
               "shur, which is the same fifty cents that keeps tarab out"],
      instr: ["solo_vox", "strings", "clean_guitar"],
      drumkit: "room",
      entry: v => v, reg: v => (v === 1 ? -1 : 0),
      realize: v => (v === 1 ? "pad" : "line"),
      part: ["lead", "pad", "counter"],
      roots: [0, 3, 4, 0], mode: MODES.harmonic, scale: DIATONIC, diatonic: true,
      artic: "legato", maxHold: 4, bassStyle: "octaves",
      orn: { grace: 0.45, approach: 0.3 },
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [0,0,1,1, 0,1,0,1, 0,0,1,1, 0,1,0,1],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { p: [1,1,1,1, 0,1,1,1, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2300, q: 1.0, atk: .015, rel: 1.1, gain: .26, verb: .5,
              mouth: MOUTHS.melisma },
      words: ["the singer", "the strings, underneath",
              "the guitar, answering the phrase"],
      word: v => (v === 1 ? [drop(4)] : v === 2 ? [rotate(8), drop(2)] : []),
    },

    // KABUL POP — Kabul 1972, and it is the catalog's only Central Asian
    // record. Ahmad Zahir's era: a harmonium and a rubab beside an electric
    // organ and a drum kit, a Persian-language ghazal sung as a pop song, and
    // an audience that included both the radio and the street.
    //
    // THE YEAR is Zahir's peak, a decade before the recording industry it
    // belonged to ended.
    //
    // WHY IT IS HERE WHEN GHAZAL IS TIER 2, which looks like a contradiction
    // and is the primary-fact rule again: the classical ghazal's identity is
    // the setting of the couplet's prosody, and that does not ship. What this
    // anchor claims is a POP RECORD whose lyric happens to be a ghazal —
    // strophic, in four, with a band — and whose primary facts are the
    // harmonium, the tabla and the song form. Those are all sayable.
    kabulpop: {
      label: "Kabul 1972", voices: 3, near: "filmi",
      plan: "song", bpm: 96,
      // LINEAGE: `filmi` UNDER PROTEST and alone. Mumbai 1960 is the
      // arrangement, the harmonium and the song form, and it is genuinely a
      // documented debt — Zahir covered Hindi film songs. Tehran 1974 would
      // be the natural second parent and it is TWO YEARS LATER than this
      // label, so it is not named; the Persian side of this music reaches
      // the record through the language and the poetry, which no anchor
      // carries.
      parents: { filmi: 0.45 },
      wants: ["afghan ghazal", "rubab instrumental", "attan"],
      cannot: ["the rubab's sympathetic strings — a short-necked lute with " +
               "fifteen strings ringing behind three, which no id here has",
               "the tabla's bols, the same admission filmi makes"],
      instr: ["solo_vox", "reed_organ", "steel_string_guitar"],
      drumkit: "acoustic",
      entry: v => v, reg: v => (v === 1 ? -1 : 0),
      realize: v => (v === 1 ? "pad" : "line"),
      part: ["lead", "pad", "counter"],
      roots: [0, 5, 3, 4], mode: MODES.harmonic, scale: DIATONIC, diatonic: true,
      artic: "legato", maxHold: 4, bassStyle: "pedal",
      orn: { grace: 0.5, approach: 0.3 },
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             p: [1,0,1,0, 1,0,0,1, 1,0,1,0, 1,0,0,1],
             h: [0,0,1,0, 0,1,1,0, 0,0,1,0, 0,1,1,0] },
      kitVel: { p: [9,0,5,0, 7,0,0,4, 9,0,5,0, 7,0,0,5] },
      fill: { p: [1,0,1,1, 1,1,1,1, 1,1,1,0, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2300, q: 0.9, atk: .015, rel: 1.2, gain: .26, verb: .52,
              mouth: MOUTHS.qawwal },
      words: ["the singer", "the harmonium, holding the drone",
              "the rubab's figure, on a steel string"],
      word: v => (v === 1 ? [drop(8)] : v === 2 ? [split(2), drop(2)] : []),
    },

    /* ---- EUROPE, THE VERNACULAR HALF -----------------------------------
       Five anchors, and they are deliberately few. The catalog's European
       depth is EARNED KNOWLEDGE and not padding — seventeen pre-1900 anchors
       from Rome 600 to New York 1892 — and a round whose whole purpose is to
       lower the Euro-American share does not get to add fifteen more. What
       these five have in common is that they are the SOUTHERN and CELTIC
       vernacular that the catalog's art-music spine had no room for: a
       Greek hash-den music, a Portuguese dockside song, a Catalan rumba, an
       Irish session and a Serbian brass band. Not one of them is a
       conservatoire tradition and not one of them is in a major key
       throughout. */

    // REBETIKO — Piraeus 1935. The Greek port underworld's music: a bouzouki
    // and a baglamas, a rough voice, a dromos (the Greek word for makam) and
    // a subject matter — hashish, prison, exile — that got it banned by the
    // Metaxas dictatorship the year after this label.
    //
    // THE YEAR is the Piraeus style at its peak on 78s — Markos Vamvakaris
    // and the Piraeus Quartet — and one year before the 1936 censorship.
    //
    // IN FOUR, AND THE ONE THAT IS NOT IS DECLARED. The hasapiko and the
    // hasaposerviko are in four and are most of the repertory; the ZEIBEKIKO
    // — the solo dance every rebetiko record is famous for — is in NINE, and
    // nine is not a metre this file can write. It is in `cannot` and it is
    // not the primary fact: rebetiko is the bouzouki, the dromos and the
    // voice, and this anchor claims the four-square half of the repertory.
    //
    // THE BOUZOUKI IS `steel_string_guitar` and the reasoning is the tres'
    // one country and one ocean away: metal courses played with a plectrum,
    // so the STRING and the ATTACK are right and the body is not. What is
    // lost is the tremolo on a paired course, which is how a bouzouki holds
    // a long note at all.
    rebetiko: {
      label: "Piraeus 1935", voices: 3, near: "tango",
      plan: "song", bpm: 100,
      parents: {},
      wants: ["smyrneiko", "cafe aman", "ottoman makam"],
      cannot: ["the zeibekiko's nine, which is the dance every rebetiko " +
               "record is known for and is a metre this file cannot write",
               "the bouzouki's tremolo on a doubled course"],
      instr: ["steel_string_guitar", "solo_vox", "nylon_string_guitar"],
      entry: v => v, reg: v => (v === 0 ? 1 : v === 2 ? -1 : 0),
      realize: () => "line",
      part: ["riff", "lead", "counter"],
      roots: [0, 4, 0, 4], mode: MODES.phrygian, scale: MODES.phrygian, diatonic: true,
      artic: "staccato", maxHold: 2, bassStyle: "eighths",
      orn: { grace: 0.45, approach: 0.3 },
      // NO DRUM KIT. A Piraeus rebetiko band is two or three fretted
      // instruments and a voice — the rhythm is in the strumming hand and
      // in a set of worry beads — so `kit` is empty and the pulse is the
      // bouzouki's own, which is what `artic: staccato` at `maxHold: 2` says.
      kit: {},
      tone: { wave: "triangle", cut: 2800, q: 1.1, atk: .004, rel: .5, gain: .27, verb: .34,
              mouth: MOUTHS.skiffler },
      words: ["the bouzouki, the taximi and the tune",
              "the singer", "the baglamas, an octave down"],
      word: v => (v === 1 ? [drop(2)] : v === 2 ? [transpose(-12), split(2)] : []),
    },

    // FADO — Lisbon 1955. The Portuguese song of saudade: one voice, a
    // Portuguese guitarra — a twelve-string steel cittern with a fan-shaped
    // tuner and a ringing, weeping sound — and a viola (a plain nylon
    // guitar) holding the harmony under both.
    //
    // THE YEAR is Amália Rodrigues's fifties recordings, when fado becomes
    // the national music on record rather than in a house in Alfama.
    //
    // IN FOUR, WHICH IS TRUE OF HALF THE FORM. Fado corrido and fado
    // menor are in four and this is one of them; the fado from Coimbra and
    // several of the older fados are in three, which this file cannot write,
    // and that is in `cannot`. The primary fact — a voice, a guitarra, and
    // the alternation between them — ships.
    //
    // THE GUITARRA IS `steel_string_guitar` FOR THE THIRD TIME IN THIS ROUND
    // and this is the closest of the three: it is genuinely a steel-strung
    // plucked instrument. What is lost is the doubled courses and the tuning,
    // which is what makes the guitarra ring where a guitar decays.
    fado: {
      label: "Lisbon 1955", voices: 3, near: "bolero",
      plan: "song", bpm: 76,
      parents: {},
      wants: ["lundum", "modinha", "moorish andalusi song"],
      cannot: ["fado corrido's cousins in three — the Coimbra repertory and " +
               "the older fados are in a metre this file's sixteen-place " +
               "cells cannot write"],
      instr: ["solo_vox", "steel_string_guitar", "nylon_string_guitar"],
      entry: v => v, reg: v => (v === 1 ? 1 : v === 2 ? -1 : 0),
      realize: () => "line",
      part: ["lead", "counter", "riff"],
      roots: [0, 4, 0, 4], mode: MODES.phrygian, scale: MODES.phrygian, diatonic: true,
      artic: "legato", maxHold: 4, kit: {}, bassStyle: "eighths",
      orn: { grace: 0.35, approach: 0.4 },
      tone: { wave: "triangle", cut: 2400, q: 0.9, atk: .012, rel: 1.1, gain: .26, verb: .44,
              mouth: MOUTHS.belter },
      words: ["the fadista", "the guitarra, weeping between the lines",
              "the viola, holding the chord"],
      word: v => (v === 1 ? [transpose(12), rotate(8), drop(2)] : v === 2 ? [drop(4)] : []),
    },

    // RUMBA CATALANA — Barcelona 1970. The Catalan Roma rumba: a nylon
    // guitar played with the VENTILADOR — a fanning right hand that strums
    // and slaps the top at once — a bass, palmas, and a sung refrain. Peret,
    // Gato Pérez, and the Gràcia and Hostafrancs Roma neighbourhoods.
    //
    // THE YEAR is Peret's national breakthrough.
    //
    // WHY THIS AND NOT FLAMENCO. Flamenco's primary fact is the COMPÁS — the
    // soleá and the bulería are twelve beats accented 3-6-8-10-12, which
    // this file cannot write at all — so under the primary-fact rule the
    // name does not ship, and it is in Tier 2 above with that reason. The
    // rumba is the corner of the same family that IS in four, because it
    // came back from Cuba in four; claiming the 4/4 corner and saying so is
    // what the whole round does with tuning, applied to metre.
    //
    // THE PALMAS ARE HANDCLAPS AND ARE EXACT — the `c` lane is literally
    // handclaps, the same free hit qawwali gets — and the ventilador's slap
    // on the guitar top is the rim, which is not.
    rumbacatalana: {
      label: "Barcelona 1970", voices: 2, near: "rai",
      plan: "dance", bpm: 116,
      parents: { son: 0.4 },
      wants: ["flamenco rumba", "gitano palo", "guaracha"],
      cannot: ["the flamenco compás — twelve beats accented 3-6-8-10-12, " +
               "which is why the round ships the rumba and not the soleá"],
      instr: ["nylon_string_guitar", "solo_vox"],
      drumkit: "acoustic",
      entry: v => v, reg: v => -v, realize: () => "line",
      part: ["riff", "lead"],
      roots: [0, 4, 0, 4], mode: MODES.phrygian, scale: MODES.phrygian, diatonic: true,
      artic: "staccato", maxHold: 1, bassStyle: "octaves",
      kit: { c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             p: [1,0,1,1, 0,1,1,0, 1,0,1,1, 0,1,1,0],
             h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      kitVel: { p: [9,0,4,5, 0,4,7,0, 9,0,4,5, 0,4,7,0] },
      fill: { p: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2900, q: 1.1, atk: .003, rel: .4, gain: .27, verb: .3,
              mouth: MOUTHS.skiffler },
      words: ["the guitar, the ventilador",
              "the singer, over the palmas"],
      word: v => (v === 1 ? [rotate(4), drop(2)] : []),
    },

    // IRISH TRAD — Dublin 1963. The session repertory as the ballad revival
    // recorded it: a fiddle and a flute playing a reel in unison an octave
    // apart, a tenor banjo picking it, a button accordion, and a bodhrán.
    //
    // THE YEAR is Ceoltóirí Chualann and the Clancy Brothers' Irish return —
    // the moment the music is on LPs rather than in kitchens, which is what
    // this file's labels always name.
    //
    // REELS ARE IN FOUR AND JIGS ARE NOT, and the anchor claims the first.
    // A reel is a straight four with the accent on the first and third of
    // every four semiquavers, which is exactly a sixteen-step bar; a jig, a
    // slip jig and a slide are in compound time and are in `cannot`.
    //
    // THE ONE THING THAT CANNOT BE SAID AT ALL is the ORNAMENT SYSTEM: a
    // cut, a roll and a cran are all articulations of ONE pitch — a grace
    // note above or below that separates two notes of the same degree
    // without changing them — and this file's `orn` table has `roll` in it,
    // which is why the number below is the largest in the catalog. What it
    // cannot do is put a cut BETWEEN two identical notes, which is the whole
    // technique. Named, not claimed.
    //
    // AND A DEBT IT CANNOT PAY: `countrypop` (Nashville 1945) declares
    // `wants: ["appalachian fiddle", "anglo-celtic balladry"]`, and this
    // anchor is the second of those — eighteen years TOO LATE to be its
    // parent. A 1963 revival record is not the ancestor of a 1945 one. The
    // want stays on the books and this comment is why.
    irishtrad: {
      label: "Dublin 1963", voices: 3, near: "skiffle",
      plan: "arc", bpm: 116,
      parents: {},
      wants: ["seán-nós", "uilleann piping", "the O'Neill collection"],
      cannot: ["the jig, the slip jig and the slide — compound metres this " +
               "file's sixteen-place cells cannot write",
               "the cut and the cran — an ornament that separates two notes " +
               "of the SAME pitch, which needs a grace note between " +
               "identical degrees and this box has attack shapes"],
      instr: ["fiddle", "flute", "banjo"],
      entry: v => v * 2, reg: v => (v === 0 ? 0 : v === 1 ? 1 : -1),
      realize: () => "line",
      part: ["lead", "counter", "riff"],
      harmony: "modal", mode: MODES.dorian, scale: MODES.dorian, diatonic: true,
      artic: "staccato", maxHold: 1, nobass: true,
      orn: { roll: 0.55, grace: 0.4 },
      // THE BODHRÁN IS ONE FRAME DRUM AND ONE STICK WITH TWO ENDS: the low
      // stroke on the kick and the high on `p`, and no snare and no cymbal
      // anywhere, because a session has neither. `nobass` because it has no
      // bass player either — the fiddle and the flute are the whole band.
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             p: [0,0,1,1, 0,1,0,1, 0,0,1,1, 0,1,0,1] },
      kitVel: { p: [0,0,6,4, 0,5,0,4, 0,0,6,4, 0,5,0,5] },
      fill: { p: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2900, q: 0.9, atk: .004, rel: .4, gain: .27, verb: .36 },
      words: ["the fiddle, the tune",
              "the flute, in unison an octave up",
              "the banjo, picking it faster"],
      word: v => (v === 1 ? [transpose(12)] : v === 2 ? [split(2), drop(2)] : []),
    },

    // BALKAN BRASS — Guča 1985. The Serbian trumpet orchestra: two or three
    // trumpets on the tune, a row of flugelhorns and tenor horns answering
    // on the off-beats, a tuba on the bass, and a goč and a snare pushing
    // the whole thing along. The dot is Guča because the Dragačevo festival
    // held there since 1961 is what the tradition organises itself around.
    //
    // THE YEAR is the mid-eighties, when the festival is national and the
    // recordings are widely available.
    //
    // IN FOUR, AND THE ANCHOR SAYS WHICH FOUR. The kolo and the čoček in
    // 2/4 and 4/4 are most of what a Guča orchestra plays; the 7/8 and 9/8
    // repertory that the same bands also play is `bulgarian`'s wall exactly
    // and is in `cannot`. This anchor is the honest half.
    //
    // WHY IT IS NOT `banda`, which is also a brass band in a village and is
    // also in this round: this one is MINOR and chromatic — the melodies are
    // Romani and Ottoman and sit in a harmonic minor with an augmented
    // second in it — where Mazatlán 1938 is in the major, plays polkas, and
    // has clarinets on top. And this one is forty bpm faster.
    balkanbrass: {
      label: "Guča 1985", voices: 3, near: "banda",
      plan: "dance", bpm: 152,
      parents: {},
      wants: ["ottoman military band", "romani kolo", "čoček"],
      cannot: ["the aksak repertory the same bands play — the 7/8 and 9/8 " +
               "kolos, which is the wall `bulgarian` has been standing in " +
               "front of since it was written"],
      instr: ["trumpet", "brass_section", "tuba"],
      drumkit: "acoustic",
      entry: v => v, reg: v => (v === 0 ? 1 : v === 1 ? 0 : -2),
      realize: () => "line",
      part: ["lead", "riff", "counter"],
      harmony: "modal", mode: MODES.harmonic, scale: DIATONIC, diatonic: true,
      artic: "staccato", maxHold: 1, bassStyle: "fifths",
      orn: { grace: 0.4 },
      kit: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
             s: [0,0,1,1, 1,0,1,1, 0,0,1,1, 1,0,1,1],
             l: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0] },
      kitVel: { s: [0,0,4,4, 8,0,4,4, 0,0,4,4, 8,0,5,4] },
      fill: { s: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 3100, q: 1.2, atk: .006, rel: .35, gain: .28, verb: .38 },
      words: ["the lead trumpet", "the horns, answering on the off-beat",
              "the tuba, on the two"],
      word: v => (v === 1 ? [rotate(2), transpose(-5)] : v === 2 ? [drop(4), transpose(-12)] : []),
    },

    /* ---- NORTH AMERICA, THE FIVE RUNGS THE GENEALOGY ASKED FOR ---------
       This round is supposed to LOWER the Euro-American share and every
       anchor here raises it, so each one has to earn its place twice. All
       five do, and none of them is here for coverage:
         swing      — `jazz` and `highlife` BOTH declare it in `wants`;
         ragtime    — `jazz` declares it too, and it is the oldest American
                      record in the catalog by thirty-three years;
         bluegrass  — the Anglo-Celtic string band, which nothing held;
         sacredharp — an unaccompanied American tradition, and the PROBE for
                      the derived unaccompanied law: it is written with no
                      knowledge of that law at all and must join the set;
         zydeco     — Louisiana Creole, the third accordion tradition in this
                      round beside vallenato and norteña, and the one that
                      answers them from the same continent. */

    // RAGTIME — Sedalia 1899, and it is the oldest record in the Americas by
    // a year and the catalog's first piano music before 1892 that is not a
    // salon parlour song. A syncopated right hand over a marching left hand,
    // in strains, written down and sold as sheet music.
    //
    // THE YEAR AND THE TOWN ARE THE PUBLICATION, AND THAT IS SAID PLAINLY:
    // John Stark published Scott Joplin's "Maple Leaf Rag" in Sedalia,
    // Missouri, in 1899. Joplin moved to St. Louis two years later and the
    // catalog already holds St. Louis (1955, Chuck Berry), so a Sedalia dot
    // is both the true one and the one that does not collide.
    //
    // IT IS A PIANO ALONE, WHICH IS THE ARRANGEMENT. `voices` 2 is the two
    // HANDS — the right playing the syncopated strain and the left the
    // stride — the same device forró uses for an accordion, and `kit: {}`
    // because a rag has no drummer and a rag played with one is a novelty
    // record from a different decade.
    ragtime: {
      label: "Sedalia 1899", voices: 2, bars: 8, near: "parlor",
      plan: "arc", bpm: 96,
      // LINEAGE: `parlor` (New York 1892) is the SHEET MUSIC INDUSTRY and
      // the piano in the room, which is genuinely half of what a rag is —
      // it was sold the same way, to the same instrument, seven years
      // apart. The other half is the banjo's syncopation and the cakewalk,
      // and neither is here.
      parents: { parlor: 0.45 },
      wants: ["cakewalk", "banjo syncopation", "march"],
      instr: "honky_tonk",
      entry: v => v, reg: v => (v === 1 ? -2 : 0), realize: () => "line",
      part: ["lead", "riff"],
      roots: [0, 0, 4, 4, 0, 3, 4, 0], mode: MODES.ionian,
      scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 1, kit: {},
      // `honky_tonk` IS THE EIGHTH AND LAST REGISTRY ID THIS ROUND UNLOCKS BY
      // NAME: GM's detuned upright, six zones on disk, and nobody had ever
      // asked for it — which is a small absurdity, because a rag is the one
      // music that instrument is a recording OF.
      // THE LEFT HAND IS THE BASS AND IT MARCHES: root on the beat, chord on
      // the off-beat, which is `fifths` said for a piano instead of a tuba.
      bassStyle: "fifths",
      tone: { wave: "triangle", cut: 2700, q: 0.9, atk: .003, rel: .5, gain: .27, verb: .3 },
      words: ["the right hand, the strain",
              "the left hand, marching under it"],
      word: v => (v === 1 ? [drop(2), transpose(-12)] : []),
    },

    // SWING — Kansas City 1938, and it pays a debt TWO anchors have been
    // carrying: `jazz` (New York 1945) declares `wants: ["swing", ...]` and
    // its own comment admits it is bebop wearing the wrong year, and
    // `highlife` (Accra 1957) declares `wants: [..., "swing", ...]` because
    // a West African dance band is a swing band with a clave under it.
    //
    // THE YEAR is Count Basie's Decca sides and the Kansas City riff-band
    // style at its peak: a rhythm section that floats rather than chugs, two
    // sections of horns trading riffs, and a soloist over both.
    //
    // THE CITY IS KANSAS CITY, not New York, and that is a claim: the swing
    // the catalog needs upstream of bebop is the RIFF band — head
    // arrangements built out of repeated two-bar figures, which is what
    // Basie's band did and what a big Fletcher Henderson chart does not.
    // Charlie Parker learned to play in that town, which is the shortest
    // argument for the parent edge.
    swing: {
      label: "Kansas City 1938", voices: 3, bars: 8, near: "jazz",
      plan: "song", bpm: 148,
      // LINEAGE: `blues` is Chicago 1952 — FOURTEEN YEARS AFTER this label
      // — and it is named anyway, on the precedent this file already set
      // three times over (gospel 1932, countrypop 1945 and jazz 1945 all
      // declare it): the anchor's own entry says its year is a Chess date on
      // a form that is decades older, and a Kansas City riff band is built
      // out of blues choruses whatever year the catalog happens to have
      // photographed the blues in.
      parents: { blues: 0.55, ragtime: 0.2 },
      wants: ["new orleans jazz", "territory bands", "tin pan alley"],
      instr: ["tenor_sax", "brass_section", "jazz_guitar"],
      drumkit: "jazz",
      swing: 0.33,
      entry: v => v, reg: v => (v === 1 ? 0 : v === 2 ? -1 : 0),
      realize: () => "line",
      part: ["lead", "riff", "counter"],
      roots: [0, 3, 0, 0, 3, 3, 0, 4], mode: MODES.mixo,
      scale: SCALES.major, diatonic: true,
      artic: "legato", maxHold: 2, bassStyle: "walk",
      // THE RIDE IS THE RECORD. Spang-a-lang on `r`, the hi-hat pedal on 2
      // and 4, and the kick barely there at all — the Kansas City rhythm
      // section's whole innovation is that the bass drum stops marking the
      // beat and the cymbal takes it over.
      kit: { k: [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
             r: [1,0,0,1, 1,0,0,1, 1,0,0,1, 1,0,0,1],
             f: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             s: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0] },
      kitVel: { k: [4,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
                r: [8,0,0,5, 7,0,0,5, 8,0,0,5, 7,0,0,6] },
      fill: { s: [0,0,0,0, 1,0,1,0, 0,0,1,0, 1,1,1,1] },
      tone: { wave: "triangle", cut: 2800, q: 1.0, atk: .008, rel: .6, gain: .27, verb: .34 },
      words: ["the tenor, the solo",
              "the brass, riffing behind it",
              "the guitar, four to the bar"],
      word: v => (v === 1 ? [only("acc", rotate(4)), drop(2)]
                : v === 2 ? [split(2), drop(1)] : []),
    },

    // BLUEGRASS — Nashville 1946. The Anglo-Celtic string band at speed: a
    // three-finger banjo roll, a fiddle, a mandolin chopping the off-beat, a
    // guitar running bass runs and an upright, with a high lonesome voice
    // over the top and everybody taking a break in turn.
    //
    // THE YEAR is Bill Monroe's Blue Grass Boys with Earl Scruggs — the
    // Columbia sessions of 1946-47, which is the moment the banjo roll
    // arrives and the style becomes itself.
    //
    // THE MANDOLIN IS THE ONE STAND-IN. It goes to `steel_string_guitar` —
    // metal strings, plectrum, right family, wrong size — and what is lost
    // is the tremolo on the paired courses, which is the same loss the
    // bouzouki and the cavaquinho take in this round. The banjo and the
    // fiddle are the instruments themselves.
    //
    // WHAT SEPARATES IT FROM `skiffle` (London 1956), its nearest neighbour
    // by cast: skiffle is 148 with a washboard and a tea-chest and a guitar
    // strumming; this is 168 — the fastest acoustic record in the catalog —
    // with NO drum kit at all and a bass that walks. The tell is `kit: {}`:
    // a bluegrass band has no percussion and never did.
    bluegrass: {
      label: "Nashville 1946", voices: 3, near: "skiffle",
      // 160 and not the 168 a Scruggs break is really taken at: compose.js
      // requires an integer 70..160, and skiffle at 148 is still the second
      // fastest acoustic record in the catalog behind this one.
      plan: "arc", bpm: 160,
      parents: { countrypop: 0.5, blues: 0.2 },
      wants: ["appalachian old-time", "anglo-celtic balladry", "shape-note singing"],
      instr: ["banjo", "fiddle", "steel_string_guitar"],
      entry: v => v * 2, reg: v => (v === 0 ? 1 : v === 1 ? 1 : 0),
      realize: () => "line",
      part: ["riff", "lead", "counter"],
      roots: [0, 0, 4, 0], mode: MODES.ionian, scale: SCALES.major, diatonic: true,
      artic: "staccato", maxHold: 1, kit: {}, bassStyle: "fifths",
      orn: { grace: 0.35, roll: 0.4 },
      tone: { wave: "triangle", cut: 3000, q: 1.0, atk: .003, rel: .35, gain: .27, verb: .3 },
      words: ["the banjo, rolling",
              "the fiddle, taking the break",
              "the mandolin, chopping the off-beat"],
      word: v => (v === 1 ? [drop(2), transpose(-5)]
                : v === 2 ? [only("acc", rotate(2)), drop(4)] : []),
    },

    // SACRED HARP — Philadelphia 1844, and it is the SIXTH unaccompanied
    // anchor in the catalog and the FIRST outside a church hierarchy.
    // Shape-note singing: four parts, everybody in a hollow square facing
    // inward, the tune in the TENOR and not the top part, open fourths and
    // fifths everywhere, and no instrument of any kind.
    //
    // THE YEAR AND THE CITY ARE THE PUBLICATION and the comment is where
    // that belongs: B. F. White and E. J. King's *The Sacred Harp* was
    // compiled in Harris County, Georgia and PRINTED in Philadelphia in
    // 1844. The singing is southern and the book is Philadelphian, and the
    // catalog already holds Philadelphia, so this dot is both the true one
    // and the one that does not add a village to the map.
    //
    // THIS ANCHOR IS A PROBE AND THAT IS HALF ITS VALUE. compose.js's
    // `unaccompanied` predicate is DERIVED — no kit, no bass, every id in
    // `instr` a sung one — and it was written on 2026-08-25 knowing five
    // records. This entry was written without touching it and must fall into
    // that set by its own three fields, which means the record hires no
    // guest and seats no instrument. If the law were a name list it would
    // not, and the gate below says which of the two it is.
    //
    // THE TUNE IS IN THE TENOR, which is the fact that makes shape-note
    // music sound the way it does: the melody is the THIRD voice down, with
    // a part above it, so the top line is a countermelody and the chords come
    // out in open fourths and fifths rather than in triads. `reg` puts voice
    // 0 in the middle and voice 1 above it, which is that inversion.
    sacredharp: {
      label: "Philadelphia 1844", voices: 4, bars: 8, near: "hymn",
      plan: "song", bpm: 96,
      // LINEAGE: `hymn` (Boston 1831) is thirteen years earlier, is the same
      // country and is genuinely the neighbour — and it is named UNDER
      // PROTEST at less than half, because shape-note singing is the OLDER
      // tradition of the two in everything but print: it comes out of the
      // eighteenth-century New England singing school and William Billings,
      // and the Boston 1831 hymnal is the REFORM that was trying to replace
      // it. Naming the reformer as the parent of the thing it reformed is
      // backwards, and the weight says so.
      parents: { hymn: 0.4 },
      wants: ["new england singing school", "william billings", "psalm tune"],
      instr: ["ahh_choir", "ohh_voices"],
      entry: () => 0, reg: v => [0, 1, -1, -2][v], realize: () => "line",
      kit: {}, nobass: true,
      roots: [0, 0, 4, 0, 3, 0, 4, 0], mode: MODES.aeolian, scale: DIATONIC,
      artic: "legato", maxHold: 3, incClamp: 2,
      tone: { wave: "triangle", cut: 2000, q: 0.7, atk: .05, rel: 1.6, gain: .26, verb: .5,
              // WHO SINGS: everybody, loudly, in a wooden room, and not
              // well. The hymnal row is the nearest and it is too polite;
              // this one is the same alto placement with the blend pushed
              // past the gospel choir's — the loosest in the table — because
              // a Sacred Harp singing is a hundred untrained people at full
              // volume and the raggedness is the sound, not a defect in it.
              mouth: MOUTHS.shapenote },
      words: ["the tenor, who has the tune",
              "the treble, above it", "the alto", "the bass"],
      word: v => (v === 0 ? [] : [transpose([0, 5, -4, -9][v]), drop(3)]),
    },

    // ZYDECO — Lafayette 1955. Louisiana Creole dance music: a piano
    // accordion, a rubboard worn on the chest and played with bottle
    // openers, a drum kit, and a repertory that is blues and R&B in French.
    //
    // THE YEAR is Clifton Chenier's first sides — the moment la-la and juré
    // become a record with a rhythm section on it.
    //
    // THE THIRD ACCORDION ANCHOR IN THIS ROUND, and holding all three is
    // deliberate: vallenato (Valledupar 1975) is a diatonic button box in a
    // trio, norteña (Monterrey 1955) is a diatonic button box against a bajo
    // sexto playing polkas, and this is a CHROMATIC PIANO accordion playing
    // twelve-bar blues. Same word, three instruments, three musics — and
    // this one is the only one of the three whose accordion sample is
    // actually the right instrument.
    //
    // THE RUBBOARD IS THE HAT LANE, which is the same compromise the shaker,
    // the güira and the guacharaca take above, with one difference worth
    // writing: a frottoir is played with BOTH HANDS in opposite directions,
    // so its sixteenths are genuinely even and the `kitVel` line says so.
    zydeco: {
      label: "Lafayette 1955", voices: 3, bars: 12, near: "blues",
      plan: "song", bpm: 132,
      parents: { blues: 0.55, countrypop: 0.2 },
      wants: ["la-la", "juré", "cajun two-step"],
      instr: ["accordion", "harmonica", "clean_guitar"],
      drumkit: "acoustic",
      entry: v => v, reg: v => (v === 2 ? -1 : 0), realize: () => "line",
      part: ["lead", "counter", "riff"],
      roots: [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4], mode: MODES.mixo,
      scale: SCALES.blues,
      artic: "staccato", maxHold: 2, bassStyle: "eighths",
      kit: { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
             s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
             h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      kitVel: { h: [6,6,6,6, 6,6,6,6, 6,6,6,6, 6,6,6,6] },
      fill: { s: [0,0,0,0, 1,0,1,0, 0,0,1,0, 1,1,1,1] },
      tone: { wave: "sawtooth", cut: 2700, q: 1.2, atk: .006, rel: .5, gain: .28, verb: .28 },
      words: ["the accordion", "the harmonica, answering it",
              "the guitar, chopping"],
      word: v => (v === 1 ? [rotate(8), drop(2)] : v === 2 ? [only("acc", rotate(2))] : []),
    },
  };

  // THE ARRANGEMENT'S COLUMN HEADINGS, one per lane. `p` says "Ghost perc"
  // rather than "Rim" because the ghost layer writes to it and that is what a
  // person sees in the column; the other eleven say what they are.
  const DRUMNAME = { k: "Kick", s: "Snare", c: "Clap", o: "Open hat",
                     h: "Hat", p: "Ghost perc", f: "Pedal hat", r: "Ride",
                     x: "Crash", t: "High tom", m: "Mid tom", l: "Low tom" };

  // ---- DEFAULTS — the table's dominant values, said once -------------------
  // (Below DRUMNAME rather than hard against the GENRES close: promote-genre.js
  // splices a new anchor at the exact text "};" + blank line + the ARRANGEMENT
  // heading, and a block between them breaks the tool's landmark.)
  // Four fields were carried by every one of the 110 anchors, and one value
  // dominated each: rate 1 (97 of 110), bars 4 (67), harmony "cycle" (83),
  // voices 2 (82). Folded here 2026-08-20 so an anchor states only what makes
  // it DIFFERENT — vaporwave says `rate: .5` because half speed IS the genre;
  // nobody says `rate: 1`, because 1 is not a fact about a genre, it is the
  // absence of one. Applied at load, before the family/dynamics stamps below,
  // so every anchor still RESOLVES with all four fields present and every
  // downstream reader sees the object it always saw (the fold was verified
  // deep-equal across all 110 resolved anchors).
  //
  // NOT in this table, on purpose, two kinds of field:
  //   - diatonic / nobass / ghost / incMode and their kin, where ABSENT means
  //     OFF: absence is already the value, and a default would erase the
  //     difference between "off" and "unstated".
  //   - plan / bpm (the compose.js contract): REQUIRED, per anchor, never
  //     defaulted — compose() throws by name on a genre missing either, and a
  //     row here would turn that law back into the silent fallback it exists
  //     to replace.
  const DEFAULTS = { rate: 1, bars: 4, harmony: "cycle", voices: 2 };
  for (const k of Object.keys(GENRES))
    for (const f of Object.keys(DEFAULTS))
      if (!(f in GENRES[k])) GENRES[k][f] = DEFAULTS[f];


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
    // ...organum and arsnova joined 2026-08-21: unaccompanied polyphony is
    // this cluster's whole definition, and both are gregorian's direct line.
    // ...and Africa's two sung anchors joined 2026-08-25: unaccompanied
    // polyphony is this cluster's whole definition and both are exactly that,
    // Aksum 540 in two half-choirs and Johannesburg 1939 in four parts. Each
    // takes a DYNAMICS row of its own below, in opposite directions from the
    // family's — one has less metre than the vox default, the other has far
    // more, and a chant and a stamped Zulu cycle should not share a number.
    ["vox",    ["gregorian", "bulgarian", "spem", "counterpoint", "fugue", "hymn",
                "organum", "arsnova", "zema", "mbube",
                // ...and Philadelphia 1844 joined 2026-08-26 with the world
                // round. `sacredharp` is this cluster's definition exactly —
                // four unaccompanied parts, no instrument of any kind — and
                // it is the first member that is not a church's own music.
                // Its own DYNAMICS row is below, because a hundred people in
                // a hollow square is not a choir in a stone building.
                "sacredharp"]],
    ["club",   ["acid", "house", "techno", "garage", "dnb", "trap", "boombap",
                "electro", "bigbeat", "drill", "kpop", "bigroom", "ebm", "synthduo",
                // the five newcomers below are the SAME "no family fallback"
                // deal every existing member already signed: each gets its own
                // DYNAMICS row rather than resolving to nothing (§39's law).
                "melodictechno", "bleeptechno", "industrialbreaks", "madchester",
                "indiedance",
                // ...and the four 2020s floors (2026-08-24), same deal again:
                // every one has its own DYNAMICS row below, because `club`
                // still has no family fallback and never will.
                "amapiano", "hyperpop", "bailefunk", "mahraganat",
                // ...and Johannesburg 1994, on the same deal a third time: a
                // four-on-the-floor machine floor is what this cluster IS, and
                // kwaito has its own row below because `club` has no fallback
                // and a newcomer left out of that table renders flat forever.
                "kwaito",
                // ...and the world round's three (2026-08-26), on the same
                // deal every member above signed: `club` has NO family
                // fallback and never will, so each of these carries its own
                // DYNAMICS row below. Kingston 1985 is a Casio preset,
                // Cairo 1988 is a drum machine and a sequencer, Abidjan 2003
                // is a programmed floor — three machines, which is what this
                // cluster is.
                "dancehall", "aljil", "coupedecale"]],
    ["soul",   ["doowop", "motown", "isley", "funk", "disco", "gospel", "rnb",
                "jodeci", "clubpop", "retrofunkpop", "boyband", "darkrnb",
                "blueeyedsoul",
                // bedroompop is here rather than in `drift` because what it
                // inherits is R&B's PHRASING; the ambient space is a
                // production, and the ear files a whispered soul record as a
                // soul record. It disagrees with the family's stress hard,
                // so it takes a row of its own below.
                "bedroompop"]],
    // ...and the two 2020s newcomers that are grooves and not floors: both are
    // a hand layer over a rhythm section, which is what this cluster is, and
    // both take the family's own dynamics row unchanged.
    ["groove", ["reggae", "dub", "ska", "afrobeat", "bossa", "reggaeton", "latinpop",
                "afrobeats", "punjabipop",
                // ...and the five African anchors that are a HAND LAYER OVER A
                // RHYTHM SECTION, which is this cluster's definition and is
                // what every one of them is: Accra 1957 (maracas and claps
                // over a dance band), Kinshasa 1960 and Bamako 1970 (a clave
                // and a shaker under two interlocking guitars), Addis Ababa
                // 1969 (congas on the toms under a vibraphone) and Oran 1985
                // (a derbouka voiced across a drum machine). Accra sits here
                // rather than in `roots` on purpose: it is pre-rock by date
                // and a groove record by construction, and the ear files it
                // with the child it fathered.
                "highlife", "congorumba", "mandeguitar", "ethiojazz", "rai",
                // ...and TWENTY-ONE from the world round (2026-08-26), which
                // is this cluster's definition — a hand layer over a rhythm
                // section — repeated across five continents. Every one of
                // them has a percussion lane doing something the drum kit is
                // not: a clave, a llamador, a güira, a rubboard, a dhol, a
                // maqsoum, palmas. They take the family's own dynamics row
                // unchanged, which is the point of having one.
                "salsa", "cumbia", "samba", "forro", "merengue", "bachata",
                "calypso", "soca", "rocksteady", "zydeco", "rumbacatalana",
                "kwela", "mbaqanga", "soukous", "benga", "makossa", "hiplife",
                "kizomba", "dangdut", "bhangra", "shaabi"]],
    ["band",   ["rock", "punk", "blues", "bodiddley", "chuckberry", "newwave",
                "sludge", "deathmetal", "powerballad", "emo", "screamo",
                "jamband", "sophistirock", "industrialmetal",
                "musichallrock", "grebo", "janglepop", "industrialrock",
                "gothicpop", "postpunk",
                // ...and the world round's two guitar bands (2026-08-26):
                // Phnom Penh 1970 and Istanbul 1972 are a fuzz guitar, an
                // organ and a rhythm section, which is what this cluster is,
                // and the fact that the catalog can now hold both of them
                // beside London 1969 is a small argument for the round.
                "khmerrock", "anadolurock"]],
    ["studio", ["beatles", "steely", "toto", "kraftwerk", "eurythmics",
                "synthpop", "citypop", "merseybeat", "psychpop", "motorik",
                "roboticpop", "confessionalpop",
                "coastrock", "yachtrock", "yachtsoul", "analogsynthpop",
                "gothsynth", "dancepostpunk", "orchpsych",
                // ...and five from the world round (2026-08-26): São Paulo
                // 1968, Manila 1976, Tehran 1974, Hong Kong 1984 and Taipei
                // 2003 are all records ARRANGED — a band plus an arranger
                // plus a desk — which is this cluster and not `band`.
                "tropicalia", "manilasound", "iranpop", "cantopop", "mandopop"]],
    ["drift",  ["ambient", "drone", "vaporwave", "shoegaze", "postrock",
                "neoclassical", "minimalism", "spacerock"]],
    // the pre-rock traditions, and the two ancestors that joined them are
    // exactly that: Buenos Aires 1935, Nashville 1945, New York 1945,
    // London 1956. Kling Klang is `studio` and not `club` for the same kind of
    // reason — Kraftwerk made a record, and the floor is what the children
    // built out of it.
    ["roots",  ["countrypop", "skiffle", "tango", "jazz", "crooner", "yuletide",
                "folkduo", "worldfolk",
                "altcountry", "songwriterpiano", "softfolk", "singersongwriter",
                // ...and the OLD WORLD slate (2026-08-21): everything pre-rock
                // that is not unaccompanied polyphony lands here, because
                // "the pre-rock traditions" is exactly what this cluster is —
                // the two ancestors that joined it in phase 2 (tango 1935,
                // skiffle 1956) just got ten much older housemates.
                "troubadour", "estampie", "pavane", "continuo", "concerto",
                "classical", "nocturne", "romantic", "barcarolle", "parlor",
                // ...and one record from 2023, which looks wrong in "the
                // pre-rock traditions" until you hear it: a sung story, an
                // acoustic ensemble and no drum kit is what this cluster IS,
                // and a corrido is older than every rock anchor in the table.
                "corridotumbado",
                // ...and Johannesburg 1935, which belongs here for the plain
                // reason: a shebeen pedal organ in the 1930s is a pre-rock
                // tradition, the drums are not its identity, and the family's
                // own stress-.45 backbeat reading is right for a music people
                // danced to all night.
                "marabi",
                // ...and TWENTY-EIGHT from the world round (2026-08-26).
                // "The pre-rock traditions" is the cluster's own description
                // and it turns out to describe most of the world: a son
                // septeto, a bolero trio, a mambo band, a choro rondo, a
                // mento band, a mariachi, a conjunto, a banda, a palm-wine
                // guitar, a Shanghai dance band, an enka ballad, a kroncong
                // ensemble, a filmi orchestra, a qawwali party, a rebetiko
                // trio, a fado house, an Irish session, a Guča orchestra, a
                // rag, a Basie band and a bluegrass band are all of them a
                // group of people playing acoustic instruments at each
                // other. Four are POST-rock by date (Valledupar 1975, Cusco
                // 1965, Faisalabad 1988, Istanbul 1980) and belong here for
                // the same reason `corridotumbado` does: a sung story on an
                // acoustic ensemble is what this cluster IS, whatever year
                // the tape is from.
                "son", "bolero", "mambo", "vallenato", "choro", "mento",
                "huayno", "mariachi", "nortena", "banda", "palmwine",
                "shidaiqu", "enka", "trot", "kroncong", "lukthung", "nhacvang",
                "filmi", "qawwali", "arabesk", "kabulpop", "rebetiko", "fado",
                "irishtrad", "balkanbrass", "ragtime", "swing", "bluegrass"]],
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
    // ...and organum is chant with a second voice on it, not a metred music:
    // it keeps chant's near-zero stress rather than the vox default's 0.22.
    // (arsnova takes the vox default as written — the talea IS metre arriving.)
    organum:   { stress: 0.08, phrase: 0.85, touch: { t: 0.05, v: 0.5 } },
    // THE OLD-WORLD SOLOISTS disagree with roots' backbeat-era default
    // (stress .45) in the same direction neoclassical disagrees with drift:
    // rubato music, the phrase over the bar. The dances and the classical
    // period keep the family row — a pavane is danced and a Vienna 1785
    // period IS its metre.
    continuo:  { stress: 0.2,  phrase: 0.85, touch: { t: 0.07, v: 0.8 } },
    nocturne:  { stress: 0.25, phrase: 0.85, touch: { t: 0.07, v: 0.85 } },
    romantic:  { stress: 0.3,  phrase: 0.8,  touch: { t: 0.06, v: 0.9 } },
    barcarolle:{ stress: 0.3,  phrase: 0.7,  touch: { t: 0.06, v: 0.8 } },
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
    // THE 2020s FLOORS (2026-08-24). Four more `club` members and therefore
    // four more named rows — the family has no fallback, so a newcomer left
    // out here renders flat forever.
    //
    // amapiano sits with the cluster's SAMPLED corners — madchester .07,
    // boombap and industrialbreaks .06, then amapiano .055 — and not with its
    // machines, and it has to: the shaker is a HAND, sixteen to the bar, and a
    // quantised shaker is a hi-hat sample. mahraganat is just under it for the
    // same reason from the other direction — a maqsoum played hard on a
    // machine by somebody who would rather be hitting a drum. bailefunk is a
    // sampler being TRIGGERED, tight and loud, which is electro's own reading
    // with the level opened up. And hyperpop is the tightest HAND in the club
    // cluster at t .008 — in the whole table only the drone (0) and the Kling
    // Klang line (motorik .002, kraftwerk .004, roboticpop .005) are tighter,
    // which is the right company: the edit IS the performance here, and every
    // drop of expression has been moved into the level instead.
    amapiano:   { stress: 0.3,  phrase: 0.45, touch: { t: 0.055, v: 0.8 } },
    mahraganat: { stress: 0.45, phrase: 0.4,  touch: { t: 0.05,  v: 0.95 } },
    bailefunk:  { stress: 0.45, phrase: 0.2,  touch: { t: 0.02,  v: 1 } },
    hyperpop:   { stress: 0.25, phrase: 0.2,  touch: { t: 0.008, v: 0.9 } },
    // ...and the one 2020s anchor whose family row is simply wrong for it.
    // `soul` says stress 0.5 — a backbeat felt hard — and this record has no
    // backbeat worth feeling. It is nearly all phrase and a real hand, which
    // is the same shape `vocal` has, because it is one person singing.
    bedroompop: { stress: 0.14, phrase: 0.75, touch: { t: 0.05,  v: 0.55 } },
    // AFRICA'S FIVE ROWS (2026-08-25). Four of the nine new anchors take
    // their family's number unchanged — Accra 1957, Kinshasa 1960 and Bamako
    // 1970 are grooves and `groove` is right about them, and Johannesburg
    // 1935 is a dance music and `roots` is right about it. These five
    // disagree, each in a different direction:
    //
    // zema disagrees with `vox` the way gregorian does and further: chant has
    // no metre AT ALL, and Ethiopian chant is slower and longer-breathed than
    // Rome's, so the stress term is nearly off and everything is in the line.
    zema:      { stress: 0.08, phrase: 0.88, touch: { t: 0.06,  v: 0.6 } },
    // mbube disagrees with `vox` in the OPPOSITE direction, and this is the
    // whole reason it needed a row: the vox default (stress 0.22) says "the
    // barline is a scribe's convenience", which is true of a motet and false
    // of a Zulu group singing in step. It is the most metre of anything in
    // the cluster and it has a real hand on the level, because four men in a
    // room in 1939 are not a studio stack.
    mbube:     { stress: 0.4,  phrase: 0.55, touch: { t: 0.055, v: 0.9 } },
    // ethiojazz takes jazz's shape rather than groove's, because it is a jazz
    // band: the line is all phrase and keeping the metre is the rhythm
    // section's job. A shade less loose than bebop (t .07 against jazz's own
    // .07 at stress .3) because the vibraphone is a struck instrument and a
    // struck instrument cannot lag the way a horn can.
    ethiojazz: { stress: 0.3,  phrase: 0.6,  touch: { t: 0.07,  v: 0.95 } },
    // kwaito is `club`, which has no fallback, so this row is REQUIRED rather
    // than optional. It sits between the cluster's machines and its sampled
    // corners: the 909 is a machine and keeps the time, but a chanted vocal
    // over it is a person, so the hand is real and modest at .045 — under
    // amapiano's shaker (.055) and over bailefunk's triggered sampler (.02).
    kwaito:    { stress: 0.35, phrase: 0.35, touch: { t: 0.045, v: 0.85 } },
    // rai is the same trade from the other side: the cr78 holds the time
    // dead (t .03, tighter than anything else in `groove`) and every drop of
    // expression is in the singer and the accordion, which is what phrase .5
    // and a full level swing are for.
    rai:       { stress: 0.4,  phrase: 0.5,  touch: { t: 0.03,  v: 0.8 } },
    // THE WORLD ROUND'S FOUR (2026-08-26). Three are `club`, which has no
    // family fallback, so those rows are REQUIRED rather than optional and
    // the round is failing §39's own gate without them; the fourth is a vox
    // anchor that disagrees with its cluster harder than any member of it.
    //   Kingston 1985 IS a Casio preset — the whole point of Sleng Teng is
    // that a machine is playing it — so it sits with the cluster's other
    // machines on time (t .015, level with dnb) and keeps a real stress,
    // because a deejay riding that preset is very much counting.
    dancehall: { stress: 0.45, phrase: 0.15, touch: { t: 0.015, v: 0.55 } },
    //   Cairo 1988 is a cr78 and a sequencer under a sung line: the machine
    // holds the time dead, exactly as rai's does one coast west, and every
    // drop of expression is in the voice.
    aljil:     { stress: 0.4,  phrase: 0.5,  touch: { t: 0.03,  v: 0.8 } },
    //   Abidjan 2003 is a programmed floor with a shouted layer over it —
    // amapiano's deal, one continent west and eighteen years earlier.
    coupedecale:{ stress: 0.35, phrase: 0.25, touch: { t: 0.03, v: 0.85 } },
    //   ...and Philadelphia 1844, which disagrees with `vox` in the opposite
    // direction from every other exception in this table. The cluster's row
    // is stress .22 / phrase .8 — "the barline is a scribe's convenience" —
    // and that is right for chant and wrong for shape-note singing, which is
    // STAMPED: a hollow square beats time with its hands and its feet and
    // the accent is the point of the tradition. So the stress is the highest
    // in the family by a factor of two and the phrase is the lowest, and the
    // hand is loose (t .07, v 1) because a hundred untrained singers are not
    // together and that raggedness is the sound.
    sacredharp:{ stress: 0.5,  phrase: 0.35, touch: { t: 0.07,  v: 1 } },
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
    // the old world decorates the way its own treatises say to: passing tones
    // for the polyphony (chant's answer, inherited whole), and the GRACE for
    // the two soloists whose ornament is the style — Caccini wrote the
    // trillo into the score, Chopin's fioritura is the nocturne.
    organum:     { pass: 0.3 },
    arsnova:     { pass: 0.3 },
    pavane:      { pass: 0.2 },
    continuo:    { pass: 0.2, grace: 0.3 },
    nocturne:    { pass: 0.2, grace: 0.35 },
    barcarolle:  { grace: 0.2 },
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
    // THE 2020s, and only three of the eight earn a row — the header's law
    // holds: a passing tone is a CLAIM. The requinto's slide into a note is
    // the corrido's signature the way the hammer-on is country's, and it gets
    // countrypop's own reading. The maqam's ornament is not decoration, it is
    // how the mode is identified by ear, so mahraganat leans on `grace` the
    // way bulgarian does. The Punjabi vocal's harkat is the same kind of
    // fact. The other five are machines, or are records about space, and a
    // guessed ornament on any of them would be a costume.
    corridotumbado: { pass: 0.25, grace: 0.35 },
    mahraganat:     { grace: 0.3 },
    punjabipop:     { grace: 0.25 },
    // AFRICA, and only two of the nine earn a row — the header's law holds,
    // and it holds hardest here. Mulatu's band is a jazz band and fills its
    // leaps the way one does, but it does NOT play bebop's approach note (the
    // semitone under the target on the beat), because the line is pentatonic
    // and a chromatic approach would be somebody else's vocabulary arriving
    // uninvited — so ethiojazz is jazz's row with the approach term removed,
    // which is a real distinction rather than a smaller version of one.
    ethiojazz:      { pass: 0.3, grace: 0.2 },
    // A raï singer's ornament is not decoration either: the turn into and off
    // the note is how the mode is identified by ear, which is exactly the
    // claim bulgarian and mahraganat already make with `grace`.
    rai:            { grace: 0.25 },
    // NOT zema, and it is worth saying why rather than leaving a gap. Chant
    // in this table decorates by FILLING the line (gregorian pass .35), and
    // Ethiopian chant is certainly melismatic — but the shape of its melisma
    // is carried by the mələkkət signs and nothing in this repo can source
    // them, so a number here would be a guess wearing gregorian's clothes.
    // Nothing is the honest row.
  };
  for (const k of Object.keys(ORNAMENT)) if (GENRES[k]) GENRES[k].orn = ORNAMENT[k];

  // THE THREE HARMONY WORDS, SAID ONCE (2026-08-24, design 02 §5 / PROGRAM.md
  // §2.6). `harmony` is declared on all 122 anchors and its distinct values are
  // exactly these three, so avail.js derives the KEYS off this table rather
  // than typing them beside it — a vocabulary is data. What it could not derive
  // is the PROSE, and prose beside the sheet is prose that drifts from the data
  // it labels, which is the whole argument of vocabulary.js's header. So the
  // label lives here, next to the field it names. (avail.js:348 carries the
  // same three sentences as its fallback for a tree where this row has not
  // landed yet; when both are present this one wins, by avail.js:351.)
  const HARMONYLABEL = {
    modal:    "modal — one mode, no changes",
    cycle:    "cycle — a cycle of changes",
    emergent: "emergent — the changes come from the voices",
  };

  const api = { DEFAULT, GENRES, DRUMNAME, MODES, MODELABEL, SCALES, SCALELABEL,
                HARMONYLABEL,
                MOUTHS, PROGS, FAMILIES, DYNAMICS, DYN_FAMILY, ORNAMENT };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuGenres = api;
})(typeof window !== "undefined" ? window : globalThis);
