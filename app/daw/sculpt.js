// sculpt.js — SHAPE A GENRE. The vector display IS the picker; there is no list.
//
// You drag a shape; the kernel finds the anchors nearest that shape and blends
// them. A point between anchors is a real place, not a menu item you missed —
// which is the whole premise of the 274-genre space, and the reason the star map
// exists. The DAW just reaches the same space by feel instead of by position.
//
// THE INDEX. Matching needs a feel vector per anchor, and a feel vector needs a
// RESOLVED state (the axes read cutoffs, sends and levels the kernel picks at
// resolve time). Measured: 274 anchors resolve in ~1.75 s in node, so this cannot
// run at boot and cannot run synchronously on a drag. It builds in idle chunks
// with the sculptor usable throughout — matching against whatever is indexed so
// far and improving as it fills. A partial index gives a worse match, never a
// wrong one.
//
// MATCHING USES THE DRAGGABLE AXES ONLY. `density` is an indicator you cannot
// set, so including it would match on a coordinate you have no way to steer —
// the shape would drift toward whatever the last blend happened to be.
import { axesOf } from "./machines/feel-core.js";

const K = window.GenreKernel;
const SEED = 1;                       // one fixed seed for the index: comparing anchors, not seeds

let index = [];                       // [{g, v:{axis->value}}]
let ids = null, cursor = 0, building = false, done = false;
const listeners = [];
export const onProgress = (fn) => listeners.push(fn);
const ping = () => listeners.forEach((f) => { try { f(progress()); } catch (e) {} });
export const progress = () => ({ built: index.length, total: ids ? ids.length : 0, done });
export const isReady = () => index.length > 0;

// axes we match on = the ones you can actually drag (see header)
let AXIS_IDS = null;
function axisIds(sample) {
  if (!AXIS_IDS) AXIS_IDS = sample.filter((a) => a.kind !== "indicator").map((a) => a.id);
  return AXIS_IDS;
}

function measure(g) {
  try {
    const t = K.track(g, { seed: SEED });
    const st = t.state || t;
    const ax = axesOf(st);
    const ids2 = axisIds(ax);
    const v = {};
    for (const a of ax) if (ids2.indexOf(a.id) >= 0) v[a.id] = a.v;
    return { g, v };
  } catch (e) { return null; }
}

// Build in idle slices. requestIdleCallback where it exists (not Safari/iOS), a
// short timeout otherwise — either way the main thread keeps the UI responsive,
// which on a phone is the difference between "shaping" and "frozen".
const idle = (fn) => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 400 }) : setTimeout(() => fn({ timeRemaining: () => 8 }), 16));
export function buildIndex() {
  if (building || done) return;
  building = true;
  ids = Object.keys(K.GENRES);
  const step = (deadline) => {
    const t0 = performance.now();
    while (cursor < ids.length && (performance.now() - t0 < 12)) {
      const m = measure(ids[cursor++]);
      if (m) index.push(m);
    }
    ping();
    if (cursor < ids.length) idle(step);
    else { done = true; building = false; ping(); }
  };
  idle(step);
}

// ---------- the match ----------
// Nearest anchors by Euclidean distance over the draggable axes, blended with
// weights ∝ 1/(dist+ε) so a shape sitting between three genres gives you all
// three in proportion rather than snapping to the closest. `k` is small on
// purpose: a blend of ten anchors is mud, and the star map's own blends are of
// the same order.
export function nearest(target, k) {
  k = k || 3;
  if (!index.length) return [];
  const ids2 = AXIS_IDS || Object.keys(target);
  const scored = index.map((e) => {
    let s = 0;
    for (const id of ids2) { const d = (target[id] == null ? 0 : target[id]) - (e.v[id] == null ? 0 : e.v[id]); s += d * d; }
    return { g: e.g, d: Math.sqrt(s) };
  });
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, k);
}
export function weightsFor(target, k) {
  const near = nearest(target, k);
  if (!near.length) return [];
  const raw = near.map((n) => ({ g: n.g, w: 1 / (n.d + 0.08) }));
  const tot = raw.reduce((s, x) => s + x.w, 0);
  return raw.map((x) => ({ g: x.g, w: +(x.w / tot).toFixed(4) }));
}

// A blend resolves through the kernel's own K.mix — the same call the star map
// makes for a point between stars, so a sculpted song and an explored one are the
// same kind of object.
export function resolveBlend(weights, seed) {
  return K.mix(weights.map((w) => ({ g: w.g, w: w.w })), { seed: seed });
}
window.__DAWSCULPT = { progress, isReady, nearest, weightsFor };
export const label = (weights) => weights
  .map((w) => Math.round(w.w * 100) + "% " + ((K.GENRES[w.g] && K.GENRES[w.g].label) || w.g))
  .join(" · ");
