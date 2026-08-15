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
     TWO SINGERS, AND THE MEASURED LADDER EACH ONE HAS.

     The vendored espeak build (vendor/espeak-ng/) turns out to carry the !v
     variants after all — the trim kept `voices/!v/*` — but engine/speech.js
     passed lang "en" to set_voice, which MEASURABLY wins over the voice name,
     so `variant` was a dead field on all 230 registry-data.js rows that
     declare one. This round taught the organ an additive `lang` option; pass
     lang "" and the variant applies. That is the entire reason two voices are
     possible at all, and it is why VOICES below names a lang.

     THE LADDERS ARE MEASURED, NOT DERIVED, AND MEASURED ON THE REAL PROTOCOL.
     espeak's `pitch` is 0..99 with no documented Hz mapping, so the tables
     below are what came out — but the FIRST measurement was taken on "la la
     la" at speed 150 and it was wrong for this use by up to 3.5 semitones:
     a stressed diphthong ("late") sits far above a neutral schwa, so a ladder
     calibrated on one syllable mis-centred every rung and the residual bends
     came out at 1.7-4.0 semitones instead of the +-2.2 the rungs promise.
     What is baked below is the median MIDI of EVERY SYLLABLE OF EVERY BANK
     LINE, synthesized at the speed this file actually uses (260) and cut the
     way audio/sing.js actually cuts it, measured with the found layer's own
     detector (engine/faust/voices/found-player.js f0Profile) — 112 syllables
     per rung for the low voice, 118 for the high. `node
     test/unit/nukernel.test.js --calibrate-sing` reprints it.

       base voice (no variant)  pitch 10..99  ->  MIDI 39.6 .. 52.8   (E♭2..E3)
       f3 variant (lang "")     pitch 10..99  ->  MIDI 51.6 .. 64.7   (E♭3..E4)

     So the two singers are a bass-baritone and a mezzo, an octave apart and
     overlapping a fourth in the middle. The harmony line is the HIGH one
     because harmony sits above the tune; that keeps both bends small instead
     of asking one voice to cover two octaves. */
  const LADDER_LOW = [[10, 39.63], [25, 41.03], [40, 42.97], [55, 45.32],
                      [70, 47.83], [85, 50.52], [99, 52.78]];
  const LADDER_HIGH = [[10, 51.58], [25, 53.33], [40, 55.28], [55, 57.36],
                       [70, 59.69], [85, 62.23], [99, 64.66]];
  // FOUR RUNGS PER VOICE, and the number is a measured trade rather than a
  // taste. An utterance is one espeak instance (~234 ms in node, ~210 ms in
  // chromium per vendor/espeak-ng/README.md) and the instance is per PITCH, so
  // rungs cost warm-up time linearly: 4 rungs x 2 voices = 8 utterances ~= 2 s
  // for a whole song's worth of singing, paid once beside the zone fetches.
  // What they buy is a SMALL BEND: the ladder spans ~13.1 semitones, so four
  // evenly spaced rungs put every target within +-2.2 semitones of a rung, and
  // the residual is the only thing that shifts formants (espeak's own pitch
  // knob is source-side and leaves the filter alone). Three rungs would be
  // +-3.3, which starts to sound like a different person per note.
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
  const VOICES = [
    // the LEAD: the base voice, no variant, so it needs no lang override and
    // stays on the exact call sequence every other consumer of the organ uses
    { key: "lead", variant: "", lang: "en", ladder: LADDER_LOW,
      rungs: rungsOf(LADDER_LOW) },
    // the HARMONY: f3, which only exists because of the lang knob above
    { key: "harm", variant: "f3", lang: "", ladder: LADDER_HIGH,
      rungs: rungsOf(LADDER_HIGH) },
  ];
  const voiceMidi = (vi, pitch) => ladderMidi(VOICES[vi].ladder, pitch);
  // FOLD A TARGET INTO A SINGER. A melody is written wherever the genre writes
  // it and a throat is a fourth-and-a-bit wide, so the note a voice actually
  // sings is the target's nearest OCTAVE inside the ladder. This is the same
  // move audio/voices.js foldInto makes for a sampled instrument and for the
  // same reason: an instrument played outside its range is a different
  // instrument. The ladder spans more than an octave, so the loop terminates.
  function foldToVoice(vi, midi) {
    const L = VOICES[vi].ladder, lo = L[0][1], hi = L[L.length - 1][1];
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
  function rungFor(vi, midi) {
    const V = VOICES[vi], want = foldToVoice(vi, midi);
    let best = V.rungs[0], bestD = Infinity;
    for (const p of V.rungs) {
      const d = Math.abs(ladderMidi(V.ladder, p) - want);
      if (d < bestD) { bestD = d; best = p; }
    }
    const base = ladderMidi(V.ladder, best);
    return { pitch: best, midi: want, base, bend: want - base };
  }

  /* ================================================================== CHIPS
     WHAT A BOX MAY BE TOLD TO SING. Four values, which is voices x colour and
     not a knob per axis: the two questions are not independent in any way a
     finger cares about, and the whole surface is chips on purpose (fields.js).
       lead    one singer on the tune, as synthesized
       duet    two singers, the second on a chord tone above (see harmonyOf)
       robot   one singer, through the channel vocoder (audio/sing.js)
       choir   two singers, both vocoded — always in tune by construction */
  const SINGS = {
    lead:  { voices: 1, colour: "natural" },
    duet:  { voices: 2, colour: "natural" },
    robot: { voices: 1, colour: "vocoder" },
    choir: { voices: 2, colour: "vocoder" },
  };
  const SINGLABEL = { lead: "lead", duet: "duet", robot: "robot", choir: "choir" };

  /* ============================================================ THE PLAN
     WHICH NOTES GET SUNG.

     A SUNG NOTE IS AT LEAST AN EIGHTH. The melody vector is 16 steps to the
     bar and genres run it at rate 1..4, so "every gated step" would be sixteen
     syllables a bar — nobody sings that, and at two voices it is 128 transient
     nodes a section for something that reads as a stutter. So the selection is
     a floor on DURATION plus a floor on the GAP to the previous pick, both in
     steps, both = MIN_STEPS. At the common rate 4 that is an eighth note and
     at most eight syllables a bar; a slow genre gets fewer, which is also what
     a singer would do.

     THE LINE FOLLOWS ONE VOICE OF THE AUTHORITY, and picking it is not as
     obvious as it looks. A layered box has several lines and a stack can be
     eight voices deep; singing all of them is a crowd and singing an arbitrary
     one is a coin toss, so the first version took voice 0 of the authority —
     which ui/derive.js deals phrase 0 to, so it "is the tune by construction".
     MEASURED, that is false for a whole family of genres: house and ambient
     realize voice 0 as a PAD (house renders 448 pad events on voice 0 and 105
     line events on voice 1), so the rule sang nothing at all for them.
     So the tune is the authority voice with the MOST singable notes — non-pad,
     gated, at least MIN_STEPS long — with ties going to the lowest index. A
     genre with none (techno: every voice-0 note is a sub-eighth stab) sings
     nothing, and that is the right answer rather than a gap: there is no tune
     in a stab pattern to put words on. */
  const MIN_STEPS = 2;
  // ...and a ceiling, so a pathological box cannot mint an unbounded number of
  // transient voices. 4 bars x 8 = 32 is the honest maximum of the rule above
  // at rate 4; a longer box repeats the line rather than growing the graph.
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
  const HARM_LO = 3, HARM_HI = 9;
  function harmonyOf(midi, pcs) {
    if (pcs && pcs.length) {
      const set = new Set(pcs.map(p => ((p % 12) + 12) % 12));
      for (let d = HARM_LO; d <= HARM_HI; d++)
        if (set.has(((Math.round(midi) + d) % 12 + 12) % 12)) return midi + d;
    }
    return midi + 12;
  }

  // singPlan(evs, opts) -> [{ t, dur, n, vi, syl, hold }]
  //   evs   the section's rendered event stream (ui/derive.js sectionEvents)
  //   opts  { sing, gk, seed, pcsAt } — the chip, the authority's genre key
  //         (for the bank), the box's seed, and step -> chord pitch classes
  // Pure, total, and EMPTY when the box is not singing — which is what makes
  // the whole feature cost exactly nothing on every song saved before it.
  function singPlan(evs, opts) {
    const spec = SINGS[(opts && opts.sing) || ""];
    if (!spec || !evs || !evs.length) return [];
    const words = lyricFor((opts && opts.gk) || "simple", (opts && opts.seed) | 0);
    const pcsAt = (opts && opts.pcsAt) || (() => null);
    // the authority's singable notes, by voice; then the fullest voice wins
    const cand = evs.filter(e => e.kind === "line" && !e.pad && !e.layer &&
                                 e.n != null && e.dur >= MIN_STEPS);
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
    const out = [];
    picked.forEach((e, i) => {
      const syl = words[i % words.length];
      const hold = e.dur >= HOLD_STEPS;
      out.push({ t: e.t, dur: e.dur, n: e.n, vi: 0, syl, hold, si: i });
      if (spec.voices > 1)
        out.push({ t: e.t, dur: e.dur, n: harmonyOf(e.n, pcsAt(e.t)), vi: 1,
                   syl, hold, si: i });
    });
    return out;
  }
  // the utterance a voice must synthesize for a plan: the whole line, as
  // SPACE-SEPARATED SYLLABLES, once. One espeak instance per (line, rung)
  // instead of one per note, and the space is what makes espeak emit a word
  // mark at every syllable boundary rather than cliticizing "the" onto "on".
  const utteranceFor = (gk, seed) => lyricFor(gk, seed).join(" ");
  // every (voice, rung) an audio tier has to warm for a plan — deduped, so a
  // line whose notes all fold to one rung costs one utterance and not thirty.
  function warmSpecs(plan) {
    const seen = new Map();
    for (const p of plan || []) {
      const r = rungFor(p.vi, p.n), k = p.vi + ":" + r.pitch;
      if (!seen.has(k)) seen.set(k, { vi: p.vi, pitch: r.pitch });
    }
    return [...seen.values()];
  }

  const api = { SINGS, SINGLABEL, VOICES, NRUNGS, MIN_STEPS, MAX_SYL, HOLD_STEPS,
                HARM_LO, HARM_HI, BANKS, syllables, nsyl, bankFor, lyricFor,
                ladderMidi, ladderPitch, rungsOf, voiceMidi, foldToVoice,
                rungFor, harmonyOf, singPlan, utteranceFor, warmSpecs };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuSing = api;
})(typeof window !== "undefined" ? window : globalThis);
