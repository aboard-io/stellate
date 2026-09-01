#!/usr/bin/env node
// test/loop-reach.test.js — LOOP-POINT OVERRIDES, MEASURED ON RENDERED PCM
// (2026-08-30, the sampling round).
//
// The pinned per-unit params: `loopa` (loop start, 0..1 fraction of the zone),
// `loopb` (loop end, 0..1), `loopon` (0 = the zone's own default, 1 = force
// loop, 2 = force one-shot). One owner: state-engine samplerUnit reads them
// off the recipe and stamps the zones; sampler.js resolveLoop is the one
// resolver on BOTH play paths (mixPCM reads the stamped zone; live.js calls
// resolveLoop for the AudioBufferSourceNode points). This probe is the memory
// law made a gate — "six params declared, costed and reaching no sound;
// measure, never trust a slider" — so every check below renders samples
// through the SHIPPED mixPCM and measures, no wiring reads.
//
//   L1  loopon=2 dies at the zone end: a note held past the zone renders
//       silence after the zone runs out, where the default loop sustains.
//   L2  loopon=1 with the zone's own points is BYTE-IDENTICAL to today's
//       looped zone (the absent-is-today law, held at the seam).
//   L3  loopa/loopb moved to a different region provably changes the PCM
//       (different bytes) and still sustains.
//   L4  the click law (sampler.js's MP3 lead-in comment: a seam 25 ms off is
//       "an audible click at every loop wrap"): the zero-cross snap takes the
//       seam discontinuity of a deliberately mid-cycle loop point down to the
//       signal's own slope — measured as |src[start]-src[end]| raw vs
//       snapped, and as the max sample step of the rendered sustain.
//   L5  the param path: pitchedUnit(m.loopa/loopb/loopon) stamps every zone
//       and echoes the pinned names on u.sampler; absent keys leave the zones
//       array the SAME reference (absent-law at the owner).
//   L6  the word channel: to-engine samplerVox carries loopin/loopout/looping
//       (numbers pass through; fields.js owns any word tables) as
//       loopa/loopb/loopon — the same channel atk/rel ride.
//   L7  the found crate as units: recipeFor seats `found:<id>` as a one-zone
//       sampler through the SAME lane (a SOURCES bed loops by default, a
//       SAMPLES one-shot doesn't; the src entry rides for the crate), and the
//       overrides land on the found zone too.
//
// Run:  node test/loop-reach.test.js
"use strict";
const path = require("path");
const R = (p) => path.join(__dirname, "..", p);

let fails = 0, checks = 0;
const ok = (cond, what, detail) => {
  checks++;
  if (cond) { console.log("  ok   " + what); return true; }
  fails++; console.log("  FAIL " + what + (detail ? "\n       " + detail : ""));
  return false;
};

const SP = require(R("engine/faust/voices/sampler.js"));
const SE = require(R("engine/faust/voices/state-engine.js"));

const SR = 44100;
const rms = (a, from, to) => { let s = 0, n = 0;
  for (let i = from; i < to; i++) { s += a[i] * a[i]; n++; }
  return Math.sqrt(s / Math.max(1, n)); };
const bytesEq = (a, b) => { if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };

/* ---------- the zone: 2 s, two audibly different halves ------------------- */
// first second: 220 Hz sine at 0.5; second second: the same sine at 0.25 —
// same zero crossings everywhere (the snap always has a target), different
// bytes per region (a moved loop is provable), fully deterministic.
const LEN = 2 * SR;
const SRCV = new Float32Array(LEN);
for (let i = 0; i < LEN; i++)
  SRCV[i] = Math.sin(2 * Math.PI * 220 * i / SR) * (i < SR ? 0.5 : 0.25);
const BUFS = { t: SRCV };
const ZONE = { srcId: "t", root: 69, lo: 0, hi: 127,
               loop: 1, loopStart: 4410, loopEnd: 44100, len: LEN, sr: SR };

