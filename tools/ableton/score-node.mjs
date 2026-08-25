// tools/ableton/score-node.mjs — the ONE way this slice gets a nukernel score
// without a browser. The CLI reads it and so does the gate, because a gate that
// re-derives the score its own way is checking two guesses against each other.
//
// WHY A SHIM AT ALL. Every data file in nukernel/ ends
//   `if (typeof module !== "undefined" && module.exports) module.exports = api;
//    else root.NuX = api;`
// (kernel.js:2998, genres.js:6011, fields.js:1332, song.js:842, …) — so under
// CommonJS they publish to `module.exports` and NEVER touch `window`, while
// `ui/deps.js:1-6` ("the SOLE reader of window.*") reads only `window`. The
// fifteen lines below are the bridge: require the UMD tier, then assign what it
// returned onto `window` under the names deps.js destructures. Nothing else in
// the tree needs this, which is why it lives beside the exporter rather than in
// nukernel/.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as ALS from "../../nukernel/export/als.js";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const NUK = path.resolve(HERE, "../../nukernel");

let shimmed = false;
/** Stand the UMD data tier on a stub window, exactly once. */
export function shimWindow() {
  if (shimmed) return globalThis;
  const W = globalThis;
  if (typeof W.window === "undefined") W.window = W;
  if (!W.addEventListener) W.addEventListener = () => {};
  if (!W.removeEventListener) W.removeEventListener = () => {};
  // state.js reads three localStorage keys AT MODULE LOAD (VOLSTORE :35,
  // RUBSTORE :58, STORE :347). A missing localStorage is a TypeError before a
  // single export exists, so the stub answers null and swallows writes — the
  // exporter must never persist anything into a session that has no page.
  if (!W.localStorage) {
    const mem = new Map();
    W.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null),
                       setItem: (k, v) => void mem.set(k, String(v)),
                       removeItem: (k) => void mem.delete(k) };
  }
  // Only what a module touches while EVALUATING. state.js:460 saveFile makes an
  // <a>; it is never called from here, but createElement is cheap insurance and
  // an object with the fields the anchor path sets costs one line.
  if (!W.document) W.document = {
    createElement: () => ({ style: {}, setAttribute() {}, click() {},
                            appendChild() {}, remove() {} }),
    getElementById: () => null, querySelectorAll: () => [],
    body: { appendChild() {}, removeChild() {} },
    addEventListener() {}, documentElement: { style: { setProperty() {} } },
  };
  // The order is kernel-daw.html's own <script> order; document.js requires
  // kernel/genres/fields for itself under CJS, so its place here is only about
  // window.NuDocument existing before deps.js:73 reads it.
  W.NuKernel      = require(path.join(NUK, "kernel.js"));
  W.NuGenres      = require(path.join(NUK, "genres.js"));
  W.NuFields      = require(path.join(NUK, "fields.js"));
  W.NuSong        = require(path.join(NUK, "song.js"));
  W.NuInstruments = require(path.join(NUK, "instruments.js"));
  W.NuCompose     = require(path.join(NUK, "compose.js"));
  W.NuDocument    = require(path.join(NUK, "document.js"));
  // ...AND THE SHIPPED RECORD. ui/deps.js gained `export const { TERMS } =
  // window.NuSongs` in the 2026-08-24 W3 integration — the atlas needs the
  // chant to get back to Rome 600 — and a DESTRUCTURE of a missing global is a
  // TypeError where `export const X = window.X` only yields undefined, so this
  // exporter died at deps.js before it read a single note. This file's own rule
  // is "the order is kernel-daw.html's own <script> order"; songs.js is in that
  // order and was simply not needed here until deps.js started reading it.
  W.NuSongs       = require(path.join(NUK, "songs.js"));
  W.PRESETS       = require(path.join(NUK, "presets.js")).PRESETS;
  shimmed = true;
  return W;
}

/** The exporter's own words for a song. The core takes only this. */
/** @typedef {{ midi:number, beat:number, dur:number, vel:number }} Note */
/** @typedef {{ name:string, chair:string, notes:Note[] }} Lane */
/** @typedef {{ name:string, beat0:number, beats:number, lanes:Lane[] }} Box */
/** @typedef {{ title:string, bpm:number, grid:boolean, engine:boolean, boxes:Box[] }} Score */

// The inverse of to-engine.js:47's pchOf. csound pch is octave.semitone with the
// semitone in hundredths: 8 -> 60, 8.05 -> 65, 9 -> 72, 7.11 -> 59.
export const midiOfPch = (p) => {
  const o = Math.floor(p + 1e-9);
  return 60 + (o - 8) * 12 + Math.round((p - o) * 100);
};

