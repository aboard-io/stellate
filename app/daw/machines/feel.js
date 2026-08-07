// machines/feel.js — the SONG-aware half of the feel vector.
//
// The axes and their writers are pure functions over a state (feel-core.js); this
// file is only the binding to the document: read the axes off the resolved song,
// and record a set axis as ONE NUMBER in patch.feel rather than as the params it
// eventually moves.
//
// Why one number: see the header of feel-core.js. Writing the resolved params into
// the patch pinned the whole `instruments` block, which both blew the URL budget
// and froze the instrument choices so re-shaping the genre could not change them.
// Storing the axis and re-applying it to each freshly resolved state is what makes
// "shape the genre, then tune the feel" compose instead of fight.
import { SONG, edit, state } from "../song.js";
import { axesOf, isDraggable, applyFeel, AXIS_IDS } from "./feel-core.js";

export { axesOf, isDraggable, applyFeel, AXIS_IDS };
export const axes = () => axesOf(state());

export function setAxis(id, v) {
  if (!isDraggable(id)) return false;
  const feel = Object.assign({}, SONG.patch.feel || {});
  feel[id] = Math.max(0, Math.min(1, v));
  edit({ patch: Object.assign({}, SONG.patch, { feel }) });
  return true;
}

export const isEdited = () => !!(SONG.patch.feel && Object.keys(SONG.patch.feel).length);
export function revert() {
  const p = Object.assign({}, SONG.patch);
  delete p.feel;
  edit({ patch: p });
}