// render one A4 note (rate 1 at root 69) held 3 s into a 4 s bus, through the
// SHIPPED mixPCM — the exact renderer press and the stream renderer run.
function render(zone) {
  const TOTAL = 4 * SR;
  const into = { dry: new Float32Array(TOTAL), rev: new Float32Array(TOTAL), del: new Float32Array(TOTAL) };
  SP.mixPCM([{ tSec: 0, durSec: 3, freq: 440, atk: 0.01, rel: 0.09, gain: 0.5, zones: [zone] }],
    BUFS, SR, into, { dry: 1, rev: 0, del: 0 });
  return into.dry;
}
const unit = (m) => SE.pitchedUnit("melody", { model: "sampler",
  sampler: { id: "probe", sr: SR, zones: [ZONE] }, ...m }, { bpm: 120, seed: 1, instrumentSeed: 1 });

(async () => {
console.log("test/loop-reach.test.js — the loop points reach the sound\n");

/* ---------- L1/L2/L3: reach, through the OWNER (pitchedUnit stamps) ------- */
const base = render(unit({}).sampler.zones[0]);
const base2 = render(unit({}).sampler.zones[0]);
ok(bytesEq(base, base2), "L0 determinism: two renders of the same zone are byte-equal");

const lateRms = (pcm) => rms(pcm, Math.floor(2.2 * SR), Math.floor(2.9 * SR));
const baseLate = lateRms(base);
ok(baseLate > 0.05, "L0 baseline: the looped zone sustains past the zone end",
   "late RMS " + baseLate.toFixed(4));

const oneShot = render(unit({ loopon: 2 }).sampler.zones[0]);
const oneLate = lateRms(oneShot);
ok(oneLate < 1e-6 && rms(oneShot, 0, SR) > 0.05,
   "L1 loopon=2 dies at the zone end (sound before it, silence after)",
   "late RMS " + oneLate.toExponential(2) + " vs baseline " + baseLate.toFixed(4));
console.log("       MEASURE (a): late-window RMS baseline " + baseLate.toFixed(4)
  + " -> loopon=2 " + oneLate.toExponential(2));

const forced = render(unit({ loopon: 1 }).sampler.zones[0]);
ok(bytesEq(forced, base),
   "L2 loopon=1 with the zone's own points is byte-identical to today");
console.log("       MEASURE (b): loopon=1 default points — " +
  (bytesEq(forced, base) ? "0 differing samples of " + base.length : "BYTES MOVED"));

const movedU = unit({ loopa: 0.55, loopb: 0.95 });
const moved = render(movedU.sampler.zones[0]);
const movedLate = lateRms(moved);
let firstDiff = -1;
for (let i = 0; i < base.length; i++) if (base[i] !== moved[i]) { firstDiff = i; break; }
ok(firstDiff >= 0 && movedLate > 0.02,
   "L3 loopa/loopb moved to the quiet half: different bytes, still sustained",
   "first differing sample " + firstDiff + ", late RMS " + movedLate.toFixed(4));
// the moved region is the 0.25-amp half: the sustain must sit near half the
// baseline's level, which is the REGION audibly changing, not just a bit flip
ok(movedLate < baseLate * 0.75, "L3b the sustain level is the new region's own",
   "late RMS " + movedLate.toFixed(4) + " vs baseline " + baseLate.toFixed(4));
console.log("       MEASURE (c): first differing sample " + firstDiff
  + " (loop start lands ~" + Math.round(0.55 * LEN) + "), late RMS "
  + movedLate.toFixed(4) + " vs baseline " + baseLate.toFixed(4));

/* ---------- L4: the click law --------------------------------------------- */
// pick raw points ON a peak and ON a trough of the quiet half — the worst
// seam a loop editor can ask for — and measure the discontinuity the snap
// removes. (resolveLoop's nosnap arg exists for exactly this measurement.)
let iA = -1, iB = -1;
for (let i = Math.floor(1.1 * SR); i < LEN; i++) {
  if (iA < 0 && SRCV[i] > 0.24) iA = i;
  else if (iA >= 0 && SRCV[i] < -0.24) { iB = i; break; }
}
// stretch the loop out to a musical length so the seam recurs but the region
// stays inside the quiet half
iB = iA + Math.floor(0.5 * SR);
while (SRCV[iB] > -0.24) iB++;   // land the end on a trough
const zClick = { ...ZONE, loopa: iA / LEN, loopb: iB / LEN };
const raw = SP.resolveLoop(zClick, SRCV, 1, 0, true);
const snp = SP.resolveLoop(zClick, SRCV, 1, 0);
const dRaw = Math.abs(SRCV[Math.round(raw.loopStart)] - SRCV[Math.round(raw.loopEnd)]);
const dSnap = Math.abs(SRCV[snp.loopStart] - SRCV[snp.loopEnd]);
ok(dRaw > 0.4 && dSnap < 0.02 && dSnap < dRaw / 10,
   "L4 zero-cross snap kills the seam discontinuity",
   "raw |src[a]-src[b]| " + dRaw.toFixed(4) + " -> snapped " + dSnap.toFixed(6));
// ...and on the RENDERED sustain: the max sample step must be the sine's own
// slope, not a click. 0.25 amp * note gain (0.5 * GAIN) * 2*pi*220/SR is the
// signal's honest max step; a raw peak->trough seam would be ~40x it.
const clicked = render({ ...ZONE, loopa: zClick.loopa, loopb: zClick.loopb });
let maxStep = 0;
for (let i = Math.floor(0.5 * SR); i < Math.floor(2.9 * SR); i++) {
  const d = Math.abs(clicked[i] - clicked[i - 1]);
  if (d > maxStep) maxStep = d;
}
const slope = 0.25 * 0.5 * SP.GAIN * 2 * Math.PI * 220 / SR;
ok(maxStep < slope * 3, "L4b the rendered sustain has no step above the signal's own slope",
   "max step " + maxStep.toFixed(6) + " vs signal slope " + slope.toFixed(6));
console.log("       MEASURE (click): seam discontinuity raw " + dRaw.toFixed(4)
  + " -> snapped " + dSnap.toFixed(6) + "; rendered max step " + maxStep.toFixed(6)
  + " (signal slope " + slope.toFixed(6) + ")");

/* ---------- L5: the owner and the absent-law ------------------------------ */
const uv = unit({ loopa: 0.6, loopb: 0.9, loopon: 1 });
ok(uv.sampler.loopa === 0.6 && uv.sampler.loopb === 0.9 && uv.sampler.loopon === 1,
   "L5 the pinned names ride the unit spec (u.sampler.loopa/loopb/loopon)");
ok(uv.sampler.zones[0].loopa === 0.6 && uv.sampler.zones[0].loopb === 0.9
   && uv.sampler.zones[0].loopon === 1 && uv.sampler.zones[0].loopStart === ZONE.loopStart,
   "L5b the stamp rides every zone, over the zone's own defaults");
const uAbsent = unit({});
ok(uAbsent.sampler.zones[0] === ZONE && uAbsent.sampler.loopa === undefined,
   "L5c absent keys leave the zones array untouched (same reference)");
ok(unit({ loopa: 7 }).sampler.loopa === 1 && unit({ loopon: 9 }).sampler.loopon === undefined,
   "L5d out-of-range values clamp (loopa) or drop (loopon not 1/2)");

/* ---------- L6/L7: the bridge (word channel + found crate) ---------------- */
globalThis.__REGISTRY = require(R("engine/registry-data.js"));
const TE = await import(R("nukernel/audio/to-engine.js"));
const sv = TE.samplerVox({ loopin: 0.25, loopout: 0.75, looping: 2 });
ok(sv && sv.loopa === 0.25 && sv.loopb === 0.75 && sv.loopon === 2,
   "L6 samplerVox carries loopin/loopout/looping as the pinned params",
   JSON.stringify(sv));
ok(TE.samplerVox({ atk: "soft" }) && TE.samplerVox({ atk: "soft" }).loopa === undefined,
   "L6b a vox without loop words writes no loop keys (absent-law)");

const seatBed = { chair: "line", instr: "found:bbc_arcade_85", synth: null, tone: null, vox: null };
const rBed = TE.recipeFor("line", seatBed, {}, []);
const zBed = rBed.m && rBed.m.sampler && rBed.m.sampler.zones[0];
/* "sampler:found:" since 2026-09-01 (loop-words W1): a found chair plays
   through samplerUnit + sampler.js — the recipe's own `model` says sampler,
   and instruments.js sampledId answers true — so the source string now says
   the lane it went down. The claim this line makes is unchanged: a SOURCES
   bed seats as a ONE-ZONE looped sampler unit. */
ok(rBed.source === "sampler:found:bbc_arcade_85" && zBed && zBed.srcId === "bbc_arcade_85"
   && zBed.loop === 1 && zBed.loopa === 0 && zBed.loopb === 1,
   "L7 a SOURCES bed seats as a one-zone sampler unit, whole-file loop by default",
   JSON.stringify(rBed.m && rBed.m.sampler));
/* L7b CHANGED 2026-08-30 (the grain round), and the old assertion was pinning
   a bug. It read `foundSrc.url === "found/bbc_arcade_85.64.mp3"` — the
   registry's own repo-relative path, copied through verbatim — and that is
   exactly what made a found chair SILENT on the page. The consumers read
   `s.url || samplePath` with url FIRST (export/_satpress decodeCrate), and
   nukernel/index.html lives one directory down, so a bare "found/…" resolves
   to /nukernel/found/… — measured 404 there, 200 at the site root. The zone
   then decodes against an empty buffer table.
   MEASURED, on the pressed record: `tapemusic` cast on three BBC beds came
   back at -64.1 dBFS with the old shape and -38.1 dBFS with this one, a 26 dB
   arrival, its three recordings going from inaudible to the record itself.
   So a LOCAL bed now carries `samplePath` and NO url — the same convention
   the kit sources next to it have always used (`url: ""`, samplePath set) —
   and a bed whose url has a scheme is untouched. */
ok(rBed.m.foundSrc && rBed.m.foundSrc.id === "bbc_arcade_85" && rBed.m.foundSrc.vol === 0
   && rBed.m.foundSrc.samplePath === "found/bbc_arcade_85.64.mp3"
   && rBed.m.foundSrc.url === "",
   "L7b a LOCAL bed's src entry rides the recipe by samplePath, not by a page-relative url",
   JSON.stringify(rBed.m.foundSrc));
const uBed = SE.pitchedUnit(rBed.role, rBed.m, { bpm: 120, seed: 1 });
ok(uBed.sampler && uBed.sampler.zones[0].srcId === "bbc_arcade_85" && !uBed.module,
   "L7c the parent seats the found unit through samplerUnit (native lane)");

const rHit = TE.recipeFor("line", { ...seatBed, instr: "found:bbc_lutine_bell" }, {}, []);
const zHit = rHit.m && rHit.m.sampler && rHit.m.sampler.zones[0];
ok(zHit && zHit.srcId === "bbc_lutine_bell" && !zHit.loop && zHit.loopa == null,
   "L7d a SAMPLES one-shot seats unlooped",
   JSON.stringify(zHit));
ok(rHit.m.foundSrc && rHit.m.foundSrc.samplePath === "found/samples/bbc/lutine_bell.wav",
   "L7e the one-shot decodes by samplePath, like the kernel's own SAMPLES rows");

// the WHOLE channel, end to end: words on the seat -> recipe -> unit -> zone
const rWord = TE.recipeFor("line", { ...seatBed, vox: { looping: 2, loopin: 0.1 } }, {}, []);
const uWord = SE.pitchedUnit(rWord.role, rWord.m, { bpm: 120, seed: 1 });
ok(uWord.sampler && uWord.sampler.zones[0].loopon === 2 && uWord.sampler.zones[0].loopa === 0.1,
   "L7f the seat's loop words land on the found unit's zone (one channel, end to end)");

console.log("\n" + (fails ? "FAIL " + fails + "/" + checks : "PASS " + checks + " checks"));
process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
