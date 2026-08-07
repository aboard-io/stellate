// machines/bass.js — THE BASS MACHINES. Paul's call: several machines, not one
// deep parameter set.
//
//   1 CELL     author the bar as [beat, dur, tone] over chord DEGREES (root /
//              octave / fifth), shadowing the running pattern by name via
//              state.bassCells — the same rule state.kits and state.melodyCells use
//   2 MUTATION state.rhythm.complexity, the engine's own per-cycle bass-cell
//              breathing (drop / anticipate / octave-flip on its dedicated stream)
//
// The WALKER (a parametric chord-tone walk generalising the `walking` and
// `melodic` cases) is the third and is NOT here: the engine's `melodic` case is
// already a seeded walk with hardcoded constants, and lifting those to knobs is
// the same job melodyGen was — worth doing, not yet done.
//
// SEEDS. The 23 stock patterns are still procedural in csd-engine (see the note on
// bassEvents). Rather than transcribe them all — a large job whose only payoff is
// tidiness — the few STATIC ones are mirrored here purely as starting points for
// an edit. They are never used to play anything: the engine plays its own case
// until you author a cell, and then it plays yours. If one drifts from the engine
// you get a slightly different starting shape, not a wrong render.
import { SONG, edit, state } from "../song.js";

export const TONES = ["r5", "r6", "f6"];
export const toneLabel = { r5: "root", r6: "octave", f6: "fifth" };
export const STEP = 0.5;                      // the editor's grid: 8ths
export const COLS = 16;                       // one 8-beat chord bar

const SEEDS = {
  root:     [[0, 7.5, "r5"]],
  octaves:  [[0,1,"r5"],[1,1,"r6"],[2,1,"r5"],[3,1,"r6"],[4,1,"r5"],[5,1,"r6"],[6,1,"r5"],[7,1,"r6"]],
  dub:      [[2.5,1,"r5"],[3.5,0.5,"r6"],[6.5,1,"r5"],[7.5,0.5,"f6"]],
  drive:    [[0,0.42,"r5"],[0.5,0.42,"r5"],[1,0.42,"r5"],[1.5,0.42,"r5"],[2,0.42,"r5"],[2.5,0.42,"r5"],[3,0.42,"r5"],[3.5,0.42,"r5"]],
  stab:     [[0,0.3,"r5"],[1.5,0.3,"r6"],[3,0.3,"r5"],[4.5,0.3,"r6"],[6,0.3,"r5"],[7,0.3,"f6"]],
  walking:  [[0,1,"r5"],[1,0.5,"r6"],[1.5,0.5,"f6"],[2.5,0.5,"r5"],[3,1,"r6"],[4,0.5,"r5"],[4.5,0.5,"f6"],[5.5,0.5,"r6"],[6,1,"r5"],[7,0.5,"r6"],[7.5,0.5,"f6"]],
  habanera: [[0,1.4,"r5"],[1.5,0.5,"f6"],[2,1,"r6"],[3,1,"r5"],[4,1.4,"r5"],[5.5,0.5,"f6"],[6,1,"r6"],[7,1,"f6"]],
  tresillo: [[0,1.4,"r5"],[1.5,1.4,"r5"],[3,0.9,"r5"],[4,1.4,"r5"],[5.5,1.4,"r5"],[7,0.9,"r5"]],
  son:      [[0,1.2,"r5"],[1.5,1.2,"r5"],[3,1.6,"f6"],[5,0.8,"r6"],[6,1.7,"r5"]],
};

export const isEdited = (name) => !!(SONG.patch.bassCells && SONG.patch.bassCells[name]);
export function cellOf(name) {
  const mine = SONG.patch.bassCells && SONG.patch.bassCells[name];
  return mine ? JSON.parse(JSON.stringify(mine)) : (SEEDS[name] ? JSON.parse(JSON.stringify(SEEDS[name])) : null);
}
export const hasSeed = (name) => !!SEEDS[name];

function commit(name, cell) {
  const cells = Object.assign({}, SONG.patch.bassCells || {});
  cells[name] = cell;
  edit({ patch: Object.assign({}, SONG.patch, { bassCells: cells }) });
}
export function revert(name) {
  const cells = Object.assign({}, SONG.patch.bassCells || {});
  delete cells[name];
  const p = Object.assign({}, SONG.patch);
  if (Object.keys(cells).length) p.bassCells = cells; else delete p.bassCells;
  edit({ patch: p });
}

// grid <-> cell. One note per column (a bass line is a line), durations derived to
// the next onset so an authored bar comes out legato rather than staccato.
export function toGrid(cell) {
  const g = new Map();
  for (const [o, , tone] of cell || []) g.set(Math.round(o / STEP), TONES.indexOf(tone) < 0 ? 0 : TONES.indexOf(tone));
  return g;
}
export function toggle(name, col, row) {
  const g = toGrid(cellOf(name) || []);
  if (g.get(col) === row) g.delete(col); else g.set(col, row);
  const cols = [...g.keys()].sort((a, b) => a - b);
  const cell = cols.map((c, i) => {
    const next = cols[i + 1] != null ? cols[i + 1] : COLS;
    return [+(c * STEP).toFixed(2), +Math.min(4, Math.max(STEP, (next - c) * STEP)).toFixed(2), TONES[g.get(c)]];
  });
  commit(name, cell);
}
export function clear(name) { commit(name, []); }

// the bass patterns this song's form actually plays
export function bassPatterns() {
  const s = state(), out = [];
  for (const sec of s.sections || []) {
    const b = sec.bass;
    if (b && b !== "off" && out.indexOf(b) < 0) out.push(b);
  }
  return out;
}

// MACHINE 2 — the mutation knob, on its own dedicated stream in the engine
export const complexity = () => (state().rhythm ? +state().rhythm.complexity || 0 : 0);
export function setComplexity(v) {
  const st = state();
  edit({ patch: Object.assign({}, SONG.patch,
    { rhythm: Object.assign({}, st.rhythm || {}, { complexity: Math.max(0, Math.min(1, v)) }) }) });
}
