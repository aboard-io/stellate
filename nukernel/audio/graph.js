// audio/graph.js — the AudioContext and the shared busses: the master chain,
// the three lazy reverbs, the ping-pong echo, the drum room, the one KIT DESK
// and the AUX SEND RACK (one bus per character effect, for the whole page).
// Nothing musical happens here; this is the ROOM the music plays in.
//
// EVERYTHING SHARED LIVES IN THIS FILE, and that is the point of the
// 2026-08-15 round. A box or a part chooses HOW MUCH of each of these it wants
// — a gain — and never a copy of the effect. audio/mixer.js has the law in
// full; the short version is the big engine's own topology, which nukernel had
// drifted away from one defensible round at a time:
//   engine/faust/press/render-core.js  four shared buses, a gain per unit
//   engine/faust/live/live.js          one found submix, one native reverb
// The builders below are all context-parameterized for the same reason they
// always were: the offline bounce renders through this exact rack.
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
// …AND IT IS A CHAIN YOU CAN NOW REACH. fields.js MASTER names a handful of
// global treatments — drive, glue, tape, space, width, tilt, ceiling — and
// every one of them is a stage of engine/faust/dsp/fx_bus.dsp `master()`, "the
// WHOLE csd-engine.js master section in one stereo module", read in fx_bus's
// own order. buildMasterChain takes that spec and builds ONLY the stages it
// asks for: with no spec (a song with no `master`, which is every song saved
// before this) it builds the six nodes it always did, with the numbers it
// always had. Absent is today, node for node.
//
// EVERY BUILDER TAKES A CONTEXT. The offline bounce (audio/bounce.js) renders
// the whole song into an OfflineAudioContext, and it must render through THIS
// graph — the same master numbers, the same reverb impulses, the same echo
// topology — or the carrier the phone hears in the background is a different
// mix from the one it heard in the foreground. So the module-global `ctx` is
// the LIVE context only; the construction functions are parameterized, and the
// live init is just one caller of them. The master bus makes that rule bite
// harder rather than looser: the song's globals go INTO buildMasterChain, so
// the bounce gets them by construction and there is nowhere for a second
// opinion about the master to live.
import { resolveMaster, FX, SP, DRUMMIX, DRUMBUS } from "../ui/deps.js";
import { bpm, vol, MASTER, on, emit } from "../ui/state.js";

// exported as live bindings — null until initAudio(), which must ride a user
// gesture because that is the autoplay law
export let ctx = null, masterIn = null, bus = null, outGain = null,
           topLP = null, noise = null;
export let REV = null, delBus = null, roomBus = null;
export let SENDBUS = null, KIT = null;

// TEST SEAM, the ?nobounce shape (audio/bounce.js): ?dryroom builds the page
// with no drum-room bus at all, which is how it sounded before the room
// existed. It lives HERE, beside the room, rather than in the mixer, because
// it is a fact about the ROOM and everything downstream — the kit desk's lane
// sends, the channels' room trims — can then follow one null. It is here and
// nowhere else, because a mix control that turns the room off is a chip, not a
// query string.
export const DRYROOM = typeof location !== "undefined" && /[?&]dryroom\b/.test(location.search);

// HOW MANY NODES A SHARED BUS COST, keyed on the handle it returned. The budget
// in window.__nuMix has to add up the whole rack, and the two oldest builders
// (buildRoomBus, makeVerb) return a bare input node because that is what their
// callers — the offline gates included — connect to. Rather than reshape a
// contract two gates read, the count rides beside the handle.
const nodeCount = new WeakMap();
export const countOf = (h) => (h && nodeCount.get(h)) || 0;
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
// fx_bus `gritmix`: tanh drive with the level compensation that keeps it from
// simply being louder, and a mix that reaches unity by grit=0.125 — which is
// why the DRIVES table's low settings are as low as they are.
function gritCurve(grit) {
  const N = 1024, c = new Float32Array(N);
  const dr = 1 + grit * 2.6, comp = 1 / (1 + grit * 0.7), mix = Math.min(1, grit * 8);
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1, g = Math.tanh(x * dr) * comp;
    c[i] = x + (g - x) * mix;
  }
  return c;
}
// fx_bus `clip`: Bram de Jong's soft clip (method 0, iarg 0.5) — linear below
// half the limit, then a saturating knee. This is the stage the csound renders
// ended on, and it is a KNEE rather than a wall: the brickwall above it still
// does the gain riding, and this only rounds what escaped.
function clipCurve(limit) {
  const N = 1024, c = new Float32Array(N), a = 0.5;
  const bdj = v => (v < a ? v : a + (v - a) / (1 + Math.pow((v - a) / (1 - a), 2)));
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1;
    c[i] = Math.sign(x) * limit * bdj(Math.min(Math.abs(x) / limit, 1));
  }
  return c;
}

