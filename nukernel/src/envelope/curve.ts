// nukernel/src/envelope/curve.ts — THE BREAKPOINT CURVE: n points over a span.
//
// TABLE.md §11's second half of the same component: *"and a general breakpoint
// envelope for the modulation lanes"* / *"the section and cell automation lanes
// as breakpoint curves"*. It is here now, with the ADSR, because the two share
// the plate, the handle, the thumb and the keyboard (plate.ts) and differ only
// in what a point MEANS — an ADSR's points have names and one of them moves
// vertically; a lane's are anonymous and all of them move in both directions.
//
// NOT WIRED YET, AND THAT IS SAID RATHER THAN LEFT TO BE FOUND. §11's order
// puts the automation lanes after the EQ curve and the XY pad; this exports the
// editor and test/envelope.browser.js drives it on a fixture, so the round that
// wires it is a wiring and not a build. What it may NOT become is a declared
// control that never arrives — the memory note this repo keeps — so nothing on
// the page draws it until something writes through it.

import { html, render, svg } from "lit/html.js";
import type { TemplateResult } from "lit/html.js";
import type { CurveSpec, Editor } from "./api.js";
import { R, handle, keyStep, quantise, say } from "./plate.js";
import type { DragHost } from "./plate.js";
/* the catalogue, through the bundle's own door — see adsr.ts's note. */
import { t, tn, fmt } from "../copy/global.js";

const PLATE_H = 132;

