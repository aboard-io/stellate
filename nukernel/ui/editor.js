// ui/editor.js — the phrase editor as a MODAL POPUP: a bottom sheet under
// 900px, a centred dialog over it, opened by openPhraseEditor() and never a
// page. The STEP page is gone (2026-08-15, "the row and the board"): the
// editor is reached from the thing being edited — a phrase chip on a song
// row, the row sheet's phrases key — instead of being a rail destination
// that edited a phrase the selected box was not on screen for. The popup
// carries everything the page carried: the 16-row tracker, Seed/Random/
// Clear, the (?) paragraph, and the phrase bank rail with [+]/[−].
//
// The table itself follows the palette's law — BUILT ONCE, then patched.
// The cells are permanent, their listeners bind once, and an edit patches
// class/label/bar in place; the popup opening is hidden=false, never a build.
//
// MUCH TIGHTER THAN THE PAGE WAS. Two moves paid for it:
//   COLUMN ORDER  gate acc sld FIRST, then deg oct vel inc stk — the groove
//     keys under the step numeral where a 303's row starts, the values after.
//   BARS, NOT NUMERALS. A value cell draws its value as a bar — zero-centred
//     for the bipolar vectors (deg/oct/inc/stk fill from the midline), from
//     the floor for vel — with a small numeral riding the bar where it fits.
//     A bar reads at any cell size; a three-digit numeral is what forced the
//     44px columns. All eight vectors now fit a 360px phone, so the RAMP
//     latch (which existed to hide inc/stk under 900px) has nothing left to
//     hide and is gone.
//
// Layer graph: ui view — imports state/derive/deps and palette (for toggle:
// clicking a slot also toggles the phrase into the focused layer).
import { GENRES, DEFAULT, blank, NSLOTS } from "./deps.js";
import { SLOTS, SONG, SUBJ, slot, setSlot, putPhrase, curSection, commit, on,
         emit } from "./state.js";
import { isBlank, focused, contourPath } from "./derive.js";
import { toggle } from "./palette.js";
import { buzz, pointers } from "./touch.js";
import { openFader, refresh as refreshFader, shut as shutFader,
         isOpen as faderOpen } from "./popfader.js";

/* ---------- the popup shell ---------- */
// Built HERE, not in kernel-daw.html: the page section went with the page.
// The ids the page carried (#stepgrid #slots #seed #rnd #clear #edslot
// #edhelp/#edhint #phrhelp/#phrhint) are kept on the popup's own elements —
// they are gate-read and the (?) wiring below reads them by id.
const mk = (tag, cls, txt) => {
  const n = document.createElement(tag);
  n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};
const key = (id, cls, label, title) => {
  const b = mk("button", cls);
  b.type = "button"; b.id = id; b.title = title;
  b.append(Object.assign(document.createElement("span"),
    { className: "k" }), Object.assign(document.createElement("span"),
    { className: "t", textContent: label }));
  b.querySelector(".k").setAttribute("aria-hidden", "true");
  return b;
};
const scrim = Object.assign(mk("div", "edscrim"), { hidden: true });
const pop = Object.assign(mk("div", "edpop"), { hidden: true, id: "edpop" });
pop.setAttribute("role", "dialog");
pop.setAttribute("aria-modal", "true");
pop.setAttribute("aria-label", "phrase editor");

const head = mk("div", "edhead");
const h2 = mk("h2", "", "Editing ");
const edslotEl = Object.assign(mk("span", "", "phrase 1"), { id: "edslot" });
h2.append(edslotEl);
const helpBtn = mk("button", "btn hint", "?");
helpBtn.type = "button"; helpBtn.id = "edhelp"; helpBtn.title = "how to edit";
helpBtn.setAttribute("aria-expanded", "false");
helpBtn.setAttribute("aria-controls", "edhint");
const seedBtn = key("seed", "btn ik ik-seed", "Seed", "write the starter phrase");
const rndBtn = key("rnd", "btn ik ik-rnd", "Random", "roll a random phrase");
const clearBtn = key("clear", "btn ik ik-clear", "Clear", "empty this phrase");
const closeBtn = mk("button", "rpk edx", "✕");
closeBtn.type = "button";
closeBtn.setAttribute("aria-label", "close the phrase editor");
head.append(h2, helpBtn, mk("span", "spacer"), seedBtn, rndBtn, clearBtn, closeBtn);

