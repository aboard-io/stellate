// nukernel/songs.js — SONGS AS DATA, and the word vocabulary they develop with.
//
// A song here is the EIGHT AXES and nothing else (nukernel/AXES.md), in the
// order the axes are evaluated: Time, Alphabet, Material, Form, Development,
// Cast, Sound, Performance. This file is DATA — no functions, no DOM, no
// engine — so a song is a value that can be diffed, saved, shipped and typed
// into by a page. The page is a view over it; the kernel is what plays it.
//
// DETERMINISM (2026-08-23, Paul: "we need to keep the system deterministic not
// LLM reliant"). Every word a section can be developed with is NAMED in WORDS
// below, and a document may only name one. Not free-form operator lists: an
// enumerated vocabulary, which is what makes the menu finite, the record
// reproducible, and the dice possible. Nothing at render, compile or save time
// calls anything but this table.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuSongs = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // THE DEVELOPMENT VOCABULARY. name -> the kernel operators it means. Every
  // one is total (kernel.js), so no word can be a wrong answer and no pair of
  // words can be an illegal sequence — which is why a menu is enough and a
  // validator is not.
  const WORDS = {
    "as written":       [],
    "the head only":    [["excerpt", 0, 4]],
    "recitation":       [["excerpt", 8, 4], ["drop", 2]],
    "up a degree":      [["excerpt", 4, 8], ["transpose", 1]],
    "down a degree":    [["transpose", -1]],
    "inverted":         [["invert", 4], ["excerpt", 0, 8]],
    "backwards":        [["reverse"]],
    "thinned":          [["drop", 2]],
    "the tail, turned": [["excerpt", 4, 4], ["reverse"]],
    "fading":           [["excerpt", 0, 4], ["drop", 2]],
    // ---- COUNTERPOINT (2026-08-23, Paul: "make another pass for
    // counterpoint — one voice polyphonic right?"). No: in this kernel a
    // VOICE IS A LINE. `render` walks v = 0..voices-1 and each v is one
    // monophonic part reading the SAME subject through its own word, its own
    // register and its own entry bar — which is exactly what counterpoint is,
    // and exactly how the `fugue` anchor works (four voices, staggered
    // entries, a different word each). Polyphony inside ONE voice is a
    // different thing and already has a name here: `realize: "pad"` (or
    // "stab"), which voices the sounding chord instead of playing a line.
    //
    // So counterpoint needs no new machinery — it needs the words a second
    // line is answered with. These are those words.
    "at the fifth":      [["transpose", 4]],
    "at the fourth":     [["transpose", 3]],
    "at the octave":     [["transpose", 7]],
    "below, at the fifth": [["transpose", -4]],
    "in contrary motion": [["invert", 4]],
    "in retrograde":     [["reverse"]],
    "a beat later":      [["rotate", -4]],
    "half a bar later":  [["rotate", -8]],
    "in wider steps":    [["spread", 2]],
    "at the fifth, a beat later": [["transpose", 4], ["rotate", -4]],
    // OUT. `drop(1)` kills every gate — (i+1) % 1 is always 0 — so a voice
    // can be silent for a section without leaving the record. It is how you
    // solo a line to hear what it is doing, and how a verse drops to two
    // voices and the chorus opens back to four.
    "out":               [["drop", 1]],
    // ---- FIVE OPERATORS THE ALPHABET HAD AND THE VOCABULARY DID NOT --------
    // (2026-08-24, D7. Paul: "we had lots of fun nudges to the music and
    // motifs".) Every one of these was already a total kernel operator with a
    // fields.js OPS entry and a unit gate over it, and no word reached it — so
    // the page could invert a subject but not re-time it, and could thin a
    // phrase but not fill one back in.
    //
    // WRITTEN AS OP KEYS, NOT AS CALLS, and that is not a shorthand: an entry
    // may be an op KEY as well as a [name, ...args] pair (kernel.js:1190
    // `asOps`: "an op is a function or one of the keys above" — data all the
    // way down), and a key is the SAME alphabet fields.js OPS and the palette
    // speak, held equal to kernel.js OPKEYS by a unit gate. A word spelled in
    // op keys cannot drift away from the chip that means the same thing.
    //
    // THE FIRST TWO ARE THE `only` DISCIPLINE, which is the whole reason they
    // are interesting: `gat4` rotates the GATE alone and keeps every note, so
    // the subject is re-timed and still recognisably itself; `pit4` rotates
    // `deg` alone and keeps the rhythm. Answering a line with its own rhythm
    // carrying different notes is a counterpoint move that had no name here.
    "the rhythm, moved": ["gat4"],
    "the notes, moved":  ["pit4"],
    // `fill` UNCOVERS notes the phrase was holding silent (it is `dens` on the
    // palette) — the opposite of `thinned`, and the vocabulary had only the
    // one direction.
    "filled in":         ["dens3"],
    // `split` divides each note into n attacks, and a step carrying `inc`
    // climbs while it does (kernel.js:150) — which is how a held tone becomes
    // a figure without anybody writing one.
    "split in two":      ["rep2"],
    // the accents inverted: what was leaned on is passed over and what was
    // passed over is leaned on. The same eight notes, a different bar.
    "accents flipped":   ["accflip"],
    // ---- AND THE TWO THAT CANNOT BE SAID HERE, NAMED RATHER THAN FAKED ----
    // "stretched out, twice as slow" and "twice as fast, and twice over" —
    // augmentation and diminution, the two oldest transforms in counterpoint,
    // and both are IMPLEMENTED: ideas-kit.js:621 and :645, as functions over a
    // RENDERED phrase. They are not here because no kernel operator maps step
    // i to step 2i. `split` changes attacks and keeps the length, `del` closes
    // the gap and shortens it, `spread` moves degrees and not time — none of
    // the three stretches. A word spelled out of the operators that DO exist
    // would be a word that lies about what it does, so the alphabet has to
    // grow first. Flagged for the kernel owner (PROGRAM.md §4 item 6); a
    // builder must not pretend otherwise.
  };

  // WHICH FAMILY EACH WORD BELONGS TO. A word and its family are ONE FACT, so
  // the family is stated here beside the word and not in the page that draws
  // it — the sheet reads this table for its group headings and the extractor
  // reads the same one, which is what keeps the heading over a word from
  // drifting away from the word (2026-08-24, design 02 §5).
  //
  // Every key of WORDS must appear here; `gates-extract.js --check` fails on a
  // word with no group, exactly as test/unit/every-head.test.js fails an
  // askable.js row with no `head` (askable.js:66-71). The ORDER of first
  // appearance below is the order the groups are drawn in, and it is a
  // contract: a sheet re-groups on every redraw and focus comes back by
  // `data-k`, so a group order that moved would move a control under a live
  // finger (design 02 §6.7).
  const WORDGROUP = {
    "as written":            "the subject",
    "the head only":         "a piece of it",
    "recitation":            "a piece of it",
    "the tail, turned":      "a piece of it",
    "fading":                "a piece of it",
    "thinned":               "a piece of it",
    "up a degree":           "moved in pitch",
    "down a degree":         "moved in pitch",
    "inverted":              "moved in pitch",
    "in wider steps":        "moved in pitch",
    "backwards":             "turned around",
    "at the fifth":          "counterpoint",
    "at the fourth":         "counterpoint",
    "at the octave":         "counterpoint",
    "below, at the fifth":   "counterpoint",
    "in contrary motion":    "counterpoint",
    "in retrograde":         "counterpoint",
    "a beat later":          "counterpoint",
    "half a bar later":      "counterpoint",
    "at the fifth, a beat later": "counterpoint",
    "out":                   "silence",
    // the five 2026-08-24 words (see WORDS above). Two of them keep one vector
    // and move the other, which is a family of its own and not "moved in
    // pitch": `gat4` moves no pitch at all. The other three change how much of
    // the subject is sounding, which is what "a piece of it" has always meant
    // here read in both directions.
    "the rhythm, moved":     "one vector at a time",
    "the notes, moved":      "one vector at a time",
    "filled in":             "a piece of it",
    "split in two":          "a piece of it",
    "accents flipped":       "a piece of it",
  };

  /* ---- Rome 600 -----------------------------------------------------------
     (2026-08-24, Paul: "let's do Gregorian chant.")

     `basis` is genres.js `gregorian` — Rome 600: two voices, MODAL harmony
     (no chord cycle at all), no bass, no kit, and rate 0.5, which is what
     makes each sixteen-step cell last two bars of clock. Chant is unmetered
     and this box counts in sixteenths; half speed and long holds is as close
     as an honest grid gets.

     MODE II, hypodorian: final D, reciting tone F a third above, the
     subtonium C below. Mode I would be the obvious choice and it does not
     fit — the kernel folds each voice into a 13-semitone window around its
     centre (kernel.js:248), which IS a chant ambitus, but degree 0 sits at
     the centre, so an authentic mode's tenor a fifth up falls out of the
     window and comes back an octave low. The plagal mode puts the tenor a
     third above the final and everything stays inside.

     ALTERNATIM, which is how psalmody is actually sung: the cantor intones,
     then cantor and schola take verses in turn, then both sing the doxology
     together, an octave apart. The word for "this voice is silent here" is
     `out`, so the alternation is written in the Development column and needs
     no machinery of its own. */
  const TERMS = {
    basis: "gregorian",

    // A CHOIR THAT SPEAKS. faust/dsp/choir.dsp is a PAD by construction — its
    // envelope is hardcoded `en.adsr(attack, 1.5, 0.8, 2.5, gate)`, so every
    // note rings two and a half seconds past its gate and a run of sixteenths
    // is one chord. Only `attack` is a slider; there is no knob for the tail,
    // and no Faust compiler here to add one. The VP-330 is the same idea with
    // the envelope exposed — a Roland vocal ensemble, `attack`, `sustain` and
    // `release` all sliders — so it can sing a neume without smearing it.
    // (The same is true of organ, strings and pad_saw: all four share that
    // baked 2.5s release. juno60, fm2op and casiocz expose the whole
    // envelope; piano, bell, kpluck and tb303 are short by nature.)
    // …AND THE ROOM IT IS SUNG IN. gregorian's own `tone.verb` is 0.78 — the
    // anchor has always asked for 78% wet — and until 2026-08-24 that number
    // landed in a return that was shut: audio/plan.js handed toEngine
    // `reverb: 0`, `rgain = clamp(reverb*3.2, 0, 2)` was therefore 0, and
    // nothing on this page could write it. 78% wet and bone dry, for the whole
    // life of the record. `ret` is the ABSOLUTE return now (fields.js RETURNS,
    // hall = 0.5) rather than the multiplier it was before the one-engine round
    // deleted the WebAudio return it multiplied. THIS IS THE ONE LINE OF THE
    // 2026-08-24 ROUND THAT CHANGES HOW THE SHIPPED RECORD SOUNDS: a chant that
    // was dry is a chant in a stone room, which is what songs.js has said it
    // wanted since the day it was written ("sounds like a stone room full of
    // people, which is what was asked for"). desk-gate G6 is the reading.
    sound: { level: 1, buses: { rev: { ret: "hall" } } },

    // RATE STATED, NOT INHERITED. The anchor reads its phrases at half speed
    // (genres.js gregorian, rate 0.5), which makes a sixteen-step cell last
    // TWO bars of clock — so a printed measure was not a measure and the
    // playhead lit notes a bar before they sounded. At rate 1 a cell is a
    // bar, the staff is what you hear, and the tempo carries the slowness.
    time: { bpm: 58, rate: 1, meter: null, swing: null },

    // no chord cycle: `modal` is the anchor's own harmony and it means one
    // mode, no changes — the thing chant has instead of a progression
    alphabet: { key: 2, mode: "dorian", diatonic: true, harmony: "modal",
                prog: [{ d: 0, q: "triad" }] },

    material: { cells: {
      // THE PSALM TONE: intonation, reciting tone, cadence. The tenor is held
      // six steps because recitation is where the words go.
      psalm: { kind: "line",
        deg:  [0, 0, 1, 1,  2, 2, 2, 2,  2, 2, 2, 1,  0, 0, 0, 0],
        play: ["n","h","n","h", "n","h","h","h", "h","h","n","n", "n","h","h","h"],
        vel:  [5, 5, 5, 5,  6, 6, 6, 6,  6, 6, 5, 5,  5, 5, 5, 5],
        acc:  [0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0] },
      // THE BED — one note, held the whole measure: the reciting tone under
      // everything. This is an ISON, and it is worth saying that an ison is
      // BYZANTINE, not Gregorian: Rome 600 is monophonic and a drone under
      // the line is a later idea (and an Eastern one). It is here because it
      // sounds like a stone room full of people, which is what was asked for.
      bed: { kind: "line",
        deg:  [2, 2, 2, 2,  2, 2, 2, 2,  2, 2, 2, 2,  2, 2, 2, 2],
        play: ["n","h","h","h", "h","h","h","h", "h","h","h","h", "h","h","h","h"],
        vel:  [4, 4, 4, 4,  4, 4, 4, 4,  4, 4, 4, 4,  4, 4, 4, 4],
        acc:  [0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0] },
      // A NEUME: the melisma that decorates a cadence — up to G, down through
      // the subtonium and back to the final.
      neume: { kind: "line",
        deg:  [3, 3, 2, 2,  1, 1, 2, 2,  0, 0, 0, 0,  -1, -1, 0, 0],
        play: ["n","h","n","h", "n","h","n","h", "n","h","h","h", "n","h","n","h"],
        vel:  [5, 5, 5, 5,  5, 5, 5, 5,  5, 5, 5, 5,  5, 5, 5, 5],
        acc:  [0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0] },
    } },

    form: { sections: [
      { id: "c1", role: "head",  bars: 4 },    // the cantor intones
      { id: "c2", role: "verse", bars: 8 },    // schola
      { id: "c3", role: "verse", bars: 8 },    // cantor
      { id: "c4", role: "verse", bars: 8 },    // schola
      { id: "c5", role: "tag",   bars: 8 },    // both, the doxology
    ] },

    voices: [
      // TWO THROATS, NOT ONE MOUTH. faust/dsp/tract_voice.dsp is the
      // Kelly-Lochbaum tube and it is the right idea — a glottis, a tongue,
      // lips, a velum, walking articulatory targets into SYLLABLES — but in
      // this path it does not sustain: measured on the schola's verse it
      // sounds for about six seconds and then decays to silence and stays
      // there, at every setting of `artic` and `babble` including zero
      // (0.34 → 0.27 → 0.19 → 0.02 → 0.002 → 0 …). Its formant-bank siblings
      // hold steady on the same notes (voice_lead measured 0.24-0.37 straight
      // through), so the chant is sung by the singers: one throat for the
      // cantor, four over two throats for the schola, which is what a cantor
      // and a schola ARE.
      { name: "cantor", kind: "line",
        cast: { part: "line", reg: 0, entry: 0 },
        material: "psalm", instrument: "tract_voice", level: 0.15,
        // TWELVE NUMBERS, AND TWO OF THEM WERE A LIE — REMOVED 2026-08-25.
        // This `set` also said `vowel: 1.4` and `push: 0.42`, and VOICE.md's
        // inventory measured that neither reaches the engine. Re-proved before
        // deleting, in the source both sides read:
        //
        //   `vowel`  state-engine.js:1600 seats a mouth with
        //            `params: { ...base.params, vowel: word[0], ... }` where
        //            `word = tractWalk(m.vowels)`, and the players rewrite it
        //            every syllable off that same walk. The recipe's own
        //            `vowel` is never read — `base.params` is `{ level }`, not
        //            a copy of the recipe — so 1.4 was overwritten before the
        //            first note. THE ONLY WAY TO SAY A VOWEL IS THE `vowels`
        //            STRING, in LETTERS: the singers' tables are indexed
        //            a-e-i-o-u and the tract's are i-e-a-o-u (TRACT_ROW), so a
        //            vowel written as a NUMBER means two different sounds
        //            depending on which family reads it and nothing ever
        //            fails. 1.4 cannot be honestly translated for that exact
        //            reason — it is between `e` and `a` in one table and
        //            between `e` and `i` in the other — so it comes out rather
        //            than being guessed into a letter. What the cantor sings
        //            today is the tract's own default, the open vowel `a`
        //            (tractWalk(undefined) -> [0] -> TRACT_ROW[0]), and absent
        //            is today.
        //   `push`   the glottal fold, and it is this module's DYNAMIC axis:
        //            state-engine.js:1094 `TRACT_DYN = { push: [0.12, 0.9] }`
        //            and both renderers drive it from the note's velocity, so
        //            a static value is rewritten on every hit. There is no
        //            free workaround: "press harder" is a velocity edit in the
        //            motif grid's `vel` row, which is where the chant already
        //            says it (psalm recites at 6 and cadences at 5).
        //
        // The ten that remain are all read: `artic`/`babble`/`rate`/`seed`
        // drive the syllable engine, `open`/`breath`/`voiced` the glottis, and
        // `vibrato`/`attack`/`release` the envelope (state-engine.js:1601-1644).
        set: { artic: 0.45, babble: 0.4, rate: 2.0, seed: 1,
               open: 0.6, breath: 0.07, voiced: 1,
               vibrato: 0.004, attack: 0.03, release: 0.22 },
        development: { c1: "as written", c2: "as written", c3: "in retrograde",
                       c4: "the head only", c5: "as written" } },
      { name: "schola", kind: "line",
        // THE SAMPLED CHOIR, floating. A recording of people is the one thing
        // a model cannot be, and what this part needs is BODY rather than
        // articulation — it holds one note. So the sample takes it and the
        // tract, which is wasted on a held tone and unbeatable on a moving
        // line, goes to the cantor above.
        // A LINE, NOT A PAD. `pad` voices the sounding CHORD — it came out
        // as D-F-A, a triad, which is harmony, and chant has none. A line
        // holds the one note the cell says.
        cast: { part: "line", reg: -1, entry: 0 },
        material: "bed", instrument: "ahh_choir", level: 0.6,
        development: { c1: "out", c2: "as written", c3: "as written",
                       c4: "as written", c5: "as written" } },
    ],

    performance: { take: 0, humanize: 0, ontime: true },
  };

  return { WORDS, WORDGROUP, TERMS, SONGS: { terms: TERMS } };
});
