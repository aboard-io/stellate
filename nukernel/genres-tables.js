/* nukernel/genres-tables.js — HAND-WRITTEN, and the other half of the catalogue.
 *
 * A genre row says what is TRUE OF ONE RECORD. This file says what is true of
 * the table: the mode and scale alphabets, the mouths, the chord cycles, the
 * arrangement's column headings, and the four stamp passes that write a
 * default, a family, a dynamics row and an ornament onto rows that did not
 * state one. None of it belongs in a row file, because none of it is a fact
 * about a genre — DEFAULTS exists precisely so that a row states only what
 * makes it different.
 *
 * IT IS SPLICED, NOT IMPORTED. tools/genres/build.js copies the three regions
 * below into the generated nukernel/genres.js verbatim, so the shipped file
 * stays ONE self-contained script the way it has always been — no new tag in
 * index.html, no new load-order fact, nothing for a page to get wrong. The
 * regions are marked and the markers are load-bearing:
 *
 *   DOC     the file header genres.js has carried since it was written
 *   HEAD    every table the rows read, in the order the rows need them
 *   FOOT    the tables that are read AFTER the rows exist, and the four
 *           stamp passes that write onto them
 *
 * This file is also a working module — require() it and you get the tables and
 * `stamp(GENRES)` — which is how a tool reads them without parsing anything.
 * EDIT THIS FILE BY HAND. Edit a row's JSON for a row. See nukernel/GENRES.md.
 */
