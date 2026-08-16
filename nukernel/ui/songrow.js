// ui/songrow.js — THE SONG TABLE (the ARRANGE page since "compose, arrange,
// mix", 2026-08-16), and since "the section speaks up" (2026-08-16) THE WHOLE
// PER-BOX INTERFACE: one row per section, built from NAMED CELLS —
// | PART | GENRE | FUNCTION | BARS# | PATTERN MODS | VOICE | RHYTHM |
// TRANSITIONS | — with a full-width PATTERN ROW beneath them carrying chunky
// thumbnails of THE PHRASES THAT LAYER PLAYS and no others, the whole bank
// folded away behind its [+] (see "the phrase thumbnails" below, and the
// phrase bank down beside mountCell) — and every cell is a tap
// target that UNFOLDS A MENU IN PLACE, an accordion panel inserted directly
// below the row that owns it (the floating cell popup is gone: the menu is a
// row of the table now, #rowpop wearing role="row", and the table simply gets
// taller while it is open). One menu at a time; tapping the same cell closes
// it, tapping any other cell swaps it. The menus are built from the palette's
// bank library (ui/palette.js mountBanks), plus the row-level keys this file
// owns: play-from-here, reorder, duplicate, delete and pin in the PART menu,
// the bars stepper in BARS#, the nudge stepper in PATTERN MODS.
//
// EVERY LAYER GETS ITS OWN LINE: a stacked box no longer compresses to
// "City pop +1" — each genre layered on the authority renders as an indented
// SUB-ROW under the parent, in the same key material, carrying what a layer
// owns: its genre, its voice, its mods, its phrase chips, and its own
// remove-layer key. The parent row speaks for the box and the AUTHORITY;
// deleting the parent (the PART menu's ✕) removes the whole family, because
// the sub-rows are just sec.stack drawn honestly. The GENRE menu still adds
// and removes layers — a dark chip grows a sub-row, a lit one removes it.
//
// AND A SECTION GROWS A LAYER BY HAND ("there's no way to add a subsection",
// Paul, 2026-08-16). Stacking a second genre was reachable only by finding
// the GENRE cell's menu and knowing that a dark chip there means "another
// line", which is a rule you have to be told — so the block ends in a
// [↳ + layer] KEY of its own (buildAdd/addLayer below), present at rest at
// every width, on every section, layered or not. It is the matched partner of
// each sub-row's ✕: the two verbs a layer has, in the row grammar itself,
// wearing the layer's own colour — the key wears the hue the NEXT layer will
// take. It cannot be read as the pattern strip's [+]: different words (the
// [+] is a bare glyph), different place (its own row at the foot of the
// block, never inside a "ptn" strip) and a different colour family (a layer
// hue against the strip's neutral dashed keys). Tapping it grows the layer
// AND opens that layer's own GENRE menu on it, so the new line means
// something before your finger leaves the glass — and in that scoped menu a
// chip BECOMES this layer's genre rather than stacking another (the scope
// note on ui/palette.js toggle()).
//
// (NOTHING IN A SECTION TELLS TIME: tempo, groove and swing are all the
// SONG's — the transport fader and the session bank's pickers — so there is
// no TIMING cell any more. Its two genuinely-per-pattern survivors moved
// into PATTERN MODS: the nudge stepper and the articulation bank — they
// modify how the pattern sits and speaks, which is what a mod is. A genre's
// own derived rate and lean are identity, not controls.)
//
// Rebuilding is still the sin: a row's element is keyed by the box object's
// identity (a sub-row by its stack entry's) and only its text and classes are
// patched. A "phrase" event still does not patch a ROW — it writes one
// <path d> per chip showing the edited phrase and nothing else
// (patchChipPaths, at the bottom), the contract that makes an editor scrub
// cheap.
//
// Layer graph: ui view — imports state/derive/deps and audio/transport (the
// one allowed direction; transport never calls back, it publishes).
import { GENRES, ROLES, KITLABEL, DRUMKITS,
         INLABEL, OUTLABEL,
         SINGLABEL, MAX_LEN, MAX_NUDGE, NSLOTS, blank, instrOf,
         emptyBox } from "./deps.js";
import { SONG, SLOTS, slot, viewSec, loopOnly, pendingStart, bpm, setViewSec,
         setLoopOnly, setPendingStart, setSlot, commit, on,
         POOL } from "./state.js";
import { stackOf, stackLabel, boxBars, secsOf, focusOf, opsOf, optOf,
         voxAll, kitOf, mmss, poolInstrOf } from "./derive.js";
import { playing, playingSec, startAt, resetBar } from "../audio/transport.js";
import { buzz } from "./touch.js";
// toggle() is the ONE dispatcher every chip goes through; mountBanks builds a
// cell's banks into the menu mount and refreshChips re-lights them per commit
import { toggle, mountBanks, refreshChips } from "./palette.js";
// a PATTERN thumbnail NAVIGATES to the COMPOSE PAGE on that phrase — the row
// is where you see the phrases, Compose is where you edit them ("compose,
// arrange, mix": one thing, one place — the modal died). thumbPath is the ONE
// drawing of a phrase — a MINIATURE OF THE COMPOSE GRID, so a preview looks
// like the thing you tap it to edit — shared with the Compose bank's pads so
// both surfaces agree what a phrase looks like.
import { openPhraseEditor, thumbPath } from "./editor.js";

const songEl = document.getElementById("song");
// TABLE SEMANTICS, honestly and everywhere: each section is a ROWGROUP now
// (its own row, its layer sub-rows, and — while open — the menu row), under
// one header row naming the columns.
songEl.setAttribute("role", "table");
songEl.setAttribute("aria-label", "song sections");

let dragFrom = null;
const els = new Map();                     // box object -> { grp, box, ... }

