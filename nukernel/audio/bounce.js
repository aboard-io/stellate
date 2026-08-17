// audio/bounce.js — the background carrier. The song is a CLOSED FINITE LOOP
// (a seeded, deterministic bar list that wraps), which dissolves the parent
// app's hardest problem entirely: it never needed segment A/B swapping, MSE
// append pipelines or fMP4 timestamp surgery here, because the whole song can
// be rendered ONCE into a buffer and played in a loop=true <audio> element.
//
// The element is created and unlocked INSIDE the play gesture, then kept
// PLAYING, MUTED and PHASE-LOCKED for the whole session — so backgrounding is
// a volume swap with no play() for iOS to refuse, no seek to be late, and the
// parent's known race (ctx statechange arriving before visibilitychange) is
// harmless because the carrier is already running. survival.js does the
// swapping; this file owns the element, the offline render and the phase.
//
// ON MOBILE THERE IS NO SWAP AT ALL: THE CARRIER IS THE PATH (2026-08-15).
// The page had implemented half of docs/WAV-FIRST.md — element on hide, live
// graph in the foreground — and half is the same as none. A page whose audible
// output is a WebAudio graph holds no MEDIA: the OS has no element to attach a
// session to, so it grants no audio focus, shows no lock-screen transport, and
// treats the backgrounded tab as a page rather than as something playing. The
// user's report ("focus is not being applied to this app") is that fact. So on
// the mobile predicate the element takes over as soon as the first render
// lands and NEVER hands back: hiding the page then requires no handoff, which
// is precisely why the OS keeps the session alive. WAV-FIRST's decision line,
// read the way it is written: "on mobile, the audible path is a real <audio>
// element playing real rendered media, THROUGHOUT".
//
// The cost is settled, not hidden (Paul, asked directly, twice: "Less dynamic
// is fine"). A phone edit is heard when its re-render lands and swaps at the
// loop wrap — so the debounce shrinks to a scrub-coalescing 500 ms, the swap
// happens on the wrap where it cannot click, and every stage of that says so
// in the readout. What is NOT permitted is two audible sources, or a mute with
// no carrier behind it: goCarrier() proves the element is really playing
// before the graph goes quiet, and demotes back to the graph (recorded in
// st.demoted) if it is not.
//
// TWO-STAGE (WAV-FIRST's firstSegSec lesson, docs/WAV-FIRST.md): the render
// that must exist FAST is a small one. At transport start a SHORT carrier —
// the song's first BOX, whole, cut where the music has a boundary — renders
// immediately, so a whole phrase loops within seconds of play; the full song
// renders behind it and swaps in at a safe moment (never under a carrying
// element). Before this, the one render waited ~3 bars plus a debounce and then
// took multiples of realtime on a composed song — any switch-away in the first
// half minute found no carrier. __nuBounce.stage says which is serving.
//
// THE WRAP COSTS NOTHING (2026-08-16). "The song is a finite loop, so play it
// in a loop=true element" was true about the MUSIC and false about the MEDIA:
// measured in headless chromium, a `loop=true` <audio> drops 266 samples —
// 6.03 ms — of SILENCE at every wrap, because the wrap is a seek and the seek
// flushes the decoder. Paul heard it as "a phrase loops with an audible gap."
// The fix is the parent's, borrowed rather than reinvented (docs/WAV-FIRST.md
// v4 + engine/faust/codec/fmp4.js): the element stops looping and becomes a
// stream — the folded loop encoded ONCE and the same fMP4 fragment appended
// again and again with an explicit tfdt a whole loop later each time. Measured
// the same way afterwards: zero. The whole tier degrades to the loop=true blob
// wherever the codec is missing, so nothing about this paragraph is required
// for the page to make a sound. See "the seamless tape" below.
//
// NOT MediaStreamDestination -> <audio srcObject>. That is the route that
// looks cheapest and the parent PROVED cannot work: the audible path still
// mirrors a live graph, so when iOS freezes audio I/O the last quantum loops
// at the CoreAudio boundary in a window JS cannot close (docs/WAV-FIRST.md
// §"the founding failure", live.js goHidden's mute+pause of exactly that
// element). The carrier here plays RENDERED BYTES, below no live graph.
//
// Layer graph: deps -> state -> derive -> graph -> assets -> voices -> mixer
// -> transport -> THIS FILE -> survival -> ui views. It renders through the
// same parameterized builders the live graph uses (graph.buildMasterChain /
// mixer.buildChannel / transport.scheduleBar), so the carrier is the same
// mix — a fork of any of those walks is how it would drift out of tune.
//
// THAT SENTENCE WAS A CLAIM AND NOT A FACT for one commit, and it cost the
// whole mix (2026-08-17). When the press took over the making of the sound,
// every one of those builders quietly stopped being on the tape's path: the
// window came back from engine/faust/ as a finished stereo pair and went to the
// element as it was. Nothing said so — the readouts were all green — because
// the tape is only ever audible when the page is hidden, which is the one state
// nobody is looking at. Paul heard it as "a weird sudden drop in volume and the
// removal of most effects and mixing when I tab over to another app". The press
// gives back a BAND; renderDesk below puts that band through this song's desk
// before any of it becomes a tape.
import { DTIMES } from "../ui/deps.js";
import { SONG, SLOTS, loopOnly, bpm, MASTER, BUSES, GROOVE, SWING, POOL,
         on, emit } from "../ui/state.js";
import { kitOf } from "../ui/derive.js";
import { buildMasterChain, buildEchoBus, buildRoomBus, buildKitDesk, buildSendBus, makeVerb,
         masterVol, muteNow, unmuteRamp, parkGraph, unparkGraph, isParked,
         fadeUpAt, epDown, rmsNow, DRYROOM, MASTER_HEADROOM, ctx } from "./graph.js";
import { FONT } from "./assets.js";
import { offFallback } from "./voices.js";
import { chanSpec, buildChannel, armAutomation, focusKit } from "./mixer.js";
import { buildTimeline, scheduleBar, stepDur, playing, getPosition, nextBarAt,
         onGesture, seekPhase, setQuietWhen, singWork } from "./transport.js";
import { warm as warmSing } from "./sing.js";
// THE PRESS. Everything that makes a sound inside a render window now happens
// in the parent engine (engine/faust/), driven through this one door.
import { pressWindow, pressReady, pressError, pressPath } from "./press-window.js";

/* ---------- the platform predicate ---------- */
// IT LIVES HERE NOW, not in survival.js, because the thing it decides is the
// CARRIER: whether this element is the audible path or the pocket insurance.
// survival.js imports it back (it is above this file in the layer graph), so
// there is exactly one answer to "is this a phone" on the page.
// iPadOS 13+ masquerades as Mac in the UA; maxTouchPoints is the tell.
// ?bgtest=ios|android forces the predicate so one desktop chromium can walk
// both branches.
const bgtest = /[?&]bgtest=(ios|android)\b/.exec(location.search);
const UA = (typeof navigator !== "undefined" && navigator.userAgent) || "";
export const isIOS = bgtest ? bgtest[1] === "ios" :
  /iPhone|iPad|iPod/i.test(UA) ||
  (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ""));
export const isMobile = bgtest ? true : (isIOS || /Android/i.test(UA));

/* ---------- the carrier element ---------- */
let el = null, armed = false, carrying = false;
let gen = 0;                                       // bumped per render request; stale renders discard
const urls = [];                                   // blob URLs, at most 2 kept alive
const st = { state: "idle", stage: null, durSec: 0, gen: 0, sampledOnly: false,
             lastRenderMs: 0, url: null, fallbacks: 0, lastError: null,
             // the carrier-first half: which source the ear is on, whether a
             // re-render is on its way, and why we fell back if we did
             mode: "graph", pending: false, demoted: null,
             // WHICH CARRIER the element is running: the seamless append route
             // ("mms-aac"/"mse-opus"/…) or "loop-wav", the shipped blob-on-loop
             // that costs ~6 ms of silence at every wrap. seamWhy names the
             // reason whenever it is the second one.
             seam: "loop-wav", seamWhy: null,
             // WHERE THE TIME WENT, per phase, in ms — because "the render is
             // slow" is not a finding, it is a feeling. A composed song failed
             // to render inside 300 s on the reference box and nobody could say
             // which of the five phases owned the seconds. Measured here so the
             // gate and the readout argue with numbers.
             phases: null, phase: null, wantSec: 0, wantBars: 0, chunks: 0, chunkMs: 0, each: null, hits: 0, misses: 0,
             ratio: 0, nodes: 0, pooled: 0,
             // which drum lanes the last tape really carried (the channels'
             // laneIn ledger, not the score's opinion) — "no drums" was a
             // report this file had no number for — beside what the SCORE for
             // that same tape asked for, and the difference. lanesMissing is
             // the bug; the other two are the working.
             lanes: [], lanesWant: [], lanesMissing: [],
             // the press's own honesty: voices with no parent module, sources
             // that would not decode. Empty on every tape that is whole.
             unrouted: [], missing: [],
             // how many windows the singer really reached, and how many
             // syllables it was handed there — "it sang" as two numbers rather
             // than as an intention
             sung: 0, sungNotes: 0 };
// one render's stopwatch: ph.mark("pool") closes the phase that was open and
// opens 'pool'. Cheap enough to leave armed in production (five performance.now
// calls per render), and the alternative is instrumenting it again next time.
// Reported LIVE (st.phase = the phase now open, st.phases = the closed ones),
// because the first thing this instrument had to answer was "which phase is the
// 300 s in" — and a stopwatch that only publishes when the render RETURNS
// cannot answer that about a render that never returns.
function stopwatch(sink) {
  const out = {}; let t = performance.now(), name = null;
  return {
    mark(next) {
      const now = performance.now();
      if (name) out[name] = Math.round((out[name] || 0) + (now - t));
      name = next; t = now;
      if (sink) { sink.phases = out; sink.phase = next; }
    },
    done() { this.mark(null); return out; },
    out,
  };
}
// the machine-readable truth for test/browser/nukernel-survival.test.js — the
// gate reads the RENDERED BLOB through st.url, because an analyser on the
// live graph is structurally blind to an element playing bytes
window.__nuBounce = () => ({ ...st, carrying, armed,
  mobile: isMobile, ios: isIOS, carrierFirst: carrierFirst(),
  // THE RADIO STATE MACHINE, read from the outside: which source has the ear,
  // whether the room behind it is parked (the CPU claim, as a fact rather than
  // as an intention), how long since anybody touched anything, and what the
  // machine WOULD do with that. want != mode for at most one second.
  desk: deskCarrier, parked: isParked(), handingBack: handingBack(),
  // COMING BACK, as a state anything outside can read: whether a warm-up is in
  // flight, how far its honest milestones have got, which of the two proofs
  // have landed, and — once it has crossed — how long the live graph actually
  // took to become ready. That last number is the one the ceiling is set from,
  // and it is measured on the machine rather than guessed at the desk.
  returning: !!ret, returnFrac: ret ? ret.frac : 0,
  returnPrimed: ret ? ret.primed : null, returnSounding: ret ? ret.sounding : null,
  returnStalled: ret ? ret.stalled : false, returnCrossed: ret ? !!ret.crossed : false,
  returnMs: st.returnMs != null ? st.returnMs : null, returnCeil: RETURN_CEIL,
  // the master tap PRE-mute: what the live graph is making, whether or not the
  // room can hear it. It is the readiness proof, so it is readable from outside
  graphRms: +rmsNow().toFixed(5),
  idleMs: Math.round(nowMs() - lastTouch), idleAfter: IDLE_MS,
  away, want: wantNow(),
  // the SHIPPED short-stage cap, so a gate asks this module what the insurance
  // tape is instead of hardcoding a number that then goes stale in two places
  shortCap: SHORT_CAP,
  // elTime is the PHASE — where in the song the tape is. It used to be
  // el.currentTime because the two were the same number; in seam mode the
  // element's clock is stream time and only grows, so the reading every caller
  // wanted all along is named explicitly here.
  elVolume: el ? el.volume : null, elTime: elPhase(),
  elStreamTime: el ? el.currentTime : null,
  seamAhead: seam.on && el ? +(seam.appendedSec - (el.currentTime || 0)).toFixed(3) : null,
  seamPushes: seam.pushes, seamLoopN: seam.loopN,
  elMuted: el ? el.muted : null, elLoop: el ? el.loop : null,
  // el.paused is a RENDERED consequence (play() rejected, decode failed) —
  // carrying/elVolume are flags this module SET, and a gate that polls only
  // what the code assigned proves the assignment, not the playback
  elPaused: el ? el.paused : null });
// the TARGET, stated as a number the gate can read: a song of N seconds must
// render in well under N seconds or the carrier handoff (and with it mobile
// background survival) waits on the tape. ratio = renderMs / (durSec*1000).
window.__nuRender = () => ({ ms: st.lastRenderMs, durSec: st.durSec,
  ratio: st.ratio, phases: st.phases, phase: st.phase,
  wantSec: st.wantSec, wantBars: st.wantBars, chunks: st.chunks,
  parallel: PARALLEL, chunkSec: CHUNK_SEC, chunkMs: st.chunkMs, each: st.each,
  // WHICH THREAD MADE IT — "worker" is the ordinary answer and "main" is the
  // fallback, which is audible (it is the block that made the mix go bare), so
  // it belongs in the report rather than in a console line nobody reads.
  thread: pressPath(),
  hits: st.hits, misses: st.misses,
  nodes: st.nodes, pooled: st.pooled, lanes: st.lanes,
  lanesWant: st.lanesWant, lanesMissing: st.lanesMissing,
  unrouted: st.unrouted, missing: st.missing,
  sung: st.sung, sungNotes: st.sungNotes,
  stage: st.stage, sampledOnly: st.sampledOnly });