export function breakpointEditor(host: HTMLElement, spec0: CurveSpec): Editor {
  let spec = spec0;
  const node = document.createElement("div");
  node.className = "nu-env nu-envcurvebox";
  host.append(node);

  /** the points being dragged, or the record's own. Same law as the ADSR: the
   *  drawing follows the thumb, the DOCUMENT is written when it lifts. */
  let LIVE: { x: number; y: number }[] | null = null;
  let GRAB: { x: number; y: number }[] | null = null;

  const pts = () => LIVE || spec.points;

  const plateWidth = (): number => {
    const el = node.querySelector(".nu-envplate") as HTMLElement | null;
    const w = el ? el.getBoundingClientRect().width : 0;
    return w > 40 ? w : 320;
  };

  /* THE X GRID IS THE SECTION'S METER, NOT A SIXTY-FOURTH OF THE SECTION
     (2026-09-05, TABLE.md §12c's second leftover). `spec.span / 64` made the
     quantum a function of HOW LONG THE SECTION IS, which is the one thing a
     musical grid must not depend on: measured on `reggae` seed 1, the same
     four-four record snapped to half a step in its 2-bar sections, a whole
     step in its 4-bar ones and two steps in its 8-bar ones — three different
     grids in one song — and on `nationalism` (six-eight, twelve steps a bar)
     it was 0.38, 0.75 and 0.94 of a step, which is no grid at all in any of
     its eight sections. `spec.grid` is the caller's own answer (`ui/eight.js`
     hands `1 / K.metOf(DOC.time).steps` — one step of the record's meter, in
     bars); the old number is kept as the fallback so a lane that names no
     grid, and every unit fixture that draws one, moves exactly as before. */
  const xGrid = (): number =>
    (typeof spec.grid === "number" && spec.grid > 0) ? spec.grid : spec.span / 64;

  /* ...AND THE SNAP IS ITS OWN, NOT `plate.ts quantise`. That one tidies to
     `ceil(-log10(step)) + 1` decimal places, which is enough for a field whose
     step is a round number and is NOT enough for a musical one: a sixteenth of
     a bar is 0.0625, `quantise` rounds to three places, and the point a hand
     dropped on bar 2.5625 was stored as 2.563 — off the grid it had just been
     snapped to, and off by a fifth of a step. A twelfth (six-eight) is worse.
     Six places holds every grid this box can draw and still refuses the
     0.43729183 a raw pixel gives. (The fallback path changes with it; nothing
     on the page takes it — every lane names its grid — so nothing moves.) */
  const snapX = (x: number): number =>
    Math.min(spec.span, Math.max(0, +(Math.round(x / xGrid()) * xGrid()).toFixed(6)));

  const geo = (w: number) => {
    const usable = Math.max(1, w - 2 * R);
    const top = R, bot = PLATE_H - R;   // see adsr.ts: a handle's centre is inset by R in BOTH axes
    const yspan = Math.max(1e-9, spec.hi - spec.lo);
    return {
      px: (x: number) => R + (Math.min(spec.span, Math.max(0, x)) / Math.max(1e-9, spec.span)) * usable,
      py: (y: number) => bot - ((Math.min(spec.hi, Math.max(spec.lo, y)) - spec.lo) / yspan) * (bot - top),
      vx: (dx: number) => (dx / usable) * spec.span,
      vy: (dy: number) => -(dy / (bot - top)) * yspan,
    };
  };

  const dragHost: DragHost = {
    plate: node,
    onMove(k, dx, dy) {
      const i = +(k.split("|").pop() as string);
      const base = GRAB || spec.points;
      const g = geo(plateWidth());
      const p = base[i]; if (!p) return;
      const next = base.map((q, j) => j === i
        ? { x: snapX(p.x + g.vx(dx)),
            y: quantise(p.y + g.vy(dy), spec.lo, spec.hi,
                        (spec.hi - spec.lo) / 100) }
        : { ...q });
      /* THE ENDS ARE PINNED IN X. A lane that started late would be a lane
         with an undrawn value before it, which is a curve that does not say
         what happens at bar one. Their HEIGHT still moves. */
      if (i === 0) next[0]!.x = 0;
      if (i === base.length - 1) next[i]!.x = spec.span;
      /* AND THE POINTS STAY IN ORDER, because a curve that crosses itself is
         two answers at one x. */
      next.sort((a, b) => a.x - b.x);
      LIVE = next;
      /* PATCH, DO NOT REBUILD — see adsr.ts's own paragraph: a render during a
         drag replaces the element holding the pointer capture and the
         `pointerup` that ends the gesture is lost with it. */
      paintLive();
    },
    onDrop() {
      const v = LIVE; LIVE = null; GRAB = null;
      if (v) spec.set(v);
      draw();
    },
    onHold() { LIVE = null; GRAB = null; spec.clear(); draw(); },
  };

  const view = (): TemplateResult => {
    const w = plateWidth();
    const g = geo(w);
    const P = pts();
    const d = P.map((p, i) => (i ? "L " : "M ") + g.px(p.x).toFixed(1) + " " +
                              g.py(p.y).toFixed(1)).join(" ");
    return html`
      <div class="nu-envplate" data-k=${spec.k}
           aria-label=${tn("env.lane", P.length,
                           { name: spec.label, span: fmt(spec.span, spec.xUnit) })}>
        <svg class="nu-envsvg" viewBox=${"0 0 " + w + " " + PLATE_H}
             width=${w} height=${PLATE_H} aria-hidden="true"
             preserveAspectRatio="none">
          ${svg`<line class="nu-envbase" x1="0" y1=${g.py(spec.lo)}
                      x2=${w} y2=${g.py(spec.lo)} />`}
          ${svg`<path class="nu-envcurve" d=${d} />`}
        </svg>
        ${P.map((p, i) => {
          const b = handle({
            k: spec.k + "|" + i, label: t("env.point", { n: i + 1 }),
            value: p.y, min: spec.lo, max: spec.hi,
            step: (spec.hi - spec.lo) / 100,
            say: t("env.pointAt", { value: say(p.y, spec.yUnit),
                                    at: say(p.x, spec.xUnit) }),
            axis: "xy", x: g.px(p.x), y: g.py(p.y) }, dragHost);
          b.addEventListener("keydown", (e: KeyboardEvent) => {
            const nv = keyStep(e, p.y, spec.lo, spec.hi,
                               (spec.hi - spec.lo) / 100, "y");
            if (nv == null) return;
            e.preventDefault(); e.stopPropagation();
            spec.set(P.map((q, j) => j === i ? { x: q.x, y: nv } : { ...q }));
            draw();
          });
          b.addEventListener("pointerdown", () => { GRAB = P.map((q) => ({ ...q })); });
          return b; })}
      </div>
      <div class="nu-envsays">
        <span class="nu-envsay"><b>${spec.label}</b>
          <span>${tn("env.points", P.length,
                     { span: fmt(spec.span, spec.xUnit) })}</span>
          <button type="button" class="nu-clearback" data-k=${"clear|" + spec.k}
            aria-label=${t("env.clearBack", { name: spec.label })}
            @click=${() => { spec.clear(); draw(); }}>${t("act.clear")}</button></span>
      </div>`;
  };

  const paintLive = (): void => {
    const g = geo(plateWidth());
    const P = pts();
    const d = P.map((q, i) => (i ? "L " : "M ") + g.px(q.x).toFixed(1) + " " +
                              g.py(q.y).toFixed(1)).join(" ");
    const path2 = node.querySelector(".nu-envcurve");
    if (path2) path2.setAttribute("d", d);
    const hs = Array.from(node.querySelectorAll<HTMLElement>(".nu-envh"));
    hs.forEach((el, i) => { const q = P[i]; if (!q) return;
      el.style.left = (g.px(q.x) - R) + "px";
      el.style.top = (g.py(q.y) - R) + "px";
      el.setAttribute("aria-valuenow", String(q.y));
      el.setAttribute("aria-valuetext",
        t("env.pointAt", { value: say(q.y, spec.yUnit),
                           at: say(q.x, spec.xUnit) })); });
  };

  const draw = () => { render(view(), node); };
  draw();
  requestAnimationFrame(() => { if (node.isConnected) draw(); });
  return { node, update(next) { spec = next as CurveSpec; LIVE = null; GRAB = null; draw(); } };
}
