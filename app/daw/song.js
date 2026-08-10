// song.js — THE DAW's DOCUMENT: a diff against the deterministic kernel.
//
// A song here is NOT a copy of a kernel state (those run ~200 KB, nearly all of it
// resolved instruments + samplerLib). It is {genre, seed, patch} — the base the
// kernel resolves plus the fields the rack has edited — so it fits in a URL, in
// localStorage, and in a diff you can read. The fat resolved state is rebuilt from
// the kernel on load, never stored (docs/DAW.md "The document").
//
// DELIBERATELY NOT importing app/core/state.js: that store is the star map's — it
// pulls in world.js's POS seed, the map cursor, the traveler. The DAW is a second
// front end over the SAME engine, not a feature of the map, so it reads the engine
// globals directly and keeps its own store. The two share the kernel and nothing else.
//
// THE RACK LAW: every state this module resolves carries voiceStreams:true, so a
// machine you tweak is the only thing that moves (csd-engine.js VOICE_STREAM;
// gate test/unit/voice-streams.test.js). Without it, nudging the melody moves the
// hi-hats and the per-track rolls lie about who owns what.
import { applyFeel } from "./machines/feel-core.js";
import { applyLayers } from "./layers.js";

const K = window.GenreKernel, E = window.CsdEngine;

// `weights` is the SCULPTED BLEND — the document's real identity. `genre` is kept
// as the fallback when nothing has been sculpted yet (and as the readable name of
// a single-anchor song), but a shaped song is a set of weights, because a point
// between anchors is a real place rather than a menu item you missed.
// THE DEFAULT SONG (Paul): straight acid with drum and synth. `acidhouse` is the
// catalogue's acid anchor — 126 bpm, tb303 on BOTH bass and melody, a house kit —
// and the feel axis pins swing to 0 so it is straight rather than the anchor's
// slight 0.022 lean.
export const SONG = { genre: "acidhouse", seed: 7, weights: null,
  patch: { feel: { swing: 0 } } };

// ---------- the GRID's track table ----------
// One row per voice the grid draws, in reading order. The hues are the project's
// fixed per-track hues (docs/DAW.md); `kind` picks the cell painter and the
// trackEvents filter. Master is NOT a track — it is the row under the grid.
export const TRACKS = [
  { id: "chords",  kind: "chords",  label: "chords",  hue: 265 },
  { id: "melody",  kind: "pitched", label: "melody",  hue: 200 },
  { id: "bass",    kind: "pitched", label: "bass",    hue: 330 },
  { id: "pad",     kind: "pitched", label: "pad",     hue: 280 },
  { id: "drums",   kind: "drums",   label: "drums",   hue: 45 },
  { id: "samples", kind: "found",   label: "samples", hue: 120 },
];
export const trackById = (id) => TRACKS.find((t) => t.id === id) || null;

// ---------- section identity ----------
// A section's id is index-qualified name — "0:intro", "3:chorus" — so two
// sections sharing a name stay distinct and a secover entry addresses exactly
// one column. A re-resolved form with different sections simply matches nothing:
// stale overrides drop silently, never mis-land.
export const secId = (i, sec) => i + ":" + ((sec && sec.name) || "");
export const subs = [];
let raf = 0;
export function touch() {            // coalesced repaint (the app/core/state.js `set` pattern)
  if (raf) return;
  raf = requestAnimationFrame(() => { raf = 0; subs.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); });
}
export function edit(patch) { Object.assign(SONG, patch); invalidate(); touch(); }

// ---------- resolution + the ONE build ----------
// buildEvents is the same call the live walk makes every bar — milliseconds — so
// the rack can rebuild on every knob turn with no caching layer beyond "did
// anything actually change". The memo key is the document, not the resolved state:
// resolving is the expensive half (the kernel picks instruments + sampler zones).
let _key = null, _state = null, _events = null;
function invalidate() { _key = null; }
const keyOf = () => JSON.stringify([SONG.genre, SONG.seed, SONG.patch, SONG.weights]);

