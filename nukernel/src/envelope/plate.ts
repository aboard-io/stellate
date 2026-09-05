// nukernel/src/envelope/plate.ts — THE PLATE, THE HANDLE, AND THE THUMB.
//
// What an ADSR and a breakpoint curve share, which is almost everything: a
// plate you can draw a curve on, handles a thumb can drag inside it, a
// keyboard that reaches every one of them, and a reset that works on a
// touchscreen.
//
// ===== FOUR THINGS THE AUX SPIKE MEASURED, AND ALL FOUR ARE LAW HERE ====
// (scratchpad/aux-spike, 2026-09-05, on a real touch emulation.)
//
//   1 · `touch-action: none` IS MANDATORY on the plate. Without it the browser
//       claims the gesture for a scroll and the widget gets a non-cancelable
//       touchstart it cannot use — the spike watched AUX give up on exactly
//       that and measured the page scrolling 400 -> 246 under a fader drag.
//   2 · DOUBLE-TAP RESET IS DEAD ON TOUCH. Measured at four gaps (60, 120,
//       200, 300 ms): zero `dblclick` events, every time. So the reset is a
//       LONG PRESS on the handle and a `clear` button beside the plate — two
//       affordances, neither of them a gesture the platform swallows.
//   3 · A 44px HANDLE AT THE EDGE OVERHANGS BY 22px. The spike's own chart
//       handles hung off the plate and the page scrolled sideways. So a
//       handle's CENTRE is clamped to [R, W-R] and the plate is drawn with
//       that much room at each end; nothing here may leave the plate's box.
//   4 · THE HANDLES ANSWER THE ARROW KEYS. §6 ¶A: a control that only works
//       with a pointer is a refused control. Left/Right (and Up/Down on a
//       level) step, Home/End go to the ends, and `role="slider"` with
//       aria-valuenow/valuetext is what a screen reader is handed.
//
// ===== AND ONE THIS PAGE HAS ITS OWN MEMORY NOTE ABOUT =================
// A DRAG WRITES ONCE, ON RELEASE — not on every pointermove. Every write on
// this page is a document write that normalises, recompiles and lands at the
// next bar; sixty of those a second is not an editor, it is a denial of
// service. The handle MOVES live (the curve follows the thumb, which is the
// whole point of drawing it) and the DOCUMENT is written when the thumb lifts.

/* THE WORDS ARE THE CATALOGUE'S (TABLE.md §12b). A build entry reaches it
   through ../copy/global.js — never ../copy/index.js, which would bundle a
   second copy of every string on the page into ui/envelope.js. */
import { t, fmt } from "../copy/global.js";

/** the handle's radius in CSS px — half of `--tap`. */
export const R = 22;
/** the drawn dot inside the 44px target. A mark is a thumb target or it is
 *  decoration (nu.css's own sentence); this is the target, that is the mark. */
export const DOT = 11;
/** how long a press must last to be a reset. 600 ms: longer than the 300 ms
 *  the spike measured a double-tap gap at, short enough to find by accident
 *  once and then on purpose. */
export const HOLD_MS = 600;

export interface HandleOpts {
  /** the address — `data-k`. */
  k: string;
  /** the stage's own word, from the catalogue (`env.seg.*`) — "Attack",
   *  "Sustain". NOT the caller's field label: knobs.js calls sustain "where it
   *  rests" on one instrument and "sustain" on the next, and a handle whose
   *  word changes with the instrument under it reads as six controls. */
  label: string;
  /** the value, in the field's own units, and its bracket. */
  value: number;
  min: number;
  max: number;
  step: number;
  /** the printed value, unit included. */
  say: string;
  /** which way a drag moves it: "x" (a time), "y" (a level), "xy" (a point on
   *  a breakpoint curve). */
  axis: "x" | "y" | "xy";
  /** where it sits on the plate, in px from the plate's top-left. */
  x: number;
  y: number;
  /** dim, undraggable, with the sentence — the no-silent-grey law. */
  why?: string | null;
}

/** THE PLATE'S GEOMETRY, ONE ARITHMETIC. A value in the field's own units
 *  becomes a px on the plate and back, and the handle's centre never leaves
 *  the plate (finding #3 above). */
export function scaleOf(w: number, lo: number, hi: number) {
  const span = Math.max(1e-9, hi - lo);
  const usable = Math.max(1, w - 2 * R);
  return {
    toPx: (v: number) => R + ((Math.min(hi, Math.max(lo, v)) - lo) / span) * usable,
    toVal: (px: number) => lo + ((Math.min(w - R, Math.max(R, px)) - R) / usable) * span,
  };
}

/** SNAP TO THE FIELD'S OWN STEP, and never past its own ends. A slider that
 *  writes 0.4372918 into a field whose step is 0.005 is writing a number the
 *  page will then print differently from what it stored. */
export function quantise(v: number, min: number, max: number, step: number): number {
  const s = step > 0 ? step : 0.001;
  const q = Math.round((v - min) / s) * s + min;
  const dp = Math.min(6, Math.max(0, Math.ceil(-Math.log10(s)) + 1));
  return Math.min(max, Math.max(min, +q.toFixed(dp)));
}

/** THE NUMBER BESIDE THE HANDLE, in the field's own unit. Seconds under a
 *  tenth read as milliseconds because that is how a hand thinks about an
 *  attack, and the unit is printed either way so nothing is guessed. */
