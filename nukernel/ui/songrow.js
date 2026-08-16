// ui/songrow.js — THE SONG TABLE, and since "the row and the board"
// (2026-08-15) THE WHOLE PER-BOX INTERFACE: one row per section, built from
// NAMED CELLS — | PART | GENRE | FUNCTION | BARS# | TIMING | PATTERN MODS |
// VOICE | RHYTHM | TRANSITIONS | PATTERN 1..n | — and every cell is a tap
// target that opens a FOCUSED POPUP carrying only that cell's controls. You
// don't pop up everything at once; you manipulate the section by tapping
// different parts of its row. The popups are built from the palette's bank
// library (ui/palette.js mountBanks — the page it used to be is gone), plus
// the row-level keys this file owns: play-from-here, reorder, duplicate,
// delete and pin in the PART popup, the bars stepper in BARS#, the nudge
// stepper in TIMING, the layer/focus list in GENRE.
//
// WHAT THE CELLS REPLACED, and why nothing is lost:
//   THE LED STRIP — eight lamps compressing ~20 words because the row had no
//     room for them. The cell row IS the words: every cell shows its current
//     value compactly (genre name, bar count, role word, a kit word, an op
//     count), and each family's full detail is one tap away in its popup.
//     The long-press that poured the lamp words into the readout went with
//     the lamps — the cells say their values in place.
//   THE ROW SHEET'S SURFACE SWITCH (sound/mix) — the two surfaces it switched
//     no longer share a sheet: sound is the cell popups, mix is the MIX page.
//   THE + / PIN / ✕ CORNER CLUSTER and the #gpick picker — the PART popup
//     carries pin/delete (and dblclick still loops); the GENRE popup carries
//     the family banks, where a dark chip adds a layer and a lit one removes.
//
// Rebuilding is still the sin: a row's element is keyed by the box object's
// identity and only its text and classes are patched. A "phrase" event still
// does not patch a ROW — it writes one <path d> per chip showing the edited
// phrase and nothing else (patchChipPaths, at the bottom), the contract that
// makes an editor scrub cheap.
//
// Layer graph: ui view — imports state/derive/deps and audio/transport (the
// one allowed direction; transport never calls back, it publishes).
import { GENRES, ROLES, KITLABEL, DRUMKITS,
         SWINGLABEL, GROOVELABEL, RATELABEL, ARTICS, INLABEL, OUTLABEL,
         SINGLABEL, MAX_LEN, MAX_NUDGE, NSLOTS, blank, instrOf,
         emptyBox } from "./deps.js";
import { SONG, SLOTS, slot, viewSec, loopOnly, pendingStart, bpm, setViewSec,
         setLoopOnly, setPendingStart, setSlot, commit, on } from "./state.js";
import { stackOf, stackLabel, boxBars, secsOf, focused, focusOf, opsOf, optOf,
         voxAll, kitOf, mmss, contourPath } from "./derive.js";
import { playing, playingSec, startAt, resetBar } from "../audio/transport.js";
import { buzz } from "./touch.js";
// toggle() is the ONE dispatcher every chip goes through; mountBanks builds a
// cell's banks into the popup mount and refreshChips re-lights them per commit
import { toggle, mountBanks, refreshChips } from "./palette.js";
// a PATTERN cell opens the PHRASE EDITOR POPUP on that phrase — the row is
// where you choose WHICH phrase, the popup is where you edit it. (editor.js
// imports state/palette/popfader/touch only, so this direction stays acyclic.)
import { openPhraseEditor } from "./editor.js";

const songEl = document.getElementById("song");
// TABLE SEMANTICS, honestly and everywhere: the same cells on every section,
// one row each, a header row naming the columns (CSS hides that header where
// there is no room for it). The roles are static because the DOM is.
songEl.setAttribute("role", "table");
songEl.setAttribute("aria-label", "song sections");
// the anchored popup needs daylight under the row; below this width it is a
// bottom sheet instead. The same number the pop-up fader uses — one
// definition of "there is room beside/below this".
const WIDE = 900;

let dragFrom = null;
const els = new Map();                     // box object -> { box, cells, ... }

const idx = sec => SONG.indexOf(sec);
// loopOnly/pendingStart are SONG indices, and a reorder invalidates indices —
// the same law the row listeners follow ("close over the box object, never an
// index"). Capture the marked BOXES before the splice, re-find them after:
// without this, moving any box while a loop was armed retargeted the loop to
// the moved box (move() used to setLoopOnly(j) unconditionally) and a drag
// past the looped box silently changed which box loops.
const keepMarks = () => {
  const lo = loopOnly != null ? SONG[loopOnly] : null;
  const ps = pendingStart != null ? SONG[pendingStart] : null;
  return () => {
    if (lo) setLoopOnly(SONG.indexOf(lo));
    if (ps) setPendingStart(SONG.indexOf(ps));
  };
};

/* ---------- the cell vocabulary ---------- */
// the column order IS the interface order — one definition, the header row
// and every box row walk it. FUNCTION is the section-role cell (the word
// "function" is the brief's; "role" is the field's).
const CELLS = ["part", "genre", "role", "bars", "timing", "mods",
               "voice", "rhythm", "trans"];
