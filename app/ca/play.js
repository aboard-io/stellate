// play.js — THE TRANSPORT: play, where you are, and how loud.
//
// No new engine and no new contract. FaustLive.exploreLive takes a getState
// CALLBACK and re-reads it every chord bar, so handing it this page's own state
// means an edit lands at the next bar while the music keeps going — tap a cell
// and the automaton reshapes underneath you. That is the same contract /daw
// runs on (app/daw/transport.js), reduced to the four controls this page needs.
//
// WHERE THE PLAYHEAD COMES FROM. `onBar` reports a SERIAL count of chord bars
// from the start of the walk. Every CA section is `cycles: 1` over a four-chord
// progression, so the section index is serial / 4 — an integer division, not an
// estimate, which is why the lit row and the sound cannot drift apart.
import { DOC, playState, resolved, subs, isLoop, setLoop, loopAt } from "./doc.js";
import { playhead } from "./grid.js";

const CHORDS = 4;                     // a CA progression is always four chords
let handle = null, playing = false, host = null;
let btn = null, loopBtn = null, posEl = null, volEl = null, volFill = null, statusEl = null;

// ---------------------------------------------------------------- the volume
// The tile gesture laid sideways: a RELATIVE drag (starting at the edge does not
// jump the value there), double-tap for 100%, arrow keys, and no
// `input[type=range]` anywhere — the page's slider count is zero, as the rest of
// the project's is.
const VOL_KEY = "ca.vol";
let vol = 1;
try { const r = parseFloat(localStorage.getItem(VOL_KEY)); if (r >= 0 && r <= 1) vol = r; } catch (e) {}
function setVol(v) {
  vol = Math.max(0, Math.min(1, v));
  try { localStorage.setItem(VOL_KEY, String(vol)); } catch (e) {}
  try { if (handle && handle.setMasterVol) handle.setMasterVol(vol); } catch (e) {}
  if (volFill) volFill.style.width = (vol * 100).toFixed(1) + "%";
  if (volEl) { volEl.setAttribute("aria-valuenow", Math.round(vol * 100)); volEl.setAttribute("aria-valuetext", Math.round(vol * 100) + "%"); }
}

export function build(h) {
  host = h; host.textContent = "";

  btn = document.createElement("button");
  btn.type = "button"; btn.className = "ca-play"; btn.id = "caPlay";
  btn.textContent = "▶";
  btn.setAttribute("aria-label", "Play");
  // a real click listener, because the AudioContext unlock has to ride the gesture
  btn.addEventListener("click", () => toggle());
  host.appendChild(btn);

  // THE LOOP TOGGLE — the control that makes this an instrument. It repeats the
  // seed bar with every lens on, so tapping a cell and hearing the difference are
  // half a second apart instead of a song apart. Flipping it mid-playback lands
  // at the next bar like any other edit; the getState callback does the work.
  loopBtn = document.createElement("button");
  loopBtn.type = "button"; loopBtn.className = "ca-loop"; loopBtn.id = "caLoop";
  loopBtn.textContent = "\u27f3 bar";
  loopBtn.title = "Loop the seed bar with everything on, so you can hear what you are drawing";
  loopBtn.addEventListener("click", () => { setLoop(!isLoop()); paint(); });
  host.appendChild(loopBtn);

  posEl = document.createElement("span");
  posEl.className = "ca-pos"; posEl.id = "caPos";
  host.appendChild(posEl);

  volEl = document.createElement("div");
  volEl.className = "ca-vol"; volEl.id = "caVol";
  volEl.setAttribute("role", "slider");
  volEl.setAttribute("aria-label", "Volume");
  volEl.setAttribute("aria-valuemin", "0"); volEl.setAttribute("aria-valuemax", "100");
  volEl.tabIndex = 0;
  volFill = document.createElement("i");
  volEl.appendChild(volFill);
  const lab = document.createElement("b"); lab.textContent = "vol"; volEl.appendChild(lab);
  let from = 0, at = 0, last = 0;
  volEl.addEventListener("pointerdown", (e) => {
    e.preventDefault(); from = vol; at = e.clientX;
    const now = performance.now();
    if (now - last < 320) setVol(1);       // double-tap reverts to full
    last = now;
    try { volEl.setPointerCapture(e.pointerId); } catch (err) {}
  });
  volEl.addEventListener("pointermove", (e) => {
    if (!volEl.hasPointerCapture || !volEl.hasPointerCapture(e.pointerId)) return;
    setVol(from + (e.clientX - at) / volEl.getBoundingClientRect().width);
  });
  volEl.addEventListener("keydown", (e) => {
    const d = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05, Home: -2, End: 2 }[e.key];
    if (d == null) return;
    e.preventDefault();
    setVol(Math.abs(d) > 1 ? (d > 0 ? 1 : 0) : vol + d);
  });
  host.appendChild(volEl);

  statusEl = document.createElement("small");
  statusEl.className = "ca-status"; statusEl.id = "caStatus";
  host.appendChild(statusEl);

  setVol(vol);
  paint();
}

