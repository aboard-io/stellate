// audio/voices.js — the things that actually make sound: the Faust synth pool
// and its per-channel routing, the sampled players (notes and drums), and the
// counted oscillator fallback. window.__nuFallback lives HERE, beside the
// fallback voices it counts — it is the browser gate's proof that every note
// came from a real instrument.
//
// Layer graph: deps -> state -> derive -> graph -> assets -> THIS FILE ->
// mixer -> transport. Never imports a ui view.
import { GENRES, VOX, VOXPARAM, BASSSYNTH, SP } from "../ui/deps.js";
import { SONG } from "../ui/state.js";
import { stackOf } from "../ui/derive.js";
import { ctx, bus, noise } from "./graph.js";
import { FAUSTDIR, FONT, fontDef, isSynthFont, specOf, zoneBufs, drumBufs,
         inFlight } from "./assets.js";

/* ---------- the Faust synth voices ---------- */
// A genre carrying `synth` is never sampled: its identity IS the synthesis. The
// tb303 voice takes the phrase's vectors one for one — freq from deg+oct, gate
// from gate, accent from acc, slide from sld — which is not a coincidence, it is
// what a 303 sequencer always was.
//
// Every Faust param is a real AudioParam (measured: parameters.size 11,
// freq.setValueAtTime present), so notes are scheduled on the audio clock
// exactly like the sampler's, with no timer poking values from the main thread.
export const synthNodes = new Map();
let dx7Presets = null;
// ONE NODE PER VOICE, AND THAT IS ALL. A Faust mono DSP is exactly that — mono —
// so a four-voice fugue routed through a single dx7 kept only the last note
// written to /DX7/freq and the counterpoint collapsed to one line. The pool is
// keyed by dsp AND voice index, which is how a monophonic voice becomes
// polyphonic: by there being several of it, the way a real DX7 has sixteen.
// And a Faust worklet is not free when it is idle — it computes every
// 128-sample block whether or not a note is sounding — so the pool size is a
// CPU budget, not a memory one.
//
// Keying it by CHANNEL as well, which is what a section's own effects seem to
// ask for, multiplies that budget by the number of distinct mixes in the song.
// Measured on a composed vaporwave track: nine sections, six distinct channels,
// each wanting a two-voice DX7 plus whichever synth bass its drop asked for —
// thirty-six always-on FM operators' worth of worklet, plus thirty-six wasm
// compiles at load. That is the glitching, and it is not subtle.
//
// So the pool stays global and the ROUTE moves instead: every node fans out to
// every channel through a gain, and exactly one of those gains is open. The
// section still gets its own inserts and its own sends — the signal really does
// go through them — but the expensive thing exists once.
export const synthKey = (spec, v) => spec.dsp + "#" + v;
export const synthOut = new Map();                // nodeKey -> Map(chanKey -> gain)
export function routeSynth(key, node, chan) {
  if (!node || !chan) return null;
  let m = synthOut.get(key);
  if (!m) { m = new Map(); synthOut.set(key, m); }
  let g = m.get(chan.key);
  if (!g) {
    g = ctx.createGain(); g.gain.value = 0;
    node.connect(g); g.connect(chan.input); m.set(chan.key, g);
  }
  return g;
}
// Opened on the bar a section starts, with a 4 ms ramp — long enough not to
// click, short enough that the first note of the section is not clipped.
export function focusSynths(chan, when) {
  if (!chan) return;
  for (const [key, m] of synthOut) {
    const node = synthNodes.get(key);
    if (node && !m.has(chan.key)) routeSynth(key, node, chan);
    for (const [k, g] of m)
      try { g.gain.setTargetAtTime(k === chan.key ? 1 : 0, when, 0.004); } catch (e) {}
  }
}
export async function loadSynth(spec, v, chan) {
  const key = synthKey(spec, v);
  if (synthNodes.has(key)) { routeSynth(key, synthNodes.get(key), chan); return synthNodes.get(key); }
  try {
    const fw = await import(FAUSTDIR + "node_modules/@grame/faustwasm/dist/esm/index.js");
    const fac = await fw.FaustWasmInstantiator.loadDSPFactory(
      FAUSTDIR + "dist/" + spec.dsp + "-module.wasm",
      FAUSTDIR + "dist/" + spec.dsp + "-meta.json");
    const node = await new fw.FaustMonoDspGenerator().createNode(ctx, spec.dsp, fac);
    // A CARTRIDGE PATCH is 144 params set once. data/dx7-presets.json is the
    // real sysex decoded, so "E.PIANO 1" is the actual DX7 patch, not a
    // sound-alike — and its `alg` picks which dx7_algN module to load.
    if (spec.preset) {
      if (!dx7Presets) dx7Presets = await (await fetch(FAUSTDIR + "data/dx7-presets.json")).json();
      const pre = dx7Presets[spec.preset];
      if (pre) for (const [path, val] of Object.entries(pre.params)) {
        const a = node.parameters.get("/" + spec.root + path);
        if (a) a.setValueAtTime(val, ctx.currentTime);
      }
    }
    synthNodes.set(key, node);
    // the node never touches a channel directly — it fans out through the
    // per-channel gates above, which is what keeps one node serving nine sections
    if (chan) routeSynth(key, node, chan); else node.connect(bus);
    return node;
  } catch (e) { synthNodes.set(key, null); return null; }
}
// THE VOICE KNOBS, applied generically. A chip carries a NORMALIZED position, not
// a number in Hz, so the same "bright" means bright on a 303 (cutoff 60..6000),
// on a Model D (60..16000) and on a reese (60..6000) without a per-synth table —
// and because the value is derived from the param's OWN declared range it can
// never land on a boundary, which is the clamp the audio gate exists to catch.
// (cutoff is heard in octaves, so it is interpolated in octaves — `log` below;
// the first param name the DSP actually owns wins, and a DSP that owns none of
// them, like the DX7, is simply left alone.)
// Every voice takes freq/gate/level the same way; the rest is per-DSP and is
// declared in the genre, so adding a synth is a data change rather than code.
export function playSynth(spec, midi, when, durSec, acc, sld, vel, v, chan, vox) {
  const key = synthKey(spec, v || 0), node = synthNodes.get(key);
  if (!node) return false;
  routeSynth(key, node, chan);
  const set = (n, val, t) => {
    const a = node.parameters.get("/" + spec.root + "/" + n);
    if (a && val != null) a.setValueAtTime(val, t);
  };
  for (const [k, val] of Object.entries(spec.set || {})) set(k, val, when);
  // the section's own knobs, AFTER the genre's — that is what makes them an
  // override rather than a suggestion
  if (vox) for (const [k, val] of Object.entries(vox)) {
    const def = VOX[k]; if (!def || def.t[val] == null) continue;
    for (const name of (VOXPARAM[k] || [])) {
      const a = node.parameters.get("/" + spec.root + "/" + name);
      if (!a) continue;
      const t = def.t[val], lo = a.minValue, hi = a.maxValue;
      const nv = def.log && lo > 0 ? lo * Math.pow(hi / lo, t) : lo + t * (hi - lo);
      set(name, Math.max(lo, Math.min(hi, nv)), when);
      break;
    }
  }
  set("accent", acc ? 1 : 0, when);
  set("slide", sld ? 1 : 0, when);
  const lvl = spec.level * (0.25 + 0.75 * ((vel == null ? 5 : vel) / 9));
  set("level", lvl, when); set("gain", Math.min(1, lvl), when);
  // FOLD INTO THE VOICE'S RANGE. A Faust freq param has a declared min/max —
  // DX7 stops at 1000 Hz, bass_reese at 500 — and setting a value past it does
  // not error, it CLAMPS, so every note above the ceiling collapses onto the
  // same pitch. That is not "a bit high", it is out of tune. Fold by octaves,
  // which keeps the pitch class and only moves the register.
  const fa = node.parameters.get("/" + spec.root + "/freq");
  let f = hz(midi);
  if (fa) {
    while (f > fa.maxValue && f / 2 >= fa.minValue) f /= 2;
    while (f < fa.minValue && f * 2 <= fa.maxValue) f *= 2;
    f = Math.max(fa.minValue, Math.min(fa.maxValue, f));
  }
  set("freq", f, when);
  set("gate", 1, when);
  set("gate", 0, Math.max(when + 0.02, when + durSec * 0.92));
  return true;
}
// THE POOL IS NOT A CACHE. Nodes survive a channel — they are channel-blind and
// expensive to build, so keeping them across an edit is right — but they must
// not survive the SONG. Every genre you audition leaves its worklet behind, and
// a session spent clicking through fourteen genres ends up rendering a 303, two
// synth basses and eight DX7 operators for a piece that uses none of them. They
// are silent and they cost exactly as much as if they were not.
export function pruneSynths() {
  if (!ctx) return;
  const want = new Set();
  if (isSynthFont()) want.add(fontDef().synth.dsp);
  for (const sec of SONG) {
    for (const e of stackOf(sec)) if (GENRES[e.g] && GENRES[e.g].synth) want.add(GENRES[e.g].synth.dsp);
    if (BASSSYNTH[sec.bassop]) want.add(BASSSYNTH[sec.bassop].dsp);
  }
  for (const [k, node] of [...synthNodes]) {
    if (want.has(k.split("#")[0])) continue;
    if (node) { try { node.disconnect(); } catch (e) {} }
    const m = synthOut.get(k);
    if (m) { for (const g of m.values()) { try { g.disconnect(); } catch (e) {} } synthOut.delete(k); }
    synthNodes.delete(k);
  }
}
// every per-channel route gate, dropped — the mixer calls this when it drops
// the channels themselves, so no gain node outlives the channel it fed
export function clearRoutes() {
  for (const m of synthOut.values()) {
    for (const g of m.values()) { try { g.disconnect(); } catch (e) {} }
    m.clear();
  }
}
export function dropRoute(chanKey) {
  for (const m of synthOut.values()) {
    const g = m.get(chanKey);
    if (g) { try { g.disconnect(); } catch (e) {} m.delete(chanKey); }
  }
}

