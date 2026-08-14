// audio/survival.js — the recoverable AudioContext and the OS-facing media
// identity. Before this file existed, any backgrounding on iOS left the page
// permanently silent with the transport still claiming to run: WebKit moves
// the context to 'suspended'/'interrupted' on lock or app switch, and the
// page's only resume() lived inside startAt. The parent app needed four hooks
// (visibilitychange, pageshow, focus, ctx.onstatechange) plus a gesture-armed
// revive, and every one of them earned its place — this is that machinery,
// ported at toy scale, plus the handoff to the bounce carrier and MediaSession.
//
// Layer graph: deps -> state -> ... -> transport -> bounce -> THIS FILE ->
// ui views. Top of the audio tier; never imports a ui view.
import { GENRES } from "../ui/deps.js";
import { SONG, on } from "../ui/state.js";
import { stackOf } from "../ui/derive.js";
import { ctx, muteNow, unmuteRamp } from "./graph.js";
import { playing, startAt, stop, getPosition, seekPhase } from "./transport.js";
import { carry, uncarry } from "./bounce.js";

// the parent's predicate: the preemptive mute is for platforms where the ctx
// genuinely suspends on hide. A hidden DESKTOP tab keeps a running context
// alive, and nukernel's worker clock + 2 s lookahead already carry it — muting
// there would be a regression, not a safety.
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ""));

/* ---------- resume + revive ---------- */
// unconditional, NEVER gated on ctx.state: iOS reports the non-standard
// "interrupted" after an app switch, and gating on "suspended" alone never
// resumes from it. resume() is a no-op while running; the catch keeps a
// rejected promise silent.
const resumeCtx = () => {
  if (!ctx) return;
  try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
};
// one-shot gesture fallback: iOS sometimes refuses a non-gesture resume()
// after an interruption; if the ctx still is not running shortly after
// return, the next touch anywhere revives it (touch handlers ARE gestures)
let gestureArmed = false;
function armGestureResume() {
  if (gestureArmed) return;
  gestureArmed = true;
  const revive = () => {
    gestureArmed = false;
    document.removeEventListener("touchend", revive, true);
    document.removeEventListener("pointerdown", revive, true);
    resumeCtx();
  };
  document.addEventListener("touchend", revive, true);
  document.addEventListener("pointerdown", revive, true);
}

/* ---------- hide / show ---------- */
let survivalMuted = false;                         // goHidden ran and goVisible hasn't
let carried = false;                               // the bounce element took the handoff
function goHidden() {
  if (!ctx) return;
  // the handoff, when the carrier is ready: element volume up + graph muted at
  // the matching loop position. Both writes are SYNCHRONOUS — background
  // timers throttle on the very frames a deferred ramp would ride, so the
  // mute is a hard zero (live.js's own comment: "can't defer") and the seam
  // is masked by the two sources being the same music at the same phase.
  if (playing && carry()) {
    carried = true; survivalMuted = true;
    muteNow();
    return;
  }
  // no carrier: mute at source only where the freeze is coming (mobile), so
  // the suspend does not cut mid-sample and the resume does not click. A
  // hidden desktop tab keeps playing — that is the worker clock's whole job.
  if (isMobile && playing) { survivalMuted = true; muteNow(); }
}
function goVisible() {
  if (!ctx) return;
  resumeCtx();
  if (carried) {
    // reverse handoff: element down, graph up — and the transport RESYNCS to
    // where the element actually got to, because on iOS the graph's clock was
    // frozen the whole time and would otherwise resume in the musical past
    const ph = uncarry();
    carried = false;
    if (ph != null && playing) seekPhase(ph);
  }
  if (survivalMuted) {
    survivalMuted = false;
    unmuteRamp(20);                                // no click on return
  }
  // if iOS refused the non-gesture resume, the next touch revives the session
  setTimeout(() => {
    if (ctx && ctx.state !== "running" && document.visibilityState !== "hidden") {
      resumeCtx();
      armGestureResume();
    }
  }, 400);
}
document.addEventListener("visibilitychange", () =>
  document.visibilityState === "hidden" ? goHidden() : goVisible());
addEventListener("pagehide", goHidden);
addEventListener("pageshow", goVisible);
addEventListener("focus", goVisible);

// audio-session interruptions (a call, Siri, another app taking focus)
// suspend the ctx with NO visibility event — and on an app switch the
// statechange often fires BEFORE the late visibilitychange, which is exactly
// the audible-glitch window. React to the context itself.
on("audio:ctx", () => {
  try {
    ctx.onstatechange = () => {
      console.info("[nukernel] AudioContext state ->", ctx.state);
      const hidden = document.visibilityState === "hidden";
      if (ctx.state === "running") {
        if (survivalMuted && !hidden) goVisible();
      } else if (ctx.state !== "closed") {
        if (playing && !survivalMuted) goHidden(); // mute at source before the freeze repeats audibly
        if (!hidden) resumeCtx();                  // visible suspension = interruption; poke it
      }
    };
  } catch (e) {}
});

/* ---------- MediaSession ---------- */
// identity + transport for the lock screen. nukernel is the rare page that
// can declare an HONEST duration — the song is a finite loop — where the
// parent must declare Infinity for its endless stream.
const hasMS = typeof navigator !== "undefined" && "mediaSession" in navigator;
let msTitle = null;
function songLabel() {
  const names = [...new Set(SONG.flatMap(b =>
    stackOf(b).map(e => GENRES[e.g] && GENRES[e.g].label).filter(Boolean)))];
  return names.length ? names.join(" + ") : "song boxes";
}
function msUpdate(isPlaying) {
  if (!hasMS) return;
  try {
    const title = songLabel();
    // do not re-mint MediaMetadata when the strings have not changed — some
    // UAs flicker the lock screen on every assignment (the parent's guard)
    if (title !== msTitle) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title, artist: "stellate nukernel", album: "song boxes" });
      msTitle = title;
    }
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  } catch (e) {}
}
if (hasMS) {
  // the handlers ARE user gestures (media keys, lock screen), so startAt's
  // gesture prefix — carrier arming included — rides them for free
  try { navigator.mediaSession.setActionHandler("play", () => { if (!playing) startAt(0); }); } catch (e) {}
  try { navigator.mediaSession.setActionHandler("pause", () => { if (playing) stop(); }); } catch (e) {}
  try { navigator.mediaSession.setActionHandler("stop", () => { if (playing) stop(); }); } catch (e) {}
}
on("transport:state", d => msUpdate(d.playing));
on("song", () => { msTitle = null; msUpdate(playing); });
// positionState at 1 Hz, from the transport's own clock — the real finite
// duration, so the lock screen counts against the truth
setInterval(() => {
  if (!hasMS || !playing || !navigator.mediaSession.setPositionState) return;
  try {
    const p = getPosition(), dur = p.durSec;
    if (!(dur > 0)) return;
    const pos = (((p.now - p.loopStart) % dur) + dur) % dur;
    navigator.mediaSession.setPositionState({
      duration: dur, position: Math.max(0, Math.min(dur, pos)), playbackRate: 1 });
  } catch (e) {}
}, 1000);
