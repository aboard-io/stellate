// ui/editor.js — the phrase editor: the 8×16 step grid and the slot rail
// beside it. Both follow the palette's law — BUILT ONCE, then patched. The
// old drawEditor destroyed and rebuilt 136 buttons with fresh listeners on
// every pointermove of a scrub; the cells are now permanent, their listeners
// bind once, and an edit patches textContent/aria-label/class in place.
//
// Layer graph: ui view — imports state/derive/deps and palette (for toggle:
// clicking a slot also toggles the phrase into the focused layer).
import { GENRES, DEFAULT, blank } from "./deps.js";
import { SLOTS, SUBJ, slot, setSlot, putPhrase, curSection, commit, on } from "./state.js";
import { isBlank, focused } from "./derive.js";
import { toggle } from "./palette.js";
import { buzz, pointers } from "./touch.js";
import { openFader, refresh as refreshFader } from "./popfader.js";

const gridEl = document.getElementById("stepgrid");
const slotsEl = document.getElementById("slots");
const edslotEl = document.getElementById("edslot");

/* ---------- the step grid ---------- */
// exported for ui/stepnav.js — the navigator draws the same lanes in the same
// order, and one definition of the row vocabulary is how they stay agreed
export const ROWS = ["deg", "oct", "vel", "inc", "stk", "gate", "acc", "sld"];
export const RANGE = { deg: [-7, 7], oct: [-2, 2], vel: [0, 9], inc: [-3, 3], stk: [-2, 2] };
const clampTo = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));

