// ui/popfader.js — the pop-up fader: tap a value cell and a hardware fader
// opens beside it. This is what replaced the ± "Tap raises" toggle — a tap
// used to mean "move one step in whichever direction a mode button remembered",
// which is a hidden mode, and hidden modes are how values end up somewhere
// nobody meant. Now a tap on a value cell OPENS the value: a vertical fader
// with tick marks, a big LCD, ▲/▼ step keys and ✕. Drag-scrub on the cell
// itself is untouched — that stays the power path; the fader is the
// see-what-you-are-doing path.
//
// Built ONCE (the palette's law): one dialog and one scrim live in the DOM
// for ever, hidden between uses; open() patches text/position and swaps the
// closures. Every edit goes through the caller's set(), which writes the same
// phrase vector and the same commit("phrase") a scrub writes — the fader has
// no private way to change the song.
//
// Layer graph: ui utility — imports touch only; editor imports this.
import { buzz } from "./touch.js";

/* ---------- the one dialog ---------- */
const scrim = Object.assign(document.createElement("div"),
  { className: "pfscrim", hidden: true });
const el = Object.assign(document.createElement("div"),
  { className: "popfader", id: "popfader", hidden: true });
el.setAttribute("role", "dialog");

const mk = (tag, cls, txt) => {
  const n = document.createElement(tag);
  n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};
const key = (cls, glyph, label) => {
  const b = mk("button", cls, glyph);
  b.type = "button";
  b.setAttribute("aria-label", label);
  return b;
};

const head = mk("div", "pfhead");
const title = mk("span", "pftitle silk", "value");
const close = key("pfclose", "✕", "close the fader");
head.append(title, close);

// left column: ▲ / LCD / ▼ — the step keys flank the readout so the thumb
// rests on one spot; right column: the fader itself
const side = mk("div", "pfside");
const up = key("pfstep pfup", "▲", "one step up");
const lcd = mk("output", "pflcd", "0");
const down = key("pfstep pfdown", "▼", "one step down");
side.append(up, lcd, down);

// the track is the slider: a real focusable role=slider with arrow keys, so
// the dialog is keyboard-complete even though the keys beside it already are
const track = mk("div", "pftrack");
track.tabIndex = 0;
track.setAttribute("role", "slider");
track.setAttribute("aria-orientation", "vertical");
const thumb = mk("div", "pfthumb");
track.append(thumb);

el.append(head, side, track);
document.body.append(scrim, el);

/* ---------- state: one open value at a time ---------- */
let cur = null;                 // { anchor, min, max, get, set, fmt }

function render() {
  if (!cur) return;
  const v = cur.get();
  const txt = cur.fmt(v);
  if (lcd.textContent !== txt) lcd.textContent = txt;
  track.setAttribute("aria-valuenow", String(v));
  track.setAttribute("aria-valuetext", txt);
  // thumb travel: min sits at the bottom, up is more — everywhere
  const span = track.clientHeight - thumb.offsetHeight - 8;
  const f = (v - cur.min) / (cur.max - cur.min);
  thumb.style.top = (4 + (1 - f) * span) + "px";
}
function setVal(v) {
  if (!cur) return;
  const c = Math.max(cur.min, Math.min(cur.max, Math.round(v)));
  if (c === cur.get()) return;
  cur.set(c);
  buzz(4);                       // a value landed (rate-limited in touch.js)
  render();
}

/* ---------- placement ---------- */
// Near the cell but never over the thing you are editing.
//
// BESIDE the cell, vertically centred on it, at EVERY width the side fits.
// The tracker table runs top to bottom at every width, so the pattern you are
// reading is always a column, and a fader dropped under the cell always covers
// the next eight ticks of the very thing you are editing. To the right if there
// is room, to the left otherwise.
//
// The side rule used to be gated at ≥900px, from the era when a phone had a
// different editor; it does not, so the gate was measuring the screen when the
// question is the daylight. A 150px panel fits beside a cell on most phones in
// portrait, and where it genuinely does not, the fallback below still holds:
// above the cell when it sits in the lower half of the screen (where a thumb
// usually is), below it otherwise.
function place(anchor) {
  const r = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
  const clampY = y => Math.min(Math.max(8, y), innerHeight - h - 8);
  {
    const gap = 12;
    const right = r.right + gap, left = r.left - gap - w;
    const x = right + w <= innerWidth - 8 ? right : left >= 8 ? left : null;
    if (x != null) {
      el.style.left = x + "px";
      el.style.top = clampY(r.top + r.height / 2 - h / 2) + "px";
      return;
    }
  }
  const x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
  el.style.left = x + "px";
  el.style.top = clampY(r.top > innerHeight / 2 ? r.top - h - 10 : r.bottom + 10) + "px";
}

/* ---------- open / shut ---------- */
export function openFader({ anchor, label, min, max, get, set, fmt }) {
  cur = { anchor, min, max, get, set, fmt: fmt || String };
  title.textContent = label;
  el.setAttribute("aria-label", label + " fader");
  track.setAttribute("aria-label", label);
  track.setAttribute("aria-valuemin", String(min));
  track.setAttribute("aria-valuemax", String(max));
  scrim.hidden = false;
  el.hidden = false;
  place(anchor);
  render();
  track.focus({ preventScroll: true });
}
export function shut() {
  if (!cur) return;
  const back = cur.anchor;
  cur = null;
  el.hidden = true;
  scrim.hidden = true;
  if (back && back.isConnected) back.focus({ preventScroll: true });
}

/* ---------- gestures ---------- */
scrim.addEventListener("click", shut);
close.addEventListener("click", shut);
addEventListener("keydown", ev => {
  if (!cur) return;
  if (ev.key === "Escape") { shut(); ev.preventDefault(); }
});

up.addEventListener("click", () => setVal(cur ? cur.get() + 1 : 0));
down.addEventListener("click", () => setVal(cur ? cur.get() - 1 : 0));

// the track maps position to value absolutely — grab anywhere and the value
// is where the finger is, like putting a finger on a real fader cap
{
  let dragging = false;
  const at = ev => {
    const r = track.getBoundingClientRect(), pad = 4 + thumb.offsetHeight / 2;
    const f = 1 - (ev.clientY - r.top - pad) / (r.height - pad * 2);
    setVal(cur.min + f * (cur.max - cur.min));
  };
  track.addEventListener("pointerdown", ev => {
    if (!cur) return;
    dragging = true;
    try { track.setPointerCapture(ev.pointerId); } catch (e) {}
    at(ev);
  });
  track.addEventListener("pointermove", ev => { if (dragging && cur) at(ev); });
  const end = () => { dragging = false; };
  track.addEventListener("pointerup", end);
  track.addEventListener("pointercancel", end);
}
track.addEventListener("keydown", ev => {
  if (!cur) return;
  const v = cur.get();
  if (ev.key === "ArrowUp" || ev.key === "ArrowRight") setVal(v + 1);
  else if (ev.key === "ArrowDown" || ev.key === "ArrowLeft") setVal(v - 1);
  else if (ev.key === "Home") setVal(cur.max);   // Home = top of the fader
  else if (ev.key === "End") setVal(cur.min);
  else return;
  ev.preventDefault();
});

// an external patch (the cell scrubbed by another finger, a song load) may
// move the value under an open fader; the editor calls this from its patch
export function refresh() { if (cur) render(); }
export const isOpen = () => cur != null;
