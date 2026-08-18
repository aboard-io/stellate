// ui/readout.js — ROW 2 of the transport: the GENRE LOZENGE, then song
// position and section name (2026-08-17, Paul: "success is almost no words" —
// the old line read out roots, silence reasons and sung lyrics in full
// sentences; quiet fields replace it, no label and no punctuation of their
// own — a CSS rule divides them, not a character).
//
// THE FIRST FIELD BECAME A CONTROL in the same pass ("move the genre selector
// into the little bar below and make the genre a clickable lozenge. That'll
// be where we pick genre"): #posgenre is the FACE of a pill that ui/chrome.js's
// <select id="composeg"> is stretched invisibly over, so the thing that says
// which genre this is and the thing that changes it are one object. This file
// still only ever WRITES the word — the picking, and what picking does, stays
// chrome.js's — plus the one line that points the select at the same genre the
// pill is printing, because a control that opens onto a different answer than
// the one on its own face is two controls. #lcdpos is main.js's own element, written
// every bar by its playhead rAF loop; this file only ever READS its id off
// the DOM to know where it sits, never rebuilds it, because a fresh node
// would orphan main.js's cached reference to it. Status messages from the
// audio tier still arrive as EVENTS, and still take the row over whole,
// through #posmsg — a transient sentence (loading, a rejected song, the
// mobile carrier's own honesty about a pending re-render) outranks the three
// fields for exactly one render (the `hold` law below, unchanged).
//
// Layer graph: ui view — imports state/derive/deps, publishes nothing. (The
// import from audio/transport below is the same allowed direction chrome.js
// already uses — a view reading the audio tier, never the reverse.)
import { GENRES, ROLES } from "./deps.js";
import { SONG, curSection, on } from "./state.js";
import { gid } from "./derive.js";
import { playing, playingSec, routeNote, onMedia, lastLoadReport } from "../audio/live.js";

const readoutEl = document.getElementById("readout");
const genreEl = document.getElementById("posgenre");
const secEl = document.getElementById("possection");
const msgEl = document.getElementById("posmsg");
// THE LOZENGE'S OTHER HALF. #posgenre is the face of the genre pill now, and
// #composeg — the real <select> ui/chrome.js fills — is stretched invisibly
// over that same pill (2026-08-17: "make the genre a clickable lozenge...
// that'll be where we pick genre"). One control, so one fact: this file
// writes the WORD from the song and points the select's own selected option
// at the same genre, so opening the list lands on what the pill just said.
// chrome.js writes the value the other way after a compose; both writes are
// idempotent and neither fires a change event, so there is no loop.
const pickEl = document.getElementById("composeg");

// A STICKY status survives exactly one render — unchanged from before. What
// changed is the SOURCE of one recurring message: main.js used to announce
// every playing-box change itself ("▶ box N · role · label", the little play
// symbol Paul asked gone). This file now reads the playing section directly
// (describe(), below) on the same event, so that announcement is swallowed
// here rather than shown — the glyph it carried needed no replacement,
// because the fact it carried is already on the row.
let hold = false;
export function status(text, sticky) {
  if (/^▶ box /.test(text)) return;
  msgEl.textContent = text;
  readoutEl.classList.add("msg");
  if (sticky) hold = true;
}

/* ---------- the lozenge, and the two fields ---------- */
// WHICH SECTION: the box actually SOUNDING while the transport runs, else
// the box a person is LOOKING at (state.js curSection/viewSec) — the same
// section the position field (main.js's #lcdpos) is already describing,
// which is the whole point of putting them on one row.
const here = () => (playing && playingSec >= 0 && SONG[playingSec]) || curSection();

// THE LOZENGE IS A CONTROL, AND A CONTROL IS NEVER STALE. It is painted on
// every update, INCLUDING the ones a sticky status message holds the rest of
// the row back for — which is not a nicety: composing a song ends in exactly
// such a message, so the one repaint that follows the genre changing was the
// one repaint the pill used to be skipped by, and the pill sat there naming
// the genre before last while the song played the new one.
function paintGenre() {
  const sec = here();
  if (!sec) return;
  const g = gid(sec);
  const label = (GENRES[g] || { label: g }).label;
  if (genreEl.textContent !== label) genreEl.textContent = label;
  // the picker follows the pill it is stretched over. `!== g` first, because
  // assigning a <select>'s value while its list is open on a phone closes it.
  if (pickEl && pickEl.value !== g && GENRES[g]) pickEl.value = g;
}

function describe() {
  readoutEl.classList.remove("msg");
  const sec = here();
  if (!sec) return;
  const note = routeNote();
  secEl.textContent = (sec.role ? ROLES[sec.role] : "—") + (note ? "  " + note : "");
}

export function update() {
  paintGenre();
  if (hold) { hold = false; return; }
  describe();
}

