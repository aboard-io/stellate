// bridge.js — THE APP/ENGINE BOUNDARY for the star-cruise controller.
//
// Everything the cruise READS from outside itself lives here, and nothing else
// does: the app's live store (window.__S), the engine globals (GenreKernel /
// GenreVerifier / CsdEngine), the two documented per-frame hooks (getTravel /
// getBeat) with their test injections, and THE SCORE BRIDGE — the cached per-bar
// note plan that turns each alien from a beat-keeper into a PLAYER of its part.
//
// It imports nothing from the app (no state.js, hence no preact/htm) — see the
// sanctioned-seam note in app/starcruise-load.js — and nothing from Three.js, so
// it is pure data: state in, per-frame musical facts out.
//
// CONTRACT (consumed by app/starcruise.js, ./scene.js, ./camera.js, ./probes.js)
//   getTravel() / getBeat()            the real hooks (docs/STARCRUISE.md)
//   injectTravel(o) / injectBeat(o)    the headless overrides (null in production)
//   buildEventPlan(genreOrWeights,seed)  build+cache the per-bar note plan
//   currentBar(bt) / barPhaseOf(bt) / ctxForVoice(v,bar,phase) / loudnessAt(bar)
//   currentFill() / injectFill(b)      the per-bar drum-FILL flag
//   rosterFor(traitsBand)              one band member per SOUNDING voice
//   getS / K / V / E / firstGenre / genreLabels / genreLabelOf

import { alienize } from "../map/glyphs.js";   // alien alphabet for cluster/genre labels

// LIVE STORE ACCESS — read the app's store LAZILY off the window global that
// app/core/state.js publishes (window.__S). We deliberately do NOT static-import
// state.js (nor share.js, which itself imports state.js): state.js eval-time
// imports preact+htm from esm.sh, so importing it would couple this
// self-contained, lazily-loaded star-cruise module to the esm.sh module graph and
// break offline/headless boot. window.__S may not exist yet at module-eval (or in
// a bare headless harness), so getS() falls back to a benign empty store that
// preserves the previous "no live weights" behavior.
const _emptyStore = { weights: [], waypoints: [], travel: { seg: 0, t: 0 } };
export const getS = () => (typeof window !== "undefined" && window.__S) || _emptyStore;

// pointOnPath: world position along the DRAWN travel path for a {seg,t} travel
// state. Inlined here (was imported from share.js) so star-cruise carries NO
// static dependency on share.js/state.js/esm.sh. Reads the live waypoints off the
// store lazily; matches share.js's implementation exactly.
function pointOnPath(travel) {
  const wp = getS().waypoints || [];
  const n = wp.length; if (n < 2) return null;
  const a = wp[travel.seg % n], b = wp[(travel.seg + 1) % n];
  return { x: a.x + (b.x - a.x) * travel.t, y: a.y + (b.y - a.y) * travel.t };
}

// engine globals live on window (loaded before app/main.js): K = GenreKernel,
// V = GenreVerifier. Read them lazily at trait time so this module loads even if
// they arrive a tick late.
export const K = () => window.GenreKernel;
export const V = () => window.GenreVerifier;
// E = window.CsdEngine — the SCORE BRAIN. E.buildEvents(state) returns the exact
// per-voice note/drum EVENT list the audio engine renders. The score-bridge below
// calls it ONCE per genre (on land) to build a cached per-bar note plan, then each
// frame hands every band member the real onsets of ITS voice for the current bar —
// so the aliens PLAY the score instead of just moving on the beat. READ-ONLY.
export const E = () => window.CsdEngine;

export function firstGenre() { try { return (window.GenreKernel && GenreKernel.GENRES) ? Object.keys(GenreKernel.GENRES)[0] : "vaporwave"; } catch (e) { return "vaporwave"; } }

