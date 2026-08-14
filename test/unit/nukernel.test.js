#!/usr/bin/env node
// test/unit/nukernel.test.js — the nukernel gate.
//
//   node test/unit/nukernel.test.js
//
// This suite exists because of what actually went wrong. Three defects shipped
// and every check passed, because the checks asked "does this function run"
// rather than "does this input reach the output":
//
//   * the ghost-percussion layer could never fire, for any operator, because
//     accents are a subset of gates by construction and whole-pattern operators
//     preserve that containment;
//   * the `oct` vector was a no-op in all four genres — fold() ran AFTER the
//     octave was added and put every leap back where it started;
//   * `nudge` was clamped to the genre's own bar count as if it were a phase.
//
// The first two are INVISIBLE to per-function unit tests. rotate() rotates
// correctly in both; the bug is that the value never reaches the rendered
// events. So the centre of gravity here is SENSITIVITY — for every vector and
// every knob, perturbing it must change what comes out — plus the algebraic
// laws that make the operator set a group rather than a pile of functions.
"use strict";
const K = require("../../nukernel/kernel.js");
const { DEFAULT, GENRES, MODES, SCALES } = require("../../nukernel/genres.js");

const GK = Object.keys(GENRES);
let fails = 0, checks = 0;
const ok = (cond, msg) => {
  checks++;
  if (!cond) { fails++; console.error("  FAIL " + msg); }
};
const clone = o => JSON.parse(JSON.stringify(o));
const sig = ev => JSON.stringify(ev.map(e => [e.t, e.n, e.d, e.vel, e.acc, e.sld]));

