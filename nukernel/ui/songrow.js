// ui/songrow.js — the song row: one element PER BOX, kept alive and patched.
// The old drawSong() wiped #song and rebuilt every box with ~10 listeners each
// on every chip click and every scrub frame; here a box's element is keyed by
// the box object's identity and only its text/classes/width are patched. A
// "phrase" event does not touch this module at all — that is the contract that
// makes an editor scrub cheap.
//
// Layer graph: ui view — imports state/derive/deps and audio/transport (the
// one allowed direction; transport never calls back, it publishes).
import { GENRES, ROLES, OPLABEL, OCTAVES, SCALELABEL, VOX, KITLABEL, DRUMKITS,
         BASSOPS, SWINGLABEL, GROOVELABEL, MODELABEL, RATELABEL, FX, SENDLABEL,
         VERBS, DTLABEL, LEVELLABEL, PANLABEL, INLABEL, ENVLABEL, MOTLABEL,
         OUTLABEL, MAX_LEN, MAX_NUDGE, emptyBox } from "./deps.js";
import { SONG, viewSec, loopOnly, pendingStart, bpm, setViewSec, setLoopOnly,
         setPendingStart, commit, on, emit } from "./state.js";
import { stackOf, stackLabel, boxBars, secsOf, focused, opsOf, optOf,
         voxAll, mmss } from "./derive.js";
import { playing, playingSec, startAt, resetBar } from "../audio/transport.js";
import { onLongPress } from "./touch.js";

const songEl = document.getElementById("song");
const PX_PER_BAR = 22, BAR_PX = 26;
// past this a box stops growing and starts saying its length in words instead
const MAX_BOX_PX = 240;
// WIDTH STOPS MEANING DURATION on a phone. A 2-up card grid leaves ~170px per
// card, which can encode eight bars before every box looks identical — so
// under 560px the CSS makes the boxes fixed cards, the inline width is not
// written at all, and duration always moves to the head in words (the same
// mmss the .clipped machinery already prints).
const NARROW = matchMedia("(max-width:560px)");
NARROW.addEventListener("change", () => render());

let dragFrom = null;
const els = new Map();                     // box object -> { box, head, ... }

/* ---------- gestures ---------- */
function makeGrip(side, begin) {
  const g = document.createElement("div");
  g.className = "grip " + side;
  g.title = side === "l" ? "drag to nudge into the form" : "drag to set length";
  g.draggable = false;
  g.addEventListener("dragstart", e => e.preventDefault());
  g.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, apply = begin(e);
    const move = ev => apply(ev.clientX - x0);
    const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); };
    addEventListener("pointermove", move); addEventListener("pointerup", up);
  });
  g.addEventListener("click", e => e.stopPropagation());
  return g;
}
const idx = sec => SONG.indexOf(sec);
// loopOnly/pendingStart are SONG indices, and a reorder invalidates indices —
// the same law the box listeners follow ("close over the box object, never an
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

