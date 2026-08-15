// ui/editor.js — the phrase editor: the 16×8 TRACKER TABLE and the slot rail
// under it. Both follow the palette's law — BUILT ONCE, then patched. The
// old drawEditor destroyed and rebuilt 136 buttons with fresh listeners on
// every pointermove of a scrub; the cells are now permanent, their listeners
// bind once, and an edit patches textContent/aria-label/class in place.
//
// THE TABLE IS THE ONLY LAYOUT, at every width (Paul's standing law: "Don't
// go left to right go top to bottom. Make them tables… like mod trackers.").
// The desk's lane grid — 16 steps running left to right, one row per vector —
// is GONE, and with it the <560px CSS transpose that used to fake the rotation
// with display:contents and sixteen :nth-child rules. The DOM is now built in
// tracker order to begin with: one row per 16th, one column per vector, which
// is both the picture and the ARIA. A wider screen gets a ROOMIER table —
// taller rows, wider columns, the ramp columns out of their latch — never a
// different one.
//
// Layer graph: ui view — imports state/derive/deps and palette (for toggle:
// clicking a slot also toggles the phrase into the focused layer).
import { GENRES, DEFAULT, blank, NSLOTS } from "./deps.js";
import { SLOTS, SONG, SUBJ, slot, setSlot, putPhrase, curSection, commit, on,
         emit } from "./state.js";
import { isBlank, focused, contourPath } from "./derive.js";
import { toggle } from "./palette.js";
import { buzz, pointers } from "./touch.js";
import { openFader, refresh as refreshFader } from "./popfader.js";

const gridEl = document.getElementById("stepgrid");
const slotsEl = document.getElementById("slots");
const edslotEl = document.getElementById("edslot");

/* ---------- the step grid ---------- */
// the vector vocabulary, exported: the order here is the COLUMN order of the
// tracker table at every width — one definition
export const ROWS = ["deg", "oct", "vel", "inc", "stk", "gate", "acc", "sld"];
export const RANGE = { deg: [-7, 7], oct: [-2, 2], vel: [0, 9], inc: [-3, 3], stk: [-2, 2] };
const clampTo = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));