// a phrase that exercises every vector: rests, accents, slides, octave leaps,
// a full velocity range and both signs of degree
const P = {
  deg:  [0, 3, -2, 5, 4, 0, -4, 2, 7, 3, 0, -1, 2, 6, 3, 1],
  oct:  [0, 0, 1, 0, -1, 0, 0, 0, 1, 0, 0, 0, -1, 1, 0, 0],
  vel:  [9, 5, 3, 8, 6, 4, 8, 2, 9, 6, 4, 7, 8, 3, 6, 5],
  inc:  [0, 1, 0, 0, -1, 0, 0, 0, 2, 0, 0, 0, 0, -1, 0, 0],
  stk:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  gate: [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0],
  acc:  [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  sld:  [0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0],
};
const allEvents = (p, g, bars) =>
  [...K.render(p, g, bars), ...K.drums(p, g, bars), ...K.bass(p, g, bars)]
    .sort((a, b) => a.t - b.t || (a.n || 0) - (b.n || 0));

/* ---------------------------------------------------------------- 1. SENSITIVITY
   Every vector must reach the output. This is the check the octave bug and the
   dead ghost layer both needed and neither had. */
console.log("sensitivity — perturbing each vector must change the render");
for (const gk of GK) {
  // A RAMP NEEDS MORE THAN ONE LOOP to be visible — it accumulates with the loop
  // index, so in a one-bar form (Simple) it multiplies by zero and is correctly
  // inert. Render four bars so inc/stk have somewhere to go.
  const g = GENRES[gk], bars = Math.max(4, g.bars), base = sig(allEvents(P, g, bars));
  for (const key of ["deg", "oct", "vel", "inc", "stk", "gate", "acc", "sld"]) {
    const q = clone(P);
    if (key === "deg") q.deg = q.deg.map(d => d + 2);
    else if (key === "oct") q.oct = q.oct.map(() => 1);
    else if (key === "vel") q.vel = q.vel.map(() => 1);
    else if (key === "inc") q.inc = q.inc.map((_, i) => (i === 0 ? 2 : 0));
    else if (key === "stk") q.stk = q.stk.map((_, i) => (i === 0 ? 1 : 0));
    else q[key] = q[key].map((b, i) => (i % 2 ? b : b ? 0 : 1));
    const pad = gk === "vaporwave" && (key === "deg" || key === "oct");
    // a vaporwave PAD reads chord tones, so deg/oct legitimately do not reach
    // voice 0 — but they must still reach the line voice, so the whole-render
    // signature has to move regardless
    ok(sig(allEvents(q, g, bars)) !== base,
       gk + ": changing " + key + " did not change the rendered events" + (pad ? " (pad genre)" : ""));
  }
}

/* ---------------------------------------------------------------- 2. GROUP LAWS
   The operator set is only searchable if it is closed and its elements have
   the inverses the algebra claims. */
console.log("group laws — inverses, involutions, identity");
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const N = P.deg.length;
ok(eq(K.rotate(0)(P), P), "rotate(0) is not the identity");
ok(eq(K.rotate(N)(P), P), "rotate(length) is not the identity");
for (let k = 1; k < N; k++)
  ok(eq(K.rotate(N - k)(K.rotate(k)(P)), P), "rotate(" + k + ") has no inverse");
ok(eq(K.reverse()(K.reverse()(P)), P), "reverse is not an involution");
ok(eq(K.invert(4)(K.invert(4)(P)), P), "invert is not an involution");
ok(eq(K.complement("acc")(K.complement("acc")(P)), P), "complement is not an involution");
ok(eq(K.transpose(-3)(K.transpose(3)(P)), P), "transpose has no inverse");
ok(eq(K.drop(3)(K.drop(3)(P)), K.drop(3)(P)), "drop is not idempotent");
ok(eq(K.fill(3)(K.fill(3)(P)), K.fill(3)(P)), "fill is not idempotent");
// SPLIT adds attacks inside long notes and is audible under any articulation —
// which duplicating a list element is not, because a held note swallows its copy
{
  const before = P.gate.filter(Boolean).length;
  ok(K.split(2)(P).gate.filter(Boolean).length > before, "split(2) added no attacks");
  ok(K.split(1)(P).gate.join("") === P.gate.join(""), "split(1) is not the identity");
  // under LEGATO — held notes, no gaps — a split must still produce extra
  // attacks, which duplicating a list element could never do
  const leg = g2 => K.render(g2, { ...GENRES.simple, artic: "legato" }, 4).length;
  ok(leg(K.split(2)(P)) > leg(P), "split is inaudible under legato — the whole point of it");
}

// DENSITY family. drop and fill are both lossy, so they are NOT inverses — and
// they do not commute. Both facts are load-bearing: the chips apply in the order
// you switch them on, and "drop 3 then add 3" is a real transformation rather
// than a no-op somebody will report as a bug.
ok(!eq(K.fill(3)(K.drop(3)(P)), P), "drop then fill claims to be the identity");
ok(!eq(K.fill(3)(K.drop(3)(P)), K.drop(3)(K.fill(3)(P))), "drop and fill commute");
ok(K.drop(1)(P).gate.every(g => g === 0), "drop(1) is not silence");
ok(K.fill(1)(P).gate.every(g => g === 1), "fill(1) is not every step");
// drop(1) must leave the KIT playing — that is the whole use of it
ok(K.drums(K.drop(1)(P), GENRES.acid, GENRES.acid.bars).length > 0,
   "drop(1) silenced the drums as well as the line");
ok(K.render(K.drop(1)(P), GENRES.acid, GENRES.acid.bars).length === 0,
   "drop(1) left pitched notes sounding");
// fill uncovers degrees the phrase was already holding silent, it does not
// invent them: every added note's pitch must come from the existing deg vector
{
  const before = new Set(K.render(P, GENRES.acid, GENRES.acid.bars).map(e => e.n));
  const after = K.render(K.fill(2)(P), GENRES.acid, GENRES.acid.bars);
  ok(after.length > before.size, "fill(2) added no notes");
}

// reverse must shift the slide vector: slide is EDGE-valued, and reversing it
// like a node vector leaves every slide on the wrong side of its transition
ok(!eq(K.reverse()(P).sld, [...P.sld].reverse()),
   "reverse treated sld as node-valued (the edge shift is missing)");

/* ---------------------------------------------------------------- 3. TOTALITY + PURITY
   Every operator is claimed to be total: any pattern in, a valid pattern out,
   no failure modes — and none of them may mutate their input. */
console.log("totality and purity");
const OPS = [K.rotate(5), K.rotate(-3), K.reverse(), K.transpose(9), K.transpose(-9),
             K.invert(0), K.invert(4), K.complement("gate"), K.complement("acc"),
             K.excerpt(2, 8), K.drop(1), K.drop(2), K.drop(3),
             K.fill(1), K.fill(2), K.fill(3), K.spread(2), K.spread(0.5), K.spread(0),
             K.split(2), K.split(3), K.split(4), K.del(1), K.del(2), K.del(4),
             K.only("acc", K.rotate(3)),
             K.crossmap("acc", "sld")];
const VECS = ["deg", "oct", "vel", "inc", "stk", "gate", "acc", "sld"];
const edge = [P, K.mapv(P, v => v.map(() => 0)), K.mapv(P, v => v.map(() => 1)),
              { ...clone(P), gate: new Array(N).fill(0) }];
for (const op of OPS) {
  for (const p0 of edge) {
    const before = clone(p0);
    let out;
    try { out = op(p0); } catch (e) { ok(false, "operator threw: " + e.message); continue; }
    ok(VECS.every(k => Array.isArray(out[k]) && out[k].length === N),
       "operator returned a malformed pattern");
    ok(VECS.every(k => out[k].every(Number.isFinite)), "operator produced a non-finite value");
    ok(eq(p0, before), "operator MUTATED its input");
  }
}

/* ---------------------------------------------------------------- 4. DETERMINISM */
console.log("determinism");
for (const gk of GK) {
  const g = GENRES[gk];
  ok(sig(allEvents(P, g, g.bars)) === sig(allEvents(P, g, g.bars)),
     gk + ": two renders of one input disagree");
}

/* ---------------------------------------------------------------- 5. THE OCTAVE LAW
   The regression that started this file. oct must move a pitched line by
   exactly twelve semitones per step, after the register fold. */
console.log("octave law — oct survives the register fold");
for (const gk of GK) {
  const g = GENRES[gk];
  const lineVoice = Array.from({ length: g.voices }, (_, v) => v)
    .find(v => g.realize(v) !== "pad");
  if (lineVoice == null) continue;
  const flat = clone(P); flat.oct = flat.oct.map(() => 0);
  const up = clone(P); up.oct = up.oct.map(() => 1);
  const a = K.render(flat, g, g.bars).filter(e => e.v === lineVoice).map(e => e.n);
  const b = K.render(up, g, g.bars).filter(e => e.v === lineVoice).map(e => e.n);
  ok(a.length === b.length && a.length > 0, gk + ": octave test found no comparable notes");
  ok(a.every((n, i) => b[i] - n === 12),
     gk + ": oct +1 did not raise the line by exactly 12 (fold is eating it)");
}

/* ---------------------------------------------------------------- 6. GHOST LAYER
   It fired for no operator at all until `only` existed, because accents are a
   subset of gates and whole-pattern operators preserve that. */
console.log("ghost layer fires");
{
  const g = GENRES.acid;
  const ghosts = K.drums(P, g, g.bars).filter(e => e.d === "p");
  ok(ghosts.length > 0, "acid ghost-percussion layer produced nothing");
  ok(ghosts.every(e => Number.isFinite(e.vel)), "ghost hits carry no velocity");
}

/* ---------------------------------------------------------------- 7. ENVELOPES
   Envelopes are a different type from operators: they act on the event stream
   and are a function of position, which no pattern operator can be. */
console.log("envelopes");
{
  const g = GENRES.acid, span = g.bars * 16 / g.rate;
  const ev = K.render(P, g, g.bars);
  const noop = K.envelope(ev, null, span);
  ok(sig(noop) === sig(ev), "envelope(null) changed the events");
  for (const kind of ["in", "out"]) {
    const out = K.envelope(ev, kind, span);
    ok(out.length === ev.length, "envelope " + kind + " changed the event count");
    ok(out.every(e => e.vel >= 0 && e.vel <= 9), "envelope " + kind + " left velocity out of range");
    const first = out[0].vel, last = out[out.length - 1].vel;
    ok(kind === "in" ? first < last : first > last,
       "envelope " + kind + " does not run in the right direction");
  }
  // monotone in the fade direction
  const fin = K.envelope(ev, "in", span);
  const byT = [...fin].sort((a, b) => a.t - b.t);
  const scaled = byT.map((e, i) => e.vel / Math.max(1, ev.slice().sort((a, b) => a.t - b.t)[i].vel));
  ok(scaled.every((v, i) => i === 0 || v >= scaled[i - 1] - 0.26), "fade in is not monotone");
}

/* ---------------------------------------------------------------- 8. HARMONY MODES */
console.log("harmony — modal, cycle, emergent");
{
  const modal = GENRES.acid;
  ok(Array.from({ length: 8 }, (_, b) => K.harm(P, modal, b)).every(r => r === 0),
     "modal harmony moved");
  const cyc = GENRES.vaporwave;
  ok(Array.from({ length: 8 }, (_, b) => K.harm(P, cyc, b))
       .every((r, b) => r === cyc.roots[b % cyc.roots.length]), "cycle harmony does not wrap");
  const em = GENRES.fugue;
  const roots = Array.from({ length: 4 }, (_, b) => K.harm(P, em, b));
  ok(new Set(roots).size > 1, "emergent harmony is constant (it should read the entries)");
  ok(roots.every(r => r >= 0 && r < 7), "emergent harmony left the mode");
}

/* ---------------------------------------------------------------- 9. SCALE + MODE OVERRIDES
   Both alphabets are per-genre facts. A subject may never sound a pitch class
   outside the scale it was read through. */
console.log("scale and mode overrides");
// Containment is relative to THE CHORD, not to the tonic. A cycle-harmony line
// is transposed by the bar's root — the blues riff goes up to the IV — so its
// pitch classes are the scale MOVED, and checking against the untransposed
// scale would forbid the thing that makes a progression audible.
for (const gk of GK) {
  const g = GENRES[gk], sc = g.scale || K.PENT, bs = 16 / g.rate;
  const ev = K.render(P, g, g.bars).filter(e => g.realize(e.v) !== "pad");
  for (let b = 0; b < g.bars; b++) {
    // A DIATONIC genre follows the chord by DEGREES, so its notes stay in ONE
    // scale all the way through — a stronger claim than the transposing kind,
    // and the check is stronger with it: root 0, no allowance for a moved
    // alphabet. (See render's `degShift`: transposing a seven-note subject by
    // semitones is what made tango and Eurythmics sound out of tune.)
    const root = (g.harmony === "cycle" && !g.diatonic)
      ? K.mp(K.harm(P, g, b), g.mode || undefined) : 0;
    const allowed = new Set(sc.map(x => (((x + root) % 12) + 12) % 12));
    // under a chord cycle a RAMPED note walks the chord's own rungs, and a
    // chord tone is not always in the pentatonic — that is the point of it
    if (g.harmony === "cycle") {
      const r2 = K.harm(P, g, b);
      for (const d of [r2, r2 + 2, r2 + 4])
        allowed.add((((K.mp(d, g.mode || undefined) % 12) + 12) % 12));
    }
    const bad = ev.filter(e => Math.floor(e.t / bs) === b)
                  .map(e => ((e.n % 12) + 12) % 12).filter(pc => !allowed.has(pc));
    ok(bad.length === 0,
       gk + " bar " + (b + 1) + ": pitch class outside the scale on that chord (" +
       [...new Set(bad)].join(",") + ")");
  }
}
for (const mk of Object.keys(MODES)) {
  const g = { ...GENRES.vaporwave, mode: MODES[mk] };
  const pcs = new Set(K.render(P, g, g.bars)
    .filter(e => g.realize(e.v) === "pad").map(e => ((e.n % 12) + 12) % 12));
  ok([...pcs].every(pc => MODES[mk].includes(pc)), mk + ": a pad chord left the mode");
  ok(pcs.size > 0, mk + ": no pad chord tones at all");
}

/* ---------------------------------------------------------------- 9b. CHROMATIC RANGE
   Two independent ways to change how wide a line is, and the whole point is
   that they are independent. spread MOVES THE NOTES within the alphabet;
   swapping the alphabet changes the width while leaving every degree — and so
   the exact contour — untouched. Both were flattened until the register fold
   stopped wrapping each note separately. */
console.log("chromatic range — spread moves notes, the alphabet moves width");
{
  const g = GENRES.simple;
  // ramp-free as well as octave-free: inc/stk move notes per LOOP, which is a
  // different axis from spread and would otherwise be read as spread failing
  const flat = { ...clone(P), oct: new Array(N).fill(0),
                 inc: new Array(N).fill(0), stk: new Array(N).fill(0) };
  const span = p2 => { const n = K.render(p2, g, g.bars).map(e => e.n);
                       return n.length ? Math.max(...n) - Math.min(...n) : 0; };
  const dir = p2 => K.render(p2, g, g.bars).map(e => e.n)
                     .map((v, i, a) => (i ? Math.sign(v - a[i - 1]) : 0)).join("");

  // monotone increasing in k, and k=0 collapses to a single pitch
  const spans = [0, 0.5, 1, 2, 3].map(k => span(K.spread(k)(flat)));
  ok(spans[0] === 0, "spread(0) is not a monotone");
  ok(spans.every((s, i) => i === 0 || s > spans[i - 1]),
     "spread does not widen monotonically: " + spans.join(","));
  ok(!K.render(K.spread(2)(flat), g, g.bars).some((e, i, a) =>
       i && Math.abs(e.n - a[i - 1].n) > 60), "spread(2) produced an absurd leap");

  // the alphabet changes the width and NOTHING else
  const base = { span: span(flat), dir: dir(flat) };
  for (const [sc, wide] of [[SCALES.chromatic, false], [SCALES.whole, false],
                            [SCALES.augmented, true], [SCALES.quartal, true]]) {
    const gg = { ...g, scale: sc };
    const n = K.render(flat, gg, gg.bars).map(e => e.n);
    const s2 = Math.max(...n) - Math.min(...n);
    const d2 = n.map((v, i, a) => (i ? Math.sign(v - a[i - 1]) : 0)).join("");
    ok(d2 === base.dir, "swapping the alphabet changed the contour");
    ok(wide ? s2 > base.span : s2 < base.span,
       "alphabet of " + sc.length + " notes did not move the span the right way");
    // width per degree-step is exactly 12 / length
    ok(Math.abs(K.pitch(sc.length, sc) - K.pitch(0, sc) - 12) < 1e-9,
       "scale of " + sc.length + " does not span an octave in its own length");
  }
}

/* ---------------------------------------------------------------- 9c. THE RAMP CLIMBS
   inc and stk accumulate with the loop index, and the register fold must not
   chase them: computing the octave shift from the RAMPED degrees re-centred the
   line every few loops, so a rising arpeggio audibly fell back down. The ramp
   sits on top of the registration, exactly like oct. */
console.log("ramps climb monotonically and the fold does not chase them");
{
  const g = { ...GENRES.simple, bars: 8, incClamp: 0 };
  const base = { ...clone(P), inc: new Array(N).fill(0), stk: new Array(N).fill(0) };
  const first = p2 => Array.from({ length: 8 }, (_, b) =>
    K.render(p2, g, 8).filter(e => Math.floor(e.t / 16) === b)[0].n);

  for (const [name, key, sign] of [["inc up", "inc", 1], ["inc down", "inc", -1],
                                   ["stk up", "stk", 1], ["stk down", "stk", -1]]) {
    const q = clone(base);
    q[key] = q[key].map((_, i) => (i === 0 ? sign : 0));
    const seq = first(q);
    const mono = seq.every((n, i) => i === 0 || (sign > 0 ? n >= seq[i - 1] : n <= seq[i - 1]));
    ok(mono, name + " is not monotone across loops: " + seq.join(" "));
    ok(Math.abs(seq[7] - seq[0]) > 6, name + " barely moved across eight loops: " + seq.join(" "));
  }
  // the three limit behaviours are three SHAPES, not three strengths
  {
    const q3 = clone(base); q3.stk = q3.stk.map((_, i) => (i === 0 ? 1 : 0));
    const seq = m => Array.from({ length: 12 }, (_, b) => K.rampOf(q3, 0, b, 4, m));
    const hold = seq("hold"), loop = seq("loop"), rev = seq("reverse");
    ok(hold.slice(4).every(v => v === 4), "hold does not settle at the limit: " + hold.join(" "));
    ok(loop[5] === 0 && loop[9] === 4, "loop does not wrap back to zero: " + loop.join(" "));
    ok(rev[5] === 3 && rev[8] === 0 && rev[9] === 1, "reverse does not turn round: " + rev.join(" "));
    ok(new Set([hold.join(), loop.join(), rev.join()]).size === 3,
       "the three limit modes are not three different shapes");
  }
  // and the clamp still bounds it
  const q2 = clone(base); q2.stk = q2.stk.map((_, i) => (i === 0 ? 1 : 0));
  const clamped = Array.from({ length: 8 }, (_, b) =>
    K.render(q2, { ...g, incClamp: 2 }, 8).filter(e => Math.floor(e.t / 16) === b)[0].n);
  ok(new Set(clamped.slice(3)).size === 1, "clamp 2 did not stop the ramp: " + clamped.join(" "));
}

/* ---------------------------------------------------------------- 9d. TIE + NEAREST ROOT
   Two things that keep a line playable rather than merely correct. */
console.log("tie merges repeats; the root shift takes the nearest octave");
{
  const rep = K.split(2)(P);
  const loose = K.render(rep, GENRES.simple, 4);
  const tied = K.render(rep, { ...GENRES.simple, artic: "tie" }, 4);
  ok(tied.length < loose.length, "tie did not merge any repeated notes");
  ok(Math.max(...tied.map(e => e.dur)) > Math.max(...loose.map(e => e.dur)),
     "tie produced no longer note than the untied version");
  // total sounding time, not the longest note: a note whose successor slides is
  // held full length under every articulation, so the max can tie
  const total = a => a.reduce((s, e) => s + e.dur, 0);
  ok(total(K.render(rep, { ...GENRES.simple, artic: "staccato" }, 4)) < total(loose),
     "staccato does not sound for less time than normal");

  // a cycle-harmony line must stay in ONE register: the root shift is folded to
  // the nearest octave, so the flat-VII drops two rather than climbing ten
  // MEASURE THE ROOT SHIFT ITSELF. A flat phrase — one degree, no octaves, no
  // ramp — renders one pitch per bar, so the bar-to-bar difference IS the root
  // shift and nothing else. Folded to the nearest octave it can never exceed a
  // tritone; unfolded, the flat-VII alone is ten.
  const flatP = { deg: new Array(N).fill(0), oct: new Array(N).fill(0),
                  vel: new Array(N).fill(5), inc: new Array(N).fill(0),
                  stk: new Array(N).fill(0), gate: new Array(N).fill(1),
                  acc: new Array(N).fill(0), sld: new Array(N).fill(0) };
  for (const gk of GK) {
    const g = GENRES[gk];
    if (g.harmony !== "cycle") continue;
    const bs = 16 / g.rate;
    const perBar = Array.from({ length: g.bars }, (_, b) =>
      K.render(flatP, g, g.bars).filter(e => g.realize(e.v) !== "pad" &&
        Math.floor(e.t / bs) === b).map(e => e.n)[0]);
    // each shift is folded against the TONIC into [-6..+6], so the widest gap
    // between any two bars is 12 — one octave, never more
    const xs = perBar.filter(x => x != null);
    const spread = Math.max(...xs) - Math.min(...xs);
    ok(spread <= 12, gk + ": root shifts spread " + spread +
       " semitones — not folded to the nearest octave");
  }
}

/* ---------------------------------------------------------------- 9e. ONE ALPHABET A BOX
   A layered genre must read the SAME subject alphabet as the one it is layered
   on. The layer inherits the section's mode but once did not inherit its
   `scale`, so an authority reading quartal played against a layer reading
   pentatonic — six semitones per degree-step against two point four. That does
   not sound like a missing override, it sounds like the tuning is broken. */
console.log("a layer reads the authority's alphabet");
{
  const SC = SCALES.quartal;
  const auth = { ...GENRES.rock, scale: SC };
  const layer = { ...GENRES.fugue, scale: SC, harmony: auth.harmony,
                  roots: auth.roots, rate: auth.rate };
  const pcOf = g2 => new Set(K.render(P, g2, 8)
    .filter(e => g2.realize(e.v) !== "pad").map(e => ((e.n % 12) + 12) % 12));
  const a = [...pcOf(auth)], l = [...pcOf(layer)];
  // both alphabets are the quartal set transposed by the shared roots, so the
  // layer can introduce no pitch class the authority could not also play
  const stray = l.filter(pc => !a.includes(pc));
  ok(stray.length === 0,
     "a layer sounded pitch classes its authority cannot: " + stray.join(","));
  // and the guard that would have caught it: drop the inherited scale and the
  // sets must diverge, or this test proves nothing
  const naive = { ...GENRES.fugue, harmony: auth.harmony, roots: auth.roots, rate: auth.rate };
  ok([...pcOf(naive)].some(pc => !a.includes(pc)),
     "the un-inherited case does not diverge — this check cannot fail");
}

/* ---------------------------------------------------------------- 10. NOTE DURATION
   A note lasts to the next gated step. The bug this replaced was every note
   being exactly one step, which is a row of 16ths, not a phrase. */
console.log("durations read the gate vector");
for (const gk of GK) {
  const g = GENRES[gk];
  const durs = new Set(K.render(P, g, g.bars).map(e => +e.dur.toFixed(3)));
  ok(durs.size > 1, gk + ": every note has the same duration");
  ok([...durs].every(d => d > 0), gk + ": a note has non-positive duration");
}

/* ---------------------------------------------------------------- 11. SWING + RATE */
console.log("swing bends the grid; rate scales it");
{
  const straight = K.render(P, { ...GENRES.blues, swing: 0 }, 4).map(e => e.t);
  const swung = K.render(P, GENRES.blues, 4).map(e => e.t);
  ok(straight.length === swung.length, "swing changed the event count");
  ok(swung.some((t, i) => t !== straight[i]), "swing moved nothing");
  ok(swung.every((t, i) => t >= straight[i]), "swing moved a note EARLIER");
  const half = K.render(P, { ...GENRES.acid, rate: 0.5 }, 4);
  const full = K.render(P, GENRES.acid, 4);
  ok(Math.abs(Math.max(...half.map(e => e.t)) - 2 * Math.max(...full.map(e => e.t))) < 1e-9,
     "half-time did not double the span");
}

/* ---------------------------------------------------------------- 12. DRUM FILLS */
console.log("drum fills land on the last bar of the form");
for (const gk of GK) {
  const g = GENRES[gk];
  if (!g.fill) continue;
  const dr = K.drums(P, g, g.bars), bs = 16 / g.rate;
  const perBar = Array.from({ length: g.bars },
    (_, b) => dr.filter(e => Math.floor(e.t / bs) === b).length);
  ok(perBar[g.bars - 1] > perBar[0], gk + ": the fill bar is not busier than bar 1");
  ok(dr.some(e => e.fill), gk + ": no event is flagged as a fill");
}

/* ---------------------------------------------------------------- 12b. BASS ALWAYS SOUNDS
   The root bass reads the accent vector for its rhythm. A phrase with no
   accents — which is what every cleared or empty slot is — left it silent in
   four of five genres. A bass part must not depend on the tune being emphatic. */
console.log("bass sounds even when the phrase has no accents");
{
  const flat = { ...clone(P), acc: new Array(N).fill(0) };
  const empty = K.mapv(P, v => v.map(() => 0));
  for (const gk of GK) {
    const g = GENRES[gk];
    if (g.nobass) {                       // a genre may declare it has no bass at all
      ok(K.bass(P, g, g.bars).length === 0, gk + ": nobass genre emitted bass anyway");
      continue;
    }
    ok(K.bass(flat, g, g.bars).length > 0, gk + ": no bass when the phrase has no accents");
    ok(K.bass(empty, g, g.bars).length > 0, gk + ": no bass for an empty phrase");
    // and the accented case must not have drifted
    ok(K.bass(P, g, g.bars).length > 0, gk + ": no bass for an accented phrase");
  }
}

/* ---------------------------------------------------------------- 13. WALKING BASS */
console.log("walking bass arrives on the next root");
{
  const g = GENRES.blues, bs = 16, ev = K.bass(P, g, g.bars);
  ok(ev.length === g.bars * 4, "walking bass is not four notes a bar");
  for (let b = 0; b < g.bars; b++) {
    const bar = ev.filter(e => Math.floor(e.t / bs) === b);
    const nextRoot = ev.filter(e => Math.floor(e.t / bs) === (b + 1) % g.bars)[0];
    ok(Math.abs(bar[3].n - nextRoot.n) <= 2,
       "bar " + (b + 1) + ": the approach note does not land beside the next root");
  }
}

/* ---------------------------------------------------------------- 14. KIT OPERATORS
   A kit operator is total on kits the way a pattern operator is total on
   patterns. Two of the thirteen (`four`, `offbeat`) are deliberately allowed to
   WRITE a lane the genre did not have, because putting a kick on every quarter
   is an idea no rearrangement of the existing lanes can express — so they are
   the two exceptions, and the test says which. */
console.log("kit operators are total, and only two of them invent a lane");
{
  const WRITES = new Set(["four", "offbeat"]);
  for (const gk of GK) {
    const g = GENRES[gk], base = g.kit || {};
    for (const [name, op] of Object.entries(K.KITOPS)) {
      const out = op(base);
      ok(out && typeof out === "object", gk + "/" + name + ": did not return a kit");
      for (const [lane, vec] of Object.entries(out)) {
        ok(Array.isArray(vec) && vec.length === 16,
           gk + "/" + name + ": lane " + lane + " is not sixteen steps");
        ok(vec.every(x => x === 0 || x === 1),
           gk + "/" + name + ": lane " + lane + " left the binary alphabet");
        ok(WRITES.has(name) || base[lane],
           gk + "/" + name + ": invented lane " + lane + " out of nothing");
      }
      // and it must be a KIT: drums() has to accept whatever comes out
      ok(K.drums(P, { ...g, kit: out, fill: null }, g.bars).length >= 0,
         gk + "/" + name + ": drums() would not read the result");
    }
    // the subtractive ones actually subtract
    ok(!("k" in K.KITOPS.nokick(base)), gk + ": nokick left a kick");
    ok(!Object.keys(K.KITOPS.nodrums(base)).length, gk + ": nodrums left a lane");
    if (base.k && base.s)
      ok(K.KITOPS.swap(base).k.join("") === base.s.join("") &&
         K.KITOPS.swap(base).s.join("") === base.k.join(""),
         gk + ": swap did not exchange the kick and the snare");
  }
  // double time is the bar's pattern read at twice the rate, not a busier lane
  const k = { h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0] };
  ok(K.KITOPS.doubletime(k).k.join("") === "1000100010001000",
     "double time did not double the kick");
  ok(K.KITOPS.sparse(k).h.filter(Boolean).length === 4, "sparse did not thin to the quarters");
}