// the genre list for the console display: prefer the kernel's genre labels.
export function genreLabels() {
  try {
    const G = window.GenreKernel && window.GenreKernel.GENRES;
    if (G) return Object.keys(G).map((g) => alienize((G[g] && G[g].label) || g));
  } catch (e) {}
  return ["vaporwave", "ambient", "techno"];
}
export function genreLabelOf(g) {
  if (!g) return null;
  try { const G = window.GenreKernel && window.GenreKernel.GENRES; return alienize((G && G[g] && G[g].label) || g); } catch (e) { return g; }
}

// ---- TEST INJECTION (production-null) -------------------------------------------
// The headless probe scripts a deterministic travel/beat stream to force a clean
// FLY->APPROACH->LAND->DANCE cycle (and to place the beatPhase exactly ON a hit).
// When both overrides are null — i.e. always, in production — getTravel/getBeat
// read the REAL app store below and behave exactly as before. Set via
// window.__STARCRUISE.__injectTravel / __injectBeat.
let _tvInject = null;   // a plain { weights, dominant, position, live, seed } or null
let _btInject = null;   // a plain { bpm, spb, cbeats, serial, beatPhase, playing } or null
export function injectTravel(o) { _tvInject = o || null; }
export function injectBeat(o) { _btInject = o || null; }

// ---- THE REAL HOOKS (documented in docs/STARCRUISE.md) --------------------------
// getTravel(): the explorer's CURRENT travel state — the same weights/dominant the
// star map + live audio already use. S.weights is the live blend [{g,w}]; S.travel
// is {seg,t}; pointOnPath(S.travel) is the world position along the DRAWN path.
// This does NOT fork the travel logic — it only READS the store the app maintains.
export function getTravel() {
  if (_tvInject) return _tvInject;
  const st = getS();
  const ws = (st.weights || []).filter((w) => w && w.w > 0).slice().sort((a, b) => b.w - a.w);
  const dominant = ws.length ? ws[0].g : null;
  let position = null;
  try { position = st.waypoints && st.waypoints.length >= 2 ? pointOnPath(st.travel) : null; } catch (e) {}
  return { weights: ws, dominant, position, live: !!st.live, seed: st.seed };
}

// getBeat(): the REAL audio beat. onBar (app/audio/live.js) writes S.barInfo every bar
// with { serial, spb (sec/beat), cbeats, when, ... }; S.playing.bpm is the tempo.
// We derive a smooth beatPhase (0..1 within a beat) from a local clock that RESETS
// on each new bar serial — so dance hits stay locked to the bar grid without
// touching the engine. SHIM NOTE: the Integrate phase can make this sample-accurate
// by reading the AudioContext clock + info.when off faustHandle; the bar-synced
// local clock here is intentionally dependency-free for the scaffold.
const _beat = { serial: -1, t0: 0 };
export function getBeat() {
  if (_btInject) return _btInject;
  const st = getS();
  const info = st.barInfo;
  const bpm = (st.playing && st.playing.bpm) || 120;
  const spb = info && info.spb ? info.spb : 60 / bpm;
  const cbeats = info && info.cbeats ? info.cbeats : 8;
  const serial = info ? info.serial : -1;
  const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
  if (serial !== _beat.serial) { _beat.serial = serial; _beat.t0 = now; }
  const beatsIn = st.live && spb > 0 ? ((now - _beat.t0) / 1000) / spb : (now / 1000) / spb;
  const beatPhase = beatsIn - Math.floor(beatsIn);
  return { bpm, spb, cbeats, serial, beat: Math.floor(beatsIn), beatPhase, playing: !!st.live };
}

