// audio/mixer.js — a section's mixer channel: the insert chain, the two sends,
// level, pan, the motion filter, and window.__nuMix — the machine-readable
// truth about what the mixer actually BUILT versus what the chips declared
// (the project's "test the artifact" rule, in code; the browser gate reads it).
//
// Layer graph: deps -> state -> derive -> graph -> assets -> voices ->
// THIS FILE -> transport. Subscribes to "song" (a new song is a new mix — keep
// no old channels) and "box" (prune the chains nothing asks for any more).
//
// THE MIXING IS THE BIG ENGINE'S MIXING, and none of it is a reimplementation:
//   channel strips  STRIP_PROFILES (instruments.js) handed to SamplerLive
//   inserts         SP.buildInsertNodes — literally the function live.js calls
//   the master bus  audio/graph.js, live.js's numbers
// What is NOT borrowed is the topology: the big engine mixes per VOICE because
// a genre is one continuous thing. A song box is a SECTION, and a section is
// the unit you want to reverb, echo, filter and place — so the channel is per
// box's SPEC.
import { GENRES, FX, MAX_FX, fxChain, SENDS, LEVELS, PANS, SP } from "../ui/deps.js";
import { SONG, on } from "../ui/state.js";
import { gid } from "../ui/derive.js";
import { ctx, masterIn, delBus, verbFor, barSec, satCurve, REV,
         VERBSPEC } from "./graph.js";
import { synthNodes, synthOut, clearRoutes, dropRoute, pruneSynths } from "./voices.js";

// DRUMS get a strip too, but a transient-preserving one — a subsonic HPF and a
// whisper of glue saturation, NO compressor and no dulling filter. It is one
// long-lived pair of nodes per channel rather than per note: the drums are
// buffers fired straight at it, not sampler notes.
const DRUM_HPF = 28, DRUM_SAT = 0.15, DRUM_SATMIX = 0.22;