const CELLNAME = { part: "part", genre: "genre", role: "function", bars: "bars",
                   timing: "timing", mods: "pattern mods", voice: "voice",
                   rhythm: "rhythm", trans: "transitions" };

/* ---------- the column header ---------- */
// A real header row AT EVERY WIDTH: the columns are named once, at the top,
// instead of every row re-explaining itself. Each header cell carries the full
// word plus a phone abbreviation — the transport legend's span swap: the full
// word leaves the layout via the clip pattern, never display:none, so the
// columnheader's accessible name stays the full word on every width.
const headRow = (() => {
  const r = document.createElement("div");
  r.className = "shead thd"; r.setAttribute("role", "row");
  const names = { part: "#", genre: "genre", role: "function", bars: "bars",
                  timing: "timing", mods: "mods", voice: "voice",
                  rhythm: "rhythm", trans: "transitions" };
  const abbr = { part: "#", genre: "genre", role: "func", bars: "bars",
                 timing: "time", mods: "mods", voice: "voice",
                 rhythm: "rhy", trans: "trans" };
  const mk = (cls, full, ab) => {
    const c = document.createElement("span");
    c.className = cls;
    c.setAttribute("role", "columnheader");
    const f = document.createElement("span");
    f.className = "hf"; f.textContent = full;
    const a = document.createElement("span");
    a.className = "ha"; a.textContent = ab;
    a.setAttribute("aria-hidden", "true");
    c.append(f, a);
    return c;
  };
  for (const k of CELLS) r.append(mk("h-" + k, names[k], abbr[k]));
  r.append(mk("h-ph", "patterns", "ptns"));
  return r;
})();

/* ---------- keys and icons ---------- */
const btn = (cls, glyph, label, fn) => {
  const b2 = document.createElement("button");
  b2.type = "button"; b2.className = cls; b2.textContent = glyph;
  b2.setAttribute("aria-label", label);
  b2.addEventListener("click", ev => { ev.stopPropagation(); fn(); });
  return b2;
};
// a drawn icon instead of a glyph: no dependable pushpin character exists in
// a monospace face, so the pin is a path painted with currentColor — the
// silkscreen recipe every icon on the machine uses.
const PIN_SVG =
  '<svg viewBox="0 0 16 16" aria-hidden="true" class="pini">' +
  '<path d="M5.7 1.6h4.6l-.7 3.4 2.2 2.2v1.3H8.7v5.4L8 15.2l-.7-1.3V8.5H4.2V7.2l2.2-2.2z"/>' +
  '</svg>';
const iconBtn = (cls, svg, label, fn) => {
  const b2 = btn(cls, "", label, fn);
  b2.innerHTML = svg;
  return b2;
};

/* ---------- reorder, as one function ---------- */
// THREE CALLERS, ONE MOVE: the PART popup's ↑ ↓ (the touch path — HTML5 drag
// does not fire on a touch screen at all, so a phone would otherwise have no
// reorder), ALT+ARROW on the focused row (the keyboard path), and drag-and-drop
// (the desk path, below). It closes over the BOX OBJECT and looks its index up
// at call time, the law every listener in this file follows.
function moveBox(sec, d) {
  const at = idx(sec), j = at + d;
  if (at < 0 || j < 0 || j >= SONG.length) return false;
  const keep = keepMarks();
  const [m] = SONG.splice(at, 1); SONG.splice(j, 0, m);
  keep();
  setViewSec(j);
  commit("box");
  if (playing) resetBar();
  return true;
}

