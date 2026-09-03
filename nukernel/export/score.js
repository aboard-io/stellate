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
// 2026-09-03 — AND IT STILL IS THE WRITTEN VALUE. velOfWritten now also reads
// `acc`, which is a MARK on the event and not a gain on the channel; the
// paragraph above is about the DESK and is untouched by it. The argument is
// written out in full over that function.
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

/* MIDI velocity off the written 0..9 scale (derive.js songBars) — AND THE
   ACCENT, WHICH HAD NEVER LEFT THE BOX (2026-09-03, the groove round).

   MEASURED FIRST, because that is the only way this file is allowed to change.
   Paul: "The groove gets lost in Ableton I think?" The timing half of that is
   false and the measurement says so — 94.7% of the note Times in a funk
   export sit off the sixteenth grid, the second sixteenths land 18.6% of a
   sixteenth late where the record declares swing 0.12 plus the funk groove's
   0.06 push, and a techno export is 100% on the grid. Swing, groove, the
   hand's nudge and the humanize drift all arrive as real offsets and always
   have. What does NOT arrive is the other half of a groove: `e.acc`, the
   accent flag every event has carried since the kernel wrote it. In the box
   an accent is worth x1.15 (to-engine.js ACCENT_LIFT, on both pitchAmp and
   drumAmp); in the export it was worth nothing, because no line in export/
   ever read the key. 72 of a funk record's first 174 drum hits are accented,
   and every one of them left here at the same velocity as the ghost beside
   it. This repo has a name for that shape of defect — "declared but never
   arriving" — and this is the seventh.

   THE HEADROOM IS THE ENGINE'S OWN, and it is why the top is 110 and not 127.
   pitchAmp's unaccented ceiling is 0.26 against a clamp of 0.34, so the engine
   keeps room ABOVE a written 9 for the accent to use; a 0..9 -> 1..127 map
   keeps none, and an accented backbeat (vel 9 is the commonest velocity in
   every record measured) would clamp straight back onto its own ghost. So a
   written 9 is 110 and an accented 9 is 110 x 1.15 = 127 — the same arithmetic
   one layer down, with the same shape. Everything gets 13% quieter in the
   file and nothing gets quieter relative to anything else; Live's own
   instrument curve is what turns velocity into loudness, and it is untouched.

   NOT A DOUBLE COUNT (the P3 law in the als.js header). `acc` is a MARK the
   composer wrote, like the 0..9 itself. It is not the desk: the fader ride is
   `lvl` and the automation lanes, and live-devices.js writes those as volume
   envelopes. Nothing here has ever carried a fader and nothing here does now. */
export const ACCENT_LIFT = 1.15;   // audio/to-engine.js:127, quoted not invented
export const VEL_TOP = 110;        // 127 / ACCENT_LIFT, floored — see above
export const velOfWritten = (v, acc) => Math.max(1, Math.min(127,
  Math.round((v == null ? 5 : v) / 9 * VEL_TOP * (acc ? ACCENT_LIFT : 1))));

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
// ...and the channel the desk gave that seat — `{fader, rev, del, pan}`, any
// key absent meaning "not moved" (plan.js stripOf). A writer that has a mixer
// (export/als.js) sets it from here rather than inventing a balance; a writer
// that has none ignores it, and an unwarmed export has no cast so it is null.
const stripOf = (key, cast) => {
  const seat = cast.find((c) => c.v === key);
  return (seat && seat.strip) || null;
};
/* ...AND THE TONE THAT CHAIR IS PLAYING WITH (2026-09-03, the P3 round).
   Paul: "the midi shifts aren't showing up in ableton, like the envelope
   settings that would tweak the sound and filters and so forth … it makes the
   mix so unexpressive."

   `tone` is the genre's five dials — cut, q, atk, rel, gain, verb — and
   plan.js cast() has handed them out beside the instrument since the strip
   round; nothing read them. That is this repo's most familiar bug and the
   memory note names it: "declared but never arriving". 421 of 421 genres
   carry a tone block, so this is not a rare path.

   `syn` is the SIGNATURE SYNTH the genre declares (`{dsp, root, level, set}`),
   which sixteen genres have and which is what actually plays those chairs —
   to-engine.js recipeFor tries it first and falls back to the patch. It is on
   plan.js seats() and NOT on cast(), because cast() flattens it to a boolean;
   rather than widen cast (audio/ is not this slice's to edit this round) the
   caller hands the seat list in beside it and the two are indexed the same
   way — cast() is literally `SEATS.map((s, i) => …"v" + i…)`, so seats[i] IS
   cast[i]'s chair. `seats` absent = every existing Score, byte for byte. */
