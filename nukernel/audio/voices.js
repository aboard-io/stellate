// audio/voices.js — the things that actually make sound: the Faust synth pool
// and its per-channel routing, the sampled players (notes and drums), and the
// counted STAND-IN pool. Nothing in this file synthesizes: a stand-in is one of
// the parent engine's own worklets (pad_saw for a line, the lane's own drum
// module for a hit), which is also how the four drum machines are voiced.
// window.__nuFallback lives HERE, beside the notes it counts — it is the
// browser gate's proof that every note came from the instrument it named.
//
// Layer graph: deps -> state -> derive -> graph -> assets -> THIS FILE ->
// mixer -> transport. Never imports a ui view.
import { GENRES, VOX, VOXPARAM, BASSSYNTH, SP, RANGES, STRETCH_UP,
         STRETCH_DOWN, DRUMBUS, STRIPS, mixFor, dynFor, dynCurve,
         DYN_ATK } from "../ui/deps.js";
import { SONG, bpm } from "../ui/state.js";
import { stackOf } from "../ui/derive.js";
// `noise` is gone from this import with the oscillator stubs it fed: nothing in
// this file makes a waveform any more, it only drives the engine's.
import { ctx, bus, buildVoiceChair } from "./graph.js";
// THE DRUM TABLE IS THE TAPE'S DRUM TABLE. audio/to-engine.js resolves a lane
// and a kit to a parent voice for the record; this file asks it the same
// question for the page, so there is one drum system and not two.
import { LANE, drumVoice, drumAmp, isMachine } from "./to-engine.js";
import { FAUSTDIR, FONT, fontDef, isSynthFont, specOf, zoneBufs, drumBufs,
         inFlight } from "./assets.js";

/* ---------- THE SECOND KIND OF DYNAMICS ---------- */
// The event tier writes velocity with real range and real shape now (kernel.js
// stress/phrase/touch). Downstream of it, velocity still only moved LOUDNESS —
// a note played harder was the same note turned up, which is not what any
// struck, plucked or blown instrument does and is most of what "extremely
// synthesized and robotic" was hearing.
//
// The parent's answer is a velocity LAYER (sampler.js zoneFor(zones, midi, vel)
// — see instruments.js DYN for the measured reason it cannot fire here: our
// extracted GM fonts carry one layer per instrument). So the difference is
// synthesized: a per-note filter envelope, a velocity-dependent amp attack and
// a few ms of sample-start offset on the sampled path (playSampled), and the
// voice's own cutoff/env-amount params on the synth path (driveSynth).
//
// ONE SCALE FOR BOTH. Velocity is 0..9 and 5 is the default the whole page
// falls back to (`vel == null ? 5` appears in every player here), so the term
// every treatment is proportional to is the SIGNED DISTANCE from that default:
// -1.25 at a ghosted 0, 0 at the default, +1 at a hammered 9. Everything the
// curve computes (instruments.js dynCurve) is zero at u === 0, which is what
// makes the default path SKIPPABLE rather than merely cheap — see the node
// budget note on the shelf below.
const VEL_MID = 5, VEL_TOP = 9;
export const velU = (vel) => (vel == null ? 0 : (vel - VEL_MID) / (VEL_TOP - VEL_MID));
// AN EAR SEAM, the ?dryroom / ?nobounce shape: ?flatvel takes the whole AUDIO
// tier of dynamics out and leaves the event tier exactly as it is, so the A/B
// that decides whether this helps is one reload rather than a git stash. It is
// deliberately not a per-note switch — the point is to hear a whole song both
// ways. `off` in the report below is how a gate knows which page it is on.
const FLATVEL = typeof location !== "undefined" && /[?&]flatvel\b/.test(location.search);
// WHAT ACTUALLY FIRED, for the gates and for a person with the console open:
// `shaped` is notes that built a shelf, `flat` is notes that landed exactly on
// the default velocity and built nothing, `synth` is the Faust path. Counters
// only — nothing reads them back into the sound, and unlike __nuFallback beside
// them they are NOT split per context: a background bounce's notes land in the
// same tally as the live graph's. That is deliberate for a debug readout and
// wrong for a gated one, which is why nukernel-drums (G) only ever asks whether
// they are non-zero.
export const dynStats = { shaped: 0, flat: 0, synth: 0 };
window.__nuDyn = () => ({ ...dynStats, off: FLATVEL });

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
    // ONTO ITS PART'S STRIP, not the section input. The route is the only
    // per-channel thing a pooled synth has, so it is also the only place the
    // per-part desk can reach one — and the channel answers "which strip" from
    // the node key alone (mixer.synthIn), so the pool stays keyed (dsp, voice)
    // and focusSynths keeps gating routes it did not create.
    node.connect(g);
    g.connect(chan.synthIn ? chan.synthIn(key) : chan.input);
    m.set(chan.key, g);
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
// the compiled DSP factory is reusable across CONTEXTS (faustwasm compiles the
// wasm once); the node is not. Caching factories here is what lets the offline
// bounce build its own voice pool without recompiling every module.
const factories = new Map();                      // dsp -> factory
let fwMod = null;
// life accounting for the zombie-worklet law (ZERO-STATIC R1): a disconnected
// Faust worklet computes every block forever, invisible to node counting —
// only a created/destroyed ledger can see one leak
export const nodeStats = { created: 0, destroyed: 0 };
window.__nuNodes = () => ({ ...nodeStats,
  alive: [...synthNodes.values()].filter(Boolean).length });