export function state() {
  const k = keyOf();
  if (k === _key && _state) return _state;
  // A sculpted song resolves through K.mix — the SAME call the star map makes for
  // a point between stars — so a shaped song and an explored one are the same kind
  // of object, and every downstream gate about blends still applies.
  const t = (SONG.weights && SONG.weights.length)
    ? K.mix(SONG.weights.map((w) => ({ g: w.g, w: w.w })), { seed: SONG.seed })
    : K.track(SONG.genre, { seed: SONG.seed });
  const s = JSON.parse(JSON.stringify(t.state || t));
  const patch = Object.assign({}, SONG.patch || {});
  const feel = patch.feel; delete patch.feel;
  const layerSet = patch.layers; delete patch.layers;
  // secover and sound are NEVER Object.assign'd onto the state: sections must
  // not be replaceable wholesale from a URL, and an instrument override is a
  // structured rewrite, not a key splat. Both apply AFTER resolve, below.
  const secover = patch.secover; delete patch.secover;
  const sound = patch.sound; delete patch.sound;
  Object.assign(s, patch);
  // the feel axes are applied to the RESOLVED state, not stored as resolved
  // params — so a re-shaped genre brings its own instruments and your brightness
  // rides on top of them (feel-core.js says why that distinction matters)
  applyFeel(s, feel);
  applyLayers(s, layerSet);      // the stack's per-layer axes, same one-number-per-axis rule
  applySecover(s, secover);      // per-section overrides, BY ID (below)
  applySound(s, sound);          // instrument overrides, K.SAMPLERS-validated (below)
  s.voiceStreams = true;                       // THE RACK LAW (see header)
  _key = k; _state = s; _events = null;
  return s;
}
export function events() {
  const s = state();
  if (!_events) _events = E.buildEvents(s);
  return _events;
}

// ---------- secover: per-section overrides, applied BY ID ----------
// THE SECURITY SHAPE: the override is applied to the section the id names — the
// state's own `sections` array is never replaced, extended or reordered from the
// patch. Every field is whitelist-validated against the ENGINE's own vocabulary
// (never a list this file maintains by hand), and anything that fails just
// drops — silently, because a hostile URL deserves no diagnostics.
const SEC_FIELDS = ["cycles", "melody", "bass", "drums", "pads"];
const hasKey = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
function melodyNameOk(name, cells) {
  if (name === "off") return true;
  if ((E.MELODY_PATTERNS || []).indexOf(name) >= 0) return true;
  // a user-drawn cell already in THIS patch is playable vocabulary — except the
  // scratch phrase, which is inert by law (machines/weave.js SCRATCH)
  return name !== "__fit" && hasKey(cells, name);
}
const bassNameOk = (name) => name === "off" || (E.BASS_PATTERNS || []).indexOf(name) >= 0;
const drumsNameOk = (name, kits) => name === "off" || hasKey(E.KITS, name) || hasKey(kits, name);

