// nukernel/ideas-kit.js — THE IDEAS. A melody does not belong to a player: it
// belongs to the room. Somebody writes it, and then the keys double it, the
// guitar riffs on it and the singer sings it — one idea, three realizations,
// which is why it lives here and not in any chair's file.
//
// WHAT A MELODY IS, in three parts, because that is what makes one:
//   1. A RHYTHM with somewhere to breathe. Not sixteen places the way a kit
//      is — a melodic phrase is one, two or four BARS long and the RESTS are
//      the content. A tune that plays on every sixteenth is a scale.
//   2. A CONTOUR over the harmony, not a list of pitches. Real melodies are
//      shapes that land on chord tones on the strong beats and pass between
//      them elsewhere, so this writes DEGREES (kernel `deg`, resolved against
//      the bar's own chord) and lets the harmony decide the notes. That is
//      what makes every melody here harmonically correct by construction.
//   3. AN ANSWER. Say something, say it again ending differently, then go
//      somewhere else — the difference between a hook and a loop. The same
//      law the drummer's two-bar sentence follows, at phrase scale.
//
// What it deliberately is NOT: a note-by-note random walk (measured worse
// than uniform when this repo's parent mined it — tools/mine/mine-weave.js)
// and not an average of anything (the median of a thousand melodies is a
// monotone — tools/mine/mine-melody.js uses a MEDOID for exactly this reason).
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuIdeas = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const N = 16;
  const z = (n) => new Array(n || N).fill(0);
  const g16 = (...ix) => { const v = z(); for (const i of ix) v[i] = 1; return v; };

  /* ---------- 1. THE RHYTHM: where the notes fall, and where they don't ---- */
  const CELLS = {
    long:   { w: "long notes", g: g16(0, 8) },
    even:   { w: "even eighths", g: g16(0, 2, 4, 6, 8, 10, 12, 14) },
    three:  { w: "three notes and a rest", g: g16(0, 2, 4) },
    pickup: { w: "a pickup into the bar", g: g16(7, 8, 12) },
    push:   { w: "pushed, off the beat", g: g16(2, 6, 10, 14) },
    gallop: { w: "a gallop", g: g16(0, 3, 4, 8, 11, 12) },
    hang:   { w: "one long note, then a run", g: g16(0, 12, 13, 14, 15) },
    call:   { w: "a short call", g: g16(0, 3, 5) },
    walkup: { w: "a walk up to the beat", g: g16(4, 5, 6, 8) },
    riff:   { w: "an insistent figure", g: g16(0, 3, 6, 8, 11, 14) },
  };

  /* ---------- 2. THE CONTOUR: the shape, in scale degrees ----------------- */
  // Each returns the degree for onset k of n. They are SHAPES, not walks:
  // where a melody goes is a decision, and a decision has a direction.
  // STEPWISE FIRST. Measured, the first cut of this table was 18% stepwise
  // motion with seven leaps in twelve notes — which is not a melody, it is a
  // broken chord, and every one of Bach, Adele and Joy Division would say the
  // same thing about it. Real tunes move by SECONDS most of the time and
  // leap on purpose. These are scale DEGREES, so ±1 is a step, and the
  // shapes are written in steps.
  const CONTOURS = {
    rise:  { w: "rises", f: (k) => k },
    arch:  { w: "arches over", f: (k, n) => { const h = Math.floor((n - 1) / 2);
              return k <= h ? k : Math.max(0, 2 * h - k); } },
    fall:  { w: "falls away", f: (k, n) => (n - 1) - k },
    hover: { w: "hovers", f: (k) => [0, 1, 0, -1][k % 4] },
    drop:  { w: "drops, then climbs", f: (k, n) => { const h = Math.floor((n - 1) / 2);
              return k <= h ? -k : -h + (k - h); } },
    // measured at 21% stepwise with eighteen leaps when it was written as a
    // wide alternation — a zigzag is a step up, a step down and a reach, not
    // an interval machine
    zig:   { w: "turns back on itself", f: (k) => [0, 1, 0, 2, 1, 3, 2][k % 7] },
    insist:{ w: "says one note, then moves", f: (k) => [0, 0, 0, 1, 2, 1][k % 6] },
    hold:  { w: "sits on one note", f: () => 0 },
  };

  /* ---------- 3. WHERE IT LANDS ------------------------------------------ */
  // The last note of a phrase is the one anybody remembers, and which chord
  // tone it is IS the feeling: the root closes, the third warms, the fifth
  // opens, the seventh leans, the note under the root pulls.
  const LANDINGS = {
    root:    { w: "lands on the root", d: 0 },
    third:   { w: "lands on the third", d: 2 },
    fifth:   { w: "lands on the fifth", d: 4 },
    seventh: { w: "leans on the seventh", d: 6 },
    lead:    { w: "hangs under the root", d: -1 },
  };

  const LENGTHS = { one: { w: "a bar long", bars: 1 }, two: { w: "two bars", bars: 2 },
                    four: { w: "four bars", bars: 4 } };
  // OCTAVES OVER MIDDLE C, the kernel's own `reg`. A tune sits an octave
  // above the keys' comping by default — the register a voice sings in and a
  // lead line lives in, not the one the chords are in.
  // OCTAVES OVER MIDDLE C, the kernel's own `reg` — and the LEAD part adds
  // an octave of its own on top (PARTS.lead ctr:+12, "up top, sings,
  // breathes"), which is why "where it sits" is 0 here and not 1: writing
  // the octave in both places put every tune in the top of the piano.
  const REG = { low: { w: "down low", v: -1 }, mid: { w: "where it sits", v: 0 },
                high: { w: "up high", v: 1 } };

  const blank = () => ({ on: false, cell: "three", contour: "arch", land: "root",
                         len: "two", reg: "mid", answer: true, name: "the hook",
                         answers: {} });

  const cellOf = (m) => CELLS[m.cell] || CELLS.three;
  const barsOf = (m) => (LENGTHS[m.len] || LENGTHS.two).bars;

  /* ---------- THE PHRASE THE ENGINE PLAYS --------------------------------
     One vector per bar of the idea, joined: the rhythm cell restated, the
     contour sampled across ALL its onsets (so a two-bar idea is one shape,
     not the same bar twice), and the last note of each half moved to the
     landing — the answer's landing is the OTHER one, which is the whole
     question-and-answer of it. */
  // (THE BAR LINE. A motif restated over a moving root restarts wherever the
  // root put it, and an octave-folding pass to "connect" the bars measured as
  // a no-op on every progression tried — the restatement is already within a
  // fourth of where the last bar ended, and the one big drop in the phrase is
  // the QUESTION note falling into the answer, which is the phrase working.
  // So there is no smoothing pass here, deliberately.)
  function toPhrase(m, roots) {
    const bars = barsOf(m), cell = cellOf(m).g, con = CONTOURS[m.contour] || CONTOURS.arch;
    const land = (LANDINGS[m.land] || LANDINGS.root).d;
    const n = bars * N;
    const gate = z(n), deg = z(n), vel = new Array(n).fill(6), oct = z(n);
    // ONE MOTIF, RESTATED. The shape is sampled over ONE bar's onsets and
    // said again in the next bar — which is what a hook IS. (Running the
    // contour across the whole phrase instead made every bar different from
    // every other, so there was nothing to remember; the kernel transposes
    // each bar by its own chord anyway, so a restated motif over moving
    // changes is a SEQUENCE, which is the oldest good idea in melody.)
    const inBar = [];
    for (let i = 0; i < N; i++) if (cell[i]) inBar.push(i);
    const onsets = [];
    for (let b = 0; b < bars; b++)
      for (const i of inBar) { gate[b * N + i] = 1; onsets.push(b * N + i); }
    onsets.forEach((at, k) => {
      const j = k % inBar.length;
      deg[at] = con.f(j, inBar.length);
      // the register is the GENRE's (`reg`), not the phrase's — writing it
      // in both places put every tune an octave higher than it was asked for
      // the phrase leans on its first note and gives back on the way out
      vel[at] = j === 0 ? 8 : (j === inBar.length - 1 ? 5 : 6);
    });
    if (onsets.length) {
      const last = onsets[onsets.length - 1];
      deg[last] = land;
      // THE ANSWER: the first half asks (it stops somewhere unresolved) and
      // the second half answers (it lands). A phrase that ends the same way
      // twice is one phrase said twice.
      if (m.answer && bars > 1) {
        const mid = onsets.filter((x) => x < (bars / 2) * N);
        if (mid.length) deg[mid[mid.length - 1]] = land === 0 ? 4 : 0;
      }
    }
    return { deg, oct, vel, inc: z(n), stk: z(n), gate, acc: z(n), sld: z(n) };
  }

  // what it sounds like, said out loud — the chyron the page can print
  const describe = (m) => [cellOf(m).w, (CONTOURS[m.contour] || {}).w,
                           (LANDINGS[m.land] || {}).w].join(", ");

  /* ---------- the words ---------- */
  const V = {};
  const add = (id, group, words, when, apply, says, is) =>
    { V[id] = { id, group, words, when, apply, says, is: is || (() => false) }; };

  add("start", "start", ["write something"], (m) => !m.on,
      (m) => ({ ...m, on: true }), () => "a phrase, two bars, arching over");

  // A WORD THAT MAKES THE SAME TUNE IS NOT A WORD. Three notes in a bar can
  // only be so many shapes — over a three-note cell, "arches over",
  // "hovers" and "turns back on itself" are the identical phrase — so a
  // shape is offered only when it would come out DIFFERENT. (The model
  // moving is not enough: this file's whole job is the phrase.)
  const sounds = (m) => JSON.stringify(toPhrase(m).deg) + JSON.stringify(toPhrase(m).gate);
  // ...and no two of the offered ones may sound alike EITHER. Comparing each
  // only against the current phrase left two shapes that were different from
  // what is playing and identical to each other; the first one in the table
  // wins and the rest are not asked. Deterministic, because the table has an
  // order.
  const firstOf = (field, keys) => (m, k) => {
    if (m[field] === k) return true;
    const mine = sounds({ ...m, [field]: k });
    if (mine === sounds(m)) return false;
    for (const other of keys) {
      if (other === k) break;
      if (other !== m[field] && sounds({ ...m, [field]: other }) === mine) return false;
    }
    return true;
  };
  const conFirst = firstOf("contour", Object.keys(CONTOURS));
  const cellFirst = firstOf("cell", Object.keys(CELLS));
  const heard = (mk) => (m) => m.on && sounds(mk(m)) !== sounds(m);
  for (const [k, c] of Object.entries(CELLS))
    add("cell:" + k, "the rhythm of it", [c.w],
        (m) => m.on && m.cell !== k && cellFirst(m, k),
        (m) => ({ ...m, cell: k }), () => c.w, (m) => m.cell === k);
  for (const [k, c] of Object.entries(CONTOURS))
    add("con:" + k, "the shape", [c.w],
        (m) => m.on && m.contour !== k && conFirst(m, k),
        (m) => ({ ...m, contour: k }), () => "it " + c.w, (m) => m.contour === k);
  for (const [k, l] of Object.entries(LANDINGS))
    add("land:" + k, "where it ends", [l.w], (m) => m.on && m.land !== k,
        (m) => ({ ...m, land: k }), () => l.w, (m) => m.land === k);
  for (const [k, l] of Object.entries(LENGTHS))
    add("len:" + k, "how long", [l.w], (m) => m.on && m.len !== k,
        (m) => ({ ...m, len: k }), () => l.w, (m) => m.len === k);
  for (const [k, r] of Object.entries(REG))
    add("reg:" + k, "the register", [r.w], (m) => m.on && m.reg !== k,
        (m) => ({ ...m, reg: k }), () => r.w, (m) => m.reg === k);
  add("answer", "the answer", ["answer itself"], (m) => m.on && barsOf(m) > 1,
      (m) => ({ ...m, answer: !m.answer }),
      (m) => (m.answer ? "both halves end the same way" : "the first half asks, the second answers"),
      (m) => !!m.answer);

  /* ---------- the interview ---------- */
  const DECISIONS = [
    { id: "len", ask: "how long is it?", opts: Object.entries(LENGTHS).map(([k, l]) => ({
        w: l.w, is: (m) => m.len === k, apply: (m) => ({ ...m, len: k }) })) },
    { id: "cell", ask: "what's its rhythm?", opts: Object.entries(CELLS).map(([k, c]) => ({
        w: c.w, is: (m) => m.cell === k, apply: (m) => ({ ...m, cell: k }) })) },
    { id: "contour", ask: "what shape does it make?",
      opts: Object.entries(CONTOURS).map(([k, c]) => ({
        w: c.w, is: (m) => m.contour === k, apply: (m) => ({ ...m, contour: k }),
        // ...and the same law in the interview: over the rhythm you chose,
        // two shapes that come out identical are one answer, not two
        heard: (m) => conFirst(m, k) })) },
    { id: "land", ask: "where does it end?", opts: Object.entries(LANDINGS).map(([k, l]) => ({
        w: l.w, is: (m) => m.land === k, apply: (m) => ({ ...m, land: k }) })) },
    { id: "reg", ask: "how high does it sit?", opts: Object.entries(REG).map(([k, r]) => ({
        w: r.w, is: (m) => m.reg === k, apply: (m) => ({ ...m, reg: k }) })) },
  ];
  const decisions = (m) => DECISIONS.map((d) => ({
    ...d, answered: (m.answers || {})[d.id] || null,
    opts: d.opts.filter((o) => !o.heard || o.heard(m))
      .map((o) => ({ ...o, answered: (m.answers || {})[d.id] === o.w,
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

  const regOf = (m) => (REG[m.reg] || REG.mid).v;
  return { N, CELLS, CONTOURS, LANDINGS, LENGTHS, REG, regOf, blank, V, catalog, say, says,
           decisions, nextAsk, answer, toPhrase, describe, barsOf, cellOf };
});