/*#region DOC*/
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
/*#endregion DOC*/
(function (root) {
  "use strict";
  const K = (typeof module !== "undefined" && module.exports)
    ? require("./kernel.js") : root.NuKernel;
/*#region HEAD*/
  const { rotate, reverse, transpose, invert, complement, excerpt, only, drop, fill, del,
          split, spread, keep } = K;
  // `keep(0, 4, 8, 12)` MEANT `keep(0, 4, 8, 12)` at forty-eight sites below
  // (2026-08-29): only(k, op) is the one-vector combinator, so every numeric
  // call built an op that THREW when render() applied it — seven anchors
  // crashed the kernel's own render while the gates watched the document path.
  // The alphabet now has the word the sites meant (kernel.js `keep`), and the
  // sites are rewritten mechanically: only(<numbers>) -> keep(<numbers>).
  // Nothing else about any row moved.

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
    // major itself — detroitsoul, country, gospel, disco, ska, punk and most of the
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
    // ...AND HIJAZ (2026-08-29, the four-traditions round). The flat second
    // with a NATURAL third over it — the augmented second between them is the
    // most identifiable interval in Arab, Turkish and Balkan music, and it is
    // the reason this row exists rather than another reach for `phrygian`:
    // phrygian's third is minor, so the one interval that names the maqam is
    // exactly the one it cannot say. `mahraganat`'s comment has admitted this
    // since it was written — phrygian was "the nearest one the box can SAY".
    //
    // AND IT IS 12-TET EXACT, which is the whole argument for adding it.
    // WORLD.md §2's measured table puts Arab rast, bayati and saba up to 50
    // cents off the nearest semitone on the degree that NAMES them, against a
    // 10-20 cent JND — those four maqamat are unreachable until cents land.
    // Hijaz is not one of them: every degree is a whole semitone, so an
    // anchor in hijaz is in tune rather than approximately in tune, and
    // `taqsim` below is written in it for exactly that reason.
    //
    // NOT OFFERED BY THE BAND PAGE, and that is a decision rather than an
    // omission. band-kit.js COLORS asks "what kind of minor?" and lists the
    // minors; hijaz has a major third and is not an answer to that question,
    // and filing it under either family would misname it. The interview is a
    // CURATED surface (WORLD.md §4's own recommendation) and the catalog is
    // the front door — this mode is reached by choosing the record.
    hijaz:    [0, 1, 4, 5, 7, 8, 10],
    // ...AND THE FIRST TWO ALPHABETS OFF THE SEMITONE GRID (2026-08-30, the
    // walls-down round). The pitch lane landed float scales that morning —
    // kernel degPitch generalized, cents extracted at pchOf and multiplied
    // into noteHz before the register folds — and these two rows are the
    // catalog saying what that bought. The values are SPELLINGS from named
    // theory, not measurements of any throat, and each row that plays one
    // says so in its `cannot`:
    //   shur — the Persian dastgah-e shur in Ali-Naqi Vaziri's 24-TET
    //   notation (Tehran, 1922): the KORON second at exactly half a flat.
    //   Measured practice sits 20-40 cents shy of the exact quarter and
    //   moves by player; the row that ships this (`dastgah`, Tehran 1925 —
    //   Vaziri's own city, three years after his book) owns that.
    //   rast — the Arab maqam rast with its two half-flats where standard
    //   modern Arab theory puts them: E half-flat at 3.5, B half-flat at
    //   10.5. This is the alphabet WORLD.md §2 measured 50 cents off the
    //   grid ON THE DEGREE THAT NAMES IT — the exact wall that kept tarab
    //   out of the world round — and `tarab` (Cairo 1934) now plays it.
    // NOT OFFERED BY THE BAND PAGE, hijaz's own ruling one entry up: the
    // interview is a curated surface and these are reached by choosing the
    // record.
    shur:     [0, 1.5, 3, 5, 7, 8, 10],
    rast:     [0, 2, 3.5, 5, 7, 9, 10.5],
  };
  // "harmonic minor", 2026-08-27 (FUTURE.md §5, the musicologist's row): its
  // sibling already read "melodic minor", and bare "harmonic" is a different
  // word in music. The KEY stays `harmonic` — labels are not storage.
  const MODELABEL = { dorian: "dorian", phrygian: "phrygian",
                      harmonic: "harmonic minor", mixo: "mixolydian",
                      ionian: "major", lydian: "lydian", melodic: "melodic minor",
                      aeolian: "natural minor", hijaz: "hijaz",
                      shur: "shur", rast: "rast", slendro: "slendro" };

  // A MODE MUST BE SOUNDABLE, OR IT IS DECORATION (2026-09-02, the catalogue
  // round, shift 2). `mode` is read in exactly three places — kernel.js
  // harm(), chordsOf() and bass() — and all three of them need CHORD ROOTS.
  // A `harmony: "modal"` row has none, so its mode colours nothing and every
  // note it plays comes out of `scale`; a `cycle` row whose roots never reach
  // the degree the mode exists for (mixolydian's flat seventh at degree 6,
  // dorian's natural sixth at degree 5) is in exactly the same position. Such
  // a row DECLARES a colour it cannot sound, which is a claim about the record
  // that the record cannot keep.
  //
  // THE LAW, and test/precompose.test.js G14b is the standing measurement that
  // enforces it: swap a declared mixo for ionian, or a declared dorian for
  // aeolian, re-render every section of seeds 1-3, and compare the NOTES. If
  // not one note moves, the row must do one of three things, argued in its own
  // comment with a named record, place and year:
  //   1. make the mode AUDIBLE — `scale: MODES.<the mode>` — where the record
  //      really is in that mode and the alphabet was simply the wrong one
  //      (gregorian, gagaku, seannos, hardingfele and eight others here);
  //   2. NAME WHAT IT PLAYS — ionian if the sounding third is major, aeolian
  //      if it is minor — where the mode was a word over a different music
  //      (a twelve-bar blues has no bVII chord; SCALES.blues has no sixth at
  //      all; SCALES.majpent has a major third and cannot be dorian);
  //   3. give it a ROOT that uses the degree — but only where the idiom really
  //      plays one. Inventing a chord to justify a label is the failure this
  //      check exists to catch, not a way to pass it.
  // A row whose `scale` IS its mode is exempt: there the colour arrives
  // through the alphabet and the mode field is a redundant copy, not a silent
  // one. 49 rows failed the day the check was written and none do now.

  // A ROW MAY SAY ITS OWN OCTAVE (2026-08-30, the pitch wall). Scale values
  // are float semitones — [0, 1.5, 4, 5, 7, 8.5, 10] is shur, the quarter-flat
  // second said as a number — and a row whose alphabet does not repeat at the
  // 2:1 octave says so by carrying `period` in float semitones on the row
  // itself: `tuned([0, 2.3, 4.6, 7.1, 9.5], 11.8)`. The property rides the
  // array (records store scale NAMES, ui/derive.js resolves them here, so
  // nothing serializes it away); kernel degPitch reads it and every row
  // without one is period 12, byte-identical by construction.
  const tuned = (steps, period) => Object.assign(steps, { period });
  // ...AND THE FIRST ROW THROUGH THAT DOOR (2026-08-30, the walls-down
  // round): SLENDRO, five unequal steps against a stretched octave. The
  // numbers are a NAMED MEASUREMENT — the Gadjah Mada tone measurements of
  // the Yogyakarta and Surakarta court gamelans (Surjodiningrat, Sudarjana
  // & Susanto, Yogyakarta 1972), averaged: 0, 231, 474, 717, 955 cents in a
  // 1208-cent octave. An average of nine courts' bronze is nobody's
  // gamelan, and the `gamelan` anchor's cannot says exactly that — but it
  // is a published number about real instruments, where a 240-cent
  // equal-step slendro would be a number about nothing. Assigned here
  // rather than in the MODES literal because `tuned` is defined below the
  // table; the key resolves by nameIn like every other mode.
  MODES.slendro = tuned([0, 2.31, 4.74, 7.17, 9.55], 12.08);

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
    // literal array with no key in here to answer to — blues and hambone
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
    // ...AND `yupent` JOINED 2026-09-03 WITH THE CHINA BATCH, which is the
    // first alphabet added to this table since the two above and is added on
    // the same terms: two anchors could not say what they play.
    //   THE GAP, STATED AS A SET. `majpent` (0 2 4 7 9) is the GONG mode of
    // the Chinese pentatonic and this file had no other rotation of it. The
    // YU mode is 0 3 5 7 10 — the same five notes started from the sixth
    // degree, the relative minor of the same pentatonic — and it is what a
    // bangzi aria and an erhuang aria are built on. Before tonight a row that
    // wanted it had exactly two choices and both are wrong: `blues`
    // (0 3 5 6 7 10) is the yu mode PLUS A FLAT FIFTH, which is a blue note
    // and another continent, and `MODES.dorian` (0 2 3 5 7 9 10) is seven
    // notes, handing a five-note style a second and a sixth degree it does
    // not use.
    //   MEASURED, not asserted, on `qinqiang` (Xi'an 1807) and `huiju`
    // (Beijing 1790) at seeds 1-3 by the same method test/precompose.js G14b
    // uses for a decorative mode: swap the declared alphabet for the nearest
    // thing already in this file and RENDER, then compare the pitches note for
    // note. Over 43,421 rendered notes `qinqiang` moves 50.4% of them against
    // `majpent` and 96.0% against `MODES.dorian`; over 32,619 notes `huiju`
    // moves 47.8% and 41.0%. Half the notes of a row is not decoration, and
    // the dorian column is the sharper half of the finding: a seven-note
    // alphabet does not merely colour a five-note style, it re-points every
    // degree the phrase asks for.
    yupent:    [0, 3, 5, 7, 10],                          // the yu mode
  };
  const SCALELABEL = { chromatic: "chromatic", whole: "whole tone",
                       augmented: "augmented", quartal: "quartal",
                       major: "major", majpent: "major pent.",
                       blues: "blues", bluesx: "blues, flattened",
                       yupent: "minor pent. (yu)" };

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
    // ...AND "ON TOP OF THEM" MADE TRUE FOR THE LEAD (2026-09-04). Paul:
    // *"Fix doowop too, high tenor not baritone -- check for singer register
    // throughout."* He is right, and the measurement says how wrong it was:
    // with `doowopstack`'s tenor, `doowop`'s lead sang a median of G#3/G3/A#3
    // across seeds 1-3 — a BARITONE, a fifth under where a doo-wop lead lives.
    // The cause is a compass, not a fader: a tenor's is B2-B4 (state-engine
    // VOICE_TYPE) and every solo lead chair in this catalogue is written
    // centred on C5, so audio/plan.js homeFor took a whole octave off to make
    // him fit. A doo-wop lead is not a general male voice, he is the HIGH one
    // — Frankie Lymon, Tony Williams, the falsetto over the stack — and this
    // table already has that throat: `countertenor` (F3-D#5), the one
    // `falsetto` and `boygroup` reach.
    //   SO THIS IS `doowopstack` WITH ONE FIELD CHANGED, and doowopstack
    // ITSELF IS UNTOUCHED, which is the part worth writing down. The obvious
    // edit was to change the shared row in place; measured over the whole
    // catalogue it moved 81 chairs across TWENTY-FIVE rows, because
    // instruments.js `throatOf` CASTS this mouth regionally — every Latin and
    // Caribbean backing coro in the table (son, samba, merengue, mento,
    // rocksteady, mariachi, vallenato, banda, bossa, calypso, forro, ska,
    // soca, reggae, reggaeton, huayno, nortena, tropicalia, bailefunk,
    // corridotumbado, soundsystem, bachata) reads it without naming it. A grep
    // for `MOUTHS.doowopstack` in the rows finds three declarations and misses
    // all twenty-two. Raising two dozen coros an octave is not what "fix
    // doowop" asked for, so the shared row stays and the LEAD gets its own.
    //   WHAT IT BUYS, measured rather than claimed, sung median over doowop's
    // lead chairs at seeds 1-3: A#3 -> C4, and the two chairs named `lead`
    // stop folding altogether — G#3 -> G#4 (s1) and G3 -> G4 (s2), which is
    // the D4-A4 Paul named, exactly.
    //   WHAT IT DOES NOT BUY, said out loud: the `vocal` chair precompose
    // seats beside the `lead` is written about three semitones higher, so it
    // still crosses D#5 and still folds. That is a SEATING fact, not a throat
    // fact, and it is not fixable from this table.
    //   `barbershop` AND `glammetal` ALSO DECLARE doowopstack AND ARE LEFT ON
    // IT. Barbershop has the better claim of the two — its "tenor" part is by
    // definition the harmony above the lead — but Paul named doowop, and
    // glammetal was MEASURED on the countertenor and did not move at all
    // (C#4/D4/C#4 before and after: its score sits high enough to clear the
    // countertenor ceiling too). Neither is changed on a guess.
    doowoplead: { voice: "countertenor", vowels: "ou", vib: 0.3, air: 0.16, blend: 0.65, syll: 2 },
    // ...AND THE SAME ROOM WITH GIRLS IN IT (2026-09-04). Paul: *"raise the
    // register of the singing in the girl groups! They're girls!!!"* He is
    // right and the measurement is worse than the complaint: `girlgroup` — the
    // Shirelles, New York 1960 — declared `doowopstack` because the STACK is
    // the fact, and inherited its THROAT with it. A tenor's compass is
    // B2-B4 (state-engine VOICE_TYPE, 123-494 Hz), the row's lead is written
    // around ctr 72, and so audio/plan.js homeFor moved the whole line DOWN AN
    // OCTAVE at all three seeds to make it fit: measured at the
    // precompose -> toGenre -> render seam, the lead sang D3/A3/G#4 (s1),
    // E2/A3/E5 (s2), C#3/B3/E5 (s3) — a median of A3 on the first girl-group
    // number one. This row is `doowopstack` with ONE FIELD CHANGED, on purpose:
    // the closeness, the ooh, the small wobble, the dry air and the two-beat
    // syllable are all the same corner and the same microphone, and the only
    // thing that was wrong was whose throat it was.
    //   SOPRANO AND NOT ALTO, and the difference is not the register — both
    // put the lead's home at 0 and both sing a median of A4/A4/B4, which is
    // the G4-D5 a girl-group lead sits in. It is the TOP. The alto compass
    // stops at F5 (77) and the girl-group top is E5/F5 and over it, so the
    // per-note fold rewrote 6/88/30 of the lead's notes at the three seeds
    // where the soprano's B3-C6 rewrote 0/34/2. Same singing, a fifth more
    // room above her. It is also the throat this catalogue already casts for
    // exactly this repertory one scene later — `northernsoul` reaches
    // `belter`, and Gloria Jones is a Brill Building record played in Wigan.
    girlstack:  { voice: "soprano", vowels: "ou", vib: 0.3, air: 0.16, blend: 0.65, syll: 2 },
    // AND THE SAME FAULT ON A WOMAN ALONE (2026-09-04, the same round, found by
    // the same sentence — Paul: *"raise the register of the singing in the girl
    // groups! They're girls!!!"*). `nuevacancion` (Santiago 1966) is Violeta
    // Parra's LAS ULTIMAS COMPOSICIONES, the row's own named record, and it
    // reached `trobar` — which is the right DESCRIPTION and the wrong throat.
    // trobar's own comment is "one man in a hall with no polish on him": open
    // vowels, a straight-ish tone with more breath than any church allows, one
    // syllable a beat because the words come before the line. Every word of
    // that is Parra. `voice: "tenor"` is not, and it cost the record an octave
    // — measured at the precompose -> toGenre -> render seam, seeds 1-3,
    // homeFor folded the lead DOWN at five of the six lead chairs and she sang
    // G#3/F4/F5, G#2/A3/G#5 and C#3/B3/C#5.
    //   So this is `trobar` with ONE FIELD CHANGED, the same discipline
    // `girlstack` keeps above it, and trobar itself is untouched because seven
    // other rows read it (troubadour, ballad, appalachia, zajal, nuba, huiju,
    // nordicfolk) and every one of them is honestly a man in a hall.
    //   SOPRANO IS NOT A PREFERENCE HERE, IT IS THE ONLY THROAT THAT HOLDS
    // HER. The alto rows are the right character — `confessional` is literally
    // "close, plain and full of breath: a voice a foot from the mic telling you
    // something" — and the alto COMPASS (F3-F5) still folds this record at five
    // of six lead chairs, measured. The soprano's B3-C6 folds none of them at
    // any of the three seeds. Character was available and range was not, so the
    // range decides and the character is carried over from trobar unchanged.
    //   `cantora` is her own word: in Chile a cantora is the woman who holds
    // the traditional repertory, which is what Parra spent fourteen years
    // walking the country collecting before she wrote her own.
    cantora:    { voice: "soprano", vowels: "aeo", vib: 0.15, air: 0.30, syll: 1 },
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

  /* ---- `grain`: THE SURFACE THE RECORD IS PLAYED OFF (2026-08-30) ----------
     Paul: "Does anything have found audio, samples, and vinyl crackle?
     Nothing seems to. Portishead sure should."

     He was right, and the measurement is worse than the complaint: the five
     rooms whose ENTIRE SUBJECT is records made out of other records —
     noirhop, triphop, bristolsound, knowlewest, instrumentalhiphop — composed with no
     found sound and no surface noise of any kind, every chair a GM instrument.
     The only anchor in 274 that cast a found sound was `vaporwave`.

     `grain` is a number from 0 to 1 written in a row's `tone` block. It is the
     amount of SURFACE NOISE under the whole record: audio/to-engine.js takes
     the max over the seats a record plays and writes `state.crackle`, which
     the parent's `fxParams` has read — and `fx_bus.dsp` has rendered as instr
     97, sparse impulses band-limited 300..6500 Hz over a 4 kHz hiss floor —
     since long before this table existed. NOTHING WAS BUILT FOR THIS. The one
     missing thing was a row that said the word.

     WHY IT IS NOT A CHAIR, which is the whole design. A chair costs a voice:
     it takes a register, a strip, a pan and a line in the cast, all of which
     are facts about a PLAYER. Crackle is not a player — it is the medium the
     band was pressed onto, one bed under everything, and mono the way a groove
     is mono (fx_bus sums one `crk` into both sides). So it is an AMOUNT beside
     `swing` and `verb`, not a name beside `instr`. This is also why it reaches
     the phone: `state.crackle` goes through the ONE fxParams choke point that
     press, live and the WAV segments all share, so the grain is on the tape
     and in the ring and in the pocket without a second owner anywhere.

     WHAT THE CRATE HELD, since the honest answer was checked before the
     generated one was chosen. found/ has 192 beds and 366 one-shots and NOT
     ONE of them is surface noise. The nearest candidates were measured against
     the fx_bus crackle on the same three numbers (spectral flatness /
     impulsiveness / share of energy under 300 Hz): the crackle reads
     0.47 / 23x / 0.8%, and the best bed in the tree — `power_em`, `pebble_surf`
     — reads 0.16 / 5x / 20-54%. Rain is rumble, surf is rumble, shortwave is a
     midband tone; every one of them is bass-heavy where crackle is empty, and
     none is impulsive. The 78rpm transfers (78s/blues_vox_78, caruso_78,
     laughs_78, horns_78) DO carry real shellac noise — their floor sits only
     12-15 dB under their own signal — but it is baked inside a musical
     recording, so they are found MATERIAL and can never be a texture. The
     generated crackle is therefore not a shortcut past the crate; it is the
     only thing in the tree that is actually the shape of the thing.

     READ THE DEPTH, NEVER THE NUMBER. `grain` is a LEVEL, and a level only
     means something against the record it sits under. Within a record it is
     fixed — the noise in a groove does not duck when the band gets loud, and
     nothing here makes it duck. Across records it cannot be compared at all,
     because the catalogue's presses span 18 dB (bristolsound -17.8 dBFS,
     blockparty -36.4), so the SAME number lands anywhere from 26 to 56 dB
     down depending only on how loud the record happens to be. What the rows
     below are actually ordered by is DEPTH UNDER THEIR OWN MIX, measured on
     the pressed artifact, 8 bars at seed 1:

       row            grain   dB under its own mix
       noirhop      0.62    31.5   the dust is in the loop
       instrumentalhiphop        0.39    33.2   a break and a hiss
       boombap         0.39    34.8   the 45 under the SP-1200
       tapemusic       0.23    35     the shellac the etudes were cut to
       chopped         0.45    36.1   a dubbed cassette, not a groove
       knowlewest          0.83    36.4   tape murk, a step behind Dummy
       blockparty      0.14    36.5   two decks in a rec room
       triphop         0.61    37.9   the deck under a studio record
       bristolsound   0.64    40.6   1998, digital, and nearly clean
       vaporwave       0.50    43.7   a rip of a rip; the sleeve, not the record

     — and read the two columns against each other before touching anything.
     blockparty's 0.14 is a MORE audible surface than bristolsound's 0.64.
     The numbers are levels; only the decibels are the record.

     EVERY VALUE WAS PRESSED AND MEASURED, AND SIX WERE MOVED BY WHAT CAME
     BACK. The first pass set them by ear-from-the-armchair and three of the
     ten did not arrive at all: bristolsound at 0.22 measured 56 dB down and
     left the record's noise floor unchanged TO THE DECIBEL, vaporwave at 0.30
     did the same, and blockparty at 0.35 went the other way and sat 26 dB
     down — a layer, not a surface. A row declaring a texture that does not
     reach a speaker is precisely the bug this round exists to fix, so the
     numbers here are outputs of a measurement, not inputs to one.

     THE CEILING IS REAL AND IT IS NOT OURS TO RAISE. fx_bus scales instr 97
     by 0.15, halved from 0.3 by a human ear on 2026-07-04 ("always make
     crackle half as loud as you are setting it now") and called "THE
     authoritative crackle gain" in its own comment. Measured consequence: on
     a record pressed at -18 dBFS even grain 1.0 reaches only about 34 dB
     under the mix. That is a limit this table accepts rather than routes
     around; a row wanting more surface than that is asking for the
     calibration to be re-argued with ears, not for a bigger number here.

     THE NUMBERS ARE PER RECORD AND THEY DIFFER ON PURPOSE. Every row below
     argues its own amount from what its record sounds like, and the spread is
     the point: Dummy is not Mezzanine. A single catalogue-wide dusting would
     be the same lie in the other direction — the table would once again be
     saying one thing about five different records. */

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
    /* COUNTRY ROCK'S TURNAROUND (2026-09-02). The census's own fingerprint
       for the label: major II — V of V — at 1.37x lift with `II V I IV` on 346
       songs, `I VI II V` rising to 6.75x in the chorus, and vi suppressed at
       0.63x. A `roots` degree takes its quality from the MODE, so degrees 5
       and 1 would render as vi and ii in ionian and the row's distinguishing
       fact would silently vanish; `dom7` is an ABSOLUTE [0,4,7,10] stack on
       the degree's root, which is what makes VI7 and II7 sayable at all. The
       eight bars read I I IV I | VI7 II7 V I. */
    countryrockT: [
      { d: 0 }, { d: 0 }, { d: 3 }, { d: 0 },
      { d: 5, q: "dom7" }, { d: 1, q: "dom7" }, { d: 4 }, { d: 0 },
    ],
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
    // new jack: the newjackswing2 cycle with its sevenths said out loud
    jack7: [{ d: 0, q: "7" }, { d: 3, q: "7" }, { d: 0, q: "7" }, { d: 4, q: "7" }],
    // the beatgroup verse as written, and a chorus that finally goes to V —
    // the pair exists so a composed song can have two different harmonies
    /* PRETTY BOY, dictated by Paul 2026-08-31: "Pretty boy has a A D Bm chord
       progression for example, A D on the verse, then Bm D A D on the chorus."
       Written as DEGREES, not as chord names, because in A ionian the degrees
       ARE those chords and the qualities fall out of the mode: 0 is A major,
       3 is D major, 1 is B minor. Nothing here says "minor" — the row's
       `diatonic` does, which is why the row moved off aeolian to get them. */
    /* NEW SUMMER, off the chart Paul sent 2026-08-31. In E: the verse is
       E A C#m B and the chorus A E C#m B — I IV vi V and IV I vi V, the same
       four chords rotated, which is why the song sounds like one long phrase.
       The hook ("Hey, it's a new summer") turns to F#m C#m A B — ii vi IV V.
       Degrees, not chord names, as everywhere here: in ionian, 1 IS minor.
       DATED HONESTLY — this is Ultramarine (2013) and the row is anchored on
       Shapeshifting (2011), so New Summer is not the anchor record. It is
       kept because it CORROBORATES the same harmonic habit two records apart,
       and its hook is the one turn Pretty Boy does not make. */
    newsummerV: [{ d: 0 }, { d: 0 }, { d: 3 }, { d: 3 }, { d: 5 }, { d: 5 }, { d: 4 }, { d: 4 }],
    newsummerC: [{ d: 3 }, { d: 3 }, { d: 0 }, { d: 0 }, { d: 5 }, { d: 5 }, { d: 4 }, { d: 4 }],
    newsummerH: [{ d: 1 }, { d: 1 }, { d: 5 }, { d: 5 }, { d: 3 }, { d: 3 }, { d: 4 }, { d: 4 }],
    prettyboyV: [{ d: 0 }, { d: 0 }, { d: 3 }, { d: 3 }, { d: 0 }, { d: 0 }, { d: 3 }, { d: 3 }],
    prettyboyC: [{ d: 1 }, { d: 3 }, { d: 0 }, { d: 3 }, { d: 1 }, { d: 3 }, { d: 0 }, { d: 3 }],
    beatgroupV: [{ d: 0 }, { d: 0 }, { d: 6 }, { d: 6 }, { d: 3 }, { d: 3 }, { d: 0 }, { d: 0 }],
    beatgroupC: [{ d: 0 }, { d: 0 }, { d: 6 }, { d: 6 }, { d: 3 }, { d: 3 }, { d: 4 }, { d: 0 }],
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
  // THE GREAT RENAME (2026-09-01). Paul: "Rename everything to a genre. No
  // more band names or album name or people names. ONLY genre. We don't want
  // to claim to have anything to do with all that." THE LAW: a KEY is a genre
  // word — never a band, an album, a person, a label, a show or a studio.
  // 68 keys renamed in one pass (beatles->beatgroup, motown->detroitsoul,
  // katebush->artpop, air->versailles, hendrix->acidrock ...); where no
  // established genre word exists the key is a flagged COINAGE (synthsoul,
  // noirhop, torchbreaks, leedsgoth, beiruttarab, sitcomsting, copshowsynth)
  // or a place-scene word on the madchester pattern (knowlewest, tromso,
  // viennadownbeat, versailles). Old keys still open at the door:
  // document.js normalize() folds them via OLDKEYS, so saved sessions and
  // share links keep playing. COMMENTS keep the historical names — the
  // record and the argument are the point of a comment — but every KEY and
  // every rendered surface is genre-only.