// P0 reads plan.timeline(), whose events carry the WRITTEN velocity 0..9
// (derive.js songBars). MIDI velocity 1..127 off a 0..9 scale, 9 -> 127.
export const velOfWritten = (v) => Math.max(1, Math.min(127, Math.round((v == null ? 5 : v) / 9 * 127)));

/**
 * Load a nukernel song and hand back a Score.
 *
 * THE ENGINE IS WARMED BY DEFAULT, and that reverses the design note. Design 09
 * §7 said P0 "does not need the engine, and so does not need engine/columns.js
 * restored", because plan.compile() fills TL before the `if (!D)` bail at
 * plan.js:303 — which is true, and I kept the un-warmed path behind
 * `engine:false` for exactly that reason. What changed is that warming was
 * MEASURED at 222 ms once the two pruned files came back (engine/columns.js
 * restored verbatim from main, engine/genres-data.js as the 20-byte stub
 * plan.js:81 already writes in the browser), and warming buys two things Paul
 * would otherwise have to fix by hand in Live:
 *   · the REGISTER HOME — compile() stamps `e.home` on every seated event, so
 *     the whole line moves to the octave the instrument can hold instead of
 *     exporting where it was written;
 *   · the CAST — `v0 electric_piano` instead of `v0`, which is the difference
 *     between a track list and a band.
 * 222 ms is not a reason to ship a set an octave off. `--no-engine` keeps the
 * old path and prints that it did.
 *
 * WHAT IS STILL NOT barPlan(). The velocities here are the WRITTEN 0..9 off
 * plan.timeline(), not barPlan()'s desk-multiplied `amp`. That is deliberate
 * and it is the right answer until P3: `amp` has the fader ride already in it
 * (plan.js:520-527), so writing it as velocity and THEN writing volume
 * envelopes counts the desk twice. The migration is named in the als.js header.
 */
export async function loadScore({ songPath = null, genre = null, grid = true, engine = true } = {}) {
  shimWindow();
  const state = await import(new URL("../../nukernel/ui/state.js", import.meta.url));
  const plan  = await import(new URL("../../nukernel/audio/plan.js", import.meta.url));
  const { GENRES } = require(path.join(NUK, "genres.js"));

  let raw;
  if (songPath) {
    raw = JSON.parse(await (await import("node:fs/promises")).readFile(songPath, "utf8"));
  } else {
    if (!genre) throw new Error("loadScore needs songPath or genre");
    if (!GENRES[genre]) throw new Error("no such genre: " + genre);
    raw = state.defaultSong();
    // Every box plays the one genre asked for, on the one starter phrase the
    // fresh page ships (state.js:382 gives box 0 slots [0]).
    for (const box of raw.song) { box.stack = [{ g: genre, slots: [0] }]; box.len = GENRES[genre].bars; }
  }
  if (engine) await plan.warmEngine();
  // THE ONE ENTRANCE. state.js:393-399: localStorage, a file off the desktop, a
  // shipped preset, the composer and Reset all come through adoptSong, and so
  // does the exporter. Nothing here reaches past it into SONG.
  if (!state.adoptSong(raw, "export")) throw new Error("adoptSong refused: " + state.loadErrorText());
  // Rubato makes bars fractional — measured 15.927, 15.919, 15.991, 16.039
  // steps against a metric bar grid in Live, so a set that plays right is
  // unreadable. Off gives 16,16,16,16 and the groove/humanize offsets SURVIVE
  // inside the bar, which is exactly the promise: "Swing/groove/nudge are BAKED
  // into note offsets — real tick offsets in the clip, not Live's groove pool."
  if (grid) state.setRubato(false);

  plan.compile();
  const TL = plan.timeline();
  if (!TL.length) throw new Error("compile() produced no bars");
  const cast = engine ? plan.cast() : [];

  const boxes = [];
  for (const bar of TL) {
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
          const midi = ALS.GM_DRUM[e.d];
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
    delete box.bars;
  }
  return { title: (genre || songPath || "nukernel"), bpm: state.bpm, grid,
           engine: !!engine, cast, skipped, folded, boxes };
}

// THE BOX NUMBER IS PART OF THE NAME, and it is not decoration. A four-box song
// on one genre gives four boxes the same label ("New York 1994" x4), the clip
// names collide, and gate 1 counted eight clips where it wanted two — which is
// how this line came to exist, rather than by taste.
const labelOf = (bar) => (bar.g && (bar.g.label || bar.g.name)) || "box";
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

// The instrument the cast seated in this chair, or nothing when the engine was
// not warmed and there is no cast to ask.
const instrOf = (key, cast) => {
  const seat = cast.find((c) => c.v === key);
  return (seat && seat.instr) || "";
};
