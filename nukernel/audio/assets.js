// audio/assets.js — fetch and decode: soundfonts, instrument zones, drum kits.
// This file answers "is the sample for that note in memory yet"; WHICH
// instrument a genre plays is data (genres.js `instr`, via instruments.js),
// and actually sounding a note is audio/voices.js.
//
// Layer graph: deps -> state -> derive -> graph -> THIS FILE -> voices ->
// mixer -> transport. Needs graph for the AudioContext (nothing decodes
// without one) and state for the song (what does THIS song need).
import { SAMPLERS, GENRES, instrOf, BASS_INSTR, DRUMDIR, DRUMFILE,
         FONTS } from "../ui/deps.js";
import { SONG } from "../ui/state.js";
import { stackOf } from "../ui/derive.js";
import { ctx } from "./graph.js";

// fetch/import paths are computed from THIS module's URL, not the document's —
// a module's dynamic import() resolves against the module, and this file lives
// one directory deeper than kernel-daw.js did
export const FAUSTDIR = new URL("../../engine/faust/", import.meta.url).href;
export const MEDIA = new URL("../../found/samples/", import.meta.url).href;

/* ---------- fonts ---------- */
// The list itself is data and lives in instruments.js; what stays here is the
// STATE — which font is current — and the fetch/decode machinery, which needs
// the network and the AudioContext.
export let FONT = "fluidr3";
export const fontDef = () => FONTS.find(f => f.key === FONT) || FONTS[0];
export const isSynthFont = () => fontDef().kind === "synth";
const fontData = new Map();                       // key -> font-<key>.json
export function setFont(key) {
  FONT = key;
  // the spec cache is keyed on FONT|id, so a font change makes every entry
  // stale at once — clearing is both correct and cheaper than checking
  specCache.clear();
}
export async function loadFont(key) {
  // a SYNTH font has no zone file to fetch — it is a voice, not a sample set
  const def = FONTS.find(f => f.key === key);
  if (key === "fluidr3" || (def && def.kind === "synth") || fontData.has(key)) return;
  try {
    const r = await fetch(FAUSTDIR + "data/font-" + key + ".json");
    fontData.set(key, r.ok ? await r.json() : null);
  } catch (e) { fontData.set(key, null); }
}

/* ---------- instrument zones ---------- */
// Assets currently being fetched. A note whose instrument is IN FLIGHT is
// dropped, not played on the fallback oscillator: a moment of silence while a
// guitar decodes is honest, a beep in its place is not.
export const inFlight = new Set();
export const zoneBufs = new Map();                // "font|id|file" -> AudioBuffer

// MEMOISED per FONT|id. specOf used to rebuild the whole zone list per NOTE —
// a fresh object and a fresh ~100-entry zones array every time — and
// foldToZones kept a Map keyed on those throwaway arrays' identity, so its
// cache never hit and the page retained one dead array per note played, for
// ever. One cached spec per instrument ends the allocation AND the leak, and
// lets the identity-keyed span cache downstream finally work.
const specCache = new Map();                      // "font|id" -> spec
export const specOf = id => {
  const ck = FONT + "|" + id;
  const got = specCache.get(ck);
  if (got !== undefined) return got;
  // per-INSTRUMENT fallback, exactly as the main app does it: a font that does
  // not carry this instrument serves the default one rather than going silent
  const F = fontData.get(FONT);
  let spec = null;
  if (F && F.instr && F.instr[id]) {
    spec = { sr: F.instr[id].sr, dir: id, base: F.base,
      zones: F.instr[id].zones.map(z => ({ file: z.file, root: z.root, lo: z.lo,
        hi: z.hi, loop: !!z.loop, loopStart: z.ls, loopEnd: z.le, sr: F.instr[id].sr })) };
  } else {
    const S = SAMPLERS[id];
    if (S) spec = { sr: S.sr, dir: S.dir, base: "instruments", zones: S.zones.map(z => ({
      file: z.file, root: z.root, lo: z.lo, hi: z.hi,
      loop: !!z.loop, loopStart: z.ls, loopEnd: z.le, len: z.len, sr: S.sr })) };
  }
  specCache.set(ck, spec);
  return spec;
};
export async function loadInstrument(id) {
  const spec = specOf(id);
  if (!spec) return false;
  inFlight.add("ins:" + id);
  await Promise.all(spec.zones.map(async z => {
    const key = FONT + "|" + id + "|" + z.file;
    if (zoneBufs.has(key)) return;
    try {
      const r = await fetch(MEDIA + (spec.base || "instruments") + "/" + spec.dir + "/" + z.file);
      if (!r.ok) throw new Error(r.status + " " + z.file);
      zoneBufs.set(key, await ctx.decodeAudioData(await r.arrayBuffer()));
    } catch (e) { zoneBufs.set(key, null); }
  }));
  inFlight.delete("ins:" + id);
  return true;
}
// every instrument the song needs, decoded before the transport starts
export function instrumentsInSong() {
  const ids = new Set([BASS_INSTR]);
  for (const sec of SONG)
    for (const e of stackOf(sec)) {
      const n = GENRES[e.g] ? GENRES[e.g].voices : 1;
      for (let v = 0; v < n; v++) ids.add(instrOf(e.g, v));
    }
  return [...ids];
}

/* ---------- drum kits ---------- */
// THE DRUM KIT IS SAMPLED TOO — found/samples/drums/<kit>/, the same
// extraction the big engine plays. The file map is instruments.js data; the
// decoding is here because it needs the AudioContext.
export const drumBufs = new Map();                // "kit|lane" -> AudioBuffer
export async function loadKit(kit) {
  inFlight.add("kit:" + kit);
  await Promise.all(Object.entries(DRUMFILE).map(async ([lane, file]) => {
    const key = kit + "|" + lane;
    if (drumBufs.has(key)) return;
    try {
      const r = await fetch(DRUMDIR + kit + "/" + file);
      if (!r.ok) throw new Error(String(r.status));
      drumBufs.set(key, await ctx.decodeAudioData(await r.arrayBuffer()));
    } catch (e) { drumBufs.set(key, null); }
  }));
  inFlight.delete("kit:" + kit);
}