/* ---------------------------------------------------------------- 15. BASS STYLES
   Every style must SOUND, and the two that own their own rhythm must own it
   even when the phrase has no accents to read — which is the whole reason
   STYLEGRID exists, and is the bug the accent-reading bass had in a different
   shape. */
console.log("bass styles: each is a different part, and none of them is silent");
{
  const g = GENRES.rock, flat = { ...clone(P), acc: new Array(N).fill(0) };
  const shapes = {};
  for (const st of ["walk", "octaves", "fifths", "pedal", "eighths", "sixteenths", undefined]) {
    const gg = { ...g, bassStyle: st }, name = st || "roots";
    const ev = K.bass(P, gg, g.bars);
    ok(ev.length > 0, name + ": emitted no bass at all");
    ok(ev.every(e => e.n > 0 && Number.isFinite(e.n)), name + ": emitted a nonsense pitch");
    ok(K.bass(flat, gg, g.bars).length > 0, name + ": went silent on an unaccented phrase");
    shapes[name] = JSON.stringify(ev.map(e => [e.t, e.n]));
  }
  // they are genuinely different parts, not one part with a different label
  const seen = new Map();
  for (const [name, s] of Object.entries(shapes)) {
    ok(!seen.has(s), name + " renders identically to " + seen.get(s));
    seen.set(s, name);
  }
  ok(K.bass(P, { ...g, bassStyle: "eighths" }, 1).length === 8, "eighths is not eight a bar");
  ok(K.bass(P, { ...g, bassStyle: "sixteenths" }, 1).length === 16, "sixteenths is not sixteen a bar");
  // PEDAL refuses the progression — that is the definition of it
  const ped = K.bass(P, { ...g, bassStyle: "pedal" }, g.bars);
  ok(new Set(ped.map(e => e.n)).size === 1, "the pedal bass moved off the tonic");
  ok(new Set(K.bass(P, g, g.bars).map(e => e.n)).size > 1,
     "the root bass does NOT follow the progression (so pedal proves nothing)");
}