// build one Faust voice ON THE GIVEN CONTEXT — the live pool and the offline
// bounce share this, which is what makes the bounce the same instrument
export async function makeSynthNode(c, spec) {
  if (!fwMod) fwMod = await import(FAUSTDIR + "node_modules/@grame/faustwasm/dist/esm/index.js");
  let fac = factories.get(spec.dsp);
  if (!fac) {
    fac = await fwMod.FaustWasmInstantiator.loadDSPFactory(
      FAUSTDIR + "dist/" + spec.dsp + "-module.wasm",
      FAUSTDIR + "dist/" + spec.dsp + "-meta.json");
    factories.set(spec.dsp, fac);
  }
  const node = await new fwMod.FaustMonoDspGenerator().createNode(c, spec.dsp, fac);
  // A CARTRIDGE PATCH is 144 params set once. data/dx7-presets.json is the
  // real sysex decoded, so "E.PIANO 1" is the actual DX7 patch, not a
  // sound-alike — and its `alg` picks which dx7_algN module to load.
  if (spec.preset) {
    if (!dx7Presets) dx7Presets = await (await fetch(FAUSTDIR + "data/dx7-presets.json")).json();
    const pre = dx7Presets[spec.preset];
    if (pre) for (const [path, val] of Object.entries(pre.params)) {
      const a = node.parameters.get("/" + spec.root + path);
      if (a) a.setValueAtTime(val, c.currentTime);
    }
  }
  // the ledger counts the LIVE context only — offline bounce renders build a
  // fresh pool through this function and drop it with the OfflineAudioContext,
  // never passing retireSynth, so counting them reads as a permanent phantom
  // leak in the one instrument whose whole job is seeing real ones (the
  // countFb two-ledgers law, applied to R1 accounting)
  if (!ctx || c === ctx) nodeStats.created++;
  return node;
}
// TRI-STATE, NOT POISON — the assets.js decode law, applied to the synth
// pool: a transient wasm/meta/preset fetch drop must not downgrade the
// signature synth to its fallback for the whole session. The first failure
// leaves the key ABSENT (the next ensureAssets pass — every song change,
// every transport start — re-requests it); only MAXRUNS failures write the
// final null that loadSynth/ensureAssets short-circuit on.
const SYNTH_MAXRUNS = 2;
const synthFails = new Map();                     // key -> runs
export async function loadSynth(spec, v, chan) {
  const key = synthKey(spec, v);
  if (synthNodes.has(key)) { routeSynth(key, synthNodes.get(key), chan); return synthNodes.get(key); }
  try {
    const node = await makeSynthNode(ctx, spec);
    synthNodes.set(key, node);
    synthFails.delete(key);
    // the node never touches a channel directly — it fans out through the
    // per-channel gates above, which is what keeps one node serving nine
    // sections. A node loaded before any channel exists is PARKED, not wired
    // to the master bus: the old `connect(bus)` fallback left every live
    // synth voice sounding dry at unity forever — outside the section's
    // inserts, sends, level and pan, and DOUBLED once the channel copy opened.
    // playSynth opens the route on the first note instead.
    if (chan) routeSynth(key, node, chan);
    return node;
  } catch (e) {
    const runs = (synthFails.get(key) || 0) + 1;
    synthFails.set(key, runs);
    if (runs >= SYNTH_MAXRUNS) synthNodes.set(key, null);   // now, and only now, final
    return null;
  }
}
// a synth key whose load FINALLY failed (tri-state null, both runs spent).
// The scheduler asks before falling anywhere else: a synth-identity genre has
// no legitimate second voice — its identity IS the synthesis — so its notes
// are DROPPED, not beeped. Silence over wrongness is the same law the sampled
// path has always kept ("a note whose instrument is still in flight is
// DROPPED"); the per-genre RMS gate is what catches sustained silence.
export const synthDead = (spec, v) =>
  synthNodes.has(synthKey(spec, v || 0)) && synthNodes.get(synthKey(spec, v || 0)) === null;
// observability for the drops the law produces — NOT gated like __nuFallback
// (a transient fetch failure on a loaded box may drop a few notes and that is
// the design working); it exists so a real coverage hole is diagnosable.
window.__nuDropped = 0;
export const countDrop = () => { window.__nuDropped++; };
export function playSynth(spec, midi, when, durSec, acc, sld, vel, v, chan, vox) {
  const key = synthKey(spec, v || 0), node = synthNodes.get(key);
  if (!node) return false;
  const g = routeSynth(key, node, chan);
  // open this note's own route AT the note. focusSynths opens the section's
  // routes on the bar it starts, but a synth that finished loading mid-section
  // was routed with its gate still at zero and stayed silent until the next
  // section — and with the parked pool (no bus fallback) silence would be
  // the only sound it ever made. Idempotent: re-opening an open gate is a
  // no-op, and a gate focusSynths closes later carries the later timestamp.
  if (g) { try { g.gain.setTargetAtTime(1, when, 0.004); } catch (e) {} }
  // a note the voice cannot say in any octave is DROPPED and counted, not
  // clamped onto the ceiling — driveSynth refuses before it writes
  if (!driveSynth(node, spec, midi, when, durSec, acc, sld, vel, vox)) {
    countDrop();
    return true;                                  // handled: silence, on purpose
  }
  return true;
}
// A NORMALIZED POSITION, BOTH WAYS, against a param's OWN declared range —
// lifted out of the VOX loop below so the velocity term reads the identical
// curve rather than a second copy of it (cutoff is heard in octaves, so `log`
// interpolates in octaves; the value can never land on a boundary, which is
// the clamp the audio gate exists to catch).
const clamp01 = t => (t < 0 ? 0 : t > 1 ? 1 : t);
const posVal = (a, t, log) => {
  const lo = a.minValue, hi = a.maxValue;
  const nv = log && lo > 0 ? lo * Math.pow(hi / lo, t) : lo + t * (hi - lo);
  return Math.max(lo, Math.min(hi, nv));
};
const valPos = (a, v, log) => {
  const lo = a.minValue, hi = a.maxValue;
  if (!(hi > lo) || v == null || !isFinite(v)) return 0;
  return clamp01(log && lo > 0 && v > 0
    ? Math.log(v / lo) / Math.log(hi / lo) : (v - lo) / (hi - lo));
};
// HOW FAR VELOCITY MOVES EACH KNOB, in fractions of that knob's whole declared
// range, per unit of velU. The two classic routings and only those: harder is
// brighter (cut) and harder swings the envelope further (emod). `dec` is
// deliberately not here — a note's decay is a function of how long it is held,
// and having velocity fight the articulation would be a second dynamics
// argument rather than a second kind of dynamics.
const VELKNOB = { cut: 0.20, emod: 0.10 };
// THE VOICE KNOBS, applied generically. A chip carries a NORMALIZED position, not
// a number in Hz, so the same "bright" means bright on a 303 (cutoff 60..6000),
// on a Model D (60..16000) and on a reese (60..6000) without a per-synth table —
// and because the value is derived from the param's OWN declared range it can
// never land on a boundary, which is the clamp the audio gate exists to catch.
// (cutoff is heard in octaves, so it is interpolated in octaves — `log` above;
// the first param name the DSP actually owns wins, and a DSP that owns none of
// them, like the DX7, is simply left alone.)
// Every voice takes freq/gate/level the same way; the rest is per-DSP and is
// declared in the genre, so adding a synth is a data change rather than code.
//
// the parameter walk alone, on a GIVEN node — split from the pool lookup so
// the offline bounce can drive its own per-context pool through the exact
// same writes (a forked copy of this walk is how the bounce would drift out
// of tune with the live pass, one edit at a time). THREE CALLERS NOW: the
// signature pool (playSynth), the impersonated GM patches (transport.js
// synthForInstr) and the pitched stand-in (line, below), so velocity means one
// thing on this page whichever of the three is holding the note.
export function driveSynth(node, spec, midi, when, durSec, acc, sld, vel, vox) {
  // FOLD FIRST, AND REFUSE BEFORE WRITING ANYTHING. A Faust freq param has a
  // declared min/max — DX7 stops at 1000 Hz, bass_reese at 500 — and setting a
  // value past it does not error, it CLAMPS, so every note above the ceiling
  // collapses onto the same pitch. That is not "a bit high", it is out of tune,
  // and the audio gate fails on a write that lands ON a boundary for exactly
  // that reason. Fold by octaves (pitch class kept, register moved); if no
  // octave fits, follow the DROP LAW the sampled path keeps — write nothing,
  // return false, let the caller count it — rather than write the clamp.
  const fa = node.parameters.get("/" + spec.root + "/freq");
  let f = hz(midi);
  if (fa) {
    while (f > fa.maxValue && f / 2 >= fa.minValue) f /= 2;
    while (f < fa.minValue && f * 2 <= fa.maxValue) f *= 2;
    if (f > fa.maxValue || f < fa.minValue) return false;
  }
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
      set(name, posVal(a, def.t[val], def.log), when);
      break;
    }
  }
  // ---- AND THE HAND, on the same knobs ------------------------------------
  // THE SECOND KIND OF DYNAMICS, synth side. A Faust voice already owns the
  // two params a keyboard's velocity has been wired to since the CS-80 — the
  // filter cutoff and the envelope's modulation amount — so the treatment is
  // not a new mechanism, it is the VOX vocabulary read one term further along:
  // the same VOXPARAM name search, the same normalized position against the
  // param's OWN declared range, the same log interpolation for a cutoff heard
  // in octaves. Nothing is hardcoded in Hz, so a 303 (cutoff 60..6000), a
  // Model D (60..16000) and a reese all move by the same musical amount, and a
  // DSP that owns neither param (the DX7) is left alone exactly as a chip
  // leaves it alone.
  //
  // The BASE position is whatever the note would already have had — the
  // section's chip if one is set, else the genre's own `set`, else the param's
  // declared default — inverted back onto 0..1 so the velocity term is an
  // offset rather than a replacement. u === 0 writes nothing at all.
  const uv = FLATVEL ? 0 : velU(vel);
  if (uv) {
    dynStats.synth++;
    for (const k of Object.keys(VELKNOB)) {
      const def = VOX[k];
      for (const name of (VOXPARAM[k] || [])) {
        const a = node.parameters.get("/" + spec.root + "/" + name);
        if (!a) continue;
        const chip = vox && vox[k] != null ? def.t[vox[k]] : null;
        const t0 = chip != null ? chip
          : valPos(a, (spec.set && spec.set[name] != null) ? spec.set[name] : a.defaultValue, def.log);
        set(name, posVal(a, clamp01(t0 + VELKNOB[k] * uv), def.log), when);
        break;
      }
    }
  }
  set("accent", acc ? 1 : 0, when);
  set("slide", sld ? 1 : 0, when);
  const lvl = spec.level * (0.25 + 0.75 * ((vel == null ? 5 : vel) / 9));
  set("level", lvl, when); set("gain", Math.min(1, lvl), when);
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
    const m = synthOut.get(k);
    synthNodes.delete(k); synthOut.delete(k);   // the pool forgets it NOW…
    retireSynth(node, m);                       // …the audio thread lets go gently
  }
}
// RAMP, WAIT, DISCONNECT, DESTROY — the shipped ZERO-STATIC Stage 0.A shape.
// disconnect() alone is the zombie-worklet bug: a disconnected Faust node
// keeps computing every 128-sample block forever, invisible to any node
// count, so a session spent auditioning fourteen genres accumulates silent FM
// operators that cost exactly as much as sounding ones. destroy() actually
// frees the DSP. The 700 ms deferral (behind a ~30 ms gain ramp) is so a note
// still ringing through the route dies as a fade rather than a mid-sample cut.
function retireSynth(node, routes) {
  const t = ctx.currentTime;
  if (routes) for (const g of routes.values())
    try { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.008); } catch (e) {}
  setTimeout(() => {
    if (routes) for (const g of routes.values()) { try { g.disconnect(); } catch (e) {} }
    if (node) {
      try { node.disconnect(); } catch (e) {}
      try { if (node.destroy) { node.destroy(); nodeStats.destroyed++; } } catch (e) {}
    }
  }, 700);
}
// every per-channel route gate, dropped — the mixer calls this when it drops
// the channels themselves, so no gain node outlives the channel it fed.
// Same law as retireSynth: the map forgets immediately (fresh routes rebuild
// on the next bar), the disconnect waits out the ramp.
// `at` (default now) delays the fade — a route dropped because its channel is
// being REPLACED must let already-scheduled synth notes ring until the new
// channel takes over at the bar line (mixer.retireChannel's law, same clock)
function retireGains(gains, at) {
  const t = ctx ? ctx.currentTime : 0, t0 = Math.max(t, at || t);
  for (const g of gains) try { g.gain.cancelScheduledValues(t0); g.gain.setTargetAtTime(0, t0, 0.008); } catch (e) {}
  setTimeout(() => { for (const g of gains) { try { g.disconnect(); } catch (e) {} } },
             (t0 - t) * 1000 + 700);
}
// BOTH POOLS' ROUTES. The stand-in voices below fan out per channel exactly as
// the signature pool does, so a dropped channel has to take their gains with it
// too — a route left pointing at a retired strip is a gain node holding a dead
// desk alive, which is the leak this pair of calls exists to prevent.
export function clearRoutes() {
  for (const map of [synthOut, standInOut]) for (const m of map.values()) {
    retireGains([...m.values()]);
    m.clear();
  }
}
export function dropRoute(chanKey, at) {
  for (const map of [synthOut, standInOut]) for (const m of map.values()) {
    const g = m.get(chanKey);
    if (g) { retireGains([g], at); m.delete(chanKey); }
  }
}