const idx = sec => SONG.indexOf(sec);
// loopOnly/pendingStart are SONG indices, and a reorder invalidates indices —
// the same law the row listeners follow ("close over the box object, never an
// index"). Capture the marked BOXES before the splice, re-find them after.
const keepMarks = () => {
  const lo = loopOnly != null ? SONG[loopOnly] : null;
  const ps = pendingStart != null ? SONG[pendingStart] : null;
  return () => {
    if (lo) setLoopOnly(SONG.indexOf(lo));
    if (ps) setPendingStart(SONG.indexOf(ps));
  };
};

/* ---------- the cell vocabulary ---------- */
// the column order IS the interface order — one definition, and every box
// row walks it. (It used to be walked twice: the header row read the same
// list to print its labels. The header is gone; CELLNAME below survives it,
// because the per-cell aria-labels are where those words do real work.)
// FUNCTION is the section-role cell (the word "function" is the brief's;
// "role" is the field's).
const CELLS = ["part", "genre", "role", "bars", "mods",
               "voice", "rhythm", "trans"];
const CELLNAME = { part: "part", genre: "genre", role: "function", bars: "bars",
                   mods: "pattern mods", voice: "voice",
                   rhythm: "rhythm", trans: "transitions",
                   // "ptn" is not a COLUMN — it is the pattern row's [+], which
                   // unfolds the phrase bank through the same menu machinery
                   ptn: "patterns" };

/* ---------- (there is no column header) ----------
   The silkscreened row that named # · GENRE · FUNCTION · BARS · MODS · VOICE
   · RHYTHM · TRANSITIONS across the top of the table is DELETED — DOM, CSS
   and the .hf/.ha phone abbreviation swap with it ("get rid of headers and
   help buttons and table headers", Paul, 2026-08-16).

   It goes because every one of those columns already prints a self-naming
   value in its own cells: the genre cell says the genre and the city and
   year it comes from, the length cell says "4 bars", the function cell says
   VERSE, and an unset cell says "—" beside its own icon. The header was the
   table repeating itself in capitals above itself. The cells' aria-labels
   (set in cell(), unchanged) carry the column name for anyone who cannot
   see the row, which is the only place the words were doing real work. */

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
// THREE CALLERS, ONE MOVE: the PART menu's ↑ ↓ (the touch path), ALT+ARROW on
// the focused row (the keyboard path), and drag-and-drop (the desk path). It
// closes over the BOX OBJECT and looks its index up at call time, the law
// every listener in this file follows.
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

/* ---------- the phrase thumbnails ---------- */
// THE PATTERN ROW ("make the little patterns visualization big and chunky —
// on their own row"): chunky THUMBNAILS on a full-width strip beneath the
// row's cells — a real drawing of each phrase (thumbPath: the Compose grid at
// 1:8, sixteen steps across, gate/acc/sld lanes over a mini piano roll), with
// the PHRASE NUMBER SUPERIMPOSED on the drawing (see .bcn in kernel-daw.css:
// a big translucent numeral centred over the grid with a key-coloured halo —
// centred because the drawing fills its whole face, so no corner is reliably
// empty, and translucent so a dense phrase still reads through it while an
// empty one is not just a blank key).
//
// A SECTION SHOWS THE PATTERNS IT PLAYS, AND ONLY THOSE ("don't include all
// the patterns in the song section — just the active ones", 2026-08-16). The
// strip is the layer's `slots` list in PLAY ORDER, one thumbnail each, plus
// the [+]. The whole bank — every phrase the song has, lit where this layer
// plays it and dim where it does not — lives BEHIND that [+], in the same
// inline menu row every cell unfolds (popCell "ptn", buildPtnBank below):
// that is where a phrase is switched IN, and it is still one of the two ways
// it comes out.
//
// AND EVERY THUMBNAIL ON THE ROW WEARS ITS OWN ✕ ("there's no way to remove a
// pattern", Paul, 2026-08-16). The bank's toggle-off worked, and nobody could
// find it: an affordance you have to be told about has failed, whatever the
// reasoning. So removal is now ON THE STRIP, visible at rest, at every width.
// It is NOT a ✕ floated inside the 46px face — that is the mis-tap the last
// pass rightly refused. It is an ATTACHED LANE: the thumbnail keeps its whole
// drawing as the tap-to-Compose target, and a 32px-wide key stands full-height
// beside it behind a dashed seam, two zones that never overlap. 32 × 46 clears
// the AA floor on the axis that matters and gives the thumb the full height of
// the key as slop. The verb is the same toggle("phrase") the bank chip makes,
// so it is exactly as reversible: tap [+], tap the dim thumbnail, it is back.
//
// The parent's strip speaks for the authority, each sub-row's for its layer.
// `ent` is the stack entry the strip belongs to (null = the authority); the
// layer index is looked up at CLICK time, because removing a middle layer
// renumbers the ones after it.
const SVGNS = "http://www.w3.org/2000/svg";
// the thumbnail FACE, shared by the row strips and the bank behind [+]: the
// number over the drawing, one <path> to patch. Callers add the behaviour.
function thumbFace(si, cls) {
  const b = document.createElement("button");
  b.type = "button"; b.className = cls;
  const mini = document.createElementNS(SVGNS, "svg");
  mini.setAttribute("class", "bcmini");
  mini.setAttribute("viewBox", "0 0 64 24");
  mini.setAttribute("preserveAspectRatio", "none");
  mini.setAttribute("aria-hidden", "true");
  const line = document.createElementNS(SVGNS, "path");
  mini.append(line);
  // the numeral rides OVER the drawing (absolutely placed in CSS), so it is
  // painted after it and marked decorative — the accessible name says the
  // phrase number in words
  const bcn = Object.assign(document.createElement("b"),
    { className: "bcn", textContent: String(si + 1) });
  bcn.setAttribute("aria-hidden", "true");
  b.append(mini, bcn);
  return { b, line, si };
}
function buildChip(sec, ent, si) {
  const c = thumbFace(si, "bch");
  c.b.addEventListener("click", ev => {
    ev.stopPropagation();                 // the row click opens the PART menu
    const at = idx(sec);
    closePop();                           // one open surface at a time
    setViewSec(at);
    sec.focus = ent ? Math.max(0, stackOf(sec).indexOf(ent)) : 0;
    setSlot(si);
    commit("selection");
    openPhraseEditor({ slot: si });
    buzz(4);
  });
  // THE REMOVE KEY, ATTACHED. A sibling of the face, not a child — a button
  // inside a button is not a document — so the pair rides a .bchw wrapper and
  // the strip inserts THAT. It takes this phrase off THIS layer through the
  // one dispatcher (toggle "phrase" on a slot the layer holds = splice), which
  // commits, which repaints the strip and the open bank together.
  const rx = btn("bcx", "✕", "remove phrase " + (si + 1), () => {
    const at = idx(sec);
    if (at < 0) return;
    setViewSec(at);
    sec.focus = ent ? Math.max(0, stackOf(sec).indexOf(ent)) : 0;
    toggle("phrase", si);                 // in the layer -> takes it out; commits
    buzz(4);
  });
  const w = document.createElement("span");
  w.className = "bchw";
  w.append(c.b, rx);
  c.w = w; c.rx = rx;
  return c;
}
// the trailing [+]: the door to the BANK. It unfolds the phrase bank as a
// menu row under this row (the same accordion every cell uses) — where
// phrases are switched into and out of this layer, and where a new one is
// grown. It is never hidden: at a full bank there is still a bank to edit.
function buildPlus(sec, ent) {
  return btn("bch bplus", "+", "phrases", () => {
    const at = idx(sec);
    if (at < 0) return;
    if (popFor === sec && popCell === "ptn" && popEnt === (ent || null)) {
      closePop(); return;                 // the same key again: a toggle
    }
    setViewSec(at);
    sec.focus = ent ? Math.max(0, stackOf(sec).indexOf(ent)) : 0;
    openPop(sec, "ptn", ent);
  });
}
// GROW A NEW PHRASE — the action that used to be the [+] itself: it makes a
// phrase, switches it into this layer, and lands on Compose editing it.
function growPhrase(sec, ent) {
  const at = idx(sec);
  if (at < 0 || SLOTS.length >= NSLOTS) return;
  setViewSec(at);
  sec.focus = ent ? Math.max(0, stackOf(sec).indexOf(ent)) : 0;
  SLOTS.push(blank());
  const si = SLOTS.length - 1;
  setSlot(si);
  commit("phrase");
  toggle("phrase", si);                   // onto the FOCUSED layer; it commits
  closePop();
  openPhraseEditor({ slot: si });
  buzz(4);
}

