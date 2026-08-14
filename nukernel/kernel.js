// kernel.js — the nukernel ALGEBRA. Pure, total, zero dependencies (UMD like
// every engine file). No I/O, no DOM, no audio, no genre data: generators and
// transformers only, so the ASCII printer (tri.js) and the browser DAW
// (ui/ + audio/ modules, entry ui/main.js) wrap exactly the same code instead
// of each carrying a copy.
//
// A PATTERN is five parallel CYCLIC vectors of equal length:
//   deg   scale degree — SIGNED and unbounded. Negative walks below the tonic,
//         >len wraps into the octave above. Never an absolute pitch, so the
//         same phrase survives being read in any genre or any scale.
//   oct   octave displacement — SIGNED, typically -2..+2
//   vel   velocity 0..9 — CONTINUOUS level, the dynamics of the line
//   inc   per-step RAMP: this step climbs inc[i] scale degrees every loop
//   stk   per-step STICKY: the WHOLE sequence climbs sum(stk) degrees a loop
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
  const Z = p => p.gate.map(() => 0);
  const mapv = (p, f) => ({ deg: f(p.deg), oct: f(p.oct), vel: f(p.vel || p.gate.map(() => 5)),
                            inc: f(p.inc || Z(p)), stk: f(p.stk || Z(p)),
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

  // LIST OPERATIONS. repeat and del change the SEQUENCE, not just its gates —
  // they stretch and close it, and every vector moves together, which is why
  // they are mapv and not a gate mask. drop left a hole where a note had been;
  // del closes the hole and drags the rest of the phrase forward, which is what
  // makes it worth having. Both re-cycle to the original length, so a pattern is
  // always the same sixteen steps and the operators stay closed.
  // SPLIT, not repeat. Duplicating an element in the list cannot re-attack a
  // note that is being HELD — under legato or tie the copy is swallowed by the
  // note it duplicates and nothing is heard. Splitting works on DURATION
  // instead: a note lasting s steps becomes n attacks of s/n, which is audible
  // whatever the articulation, and is what an arpeggiator actually does.
  //
  // A note is subdivided as far as it will GO: asking for eight attacks inside
  // a two-step note gives two, not nothing. Skipping instead left every chip
  // above `split 2` looking dead on an ordinary phrase.
  // THE SUBDIVISIONS CLIMB. A split note's copies are not copies: the step's own
  // ramp is applied ONCE PER REPEAT, so a note carrying inc +1 split four ways
  // plays d, d+1, d+2, d+3 — which is what an arpeggiator does, and what anyone
  // who set a ramp and then split the note was plainly asking for. Before this,
  // every subdivision sat on the same degree and inc only moved them together on
  // the NEXT loop, so the two features could not be combined: the ramp was a
  // property of the step and split made more steps, and nothing joined them up.
  // A step with inc 0 is byte-identical to before.
  const split = n => p => {
    if (n <= 1) return mapv(p, v => v.slice());
    const N = p.gate.length, sp = spans(p.gate), out = mapv(p, v => v.slice());
    for (let i = 0; i < N; i++) {
      if (!p.gate[i] || sp[i] < 2) continue;
      const parts = Math.min(n, sp[i]), step = p.inc ? p.inc[i] : 0;
      for (let k = 1; k < parts; k++) {
        const j = (i + Math.round((k * sp[i]) / parts)) % N;
        if (out.gate[j]) continue;                 // never overwrite a real note
        out.gate[j] = 1;
        out.deg[j] = p.deg[i] + k * step;          // the k-th repeat, k increments up
        out.oct[j] = p.oct[i]; out.vel[j] = p.vel ? p.vel[i] : 5;
        out.inc[j] = step; out.stk[j] = p.stk ? p.stk[i] : 0;
        out.acc[j] = 0; out.sld[j] = 0;            // a subdivision is not an accent
      }
    }
    return out;
  };
  const del = n => p => mapv(p, v => {
    const out = v.filter((_, i) => n <= 1 || (i + 1) % n !== 0);
    return out.length ? v.map((_, i) => out[i % out.length]) : v.map(() => 0);
  });

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

  // ROMAN NUMERALS ARE DERIVED, NOT DECLARED. The old list was a hardcoded
  // natural-minor table, which lied about every other mode — a major chord in
  // ionian read out as "i". Case and the °/+ marks come from each degree's own
  // third and fifth, so the readout is honest in any alphabet. ROMAN keeps its
  // name and its exact minor values (gated) for everything already reading it.
  const romanOf = md => {
    const NUM = ["I", "II", "III", "IV", "V", "VI", "VII"];
    return md.map((_, i) => {
      const third = mp(i + 2, md) - mp(i, md), fifth = mp(i + 4, md) - mp(i, md);
      const base = NUM[i % 7] || String(i + 1);
      return (third === 4 ? base : base.toLowerCase()) +
             (fifth === 6 ? "°" : fifth === 8 ? "+" : "");
    });
  };
  const ROMAN = romanOf(MODE);

  // SWING bends the grid instead of permuting it — the first transformation
  // here that is not a rearrangement of steps. Delays every odd sixteenth by
  // `g.swing` of a step; 1/3 is a triplet shuffle.
  // Absent vel reads as 5 (mezzo), so a phrase written before velocity existed
  // renders exactly as it did.
  const vel = (p, i) => (p.vel ? p.vel[i] : 5);

  // THE RAMP. inc[i] moves THIS step every loop; stk moves the WHOLE sequence
  // every loop, by the sum of its column. Both accumulate with the loop index,
  // which is what makes a sixteen-step phrase into an arpeggio that goes
  // somewhere — and why the clamp matters: unclamped, inc 1 on four steps walks
  // off the instrument inside a minute.
  // WHAT HAPPENS AT THE LIMIT is a third choice, and the three are genuinely
  // different shapes rather than three strengths of the same one:
  //   hold     the ramp stops and stays        (a rise that settles)
  //   loop     it snaps back to zero and climbs again   (a sawtooth)
  //   reverse  it turns round and comes back   (a triangle, a ping-pong)
  // Sign is carried outside the folding so a descending ramp mirrors an
  // ascending one exactly.
  // `src` is the phrase AS WRITTEN. inc is explicitly per-step, so operators
  // permuting it is correct — but stk describes the WHOLE SEQUENCE's drift per
  // loop, and letting an operator move it makes the drift erratic: vaporwave's
  // moving excerpt window carried the sticky column out of the pattern on two
  // bars in four, so the ramp went 0, 0, 0, 6 — a lurch instead of a climb.
  const rampOf = (p, i, loop, clamp, mode, src) => {
    const st = (src || p).stk;
    const stick = st ? st.reduce((a, x) => a + x, 0) : 0;
    const raw = ((p.inc ? p.inc[i] : 0) + stick) * loop;
    if (!clamp) return raw;
    const sign = raw < 0 ? -1 : 1, mag = Math.abs(raw);
    if (mode === "loop") return sign * (mag % (clamp + 1));
    if (mode === "reverse") {
      const t = mag % (2 * clamp);
      return sign * (t > clamp ? 2 * clamp - t : t);
    }
    return sign * Math.min(clamp, mag);
  };

  const swing = (g, i) => (i % 2) * (g.swing || 0);

  // ---- GROOVE: the part of a performance that is not in the notes -----------
  // Swing bends the grid. GROOVE bends the grid AND the dynamics, per sixteenth,
  // as a repeating sixteen-slot fingerprint — some steps arrive a hair late, some
  // arrive louder, and the pattern of which is the difference between a drum
  // machine and a drummer. Two vectors per profile:
  //
  //   vel   a multiplier on the step's velocity   (1 = as written)
  //   push  a shift in FRACTIONS OF A STEP        (+ late, − early, 0 = on the grid)
  //
  // `dub` is not invented: it is the mined per-16th velocity profile out of
  // engine/pipes.js ACCENT_PROFILES, measured off the MIDIMAN dub rip, and it is
  // the one family in that corpus that carried real signal (jazz and folk
  // velocities measured flat — the negative result is recorded in pipes.js).
  // The rest are written, and say so.
  const GROOVES = {
    // the backbeat lean: 2 and 4 loud, the ands soft, nothing moved
    backbeat: { vel: [1.06,0.82,0.94,0.84, 1.12,0.8,0.96,0.84, 1.0,0.82,0.94,0.84, 1.14,0.8,0.98,0.86] },
    // PUSH — the sixteenth before each beat arrives early and hard. This is the
    // one that makes a straight pattern feel like it is leaning forwards.
    push: { vel: [1.0,0.78,0.88,1.05, 1.0,0.78,0.88,1.05, 1.0,0.78,0.88,1.05, 1.0,0.78,0.88,1.08],
            push: [0,0,0,-0.18, 0,0,0,-0.18, 0,0,0,-0.18, 0,0,0,-0.22] },
    // LAID BACK — everything off the beat drags. A whole style of playing, and
    // it is four numbers.
    laidback: { vel: [1.05,0.8,0.9,0.8, 1.0,0.8,0.92,0.8, 1.02,0.8,0.9,0.8, 1.0,0.8,0.92,0.82],
                push: [0,0.14,0.08,0.14, 0.03,0.14,0.08,0.14, 0,0.14,0.08,0.14, 0.03,0.14,0.08,0.16] },
    // FUNK — the sixteenths carry it, and the ghosts between them are what you
    // hear as the groove even though they are the quietest thing in the bar.
    funk: { vel: [1.15,0.6,0.9,0.66, 1.0,0.62,0.95,0.6, 1.1,0.6,0.88,0.68, 1.0,0.62,0.98,0.7],
            push: [0,0.06,-0.04,0.06, 0,0.06,-0.04,0.06, 0,0.06,-0.04,0.06, 0,0.06,-0.04,0.06] },
    dub: { vel: [1.089,0.822,1.052,0.899, 1.076,0.777,1.065,0.843,
                 1.083,0.852,1.063,0.877, 1.064,0.72,1.042,0.836],
           push: [0,0.1,0.02,0.1, 0,0.1,0.02,0.1, 0,0.1,0.02,0.1, 0,0.1,0.02,0.12] },
  };
  // Applied to the RENDERED stream, because it is a function of where a note
  // lands on the grid and an operator cannot know that. `barSteps` is the bar in
  // this genre's own step units, so a half-time genre grooves at half the rate —
  // which is correct: groove is a feel per BAR, not per sixteenth of a second.
  // `amount` fades the whole thing in, so it is a dial and not a switch.
  const groove = (ev, name, barSteps, amount) => {
    const G = GROOVES[name];
    if (!G || !barSteps) return ev;
    const amt = amount == null ? 1 : Math.max(0, Math.min(1, amount));
    if (!amt) return ev;
    const unit = barSteps / 16;
    return ev.map(e => {
      const slot = ((Math.round((e.t % barSteps) / unit) % 16) + 16) % 16;
      const vm = G.vel ? 1 + amt * (G.vel[slot] - 1) : 1;
      const pu = G.push ? amt * G.push[slot] * unit : 0;
      const out = { ...e, t: Math.max(0, e.t + pu) };
      if (e.vel != null) out.vel = Math.max(0, Math.min(9, Math.round(e.vel * vm)));
      return out;
    }).sort((a, b) => a.t - b.t);
  };

  // ---- PIPES: the SEVENTH type ----------------------------------------------
  // Timeless AND pitch-aware, and nothing else in the system is both. An
  // operator runs before pitch exists and is alphabet-relative; an envelope is
  // position-dependent and level-only (drop/stutter are CUTS — they duplicate
  // or delete, never compute a new pitch); an edge is bounded to one bar;
  // groove moves time and level per 16th; a bar schedule is pre-render. A pipe
  // transforms the RENDERED stream knowing what is sounding — parallel harmony
  // locked to the actual chord, imitation, humanized pads — the class of idea
  // that is structurally unreachable anywhere earlier in the pipeline. The
  // vocabulary is the house's own (engine/pipes.js, docs/MUSIC-MIND.md), so
  // the design argument was settled upstream.
  //
  // Every pipe is TOTAL (unknown id = skipped) and SEEDED (the same mulberry32
  // the composer uses — reproducibility, not cryptography): two renders of one
  // state are byte-identical, which section 4 of the gate holds against.
  const prng = s => {
    let a = (s >>> 0) || 1;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const PIPES = {
    // a chord-locked third/sixth above the line — chord-locked precisely
    // because pitch only exists post-render; transpose(2) is scale-parallel
    // and clashes, which is the whole reason this is a pipe and not an operator
    harmonize(ev, ctx, o, rnd) {
      const add = [];
      for (const e of ev) {
        if (e.part === "pad" || e.d) continue;
        if (rnd() >= (o.p == null ? 0.6 : o.p)) continue;
        const c = ctx.chordFor(e);
        let n = e.n + (o.gap === "sixth" ? 8 : 3), guard = 0;
        while (!c.pcSet.has(((n % 12) + 12) % 12) && guard++ < 12) n++;
        add.push({ ...e, n, vel: Math.max(1, (e.vel == null ? 5 : e.vel) - 2),
                   acc: 0, sld: 0, pipe: "harmonize" });
      }
      return add.length ? ev.concat(add) : ev;
    },
    // a delayed, quieter, register-dropped copy, clipped to its own chord bar
    // so the imitation never smears across a harmony change
    echoCanon(ev, ctx, o) {
      const d = (o.delay == null ? 3 : o.delay) / ctx.rate, add = [];
      for (const e of ev) {
        if (e.d || e.part === "pad") continue;
        const barEnd = (Math.floor(e.t * ctx.rate / ctx.stepsPerBar) + 1) *
                       ctx.stepsPerBar / ctx.rate;
        if (e.t + d >= barEnd) continue;
        add.push({ ...e, t: e.t + d, dur: Math.min(e.dur, barEnd - (e.t + d)),
                   n: e.n - 12, acc: 0, sld: 0, pipe: "echoCanon", echoOf: e.t,
                   vel: Math.max(1, Math.floor((e.vel == null ? 5 : e.vel) * 0.6)) });
      }
      return add.length ? ev.concat(add) : ev;
    },
    // the event-stream twin of maxHold, for material whose notes are already
    // fixed: the last note of each voice's bar stops short of the bar line
    breathe(ev, ctx) {
      const last = new Map();
      for (const e of ev) {
        if (e.d) continue;
        const k = (e.v || 0) + ":" + Math.floor(e.t * ctx.rate / ctx.stepsPerBar);
        const p = last.get(k);
        if (!p || e.t > p.t) last.set(k, e);
      }
      const cut = new Set(last.values());
      return ev.map(e => {
        if (!cut.has(e) || e.dur == null) return e;
        const barEnd = (Math.floor(e.t * ctx.rate / ctx.stepsPerBar) + 1) *
                       ctx.stepsPerBar / ctx.rate;
        const cap = Math.max(0.25 / ctx.rate, barEnd - e.t - 0.5 / ctx.rate);
        return e.dur > cap ? { ...e, dur: cap, pipe: "breathe" } : e;
      });
    },
    // pad voices leave the grid by a few hairs, direction alternating per
    // chord — a keyboard player's hand, not a chord stamp
    strum(ev, ctx, o) {
      const groups = new Map();
      ev.forEach((e, i) => {
        if (e.part !== "pad") return;
        const k = (e.v || 0) + "@" + e.t;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(i);
      });
      if (!groups.size) return ev;
      const out = ev.slice(); let gi = 0;
      const sprd = (o.spread == null ? 0.06 : o.spread) / ctx.rate;
      for (const idx of groups.values()) {
        const order = [...idx].sort((a, b) => ev[a].n - ev[b].n);
        if (gi % 2) order.reverse();                    // down-strum every other chord
        order.forEach((i, k) => { out[i] = { ...ev[i], t: ev[i].t + k * sprd }; });
        gi++;
      }
      return out;
    },
  };
  function pipes(ev, list, ctx0) {
    if (!list || !list.length) return ev;
    const cache = new Map();
    const ctx = { ...ctx0, chordFor(e) {
      const step = e.t * ctx0.rate, bar = Math.floor(step / ctx0.stepsPerBar);
      let cs = cache.get(bar);
      if (!cs) { cs = ctx0.chords(bar); cache.set(bar, cs); }
      const s = ((step % ctx0.stepsPerBar) + ctx0.stepsPerBar) % ctx0.stepsPerBar;
      return cs.find(c => s >= c.start && s < c.start + c.len) || cs[cs.length - 1];
    } };
    let out = ev;
    list.forEach((op, i) => {
      const f = PIPES[op.id];
      if (!f) return;                                    // total: unknown = skipped
      out = f(out, ctx, op, prng(((op.seed || 0) + 1) * 0x9E3779B9 + i + 1));
    });
    return out === ev ? ev : [...out].sort((a, b) => a.t - b.t);
  }

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

  // ---- the CHORD LAYER: a progression is chord OBJECTS, not bar-indexed roots
  // `g.roots` says WHERE the harmony goes and nothing about WHAT sounds there —
  // every chord was a bare mode triad, voiced statelessly, one per bar. `g.prog`
  // is the richer statement: an array of BARS, each bar one chord object or a
  // list of them — { d: root degree, q: quality, inv: inversion, borrow:
  // semitone offset on the root, beats: length in steps }. A genre without a
  // `prog` gets the DEGENERATE progression synthesized from harm(): triads,
  // root position, one to the bar — byte-identical to what it played before,
  // which is the house law for every new field.
  //
  // WHY THIS IS NOT ONE OF THE FIVE TYPES. An operator is timeless and
  // alphabet-relative and never sees a chord; an envelope is post-render and
  // level-only; an edge rewrites one bar at a known end; groove is a per-16th
  // fingerprint; a genre override substitutes an existing field wholesale. A
  // progression is new DATA with its own internal grammar — quality, inversion,
  // borrow, duration — read by three different renderers (pad, bass, melody),
  // which no substitution or transform of existing fields can say.
  //
  // QUALITY comes in two spellings on purpose. The DIATONIC qualities walk the
  // mode in degree steps, so "7" takes whatever seventh the mode owns — i7 in
  // minor, Imaj7 in ionian — and the chord can never leave the key. The
  // CHROMATIC qualities (maj7 / m7 / dom7) are absolute semitone stacks on the
  // root, because they are requests for a specific colour the mode may not
  // contain: dom7 is the one deliberate exit, the V7 that natural minor cannot
  // spell and every cadence wants.
  const QSTEPS = { triad: [0, 2, 4], "7": [0, 2, 4, 6], nine: [0, 2, 4, 6, 8],
                   sus4: [0, 3, 4], six: [0, 2, 4, 5] };
  const QFIX = { maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dom7: [0, 4, 7, 10] };

  // chordsOf(subj, g, bar) -> [{start, len, deg, q, inv, borrow, rootPc,
  // bassPc, pcs[], pcSet}] — the bar's chords with their step windows. beats
  // are steps of the pattern; unstated chords split the bar evenly and the
  // last chord absorbs the remainder, so the bar is always exactly covered.
  function chordsOf(subj, g, bar) {
    const md = g.mode || MODE, N = subj.deg.length;
    const one = c => ({ ...c, pcSet: new Set(c.pcs.map(n => ((n % 12) + 12) % 12)) });
    if (!g.prog || g.harmony !== "cycle") {
      const r = harm(subj, g, bar);
      return [one({ start: 0, len: N, deg: r, q: "triad", inv: 0, borrow: 0,
                    rootPc: mp(r, md), bassPc: mp(r, md),
                    pcs: [r, r + 2, r + 4].map(d => mp(d, md)) })];
    }
    const slot = at(g.prog, bar), list = Array.isArray(slot) ? slot : [slot];
    const out = []; let cursor = 0;
    list.forEach((c, i) => {
      const left = list.length - 1 - i;
      const len = i === list.length - 1 ? N - cursor
        : Math.max(1, Math.min(c.beats || Math.round(N / list.length), N - cursor - left));
      const root = mp(c.d || 0, md) + (c.borrow || 0);
      const pcs = QFIX[c.q] ? QFIX[c.q].map(x => root + x)
        : (QSTEPS[c.q] || QSTEPS.triad).map(s => mp((c.d || 0) + s, md) + (c.borrow || 0));
      out.push(one({ start: cursor, len, deg: c.d || 0, q: c.q || "triad",
                     inv: c.inv || 0, borrow: c.borrow || 0, rootPc: root,
                     bassPc: pcs[(c.inv || 0) % pcs.length], pcs }));
      cursor += len;
    });
    return out;
  }
  const chordAt = (subj, g, bar, step) => {
    const cs = chordsOf(subj, g, bar);
    return cs.find(c => step >= c.start && step < c.start + c.len) || cs[cs.length - 1];
  };
  // materialize a cyclic prog over a section and land a CADENCE on its last
  // bar — how the composer says "this verse ends on the chorus's door".
  const withCadence = (prog, bars, cad) =>
    Array.from({ length: bars }, (_, b) => (b === bars - 1 ? cad : at(prog, b)));

  // VOICE LEADING, the shape of engine/theory.js moveVoices: seed the first
  // voicing by folding into the register, then move each voice to the NEAREST
  // realization of its next chord tone. Stateless per-note fold() destroyed
  // exactly this — consecutive chords were voiced independently, so a
  // progression leapt where a keyboard player's hand would barely move.
  const voiceLead = (prev, pcs, ctr) => {
    if (!prev) return pcs.map(n => fold(n, ctr));
    return pcs.map((n, i) => {
      const from = prev[i % prev.length];
      let x = n;
      while (x < from - 6) x += 12;
      while (x > from + 6) x -= 12;
      return x;
    });
  };

  // ---- PARTS: a role is an ASSIGNMENT, not a transform ----------------------
  // realize() was a two-value switch — pad or "a line" — so there were no
  // parts: no riff-vs-lead, no counter-melody, no chord stab. `g.part` names
  // what each voice IS, and the policy table says what that role may do. This
  // is not one of the five types and not the sixth or seventh either: no
  // operator, envelope, edge, groove profile or noun substitution can say
  // "this voice is the riff and riffs sit low and short" — it is material and
  // policy assigned to a performer, decided before any transform runs.
  //
  // `chordLock` is the genuinely new capability: a STAB fires on its own gate
  // vector but voices the sounding chord — the offbeat skank, unreachable
  // while a chord could only fire once a bar at the phrase's first gate.
  // A genre without `part` gets the realize() shim and a neutral policy, so
  // all existing genres render byte-identically.
  const PARTS = {
    line:    {},                                  // the shim: exactly the old behaviour
    lead:    { ctr: 12, maxHold: 4 },             // up top, sings, breathes
    riff:    { ctr: -12, maxHold: 2 },            // low, short, insistent
    counter: { maxHold: 3 },                      // between them
    pad:     {},                                  // the held-chord path below
    stab:    { chordLock: true, maxHold: 1 },     // its own rhythm, the bar's chord
    drone:   { ctr: -12, artic: "tie" },          // refuses to move
  };
  const partOf = (g, v) => (g.part
    ? (typeof g.part === "function" ? g.part(v) : g.part[v % g.part.length])
    : (g.realize(v) === "pad" ? "pad" : "line"));

  // ---- BAR SCHEDULE: the SIXTH type -----------------------------------------
  // `g.period` is a per-bar operator word — entry s of the cycle applies on
  // section-bar s — so a section has a 2/4/8-bar sentence instead of one
  // restated bar. Why it is none of the existing five: an operator is
  // explicitly TIMELESS and cannot know which bar it is in; an envelope is
  // position-dependent but runs POST-render and can only scale level; an edge
  // is bounded to one bar at a known end; groove is a per-16th fingerprint;
  // a genre override substitutes a noun. A bar schedule is position-dependent
  // and PRE-render — it changes which notes exist in the middle of a section,
  // the one thing none of the five can do. It is also the correct fix for
  // phrase length: lengthening the pattern to 64 steps would slow harm() to
  // one chord per four bars, because harmony is indexed by the same bar.
  // Entries are operator LISTS (the same alphabet as g.word); a function form
  // (v, s) => ops gives per-voice periods, which is call-and-response as data.
  const periodOps = (g, v, s) => {
    if (!g.period) return [];
    const w = typeof g.period === "function" ? g.period(v, s) : at(g.period, s);
    return w || [];
  };

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
    const N = subj.deg.length, ev = [], key = g.key | 0;
    for (let v = 0; v < g.voices; v++) {
      // the part's register lean sits ON TOP of g.reg, and only when the genre
      // actually declares parts — the shim keeps every partless genre exact
      const part = partOf(g, v), pol = g.part ? PARTS[part] || {} : {};
      const ctr = 60 + 12 * g.reg(v) + (pol.ctr || 0), pad = part === "pad",
            sc = g.scale || PENT, md = g.mode || MODE;
      let voicing = null;      // pad voice-leading memory: per voice, across bars
      for (let b = g.entry(v); b < bars; b++) {
        const s = b - g.entry(v);
        // the genre's word plus the bar schedule's word for THIS bar — the
        // sixth type joins the pipeline exactly where the timeless one runs
        const p = word(subj, g.word(v, s).concat(periodOps(g, v, s)));
        const chords = chordsOf(subj, g, b), c0 = chords[0];
        const chordFor = i => (chords.length === 1 ? c0
          : chords.find(c => i >= c.start && i < c.start + c.len) || chords[chords.length - 1]);
        const sp = spans(p.gate);
        // FOLLOW THE CHORD. A melody sitting on the same pitches while the roots
        // move under it is what makes a progression inaudible — the blues riff
        // has to go up to the IV, that IS the blues. So a line is transposed by
        // the bar's root.
        //
        // Only when the harmony is a CYCLE. Under `emergent` the roots were
        // computed FROM the voices' own transpositions, so transposing them
        // again by that root is circular and would double the motion; under
        // `modal` there is nothing to follow.
        // TAKE THE NEAREST ROOT, not the literal one. mp(VII) is +10 semitones,
        // and a riff does not climb ten semitones for the flat-VII — it drops
        // two to the same pitch class. Folding the shift into [-6..+6] keeps the
        // progression audible while keeping the line in one register; unfolded,
        // rock's melody spanned 46 semitones and every note was a heavily
        // stretched sample, which is why it stopped sounding like a guitar.
        // FOLLOW THE CHORD BY DEGREES WHEN THE ALPHABET CAN. Transposing the
        // line by SEMITONES is right for a pentatonic subject — that is the
        // blues riff going up to the IV, and the flat third it lands on against
        // a major IV is the whole sound. It is wrong for a seven-note one. A
        // harmonic-minor line moved up seven semitones is in G harmonic minor
        // over a G major chord, which puts a B♭ against the B natural that the
        // raised seventh existed to produce; measured, tango had a semitone
        // clash against the chord in three bars of four and Eurythmics in two,
        // and what that sounds like is not tension, it is out of tune.
        //
        // A genre whose subject alphabet IS its mode says `diatonic` and follows
        // the chord by moving DEGREES instead. Same contour, same scale, every
        // note in one key — which is what pop and tango actually do, and is a
        // second correct way to follow a progression rather than a fix to the
        // first. Folded to the nearer direction (up 3 or down 3, never up 6) so
        // the line stays in its register the way near6 keeps the semitone one in
        // its own.
        const near6 = x => ((((x + 6) % 12) + 12) % 12) - 6;
        const diat = !!g.diatonic && g.harmony === "cycle";
        // PER STEP, not per bar: a beats-split bar holds TWO chords, and the
        // stab path and the ramp's chordWalk already read chordFor(i) — the
        // shifts must too, or the bar's second chord is pad-only and the
        // half-bar ii–V bossa exists to prove never reaches the line. For a
        // single-chord bar chordFor(i) IS chords[0], byte for byte.
        const degShiftAt = i => {
          if (!diat) return 0;
          const d = chordFor(i).deg;
          return d > sc.length / 2 ? d - sc.length : d;
        };
        // the shift reads the CHORD's root pc, so a borrowed root (♭VI, ♭II)
        // moves the line with it; without a prog rootPc IS mp(r, md), exactly
        const rootShiftAt = i =>
          (g.harmony === "cycle" && !diat) ? near6(chordFor(i).rootPc) : 0;
        // A RAMP UNDER A CHORD CYCLE CLIMBS THROUGH THE CHORD, not through the
        // scale. Adding scale degrees moves the line by an amount that has
        // nothing to do with the harmony underneath it, and in a genre whose
        // whole identity IS the chord loop the melody simply drifts off the pad
        // — measured on vaporwave, one of three pitch classes a bar landed on a
        // chord tone. Stepping the ramp along the chord's own rungs is both
        // consonant by construction and what an arpeggiator has always done.
        // Under `modal` there is no chord to climb, and under `emergent` the
        // chord came from the voices, so both keep the scale-degree ramp.
        // ...and the rungs are the SOUNDING chord's — a seventh in the prog is
        // a rung the ramp can land on, which is half of "sevenths are audible".
        const chordWalk = (base, k, set) => {
          if (!set || !k) return base;
          let n = base; const dir = k > 0 ? 1 : -1;
          for (let c = 0; c < Math.abs(k) && c < 24; c++) {
            let guard = 0;
            do { n += dir; guard++; } while (!set.has(((n % 12) + 12) % 12) && guard < 24);
          }
          return n;
        };
        const clamp = g.incClamp == null ? 7 : g.incClamp;   // 0 = let it run
        const cmode = g.incMode || "hold";
        // one octave shift for the whole line, from its degree-pitch mean
        // REGISTER THE PHRASE, NOT THE RAMP. The shift is computed from the
        // degrees AS WRITTEN, with the per-loop ramp excluded. Include the ramp
        // and the registration chases it: the mean climbs, the shift drops the
        // line an octave to re-centre it, and a rising arpeggio audibly falls
        // back down every third loop. The ramp is deliberate movement — the
        // clamp is what bounds it — so it must sit ON TOP of the registration,
        // exactly like oct.
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
          if (first >= 0) {
            if (!g.prog) {
              // the degenerate progression: the mode triad, per-note fold —
              // byte-identical to what every existing genre played
              for (const n of c0.pcs)
                ev.push({ t: (b * N) / g.rate, dur: N / g.rate, v, part,
                          n: fold(n, ctr) + key, acc: 0, sld: 0, vel: vel(p, first) });
            } else {
              // a real progression: voice-led, and a bar may hold TWO chords —
              // beats < N is the half-bar turnaround/ii-V that was inexpressible
              for (const c of chords) {
                voicing = voiceLead(voicing, c.pcs, ctr);
                for (const n of voicing)
                  ev.push({ t: (b * N + c.start) / g.rate, dur: c.len / g.rate, v, part,
                            n: n + key, acc: 0, sld: 0, vel: vel(p, first) });
              }
            }
          }
          continue;
        }
        // A STAB fires on its OWN gate vector but voices the sounding chord —
        // chordLock is what makes an offbeat skank sayable at all: the pad
        // path above fires once a bar at the phrase's first gate, full stop.
        if (pol.chordLock) {
          for (let i = 0; i < N; i++) {
            if (!p.gate[i]) continue;
            const c = chordFor(i), hold = Math.min(sp[i], pol.maxHold || 1);
            for (const n of c.pcs)
              ev.push({ t: (b * N + i + swing(g, i)) / g.rate, dur: hold * 0.92 / g.rate,
                        v, part, n: fold(n, ctr) + key, acc: p.acc[i], sld: 0, vel: vel(p, i) });
          }
          continue;
        }
        const ART = { staccato: 0.5, normal: 0.92, legato: 1, tie: 1 };
        const artic = g.artic || pol.artic || "normal";
        // THE REST. A gap in the gate vector used to LENGTHEN the previous note
        // — spans() reads to the next gate, so a six-step hole was a six-step
        // note and nothing here could stop sounding. maxHold caps the hold so
        // the hole becomes silence. A note whose successor SLIDES is exempt:
        // the slide is a physical connection and the cap must not cut it.
        // Genre field first, part policy second, absent = exactly the old dur.
        const cap = g.maxHold != null ? g.maxHold : (pol.maxHold || 0);
        const barEv = [];
        for (let i = 0; i < N; i++) {
          if (!p.gate[i]) continue;
          const steps = sp[i];
          const slid = pad || p.sld[(i + steps) % N];
          const legato = slid ? 1 : (ART[artic] || 0.92);
          const held = slid || !cap ? steps : Math.min(steps, cap);
          const ns = [null];                             // pitched: registered below
          for (const n of ns) {
            const dg = p.deg[i] + degShiftAt(i);
            const set = g.harmony === "cycle" ? chordFor(i).pcSet : null;
            const rs = rootShiftAt(i);
            const pitchOf = n == null
              ? (set
                  ? chordWalk(pitch(dg, sc) + shift + rs + 12 * p.oct[i],
                              rampOf(p, i, b, clamp, cmode, subj), set)
                  : pitch(dg + rampOf(p, i, b, clamp, cmode, subj), sc) + shift + rs + 12 * p.oct[i])
              : fold(n, ctr);                                    // chords voice per note
            barEv.push({ t: (b * N + i + swing(g, i)) / g.rate, dur: held * legato / g.rate, v, part,
                         n: pitchOf + key, acc: p.acc[i], sld: p.sld[i], vel: vel(p, i) });
          }
        }
        // TIE. repeat(n) duplicates notes, and duplicated notes re-attack — a
        // machine-gun rather than a longer note. Under `tie`, consecutive events
        // at the same pitch that meet end-to-end become ONE held note, which is
        // what makes repeat musical instead of percussive.
        if (artic === "tie") {
          for (const e of barEv) {
            const last = ev[ev.length - 1];
            if (last && last.v === e.v && last.n === e.n &&
                Math.abs(last.t + last.dur - e.t) < 1e-6) {
              last.dur += e.dur;
              last.vel = Math.max(last.vel, e.vel);
              continue;
            }
            ev.push(e);
          }
        } else for (const e of barEv) ev.push(e);
      }
    }
    const out = ev.sort((a, b) => a.t - b.t);
    // the SEVENTH type runs on the finished pitched stream — see pipes() below.
    // The chords handed to the pipes are KEYED: every event pitch above already
    // carries g.key, so a pitch-aware pipe (harmonize's pcSet walk) must see
    // the transposed chord or it snaps the keyed line to old-key chord tones.
    const keyChords = cs => (key ? cs.map(c => ({ ...c,
      pcs: c.pcs.map(n => n + key),
      pcSet: new Set(c.pcs.map(n => (((n + key) % 12) + 12) % 12)) })) : cs);
    return g.pipes && g.pipes.length
      ? pipes(out, g.pipes, { chords: b2 => keyChords(chordsOf(subj, g, b2)),
                              stepsPerBar: N, rate: g.rate })
      : out;
  }

  // KIT OPERATORS. The kit is genre DATA, not a pattern, so these are kit->kit
  // rather than pattern->pattern — a fourth type, and they belong here beside
  // drums() rather than in the pattern group where they would silently do
  // nothing to the melody.
  const mapKit = (k, f) => Object.fromEntries(
    Object.entries(k || {}).map(([d, v]) => [d, f(v, d)]));
  // A kit operator is total on kits the way a pattern operator is total on
  // patterns: a lane the kit does not have is simply not there afterwards, and
  // none of these can invent one. (`four` and `offbeat` are the two exceptions,
  // and they are exceptions on purpose — putting a kick on every quarter is the
  // one drum idea you reach for that no rearrangement of the existing lanes can
  // express. Both write a lane the genre may not have had.)
  const K16 = v => v.slice(0, 16).concat(new Array(Math.max(0, 16 - v.length)).fill(0));
  const KITOPS = {
    nodrums:  () => ({}),
    // SUBTRACTIVE — take one lane away. Muting the kick is a breakdown; muting
    // the hats is the same phrase heard from further off.
    nokick:   k => Object.fromEntries(Object.entries(k || {}).filter(([d]) => d !== "k")),
    nohats:   k => Object.fromEntries(Object.entries(k || {}).filter(([d]) => d !== "h" && d !== "o")),
    snareonly: k => Object.fromEntries(Object.entries(k || {}).filter(([d]) => d === "s" || d === "c")),
    shift:    k => mapKit(k, v => v.map((_, i) => at(v, i + 2))),
    halftime: k => mapKit(k, (v, d) => v.map((x, i) => ((d === "k" || d === "s") && i % 8 !== 0 ? 0 : x))),
    // DOUBLE TIME reads the kit at twice the rate — the bar's pattern played
    // through twice — which is a different idea from `busy` (which fills a lane
    // in) and from `rate` (which changes the grid the melody sits on too).
    doubletime: k => mapKit(k, v => v.map((_, i) => at(v, i * 2))),
    busy:     k => mapKit(k, (v, d) => (d === "h" || d === "o" ? v.map(() => 1) : v)),
    // SPARSE keeps only the downbeats of each quarter — the kit at its skeleton.
    sparse:   k => mapKit(k, v => v.map((x, i) => (i % 4 === 0 ? x : 0))),
    four:     k => ({ ...mapKit(k, v => v.slice()), k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0] }),
    offbeat:  k => ({ ...mapKit(k, v => v.slice()), h: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0] }),
    // SWAP puts the kick's rhythm on the snare and the snare's on the kick. It
    // is the cheapest way to hear that a groove is a SHAPE and not a set of
    // sounds — and on a backbeat it is the whole of drum'n'bass's founding move.
    swap:     k => (k && k.k && k.s ? { ...mapKit(k, v => v.slice()), k: K16(k.s), s: K16(k.k) } : mapKit(k, v => v.slice())),
    // ROLL fills the last quarter of the bar with snare — the tiny fill that
    // makes a four-bar phrase turn over. It VARIES a snare, it does not conjure
    // one: on a genre with no kit at all it is a no-op, because a fugue that
    // suddenly grows a snare roll is not what "vary the drums" means. (`four`
    // and `offbeat` are the two that do write a lane, and they are the exceptions
    // on purpose — "give this a beat" is a different request from "change it".)
    roll:     k => (k && k.s
                    ? { ...mapKit(k, v => v.slice()),
                        s: K16(k.s).map((x, i) => (i >= 12 ? 1 : x)) }
                    : mapKit(k, v => v.slice())),
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
      // KIT SCHEDULE: `g.kits` is the kit read per BAR — a two-bar groove, a
      // hat that opens on bar 4 — where `g.kit` is one bar restated. It is not
      // a KITOP because a KITOP is kit->kit and TIMELESS (the argument beside
      // KITOPS); a schedule is position-dependent data. Absent = g.kit, exact.
      const base = g.kits ? at(g.kits, b) : (g.kit || {});
      const kit = (g.fill && b === bars - 1) ? { ...base, ...g.fill } : base;
      for (const [d, vec] of Object.entries(kit))
        for (let i = 0; i < N; i++)
          if (at(vec, i))
            // KIT DYNAMICS: the drums used to borrow the MELODY's velocity
            // vector — the kick's loudness was an accident of the tune at that
            // step. `g.kitVel` gives a lane its own 16-slot velocities (ghost
            // snares are a 2 on the off-16ths, no new machinery). Absent lane
            // = exactly the old expression.
            ev.push({ t: (b * N + i + swing(g, i)) / g.rate, d, acc: !!subj.acc[i],
                      vel: g.kitVel && g.kitVel[d] ? at(g.kitVel[d], i) : vel(subj, i),
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
    const md = g.mode || MODE, key = g.key | 0;
    if (g.bassStyle === "walk") {
      for (let b = 0; b < bars; b++) {
        const c = chordsOf(subj, g, b)[0], nc = chordsOf(subj, g, (b + 1) % bars)[0];
        const r = c.deg, p4 = c.pcs;
        // alternate the direction of the middle two so three bars of one chord
        // do not walk the identical line three times — and when the chord
        // carries a SEVENTH, the odd bars walk up through it: a walking line
        // that never sounds the seventh of a seventh chord does not have one
        const mid = b % 2 === 0 ? [p4[1], p4[2]]
          : (p4.length > 3 ? [p4[2], p4[3]] : [p4[2], p4[1]]);
        // the walk starts from bassPc, so an inversion is audible from the
        // first beat, and it AIMS at the next chord's bassPc — a walking line
        // is defined by where it is going
        const tones = [c.bassPc, mid[0], mid[1], nc.bassPc - 1];
        tones.forEach((n, q) =>
          ev.push({ t: (b * N + q * 4) / g.rate, dur: 3.7 / g.rate, n: n + 36 + key, r,
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
    // A STYLE MAY OWN THE RHYTHM. `eighths` and `sixteenths` are not a different
    // choice of NOTE, they are a different DENSITY, so they override the accent
    // grid rather than reading it — a driving eighth-note bass that goes quiet
    // because the melody has no accents is not the part anyone asked for. Every
    // style that predates this table has no entry and reads the accents exactly
    // as it always did.
    const STYLEGRID = {
      eighths:    [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      sixteenths: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
    };
    const grid = STYLEGRID[g.bassStyle]
      || (subj.acc.some(Boolean) ? subj.acc : (g.bassGrid || QUARTERS));
    const sp = spans(grid);                                     // holds to the next hit
    let alt = 0;
    for (let b = 0; b < bars; b++) {
      // PEDAL ignores the progression and sits on the tonic. It is the one bass
      // style that is a statement about the HARMONY rather than the rhythm: the
      // chords move over a bass that refuses to, which is where every drone and
      // most of the tension in modal music comes from.
      // The chord is read per STEP: a beats-split bar (bossa's ii7–V7, gospel's
      // amen) holds two, and a bass sitting on the first chord's root through
      // the dominant half is the turnaround not happening. One chord a bar is
      // the common case and reads chords[0] exactly as before.
      const cs = g.bassStyle === "pedal" ? null : chordsOf(subj, g, b);
      for (let i = 0; i < N; i++)
        if (at(grid, i)) {
          const c = !cs ? null : cs.length === 1 ? cs[0]
            : cs.find(x => i >= x.start && i < x.start + x.len) || cs[cs.length - 1];
          const r = c ? c.deg : 0;
          const k = alt++;
          // octaves alternates register; fifths alternates the DEGREE, which is
          // the boogie/country figure rather than a doubling
          const oct = g.bassStyle === "octaves" ? 12 * (k % 2) : 0;
          const deg = g.bassStyle === "fifths" && k % 2 ? r + 4 : r;
          // the root note is the chord's BASS pc — an inversion puts the third
          // under the band, folded beside the root so the register holds; with
          // no prog, bassPc === rootPc === mp(r, md) and this is the old note
          const n0 = !c ? mp(0, md)
            : deg !== r ? mp(deg, md) + c.borrow
            : fold(c.bassPc, c.rootPc);
          ev.push({ t: (b * N + i + swing(g, i)) / g.rate, dur: sp[i] * 0.94 / g.rate,
                    n: n0 + 36 + oct + key, r, vel: vel(subj, i) });
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
  // TWO FAMILIES, and they are different types again. `in` / `out` / `swell` are
  // SHAPES — a curve over the section, scaling velocity, event count preserved.
  // `drop` and `stutter` are CUTS — they add and remove events, which no curve
  // can do — and they are the two transitions that actually mark a boundary
  // rather than smoothing one. (The third family, the filter sweeps, cannot live
  // here at all: they are a property of the SOUND, not of the event stream, so
  // they are automation on the section's mixer channel — see audio/mixer.js.)
  const SHAPES = {
    in:    x => x,
    out:   x => 1 - x,
    swell: x => 1 - Math.abs(2 * x - 1),          // up and back down
    duck:  x => Math.abs(2 * x - 1),              // out of the middle, into the edges
  };
  const envelope = (ev, kind, span) => {
    if (!kind || !span) return ev;
    // DROP — the last eighth of the section goes silent. The oldest trick in
    // dance music and still the loudest: what you hear is the bar that follows.
    if (kind === "drop") return ev.filter(e => e.t < span * 0.875);
    // STUTTER — the last eighth repeats its own first quarter, four times. The
    // events are real events, so it stutters whatever was actually there.
    if (kind === "stutter") {
      const win = span / 8, from = span - win, unit = win / 4;
      const out = ev.filter(e => e.t < from);
      const head = ev.filter(e => e.t >= from && e.t < from + unit);
      for (let k = 0; k < 4; k++)
        for (const e of head)
          out.push({ ...e, t: e.t + k * unit,
                     dur: Math.min(e.dur == null ? unit : e.dur, unit) });
      return out.sort((a, b) => a.t - b.t);
    }
    const shape = SHAPES[kind];
    if (!shape) return ev;
    return ev.map(e => {
      const x = Math.min(1, Math.max(0, e.t / span));
      const f = shape(x);
      return { ...e, vel: Math.max(0, Math.round((e.vel == null ? 5 : e.vel) * f)) };
    });
  };

  // ---- INTRO and OUTRO: the two bars that are not like the others ----------
  // A THIRD TYPE AGAIN, and the distinction is worth being pedantic about,
  // because it is what stopped these being a pile of special cases. An operator
  // is timeless. An envelope is a function of position over the WHOLE section.
  // These are functions of position over ONE BAR at a known end — which means
  // they can do the thing neither of the others can: replace what is there.
  // A drum fill is not a louder last bar or a rotated kit, it is a DIFFERENT bar,
  // and until something was allowed to delete events and write new ones there
  // was no way to say so.
  //
  // Both take the windowed event stream, the section's length in steps and the
  // steps in a bar, and both are total: an unknown name returns the stream.
  const beatsOf = (t0, bs, steps) => steps.map(s => t0 + s * bs / 16);
  // one drum event, written in the same shape drums() emits
  const D = (t, d, acc, v) => ({ t, d, acc: !!acc, vel: v, kind: "hit", fill: true });

  function intro(ev, kind, span, bs) {
    if (!kind || !bs) return ev;
    const inBar = e => e.t < bs, rest = ev.filter(e => !inBar(e));
    const bar = ev.filter(inBar);
    if (kind === "count") {
      // a count-in: four rim clicks and nothing else, the fourth accented
      const out = rest.slice();
      beatsOf(0, bs, [0, 4, 8, 12]).forEach((t, i) => out.push(D(t, "p", i === 3, i === 3 ? 9 : 6)));
      return out.sort((a, b) => a.t - b.t);
    }
    if (kind === "hit") {
      // one downbeat and then space — the oldest way to say "here we go"
      return [D(0, "k", 1, 9), D(0, "o", 1, 8), ...rest].sort((a, b) => a.t - b.t);
    }
    if (kind === "solo")  return [...bar.filter(e => e.kind === "line"), ...rest];
    if (kind === "kit")   return [...bar.filter(e => e.kind === "hit"), ...rest];
    if (kind === "swell") {
      // the first bar alone fades up — a fade-in that does not eat the section
      return [...bar.map(e => ({ ...e,
        vel: Math.max(0, Math.round((e.vel == null ? 5 : e.vel) * (e.t / bs))) })), ...rest];
    }
    return ev;
  }

  function outro(ev, kind, span, bs) {
    if (!kind || !bs || !span) return ev;
    const from = Math.max(0, span - bs);
    const inBar = e => e.t >= from, rest = ev.filter(e => !inBar(e));
    const bar = ev.filter(inBar);
    const keepLines = bar.filter(e => e.kind !== "hit");
    if (kind === "fill") {
      // THE FILL. Eighths for the first half of the bar, sixteenths for the
      // second, accented on the beat — the standard shape, played as real snare
      // events rather than as a kit vector, which is why it can accelerate at
      // all. The kick stays on 1 so the bar still lands.
      const out = [...rest, ...keepLines, D(from, "k", 1, 9)];
      for (const s of [0, 2, 4, 6, 8, 9, 10, 11, 12, 13, 14, 15])
        out.push(D(from + s * bs / 16, "s", s % 4 === 0, s < 8 ? 6 : 7 + (s % 2)));
      out.push(D(from + 15 * bs / 16, "c", 1, 9));
      return out.sort((a, b) => a.t - b.t);
    }
    if (kind === "roll") {
      // an accelerating roll: slow, then faster, then a crash. Same idea as the
      // fill, but it is a crescendo rather than a phrase.
      const steps = [0, 4, 8, 10, 12, 13, 14, 15];
      const out = [...rest, ...keepLines];
      steps.forEach((s, i) => out.push(D(from + s * bs / 16, "s", i > 4, 4 + i)));
      out.push(D(from + bs, "o", 1, 9));
      return out.sort((a, b) => a.t - b.t);
    }
    if (kind === "crash") {
      // everything stops and one cymbal holds the door open
      return [...rest, D(from, "o", 1, 9), D(from, "k", 1, 9)].sort((a, b) => a.t - b.t);
    }
    if (kind === "break") return [...rest, ...bar.filter(e => e.kind === "hit")];
    if (kind === "tail")  return [...rest, ...keepLines];
    if (kind === "cut")   return ev.filter(e => e.t < span - bs / 4);
    return ev;
  }
  const edges = (ev, i, o, span, bs) => outro(intro(ev, i, span, bs), o, span, bs);

  const api = { at, mapv, spans, vel, drop, fill, spread, split, del, rampOf, envelope, edges, intro, outro, groove, GROOVES, KITOPS, mapKit, swing, rotate, reverse, transpose, invert, complement,
                crossmap, excerpt, only, word,
                PENT, MODE, ROMAN, romanOf, pitch, mp, fold, near,
                QSTEPS, QFIX, chordsOf, chordAt, withCadence,
                PARTS, partOf, periodOps, pipes, PIPES,
                harm, render, drums, bass };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuKernel = api;
})(typeof window !== "undefined" ? window : globalThis);
