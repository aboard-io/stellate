// ui/ctxstrip.js — the context strip: one LCD line between the transport and
// the deck, on EVERY page, that says where edits land — 'BOX 3 · VERSE ·
// City pop · 4 bars', plus '· phrase 2' while the STEP page is up. The
// SOUND/MIX/STEP chips all write to the selected box, and on a phone that box
// is off-screen the moment the page rail moves; this strip is the box's name
// tag, so no page ever has to be trusted about what it is editing. Tapping it
// jumps to the SONG page, where the named box is the one wearing .sel.
//
// Layer graph: ui view — imports state/derive/deps and pages (the jump);
// patched on the same typed events the other views draw from, plus "page"
// (ui/pages.js publishes it) so the phrase suffix follows the deck.
import { ROLES } from "./deps.js";
import { SONG, viewSec, slot, bpm, curSection, on } from "./state.js";
import { stackLabel, boxBars, secsOf, mmss } from "./derive.js";
import { setPage } from "./pages.js";

const strip = document.getElementById("ctxstrip");
const text = document.getElementById("ctxtext");
const chassis = document.getElementById("chassis");

function render() {
  const sec = curSection();
  const bars = boxBars(sec);
  // BOX and the role are silkscreen (they NAME the thing); the stack label is
  // data and keeps its authored case — the hw.css silkscreen rule, in a string
  const parts = [
    "BOX " + (Math.min(viewSec, SONG.length - 1) + 1),
    sec.role ? ROLES[sec.role].toUpperCase() : null,
    stackLabel(sec),
    bars + " bar" + (bars === 1 ? "" : "s"),
  ];
  if (chassis.dataset.page === "step") parts.push("phrase " + (slot + 1));
  const t = parts.filter(Boolean).join(" · ");
  if (text.textContent !== t) text.textContent = t;
  strip.title = "every sound / mix / step edit lands on this box (" +
    mmss(secsOf(sec, bpm)) + ") — tap to see it in the song";
}
// song = compose/load/reset/boot; box = musical edits (len moves the bar
// count); selection = box select AND phrase-slot select; page = the deck
// moved; transport = bpm (the duration in the title)
for (const t of ["song", "box", "selection", "page", "transport"]) on(t, render);

strip.addEventListener("click", () => {
  setPage("song");
  const b = document.querySelector(".box.sel");
  if (b) b.scrollIntoView({ block: "nearest" });
});
render();