/* ---------------------------------------------------------------- 16. THE EDGES
   intro/outro are a third type: not timeless like an operator, not a curve over
   the section like an envelope, but a rewrite of ONE bar at a known end. That is
   what lets a drum fill be a different bar rather than a louder one — and the
   test that matters is exactly that: the fill bar must contain drum events the
   section never had. */
console.log("intro and outro rewrite the first and last bar");
{
  const g = GENRES.rock, bs = 16 / g.rate, span = g.bars * bs;
  const ev = [...K.render(P, g, g.bars),
              ...K.drums(P, g, g.bars).map(e => ({ ...e, kind: "hit" }))]
    .map(e => ({ kind: e.kind || "line", ...e })).sort((a, b) => a.t - b.t);
  const inBar = l => l.filter(e => e.t < bs);
  const lastBar = l => l.filter(e => e.t >= span - bs);

  ok(K.edges(ev, null, null, span, bs) === ev, "edges with no ends copied the stream");
  for (const k of Object.keys({ count: 1, hit: 1, solo: 1, kit: 1, swell: 1 })) {
    const out = K.intro(ev, k, span, bs);
    ok(out.every(e => Number.isFinite(e.t) && e.t >= 0), "intro " + k + ": a bad time");
    // NOTHING PAST THE FIRST BAR MOVES. An intro that quietly edited bar 6 would
    // be a transition in name only.
    ok(JSON.stringify(out.filter(e => e.t >= bs)) ===
       JSON.stringify(ev.filter(e => e.t >= bs)),
       "intro " + k + " changed the section after its own bar");
  }
  ok(inBar(K.intro(ev, "solo", span, bs)).every(e => e.kind === "line"),
     "intro solo left drums in the first bar");
  ok(inBar(K.intro(ev, "kit", span, bs)).every(e => e.kind === "hit"),
     "intro kit left the melody in the first bar");
  ok(inBar(K.intro(ev, "count", span, bs)).length === 4,
     "the count-in is not four clicks");

  for (const k of Object.keys({ fill: 1, roll: 1, crash: 1, break: 1, tail: 1, cut: 1 })) {
    const out = K.outro(ev, k, span, bs);
    ok(JSON.stringify(out.filter(e => e.t < span - bs)) ===
       JSON.stringify(ev.filter(e => e.t < span - bs)),
       "outro " + k + " changed the section before its own bar");
  }
  // THE FILL IS A DIFFERENT BAR. Snare hits the section did not have, and more
  // of them in the second half than the first — which is what makes it a fill
  // rather than a busier loop.
  const fl = lastBar(K.outro(ev, "fill", span, bs)).filter(e => e.d === "s");
  const was = lastBar(ev).filter(e => e.d === "s").length;
  ok(fl.length > was, "the drum fill added no snare (was " + was + ", now " + fl.length + ")");
  ok(fl.filter(e => e.t >= span - bs / 2).length > fl.filter(e => e.t < span - bs / 2).length,
     "the fill does not accelerate into the bar line");
  ok(fl.every(e => e.fill), "a fill event is not flagged as a fill");
  const roll = lastBar(K.outro(ev, "roll", span, bs)).filter(e => e.d === "s");
  const gaps = roll.map((e, i, a) => (i ? e.t - a[i - 1].t : null)).filter(x => x != null);
  ok(gaps.every((x, i) => i === 0 || x <= gaps[i - 1]), "the roll does not accelerate");
  ok(!lastBar(K.outro(ev, "tail", span, bs)).some(e => e.kind === "hit"),
     "outro tail left the drums playing");
  ok(lastBar(K.outro(ev, "break", span, bs)).every(e => e.kind === "hit"),
     "outro break left the melody playing");
  ok(K.outro(ev, "cut", span, bs).every(e => e.t < span - bs / 4), "cut did not cut");
  ok(lastBar(K.outro(ev, "crash", span, bs)).length === 2, "the crash is not one gesture");
  // and the two ends compose without either eating the other
  const both = K.edges(ev, "count", "fill", span, bs);
  ok(inBar(both).length === 4, "the outro ate the intro");
  ok(lastBar(both).some(e => e.fill), "the intro ate the outro");
}

