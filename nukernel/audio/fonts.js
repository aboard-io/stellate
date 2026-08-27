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

// WHERE A FONT'S DATA LIVES — the key→url rule, in ONE place. The hold
// (audio/offline.js) has to fetch exactly this file before a tunnel, and a
// second copy of the string "data/font-<key>.json" is the kind of duplicate
// that survives a rename on one side only. Answers null for the two kinds of
// font that HAVE no file: fluidr3 is the kernel's own default table, and a
// synth font is a voice rather than a zone library. Same two refusals loadFont
// makes below, so what the hold holds and what the page fetches cannot drift.
export function fontUrl(key) {
  const def = FONTS.find(f => f.key === key);
  if (key === "fluidr3" || (def && def.kind === "synth")) return null;
  return FAUSTDIR + "data/font-" + key + ".json";
}

// LOAD AND REGISTER, then tell the kernel to use it. `setFont` on the kernel is
// what makes applySampledOnly answer with that font's zones, so every later
// translation (audio/plan.js, which memoizes its library on exactly this key)
// resolves through it.
export async function loadFont(key, K) {
  // fluidr3 IS the kernel's default table and a SYNTH font has no zones to
  // fetch — `fontUrl` is where that pair of refusals is written now.
  if (!fontUrl(key)) return;
  if (!loaded.has(key)) loaded.set(key, (async () => {
    try {
      const r = await fetch(fontUrl(key));
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
