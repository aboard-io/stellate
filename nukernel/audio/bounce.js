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
// the song's first bars, bar-aligned — renders immediately, so something loops
// within seconds of play; the full song renders behind it and swaps in at a
// safe moment (never under a carrying element). Before this, the one render
// waited ~3 bars plus a debounce and then took multiples of realtime on a
// composed song — any switch-away in the first half minute found no carrier.
// __nuBounce.stage says which is serving.
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
import { GENRES, BASSSYNTH, DTIMES } from "../ui/deps.js";
import { SONG, SLOTS, loopOnly, bpm, MASTER, BUSES, GROOVE, SWING, POOL,
         on, emit } from "../ui/state.js";
import { stackOf, kitOf, boxBars } from "../ui/derive.js";
import { buildMasterChain, buildEchoBus, buildRoomBus, buildKitDesk, buildSendBus, makeVerb,
         masterVol, muteNow, unmuteRamp, DRYROOM } from "./graph.js";
import { FONT, isSynthFont, fontDef } from "./assets.js";
import { makeSynthNode, driveSynth, offFallback } from "./voices.js";
import { chanSpec, buildChannel, armAutomation, focusKit } from "./mixer.js";
import { buildTimeline, scheduleBar, stepDur, playing, getPosition,
         onGesture, seekPhase, setQuietWhen, singWork } from "./transport.js";