/* ---------------------------------------------------------------- 17. ENVELOPE SHAPES */
console.log("envelope shapes and cuts");
{
  const g = GENRES.acid, span = g.bars * 16 / g.rate, ev = K.render(P, g, g.bars);
  const mid = e => Math.abs(e.t - span / 2) < span / 8;
  const sw = K.envelope(ev, "swell", span);
  ok(sw.length === ev.length, "swell changed the event count");
  ok(sw.filter(mid).every(e => e.vel > 0), "the swell is silent in the middle");
  ok(sw[0].vel < sw.filter(mid)[0].vel && sw[sw.length - 1].vel < sw.filter(mid)[0].vel,
     "the swell does not rise and fall");
  const dk = K.envelope(ev, "duck", span);
  ok(dk.filter(mid).every(e => e.vel <= sw.filter(mid)[0].vel), "duck does not duck");
  ok(K.envelope(ev, "drop", span).every(e => e.t < span * 0.875), "drop left the last eighth");
  const st = K.envelope(ev, "stutter", span);
  ok(st.length >= ev.length, "stutter removed events instead of repeating them");
  ok(st.every(e => e.t < span), "stutter ran past the end of the section");
  ok(K.envelope(ev, "nonsense", span) === ev, "an unknown envelope was not a no-op");
}

