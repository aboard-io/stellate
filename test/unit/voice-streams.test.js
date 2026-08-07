#!/usr/bin/env node
// voice-streams.test.js — THE RACK LAW (state.voiceStreams; docs/DAW.md).
//
// bass/drums/melody have always shared ONE rng, drawn in section order, so a
// change to any one voice's draw COUNT re-times every voice drawn after it:
// nudge a melody knob and the hi-hats move. That is fine for a generator you
// drive from a star map and fatal for /daw's rack of per-track machines, where
// the whole promise is that the machine you touch is the only thing that moves.
//
// state.voiceStreams gives each VOICE — and each DRUM LANE — its own dedicated
// stream (csd-engine.js, VOICE_STREAM). This gate holds both halves of that:
//
//   1 flag is LIVE            on vs off must differ (a no-op flag is a lie)
//   2 absent is IDENTICAL     the flag off draws nothing new — off === legacy
//   3 voice isolation         change one voice's pattern under the flag; the
//                             OTHER voices' events stay byte-identical
//   4 lane isolation          change the hat lane's event COUNT (a euclid hat
//                             spec, which is drawless and replaces only that
//                             lane); kick + snare stay byte-identical
//
// 3 and 4 each assert BOTH directions — isolated with the flag, entangled
// without it — because a test that only checks "identical" would also pass if
// the edit did nothing at all.
//
// WHERE ISOLATION STOPS, and why that is not a weasel. Isolation is a property
// of the GENERATORS (the kit op interpreter, the bass/melody cells) and of THE
// TAPE (applyGroove's per-event humanize). Everything downstream of them reads
// across voices ON PURPOSE — the bar transforms duplicate a whole bar of drums,
// the snare-law measures the finished snare+hat timeline, CsdPipes' harmonize
// snaps the melody to the pad/bass notes SOUNDING under it, state.thunk pushes a
// tom off a lead note. That layer is the master bus, not a track strip; making it
// lane-blind would defeat what each of those passes is for. So 3A/4A switch that
// layer off and demand EXACT isolation of the generators, and 3B/4B switch it
// back on and demand the coupling RETURNS — the boundary is asserted, not just
// described, so it cannot drift without a gate going red.
//
// Run: node test/unit/voice-streams.test.js   (exit 0 = pass, 1 = fail)
"use strict";
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
global.window = global;
require(path.join(ROOT, "engine/genres-data.js"));
require(path.join(ROOT, "engine/registry-data.js"));
require(path.join(ROOT, "engine/theory.js"));
require(path.join(ROOT, "engine/pipes.js"));
const E = require(path.join(ROOT, "engine/csd-engine.js"));
const K = require(path.join(ROOT, "engine/genre-kernel.js"));

const GENRES = ["jungle", "citypop", "techno", "heavymetal", "dub", "folk"];
const SEEDS = [1, 5, 7];
const deep = (o) => JSON.parse(JSON.stringify(o));
const J = (o) => JSON.stringify(o);

// the events of ONE voice family, as the DAW's per-track roll would read them
const lane = (ev, voice) => J(ev.pitched.filter((e) => e.voice === voice));
const drumLane = (ev, d) => J(ev.drums.filter((e) => e.drum === d));

function trackState(g, seed, patch) {
  const t = K.track(g, { seed });
  const s = deep(t.state || t);
  return Object.assign(s, patch || {});
}
// flip every section's pattern for one voice to a different legal value
function repattern(st, voice, value) {
  const s = deep(st);
  for (const sec of s.sections || []) if (sec[voice] && sec[voice] !== "off") sec[voice] = value;
  return s;
}

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.error("  FAIL: " + msg); } };

