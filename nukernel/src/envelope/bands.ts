// nukernel/src/envelope/bands.ts — THE EQ CURVE AND THE XY PAD.
//
// TABLE.md §11, the third item of the graphical family: *"the per-voice EQ
// (lo/mid/hi shelves, the desk's FAM_EQ and the seat eq) and the master tilt
// as an EQ CURVE with draggable bands; cutoff and resonance as an XY pad …
// Each replaces its number rows only where the drawing is the honest control
// (a shelf is a curve; a bar count is a number), and prints the numbers beside
// the curve."*  Paul, the sentence the family came from: *"Look for places
// where UX could help like eq editors too."*
//
// TWO DRAWINGS, ONE PLATE. Everything hard is `plate.ts`'s and is not written
// again here: the 44px handle clamped inside the plate in BOTH axes, the
// pointer capture that must not steal the page's scroll, the arrow keys and
// Home/End, the 600 ms long-press reset, the printed value. What is new is
// what a handle MEANS — a shelf's gain at a fixed frequency, or a pair of
// numbers a hand holds at once.
//
// ===== FIVE THINGS THIS FILE INHERITED AS LAW, NOT AS ADVICE ==============
// (§11b measured every one of them on the rendered page, in this component.)
//
//   1 · A HANDLE'S CENTRE LIVES IN [R, W-R] x [R, H-R]. The plate was inset by
//       0.6R vertically for one hour and the top handle sat 8.8px ABOVE its
//       own box; a 44px handle at an edge overhangs by 22 and the page scrolls
//       sideways. Both geometries below inset by R in both axes.
//   2 · A DRAG PATCHES, IT DOES NOT REBUILD. lit builds a NEW <button> per
//       handle on every render, so a `draw()` inside `onMove` destroys the
//       element holding the pointer capture and the `pointerup` that ends the
//       gesture — the ONE write in the whole drag — lands on nothing. The
//       frames of a drag write attributes; `draw()` is for the events that end
//       one.
//   3 · ONE WRITE PER GESTURE. Every write here is a document write that
//       normalises, recompiles and lands at the next bar. Sixty a second is a
//       denial of service, not an editor.
//   4 · THE PRESS READS THE SONG, NOT THE DOCUMENT. Nothing in this file may
//       be proven by assigning a value: a gate proves it by driving the HANDLE,
//       because `set` -> the caller's `changed()` -> `push()` is what makes a
//       document into the thing the engine renders.
//   5 · NO SILENT GREY. A refused band is drawn, dim, undraggable, wearing its
//       sentence — never absent.

import { html, render, svg, nothing } from "lit/html.js";
import type { TemplateResult } from "lit/html.js";
import type { EqSpec, EqBand, XySpec, XyAxis, Editor } from "./api.js";
import { R, handle, keyStep, quantise, say } from "./plate.js";
import type { DragHost } from "./plate.js";
/* the catalogue, through the bundle's own door — see adsr.ts's note: this is
   its own build entry and `../copy/index.js` would bundle a second copy of
   every string on the page into ui/envelope.js. */
import { t } from "../copy/global.js";

/* the same 132 the ADSR and the lane draw at — `--env-h` in nu.css, and one
   number, because the whole point of the family is that four plates on one
   page are one plate. */
const PLATE_H = 132;

/* ==================================================================
   THE FILTER'S OWN MAGNITUDE, AND IT IS THE FILTER'S OWN.

   `fields.js EQ_BANDS` carries `type` / `freq` / `q` and says in writing that
   the three go "straight onto the node, so a band added here is a knob, a
   field and a filter with no second table" — `graph.js` builds one
   BiquadFilterNode per entry from exactly those words. So the curve drawn
   below is not a picture OF a filter, it is the RBJ magnitude of the biquad
   the engine builds, evaluated at the plate's own frequencies. That is what
   "a real curve" means in DESIGN.md component 9, and it is why the EQ mode
   draws one and the XY mode (which is handed no filter law at all) does not.

   The cookbook, verbatim, at the WebAudio sample rate the renderers use.
   A shelf's shape parameter is S = 1, which is what a BiquadFilterNode does
   with `lowshelf`/`highshelf` (it ignores `Q` on both). */
