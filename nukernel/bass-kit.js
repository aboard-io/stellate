// nukernel/bass-kit.js — THE BASS PLAYER, as a model. Pure: no DOM, no
// audio, no state — the same shape as drums-kit.js and for the same reason,
// so every word this player knows is provable in node.
//
// A BASSIST NEEDS DIFFERENT THINGS TO KNOW THAN A DRUMMER. A drummer asks
// how fast, what feel, what job. A bassist asks all of that AND the two
// questions a drummer never has to: WHAT KEY, and WHAT ARE THE CHANGES —
// because a bass part is a line through harmony, and without the harmony
// there is no line. So the interview here starts where the tune starts.
//
// Everything lands on the engine's own bass vocabulary: kernel.js bass()
// reads `bassStyle` (walk / octaves / fifths / pedal / eighths / sixteenths),
// the changes are chord objects the same shape genres.js writes, the key is
// the box's own, and the register is the `boct` field the couch added.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuBass = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- the changes, as a bassist names them ---------- */
  // degrees within the mode; `q` is the chord quality the kernel understands
  const CHANGES = {
    onechord:  { bars: 4,  roots: [0, 0, 0, 0] },
    twelvebar: { bars: 12, roots: [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4], q: "dom7" },
    fifties:   { bars: 4,  roots: [0, 5, 3, 4] },
    fourchord: { bars: 4,  roots: [0, 4, 5, 3] },
    minorvamp: { bars: 4,  roots: [0, 0, 5, 4] },
    twofive:   { bars: 4,  roots: [1, 4, 0, 0], q: "min7" },
    descending:{ bars: 4,  roots: [0, 6, 5, 4] },
    pedalpoint:{ bars: 4,  roots: [0, 0, 0, 0], pedal: true },
  };
  const CHANGEWORD = {
    onechord: "one chord, all night", twelvebar: "a twelve-bar blues",
    fifties: "the fifties changes", fourchord: "the four-chord one",
    minorvamp: "a minor vamp", twofive: "two-five-one",
    descending: "a descending line", pedalpoint: "a pedal point",
  };
  const KEYS = { C: 0, F: -7, G: 7, D: 2, A: -3, E: 4, Bb: -2, Eb: 3 };
  const STYLES = {
    root: "pedal", walk: "walk", octaves: "octaves", fifths: "fifths",
    eighths: "eighths", sixteenths: "sixteenths",
  };
  const STYLEWORD = {
    root: "hold the root", walk: "walk it", octaves: "octaves",
    fifths: "root and fifth", eighths: "eighths, driving",
    sixteenths: "sixteenths, busy",
  };
  // ONLY WHAT THE PLAYER CAN ACTUALLY PICK UP. The parent's sampler holds
  // uprights, fretlesses and slap basses, but nukernel's POOL vocabulary
  // (fields.js INSTRCHOICES) offers three — and a word that casts an
  // instrument the pool will not take is a word that lies. The gate holds
  // this list against the pool.
  const INSTRUMENTS = {
    finger_bass: "fingers on a P-bass",
    picked_bass: "with a pick",
    bass_lead: "a synth bass",
  };

  const blank = () => ({ on: false, key: "C", changes: "fourchord", minor: false,
                         style: "root", instr: "finger_bass", oct: 0, artic: null,
                         swing: null, bpm: 96, sit: 0, answers: {} });

  /* ---------- the words, beyond the interview ---------- */
  const V = {};
  const add = (id, group, words, when, apply, says, is) =>
    { V[id] = { id, group, words, when, apply, says, is: is || (() => false) }; };

  add("start", "start", ["pick up the bass"], (m) => !m.on,
      (m) => ({ ...m, on: true }), () => "a bass, in C, holding the root");

  for (const [k, w] of Object.entries(STYLEWORD))
    add("style:" + k, "the line", [w], (m) => m.on && m.style !== k,
        (m) => ({ ...m, style: k }), () => w, (m) => m.style === k);
  for (const [id, w] of Object.entries(INSTRUMENTS))
    add("instr:" + id, "what you are playing", [w], (m) => m.on && m.instr !== id,
        (m) => ({ ...m, instr: id }), () => w, (m) => m.instr === id);
  for (const [k, w] of Object.entries(CHANGEWORD))
    add("chg:" + k, "the changes", [w], (m) => m.on && m.changes !== k,
        (m) => ({ ...m, changes: k }), () => w, (m) => m.changes === k);
  for (const k of Object.keys(KEYS))
    add("key:" + k, "the key", ["in " + k], (m) => m.on && m.key !== k,
        (m) => ({ ...m, key: k }), () => "in " + k, (m) => m.key === k);

  add("minor", "the key", ["make it minor"], (m) => m.on && !m.minor,
      (m) => ({ ...m, minor: true }), () => "minor", (m) => m.minor);
  add("major", "the key", ["make it major"], (m) => m.on && m.minor,
      (m) => ({ ...m, minor: false }), () => "major", (m) => !m.minor);
  add("short", "how you play them", ["short notes"], (m) => m.on && m.artic !== "staccato",
      (m) => ({ ...m, artic: "staccato" }), () => "short, off the string",
      (m) => m.artic === "staccato");
  add("long", "how you play them", ["let them ring"], (m) => m.on && m.artic !== "legato",
      (m) => ({ ...m, artic: "legato" }), () => "long, ringing", (m) => m.artic === "legato");
  add("down", "the register", ["down an octave"], (m) => m.on && m.oct > -1,
      (m) => ({ ...m, oct: m.oct - 1 }), () => "down an octave");
  add("up", "the register", ["up an octave"], (m) => m.on && m.oct < 1,
      (m) => ({ ...m, oct: m.oct + 1 }), () => "up the neck");
  add("swing", "the feel", ["swing it"], (m) => m.on && m.swing !== "swing",
      (m) => ({ ...m, swing: "swing" }), () => "swung", (m) => m.swing === "swing");
  add("straight", "the feel", ["play it straight"], (m) => m.on && m.swing != null,
      (m) => ({ ...m, swing: null }), () => "straight", (m) => !m.swing);
  add("back", "the feel", ["sit back"], (m) => m.on && m.sit < 1,
      (m) => ({ ...m, sit: m.sit + 1 }), () => "behind the beat");
  add("push", "the feel", ["push it"], (m) => m.on && m.sit > -1,
      (m) => ({ ...m, sit: m.sit - 1 }), () => "on top of the beat");
  add("faster", "the tempo", ["faster"], (m) => m.on && m.bpm < 180,
      (m) => ({ ...m, bpm: m.bpm + 8 }), (m) => (m.bpm + 8) + " bpm");
  add("slower", "the tempo", ["slower"], (m) => m.on && m.bpm > 50,
      (m) => ({ ...m, bpm: m.bpm - 8 }), (m) => (m.bpm - 8) + " bpm");

  /* ---------- WHAT A BASSIST DECIDES, IN ORDER ---------------------------
     The tune first, because a bass line is a line through harmony: key,
     changes, tempo, feel. Then the job, then the instrument, then where you
     sit and how the notes are played. */
  const DEC = [
    { id: "key", ask: "what key?", opts: Object.keys(KEYS).map((k) => ({
        w: "in " + k, is: (m) => m.key === k, apply: (m) => ({ ...m, key: k }) })) },
    { id: "mode", ask: "major or minor?", opts: [
      { w: "major", is: (m) => !m.minor, apply: (m) => ({ ...m, minor: false }) },
      { w: "minor", is: (m) => m.minor, apply: (m) => ({ ...m, minor: true }) } ] },
    { id: "changes", ask: "what are the changes?", opts:
      Object.entries(CHANGEWORD).map(([k, w]) => ({
        w, is: (m) => m.changes === k, apply: (m) => ({ ...m, changes: k }) })) },
    { id: "tempo", ask: "how fast?", opts: [
      { w: "slow, 72", is: (m) => m.bpm === 72, apply: (m) => ({ ...m, bpm: 72 }) },
      { w: "medium, 96", is: (m) => m.bpm === 96, apply: (m) => ({ ...m, bpm: 96 }) },
      { w: "up, 120", is: (m) => m.bpm === 120, apply: (m) => ({ ...m, bpm: 120 }) },
      { w: "fast, 144", is: (m) => m.bpm === 144, apply: (m) => ({ ...m, bpm: 144 }) } ] },
    { id: "feel", ask: "straight or swung?", opts: [
      { w: "straight", is: (m) => !m.swing, apply: (m) => ({ ...m, swing: null }) },
      { w: "swung", is: (m) => m.swing === "swing", apply: (m) => ({ ...m, swing: "swing" }) } ] },
    { id: "job", ask: "what is your job in it?", opts:
      Object.entries(STYLEWORD).map(([k, w]) => ({
        w, is: (m) => m.style === k, apply: (m) => ({ ...m, style: k }) })) },
    { id: "instr", ask: "what are you playing it on?", opts:
      Object.entries(INSTRUMENTS).map(([id, w]) => ({
        w, is: (m) => m.instr === id, apply: (m) => ({ ...m, instr: id }) })) },
    { id: "sit", ask: "where do you sit against the drums?", opts: [
      { w: "right on it", is: (m) => m.sit === 0, apply: (m) => ({ ...m, sit: 0 }) },
      { w: "behind the beat", is: (m) => m.sit > 0, apply: (m) => ({ ...m, sit: 1 }) },
      { w: "on top of it", is: (m) => m.sit < 0, apply: (m) => ({ ...m, sit: -1 }) } ] },
    { id: "notes", ask: "how do you play the notes?", opts: [
      { w: "short, off the string", is: (m) => m.artic === "staccato",
        apply: (m) => ({ ...m, artic: "staccato" }) },
      { w: "let them ring", is: (m) => m.artic === "legato",
        apply: (m) => ({ ...m, artic: "legato" }) },
      { w: "however they fall", is: (m) => !m.artic, apply: (m) => ({ ...m, artic: null }) } ] },
    { id: "reg", ask: "how low?", opts: [
      { w: "down low", is: (m) => m.oct < 0, apply: (m) => ({ ...m, oct: -1 }) },
      { w: "where it sits", is: (m) => m.oct === 0, apply: (m) => ({ ...m, oct: 0 }) },
      { w: "up the neck", is: (m) => m.oct > 0, apply: (m) => ({ ...m, oct: 1 }) } ] },
  ];
  const decisions = (m) => DEC.map((d) => ({
    ...d, answered: (m.answers || {})[d.id] || null,
    opts: d.opts.map((o) => ({ ...o, answered: (m.answers || {})[d.id] === o.w,
      active: (() => { try { return !!o.is(m); } catch (e) { return false; } })() })) }));
  const nextAsk = (m) => decisions(m).find((d) => !d.answered) || null;
  const answer = (m, id, w) => {
    const d = decisions(m).find((x) => x.id === id);
    const o = d && d.opts.find((x) => x.w === w);
    if (!o) return m;
    const out = o.apply(m);
    return { ...out, answers: { ...(m.answers || {}), [id]: w } };
  };

  const catalog = (m) => Object.values(V).map((i) => {
    let active = false, changes = false;
    try { active = !!i.is(m); } catch (e) {}
    try { changes = !!i.when(m); } catch (e) {}
    return { ...i, active, changes };
  });
  const offered = (m) => catalog(m).filter((i) => i.changes);
  const say = (m, id) => (V[id] && V[id].when(m)) ? V[id].apply(m) : m;
  const says = (m, id) => { const i = V[id]; if (!i) return "";
    return typeof i.says === "function" ? i.says(m) : i.says; };

  /* ---------- the model as a genre the engine already plays ---------- */
  // one voice (silent — the page hands it a gateless phrase, so what you hear
  // is the BASS), the changes as roots, and the engine's own bass style
  function toGenre(m, MODES) {
    const c = CHANGES[m.changes];
    return {
      label: "Bass", family: "kernel", rate: 1, bars: c.bars, voices: 1,
      entry: () => 0, reg: () => 0, realize: () => "line", harmony: "cycle",
      roots: c.roots.slice(), instr: "yamaha_grand_piano", nobass: false,
      // the register rides IN the key, because that is the one number
      // kernel.bass() adds to every note it plays
      bassStyle: STYLES[m.style], key: (KEYS[m.key] || 0) + 12 * (m.oct || 0),
      mode: MODES ? (m.minor ? MODES.dorian : MODES.ionian) : undefined,
      kit: {}, artic: m.artic || undefined,
      // behind the beat or on top of it, in ninths of a step
      bassNudge: m.sit ? m.sit * 2 : undefined,
      swing: m.swing === "swing" ? 1 : undefined,
      tone: { wave: "sine", cut: 900, q: 1, atk: 0.01, rel: 0.25, gain: 0.001, verb: 0.08 },
      words: [], word: () => [],
    };
  }

  return { blank, V, catalog, offered, say, says, toGenre, decisions, nextAsk,
           answer, CHANGES, CHANGEWORD, KEYS, STYLES, STYLEWORD, INSTRUMENTS };
});
