// ui/songrow.js — THE SONG TABLE: one element PER BOX, kept alive and patched.
// The song is a table of sections at every width — # | section | genre | bars |
// phrases | switched-on | tools — with a stacked layer as an indented sub-row
// beneath its authority. There is no desk card rack any more and no
// width-as-duration: a wide screen gets the same rows with more room (wider
// columns, the phrase list and the column header out, the option sheet
// anchored under the row instead of over the deck). ONE DOM, one idiom; the
// CSS decides how much room the columns get and nothing else.
//
// Rebuilding is still the sin: the old drawSong() wiped #song and rebuilt every
// row with ~10 listeners each on every chip click and every scrub frame; here a
// row's element is keyed by the box object's identity and only its text and
// classes are patched. A "phrase" event does not touch this module at all —
// that is the contract that makes an editor scrub cheap.
//
// Layer graph: ui view — imports state/derive/deps and audio/transport (the
// one allowed direction; transport never calls back, it publishes).
import { GENRES, ROLES, OPLABEL, OCTAVES, SCALELABEL, VOX, KITLABEL, DRUMKITS,
         BASSOPS, SWINGLABEL, GROOVELABEL, MODELABEL, RATELABEL, FX, SENDLABEL,
         VERBS, DTLABEL, LEVELLABEL, PANLABEL, INLABEL, ENVLABEL, MOTLABEL,
         OUTLABEL, MAX_LEN, MAX_NUDGE, emptyBox } from "./deps.js";
import { SONG, viewSec, loopOnly, pendingStart, bpm, setViewSec, setLoopOnly,
         setPendingStart, commit, on, emit } from "./state.js";
import { stackOf, stackLabel, boxBars, secsOf, focused, focusOf, opsOf, optOf,
         voxAll, mmss } from "./derive.js";
import { playing, playingSec, startAt, resetBar } from "../audio/transport.js";
import { onLongPress, buzz } from "./touch.js";
// the popover mounts the ONE palette element (built once over there); showTab
// puts it on SOUND when a row opens — same path a .ptab click takes
import { showTab } from "./palette.js";

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
                            ["htools", "move"]]) {
    const c = document.createElement("span");
    c.className = cls; c.textContent = txt;
    c.setAttribute("role", "columnheader");
    r.append(c);
  }
  return r;
})();

/* ---------- the keys ---------- */
// BUTTONS, BECAUSE DRAG-AND-DROP IS A DESKTOP FICTION. HTML5 dragstart does
// not fire on touch at all — not partially, not badly, at all — so reordering
// a song on a phone was impossible and looked like a bug in the page rather
// than a missing feature. ↑ ↓ move the row, ⟳ loops it, ✕ removes it. Row drag
// still works where it works; these are what make the same actions reachable
// everywhere, and they are better for the keyboard besides.
const btn = (cls, glyph, label, fn) => {
  const b2 = document.createElement("button");
  b2.type = "button"; b2.className = cls; b2.textContent = glyph;
  b2.setAttribute("aria-label", label);
  b2.addEventListener("click", ev => { ev.stopPropagation(); fn(); });
  return b2;
};

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
  // activation they handle: Enter on ↑ committed, the commit patched, the
  // focused button was removed and focus fell to <body> — the exact mid-click
  // destruction palette.js documents having fixed once.
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
  // The row lists phrase NUMBERS. The contour picture belongs in the slot rail
  // where you are choosing a phrase; repeating it here made the song a wall of
  // little graphs you had to decode instead of a piece you could read.
  const ph = cell("div", "bphrase");
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
  // the tools: all four keys exist for the row's whole life (patchBox ghosts
  // the move key with nowhere to go, so the cluster never reshuffles between
  // rows); handlers look the index up at event time
  const tools = cell("span", "btools");
  const move = d => {
    const at = idx(sec), j = at + d;
    if (j < 0 || j >= SONG.length) return;
    const keep = keepMarks();
    const [m] = SONG.splice(at, 1); SONG.splice(j, 0, m);
    keep();
    setViewSec(j);
    commit("box");
    if (playing) resetBar();
  };
  // ↑ and ↓ EVERYWHERE: the table runs top to bottom at every width, so the
  // keys speak that axis and nothing swaps glyphs under the reader any more
  const moveUp = btn("t", "↑", "move box earlier", () => move(-1));
  const moveDn = btn("t", "↓", "move box later", () => move(1));
  const loopBtn = btn("t", "⟳", "loop box", () => {
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
  tools.append(moveUp, moveDn, loopBtn, xBtn);
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

  return { box, num, role, bars, bn, bd, moveUp, moveDn, loopBtn, xBtn,
           gl, layers, layersSig: "", ph, lamp, fill };
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
  // a move key with nowhere to go GHOSTS (visibility, in CSS) instead of
  // hiding: all four tool slots keep their seat, so ⟳ and ✕ are at the same
  // spot on every row and the cluster never reshuffles between sections
  el.moveUp.classList.toggle("ghost", i === 0);
  el.moveDn.classList.toggle("ghost", i === SONG.length - 1);
  el.moveUp.setAttribute("aria-label", "move box " + (i + 1) + " earlier");
  el.moveDn.setAttribute("aria-label", "move box " + (i + 1) + " later");
  el.loopBtn.classList.toggle("on", i === loopOnly);
  el.loopBtn.setAttribute("aria-label",
    (i === loopOnly ? "stop looping box " : "loop box ") + (i + 1));
  el.xBtn.setAttribute("aria-label", "remove box " + (i + 1));

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
  el.ph.className = "bphrase" + (st.some(e => e.slots.length) ? " has" : "");
  el.ph.textContent = st.map(e =>
    e.slots.length ? e.slots.map(n => n + 1).join("+") : "—").join("  /  ");

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
// moved home on close, so the SOUND/MIX rail pages still work.
// The head carries the row's play-from-here ▶ and the bars/nudge steppers —
// what the edge grips used to do, said in keys, because a row that no longer
// encodes its length in pixels has no edge to drag.
// Dismiss: ✕, the scrim, Esc; AUTO-dismiss on another row's tap, on a page
// switch, on a new song, when the deck scrolls meaningfully, and on a resize
// that would move the anchor.
let popFor = null;                          // the box object the popover is on
let popScroll0 = 0;
const paletteEl = document.getElementById("palette");
const paletteHome = paletteEl.parentElement;
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
const rpX = btn("rpk rpx", "✕", "close the row options", () => closePop());
const rpHead = Object.assign(document.createElement("div"), { className: "rphead" });
rpHead.append(rpPlay, rpTitle, rpX);
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
const rpMount = Object.assign(document.createElement("div"), { className: "rpmount" });
rowpop.append(rpHead, rpBars, rpMount);
document.body.append(rpScrim, rowpop);

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
  rpMount.append(paletteEl);               // moved, not copied — one palette
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
  paletteHome.append(paletteEl);           // home, so the rail pages find it
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

on("song", () => { els.clear(); songEl.textContent = ""; render(); });
on("box", render);
on("selection", patchAll);
on("transport:section", patchAll);
on("transport:state", d => { patchAll(); if (!d.playing) paintProgress(-1, 0); });