const hint = Object.assign(mk("p", "edhint"), { id: "edhint", hidden: true });
hint.innerHTML = "Tap a value cell for its fader, or drag up and down on it " +
  "to scrub — sideways (or a second finger) for fine. Tap a gate/acc/sld key " +
  "to flip it. The pattern reads top to bottom like a tracker: every numbered " +
  "row is a 16th, the switches come first — <b>gate</b>, the 303 <b>acc</b>ent, " +
  "<b>sld</b> — then the value columns, each drawn as a bar (the middle line " +
  "is zero; <b>vel</b> fills from the floor). Phrases below: tap one to edit " +
  "it and switch it on or off in the selected box; [+] adds a phrase, [−] " +
  "removes the last one.";

const stepsWell = mk("div", "steps tbl");
const gridEl = Object.assign(mk("div", "stepgrid"), { id: "stepgrid" });
stepsWell.append(gridEl);

const phHead = mk("div", "edhead phrases-head");
phHead.append(mk("h2", "", "Phrases"));
const phHelp = mk("button", "btn hint", "?");
phHelp.type = "button"; phHelp.id = "phrhelp";
phHelp.title = "how the phrase bank works";
phHelp.setAttribute("aria-expanded", "false");
phHelp.setAttribute("aria-controls", "phrhint");
phHead.append(phHelp);
const phHint = Object.assign(mk("p", "edhint phrases-head", "Click one to " +
  "edit it and switch it on or off in the selected box. [+] adds a phrase " +
  "(up to 16); [−] removes the last one when no box plays it."),
  { id: "phrhint", hidden: true });
const slotsEl = Object.assign(mk("div", "slots tbl"), { id: "slots" });

pop.append(head, hint, stepsWell, phHead, phHint, slotsEl);
document.body.append(scrim, pop);

/* ---------- the step grid ---------- */
// the vector vocabulary, exported: the order here is the COLUMN order of the
// tracker table — one definition. The switches lead, the values follow.
export const ROWS = ["gate", "acc", "sld", "deg", "oct", "vel", "inc", "stk"];
export const RANGE = { deg: [-7, 7], oct: [-2, 2], vel: [0, 9], inc: [-3, 3], stk: [-2, 2] };
const clampTo = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));