const cells = {};                          // key -> [16 buttons], alive for ever
function buildGrid() {
  // ONE .prow PER ROW: a label cell and a 16-cell strip. The strip is its own
  // grid, which is the whole trick behind the phone fold: kernel-daw.css
  // drops it from 16 columns to 8 under 560px and auto-placement wraps cells
  // 9–16 into a second rank — two banks of 8 at 44px instead of sixteen
  // 24px slivers, with no JS and no second DOM.
  // The label is TWO lines now — the name and its range ("deg −7…+7") — so
  // the lane under the finger says what it is and how far it goes without a
  // trip to the (?) paragraph.
  const prow = (lab, range, parent) => {
    const r = Object.assign(document.createElement("div"), { className: "prow" });
    const rl = Object.assign(document.createElement("div"), { className: "rowlab" });
    if (lab) {
      rl.append(Object.assign(document.createElement("span"),
        { className: "rname", textContent: lab }));
      rl.append(Object.assign(document.createElement("span"),
        { className: "rrange", textContent: range }));
    }
    r.append(rl);
    const c = Object.assign(document.createElement("div"), { className: "prowcells" });
    r.append(c);
    parent.append(r);
    return c;
  };
  const nums = prow("", "", gridEl);
  for (let i = 0; i < 16; i++) {
    const n = Object.assign(document.createElement("div"),
      { className: "num" + (i % 4 === 0 ? " q" : ""), textContent: String(i + 1) });
    n.dataset.q = String(1 + (i >> 2));      // the numeral wears its quarter's colour
    nums.append(n);
  }
  // THE FOCUS VIEWPORT: the eight lanes live inside .lanesview > .lanes. On a
  // desk both wrappers are inert (no height, no transform) and the grid reads
  // exactly as it always has; under 560px the CSS gives .lanesview a fixed
  // height and ui/stepnav.js pans .lanes with a translateY — ALL 128 cells
  // stay in the DOM, alive and clickable, whichever lanes are showing. The
  // beat-numeral ruler stays OUTSIDE the viewport so it never pans away.
  const view = Object.assign(document.createElement("div"), { className: "lanesview" });
  const lanes = Object.assign(document.createElement("div"), { className: "lanes" });
  view.append(lanes);
  gridEl.append(view);
  for (const key of ROWS) {
    const num0 = RANGE[key];
    const strip = prow(key,
      num0 ? (num0[0] < 0 ? num0[0] + "…+" + num0[1] : num0[0] + "…" + num0[1])
           : "on/off",
      lanes);
    cells[key] = [];
    for (let i = 0; i < 16; i++) {
      const b = document.createElement("button"); b.type = "button";
      // the skin reads these, the code never does: which row a cell sits in
      // and which quarter of the bar — the 909's q1 red / q2 orange / q3 amber
      // / q4 cream lives entirely in CSS off these two attributes
      b.dataset.row = key; b.dataset.q = String(1 + (i >> 2));
      const num = RANGE[key];
      // TWO WAYS INTO A VALUE, both of them one-handed on a phone:
      //   drag   up/down on the cell scrubs it (pointer events, so touch too)
      //   tap    opens the pop-up fader beside the cell (ui/popfader.js) —
      //          which replaced the ± "Tap raises" mode toggle: a tap now
      //          SHOWS the value instead of moving it a remembered direction.
      // The binary rows are unaffected: a toggle has nowhere to go but the
      // other way, so a tap has always been enough there.
      if (num) {
        let from = null, fromX = 0, base = 0, moved = false, wasFine = false;
        b.addEventListener("pointerdown", ev => {
          from = ev.clientY; fromX = ev.clientX;
          base = SUBJ[key][i]; moved = false; wasFine = false;
          try { b.setPointerCapture(ev.pointerId); } catch (e) {}
        });
        b.addEventListener("pointermove", ev => {
          if (from == null) return;
          // FINE MODE (hw.css verb #6): shift, a second finger down anywhere,
          // or walking the pointer >64px sideways — the Elektron "walk away
          // from the knob", and the one that needs no second hand. 70px per
          // step instead of 14. Crossing in or out REBASES the drag so the
          // value under the finger never jumps.
          const fine = ev.shiftKey || pointers() > 1 ||
            Math.abs(ev.clientX - fromX) > 64;
          if (fine !== wasFine) { wasFine = fine; from = ev.clientY; base = SUBJ[key][i]; }
          const step = Math.round((from - ev.clientY) / (fine ? 70 : 14)); // up is more
          if (!step) return;
          const v = clampTo(base + step, num);
          if (v === SUBJ[key][i]) return;
          moved = true; SUBJ[key][i] = v;
          buzz(4);                            // a value landed (rate-limited)
          commit("phrase");
        });
        const end = () => { from = null; };
        b.addEventListener("pointerup", end);
        b.addEventListener("pointercancel", end);
        b.addEventListener("click", () => {
          if (moved) { moved = false; return; }              // that was a scrub
          openFader({
            anchor: b,
            label: key + " · step " + (i + 1),
            min: num[0], max: num[1],
            fmt: key === "vel" ? String : v => (v > 0 ? "+" + v : String(v)),
            get: () => SUBJ[key][i],
            set: v => { SUBJ[key][i] = clampTo(v, num); commit("phrase"); },
          });
        });
      } else {
        b.addEventListener("click", () => {
          SUBJ[key][i] = SUBJ[key][i] ? 0 : 1;
          buzz(4);
          commit("phrase");
        });
      }
      cells[key].push(b);
      strip.append(b);
    }
  }
}
function patchGrid() {
  edslotEl.textContent = "phrase " + (slot + 1);
  // a scrub commits per pointermove and this patches all 128 cells each time;
  // writing only what CHANGED keeps the style recalc to the one cell under
  // the finger instead of the whole grid (an unchanged className write still
  // invalidates the element)
  const put = (b, cls, txt, al) => {
    if (b.className !== cls) b.className = cls;
    if (b.textContent !== txt) b.textContent = txt;
    if (b.getAttribute("aria-label") !== al) b.setAttribute("aria-label", al);
  };
  for (const key of ROWS) {
    const num = RANGE[key];
    for (let i = 0; i < 16; i++) {
      const b = cells[key][i], val = SUBJ[key][i];
      if (num) {
        put(b,
          "cell deg" + (SUBJ.gate[i] ? "" : " rest") + (val === 0 ? " zero" : "") +
            (key === "inc" || key === "stk" ? " ramp" : ""),
          key === "vel" ? String(val) : (val > 0 ? "+" + val : String(val)),
          "step " + (i + 1) + " " + key + " " + val);
      } else {
        put(b,
          "cell" + (val ? " on" : ""),
          val ? "●" : "",
          "step " + (i + 1) + " " + key + (val ? " on" : " off"));
      }
    }
  }
}