// ---- THE SCORE BRIDGE -----------------------------------------------------------
// The bridge that turns each alien from a beat-keeper into a PLAYER of its part.
// On land / genre change it resolves the current playing STATE and calls
// E.buildEvents ONCE for the whole track (cheaper than the contract's once-per-bar:
// one call yields every bar), then buckets every event by VOICE into a per-bar note
// plan { bars:[ { voice:{ notes:[{t,pitch,dur,vel}], level, playing } } ] }. Each
// frame the controller picks the CURRENT bar (from the audio beat's serial) and the
// bar-local phase, and passes each band member its voice's notes/level/playing as
// ctx — NEVER rebuilding per frame. Rebuilt only when the genre (plan key) changes.
let eventPlan = null;        // { bars, numBars, cbeats, bpm } — the cached per-bar note plan
let eventPlanKey = null;     // genre+seed signature; a change triggers a rebuild
let planBuildCount = 0;      // how many times buildEvents ran (headless proof it is NOT per-frame)
let _localBar = 0;           // bar counter used when no real audio serial is available
let _lastBarPhase = 0;       // for local bar advancement (wrap detection)
let _curBarIdx = 0;          // the bar the band is currently playing (headless-probe visibility)
const _lastCtx = Object.create(null);   // last ctx passed per voice (headless-probe visibility)
let _fillInject = null;      // TEST override for the per-bar fill flag (null in production)

// engine voice ids the CORE kit vs the decorative PERC lane split into.
const PERC_DRUMS = { rim: 1, ride: 1, ride8: 1, crash: 1, crashDown: 1, perc: 1, conga: 1,
  shaker: 1, cowbell: 1, tamb: 1, tambourine: 1, clave: 1, click: 1, cabasa: 1, guiro: 1,
  woodblock: 1, triangle: 1, bongo: 1, timbale: 1, agogo: 1 };
// per-voice reference loudness (event amps differ by lane) so `level` reads 0..1
// meaningfully — a faded/quiet bar drops below the rest threshold and the alien idles.
const VOICE_REF = { drums: 0.5, perc: 0.32, bass: 0.24, melody: 0.2, pad: 0.2, found: 0.4 };
export const clamp01n = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// resolve the FULL engine state (sections + voices) the audio renders for a genre
// name or a weights blend — the same resolution traits.js uses.
function resolveState(genreOrWeights, seed) {
  const k = K(); if (!k) return null;
  try {
    if (typeof genreOrWeights === "string") return k.track(genreOrWeights, { seed });
    if (Array.isArray(genreOrWeights) && genreOrWeights.length) return k.mix(genreOrWeights, { seed });
  } catch (e) {
    // a bad blend — fall back to the dominant single genre.
    try { const d = firstGenre(); return k.track(typeof genreOrWeights === "string" ? genreOrWeights : d, { seed }); } catch (e2) {}
  }
  return null;
}