/* ---------- build once per box ---------- */
// Listeners close over the BOX OBJECT, never over an index — a box that has
// been dragged three places up is still the same object, so its element and
// its handlers survive the move and the index is looked up at event time.
function buildBox(sec) {
  const box = document.createElement("div");
  box.className = "box";
  box.setAttribute("role", "row");
  box.draggable = true;
  // EVERY CELL IS BUILT ONCE and patched by textContent/class, never by
  // innerHTML — rebuilding destroys the button under the pointer mid-click
  // (the exact failure palette.js documents having fixed once).
  // A cell is a real <button role="cell">: icon silkscreen + the compact
  // current value, and tapping it opens ITS popup. The click stops there —
  // the row's own click (the gap between cells) opens the PART popup.
  const cells = {};
  const cell = k => {
    const b2 = document.createElement("button");
    b2.type = "button";
    b2.className = "bcell c-" + k + (k === "genre" ? " bgenre" : "") +
                   (k === "bars" ? " bbars" : "");
    b2.dataset.cell = k;
    b2.setAttribute("role", "cell");
    const ci = document.createElement("span");
    ci.className = "ci"; ci.setAttribute("aria-hidden", "true");
    b2.append(ci);
    b2.addEventListener("click", ev => {
      ev.stopPropagation();
      const i = idx(sec);
      if (popFor === sec && popCell === k) { closePop(); return; }  // a toggle
      setViewSec(i);
      openPop(sec, k);
    });
    cells[k] = b2;
    return b2;
  };
  for (const k of CELLS) cell(k);
  // the PART cell carries the row number (the shared numeral column) and the
  // pin lamp; the others carry a value span the patch writes
  const num = Object.assign(document.createElement("b"),
    { className: "bnum tnum", textContent: "" });
  const pinLamp = document.createElement("span");
  pinLamp.className = "bpin"; pinLamp.innerHTML = PIN_SVG;
  pinLamp.setAttribute("aria-hidden", "true");
  cells.part.append(num, pinLamp);
  const vals = {};
  for (const k of CELLS.slice(1)) {
    const v = document.createElement("span");
    // the FUNCTION cell's value keeps the .role class — it is the one word
    // that NAMES the section, and gates read `.box .role` for it
    v.className = k === "role" ? "cvx role" : "cvx";
    cells[k].append(v);
    vals[k] = v;
  }
  // the BARS cell says the length in the units the song is written in, and
  // the duration in the units a listener hears. Two spans, because the phone
  // drops the clock and keeps the bars.
  const bn = Object.assign(document.createElement("b"), { className: "bn" });
  const bd = Object.assign(document.createElement("span"), { className: "bd" });
  vals.bars.append(bn, bd);
  // THE PATTERN CELLS — one chip per (layer, phrase), the phrase's own
  // contour as the icon (contourPath, one drawing routine with the editor's
  // rail), plus the trailing [+] that grows the bank into this box and opens
  // the editor on the new phrase.
  const ph = document.createElement("div");
  ph.className = "bchips"; ph.setAttribute("role", "cell");
  const plus = btn("bch bplus", "+", "add a phrase to this box", () => {
    const at = idx(sec);
    if (at < 0 || SLOTS.length >= NSLOTS) return;
    setViewSec(at);
    SLOTS.push(blank());
    const si = SLOTS.length - 1;
    setSlot(si);
    commit("phrase");
    toggle("phrase", si);                 // into the FOCUSED layer; it commits
    closePop();
    openPhraseEditor({ slot: si });
    buzz(4);
  });
  ph.append(plus);
  const prog = document.createElement("div"); prog.className = "bprog";
  const fill = Object.assign(document.createElement("i"), { className: "fillbar" });
  prog.append(fill);
  box.append(...CELLS.map(k => cells[k]), ph, prog);

  // REORDER — rows drag among themselves, and that is all dragging does now.
  box.addEventListener("dragstart", e => {
    dragFrom = idx(sec); box.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(dragFrom));
  });
  box.addEventListener("dragend", () => { dragFrom = null; box.classList.remove("dragging"); patchAll(); });
  box.addEventListener("dragover", e => {
    const i = idx(sec);
    if (dragFrom == null || dragFrom === i) return;
    e.preventDefault(); box.classList.add("over");
  });
  box.addEventListener("dragleave", () => box.classList.remove("over"));
  box.addEventListener("drop", e => {
    e.preventDefault(); box.classList.remove("over");
    const i = idx(sec);
    if (dragFrom == null || dragFrom === i) return;
    const keep = keepMarks();
    const [moved] = SONG.splice(dragFrom, 1);
    SONG.splice(i, 0, moved);
    keep();
    setViewSec(i); dragFrom = null; commit("box");
    if (playing) resetBar();
  });

  // the ROW itself (the gaps between cells) opens the PART popup — the row's
  // "default" cell, so a miss on a cell still lands on the box's own options.
  // While ANOTHER row's popup is up, a tap only dismisses it (the auto-dismiss
  // rule). DOUBLE-CLICK still loops this row alone, and closes whatever the
  // first click opened.
  box.addEventListener("click", () => {
    const i = idx(sec);
    if (popFor && popFor !== sec) { closePop(); setViewSec(i); commit("selection"); return; }
    if (popFor === sec) { closePop(); return; }   // same row: a toggle
    setViewSec(i);
    openPop(sec, "part");
  });
  // ...and the same door from the keyboard: the row is a tab stop, Enter or
  // Space opens its PART popup (each cell is a real button and its own stop).
  box.tabIndex = 0;
  box.addEventListener("keydown", e => {
    // ALT+ARROW REORDERS THE FOCUSED ROW. Alt is the modifier because a bare
    // arrow must keep walking the tab ring, and the row FOLLOWS ITS BOX — the
    // element is keyed by the box object, so re-focusing after the commit
    // keeps the same section under the keys for a second press.
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      if (moveBox(sec, e.key === "ArrowUp" ? -1 : 1)) {
        const el = els.get(sec);
        if (el) el.box.focus({ preventScroll: false });
        buzz(4);
      }
      return;
    }
    if (e.key !== "Enter" && e.key !== " ") return;
    if (e.target !== box) return;              // a cell button handles its own
    e.preventDefault();
    const i = idx(sec);
    if (popFor === sec) { closePop(); return; }
    if (popFor) closePop();
    setViewSec(i);
    openPop(sec, "part");
  });
  box.addEventListener("dblclick", () => {
    const i = idx(sec);
    closePop();
    setViewSec(i); setLoopOnly(i);
    commit("selection");
    startAt(i);
  });

  return { box, cells, vals, num, pinLamp, bn, bd, plus,
           ph, chips: [], chipsSig: "", fill };
}