const SR = 44100;

function biquad(kind: EqBand["type"], f0: number, gainDb: number, q: number):
    [number, number, number, number, number, number] {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * f0) / SR;
  const cw = Math.cos(w0), sw = Math.sin(w0);
  if (kind === "peaking") {
    const al = sw / (2 * Math.max(0.0001, q));
    return [1 + al * A, -2 * cw, 1 - al * A, 1 + al / A, -2 * cw, 1 - al / A];
  }
  const al = (sw / 2) * Math.SQRT2;              // S = 1
  const rt = 2 * Math.sqrt(A) * al;
  if (kind === "lowshelf") {
    return [A * ((A + 1) - (A - 1) * cw + rt),
            2 * A * ((A - 1) - (A + 1) * cw),
            A * ((A + 1) - (A - 1) * cw - rt),
            (A + 1) + (A - 1) * cw + rt,
            -2 * ((A - 1) + (A + 1) * cw),
            (A + 1) + (A - 1) * cw - rt];
  }
  return [A * ((A + 1) + (A - 1) * cw + rt),
          -2 * A * ((A - 1) + (A + 1) * cw),
          A * ((A + 1) + (A - 1) * cw - rt),
          (A + 1) - (A - 1) * cw + rt,
          2 * ((A - 1) - (A + 1) * cw),
          (A + 1) - (A - 1) * cw - rt];
}

/** |H(e^jw)| of one biquad, in dB, at frequency `f`. */
function bandDb(b: EqBand, gainDb: number, f: number): number {
  if (!gainDb) return 0;                          // flat costs nothing to draw
  const [b0, b1, b2, a0, a1, a2] = biquad(b.type, b.freq, gainDb, b.q || 1);
  const w = (2 * Math.PI * Math.min(f, SR / 2 - 1)) / SR;
  const c1 = Math.cos(w), s1 = Math.sin(w);
  const c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  const nr = b0 + b1 * c1 + b2 * c2, ni = -(b1 * s1 + b2 * s2);
  const dr = a0 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2);
  const den = dr * dr + di * di;
  if (!(den > 0)) return 0;
  return 10 * Math.log10((nr * nr + ni * ni) / den);
}

/* ==================================================================
   MODE `eq` — THE THREE SHELVES.
   ================================================================== */
