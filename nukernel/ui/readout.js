// ui/readout.js — ROW 2 of the transport: root genre, song position, section
// name (2026-08-17, Paul: "success is almost no words" — the old line read
// out roots, silence reasons and sung lyrics in full sentences; three quiet
// fields replace it, no label and no punctuation of their own — a CSS rule
// divides them, not a character). #lcdpos is main.js's own element, written
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
import { carrierNote } from "../audio/bounce.js";
import { playing, playingSec } from "../audio/transport.js";

const readoutEl = document.getElementById("readout");
const genreEl = document.getElementById("posgenre");
const secEl = document.getElementById("possection");
const msgEl = document.getElementById("posmsg");

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

/* ---------- the three fields ---------- */
// WHICH SECTION: the box actually SOUNDING while the transport runs, else
// the box a person is LOOKING at (state.js curSection/viewSec) — the same
// section the position field (main.js's #lcdpos) is already describing,
// which is the whole point of putting them on one row.
function describe() {
  readoutEl.classList.remove("msg");
  const sec = (playing && playingSec >= 0 && SONG[playingSec]) || curSection();
  if (!sec) return;
  genreEl.textContent = (GENRES[gid(sec)] || { label: gid(sec) }).label;
  const note = carrierNote();
  secEl.textContent = (sec.role ? ROLES[sec.role] : "—") + (note ? "  " + note : "");
}

export function update() {
  if (hold) { hold = false; return; }
  describe();
}

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