// structural sanitizer, shared by decodePatch (the URL door) and applySecover
// (the choke point — edits can also arrive via edit() from a probe). `ctx`
// carries the patch's OWN cells/kits — at decode time the incoming payload's,
// at apply time SONG.patch's — so a user cell name validates against the patch
// it travels with, never a stale one.
export function sanitizeSecover(o, ctx) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const cells = (ctx && ctx.cells) || SONG.patch.melodyCells;
  const kits = (ctx && ctx.kits) || SONG.patch.kits;
  const out = {};
  for (const id of Object.keys(o)) {
    // a section id is ALWAYS "<index>:<name>" (secId above). The format gate
    // both rejects junk keys and makes "__proto__" (the one magic plain-object
    // key) unrepresentable. An id that parses but names no resolved section is
    // structurally fine and INERT — applySecover matches nothing and drops it.
    if (typeof id !== "string" || id.length > 48 || !/^\d{1,3}:/.test(id)) continue;
    const ov = o[id];
    if (!ov || typeof ov !== "object" || Array.isArray(ov)) continue;
    const keep = {};
    for (const f of SEC_FIELDS) {
      if (!(f in ov)) continue;
      const v = ov[f];
      if (f === "cycles") { const c = Math.round(+v); if (c >= 1 && c <= 16) keep.cycles = c; }
      else if (f === "pads") { if (typeof v === "boolean") keep.pads = v; }
      else if (typeof v === "string" && v.length <= 32) {
        if (f === "melody" && melodyNameOk(v, cells)) keep.melody = v;
        else if (f === "bass" && bassNameOk(v)) keep.bass = v;
        else if (f === "drums" && drumsNameOk(v, kits)) keep.drums = v;
      }
    }
    if (Object.keys(keep).length) out[id] = keep;
  }
  return Object.keys(out).length ? out : null;
}
function applySecover(s, secover) {
  const so = sanitizeSecover(secover);
  if (!so) return;
  const secs = s.sections || [];
  for (let i = 0; i < secs.length; i++) {
    const ov = so[secId(i, secs[i])];
    if (!ov) continue;                               // an id not in the resolved form matches nothing
    const sec = secs[i];
    if (ov.cycles != null) sec.cycles = ov.cycles;
    if (ov.melody != null) sec.melody = ov.melody;
    if (ov.bass != null) sec.bass = ov.bass;
    if (ov.drums != null) sec.drums = ov.drums;
    if (ov.pads != null) sec.pads = ov.pads;
  }
}

// ---------- sound: per-voice instrument override ----------
// Rewrites st.instruments[voice] to a sampler recipe EXACTLY the way the kernel's
// toState rewrites a pitched recipe (genre-kernel.js samplerSpec + instrMerge):
// {model:"sampler", sampler:{id, sr, zones:[{srcId:"ins_<id>_<i>", …}]}, dx7:null}
// merged over the existing recipe so level/sends/cutoff survive, plus every zone
// wav pushed into foundSources at vol 0 so both engines decode it through the
// existing found paths. state-engine's pitchedUnit `case "sampler"` then builds
// the native sampler voice unit (verified: forceSampled/pitchedUnit require
// m.model==="sampler" && m.sampler.zones.length). The id must be a key of
// K.SAMPLERS — the committed registry — so a URL can only ever name audio the
// project already ships (the no-remote-sources law).
const SOUND_VOICES = ["melody", "bass", "pad"];
export function sanitizeSound(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const out = {};
  for (const voice of SOUND_VOICES) {
    const spec = o[voice];
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) continue;
    const id = spec.instrument;
    if (typeof id !== "string") continue;
    const S = K.SAMPLERS && Object.prototype.hasOwnProperty.call(K.SAMPLERS, id) && K.SAMPLERS[id];
    if (!S || !Array.isArray(S.zones) || !S.zones.length) continue;
    out[voice] = { instrument: id };
  }
  return Object.keys(out).length ? out : null;
}
function applySound(s, sound) {
  const so = sanitizeSound(sound);
  if (!so) return;
  for (const voice of SOUND_VOICES) {
    if (!so[voice]) continue;
    const id = so[voice].instrument, S = K.SAMPLERS[id];
    const zones = S.zones.map((z, i) => ({ srcId: "ins_" + id + "_" + i, root: z.root, lo: z.lo, hi: z.hi,
      vlo: z.vlo, vhi: z.vhi, loop: !!z.loop, loopStart: z.ls, loopEnd: z.le, len: z.len, sr: S.sr }));
    const I = s.instruments || (s.instruments = {});
    I[voice] = Object.assign({}, I[voice] || {}, { model: "sampler", sampler: { id, sr: S.sr, zones }, dx7: null });
    s.foundSources = s.foundSources || [];
    const have = new Set(s.foundSources.map((x) => x.id));
    S.zones.forEach((z, i) => {
      const sid = "ins_" + id + "_" + i;
      if (have.has(sid)) return;
      have.add(sid);
      s.foundSources.push({ id: sid, label: S.label || id, url: "",
        samplePath: "found/samples/instruments/" + S.dir + "/" + z.file,
        vol: 0, pitch: 1, stretch: 0.5, cutoff: 18000 });
    });
  }
}

