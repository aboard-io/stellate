// ui/stepnav.js — the STEP page's navigator (phone only): the whole phrase as
// a minimap — 8 lanes × 16 steps, gate/acc/sld as coloured ticks, the value
// lanes as tiny bars — with a viewport outline showing which lanes the focus
// view below is showing BIG. Dragging the map (or arrow keys on it) pans the
// focus: .lanes gets one translateY, so all 128 cells stay in the DOM, alive,
// clickable and gate-readable — panning is paint, never structure.
//
// It doubles as the at-a-glance pattern display, which is why it is drawn
// from the phrase data rather than from the cells: it shows the MUSIC, and it
// would keep working if the cells' skin changed. ≥560px it is display:none —
// on a desk the full grid is already on screen at comfortable size, and a
// minimap of a fully visible thing is a second source of truth with no
// panning job (the CSS owns that call; this module just goes inert).
//
// Layer graph: ui view — imports state (the phrase + events), editor (the
// shared ROWS/RANGE vocabulary) and touch; audio never knows it exists.
import { SUBJ, on } from "./state.js";
import { ROWS, RANGE } from "./editor.js";
import { buzz } from "./touch.js";

const nav = document.getElementById("stepnav");
const view = document.querySelector("#stepgrid .lanesview");
const lanes = document.querySelector("#stepgrid .lanes");

/* ---------- build once ---------- */
// 10 units per step, 9 per lane: the viewBox is a fixed little stage and
// preserveAspectRatio:none stretches it to whatever width the panel has
const NS = "http://www.w3.org/2000/svg";
const W = 160, H = ROWS.length * 9;
const svg = document.createElementNS(NS, "svg");
svg.setAttribute("class", "nmap");
svg.setAttribute("viewBox", "0 0 " + W + " " + H);
svg.setAttribute("preserveAspectRatio", "none");
svg.setAttribute("aria-hidden", "true");
// quarter hairlines, the map's only ruler
for (const x of [40, 80, 120]) {
  const l = document.createElementNS(NS, "line");
  l.setAttribute("class", "nq");
  l.setAttribute("x1", x); l.setAttribute("x2", x);
  l.setAttribute("y1", 0); l.setAttribute("y2", H);
  svg.append(l);
}
const dots = {};                     // key -> [16 rects], patched in place
ROWS.forEach((key, li) => {
  dots[key] = [];
  for (let i = 0; i < 16; i++) {
    const r = document.createElementNS(NS, "rect");
    r.setAttribute("x", (i * 10 + 1.2).toFixed(1));
    r.setAttribute("width", "7.6");
    if (RANGE[key]) r.setAttribute("class", "nv");
    else {
      r.setAttribute("class", "nb " + key);
      r.dataset.q = String(1 + (i >> 2));       // gate ticks wear 909 colours
      r.setAttribute("y", li * 9 + 2);
      r.setAttribute("height", "5");
    }
    dots[key].push(r);
    svg.append(r);
  }
});
// the viewport outline — where the focus view sits over the whole pattern
const vp = document.createElementNS(NS, "rect");
vp.setAttribute("class", "nview");
vp.setAttribute("x", "0.75"); vp.setAttribute("width", W - 1.5);
vp.setAttribute("y", "0"); vp.setAttribute("height", H);
svg.append(vp);
nav.append(svg);

// a real control: a vertical slider over the lane list, keyboard-complete
nav.tabIndex = 0;
nav.setAttribute("role", "slider");
nav.setAttribute("aria-orientation", "vertical");
nav.setAttribute("aria-label", "pattern overview — drag to choose which rows are in view");
nav.setAttribute("aria-valuemin", "0");
nav.setAttribute("aria-valuemax", String(ROWS.length - 1));

