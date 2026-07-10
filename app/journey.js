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

// summary for headless verification: distinct genres crossed, bar count, seconds
export function walkLoopSummary(opts) {
  const w = walkLoop(opts);
  if (!w) return null;
  const genres = [];
  for (const r of w.bars) { const g = r.one && r.one.genre; if (g && genres[genres.length - 1] !== g) genres.push(g); }
  return { total: w.total, seconds: +w.musicalSec.toFixed(1), n: w.n, pace: w.pace,
    distinctGenres: [...new Set(genres)].length, genreOrder: genres.slice(0, 24) };
}
