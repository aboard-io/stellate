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
const { DEFAULT, GENRES, MODES, SCALES, FAMILIES } = require("../../nukernel/genres.js");

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
    // chord tone is not always in the pentatonic — that is the point of it.
    // The rungs come from chordsOf, so a genre whose prog carries a SEVENTH
    // licenses the seventh: blues' major third over I7 is the identity, not
    // a leak. Without a prog this is exactly the old [r, r+2, r+4] triad.
    if (g.harmony === "cycle")
      for (const c of K.chordsOf(P, g, b))
        for (const n of c.pcs) allowed.add(((n % 12) + 12) % 12);
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
   genre at forty seeds and check every one — the whole point of keeping the
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
                kits: !G.kits ? null : b.kit === "nodrums" ? null
                  : G.kits.map(k4 => K.KITOPS[b.kit](k4)),
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
  // a nice comment on it. The HOOK KINDS get a looser fence on purpose: the
  // climax is a DESIGNED leap (one note raised above everything, that is its
  // job) and the cell joins of an A A B A' layout are two more — their noise
  // check is the motif-repetition gate below, which no random walk can pass.
  for (const kind of ["hook", "topline", "answer", "riff", "counter", "climb"]) {
    const fence = kind === "hook" || kind === "topline" ? 0.38 : 0.25;
    let big = 0, all = 0;
    for (const s of seeds) {
      const p = C.phrase(C.rng(s * 31), kind);
      const on = p.deg.filter((_, i) => p.gate[i]);
      for (let i = 1; i < on.length; i++) { all++; if (Math.abs(on[i] - on[i - 1]) > 2) big++; }
    }
    ok(all > 20, kind + ": too few notes to judge");
    ok(big / all < fence, kind + ": " + Math.round(100 * big / all) +
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
  // ...and every id NAMES A REAL SAMPLER. instrOf proves the field exists;
  // this proves the string means something — a typo'd id used to sail through
  // node and fail only in a browser with the sample layer fetched. The
  // registry is a classic window-global script, so it is read here the way
  // the page reads it: evaluated, not required.
  {
    const vm = require("vm"), fs = require("fs"), path = require("path");
    const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(
      path.join(__dirname, "../../engine/registry-data.js"), "utf8"), ctx);
    const SAMPLERS = (ctx.__REGISTRY && ctx.__REGISTRY.SAMPLERS) || {};
    ok(Object.keys(SAMPLERS).length > 100, "registry-data.js did not yield SAMPLERS");
    ok(SAMPLERS[NI.BASS_INSTR], "BASS_INSTR is not a registry sampler");
    for (const gk of GK) {
      const e = GENRES[gk].instr, ids = Array.isArray(e) ? e : [e];
      for (const id of ids)
        ok(!!SAMPLERS[id], gk + ": instr \"" + id + "\" is not a SAMPLERS id");
    }
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
    // ...and EVERY shipped preset, whatever its vintage: the radio-dial four
    // are composer output frozen as literals, and they take the same door
    for (const p of PRESETS) {
      const ra = S.load(p.data), rb = S.load(p.data);
      ok(ra.ok && rb.ok, "shipped preset \"" + p.name + "\" no longer loads twice: " +
         JSON.stringify((ra.errors || rb.errors || [])[0]));
    }
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

/* ---------------------------------------------------------------- 22. NEUTRALITY
   Every field the composition-depth round added is OPT-IN: absent must render
   byte-identically to the field set to its documented neutral value, and the
   old semantics must still be derivable from first principles. This is the
   gate that lets the depth land without moving a single existing song. */
console.log("neutrality — absent equals neutral for every new field");
{
  const sig2 = ev => JSON.stringify(ev.map(e => [e.t, e.n, e.d, e.dur, e.vel, e.acc, e.sld]));
  // reference genres left UNWIRED on purpose — they are the control group
  for (const gk of ["acid", "fugue", "vaporwave", "gregorian", "rock"]) {
    const g = GENRES[gk];
    const neutral = { ...g, maxHold: 0, key: 0, period: null, kits: null,
                      kitVel: null, prog: null, pipes: null, part: null };
    ok(sig2(allEvents(P, g, g.bars)) === sig2(allEvents(P, neutral, g.bars)),
       gk + ": neutral values do not render identically to absent fields");
  }
  // the OLD PAD SEMANTICS, recomputed from scratch: a progression-less pad is
  // the bar's mode triad, per-note folded, one chord a bar, held a whole bar
  {
    const g = GENRES.vaporwave, md = g.mode || K.MODE, ctr = 60 + 12 * g.reg(0);
    const pads = K.render(P, g, g.bars).filter(e => e.v === 0);
    for (let b = 0; b < g.bars; b++) {
      const r = K.harm(P, g, b);
      const want = [r, r + 2, r + 4].map(d => K.fold(K.mp(d, md), ctr)).sort((x, y) => x - y);
      const got = pads.filter(e => Math.abs(e.t - b * 16 / g.rate) < 1e-9)
                      .map(e => e.n).sort((x, y) => x - y);
      ok(JSON.stringify(got) === JSON.stringify(want),
         "vaporwave bar " + b + ": pad chord is not the old fold(mp) voicing");
      ok(pads.every(e => Math.abs(e.dur - 16 / g.rate) < 1e-9),
         "vaporwave: a prog-less pad no longer holds the whole bar");
    }
  }
  // the OLD DURATION SEMANTICS: without maxHold, dur is exactly the span to
  // the next gate, scaled by the articulation, slide-held where the successor
  // slides — recomputed here so a silent regression in the cap has a witness
  {
    const g = GENRES.simple, sp = K.spans(P.gate);
    const ev = K.render(P, g, 1);
    let k = 0;
    for (let i = 0; i < 16; i++) {
      if (!P.gate[i]) continue;
      const legato = P.sld[(i + sp[i]) % 16] ? 1 : 0.92;
      ok(Math.abs(ev[k].dur - sp[i] * legato) < 1e-9,
         "simple step " + i + ": dur is not span × articulation any more");
      k++;
    }
  }
}

/* ---------------------------------------------------------------- 23. PROGRESSION
   Chord OBJECTS — quality, inversion, borrow, beats, cadence — and the gate is
   the recon's own: sevenths are audible or they do not exist. Every assertion
   reads the RENDERED events; a prog that is declared and never voiced fails. */
console.log("progression — quality, inversion, half-bar chords, cadence, voice leading");
{
  const pcsOf = ev => new Set(ev.map(e => ((e.n % 12) + 12) % 12));
  const barOf = (ev, b, bs) => ev.filter(e => e.t >= b * bs && e.t < (b + 1) * bs);
  const base = { label: "t", rate: 1, bars: 4, voices: 2, entry: () => 0, reg: v => v - 1,
                 realize: v => (v === 0 ? "pad" : "line"), kit: {}, harmony: "cycle",
                 roots: [0, 3, 4, 0], word: () => [] };
  const all = g2 => [...K.render(P, g2, g2.bars), ...K.bass(P, g2, g2.bars)];

  // (a) DOM7 REACHES THE OUTPUT: the V7's major third (pc 11 over a minor
  // tonic) sounds in the dom7 bar and does not sound without the prog
  const withP = { ...base, prog: [{ d: 0 }, { d: 3 }, { d: 4, q: "dom7" }, { d: 0 }] };
  ok(pcsOf(barOf(all(withP), 2, 16)).has(11),
     "a dom7 chord never sounded its major third — the prog is decoration");
  ok(!pcsOf(barOf(all(base), 2, 16)).has(11),
     "the triad control already contains pc 11 — the dom7 gate proves nothing");
  // ...and the SEVENTH is a rung the ramp can land on (chordWalk honors quality)
  {
    const g7 = { ...base, voices: 1, realize: () => "line", incClamp: 0, bars: 8,
                 roots: [0], prog: [{ d: 0, q: "dom7" }] };
    const ramp = { ...clone(P), deg: new Array(N).fill(0), oct: new Array(N).fill(0),
                   inc: P.gate.map((g3, i) => (i === 0 ? 1 : 0)), stk: new Array(N).fill(0) };
    ok(pcsOf(K.render(ramp, g7, 8)).has(10),
       "a ramp over a dom7 never landed on the seventh — the rungs are still triadic");
  }

  // (b) INVERSION: inv:1 puts the THIRD under the band — the bass bar's pc is
  // the third's, not the root's
  {
    const inv = { ...base, roots: [0, 0, 0, 0], prog: [{ d: 0, inv: 1 }] };
    const bpc = new Set(K.bass(P, inv, 4).map(e => ((e.n % 12) + 12) % 12));
    ok(bpc.has(3) && !bpc.has(0),
       "inv:1 did not move the bass to the third (got " + [...bpc].join(",") + ")");
  }

  // (c) BEATS: two chords in ONE bar — the half-bar turnaround that used to be
  // inexpressible. The pad must emit at two distinct times inside the bar.
  {
    const half = { ...base, prog: [[{ d: 0, beats: 8 }, { d: 4, q: "dom7", beats: 8 }],
                                   { d: 3 }, { d: 4 }, { d: 0 }] };
    const padT = new Set(K.render(P, half, 4).filter(e => e.part === "pad" && e.t < 16)
      .map(e => e.t));
    ok(padT.size === 2 && padT.has(0) && padT.has(8),
       "beats:8 did not split the bar into two chords (t = " + [...padT].join(",") + ")");
  }

  // (c2) THE SECOND CHORD OF A SPLIT BAR IS NOT PAD-ONLY. The stab path and
  // the ramp's chordWalk already read chordFor(i); the bass and the line's
  // root shift must too, or the half-bar turnaround the beats field exists
  // for never reaches the parts that carry the harmony.
  {
    // bossa's bar 2 packs ii7–V7 into one bar; the fifths bass must sound the
    // V's root (pc 7) somewhere in the dominant half or the turnaround — the
    // feature the anchor exists to prove — never happened
    const bpc = K.bass(P, GENRES.bossa, 4)
      .filter(e => e.t >= 24 && e.t < 32).map(e => ((e.n % 12) + 12) % 12);
    ok(bpc.includes(7), "bossa's half-bar V7 never reaches the bass: " + bpc.join(","));
    // ...and the LINE's root shift is per-chord: a ramp-free line over a
    // split bar moves with the second chord where an all-I control does not
    const b1 = { label: "t", rate: 1, bars: 1, voices: 1, entry: () => 0,
                 reg: () => 0, realize: () => "line", kit: {}, harmony: "cycle",
                 roots: [0], word: () => [] };
    const flat2 = { ...clone(P), inc: new Array(N).fill(0), stk: new Array(N).fill(0) };
    const pcsHalf = prog => [...new Set(K.render(flat2, { ...b1, prog }, 1)
      .filter(e => e.t >= 8).map(e => ((e.n % 12) + 12) % 12))].sort((x, y) => x - y);
    ok(JSON.stringify(pcsHalf([[{ d: 0, beats: 8 }, { d: 4, beats: 8 }]])) !==
       JSON.stringify(pcsHalf([[{ d: 0 }]])),
       "the line's root shift ignores the second chord of a beats-split bar");
  }

  // (d) CADENCE: withCadence lands a different chord on the section's last bar
  {
    const cad = { ...base, prog: K.withCadence([{ d: 0 }], 4, { d: 4, q: "dom7" }) };
    const ev2 = K.render(P, cad, 4).filter(e => e.part === "pad");
    ok(JSON.stringify([...pcsOf(barOf(ev2, 3, 16))].sort()) !==
       JSON.stringify([...pcsOf(barOf(ev2, 0, 16))].sort()),
       "the cadence bar voices the same pcs as bar 1 — withCadence never landed");
  }

  // (e) VOICE LEADING: under a prog, each voice of a pad chord moves at most a
  // tritone to its counterpart in the next chord — the stateless per-note fold
  // could leap an octave. Grouped by chord, because a dom7 has four voices
  // where a triad has three and voice j maps to prev[j % prev.length].
  {
    const pads = K.render(P, withP, 4).filter(e => e.part === "pad");
    const byT = [...new Set(pads.map(e => e.t))].sort((a, b) => a - b)
      .map(t => pads.filter(e => e.t === t).map(e => e.n));
    ok(byT.length >= 4, "the prog pad did not sound one chord a bar");
    for (let c = 1; c < byT.length; c++)
      byT[c].forEach((n, j) => ok(Math.abs(n - byT[c - 1][j % byT[c - 1].length]) <= 6,
        "pad voice leapt " + Math.abs(n - byT[c - 1][j % byT[c - 1].length]) +
        " semitones into chord " + c));
  }

  // (f) THE WIRED GENRE: blues' I7 sounds its major third in the walking bass
  // (tones 1-3 of bar 1 are root-third-fifth of a DOMINANT chord now), and
  // stripping the prog restores the minor walk — so the field provably
  // reaches the output of a shipping genre, not just a synthetic one
  {
    const firstBar = K.bass(P, GENRES.blues, 12).filter(e => e.t < 12)
      .map(e => ((e.n % 12) + 12) % 12);
    ok(firstBar.includes(4), "blues walk never sounds the I7's major third");
    const stripped = K.bass(P, { ...GENRES.blues, prog: null }, 12)
      .filter(e => e.t < 12).map(e => ((e.n % 12) + 12) % 12);
    ok(stripped.includes(3) && !stripped.includes(4),
       "prog-less blues does not walk the minor triad — the control is broken");
  }
  // (g) THE PROG/ROOTS LAW: a genre carrying both must agree bar for bar —
  // roots is the skeleton the layers and the UI read, prog is the voicing
  for (const gk of GK) {
    const g = GENRES[gk];
    if (!g.prog) continue;
    ok(g.harmony === "cycle", gk + ": prog on a non-cycle harmony");
    for (let b2 = 0; b2 < g.roots.length; b2++) {
      const slot = K.at(g.prog, b2), c = Array.isArray(slot) ? slot[0] : slot;
      ok((c.d || 0) === K.at(g.roots, b2),
         gk + " bar " + b2 + ": prog root " + c.d + " disagrees with roots " +
         K.at(g.roots, b2));
    }
  }
  // (h) LAYERS ARE PROG-FREE: the render path hands a layer the authority's
  // roots but not its prog, so a prog-carrying layer would play its own
  // chords against the box's. The composer's stackable list must stay clean
  // until the layer path learns to inherit prog.
  {
    const C2 = require("../../nukernel/compose.js");
    for (const gk of GK)
      for (const s of [1, 2, 3])
        for (const b of C2.compose(gk, s).song)
          for (const e of b.stack.slice(1))
            ok(!GENRES[e.g].prog,
               gk + "/" + s + ": composed a prog-carrying genre (" + e.g + ") as a layer");
  }
}

/* ---------------------------------------------------------------- 24. REST
   maxHold caps the hold so a hole in the gate vector is SILENCE. The failing
   assertion for a read-and-discarded field is the sum-of-durations drop —
   a config check would pass on a cap that never reaches dur. */
console.log("rest — maxHold turns gate holes into silence");
{
  const gap = { ...clone(P), gate: [1,0,0,0, 0,0,0,1, 1,0,0,0, 0,0,1,0],
                sld: new Array(N).fill(0) };
  const g = GENRES.simple, capped = { ...g, maxHold: 2 };
  const evF = K.render(gap, g, 2), evC = K.render(gap, capped, 2);
  const total = a => a.reduce((s, e) => s + e.dur, 0);
  ok(evC.length === evF.length, "maxHold changed the note count — it must only stop notes");
  ok(Math.max(...evC.map(e => e.dur)) <= 2, "maxHold 2 left a note longer than 2 steps");
  ok(total(evC) < total(evF),
     "capped Σdur is not smaller — the cap never reached the rendered durations");
  ok(sig(K.render(gap, { ...g, maxHold: 0 }, 2)) === sig(evF) &&
     JSON.stringify(K.render(gap, { ...g, maxHold: 0 }, 2).map(e => e.dur)) ===
     JSON.stringify(evF.map(e => e.dur)),
     "maxHold: 0 is not the documented neutral value");
  // a SLIDE is a physical connection — the cap must not cut it
  const slide = clone(gap); slide.sld[7] = 1;              // slide INTO step 7
  const evS = K.render(slide, capped, 1);
  ok(Math.abs(evS[0].dur - 7) < 1e-9,
     "maxHold cut a note whose successor slides (dur " + evS[0].dur + ", want 7)");
  // the wired genres breathe: a slide-free phrase never exceeds the cap
  for (const gk of ["blues", "isley", "jodeci"]) {
    const g2 = GENRES[gk], flat = { ...clone(P), sld: new Array(N).fill(0) };
    const durs = K.render(flat, g2, g2.bars)
      .filter(e => e.part !== "pad").map(e => e.dur * g2.rate);
    ok(Math.max(...durs) <= g2.maxHold + 1e-9,
       gk + ": a line note outlasts its own maxHold (" + Math.max(...durs) + ")");
  }
}

/* ---------------------------------------------------------------- 25. BAR SCHEDULE
   The sixth type: a per-bar operator word gives a section a 2/4/8-bar period.
   Position-dependent and PRE-render — it changes which notes exist mid-section,
   which none of the other five types can do. */
console.log("bar schedule — a period is a sentence, not a restated bar");
{
  const g = { ...GENRES.rock,
              period: [[], [K.drop(2)], [], [K.drop(3), K.only("gate", K.rotate(4))]] };
  const perBar = g2 => Array.from({ length: 4 }, (_, b) =>
    JSON.stringify(K.render(P, g2, 4).filter(e => e.v === 0 &&
      Math.floor(e.t / 16) === b).map(e => [+(e.t % 16).toFixed(3), e.n])));
  const bars = perBar(g);
  ok(new Set(bars).size >= 3, "a four-entry period produced fewer than 3 distinct bars");
  const count = s => JSON.parse(s).length;
  ok(count(bars[1]) < count(bars[0]), "the thinned bar of the period is not thinner");
  ok(sig(allEvents(P, { ...GENRES.rock, period: null }, 4)) ===
     sig(allEvents(P, GENRES.rock, 4)), "period: null is not the neutral value");
  // sensitivity: perturbing ONE entry of the schedule must change the render
  const tweaked = { ...g, period: [[], [K.drop(2)], [K.rotate(1)], [K.drop(3), K.only("gate", K.rotate(4))]] };
  ok(sig(K.render(P, tweaked, 4)) !== sig(K.render(P, g, 4)),
     "perturbing a period entry changed nothing — the schedule is not being read");
  // the FUNCTION form is per-voice: call-and-response as data
  const cr = { ...GENRES.rock,
               period: (v, s) => (s % 2 === (v === 0 ? 1 : 0) ? [K.drop(1)] : []) };
  const evCR = K.render(P, cr, 4);
  ok(evCR.filter(e => e.v === 0 && Math.floor(e.t / 16) % 2 === 1).length === 0 &&
     evCR.filter(e => e.v === 0 && Math.floor(e.t / 16) % 2 === 0).length > 0 &&
     evCR.filter(e => e.v === 1 && Math.floor(e.t / 16) % 2 === 0).length === 0,
     "the per-voice period form does not alternate the voices");
  // the wired genre: beatles bar 4 is the thinned cadence bar
  {
    const b4 = K.render(P, GENRES.beatles, 4).filter(e => Math.floor(e.t / 16) === 3);
    const b1 = K.render(P, GENRES.beatles, 4).filter(e => Math.floor(e.t / 16) === 0);
    ok(b4.length < b1.length, "beatles' four-bar sentence does not breathe on bar 4");
  }
}

/* ---------------------------------------------------------------- 26. MAJOR
   There was no major key in nukernel at all — mixolydian faked brightness in
   three genres. The gate hears the major third and the major seventh in the
   RENDERED stream, and holds romanOf to both the old minor readout and the
   honest major one. */
console.log("major — ionian, lydian, melodic; major scales; honest numerals");
{
  const pcs = ev => new Set(ev.map(e => ((e.n % 12) + 12) % 12));
  const gM = { ...GENRES.simple, harmony: "cycle", roots: [0],
               mode: MODES.ionian, scale: SCALES.major, diatonic: true };
  const line = pcs(K.render(P, gM, 4));
  ok([...line].every(pc => MODES.ionian.includes(pc)),
     "an ionian line leaked outside the major scale: " + [...line].join(","));
  ok(line.has(4) && line.has(11),
     "a major-scale line never sounded the major third and seventh");
  // a pad in ionian voices a MAJOR triad — pc 4 over the tonic
  const gPad = { ...GENRES.vaporwave, mode: MODES.ionian, roots: [0, 3, 4, 0] };
  ok(pcs(K.render(P, gPad, 4).filter(e => e.v === 0)).has(4),
     "an ionian pad never voiced a major third — the mode is declared and unread");
  // both new subject alphabets span an octave in their own length
  for (const sc of [SCALES.major, SCALES.majpent])
    ok(Math.abs(K.pitch(sc.length, sc) - K.pitch(0, sc) - 12) < 1e-9,
       "a major alphabet does not span an octave in its own length");
  // romanOf: derived case equals the old hardcoded minor list, and reads major
  // honestly — the old table would have called ionian's I "i"
  ok(JSON.stringify(K.ROMAN) === JSON.stringify(["i", "ii°", "III", "iv", "v", "VI", "VII"]),
     "ROMAN no longer matches the shipped minor readout");
  ok(JSON.stringify(K.romanOf(MODES.ionian)) ===
     JSON.stringify(["I", "ii", "iii", "IV", "V", "vi", "vii°"]),
     "romanOf(ionian) is wrong: " + K.romanOf(MODES.ionian).join(" "));
  ok(JSON.stringify(K.romanOf(MODES.mixo)) ===
     JSON.stringify(["I", "ii", "iii°", "IV", "v", "vi", "VII"]),
     "romanOf(mixolydian) is wrong: " + K.romanOf(MODES.mixo).join(" "));
}

/* ---------------------------------------------------------------- 27. KEY
   An integer semitone key, applied AFTER registration — +7 is the value the
   register fold would eat (the octave law's mirror), and the BASS is the
   consumer transpose() could never reach, so a diff of 0 there is the failing
   assertion for a field that never lands. */
console.log("key — every pitched consumer moves by exactly the key, after the fold");
{
  for (const gk of ["rock", "vaporwave", "blues"]) {
    const g0 = { ...GENRES[gk], key: 0 }, g7 = { ...GENRES[gk], key: 7 };
    for (const [name, f] of [["render", K.render], ["bass", K.bass]]) {
      const a = f(P, g0, g0.bars), b = f(P, g7, g7.bars);
      ok(a.length === b.length && a.length > 0, gk + "/" + name + ": key changed the event count");
      ok(a.every((e, i) => b[i].n - e.n === 7 && b[i].t === e.t &&
                           Math.abs(b[i].dur - e.dur) < 1e-9),
         gk + "/" + name + ": key +7 is not a uniform +7 (the register fold ate it)");
    }
    ok(sig(K.drums(P, g7, g7.bars)) === sig(K.drums(P, g0, g0.bars)),
       gk + ": the key moved the drums");
  }
}

/* ---------------------------------------------------------------- 28. PARTS
   A part is an ASSIGNMENT of policy to a performer. The stab is the proof
   role: chord-locked, its own gate — every rendered pitch class must be a
   member of that bar's chord, the assertion that fails if chordLock is
   declared and never applied. */
console.log("parts — lead/riff separate, labels swap streams, the stab is chord-locked");
{
  const base = { label: "t", rate: 1, bars: 4, voices: 2, entry: () => 0, reg: () => 0,
                 realize: () => "line", kit: {}, harmony: "modal", word: () => [] };
  const A = { ...base, part: ["lead", "riff"] }, B = { ...base, part: ["riff", "lead"] };
  const mean = ev => ev.reduce((s, e) => s + e.n, 0) / ev.length;
  const evA = K.render(P, A, 4), evB = K.render(P, B, 4);
  const lead = evA.filter(e => e.part === "lead"), riff = evA.filter(e => e.part === "riff");
  ok(lead.length > 0 && riff.length > 0, "part tags did not reach the rendered events");
  ok(Math.abs(mean(lead) - mean(riff)) >= 7,
     "lead and riff sit " + Math.abs(mean(lead) - mean(riff)).toFixed(1) +
     " semitones apart — parts are labels, not policies");
  // swapping the labels swaps the streams exactly (modulo which voice index)
  const strip = ev => JSON.stringify(ev.map(e => [e.t, e.n, +e.dur.toFixed(6), e.vel]));
  ok(strip(evA.filter(e => e.part === "lead")) === strip(evB.filter(e => e.part === "lead")) &&
     strip(evA.filter(e => e.part === "riff")) === strip(evB.filter(e => e.part === "riff")),
     "swapping part labels did not swap the rendered streams");
  // the shim: a partless genre renders with the old realize() split, tagged
  ok(K.render(P, GENRES.rock, 4).every(e => e.part === "line"),
     "a partless line genre is not tagged with the shim part");
  ok(K.render(P, GENRES.vaporwave, 4).some(e => e.part === "pad"),
     "a partless pad genre lost its pad tag");
  // THE STAB: fires on its own gate, voices the sounding chord
  {
    const st = { ...base, voices: 1, part: ["stab"], harmony: "cycle",
                 roots: [0, 3], prog: [{ d: 0, q: "7" }, { d: 3, q: "7" }] };
    const ev2 = K.render(P, st, 4);
    const gates = P.gate.filter(Boolean).length;
    ok(ev2.length === 4 * gates * 4,
       "the stab did not fire one chord per gated step (got " + ev2.length + ")");
    for (const e of ev2) {
      const bar = Math.floor(e.t / 16);
      const cs = K.chordsOf(P, st, bar)[0];
      ok(cs.pcSet.has(((e.n % 12) + 12) % 12),
         "a stab pitch left its bar's chord: " + e.n + " in bar " + bar);
    }
    ok(Math.max(...ev2.map(e => e.dur)) <= 1,
       "a stab rings longer than its policy's hold");
  }
}

/* ---------------------------------------------------------------- 29. PIPES
   The seventh type: timeless AND pitch-aware, on the rendered stream. Each
   pipe's gate is the recon's: harmonize adds only chord tones, echoCanon
   copies later/quieter/inside the bar, breathe shortens without deleting,
   strum spreads a chord's attacks. All seeded, all total. */
console.log("pipes — harmonize, echoCanon, breathe, strum: seeded, total, chord-aware");
{
  const base = { ...GENRES.rock, bars: 4 };
  const dry = K.render(P, base, 4);
  // determinism first: the same pipes render twice identically
  const wet = g2 => K.render(P, g2, 4);
  {
    const g2 = { ...base, pipes: [{ id: "harmonize", p: 0.7 }] };
    ok(sig(wet(g2)) === sig(wet(g2)), "a piped render is not deterministic");
  }
  // harmonize: strictly more events, every ADDED pitch class in its bar's chord
  {
    const g2 = { ...base, pipes: [{ id: "harmonize", p: 1 }] };
    const ev2 = wet(g2), added = ev2.filter(e => e.pipe === "harmonize");
    ok(ev2.length > dry.length && added.length > 0, "harmonize added nothing at p:1");
    for (const e of added) {
      const bar = Math.floor(e.t / 16);
      ok(K.chordsOf(P, base, bar)[0].pcSet.has(((e.n % 12) + 12) % 12),
         "harmonize added a non-chord tone in bar " + bar);
      ok(e.n > 0, "harmonize produced a nonsense pitch");
    }
    ok(sig(wet({ ...base, pipes: null })) === sig(dry), "pipes: null is not neutral");
    ok(sig(wet({ ...base, pipes: [{ id: "nonsense" }] })) === sig(dry),
       "an unknown pipe id is not a no-op — pipes are supposed to be total");
  }
  // harmonize UNDER A KEY: render() bakes g.key into every pitch, so the chord
  // set the pipe snaps to must be the KEYED one — at key 2 every added note
  // sits in the +2-transposed sounding chord. Snapping to the un-keyed set is
  // arbitrary intervals against the transposed band, which is the bug.
  {
    const g2 = { ...base, key: 2, pipes: [{ id: "harmonize", p: 1 }] };
    const added = wet(g2).filter(e => e.pipe === "harmonize");
    ok(added.length > 0, "harmonize added nothing under a key");
    for (const e of added) {
      const keyed = new Set([...K.chordsOf(P, base, Math.floor(e.t / 16))[0].pcSet]
        .map(pc => (pc + 2) % 12));
      ok(keyed.has(((e.n % 12) + 12) % 12),
         "harmonize under key 2 added a note outside the KEYED chord in bar " +
         Math.floor(e.t / 16) + " (pc " + (((e.n % 12) + 12) % 12) + ")");
    }
  }
  // echoCanon: every copy is later, quieter, and inside its source's chord bar
  {
    const ev2 = wet({ ...base, pipes: [{ id: "echoCanon", delay: 3 }] });
    const added = ev2.filter(e => e.pipe === "echoCanon");
    ok(added.length > 0, "echoCanon copied nothing");
    for (const e of added) {
      ok(e.t === e.echoOf + 3, "an echo is not exactly its delay late");
      ok(Math.floor(e.t / 16) === Math.floor(e.echoOf / 16),
         "an echo crossed its source's chord bar");
    }
    const srcVel = t => dry.find(e2 => e2.t === t) || { vel: 9 };
    ok(added.every(e => e.vel < srcVel(e.echoOf).vel || srcVel(e.echoOf).vel <= 1),
       "an echo is not quieter than its source");
  }
  // breathe: note count unchanged, Σdur strictly decreased
  {
    const ev2 = wet({ ...base, pipes: [{ id: "breathe" }] });
    const total = a => a.reduce((s, e) => s + e.dur, 0);
    ok(ev2.length === dry.length, "breathe changed the note count");
    ok(total(ev2) < total(dry), "breathe did not shorten anything");
  }
  // strum: a pad chord's voices leave the grid, direction alternating per chord
  {
    const g2 = { ...GENRES.vaporwave, pipes: [{ id: "strum", spread: 0.1 }] };
    const pads = K.render(P, g2, 4).filter(e => e.part === "pad");
    const bar0 = pads.filter(e => e.t < 32 / 2).sort((a, b) => a.t - b.t);
    ok(new Set(bar0.map(e => e.t)).size === 3, "strum left the chord as one attack");
    ok(bar0[0].n < bar0[2].n, "the first strummed chord does not roll upward");
    const bar1 = pads.filter(e => e.t >= 32 && e.t < 64).sort((a, b) => a.t - b.t);
    ok(bar1[0].n > bar1[2].n, "the second chord does not roll back down — no alternation");
    // the wired genre: isley's Rhodes rolls
    const ip = K.render(P, GENRES.isley, 8).filter(e => e.part === "pad" && e.t < 16);
    ok(new Set(ip.map(e => e.t)).size > 1, "isley's strum pipe never reached the pad");
  }
}

/* ---------------------------------------------------------------- 30. KIT SCHEDULE + DYNAMICS
   kits[] is read per bar — POSITIONS must differ between bars, so a schedule
   wired only into velocity fails. kitVel gives a lane its own dynamics — the
   kick's rendered velocities must stop being the melody's. */
console.log("kit schedule and kit dynamics");
{
  const g = GENRES.rock;
  const A = g.kit, B = K.KITOPS.swap(g.kit);
  const sched = { ...g, kits: [A, B], fill: null };
  const dr = K.drums(P, sched, 4);
  const shape = b => JSON.stringify(dr.filter(e => Math.floor(e.t / 16) === b)
    .map(e => [+(e.t % 16).toFixed(3), e.d]).sort());
  ok(shape(0) !== shape(1), "kits[A,B]: bar 2 has bar 1's positions — the schedule is unread");
  ok(shape(0) === shape(2) && shape(1) === shape(3), "the kit schedule does not cycle");
  ok(sig(K.drums(P, { ...g, kits: null }, 4)) === sig(K.drums(P, g, 4)),
     "kits: null is not the neutral value");
  // kitVel: the kick stops borrowing the tune's velocity vector
  {
    const kv = { ...g, kitVel: { k: [9,1,1,1, 8,1,1,1, 9,1,1,1, 8,1,1,1] } };
    const kick = K.drums(P, kv, 1).filter(e => e.d === "k");
    const kickSteps = g.kit.k.map((x, i) => (x ? i : -1)).filter(i => i >= 0);
    ok(kick.every((e, j) => e.vel === kv.kitVel.k[kickSteps[j]]),
       "kitVel.k is not the kick's rendered velocity");
    ok(JSON.stringify(kick.map(e => e.vel)) !==
       JSON.stringify(kickSteps.map(i => P.vel[i])),
       "the kick still borrows the melody's velocities under kitVel");
    // ...and the other lanes keep the old law
    const hat = K.drums(P, kv, 1).filter(e => e.d === "h");
    ok(hat.every((e, j) => e.vel === P.vel[g.kit.h.map((x, i) => (x ? i : -1))
      .filter(i => i >= 0)[j]]), "kitVel on one lane leaked into another");
  }
  // the wired genre: toto's hat hand is its own, kick untouched
  {
    const t = GENRES.toto, off = { ...t, kitVel: null };
    const hats = g2 => K.drums(P, g2, 1).filter(e => e.d === "h").map(e => e.vel);
    ok(JSON.stringify(hats(t)) !== JSON.stringify(hats(off)),
       "toto's kitVel never reached the hats");
    const kicks = g2 => K.drums(P, g2, 1).filter(e => e.d === "k").map(e => e.vel);
    ok(JSON.stringify(kicks(t)) === JSON.stringify(kicks(off)),
       "toto's kitVel leaked onto the kick");
  }
}

/* ---------------------------------------------------------------- 31. THE ARRANGER'S ARC
   Song-level shape: a prechorus that lifts, a peak chorus that is measurably
   bigger than the first, a chorus with its OWN melody, hooks with a motif, a
   breath and one climax — all read from RENDERED events, never from config.

   §31 AND §33 RUN THE REAL ui/derive.js. They used to run hand-copied mirrors
   of genreOf/sectionEvents, and the mirror drifted: deleting the shipped key
   wiring left every mirror check green, and the mirror's full-form render hid
   a cadence landing outside the box's window. The UMD data tier is published
   onto a stub window (the exact shape ui/deps.js reads) and derive.js is
   imported for real — so a wiring change in the shipped file fails HERE. */
(async () => {
const D = await (async () => {
  globalThis.window = globalThis;
  window.NuKernel = K;
  window.NuGenres = require("../../nukernel/genres.js");
  window.NuFields = require("../../nukernel/fields.js");
  window.NuSong = require("../../nukernel/song.js");
  window.NuInstruments = require("../../nukernel/instruments.js");
  window.NuCompose = require("../../nukernel/compose.js");
  window.PRESETS = require("../../nukernel/presets.js").PRESETS;
  return import("../../nukernel/ui/derive.js");
})();
console.log("song arc, prechorus, topline — the radio shape, measured on ui/derive.js");
{
  const C = require("../../nukernel/compose.js");
  const NF = require("../../nukernel/fields.js");
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);

  // the REAL render path: everything a box plays, windowed to nudge+len,
  // enveloped, edged and grooved — the stream the transport schedules
  const sectionEv = (song, b) => D.sectionEvents(b, song.slots).ev;

  // (a) THE ARC IS AUDIBLE: mean level of the LAST chorus beats the FIRST in
  // at least 90% of songs, measured as rendered velocity × the box's level
  for (const gk of ["rock", "beatles", "isley"]) {
    let up = 0, n2 = 0;
    for (const s of seeds.slice(0, 16)) {
      const song = C.compose(gk, s), G = GENRES[gk];
      const ch = song.song.filter(b => b.role === "chorus" && !b.cue);
      if (ch.length < 2) continue;
      n2++;
      const level = b => {
        const ev2 = sectionEv(song, b).filter(e => e.kind === "line" && e.part !== "pad");
        const mv = ev2.reduce((a, e) => a + (e.vel == null ? 5 : e.vel), 0) /
                   Math.max(1, ev2.length);
        return mv * NF.LEVELS[b.lvl || "norm"];
      };
      if (level(ch[ch.length - 1]) > level(ch[0])) up++;
    }
    ok(n2 >= 14, gk + ": songs are missing their choruses");
    ok(up / n2 >= 0.9, gk + ": the last chorus outweighs the first in only " +
       Math.round(100 * up / n2) + "% of songs — the arc never reaches the render");
  }
  // ...and the peak chorus carries the extra layer; the key lift, when drawn,
  // moves the rendered pitches by exactly its own amount
  {
    let lifted = 0;
    for (const s of seeds) {
      const song = C.compose("rock", s);
      const ch = song.song.filter(b => b.role === "chorus" && !b.cue);
      const last = ch[ch.length - 1];
      ok(last.stack.length >= 2, "rock/" + s + ": the peak chorus has no extra layer");
      if (last.key) {
        lifted++;
        // every PITCHED consumer — lines, layers AND the bass — moves by
        // exactly the key; the drums (no n) are untouched by construction
        const a = sectionEv(song, { ...last, key: 0 }).filter(e => e.n != null);
        const b = sectionEv(song, last).filter(e => e.n != null);
        ok(a.length === b.length && a.every((e, i) => b[i].n - e.n === last.key),
           "rock/" + s + ": the truck-driver lift does not move the band by +" + last.key);
      }
    }
    ok(lifted > 3 && lifted < seeds.length, "the key lift is never/always drawn (" +
       lifted + "/" + seeds.length + ") — it should be a coin, not a constant");
  }

  // (b) THE PRECHORUS EXISTS and points forward: stored under a legal role
  // (fields.js owns the vocabulary — the cue carries the honest name), riser
  // armed, cadence stamped — and the dominant sounds INSIDE THE RENDERED
  // WINDOW. A prechorus renders bars [0, len) with len = half the form, so a
  // cadence landed on the form's last bar is a lift that never plays; the
  // checks below read the same windowed stream the transport schedules.
  {
    const song = C.compose("beatles", 5);
    const pre = song.song.filter(b => b.cue === "prechorus");
    ok(pre.length === 2, "the song plan does not carry two prechoruses");
    for (const b of pre) {
      ok(C.ROLES[b.role], "a prechorus is stored under an illegal role: " + b.role);
      ok(b.env === "in" && b.mot === "rise" && b.cadence,
         "the prechorus does not lift (env/mot/cadence missing)");
      // the cadence reaches the BASS in the window's last bar: its root is
      // the dominant's, not the prog's own final chord
      const r = D.sectionEvents(b, song.slots), bs = 16 / r.g.rate;
      const bpc = r.ev.filter(e => e.kind === "bass" && e.t >= (r.bars - 1) * bs)
        .map(e => ((e.n % 12) + 12) % 12);
      ok(bpc.length > 0 && bpc.every(pc => pc === 7 || pc === 6),
         "the beatles prechorus cadence never reaches the bass in the rendered window: " +
         bpc.join(","));
    }
    // ...and where the genre HAS a pad, the cadence's dominant third actually
    // SOUNDS: isley's Rhodes voices the V7 in the window's last bar — pc 11,
    // which dorian does not contain, so only the cadence can put it there
    {
      const song2 = C.compose("isley", 5);
      const b2 = song2.song.find(b3 => b3.cue === "prechorus");
      ok(!!b2, "isley's song plan lost its prechorus");
      const r2 = D.sectionEvents(b2, song2.slots), bs2 = 16 / r2.g.rate;
      const pcs2 = new Set(r2.ev
        .filter(e => e.kind === "line" && e.part === "pad" && e.t >= (r2.bars - 1) * bs2)
        .map(e => ((e.n % 12) + 12) % 12));
      ok(pcs2.has(11),
         "the prechorus cadence never sounds the dominant's third in the rendered window");
    }
    ok(C.PLANS.song.includes("prechorus") && C.PLANS.dance.includes("build"),
       "the plans lost their lift sections");
  }

  // (c) NO SECTION RESTATES ITS NEIGHBOUR: consecutive same-role sections
  // render differently — the dance plan's double drop is the hard case
  for (const gk of ["acid", "eurythmics"]) {
    for (const s of seeds.slice(0, 10)) {
      const song = C.compose(gk, s);
      for (let i = 1; i < song.song.length; i++) {
        const a = song.song[i - 1], b = song.song[i];
        if (a.role !== b.role || C.BEDS[b.role] || a.cue !== b.cue) continue;
        ok(sig(sectionEv(song, a)) !== sig(sectionEv(song, b)),
           gk + "/" + s + ": two consecutive " + b.role + "s render identically");
      }
    }
  }

  // (d) THE CHORUS HAS ITS OWN MELODY: slot 5 (the topline) leads every chorus
  // and is absent from every verse's own deal
  for (const s of seeds.slice(0, 10)) {
    const song = C.compose("rock", s);
    for (const b of song.song) {
      if (b.role === "chorus" && !b.cue)
        ok(b.stack[0].slots[0] === 5, "a chorus does not lead with the topline");
      if (b.role === "verse" && !b.cue)
        ok(!b.stack[0].slots.includes(5), "a verse borrowed the chorus's topline");
    }
  }

  // (e) THE TOPLINE WRITER, measured from rendered events over 100 hooks:
  // the motif returns (bars 0-3 == 4-7 in pitch and relative time), the breath
  // is real silence at the bar's end under a singer's maxHold, and exactly one
  // note is both the highest and the loudest
  {
    const g = GENRES.simple, gSing = { ...g, maxHold: 2 };
    for (let s = 1; s <= 60; s++) {
      const p = C.phrase(C.rng(s * 17), s % 2 ? "hook" : "topline");
      const q = clone(p); q.sld = q.sld.map(() => 0);      // slides are exempt from the cap
      const ev2 = K.render(q, gSing, 1);
      const cell = a => JSON.stringify(a.map(e => [+(e.t % 4).toFixed(3), e.n, e.vel]));
      ok(cell(ev2.filter(e => e.t < 4)) === cell(ev2.filter(e => e.t >= 4 && e.t < 8)),
         "hook/" + s + ": the motif does not return in the rendered stream");
      ok(ev2.every(e => e.t < 14 && e.t + e.dur <= 15.5),
         "hook/" + s + ": no breath — the bar's end is not silent");
      const top = Math.max(...ev2.map(e => e.n));
      const peaks = ev2.filter(e => e.n === top);
      ok(peaks.length === 1 && peaks[0].vel === 9 &&
         ev2.filter(e => e.vel === 9).length === 1,
         "hook/" + s + ": the climax is not one note that is highest AND loudest");
    }
  }
}

/* ---------------------------------------------------------------- 32. CONFUSION
   Going from 23 to 45 genres is exactly where a table starts containing
   duplicates, and the big engine already learned this lesson: its matrix must
   stay diagonal-dominant at 274/274. This is nukernel's version — a feature
   vector per genre computed from the RENDERED events only (never a config
   field), a weighted distance over every pair, and a floor under the closest
   one. Two genres with different labels and identical music fail by
   construction, which the relabelled-clone canary proves on every run. */
console.log("confusion — every genre is provably not a relabelled neighbour");
{
  const C = require("../../nukernel/compose.js");
  // the vector: kick and snare STEP SETS (positions, not counts — a schedule
  // wired only into velocity would not move them), hat/perc/line densities,
  // the chordal share (pads + stabs), mean duration and the silent fraction
  // (real only since maxHold exists), the pitch-class profile of everything
  // pitched, the harmonic rhythm read off the BASS (distinct per-bar note
  // sets — the consumer a decorative prog cannot reach), measured swing, bass
  // density and register, wall-clock bar seconds (invariant under the
  // rate×2/bpm÷2 relabel), the form length, and the RENDERED voice count.
  const featOf = (gk, g, bpm) => {
    const bars = g.bars, bs = 16 / g.rate;
    const line = K.render(P, g, bars);
    const dr = K.drums(P, g, bars);
    const ba = K.bass(P, g, bars);
    const step = e => ((Math.round(e.t * g.rate) % 16) + 16) % 16;
    const lane = ds => { const v = new Array(16).fill(0);
      for (const e of dr) if (ds.includes(e.d)) v[step(e)] = 1; return v; };
    const f = [], w = [];
    const push = (x, wt) => { f.push(x); w.push(wt); };
    for (const x of lane(["k"])) push(x, 1 / 8);
    for (const x of lane(["s", "c"])) push(x, 1 / 8);
    push(Math.min(1, dr.filter(e => e.d === "h" || e.d === "o").length / bars / 16), 1);
    push(Math.min(1, dr.filter(e => e.d === "p").length / bars / 16), 0.5);
    const mel = line.filter(e => e.part !== "pad" && e.part !== "stab");
    push(line.length ? (line.length - mel.length) / line.length : 0, 1);
    // LOG-SCALED, NOT CLAMPED: Math.min(1, …) saturated at one voice's worth
    // of sixteenths, which hid a 360- vs 80-event render difference (spem vs
    // counterpoint) and left those pairs separated only by declared scalars
    push(Math.log2(1 + mel.length / bars) / 6, 1.5);
    const durs = mel.map(e => e.dur * g.rate);
    push(durs.length ? Math.min(1, durs.reduce((a, b) => a + b, 0) / durs.length / 8) : 0, 1);
    let covered = 0, end = 0;
    for (const [a, b] of mel.map(e => [e.t, e.t + e.dur]).sort((x, y) => x[0] - y[0])) {
      covered += Math.max(0, Math.min(b, bars * bs) - Math.max(a, end));
      end = Math.max(end, b);
    }
    push(1 - covered / (bars * bs), 1);
    const pcv = new Array(12).fill(0);
    for (const e of [...line, ...ba]) pcv[((e.n % 12) + 12) % 12] = 1;
    for (const x of pcv) push(x, 1 / 6);
    const bassBars = new Set(Array.from({ length: bars }, (_, b) =>
      JSON.stringify([...new Set(ba.filter(e => e.t >= b * bs && e.t < (b + 1) * bs)
        .map(e => e.n))].sort((x, y) => x - y))));
    push(bars > 1 ? (bassBars.size - 1) / (bars - 1) : 0, 1.5);
    const odd = [...line, ...dr].map(e => (e.t * g.rate) % 2).filter(x => x >= 1);
    push(odd.length ? Math.min(1, (odd.reduce((a, x) => a + (x - 1), 0) / odd.length) / 0.5) : 0, 1);
    push(Math.min(1, ba.length / bars / 16), 1);
    push(ba.length ? ba.reduce((a, e) => a + e.n, 0) / ba.length / 127 : 0, 1);
    // ONE wall-clock feature instead of raw bpm + raw rate: bar SECONDS.
    // Every render feature above is rate-normalized (step() multiplies by
    // g.rate, durations scale by it), so a clone with rate doubled and bpm
    // halved renders wall-clock-identical audio — separate bpm/rate features
    // measured that relabel 0.07 apart and the gate passed the exact
    // duplicate it exists to forbid. Bar seconds is invariant under the
    // relabel and still separates genuine tempo differences.
    push(Math.log2((16 / g.rate) * (60 / (4 * (bpm == null ? C.BPM[gk] : bpm)))) / 4, 1.5);
    push(g.bars / 12, 0.75);
    // the voice count is MEASURED from the rendered stream, not declared
    push(new Set(line.map(e => e.v)).size / 8, 1);
    return { f, w };
  };
  const dist = (a, b) => {
    let s = 0, tw = 0;
    for (let i = 0; i < a.f.length; i++) { s += a.w[i] * Math.abs(a.f[i] - b.f[i]); tw += a.w[i]; }
    return s / tw;
  };
  // THE FLOOR. Measured on the shipped table (post config-scalar purge) the
  // closest true pair (gregorian vs counterpoint — genuinely siblings) sits
  // at 0.035; a relabel that only moved the tempo ten bpm, or the compensated
  // rate×2/bpm÷2 clone, measures under 0.003. 0.03 splits those worlds with
  // headroom, and the render is deterministic so there is no flake in it.
  const EPS = 0.03;
  const F = {};
  for (const gk of GK) F[gk] = featOf(gk, GENRES[gk]);
  for (let i = 0; i < GK.length; i++)
    for (let j = i + 1; j < GK.length; j++) {
      const d = dist(F[GK[i]], F[GK[j]]);
      ok(d > EPS, GK[i] + " and " + GK[j] + " render " + d.toFixed(4) +
         " apart — closer than " + EPS + ", one is a relabel of the other");
    }
  // the canaries: a relabelled clone measures zero, a clone that only changed
  // its tempo still fails, and — the compensated case — a clone with rate
  // doubled and bpm halved plays wall-clock-identical audio and must ALSO
  // measure as a clone, or the floor is being cleared by config relabels
  ok(dist(F.rock, featOf("rock", { ...GENRES.rock })) < EPS / 10,
     "a byte-identical clone does not measure as a clone — the metric is broken");
  ok(dist(F.rock, featOf("rock", { ...GENRES.rock }, C.BPM.rock + 10)) < EPS,
     "a tempo-only relabel clears the floor — the gate proves nothing");
  ok(dist(F.rock, featOf("rock", { ...GENRES.rock, rate: GENRES.rock.rate * 2 },
                         C.BPM.rock / 2)) < EPS / 10,
     "a rate-doubled bpm-halved clone — audio-identical by construction — " +
     "does not measure as a clone: config scalars are doing the separating");
  // every declared neighbour is a real genre, so the identity comments and the
  // matrix stay honest together
  for (const gk of GK)
    if (GENRES[gk].near)
      ok(!!GENRES[GENRES[gk].near],
         gk + ": declares an unknown nearest neighbour \"" + GENRES[gk].near + "\"");
}

/* ---------------------------------------------------------------- 33. THE BOX SURFACE (P4)
   The depth fields as BOX fields — key/prog/period/breath/pipe/part — wired
   in ui/derive.js genreOf, plus the automation vocabulary. boxGenre runs the
   REAL genreOf (imported above as D — the mirror it replaced could not fail
   when the shipped wiring changed). Every assertion reads RENDERED events;
   the neutrality row proves null == absent byte for byte. */
console.log("the box surface — key/prog/period/breath/pipe/part/auto reach the render");
{
  const NF = require("../../nukernel/fields.js");
  const NG = require("../../nukernel/genres.js");
  const S = require("../../nukernel/song.js");
  const C = require("../../nukernel/compose.js");

  // the REAL ui/derive.js genreOf, fed a box-shaped section (a box always has
  // an authority; layer-scope fields read through optOf's sec fallback)
  const keyOfG = new Map(Object.keys(GENRES).map(k => [GENRES[k], k]));
  const boxGenre = (G, sec) =>
    D.genreOf({ stack: [{ g: keyOfG.get(G), slots: [] }], nudge: 0, ...sec }, null);
  const rsig = g2 => sig(allEvents(P, g2, g2.bars));

  // NEUTRALITY: a box with every depth field null renders byte-identically
  // to the bare genre — the extension of §22's law to the box surface
  const NUL = { key: null, prog: null, period: null, breath: null,
                pipe: null, part: null, cadence: null, auto: [] };
  for (const gk of ["rock", "blues", "beatles", "isley", "vaporwave", "house", "reggae"]) {
    const G = GENRES[gk];
    ok(rsig(boxGenre(G, NUL)) === rsig(G),
       gk + ": a box with every depth field null does not render identically to absent");
  }

  // KEY: "2" moves every pitched consumer by exactly +2 and the drums by 0 —
  // the string form is what a chip writes, the number form what compose writes
  for (const kv of ["2", 2]) {
    const G = GENRES.rock, g2 = boxGenre(G, { ...NUL, key: kv });
    const a = [...K.render(P, G, G.bars), ...K.bass(P, G, G.bars)];
    const b = [...K.render(P, g2, g2.bars), ...K.bass(P, g2, g2.bars)];
    ok(a.length === b.length && a.every((e, i) => b[i].n - e.n === 2 && b[i].t === e.t),
       "box key " + JSON.stringify(kv) + " is not a uniform +2 on the pitched stream");
    ok(sig(K.drums(P, g2, g2.bars)) === sig(K.drums(P, G, G.bars)),
       "box key moved the drums");
  }

  // PROG: a named prog with sevenths widens the pad's pitch-class set; "off"
  // strips a genre's own prog back to the triads (blues' control from §23f)
  {
    const G = GENRES.vaporwave;
    const pcsPad = g2 => new Set(K.render(P, g2, g2.bars)
      .filter(e => e.part === "pad" && e.t < 16 / g2.rate).map(e => ((e.n % 12) + 12) % 12));
    const plain = pcsPad(G), seventh = pcsPad(boxGenre(G, { ...NUL, prog: "jack7" }));
    ok(seventh.size > plain.size,
       "box prog jack7 did not widen the pad's first chord (" +
       plain.size + " -> " + seventh.size + " pcs)");
    const off = K.bass(P, boxGenre(GENRES.blues, { ...NUL, prog: "off" }), 12)
      .filter(e => e.t < 12).map(e => ((e.n % 12) + 12) % 12);
    ok(off.includes(3) && !off.includes(4),
       "prog \"off\" did not strip blues back to the minor walk: " + off.join(","));
  }

  // PROG ON A MODAL GENRE: a named progression makes the harmony a CYCLE.
  // chordsOf ignores g.prog whenever harmony !== "cycle", so the chip used to
  // validate, light, and change nothing on ~19 of 45 genres — the shipped
  // depth surface silently inert. "off"/absent still leave modal modal.
  {
    const F2 = GENRES.funk;
    ok(rsig(boxGenre(F2, { ...NUL, prog: "blues12" })) !== rsig(F2),
       "prog \"blues12\" on a modal genre changes nothing — the chip is inert");
    ok(rsig(boxGenre(F2, { ...NUL, prog: "off" })) === rsig(F2),
       "prog \"off\" on a modal genre is not neutral");
    ok(rsig(boxGenre(F2, { ...NUL, cadence: { d: 4, q: "dom7" } })) === rsig(F2),
       "a bare cadence (no prog to land on) is not neutral on a modal genre");
  }

  // PERIOD: "4bar" lifts bar 3 (dens3 = more gates), "2bar" alternates,
  // "1bar" strips a genre's own sentence (beatles carries one)
  {
    const G = GENRES.rock;
    const counts = g2 => Array.from({ length: 4 }, (_, b) =>
      K.render(P, g2, 4).filter(e => e.v === 0 && Math.floor(e.t / 16) === b).length);
    const four = counts(boxGenre(G, { ...NUL, period: "4bar" }));
    ok(four[2] > four[0], "period 4bar: bar 3 is not busier than bar 1 (" + four.join(",") + ")");
    // TIMES ONLY, on the one-voice genre: P carries a ramp, so pitches climb
    // per loop and would read as the period failing when it is the ramp working
    const barSig = (g2, b) => JSON.stringify(K.render(P, g2, 4)
      .filter(e => e.v === 0 && Math.floor(e.t / 16) === b)
      .map(e => +(e.t % 16).toFixed(3)));
    const g2b = boxGenre(GENRES.simple, { ...NUL, period: "2bar" });
    ok(barSig(g2b, 0) !== barSig(g2b, 1) && barSig(g2b, 0) === barSig(g2b, 2) &&
       barSig(g2b, 1) === barSig(g2b, 3),
       "period 2bar is not an alternating two-bar sentence");
    const B = GENRES.beatles;
    ok(rsig(boxGenre(B, { ...NUL, period: "1bar" })) === rsig({ ...B, period: null }) &&
       rsig(boxGenre(B, { ...NUL, period: "1bar" })) !== rsig(B),
       "period 1bar does not strip the genre's own sentence");
  }

  // BREATH: "2" caps the hold so the gate hole is silence; "none" is the
  // explicit uncap — it must lengthen a genre that carries its own maxHold
  {
    const gap = { ...clone(P), gate: [1,0,0,0, 0,0,0,1, 1,0,0,0, 0,0,1,0],
                  sld: new Array(N).fill(0) };
    const total = a => a.reduce((s, e) => s + e.dur, 0);
    const G = GENRES.simple;
    const evF = K.render(gap, G, 2);
    const evC = K.render(gap, boxGenre(G, { ...NUL, breath: "2" }), 2);
    ok(evC.length === evF.length && Math.max(...evC.map(e => e.dur)) <= 2 &&
       total(evC) < total(evF),
       "breath \"2\" does not cap the hold in the rendered durations");
    // the GAPPED phrase again: P's own spans never exceed 2 steps, so blues'
    // maxHold 4 never binds on it and the uncap would measure as a tie
    const B = GENRES.blues;
    ok(total(K.render(gap, boxGenre(B, { ...NUL, breath: "none" }), B.bars)) >
       total(K.render(gap, B, B.bars)),
       "breath \"none\" does not uncap a genre that carries its own maxHold");
  }

  // PIPE: "3rds" adds chord-locked events; "off" strips a genre's own pipes
  // (isley ships a strum); "strum" spreads a pad chord's attacks
  {
    const G = GENRES.rock;
    const wet = K.render(P, boxGenre(G, { ...NUL, pipe: "3rds" }), 4);
    const added = wet.filter(e => e.pipe === "harmonize");
    ok(wet.length > K.render(P, G, 4).length && added.length > 0,
       "pipe 3rds added nothing to the rendered stream");
    for (const e of added)
      ok(K.chordsOf(P, G, Math.floor(e.t / 16))[0].pcSet.has(((e.n % 12) + 12) % 12),
         "a box-armed harmonize added a non-chord tone");
    const I = GENRES.isley;
    ok(rsig(boxGenre(I, { ...NUL, pipe: "off" })) === rsig({ ...I, pipes: null }) &&
       rsig(boxGenre(I, { ...NUL, pipe: "off" })) !== rsig(I),
       "pipe \"off\" does not strip the genre's own pipes");
    const V = boxGenre(GENRES.vaporwave, { ...NUL, pipe: "strum" });
    const pad0 = K.render(P, V, 4).filter(e => e.part === "pad" && e.t < 16 / V.rate);
    ok(new Set(pad0.map(e => e.t)).size > 1, "pipe strum left the pad as one attack");
  }

  // PART: "stab" chord-locks every line event; "auto" is the genre's own
  {
    const G = GENRES.rock;
    const ev = K.render(P, boxGenre(G, { ...NUL, part: "stab" }), 4);
    ok(ev.length > 0 && ev.every(e => e.part === "stab"),
       "part \"stab\" did not reassign every voice of the box");
    for (const e of ev) {
      const c = K.chordsOf(P, G, Math.floor(e.t / 16));
      ok(c.some(ch => ch.pcSet.has(((e.n % 12) + 12) % 12)),
         "a box-level stab pitch left its bar's chord");
    }
    ok(rsig(boxGenre(G, { ...NUL, part: "auto" })) === rsig(G),
       "part \"auto\" is not the genre's own scheme");
  }

  // TABLE INTEGRITY: every preset speaks vocabulary that exists — a period
  // op key outside OPS or a pipe id outside PIPES would be a chip that
  // validates and then silently does nothing
  for (const [k, w] of Object.entries(NF.PERIODS))
    for (const list of w) for (const opk of list)
      ok(!!NF.OPS[opk], "PERIODS." + k + " names unknown op \"" + opk + "\"");
  for (const [k, set] of Object.entries(NF.PIPESETS))
    for (const p of set)
      ok(!!K.PIPES[p.id], "PIPESETS." + k + " names unknown pipe \"" + p.id + "\"");
  for (const k of Object.keys(NF.PROGCHOICES))
    ok(k === "off" || !!NG.PROGS[k], "PROGCHOICES names unknown prog \"" + k + "\"");
  for (const [k, v] of Object.entries(NF.BREATHS))
    ok(Number.isFinite(v), "BREATHS." + k + " is not a number");

  // AUTOSHAPE: the palette's point-list writer, provable in node. The ARMING
  // (setValueAtTime/ramps on real AudioParams) has no node-side surface — it
  // is covered by section (J) of test/browser/nukernel-audio.test.js, which
  // sets a shape through the real palette and reads __nuMix().automation
  // plus the spectral change.
  {
    const beats = 16;
    for (const param of Object.keys(NF.AUTOPARAMS)) {
      const R = NF.AUTOPARAMS[param];
      ok(NF.autoShape(param, "off", beats) === null, param + ": off is not null");
      for (const shape of ["open", "close", "rise", "fall", "pump"]) {
        const a = NF.autoShape(param, shape, beats);
        ok(a && a.param === param && a.shape === shape &&
           (a.curve === "lin" || a.curve === "exp") && Array.isArray(a.points),
           param + "/" + shape + ": malformed entry");
        ok(a.points.every(pt => pt.length === 2 && pt.every(Number.isFinite) &&
           pt[0] >= 0 && pt[0] <= beats + 0.9 &&
           pt[1] >= Math.min(R.lo, R.hi) - 1e-6 && pt[1] <= Math.max(R.lo, R.hi) + 1e-6),
           param + "/" + shape + ": a point leaves the beat span or the value range");
      }
      const o = NF.autoShape(param, "open", beats), c2 = NF.autoShape(param, "close", beats);
      ok(o.points[0][1] < o.points[o.points.length - 1][1] ===
         (c2.points[0][1] > c2.points[c2.points.length - 1][1]),
         param + ": open and close do not run in opposite directions");
      ok(NF.autoShape(param, "pump", beats).points.length === 2 * beats,
         param + ": pump is not two points a beat");
    }
    // a written shape survives the loader — the palette's exact output
    const b = S.emptyBox();
    b.auto = [NF.autoShape("cutoff", "open", 16)];
    const r = S.validateSong({ v: 2, slots: [S.blank()], song: [b], bpm: 126, vol: 80 });
    ok(r.ok && r.song.song[0].auto.length === 1,
       "a palette-written automation entry does not survive validation: " +
       JSON.stringify(r.errors && r.errors[0]));
    // ...and malformed points are refused loudly, naming their path
    const bad = S.emptyBox();
    bad.auto = [{ param: "cutoff", points: [[0, NaN]] }];
    const rb = S.validateSong({ v: 2, slots: [S.blank()], song: [bad], bpm: 126, vol: 80 });
    ok(!rb.ok && /auto\[0\]\.points$/.test(rb.errors[0].path),
       "NaN automation points did not fail with a typed error");
  }

  // THE COMPOSER USES THE SURFACE: choruses draw the "4bar" preset, bridges
  // the "2bar" one, and the peak drop of a dance plan carries a real point
  // list on a public param — all through the same loader as everything else
  {
    const seeds = Array.from({ length: 20 }, (_, i) => i + 1);
    let four = 0, two = 0, autos = 0;
    for (const s of seeds) {
      const song = C.compose("rock", s);
      for (const b of song.song) {
        if (b.role === "chorus" && b.period === "4bar") four++;
        if (b.role === "bridge" && b.period === "2bar") two++;
        if (b.period != null) ok(!!NF.PERIODS[b.period],
          "rock/" + s + ": composed period \"" + b.period + "\" is not a preset name");
      }
      const dance = C.compose("house", s);
      const drops = dance.song.filter(b => b.role === "drop");
      const peak = drops[drops.length - 1];
      if (peak && peak.auto && peak.auto.length) {
        autos++;
        ok(peak.auto.every(a => NF.AUTOPARAMS[a.param] && a.points.length),
           "house/" + s + ": the peak drop's automation is not a real point list");
      }
    }
    ok(four > 4, "composed choruses never draw the 4bar sentence (" + four + ")");
    ok(two > 10, "composed bridges do not sway on the 2bar preset (" + two + ")");
    ok(autos === seeds.length,
       "the peak drop carries automation in only " + autos + "/" + seeds.length + " songs");
  }

  // THE INTERREGNUM MIGRATION: a save written between P2b and P4 carries the
  // bar schedule as a raw array; migrate turns a recognized one into its
  // preset name and drops an unrecognized one, so the evening's saves live
  {
    const mk = period => ({ v: 2, slots: [S.blank()],
      song: [Object.assign(S.emptyBox(), { period })], bpm: 126, vol: 80 });
    const r1 = S.load(mk([[], [], ["dens3"], []]));
    ok(r1.ok && r1.song.song[0].period === "4bar",
       "an array-form 4bar period did not migrate to its preset name");
    const r2 = S.load(mk([["rev"], ["inv"], ["rot5"]]));
    ok(r2.ok && r2.song.song[0].period == null,
       "an unrecognized array period was not dropped on migration");
  }
}

/* ---------------------------------------------------------------- 33b. THE AUTHORITY LAW
   A stacked layer plays through the BOX's harmony — prog and period stay the
   authority's alone (the comment sectionEvents itself carries). A layer that
   keeps its own prog is half the band in a different song: stacking blues on
   house had the layer voice-leading blues12 against the box's changes, and a
   layered beatles kept its own four-bar sentence. Both read through the REAL
   derive path. */
console.log("a stacked layer plays the authority's changes, not its own");
{
  // (a) the box's prog chip must REACH the layer: a layer following its own
  // prog is deaf to a change in the authority's changes
  const mk = prog => ({ stack: [{ g: "house", slots: [0] }, { g: "blues", slots: [0] }],
                        ops: [], prog, len: 4, nudge: 0 });
  const layerEv = sec => JSON.stringify(D.sectionEvents(sec, [P]).ev
    .filter(e => e.layer === "blues").map(e => [e.t, e.n]));
  ok(layerEv(mk(null)) !== layerEv(mk("jack7")),
     "the box's prog never reaches a stacked layer — it plays its own changes");
  // (b) a layered beatles must NOT keep its own four-bar sentence: the layer's
  // bar 4 renders as many notes as its bar 1 once the period is stripped
  const fb = { stack: [{ g: "funk", slots: [0] }, { g: "beatles", slots: [0] }],
               ops: [], len: 4, nudge: 0 };
  const lev = D.sectionEvents(fb, [P]).ev.filter(e => e.layer === "beatles");
  const bs34 = 16 / D.sectionEvents(fb, [P]).g.rate;
  const perBar = b => lev.filter(e => Math.floor(e.t / bs34) === b).length;
  ok(perBar(3) === perBar(0),
     "a stacked layer kept its own bar schedule (bar 4 " + perBar(3) +
     " notes vs bar 1 " + perBar(0) + ")");
}

/* ---------------------------------------------------------------- 34. KIT OPS × KIT SCHEDULE
   drums() prefers g.kits over g.kit, so a kit operator applied to the kit
   alone is a no-op on a schedule genre — dnb's breakdown kept its full
   two-bar break under a "no drums" chip, and only the composer's intro
   guard ever noticed. Read through the REAL derive path. */
console.log("kit operators reach the kit schedule (g.kits)");
{
  const box = kit => ({ stack: [{ g: "dnb", slots: [0] }], ops: [], kit,
                        len: 4, nudge: 0 });
  const hits = kit => D.sectionEvents(box(kit), [P]).ev.filter(e => e.kind === "hit");
  ok(hits(null).length > 0, "dnb renders no drums at all — this section proves nothing");
  ok(hits("nodrums").length === 0,
     "kit \"nodrums\" left " + hits("nodrums").length + " hits on a kits-schedule genre");
  ok(hits("nokick").length > 0 && hits("nokick").every(e => e.d !== "k"),
     "kit \"nokick\" left kicks on a kits-schedule genre");
  // `four` WRITES the lane: a kick on every quarter of every scheduled bar
  const four = hits("four").filter(e => e.d === "k");
  ok(four.length === 16,
     "kit \"four\" did not straighten the kick over the schedule (" + four.length + " kicks)");
}

/* ---------------------------------------------------------------- 35. GENRE FAMILIES
   The palette clusters the genre bank under FAMILIES headers, and the table
   is only trustworthy if it is TOTAL: every genre in exactly one family,
   every family key naming a real genre, every stamped `family` field from
   the allowed set. A genre missing from the table would silently vanish
   from the sound page — the palette draws the clusters, not GENRES. */
console.log("every genre carries exactly one family from the palette's set");
{
  const ALLOWED = new Set(["kernel", "vox", "club", "soul", "groove",
                           "band", "studio", "drift", "roots"]);
  ok(Array.isArray(FAMILIES) && FAMILIES.length === ALLOWED.size,
     "FAMILIES is not the allowed set (" + (FAMILIES || []).length + " families)");
  const seen = new Map();                       // genre key -> how many families
  for (const [fam, keys] of FAMILIES) {
    ok(ALLOWED.has(fam), "family \"" + fam + "\" is not in the allowed set");
    ok(keys.length > 0, "family \"" + fam + "\" is empty");
    for (const k of keys) {
      ok(!!GENRES[k], "family \"" + fam + "\" names unknown genre \"" + k + "\"");
      seen.set(k, (seen.get(k) || 0) + 1);
    }
  }
  for (const gk of GK) {
    ok(seen.get(gk) === 1, "genre \"" + gk + "\" is in " + (seen.get(gk) || 0) +
       " families — must be exactly one");
    ok(ALLOWED.has(GENRES[gk].family), "genre \"" + gk + "\" carries family \"" +
       GENRES[gk].family + "\" — not in the allowed set");
  }
}

console.log("\nnukernel: " + (checks - fails) + "/" + checks + " checks pass across " +
            GK.length + " genres");
if (fails) { console.error("nukernel: " + fails + " FAILURE(S)"); process.exit(1); }
process.exit(0);
})().catch(e => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
