// audio/fonts.js — which soundfont is playing. All of it.
//
// This is what is left of audio/assets.js (219 lines of fetch, decode, zone
// cache, kit cache and a decode gate) after the one-engine round. Every one of
// those jobs is the parent's: engine/genre-kernel.js has had a SOUNDFONT
// SWITCHER since long before nukernel existed — registerFont / setFont /
// activeFont over the same engine/faust/data/font-<key>.json files this page was
// fetching for itself — and engine/faust/voices/sampler.js does the decoding,
// with the parent's own concurrency gate and bounded retry in front of it
// (live.js makeDecGate). A second copy of that decoded the same wav twice and
// gave the page and the tape two chances to disagree about which zone answered.
//
// So this file holds the CHOICE and hands it down. The list itself is data and
// lives in instruments.js; the fetch is one request per font, once.
import { FONTS } from "../ui/deps.js";

const FAUSTDIR = new URL("../../engine/faust/", import.meta.url).href;

export let FONT = "fluidr3";
export const fontDef = () => FONTS.find(f => f.key === FONT) || FONTS[0];
export const isSynthFont = () => fontDef().kind === "synth";

const loaded = new Map();                          // key -> promise of registration

// LOAD AND REGISTER, then tell the kernel to use it. `setFont` on the kernel is
// what makes applySampledOnly answer with that font's zones, so every later
// translation (audio/plan.js, which memoizes its library on exactly this key)
// resolves through it.
export async function loadFont(key, K) {
  const def = FONTS.find(f => f.key === key);
  // fluidr3 IS the kernel's default table and a SYNTH font has no zones to fetch
  if (key === "fluidr3" || (def && def.kind === "synth")) return;
  if (!loaded.has(key)) loaded.set(key, (async () => {
    try {
      const r = await fetch(FAUSTDIR + "data/font-" + key + ".json");
      if (r.ok && K && K.registerFont) K.registerFont(key, await r.json());
    } catch (e) { /* a font that will not fetch simply stays unregistered */ }
  })());
  await loaded.get(key);
}

export async function setFont(key, K) {
  FONT = key;
  await loadFont(key, K);
  // a SYNTH font is not a font to the kernel at all — it is a voice, and the
  // translation reads it off fontDef(). Put the kernel back on the sampled table
  // so its half of the answer is the sampled one.
  if (K && K.setFont) K.setFont(isSynthFont() ? "fluidr3" : key);
}
