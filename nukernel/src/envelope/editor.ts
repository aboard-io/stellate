// nukernel/src/envelope/editor.ts — THE ONE CURVE EDITOR, IN FOUR MODES.
//
// DESIGN.md component 9 (2026-09-05): *"Curve editor — one component, modes:
// ADSR · breakpoint lane · EQ bands · XY pad: a plate (`--r0`), 44px handles
// clamped inside it, a real curve, values printed beside handles in their
// units, drag by thumb, keyboard on a focused handle, reset by
// long-press/clear-back."*
//
// This file is the DOOR that makes that one sentence true from the caller's
// side: one function, one spec, a mode on it. The two drawings behind it —
// `adsr.ts` (named stages, one of them a level) and `curve.ts` (n anonymous
// points over a span) — share `plate.ts`, which is where everything that is
// actually hard lives: the plate's arithmetic, the 44px handle clamped inside
// it, the pointer capture that must not steal the page's scroll, the keyboard,
// the long-press reset, the printed value.
//
// WHY THE SPLIT IS UNDER THE DOOR AND NOT AT IT. A mode is a switch about what
// a HANDLE MEANS, and the two answers are genuinely different arithmetic: an
// ADSR's x-axis is a sum of durations that the handles themselves change, so
// the span is recomputed on every frame; a lane's span is given. Putting both
// in one 400-line function would be a switch on every line rather than one at
// the top. The caller sees one component; the file tree sees the two shapes
// the drawing actually takes.

import type { EnvSpec, CurveSpec, Editor } from "./api.js";
import { adsrEditor as adsrPlate } from "./adsr.js";
import { breakpointEditor as curvePlate } from "./curve.js";

/** ONE COMPONENT. `mode` absent is `adsr`, which is what every caller on the
 *  page asks for today. */
export function curveEditor(host: HTMLElement,
                            spec: EnvSpec | CurveSpec): Editor {
  const mode: string = (spec as { mode?: string }).mode || "adsr";
  if (mode === "adsr") return adsrPlate(host, spec as EnvSpec);
  /* `lane` is drawn; `eq` and `xy` are the same drawing with named handles and
     their own units, and they take this branch the day something writes
     through them. Until then they draw a lane rather than throwing, because a
     mode that exists and refuses is worse than a mode that draws honestly. */
  return curvePlate(host, spec as CurveSpec);
}

/* THE TWO NAMES THE PAGE ALREADY CALLS, kept as one line each so a caller
   reads at its own call site which mode it is asking for. Neither is a second
   component: both are `curveEditor` with the mode filled in. */
export const adsrEditor = (host: HTMLElement, spec: EnvSpec): Editor =>
  curveEditor(host, { ...spec, mode: "adsr" } as EnvSpec);
export const breakpointEditor = (host: HTMLElement, spec: CurveSpec): Editor =>
  curveEditor(host, { ...spec, mode: spec.mode || "lane" });