/* ---------- the sampled players ---------- */

// ==== THE INSTRUMENT-REGISTER LAW ==========================================
// The parent states it in two tiers (state-engine.js): a MUSICAL window per
// instrument (a flute does not play below middle C), and a TECHNICAL one from
// the sample's own zone roots (a zone stretched more than six semitones up
// shrieks and more than twelve down rumbles — it stops being the instrument).
// A note outside either octave-FOLDS in: whole octaves, so the pitch class and
// therefore the key survive, and only the register moves.
//
// nukernel needed both and had neither. foldToZones below folds into the zones'
// declared lo..hi span, and the shipped registry declares those spans as 0..127
// — every zone claims the whole keyboard — so the fold never fired and the
// sampler played whatever it was handed at whatever rate that took. Measured on
// the shipped table: sludge asks its overdrive guitar for MIDI 12 against a
// bottom zone ROOT of 40 (a guitar played two and a half octaves down), ska
// asks its trumpet for 98, trap asks a music box for 56. That is the "stretched
// sample" this law exists to stop.
//
// playWindow is the two tiers intersected. Where they disagree the SAMPLE wins:
// a window the zones cannot honestly cover is a promise the page cannot keep.
// An instrument with no musical range AND no multisample has NO window at all
// and passes through untouched — the parent's law for the unlisted.
const ROOT_SPAN_MIN = 24;                         // below this, roots say nothing
// KEYED ON THE SPEC OBJECT, not on the id: assets.js memoises one spec per
// FONT|id, so the identity is both stable and font-correct — a soundfont swap
// hands out different spec objects with different roots, and a cache keyed on
// the name alone would answer the old font's window for the new font's zones.
const winCache = new WeakMap();                   // spec -> [lo, hi] | null
export function playWindow(spec, id) {
  if (!spec || !spec.zones || !spec.zones.length) return null;
  const key = spec;
  let w = winCache.get(key);
  if (w !== undefined) return w;
  let bot = Infinity, top = -Infinity;
  for (const z of spec.zones) { if (z.root < bot) bot = z.root; if (z.root > top) top = z.root; }
  // A SAMPLER'S ROOTS ONLY BOUND IT IF IT IS MULTISAMPLED. Measured on the
  // shipped registry the split is total: every real multisample spreads its
  // roots over 24 semitones or more (guitars 39, choirs 42, pianos 82), and the
  // synth patches — polysynth, halo_pad, metal_pad, the drawbar organ — are ONE
  // zone with one root at 84 or 96, meant to be transposed anywhere. Reading
  // those roots as a window says a pad may only play its top octave and a half,
  // which would have shoved ambient, techno and synthpop up three octaves. A
  // patch that is stretched by design is not stretched past honesty.
  const w0 = (top - bot >= ROOT_SPAN_MIN) ? [bot - STRETCH_DOWN, top + STRETCH_UP] : null;
  w = w0;
  const R = RANGES[id];
  if (!w0) { w = R ? [R[0], R[1]] : null; winCache.set(key, w); return w; }
  if (R) {
    const lo = Math.max(w[0], R[0]), hi = Math.min(w[1], R[1]);
    // an octave is the floor: a window narrower than twelve semitones cannot
    // hold every pitch class, so the fold would start refusing notes in key.
    // Where the two tiers leave less than that (or nothing at all — a one-zone
    // sampler whose single root sits outside the instrument's musical range),
    // the ZONE window stands alone. The sample is the truth about what can
    // actually be played.
    if (hi - lo >= 12) w = [lo, hi];
  }
  winCache.set(key, w);
  return w;
}
// fold by whole octaves into [lo,hi]; null when no octave lands inside (a
// window narrower than an octave that the note keeps missing) — the caller
// then follows the DROP LAW rather than playing it wrong.
export function foldInto(midi, lo, hi) {
  let m = midi;
  while (m > hi + 0.5) m -= 12;
  while (m < lo - 0.5) m += 12;
  return (m > hi + 0.5 || m < lo - 0.5) ? null : m;
}
// THE EDGES ARE HARD, the parent's own law (state-engine.js foldToRange folds
// at the bound plus half a semitone of float tolerance, nothing more). This
// tier shipped one release with a six-semitone "soft edge" — the theory being
// that a note spilling just over the ceiling belongs to its phrase's contour —
// and the soft edge turned out to be exactly where the squeak lives: ska's
// trumpet line straddles its window, the register home of that era never
// fired, and the spill sustained up to MIDI 90 against a table ceiling of 84
// ("the ska trumpet is squeaky", 2026-08-16). The ceiling is set a little
// under the physical extreme BECAUSE that is where the shriek starts; a grace
// zone above it un-sets it. Contour is the register home's job (transport.js,
// now at the parent's eager REGISTER_FIT); what still lands here folds, and a
// folded ornament is voicing idiom, not a contour break (csd-engine.js
// REGISTER HOME pass 2).
// the whole law for one note, as one call — shared by the sampled player and
// the transport's register-home pass so the two can never disagree
export function inRange(spec, id, midi) {
  const w = playWindow(spec, id);
  return w ? foldInto(midi, w[0], w[1]) : midi;
}

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
// ---- GRIT + TREMOLO, for vocals and horns ----------------------------------
// Paul: "Add grit and tremolo to vocals and horns." Two families get a chair
// of their own — STRIPS.vox and STRIPS.brass, the same identity check the
// dyn shelf below already trusts for STRIPS.pad — built ONCE per voice
// (graph.js buildVoiceChair: the per-voice effect chain) and reused for
// every note that voice plays, so the cost is one WaveShaper and two Gains
// per VOX OR BRASS CHAIR on the page, not per note: a composed song rarely
// carries more than one or two of either, against the 195-per-song
// throwaway-node pattern graph.js's own CPU note measures and warns against.
//
// THE AMOUNT IS TWO NUMBERS, one per family, not a per-genre dial — nothing
// that reaches this file names a genre (playSampled only ever sees the
// resolved sample id and the family strip it already carries, same as
// instruments.js DYN above it). What still makes a crooner and a hard-blown
// horn line read as different amounts of the same two controls is the note
// underneath: grit reads THIS note's own velocity (below), and a genre's
// phrase writes that velocity — kernel.js stress/touch, `artic`, `anchor` —
// long before any of this file sees it. A held, legato vocal line grits
// little because its notes rarely leave the default velocity; a hammered,
// accented one grits hard because its notes do. The two numbers below are
// the CEILING each family can reach, not the amount either always gets.
// EXPORTED alongside the players, not because anything else in the app calls
// them (only playSampled below does) but because a Float32Array curve and an
// oscillator's own frequency are the artifact — test/unit/nukernel.test.js
// §69 reads these back rather than keeping a second copy of the numbers.
// PULLED WAY BACK (Paul, 2026-08-17, listening on staging: "The tremolo is
// super fast and a bit much -- slower, and much less of it"). It was 5.4 Hz at
// 0.09 on the voice and 4.6 at 0.06 on the horn. 5.4 is inside the range a real
// singer's vibrato occupies, which is exactly why it read as WRONG rather than
// as fast: paired with a depth that deep, and with the second oscillator
// detuned 8.7% against it (graph.js breathLFO), the two beat against each other
// and the result is a wobble with a rate of its own — a chorus effect wearing a
// vibrato's clothes. So the rate comes down below the beating range and the
// depth comes down further than the rate does: breath you notice only when it
// stops, which is what it was for.
export const VOICEFX = {
  // a held, breathy voice: grit stays a small edge, the vibrato only leans
  vox:   { grit: 0.14, drive: 2.4, tremHz: 3.2, tremDepth: 0.035 },
  // a blown horn: more edge when it is pushed, and less wobble than the voice
  brass: { grit: 0.20, drive: 2.8, tremHz: 2.8, tremDepth: 0.025 },
  // THE SUNG VOICE: the same edge, and NO LFO AT ALL. Paul, hearing the stack:
  // "Explain your vocal chain it sounds almost like an LFO is layered over it."
  // It was one, and layered is the exact word — graph.js breathLFO is TWO sines
  // at hz and hz*1.087, so the tremolo carries a beat of its own at 8.7% of its
  // rate, and that beat is what a listener hears as a second, unrelated thing
  // riding the voice. On a horn that reads as breath, because a sampled horn
  // has no amplitude story of its own. Espeak output DOES: real speech already
  // arrives with its own contour, so modulating it again lays one envelope over
  // another and the ear separates them. The grit stays — that is the edge a
  // pushed voice has, and it is not periodic.
  sing:  { grit: 0.14, drive: 2.4, tremHz: 3.2, tremDepth: 0 },
};
// WHICH FAMILY, if either — the strip IS the family (instruments.js hands out
// one shared STRIPS object per family), so this is a lookup and not a second
// classifier reading the id's name.
export const voiceFamily = strip =>
  strip === STRIPS.vox ? "vox" : strip === STRIPS.brass ? "brass" : null;
