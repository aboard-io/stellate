// fonts.js — the SOUNDFONT SWITCHER, in the settings panel.
// The default sampled instruments are FluidR3 (baked into the
// kernel). Alternate fonts, extracted by tools/build/gen-font.js into
// found/samples/instruments-<key>/ + engine/faust/data/font-<key>.json, register with
// the kernel at runtime; picking one re-voices every sampled instrument it
// covers (per-instrument fallback to FluidR3). Presentational — the default is
// untouched, so the deterministic gates are byte-identical.
import { S, set, K } from "../core/state.js";
import { retarget, retargetWeights } from "./targeting.js";
import { faustHandle } from "./live.js";
const liveHandle = () => faustHandle;

let manifest = [{ key: "fluidr3", label: "FluidR3 GM (default)" }];
const registered = new Set(["fluidr3"]);

export function fontManifest() { return manifest; }

async function ensureFont(key) {
  if (registered.has(key)) return true;
  // SYNTH FONTS (analog/FM) are built into the kernel — no assets to fetch;
  // K.setFont already knows them. The manifest flags them with `synth:true`.
  const entry = manifest.find(f => f.key === key);
  if (entry && entry.synth) { registered.add(key); return true; }
  try {
    const d = await (await fetch("engine/faust/data/font-" + key + ".json")).json();
    K.registerFont(key, d); registered.add(key); return true;
  } catch (e) { return false; }
}

// boot: load the manifest, register + apply the starting font (before the first play).
// `?sf=` or a stored pick PINS the set; `?fonts=off` pins the default. Otherwise the
// rotation runs from bar 0 and the starting font is whatever fontAt() says for the
// measure the URL dropped us on.
export async function loadFonts() {
  try { const m = await (await fetch("engine/faust/data/fonts.json")).json(); if (Array.isArray(m) && m.length) manifest = m; } catch (e) {}
  let pinned = null;
  try {
    const q = new URLSearchParams(location.search);
    // ?fonts=on FORCES the rotation past a stored pick. A pin is remembered forever,
    // so anyone who ever touched the ⚙ dropdown has the rotation switched off on every
    // later visit with nothing on screen that says so — this is the escape hatch, and
    // the label below is the thing that says so.
    if (q.get("fonts") === "on") { try { localStorage.removeItem("vaporwave-soundfont"); } catch (e) {} }
    else if (q.get("fonts") === "off") pinned = S.soundfont || "fluidr3";
    else if (q.get("sf")) pinned = q.get("sf");
    else if (localStorage.getItem("vaporwave-soundfont")) pinned = localStorage.getItem("vaporwave-soundfont");
  } catch (e) {}
  if (pinned) rotating = false;
  S.fontPinned = !rotating;
  const want = pinned || fontAt(S.startBar || 0);
  if (want !== "fluidr3") { const ok = await ensureFont(want); if (!ok) { S.soundfont = "fluidr3"; } }
  try { K.setFont(registered.has(want) ? want : "fluidr3"); } catch (e) {}
  S.soundfont = registered.has(want) ? want : "fluidr3";
  set({});
  return manifest;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE ROTATION — the set changes instruments every ROTATE_BARS and keeps coming
// home to the analog one. 8 steps x 32 bars = a full tour every 256 bars.
//
// THIS WAS OFF FOR AN AFTERNOON, and what it was waiting for is the ducked swap
// below. The problem was never the swap logic (25 ms) — it was the media. Zone ids
// are FONT-QUALIFIED so two fonts can coexist in the decode caches, which also means
// every zone of an incoming SAMPLED font is a cache miss:
//
//   fluidr3   629 zones   100.7 MB   resident (fetched once at boot)
//   sgm       930 zones    51.4 MB   cold at the boundary
//   windows   580 zones    28.2 MB   cold at the boundary
//   analog / dx7   0 zones     0 MB   synth fonts, nothing to fetch
//
// Measured on a live cold sgm swap: 1.86 s of main-thread long tasks, in chunks up
// to 233 ms. applyFont covers exactly that with an audio-thread gain ramp, which is
// why the rotation is safe to run again — see the comment there for why the ramp has
// to be an AudioParam and not a per-bar JS fade.
export const ROTATE_BARS = 32;
export const FONT_CYCLE = [
  "fluidr3",   // the default the genres are authored against
  "analog",    // Pure Analog
  "sgm",       // SGM Pro 15
  "analog",
  "windows",   // Seattle Glass Factory
  "analog",
  "dx7",       // Pure FM
  "analog",
];
// DETERMINISTIC FROM THE BAR, so a shared link reproduces the instruments as well as
// the notes: the URL carries the measure, and the rotation is a pure function of it.
export function fontAt(bar) { return FONT_CYCLE[Math.floor(Math.max(0, bar) / ROTATE_BARS) % FONT_CYCLE.length]; }

let rotating = true;      // a hand-picked font PINS the set until the page reloads
let rotateBusy = false;
export function fontRotating() { return rotating; }

// called once per bar from live.js's onBar. Two jobs: swap on the boundary, and
// pre-register the NEXT font a few bars early so its zone map is in hand when the
// boundary arrives (an unregistered font silently falls back to the default, which
// reads as "the rotation skipped one").
export async function fontRotateTick(bar) {
  if (!rotating || rotateBusy) return;
  const want = fontAt(bar);
  const next = fontAt(bar + 4);
  if (next !== want) ensureFont(next);            // best-effort prefetch, unawaited
  let cur = "fluidr3";
  try { cur = K.activeFont(); } catch (e) {}
  if (want === cur) return;
  rotateBusy = true;
  // NOT setSoundfont: that persists the choice and pins the rotation off. A rotation
  // step is the set moving on its own, not the listener choosing.
  try { await applyFont(want, "the set picks up "); }
  catch (e) { /* a rotation must never take the music down */ }
  finally { rotateBusy = false; }
}

export function fontLabel(key) { return (manifest.find(f => f.key === key) || {}).label || key; }

// ── THE SWAP, COVERED BY A FADE ──────────────────────────────────────────────
// Changing soundfont used to be stopLive() → rebuild → goLive(): a hard cut, and
// on a cold sampled font a long one. It is now a DIP. The instruments duck, the
// swap happens under the dip, and they come back when the new ones are actually
// there.
//
// WHY A FADE WORKS HERE, measured on a live engine doing a full cold sgm swap:
//
//   synchronous part of the swap                       25 ms
//   main-thread long tasks   233 208 180 133 127 125 102 101 ms  (1.86 s total)
//   audio gap                                           0 ms
//
// The thread is busy for about two seconds, but in CHUNKS — never one monolithic
// stall. That is exactly the shape a fade can hide, on one condition: the fade must
// not be scheduled by the thread that is busy. handle.duckVoices() is an AudioParam
// ramp on the audio thread, so it keeps ramping smoothly through every one of those
// 233 ms blocks. A per-bar JS fade would stutter through the same window and come
// out worse than the hard cut it replaced.
//
// THE BEDS STAY UP. duckVoices sits between the ring and the master; the found layer
// joins downstream of it. So the band recedes and the field recordings and speech
// hold the room — the reason this reads as a transition rather than a hole.
//
// THE FADE-IN IS DRIVEN BY READINESS, NOT BY A TIMER. We poll the engine's decoded
// zone count and come back up once it has stopped climbing (or at a hard ceiling, so
// a font that never finishes can't leave the music ducked forever). A fast font is a
// short dip; a cold 930-zone one takes as long as it takes.
const DUCK_TO = 0.14;        // how far the instruments drop (not to silence — a dip)
const DUCK_DOWN_SEC = 0.55;  // out
const DUCK_UP_SEC = 1.1;     // back in, slower than out: arrivals should bloom
const READY_POLL_MS = 220;
const READY_STABLE = 3;      // polls with no new zones = the font has landed
const READY_MAX_MS = 12000;  // ceiling: never stay ducked longer than this

// wait until the engine's decoded-zone count stops growing (or the ceiling hits).
async function awaitZonesSettled(handle) {
  if (!handle || !handle.decodeStats) return;
  let last = -1, stable = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < READY_MAX_MS) {
    await new Promise(r => setTimeout(r, READY_POLL_MS));
    let n = -1;
    try { const d = handle.decodeStats(); n = (d && d.sampler && d.sampler.ok) || 0; } catch (e) { return; }
    if (n === last) { if (++stable >= READY_STABLE) return; } else { stable = 0; last = n; }
  }
}