/* ---------- + LAYER: the key that grows a sub-row ---------- */
// THE SEED GENRE. A layer has to be some genre the moment it exists, and the
// stack keeps its genre keys UNIQUE (ui/derive.js poolInstrOf looks a layer up
// by key), so the seed is "simple" — the blank kernel, which is what a
// not-yet-decided line honestly is — unless the box already plays it, in which
// case the first free key stands in. Either way the GENRE menu opens on the
// new line in the same gesture, so the seed is what you see for one tap.
function seedGenre(sec) {
  const has = k => stackOf(sec).some(e => e.g === k);
  return has("simple") ? (Object.keys(GENRES).find(k => !has(k)) || "simple")
                       : "simple";
}
// GROW A LAYER. It writes the same shape the GENRE menu's chip writes —
// palette.js's law, kept: a new layer INHERITS THE AUTHORITY'S PHRASES so it
// sounds the moment it appears — then lands you in that layer's own genre
// menu. commit("box") builds the sub-row (render → patchBox) BEFORE openPop
// asks for it, which is why the order here is push, commit, open.
function addLayer(sec) {
  const at = idx(sec);
  if (at < 0 || !sec.stack || !sec.stack.length) return;
  const ent = { g: seedGenre(sec), slots: [...sec.stack[0].slots] };
  sec.stack.push(ent);
  sec.focus = sec.stack.length - 1;
  setViewSec(at);
  commit("box");
  openPop(sec, "genre", ent);
  buzz(4);
}
// the key itself: WORDS, not a glyph — "+ layer" is the whole point of the
// affordance, and the ↳ mark is the same one the sub-rows wear, so the eye
// reads the key as the empty next line of the family.
function buildAdd(sec) {
  const row = document.createElement("div");
  row.className = "laddrow";
  row.setAttribute("role", "row");
  const cellEl = document.createElement("span");
  cellEl.className = "laddcell"; cellEl.setAttribute("role", "cell");
  const key = btn("laddk", "", "add a layer", () => addLayer(sec));
  const mark = Object.assign(document.createElement("span"),
    { className: "lam", textContent: "↳" });
  mark.setAttribute("aria-hidden", "true");
  key.append(mark, Object.assign(document.createElement("span"),
    { className: "lat", textContent: "+ layer" }));
  cellEl.append(key);
  row.append(cellEl);
  return { row, key };
}