// ONE CHAIR PER (channel, address), keyed on the CHANNEL OBJECT so a dropped
// channel drops its chairs with it — no cleanup call this file would have to
// remember to make, the same law focusSynths/pruneSynths keep for the synth
// pool's own per-channel routes, applied to a WeakMap instead of a retire
// call because there is no per-note event that tells this file a channel died.
const voiceChairs = new WeakMap();             // chan -> Map(addr -> chair)
export function voiceChairFor(chan, addr, fam, dest) {
  let m = voiceChairs.get(chan);
  if (!m) voiceChairs.set(chan, m = new Map());
  let ch = m.get(addr);
  if (ch) return ch;
  const F = VOICEFX[fam];
  // A NET, NOT A WORKAROUND ANY MORE. breathLFO's cache used to be keyed on
  // the RATE alone, so the second OfflineAudioContext of a page's life was
  // handed the first one's oscillators and `.connect()` threw — which this
  // catch turned into a voice with no grit and no tremolo, silently, on the
  // TAPE (the audible path on a phone) while the live graph kept both. That
  // cache is now per context (graph.js breathLFO, 2026-08-17) and the throw
  // is gone. The guard stays because the law it keeps is the right one for
  // any future failure down there: `dest` is exactly what an untreated note
  // already connects to, so a chair that cannot be built loses its own
  // treatment rather than taking the whole render down.
  try {
    ch = buildVoiceChair(ctxOf(chan), F.grit, F.drive, F.tremHz, F.tremDepth, dest);
  } catch (e) {
    ch = { in: dest, out: dest };
  }
  m.set(addr, ch);
  return ch;
}
export function playSampled(id, midi, when, durSec, vel, gainMul, chan, strip, v, part) {
  const spec = specOf(id);
  // THE VOICE'S OWN CHAIR, when the caller has one. Each pitched voice has its
  // own player onto its own placed bus (mixer.buildChannel voiceBus), so two
  // voices are two places in the room; the bass and anything without a chair
  // name their PART instead (`part`, e.g. "bass") and get that strip's player.
  // Neither exists -> the channel-wide player, which is where everything went
  // before the desk did.
  const V = v != null && chan && chan.voiceBus ? chan.voiceBus(v) : null;
  // …and WHERE that player taps. Every player the mixer builds is a closure
  // over one node (dry === rev === del === the chair's, the part's or the
  // section's input), and the per-note shelf below has to go in front of that
  // exact node, so the two are chosen together rather than looked up twice.
  let player = null, dest = null;
  if (V && V.player) { player = V.player; dest = V.in; }
  else if (part != null && chan && chan.partPlayer && chan.partPlayer(part)) {
    player = chan.partPlayer(part); dest = chan.partIn(part);
  } else if (chan && chan.player) { player = chan.player; dest = chan.input; }
  if (!spec || !player) return false;
  // GRIT + TREMOLO: vox and brass reach through their own chair before
  // anything else touches `dest` — the shelf below, when it builds one, has
  // to sit in FRONT of the chair (bright first, then the edge) so the two
  // features compose the way a real strike into a driven amp does.
  const fam = voiceFamily(strip);
  if (fam && chan) {
    const addr = v != null ? "v" + v : "p:" + part;
    dest = voiceChairFor(chan, addr, fam, dest).in;
  }
  // THE INSTRUMENT-REGISTER LAW (playWindow above): fold into the window the
  // instrument and its samples can both honestly play. This replaces the old
  // fold into the zones' DECLARED lo..hi span — which the shipped registry
  // declares as 0..127, so it never fired and a note two octaves under the
  // bottom root played as a two-octave-slow sample rather than as a guitar.
  // foldToZones still runs underneath as the last technical net (a font whose
  // zones really are bounded).
  let midi2 = inRange(spec, id, midi);
  // THE DROP LAW. No octave of this note lands inside the window, so there is
  // no honest way to play it: be silent, and COUNT it. The same law the page
  // already keeps for a dead signature synth and an in-flight zone — silence
  // over wrongness — and the same reason: a stretched sample is not the
  // instrument, it is a different instrument that is out of tune with the rest.
  if (midi2 == null) { countDrop(); return true; }
  midi2 = foldToZones(spec.zones, midi2);
  // PASS THE VELOCITY, EVEN THOUGH IT CHANGES NOTHING TODAY. sampler.js's
  // zoneFor(zones, midi, vel) picks a velocity LAYER, and its own comment
  // records the measured bug where a mix-staged gain capped that velocity at 61
  // over 10,109 notes and made every forte sample unreachable. So the number
  // handed over is the MUSICAL one and never a mix gain, and it is converted by
  // the parent's OWN selVel rather than by a second round(127*x) here — that
  // function is documented as "the ONE formula both engines use to pick a
  // velocity layer", and a third copy of it is exactly the drift it was written
  // to end. Our scale is 0..9 with the default at 5, so full scale is 9.
  //
  // Every zone in the shipped registry declares one layer (no vlo/vhi over 629
  // of them), so this is byte-identical now; the audible half is the shelf
  // below. WHEN A LAYERED FONT DOES LAND this argument is necessary and not
  // sufficient: assets.js specOf copies file/root/lo/hi/loop/ls/le off a zone
  // and would drop vlo/vhi on the floor before zoneFor ever saw them.
  const z = SP.zoneFor(spec.zones, midi2,
                       SP.selVel((vel == null ? VEL_MID : vel), VEL_TOP));
  if (!z) { countDrop(); return true; }
  const buf = zoneBufs.get(FONT + "|" + id + "|" + z.file);
  if (!buf) return inFlight.has("ins:" + id);      // loading: drop it, do not beep
  const lead = SP.zoneLeadIn ? SP.zoneLeadIn(buf, z, buf.sampleRate, spec.sr) : 0;
  const leadSec = lead ? lead / (buf.sampleRate || spec.sr) : 0;
  // ---- THE SECOND KIND OF DYNAMICS, sampled side --------------------------
  // `pad` is not an argument here, but the STRIP already carries the answer:
  // stripFor returns STRIPS.pad for a pad and only for a pad, so reading it off
  // the strip is exact and keeps one definition of "is this a pad" instead of
  // threading a second flag down from the scheduler.
  const dyn = (FLATVEL || !dest) ? null : dynFor(id, strip === STRIPS.pad);
  const u = dyn ? velU(vel) : 0;
  const c = ctxOf(chan);
  let atk = DYN_ATK, offsetSec = leadSec, note = player, filt = null;
  if (u) {
    dynStats.shaped++;
    const cv = dynCurve(u, dyn);
    // ONE BIQUAD, ALIVE FOR ONE NOTE, AND ONLY WHEN THE NOTE ASKED FOR IT.
    // That is the whole per-note budget of this feature: a high shelf, hinged
    // where this instrument's brightness starts, whose GAIN is the velocity
    // (instruments.js dynCurve — negative below the default, positive above,
    // exactly 0 dB at it). A shelf rather than a corner because a lowpass
    // anchored at bypass has nowhere to go on the loud half; see the
    // measurement recorded beside DYN.
    const f = c.createBiquadFilter();
    f.type = "highshelf"; f.frequency.value = dyn.corner;
    f.gain.setValueAtTime(cv.peakDb, when);
    // …AND THE STRIKE ON TOP OF IT. A hard note's onset is brighter than its
    // own body and settles into it; that settling IS the transient, and it is
    // the half a static shelf cannot say. Never longer than the note itself —
    // a 160 ms settle on a 40 ms sixteenth is not an envelope, it is a second
    // tone. Skipped outright when there is no bite to settle from (every note
    // at or below the default), so a soft note is one setValueAtTime.
    if (cv.peakDb !== cv.db)
      f.gain.linearRampToValueAtTime(cv.db,
        when + Math.max(0.008, Math.min(dyn.dec, durSec * 0.6)));
    f.connect(dest);
    filt = f;
    // A THROWAWAY PLAYER, and why it is not a change to sampler.js: SamplerLive
    // is a CLOSURE over three destination nodes fixed at construction (measured:
    // an object and a Set, zero AudioNodes), and the shelf has to be per NOTE.
    // Building one here puts the shelf in front of the real tap without forking
    // the parent's note() — which owns the envelope, the loop points, the strip
    // and the decoder lead-in, and is the last thing that should exist twice.
    try { note = SP.SamplerLive(c, { dry: f, rev: f, del: f }); }
    catch (e) { note = player; filt = null; try { f.disconnect(); } catch (e2) {} }
    if (note !== player) {
      // THE FRONT EDGE, which costs nothing at all: two numbers handed to the
      // envelope note() was going to build anyway. A harder note arrives faster
      // (the amp attack halves toward sampler.js's own 3 ms floor), and `hand`
      // says how much of this instrument is the strike at all — a string
      // section barely moves, a marimba is all edge.
      atk = cv.atk;
      // …AND THE SAMPLE'S OWN HEAD. Most of what a struck note sounds like is
      // the first few milliseconds, and a recorded one usually opens with a
      // soft ramp into them; skipping that ramp on a hard hit is the cheapest
      // honest transient there is. NOT added to the loop points below — the
      // decoder lead-in is a correction that head and loop must share
      // (sampler.js zoneLeadIn), this is a musical start offset, and shifting
      // the loop with it would detune the wrap.
      offsetSec = leadSec + Math.min(cv.skip, Math.max(0, buf.duration - leadSec - 0.02));
    }
  } else {
    if (dyn) dynStats.flat++;
    // NO SHELF WAS BUILT, but a vox/brass note must still reach its chair.
    // The persistent `player` this branch would otherwise fall back to was
    // wired by the mixer straight onto the channel bus, before this chair
    // existed — so it is exactly as blind to `dest` moving as sampler.js
    // itself is, and the same throwaway-player trick above is the fix.
    if (fam) {
      try { note = SP.SamplerLive(c, { dry: dest, rev: dest, del: dest }); }
      catch (e) { note = player; }
    }
  }
  // ---- AN ORNAMENT MUST NOT OUTLAST ITSELF --------------------------------
  // The release was a flat 120 ms, which is right for every note this machine
  // could make until the ninth type landed (kernel.js ORNAMENTS): a grace note,
  // a flam stroke and one stroke of a ratchet are 30-60 ms, and a 120 ms tail
  // on a 40 ms note is a note whose fade is three times its body. Four of them
  // in front of one beat is not a flourish, it is a chord of the same pitch —
  // measured on paper before it was written: at rate 8 a roll of four inside a
  // sixteenth puts its strokes 31 ms apart under a 120 ms fade, so all four are
  // still sounding when the beat arrives.
  //
  // So a note shorter than the release gets a release no longer than itself,
  // floored at 20 ms so it is a fade and not a click. NOTHING ELSE MOVES: the
  // threshold is 60 ms, and at any tempo this machine plays, nothing but an
  // ornament is that short — a sixteenth at 200 bpm is still 75 ms.
  const rel = durSec < 0.06 ? Math.max(0.02, durSec) : 0.12;
  note.note(buf, when, {
    rate: SP.rateFor(z, midi2), durSec,
    gain: 0.42 * (0.2 + 0.8 * ((vel == null ? 5 : vel) / 9)) * (gainMul || 1),
    // THE STRIP IS WHERE THE MIX HAPPENS. sampler.js builds it — the same node
    // chain the big engine's live path builds from the same spec.
    strip,
    // the sends are the SECTION's, not the note's: every tap goes to the channel
    // input and the channel decides how wet the whole box is
    atk, rel, dry: 1, rsend: 0, dsend: 0,
    offsetSec,
    loop: !!z.loop,
    loopStartSec: (z.loopStart || 0) / spec.sr + leadSec,
    loopEndSec: (z.loopEnd || 0) / spec.sr + leadSec });
  // LET GO WHEN THE NOTE DOES. ZERO-STATIC's law is destroy, never
  // disconnect-and-forget — but that law is about a Faust worklet, which
  // computes every 128-sample block forever whether or not anything feeds it. A
  // BiquadFilter has nothing to destroy and computes nothing once its input is
  // gone, so a disconnect is the whole of it. SamplerLive registers the note's
  // own source in `live.active` (that is what its stopAll walks) and adds it
  // LAST, after any strip LFOs, so on a player holding exactly this one note
  // the last member is the source.
  //
  // …AND NOT ONE MOMENT BEFORE. sampler.js defers its own strip teardown by
  // stripTailN when the strip carries a delay, precisely so the echoes are not
  // truncated at note end — and this shelf is DOWNSTREAM of that strip, so
  // dropping it on `ended` would cut the tail the parent went to the trouble of
  // keeping. Measured today the answer is zero (no nukernel strip declares a
  // `delay`, so the wait is the parent's own 50 ms and nothing more), which is
  // exactly why it is asked rather than assumed: the first delay strip anyone
  // writes must not silently lose its echoes.
  //
  // ON THE LIVE CONTEXT ONLY, the countFb two-ledgers law applied to teardown:
  // an OfflineAudioContext is thrown away whole the moment its render resolves
  // (audio/bounce.js), so there is nothing there to release and a wall-clock
  // timer per note of a two-minute tape is pure overhead in the one place that
  // is racing a deadline.
  if (filt && (!ctx || ctxOf(chan) === ctx)) {
    const src = [...note.active].pop();
    if (src && src.addEventListener) {
      const sr = ctxOf(chan).sampleRate || 44100;
      const tail = SP.stripTailN ? SP.stripTailN(strip, sr) / sr : 0;
      src.addEventListener("ended", () =>
        setTimeout(() => { try { filt.disconnect(); } catch (e) {} }, (tail + 0.05) * 1000));
    }
  }
  return true;
}
// EVERY NODE KNOWS ITS CONTEXT. The players below build their throwaway nodes
// on the CHANNEL'S context rather than the module-global live one — which is
// the whole trick that lets audio/bounce.js reuse them verbatim against an
// OfflineAudioContext: hand them an offline channel and they render offline.
const ctxOf = chan => (chan && chan.input ? chan.input.context : ctx);
// WHERE A DRUM LANDS. The channel builds a strip per lane on the lane's first
// hit — level, placement, its own share of the room — and everything drum-shaped
// on the page goes through it, the machines and the stand-ins included, so a
// stood-in snare is in the same room as a sampled one. A channel that predates
// the lane strips (or no channel at all) still has the plain drum bus.
// `kit` reaches the strip because the strip is per MIX ROW now: a machine
// lane with its own MACHINEMIX row lands on its own strip, a sampled lane on
// the shared one — instruments.js laneKey decides, inside the desk
const drumDest = (chan, lane, kit) => (chan && chan.laneIn ? chan.laneIn(lane, kit)
  : (chan && chan.drumIn) || bus);