const toneOf = (key, cast) => {
  const seat = cast.find((c) => c.v === key);
  return (seat && seat.tone) || null;
};
const synOf = (key, seats) => {
  const m = /^v(\d+)$/.exec(key);
  const s = m && seats ? seats[+m[1]] : null;
  return (s && s.synth) || null;
};

/* THE BOX IS NAMED BY WHAT IT DOES, NOT BY WHERE THE GENRE IS FROM.
   Paul, of the exported set: "You named all the track rows and clips the same
   thing. Name them functionally, i.e the row should be named 'Intro'". Every
   scene said "3 London 1969" — the genre's label and the box number, which is
   the same words eleven times over and tells a person nothing about the
   arrangement they are looking at.

   THE WORD IS ALREADY OWNED, and this fold does not get a second opinion.
   ui/derive.js `roleOf` (line 720) resolves role-vs-cue against compose's own
   PLANCUE rule — a prechorus is STORED as a verse with cue "prechorus", so
   reading `role` alone mislabels it — and songBars now stamps that resolved
   word on every bar. The first version of this block reimplemented that rule
   here from a fresh table, which is the drift this repo has a law against;
   it was deleted rather than kept in parallel. The bar's `role` is the word.

   THE NUMBER IS THE ROLE'S OWN COUNT, so a song reads Verse 1 / Chorus 1 /
   Verse 2 / Chorus 2, and a role that happens only once carries no number at
   all ("Intro"). Uniqueness still holds — which matters, because it is what
   gate 1 counts clips by, and the box number used to be here for exactly that
   reason (see labelOf above). Two boxes can only collide now if they share a
   role, and then their counts differ. */
const titleCase = (w) => w.charAt(0).toUpperCase() + w.slice(1);

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

/* ================== THE SECTION'S RIDE, FOLDED FOR A WRITER =============
   A box's automation is TWO things and only one of them needs any arithmetic:

   · `sec.auto` — a list the composer and the hand both write, and its entries
     ALREADY carry `{param, shape, curve, points}` in full, because that is
     what fields.js autoShape returns and what the section stores. So they are
     copied VERBATIM. There is no second implementation of a shape here and
     there cannot be one.

   · `sec.mot` — one word, compiled to a lane by audio/desk.js compileAuto.
     THAT one is a copied table, four rows of it, and this repo's answer to a
     copied table is not "don't" but "prove it": als-gate.js gate A reads
     compileAuto out of audio/desk.js and fails the moment these numbers and
     those disagree. Same shape as gate M, which does it for CHAIR_LEVEL.
     (Why copy at all: desk.js is browser-and-node module code this file
     cannot import — export/score.js is pure over its arguments, with no DOM,
     no state and no ui/deps.js, precisely so the CLI and the page can share
     it. Importing desk.js would drag ui/state.js into the exporter.)

   THE LANE SPANS THE BOX. compileAuto sizes its lanes off the section's
   NOMINAL beats ((sec.len || g.bars) * 4 / rate); this sizes them off the
   box's PLAYED beats, which the fold above has just measured. For every
   unpaced record those are the same number, and where they differ the played
   one is the honest answer — a lane means "across this section" and the
   section is as long as it sounds. It also means `pump`'s per-beat points
   land on real beats without anybody converting anything.

   `hpf` IS CARRIED AND SAID TO BE HOMELESS, exactly as desk.js carries it:
   "the mot 'rise' compiles to a HIGHPASS sweep, and the parent's master stage
   has a lowpass ceiling and no floor." Live's AutoFilter HAS a highpass, so
   this is one of the rare places where the export can say something the
   engine cannot — but saying it needs the `Filter_Type` enum, whose 0..9 the
   donor does not decode, so the writer refuses it and reports it. The lane is
   in the Score either way, for whoever decodes that enum. */