/* ---------- the phrase chips ---------- */
// One chip per (layer, phrase), rebuilt only when the SET of phrases in the
// box changes — a structural, rare edit. A scrub inside a phrase does not
// rebuild anything: it repaints one <path d> (patchChipPaths, at the bottom).
const SVGNS = "http://www.w3.org/2000/svg";
function buildChip(sec, li, si) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "bch";
  const mini = document.createElementNS(SVGNS, "svg");
  mini.setAttribute("class", "bcmini");
  mini.setAttribute("viewBox", "0 0 64 26");
  mini.setAttribute("preserveAspectRatio", "none");
  mini.setAttribute("aria-hidden", "true");
  const line = document.createElementNS(SVGNS, "path");
  mini.append(line); b.append(mini);
  b.addEventListener("click", ev => {
    ev.stopPropagation();                 // the row click opens the PART popup
    const at = idx(sec);
    closePop();                           // one popup at a time
    setViewSec(at); sec.focus = li;       // the layer the phrase rail edits
    setSlot(si);
    commit("selection");
    // GO AND EDIT IT. The editor is a popup — it opens ON the phrase the chip
    // shows, with the row still selected, at every width.
    openPhraseEditor({ slot: si });
    buzz(4);
  });
  return { b, line, si };
}

/* ---------- the compact cell values ---------- */
// the row reads as a summary line of the whole section: every cell shows its
// current value in a word or two, and "—" is the honest spelling of unset.
// These derivations are the old LED-strip families, said in place.
function timingFact(sec, fe) {
  const artic = optOf(sec, fe, "artic");
  const facts = [sec.rate && RATELABEL[sec.rate],
                 sec.swing && SWINGLABEL[sec.swing],
                 sec.groove && GROOVELABEL[sec.groove],
                 sec.nudge ? "+" + sec.nudge : null,
                 artic && ARTICS[artic]].filter(Boolean);
  return facts.length ? facts[0] + (facts.length > 1 ? " +" + (facts.length - 1) : "") : "—";
}
function modsFact(sec, fe) {
  const n = opsOf(sec, fe).length +
    (sec.period ? 1 : 0) + (sec.breath ? 1 : 0) + (sec.pipe ? 1 : 0);
  return n ? n + (n === 1 ? " op" : " ops") : "—";
}
function voiceFact(sec, fe) {
  const g = GENRES[fe.g];
  // the RESOLVED voice word, the mix table's own switch: a signature synth
  // beats the sampled instrument, and a singing box says its singer
  const base = sec.sing ? SINGLABEL[sec.sing]
    : g.synth ? (g.synth.root || g.synth.dsp)
    : g.instr ? String(instrOf(fe.g, 0)).replace(/_/g, " ") : "—";
  const vox = voxAll(sec, fe);
  const n = (optOf(sec, fe, "oct") ? 1 : 0) + (optOf(sec, fe, "scale") ? 1 : 0) +
    (optOf(sec, fe, "part") ? 1 : 0) + (optOf(sec, fe, "clamp") != null ? 1 : 0) +
    (optOf(sec, fe, "cmode") ? 1 : 0) + (vox ? Object.keys(vox).length : 0);
  return base + (n ? " +" + n : "");
}
function rhythmFact(sec) {
  if (sec.kit) return KITLABEL[sec.kit];
  const k = kitOf(sec);
  return k ? (DRUMKITS[k] || k) : "—";
}
function transFact(sec) {
  const marks = [sec.intro && INLABEL[sec.intro],
                 sec.outro && OUTLABEL[sec.outro]].filter(Boolean);
  let t = marks.join("→");
  const extra = (sec.env ? 1 : 0) + (sec.mot ? 1 : 0) +
    (sec.auto || []).filter(Boolean).length;
  if (extra) t = t ? t + " +" + extra : extra + " set";
  return t || "—";
}

