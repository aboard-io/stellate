// tri.js — the tiniest kernel: ONE seed phrase, THREE genres.
// node tri.js

// ===== 1. SUBJECT ===========================================================
// Five parallel cyclic vectors. deg is a PENTATONIC DEGREE INDEX, never a
// pitch — the phrase has to be genre-neutral to survive the dial.
const at   = (v, i) => v[((i % v.length) + v.length) % v.length];
const map5 = (p, f) => ({ deg: f(p.deg), oct: f(p.oct), gate: f(p.gate),
                          acc: f(p.acc), sld: f(p.sld) });

// ===== 2. GROUP — total operators, pattern -> pattern =======================
const rotate    = k      => p => map5(p, v => v.map((_, i) => at(v, i + k)));
const reverse   = ()     => p => { const r = map5(p, v => [...v].reverse());
                                   r.sld = r.sld.map((_, i) => at(r.sld, i + 1));
                                   return r; };           // slide is EDGE-valued
const transpose = k      => p => ({ ...p, deg: p.deg.map(d => d + k) });
const invert    = c      => p => ({ ...p, deg: p.deg.map(d => c - d) });
const complement= k      => p => ({ ...p, [k]: p[k].map(b => (b ? 0 : 1)) });
const crossmap  = (a, b) => p => ({ ...p, [b]: p[a].slice() });   // binary vectors only
const excerpt   = (a, n) => p => map5(p, v => v.map((_, i) => at(v, a + (i % n))));  // LOSSY
const only      = (k, op) => p => ({ ...p, [k]: op(p)[k] });  // one vector at a time
const word      = (p, ws) => ws.reduce((q, op) => op(q), p);

// ===== 3. VOICE SCHEDULE ====================================================
// A song is n copies of the subject, each with an operator word, an entry bar,
// a register, and a realization. Genre is the policy that fills those in.
const PENT  = [0, 3, 5, 7, 10];                      // minor pentatonic
const pitch = d => PENT[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5);
// operators are closed on PATTERNS but not on REGISTER: transposition and
// voice offset compound without bound. Fold into the voice's octave window.
const fold  = (n, c) => { while (n < c - 6) n += 12; while (n > c + 6) n -= 12; return n; };

function render(subj, g, bars) {
  const N = subj.deg.length, ev = [];
  for (let v = 0; v < g.voices; v++) {
    const ctr = 60 + 12 * g.reg(v);
    for (let b = g.entry(v); b < bars; b++) {
      const p = word(subj, g.word(v, b - g.entry(v)));
      const r = harm(subj, g, b);                     // the bar's root
      for (let i = 0; i < N; i++) {
        if (!p.gate[i]) continue;
        const ns = g.realize(v) === 'pad'
          ? [r, r + 2, r + 4].map(mp)                 // chord from HARMONY, not from the note
          : [pitch(p.deg[i]) + 12 * p.oct[i]];
        for (const n of ns)
          ev.push({ t: (b * N + i) / g.rate, dur: 1 / g.rate, v,
                    n: fold(n, ctr), acc: p.acc[i], sld: p.sld[i] });
      }
    }
  }
  return ev.sort((a, b) => a.t - b.t);
}

