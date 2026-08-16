// ui/editor.js — the phrase editor as THE COMPOSE PAGE ("compose, arrange,
// mix", 2026-08-16). The modal died: the editor is a full page again, one of
// the rail's three verbs, and openPhraseEditor() is now a NAVIGATION — it
// loads the phrase and switches the deck to Compose (on a desk, where every
// page is visible, it just scrolls the panel into view). Reached from the
// rail, from a PATTERN thumbnail on an Arrange row, or from a row's [+].
// The page carries everything the modal carried: the 16-row tracker, Seed/
// Random/Clear, the (?) paragraphs, and the phrase bank with [+]/[−] — laid
// out with a page's room instead of a dialog's crouch.
//
// The table itself follows the palette's law — BUILT ONCE, then patched.
// The cells are permanent, their listeners bind once, and an edit patches
// class/label/bar in place; "opening" is one data-page attribute write.
//
// The modal-era column moves survive, because they were right anyway:
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
// Layer graph: ui view — imports state/derive/deps, palette (for toggle:
// clicking a slot also toggles the phrase into the focused layer) and pages
// (setPage IS the open verb now).
import { GENRES, DEFAULT, blank, NSLOTS } from "./deps.js";
import { SLOTS, SONG, SUBJ, slot, setSlot, putPhrase, curSection, commit, on,
         emit } from "./state.js";
import { isBlank, focused } from "./derive.js";
import { toggle } from "./palette.js";
import { buzz, pointers } from "./touch.js";
import { setPage } from "./pages.js";
import { openFader, refresh as refreshFader } from "./popfader.js";

/* ---------- the page's insides ---------- */
// Built HERE, into kernel-daw.html's #composewrap (the page section owns only
// the shell). The ids the modal carried — #stepgrid #slots #seed #rnd #clear
// #edslot — are kept on the page's own elements, because they are gate-read.
// The two (?) pairs that used to be in that list (#edhelp/#edhint,
// #phrhelp/#phrhint) are not "hidden by CSS": the elements are deleted, so
// there is no dead id left behind.
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
const wrap = document.getElementById("composewrap");

// NO HEADER, NO (?) — "get rid of headers and help buttons and table
// headers" (Paul, 2026-08-16). What stood here was an h2 reading
// "Compose · phrase 1" (the rail key already says COMPOSE, and the open
// phrase is lit in the bank below), a round (?) over a paragraph explaining
// a tracker you can simply drag on, and a second h2 + (?) pair over the
// phrase bank. All four are DELETED, not hidden — the paragraphs went with
// them, because a surface that needs a paragraph is a surface that is wrong.
//
// #edslot survives the cull: it is the one thing the head said that the page
// cannot say twice — WHICH phrase these sixteen rows are — so it rides the
// key row as a plain value instead of inside a heading.
const head = mk("div", "edhead");
const edslotEl = Object.assign(mk("span", "edslot", "phrase 1"), { id: "edslot" });
const seedBtn = key("seed", "btn ik ik-seed", "Seed", "write the starter phrase");
const rndBtn = key("rnd", "btn ik ik-rnd", "Random", "roll a random phrase");
const clearBtn = key("clear", "btn ik ik-clear", "Clear", "empty this phrase");
head.append(edslotEl, mk("span", "spacer"), seedBtn, rndBtn, clearBtn);

const stepsWell = mk("div", "steps tbl");
const gridEl = Object.assign(mk("div", "stepgrid"), { id: "stepgrid" });
stepsWell.append(gridEl);

const slotsEl = Object.assign(mk("div", "slots tbl"), { id: "slots" });

wrap.append(head, stepsWell, slotsEl);

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
  // NOT A HEADER ROW. Every silkscreened column-label row on the machine is
  // deleted; this is the one caption that survives, and it survives because
  // eight columns of bare numerals genuinely cannot name themselves — "deg"
  // and "oct" and "vel" are not recoverable from a value the way "4 bars" or
  // "Chicago 1987" are. It is plain quiet text now: no .thd, no sticky band,
  // no rule beneath it, no uppercase.
  const label = (key2) => {
    const rl = Object.assign(document.createElement("div"), { className: "rowlab" });
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
    { className: "rowlab corner", textContent: "st" });
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

