// nukernel/export/score.js — THE COMPILED TIMELINE BECOMES A SCORE, in the one
// function both the CLI and the ⤓ button call.
//
// WHY THIS FILE EXISTS AT ALL, 2026-08-29. This was the body of
// `tools/ableton/score-node.mjs loadScore()` and nowhere else, because the only
// exporter was a node CLI. The in-page button needs the identical fold, and the
// worst possible answer was to write it a second time in ui/eight.js: two
// implementations of "what does this record's timeline mean" is exactly the
// drift this repo has a law against. So the ARITHMETIC moved here — pure, no
// node builtins, no DOM, no state — and the two callers keep only what is
// genuinely theirs:
//
//   tools/ableton/score-node.mjs   stands a window up, reads a file or a genre
//                                  key, adopts it, warms, compiles       (node)
//   nukernel/export/als-page.js    the record already on screen, already
//                                  adopted, already compiled           (browser)
//
// Both then hand the SAME `plan.timeline()` and `plan.cast()` to `scoreOf`
// below, which is why test/als-page.browser.js can demand that the page and the
// CLI produce byte-identical XML for the same record and get it.
//
// VELOCITY, AND THE MIGRATION P3 MUST NOT FORGET (kept verbatim from the file
// this came out of, because it is still true and still one edit from being
// wrong). This reads plan.timeline(), whose events carry the WRITTEN velocity
// 0..9, so `vel` is the composer's mark and nothing else. plan.barPlan()'s
// `amp` is pitchAmp(vel,acc) x the desk's automation gain (plan.js:520-527) and
// is therefore the HEARD loudness with the fader already in it. The day P3
// writes real volume envelopes, velocity must stay the written value or the
// fader ride is counted twice.
import { GM_DRUM } from "./als.js";

/** The exporter's own words for a song. nukernel/export/als.js takes only this. */
/** @typedef {{ midi:number, beat:number, dur:number, vel:number }} Note */
/** @typedef {{ name:string, chair:string, instr:string, notes:Note[] }} Lane */
/** @typedef {{ name:string, beat0:number, beats:number, lanes:Lane[] }} Box */
/** @typedef {{ title:string, bpm:number, grid:boolean, engine:boolean, boxes:Box[] }} Score */

// The inverse of to-engine.js:47's pchOf. csound pch is octave.semitone with the
// semitone in hundredths: 8 -> 60, 8.05 -> 65, 9 -> 72, 7.11 -> 59.
export const midiOfPch = (p) => {
  const o = Math.floor(p + 1e-9);
  return 60 + (o - 8) * 12 + Math.round((p - o) * 100);
};

// MIDI velocity 1..127 off the written 0..9 scale (derive.js songBars), 9 -> 127.
export const velOfWritten = (v) => Math.max(1, Math.min(127, Math.round((v == null ? 5 : v) / 9 * 127)));

// THE BOX NUMBER IS PART OF THE NAME, and it is not decoration. A four-box song
// on one genre gives four boxes the same label ("New York 1994" x4), the clip
// names collide, and gate 1 counted eight clips where it wanted two — which is
// how this line came to exist, rather than by taste.
const labelOf = (bar) => (bar.g && (bar.g.label || bar.g.name)) || "box";

// The instrument the cast seated in this chair, or nothing when the engine was
// not warmed and there is no cast to ask.
const instrOf = (key, cast) => {
  const seat = cast.find((c) => c.v === key);
  return (seat && seat.instr) || "";
};

/**
 * Bring a lane inside MIDI 0..127, A WHOLE LINE AT A TIME.
 *
 * This exists because the gate caught it, not because anybody predicted it:
 * `--genre hymn --all` put seat v0 (ahh_choir) at register home +2 over a part
 * written 24..110, which is MIDI 134 — and midiClip was silently clamping it to
 * 127, so five notes in the first clip arrived as a wrong pitch and gate 1's
 * multiset said "want 134, got 127". The engine never had this problem: it
 * works in Hz and csound pch, where 134 is just a high note, and only the
 * export has a 7-bit ceiling.
 *
 * The move is plan.js's own law, applied one layer down — "A WHOLE LINE MOVES,
 * OR THE LINE BREAKS" (plan.js:90): shift the entire lane by whole octaves so
 * the intervals survive. A lane wider than ten octaves cannot fit, and only
 * then does a note move on its own; that has never happened on the 122 anchors.
 */
function fitMidi(lane) {
  if (!lane.notes.length) return 0;
  let moved = 0;
  const hi = () => Math.max(...lane.notes.map((n) => n.midi));
  const lo = () => Math.min(...lane.notes.map((n) => n.midi));
  while (hi() > 127 && lo() - 12 >= 0) { for (const n of lane.notes) n.midi -= 12; moved++; }
  while (lo() < 0 && hi() + 12 <= 127) { for (const n of lane.notes) n.midi += 12; moved++; }
  for (const n of lane.notes) {
    while (n.midi > 127) { n.midi -= 12; moved++; }
    while (n.midi < 0) { n.midi += 12; moved++; }
  }
  return moved;
}

/**
 * Fold a COMPILED nukernel timeline into a Score.
 *
 * @param {object} o
 * @param {Array}  o.timeline  plan.timeline() — the bar list compile() built
 * @param {Array}  o.cast      plan.cast(), or [] when the engine was not warmed
 * @param {number} o.bpm       state.bpm
 * @param {boolean} o.grid     whether rubato was OFF when this was compiled
 * @param {boolean} o.engine   whether the engine was warmed (cast + register home)
 * @param {string} o.title     what to call the song in the CLI's own printout
 */