// buildEventPlan(genreOrWeights, seed) — resolve state, run buildEvents ONCE, and
// bucket every event by voice into per-bar note lists. Cached on eventPlan; rebuilt
// only when the (genre+seed) key changes. Safe/no-throw: leaves eventPlan null on
// any failure so the controller falls back to the beat-only path.
export function buildEventPlan(genreOrWeights, seed) {
  const key = (typeof genreOrWeights === "string" ? genreOrWeights
    : (Array.isArray(genreOrWeights) ? genreOrWeights.map((w) => w.g + ":" + (w.w || 0).toFixed(3)).join(",") : "?")) + "@" + seed;
  if (eventPlan && eventPlanKey === key) return eventPlan;   // already cached this genre
  eventPlanKey = key; eventPlan = null; _localBar = 0; _lastBarPhase = 0;
  const eng = E(); const st = resolveState(genreOrWeights, seed);
  if (!eng || !eng.buildEvents || !st) return null;
  let ev;
  try { ev = eng.buildEvents(st); } catch (e) { return null; }
  planBuildCount++;
  const CBEATS = Math.max(2, Math.round(st.chordEvery || (st.meter ? 6 : 8)));
  const total = ev.totalBeats || 0;
  // events only live in [0, total-8) (the +8 is a silent tail); bar count = that span.
  const numBars = Math.max(1, Math.round(Math.max(CBEATS, total - 8) / CBEATS));
  const bars = new Array(numBars);
  for (let i = 0; i < numBars; i++) bars[i] = Object.create(null);
  const pchToMidi = eng.pchToMidi || ((s) => { const p = String(s).split("."); return (parseInt(p[0], 10) - 3) * 12 + parseInt(p[1], 10); });
  // push one note into its bar bucket for a voice. t = position 0..1 within the bar,
  // dur = fraction of a bar, vel = event amp (post-dynamics — quiet bars read quiet).
  const put = (voice, beat, pitch, durBeats, amp) => {
    if (!(beat >= 0)) beat = 0;
    let bi = Math.floor(beat / CBEATS);
    if (bi >= numBars) bi = ((bi % numBars) + numBars) % numBars;
    const t = clamp01n((beat - bi * CBEATS) / CBEATS);
    const bar = bars[bi];
    let slot = bar[voice]; if (!slot) slot = bar[voice] = { notes: [], maxAmp: 0 };
    slot.notes.push({ t, pitch: pitch | 0, dur: Math.max(0, (durBeats || 0) / CBEATS), vel: +(+amp || 0).toFixed(4) });
    if (amp > slot.maxAmp) slot.maxAmp = amp;
  };
  // PITCHED — bass / pad / melody(lead) carry their own voice id + pch (octave.step).
  for (const e of (ev.pitched || [])) {
    const v = e.voice; if (v !== "bass" && v !== "pad" && v !== "melody") continue;
    put(v, e.beat, pchToMidi(e.pch) + 60, e.dur, e.amp != null ? e.amp : (e.amp0 || 0.15));
  }
  // DRUMS — the core kit is one 'drums' voice; the decorative perc lane a 'perc' voice.
  const DRUM_MIDI = { kick: 36, kick2: 36, snare: 38, clap: 39, hat: 42, hat2: 44, tom: 45,
    ride: 51, rim: 37, crash: 49, crashDown: 49, perc: 60, conga: 47, shaker: 70, cowbell: 56 };
  for (const e of (ev.drums || [])) {
    const voice = PERC_DRUMS[e.drum] ? "perc" : "drums";
    put(voice, e.beat, DRUM_MIDI[e.drum] || 50, e.dur, e.amp != null ? e.amp : (e.amp0 || 0.3));
  }
  // FOUND — the sampled/vocal layer; pitch field is a playback RATE -> a nominal midi.
  for (const e of (ev.found || [])) {
    const rate = e.pitch != null ? e.pitch : 1;
    const midi = 60 + Math.round(12 * Math.log2(rate > 0 ? rate : 1));
    put("found", e.beat, midi, e.dur, e.amp != null ? e.amp : 0.3);
  }
  // finalize each bar/voice: representative level + playing flag + time-sorted notes.
  for (const bar of bars) {
    for (const voice in bar) {
      const slot = bar[voice];
      slot.notes.sort((a, b) => a.t - b.t);
      slot.level = clamp01n(slot.maxAmp / (VOICE_REF[voice] || 0.3));
      slot.playing = slot.notes.length > 0 && slot.level > 0.05;
    }
  }
  // PER-BAR OVERALL LOUDNESS (0..1) — the "how loud is the whole track right now" signal
  // the controller hands every alien as ctx.loudness (dancers DESYNC when quiet, SYNC when
  // loud). Deterministic: derived from the cached plan, no clock. Weighted toward the
  // rhythm section (drums/perc) since that's what drives the room.
  const loudness = new Array(numBars);
  const drumsPerBar = new Array(numBars);
  for (let i = 0; i < numBars; i++) {
    const bar = bars[i];
    let sum = 0, cnt = 0, drumL = 0;
    for (const v in bar) {
      const lv = bar[v].level || 0;
      const w = (v === "drums" || v === "perc") ? 1.4 : (v === "bass" ? 1.0 : 0.8);
      sum += lv * w; cnt += w;
      if (v === "drums") drumL = Math.max(drumL, bar[v].notes.length);
    }
    loudness[i] = cnt > 0 ? clamp01n(sum / cnt) : 0;
    drumsPerBar[i] = drumL;
  }
  // PER-BAR FILL flag — a drum FILL / transition (the camera ALWAYS cuts to the drummer
  // on a fill). Deterministic heuristic: a bar whose kit is markedly BUSIER than the
  // track's typical bar (>= 1.5x the mean drum onsets AND above a small floor). No fills
  // in a track with no kit variation -> the flag simply never fires.
  let meanDrums = 0; for (let i = 0; i < numBars; i++) meanDrums += drumsPerBar[i];
  meanDrums = numBars > 0 ? meanDrums / numBars : 0;
  const fillBars = [];
  const fill = new Array(numBars);
  for (let i = 0; i < numBars; i++) {
    fill[i] = meanDrums > 0 && drumsPerBar[i] >= Math.max(meanDrums * 1.5, meanDrums + 2);
    if (fill[i]) fillBars.push(i);
  }
  eventPlan = { bars, numBars, cbeats: CBEATS, bpm: ev.bpm || st.bpm || 120, loudness, fill, fillBars };
  return eventPlan;
}

