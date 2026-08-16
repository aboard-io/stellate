// ui/readout.js — the one-line #readout: what the selected box is, or a
// transient status like "loading…". (The #src "what the selected box asks
// for" pane went with the MOVE page — "the row and the board": its facts are
// the cell values and popup states now.) Status messages from the audio tier
// arrive as EVENTS rather than as a function call from transport into the UI.
//
// Layer graph: ui view — imports state/derive/deps, publishes nothing.
import { GENRES, ROMAN, harm, blank } from "./deps.js";
import { SLOTS, GROOVE, viewSec, curSection, on } from "./state.js";
import { sectionRender, stackOf, stackLabel, opsOf } from "./derive.js";
// the carrier's one line. On mobile the rendered tape IS the audible path
// (audio/bounce.js), so an edit is heard when its re-render swaps at the loop
// — a person is owed that sentence for as long as it is true, not for the one
// frame a transient status message survives. Null on a desk, where the
// carrier is invisible insurance.
import { carrierNote } from "../audio/bounce.js";

const readoutEl = document.getElementById("readout");

// A STICKY status survives exactly one render. Renders are coalesced onto the
// next animation frame now, so a message written right after a change (the
// composer's "seed N — press play", a loader refusal) would be overwritten a
// frame later by the box description that change triggered. Sticky means: let
// that one render pass, then behave normally — which is precisely the lifetime
// these messages had when draw() was synchronous.
let hold = false;
export function status(text, sticky) {
  readoutEl.textContent = text;
  if (sticky) hold = true;
}

/* ---------- the box readout ---------- */
function describe() {
  const sec = curSection();
  const { g, bars, ev } = sectionRender(sec, SLOTS, GROOVE);
  const roots = g.harmony === "modal" ? "one mode, no motion"
    : "roots " + Array.from({ length: bars }, (_, b) =>
        ROMAN[harm(SLOTS[stackOf(sec)[0].slots[0]] || blank(), g, sec.nudge + b)]).join(" ") +
      (g.harmony === "emergent" ? " (computed)" : "");
  // Say WHY a box is silent rather than leaving it to be discovered by ear.
  const quiet = [];
  if (!ev.length) quiet.push("no events at all");
  else {
    if (!ev.some(e => e.kind === "line")) quiet.push(
      opsOf(sec, stackOf(sec)[0]).includes("drop1") ? "no melody (drop 1)"
        : !stackOf(sec).some(e => e.slots.length) ? "no melody (no phrase)" : "no melody");
    if (ev.every(e => (e.vel == null ? 5 : e.vel) === 0)) quiet.push("velocity 0 (a completed fade)");
  }
  readoutEl.textContent =
    "box " + (viewSec + 1) + " · " + stackLabel(sec) + " · " +
    stackOf(sec).map(e => GENRES[e.g].label + " " +
      (e.slots.length ? e.slots.map(i => i + 1).join("+") : "no phrase")).join(" | ") +
    " · " + bars + " bar" + (bars === 1 ? "" : "s") +
    (sec.nudge ? " nudged " + sec.nudge : "") + " · " + roots +
    // WHAT IT IS SINGING, in the words. A sung line is the one thing on the
    // page whose content is not visible anywhere else in this readout, and a
    // box that sings nothing (the chip is on but the tune has no note long
    // enough — see sing.js MIN_STEPS) has to be able to say so.
    (sec.sing ? "  ·  " + (() => {
      const sung = ev.filter(e => e.kind === "sing");
      if (!sung.length) return sec.sing + ": nothing long enough to sing";
      const words = sung.filter(e => e.vi === 0).map(e => e.syl).join(" ");
      return sec.sing + ' "' + words + '"';
    })() : "") +
    (quiet.length ? "  —  " + quiet.join(", ") : "") +
    (carrierNote() ? "  —  " + carrierNote() : "");
}

export function update() {
  if (hold) { hold = false; return; }
  describe();
}

// SELF-SUBSCRIBED, COALESCED. The arrangement view used to call update() at
// the end of its own coalesced render; the arrangement is gone, so the line
// owns its schedule — one rAF per burst of change events, never one rewrite
// per pointer event (a scrub commits "phrase" per pointermove).
let queued = false;
const queue = () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; update(); });
};
for (const t of ["song", "box", "selection", "phrase", "refresh"]) on(t, queue);
on("status", d => status(d.text, d.sticky));
