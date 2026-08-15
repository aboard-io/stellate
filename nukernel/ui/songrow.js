// ui/songrow.js — THE SONG TABLE: one element PER BOX, kept alive and patched.
// The song is a table of sections at every width — # | section | genre | bars |
// phrases | switched-on | keys — with a stacked layer as an indented sub-row
// beneath its authority. There is no desk card rack any more and no
// width-as-duration: a wide screen gets the same rows with more room (wider
// columns, the column header out, the option sheet anchored under the row
// instead of over the deck). ONE DOM, one idiom; the CSS decides how much room
// the columns get and nothing else.
//
// ONE LINE PER SECTION (Paul, 2026-08-15: "the song sections can be much less
// vertically tall — they sort of spread all over the place"). The phone row
// used to be a three-line grid — head, layers, then lamps and length on a
// third line with a 2×2 tool pad parked down the right — 109px of mostly air
// per section, so eleven sections were a scroll rather than a song. Every
// field is on ONE line now at every width, the sub-rows are as tight, and what
// used to be four tool keys is a corner cluster of two:
//
//   ↑ ↓ RETIRED. Rows drag among themselves on a desk; the keyboard reorders
//     with ALT+ARROW on the focused row, and touch — where HTML5 drag has
//     never fired — reorders with the ↑ ↓ keys in the row's own sheet. Two
//     keys off every row, and the reorder is still reachable three ways.
//   ⟳ BECAME A PIN. Same behaviour (loop this section alone), pin
//     iconography, pinned = lit, sitting beside the dismiss ✕ so the row's two
//     state keys are one corner cluster instead of a pad in the middle of the
//     row's tap target.
//   + ADDS A SUB-GENRE. The stack has always taken riders; adding one meant
//     opening the sheet and finding the genre bank. The key at the right of
//     the row offers the genre choice immediately, anchored to itself, and the
//     new layer appears as an indented sub-row.
//   PHRASE CHIPS. The phrases the section plays, as the slot rail's own
//     contour picture shrunk to a chip — tap one to select it AND go to STEP
//     with the row still selected. It replaced the "1+3 / 2" numerals column,
//     which was a desk-only cell and said less in more room.
//
// Rebuilding is still the sin: the old drawSong() wiped #song and rebuilt every
// row with ~10 listeners each on every chip click and every scrub frame; here a
// row's element is keyed by the box object's identity and only its text and
// classes are patched. A "phrase" event still does not patch a ROW — it writes
// one <path d> per chip showing the edited phrase and nothing else (see
// patchChipPaths at the bottom) — which is the contract that makes an editor
// scrub cheap, kept now that the row draws the phrases.
//
// Layer graph: ui view — imports state/derive/deps and audio/transport (the
// one allowed direction; transport never calls back, it publishes).
import { GENRES, ROLES, OPLABEL, OCTAVES, SCALELABEL, VOX, KITLABEL, DRUMKITS,
         BASSOPS, SWINGLABEL, GROOVELABEL, MODELABEL, RATELABEL, FX, SENDLABEL,
         VERBS, DTLABEL, LEVELLABEL, PANLABEL, INLABEL, ENVLABEL, MOTLABEL,
         OUTLABEL, MAX_LEN, MAX_NUDGE, FAMILIES, emptyBox } from "./deps.js";
import { SONG, SLOTS, slot, viewSec, loopOnly, pendingStart, bpm, setViewSec,
         setLoopOnly, setPendingStart, setSlot, commit, on, emit } from "./state.js";
import { stackOf, stackLabel, boxBars, secsOf, focused, focusOf, opsOf, optOf,
         voxAll, mmss, contourPath } from "./derive.js";
import { playing, playingSec, startAt, resetBar } from "../audio/transport.js";
import { onLongPress, buzz } from "./touch.js";
// the popover mounts the ONE palette element (built once over there); showTab
// puts it on SOUND when a row opens — same path a .ptab click takes, and
// toggle() is the ONE genre dispatcher, which is what the row's + calls rather
// than splicing a stack entry itself
import { showTab, toggle } from "./palette.js";
// a phrase chip navigates — the row is where you choose WHICH phrase, the STEP
// page is where you edit it. (pages.js imports state/palette/touch only, so
// this direction stays acyclic.)
import { setPage } from "./pages.js";

const songEl = document.getElementById("song");
// TABLE SEMANTICS, honestly and everywhere: the same fields on every section,
// one row each, a header row naming the columns (CSS hides that header where
// there is no room for it). The roles are static because the DOM is.
songEl.setAttribute("role", "table");
songEl.setAttribute("aria-label", "song sections");
// the anchored option sheet needs daylight under the row; below this width it
// is a bottom sheet instead. The same number the pop-up fader uses — one
// definition of "there is room beside/below this".
const WIDE = 900;

let dragFrom = null;
const els = new Map();                     // box object -> { box, num, role, ... }

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

