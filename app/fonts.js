// fonts.js — the SOUNDFONT SWITCHER, in the settings panel.
// The default sampled instruments are FluidR3 (baked into the
// kernel). Alternate fonts, extracted by tools/gen-font.js into
// found/samples/instruments-<key>/ + engine/faust/font-<key>.json, register with
// the kernel at runtime; picking one re-voices every sampled instrument it
// covers (per-instrument fallback to FluidR3). Presentational — the default is
// untouched, so the deterministic gates are byte-identical.
import { S, set, K } from "./state.js";
import { retarget } from "./targeting.js";
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
    const d = await (await fetch("engine/faust/font-" + key + ".json")).json();
    K.registerFont(key, d); registered.add(key); return true;
  } catch (e) { return false; }
}

// boot: load the manifest, register + apply the saved font (before the first play)
export async function loadFonts() {
  try { const m = await (await fetch("engine/faust/fonts.json")).json(); if (Array.isArray(m) && m.length) manifest = m; } catch (e) {}
  const want = S.soundfont || "fluidr3";
  if (want !== "fluidr3") { const ok = await ensureFont(want); if (!ok) S.soundfont = "fluidr3"; }
  try { K.setFont(S.soundfont || "fluidr3"); } catch (e) {}
  set({});
  return manifest;
}

// pick a font live: register (lazy-fetch its zones), rebuild the current mix, and
// hot-restart the engine so its sample caches reload (srcIds are shared).
export async function setSoundfont(key) {
  if (key !== "fluidr3") { const ok = await ensureFont(key); if (!ok) { set({ status: "soundfont unavailable: " + key }); return; } }
  S.soundfont = key;
  try { localStorage.setItem("vaporwave-soundfont", key); } catch (e) {}
  try { K.setFont(key); } catch (e) {}
  const wasLive = S.live;
  if (wasLive) stopLive();
  retarget({ x: S.cursor.x, y: S.cursor.y });   // rebuild S.playing with the new font (now stopped)
  const label = (manifest.find(f => f.key === key) || {}).label || key;
  set({ status: "soundfont → " + label + (wasLive ? " (reloading…)" : "") });
  if (wasLive) setTimeout(() => { try { goLive(); } catch (e) {} }, 160);
}
