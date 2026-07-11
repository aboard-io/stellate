// journey.js — the OFFLINE WHOLE-PATH walk (Paul: "export the entire path, not
// just the current song. The whole mix"). Drives the SAME per-bar walk the live
// conductors use (FaustLive.makeWalk), but fed a getState that walks the loop
// deterministically — so we can render/collect the full journey without playing
// it in real time. One full loop = waypoints × pace bars. The audio/MIDI/video
// exporters consume the per-bar payloads this produces.
import { S } from "./state.js";
import { stateAt } from "./targeting.js";
import { travelForBar, pointOnPath } from "./share.js";

// walk one full loop, returning the per-bar render payloads (r = {one, units,
// events, spb, lo, hi, found, foundSources, meta, ...}) plus the note-level
// buildEvents per bar (for MIDI). opts.bars caps the walk (default one loop).
export function walkLoop(opts) {
  opts = opts || {};
  const E = window.CsdEngine, SE = window.FaustStateEngine, FL = window.FaustLive;
  if (!E || !SE || !FL || !FL.makeWalk) return null;
  const n = S.waypoints.length; if (n < 2) return null;
  const pace = Math.max(8, Math.min(4096, +S.pace || 256));
  const total = Math.max(1, opts.bars || (n * pace));
  let cur = null;
  const stepWalk = FL.makeWalk(() => cur, E, SE, 0);
  const bars = [];
  let musicalSec = 0;
  for (let b = 0; b < total; b++) {
    cur = stateAt(pointOnPath(travelForBar(b)));
    const r = stepWalk();
    r._musicalStart = musicalSec;
    musicalSec += r.musicalSec;
    bars.push(r);
  }
  return { bars, total, n, pace, musicalSec, seed: S.seed };
}

// ── WHOLE-PATH AUDIO planning (the offline conductor) ───────────────────────
// One openLive session fixes the FAUST timbre TOPOLOGY (voice units + reverb +
// master modules); the loop evolves genre-to-genre, so a single session can't
// carry the whole path. buildLoopPlan groups consecutive bars into topology-
// stable RUNS (a new run = a crossfade seam), each rendered in its own
// openLive(bakeNative) session by the worker, then enumerates every found /
// sampler / vocoder source the whole loop touches so the caller can decode them
// ONCE and ship a single buffer table (srcIds are global) into the render.

// the feedBar barSpec from a walk payload (mirrors live.js postFeed exactly).
function loopBarSpec(r) {
  return { units: r.units, events: r.events, fxParams: r.fxParams, spb: r.spb, lo: r.lo, hi: r.hi,
    sweeps: r.sweepsRaw, found: r.found, foundCi: r.meta.ci, meta: r.meta };
}

// the topology key: the faust unit signature PLUS the master-stage modules
// (reverb color + master comp) that openLive fixes at open — a change in any of
// them must start a fresh session, or the later bars would render in the wrong
// space. Found/sampler are native (baked per bar) and don't gate the session.
function topoKey(r, SE) {
  const rc = SE.reverbColor(r.one), mb = SE.masterMb(r.one);
  return r.sig + "|" + (rc ? rc.module : "") + "|" + (mb ? mb.module : "");
}

// the vocoder carrier a run needs (openLive loops the RAW carrier): the run's
// state.vocoderSourceId or the first sp_/vx_/vox_ found source — but only when a
// unit in the run actually vocodes (mirrors export.js/press decodeInputs).
function vocoderIdFor(r) {
  if (!Object.values(r.units).some((u) => u && u.vocoder)) return null;
  const fs = r.foundSources || [];
  const vs = fs.find((s) => s.id === r.one.vocoderSourceId) || fs.find((s) => /^(sp_|vx_|vox_)/.test(s.id || ""));
  return vs ? vs.id : null;
}

// buildLoopPlan(opts) -> { runs, foundIds, samplerIds, speechIds, total, musicalSec, n, pace, seed }
//   runs: [{ state, bars:[barSpec…], vocoderId }]  — one topology-stable session each
//   foundIds/samplerIds/speechIds: every source the loop touches (decode once)
// Returns null if the walk can't run (no engine / no path). The heavy PCM never
// touches this thread — the worker renders each run; this only plans.
export function buildLoopPlan(opts) {
  const w = walkLoop(opts);
  if (!w || !w.bars.length) return null;
  const SE = window.FaustStateEngine;
  const runs = [];
  const foundIds = new Set(), samplerIds = new Set(), speechIds = new Set();
  const byId = {};   // srcId -> source record (url/synthText/samplePath) for the decoder
  let curKey = null, cur = null;
  for (const r of w.bars) {
    for (const s of (r.foundSources || [])) if (s && s.id && !byId[s.id]) byId[s.id] = s;
    const key = topoKey(r, SE);
    if (key !== curKey) {
      curKey = key;
      cur = { state: r.one, bars: [], vocoderId: vocoderIdFor(r) };
      if (cur.vocoderId) speechIds.add(cur.vocoderId);
      runs.push(cur);
    }
    cur.bars.push(loopBarSpec(r));
    // every found source this bar plays, and every sampler zone's source
    for (const f of (r.found || [])) foundIds.add(f.srcId);
    for (const e of (r.events || [])) { const u = r.units[e.unit];
      if (u && u.sampler) for (const z of (u.sampler.zones || [])) samplerIds.add(z.srcId); }
  }
  return { runs, byId, foundIds: [...foundIds], samplerIds: [...samplerIds], speechIds: [...speechIds],
    total: w.total, musicalSec: w.musicalSec, n: w.n, pace: w.pace, seed: w.seed };
}

// WHOLE-PATH MIDI: walk the loop and assemble one SMF spanning the full journey
// (every genre it crosses), not just the current song. Returns Uint8Array | null.
export function buildLoopMidi(opts) {
  const w = walkLoop(opts);
  if (!w || !window.MidiExport || !window.MidiExport.buildMidiJourney) return null;
  const bars = []; let startBeat = 0;
  for (const r of w.bars) {
    const cbeats = (r.meta && r.meta.cbeats) || (r.ev && r.ev.totalBeats) || 8;
    bars.push({ ev: r.ev, startBeat, bpm: (r.ev && r.ev.bpm) || (r.one && r.one.bpm) || 88 });
    startBeat += cbeats;
  }
  return window.MidiExport.buildMidiJourney(bars);
}

// summary for headless verification: distinct genres crossed, bar count, seconds
export function walkLoopSummary(opts) {
  const w = walkLoop(opts);
  if (!w) return null;
  const genres = [];
  for (const r of w.bars) { const g = r.one && r.one.genre; if (g && genres[genres.length - 1] !== g) genres.push(g); }
  return { total: w.total, seconds: +w.musicalSec.toFixed(1), n: w.n, pace: w.pace,
    distinctGenres: [...new Set(genres)].length, genreOrder: genres.slice(0, 24) };
}