export function scoreOf({ timeline, cast = [], bpm, grid = true, engine = true, title = "nukernel" }) {
  if (!timeline || !timeline.length) throw new Error("compile() produced no bars");
  const boxes = [];
  for (const bar of timeline) {
    if (bar.first || !boxes.length)
      boxes.push({ si: bar.si, name: (bar.si + 1) + " " + labelOf(bar), beat0: bar.beat0, beats: 0, bars: [] });
    const box = boxes[boxes.length - 1];
    box.beats += bar.barSteps / 4;
    box.bars.push(bar);
  }
  let skipped = 0, folded = 0;
  for (const box of boxes) {
    const lanes = new Map();
    const put = (key, chair, note) => {
      let lane = lanes.get(key);
      if (!lane) lanes.set(key, lane = { name: key, chair, instr: instrOf(key, cast), notes: [] });
      lane.notes.push(note);
    };
    for (const bar of box.bars) {
      const t0 = bar.beat0 - box.beat0;             // where this bar starts inside its own box
      // `off` is the position INSIDE the bar in steps, and it is the HUMANIZED
      // one: derive.js:718-720 warps off and dur through the groove/swing map
      // before the bar list is built. Four steps to a beat.
      const at = (e) => t0 + e.off / 4;
      for (const e of bar.ev) {
        if (e.kind === "hit") {
          const midi = GM_DRUM[e.d];
          if (midi == null) { skipped++; continue; }
          // A drum hit carries no written length — the sample decides. A 16th
          // is the shortest thing that still reads as a bar in Live's editor.
          put("drums", "drums", { midi, beat: at(e), dur: 0.25, vel: velOfWritten(e.vel) });
        } else if (e.n != null) {
          const key = e._seat != null ? "v" + e._seat
                    : e.kind === "bass" ? "bass" : "v" + (e.v == null ? 0 : e.v);
          put(key, e.kind === "bass" ? "bass" : (e.part || "line"),
              { midi: e.n + (e.home || 0), beat: at(e),
                dur: Math.max(0.03125, (e.dur || 1) / 4), vel: velOfWritten(e.vel) });
        } else skipped++;
      }
    }
    // v0, v1, … then the unseated bass, then drums: the order Live shows them in.
    const rank = (n) => (n === "drums" ? 2 : n === "bass" ? 1 : 0);
    box.lanes = [...lanes.values()].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
    for (const l of box.lanes) { folded += fitMidi(l); l.notes.sort((a, b) => a.beat - b.beat || a.midi - b.midi); }
    /* THE SECTION'S PACE, MEASURED OFF THE TIMELINE AND NEVER OFF A TABLE
       (2026-08-30, the five-walls follow-up — the .mid tempo map). A paced
       section's bars were stretched in BEATS by audio/plan.js paceTL —
       `barSteps` moved, `steps` kept the grid ("exactly as warpBars leaves
       them") — so the stretch is a fact this fold can read off every bar it
       already walks: k = barSteps / steps. Stamped per box so a writer that
       CAN say tempo (export/smf.js smfFromScore) may un-stretch the beats and
       write bpm/k as a set-tempo instead, and a writer that cannot (als.js —
       the donor holds no legal tempo-automation shape) keeps the stretched
       beats, which at least keep the SECONDS true. Present-only in effect: an
       unpaced bar's barSteps IS its steps (paceTL takes no branch at all
       there), so k is exactly 1 and every existing artifact is byte-identical.
       A box whose bars do NOT agree (rubato left on — the warp wobbles every
       bar) is not a section step and refuses to 1 rather than guessing. */
    let k = null;
    for (const bar of box.bars) {
      const kb = bar.steps > 0 ? bar.barSteps / bar.steps : 1;
      if (k == null) k = kb;
      else if (Math.abs(kb - k) > 1e-9) { k = 1; break; }
    }
    // ...and a ratio within 5% of 1 is breathing, not a pace: the smallest
    // step a pace word can take is 4/3 (audio/plan.js PACE_RATE), the rubato
    // warp is under ±2% — a one-bar box under rubato must not grow a tempo
    // event out of its own wobble.
    box.k = k != null && k > 0 && Math.abs(k - 1) > 0.05 ? k : 1;
    delete box.bars;
  }
  /* THE RECORD'S DECLARED METER RIDES THE SCORE (2026-08-30, the five-walls
     follow-up) — extracted off the timeline's own genre, never typed. A
     document's toGenre resolves the word against kernel METERS and stamps the
     ROW (with its `abc`), so `meterAbc` is "3/4"/"6/8" straight from the one
     table; a catalog anchor may still carry the WORD ("three"), and this file
     may not own a copy of the table to resolve it — the CLI does the lookup
     with the kernel it already shims (tools/ableton/score-node.mjs). One
     record has one meter (band-kit's own law), so the first bar answers.
     Absent = both null, and every 4/4 record's Score is the same value. */
  const gm = timeline[0] && timeline[0].g ? timeline[0].g.meter : null;
  return { title, bpm, grid, engine: !!engine, cast, skipped, folded, boxes,
           meterAbc: (gm && typeof gm === "object" && gm.abc) || null,
           meterWord: typeof gm === "string" ? gm : null };
}