// the lane's trim is the STRIP's job when there is a strip; without one it has
// to ride the hit, or a rim shot on the bare bus comes back at full level
const laneTrim = (chan, lane, kit) => {
  if (chan && chan.laneIn) return 1;
  const m = mixFor(kit, lane);
  return m && m.lvl != null ? m.lvl : 1;
};
export function playDrum(kit, lane, when, acc, vel, chan) {
  // THE MACHINES ARE THE PARENT'S MACHINES. tr808/tr909/tr606/cr78 are not
  // directories of recorded one-shots, and this page used to answer that by
  // synthesizing its own four boxes out of a bank of oscillators and playing
  // them as buffers — while the tape, which cannot see those buffers, played
  // the parent's kick_808 and kick909 for the same song and nothing at all for
  // the 606. Two drum machines, one score. So a machine kit now takes exactly
  // the voice audio/to-engine.js hands the record: same module, same decay,
  // same velocity scale, resolved from the same row.
  if (isMachine(kit)) return machineHit(kit, lane, when, acc, vel, chan);
  const buf = kit && drumBufs.get(kit + "|" + lane);
  // silence while the kit decodes — same law as ever: never a stand-in for a
  // kit that is on its way
  if (!buf) return !!kit && inFlight.has("kit:" + kit);
  const lvl = (vel == null ? 5 : vel) / 9;
  // A HIT AT ZERO IS A HIT. Returning false here reads to the scheduler as
  // "this kit could not play that lane", and the answer to that is a stand-in
  // voice — so a velocity-0 event, which the kit-velocity vectors and the
  // groove profiles both produce legitimately, came out as somebody else's
  // drum. Ten of them in one 45-genre sweep. Silence is a successful hit.
  if (lvl <= 0.001) return true;
  const c = ctxOf(chan);
  const src = c.createBufferSource(); src.buffer = buf;
  const g = c.createGain();
  const body = (acc ? 1 : 0.72) * (0.45 + 0.55 * lvl) * laneTrim(chan, lane, kit);
  // TRANSIENT SHAPING, per hit. A transient designer is two numbers — how much
  // louder the attack is than the body, and where the body settles — and on a
  // one-shot fired from a buffer they cost one extra ramp each rather than an
  // envelope follower and a worklet. `punch` puts the stick back on a snare
  // whose sample was normalised flat; `sus` under 1 shortens the tail, which is
  // what keeps hats and toms tight in a room that is now genuinely wet. (Only
  // the recorded kits reach this: a machine's hits are modules, with their own
  // attacks, and they went past on the branch above.)
  const m = mixFor(kit, lane) || { punch: 1, sus: 1 };
  const punch = m.punch != null ? m.punch : 1, sus = m.sus != null ? m.sus : 1;
  if (punch !== 1 || sus !== 1) {
    g.gain.setValueAtTime(body * punch, when);
    g.gain.linearRampToValueAtTime(body, when + DRUMBUS.punchMs);
    if (sus !== 1)
      g.gain.linearRampToValueAtTime(body * sus, when + DRUMBUS.punchMs + DRUMBUS.susMs);
  } else g.gain.value = body;
  src.connect(g); g.connect(drumDest(chan, lane, kit));
  src.start(when);
  return true;
}

