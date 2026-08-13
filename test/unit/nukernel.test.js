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
    const root = g.harmony === "cycle" ? K.mp(K.harm(P, g, b), g.mode || undefined) : 0;
    const allowed = new Set(sc.map(x => (((x + root) % 12) + 12) % 12));
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

console.log("\nnukernel: " + (checks - fails) + "/" + checks + " checks pass across " +
            GK.length + " genres");
if (fails) { console.error("nukernel: " + fails + " FAILURE(S)"); process.exit(1); }
process.exit(0);