/* ---------- build once per box ---------- */
// Listeners close over the BOX OBJECT, never over an index — a box that has
// been dragged three places left is still the same object, so its element and
// its handlers survive the move and the index is looked up at event time.
function buildBox(sec) {
  const box = document.createElement("div");
  box.className = "box";
  box.draggable = true;
  // THE HEAD IS BUILT ONCE TOO — dedicated children patched by textContent/
  // hidden, never innerHTML. Rebuilding it per patch destroyed the ◀ ▶ ⟳ ×
  // buttons on every "transport:section" (each box boundary while playing)
  // and on the very activation they handle: Enter on ◀ committed, the commit
  // patched, the focused button was removed and focus fell to <body> — the
  // exact mid-click destruction palette.js documents having fixed once.
  const head = document.createElement("div"); head.className = "bhead";
  const num = document.createElement("b");
  const role = document.createElement("span"); role.className = "role";
  const meta = document.createElement("span");
  const loopmark = document.createElement("span");
  loopmark.className = "loopmark"; loopmark.textContent = "loop";
  head.append(num, role, meta, loopmark);
  // the tools: all four buttons exist for the box's whole life (patchBox
  // hides the moves at the ends); handlers look the index up at event time
  const tools = document.createElement("span"); tools.className = "btools";
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
  const moveL = btn("t", "◀", "move box earlier", () => move(-1));
  const moveR = btn("t", "▶", "move box later", () => move(1));
  const loopBtn = btn("t", "⟳", "loop box", () => {
    const at = idx(sec);
    setViewSec(at); setLoopOnly(loopOnly === at ? null : at);
    commit("selection");
    if (playing || loopOnly != null) startAt(at);
  });
  const xBtn = btn("x", "×", "remove box", () => {
    const at = idx(sec);
    SONG.splice(at, 1);
    if (!SONG.length) SONG.push(emptyBox());
    setViewSec(Math.min(viewSec, SONG.length - 1));
    if (loopOnly != null) setLoopOnly(null);
    commit("box");
    if (playing) resetBar();
  });
  tools.append(moveL, moveR, loopBtn, xBtn);
  head.append(tools);
  const gl = document.createElement("div"); gl.className = "bgenre";
  // The box lists phrase NUMBERS. The contour picture belongs in the slot rail
  // where you are choosing a phrase; repeating it here made the row a wall of
  // little graphs you had to decode instead of a song you could read.
  const ph = document.createElement("div"); ph.className = "bphrase";
  const prog = document.createElement("div"); prog.className = "bprog";
  const fill = Object.assign(document.createElement("i"), { className: "fillbar" });
  prog.append(fill);
  // WHAT THIS BOX IS DOING, as an LED strip. The old tag pile emitted ~20
  // word-chips into a two-row well that hid the overflow; eight lamps at
  // FIXED positions never reflow and read at rack distance: lit = that
  // family is set, colour = which family. The words are still here — each
  // lamp's title carries them — and the order is the reading order:
  // line · drums · bass · time · fx · sends · place · edges.
  const leds = document.createElement("div"); leds.className = "bleds";
  const lamp = {};
  for (const fam of ["line", "drum", "bass", "time", "fx", "send", "place", "edge"]) {
    const s = document.createElement("i");
    s.className = "led"; s.dataset.fam = fam;
    lamp[fam] = s; leds.append(s);
  }
  box.append(head, gl, ph, prog, leds);

  // REORDER — boxes drag among themselves, and that is all dragging does now.
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

  // CLICK plays from here and carries on; DOUBLE-CLICK loops this box alone.
  // Selecting is immediate; the JUMP waits for the bar line, so clicking
  // around while it plays never chops a bar in half.
  box.addEventListener("click", e => {
    if (e.target.closest(".grip")) return;
    const i = idx(sec);
    setViewSec(i); setLoopOnly(null);
    if (playing) { setPendingStart(i); commit("selection"); }
    else { commit("selection"); startAt(i); }
  });
  box.addEventListener("dblclick", e => {
    if (e.target.closest(".grip")) return;
    const i = idx(sec);
    setViewSec(i); setLoopOnly(i);
    commit("selection");
    startAt(i);
  });

  // HOLD TO READ (hw.css verb #4: open the full surface of the thing under
  // the finger). The LED strip compresses ~20 words into eight lamps, and on
  // a desk the words come back on hover — but a phone has no hover, so a
  // long-press pours every lit family's words into the readout line instead.
  // The grips are skipped (they own their own drag) and the helper swallows
  // the click that follows, so a hold never also jumps the transport.
  onLongPress(box, () => {
    const i = idx(sec);
    const words = Object.entries(lamp)
      .filter(([, s]) => s.title)
      .map(([fam, s]) => fam + ": " + s.title);
    emit("status", { text: "box " + (i + 1) + " · " + stackLabel(sec) + "  —  " +
      (words.length ? words.join("  ·  ") : "nothing switched on"), sticky: true });
  }, { skip: ".grip" });

  // LEFT grip nudges the window into the genre's form; RIGHT grip sets its
  // length. Trimming a clip from either end, which is the DAW gesture.
  box.append(makeGrip("l", () => {
    const n0 = sec.nudge;
    return dx => {
      const n = Math.max(0, Math.min(MAX_NUDGE, n0 + Math.round(dx / BAR_PX)));
      if (n !== sec.nudge) { sec.nudge = n; commit("box"); }
    };
  }));
  box.append(makeGrip("r", () => {
    const l0 = sec.len;
    return dx => {
      const n = Math.max(1, Math.min(MAX_LEN, l0 + Math.round(dx / BAR_PX)));
      if (n !== sec.len) { sec.len = n; commit("box"); }
    };
  }));
  return { box, head, num, role, meta, loopmark, moveL, moveR, loopBtn, xBtn,
           gl, ph, lamp, fill };
}

