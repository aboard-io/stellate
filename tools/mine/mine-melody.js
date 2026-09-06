#!/usr/bin/env node
// mine-melody.js — melody phrase cells mined from the corpus DB, in exactly
// csd-engine's MEL_PHRASES format: [[beatOffset, dur, leadIndex, octShift]...]
// over one 8-beat chord bar.
//
//   node tools/mine/mine-melody.js <rip> [--db path] [--min-conf 0.55] [--name folkline]
//
// Method (deterministic, no rng):
//   1. take the rip's trusted melody lines (mel_conf >= --min-conf; for
//      solo-piano corpora like ragtime pass a lower floor explicitly — the
//      skyline IS the right hand there, stated caveat),
//   2. quantize onsets to the 16th and slice into 8-beat windows; keep
//      playable phrases (4..16 notes),
//   3. the cell RHYTHM is the corpus's MODAL onset signature — the single
//      most common 8-beat melodic rhythm (exact-match counting, no fuzzy
//      clustering to argue with); the B variant is the runner-up,
//   4. the cell CONTOUR is the MEDOID window of that rhythm — the single real
//      phrase whose interval character (stepFrac/upFrac/range) sits closest to
//      the corpus fingerprint — mapped onto the 8 available voicing slots
//      (leadIndex 0..3 × octave 0..1). NOT a per-slot average: the median of a
//      thousand melodies is a monotone (measured). Typicality also
//      selects AGAINST distinctive hooks, and the 8-slot voicing quantization
//      keeps the cell a contour, not a quotation (SOURCES.md policy),
//   5. durations are the medoid's own, capped at the inter-onset gap.
//
// Output: ready-to-splice MEL_PHRASES lines + the corpus fingerprint
// (sync16/stepFrac medians) so the emitted cell can be judged against the
// genre it claims to speak for (test/unit/melody-cells.test.js re-checks the
// rendered result).
"use strict";
const C = require("./corpus-db.js");
const Mine = require("./mine-midi.js");

/* ---- THE THREE PIECES, LIFTED OUT OF main() 2026-09-06 --------------------
   `tools/remix.js` slices ONE file the way this script slices a whole rip, and
   a second copy of the window/skyline/medoid arithmetic would be exactly the
   drift this repo has a law against. So the three steps of the method above —
   (2) window and skyline, (4) the interval-character medoid, and the interval
   statistics both of them read — are functions now, `main()` calls them, and
   the CLI's output is byte-identical (the `--prove` of this move is that the
   three bodies were CUT and PASTED, not retyped). `win` is a parameter rather
   than the literal 8 for the one reason remix needs: a 3/4 or 7/8 record's bar
   is not two beats of four, and a window that straddles the barline is not a
   phrase. Everything else defaults to what this file always did. */

/** onset-signature -> [window], where a window is [{o, pitch, dur}] with one
 *  note per onset slot (the skyline within the window). */
function windowsOf(line, { win = 8, minNotes = 4, maxNotes = 16, into = null } = {}) {
  const sigWindows = into || new Map();
  const byWin = new Map();
  for (const n of line) {
    const o = Math.round(n.beat * 4) / 4;
    const w = Math.floor(o / win);
    (byWin.get(w) || byWin.set(w, []).get(w)).push({ o: o - w * win, pitch: n.pitch, dur: n.dur, vel: n.vel });
  }
  for (const [wi, w] of byWin) {
    if (w.length < minNotes || w.length > maxNotes) continue;
    w.sort((a, b) => a.o - b.o || a.pitch - b.pitch);
    const dedup = [];   // one note per onset slot (skyline within the window)
    for (const n of w) { const last = dedup[dedup.length - 1]; if (last && last.o === n.o) { if (n.pitch > last.pitch) { last.pitch = n.pitch; last.dur = n.dur; last.vel = n.vel; } } else dedup.push({ ...n }); }
    if (dedup.length < minNotes) continue;
    const sig = dedup.map(n => n.o).join(",");
    const ps = dedup.map(n => n.pitch), lo = Math.min(...ps), hi = Math.max(...ps);
    if (hi === lo) continue;
    dedup._win = wi;                     // which window of the line it was
    (sigWindows.get(sig) || sigWindows.set(sig, []).get(sig)).push(dedup);
  }
  return sigWindows;
}

