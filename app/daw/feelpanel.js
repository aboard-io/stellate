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
import { subs } from "./song.js";
import { makeVector } from "./vector.js";
import * as FEEL from "./machines/feel.js";

let vec = null, rows = null, host = null;

export function buildFeel(root) {
  host = root;
  root.textContent = "";

  const head = document.createElement("div");
  head.className = "dw-fhead";
  head.innerHTML = '<span class="dw-fname">feel</span>' +
    '<span class="dw-fhint">drag the shape — dimmed spokes report, they do not set</span>';
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

  vec = makeVector(left, {
    size: 260, hue: 190,
    onInput: (id, v) => { syncRow(id, v); },              // live while dragging
    onCommit: (id, v) => { FEEL.setAxis(id, v); },        // commit on release
  });

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

export function paintFeel() {
  if (!vec) return;
  const axes = FEEL.axes();
  vec.set(axes);
  for (const a of axes) syncRow(a.id, a.v);
  const h = host && host.querySelector(".dw-fname");
  if (h) h.textContent = FEEL.isEdited() ? "feel · edited" : "feel";
}