// TEST SEAM: render a known length RIGHT NOW and hand back the phase report.
// The budget gate cannot wait on the debounce (it would be timing the timer),
// and the growth curve — "how does cost scale with song length" — is only
// askable if the length is an argument. Refuses while a real render is in
// flight, because two OfflineAudioContexts competing measure neither.
window.__nuRenderNow = async (capSec, opts) => {
  if (rendering) return null;
  rendering = true;
  if (opts && opts.cold) dropWindowCache();
  try {
    const t0 = performance.now();
    const res = await withChunkSec((opts && opts.chunkSec) || 0,
                                   () => renderSong(capSec || 0),
                                   (opts && opts.preBars) || 0);
    if (!res) return null;
    const ms = Math.round(performance.now() - t0);
    // …AND A FINGERPRINT OF THE TAPE ITSELF. A render budget gate that only
    // reads a clock passes just as happily on a render that got fast by going
    // silent; this is the artifact, in 24 RMS windows and a peak.
    // 64 windows, because the unit a caller compares is a WINDOW OF THE TAPE
    // and a one-box edit only touches a few seconds of a long song — at 24 the
    // buckets were wider than the edit and averaged it away.
    const d = res.buf.getChannelData(0), W = 64, w = Math.floor(d.length / W);
    const rms = [];
    let peak = 0;
    for (let k = 0; k < W; k++) {
      let acc = 0;
      for (let i = k * w; i < (k + 1) * w; i++) { const v = d[i]; acc += v * v; if (v > peak) peak = v; }
      rms.push(+Math.sqrt(acc / w).toFixed(7));
    }
    return { ms, durSec: res.durSec, ratio: ms / (res.durSec * 1000),
             phases: res.phases, chunks: st.chunks,
             hits: st.hits, misses: st.misses,
             nodes: st.nodes, pooled: st.pooled,
             // the DRUM LANES the tape really carries, from the channels'
             // own laneIn ledger — the answer to 'no drums' (E) — with the
             // score's own ask beside it, so the gate can subtract rather
             // than eyeball
             lanes: st.lanes, lanesWant: st.lanesWant,
             lanesMissing: st.lanesMissing,
             // the singer's own census of this render — an ADDED key, so every
             // existing reader is untouched (nukernel-bounce (D) reads it).
             // __nuSing's counters are the PAGE's, cumulative and shared with
             // the live graph, so they cannot answer "did THIS tape sing";
             // sung/sungNotes are this render's own and they can.
             sing: (typeof window.__nuSing === "function" ? window.__nuSing() : null),
             sung: st.sung, sungNotes: st.sungNotes,
             // NO SILENT FALLBACKS, readable from the outside
             unrouted: st.unrouted, missing: st.missing,
             // { tap: [t0, t1] } returns the raw samples of that span, both
             // channels — the seam probes read the artifact, not a summary
             tap: (opts && opts.tap)
               ? [0, 1].map(ch => Array.from(res.buf.getChannelData(
                     Math.min(ch, res.buf.numberOfChannels - 1))
                   .slice(Math.floor(opts.tap[0] * SR), Math.floor(opts.tap[1] * SR))))
               : null,
             rms, peak: +peak.toFixed(5) };
  } finally { rendering = false; }
};
// test seam: ?nobounce holds the page in the "no carrier exists" state, so the
// survival gate can prove the no-carrier hide branches deterministically —
// without it they race a short render that lands in a couple of seconds
const disarmed = /[?&]nobounce\b/.test(location.search);
// …and its sibling: ?noseam holds the carrier on the SHIPPED loop=true blob, so
// the before/after of the gapless change is measurable on the same tape by the
// same probe — and so the fallback tier is a path a gate can actually walk
// rather than a branch nobody ever takes.
const noSeam = /[?&]noseam\b/.test(location.search);

// tiny silent-WAV data URI — the parent's unlock trick: a muted play() of this
// inside the gesture is what permits every later programmatic play()
function silentWav(ms) {
  const sr = 8000, n = Math.max(1, Math.round(sr * (ms || 120) / 1000)), dataLen = n * 2;
  const buf = new ArrayBuffer(44 + dataLen), dv = new DataView(buf);
  let o = 0;
  const w = s => { for (let i = 0; i < s.length; i++) dv.setUint8(o++, s.charCodeAt(i)); };
  w("RIFF"); dv.setUint32(o, 36 + dataLen, true); o += 4; w("WAVE");
  w("fmt "); dv.setUint32(o, 16, true); o += 4; dv.setUint16(o, 1, true); o += 2; dv.setUint16(o, 1, true); o += 2;
  dv.setUint32(o, sr, true); o += 4; dv.setUint32(o, sr * 2, true); o += 4; dv.setUint16(o, 2, true); o += 2; dv.setUint16(o, 16, true); o += 2;
  w("data"); dv.setUint32(o, dataLen, true); o += 4;      // zeros = silence
  const bytes = new Uint8Array(buf); let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(bin);
}
function armCarrier() {
  if (armed || disarmed) return;
  armed = true;
  el = new Audio();
  el.autoplay = false; el.loop = true; el.preload = "auto";
  el.setAttribute("playsinline", ""); el.playsInline = true;
  el.style.display = "none";
  // BEFORE any attach, the parent's hard-won order: ManagedMediaSource-era
  // WebKit wants remote playback disabled up front or media plumbing hangs
  // silently — and a background carrier must never be an AirPlay target anyway
  try { el.disableRemotePlayback = true; } catch (e) {}
  el.setAttribute("x-webkit-airplay", "deny");
  el.muted = true; el.volume = 0;
  el.src = silentWav(150);
  const p = el.play(); if (p && p.catch) p.catch(() => {});
  // the boundary swap: loop=true means `ended` never fires, so a pending
  // re-render turns the loop OFF for one pass and takes the wrap as its cue.
  // A src swap at the downbeat is the one cut in this file that cannot click.
  el.addEventListener("ended", () => { if (el.loop) return; swapNow(); });
  document.body.appendChild(el);
}
onGesture(armCarrier);                             // rides startAt's synchronous prefix
// THE PHONE'S ANSWER, which never changes: mobile, an element that exists, and
// no demotion on record. ?nobounce (below) disarms the element entirely, which
// is also the honest answer here — a page with no carrier must never mute its
// graph. Everything that is a fact about PHONES rather than about carrying —
// the 500 ms debounce, the readout's running commentary — still asks this one.
const phoneFirst = () => isMobile && armed && !disarmed && !st.demoted;

/* ---------- THE TAPE IS THE PATH WHENEVER NOBODY IS TOUCHING ---------- */
// A DESK IS NOT A DIFFERENT MACHINE (2026-08-16). Everything above this line
// was written as though the carrier were a mobile accommodation and a desktop
// tab were a safe place to run a live synthesiser. It is not: Paul, tabbed
// away, listening — "when the browser sleeps the song turns off. It's very
// vexing especially since we solved it." We had solved it, for phones, and
// left the desk on the path we already knew fails, because a hidden tab is not
// a page a browser feels much duty toward. It throttles its timers, it
// deprioritises its audio thread, it suspends its context on a sleeping
// display, and every one of those is fatal to a graph that must schedule a bar
// every 1.9 seconds forever. The tape is fatal to none of them: a playing
// <audio> element is MEDIA, and media is the one thing an OS keeps alive.
//
// So the carrier stops being the mobile branch and becomes the PLAYBACK PATH,
// and the only question left is when the live graph gets the ear instead. The
// answer is the honest one: WHEN SOMEONE IS TOUCHING THE MACHINE. An edit must
// be audible in the bar it is made, and no rendered tape can promise that. So:
//
//   touching  ->  the live graph, everything immediate, everything expensive
//   quiet     ->  the tape, and the whole room parked (audio/graph.js park)
//
// where "quiet" is IDLE_MS of nobody touching anything, or — with no wait at
// all — the page being hidden or the window losing focus, because those are
// the two moments where a live graph is about to be starved.
//
// THIRTY SECONDS, and it is a musical number rather than a round one: long
// enough that a listener who is scrubbing a fader, opening a menu, thinking
// with their hand still on the desk is never interrupted by a handoff, short
// enough that "I put this on and went to read something" reaches the tape
// before the reading does. ?idle= moves it, which is how the probe measures
// both states in one page rather than waiting half a minute per reading.
export const IDLE_MS = (() => {
  const m = /[?&]idle=(\d+)/.exec(location.search);
  return m ? Math.max(0, +m[1]) : 30000;
})();
const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
let lastTouch = nowMs();                           // when a human last did anything
let away = false;                                  // hidden, or the window lost focus
let deskCarrier = false;                           // the desk has handed the ear over
let handing = null;                                // the bar-aligned handback, pending

// THE DECISION, AS A FUNCTION OF NOTHING BUT ITS ARGUMENTS. Every fact this
// machine turns on — playing, phone, hidden, away, how long since a touch,
// whether a full tape exists — arrives as a value, so the state machine can be
// walked in pure node (test/unit/nukernel.test.js §54) instead of only in a
// browser where a handoff is a race against a render. The live path calls it
// with the live values and no second copy of the reasoning exists.
//
// The two refusals are the ones this file has always had: nothing carries
// without an armed, undemoted element, and NOTHING CARRIES A FRAGMENT — a desk
// handoff waits for the full tape, because handing a listener the first box on
// loop is worse than the live graph they already have (shortIsInsurance).
export function carrierWant(w) {
  if (!w.armed || w.disarmed || w.demoted || !w.playing) return "graph";
  if (w.mobile) return "carrier";                  // the phone's answer, unchanged
  const after = w.after != null ? w.after : IDLE_MS;
  const quiet = w.hidden || w.away || (w.idleMs != null && w.idleMs >= after);
  if (!quiet) return "graph";
  return w.ready && w.full ? "carrier" : "graph";
}
function wantNow() {
  return carrierWant({
    armed, disarmed, demoted: !!st.demoted, playing, mobile: isMobile,
    hidden: typeof document !== "undefined" && document.visibilityState === "hidden",
    away, idleMs: nowMs() - lastTouch,
    ready: st.state === "ready", full: st.stage === "full" });
}
// ...and the one place that acts on it. Called on every hide, every blur and
// once a second; the phone is exempt because its answer is a constant.
function settle() {
  if (isMobile || disarmed) return;
  const want = wantNow();
  if (want === "carrier" && !deskCarrier) {
    deskCarrier = true;
    // ALREADY CARRYING IS ALREADY DONE. A return still warming up — the graph
    // rebuilding behind a tape that never stopped — is exactly this case, and
    // goCarrier refuses it (it refuses anything already carrying), so without
    // this line the flag just set would be taken straight back off and the
    // warm-up would cross to a graph in a room nobody is in.
    if (cancelReturn() || carrying) return;
    if (!goCarrier()) deskCarrier = false;         // nothing to hand off to yet
  } else if (want === "graph" && deskCarrier) handBack();
}
// SOMEONE IS TOUCHING THE MACHINE. Both halves matter: the clock restarts, and
// if the tape had the ear it gives it back. Wired to the raw input events
// rather than to the app's own edit events because the intent shows up in the
// pointer before it shows up in the store — a person who has just put a finger
// on a fader is about to want the live graph.
export function touched() {
  lastTouch = nowMs();
  away = false;
  if (deskCarrier) handBack();
}
// THE HANDBACK LANDS ON A BAR LINE, and that is the whole of why it cannot be
// heard. The two sources are the same song at the same phase, so the only
// audible thing about a swap is where in the phrase it happens: mid-bar it is
// a splice, on the downbeat it is a downbeat.
//
// GOING OUT IS EASY AND COMING BACK IS NOT (2026-08-17, Paul, on the build
// that shipped the night before: "there are definitely glitches when I come
// back in to the browser. Why don't you fade out radio and come back to live
// with a loading graphic on page?"). Handing OUT to the tape hands over to
// something that ALREADY EXISTS — the render is finished, the element is
// playing it. Handing BACK hands over to a graph that has been parked: not
// pulled, therefore not computing, with a transport that has been advancing
// its bar counter without scheduling a note into it (setQuietWhen, above).
// That graph has to fill a bar, build any channel the next section needs, and
// have the voices actually SOUNDING by the instant it takes the ear — and the
// code here used to drop the quiet flag, take the very next bar line and hope.
// The gap between "the flag dropped" and "the graph is making the sound" is
// the glitch, and it is a whole bar wide.
//
// So the return is a WARM-UP, and it is Paul's design in four rules:
//
//   1. DO NOT SWITCH IMMEDIATELY. The tape keeps playing. It is the same song
//      and it is already correct; silence and stutter are both worse than
//      staying on tape a moment longer.
//   2. REBUILD BEHIND IT. The room is unparked and the quiet flag dropped in
//      the same tick, so the transport fills bars into a muted master while
//      the tape is still the audible thing.
//   3. PROVE IT, then cross. Two milestones, both MEASURED and neither a
//      timer: the transport has handed a bar to the live graph (nextBarAt has
//      moved past the bar we were at when the touch came in), and the master
//      analyser — which taps PRE-mute, so it hears a graph nobody can — reads
//      real signal. A graph that is scheduling and sounding into silence is a
//      graph that can be unmuted on the beat.
//   4. IF IT IS NOT READY, STAY ON THE TAPE and ask again at the next bar.
//      Never silence, never a stutter — bounce.js's own demote rule, in the
//      other direction.
//
// Not seekPhase(): the desk's context never froze, so the graph's clock has
// been running in step with the tape the whole time it was parked, and a seek
// would land the transport on the NEXT bar boundary — up to a whole bar of
// silence in exchange for correcting a drift of a few milliseconds. The 1 Hz
// syncEl below keeps the two within 30 ms; the bar line closes the rest.
function handBack() {
  if (isMobile || !deskCarrier) return;
  deskCarrier = false;                             // tick() schedules again NOW
  unparkGraph();                                   // ...and the room is computed again
  if (!carrying) return;
  if (ret || handing) return;                      // a return is already in flight
  if (JUMPCUT) { jumpCut(); return; }              // ?jumpcut: the old hope, for the probe
  warmReturn();
}
// ?jumpcut — THE BEFORE, kept as a walkable path (the ?noseam precedent). The
// return gap is a number, and a number needs the two readings taken on the
// same page by the same probe: this is the shipped-last-night handback, the
// one that drops the flag, takes the next bar line and hopes.
const JUMPCUT = /[?&]jumpcut\b/.test(location.search);
function jumpCut() {
  const at = playing ? nextBarAt() : 0;
  const wait = playing && ctx ? Math.max(0, (at - ctx.currentTime) * 1000) : 0;
  const cross = () => {
    handing = null;
    if (deskCarrier) return;                       // the page went quiet again mid-cross
    carrying = false; st.mode = "graph"; st.pending = false;
    if (el) {
      el.volume = 0;                               // element down, graph up, one instant
      if (st.url && el.src !== st.url && !seam.on) attachCurrent();
    }
    if (playing) unmuteRamp(12);
  };
  if (wait < 8) cross();
  else handing = setTimeout(cross, Math.min(4000, wait));
}