const cells = {};                          // key -> [16 {b,bar,cv}], alive for ever
function buildGrid() {
  // ONE .prow PER 16TH, plus a header row of column labels. #stepgrid is the
  // grid; every .prow is display:contents, so its children ARE the grid items
  // and AUTO-PLACEMENT does the rest — each row contributes exactly one cell
  // per column, so the columns line up with no explicit placement at all.
  //
  // The ARIA reads exactly as the picture does: rows are 16ths, headed by
  // their step numeral; the vectors are columnheaders. The cells' own
  // aria-labels ("step N deg V") are unchanged — they were always the step
  // identity, and the audio gate reads them by name.
  // .thd is the shared TABLE header (kernel-daw.css): every table on the
  // machine wears the same silkscreen, the same rule and the same sticky top.
  const label = (key2) => {
    const rl = Object.assign(document.createElement("div"), { className: "rowlab thd" });
    const num = RANGE[key2];
    rl.dataset.row = key2;                 // the skin's column hook
    rl.setAttribute("role", "columnheader");
    rl.append(Object.assign(document.createElement("span"),
      { className: "rname", textContent: key2 }));
    // the second line is the range ("−7…+7"): the column says what it is AND
    // how far it goes. Narrow screens drop it; the desk dialog has the room.
    rl.append(Object.assign(document.createElement("span"),
      { className: "rrange", textContent: num
        ? (num[0] < 0 ? num[0] + "…+" + num[1] : num[0] + "…" + num[1]) : "on/off" }));
    return rl;
  };
  gridEl.setAttribute("role", "grid");
  gridEl.setAttribute("aria-label", "step pattern");
  const headRow = Object.assign(document.createElement("div"), { className: "prow" });
  headRow.setAttribute("role", "row");
  const corner = Object.assign(document.createElement("div"),
    { className: "rowlab thd corner", textContent: "st" });
  corner.setAttribute("role", "columnheader");
  corner.setAttribute("aria-label", "step");
  headRow.append(corner);
  for (const key2 of ROWS) headRow.append(label(key2));
  gridEl.append(headRow);

  for (const key2 of ROWS) cells[key2] = [];
  for (let i = 0; i < 16; i++) {
    // the beat ruling is a CLASS, not a :nth-child rule: every fourth row is
    // the head of a quarter and the whole table rules across it
    const r = Object.assign(document.createElement("div"),
      { className: "prow" + (i % 4 === 0 ? " beat" : "") });
    r.setAttribute("role", "row");
    r.dataset.step = String(i + 1);
    // .tnum is the shared numeral column — the step here, the section number
    // in the song: one material for "which row is this"
    const n = Object.assign(document.createElement("div"),
      { className: "num tnum" + (i % 4 === 0 ? " q" : ""), textContent: String(i + 1) });
    n.dataset.q = String(1 + (i >> 2));      // the row's quarter lamp (CSS reads it)
    n.setAttribute("role", "rowheader");
    r.append(n);
    for (const key2 of ROWS) {
      const b = document.createElement("button"); b.type = "button";
      // the skin reads these, the code never does: which COLUMN a cell sits in
      // and which quarter of the bar — the 909's q1 red / q2 orange / q3 amber
      // / q4 cream lives entirely in CSS off these two attributes.
      b.dataset.row = key2; b.dataset.q = String(1 + (i >> 2));
      b.setAttribute("role", "gridcell");  // still a <button>: Enter/Space work
      const num = RANGE[key2];
      // TWO WAYS INTO A VALUE, both of them one-handed on a phone:
      //   drag   up/down on the cell scrubs it (pointer events, so touch too)
      //   tap    opens the pop-up fader beside the cell (ui/popfader.js) —
      //          a tap SHOWS the value instead of moving it a remembered
      //          direction.
      // The binary rows are unaffected: a toggle has nowhere to go but the
      // other way, so a tap has always been enough there.
      let bar = null, cv = null;
      if (num) {
        // THE BAR IS THE VALUE. .cbar (not .bar — that class is the transport
        // panel) is an absolute strip whose --b/--h the patch writes; .cv is
        // the small numeral that rides it where the CSS finds room. The
        // aria-label stays the machine-readable truth.
        bar = Object.assign(document.createElement("i"), { className: "cbar" });
        cv = Object.assign(document.createElement("b"), { className: "cv" });
        bar.setAttribute("aria-hidden", "true");
        cv.setAttribute("aria-hidden", "true");
        b.append(bar, cv);
        let from = null, fromX = 0, base = 0, moved = false, wasFine = false;
        b.addEventListener("pointerdown", ev => {
          from = ev.clientY; fromX = ev.clientX;
          base = SUBJ[key2][i]; moved = false; wasFine = false;
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
          if (fine !== wasFine) { wasFine = fine; from = ev.clientY; base = SUBJ[key2][i]; }
          const step = Math.round((from - ev.clientY) / (fine ? 70 : 14)); // up is more
          if (!step) return;
          const v = clampTo(base + step, num);
          if (v === SUBJ[key2][i]) return;
          moved = true; SUBJ[key2][i] = v;
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
            label: key2 + " · step " + (i + 1),
            min: num[0], max: num[1],
            fmt: key2 === "vel" ? String : v => (v > 0 ? "+" + v : String(v)),
            get: () => SUBJ[key2][i],
            set: v => { SUBJ[key2][i] = clampTo(v, num); commit("phrase"); },
          });
        });
      } else {
        b.addEventListener("click", () => {
          SUBJ[key2][i] = SUBJ[key2][i] ? 0 : 1;
          buzz(4);
          commit("phrase");
        });
      }
      cells[key2][i] = { b, bar, cv };
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
  const put = (b, cls, al) => {
    if (b.className !== cls) b.className = cls;
    if (b.getAttribute("aria-label") !== al) b.setAttribute("aria-label", al);
  };
  for (const key2 of ROWS) {
    const num = RANGE[key2];
    for (let i = 0; i < 16; i++) {
      const c = cells[key2][i], val = SUBJ[key2][i];
      if (num) {
        // the bar's geometry, as two custom properties the CSS positions by:
        // vel fills from the floor; the bipolar four fill from the midline,
        // up for +, down for −. Height 0 at zero — the midline hairline is
        // what says "zero", not an invisible sliver.
        let b0, h0;
        if (key2 === "vel") { h0 = val / num[1] * 100; b0 = 0; }
        else { h0 = Math.abs(val) / num[1] * 50; b0 = val >= 0 ? 50 : 50 - h0; }
        const bs = b0.toFixed(1) + "%", hs = h0.toFixed(1) + "%";
        if (c.b.style.getPropertyValue("--b") !== bs) c.b.style.setProperty("--b", bs);
        if (c.b.style.getPropertyValue("--h") !== hs) c.b.style.setProperty("--h", hs);
        const txt = key2 === "vel" ? String(val) : (val > 0 ? "+" + val : String(val));
        if (c.cv.textContent !== txt) c.cv.textContent = txt;
        put(c.b,
          "cell deg" + (key2 === "vel" ? "" : " bip") +
            (SUBJ.gate[i] ? "" : " rest") + (val === 0 ? " zero" : ""),
          "step " + (i + 1) + " " + key2 + " " + val);
      } else {
        if (c.b.textContent !== (val ? "●" : "")) c.b.textContent = val ? "●" : "";
        put(c.b,
          "cell" + (val ? " on" : ""),
          "step " + (i + 1) + " " + key2 + (val ? " on" : " off"));
      }
    }
  }
}