/** a window's interval character: step fraction, rising fraction, range. */
function winStats(w) {
  const iv = []; for (let i = 0; i + 1 < w.length; i++) iv.push(w[i + 1].pitch - w[i].pitch);
  const abs = iv.map(Math.abs);
  return { step: abs.filter(a => a >= 1 && a <= 2).length / iv.length,
           up: iv.filter(v => v > 0).length / Math.max(1, iv.filter(v => v !== 0).length),
           range: Math.max(...w.map(n => n.pitch)) - Math.min(...w.map(n => n.pitch)) };
}

/** THE MEDOID: the window most typical of the corpus's interval character;
 *  deterministic tiebreak = first in iteration order. */
function medoid(wins, stepMed) {
  let best = null, bestD = Infinity;
  for (const w of wins) {
    const s = winStats(w);
    const d = Math.abs(s.step - stepMed) + 0.5 * Math.abs(s.up - 0.5) + (s.range > 24 ? 1 : 0);
    if (d < bestD) { bestD = d; best = w; }
  }
  return best;
}

/** the medoid mapped onto the 8 voicing slots — MEL_PHRASES 4-tuples. */
function melPhrase(best, win = 8) {
  const lo = Math.min(...best.map(n => n.pitch)), hi = Math.max(...best.map(n => n.pitch));
  return best.map((n, i) => {
    const tone = Math.round(((n.pitch - lo) / (hi - lo)) * 7);   // 0..7 -> (idx, oct)
    const gap = (i + 1 < best.length ? best[i + 1].o : win) - n.o;
    const d = Math.max(0.25, Math.min(2, Math.round(Math.min(n.dur, gap) * 4) / 4));
    return [n.o, d, tone % 4, tone >> 2];
  });
}

function main() {
  const argv = process.argv.slice(2);
  const rip = argv[0];
  const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
  if (!rip || rip.startsWith("--")) { console.error("usage: mine-melody.js <rip> [--db p] [--min-conf .55] [--name cellname]"); process.exit(1); }
  const Sqlite = C.requireSqlite();
  const db = new Sqlite(opt("--db", "/mnt/sources/relocated/stellate-midi-corpus/corpus.db"), { readonly: true });
  const minConf = +opt("--min-conf", 0.55);
  const maxNotes = +opt("--max-notes", 16);   // dense-run corpora (ragtime 16ths) need more headroom
  const name = opt("--name", rip + "line");

  const rows = db.prepare("SELECT f.ppq, f.mel_conf, m.blob FROM files f JOIN melody m ON m.file_id=f.id WHERE f.rip=? AND f.mel_conf>=?").all(rip, minConf);
  console.log(`${rip}: ${rows.length} trusted melody lines (mel_conf>=${minConf})`);

  // windows: onset signature -> [{tones per slot}...]
  const sigWindows = new Map();
  const fp = { sync16: [], stepFrac: [] };
  for (const r of rows) {
    const line = C.unpackNotes(r.blob, r.ppq);
    const ms = C.melodyStats(line);
    if (ms) { fp.sync16.push(ms.sync16); fp.stepFrac.push(ms.stepFrac); }
    windowsOf(line, { win: 8, minNotes: 4, maxNotes, into: sigWindows });
  }
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
  console.log(`corpus melody fingerprint: sync16 ${med(fp.sync16).toFixed(3)}  stepFrac ${med(fp.stepFrac).toFixed(3)}  (medians over trusted lines)`);

  const minWin = +opt("--min-windows", 8);
  const ranked = [...sigWindows.entries()].filter(([, w]) => w.length >= minWin).sort((a, b) => b[1].length - a[1].length);
  if (ranked.length < 2) { console.error("not enough recurring 8-beat rhythms — corpus too small or too free"); process.exit(2); }

  const stepMed = med(fp.stepFrac);
  const emit = (sig, wins) => melPhrase(medoid(wins, stepMed), 8);
  const A = emit(ranked[0][0], ranked[0][1]), B = emit(ranked[1][0], ranked[1][1]);
  const js = (cell) => "[" + cell.map(n => `[${n.join(",")}]`).join(",") + "]";
  console.log(`\nA (modal rhythm, ${ranked[0][1].length} windows):  ${name}:  ${js(A)},`);
  console.log(`B (runner-up,   ${ranked[1][1].length} windows):  ${name}2: ${js(B)},`);
  const sync = (cell) => cell.filter(([o]) => Math.abs(o - Math.round(o)) > 0.01).length / cell.length;
  console.log(`cell onset-sync (off-beat fraction): A ${sync(A).toFixed(2)}  B ${sync(B).toFixed(2)}`);
}

module.exports = { windowsOf, winStats, medoid, melPhrase };
if (require.main === module) main();