/* ---------- build once per box ---------- */
// Listeners close over the BOX OBJECT, never over an index — a box that has
// been dragged three places up is still the same object, so its element and
// its handlers survive the move and the index is looked up at event time.
function buildBox(sec) {
  const grp = document.createElement("div");
  grp.className = "bgrp";
  grp.setAttribute("role", "rowgroup");
  const box = document.createElement("div");
  box.className = "box";
  box.setAttribute("role", "row");
  box.draggable = true;
  grp.append(box);
  // EVERY CELL IS BUILT ONCE and patched by textContent/class, never by
  // innerHTML — rebuilding destroys the button under the pointer mid-click
  // (the exact failure palette.js documents having fixed once).
  // A cell is a real <button role="cell">: icon silkscreen + the compact
  // current value, and tapping it unfolds ITS menu below the row.
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
      if (popFor === sec && popCell === k && !popEnt) { closePop(); return; }
      setViewSec(i);
      // the parent's layer-scope cells edit the AUTHORITY — the sub-rows are
      // where the other layers' versions of these cells live
      if (k === "voice" || k === "mods") sec.focus = 0;
      openPop(sec, k, null);
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
  const bu = Object.assign(document.createElement("span"), { className: "bu" });
  const bd = Object.assign(document.createElement("span"), { className: "bd" });
  vals.bars.append(bn, bu, bd);
  // THE PATTERN ROW — a full-width strip beneath the cells carrying the
  // AUTHORITY's thumbnails (each sub-row carries its own), one per bank
  // phrase, lit/dim by in-this-layer, plus the trailing [+]. It spans the
  // row's grid (CSS: grid-column 1/-1) and wears its own silkscreen.
  const ph = document.createElement("div");
  ph.className = "bchips"; ph.setAttribute("role", "cell");
  const plab = Object.assign(document.createElement("span"),
    { className: "bplab", textContent: "ptn" });
  plab.setAttribute("aria-hidden", "true");
  const plus = buildPlus(sec, null);
  ph.append(plab, plus);
  const prog = document.createElement("div"); prog.className = "bprog";
  const fill = Object.assign(document.createElement("i"), { className: "fillbar" });
  prog.append(fill);
  box.append(...CELLS.map(k => cells[k]), ph, prog);

  // REORDER — rows drag among themselves, and that is all dragging does now.
  // The handlers live on the parent row; the whole rowgroup moves with it.
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

  // the ROW itself (the gaps between cells) opens the PART menu — the row's
  // "default" cell, so a miss on a cell still lands on the box's own options.
  // While ANOTHER row's menu is up, a tap only dismisses it (the auto-dismiss
  // rule). DOUBLE-CLICK still loops this row alone, and closes whatever the
  // first click opened.
  box.addEventListener("click", () => {
    const i = idx(sec);
    if (popFor && popFor !== sec) { closePop(); setViewSec(i); commit("selection"); return; }
    if (popFor === sec) { closePop(); return; }   // same row: a toggle
    setViewSec(i);
    openPop(sec, "part", null);
  });
  // ...and the same door from the keyboard: the row is a tab stop, Enter or
  // Space opens its PART menu (each cell is a real button and its own stop).
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
    openPop(sec, "part", null);
  });
  box.addEventListener("dblclick", () => {
    const i = idx(sec);
    closePop();
    setViewSec(i); setLoopOnly(i);
    commit("selection");
    startAt(i);
  });

  // ...and the block's last row is the key that grows the next layer, built
  // once with the box and never conditional: a section with no layers yet is
  // exactly the one that needs to be told it can have them.
  const add = buildAdd(sec);

  return { grp, box, cells, vals, num, pinLamp, bn, bu, bd, plus,
           ph, chips: [], chipsSig: "", fill, subs: new Map(),
           addRow: add.row, addKey: add.key };
}

/* ---------- the layer sub-rows ---------- */
// ONE PER EXTRA GENRE, keyed by the STACK ENTRY object the way the parent row
// is keyed by the box: the element and its handlers survive reorders and
// other layers' removal. A sub-row carries what a layer owns — its genre,
// its voice, its mods, its phrase chips — and its own remove-layer key; the
// box-level cells (bars, rhythm, transitions, function) stay on the
// parent, because the authority owns them for the whole family.
function buildSub(sec, ent) {
  const row = document.createElement("div");
  row.className = "lrow";
  row.setAttribute("role", "row");
  const focusMe = () => {
    const i = idx(sec);
    setViewSec(i);
    sec.focus = Math.max(0, stackOf(sec).indexOf(ent));
  };
  const mark = document.createElement("span");
  mark.className = "lmark"; mark.setAttribute("role", "cell");
  mark.textContent = "↳"; mark.setAttribute("aria-hidden", "true");
  const mkCell = (k, extra) => {
    const b2 = document.createElement("button");
    b2.type = "button";
    b2.className = "bcell c-" + k + " " + (extra || "");
    b2.dataset.cell = k;
    b2.setAttribute("role", "cell");
    const ci = document.createElement("span");
    ci.className = "ci"; ci.setAttribute("aria-hidden", "true");
    b2.append(ci);
    const v = document.createElement("span");
    v.className = "cvx";
    b2.append(v);
    b2.addEventListener("click", ev => {
      ev.stopPropagation();
      if (popFor === sec && popCell === k && popEnt === ent) { closePop(); return; }
      focusMe();
      openPop(sec, k, ent);
    });
    return { b2, v };
  };
  const g = mkCell("genre", "bgenre lsub");
  const vo = mkCell("voice", "lsub");
  const mo = mkCell("mods", "lsub");
  const ph = document.createElement("div");
  ph.className = "bchips"; ph.setAttribute("role", "cell");
  // A LAYER'S STRIP SAYS IT IS A STRIP, exactly like the parent's. It used to
  // be the one pattern row on the page with no tag, which left a bare run of
  // thumbnails floating under a row of cells — the reader had to infer the
  // ownership from an alignment that (see the phone grid in kernel-daw.css)
  // was not even true. The tag wears the layer's hue; the spine down the
  // sub-row's left edge wears the same one.
  const plab = Object.assign(document.createElement("span"),
    { className: "bplab", textContent: "ptn" });
  plab.setAttribute("aria-hidden", "true");
  const plus = buildPlus(sec, ent);
  ph.append(plab, plus);
  // THE ONE DELETE A LAYER HAS, and the MATCHED PARTNER of the block's
  // [+ layer] key — same family, opposite verb, both in the row grammar and
  // both visible at rest. The parent's ✕ (PART menu) takes the whole family;
  // this key takes only this layer. It passes the ENTRY as the scope, so the
  // splice is by identity rather than by genre key.
  const del = btn("lrx", "✕", "remove this layer", () => {
    const at = idx(sec);
    if (at < 0) return;
    if (popFor === sec && popEnt === ent) closePop();
    setViewSec(at);
    toggle("genre", ent.g, ent);          // this entry, exactly; it commits
    buzz(4);
  });
  const dcell = document.createElement("span");
  dcell.className = "ldel"; dcell.setAttribute("role", "cell");
  dcell.append(del);
  row.append(mark, g.b2, vo.b2, mo.b2, ph, dcell);
  // the gaps of a sub-row focus its layer (and dismiss another row's menu),
  // the parent-row law one level down
  row.addEventListener("click", () => {
    if (popFor && popFor !== sec) closePop();
    focusMe();
    commit("selection");
  });
  return { row, ent, gcell: g.b2, gval: g.v, vcell: vo.b2, vval: vo.v,
           mcell: mo.b2, mval: mo.v, ph, plus, del,
           chips: [], chipsSig: "" };
}

