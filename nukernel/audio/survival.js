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
import { carry, uncarry, isCarrying, carrierFirst, carrierPos, carrierSeek,
         isIOS } from "./bounce.js";

// THE PREDICATE MOVED DOWN to audio/bounce.js, which is where the decision it
// drives now lives (the carrier is the audible path on mobile, not a pocket
// copy). It is imported rather than re-derived so the page cannot hold two
// opinions about what device it is on. Its split still matters here: the
// preemptive mute below is for platforms whose ctx genuinely FREEZES on hide —
// iOS/iPadOS WebKit, which reports "interrupted" and stops rendering until the
// page returns. Android Chrome keeps a running, AUDIBLE context alive in the
// background exactly like desktop (the bg-survival contract), so a
// whole-of-mobile mute would silence a platform that never needed it.

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
  // CARRIER-FIRST: NOTHING TO DO, AND THAT IS THE POINT (2026-08-15). On the
  // mobile predicate the element has been the audible path since the first
  // render landed, so hiding the page is not an audio event at all — no
  // play() for iOS to refuse, no volume swap racing a frozen frame, no
  // handoff to arrive late. This branch is the whole reason the OS grants and
  // keeps focus: what it is being asked to background is already media.
  if (carrierFirst() && isCarrying()) { carried = true; survivalMuted = true; return; }
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
  // no carrier: mute at source ONLY where the freeze is real (iOS), so the
  // suspend does not cut mid-sample and the resume does not click. Android
  // and desktop keep playing hidden — the worker clock + the 2 s lookahead
  // exist for exactly this, and if the ctx does get suspended anyway the
  // onstatechange recovery below handles it.
  if (isIOS && playing) { survivalMuted = true; muteNow(); }
}
function goVisible() {
  if (!ctx) return;
  resumeCtx();
  // CARRIER-FIRST: THE ELEMENT KEEPS THE SONG. Handing back to the graph on
  // return would make the audible path flap between two sources at every app
  // switch — and would drop the media session the moment the user looked at
  // the page, which is the bug. So the only thing return owes is a RESYNC: on
  // iOS the audio clock was frozen the whole time, so the transport (and with
  // it the playhead, the LCD and positionState) has to be moved to where the
  // tape actually got to, or the next tick tries to schedule the minutes it
  // missed.
  if (carrierFirst() && isCarrying()) {
    const p = carrierPos();
    if (p && playing) seekPhase(p.pos);
    return;
  }
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
// a bounce that lands WHILE HIDDEN. Impossible on iOS — the page is frozen —
// but Android background timers run, so it happens there. Two cases: the
// graph is survival-muted (a forced-iOS predicate, or a suspend the
// statechange handler muted) — that is silence, so hand off to the carrier
// NOW; or the graph is audibly playing (the Android no-carrier path) — do
// NOT swap mid-listen, a jump from the live graph to the blob's loose phase
// is more jarring than letting the graph keep playing, so the carrier just
// waits armed for the next hide.
on("bounce:ready", () => {
  if (document.visibilityState !== "hidden" || !playing) return;
  if (survivalMuted && !carried && carry()) carried = true;
});
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
// EVERY HANDLER, RECORDED. A setActionHandler is write-only — nothing can read
// back which actions a page claims, so "the lock screen has controls" was a
// claim no gate could check and no user could check either until they were
// holding a locked phone. The map is the record; __nuMedia below is how the
// gate presses the buttons the OS would press.
const actions = new Map();
function action(name, fn) {
  try { navigator.mediaSession.setActionHandler(name, fn); actions.set(name, fn); }
  catch (e) { /* a UA that does not know this action rejects it; that is fine */ }
}
if (hasMS) {
  // the handlers ARE user gestures (media keys, lock screen), so startAt's
  // gesture prefix — carrier arming included — rides them for free.
  // PLAY WHILE HIDDEN REDOES THE HANDOFF: a lock-screen pause left the graph
  // muted (ducked) and the carrier at volume 0, and neither startAt nor the
  // transport:state subscribers raise either source — so play from the lock
  // screen was MediaSession saying "playing" over total silence. Resetting
  // the flags and re-running goHidden() re-carries (el volume up, graph
  // muted coherently); with no carrier it degrades to the plain mobile
  // mute-at-source, and goVisible restores sound on unlock either way.
  // Carrier-first needs none of that: startAt's transport:state is what puts
  // the element back up, hidden or not, so the re-handoff is skipped there.
  action("play", async () => {
    if (playing) return;
    await startAt(0);
    if (document.visibilityState === "hidden" && !(carrierFirst() && isCarrying())) {
      carried = false; survivalMuted = false;
      goHidden();
    }
  });
  action("pause", () => { if (playing) stop(); });
  action("stop", () => { if (playing) stop(); });
  // SCRUBBING IS PART OF BEING MEDIA. iOS draws the position slider from
  // setPositionState and expects seekto to answer it; without the handler the
  // lock screen shows a scrubber that does nothing, which reads as a broken
  // player rather than a page that declined the action. The tape is the thing
  // that moves — carrierSeek moves the element AND the transport together —
  // and with no carrier it is the transport alone.
  const seekTo = t => {
    if (!playing) return;
    if (!carrierSeek(t)) seekPhase(t);
    msPosition();
  };
  action("seekto", d => { if (d && d.seekTime != null) seekTo(d.seekTime); });
  action("seekbackward", d => seekTo(nowPos() - ((d && d.seekOffset) || 10)));
  action("seekforward", d => seekTo(nowPos() + ((d && d.seekOffset) || 10)));
}
// the gate's hand on the lock screen: what we claim, and a way to press it.
// fire() runs the handler the OS would run — the only honest way to prove a
// control WORKS rather than merely EXISTS.
window.__nuMedia = () => ({
  actions: [...actions.keys()],
  state: hasMS ? navigator.mediaSession.playbackState : null,
  title: hasMS && navigator.mediaSession.metadata ? navigator.mediaSession.metadata.title : null,
  artist: hasMS && navigator.mediaSession.metadata ? navigator.mediaSession.metadata.artist : null,
  position: nowPos(), duration: msDur(),
  fire: (name, detail) => {
    const fn = actions.get(name);
    if (!fn) return false;
    fn(detail || { action: name });
    return true;
  },
});
on("transport:state", d => msUpdate(d.playing));
on("song", () => { msTitle = null; msUpdate(playing); });
// WHERE ARE WE — asked of whatever is AUDIBLE. While the tape carries, the
// audio clock is not the answer (on iOS it is frozen solid, and the position
// slider would sit still through a whole backgrounded song); the element's
// currentTime is. nukernel is the rare page that can also declare an HONEST
// duration — the song is a finite loop — where the parent must say Infinity.
function msDur() {
  const c = carrierPos();
  if (c && c.dur > 0) return c.dur;
  return getPosition().durSec;
}
function nowPos() {
  const c = carrierPos();
  if (c && c.dur > 0) return c.pos;
  const p = getPosition(), dur = p.durSec;
  if (!(dur > 0)) return 0;
  return (((p.now - p.loopStart) % dur) + dur) % dur;
}
function msPosition() {
  if (!hasMS || !playing || !navigator.mediaSession.setPositionState) return;
  try {
    const dur = msDur();
    if (!(dur > 0)) return;
    navigator.mediaSession.setPositionState({
      duration: dur, position: Math.max(0, Math.min(dur, nowPos())), playbackRate: 1 });
  } catch (e) {}
}
setInterval(msPosition, 1000);                     // 1 Hz is what a lock screen needs