/* ---------- the warm-up, and the loading line over it ---------- */
// THE CEILING IS MEASURED, NOT GUESSED. The warm-up cannot finish before the
// graph has played a bar into the mute, so its floor is one bar — 1.9 s at 126
// bpm — and measured on the reference box a cold return reaches "sounding" in
// 1.4–2.2 s (test/probes/nukernel-return.probe.js). Six seconds is three bars
// of headroom over that: long enough that a slow section change or a channel
// that has to be built is waited out, short enough that a graph which is never
// going to sound stops promising it will. Past it the tape simply keeps the
// song — that is the whole penalty — and the next touch tries again.
const RETURN_CEIL = (() => {
  const m = /[?&]ready=(\d+)/.exec(location.search);
  return m ? Math.max(200, +m[1]) : 6000;
})();
const XF_SEC = 0.08;                               // the crossfade, both sides
const READY_RMS = 0.004;                           // silence is ~1e-4; music 0.2..0.6
let ret = null;                                    // the warm-up in flight
// THE DECISION, AS A FUNCTION OF NOTHING BUT ITS ARGUMENTS — the same law
// carrierWant() is written under, and for the same reason: a handback is a
// race against a render in a browser and a truth table in node. Four answers
// and no fifth, and the only one that moves the ear is "cross".
export function returnStep(w) {
  if (!w.carrying) return "graph";                 // nothing is carrying: nothing to cross
  if (!w.playing) return "stop";                   // the transport went away under us
  if (w.primed && w.sounding) return w.atBar ? "cross" : "wait";
  // THE CEILING, AND WHY IT IS NOT SIMPLY A REFUSAL. Past it, a graph that has
  // been given bars and is not making a sound is either broken or playing a
  // genuinely quiet passage — and refusing forever would lock a listener out of
  // the live machine for the crime of returning during an intro. So the
  // STRUCTURAL proof alone is enough once we have waited long enough for the
  // other one: bars are being scheduled, so a bar line is a legal place to
  // stand. With no bars at all there is nothing to cross to, and the tape
  // keeps the song — never silence, never a stutter.
  if (w.waited >= w.ceiling) return w.primed ? (w.atBar ? "cross" : "wait") : "stay";
  return "warm";
}
function warmReturn() {
  // the bar the transport will fill FIRST. Everything before it was counted
  // off while the room was quiet and never became sound, so it is the earliest
  // instant at which "the graph has scheduled something" can be true.
  const first = playing && ctx ? nextBarAt() : 0;
  ret = { t0: nowMs(), first, primed: false, sounding: false, readyMs: null,
          frac: 0, stalled: false, bars: 0, poll: null };
  progress(0.12);                                  // the room is connected again
  ret.poll = setInterval(warmStep, 25);
  warmStep();
}
function warmStep() {
  if (!ret) return;
  const waited = nowMs() - ret.t0;
  // MILESTONE 1 — the transport has handed a bar to the live graph. nextBarAt
  // is the next bar NOT YET SCHEDULED, so its having moved past the bar we
  // were sitting on is exactly "one bar of this song is now in the graph".
  if (!ret.primed && playing && nextBarAt() > ret.first + 1e-4) {
    ret.primed = true; ret.bars = 1; progress(0.45);
  }
  // MILESTONE 2 — ...and the graph is really MAKING that bar. rmsNow taps the
  // master chain before outGain, so it hears a graph the room cannot: this is
  // the parent's own boot rule (app/audio/live.js bootBar: "wait for REAL
  // sound, not a guess"), which is the only honest way to know a voice pool
  // warmed, a sampler decoded and a channel got built.
  if (ret.primed && !ret.sounding && rmsNow() > READY_RMS) {
    ret.sounding = true; ret.readyMs = Math.round(waited); progress(0.82);
  }
  const at = playing && ctx ? nextBarAt() : 0;
  const now = ctx ? ctx.currentTime : 0;
  // a downbeat we can still ramp INTO. Closer than the fade itself and the
  // curve would start in the past, which is a cut wearing a fade's name — so
  // that bar is skipped and the next one asked for, 4 rule.
  const atBar = at >= now + XF_SEC + 0.02;
  const step = returnStep({ carrying, playing, primed: ret.primed,
                            sounding: ret.sounding, waited,
                            ceiling: RETURN_CEIL, atBar });
  if (step === "cross") { commitCross(at); return; }
  if (step === "wait") return;                     // ready, waiting for a bar line
  if (step === "warm") {
    // HONEST, INCLUDING ABOUT BEING STUCK: past a second and a half with no
    // milestone the line stops pretending to move and shimmers instead (the
    // parent's `ind` class, same 1400 ms). It never creeps to 99%.
    if (waited > 1400 && !ret.stalled) { ret.stalled = true; progress(ret.frac); }
    return;
  }
  // "graph" / "stop" / "stay": the ear stays exactly where it is. On "stay"
  // that means the tape keeps the song — never silence, never a stutter — and
  // the next touch starts a fresh warm-up.
  if (step === "stay") {
    st.returnStalled = (st.returnStalled || 0) + 1;
    console.warn("[nukernel] the live graph did not become ready in " +
                 RETURN_CEIL + " ms — staying on the tape");
    deskCarrier = true;                            // it is the audible path again, honestly
  }
  endReturn();
}
function commitCross(at) {
  if (!ret) return;
  ret.crossed = true;
  clearInterval(ret.poll); ret.poll = null;
  progress(0.95);
  // THE GRAPH RISES ON THE AUDIO CLOCK, sample-accurately, from the downbeat
  // the transport named — equal power, so the join holds level against the
  // element's cosine coming down through the same window.
  fadeUpAt(at, XF_SEC);
  const lead = Math.max(0, (at - (ctx ? ctx.currentTime : 0)) * 1000);
  // ...and the tape comes down on the only clock an <audio> element has. It is
  // started 6 ms EARLY on purpose: a setTimeout can be late and never early,
  // and being a few milliseconds ahead of the audio clock costs a sliver of
  // two sources at PARTIAL gain, where being late costs both at FULL.
  handing = setTimeout(() => {
    handing = null;
    if (deskCarrier || !ret) { endReturn(); return; }  // it went quiet again mid-cross
    elFade(XF_SEC * 1000);
  }, Math.max(0, lead - 6));
}
// the element's side of the curve, stepped. 4 ms is finer than any UA's own
// volume smoothing and cheap for the 80 ms it runs.
function elFade(ms) {
  const t0 = nowMs(), v0 = el ? el.volume : 0;
  // the flags flip HERE, at the top of the fade, so nothing downstream (the
  // 1 Hz watchdog, armSwap, a render landing mid-cross) can treat the element
  // as the audible path while it is on its way down
  carrying = false; st.mode = "graph"; st.pending = false;
  const tick2 = () => {
    const x = Math.min(1, (nowMs() - t0) / ms);
    if (el) { try { el.volume = clampVol(v0 * epDown(x)); } catch (e) {} }
    if (x >= 1) {
      clearInterval(iv);
      // a tape that landed while we were carrying has been waiting for exactly
      // this moment (armSwap only swaps at the loop wrap while it is audible),
      // and it waits until the fade is OVER so the swap is not inside it
      if (el && st.url && el.src !== st.url && !seam.on) attachCurrent();
      progress(1);
      endReturn();
    }
  };
  const iv = setInterval(tick2, 4);
  tick2();
}
function endReturn() {
  if (ret && ret.poll) clearInterval(ret.poll);
  const r = ret; ret = null;
  if (r) { st.returnMs = r.readyMs; st.returnBars = r.bars; }
  // NEVER SILENCE, held as an invariant rather than as a sequence of correct
  // calls (the 1 Hz tick's own law, in the other direction): every way out of
  // a return that did NOT cross — the transport stopped, the tape was taken
  // away under us, the ceiling with nothing scheduled — leaves the graph muted
  // behind an element that may already be down. If nothing is carrying, the
  // room is the sound and it says so.
  if (r && !r.crossed && !carrying && playing && !isParked()) unmuteRamp(20);
  emit("return", { on: false, frac: 1, stalled: false });
}
// THE PAGE WENT QUIET AGAIN MID-WARM-UP — hidden, blurred, or thirty seconds of
// nobody. The tape is still the audible path and stays it: the warm-up is
// abandoned, the graph goes back to silent, and the room re-parks on the next
// 1 Hz tick. A cross already committed is past the point of stopping, and does
// not need stopping — it ends with the graph audible, and settle() hands the
// tape the ear again a second later through the front door.
function cancelReturn() {
  if (!ret) return false;
  if (ret.crossed) return false;
  if (handing) { clearTimeout(handing); handing = null; }
  clearInterval(ret.poll); ret = null;
  if (carrying) muteNow();
  emit("return", { on: false, frac: 1, stalled: false });
  return true;
}
// THE LOADING LINE IS THE WARM-UP'S OWN PROGRESS, never a timer's. It moves
// because a milestone closed, it shimmers when nothing has closed for a second
// and a half, and it is WORDLESS — a hairline under the transport, no text and
// no percentage ("success is almost no words"). ui/readout.js draws it.
function progress(frac) {
  if (!ret) return;
  ret.frac = Math.max(ret.frac, frac);             // monotonic: never walks backward
  st.returnFrac = ret.frac;
  emit("return", { on: true, frac: ret.frac, stalled: ret.stalled });
}
// survival.js asks this before it does its own reverse handoff: while a return
// is warming or crossing the element is still the audible source, and an
// un-mute from anywhere else is two copies of the song at once.
export const handingBack = () => !!handing || !!ret;
// THE CARRIER IS THE PATH: the phone always, the desk whenever it has gone
// quiet. Everything downstream of "is the tape the audible source" — the quiet
// tick, the swap at the wrap, the survival handoff — reads this one answer.
export const carrierFirst = () => phoneFirst() || (deskCarrier && armed && !disarmed && !st.demoted);
// the transport asks this every tick: while the element carries, the muted
// graph's scheduling is work nobody can hear — and now that the desk carries
// too, it is the desk's fans this saves as much as the phone's battery
setQuietWhen(() => carrying && carrierFirst());

// the raw signals. `capture` so a handler that stops propagation cannot make
// the machine think the room is empty; `passive` so listening costs nothing on
// a scroll. Becoming visible or focused IS an interaction — a person who has
// just come back to look at the machine gets the live one.
if (typeof document !== "undefined" && document.addEventListener) {
  for (const ev of ["pointerdown", "keydown", "wheel", "touchstart"])
    document.addEventListener(ev, touched, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { away = true; settle(); }
    else touched();
  });
  addEventListener("focus", touched);
  addEventListener("blur", () => { away = true; settle(); });
  // ANOTHER APP ON TOP IS NOT A visibilitychange. A window that loses focus to
  // a different application stays "visible" by the spec and stops being looked
  // at by any other measure, which is precisely the tab-away Paul reports.
}

/* ---------- render scheduling ---------- */
// the musical identity of what a render would capture: song + phrases + tempo
// + font + loop selection + the MASTER BUS + the song's GROOVE, SWING and
// INSTRUMENT POOL (song facts like the tempo, and no longer inside the boxes
// — so they must be named here or a groove, swing or recast-chair change
// would never re-render the carrier). Volume is deliberately absent —
// the carrier renders at unity and the element's own volume does the placing
// on handoff — but a master global is not a volume: it is a treatment baked
// into the bytes, so leaving it out here would leave the pocket playing an
// untreated tape of a song the ear just heard through a tape machine.
const sig = () => JSON.stringify({ s: SONG, sl: SLOTS, bpm, f: FONT, lo: loopOnly,
                                   m: MASTER, bu: BUSES, g: GROOVE, sw: SWING,
                                   p: POOL });
let adoptedSig = null, timer = null, rendering = false, dirty = false;
// the short stage's duration budget, in seconds — WAV-FIRST's firstSegSec.
//
// IT USED TO BE 4, AND 4 SECONDS IS NOT A PHRASE. A bar-aligned cut of the
// song's head at that cap comes out at one or two bars, and Paul heard exactly
// what that is: "every two Beatles measures has a complete and sudden pause at
// the end", and on Lagos 1971 a kick-and-crash pair wrapping every 3.93 s —
// "the crash loops and loops on a different tempo" — because a 2.17 s tape of
// the first bar, looping, is a metre of its own laid over nothing. Measured on
// the shipped composer, that cut was ONE bar on Lagos with only the bass in it,
// and 5 of 8 corpus songs had no drums in the fragment at all.
//
// So the cut moves to a BOX BOUNDARY. A box is the composer's own unit — a
// section, a whole musical phrase, with its own kit, its own automation sweep
// and its own end — and a tape that is one whole box loops the way the song
// loops: the wrap is the downbeat the next section would have started on. That
// is the same timing law the full tape already obeys (foldLoop's wrap is a
// downbeat by construction); the short tape simply stops borrowing a boundary
// the music does not have.
//
// The cap is a CEILING ON EXTRA BOXES, not a truncation: shortCut always takes
// the first box WHOLE, however long it is, because half a phrase is the defect
// this change exists to remove. Measured over 290 composed songs (58 genres ×
// 5 seeds) the first box runs 5.99 s (median 10.11) to 27.97 s — the long tail
// is ambient/drone/pad, whose sections really are half a minute. At 16 s, 47 of
// 290 first boxes exceed the cap and are taken whole anyway, and 6 songs whose
// opening box is a short count-in get a second box under it. Sixteen because
// two short boxes are still inside a mobile listener's patience, and a third
// would be the song rather than the insurance.
//
// THE PRICE IS PAID KNOWINGLY: the first tape is a few seconds later than it
// was (the render is roughly linear in the music, so 2-4x the old 4 s stage).
// That is the trade the fragment was not worth. The full song still replaces it
// the moment it exists — maybeRender("short") schedules the full render behind
// itself, and adopt() swaps at the loop wrap.
//
// The short tape is still INSURANCE and not the performance: goCarrier refuses
// it, and the graph keeps the ear until the full render lands. The one door it
// still walks through is a frozen context (iOS, hidden), where the alternative
// is silence — and it is that listener this change is for. See
// shortIsInsurance below.
const SHORT_SEC = 16;
// WHEN THE CARRIER IS THE PATH, THE DEBOUNCE IS THE LATENCY OF THE INSTRUMENT.
// 4 s of quiet is right for insurance nobody is listening to; it is absurd for
// the thing making the sound. Long enough to coalesce a scrub (a fader drag
// emits per pointer move), and not one beat longer.
// PHONE, not carrying: on a desk an edit is heard on the live graph in the bar
// it is made, so the tape is never what anyone is waiting for and 4 s of quiet
// before re-rendering it is exactly right.
const DEBOUNCE = () => (phoneFirst() ? 500 : 4000);
// the readout is where "your edit is on its way" belongs — the alternative is
// a phone that ignores you for two seconds with no explanation. PHONE ONLY: on
// a desk the tape takes over only once nobody is touching the machine, and a
// machine nobody is touching has nobody to tell.
const say = text => { if (phoneFirst()) emit("status", { text, sticky: true }); };
// …and the same fact DURABLY, because a status line is wiped by the next
// render and "is my edit coming?" outlives one frame. ui/readout.js appends
// this to the box description; null means there is nothing to say (a desk).
export function carrierNote() {
  if (!phoneFirst()) return st.demoted ? "carrier off (" + st.demoted + ") — live graph" : null;
  if (!carrying) return st.state === "rendering" ? "carrier: rendering the tape…" : null;
  if (st.pending) return st.state === "rendering"
    ? "carrier: re-rendering — your edit lands at the loop"
    : "carrier: new take ready — swaps at the loop";
  return "carrier: playing the rendered tape";
}
function schedule(delayMs) {
  clearTimeout(timer);
  // debounced: edits wait for quiet so a scrub does not queue thirty renders.
  // The timer path is always a FULL render — the short stage is kicked
  // directly by transport:state, never queued behind a debounce.
  timer = setTimeout(() => maybeRender("full"), delayMs == null ? DEBOUNCE() : delayMs);
}
async function maybeRender(stage) {
  stage = stage || "full";
  if (!armed || !playing) return;
  if (rendering) { dirty = true; return; }         // one render at a time
  const want = sig();
  if (st.state === "ready" && adoptedSig === want &&
      (stage === "short" || st.stage === "full")) {
    // this music is already rendered — a short ask is satisfied by ANY
    // adopted blob, a full ask only by a full one. A short blob still owes
    // the song: keep the full render coming.
    if (st.stage !== "full") schedule(1200);
    return;
  }
  rendering = true;
  st.state = "rendering";
  if (carrying && carrierFirst()) {
    st.pending = true;
    say("carrier: re-rendering the tape — the edit lands at the loop");
  }
  const myGen = ++gen;
  const t0 = performance.now();
  try {
    const res = await renderSong(stage === "short" ? SHORT_SEC : 0);
    if (myGen !== gen) { /* stale: a newer request superseded this render */ }
    else if (!res) st.state = st.url ? "ready" : "idle";   // nothing to render
    else {
      adopt(res, want, myGen, stage);
      st.lastRenderMs = Math.round(performance.now() - t0);
      st.ratio = res.durSec ? st.lastRenderMs / (res.durSec * 1000) : 0;
    }
  } catch (e) {
    if (myGen === gen) {
      // a render CAN fail outright — addModule on an OfflineAudioContext is
      // a per-browser fact, and iOS is the browser it is a fact about. A
      // failed FULL render must not orphan a short carrier already serving:
      // if any blob is adopted the carrier stays 'ready' on it; 'failed' is
      // only honest when there is nothing to play. lastError keeps
      // __nuBounce's report honest either way.
      st.lastError = String((e && e.message) || e).slice(0, 120);
      st.state = st.url ? "ready" : "failed";
      console.warn("[nukernel] bounce render failed:", e);
    }
  }
  rendering = false;
  if (stage === "short") schedule(1200);           // the full song, behind the carrier
  else if (dirty) { dirty = false; schedule(1500); }
}

