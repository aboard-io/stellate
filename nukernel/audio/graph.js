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
import { bpm, vol, on } from "../ui/state.js";

// exported as live bindings — null until initAudio(), which must ride a user
// gesture because that is the autoplay law
export let ctx = null, masterIn = null, bus = null, outGain = null,
           topLP = null, noise = null;
export let REV = null, delBus = null;
let delA = null, delB = null, delLP = null;

export const masterVol = () => (vol / 100) * 1.1;
export const barSec = () => 4 * 60 / bpm;

// a decaying-noise impulse response — three of them, because "which reverb" is
// a different question from "how much", and a plate is not a small hall
function impulse(sec, decay, damp) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * sec));
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
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
export function satCurve(G, mix) {
  const N = 1024, c = new Float32Array(N);
  for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1, s = Math.tanh(x * G) / G; c[i] = x + mix * (s - x); }
  return c;
}

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterIn = ctx.createGain();
  bus = masterIn;                                  // where anything unrouted lands
  // ---- the master chain, live.js's numbers ----
  const busComp = ctx.createDynamicsCompressor();
  busComp.threshold.value = -22; busComp.knee.value = 28; busComp.ratio.value = 2.2;
  busComp.attack.value = 0.015; busComp.release.value = 0.25;
  const makeup = ctx.createGain(); makeup.gain.value = 2.2;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1.5; limiter.knee.value = 0; limiter.ratio.value = 20;
  limiter.attack.value = 0.002; limiter.release.value = 0.12;
  topLP = ctx.createBiquadFilter(); topLP.type = "lowpass";
  topLP.frequency.value = 16000; topLP.Q.value = 0.5;
  outGain = ctx.createGain(); outGain.gain.value = masterVol();
  masterIn.connect(busComp); busComp.connect(makeup); makeup.connect(limiter);
  limiter.connect(topLP); topLP.connect(outGain); outGain.connect(ctx.destination);
  // ---- three reverbs, BUILT ON FIRST USE ----
  // A ConvolverNode with a 3.2-second stereo impulse is the most expensive
  // single node on the page, and it costs that whether or not anything is being
  // sent to it. Most songs use one of these; building all three at boot was
  // paying for a hall and a plate to render silence.
  REV = {};
  // ---- one PING-PONG echo bus. Cross-fed delays panned hard, so a section sent
  // to the echo throws its repeats across the stereo field instead of thickening
  // the middle — which is the whole reason to have a send rather than an insert.
  delBus = ctx.createGain();
  delA = ctx.createDelay(2.0); delB = ctx.createDelay(2.0);
  delLP = ctx.createBiquadFilter(); delLP.type = "lowpass"; delLP.frequency.value = 2800;
  const fbA = ctx.createGain(), fbB = ctx.createGain();
  fbA.gain.value = fbB.gain.value = 0.42;
  const panL = ctx.createStereoPanner(), panR = ctx.createStereoPanner();
  panL.pan.value = -0.75; panR.pan.value = 0.75;
  delBus.connect(delA);
  delA.connect(delLP); delLP.connect(fbA); fbA.connect(delB);
  delB.connect(fbB); fbB.connect(delA);
  delA.connect(panL); delB.connect(panR);
  panL.connect(masterIn); panR.connect(masterIn);
  setDelayTime(0.1875);
  const nl = ctx.sampleRate * .5; noise = ctx.createBuffer(1, nl, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
}
export const VERBSPEC = { room:  [1.1, 3.4, 0.42, 220, 1.0],
                          hall:  [3.2, 2.0, 0.30, 180, 0.9],
                          plate: [1.9, 2.4, 0.85, 320, 0.85] };
export function verbFor(name) {
  const n = VERBSPEC[name] ? name : "room";
  if (REV[n]) return REV[n];
  const [irSec, decay, damp, hp, ret] = VERBSPEC[n];
  const inp = ctx.createGain();
  const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp; f.Q.value = 0.7;
  const cv = ctx.createConvolver(); cv.buffer = impulse(irSec, decay, damp);
  const g = ctx.createGain(); g.gain.value = ret;
  inp.connect(f); f.connect(cv); cv.connect(g); g.connect(masterIn);
  REV[n] = inp;
  return inp;
}
export function setDelayTime(bars) {
  if (!delA) return;
  const t = Math.min(1.9, Math.max(0.02, bars * barSec()));
  // eased, not jumped: a feedback delay whose time moves is a tape machine
  // changing speed, and that is a nicer thing to hear than a click
  try { delA.delayTime.setTargetAtTime(t, ctx.currentTime, 0.05);
        delB.delayTime.setTargetAtTime(t, ctx.currentTime, 0.05); } catch (e) {}
}

// the volume slider is a view over state; the graph follows it from here
on("transport", () => {
  if (outGain) outGain.gain.setTargetAtTime(masterVol(), ctx.currentTime, 0.02);
});
