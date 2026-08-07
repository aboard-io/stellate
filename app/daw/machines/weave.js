// machines/weave.js — THE WEAVE MACHINE: fit a generator from the phrases you drew.
//
// A weave organ is not a phrase, it is the DISTRIBUTION a phrase is drawn from:
// two Markov chains — pitch over the voicing ladder (8 slots: idx 0..3 x oct 0..1)
// and rhythm over quantized IOIs — plus a legato and a step figure. csd-engine's
// MINED_WEAVE carries four of them, fitted by tools/mine/mine-weave.js from a MIDI
// corpus. This module is that fitter, in the browser, fitted on YOUR phrases.
//
// That closes the loop docs/DAW.md is named for: draw a few phrases -> fit a
// generator from them -> the generator writes the song -> adjust and refit. The
// project's own generator/verifier thesis, pointed at your melodic taste.
//
// WHY THE BROWSER FIT IS SIMPLER THAN THE CORPUS FIT. mine-weave has to recover
// ladder slots from raw MIDI: normalise each 8-beat window's pitch range to 0..7,
// drop polyphonic skylines, gate on mel_conf. A drawn cell is ALREADY in ladder
// slots — that is what the phrase editor's y-axis is — so the fit is counting,
// smoothing and normalising, nothing else. Same tables, same shape, no inference.
import { SONG, edit } from "../song.js";
import * as CELLS from "./cells.js";

const E = window.CsdEngine;
export const WIOI = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];   // csd-engine's own IOI ladder
export const SLOTS = 8;
export const slotLabel = (s) => (s >= 4 ? "8va " : "") + ["root", "3rd", "5th", "top"][s % 4];

const PRIOR = 0.5;   // Laplace smoothing, as mine-weave uses — an unseen move stays possible
const norm = (row) => { const t = row.reduce((a, b) => a + b, 0) || 1; return row.map((v) => +(v / t).toFixed(4)); };

export function weaveOf(name) {
  const w = (SONG.patch.melodyWeave && SONG.patch.melodyWeave[name]) || (E.MINED_WEAVE && E.MINED_WEAVE[name]);
  return w ? JSON.parse(JSON.stringify(w)) : null;
}
export const isWeave = (name) => !!(E.MINED_WEAVE && E.MINED_WEAVE[name]);
export const isEdited = (name) => !!(SONG.patch.melodyWeave && SONG.patch.melodyWeave[name]);

function commit(name, w) {
  const ws = Object.assign({}, SONG.patch.melodyWeave || {});
  ws[name] = w;
  edit({ patch: Object.assign({}, SONG.patch, { melodyWeave: ws }) });
}
export function revert(name) {
  const ws = Object.assign({}, SONG.patch.melodyWeave || {});
  delete ws[name];
  const patch = Object.assign({}, SONG.patch);
  if (Object.keys(ws).length) patch.melodyWeave = ws; else delete patch.melodyWeave;
  edit({ patch });
}