/* ---------- phrase slots: click toggles into the box AND opens the editor --- */
// the contour is ONE <svg><path> per pad, not sixteen <i> bars — 8 nodes on
// the rail instead of 128, one attribute write per patch instead of 32 style
// writes, and the picture survives the pad's moulded material
const SVGNS = "http://www.w3.org/2000/svg";
const slotEls = [];                        // { b, sn, line: <path> }
function buildSlots() {
  SLOTS.forEach((p, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "slot";
    const sn = Object.assign(document.createElement("span"), { className: "sn" });
    const mini = document.createElementNS(SVGNS, "svg");
    mini.setAttribute("class", "mini");
    mini.setAttribute("viewBox", "0 0 64 26");
    mini.setAttribute("preserveAspectRatio", "none");
    mini.setAttribute("aria-hidden", "true");
    const line = document.createElementNS(SVGNS, "path");
    mini.append(line);
    b.append(sn, mini);
    b.addEventListener("click", () => {
      setSlot(i);
      toggle("phrase", i);              // toggle() commits, which saves
      commit("selection");
    });
    slotEls.push({ b, sn, line });
    slotsEl.append(b);
  });
}
// gated steps become line segments, rests become gaps: M starts a run, L
// continues it. deg −7..+7 maps top-to-bottom into the 26-unit viewBox.
function contourPath(p) {
  const runs = [];
  let run = null;
  for (let k = 0; k < 16; k++) {
    if (!p.gate[k]) { run = null; continue; }
    const x = k * 4 + 2, y = (23 - ((p.deg[k] + 7) / 14) * 20).toFixed(1);
    if (!run) runs.push(run = []);
    run.push(x + " " + y);
  }
  // a lone gate still needs ink: a zero-length segment renders as a dot
  // under the round linecap, but only if there IS a segment
  return runs.map(r => "M" + r.join(" L") + (r.length === 1 ? " L" + r[0] : "")).join(" ");
}
function patchSlots() {
  const sec = curSection(), ent = focused(sec);
  SLOTS.forEach((p, i) => {
    const s = slotEls[i], inBox = ent.slots.includes(i);
    s.b.className = "slot" + (i === slot ? " sel" : "") + (inBox ? " inbox" : "");
    s.b.setAttribute("aria-pressed", String(inBox));
    s.b.setAttribute("aria-label", "phrase " + (i + 1) + (isBlank(p) ? ", empty" : ", filled") +
      (inBox ? ", in " + GENRES[ent.g].label : ""));
    s.sn.textContent = (i + 1) + (isBlank(p) ? "" : " •");
    const d = contourPath(p);
    if (s.line.getAttribute("d") !== d) s.line.setAttribute("d", d);
  });
}

/* ---------- the header buttons ---------- */
function randomPhrase() {
  const r = n => Math.floor(Math.random() * n), p = blank();
  for (let i = 0; i < 16; i++) {
    p.deg[i] = r(11) - 3;
    p.oct[i] = r(8) === 0 ? -1 : r(5) === 0 ? 1 : 0;
    p.gate[i] = r(10) < 7 ? 1 : 0;
    p.acc[i] = p.gate[i] && r(10) < 3 ? 1 : 0;
    p.sld[i] = p.gate[i] && r(10) < 2 ? 1 : 0;
    p.vel[i] = p.acc[i] ? 8 + r(2) : 3 + r(5);
    p.inc[i] = r(12) === 0 ? (r(2) ? 1 : -1) : 0;   // a ramp on the odd step, not everywhere
  }
  return p;
}
const put = make => () => { putPhrase(slot, make()); commit("phrase"); };
document.getElementById("seed").addEventListener("click", put(() => structuredClone(DEFAULT)));
document.getElementById("rnd").addEventListener("click", put(randomPhrase));
document.getElementById("clear").addEventListener("click", put(blank));
// the (?) key: the how-to paragraph, off by default — the editor no longer
// spends three lines of a phone screen teaching before it shows the grid
{
  const b = document.getElementById("edhelp"), p = document.getElementById("edhint");
  b.addEventListener("click", () => {
    p.hidden = !p.hidden;
    b.setAttribute("aria-expanded", String(!p.hidden));
  });
}

/* ---------- wiring ---------- */
buildGrid();
buildSlots();
// refreshFader: an open fader shows a live value, and a song load or a second
// finger scrubbing the same cell must move its LCD too
function patch() { patchGrid(); patchSlots(); refreshFader(); }
for (const t of ["song", "phrase", "box", "selection"]) on(t, patch);
