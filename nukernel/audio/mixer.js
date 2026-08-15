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
         SP, DRUMFILE, DRUMMIX, DRUMBUS, instrOf } from "../ui/deps.js";
import { SONG, on } from "../ui/state.js";
import { gid, stackOf } from "../ui/derive.js";
import { ctx, masterIn, delBus, roomBus, verbFor, barSec, satCurve, REV,
         VERBSPEC } from "./graph.js";
import { synthNodes, synthOut, clearRoutes, dropRoute, pruneSynths } from "./voices.js";

// DRUMS get a strip too, but a transient-preserving one — a subsonic HPF and a
// whisper of glue saturation, NO compressor and no dulling filter (the parent's
// STRIP_PROFILES.drum, whose whole point is that the attack IS the instrument).
// It is one long-lived pair of nodes per channel rather than per note: the
// drums are buffers fired straight at it, not sampler notes.
//
// WHAT SITS IN FRONT OF IT NOW is the part that was missing: a LANE STRIP per
// drum lane — level, placement, and an ambience send — so the kit arrives from
// twelve places in one room instead of from one point, dry. The numbers are
// instruments.js DRUMMIX; the room they send to is graph.js buildRoomBus.
const LANEIDS = Object.keys(DRUMFILE);
// A LANE'S PAN IS THE KIT'S INTERNAL GEOMETRY, and nothing else. The section's
// own pan chip is a separate StereoPanner further down the channel, so a
// hard-left box moves the whole kit and keeps its spread — which is why these
// numbers are small (±0.28) and the chip's are not (±0.7).
const laneMix = (lane) => DRUMMIX[lane] || { lvl: 1, pan: 0, room: 0.3, punch: 1, sus: 1 };
// TEST SEAM, the ?nobounce shape (audio/bounce.js): ?dryroom builds every
// channel with no drum-room send at all, which is the page as it sounded
// before the room existed. It is here so the gate can measure the SAME music
// wet and dry — a drum room you cannot A/B is a claim, not a treatment — and
// nowhere else, because a mix control that turns the room off is a chip, not
// a query string.
const DRYROOM = typeof location !== "undefined" && /[?&]dryroom\b/.test(location.search);

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
// WHO IS PLAYING IN THIS BOX, voice by voice — the same walk derive.js does to
// deal voices across the stack (authority first, each layer's voices continuing
// past it), reduced to the two facts the MIX needs: which sampled instrument
// sits in that chair, and whether the genre calls the chair a pad.
//
// This is what lets the channel place its voices and hear a COLLISION before a
// note is played: vaporwave puts `strings` on both its voices five semitones
// apart, shoegaze puts one overdrive guitar on top of another, and two voices
// on the same instrument in the same register are the definition of soup (the
// parent's mastering stage calls it a same-timbre collision and carves it; see
// buildChannel). Post rock has the same collision on paper — two clean guitars
// — and does not sound like soup, because its two guitars sit fourteen
// semitones apart. Register separation is the cure; where the genre does not
// provide it, placement and a mud dip are what the mixer can do instead.
export function voiceRoster(sec) {
  const out = [];
  let base = 0;
  for (const ent of stackOf(sec)) {
    const g = GENRES[ent.g];
    if (!g) continue;
    for (let v = 0; v < g.voices; v++)
      out.push({ v: base + v, id: instrOf(ent.g, v), pad: g.realize(v) === "pad" });
    base += g.voices;
  }
  return out;
}
export function chanSpec(sec) {
  const g = GENRES[gid(sec)];    // never null: a box always has an authority
  return {
    // the roster rides IN the spec, so a stack edit rebuilds the channel that
    // places it (the key is the stringified spec) instead of leaving yesterday's
    // placement on today's instruments
    roster: voiceRoster(sec),
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
  const dHP = c.createBiquadFilter(); dHP.type = "highpass"; dHP.frequency.value = DRUMBUS.hpf;
  const dSat = c.createWaveShaper(); dSat.curve = satCurve(1 + 3 * DRUMBUS.sat, DRUMBUS.satMix);
  dSat.oversample = "2x";
  dHP.connect(dSat); dSat.connect(input);
  nodes.push(dHP, dSat);
  // ---- the drum ROOM send, per channel ----
  // One trim for the whole kit into the shared ambience return (graph.js
  // buildRoomBus). It hangs off the LANES, not off the drum bus output, so the
  // ratio between a dry kick and a wet snare survives — that ratio is the room.
  // It deliberately does NOT pass through the section's level/pan/inserts: the
  // room is a property of the kit, not of the mix move being made on the box.
  let droom = null;
  if (env.room && !DRYROOM) {
    droom = c.createGain(); droom.gain.value = DRUMBUS.room;
    droom.connect(env.room); nodes.push(droom);
  }
  // ---- the LANE STRIPS, built on the lane's first hit ----
  // Twelve lanes exist; a genre plays four or five of them. Building all twelve
  // per channel would be ~36 nodes of nothing, so a lane is built when it first
  // sounds — a gain and a panner, well outside the render window (the scheduler
  // is 150 ms ahead of the clock, and neither node is a worklet or a convolver,
  // which are the two things ZERO-STATIC R2 forbids building late).
  const lanes = new Map();                    // lane letter -> { in, gain, pan, room }
  const laneIn = (d) => {
    let L = lanes.get(d);
    if (L) return L.in;
    const m = laneMix(d);
    const g = c.createGain(); g.gain.value = m.lvl;
    const p = c.createStereoPanner(); p.pan.value = m.pan;
    g.connect(p); p.connect(dHP);
    let r = null;
    if (droom) { r = c.createGain(); r.gain.value = m.room; p.connect(r); r.connect(droom); }
    lanes.set(d, L = { in: g, gain: g, pan: p, room: r, mix: m });
    nodes.push(g, p); if (r) nodes.push(r);
    return L.in;
  };
  // ---- the VOICE BUSES: one placement per pitched voice ----
  // The parent's mastering stage places voices at the UNIT level (MASTER_PAN:
  // lead a touch right, pad counterweighting left, solos alternating) because a
  // stack of voices arriving at exactly one point is a mono mix however good
  // each voice sounds. nukernel mixes per SECTION, so the placement lives here,
  // one small bus per voice: [carve] -> pan -> the channel's own chain.
  //
  // Each voice also gets its OWN SamplerLive player, whose dry/rev/del all tap
  // that bus — same law as the single player it replaces (every tap lands on
  // one place and the section's sends decide the rest), just per chair. A
  // player is a closure over three destinations; the expensive nodes are still
  // per note.
  const roster = spec.roster || [];
  // SAME-TIMBRE COLLISION, decided from the ROSTER and not from who happens to
  // play first. Two chairs on one instrument read as one thick chair; the
  // parent dips the mud band on every voice in the collision but the first, and
  // "the first" has to mean the first CHAIR — deciding it lazily, at the first
  // note, would hand the exemption to whichever voice the scheduler reached
  // first, which is a fact about the phrase rather than about the band.
  //
  // The parent's other half — a 300 Hz high-pass on the accompaniment — is NOT
  // ported: it knows a voice's role and register and this mixer does not, so
  // high-passing what might be the LOW voice (vaporwave's second `strings`
  // averages MIDI 42, whose fundamental is 185 Hz) would delete the part rather
  // than separate it. The dip is register-safe; the placement below does the rest.
  const carved = new Set();
  {
    const seen = new Set(), dup = new Set();
    for (const r of roster) { if (seen.has(r.id)) dup.add(r.id); seen.add(r.id); }
    const first = new Set();
    for (const r of roster) {
      if (!dup.has(r.id)) continue;
      if (first.has(r.id)) carved.add(r.v); else first.add(r.id);
    }
  }
  // how wide the band sits: two voices stay close to centre, eight spread to
  // the edges of the parent's own placement range
  const spread = Math.min(0.34, 0.08 + 0.06 * roster.length);
  const voices = new Map();                   // voice index -> { in, pan, player, carve }
  const voiceBus = (v) => {
    let V = voices.get(v);
    if (V) return V;
    const r = roster.find(x => x.v === v) || { v, id: "", pad: false };
    // Chair 0 sits nearly centre and every chair after it takes a side,
    // alternating and widening — the parent's MASTER_PAN shape (melody +0.10,
    // pad counterweighting left, solos alternating ±0.14) generalised to
    // however many chairs the stack has.
    const step = Math.ceil((v + 1) / 2) - 1;
    const dir = v % 2 ? 1 : -1;
    let pan = dir * Math.min(spread, 0.12 + 0.08 * step);
    if (v === 0) pan = r.pad ? -0.08 : 0.04;
    let node = c.createGain();
    const vin = node;
    let carve = null;
    if (carved.has(v)) {
      carve = c.createBiquadFilter(); carve.type = "peaking";
      carve.frequency.value = 450; carve.gain.value = -3.5; carve.Q.value = 0.9;
      node.connect(carve); node = carve; nodes.push(carve);
    }
    const p = c.createStereoPanner(); p.pan.value = pan;
    node.connect(p); p.connect(input);
    nodes.push(vin, p);
    let pl = null;
    if (SP && SP.SamplerLive) {
      try { pl = SP.SamplerLive(c, { dry: vin, rev: vin, del: vin }); } catch (e) { pl = null; }
    }
    voices.set(v, V = { in: vin, pan: p, player: pl, carve: !!carve, id: r.id });
    return V;
  };
  let player = null;
  if (SP && SP.SamplerLive) {
    // the CHANNEL-WIDE player, still here: the bass line has no chair in the
    // voice roster (it is one part per box, not one per genre voice) and neither
    // does anything that reaches the mixer without a voice index.
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
  return { key: null, input, drumIn: dHP, laneIn, lanes, voiceBus, voices, droom,
           player, autos, autoParam,
           motKind: spec.mot, oscs, nodes, spec, stages, rs, ds, lvl };
}
export function channelFor(sec, retireAt) {
  const spec = chanSpec(sec);
  let id = boxId.get(sec);
  if (id == null) boxId.set(sec, id = ++chanSeq);
  // the key is UNIQUE PER BOX (the synth route gates and the prune both hang
  // off it) and carries the spec, so a changed chip is a changed key and the
  // channel rebuilds in place — ahead of the bar, because the tick prebuilds
  // the next section's channel outside the render window.
  // `retireAt` is WHEN the old channel may start dying: the transport passes
  // nextBarTime, the moment the first bar scheduled into the NEW channel
  // sounds. Fading the old one at ctx.currentTime instead cut everything
  // already scheduled through it — the rest of the sounding bar plus the
  // whole lookahead window died in a 30 ms fade on every live mix edit of
  // the playing section, an audible hole of up to a bar.
  const key = "#" + id + "|" + JSON.stringify(spec);
  const got = CHAN.get(sec);
  if (got && got.key === key) return got;
  if (got) { retireChannel(got, retireAt); dropRoute(got.key, retireAt); }
  const c = buildChannel(ctx, spec, { master: masterIn, verb: verbFor, echoIn: delBus,
                                      room: roomBus });
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
  // THE DRUM ROOM EXISTS, as a node rather than as an intention. Reported at
  // the top because it is one bus for the whole page (graph.js), and a channel
  // whose kit sends to nothing is the failure this key makes visible.
  room: !!roomBus,
  lanes: LANEIDS,
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
    // the BUILT value, like rev/del beside it — reporting c.spec.lvl echoed
    // the declaration, and a buildChannel that left the gain at 1 kept every
    // gate green while the composed arc went flat
    level: +c.lvl.gain.value.toFixed(3), pan: c.spec.pan, verb: c.spec.verb,
    key: c.key, auto: c.autos ? c.autos.length : 0,
    // ADDED KEYS, never a reshape: the drum lanes and the pitched chairs that
    // have actually SOUNDED on this channel, read off the nodes themselves.
    // A lane strip is built on its first hit, so this doubles as "which of the
    // twelve lanes did this section really play" — and every number below is
    // the AudioParam's value, not the table's, because a table that never
    // reached a node is exactly the failure the mixer keeps rediscovering.
    droom: c.droom ? +c.droom.gain.value.toFixed(3) : null,
    drums: [...c.lanes.entries()].map(([d, L]) => ({ lane: d,
      level: +L.gain.gain.value.toFixed(3), pan: +L.pan.pan.value.toFixed(3),
      room: L.room ? +L.room.gain.value.toFixed(3) : null })),
    voices: [...c.voices.entries()].map(([v, V]) => ({ v, id: V.id,
      pan: +V.pan.pan.value.toFixed(3), carve: V.carve, player: !!V.player })),
  })),
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
// `at` (audio-clock seconds, default now) is when the fade may START — a
// channel replaced mid-bar rings out until its successor's first bar lands.
// prune/dropChannels keep the immediate default: their channel's box is gone.
function retireChannel(c, at) {
  let wait = 0;
  try {
    const t = ctx.currentTime, t0 = Math.max(t, at || t);
    wait = (t0 - t) * 1000;
    c.lvl.gain.cancelScheduledValues(t0);
    c.lvl.gain.setTargetAtTime(0, t0, 0.01);
  } catch (e) {}
  setTimeout(() => {
    for (const o of c.oscs) { try { o.stop(); } catch (e) {} }
    for (const n of c.nodes) { try { n.disconnect(); } catch (e) {} }
    try { c.input.disconnect(); c.drumIn.disconnect(); } catch (e) {}
  }, wait + 700);
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
