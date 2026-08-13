// kernel.js — the nukernel ALGEBRA. Pure, total, zero dependencies (UMD like
// every engine file). No I/O, no DOM, no audio, no genre data: generators and
// transformers only, so the ASCII printer (tri.js) and the browser DAW
// (kernel-daw.js) wrap exactly the same code instead of each carrying a copy.
//
// A PATTERN is five parallel CYCLIC vectors of equal length:
//   deg   scale degree — SIGNED and unbounded. Negative walks below the tonic,
//         >len wraps into the octave above. Never an absolute pitch, so the
//         same phrase survives being read in any genre or any scale.
//   oct   octave displacement — SIGNED, typically -2..+2
//   vel   velocity 0..9 — CONTINUOUS level, the dynamics of the line
//   gate  note or rest                   (binary)
//   acc   accent                         (binary)
//   sld   slide INTO this step           (binary, EDGE-valued — see reverse)
//
// vel and acc are NOT the same knob. vel is how loud; acc is the 303's accent,
// a categorical flag that opens the filter and that operators key on (the ghost
// layer is `only("acc", …)`). Level is continuous, accent is an event.
//
// TWO TYPES, not one: deg/oct/vel are integers, gate/acc/sld are binary. The
// binary-only operators (`complement`, `crossmap`) are meaningless on the
// integer pair — complementing an octave of -1 is not a musical idea. Every
// other operator is type-agnostic because it only permutes positions.
//
// Every operator is TOTAL: pattern in, valid pattern out, no failure modes and
// nothing to validate. That is what keeps the algebra small enough to search.
(function (root) {
  "use strict";

  // ---- indexing ------------------------------------------------------------
  // Patterns are necklaces, not lists: they have no ends. Every read is cyclic.
  const at = (v, i) => v[((i % v.length) + v.length) % v.length];
  const mapv = (p, f) => ({ deg: f(p.deg), oct: f(p.oct), vel: f(p.vel || p.gate.map(() => 5)),
                            gate: f(p.gate), acc: f(p.acc), sld: f(p.sld) });

  // ---- the group -----------------------------------------------------------
  const rotate = k => p => mapv(p, v => v.map((_, i) => at(v, i + k)));

  // Retrograde is NOT `reverse` on all five vectors. deg/oct/gate/acc live on
  // steps; sld lives on the TRANSITION INTO a step, i.e. on edges, not nodes.
  // Reversing the node vectors and the edge vector the same way leaves every
  // slide attached to the wrong side of its transition. Hence the shift.
  const reverse = () => p => {
    const r = mapv(p, v => [...v].reverse());
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
  const excerpt = (a, n) => p => mapv(p, v => v.map((_, i) => at(v, a + (i % n))));

  // SPREAD — scale every degree's distance from a pivot. k>1 widens the
  // intervals, k<1 narrows them, k=0 flattens to a monotone. It is the same
  // family as invert: reflection about a pivot p is 2p-d, so invert(c) is
  // exactly spread(-1, c/2). Rounding makes it lossy, so spread(2) then
  // spread(0.5) is close to but not always the identity.
  //
  // Note what this does NOT do: it moves the notes within the alphabet, so the
  // chromatic result depends on which scale the phrase is read through. To
  // change the chromatic width WITHOUT touching the notes, change the scale —
  // width per degree-step is exactly 12 / (notes in the scale).
  const spread = (k, c = 0) => p =>
    ({ ...p, deg: p.deg.map(d => Math.round(c + (d - c) * k)) });

  // The discipline that keeps a subject recognizable: move ONE vector at a
  // time. Without this combinator that discipline is not even expressible —
  // every operator above rewrites all five at once.
  const only = (k, op) => p => ({ ...p, [k]: op(p)[k] });

  // DENSITY — the thinning/filling pair. Both are gate masks and both are LOSSY:
  // after either you cannot tell which gates were originally set, so they are
  // not inverses of each other. drop(3) then fill(3) is not the identity.
  //
  // fill is the more interesting half. A rest still carries a DEGREE — the deg
  // vector has a value at every step, gated or not — so filling does not invent
  // notes, it uncovers ones the phrase was already holding silent.
  //
  // n = 1 is degenerate at both ends: drop(1) is silence, fill(1) is every step.
  // They are the annihilator and the unit of this family rather than variations,
  // which is worth knowing before reaching for them — though drop(1) is useful
  // precisely BECAUSE it is total: it silences the line and leaves the kit
  // playing, which is a breakdown.
  const drop = n => p => ({ ...p, gate: p.gate.map((g, i) => ((i + 1) % n === 0 ? 0 : g)) });
  const fill = n => p => ({ ...p, gate: p.gate.map((g, i) => ((i + 1) % n === 0 ? 1 : g)) });

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

  // The subject's alphabet is a GENRE fact, not a constant: blues needs the
  // flat five, and the blue note is a passing tone the pentatonic cannot say.
  const pitch = (d, sc = PENT) =>
    sc[((d % sc.length) + sc.length) % sc.length] + 12 * Math.floor(d / sc.length);
  // MODE is overridable per genre or per section, the same way `scale` is: the
  // subject's alphabet and the chords' alphabet are separate decisions.
  const mp = (d, md = MODE) =>
    md[((d % md.length) + md.length) % md.length] + 12 * Math.floor(d / md.length);

  // The operators are closed on PATTERNS but NOT on REGISTER: transposition
  // and per-voice offset compound without bound, so a four-voice fugue answered
  // at the fifth walks off the keyboard. Fold into the voice's octave window —
  // octave-equivalence as a quotient, and it is a requirement, not a polish.
  //
  // FOLD THE LINE, NOT THE NOTE. Folding each note separately into a thirteen-
  // semitone window bounds the register but also destroys every interval wider
  // than an octave — a phrase whose intervals are doubled comes out NARROWER,
  // because the wide leaps wrap. So register the whole line: take the mean of
  // its degree-pitches, shift by whole octaves until that mean sits in the
  // voice's window, and leave the intervals exactly as written.
  //
  // The mean is taken over the DEGREE pitches only, before the step's octave
  // displacement is added. Include oct and the shift simply cancels it out, and
  // the oct vector goes dead again. Per-note fold survives for pad CHORDS,
  // where wrapping a voicing into a register is the right thing.
  const fold = (n, c) => { while (n < c - 6) n += 12; while (n > c + 6) n -= 12; return n; };

  // nearest mode degree to a pitch class — how a transposition becomes a root
  const near = (pc, md = MODE) => {
    let b = 0, x = 99;
    md.forEach((m, i) => {
      const t = Math.min((m - pc + 120) % 12, (pc - m + 120) % 12);
      if (t < x) { x = t; b = i; }
    });
    return b;
  };

  // SWING bends the grid instead of permuting it — the first transformation
  // here that is not a rearrangement of steps. Delays every odd sixteenth by
  // `g.swing` of a step; 1/3 is a triplet shuffle.
  // Absent vel reads as 5 (mezzo), so a phrase written before velocity existed
  // renders exactly as it did.
  const vel = (p, i) => (p.vel ? p.vel[i] : 5);

  const swing = (g, i) => (i % 2) * (g.swing || 0);

  // ---- harmony: a MODE, not a layer ---------------------------------------
  // Where the roots come from is itself a genre fact, and there are only three
  // sources: read them off the entry schedule, don't have any, or carry an
  // independent cycle. Two of the three need no stored data at all.
  function harm(subj, g, bar) {
    if (g.harmony === "cycle") return at(g.roots, bar);
    if (g.harmony === "emergent") {
      const md = g.mode || MODE;
      // transposition of the subject IS modulation: an answer at the fifth is
      // the dominant because that is what an answer at the fifth means.
      //
      // Read the word the newest voice is playing AT THIS BAR, not the one it
      // entered with. Reading the entry word froze the roots the moment every
      // voice was in, which is true of an exposition and false of everything
      // after it — an eight-bar fugue used to sit on one chord from bar 4.
      const v = Math.min(bar, g.voices - 1), sc = g.scale || PENT;
      const q = word(subj, g.word(v, Math.max(0, bar - g.entry(v))));
      return near((((pitch(q.deg[0], sc) - pitch(subj.deg[0], sc)) % 12) + 12) % 12, md);
    }
    return 0;                                            // modal: no motion
  }

  // ---- the voice schedule --------------------------------------------------
  // A song is n copies of the subject, each with an operator word, an entry
  // bar, a register and a realization. One mechanism covers both ends of the
  // dial: a fugue staggers entries and transforms each; acid layers entries
  // and transforms none.
  // A note lasts until the next gated step, not one step. The gate vector
  // already carries the rhythm; reading duration off it is what turns a row of
  // uniform 16ths into a phrase with long and short notes. A note whose
  // SUCCESSOR slides is held full length (that is what a slide is on a 303);
  // everything else gets a hair of separation. Pads hold to the next chord.
  const spans = gate => {
    const N = gate.length, on = [];
    for (let i = 0; i < N; i++) if (gate[i]) on.push(i);
    const out = new Array(N).fill(0);
    if (!on.length) return out;
    on.forEach((i, k) => {
      let d = on[(k + 1) % on.length] - i;
      if (d <= 0) d += N;
      out[i] = d;
    });
    return out;
  };

  function render(subj, g, bars) {
    const N = subj.deg.length, ev = [];
    for (let v = 0; v < g.voices; v++) {
      const ctr = 60 + 12 * g.reg(v), pad = g.realize(v) === "pad",
            sc = g.scale || PENT, md = g.mode || MODE;
      for (let b = g.entry(v); b < bars; b++) {
        const p = word(subj, g.word(v, b - g.entry(v))), r = harm(subj, g, b);
        const sp = spans(p.gate);
        // one octave shift for the whole line, from its degree-pitch mean
        const on = [];
        for (let i = 0; i < N; i++) if (p.gate[i]) on.push(pitch(p.deg[i], sc));
        const mean = on.length ? on.reduce((a, b2) => a + b2, 0) / on.length : 0;
        const shift = 12 * Math.round((ctr - mean) / 12);
        // A PAD IS ONE CHORD PER BAR, HELD. Firing it on every gated step of the
        // phrase re-triggered the same three pitches sixteen times a bar, which
        // reads as a stutter rather than a pad — the harmony only changes at the
        // bar, so that is where the chord belongs.
        if (pad) {
          const first = p.gate.findIndex(Boolean);
          if (first >= 0)
            for (const n of [r, r + 2, r + 4].map(d => mp(d, md)))
              ev.push({ t: (b * N) / g.rate, dur: N / g.rate, v,
                        n: fold(n, ctr), acc: 0, sld: 0, vel: vel(p, first) });
          continue;
        }
        for (let i = 0; i < N; i++) {
          if (!p.gate[i]) continue;
          const steps = sp[i];
          const legato = pad || p.sld[(i + steps) % N] ? 1 : 0.92;
          const ns = [null];                             // pitched: registered below
          for (const n of ns) {
            const pitchOf = n == null
              ? pitch(p.deg[i], sc) + shift + 12 * p.oct[i]      // line registered, THEN leap
              : fold(n, ctr);                                    // chords voice per note
            ev.push({ t: (b * N + i + swing(g, i)) / g.rate, dur: steps * legato / g.rate, v,
                      n: pitchOf, acc: p.acc[i], sld: p.sld[i], vel: vel(p, i) });
          }
        }
      }
    }
    return ev.sort((a, b) => a.t - b.t);
  }

  // KIT OPERATORS. The kit is genre DATA, not a pattern, so these are kit->kit
  // rather than pattern->pattern — a fourth type, and they belong here beside
  // drums() rather than in the pattern group where they would silently do
  // nothing to the melody.
  const mapKit = (k, f) => Object.fromEntries(
    Object.entries(k || {}).map(([d, v]) => [d, f(v, d)]));
  const KITOPS = {
    nodrums:  () => ({}),
    shift:    k => mapKit(k, v => v.map((_, i) => at(v, i + 2))),
    halftime: k => mapKit(k, (v, d) => v.map((x, i) => ((d === "k" || d === "s") && i % 8 !== 0 ? 0 : x))),
    busy:     k => mapKit(k, (v, d) => (d === "h" || d === "o" ? v.map(() => 1) : v)),
  };

  // ---- the grid: the CATEGORICAL half --------------------------------------
  // A kit is voice -> cyclic binary vector, and it does NOT derive from the
  // subject: four-on-the-floor is a noun, not a transformation. Measured on
  // this kernel, those literal vectors carry more genre identity than the whole
  // operator set does. The ghost layer is the one seam where the seed phrase
  // reaches the rhythm bed — and it needs `only`, because accents are a subset
  // of gates by construction, so any whole-pattern operator preserves that
  // containment and the layer can never fire.
  // A kit repeated bar after bar is one bar, not a loop. `fill` is a partial
  // kit merged over the base on the LAST bar of the loop — the standard three-
  // bars-and-a-fill phrase, and the reason the drums have a four-bar shape
  // rather than a one-bar shape.
  function drums(subj, g, bars) {
    const ev = [], N = subj.deg.length;
    for (let b = 0; b < bars; b++) {
      const kit = (g.fill && b === bars - 1) ? { ...g.kit, ...g.fill } : (g.kit || {});
      for (const [d, vec] of Object.entries(kit))
        for (let i = 0; i < N; i++)
          if (at(vec, i)) ev.push({ t: (b * N + i + swing(g, i)) / g.rate, d, acc: !!subj.acc[i],
                                    vel: vel(subj, i),
                                    fill: b === bars - 1 && !!(g.fill && g.fill[d]) });
    }
    if (g.ghost) {
      const q = word(subj, g.ghost);
      for (let b = 0; b < bars; b++)
        for (let i = 0; i < N; i++)
          if (q.acc[i] && !q.gate[i])
            ev.push({ t: (b * N + i + swing(g, i)) / g.rate, d: "p", acc: 0, vel: vel(q, i) });
    }
    return ev.sort((a, b) => a.t - b.t);
  }

  // ---- the bass IS the harmony, read at low density ------------------------
  // Root motion is the progression, so chords are not a separate stage in the
  // pipeline — they are this object at a different density.
  function bass(subj, g, bars) {
    if (g.nobass) return [];              // a genre may simply not have a bass part
    const ev = [], N = subj.deg.length;

    // WALKING — quarter notes that arrive somewhere. Root, third, fifth, then a
    // chromatic approach a semitone under the NEXT bar's root, which is why it
    // needs to look one bar ahead: a walking line is defined by where it is
    // going, not by the chord it is sitting on.
    const md = g.mode || MODE;
    if (g.bassStyle === "walk") {
      for (let b = 0; b < bars; b++) {
        const r = harm(subj, g, b), nx = harm(subj, g, (b + 1) % bars);
        // alternate the direction of the middle two so three bars of one chord
        // do not walk the identical line three times
        const mid = b % 2 === 0 ? [mp(r + 2, md), mp(r + 4, md)] : [mp(r + 4, md), mp(r + 2, md)];
        const tones = [mp(r, md), mid[0], mid[1], mp(nx, md) - 1];
        tones.forEach((n, q) =>
          ev.push({ t: (b * N + q * 4) / g.rate, dur: 3.7 / g.rate, n: n + 36, r,
                    walk: true, vel: q === 0 ? 7 : 5 }));
      }
      return ev;
    }

    // The root bass borrows its rhythm from the melody's ACCENTS, which reads
    // well until the melody has none — then the bass vanishes entirely, and an
    // empty or cleared phrase has none by definition. A bass part should not
    // depend on the tune being emphatic, so fall back to the genre's own pulse
    // (quarter notes unless it says otherwise). With accents present this is
    // byte-identical to before.
    const QUARTERS = [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0];
    const grid = subj.acc.some(Boolean) ? subj.acc : (g.bassGrid || QUARTERS);
    const sp = spans(grid);                                     // holds to the next hit
    let alt = 0;
    for (let b = 0; b < bars; b++) {
      const r = harm(subj, g, b);
      for (let i = 0; i < N; i++)
        if (at(grid, i)) {
          const oct = g.bassStyle === "octaves" ? 12 * (alt++ % 2) : 0;
          ev.push({ t: (b * N + i + swing(g, i)) / g.rate, dur: sp[i] * 0.94 / g.rate,
                    n: mp(r, md) + 36 + oct, r, vel: vel(subj, i) });
        }
    }
    return ev;
  }

  // ---- ENVELOPES — a different type from operators --------------------------
  // An operator is pattern -> pattern and TIMELESS: it cannot know where it is.
  // A fade is a function of POSITION IN THE SECTION, so it cannot be one. These
  // act on the rendered EVENT STREAM instead, scaling the velocity vector that
  // now exists to be scaled. Operators compose by application; envelopes
  // compose by multiplication. Keeping them in one list would be the same
  // mistake as treating slide as node-valued: one notation, two types.
  const envelope = (ev, kind, span) => {
    if (!kind || !span) return ev;
    return ev.map(e => {
      const x = Math.min(1, Math.max(0, e.t / span));
      const f = kind === "in" ? x : kind === "out" ? 1 - x : 1;
      return { ...e, vel: Math.max(0, Math.round((e.vel == null ? 5 : e.vel) * f)) };
    });
  };

  const api = { at, mapv, spans, vel, drop, fill, spread, envelope, KITOPS, mapKit, swing, rotate, reverse, transpose, invert, complement,
                crossmap, excerpt, only, word,
                PENT, MODE, ROMAN, pitch, mp, fold, near,
                harm, render, drums, bass };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuKernel = api;
})(typeof window !== "undefined" ? window : globalThis);
