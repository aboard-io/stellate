// transport.js — PLAY. The rack drew the truth; this makes it audible.
//
// No new engine. FaustLive.exploreLive already takes a getState CALLBACK and
// re-reads it every chord bar, which is exactly a workstation's contract: hand it
// the DAW's own state and an edit lands at the next bar, while the music keeps
// playing. Nothing about the star map's glide/blend/retarget machinery is needed
// or wanted here — the DAW plays ONE song and stays there.
//
// The playhead is deliberately NOT a canvas repaint. The rolls are expensive
// enough to redraw that doing it 60x a second to move a line would make every knob
// feel slow; instead each roll carries one absolutely-positioned <i> that a single
// rAF moves with a transform. The canvases repaint only when the music changes.
import { state, events, SONG } from "./song.js";

let handle = null, playing = false;
let barBeat = 0, barAt = 0, spb = 0.5, raf = 0;
const subs = [];
export const isPlaying = () => playing;
export function onChange(fn) { subs.push(fn); }
const fire = () => subs.forEach((f) => { try { f(); } catch (e) {} });

// ---------- the playhead ----------
// Beat position is interpolated between onBar callbacks off the audio clock's own
// tempo, so it tracks what is SOUNDING rather than what a wall clock thinks.
function beatNow() {
  if (!playing) return 0;
  const el = (performance.now() - barAt) / 1000;
  return barBeat + Math.max(0, el) / spb;
}
function tick() {
  if (!playing) { raf = 0; return; }
  const total = (events().totalBeats || 1);
  const pct = Math.max(0, Math.min(1, beatNow() / total)) * 100;
  for (const h of document.querySelectorAll(".dw-head")) h.style.left = pct + "%";
  raf = requestAnimationFrame(tick);
}

export function mountHeads() {
  for (const wrap of document.querySelectorAll(".dw-rollwrap")) {
    if (wrap.querySelector(".dw-head")) continue;
    const i = document.createElement("i");
    i.className = "dw-head";
    wrap.appendChild(i);
  }
}

// ---------- start / stop ----------
export async function start(onStatus) {
  if (playing) return;
  if (!window.FaustLive) { onStatus && onStatus("live engine not loaded"); return; }
  playing = true; fire();
  try {
    handle = await window.FaustLive.exploreLive(
      () => state(),                      // THE CONTRACT: re-read every bar, so edits land live
      (m) => onStatus && onStatus(m),
      {
        masterVol: 1,
        onBar: (info) => {
          // serial counts chord bars from the start of the walk; chordEvery turns
          // that into the beat the roll is drawn in
          const s = state();
          const cb = Math.max(2, Math.round(s.chordEvery || (s.meter ? 6 : 8)));
          spb = 60 / Math.max(20, s.bpm || 110);
          barBeat = (info.serial || 0) * cb;
          // live.js fires onBar AT the bar (its onBar scheduler arms a timer for
          // each bar's `when`), so the callback instant IS the bar's start. An
          // earlier cut treated info.when — an AudioContext timestamp, seconds
          // since the context opened — as a delta from now, which pushed barAt far
          // into the future and clamped the interpolation to zero: the head jumped
          // once per chord bar instead of gliding, and the gate caught it sitting
          // still for 1.6s.
          barAt = performance.now();
          if (!raf) raf = requestAnimationFrame(tick);
        },
        onLoad: () => {},
      });
  } catch (e) {
    playing = false; handle = null; fire();
    onStatus && onStatus("live failed: " + ((e && e.message) || e));
    return;
  }
  mountHeads();
  if (!raf) raf = requestAnimationFrame(tick);
  fire();
}

export function stop() {
  playing = false;
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  for (const h of document.querySelectorAll(".dw-head")) h.style.left = "0%";
  try { if (handle && handle.stop) handle.stop(); } catch (e) {}
  handle = null;
  fire();
}
export function toggle(onStatus) { return playing ? (stop(), null) : start(onStatus); }

// A genre/seed change while playing is a NEW SONG, not a glide — the star map
// crossfades between blends, the DAW does not pretend to. Stop cleanly so the next
// press starts the song you are now looking at.
export function songChanged() { if (playing) stop(); }

// Probe surface for test/browser/daw-transport.test.js. `rms()` is the live
// engine's OWN analyser tap (faust/live/live.js handle.rms) — a transport gate
// that only checked "the button toggled" would pass over a silent graph, which is
// exactly how this fails in practice.
window.__DAWTRANSPORT = { isPlaying, start, stop, toggle, beatNow,
  rms: () => { try { return handle && handle.rms ? handle.rms() : null; } catch (e) { return null; } } };