// ---------- the patch, as something you can keep ----------
// THE WHITELIST IS A SECURITY BOUNDARY, not tidiness. The patch arrives from a
// URL a stranger can write, and it is Object.assign'd into a kernel state that
// then drives the engine. `foundSources` alone would let a link point the found
// layer at a remote host — the exact thing test/unit/no-remote-sources.test.js
// exists to prevent in the committed registry. So only keys the DAW's own
// machines WRITE survive a decode; anything else is dropped silently.
// EVERY NEW MACHINE ADDS ITS KEY HERE — a machine whose key is missing appears to
// work and then loses its edit on reload, which is the worst of both.
export const PATCH_KEYS = new Set([
  "kits",          // the kit machine (machines/drums.js)
  "feel",          // the genre ring: ONE NUMBER PER AXIS (machines/feel-core.js)
  "layers",        // the stack: {layerId:{axisId:v}} (layers.js) — same one-number rule
  "pipes",         // the note-fx rack — an ordered list of {id,...params} (machines/pipes.js)
  "bassCells",     // authored bass cells, in chord DEGREES (machines/bass.js)
  "rhythm",        // the bass mutation knob (state.rhythm.complexity)
  "melodyGen",     // the wander walk's knobs (now on the melody ring)
  "melodyCells",   // drawn phrase cells             — stage 5
  "melodyWeave",   // the painted Markov table       — stage 5
  "secover",       // per-section overrides BY ID — sanitizeSecover (THE GRID)
  "sound",         // per-voice instrument override — sanitizeSound (THE GRID)
]);
const MAX_PATCH = 6000;   // a URL nobody can paste is not persistence

