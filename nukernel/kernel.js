// kernel.js — the nukernel ALGEBRA. Pure, total, zero dependencies (UMD like
// every engine file). No I/O, no DOM, no audio, no genre data: generators and
// transformers only, so the ASCII printer (tri.js) and the browser DAW
// (kernel-daw.js) wrap exactly the same code instead of each carrying a copy.
//
// A PATTERN is five parallel CYCLIC vectors of equal length:
//   deg   scale-degree index into PENT — never an absolute pitch, so the same
//         phrase survives being read in any genre
//   oct   octave displacement per step   (binary)
//   gate  note or rest                   (binary)
//   acc   accent                         (binary)
//   sld   slide INTO this step           (binary, EDGE-valued — see reverse)
//
// Every operator is TOTAL: pattern in, valid pattern out, no failure modes and
// nothing to validate. That is what keeps the algebra small enough to search.
(function (root) {
  "use strict";

  // ---- indexing ------------------------------------------------------------
  // Patterns are necklaces, not lists: they have no ends. Every read is cyclic.
  const at = (v, i) => v[((i % v.length) + v.length) % v.length];
  const map5 = (p, f) => ({ deg: f(p.deg), oct: f(p.oct), gate: f(p.gate),
                            acc: f(p.acc), sld: f(p.sld) });

  // ---- the group -----------------------------------------------------------
  const rotate = k => p => map5(p, v => v.map((_, i) => at(v, i + k)));

  // Retrograde is NOT `reverse` on all five vectors. deg/oct/gate/acc live on
  // steps; sld lives on the TRANSITION INTO a step, i.e. on edges, not nodes.
  // Reversing the node vectors and the edge vector the same way leaves every
  // slide attached to the wrong side of its transition. Hence the shift.
  const reverse = () => p => {
    const r = map5(p, v => [...v].reverse());
    r.sld = r.sld.map((_, i) => at(r.sld, i + 1));
    return r;
  };

  const transpose  = k => p => ({ ...p, deg: p.deg.map(d => d + k) });
  const invert     = c => p => ({ ...p, deg: p.deg.map(d => c - d) });
  const complement = k => p => ({ ...p, [k]: p[k].map(b => (b ? 0 : 1)) });
  const crossmap   = (a, b) => p => ({ ...p, [b]: p[a].slice() });  // binary vectors only

  // The one LOSSY operator — take n steps from a and cycle them. Everything
  // else is information-preserving, so the subject can be recovered; this one
  // discards, which is how you get episodes rather than variations.
  const excerpt = (a, n) => p => map5(p, v => v.map((_, i) => at(v, a + (i % n))));

  // The discipline that keeps a subject recognizable: move ONE vector at a
  // time. Without this combinator that discipline is not even expressible —
  // every operator above rewrites all five at once.
  const only = (k, op) => p => ({ ...p, [k]: op(p)[k] });

  // An operator WORD is a list of operators applied left to right.
  const word = (p, ws) => ws.reduce((q, op) => op(q), p);

  // ---- pitch ---------------------------------------------------------------
  // Two alphabets on purpose. The SUBJECT is pentatonic, which buys consonant
  // stretto for free — any transposition of a pentatonic line against itself
  // stays inside the scale, so counterpoint needs no rules engine. But
  // pentatonic has no leading tone and no tritone, so it cannot express
  // dominant function; CHORDS therefore use the full seven-note mode. PENT is
  // a subset of MODE, so every subject note lands inside every chord.
  const PENT  = [0, 3, 5, 7, 10];                       // minor pentatonic
  const MODE  = [0, 2, 3, 5, 7, 8, 10];                 // natural minor
  const ROMAN = ["i", "ii°", "III", "iv", "v", "VI", "VII"];

  const pitch = d => PENT[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5);
  const mp    = d => MODE[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);

  // The operators are closed on PATTERNS but NOT on REGISTER: transposition
  // and per-voice offset compound without bound, so a four-voice fugue answered
  // at the fifth walks off the keyboard. Fold into the voice's octave window —
  // octave-equivalence as a quotient, and it is a requirement, not a polish.
  const fold = (n, c) => { while (n < c - 6) n += 12; while (n > c + 6) n -= 12; return n; };

  // nearest mode degree to a pitch class — how a transposition becomes a root
  const near = pc => {
    let b = 0, x = 99;
    MODE.forEach((m, i) => {
      const t = Math.min((m - pc + 120) % 12, (pc - m + 120) % 12);
      if (t < x) { x = t; b = i; }
    });
    return b;
  };

  // ---- harmony: a MODE, not a layer ---------------------------------------
  // Where the roots come from is itself a genre fact, and there are only three
  // sources: read them off the entry schedule, don't have any, or carry an
  // independent cycle. Two of the three need no stored data at all.
  function harm(subj, g, bar) {
    if (g.harmony === "cycle") return at(g.roots, bar);
    if (g.harmony === "emergent") {
      // transposition of the subject IS modulation: an answer at the fifth is
      // the dominant because that is what an answer at the fifth means
      const v = Math.min(bar, g.voices - 1);
      const q = word(subj, g.word(v, 0));
      return near((((pitch(q.deg[0]) - pitch(subj.deg[0])) % 12) + 12) % 12);
    }
    return 0;                                            // modal: no motion
  }

  // ---- the voice schedule --------------------------------------------------
  // A song is n copies of the subject, each with an operator word, an entry
  // bar, a register and a realization. One mechanism covers both ends of the
  // dial: a fugue staggers entries and transforms each; acid layers entries
  // and transforms none.
  function render(subj, g, bars) {
    const N = subj.deg.length, ev = [];
    for (let v = 0; v < g.voices; v++) {
      const ctr = 60 + 12 * g.reg(v);
      for (let b = g.entry(v); b < bars; b++) {
        const p = word(subj, g.word(v, b - g.entry(v))), r = harm(subj, g, b);
        for (let i = 0; i < N; i++) {
          if (!p.gate[i]) continue;
          const ns = g.realize(v) === "pad"
            ? [r, r + 2, r + 4].map(mp)                  // chord from HARMONY, not from the note
            : [pitch(p.deg[i]) + 12 * p.oct[i]];
          for (const n of ns)
            ev.push({ t: (b * N + i) / g.rate, dur: 1 / g.rate, v,
                      n: fold(n, ctr), acc: p.acc[i], sld: p.sld[i] });
        }
      }
    }
    return ev.sort((a, b) => a.t - b.t);
  }

  // ---- the grid: the CATEGORICAL half --------------------------------------
  // A kit is voice -> cyclic binary vector, and it does NOT derive from the
  // subject: four-on-the-floor is a noun, not a transformation. Measured on
  // this kernel, those literal vectors carry more genre identity than the whole
  // operator set does. The ghost layer is the one seam where the seed phrase
  // reaches the rhythm bed — and it needs `only`, because accents are a subset
  // of gates by construction, so any whole-pattern operator preserves that
  // containment and the layer can never fire.
  function drums(subj, g, bars) {
    const ev = [], N = subj.deg.length;
    for (const [d, vec] of Object.entries(g.kit || {}))
      for (let b = 0; b < bars; b++)
        for (let i = 0; i < N; i++)
          if (at(vec, i)) ev.push({ t: (b * N + i) / g.rate, d, acc: !!subj.acc[i] });
    if (g.ghost) {
      const q = word(subj, g.ghost);
      for (let b = 0; b < bars; b++)
        for (let i = 0; i < N; i++)
          if (q.acc[i] && !q.gate[i]) ev.push({ t: (b * N + i) / g.rate, d: "p", acc: 0 });
    }
    return ev.sort((a, b) => a.t - b.t);
  }

  // ---- the bass IS the harmony, read at low density ------------------------
  // Root motion is the progression, so chords are not a separate stage in the
  // pipeline — they are this object at a different density.
  function bass(subj, g, bars) {
    const ev = [], N = subj.deg.length;
    for (let b = 0; b < bars; b++) {
      const r = harm(subj, g, b);
      for (let i = 0; i < N; i++)
        if (subj.acc[i]) ev.push({ t: (b * N + i) / g.rate, dur: 2 / g.rate, n: mp(r) + 36, r });
    }
    return ev;
  }

  const api = { at, map5, rotate, reverse, transpose, invert, complement,
                crossmap, excerpt, only, word,
                PENT, MODE, ROMAN, pitch, mp, fold, near,
                harm, render, drums, bass };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuKernel = api;
})(typeof window !== "undefined" ? window : globalThis);