/* ---------- the stand-in voices are the engine's voices, counted ---------- */
export const hz = m => 440 * Math.pow(2, (m - 69) / 12);
// A note whose own instrument is not there — a zone that never decoded, a kit
// that is a directory nobody fetched, a genre naming a dsp nobody built — still
// has to come out of an instrument. Until today it came out of two oscillators
// and a biquad, and that is precisely the sound this page's own audio gate
// exists to fail on: a beep standing in for a Rhodes is not a degraded Rhodes,
// it is a beep, and a snare made of filtered noise is not a quiet snare.
//
// So the stand-in is the ENGINE's now. engine/faust/dist ships 175 precompiled
// worklets and the pool at the top of this file already loads them, so a
// pitched stand-in is `pad_saw` driven by the SAME driveSynth walk a signature
// synth takes, and a drum stand-in is the parent's own voice for that lane —
// the identical module engine/faust/voices/state-engine.js voiceUnits resolves
// at the default kit models, driven with the identical three params
// (level / decay / pitch) its mapEvents writes. Nothing here synthesizes.
//
// THE LEDGER SURVIVES THE REWRITE AND MEANS WHAT IT ALWAYS MEANT. It never
// counted oscillators; it counted NOTES THAT HAD NO INSTRUMENT, and a note
// that had no instrument is a coverage hole whether it beeps or plays a saw.
// test/browser/nukernel-audio.test.js still fails on any of them, which is
// right — the point of this rewrite is that the hole now sounds like music
// while you find it, not that the hole stopped mattering.
//
// TWO LEDGERS, one per context class. window.__nuFallback is the FROZEN gate
// contract and counts the LIVE page only; a fallback fired inside an offline
// bounce render is a fact about the bounce (its sampled-only degrade is
// allowed to be imperfect) and lands in offFallback, which __nuBounce reports
// — folding it into the live number would make the audio gate fail the live
// path for the carrier's sins.
window.__nuFallback = 0;
export const offFallback = { n: 0 };
const countFb = c => { if (!ctx || c === ctx) window.__nuFallback++; else offFallback.n++; };

