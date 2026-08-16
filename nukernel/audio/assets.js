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
import { isMachine, machineBuffer } from "./machines.js";

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

/* ---------- the decode gate ---------- */
// ONE shared throttle over EVERY decodeAudioData on the page, the parent's
// makeDecGate shape (live.js). Before it, a six-instrument song fired 120-180
// concurrent fetch+decodes on the first Play — the exact pattern the parent
// measured choking iOS's decoder (a melody never becomes audible while tiny
// drum one-shots survive) and starving the main thread with Float32 copies.
// Cap concurrency to a few; RETRY a transient failure with linear backoff so
// one flaky fetch on a phone never permanently strands a voice.
function makeDecGate(limit, retries, retryMs) {
  let inFlightN = 0, maxInFlight = 0; const waiters = [];
  const acquire = () => new Promise(res => {
    if (inFlightN < limit) { inFlightN++; if (inFlightN > maxInFlight) maxInFlight = inFlightN; res(); }
    else waiters.push(res);
  });
  const release = () => { if (waiters.length) waiters.shift()(); else inFlightN--; };
  const nap = ms => new Promise(r => setTimeout(r, ms));
  async function run(fn, okp) {
    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      await acquire();
      let v = null;
      try { v = await fn(); } catch (e) { v = null; lastErr = e; }
      release();
      if (okp(v)) return { v, err: null };
      if (lastErr == null) lastErr = "decoded empty";
      if (attempt >= retries) break;
      await nap(retryMs * (attempt + 1));
    }
    return { v: null, err: lastErr };
  }
  return { run, stats: () => ({ maxInFlight, inFlight: inFlightN, limit }) };
}
const decGate = makeDecGate(4, 3, 500);
// TRI-STATE, NOT POISON. A key is: absent = never requested (fetch it);
// present-with-buffer = ok; in decFails with runs < MAXRUNS = failed but
// RETRYABLE — zoneBufs deliberately does NOT carry it, so the next
// ensureAssets pass re-requests it; only after MAXRUNS exhausted gate-runs is
// the null written and the zone final. The old cache set null on the FIRST
// throw — a transient fetch drop on a phone downgraded an instrument to the
// oscillator fallback for the whole session, which is the failure the audio
// gate is written to fail on.
const MAXRUNS = 2;
const decFails = new Map();                       // key -> { runs, err }
function noteFail(map, key, err) {
  const f = decFails.get(key) || { runs: 0, err: null };
  f.runs++; f.err = String(err && err.message || err);
  decFails.set(key, f);
  if (f.runs >= MAXRUNS) map.set(key, null);      // now, and only now, final
}
const fetchable = (map, key) => {
  if (map.get(key)) return false;                 // decoded, done
  if (map.has(key)) return false;                 // null = final failure
  return true;                                    // never asked, or retryable
};
async function decodeInto(map, key, url) {
  if (!fetchable(map, key)) return;
  const { v, err } = await decGate.run(async () => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status + " " + url.split("/").pop());
    return await ctx.decodeAudioData(await r.arrayBuffer());
  }, b => !!(b && b.length));
  if (v) { map.set(key, v); decFails.delete(key); }
  else noteFail(map, key, err);
}
// what the gate and the ?debug readout may know about decode health
window.__nuDecode = () => ({ ...decGate.stats(),
  failed: [...decFails].map(([k, f]) => ({ key: k, runs: f.runs, err: f.err })) });

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
  // Promise.all is fine now: the shared gate holds these to 4 in flight, so
  // "every zone at once" is a queue, not a stampede
  await Promise.all(spec.zones.map(z =>
    decodeInto(zoneBufs, FONT + "|" + id + "|" + z.file,
      MEDIA + (spec.base || "instruments") + "/" + spec.dir + "/" + z.file)));
  inFlight.delete("ins:" + id);
  return true;
}
// every instrument the song needs, decoded before the transport starts
export function instrumentsInSong() {
  const ids = new Set([BASS_INSTR]);
  for (const sec of SONG)
    for (const e of stackOf(sec)) {
      // a layer's `instr` override is what its chairs actually play, so it is
      // what must decode; the genre's own list stays in the set too, because
      // clearing the override mid-play must not find an unfetched guitar
      if (e.instr) ids.add(e.instr);
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
  // A MACHINE KIT IS SYNTHESIZED, NOT FETCHED — rendered once from a seeded
  // source (audio/machines.js) into the same "kit|lane" buffers a decoded kit
  // lands in, so playDrum never learns a second path. Every DRUMFILE lane gets
  // a voice (the house law: a lane the map cannot name is a silent drum), and
  // the buffers are context-free, so the offline bounce strikes the same bytes.
  if (isMachine(kit)) {
    for (const lane of Object.keys(DRUMFILE)) {
      const key = kit + "|" + lane;
      if (!drumBufs.has(key)) {
        const b = machineBuffer(kit, lane, ctx);
        if (b) drumBufs.set(key, b);
      }
    }
    return;
  }
  inFlight.add("kit:" + kit);
  await Promise.all(Object.entries(DRUMFILE).map(([lane, file]) =>
    decodeInto(drumBufs, kit + "|" + lane, DRUMDIR + kit + "/" + file)));
  inFlight.delete("kit:" + kit);
}
