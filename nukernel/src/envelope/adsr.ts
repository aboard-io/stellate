// nukernel/src/envelope/adsr.ts — THE ADSR EDITOR: a plate, a real curve, and
// four handles a thumb can move.
//
// TABLE.md §11: *"a Lit component drawing an ADSR (and a general breakpoint
// envelope for the modulation lanes) as a plate with 44px handles, a real curve
// between them, drag by thumb (`touch-action: none`), arrows and Home/End on a
// focused handle, a long-press or a clear-back for reset, the values printed
// beside the handles in the field's own units."*
//
// ===== WHY THIS IS DRAWN AND NOT TYPED =================================
// An envelope is a SHAPE. Four numbers in four rows of a table are four
// unrelated facts; the same four as a curve are one gesture, and the thing you
// are actually deciding — how this note starts and how it lets go — is visible
// in it. That is §11's whole test for the graphical family: *"Each replaces
// its number rows only where the drawing is the honest control (a shelf is a
// curve; a bar count is a number), and prints the numbers beside the curve."*
// The numbers ARE printed, beside their own handles, in the field's own units,
// so nothing is lost by the rows going.
//
// ===== LIGHT DOM, AND IT IS NOT A PREFERENCE ==========================
// §9b: every gate on this page queries from the document root through
// `#pan-band`, so a shadow root would make this component invisible to all of
// them. `render()` from lit-html into a plain `<div>` the caller seats, the
// same shape src/table/grid.ts uses.

import { html, render, svg, nothing } from "lit/html.js";
import type { TemplateResult } from "lit/html.js";
import type { EnvSpec, EnvField, Seg, Editor } from "./api.js";
import { ISLEVEL } from "./api.js";
import { R, handle, keyStep, quantise, say, sayLine, scaleOf, unsay } from "./plate.js";
import type { DragHost } from "./plate.js";
/* THE WORDS ARE THE CATALOGUE'S (TABLE.md §12b). `../copy/global.js`, never
   `../copy/index.js`: this is its own build entry, and importing the catalogue
   would bundle a second copy of every string on the page into ui/envelope.js. */
import { t } from "../copy/global.js";

/** THE STAGE'S OWN WORD, and it is this component's rather than the caller's.
 *  A field's `label` is whatever knobs.js calls it — "where it rests" on a
 *  juno, "sustain" on the next instrument — so a handle drawn from it changes
 *  its name with the instrument under it. The stage is the same stage either
 *  way, and the catalogue names it once. */
const segWord = (s: Seg): string => t("env.seg." + s);

/* THE PLATE'S SIZE. 100% of its row, and a height that is two `--tap`s plus the
   line of numbers under it — tall enough that the curve is a shape and not a
   line, short enough that four of them do not push the sheet off a phone. The
   WIDTH is measured off the rendered box, never assumed, because this lives
   inside a table cell whose column a hand can drag. */
const PLATE_H = 132;

/* WHAT THE CURVE IS DRAWN AGAINST. An envelope's total time is
   attack + decay + a plateau + release, and the plateau has no number — it is
   however long the note is. So the horizontal axis is the envelope's own
   times with ONE plateau's worth of room in the middle, which keeps the
   attack readable on a 4 ms staccato and on a 1.2 s swell without a hand
   having to set a zoom. Recomputed on every draw, which is what makes the
   curve answer a drag rather than merely record it. */
function times(f: Record<string, EnvField | undefined>) {
  const at = (s: Seg) => { const x = f[s]; if (!x) return null;
    return x.value != null ? x.value : x.derived; };
  const d = at("delay") || 0, a = at("attack") || 0, h = at("hold") || 0;
  const dc = at("decay") || 0, rl = at("release") || 0;
  const s = at("sustain");
  const total = d + a + h + dc + rl;
  /* THE PLATEAU IS A QUARTER OF THE DRAWN SPAN, always. It is the one stretch
     of the picture that is not a number, so giving it a share of the span
     rather than a duration is the honest drawing. */
  const plateau = Math.max(total, 0.001) / 3;
  return { d, a, h, dc, rl, s: s == null ? 1 : s,
           span: total + plateau, plateau };
}