/* ---------- the offline render ---------- */
// THE TAPE IS RENDERED IN WINDOWS, AND THAT IS NOT AN OPTIMISATION DETAIL —
// it is the only shape in which a whole song renders at all. MEASURED on this
// box, one OfflineAudioContext over the whole song (a composed 141.6 s
// beatles): 3.9 s of music cost 1.1 s, 15.5 s cost 14.1 s, 46.5 s cost 179 s.
// That is ~n^2.3, and the extrapolation for the full song is about 25 minutes.
// It never finished inside the 300 s anyone was willing to wait, which on
// mobile means the audible path never arrives (bounce is the carrier).
//
// WHY IT IS QUADRATIC, measured rather than guessed: a 32 s render created
// 2919 nodes — 1599 gains, 511 biquads, 386 buffer sources and, the expensive
// ones, 195 DynamicsCompressors and 195 WaveShapers. Those are the PER-NOTE
// channel strips (engine/faust/voices/sampler.js ~1244, buildStripNodes, the
// profiles nukernel copies in instruments.js STRIPS, whose own comment already
// warns "sampler.js builds the strip PER NOTE"). The live graph tears each one
// down again — sampler.js:1255 hangs teardown on `src.onended` plus a
// wall-clock setTimeout — and NEITHER OF THOSE FIRES DURING AN OFFLINE RENDER:
// onended is delivered after startRendering resolves, and setTimeout measures
// a clock the render is not on. So every note the tape has ever played is
// still in the graph, being pulled every 128-sample quantum, for the rest of
// the render. Node population grows linearly with song length; cost per
// quantum grows with it; the product is the square.
//
// Stage 1's shared busses are NOT the term here and re-measuring says so: the
// whole shared rack is 69 nodes and the channels 11 more (window.__nuMix), a
// rounding error against 2919. The per-note strip is the term.
//
// Chunking fixes it BY CONSTRUCTION rather than by surgery. Each window is its
// own context, so its node population is bounded by the notes in that window
// and the cost is linear in the song. It buys a second, independent factor as
// well: chromium renders each OfflineAudioContext on its own thread, so
// windows rendered concurrently really do overlap — measured 2.43x for three
// at once on this 4-core box.
//
// THE SEAM LAW (docs/WAV-FIRST.md v2: cut on a bar line, never into a
// transient) is honoured the way a tape op honours it — with PRE-ROLL, not
// with a crossfade. A window renders the bar BEFORE its own first bar and
// throws that bar's output away. Everything that has to be true at the seam
// then simply is: the reverb and delay buses arrive carrying the ring-out of
// the previous bar because they really played it, and the master chain's
// compressor and limiter arrive with real gain reduction on them rather than
// wide open. Output is therefore a pure CONCATENATION — every sample of the
// tape is produced by exactly one window, through one master chain — which is
// what a crossfade of two independently-limited windows could not promise.
// The one seam that stays additive is the LOOP WRAP, which foldLoop
// already owns and which is a downbeat by construction.
//
// The pre-roll is one BAR rather than N seconds so the walk stays bar-indexed:
// no fractional bar arithmetic, and a pre-roll bar that opens a box arms that
// box exactly as the live tick does. A window that opens mid-box arms it
// through armAutomation's `fromSec` (audio/mixer.js) — one walk, offset, never
// a second copy of it.
const SR = 44100, LEAD = 0.05, TAIL = 1.5;
// WHERE THE PRESS'S MIX ENTERS THE DESK, and the reason it is a division rather
// than a number. The press hands back a FINISHED stereo mix; the live graph's
// master takes the SUM OF THE CHANNELS and trims it by graph.MASTER_HEADROOM
// before the glue compressor hears anything. So the tape has to arrive where
// that sum arrives. Measured on a composed beatles song (2026-08-17, a tap on
// the live master input against the tape of the same bars, phase-aligned): the
// live glue heard 0.1225 RMS and the press's tape sat at 0.1041 — 1.6 dB apart,
// which is inside what the glue and the limiter absorb. Written as 1/headroom
// so moving the headroom moves the carrier with it; a constant of its own is
// how the two paths drift apart again.
const BAND_TRIM = 1 / MASTER_HEADROOM;
// Seconds of MUSIC per window, and it is a BOWL, not a slope: the cost curve
// above is superlinear inside a window (so big windows are bad) while the
// one-bar pre-roll is a fixed tax per window (so small ones are bad too).
// Measured on the composed beatles song, whole-song render, same page:
//   4 s -> 0.60x realtime    6 s -> 0.56x    10 s -> 0.71x    16 s -> 0.95x
// 4 and 6 are inside each other's noise on a loaded box; 6 is chosen because it
// reaches the same place with a third fewer windows, and every window is a
// master chain, a room and a kit desk built again.
let CHUNK_SEC = (() => {
  const q = /[?&]chunksec=(\d+(?:\.\d+)?)/.exec(typeof location !== "undefined" ? location.search : "");
  return q ? +q[1] : 6;
})();
// how many bars each window replays before its own first bar. One is the
// design; overridable per render (opts.preBars) because the seam A/B needed
// the depth as an instrument: measured on seed-7/1234 beatles heads, drift
// vs the one-window control is NOT monotonic in depth (even depths landed the
// walk on the 4-bar box grid and measured 0.0%, odd depths 16–20% at the
// box-boundary bucket) — so the seam leak is walk-alignment state, not a
// truncated tail, and a deeper default would buy cost without correctness.
let PRE_BARS = 1;
// ...AND IT IS OVERRIDABLE PER RENDER, for exactly one reason: the SEAM. A
// window boundary is invisible in a single render — the tape is a
// concatenation and looks continuous whatever fell down the crack — so the
// only way to prove nothing is lost at one is to render the same music with
// the seams in different places and compare. `let` plus __nuRenderNow's
// { chunkSec } is that A/B (test/browser/nukernel-bounce.test.js (D)); the
// query flag above is unchanged and is still what a person reaches for.
const withChunkSec = async (n, fn, preBars) => {
  const was = CHUNK_SEC, wasPre = PRE_BARS;
  if (n > 0) CHUNK_SEC = n;
  if (preBars > 0) PRE_BARS = preBars;
  try { return await fn(); } finally { CHUNK_SEC = was; PRE_BARS = wasPre; }
};
// ONE AT A TIME, and that is a CONSEQUENCE of the press rather than a caution.
// The old windows were OfflineAudioContexts, and chromium gives each one its own
// render thread — so three at once really did overlap (measured 2.43x on this
// 4-core box). The parent's press is faustwasm offline processors called in a
// straight line, and audio/press-worker.js serializes them on its own queue, so
// `Promise.all` over them is a queue wearing a wave's clothes: it would hold
// three windows' buffers alive to buy nothing.
//
// AND THE THREAD IT IS A LINE ON IS NOT THIS ONE (2026-08-17). It was, for one
// commit, and that is the whole of what Paul heard as a jumpy fill bar and a mix
// that went bare for a measure — 47% of wall clock with the ear's thread simply
// gone. A second worker would buy parallelism back at the price of another core
// beside the audio thread on a four-core box, which is the trade this file
// already refuses to make ("a bounce that starves the audible path has made the
// wrong trade"); the answer to a slow tape is a cache hit, not a busier box.
// ?renderpar= survives for the same reason ?noseam does — the old path stays
// walkable — but the default is honest.
const PARALLEL = (() => {
  const q = /[?&]renderpar=(\d+)/.exec(typeof location !== "undefined" ? location.search : "");
  return q ? Math.max(1, +q[1]) : 1;
})();

/* ---------- the window cache: an edit re-renders what it changed ---------- */
// EVEN LINEAR IS NOT FAST ENOUGH, measured: windowing takes the composed
// beatles song from "did not finish in 300 s" to 82-99 s over repeated runs,
// which is 0.6-0.7x its own duration on this box. The budget is 0.25x. The gap
// is not another constant factor hiding somewhere — it is the graph itself, at
// ~1.2x realtime per window with the per-note strips the mix is made of, and
// three windows at a time is already all the cores there are.
//
// But a re-render is not a render. An edit moves ONE box, and the tape is now
// literally a concatenation of independently rendered windows, so the windows
// that box does not touch are already correct on disk. Keyed on WHAT A WINDOW
// RENDERS rather than on where it sits, so inserting a box early in the song
// does not invalidate the ones after it: the key is the bars' own content, the
// sections they play, the tempo, the font, the master bus and the two facts
// about the window's geometry that change its samples (whether it carries the
// loop tail, and how far into a box it opens).
const winCache = new Map();                        // key -> { chs, n }
// Bounded in SAMPLES, not entries, because a window is a few MB of Float32 and
// what matters is total memory. The budget has to hold ONE WHOLE SONG or the
// no-edit case starts evicting the windows it is about to be asked for again —
// measured at half this size, a re-render with nothing changed hit only 14 of
// 24 windows. Counted in float slots across both channels, which is the unit
// cachePut adds, so the two agree; a phone gets a smaller ceiling because it is
// the device that cannot spare 70 MB, and a partial cache degrades to a partial
// speedup rather than to a fault.
const CACHE_MAX = (isMobile ? 150 : 220) * SR * 2;
let cacheSamples = 0;
function dropWindowCache() { winCache.clear(); cacheSamples = 0; }
// LRU by re-insertion: a hit moves the entry to the back of the Map, so the
// eviction walk below takes the front, which is the least recently rendered.
function cachePut(key, chs, n) {
  if (n * 2 > CACHE_MAX) return;                   // one window bigger than the budget
  winCache.set(key, { chs, n }); cacheSamples += n * 2;
  for (const k of winCache.keys()) {
    if (cacheSamples <= CACHE_MAX) break;
    const e = winCache.get(k);
    winCache.delete(k); cacheSamples -= e.n * 2;
  }
}
function cacheGet(key) {
  const e = winCache.get(key);
  if (!e) return null;
  winCache.delete(key); winCache.set(key, e);      // freshen
  return e;
}
// WHAT THIS WINDOW'S SAMPLES DEPEND ON, and nothing else. The bars carry their
// own events (buildTimeline has already expanded the phrases), the sections
// carry the mix — chanSpec and kitOf both read SONG[si] — and the three
// globals are the ones the signature at the top of this file already names as
// the musical identity of a render.
function winKey(TL, plan, ck, sd) {
  const sis = [];
  for (let i = ck.pre; i < ck.b; i++) if (!sis.includes(TL[i].si)) sis.push(TL[i].si);
  // BUSES rides in the key beside MASTER for the same reason: the builders bake
  // the rack trims into every window, so a knob move must miss the cache.
  // ...AND SO DOES THE POOL, which was missing and mattered even before the
  // press: recasting a chair changes which instrument every line of every box
  // is played on (derive.js poolInstrOf, and press-window.js seatsFor reads the
  // same answer), so a cache that could not see it would keep serving the old
  // band. `sig()` at the top of this file has always named it; the window key
  // simply had not caught up.
  return JSON.stringify([sd, FONT, MASTER, BUSES, POOL,
                         ck.b === TL.length, +plan.from[ck.pre].toFixed(6),
                         TL.slice(ck.pre, ck.b), sis.map(i => SONG[i])]);
}

// WHERE EVERY BAR SITS, in the two coordinates the walk needs: `t0` seconds
// from the top of the tape (so a window knows where its output lands) and
// `from` seconds into its own BOX (so a window opening mid-box can arm that
// box's automation at the right point). Computed once over the whole timeline
// because both are running sums and a window must not have to recompute the
// song to know where it starts.
function planChunks(TL, sd, chunkSec) {
  const bars = TL.map(b => b.barSteps * sd);
  // t0 carries ONE EXTRA entry, the end of the last bar, so a window's span is
  // always t0[b] - t0[a] with no special case for the final window
  const t0 = new Array(TL.length + 1), from = new Array(TL.length);
  let acc = 0, since = 0;
  for (let i = 0; i < TL.length; i++) {
    if (TL[i].first) since = 0;
    t0[i] = acc; from[i] = since;
    acc += bars[i]; since += bars[i];
  }
  t0[TL.length] = acc;
  const chunks = [];
  let a = 0, len = 0;
  for (let i = 0; i < TL.length; i++) {
    len += bars[i];
    if (len >= chunkSec || i === TL.length - 1) { chunks.push({ a, b: i + 1 }); a = i + 1; len = 0; }
  }
  // …and the pre-roll bars, which are simply the previous PRE_BARS (the first
  // window has none, and needs none: nothing precedes silence)
  for (const ck of chunks) ck.pre = Math.max(0, ck.a - PRE_BARS);
  return { chunks, t0, from, total: acc };
}
// TEST SEAM: the plan, over a bar list the caller supplies. "Does the tape
// carry the whole band" is a question about THIS — which bars each window
// renders, which of them it keeps, and how long the whole thing is — and it is
// answerable without a browser, which is where the answer belongs (a carrier
// that lost the drums is a score fact before it is an audio one). Pure over its
// arguments and allocating nothing the render needs, so a gate calling it costs
// a plan and no contexts. test/unit/nukernel.test.js §50.
export const planFor = (TL, sd) => planChunks(TL, sd, CHUNK_SEC);
// THE SHORT STAGE'S CUT — the head of the song, on a BOX LINE. Whole boxes
// only: the first one always, however long it is, and each following one only
// if the whole of it still fits under the cap. Never a partial box, which is
// the entire point (see SHORT_SEC) — a phrase cut off at an arbitrary bar is
// the thing that looped as a fragment.
//
// `first` is the timeline's own box-start stamp (buildTimeline writes it on the
// bar that opens a section), so this walks the same boundaries the live tick
// arms automation on. Ending the cut where a box ends means the loop wrap is
// the downbeat the next section would have begun on, which is the same law
// foldLoop already relies on for the full tape.
//
// Exported because what this returns is the whole argument for carry()'s
// refusal above AND for this change: the gate measures the phrase that is left
// in it — its length, its boundary and the drum lanes it plays — rather than
// taking the claim on trust, and one arithmetic serves the render and the
// measurement both.
export function shortCut(TL, sd, capSec) {
  const cut = []; let acc = 0, i = 0;
  while (i < TL.length) {
    // the next WHOLE box: this bar, plus every bar after it that does not open
    // one. (TL[0] opens box 0 whether or not it is stamped, so the scan starts
    // from i unconditionally rather than testing TL[i].first.)
    let j = i + 1, box = TL[i].barSteps * sd;
    for (; j < TL.length && !TL[j].first; j++) box += TL[j].barSteps * sd;
    // AT LEAST ONE BOX, ALWAYS — the cap only ever refuses a SECOND one
    if (cut.length && acc + box > capSec) break;
    for (let k = i; k < j; k++) cut.push(TL[k]);
    acc += box; i = j;
    if (acc >= capSec) break;
  }
  return cut;
}
// the drum lanes a bar list PLAYS, from the score — the other half of the lane
// census. st.lanes is what the render's channels really routed (mixer.js
// laneIn); this is what the music asked for. A tape whose census is missing a
// lane this names has lost a drummer between the score and the bytes, which is
// precisely the class of defect "no drums on the tape" was, and it is now a
// number both the readout and the gate can subtract.
export const scoreLanes = TL => [...new Set(TL.flatMap(b =>
  (b.ev || []).filter(e => e.kind === "hit").map(e => e.d)))].sort();
