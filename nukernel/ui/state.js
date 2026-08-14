// ui/state.js — the store: the song, the selection, tempo and volume, the
// event bus, and every way a song enters or leaves the page (localStorage,
// a file off the desktop, adoptSong). STATE PUBLISHES, IT DOES NOT DRAW —
// no draw call and no element handle lives here except the one download
// anchor saveFile needs, which is file IO rather than rendering.
//
// Layer graph: deps -> THIS FILE -> derive -> audio -> ui views -> main.
// Audio modules may import state (they read the song and subscribe); state
// imports nothing but deps. Tempo and volume live HERE, not in the DOM —
// six functions used to re-read document.getElementById(...).value at call
// time, two of them in the audio hot path (stepDur per tick, barSec per
// channel build), which also made the loader untestable in node.
import { NuSong, blank, emptyBox, DEFAULT } from "./deps.js";

export const DEFAULT_BPM = 126, NBOXES = 4;

/* ---------- the store ---------- */
// Exported as live bindings: importers see every reassignment. Mutation from
// outside goes through the setters below, because a module cannot assign to
// another module's binding — which is exactly the discipline we want anyway.
// The bank is VARIABLE (1..NSLOTS) now; a fresh page carries ONE phrase.
export let SLOTS = [blank()];
export let slot = 0;
export let SUBJ = SLOTS[slot];       // by reference: cell edits mutate the slot
export let SONG = Array.from({ length: NBOXES }, emptyBox);
export let viewSec = 0, loopOnly = null, pendingStart = null;
export let bpm = DEFAULT_BPM, vol = 80;

export function setSlot(i) { slot = i; SUBJ = SLOTS[i]; }
export function putPhrase(i, p) { SLOTS[i] = p; if (i === slot) SUBJ = p; }
export function setViewSec(i) { viewSec = i; }
export function setLoopOnly(v) { loopOnly = v; }
export function setPendingStart(v) { pendingStart = v; }
export function setBpm(v) { bpm = +v; }
export function setVol(v) { vol = +v; }

export const curSection = () => SONG[Math.min(viewSec, SONG.length - 1)];

/* ---------- the event bus ---------- */
// The typed-change vocabulary that replaced the copy-pasted redraw quartets:
//   "song"               a whole new song was adopted (file/composer/preset/
//                        reset/boot) — everything rebuilds, audio drops its mix
//   "phrase"             a phrase cell changed — editor/slots/arrange refresh,
//                        the song row does NOT (a scrub must not rebuild it)
//   "box"                the selected box changed musically — songrow patches,
//                        arrange re-renders, transport recompiles if playing
//   "selection"          viewSec/slot/focus moved, nothing musical changed
//   "transport"          bpm or volume moved
//   "transport:state"    published by audio/transport — playing flipped
//   "transport:section"  published by audio/transport — the sounding box moved
//   "refresh"            assets finished loading mid-play; views re-render
//   "page"               published by ui/pages — the phone deck switched pages
//   "status"             {text} for the #readout line (readout.js listens)
const subs = new Map();
export function on(type, fn) {
  let a = subs.get(type);
  if (!a) subs.set(type, a = []);
  a.push(fn);
}
export function emit(type, detail) {
  const a = subs.get(type);
  if (a) for (const fn of a) fn(detail);
}
// commit: one call per user edit. Emits the typed change; persists the ones
// that change what a save would contain (selection is deliberately not saved).
export function commit(type, detail) {
  emit(type, detail);
  if (type === "phrase" || type === "box" || type === "transport") save();
}