/* ---------- the column header ---------- */
// A real header row: the columns are named once, at the top, instead of every
// row re-explaining itself. It is a row of columnheaders in the same grid, so
// the names sit over the cells they name — that alignment is the whole reason
// a table beats a card. Hidden by CSS where the columns are stacked.
const headRow = (() => {
  const r = document.createElement("div");
  // .thd: the shared TABLE header row — same silkscreen, same rule, same
  // sticky top as the pattern editor's column labels and the arrangement's
  r.className = "shead thd"; r.setAttribute("role", "row");
  for (const [cls, txt] of [["hnum", "#"], ["hrole", "section"],
                            ["hgenre", "genre"], ["hbars", "bars"],
                            ["hph", "phrases"], ["hleds", "switched on"],
                            ["htools", "keys"]]) {
    const c = document.createElement("span");
    c.className = cls; c.textContent = txt;
    c.setAttribute("role", "columnheader");
    r.append(c);
  }
  return r;
})();

/* ---------- the keys ---------- */
// The row's own two state keys (pin, ✕) plus the + that grows the stack; the
// sheet's keys are cut from the same helper. Every one stops the click, or it
// would also open the row it sits in.
const btn = (cls, glyph, label, fn) => {
  const b2 = document.createElement("button");
  b2.type = "button"; b2.className = cls; b2.textContent = glyph;
  b2.setAttribute("aria-label", label);
  b2.addEventListener("click", ev => { ev.stopPropagation(); fn(); });
  return b2;
};
// ...and the same key wearing a drawn icon instead of a glyph. A pushpin has
// no dependable character in a monospace face — ⚲ and 📌 are a coverage
// lottery and one of them is an emoji — so the pin is a path, painted with
// currentColor like every other silkscreen icon on the machine.
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
// THREE CALLERS, ONE MOVE: the row sheet's ↑ ↓ (the touch path — HTML5 drag
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
  // innerHTML. Rebuilding the row's head per patch destroyed the tool keys on
  // every "transport:section" (each box boundary while playing) and on the very
  // activation they handle: Enter on a key committed, the commit patched, the
  // focused button was removed and focus fell to <body> — the exact mid-click
  // destruction palette.js documents having fixed once. (The key that used to
  // demonstrate this was ↑; the pin and ✕ are just as destroyable.)
  const cell = (tag, cls) => {
    const n = document.createElement(tag);
    n.className = cls; n.setAttribute("role", "cell");
    return n;
  };
  const num = cell("b", "bnum tnum");   // the shared numeral column
  const role = cell("span", "role");
  const gl = cell("div", "bgenre");
  // the BARS cell says the length in the units the song is written in, and the
  // duration in the units a listener hears. Two spans, because the phone drops
  // the clock and keeps the bars (the fader-legend pattern: abbreviate, never
  // hide the thing itself).
  const bars = cell("span", "bbars");
  const bn = Object.assign(document.createElement("b"), { className: "bn" });
  const bd = Object.assign(document.createElement("span"), { className: "bd" });
  bars.append(bn, bd);
  // THE PHRASES THIS SECTION PLAYS, as chips — the slot rail's own contour
  // picture (ui/derive.js contourPath, one drawing routine for both) shrunk to
  // about a fingernail, one per phrase, in the layers' own order. It replaced a
  // desk-only column of numerals ("1+3 / 2") that said which phrases without
  // saying anything about them; the chips say both, in less room, at every
  // width. Tapping one selects that phrase AND goes to STEP to edit it, with
  // the row still selected — so the context strip names the right box and the
  // right phrase when you land.
  const ph = cell("div", "bchips");
  // WHAT THIS BOX IS DOING, as an LED strip. The old tag pile emitted ~20
  // word-chips into a two-row well that hid the overflow; eight lamps at
  // FIXED positions never reflow and read at rack distance: lit = that
  // family is set, colour = which family. The words are still here — each
  // lamp's title carries them — and the order is the reading order:
  // line · drums · bass · time · fx · sends · place · edges.
  const leds = cell("div", "bleds");
  const lamp = {};
  for (const fam of ["line", "drum", "bass", "time", "fx", "send", "place", "edge"]) {
    const s = document.createElement("i");
    s.className = "led"; s.dataset.fam = fam;
    lamp[fam] = s; leds.append(s);
  }
  // THE KEYS, at the right of the row: + grows the stack, and the two state
  // keys — pin and dismiss — are a CORNER CLUSTER, which is the whole reason
  // they are three and not five. Four keys in a 2×2 pad put a button at the
  // geometric centre of a 109px row, so "tap the section" hit ⟳ or ✕ as often
  // as it opened the sheet; a one-line row with the keys in its corner has a
  // tap target again.
  const tools = cell("span", "btools");
  const addLayer = btn("t addl", "+", "add a sub-genre to this box",
    () => openPicker(sec, addLayer));
  // THE PIN IS THE OLD ⟳, exactly: it loops this section alone. A circular
  // arrow says "again" and the thing it does is "hold here", which is what a
  // pin says — and pinned/unpinned is a state a pin can wear (lit) where a
  // rotation arrow can only be lit or not for no visible reason.
  const pinBtn = iconBtn("t pin", PIN_SVG, "pin box (loop it alone)", () => {
    const at = idx(sec);
    setViewSec(at); setLoopOnly(loopOnly === at ? null : at);
    commit("selection");
    if (playing || loopOnly != null) startAt(at);
  });
  const xBtn = btn("t x", "✕", "remove box", () => {
    const at = idx(sec);
    SONG.splice(at, 1);
    if (!SONG.length) SONG.push(emptyBox());
    setViewSec(Math.min(viewSec, SONG.length - 1));
    if (loopOnly != null) setLoopOnly(null);
    commit("box");
    if (playing) resetBar();
  });
  tools.append(addLayer, pinBtn, xBtn);
  // A STACKED LAYER IS ITS OWN SUB-ROW: the genre cell names the AUTHORITY,
  // and each rider genre gets an indented line of its own beneath it — a
  // button, because tapping a layer line focuses that layer and opens the row
  // popover already looking at it. Rebuilt only when the stack's genres
  // change; patched otherwise, like everything else on the row.
  const layers = document.createElement("div"); layers.className = "blayers";
  const prog = document.createElement("div"); prog.className = "bprog";
  const fill = Object.assign(document.createElement("i"), { className: "fillbar" });
  prog.append(fill);
  box.append(num, role, gl, bars, ph, leds, tools, layers, prog);

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

  // A ROW TAP OPENS THE ROW, at every width. The popover is the section's whole
  // option surface, and the ▶ in its head is the play-from-here a desk used to
  // get from the tap itself — which was a hidden mode by width: the same click
  // on the same table meant "play" on one screen and "open" on another. While
  // ANOTHER row's popover is up, a tap only dismisses it (the auto-dismiss
  // rule); the next tap opens this row. DOUBLE-CLICK still loops this row
  // alone, and closes whatever the first click opened.
  box.addEventListener("click", () => {
    const i = idx(sec);
    if (popFor && popFor !== sec) { closePop(); setViewSec(i); commit("selection"); return; }
    if (popFor === sec) { closePop(); return; }   // same row: a toggle
    setViewSec(i);
    openPop(sec, focusOf(sec));
  });
  // ...and the same door from the keyboard: the row is a tab stop, Enter or
  // Space opens its sheet. The tool keys were already reachable; the row
  // itself was not, which made every option on it mouse-or-finger only.
  box.tabIndex = 0;
  box.addEventListener("keydown", e => {
    // ALT+ARROW REORDERS THE FOCUSED ROW. This is what replaced the ↑ ↓ keys:
    // they were on every row for ever so that a keyboard (and a finger) could
    // reorder at all, which is two permanent keys of chrome to serve a rare
    // edit. Alt is the modifier because a bare arrow must keep walking the tab
    // ring, and the row FOLLOWS ITS BOX — the element is keyed by the box
    // object, so re-focusing after the commit keeps the same section under the
    // keys for a second press.
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
    e.preventDefault();
    const i = idx(sec);
    if (popFor === sec) { closePop(); return; }
    if (popFor) closePop();
    setViewSec(i);
    openPop(sec, focusOf(sec));
  });
  box.addEventListener("dblclick", () => {
    const i = idx(sec);
    closePop();
    setViewSec(i); setLoopOnly(i);
    commit("selection");
    startAt(i);
  });

  // HOLD TO READ (hw.css verb #4: open the full surface of the thing under
  // the finger). The LED strip compresses ~20 words into eight lamps, and on
  // a desk the words come back on hover — but a phone has no hover, so a
  // long-press pours every lit family's words into the readout line instead.
  // The helper swallows the click that follows, so a hold never also opens the
  // option sheet on top of what it just said.
  onLongPress(box, () => {
    const i = idx(sec);
    const words = Object.entries(lamp)
      .filter(([, s]) => s.title)
      .map(([fam, s]) => fam + ": " + s.title);
    emit("status", { text: "box " + (i + 1) + " · " + stackLabel(sec) + "  —  " +
      (words.length ? words.join("  ·  ") : "nothing switched on"), sticky: true });
  });

  return { box, num, role, bars, bn, bd, pinBtn, xBtn, addLayer,
           gl, layers, layersSig: "", ph, chips: [], chipsSig: "", lamp, fill };
}