/* ---------- the sampled players ---------- */
const zoneSpan = new Map();     // zones array (now cached, so identity hits) -> span
export function foldToZones(zones, midi) {
  let sp = zoneSpan.get(zones);
  if (!sp) {
    sp = { lo: Infinity, hi: -Infinity };
    for (const z of zones) { if (z.lo < sp.lo) sp.lo = z.lo; if (z.hi > sp.hi) sp.hi = z.hi; }
    zoneSpan.set(zones, sp);
  }
  if (!(sp.hi >= sp.lo)) return midi;
  let m = midi;
  while (m < sp.lo && m + 12 <= sp.hi) m += 12;
  while (m > sp.hi && m - 12 >= sp.lo) m -= 12;
  return Math.max(sp.lo, Math.min(sp.hi, m));
}
export function playSampled(id, midi, when, durSec, vel, gainMul, chan, strip) {
  const spec = specOf(id);
  const player = chan && chan.player;
  if (!spec || !player) return false;
  // FOLD INTO THE INSTRUMENT'S RANGE, the same law playSynth applies to a Faust
  // freq param and for the same reason. A sampler's zones cover a finite span,
  // and now that a layer can be moved two octaves either way a note can land
  // outside it — where zoneFor returns null, playSampled returns false, and the
  // note comes out of the oscillator fallback. Folding by octaves keeps the
  // pitch class and only moves the register.
  const midi2 = foldToZones(spec.zones, midi);
  const z = SP.zoneFor(spec.zones, midi2);
  if (!z) return false;
  const buf = zoneBufs.get(FONT + "|" + id + "|" + z.file);
  if (!buf) return inFlight.has("ins:" + id);      // loading: drop it, do not beep
  const lead = SP.zoneLeadIn ? SP.zoneLeadIn(buf, z, buf.sampleRate, spec.sr) : 0;
  const leadSec = lead ? lead / (buf.sampleRate || spec.sr) : 0;
  player.note(buf, when, {
    rate: SP.rateFor(z, midi2), durSec,
    gain: 0.42 * (0.2 + 0.8 * ((vel == null ? 5 : vel) / 9)) * (gainMul || 1),
    // THE STRIP IS WHERE THE MIX HAPPENS. sampler.js builds it — the same node
    // chain the big engine's live path builds from the same spec.
    strip,
    // the sends are the SECTION's, not the note's: every tap goes to the channel
    // input and the channel decides how wet the whole box is
    atk: 0.006, rel: 0.12, dry: 1, rsend: 0, dsend: 0,
    offsetSec: leadSec,
    loop: !!z.loop,
    loopStartSec: (z.loopStart || 0) / spec.sr + leadSec,
    loopEndSec: (z.loopEnd || 0) / spec.sr + leadSec });
  return true;
}
export function playDrum(kit, lane, when, acc, vel, chan) {
  const buf = kit && drumBufs.get(kit + "|" + lane);
  if (!buf) return !!kit && inFlight.has("kit:" + kit);
  const lvl = (vel == null ? 5 : vel) / 9;
  if (lvl <= 0.001) return false;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = (acc ? 1 : 0.72) * (0.45 + 0.55 * lvl) * (lane === "p" ? 0.5 : 1);
  src.connect(g); g.connect((chan && chan.drumIn) || bus);
  src.start(when);
  return true;
}

