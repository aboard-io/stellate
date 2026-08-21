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
  const api = factory(typeof require !== "undefined" ? require("./chair.js") : root.NuChair);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuKeys = api;
})(typeof self !== "undefined" ? self : this, function (C) {
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
               says: "chords on the beat" },
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

  // ONLY WHAT THE POOL CAN CAST. Every id here is an instrument nukernel's
  // own genres already name, which is what the instrument pool is built from
  // — a word that casts something the pool will not take is a word that lies.
  const INSTRUMENTS = {
    warm_pad: "a warm pad", halo_pad: "a glassy pad", polysynth: "a polysynth",
    slow_strings: "strings", synth_strings_1: "synth strings",
    rhodes_ep: "a Rhodes", legend_ep_2: "an electric piano",
    yamaha_grand_piano: "a grand piano", felt_piano: "a felt piano",
    upright_piano: "an upright", church_organ: "a church organ",
    percussive_organ: "an organ", rock_organ: "a rock organ",
    clavinet: "a clav", ahh_choir: "voices",
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
    church_organ: "organs:", percussive_organ: "organs:", rock_organ: "organs:",
    warm_pad: "pads & strings:", halo_pad: "pads & strings:",
    slow_strings: "pads & strings:", synth_strings_1: "pads & strings:",
    polysynth: "synths:", ahh_choir: "voices:",
  };

  const chair = C.pitchedChair({
    jobs: JOBS, instruments: INSTRUMENTS, reg: REG, panel: PANEL, instrRows: INSTRROWS,
    model: { job: "pads", instr: "warm_pad", reg: "high" },
    start: { words: ["sit down at the keys"], says: "a pair of hands, playing pads" },
    groups: { job: "what you are playing", instr: "what it is", panel: "at the machine" },
    asks: { instr: "what are you playing?", job: "what's your job in it?",
            reg: "where do you sit?" },
    instrSays: (w) => "on " + w,
    hit: { on: "a chord ", off: "no chord " },
    vel: (j) => (j.part === "pad" ? 5 : 6),
  });
  const { rhythmic, blank, V, catalog, offered, say, says,
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
      realize: () => (j.part === "pad" ? "pad" : "line"),
      tone: { wave: "saw", cut: 1400, q: 1.2, atk: 0.05, rel: 0.9, gain: 0.22,
              verb: 0.12, ...(m.tone || {}) },
      silent: !j.part,
    };
  }

  return { N, JOBS, INSTRUMENTS, REG, PANEL, rhythmic, blank, V, catalog, offered, say, says,
           decisions, nextAsk, answer, toPattern, toGenre, jobOf, gateOf, stepWord };
});