/* ---------- persistence ---------- */
// The song survives a reload; Reset all wipes it. Only plain data is stored —
// genre and transform names are STRING KEYS, never the operator functions — so
// the saved shape does not depend on the kernel's internals.
//
// The paranoia lives in song.js — migrate() climbs every older shape to the
// current one, validateSong() names the first field it refuses — and this
// file only APPLIES the result. The storage key deliberately keeps its old
// name: it names the slot, not the schema; migrate owns versions.
const STORE = "nukernel.song.v1";
let saveTimer = null;
function writeStore() {
  try {
    localStorage.setItem(STORE, JSON.stringify(
      { v: NuSong.VERSION, slots: SLOTS, song: SONG, bpm, vol }));
  } catch (e) { /* private mode, or quota: not worth interrupting the music */ }
}
export function saveNow() { clearTimeout(saveTimer); saveTimer = null; writeStore(); }
// Debounced during editing so a drag does not write on every frame — but
// FLUSHED when the page goes away, or an edit made in the last quarter second
// before a reload is simply lost.
export function save() { clearTimeout(saveTimer); saveTimer = setTimeout(writeStore, 250); }
addEventListener("pagehide", saveNow);
addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveNow();
});
export function readStore() {
  try { return JSON.parse(localStorage.getItem(STORE) || "null"); }
  catch (e) { return null; }
}
export function clearStore() {
  try { localStorage.removeItem(STORE); } catch (e) { /* nothing to clear */ }
}

// the fresh page: ONE phrase — the starter, already written and already
// switched on in box 1 — and NBOXES Simple boxes. Built as a raw save so it
// enters through the same door as everything else. The bank used to ship
// eight blanks and the box referenced none of them, which meant the very
// first thing PLAY did on a fresh page was refuse ("nothing to play"), with
// the position LCD parked on -- and the transport key dark: the machine's
// front door opened onto a silent room. A fresh page now SOUNDS.
export const defaultSong = () => {
  const song = Array.from({ length: NBOXES }, emptyBox);
  song[0].stack[0].slots = [0];
  return { v: NuSong.VERSION, slots: [deepDefault()], song,
           bpm: DEFAULT_BPM, vol: 80 };
};
// the starter phrase is genre data (genres.js DEFAULT) and the store must
// never hand out the literal itself — a scrub would edit the table
const deepDefault = () => JSON.parse(JSON.stringify(
  { ...blank(), ...DEFAULT }));

/* ---------- adoptSong: the ONE entrance ---------- */
// localStorage, a file off the desktop, a shipped preset, the composer and the
// Reset button all come through here. The work is song.js's (migrate ->
// validate, pure and node-gated); this function assigns the result, resets the
// selection, and publishes "song" — audio drops its channels and stops via its
// own subscription, every view rebuilds via its own. The eleven-statement
// epilogue this replaces was copy-pasted four times and half-remembered a
// fifth (boot).
export let loadError = null;
export const loadErrorText = () => loadError
  ? " (" + loadError.path + ": got " + JSON.stringify(loadError.got) +
    ", want " + loadError.want + ")"
  : "";
export function adoptSong(raw, reason) {
  const res = NuSong.load(raw);
  if (!res.ok) { loadError = res.errors[0]; return false; }
  loadError = null;
  const s = res.song;
  SLOTS = s.slots; SONG = s.song; slot = 0; SUBJ = SLOTS[0];
  viewSec = 0; loopOnly = null; pendingStart = null;
  if (s.bpm != null) bpm = s.bpm;
  if (s.vol != null) vol = s.vol;
  emit("song", { reason: reason || "load" });
  save();
  return true;
}

/* ---------- desktop ---------- */
export function songJSON() {
  return JSON.stringify({ v: NuSong.VERSION, slots: SLOTS, song: SONG, bpm, vol },
    null, 1);
}
export function saveFile() {
  const names = [...new Set(SONG.flatMap(b => (b.stack || []).map(e => e.g)))]
    .join("-") || "song";
  const blob = new Blob([songJSON()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "nukernel-" + names + "-" + SONG.length + "box.json";
  // the anchor must OUTLIVE the click: removing it in the same tick cancelled
  // the download in chromium and nothing was ever written
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
export function loadFile(file) {
  const fr = new FileReader();
  fr.onload = () => {
    let raw = null;
    try { raw = JSON.parse(fr.result); } catch (e) { raw = null; }
    if (!adoptSong(raw, "file"))
      emit("status", { text:
        "that file is not a nukernel song, or it is from an incompatible version" +
        loadErrorText(), sticky: true });
  };
  fr.readAsText(file);
}
