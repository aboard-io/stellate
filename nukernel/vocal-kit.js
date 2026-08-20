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
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuVocal = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const N = 16;
  const z = () => new Array(N).fill(0);
  const on = (...ix) => { const v = z(); for (const i of ix) v[i] = 1; return v; };
  const deg = (...d) => { const v = z(); d.forEach((x, i) => { v[i] = x; }); return v; };

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
  const PANEL = [
    { id: "cut", ask: "how bright is the voice?", key: "cut", opts: [
      { w: "dark", v: 900 }, { w: "warm", v: 1800 }, { w: "airy", v: 4200 } ] },
    { id: "atk", ask: "how does it come in?", key: "atk", opts: [
      { w: "straight away", v: 0.02 }, { w: "a breath first", v: 0.18 },
      { w: "swelling in", v: 0.7 } ] },
  ];

  const blank = () => ({ on: false, job: "oohs", instr: "ahh_choir", reg: "mid",
                         tone: null, gate: null, answers: {} });
  const jobOf = (m) => JOBS[m.job] || JOBS.oohs;
  const gateOf = (m) => (m.gate ? m.gate.slice() : jobOf(m).gate.slice());
  const toneOf = (m) => m.tone || {};
  const rhythmic = (m) => { const p = jobOf(m).part; return !!p && p !== "pad" && p !== "drone"; };

  const V = {};
  const add = (id, group, words, when, apply, says, is) =>
    { V[id] = { id, group, words, when, apply, says, is: is || (() => false) }; };
  add("start", "start", ["step up to the mic"], (m) => !m.on,
      (m) => ({ ...m, on: true }), () => "a voice, holding oohs under it");
  for (const [k, j] of Object.entries(JOBS))
    add("job:" + k, "what you are singing", [j.w],
        (m) => m.on && (m.job !== k || !!m.gate),
        (m) => ({ ...m, job: k, gate: null }), () => j.says,
        (m) => m.job === k && !m.gate);
  for (const [k, w] of Object.entries(INSTRUMENTS))
    add("instr:" + k, "the voice", [w], (m) => m.on && m.instr !== k,
        (m) => ({ ...m, instr: k }), () => w, (m) => m.instr === k);
  for (const [k, r] of Object.entries(REG))
    add("reg:" + k, "the register", [r.w], (m) => m.on && m.reg !== k,
        (m) => ({ ...m, reg: k }), () => r.w, (m) => m.reg === k);
  for (const p of PANEL)
    for (const o of p.opts)
      add("mach:" + p.id + ":" + o.w, "at the mic", [o.w],
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
        (m) => (gateOf(m)[i] ? "nothing " : "sing ") + stepWord(i),
        (m) => !!gateOf(m)[i]);

  const DECISIONS = [
    { id: "instr", ask: "whose voice is it?", opts:
      Object.entries(INSTRUMENTS).map(([k, w]) => ({
        w, is: (m) => m.instr === k, apply: (m) => ({ ...m, instr: k }) })) },
    { id: "job", ask: "what are you singing?", opts:
      Object.entries(JOBS).map(([k, j]) => ({
        w: j.w, is: (m) => m.job === k, apply: (m) => ({ ...m, job: k, gate: null }) })) },
    { id: "reg", ask: "where does it sit?", opts:
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
    return o ? { ...o.apply(m), answers: { ...(m.answers || {}), [id]: w } } : m;
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
    const j = jobOf(m);
    return { deg: (j.dg || z()).slice(), oct: z(), vel: new Array(N).fill(6),
             inc: z(), stk: z(), gate: gateOf(m), acc: z(), sld: z() };
  }
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