/* ---------- the compact cell values ---------- */
// the row reads as a summary line of the whole section: every cell shows its
// current value in a word or two, and "—" is the honest spelling of unset.
// (no timingFact any more: the TIMING cell is gone — nothing in a section
// tells time. Its per-pattern survivors count into the MODS fact below.)
function modsFact(sec, fe) {
  const n = opsOf(sec, fe).length +
    (sec.period ? 1 : 0) + (sec.breath ? 1 : 0) + (sec.pipe ? 1 : 0) +
    // the two that moved in from the retired timing cell: a set nudge and a
    // set articulation are mods of how the pattern sits and speaks
    (sec.nudge ? 1 : 0) + (optOf(sec, fe, "artic") ? 1 : 0);
  return n ? n + (n === 1 ? " op" : " ops") : "—";
}
function voiceFact(sec, fe) {
  const g = GENRES[fe.g];
  // the RESOLVED voice word, the scheduler's own switch: the SONG POOL's pick
  // for this chair beats the signature synth (you asked for a rhodes, not a
  // 303 wearing one — the band is hired for the record), the synth beats the
  // genre's sampled instrument, and a singing box says its singer
  const over = poolInstrOf(sec, fe.g, 0, POOL);
  const base = sec.sing ? SINGLABEL[sec.sing]
    : over ? String(over).replace(/_/g, " ")
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

/* ---------- thumbnail reconciliation, shared by row and sub-row ---------- */
// ONE THUMBNAIL PER PHRASE THIS LAYER PLAYS, in the order the slots list
// carries them, and nothing else — the bank lives behind [+]. So the strip is
// rebuilt when THAT LIST changes (its signature is the list itself, not the
// bank's size): switching a phrase in or out is exactly the structural edit
// the built-once law carves out, and it is a menu tap, not a scrub.
// `holder` is the row/sub record carrying {ph, plus, chips, chipsSig}.
function syncChips(sec, ent, slots, holder) {
  const sig = slots.join(",");
  if (holder.chipsSig !== sig) {
    holder.chipsSig = sig;
    // the strip's flex children are the WRAPPERS (face + its ✕), not the faces
    for (const c of holder.chips) (c.w || c.b).remove();
    holder.chips.length = 0;
    for (const si of slots) {
      const c = buildChip(sec, ent, si);
      holder.chips.push(c); holder.ph.insertBefore(c.w, holder.plus);
    }
  }
  // A LAYER THAT PLAYS NOTHING SAYS SO by showing only its [+]: an empty
  // strip is the honest picture of a section with no pattern switched in,
  // where five dim thumbnails used to imply five it might be playing.
  holder.ph.className = "bchips has" + (slots.length ? "" : " none");
}
function patchChips(sec, i, slots, holder, layerWord) {
  for (const c of holder.chips) {
    // every thumbnail on the strip is one this layer PLAYS — .on is what the
    // key material reads as "in the section"; dim/lit lives in the bank now
    c.b.classList.add("on");
    // LIT = SOUNDING: the transport publishes the sounding SECTION, and every
    // phrase in the sounding box sounds at once, so the lamp is per section.
    c.b.classList.toggle("lit", i === playingSec);
    // ...and the ring is the EDIT target: this row selected, this phrase open
    c.b.classList.toggle("sel", i === viewSec && slot === c.si);
    const p = SLOTS[c.si];
    if (p) {
      const d = thumbPath(p);
      if (c.line.getAttribute("d") !== d) c.line.setAttribute("d", d);
    }
    c.b.setAttribute("aria-label", "phrase " + (c.si + 1) +
      " in box " + (i + 1) + layerWord + " — opens it on the compose page");
    if (c.rx) c.rx.setAttribute("aria-label", "remove phrase " + (c.si + 1) +
      " from box " + (i + 1) + layerWord);
  }
}

/* ---------- patch on every change ---------- */
function patchBox(sec, i, el) {
  const bars = boxBars(sec);
  const st = stackOf(sec);
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

  const put = (k, txt) => {
    if (el.vals[k].textContent !== txt) el.vals[k].textContent = txt;
    el.cells[k].classList.toggle("unset", txt === "—");
  };
  // the GENRE cell names the AUTHORITY, and only it — the riders are whole
  // sub-rows now, not a "+1" rider count
  el.cells.genre.classList.add("has");
  put("genre", GENRES[st[0].g].label);
  el.cells.genre.setAttribute("aria-label",
    "box " + (i + 1) + " genre: " + stackLabel(sec));
  put("role", sec.role ? ROLES[sec.role] : "—");
  el.cells.role.setAttribute("aria-label", "box " + (i + 1) + " function: " +
    (sec.role ? ROLES[sec.role] : "not set"));
  // THE BARS CELL IS WHERE LENGTH LIVES. The number is the honest answer —
  // and the number is the half a phone keeps: the unit word (.bu) and the
  // clock (.bd) drop away under 900px, the header column already says "bars".
  el.bn.textContent = String(bars) + (sec.nudge ? "+" + sec.nudge : "");
  el.bu.textContent = " bar" + (bars === 1 ? "" : "s");
  el.bd.textContent = "· " + mmss(secsOf(sec, bpm));
  el.cells.bars.setAttribute("aria-label",
    "box " + (i + 1) + " length: " + bars + " bars");

  // the parent row's layer-scope cells SPEAK FOR THE AUTHORITY — each other
  // layer's voice and mods live on its own sub-row
  const fe = st[0];
  put("mods", modsFact(sec, fe));
  put("voice", voiceFact(sec, fe));
  put("rhythm", rhythmFact(sec));
  put("trans", transFact(sec));
  for (const k of ["mods", "voice", "rhythm", "trans"])
    el.cells[k].setAttribute("aria-label",
      "box " + (i + 1) + " " + CELLNAME[k] + ": " + el.vals[k].textContent);
  // the open cell reads pressed/expanded; every other cell reads closed
  for (const k of CELLS) {
    const open = popFor === sec && !popEnt && popCell === k;
    el.cells[k].setAttribute("aria-expanded", String(open));
    el.cells[k].classList.toggle("openc", open);
  }

  // the authority's own pattern row
  syncChips(sec, null, st[0].slots, el);
  el.plus.setAttribute("aria-label",
    "phrases in box " + (i + 1) + " — open the phrase bank");
  el.plus.setAttribute("aria-expanded",
    String(popFor === sec && !popEnt && popCell === "ptn"));
  el.plus.classList.toggle("openc",
    popFor === sec && !popEnt && popCell === "ptn");
  patchChips(sec, i, st[0].slots, el, "");

  // THE SUB-ROWS: one per extra layer, keyed by the entry object — build the
  // new, drop the gone, order the rest; then patch text and state in place.
  for (const [ent, sub] of [...el.subs])
    if (!st.includes(ent)) { sub.row.remove(); el.subs.delete(ent); }
  for (const ent of st.slice(1))
    if (!el.subs.has(ent)) el.subs.set(ent, buildSub(sec, ent));
  st.slice(1).forEach((ent, k) => {
    const li = k + 1, sub = el.subs.get(ent);
    const focusedHere = i === viewSec && focusOf(sec) === li;
    sub.row.className = "lrow" +
      (focusedHere ? " foc" : "") + (i === playingSec ? " live" : "") +
      (popFor === sec && popEnt === ent ? " open" : "");
    // THE LAYER'S HUE, dealt by POSITION IN THE STACK and written every patch
    // because removing a middle layer renumbers the ones after it. The CSS
    // holds four (--v0..--v3) and cycles; colour is the category carrier
    // here, saying WHICH LAYER — the spine down the sub-row, the ↳, and the
    // "ptn" tag over its own pattern strip all read this one variable.
    sub.row.dataset.li = String(((li - 1) % 4) + 1);
    sub.row.setAttribute("aria-label", "box " + (i + 1) + " layer: " +
      GENRES[ent.g].label);
    if (sub.gval.textContent !== GENRES[ent.g].label)
      sub.gval.textContent = GENRES[ent.g].label;
    sub.gcell.setAttribute("aria-label", "box " + (i + 1) + " layer " +
      li + " genre: " + GENRES[ent.g].label);
    const vtxt = voiceFact(sec, ent), mtxt = modsFact(sec, ent);
    if (sub.vval.textContent !== vtxt) sub.vval.textContent = vtxt;
    sub.vcell.classList.toggle("unset", vtxt === "—");
    sub.vcell.setAttribute("aria-label", "box " + (i + 1) + " layer " +
      li + " voice: " + vtxt);
    if (sub.mval.textContent !== mtxt) sub.mval.textContent = mtxt;
    sub.mcell.classList.toggle("unset", mtxt === "—");
    sub.mcell.setAttribute("aria-label", "box " + (i + 1) + " layer " +
      li + " pattern mods: " + mtxt);
    for (const [cellEl, k2] of [[sub.gcell, "genre"], [sub.vcell, "voice"],
                                [sub.mcell, "mods"]]) {
      const open = popFor === sec && popEnt === ent && popCell === k2;
      cellEl.setAttribute("aria-expanded", String(open));
      cellEl.classList.toggle("openc", open);
    }
    sub.del.setAttribute("aria-label",
      "remove layer " + GENRES[ent.g].label + " from box " + (i + 1));
    syncChips(sec, ent, ent.slots, sub);
    sub.plus.setAttribute("aria-label",
      "phrases in the " + GENRES[ent.g].label + " layer of box " + (i + 1) +
      " — open the phrase bank");
    const pop = popFor === sec && popEnt === ent && popCell === "ptn";
    sub.plus.setAttribute("aria-expanded", String(pop));
    sub.plus.classList.toggle("openc", pop);
    patchChips(sec, i, ent.slots, sub, ", " + GENRES[ent.g].label + " layer");
  });

  // THE + LAYER KEY wears the hue the NEXT layer will take (the sub-rows deal
  // --lhue by position and the CSS holds four, cycling), so the empty line at
  // the foot of the block is already the colour of the line it makes.
  el.addRow.dataset.li = String(((st.length - 1) % 4) + 1);
  el.addKey.setAttribute("aria-label", "add a layer to box " + (i + 1));

  // ROW ORDER INSIDE THE GROUP: parent, then each sub-row in stack order,
  // with the OPEN MENU inserted directly after the row whose cell opened it,
  // and the [+ layer] key LAST — the block always ends in the way to grow it.
  // insertBefore only where the order is wrong — re-inserting an unmoved node
  // would drop the key under the finger mid-tap (the menu itself never
  // scrolls; it opens at full height and the page scrolls instead).
  const want = [el.box];
  if (popFor === sec && !popEnt) want.push(rowpop);
  for (const ent of st.slice(1)) {
    want.push(el.subs.get(ent).row);
    if (popFor === sec && popEnt === ent) want.push(rowpop);
  }
  want.push(el.addRow);
  want.forEach((node, k) => {
    if (el.grp.children[k] !== node)
      el.grp.insertBefore(node, el.grp.children[k] || null);
  });
}
function patchAll() { SONG.forEach((sec, i) => { const el = els.get(sec); if (el) patchBox(sec, i, el); }); }

/* ---------- the two table keys, built once ---------- */
// COPY duplicates the selected box — everything, including its transforms and
// its layers. They sit in a footer ROW of the table, not floating beside the
// last section: the table has one column layout and these are not a section.
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

/* ---------- the inline cell menu ---------- */
// ONE menu element for every cell: the #rowpop shell, A ROW OF THE TABLE —
// inserted directly below the row whose cell is open (patchBox owns the
// placement), never floating, never a bottom sheet, at every width. The
// mount holds only the OPEN cell's controls. Chip clicks commit and the menu
// PATCHES, never closes — a chain of edits is one visit. Dismiss: ✕, Esc,
// tapping the open cell again; AUTO-dismiss on another row's tap, a page
// switch, a new song. (No scrim: the table is not covered, it is unfolded.)
let popFor = null;                          // the box object the menu is on
let popCell = null;                         // which cell opened it
let popEnt = null;                          // the stack entry, if a sub-row's
const rowpop = Object.assign(document.createElement("div"),
  { className: "rowpop", id: "rowpop", hidden: true });
rowpop.setAttribute("role", "row");
const rpCell = Object.assign(document.createElement("div"), { className: "rpcell" });
rpCell.setAttribute("role", "cell");
const rpTitle = Object.assign(document.createElement("span"),
  { className: "rptitle", textContent: "box" });
const rpX = btn("rpk rpx", "✕", "close the cell options", () => closePop());
const rpHead = Object.assign(document.createElement("div"), { className: "rphead" });
rpHead.append(rpTitle, rpX);
const rpMount = Object.assign(document.createElement("div"), { className: "rpmount" });
rpCell.append(rpHead, rpMount);
rowpop.append(rpCell);
document.body.append(rowpop);               // parked here whenever closed

// THE PART MENU'S KEYS — the row-level operations: play from here, the
// touch-path reorder, duplicate, delete, pin. Built once, moved into the
// mount when the PART cell opens. The ✕ here is the ONLY delete at parent
// level, and it takes the sub-rows with the row — sec.stack goes as one.
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
// lives in the BARS# menu, NUDGE in PATTERN MODS — it moved there when the
// TIMING cell retired: a nudge modifies where the pattern SITS in the form,
// which is a mod of the pattern, not the song's clock.
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

/* ---------- the PHRASE BANK, behind the pattern row's [+] ---------- */
// THE WHOLE BANK LIVES HERE now, not on the row: every phrase the song has,
// as the same chunky numbered thumbnail, LIT where this layer plays it and
// DIM where it does not — the on/off state the row used to carry, moved to
// the one surface whose verb is on/off. A tap toggles the phrase into or out
// of the layer the menu was opened from (that is also THE REMOVE: taking a
// phrase off a section is a tap on its lit thumbnail HERE, so a tap on the
// row's thumbnail can keep meaning "open it on Compose"). The trailing key
// grows a new phrase and lands on Compose editing it, which is what the row's
// [+] used to do directly.
//
// Built fresh per open (the mount is emptied anyway, and a bank is a dozen
// nodes); patched by patchBank on every commit while it is up.
let bankChips = [];
function buildPtnBank(sec, ent) {
  bankChips = [];
  const g = document.createElement("div");
  g.className = "pgroup tbl rpptn";
  g.append(Object.assign(document.createElement("span"),
    { className: "plabel",
      textContent: "phrase bank · tap to switch in or out" }));
  const wrap = document.createElement("div");
  wrap.className = "bchips bank";
  for (let si = 0; si < SLOTS.length; si++) {
    const c = thumbFace(si, "bch bbk");
    c.b.dataset.kind = "phrase"; c.b.dataset.value = String(si);
    c.b.addEventListener("click", ev => {
      ev.stopPropagation();
      const at = idx(sec);
      if (at < 0) return;
      setViewSec(at);
      sec.focus = ent ? Math.max(0, stackOf(sec).indexOf(ent)) : 0;
      toggle("phrase", si);              // in or OUT of this layer; it commits
      buzz(4);
    });
    bankChips.push(c); wrap.append(c.b);
  }
  const grow = btn("bch bplus bbknew", "+", "grow a new phrase",
    () => growPhrase(sec, ent));
  grow.hidden = SLOTS.length >= NSLOTS;
  wrap.append(grow);
  g.append(wrap);
  rpMount.append(g);
}
// the bank's lights follow every commit, the same contract refreshChips has
function patchBank() {
  if (popCell !== "ptn" || !popFor) return;
  const ent = popEnt || stackOf(popFor)[0];
  const slots = ent ? ent.slots : [];
  const i = SONG.indexOf(popFor);
  for (const c of bankChips) {
    const inLayer = slots.includes(c.si);
    c.b.classList.toggle("on", inLayer);
    c.b.classList.toggle("lit", inLayer && i === playingSec);
    c.b.setAttribute("aria-pressed", String(inLayer));
    const p = SLOTS[c.si];
    if (p) {
      const d = thumbPath(p);
      if (c.line.getAttribute("d") !== d) c.line.setAttribute("d", d);
    }
    c.b.setAttribute("aria-label", "phrase " + (c.si + 1) +
      (inLayer ? " — playing here, tap to take it out"
               : " — not here, tap to switch it in"));
  }
}

// WHAT EACH CELL MOUNTS: its own keys first, then its banks. The keys are
// built once above and MOVED in (one of each exists); the banks are rebuilt
// per open — they are cheap, and the mount is emptied anyway. (The GENRE
// menu's old focus list is gone: the sub-rows ARE the layer list now.)
function mountCell(sec, kind) {
  rpMount.textContent = "";
  if (kind === "part") rpMount.append(rpKeys);
  else if (kind === "bars") rpMount.append(rpBars);
  else if (kind === "ptn") buildPtnBank(sec, popEnt);
  // popEnt rides along as the LAYER SCOPE: a menu a sub-row opened edits that
  // layer, which for GENRE is the difference between "become this" and
  // "stack another" (ui/palette.js toggle()).
  else if (kind === "mods") { rpMount.append(rpNud); mountBanks("mods", rpMount, popEnt); }
  else mountBanks(kind, rpMount, popEnt);
}

function openPop(sec, kind, ent) {
  popFor = sec; popCell = kind; popEnt = ent || null;
  mountCell(sec, kind);
  rowpop.hidden = false;
  commit("selection");                     // the ring moves; every view repaints
  patchPop();
  patchAll();                              // places the menu row + .open states
  // the menu unfolds to its FULL height below the row — the page makes room,
  // the menu never scrolls — so pin the OWNING ROW near the top of the view
  // (it is the menu's title bar) and the whole fold stands below it, visible
  // even when the tap landed at the bottom of the glass.
  //
  // TWO HARD-WON RULES ABOUT THAT NUDGE (2026-08-16, "I can't remove sections
  // any more"). The pin used to be an unconditional SMOOTH scroll, and a
  // smooth scroll is three hundred milliseconds of every key on the page
  // being a moving target: a thumb that opened the PART menu and went for its
  // ✕ tapped a key that was mid-flight — touchstart on the key, touchend on
  // whatever slid under it, NO click — and the miss landed on a neighbouring
  // cell, which opened ITS menu, which scrolled again. Every delete sat
  // behind exactly that animation, so "remove" was the verb that died first.
  //   1. NEVER SCROLL WHEN NOTHING NEEDS IT: if the owning row and the whole
  //      fold are already inside the glass (clear of the sticky chrome), the
  //      menu opens with ZERO displacement and the keys are exactly where the
  //      eye already is. The PART menu — the short one, the one with the
  //      delete — almost always takes this path.
  //   2. WHEN A SCROLL IS EARNED, IT IS INSTANT: block:"start" with the
  //      default behavior lands settled inside the same frame, so by the time
  //      the finger comes back for its second tap nothing is in motion.
  // (Every gate clicked through the old animation happily — a driver re-aims
  // after scrolling, a thumb does not, which is why this shipped green.)
  requestAnimationFrame(() => {
    try {
      const anchor = rowpop.previousElementSibling || rowpop;
      const a = anchor.getBoundingClientRect();
      const m = rowpop.getBoundingClientRect();
      // the glass between the sticky chrome: below the transport bar, above
      // the page rail (which only exists to measure on a phone)
      const bar = document.querySelector(".transport");
      const rail = document.querySelector(".pagerail");
      const top = bar ? bar.getBoundingClientRect().bottom : 0;
      const bot = rail && rail.getBoundingClientRect().height && rail.getBoundingClientRect().top < innerHeight
        ? rail.getBoundingClientRect().top : innerHeight;
      const fits = a.top >= top && m.bottom <= bot;
      if (!fits) anchor.scrollIntoView({ block: "start" });
    } catch (e) {}
  });
  rpX.focus({ preventScroll: true });
  buzz(4);
}
function closePop() {
  if (!popFor) return;
  popFor = null; popCell = null; popEnt = null;
  rowpop.hidden = true;
  document.body.append(rowpop);            // park it out of the table
  patchAll();
}
function patchPop() {
  if (!popFor) return;
  const i = SONG.indexOf(popFor);
  if (i < 0) { closePop(); return; }       // the box was removed under it
  if (popEnt && !stackOf(popFor).includes(popEnt)) { closePop(); return; }
  rpTitle.textContent = "box " + (i + 1) +
    (popEnt ? " · " + GENRES[popEnt.g].label : "") +
    " · " + CELLNAME[popCell];
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
  if (popCell === "mods") rpNudge.lcd.textContent = String(popFor.nudge);
  patchBank();                             // ...and so do the phrase thumbnails
  refreshChips(rpMount);                   // the banks follow every commit
}
addEventListener("keydown", ev => {
  if (popFor && ev.key === "Escape") { closePop(); ev.preventDefault(); }
});
on("page", () => closePop());              // the rail moved: the row is gone
on("song", () => closePop());              // a whole new song
on("box", patchPop);                       // LCDs and chip lights follow edits
on("selection", patchPop);

/* ---------- structural sync ---------- */
// create elements for new boxes, drop the ones whose box is gone, put the rest
// in SONG order (append moves an existing rowgroup), then patch everything
export function render() {
  const keep = songEl.scrollTop;           // the table grows DOWN and scrolls
  for (const [sec, el] of [...els]) if (!SONG.includes(sec)) {
    if (popFor === sec) closePop();
    el.grp.remove(); els.delete(sec);
  }
  for (const sec of SONG) if (!els.has(sec)) els.set(sec, buildBox(sec));
  // put the rowgroups in SONG order, MOVING ONLY THE MISPLACED ONES. A
  // section's slot IS its index now that the header row is gone — it used to
  // be index+1, because the header held slot 0.
  SONG.forEach((sec, i) => {
    const el = els.get(sec).grp;
    if (songEl.children[i] !== el) songEl.insertBefore(el, songEl.children[i] || null);
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
// every cell value for every section in the song. But the rows DRAW the
// phrases, so the middle ground is exact: one contourPath for the phrase that
// actually changed, then one <path d> write per chip that shows it — parent
// and sub-row chips alike, nothing else read or written.
function patchChipPaths() {
  const p = SLOTS[slot];
  if (!p) return;
  const d = thumbPath(p);
  const paint = holder => {
    for (const c of holder.chips)
      if (c.si === slot && c.line.getAttribute("d") !== d) c.line.setAttribute("d", d);
  };
  for (const el of els.values()) {
    paint(el);
    for (const sub of el.subs.values()) paint(sub);
  }
  if (popCell === "ptn") paint({ chips: bankChips });   // ...and the open bank
}
on("phrase", patchChipPaths);

on("song", () => { els.clear(); songEl.textContent = ""; render(); });
on("box", render);
on("pool", patchAll);      // a recast chair renames every VOICE cell it seats
on("selection", patchAll);
on("transport:section", patchAll);
on("transport:state", d => { patchAll(); if (!d.playing) paintProgress(-1, 0); });