/* ---------- phrase slots: click toggles into the box AND selects it ------- */
// the contour is ONE <svg><path> per pad, not sixteen <i> bars — one node per
// pad on the rail instead of sixteen, one attribute write per patch instead
// of 32 style writes, and the picture survives the pad's moulded material.
//
// THE BANK IS VARIABLE (1..NSLOTS, fields.js): the rail shows the
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
seedBtn.addEventListener("click", put(() => structuredClone(DEFAULT)));
rndBtn.addEventListener("click", put(randomPhrase));
clearBtn.addEventListener("click", put(blank));
// the (?) keys: a how-to paragraph, off by default. One pattern (.btn.hint
// toggling an .edhint), one spot (right after the panel's h2), here and on
// the SONG page (ui/chrome.js wires that one).
export function hintKey(btnId, pId) {
  const b = document.getElementById(btnId), p = document.getElementById(pId);
  b.addEventListener("click", () => {
    p.hidden = !p.hidden;
    b.setAttribute("aria-expanded", String(!p.hidden));
  });
}
hintKey("edhelp", "edhint");
hintKey("phrhelp", "phrhint");            // the phrase rail's own paragraph

/* ---------- open / shut ---------- */
// ONE way in: openPhraseEditor — from a song row's PATTERN chips, and from
// the trailing [+] cell that grows the bank into the box (ui/songrow.js).
// Takes a slot index or { slot }; with neither it opens on the current slot.
// Dismiss: ✕ / scrim / Esc; auto-close on a page switch and on a whole new
// song — the same rules the cell popup follows, because it is the same kind
// of thing one level down.
let isOpen = false;
export function openPhraseEditor(opts) {
  const si = typeof opts === "number" ? opts
    : opts && opts.slot != null ? opts.slot : null;
  if (si != null && SLOTS[si]) setSlot(si);
  isOpen = true;
  scrim.hidden = false; pop.hidden = false;
  commit("selection");                     // the slot may have moved; every rail
                                           // (this one included) repaints off it
  closeBtn.focus({ preventScroll: true });
  buzz(4);
}
export function closePhraseEditor() {
  if (!isOpen) return;
  isOpen = false;
  if (faderOpen()) shutFader();            // no fader floating over a shut sheet
  pop.hidden = true; scrim.hidden = true;
}
export const phraseEditorOpen = () => isOpen;
closeBtn.addEventListener("click", closePhraseEditor);
scrim.addEventListener("click", closePhraseEditor);
addEventListener("keydown", ev => {
  if (!isOpen || ev.key !== "Escape") return;
  if (faderOpen()) return;                 // the fader's own Esc goes first
  closePhraseEditor(); ev.preventDefault();
});
on("page", closePhraseEditor);             // the rail moved: new subject
on("song", closePhraseEditor);             // a whole new song

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
