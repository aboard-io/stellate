// nukernel/src/envelope/index.ts — THE ENTRY, AND THE WHOLE PUBLIC SURFACE.
//
// `node tools/ui/build.js` bundles this file (and everything it imports, Lit
// included) into the committed `nukernel/ui/envelope.js`, which ui/eight.js
// imports as a plain module:
//
//     import { curveEditor } from "./envelope.js";
//
// ONE OWNER FOR EVERY ENVELOPE ON THE PAGE (TABLE.md §11): the chair sheets'
// attack/decay/sustain/release, the SAMPLED chairs' per-note envelope, the
// synth blocks' `fenv`, and the section and cell automation lanes as
// breakpoint curves. A second envelope widget anywhere on this page is a bug.

export { curveEditor, adsrEditor, breakpointEditor, eqCurve, xyPad } from "./editor.js";
export { SEGS, ISLEVEL } from "./api.js";
export type { EnvSpec, EnvField, CurveSpec, CurveMode, Editor, Seg,
              EqSpec, EqBand, XySpec, XyAxis, AnySpec } from "./api.js";