/* ---------- the loading line ---------- */
// COMING BACK IS NOT INSTANT, AND THE PAGE SAYS SO (2026-08-17, Paul: "why
// don't you fade out radio and come back to live with a loading graphic on
// page"). While the rendered tape keeps the song, the live graph is rebuilding
// behind it — filling a bar, warming voices, proving it can sound — and that
// takes a bar or two. A page that showed nothing would look frozen; a page that
// showed a sentence would be back to explaining itself.
//
// So it is a HAIRLINE on the rule this row already draws, and it is the
// parent's honest boot-progress meter (app/audio/live.js bootTo/bootStart, "we
// drive the bar off THOSE events only — never a timer faking progress"): it
// moves when a MILESTONE closes, it is monotonic, and when nothing has closed
// for a second and a half it stops pretending and shimmers instead of creeping
// to 99%. No text, no percentage — the only wordless thing this row has ever
// had to say is "wait".
const loadEl = document.createElement("span");
loadEl.className = "posload";
loadEl.setAttribute("aria-hidden", "true");       // it is not a field; it is the rule moving
readoutEl.appendChild(loadEl);
on("return", d => {
  // scaleX rather than width: the line rides the compositor, so it never
  // competes with the bar the graph is trying to schedule beneath it
  loadEl.style.transform = "scaleX(" + Math.max(0, Math.min(1, d.frac || 0)) + ")";
  loadEl.classList.toggle("stall", !!d.stalled);
  readoutEl.classList.toggle("loading", !!d.on);
});

/* ---------- the CPU monitor: what the desk is costing, in the corner ------
   "sneak a cpu monitor on mobile" (Paul) — SNEAK is the operative word. A
   three-bar chip lives at the end of this row always, wordless, and says
   nothing on its own; a tap unfolds one line of the numbers behind it, the
   same terse currency the parent app's own chyron reads load out in
   (app/panels/readouts.js: "engine 0.97x"). It never steals a row — the chip
   sits IN row 2, and the unfolded line replaces nothing, it just prints
   after the chip until the next tap folds it away again.

   audio/live.js publishes both halves now: the parent engine's own load ratio
   and the ROUTE it opened. There used to be a second fact here that no single
   module could answer — whether the rendered carrier or the live graph had the
   ear — because they were two engines and neither could see the other. One
   engine has one output, and it knows which one it is. */
const loadChip = document.createElement("button");
loadChip.type = "button";
loadChip.className = "loadchip";
loadChip.setAttribute("aria-label", "engine load");
loadChip.innerHTML = '<i class="lb"></i><i class="lb"></i><i class="lb"></i>';
const loadDetail = document.createElement("output");
loadDetail.className = "loaddetail";
readoutEl.append(loadChip, loadDetail);

// OPEN/CLOSED SURVIVES A RELOAD ("must survive a reload either way") — the
// chip itself never leaves the row, so what persists is only whether the
// detail line is unfolded, the same sticky-flag law VOLSTORE/RUBSTORE use.
const LOADSTORE = "nukernel.loadopen.v1";
let loadOpen = false;
try { loadOpen = localStorage.getItem(LOADSTORE) === "1"; } catch (e) { /* private mode */ }
let lastLoad = { load: 1, drops: 0, voices: 0, nodes: 0 };
function paintLoad() {
  const path = onMedia() ? "media" : "stream";
  loadChip.classList.toggle("warn", lastLoad.load < 0.9);
  loadChip.classList.toggle("bad", lastLoad.load < 0.6);
  loadChip.classList.toggle("carrier", onMedia());
  readoutEl.classList.toggle("loadopen", loadOpen);
  // one line, numbers first — the same "engine 0.97x" idiom the parent's
  // chyron already reads this exact ratio out in, so a reader of both apps
  // is reading one language. Blank when folded: an aria-hidden width:0 line
  // would still be there for a screen reader to stumble into.
  loadDetail.textContent = loadOpen
    ? lastLoad.load.toFixed(2) + "x · " + lastLoad.voices + "v · " + path +
      (lastLoad.drops ? " · " + lastLoad.drops + "⚠" : "")
    : "";
}
loadChip.addEventListener("click", () => {
  loadOpen = !loadOpen;
  try { localStorage.setItem(LOADSTORE, loadOpen ? "1" : "0"); } catch (e) { /* private mode */ }
  paintLoad();
});
on("load", d => { lastLoad = d; paintLoad(); });
// the audible path can flip with no new load sample under it (a return
// crossfade lands between two 1 s ticks) — "return"'s own milestones already
// fire often enough to keep the chip honest without a poll of its own
on("return", () => paintLoad());
{ const r = lastLoadReport(); if (r) lastLoad = { ...lastLoad, ...r }; }
paintLoad();

// SELF-SUBSCRIBED, COALESCED — one rAF per burst of change events, never one
// rewrite per pointer event (a scrub commits "phrase" per pointermove).
// "transport:section" joins the list here (it used to only drive main.js's
// own status announcement): it is what moves the playing box, so it is what
// this row now has to repaint on.
let queued = false;
const queue = () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; update(); });
};
for (const t of ["song", "box", "selection", "phrase", "refresh", "transport:section"])
  on(t, queue);
on("status", d => status(d.text, d.sticky));