export const SHORT_CAP = SHORT_SEC;

// ---- WHY THERE IS NO REAPER (a measured negative result) -------------------
// The obvious alternative to windowing was to keep ONE context and tear the
// dead notes out of it mid-render: an OfflineAudioContext can be suspended at a
// given render time, which is the one place graph surgery can happen, so the
// offline equivalent of sampler.js:1255's teardown is buildable. It WAS built,
// and it worked exactly as designed — the per-note nodes were captured by
// tapping the factories for the length of each synchronous SamplerLive.note()
// call (which also, neatly, never catches the lazily-built permanent
// structures, since mixer.js voiceBus() and the kit desk's laneIn() run before
// the player is asked for a note rather than inside it), and each note's death
// was computed from sampler.js's own arithmetic on the arguments.
//
// IT MADE THE RENDER SLOWER. Measured on one song in one page, A/B'd in the
// same run at three sweep intervals: 0.78x at a sweep every 1 s, 0.91x every
// 4 s, 0.92x every 8 s. The audio was bit-for-bit indifferent to it (max
// |dRMS| 0.000000 across 24 windows, identical peak), so this is a cost result
// and not a correctness one: disconnecting a node does not buy back its share
// of chromium's offline render loop, and every suspend/resume is a round trip
// to a main thread that is busy playing the live graph. Windowing gets the same
// bound on node population for free, by never putting the nodes in one graph in
// the first place, and it parallelises. Do not re-derive this.

// ONE WINDOW, PRESSED. The whole of what used to be here — an
// OfflineAudioContext, a master chain, a kit desk, a per-note WebAudio strip
// for every note in the window and a Faust worklet pool bolted on — is gone.
// audio/press-window.js hands the bars to the parent engine's own offline
// render walk (engine/faust/live/stream-renderer.js, the walk node's press and
// the desktop stream are both gated against), which knows how to play them
// because engine/faust/voices/state-engine.js has always known.
//
// THE SUNG LINE IS THE ONE THING THAT STAYS ON THIS PAGE'S OWN PATH, and it is
// named rather than dropped: nukernel's singer is espeak slices resampled and
// vocoded by audio/sing.js, and the parent has no voice for it (to-engine.js
// reports it in `unrouted`). It is played in the desk pass below, through the
// same strip the band lands on — one desk, one master, one take.
//
// AND THE PRESSED BAND IS NOT THE TAPE (2026-08-17). It is the BAND: what came
// back from the press is a room full of players, and the mix Paul was listening
// to is that band through this song's desk — the box's strip and the song's
// master. Handing the press's bytes straight to the element was handing over an
// unmixed rough, which is exactly what he heard the moment he tabbed away: a
// weird sudden drop in volume and most of the effects gone. Measured before the
// fix, on a composed beatles song: moving the master from its defaults to
// drive/pump/cassette/cathedral/wide/dark/loud took the live graph up ten-fold
// and left the tape's 64-window fingerprint BYTE-IDENTICAL — the tape could not
// hear the desk at all. So the press's window now goes back through it.
async function renderChunk(TL, plan, ck, sd, tally) {
  const bars = TL.slice(ck.pre, ck.b);
  const preBars = ck.a - ck.pre;
  const tailSec = ck.b === TL.length ? TAIL : 0;
  const t0 = performance.now();
  // keepPre: the desk below needs the pre-roll SOUNDED, not just rendered — its
  // compressor, its room and its tape wobble have to be warm when the kept bars
  // arrive, which is the whole argument for a pre-roll in the first place
  const res = await pressWindow(bars, { sd, preBars, tailSec, keepPre: true });
  const ms = performance.now() - t0;
  tally.chunkMs += ms;
  tally.each.push([Math.round(ms), +(plan.t0[ck.b] - plan.t0[ck.pre] + tailSec).toFixed(2),
                   res ? res.units : 0]);
  if (!res) return { chs: [new Float32Array(0), new Float32Array(0)], n: 0 };
  tally.nodes += res.units;
  for (const u of res.unrouted) tally.unrouted.push(u);
  for (const m of res.missing) tally.missing.add(m);
  for (const d of res.lanes) tally.lanes.add(d);
  return renderDesk(TL, plan, ck, sd, res, tally);
}

// THE DESK, OVER ONE WINDOW. The band arrives as bytes and is played back
// through the box's own channel strip (audio/mixer.js buildChannel — the same
// EQ, inserts, level, pan, automation and the same three sends the live tick
// builds), the singer plays live beside it into the same strip, and the whole
// window leaves through this song's master chain (graph.buildMasterChain, the
// same spec, the same numbers). Returns { chs, n } trimmed to the window's own
// output — the pre-roll really played and is then thrown away.
//
// WHAT IS STILL THE PRESS'S AND NOT THE DESK'S, said out loud because a silent
// gap is how this bug happened: the PART desk under the strip (a per-chair
// fader, a cut, a part send) cannot reach a stereo sum, so a cut track is still
// on the tape; and the drum kit's own room is the parent's inside the bytes
// rather than this page's kit desk. Both need stems out of the press, which is
// a different day's work.
async function renderDesk(TL, plan, ck, sd, band, tally) {
  const preSec = plan.t0[ck.a] - plan.t0[ck.pre];
  const outSec = plan.t0[ck.b] - plan.t0[ck.a];
  const tailSec = ck.b === TL.length ? TAIL : 0;
  // long enough for the band's own bytes as well as for the walk: the press
  // rounds its window to whole render chunks, so it may hand back a hair more
  // tape than the plan's arithmetic asks for, and a context short of that would
  // cut the ring-out foldLoop is about to take home
  const octx = new OfflineAudioContext(2,
    Math.max(Math.ceil((LEAD + preSec + outSec + tailSec) * SR),
             Math.round(LEAD * SR) + band.n), SR);
  // the same room: master numbers, echo topology, cached reverb impulses —
  // all built by the graph's own parameterized builders
  // THE SAME MASTER, spec included. buildMasterChain resolves the song's
  // globals itself, so the carrier gets the drive, the tape, the room, the
  // width, the tilt and the ceiling the live graph is playing through — not a
  // second opinion about them. (Its LFO phase is its own, which is the one
  // honest difference: see the TAPES note in fields.js.)
  const master = buildMasterChain(octx, MASTER);   // out stays at unity
  const echo = buildEchoBus(octx, master.input);
  const verbs = new Map();
  const verb = name => {
    let v = verbs.get(name); if (!v) verbs.set(name, v = makeVerb(octx, name, master.input));
    return v;
  };
  // the DRUM ROOM is part of the room, so the carrier renders it: a bounce
  // without it is a drier mix than the one the ear was just listening to
  // ...AND THE SAME SHARED RACK, one of each, exactly as the live graph has it:
  // one kit desk for the whole render and one bus per character effect. Built
  // lazily on the same first-use law, so a carrier of a song with no chorus
  // renders no chorus. Per WINDOW now rather than per song, which is the same
  // sentence with the same meaning: one of each, for everything being mixed.
  const room = DRYROOM ? null : buildRoomBus(octx, master.input);
  let kitDesk = null;
  const offSends = new Map();
  const env = { master: master.input, verb, echoIn: echo.input, room,
                kit: () => (kitDesk || (kitDesk = buildKitDesk(octx, room))),
                send: (k) => {
                  if (!offSends.has(k))
                    offSends.set(k, buildSendBus(octx, k, master.input, 4 * sd));
                  return offSends.get(k);
                } };
  const chans = new Map();
  const chanOf = sec => {
    const spec = chanSpec(sec), k = JSON.stringify(spec);
    let c = chans.get(k);
    if (!c) {
      c = buildChannel(octx, spec, env); c.key = k; chans.set(k, c);
    }
    return c;
  };

  // NO SYNTH POOL AND NO PLAYER INJECTION. Nothing in this pass makes a note
  // except playSyllable, which the bar walk reaches directly — every other kind
  // of event has already been pressed by the parent, so the walk below is fed
  // bars whose event lists are the sung ones and nothing else.
  const offSynth = () => false;

  // ---- the band, played back through the box it belongs to ----
  // One buffer, one source per RUN OF BARS SHARING A BOX, because the strip is
  // the box's: a run enters the channel the live tick would have built for that
  // section, at BAND_TRIM, and everything the strip does to a note it now does
  // to the whole band. The runs cut on box lines, so the two neighbours are
  // CROSSFADED over a few milliseconds centred on the line rather than butted:
  // the signal is the same on both sides of it, so two linear ramps sum to
  // unity and the only thing that crosses is the treatment. (The tail of the
  // last run is the ring-out, which belongs to the box that played it.)
  const bandBuf = octx.createBuffer(2, band.n, SR);
  for (let c = 0; c < 2; c++) bandBuf.copyToChannel(band.chs[c], c);
  const XF = 0.006;
  const bandSec = band.n / SR;
  const runs = [];
  for (let i = ck.pre; i < ck.b; i++) {
    const last = runs[runs.length - 1];
    if (last && TL[i].si === last.si && !TL[i].first) last.b = i + 1;
    else runs.push({ si: TL[i].si, a: i, b: i + 1 });
  }
  for (let r = 0; r < runs.length; r++) {
    const run = runs[r], sec = SONG[run.si];
    if (!sec) continue;
    const a0 = plan.t0[run.a] - plan.t0[ck.pre];
    const b0 = run.b === ck.b ? bandSec : plan.t0[run.b] - plan.t0[ck.pre];
    const s0 = Math.max(0, a0 - XF), s1 = Math.min(bandSec, b0 + XF);
    if (!(s1 > s0)) continue;
    const src = octx.createBufferSource(); src.buffer = bandBuf;
    const g = octx.createGain();
    g.gain.setValueAtTime(r === 0 ? BAND_TRIM : 0, LEAD + s0);
    if (r > 0) g.gain.linearRampToValueAtTime(BAND_TRIM, LEAD + a0 + XF);
    if (run.b < ck.b) {
      g.gain.setValueAtTime(BAND_TRIM, LEAD + Math.max(s0, b0 - XF));
      g.gain.linearRampToValueAtTime(0, LEAD + s1);
    }
    src.connect(g); g.connect(chanOf(sec).input);
    src.start(LEAD + s0, s0, s1 - s0);
  }

  // ---- the walk: the live tick's bar loop against offline time ----
  let t = LEAD, cur = null, mine = 0;
  for (let i = ck.pre; i < ck.b; i++) {
    const bar = TL[i], sec = SONG[bar.si];
    if (!sec) continue;
    // THE WINDOW'S FIRST BAR IS ALWAYS A SETUP BAR, whether or not it opens a
    // box: this context has never heard of this section, so the channel, the
    // echo time, the synth focus and the kit gates all have to be stated. When
    // it opens a box that is exactly the live tick's `bar.first`; when it opens
    // mid-box, `fromSec` carries the box's motion to where the ear expects it.
    const head = i === ck.pre;
    if (!cur || cur.si !== bar.si || bar.first)
      cur = { si: bar.si, chan: chanOf(sec), kit: kitOf(sec) };
    if (bar.first || head) {
      echo.setTime(DTIMES[sec.dtime || "d8"], t);
      // the SAME walker the live tick arms — the carrier honors automation
      // (mot included, since mot compiles into the same list in chanSpec)
      // the box's REAL length and the box's own beat, exactly as the live tick
      // arms it — a nominal `bar × boxBars` here would put the carrier's
      // automation somewhere the graph's is not, which is the one thing this
      // walk exists to prevent
      armAutomation(cur.chan, t, bar.boxSteps * sd,
                    sd * 4 * (bar.boxSteps / bar.boxNom),
                    bar.first ? 0 : plan.from[i]);
      focusKit(cur.chan, t);        // one kit desk for the render, one section at a time
    }
    // ONLY THE SUNG EVENTS. The bar is handed to the live tick's own switch so
    // the singer keeps its chair, its strip and its sends; the rest of the band
    // arrived as bytes above and is already on that same strip.
    const sung = (bar.ev || []).filter(e => e.kind === "sing");
    mine += sung.length;
    scheduleBar({ ...bar, ev: sung },
                sec, cur.chan, cur.kit, t, sd, offSynth);
    t += TL[i].barSteps * sd;
  }
  // "IT SANG", AS TWO NUMBERS AND NOT AS AN INTENTION: how many windows carried
  // a sung line and how many syllables were handed to the singer in them. The
  // peak this used to report is gone with the separate sing pass — the sung
  // line is inside the mix now and cannot be measured apart from it — and a
  // count of the notes really scheduled says the same thing the peak was there
  // to say, which is that the espeak instances bought samples.
  if (mine) { tally.sung++; tally.sungNotes += mine; }
  const buf = await octx.startRendering();
  // trimmed to the window's own output — the pre-roll really played (a syllable
  // ringing across the seam is produced, not guessed, and the master arrives at
  // the seam with real gain reduction on it) and is then thrown away
  const skip = Math.round((LEAD + preSec) * SR);
  const n = Math.max(0, Math.min(band.n - band.pre, buf.length - skip));
  const chs = [new Float32Array(n), new Float32Array(n)];
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1));
    for (let i = 0; i < n; i++) chs[c][i] = d[skip + i];
  }
  return { chs, n };
}

