#!/usr/bin/env node
// mine-melody.js — melody phrase cells mined from the corpus DB, in exactly
// csd-engine's MEL_PHRASES format: [[beatOffset, dur, leadIndex, octShift]...]
// over one 8-beat chord bar.
//
//   node tools/mine-melody.js <rip> [--db path] [--min-conf 0.55] [--name folkline]
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
//      thousand melodies is a monotone (measured, 2026-07-15). Typicality also
//      selects AGAINST distinctive hooks, and the 8-slot voicing quantization
//      keeps the cell a contour, not a quotation (SOURCES.md policy),
//   5. durations are the medoid's own, capped at the inter-onset gap.
//
// Output: ready-to-splice MEL_PHRASES lines + the corpus fingerprint
// (sync16/stepFrac medians) so the emitted cell can be judged against the
// genre it claims to speak for (test/melody-cells.test.js re-checks the
// rendered result).
"use strict";
const C = require("./corpus-db.js");
const Mine = require("./mine-midi.js");

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
    const byWin = new Map();
    for (const n of line) {
      const o = Math.round(n.beat * 4) / 4;
      const w = Math.floor(o / 8);
      (byWin.get(w) || byWin.set(w, []).get(w)).push({ o: o - w * 8, pitch: n.pitch, dur: n.dur });
    }
    for (const win of byWin.values()) {
      if (win.length < 4 || win.length > maxNotes) continue;
      win.sort((a, b) => a.o - b.o || a.pitch - b.pitch);
      const dedup = [];   // one note per onset slot (skyline within the window)
      for (const n of win) { const last = dedup[dedup.length - 1]; if (last && last.o === n.o) { if (n.pitch > last.pitch) { last.pitch = n.pitch; last.dur = n.dur; } } else dedup.push({ ...n }); }
      if (dedup.length < 4) continue;
      const sig = dedup.map(n => n.o).join(",");
      const ps = dedup.map(n => n.pitch), lo = Math.min(...ps), hi = Math.max(...ps);
      if (hi === lo) continue;
      (sigWindows.get(sig) || sigWindows.set(sig, []).get(sig)).push(dedup);
    }
  }
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
  console.log(`corpus melody fingerprint: sync16 ${med(fp.sync16).toFixed(3)}  stepFrac ${med(fp.stepFrac).toFixed(3)}  (medians over trusted lines)`);

  const minWin = +opt("--min-windows", 8);
  const ranked = [...sigWindows.entries()].filter(([, w]) => w.length >= minWin).sort((a, b) => b[1].length - a[1].length);
  if (ranked.length < 2) { console.error("not enough recurring 8-beat rhythms — corpus too small or too free"); process.exit(2); }

  const stepMed = med(fp.stepFrac);
  const winStats = (w) => {
    const iv = []; for (let i = 0; i + 1 < w.length; i++) iv.push(w[i + 1].pitch - w[i].pitch);
    const abs = iv.map(Math.abs);
    return { step: abs.filter(a => a >= 1 && a <= 2).length / iv.length,
             up: iv.filter(v => v > 0).length / Math.max(1, iv.filter(v => v !== 0).length),
             range: Math.max(...w.map(n => n.pitch)) - Math.min(...w.map(n => n.pitch)) };
  };
  const emit = (sig, wins) => {
    // MEDOID: the window most typical of the corpus's interval character;
    // deterministic tiebreak = first in file order (DB iteration is id-ordered)
    let best = null, bestD = Infinity;
    for (const w of wins) {
      const s = winStats(w);
      const d = Math.abs(s.step - stepMed) + 0.5 * Math.abs(s.up - 0.5) + (s.range > 24 ? 1 : 0);
      if (d < bestD) { bestD = d; best = w; }
    }
    const lo = Math.min(...best.map(n => n.pitch)), hi = Math.max(...best.map(n => n.pitch));
    return best.map((n, i) => {
      const tone = Math.round(((n.pitch - lo) / (hi - lo)) * 7);   // 0..7 -> (idx, oct)
      const gap = (i + 1 < best.length ? best[i + 1].o : 8) - n.o;
      const d = Math.max(0.25, Math.min(2, Math.round(Math.min(n.dur, gap) * 4) / 4));
      return [n.o, d, tone % 4, tone >> 2];
    });
  };
  const A = emit(ranked[0][0], ranked[0][1]), B = emit(ranked[1][0], ranked[1][1]);
  const js = (cell) => "[" + cell.map(n => `[${n.join(",")}]`).join(",") + "]";
  console.log(`\nA (modal rhythm, ${ranked[0][1].length} windows):  ${name}:  ${js(A)},`);
  console.log(`B (runner-up,   ${ranked[1][1].length} windows):  ${name}2: ${js(B)},`);
  const sync = (cell) => cell.filter(([o]) => Math.abs(o - Math.round(o)) > 0.01).length / cell.length;
  console.log(`cell onset-sync (off-beat fraction): A ${sync(A).toFixed(2)}  B ${sync(B).toFixed(2)}`);
}
main();