// ---- the stand-in pool ------------------------------------------------------
// Keyed on the DESTINATION — a voice index, a part name, a drum lane — and not
// on the module, because the destination is what decides where the note lands:
// the chair's own bus, the part's strip, the lane's strip. One node per address,
// fanned out to every channel through a gain exactly as routeSynth does above:
// the worklet is expensive and channel-blind, the route is cheap and per
// channel. Same monophony law as the signature pool, too — a Faust mono dsp is
// mono, so an address is one line; two voices are two addresses.
//
// THE GATE OPENS AT THE NOTE AND SHUTS AFTER IT. focusSynths does that job for
// the signature pool on the bar a section starts; a stand-in note is a rare
// short event belonging to no section, so it opens its own door and closes it.
//
// LIVE CONTEXT ONLY, and said out loud rather than papered over: building a
// worklet is async and an OfflineAudioContext is scheduled and rendered in one
// synchronous pass (audio/bounce.js), so there is no moment in a render at
// which a node could arrive. An offline stand-in note is therefore SILENT and
// COUNTED — offFallback -> __nuBounce's `fallbacks` — which is the drop law
// this page already keeps everywhere else (silence over wrongness) and is
// visible in the readout rather than quietly beeped.
const standInNodes = new Map();                   // addr -> node | null (final)
const standInOut = new Map();                     // addr -> Map(chanKey -> gain)
const standInFails = new Map();                   // addr -> runs
const standInLoading = new Set();
async function loadStandIn(spec, addr) {
  if (standInLoading.has(addr)) return;
  standInLoading.add(addr);
  try { standInNodes.set(addr, await makeSynthNode(ctx, spec)); standInFails.delete(addr); }
  catch (e) {
    // the same tri-state as loadSynth: absent = retry on the next note, null =
    // final, so one flaky wasm fetch does not silence a lane for the session
    const runs = (standInFails.get(addr) || 0) + 1;
    standInFails.set(addr, runs);
    if (runs >= SYNTH_MAXRUNS) standInNodes.set(addr, null);
  }
  standInLoading.delete(addr);
}
function standIn(spec, addr, chan, dest, when, tail) {
  if (!standInNodes.has(addr)) { loadStandIn(spec, addr); return null; }   // in flight: drop it
  const node = standInNodes.get(addr);
  if (!node || !dest) return null;
  let m = standInOut.get(addr);
  if (!m) standInOut.set(addr, m = new Map());
  const ck = (chan && chan.key != null) ? chan.key : "-";
  let g = m.get(ck);
  if (!g) { g = ctx.createGain(); g.gain.value = 0; node.connect(g); g.connect(dest); m.set(ck, g); }
  // CANCEL THE PENDING CLOSE FIRST. Two hats a sixteenth apart both want this
  // door, and the first one's shut is scheduled a whole decay later — left
  // standing it would slam on the second note mid-ring. Each note therefore
  // withdraws whatever is scheduled from its own instant onward and writes its
  // own pair, so the door is open exactly as long as something is sounding.
  const t0 = Math.max(0, when - 0.002);
  try {
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(1, t0);
    g.gain.setValueAtTime(0, when + tail);
  } catch (e) {}
  return node;
}
// `tone` is nukernel's WebAudio voicing — one filter, one envelope, one gain —
// and every field of it has a pad_saw param. The two conversions that are not
// identity are the ones audio/to-engine.js toneRecipe already uses to say the
// same block to the same engine for the TAPE, so a stand-in note sounds the
// same on the page as it does on the record. `wave` has nowhere to go (pad_saw
// is saws) and `prev`/`sld` have nowhere either (the voice has no portamento,
// only freq's own si.smoo) — both are dropped here rather than approximated.
const toneSpec = (tone, padish, acc) => ({
  dsp: "pad_saw", root: "pad_saw",
  level: Math.min(1, Math.max(0.15, ((tone && tone.gain) || 0.26) * 2.2)),
  set: {
    cutoff: Math.min(12000, Math.max(80, ((tone && tone.cut) || 1400) * (acc ? 2.4 : 1))),
    res: Math.min(0.9, Math.max(0, (((tone && tone.q) || 0.7) - 0.7) / 12)),
    attack: Math.min(5, Math.max(0.005, (tone && tone.atk) || 0.01)),
    detune: padish ? 0.012 : 0.006,
  },
});
/* ---------- ONE DRUM, PLAYED TWICE ---------- */
// The twelve-lane table this file used to keep is gone: it named the parent's
// default modules and nothing else, so it could only ever play one kit, and the
// four machines went round it through a bank of oscillators. audio/to-engine.js
// drumVoice(kit, lane) is the table now — the one the record is cut from — and
// everything below is the WebAudio wiring for whatever it answers.
//
// The two numbers that have to be computed the same way or the page and the
// tape ring for different lengths:
//   DECAY   the parent's drum events carry `dur` in BEATS and its mapEvents
//           multiplies by the seconds-per-beat. So does this. A kick at 120 is
//           0.15 s of ring in both, and slowing the song lengthens it in both.
//   LEVEL   drumAmp(vel, acc) — to-engine's own velocity scale — times the
//           voice's level and the lane's gain, which is state-engine's
//           `u.lvl * d.amp` with the same terms in it.
const spbNow = () => 60 / (bpm || 120);
function drumNote(kit, lane, when, acc, vel, chan, count) {
  const V = drumVoice(kit, lane);
  // A LANE WITH NO PARENT VOICE IS NOT QUIETLY DROPPED. It falls through to the
  // ledger below (window.__nuFallback) and shows up in the readout, which is the
  // only honest answer: this page has no second drum engine to hide it in.
  if (!V) return false;
  const lvl = (vel == null ? 5 : vel) / 9;
  if (lvl <= 0.001) return true;                  // a hit at zero is a hit, and it is silence
  const c = ctxOf(chan);
  if (count) countFb(c);
  if (!ctx || c !== ctx) return true;             // offline: silent by law (see the note above)
  const spec = { dsp: V.module, root: V.module, level: 1, set: {} };
  const dec = Math.min(2, Math.max(0.05, V.durB * spbNow()));
  const node = standIn(spec, "d:" + (kit || "-") + ":" + lane, chan,
                       drumDest(chan, lane, kit), when, dec + 0.25);
  if (!node) return true;                         // the worklet is still building: silence, not a stub
  // state-engine mapEvents' own writes for a drum module, and only those:
  // level, decay, pitch (the tom's one knob) and tune (the kick's). The gate is
  // a button — impulsify wants an edge — so it is raised at the hit and dropped
  // a frame later.
  const set = (nm, v) => {
    const p = node.parameters.get("/" + V.module + "/" + nm);
    if (p) p.setValueAtTime(v, when);
  };
  set("level", Math.min(2, Math.max(0, drumAmp(vel == null ? 5 : vel, acc) *
      V.lvl * V.gain * laneTrim(chan, lane, kit))));
  set("decay", dec);
  if (V.pitch) set("pitch", V.pitch);
  if (V.tune !== 1) set("tune", V.tune);
  set("gate", 1);
  const gate = node.parameters.get("/" + V.module + "/gate");
  if (gate) gate.setValueAtTime(0, when + 0.02);
  return true;
}
// A MACHINE HIT IS NOT A FALLBACK. The 808 was always going to be a synthesized
// drum — that is what an 808 is — so it is the instrument, not a stand-in for
// one, and it must not move the ledger the audio gate reads.
const machineHit = (kit, lane, when, acc, vel, chan) =>
  drumNote(kit, lane, when, acc, vel, chan, false);
