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
//   orn   ORNAMENT MARK on this step — 0 none, 1 grace, 2 flam, 3/4/5 a roll
//         of two, three or four. A ninth vector and a THIRD type: not a level
//         and not a switch, but a small ENUM naming a way of PLAYING the note.
//         Absent (an old phrase, a composed one) reads as the all-zero vector
//         and renders byte-identically, which is why nothing needed migrating.
//
// vel and acc are NOT the same knob. vel is how loud; acc is the 303's accent,
// a categorical flag that opens the filter and that operators key on (the ghost
// layer is `only("acc", …)`). Level is continuous, accent is an event.
//
// A PHRASE HAS A KIND. Everything above is the MELODIC kind. The other is
// DRUM (`kind:"drum"`): not five/nine parallel vectors but a small LANE GRID
// — see DRUM_LANES/DMARK near drums() below — and it does not join this
// algebra. The OPS words, render() and bass() all pass a drum phrase straight
// through untouched; only drums() reads it, and reading it there is how it
// OVERRIDES a section's genre kit for exactly the bars it sits in.
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
  // `orn` rides along like every other NODE vector — a mark belongs to the step
  // it is written on, so rotating or excerpting a phrase carries its marks with
  // it. It is the ONE vector this does not manufacture when it is missing: the
  // group laws are checked by deep-comparing a pattern with its own image, and
  // a phrase that never had marks must come back out of rotate(0) as the same
  // eight keys it went in as, not as nine.
  const mapv = (p, f) => {
    const o = { deg: f(p.deg), oct: f(p.oct), vel: f(p.vel || p.gate.map(() => 5)),
                inc: f(p.inc || Z(p)), stk: f(p.stk || Z(p)),
                gate: f(p.gate), acc: f(p.acc), sld: f(p.sld) };
    if (p.orn) o.orn = f(p.orn);
    return o;
  };

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
        if (out.orn) out.orn[j] = 0;               // …and it is not an ornament either
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

  // An operator WORD is a list of operators applied left to right. A DRUM
  // PHRASE has no deg/oct/gate for any of these operators to read — its shape
  // is lanes, not a line — so a word passes over it exactly as an empty word
  // would: the phrase, unchanged. (This is the same choke point ops already
  // run through; it needs no second one in the callers.)
  const word = (p, ws) => (p && p.kind === "drum") ? p : ws.reduce((q, op) => op(q), p);

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

  // ---- THE TEMPO MAP: the one stage that moves the CLOCK --------------------
  // Everything above moves a note against a grid that never moves — groove
  // pushes a sixteenth, swing leans a pair, an envelope changes a level. This
  // moves the grid. Paul's sentence is the whole specification: "tempo changes
  // never happen, but music slows down and speeds up". So there is no tempo
  // EVENT here and no per-section metronome mark — there is a rate CURVE,
  // continuous by construction, and time is its integral.
  //
  // A plan is one entry per bar: `steps`, the bar in this genre's own step
  // units, and `rs`, the rate at equally spaced nodes ACROSS the bar (1 is the
  // song's tempo; 0.94 is six percent slower than it). Two laws make this music
  // rather than automation:
  //   * CONTINUITY — rs[last] of a bar IS rs[0] of the next, because the caller
  //     builds ONE node array and slices it. A jump in rate is a tempo change;
  //     a ramp is a musician.
  //   * TIME IS THE INTEGRAL, in closed form. Over a segment where the rate runs
  //     linearly a->b across L steps, r(x) = a + kx with k = (b-a)/L, so
  //     t(x) = ln(r(x)/a)/k — exact, strictly monotonic while a,b > 0. Nothing
  //     samples the curve, so no two consumers can integrate it differently.
  //
  // The answer per bar is `dur` (the bar's length in TIME steps, what a
  // scheduler multiplies by the step duration) and `at(x)` (the time offset of
  // musical offset x). Both readers of the bar list — the live transport and
  // the offline bounce — get those two numbers already baked in, which is why
  // the warp lives in the timeline rather than in whoever is playing it.
  //
  // Prior art: engine/csd-engine.js's rubato stage — "implemented ONCE here as
  // a smooth monotonic BEAT-WARP so every consumer inherits the exact same
  // musical clock and all layers stay sample-locked BY CONSTRUCTION". The
  // parent warps beats with a sine because its consumers map beat -> time
  // linearly; this warps steps with a piecewise-linear rate because a nukernel
  // bar is asked, out loud, how long it is.
  const RATE_MIN = 0.6, RATE_MAX = 1.6;
  function tempoWarp(plan) {
    return plan.map(p => {
      const steps = p.steps;
      const rs = p.rs.map(r => Math.min(RATE_MAX, Math.max(RATE_MIN, +r || 1)));
      const n = rs.length - 1, L = steps / n, t = [0];
      for (let i = 0; i < n; i++) {
        const a = rs[i], b = rs[i + 1];
        t.push(t[i] + (Math.abs(b - a) < 1e-9 ? L / a : L * Math.log(b / a) / (b - a)));
      }
      // PAST THE BAR LINE THE LAST SEGMENT CARRIES ON. Groove pushes the final
      // sixteenth over the line by design (ui/derive.js says so), and the bar
      // has ended but the tempo has not — extrapolating the segment is the only
      // reading that keeps a pushed note where the ear expects it.
      const at = x => {
        const i = Math.min(n - 1, Math.max(0, Math.floor(x / L)));
        const a = rs[i], x0 = i * L, k = (rs[i + 1] - a) / L;
        return Math.abs(k) < 1e-12 ? t[i] + (x - x0) / a
                                   : t[i] + Math.log((a + k * (x - x0)) / a) / k;
      };
      return { steps, dur: t[n], at, r0: rs[0], r1: rs[n] };
    });
  }

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

  // ---- THE MASTER HARMONIZATION ENGINE: one tonality per box ----------------
  // Paul: "when we add patterns and sub voices to sections, that is when a
  // tonality happens. There should be a master harmonization engine." The box
  // already HAS one harmonic authority — stack[0]'s genre owns the key, the
  // mode and the chord timeline, and the layer law (ui/derive.js) makes every
  // stacked genre render THROUGH that harmony. What the law could not do is
  // make a layer's NOTES agree with it: a layer walks its own phrase through
  // its own alphabet, so its pitches land wherever the alphabet put them —
  // non-chord tones held on downbeats, sustained minor seconds against the
  // authority's line, unisons stacked dead on the host's own notes. Nothing at
  // any tier was ALLOWED to fix that: operators are timeless and pre-pitch,
  // envelopes are level-only, PIPES.harmonize ADDS a derived voice and never
  // corrects a written one, groove moves time. This stage is the parent's two
  // harmony organs met in the middle, cited:
  //   * engine/theory.js moveVoices — "each voice takes its nearest chord
  //     tone"; the nearest-realization walk below is that idea per note, and
  //     its coverage repair ("only doubled voices may leave") is the doubling
  //     spread here.
  //   * engine/pipes.js harmonize — "snapped to the pad/bass pitch-class set
  //     sounding at that beat … instant polyphony that can't clash"; the same
  //     pcSet walk, pointed at correction instead of addition.
  //   * kernel `anchored`, one screen down — "a note that SOUNDS through more
  //     than `anchor` steps has to be a chord tone"; the strong-beat rule is
  //     the metrical twin of that duration rule, and the direction-of-travel
  //     tie-break is anchored's own, for anchored's own reason (a rising
  //     phrase resolved downward by reflex becomes a repeated note).
  //
  // THE AUTHORITY IS UNTOUCHED — the don't-lose-what-we-have law. Only events
  // ctx.conform admits (ui/derive.js masterCtx: layer-tagged line events, pads
  // excluded — a layer pad voices the authority's own chords by construction)
  // may move; a stream with none comes back the SAME ARRAY, which is what
  // holds §48's byte-identity across every genre. Three rules, in order, all
  // pitch-only — a correction never adds, removes or re-times a note:
  //   1. FOLD INTO THE KEY: a note outside both the governing scale and the
  //      sounding chord moves to the nearest legal pitch class. The chord's
  //      own colour is legal — a borrowed bVI's notes are not wrong notes.
  //   2. STRONG BEATS SIT ON THE CHORD: a note landing on a beat moves to the
  //      nearest chord tone. Offbeats keep their colour — that is where the
  //      passing tones live, so this is a seating plan, not a flattening.
  //   3. THE VOICES AGREE: a note sustained a minor second (interval class 1)
  //      against a simultaneous note from another voice — or stacked in exact
  //      unison on another LAYER's note — re-seats on the chord tone that
  //      clashes with nothing: nearest first, least-clashing when every rung
  //      clashes. A chord-tone-vs-chord-tone second is the chord's OWN colour
  //      (a maj7 owns its ic1 — the census's rule 1) and never counts.
  // Deterministic by construction: no dice, one processing order (voice, then
  // time), every decision a pure function of the stream and the timeline. It
  // runs BEFORE the window/envelope/edges/groove (pitch before time) and
  // upstream of the transport's register fold, which moves whole octaves and
  // so changes no pitch class decided here.
  // ONE NOTE, SEATED — rules 1 and 2 of the stage below for a single pitch
  // against a single chord. It is hoisted out of harmonizeStage because a note
  // written OUTSIDE a section's stream has to obey the same law: ui/derive.js
  // builds lead-in pickups after the stage has run and seats every one of them
  // through this, so a pickup into a chorus speaks the chorus's chord by the
  // same rule its own voices did. `c` is a chord from ui/derive.js masterCtx
  // (pcs + pcSet); `_legal` caches the chord's union with the scale on the
  // chord object, which is why the walk below keeps calling legalOf.
  const pcw = n => ((n % 12) + 12) % 12;
  const nearestIn = (n, set, dir) => {
    for (let d = 1; d <= 6; d++)
      for (const s of [dir, -dir]) if (set.has(pcw(n + s * d))) return n + s * d;
    return n;
  };
  const legalWith = (c, scalePcs) =>
    c._legal || (c._legal = new Set([...c.pcSet, ...scalePcs]));
  function seatNote(n, c, scalePcs, onBeat, dir) {
    if (c.pcSet.has(pcw(n))) return n;
    if (onBeat) return nearestIn(n, c.pcSet, dir);                    // rule 2
    if (scalePcs.has(pcw(n))) return n;
    return nearestIn(n, legalWith(c, scalePcs), dir);                 // rule 1
  }
  function harmonizeStage(ev, ctx) {
    const idx = [];
    for (let i = 0; i < ev.length; i++) if (ctx.conform(ev[i])) idx.push(i);
    if (!idx.length) return ev;                  // single-layer: the same array
    const N = ctx.stepsPerBar, rate = ctx.rate;
    const cache = new Map();
    const chordAtT = t => {
      const step = t * rate, bar = Math.floor(step / N + 1e-9);
      let cs = cache.get(bar);
      if (!cs) { cs = ctx.chords(bar); cache.set(bar, cs); }
      const s = ((step % N) + N) % N;
      return cs.find(c => s >= c.start - 1e-9 && s < c.start + c.len) || cs[cs.length - 1];
    };
    const out = ev.slice();
    // one order for everything: voice, then time — the direction of travel
    // wants each voice's line in sequence, and determinism wants ONE order
    idx.sort((a, b) => (ev[a].v - ev[b].v) || (ev[a].t - ev[b].t) || (ev[a].n - ev[b].n));
    const beat = N / 4, prevOf = new Map();
    for (const i of idx) {                       // rules 1 and 2
      const e = out[i], c = chordAtT(e.t);
      const prev = prevOf.get(e.v);
      const dir = prev != null && e.n > prev ? 1 : -1;
      const sb = (((e.t * rate) % N) + N) % N, r = Math.round(sb);
      const onBeat = Math.abs(sb - r) < 0.45 && r % beat === 0;
      const n = seatNote(e.n, c, ctx.scalePcs, onBeat, dir);        // rules 1 and 2
      prevOf.set(e.v, n);
      if (n !== e.n) out[i] = { ...e, n, hz: 1 };
    }
    // rule 3 — reconciliation against the WHOLE pitched stream, authority
    // included: the authority never moves, so the layer is always the one
    // that yields (the census's rule 2: the accused is the added voice)
    const OV = 0.9 / rate;               // "sustained": most of a step together
    const pitched = [];
    for (let j = 0; j < out.length; j++) {
      const x = out[j];
      if (x.n == null || !(x.dur > 0) || x.d) continue;
      pitched.push(j);
    }
    const icOne = (a, b) => { const ic = Math.abs(a - b) % 12; return ic === 1 || ic === 11; };
    for (const i of idx) {
      const e = out[i], c = chordAtT(e.t);
      const near = [];
      for (const j of pitched) {
        if (j === i) continue;
        const x = out[j];
        if (x.v === e.v) continue;
        if (Math.min(e.t + e.dur, x.t + x.dur) - Math.max(e.t, x.t) >= OV) near.push(x);
      }
      if (!near.length) continue;
      const cost = cand => {                     // clashes first, distance last
        const candIn = c.pcSet.has(pcw(cand));
        let w = 0;
        for (const x of near) {
          if (icOne(cand, x.n) && !(candIn && c.pcSet.has(pcw(x.n)))) w += 100;
          if (x.n === cand && (x.layer || null) !== (e.layer || null)) w += 40;
        }
        return w;
      };
      if (!cost(e.n)) continue;                  // no grind, no stacked unison
      let best = e.n, bc = cost(e.n) + 0;        // moving must beat staying
      for (const p of c.pcs) {
        const d0 = pcw(p - e.n);
        const cand = e.n + (d0 <= 6 ? d0 : d0 - 12);
        const cc = cost(cand) + Math.abs(cand - e.n) * 0.01;
        if (cc < bc - 1e-9 || (Math.abs(cc - bc) < 1e-9 && cand < best)) { best = cand; bc = cc; }
      }
      if (best !== e.n) out[i] = { ...e, n: best, hz: 1 };
    }
    return out;
  }

  // ---- ORNAMENTS: the NINTH type -------------------------------------------
  // "The phrase editor has no way to do chromaticism or passing notes that I
 // can see, or grace notes or flams" . It could not, and
  // nothing already here could be made to: an operator is timeless and knows
  // no pitch; an envelope is level-only; a pipe computes over the finished
  // stream but has no idea which STEP a note was written on; and every one of
  // them is a fact about a whole phrase, while an ornament is a fact about one
  // NOTE. What was missing is the mark a player writes over a single note and
  // the handful of moves a style adds without being asked.
  //
  // So there are two halves, and they meet at ONE choke point — the same
  // discipline engine/pipes.js keeps upstream (docs/MUSIC-MIND.md: every
  // expression transform runs at a single place in buildEvents, never
  // sprinkled through the callers), because two places that add notes are two
  // places that disagree about what is already there:
  //
  //   THE MARKS   the `orn` vector, written by hand in the tracker. A marked
  //               step does exactly what its mark says, always.
  //   THE PASS    `g.orn`, a genre's own ornament policy: passing tones into
  //               leaps, chromatic approaches onto strong beats, graces, flams
  //               and rolls, thrown with the same positional dice the kit and
  //               the performance layer already use — so it is deterministic
  //               from the genre's seed and bar 3 is not bar 1.
  //
  // AND THE MARKS WIN. The pass never touches a note the hand already marked,
  // nor a note some other ornament produced: an ornament of an ornament is a
  // mistake, and a genre policy quietly rewriting what somebody wrote down is
  // the worst kind of instrument. A genre with no `g.orn` gets NOTHING — no
  // default, no family fallback — so every anchor that predates this renders
  // byte for byte as it did.
  const ORN = { none: 0, grace: 1, flam: 2, roll2: 3, roll3: 4, roll4: 5 };
  const ORNNAME = ["", "grace", "flam", "roll", "roll", "roll"];
  const ORNPARTS = [0, 0, 0, 2, 3, 4];             // how many strokes a roll is

  // THE SOUNDING ALPHABET OF ONE BAR, and it has to be per bar rather than per
  // genre: under a chord cycle the line is transposed by the bar's root (the
  // blues riff going up to the IV), so the notes available in bar 3 are the
  // scale MOVED, plus whatever the sounding chord adds on top of it — a
  // seventh in the progression is a rung an ornament may land on. Read the
  // genre's scale against the tonic and a grace note in bar 3 is a wrong note
  // in bar 3. Memoized because every note in a bar asks the same question.
  //
  // This is the same set §9 of the unit gate builds to decide whether a pitch
  // class is inside the music at all, computed the same way on purpose: an
  // ornament that stays inside it cannot put the line out of key. Only the
  // CHROMATIC approach leaves it, deliberately and by name.
  const ornAlphabet = (subj, g, key) => {
    const sc = g.scale || PENT, md = g.mode || MODE, memo = new Map();
    return b => {
      let s = memo.get(b);
      if (s) return s;
      // `g.roots` is asked for, not assumed. A CYCLE genre normally carries a
      // roots schedule and harm() reads it — but a box that names a `prog` on
      // a MODAL genre (ui/derive.js, the depth surface) turns harmony to
      // "cycle" and supplies the progression INSTEAD of a roots vector, which
      // is exactly the shape chordsOf's own first branch already steps around.
      // Without the guard the ornament alphabet was the one reader that did
      // not, and every prog chip on a modal genre threw inside render().
      // Nothing shifts for a genre that does carry roots, so no rendered
      // ornament moves.
      const root = (g.harmony === "cycle" && !g.diatonic && g.roots)
        ? mp(harm(subj, g, b), md) : 0;
      s = new Set(sc.map(x => pcw(x + root + key)));
      if (g.harmony === "cycle")
        for (const c of chordsOf(subj, g, b)) for (const n of c.pcs) s.add(pcw(n + key));
      memo.set(b, s);
      return s;
    };
  };
  // ONE STEP AWAY IN THE ALPHABET — never a fixed interval, because "the note
  // below" is a whole tone in one scale and three semitones in another, and an
  // ornament that does not know which is the out-of-tune one. Nothing inside
  // three semitones means the gap really is that wide (a pentatonic fourth)
  // and the semitone is the honest answer; a missing alphabet means the caller
  // is asking for the chromatic neighbour outright.
  const ornStep = (n, dir, pcs) => {
    if (!pcs) return n + dir;
    for (let d = 1; d <= 3; d++) if (pcs.has(pcw(n + dir * d))) return n + dir * d;
    return n + dir;
  };
  // A LEAD-IN NOTE STEALS FROM THE HAND THAT PLAYS IT. A grace, a flam stroke
  // and a chromatic approach all sound BEFORE the beat, and the hand has to
  // leave the note it is on to play them — so the predecessor is shortened by
  // exactly as much as the ornament takes, and if there is no room at all (the
  // note before starts later than the ornament would) the ornament is simply
  // not played. Inserting one anyway would overlap two notes on one voice,
  // which on a monophonic instrument is a dropped note rather than a flourish.
  // `floor` is the bar line: nothing may lean back across it.
  const leadIn = (list, k, n2, len, name, drop, floor) => {
    const e = list[k], t = e.t - len;
    if (t < floor - 1e-9) return false;
    const prev = k > 0 ? list[k - 1] : null;
    if (prev) {
      if (prev.t >= t - 1e-9) return false;
      if (prev.t + prev.dur > t) prev.dur = t - prev.t;
    }
    list.splice(k, 0, { ...e, t, dur: len * 0.82, n: n2, acc: 0, sld: 0,
                        vel: Math.max(1, (e.vel == null ? 5 : e.vel) - drop),
                        orn: name });
    return true;
  };
  // A ROLL SUBDIVIDES THE NOTE, not the step: `split` up in the algebra already
  // subdivides a step and it is a different idea — it makes new notes out of
  // the phrase's own spans and climbs the ramp through them. This one takes a
  // note that is already sounding and re-strikes it, which is the 909 ratchet
  // and the drummer's roll, and it never lengthens anything. Each stroke stops
  // a hair before the next so a `tie` genre cannot fold the roll back into the
  // one long note it was.
  const ratchet = (list, k, parts) => {
    const e = list[k], slice = e.dur / parts;
    if (!(slice > 0.02)) return false;             // too short to hear as strokes
    e.dur = slice * 0.9; e.orn = "roll";
    const add = [];
    for (let j = 1; j < parts; j++)
      add.push({ ...e, t: e.t + j * slice, dur: slice * 0.9, acc: 0, sld: 0,
                 vel: Math.max(1, (e.vel == null ? 5 : e.vel) - 1), orn: "roll" });
    list.splice(k + 1, 0, ...add);
    return true;
  };
  // THE MARKS, on one voice's one bar, after the performance layer and before
  // the tie fold — the same window `perform` runs in, and for the same reason:
  // the notes are still separate events here, and `steps[k]` still says which
  // step each one was written on, which is the only place the mark can be read.
  // Walked BACKWARDS so a splice never moves a note this loop has yet to see.
  const markBar = (bar, steps, marks, g, N, b, pcs) => {
    if (!marks) return false;
    const t0 = (b * N) / g.rate;
    let did = false;
    for (let k = bar.length - 1; k >= 0; k--) {
      const m = marks[steps[k]] | 0;
      if (!m || m > 5) continue;
      const e = bar[k];
      e.omark = 1;                                 // hands off, generated pass
      did = true;
      if (m >= ORN.roll2) { ratchet(bar, k, ORNPARTS[m]); continue; }
      // WHICH SIDE THE ORNAMENT COMES FROM IS THE LINE'S OWN BUSINESS: it
      // continues the direction of travel, so a rising phrase is led into from
      // below and a falling one from above. Resolving one way by reflex is how
      // an ornament turns a shape into a stutter.
      const prev = k > 0 ? bar[k - 1] : null;
      const dir = prev && prev.n > e.n ? 1 : -1;
      const len = Math.min(0.4, e.dur * g.rate * 0.5) / g.rate;
      if (m === ORN.grace) leadIn(bar, k, ornStep(e.n, dir, pcs), len, "grace", 2, t0);
      else leadIn(bar, k, e.n, len * 0.6, "flam", 3, t0);   // a flam is the note itself
    }
    return did;
  };
  // THE PASS. Runs on the finished, sorted stream — where a pipe runs, and for
  // the pipe's own reason: this is the first place a note knows its pitch, its
  // neighbours and the chord under it. Per VOICE, because ornaments are a line's
  // business and interleaving two lines would ornament each with the other's
  // neighbours; pads and chord stabs are skipped outright (a held voicing has
  // no line to decorate). Every die is `perfDice` — a pure hash of WHERE, so
  // the same seed renders the same flourishes forever and the order the notes
  // happen to be visited in cannot change one of them.
  const ORNSALT = { pass: 21, approach: 22, grace: 23, flam: 24, roll: 25 };
  function ornament(ev, g, ctx) {
    const o = g.orn;
    if (!o) return ev;                             // no policy, no ornaments, ever
    const N = ctx.stepsPerBar, rate = ctx.rate;
    const pcsAt = ctx.pcsAt || (() => null);
    const lanes = new Map(), pass = [];
    for (const e of ev) {
      if (e.part === "pad" || e.pipe || e.d) { pass.push(e); continue; }
      const k = e.v || 0;
      if (!lanes.has(k)) lanes.set(k, []);
      lanes.get(k).push(e);
    }
    let touched = false;
    for (const [v, list] of lanes) {
      const lane = String.fromCharCode(97 + (v % 26));
      const barOf = e => Math.floor((e.t * rate) / N);
      const stepOf = e => ((Math.round(e.t * rate) % N) + N) % N;
      const die = (e, salt) => perfDice(g, barOf(e), stepOf(e), lane, salt);
      // ONE ORNAMENT PER NOTE, ASKED IN ONE ORDER. A note that has already been
      // rolled is not also graced: the order below IS the precedence, it never
      // varies, and that is what keeps two runs identical.
      for (let k = list.length - 1; k >= 0; k--) {
        const e = list[k];
        if (e.orn || e.omark) continue;            // the hand's, or another ornament's
        const t0 = Math.floor((e.t * rate) / N) * N / rate;
        const beats = Math.max(1, N / 4);
        const strong = stepOf(e) % beats === 0;
        if (o.roll && e.dur * rate >= 1.5 && die(e, ORNSALT.roll) < o.roll) {
          if (ratchet(list, k, die(e, ORNSALT.roll + 1) < 0.5 ? 2 : 3)) { touched = true; continue; }
        }
        const prev = k > 0 ? list[k - 1] : null;
        const dir = prev && prev.n > e.n ? 1 : -1;
        const len = Math.min(0.4, e.dur * rate * 0.5) / rate;
        // THE APPROACH IS THE ONE MOVE THAT LEAVES THE KEY, and that is the
        // whole of it: a SEMITONE, onto a STRONG beat, resolving immediately.
        // Both halves are what make it hear as an approach rather than as a
        // wrong note, and it is the only thing this file emits that is outside
        // the bar's own alphabet — §9 of the unit gate carves out exactly this
        // and nothing else. A grace is the alphabet's own neighbour, anywhere.
        if (o.approach && strong && die(e, ORNSALT.approach) < o.approach) {
          if (leadIn(list, k, e.n + dir, len, "approach", 2, t0)) { touched = true; continue; }
        }
        if (o.grace && die(e, ORNSALT.grace) < o.grace) {
          if (leadIn(list, k, ornStep(e.n, dir, pcsAt(barOf(e))), len, "grace", 2, t0)) {
            touched = true; continue;
          }
        }
        if (o.flam && die(e, ORNSALT.flam) < o.flam) {
          if (leadIn(list, k, e.n, len * 0.6, "flam", 3, t0)) { touched = true; continue; }
        }
      }
      // PASSING TONES, a second walk because they are the one move that is
      // about a PAIR of notes rather than about one: a leap of a third or a
      // fourth with a note's worth of room in it gets the step between, taken
      // out of the first note's own length. Anything wider than a fourth wants
      // two or three passing notes and a real melodic decision, and a machine
      // guessing at that is how a line turns into a scale exercise.
      if (o.pass) for (let k = list.length - 2; k >= 0; k--) {
        const a = list[k], b2 = list[k + 1];
        if (a.orn || a.omark || b2.orn || b2.omark) continue;
        const gap = Math.abs(b2.n - a.n);
        if (gap < 3 || gap > 5) continue;
        if (a.dur * rate < 0.7) continue;          // nowhere to put it
        if (die(a, ORNSALT.pass) >= o.pass) continue;
        const dir = b2.n > a.n ? 1 : -1;
        // ALWAYS the alphabet's own step, never a semitone: a chromatic filler
        // is what the approach term is for, and a passing tone that leaves the
        // key on a weak beat is just a wrong note with a job title
        const mid = ornStep(a.n, dir, pcsAt(barOf(a)));
        if (mid === a.n || (mid - a.n) * dir >= gap) continue;   // no note in between
        const half = a.t + a.dur * 0.5;
        if (half >= b2.t - 0.01) continue;
        a.dur = a.dur * 0.5 * 0.9;
        list.splice(k + 1, 0, { ...a, t: half, dur: (b2.t - half) * 0.9, n: mid,
                                acc: 0, sld: 0,
                                vel: Math.max(1, (a.vel == null ? 5 : a.vel) - 1),
                                orn: "pass" });
        touched = true;
      }
    }
    if (!touched) return ev;
    for (const list of lanes.values()) for (const e of list) pass.push(e);
    return pass.sort((a, b2) => a.t - b2.t);
  }

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

  // ---- THE PERFORMANCE: stress, phrase, touch -------------------------------
  // AN EIGHTH TYPE, and the argument is the same shape as every other one here:
  // nothing already in the pipeline can say this. An operator is timeless and
  // runs before pitch exists; an envelope is one curve over the whole SECTION
  // and level-only; an edge rewrites one bar at a known end; a bar schedule
  // changes which notes exist; a pipe adds derived notes; and GROOVE — the
  // closest relative — is a fixed sixteen-slot fingerprint that lands on every
  // bar of every loop with the identical numbers. What was missing is the part
  // a PLAYER adds to a bar they have already played once.
  //
  // MEASURED, before this existed: all 45 genres rendered a mean velocity of
  // 6.90, a standard deviation of 1.45 and a range of 4..9 — the SAME three
  // numbers for every genre, because all 45 read the same eight values off the
  // phrase's `vel` vector and nothing downstream was a function of where the
  // note sat in the bar or of which pass this was. That is exactly the
  // "everything plays around the same, extremely synthesized and robotic" the
  // ears reported, written as statistics.
  //
  // Three terms, all genre-scoped, all opt-in, all absent = byte-identical:
  //   g.stress  0..1     METRICAL accent — 1 is heavier than 3, 3 than 2 and 4,
  //                      the beat than the "and", the "and" than the sixteenth
  //                      between them. Scaled per genre because a machine has
  //                      no metre in its hands and a soul band is mostly metre.
  //   g.phrase  0..1     the line's own ARCH, read off the LINE and not from a
  //                      stored curve: the tent peaks on the bar's highest note
  //                      and tapers to both ends, and the peak is held a hair
  //                      longer — the agogic half of an accent, which is how a
  //                      player leans on a note without simply hitting it.
  //   g.touch   n|{t,v}  the HAND: seeded micro-timing (steps) and micro-level
  //                      (velocity units), drawn as a function of the BAR, so
  //                      bar 3 is not bar 1 with the same numbers. Same field
  //                      shape and same dice as the kit's `g.humanize`, because
  //                      it is the same idea one voice family over.
  //
  // What none of the three does is add, remove or re-pitch a note: they move
  // level, they move duration by a hair, and they move time by less than a
  // step. A performance is not a rewrite.
  //
  // The metrical hierarchy, in weights. `q` is the quarter in THIS pattern's
  // own step units, so a twelve-step bar stresses its three beats rather than
  // an imaginary four.
  const stressAt = (i, N) => {
    const q = N / 4, j = ((i % N) + N) % N;
    if (j === 0) return 1;                                        // the downbeat
    if (q >= 1 && j % q === 0) return j === 2 * q ? 0.55 : 0.3;   // 3, then 2 and 4
    if (q >= 2 && j % (q / 2) === 0) return -0.15;                // the eighths
    return -0.6;                                                  // and between them
  };
  // The genre's own dice salt, off its LABEL rather than a new stored field:
  // two genres must not make the same mistake in the same bar, every genre
  // already has a label, and a field nobody would ever set by hand is a field
  // that rots. FNV-1a, the same hash compose.js salts its streams with.
  // (named for what it hashes, not for what it is: `salt` is already rollAt's
  // own parameter name one screen down, and two salts in one file is one too
  // many)
  const labelHash = s => {
    let h = 0x811C9DC5;
    for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  };
  // one die, thrown at a named place: the genre's kit salt (so a genre that
  // already rolls dice keeps ONE set of them) crossed with its label, then the
  // kit's own positional hash. Shared by the line, the bass and the pad's
  // per-bar breath so all three read the same book.
  const perfDice = (g, b, i, lane, s) =>
    rollAt((g.kitSeed | 0) ^ labelHash(g.label || ""), b, i, lane, s);
  // A CHORD MOVES AS ONE. The pad and the stab are the two places where a
  // single event in the score is several events in the stream, and the terms
  // that apply to them are the ones a CHORD can carry together: the metre it
  // lands on, and one level draw for the whole voicing. The other two terms are
  // meaningless here and would be actively wrong — a phrase tent across a
  // voicing would peak on whichever note the voice-leading happened to put on
  // top, and a per-note timing draw would spread a chord into an accident.
  // Without this a pad and a skank play the identical velocity in every bar of
  // every loop, which on a pad-led or stab-led genre is most of what you hear.
  const chordFeel = (g, b, i, lane, N) => {
    const st = +g.stress || 0, feel = humanOf(g.touch);
    if (!st && !feel) return null;
    let dv = st ? 2.4 * st * stressAt(i, N) : 0;
    if (feel && feel.v) dv += (perfDice(g, b, i, lane, 6) * 2 - 1) * feel.v;
    return { dv, push: feel && feel.t ? (perfDice(g, b, i, lane, 4) * 2 - 1) * feel.t / g.rate : 0 };
  };
  const leaned = (v, dv) => Math.max(0, Math.min(9, Math.round((v == null ? 5 : v) + dv)));
  // `bar` is ONE voice's ONE bar, in step order, freshly built and safe to
  // mutate; `steps` is the parallel step index, which the events themselves no
  // longer carry once swing and the bar offset are baked into `t`. Level and
  // duration first, time second — the agogic cap reads the NEXT onset, and
  // reading one that has already been nudged would make the cap a function of
  // the dice rather than of the grid.
  //
  // `o` carries the three facts perform cannot see from the events alone:
  //   lane    which voice's dice to throw (see rollAt: a pure hash of WHERE)
  //   ontime  this material is tied and its clock must not be touched
  //   hold    per-note, the LONGEST this note may legally sound — the span the
  //           articulation shortened, after maxHold had its say. The agogic
  //           peak borrows from the articulation's gap and from nothing else:
  //           a note lengthened past its own span is a note played over the one
  //           after it, and a note lengthened past `maxHold` is the rest that
  //           `breath` exists to create, quietly filled back in.
  const perform = (bar, steps, g, b, N, o) => {
    const lane = o.lane, ontime = o.ontime, hold = o.hold;
    const st = +g.stress || 0, ph = +g.phrase || 0, feel = humanOf(g.touch);
    const m = bar.length;
    if ((!st && !ph && !feel) || !m) return false;
    // THE PEAK IS THE LINE'S OWN. Ties go to the first: the first time a phrase
    // reaches the top is the arrival, the second is a repeat of it.
    let pk = 0;
    for (let k = 1; k < m; k++) if (bar[k].n > bar[pk].n) pk = k;
    for (let k = 0; k < m; k++) {
      const e = bar[k];
      let d = st ? 2.4 * st * stressAt(steps[k], N) : 0;
      // two notes have no arch to hear, so the tent starts at three
      if (ph && m >= 3) {
        const tent = k <= pk ? (pk ? k / pk : 1) : (m - 1 - k) / (m - 1 - pk);
        d += 2 * ph * (tent - 0.5);
        if (k === pk) {
          let grow = e.dur * (1 + 0.35 * ph);
          if (hold) grow = Math.min(grow, hold[k]);
          // never long enough to run into the note after it — that would be a
          // tie, not an accent
          e.dur = k + 1 < m ? Math.min(grow, Math.max(e.dur, bar[k + 1].t - e.t)) : grow;
        }
      }
      if (feel && feel.v) d += (perfDice(g, b, steps[k], lane, 5) * 2 - 1) * feel.v;
      if (d) e.vel = leaned(e.vel, d);
    }
    // ONTIME material keeps its grid. Under `tie` the render folds consecutive
    // same-pitch events that meet END TO END into one held note, and it decides
    // that on a 1e-6 comparison — so a hand that moves an onset by a hair is a
    // hand that un-ties every tie and turns a held drone back into the
    // machine-gun the tie exists to prevent. Level and the agogic peak still
    // apply; only the clock is left alone.
    if (feel && feel.t && !ontime) {
      // THE HAND STRAYS INSIDE THE BAR, exactly as it does on the kit: a note
      // nudged past its own bar line is a note in the NEXT bar, and at a
      // section edge the window simply cuts it.
      const t0 = (b * N) / g.rate, t1 = ((b + 1) * N) / g.rate;
      for (let k = 0; k < m; k++) {
        const push = (perfDice(g, b, steps[k], lane, 4) * 2 - 1) * feel.t / g.rate;
        bar[k].t = Math.min(t1 - 1e-9, Math.max(t0, bar[k].t + push));
      }
    }
    return true;
  };

  function render(subj, g, bars) {
    // A DRUM PHRASE has no pitches — drums() plays it, this never does.
    if (subj && subj.kind === "drum") return [];
    const N = subj.deg.length, ev = [], key = g.key | 0;
    // the alphabet an ornament leans through, per bar and memoized (see
    // ORNAMENTS above — under a chord cycle the notes available move with the
    // root, so this cannot be one set for the whole render)
    const ornAt = ornAlphabet(subj, g, key);
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
        // a phrase with no mark on it costs one `some` per bar and nothing else
        const marked = !!p.orn && p.orn.some(Boolean);
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
        // THE LONG NOTE IS THE ONE THE EAR ARGUES WITH. Every follow mechanism
        // above keeps the line in the KEY; none of them keeps it on the CHORD,
        // and in an alphabet whose degrees are not the chord's rungs those are
        // different things. Two ways it goes wrong, both measured:
        //   * a second voice carrying its own `transpose(-2)` is a third below
        //     the SCALE, not below the chord — so wherever the lead is on the
        //     root the answer is on the ♭6. PIPES.harmonize's own comment says
        //     this ("transpose(2) is scale-parallel and clashes"); the pipe
        //     fixed it for a derived harmony line and nothing fixed it for a
        //     written one.
        //   * the dominant is the one chord in a minor key whose scale is not
        //     the tonic's, so a degree-follow onto V sounds the ♭6 and the ♭3
        //     against its G and D — a minor ninth against the pad, held.
        // `anchor` is the rule the ear actually applies: a note that SOUNDS
        // through more than `anchor` steps has to be a chord tone, and moves to
        // the nearest one; anything shorter passes and is left exactly as the
        // alphabet wrote it. That is where the colour lives, so this is not a
        // flattening — the ♭9 over the dominant still sounds, it just stops
        // being the note the bar sits on. It moves by a semitone or a whole
        // tone or not at all: a note more than two semitones from every chord
        // tone is a deliberate outside note, not a near miss, and lurching it
        // into place would be the flattening. Absent = untouched, byte for byte.
        //
        // KEEP GOING THE WAY THE LINE WAS GOING. Both neighbours are often the
        // same distance away, and resolving downwards by reflex turns a rising
        // phrase into a repeated note — measured, tango's third bar came out
        // E♭ E♭ E♭. Carrying the direction of travel makes the anchored note a
        // continuation of the gesture instead of a stall. `prevN` lives with
        // the rest of the per-bar state, so a bar line starts a fresh gesture
        // rather than inheriting the last note of the one before.
        const anchor = g.anchor || 0;
        let prevN = null;
        const anchored = (n, sounding, set) => {
          if (!anchor || !set || sounding <= anchor) return n;
          if (set.has(((n % 12) + 12) % 12)) return n;
          const up = prevN != null && n > prevN ? 1 : -1;
          for (let d = 1; d <= 2; d++)
            for (const s of [up, -up]) {
              const x = n + s * d;
              if (set.has(((x % 12) + 12) % 12)) return x;
            }
          return n;
        };
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
            // A PAD BREATHES BAR TO BAR (chordFeel, above) — but it never
            // MOVES: it holds to the next chord, so a pushed pad is a hole in
            // the harmony rather than a lean.
            const cf = chordFeel(g, b, first, String.fromCharCode(97 + (v % 26)), N);
            const from = ev.length;
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
                // A VOICE-LED PAD MAY NOT WALK OUT OF THE ROOM — for a genre
                // that asks. Leading from the last voicing is what makes
                // chords move smoothly and over enough bars it can walk
                // downhill: found at MIDI 21 on a random record, two octaves
                // under where the chair sits. Five genres in the catalog
                // (jodeci, gospel, bossa…) voice wider than two octaves on
                // purpose, so this is `padRoom` rather than a law.
                if (g.padRoom) voicing = voicing.map((n) => { let x = n;
                  while (x < ctr - 24) x += 12;
                  while (x > ctr + 12) x -= 12;
                  return x; });
                for (const n of voicing)
                  ev.push({ t: (b * N + c.start) / g.rate, dur: c.len / g.rate, v, part,
                            n: n + key, acc: 0, sld: 0, vel: vel(p, first) });
              }
            }
            if (cf && cf.dv)
              for (let k = from; k < ev.length; k++) ev[k].vel = leaned(ev[k].vel, cf.dv);
          }
          continue;
        }
        // A STAB fires on its OWN gate vector but voices the sounding chord —
        // chordLock is what makes an offbeat skank sayable at all: the pad
        // path above fires once a bar at the phrase's first gate, full stop.
        if (pol.chordLock) {
          const lane = String.fromCharCode(97 + (v % 26));
          const t0 = (b * N) / g.rate, t1 = ((b + 1) * N) / g.rate;
          for (let i = 0; i < N; i++) {
            if (!p.gate[i]) continue;
            const c = chordFor(i), hold = Math.min(sp[i], pol.maxHold || 1);
            // the stab is the one chord that DOES move: a skank that lands
            // dead on the grid every time is the drum machine playing a
            // guitar. It moves as one, though — see chordFeel.
            const cf = chordFeel(g, b, i, lane, N);
            const t = Math.min(t1 - 1e-9, Math.max(t0,
              (b * N + i + swing(g, i)) / g.rate + (cf ? cf.push : 0)));
            for (const n of c.pcs)
              ev.push({ t, dur: hold * 0.92 / g.rate,
                        v, part, n: fold(n, ctr) + key, acc: p.acc[i], sld: 0,
                        vel: cf ? leaned(vel(p, i), cf.dv) : vel(p, i) });
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
        const barEv = [], barAt = [], barHold = [];
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
              ? anchored(set
                  ? chordWalk(pitch(dg, sc) + shift + rs + 12 * p.oct[i],
                              rampOf(p, i, b, clamp, cmode, subj), set)
                  : pitch(dg + rampOf(p, i, b, clamp, cmode, subj), sc) + shift + rs + 12 * p.oct[i],
                  held * legato, set)
              : fold(n, ctr);                                    // chords voice per note
            prevN = pitchOf;
            barEv.push({ t: (b * N + i + swing(g, i)) / g.rate, dur: held * legato / g.rate, v, part,
                         n: pitchOf + key, acc: p.acc[i], sld: p.sld[i], vel: vel(p, i) });
            barAt.push(i); barHold.push(held / g.rate);
          }
        }
        // THE PERFORMANCE (the eighth type, above) runs on the bar the voice
        // just played, before the tie pass folds any of it together — it has to
        // see the notes as separate events to find the phrase's peak, and a
        // tied pair is ONE note by the time the fold is done. Pads and stabs
        // never reach here (both `continue` above), which is right: a held
        // chord has no contour and a chord-locked stab's peak would be
        // whichever voicing note happened to land on top.
        perform(barEv, barAt, g, b, N, { lane: String.fromCharCode(97 + (v % 26)),
                                         ontime: artic === "tie", hold: barHold });
        // THE MARKS (the ninth type, above), in the same window and one step
        // later: the hand's own grace notes, flams and rolls, read off the
        // step each note was written on. After the performance so an ornament
        // inherits the level the player just leaned into, before the tie fold
        // so a rolled note is still several events when the fold looks at it.
        if (marked) markBar(barEv, barAt, p.orn, g, N, b, ornAt(b));
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
    const sorted = ev.sort((a, b) => a.t - b.t);
    // THE GENRE'S OWN ORNAMENT PASS (the ninth type, above), before the pipes
    // and after everything that decided what the notes ARE: what a style adds
    // to a line it has already written. A genre with no `g.orn` returns the
    // same array object, so this is one property read for every anchor that
    // predates it.
    const out = ornament(sorted, g, { stepsPerBar: N, rate: g.rate, pcsAt: ornAt });
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

  // ---- THE KIT: TWELVE LANES, FOUR VECTORS ---------------------------------
  // WHAT WAS MISSING. found/samples/drums/<kit>/ has shipped TWELVE samples per
  // kit since the day it was extracted — kick snare hatClosed hatOpen hatPedal
  // clap rim ride crash tomHi tomMid tomLo — and this vocabulary knew six of
  // them. So there were no toms, which means the oldest fill there is could not
  // be written; no ride, so every genre kept time on the same two plates; and
  // the crashes in intro()/outro() were spelled "o" — an OPEN HAT — because
  // there was no cymbal lane to hit. LANES is the whole kit. The six letters
  // that already existed keep their letters and their meaning, so every kit in
  // genres.js renders byte for byte.
  //
  // `limb` is not decoration. It is what makes `linear` sayable at all — no two
  // limbs on one tick is the DEFINITION of a linear groove — and it is why the
  // pedal hat is a foot even though the closed hat it doubles is a hand.
  const LANES = {
    k: { name: "kick",      limb: "foot", kind: "drum" },
    s: { name: "snare",     limb: "hand", kind: "drum" },
    p: { name: "rim",       limb: "hand", kind: "drum" },
    c: { name: "clap",      limb: "hand", kind: "drum" },
    t: { name: "high tom",  limb: "hand", kind: "tom" },
    m: { name: "mid tom",   limb: "hand", kind: "tom" },
    l: { name: "low tom",   limb: "hand", kind: "tom" },
    h: { name: "hat",       limb: "hand", kind: "hat" },
    o: { name: "open hat",  limb: "hand", kind: "hat" },
    f: { name: "pedal hat", limb: "foot", kind: "hat" },
    r: { name: "ride",      limb: "hand", kind: "cymbal" },
    x: { name: "crash",     limb: "hand", kind: "cymbal" },
  };
  const TOMS = ["t", "m", "l"], HATS = ["h", "o", "f"], CYMBALS = ["r", "x"];
  // WHO WINS A TICK when only one limb may sound: the parts of the kit that
  // carry the form beat the parts that carry the time. This is the linear
  // drummer's own priority, written down.
  const LIMBORDER = ["x", "k", "s", "t", "m", "l", "c", "p", "r", "o", "f", "h"];

  // A DRUM PHRASE is a phrase of a second KIND (kind:"drum"), not a variation
  // of the melodic one: a hand-tapped lane grid rather than deg/oct/gate. It
  // plays the seven voices a step sequencer actually offers — the LANES
  // subset a person reaches for, not the full twelve-lane alphabet a genre
  // author writes kits in code with (no ride, no crash, no pedal hat: those
  // stay genre-authored colour). DROPPED INTO A SECTION'S SLOT, it OVERRIDES
  // that section's genre kit for exactly its own bars — see drums() below,
  // the one place that reads it — and taking it back out reverts the section
  // to the genre's own kit, because nothing else in the render path ever
  // learns the phrase was there.
  const DRUM_LANES = ["k", "s", "h", "o", "c", "p", "t"];
  // ONE VECTOR PER LANE (no chance/nudge/grace sidecars — a drum phrase is
  // played back exactly as it was tapped in, not diced per bar the way a
  // genre's own kit is), each step an integer 0..7: a small enum naming HOW
  // the lane sounds there, not a level. Four of the eight values are the
  // MELODIC `orn` vocabulary's own values, reused rather than reinvented — a
  // flam ahead of the beat and a roll inside a step mean exactly the same
  // thing on a drum lane that they mean on a melodic one.
  const DMARK = { NONE: 0, HIT: 1, ACCENT: 2, GHOST: 3, FLAM: 4,
                  ROLL2: 5, ROLL3: 6, ROLL4: 7 };
  // the phrase's OWN shuffle — a single knob, not a per-step vector, because
  // a drum pattern's feel is one setting for the whole grid the way a real
  // machine's shuffle dial is. Same three fractions fields.js SWINGS already
  // proved (straight/light/swing/shuffle), read by INDEX so a saved phrase
  // never carries a raw float a future retune would have to chase down.
  const DRUM_SWING = [0, 0.12, 0.22, 1 / 3];

  // FOUR VECTORS PER LANE, ONE ALPHABET. A kit is key -> sixteen integers; the
  // key says which of four things those integers are.
  //
  //   d    LEVEL   0 silent · 1 play (defer to kitVel, then to the phrase's own
  //                velocity) · 2..9 play at exactly this velocity. 1 IS the old
  //                binary "on", which is why the widening costs nothing: every
  //                kit ever written is already in the new alphabet.
  //   ?d   CHANCE  0..9 — the odds this step sounds at all, drawn per BAR from
  //                a seeded hash. Absent = certain. This is the one thing in
  //                the kit that is different on bar 2 from bar 1.
  //   ~d   NUDGE   signed ninths of a step — the hand that is not on the grid.
  //   !d   GRACE   how many grace hits lead this one: 1 flam, 2 drag, 3 ruff.
  //                A flam is two hits a hair apart and there is no way to say
  //                that on a sixteen-step grid, so it is not a step, it is a
  //                property OF a step.
  //
  // All four are sixteen-slot integer vectors ON PURPOSE: every operator that
  // rotates, shifts, thins or double-times a lane moves that lane's chance,
  // nudge and grace with it for free, because mapKit never has to know which
  // is which. A key that is not a lane letter is not a lane — drums() reads
  // the sidecars WITH their lane and never as one.
  const MARK = /^[?~!]/;
  const bare = key => key.replace(MARK, "");
  const laneIds = k => Object.keys(k || {}).filter(d => LANES[d]);

  // THE DICE ARE A FUNCTION, NOT A STREAM. A sequential PRNG would make the
  // chance vectors order-dependent — adding a lane, or reordering the kit's
  // keys, would shift every later lane's draws — and two renders of one state
  // have to be identical. So every draw is a pure hash of WHERE it was asked:
  // seed, bar, step, lane, and a salt that keeps the chance draw, the timing
  // draw and the velocity draw from being the same number three times.
  const rollAt = (seed, bar, i, lane, salt) => {
    let h = ((seed | 0) ^ 0x9E3779B9) >>> 0;
    h = Math.imul(h ^ (bar + 0x85EBCA6B), 0xC2B2AE35);
    h = Math.imul(h ^ (i * 2654435761 + salt), 0x165667B1);
    h = Math.imul(h ^ lane.charCodeAt(0), 0x9E3779B1);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  };
  // HUMANIZE, as genre data: `g.humanize` is either a number (how far the hand
  // strays from the grid, in steps) or {t, v}. Unlike the baked `~` vector it
  // is redrawn every bar, because a drummer does not make the same mistake
  // sixteen times — and it never adds or removes a hit, which is the whole
  // difference between humanizing and rewriting.
  const humanOf = h => (!h ? null
    : typeof h === "number" ? { t: h, v: 1 }
    : { t: h.t || 0, v: h.v || 0 });

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
  // the small change of vocabulary the new operators are written in: copy a
  // kit, drop lanes WITH their sidecars, merge one lane's hits into another,
  // and write a sixteen-slot vector from a predicate
  const cp = k => mapKit(k, v => v.slice());
  const without = (k, pred) => Object.fromEntries(
    Object.entries(cp(k)).filter(([key]) => !pred(bare(key))));
  const mergeInto = (a, b) => K16(b).map((x, i) => Math.max(x, a ? at(a, i) : 0));
  const vec16 = f => Array.from({ length: 16 }, (_, i) => f(i) || 0);
  const hits = v => (v ? K16(v).some(Boolean) : false);
  const KITOPS = {
    nodrums:  () => ({}),
    // SUBTRACTIVE — take one lane away. Muting the kick is a breakdown; muting
    // the hats is the same phrase heard from further off.
    // ...and a lane goes WITH its sidecars: dropping the hats and leaving
    // their chance vector behind would leave a `?h` in the kit describing odds
    // for a lane that is not there. Kits in genres.js carry no sidecars, so
    // this is byte-identical to the filter these three used to be.
    nokick:   k => without(k, d => d === "k"),
    nohats:   k => without(k, d => d === "h" || d === "o"),
    snareonly: k => without(k, d => d !== "s" && d !== "c"),
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

    /* ---- THE REST OF THE KIT ---------------------------------------------
       Thirteen operators was a list of tricks. What follows is meant as a
       VOCABULARY: every entry below is a thing a drummer does, argued in its
       own comment, and every one is still a total kit -> kit function. Three
       standing laws, which the gate holds:
         * a lane the kit does not have is left alone. The exceptions are
           declared (see WRITES in test/unit/nukernel.test.js §14) and they are
           exceptions because "put a crash on the downbeat" is a REQUEST, not a
           rearrangement of what is there.
         * nothing here turns an EMPTY kit into a kit except the named patterns
           and the four-on-the-floor family — a fugue that grows a tom fill is
           not what "vary the drums" means.
         * an operator may write levels, chances, nudges and graces, because
           those are the same sixteen-slot vectors the lane itself is. */

    // ---- THE TIMEKEEPING HAND MOVES ----
    // Same groove, different metal, and it is the loudest change of colour a
    // kit has: a ride is a stick on a bell, a hat is two plates being pinched.
    // Everything the hats were doing — closed, open and pedal — lands on the
    // ride, because it is ONE HAND and it cannot be in two places.
    ride:     k => moveTime(k, "r"),
    // ...and onto a drum instead of metal: the floor-tom pulse under a chorus,
    // which every arranger reaches for and no rearrangement of a hat can say.
    tomtime:  k => moveTime(k, "l"),
    // THE FOOT. A pedal hat on 2 and 4 under everything else is what a real
    // drummer's left foot does all night and no drum machine has ever done.
    pedal:    k => (laneIds(k).length ? { ...cp(k), f: vec16(i => (i === 4 || i === 12 ? 1 : 0)) } : cp(k)),
    // OPEN ON THE AND. The closed hat lifts on the last eighth of each beat —
    // the single most common thing done to a hat pattern, and it needs the
    // open lane to be a lane rather than a lane the fill happened to carry.
    opens:    k => (hits(k && k.h)
                    ? { ...cp(k), h: K16(k.h).map((x, i) => (i % 4 === 2 ? 0 : x)),
                        o: mergeInto(k.o, K16(k.h).map((x, i) => (i % 4 === 2 ? x : 0))) }
                    : cp(k)),
    // SHUFFLE. The hat plays the first and last third of the beat, which on a
    // sixteen-step grid is 1 and the "a" — the triplet feel written as a kit
    // fact rather than as swing on the whole box.
    shuffle:  k => (hits(k && k.h)
                    ? { ...cp(k), h: vec16(i => (i % 4 === 0 || i % 4 === 3 ? 1 : 0)) } : cp(k)),

    // ---- CYMBALS ----
    // CRASH ON ONE — the cymbal that says a new phrase starts here, which is
    // the one drum idea that is about FORM rather than groove. A writer, like
    // `four`, and for the same reason.
    crash:    k => ({ ...cp(k), x: vec16(i => (i === 0 ? 9 : 0)) }),
    // and the other placement worth having: the crash lands with the backbeat
    // instead of the downbeat — the eighties record, the gated snare's twin.
    crashback: k => ({ ...cp(k), x: vec16(i => (i === 4 || i === 12 ? 8 : 0)) }),

    // ---- THE SNARE HAND ----
    // The backbeat, said out loud: whatever the snare was doing, it is now on
    // 2 and 4. The most conventional gesture in the table and the one most
    // often wanted, because it is how you make anything sound like a record.
    backbeat: k => (laneIds(k).length ? { ...cp(k), s: vec16(i => (i === 4 || i === 12 ? 1 : 0)) } : cp(k)),
    // ...and the other place a snare goes: beat 3 alone. Half-time, and it is
    // a different genre rather than a slower one — the same tempo underneath.
    onthree:  k => (laneIds(k).length ? { ...cp(k), s: vec16(i => (i === 8 ? 1 : 0)) } : cp(k)),
    // CROSS-STICK. The snare hand turns the stick over and plays the rim: the
    // verse version of the same part, quiet enough to sing over.
    stickside: k => (hits(k && k.s)
                     ? { ...without(k, d => d === "s"), p: mergeInto(k.p, k.s) } : cp(k)),
    // the snare answered by a clap on the same beats — the disco/gospel double
    claps:    k => (hits(k && k.s) ? { ...cp(k), c: mergeInto(k.c, k.s) } : cp(k)),
    // GHOSTS. The quietest thing in the bar and the reason it swings: a snare
    // at level 2 on the "a" of every beat the snare and kick have both left
    // alone. Level, not gate — a ghost played at full velocity is just a busy
    // snare, which is exactly what the binary kit could say and nothing else.
    ghosts:   k => (hits(k && k.s)
                    ? { ...cp(k), s: K16(k.s).map((x, i) =>
                        (x || (i % 4 === 3 && !at(k.k || [], i) ? 2 : 0))) } : cp(k)),
    // FLAM and DRAG: one grace hit before the snare, or two. The oldest
    // rudiments there are, and unsayable until a step could carry a property.
    flams:    k => (hits(k && k.s) ? { ...cp(k), "!s": K16(k.s).map(x => (x ? 1 : 0)) } : cp(k)),
    drags:    k => (hits(k && k.s) ? { ...cp(k), "!s": K16(k.s).map(x => (x ? 2 : 0)) } : cp(k)),

    // ---- THE KICK FOOT ----
    // Every kick gets a sixteenth behind it where there is room — the double
    // that turns a straight beat into a bounce, and the reason a kick lane is
    // worth manipulating at all rather than being the metronome.
    kickdoubles: k => (hits(k && k.k)
                       ? { ...cp(k), k: (v => K16(v).map((x, i) => x || (at(v, i - 1) && !at(v, i) ? 1 : 0)))(K16(k.k)) }
                       : cp(k)),

    // ---- TOMS: the oldest fill there is ----
    // The last quarter of EVERY bar is a descending tom run, with the hand
    // that was keeping time taken off it — a fill you cannot hear over the
    // hats is not a fill. This is the groove-level tom fill; outro("tomfill")
    // is the once-per-section one.
    tomfill:  k => (laneIds(k).length
                    ? { ...mapKit(k, (v, d) => (LANES[d] && d !== "k"
                          ? K16(v).map((x, i) => (i >= 12 ? 0 : x)) : v.slice())),
                        t: vec16(i => (i === 12 ? 8 : 0)),
                        m: vec16(i => (i === 13 || i === 14 ? 7 : 0)),
                        l: vec16(i => (i === 15 ? 9 : 0)) }
                    : cp(k)),
    // the whole bar as toms: the tribal/Burundi groove, where the drums stop
    // keeping time and start being the tune
    tomrun:   k => (laneIds(k).length
                    ? { ...without(k, d => d !== "k"),
                        t: vec16(i => (i % 8 === 2 ? 7 : 0)),
                        m: vec16(i => (i % 8 === 4 ? 6 : 0)),
                        l: vec16(i => (i % 4 === 0 ? 9 : 0)) }
                    : cp(k)),
    // a tom ROLL rather than a run: sixteenths down the toms into the bar line
    tomroll:  k => (laneIds(k).length
                    ? { ...cp(k), t: vec16(i => (i === 12 || i === 13 ? 6 : 0)),
                        m: vec16(i => (i === 14 ? 7 : 0)),
                        l: vec16(i => (i === 15 ? 9 : 0)) }
                    : cp(k)),

    // ---- DENSITY, DYNAMICS AND THE HAND ----
    // LINEAR. No two limbs land on the same tick — the defining rule of linear
    // drumming, and the one groove idea that is a CONSTRAINT rather than a
    // pattern. Ticks are dealt in LIMBORDER, so the kick keeps its downbeat and
    // the hat fills what is left, which is what a linear player actually plays.
    linear:   k => {
      const order = laneIds(k).sort((a, b) => LIMBORDER.indexOf(a) - LIMBORDER.indexOf(b));
      const taken = new Array(16).fill(false), out = cp(k);
      for (const d of order)
        out[d] = K16(k[d]).map((x, i) => {
          if (!x) return 0;
          if (taken[i]) return 0;
          taken[i] = true; return x;
        });
      return out;
    },
    // ACCENTS. Loud on the quarters, medium on the eighths, quiet between —
    // one hand's worth of emphasis written onto every lane at once. This is
    // the level alphabet doing the job velocity vectors did per genre.
    // (the test is LANES[d], on the whole key, not on the bare lane: "?h" is
    // the hat's odds, and a level operator that rewrote those as velocities
    // would be silently turning a chance vector into a dynamic)
    accents:  k => mapKit(k, (v, d) => (LANES[d]
      ? K16(v).map((x, i) => (x ? (i % 4 === 0 ? 9 : i % 2 === 0 ? 6 : 3) : 0)) : v.slice())),
    // and the other dynamic shape a bar can have: quiet to loud across it
    crescendo: k => mapKit(k, (v, d) => (LANES[d]
      ? K16(v).map((x, i) => (x ? 2 + Math.round(i * 7 / 15) : 0)) : v.slice())),
    soft:     k => mapKit(k, (v, d) => (LANES[d] ? K16(v).map(x => (x ? 3 : 0)) : v.slice())),
    loud:     k => mapKit(k, (v, d) => (LANES[d] ? K16(v).map(x => (x ? 9 : 0)) : v.slice())),
    // HUMANIZE — a hand, baked. Seeded micro-timing on every lane (the `~`
    // vector, in ninths of a step) plus a seeded weight per hit. It REPLACES a
    // genre's written dynamics rather than perturbing them, and that is honest
    // rather than sloppy: a level of 1 means "defer", and there is no way to
    // jitter a value you have deferred. Deterministic, so the same box is the
    // same performance every play; `g.humanize` is the per-BAR version.
    humanize: k => Object.fromEntries(Object.entries(cp(k)).flatMap(([key, v]) => {
      const d = bare(key);
      if (!LANES[key]) return [[key, v]];               // a sidecar rides along
      return [[key, K16(v).map((x, i) => (x ? 3 + Math.round(rollAt(7, 0, i, d, 2) * 6) : 0))],
              ["~" + d, vec16(i => Math.round(rollAt(7, 0, i, d, 1) * 4) - 2)]];
    })),
    // ...and its inverse, which is also a sound: the machine. Every sidecar
    // comes off and every hit goes back to "just play it".
    tight:    k => Object.fromEntries(Object.entries(cp(k))
      .filter(([key]) => LANES[key])
      .map(([d, v]) => [d, K16(v).map(x => (x ? 1 : 0))])),
    // PROBABILITY. `maybe` leaves the downbeats and the kick alone and makes
    // everything else a seven-in-nine chance; `chaos` puts the whole kit on
    // four in nine. Drawn per BAR, so this is the only operator whose output
    // is different in bar 2 — a dropout you cannot predict and can reproduce.
    maybe:    k => withChance(k, (d, i) => (d === "k" || i % 4 === 0 ? 9 : 7)),
    chaos:    k => withChance(k, (d, i) => (i === 0 ? 9 : 4)),

    // ---- NAMED PATTERNS ----
    // A genre sometimes wants a SPECIFIC beat, not a transformation of the one
    // it has, and pretending otherwise is how every "vary the drums" control
    // ends up sounding like the same drummer. These five replace the kit
    // outright, and they are the other family (with `four`/`offbeat`) allowed
    // to write onto an empty one, because asking for the amen break is asking
    // for the amen break.
    disco:    k => ({ ...cp(k), k: vec16(i => (i % 4 === 0 ? 1 : 0)),
                      o: vec16(i => (i % 4 === 2 ? 1 : 0)),
                      c: vec16(i => (i === 4 || i === 12 ? 1 : 0)) }),
    stomp:    k => ({ ...cp(k), k: vec16(i => (i === 0 || i === 4 ? 9 : 0)),
                      c: vec16(i => (i === 8 ? 9 : 0)),
                      h: vec16(() => 0) }),
    // the 3-3-2, which is most of the world's dance music in one vector
    tresillo: k => ({ ...cp(k), k: vec16(i => (i === 0 || i === 6 || i === 12 ? 1 : 0)),
                      s: vec16(i => (i === 8 ? 1 : 0)),
                      h: vec16(i => (i % 2 === 0 ? 1 : 0)) }),
    // son clave, 3-2, on the rim — the pattern the bass and the horns hang off
    clave:    k => ({ ...cp(k), p: vec16(i => ([0, 3, 6, 10, 12].includes(i) ? 8 : 0)) }),
    // the amen bar, ghosts and all: the break that dance music was built on
    amen:     k => ({ ...cp(k), k: vec16(i => (i === 0 || i === 10 ? 9 : 0)),
                      s: vec16(i => (i === 4 || i === 12 ? 9 : i === 2 || i === 14 ? 2 : 0)),
                      r: vec16(i => (i % 2 === 0 ? 5 : 0)),
                      h: vec16(() => 0) }),
    // the motorik: kick on 1, the "and" of 2 and 3, snare on the backbeat,
    // sixteenths on top and nothing ever changing — a whole genre as a vector
    motorik:  k => ({ ...cp(k), k: vec16(i => (i === 0 || i === 6 || i === 8 ? 1 : 0)),
                      s: vec16(i => (i === 4 || i === 12 ? 1 : 0)),
                      h: vec16(() => 1) }),
    // and the fastest thing the kit can do: kick and snare alternating
    // sixteenths under a ride, which is one genre's entire rhythm section
    blast:    k => ({ ...cp(k), k: vec16(i => (i % 2 === 0 ? 1 : 0)),
                      s: vec16(i => (i % 2 === 1 ? 1 : 0)),
                      r: vec16(i => (i % 2 === 0 ? 1 : 0)), h: vec16(() => 0) }),
  };
  // A KIT IS NOT ONE INSTRUMENT, and every operator above moves all of it at
  // once — so "the hats double but nothing else does" was unsayable, which is
  // most of what anyone actually does to a beat. Seven ideas × the three lanes
  // every kit has, generated: `h.dbl`, `k.rot`, `s.thin`. Each is TOTAL and
  // none of them invents: a lane the kit lacks comes back untouched.
  const LANEVERB = {
    // rotate the lane past itself — the same hits, landing somewhere else
    rot:  v => v.map((_, i) => at(v, i + 2)),
    // drop every SECOND HIT (not every second step): the lane at half density
    thin: v => { let n = 0; return v.map(x => (x ? (++n % 2 === 0 ? 0 : x) : 0)); },
    // fill in behind: an eighth after every hit that has room for one
    dens: v => v.map((x, i) => x || (at(v, i - 2) ? 1 : 0)),
    // this lane alone at half or double speed — the polyrhythm you get by
    // leaving the rest of the kit where it is
    half: v => v.map((_, i) => at(v, Math.floor(i / 2))),
    dbl:  v => v.map((_, i) => at(v, i * 2)),
    // the last quarter of this lane fills with sixteenths: a roll, per lane
    roll: v => v.map((x, i) => (i >= 12 ? Math.max(x, 1) : x)),
  };
  const VERBLANES = ["k", "s", "h"];
  for (const d of VERBLANES) {
    for (const [verb, f] of Object.entries(LANEVERB))
      KITOPS[d + "." + verb] = k => (hits(k && k[d])
        ? { ...cp(k), [d]: f(K16(k[d])) } : cp(k));
    // DISPLACE is the seventh and it is not a vector map: it moves the lane in
    // TIME rather than on the grid, two ninths of a step late, which is the
    // difference between a rotated part and a laid-back one.
    KITOPS[d + ".disp"] = k => (hits(k && k[d])
      ? { ...cp(k), ["~" + d]: vec16(() => 2) } : cp(k));
  }
  // the two helpers the table above is written in, kept beside it
  //
  // THE HAND MOVES; THE PLATE DOES NOT KEEP UP. This carried the time part
  // across stroke for stroke, which is right for a hat — two plates pinched
  // shut speak at once and can say sixteenths — and wrong for a cymbal, which
  // is ONE plate that rings for seconds. A sixteenth-note hat moved onto the
  // ride is twelve strokes a bar into a two-and-a-half-second sample: not a
  // groove, fifteen overlapping copies of the same wash, and the ear does not
  // hear time in that, it hears a crash. (Measured: afrobeat's verse, the
  // densest hat in the table at twelve steps, became sixteen bars of solid
  // cymbal — "Lagos 1971 is dominated by crash cymbal". A crash marks an
  // arrival; nothing on this kit keeps time by ringing.)
  //
  // So a hand arriving on metal plays the EIGHTHS it was implying: a stroke
  // closer than an eighth behind the last one is dropped, because the stick
  // has not come back and the plate has not finished speaking. What survives
  // is the hat's own phrasing — which strokes land, where the part leaves a
  // hole, and every level the operator wrote — and what does not is only the
  // subdivision the plate cannot articulate. A part already at eighths or
  // slower passes through untouched, which is every straight-eighth genre in
  // the table, so `ride` still means exactly what it meant there.
  const MINGAP = 2;                       // an eighth, on the sixteen-step grid
  // ...and THE HAND IS NOT THE FOOT. `f` is a hat by taxonomy — it is the hat,
  // closed by the pedal — but it is played by the left foot, and "the hand moves
  // to the ride" is a statement about the right hand only. Sweeping the pedal in
  // deleted a lane no operator asked about: on blues and jazz, whose left foot
  // marks 2 and 4 under a ride that already plays them, `ride` was PURE
  // DELETION — it took away the quietest load-bearing thing on a jazz kit and
  // put nothing back — and `tomtime` turned that foot into a floor tom. With the
  // foot left alone, `ride` on a kit that is already on the ride is the identity
  // (there is no hand to move), and on bossa the hand goes to the plate while
  // the foot keeps its own time, which is what those two limbs actually do.
  const HANDHATS = HATS.filter(d => d !== "f");
  function moveTime(k, dest) {
    const src = HANDHATS.filter(d => hits(k && k[d]));
    if (!src.length) return cp(k);
    let merged = new Array(16).fill(0);
    for (const d of src) merged = mergeInto(merged, K16(k[d]));
    if (CYMBALS.includes(dest)) {
      let last = -MINGAP;
      merged = merged.map((v, i) => {
        if (!v || i - last < MINGAP) return 0;
        last = i; return v;
      });
    }
    return { ...without(k, d => HANDHATS.includes(d)), [dest]: mergeInto(k[dest], merged) };
  }
  function withChance(k, f) {
    const out = cp(k);
    for (const d of laneIds(k)) out["?" + d] = vec16(i => f(d, i));
    return out;
  }

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
  // ---- a drum phrase's own kit ----------------------------------------------
  // THE OVERRIDE, entire: a drum phrase read here never reaches g.kit, g.kits,
  // g.fill, g.kitProb or g.kitVel — it is not a variation on the genre's kit,
  // it IS the kit for these bars. Take the phrase back out of the section's
  // slot and `subj` is a melodic phrase again, drums() falls through to the
  // branch below, and the genre's own kit plays exactly as it did before —
  // which is the whole of "remove it and the genre's own kit comes back".
  //
  // No per-bar dice: a genre's kit is diced because it is authored once and
  // has to breathe over a whole section; a drum phrase is hand-tapped and
  // plays back the same every bar, the way a machine's own pattern does.
  function drumPattern(ph, g, bars) {
    const N = (ph[DRUM_LANES[0]] || []).length || 16;
    const gg = ph.swing ? { ...g, swing: DRUM_SWING[ph.swing] || 0 } : g;
    const ev = [];
    for (let b = 0; b < bars; b++) {
      for (const d of DRUM_LANES) {
        const vec = ph[d];
        if (!vec) continue;
        for (let i = 0; i < N; i++) {
          const m = at(vec, i);
          if (!m) continue;
          const t0 = (b * N + i + swing(gg, i)) / gg.rate;
          const vel = m === DMARK.ACCENT ? 8 : m === DMARK.GHOST ? 2 : 5;
          if (m === DMARK.FLAM) {
            // a quieter hit a ninth of a step ahead, same lane — the same
            // grace idiom drums() uses for a genre kit's own `!` sidecar
            ev.push({ t: Math.max(0, t0 - 1 / (9 * gg.rate)), d, acc: false,
                      vel: Math.max(1, Math.round(vel * 0.45)), grace: 1 });
            ev.push({ t: t0, d, acc: false, vel });
          } else if (m >= DMARK.ROLL2) {
            // n strikes inside the step's own length — the ratchet
            const n2 = m - DMARK.ROLL2 + 2, span = 1 / gg.rate;
            for (let k = 0; k < n2; k++)
              ev.push({ t: t0 + (k * span) / n2, d, acc: false, vel, roll: n2 });
          } else {
            ev.push({ t: t0, d, acc: m === DMARK.ACCENT, vel });
          }
        }
      }
    }
    return ev.sort((a, b) => a.t - b.t);
  }
  // THE HAND LAW ("humanize the drums more for non-digital genres… it feels
  // like an organic drum machine", 2026-08-19). A lane with no step levels and
  // no kitVel used to borrow the MELODY's velocities — which is why every hat
  // and rim on an acoustic kit landed at one loudness. An acoustic kit is
  // played by a HAND by default now: a per-lane accent contour (downbeats
  // lean, offbeats breathe, the backbeat cracks) plus the humanize jitter the
  // four genres that declared one already had. Machine kits (tr808/909,
  // cr78, electronic) are untouched — a machine's exactness is its identity,
  // and the MACHINE fingerprint gates pin it. An anchor opts out of the hand
  // with `hand: "exact"`; a declared kitVel or step level still outranks it.
  const HAND_KITS = { room: 1, jazz: 1, power: 1, acoustic: 1, brush: 1 };
  const HAND_VEL = {
    k: [9,5,7,5, 8,5,7,5, 9,5,7,6, 8,5,7,5],
    s: [8,4,6,4, 9,4,6,5, 8,4,6,4, 9,5,6,4],
    h: [7,3,5,3, 6,3,5,3, 7,3,5,4, 6,3,5,3],
    o: [7,4,6,4, 7,4,5,4, 7,4,6,4, 7,4,5,5],
    c: [8,5,7,5, 8,5,6,5, 8,5,7,5, 8,5,6,5],
    p: [6,4,5,4, 6,4,5,5, 6,4,5,4, 6,5,5,4],
    t: [7,5,6,5, 7,5,6,6, 7,5,6,5, 8,6,7,6],
  };
  const HAND_HUM = 0.03;              // gentler than blues' own 0.05
  function drums(subj, g, bars) {
    if (subj && subj.kind === "drum") return drumPattern(subj, g, bars);
    const ev = [], N = subj.deg.length;
    // the two seeded facts, read once: a hand that is not the grid, and the
    // salt that makes this genre's dice its own
    const handed = HAND_KITS[g.drumkit] === 1 && g.hand !== "exact";
    const hum = humanOf(g.humanize != null ? g.humanize
      : (handed ? HAND_HUM : null)), seed = g.kitSeed | 0;
    for (let b = 0; b < bars; b++) {
      // KIT SCHEDULE: `g.kits` is the kit read per BAR — a two-bar groove, a
      // hat that opens on bar 4 — where `g.kit` is one bar restated. It is not
      // a KITOP because a KITOP is kit->kit and TIMELESS (the argument beside
      // KITOPS); a schedule is position-dependent data. Absent = g.kit, exact.
      const base = g.kits ? at(g.kits, b) : (g.kit || {});
      const kit = (g.fill && b === bars - 1) ? { ...base, ...g.fill } : base;
      for (const [d, vec] of Object.entries(kit)) {
        // a key that is not a lane letter is a SIDECAR (?chance ~nudge !grace)
        // and is read here WITH its lane, never as one of its own
        if (!LANES[d]) continue;
        // the BOX's own chance vector (an operator wrote it into the kit)
        // outranks the GENRE's `kitProb`, the same way a box outranks its
        // anchor everywhere else
        const ch = kit["?" + d] || (g.kitProb && g.kitProb[d]);
        const nu = kit["~" + d], gr = kit["!" + d];
        for (let i = 0; i < N; i++) {
          const cell = at(vec, i);
          if (!cell) continue;
          // CHANCE. A hit that only sometimes sounds is what a hand does with
          // a hat, and the draw is a function of WHERE it was asked (see
          // rollAt) rather than of how many draws came before it.
          if (ch) { const odds = at(ch, i) / 9;
                    if (odds < 1 && rollAt(seed, b, i, d, 0) >= odds) continue; }
          // KIT DYNAMICS, now in three layers: the LEVEL written on the step
          // itself (2..9 — how an operator says "ghost" or "accent"), then
          // `g.kitVel`'s per-lane hand, then the melody's own velocity, which
          // is where the kick's loudness used to come from by accident. A
          // level of 1 is the old binary "on" and defers, so every kit ever
          // written renders exactly as before.
          const v0 = cell > 1 ? cell
            : g.kitVel && g.kitVel[d] ? at(g.kitVel[d], i)
            : handed && HAND_VEL[d] ? at(HAND_VEL[d], i)
            : vel(subj, i);
          // NUDGE: the baked hand (ninths of a step) plus the per-bar drift of
          // g.humanize. Both move the hit and neither adds or removes one.
          const push = (nu ? at(nu, i) / 9 : 0) +
            (hum ? (rollAt(seed, b, i, d, 1) * 2 - 1) * hum.t : 0);
          const jit = hum && hum.v
            ? Math.round((rollAt(seed, b, i, d, 2) * 2 - 1) * hum.v) : 0;
          // THE HAND STRAYS INSIDE THE BAR. A hit nudged past its own bar line
          // is a hit in the next bar — it changes which bar the fill is in, and
          // at a section edge the window simply cuts it. So the push is
          // clamped to the bar it was written in; only a GRACE note is allowed
          // to sit in front of the bar, because that is what a grace note is.
          const t0 = (b * N + i + swing(g, i)) / g.rate;
          const e = { t: push
                      ? Math.min(((b + 1) * N) / g.rate - 1e-9,
                                 Math.max((b * N) / g.rate, t0 + push / g.rate))
                      : t0, d,
                      acc: !!subj.acc[i],
                      vel: jit ? Math.max(0, Math.min(9, v0 + jit)) : v0,
                      fill: b === bars - 1 && !!(g.fill && g.fill[d]) };
          // GRACE. One quieter hit a ninth of a step in front is a flam, two
          // is a drag, three a ruff. They are not steps — there is no room for
          // them on a sixteen-step grid — so they hang off the step they lead.
          const gn = gr ? Math.min(3, at(gr, i)) : 0;
          for (let q = gn; q > 0; q--)
            ev.push({ ...e, t: Math.max(0, e.t - q / (9 * g.rate)), acc: false,
                      vel: Math.max(1, Math.round((e.vel || 5) * 0.45)), grace: q });
          ev.push(e);
        }
      }
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
    // A DRUM PHRASE carries no chord roots for a walking or root bass to read.
    if (subj && subj.kind === "drum") return [];
    const ev = [], N = subj.deg.length;

    // WALKING — quarter notes that arrive somewhere. Root, third, fifth, then a
    // chromatic approach a semitone under the NEXT bar's root, which is why it
    // needs to look one bar ahead: a walking line is defined by where it is
    // going, not by the chord it is sitting on.
    const md = g.mode || MODE, key = g.key | 0;
    // WHERE THE BASS SITS AGAINST THE DRUMS. `touch` is a HAND — a seeded
    // wobble in both directions — and this is the other thing, the one a
    // band actually says out loud: behind the beat, or on top of it. One
    // number, in ninths of a step (the units the drum `~lane` sidecar
    // already uses), added to every onset. Absent = dead centre, and every
    // stream above is byte-identical without it.
    const lean = (+g.bassNudge || 0) / 9 / g.rate;
    // HOW LONG THE NOTE IS HELD, which the bass never read. The line has
    // honoured `artic` since it existed; the bass gated every note to 94% of
    // the gap whatever anybody said, so "short, off the string" moved the
    // model and nothing else — and a bass that never lets go is a bass with
    // no envelope, which is what it sounded like. Absent = 0.94, the number
    // that was hard-coded here, so every existing genre is unmoved.
    // The line's own table says normal = 0.92, and on a LINE that is right.
    // A bass note at 92% of a quarter never lets go of the one behind it —
    // measured, the level never came off the peak — so a bass's "normal" is
    // shorter than a line's. Same words, different instrument.
    // A BASS STAYS ON THE BASS. The key and the register are both octave
    // offsets and they stack: "in F" (−7) under "down an octave" (−12) put
    // the line at MIDI 17, which is below the bottom of every bass ever
    // built and below what most speakers reproduce. Found by rolling three
    // hundred random records — a person picking the same two answers would
    // have found it too. Fold, do not clamp: an octave keeps the line.
    // ...and the bass's OWN octave, which is not the key. A band-kit that
    // folded the bassist's register into `g.key` moved the KEY CENTRE for
    // everybody — the keys and the guitar went down an octave because the
    // bass player did. One field, read here and nowhere else.
    const bassReg = 12 * (+g.bassReg || 0);
    const LO = 28, HI = 67;                       // E1 to G4, the instrument
    // fold the HARMONY into the instrument, and let the player's own octave
    // (`bassReg`) move it from there — folding after it would undo the one
    // thing the bassist actually asked for
    const onBass = (n) => { let x = n;
      while (x < LO) x += 12;
      while (x > HI) x -= 12;
      return x; };
    const BART = { staccato: 0.5, normal: 0.8, legato: 1, tie: 1 };
    // ...and it is `bassArtic`, not `artic`: `artic` is the LINE's, genres
    // carry it (drone ties, others slur) and reading it here moved the bass
    // of all 110 at once. A field of the bass's own is opt-in by
    // construction.
    const bart = (g.bassArtic && BART[g.bassArtic] != null) ? BART[g.bassArtic] : 0.94;
    // a push on the very first note would land before the section starts,
    // where nothing can play it
    const leant = (t) => Math.max(0, t + lean);
    // THE BASS IS A PLAYER TOO. Same performance layer as the line (the eighth
    // type), minus the phrase arch: a bass part's shape is the harmony's, not
    // its own contour, and tenting a walking line onto its highest note would
    // put the accent on a passing tone. Absent fields = the old stream, and
    // the sort only runs when the hand actually moved something, so a genre
    // without `touch` cannot even be reordered by accident.
    const bg = (g.stress || g.touch || g.phrase) ? { ...g, phrase: 0 } : g;
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
    // A FIGURE — a bass line written out rather than described. `bassStyle`
    // says how DENSE the line is and `bassGrid` where the genre's own notes
    // fall; a figure says all of it at once and per step: where the note is,
    // which octave it takes, whether it is accented and whether it slides
    // into the next one. That last pair is what an acid line IS — the 303's
    // accent and slide have been carried to the engine (to-engine reads
    // e.acc/e.sld) since the bass chair existed, and nothing could ever set
    // them. Absent = every stream below is what it was.
    const fig = g.bassFig || null;
    const grid = (fig && fig.grid) || STYLEGRID[g.bassStyle]
      || (subj.acc.some(Boolean) ? subj.acc : (g.bassGrid || QUARTERS));
    const sp = spans(grid);                                     // holds to the next hit
    // A BASS SCHEDULE, READ PER BAR — the shape `kits` already gives the
    // drums, and for the same reason: a grid is one bar restated, and some
    // parts are slower than a bar. `bassBars` is read with `at`, so a
    // four-entry schedule under a twelve-bar form repeats the way a kit
    // schedule does, and an entry of 0 is a bar the bass does not play.
    // The note before a silent bar HOLDS across it: a part with four
    // measures between two notes is holding, not stopping. Absent = the
    // stream above, byte-identical.
    const barGrid = (b) => (g.bassBars ? (at(g.bassBars, b) || null) : grid);
    const held = (() => {
      if (!g.bassBars) return null;
      const pos = [];
      for (let b = 0; b < bars; b++) {
        const gb = barGrid(b); if (!gb) continue;
        for (let i = 0; i < N; i++) if (at(gb, i)) pos.push(b * N + i);
      }
      const out = new Map();
      // ...and a note HOLDS to the next one, but no longer than a bar. A
      // gate is not an envelope: on a sampled bass a four-bar hold decays by
      // itself, on a synth it is four bars of unbroken tone ("the synth bass
      // just plays continually"). One bar of ring and three bars of air is
      // what one note every four measures is supposed to sound like.
      pos.forEach((x, k) => { let d = pos[(k + 1) % pos.length] - x;
                              if (d <= 0) d += bars * N; out.set(x, Math.min(d, N)); });
      return out;
    })();
    let played = false;
    if (g.bassStyle === "walk") {
      for (let b = 0; b < bars; b++) {
        // A WALKING BASS READS THE SCHEDULE TOO. It used to return before
        // `bassBars` was even computed, so a band told to leave four
        // measures between two notes got four walking quarters a bar from
        // anyone whose job was to walk — the instruction silently applied
        // to five of the six bass styles.
        // ...and it reads ONLY that schedule. The walk has never read the
        // melody's accent grid — its rhythm is four to the bar by
        // definition — so `barGrid`'s fallback is not for this branch, and
        // wiring it in here quietly turned a walking bass into whatever the
        // tune happened to accent.
        const gw = g.bassBars ? (at(g.bassBars, b) || null) : null;
        if (g.bassBars && !gw) continue;
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
        const steps = tones.map((_, q) => q * 4).filter((i) => !gw || at(gw, i));
        const bar = steps.map((i, k) =>
          ({ t: leant((b * N + i) / g.rate),
             // 3.7 is the number the walk has always written; scaling it by
             // bart/0.94 came back 3.6999999999999997 and broke byte
             // identity for all 110 genres, which is the whole reason that
             // tripwire exists
             dur: (held ? held.get(b * N + i) * bart
                        : (g.bassArtic ? 3.94 * bart : 3.7)) / g.rate,
             n: Math.max(24, onBass(tones[i / 4] + 36 + key) + bassReg), r, walk: true,
             vel: k === 0 ? 7 : 5 }));
        played = perform(bar, steps, bg, b, N, { lane: "B" }) || played;
        for (const e of bar) ev.push(e);
      }
      return played ? ev.sort((a, b) => a.t - b.t) : ev;
    }

    // The root bass borrows its rhythm from the melody's ACCENTS, which reads
    // well until the melody has none — then the bass vanishes entirely, and an
    // empty or cleared phrase has none by definition. A bass part should not
    // depend on the tune being emphatic, so fall back to the genre's own pulse
    // (quarter notes unless it says otherwise). With accents present this is
    // byte-identical to before.
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
      const gb = barGrid(b);
      if (!gb) continue;                       // a bar the bass sits out
      const bar = [], barAt = [];
      for (let i = 0; i < N; i++)
        if (at(gb, i)) {
          const c = !cs ? null : cs.length === 1 ? cs[0]
            : cs.find(x => i >= x.start && i < x.start + x.len) || cs[cs.length - 1];
          const r = c ? c.deg : 0;
          const k = alt++;
          // octaves alternates register; fifths alternates the DEGREE, which is
          // the boogie/country figure rather than a doubling
          // A FIGURE THAT SAYS NOTHING ABOUT OCTAVES SAYS NOTHING ABOUT
          // OCTAVES. Reading an all-zero `oct` vector as an instruction
          // silenced the octaves STYLE under every figure, which made two
          // different answers to "what's your job" the identical line.
          const figOct = fig && fig.oct && fig.oct.some(Boolean) ? at(fig.oct, i) : null;
          const oct = figOct != null ? figOct
            : g.bassStyle === "octaves" ? 12 * (k % 2) : 0;
          const deg = g.bassStyle === "fifths" && k % 2 ? r + 4 : r;
          // the root note is the chord's BASS pc — an inversion puts the third
          // under the band, folded beside the root so the register holds; with
          // no prog, bassPc === rootPc === mp(r, md) and this is the old note
          // A FIGURE CAN NAME ITS NOTES. `deg` is a scale degree per step,
          // over whatever the chord (or the pedal tonic) already is — the
          // minor third and the seventh an acid line lives on, which no
          // amount of octave-jumping can say. Absent = the note the harmony
          // chose, exactly as before.
          const fd = fig && fig.deg ? at(fig.deg, i) : 0;
          const n0 = !c ? mp(0 + fd, md)
            : fd ? mp(r + fd, md) + c.borrow
            : deg !== r ? mp(deg, md) + c.borrow
            : fold(c.bassPc, c.rootPc);
          const hold = held ? held.get(b * N + i) : sp[i];
          const acc = fig && fig.acc ? at(fig.acc, i) : 0;
          const sld = fig && fig.sld ? at(fig.sld, i) : 0;
          const e = { t: leant((b * N + i + swing(g, i)) / g.rate), dur: hold * bart / g.rate,
                      n: Math.max(24, onBass(n0 + 36 + oct + key) + bassReg), r,
                      vel: acc ? Math.min(9, vel(subj, i) + 3) : vel(subj, i) };
          if (acc) e.acc = 1;
          if (sld) e.sld = 1;
          bar.push(e);
          barAt.push(i);
        }
      played = perform(bar, barAt, bg, b, N, { lane: "B" }) || played;
      for (const e of bar) ev.push(e);
    }
    return played ? ev.sort((a, b) => a.t - b.t) : ev;
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
  // they are automation on the section's desk track — see audio/desk.js.)
  // THE DYNAMIC ARC IS `env`, STRENGTHENED — not a second box field, and the
  // argument is not economy, it is that there is only one question here. `env`
  // already is "level over the section": one curve, multiplied onto the
  // rendered velocities, evaluated at the note's position in the section. A
  // crescendo is that, with different numbers. Two fields would mean two curves
  // with no defined interaction, two chips that can contradict each other
  // (fade in AND diminuendo), and a UI that has to explain which wins — for a
  // gesture the existing field already expresses. It is also the only reachable
  // seam: ui/derive.js calls envelope(win, sec.env, span) once, and a new field
  // would need a new call site in a file this tier does not own.
  //
  // The four originals are FADES: they start or end at zero, they are how a
  // section arrives or leaves. The six below are DYNAMICS: they never reach
  // zero, and they say how big this section is against its neighbours. That is
  // the distinction the vocabulary was missing — every composed song had a
  // fade-in on the intro, a fade-out on the outro, and eight flat sections in
  // between, which is a record with no shape at all.
  //
  // `soft` and `big` are CONSTANTS, and a constant is a legitimate curve: the
  // question "how loud is this section" has a flat answer more often than not.
  // They are what makes a chorus genuinely bigger than the verse before it —
  // and note WHICH WAY that works. Rendered velocity already runs 4..9 against
  // a ceiling of 9, so there is very little room above and a great deal below:
  // the chorus is big mostly because the verse got out of its way. A multiplier
  // over 1 is worth having anyway (it lifts the quiet notes and closes the gap
  // to the loud ones, which is what a section played harder actually sounds
  // like), but the arrangement's dynamic range is bought at the bottom.
  const SHAPES = {
    in:    x => x,
    out:   x => 1 - x,
    swell: x => 1 - Math.abs(2 * x - 1),          // up and back down
    duck:  x => Math.abs(2 * x - 1),              // out of the middle, into the edges
    // a real crescendo: it starts well under the written level and arrives over
    // it, so the last bar of the section is the loudest bar in it
    cresc: x => 0.5 + 0.62 * x,
    dim:   x => 1.12 - 0.62 * x,
    // the ARCH is not `swell`: swell fades from and to silence (it is a fade in
    // and a fade out end to end), this rises to a peak two thirds through and
    // settles back to a level you can still hear — the shape a section of music
    // has when nobody is fading anything
    arch:  x => 0.65 + 0.47 * (x < 2 / 3 ? x * 1.5 : (1 - x) * 3),
    // THE BUILD: held flat, then the last two fifths climb hard. A build that
    // ramps from bar one is a long fade; what a build does is wait.
    lift:  x => (x < 0.6 ? 0.72 : 0.72 + (x - 0.6) * 1.125),
    soft:  () => 0.68,
    big:   () => 1.14,
  };
  const envelope = (ev, kind, span, bs) => {
    if (!kind || !span) return ev;
    // DROP — the section's last eighth goes silent, AND AT MOST ITS LAST BAR.
    // The oldest trick in dance music and still the loudest: what you hear is
    // the bar that follows — which is the tell that this is a BAR-scale gesture
    // that was written as a proportion. On an eight-bar section an eighth is a
    // bar and the two readings agree; on a sixteen-bar one it is two bars of
    // digital silence in the middle of a record, which is not a drop, it is a
    // dropout. Measured across 110 genres × 4 seeds, 24 records had one.
    // A caller that does not say how long a bar is gets the proportion, so the
    // gesture is unchanged wherever nobody knows better.
    if (kind === "drop")
      return ev.filter(e => e.t < span - Math.min(span / 8, bs || span));
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
      // the ceiling was never needed while every shape was a fade — no fade can
      // push a velocity past what it already was. A dynamic can.
      return { ...e, vel: Math.max(0, Math.min(9, Math.round((e.vel == null ? 5 : e.vel) * f))) };
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
    // COLD is the identity, and it is in the vocabulary ON PURPOSE: the whole
    // band from beat one, no pickup, no count — the absence of an intro is
    // itself a way to start a record, and naming it lets a composer CHOOSE it
    // instead of falling into it whenever the dice miss everything else.
    if (kind === "cold") return ev;
    // FADE is the one kind that takes TWO bars, and the exception is the
    // reason it exists: a whole-mix fade inside one bar already has a name
    // (swell). It scales and never deletes, so the band is there from the
    // first event — just far away, walking in.
    if (kind === "fade") {
      const w = Math.min(2 * bs, span || 2 * bs);
      return ev.map(e => e.t < w
        ? { ...e, vel: Math.max(0, Math.round((e.vel == null ? 5 : e.vel) * (e.t / w))) }
        : e);
    }
    const inBar = e => e.t < bs, rest = ev.filter(e => !inBar(e));
    const bar = ev.filter(inBar);
    // a pad is a pad wherever the stream came from: the kernel's own render
    // stamps `part`, the app's derive layer also stamps a `pad` flag
    const isPad = e => e.kind === "line" && (e.part === "pad" || e.pad);
    // WHICH LANE AN EVENT IS IN, whichever stream it came from: the kernel's
    // own render numbers its voices `v`, the app's derive layer restamps them
    // `lv` so a stacked layer's voices keep going past the authority's.
    const laneOf = e => (e.lv == null ? e.v : e.lv);
    if (kind === "padin") {
      // the pad swells alone and the band enters at bar 2. A stream with no
      // pad in it degrades to the whole pitched layer rather than to
      // a bar of dead air, which is what total means here.
      const pads = bar.filter(isPad);
      return [...(pads.length ? pads : bar.filter(e => e.kind === "line")), ...rest];
    }
    if (kind === "bassin") {
      // the bass riff alone — the soul/dub opening. A bassless stream
      // degrades to its line for the same reason padin does.
      const bb = bar.filter(e => e.kind === "bass");
      return [...(bb.length ? bb : bar.filter(e => e.kind === "line")), ...rest];
    }
    if (kind === "riser") {
      // bar one is REPLACED by a rise: sixteen hat hits climbing from almost
      // nothing into bar 2's downbeat, the last one accented. It is the
      // build-up gesture as EVENTS — a velocity ramp the mixer never has to
      // know about — and it is the one intro that throws the bar's own
      // material away entirely, because a riser under a playing band is just
      // a busy bar.
      const out = rest.slice();
      for (let s = 0; s < 16; s++)
        out.push(D(s * bs / 16, "h", s === 15, 1 + Math.round(s * 8 / 15)));
      return out.sort((a, b) => a.t - b.t);
    }
    if (kind === "stabs") {
      // chord stabs on a sparse grid: the bar's opening chord — the pad's
      // voicing where there is one, the line's first attack where there is
      // not — refired short at 1, the and-of-2 and the and-of-3, everything
      // else silent. A stream with nothing pitched in bar one has nothing to
      // stab, and the stream comes back unchanged.
      const pads = bar.filter(isPad);
      const src0 = pads.length ? pads : bar.filter(e => e.kind === "line");
      if (!src0.length) return ev;
      const t0 = Math.min(...src0.map(e => e.t));
      const src = src0.filter(e => e.t <= t0 + 1e-6);
      const out = rest.slice();
      for (const s of [0, 6, 10])
        for (const e of src)
          out.push({ ...e, t: s * bs / 16, dur: 0.9 * bs / 16,
                     vel: Math.max(6, e.vel == null ? 5 : e.vel),
                     acc: s === 0 ? 1 : 0, sld: 0 });
      return out.sort((a, b) => a.t - b.t);
    }
    if (kind === "count") {
      // a count-in: four rim clicks and nothing else, the fourth accented
      const out = rest.slice();
      beatsOf(0, bs, [0, 4, 8, 12]).forEach((t, i) => out.push(D(t, "p", i === 3, i === 3 ? 9 : 6)));
      return out.sort((a, b) => a.t - b.t);
    }
    if (kind === "hit") {
      // one downbeat and then the band — the oldest way to say "here we go".
      // The cymbal is a CRASH now: it was written as "o", an open hat, for the
      // years there was no crash lane to write, and an open hat is not the
      // sound of a band starting.
      //
      // THE SPACE IS ONE BEAT, NOT ONE BAR, and that is the whole repair. This
      // threw the entire first bar away, so a drop opened with a cymbal and
      // then four beats of nothing between two bars playing forty-five events
      // apiece — and a hole that wide does not read as production, it reads as
      // the machine stopping. Measured across 110 genres × 4 seeds it was the
      // single commonest near-empty bar in the catalogue (150 of them). A hit
      // marks the downbeat and then the section ARRIVES: the band is back on
      // beat 2, which is what everybody actually plays.
      return [D(0, "k", 1, 9), D(0, "x", 1, 9),
              ...bar.filter(e => e.t >= bs / 4 - 1e-9), ...rest].sort((a, b) => a.t - b.t);
    }
    // SOLO MEANS ONE VOICE. It used to keep the whole pitched layer, which on
    // any genre whose voices are one phrase dealt twice — the octave-doubled
    // riff, the two horns in unison — announced the tune as a flange rather
    // than as a player: the same notes twice, a fixed interval or a few
    // milliseconds apart. compose.js bridges `quote` onto this kind with the
    // words "a quote IS the melody alone"; this is that sentence in code.
    //
    // THE LOWEST LANE STATES IT, and the rule is that blunt on purpose: a box
    // deals its FIRST slot to voice 0 (derive.js: voice v reads phrase v % nP),
    // so the lowest lane is by construction the one holding the material the
    // section is ABOUT. The obvious alternative — keep whichever lane is
    // busiest in the bar — was written first and measured wrong: on a genre
    // whose voice 0 comps (toto, citypop, jodeci — `realize(0) === "pad"`) a
    // two-note companion out-counts a held chord, and the opening states the
    // companion while the quoted hook never sounds. Thirty genre/seed pairs
    // failed the quote gate that way. Choosing by lane index cannot do that.
    // The cost is that on a comping genre the head is announced in chords
    // before the horns come in, which is a piano trio, not a mistake. A stream
    // carrying no lane numbers at all keeps what it had.
    if (kind === "solo") {
      const lines = bar.filter(e => e.kind === "line");
      const named = lines.filter(e => laneOf(e) != null);
      if (!named.length) return [...lines, ...rest];
      const one = Math.min(...named.map(laneOf));
      return [...named.filter(e => laneOf(e) === one), ...rest];
    }
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
      out.push(D(from + 15 * bs / 16, "x", 1, 9));
      return out.sort((a, b) => a.t - b.t);
    }
    if (kind === "roll") {
      // an accelerating roll: slow, then faster, then a crash. Same idea as the
      // fill, but it is a crescendo rather than a phrase.
      const steps = [0, 4, 8, 10, 12, 13, 14, 15];
      const out = [...rest, ...keepLines];
      steps.forEach((s, i) => out.push(D(from + s * bs / 16, "s", i > 4, 4 + i)));
      out.push(D(from + bs, "x", 1, 9));
      return out.sort((a, b) => a.t - b.t);
    }
    if (kind === "crash") {
      // THE BAND LANDS ON THE CYMBAL and holds the door open with it. Everything
      // still stops together on the bar line — that is what this gesture is —
      // but what stops is a CHORD. It used to leave the kick and the cymbal
      // alone in an otherwise deleted bar, which on the page is two events
      // between two bars of sixty, and by ear is a record that ends its chorus
      // by switching the band off. A real band hits the last chord with the
      // drummer and lets it ring.
      //
      // The chord is each lane's own first note in the bar, re-seated on the
      // downbeat and held: the same "refire what is already there" move `stabs`
      // makes at the other edge, so the landing is always in the section's own
      // harmony and never a chord this file invented.
      const laneKey = e => e.kind + "/" + (e.lv == null ? e.v : e.lv);
      const first = new Map();
      for (const e of bar) {
        if (e.kind === "hit") continue;
        const k = laneKey(e), got = first.get(k);
        if (!got || e.t < got.t) first.set(k, e);
      }
      const land = [...first.values()].map(e => ({ ...e, t: from, dur: 0.9 * bs, sld: 0,
                                                   vel: Math.max(6, e.vel == null ? 5 : e.vel) }));
      return [...rest, ...land, D(from, "x", 1, 9), D(from, "k", 1, 9)].sort((a, b) => a.t - b.t);
    }
    // ---- THE FILLS THAT ARE NOT A SNARE FILL --------------------------------
    // Every outro above is the same gesture at three densities, which is why
    // every composed song ended the same way: a snare accelerating into a
    // cymbal. These four are different IDEAS about how a section stops, and
    // the arranger deals them per genre and per seed (compose.js OUTRO_LEAN).
    if (kind === "tomfill") {
      // THE TOM FILL: the oldest fill there is, and it did not exist here
      // because there were no toms. Down the kit — high, high, mid, mid, low —
      // over a kick on 1, landing on a crash. Nothing else plays: a tom fill
      // under a hat pattern is not a tom fill.
      const out = [...rest, ...keepLines, D(from, "k", 1, 9)];
      const run = [[0, "t", 6], [2, "t", 6], [4, "m", 7], [6, "m", 7],
                   [8, "l", 8], [10, "l", 8], [12, "m", 8], [13, "m", 7],
                   [14, "l", 9], [15, "l", 9]];
      for (const [s, d, v] of run) out.push(D(from + s * bs / 16, d, s % 4 === 0, v));
      out.push(D(from + bs, "x", 1, 9));
      return out.sort((a, b) => a.t - b.t);
    }
    if (kind === "hatrun") {
      // THE HAT STUTTER — the one fill that is not a drum at all. Sixteen
      // closed hats getting louder and the last four opening: the electronic
      // record's way of ending a section, where a snare roll would be a band.
      const out = [...rest, ...keepLines, D(from, "k", 1, 8)];
      for (let s = 0; s < 16; s++)
        out.push(D(from + s * bs / 16, s >= 12 ? "o" : "h", s % 4 === 0,
                   3 + Math.round(s * 6 / 15)));
      return out.sort((a, b) => a.t - b.t);
    }
    if (kind === "hush") {
      // THINNING, THEN THE CRASH. A hush is a diminuendo with a hole at the end
      // of it, not a power cut: the band plays the first half of the bar getting
      // quieter, the second half is the hole, and one cymbal lands on the LAST
      // sixteenth. The hole is still the gesture — two beats of air is plenty of
      // room to notice — but the section now FALLS into it instead of vanishing.
      //
      // It used to delete the whole bar, which is 192 near-empty bars across
      // 110 genres × 4 seeds, and by ear it is indistinguishable from the
      // transport dropping out: bar 70 plays thirty-four events, bar 71 plays
      // one, bar 72 plays thirty. Nobody hears "hush" there, they hear a stop.
      const half = from + bs / 2;
      const fall = e => {
        const x = (e.t - from) / (bs / 2);                 // 0 at the bar line, 1 at the hole
        return { ...e, vel: Math.max(1, Math.round((e.vel == null ? 5 : e.vel) * (1 - 0.55 * x))) };
      };
      return [...rest, ...bar.filter(e => e.t < half - 1e-9).map(fall),
              D(from + 15 * bs / 16, "x", 1, 9)].sort((a, b) => a.t - b.t);
    }
    if (kind === "doubles") {
      // the kick-and-snare double-time bar: no acceleration, no cymbal, just
      // the same two drums at twice the rate — a hard stop that stays inside
      // the groove instead of announcing itself
      const out = [...rest, ...keepLines];
      for (let s = 0; s < 16; s += 2)
        out.push(D(from + s * bs / 16, s % 4 === 0 ? "k" : "s", s % 8 === 0, s % 4 === 0 ? 8 : 6));
      return out.sort((a, b) => a.t - b.t);
    }
    if (kind === "break") return [...rest, ...bar.filter(e => e.kind === "hit")];
    if (kind === "tail")  return [...rest, ...keepLines];
    if (kind === "cut")   return ev.filter(e => e.t < span - bs / 4);
    return ev;
  }
  const edges = (ev, i, o, span, bs) => outro(intro(ev, i, span, bs), o, span, bs);

  const api = { at, mapv, spans, vel, drop, fill, spread, split, del, rampOf, envelope, SHAPES, edges, intro, outro, groove, GROOVES, stressAt, perform, KITOPS, mapKit, LANES, TOMS, HATS, CYMBALS, LIMBORDER, rollAt, swing, rotate, reverse, transpose, invert, complement,
                crossmap, excerpt, only, word,
                PENT, MODE, ROMAN, romanOf, pitch, mp, fold, near,
                QSTEPS, QFIX, chordsOf, chordAt, withCadence, harmonizeStage,
                seatNote, tempoWarp, prng,
                PARTS, partOf, periodOps, pipes, PIPES,
                ORN, ORNNAME, ORNPARTS, ornament,
                DRUM_LANES, DMARK, DRUM_SWING,
                harm, render, drums, bass };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuKernel = api;
})(typeof window !== "undefined" ? window : globalThis);
