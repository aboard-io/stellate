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
// THE FOLD IS NOT HERE ANY MORE, 2026-08-29. Everything between "group the
// bars into boxes" and "sort each lane" used to be written out below; it is now
// nukernel/export/score.js `scoreOf`, because the in-page ⤓ button needs the
// identical arithmetic and a second copy of it in ui/eight.js would be the
// drift this repo has a law against. What is left in this file is the only part
// that is genuinely node's: standing a window up under the UMD data tier, and
// getting a record out of a file or a genre key. The re-exports below keep
// every old importer of this module working.
import { scoreOf, midiOfPch, velOfWritten } from "../../nukernel/export/score.js";
export { midiOfPch, velOfWritten };

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
export async function loadScore({ songPath = null, genre = null, scorePath = null,
                                  grid = true, engine = true } = {}) {
  /* A SCORE CAN ALSO ARRIVE ALREADY FOLDED, 2026-08-29, and it exists for one
     reason: THE PAGE CANNOT HAND ITS RECORD TO NODE.

     `ui/state.js songJSON()` is lossy for an eight.js record and the gate found
     it: eight.js `push()` (eight.js:413) writes its compiled sections straight
     into the live table as `GENRES["lab.eight."+i]` and then adopts with
     `genres: {}`, so GENRESET is empty by design and the saved JSON names five
     genre keys whose recipes it does not carry. Re-adopted in node, all five
     miss and song.js falls back to `simple` — measured: the shipped chant came
     back as five boxes of "Simple" at 126 bpm instead of the record at 58.
     That is a real gap in state.js's serialiser and it is not this slice's to
     fix; what it means here is that "give the CLI the same record" cannot go
     through a song file.

     So it goes through the SCORE. test/als-page.browser.js takes the page's own
     `pageScore()` — the exact object the button spliced — and hands it to this
     CLI, which reads the donor OFF DISK and splices it with the same
     `alsFromScore`. Byte-identical XML then proves the three things that are
     actually different between the two ends: the EMBEDDED donor is the
     committed donor, the splice is one implementation, and the browser's gzip
     round-trips. It does NOT prove two independent folds agree, and it cannot:
     since this file's own fold moved to nukernel/export/score.js there is only
     one fold, which is the point. The fold's own gate is `--genre <key>`, which
     recompiles from the record and is what als-gate.js Gate 1 has always run.

     Nothing is warmed and nothing is adopted on this path; a Score is already
     the exporter's whole vocabulary (see nukernel/export/score.js). */
  if (scorePath) {
    const { readFile } = await import("node:fs/promises");
    const sc = JSON.parse(await readFile(scorePath, "utf8"));
    for (const k of ["bpm", "boxes"]) if (sc[k] == null)
      throw new Error("not a score: " + scorePath + " has no ." + k);
    if (!Array.isArray(sc.boxes) || !sc.boxes.length)
      throw new Error("not a score: " + scorePath + " has no boxes");
    return { title: scorePath, cast: [], skipped: 0, folded: 0, grid, engine, ...sc };
  }
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
  const score = scoreOf({ timeline: plan.timeline(), cast: engine ? plan.cast() : [],
                          drums: engine ? plan.drumStrip() : null,
                          bpm: state.bpm, grid, engine,
                          title: (genre || songPath || "nukernel") });
  // A catalog anchor says its meter as a WORD ("three"); export/score.js may
  // not own a copy of the kernel's METERS table to resolve it, and this file
  // already shims the kernel — so the one lookup happens here (2026-08-30,
  // the tempo-map follow-up). A document-born record arrives already resolved.
  if (!score.meterAbc && score.meterWord) {
    const KM = require(path.join(NUK, "kernel.js")).METERS[score.meterWord];
    if (KM && KM.abc) score.meterAbc = KM.abc;
  }
  return score;
}