export const MOT_LANES = {
  open:  (beats) => ({ param: "cutoff", curve: "exp", points: [[0, 320], [beats, 16000]] }),
  close: (beats) => ({ param: "cutoff", curve: "exp", points: [[0, 16000], [beats, 320]] }),
  rise:  (beats) => ({ param: "hpf", curve: "exp", points: [[0, 20], [beats, 1400]] }),
  pump:  (beats) => {
    const pts = [];
    for (let b = 0; b < Math.max(1, Math.round(beats)); b++) pts.push([b, 0.32], [b + 0.85, 1]);
    return { param: "level", curve: "exp", points: pts };
  },
};
/** Every lane this box draws: its `mot` word first, then its own `auto` list. */
export function autoOf(sec, beats) {
  if (!sec) return [];
  const out = [];
  const mot = sec.mot && MOT_LANES[sec.mot];
  if (mot) out.push(mot(beats));
  for (const a of (sec.auto || []))
    if (a && typeof a === "object" && a.param && Array.isArray(a.points) && a.points.length)
      out.push({ param: a.param, curve: a.curve === "exp" ? "exp" : "lin", points: a.points });
  return out;
}

/**
 * Fold a COMPILED nukernel timeline into a Score.
 *
 * @param {object} o
 * @param {Array}  o.timeline  plan.timeline() — the bar list compile() built
 * @param {Array}  o.cast      plan.cast(), or [] when the engine was not warmed
 * @param {Array}  o.seats     plan.seats(), for the chairs' signature `synth`
 *                             blocks — cast() flattens those to a boolean
 * @param {Array}  o.sections  ui/state.js SONG, indexed by the box's own `si`:
 *                             where `mot`, `auto` and the `fx` chips live
 * @param {number} o.bpm       state.bpm
 * @param {boolean} o.grid     whether rubato was OFF when this was compiled
 * @param {boolean} o.engine   whether the engine was warmed (cast + register home)
 * @param {string} o.title     what to call the song in the CLI's own printout
 */
