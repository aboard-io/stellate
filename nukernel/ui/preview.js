/* nukernel/ui/preview.js — A PICTURE OF THE THING (2026-09-02)
 *
 * Paul, 2026-09-01, on the aesthetic: *"classic-era System 8/9 MacOS — lots of
 * previews, small widgets, dynamic nav/menus, and flyouts"*; and on the motif
 * editor: *"the motif editor should show me previews of the instruments using
 * the motif."*
 *
 * ONE EXPORT, ONE JOB. `preview(cell)` returns an inline `<svg
 * class="nu-preview">` — sixteen rects in a 16x8 viewBox, one per step, height
 * = velocity — that a caller drops beside a motif's name so two motifs in a
 * list are told apart by SHAPE before either name is read. The face is
 * `nu.css`'s (`.nu-preview`, and there is no second stylesheet); this file
 * decides only what the bars ARE.
 *
 * THREE MARKS AND NO FOURTH, because at 4ch x 1.2em there is room for three:
 *   · a STEP that sounds — a rect whose height is its velocity, 1..7 of 8;
 *   · a REST — a 1px floor in `--faint`, so the grid's rhythm stays visible
 *     (sixteen columns with holes in them is unreadable at this size);
 *   · a HOLD — the continuation of the step before it, dimmed, so a long note
 *     reads as one shape rather than as two hits.
 * NO PITCH. A 1.2em box has about nine usable pixels of height and it spends
 * all of them on loudness; a contour drawn in the same nine is a smudge, which
 * is the lesson `.nu-tf`'s deleted SVG faces already paid for (nu.css, THE
 * THREE TRANSFORM ROWS).
 *
 * WHAT A CELL IS, AND WHY THIS FILE ASKS RATHER THAN ASSUMES. A melodic phrase
 * (nukernel/song.js `blank()`) is `{ deg, oct, vel, inc, stk, gate, acc, sld }`
 * — parallel arrays, sixteen long by default but 1..128 since the phrase grew
 * a length — where `gate[i]` is whether step i SOUNDS and `sld[i]` is a slide,
 * which is this data tier's spelling of a tie. A DRUM phrase (`blankDrum()`)
 * is `{ kind: "drum", swing, <lane>: [...] }` over `kernel.js DRUM_LANES` and
 * has no `deg`/`vel` at all — its loudness per step is the LOUDEST lane that
 * fires there, which is what a kit sounds like and is why the fold is `max`.
 * Both shapes are read defensively: a caller with `{deg, vel, play}` (the
 * shape the plan named) works, and so does a raw phrase off the record. No
 * silent default — an argument this file cannot read at all draws sixteen
 * rests, which LOOKS like the empty thing it is rather than like nothing.
 *
 * NO DEPS BEYOND `document`. It is a leaf: nothing here imports state, the
 * record, or another view, so a preview can be built anywhere a cell is in
 * hand — including inside the tray, which is outside `#app`.
 */

const NS = "http://www.w3.org/2000/svg";
const STEPS = 16;      // the picture is always sixteen wide, whatever the cell is
const TOP = 8;         // the viewBox's own height: eight units for eight levels
const W = 0.8;         // a bar's width, leaving .2 of a unit as the gap
const FLOOR = 0.6;     // a rest's 1px floor, in viewBox units

/* THE VELOCITY SCALE IS THE PAGE'S, NOT A NEW ONE: 0..7, the same range
   `ui/eight.js benchVel` cycles and the same range `.nu-velA[data-v]` paints,
   so a preview and the bench agree about what "4" looks like without either
   being told. A phrase's own `vel` is 0..7 already (song.js fills 5). */
const V_MAX = 7;

const num = (x) => (typeof x === "number" && isFinite(x) ? x : 0);
const arr = (a) => (Array.isArray(a) ? a : null);

/* Is this a drum phrase? `song.js isDrumPhrase` asks the same question the same
   way; it is re-asked here rather than imported because song.js is the classic
   UMD data tier and this file is a leaf ES module with no deps by design. */
function drumLanes(cell) {
  if (!cell || cell.kind !== "drum") return null;
  const lanes = [];
  for (const k of Object.keys(cell)) {
    if (k === "kind" || k === "swing") continue;
    const a = arr(cell[k]);
    if (a) lanes.push(a);
  }
  return lanes.length ? lanes : null;
}