// THE SAFETY NET, which is not a colour. Identity below `knee`, then a
// tanh knee that asymptotes to 1.0 — so nothing can leave this graph above
// full scale, and nothing below the knee is touched at all. It exists because
// a DynamicsCompressor at ratio 20 is not a brickwall (it has an attack and it
// overshoots): with the velocity response on, a composed bar measured a peak
// of 1.032, which is the distortion a listener reports as "everything is
// distorted". Keeping the dynamics and stopping the overshoot is the whole
// job — flattening the music back down is what the old chain did.
function safetyCurve(knee) {
  const N = 2048, c = new Float32Array(N), span = 1 - knee;
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1, a = Math.abs(x);
    const y = a <= knee ? a : knee + span * Math.tanh((a - knee) / span);
    c[i] = Math.sign(x) * y;
  }
  return c;
}

/* ---------- the context-parameterized builders ---------- */
// THE MASTER CHAIN, live.js's numbers, plus the fx_bus stages fields.js MASTER
// names. `out` is left at unity — the live init hangs the volume gain off it,
// the offline bounce renders at full scale and lets the carrier element's own
// volume do the placing.
//
// EVERY OPTIONAL STAGE IS BUILT ONLY WHEN ASKED FOR. That is not an
// optimization, it is the absent-is-today law made structural: with `master`
// null the node list below is input, busComp, makeup, limiter, lp, out — the
// six this function has always built, at the values it has always used — so
// there is no "bypassed but present" state to drift, and a song from before
// the globals existed renders through the identical graph.
//
// THE ORDER IS fx_bus's ORDER (`master()`: transport wobble, sweep, duck, grit,
// comp, makeup, tone tilt, tape saturation, air shelf, clip), with width and
// the loudness push inserted where a mastering chain puts them — after the
// tone, before the brickwall. `dest` defaults to the context destination so the
// offline probes that call buildMasterChain(octx) bare keep working.
export function buildMasterChain(c, master, dest) {
  const M = resolveMaster(master);
  const input = c.createGain();
  const nodes = [input], oscs = [];
  let node = input;
  const chain = n => { node.connect(n); node = n; nodes.push(n); return n; };
  const built = [];

  // ---- SPACE, first, because it is a BLEED off the sum rather than a stage.
  // fx_bus takes `mrev` off the mix into the reverb input, so the wash arrives
  // at the TOP of the master chain and is compressed and limited with the music
  // — which is the difference between "the mix is in a room" and "a reverb was
  // put on the end". Here the tap is masterIn's whole sum (every channel, every
  // section send and the drum room already land there), which is the same
  // claim: one room under all of it, whatever a section asked for on its own.
  //
  // The room itself is live.js's vapor wash — pre-delay plus three damped combs
  // — and NOT a convolver, for buildRoomBus's stated reason: the audio gate
  // holds this page to two convolution reverbs and they are the most expensive
  // node on it. A third one hiding in the master is exactly how that budget
  // would go without anyone deciding to spend it.
  let space = null;
  if (M.space) {
    const sum = c.createGain();
    input.connect(sum); nodes.push(sum);
    const bleed = c.createGain(); bleed.gain.value = M.space.mix;
    const pre = c.createDelay(0.3); pre.delayTime.value = 0.028 * M.space.size;
    // the wash runs hot by construction (three combs at fb ~0.7); the trim is
    // what makes `mix` mean the bleed depth rather than the return level
    const wet = c.createGain(); wet.gain.value = 0.7;
    input.connect(bleed); bleed.connect(pre);
    for (const [t, fb] of [[0.113, 0.74], [0.149, 0.71], [0.193, 0.68]]) {
      const d = c.createDelay(0.6); d.delayTime.value = t * M.space.size;
      const g = c.createGain(); g.gain.value = fb;
      const lp2 = c.createBiquadFilter(); lp2.type = "lowpass"; lp2.frequency.value = 3000;
      pre.connect(d); d.connect(lp2); lp2.connect(g); g.connect(d); d.connect(wet);
      nodes.push(d, g, lp2);
    }
    wet.connect(sum); nodes.push(bleed, pre, wet);
    node = sum;
    space = { bleed };
    built.push("space");
  }

  // ---- TAPE, the transport: wow + flutter modulating a short fractional delay
  // per channel. fx_bus runs L and R at different rates on purpose, so the
  // drift decorrelates into width instead of shifting the image. Built only
  // when the chosen machine actually wobbles (`warm` is saturation alone).
  let wob = null;
  if (M.tape && M.tape.wob > 0) {
    const base = 0.0016, dev = base * 0.9 * M.tape.wob;   // fx_bus WOB_MS, ±90%
    const sp = c.createChannelSplitter(2), mg = c.createChannelMerger(2);
    node.connect(sp); nodes.push(sp, mg);
    [[0.61, 5.70], [0.53, 6.30]].forEach(([wHz, fHz], ch) => {
      const d = c.createDelay(0.05); d.delayTime.value = base;
      sp.connect(d, ch); d.connect(mg, 0, ch); nodes.push(d);
      // wow is dominant, flutter a quarter-weight on top — fx_bus's own split
      for (const [hz, w] of [[wHz, 0.75], [fHz, 0.25]]) {
        const o = c.createOscillator(); o.frequency.value = hz;
        const g = c.createGain(); g.gain.value = dev * w;
        o.connect(g); g.connect(d.delayTime);
        try { o.start(0); } catch (e) {}
        oscs.push(o); nodes.push(g);
      }
    });
    node = mg;
    wob = M.tape.wob;
  }

  // ---- DRIVE (fx_bus grit) ----
  let drive = null;
  if (M.drive != null && M.drive > 0) {
    drive = c.createWaveShaper();
    drive.curve = gritCurve(M.drive); drive.oversample = "2x";
    chain(drive); built.push("drive");
  }

  // ---- GLUE: the compressor that was always here, with a character ----
  const busComp = c.createDynamicsCompressor();
  busComp.threshold.value = M.glue.thr; busComp.knee.value = M.glue.knee;
  busComp.ratio.value = M.glue.ratio;
  busComp.attack.value = M.glue.atk; busComp.release.value = M.glue.rel;
  chain(busComp);
  const makeup = c.createGain(); makeup.gain.value = M.glue.makeup;
  chain(makeup);
  // no node was added for a glue character, so "built" here means "these are
  // not the numbers the chain runs when nothing is set"
  const glueMoved = M.glue.thr !== -22 || M.glue.ratio !== 2.2 || M.glue.makeup !== 2.2;
  if (glueMoved) built.push("glue");

  // ---- TILT: a SHELF PAIR rocking about the middle. Not a filter pair — the
  // thing that STOPS the top (the 16 kHz ceiling below) is unconditional, and
  // the parent's note on its own air shelf is that a shelf dims rather than
  // stops. One number: the low shelf takes −t, the high shelf +t.
  let tilt = null;
  if (M.tilt != null && M.tilt !== 0) {
    const lo = c.createBiquadFilter(); lo.type = "lowshelf";
    lo.frequency.value = 250; lo.gain.value = -M.tilt;
    const hi = c.createBiquadFilter(); hi.type = "highshelf";
    hi.frequency.value = 3000; hi.gain.value = M.tilt;
    chain(lo); chain(hi);
    tilt = { lo, hi };
    built.push("tilt");
  }

  // ---- TAPE, the head: fx_bus tapesat, which IS satCurve at mix 1 ----
  let tsat = null;
  if (M.tape && M.tape.sat > 0) {
    tsat = c.createWaveShaper();
    tsat.curve = satCurve(1 + 1.8 * M.tape.sat, 1); tsat.oversample = "2x";
    chain(tsat);
  }
  // reported off the two things that were actually wired, not off the chip —
  // a machine that asked for neither a wobble nor a head would be no machine
  if (wob != null || tsat) built.push("tape");

  // ---- WIDTH: a mid/side trim. mid = (L+R)/2 goes straight through; side =
  // (L−R)/2 is scaled and re-summed with opposite signs. Side ×0 is mono.
  let width = null;
  if (M.width != null && M.width !== 1) {
    const sp = c.createChannelSplitter(2), mg = c.createChannelMerger(2);
    const mid = c.createGain(); mid.gain.value = 0.5;
    const side = c.createGain(); side.gain.value = 0.5;
    const inv = c.createGain(); inv.gain.value = -1;
    const sPos = c.createGain(); sPos.gain.value = M.width;
    const sNeg = c.createGain(); sNeg.gain.value = -M.width;
    node.connect(sp);
    sp.connect(mid, 0); sp.connect(mid, 1);
    sp.connect(side, 0); sp.connect(inv, 1); inv.connect(side);
    side.connect(sPos); side.connect(sNeg);
    mid.connect(mg, 0, 0); mid.connect(mg, 0, 1);
    sPos.connect(mg, 0, 0); sNeg.connect(mg, 0, 1);
    nodes.push(sp, mg, mid, side, inv, sPos, sNeg);
    node = mg;
    width = { sPos };
    built.push("width");
  }

  // ---- CEILING: the push into the brickwall, the brickwall, the 16 kHz
  // MASTER TOP, and (for every setting but `open`) fx_bus's soft clip.
  let push = null;
  if (M.ceiling.push !== 1) {
    push = c.createGain(); push.gain.value = M.ceiling.push; chain(push);
  }
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = M.ceiling.thr; limiter.knee.value = 0; limiter.ratio.value = 20;
  limiter.attack.value = 0.002; limiter.release.value = 0.12;
  chain(limiter);
  const lp = c.createBiquadFilter(); lp.type = "lowpass";
  lp.frequency.value = 16000; lp.Q.value = 0.5;
  chain(lp);
  // THE SAFETY CLIP IS NOT A TASTE SETTING. A DynamicsCompressor at ratio 20
  // is not a brickwall — it has an attack and it overshoots — so with the
  // ceiling left alone there was nothing at the end of the chain that could
  // not be exceeded. Measured the day the velocity response landed: the same
  // composed bar peaked at 1.032 with the response on and 0.734 with
  // ?flatvel, because a per-note high shelf legitimately adds level and
  // nothing downstream was obliged to catch it. Peaks over 1.0 are the
  // distortion Paul reported; the crest they buy (5.8 dB -> 10.3) is the
  // dynamics he asked for, so the answer is to keep the dynamics and stop the
  // overshoot, not to flatten the music back down.
  //
  // So: always end in a SAFETY curve — but not clipCurve, which is a colour.
  // Bram de Jong's soft clip is linear only below HALF its limit and saturates
  // the whole upper half; used as a safety net it took the crest from 10.3 dB
  // down to 4.8, which is the crush wearing a different hat (measured, this
  // file's own experiment). The safety curve below is IDENTITY up to `knee`
  // and only bends in the last sliver, so a mix that never approaches full
  // scale is bit-transparent through it, and one that does is stopped rather
  // than squashed. `ceiling.clip`, when the user asks for it, still gets the
  // fx_bus colour — that is a taste, and it goes BEFORE the safety net.
  let clip = null;
  if (M.ceiling.clip > 0) {
    clip = c.createWaveShaper();
    clip.curve = clipCurve(M.ceiling.clip); clip.oversample = "2x";
    chain(clip);
  }
  const safety = c.createWaveShaper();
  safety.curve = safetyCurve(0.96); safety.oversample = "2x";
  chain(safety);
  // the safety clip is always there, so it is no longer evidence that the
  // user asked for a ceiling — only a chosen limit, a push or a moved
  // threshold is
  if (M.ceiling.clip > 0 || push || M.ceiling.thr !== -1.5) built.push("ceiling");

  const out = c.createGain();
  chain(out);
  out.connect(dest || c.destination);

  // WHAT WAS BUILT, read off the nodes — not the spec that asked for it. Same
  // law __nuMix holds the channels to: a stage that lit up in a table and never
  // reached an AudioParam is exactly the failure this file keeps rediscovering.
  const report = () => ({
    stages: built.slice(),
    nodes: nodes.length,
    glue: { threshold: +busComp.threshold.value.toFixed(2),
            ratio: +busComp.ratio.value.toFixed(2),
            makeup: +makeup.gain.value.toFixed(3) },
    drive: drive ? +M.drive.toFixed(3) : null,
    tape: (wob != null || tsat) ? { wob: wob == null ? 0 : +wob.toFixed(3),
                                    sat: tsat ? +M.tape.sat.toFixed(3) : 0 } : null,
    space: space ? { mix: +space.bleed.gain.value.toFixed(3),
                     size: +M.space.size.toFixed(3) } : null,
    width: width ? +width.sPos.gain.value.toFixed(3) : null,
    tilt: tilt ? { lo: +tilt.lo.gain.value.toFixed(2),
                   hi: +tilt.hi.gain.value.toFixed(2) } : null,
    ceiling: { threshold: +limiter.threshold.value.toFixed(2),
               push: push ? +push.gain.value.toFixed(3) : 1,
               clip: M.ceiling.clip,
               top: +lp.frequency.value.toFixed(0) },
  });
  return { input, lp, out, nodes, oscs, report };
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
  nodeCount.set(input, 8);
  return { input, nodes: 8, setTime(bars, when) {
    const t = Math.min(1.9, Math.max(0.02, bars * barSec()));
    // eased, not jumped: a feedback delay whose time moves is a tape machine
    // changing speed, and that is a nicer thing to hear than a click
    try { dA.delayTime.setTargetAtTime(t, when, 0.05);
          dB.delayTime.setTargetAtTime(t, when, 0.05); } catch (e) {}
  } };
}
// THE DRUM ROOM — the one send that is not a reverb chip.
//
// "Our drums sound really dry." They were: every lane went straight into the
// section's channel, and the only wet path on the page was the section's own
// reverb send, which is a MUSICAL choice (a genre asks for verb 0.72 because
// it wants to sound like that) shared by every voice in the box. A kit needs
// something else and needs it whatever the section is doing — the room the
// drums were recorded in. Take that away and a snare is a click; that is the
// whole difference between a sampled kit and a kit.
//
// So: a SEPARATE, always-there ambience return, short and bright-ish and
// stereo, fed by per-lane sends (instruments.js DRUMMIX.room). Early
// reflections first — six taps under 32 ms, hard left and right, which is what
// actually says "walls" — then a pair of damped combs for a ~0.35 s tail. A
// 220 Hz high-pass keeps the kick's body out of it (a washed kick is mud, and
// the kick's own room send is 0.10 for the same reason).
//
// NOT A CONVOLVER, deliberately: the three convolution reverbs are the most
// expensive nodes on the page and the audio gate holds the page to two of them
// (nukernel-audio (H)). Delays and gains cost nothing, and an early-reflection
// network is the right shape for a small room anyway.
export function buildRoomBus(c, dest) {
  let n = 0;
  const input = c.createGain(); n++;
  const hp = c.createBiquadFilter(); hp.type = "highpass";
  hp.frequency.value = 220; hp.Q.value = 0.7; n++;
  const pre = c.createDelay(0.05); pre.delayTime.value = 0.008; n++;  // distance to the first wall
  const out = c.createGain(); out.gain.value = 0.9; n++;
  input.connect(hp); hp.connect(pre);
  const side = (taps, comb, pan) => {
    const p = c.createStereoPanner(); p.pan.value = pan; n++;
    for (const [t, g] of taps) {
      const d = c.createDelay(0.1); d.delayTime.value = t;
      const gg = c.createGain(); gg.gain.value = g; n += 2;
      pre.connect(d); d.connect(gg); gg.connect(p);
    }
    const d = c.createDelay(0.2); d.delayTime.value = comb[0];
    const fb = c.createGain(); fb.gain.value = comb[1];
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = comb[2]; n += 3;
    pre.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(p);
    p.connect(out);
  };
  side([[0.0113, 0.70], [0.0191, 0.50], [0.0273, 0.36]], [0.0431, 0.42, 5200], -0.8);
  side([[0.0139, 0.66], [0.0217, 0.47], [0.0311, 0.34]], [0.0532, 0.40, 4800],  0.8);
  out.connect(dest);
  nodeCount.set(input, n);
  return input;
}
/* ---------- THE KIT DESK: one desk for the page, not one per section ------- */
// TWELVE LANE STRIPS PER CHANNEL WAS THE BIGGEST SINGLE COST ON THIS PAGE.
// Measured on a composed eleven-section Beatles song (2026-08-15): 337 of the
// mixer's 375 persistent nodes were channel nodes, and 18 of the ~31 in each
// channel were lane strips — the same twelve gains, panners and room sends,
// rebuilt per section, carrying values off ONE CONSTANT TABLE (instruments.js
// DRUMMIX). There is no per-section drum-lane control anywhere in the
// vocabulary, so eleven copies of the desk were eleven copies of one answer.
//
// The parent does not do this either: engine/faust/press/render-core.js pans
// drums by writing each event into two shared stereo buses with constant-power
// gains (line 128), and engine/faust/live/live.js gives the whole found layer
// ONE submix (`foundDests`, line 636). One desk, many senders.
//
// So the kit's internal geometry — level, placement, its share of the room —
// is built once, and a SECTION reaches it through a single gate, exactly the
// way voices.js routes the shared Faust synth pool ("the pool stays global and
// the ROUTE moves instead"). The lane strips are still lazy: twelve lanes
// exist, a genre plays four or five, and a strip is a gain and a panner well
// outside the render window.
export function buildKitDesk(c, room) {
  let n = 0;
  // the parent's transient-preserving drum strip (state-engine STRIP_PROFILES
  // .drum: a subsonic HPF and a whisper of glue saturation, NO compressor and
  // no dulling filter — the attack IS the instrument), now once for the page
  const dry = c.createGain(); n++;
  const hp = c.createBiquadFilter(); hp.type = "highpass";
  hp.frequency.value = DRUMBUS.hpf; n++;
  const sat = c.createWaveShaper();
  sat.curve = satCurve(1 + 3 * DRUMBUS.sat, DRUMBUS.satMix); sat.oversample = "2x"; n++;
  dry.connect(hp); hp.connect(sat);
  // the room sum is fed by the LANES, not by the kit output, so the ratio
  // between a dry kick and a wet snare survives — that ratio is the room
  let roomSum = null;
  if (room) { roomSum = c.createGain(); n++; }
  const lanes = new Map();
  const laneIn = (d) => {
    let L = lanes.get(d);
    if (L) return L.in;
    const m = DRUMMIX[d] || { lvl: 1, pan: 0, room: 0.3 };
    const g = c.createGain(); g.gain.value = m.lvl;
    const p = c.createStereoPanner(); p.pan.value = m.pan; n += 2;
    g.connect(p); p.connect(dry);
    let r = null;
    if (roomSum) { r = c.createGain(); r.gain.value = m.room; p.connect(r); r.connect(roomSum); n++; }
    lanes.set(d, L = { in: g, gain: g, pan: p, room: r, mix: m });
    return L.in;
  };
  // WHICH CHANNELS HANG OFF THIS DESK, so focusKit can walk them without the
  // mixer having to hold a second registry (and so a retired channel's gates
  // stop being written to — an open gate on a dead channel is the zombie
  // ZERO-STATIC R1 is about, one level up from an oscillator).
  const gates = new Map();                   // channel object -> { kit, room }
  return { dry, out: sat, roomSum, laneIn, lanes, gates,
           get nodes() { return n; } };
}
/* ---------- THE AUX SEND RACK: one bus per effect, for the whole page ------ */
// See fields.js "A CHIP IS A SEND; A CHAIN IS AN INSERT" for why this is an
// EXACT refactor rather than an approximation: every effect but `filtersweep`
// is built by sampler.js buildInsertNodes as `parallel(mix, wet)`, a crossfade
// around a wet function of the same input. Pin that mix to 1 and the bus is
// pure wet; hand the chip's own mix to the send gain and trim the dry path by
// (1-mix) and the sum is the insert's output, sample for sample.
//
// WHAT IS GENUINELY DIFFERENT is that the bus has ONE set of internal state
// for the page: one chorus LFO, one flanger feedback loop, one distortion
// stage. This instrument plays one section at a time, so in practice that
// shows up in exactly two places, and both are improvements: the modulation
// phase runs CONTINUOUSLY across a section change instead of restarting from
// zero (a per-section rack re-instantiated its LFO at every boundary, which is
// a phase jump you can hear on a pad), and during the ~30 ms channel
// changeover two sections briefly share the effect's state.
export function buildSendBus(c, key, dest, barsec) {
  const def = FX[key];
  if (!def || !SP || !SP.buildInsertNodes) return null;
  const ch = SP.buildInsertNodes(c,
    [{ type: def.type || key, params: { ...def.params, mix: 1 } }], barsec);
  const input = c.createGain();
  const ret = c.createGain();
  input.connect(ch.input); ch.output.connect(ret); ret.connect(dest);
  return { input, ret, oscs: ch.oscs || [], stages: ch.stages || [],
           skipped: ch.skipped || [], nodes: (ch.nodes || []).length + 2 };
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
  nodeCount.set(inp, 4);
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
  // THREE STABLE ANCHORS around a REBUILDABLE middle. A master global is a
  // topology change (a wobble is delay nodes, a width is a splitter), so
  // changing one swaps the chain — and everything that must survive that swap
  // sits outside it:
  //
  //   masterIn ──> [ the master chain: swappable ] ──> outGain ──> destination
  //                                     └──────────> anl
  //
  // masterIn is where every channel, reverb, echo and drum room lands, so it
  // can never be rebuilt out from under them. outGain is the volume slider AND
  // the survival mute, which must not so much as blink when a chip moves. anl
  // is the boot instrument's tap, still pre-volume and pre-mute — the mute is a
  // fact about the speaker, not about the music.
  masterIn = ctx.createGain();                     // where anything unrouted lands
  bus = masterIn;
  outGain = ctx.createGain(); outGain.gain.value = masterVol();
  outGain.connect(ctx.destination);
  anl = ctx.createAnalyser(); anl.fftSize = 2048;
  installMaster();
  // ---- three reverbs, BUILT ON FIRST USE ----
  // A ConvolverNode with a 3.2-second stereo impulse is the most expensive
  // single node on the page, and it costs that whether or not anything is being
  // sent to it. Most songs use one of these; building all three at boot was
  // paying for a hall and a plate to render silence.
  REV = {};
  // ...and the aux send rack beside them, on the same law: a chorus bus is
  // built the first time anything asks to be chorused, and then never again
  SENDBUS = {};
  KIT = null;
  // the drum room is not lazy: every channel with a kit sends to it, which is
  // nearly every channel, and it is delays rather than convolution. ?dryroom
  // is the one thing that can refuse it — see DRYROOM at the head of this file.
  roomBus = DRYROOM ? null : buildRoomBus(ctx, masterIn);
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
/* ---------- the master chain, installed and swapped ---------- */
// SWAP, DON'T MUTATE. Half these globals are nodes rather than numbers, so
// "apply the new spec" cannot be a param write — and a chain rebuilt in place
// would have to disconnect masterIn mid-block, which is a click on every chip.
// So: build the new chain, run BOTH into outGain for a short crossfade, and
// retire the old one the way mixer.retireChannel retires a channel — fade,
// then well clear of the ramp stop the LFOs and disconnect. An oscillator that
// outlives its chain is the zombie ZERO-STATIC R1 is about, and the tape
// transport is the first thing on this page to run oscillators at the master.
const XFADE = 0.05;                                // seconds, both directions
let chain = null;
// module-local on purpose: the only ways in are initAudio's first build and the
// two subscriptions at the foot of this file, and a second caller would be a
// second opinion about when the master is allowed to change under a playing bar
function installMaster() {
  if (!ctx) return;
  const next = buildMasterChain(ctx, MASTER, outGain);
  const t = ctx.currentTime;
  next.out.connect(anl);
  if (chain) {
    // both chains carry the signal through the fade — masterIn stays connected
    // to the outgoing one until after it, so nothing is cut mid-block
    next.out.gain.setValueAtTime(0, t);
    next.out.gain.linearRampToValueAtTime(1, t + XFADE);
    retireMaster(chain, t);
  }
  masterIn.connect(next.input);
  chain = next;
  topLP = next.lp;
}
function retireMaster(old, at) {
  try {
    old.out.gain.cancelScheduledValues(at);
    old.out.gain.setValueAtTime(old.out.gain.value, at);
    old.out.gain.linearRampToValueAtTime(0, at + XFADE);
  } catch (e) {}
  // masterIn STAYS CONNECTED to the outgoing chain through the fade. Cutting
  // its feed here instead would leave the old side with nothing but its own
  // tails while the new side ramps up from zero — a 50 ms hole in the middle of
  // a crossfade, which is the click this whole dance exists to avoid.
  setTimeout(() => {
    try { masterIn.disconnect(old.input); } catch (e) {}
    for (const o of old.oscs) { try { o.stop(); } catch (e) {} }
    for (const n of old.nodes) { try { n.disconnect(); } catch (e) {} }
  }, 2500);
}
// WHAT THE MASTER ACTUALLY BUILT, for window.__nuMix (audio/mixer.js reads it).
// Reported off the nodes, never off the spec — the same law the channel rows
// are held to. Null before initAudio, which is honest: there is no master yet.
export const masterReport = () => (chain ? { ...chain.report(), set: MASTER || null } : null);

export function verbFor(name) {
  const n = VERBSPEC[name] ? name : "room";
  if (REV[n]) return REV[n];
  REV[n] = makeVerb(ctx, n, masterIn);
  return REV[n];
}
// ONE BUS PER EFFECT, BUILT ON FIRST USE — the same shape verbFor has always
// had, applied to the character effects. A box that asks for crunch and a part
// that asks for crunch send to the same distortion; nobody owns a copy.
// Returns null for an effect with no native twin (or before initAudio), and
// the caller falls back to a private insert — silence is never the answer to
// "the bus would not build".
export function sendFor(key) {
  if (!ctx || !SENDBUS) return null;
  if (Object.prototype.hasOwnProperty.call(SENDBUS, key)) return SENDBUS[key];
  let b = null;
  try { b = buildSendBus(ctx, key, masterIn, barSec()); } catch (e) { b = null; }
  SENDBUS[key] = b;
  return b;
}
// THE ONE KIT DESK. Lazy for the same reason the reverbs are: a song with no
// drums anywhere should not pay for a drum strip.
export function kitFor() {
  if (!ctx) return null;
  if (!KIT) KIT = buildKitDesk(ctx, roomBus);
  return KIT;
}
// WHAT THE SHARED RACK COSTS, for the node budget window.__nuMix enforces.
// Counted off the builders rather than guessed: the master chain reports its
// own node list, the two oldest buses carry theirs beside the handle they
// return (countOf), and the kit desk and the send buses count as they build.
export function sharedReport() {
  const verbs = Object.values(REV || {}).reduce((n, v) => n + countOf(v), 0);
  const sends = Object.values(SENDBUS || {}).reduce((n, b) => n + (b ? b.nodes : 0), 0);
  return {
    master: chain ? chain.nodes.length : 0,
    verbs, echo: echo ? echo.nodes : 0,
    room: countOf(roomBus), kit: KIT ? KIT.nodes : 0, sends,
    // the two extra anchors initAudio holds outside the swappable middle
    anchors: masterIn ? 2 : 0,
    sendBuses: Object.keys(SENDBUS || {}).filter(k => SENDBUS[k]),
    get total() { return this.master + this.verbs + this.echo + this.room +
                         this.kit + this.sends + this.anchors; },
  };
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
// a global moved, or a whole new song brought its own master with it. Both
// swap the chain; before initAudio both are no-ops, and the first build picks
// up whatever MASTER holds by then.
on("master", () => installMaster());
on("song", () => installMaster());
