// rules.js — THE RULE BROWSER: all 256 futures of the row you drew.
//
// This is the surface the whole design turns on. Picking a rule by NUMBER is a
// lottery — rule 110 and rule 111 have nothing to do with each other, and most
// rules are dead or trivial on a sixteen-cell ring. But a rule's behaviour from
// a given seed is a PICTURE, and 256 pictures fit on a phone. So the choice
// stops being "which byte" and becomes "which of these shapes", which is a
// thing a person can actually do, with a thumb, in a second.
//
// This is also the honest answer to the design's one real weakness. Most rules
// ARE dead here. Rather than hide that behind a curated list, the browser shows
// it: a dead rule is visibly a blank tile, a trivial one is visibly a stripe,
// and the interesting ones look interesting. Nothing is filtered out.
//
// ONE CANVAS, NOT 256. Sixteen tiles across, sixteen down, hit-tested on click.
// 256 separate canvases would be 256 contexts to allocate and redraw every time
// a cell is tapped; this is one draw loop of ~98k pixels and repaints in a
// frame. The cost of that choice is accessibility, which is paid back below:
// the canvas is focusable, arrow keys walk the grid, and an aria-live line
// speaks the rule and its cycle length.
import { DOC, edit, subs } from "./doc.js";

const CA = window.CsdCA;
const COLS = 16, GENS = 22;           // 22 generations is enough to show a tail settling
const PAD = 3;

let cv = null, ctx = null, note = null, tw = 0, th = 0, dpr = 1;

export function build(canvas, noteEl) {
  cv = canvas; note = noteEl; ctx = cv.getContext("2d", { alpha: false });
  cv.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    const c = Math.floor((e.clientX - r.left) / (r.width / COLS));
    const row = Math.floor((e.clientY - r.top) / (r.height / COLS));
    const rule = row * COLS + c;
    if (rule >= 0 && rule < 256) { edit({ rule }); cv.focus(); }
  });
  cv.addEventListener("keydown", (e) => {
    const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS }[e.key];
    if (d == null) return;
    e.preventDefault();
    const next = DOC.rule + d;
    if (next >= 0 && next < 256) edit({ rule: next });
  });
  window.addEventListener("resize", size);
  size();
}

function size() {
  if (!cv) return;
  const w = cv.parentElement.clientWidth || 320;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  tw = Math.floor(w / COLS);
  th = Math.max(10, Math.round(tw * (GENS / CA.N) * 0.62));
  cv.style.width = tw * COLS + "px";
  cv.style.height = th * COLS + "px";
  cv.width = tw * COLS * dpr; cv.height = th * COLS * dpr;
  paint();
}

export function paint() {
  if (!ctx) return;
  const W = tw * COLS, H = th * COLS;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#0c0a1a"; ctx.fillRect(0, 0, W, H);

  const cw = (tw - PAD) / CA.N, ch = (th - PAD) / GENS;
  for (let rule = 0; rule < 256; rule++) {
    const tx = (rule % COLS) * tw, ty = Math.floor(rule / COLS) * th;
    const sel = rule === DOC.rule;
    if (sel) { ctx.fillStyle = "#ff5fa2"; ctx.fillRect(tx, ty, tw, th); }
    ctx.fillStyle = sel ? "#2a0d1c" : "#15122a";
    ctx.fillRect(tx + PAD / 2, ty + PAD / 2, tw - PAD, th - PAD);
    // the thumbnail: GENS generations of this rule from the CURRENT seed, so the
    // grid re-reads every time a cell is tapped — you are always browsing the
    // futures of the row in front of you, never a generic catalogue
    let row = DOC.seed;
    ctx.fillStyle = sel ? "#ffd7e8" : "#8f7fd8";
    for (let g = 0; g < GENS; g++) {
      const y = ty + PAD / 2 + g * ch;
      for (let i = 0; i < CA.N; i++) {
        if (CA.at(row, i)) ctx.fillRect(tx + PAD / 2 + i * cw, y, Math.max(1, cw - 0.3), Math.max(1, ch - 0.3));
      }
      row = CA.step(row, rule);
    }
  }
  if (note) {
    const orb = CA.orbit(DOC.seed, DOC.rule);
    const n = CA.formGens(orb, 12).length;
    note.textContent = "rule " + DOC.rule + " · "
      + (orb.cycle ? "loops every " + orb.cycle : "no loop yet")
      + " · " + n + " sections";
  }
}

subs.push(paint);
