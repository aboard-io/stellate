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
  const api = factory(typeof require !== "undefined" ? require("./chair.js") : root.NuChair);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuVocal = api;
})(typeof self !== "undefined" ? self : this, function (C) {
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
  const INSTRUMENTS = {
    ahh_choir: "a choir on ahh", ohh_voices: "voices on ooh",
    solo_vox: "one singer", synth_voice: "a synth voice",
  };
  const REG = { low: { w: "down low", v: -1 }, mid: { w: "where it sits", v: 0 },
                high: { w: "up high", v: 1 } };
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
    model: { job: "oohs", instr: "ahh_choir", reg: "mid" },
    start: { words: ["step up to the mic"], says: "a voice, holding oohs under it" },
    groups: { job: "what you are singing", instr: "the voice", panel: "at the mic" },
    asks: { instr: "whose voice is it?", job: "what are you singing?",
            reg: "where do you sit?" },
    instrSays: (w) => w,
    hit: { on: "sing ", off: "nothing " },
    vel: () => 6,
  });
  const { rhythmic, blank, V, catalog, say, says,
          decisions, nextAsk, answer, toPattern, jobOf, gateOf, stepWord } = chair;

  function toGenre(m) {
    const j = jobOf(m);
    return { part: j.part || "line", reg: (REG[m.reg] || REG.mid).v + (j.reg || 0),
             instr: m.instr, pad: j.part === "pad", silent: !j.part,
             tone: { wave: "sine", cut: 1800, q: 1, atk: 0.05, rel: 1.1, gain: 0.2,
                     verb: 0.22, ...(m.tone || {}) } };
  }
  return { N, JOBS, INSTRUMENTS, REG, PANEL, rhythmic, blank, V, catalog, say, says,
           decisions, nextAsk, answer, toPattern, toGenre, jobOf, gateOf, stepWord };
});