/* ---------- the phrase chips ---------- */
// One chip per (layer, phrase), rebuilt only when the SET of phrases in the
// box changes — a structural, rare edit, the same carve-out the layer sub-rows
// take. A scrub inside a phrase does not rebuild anything: it repaints one
// <path d>, which is what keeps the editor's per-pointermove commit cheap
// (patchChipPaths, at the bottom of this file).
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
    ev.stopPropagation();                 // the row click opens the sheet
    const at = idx(sec);
    setViewSec(at); sec.focus = li;       // the layer the phrase rail edits
    setSlot(si);
    commit("selection");
    // GO AND EDIT IT. The row stays selected, so the context strip lands
    // reading "BOX n · … · phrase si+1" — the strip's whole job. On a desk
    // there are no pages to switch, so the same tap scrolls the tracker into
    // view instead of doing nothing visible.
    setPage("step");
    if (innerWidth >= WIDE) {
      const g = document.getElementById("stepgrid");
      if (g) g.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    buzz(4);
  });
  return { b, line, si };
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
  el.role.hidden = !sec.role;
  el.role.textContent = sec.role ? ROLES[sec.role] : "";
  // THE BARS CELL IS WHERE LENGTH LIVES NOW. It used to be pixels — a row was
  // as wide as it was long — which stopped being readable past a few bars and
  // stopped being possible at all once the song became a table of full-width
  // rows. The number is the honest answer, and a two-metre-wide rectangle was
  // never going to be one.
  el.bn.textContent = bars + " bar" + (bars === 1 ? "" : "s") +
    (sec.nudge ? " +" + sec.nudge : "");
  // the clock carries its own separator so the cell reads as one phrase —
  // "4 bars · 0:07" — in the accessibility tree as well as on the glass, and
  // it hides with the span where a phone drops it
  el.bd.textContent = "· " + mmss(secsOf(sec, bpm));
  // the corner cluster: pinned = lit, and the pin is a toggle so it says which
  // way it is about to go. (No key ghosts any more — none of the three has a
  // "nowhere to go" state, which is what the ghost rule was for.)
  el.pinBtn.classList.toggle("on", i === loopOnly);
  el.pinBtn.setAttribute("aria-pressed", String(i === loopOnly));
  el.pinBtn.setAttribute("aria-label",
    (i === loopOnly ? "unpin box " : "pin box ") + (i + 1) + " (loop it alone)");
  el.xBtn.setAttribute("aria-label", "remove box " + (i + 1));
  el.addLayer.setAttribute("aria-label", (blankSimple(sec)
    ? "choose the genre for box " : "add a sub-genre to box ") + (i + 1));

  // the genre cell names the AUTHORITY; the riders are sub-rows below it.
  // (The row's aria-label above still carries the whole stack.)
  const st = stackOf(sec);
  el.gl.className = "bgenre has";
  el.gl.textContent = GENRES[st[0].g].label;
  // rebuild the sub-rows only when the stack's GENRES change — a structural,
  // rare edit, the built-once law's carve-out; labels/focus patch every pass
  const lsig = st.slice(1).map(e => e.g).join("|");
  if (el.layersSig !== lsig) {
    el.layersSig = lsig;
    el.layers.textContent = "";
    st.slice(1).forEach((ent, k) => {
      const b2 = document.createElement("button");
      b2.type = "button"; b2.className = "blayer";
      b2.addEventListener("click", ev => {
        ev.stopPropagation();               // the row click opens the sheet
        const at = idx(sec);
        setViewSec(at); sec.focus = k + 1;  // the layer the phrase rail edits
        if (popFor && popFor !== sec) { closePop(); commit("selection"); return; }
        if (popFor === sec) { patchPop(); commit("selection"); return; }
        openPop(sec, k + 1);
      });
      el.layers.append(b2);
    });
  }
  [...el.layers.children].forEach((b2, k) => {
    const ent = st[k + 1];
    const t2 = GENRES[ent.g].label +
      (ent.slots.length ? " · " + ent.slots.map(n => n + 1).join("+") : " · —");
    if (b2.textContent !== t2) b2.textContent = t2;
    b2.classList.toggle("foc", i === viewSec && focusOf(sec) === k + 1);
    b2.setAttribute("aria-label", "layer: " + GENRES[ent.g].label + " — edit this layer");
  });
  // THE PHRASE CHIPS — one per (layer, phrase), in the layers' own order, so
  // the strip reads the way the stack does. Rebuilt only when the SET moves.
  const csig = st.map(e => e.slots.join(",")).join("|");
  if (el.chipsSig !== csig) {
    el.chipsSig = csig;
    el.ph.textContent = ""; el.chips.length = 0;
    st.forEach((ent, li) => ent.slots.forEach(si => {
      const c = buildChip(sec, li, si);
      el.chips.push(c); el.ph.append(c.b);
    }));
  }
  el.ph.className = "bchips" + (el.chips.length ? " has" : "");
  for (const c of el.chips) {
    // LIT = SOUNDING. Not a timer and not a guess: the transport publishes the
    // sounding SECTION, and derive.js's own deal is that voice v plays phrase
    // v % n — so every phrase in the sounding box is sounding at once, and the
    // honest lamp is per section rather than per chip. (A chip that took turns
    // lighting would be a picture of a rule the engine does not have.)
    c.b.classList.toggle("lit", i === playingSec);
    // ...and the ring is the EDIT target: this row selected, this layer
    // focused, this phrase open in the tracker
    c.b.classList.toggle("sel", i === viewSec && slot === c.si);
    const p = SLOTS[c.si];
    if (p) {
      const d = contourPath(p);
      if (c.line.getAttribute("d") !== d) c.line.setAttribute("d", d);
    }
    c.b.setAttribute("aria-label",
      "phrase " + (c.si + 1) + " in box " + (i + 1) + " — edit it in the step page");
  }

  // THE LAMPS. Each family's words are gathered exactly as the tag pile
  // gathered them; the strip lights the lamp and the title keeps the words,
  // so a hover (or the #src pane, always) still says everything the chips
  // used to shout.
  const fe = i === viewSec ? focused(sec) : stackOf(sec)[0];
  const fclamp = optOf(sec, fe, "clamp"), fcmode = optOf(sec, fe, "cmode"),
        fartic = optOf(sec, fe, "artic"), fscale = optOf(sec, fe, "scale"),
        foct = optOf(sec, fe, "oct"), fvox = voxAll(sec, fe);
  const fams = {
    line: [
      ...opsOf(sec, fe).map(o => OPLABEL[o]),
      foct && "oct " + OCTAVES[String(foct)],
      fclamp != null && "limit " + (fclamp === "0" ? "off" : fclamp),
      fcmode, fartic,
      fscale && SCALELABEL[fscale],
      ...(fvox ? Object.entries(fvox).map(([k, v]) => VOX[k].labels[v]) : []),
      sec.mode && MODELABEL[sec.mode],
    ],
    drum: [sec.kit && KITLABEL[sec.kit], sec.drumkit && DRUMKITS[sec.drumkit]],
    bass: [sec.bassop && BASSOPS[sec.bassop]],
    time: [sec.swing && SWINGLABEL[sec.swing], sec.groove && GROOVELABEL[sec.groove],
           sec.rate && RATELABEL[sec.rate]],
    fx: (sec.fx || []).map(f => FX[f].label),
    send: [sec.rev && "reverb " + SENDLABEL[sec.rev], sec.verb && VERBS[sec.verb],
           sec.echo && "echo " + SENDLABEL[sec.echo], sec.dtime && DTLABEL[sec.dtime]],
    place: [sec.lvl && LEVELLABEL[sec.lvl], sec.pan && PANLABEL[sec.pan]],
    edge: [sec.intro && "in: " + INLABEL[sec.intro], sec.env && ENVLABEL[sec.env],
           sec.mot && MOTLABEL[sec.mot], sec.outro && "out: " + OUTLABEL[sec.outro]],
  };
  for (const [fam, raw] of Object.entries(fams)) {
    const words = raw.filter(Boolean), s = el.lamp[fam];
    if (words.length) { s.dataset.on = ""; s.title = words.join(" · "); }
    else { delete s.dataset.on; s.removeAttribute("title"); }
  }
}
function patchAll() { SONG.forEach((sec, i) => { const el = els.get(sec); if (el) patchBox(sec, i, el); }); }