/* ---------- patch on every change ---------- */
// BUTTONS, BECAUSE DRAG-AND-DROP IS A DESKTOP FICTION. HTML5 dragstart does
// not fire on touch at all — not partially, not badly, at all — so reordering
// a song on a phone was impossible and looked like a bug in the page rather
// than a missing feature. ◀ ▶ move the box, ⟲ loops it. Drag and double-click
// still work where they work; these are what make the same actions reachable
// everywhere, and they are better for the keyboard besides.
const btn = (cls, glyph, label, fn) => {
  const b2 = document.createElement("button");
  b2.type = "button"; b2.className = cls; b2.textContent = glyph;
  b2.setAttribute("aria-label", label);
  b2.addEventListener("click", ev => { ev.stopPropagation(); fn(); });
  return b2;
};
function patchBox(sec, i, el) {
  const bars = boxBars(sec);
  // THE SONG MUST NOT SCROLL SIDEWAYS. The row is the one view of the whole
  // piece, and a scrolling one means the second half of the song does not
  // exist until you go looking for it — you cannot see the shape of a thing
  // you have to scroll. So the boxes WRAP, and a box's width is capped:
  // beyond MAX_BOX_PX it stops growing, fades out at the right edge and says
  // how long it is instead. Width still means duration up to that point, which
  // is where the reading is useful; past it, the number is the honest answer
  // and a two-metre-wide rectangle was never going to be.
  // On a NARROW screen the cap is the card itself: CSS sizes the box, the
  // inline width stays unwritten, and anything longer than the minimum says
  // its duration in the head.
  const narrow = NARROW.matches;
  const want = Math.max(116, bars * PX_PER_BAR);
  const clipped = narrow ? want > 116 : want > MAX_BOX_PX;
  el.box.style.width = narrow ? "" : Math.min(MAX_BOX_PX, want) + "px";
  el.box.className = "box" +
    (i === viewSec ? " sel" : "") + (i === playingSec ? " live" : "") +
    (i === loopOnly ? " looped" : "") + (i === pendingStart ? " queued" : "") +
    (clipped ? " clipped" : "");
  el.box.setAttribute("aria-label",
    "box " + (i + 1) + ", " + stackLabel(sec) + ", " + bars + " bars");

  // THE ROLE GOES IN THE HEAD, not in the tag pile. A song row is something you
  // read at a glance to find the second chorus, and "chorus" competing with
  // eleven other chips for attention is not a label, it is more noise.
  // PATCHED IN PLACE — the head's children were built once with the box, so a
  // focused tool button survives every patch (no node is ever removed here).
  el.num.textContent = String(i + 1);
  el.role.hidden = !sec.role;
  el.role.textContent = sec.role ? ROLES[sec.role] : "";
  el.meta.textContent = bars + " bar" + (bars === 1 ? "" : "s") +
    (sec.nudge ? " +" + sec.nudge : "") +
    // the DURATION, on any box wide enough to have lost its width as a cue —
    // a clipped box has to say in words what it can no longer say in pixels
    (clipped ? " · " + mmss(secsOf(sec, bpm)) : "");
  el.loopmark.hidden = i !== loopOnly;
  el.moveL.hidden = i === 0;
  el.moveR.hidden = i === SONG.length - 1;
  el.moveL.setAttribute("aria-label", "move box " + (i + 1) + " earlier");
  el.moveR.setAttribute("aria-label", "move box " + (i + 1) + " later");
  el.loopBtn.classList.toggle("on", i === loopOnly);
  el.loopBtn.setAttribute("aria-label",
    (i === loopOnly ? "stop looping box " : "loop box ") + (i + 1));
  el.xBtn.setAttribute("aria-label", "remove box " + (i + 1));

  el.gl.className = "bgenre has";
  el.gl.textContent = stackLabel(sec);
  el.ph.className = "bphrase" + (stackOf(sec).some(e => e.slots.length) ? " has" : "");
  el.ph.textContent = stackOf(sec).map(e =>
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

/* ---------- the two row buttons, built once ---------- */
// COPY duplicates the selected box — everything, including its transforms and
// its trim — which is how a song gets a repeated section without rebuilding it.
const copyBtn = (() => {
  const copy = document.createElement("button");
  copy.type = "button"; copy.className = "addbox copy";
  copy.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true">' +
    '<rect x="6.5" y="2.5" width="11" height="13" rx="1.5"></rect>' +
    '<path d="M13.5 17.5h-11v-13"></path></svg>';
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
  add.type = "button"; add.className = "addbox"; add.textContent = "+";
  add.title = "add an empty box";
  add.setAttribute("aria-label", "add a box");
  add.addEventListener("click", () => {
    SONG.push(emptyBox()); setViewSec(SONG.length - 1); commit("box");
  });
  return add;
})();

/* ---------- structural sync ---------- */
// create elements for new boxes, drop the ones whose box is gone, put the rest
// in SONG order (append moves an existing node), then patch everything
export function render() {
  const keep = songEl.scrollTop;          // the row wraps and grows DOWN
  for (const [sec, el] of [...els]) if (!SONG.includes(sec)) { el.box.remove(); els.delete(sec); }
  for (const sec of SONG) if (!els.has(sec)) els.set(sec, buildBox(sec));
  // put the nodes in SONG order, MOVING ONLY THE MISPLACED ONES — a grip drag
  // patches on every pointermove, and reparenting the element under the
  // pointer would drop its pointer capture in some engines
  SONG.forEach((sec, i) => {
    const el = els.get(sec).box;
    if (songEl.children[i] !== el) songEl.insertBefore(el, songEl.children[i] || null);
  });
  if (songEl.lastElementChild !== addBtn) songEl.append(copyBtn, addBtn);
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