/* ---------- the fallback voices, counted ---------- */
export const hz = m => 440 * Math.pow(2, (m - 69) / 12);
// They are the sound of something not covered by a real instrument, they fire
// silently, and test/browser/nukernel-audio.test.js fails on any of them — but
// only if it can tell them apart from the oscillators the effect LFOs now
// legitimately start, which is what this counter is for.
window.__nuFallback = 0;
function nz(t, dur, hp, gain, chan) {
  const s = ctx.createBufferSource(); s.buffer = noise;
  const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
  // nz is only ever a DRUM noise, so it lands on the channel's drum sub-strip
  s.connect(f); f.connect(g); g.connect((chan && chan.drumIn) || bus); s.start(t); s.stop(t + dur + .02);
}
export function line(t, n, dur, acc, sld, prev, tone, padish, vel, chan) {
  const lvl = (vel == null ? 5 : vel) / 9;
  if (lvl <= 0.001) return;                       // a completed fade-out is silence
  window.__nuFallback++;
  const o = ctx.createOscillator(), o2 = ctx.createOscillator();
  const f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = o2.type = tone.wave; o2.detune.value = padish ? 9 : 4;
  if (sld && prev != null) {
    o.frequency.setValueAtTime(hz(prev), t); o2.frequency.setValueAtTime(hz(prev), t);
    const e = t + Math.min(.11, dur * .55);
    o.frequency.exponentialRampToValueAtTime(hz(n), e);
    o2.frequency.exponentialRampToValueAtTime(hz(n), e);
  } else { o.frequency.setValueAtTime(hz(n), t); o2.frequency.setValueAtTime(hz(n), t); }
  f.type = "lowpass"; f.Q.value = tone.q;
  const co = tone.cut * (acc ? 2.4 : 1);
  f.frequency.setValueAtTime(Math.min(11000, co * 3.4), t);
  f.frequency.exponentialRampToValueAtTime(Math.max(160, co), t + Math.max(.06, dur * .85));
  const pk = tone.gain * (0.18 + 0.82 * lvl) * (acc ? 1.12 : 1);
  g.gain.setValueAtTime(.0001, t);
  g.gain.linearRampToValueAtTime(pk, t + tone.atk);
  g.gain.setValueAtTime(pk, t + Math.max(tone.atk, dur * .7));
  g.gain.exponentialRampToValueAtTime(.0008, t + dur + tone.rel * .25);
  const dest = (chan && chan.input) || bus;
  o.connect(f); o2.connect(f); f.connect(g); g.connect(dest);
  const off = t + dur + tone.rel * .25 + .05;
  o.start(t); o2.start(t); o.stop(off); o2.stop(off);
}
export function hit(t, d, acc, vel, chan) {
  const lvl = (vel == null ? 5 : vel) / 9;
  if (lvl <= 0.001) return;
  window.__nuFallback++;
  const dest = (chan && chan.drumIn) || bus;
  const a = (acc ? 1.15 : .85) * (0.45 + 0.55 * lvl);
  if (d === "k") { const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(126, t); o.frequency.exponentialRampToValueAtTime(43, t + .09);
    g.gain.setValueAtTime(.95 * a, t); g.gain.exponentialRampToValueAtTime(.001, t + .34);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + .36); }
  else if (d === "s") { nz(t, .19, 900, .42 * a, chan);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "triangle";
    o.frequency.setValueAtTime(196, t);
    g.gain.setValueAtTime(.3 * a, t); g.gain.exponentialRampToValueAtTime(.001, t + .13);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + .15); }
  else if (d === "c") { [0, .011, .023].forEach(o2 => nz(t + o2, .1, 1400, .3 * a, chan)); }
  else if (d === "o") { nz(t, .26, 6600, .14 * a, chan); }
  else if (d === "h") { nz(t, .035, 7800, .13 * a, chan); }
  else if (d === "p") { nz(t, .05, 2600, .16 * a, chan); }
}
