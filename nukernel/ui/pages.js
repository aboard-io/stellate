// ui/pages.js — the page rail: THREE hardware mode keys switching what the
// phone deck paints. A page switch is ONE attribute write on the chassis
// (CSS does the rest) — never a rebuild, so every module's elements stay
// alive and the gates' selectors stay in the DOM whichever page is up. On a
// desk the rail is display:none and this module goes quiet: every page is
// visible at once and nothing here ever runs.
//
// THREE KEYS, NOT FIVE (Paul, 2026-08-15: "many of the elements on the bottom
// and views are now less necessary because when I tap on a song section, it
// brings up a rich modal with tons of interaction"). SOUND and MIX were rail
// DESTINATIONS that edited the SELECTED box — you left the song to change a
// box, and the context strip existed to tell you which box you had left. The
// row sheet (ui/songrow.js) now carries both surfaces for the row you tapped,
// so the rail is down to the three places a person actually GOES:
//
//   SONG   home. The table of sections, and every box's editing surface is one
//          tap into the row it belongs to.
//   STEP   the phrase. One tracker table, sixteen 16ths, the bank under it —
//          not per box, which is why it is not in the row sheet.
//   MOVE   the arrangement: the pattern of the selected box running down the
//          screen, with the transition chips under it.
//
// NOTHING BECAME UNREACHABLE. The palette's six tabs and the mix table are in
// the sheet; MOVE still shows the palette on its transitions tab; the session
// bank and the master bus are on SONG where they always were. What went is two
// ways of arriving at a surface from the wrong place.
//
// Layer graph: ui view — imports state (events), palette (its tab follows
// the page) and touch; audio never knows pages exist.
import { on, emit } from "./state.js";
import { showTab } from "./palette.js";
import { buzz } from "./touch.js";

const chassis = document.getElementById("chassis");
const keys = [...document.querySelectorAll(".pkey")];

// MOVE is the one page that is still partly the palette: the arrangement
// screen with the transitions tab under it.
const PAGETAB = { move: "move" };

export function setPage(p) {
  if (chassis.dataset.page === p) return;
  chassis.dataset.page = p;
  for (const k of keys) k.setAttribute("aria-selected", String(k.dataset.page === p));
  if (PAGETAB[p]) showTab(PAGETAB[p]);
  // the arrangement measures its container; rendered while display:none it
  // measured 0 and drew at the floor width — remeasure now that it paints
  if (p === "move") emit("refresh");
  // the typed change: the context strip re-reads its phrase suffix, the step
  // navigator re-measures its viewport (0 while the page was display:none)
  emit("page", { page: p });
  buzz(4);
}
for (const k of keys) k.addEventListener("click", () => setPage(k.dataset.page));

// HAPTICS ON THE TRANSPORT (recon R8, and the one place audio state reaches
// the fingertips): a tick when play starts or stops. Guarded and rate-limited
// inside buzz(); a no-op on any fine pointer.
on("transport:state", () => buzz(4));