/* ---------- a section's mixer channel ---------- */
// KEYED BY WHAT IT IS, NOT BY WHICH BOX IT IS. Two boxes asking for the same
// chain get the same channel, which is both correct (they sound the same) and
// what keeps a long song from building forty insert chains. It also means a box
// that is dragged, copied or deleted needs no channel bookkeeping at all.
export const CHAN = new Map();
const sendOf = (sec, k, dflt) => (sec[k] != null ? SENDS[sec[k]] : dflt);
export function chanSpec(sec) {
  const g = GENRES[gid(sec)];    // never null: a box always has an authority
  return {
    fx: (sec.fx || []).filter(k => FX[k]).slice(0, MAX_FX),
    // ABSENT MEANS "AS THE GENRE ASKS". Every genre already declares how wet it
    // wants to be (tone.verb — vaporwave .55, acid .06), and that number was
    // being thrown away: every voice went out on a flat 0.14 send. Reading it as
    // the default send makes the genre table mean what it says.
    rev: sendOf(sec, "rev", g.tone && g.tone.verb != null ? g.tone.verb : 0.15),
    del: sendOf(sec, "echo", 0),   // the box field is `echo` since v:2; the
                                   // channel key stays `del` — it names the bus
    verb: sec.verb || (g.tone && g.tone.verb > 0.4 ? "hall" : "room"),
    lvl: sec.lvl ? LEVELS[sec.lvl] : 1,
    pan: sec.pan ? PANS[sec.pan] : 0,
    mot: sec.mot || null,
  };
}
// BUILD ON THE GIVEN CONTEXT. `env` names the busses the channel hangs off —
// { master, verb(name) -> return node, echoIn } — because the offline bounce
// builds this exact chain against its own OfflineAudioContext busses. The
// live channelFor below is just this plus the cache and the live env.
export function buildChannel(c, spec, env) {
  const input = c.createGain();
  let node = input;
  const nodes = [input];
  const chain = n => { node.connect(n); node = n; nodes.push(n); };
  // MOTION first, so a filter transition sweeps the section BEFORE its effects
  // rather than after them — closing down onto a reverb tail is a fade, closing
  // down into one is a door shutting.
  let mot = null;
  if (spec.mot === "open" || spec.mot === "close") {
    mot = c.createBiquadFilter(); mot.type = "lowpass"; mot.Q.value = 2.2; chain(mot);
  } else if (spec.mot === "rise") {
    mot = c.createBiquadFilter(); mot.type = "highpass"; mot.Q.value = 1.6; chain(mot);
  } else if (spec.mot === "pump") {
    mot = c.createGain(); chain(mot);
  }
  // BAKED AT BUILD TIME: the tempo-synced inserts (the echo's timeBars, a
  // sweep's rateBars) resolve against the bpm as it is NOW, and a later tempo
  // drag does not re-time them until the chain rebuilds. Same contract the big
  // engine states for its own insert chains — a perceptual-twin class of
  // difference, and re-instantiating every effect on a slider drag is worse.
  let oscs = [], stages = [];
  if (spec.fx.length && SP && SP.buildInsertNodes) {
    try {
      const ch = SP.buildInsertNodes(c, fxChain(spec.fx), barSec());
      node.connect(ch.input); node = ch.output; oscs = ch.oscs || [];
      stages = ch.stages || [];
      nodes.push(...(ch.nodes || []));
    } catch (e) { /* an insert that will not build must not take the section with it */ }
  }
  const pan = c.createStereoPanner(); pan.pan.value = spec.pan; chain(pan);
  const lvl = c.createGain(); lvl.gain.value = spec.lvl; chain(lvl);
  lvl.connect(env.master);
  const rs = c.createGain(); rs.gain.value = spec.rev; lvl.connect(rs);
  rs.connect(env.verb(spec.verb));
  const ds = c.createGain(); ds.gain.value = spec.del; lvl.connect(ds); ds.connect(env.echoIn);
  nodes.push(rs, ds);
  // the drum sub-strip: transient-preserving, long-lived, one per channel
  const dHP = c.createBiquadFilter(); dHP.type = "highpass"; dHP.frequency.value = DRUM_HPF;
  const dSat = c.createWaveShaper(); dSat.curve = satCurve(1 + 3 * DRUM_SAT, DRUM_SATMIX);
  dSat.oversample = "2x";
  dHP.connect(dSat); dSat.connect(input);
  let player = null;
  if (SP && SP.SamplerLive) {
    // every send taps the CHANNEL, so a note's own dry/rev/del all arrive at the
    // same place and the section's sends decide what happens next — exactly the
    // routing live.js uses when a voice carries an insert chain
    try { player = SP.SamplerLive(c, { dry: input, rev: input, del: input }); }
    catch (e) { player = null; }
  }
  return { key: null, input, drumIn: dHP, player, mot, motKind: spec.mot, oscs,
           nodes, spec, stages, rs, ds, lvl };
}
export function channelFor(sec) {
  const spec = chanSpec(sec), key = JSON.stringify(spec);
  const got = CHAN.get(key);
  if (got) return got;
  const c = buildChannel(ctx, spec, { master: masterIn, verb: verbFor, echoIn: delBus });
  c.key = key;
  CHAN.set(key, c);
  return c;
}
// WHAT THE MIXER ACTUALLY BUILT, for test/browser/nukernel-audio.test.js. The
// declared chain and the built chain are two different things — buildInsertNodes
// reports what it could not build in `skipped`, and an effect that silently
// passed dry is exactly the failure a screenshot cannot see.
window.__nuMix = () => ({
  master: !!masterIn,
  verbs: Object.keys(VERBSPEC),
  // THE COST, in the two currencies that actually bite. A Faust worklet runs
  // every block whether or not it is sounding, so `worklets` is a CPU budget;
  // `convolvers` is the same story for the most expensive single node here.
  worklets: synthNodes.size,
  convolvers: REV ? Object.keys(REV).length : 0,
  routes: [...synthOut.values()].reduce((n, m) => n + m.size, 0),
  channels: [...CHAN.values()].map(c => ({
    fx: c.spec.fx, stages: c.stages, motion: c.motKind,
    rev: +c.rs.gain.value.toFixed(3), del: +c.ds.gain.value.toFixed(3),
    level: c.spec.lvl, pan: c.spec.pan, verb: c.spec.verb })),
});
// A TRANSITION IS ARMED WHEN ITS SECTION STARTS, and re-armed on every pass —
// which is what makes it a transition rather than a setting. Silent when the
// channel has no motion node, so the scheduler can call it unconditionally.
export function armMotion(chan, when, durSec, spb) {
  if (!chan || !chan.mot) return;
  const p = chan.motKind === "pump" ? chan.mot.gain : chan.mot.frequency;
  try {
    p.cancelScheduledValues(when);
    if (chan.motKind === "open") {
      p.setValueAtTime(320, when); p.exponentialRampToValueAtTime(16000, when + durSec);
    } else if (chan.motKind === "close") {
      p.setValueAtTime(16000, when); p.exponentialRampToValueAtTime(320, when + durSec);
    } else if (chan.motKind === "rise") {
      p.setValueAtTime(20, when); p.exponentialRampToValueAtTime(1400, when + durSec);
    } else {
      // PUMP — a duck on every beat. Not a real sidechain (there is no detector
      // reading the kick), but the same gesture and the same reason: it makes
      // room on the beat, so a busy section breathes instead of smearing.
      for (let t = 0; t < durSec; t += spb) {
        p.setValueAtTime(0.32, when + t);
        p.exponentialRampToValueAtTime(1, when + Math.min(durSec, t + spb * 0.85));
      }
    }
  } catch (e) {}
}
// RETIRE, DON'T CUT. pruneChannels runs while the transport runs, and a note
// still ringing through a retired channel — up to two seconds of hidden
// lookahead plus its own release plus the reverb send tail — used to be cut
// mid-sample. ZERO-STATIC Stage 1.1 is this exact case: fade the channel out
// (~30 ms), THEN, well clear of the ramp, stop the LFOs and disconnect. The
// map forgets the channel immediately, so nothing new routes into a dying one.
function retireChannel(c) {
  try {
    const t = ctx.currentTime;
    c.lvl.gain.cancelScheduledValues(t);
    c.lvl.gain.setTargetAtTime(0, t, 0.01);
  } catch (e) {}
  setTimeout(() => {
    for (const o of c.oscs) { try { o.stop(); } catch (e) {} }
    for (const n of c.nodes) { try { n.disconnect(); } catch (e) {} }
    try { c.input.disconnect(); c.drumIn.disconnect(); } catch (e) {}
  }, 700);
}
export function dropChannels() {
  for (const c of CHAN.values()) retireChannel(c);
  CHAN.clear();
  clearRoutes();
  pruneSynths();
}
// CHANNELS ARE CHEAP BUT NOT FREE — an insert chain is real nodes and a synth
// voice is a WASM instance. Keyed by what they are, they accumulate as you try
// things; this drops the ones no box is asking for any more, but only once there
// are enough of them to matter, so an A/B between two chains does not rebuild
// on every click.
export function pruneChannels() {
  if (!ctx || CHAN.size <= 8) return;
  const live = new Set(SONG.map(s => JSON.stringify(chanSpec(s))));
  for (const [key, c] of [...CHAN]) {
    if (live.has(key)) continue;
    retireChannel(c);
    CHAN.delete(key);
    dropRoute(key);
  }
}

// a new song is a new mix; a changed box may strand a chain
on("song", () => { if (ctx) dropChannels(); });
on("box", () => pruneChannels());