// currentBar(bt) — which cached bar the audio is on right now, from the beat's bar
// SERIAL (S.barInfo increments it per chord-bar; loops the song). No serial (early
// frame / headless without a driven serial) -> a locally advanced counter.
export function currentBar(bt) {
  if (!eventPlan) return 0;
  const nb = eventPlan.numBars;
  const serial = bt && bt.serial;
  if (typeof serial === "number" && serial >= 0) return ((serial % nb) + nb) % nb;
  return ((_localBar % nb) + nb) % nb;
}
// barPhaseOf(bt) — 0..1 across the CURRENT bar. Real getBeat gives beat (integer
// beats-into-bar) + beatPhase; injected beats give only beatPhase (treated per-bar).
export function barPhaseOf(bt) {
  const cb = (bt && bt.cbeats) || (eventPlan && eventPlan.cbeats) || 8;
  const beatIdx = (bt && typeof bt.beat === "number") ? bt.beat : 0;
  let ph = (beatIdx + ((bt && bt.beatPhase) || 0)) / cb;
  ph = ph - Math.floor(ph);
  return ph < 0 ? 0 : ph > 1 ? 1 : ph;
}
// ctxForVoice(voice, barIdx, barPhase) — the per-frame ctx a band member receives.
// Carries barPhase (0..1 over the bar), whether the voice is PLAYING this bar, its
// dynamics level, and the bar's note onsets. valueOf() returns barPhase so the OLD
// beat-only alien path (which reads a numeric phase) still animates if it hasn't
// been upgraded — the new path reads .notes/.level/.playing/.barPhase.
export function ctxForVoice(voice, barIdx, barPhase) {
  let slot = null;
  if (eventPlan && eventPlan.bars[barIdx]) slot = eventPlan.bars[barIdx][voice] || null;
  const loud = loudnessAt(barIdx);
  const ctx = {
    barPhase,
    playing: !!(slot && slot.playing),
    level: slot ? slot.level : 0,
    notes: slot ? slot.notes : [],
    loudness: loud,                 // CONTRACT: overall track level 0..1 (dancers sync when loud)
    valueOf() { return barPhase; },
  };
  _lastCtx[voice] = { barPhase: +barPhase.toFixed(4), playing: ctx.playing, level: +ctx.level.toFixed(3), notes: ctx.notes.length, loudness: +loud.toFixed(3) };
  return ctx;
}
// overall track loudness (0..1) for a bar — the per-alien ctx.loudness signal.
export function loudnessAt(barIdx) {
  if (!eventPlan || !eventPlan.loudness) return 0;
  const nb = eventPlan.numBars;
  const bi = ((barIdx % nb) + nb) % nb;
  return eventPlan.loudness[bi] || 0;
}
// currentFill() — is a drum FILL firing on the current bar? TEST override wins; else the
// plan's per-bar fill flag. The auto-camera ALWAYS cuts to the drummer while this is true.
export function currentFill() {
  if (_fillInject != null) return !!_fillInject;
  if (!eventPlan || !eventPlan.fill) return false;
  return !!eventPlan.fill[_curBarIdx];
}
export function injectFill(b) { _fillInject = (b == null ? null : !!b); }