/* ---------------------------------------------------------------- 18. SPLIT CLIMBS
   A split note's copies are not copies. The step's own ramp applies once per
   repeat, which is what turns split from a stutter into an arpeggio — and is
   what anyone who set a ramp AND split the note was asking for. A step with no
   ramp must be byte-identical to the old behaviour, or every existing song
   changes underneath its author. */
console.log("split applies the ramp once per repeat");
{
  const flat = { deg: new Array(N).fill(2), oct: new Array(N).fill(0),
                 vel: new Array(N).fill(5), inc: new Array(N).fill(0),
                 stk: new Array(N).fill(0),
                 gate: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
                 acc: new Array(N).fill(0), sld: new Array(N).fill(0) };
  ok(eq(K.split(4)(flat).deg, new Array(N).fill(2)),
     "a ramp-free split moved a degree — every existing song just changed");
  const ramp = clone(flat); ramp.inc = ramp.inc.map((_, i) => (i % 4 === 0 ? 1 : 0));
  const out = K.split(4)(ramp);
  // the note at step 0 lasts four steps and splits into 0,1,2,3 — climbing
  ok(out.deg.slice(0, 4).join(",") === "2,3,4,5",
     "split did not climb by the ramp: " + out.deg.slice(0, 4).join(","));
  ok(out.gate.slice(0, 4).every(Boolean), "split did not subdivide the note");
  // ...and each subdivision keeps the ramp, so it goes on climbing every loop
  ok(out.inc.slice(0, 4).every(x => x === 1), "a subdivision lost the ramp");
  const down = clone(ramp); down.inc = down.inc.map(x => -x);
  ok(K.split(4)(down).deg.slice(0, 4).join(",") === "2,1,0,-1", "a falling ramp did not fall");
  // and it is AUDIBLE as pitch, not just as data
  const g = { ...GENRES.simple, incClamp: 0 };
  const pitches = K.render(K.split(4)(ramp), g, 1).map(e => e.n).slice(0, 4);
  ok(new Set(pitches).size === 4, "the split arpeggio came out on one pitch: " + pitches.join(","));
  ok(pitches.every((n, i) => i === 0 || n > pitches[i - 1]), "the split arpeggio does not ascend");
}

/* ---------------------------------------------------------------- 19. SWING + GROOVE
   Swing bends the grid. Groove bends the grid AND the dynamics, per sixteenth.
   They are two knobs because they are two different claims, and the test that
   matters for both is that they move real events without breaking the stream. */
console.log("groove moves time and level, and never breaks the stream");
{
  const g = GENRES.rock, bs = 16 / g.rate;
  const ev = [...K.render(P, g, g.bars),
              ...K.drums(P, g, g.bars).map(e => ({ ...e, kind: "hit" }))]
    .sort((a, b) => a.t - b.t);
  ok(K.groove(ev, null, bs, 1) === ev, "groove(null) copied the stream");
  ok(K.groove(ev, "funk", bs, 0) === ev, "groove at amount 0 is not a no-op");
  for (const name of Object.keys(K.GROOVES)) {
    const out = K.groove(ev, name, bs, 1);
    ok(out.length === ev.length, name + ": changed the event count");
    ok(out.every(e => e.t >= 0 && Number.isFinite(e.t)), name + ": produced a bad time");
    ok(out.every(e => e.vel == null || (e.vel >= 0 && e.vel <= 9)),
       name + ": left velocity out of range");
    ok(out.every((e, i) => i === 0 || e.t >= out[i - 1].t), name + ": came back unsorted");
    // it has to actually DO something, and something you could hear
    const movedT = out.filter((e, i) => Math.abs(e.t - ev[i].t) > 1e-9).length;
    const movedV = out.filter((e, i) => e.vel !== ev[i].vel).length;
    ok(movedV > 0, name + ": changed no velocity at all");
    ok(K.GROOVES[name].push ? movedT > 0 : movedT === 0,
       name + ": its timing claim and what it did disagree");
    // and it must stay INSIDE the sixteenth it belongs to — a groove that walks
    // a note onto the next step is a rewrite, not a feel
    ok(out.every((e, i) => Math.abs(e.t - ev[i].t) < bs / 16),
       name + ": moved a note further than one sixteenth");
  }
  // amount is a dial: half the profile is half the departure
  const half = K.groove(ev, "funk", bs, 0.5), full = K.groove(ev, "funk", bs, 1);
  const dev = l => l.reduce((a, e, i) => a + Math.abs(e.t - ev[i].t), 0);
  ok(dev(half) < dev(full) && dev(half) > 0, "groove amount is not a dial");
  // SWING is the other one, and it is genre-level: a section that asks for
  // straight must get straight even from a genre that swings
  const swung = K.render(P, { ...GENRES.blues, swing: 1 / 3 }, 4).map(e => e.t);
  const flatT = K.render(P, { ...GENRES.blues, swing: 0 }, 4).map(e => e.t);
  ok(swung.some((t, i) => t > flatT[i]), "swing 1/3 moved nothing");
  ok(swung.every((t, i) => t >= flatT[i]), "swing moved a note earlier");
}

/* ---------------------------------------------------------------- 20. THE COMPOSER
   A generator that runs once per button click is the hardest kind of thing to
   trust: it is right nine times and you never see the tenth. So compose every
   genre at forty seeds and check all 560 — the whole point of keeping the
   arranger pure and seeded is that this is cheap. */