/** Read a cell into two parallel vectors of length STEPS:
 *  `lv` — 0..7, the level of the step (0 = nothing sounds here)
 *  `hold` — true when this step is the CONTINUATION of the one before it. */
function readCell(cell) {
  const lv = new Array(STEPS).fill(0);
  const hold = new Array(STEPS).fill(false);
  if (!cell || typeof cell !== "object") return { lv, hold };

  const lanes = drumLanes(cell);
  if (lanes) {
    /* FOLDED BY MAX, because that is what a kit sounds like: a bar where the
       kick is at 7 and the hat at 2 is a LOUD step, not a step of 4.5. A drum
       phrase carries no ties, so nothing here is ever a hold. */
    for (let i = 0; i < STEPS; i++) {
      let m = 0;
      for (const lane of lanes) m = Math.max(m, num(lane[i]));
      lv[i] = Math.max(0, Math.min(V_MAX, Math.round(m)));
    }
    return { lv, hold };
  }

  /* A MELODIC PHRASE. `play` is the plan's word and `gate` is the record's;
     both are accepted, in that order, and the last resort is `deg` being
     non-zero — which is what a caller holding a bare contour has. */
  const vel = arr(cell.vel);
  const play = arr(cell.play) || arr(cell.gate);
  const deg = arr(cell.deg);
  const tie = arr(cell.sld) || arr(cell.hold) || arr(cell.tie);
  for (let i = 0; i < STEPS; i++) {
    const sounds = play ? !!play[i] : (deg ? num(deg[i]) !== 0 : false);
    if (!sounds) continue;
    /* a step that sounds and states no velocity is a MID hit (4 of 7), not a
       silent one — the same "never lands on 0" rule benchVel's tap cycle has */
    const v = vel ? Math.round(num(vel[i])) : 4;
    lv[i] = Math.max(1, Math.min(V_MAX, v || 4));
    if (tie && tie[i]) hold[i] = true;
  }
  /* a slide/tie marks the step it LEAVES, so the continuation is the step
     after it — and only if that step is sounding, because a tie into silence
     is a fault in the record and not a picture this file may invent */
  const out = new Array(STEPS).fill(false);
  for (let i = 1; i < STEPS; i++) if (hold[i - 1] && lv[i]) out[i] = true;
  return { lv, hold: out };
}

function rect(x, y, w, h, cls) {
  const r = document.createElementNS(NS, "rect");
  r.setAttribute("x", String(x));
  r.setAttribute("y", String(y));
  r.setAttribute("width", String(w));
  r.setAttribute("height", String(h));
  if (cls) r.setAttribute("class", cls);
  return r;
}

/**
 * Build the thumbnail.
 * @param {object} cell  a melodic phrase `{deg, vel, gate|play, sld}`, a drum
 *                       phrase `{kind:"drum", <lane>:[...]}` , or the plan's
 *                       `{deg, vel, play}`. Anything else draws sixteen rests.
 * @param {object} [opts] `{ label }` — a string for the `<title>`/`aria-label`.
 *                       Omitted, the svg is `aria-hidden` and carries no name,
 *                       which is right when it sits BESIDE the name it is a
 *                       picture of (the usual case, and the page's own law:
 *                       one owner per fact, say it once).
 * @returns {SVGSVGElement} an `<svg class="nu-preview">`.
 */
export function preview(cell, opts) {
  const o = opts || {};
  const { lv, hold } = readCell(cell);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "nu-preview");
  svg.setAttribute("viewBox", "0 0 " + STEPS + " " + TOP);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("focusable", "false");
  if (o.label) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", String(o.label));
    const t = document.createElementNS(NS, "title");
    t.textContent = String(o.label);
    svg.append(t);
  } else {
    /* A PICTURE OF A THING WHOSE NAME IS BESIDE IT SAYS NOTHING TWICE. The
       glyph registry makes the same call for the same reason (ui/glyph.js: the
       glyph is aria-hidden and the WORD carries the name). */
    svg.setAttribute("aria-hidden", "true");
  }
  for (let i = 0; i < STEPS; i++) {
    const v = lv[i];
    if (!v) { svg.append(rect(i, TOP - FLOOR, W, FLOOR, "nu-preview-rest")); continue; }
    const h = (v / V_MAX) * (TOP - FLOOR) + FLOOR;
    svg.append(rect(i, TOP - h, W, h, hold[i] ? "nu-preview-hold" : null));
  }
  return svg;
}

export default preview;