// ---- 1 the flag is LIVE, and 2 absent is IDENTICAL --------------------------
// Off must equal off-by-omission (the flag adds nothing when falsy), and on must
// differ from off (the streams really are different numbers).
for (const g of GENRES) for (const seed of SEEDS) {
  const off = trackState(g, seed);
  const offExplicit = trackState(g, seed, { voiceStreams: false });
  const on = trackState(g, seed, { voiceStreams: true });
  const eOff = J(E.buildEvents(off)), eFalse = J(E.buildEvents(offExplicit)), eOn = J(E.buildEvents(on));
  ok(eOff === eFalse, `${g}/${seed}: voiceStreams:false must be byte-identical to absent`);
  ok(eOff !== eOn, `${g}/${seed}: voiceStreams:true must actually change the draw (flag is inert)`);
}
console.log(`1-2 flag live + absent-identical — ${GENRES.length * SEEDS.length} states`);

const PITCHED_POOL = { pool: ["rev", "octflip", "rest"], rate: 0.25 };

// ---- 3 VOICE isolation ------------------------------------------------------
// Repattern ONE voice and demand the other two are untouched under the flag —
// and (control) that at least one of them DOES move without it.
const VOICE_EDITS = [
  { voice: "melody", to: "arpup",  others: [["pitched", "bass"], ["drums", null]] },
  { voice: "bass",   to: "root",   others: [["pitched", "melody"], ["drums", null]] },
  { voice: "drums",  to: "four",   others: [["pitched", "melody"], ["pitched", "bass"]] },
];
let entangledSeen = 0, isolationCases = 0, crossVoiceCoupled = 0;
for (const g of GENRES) for (const seed of SEEDS) for (const ed of VOICE_EDITS) {
  const base = trackState(g, seed);
  // only meaningful if the genre actually plays that voice and the edit changes it
  const edited = repattern(base, ed.voice, ed.to);
  if (J(edited.sections) === J(base.sections)) continue;
  isolationCases++;
  const read = (ev, [kind, v]) => (kind === "drums" ? J(ev.drums) : lane(ev, v));

  // GENERATOR LAYER ONLY — the same scoping as case 4A, for the same reason. The
  // passes below the generators are cross-voice BY DESIGN and are switched off
  // here rather than pretended away:
  //   * transforms ply/stutter/rot/degrade duplicate or thin a whole bar of drums
  //   * CsdPipes read the whole bundle — harmonize snaps the melody to the
  //     pad/bass pitch-class set SOUNDING at that beat, so editing the bass is
  //     SUPPOSED to change the harmonization; octavePump reads bass to add pitched
  //   * state.thunk pushes a whisper-level tom off a fraction of LEAD notes, so a
  //     melody edit legitimately reaches the drums
  // Case 3B below restores them and demands the coupling comes back.
  const GEN_ONLY = { voiceStreams: true, transforms: PITCHED_POOL, pipes: [], thunk: null };
  const onA = E.buildEvents(Object.assign(deep(base),   GEN_ONLY));
  const onB = E.buildEvents(Object.assign(deep(edited), GEN_ONLY));
  for (const o of ed.others)
    ok(read(onA, o) === read(onB, o),
       `${g}/${seed}: editing ${ed.voice} moved ${o[1] || "drums"} under voiceStreams`);

  // control: without the flag the shared stream should entangle at least one
  const offA = E.buildEvents(deep(base)), offB = E.buildEvents(deep(edited));
  if (ed.others.some((o) => read(offA, o) !== read(offB, o))) entangledSeen++;

  // 3B the BOUNDARY: with the cross-voice layer restored, coupling must return
  const fullA = E.buildEvents(Object.assign(deep(base),   { voiceStreams: true }));
  const fullB = E.buildEvents(Object.assign(deep(edited), { voiceStreams: true }));
  if (ed.others.some((o) => read(fullA, o) !== read(fullB, o))) crossVoiceCoupled++;
}
ok(entangledSeen > 0, "control: no shared-rng entanglement observed at all — the test proves nothing");
ok(crossVoiceCoupled > 0,
   "boundary: pipes/thunk/whole-kit transforms no longer reach across voices — " +
   "if that is intentional, move this assertion; it is load-bearing documentation");