export function say(v: number, unit: string): string {
  /* THE UNIT IS CHOSEN HERE, THE NUMBER IS FORMATTED IN ONE PLACE. A tenth of
     a second reads as milliseconds because that is how a hand thinks about an
     attack; everything after that — the decimals, the real minus sign, the
     space before the unit — is `fmt`'s, so a translator moves a separator once
     rather than in two hundred callers. */
  if (unit === "s" && v < 0.1) return fmt(v * 1000, "ms");
  /* ...and a filter cutoff over a kilohertz reads in kilohertz, for the same
     reason and by the same table `ui/eight.js knobFmt` already prints a knob's
     own Hz row with. A hand thinks "two k", not "2000". */
  if (unit === "Hz" && v >= 1000) return fmt(v / 1000, "kHz");
  return fmt(v, unit);
}

export interface DragHost {
  /** the plate element every handle is positioned inside. */
  plate: HTMLElement;
  /** live, on every frame of a drag: move the drawing, write nothing. */
  onMove(k: string, dx: number, dy: number, ev: PointerEvent): void;
  /** once, when the thumb lifts: this is the document write. */
  onDrop(k: string): void;
  /** the long-press reset. */
  onHold(k: string): void;
}

/** ONE HANDLE, and it is a `<button>` — not a `<div>` with a listener. A
 *  button is focusable, is in the tab order, answers Enter and Space, is read
 *  as a control, and is what test/shell.js's 44px sweep measures. */
export function handle(o: HandleOpts, host: DragHost): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "nu-envh" + (o.why ? " is-refused" : "");
  b.dataset.k = o.k;
  b.dataset.seg = o.axis;
  b.setAttribute("role", "slider");
  b.setAttribute("aria-valuemin", String(o.min));
  b.setAttribute("aria-valuemax", String(o.max));
  b.setAttribute("aria-valuenow", String(o.value));
  b.setAttribute("aria-valuetext", o.say);
  /* THE NAME IS THE STAGE AND THE VALUE, AND NOTHING ELSE. "(drag, or the
     arrow keys; press and hold to clear)" used to ride every handle: a
     `role="slider"` with a value already tells a reader what it is and how it
     answers, the gesture law is DESIGN.md §3, and an instruction repeated once
     per handle is a paragraph read aloud four times a sheet. */
  b.setAttribute("aria-label", o.why
    ? t("env.handleWhy", { name: o.label, value: o.say, why: o.why })
    : t("env.handle", { name: o.label, value: o.say }));
  if (o.why) { b.setAttribute("aria-disabled", "true"); b.dataset.why = o.why;
               b.title = o.why; }
  b.style.left = (o.x - R) + "px";
  b.style.top = (o.y - R) + "px";
  const dot = document.createElement("span");
  dot.className = "nu-envdot";
  b.append(dot);

  if (o.why) return b;

  let held: number | null = null;
  let from: { x: number; y: number } | null = null;
  let moved = false;
  const cancelHold = () => { if (held != null) { clearTimeout(held); held = null; } };

  b.addEventListener("pointerdown", (e: PointerEvent) => {
    /* THE CAPTURE IS ON THE HANDLE, so a thumb that slides off the plate keeps
       dragging the value it grabbed rather than dropping it — which is what
       every fader on every desk does and what a plate 200px tall makes
       necessary at the ends. */
    /* THE CAPTURE IS ATTEMPTED, NOT ASSUMED. `setPointerCapture` throws
       `NotFoundError` for a pointer id the browser does not have active — a
       synthetic `PointerEvent` from a gate, an assistive tool, or a pointer
       that ended between the event and the handler — and an uncaught throw in
       a `pointerdown` listener is a page error, which is what
       test/envelope.browser.js E0 sweeps for. The drag works either way; the
       capture only decides whether a thumb that slides off the plate keeps
       the value it grabbed. */
    try { b.setPointerCapture(e.pointerId); } catch (err) { /* no live pointer */ }
    from = { x: e.clientX, y: e.clientY };
    moved = false;
    e.preventDefault();
    held = window.setTimeout(() => { held = null; if (!moved) host.onHold(o.k); },
                             HOLD_MS);
  });
  b.addEventListener("pointermove", (e: PointerEvent) => {
    if (!from) return;
    const dx = e.clientX - from.x, dy = e.clientY - from.y;
    if (!moved && Math.abs(dx) + Math.abs(dy) > 3) { moved = true; cancelHold(); }
    if (!moved) return;
    host.onMove(o.k, dx, dy, e);
  });
  const up = (e: PointerEvent) => {
    cancelHold();
    if (from && moved) host.onDrop(o.k);
    from = null; moved = false;
    try { b.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
  };
  b.addEventListener("pointerup", up);
  b.addEventListener("pointercancel", up);
  return b;
}

/** WHAT AN ARROW KEY MEANS ON A HANDLE, in the field's own step. Returns the
 *  new value, or null when the key is not one of ours (so the caller may let
 *  the grid's own keyboard have it — a table cell's arrows move the
 *  selection, and this control lives inside one). */
export function keyStep(e: KeyboardEvent, v: number, min: number, max: number,
                        step: number, axis: "x" | "y" | "xy"): number | null {
  const big = e.shiftKey ? 10 : 1;
  const s = (step > 0 ? step : 0.001) * big;
  switch (e.key) {
    case "ArrowRight": case "ArrowUp":
      if (e.key === "ArrowUp" && axis === "x") return null;
      if (e.key === "ArrowRight" && axis === "y") return null;
      return quantise(v + s, min, max, step);
    case "ArrowLeft": case "ArrowDown":
      if (e.key === "ArrowDown" && axis === "x") return null;
      if (e.key === "ArrowLeft" && axis === "y") return null;
      return quantise(v - s, min, max, step);
    case "Home": return min;
    case "End":  return max;
    default: return null;
  }
}
