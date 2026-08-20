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
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuGuitar = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const N = 16;
  const z = () => new Array(N).fill(0);
  const on = (...ix) => { const v = z(); for (const i of ix) v[i] = 1; return v; };
  const every = (n, from) => { const v = z(); for (let i = from || 0; i < N; i += n) v[i] = 1; return v; };
  const deg = (...d) => { const v = z(); d.forEach((x, i) => { v[i] = x; }); return v; };

  const JOBS = {
    chug:   { w: "a palm-muted chug", part: "riff", gate: every(2), reg: -1,
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

  // THE DIRT IS THE INSTRUMENT. Every id is one nukernel's own genres name,
  // which is what the pool is cast from.
  const INSTRUMENTS = {
    clean_guitar: "a clean electric", crunch_guitar: "a crunchy one",
    overdrive_guitar: "an overdriven one", distortion_guitar: "a distorted one",
    palm_muted_guitar: "a muted one", jazz_guitar: "a jazz box",
    steel_string_guitar: "a steel-string acoustic",
    nylon_string_guitar: "a nylon-string",
  };
  const REG = { low: { w: "down low", v: -1 }, mid: { w: "where it sits", v: 0 },
                high: { w: "up the neck", v: 1 } };
  const PANEL = [
    { id: "cut", ask: "how bright is it?", key: "cut", opts: [
      { w: "dark", v: 900 }, { w: "warm", v: 1800 },
      { w: "bright", v: 3400 }, { w: "glassy", v: 6000 } ] },
    { id: "rel", ask: "how long does it ring?", key: "rel", opts: [
      { w: "damped", v: 0.15 }, { w: "ringing", v: 0.7 }, { w: "hanging on", v: 2 } ] },
  ];

  const blank = () => ({ on: false, job: "strum", instr: "clean_guitar", reg: "mid",
                         tone: null, gate: null, answers: {} });
  const jobOf = (m) => JOBS[m.job] || JOBS.strum;
  const gateOf = (m) => (m.gate ? m.gate.slice() : jobOf(m).gate.slice());
  const toneOf = (m) => m.tone || {};
  const rhythmic = (m) => { const p = jobOf(m).part; return !!p && p !== "pad" && p !== "drone"; };

  const V = {};
  const add = (id, group, words, when, apply, says, is) =>
    { V[id] = { id, group, words, when, apply, says, is: is || (() => false) }; };

  add("start", "start", ["pick up the guitar"], (m) => !m.on,
      (m) => ({ ...m, on: true }), () => "a guitar, strumming it");
  for (const [k, j] of Object.entries(JOBS))
    add("job:" + k, "what you are playing", [j.w],
        (m) => m.on && (m.job !== k || !!m.gate),
        (m) => ({ ...m, job: k, gate: null }), () => j.says,
        (m) => m.job === k && !m.gate);
  for (const [k, w] of Object.entries(INSTRUMENTS))
    add("instr:" + k, "what it is", [w], (m) => m.on && m.instr !== k,
        (m) => ({ ...m, instr: k }), () => "on " + w, (m) => m.instr === k);
  for (const [k, r] of Object.entries(REG))
    add("reg:" + k, "the register", [r.w], (m) => m.on && m.reg !== k,
        (m) => ({ ...m, reg: k }), () => r.w, (m) => m.reg === k);
  for (const p of PANEL)
    for (const o of p.opts)
      add("mach:" + p.id + ":" + o.w, "at the amp", [o.w],
          (m) => m.on && toneOf(m)[p.key] !== o.v,
          (m) => ({ ...m, tone: { ...toneOf(m), [p.key]: o.v } }),
          () => p.ask.replace("?", ": ") + o.w,
          (m) => toneOf(m)[p.key] === o.v);
  const COUNT = ["one", "two", "three", "four"], SUB = ["", "e", "and", "a"];
  const stepWord = (i) => (i % 4 === 0) ? "on " + COUNT[i >> 2]
    : "on the " + SUB[i % 4] + " of " + COUNT[i >> 2];
  for (let i = 0; i < N; i++)
    add("hit:" + i, "the bar", [stepWord(i)], (m) => m.on && rhythmic(m),
        (m) => { const g = gateOf(m); g[i] = g[i] ? 0 : 1; return { ...m, gate: g }; },
        (m) => (gateOf(m)[i] ? "no strum " : "a strum ") + stepWord(i),
        (m) => !!gateOf(m)[i]);

  const DECISIONS = [
    { id: "instr", ask: "what are you playing?", opts:
      Object.entries(INSTRUMENTS).map(([k, w]) => ({
        w, is: (m) => m.instr === k, apply: (m) => ({ ...m, instr: k }) })) },
    { id: "job", ask: "what's your job in it?", opts:
      Object.entries(JOBS).map(([k, j]) => ({
        w: j.w, is: (m) => m.job === k, apply: (m) => ({ ...m, job: k, gate: null }) })) },
    { id: "reg", ask: "where do you sit?", opts:
      Object.entries(REG).map(([k, r]) => ({
        w: r.w, is: (m) => m.reg === k, apply: (m) => ({ ...m, reg: k }) })) },
    ...PANEL.map((p) => ({ id: p.id, ask: p.ask, opts: p.opts.map((o) => ({
      w: o.w, is: (m) => toneOf(m)[p.key] === o.v,
      apply: (m) => ({ ...m, tone: { ...toneOf(m), [p.key]: o.v } }) })) })),
  ];
  const decisions = (m) => DECISIONS.map((d) => ({
    ...d, answered: (m.answers || {})[d.id] || null,
    opts: d.opts.map((o) => ({ ...o, answered: (m.answers || {})[d.id] === o.w,
      active: (() => { try { return !!o.is(m); } catch (e) { return false; } })() })) }));
  const nextAsk = (m) => decisions(m).find((d) => !d.answered) || null;
  function answer(m, id, w) {
    const d = DECISIONS.find((x) => x.id === id);
    const o = d && d.opts.find((x) => x.w === w);
    if (!o) return m;
    return { ...o.apply(m), answers: { ...(m.answers || {}), [id]: w } };
  }
  const catalog = (m) => Object.values(V).map((i) => {
    let changes = false, active = false;
    try { changes = !!i.when(m) && JSON.stringify(i.apply(m)) !== JSON.stringify(m); } catch (e) {}
    try { active = !!i.is(m); } catch (e) {}
    return { id: i.id, group: i.group, words: i.words, changes, active };
  });
  const say = (m, id) => (V[id] && V[id].when(m) ? V[id].apply(m) : m);
  const says = (m, id) => (V[id] ? V[id].says(m) : "");

  function toPattern(m) {
    const j = jobOf(m), g = gateOf(m);
    return { deg: (j.dg || z()).slice(), oct: z(),
             vel: new Array(N).fill(j.part === "riff" ? 7 : 6),
             inc: z(), stk: z(), gate: g, acc: z(), sld: z() };
  }
  function toGenre(m) {
    const j = jobOf(m);
    return { part: j.part || "line", reg: (REG[m.reg] || REG.mid).v + (j.reg || 0),
             instr: m.instr, pad: j.part === "pad", silent: !j.part,
             tone: { wave: "saw", cut: 1800, q: 1, atk: 0.006, rel: 0.5, gain: 0.24,
                     verb: 0.1, ...(m.tone || {}) } };
  }

  return { N, JOBS, INSTRUMENTS, REG, PANEL, rhythmic, blank, V, catalog, say, says,
           decisions, nextAsk, answer, toPattern, toGenre, jobOf, gateOf, stepWord };
});