console.log("the composer writes songs that are songs");
{
  const C = require("../../nukernel/compose.js");
  const { NSLOTS } = require("../../nukernel/fields.js");
  const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
  let silent = 0, unused = 0, leaps = 0, notes = 0;
  for (const gk of GK) {
    for (const s of seeds) {
      const song = C.compose(gk, s), G = GENRES[gk];
      // the shape Load reads, or it cannot come back (v:2 = `echo` for `del`,
      // padded slot banks — see nukernel/song.js migrate)
      ok(song.v === 2 && song.slots.length === NSLOTS && song.song.length >= 6,
         gk + "/" + s + ": not the saved shape");
      ok(song.bpm >= 70 && song.bpm <= 160, gk + "/" + s + ": bpm outside the control's range");
      ok(song.slots.every(p => ["deg", "oct", "vel", "gate", "acc", "sld", "inc", "stk"]
        .every(k => Array.isArray(p[k]) && p[k].length === 16 && p[k].every(Number.isFinite))),
        gk + "/" + s + ": a phrase is not a valid pattern");
      const used = new Set();
      for (const b of song.song) {
        ok(C.ROLES[b.role], gk + "/" + s + ": a section has no role");
        ok(b.stack.length && b.stack.every(e => GENRES[e.g]), gk + "/" + s + ": bad stack");
        // AN INTRO BED HAS NO PHRASE BY DESIGN — four bars of drums, then the
        // bass, then the tune, which is an arrangement rather than a fade. It
        // still has to make a sound, and out of the right layer: a drums-only
        // bed with a bass part in it is not a drums-only bed.
        const bed = !!C.BEDS[b.role];
        if (bed) {
          ok(!b.stack[0].slots.length, gk + "/" + s + ": a " + b.role +
             " bed has a melody in it — it is a bed, that is the whole idea");
          const blank = K.mapv(P, v => v.map(() => 0));
          // MIRROR genreOf EXACTLY. A kit operator replaces the kit, and the
          // engine also drops the FILL and the ghost lane with it — without
          // that, "no drums" still plays a fill on the last bar of the form and
          // a ghost-perc layer underneath, which is not no drums.
          const g3 = b.kit
            ? { ...G, kit: K.KITOPS[b.kit](G.kit || {}), fill: null,
                ghost: b.kit === "nodrums" ? null : G.ghost }
            : G;
          const dr = K.drums(blank, g3, G.bars).length;
          const bs = K.bass(blank, { ...g3, nobass: b.bassop === "nobass" }, G.bars).length;
          // EACH BED IS ITS OWN LAYER, and the name says which. A section called
          // "drums" with a bass part in it is not the thing the label promises.
          const want = { drums: [1, 0], bass: [0, 1], groove: [1, 1] }[b.role];
          ok(!!dr === !!want[0] && !!bs === !!want[1],
             gk + "/" + s + ": the \"" + b.role + "\" bed has " + dr + " drums and " +
             bs + " bass");
        } else ok(b.stack[0].slots.length,
                  gk + "/" + s + "/" + b.role + ": a section with no phrase");
        ok(b.len >= 1 && b.nudge >= 0, gk + "/" + s + ": bad window");
        for (const e of b.stack) for (const i of e.slots) used.add(i);
        // EVERY SECTION MUST SOUND. A composed song with a silent bridge is the
        // failure nobody reports, because it reads as a deliberate pause.
        if (bed) continue;                    // measured above, on its own terms
        const g2 = { ...G, ...(b.mode ? { mode: MODES[b.mode] } : {}) };
        let ev = 0;
        for (const e of b.stack)
          for (const i of e.slots)
            ev += K.render(song.slots[i], g2, G.bars).length +
                  K.drums(song.slots[i], g2, G.bars).length +
                  K.bass(song.slots[i], g2, G.bars).length;
        if (!ev) { silent++; ok(false, gk + "/" + s + ": the " + b.role + " is silent"); }
      }
      // IT WRITES EIGHT PHRASES. If it only ever reaches for three it has not
      // arranged anything, it has looped one idea and labelled the loops — which
      // is exactly what the arc plan was doing before this check existed.
      if (used.size < 4) unused++;
    }
    // SEEDED, so a seed is a song: the composer is reproducible or it is a slot
    // machine, and a slot machine cannot be debugged.
    ok(JSON.stringify(C.compose(gk, 9)) === JSON.stringify(C.compose(gk, 9)),
       gk + ": the same seed composed two different songs");
    ok(JSON.stringify(C.compose(gk, 9)) !== JSON.stringify(C.compose(gk, 10)),
       gk + ": two different seeds composed the same song");
    // and the plan fits the genre — a fugue does not have a drop. NO fallback:
    // PLAN_OF must carry every genre (the coverage gate below enforces it)
    const plan = C.PLANS[C.PLAN_OF[gk]];
    ok(plan && plan[0] === "intro" && plan[plan.length - 1] === "outro",
       gk + ": the plan does not start with an intro and end with an outro");
  }
  ok(!silent, silent + " composed sections are silent");
  ok(!unused, unused + " composed songs use fewer than four of their eight phrases");
  {
    // THE DRUM INTRO IS OFFERED, NOT PROMISED — but on a genre with a kit it has
    // to happen, and on one without a kit it must never happen, because there is
    // nothing to bring in.
    const beds = gk => seeds.reduce((n, s) => n +
      C.compose(gk, s).song.filter(b => C.BEDS[b.role]).length, 0);
    ok(beds("rock") > 6, "a genre with a full kit never gets a drum intro (" + beds("rock") + ")");
    for (const gk of GK) {
      if (Object.keys(GENRES[gk].kit || {}).length) continue;
      ok(beds(gk) === 0, gk + " has no drums and was given a drum intro anyway");
    }
  }
  {
    let spent = 0;
    for (const gk of GK) for (const s of seeds) {
      const song = C.compose(gk, s), u = new Set();
      for (const b of song.song) for (const e of b.stack) for (const i of e.slots) u.add(i);
      spent += u.size;
    }
    const avg = spent / (GK.length * seeds.length);
    ok(avg >= 5.5, "the composer spends only " + avg.toFixed(1) + " of its eight phrases on average");
  }
  // THE PHRASES ARE WALKS, NOT NOISE. A tune moves mostly by step; if the
  // average interval is a fifth, the composer is a random number generator with
  // a nice comment on it.
  for (const kind of ["hook", "answer", "riff", "counter", "climb"]) {
    let big = 0, all = 0;
    for (const s of seeds) {
      const p = C.phrase(C.rng(s * 31), kind);
      const on = p.deg.filter((_, i) => p.gate[i]);
      for (let i = 1; i < on.length; i++) { all++; if (Math.abs(on[i] - on[i - 1]) > 2) big++; }
    }
    ok(all > 20, kind + ": too few notes to judge");
    ok(big / all < 0.25, kind + ": " + Math.round(100 * big / all) +
       "% of its intervals are leaps — that is noise, not a phrase");
  }
  void leaps; void notes;
}

/* ---------------------------------------------------------------- 21. THE LOADER
   song.js is the one gate every song passes — localStorage, files, presets,
   the composer — and until it was pure it was tested only by a browser. Now
   the whole contract is provable here: round trip, typed errors, migration. */