async function renderSong(capSec) {
  const ph = stopwatch(st); ph.mark("timeline");
  let TL = buildTimeline();
  if (!TL.length) return null;
  const sd = stepDur();
  if (capSec) {
    // the SHORT stage: the head of the song, cut on a BOX line — whole
    // sections, never a truncated one, so the loop wrap is a downbeat the
    // music itself has. Its loop is the song's OPENING, not the user's current
    // position: a whole phrase of the right music beats half a minute of
    // silence, and the full render replaces it as soon as it exists.
    TL = shortCut(TL, sd, capSec);
  }
  const plan = planChunks(TL, sd, CHUNK_SEC);
  const durSec = plan.total;
  st.wantSec = durSec; st.wantBars = TL.length; st.chunks = plan.chunks.length;
  // THE SINGER, WARMED BEFORE ANY WINDOW OPENS — and this is not a nicety on
  // mobile, it is the difference between a sung line existing and not. The
  // carrier IS the audible path on a phone (the WAV-FIRST decision at the top
  // of this file), so a voice that only ever warms on the live graph's own
  // ensureAssets is silent on the device most likely to be listening.
  // renderChunk's walk is synchronous by construction; every espeak instance
  // has to be paid here, once for the whole tape, or not at all. Idempotent
  // and cached, so the second stage and every re-render after an edit hit the
  // same slices — which also means the two-stage render does not synthesize
  // the same line twice.
  ph.mark("voices");
  for (const w of singWork()) await warmSing(w.plan, w.text);
  // THE PARENT PRESS, PROVED PRESENT BEFORE ANYTHING COMMITS TO IT. There is no
  // second renderer to fall back to any more, so a page whose engine/faust is
  // missing must say so once and loudly rather than per window.
  if (!(await pressReady())) throw new Error("parent press unavailable: " + pressError());
  ph.mark("render");
  st.sampledOnly = false;
  offFallback.n = 0;
  const tally = { nodes: 0, pooled: 0, chunkMs: 0, each: [], sampledOnly: false,
                  lanes: new Set(), unrouted: [], missing: new Set(),
                  sung: 0, sungNotes: 0 };
  const done = new Array(plan.chunks.length);
  // WAVES, not a free-for-all: PARALLEL contexts at a time. Unbounded
  // Promise.all over seventy windows would put seventy render threads and
  // seventy graphs' worth of buffers in flight at once, which is how a phone
  // turns a speedup into an out-of-memory reload.
  const keys = plan.chunks.map(ck => winKey(TL, plan, ck, sd));
  let hits = 0;
  const todo = [];
  for (let k = 0; k < plan.chunks.length; k++) {
    const got = cacheGet(keys[k]);
    if (got) { done[k] = got; hits++; } else todo.push(k);
  }
  for (let i = 0; i < todo.length; i += PARALLEL) {
    const wave = todo.slice(i, i + PARALLEL);
    const got = await Promise.all(wave.map(k => renderChunk(TL, plan, plan.chunks[k], sd, tally)));
    for (let j = 0; j < got.length; j++) { done[wave[j]] = got[j]; cachePut(keys[wave[j]], got[j].chs, got[j].n); }
  }
  st.hits = hits; st.misses = todo.length;
  st.sampledOnly = tally.sampledOnly;
  st.fallbacks = offFallback.n;
  // the node census of the OFFLINE graph, the same question __nuMix answers for
  // the live one: stage 1's shared busses are only a win if the bounce got them
  // too, and a bounce that quietly kept a rack per section would show up here
  // and nowhere else.
  st.nodes = tally.nodes; st.pooled = tally.pooled;
  st.sung = tally.sung; st.sungNotes = tally.sungNotes;
  st.lanes = [...tally.lanes].sort();
  // NO SILENT FALLBACKS, as a field. `unrouted` is every nukernel voice the
  // parent engine had no module for (audio/to-engine.js names each one and
  // says why); `missing` is every sample source that would not decode. Both
  // are audible holes, so both are readable from outside and neither is a
  // console line nobody reads. Deduped on the reason, because a run of boxes
  // sharing a cast reports the same hole once per box.
  {
    const seen = new Set(), out = [];
    for (const u of tally.unrouted) {
      const k = u.what + "|" + u.why;
      if (seen.has(k)) continue;
      seen.add(k); out.push(u);
    }
    st.unrouted = out;
    st.missing = [...tally.missing];
    if (out.length) console.warn("[nukernel] the press could not route:",
      out.map(u => u.what).join(", "));
    if (st.missing.length) console.warn("[nukernel] the press could not decode",
      st.missing.length, "sample source(s)");
  }
  // THE CENSUS, SUBTRACTED. st.lanes is what the channels really routed; the
  // score says what the bars asked for. A short tape is now a WHOLE BOX, so
  // "the box plays a snare and the tape has none" is a checkable sentence
  // rather than a feeling — and it is checkable on the full tape by the same
  // arithmetic. Recorded rather than thrown: a carrier that lost a lane is
  // still better than no carrier, and the gate is where this becomes a
  // failure. (It is empty on every tape that is honest.)
  // COMPARED ON THE LETTER. A machine lane earns its own strip key ("tr808|k")
  // in the channels' ledger while a sampled one is the bare letter, and the
  // claim here is about LANES — subtracting the two spellings unchanged would
  // report every drum missing on every machine-kit genre, which is a false
  // alarm that would train the next reader to ignore the field.
  st.lanesWant = scoreLanes(TL);
  const carried = new Set([...tally.lanes].map(k => String(k).split("|").pop()));
  st.lanesMissing = st.lanesWant.filter(d => !carried.has(d));
  if (st.lanesMissing.length)
    console.warn("[nukernel] the tape is missing drum lane(s) the score plays:",
                 st.lanesMissing.join(","));
  st.chunkMs = Math.round(tally.chunkMs); st.each = tally.each;

  // ---- assembly: a pure concatenation, plus the last window's ring-out ----
  ph.mark("assemble");
  const N = Math.round(durSec * SR), tailN = Math.round(TAIL * SR);
  const chs = [new Float32Array(N + tailN), new Float32Array(N + tailN)];
  for (let k = 0; k < plan.chunks.length; k++) {
    const ck = plan.chunks[k], src = done[k];
    if (!src) continue;
    // EXACT SAMPLE BOUNDARIES, taken from the running sum rather than from each
    // window's own length: rounding a duration per window drifts a sample at a
    // time and a one-sample hole at a seam is a click.
    const at = Math.round(plan.t0[ck.a] * SR);
    const end = ck.b === TL.length ? N + tailN : Math.round(plan.t0[ck.b] * SR);
    for (let c = 0; c < 2; c++) {
      const d = src.chs[c], o = chs[c];
      const n = Math.min(end - at, src.n, o.length - at);
      for (let i = 0; i < n; i++) o[at + i] = d[i];
    }
  }
  st.phases = ph.done();
  // foldLoop wraps the ring-out onto the head, so it is handed a buffer
  // that is already lead-stripped and already carries its tail past N — the
  // duck type is the three members it reads.
  const buf = { length: N + tailN, numberOfChannels: 2,
                getChannelData: c => chs[c] };
  return { buf, durSec, lead: 0, sr: SR, phases: ph.out };
}

/* ---------- fold + encode ---------- */
// The loop wrap is a DOWNBEAT, so the seam law's hardest rule (never cut on
// one) is satisfied by construction: the render is continuous through sample
// N into the tail, and folding that ring-out additively onto the head is what
// a DAW's "bounce loop with tail" does — the reverb and releases of the last
// bar arrive under the first bar of the next pass, exactly as they do live.
// The last ~10 ms of the folded tail is eased to zero so the fold itself
// cannot step.
function foldLoop(res) {
  const { buf, durSec, lead, sr } = res;
  const N = Math.round(durSec * sr), lead0 = Math.round(lead * sr);
  const tailN = Math.max(0, Math.min(buf.length - lead0 - N, N));
  const fade = Math.max(1, Math.round(0.01 * sr));
  const chs = [new Float32Array(N), new Float32Array(N)];
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1));
    const o = chs[c];
    for (let i = 0; i < N; i++) o[i] = d[lead0 + i];
    for (let i = 0; i < tailN; i++) {
      let v = d[lead0 + N + i];
      if (i > tailN - fade) v *= (tailN - i) / fade;
      o[i] += v;
    }
  }
  return { chs, N, sr };
}
// 16-bit stereo WAV, EXACTLY N frames — the blob is same-origin bytes, decodable
// by the gate, and its declared data length is the score's own sample count with
// nothing added. Exported because that is the law test/unit/nukernel.test.js §53
// holds: a container that pads is a container that gaps at the wrap.
export function wavBytes(chs, N, sr) {
  const dataLen = N * 4;
  const ab = new ArrayBuffer(44 + dataLen), dv = new DataView(ab);
  let p = 0;
  const w = s => { for (let i = 0; i < s.length; i++) dv.setUint8(p++, s.charCodeAt(i)); };
  w("RIFF"); dv.setUint32(p, 36 + dataLen, true); p += 4; w("WAVE");
  w("fmt "); dv.setUint32(p, 16, true); p += 4; dv.setUint16(p, 1, true); p += 2; dv.setUint16(p, 2, true); p += 2;
  dv.setUint32(p, sr, true); p += 4; dv.setUint32(p, sr * 4, true); p += 4; dv.setUint16(p, 4, true); p += 2; dv.setUint16(p, 16, true); p += 2;
  w("data"); dv.setUint32(p, dataLen, true); p += 4;
  for (let i = 0; i < N; i++)
    for (let c = 0; c < 2; c++) {
      const v = Math.max(-1, Math.min(1, chs[c][i]));
      dv.setInt16(p, v < 0 ? v * 0x8000 : v * 0x7fff, true); p += 2;
    }
  return ab;
}
function adopt(res, want, myGen, stage) {
  // the fold+WAV encode is the sixth phase and it is NOT inside renderSong —
  // it runs here, on the main thread, over every sample of the tape. Timed in
  // the same units as the other five so the report adds up to lastRenderMs.
  const encT = performance.now();
  const fold = foldLoop(res);
  const url = URL.createObjectURL(new Blob([wavBytes(fold.chs, fold.N, fold.sr)],
                                           { type: "audio/wav" }));
  if (res.phases) res.phases.encode = Math.round(performance.now() - encT);
  urls.push(url);
  while (urls.length > 2) { try { URL.revokeObjectURL(urls.shift()); } catch (e) {} }
  st.url = url; st.durSec = res.durSec; st.gen = myGen; st.state = "ready";
  st.stage = stage;
  adoptedSig = want;
  // the no-stall cutover: never yank the source out from under a carrying
  // element — the swap waits for the loop wrap (armSwap) when the element is
  // the audible path, and for uncarry() when it is only the pocket copy. And
  // only while the transport still RUNS: a render finishing after stop() must
  // not restart the element the transport:state(false) handler just paused (an
  // unmuted volume-0 loop decodes forever — worse than the muted loop that
  // handler's own comment forbids). The render stays adopted; the next play's
  // transport:state handler attaches it.
  if (el && !carrying && playing) attachCurrent();
  else if (carrying) armSwap();
  // THE FIRST TAPE TAKES OVER, on mobile, foreground, no hide involved. Until
  // this line the page held audio focus only while backgrounded, which is to
  // say never: the OS decides what a page is at the moment it starts playing.
  if (carrierFirst() && !carrying && playing) goCarrier();
  // announced AFTER the attach so a listener's carry() finds the new blob in
  // the element. survival.js uses this for the lands-while-hidden pickup —
  // impossible on iOS (the page is frozen), real on Android.
  emit("bounce:ready", { stage });
  // A TAPE THAT ARRIVES INTO AN EMPTY ROOM TAKES THE EAR. The desk goes quiet
  // (or hidden) long before the full render lands on any composed song, and
  // settle() refused it then for the honest reason that there was nothing to
  // hand over. This is that refusal being answered.
  settle();
  // …and behind all of it, the SEAMLESS tape: the same folded loop, encoded
  // once and appended forever, so the wrap costs no samples at all. It lands
  // when it lands; until then the WAV above is already playing (with the
  // element's own ~6 ms hole at each wrap), which is what shipped before.
  seamBuild(fold, res.durSec, myGen);
}
function attachCurrent() {
  if (!el || !st.url) return;
  // in seam mode the element's source is the MediaSource, not a blob URL, and
  // the new tape arrives through the append pump rather than through src
  if (seam.on) { st.pending = false; seamPlay(); return; }
  el.src = st.url; el.loop = true;
  // audible by VOLUME, never by unmute — and while the element is the path
  // that volume is the real one. A muted element is not media: the OS gives
  // it no session, which is the whole bug this mode exists to fix.
  el.muted = false; el.volume = carrying ? clampVol(masterVol()) : 0;
  st.pending = false;
  const p = el.play(); if (p && p.catch) p.catch(() => {});
  syncEl();
}
const clampVol = v => Math.max(0, Math.min(1, v));

/* ---------- the seamless tape (the parent's fMP4 append, come home) ---------- */
// MEASURED FIRST, then fixed (2026-08-16). A `loop=true` <audio> element is NOT
// gapless in any shipping browser: the wrap is a seek, and the seek flushes the
// decode pipeline. Headless chromium, a 47863-sample sine tape whose content is
// exactly periodic, captured off the element through a ScriptProcessor:
//
//     wav + loop=true       266 samples of SILENCE at every wrap (6.03 ms)
//     the same wav, not looped   0        (the floor of the measurement)
//
// So the phrase Paul heard looping "with an audible gap" was gapping in the
// container, not in the music — the fold in foldLoop() had already made the
// wrap sample-continuous, and the element threw the join away. MP3 is worse and
// for the reason this project proved on the zone diet the same morning: encoder
// delay + padding, measured here at 1981 samples (44.9 ms) per wrap through MSE.
//
// The cure is the parent's, verbatim (docs/WAV-FIRST.md v4, engine/faust/codec/
// fmp4.js): the element stops looping and becomes a STREAM. The folded loop is
// encoded ONCE, muxed into one fragmented-MP4 fragment, and that same fragment
// is appended again and again — each push carrying an EXPLICIT tfdt exactly
// loopSamples later than the last, so the tape's second pass begins on the
// sample after its first pass ends. Nothing is inferred, so nothing can drift
// and nothing can pad. Measured the same way, same tape: 0 silence samples at
// every wrap, and buffered length 5.982874 s against an arithmetic 5.982875 s
// — sample-exact across six passes.
//
// TWO THINGS ARE LOAD-BEARING and both were measured, not assumed:
//
//   1. THE WARM TAIL. A codec frame is not independent: its decode depends on
//      the frame before it. Encoding the loop from a COLD encoder and then
//      repeating those frames leaves the decoder crossing the wrap with state
//      the encoder never saw — measured as a single 19x sample step, which is
//      a CLICK where the gap used to be. So the encoder is warmed with the
//      loop's OWN LAST FRAME before the loop is fed: the frames we keep are
//      then the steady state of a tape that has already been round once.
//      Measured: max sample step 1.1x the signal's own maximum — the floor.
//   2. THE TRIMMED LAST FRAME. The loop is not a whole number of codec frames.
//      The last frame's DECLARED duration is cut to the remainder, so the
//      fragment's declared sample sum is the score's own sample count and not
//      one sample more. That is the law test/unit/nukernel.test.js §53 holds.
//
// Everything below degrades to the shipped WAV loop the moment anything is
// missing or refuses — a phone without WebCodecs hears exactly what it heard
// yesterday, which is the only safe shape for a change to the audible path.
const T_AAC = 'audio/mp4; codecs="mp4a.40.2"', T_OPUS = 'audio/mp4; codecs="opus"';
const MMS = typeof window !== "undefined" ? window.ManagedMediaSource : null;
const MSctor = MMS || (typeof window !== "undefined" ? window.MediaSource : null);
const mseTypeOk = t => {
  try { if (MMS && MMS.isTypeSupported) return MMS.isTypeSupported(t);
        if (MSctor && MSctor.isTypeSupported) return MSctor.isTypeSupported(t); } catch (e) {}
  return false;
};
// KEEP AHEAD / KEEP BEHIND, in seconds. One whole pass ahead is the floor (a
// wrap must never be the thing we are waiting to append), and the ceiling on
// how long a re-render waits to be heard is this same number — so it is kept
// tight rather than generous. Background timers throttle but do not stop while
// a media element plays, which is the whole reason the parent could do this.
const SEAM_AHEAD = () => Math.max(4, seam.loopSec || 0);
const SEAM_BEHIND = 20;
const seam = { on: false, why: null, tier: null, ms: null, sb: null, mux: null,
               mime: null, codec: null, frames: null, loopN: 0, loopSec: 0, sr: SR,
               ledger: [], appendedSec: 0, wants: true, building: false, pushes: 0, msUrl: null,
               // bumped by every teardown, so an encode that was in flight when
               // the song changed cannot attach its stream to the new one
               epoch: 0 };
