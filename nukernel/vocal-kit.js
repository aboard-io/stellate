// nukernel/vocal-kit.js — THE SINGER. The seventh chair, and the first one
// whose main job is somebody else's material: a singer mostly sings THE
// TUNE, which lives in ideas-kit because it belongs to the room. So this
// chair is two things — a TAKER of the idea (band-kit TAKERS) and a set of
// parts of its own for when the tune is somewhere else: oohs under the
// changes, an answering phrase, a held note, or nothing.
//
// IT DOES NOT SYNTHESISE SPEECH. The parent's espeak organ is untouched and
// still ships on stellate.app; nukernel's own singer was pulled out on
// 2026-08-17 because a fresh Emscripten heap per utterance killed Safari
// (the tombstones are in kernel-daw.html and nukernel.test.js §74). This is
// a VOICE in the sampled sense — ahh/ooh/solo vox from the pool, played like
// any other instrument — and it must stay that way.
//
// CONTENT ONLY. The mechanism is chair.js (NuChair) — one engine, six
// chairs. What is left here is what makes this chair a VOICE: the parts it
// sings, the voices the pool can cast, the mic panel, and toGenre.
(function (root, factory) {
  const api = factory(
    typeof require !== "undefined" ? require("./chair.js") : root.NuChair,
    // ...and the PEDALBOARD, which is instruments.js's (BOARDS over fields.js
    // FX): a chair says which board it is handed, never what an effect IS.
    typeof require !== "undefined" ? require("./instruments.js") : root.NuInstruments);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuVocal = api;
})(typeof self !== "undefined" ? self : this, function (C, NI) {
  "use strict";

  const { N, z, on, deg } = C;

  const JOBS = {
    oohs:   { w: "oohs under it", part: "pad", gate: on(0), reg: 0,
              says: "held vowels under the changes" },
    aahs:   { w: "aahs, high", part: "pad", gate: on(0), reg: 1,
              says: "held vowels, up top" },
    answer: { w: "an answering phrase", part: "counter", gate: on(8, 10, 12), reg: 0,
              dg: deg(0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 2, 0, 0, 0, 0, 0),
              says: "a phrase that answers the line, in the back half of the bar" },
    chant:  { w: "a chant on the beat", part: "stab", gate: on(0, 4, 8, 12), reg: 0,
              says: "one syllable a beat" },
    hold:   { w: "one long note", part: "drone", gate: on(0), reg: 0,
              says: "one note that does not move" },
    out:    { w: "lay out", part: null, gate: z(), reg: 0, says: "nothing at all" },
  };
  // ONLY WHAT THE POOL CAN CAST, and every one of them is a voice.
  //
  // FIVE, AND FIVE IS THE WHOLE ROOM (2026-08-23, the open-the-racks round).
  // Every other rack in the box grew by ten or more when it was opened; this
  // one grew by ONE, because the registry holds exactly five voices with zones
  // on disk (ahh_choir, ohh_voices, solo_vox, synth_voice, space_voice) and a
  // sixth word would have to be a lie or a synonym. `space_voice` is the one
  // that was there and unreachable: a FluidR3 vocal pad, distinct WAVs from
  // both choirs, and the only breathy held voice in the tree — which is why it
  // is named for what it does rather than for who is singing it.
  const INSTRUMENTS = {
    ahh_choir: "a choir on ahh", ohh_voices: "voices on ooh",
    solo_vox: "one singer", synth_voice: "a synth voice",
    space_voice: "a breathy vocal pad",
  };
  // ONE OWNER, 2026-08-28 (chair.js REG3) — see the note there. Byte-for-byte
  // ideas-kit's table before this line; the guitarist's and the keys player's
  // stay their own, because those two genuinely differ.
  const REG = C.REG3;
  // AT THE MIC. Four words, and two of them are new because the singer was the
  // one chair with nothing to say about the instrument itself.
  //   `voice` is WHOSE THROAT — the five formant tables the parent has carried
  // all along (engine/faust/voices/state-engine.js VOICE_TYPE, five voice types
  // straight out of the CSOUND manual's measured tables) and which nothing in
  // this box had ever asked for. It is a real difference and not a transpose:
  // the same A3 through the five throats measures 709-881 Hz of spectral
  // centroid, and each type carries its own COMPASS, so choosing one also moves
  // where the line sits (a bass tops out at 330 Hz where a soprano starts at
  // 247 and runs to 1047, and the register law folds the part into it).
  //   `sway` is whether the tone MOVES — a slow drift on the glottal fold, so a
  // held note stops being one spectrum for its whole length. It sits at a
  // subtle default rather than off, because the thing it fixes is what the
  // voice sounds like when nobody has said anything.
  //   BOTH LAND ON THE MODELLED SINGER (solo_vox -> voice_lead) and are carried
  // and unread by the three sampled choirs, exactly as `wave` and `q` already
  // are in every tone block this chair writes: a recording has one throat and
  // one dynamic, which is the argument the formant model exists to answer.
  const PANEL = [
    { id: "who", ask: "how high is the voice?", key: "voice", opts: [
      { w: "a soprano", v: "soprano" }, { w: "an alto", v: "alto" },
      { w: "a countertenor", v: "countertenor" }, { w: "a tenor", v: "tenor" },
      { w: "a bass", v: "bass" } ] },
    { id: "cut", ask: "how bright is the voice?", key: "cut", opts: [
      { w: "dark", v: 900 }, { w: "warm", v: 1800 }, { w: "airy", v: 4200 } ] },
    { id: "mov", ask: "does the tone move?", key: "sway", opts: [
      { w: "it sits still", v: 0 }, { w: "let it drift", v: 0.12 },
      { w: "let it swell and fade", v: 0.22 } ] },
    { id: "atk", ask: "how does it come in?", key: "atk", opts: [
      { w: "straight away", v: 0.02 }, { w: "a breath first", v: 0.18 },
      { w: "swelling in", v: 0.7 } ] },
  ];

  // the chair itself, from the tables above — a voice names itself plainly
  // ("one singer", not "on one singer") and sings everything at 6
  const chair = C.pitchedChair({
    jobs: JOBS, instruments: INSTRUMENTS, reg: REG, panel: PANEL,
    // THE CHAIN IS THE ONLY AMP A VOICE HAS: no cabinet, no strings, so what
    // is on the board is the whole of what happens to it after the mic.
    pedals: NI.boardOf("voice"),
    model: { job: "oohs", instr: "ahh_choir", reg: "mid" },
    start: { words: ["step up to the mic"], says: "a voice, holding oohs under it" },
    groups: { job: "what you are singing", instr: "the voice", panel: "at the mic",
              pedal: "in the chain" },
    heads: { instr: "the voice", job: "the part", sound: "the sound",
              panel: "the voice", pedal: "the chain" },
    asks: { instr: "whose voice is it?", job: "what are you singing?",
            reg: "where do you sit?", pedal: "anything in the chain?" },
    instrSays: (w) => w,
    hit: { on: "sing ", off: "nothing " },
    vel: () => 6,
  });
  const { rhythmic, blank, V, catalog, say, says, pedalOf, pedalsOf,
          decisions, nextAsk, answer, toPattern, jobOf, gateOf, stepWord } = chair;

  function toGenre(m) {
    const j = jobOf(m);
    return { part: j.part || "line", reg: (REG[m.reg] || REG.mid).v + (j.reg || 0),
             instr: m.instr, pad: j.part === "pad", silent: !j.part,
             tone: { wave: "sine", cut: 1800, q: 1, atk: 0.05, rel: 1.1, gain: 0.2,
                     verb: 0.22, ...(m.tone || {}),
                     ...(pedalsOf(m) ? { pedals: pedalsOf(m) } : {}) } };
  }
  return { N, JOBS, INSTRUMENTS, REG, PANEL, PEDALS: chair.PEDALS, rhythmic, blank, V,
           catalog, say, says, pedalOf, pedalsOf,
           decisions, nextAsk, answer, toPattern, toGenre, jobOf, gateOf, stepWord };
});