// ===== 4. GRID — the CATEGORICAL half =======================================
// A kit is voice -> cyclic binary vector. It does NOT derive from the subject:
// four-on-the-floor is a noun, not a transformation. The one exception is the
// ghost layer, where an operator word on the subject's own accent vector leaks
// the seed phrase into the rhythm bed.
function drums(subj, g, bars) {
  const ev = [], N = subj.deg.length;
  for (const [d, vec] of Object.entries(g.kit || {}))
    for (let b = 0; b < bars; b++)
      for (let i = 0; i < N; i++)
        if (at(vec, i)) ev.push({ t: (b * N + i) / g.rate, d, acc: !!subj.acc[i] });
  if (g.ghost) { const q = word(subj, g.ghost);
    for (let b = 0; b < bars; b++)
      for (let i = 0; i < N; i++)
        if (q.acc[i] && !q.gate[i]) ev.push({ t: (b * N + i) / g.rate, d: 'p', acc: 0 }); }
  return ev.sort((a, b) => a.t - b.t);
}
// ===== 5. HARMONY — a MODE, not a layer =====================================
// The subject stays pentatonic (free counterpoint); chords use the full seven-
// note mode. PENT is a subset of MODE, so every subject note lands in-chord.
const MODE = [0, 2, 3, 5, 7, 8, 10];                          // natural minor
const mp   = d => MODE[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
const near = pc => { let b = 0, x = 99; MODE.forEach((m, i) => {
  const t = Math.min((m - pc + 120) % 12, (pc - m + 120) % 12);
  if (t < x) { x = t; b = i; } }); return b; };

function harm(subj, g, bar) {
  if (g.harmony === 'cycle')    return at(g.roots, bar);      // primary: its own cycle
  if (g.harmony === 'emergent') {                             // read off the entry schedule
    const v = Math.min(bar, g.voices - 1);
    const q = word(subj, g.word(v, 0));
    return near((((pitch(q.deg[0]) - pitch(subj.deg[0])) % 12) + 12) % 12);
  }
  return 0;                                                   // modal: no progression
}
// the bass IS the harmony, read at low density: roots on the subject's accents
function bass(subj, g, bars) {
  const ev = [], N = subj.deg.length;
  for (let b = 0; b < bars; b++) { const r = harm(subj, g, b);
    for (let i = 0; i < N; i++)
      if (subj.acc[i]) ev.push({ t: (b * N + i) / g.rate, n: mp(r) + 36, r }); }
  return ev;
}
// ===== end of kernel ========================================================

// ---- the seed phrase (16 steps) -------------------------------------------
const SUBJ = {
  deg:  [0, 3, 2, 0, 4, 3, 0, 2, 5, 3, 0, 4, 2, 0, 3, 1],
  oct:  [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
  gate: [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0],
  acc:  [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  sld:  [0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0],
};

// ---- three genres ----------------------------------------------------------
const GENRES = {
  fugue: {                                   // transform-heavy, staggered entries
    rate: 1, voices: 4,
    entry:   v => v,
    reg:     v => 1 - v,
    realize: () => 'line',
    kit: {}, harmony: 'emergent',            // no drums; harmony falls out of the entries
    word: (v, s) => [
      [[], [rotate(0)], [invert(4)]][s % 3],                       // subject
      [[transpose(3)], [transpose(3), reverse()], [invert(4)]][s % 3],  // answer @ 5th
      [[reverse()], [invert(2)], [transpose(3), rotate(2)]][s % 3],
      [[transpose(-3)], [reverse(), transpose(3)], [invert(4)]][s % 3],
    ][v],
  },
  acid: {                                    // a sequencer: restatement rate ~1
    rate: 1, voices: 2,
    entry:   v => v,
    reg:     v => -1 + v,
    realize: () => 'line',
    kit: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],     // 909, four on the floor
           c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
           o: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
           h: [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1] },
    harmony: 'modal',                        // one mode, twelve minutes
    ghost: [only('acc', rotate(3))],   // accents alone, against an unrotated gate
    word: (v, s) => (v === 0 ? [] : [rotate(4 * s), ...(s % 2 ? [complement('acc')] : [])]),
  },
  vaporwave: {                               // slowed, excerpted, harmonised
    rate: 0.5, voices: 2,
    entry:   () => 0,
    reg:     v => (v === 0 ? -1 : 1),
    realize: v => (v === 0 ? 'pad' : 'line'),
    kit: { k: [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],     // lazy, half-time at rate .5
           s: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
           h: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0] },
    harmony: 'cycle', roots: [3, 4, 2, 5],   // iv v III VI, a 4-cycle against 16 steps
    word: () => [excerpt(2, 8)],
  },
};

// ---- print -----------------------------------------------------------------
const GLYPH = '0123456789abcdefghijklmnopqrstuvwxyz';
function roll(name, cols = 64) {
  const g = GENRES[name], ev = render(SUBJ, g, 8);
  const lo = Math.min(...ev.map(e => e.n));
  console.log(`\n${name.toUpperCase()}  rate=${g.rate} voices=${g.voices} ` +
              `events=${ev.length}  span=${lo}..${Math.max(...ev.map(e => e.n))}`);
  for (let v = 0; v < g.voices; v++) {
    const row = Array(cols).fill('.');
    for (const e of ev.filter(e => e.v === v)) {
      const c = Math.round(e.t);
      const ch = GLYPH[(e.n - lo) % GLYPH.length];
      if (c < cols) row[c] = e.sld ? '~' : e.acc ? ch.toUpperCase() : ch;
    }
    console.log(`  v${v} ${g.realize(v)[0]} |${row.join('')}|`);
  }
  const dr = drums(SUBJ, g, 8), lanes = [...new Set(dr.map(e => e.d))];
  for (const d of lanes) {
    const row = Array(cols).fill('.');
    for (const e of dr.filter(e => e.d === d)) {
      const c = Math.round(e.t);
      if (c < cols) row[c] = e.acc ? d.toUpperCase() : d;
    }
    console.log(`  ${d}      |${row.join('')}|`);
  }
  if (!lanes.length) console.log('  (no kit)');
  const brow = Array(cols).fill('.');
  for (const e of bass(SUBJ, g, 8)) { const c = Math.round(e.t);
    if (c < cols) brow[c] = 'IiVvXxL'[e.r]; }
  console.log(`  bass   |${brow.join('')}|  harmony=${g.harmony}`);
}
['fugue', 'acid', 'vaporwave'].forEach(n => roll(n));