const b64u = {
  enc: (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/")))),
};
export function encodePatch() {
  const p = SONG.patch || {};
  const keep = {};
  for (const k of Object.keys(p)) if (PATCH_KEYS.has(k) && p[k] != null) keep[k] = p[k];
  // the sculpted blend rides the SAME payload — a shaped song whose shape did not
  // survive the link would be the persistence bug all over again
  if (SONG.weights && SONG.weights.length) keep.__w = SONG.weights;
  if (!Object.keys(keep).length) return "";
  const s = b64u.enc(JSON.stringify(keep));
  if (s.length > MAX_PATCH) { console.warn("daw: patch too large for the URL (" + s.length + " chars) — not encoded"); return ""; }
  return s;
}
export function decodePatch(str) {
  if (!str) return {};
  try {
    const o = JSON.parse(b64u.dec(str));
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    const keep = {};
    for (const k of Object.keys(o)) if (PATCH_KEYS.has(k)) keep[k] = o[k];
    // the two structured keys are sanitized AT THE DOOR as well as at apply time
    // — a decoded patch should already be clean so encodePatch round-trips it
    if ("secover" in keep) { const c = sanitizeSecover(keep.secover, { cells: keep.melodyCells, kits: keep.kits }); if (c) keep.secover = c; else delete keep.secover; }
    if ("sound" in keep) { const c = sanitizeSound(keep.sound); if (c) keep.sound = c; else delete keep.sound; }
    // the blend is validated the same way everything else is: only real anchor ids
    // with sane weights survive, so a hand-edited link cannot inject a genre name
    if (Array.isArray(o.__w)) {
      const w = o.__w.filter((x) => x && K.GENRES[x.g] && +x.w > 0).slice(0, 6)
        .map((x) => ({ g: x.g, w: Math.min(1, +x.w) }));
      if (w.length) keep.__w = w;
    }
    return keep;
  } catch (e) { console.warn("daw: unreadable patch in the URL — ignored"); return {}; }
}

// ---------- what the rack reads ----------
export const genreIds = () => Object.keys(K.GENRES);
export const genreLabel = (g) => (K.GENRES[g] && K.GENRES[g].label) || g;

// The per-track note list, exactly as the DAW's roll draws it. `pitched` voices
// filter by e.voice; the drums row hands back the whole kit and the roll lanes it.
export function trackEvents(track) {
  const ev = events();
  if (track.kind === "drums") return ev.drums;
  return ev.pitched.filter((e) => e.voice === track.id);
}

// The MACHINE a track is running, read off the form. A voice can carry a different
// pattern per section (that IS the arrangement), so this reports the distinct set
// in section order rather than pretending there is one answer.
export function trackMachines(track) {
  const s = state(), out = [];
  for (const sec of s.sections || []) {
    const v = sec[track.id];
    const name = (v && typeof v === "object") ? (v.pattern || "") : (v || "");
    if (name && name !== "off" && out.indexOf(name) < 0) out.push(name);
  }
  return out;
}

// Section spans in BEATS, for the ruler and the roll's section rules. Mirrors the
// section math buildEvents walks (cycles x chords x chordEvery), so the boundaries
// drawn are the boundaries heard.
export function sectionSpans() {
  const s = state(), E2 = window.CsdEngine;
  const prg = (E2.resolveProgression ? E2.resolveProgression(s) : null) || E2.PROGRESSIONS[s.progression];
  const nChords = (prg && prg.chords && prg.chords.length) || 4;
  const cb = Math.max(2, Math.round(s.chordEvery || (s.meter ? 6 : 8)));
  const out = []; let at = 0;
  const secs = s.sections || [];
  for (let i = 0; i < secs.length; i++) {
    const sec = secs[i];
    const beats = Math.max(1, (sec.cycles || 1)) * nChords * cb;
    out.push({ id: secId(i, sec), index: i, name: sec.name || "", start: at, beats, sec });
    at += beats;
  }
  return out;
}

// ---------- the one edit path for layer axes (tiles ride this) ----------
// v01 in 0..1 writes patch.layers[layer][axis]; null DROPS the entry — back to
// stock — which is what a tile's double-tap revert means. The same
// one-number-per-axis law as ever: the document stores what you set, the
// resolved state gets it re-applied every build (layers.js).
export function editLayer(layer, axis, v01) {
  const layers = Object.assign({}, SONG.patch.layers || {});
  const set = Object.assign({}, layers[layer] || {});
  if (v01 == null) delete set[axis];
  else set[axis] = Math.max(0, Math.min(1, +v01));
  if (Object.keys(set).length) layers[layer] = set; else delete layers[layer];
  const patch = Object.assign({}, SONG.patch);
  if (Object.keys(layers).length) patch.layers = layers; else delete patch.layers;
  edit({ patch });
}

// secover writer — merges one section's override; null field drops it; a fully
// empty override drops the section entry (structure.js's section sheet rides this)
export function editSecover(sectionId, field, value) {
  const so = Object.assign({}, SONG.patch.secover || {});
  const ov = Object.assign({}, so[sectionId] || {});
  if (value == null) delete ov[field]; else ov[field] = value;
  if (Object.keys(ov).length) so[sectionId] = ov; else delete so[sectionId];
  const patch = Object.assign({}, SONG.patch);
  const clean = sanitizeSecover(so);
  if (clean) patch.secover = clean; else delete patch.secover;
  edit({ patch });
}

// sound writer — instrument override per voice; null = back to the genre's own
export function editSound(voice, instrumentId) {
  const so = Object.assign({}, SONG.patch.sound || {});
  if (instrumentId == null) delete so[voice];
  else so[voice] = { instrument: instrumentId };
  const patch = Object.assign({}, SONG.patch);
  const clean = sanitizeSound(so);
  if (clean) patch.sound = clean; else delete patch.sound;
  edit({ patch });
}
