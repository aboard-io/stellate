// ui/pages.js — the page rail: FOUR mode keys switching what the deck
// paints, at every width now (2026-08-16, "get rid of the non-mobile
// vertical UX" — the desk stopped dissolving the chassis into a stacked
// column, so the phone layout is simply THE layout). A page switch is ONE
// attribute write on the chassis (CSS does the rest) — never a rebuild, so
// every module's elements stay alive and the gates' selectors stay in the
// DOM whichever page is up. Also owns the URL: every page, and the phrase or
// section it is showing, round-trips through the hash — see the router
// below setPage.
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
import { on, emit, SLOTS, SONG, slot, viewSec, setSlot, setViewSec, commit }
  from "./state.js";
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
  syncHash(true);
}

/* ---------- every place in the app has an address ----------
   Paul: "every nav element should have a URL." Hash routing — a static page
   under a path, so a path router would need server rules this repo does not
   ship (docs/HOSTING.md nginx config is not this lane's to touch). Three
   things ride the fragment: the PAGE, and whichever index that page is
   showing — the phrase on Compose (slot), the section on Arrange AND on Mix
   (viewSec: the board is built from curSection(), the same cursor Arrange
   scrubs, so "the selected section on Arrange" and "the open section of the
   Mix hierarchy" are one number wearing two hats). #/lab carries no index —
   the bench's own cross lives entirely inside ui/lab.js, a file this lane
   does not touch.
     #/<page>            lab, or any page with nothing else to say
     #/<page>/<index>    compose (slot) · song, mix (viewSec)
   The URL is a MIRROR, never a second source of truth: it is written AFTER
   a state change (setPage above; the "selection" sub below), and reading a
   URL back (a rail tap, back/forward, a pasted link) runs the exact same
   setSlot/setViewSec/setPage/commit calls a click already uses — one door,
   whichever hand opens it. */
function currentHash() {
  const p = chassis.dataset.page;
  if (p === "compose") return "#/compose/" + slot;
  if (p === "song" || p === "mix") return "#/" + p + "/" + viewSec;
  return "#/" + p;
}
// trusts the DOM for what a page even IS — the same "nothing below counts
// them" law the rail itself follows (see the header above) — so a fifth
// page key gains a URL for free, and a bad fragment (an old bookmark, a
// typo) reads back as NO route rather than a guess.
function parseRoute(hash) {
  const m = /^#\/([a-z]+)(?:\/(\d+))?$/.exec(hash || "");
  if (!m || !keys.some(k => k.dataset.page === m[1])) return null;
  return { page: m[1], i: m[2] != null ? +m[2] : null };
}
// true only while a route just read FROM the address bar is being applied,
// so the writes that follow (setPage's own, and "selection" below) PATCH the
// entry already there instead of stacking a second one on top of it.
let restoring = false;
function syncHash(push) {
  const h = currentHash();
  if (h === location.hash) return;
  if (push && !restoring) history.pushState(null, "", h);
  else history.replaceState(null, "", h);
}
function applyRoute(r) {
  if (!r) return;
  restoring = true;
  if (r.page === "compose" && r.i != null && SLOTS[r.i]) setSlot(r.i);
  if ((r.page === "song" || r.page === "mix") && r.i != null && SONG[r.i]) setViewSec(r.i);
  setPage(r.page);
  commit("selection");          // the index may have moved; every view repaints
  restoring = false;
}
// boot: a saved hash restores the page it named — a shared link lands on
// what the sender was looking at — while no hash, or one this rail does not
// recognise, writes the CURRENT state back as the canonical URL rather than
// leaving the address bar lying about what's on screen. Called from main.js
// AFTER adoptSong: SLOTS/SONG must hold the real song before an index in the
// fragment can be checked against them.
export function initRoute() {
  const r = parseRoute(location.hash);
  if (r) applyRoute(r); else syncHash(false);
}
addEventListener("hashchange", () => applyRoute(parseRoute(location.hash)));
addEventListener("popstate", () => applyRoute(parseRoute(location.hash)));
// the selection moving without the PAGE moving (a different row tapped on
// Arrange, a different phrase picked off the Compose bank) still gets a URL
// — just not a new history entry: scrubbing through rows is not a series of
// places to visit, only arriving at Compose or Arrange is.
on("selection", () => syncHash(false));

// the rail: real <a href> now (Paul: "they become real links in
// behaviour") — right-click copies a real address, a modified click opens a
// real tab. A PLAIN click is still driven through setPage() rather than left
// to the browser's own hash jump, so the fragment it lands on carries the
// index on the first paint instead of a bare "#/compose" corrected a tick
// later by the listeners above.
for (const k of keys) {
  k.addEventListener("click", ev => {
    if (ev.defaultPrevented || ev.button !== 0 ||
        ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();
    setPage(k.dataset.page);
  });
}

// HAPTICS ON THE TRANSPORT (recon R8, and the one place audio state reaches
// the fingertips): a tick when play starts or stops. Guarded and rate-limited
// inside buzz(); a no-op on any fine pointer.
on("transport:state", () => buzz(4));
