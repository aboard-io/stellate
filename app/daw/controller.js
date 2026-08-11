// controller.js — ONE TINY CONTROLLER: play · bar·beat · bpm · volume.
//
//   ┌───────────────────────────────────────────┐
//   │ ▶  │ 12·3.4 bar·beat │ 99 bpm │ ▁▃▅ vol   │
//   └───────────────────────────────────────────┘
//
// It replaces BOTH the header's ▶ button and the bottom-right #dwHead readout,
// which were the same instrument split across two corners — and it adds the
// volume control the page never had.
//
// THREE LAWS IT KEEPS:
//   1. ▶/■ is a REAL click listener. The AudioContext unlock rides that user
//      gesture; a programmatic start is a silent graph.
//   2. bar·beat and bpm come off the SAME interpolated clock the playhead lines
//      ride — this box registers with transport.onHead(), so it is literally the
//      same call that moves the lines. The number and the lines cannot disagree.
//   3. VOLUME IS NOT A SLIDER. It is the tile gesture laid sideways: drag
//      anywhere, RELATIVE (no jump to the touch point), double-tap → 100%,
//      role="slider" + arrow keys for the keyboard, persisted in localStorage.
//      Zero <input type=range> on this page, still.
import { state, subs } from "./song.js";
import * as TRANSPORT from "./transport.js";

const $el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

let root = null, playBtn = null, posEl = null, bpmEl = null;
let volEl = null, volFill = null, volTxt = null, onStatus = null;

export function mount(host, opts) {
  root = host;
  onStatus = (opts && opts.onStatus) || null;
  root.textContent = "";
  root.classList.add("dw-controller");

  playBtn = $el("button", "dw-cplay", "▶");
  playBtn.type = "button";
  playBtn.title = "play — edits land at the next bar";
  playBtn.setAttribute("aria-label", "play");
  playBtn.addEventListener("click", () => {     // LAW 1: a real gesture
    TRANSPORT.toggle((m) => { if (onStatus) onStatus(m); });
  });

  posEl = $el("span", "dw-cnum dw-cpos");
  posEl.append($el("b", null, "—"), $el("small", null, "bar·beat"));
  bpmEl = $el("span", "dw-cnum dw-cbpm");
  bpmEl.append($el("b", null, "—"), $el("small", null, "bpm"));

  volEl = $el("div", "dw-cvol");
  volEl.tabIndex = 0;
  volEl.setAttribute("role", "slider");
  volEl.setAttribute("aria-label", "volume");
  volEl.setAttribute("aria-valuemin", "0");
  volEl.setAttribute("aria-valuemax", "1");
  volEl.title = "volume — drag sideways, double-tap for full";
  volFill = $el("i", "dw-cvolfill");
  volTxt = $el("span", "dw-cvoltxt", "");
  volEl.append(volFill, $el("span", "dw-cvollab", "vol"), volTxt);
  wireVolume();

  root.append(playBtn, posEl, bpmEl, volEl);

  TRANSPORT.onHead(placeHead);                  // LAW 2: the playhead's own clock
  TRANSPORT.onChange(paint);
  subs.push(paint);
  paint();
  placeHead(TRANSPORT.isPlaying() ? TRANSPORT.beatNow() : null);
  return root;
}

// ---------- the readout ----------
export function placeHead(beat) {
  if (!posEl) return;
  const b = posEl.firstChild;
  if (beat == null || !TRANSPORT.isPlaying()) { b.textContent = "—"; return; }
  const s = state();
  const cb = Math.max(2, Math.round(s.chordEvery || (s.meter ? 6 : 8)));
  const bar = Math.floor(beat / cb) + 1, beatIn = (beat % cb) + 1;
  b.textContent = bar + "·" + beatIn.toFixed(1);
}

export function paint() {
  if (!root) return;
  const playing = TRANSPORT.isPlaying();
  root.classList.toggle("on", playing);
  playBtn.textContent = playing ? "■" : "▶";
  playBtn.classList.toggle("on", playing);
  playBtn.setAttribute("aria-label", playing ? "stop" : "play");
  playBtn.title = playing ? "stop" : "play — edits land at the next bar";
  bpmEl.firstChild.textContent = String(Math.round(state().bpm || 0));
  if (!playing) posEl.firstChild.textContent = "—";
  paintVol();
}

// ---------- VOLUME: the tile gesture, sideways ----------
function paintVol() {
  const v = TRANSPORT.volume();
  volFill.style.width = Math.round(clamp01(v) * 100) + "%";
  volTxt.textContent = Math.round(clamp01(v) * 100) + "%";
  volEl.setAttribute("aria-valuenow", v.toFixed(2));
  volEl.setAttribute("aria-valuetext", Math.round(v * 100) + "%");
}

function wireVolume() {
  let dragging = false, sx = 0, sv = 0, pid = null, lastUp = 0, moved = false;
  volEl.addEventListener("pointerdown", (ev) => {
    dragging = true; moved = false; sx = ev.clientX; sv = TRANSPORT.volume(); pid = ev.pointerId;
    try { volEl.setPointerCapture(pid); } catch (e) {}
    ev.preventDefault();
  });
  volEl.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    const dx = ev.clientX - sx;
    if (!moved && Math.abs(dx) < 3) return;
    moved = true;
    // RELATIVE: the value moves with the finger from where it was; the width of
    // the control is one full sweep, so a short drag is a fine trim.
    TRANSPORT.setVolume(clamp01(sv + dx / Math.max(90, volEl.clientWidth)));
    paintVol();
    ev.preventDefault();
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    try { volEl.releasePointerCapture(pid); } catch (e) {}
    const now = performance.now();
    if (!moved && now - lastUp < 350) { lastUp = 0; TRANSPORT.setVolume(1); paintVol(); return; }
    lastUp = moved ? 0 : now;
    paintVol();
  };
  volEl.addEventListener("pointerup", end);
  volEl.addEventListener("pointercancel", () => { dragging = false; paintVol(); });
  volEl.addEventListener("click", (ev) => ev.preventDefault());
  volEl.addEventListener("keydown", (ev) => {
    const step = ev.shiftKey ? 0.15 : 0.05;
    let v = TRANSPORT.volume();
    if (ev.key === "ArrowRight" || ev.key === "ArrowUp") v += step;
    else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") v -= step;
    else if (ev.key === "Home") v = 0;
    else if (ev.key === "End" || ev.key === "Enter") v = 1;
    else return;
    ev.preventDefault();
    TRANSPORT.setVolume(clamp01(v));
    paintVol();
  });
}

// ---------- probe surface (window.__DAW.controller) ----------
export const el = () => root;
export const volume = () => TRANSPORT.volume();
export const setVolume = (v) => { TRANSPORT.setVolume(v); paintVol(); };
export const play = () => playBtn && playBtn.click();
export const stop = () => { if (TRANSPORT.isPlaying()) playBtn.click(); };
export const volEl_ = () => volEl;
