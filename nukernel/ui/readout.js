// ui/readout.js — the words under the arrangement: the one-line #readout
// (what the selected box is, or a transient status like "loading…") and the
// #src pane ("what the selected box asks for"). Split from the old draw() so
// that text updates never require rebuilding the grid, and so status messages
// from the audio tier arrive as EVENTS rather than as a function call from
// transport into the UI.
//
// Layer graph: ui view — imports state/derive/deps and audio/mixer (for the
// pure chanSpec), publishes nothing.
import { GENRES, ROMAN, harm, blank, MODES, MODELABEL, SCALELABEL,
         OPLABEL, ENVLABEL, MOTLABEL, INLABEL, OUTLABEL, DTLABEL, RATELABEL,
         FX } from "./deps.js";
import { SLOTS, viewSec, curSection, on } from "./state.js";
import { sectionRender, stackOf, stackLabel, opsOf, genreOf, kitOf, gid } from "./derive.js";
import { chanSpec } from "../audio/mixer.js";
// the carrier's one line. On mobile the rendered tape IS the audible path
// (audio/bounce.js), so an edit is heard when its re-render swaps at the loop
// — a person is owed that sentence for as long as it is true, not for the one
// frame a transient status message survives. Null on a desk, where the
// carrier is invisible insurance.
import { carrierNote } from "../audio/bounce.js";

const readoutEl = document.getElementById("readout");
const srcEl = document.getElementById("src");

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
  const { g, bars, ev } = sectionRender(sec, SLOTS);
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

/* ---------- what the selected box asks for ---------- */
function writeSrc() {
  const sec = curSection();
  const g = genreOf(sec), cs = chanSpec(sec);
  const kit = Object.keys(g.kit || {}).length
    ? Object.entries(g.kit).map(([d, v]) => "  " + d + ": [" + v.join(",") + "]").join("\n")
    : '  {}   <span class="c">// a fugue has no drums. The empty kit is the fact.</span>';
  srcEl.innerHTML =
    g.label.toUpperCase() + "\n\n" +
    "form       " + g.bars + " bars\n" +
    "window     " + sec.len + " bars from bar " + (sec.nudge + 1) + "\n" +
    "phrases    " + stackOf(sec).map(e => GENRES[e.g].label + ": " +
      (e.slots.length ? e.slots.map(i => i + 1).join(", ") : "none")).join("\n           ") + "\n" +
    "rate       " + g.rate + (sec.rate ? "  (" + RATELABEL[sec.rate] + ")" : "") +
      (g.swing ? "   swing " + g.swing.toFixed(2) : "") + "\n" +
    "scale      [" + (g.scale || [0, 3, 5, 7, 10]).join(" ") + "]  " +
      (sec.scale ? SCALELABEL[sec.scale] : GENRES[gid(sec)].scale ? "genre's own" : "minor pentatonic") +
      "  — " + (12 / (g.scale || [0, 3, 5, 7, 10]).length).toFixed(1) +
      " semitones per degree-step\n" +
    "harmony    " + g.harmony + (g.roots ? "  [" + g.roots.map(r => ROMAN[r]).join(" ") + "]" : "") + "\n" +
    "mode       " + (sec.mode ? MODELABEL[sec.mode] + "  [" + MODES[sec.mode].join(" ") + "]"
                              : "natural minor  [0 2 3 5 7 8 10]") + "\n" +
    "transforms " + (sec.ops.length || sec.env
      ? [...sec.ops.map(o => OPLABEL[o]), ...(sec.env ? [ENVLABEL[sec.env]] : [])].join(" + ")
      : "none") + "\n" +
    // THE CHANNEL, in the same terms the palette used to ask for it. A box that
    // sounds wrong is usually a mix question, and until this line existed the
    // panel could tell you everything about the notes and nothing about the mix.
    "channel    " + (sec.fx && sec.fx.length ? sec.fx.map(k => FX[k].label).join(" -> ")
                                             : "no inserts") + "\n" +
    "sends      reverb " + Math.round(cs.rev * 100) + "% -> " + cs.verb +
      " · echo " + Math.round(cs.del * 100) + "%" +
      (sec.dtime ? " at " + DTLABEL[sec.dtime] : "") + "\n" +
    "place      level " + cs.lvl.toFixed(2) + " · pan " + cs.pan.toFixed(2) +
      (cs.mot ? " · " + MOTLABEL[cs.mot] : "") + "\n" +
    "edges      " + (sec.intro ? INLABEL[sec.intro] : "straight in") + " / " +
      (sec.outro ? OUTLABEL[sec.outro] : "straight out") + "\n\n" +
    "kit        " + (kitOf(sec) || "none") + "\n" + kit;
}

export function update() {
  if (hold) { hold = false; writeSrc(); return; }
  describe(); writeSrc();
}

// no self-subscription to the change events: arrange.js calls update() at the
// end of its (coalesced) render, exactly as the old draw() called writeSrc —
// one text rewrite per real grid rebuild, never one per pointer event
on("status", d => status(d.text, d.sticky));
