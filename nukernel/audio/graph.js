// audio/graph.js — the AudioContext and the shared busses: the master chain,
// the three lazy reverbs, the ping-pong echo. Nothing musical happens here;
// this is the ROOM the music plays in.
//
// Layer graph: deps -> state -> derive -> THIS FILE -> assets -> voices ->
// mixer -> transport -> ui views. Audio may import state (tempo/volume live
// there now — barSec and masterVol used to re-read the DOM on every call, in
// the hot path) but never a ui VIEW module.
//
// THE MIXING IS THE BIG ENGINE'S MIXING — the master chain below is live.js's
// own numbers: glue compressor -> makeup -> brickwall limiter -> a ceiling
// lowpass. The comment there explains why it exists, and it applies word for
// word here: without it the sampled voices are unmastered and play at about
// -22 dBFS, which is the "why is this so quiet and so flat" that started this.
//
// EVERY BUILDER TAKES A CONTEXT. The offline bounce (audio/bounce.js) renders
// the whole song into an OfflineAudioContext, and it must render through THIS
// graph — the same master numbers, the same reverb impulses, the same echo
// topology — or the carrier the phone hears in the background is a different
// mix from the one it heard in the foreground. So the module-global `ctx` is
// the LIVE context only; the construction functions are parameterized, and the
// live init is just one caller of them.
import { bpm, vol, on, emit } from "../ui/state.js";

// exported as live bindings — null until initAudio(), which must ride a user
// gesture because that is the autoplay law
export let ctx = null, masterIn = null, bus = null, outGain = null,
           topLP = null, noise = null;
export let REV = null, delBus = null;
let echo = null;                                   // the live echo bus handle
let anl = null;                                    // the boot instrument's tap

export const masterVol = () => (vol / 100) * 1.1;
export const barSec = () => 4 * 60 / bpm;

// a decaying-noise impulse response — three of them, because "which reverb" is
// a different question from "how much", and a plate is not a small hall.
//
// CACHED AS AudioBuffers, ONCE PER RATE. Two reasons, both measured elsewhere:
// (1) impulse() is ~282k samples of main-thread Math.random for the hall, and
// it used to run at the instant a section started — worklet-instantiation-in-
// the-render-window is ZERO-STATIC's glitch cause R2, and this was our copy of
// it. (2) an AudioBuffer is context-independent, so handing the SAME buffer to
// the live context and the offline bounce makes the two renders structurally
// identical — the one Math.random in the reverb no longer tells them apart.
const irBufs = new Map();                          // "name@rate" -> AudioBuffer
function makeBuffer(chans, len, rate) {
  // constructible without any context (that is the point of the cache); the
  // try/catch covers engines old enough to lack the AudioBuffer constructor
  try { return new AudioBuffer({ numberOfChannels: chans, length: len, sampleRate: rate }); }
  catch (e) { return ctx.createBuffer(chans, len, rate); }
}
function impulse(rate, sec, decay, damp) {
  const len = Math.max(1, Math.floor(rate * sec));
  const b = makeBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const n = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      lp += (n - lp) * damp;                       // damping = the room's absorption
      d[i] = lp;
    }
  }
  return b;
}
export const VERBSPEC = { room:  [1.1, 3.4, 0.42, 220, 1.0],
                          hall:  [3.2, 2.0, 0.30, 180, 0.9],
                          plate: [1.9, 2.4, 0.85, 320, 0.85] };
export function irFor(name, rate) {
  const n = VERBSPEC[name] ? name : "room";
  const key = n + "@" + rate;
  let b = irBufs.get(key);
  if (!b) {
    const [irSec, decay, damp] = VERBSPEC[n];
    irBufs.set(key, b = impulse(rate, irSec, decay, damp));
  }
  return b;
}
export function satCurve(G, mix) {
  const N = 1024, c = new Float32Array(N);
  for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1, s = Math.tanh(x * G) / G; c[i] = x + mix * (s - x); }
  return c;
}

/* ---------- the context-parameterized builders ---------- */
// the master chain, live.js's numbers; `out` is left at unity — the live init
// sets it to the volume slider, the offline bounce renders at full scale and
// lets the carrier element's own volume do the placing
export function buildMasterChain(c) {
  const input = c.createGain();
  const busComp = c.createDynamicsCompressor();
  busComp.threshold.value = -22; busComp.knee.value = 28; busComp.ratio.value = 2.2;
  busComp.attack.value = 0.015; busComp.release.value = 0.25;
  const makeup = c.createGain(); makeup.gain.value = 2.2;
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -1.5; limiter.knee.value = 0; limiter.ratio.value = 20;
  limiter.attack.value = 0.002; limiter.release.value = 0.12;
  const lp = c.createBiquadFilter(); lp.type = "lowpass";
  lp.frequency.value = 16000; lp.Q.value = 0.5;
  const out = c.createGain();
  input.connect(busComp); busComp.connect(makeup); makeup.connect(limiter);
  limiter.connect(lp); lp.connect(out); out.connect(c.destination);
  return { input, lp, out };
}
// one PING-PONG echo bus. Cross-fed delays panned hard, so a section sent
// to the echo throws its repeats across the stereo field instead of thickening
// the middle — which is the whole reason to have a send rather than an insert.
// setTime takes (bars, when) so the offline walk can schedule each section's
// echo time at the bar it starts, exactly as the live tick does at "now".
export function buildEchoBus(c, dest) {
  const input = c.createGain();
  const dA = c.createDelay(2.0), dB = c.createDelay(2.0);
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2800;
  const fbA = c.createGain(), fbB = c.createGain();
  fbA.gain.value = fbB.gain.value = 0.42;
  const panL = c.createStereoPanner(), panR = c.createStereoPanner();
  panL.pan.value = -0.75; panR.pan.value = 0.75;
  input.connect(dA);
  dA.connect(lp); lp.connect(fbA); fbA.connect(dB);
  dB.connect(fbB); fbB.connect(dA);
  dA.connect(panL); dB.connect(panR);
  panL.connect(dest); panR.connect(dest);
  return { input, setTime(bars, when) {
    const t = Math.min(1.9, Math.max(0.02, bars * barSec()));
    // eased, not jumped: a feedback delay whose time moves is a tape machine
    // changing speed, and that is a nicer thing to hear than a click
    try { dA.delayTime.setTargetAtTime(t, when, 0.05);
          dB.delayTime.setTargetAtTime(t, when, 0.05); } catch (e) {}
  } };
}
// one reverb return: input -> highpass -> convolver (cached IR) -> level -> dest
export function makeVerb(c, name, dest) {
  const n = VERBSPEC[name] ? name : "room";
  const [, , , hp, ret] = VERBSPEC[n];
  const inp = c.createGain();
  const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp; f.Q.value = 0.7;
  const cv = c.createConvolver(); cv.buffer = irFor(n, c.sampleRate);
  const g = c.createGain(); g.gain.value = ret;
  inp.connect(f); f.connect(cv); cv.connect(g); g.connect(dest);
  return inp;
}