export function adsrEditor(host: HTMLElement, spec0: EnvSpec): Editor {
  let spec = spec0;
  const node = document.createElement("div");
  node.className = "nu-env";
  host.append(node);

  /* THE LIVE DRAG'S OWN VALUES. A drag moves the drawing on every frame and
     writes the document ONCE, on release (plate.ts's own law) — so while a
     thumb is down the picture is drawn from HERE and the record is left
     alone. `null` means nothing is being dragged and the record is the truth. */
  let LIVE: Partial<Record<Seg, number>> = {};
  let GRAB: Partial<Record<Seg, number>> = {};

  const byseg = (): Record<string, EnvField | undefined> => {
    const o: Record<string, EnvField | undefined> = {};
    for (const f of spec.fields) o[f.seg] = f;
    return o;
  };
  const valOf = (f: EnvField): number =>
    LIVE[f.seg] != null ? (LIVE[f.seg] as number)
      : (f.value != null ? f.value : f.derived);

  /* ---- the drawing ------------------------------------------------- */
  const geometry = (w: number) => {
    const F = byseg();
    const at = (s: Seg) => { const f = F[s]; return f ? valOf(f) : 0; };
    const sus = F.sustain ? valOf(F.sustain) : 1;
    const T = { d: at("delay"), a: at("attack"), h: at("hold"),
                dc: at("decay"), rl: at("release") };
    const total = T.d + T.a + T.h + T.dc + T.rl;
    const plateau = Math.max(total, 0.001) / 3;
    const span = total + plateau;
    const usable = Math.max(1, w - 2 * R);
    const px = (t: number) => R + (t / span) * usable;
    /* THE CURVE IS INSET BY A HANDLE'S RADIUS IN **BOTH** AXES, and the second
       one is a measurement: the plate was inset by R sideways and by 0.6R up
       and down, so the attack handle — which rides the peak, at level 1 — sat
       8.8px ABOVE the plate's own box. The AUX spike measured exactly this
       failure on somebody else's chart (a 44px handle at an edge overhangs by
       22 and the page scrolls); test/envelope.browser.js E1 asks for every
       handle's rect to be inside the plate's, and it read `false` on both the
       hour this was 0.6R. A handle's CENTRE lives in [R, W-R] x [R, H-R]. */
    const top = R, bot = PLATE_H - R;
    const y = (lv: number) => bot - Math.min(1, Math.max(0, lv)) * (bot - top);
    const x0 = px(0);
    const xD = px(T.d);                       // the note is told to start
    const xA = px(T.d + T.a);                 // the peak
    const xH = px(T.d + T.a + T.h);           // the peak held
    const xS = px(T.d + T.a + T.h + T.dc);    // it has fallen to where it rests
    const xP = px(T.d + T.a + T.h + T.dc + plateau);   // the note is let go
    const xR = px(span);                      // silence
    return { F, T, sus, span, px, y, top, bot, x0, xD, xA, xH, xS, xP, xR };
  };

  type G = ReturnType<typeof geometry>;

  /** THE CURVE ITSELF, and it is the real one: a linear attack (which is what
   *  sampler.js's declick ramp and state-engine's `attack` both are), an
   *  exponential-ish decay and release drawn as quadratics, because that is
   *  what those stages sound like and a straight line down would be a picture
   *  of a different envelope. */
  const path = (g: G): string => {
    const p: string[] = [];
    p.push("M " + g.x0.toFixed(1) + " " + g.y(0).toFixed(1));
    if (g.xD > g.x0) p.push("L " + g.xD.toFixed(1) + " " + g.y(0).toFixed(1));
    p.push("L " + g.xA.toFixed(1) + " " + g.y(1).toFixed(1));
    if (g.xH > g.xA) p.push("L " + g.xH.toFixed(1) + " " + g.y(1).toFixed(1));
    if (g.F.decay) p.push("Q " + (g.xH + (g.xS - g.xH) * 0.35).toFixed(1) + " " +
      g.y(g.sus).toFixed(1) + " " + g.xS.toFixed(1) + " " + g.y(g.sus).toFixed(1));
    else p.push("L " + g.xS.toFixed(1) + " " + g.y(g.sus).toFixed(1));
    p.push("L " + g.xP.toFixed(1) + " " + g.y(g.sus).toFixed(1));
    p.push("Q " + (g.xP + (g.xR - g.xP) * 0.35).toFixed(1) + " " +
      g.y(g.sus * 0.25).toFixed(1) + " " + g.xR.toFixed(1) + " " + g.y(0).toFixed(1));
    return p.join(" ");
  };

  /** WHERE EACH HANDLE STANDS. A time handle rides the curve at the moment it
   *  owns; the sustain handle rides the plateau, which is the only stretch
   *  whose HEIGHT it decides. */
  const seat = (g: G, s: Seg): { x: number; y: number } => {
    switch (s) {
      case "delay":   return { x: g.xD, y: g.y(0) };
      case "attack":  return { x: g.xA, y: g.y(1) };
      case "hold":    return { x: g.xH, y: g.y(1) };
      case "decay":   return { x: g.xS, y: g.y(g.sus) };
      case "sustain": return { x: (g.xS + g.xP) / 2, y: g.y(g.sus) };
      case "release": return { x: g.xR, y: g.y(0) };
      default:        return { x: g.x0, y: g.y(0) };
    }
  };

  /* ---- the drag, in the field's own units --------------------------- */
  /* A PIXEL IS A NUMBER IN THE FIELD'S OWN UNITS, and the conversion is the
     plate's own arithmetic — `span` px across is `span` seconds, so dragging
     the release handle 40px right on a 300px plate with a 1.2 s span adds
     0.16 s. The value is clamped by the FIELD (knobs.js's measured min/max, or
     the engine's own clamp for a sampled chair) and quantised to its step. */
  const dragHost: DragHost = {
    plate: node,
    onMove(k, dx, dy) {
      const seg = k.split("|").pop() as Seg;
      const F = byseg(); const f = F[seg];
      if (!f) return;
      const w = plateWidth();
      const g0 = geometry(w);
      const base = GRAB[seg] != null ? (GRAB[seg] as number)
        : (f.value != null ? f.value : f.derived);
      let v: number;
      if (ISLEVEL[seg]) {
        const h = (PLATE_H - R * 1.2);
        v = base - (dy / h) * (f.max - f.min);
      } else {
        const usable = Math.max(1, w - 2 * R);
        v = base + (dx / usable) * g0.span;
      }
      LIVE[seg] = quantise(v, f.min, f.max, f.step);
      /* A DRAG MOVES THE DRAWING AND MUST NOT REBUILD IT. `draw()` stood here
         and it cost the whole gesture: lit builds a NEW `<button>` for every
         handle on every render, so the first `pointermove` replaced the very
         element that held the pointer capture, the browser released the
         capture with the node, and the `pointerup` that ends the drag — the
         one write in the whole gesture — landed on nothing. Measured on the
         rendered page: the handle followed the thumb to 1.95 s and the
         document still said nothing.
         So the frames of a drag PATCH the DOM that is already there — three
         attributes on the handle and one `d` on the path — and `draw()` is
         kept for the events that end one. */
      paintLive();
    },
    onDrop(k) {
      const seg = k.split("|").pop() as Seg;
      const v = LIVE[seg];
      LIVE = {}; GRAB = {};
      if (v == null) { draw(); return; }
      /* ONE WRITE, ON RELEASE. `spec.set` is the caller's own door and it is
         what lands the change at the next bar. */
      unsay(spec.k);
      spec.set(seg, v);
      draw();
    },
    onHold(k) {
      /* THE LONG PRESS IS THE RESET, because the double-tap is dead on touch
         and the spike measured it at four gaps (plate.ts finding #2). */
      const seg = k.split("|").pop() as Seg;
      LIVE = {}; GRAB = {};
      unsay(spec.k);
      spec.clear(seg);
      draw();
    },
    /* A TAP ON A REFUSED HANDLE (§15 B5): plate.ts has already stored the
       reason under this plate's address; this is the redraw that prints it. */
    onRefused() { draw(); },
  };

  const plateWidth = (): number => {
    const el = node.querySelector(".nu-envplate") as HTMLElement | null;
    const w = el ? el.getBoundingClientRect().width : 0;
    /* A PLATE THAT HAS NOT BEEN LAID OUT YET STILL DRAWS. A sheet is built
       before it is in the document (src/table/sheet.ts hands the caller a
       node), so the first draw measures zero and every handle would stack at
       one x. 320 is the phone's own width minus the sheet's gutters, which is
       the narrowest this ever really is. */
    return w > 40 ? w : 320;
  };

  const view = (): TemplateResult => {
    const w = plateWidth();
    const g = geometry(w);
    const F = byseg();
    const order: Seg[] = ["delay", "attack", "hold", "decay", "sustain", "release"];
    const live = order.filter((s) => !!F[s]);
    /* THE GHOST IS WHAT THE CHAIR INHERITS. Drawn under the real curve
       whenever a hand has written anything, so "what I changed it from" is on
       the plate rather than in a memory — the same dim-is-derived law the
       cells are drawn under (§2), in a curve. */
    const anySet = spec.fields.some((f) => f.value != null);
    const ghostG = anySet ? (() => {
      const saveL = LIVE; LIVE = {};
      const saved = spec.fields.map((f) => f.value);
      spec.fields.forEach((f) => { f.value = null; });
      const gg = geometry(w);
      spec.fields.forEach((f, i) => { f.value = saved[i] as number | null; });
      LIVE = saveL;
      return gg; })() : null;
    return html`
      <div class="nu-envplate" data-k=${spec.k}
           aria-label=${t("env.plate")}>
        <svg class="nu-envsvg" viewBox=${"0 0 " + w + " " + PLATE_H}
             width=${w} height=${PLATE_H} aria-hidden="true"
             preserveAspectRatio="none">
          ${svg`<line class="nu-envbase" x1="0" y1=${g.y(0)} x2=${w} y2=${g.y(0)} />`}
          ${ghostG ? svg`<path class="nu-envghost" d=${path(ghostG)} />` : nothing}
          ${svg`<path class="nu-envcurve" d=${path(g)} />`}
        </svg>
        ${live.map((s) => {
          const f = F[s] as EnvField;
          const pos = seat(g, s);
          const v = valOf(f);
          const b = handle({
            k: spec.k + "|" + s, label: segWord(s), value: v,
            min: f.min, max: f.max, step: f.step,
            say: say(v, f.unit), axis: ISLEVEL[s] ? "y" : "x",
            x: pos.x, y: pos.y, why: f.why || null, sayK: spec.k }, dragHost);
          b.addEventListener("keydown", (e: KeyboardEvent) => {
            const nv = keyStep(e, valOf(f), f.min, f.max, f.step,
                               ISLEVEL[s] ? "y" : "x");
            if (nv == null) {
              /* BACKSPACE AND DELETE ARE THE CLEAR-BACK ON THE KEYBOARD — the
                 same gesture the grid uses for "back to what it inherits". */
              if (e.key === "Backspace" || e.key === "Delete") {
                e.preventDefault(); e.stopPropagation(); spec.clear(s); draw(); }
              return;
            }
            e.preventDefault();
            /* AND IT DOES NOT REACH THE GRID. This editor sits inside a table
               cell whose own arrows move the SELECTION; an arrow that moved
               the handle and the selection would move two things at once. */
            e.stopPropagation();
            spec.set(s, nv);
            draw();
          });
          b.addEventListener("pointerdown", () => { GRAB[s] = valOf(f); });
          return b; })}
      </div>
      <div class="nu-envsays">
        ${live.map((s) => {
          const f = F[s] as EnvField;
          const set = f.value != null;
          return html`<span class=${"nu-envsay" + (set ? " is-said" : "")}
            data-k=${"envsay|" + spec.k + "|" + s}
            ><b>${segWord(s)}</b> <span>${say(valOf(f), f.unit)}</span>${
            set ? html` <button type="button" class="nu-clearback"
              data-k=${"clear|" + spec.k + "|" + s}
              aria-label=${t("env.clearBack", { name: segWord(s) })}
              @click=${() => { unsay(spec.k); spec.clear(s); draw(); }}>${t("act.clear")}</button>` : nothing
          }</span>`; })}
      </div>
      ${/* THE REFUSAL SAID OUT LOUD (§15 B5) — one line per plate, under it.
            The room is reserved whether or not there is a sentence, so a
            reason arriving under a thumb moves nothing. */
        sayLine(spec.k)}`;
  };

  /* THE LIVE FRAME: the same arithmetic `view()` uses, written onto the nodes
     that are already on the page. Nothing here creates or removes an element. */
  const paintLive = (): void => {
    const w = plateWidth();
    const g = geometry(w);
    const F = byseg();
    const path2 = node.querySelector(".nu-envcurve");
    if (path2) path2.setAttribute("d", path(g));
    for (const el of Array.from(node.querySelectorAll<HTMLElement>(".nu-envh"))) {
      const seg = (el.dataset.k || "").split("|").pop() as Seg;
      const f = F[seg]; if (!f) continue;
      const pos = seat(g, seg);
      el.style.left = (pos.x - R) + "px";
      el.style.top = (pos.y - R) + "px";
      const v = valOf(f);
      el.setAttribute("aria-valuenow", String(v));
      el.setAttribute("aria-valuetext", say(v, f.unit));
    }
    for (const el of Array.from(node.querySelectorAll<HTMLElement>(".nu-envsay"))) {
      const seg = (el.dataset.k || "").split("|").pop() as Seg;
      const f = F[seg]; if (!f) continue;
      const out = el.querySelector("span");
      if (out) out.textContent = say(valOf(f), f.unit);
    }
  };

  const draw = () => { render(view(), node); };
  draw();
  /* AND ONCE MORE WHEN THE BOX HAS A WIDTH. See `plateWidth` — the first draw
     may happen before this node is in the document, and a curve drawn against
     320 in a 700px sheet would be right-hand air. One frame, no clock. */
  requestAnimationFrame(() => { if (node.isConnected) draw(); });

  return { node, update(next) { spec = next as EnvSpec; LIVE = {}; GRAB = {}; draw(); } };
}
