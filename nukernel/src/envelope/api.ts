// nukernel/src/envelope/api.ts — WHAT AN ENVELOPE EDITOR IS ASKED, AND TOLD.
//
// TABLE.md §11 (RULED 2026-09-05). Paul, after the AUX spike: *"Don't do aux.
// keep our stuff but make it less chunky and more stylish. Make an Adsr and
// envelope editor though and use that for samples etc."* And, on the family
// this is the first member of: *"Look for places where UX could help like eq
// editors too."*
//
// ONE SEAM, AND IT IS A LIST OF DOORS — the shape src/table/api.ts already
// uses, for the same reason: the caller owns the document and the write path,
// and this module owns the drawing and the thumb. Nothing here imports
// ui/eight.js, reads a document, or knows what a chair is.
//
// THE UNITS ARE THE FIELD'S OWN. A sampled chair's attack is SECONDS
// (audio/to-engine.js toneRecipe, clamped 0.001..5), a synth's `attack` row in
// nukernel/knobs.js is seconds too, and `sustain` is a LEVEL (0..1) with no
// unit at all. The editor never converts: it prints `unit` beside the handle
// and hands `set` the number in that unit, so there is one place a
// seconds-vs-milliseconds mistake could be made and it is the caller's table.
// (This repo has already paid for that one — the glide bug §9b names.)

/** One segment of an envelope. The SEGMENTS ARE NAMED, NOT INDEXED, because a
 *  field that has no decay simply does not appear and the drawing has to hold
 *  either way. `delay` and `hold` are drawn where a field has them and are
 *  absent everywhere else — §11's "and a hold/delay where a field has one". */
export type Seg = "delay" | "attack" | "hold" | "decay" | "sustain" | "release";

export const SEGS: Seg[] = ["delay", "attack", "hold", "decay", "sustain", "release"];

/** THE LEVEL SEGMENTS. Everything else is a TIME. `sustain` is where the note
 *  rests, on the same axis the curve's height is drawn in; the rest are how
 *  long a stage takes. A drag moves a time segment sideways and a level
 *  segment up and down, and that is the only difference between them. */
export const ISLEVEL: Partial<Record<Seg, boolean>> = { sustain: true };

export interface EnvField {
  /** which stage this is. */
  seg: Seg;
  /** the address the gates and the page read — `data-k` on the handle. */
  k: string;
  /** the caller's own word for this field, kept for the caller's bookkeeping
   *  and NOT printed. The word beside the handle is the STAGE's, from the
   *  catalogue (`env.seg.attack` -> "Attack"): `knobs.js` calls sustain "where
   *  it rests" on a juno and "sustain" on the next instrument, and a handle
   *  whose name changes with the instrument under it reads as six controls
   *  rather than one. (TABLE.md §12b, the text pass.) */
  label: string;
  /** "s" · "ms" · "" (a level has none). Printed, never converted. */
  unit: string;
  min: number;
  max: number;
  step: number;
  /** what the record says today, or null when the chair inherits. */
  value: number | null;
  /** what stands when `value` is null — knobs.js `derived`, or the engine's
   *  own default for a sampled chair. Printed as the ghost curve. */
  derived: number;
  /** a refusal: drawn dim, with the sentence, and it cannot be dragged. The
   *  no-silent-grey law, which is not only about the engine. */
  why?: string | null;
}

/** THE ONE CURVE COMPONENT'S MODES (DESIGN.md component 9, 2026-09-05):
 *  *"Curve editor — one component, modes: ADSR · breakpoint lane · EQ bands ·
 *  XY pad: a plate (`--r0`), 44px handles clamped inside it, a real curve,
 *  values printed beside handles in their units, drag by thumb, keyboard on a
 *  focused handle, reset by long-press/clear-back."*
 *
 *  ONE COMPONENT AND NOT FOUR, because everything that is hard here is shared:
 *  the plate's arithmetic, the 44px handle clamped inside it, the thumb that
 *  must not steal the page's scroll, the keyboard, the long-press reset, the
 *  printed value. What differs is WHAT A HANDLE MEANS — a named stage of an
 *  envelope, an anonymous point on a lane, a shelf's corner, a pair of
 *  numbers — which is a switch inside one drawing, not a second widget.
 *
 *  ONLY `adsr` IS WIRED THIS ROUND (the chair sheets' envelopes). `lane` is
 *  built and gated on a fixture and waits for the automation round; `eq` and
 *  `xy` are DECLARED HERE AND NOT DRAWN, which is the honest half — a mode
 *  the component would answer to but that nothing asks for yet, named so the
 *  next round is a wiring rather than a second component. */
export type CurveMode = "adsr" | "lane" | "eq" | "xy";

export interface EnvSpec {
  /** which mode this plate is in; absent means `adsr`. */
  mode?: "adsr";
  /** the editor's own address; every handle is `<k>|<seg>`. */
  k: string;
  /** what this envelope is OF — "the amp", "the filter". NOT printed today:
   *  one plate is drawn per sheet and it is named `env.plate` ("Envelope"). A
   *  sheet that grows a second plate wants a key per plate, not a sentence
   *  from a caller. */
  label: string;
  fields: EnvField[];
  /** ONE WRITE PER GESTURE, through the caller's own door. A drag calls this
   *  once per settled value (never per pointermove frame — see plate.ts), and
   *  the caller is what lands it at the next bar. */
  set(seg: Seg, v: number): void;
  /** clear ONE segment back to what it inherits; with no segment, all of
   *  them. The long-press and the clear-back both arrive here. */
  clear(seg?: Seg): void;
}

/** THE OTHER MEMBER, AND THE ONE THE AUTOMATION LANES ARE WAITING FOR: n
 *  points over a span. Same plate, same 44px handles, same keyboard — an ADSR
 *  is a breakpoint curve whose points have names, which is why they share
 *  plate.ts and not just a stylesheet. */
export interface CurveSpec {
  /** `lane` today; `eq` and `xy` are the same drawing with named handles and
   *  are not drawn until something writes through them. */
  mode: "lane" | "eq" | "xy";
  k: string;
  label: string;
  /** what the horizontal axis counts: "bars" or "s". */
  xUnit: string;
  /** how far the plate reaches on that axis. */
  span: number;
  /** the vertical axis, in the field's own units. */
  lo: number;
  hi: number;
  yUnit: string;
  /** the breakpoints, in x order. The first and last are pinned to the ends of
   *  the span — a lane that started late would be a lane with an undrawn
   *  value before it. */
  points: { x: number; y: number }[];
  /** one write per settled gesture, with the whole list. */
  set(points: { x: number; y: number }[]): void;
  clear(): void;
  /** how many points a hand may add. */
  max?: number;
}

export interface Editor {
  /** the light-DOM node the caller seats. */
  node: HTMLElement;
  /** redraw against a new spec — the caller's document changed under it. */
  update(spec: EnvSpec | CurveSpec): void;
}