/* ---------- patch on every change ---------- */
function patchBox(sec, i, el) {
  const bars = boxBars(sec);
  el.box.className = "box" +
    (i === viewSec ? " sel" : "") + (i === playingSec ? " live" : "") +
    (i === loopOnly ? " looped" : "") + (i === pendingStart ? " queued" : "") +
    (popFor === sec ? " open" : "");
  el.box.setAttribute("aria-label",
    "box " + (i + 1) + ", " + stackLabel(sec) + ", " + bars + " bars");

  el.num.textContent = String(i + 1);
  el.pinLamp.hidden = i !== loopOnly;
  el.cells.part.setAttribute("aria-label", "box " + (i + 1) + " options" +
    (i === loopOnly ? " (pinned: loops alone)" : ""));

  const st = stackOf(sec);
  const put = (k, txt) => {
    if (el.vals[k].textContent !== txt) el.vals[k].textContent = txt;
    el.cells[k].classList.toggle("unset", txt === "—");
  };
  // the GENRE cell names the AUTHORITY with a rider count; the layers list
  // and the family banks are its popup
  el.cells.genre.classList.add("has");
  put("genre", GENRES[st[0].g].label + (st.length > 1 ? " +" + (st.length - 1) : ""));
  el.cells.genre.setAttribute("aria-label",
    "box " + (i + 1) + " genre: " + stackLabel(sec));
  put("role", sec.role ? ROLES[sec.role] : "—");
  el.cells.role.setAttribute("aria-label", "box " + (i + 1) + " function: " +
    (sec.role ? ROLES[sec.role] : "not set"));
  // THE BARS CELL IS WHERE LENGTH LIVES. The number is the honest answer —
  // a row cannot say its length in pixels any more.
  el.bn.textContent = bars + " bar" + (bars === 1 ? "" : "s") +
    (sec.nudge ? " +" + sec.nudge : "");
  // the clock carries its own separator so the cell reads as one phrase —
  // "4 bars · 0:07" — in the accessibility tree as well as on the glass
  el.bd.textContent = "· " + mmss(secsOf(sec, bpm));
  el.cells.bars.setAttribute("aria-label",
    "box " + (i + 1) + " length: " + bars + " bars");

  const fe = i === viewSec ? focused(sec) : st[0];
  put("timing", timingFact(sec, fe));
  put("mods", modsFact(sec, fe));
  put("voice", voiceFact(sec, fe));
  put("rhythm", rhythmFact(sec));
  put("trans", transFact(sec));
  for (const k of ["timing", "mods", "voice", "rhythm", "trans"])
    el.cells[k].setAttribute("aria-label",
      "box " + (i + 1) + " " + CELLNAME[k] + ": " + el.vals[k].textContent);

  // THE PATTERN CELLS — one per (layer, phrase), in the layers' own order, so
  // the strip reads the way the stack does. Rebuilt only when the SET moves.
  const csig = st.map(e => e.slots.join(",")).join("|");
  if (el.chipsSig !== csig) {
    el.chipsSig = csig;
    for (const c of el.chips) c.b.remove();
    el.chips.length = 0;
    st.forEach((ent, li) => ent.slots.forEach(si => {
      const c = buildChip(sec, li, si);
      el.chips.push(c); el.ph.insertBefore(c.b, el.plus);
    }));
  }
  el.ph.className = "bchips" + (el.chips.length ? " has" : "");
  el.plus.hidden = SLOTS.length >= NSLOTS;
  el.plus.setAttribute("aria-label", "add a phrase to box " + (i + 1));
  for (const c of el.chips) {
    // LIT = SOUNDING. Not a timer and not a guess: the transport publishes the
    // sounding SECTION, and derive.js's own deal is that voice v plays phrase
    // v % n — so every phrase in the sounding box is sounding at once, and the
    // honest lamp is per section rather than per chip.
    c.b.classList.toggle("lit", i === playingSec);
    // ...and the ring is the EDIT target: this row selected, this phrase open
    // in the editor popup
    c.b.classList.toggle("sel", i === viewSec && slot === c.si);
    const p = SLOTS[c.si];
    if (p) {
      const d = contourPath(p);
      if (c.line.getAttribute("d") !== d) c.line.setAttribute("d", d);
    }
    c.b.setAttribute("aria-label",
      "phrase " + (c.si + 1) + " in box " + (i + 1) + " — opens the phrase editor");
  }
}
function patchAll() { SONG.forEach((sec, i) => { const el = els.get(sec); if (el) patchBox(sec, i, el); }); }

/* ---------- the two table keys, built once ---------- */
// COPY duplicates the selected box — everything, including its transforms and
// its trim. They sit in a footer ROW of the table, not floating beside the
// last section: the table has one column layout and these are not a section.
// (The PART popup carries a per-row duplicate too — same splice, that row.)
const dupBox = sec => {
  const at = Math.max(0, idx(sec));
  const src = JSON.parse(JSON.stringify(SONG[at]));
  SONG.splice(at + 1, 0, src);
  setViewSec(at + 1); commit("box");
};
const copyBtn = (() => {
  const copy = document.createElement("button");
  copy.type = "button"; copy.className = "addbox copy";
  copy.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true">' +
    '<rect x="6.5" y="2.5" width="11" height="13" rx="1.5"></rect>' +
    '<path d="M13.5 17.5h-11v-13"></path></svg><span class="ab">duplicate</span>';
  copy.title = "duplicate the selected box";
  copy.setAttribute("aria-label", "duplicate the selected box");
  copy.addEventListener("click", () => dupBox(SONG[Math.min(viewSec, SONG.length - 1)]));
  return copy;
})();
const addBtn = (() => {
  const add = document.createElement("button");
  add.type = "button"; add.className = "addbox";
  add.innerHTML = '<span aria-hidden="true">+</span><span class="ab">add a box</span>';
  add.title = "add an empty box";
  add.setAttribute("aria-label", "add a box");
  add.addEventListener("click", () => {
    SONG.push(emptyBox()); setViewSec(SONG.length - 1); commit("box");
  });
  return add;
})();
const footRow = (() => {
  const f = document.createElement("div");
  f.className = "sfoot"; f.setAttribute("role", "row");
  const c = document.createElement("span");
  c.className = "sfootcell"; c.setAttribute("role", "cell");
  c.append(copyBtn, addBtn);
  f.append(c);
  return f;
})();

