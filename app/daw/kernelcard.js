// kernelcard.js — THE KERNEL CARD: the top of the hierarchy, collapsed to a row.
//
//   collapsed: ◇ shape thumbnail · blend label · seed chip · bpm tile
//   expanded:  the full genre SCULPTOR — the vector.js radar you drag; the
//              kernel finds the anchors nearest that shape and blends them
//              (sculpt.js, unchanged). What you set is authoritative, the
//              resolved shape rides behind as the ghost — the no-snap rule.
//
// The bpm tile is the first LIVE tile in the build: it writes the master layer
// (layers.js WRITERS.master, patch.layers.master.bpm) so tempo is the whole
// song's, not any voice's.
import { SONG, edit, state, subs, genreLabel, editLayer } from "./song.js";
import { makeVector } from "./vector.js";
import { makeTile } from "./controls.js";
import { readLayer, fmtLayer } from "./layers.js";
import { axesOf, isDraggable } from "./machines/feel-core.js";
import * as FEEL from "./machines/feel.js";
import * as SCULPT from "./sculpt.js";

const HUE = 190;
const $el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };

let root = null, vec = null, thumbEl = null, labelEl = null, seedEl = null, progEl = null;
let openState = false;

// what you set where you set it, the resolved value where you did not — the
// no-snap rule, verbatim from the old deck
function kernelAxes(st) {
  const set = SONG.patch.feel || {};
  return axesOf(st).filter((a) => isDraggable(a.id))
    .map((a) => (set[a.id] != null ? Object.assign({}, a, { v: +set[a.id] }) : a));
}

export function build(host) {
  root = host;
  root.classList.add("dw-kcard");
  root.style.setProperty("--hue", HUE);

  // ---- collapsed row (always visible; tap toggles the sculptor) ----
  const row = $el("button", "dw-krow");
  row.type = "button";
  row.setAttribute("aria-expanded", "false");
  row.title = "the kernel — tap to open the genre sculptor";
  thumbEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  thumbEl.setAttribute("class", "dw-kthumb");
  thumbEl.setAttribute("viewBox", "0 0 40 40");
  row.appendChild(thumbEl);
  labelEl = $el("span", "dw-klabel", "");
  row.appendChild(labelEl);
  seedEl = $el("span", "dw-kseed", "");
  row.appendChild(seedEl);
  row.addEventListener("click", () => {
    openState = !openState;
    root.classList.toggle("open", openState);
    row.setAttribute("aria-expanded", String(openState));
  });
  root.appendChild(row);

  // the bpm tile rides beside the row — whole-song tempo, real units
  const tileHost = $el("div", "dw-ktile");
  makeTile(tileHost, {
    label: "tempo", hue: HUE,
    read: () => {
      const st = state();
      const set = (SONG.patch.layers || {}).master || {};
      const v = set.bpm != null ? +set.bpm : readLayer(st, "master", "bpm");
      return { v, txt: fmtLayer("master", "bpm", v), stock: set.bpm == null };
    },
    write: (v) => editLayer("master", "bpm", v),
    revert: () => editLayer("master", "bpm", null),
  });
  root.appendChild(tileHost);

  // ---- expanded: the sculptor ----
  const exp = $el("div", "dw-kexpand");
  progEl = $el("p", "dw-pnote dw-kprog", "");
  exp.appendChild(progEl);
  const vhost = $el("div", "dw-kvec");
  exp.appendChild(vhost);
  exp.appendChild($el("p", "dw-pnote",
    "drag the shape — the space finds the genres nearest it and blends them. " +
    "what you set stays put; the dashed ghost is what the space actually gave you."));
  root.appendChild(exp);

  vec = makeVector(vhost, {
    size: 300, hue: HUE,
    onCommit: (axisId, v) => {
      FEEL.setAxis(axisId, v);
      if (SCULPT.isReady()) {
        const target = {};
        for (const a of kernelAxes(state())) target[a.id] = a.v;
        const w = SCULPT.weightsFor(target, 3);
        if (w.length) edit({ weights: w });
      }
    },
  });

  SCULPT.onProgress(paint);
  SCULPT.buildIndex();
  subs.push(paint);
  paint();
  return root;
}

function paint() {
  if (!root) return;
  const st = state();
  const axes = kernelAxes(st).map((a) => Object.assign({ kind: "direct" }, a));
  vec.set(axes);
  vec.setGhost(axesOf(st).filter((a) => isDraggable(a.id)).map((a) => a.v));

  // ◇ thumbnail: the same shape at 40px
  const C = 20, R = 16;
  const pts = axes.map((a, i) => {
    const ang = -Math.PI / 2 + (i * Math.PI * 2) / axes.length;
    const r = Math.max(0.08, Math.min(1, a.v)) * R;
    return (C + Math.cos(ang) * r).toFixed(1) + "," + (C + Math.sin(ang) * r).toFixed(1);
  }).join(" ");
  thumbEl.innerHTML = `<circle cx="20" cy="20" r="16" class="dw-kthumbring"/><polygon points="${pts}" class="dw-kthumbpoly"/>`;

  labelEl.textContent = SONG.weights && SONG.weights.length
    ? SCULPT.label(SONG.weights)
    : genreLabel(SONG.genre);
  seedEl.textContent = "seed " + SONG.seed;
  const p = SCULPT.progress();
  progEl.textContent = p.done ? "" : `learning the space… ${p.built}/${p.total || "?"}`;
  progEl.hidden = p.done;
}