export function eqEditor(host: HTMLElement, spec0: EqSpec): Editor {
  let spec = spec0;
  const node = document.createElement("div");
  node.className = "nu-env nu-eqbox";
  host.append(node);

  /* THE LIVE DRAG'S OWN VALUES — see law 3 above. While a thumb is down the
     picture is drawn from HERE and the record is left alone; `null` means
     nothing is being dragged and the record is the truth. */
  let LIVE: Record<string, number | undefined> = {};
  let GRAB: Record<string, number | undefined> = {};

  const byKey = (): Record<string, EqBand | undefined> => {
    const o: Record<string, EqBand | undefined> = {};
    for (const b of spec.bands) o[b.key] = b;
    return o;
  };
  const valOf = (b: EqBand): number =>
    LIVE[b.key] != null ? (LIVE[b.key] as number)
      : (b.value != null ? b.value : b.derived);

  const plateWidth = (): number => {
    const el = node.querySelector(".nu-envplate") as HTMLElement | null;
    const w = el ? el.getBoundingClientRect().width : 0;
    /* A PLATE THAT HAS NOT BEEN LAID OUT YET STILL DRAWS — a strip is built
       before it is in the document, and a plate measured at zero would stack
       every band at one x. 320 is the phone's own width less its gutters. */
    return w > 40 ? w : 320;
  };

  /** THE PLATE'S ARITHMETIC. x is LOG frequency, because an ear puts 1 kHz in
   *  the middle of 40..18000 and a linear ruling puts it at 5%. y is the gain
   *  bracket the CALLER read off the control this replaces. */
  const geometry = (w: number) => {
    const usable = Math.max(1, w - 2 * R);
    const top = R, bot = PLATE_H - R;                       // law 1
    const l0 = Math.log(Math.max(1, spec.fLo)), l1 = Math.log(Math.max(2, spec.fHi));
    const span = Math.max(1e-9, spec.hi - spec.lo);
    return {
      top, bot, usable,
      px: (f: number) => R + ((Math.log(Math.min(spec.fHi, Math.max(spec.fLo, f))) - l0) /
                              Math.max(1e-9, l1 - l0)) * usable,
      fx: (px: number) => Math.exp(l0 + ((px - R) / usable) * (l1 - l0)),
      py: (db: number) => bot - ((Math.min(spec.hi, Math.max(spec.lo, db)) - spec.lo) /
                                 span) * (bot - top),
      vy: (dy: number) => -(dy / (bot - top)) * span,
    };
  };
  type G = ReturnType<typeof geometry>;

  /** THE CURVE: the SUM of the three biquads' magnitudes, sampled across the
   *  plate. Every 3px, which at 1280 is 420 samples and at 320 is 100 — enough
   *  that a 0.9-Q bell reads as a bell and few enough that a drag frame is one
   *  path attribute rather than a layout. */
  const path = (g: G, w: number, read: (b: EqBand) => number): string => {
    const p: string[] = [];
    for (let x = R; x <= w - R + 0.01; x += 3) {
      const f = g.fx(x);
      let db = 0;
      for (const b of spec.bands) db += bandDb(b, read(b), f);
      p.push((p.length ? "L " : "M ") + x.toFixed(1) + " " + g.py(db).toFixed(1));
    }
    return p.join(" ");
  };

  const dragHost: DragHost = {
    plate: node,
    onMove(k, _dx, dy) {
      const b = spec.bands.find((x) => x.k === k);
      if (!b) return;
      const g = geometry(plateWidth());
      const base = GRAB[b.key] != null ? (GRAB[b.key] as number)
        : (b.value != null ? b.value : b.derived);
      LIVE[b.key] = quantise(base + g.vy(dy), spec.lo, spec.hi, spec.step);
      paintLive();                                          // law 2
    },
    onDrop(k) {
      const b = spec.bands.find((x) => x.k === k);
      const v = b ? LIVE[b.key] : undefined;
      LIVE = {}; GRAB = {};
      if (!b || v == null) { draw(); return; }
      spec.set(b.key, v);                                   // law 3: one write
      draw();
    },
    onHold(k) {
      const b = spec.bands.find((x) => x.k === k);
      LIVE = {}; GRAB = {};
      if (b) spec.clear(b.key);
      draw();
    },
  };

  const view = (): TemplateResult => {
    const w = plateWidth();
    const g = geometry(w);
    /* THE GHOST IS WHAT THE CHANNEL INHERITS — §2's dim-is-derived law in a
       curve, drawn only where a hand has written something. */
    const anySet = spec.bands.some((b) => b.value != null);
    return html`
      <div class="nu-envplate nu-eqplate" data-k=${spec.k} aria-label=${spec.label}>
        <svg class="nu-envsvg" viewBox=${"0 0 " + w + " " + PLATE_H}
             width=${w} height=${PLATE_H} aria-hidden="true"
             preserveAspectRatio="none">
          ${svg`<line class="nu-envbase" x1="0" y1=${g.py(0)} x2=${w} y2=${g.py(0)} />`}
          ${spec.bands.map((b) => svg`<line class="nu-eqrule"
              x1=${g.px(b.freq)} y1=${g.top} x2=${g.px(b.freq)} y2=${g.bot} />`)}
          ${anySet ? svg`<path class="nu-envghost"
              d=${path(g, w, (b) => b.derived)} />` : nothing}
          ${svg`<path class="nu-envcurve" d=${path(g, w, valOf)} />`}
        </svg>
        ${spec.bands.map((b) => {
          const v = valOf(b);
          const el = handle({
            k: b.k, label: b.label, value: v,
            min: spec.lo, max: spec.hi, step: spec.step,
            say: say(v, spec.unit), axis: "y",
            x: g.px(b.freq), y: g.py(v), why: b.why || null }, dragHost);
          el.addEventListener("keydown", (e: KeyboardEvent) => {
            const nv = keyStep(e, valOf(b), spec.lo, spec.hi, spec.step, "y");
            if (nv == null) {
              /* BACKSPACE AND DELETE ARE THE CLEAR-BACK ON THE KEYBOARD — the
                 same gesture the grid uses for "back to what it inherits". */
              if (e.key === "Backspace" || e.key === "Delete") {
                e.preventDefault(); e.stopPropagation();
                spec.clear(b.key); draw(); }
              return;
            }
            e.preventDefault();
            /* AND IT DOES NOT REACH THE SHEET AROUND IT: this plate lives in a
               strip inside a table cell whose own arrows move the SELECTION. */
            e.stopPropagation();
            spec.set(b.key, nv);
            draw();
          });
          el.addEventListener("pointerdown", () => { GRAB[b.key] = valOf(b); });
          return el; })}
      </div>
      ${says()}`;
  };

  /* THE NUMBERS, BESIDE THE CURVE AND IN THE FIELD'S OWN UNIT — the half of
     §11's ruling that makes removing the three knob columns a MOVE and not a
     loss. Bold is a value a hand set; quiet is what the channel inherits.

     AND THE CLEAR-BACK IS ALWAYS DRAWN HERE, unlike the ADSR's, which appears
     only on a written field. Two reasons, and the second is measured. DESIGN.md
     §2 component 4 lists a clear-back as part of a row rather than as a state
     of one; and a channel strip's control VOCABULARY may not depend on what a
     genre happened to deal — nukernel/desk-gate.js's own claim is that "all N
     voices' `mix` marks open a strip carrying the same controls, differing
     only in the voice's own name", and on the shipped chant `precompose
     deskThe` deals `eq.lo` to one voice and not to the next. A button that
     comes and goes with the record would make one strip a different strip. */
  const says = (): TemplateResult => html`
      <div class="nu-envsays">
        ${spec.bands.map((b) => {
          const set = b.value != null;
          return html`<span class=${"nu-envsay" + (set ? " is-said" : "")}
            data-k=${"envsay|" + b.k}
            ><b>${b.label}</b> <span>${say(valOf(b), spec.unit)}</span>
            <button type="button" class="nu-clearback"
              data-k=${"clear|" + b.k}
              aria-label=${t("env.clearBack", { name: b.label })}
              @click=${() => { spec.clear(b.key); draw(); }}>${t("act.clear")}</button
            ></span>`; })}
      </div>`;

  /* THE LIVE FRAME: the same arithmetic `view()` uses, written onto the nodes
     already on the page. Nothing here creates or removes an element (law 2). */
  const paintLive = (): void => {
    const w = plateWidth();
    const g = geometry(w);
    const B = byKey();
    const p = node.querySelector(".nu-envcurve");
    if (p) p.setAttribute("d", path(g, w, valOf));
    for (const el of Array.from(node.querySelectorAll<HTMLElement>(".nu-envh"))) {
      const b = spec.bands.find((x) => x.k === el.dataset.k);
      if (!b) continue;
      const v = valOf(b);
      el.style.left = (g.px(b.freq) - R) + "px";
      el.style.top = (g.py(v) - R) + "px";
      el.setAttribute("aria-valuenow", String(v));
      el.setAttribute("aria-valuetext", say(v, spec.unit));
    }
    for (const el of Array.from(node.querySelectorAll<HTMLElement>(".nu-envsay"))) {
      const key = (el.dataset.k || "").replace(/^envsay\|/, "");
      const b = spec.bands.find((x) => x.k === key) || B[key];
      if (!b) continue;
      const out = el.querySelector("span");
      if (out) out.textContent = say(valOf(b), spec.unit);
    }
  };

  const draw = () => { render(view(), node); };
  draw();
  /* AND ONCE MORE WHEN THE BOX HAS A WIDTH — see `plateWidth`. One frame, no
     clock. */
  requestAnimationFrame(() => { if (node.isConnected) draw(); });
  return { node, update(next) { spec = next as EqSpec; LIVE = {}; GRAB = {}; draw(); } };
}