const cells = {};                          // key -> [16 buttons], alive for ever
function buildGrid() {
  // ONE .prow PER 16TH, plus a header row of column labels. #stepgrid is the
  // grid; every .prow is display:contents, so its children ARE the grid items
  // and AUTO-PLACEMENT does the rest — each row contributes exactly one cell
  // per visible column, so the columns line up with no explicit placement at
  // all. Hiding the two ramp columns (the RAMP latch below) simply removes a
  // cell from every row and the table narrows by one column.
  //
  // The ARIA now reads exactly as the picture does: rows are 16ths, headed by
  // their step numeral; the vectors are columnheaders. The cells' own
  // aria-labels ("step N deg V") are unchanged — they were always the step
  // identity, and the audio gate reads them by name.
  // .thd is the shared TABLE header (kernel-daw.css): every table on the
  // machine — pattern, song, arrangement, palette bank — wears the same
  // silkscreen, the same rule and the same sticky top. .rowlab adds only the
  // two-line name/range stack this table's columns need.
  const label = (key) => {
    const rl = Object.assign(document.createElement("div"), { className: "rowlab thd" });
    const num = RANGE[key];
    rl.dataset.row = key;                  // the skin's column hook (ramp latch)
    rl.setAttribute("role", "columnheader");
    rl.append(Object.assign(document.createElement("span"),
      { className: "rname", textContent: key }));
    // the second line is the range ("−7…+7"): the column says what it is AND
    // how far it goes. Narrow screens drop it; the desk has the room.
    rl.append(Object.assign(document.createElement("span"),
      { className: "rrange", textContent: num
        ? (num[0] < 0 ? num[0] + "…+" + num[1] : num[0] + "…" + num[1]) : "on/off" }));
    return rl;
  };
  gridEl.setAttribute("role", "grid");
  gridEl.setAttribute("aria-label", "step pattern");
  const head = Object.assign(document.createElement("div"), { className: "prow" });
  head.setAttribute("role", "row");
  const corner = Object.assign(document.createElement("div"),
    { className: "rowlab thd corner", textContent: "st" });
  corner.setAttribute("role", "columnheader");
  corner.setAttribute("aria-label", "step");
  head.append(corner);
  for (const key of ROWS) head.append(label(key));
  gridEl.append(head);

  for (const key of ROWS) cells[key] = [];
  for (let i = 0; i < 16; i++) {
    // the beat ruling is a CLASS, not a :nth-child rule: every fourth row is
    // the head of a quarter and the whole table rules across it
    const r = Object.assign(document.createElement("div"),
      { className: "prow" + (i % 4 === 0 ? " beat" : "") });
    r.setAttribute("role", "row");
    r.dataset.step = String(i + 1);
    // .tnum is the shared numeral column — the step here, the tick in the
    // arrangement, the section number in the song: one material for "which
    // row is this"
    const n = Object.assign(document.createElement("div"),
      { className: "num tnum" + (i % 4 === 0 ? " q" : ""), textContent: String(i + 1) });
    n.dataset.q = String(1 + (i >> 2));      // the row's quarter lamp (CSS reads it)
    n.setAttribute("role", "rowheader");
    r.append(n);
    for (const key of ROWS) {
      const b = document.createElement("button"); b.type = "button";
      // the skin reads these, the code never does: which COLUMN a cell sits in
      // and which quarter of the bar — the 909's q1 red / q2 orange / q3 amber
      // / q4 cream lives entirely in CSS off these two attributes. data-row is
      // also what the RAMP latch hides and shows.
      b.dataset.row = key; b.dataset.q = String(1 + (i >> 2));
      b.setAttribute("role", "gridcell");  // still a <button>: Enter/Space work
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
      cells[key][i] = b;
      r.append(b);
    }
    gridEl.append(r);
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
// the contour is ONE <svg><path> per pad, not sixteen <i> bars — one node per
// pad on the rail instead of sixteen, one attribute write per patch instead
// of 32 style writes, and the picture survives the pad's moulded material.
//
// THE BANK IS VARIABLE now (1..NSLOTS, fields.js): the rail shows the
// phrases the SONG has, then [+] to grow it and [−] to take the last one
// back. So the rail is rebuilt whenever the bank's SIZE moves (patch()
// below compares lengths) — a size change is rare and structural, exactly
// the case the built-once law carves out, and every cell listener still
// binds once per build.
const SVGNS = "http://www.w3.org/2000/svg";
const slotEls = [];                        // { b, sn, line: <path> }
// the two bank keys, built ONCE and re-appended after every rail rebuild
const addKey = (() => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "slotadd"; b.id = "slotadd"; b.textContent = "+";
  b.title = "add a phrase (up to " + NSLOTS + ")";
  b.setAttribute("aria-label", "add a phrase");
  b.addEventListener("click", () => {
    if (SLOTS.length >= NSLOTS) return;    // the key is hidden at the cap anyway
    SLOTS.push(blank());
    setSlot(SLOTS.length - 1);             // the new phrase opens in the editor
    commit("phrase"); commit("selection");
  });
  return b;
})();
// DELETION IS LAST-SLOT-ONLY, and refused while anything plays it. Slots are
// referenced BY INDEX from every stack entry in the song, so removing a
// middle slot would renumber everything after it — every box quietly playing
// a different phrase than the one it was built on. Popping the tail renumbers
// nothing; the guard below is the readout saying WHY when the tail is in use.
const dropKey = (() => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "slotadd"; b.id = "slotdrop"; b.textContent = "−";
  b.title = "remove the last phrase (only when no box plays it)";
  b.setAttribute("aria-label", "remove the last phrase");
  b.addEventListener("click", () => {
    const last = SLOTS.length - 1;
    if (last < 1) return;                  // hidden at one slot anyway
    const holders = [];
    SONG.forEach((sec, i) => {
      if ((sec.stack || []).some(e => e.slots.includes(last))) holders.push(i + 1);
    });
    if (holders.length) {
      emit("status", { text: "phrase " + (last + 1) + " is switched on in box " +
        holders.join(", ") + " — take it off there first", sticky: true });
      return;
    }
    SLOTS.pop();
    if (slot > SLOTS.length - 1) setSlot(SLOTS.length - 1);
    commit("phrase"); commit("selection");
  });
  return b;
})();
function buildSlots() {
  slotEls.length = 0;
  slotsEl.textContent = "";                // the keys survive: appended below
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
  slotsEl.append(addKey, dropKey);
}
// the contour itself is ui/derive.js's contourPath — the song row's phrase
// chips draw the same picture, and one drawing routine is the only way the
// pad and the chip can agree about what a phrase looks like
function patchSlots() {
  const sec = curSection(), ent = focused(sec);
  addKey.hidden = SLOTS.length >= NSLOTS;  // full bank: the key goes, not grey
  dropKey.hidden = SLOTS.length <= 1;      // the bank keeps its last phrase
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
// the (?) keys: a how-to paragraph, off by default — a panel no longer spends
// three lines of a phone screen teaching before it shows its controls. One
// pattern (.btn.hint toggling an .edhint), one spot (right after the panel's
// h2), here and on the SONG page (ui/chrome.js wires that one).
export function hintKey(btnId, pId) {
  const b = document.getElementById(btnId), p = document.getElementById(pId);
  b.addEventListener("click", () => {
    p.hidden = !p.hidden;
    b.setAttribute("aria-expanded", String(!p.hidden));
  });
}
hintKey("edhelp", "edhint");
hintKey("phrhelp", "phrhint");            // the phrase rail's own paragraph
// THE RAMP KEY (narrow only — the CSS hides it ≥900px): the tracker table
// shows deg/oct/vel plus the binary trio by default; inc and stk are the two
// columns most phrases never touch, so under 900px they sit behind this latch
// rather than squeezing every row nine-wide. One attribute on the grid; the
// CSS shows the two columns and the table re-flows. A desk has the room for
// all eight vectors, so the ramp columns are always out there and the latch
// has nothing to do.
{
  const b = document.getElementById("ramptog");
  b.addEventListener("click", () => {
    const on = gridEl.toggleAttribute("data-ramp");
    b.setAttribute("aria-pressed", String(on));
  });
}

/* ---------- wiring ---------- */
buildGrid();
buildSlots();
// refreshFader: an open fader shows a live value, and a song load or a second
// finger scrubbing the same cell must move its LCD too. The slot rail is
// REBUILT first whenever the bank's size moved (add/drop/load) — the only
// structural change the phrase surface has.
function patch() {
  if (slotEls.length !== SLOTS.length) buildSlots();
  patchGrid(); patchSlots(); refreshFader();
}
for (const t of ["song", "phrase", "box", "selection"]) on(t, patch);
