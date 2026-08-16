// ui/pages.js — the page rail: TWO hardware mode keys switching what the
// phone deck paints. A page switch is ONE attribute write on the chassis
// (CSS does the rest) — never a rebuild, so every module's elements stay
// alive and the gates' selectors stay in the DOM whichever page is up. On a
// desk the rail is display:none and this module goes quiet: every page is
// visible at once and nothing here ever runs.
//
// TWO KEYS ("the row and the board", 2026-08-15). The tracker pages went
// entirely — STEP is the phrase editor POPUP (opened from a row's PATTERN
// cells), MOVE's pattern view is gone, and SOUND's palette lives in the
// per-cell popups — so the rail is down to the two places a person GOES:
//
//   SONG   home. The table of sections; every box's editing surface is one
//          tap into a cell of the row it belongs to.
//   MIX    the desk: the mix of the selected box, and the master rack.
//
// NOTHING BECAME UNREACHABLE. The palette's banks are in the cell popups
// (ui/palette.js mountBanks maps them); the phrase editor opens from any
// PATTERN chip; the session bank stays on SONG. What went is pages that
// edited the selected box from somewhere the box was not on screen.
//
// Layer graph: ui view — imports state (events) and touch; audio never knows
// pages exist.
import { on, emit } from "./state.js";
import { buzz } from "./touch.js";

const chassis = document.getElementById("chassis");
const keys = [...document.querySelectorAll(".pkey")];

export function setPage(p) {
  if (chassis.dataset.page === p) return;
  chassis.dataset.page = p;
  for (const k of keys) k.setAttribute("aria-selected", String(k.dataset.page === p));
  // the typed change: open popups dismiss (their row left the screen), and
  // any view that measured itself while display:none re-measures
  emit("page", { page: p });
  buzz(4);
}
for (const k of keys) k.addEventListener("click", () => setPage(k.dataset.page));

// HAPTICS ON THE TRANSPORT (recon R8, and the one place audio state reaches
// the fingertips): a tick when play starts or stops. Guarded and rate-limited
// inside buzz(); a no-op on any fine pointer.
on("transport:state", () => buzz(4));