// WARMED BEFORE THE FIRST BAR, like a kit's fetch. A machine has nothing to
// decode, but its worklets still have to be built, and standIn drops a note
// whose node has not arrived — so audio/transport.js ensureAssets asks for the
// lanes a song can write, once, and kitReady says when to stop asking.
export function warmKit(kit) {
  const jobs = [];
  for (const lane of Object.keys(LANE)) {
    const V = drumVoice(kit, lane);
    if (!V) continue;
    const addr = "d:" + kit + ":" + lane;
    if (!standInNodes.has(addr))
      jobs.push(loadStandIn({ dsp: V.module, root: V.module, level: 1, set: {} }, addr));
  }
  return Promise.all(jobs);
}
export const kitReady = (kit) => isMachine(kit)
  ? Object.keys(LANE).every(l => !drumVoice(kit, l) || standInNodes.has("d:" + kit + ":" + l))
  : drumBufs.has(kit + "|k");
// WHERE A PITCHED SOURCE LANDS, the counterpart of drumDest above: a voice
// index takes its chair's strip, a string names a part outright ("bass"), and
// neither (or a channel from before the desk) is the section input.
const pitchDest = (chan, where) => {
  if (!chan) return bus;
  if (typeof where === "string" && chan.partIn) return chan.partIn(where);
  if (typeof where === "number" && chan.voiceIn) return chan.voiceIn(where);
  return chan.input || bus;
};
export function line(t, n, dur, acc, sld, prev, tone, padish, vel, chan, where) {
  const lvl = (vel == null ? 5 : vel) / 9;
  if (lvl <= 0.001) return;                       // a completed fade-out is silence
  const c = ctxOf(chan);
  countFb(c);
  if (!ctx || c !== ctx) return;                  // offline: counted above, silent by law
  const spec = toneSpec(tone, padish, acc);
  // ONE ADDRESS PER CHAIR — `where` is the voice index the caller was already
  // routing by, so two chairs standing in at once are two nodes and the
  // counterpoint survives, exactly as the signature pool's dsp#voice key does.
  const node = standIn(spec, "p:" + (where == null ? "-" : where), chan,
                       pitchDest(chan, where), t, dur + 0.3);
  if (!node) return;                              // in flight, or finally dead: drop it
  // the SAME parameter walk a signature synth takes — the fold-or-refuse law,
  // the velocity knobs, the gate pair. A stand-in that wrote its own would be a
  // second opinion about what velocity means.
  driveSynth(node, spec, n, t, dur, acc, sld, vel, null);
}
// THE KIT THAT DID NOT ARRIVE, counted. A recorded kit whose wavs never
// decoded still has to make a drum sound, and the honest one is the parent's
// own voice for that lane at the DEFAULT models — which is what a sampled kit's
// unit falls back to in the engine too when its sampler is missing. Same table,
// same call, one extra argument: this one moves the ledger, because a kit that
// did not arrive IS a coverage hole even when it sounds like a drum.
// A LANE THE TABLE CANNOT NAME lands in the ledger too, from here: drumNote
// refuses it rather than guessing, and a refusal that nobody counted would be
// the silent drop this file exists to make impossible.
export function hit(t, d, acc, vel, chan) {
  if (!drumNote(null, d, t, acc, vel, chan, true)) countFb(ctxOf(chan));
}