import { warm as warmSing } from "./sing.js";

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
             // WHERE THE TIME WENT, per phase, in ms — because "the render is
             // slow" is not a finding, it is a feeling. A composed song failed
             // to render inside 300 s on the reference box and nobody could say
             // which of the five phases owned the seconds. Measured here so the
             // gate and the readout argue with numbers.
             phases: null, phase: null, wantSec: 0, wantBars: 0, chunks: 0, chunkMs: 0, each: null, hits: 0, misses: 0,
             ratio: 0, nodes: 0, pooled: 0 };
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
  elVolume: el ? el.volume : null, elTime: el ? el.currentTime : null,
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
  hits: st.hits, misses: st.misses,
  nodes: st.nodes, pooled: st.pooled,
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
             // the singer's own census of this render — an ADDED key, so every
             // existing reader is untouched (nukernel-bounce (D) reads it)
             sing: (typeof window.__nuSing === "function" ? window.__nuSing() : null),
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
// THE CARRIER IS THE PATH: mobile, an element that exists, and no demotion on
// record. ?nobounce (below) disarms the element entirely, which is also the
// honest answer here — a page with no carrier must never mute its graph.
export const carrierFirst = () => isMobile && armed && !disarmed && !st.demoted;
// the transport asks this every tick: while the element carries, the muted
// graph's scheduling is work nobody can hear, on the one device where it
// competes with the render that IS the sound
setQuietWhen(() => carrying && carrierFirst());

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
// Two bars at the default tempo, which is NOT "big enough to loop as music"
// however the first draft of this comment wished it were: Paul heard it
// immediately — "every two Beatles measures has a complete and sudden pause at
// the end" — because a 4 s tape of the song's HEAD, looping, is exactly that.
// The short stage was designed when the carrier only played while hidden, and
// a fragment beats silence in a pocket. Once the carrier became the audible
// path (carrierFirst), a fragment became the music, and it is not the music.
//
// So the short tape survives ONLY as the hidden-state insurance it always was:
// goCarrier refuses it, and the graph keeps the ear until the FULL song is
// rendered. See shortIsInsurance below.
const SHORT_SEC = 4;
// WHEN THE CARRIER IS THE PATH, THE DEBOUNCE IS THE LATENCY OF THE INSTRUMENT.
// 4 s of quiet is right for insurance nobody is listening to; it is absurd for
// the thing making the sound. Long enough to coalesce a scrub (a fader drag
// emits per pointer move), and not one beat longer.
const DEBOUNCE = () => (carrierFirst() ? 500 : 4000);
// the readout is where "your edit is on its way" belongs — the alternative is
// a phone that ignores you for two seconds with no explanation. Carrier-first
// only: on a desk the carrier is invisible insurance and should stay silent.
const say = text => { if (carrierFirst()) emit("status", { text, sticky: true }); };
// …and the same fact DURABLY, because a status line is wiped by the next
// render and "is my edit coming?" outlives one frame. ui/readout.js appends
// this to the box description; null means there is nothing to say (a desk).
export function carrierNote() {
  if (!carrierFirst()) return st.demoted ? "carrier off (" + st.demoted + ") — live graph" : null;
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
// The one seam that stays additive is the LOOP WRAP, which foldAndEncode
// already owns and which is a downbeat by construction.
//
// The pre-roll is one BAR rather than N seconds so the walk stays bar-indexed:
// no fractional bar arithmetic, and a pre-roll bar that opens a box arms that
// box exactly as the live tick does. A window that opens mid-box arms it
// through armAutomation's `fromSec` (audio/mixer.js) — one walk, offset, never
// a second copy of it.
const SR = 44100, LEAD = 0.05, TAIL = 1.5;
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
// how many windows render at once. Chromium gives each OfflineAudioContext its
// own render thread; one core is left for the page, which is still running the
// LIVE graph while this happens — a bounce that starves the audible path has
// made the wrong trade.
const PARALLEL = (() => {
  const q = /[?&]renderpar=(\d+)/.exec(typeof location !== "undefined" ? location.search : "");
  if (q) return Math.max(1, +q[1]);
  return Math.max(1, Math.min(4,
    ((typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 4) - 1));
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
  // the rack trims into every window, so a knob move must miss the cache
  return JSON.stringify([sd, FONT, MASTER, BUSES,
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

// ONE WINDOW. Everything the old whole-song render did, over a slice of the
// timeline — the same builders, the same walk, the same law that the carrier is
// the same TOPOLOGY as the live mix and not merely the same numbers.
async function renderChunk(TL, plan, ck, sd, tally) {
  const preSec = plan.t0[ck.a] - plan.t0[ck.pre];
  const outSec = plan.t0[ck.b] - plan.t0[ck.a];
  const tailSec = ck.b === TL.length ? TAIL : 0;
  const octx = new OfflineAudioContext(2,
    Math.ceil((LEAD + preSec + outSec + tailSec) * SR), SR);
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

  // ---- the offline Faust pool ----
  // Worklets on an OfflineAudioContext are a per-browser fact, not a given
  // (addModule from a blob URL is a CSP question in production). ATTEMPT the
  // real voices; on any failure degrade to sampled-only — the synth genres
  // play their sampled instrument instead — and COUNT it. Never silently.
  //
  // PER WINDOW, and that is cheap where it counts: voices.js makeSynthNode
  // caches the compiled DSP FACTORY in a module-level map keyed on the dsp
  // name, so only createNode is paid again — the wasm is compiled once for the
  // session however many windows ask for it. Only the specs this window's own
  // bars can play are built, so a window of drums pays for no synths at all.
  const pool = new Map();                          // "dsp#v" -> node
  const routes = new Map();                        // node -> Map(chanKey -> gain)
  const sis = new Set();
  for (let i = ck.pre; i < ck.b; i++) sis.add(TL[i].si);
  const mine = [...sis].map(i => SONG[i]).filter(Boolean);
  const specs = [...new Set([
    ...(isSynthFont() ? [fontDef().synth] : []),
    ...mine.flatMap(x => stackOf(x).filter(e => GENRES[e.g] && GENRES[e.g].synth).map(e => GENRES[e.g].synth)),
    ...mine.filter(x => BASSSYNTH[x.bassop]).map(x => BASSSYNTH[x.bassop])])];
  if (specs.length) {
    const depth = Math.min(8, Math.max(1, ...mine.map(sec =>
      stackOf(sec).reduce((n, e) => n + (GENRES[e.g] ? GENRES[e.g].voices : 0), 0))));
    try {
      for (const sp of specs)
        for (let v = 0; v < depth; v++)
          pool.set(sp.dsp + "#" + v, await makeSynthNode(octx, sp));
    } catch (e) {
      pool.clear();
      tally.sampledOnly = true;
    }
  }
  // KEYED, like the live routeSynth, because the key is what says which PART
  // strip this voice belongs on (mixer.synthIn) — a bounce that routed every
  // synth straight at chan.input would render the per-part desk away, and the
  // carrier would be a different mix from the one the ear just left
  const routeTo = (key, node, chan) => {
    let m = routes.get(node);
    if (!m) routes.set(node, m = new Map());
    let g = m.get(chan.key);
    if (!g) {
      g = octx.createGain(); g.gain.setValueAtTime(0, 0);
      node.connect(g);
      g.connect(chan.synthIn ? chan.synthIn(key) : chan.input);
      m.set(chan.key, g);
    }
    return g;
  };
  // the offline focusSynths: at each section start, exactly one route is open
  const focusAt = (chan, when) => {
    for (const [key, node] of pool) {
      routeTo(key, node, chan);
      for (const [k, g] of routes.get(node))
        try { g.gain.setValueAtTime(k === chan.key ? 1 : 0, when); } catch (e) {}
    }
  };
  const offSynth = (sp, midi, when, durSec2, acc, sld, vel, v, chan, vox) => {
    const key = sp.dsp + "#" + (v || 0);
    const node = pool.get(key);
    if (!node) return false;                       // degrades to the sampled voice
    routeTo(key, node, chan);
    // a note no octave of which fits the voice's freq param is dropped here
    // too (the live path's law) — returning TRUE keeps it dropped rather than
    // handing it to the sampled voice, which would make the carrier a
    // different arrangement from the one the graph plays
    driveSynth(node, sp, midi, when, durSec2, acc, sld, vel, vox);
    return true;
  };

  // ---- the walk: the live tick's bar loop against offline time ----
  let t = LEAD, cur = null;
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
      armAutomation(cur.chan, t, bar.barSteps * sd * boxBars(sec), sd * 4,
                    bar.first ? 0 : plan.from[i]);
      focusAt(cur.chan, t);
      focusKit(cur.chan, t);        // one kit desk for the render, one section at a time
    }
    scheduleBar(bar, sec, cur.chan, cur.kit, t, sd, offSynth);
    t += TL[i].barSteps * sd;
  }
  tally.nodes += chans.size; tally.pooled += pool.size;
  const t0 = performance.now();
  const buf = await octx.startRendering();
  // SUMMED, so the report can divide it by the wall clock and say what the
  // concurrency actually bought — a number that is 1.0 is a wave that queued
  const ms = performance.now() - t0;
  tally.chunkMs += ms;
  // PER WINDOW, because the sum hides the shape: a song whose choruses cost
  // four times its verses is a density problem, and a flat profile is a fixed
  // per-window overhead problem. They want different fixes.
  tally.each.push([Math.round(ms), +(preSec + outSec + tailSec).toFixed(2), chans.size]);
  // LIFTED OUT OF THE AudioBuffer HERE, not at assembly, because the cache has
  // to hold the window's OUTPUT and not its pre-roll — and because holding an
  // AudioBuffer holds the context that made it.
  const skip = Math.round((LEAD + preSec) * SR);
  const n = Math.max(0, buf.length - skip);
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
    // the SHORT stage: the head of the song, cut on a bar line at or under
    // the cap (at least one bar — the loop wrap must stay a downbeat for the
    // fold). Its loop is the song's OPENING, not the user's current position:
    // a few bars of the right music beats half a minute of silence, and the
    // full render replaces it before most listens get around twice.
    const cut = []; let acc = 0;
    for (const b of TL) {
      if (cut.length && acc + b.barSteps * sd > capSec) break;
      cut.push(b); acc += b.barSteps * sd;
    }
    TL = cut;
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
  ph.mark("render");
  st.sampledOnly = false;
  offFallback.n = 0;
  const tally = { nodes: 0, pooled: 0, chunkMs: 0, each: [], sampledOnly: false };
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
  // foldAndEncode wraps the ring-out onto the head, so it is handed a buffer
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
function foldAndEncode(res) {
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
  // 16-bit stereo WAV — the blob is same-origin bytes, decodable by the gate
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
  return new Blob([ab], { type: "audio/wav" });
}
function adopt(res, want, myGen, stage) {
  // the fold+WAV encode is the sixth phase and it is NOT inside renderSong —
  // it runs here, on the main thread, over every sample of the tape. Timed in
  // the same units as the other five so the report adds up to lastRenderMs.
  const encT = performance.now();
  const url = URL.createObjectURL(foldAndEncode(res));
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
}
function attachCurrent() {
  if (!el || !st.url) return;
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

/* ---------- the boundary swap (carrier-first) ---------- */
// A new tape while the ear is on the old one. Cutting now is a click in the
// middle of a bar; cutting at the wrap is a downbeat, which is the one seam
// this file is allowed (the fold in foldAndEncode already made the wrap
// continuous). loop=false hands us `ended` — which fires while the page is
// hidden, the property that made it WAV-FIRST's background swap primitive.
function armSwap() {
  // CARRIER-FIRST ONLY. On a desk a carrying element means the tab is hidden
  // and the graph is muted behind it; that path already has its swap (uncarry
  // attaches the newest blob when the graph takes back over), and touching
  // `loop` there would rewrite the one behaviour this change is not allowed to
  // touch.
  if (!el || !carrying || !st.url || !carrierFirst()) return;
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
// THE FRAGMENT NEVER TAKES THE EAR. A short tape is the song's first few bars
// on loop; handing it the foreground turns a two-bar head into the whole
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
  }, 400);
  return true;
}
function demote(why) {
  st.demoted = why; st.mode = "graph";
  carrying = false; st.pending = false;
  // PAUSE, don't just zero the volume: iOS ignores HTMLMediaElement.volume
  // entirely (volume is a hardware control there), so a volume-0 element on
  // the very platform this mode is for is an element still playing at full
  // level — the graph would come back up UNDER it. The pocket-copy path
  // upstairs can afford volume because it only ever drops to 0 on a desk.
  if (el) { el.volume = 0; el.loop = true; try { el.pause(); } catch (e) {} }
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
  if (!el || !playing || st.state !== "ready") return;
  if (!carrying) { syncEl(); lastElT = -1; return; }
  if (!carrierFirst()) return;                     // the desk's hidden handoff: as it was
  if (st.pending && (el.paused || el.ended)) { swapNow(); lastElT = -1; return; }
  const t = el.currentTime || 0;
  if (el.paused || (lastElT >= 0 && t === lastElT && !el.seeking)) demote("element-stalled");
  lastElT = t;
}, 1000);

/* ---------- the handoff (called by survival.js) ---------- */
export function carry() {
  if (!el || !playing || st.state !== "ready" || !st.url) return false;
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
  (carrying && el ? { pos: el.currentTime || 0, dur: st.durSec } : null);
// a lock-screen scrub lands on BOTH: the tape is what is audible, the
// transport is what the page believes. Bounded to the loop.
export function carrierSeek(sec) {
  if (!carrying || !el || !(st.durSec > 0)) return false;
  const p = ((sec % st.durSec) + st.durSec) % st.durSec;
  try { el.currentTime = p; } catch (e) { return false; }
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
  while (urls.length) { try { URL.revokeObjectURL(urls.shift()); } catch (e) {} }
  if (el) { try { el.pause(); el.removeAttribute("src"); } catch (e) {} }
});
