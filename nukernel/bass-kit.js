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
//
// The interview walker, the vocabulary registrar and the step words are
// chair.js's (NuChair); what is left here is the bassist — the changes, the
// figures, the 303's panel, the tonality table, and toGenre.
(function (root, factory) {
  const api = factory(typeof require !== "undefined" ? require("./chair.js") : root.NuChair);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuBass = api;
})(typeof self !== "undefined" ? self : this, function (C) {
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

  /* ---------- A FIGURE: A BASS LINE, WRITTEN OUT ---------------------------
     "Hold the root" and "eighths, driving" describe a line's DENSITY. What
     an acid line is cannot be described that way — it is a specific figure:
     these sixteenths, that octave jump, an accent there, a slide into the
     next note. The 303's accent and slide have been carried all the way to
     the engine since the bass chair existed (to-engine reads e.acc/e.sld)
     and nothing in the vocabulary could set them, which is why every synth
     bass we made was a straight pulse.

     A figure is four 16-step vectors: where the notes are, what octave each
     takes, which are accented, which slide into the next. The BAR below
     lets you write your own the way the drummer writes a kit. */
  const g16 = C.on;
  const o16 = (...ix) => { const v = new Array(16).fill(0); for (const i of ix) v[i] = 12; return v; };
  const FIGURES = {
    acid:    { w: "an acid line",
               grid: [1,0,1,1, 0,1,1,0, 1,0,1,1, 0,1,0,1],
               oct:  [0,0,0,12, 0,0,0,0, 0,0,12,0, 0,0,0,12],
               acc:  [1,0,0,0, 0,1,0,0, 1,0,0,0, 0,0,0,1],
               sld:  [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,0,0] },
    acid2:   { w: "a rolling 303",
               grid: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
               oct:  [0,0,0,0, 12,0,0,0, 0,0,0,0, 12,0,12,0],
               acc:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
               sld:  [0,1,0,0, 0,1,1,0, 0,1,0,0, 0,1,0,0] },
    offbeat: { w: "house offbeats", grid: g16(2, 6, 10, 14), acc: g16(2, 10) },
    pump:    { w: "a pumping eighth", grid: g16(0, 2, 4, 6, 8, 10, 12, 14), acc: g16(0, 8) },
    // the octave lands on the note, not between two — the alternation has to
    // sit on the steps the grid actually plays
    discoct: { w: "disco octaves", grid: g16(0, 2, 4, 6, 8, 10, 12, 14),
               oct: o16(2, 6, 10, 14), acc: g16(0, 8) },
    bubble:  { w: "a reggae bubble", grid: g16(3, 6, 11, 14), acc: g16(6, 14) },
    stab:    { w: "one stab a bar", grid: g16(0), acc: g16(0) },
    funk16:  { w: "a sixteenth pop", grid: [1,0,1,1, 0,0,1,0, 1,0,1,1, 0,1,0,0],
               acc: g16(0, 8), oct: o16(6, 13) },
  };
  const blank = () => ({ on: false, key: "C", changes: "fourchord", minor: false,
                         style: "root", instr: "finger_bass", oct: 0, artic: null,
                         swing: null, bpm: 96, sit: 0, fig: null, tone: null, answers: {} });
  // the figure a model is playing, as vectors you can edit: a model with no
  // figure of its own is asked what its STYLE would play, so writing a note
  // into the bar starts from the line you can already hear
  const Z16 = () => new Array(16).fill(0);
  const STYLEFIG = {
    pedal: g16(0, 4, 8, 12), walk: g16(0, 4, 8, 12), octaves: g16(0, 4, 8, 12),
    fifths: g16(0, 4, 8, 12), eighths: g16(0, 2, 4, 6, 8, 10, 12, 14),
    sixteenths: new Array(16).fill(1),
  };
  const figOf = (m) => m.fig || { grid: (STYLEFIG[STYLES[m.style]] || g16(0, 4, 8, 12)).slice(),
                                  oct: Z16(), acc: Z16(), sld: Z16(), deg: Z16() };
  const figSet = (m, f) => ({ ...m, fig: { grid: f.grid.slice(), oct: (f.oct || Z16()).slice(),
                                           acc: (f.acc || Z16()).slice(), sld: (f.sld || Z16()).slice(),
                                           deg: (f.deg || Z16()).slice() } });
  const sameFig = (a, b2) => JSON.stringify([a.grid, a.oct, a.acc, a.sld]) ===
    JSON.stringify([b2.grid, b2.oct || Z16(), b2.acc || Z16(), b2.sld || Z16()]);

  /* ---------- THE MACHINE, IF IT IS ONE ----------------------------------
     A 303 whose filter you cannot open is not a 303. The record sets a bass
     tone and until now that was the end of it — the player, sitting at a
     synth, had no cutoff, no resonance, no envelope, no decay and no
     waveform. These are that panel, in words, and they only exist when the
     bass in your hands is a synth: a P-bass has no filter to open. */
  const SYNTHS = ["bass_lead"];
  const isSynth = (m) => SYNTHS.includes(m.instr);
  const PANEL = [
    { id: "cut", ask: "how open is the filter?", key: "cut", opts: [
      { w: "shut", v: 320 }, { w: "dark", v: 600 }, { w: "halfway", v: 1200 },
      { w: "open", v: 2600 }, { w: "wide open", v: 5000 } ] },
    { id: "squelch", ask: "how much squelch?", key: "q", opts: [
      { w: "none", v: 1 }, { w: "a little", v: 4 }, { w: "squelchy", v: 8 },
      { w: "screaming", v: 11.5 } ] },
    { id: "env", ask: "how far does the envelope open it?", key: "env", opts: [
      { w: "barely", v: 0.1 }, { w: "some", v: 0.4 },
      { w: "a long way", v: 0.7 }, { w: "all the way", v: 0.92 } ] },
    { id: "close", ask: "how fast does it close?", key: "rel", opts: [
      { w: "snappy", v: 0.1 }, { w: "short", v: 0.25 },
      { w: "long", v: 0.8 }, { w: "hanging on", v: 2 } ] },
    { id: "wave", ask: "saw or square?", key: "wave", opts: [
      { w: "saw", v: "saw" }, { w: "square", v: "square" } ] },
  ];
  const toneOf = (m) => m.tone || {};

  /* ---------- WHAT NOTES THE LINE USES ------------------------------------
     An acid line is not the root sixteen times with octave jumps — it lives
     on the minor third, the fifth and the flat seventh, and the figure could
     not say any of them. `deg` is a scale degree per step over whatever the
     harmony already chose (kernel: bassFig.deg), so a third here and a
     seventh there is a thing you can ask for by name. */
  const DEGWORD = { 2: "the third", 4: "the fifth", 6: "the seventh" };
  const TONALITY = {
    root:   { w: "just the root",       deg: () => new Array(16).fill(0) },
    third:  { w: "the minor third in it", deg: (g) => g.map((v, i) => (v && i % 4 === 2 ? 2 : 0)) },
    fifth:  { w: "fifths in the line",  deg: (g) => g.map((v, i) => (v && i % 2 ? 4 : 0)) },
    acid:   { w: "a full acid scale",   deg: (g) => g.map((v, i) =>
                                          (!v ? 0 : [0, 0, 2, 0, 4, 6, 2, 0][i % 8])) },
    walk:   { w: "walk it up",          deg: (g) => { let k = 0;
                                          return g.map((v) => (v ? [0, 2, 4, 6][k++ % 4] : 0)); } },
  };

  /* ---------- the words, beyond the interview ---------- */
  const { V, add } = C.vocab();

  add("start", "start", ["pick up the bass"], (m) => !m.on,
      (m) => ({ ...m, on: true }), () => "a bass, in C, holding the root");

  // the machine's own panel — only when there is a machine
  for (const p2 of PANEL)
    for (const o of p2.opts)
      add("mach:" + p2.id + ":" + o.w, "at the machine", [o.w + (p2.id === "cut" ? " filter" : "")],
          (m) => m.on && isSynth(m) && toneOf(m)[p2.key] !== o.v,
          (m) => ({ ...m, tone: { ...toneOf(m), [p2.key]: o.v } }),
          () => p2.ask.replace("?", ": ") + o.w,
          (m) => toneOf(m)[p2.key] === o.v);

  // what notes the line uses
  for (const [k, t] of Object.entries(TONALITY))
    add("tone:" + k, "what notes it plays", [t.w], (m) => m.on,
        (m) => { const f = figOf(m); return figSet(m, { ...f, deg: t.deg(f.grid) }); },
        () => t.w,
        (m) => JSON.stringify(figOf(m).deg || new Array(16).fill(0)) ===
               JSON.stringify(t.deg(figOf(m).grid)));

  // the figures, by name
  for (const [k, f] of Object.entries(FIGURES))
    add("fig:" + k, "the figure", [f.w], (m) => m.on && !sameFig(figOf(m), f),
        (m) => figSet(m, f), () => f.w, (m) => sameFig(figOf(m), f));
  add("fig:none", "the figure", ["forget the figure"], (m) => m.on && !!m.fig,
      (m) => ({ ...m, fig: null }), () => "back to the line, no figure",
      (m) => !m.fig);

  // THE BAR — a bass line built one note at a time, the way the drummer
  // builds a kit. Sixteen places, and three MARKS a bass note can carry that
  // no density word can say: which octave it takes, whether it is accented,
  // whether it slides into the next.
  const stepWord = C.stepWord;
  for (let i = 0; i < 16; i++) {
    add("note:" + i, "the bar", [stepWord(i)], (m) => m.on,
        (m) => { const f = figOf(m); const g2 = f.grid.slice(); g2[i] = g2[i] ? 0 : 1;
                 return figSet(m, { ...f, grid: g2 }); },
        (m) => (figOf(m).grid[i] ? "no note " : "a note ") + stepWord(i),
        (m) => !!figOf(m).grid[i]);
    add("oct:" + i, "octaves in the bar", ["octave up " + stepWord(i)],
        (m) => m.on && !!figOf(m).grid[i],
        (m) => { const f = figOf(m); const o = f.oct.slice(); o[i] = o[i] ? 0 : 12;
                 return figSet(m, { ...f, oct: o }); },
        (m) => (figOf(m).oct[i] ? "back down " : "octave up ") + stepWord(i),
        (m) => !!figOf(m).oct[i]);
    add("acc:" + i, "accents in the bar", ["accent it " + stepWord(i)],
        (m) => m.on && !!figOf(m).grid[i],
        (m) => { const f = figOf(m); const a2 = f.acc.slice(); a2[i] = a2[i] ? 0 : 1;
                 return figSet(m, { ...f, acc: a2 }); },
        (m) => (figOf(m).acc[i] ? "no accent " : "accent ") + stepWord(i),
        (m) => !!figOf(m).acc[i]);
    for (const [d, w] of Object.entries(DEGWORD))
      add("deg:" + i + ":" + d, "notes in the bar", [w + " " + stepWord(i)],
          (m) => m.on && !!figOf(m).grid[i] && (figOf(m).deg || [])[i] !== +d,
          (m) => { const f = figOf(m); const g2 = (f.deg || new Array(16).fill(0)).slice();
                   g2[i] = +d; return figSet(m, { ...f, deg: g2 }); },
          () => w + " " + stepWord(i),
          (m) => (figOf(m).deg || [])[i] === +d);
    add("sld:" + i, "slides in the bar", ["slide out of " + stepWord(i).replace(/^on /, "")],
        (m) => m.on && !!figOf(m).grid[i],
        (m) => { const f = figOf(m); const s2 = f.sld.slice(); s2[i] = s2[i] ? 0 : 1;
                 return figSet(m, { ...f, sld: s2 }); },
        (m) => (figOf(m).sld[i] ? "no slide " : "slide out of ") +
               stepWord(i).replace(/^on /, ""),
        (m) => !!figOf(m).sld[i]);
  }

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
     sit and how the notes are played. chair.js walks the table. */
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
  const { decisions, nextAsk, answer } = C.interview(DEC, { live: true });

  const catalog = C.catalogFullOf(V);
  const offered = (m) => catalog(m).filter((i) => i.changes);
  const say = C.sayOf(V);
  const says = C.saysLooseOf(V);

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
      // the register is the BASS's own (`bassReg`), not the key: on its own
      // page nothing else is listening, but the band shares this genre
      bassStyle: STYLES[m.style], key: (KEYS[m.key] || 0), bassReg: m.oct || 0,
      mode: MODES ? (m.minor ? MODES.dorian : MODES.ionian) : undefined,
      kit: {}, artic: m.artic || undefined, bassArtic: m.artic || undefined,
      bassFig: m.fig || undefined,
      // behind the beat or on top of it, in ninths of a step
      bassNudge: m.sit ? m.sit * 2 : undefined,
      // a bass with a tone of its own: without this the chair runs on the
      // engine's defaults and a synth bass never closes
      // the record's tone, with the player's own panel over it
      bassTone: { wave: "saw", cut: 800, q: 4, atk: 0.004, rel: 0.22, gain: 0.26,
                  ...(m.tone || {}) },
      swing: m.swing === "swing" ? 1 : undefined,
      tone: { wave: "sine", cut: 900, q: 1, atk: 0.01, rel: 0.25, gain: 0.001, verb: 0.08 },
      words: [], word: () => [],
    };
  }

  return { blank, V, catalog, offered, say, says, toGenre, decisions, nextAsk,
           answer, CHANGES, CHANGEWORD, KEYS, STYLES, STYLEWORD, INSTRUMENTS,
           FIGURES, figOf, figSet, stepWord, PANEL, TONALITY, isSynth };
});
