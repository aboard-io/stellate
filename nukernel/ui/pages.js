// ui/pages.js — the page rail: FOUR mode keys switching what the
// phone deck paints. A page switch is ONE attribute write on the chassis
// (CSS does the rest) — never a rebuild, so every module's elements stay
// alive and the gates' selectors stay in the DOM whichever page is up. On a
// desk the rail is display:none and every page is visible at once —
// setPage() still runs there (openPhraseEditor calls it as the one
// navigation verb), it just paints nothing.
//
// FOUR KEYS — the app says what you DO, and each verb has exactly one place.
// NOTHING BELOW COUNTS THEM: the rail is read out of the DOM
// (querySelectorAll(".pkey")) and a page switch is one attribute write, so the
// LAB key was markup and CSS only — this file did not change to gain a fourth
// page and will not change to gain a fifth.
//
//   COMPOSE  the phrase editor, a full page again — the modal died. Reached
//            by the rail, or by tapping a PATTERN thumbnail on an Arrange
//            row (ui/editor.js openPhraseEditor navigates here).
//            Internal key "compose".
//   ARRANGE  home. The table of sections plus the song-level banks
//            (instruments, session). Internal key "song" — the key is a DOM
//            value the CSS and gates hook ([data-page="song"], .pg-song),
//            and only the rail key ever said the word, so the label
//            renamed and the key did not: fewer broken selectors, zero
//            behavior risk.
//   MIX      the board and the rack.
//   LAB      the bench where genres are crossed — parents in, architecture
//            out, the material left for a person (ui/lab.js). Last on the
//            rail: it makes the parts a song is made of, and it must never
//            stand between a person and their song.
//
// NOTHING BECAME UNREACHABLE. The palette's banks are in the cell menus
// (ui/palette.js mountBanks maps them); the phrase editor is the Compose
// page; the session and instrument-pool banks stay on Arrange (they are
// song-level, and Arrange is the song's home).
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