// THE LENGTH THE LOOP HAS TO BE, and the measurement that forced it. A codec
// frame is atomic: opus is 20 ms, aac is 1024 samples, and a loop is not a whole
// number of either. The obvious answer — declare the last frame SHORT in the
// trun so the fragment's timeline sums to the loop exactly — is what this file
// tried first, and it is wrong in the one way that matters: chromium honours the
// declared duration for the buffered RANGE (buffered came back exact to a
// microsecond) and then plays the frame's full decoded output anyway. Measured
// on the real tape: 514 samples of encoder padding audible at every single wrap,
// the same 514 five times running — a hole where the downbeat goes, which is the
// bug we came to fix wearing a different hat.
//
// So the loop is RESAMPLED to a whole number of frames instead. The cost is a
// tempo/pitch scale of at most half a frame over the whole loop — 0.13% on a
// 7.6 s tape, 0.33% on a short insurance one, two to six cents, uniform across
// the pass rather than a hiccup at the seam — and the gain is that there is no
// partial frame to trim, no padding to play, and nothing left for a decoder to
// interpret. (Shortening the loop to floor(N/F) frames instead would put a real
// cut where foldLoop's continuous wrap is, which is a click, not a fix.)
export const loopSamplesFor = (n, frame) => Math.max(frame, Math.round(n / frame) * frame);
// the PURE half, exported for the node gate: the frames the fragment carries.
// With a frame-multiple loop this takes whole frames and nothing else, and the
// sum it returns MUST equal the loop exactly — §53 is that law.
export function loopFrames(chunks, loopSamples) {
  const frames = []; let sum = 0;
  for (const c of chunks || []) {
    if (sum >= loopSamples) break;
    const d = Math.min(c.duration | 0, loopSamples - sum);
    if (d <= 0) break;
    frames.push({ data: c.data, duration: d });
    sum += d;
  }
  return { frames, sum };
}
// the loop, at the encoder's rate and at a whole number of frames. ONE offline
// pass: the browser's own resampler, uniform across the whole tape, so the wrap
// foldLoop made continuous stays continuous.
async function seamResample(fold, rate, frame) {
  const M = loopSamplesFor(fold.N * rate / fold.sr, frame);
  if (rate === fold.sr && M === fold.N) return { chs: fold.chs, N: M, sr: rate };
  const oc = new OfflineAudioContext(2, M, rate);
  const b = oc.createBuffer(2, fold.N, fold.sr);
  b.copyToChannel(fold.chs[0], 0); b.copyToChannel(fold.chs[1], 1);
  const s = oc.createBufferSource(); s.buffer = b;
  s.playbackRate.value = (fold.N / fold.sr) / (M / rate);
  s.connect(oc.destination); s.start(0);
  const out = await oc.startRendering();
  return { chs: [out.getChannelData(0), out.getChannelData(1)], N: M, sr: rate };
}
// which codec this browser can both ENCODE and DEMUX. AAC first (it is what
// iOS has), opus second (it is what chromium has, and the headless gate's
// route). No mp3 tier: mp3 is exactly the padding this file is removing.
let codecPick = null;
async function seamPickCodec() {
  if (codecPick !== null) return codecPick;
  codecPick = false;
  if (!MSctor || typeof AudioEncoder === "undefined") return codecPick;
  // OPUS IS ALWAYS 48 kHz. Its frames are 20 ms of 48000, and Opus-in-ISOBMFF
  // wants the track timescale to say so — a 44100 timescale over 882-sample
  // frames is a stream the demuxer has to reconcile, and reconciling is exactly
  // where the samples went. AAC at 44100 is native and stays there.
  for (const [name, codec, mime, rate] of [["aac", "mp4a.40.2", T_AAC, SR],
                                           ["opus", "opus", T_OPUS, 48000]]) {
    if (!mseTypeOk(mime)) continue;
    try {
      const r = await AudioEncoder.isConfigSupported(
        { codec, sampleRate: rate, numberOfChannels: 2, bitrate: 192000 });
      if (r && r.supported) { codecPick = { name, codec, mime, rate }; break; }
    } catch (e) { /* an encoder that will not answer is an encoder we do not use */ }
  }
  return codecPick;
}
// HOW BIG IS A FRAME — asked of the encoder rather than assumed, because BOTH
// the warm tail and the loop length are measured in frames (aac is 1024 samples,
// opus is 20 ms = 960 at its own 48 kHz), and a ladder that hardcodes either is
// a ladder that silently mis-aligns on the other.
const frameN = {};
async function seamFrameN(pick) {
  if (frameN[pick.name]) return frameN[pick.name];
  let d = 0;
  const enc = new AudioEncoder({
    output: c => { if (!d) d = Math.round(c.duration * pick.rate / 1e6); }, error: () => {} });
  enc.configure({ codec: pick.codec, sampleRate: pick.rate, numberOfChannels: 2, bitrate: 192000 });
  const n = Math.round(pick.rate / 4);
  enc.encode(new AudioData({ format: "f32-planar", sampleRate: pick.rate, numberOfFrames: n,
    numberOfChannels: 2, timestamp: 0, data: new Float32Array(n * 2) }));
  await enc.flush();
  try { enc.close(); } catch (e) {}
  frameN[pick.name] = d > 0 ? d : 1024;
  return frameN[pick.name];
}
// encode the folded loop ONCE, at the codec's own rate and at a whole number of
// frames: one frame of its own tail to warm the encoder (discarded), then the
// loop itself, in ONE encoder pass — flush() is called once, at the end, because
// a flush between the two is a state reset and the warm tail is only worth
// anything if the state survives it.
async function seamEncode(fold0, pick) {
  const F = await seamFrameN(pick);
  const fold = await seamResample(fold0, pick.rate, F);
  const { chs, N } = fold;
  const SR2 = fold.sr, WARM = Math.min(F, N);
  const out = []; let desc = null, failed = null;
  const enc = new AudioEncoder({
    output: (c, meta) => {
      if (meta && meta.decoderConfig && meta.decoderConfig.description && !desc)
        desc = meta.decoderConfig.description;
      const d = new Uint8Array(c.byteLength); c.copyTo(d);
      out.push({ data: d, duration: Math.max(1, Math.round(c.duration * SR2 / 1e6)) });
    },
    error: e => { failed = (e && e.message) || String(e); } });
  enc.configure({ codec: pick.codec, sampleRate: SR2, numberOfChannels: 2, bitrate: 192000 });
  // the interleave WebCodecs wants is planar-by-channel in one buffer
  const planar = (from, n) => {
    const o = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const k = ((from + i) % N + N) % N;
      o[i] = chs[0][k]; o[n + i] = chs[1][k];
    }
    return o;
  };
  enc.encode(new AudioData({ format: "f32-planar", sampleRate: SR2, numberOfFrames: WARM,
    numberOfChannels: 2, timestamp: 0, data: planar(N - WARM, WARM) }));
  enc.encode(new AudioData({ format: "f32-planar", sampleRate: SR2, numberOfFrames: N,
    numberOfChannels: 2, timestamp: Math.round(WARM / SR2 * 1e6), data: planar(0, N) }));
  await enc.flush();
  try { enc.close(); } catch (e) {}
  if (failed) throw new Error("encoder: " + failed);
  // frame 0 is the warm tail; every frame after it starts at loop sample 0
  const { frames, sum } = loopFrames(out.slice(1), N);
  // WHOLE FRAMES OR NOTHING. seamResample sized the loop to a frame multiple
  // precisely so this never has to shorten one — if it did, we would be back to
  // the padding chromium plays instead of trimming, so refuse the tier instead.
  if (sum !== N || frames.length !== Math.round(N / F))
    throw new Error("frames " + frames.length + "x sum " + sum + " != loop " + N);
  return { frames, loopN: N, rate: SR2, desc };
}
function seamOff(why) {
  seam.epoch++;
  if (!seam.on && !seam.building) { seam.why = why; return; }
  seam.on = false; seam.building = false; seam.frames = null;
  seam.ledger = []; seam.appendedSec = 0; seam.sb = null; seam.mux = null;
  try { if (seam.ms && seam.ms.readyState === "open") seam.ms.endOfStream(); } catch (e) {}
  seam.ms = null;
  if (seam.msUrl) { try { URL.revokeObjectURL(seam.msUrl); } catch (e) {} seam.msUrl = null; }
  seam.why = why; st.seam = "loop-wav"; st.seamWhy = why;
  if (why) console.warn("[nukernel] seamless tape unavailable:", why);
  // back to what shipped: the blob, on loop, with the element's own wrap hole.
  // Only while the transport RUNS — a failure after stop() must not restart the
  // element the transport:state(false) handler just paused (adopt's own law).
  if (el && st.url && playing) { try { el.srcObject = null; } catch (e) {} attachCurrent(); }
}
// BUILD: called from adopt() for every tape, short stage and full alike. The
// first one attaches the MediaSource; later ones just replace the frames the
// pump appends, so a re-render reaches the ear at the next wrap — and reaches
// it sample-continuously, which the src swap never could.
async function seamBuild(fold, durSec, myGen) {
  if (!el || disarmed || noSeam || seam.building) return;
  if (seam.why && !seam.on) return;                // a tier we already gave up on
  if (!(fold && fold.N > 0)) return;
  seam.building = true;
  const epoch = seam.epoch;
  try {
    const pick = await seamPickCodec();
    if (!pick) { seam.building = false; seamOff("no aac/opus encoder"); return; }
    const { frames, loopN, rate, desc } = await seamEncode(fold, pick);
    // a newer tape, or a new song, won the race while we encoded
    if (myGen !== gen || epoch !== seam.epoch) { seam.building = false; return; }
    seam.frames = frames; seam.loopN = loopN; seam.loopSec = loopN / rate;
    seam.sr = rate; seam.codec = pick.name; seam.mime = pick.mime;
    if (!seam.on) await seamAttach(pick, desc, epoch);
    else { st.seam = seam.tier; say("carrier: new take ready — it joins at the loop"); }
    seamPump();
  } catch (e) {
    seamOff((e && e.message) || String(e));
  } finally { seam.building = false; }
}
async function seamAttach(pick, desc, epoch) {
  const Fmp4 = await import("../../engine/faust/codec/fmp4.js")
    .then(() => window.FaustFmp4).catch(() => null);
  if (!Fmp4 || !Fmp4.makeFmp4Mux) throw new Error("fmp4 muxer did not load");
  seam.mux = Fmp4.makeFmp4Mux({ codec: pick.name === "aac" ? "aac" : "opus",
                                sampleRate: pick.rate, channels: 2, codecConfig: desc });
  const ms = new MSctor();
  seam.ms = ms;
  const isMMS = !!(MMS && ms instanceof MMS);
  seam.tier = (isMMS ? "mms-" : "mse-") + pick.name;
  // the parent's hard-won order (WAV-FIRST v3.1): remote playback is already
  // disabled on this element from armCarrier, and MMS wants srcObject — the
  // object URL works, but only srcObject drives start/endstreaming.
  let attached = false;
  if (isMMS) { try { el.srcObject = ms; attached = true; } catch (e) {} }
  if (!attached) { seam.msUrl = URL.createObjectURL(ms); el.src = seam.msUrl; }
  el.loop = false;                                 // a stream does not loop; it continues
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("sourceopen never fired")), 4000);
    ms.addEventListener("sourceopen", () => { clearTimeout(t); res(); }, { once: true });
  });
  const sb = ms.addSourceBuffer(pick.mime);
  sb.mode = "segments";                            // tfdt is explicit; nothing is inferred
  seam.sb = sb;
  sb.addEventListener("updateend", seamPump);
  sb.addEventListener("error", () => seamOff("sourcebuffer error"));
  if (isMMS) {
    try { ms.addEventListener("startstreaming", () => { seam.wants = true; seamPump(); }); } catch (e) {}
    try { ms.addEventListener("endstreaming", () => { seam.wants = false; }); } catch (e) {}
    try { seam.wants = ms.streaming !== false; } catch (e) {}
  }
  await new Promise((res, rej) => {
    sb.addEventListener("updateend", res, { once: true });
    sb.addEventListener("error", () => rej(new Error("init segment rejected")), { once: true });
    sb.appendBuffer(seam.mux.initSegment());
  });
  if (epoch !== seam.epoch) throw new Error("torn down mid-attach");
  seam.on = true; st.seam = seam.tier; st.seamWhy = null;
  seamPlay();
}
function seamPlay() {
  if (!el) return;
  el.muted = false; el.volume = carrying ? clampVol(masterVol()) : 0;
  const p = el.play(); if (p && p.catch) p.catch(() => {});
}
// ONE COPY PER CALL — a SourceBuffer takes one operation at a time, and
// updateend calls us back. Evict behind first (memory), then top up ahead.
function seamPump() {
  if (!seam.on || !seam.sb || !seam.frames || !el) return;
  if (seam.sb.updating || !seam.ms || seam.ms.readyState !== "open") return;
  if (!seam.wants) return;                         // MMS said stop
  const t = el.currentTime || 0;
  try {
    const b = seam.sb.buffered;
    if (b.length && t - b.start(0) > SEAM_BEHIND + 10) {
      seam.sb.remove(b.start(0), t - SEAM_BEHIND);
      // the ledger follows the buffer: a copy nobody can seek into is not a copy
      while (seam.ledger.length > 1 && seam.ledger[0].t0 + seam.ledger[0].dur < t - SEAM_BEHIND)
        seam.ledger.shift();
      return;
    }
    if (seam.appendedSec - t >= SEAM_AHEAD()) return;
    const frag = seam.mux.pushChunks(seam.frames);
    seam.ledger.push({ t0: seam.appendedSec, dur: seam.loopSec });
    seam.appendedSec += seam.loopSec;
    seam.pushes++;
    seam.sb.appendBuffer(frag);
  } catch (e) {
    seamOff("append: " + ((e && e.message) || e));
  }
}
// WHERE IN THE SONG the stream is. The element's currentTime only grows — it is
// stream time, not a phase — so every reader that used to mean "how far into the
// loop" goes through here, and reads the same number it always did.
function seamPhase() {
  if (!seam.on || !el) return el ? (el.currentTime || 0) : 0;
  const t = el.currentTime || 0;
  for (let i = seam.ledger.length - 1; i >= 0; i--) {
    const c = seam.ledger[i];
    if (t >= c.t0) return Math.max(0, Math.min(c.dur, t - c.t0));
  }
  return 0;
}
// …and the inverse, for the two seeks this file makes: the phase-lock while the
// graph is audible, and the lock-screen scrub. Land inside the copy that is
// playing; if that point is already behind us, take the next copy's.
function seamSeekPhase(ph) {
  if (!seam.on || !el) return false;
  const t = el.currentTime || 0;
  let cur = null;
  for (let i = seam.ledger.length - 1; i >= 0; i--) if (t >= seam.ledger[i].t0) { cur = seam.ledger[i]; break; }
  if (!cur) return false;
  let target = cur.t0 + Math.max(0, Math.min(cur.dur, ph));
  if (target < t - 0.05 && cur.t0 + cur.dur + ph < seam.appendedSec) target += cur.dur;
  try { el.currentTime = target; } catch (e) { return false; }
  return true;
}
const elPhase = () => (el ? (seam.on ? seamPhase() : (el.currentTime || 0)) : null);