// applyFont(key, verb) — THE SWAP ITSELF, ducked. Shared by the rotation and by a
// hand pick; the only difference between them is persistence and pinning, which the
// caller owns. Never throws: a failed font leaves the set where it was.
async function applyFont(key, verb) {
  if (key !== "fluidr3" && !(await ensureFont(key))) { set({ status: "soundfont unavailable: " + key }); return false; }
  const handle = liveHandle();
  if (!S.live || !handle || !handle.duckVoices) {
    // not playing (or the WAV-first route, which serves pre-rendered segments and has
    // no seam at this end): just set it, no theatre.
    try { K.setFont(key); } catch (e) {}
    S.soundfont = key;
    retarget({ x: S.cursor.x, y: S.cursor.y });
    set({ soundfont: key, status: (verb || "soundfont → ") + fontLabel(key) });
    return true;
  }
  const down = handle.duckVoices(DUCK_TO, DUCK_DOWN_SEC);
  await new Promise(r => setTimeout(r, down * 1000));
  try { K.setFont(key); } catch (e) {}
  // re-target from the live blend, the same path a genre change takes, so the flip
  // queue walks the voices over instead of rebuilding the stream.
  retargetWeights((S.weights || []).map(w => ({ ...w })), null);
  // S.soundfont is WHAT IS SOUNDING — the ⚙ select reads it, and without this write
  // the rotation moves the engine underneath a dropdown frozen on the default.
  set({ soundfont: key, status: (verb || "soundfont → ") + fontLabel(key) });
  await awaitZonesSettled(handle);
  handle.duckVoices(1, DUCK_UP_SEC);
  return true;
}

// pick a font by hand. PINS it — you asked for that one, so the rotation stops until
// the page reloads — and remembers it across sessions.
export async function setSoundfont(key) {
  rotating = false;
  S.fontPinned = true;
  try { localStorage.setItem("vaporwave-soundfont", key); } catch (e) {}
  await applyFont(key, "soundfont → ");
}

// PIN WHATEVER IS SOUNDING — the "rotate" switch turned off. Deliberately NOT
// setSoundfont: nothing should change timbre just because you stopped the rotation,
// so this only latches the current font and remembers it.
export function pinCurrentFont() {
  rotating = false;
  S.fontPinned = true;
  const cur = S.soundfont || "fluidr3";
  try { localStorage.setItem("vaporwave-soundfont", cur); } catch (e) {}
  set({ status: "the set holds on " + fontLabel(cur) });
}

// UN-PIN — hand the set back to the rotation. A pick used to be permanent: it wrote
// localStorage and every later load read it back and switched `rotating` off before
// the first bar, with no affordance anywhere to undo it. This is that affordance.
export function resumeFontRotation() {
  rotating = true;
  S.fontPinned = false;
  try { localStorage.removeItem("vaporwave-soundfont"); } catch (e) {}
  set({ status: "the set rotates again — next change at bar " +
    (Math.floor((S.barCount || 0) / ROTATE_BARS) + 1) * ROTATE_BARS });
}