function paint() {
  if (!btn) return;
  if (loopBtn) {
    loopBtn.classList.toggle("on", isLoop());
    loopBtn.setAttribute("aria-pressed", isLoop() ? "true" : "false");
  }
  btn.textContent = playing ? "■" : "▶";
  btn.setAttribute("aria-label", playing ? "Stop" : "Play");
  btn.classList.toggle("on", playing);
  if (!playing && posEl) {
    const r = resolved();
    posEl.textContent = isLoop() ? "looping measure " + (loopAt() + 1)
      : r.plan.length + " sections · " + Math.round(r.state.bpm) + " bpm";
  }
}

export const isPlaying = () => playing;

export async function start() {
  if (playing) return;
  if (!window.FaustLive) { statusEl.textContent = "live engine not loaded"; return; }
  playing = true; paint();
  statusEl.textContent = "starting…";
  try {
    handle = await window.FaustLive.exploreLive(
      () => playState(),                        // re-read every bar: an edit lands live
      (m) => { statusEl.textContent = m || ""; },
      { masterVol: vol,
        onBar: (info) => {
          // IN LOOP MODE the played form is one section, so the serial keeps
          // climbing and a section index means nothing. Light the seed's own row
          // and count bars instead — which is what you want while auditioning.
          if (isLoop()) {
            playhead(loopAt());
            if (posEl) posEl.textContent = "loop · bar " + (1 + ((info.serial || 0) % CHORDS));
            return;
          }
          const pos = Math.floor((info.serial || 0) / CHORDS);
          const r = resolved();
          const p = r.plan[Math.min(pos, r.plan.length - 1)];
          playhead(Math.min(pos, r.plan.length - 1));
          if (posEl && p) posEl.textContent = (pos + 1) + "/" + r.plan.length + " · " + p.role;
        },
        onLoad: () => {} });
  } catch (e) {
    playing = false; handle = null; paint();
    statusEl.textContent = "live failed: " + ((e && e.message) || e);
    return;
  }
  try { if (handle && handle.setMasterVol) handle.setMasterVol(vol); } catch (e) {}
  statusEl.textContent = "";
  paint();
}

export function stop() {
  playing = false;
  playhead(null);
  try { if (handle && handle.stop) handle.stop(); } catch (e) {}
  handle = null;
  statusEl.textContent = "";
  paint();
}
export function toggle() { return playing ? (stop(), null) : start(); }

// Changing the document while stopped is free; while PLAYING, an edit to the
// cells or the rule lands at the next bar through the getState callback and the
// music never stops. Changing the BASE GENRE is a different orchestra, though —
// new instruments, new sampler zones — so that one stops, the way /daw stops on
// a genre change rather than pretending to glide.
let lastGenre = DOC.genre;
subs.push(() => {
  if (DOC.genre !== lastGenre) { lastGenre = DOC.genre; if (playing) stop(); }
  paint();
});

// The probe surface the browser gate reads, so it never has to race a click.
// `rms()` is the live engine's OWN analyser tap — a transport gate that only
// checks "the button toggled" passes happily over a silent graph.
window.__CA = window.__CA || {};
window.__CA.transport = { isPlaying, start, stop, toggle, volume: () => vol, setVolume: setVol,
  isLoop, setLoop,
  rms: () => { try { return handle && handle.rms ? handle.rms() : null; } catch (e) { return null; } } };