/* ---------- the two table keys, built once ---------- */
// COPY duplicates the selected box — everything, including its transforms and
// its trim — which is how a song gets a repeated section without rebuilding it.
// They sit in a footer ROW of the table, not floating beside the last section:
// the table has one column layout and these are not a section.
const copyBtn = (() => {
  const copy = document.createElement("button");
  copy.type = "button"; copy.className = "addbox copy";
  copy.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true">' +
    '<rect x="6.5" y="2.5" width="11" height="13" rx="1.5"></rect>' +
    '<path d="M13.5 17.5h-11v-13"></path></svg><span class="ab">duplicate</span>';
  copy.title = "duplicate the selected box";
  copy.setAttribute("aria-label", "duplicate the selected box");
  copy.addEventListener("click", () => {
    const src = JSON.parse(JSON.stringify(SONG[Math.min(viewSec, SONG.length - 1)]));
    SONG.splice(viewSec + 1, 0, src);
    setViewSec(viewSec + 1); commit("box");
  });
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

/* ---------- the row popover ---------- */
// Tapping a song row POPS UP that row's whole option surface — the palette,
// wearing its own six tabs — so choosing a sound for box 5 never means
// scrolling away from box 5. ONE node at every width: a bottom sheet where the
// deck is narrow, and an ANCHORED panel dropped under the row itself where
// there is room (>=900px, the chassis boundary). The ONE palette element
// is MOVED into it while it is open (built once by palette.js; moving the node
// is cheap and isOn()/drawPalette keep painting it wherever it stands) and
// moved home on close, so the desk's own pages still work.
//
// AND NOW THE MIX DESK TOO. The sheet is where a box is edited, so it carries
// BOTH per-box surfaces — the palette and ui/mixtbl.js's table of sounds —
// behind a two-key surface switch in its head. That is what let the page rail
// give up its SOUND and MIX keys (ui/pages.js): those were two rail
// destinations that edited the SELECTED box from somewhere the box was not on
// screen, which is the problem the context strip exists to paper over. The
// mix table is moved exactly the way the palette is: one element, borrowed
// while the sheet is open, home on close — so the desk (where every page is
// visible at once, and where the browser gates read .mrow) is untouched
// whenever the sheet is shut.
//
// The head carries the row's play-from-here ▶, the ↑ ↓ that reorder it (the
// TOUCH reorder path, since HTML5 drag never fires there), and the bars/nudge
// steppers — what the edge grips used to do, said in keys, because a row that
// no longer encodes its length in pixels has no edge to drag.
// Dismiss: ✕, the scrim, Esc; AUTO-dismiss on another row's tap, on a page
// switch, on a new song, when the deck scrolls meaningfully, and on a resize
// that would move the anchor.
let popFor = null;                          // the box object the popover is on
let popScroll0 = 0, popSurf = "sound";      // which surface the sheet is showing
const paletteEl = document.getElementById("palette");
const paletteHome = paletteEl.parentElement;
// the WHOLE mix panel, not just #mixtbl: its head carries the (?) whose
// paragraph explains what M and S do and what the section row under the rule
// is, and the rail key that used to paint that paragraph is gone. Borrowing
// the table alone would have made the only explanation of the desk reachable
// on a desk and nowhere else, which is the wrong way round.
const mixEl = document.querySelector("#page-mix .ed");
const mixHome = mixEl.parentElement;
const deckEl = document.querySelector(".deck");
const rpScrim = Object.assign(document.createElement("div"),
  { className: "rpscrim", hidden: true });
const rowpop = Object.assign(document.createElement("div"),
  { className: "rowpop", id: "rowpop", hidden: true });
rowpop.setAttribute("role", "dialog");
const rpTitle = Object.assign(document.createElement("span"),
  { className: "rptitle", textContent: "box" });
const rpPlay = btn("rpk rpplay", "▶", "play from this box", () => {
  if (!popFor) return;
  const i = SONG.indexOf(popFor);
  setLoopOnly(null);
  if (playing) { setPendingStart(i); commit("selection"); }
  else { commit("selection"); startAt(i); }
  buzz(4);
});
// THE REORDER LIVES HERE NOW. Two keys in one sheet instead of two keys on
// every row for ever — and the row they move is the row whose sheet is open,
// which is the only row a person is thinking about when they want it moved.
const rpUp = btn("rpk rpmv", "↑", "move this box earlier",
  () => { if (popFor) { moveBox(popFor, -1); buzz(4); } });
const rpDn = btn("rpk rpmv", "↓", "move this box later",
  () => { if (popFor) { moveBox(popFor, 1); buzz(4); } });
const rpX = btn("rpk rpx", "✕", "close the row options", () => closePop());
const rpHead = Object.assign(document.createElement("div"), { className: "rphead" });
rpHead.append(rpPlay, rpTitle, rpUp, rpDn, rpX);
// bars/nudge as steppers: the same clamps the grips carried, the same
// commit("box"), and reachable by thumb, key and screen reader alike
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
rpBars.append(rpLen.w, rpNudge.w);
// THE SURFACE SWITCH: which per-box surface the sheet is holding. Two keys,
// because there are exactly two things a box IS — a sound and a mix — and the
// palette's own six tabs live inside the first of them. Cut like the palette's
// .ptab strip, because it is the same kind of control one level up.
const surfKey = (k, lab) => {
  const b2 = btn("rpsk" + (k === popSurf ? " on" : ""), "",
    "show the " + lab + " surface for this box", () => setSurf(k));
  b2.dataset.surf = k;
  // the rail's own silkscreen, inherited: the wave and the three faders were
  // the SOUND and MIX keys' icons and they came here with their destinations
  // (kernel-daw.css, ".pi" keyed on data-surf now)
  b2.append(Object.assign(document.createElement("span"),
    { className: "pi" }), document.createTextNode(lab));
  b2.querySelector(".pi").setAttribute("aria-hidden", "true");
  b2.setAttribute("aria-pressed", String(k === popSurf));
  return b2;
};
const rpSurf = Object.assign(document.createElement("div"), { className: "rpsurf" });
rpSurf.setAttribute("role", "tablist");
rpSurf.setAttribute("aria-label", "box surface");
// THE RAIL'S OWN TWO WORDS, kept exactly. They are the names the machine has
// used for these two surfaces everywhere else — the mix panel's own head says
// MIX — and inventing a synonym here ("desk", which is what mixtbl.js calls
// it in prose) would put two names for the mixer on one screen, which is the
// drift this project spends most of its comments preventing. The palette's
// first TAB is also called sound, and that is not a collision: it is the sound
// surface opening on its sound bank.
const surfKeys = [surfKey("sound", "sound"), surfKey("mix", "mix")];
rpSurf.append(...surfKeys);
const rpMount = Object.assign(document.createElement("div"), { className: "rpmount" });
rowpop.append(rpHead, rpBars, rpSurf, rpMount);
document.body.append(rpScrim, rowpop);

// MOVE, NEVER COPY: one palette and one mix table exist on this page, and the
// sheet borrows whichever it is showing. Whatever it is not showing goes home
// first, so neither element can be left orphaned inside a hidden sheet — which
// is what would make the desk's own MIX page (and the gates that read .mrow)
// silently empty.
function mountSurf() {
  if (popSurf === "mix") { paletteHome.append(paletteEl); rpMount.append(mixEl); }
  else { mixHome.append(mixEl); rpMount.append(paletteEl); }
  for (const b2 of surfKeys) {
    const on2 = b2.dataset.surf === popSurf;
    b2.classList.toggle("on", on2);
    b2.setAttribute("aria-pressed", String(on2));
  }
}
function setSurf(k) {
  if (popSurf === k) return;
  popSurf = k;
  mountSurf();
  commit("selection");                     // the arriving surface repaints
  if (popFor) placePop();                  // it is a different height
  buzz(4);
}
function homeSurfaces() { paletteHome.append(paletteEl); mixHome.append(mixEl); }

// WHERE THE SHEET GOES. Wide: under the row it belongs to, left-aligned with
// it, flipped above when the row sits low, and never taller than the daylight
// it found — and NEVER over the row itself, which is the whole point of
// anchoring rather than covering. Narrow: the bottom sheet, anchored no
// further up than the row.
//
// MEASURED LATE, AND RE-ANCHORED ON A MOVE. Opening the sheet moves the
// palette out of its page, the document gets ~700px shorter, and the browser
// re-clamps the scroll position for it — asynchronously. Placing once,
// synchronously, can write coordinates for where the row used to be. So the
// sheet is placed again on the next frame, and again whenever a scroll has
// actually moved its row: never per-frame, because a panel that re-lays itself
// out under the pointer every frame is a panel you cannot click.
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
    // the daylight on the chosen side is a hard ceiling: the sheet scrolls
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
  // anchored under the row, clamped so the sheet keeps working height; it
  // reaches the bottom edge and scrolls inside itself
  rowpop.style.top = Math.max(8, Math.min(r ? r.bottom + 6 : 72, innerHeight - 380)) + "px";
}

function openPop(sec, layer) {
  popFor = sec;
  sec.focus = layer || 0;
  showTab("sound");                        // a row opens on the sound question
  popSurf = "sound";
  mountSurf();                             // moved, not copied — one of each
  commit("selection");                     // palette + ctx strip repaint
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
  popFor = null;
  rowpop.hidden = true; rpScrim.hidden = true;
  homeSurfaces();                          // home, so the desk's pages find them
  patchAll();
}
function patchPop() {
  if (!popFor) return;
  const i = SONG.indexOf(popFor);
  if (i < 0) { closePop(); return; }       // the box was removed under it
  const li = focusOf(popFor), st = stackOf(popFor);
  rpTitle.textContent = "box " + (i + 1) + " · " + GENRES[st[li].g].label +
    (li ? " (layer)" : "");
  rpLen.lcd.textContent = String(popFor.len);
  rpNudge.lcd.textContent = String(popFor.nudge);
  // a move key with nowhere to go GHOSTS rather than vanishing (the old row
  // cluster's rule, kept where the keys went): the head must not reshuffle
  // between the first row and the middle of the song
  rpUp.classList.toggle("ghost", i === 0);
  rpDn.classList.toggle("ghost", i === SONG.length - 1);
  rpUp.setAttribute("aria-label", "move box " + (i + 1) + " earlier");
  rpDn.setAttribute("aria-label", "move box " + (i + 1) + " later");
}
rpScrim.addEventListener("click", () => closePop());
addEventListener("keydown", ev => {
  if (popFor && ev.key === "Escape") { closePop(); ev.preventDefault(); }
});
// a meaningful scroll of the deck is the finger saying "I am going somewhere"
if (deckEl) deckEl.addEventListener("scroll", () => {
  if (popFor && Math.abs(deckEl.scrollTop - popScroll0) > 24) closePop();
}, { passive: true });
// a resize can change which side the sheet goes on; a page scroll moves the
// row out from under it. Both re-anchor rather than leave it pointing at
// nothing. (The DECK's own scroll is a different gesture — it closes, above.)
addEventListener("resize", () => { if (popFor) placePop(); });
addEventListener("scroll", reanchor, { passive: true });
on("page", () => closePop());              // the rail moved: the row is gone
on("song", () => closePop());              // a whole new song
on("box", patchPop);                       // bars/nudge LCDs follow the edits
on("selection", patchPop);

/* ---------- the sub-genre picker ---------- */
// THE + KEY'S OWN LITTLE PANEL, anchored to the key that opened it. Adding a
// rider to the stack was already one of the machine's best moves and one of
// its least reachable: open the row sheet, find the SOUND tab, scroll the
// genre bank, click. This offers the choice AT the row, immediately, and the
// answer lands as an indented sub-row a few pixels below the key.
//
// It calls palette.js toggle("genre", …) rather than splicing sec.stack
// itself. That is the ONE genre dispatcher and it carries three rules this
// panel must not re-implement: a rider inherits the authority's phrases (so it
// sounds the moment it is added), a blank Simple box is REPLACED rather than
// stacked on, and a whole-form box re-takes the new authority's bar count.
// toggle() commits, so there is no commit here.
//
// BUILT ONCE and re-filled per open: the list is short (nine families, 45
// genres) but what is IN it changes per box — a genre already in the stack is
// not on offer, because tapping it in a chip bank would REMOVE it, and a key
// captioned + must never remove anything.
let pickFor = null;
const gpScrim = Object.assign(document.createElement("div"),
  { className: "gpscrim", hidden: true });
const gpick = Object.assign(document.createElement("div"),
  { className: "gpick", id: "gpick", hidden: true });
gpick.setAttribute("role", "dialog");
gpick.setAttribute("aria-label", "add a sub-genre");
const gpHead = Object.assign(document.createElement("div"), { className: "gphead" });
const gpTitle = Object.assign(document.createElement("span"),
  { className: "gptitle", textContent: "add a sub-genre" });
gpHead.append(gpTitle, btn("rpk rpx", "✕", "close the sub-genre picker", () => closePicker()));
const gpBody = Object.assign(document.createElement("div"), { className: "gpbody" });
gpick.append(gpHead, gpBody);
document.body.append(gpScrim, gpick);

// A BLANK BOX HAS NO SUB-GENRE TO ADD TO — toggle()'s own rule is that the
// first real genre REPLACES the Simple kernel rather than stacking on it, so
// the key means "choose the genre" there and the panel says so. Naming it
// "add a sub-genre" on a blank box and then swapping the box's genre would be
// the panel lying about which of two different edits it just made.
const blankSimple = sec => {
  const st = stackOf(sec);
  return st.length === 1 && st[0].g === "simple";
};
function fillPicker(sec) {
  const have = new Set(stackOf(sec).map(e => e.g));
  const first = blankSimple(sec);
  gpBody.textContent = "";
  for (const [fam, keys] of FAMILIES) {
    const offer = keys.filter(k => !have.has(k) && GENRES[k]);
    if (!offer.length) continue;
    const g = Object.assign(document.createElement("div"), { className: "gpfam" });
    g.append(Object.assign(document.createElement("span"),
      { className: "gplab thd", textContent: fam }));
    const wrap = Object.assign(document.createElement("div"), { className: "gpkeys" });
    for (const k of offer) {
      const b2 = btn("gpk", GENRES[k].label,
        (first ? "make box this genre: " : "add as a sub-genre: ") + GENRES[k].label,
        () => {
        const at = idx(sec);
        if (at < 0) { closePicker(); return; }
        setViewSec(at);
        const was = blankSimple(sec);
        toggle("genre", k);                // the ONE dispatcher; it commits
        closePicker();
        buzz(4);
        emit("status", { text: was
          ? "box " + (at + 1) + " is " + GENRES[k].label + " now — tap + again to stack another genre on it"
          : GENRES[k].label + " rides on box " + (at + 1) +
            " — tap its ↳ line to give it its own phrases" });
      });
      wrap.append(b2);
    }
    g.append(wrap);
    gpBody.append(g);
  }
  if (!gpBody.children.length)
    gpBody.append(Object.assign(document.createElement("p"),
      { className: "gpnone", textContent: "every genre is already in this box" }));
}
// placed like the row sheet: beside/under the key on a desk, a bottom sheet on
// a phone. Same 900px boundary, same clamp-into-the-viewport arithmetic — one
// definition of "there is room beside this" on this machine.
function placePicker(anchor) {
  const r = anchor.getBoundingClientRect();
  if (innerWidth >= WIDE) {
    gpick.classList.add("beside");
    gpick.style.maxHeight = "";
    const w = gpick.offsetWidth;
    const below = innerHeight - r.bottom - 12, above = r.top - 12;
    const under = below >= 260 || below >= above;
    const room = Math.max(180, under ? below : above);
    const h = Math.min(gpick.offsetHeight, room);
    gpick.style.left = Math.min(Math.max(8, r.right - w), innerWidth - w - 8) + "px";
    gpick.style.top = (under ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + "px";
    gpick.style.maxHeight = room + "px";
    return;
  }
  gpick.classList.remove("beside");
  gpick.style.left = ""; gpick.style.maxHeight = "";
  gpick.style.top = Math.max(8, Math.min(r.bottom + 6, innerHeight - 320)) + "px";
}
function openPicker(sec, anchor) {
  pickFor = sec;
  const i = idx(sec);
  setViewSec(i < 0 ? viewSec : i);
  gpTitle.textContent = "box " + (i + 1) +
    (blankSimple(sec) ? " · choose the genre" : " · add a sub-genre");
  fillPicker(sec);
  gpScrim.hidden = false; gpick.hidden = false;
  placePicker(anchor);
  const first = gpBody.querySelector(".gpk");
  if (first) first.focus({ preventScroll: true });
  commit("selection");
  buzz(4);
}
function closePicker() {
  if (!pickFor) return;
  pickFor = null;
  gpick.hidden = true; gpScrim.hidden = true;
}
gpScrim.addEventListener("click", () => closePicker());
addEventListener("keydown", ev => {
  if (pickFor && ev.key === "Escape") { closePicker(); ev.preventDefault(); }
});
on("page", closePicker);
on("song", closePicker);

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
// painted from main.js's rAF loop off transport.getPosition() — the frame loop
// used to querySelectorAll('.box') twice per frame; now it is a walk over refs
export function paintProgress(si, frac) {
  SONG.forEach((sec, i) => {
    const el = els.get(sec);
    if (el) el.fill.style.width = i === si ? (frac * 100).toFixed(2) + "%" : "0%";
  });
}

/* ---------- the one thing a phrase edit may touch ---------- */
// THE SCRUB CONTRACT, KEPT. This module still does not patch on "phrase" — a
// pointermove in the tracker commits per value and patchAll() would recompute
// eight LED families and a stack label for every section in the song. But the
// row now DRAWS the phrases, so a contour that never followed its edits would
// be a picture of the phrase as it was when the box was built. The middle
// ground is exact: one contourPath for the phrase that actually changed, then
// one <path d> write per chip that shows it — nothing else on the row is read
// or written.
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