export function initAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  // PINNED, BOTH KNOBS, the parent's own construction (live.js): 'playback'
  // because this is a step sequencer with a 150 ms lookahead, not a keyboard —
  // 'interactive' asks a loaded phone for the smallest, most underrun-prone
  // buffer it has, for nothing. 44100 keeps every decoded zone and drum 1:1
  // with its file AND is the precondition for the offline bounce: an offline
  // context at a different rate is not rendering the same sound. The fallback
  // covers a UA that rejects the options bag.
  try { ctx = new AC({ sampleRate: 44100, latencyHint: "playback" }); }
  catch (e) { ctx = new AC(); }
  const m = buildMasterChain(ctx);
  masterIn = m.input;                              // where anything unrouted lands
  bus = masterIn;
  topLP = m.lp;
  outGain = m.out; outGain.gain.value = masterVol();
  // the boot instrument's tap sits BEFORE outGain, so "did the graph make a
  // sound" is measured under the survival mute too — the mute is a fact about
  // the speaker, not about the music
  anl = ctx.createAnalyser(); anl.fftSize = 2048;
  topLP.connect(anl);
  // ---- three reverbs, BUILT ON FIRST USE ----
  // A ConvolverNode with a 3.2-second stereo impulse is the most expensive
  // single node on the page, and it costs that whether or not anything is being
  // sent to it. Most songs use one of these; building all three at boot was
  // paying for a hall and a plate to render silence.
  REV = {};
  echo = buildEchoBus(ctx, masterIn);
  delBus = echo.input;
  setDelayTime(0.1875);
  const nl = ctx.sampleRate * .5; noise = makeBuffer(1, nl, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
  // survival.js attaches ctx.onstatechange off this event — the layer graph
  // forbids graph importing anything above itself, so it announces instead
  emit("audio:ctx", {});
  // warm the three impulse responses IN IDLE TIME, so the first box that asks
  // for a hall mid-play finds the buffer already made instead of running the
  // 282k-sample noise walk on the render path (ZERO-STATIC R2's rule: nothing
  // expensive is constructed inside the render window)
  const warm = () => { for (const n of Object.keys(VERBSPEC)) irFor(n, ctx.sampleRate); };
  if (typeof requestIdleCallback === "function") requestIdleCallback(warm, { timeout: 4000 });
  else setTimeout(warm, 1500);
}
export function verbFor(name) {
  const n = VERBSPEC[name] ? name : "room";
  if (REV[n]) return REV[n];
  REV[n] = makeVerb(ctx, n, masterIn);
  return REV[n];
}
export function setDelayTime(bars) {
  if (echo) echo.setTime(bars, ctx.currentTime);
}

/* ---------- the survival mute ---------- */
// Mute AT THE SOURCE, SYNCHRONOUSLY — the hide path cannot ramp, because
// background timers throttle the very frames a ramp would ride (the parent's
// live.js records this: "can't defer"). The return path ramps 20 ms so the
// un-mute does not click. `ducked` is why the volume-slider subscription below
// must not helpfully restore the level while the page is hidden.
let ducked = false;
export const isDucked = () => ducked;
export function muteNow() {
  if (!outGain) return;
  ducked = true;
  try { outGain.gain.cancelScheduledValues(ctx.currentTime); outGain.gain.value = 0; } catch (e) {}
}
export function unmuteRamp(ms) {
  if (!outGain) return;
  ducked = false;
  try {
    const t = ctx.currentTime;
    outGain.gain.cancelScheduledValues(t);
    outGain.gain.setValueAtTime(0, t);
    outGain.gain.linearRampToValueAtTime(masterVol(), t + (ms || 20) / 1000);
  } catch (e) {}
}
// the honest first-sound reading: RMS at the master tap, pre-mute
export function rmsNow() {
  if (!anl) return 0;
  const d = new Float32Array(anl.fftSize);
  anl.getFloatTimeDomainData(d);
  let s = 0; for (const v of d) s += v * v;
  return Math.sqrt(s / d.length);
}

// the volume slider is a view over state; the graph follows it from here —
// unless the survival mute owns the gain right now
on("transport", () => {
  if (outGain && !ducked) outGain.gain.setTargetAtTime(masterVol(), ctx.currentTime, 0.02);
});