/* ---------- the cell popup ---------- */
// ONE popup element for every cell: the #rowpop shell — anchored under the
// row on a desk, a bottom sheet on a phone — whose mount holds only the OPEN
// cell's controls. The banks come from palette.mountBanks; the keys and
// steppers below are the row-level controls this file owns. Chip clicks
// commit and the popup PATCHES, never closes — a chain of edits is one visit.
// Dismiss: ✕, the scrim, Esc; AUTO-dismiss on another row's tap, a page
// switch, a new song, a meaningful deck scroll, and re-anchor on resize/scroll.
let popFor = null;                          // the box object the popup is on
let popCell = null;                         // which cell opened it
let popScroll0 = 0;
const deckEl = document.querySelector(".deck");
const rpScrim = Object.assign(document.createElement("div"),
  { className: "rpscrim", hidden: true });
const rowpop = Object.assign(document.createElement("div"),
  { className: "rowpop", id: "rowpop", hidden: true });
rowpop.setAttribute("role", "dialog");
const rpTitle = Object.assign(document.createElement("span"),
  { className: "rptitle", textContent: "box" });
const rpX = btn("rpk rpx", "✕", "close the cell options", () => closePop());
const rpHead = Object.assign(document.createElement("div"), { className: "rphead" });
rpHead.append(rpTitle, rpX);
const rpMount = Object.assign(document.createElement("div"), { className: "rpmount" });
rowpop.append(rpHead, rpMount);
document.body.append(rpScrim, rowpop);

// THE PART POPUP'S KEYS — the row-level operations: play from here, the
// touch-path reorder, duplicate, delete, pin. Built once, moved into the
// mount when the PART cell opens.
const rpPlay = btn("rpk rpplay", "▶", "play from this box", () => {
  if (!popFor) return;
  const i = SONG.indexOf(popFor);
  setLoopOnly(null);
  if (playing) { setPendingStart(i); commit("selection"); }
  else { commit("selection"); startAt(i); }
  buzz(4);
});
const rpUp = btn("rpk rpmv", "↑", "move this box earlier",
  () => { if (popFor) { moveBox(popFor, -1); buzz(4); } });
const rpDn = btn("rpk rpmv", "↓", "move this box later",
  () => { if (popFor) { moveBox(popFor, 1); buzz(4); } });
const rpDup = btn("rpk rpdup", "⧉", "duplicate this box",
  () => { if (popFor) { dupBox(popFor); buzz(4); } });
const rpPin = iconBtn("rpk rppin", PIN_SVG, "pin box (loop it alone)", () => {
  if (!popFor) return;
  const at = idx(popFor);
  setViewSec(at); setLoopOnly(loopOnly === at ? null : at);
  commit("selection");
  if (playing || loopOnly != null) startAt(at);
});
const rpDel = btn("rpk rpdel", "✕", "remove this box", () => {
  if (!popFor) return;
  const at = idx(popFor);
  closePop();
  SONG.splice(at, 1);
  if (!SONG.length) SONG.push(emptyBox());
  setViewSec(Math.min(viewSec, SONG.length - 1));
  if (loopOnly != null) setLoopOnly(null);
  commit("box");
  if (playing) resetBar();
});
const rpKeys = Object.assign(document.createElement("div"), { className: "rpkeys" });
rpKeys.append(rpPlay, rpUp, rpDn, rpDup, rpPin, rpDel);

// bars/nudge as steppers: the same clamps the edge grips carried, the same
// commit("box"), and reachable by thumb, key and screen reader alike. BARS
// lives in the BARS# popup, NUDGE in TIMING (it is a when, not a how-long).
const stepper = (lab, name, get, set) => {
  const w = Object.assign(document.createElement("span"), { className: "rpstep" });
  w.append(Object.assign(document.createElement("span"),
    { className: "rlab", textContent: lab }));
  const dn = btn("rpk", "−", "one " + name + " less", () => set(get() - 1));
  const lcd = Object.assign(document.createElement("output"), { textContent: "0" });
  const up = btn("rpk", "+", "one " + name + " more", () => set(get() + 1));
  w.append(dn, lcd, up);
  return { w, lcd };
};
const rpLen = stepper("bars", "bar",
  () => popFor.len,
  v => { const n = Math.max(1, Math.min(MAX_LEN, v));
         if (n !== popFor.len) { popFor.len = n; commit("box"); } });
const rpNudge = stepper("nudge", "bar of nudge",
  () => popFor.nudge,
  v => { const n = Math.max(0, Math.min(MAX_NUDGE, v));
         if (n !== popFor.nudge) { popFor.nudge = n; commit("box"); } });