/* ---------- the boundary swap (carrier-first) ---------- */
// A new tape while the ear is on the old one. Cutting now is a click in the
// middle of a bar; cutting at the wrap is a downbeat, which is the one seam
// this file is allowed (the fold in foldLoop already made the wrap
// continuous). loop=false hands us `ended` — which fires while the page is
// hidden, the property that made it WAV-FIRST's background swap primitive.
function armSwap() {
  // WHEREVER THE TAPE IS THE PATH, which is now the desk as well: a new take
  // that lands while the element is audible waits for the wrap. The old
  // wording said "carrier-first only, and on a desk a carrying element means
  // the tab is hidden" — a desk that has simply gone quiet is carrying too, and
  // a tape it never swapped is a tape one edit out of date until someone
  // touches the machine again.
  if (!el || !carrying || !st.url || !carrierFirst()) return;
  // SEAM MODE HAS NO SWAP. The new take is already the frame list the pump
  // appends, so it joins the stream at the wrap sample-continuously — turning
  // `loop` off here would end a stream that is not supposed to end.
  if (seam.on) { st.pending = false; return; }
  if (el.src === st.url) { st.pending = false; return; }
  st.pending = true;
  el.loop = false;
  say("carrier: new take ready — swapping at the loop");
}
function swapNow() {
  if (!el || !st.url) return;
  attachCurrent();                                 // src + loop=true + volume
  // the TRANSPORT follows the tape, not the other way round: the element
  // restarts the song at 0 and the muted graph (and therefore the playhead,
  // the LCD and MediaSession's position) has to agree with what is audible.
  if (carrying && playing) { try { seekPhase(0); } catch (e) {} }
  say("carrier: playing your edit");
}

/* ---------- becoming the audible path ---------- */
// MUTE FIRST, THEN RAISE, THEN VERIFY. Mute-then-raise means the two sources
// are never both up (a phase-shifted copy of the same song is the parent's
// elAudible failure class). Verify means the reverse is also refused: a
// play() the browser rejected plus a muted graph is a silent phone, and
// "a dead primary route must never mean silence" is WAV-FIRST v3.1's law.
// THE INSURANCE NEVER TAKES THE EAR. A short tape is the song's first box on
// loop; it is a whole phrase now rather than two bars, but one section repeated
// is still not the record, and handing it the foreground would make it the
// performance. It stays what it was built to be — the thing that is already in
// hand if the page is hidden in the first seconds — and the live graph plays
// until the full render lands, at which point the handoff is to the real song.
const shortIsInsurance = () => st.stage !== "full";
function goCarrier() {
  if (!el || carrying || !playing || st.state !== "ready" || !st.url) return false;
  if (!carrierFirst()) return false;
  if (shortIsInsurance()) return false;
  syncEl();                                        // land on the phase the graph is at
  muteNow();
  el.muted = false;
  el.volume = clampVol(masterVol());
  carrying = true; st.mode = "carrier";
  const t0 = el.currentTime;
  const p = el.play(); if (p && p.catch) p.catch(() => {});
  // 400 ms is a decode plus a start; if the element is still parked after it,
  // the element is not media and the graph gets the song back
  setTimeout(() => {
    if (!carrying || !playing) return;
    // advanced, or wrapped past the loop end while we waited — both are the
    // element playing. Only a parked one is a refusal.
    const adv = el.currentTime > t0 + 0.02 || el.currentTime < t0;
    if (el.paused || !adv) demote("element-refused");
    // PROVEN PLAYING, AND ONLY THEN, the room goes dark. Parking behind an
    // element that turned out not to be media would be silence with the lights
    // off, which is the one failure this file refuses everywhere else; so the
    // park hangs off the same verification the demote does. Nothing is torn
    // down — a parked graph is simply not pulled — so the way back is a
    // reconnect rather than a rebuild (audio/graph.js parkGraph).
    else parkGraph();
  }, 400);
  return true;
}
function demote(why) {
  st.demoted = why; st.mode = "graph";
  carrying = false; st.pending = false;
  deskCarrier = false;
  unparkGraph();                                   // the graph is the sound again
  // PAUSE, don't just zero the volume: iOS ignores HTMLMediaElement.volume
  // entirely (volume is a hardware control there), so a volume-0 element on
  // the very platform this mode is for is an element still playing at full
  // level — the graph would come back up UNDER it. The pocket-copy path
  // upstairs can afford volume because it only ever drops to 0 on a desk.
  // (a MediaSource-backed element is a stream, not a loop; `loop` there would
  // replay the buffered range rather than the song, so it stays off)
  if (el) { el.volume = 0; if (!seam.on) el.loop = true; try { el.pause(); } catch (e) {} }
  unmuteRamp(20);
  console.warn("[nukernel] carrier demoted to the live graph:", why);
  say("carrier unavailable (" + why + ") — playing the live graph");
}

/* ---------- phase lock ---------- */
function phase() {
  const p = getPosition();
  if (!(st.durSec > 0)) return 0;
  return (((p.now - p.loopStart) % st.durSec) + st.durSec) % st.durSec;
}
function syncEl() {
  if (!el || !st.url) return;
  try {
    const ph = phase();
    // in seam mode currentTime is stream time, so the phase has to be mapped
    // onto the copy that is playing — and the comparison is against the PHASE,
    // not the clock, or the lock re-seeks on every pass
    if (seam.on) { if (Math.abs(seamPhase() - ph) > 0.03) seamSeekPhase(ph); return; }
    if (Math.abs((el.currentTime || 0) - ph) > 0.03) el.currentTime = ph;
  } catch (e) {}
}
// kept in phase at 1 Hz while the graph is the audible source, so the hide
// handoff is a volume swap with NO seek in the throttled window. While the
// element IS the source it is never seeked — the ear is on it — so this
// becomes its watchdog instead: an element that stops or freezes under a
// muted graph is silence, and it must hand the song back rather than die
// quietly. (The `ended` swap is a legal stop; st.pending marks it.)
let lastElT = -1;
setInterval(() => {
  // …and the idle clock is read on the same beat. It is the ONLY thing that has
  // to run while the tape carries and the room is parked, which is the point:
  // one 1 Hz timer is what a radio costs.
  settle();
  if (!el || !playing || st.state !== "ready") return;
  // THE PUMP'S HEARTBEAT. updateend re-enters seamPump while there is work; once
  // the stream is far enough ahead nothing calls back, so the tick is what keeps
  // it topped up. Background timers throttle but do not stop while a media
  // element plays — which is the whole reason the parent could stream at all.
  seamPump();
  // NOT CARRYING MEANS NOT PARKED, held as an invariant rather than as a
  // sequence of correct calls: every route out of carrying (a demote, a stop, a
  // handback, a song swap) would otherwise have to remember, and the one that
  // forgot would be a page with no sound and no error.
  if (!carrying) { unparkGraph(); syncEl(); lastElT = -1; return; }
  if (!carrierFirst()) return;                     // the desk's hidden handoff: as it was
  // the belt to goCarrier's braces: a carrier that took over by some other door
  // (survival's carry() on a hide that beat the idle clock) parks here instead,
  // once the element has been seen to advance under it.
  if (lastElT >= 0 && (el.currentTime || 0) !== lastElT && !el.paused) parkGraph();
  if (st.pending && (el.paused || el.ended)) { swapNow(); lastElT = -1; return; }
  const t = el.currentTime || 0;
  if (el.paused || (lastElT >= 0 && t === lastElT && !el.seeking)) {
    // A FROZEN STREAM IS THE STREAM'S FAULT BEFORE IT IS THE ELEMENT'S. Fall
    // back to the shipped WAV loop first — it costs a wrap hole, not the song —
    // and only hand the ear back to the live graph if that stalls too.
    if (seam.on) { seamOff("stream stalled"); lastElT = -1; return; }
    demote("element-stalled");
  }
  lastElT = t;
}, 1000);

/* ---------- the handoff (called by survival.js) ---------- */
export function carry() {
  if (!el || !playing || st.state !== "ready" || !st.url) return false;
  // THE SHORT TAPE ONLY PLAYS WHERE THE ALTERNATIVE IS SILENCE. goCarrier
  // already refuses it (shortIsInsurance, above) and this is the same law on
  // the other door: hiding the tab used to hand the ear whatever blob existed,
  // and for the first stretch of any song that blob is the SHORT stage.
  //
  // WHAT THAT STAGE IS HAS CHANGED, and it changed because this door is the one
  // that stayed open. It used to be a 4 s bar-aligned cut — measured on the
  // shipped composer, ONE bar of Lagos 1971, 2.17 s, with only the bass in it,
  // and two bars of the Liverpool 1962 intro. That is Paul's report exactly
  // ("one phrase repeats over and over, no drums"), and the crash looping under
  // it was the same fragment wrapping every 3.93 s, which is why it sounded
  // like a different tempo from the band. It is now a WHOLE BOX (SHORT_SEC,
  // shortCut): Liverpool 1962 seed 7 is 7.75 s of the four-bar opening with
  // kick, snare and hat in it; Lagos 1971 seed 7 is 8.69 s with kick and two
  // toms; New York 1945 seed 5 is 6.82 s; Chicago 1952 seed 7 is 13.90 s of the
  // twelve-bar form with the whole Chess kit. A phrase, in other words, which
  // is what the ear behind a frozen context was owed.
  //
  // It is STILL not the song, so the refusal below stands unchanged: only a
  // context that has genuinely stopped gets it.
  //
  // THE TEST IS WHETHER THERE IS ANYTHING TO REPLACE. On iOS the ctx really
  // does freeze on hide, and a suspended context anywhere is the same fact — a
  // fragment beats silence, and that is what the short stage was built for.
  // But a RUNNING graph on a platform that keeps running hidden (desktop and
  // Android, by design: the worker clock and the 2 s lookahead exist for
  // exactly this) is the whole song already playing, and swapping two bars of
  // its head over the top of it is a strictly worse pocket.
  if (shortIsInsurance() && !isIOS && ctx && ctx.state === "running") return false;
  // IDEMPOTENT: goHidden is reachable twice while carrying (ctx statechange
  // fires before the late visibilitychange on an iOS app switch, and
  // pagehide doubles visibilitychange on backgrounding). A second carry()
  // must not re-run syncEl — phase() reads the ctx clock, FROZEN since the
  // first handoff, so the seek rewinds the audibly-playing element.
  if (carrying) return true;
  syncEl();                                        // one last correction while the clock still runs
  el.muted = false;
  el.volume = clampVol(masterVol());
  const p = el.play(); if (p && p.catch) p.catch(() => {});
  carrying = true; st.mode = "carrier";
  return true;
}
export function uncarry() {
  if (!carrying) return null;
  carrying = false; st.mode = "graph";
  deskCarrier = false;
  if (handing) { clearTimeout(handing); handing = null; }   // this IS the handback
  unparkGraph();                                   // whatever is about to be unmuted must exist
  const ph = el ? (el.currentTime || 0) : null;
  if (el) {
    el.volume = 0;
    // a render that landed while we were carrying waits here — swap now
    if (st.url && el.src !== st.url) attachCurrent();
  }
  return ph;
}
export const isCarrying = () => carrying;
// what the element is actually at, for the two callers that must agree with
// the ear rather than with the (possibly frozen) audio clock: survival.js
// resyncs the transport to this on return, and MediaSession reports it
export const carrierPos = () =>
  (carrying && el ? { pos: elPhase(), dur: st.durSec } : null);
// a lock-screen scrub lands on BOTH: the tape is what is audible, the
// transport is what the page believes. Bounded to the loop.
export function carrierSeek(sec) {
  if (!carrying || !el || !(st.durSec > 0)) return false;
  const p = ((sec % st.durSec) + st.durSec) % st.durSec;
  if (seam.on) { if (!seamSeekPhase(p)) return false; }
  else { try { el.currentTime = p; } catch (e) { return false; } }
  try { seekPhase(p); } catch (e) {}
  return true;
}

/* ---------- subscriptions ---------- */
on("transport:state", d => {
  if (d.playing) {
    // keep the (possibly stale-phased) carrier rolling and re-lock it
    if (el && st.url) attachCurrent();
    // PLAY WITH A TAPE ALREADY IN HAND (a second play, a lock-screen play):
    // the element is the path from this instant, with no hide involved. A
    // first play has nothing rendered yet and takes it in adopt() instead.
    if (carrierFirst() && st.state === "ready") goCarrier();
    // TWO-STAGE, kicked from the transport itself (startAt emits this event
    // synchronously): the short stage exists within seconds of play, the
    // full song follows behind it. The offline render runs off the main
    // thread, and startAt already loaded every synth this render wants, so
    // it no longer needs the old 3-bar precache deferral.
    maybeRender("short");
  } else {
    clearTimeout(timer);
    if (carrying) uncarry();
    deskCarrier = false;
    unparkGraph();                                 // stopped is not parked
    if (el) { try { el.pause(); } catch (e) {} }   // a muted loop still costs battery
  }
});
// THE VOLUME SLIDER MOVES THE AUDIBLE THING. While the element carries, the
// graph's outGain is the mute and the element's volume is the fader — without
// this the phone's slider is a control over silence. (sig() ignores volume, so
// the schedule() below re-renders nothing for it.)
on("transport", () => { if (carrying && el) el.volume = clampVol(masterVol()); });
// a musical edit makes the rendered blob stale; re-render after the dust
// settles. "transport" includes volume moves, but sig() ignores them, so
// maybeRender no-ops those.
const changed = () => { if (playing) schedule(); };
on("box", changed);
on("phrase", changed);
on("transport", changed);
on("master", changed);                             // baked into the bytes, so re-bake
on("buses", changed);                              // the rack trims are too
on("groove", changed);                             // ...and the song's groove
on("swing", changed);                              // ...and its swing, same law
on("pool", changed);                               // ...and the band it hired
on("song", () => {
  // a whole new song: whatever is rendered is the WRONG music — invalidate
  // rather than carry a ghost (the "song" event also stops the transport)
  gen++;                                           // cancels any in-flight render
  adoptedSig = null;
  st.state = "idle"; st.url = null; st.durSec = 0; st.stage = null; st.lastError = null;
  st.pending = false; st.mode = "graph";
  // …and with the tape gone the room has to come back, whatever it was doing
  carrying = false; deskCarrier = false;
  if (handing) { clearTimeout(handing); handing = null; }
  unparkGraph();
  while (urls.length) { try { URL.revokeObjectURL(urls.shift()); } catch (e) {} }
  // the stream carried the OLD song; drop it whole rather than let the pump
  // keep appending it, and let seamOff's re-attach find no url and do nothing
  seamOff(null);
  if (el) { try { el.pause(); el.srcObject = null; el.removeAttribute("src"); } catch (e) {} }
});
