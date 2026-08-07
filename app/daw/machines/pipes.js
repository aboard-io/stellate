// machines/pipes.js — THE NOTE-FX RACK, over the registry the engine already has.
//
// `state.pipes` is an ORDERED list of note transforms applied at buildEvents' one
// choke point, each drawing from its own stream (seed+71000+i*97) and each already
// carrying a `doc` string in `CsdPipes.REGISTRY`. That is a rack: ordered,
// insertable, reorderable, parameterised, stream-isolated and self-documenting. So
// this module is a binding, not a design — the tooltips were written by whoever
// built the organ.
//
// It sits BELOW the generators on purpose. docs/DAW.md's boundary: a machine that
// reads another track cannot be a generator, it has to be a pipe, because pipes
// see the whole bundle. `harmonize` snapping the melody to the pad/bass notes
// sounding under it is the canonical example.
import { SONG, edit, state } from "../song.js";

const P = () => window.CsdPipes;

// The numeric params worth exposing per pipe, with the ranges the engine reads
// them in. Deliberately NOT every field the registry touches: `profile` is a mined
// table name and `pattern` is an enum, neither of which is a knob.
const PARAMS = {
  prob:    { lo: 0, hi: 1,    label: "chance" },
  amp:     { lo: 0, hi: 1.5,  label: "level" },
  semis:   { lo: -12, hi: 12, label: "shift" },
  oct:     { lo: -2, hi: 2,   label: "octave" },
  floor:   { lo: 0, hi: 1,    label: "floor" },
  peak:    { lo: 0, hi: 1,    label: "peak" },
  lo:      { lo: 0, hi: 4,    label: "low" },
  hi:      { lo: 0, hi: 4,    label: "high" },
  rate:    { lo: 0, hi: 12,   label: "rate" },
  depth:   { lo: 0, hi: 1,    label: "depth" },
  amount:  { lo: 0, hi: 1,    label: "amount" },
  minDur:  { lo: 0.25, hi: 4, label: "min dur" },
  level:   { lo: 0, hi: 2,    label: "level" },
  rsend:   { lo: 0, hi: 4,    label: "send" },
  step:    { lo: 0, hi: 1,    label: "step" },
  tol:     { lo: 0, hi: 1,    label: "tol" },
};

export function registry() {
  const R = (P() && P().REGISTRY) || {};
  return Object.keys(R).map((id) => ({ id, doc: (R[id] && R[id].doc) || "" }));
}
export const active = () => (state().pipes || []).map((p) => Object.assign({}, p));
export const isOn = (id) => active().some((p) => p.id === id);
export const isEdited = () => !!SONG.patch.pipes;

function commit(list) {
  edit({ patch: Object.assign({}, SONG.patch, { pipes: list }) });
}
export function revert() {
  const p = Object.assign({}, SONG.patch);
  delete p.pipes;
  edit({ patch: p });
}

export function toggle(id) {
  const list = active();
  const i = list.findIndex((p) => p.id === id);
  if (i >= 0) list.splice(i, 1);
  else list.push({ id, prob: 0.5 });          // a new pipe starts audible but not dominant
  commit(list);
}
// ORDER IS AUDIBLE: each pipe draws from a stream keyed on its INDEX, and a pipe
// that adds notes changes what the next one sees. So moving one is a real edit,
// not a cosmetic sort.
export function move(id, dir) {
  const list = active();
  const i = list.findIndex((p) => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const t = list[i]; list[i] = list[j]; list[j] = t;
  commit(list);
}
export function setParam(id, key, v01) {
  const list = active();
  const p = list.find((x) => x.id === id);
  const r = PARAMS[key];
  if (!p || !r) return;
  p[key] = +(r.lo + v01 * (r.hi - r.lo)).toFixed(3);
  commit(list);
}

// The knobs a given active pipe exposes: whatever numeric fields its spec already
// carries, plus `prob` (which nearly all of them read) so a freshly added pipe has
// something to turn.
export function knobsOf(spec) {
  const keys = new Set(Object.keys(spec).filter((k) => k !== "id" && PARAMS[k] != null && typeof spec[k] === "number"));
  if (PARAMS.prob) keys.add("prob");
  return [...keys].map((k) => {
    const r = PARAMS[k];
    const raw = typeof spec[k] === "number" ? spec[k] : r.lo;
    return { id: k, label: r.label, kind: "direct",
             v: Math.max(0, Math.min(1, (raw - r.lo) / (r.hi - r.lo))), raw };
  });
}