/* ---------- the minimap ink ---------- */
// drawn from SUBJ, guarded per rect — a scrub commits per pointermove and
// only the cell under the finger should cost a style recalc here too
const memo = {};
function patch() {
  for (const key of ROWS) {
    const num = RANGE[key], row = dots[key];
    const li = ROWS.indexOf(key);
    for (let i = 0; i < 16; i++) {
      const r = row[i], v = SUBJ[key][i];
      let sig;
      if (num) {
        // a tiny bar up from the lane's baseline; rests dim, exactly as the
        // big cells dim (.rest) — the map and the grid must tell one story
        const f = (v - num[0]) / (num[1] - num[0]);
        const h = 1.2 + f * 6.3, y = li * 9 + 8 - h;
        sig = h.toFixed(1) + (SUBJ.gate[i] ? "" : "r");
        if (memo[key + i] === sig) continue;
        r.setAttribute("y", y.toFixed(1));
        r.setAttribute("height", h.toFixed(1));
        r.setAttribute("class", "nv" + (SUBJ.gate[i] ? "" : " rest"));
      } else {
        sig = v ? "1" : "0";
        if (memo[key + i] === sig) continue;
        r.setAttribute("class", "nb " + key + (v ? " on" : ""));
      }
      memo[key + i] = sig;
    }
  }
}

/* ---------- the pan ---------- */
// One number: how far the lane stack is pushed up. Applied as a transform on
// .lanes; the viewport rect is the same number in map units. Inert whenever
// the navigator is not painted (desktop, or another page up).
let pan = 0;
const active = () => nav.offsetParent != null;
function laneTops() {
  return [...lanes.children].map(el => el.offsetTop);
}
function apply() {
  if (!active()) { lanes.style.transform = ""; return; }
  const vh = view.clientHeight, lh = lanes.scrollHeight;
  if (!vh || !lh) return;
  pan = Math.max(0, Math.min(Math.max(0, lh - vh), pan));
  lanes.style.transform = "translateY(" + (-pan) + "px)";
  vp.setAttribute("y", (pan / lh * H).toFixed(1));
  vp.setAttribute("height", Math.min(H, vh / lh * H).toFixed(1));
  // which lanes the window covers, for the accessible name
  const tops = laneTops();
  let first = 0, last = 0;
  tops.forEach((t, i) => {
    const el = lanes.children[i];
    if (t + el.offsetHeight * 0.5 <= pan) first = Math.min(i + 1, ROWS.length - 1);
    if (t + el.offsetHeight * 0.5 <= pan + vh) last = i;
  });
  nav.setAttribute("aria-valuenow", String(first));
  nav.setAttribute("aria-valuetext",
    "rows " + ROWS.slice(first, last + 1).join(", "));
}

// DRAG IS ABSOLUTE, like putting a finger on the map: the viewport centre
// goes where the finger is, and stays under it as it moves — the popfader
// track's gesture, turned sideways onto the whole lane stack
{
  let dragging = false;
  const at = ev => {
    const r = nav.getBoundingClientRect();
    const f = (ev.clientY - r.top) / r.height;
    pan = f * lanes.scrollHeight - view.clientHeight / 2;
    apply();
  };
  nav.addEventListener("pointerdown", ev => {
    if (ev.button) return;
    dragging = true;
    try { nav.setPointerCapture(ev.pointerId); } catch (e) {}
    buzz(4);
    at(ev);
  });
  nav.addEventListener("pointermove", ev => { if (dragging) at(ev); });
  const end = () => { dragging = false; };
  nav.addEventListener("pointerup", end);
  nav.addEventListener("pointercancel", end);
}
nav.addEventListener("keydown", ev => {
  const tops = laneTops();
  const step = tops.length > 1 ? tops[1] - tops[0] : 48;
  if (ev.key === "ArrowDown" || ev.key === "ArrowRight") pan += step;
  else if (ev.key === "ArrowUp" || ev.key === "ArrowLeft") pan -= step;
  else if (ev.key === "Home") pan = 0;
  else if (ev.key === "End") pan = lanes.scrollHeight;
  else return;
  apply();
  ev.preventDefault();
});

/* ---------- wiring ---------- */
// phrase/song/selection redraw the ink (a new phrase under the same cells);
// page + resize re-measure the window (0 while the page was display:none)
for (const t of ["song", "phrase", "selection"]) on(t, patch);
on("page", apply);
addEventListener("resize", apply);
patch();
apply();