const rpBars = Object.assign(document.createElement("div"), { className: "rpbars" });
rpBars.append(rpLen.w);
const rpNud = Object.assign(document.createElement("div"), { className: "rpbars" });
rpNud.append(rpNudge.w);

// THE GENRE POPUP'S LAYER LIST — the stack as rows, tap to focus: which layer
// the phrase rail, the mods and the voice popup edit. Rebuilt only when the
// stack's GENRES change; labels and the focus ring patch every pass.
const rpFoc = Object.assign(document.createElement("div"), { className: "rpfoc" });
let focSig = "";
function buildFoc(sec) {
  focSig = stackOf(sec).map(e => e.g).join("|");
  rpFoc.textContent = "";
  stackOf(sec).forEach((ent, k) => {
    const b2 = document.createElement("button");
    b2.type = "button"; b2.className = "blayer";
    b2.addEventListener("click", ev => {
      ev.stopPropagation();
      sec.focus = k;
      commit("selection");
      buzz(4);
    });
    rpFoc.append(b2);
  });
}
function patchFoc(sec) {
  const st = stackOf(sec);
  if (focSig !== st.map(e => e.g).join("|")) { buildFoc(sec); }
  [...rpFoc.children].forEach((b2, k) => {
    const ent = st[k];
    const t2 = (k ? "" : "authority · ") + GENRES[ent.g].label +
      (ent.slots.length ? " · " + ent.slots.map(n => n + 1).join("+") : " · —");
    if (b2.textContent !== t2) b2.textContent = t2;
    b2.classList.toggle("foc", focusOf(sec) === k);
    b2.setAttribute("aria-pressed", String(focusOf(sec) === k));
    b2.setAttribute("aria-label", (k ? "layer: " : "authority: ") +
      GENRES[ent.g].label + " — edit this layer");
  });
}

