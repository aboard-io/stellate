// ui/pages.js — the page rail: five hardware mode keys switching what the
// phone deck paints. A page switch is ONE attribute write on the chassis
// (CSS does the rest) — never a rebuild, so every module's elements stay
// alive and the gates' selectors stay in the DOM whichever page is up. On a
// desk the rail is display:none and this module goes quiet: every page is
// visible at once and nothing here ever runs.
//
// Layer graph: ui view — imports state (events), palette (its tab follows
// the page) and touch; audio never knows pages exist.
import { on, emit } from "./state.js";
import { showTab } from "./palette.js";
import { buzz } from "./touch.js";

const chassis = document.getElementById("chassis");
const keys = [...document.querySelectorAll(".pkey")];

// Three of the five pages are the palette wearing a different tab: SOUND is
// the sound tab (line/voice stay reachable as sub-tabs), MIX is rhythm
// (fx/sends beside it), MOVE is transitions plus the arrangement screen.
const PAGETAB = { sound: "sound", mix: "rhythm", move: "move" };

export function setPage(p) {
  if (chassis.dataset.page === p) return;
  chassis.dataset.page = p;
  for (const k of keys) k.setAttribute("aria-selected", String(k.dataset.page === p));
  if (PAGETAB[p]) showTab(PAGETAB[p]);
  // the arrangement measures its container; rendered while display:none it
  // measured 0 and drew at the floor width — remeasure now that it paints
  if (p === "move") emit("refresh");
  buzz(4);
}
for (const k of keys) k.addEventListener("click", () => setPage(k.dataset.page));

// HAPTICS ON THE TRANSPORT (recon R8, and the one place audio state reaches
// the fingertips): a tick when play starts or stops. Guarded and rate-limited
// inside buzz(); a no-op on any fine pointer.
on("transport:state", () => buzz(4));
