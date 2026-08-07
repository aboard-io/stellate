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

const K = window.GenreKernel, E = window.CsdEngine;

// `weights` is the SCULPTED BLEND — the document's real identity. `genre` is kept
// as the fallback when nothing has been sculpted yet (and as the readable name of
// a single-anchor song), but a shaped song is a set of weights, because a point
// between anchors is a real place rather than a menu item you missed.
export const SONG = { genre: "citypop", seed: 7, patch: {}, weights: null };
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
  Object.assign(s, patch);
  // the feel axes are applied to the RESOLVED state, not stored as resolved
  // params — so a re-shaped genre brings its own instruments and your brightness
  // rides on top of them (feel-core.js says why that distinction matters)
  applyFeel(s, feel);
  s.voiceStreams = true;                       // THE RACK LAW (see header)
  _key = k; _state = s; _events = null;
  return s;
}
export function events() {
  const s = state();
  if (!_events) _events = E.buildEvents(s);
  return _events;
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
  "feel",          // the feel vector: ONE NUMBER PER AXIS (machines/feel-core.js)
  "melodyGen",     // the wander walk's knobs        — stage 5
  "melodyCells",   // drawn phrase cells             — stage 5
  "melodyWeave",   // the painted Markov table       — stage 5
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
  for (const sec of s.sections || []) {
    const beats = Math.max(1, (sec.cycles || 1)) * nChords * cb;
    out.push({ name: sec.name || "", start: at, beats, sec });
    at += beats;
  }
  return out;
}