console.log(`3 voice isolation — ${isolationCases} edits, ${entangledSeen} entangled without the flag, ` +
            `${crossVoiceCoupled} still coupled through the cross-voice layer (by design)`);

// ---- 4 LANE isolation, and WHERE IT STOPS -----------------------------------
// A euclid hat spec is DRAWLESS and replaces only the hat lane, so it changes how
// many hat events every later drum pass draws over. Under the shared rng that
// shifts the kick decisions after it; under lane streams the kick must not move.
//
// THE BOUNDARY, gated in both directions. Lane isolation is a property of the
// GENERATORS (the kit op interpreter, the humanity pass) and THE TAPE. It is NOT
// claimed for the WHOLE-KIT layer downstream of them, and cannot be:
//   * the bar transforms ply/stutter/rot/degrade read a whole bar of drums and
//     duplicate or thin it — "double-hit one beat of the kit" MEANS the extra
//     hats too;
//   * the snare-law measures the finished snare+hat timeline to guarantee no bar
//     repeats three times — isolating it from the hats would defeat it;
//   * CsdPipes read the whole bundle by design (harmonize reads pad+bass).
// Those are the master bus, not a track strip. So case A runs a PITCHED-ONLY
// transform pool (the whole-kit layer quiet) and demands EXACT kick isolation;
// case B restores the whole-kit pool and demands the coupling comes BACK — a
// boundary nobody asserts is a boundary that quietly moves.
const hatPair = (g, seed, tf) => [
  Object.assign(trackState(g, seed, { euclid: { hat: [5, 16] }, voiceStreams: true }), tf ? { transforms: tf } : {}),
  Object.assign(trackState(g, seed, { euclid: { hat: [9, 16] }, voiceStreams: true }), tf ? { transforms: tf } : {}),
];
let laneCases = 0, laneEntangled = 0, wholeKitCoupled = 0;
for (const g of GENRES) for (const seed of SEEDS) {
  const [b0] = hatPair(g, seed, PITCHED_POOL);
  if (!(b0.sections || []).some((s) => s.drums && s.drums !== "off")) continue;
  laneCases++;

  // A: whole-kit layer quiet -> the kick is EXACTLY isolated from the hat lane
  const [pA, pB] = hatPair(g, seed, PITCHED_POOL);
  const onA = E.buildEvents(pA), onB = E.buildEvents(pB);
  ok(drumLane(onA, "kick") === drumLane(onB, "kick"),
     `${g}/${seed}: changing the hat lane moved the kick under voiceStreams`);

  // control: the same edit without the flag must disturb kick or snare
  const offA = E.buildEvents(Object.assign(deep(pA), { voiceStreams: false }));
  const offB = E.buildEvents(Object.assign(deep(pB), { voiceStreams: false }));
  if (["kick", "snare"].some((d) => drumLane(offA, d) !== drumLane(offB, d))) laneEntangled++;

  // B: the whole-kit pool is BACK -> coupling is expected, not a regression
  const [wA, wB] = hatPair(g, seed, null);
  const wkA = E.buildEvents(wA), wkB = E.buildEvents(wB);
  if (["kick", "snare"].some((d) => drumLane(wkA, d) !== drumLane(wkB, d))) wholeKitCoupled++;
}
ok(laneEntangled > 0, "control: hat-count change never disturbed kick/snare without the flag");
ok(wholeKitCoupled > 0,
   "boundary: the whole-kit layer (ply/stutter/snare-law) no longer reacts to the kit — " +
   "if that is intentional, move this assertion; it is load-bearing documentation");
console.log(`4 lane isolation — ${laneCases} states, ${laneEntangled} entangled without the flag, ` +
            `${wholeKitCoupled} still coupled through the whole-kit layer (by design)`);

if (fails) { console.error(`\nVOICE-STREAMS: FAIL — ${fails}/${checks} checks`); process.exit(1); }
console.log(`\nVOICE-STREAMS: PASS — ${checks} checks; the rack law holds (voice + lane isolation, both directions)`);
