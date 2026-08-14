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
// the unit you want to reverb, echo, filter, place and AUTOMATE — so the
// channel is per BOX (see CHAN below for why the spec-shared cache came off).
import { GENRES, FX, MAX_FX, fxChain, SENDS, LEVELS, PANS, RATES,
         SP } from "../ui/deps.js";
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
// KEYED BY THE BOX'S IDENTITY, not by its spec. Channels were shared by
// JSON.stringify(chanSpec) — correct while a channel was a static chain, and
// exactly what automation breaks: a point list makes every section's chain
// its own anyway (recon R11), so the sharing stopped paying and started
// constraining. What stays cheap is everything that matters: the synth pool
// is still keyed (dsp, voice) and routed through per-channel gates (the
// worklet-budget gate depends on it), reverbs are still built once per NAME,
// and a box whose spec changes rebuilds ITS channel in place — ahead of the
// bar, via the tick's prebuild — instead of stranding a shared one.
export const CHAN = new Map();               // box object -> channel
let chanSeq = 0;
const boxId = new WeakMap();                 // box object -> stable id for the key
const sendOf = (sec, k, dflt) => (sec[k] != null ? SENDS[sec[k]] : dflt);

// THE MOT FIELD IS AUTOMATION NOW — one code path. The legacy single-enum
// transition compiles to the same {param, points[[beat,value]…], curve} shape
// the box's `auto` list carries, with the exact ramp numbers armMotion used
// to hardcode. `hpf` is the one internal-only param (the riser is a highpass
// sweep, which the public cutoff — a lowpass — cannot say).
function compileAuto(sec, g) {
  const rate = g.rate * (sec.rate ? RATES[sec.rate] : 1);
  const beats = Math.max(1, Math.round((sec.len || g.bars) * 4 / rate));
  const out = [];
  if (sec.mot === "open")
    out.push({ param: "cutoff", curve: "exp", points: [[0, 320], [beats, 16000]] });
  else if (sec.mot === "close")
    out.push({ param: "cutoff", curve: "exp", points: [[0, 16000], [beats, 320]] });
  else if (sec.mot === "rise")
    out.push({ param: "hpf", curve: "exp", points: [[0, 20], [beats, 1400]] });
  else if (sec.mot === "pump") {
    const pts = [];
    for (let b = 0; b < beats; b++) pts.push([b, 0.32], [b + 0.85, 1]);
    out.push({ param: "level", curve: "exp", points: pts });
  }
  // the box's own list: real entries only (a bare param string is the
  // registry's inert placeholder shape and arms nothing)
  for (const a of (sec.auto || []))
    if (a && typeof a === "object" && a.param && Array.isArray(a.points) && a.points.length)
      out.push({ param: a.param, curve: a.curve === "exp" ? "exp" : "lin",
                 points: a.points });
  return out;
}
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
    auto: compileAuto(sec, g),
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
  // AUTOMATION NODES first, so a filter sweep works the section BEFORE its
  // effects rather than after them — closing down onto a reverb tail is a
  // fade, closing down into one is a door shutting. Only the nodes the
  // compiled list actually touches are built (same types, same Q, same
  // position the old single mot node had); pan and the two sends automate
  // the nodes the channel already owns, below.
  const autos = spec.auto || [];
  const needs = new Set(autos.map(a => a.param));
  const A = {};
  if (needs.has("cutoff")) {
    A.cutoff = c.createBiquadFilter(); A.cutoff.type = "lowpass";
    A.cutoff.Q.value = 2.2; chain(A.cutoff);
  }
  if (needs.has("hpf")) {
    A.hpf = c.createBiquadFilter(); A.hpf.type = "highpass";
    A.hpf.Q.value = 1.6; chain(A.hpf);
  }
  if (needs.has("level")) { A.level = c.createGain(); chain(A.level); }
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
  // where each automatable param lives on THIS channel — armAutomation asks
  // by name, so the walk never needs to know which nodes were built
  const autoParam = name =>
    name === "cutoff" ? (A.cutoff && A.cutoff.frequency)
    : name === "hpf" ? (A.hpf && A.hpf.frequency)
    : name === "level" ? (A.level && A.level.gain)
    : name === "pan" ? pan.pan
    : name === "send.rev" ? rs.gain
    : name === "send.echo" ? ds.gain : null;
  return { key: null, input, drumIn: dHP, player, autos, autoParam,
           motKind: spec.mot, oscs, nodes, spec, stages, rs, ds, lvl };
}
export function channelFor(sec) {
  const spec = chanSpec(sec);
  let id = boxId.get(sec);
  if (id == null) boxId.set(sec, id = ++chanSeq);
  // the key is UNIQUE PER BOX (the synth route gates and the prune both hang
  // off it) and carries the spec, so a changed chip is a changed key and the
  // channel rebuilds in place — ahead of the bar, because the tick prebuilds
  // the next section's channel outside the render window
  const key = "#" + id + "|" + JSON.stringify(spec);
  const got = CHAN.get(sec);
  if (got && got.key === key) return got;
  if (got) { retireChannel(got); dropRoute(got.key); }
  const c = buildChannel(ctx, spec, { master: masterIn, verb: verbFor, echoIn: delBus });
  c.key = key;
  CHAN.set(sec, c);
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
  // total ARMED automation entries across the built channels (mot compiles
  // into the same list, so a legacy transition counts as the automation it is)
  automation: [...CHAN.values()].reduce((n, c) => n + (c.autos ? c.autos.length : 0), 0),
  channels: [...CHAN.values()].map(c => ({
    fx: c.spec.fx, stages: c.stages, motion: c.motKind,
    rev: +c.rs.gain.value.toFixed(3), del: +c.ds.gain.value.toFixed(3),
    level: c.spec.lvl, pan: c.spec.pan, verb: c.spec.verb,
    key: c.key, auto: c.autos ? c.autos.length : 0 })),
});
// AUTOMATION IS ARMED WHEN ITS SECTION STARTS, and re-armed on every pass —
// which is what makes a transition a transition rather than a setting. One
// walker for everything: the legacy mot (compiled to points in chanSpec) and
// the box's own auto list take the same road — setValueAtTime on the first
// point, ramps to the rest, points in BEATS clipped to the section. Silent
// when the channel has nothing armed, so the scheduler calls it
// unconditionally. (The pump's re-duck is now a 0.15-beat ramp rather than
// the old instantaneous jump — the same gesture, without the step.)
export function armAutomation(chan, when, durSec, spb) {
  if (!chan || !chan.autos || !chan.autos.length) return;
  for (const a of chan.autos) {
    const p = chan.autoParam && chan.autoParam(a.param);
    if (!p) continue;
    try {
      p.cancelScheduledValues(when);
      let started = false;
      for (const [beat, val] of a.points) {
        const t = when + Math.min(durSec, Math.max(0, beat * spb));
        // exponential ramps refuse zero and sign changes; the floor keeps the
        // curve request honest instead of throwing mid-bar
        const v = a.curve === "exp" ? Math.max(0.0001, val) : val;
        if (!started) { p.setValueAtTime(v, t); started = true; }
        else if (a.curve === "exp") p.exponentialRampToValueAtTime(v, t);
        else p.linearRampToValueAtTime(v, t);
      }
    } catch (e) {}
  }
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
// voice is a WASM instance. Keyed by the box, the question is simply "does
// this box still exist": a deleted box's channel retires (gracefully — the
// fade in retireChannel), and an A/B between two chips rebuilds one channel
// in place via channelFor rather than accumulating strays, so there is no
// count threshold any more.
export function pruneChannels() {
  if (!ctx) return;
  const live = new Set(SONG);
  for (const [box, c] of [...CHAN]) {
    if (live.has(box)) continue;
    retireChannel(c);
    CHAN.delete(box);
    dropRoute(c.key);
  }
}

// a new song is a new mix; a changed box may strand a chain
on("song", () => { if (ctx) dropChannels(); });
on("box", () => pruneChannels());
