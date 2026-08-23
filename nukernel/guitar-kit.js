// nukernel/guitar-kit.js — THE GUITARIST, as a model. Same shape as the keys
// player and for the same reason: what a pair of hands DOES is the kernel's
// own PARTS (riff/stab/counter/line/lead/drone), and a chair writes a part
// and a phrase.
//
// WHAT MAKES IT A GUITAR AND NOT A SECOND KEYBOARD: three things, and none
// of them is the patch. It chugs (palm-muted eighths low down, the one
// rhythm no keyboard makes), it STRUMS on the offbeat where a keys player
// would comp on the beat, and its dirt is an INSTRUMENT rather than a knob —
// GM ships clean/overdrive/distortion as separate recordings, so "how dirty"
// is a casting decision here, which is also how a guitarist actually thinks
// about it (a different amp is a different guitar).
//
// CONTENT ONLY. The mechanism is chair.js (NuChair) — one engine, six
// chairs. What is left here is what makes this chair a GUITAR: the jobs,
// the amps-as-instruments, the panel, and toGenre.
(function (root, factory) {
  const api = factory(
    typeof require !== "undefined" ? require("./chair.js") : root.NuChair,
    // ...and the PEDALBOARD, which is instruments.js's (BOARDS over fields.js
    // FX): a chair says which board it is handed, never what an effect IS.
    typeof require !== "undefined" ? require("./instruments.js") : root.NuInstruments);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuGuitar = api;
})(typeof self !== "undefined" ? self : this, function (C, NI) {
  "use strict";

  const { N, z, on, every, deg } = C;

  const JOBS = {
    // the chug CASTS its own instrument: a palm mute is the string under the
    // hand, not the record's word for the amp — before this, kraut's "chug on
    // a clean electric" rang for four seconds per eighth
    chug:   { w: "a palm-muted chug", part: "riff", gate: every(2), reg: -1,
              instr: "palm_muted_guitar",
              says: "eighths, down low, muted" },
    power:  { w: "power chords", part: "stab", gate: on(0, 8), reg: -1,
              says: "one chord a half-bar, and it rings" },
    drive:  { w: "driving downstrokes", part: "stab", gate: every(2), reg: 0,
              says: "every eighth, all downstrokes" },
    strum:  { w: "strumming it", part: "stab", gate: on(0, 4, 6, 10, 12, 14), reg: 0,
              says: "a strummed bar with the offbeats in it" },
    skank:  { w: "the offbeat chop", part: "stab", gate: on(2, 6, 10, 14), reg: 0,
              says: "the upstroke, and nothing on the beat" },
    arp:    { w: "picking it out", part: "line", gate: every(2), reg: 0,
              dg: deg(0, 0, 2, 0, 4, 0, 2, 0, 4, 0, 6, 0, 4, 0, 2, 0),
              says: "the chord, one string at a time" },
    riff:   { w: "a riff", part: "riff", gate: on(0, 3, 6, 8, 11, 14), reg: -1,
              dg: deg(0, 0, 0, 2, 0, 0, 3, 0, 0, 0, 2, 0, 0, 0, 0, 0),
              says: "a low figure, over and over" },
    line:   { w: "a single-note line", part: "counter", gate: every(4), reg: 0,
              dg: deg(4, 0, 0, 0, 2, 0, 0, 0, 6, 0, 0, 0, 4, 0, 0, 0),
              says: "one note at a time, between the voice and the bass" },
    ring:   { w: "let one chord ring", part: "pad", gate: on(0), reg: 0,
              says: "one chord, held, feeding back a little" },
    out:    { w: "lay out", part: null, gate: z(), reg: 0, says: "nothing at all" },
  };

  // THE DIRT IS THE INSTRUMENT. Every id here is one the POOL can cast
  // (fields.js INSTRCHOICES) — a word that casts something the pool will not
  // take is a word that lies, and the gate holds this list against the pool
  // rather than against a grep of genres.js, which is a proxy for it and was
  // wrong the moment a chair's own default stopped being any record's.
  //
  // TEN GUITARS, WHERE THE RACK SHOWED THREE (2026-08-22, "give me lots more
  // guitar options"). Two of them are instruments the registry has carried all
  // along that no word could reach:
  //   harmonics       — guitar_harmonics, a real recording of a touched node.
  //                     Not a model: a harmonic is the fundamental DAMPED by a
  //                     finger at a node, and stk_guitar's plectrum cannot put
  //                     a finger anywhere. Sampled, like the two acoustics.
  //   a re-amped DI   — di_guitar, the FreePats FSBS direct pickup signal
  //                     (-27 dB RMS by design), which the registry's own header
  //                     says to claim ONLY behind a staged higain amp. That is
  //                     now sayable: instruments.js SAMPLED_INSERTS gives a
  //                     sampled voice the same declared pedalboard the modelled
  //                     electrics got in the de-jangle round, and the parent has
  //                     honoured inserts on sampled voices all along
  //                     (state-engine INSERTS-ON-SAMPLED-VOICES).
  // The other eight were already here; what changed is that a RECORD no longer
  // hides them (band-kit `narrow` — the record recommends, it does not jail).
  const INSTRUMENTS = {
    clean_guitar: "a clean electric", crunch_guitar: "a crunchy one",
    overdrive_guitar: "an overdriven one", distortion_guitar: "a distorted one",
    di_guitar: "a re-amped DI",
    palm_muted_guitar: "a muted one", jazz_guitar: "a jazz box",
    steel_string_guitar: "a steel-string acoustic",
    nylon_string_guitar: "a nylon-string",
    guitar_harmonics: "harmonics",
  };
  const REG = { low: { w: "down low", v: -1 }, mid: { w: "where it sits", v: 0 },
                high: { w: "up the neck", v: 1 } };
  const PANEL = [
    // the four brightnesses sit an octave down from where they started: the
    // cab translation (to-engine modelForInstr) multiplies by 2.6 with its
    // floor at 3 kHz now, so "dark" genuinely closes the cabinet and "glassy"
    // (3600 -> 9 kHz, the translation's own ceiling) is still all the top the
    // cab has to give
    { id: "cut", ask: "how bright is it?", key: "cut", opts: [
      { w: "dark", v: 900 }, { w: "warm", v: 1400 },
      { w: "bright", v: 2400 }, { w: "glassy", v: 3600 } ] },
    { id: "rel", ask: "how long does it ring?", key: "rel", opts: [
      { w: "damped", v: 0.15 }, { w: "ringing", v: 0.7 }, { w: "hanging on", v: 2 } ] },
  ];

  // the chair itself, from the tables above — a riff digs in at 7, the rest
  // of the jobs sit at 6
  const chair = C.pitchedChair({
    jobs: JOBS, instruments: INSTRUMENTS, reg: REG, panel: PANEL,
    // THE AMP IS THE INSTRUMENT AND THE PEDALS ARE NOT. This chair's dirt has
    // always been a casting decision (ten amps, above); the board is the boxes
    // in FRONT of nothing and behind everything — to-engine appends it after
    // the recipe's own amp, so a crunch pedal thickens the amp it is plugged
    // into instead of replacing it.
    pedals: NI.boardOf("guitar"),
    model: { job: "strum", instr: "clean_guitar", reg: "mid" },
    start: { words: ["pick up the guitar"], says: "a guitar, strumming it" },
    groups: { job: "what you are playing", instr: "what it is", panel: "at the amp",
              pedal: "on the board" },
    heads: { instr: "the instrument", job: "the job", sound: "the sound",
              panel: "the instrument", pedal: "the board" },
    asks: { instr: "what are you playing?", job: "what's your job in it?",
            reg: "where do you sit?", pedal: "anything on the board?" },
    instrSays: (w) => "on " + w,
    hit: { on: "a strum ", off: "no strum " },
    vel: (j) => (j.part === "riff" ? 7 : 6),
  });
  const { rhythmic, blank, V, catalog, say, says, pedalOf, pedalsOf,
          decisions, nextAsk, answer, toPattern, jobOf, gateOf, stepWord } = chair;

  function toGenre(m) {
    const j = jobOf(m);
    // a CHORDING job (the stab parts: power/drive/strum/skank) is a strike,
    // not a drone — the string's ring comes down to 1.2 s and the hand damps
    // at 0.15, which is what kills the voice-steal "bend" a 4-second ring
    // under half-bar stabs kept feeding. The player's own panel answer (rel)
    // still outranks the job. riff/line/arp keep the recipe's longer ring.
    const chord = j.part === "stab";
    // A POWER CHORD IS THE AMP'S DECISION, so the seam is here — the chair
    // is the one thing that knows both the job (chords) and the instrument
    // (how much amplifier). Thirds intermodulate under drive and fifths do
    // not: the same grip through a clean amp is a voicing choice, through a
    // driven one it is the only chord that comes out as a chord. The chair
    // declares the FACT (`fifths`); the kernel voices it (root/5th/octave,
    // the chairs seam in the chordLock branch). Clean, jazz and the
    // acoustics keep the full triad they always had.
    // (di_guitar joins the driven three: it IS the dirtiest amp in the rack —
    // a raw pickup through three stages — so a third in it intermodulates
    // exactly like a third in the distortion)
    const fifths = chord &&
      /^(crunch|overdrive|distortion|palm_muted)_guitar$|^di_guitar$/.test(j.instr || m.instr);
    return { part: j.part || "line", reg: (REG[m.reg] || REG.mid).v + (j.reg || 0),
             instr: j.instr || m.instr, pad: j.part === "pad", silent: !j.part,
             ...(fifths ? { fifths: true } : {}),
             // ...and a chord is STRUMMED, a few ms a string, not stamped:
             // the chair declares the kernel's own strum pipe with the stab
             // admission — nukernel data, so no catalog genre's bytes move
             ...(chord ? { pipes: [{ id: "strum", spread: 0.03, part: "stab" }] } : {}),
             tone: { wave: "saw", cut: 1200, q: 1, atk: 0.006,
                     rel: chord ? 0.15 : 0.5, ...(chord ? { ring: 1.2 } : {}),
                     gain: 0.24, verb: 0.1, ...(m.tone || {}),
                     ...(pedalsOf(m) ? { pedals: pedalsOf(m) } : {}) } };
  }

  return { N, JOBS, INSTRUMENTS, REG, PANEL, PEDALS: chair.PEDALS, rhythmic, blank, V,
           catalog, say, says, pedalOf, pedalsOf,
           decisions, nextAsk, answer, toPattern, toGenre, jobOf, gateOf, stepWord };
});
