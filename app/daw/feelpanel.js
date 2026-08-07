// feelpanel.js — the SHAPE surface. The radar is the whole control: no sliders.
//
// WHAT YOU SET IS WHAT IT SHOWS. Each spoke displays your value when you have set
// one (patch.feel) and the resolved value when you have not. That is the fix for
// the snap-back: the earlier cut repainted every handle from the resolved state
// after each drag, so shaping the genre made the spokes jump to whatever the new
// blend measured and nothing could be set, only nudged and watched to leave.
//
// The engine's actual shape is still visible — as the GHOST behind your polygon —
// because the gap between what you asked for and what the space gave you is
// information, not an error to hide.
//
// Accessibility lives in the radar itself now (focusable handles, role="slider",
// arrow keys — see vector.js) rather than in a parallel column of range inputs.
import { SONG, subs, edit } from "./song.js";
import { makeVector } from "./vector.js";
import * as FEEL from "./machines/feel.js";
import * as SCULPT from "./sculpt.js";

let vec = null, host = null, legend = null;

export function buildFeel(root) {
  host = root;
  root.textContent = "";

  const head = document.createElement("div");
  head.className = "dw-fhead";
  head.innerHTML = '<span class="dw-fname">shape</span>' +
    '<span class="dw-fhint">drag a spoke to shape the music — it stays where you put it</span>' +
    '<span class="dw-blend" id="dwBlend">—</span>';
  const rev = document.createElement("button");
  rev.className = "dw-mini"; rev.textContent = "reset shape";
  rev.title = "drop every set axis and show what the blend itself measures";
  rev.addEventListener("click", () => FEEL.revert());
  head.appendChild(rev);
  root.appendChild(head);

  const body = document.createElement("div");
  body.className = "dw-fbody";
  const left = document.createElement("div");
  left.className = "dw-fvec";
  legend = document.createElement("div");
  legend.className = "dw-flegend";
  body.appendChild(left); body.appendChild(legend);
  root.appendChild(body);

  // The radar is the picker AND the tuner: a release records the axis you set and
  // re-shapes the genre blend from the whole shape.
  vec = makeVector(left, {
    size: 260, hue: 190,
    onInput: () => {},
    onCommit: (id, v) => {
      FEEL.setAxis(id, v);          // your value, kept — this is what stops the snap
      sculptFromShape();            // ...and the space re-picks around the new shape
    },
  });
  SCULPT.onProgress(() => paintFeel());
  SCULPT.buildIndex();

  paintFeel();
  subs.push(paintFeel);
  return root;
}

// The shape currently displayed = what you set, falling back to what resolved.
function shownAxes() {
  const set = SONG.patch.feel || {};
  return FEEL.axes().map((a) => (set[a.id] != null && a.kind !== "indicator")
    ? Object.assign({}, a, { v: +set[a.id], held: true })
    : a);
}

function sculptFromShape() {
  if (!SCULPT.isReady()) return;
  const target = {};
  for (const a of shownAxes()) if (FEEL.isDraggable(a.id)) target[a.id] = a.v;
  const w = SCULPT.weightsFor(target, 3);
  if (w.length) edit({ weights: w });
}

export function paintFeel() {
  if (!vec) return;
  const shown = shownAxes(), resolved = FEEL.axes();
  vec.set(shown);
  // the ghost is what the ENGINE resolved, drawn behind what you asked for
  vec.setGhost(resolved.map((a) => a.v));

  legend.textContent = "";
  for (const a of shown) {
    const row = document.createElement("div");
    row.className = "dw-fleg" + (a.kind === "indicator" ? " ind" : "") + (a.held ? " held" : "");
    const res = resolved.find((r) => r.id === a.id);
    row.innerHTML = `<span class="dw-flegname">${a.label}</span>` +
      `<span class="dw-flegval">${Math.round(a.v * 100)}</span>` +
      (a.held && res && Math.abs(res.v - a.v) > 0.04
        ? `<span class="dw-fleggot">got ${Math.round(res.v * 100)}</span>` : "");
    row.title = a.doc + (a.kind === "indicator" ? " (reports only)" : a.held ? " (set by you)" : " (from the blend)");
    legend.appendChild(row);
  }

  const h = host && host.querySelector(".dw-fname");
  if (h) h.textContent = FEEL.isEdited() ? "shape · set" : "shape";
  const b = host && host.querySelector(".dw-blend");
  if (b) {
    const p = SCULPT.progress();
    if (SONG.weights && SONG.weights.length) b.textContent = SCULPT.label(SONG.weights);
    else b.textContent = p.done ? "drag to shape" : `learning the space… ${p.built}/${p.total || "?"}`;
    b.classList.toggle("wait", !p.done);
  }
}
