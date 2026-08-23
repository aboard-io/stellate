// nukernel/keys-kit.js — THE KEYS PLAYER, as a model. Pure: no DOM, no audio,
// no state — the same shape as drums-kit.js and bass-kit.js, for the same
// reason: every word this player knows is provable in node.
//
// THE HARMONY WAS BEING CALLED AND VOICED BY NOBODY. The arranger names the
// changes, the bassist realizes their roots, and until this chair existed the
// chords themselves were imaginary — a rhythm section, not a band.
//
// A KEYS PLAYER IS NOT A PAD MACHINE. Pads are one of the things a pair of
// hands does; the others are comping the changes, skanking the offbeats,
// playing a riff, running an arpeggio, holding a drone, or laying out. Those
// are not six patches — they are the kernel's own PARTS (pad/stab/riff/
// counter/line/drone), which is what the scheduler, the mixer and the
// register law already key on. So this file writes two things the engine
// already reads: a PART, and a PHRASE (the box's own 16-step pattern —
// deg/gate/vel/oct, the same shape song.js blank() makes).
//
// CONTENT ONLY. The interview walker, the vocabulary registrar, the bar's
// step words and the phrase assembler live in chair.js (NuChair) — one
// engine, six chairs. What is left here is what makes this chair the KEYS:
// the jobs, the instruments the pool can cast, the panel, and toGenre.
(function (root, factory) {
  const api = factory(
    typeof require !== "undefined" ? require("./chair.js") : root.NuChair,
    // ...and the PEDALBOARD, which is instruments.js's (BOARDS over fields.js
    // FX): a chair says which board it is handed, never what an effect IS.
    typeof require !== "undefined" ? require("./instruments.js") : root.NuInstruments);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuKeys = api;
})(typeof self !== "undefined" ? self : this, function (C, NI) {
  "use strict";

  const { N, z, on, every, deg } = C;

  /* ---------- WHAT A PAIR OF HANDS DOES ----------------------------------
     Each job is a PART the kernel already plays and a PHRASE to play it
     with. The part decides how the note behaves (a pad holds to the next
     chord, a stab locks to the bar's chord and lets go, a riff sits low and
     insistent); the phrase decides where the hands fall. */
  const JOBS = {
    pads:    { w: "pads", part: "pad", gate: on(0),
               says: "held chords, one to the bar" },
    swell:   { w: "long swells", part: "pad", gate: on(0), bars2: true,
               says: "a chord every two bars, arriving slowly" },
    comp:    { w: "comping the changes", part: "stab", gate: on(0, 4, 8, 12),
               comping: true, says: "chords on the beat" },
    // THE COMP FEELS — data, not code, which is the whole house style: each
    // is the comp job with a different hand. `comping` on all of them routes
    // the chord through the parent's harmony brain (theory.js lead — shells,
    // three voices, minimal motion) instead of the kernel's stamped per-pc
    // fold; `antic` makes the late push voice the NEXT bar's chord (an
    // anticipation is a chord you arrive at early, not one you leave late);
    // `maxHold` on the held feel lets each chord ring to the change.
    charleston: { w: "the Charleston", part: "stab", gate: on(0, 6),
               comping: true, says: "the chord on one, and the and-of-two" },
    pushes:  { w: "pushing the changes", part: "stab", gate: on(3, 8, 14),
               comping: true, antic: true,
               says: "chords between the beats, leaning into the next bar" },
    held:    { w: "held to the change", part: "stab", gate: on(0, 4, 8, 12),
               comping: true, maxHold: 6,
               says: "chords on the beat, each ringing to the change" },
    skank:   { w: "on the offbeats", part: "stab", gate: on(2, 6, 10, 14),
               says: "the offbeat chop" },
    push:    { w: "pushing the bar", part: "stab", gate: on(0, 6, 8, 14),
               says: "chords ahead of the beat" },
    riff:    { w: "a riff", part: "riff", gate: on(0, 3, 6, 8, 11, 14),
               dg: deg(0, 0, 0, 2, 0, 0, 4, 0, 0, 0, 2, 0, 0, 0, 0, 0),
               says: "a low figure, over and over" },
    counter: { w: "a counter-line", part: "counter", gate: every(4),
               dg: deg(4, 0, 0, 0, 2, 0, 0, 0, 6, 0, 0, 0, 4, 0, 0, 0),
               says: "a line between the voice and the bass" },
    arp:     { w: "arpeggios", part: "line", gate: every(2),
               dg: deg(0, 0, 2, 0, 4, 0, 6, 0, 4, 0, 2, 0, 4, 0, 6, 0),
               says: "the chord, one note at a time" },
    drone:   { w: "a drone", part: "drone", gate: on(0),
               says: "one note that refuses to move" },
    out:     { w: "lay out", part: null, gate: z(), says: "nothing at all" },
  };

  // ONLY WHAT THE POOL CAN CAST. Every id here is an instrument the POOL will
  // take (fields.js INSTRCHOICES, which is the catalog plus the ids the chairs
  // claim by name) — a word that casts something the pool will not take is a
  // word that lies, and the gate holds this list against the pool.
  //
  // THIRTY-ONE KEYBOARDS, WHERE THE RACK SHOWED SEVENTEEN AND A RECORD SHOWED FOUR
  // (2026-08-23, "give me all choices for keys and all instruments and kits").
  // The seventeen were never the room: the registry has carried a whole
  // keyboard department that no word could reach. What is new here is
  // EXPOSURE, not DSP — every id below already resolves on the parent, and
  // every one was checked three ways before it earned a word (the rack gate,
  // test/unit/rack-identity.test.js, holds all three):
  //   1. it RESOLVES — recipeFor answers with a patch or a sampled voice and
  //      pushes nothing onto `unrouted`;
  //   2. it is DISTINCT — its engine recipe differs byte for byte from every
  //      other word in this rack, AND (when it is sampled) so does the set of
  //      WAVs it plays. Recipe-distinctness alone is not enough: `halo_pad`
  //      and `polysynth` play byte-identical PCM and are only two sounds
  //      because both are PATCHED (ppg / juno60), and `soundtrack` — which is
  //      byte-identical to warm_pad and is NOT patched — was cut for exactly
  //      that;
  //   3. it has a COMPASS — instruments.js RANGES, so fitReg can seat it.
  //
  // FIVE WERE TRIED AND CUT, and the reasons are the point:
  //   drawbarorgan  a SINGLE zone rooted at MIDI 96. instruments.js RANGES
  //                 already says it out loud — "a hymn at MIDI 50 was one C7
  //                 sample dragged down three and a half octaves, which is a
  //                 breathy whistle and not a Hammond" — and the de-organ
  //                 round deliberately made it nobody's cast. A rack is not
  //                 a place to un-decide that.
  //   soundtrack    byte-identical WAVs to warm_pad, and unpatched: two words,
  //                 one sound.
  //   bowed_glass   a real, distinct oberheim patch — but "a glassy pad" is
  //                 halo_pad's word and this rack does not need two of them.
  //   honky_tonk }  byte-identical WAVs to yamaha_grand_piano.
  //   bright_grand}
  const INSTRUMENTS = {
    // pads & synths
    warm_pad: "a warm pad", halo_pad: "a glassy pad", polysynth: "a polysynth",
    metal_pad: "a metallic pad",
    // strings, bowed and machined
    slow_strings: "strings", synth_strings_1: "synth strings",
    synth_strings_2: "a string machine", pizzicato_strings: "pizzicato strings",
    // pianos and electrics
    rhodes_ep: "a Rhodes", legend_ep_2: "an electric piano",
    electric_piano: "a tine piano",
    yamaha_grand_piano: "a grand piano", felt_piano: "a felt piano",
    upright_piano: "an upright",
    // organs and free reeds
    church_organ: "a church organ",
    percussive_organ: "an organ", rock_organ: "a rock organ",
    reed_organ: "a reed organ", accordion: "an accordion",
    clavinet: "a clav", ahh_choir: "voices", space_voice: "a vocal pad",
    // ...the old-world pair (2026-08-21): the harpsichord was genre-named by
    // `counterpoint` all along — this word was overdue — and the harp is the
    // salon's (barcarolle names it)
    harpsichord: "a harpsichord", harp: "a harp",
    // ...and the TUNED PERCUSSION a pair of hands plays from a keyboard
    // (2026-08-23). Six recordings and two mallet models the registry has
    // carried all along with no word to reach them. vibraphone and marimba
    // are the same parent DSP (`mallet`) and are two instruments and not two
    // gains: measured on the recipe, the vibes ring 2.2 s against the
    // marimba's 0.5 and sit four semitones of tilt darker.
    celesta: "a celesta", glockenspiel: "a glockenspiel",
    vibraphone: "vibes", marimba: "a marimba", xylophone: "a xylophone",
    tubular_bells: "tubular bells", music_box: "a music box",
  };

  // WHERE THE HANDS SIT. The kernel's `reg` is octaves off middle; a keys
  // part that fights the bass for the bottom is the commonest mix problem
  // there is, so the default is up out of its way.
  const REG = { low: { w: "down low", v: -1 }, mid: { w: "where it sits", v: 0 },
                high: { w: "up out of the way", v: 1 },
                top: { w: "right at the top", v: 2 } };

  // THE PANEL — the same idea as the bassist's 303: a synth you cannot open
  // is a preset. `atk` is the one that matters here (a pad that arrives
  // slowly is a different instrument from one that does not).
  const PANEL = [
    { id: "cut", ask: "how bright is it?", key: "cut", opts: [
      { w: "dark", v: 700 }, { w: "warm", v: 1400 },
      { w: "clear", v: 3000 }, { w: "glassy", v: 6000 } ] },
    { id: "atk", ask: "how does it arrive?", key: "atk", opts: [
      { w: "straight away", v: 0.01 }, { w: "a soft edge", v: 0.12 },
      { w: "swelling in", v: 0.6 }, { w: "very slowly", v: 1.6 } ] },
    { id: "rel", ask: "how does it leave?", key: "rel", opts: [
      { w: "short", v: 0.2 }, { w: "ringing", v: 0.9 }, { w: "hanging on", v: 2.4 } ] },
    { id: "col", ask: "how much colour?", key: "q", opts: [
      { w: "clean", v: 0.8 }, { w: "some", v: 3 }, { w: "singing", v: 7 } ] },
  ];

  /* ---------- the chair itself, from the tables above --------------------
     Every mechanism — the vocabulary, the bar, the interview, the catalog,
     the phrase — is chair.js's; the spec is the nouns. A pad plays at 5,
     everything else at 6: the hands lean into a line and sit back under a
     chord. */
  const INSTRROWS = {
    yamaha_grand_piano: "pianos:", felt_piano: "pianos:", upright_piano: "pianos:",
    rhodes_ep: "pianos:", legend_ep_2: "pianos:", clavinet: "pianos:",
    electric_piano: "pianos:",
    church_organ: "organs:", percussive_organ: "organs:", rock_organ: "organs:",
    reed_organ: "organs:", accordion: "organs:",
    warm_pad: "pads & strings:", halo_pad: "pads & strings:",
    metal_pad: "pads & strings:",
    slow_strings: "pads & strings:", synth_strings_1: "pads & strings:",
    synth_strings_2: "pads & strings:", pizzicato_strings: "pads & strings:",
    polysynth: "synths:", ahh_choir: "voices:", space_voice: "voices:",
    harpsichord: "pianos:", harp: "pads & strings:",
    celesta: "bells & mallets:", glockenspiel: "bells & mallets:",
    vibraphone: "bells & mallets:", marimba: "bells & mallets:",
    xylophone: "bells & mallets:", tubular_bells: "bells & mallets:",
    music_box: "bells & mallets:",
  };

  const chair = C.pitchedChair({
    jobs: JOBS, instruments: INSTRUMENTS, reg: REG, panel: PANEL, instrRows: INSTRROWS,
    pedals: NI.boardOf("keys"),
    model: { job: "pads", instr: "warm_pad", reg: "high" },
    start: { words: ["sit down at the keys"], says: "a pair of hands, playing pads" },
    groups: { job: "what you are playing", instr: "what it is", panel: "at the machine",
              pedal: "on the board" },
    heads: { instr: "the instrument", job: "the job", sound: "the sound",
              panel: "the instrument", pedal: "the board" },
    asks: { instr: "what are you playing?", job: "what's your job in it?",
            reg: "where do you sit?", pedal: "anything in the chain?" },
    instrSays: (w) => "on " + w,
    hit: { on: "a chord ", off: "no chord " },
    vel: (j) => (j.part === "pad" ? 5 : 6),
  });
  const { rhythmic, blank, V, catalog, offered, say, says, pedalOf, pedalsOf,
          decisions, nextAsk, answer, toPattern, jobOf, gateOf, stepWord } = chair;

  /* ---------- what the engine is handed ----------
     TWO things, because a pitched voice is two things: the PART (how the
     note behaves) lives on the genre, and the PHRASE (where the hands fall)
     is the box's own pattern — toPattern, which is the chair's. */
  // the genre fields a keys player owns — merged into the band's own genre
  function toGenre(m) {
    const j = jobOf(m);
    return {
      voices: 1, part: () => (j.part || "line"), reg: () => (REG[m.reg] || REG.high).v,
      instr: m.instr,
      // the comping facts ride the chair (band-kit's chairs[] carries them
      // onto the genre, the kernel's chordLock branch reads them) — absent
      // keys serialize to nothing, so a non-comping job is byte-identical
      ...(j.comping ? { comping: true } : {}),
      ...(j.antic ? { antic: true } : {}),
      ...(j.maxHold ? { maxHold: j.maxHold } : {}),
      realize: () => (j.part === "pad" ? "pad" : "line"),
      tone: { wave: "saw", cut: 1400, q: 1.2, atk: 0.05, rel: 0.9, gain: 0.22,
              verb: 0.12, ...(m.tone || {}),
              // the board, as the insert rows the parent builds (absent when
              // nothing is on it, so a dry chair is byte-identical)
              ...(pedalsOf(m) ? { pedals: pedalsOf(m) } : {}) },
      silent: !j.part,
    };
  }

  return { N, JOBS, INSTRUMENTS, REG, PANEL, PEDALS: chair.PEDALS, rhythmic, blank, V,
           catalog, offered, say, says, pedalOf, pedalsOf,
           decisions, nextAsk, answer, toPattern, toGenre, jobOf, gateOf, stepWord };
});
