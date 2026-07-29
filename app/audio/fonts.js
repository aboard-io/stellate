// fonts.js — the SOUNDFONT SWITCHER, in the settings panel.
// The default sampled instruments are FluidR3 (baked into the
// kernel). Alternate fonts, extracted by tools/build/gen-font.js into
// found/samples/instruments-<key>/ + engine/faust/data/font-<key>.json, register with
// the kernel at runtime; picking one re-voices every sampled instrument it
// covers (per-instrument fallback to FluidR3). Presentational — the default is
// untouched, so the deterministic gates are byte-identical.
import { S, set, K } from "../core/state.js";
import { retarget, retargetWeights } from "./targeting.js";
import { goLive, stopLive } from "./live.js";

let manifest = [{ key: "fluidr3", label: "FluidR3 GM (default)" }];
const registered = new Set(["fluidr3"]);

export function fontManifest() { return manifest; }

async function ensureFont(key) {
  if (registered.has(key)) return true;
  // SYNTH FONTS (B: MiniMoog/DX7) are built into the kernel — no assets to fetch;
  // K.setFont already knows them. The manifest flags them with `synth:true`.
  const entry = manifest.find(f => f.key === key);
  if (entry && entry.synth) { registered.add(key); return true; }
  try {
    const d = await (await fetch("engine/faust/data/font-" + key + ".json")).json();
    K.registerFont(key, d); registered.add(key); return true;
  } catch (e) { return false; }
}

// boot: load the manifest, register + apply the saved font (before the first play)
export async function loadFonts() {
  try { const m = await (await fetch("engine/faust/data/fonts.json")).json(); if (Array.isArray(m) && m.length) manifest = m; } catch (e) {}
  // ?sf= or a stored pick means the listener chose a font — honour it and do not
  // rotate. ?fonts=off pins the default. Otherwise the set rotates from bar 0.
  let pinned = null;
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("fonts") === "off") pinned = S.soundfont || "fluidr3";
    else if (q.get("sf")) pinned = q.get("sf");
    else if (localStorage.getItem("vaporwave-soundfont")) pinned = localStorage.getItem("vaporwave-soundfont");
  } catch (e) {}
  if (pinned) { rotating = false; S.soundfont = pinned; }
  const want = pinned || fontAt(S.startBar || 0);
  if (want !== "fluidr3") { const ok = await ensureFont(want); if (!ok) { S.soundfont = "fluidr3"; } }
  try { K.setFont((want !== "fluidr3" && registered.has(want)) ? want : "fluidr3"); } catch (e) {}
  set({});
  return manifest;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE ROTATION — the set changes instruments every ROTATE_BARS, and keeps coming
// home to the analog one.
//
// A font swap used to mean stopLive() → rebuild → goLive(): a hard cut, because
// every font reused the same `ins_<instr>_<n>` zone ids and the engine's decode
// caches are keyed by them, so two fonts could not be in memory at once. Once
// genre-kernel's zoneSrcId qualifies the id by the file it came from (see there),
// both fonts' buffers coexist and the swap can go through the machinery that
// already exists for crossing genres: set the font, re-TARGET, and let the flip
// queue walk the voices over one at a time — one flip per two bars, HOLD_BARS
// apart, identity dims first. That is the gentle part, and none of it is new.
//
// SEAMLESS BETWEEN SAMPLED FONTS, CROSSFADED AROUND THE SYNTH ONES. faust/live.js
// sigOf() — the stream-topology signature that decides whether the ring has to
// reopen — ignores sampler units entirely, so fluidr3 → sgm → windows never
// reopens anything. minimoog and dx7 are SYNTH fonts: they replace instruments
// with synthesised voices, which does move the signature, so those two edges take
// the engine's designed crossfade rather than the voice-by-voice walk. Different
// character, still no gap.
//
// THE CYCLE returns to Pure Analog on every other step — the prettiest one should
// be the one you keep arriving back at — and touches each of the other four in
// turn. 8 steps × 32 bars = one full tour every 256 bars.
export const ROTATE_BARS = 32;
export const FONT_CYCLE = [
  "fluidr3",   // the default the genres are authored against
  "minimoog",  // Pure Analog
  "sgm",       // SGM Pro 15
  "minimoog",
  "windows",   // Seattle Glass Factory
  "minimoog",
  "dx7",       // Pure FM
  "minimoog",
];
// DETERMINISTIC FROM THE BAR, so a shared link reproduces the instruments as well
// as the notes: the URL already carries the measure (?m=), and the rotation is a
// pure function of it. No clock, no rng.
export function fontAt(bar) { return FONT_CYCLE[Math.floor(Math.max(0, bar) / ROTATE_BARS) % FONT_CYCLE.length]; }

let rotating = true;                 // a hand-picked font PINS the set (see setSoundfont)
let rotateBusy = false;
export function fontRotating() { return rotating; }
export function setFontRotating(on) { rotating = !!on; }

// called once per bar from live.js's onBar. Two jobs: swap on the boundary, and
// pre-register the NEXT font a few bars early so its zone map is in hand when the
// boundary arrives (a font that is not registered silently falls back to the
// default, which would read as "the rotation skipped one").
export async function fontRotateTick(bar) {
  if (!rotating || rotateBusy) return;
  const want = fontAt(bar);
  const next = fontAt(bar + 4);
  if (next !== want) { ensureFont(next); }         // best-effort prefetch, unawaited
  let cur = "fluidr3";
  try { cur = K.activeFont(); } catch (e) {}
  if (want === cur) return;
  rotateBusy = true;
  try {
    if (!(await ensureFont(want))) return;         // unavailable → stay where we are
    K.setFont(want);
    // Re-target from the CURRENT blend rather than the cursor: access.html drives
    // the same engine with no cursor at all, and the blend is what both pages have.
    retargetWeights((S.weights || []).map(w => ({ ...w })), null);
    set({ status: "the set picks up " + fontLabel(want) });
  } catch (e) { /* a rotation must never take the music down */ }
  finally { rotateBusy = false; }
}
export function fontLabel(key) { return (manifest.find(f => f.key === key) || {}).label || key; }

// pick a font by hand: this PINS it — you asked for that one, so the rotation
// stops until the page is reloaded. Still the old stop/start path, because a
// deliberate pick should land immediately rather than trickle in over ten bars.
export async function setSoundfont(key) {
  if (key !== "fluidr3") { const ok = await ensureFont(key); if (!ok) { set({ status: "soundfont unavailable: " + key }); return; } }
  rotating = false;
  S.soundfont = key;
  try { localStorage.setItem("vaporwave-soundfont", key); } catch (e) {}
  try { K.setFont(key); } catch (e) {}
  const wasLive = S.live;
  if (wasLive) stopLive();
  retarget({ x: S.cursor.x, y: S.cursor.y });   // rebuild S.playing with the new font (now stopped)
  set({ status: "soundfont → " + fontLabel(key) + " (pinned)" + (wasLive ? " — reloading…" : "") });
  if (wasLive) setTimeout(() => { try { goLive(); } catch (e) {} }, 160);
}
