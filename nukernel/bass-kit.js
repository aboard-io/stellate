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
  const api = factory(
    typeof require !== "undefined" ? require("./chair.js") : root.NuChair,
    // ...and the PEDALBOARD, which is instruments.js's (BOARDS over fields.js
    // FX): a chair says which board it is handed, never what an effect IS.
    typeof require !== "undefined" ? require("./instruments.js") : root.NuInstruments);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuBass = api;
})(typeof self !== "undefined" ? self : this, function (C, NI) {
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
    // the passamezzo antico — the REAL Renaissance ground bass, mined from
    // history rather than invented: eight bars in degree space, the
    // progression the pavane danced over. (2026-08-21, the old-world slate.)
    passamezzo:{ bars: 8,  roots: [0, 6, 0, 4, 2, 6, 4, 0] },
  };
  const CHANGEWORD = {
    onechord: "one chord, all night", twelvebar: "a twelve-bar blues",
    fifties: "the doo-wop changes", fourchord: "the four-chord one",
    minorvamp: "a minor vamp", twofive: "two-five-one",
    descending: "a descending line", pedalpoint: "a pedal",
    passamezzo: "the old passamezzo",
  };
  // THE TWELVE KEYS, WHOLE (2026-08-21: it shipped with eight — no Ab, Db,
  // B, F#, so a third of the circle of fifths was unsayable). The value is
  // the semitone shift kernel.js adds to every pitch LAST, so the register
  // convention is the law here: keep the tonic within ±7 of C — up a fifth
  // for G, down a fifth for F (a bassist hears G above and F below), and
  // every other key at its nearest representative — so no key ever moves a
  // line further than the fifths already did. Append, never reorder: the
  // question's option order and the saved sessions' words read this table.
  const KEYS = { C: 0, F: -7, G: 7, D: 2, A: -3, E: 4, Bb: -2, Eb: 3,
                 Ab: -4, Db: 1, B: -1, "F#": 6 };
  const STYLES = {
    root: "pedal", walk: "walk", octaves: "octaves", fifths: "fifths",
    eighths: "eighths", sixteenths: "sixteenths",
  };
  const STYLEWORD = {
    root: "hold the root", walk: "walk it", octaves: "octaves",
    fifths: "root and fifth", eighths: "driving eighths",
    sixteenths: "busy sixteenths",
  };
  // ONLY WHAT THE PLAYER CAN ACTUALLY PICK UP. The parent's sampler holds
  // uprights, fretlesses and slap basses, but nukernel's POOL vocabulary
  // (fields.js INSTRCHOICES) offers three — and a word that casts an
  // instrument the pool will not take is a word that lies. The gate holds
  // this list against the pool.
  // ELEVEN BASSES, WHERE THE RACK SHOWED FIVE AND A RECORD SHOWED TWO
  // (2026-08-23, "give me all choices for keys and all instruments and kits").
  // The header above was true when it was written and had gone stale: the
  // parent's sampler DOES hold the fretless and the slap bass it names, and
  // the pool now offers what a chair claims by name (fields.js INSTRCHOICES,
  // the law the upright established in 2026-08-21). So the six that were
  // "there but unreachable" are reachable, and each one earned its word the
  // same three ways the keys rack did (test/unit/rack-identity.test.js):
  // it resolves, its recipe AND its WAVs differ from every neighbour's, and
  // instruments.js RANGES carries its compass.
  //
  // TWO WERE TRIED AND CUT:
  //   saw_wave    the `supersaw` patch — a LEAD, not a bass, and its recipe is
  //               byte-identical to square_lead's (the patch's own `wave` never
  //               reaches the engine, which is a bug filed against the patch
  //               table and not a reason to sell the same sound twice).
  //   bassoon     a real, distinct recording, and a woodwind. The chair is a
  //               bass player; the orchestra's bass line is `contrabass`.
  const INSTRUMENTS = {
    finger_bass: "fingers on a P-bass",
    picked_bass: "with a pick",
    bass_lead: "a synth bass",
    // ...and the two a pre-1950 record can honestly hold (2026-08-21): the
    // upright is the bass chair's own default recording (instruments.js
    // BASS_INSTR — the pool offers it by name now), and the cello is the
    // bass viol/violone said as the nearest real instrument the registry
    // has. Without these, every old-world record's bass chair claimed a
    // P-bass, which lies by three centuries.
    acoustic_bass: "an upright bass",
    cello: "a cello",
    // ...and the six the room had all along. The electrics first: a thumb, a
    // fretless neck and a bright roundwound set are three different players
    // and three different recordings, not three gains.
    fretless_bass: "a fretless",
    slap_bass: "slapped",
    pop_bass: "a bright electric",
    // the two sampled synth basses, which are NOT the 303: `bass_lead` is a
    // live tb303 patch with a filter you can open (the PANEL below), and these
    // two are recordings of somebody else's machine, with the panel correctly
    // shut on them.
    synth_bass_1: "an old synth bass",
    synth_bass_2: "a fat synth bass",
    // ...and the bowed one, which the cello is not: the orchestra's own bottom
    // octave, arco, a fifth under a cello and stopping at MIDI 67.
    contrabass: "a bowed double bass",
  };

  /* ---------- A FIGURE: A BASS LINE, WRITTEN OUT ---------------------------
     "Hold the root" and "driving eighths" describe a line's DENSITY. What
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
  const blank = () => ({ on: false, pedal: "none", key: "C", changes: "fourchord", minor: false,
                         style: "root", instr: "finger_bass", oct: 0, artic: null,
                         swing: null, bpm: 96, sit: 0, fig: null, tone: null, answers: {} });
  // the figure a model is playing, as vectors you can edit: a model with no
  // figure of its own is asked what its STYLE would play, so writing a note
  // into the bar starts from the line you can already hear
  const Z16 = () => new Array(16).fill(0);
  // ---- AND THE BAR THAT DOES NOT COUNT IN FOUR ---------------------------
  // A bassist's DENSITIES are the one thing in this box that port cleanly:
  // "one note a beat" is one note a beat whatever the beat is, so the style
  // grids are said as a shape and the four literals come back unchanged in
  // 4/4. The three hand-written 303 lines (acid, acid2, funk16) are signature
  // 4/4 patterns — sixteen places of accent and slide that MEAN sixteen — so
  // they are simply not offered under a meter rather than mangled into twelve.
  const { metOf, barOf, regrid } = C;
  const stepsOf = (m) => metOf(m).steps;
  const zOf = (m) => new Array(stepsOf(m)).fill(0);
  const FOURONLY = { acid: 1, acid2: 1, funk16: 1 };
  const STYLEFIG = {
    pedal: g16(0, 4, 8, 12), walk: g16(0, 4, 8, 12), octaves: g16(0, 4, 8, 12),
    fifths: g16(0, 4, 8, 12), eighths: g16(0, 2, 4, 6, 8, 10, 12, 14),
    sixteenths: new Array(16).fill(1),
  };
  const styleGrid = (m) => { const st = STYLES[m.style];
    if (metOf(m).steps === 16) return (STYLEFIG[st] || g16(0, 4, 8, 12)).slice();
    const b = barOf(metOf(m));
    return (st === "eighths" ? b.every(2) : st === "sixteenths" ? b.every(1)
            : b.beats0()).slice(); };
  /* A FIGURE IS A TABLE, AND A TABLE RE-SEATS. `regrid` (chair.js) is the
     law for written-down marks: same place in the beat, beats wrapped — so
     "house offbeats" in a bar of three is the offbeats of THREE beats, not
     sixteen places of which the last four fall off the end (the kernel reads
     a grid with `at`, which wraps, so a 16-place figure on a 12-step bar
     silently loses its tail). The three hand-written 303 lines are the
     exception and always were: sixteen places of accent and slide MEAN
     sixteen, there is no honest twelve of them, and `figFor` answers null so
     every caller — the tray, and a record handing one over the back of the
     chair (band-kit `called`) — refuses them the same way. */
  const figFor = (m, f, k) => {
    if (!f) return null;
    const met = metOf(m);
    if (met.steps === 16 || (f.grid && f.grid.length === met.steps)) return f;
    if (k && FOURONLY[k]) return null;
    const R = (v) => (v ? regrid(v, met) : v);
    return { w: f.w, grid: R(f.grid), oct: R(f.oct), acc: R(f.acc),
             sld: R(f.sld), deg: R(f.deg) };
  };
  const figOf = (m) => m.fig || { grid: styleGrid(m),
                                  oct: zOf(m), acc: zOf(m), sld: zOf(m), deg: zOf(m) };
  const figSet = (m, f) => ({ ...m, fig: { grid: f.grid.slice(), oct: (f.oct || zOf(m)).slice(),
                                           acc: (f.acc || zOf(m)).slice(), sld: (f.sld || zOf(m)).slice(),
                                           deg: (f.deg || zOf(m)).slice() } });
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

  /* ---------- THE BASS BOARD ---------------------------------------------
     The one chair that is not a `pitchedChair`, so it registers its own board
     — same table, same law, same words (instruments.js BOARDS over fields.js
     FX). It is deliberately the SHORT board: a wah, a squelch and a crunch are
     boxes that exist for a bass, and a Leslie is not.
     UNLIKE THE PANEL ABOVE, the board is offered on every bass. The 303 panel
     is shut on a P-bass because a P-bass has no filter; a pedal is a pedal
     whatever is plugged into it, and the electrics are the chair that most
     wants one. */
  const PEDALS = NI.boardOf("bass") || { none: { w: "dry", says: "nothing on it", chain: null } };
  const PEDALDRY = Object.keys(PEDALS)[0];
  const pedalOf = (m) => (PEDALS[m.pedal] ? m.pedal : PEDALDRY);
  const pedalsOf = (m) => { const p = PEDALS[pedalOf(m)];
    return p && p.chain && p.chain.length ? p.chain : null; };

  /* ---------- WHAT NOTES THE LINE USES ------------------------------------
     An acid line is not the root sixteen times with octave jumps — it lives
     on the minor third, the fifth and the flat seventh, and the figure could
     not say any of them. `deg` is a scale degree per step over whatever the
     harmony already chose (kernel: bassFig.deg), so a third here and a
     seventh there is a thing you can ask for by name. */
  const DEGWORD = { 2: "the third", 4: "the fifth", 6: "the seventh" };
  const TONALITY = {
    root:   { w: "just the root",       deg: (g) => g.map(() => 0) },
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
  const PANELROW = { cut: "the filter:", squelch: "the squelch:",
                     env: "the envelope:", close: "how it closes:", wave: "the wave:" };
  for (const p2 of PANEL)
    for (const o of p2.opts) {
      add("mach:" + p2.id + ":" + o.w, "at the machine", [o.w],
          (m) => m.on && isSynth(m) && toneOf(m)[p2.key] !== o.v,
          (m) => ({ ...m, tone: { ...toneOf(m), [p2.key]: o.v } }),
          () => p2.ask.replace("?", ": ") + o.w,
          (m) => toneOf(m)[p2.key] === o.v);
      V["mach:" + p2.id + ":" + o.w].row = PANELROW[p2.id];
    }

  // ...and the board, one pedal at a time
  for (const [k, p] of Object.entries(PEDALS)) {
    add("pedal:" + k, "on the board", [p.w], (m) => m.on && pedalOf(m) !== k,
        (m) => ({ ...m, pedal: k }), () => p.says, (m) => pedalOf(m) === k);
    V["pedal:" + k].row = "the board:";
  }

  // what notes the line uses
  for (const [k, t] of Object.entries(TONALITY))
    add("tone:" + k, "what notes it plays", [t.w], (m) => m.on,
        (m) => { const f = figOf(m); return figSet(m, { ...f, deg: t.deg(f.grid) }); },
        () => t.w,
        (m) => JSON.stringify(figOf(m).deg || zOf(m)) ===
               JSON.stringify(t.deg(figOf(m).grid)));

  // the figures, by name
  for (const [k, f] of Object.entries(FIGURES))
    add("fig:" + k, "the figure", [f.w],
        (m) => m.on && !!figFor(m, f, k) && !sameFig(figOf(m), figFor(m, f, k)),
        (m) => figSet(m, figFor(m, f, k) || f), () => f.w,
        (m) => !!figFor(m, f, k) && sameFig(figOf(m), figFor(m, f, k)));
  add("fig:none", "the figure", ["forget the figure"], (m) => m.on && !!m.fig,
      (m) => ({ ...m, fig: null }), () => "back to the line, no figure",
      (m) => !m.fig);

  // THE BAR — a bass line built one note at a time, the way the drummer
  // builds a kit. Sixteen places, and three MARKS a bass note can carry that
  // no density word can say: which octave it takes, whether it is accented,
  // whether it slides into the next.
  const stepWord = C.stepWord;
  // ...and it SAYS the place in the bar this record actually counts. The
  // registered `words` are the search index (one static list, written in
  // four); the SENTENCE a mark speaks is the model's own count, which is the
  // same string in four and in three and reads "on the and of five" in a six.
  const sw = (i, m) => stepWord(i, metOf(m));
  for (let i = 0; i < 16; i++) {
    add("note:" + i, "the bar", [stepWord(i)], (m) => m.on && i < stepsOf(m),
        (m) => { const f = figOf(m); const g2 = f.grid.slice(); g2[i] = g2[i] ? 0 : 1;
                 return figSet(m, { ...f, grid: g2 }); },
        (m) => (figOf(m).grid[i] ? "no note " : "a note ") + sw(i, m),
        (m) => !!figOf(m).grid[i]);
    add("oct:" + i, "octaves in the bar", ["octave up " + stepWord(i)],
        (m) => m.on && i < stepsOf(m) && !!figOf(m).grid[i],
        (m) => { const f = figOf(m); const o = f.oct.slice(); o[i] = o[i] ? 0 : 12;
                 return figSet(m, { ...f, oct: o }); },
        (m) => (figOf(m).oct[i] ? "back down " : "octave up ") + sw(i, m),
        (m) => !!figOf(m).oct[i]);
    add("acc:" + i, "accents in the bar", ["accent it " + stepWord(i)],
        (m) => m.on && i < stepsOf(m) && !!figOf(m).grid[i],
        (m) => { const f = figOf(m); const a2 = f.acc.slice(); a2[i] = a2[i] ? 0 : 1;
                 return figSet(m, { ...f, acc: a2 }); },
        (m) => (figOf(m).acc[i] ? "no accent " : "accent ") + sw(i, m),
        (m) => !!figOf(m).acc[i]);
    for (const [d, w] of Object.entries(DEGWORD))
      add("deg:" + i + ":" + d, "notes in the bar", [w + " " + stepWord(i)],
          (m) => m.on && i < stepsOf(m) && !!figOf(m).grid[i] && (figOf(m).deg || [])[i] !== +d,
          (m) => { const f = figOf(m); const g2 = (f.deg || zOf(m)).slice();
                   g2[i] = +d; return figSet(m, { ...f, deg: g2 }); },
          (m) => w + " " + sw(i, m),
          (m) => (figOf(m).deg || [])[i] === +d);
    add("sld:" + i, "slides in the bar", ["slide out of " + stepWord(i).replace(/^on /, "")],
        (m) => m.on && i < stepsOf(m) && !!figOf(m).grid[i],
        (m) => { const f = figOf(m); const s2 = f.sld.slice(); s2[i] = s2[i] ? 0 : 1;
                 return figSet(m, { ...f, sld: s2 }); },
        (m) => (figOf(m).sld[i] ? "no slide " : "slide out of ") +
               sw(i, m).replace(/^on /, ""),
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
    { id: "pedal", ask: "anything on the board?", opts:
      Object.entries(PEDALS).map(([k, p]) => ({
        w: p.w, is: (m) => pedalOf(m) === k, apply: (m) => ({ ...m, pedal: k }) })) },
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
      // the bar this line was written for; absent = the sixteen it always was
      ...(metOf(m).steps !== 16
          ? { meter: { steps: metOf(m).steps, pulse: metOf(m).pulse } } : {}),
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

  const BARMARKS = [
    { w: "a note",        id: (i) => "note:" + i },
    { w: "the third",     id: (i) => "deg:" + i + ":2" },
    { w: "the fifth",     id: (i) => "deg:" + i + ":4" },
    { w: "the seventh",   id: (i) => "deg:" + i + ":6" },
    { w: "up the octave", id: (i) => "oct:" + i },
    { w: "an accent",     id: (i) => "acc:" + i },
    { w: "a slide out",   id: (i) => "sld:" + i },
  ];

  return { blank, V, catalog, offered, say, says, toGenre, decisions, nextAsk,
           answer, CHANGES, CHANGEWORD, KEYS, STYLES, STYLEWORD, INSTRUMENTS,
           PEDALS, pedalOf, pedalsOf,
           FIGURES, figOf, figSet, figFor, stepWord, PANEL, TONALITY, isSynth, BARMARKS };
});