/* ---------- the phrase THUMBNAIL ---------- */
// THE ONE DRAWING OF A PHRASE, exported: A MINIATURE OF THE GRID ABOVE — not
// a bar chart ("make the pattern previews tiny versions of the pattern grid,
// not bar charts", Paul, 2026-08-16). The velocity bar chart it replaces was
// a summary of the phrase; this is the phrase, at 1:8. A preview now looks
// like the thing you tap it to edit, which is the whole point of a preview.
//
// THE REDUCTION, and it is a reduction on purpose — eight vectors in 24 user
// units would be three-pixel lanes. The tracker's own column order runs down
// the miniature (gate, acc, sld, then pitch), and the sixteen steps run
// ACROSS, because a thumbnail is twice as wide as it is tall and the step
// axis is the long one:
//   GATE   a full-width block in its lane: the rhythm, read as a row of teeth
//   ACC    a narrower block, centred in the step: an accent is a gate with
//          emphasis, so it is the same mark, smaller
//   SLD    a TIE running from this step into the next, which is what a slide
//          IS — and it wraps at step 16 because the phrase loops
//   PITCH  a mini piano roll over deg + 7·oct, clamped to ±10 (deg alone is
//          ±7, so the clamp only bites on a phrase that octave-jumps), one
//          block per gated step at the height its note sits
// deg/vel/inc/stk are not drawn: velocity was the OLD picture and it told
// phrases apart worst of all — two phrases with the same rhythm and different
// tunes drew identically.
//
// THE GRID ITSELF IS CSS, not path data (.bcmini/.mini in kernel-daw.css): a
// 16-column ruling with the beat lines stronger and one rule under the switch
// lanes, painted as a static background-image. So an EMPTY phrase still draws
// as an empty grid rather than as a blank key, and the repaint contract is
// untouched — ONE <path d> string per thumbnail, one attribute write per
// patch, which is what makes an editor scrub cheap (ui/songrow.js
// patchChipPaths). Drawn by the Compose bank pads here AND the Arrange rows'
// pattern thumbnails: one routine is the only way the pad and the thumbnail
// can agree about what a phrase looks like.
const STEP_W = 4;                          // 64 user units / 16 steps
const CELL_W = 3.2;                        // the mark, with .8 of air after it
// lane tops and heights, in the 64×24 viewBox — the CSS grid's horizontal
// rule sits at 43%, i.e. between the sld lane and the pitch band
const L_GATE = [0.5, 3.2], L_ACC = [4.5, 2.4], L_SLD = [7.7, 2.0];
const BAND_TOP = 11, BAND_H = 12.4, NOTE_H = 2, PITCH_SPAN = 10;
const box = (x, y, w, h) =>
  "M" + x.toFixed(1) + " " + y.toFixed(1) + "h" + w.toFixed(1) +
  "v" + h.toFixed(1) + "h" + (-w).toFixed(1) + "Z";
export function thumbPath(p) {
  let d = "";
  for (let i = 0; i < 16; i++) {
    const x = i * STEP_W + 0.4;
    if (p.gate[i]) {
      d += box(x, L_GATE[0], CELL_W, L_GATE[1]);
      // the note, where it sits: up is higher, the way the deg column's bar is
      const v = Math.max(-PITCH_SPAN, Math.min(PITCH_SPAN,
        p.deg[i] + 7 * p.oct[i]));
      const t = (v + PITCH_SPAN) / (2 * PITCH_SPAN);
      d += box(x, BAND_TOP + (1 - t) * (BAND_H - NOTE_H), CELL_W, NOTE_H);
    }
    if (p.acc[i]) d += box(x + CELL_W / 4, L_ACC[0], CELL_W / 2, L_ACC[1]);
    // a slide REACHES: it is drawn as the tie it is, clipped at the right edge
    if (p.sld[i]) {
      const sx = x + CELL_W / 2;
      d += box(sx, L_SLD[0], Math.min(STEP_W, 64 - sx), L_SLD[1]);
    }
  }
  return d;
}

/* ---------- phrase slots: click toggles into the box AND selects it ------- */
// the picture is ONE <svg><path> per pad, not sixteen <i> bars — one node per
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
    mini.setAttribute("viewBox", "0 0 64 24");
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
// the picture is thumbPath above — the Arrange rows' pattern thumbnails draw
// the same one, and one drawing routine is the only way the pad and the
// thumbnail can agree about what a phrase looks like
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
    const d = thumbPath(p);
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
// (hintKey — the exported (?) wiring, one round key toggling one paragraph,
// used four times across the app — is GONE with the paragraphs it opened
// ("get rid of ... help buttons", 2026-08-16). Nothing imports it any more;
// if a surface needs explaining, that is a note about the surface.)

/* ---------- navigation ---------- */
// ONE way in: openPhraseEditor — from a song row's PATTERN thumbnails, and
// from the trailing [+] that grows the bank into the box (ui/songrow.js).
// Takes a slot index or { slot }; with neither it opens on the current slot.
// It is a NAVIGATION now, not an open: load the phrase, switch the deck to
// the Compose page (one attribute — on a desk the rail is invisible and the
// attribute paints nothing), and scroll the panel into view so the tracker
// starts where the eye lands. There is nothing to close: Compose is a place,
// and the rail (or a tap back on Arrange's stacked panel) is the way out.
export function openPhraseEditor(opts) {
  const si = typeof opts === "number" ? opts
    : opts && opts.slot != null ? opts.slot : null;
  if (si != null && SLOTS[si]) setSlot(si);
  setPage("compose");
  commit("selection");                     // the slot may have moved; every rail
                                           // (this one included) repaints off it
  // #composewrap, not the section: the .page is display:contents on a desk
  // and a contents box has no rect to scroll to
  try { wrap.scrollIntoView({ block: "start" }); } catch (e) {}
  buzz(4);
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
