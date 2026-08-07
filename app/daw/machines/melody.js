// machines/melody.js — THE WANDER MACHINE (stage 5a of docs/DAW.md).
//
// The engine's `wander` melody generator was six literal constants inside one
// while-loop: a rhythm pool, a ±1 slot step, an 0.18 octave-leap chance, a 0..3
// slot clamp and a 0.92 legato factor. Every one of them is now a knob on
// state.melodyGen, with its literal as the default — so an absent melodyGen draws
// the identical numbers in the identical order and every existing render is
// byte-identical (test/unit/melody-gen.test.js).
//
// This is the cheapest machine on the whole plan and the one that feels most like
// an instrument, because none of it is a note: you are shaping the WALK. Turn
// `step` up and the line starts leaping; turn `rest` up and it learns to breathe.
//
// NOT A PIANO ROLL EDIT. Everything here is a rule, so it survives a change of
// seed, tempo, key or form — the founding constraint. Drawing actual phrases is
// the NEXT machine (melodyCells), and it stores contour in chord-tone indices for
// the same reason.
import { SONG, edit, state } from "../song.js";

// The defaults ARE the engine's literals. Kept here so the panel can show what
// "untouched" means and so revert has something exact to go back to; if these ever
// disagree with csd-engine's wander loop, the gate catches it.
export const DEFAULTS = { rhythm: [1, 0.5, 0.5, 1, 1, 2], step: 1, leap: 0.18, range: [0, 3], legato: 0.92, rest: 0 };

export const KNOBS = [
  { id: "step",   label: "step",   min: 1, max: 4,   step: 1,    fmt: (v) => "±" + v + " slot" + (v > 1 ? "s" : ""),
    doc: "how far the walk may move through the chord's voicing per note — 1 is stepwise, 4 leaps" },
  { id: "leap",   label: "octave leap", min: 0, max: 1, step: 0.02, fmt: (v) => Math.round(v * 100) + "%",
    doc: "chance a note jumps an octave up — the sparkle" },
  { id: "rest",   label: "rest",   min: 0, max: 0.6, step: 0.02, fmt: (v) => Math.round(v * 100) + "%",
    doc: "chance a step is silence instead of a note — space. The one knob that adds an rng draw, so 0 stays byte-identical" },
  { id: "legato", label: "legato", min: 0.2, max: 1, step: 0.02, fmt: (v) => Math.round(v * 100) + "%",
    doc: "how much of the gap to the next note this note holds — separation" },
];

// Rhythm pools as NAMED gaits rather than an array editor: the pool is cycled in
// order, so its character is the pattern, not the individual numbers.
export const GAITS = [
  { id: "default", label: "walking",  pool: [1, 0.5, 0.5, 1, 1, 2] },
  { id: "even",    label: "even 8ths", pool: [0.5] },
  { id: "quarters", label: "quarters", pool: [1] },
  { id: "long",    label: "long-short", pool: [1.5, 0.5] },
  { id: "swung",   label: "gallop",   pool: [0.75, 0.25, 0.5] },
  { id: "sparse",  label: "sparse",   pool: [2, 1, 2, 3] },
];
const sameArr = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function gaitOf(gen) {
  const pool = (gen && gen.rhythm) || DEFAULTS.rhythm;
  const hit = GAITS.find((g) => sameArr(g.pool, pool));
  return hit ? hit.id : "custom";
}

export const current = () => Object.assign({}, DEFAULTS, SONG.patch.melodyGen || {});
export const isEdited = () => !!SONG.patch.melodyGen;

function commit(gen) {
  const patch = Object.assign({}, SONG.patch);
  // store only what DIFFERS from the engine's own defaults, so a song that has
  // been dialled back to stock carries nothing and renders byte-identically
  const lean = {};
  for (const k of Object.keys(DEFAULTS))
    if (JSON.stringify(gen[k]) !== JSON.stringify(DEFAULTS[k])) lean[k] = gen[k];
  if (Object.keys(lean).length) patch.melodyGen = lean; else delete patch.melodyGen;
  edit({ patch });
}
export function setKnob(id, v) { const g = current(); g[id] = +v; commit(g); }
export function setGait(id) {
  const g = current(), hit = GAITS.find((x) => x.id === id);
  if (!hit) return;
  g.rhythm = hit.pool.slice();
  commit(g);
}
export function revert() { const p = Object.assign({}, SONG.patch); delete p.melodyGen; edit({ patch: p }); }

// Does this song's form actually run the wander generator anywhere? The knobs
// only reach `wander`; saying so is better than offering dials that do nothing.
export function wanderSections() {
  const s = state(), out = [];
  for (const sec of s.sections || []) {
    const m = sec.melody;
    if (m === "wander") out.push(sec.name || "section");
  }
  return out;
}
