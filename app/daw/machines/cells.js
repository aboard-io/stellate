// machines/cells.js — THE PHRASE EDITOR: draw a phrase, get a generator.
//
// A cell is `[beatOffset, dur, leadIndex, octShift]` — and `leadIndex` is a slot
// in the CHORD'S OWN VOICING, not a pitch. That is the whole point. Draw on this
// grid and you have written a contour in scale degrees relative to whatever chord
// is sounding, so the phrase follows the harmony, transposes with the key, and
// survives reharmonisation. Draw on a chromatic keyboard instead and you have
// written a frozen clip, stranded the moment the progression moves — which is the
// design docs/DAW.md rejected up front.
//
// So the y-axis is the ladder: slots 0..3 of the voicing, x2 for the octave
// shift, drawn high-to-low. The x-axis is a 16th grid across the chord bar.
//
// A drawn cell OVERRIDES the shipped one BY NAME (state.melodyCells shadows
// MEL_PHRASES), exactly the way state.kits shadows KITS — so editing needs no
// change to the form, and the copy-on-write / badge / revert model is identical.
import { SONG, edit, state } from "../song.js";

const E = window.CsdEngine;
export const STEP = 0.25;                 // the drawing grid: 16ths
export const ROWS = [                     // top to bottom, as drawn
  { idx: 3, oct: 1 }, { idx: 2, oct: 1 }, { idx: 1, oct: 1 }, { idx: 0, oct: 1 },
  { idx: 3, oct: 0 }, { idx: 2, oct: 0 }, { idx: 1, oct: 0 }, { idx: 0, oct: 0 },
];
export const rowLabel = (r) => (r.oct ? "8va " : "") + ["root", "3rd", "5th", "top"][r.idx];

// The cell a name resolves to, the way melodyEvents resolves it: the song's own
// cells first, then the shipped table.
export function cellOf(name) {
  const c = (SONG.patch.melodyCells && SONG.patch.melodyCells[name]) || (E.MEL_PHRASES && E.MEL_PHRASES[name]);
  return c ? JSON.parse(JSON.stringify(c)) : null;
}
export const isCell = (name) => !!(E.MEL_PHRASES && E.MEL_PHRASES[name]);
export const isEdited = (name) => !!(SONG.patch.melodyCells && SONG.patch.melodyCells[name]);

// how many 16th columns this song's chord bar is worth
export function cols() {
  const s = state();
  return Math.round(Math.max(2, s.chordEvery || (s.meter ? 6 : 8)) / STEP);
}

// grid <-> cell -------------------------------------------------------------
// The grid is a Set of "col:row" keys; the cell is the engine's array form. dur
// is DERIVED on the way out, never stored per cell in the UI: each note holds
// until the next onset anywhere in the phrase (capped at 2 beats), which is what
// makes a drawn line legato instead of a row of staccato 16ths.
export function toGrid(cell) {
  const g = new Set();
  for (const [o, , idx, oct] of cell || []) {
    const col = Math.round(o / STEP);
    const row = ROWS.findIndex((r) => r.idx === (idx | 0) && r.oct === (oct ? 1 : 0));
    if (row >= 0 && col >= 0) g.add(col + ":" + row);
  }
  return g;
}
export function fromGrid(g, nCols) {
  const notes = [...g].map((k) => { const [c, r] = k.split(":").map(Number); return { c, r }; })
    .filter((n) => n.c < nCols && ROWS[n.r])
    .sort((a, b) => a.c - b.c || a.r - b.r);
  const onsets = [...new Set(notes.map((n) => n.c))].sort((a, b) => a - b);
  return notes.map((n) => {
    const next = onsets.find((c) => c > n.c);
    const spanCols = (next != null ? next : nCols) - n.c;
    const dur = Math.min(2, Math.max(STEP, spanCols * STEP));
    return [+(n.c * STEP).toFixed(2), +dur.toFixed(2), ROWS[n.r].idx, ROWS[n.r].oct];
  });
}

function commit(name, cell) {
  const cells = Object.assign({}, SONG.patch.melodyCells || {});
  cells[name] = cell;
  edit({ patch: Object.assign({}, SONG.patch, { melodyCells: cells }) });
}
export function toggle(name, col, row) {
  const g = toGrid(cellOf(name) || []);
  const k = col + ":" + row;
  // one note per column: a cell is a LINE, and two slots at the same onset would
  // read as a chord the lead voice cannot play
  if (g.has(k)) g.delete(k);
  else { for (const r of ROWS.keys()) g.delete(col + ":" + r); g.add(k); }
  commit(name, fromGrid(g, cols()));
}
export function clear(name) { commit(name, []); }
export function revert(name) {
  const cells = Object.assign({}, SONG.patch.melodyCells || {});
  delete cells[name];
  const patch = Object.assign({}, SONG.patch);
  if (Object.keys(cells).length) patch.melodyCells = cells; else delete patch.melodyCells;
  edit({ patch });
}

// The melody patterns this song's form actually plays, split into what this
// editor can draw (a shipped phrase cell) and what it cannot (wander, and the
// procedural generators like fugue/motorik that are code, not data).
export function melodyPatterns() {
  const s = state(), out = [];
  for (const sec of s.sections || []) {
    const m = sec.melody;
    if (m && m !== "off" && out.indexOf(m) < 0) out.push(m);
  }
  return out;
}