/* ==================================================================
   MODE `xy` — CUTOFF ACROSS, RESONANCE UP.
   ================================================================== */
export function xyEditor(host: HTMLElement, spec0: XySpec): Editor {
  let spec = spec0;
  const node = document.createElement("div");
  node.className = "nu-env nu-xybox";
  host.append(node);

  let LIVE: { x?: number; y?: number } = {};
  let GRAB: { x?: number; y?: number } = {};

  const axis = (a: "x" | "y"): XyAxis => (a === "x" ? spec.x : spec.y);
  const valOf = (a: "x" | "y"): number => {
    const A = axis(a);
    return LIVE[a] != null ? (LIVE[a] as number)
      : (A.value != null ? A.value : A.derived);
  };

  const plateWidth = (): number => {
    const el = node.querySelector(".nu-envplate") as HTMLElement | null;
    const w = el ? el.getBoundingClientRect().width : 0;
    return w > 40 ? w : 320;
  };

  /** ONE AXIS'S ARITHMETIC, LINEAR OR LOG. A cutoff is heard in octaves, so a
   *  frequency axis is ruled and dragged logarithmically; a bare 0..1 dial is
   *  not, and says so on its own row rather than here. */
  const scale = (A: XyAxis, px0: number, px1: number) => {
    const lg = !!A.log && A.min > 0;
    const f = (v: number) => (lg ? Math.log(Math.max(A.min, v)) : v);
    const lo = f(A.min), hi = f(A.max);
    const sp = Math.max(1e-9, hi - lo);
    /* THE REACH IS SIGNED, AND THAT IS THE WHOLE OF THE Y AXIS'S INVERSION.
       `Y` is built with px0 at the plate's FLOOR and px1 at its ceiling, so
       this is negative and every conversion below flips with it — one place,
       rather than a minus sign at four call sites. It cost a measurement to
       learn: written as `Math.max(1, px1 - px0)` the y reach clamped to 1,
       which made a drag 88x too fast AND upside down, and ten Shift-ArrowUps
       on the resonance handle wrote 0.15 -> 0 instead of 0.15 -> 0.24. */
    const rng = (px1 - px0) || 1;
    const clamp = (v: number) => Math.min(A.max, Math.max(A.min, v));
    return {
      to: (v: number) => px0 + ((f(clamp(v)) - lo) / sp) * rng,
      from: (px: number) => { const u = lo + ((px - px0) / rng) * sp;
                              return lg ? Math.exp(u) : u; },
      /** how far `d` pixels moves this axis, from a value it started at. */
      by: (v0: number, d: number) => {
        const u = f(clamp(v0)) + (d / rng) * sp;
        return lg ? Math.exp(u) : u;
      },
    };
  };

  const geometry = (w: number) => {
    const left = R, right = w - R, top = R, bot = PLATE_H - R;   // law 1
    return { left, right, top, bot,
             X: scale(spec.x, left, right),
             /* UP IS MORE, so the y scale runs from the plate's floor to its
                ceiling and the pixel axis is inverted here rather than at four
                call sites. */
             Y: scale(spec.y, bot, top) };
  };
  type G = ReturnType<typeof geometry>;

  /** THE RULING, AND IT IS A REAL ONE: a hairline at every decade the axis
   *  actually spans (100 Hz, 1 kHz, 10 kHz on a 60..16000 cutoff), so the
   *  handle's position is readable as a frequency and not only as a fraction
   *  of a box. Nothing decorative is drawn: a line here is a number. */
  const decades = (g: G): number[] => {
    if (!spec.x.log) return [];
    const out: number[] = [];
    for (let d = 1; d <= 100000; d *= 10)
      if (d > spec.x.min && d < spec.x.max) out.push(d);
    return out.map((d) => g.X.to(d));
  };

  const dragHost: DragHost = {
    plate: node,
    onMove(_k, dx, dy) {
      const g = geometry(plateWidth());
      const bx = GRAB.x != null ? GRAB.x : valOf("x");
      const by = GRAB.y != null ? GRAB.y : valOf("y");
      if (!spec.x.why)
        LIVE.x = quantise(g.X.by(bx, dx), spec.x.min, spec.x.max, spec.x.step);
      if (!spec.y.why)
        LIVE.y = quantise(g.Y.by(by, dy), spec.y.min, spec.y.max, spec.y.step);
      paintLive();                                          // law 2
    },
    onDrop() {
      const v = LIVE; LIVE = {}; GRAB = {};
      /* TWO FIELDS, TWO WRITES, ONE GESTURE. A pad moves two numbers and the
         caller owns two addresses; `set` is called once per axis that moved,
         never once per frame. */
      if (v.x != null) spec.set("x", v.x);
      if (v.y != null) spec.set("y", v.y);
      draw();
    },
    onHold() { LIVE = {}; GRAB = {}; spec.clear(); draw(); },
  };

  const view = (): TemplateResult => {
    const w = plateWidth();
    const g = geometry(w);
    const xv = valOf("x"), yv = valOf("y");
    const hx = g.X.to(xv), hy = g.Y.to(yv);
    const why = spec.x.why || spec.y.why || null;
    return html`
      <div class="nu-envplate nu-xyplate" data-k=${spec.k} aria-label=${spec.label}>
        <svg class="nu-envsvg" viewBox=${"0 0 " + w + " " + PLATE_H}
             width=${w} height=${PLATE_H} aria-hidden="true"
             preserveAspectRatio="none">
          ${decades(g).map((x) => svg`<line class="nu-eqrule" x1=${x} y1=${g.top}
                                            x2=${x} y2=${g.bot} />`)}
          ${svg`<line class="nu-envbase" x1="0" y1=${g.bot} x2=${w} y2=${g.bot} />`}
          ${svg`<line class="nu-xycross" x1=${hx} y1=${g.top} x2=${hx} y2=${g.bot} />`}
          ${svg`<line class="nu-xycross" x1=${g.left} y1=${hy} x2=${g.right} y2=${hy} />`}
        </svg>
        ${(() => {
          const el = handle({
            k: spec.k, label: spec.label, value: xv,
            min: spec.x.min, max: spec.x.max, step: spec.x.step,
            /* THE HANDLE IS A POINT AT TWO NUMBERS, which is the string the
               lane already has for exactly this shape. */
            say: t("env.pointAt", { value: say(xv, spec.x.unit),
                                    at: say(yv, spec.y.unit) }),
            axis: "xy", x: hx, y: hy, why }, dragHost);
          el.addEventListener("keydown", (e: KeyboardEvent) => {
            /* THE KEYBOARD IS TWO AXES ON ONE HANDLE, said explicitly rather
               than through `keyStep`'s "xy": left and right are the cutoff, up
               and down are the resonance, and Home/End are the ends of the
               axis a hand thinks of as the pad's — the cutoff.

               AND A PRESS MOVES THE HANDLE 1% OF THE PLATE, IN THE SAME SPACE
               THE DRAG MOVES IT — not one of the field's own steps. Measured
               on the fleet: `res` is a 0.001-step control over 0..0.95, so a
               field-step arrow key is 950 presses from end to end and a
               control that only a pointer can really reach is a refused
               control (§6 ¶A). One percent of the plate is 100 presses across,
               10 with Shift, which is what a browser's own range input does;
               and because it is measured in PIXELS it is LOGARITHMIC on a
               frequency axis, where a linear 1% would be three octaves at the
               bottom of a 60..12000 sweep and a rounding error at the top.
               The VALUE is still quantised to the field's own step, so nothing
               is written off the grid the record stores. */
            const horiz = e.key === "ArrowLeft" || e.key === "ArrowRight" ||
                          e.key === "Home" || e.key === "End";
            const vert = e.key === "ArrowUp" || e.key === "ArrowDown";
            if (horiz || vert) {
              const a: "x" | "y" = horiz ? "x" : "y";
              const A = axis(a);
              if (A.why) return;
              const g = geometry(plateWidth());
              const now = valOf(a);
              const big = e.shiftKey ? 10 : 1;
              let nv: number;
              if (e.key === "Home") nv = A.min;
              else if (e.key === "End") nv = A.max;
              else {
                /* the Y scale runs bot -> top, so a NEGATIVE pixel delta is UP
                   and is MORE — the inversion lives in the scale, once. */
                const reach = horiz ? (g.right - g.left) : (g.top - g.bot);
                const dir = (e.key === "ArrowRight" || e.key === "ArrowUp") ? 1 : -1;
                const d = dir * (reach / 100) * big;
                nv = quantise((horiz ? g.X : g.Y).by(now, d), A.min, A.max, A.step);
                /* AND AN ARROW ALWAYS MOVES. At the bottom of a log axis 1% of
                   the plate is smaller than the field's own step (3.6 Hz on a
                   10 Hz grid at 60 Hz), and quantising would land back where it
                   started — a key that does nothing reads as a dead control. */
                if (nv === now) nv = quantise(now + dir * A.step * big,
                                              A.min, A.max, A.step);
              }
              if (nv === now) return;
              e.preventDefault();
              /* AND IT DOES NOT REACH THE SHEET AROUND IT — this pad lives in a
                 chair's sheet inside a table cell whose own arrows move the
                 SELECTION. */
              e.stopPropagation();
              spec.set(a, nv); draw();
              return;
            }
            if (e.key === "Backspace" || e.key === "Delete") {
              e.preventDefault(); e.stopPropagation(); spec.clear(); draw(); }
          });
          el.addEventListener("pointerdown", () => {
            GRAB = { x: valOf("x"), y: valOf("y") }; });
          return el; })()}
      </div>
      <div class="nu-envsays">
        ${(["x", "y"] as ("x" | "y")[]).map((a) => {
          const A = axis(a);
          const set = A.value != null;
          /* THE CLEAR-BACK IS ALWAYS DRAWN, for the reason the EQ's `says`
             sets out one screen up: a control's vocabulary is the control's,
             not the record's. */
          return html`<span class=${"nu-envsay" + (set ? " is-said" : "")}
            data-k=${"envsay|" + A.k}
            ><b>${A.label}</b> <span>${say(valOf(a), A.unit)}</span>
            <button type="button" class="nu-clearback"
              data-k=${"clear|" + A.k}
              aria-label=${t("env.clearBack", { name: A.label })}
              @click=${() => { spec.clear(a); draw(); }}>${t("act.clear")}</button
            >${A.why ? html`<small class="nu-why">${A.why}</small>` : nothing}</span>`; })}
      </div>`;
  };

  const paintLive = (): void => {
    const w = plateWidth();
    const g = geometry(w);
    const xv = valOf("x"), yv = valOf("y");
    const hx = g.X.to(xv), hy = g.Y.to(yv);
    const cross = Array.from(node.querySelectorAll<SVGLineElement>(".nu-xycross"));
    if (cross[0]) { cross[0].setAttribute("x1", String(hx));
                    cross[0].setAttribute("x2", String(hx)); }
    if (cross[1]) { cross[1].setAttribute("y1", String(hy));
                    cross[1].setAttribute("y2", String(hy)); }
    const el = node.querySelector<HTMLElement>(".nu-envh");
    if (el) {
      el.style.left = (hx - R) + "px";
      el.style.top = (hy - R) + "px";
      el.setAttribute("aria-valuenow", String(xv));
      el.setAttribute("aria-valuetext",
        t("env.pointAt", { value: say(xv, spec.x.unit),
                           at: say(yv, spec.y.unit) }));
    }
    for (const s of Array.from(node.querySelectorAll<HTMLElement>(".nu-envsay"))) {
      const key = (s.dataset.k || "").replace(/^envsay\|/, "");
      const a: "x" | "y" | null = key === spec.x.k ? "x"
        : key === spec.y.k ? "y" : null;
      if (!a) continue;
      const out = s.querySelector("span");
      if (out) out.textContent = say(valOf(a), axis(a).unit);
    }
  };

  const draw = () => { render(view(), node); };
  draw();
  requestAnimationFrame(() => { if (node.isConnected) draw(); });
  return { node, update(next) { spec = next as XySpec; LIVE = {}; GRAB = {}; draw(); } };
}