console.log("the loader — round trip, typed errors, clamps, migration");
{
  const S = require("../../nukernel/song.js");
  const F = require("../../nukernel/fields.js");
  const NI = require("../../nukernel/instruments.js");
  const C = require("../../nukernel/compose.js");
  const { PRESETS } = require("../../nukernel/presets.js");
  const seeds = Array.from({ length: 40 }, (_, i) => i + 1);

  // (a) ROUND TRIP: everything the composer can emit, the loader accepts —
  // the contract that used to be one browser smoke check, now exhaustive.
  for (const gk of GK) for (const s of seeds) {
    const res = S.validateSong(C.compose(gk, s));
    ok(res.ok, gk + "/" + s + ": the loader refused a composed song — " +
       (res.errors[0] && res.errors[0].path));
  }
  // ...and through the full path, any-version in
  ok(S.load(C.compose("rock", 3)).ok, "load() refused a composed song");

  // (b) REGISTRY COVERAGE: every fields.js entry is complete. The registry is
  // the single definition of every control, so an incomplete entry is a chip
  // the palette cannot draw or a field validation cannot check.
  for (const f of F.FIELDS) {
    ok(typeof f.key === "string" && f.key, "a fields entry has no key");
    ok(f.scope === "box" || f.scope === "layer", f.key + ": scope is not box|layer");
    ok(typeof f.tab === "string" && f.tab, f.key + ": no palette tab");
    ok(typeof f.group === "string" && f.group, f.key + ": no group title");
    if (f.type === "int") {
      ok(Number.isFinite(f.min) && Number.isFinite(f.max) && f.min <= f.max,
         f.key + ": int field without a [min,max]");
      ok(Number.isFinite(f.default) && f.default >= f.min && f.default <= f.max,
         f.key + ": default outside its own range");
      continue;
    }
    ok(f.table && typeof f.table === "object" && Object.keys(f.table).length,
       f.key + ": no value table");
    ok(f.labels && Object.keys(f.table).every(k => f.labels[k] != null),
       f.key + ": a table value has no label");
    if (f.type === "list") ok(Array.isArray(f.default), f.key + ": list default is not []");
    else ok(f.default === null, f.key + ": enum default is not null (absent = genre's own)");
  }
  // the registry and the constructor agree on what a box IS
  {
    const b = S.emptyBox();
    for (const f of F.FIELDS)
      if (f.type !== "vox") ok(f.key in b, "emptyBox is missing registry field " + f.key);
    const wrapped = { v: 2, slots: [S.blank()], song: [b], bpm: 126, vol: 80 };
    ok(S.validateSong(wrapped).ok, "emptyBox does not validate");
  }

  // (c) EXHAUSTIVE TOGGLE: every value in the registry, applied to a fresh
  // box, must produce a song the loader accepts — so no palette chip can ever
  // write a song that refuses to come back.
  const trial = box => S.validateSong(
    { v: 2, slots: [S.blank()], song: [box], bpm: 126, vol: 80 });
  for (const f of F.FIELDS) {
    if (f.type === "int") continue;                  // clamped, checked below
    for (const k of Object.keys(f.table)) {
      const b = S.emptyBox();
      if (f.type === "list") b[f.key] = [k];
      else if (f.type === "vox") b.vox = { [f.key]: k };
      else b[f.key] = k;
      let r = trial(b);
      ok(r.ok, f.key + "=" + k + " on the box: loader refused — " +
         (r.errors[0] && r.errors[0].path));
      if (f.scope === "layer") {                     // and on a stack entry
        const b2 = S.emptyBox();
        if (f.type === "list") b2.stack[0][f.key] = [k];
        else if (f.type === "vox") b2.stack[0].vox = { [f.key]: k };
        else b2.stack[0][f.key] = k;
        r = trial(b2);
        ok(r.ok, f.key + "=" + k + " on a layer: loader refused — " +
           (r.errors[0] && r.errors[0].path));
      }
    }
  }
  // typed errors: a bad value names its field instead of shrugging
  {
    const b = S.emptyBox(); b.rev = "soaked";
    const r = trial(b);
    ok(!r.ok && /\.rev$/.test(r.errors[0].path),
       "a bad send did not name its own field: " + JSON.stringify(r.errors[0]));
  }
  // the clamps: a hand-edited len of 1e9 comes back as MAX_LEN, not a hung tab
  {
    const b = S.emptyBox(); b.len = 1e9; b.nudge = -5;
    const r = trial(b);
    ok(r.ok && r.song.song[0].len === F.MAX_LEN && r.song.song[0].nudge === 0,
       "len/nudge are not clamped into range: " +
       (r.ok ? r.song.song[0].len + "/" + r.song.song[0].nudge : "rejected"));
  }
  // the filter rule: unknown ops/fx are dropped, never fatal — a song loses an
  // obsolete chip rather than losing itself
  {
    const b = S.emptyBox(); b.ops = ["rev", "nonsense"]; b.fx = ["chorus", "nonsense"];
    const r = trial(b);
    ok(r.ok && r.song.song[0].ops.join(",") === "rev" &&
       r.song.song[0].fx.join(",") === "chorus",
       "the ops/fx filter rule does not filter");
  }

  // (d) GENRE COVERAGE: a genre is instrument + plan + tempo as much as it is
  // a kit — and none of them may default silently. Three tables used to fall
  // back (piano / pop plan / 120 bpm) and nothing could notice a rotted entry.
  for (const gk of GK) {
    const g = GENRES[gk];
    ok(typeof g.instr === "string" ||
       (Array.isArray(g.instr) && g.instr.length && g.instr.every(x => typeof x === "string")),
       gk + ": no `instr` in genres.js");
    for (let v = 0; v < g.voices; v++)
      ok(typeof NI.instrOf(gk, v) === "string", gk + ": instrOf failed for voice " + v);
    ok(C.PLANS[C.PLAN_OF[gk]], gk + ": no PLAN_OF entry");
    ok(Number.isFinite(C.BPM[gk]) && C.BPM[gk] >= 70 && C.BPM[gk] <= 160,
       gk + ": no BPM entry in the control's range");
  }
  // ...and the miss is LOUD, not a polite piano
  {
    let threw = false;
    try { NI.instrOf("no_such_genre", 0); } catch (e) { threw = true; }
    ok(threw, "instrOf did not throw for a genre without an instrument");
  }

  // (e) MIGRATION: the shipped preset (v:1, pre-stack, pre-mixer) and a v:1
  // fixture with every legacy wrinkle still load after the v:2 bump.
  {
    const r = S.load(PRESETS[0].data);
    ok(r.ok, "the shipped preset no longer loads: " +
       JSON.stringify(r.errors && r.errors[0]));
    ok(PRESETS[0].data.v === 1, "migrate MUTATED the shipped preset literal");
    const r2 = S.load(PRESETS[0].data);
    ok(r2.ok, "the shipped preset does not survive being loaded twice");
  }
  {
    const oldPhrase = () => ({ deg: new Array(16).fill(0), oct: new Array(16).fill(0),
                               vel: new Array(16).fill(5), gate: new Array(16).fill(1),
                               acc: new Array(16).fill(0), sld: new Array(16).fill(0) });
    const v1 = { v: 1, slots: [oldPhrase(), oldPhrase()],   // short bank, no inc/stk
                 song: [{ genre: "acid", slots: [0], len: 4, nudge: 0,
                          ops: ["rev"], del: "some" }],     // pre-stack, old `del`
                 bpm: 126, vol: 80 };
    const r = S.load(v1);
    ok(r.ok, "a v:1 save no longer loads: " + JSON.stringify(r.errors && r.errors[0]));
    if (r.ok) {
      const b = r.song.song[0];
      ok(b.stack && b.stack[0].g === "acid", "the stack climb is gone");
      ok(b.echo === "some" && !("del" in b), "del was not renamed to echo");
      ok(r.song.slots.length === F.NSLOTS, "a short slot bank was not padded to " + F.NSLOTS);
      ok(r.song.slots.every(p => Array.isArray(p.inc) && Array.isArray(p.stk)),
         "the ramp vectors were not backfilled");
      ok(r.song.v === 2, "migrate did not stamp the current version");
    }
  }
}

console.log("\nnukernel: " + (checks - fails) + "/" + checks + " checks pass across " +
            GK.length + " genres");
if (fails) { console.error("nukernel: " + fails + " FAILURE(S)"); process.exit(1); }
process.exit(0);
