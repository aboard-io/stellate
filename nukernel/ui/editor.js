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

const gridEl = document.getElementById("stepgrid");
const slotsEl = document.getElementById("slots");
const edslotEl = document.getElementById("edslot");

/* ---------- the step grid ---------- */
const ROWS = ["deg", "oct", "vel", "inc", "stk", "gate", "acc", "sld"];
// WHICH WAY A TAP MOVES A VALUE. The ± button in the editor header rides this,
// and it exists because shift-click does not exist on a phone. (Named
// tapDirection because `stepDir` sat one typo away from `stepDur`, the audio
// clock's step length — a UI toggle and a scheduling constant should not be
// distinguishable by one character.)
let tapDirection = 1;
const RANGE = { deg: [-7, 7], oct: [-2, 2], vel: [0, 9], inc: [-3, 3], stk: [-2, 2] };
const clampTo = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));

const cells = {};                          // key -> [16 buttons], alive for ever
function buildGrid() {
  gridEl.append(Object.assign(document.createElement("div"), { className: "rowlab" }));
  for (let i = 0; i < 16; i++)
    gridEl.append(Object.assign(document.createElement("div"),
      { className: "num" + (i % 4 === 0 ? " q" : ""), textContent: String(i + 1) }));
  for (const key of ROWS) {
    gridEl.append(Object.assign(document.createElement("div"),
      { className: "rowlab", textContent: key }));
    cells[key] = [];
    for (let i = 0; i < 16; i++) {
      const b = document.createElement("button"); b.type = "button";
      const num = RANGE[key];
      // SHIFT-CLICK IS NOT A GESTURE ON A PHONE. It was the only way to lower a
      // value, so half of the phrase editor was unreachable on touch — you could
      // raise a degree and never put it back. Three ways in now, and all three
      // work everywhere:
      //   drag       up/down on a cell scrubs it (pointer events, so touch too)
      //   tap        moves it by the ± toggle in the header
      //   shift-tap  inverts that, for the keyboard-and-mouse habit
      // The binary rows are unaffected: a toggle has nowhere to go but the other
      // way, so a tap has always been enough.
      if (num) {
        let from = null, base = 0, moved = false;
        b.addEventListener("pointerdown", ev => {
          from = ev.clientY; base = SUBJ[key][i]; moved = false;
          try { b.setPointerCapture(ev.pointerId); } catch (e) {}
        });
        b.addEventListener("pointermove", ev => {
          if (from == null) return;
          const step = Math.round((from - ev.clientY) / 14);   // up is more
          if (!step) return;
          const v = clampTo(base + step, num);
          if (v === SUBJ[key][i]) return;
          moved = true; SUBJ[key][i] = v;
          commit("phrase");
        });
        const end = () => { from = null; };
        b.addEventListener("pointerup", end);
        b.addEventListener("pointercancel", end);
        b.addEventListener("click", ev => {
          if (moved) { moved = false; return; }              // that was a scrub
          SUBJ[key][i] = clampTo(SUBJ[key][i] +
            (ev.shiftKey ? -tapDirection : tapDirection), num);
          commit("phrase");
        });
      } else {
        b.addEventListener("click", () => {
          SUBJ[key][i] = SUBJ[key][i] ? 0 : 1;
          commit("phrase");
        });
      }
      cells[key].push(b);
      gridEl.append(b);
    }
  }
}
function patchGrid() {
  edslotEl.textContent = "phrase " + (slot + 1);
  for (const key of ROWS) {
    const num = RANGE[key];
    for (let i = 0; i < 16; i++) {
      const b = cells[key][i], val = SUBJ[key][i];
      if (num) {
        b.className = "cell deg" + (SUBJ.gate[i] ? "" : " rest") + (val === 0 ? " zero" : "") +
          (key === "inc" || key === "stk" ? " ramp" : "");
        b.textContent = key === "vel" ? String(val) : (val > 0 ? "+" + val : String(val));
        b.setAttribute("aria-label", "step " + (i + 1) + " " + key + " " + val);
      } else {
        b.className = "cell" + (val ? " on" : "");
        b.textContent = val ? "●" : "";
        b.setAttribute("aria-label", "step " + (i + 1) + " " + key + (val ? " on" : " off"));
      }
    }
  }
}

/* ---------- phrase slots: click toggles into the box AND opens the editor --- */
const slotEls = [];                        // { b, sn, bars: [16 <i>] }
function buildSlots() {
  SLOTS.forEach((p, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "slot";
    const sn = Object.assign(document.createElement("span"), { className: "sn" });
    const mini = document.createElement("span"); mini.className = "mini";
    const bars = [];
    for (let k = 0; k < 16; k++) { const c = document.createElement("i"); bars.push(c); mini.append(c); }
    b.append(sn, mini);
    b.addEventListener("click", () => {
      setSlot(i);
      toggle("phrase", i);              // toggle() commits, which saves
      commit("selection");
    });
    slotEls.push({ b, sn, bars });
    slotsEl.append(b);
  });
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
    for (let k = 0; k < 16; k++) {
      const c = s.bars[k];
      if (p.gate[k]) {
        c.className = "on";
        c.style.height = (18 + (p.deg[k] + 7) / 14 * 60) + "%";
        c.style.opacity = String(0.35 + (p.vel[k] / 9) * 0.65);
      } else { c.className = ""; c.style.height = ""; c.style.opacity = ""; }
    }
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
{
  const b = document.getElementById("stepdir");
  b.addEventListener("click", () => {
    tapDirection = -tapDirection;
    b.textContent = tapDirection > 0 ? "Tap raises" : "Tap lowers";
    b.setAttribute("aria-pressed", String(tapDirection < 0));
  });
}

/* ---------- wiring ---------- */
buildGrid();
buildSlots();
function patch() { patchGrid(); patchSlots(); }
for (const t of ["song", "phrase", "box", "selection"]) on(t, patch);