// ---------- THE FITTER ----------
// `cells` is a list of phrase cells ([beat, dur, idx, oct][]). Returns a weave in
// exactly csd-engine's MINED_WEAVE shape. Mirrors mine-weave.js mineRip's counting
// so a hand-fitted organ and a corpus-fitted one are the same kind of object.
export function fit(cells) {
  const start = new Array(SLOTS).fill(PRIOR);
  const slot = Array.from({ length: SLOTS }, () => new Array(SLOTS).fill(PRIOR));
  const ioiStart = new Array(WIOI.length).fill(PRIOR);
  const ioi = Array.from({ length: WIOI.length }, () => new Array(WIOI.length).fill(PRIOR));
  const legs = [];
  let steps = 0, moves = 0, phrases = 0, notes = 0;

  const qIoi = (v) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < WIOI.length; i++) { const d = Math.abs(WIOI[i] - v); if (d < bd) { bd = d; best = i; } }
    return best;
  };

  for (const cell of cells) {
    if (!cell || cell.length < 2) continue;                 // one note is not a phrase
    const ns = cell.slice().sort((a, b) => a[0] - b[0]);
    phrases++; notes += ns.length;
    const sl = ns.map(([, , idx, oct]) => Math.max(0, Math.min(SLOTS - 1, (idx | 0) + (oct ? 4 : 0))));
    start[sl[0]]++;
    for (let i = 0; i + 1 < sl.length; i++) {
      slot[sl[i]][sl[i + 1]]++;
      moves++; if (Math.abs(sl[i + 1] - sl[i]) === 1) steps++;
    }
    const gaps = [];
    for (let i = 0; i + 1 < ns.length; i++) gaps.push(qIoi(ns[i + 1][0] - ns[i][0]));
    if (gaps.length) ioiStart[gaps[0]]++;
    for (let i = 0; i + 1 < gaps.length; i++) ioi[gaps[i]][gaps[i + 1]]++;
    for (let i = 0; i + 1 < ns.length; i++) {
      const g = ns[i + 1][0] - ns[i][0];
      if (g > 0) legs.push(Math.min(1, ns[i][1] / g));
    }
  }
  if (!phrases) return null;
  legs.sort((a, b) => a - b);
  return {
    start: norm(start), slot: slot.map(norm), ioiStart: norm(ioiStart), ioi: ioi.map(norm),
    legato: +(legs[legs.length >> 1] || 0.9).toFixed(3),
    // mine-weave measures `step` as the fraction of 1-2 SEMITONE intervals in the
    // raw corpus lines. A ladder has no semitones, so this is the ladder analogue:
    // the fraction of adjacent-slot moves. Same role (it gates the passing-tone
    // connectors), honestly a different measurement — noted rather than hidden.
    step: +(moves ? steps / moves : 0).toFixed(3),
    _fit: { phrases, notes },
  };
}

// THE SCRATCH PHRASE. A form running a weave has no phrase grid of its own — the
// weave IS its melody machine — so "fit from my phrases" would have nothing to fit
// (the gate caught exactly that: the button appeared to work and wrote nothing).
// The weave panel therefore carries its own grid, bound to this reserved name. It
// is INERT as vocabulary: no MEL_PHRASES entry is called this and no section can
// name it, so melodyCells["__fit"] never reaches a render — it exists only to be
// fitted from. That is the loop docs/DAW.md is for: draw examples, fit a
// generator, let the generator write the song.
export const SCRATCH = "__fit";

// Fit from every phrase this song has DRAWN — the scratch phrase first, then any
// cell the phrase editor has touched — falling back to the shipped cells the form
// runs so the button still does something before you have drawn anything.
export function fitFromSong(name) {
  const drawn = SONG.patch.melodyCells || {};
  let cells = Object.keys(drawn).map((k) => drawn[k]).filter((c) => c && c.length);
  let source = "your drawn phrases";
  if (!cells.length) {
    cells = CELLS.melodyPatterns().map((p) => CELLS.cellOf(p)).filter((c) => c && c.length);
    source = "the phrases this form already plays";
  }
  const w = fit(cells);
  if (!w) return null;
  commit(name, w);
  return { source, phrases: w._fit.phrases, notes: w._fit.notes };
}

// ---------- painting ----------
// Nudge one transition and renormalise its row. Painting the table directly is the
// other half of the loop: brush toward the diagonal for stepwise motion, toward
// the corners for leaps.
export function nudge(name, from, to, dir) {
  const w = weaveOf(name);
  if (!w || !w.slot || !w.slot[from]) return;
  const row = w.slot[from].slice();
  row[to] = Math.max(0.001, row[to] + dir * 0.12);
  w.slot[from] = norm(row);
  commit(name, w);
}

// which weave organs this song's form actually runs
export function weavePatterns() {
  return CELLS.melodyPatterns().filter((p) => isWeave(p));
}
