// feelpanel.js — the FEEL surface: the editable vector display, plus the real
// inputs beside it.
//
// The radar is a PICTURE. A picture is a fine primary control and a terrible only
// control: it cannot be reached by keyboard, screen readers get nothing from an
// SVG polygon, and a precise value is easier to type than to drag. So this panel
// renders BOTH from one source — the same axes drive the radar and a list of real
// <input type=range> rows, either one writes through machines/feel.js, and both
// re-read from the resolved state. Neither is the "accessible fallback"; they are
// two views of the same nine numbers.
import { SONG, subs, edit } from "./song.js";
import { makeVector } from "./vector.js";
import * as FEEL from "./machines/feel.js";
import * as SCULPT from "./sculpt.js";

let vec = null, rows = null, host = null;

export function buildFeel(root) {
  host = root;
  root.textContent = "";

  const head = document.createElement("div");
  head.className = "dw-fhead";
  head.innerHTML = '<span class="dw-fname">shape</span>' +
    '<span class="dw-fhint">drag the shape to find the music — dimmed spokes report, they do not set</span>' +
    '<span class="dw-blend" id="dwBlend">—</span>';
  const rev = document.createElement("button");
  rev.className = "dw-mini"; rev.textContent = "revert feel";
  rev.title = "drop every feel edit and go back to the genre's own shape";
  rev.addEventListener("click", () => FEEL.revert());
  head.appendChild(rev);
  root.appendChild(head);

  const body = document.createElement("div");
  body.className = "dw-fbody";
  const left = document.createElement("div");
  left.className = "dw-fvec";
  const right = document.createElement("div");
  right.className = "dw-frows";
  body.appendChild(left); body.appendChild(right);
  root.appendChild(body);

  // THE RADAR IS THE PICKER. There is no genre list: dragging shapes a TARGET,
  // and on release the kernel finds the anchors nearest that shape and blends
  // them (sculpt.js). The slider rows below stay precise PARAM edits on top of
  // whatever the blend resolved — shape to find the music, then fine-tune.
  vec = makeVector(left, {
    size: 260, hue: 190,
    onInput: (id, v) => { syncRow(id, v); },
    onCommit: () => sculptFromShape(),
  });
  SCULPT.onProgress(() => paintFeel());
  SCULPT.buildIndex();

  rows = right;
  buildRows();
  paintFeel();
  subs.push(paintFeel);
  return root;
}

function buildRows() {
  rows.textContent = "";
  for (const a of FEEL.axes()) {
    const row = document.createElement("div");
    row.className = "dw-frow" + (a.kind === "indicator" ? " ind" : "");
    row.dataset.axis = a.id;

    const lab = document.createElement("label");
    lab.className = "dw-flab";
    lab.textContent = a.label;
    lab.title = a.doc;

    const sl = document.createElement("input");
    sl.type = "range"; sl.min = "0"; sl.max = "1"; sl.step = "0.01";
    sl.className = "dw-fslider";
    sl.disabled = a.kind === "indicator";
    sl.setAttribute("aria-label", a.label + " — " + a.doc);
    sl.addEventListener("input", (e) => { vec && vec.setAxis(a.id, +e.target.value); setVal(row, +e.target.value); });
    sl.addEventListener("change", (e) => FEEL.setAxis(a.id, +e.target.value));

    const val = document.createElement("span");
    val.className = "dw-fval";

    lab.setAttribute("for", "");
    row.appendChild(lab); row.appendChild(sl); row.appendChild(val);
    // the KIND is stated, not implied by a colour: "reports only" is information
    if (a.kind !== "direct") {
      const tag = document.createElement("span");
      tag.className = "dw-fkind";
      tag.textContent = a.kind === "indicator" ? "reports only" : "spreads";
      tag.title = a.kind === "indicator"
        ? "this axis is a reading, not a control — it cannot be inverted without inventing musical decisions"
        : "one drag moves several params together, keeping their current balance";
      row.appendChild(tag);
    }
    rows.appendChild(row);
  }
}
const setVal = (row, v) => { const s = row.querySelector(".dw-fval"); if (s) s.textContent = Math.round(v * 100) + ""; };
function syncRow(id, v) {
  const row = rows && rows.querySelector(`.dw-frow[data-axis="${id}"]`);
  if (!row) return;
  const sl = row.querySelector(".dw-fslider");
  if (sl) sl.value = String(v);
  setVal(row, v);
}

// Read the shape currently on the radar, ask the space what is nearest, and make
// that the song. The seed is untouched: shaping changes WHICH music, not which
// take of it.
function sculptFromShape() {
  if (!vec || !SCULPT.isReady()) return;
  const ids = vec.ids(), vals = vec.values();
  const target = {};
  ids.forEach((id, i) => { if (FEEL.isDraggable(id)) target[id] = vals[i]; });
  lastTarget = vals.slice();
  const w = SCULPT.weightsFor(target, 3);
  if (!w.length) return;
  edit({ weights: w });
}

let lastTarget = null;

export function paintFeel() {
  if (!vec) return;
  const axes = FEEL.axes();
  vec.set(axes);
  vec.setGhost(lastTarget);
  for (const a of axes) syncRow(a.id, a.v);
  const h = host && host.querySelector(".dw-fname");
  if (h) h.textContent = FEEL.isEdited() ? "shape · tuned" : "shape";
  const b = host && host.querySelector(".dw-blend");
  if (b) {
    const p = SCULPT.progress();
    if (SONG.weights && SONG.weights.length) b.textContent = SCULPT.label(SONG.weights);
    else b.textContent = p.done ? "drag to shape" : `learning the space… ${p.built}/${p.total || "?"}`;
    b.classList.toggle("wait", !p.done);
  }
}
