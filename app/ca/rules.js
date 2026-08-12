// rules.js — THE OUTPUT OF YOUR RULE. Not a catalogue of 256 others.
//
// This surface used to be a 16x16 wall of thumbnails: every rule's behaviour
// from your seed, pick one. It was a good answer to "how do I choose a byte" and
// the wrong question. You do not choose a byte — you author eight answers on the
// switches above, and what you need to see is WHAT THEY DO. A wall of 255 rules
// you did not pick is noise around the one you did.
//
// So this draws one thing, large: your seed run down under your rule. Rows are
// generations, top to bottom, sixteen cells across, aligned with the seed row on
// the screen above it — so a cell you tap up there moves a column down here.
//
// It shows three facts the orbit cannot, because the orbit stops at the song:
//   * WHERE THE SONG ENDS — the sections in play are bright, the rest dim, so you
//     can see whether you are hearing the interesting part of the orbit
//   * WHERE THE LOOP STARTS — a line at the tail/cycle boundary, which is the
//     structural fact about the whole piece
//   * WHETHER IT DIES — a rule that goes blank goes visibly blank
//
// Changing rule is ‹ › (step by one) and ⤫ (jump), because stepping is how you
// find the neighbour of something you nearly like. There is no wall to browse.
import { DOC, edit, subs } from "./doc.js";

const CA = window.CsdCA;
const GENS = 48;                      // far enough to watch a tail settle
let cv = null, ctx = null, note = null, dpr = 1, lastW = 0, cw = 0, ch = 0;

export function build(canvas, noteEl, ctlHost) {
  cv = canvas; note = noteEl; ctx = cv.getContext("2d", { alpha: false });
  // tapping a generation makes it the seed — the same move the orbit's rows
  // offer, available here because this view goes further out than the song does
  cv.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    const g = Math.floor((e.clientY - r.top) / (r.height / GENS));
    if (g > 0 && g < GENS) edit({ seed: CA.gen(CA.orbit(DOC.seed, DOC.rule), g) });
  });
  if (ctlHost) {
    ctlHost.textContent = "";
    const mk = (label, title, fn) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "ca-btn ca-rulestep";
      b.textContent = label; b.title = title;
      b.addEventListener("click", fn);
      ctlHost.appendChild(b);
      return b;
    };
    mk("‹", "the rule one below", () => edit({ rule: (DOC.rule + 255) % 256 }));
    const lab = document.createElement("b");
    lab.className = "ca-rulenum";
    ctlHost.appendChild(lab);
    mk("›", "the rule one above", () => edit({ rule: (DOC.rule + 1) % 256 }));
    mk("⤫", "some other rule", () => edit({ rule: (Math.random() * 256) | 0 }));
    ctlHost._lab = lab;
    ctlEl = ctlHost;
  }
  size();
}
let ctlEl = null;

export function resize() { size(); }
function size() {
  if (!cv) return;
  // the pane may be `hidden`, in which case every measurement is 0 — hold the
  // last good width rather than collapsing the diagram to nothing
  const w = Math.min(cv.parentElement.clientWidth || lastW || 320, 560);
  if (w > 0) lastW = w;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cw = Math.floor(w / CA.N);
  // FIT THE PANE. A square-ish cell over 48 generations is 1000px tall, which
  // put the one thing this surface exists to show below the fold — the diagram
  // scrolling is the same failure as the page scrolling, one level down. Rows
  // squash to whatever is left after the switches and the stepper.
  const pane = document.getElementById("caPane");
  let avail = 0;
  if (pane) {
    const top = cv.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
    avail = pane.clientHeight - top - 46;          // 46 = the note line under it
  }
  const fit = avail > 60 ? Math.floor(avail / GENS) : 0;
  ch = Math.max(4, Math.min(Math.round(cw * 0.55), fit || 999));
  cv.style.width = cw * CA.N + "px";
  cv.style.height = ch * GENS + "px";
  cv.width = cw * CA.N * dpr; cv.height = ch * GENS * dpr;
  paint();
}

export function paint() {
  if (!ctx) return;
  const W = cw * CA.N, H = ch * GENS;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#0c0a1a"; ctx.fillRect(0, 0, W, H);

  const orb = CA.orbit(DOC.seed, DOC.rule);
  const used = CA.formGens(orb, DOC.bars).length;      // generations the song plays

  for (let g = 0; g < GENS; g++) {
    const row = CA.gen(orb, g), y = g * ch;
    const inSong = g < used;
    // the beat grid, faintly, so a column is readable as a position in the bar
    if (g === 0) { ctx.fillStyle = "#191534"; for (let i = 0; i < CA.N; i += 4) ctx.fillRect(i * cw, 0, cw, H); }
    ctx.fillStyle = inSong ? (g === 0 ? "#ff5fa2" : "#8f7fd8") : "#3a3363";
    for (let i = 0; i < CA.N; i++) {
      if (CA.at(row, i)) ctx.fillRect(i * cw + 0.5, y + 0.5, cw - 1, Math.max(1, ch - 1));
    }
  }
  // where the song stops
  if (used < GENS) {
    ctx.fillStyle = "#6de3ff"; ctx.fillRect(0, used * ch - 1, W, 1);
  }
  // where the loop begins — the structural fact about the whole piece
  if (orb.cycle && orb.tail > 0 && orb.tail < GENS) {
    ctx.fillStyle = "#4b4370";
    for (let x = 0; x < W; x += 6) ctx.fillRect(x, orb.tail * ch - 1, 3, 1);
  }

  if (ctlEl && ctlEl._lab) ctlEl._lab.textContent = "rule " + DOC.rule;
  if (note) {
    note.textContent = "rule " + DOC.rule + " · "
      + (orb.cycle ? (orb.tail ? "settles into a " + orb.cycle + "-row loop after " + orb.tail
        : "a pure " + orb.cycle + "-row loop") : "no loop within " + orb.rows.length + " rows")
      + " · the song is the bright part, " + used + " rows";
  }
}

subs.push(paint);