// ---- per-frame plan bookkeeping (called by the controller's update) --------------
// hasPlan(): is a cached plan up? setCurBar(i): remember the bar the band is playing
// (currentFill + the probes read it). advanceLocalBar(bt, barPhase): advance the LOCAL
// bar counter on a barPhase wrap when there is no audio serial. resetPlan(): drop the
// cache on stop() (planBuildCount deliberately survives — it is a lifetime counter).
export function hasPlan() { return !!eventPlan; }
export function getPlan() { return eventPlan; }
export function buildCount() { return planBuildCount; }
export function curBar() { return _curBarIdx; }
export function setCurBar(i) { _curBarIdx = i; }
export function lastCtx(v) { return _lastCtx[v] || null; }
export function advanceLocalBar(bt, barPhase) {
  if (eventPlan && !(bt && typeof bt.serial === "number" && bt.serial >= 0)) {
    if (barPhase < _lastBarPhase - 0.3) _localBar++;
    _lastBarPhase = barPhase;
  }
}
export function resetPlan() {
  eventPlan = null; eventPlanKey = null; _localBar = 0; _lastBarPhase = 0; _curBarIdx = 0;
}

// ---- DETERMINISTIC BAND COVERAGE ------------------------------------------------
// The canonical engine-voice order + a synthesized band-member for any SOUNDING voice
// that traits.band didn't include. The band must have ONE alien for EVERY voice that
// actually sounds in the cached note plan (fixes the intermittent case where a voice
// the plan emits — e.g. a barely-present melody — has no alien): we align the "sounding"
// test with band spawning by driving the roster off eventPlan, not off traits.band alone.
const BAND_CAP = 8;               // HARD mobile cap on simultaneous aliens (traits caps at 6)
const VOICE_ORDER = ["drums", "perc", "bass", "melody", "pad", "found"];
const SYNTH_MEMBER = {
  drums: { role: "drum", family: "pulse-bladder", playStyle: "drum", hitsPerBeat: 2 },
  perc: { role: "perc", family: "chime-cluster", playStyle: "strike", hitsPerBeat: 3 },
  bass: { role: "bass", family: "drone-coil", playStyle: "pluck", hitsPerBeat: 1 },
  melody: { role: "lead", family: "tendril-harp", playStyle: "pluck", hitsPerBeat: 2 },
  pad: { role: "pad", family: "gas-veil", playStyle: "bow", hitsPerBeat: 1 },
  found: { role: "found", family: "echo-conch", playStyle: "strike", hitsPerBeat: 1 },
};
function synthMember(voice) {
  const f = SYNTH_MEMBER[voice] || SYNTH_MEMBER.perc;
  return { role: f.role, voice, instrument: { family: f.family, playStyle: f.playStyle, appendage: 0, hitsPerBeat: f.hitsPerBeat } };
}
// the voices that actually SOUND (any onset anywhere) in the current cached plan —
// the exact same signal the score-bridge probe calls "sounding", so band == sounding.
function soundingVoices() {
  const set = Object.create(null);
  if (eventPlan && eventPlan.bars) {
    for (const bar of eventPlan.bars) for (const v in bar) { if (bar[v].notes && bar[v].notes.length) set[v] = 1; }
  }
  return set;
}
// resolve the final roster: one member per SOUNDING voice (reusing traits.band's
// genre-tuned member where it exists, else a synthesized one), in canonical order.
// Falls back to traits.band when there's no plan (early frame) so we never spawn empty.
export function rosterFor(traitsBand) {
  const sounds = soundingVoices();
  const byVoice = Object.create(null);
  for (const m of (traitsBand || [])) if (m && m.voice && !byVoice[m.voice]) byVoice[m.voice] = m;
  const voices = VOICE_ORDER.filter((v) => sounds[v]);
  if (!voices.length) {
    const fb = (traitsBand || []).slice(0, BAND_CAP);
    return fb.length ? fb : [synthMember("melody")];
  }
  return voices.map((v) => byVoice[v] || synthMember(v)).slice(0, BAND_CAP);
}