export function scoreOf({ timeline, cast = [], seats = null, sections = null,
                          bpm, grid = true, engine = true,
                          drums = null, master = null, title = "nukernel" }) {
  if (!timeline || !timeline.length) throw new Error("compile() produced no bars");
  const boxes = [];
  for (const bar of timeline) {
    if (bar.first || !boxes.length)
      // THE SECTION'S DEALT LEVEL, PRESENT-ONLY (2026-08-30, the score
      // dynamics round). ui/derive.js songBars stamps the composed `lvl` WORD
      // on every bar of a worded section — the one dynamic the velocities in
      // this fold do NOT carry (the header above says why: `env` is in the
      // written velocities, `lvl` is the desk's gain and never touched an
      // event). The box keeps the word so a writer that can say it
      // (export/smf.js, expression CCs) may; a wordless section stamps no key
      // and every existing Score is the same value.
      boxes.push({ si: bar.si, name: (bar.si + 1) + " " + labelOf(bar),
                   label: labelOf(bar), role: bar.role || null,
                   beat0: bar.beat0, beats: 0, bars: [],
                   ...(bar.lvl ? { lvl: bar.lvl } : {}) });
    const box = boxes[boxes.length - 1];
    box.beats += bar.barSteps / 4;
    box.bars.push(bar);
  }
  /* ...AND THEN THE ROLES ARE COUNTED, which cannot happen in the loop above
     because "Verse 1" is only knowable once it is known whether there is a
     Verse 2. A box whose section carried no role keeps the old number-and-
     label name, so an unwarmed or roleless record exports exactly as before. */
  {
    const total = {}, seen = {};
    for (const b of boxes) if (b.role) total[b.role] = (total[b.role] || 0) + 1;
    for (const b of boxes) {
      if (!b.role) continue;
      b.nth = seen[b.role] = (seen[b.role] || 0) + 1;
      b.name = titleCase(b.role) + (total[b.role] > 1 ? " " + b.nth : "");
    }
  }
  let skipped = 0, folded = 0;
  for (const box of boxes) {
    const lanes = new Map();
    const put = (key, chair, note) => {
      let lane = lanes.get(key);
      if (!lane) lanes.set(key, lane = { name: key, chair, instr: instrOf(key, cast),
                                        strip: key === "drums" ? (drums || null)
                                                               : stripOf(key, cast),
                                        // present-only: a lane with no seat
                                        // (the unseated bass, the drums) and
                                        // an unwarmed export write neither key
                                        ...(toneOf(key, cast) ? { tone: toneOf(key, cast) } : {}),
                                        ...(synOf(key, seats) ? { syn: synOf(key, seats) } : {}),
                                        notes: [] });
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
          put("drums", "drums", { midi, beat: at(e), dur: 0.25, vel: velOfWritten(e.vel, e.acc) });
        } else if (e.n != null) {
          const key = e._seat != null ? "v" + e._seat
                    : e.kind === "bass" ? "bass" : "v" + (e.v == null ? 0 : e.v);
          put(key, e.kind === "bass" ? "bass" : (e.part || "line"),
              { midi: e.n + (e.home || 0), beat: at(e),
                dur: Math.max(0.03125, (e.dur || 1) / 4), vel: velOfWritten(e.vel, e.acc) });
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
    /* THE SECTION'S OWN RIDE AND ITS OWN EFFECTS (2026-09-03, the P3 round).
       Both are PRESENT-ONLY: a box that draws no lane writes no `auto` key and
       a box with no chips writes no `fx` key, so every Score that has ever
       been folded is the same object it was. A caller that hands no
       `sections` (an unwarmed CLI run, a `--score` file) gets neither, which
       is also what it got yesterday. */
    const sec = sections ? sections[box.si] : null;
    const auto = autoOf(sec, box.beats);
    if (auto.length) box.auto = auto;
    // the section's Character chips, filtered to the ones fields.js FX knows —
    // audio/desk.js does the same filter on the same list and for the same
    // reason: a stale word in a saved song must not reach a builder
    const fx = (sec && Array.isArray(sec.fx) ? sec.fx : []).filter((k) => typeof k === "string");
    if (fx.length) box.fx = fx;
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
  /* THE RECORD'S MASTER BUS RIDES THE SCORE (2026-09-03, the Answers round),
     as the WORDS and not as numbers. `master` is ui/state.js MASTER — the
     seven-word spec fields.js MASTER registers and compose.js deals per family
     — and state.js has already normalised "the same as no spec at all" to
     null (setMaster / masterIsDefault), so there is exactly one spelling of
     absent here and this file does not get a second opinion about it.
     PRESENT-ONLY, like `auto` and `fx`: a record that never touched the master
     writes no key, so every Score folded before today is the same object, and
     nukernel/export/als.js leaves the donor's own MainTrack untouched.
     WHY THE WORDS AND NOT resolveMaster()'s NUMBERS: a Score is what the
     RECORD says, and the words are what it says; the numbers behind them are
     fields.js's (live-devices.js MASTER_DRIVES/GLUES/CEILINGS quote them and
     als-gate.js gate G holds the copy to the original). A Score full of
     resolved gains would also be unreadable in a `--score` file, which is a
     thing people open. */
  const mw = master && typeof master === "object" &&
    Object.values(master).some((v) => typeof v === "string") ? master : null;
  return { title, bpm, grid, engine: !!engine, cast, skipped, folded, boxes,
           ...(mw ? { master: mw } : {}),
           meterAbc: (gm && typeof gm === "object" && gm.abc) || null,
           meterWord: typeof gm === "string" ? gm : null };
}
