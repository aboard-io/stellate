// orbitpanel.js — the one surface: the multilayered radar plus the focused
// layer's REFINER underneath.
//
// The radar is navigation and coarse control; the refiner is the fine detail that
// cannot be a shape — a phrase is a contour in time, a kit is a list of ops, a
// weave is a transition matrix. Zooming to a ring swaps the refiner under it, so
// there is one place to look and one thing in hand.
import { SONG, subs, edit, state } from "./song.js";
import { makeOrbit } from "./orbit.js";
import { LAYERS, layerById } from "./layers.js";
import * as FEEL from "./machines/feel.js";
import * as SCULPT from "./sculpt.js";
import { renderRefiner } from "./panel.js";

let orbit = null, host = null, refiner = null, blendEl = null;

export function buildOrbit(root) {
  host = root; root.textContent = "";

  const head = document.createElement("div");
  head.className = "dw-fhead";
  head.innerHTML = '<span class="dw-fname" id="dwLayer">genre</span>' +
    '<span class="dw-fhint">zoom with the wheel, +/− or a tap on any ring — the lit ring is the one you edit</span>' +
    '<span class="dw-blend" id="dwBlend">—</span>';
  root.appendChild(head);

  const body = document.createElement("div");
  body.className = "dw-obody";
  const left = document.createElement("div");
  left.className = "dw-ovec";
  refiner = document.createElement("div");
  refiner.className = "dw-orefine";
  body.appendChild(left); body.appendChild(refiner);
  root.appendChild(body);

  orbit = makeOrbit(left, {
    size: 460,
    onCommit: (layerId, axisId, v) => {
      if (layerId === "genre") { FEEL.setAxis(axisId, v); sculpt(); return; }
      const layers = Object.assign({}, SONG.patch.layers || {});
      layers[layerId] = Object.assign({}, layers[layerId] || {}, { [axisId]: v });
      edit({ patch: Object.assign({}, SONG.patch, { layers }) });
    },
    onFocus: () => paintOrbit(),
  });
  SCULPT.onProgress(() => paintOrbit());
  SCULPT.buildIndex();

  // the rack strips double as the stack's table of contents
  window.__DAWORBIT = {
    focus: () => orbit.focus(),
    focusLayer: (id) => { const i = LAYERS.findIndex((l) => l.id === id); if (i >= 0) orbit.setFocus(i); },
    setFocus: (i) => orbit.setFocus(i),
    LAYERS: LAYERS.map((l) => l.id),
  };
  blendEl = head.querySelector("#dwBlend");
  paintOrbit();
  subs.push(paintOrbit);
  return root;
}

// what the genre ring SHOWS: your set value where you set one, the resolved value
// where you did not — the no-snap rule, unchanged
function genreAxes(st) {
  const set = SONG.patch.feel || {};
  return LAYERS[0].axes(st).map((a) => (set[a.id] != null ? Object.assign({}, a, { v: +set[a.id] }) : a));
}

function sculpt() {
  if (!SCULPT.isReady()) return;
  const target = {};
  for (const a of genreAxes(state())) target[a.id] = a.v;
  const w = SCULPT.weightsFor(target, 3);
  if (w.length) edit({ weights: w });
}

export function paintOrbit() {
  if (!orbit) return;
  const st = state();
  orbit.set(LAYERS.map((L) => ({
    id: L.id, label: L.label, hue: L.hue,
    axes: L.id === "genre" ? genreAxes(st) : L.axes(st),
  })));

  const fid = orbit.focus() || "genre";
  const lay = layerById(fid);
  const nm = host.querySelector("#dwLayer");
  if (nm) { nm.textContent = lay ? lay.label : fid; nm.title = (lay && lay.doc) || ""; }

  if (blendEl) {
    const p = SCULPT.progress();
    if (SONG.weights && SONG.weights.length) blendEl.textContent = SCULPT.label(SONG.weights);
    else blendEl.textContent = p.done ? "shape the centre to change genre" : `learning the space… ${p.built}/${p.total || "?"}`;
    blendEl.classList.toggle("wait", !p.done);
  }

  renderRefiner(refiner, fid);
}
