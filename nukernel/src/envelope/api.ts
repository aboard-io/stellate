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
 *  ALL FOUR ARE DRAWN NOW (2026-09-05, TABLE.md §11's third item — *"the
 *  per-voice EQ (lo/mid/hi shelves, the desk's FAM_EQ and the seat eq) and the
 *  master tilt as an EQ CURVE with draggable bands; cutoff and resonance as an
 *  XY pad"*). `adsr` took the chair sheets' envelopes; `lane` took the cell
 *  and section automation; `eq` is `ui/engineer.js`'s channel strip, and `xy`
 *  is the modelled chair's tone in `ui/eight.js knobsBlock`. The paragraph
 *  this replaces said `eq` and `xy` were "DECLARED HERE AND NOT DRAWN, which
 *  is the honest half … named so the next round is a wiring rather than a
 *  second component"; it was, and this is it. */
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
  /** the anonymous-points drawing. `eq` and `xy` have their own specs below —
   *  they share this plate but not this shape: a band is NAMED and pinned in
   *  x, and an XY pad's two axes carry two different units. */
  mode: "lane";
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

/* ===================================================================
   THE EQ CURVE (mode `eq`) — A SHELF IS A CURVE.

   TABLE.md §11's own test for this family: *"Each replaces its number rows
   only where the drawing is the honest control (a shelf is a curve; a bar
   count is a number), and prints the numbers beside the curve."* An EQ is the
   clearest case on the page: three gains in three columns are three unrelated
   facts, and the same three as a response curve are the one thing a hand is
   actually deciding — where this instrument sits against the others.

   THE BANDS ARE NOT POINTS. A band is pinned in x (its frequency is the
   desk's, silkscreened once in `fields.js EQ_BANDS`) and moves only in gain,
   so it is a NAMED handle on a fixed abscissa — which is why this is its own
   spec rather than a `CurveSpec` with three points in it. A point a hand could
   drag sideways would be a parametric EQ, and this desk does not have one.

   AND THE ADDRESS DOES NOT MOVE. Each band carries its own `k` — the caller's
   existing `data-k`, `b|eqlo|<voice>` and its two siblings — rather than one
   built here from the plate's key, because this repo's standing law is that an
   address does not move when a widget does and `nukernel/desk-gate.js` drives
   the desk by name. */
export interface EqBand {
  /** the caller's own word for this band, handed back to `set`/`clear`. */
  key: string;
  /** THE ADDRESS, the caller's and unmoved — `data-k` on the handle. */
  k: string;
  /** what the band is called, printed and spoken ("lo", "mid", "hi"). */
  label: string;
  /** where it sits on the frequency axis, in Hz. `fields.js EQ_BANDS.freq`. */
  freq: number;
  /** what the engine builds there — the same three words `graph.js` puts on a
   *  BiquadFilterNode, so the drawn curve is the built filter's own magnitude
   *  and not a picture of one. */
  type: "lowshelf" | "peaking" | "highshelf";
  /** the bell's own Q where it has one (a shelf's is fixed at S = 1). */
  q?: number;
  /** what the record says today, or null where the channel inherits flat. */
  value: number | null;
  /** what stands when `value` is null — 0 dB on a desk whose absent IS flat. */
  derived: number;
  /** a refusal: drawn dim, with the sentence, and undraggable. */
  why?: string | null;
}

export interface EqSpec {
  mode: "eq";
  /** the editor's own address; the plate wears it. */
  k: string;
  /** what this EQ is OF, spoken as the plate's name. The caller's, translated
   *  by the caller — this module holds no English. */
  label: string;
  /** the GAIN bracket, read off the control this replaces and never invented
   *  here (the seat eq is `fields.js EQ_RANGE`, ±12 dB at 0.5). */
  lo: number;
  hi: number;
  step: number;
  /** printed after every gain. "dB" everywhere today. */
  unit: string;
  /** the drawn frequency span, log-scaled. */
  fLo: number;
  fHi: number;
  bands: EqBand[];
  /** ONE WRITE PER GESTURE, through the caller's own door. */
  set(key: string, v: number): void;
  /** clear ONE band back to what it inherits; with no key, all of them. */
  clear(key?: string): void;
}

/* ===================================================================
   THE XY PAD (mode `xy`) — TWO NUMBERS A HAND HOLDS AT ONCE.

   §11: *"cutoff and resonance as an XY pad"*. The two are one gesture on every
   desk that has ever had them, and they are two rows of a table here. Same
   plate, same 44px handle, same keyboard, same long-press: what differs is
   that the handle's TWO coordinates are two different fields with two
   different units, and both numbers print beside it.

   THERE IS NO RESPONSE CURVE ON THIS PLATE, AND THAT IS DELIBERATE. The EQ
   above draws a real one because the desk hands us the filter it builds — type,
   frequency and Q, straight onto a BiquadFilterNode. Nothing hands this page
   the chair's own filter law: `nukernel/knobs.js` is a MEASUREMENT that `res`
   moves a parameter called `res` between 0 and 0.95, not a Q. A curve drawn
   from a Q invented here would be a picture of physics nobody measured, which
   is the exact shape of the bug this family exists to refuse. So the pad draws
   what it can stand behind: a real log-frequency ruling, the two crosshairs
   through the handle, and the two numbers. */
export interface XyAxis {
  /** THE ADDRESS, the caller's — `data-k` on the crosshair's own readout. */
  k: string;
  /** what this axis is called, printed and spoken. */
  label: string;
  /** "Hz" · "" (a bare 0..1 dial has none). Printed, never converted. */
  unit: string;
  min: number;
  max: number;
  step: number;
  /** what the record says today, or null when the chair inherits. */
  value: number | null;
  /** what stands when `value` is null. */
  derived: number;
  /** a frequency-like axis is ruled and dragged LOGARITHMICALLY: 2 kHz sits in
   *  the middle of 60..16000 the way an ear puts it there, not at 12%. */
  log?: boolean;
  why?: string | null;
}

export interface XySpec {
  mode: "xy";
  k: string;
  label: string;
  /** across — cutoff. */
  x: XyAxis;
  /** up — resonance. */
  y: XyAxis;
  set(axis: "x" | "y", v: number): void;
  clear(axis?: "x" | "y"): void;
}

/** WHAT THE ONE DOOR ANSWERS TO. Four modes, one function (`editor.ts`). */
export type AnySpec = EnvSpec | CurveSpec | EqSpec | XySpec;

export interface Editor {
  /** the light-DOM node the caller seats. */
  node: HTMLElement;
  /** redraw against a new spec — the caller's document changed under it. */
  update(spec: AnySpec): void;
}