/*#endregion HEAD*/

  /* the four stamp passes, and the tables they are made of. Called on the
     GENRES object once it exists — in the generated file this body is spliced
     in straight after the row literal, exactly where it used to live. */
  function stamp(GENRES) {
/*#region FOOT*/

  // THE ARRANGEMENT'S COLUMN HEADINGS, one per lane — and since 2026-09-03
  // they are what the DRUM EDITOR prints on its own columns (Paul: *"in the
  // drum editor, fully label the names of the parts of the kits"*), so every
  // one of the twelve is the full name of a drum and none is an abbreviation.
  //
  // TWO OF THEM CHANGED WITH THAT, and both were names for something other
  // than the drum you hear:
  //   `p` said "Ghost perc" — the ghost layer writes to this lane
  //     (kernel.js:2510 pushes `d: "p"`) and the column was named after the
  //     writer. What SOUNDS there is the rim: audio/to-engine.js LANE gives
  //     `p` unit `rim`, a sampled kit plays `rim.wav` (audio/audition.js
  //     KITFILE, genre-kernel DRUMKITS) and a machine plays `snare_crack`.
  //     A lane is named for its drum; the ghost layer is still what fills it.
  //   `h` said "Hat" beside "Open hat" and "Pedal hat", which named the family
  //     and not the member. It is the CLOSED hat — `hatClosed.wav`, and
  //     `open: false` in the same LANE table.
  // Lower case: these are printed in the page's own voice, beside `+ line`
  // and `read by nobody`, and they are read aloud as `closed hat step 4`.
  const DRUMNAME = { k: "kick", s: "snare", c: "clap", o: "open hat",
                     h: "closed hat", p: "rim", f: "pedal hat", r: "ride",
                     x: "crash", t: "high tom", m: "mid tom", l: "low tom" };

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
  // MUSIC, not the machinery — newjackswing2 and synthsoul are both drum machines,
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
    ["vox",    ["gregorian", "bulgarian", "polychoral", "counterpoint", "fugue", "hymn",
                "organum", "arsnova", "zema", "mbube",
                // ...AND THE LEDGER ROUND'S THREE (2026-08-30). `jubilee` is
                // the cluster's definition exactly — four unaccompanied
                // voices, the spirituals' own quartet. `doina` and
                // `chazzanut` are ONE LONG VARYING LINE each and vox is the
                // family whose idiom row says so — the ottoman/dastgah
                // argument, a mountain and a synagogue west; both take
                // DYNAMICS rows below because neither has a metre for the
                // family's stress to land on.
                "jubilee", "doina", "chazzanut",
                // ...and Philadelphia 1844 joined 2026-08-26 with the world
                // round. `sacredharp` is this cluster's definition exactly —
                // four unaccompanied parts, no instrument of any kind — and
                // it is the first member that is not a church's own music.
                // Its own DYNAMICS row is below, because a hundred people in
                // a hollow square is not a choir in a stone building.
                "sacredharp",
                // ...AND FOUR MORE ON 2026-08-29, and three of them stretch
                // the cluster's own definition on purpose, so it is said here
                // rather than discovered. `chorale` is the definition exactly:
                // four unaccompanied parts singing a hymn tune. The other
                // three are here for the IDIOM ROW rather than for the choir —
                // vox is the only family whose line is long, falling and
                // VARYING rather than strophic, and a taqsim, a qin piece and
                // a dhrupad alap are each one long line that never says a
                // measure twice. `roots`' aabb would be actively wrong for all
                // three. Each takes its own DYNAMICS row below, because the
                // family's stress is a metre and none of them has one.
                //
                // THE HONEST VERSION IS AN IDIOM_ANCHOR ROW EACH, in
                // precompose.js, which this round could not write — that file
                // was owned elsewhere on the day. Family choice was the only
                // lever available and this comment is the handoff.
                "chorale", "taqsim", "guqin", "dhrupad",
                // ...AND FOUR MORE ON 2026-08-29, the genealogy round.
                // `isorhythm` and `spirituals` are the definition exactly —
                // four unaccompanied parts — and both fall into compose.js's
                // derived unaccompanied set on their own three fields, the
                // third and fourth independent arrivals after sacredharp and
                // chorale. `ballad` is ONE unaccompanied voice, the set's
                // smallest possible member. `ottoman` is here on taqsim's
                // own argument, stated where taqsim's is: a taksim is one
                // long varying line and vox is the family whose idiom row
                // says so; it takes taqsim's DYNAMICS numbers below because
                // it is the same musical object one court north.
                "isorhythm", "spirituals", "ballad", "ottoman",
                // ...AND EIGHT ON 2026-08-29, the debts round. Five are the
                // cluster's definition exactly — unaccompanied sacred lines:
                // sticheron and sequence and antiphon are one chant voice,
                // winchester is the chant carrying its own shadow, francoflemish
                // four unaccompanied parts. `secondapratica` and `sacredconcerto` keep a
                // continuo under the voices and sit here anyway, for the
                // reason chorale's own children always did: the voices ARE
                // the record and the idiom row's long varying line is right.
                // `holler` is ballad's own argument one shelf over — ONE
                // unaccompanied voice, the smallest possible member — and
                // vox's near-absent metre is the only honest reading of a
                // cry that never had a bar line.
                "sticheron", "sequence", "winchester", "antiphon", "francoflemish",
                "secondapratica", "sacredconcerto", "holler",
                // ...and the classical-period round's two (2026-09-03, Paul:
                // "we're missing Mendelssohn and Brahms and so forth, we should
                // have lots of representative classical genres"). `oratorio`
                // (Dublin 1742) and `requiem` (Vienna 1791) both keep an
                // orchestra under the voices and file here anyway, for the
                // reason `secondapratica` and `sacredconcerto` are two lines
                // up: THE VOICES ARE THE RECORD. Messiah is a chorus with a
                // band behind it, K. 626 is a chorus with a band behind it,
                // and the cluster's own long varying line — three notes and a
                // rest, falling, never the same measure twice — is what both
                // of them measure (requiem step fraction 0.748, |interval|
                // 2.0; the oratorio set 0.669 and 2.0). `requiem` takes NO
                // IDIOM_ANCHOR row at all — the family's is right and its own
                // note says so out loud — and `oratorio` takes one that moves
                // exactly two fields off it, the contour and the length, both
                // measured.
                "oratorio", "requiem",
                // ...and the deep-time round's three (2026-08-30), each of
                // them the cluster's definition — people singing,
                // unaccompanied: carmen is fifty-four children in two
                // half-choirs, oxyrhynchus one Greek hymn line, and
                // skolion files beside `ballad` as the set's other
                // smallest member, one voice and a complete tune.
                "carmen", "skolion", "oxyrhynchus",
                // ...and the forward half's one: contenanceangloise is three
                // unaccompanied parts, the cluster's whole definition,
                // filing beside isorhythm's own teachers.
                "contenanceangloise",
                // ...AND EIGHT ON 2026-08-30, the folk-floor round, every
                // one of them the cluster's definition — people singing
                // with nothing under them: a shantyman and his watch, a
                // Madison County ballad singer, three Georgians at a
                // table, a Norwegian mountain ballad, four Mbuti voices
                // dealt one line between them, a caregiver with a rhyme,
                // Joe Heaney alone, and four barbershop parts. All eight
                // land in compose.js's derived unaccompanied set on their
                // own three fields — eight more independent arrivals.
                "shanty", "appalachia", "georgian", "nordicfolk", "mbuti",
                "nursery", "seannos", "barbershop",
                // ...AND TWO ON 2026-08-30, the walls-down round, on the
                // argument this cluster's 2026-08-29 note already makes
                // for taqsim, guqin and dhrupad: an avaz and a khyal are
                // each ONE LONG VARYING LINE and vox is the family whose
                // idiom row says so. Both take DYNAMICS rows below.
                "dastgah", "khyal",
                // ...AND ONE ON 2026-09-03, THE INDIA-AND-CHINA BATCH, on the
                // argument the two lines above already make for `khyal`:
                // `badakhyal` (Delhi 1740) is the SLOW HALF of that form on
                // its own — Sadarang's vilambit khyal, at half rate, with no
                // drut section to come — which is one long varying line if
                // anything in this table is. It files beside the row it is the
                // ancestor of and beside `dhrupad`, the form it was made to
                // weigh like. It takes a DYNAMICS row below, for the reason
                // every one of its neighbours does: vox's stress is a choir's
                // barline and a tilwada at half rate is not one.
                "badakhyal"]],
    ["club",   ["acid", "house", "techno", "garage", "dnb", "trap", "boombap",
                // `jpop` (2026-08-30) files beside kpop, which took its
                // formula and industrialized it — the ear hears the two
                // as one shelf, produced pop with a machine floor.
                "electro", "bigbeat", "drill", "jpop", "kpop", "bigroom", "ebm", "synthduo",
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
                "dancehall", "aljil", "coupedecale",
                // ...and the genealogy round's seven (2026-08-29), on the
                // deal every member above signed twice over: `club` has NO
                // family fallback, so each of these is named in DYNAMICS
                // below — five as machines (null, electro's own argument:
                // an 808 has an accent switch where a drummer has a hand)
                // and two (hardcorerave, gfunk) as the sampled-and-played
                // corners where a hand is in the loop.
                "italodisco", "miamibass", "newjackswing", "hardcorerave",
                "gfunk", "crunk", "grime", "dubstep",
                // ...and the debts round's five (2026-08-29), on the deal
                // every member above signed: `club` has NO family fallback,
                // so each is named in DYNAMICS below — footwork and gqom as
                // machines (null, electro's own argument), and blockparty,
                // triphop and chopped with a hand in the loop, because a
                // clavinet vamp, a sung hook over a loop and a pitch wheel
                // dragged by a wrist are hands, whatever the decks say.
                "blockparty", "triphop", "chopped", "footwork", "gqom",
                // ...and the goth-and-globe round's one (2026-08-30), on
                // the deal every member above signed: `club` has NO
                // family fallback, so `witchhouse` is named in DYNAMICS
                // below — a hand in the loop, chopped's own wrist an
                // octave darker.
                "witchhouse",
                // ...and the downtempo round's nine (2026-08-30), on the
                // deal every member above signed: `club` has NO family
                // fallback, so every one is named in DYNAMICS below —
                // tromso as a machine (null, the melancholy is written,
                // not played) and eight with a hand in the loop, because
                // a torch singer over a loop, an MPC with the quantize
                // off and a trumpet soloing over a 909 are hands,
                // whatever the floor says. (`acidjazz` files in soul —
                // it is a live funk band, and the ear says so.)
                "viennadownbeat", "noirhop", "knowlewest",
                "chillout", "torchbreaks", "instrumentalhiphop", "bristolsound",
                "nujazz", "tromso",
                // ...AND THE MIDI-CORPUS ROUND'S THREE (2026-09-02). Two
                // machines and one hand: `trance` and `eurodance` are
                // sequencers and `southernhiphop` is a live band over an
                // 808. The family has no DYNAMICS default by design, so
                // all three are named in DYNAMICS below.
                "trance", "eurodance", "southernhiphop",
                // ...AND THE MOTOWN-AND-FOUR-ACTS ROUND'S THREE (2026-09-03,
                // Paul: "We also need Public Enemy, Digable Planets,
                // Pharcyde"). On the deal every member above signed: `club`
                // has NO family fallback, so each of the three is named in
                // DYNAMICS below and none of them is `null` — every one has a
                // HAND IN THE LOOP, which is the blockparty/triphop reading
                // and not electro's. politicalhiphop's hand is thirty
                // fragments of other people's playing stacked into a bar;
                // jazzrap's is literally a jazz drummer's ride, sampled
                // whole; althiphop's is the swung MPC. The batch's other
                // four rows are SUNG and sit in `soul`.
                "politicalhiphop", "jazzrap", "althiphop"]],
    ["soul",   ["doowop", "detroitsoul", "psychsoul", "funk", "disco", "gospel", "rnb",
                "newjackswing2", "clubpop", "retrofunkpop", "boyband", "darkrnb",
                "blueeyedsoul",
                // ...and the MIDI-corpus round's two (2026-09-02): a soul
                // revival with a real dominant in it and a programmed R&B
                // record with a singer on it. Both are sung songs over a
                // soul band's harmony, which is this cluster's definition.
                "retrosoul", "contemporaryrnb",
                // bedroompop is here rather than in `drift` because what it
                // inherits is R&B's PHRASING; the ambient space is a
                // production, and the ear files a whispered soul record as a
                // soul record. It disagrees with the family's stress hard,
                // so it takes a row of its own below.
                "bedroompop",
                // ...and the genealogy round's two (2026-08-29): Philadelphia
                // 1972 and Los Angeles 1975 are both a soul record — strings,
                // Rhodes, a falsetto — and both take the family's dynamics
                // row unchanged, sitting either side of `disco` in its own
                // declared parentage.
                "phillysoul", "quietstorm",
                // ...and the debts round's three (2026-08-29): Washington
                // 1969 is a funk band with a gospel tune in its mouth, New
                // York 1960 is doowop's own stack with better paperwork, and
                // Detroit 1975 is funk grown a costume department. All three
                // take the family's dynamics row unchanged.
                "amenbreak", "girlgroup", "psychfunk",
                // ...and the downtempo round's one (2026-08-30): acid
                // jazz is a live funk band with jazz changes in a London
                // club, and the ear files a Brand New Heavies record as
                // a funk record; it takes the family's own dynamics row
                // unchanged, which is what a live rhythm section earns.
                "acidjazz",
                // ...and the FUNK round's four (2026-09-03, Paul: "DEFINITELY
                // James Brown, we need way more funk"). All four are a band in
                // a room with a rhythm section, which is this cluster's whole
                // definition, and all four take the family's own dynamics row
                // unchanged (stress .5, phrase .45, touch t .07 / v 1) —
                // exactly what a live hand earns. The round's other two,
                // `boogie` and `minneapolissound`, are NOT here: a LinnDrum is
                // not a wrist, and they are in `studio` with the argument.
                // test/hand.test.js §1 is why this list is edited at all — an
                // anchor with no family row resolves no dynamics and renders
                // flat forever.
                "deepfunk", "neworleansfunk", "jazzfunk", "gogo",
                // ...and the MOTOWN round's four (2026-09-03, Paul: "Some
                // things missing include a lot of motown... We also need
                // Public Enemy, Digable Planets, Pharcyde, Mary J. Blige").
                // The four SUNG ones are here and the three hip-hop rows of
                // the same batch are in `club`, which is the split the ear
                // makes: a Motown floor-filler, an album-length Marvin Gaye
                // arc, a Whitfield vamp and a Mary J. Blige ballad are all a
                // rhythm section with a singer over it, and all four take the
                // family's own dynamics row unchanged (stress .5, phrase .45,
                // touch t .07 / v 1) — a live hand, even where the loop under
                // `hiphopsoul` is somebody else's tape, because the thing
                // being humanised is the SINGER. test/hand.test.js §1 is why
                // this list is edited at all.
                "northernsoul", "progressivesoul", "psychsoul2", "hiphopsoul"]],
    // ...and the two 2020s newcomers that are grooves and not floors: both are
    // a hand layer over a rhythm section, which is what this cluster is, and
    // both take the family's own dynamics row unchanged.
    ["groove", ["reggae", "dub", "ska", "afrobeat", "bossa", "reggaeton", "latinpop",
                "afrobeats", "punjabipop",
                // ...and the ledger round's one (2026-08-30): `soundsystem`,
                // Kingston 1950 — the family whose own header says "the echo
                // chamber is an instrument in every one of these traditions"
                // gets the culture that built the chamber.
                "soundsystem",
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
                "kizomba", "dangdut", "bhangra", "shaabi",
                // ...and Cologne 1971 (2026-08-29). `krautrock` files here
                // and not in `studio` with dusseldorfschool/motorik on purpose:
                // Can was a RHYTHM SECTION with a hand layer over it —
                // Liebezeit is the whole argument — where Kling Klang is a
                // desk. The ear files Halleluhwah with the grooves.
                "krautrock",
                // ...and the downtempo round's one (2026-08-30): a sitar,
                // a Rhodes and a hand-percussion lane over dub bass is
                // this cluster's definition at lounge tempo — thievery
                // takes the family's own dynamics row unchanged.
                "downtempo"]],
    ["band",   ["rock", "punk", "blues", "hambone", "rocknroll", "newwave",
                // ...and the genre-QA round's three (2026-09-03): the Byrds,
                // Sweetheart of the Rodeo and Born to Run are bands with a kit
                // and a guitar front line — test/hand.test.js §1 caught them
                // resolving NO dynamics for want of a family.
                "folkrock", "countryrock", "heartlandrock",
                // ...and shift 4's five (2026-09-03), the country, roots and
                // blues wing. Every one is people in a room with amplifiers,
                // which is this cluster's whole definition, and every one
                // takes the family hand rather than a DYNAMICS row: a Sun
                // trio, an Austin road band, two Macon leads over two kits,
                // a Berkeley riff band and a West Hampstead blues band.
                // The sixth row of that shift, `nashvillesound`, is under
                // `studio` below, because the producer is its author.
                "rockabilly", "outlawcountry", "southernrock", "rootsrock",
                "bluesrock",
                // ...the deep-time round's forward half (2026-08-30) put
                // `hardcore` beside punk and `doom` beside sludge — the
                // metal wing's missing floor and ceiling, both guitars
                // in a room, which is this cluster.
                "hardcore", "doom",
                "sludge", "deathmetal", "powerballad", "emo", "screamo",
                "jamband", "sophistirock", "industrialmetal",
                "musichallrock", "grebo", "janglepop", "industrialrock",
                "gothicpop", "postpunk",
                // ...and the world round's two guitar bands (2026-08-26):
                // Phnom Penh 1970 and Istanbul 1972 are a fuzz guitar, an
                // organ and a rhythm section, which is what this cluster is,
                // and the fact that the catalog can now hold both of them
                // beside London 1969 is a small argument for the round.
                "khmerrock", "anadolurock",
                // ...and Los Angeles 1946 (2026-08-29). A band playing a short
                // call and saying it again is this cluster's own sentence, and
                // `jumpblues` belongs beside `blues` and `rocknroll`, which
                // are the two rows it turned into.
                "jumpblues",
                // ...and the genealogy round's three guitar bands
                // (2026-08-29): London 1967, London 1971 and London 1979 —
                // acidrock, glam and gothicrock — each an amplifier and a
                // rhythm section, which is this cluster's whole definition.
                "acidrock", "glam", "gothicrock",
                // ...and the debts round's seven (2026-08-29): an amplifier
                // and a rhythm section, seven times over — Portland 1963,
                // San Francisco 1966 and 1983, New York 1966, the Isle of
                // Wight 1970, Workington 1969, London 1980. The metal wing
                // (heavymetal, nwobhm, thrash) lands HERE beside deathmetal,
                // which waited twenty years for its own parents.
                "garagerock", "psychrock", "protopunk", "progrock", "heavymetal",
                "nwobhm", "thrash",
                // ...and the goth-and-globe round's five (2026-08-30):
                // an amplifier and a rhythm section five more times —
                // Pomona 1982, London 1982, Rennes 1979, York 1981 and
                // Halifax 1991, the goth wing seated beside gothicrock
                // and postpunk, its own two doors. `leedsgoth` is a drum
                // MACHINE in a band family and disagrees with the
                // family's hand, so it takes a DYNAMICS row below.
                "deathrock", "batcave", "coldwave", "leedsgoth",
                "gothicmetal",
                // ...AND THE MIDI-CORPUS ROUND'S TWELVE (2026-09-02), which
                // is the largest single arrival this cluster has had: the
                // whole 1983-2000 guitar-band wing Paul's artist list was
                // asking for. Every one is four or five people in a room
                // with amplifiers, which is the family's own definition,
                // and every one takes the family hand rather than a
                // DYNAMICS row of its own.
                "collegerock", "raprock", "funkrock", "glammetal", "grunge",
                "britpop", "poppunk", "postgrunge", "skapunk", "blackmetal",
                "numetal", "postbritpop",
                // ...AND THE GENRE-QA ROUND'S BATCH B (2026-09-03), three more
                // amplifiers and a rhythm section. `powerpop` (Memphis 1972)
                // and `skatepunk` (Los Angeles 1988) are the definition
                // exactly, beside `poppunk` and `hardcore`, the two rows they
                // sit between in time. `worship` (Sydney 1993) is here and NOT
                // in `studio` on purpose: a worship record is cut LIVE with a
                // band on a stage and a room singing back, which is this
                // cluster's own hand, where `ccm` one town over is a Nashville
                // bench and a desk. All three take the family's dynamics row.
                "powerpop", "skatepunk", "worship",
                // ...AND THE GENRE-QA ROUND'S BATCH C (2026-09-03), four
                // amplifiers and a rhythm section: Buenos Aires 1967 is a
                // beat group singing in Spanish, and Westfield 2002,
                // Hamburg 1985 and Kitee 1997 are the metal wing's three
                // missing rooms, filed beside `nwobhm`, `thrash` and
                // `gothicmetal`, which are their own declared parents.
                // test/hand.test.js §1 is the check: an anchor with no
                // family row resolves NO dynamics and renders flat forever.
                "rockenespanol", "metalcore", "powermetal",
                "symphonicmetal"]],
    ["studio", ["beatgroup", "jazzrock", "aor", "dusseldorfschool", "synthsoul",
                // ...and chamber pop (2026-09-03): an arranged record made at a
                // bench, filed beside psychpop, its own declared parent's room.
                "chamberpop",
                // ...and the Nashville sound (2026-09-03), for the same
                // reason and with a stronger claim than most: the article's
                // own account of the genre names the PRODUCERS — Atkins,
                // Bradley, Sholes, Ferguson — and the A-Team, and says they
                // "invented the form by replacing" the honky-tonk band's
                // instruments with a string section and a vocal quartet.
                // A bench, an arrangement and a hired orchestra. It is the
                // only row of shift 4 that is not a band.
                "nashvillesound",
                // ...and the FUNK round's machine half (2026-09-03): `boogie`
                // (New York 1981) and `minneapolissound` (Minneapolis 1982).
                // The round's other four are a band and are in `soul`; these
                // two are a LinnDrum, a synth bass and one man at a bench, and
                // the family is the DYNAMICS argument rather than a shelf —
                // soul's row hands a record a session player's wrist (touch
                // t .07 / v 1) where these have none, and studio's (t .035 /
                // v .6, "played by people and then edited by people") is what
                // a hand editing a machine actually is. `synthsoul` (London
                // 1983) is already here doing the same thing a year later.
                "boogie", "minneapolissound",
                "synthpop", "citypop", "merseybeat", "psychpop", "motorik",
                "roboticpop", "confessionalpop",
                // ...and the MIDI-corpus round's three (2026-09-02): a
                // Stockholm writing room, a radio format and a console.
                // None of the three is a band; all three are records
                // ASSEMBLED, which is what this cluster means.
                "teenpop", "smoothjazz", "chiptune",
                // ...and the genre-QA round's batch B (2026-09-03): two
                // records ASSEMBLED, which is this cluster's own word.
                // `ccm` (Nashville 1978) is a producer's format — one singer,
                // Brown Bannister's bench and a Word contract — and files
                // beside `confessionalpop`, the same town thirty years on.
                // `indietronica` (Seattle 2003) is the cluster read to its
                // limit and past `industrialdance`'s apartment: two people who
                // were never in a room, posting CD-Rs to each other.
                "ccm", "indietronica",
                // ...and the ledger round's two (2026-08-30): `horrorscore`
                // files beside suspensescore and photoplay — a scoring desk, not
                // a band — and `exotica` beside technopop, the studio confection
                // technopop's own want names.
                "horrorscore", "exotica",
                "coastrock", "yachtrock", "yachtsoul", "analogsynthpop",
                "gothsynth", "dancepostpunk", "orchpsych",
                // ...and Chicago 1981 joined 2026-08-30 with the Wax Trax
                // round. `industrialdance` is one man, an ARP Omni, a drum machine
                // and a reel-to-reel in an apartment — no band at all, which
                // is this cluster's own definition read to its limit, and it
                // files beside `synthpop` and `analogsynthpop`, the two rows
                // its own comment argues from.
                "industrialdance",
                // ...and five from the world round (2026-08-26): São Paulo
                // 1968, Manila 1976, Tehran 1974, Hong Kong 1984 and Taipei
                // 2003 are all records ARRANGED — a band plus an arranger
                // plus a desk — which is this cluster and not `band`.
                "tropicalia", "manilasound", "iranpop", "cantopop", "mandopop",
                // ...and the two news themes (2026-08-28). `studio` is defined
                // one line up as "records ARRANGED — a band plus an arranger
                // plus a desk", and a broadcast theme is the purest case of it
                // in the whole table: there is no band, only an arranger, a
                // desk and people hired for the morning. Neither takes the
                // family's dynamics row — both are named below, in opposite
                // directions from it and from each other.
                "newsfanfare", "breakingnews",
                // ...and the folk-floor round's nine screen rows
                // (2026-08-30): the commissioned-screen cluster, seated
                // where the news pair set the precedent — no band, only
                // an arranger, a desk and people hired for the session.
                // A cue book, three picture scores, a title theme, the
                // Carpenter ostinato, the Hammer mood cue, and the two
                // sitcom commissions. horrorsynth, copshowsynth and sitcomsting
                // are machines or samplers in a hand family and take
                // DYNAMICS rows below.
                "photoplay", "goldenagescore", "suspensescore", "spaghettiwestern", "spyscore",
                "horrorsynth", "copshowsynth", "sitcom", "sitcomsting",
                // ...and Munich 1977 (2026-08-29): Musicland was a DESK and a
                // bench of session players — "records ARRANGED", this
                // cluster's own definition one comment up — and eurodisco sits
                // beside dusseldorfschool the way the two records sat in 1977:
                // same year, different rooms, neither descending from the
                // other (the anchor's own lineage note).
                "eurodisco",
                // ...and the debts round's three (2026-08-29): Pet Sounds is
                // the cluster's definition at its most famous — a band plus
                // an arranger plus a desk, and the arranger IS the record;
                // YMO is Kling Klang's own answer record; synthwave is a
                // desk remembering a decade of desks.
                "baroquepop", "technopop", "synthwave",
                // ...and the downtempo round's one (2026-08-30): Moon
                // Safari is the cluster's definition in French — a duo
                // plus an arranger's record shelf plus a desk — and versailles (né air)
                // takes the family's dynamics row unchanged.
                "versailles",
                // ...and the soundtrack round's eight (2026-09-01, Paul:
                // "add lots of movie soundtracks especially the Hans
                // Zimmer type"): the commissioned-screen cluster grown by
                // a full generation of scoring desks — no band, only an
                // arranger, a desk and people hired for the session, the
                // news pair's own definition every time. All eight take
                // DYNAMICS rows below, because "who is playing" is the
                // whole difference between a 1977 symphony orchestra
                // reading to picture and a 2010 section tracked to a
                // click under a grid.
                "spaceopera", "epichybrid", "trailerscore", "crimejazz",
                "fantasyscore", "nordicscore", "dramascore",
                "frontierscore"]],
    ["drift",  ["ambient", "drone", "vaporwave", "shoegaze", "postrock",
                "neoclassical", "minimalism", "spacerock",
                // ...and the ledger round's one (2026-08-30): `idm` — the
                // ZIM's own clause files it ("intended for home listening
                // rather than dancing"), which is this cluster and not club.
                "idm",
                // ...and the genealogy round's two (2026-08-29): Nara 752 —
                // the oldest row in the family by twelve centuries, and the
                // cluster's definition anyway: sustained texture, breath
                // pulse, no backbeat — and Berlin 1972, which is spacerock's
                // own declared parent sitting one seat over.
                "gagaku", "berlinschool",
                // ...and the debts round's two (2026-08-29): Cologne 1956 is
                // sine points in a long reverb — sustained texture, no
                // backbeat, the cluster's definition said with an oscillator
                // — and Berlin 1968 is berlinschool's own declared parent
                // sitting one seat over, exactly as berlinschool sits by
                // spacerock.
                "cologneschool", "zodiak",
                // ...and the deep-time round's forward half (2026-08-30):
                // `dreampop` files where its own child shoegaze already
                // sits — guitar as weather is texture-first, the
                // cluster's definition.
                "dreampop",
                // ...and the goth-and-globe round's one (2026-08-30):
                // `dungeonsynth` is sustained texture with no backbeat —
                // one synthesizer down a stone corridor — filed beside
                // berlinschool, its own declared parent.
                "dungeonsynth",
                // ...and the walls-down round's studio ghost (2026-08-30):
                // `tapemusic` is texture assembled at a bench, cologneschool's
                // own shelf, and cologneschool now declares it a parent.
                "tapemusic",
                // ...and one on 2026-09-03, the India-and-China batch:
                // `yayue` (Suizhou 433 BC) files beside `gagaku`, the Japanese
                // court music that is its cousin thirteen centuries downstream,
                // and for the cluster's own definition — sustained texture, a
                // ceremony's pulse, no backbeat. A rack of bronze bells ringing
                // into each other over a stroke a bar is texture if anything is.
                // It takes a DYNAMICS row below, because ritual music is the
                // one thing here with a HARD beat and NO arch, and drift's
                // family row says the opposite of both.
                "yayue"]],
    // the pre-rock traditions, and the two ancestors that joined them are
    // exactly that: Buenos Aires 1935, Nashville 1945, New York 1945,
    // London 1956. Kling Klang is `studio` and not `club` for the same kind of
    // reason — Kraftwerk made a record, and the floor is what the children
    // built out of it.
    ["roots",  ["countrypop", "skiffle", "tango", "jazz", "crooner", "yuletide",
                "folkduo", "worldfolk",
                // ...and the ledger round's four (2026-08-30): two Andalusi
                // song forms (`muwashshah`, `zajal`), the Matanzas street
                // (`rumba`) and the Bucharest guild (`lautari`) — every one
                // a pre-rock tradition with a named dated source, which is
                // what this cluster is.
                "muwashshah", "zajal", "rumba", "lautari",
                "altcountry", "songwriterpiano", "softfolk", "singersongwriter",
                // ...and the OLD WORLD slate (2026-08-21): everything pre-rock
                // that is not unaccompanied polyphony lands here, because
                // "the pre-rock traditions" is exactly what this cluster is —
                // the two ancestors that joined it in phase 2 (tango 1935,
                // skiffle 1956) just got ten much older housemates.
                "troubadour", "estampie", "pavane", "continuo", "concerto",
                "classical", "nocturne", "romantic", "barcarolle", "parlor",
                // ...AND THIRTEEN ON 2026-09-03, the classical-period round.
                // Paul: "we're missing Mendelssohn and Brahms and so forth, we
                // should have lots of representative classical genres." Every
                // one of them is this cluster's own sentence — a group of
                // people playing acoustic instruments at each other, before
                // rock — and every one files beside the five rows above it
                // that were already here: `symphony` and `stringquartet` and
                // `pianosonata` beside `classical`, `etude` and
                // `characterpiece` beside `nocturne`, `variations` and
                // `symphonicpoem` and `musicdrama` and `nationalism` and
                // `ballet` and `verismo` beside `romantic`, `impressionism`
                // last because it is what comes after all of them.
                // (`oratorio` and `requiem` went to `vox` instead, on
                // sacredconcerto's ruling: the voices are the record.)
                // Eleven of the thirteen take an IDIOM_ANCHOR row in
                // precompose.js, because the family's strophe — statement,
                // statement, departure, return — is exactly what an exposition
                // and a study and a tone poem are NOT.
                "symphony", "stringquartet", "pianosonata", "etude",
                "characterpiece", "concertoverture", "variations",
                "symphonicpoem", "musicdrama", "nationalism", "ballet",
                "verismo", "impressionism",
                // ...AND A FOURTEENTH ON 2026-09-04. `grandopera` (Paris 1831)
                // was DECLINED by the batch above on a filename search that
                // found no Meyerbeer; the composer is in the MIDI text events,
                // six files carry him, and the row is built. It files here
                // rather than in `vox` for the reason its four operatic
                // siblings do — `operaseria`, `belcanto`, `musicdrama` and
                // `verismo` are all in this cluster — even though it is the
                // only one of the five seating a chorus: vox's own definition,
                // repeated down that list, is people singing with nothing
                // under them, and the whole point of this row is the eighty
                // voices and the orchestra that never stops. It takes an
                // IDIOM_ANCHOR row in precompose.js like eleven of the
                // thirteen above it.
                "grandopera",
                // ...and one record from 2023, which looks wrong in "the
                // pre-rock traditions" until you hear it: a sung story, an
                // acoustic ensemble and no drum kit is what this cluster IS,
                // and a corrido is older than every rock anchor in the table.
                "corridotumbado",
                // ...and the genre-QA round's batch B (2026-09-03):
                // `indiefolk` (London 2009), which is this cluster's own
                // sentence — a sung story on an acoustic ensemble — with a
                // kick drum under it, and which files beside `folkduo`,
                // `softfolk` and `singersongwriter`, the three rows it
                // descends from and answers. It takes the family's dynamics
                // row; the stomp is in its own kit, not in its dynamics.
                "indiefolk",
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
                "irishtrad", "balkanbrass", "ragtime", "swing", "bluegrass",
                // ...AND SEVEN ON 2026-08-29. The cluster's row is the
                // strophic one — statement, statement, departure, return —
                // and it is right for a Tin Pan Alley chorus, a bel canto
                // cavatina, an Umm Kulthum verse, an Andalusi sana'a, a sizhu
                // variation cycle and a Carnatic kriti, all six of which say a
                // measure twice on purpose. `serial` is the misfit and sits
                // here for the tradition rather than for the row: a
                // twelve-tone line is the one thing in this table that never
                // repeats anything, and the IDIOM_ANCHOR row it wants
                // ({cell:"even", contour:"zig", sent:"vary", len:"two"}) lives
                // in precompose.js, which this round did not own. Five of the
                // seven take their own DYNAMICS row below.
                "tinpanalley", "belcanto", "serial", "firqa", "nuba",
                "sizhu", "carnatic",
                // ...AND ELEVEN ON 2026-08-29, the genealogy round, and the
                // cluster's strophic row is right for every one: a court
                // song, a da capo aria, a salon modinha, a danced lundu, a
                // lied strophe, a habanera verse, a danzón strain, a maxixe,
                // a two-beat New Orleans chorus, a twelve-bar boogie and a
                // Delta blues are all a tune said again. `andalusi` and
                // `ottoman`'s split is deliberate — the Córdoba court song
                // is strophic (roots), the Istanbul taksim is not (vox).
                "andalusi", "operaseria", "modinha", "lundu", "lied",
                "habanera", "danzon", "maxixe", "neworleans",
                "boogiewoogie", "deltablues",
                // ...AND NINE ON 2026-08-29, the debts round, every one of
                // them strophic on its face: a Baghdad court song, a Havana
                // contradanza in two strains said twice, a Savoy patter
                // song, a music-hall chorus the house already knows, a
                // Gymnopédie circling its two chords, a Sousa strain, a
                // thirty-two-bar Broadway chorus, a Moten riff chorus and a
                // sixteen-bar dorian vamp (modaljazz sits by `jazz` exactly
                // as swing does — the family's strophe is So What's own
                // AABA). `abbasid` and `andalusi` file together the way the
                // Aghani says they lived: same court music, one generation
                // and one sea apart.
                "abbasid", "contradanza", "operetta", "musichall", "furnituremusic",
                "march", "broadway", "territoryband", "modaljazz",
                // ...AND FIVE ON 2026-08-30, the deep-time round, and "the
                // pre-rock traditions" absorbs its oldest housemates by
                // thirty millennia without changing its definition once:
                // a bone flute alone in a cave, a crane-bone flute at a
                // Neolithic village, a singer with an eleven-string lyre,
                // a Hurrian hymn over the same lyre family, and a paean
                // choir with an aulos are all of them people playing
                // acoustic instruments at each other. (`carmen`,
                // `skolion` and `oxyrhynchus` file in vox instead —
                // unaccompanied singing is that cluster's whole
                // definition, whatever the millennium.)
                "hohlefels", "jiahu", "urlyre", "hurrian", "delphic",
                // ...and the forward half's two 1940s country rooms
                // (2026-08-30): a barroom band and a dance-hall string
                // band with horns — pre-rock traditions on their face.
                "honkytonk", "westernswing",
                // ...AND NINE ON 2026-08-30, the goth-and-globe round:
                // jazz given back its geography, and every row is people
                // playing acoustic instruments at each other — a Paris
                // string quintet with no drummer, Gillespie's band with
                // a conga in it, a Havana jam session, Ibrahim's Cape
                // hymn-vamp, the Barber band's front line, a double
                // quintet of two traditions, a Tokyo piano trio, an Oslo
                // quartet recorded honestly, and a Bulawayo sax band.
                // `nordicjazz` disagrees with the family's backbeat-era
                // stress and takes a DYNAMICS row below.
                "gypsyjazz", "latinjazz", "descarga", "capejazz",
                "tradjazz", "indojazz", "japanjazz", "nordicjazz",
                "tsabatsaba",
                // ...AND EIGHT ON 2026-08-30, the folk-floor round: a
                // Galax string band, Brandwein's kapelye, Piaf's
                // street-song orchestra, the Clejani taraf, cante over
                // one guitar, a Prague ballroom band, Falcon's accordion-
                // and-fiddle duo with a triangle, and the Galatina
                // therapy ensemble — every one of them people playing
                // acoustic instruments at each other, which has been
                // this cluster's definition since the day it was typed.
                "oldtime", "klezmer", "chanson", "taraf", "flamenco",
                "polka", "cajun", "tarantella",
                // ...AND FIVE ON 2026-08-30, the walls-down round: people
                // playing acoustic instruments at each other, every one —
                // a takht, a ballroom orchestra, a bal's accordion and
                // banjo, a jingju stage band, a bronze court ensemble.
                "tarab", "waltz", "musette", "jingju", "gamelan",
                // ...AND FOUR ON 2026-08-30, the unlocking round, and the
                // cluster's own definition covers every one without
                // stretching: a qayna with her oud in a Medina majlis, a
                // Telemark fiddler and his drone string in a Christiania
                // hall, a Tehran hotel's singer and tar, and two fiddles
                // and a guitar at a Caledonian Hunt ball. `qiyan` files
                // beside `abbasid` and `andalusi` for the reason the debts
                // round gave when it put those two together — same court
                // music, one generation apart — and this is the
                // generation before both.
                "qiyan", "hardingfele", "tasnif", "scotsfiddle",
                // ...and the MIDI-corpus round's one (2026-09-02):
                // `neotraditional` files beside `countrypop` and
                // `bluegrass`, its own two parents, forty-five years on.
                "neotraditional",
                // ...and the genre-QA round's batch C (2026-09-03), three
                // pre-rock song traditions: Santiago 1966 is a guitar and a
                // voice beside `folkduo` and `chanson`, and Hamburg 1960 and
                // Helsinki 1955 are the European light-music pair, filed with
                // `operetta`, `waltz` and `musette` — and with `enka` and
                // `trot`, which are the same commercial object two continents
                // east. All three take the family's own dynamics row.
                "nuevacancion", "schlager", "iskelma",
                // ...AND EIGHT ON 2026-09-03, THE INDIA-AND-CHINA BATCH.
                // Paul, going to bed the night before: "we really need to fill
                // in India and China in the classical period... we should have
                // lots of representative classical genres." Every one of them
                // is this cluster's own sentence — a group of people playing
                // acoustic instruments at each other, with a sung story on top
                // where there is a singer at all — and every one files beside a
                // row it is the ancestor or the sibling of:
                //   `tappa` (Lucknow 1780), `thumri` (Lucknow 1856) beside
                //     `filmi` and `qawwali`, the two rows downstream of them;
                //   `kriti` (Thanjavur 1810), `varnam` (Thanjavur 1830) beside
                //     `carnatic`, which is the concert order these two items
                //     are the items OF, and which declares both as parents;
                //   `kunqu` (Suzhou 1598), `huiju` (Beijing 1790),
                //     `qinqiang` (Xi'an 1807) beside `jingju` and `sizhu` —
                //     three opera companies with a fiddle, a lute and a
                //     clapper, and the first two are jingju's own declared
                //     parents as of tonight;
                //   `pipaqu` (Wuxi 1819) beside `sizhu`, whose pipa chair it
                //     borrows. It is a SOLO and this cluster is a group, which
                //     is the one strain in the list: it is here rather than in
                //     `vox` (where `guqin` sits) because vox's idiom row is a
                //     line that never says a measure twice and a wu piece is
                //     sectional and counted. It has its own IDIOM_ANCHOR row,
                //     so the family's idiom does not reach it either way.
                // All eight take the family's own dynamics row unchanged
                // (stress .45, phrase .5, touch t .06 / v .8): a live hand,
                // which every one of them is. test/hand.test.js §1 is why this
                // list is edited at all.
                "tappa", "thumri", "kriti", "varnam",
                "kunqu", "huiju", "qinqiang", "pipaqu"]],
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
    // ...and TAPEMUSIC (2026-08-30, the walls-down round) is the sixth
    // null and the purest: there are no players on a musique concrète
    // record at all — there is a bench, a splicing block and a bell-punch
    // of edits — and making the splices breathe would be a costume about
    // a performance that never happened. The techno argument, thirty
    // years early.
    tapemusic: null,
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
    // THE FOUR-TRADITIONS ROUND'S NINE (2026-08-29). Five of the twelve new
    // anchors take their family row unchanged and are not listed here — that
    // is the table's own law (a row exists only where the anchor is not its
    // family) and writing nine more rows that repeat a family's numbers is the
    // photocopy this file exists to avoid.
    //
    // THE THREE UNMETERED SOLOISTS, which is why they were put in `vox` in
    // the first place: a taqsim, a qin piece and a dhrupad alap have NO BAR,
    // and the vox family's 0.22 stress is a metre being felt. They take
    // `gregorian`'s own near-zero — the plainchant row is the precedent and
    // the argument is identical — with all the shape in the phrase.
    taqsim:    { stress: 0.05, phrase: 0.9,  touch: { t: 0.07,  v: 0.6 } },
    dhrupad:   { stress: 0.07, phrase: 0.88, touch: { t: 0.06,  v: 0.55 } },
    // ...and the walls-down round's two (2026-08-30), on the same
    // argument in the same order: an avaz has no bar at all (taqsim's
    // numbers, a hair looser — one singer, no second player to keep
    // honest with), and a khyal has a tala it floats OVER, so it keeps a
    // breath more metre than the dhrupad it descends from.
    dastgah:   { stress: 0.04, phrase: 0.92, touch: { t: 0.075, v: 0.55 } },
    khyal:     { stress: 0.1,  phrase: 0.85, touch: { t: 0.06,  v: 0.6 } },
    // ...and the India batch's one (2026-09-03), on exactly khyal's argument
    // and one notch further along it: `badakhyal` is the vilambit half alone,
    // at half rate, so the tala it floats over is twice as far away. Stress
    // drops to dhrupad's own 0.07 and the phrase rises to 0.88 — the two
    // numbers this file already gives the form this one was built to weigh
    // like — while the touch stays khyal's, because there IS a pakhawaj in
    // the room and a singer with a drummer is steadier than a singer alone.
    badakhyal: { stress: 0.07, phrase: 0.88, touch: { t: 0.06,  v: 0.6 } },
    // ...and the ledger round's two unmetred lines (2026-08-30), on the
    // ottoman rule — the same musical object takes the same numbers:
    // `doina` is parlando rubato (Bartók's own marking) and takes
    // dastgah's near-absent stress; `chazzanut` breathes with a prayer's
    // phrase and takes khyal's.
    doina:     { stress: 0.04, phrase: 0.92, touch: { t: 0.075, v: 0.55 } },
    chazzanut: { stress: 0.1,  phrase: 0.85, touch: { t: 0.06,  v: 0.6 } },
    // ...and the qin is the LOOSEST HAND of the three and the quietest: it is
    // one person in a room with nobody listening, so the timing wanders more
    // than a monk in a choir can afford to and the level barely moves at all.
    guqin:     { stress: 0.03, phrase: 0.92, touch: { t: 0.085, v: 0.45 } },
    // THE OLD-WORLD SOLOISTS' ARGUMENT AGAIN, one row down the same line the
    // continuo/nocturne/romantic block already makes: rubato music, the
    // phrase over the bar, against `roots`' backbeat-era 0.45. A bel canto
    // aria and an Umm Kulthum verse are the same fact about who is waiting
    // for whom — the band follows the singer — and tarab is the more extreme
    // of the two, which is why its hand is looser.
    belcanto:  { stress: 0.2,  phrase: 0.9,  touch: { t: 0.075, v: 0.9 } },
    firqa:     { stress: 0.25, phrase: 0.85, touch: { t: 0.08,  v: 0.95 } },
    // ...and TARAB (2026-08-30, the walls-down round) is the row the
    // comment above always promised — "tarab is the more extreme of the
    // two, which is why its hand is looser" was written about firqa a
    // round early, and here is the looser hand: less metre, more phrase,
    // the widest timing in the Arab block because the takht is five
    // players breathing with one singer, not thirty under a conductor.
    tarab:     { stress: 0.2,  phrase: 0.9,  touch: { t: 0.09,  v: 1 } },
    // JINGJU (2026-08-30): carnatic's own trade one row up — the ban
    // clapper is a conductor the audience can hear, so the metre is felt
    // HARD even while the aria's line is all phrase over it.
    jingju:    { stress: 0.45, phrase: 0.75, touch: { t: 0.06,  v: 0.85 } },
    // GAMELAN (2026-08-30): the tightest ENSEMBLE in the table —
    // interlocking parts fail audibly at a hundredth of a step, so the
    // hand is nearly minimalism's — but the phrase is flatter still,
    // because a balungan recurs rather than arches, and the metre is the
    // gong's, felt as a cycle rather than leaned on.
    gamelan:   { stress: 0.3,  phrase: 0.2,  touch: { t: 0.015, v: 0.4 } },
    // WALTZ (2026-08-30): a ballroom orchestra under a conductor — the
    // roots default's backbeat-era stress is wrong in the other direction
    // for once (a waltz leans HARDER on its bar than a backbeat band, the
    // bar is the genre) and the phrase rides over it. What this row
    // cannot say is the atempause; the anchor's own cannot owns that.
    waltz:     { stress: 0.55, phrase: 0.6,  touch: { t: 0.05,  v: 0.85 } },
    // a kacheri is the opposite trade and it is worth stating rather than
    // defaulting: the tala is felt HARD (the audience is counting it on their
    // hands) and the line is still all phrase. Nothing else in this table
    // combines a stress that high with a phrase that high.
    carnatic:  { stress: 0.4,  phrase: 0.82, touch: { t: 0.055, v: 0.8 } },
    // eight amateurs in a teahouse with no conductor: the metre is a clapper
    // rather than a drummer, and the time moves because nobody is in charge.
    sizhu:     { stress: 0.15, phrase: 0.7,  touch: { t: 0.07,  v: 0.6 } },
    // a twelve-tone line has a metre it is not trying to make you feel, and
    // it is PLAYED — the pianist is a person — so the level moves where the
    // time does not. Nearest neighbour in this table is `minimalism`, one
    // notch less severe.
    serial:    { stress: 0.15, phrase: 0.5,  touch: { t: 0.02,  v: 0.75 } },
    // ...and a jump record is the loosest end of the band family on purpose:
    // this is dance music played fast by five men, so the metre is felt as
    // hard as `blues` feels it and the hand is looser than any of them.
    jumpblues: { stress: 0.5,  phrase: 0.45, touch: { t: 0.075, v: 1.05 } },
    // drum machines with singers over them: the machine is the floor, the
    // performance is on top, so metre stays modest and the level moves
    // (THE SWAP, 2026-09-04 — Paul: "Do the swap." This row's numbers are
    // the JODECI record's, which is keyed `newjackswing2` now; the Mary J.
    // Blige record took the bare `hiphopsoul` key and takes the `soul`
    // family's own dynamics row, exactly as it did under its old key.)
    newjackswing2: { stress: 0.3,  phrase: 0.5,  touch: { t: 0.04,  v: 0.8 } },
    rnb:       { stress: 0.35, phrase: 0.55, touch: { t: 0.05,  v: 0.85 } },
    // KRAFTWERK is not `null` like the five club machines, and the difference
    // matters: this music was PLAYED — Flür hit metal with sticks, the tunes
    // were fingered on keyboards — it just refuses to lean. So it gets the
    // smallest hand in the table rather than no hand: four thousandths of a
    // step and a quarter of a velocity unit. The metre is genuinely felt (the
    // count is the point) and the phrase is nearly flat, because a Kraftwerk
    // line does not arch, it recurs.
    dusseldorfschool: { stress: 0.3,  phrase: 0.15, touch: { t: 0.004, v: 0.25 } },
    synthsoul:{ stress: 0.25, phrase: 0.35, touch: { t: 0.02,  v: 0.55 } },
    synthpop:  { stress: 0.25, phrase: 0.35, touch: { t: 0.02,  v: 0.5 } },
    // dusseldorfschool's two direct children keep its tiny hand rather than falling
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
    // WAX TRAX! IS NOT ITS OWN CHILDREN'S MACHINE. `ebm` one line up is a
    // sequencer at t 0.01 — no hand at all — and that is the 1989 club, eight
    // years after this row. Chicago 1981 is a man playing an ARP Omni over a
    // CR-78 in an apartment: the box keeps the time, so stress stays low, but
    // a player is touching the keys, so the timing wobble is a real one. It
    // sits at analogsynthpop's own reading, which is the record next door.
    industrialdance:   { stress: 0.35, phrase: 0.3,  touch: { t: 0.022, v: 0.5  } },
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
    // Klang line (motorik .002, dusseldorfschool .004, roboticpop .005) are tighter,
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
    // THE TWO NEWS THEMES (2026-08-28), and they disagree with `studio`
    // (stress .35 / phrase .4 / t .035) in opposite directions, which is the
    // argument for writing two anchors instead of one.
    //   London 1970 is the most METRE of anything in the family, and it has to
    // be: the cue's job is urgency, the ostinato IS the message, and a library
    // date is a room of players reading a chart hard at 132. Its hand is loose
    // for the cluster (t .045, v .9) because those are people, recorded live to
    // two-track in a morning, not a record built over weeks.
    newsfanfare:  { stress: 0.55, phrase: 0.45, touch: { t: 0.045, v: 0.9 } },
    //   New York 2006 is the opposite trade and nearly the tightest hand in
    // the table — only the drone (0), the Kling Klang line (motorik .002,
    // dusseldorfschool .004, roboticpop .005) and hyperpop (.008) are under it. It
    // has to be: this is a sample library on a grid, edited to the frame, and
    // a string ostinato that wanders is a mistake somebody would fix. The
    // phrase is the lowest of the two because there is no tune to shape — the
    // brass is a hit, which is what `part: "stab"` says up in the anchor.
    breakingnews: { stress: 0.4,  phrase: 0.2,  touch: { t: 0.01,  v: 0.5 } },
    // THE GENEALOGY ROUND'S CLUB MEMBERS (2026-08-29) — eight new `club`
    // rows and `club` still has no family fallback, so all eight are named,
    // per the table's own law. Five are MACHINES and null means it, electro's
    // own argument each time: an 808 (miamibass, crunk), a drum machine and
    // a tracker (italodisco, grime), a DAW grid (dubstep) — everything they
    // want to say about weight is already in kitVel.
    italodisco: null, miamibass: null, crunk: null, grime: null, dubstep: null,
    //   ...and the three where a hand IS in the loop: an SP-1200 with the
    // swing on (newjackswing — the shuffle is the genre), breaks cut by an
    // editor at rave tempo (hardcorerave — tight time, real level moves,
    // dnb's own deal three years earlier), and session players over the
    // machine (gfunk — The Chronic was PLAYED, which is its whole boast).
    newjackswing: { stress: 0.4,  phrase: 0.25, touch: { t: 0.05,  v: 0.85 } },
    hardcorerave: { stress: 0.25, phrase: 0.15, touch: { t: 0.02,  v: 0.6 } },
    gfunk:        { stress: 0.4,  phrase: 0.3,  touch: { t: 0.05,  v: 0.8 } },
    // THE DEBTS ROUND'S CLUB MEMBERS (2026-08-29) — five new `club` rows,
    // still no family fallback, all five named per the table's own law. Two
    // are MACHINES and null means it: footwork is a tracker grid at 160 with
    // all its violence already in kitVel, gqom is a DAW loop whose whole
    // point is that the kick never breathes.
    footwork: null, gqom: null,
    //   ...and the three with a hand in the loop: a live funk band on the
    // decks' either side (blockparty — the merry-go-round selects, the band
    // on the record still PLAYED), a singer over a crackling loop (triphop —
    // the loop is dead-tight, the voice carries all the phrase), and a wrist
    // on a pitch wheel (chopped — the drag IS a hand, slow and deliberate,
    // the loosest time of any club row on purpose).
    blockparty: { stress: 0.45, phrase: 0.3,  touch: { t: 0.05,  v: 0.85 } },
    triphop:    { stress: 0.3,  phrase: 0.5,  touch: { t: 0.025, v: 0.6 } },
    chopped:    { stress: 0.2,  phrase: 0.3,  touch: { t: 0.06,  v: 0.6 } },
    //   ...and the round's two vox members that disagree with the cluster
    // (stress .22 is a metred choir and neither of these has a metre):
    // `ottoman` takes taqsim's own numbers because a taksim is the same
    // musical object whichever court it is played in, and `ballad` sits
    // between chant and the hymnal — one voice, no bar to stress, but a
    // strophic tune with a real arch to it.
    ottoman:     { stress: 0.05, phrase: 0.9,  touch: { t: 0.065, v: 0.6 } },
    ballad:       { stress: 0.12, phrase: 0.85, touch: { t: 0.06,  v: 0.6 } },
    //   ...and `gagaku`, which out-drifts `drift` (stress .12): the pulse
    // is a breath, not a bar, and the shape lives entirely in the line —
    // the chant's own numbers, three centuries before Rome 600's own row
    // was practice.
    gagaku:       { stress: 0.06, phrase: 0.88, touch: { t: 0.05,  v: 0.5 } },
    // ...and `yayue` (2026-09-03), which is gagaku's cousin and its OPPOSITE
    // on both numbers, which is why it needs a row rather than the family's.
    // Ritual court music is the one music in this table with a hard beat and
    // no arch: the Bianzhong article's own sentence is that the bells lead by
    // "doubling the melody of the winds and strings, while larger bells
    // punctuate hymn phrases" — a stroke a beat, every one the same weight,
    // for the length of a ceremony. So the stress goes UP to a plain 0.25 (a
    // real pulse, felt, and nowhere near a backbeat's 0.5) and the phrase goes
    // DOWN to 0.3, the lowest in this table outside the machines: a rite does
    // not swell. The touch is the smallest hand here, because struck bronze
    // rung by a court orchestra is not a soloist's rubato.
    yayue:        { stress: 0.25, phrase: 0.3,  touch: { t: 0.03,  v: 0.4 } },
    // THE GOTH-AND-GLOBE ROUND'S THREE (2026-08-30). Thirteen of the
    // sixteen new anchors take their family row unchanged — the table's
    // own law — and these are the three that measurably disagree:
    //
    // witchhouse is `club`'s newest member and the family has no
    // fallback, so it is named per the law. It sits with `chopped`,
    // its own dominant parent — the drag IS a hand — but tighter and
    // quieter: a laptop's wrist, not a turntable's.
    witchhouse: { stress: 0.22, phrase: 0.3,  touch: { t: 0.045, v: 0.55 } },
    // leedsgoth is a drum MACHINE in the band family: Doktor Avalanche
    // does not lean, and `band`'s 0.95-velocity human hand would be a
    // costume on it. It sits near ebm's numbers — the same years, the
    // same refusal — with a little more phrase because there is a song
    // on top.
    leedsgoth:    { stress: 0.35, phrase: 0.25, touch: { t: 0.012, v: 0.35 } },
    // nordicjazz disagrees with roots' backbeat-era 0.45 the way the
    // old-world soloists do, and further: the Bendiksen room's whole
    // aesthetic is rubato over a pulse barely stated, so the phrase
    // carries nearly everything and the hand is jazz's own loose one.
    nordicjazz: { stress: 0.18, phrase: 0.8,  touch: { t: 0.07,  v: 0.7 } },
    // THE DOWNTEMPO ROUND'S CLUB MEMBERS (2026-08-30) — nine new `club`
    // rows, still no family fallback, all nine named per the table's own
    // law. ONE is a machine and null means it: Melody A.M.'s melancholy
    // is written into the tune, not played into the time — the floor
    // never leans, the same argument every null above makes.
    tromso: null,
    //   ...and the eight with a hand in the loop. The Bristol wing all
    // sit near triphop's own numbers — the loop is dead-tight, the
    // voice carries the phrase — and they differ where the records do:
    // noirhop is slower and nearly all torch line; bristolsound is
    // Mezzanine's grid, the tightest and quietest hand of the wing;
    // knowlewest drags the loosest time of the three because the seasick
    // detune IS a wrist; chillout and torchbreaks keep the singer's phrase
    // with torchbreaks on dnb's near-frozen breaks (dnb's own t 0.015, a
    // fraction looser for the live keys).
    noirhop:    { stress: 0.25, phrase: 0.6,  touch: { t: 0.03,  v: 0.65 } },
    bristolsound: { stress: 0.32, phrase: 0.4,  touch: { t: 0.015, v: 0.45 } },
    knowlewest:        { stress: 0.22, phrase: 0.45, touch: { t: 0.05,  v: 0.7 } },
    chillout:     { stress: 0.25, phrase: 0.55, touch: { t: 0.03,  v: 0.6 } },
    torchbreaks:          { stress: 0.2,  phrase: 0.55, touch: { t: 0.018, v: 0.5 } },
    //   ...instrumentalhiphop is boombap's own MPC hand with the quantize off,
    // a shade heavier on the pads; viennadownbeat brushes the same
    // deal at Vienna tempo; nujazz is the round's one live-solo
    // row — the 909 never moves, but everything ON it is played, so
    // the phrase and the hand are jazz-side while the stress stays
    // the floor's.
    instrumentalhiphop:          { stress: 0.38, phrase: 0.3,  touch: { t: 0.055, v: 0.9 } },
    viennadownbeat: { stress: 0.28, phrase: 0.45, touch: { t: 0.035, v: 0.6 } },
    nujazz:         { stress: 0.35, phrase: 0.6,  touch: { t: 0.055, v: 0.85 } },
    // THE FOLK-FLOOR ROUND'S NINE (2026-08-30). Sixteen of the round's
    // twenty-five take their family row unchanged; these disagree, each
    // for a reason the record itself states:
    //
    // shanty is sacredharp's argument at sea — the vox default says "the
    // barline is a scribe's convenience" and a halyard song is STAMPED,
    // the beat is the pull and the whole point; ragged hands because a
    // watch is not a choir.
    shanty:     { stress: 0.5,  phrase: 0.35, touch: { t: 0.07,  v: 1 } },
    // appalachia and nordicfolk are ballads and take ballad's own shape
    // — one voice, no bar to stress, a strophic arch — not the family
    // default the mountain and the fjord would both shrug at.
    appalachia: { stress: 0.12, phrase: 0.85, touch: { t: 0.06,  v: 0.6 } },
    nordicfolk: { stress: 0.1,  phrase: 0.85, touch: { t: 0.06,  v: 0.55 } },
    // seannos has the least metre of anything in the family but the
    // taksim rows — no bar line at all, the line and its ornaments are
    // the entire performance.
    seannos:    { stress: 0.05, phrase: 0.9,  touch: { t: 0.065, v: 0.6 } },
    // mbuti is the family's OTHER extreme and the reason it needed a
    // row: an interlocked hocket is nothing BUT metre — each voice's two
    // notes land or the circle falls apart — yet every hand is real.
    // The most stress in vox by a distance, sacredharp included.
    mbuti:      { stress: 0.55, phrase: 0.2,  touch: { t: 0.05,  v: 0.85 } },
    // flamenco disagrees with roots' backbeat-era reading from both
    // sides at once: the cante is nearly all phrase and drag, the palmas
    // under it are exact — a loose voice over a hard clock.
    flamenco:   { stress: 0.3,  phrase: 0.75, touch: { t: 0.07,  v: 0.9 } },
    // chanson is the singer pushed all the way forward; the orchestra
    // follows HER, which no 0.45 stress can describe.
    chanson:    { stress: 0.2,  phrase: 0.75, touch: { t: 0.06,  v: 0.85 } },
    // ...and the screen cluster's three machines-in-a-hand-family.
    // horrorsynth is a director playing to a click, tight and small;
    // copshowsynth is fusion hands over a sequenced grid — the phrase
    // leans while the time does not; sitcomsting is a sampler keyed live,
    // tight time, real pops on the level.
    horrorsynth:  { stress: 0.3,  phrase: 0.15, touch: { t: 0.012, v: 0.4 } },
    copshowsynth:  { stress: 0.3,  phrase: 0.55, touch: { t: 0.02,  v: 0.6 } },
    sitcomsting:   { stress: 0.4,  phrase: 0.25, touch: { t: 0.02,  v: 0.85 } },
    // THE SOUNDTRACK ROUND'S EIGHT (2026-09-01), each row naming WHOSE
    // hands it describes, the horrorsynth/copshowsynth idiom:
    //
    // spaceopera is a symphony orchestra reading to picture — a hundred
    // real hands, big phrase, honest ensemble slop (the loosest of the
    // eight on purpose: Denham 1977 was PLAYED, take after take).
    spaceopera:    { stress: 0.45, phrase: 0.55, touch: { t: 0.04,  v: 0.85 } },
    // epichybrid is players to a click under a grid: the section is real
    // but it is tracked into a template, so the time is nearly the DAW's
    // and only the level still belongs to the bows.
    epichybrid:    { stress: 0.3,  phrase: 0.3,  touch: { t: 0.02,  v: 0.5 } },
    // trailerscore is cut to picture, machine-tight — breakingnews's own
    // argument one aisle over (its t 0.01 is the family's floor): a
    // library cue is edited to the frame, and a hit that wanders is a
    // mistake somebody would fix.
    trailerscore:  { stress: 0.4,  phrase: 0.2,  touch: { t: 0.015, v: 0.7 } },
    // crimejazz is real hands, smoke in the room — session players with
    // jazz's loose clock, the most PLAYER of the eight.
    crimejazz:     { stress: 0.45, phrase: 0.5,  touch: { t: 0.06,  v: 0.9 } },
    // fantasyscore is goldenagescore's orchestra with a folk soloist out front:
    // low stress, the phrase carries the tune over the field drum.
    fantasyscore:  { stress: 0.3,  phrase: 0.7,  touch: { t: 0.05,  v: 0.8 } },
    // nordicscore barely states its metre at all — drone's own numbers
    // warmed up just enough to admit there are bows moving.
    nordicscore:   { stress: 0.1,  phrase: 0.5,  touch: { t: 0.04,  v: 0.5 } },
    // dramascore is a mallet player recorded close: quiet, even, the
    // shape polite on purpose — the school's whole manner.
    dramascore:    { stress: 0.25, phrase: 0.6,  touch: { t: 0.05,  v: 0.6 } },
    // frontierscore gallops — the most metre in the screen cluster, a
    // 1958 stage orchestra digging into the 3-3-2.
    frontierscore: { stress: 0.5,  phrase: 0.45, touch: { t: 0.045, v: 0.9 } },
    // THE DEBT ROUND'S THIRTEEN (2026-09-01). test/hand.test.js §1 had
    // thirteen anchors resolving to NO dynamics beyond the dated jpop
    // debt — every one a late-round row that landed with no family (their
    // FAMILIES seats are a later agent's job this round; the rows resolve
    // under their CURRENT keys and move with them). Each gets a REAL
    // reading of whose hands are on the record, calibrated against the
    // neighbours its own comment names:
    //
    // hinrg is a 909 four-on-the-floor with a falsetto over it —
    // synthpop's machine-tight row (t .02) with the phrase lifted for
    // the voice that IS the record.
    hinrg:   { stress: 0.28, phrase: 0.45, touch: { t: 0.02,  v: 0.5 } },
    // beiruttarab is the Baalbeck orchestra following HER — chanson's argument
    // in Beirut, near tarab's numbers (its declared parent, stress .2
    // phrase .9) with the ensemble a shade tighter than the solo throat.
    beiruttarab:        { stress: 0.2,  phrase: 0.8,  touch: { t: 0.06,  v: 0.8 } },
    // slowcore is a trio playing slow on purpose — real, loose hands
    // (the drummer is the loosest thing on the record) at low heat.
    slowcore:    { stress: 0.2,  phrase: 0.6,  touch: { t: 0.07,  v: 0.7 } },
    // artpop is a Fairlight record with a singer's phrase all over it:
    // studio-tight time, the arch pushed well past the family's 0.4.
    artpop:      { stress: 0.3,  phrase: 0.65, touch: { t: 0.03,  v: 0.6 } },
    // electropop is a drum machine and tracked synths — industrialdance's own
    // numbers (t .022) with a little more phrase, because With Sympathy
    // is a POP record and the vocal line has a shape the sequencer lacks.
    electropop: { stress: 0.3,  phrase: 0.35, touch: { t: 0.02,  v: 0.45 } },
    // newpop is a CR-78 and played keyboards — dusseldorfschool's grid (its 0.45
    // parent) but with pop songs written on it, so the phrase is real.
    newpop:           { stress: 0.3,  phrase: 0.5,  touch: { t: 0.02,  v: 0.5 } },
    // worldbeat is an art-rock BAND — session hands, big phrase, the
    // most player of the thirteen with baggy and softrock.
    worldbeat:  { stress: 0.4,  phrase: 0.6,  touch: { t: 0.05,  v: 0.85 } },
    // artrock is a band that breathes together — real hands, high
    // phrase, tighter than worldbeat because 1997 was tracked to
    // tape loops half the time.
    artrock:     { stress: 0.35, phrase: 0.65, touch: { t: 0.045, v: 0.8 } },
    // electroindustrial is sequencers and samplers played violently — near
    // industrialdance (its own `near`), the level jumping harder than the time.
    electroindustrial:   { stress: 0.35, phrase: 0.2,  touch: { t: 0.02,  v: 0.6 } },
    // ambientpop is drift's number with the band still in the room: the
    // wash has hands under it, barely.
    ambientpop:      { stress: 0.15, phrase: 0.55, touch: { t: 0.05,  v: 0.55 } },
    // baggy is the funky drummer played by a person — madchester's
    // loose hand (t .07) a shade before the scene tightened around it.
    baggy:    { stress: 0.45, phrase: 0.45, touch: { t: 0.06,  v: 0.85 } },
    // softrock is a played band in a Lagos room — the band family's numbers
    // with beatgroup' studio polish halfway back in.
    softrock:         { stress: 0.5,  phrase: 0.45, touch: { t: 0.05,  v: 0.9 } },
    // balearic is a 909 under a dream-pop voice — machine floor,
    // drift's phrase, the same trade hinrg makes at half the BPM.
    balearic:   { stress: 0.25, phrase: 0.5,  touch: { t: 0.02,  v: 0.5 } },
    // THE MIDI-CORPUS ROUND'S THREE CLUB MEMBERS (2026-09-02). The family
    // has no default by construction, so each of the three says where it
    // stands on its own, and the corpus's `variation` and `offgrid` numbers
    // are what decided each one.
    //   trance          offgrid median 0.00, variation median 0.00 over 276
    //                   files — a sequencer, and the flattest pair measured
    //                   this round. Not `null` only because a trance record
    //                   has a HAND on the filter and the breakdown, which is
    //                   level and not time: t near zero, v low but real.
    trance:    { stress: 0.15, phrase: 0.35, touch: { t: 0.01,  v: 0.45 } },
    //   eurodance       offgrid median 0.43 over 31 files, the highest of
    //                   the three by a distance — these are records with a
    //                   singer and a rapper on top of the machine, and the
    //                   people are audibly not quantized.
    eurodance: { stress: 0.35, phrase: 0.5,  touch: { t: 0.04,  v: 0.7 } },
    //   southernhiphop  a live band over an 808: interlock median 0.24, the
    //                   highest of the three, and two hand-percussion lanes
    //                   running sixteenths. The loosest of the three, and
    //                   looser than `boombap`'s own row for the same reason
    //                   the anchor exists.
    southernhiphop: { stress: 0.45, phrase: 0.35, touch: { t: 0.07, v: 0.95 } },
    /* ...AND THE MOTOWN-AND-FOUR-ACTS ROUND'S THREE (2026-09-03). `club` has
       no family row, so these three would resolve to NOTHING and render flat
       forever (test/hand.test.js §1). None is `null`: every one has a hand in
       the loop, and each number is argued against `boombap`'s own row
       (stress .35, phrase .25, t .06, v .9), which is the wing's reference.
         politicalhiphop  THE TIGHTEST GRID IN THE WING and the loudest hand.
                          The Bomb Squad quantized hard — the row declares
                          `swing: 0.05` against boombap's 0.20 — so `t` drops
                          to .04; but the material is dozens of fragments of
                          other people's PLAYING, so the level hand stays high
                          (v .95) and the metre is stated hard (stress .5),
                          because a record built to sound like an alarm accents
                          the beat rather than leaning off it.
         jazzrap          THE LOOSEST IN THE WING, and it is the one row here
                          whose loop is an acoustic drummer: `drumkit: "jazz"`,
                          a ride figure taken from the `jazz` row itself. t .08
                          is looser than southernhiphop's .07, which was the
                          loosest before it, and the phrase lean is high (.45)
                          because a hard-bop bar breathes where a machine does
                          not.
         althiphop        boombap's hand with the swing turned up — `swing:
                          0.26` is the highest in the wing — so t .07 and a
                          softer metre (stress .35) than either sibling: four
                          voices trading over an MPC that lopes. */
    politicalhiphop: { stress: 0.5,  phrase: 0.25, touch: { t: 0.04, v: 0.95 } },
    jazzrap:         { stress: 0.3,  phrase: 0.45, touch: { t: 0.08, v: 0.85 } },
    althiphop:       { stress: 0.35, phrase: 0.4,  touch: { t: 0.07, v: 0.9 } },
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
    hambone:   { grace: 0.3 },
    rocknroll:  { pass: 0.2,  grace: 0.35 },
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
    polychoral:        { pass: 0.3 },
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
    detroitsoul:      { grace: 0.15, flam: 0.12 },
    psychsoul:       { grace: 0.2 },
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
    // THE SOUNDTRACK ROUND (2026-09-01), and only TWO of the eight earn a
    // row — the header's law holds. crimejazz is jazz's own vocabulary
    // dimmed: session players reading a chart still fill leaps and lean
    // onto beats from a semitone under, they just do it less than a
    // bandstand soloist would (jazz pass .4/approach .45, here .3/.35).
    // fantasyscore is the fiddle's celtic grace note, countrypop's kind
    // of claim one ocean east. The other six are orchestras reading
    // exactly what is on the paper, or grids — a guessed ornament on the
    // braam would be a costume, and nothing is the honest row six times.
    crimejazz:    { pass: 0.3,  approach: 0.35, grace: 0.1 },
    fantasyscore: { pass: 0.25, grace: 0.2 },
    // THE MIDI-CORPUS ROUND (2026-09-02), and only FOUR of the twenty-one
    // earn a row — the header's law holds and the other seventeen get
    // nothing. Each of these four is a bend or a click that a transcription
    // cannot write down but that everybody agrees is the style:
    //   glammetal   the bend and the hammer-on. This row's melodic mean
    //               pitch is 76.0, the highest of the round — a lead guitar
    //               at the top of its neck decorates every note it holds,
    //               and `grace` is that. It is `nwobhm`'s inheritance said
    //               louder, and the same claim `countrypop` makes with the
    //               hammer-on one family over.
    glammetal:    { grace: 0.35, pass: 0.2 },
    //   funkrock    the slap. `flam` is the thumb and the pop landing
    //               together, which is literally a doubled strike, and
    //               `funk` — this row's largest parent — already declares
    //               exactly this pair one generation up.
    funkrock:     { grace: 0.2,  flam: 0.2 },
    //   retrosoul   `detroitsoul` declares { grace: .15, flam: .12 } and
    //               this row is that record played by people who know they
    //               are quoting it: the same two terms, leaned on harder,
    //               because the ornament is the costume.
    retrosoul:    { grace: 0.25, flam: 0.15 },
    //   neotraditional  the pedal-steel slide into the note, which is
    //               `countrypop`'s own { pass: .2, grace: .4 } inherited
    //               whole and dialled back a little for the drum kit.
    neotraditional: { pass: 0.2, grace: 0.3 },
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
/*#endregion FOOT*/
    return { DRUMNAME, DEFAULTS, FAMILIES, DYN_FAMILY, DYNAMICS, ORNAMENT, HARMONYLABEL };
  }

  const api = { BLUES, DIATONIC, MODES, MODELABEL, tuned, SCALES, SCALELABEL, MOUTHS, PROGS, offbeats, breath, SUNG, DEFAULT, stamp };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuGenreTables = api;
})(typeof window !== "undefined" ? window : globalThis);
