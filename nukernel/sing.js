// sing.js — THE SINGER, as data and arithmetic. Classic UMD like fields.js,
// node-loadable, zero DOM, zero audio: this file decides WHICH SYLLABLE lands
// on WHICH NOTE IN WHICH VOICE, and audio/sing.js does what it says.
//
// WHY IT IS SPLIT THAT WAY. Everything below is measurable in the pure gate —
// the syllable split, the word bank, the note selection, the harmony interval,
// the espeak pitch rung — and none of it needs a wasm instance or an
// AudioContext to be wrong. The audio tier is then a renderer with no opinions:
// it synthesizes what the plan names, measures what came back, and bends it.
//
// Place in the layer graph: kernel.js (algebra) -> genres.js -> fields.js
// (control vocabulary) -> song.js -> instruments.js -> THIS FILE -> compose.js
// -> presets.js -> the UI. fields.js reaches UP to it for the `sing` table
// (which is vocabulary and belongs in the registry), so this file must not
// import fields.js back; it imports nothing but genres.js.
(function (root) {
  "use strict";
  const NG = (typeof module !== "undefined" && module.exports)
    ? require("./genres.js") : root.NuGenres;
  const { GENRES } = NG;

  /* ================================================================ SYLLABLES
     HOW A WORD IS SPLIT, AND WHY IT IS SPLIT TWICE.

     There are two syllabifiers in play and they answer different questions.
     The REAL one is espeak's own: its synthesize callback emits a `phoneme`
     mark per phone with an `audio_position` in ms, so the vowel nuclei of an
     utterance — where the syllables actually ARE, in the audio — are handed
     over for free (engine/speech.js `marks`, which this round taught it to
     keep). audio/sing.js cuts on those, and nothing here can be more accurate
     than they are.

     But the PLAN has to exist before any audio does: the arranger must know
     how many notes a word will occupy in order to lay a line over a melody,
     and it must know it in a pure function that the node gate can measure. So
     this is a LETTER-RULE counter, deliberately conservative, and the gate
     (test/unit/nukernel.test.js §43) holds it against espeak's nuclei count
     for every word in every bank. When the two disagree the bank is wrong, not
     the audio: the banks below are monosyllable-first precisely so the
     disagreement surface is small.

     THE RULES, in the order they fire:
       1. letters only, lowercased.
       2. a NUCLEUS is a maximal run of a e i o u, plus y when it is not the
          first letter (yes -> 1 nucleus; sky -> 1; ay -> 1, the run absorbs it).
       3. a final silent e is not a nucleus — EXCEPT when it would leave the
          word with none (the, be), and except in a final consonant + "le",
          which is its own syllable (ta-ble, lit-tle).
       4. between two nuclei the boundary leaves ONE consonant as the next
          syllable's onset (V|CV, the open-syllable default) unless the run is
          a digraph we must not cut (ch sh th ph wh gh ck ng qu), in which case
          the whole digraph goes to the onset.
     Rule 4 only affects WHERE we would cut, never the COUNT, and the count is
     all the plan needs — so `syllables()` returns the pieces and `nsyl()`
     returns the number, and only the number is load-bearing. */
  const VOWELS = "aeiou";
  const DIGRAPH = ["ch", "sh", "th", "ph", "wh", "gh", "ck", "ng", "qu"];
  const isVowel = (ch, i) => VOWELS.indexOf(ch) >= 0 || (ch === "y" && i > 0);

  function syllables(word) {
    const w = String(word == null ? "" : word).toLowerCase().replace(/[^a-z]/g, "");
    if (!w) return [];
    // (2) the nuclei, as [start, end) index runs
    const nuc = [];
    for (let i = 0; i < w.length; i++) {
      if (!isVowel(w[i], i)) continue;
      let j = i; while (j + 1 < w.length && isVowel(w[j + 1], j + 1)) j++;
      nuc.push([i, j + 1]); i = j;
    }
    if (!nuc.length) return [w];                    // "hmm", "psst": one anyway
    // (3) the silent final e, and the consonant+le that is not one
    const last = nuc[nuc.length - 1];
    if (nuc.length > 1 && last[1] === w.length && last[1] - last[0] === 1 &&
        w[last[0]] === "e") {
      const cle = last[0] >= 2 && w[last[0] - 1] === "l" &&
                  !isVowel(w[last[0] - 2], last[0] - 2);
      if (!cle) nuc.pop();
      else nuc[nuc.length - 1] = [last[0] - 1, last[1]];   // the "le" IS the nucleus
    }
    if (nuc.length === 1) return [w];
    // (4) cut points: one consonant to the next onset, digraphs kept whole
    const cuts = [];
    for (let k = 1; k < nuc.length; k++) {
      const gapFrom = nuc[k - 1][1], gapTo = nuc[k][0];
      if (gapTo <= gapFrom) { cuts.push(gapTo); continue; }   // adjacent nuclei
      let cut = gapTo - 1;                                    // V|CV
      const pair = w.slice(gapTo - 2, gapTo);
      if (gapTo - 2 >= gapFrom && DIGRAPH.indexOf(pair) >= 0) cut = gapTo - 2;
      cuts.push(Math.max(gapFrom, cut));
    }
    const out = []; let at = 0;
    for (const c of cuts) { out.push(w.slice(at, c)); at = c; }
    out.push(w.slice(at));
    return out.filter(s => s.length);
  }
  const nsyl = w => syllables(w).length;

  /* ================================================================== LYRICS
     THE WORD BANK, per genre FAMILY (genres.js FAMILIES), and it is small on
     purpose. Every token below is ONE SYLLABLE — checked by the gate against
     both this file's counter and espeak's nuclei — because a monosyllabic bank
     makes the whole "which syllable is on which note" question exact: one
     token, one nucleus, one note. Where a real word is polysyllabic it is
     written pre-split ("a gain", "be low"), which is also how a lyric sheet
     writes it under a melody, and which gives espeak a word boundary at the
     syllable boundary rather than making us guess one.
     Nothing here is a lyric anyone wrote; they are placeholders in the plain
     register the machine can actually pronounce. */
  const BANKS = {
    kernel: [["hold", "on", "the", "light", "goes", "down"],
             ["wait", "for", "the", "sound", "to", "come", "round"]],
    // the chant family gets Latin, because that is what those anchors ARE
    // (gregorian / spem / bulgarian) and because liturgical Latin is open
    // vowels on long notes, which is the easiest thing a formant synth sings
    vox:    [["do", "na", "no", "bis", "pa", "cem"],
             ["ky", "ri", "e", "e", "lei", "son"]],
    club:   [["come", "on", "move", "it", "now"],
             ["all", "night", "long", "we", "don't", "stop"]],
    soul:   [["hold", "me", "close", "and", "don't", "let", "go"],
             ["say", "my", "name", "one", "more", "time"]],
    groove: [["one", "love", "one", "heart", "one", "sound"],
             ["step", "light", "on", "the", "hot", "road"]],
    band:   [["burn", "it", "down", "and", "start", "a", "gain"],
             ["I", "won't", "wait", "for", "you", "now"]],
    studio: [["call", "my", "name", "and", "I", "will", "come"],
             ["late", "in", "the", "day", "we", "drive", "home"]],
    drift:  [["slow", "and", "far", "a", "way", "from", "here"],
             ["light", "falls", "through", "the", "long", "hall"]],
    roots:  [["long", "road", "home", "a", "lone", "at", "last"],
             ["down", "by", "the", "cold", "green", "sea"]],
    parts:  [["la", "la", "la", "la", "da", "da"],
             ["oh", "oh", "oh", "way", "oh"]],
  };
  const FALLBACK_BANK = "kernel";
  const bankFor = gk => {
    const g = GENRES[gk];
    return BANKS[(g && g.family) || FALLBACK_BANK] || BANKS[FALLBACK_BANK];
  };
  // mulberry32, compose.js's own generator — a seed is a song, and a seed is
  // also a lyric. Duplicated rather than imported because compose.js sits
  // BELOW this file in the layer graph and importing it would close a cycle.
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // the line a box sings: one of the family's, chosen by seed, then repeated
  // as far as the notes go. NOT reshuffled per repeat — a hook is a hook, and
  // the second time round has to be recognizably the first time round.
  function lyricFor(gk, seed) {
    const bank = bankFor(gk);
    return bank[Math.floor(rng((seed | 0) + 0x5177)() * bank.length) % bank.length];
  }

  /* ================================================================= VOICES
     NINE SINGERS, AND THE MEASURED LADDER EACH ONE HAS.

     The vendored espeak build (vendor/espeak-ng/) turns out to carry the !v
     variants after all — the trim kept `voices/!v/*`, all 104 of them — but
     engine/speech.js passed lang "en" to set_voice, which MEASURABLY wins over
     the voice name, so `variant` was a dead field on all 230 registry-data.js
     rows that declare one. The organ takes an additive `lang` option; pass
     lang "" and the variant applies. That is the entire reason more than one
     voice is possible at all, and it is why every row below names a lang.

     AND THEN THE CATALOGUE SANG IN ONE MAN'S VOICE ANYWAY. "always a masculine
     voice" (Paul, 2026-08-17) — because this table had exactly two rows, the
     base voice for every lead and f3 for every harmony, so a crooner, a boy
     band, a screamo vocal and a hymn were one bass-baritone with a woman
     doubling him. Nine singers now, paired into CASTS below, and which cast a
     record hires is the genre's own declaration.

     THE LADDERS ARE MEASURED, NOT DERIVED, AND MEASURED ON THE REAL PROTOCOL.
     espeak's `pitch` is 0..99 with no documented Hz mapping, so the tables
     below are what came out — but the FIRST measurement was taken on "la la
     la" at speed 150 and it was wrong for this use by up to 3.5 semitones:
     a stressed diphthong ("late") sits far above a neutral schwa, so a ladder
     calibrated on one syllable mis-centred every rung and the residual bends
     came out at 1.7-4.0 semitones instead of the +-2.2 the rungs promise.
     What is baked below is the median MIDI of EVERY SYLLABLE OF EVERY BANK
     LINE (875 syllables a rung), synthesized at the speed audio/sing.js
     actually uses and cut the way it actually cuts, measured with the found
     layer's own detector (engine/faust/voices/found-player.js f0Profile).
     `node test/unit/nukernel.test.js --calibrate-sing` reprints the table.

     WHY THESE NINE AND NOT ANY OTHER NINE. Each row is a different THROAT —
     the variant files set formants, breath, roughness and flutter, not just a
     pitch range — and the four low rows sit inside a tone of each other at the
     bottom rung, which is the point: they are the same register sung by
     different people, not one person transposed. Two candidates were measured
     and REFUSED: `grandpa` (flutter 20) came back non-monotone in pitch — 44.1
     at rung 10 against 43.7 at rung 25, which is a detector reading a wobble
     rather than a voice — and `croak` fell nearly ten semitones across the
     ladder in the wrong direction. A ladder that does not ascend cannot be
     inverted, so those two are not singers here whatever they sound like. */
  const LADDERS = {
    // the LOWS — the leads. bari is the shipped voice, unchanged in character
    // and re-measured with the rest so one protocol covers the cast.
    bari:  [[10, 39.62], [25, 41.13], [40, 42.98], [55, 45.15],
            [70, 47.48], [85, 50.12], [99, 52.82]],
    tenor: [[10, 40.51], [25, 42.13], [40, 43.51], [55, 45.56],
            [70, 47.82], [85, 50.37], [99, 52.91]],
    croon: [[10, 42.96], [25, 43.23], [40, 44.47], [55, 46.50],
            [70, 48.82], [85, 50.90], [99, 53.27]],
    rough: [[10, 39.03], [25, 40.06], [40, 41.57], [55, 43.69],
            [70, 46.16], [85, 48.77], [99, 51.43]],
    // the HIGHS — the harmonies, and torch's lead
    mezzo: [[10, 51.54], [25, 53.32], [40, 55.27], [55, 57.42],
            [70, 59.76], [85, 62.27], [99, 64.69]],
    alto:  [[10, 49.54], [25, 51.58], [40, 53.65], [55, 56.04],
            [70, 58.60], [85, 61.36], [99, 63.88]],
    sopr:  [[10, 49.77], [25, 52.01], [40, 54.31], [55, 56.93],
            [70, 59.68], [85, 62.59], [99, 65.29]],
    belt:  [[10, 47.60], [25, 49.82], [40, 52.07], [55, 54.57],
            [70, 57.35], [85, 60.15], [99, 62.85]],
    kid:   [[10, 54.89], [25, 57.00], [40, 59.22], [55, 61.72],
            [70, 64.34], [85, 67.10], [99, 69.77]],
  };
  // FOUR RUNGS PER VOICE, and the number is a measured trade rather than a
  // taste. An utterance is one espeak instance (~234 ms in node, ~210 ms in
  // chromium per vendor/espeak-ng/README.md) and the instance is per PITCH, so
  // rungs cost warm-up time linearly: 4 rungs x 2 voices = 8 utterances ~= 2 s
  // for a whole song's worth of singing, paid once beside the zone fetches.
  // What they buy is a SMALL BEND: a ladder spans 10.3 (croon) to 14.9 (kid)
  // semitones, so four evenly spaced rungs put every target within 2.0
  // semitones of a rung for the default pair and 2.4 for the widest cast
  // (shout), and the residual is the only thing that shifts formants (espeak's
  // own pitch knob is source-side and leaves the filter alone). Three rungs
  // would be half again that, which starts to sound like a different person
  // per note.
  const NRUNGS = 4;
  // MIDI at an espeak pitch param, by linear interpolation ON THE MEASUREMENT.
  // A straight-line fit was off by 0.8 semitones in the middle of the base
  // ladder — the response is faintly convex — and 0.8 semitones is a third of
  // the whole error budget the rungs exist to buy.
  function ladderMidi(L, p) {
    if (p <= L[0][0]) return L[0][1];
    if (p >= L[L.length - 1][0]) return L[L.length - 1][1];
    for (let i = 1; i < L.length; i++) {
      if (p > L[i][0]) continue;
      const [p0, m0] = L[i - 1], [p1, m1] = L[i];
      return m0 + (m1 - m0) * ((p - p0) / (p1 - p0));
    }
    return L[L.length - 1][1];
  }
  // ...and the inverse, which is what picks a rung: the pitch param that lands
  // nearest a wanted MIDI. Integer, because espeak rounds it anyway and a
  // fractional rung would be a cache key that never hits twice.
  function ladderPitch(L, midi) {
    if (midi <= L[0][1]) return L[0][0];
    if (midi >= L[L.length - 1][1]) return L[L.length - 1][0];
    for (let i = 1; i < L.length; i++) {
      if (midi > L[i][1]) continue;
      const [p0, m0] = L[i - 1], [p1, m1] = L[i];
      return Math.round(p0 + (p1 - p0) * ((midi - m0) / (m1 - m0)));
    }
    return L[L.length - 1][0];
  }
  const rungsOf = L => {
    const lo = L[0][1], hi = L[L.length - 1][1], out = [];
    for (let i = 0; i < NRUNGS; i++)
      out.push(ladderPitch(L, lo + (hi - lo) * (i / (NRUNGS - 1))));
    return out;
  };
  /* --------------------------------------------------------- THE CAST
     WHO THE NINE ARE. `variant` is the espeak !v file, `lang` is the knob that
     makes it reachable at all — "" for every variant (see the note above),
     "en" for the base voice, which has no variant to protect and so stays on
     the exact call sequence every other consumer of the organ uses.

       bari   the base voice: the bass-baritone this page has always sung in,
              non-rhotic, plain. Still the default, still the rock lead.
       tenor  m7 — voicing 155, a brighter and more forward throat at the same
              pitch: the beat-group lead, the one that carries a hook
       croon  Michael — narrow pitch band, heavy voicing, soft consonants: the
              close-mic'd microphone singer
       rough  m1 — roughness 4 and flutter 5, the only low voice with grain in
              it: a shout, and the one that does not sound hurt by a holler
       mezzo  f3 — the shipped harmony voice, breath and echo in the file
       alto   f2 — lower and rounder than mezzo, with its own echo: a woman who
              can take the tune rather than only the line above it
       sopr   f5 — breath 6 and consonants 150: air, and consonants that cut
       belt   f1 — roughness 4, flutter 8: the female voice with grain, so a
              shouted stack is two rough voices rather than one rough and one
              polite
       kid    anika — pitch 200-300, intonation 10: the top of a group vocal */
  const SINGERS = {
    bari:  { variant: "",        lang: "en" },
    tenor: { variant: "m7",      lang: ""   },
    croon: { variant: "Michael", lang: ""   },
    rough: { variant: "m1",      lang: ""   },
    mezzo: { variant: "f3",      lang: ""   },
    alto:  { variant: "f2",      lang: ""   },
    sopr:  { variant: "f5",      lang: ""   },
    belt:  { variant: "f1",      lang: ""   },
    kid:   { variant: "anika",   lang: ""   },
  };
  for (const key of Object.keys(SINGERS)) {
    const V = SINGERS[key], L = LADDERS[key];
    if (!L) throw new Error("sing.js: singer " + key + " has no measured ladder");
    // A LADDER THAT DOES NOT ASCEND CANNOT BE INVERTED, and ladderPitch is the
    // whole rung mechanism. Held here rather than in the gate because a bad
    // paste would otherwise sing every note at the bottom rung and sound
    // merely dull, which is the failure nobody reports.
    for (let i = 1; i < L.length; i++)
      if (L[i][1] <= L[i - 1][1])
        throw new Error("sing.js: " + key + "'s ladder falls at rung " + L[i][0]);
    V.key = key; V.ladder = L; V.rungs = rungsOf(L);
  }
  /* A CAST IS A LOW SINGER AND A HIGH ONE, in that order, because that is what
     the two voice indices ARE: vi 0 takes the tune, vi 1 takes whatever sits
     above it (sing.js THE STACK). Six of them, and the pairing is the whole
     design — a record does not hire a lead and a harmony from different
     rooms. Every cast is checked below to make sure its high voice really is
     above its low one, or `harmony` would compute a note above the tune and
     the fold would sing it underneath. */
  const CASTS = {
    band:    ["bari",  "mezzo"],   // the shipped pair: rock, blues, the goths
    crooner: ["croon", "alto"],    // the microphone singer and a low woman
    shout:   ["rough", "belt"],    // both voices with grain in them
    teen:    ["tenor", "sopr"],    // the beat group: bright lead, air on top
    torch:   ["alto",  "kid"],     // a WOMAN LEADS — soul, disco, the club
    chapel:  ["bari",  "sopr"],    // plainchant's own spread, an octave and more
  };
  const DEFAULT_CAST = "band";
  for (const [k, [lo, hi]] of Object.entries(CASTS)) {
    if (!SINGERS[lo] || !SINGERS[hi]) throw new Error("sing.js: cast " + k + " names nobody");
    if (SINGERS[hi].ladder[0][1] <= SINGERS[lo].ladder[0][1])
      throw new Error("sing.js: cast " + k + "'s harmony sits under its tune");
  }
  // THE TWO ROLES, as the default cast plays them — `VOICES[vi]` is still "the
  // singer at voice index vi" for every reader that does not know about casts
  // (the gate, the probe, and any call that omits one).
  const castOf = c => CASTS[c] || CASTS[DEFAULT_CAST];
  const voiceOf = (vi, cast) => SINGERS[castOf(cast)[vi ? 1 : 0]];
  const VOICES = [voiceOf(0), voiceOf(1)];
  const voiceMidi = (vi, pitch, cast) => ladderMidi(voiceOf(vi, cast).ladder, pitch);
  // FOLD A TARGET INTO A SINGER. A melody is written wherever the genre writes
  // it and a throat is a fourth-and-a-bit wide, so the note a voice actually
  // sings is the target's nearest OCTAVE inside the ladder. This is the same
  // move audio/voices.js foldInto makes for a sampled instrument and for the
  // same reason: an instrument played outside its range is a different
  // instrument. The ladder spans more than an octave, so the loop terminates.
  function foldToVoice(vi, midi, cast) {
    const L = voiceOf(vi, cast).ladder, lo = L[0][1], hi = L[L.length - 1][1];
    let m = midi;
    while (m < lo - 0.5) m += 12;
    while (m > hi + 0.5) m -= 12;
    return m;
  }
  // the rung whose own F0 is nearest the folded target, and the residual the
  // player will have to bend. `bend` is NOMINAL — the player re-measures the
  // rendered syllable and bends from THAT (found-player's autoTuneRate law:
  // the clip's own median, never the number we hoped for) — but it is what the
  // gate reads to prove the rungs are doing their job.
  function rungFor(vi, midi, cast) {
    const V = voiceOf(vi, cast), want = foldToVoice(vi, midi, cast);
    let best = V.rungs[0], bestD = Infinity;
    for (const p of V.rungs) {
      const d = Math.abs(ladderMidi(V.ladder, p) - want);
      if (d < bestD) { bestD = d; best = p; }
    }
    const base = ladderMidi(V.ladder, best);
    return { pitch: best, midi: want, base, bend: want - base };
  }

  /* ============================================================== THE CARRIER
     WHAT THE VOCODER SINGS THROUGH, and this is the half that was missing.

     A channel vocoder is two signals: the VOICE is the modulator (espeak, cut
     into syllables above) and a SYNTH TONE is the carrier. The voice supplies
     only a moving spectral envelope; every sample you actually hear comes out
     of the carrier. So the carrier IS the sound, and offering exactly one of
     them — robot_choir.dsp's three detuned saws — was offering one robot.

     "Don't forget you have a real analog synth, real filters and a DX7 as
     needed along with samples" (Paul, 2026-08-17). The engine next door has
     the real models (engine/faust/dsp: modeld, tb303, dx7_alg*, robot_choir),
     and each row below is drawn from ONE of them, `from` naming which. What is
     borrowed is the OSCILLATOR SECTION and the filter, not the wasm: the
     vocoder runs in the buffer domain at fit time (see the cost note in
     audio/sing.js — a 32-band bank as live nodes would be 64 biquads per
     note), so a Faust worklet cannot stand in the middle of it. The numbers
     are the shipped models' own wherever the model has them: `moog` carries
     instruments.js FONTS.analog's cutoff/res/oscMix/drift verbatim, `303`
     carries tb303's single saw into a screaming ladder.

     ONE RULE DECIDES WHETHER A CARRIER WORKS AT ALL: it must be
     HARMONICALLY DENSE across 200 Hz–3 kHz, because a band with no carrier
     energy in it cannot be modulated and simply goes silent — vocode a sine
     and you get a sine. That is why every row is saws, pulses or a
     high-index FM pair, and why the FM row's index has a FLOOR rather than
     decaying to a bell.

       osc     [ratio, wave, amp, (pulse width)] partials, summed
       fm      one 2-op pair: sin(2pi(p + idx*sin(2pi*ratio*p))), idx decaying
               from `index` to `floor` over `decay` seconds
       drift   slow detune, in cents (the analog wobble)
       ladder  the carrier's OWN filter, 4-pole with real resonance, with an
               optional envelope in octaves — the acid squelch is this line */
  const CARRIERS = {
    // robot_choir.dsp's own carrier, literally: three saws detuned +-0.4% and
    // a quiet octave double. The default, so `robot` and `choir` sound today
    // exactly as they were written to.
    saw:  { from: "robot_choir",
            osc: [[0.996, "saw", 0.3], [1, "saw", 0.3], [1.004, "saw", 0.3],
                  [2, "saw", 0.18]] },
    // MODEL D — modeld.dsp / instruments.js FONTS.analog: two saws a hair
    // apart, oscillator 3 an octave down as a pulse (oscMix 0.4), 6 cents of
    // drift, into the ladder at 2400/0.28. Warm and wide; the vowels sit in
    // the ladder's shoulder rather than on top of it.
    moog: { from: "modeld",
            osc: [[1, "saw", 0.34], [1.007, "saw", 0.3], [0.5, "pulse", 0.26, 0.5]],
            drift: 6, ladder: { cutoff: 2400, res: 0.28 } },
    // THE DX7 — dx7_alg5's stacked 2-op pair. Ratio 2 with the index held at
    // 1.6 after its attack keeps the sidebands up where the formants are; the
    // quiet octave sine is E.PIANO 1's tine, and it is the only thing here
    // that reads as glass rather than as a saw.
    dx7:  { from: "dx7_alg5", osc: [[2, "sine", 0.12]],
            fm: { ratio: 2, index: 4.2, floor: 1.6, decay: 0.25, amp: 0.75 } },
    // THE 303 — tb303.dsp: ONE saw, and everything else is the ladder. res
    // 0.82 with a 2.2-octave envelope over 220 ms is the squelch, and under a
    // vocoder it reads as a voice with a mouth that opens on every syllable.
    "303": { from: "tb303", osc: [[1, "saw", 0.9]],
             ladder: { cutoff: 700, res: 0.82, env: 2.2, decay: 0.22 } },
  };

  /* ------------------------------------------------------------- THE GRIP
     HOW HARD THE VOICE IS IMPOSED ON THE TONE, which is the one vocoder knob
     that is not a filter. Three numbers, and they are three different answers
     to "how much of this is a machine":
       imp  vocoded vs RAW CARRIER. At 1 the tone is entirely shaped by the
            voice (a vocoder). Below it the synth line survives underneath and
            the words ride on top — which is what most of the records this is
            for actually do, and which is why it is a control and not a law.
            (The leak is the carrier, never the dry espeak: the espeak clip
            sings at its own rung, so mixing it in would be a second singer a
            few semitones out. The carrier is in tune by construction.)
       exp  the band envelope's exponent. Above 1 the quiet bands go quieter
            and the loud ones stay — consonants snap, the gaps between
            syllables open, and it reads as gated and robotic. Below 1 it
            smears toward a held chord.
       sib  the unvoiced path (see audio/sing.js): how loud the "s" is. */
  const GRIPS = {
    soft: { imp: 0.55, exp: 0.8, sib: 0.9, mk: 5 },
    half: { imp: 0.78, exp: 0.9, sib: 1.0, mk: 5 },
    firm: { imp: 1,    exp: 1,   sib: 1.0, mk: 5 },   // robot_choir's own
    full: { imp: 1,    exp: 1.6, sib: 1.3, mk: 7 },
  };

  /* ================================================================== CHIPS
     WHAT A BOX MAY BE TOLD TO SING. One field, chips only (fields.js), and it
     answers stack x colour x carrier at once — which is not three questions
     to a finger. It is "who sings this", and the answer is a person, several
     people, or a machine, named. Every `stack` below is built from the four
     parts THE STACK section above defines (tune/double/octave/harmony) — a
     chip is a CAST, not a count.
       lead     one singer on the tune, as synthesized
       double   the same singer again, barely — a crooner's own close double
       duet     two singers, the second on a chord tone above (harmonyOf)
       thirds   a boyband stack: tune, harmony above, and the harmony
                double-tracked — three takes, two pitches
       octaves  the tune and the same words an octave apart, on the OTHER
                voice's ladder — a gothic/darkwave low-over-high pair
       chorale  four parts: tune, a harmony above, a harmony below, an
                octave — a hymn's approximation of SATB from two ladders
       holler   the tune shouted over itself, WIDE drift — screamo's unison
                double, rough on purpose
       robot    one singer, through the channel vocoder (audio/sing.js)
       choir    a vocoded crowd: tune, harmony, and a wide double of each —
                doubling taken far enough to stop being two of anything
       clear    two singers vocoded at half grip: the synth line stays
                audible and the words sit on it

     ...AND THEN THE MACHINES, appended 2026-08-17, because the vocoder had
     exactly one voice and a vocoder is its carrier. Each of these is `robot`
     with a different synth behind it, so the row reads as a cast rather than
     as a knob per axis, and the three things that actually change a vocoder —
     WHICH SYNTH, HOW MANY BANDS, HOW HARD — are chosen together the way they
     are on a real one, where the band count is soldered in.
       moog    a Model D behind the voice, 32 bands
       dx7     the FM pair, 40 bands — glassy, and the most intelligible
       303     one saw and a screaming ladder, 24 bands
       fat     the saw, EIGHT bands, imposed to the limit: a 1978 brick, no
               words survive, which is the point of it
     BANDS ARE THE WHOLE CHARACTER of a vocoder and the trade is one-sided in
     the middle: 8 bands cannot resolve two formants so every vowel collapses
     to one honk, 16 gets you vowels, 32 (robot_choir's own) gets you
     consonants, and past ~40 you are mostly paying for filters — the bank is
     log-spaced 110..7500 Hz (audio/sing.js VB_LO/VB_HI), so 48 bands are
     roughly a quarter-tone apart down at the bottom where speech has nothing
     to say anyway. Spacing stays logarithmic at every count because formants
     move in ratios, not in hertz. */
  const TUNE = { role: "tune", vi: 0 };
  const SINGS = {
    lead:    { colour: "natural", stack: [TUNE] },
    double:  { colour: "natural",
               stack: [TUNE, { role: "double", vi: 0, drift: "tight" }] },
    duet:    { colour: "natural",
               stack: [TUNE, { role: "harmony", vi: 1, dir: "up" }] },
    thirds:  { colour: "natural",
               stack: [TUNE, { role: "harmony", vi: 1, dir: "up" },
                        { role: "double", vi: 1, of: "harmony", dir: "up", drift: "tight" }] },
    octaves: { colour: "natural",
               stack: [TUNE, { role: "octave", vi: 1 }] },
    chorale: { colour: "natural",
               stack: [TUNE, { role: "harmony", vi: 1, dir: "up" },
                        { role: "harmony", vi: 0, dir: "down" }, { role: "octave", vi: 1 }] },
    holler:  { colour: "natural",
               stack: [TUNE, { role: "double", vi: 0, drift: "wide" }] },
    robot:   { colour: "vocoder", voc: { car: "saw", bands: 32, grip: "firm" },
               stack: [TUNE] },
    choir:   { colour: "vocoder", voc: { car: "saw", bands: 32, grip: "firm" },
               stack: [TUNE, { role: "harmony", vi: 1, dir: "up" },
                        { role: "double", vi: 0, drift: "wide" },
                        { role: "double", vi: 1, of: "harmony", dir: "up", drift: "wide" }] },
    moog:    { colour: "vocoder", voc: { car: "moog", bands: 32, grip: "firm" },
               stack: [TUNE] },
    dx7:     { colour: "vocoder", voc: { car: "dx7", bands: 40, grip: "firm" },
               stack: [TUNE] },
    "303":   { colour: "vocoder", voc: { car: "303", bands: 24, grip: "full" },
               stack: [TUNE] },
    fat:     { colour: "vocoder", voc: { car: "saw", bands: 8, grip: "full" },
               stack: [TUNE] },
    clear:   { colour: "vocoder", voc: { car: "saw", bands: 48, grip: "half" },
               stack: [TUNE, { role: "harmony", vi: 1, dir: "up" }] },
  };
  const SINGLABEL = { lead: "lead", double: "double", duet: "duet",
                      thirds: "thirds", octaves: "octaves", chorale: "chorale",
                      holler: "holler", robot: "robot", choir: "choir",
                      moog: "moog", dx7: "dx7", "303": "303", fat: "fat",
                      clear: "clear" };
  // a stack this wide is already a crowd; four parts (chorale, choir) is the
  // ceiling THE STACK section's cost note counts against, and a table entry
  // past it would be paying utterances the cost note no longer bounds
  const MAX_STACK = 4;
  // `voices` STAYS, as a plain count derived from the stack rather than a
  // second table someone has to keep in step with it — the pre-stack round's
  // own gate reads it (test/unit/nukernel.test.js "the singer — syllables,
  // the bank, the ladders, the plan" (i), widened from "1 or 2" to "1..
  // MAX_STACK" the day this round landed) and nothing here loses a field by
  // gaining `stack`.
  for (const k of Object.keys(SINGS)) {
    const s = SINGS[k];
    if (s.stack.length > MAX_STACK)
      throw new Error("sing.js: " + k + " stacks " + s.stack.length + " parts, over MAX_STACK");
    s.voices = s.stack.length;
  }

  /* --------------------------------------------------------- WHO ASKS FIRST
     THE GENRE MAY DECLARE ITS OWN SINGER, and until 2026-08-17 nothing could:
     `sing` was a box field defaulting to null, no genre set it, and so the
     whole organ — the ladders, the syllable cutter, the vocoder — had never
     once been asked to run. Paul: "The espeak/vocoder singing never showed up".

     The shape is one string on the genre, a key of SINGS:

         GENRES.motorik = { …, sing: "moog" }

     and the resolution is the house law every other field already obeys
     (fields.js: "default null = as the genre asks"): an explicit chip on the
     box wins, absent falls through to the genre, and a genre that declares
     nothing sings nothing — singPlan returns [], warm() is never called, no
     wasm is fetched, and the emitted score is byte-identical to the day
     before this existed. There is deliberately no "off" chip: absent is
     already the one spelling of absent, and a box that must be silent under a
     singing genre is the one thing this cannot say yet — it wants a real
     "silent" chip rather than a second spelling of the default. */
  function singFor(gk, boxValue) {
    if (boxValue && SINGS[boxValue]) return boxValue;
    const g = GENRES[gk];
    const d = g && g.sing;
    return (d && SINGS[d]) ? d : null;
  }
  /* ...AND WHO IS IN THE ROOM. `sing` says what the singers DO (one voice, a
     duet, a stack of thirds); `singer` says WHO THEY ARE, and it is the same
     declaration continued rather than a second system: one key beside the
     other on the genre, resolved by the same law one line up.

         GENRES.boyband = { …, sing: "thirds", singer: "teen" }

     A genre that names nobody gets its FAMILY's cast, which is why 84 singing
     anchors did not need 84 edits: the family is already how the lyric bank is
     chosen (BANKS above), and a family is a room full of records that sound
     alike. A family with no row falls to `band`, which is the pair the page
     sang in before any of this — so an anchor that says nothing sounds exactly
     as it did, and every anchor that says something is somebody else. */
  const FAMILY_CAST = {
    kernel: "band",      // the fallback: the voice this page has always had
    band:   "band",      // rock, blues, the guitar records
    studio: "teen",      // the beat groups and the pop craftsmen
    soul:   "torch",     // a woman out front, which is what these records are
    club:   "torch",     // the diva over the machine
    groove: "teen",      // reggae, ska, afrobeat: bright and up
    roots:  "crooner",   // folk, country, the songwriter at the piano
    drift:  "chapel",    // ambient and shoegaze: air, and a long way off
    vox:    "chapel",    // plainchant, and the four-part hymn
    parts:  "band",      // the naked vocal/backing utility genres
  };
  function castFor(gk) {
    const g = GENRES[gk];
    if (g && CASTS[g.singer]) return g.singer;
    const f = g && FAMILY_CAST[g.family];
    return CASTS[f] ? f : DEFAULT_CAST;
  }
  // the resolved character, for the renderer and the gate: which carrier, how
  // many bands, how hard. Null for a natural singer, which is what says "no
  // vocoder" all the way down.
  function vocFor(key) {
    const s = SINGS[key];
    if (!s || !s.voc) return null;
    const g = GRIPS[s.voc.grip] || GRIPS.firm;
    return { car: s.voc.car, bands: s.voc.bands, grip: s.voc.grip,
             imp: g.imp, exp: g.exp, sib: g.sib, mk: g.mk };
  }

  /* ============================================================ THE PLAN
     WHICH NOTES GET SUNG.

     WHAT LIMITS A SINGER IS THE GAP, NOT THE NOTE. The melody vector is 16
     steps to the bar and genres run it at rate 1..4, so "every gated step"
     would be sixteen syllables a bar — nobody sings that, and at two voices it
     is 128 transient nodes a section for something that reads as a stutter. So
     there are two floors, and until 2026-08-17 they were the same number and
     that was a real mistake:

       MIN_STEPS  the GAP to the previous syllable. THIS is the one that
                  matters, because it is the room a word has to be said in.
                  Three steps: measured, an espeak syllable at the shipped
                  speed runs 0.11-0.34 s while a step is 0.09-0.13 s at the
                  tempos the catalogue actually uses, so three steps clears the
                  longest word at the fastest tempo. At 2 the gaps ran down to
                  0.19 s and a tenth of them were shorter than the word that
                  had to fit in them.
       MIN_NOTE   the note's own LENGTH, and it is 1 — any real note at all.
                  It used to be MIN_STEPS too, which sounds prudent and is not:
                  it silenced every STACCATO genre outright, because a filter
                  on note length is a filter on ARTICULATION, not on singing.
                  Measured on composed songs, gothsynth ("Basildon 1990",
                  artic staccato, maxHold 2) offered candidates in ONE box out
                  of eleven and sang three syllables in a whole song, and disco
                  twelve — which is precisely "the speech synthesis is showing
                  up at odd times". A singer over a staccato synth line sings
                  legato; the note gives way to the word (audio/sing.js), so a
                  short note is a place to start a syllable, not a reason to
                  drop one. With the floor at 1 the same two songs sing 127 and
                  130 syllables, about 1.7 a bar, which is a lyric.

     THE LINE FOLLOWS ONE VOICE OF THE AUTHORITY, and picking it is not as
     obvious as it looks. A layered box has several lines and a stack can be
     eight voices deep; singing all of them is a crowd and singing an arbitrary
     one is a coin toss, so the first version took voice 0 of the authority —
     which ui/derive.js deals phrase 0 to, so it "is the tune by construction".
     MEASURED, that is false for a whole family of genres: house and ambient
     realize voice 0 as a PAD (house renders 448 pad events on voice 0 and 105
     line events on voice 1), so the rule sang nothing at all for them.
     So the tune is the authority voice with the MOST singable notes — non-pad,
     gated, at least MIN_NOTE long — with ties going to the lowest index. A
     genre with none sings nothing, and that is the right answer rather than a
     gap: there is no tune in an empty voice to put words on. */
  const MIN_STEPS = 3;
  const MIN_NOTE = 1;
  // ...and a ceiling, so a pathological box cannot mint an unbounded number of
  // transient voices. 32 is a six-bar box sung at the gap floor; a longer one
  // stops rather than growing the graph, and the measured catalogue does not
  // reach it (the fullest box in six composed songs picks 28).
  const MAX_SYL = 32;
  // A HELD NOTE STRETCHES THE VOWEL rather than repeating the syllable — that
  // is the difference between singing and a sequencer with a speech chip on
  // it. Threshold in steps: at rate 4 this is a dotted quarter.
  const HOLD_STEPS = 6;

  // THE HARMONY NOTE, consonant BY CONSTRUCTION rather than by luck. Given the
  // chord sounding under this step (the box's own chart — kernel.js chordAt,
  // handed in as a pitch-class set so this file stays pure), take the nearest
  // chord tone strictly ABOVE the tune, inside a third-to-sixth window. That
  // window is the whole trick: below a third the two voices blur, above a
  // sixth the harmony stops being harmony and becomes a second tune. When the
  // chord offers nothing in the window — a two-note pedal, a sus over a
  // scale-degree gap — the fallback is the OCTAVE, which is consonant against
  // any chord containing the melody note and is never a wrong answer.
  // `dir` widens the same search downward: an alto or a tenor sits UNDER the
  // tune as often as a boyband's harmony sits over it, and the window is the
  // same third-to-sixth span read the other way — never a hardcoded interval,
  // because the interval IS whichever chord tone the song's own harmony (the
  // pcs this file is handed) actually offers there. The octave fallback
  // follows the same sign, so a chord with nothing in the window still gets a
  // consonant answer below rather than one that silently flipped above.
  const HARM_LO = 3, HARM_HI = 9;
  function harmonyOf(midi, pcs, dir) {
    const down = dir === "down";
    if (pcs && pcs.length) {
      const set = new Set(pcs.map(p => ((p % 12) + 12) % 12));
      for (let d = HARM_LO; d <= HARM_HI; d++) {
        const want = down ? midi - d : midi + d;
        if (set.has(((Math.round(want) % 12) + 12) % 12)) return want;
      }
    }
    return down ? midi - 12 : midi + 12;
  }

  /* ================================================================ THE STACK
     ONE SINGER IS A DEMO; A RECORD IS THE SAME VOICE SEVERAL TIMES, SLIGHTLY
     WRONG. "Figure out some polyphony where appropriate for vocals — doubling
     etc" (Paul, 2026-08-17), and the word that matters is APPROPRIATE: which
     kind a genre gets is a genre fact, not a knob everyone turns the same way.
     Four kinds, and every SINGS chip below is built from the same four parts:

       tune     the plan as it always was — vi 0, the note as written, no drift
       double   the SAME line, the SAME voice, the SAME pitch target — the
                realism is entirely in a few ms of timing lean and a few cents
                of pitch lean, because an identical copy summed with itself is
                not a double, it is 6 dB
       octave   the same words, same pitch class, sung by the OTHER SINGER of
                the cast (whose ladder sits a fifth to an octave and a half
                over the first's, by measurement — the ladder table above) — the
                same move gregorian's sampled `ahh_choir` line already makes
                with a register fold, done here with the second singer instead
                of a second sample
       harmony  a chord tone strictly above or below the tune (harmonyOf), so
                it is DIATONIC BY CONSTRUCTION — the interval is whichever
                chord tone the song's own pcs offer in the window, never a
                fixed semitone count, and it stays diatonic through a key
                change because the caller's pcs already carry the key (nothing
                here reads g.key directly; see the caller's own comment)

     A "choir" is doubling taken far enough to stop being two of anything: a
     stack that mixes several doubles of the tune AND of the harmony line, each
     with its OWN deterministic drift, reads as a small crowd rather than a
     duet — SINGS.choir and SINGS.chorale below are exactly that, one vocoded
     and one not.

     THE COST IS BOUNDED BY THE CAST, NOT BY THE STACK. Every part above names
     vi 0 or vi 1 — a cast is two singers, there is no third — so warmSpecs
     (which dedupes by (cast, voice, rung)) can never ask for more than
     NRUNGS x 2 = 8 utterances for a box no
     matter how many parts a chip stacks: `double` reuses its source part's own
     rung exactly (same vi, same target pitch, so rungFor picks the identical
     rung and the SLICES cache serves the same clip), and `octave`/`harmony`
     only ever draw from the rung set their vi already has. So a four-part
     chorale costs what a duet costs. What is genuinely spent twice: a
     vocoded double still runs its OWN buffer-domain filter bank (vocode() in
     audio/sing.js) — cheap (no wasm, no network) but not free, and it is
     cached in FITS by its own drift so two different doubles are two entries. */
  // TIMING AND PITCH LEAN, in two sizes. `tight` is a barely-doubled crooner —
  // close enough that it reads as one warmer voice rather than two; `wide` is
  // a shouted screamo unison or a choir voice that has to sound like a
  // DIFFERENT person, not the same one twice. Both are small next to a real
  // mistake (nobody sings 40 cents flat on purpose) and both are DIRECTIONAL
  // per note — a double that always leant sharp would just be an out-of-tune
  // single voice, not a second one.
  const DRIFT = { tight: { ms: 9, cents: 7 }, wide: { ms: 24, cents: 19 } };
  // deterministic per (seed, stack slot, note index) — the same seed doubles
  // the same way twice (the gate's own claim), two different parts in one
  // stack lean differently from each other (the slot term), and consecutive
  // notes do not all lean the same way (the note-index term) the way a real
  // take wanders rather than sitting on one fixed offset. A local mix rather
  // than a call into compose.js's own hash: this file may not import
  // compose.js (compose.js sits ABOVE it in the layer graph) or fields.js, so
  // it keeps a two-line mix of its own exactly the way it keeps its own rng.
  function driftFor(seed, slot, si, mag) {
    const M = DRIFT[mag] || DRIFT.tight;
    let h = ((seed | 0) ^ Math.imul(slot + 1, 0x9e3779b1) ^ Math.imul(si + 1, 0x85ebca6b)) >>> 0;
    const r = rng(h);
    return { ms: (r() * 2 - 1) * M.ms, cents: (r() * 2 - 1) * M.cents };
  }
  // ONE PART -> ITS BASE PITCH, before any drift. `double`/`octave` sing the
  // SAME target the part they shadow sings (`of: "harmony"` says which one);
  // `harmony` computes its own chord tone. Kept as one function so a stack
  // entry never has to duplicate harmonyOf's own call.
  function partPitch(p, midi, pcsAt, t) {
    if (p.role === "harmony" || p.of === "harmony") return harmonyOf(midi, pcsAt(t), p.dir);
    return midi;
  }

  // singPlan(evs, opts) -> [{ t, dur, n, vi, syl, hold }]
  //   evs   the section's rendered event stream (ui/derive.js sectionEvents)
  //   opts  { sing, gk, seed, pcsAt, barSteps } — the chip, the authority's
  //         genre key (for the bank AND the cast), the box's seed, step ->
  //         chord pitch classes, and how long a bar of this box is in steps
  // Pure, total, and EMPTY when the box is not singing — which is what makes
  // the whole feature cost exactly nothing on every song saved before it.
  function singPlan(evs, opts) {
    // the box's own chip first, then the genre's (singFor) — so a genre that
    // sings arms itself and a box that names a singer still wins
    const key = singFor((opts && opts.gk) || "", opts && opts.sing);
    const spec = SINGS[key];
    if (!spec || !evs || !evs.length) return [];
    // the COLOUR AND THE CHARACTER TRAVEL WITH THE PLAN, not with the chip.
    // ui/derive.js reads SINGS[sec.sing].colour off the box, which cannot see
    // a genre's default and knows nothing about carriers; stamping both on
    // every entry means audio/sing.js reads what was actually resolved, and
    // the derive line becomes a formality it can drop when it likes.
    const voc = vocFor(key);
    const words = lyricFor((opts && opts.gk) || "simple", (opts && opts.seed) | 0);
    const pcsAt = (opts && opts.pcsAt) || (() => null);
    // the authority's singable notes, by voice; then the fullest voice wins
    const cand = evs.filter(e => e.kind === "line" && !e.pad && !e.layer &&
                                 e.n != null && e.dur >= MIN_NOTE);
    if (!cand.length) return [];
    const per = new Map();
    for (const e of cand) per.set(e.v, (per.get(e.v) || 0) + 1);
    let tune = null, most = 0;
    for (const [v, n] of [...per.entries()].sort((a, b) => a[0] - b[0]))
      if (n > most) { most = n; tune = v; }
    const line = cand.filter(e => e.v === tune).sort((a, b) => a.t - b.t);
    const picked = [];
    let lastT = -Infinity;
    for (const e of line) {
      if (e.t - lastT < MIN_STEPS) continue;
      picked.push(e); lastT = e.t;
      if (picked.length >= MAX_SYL) break;
    }
    /* THE LINE BREATHES, AND COMES BACK TO THE TOP. Until now the words were
       dealt words[i % words.length] over every pick in the section, which is a
       lyric with no beginning and no end: a six-word hook over sixteen notes
       wrapped at note six wherever that fell, so the second time round began
       on the "and" of two and the phrase never came back to the top. "at odd
       times" (Paul, 2026-08-17), and this is the half of it that is a score
       fact rather than a synthesis one.
       So the line is dealt IN ORDER, and when it runs out the singer waits —
       for the top of a bar, which is where a line starts, OR for a bar's worth
       of silence, whichever comes first. Both halves are load-bearing and the
       second one is the one I got wrong first: MEASURED on the composed
       catalogue, a great many genres pick exactly ONE note a bar and always at
       the same place in it (gothsynth's tune sits on beat 2 of every bar,
       disco's a sixteenth after beat 2), so "wait for a downbeat" alone is a
       line that never starts at all — it silenced two of the six genres I
       measured outright. A pick a whole bar after the last sung syllable IS
       the top of a phrase whatever the grid says, and the first pick of a
       section takes that door (no previous syllable, so the gap is infinite).
       `barSteps` is the caller's (ui/derive.js knows the box's real rate);
       absent, it is the authority genre's own 16/rate, which is the same
       number for every caller that is not overriding the rate. TOL is a
       sixteenth of a bar: the groove moves a downbeat by real fractions of a
       step, and a note the ear hears AS the downbeat must count as one. */
    const barSteps = (opts && opts.barSteps) ||
      (16 / (((GENRES[(opts && opts.gk)] || {}).rate) || 1));
    const TOL = barSteps / 16;
    const onBar = t => {
      const d = ((t % barSteps) + barSteps) % barSteps;
      return d <= TOL || d >= barSteps - TOL;
    };
    // THE STACK, walked once per picked note. `slot` is the part's own index
    // in spec.stack — fixed for the whole song, which is what makes driftFor
    // deterministic per PART and not just per note (two different doubles in
    // one chip must not happen to draw the same lean). The tune part (slot 0,
    // vi 0, no drift, no `of`) reduces to exactly the single push this loop
    // used to make, so `lead`/`robot`/etc. plan byte-identically to before
    // this round.
    const cast = castFor((opts && opts.gk) || "");
    const out = [];
    let w = words.length;                    // "no line is running" — see above
    let sungT = null;                        // when the last syllable was sung
    for (const e of picked) {
      if (w >= words.length) {
        // the rest between two lines: a downbeat, or a bar of silence
        if (!(onBar(e.t) || sungT == null || e.t - sungT >= barSteps)) continue;
        w = 0;
      }
      const syl = words[w], si = w;
      const hold = e.dur >= HOLD_STEPS;
      spec.stack.forEach((p, slot) => {
        const base = partPitch(p, e.n, pcsAt, e.t);
        const drift = p.drift ? driftFor((opts && opts.seed) | 0, slot, si, p.drift) : null;
        out.push({ t: e.t, dur: e.dur, n: base, vi: p.vi, syl, hold, si,
                   colour: spec.colour, voc, cast, role: p.role, drift });
      });
      w++; sungT = e.t;
    }
    return out;
  }
  // the utterance a voice must synthesize for a plan: the whole line, as
  // SPACE-SEPARATED SYLLABLES, once. One espeak instance per (line, rung)
  // instead of one per note, and the space is what makes espeak emit a word
  // mark at every syllable boundary rather than cliticizing "the" onto "on".
  const utteranceFor = (gk, seed) => lyricFor(gk, seed).join(" ");
  // every (cast, voice, rung) an audio tier has to warm for a plan — deduped,
  // so a line whose notes all fold to one rung costs one utterance and not
  // thirty. The SINGER'S WHOLE IDENTITY rides along (variant, lang, and the
  // rung's own ladder MIDI, which is the model the cut falls back to when the
  // detector finds no F0) so audio/sing.js never has to know this table exists.
  function warmSpecs(plan) {
    const seen = new Map();
    for (const p of plan || []) {
      const cast = p.cast || DEFAULT_CAST;
      const r = rungFor(p.vi, p.n, cast), k = cast + ":" + p.vi + ":" + r.pitch;
      if (seen.has(k)) continue;
      const V = voiceOf(p.vi, cast);
      seen.set(k, { vi: p.vi, cast, pitch: r.pitch, variant: V.variant,
                    lang: V.lang, singer: V.key, base: r.base });
    }
    return [...seen.values()];
  }

  const api = { SINGS, SINGLABEL, CARRIERS, GRIPS, singFor, vocFor,
                VOICES, SINGERS, LADDERS, CASTS, DEFAULT_CAST, FAMILY_CAST,
                castFor, voiceOf,
                NRUNGS, MIN_STEPS, MAX_SYL, HOLD_STEPS, MAX_STACK,
                HARM_LO, HARM_HI, BANKS, syllables, nsyl, bankFor, lyricFor,
                ladderMidi, ladderPitch, rungsOf, voiceMidi, foldToVoice,
                rungFor, harmonyOf, DRIFT, driftFor, partPitch,
                singPlan, utteranceFor, warmSpecs };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuSing = api;
})(typeof window !== "undefined" ? window : globalThis);