// WHERE THE POPUP GOES. Wide: under the row it belongs to, left-aligned with
// it, flipped above when the row sits low, and never taller than the daylight
// it found — and NEVER over the row itself. Narrow: the bottom sheet.
// MEASURED LATE, AND RE-ANCHORED ON A MOVE — placing once, synchronously, can
// write coordinates for where the row used to be, so the popup is placed
// again on the next frame and whenever a scroll has actually moved its row.
let popAt = 0;
function reanchor() {
  const el = popFor && els.get(popFor);
  if (!el) return;
  const top = el.box.getBoundingClientRect().top;
  if (Math.abs(top - popAt) < 2) return;   // the row has not gone anywhere
  popAt = top; placePop();
}
function placePop() {
  const el = popFor && els.get(popFor);
  const r = el ? el.box.getBoundingClientRect() : null;
  if (innerWidth >= WIDE && r) {
    rowpop.classList.add("beside");
    rpScrim.classList.add("beside");   // a lighter dim: the table is context
    rowpop.style.maxHeight = "";
    const w = rowpop.offsetWidth;
    const below = innerHeight - r.bottom - 14, above = r.top - 14;
    const under = below >= 320 || below >= above;
    // the daylight on the chosen side is a hard ceiling: the popup scrolls
    // inside itself rather than growing over the row or off the screen
    const room = Math.max(180, under ? below : above);
    const h = Math.min(rowpop.offsetHeight, room);
    rowpop.style.left = Math.min(Math.max(8, r.left), innerWidth - w - 8) + "px";
    rowpop.style.top = (under ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + "px";
    rowpop.style.maxHeight = room + "px";
    return;
  }
  rowpop.classList.remove("beside"); rpScrim.classList.remove("beside");
  rowpop.style.left = ""; rowpop.style.maxHeight = "";
  rowpop.style.top = Math.max(8, Math.min(r ? r.bottom + 6 : 72, innerHeight - 380)) + "px";
}

// WHAT EACH CELL MOUNTS: its own keys first, then its banks. The keys are
// built once above and MOVED in (one of each exists); the banks are rebuilt
// per open — they are cheap, and the mount is emptied anyway.
function mountCell(sec, kind) {
  rpMount.textContent = "";
  if (kind === "part") rpMount.append(rpKeys);
  else if (kind === "bars") rpMount.append(rpBars);
  else if (kind === "timing") { rpMount.append(rpNud); mountBanks("timing", rpMount); }
  else if (kind === "genre") { buildFoc(sec); rpMount.append(rpFoc); mountBanks("genre", rpMount); }
  else mountBanks(kind, rpMount);
}

function openPop(sec, kind) {
  popFor = sec; popCell = kind;
  mountCell(sec, kind);
  commit("selection");                     // the ring moves; every view repaints
  rpScrim.hidden = false; rowpop.hidden = false;
  popAt = -1e9; placePop();
  requestAnimationFrame(reanchor);         // after the scroll anchor settles
  popScroll0 = deckEl ? deckEl.scrollTop : 0;
  patchPop();
  patchAll();                              // the open row wears .open
  rpX.focus({ preventScroll: true });
  buzz(4);
}
function closePop() {
  if (!popFor) return;
  popFor = null; popCell = null;
  rowpop.hidden = true; rpScrim.hidden = true;
  patchAll();
}
function patchPop() {
  if (!popFor) return;
  const i = SONG.indexOf(popFor);
  if (i < 0) { closePop(); return; }       // the box was removed under it
  rpTitle.textContent = "box " + (i + 1) + " · " + CELLNAME[popCell];
  if (popCell === "part") {
    // a move key with nowhere to go GHOSTS rather than vanishing: the keys
    // must not reshuffle between the first row and the middle of the song
    rpUp.classList.toggle("ghost", i === 0);
    rpDn.classList.toggle("ghost", i === SONG.length - 1);
    rpUp.setAttribute("aria-label", "move box " + (i + 1) + " earlier");
    rpDn.setAttribute("aria-label", "move box " + (i + 1) + " later");
    rpDup.setAttribute("aria-label", "duplicate box " + (i + 1));
    rpDel.setAttribute("aria-label", "remove box " + (i + 1));
    rpPin.classList.toggle("on", i === loopOnly);
    rpPin.setAttribute("aria-pressed", String(i === loopOnly));
    rpPin.setAttribute("aria-label",
      (i === loopOnly ? "unpin box " : "pin box ") + (i + 1) + " (loop it alone)");
  }
  if (popCell === "bars") rpLen.lcd.textContent = String(popFor.len);
  if (popCell === "timing") rpNudge.lcd.textContent = String(popFor.nudge);
  if (popCell === "genre") patchFoc(popFor);
  refreshChips(rpMount);                   // the banks follow every commit
}
rpScrim.addEventListener("click", () => closePop());
addEventListener("keydown", ev => {
  if (popFor && ev.key === "Escape") { closePop(); ev.preventDefault(); }
});
// a meaningful scroll of the deck is the finger saying "I am going somewhere"
if (deckEl) deckEl.addEventListener("scroll", () => {
  if (popFor && Math.abs(deckEl.scrollTop - popScroll0) > 24) closePop();
}, { passive: true });
// a resize can change which side the popup goes on; a page scroll moves the
// row out from under it. Both re-anchor rather than leave it pointing at
// nothing. (The DECK's own scroll is a different gesture — it closes, above.)
addEventListener("resize", () => { if (popFor) placePop(); });
addEventListener("scroll", reanchor, { passive: true });
on("page", () => closePop());              // the rail moved: the row is gone
on("song", () => closePop());              // a whole new song
on("box", patchPop);                       // LCDs and chip lights follow edits
on("selection", patchPop);

/* ---------- structural sync ---------- */
// create elements for new boxes, drop the ones whose box is gone, put the rest
// in SONG order (append moves an existing node), then patch everything
export function render() {
  const keep = songEl.scrollTop;           // the table grows DOWN and scrolls
  if (songEl.firstElementChild !== headRow) songEl.prepend(headRow);
  for (const [sec, el] of [...els]) if (!SONG.includes(sec)) { el.box.remove(); els.delete(sec); }
  for (const sec of SONG) if (!els.has(sec)) els.set(sec, buildBox(sec));
  // put the rows in SONG order, MOVING ONLY THE MISPLACED ONES — the header
  // holds slot 0, so a section's slot is its index plus one
  SONG.forEach((sec, i) => {
    const el = els.get(sec).box;
    if (songEl.children[i + 1] !== el) songEl.insertBefore(el, songEl.children[i + 1] || null);
  });
  if (songEl.lastElementChild !== footRow) songEl.append(footRow);
  patchAll();
  songEl.scrollTop = keep;
}

/* ---------- the fill bars ---------- */
// painted from main.js's rAF loop off transport.getPosition() — a walk over
// refs, never a querySelectorAll per frame
export function paintProgress(si, frac) {
  SONG.forEach((sec, i) => {
    const el = els.get(sec);
    if (el) el.fill.style.width = i === si ? (frac * 100).toFixed(2) + "%" : "0%";
  });
}

/* ---------- the one thing a phrase edit may touch ---------- */
// THE SCRUB CONTRACT, KEPT. This module still does not patch on "phrase" — a
// pointermove in the tracker commits per value and patchAll() would recompute
// every cell value for every section in the song. But the row DRAWS the
// phrases, so the middle ground is exact: one contourPath for the phrase that
// actually changed, then one <path d> write per chip that shows it — nothing
// else on the row is read or written.
function patchChipPaths() {
  const p = SLOTS[slot];
  if (!p) return;
  const d = contourPath(p);
  for (const el of els.values())
    for (const c of el.chips)
      if (c.si === slot && c.line.getAttribute("d") !== d) c.line.setAttribute("d", d);
}
on("phrase", patchChipPaths);

on("song", () => { els.clear(); songEl.textContent = ""; render(); });
on("box", render);
on("selection", patchAll);
on("transport:section", patchAll);
on("transport:state", d => { patchAll(); if (!d.playing) paintProgress(-1, 0); });
