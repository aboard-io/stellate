#!/usr/bin/env node
// bed-budget.js — THE bed-count definition, so the number is reproducible.
//
//   node tools/audit/bed-budget.js            # the headline numbers
//   node tools/audit/bed-budget.js --json     # machine-readable
//   node tools/audit/bed-budget.js --seeds 1,3,5,7,9
//
// docs/TODO.md carried "1.34 -> 2.75 distinct remote beds decoded per track" as
// the media-budget headline, and nobody could reproduce it: counting distinct
// section-level bed sourceIds gave 3.44, counting every fetched found source gave
// 5.56, and neither matched. A budget number that cannot be re-derived turns into
// a false regression the first time someone measures it differently. So this file
// IS the definition, and it reports all three counts side by side rather than
// picking one and hiding the others:
//
//   BEDS            distinct sources a section draws with role "bed" — the
//                   sustained texture layer, the thing "beds per track" means.
//   FOUND           every FETCHED found source the schedule actually references
//                   (beds + breaks + chops + hits + vox), excluding synthText
//                   (synthesized, never fetched) and excluding instrument zones.
//   INSTRUMENT      the sampler zones the song can voice across all its sections
//                   — buildSchedule's units, which is what faust/live.js warms.
//                   NOT state.foundSources: the sampled-by-default pass injects
//                   the WHOLE candidate library there (measured 629 zone rows,
//                   ~105 MB) so any pick is playable, and counting that would
//                   overstate a track's real cost by ~33x.
//
// Bytes are the files on disk, so a re-encode moves them honestly.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
global.window = global;
require(path.join(ROOT, "engine/theory.js"));
require(path.join(ROOT, "engine/pipes.js"));
const E = require(path.join(ROOT, "engine/csd-engine.js"));
const K = require(path.join(ROOT, "engine/genre-kernel.js"));
const SE = require(path.join(ROOT, "engine/faust/voices/state-engine.js"));

const args = process.argv.slice(2);
const JSON_OUT = args.includes("--json");
const si = args.indexOf("--seeds");
const SEEDS = si >= 0 ? args[si + 1].split(",").map(Number) : [1, 3, 5, 7, 9];

// found/<id>.64.mp3 — the engine's own convention (found-player localPathFor).
const EXTS = [".64.mp3", ".mp3", ".wav", ".ogg"];
const _size = Object.create(null);
function bytesOf(p) {
  if (_size[p] == null) { try { _size[p] = fs.statSync(path.join(ROOT, p)).size; } catch (e) { _size[p] = 0; } }
  return _size[p];
}
function foundBytes(id, src) {
  if (src && src.samplePath) return bytesOf(src.samplePath);
  for (const e of EXTS) { const b = bytesOf("found/" + id + e); if (b) return b; }
  return 0;
}
const zonePath = Object.create(null);
for (const id of Object.keys(K.SAMPLERS || {})) {
  const S = K.SAMPLERS[id];
  S.zones.forEach((z, i) => { zonePath["ins_" + id + "_" + i] = "found/samples/instruments/" + S.dir + "/" + z.file; });
}

const acc = { n: 0, beds: 0, bedBytes: 0, bedMax: 0, found: 0, foundBytes: 0, ins: 0, insBytes: 0, bbc: 0 };
for (const g of Object.keys(K.GENRES)) {
  for (const seed of SEEDS) {
    let st, sch;
    try { st = K.track(g, { seed }); sch = SE.buildSchedule(E, st); } catch (e) { continue; }
    acc.n++;
    const byId = Object.create(null);
    for (const s of (st.foundSources || [])) if (s && s.id) byId[s.id] = s;

    // BEDS — the sustained layer, named by the SECTION that draws it
    const beds = new Set();
    for (const sec of (st.sections || [])) {
      const f = sec && sec.found;
      if (f && f.role === "bed" && f.sourceId) beds.add(f.sourceId);
    }
    acc.beds += beds.size; if (beds.size > acc.bedMax) acc.bedMax = beds.size;
    for (const id of beds) acc.bedBytes += foundBytes(id, byId[id]);
    if ([...beds].some((id) => /^bbc_/.test(id))) acc.bbc++;

    // FOUND — every fetched source the schedule references
    const found = new Set();
    for (const f of (sch.found || [])) {
      const s = byId[f.srcId];
      if (!f.srcId || !s || s.synthText) continue;       // synthesized = never fetched
      if (/^ins_/.test(f.srcId)) continue;                // instrument zones counted below
      found.add(f.srcId);
    }
    acc.found += found.size;
    for (const id of found) acc.foundBytes += foundBytes(id, byId[id]);

    // INSTRUMENT — the zones this song can voice across all its sections
    const zs = new Set();
    for (const u of Object.values(sch.units || {}))
      if (u && u.sampler) for (const z of (u.sampler.zones || [])) if (z.srcId) zs.add(z.srcId);
    acc.ins += zs.size;
    for (const id of zs) acc.insBytes += bytesOf(zonePath[id] || "");
  }
}

const n = Math.max(1, acc.n);
const out = {
  definition: "tools/audit/bed-budget.js",
  states: acc.n, genres: Object.keys(K.GENRES).length, seeds: SEEDS,
  bedsPerTrack: +(acc.beds / n).toFixed(2), bedsMax: acc.bedMax,
  bedMBPerTrack: +(acc.bedBytes / n / 1e6).toFixed(2),
  bbcReachPct: +(100 * acc.bbc / n).toFixed(1),
  foundPerTrack: +(acc.found / n).toFixed(2), foundMBPerTrack: +(acc.foundBytes / n / 1e6).toFixed(2),
  instrumentZonesPerTrack: +(acc.ins / n).toFixed(1), instrumentMBPerTrack: +(acc.insBytes / n / 1e6).toFixed(2),
};
out.totalMBPerTrack = +(out.foundMBPerTrack + out.instrumentMBPerTrack).toFixed(2);

if (JSON_OUT) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
console.log(`bed budget — ${out.states} states (${out.genres} genres x seeds ${SEEDS.join(",")})\n`);
console.log(`  BEDS        ${out.bedsPerTrack} per track (max ${out.bedsMax}), ${out.bedMBPerTrack} MB   BBC reach ${out.bbcReachPct}%`);
console.log(`  FOUND       ${out.foundPerTrack} per track, ${out.foundMBPerTrack} MB   (beds + breaks + chops + hits + vox; synthesized speech excluded)`);
console.log(`  INSTRUMENT  ${out.instrumentZonesPerTrack} zones per track, ${out.instrumentMBPerTrack} MB   (what the song can voice, NOT the injected library)`);
console.log(`\n  a track's fetched media: ${out.totalMBPerTrack} MB`);
console.log(`\n  (the route precache warms HORIZON_MIN minutes of PLAY ahead of the traveler,`);
console.log(`   so a session pays for the tracks it reaches, not for the path — app/audio/precache.js)`);
