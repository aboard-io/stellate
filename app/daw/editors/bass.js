// editors/bass.js — the bass PART tab: degree-cell grid + mutation tile.
//
// Per DAW-GRID spec "bass PART": the authored degree-cell grid (.dw-grid over
// root / octave / fifth rows) wherever machines/bass.js cellOf() has a seed or
// an authored cell, the honest note for the generative cases (they draw per
// bar — authoring here would replace them wholesale), and the mutation TILE
// writing rhythm.complexity through the layers path
// (ctx.song.editLayer("bass","mutate", v01) — layers.js WRITERS.bass).
//
// REPAINT POLICY: degree cells are not pads/tiles, so every toggle repaints its
// own grid in place; structural changes (revert/clear) go through ctx.rerender().
//
// Contract: export render(host, ctx) — ctx per app/daw/sheet.js header.
import * as BASS from "../machines/bass.js";
import { readLayer, fmtLayer } from "../layers.js";

const el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };
const mini = (label, title, onClick) => {
  const b = el("button", "dw-mini", label);
  b.type = "button";
  if (title) b.title = title;
  b.addEventListener("click", onClick);
  return b;
};

export function render(host, ctx) {
  host.textContent = "";
  const patterns = BASS.bassPatterns();
  if (!patterns.length) {
    const box = el("div", "dw-ed");
    box.appendChild(el("div", "dw-edhead", "bass — the low-end machines"));
    box.appendChild(el("p", "dw-pnote", "this form never turns the bass on — set a section's bass in the section sheet."));
    host.appendChild(box);
    return;
  }
  if (ctx.section) {
    const own = ctx.section.sec && ctx.section.sec.bass;
    host.appendChild(el("p", "dw-pnote",
      own && own !== "off"
        ? `this column runs “${own}” — a pattern edit lands everywhere the form plays it, not just here.`
        : "this column's bass is off — the machines below still edit the patterns the other sections play."));
  }

  for (const name of patterns) {
    if (BASS.cellOf(name)) degreeGrid(host, ctx, name);
    else {
      const box = el("div", "dw-ed");
      box.appendChild(el("div", "dw-edhead", name + " — generative"));
      box.appendChild(el("p", "dw-pnote",
        `“${name}” is one of the generative bass cases — it draws per bar, so there is no fixed bar to edit. ` +
        "Authoring one here would replace it wholesale; use the mutation tile below instead."));
      host.appendChild(box);
    }
  }
  mutationBlock(host, ctx);
}

// ---------- MACHINE 1: the degree-cell grid (rows are chord DEGREES) ----------
function degreeGrid(host, ctx, name) {
  const box = el("div", "dw-ed");
  const head = el("div", "dw-edhead", name + " — cell");
  if (BASS.isEdited(name)) {
    head.appendChild(el("span", "dw-badge", "edited"));
    head.appendChild(mini("revert", "drop this song's override and play the stock pattern again", () => { BASS.revert(name); ctx.rerender(); }));
  }
  head.appendChild(mini("clear", "empty the bar and start from silence", () => { BASS.clear(name); ctx.rerender(); }));
  box.appendChild(head);

  const g = el("div", "dw-grid");
  g.style.setProperty("--hue", ctx.hue);
  g.style.setProperty("--cols", BASS.COLS);
  const cells = [];                                        // [row][col] -> button
  for (let r = 0; r < BASS.TONES.length; r++) {
    g.appendChild(el("span", "dw-glabel", BASS.toneLabel[BASS.TONES[r]]));
    cells[r] = [];
    for (let c = 0; c < BASS.COLS; c++) {
      const b = el("button", "dw-cell" + (c % 2 === 0 ? " beat" : ""));
      b.type = "button";
      b.title = `beat ${(c * BASS.STEP).toFixed(1)} · ${BASS.toneLabel[BASS.TONES[r]]}`;
      b.setAttribute("aria-label", b.title);
      b.addEventListener("click", () => { BASS.toggle(name, c, r); paint(); ctx.setEcho(""); });
      cells[r][c] = b;
      g.appendChild(b);
    }
  }
  function paint() {
    const grid = BASS.toGrid(BASS.cellOf(name) || []);
    for (let r = 0; r < BASS.TONES.length; r++)
      for (let c = 0; c < BASS.COLS; c++) {
        const on = grid.get(c) === r;
        cells[r][c].classList.toggle("on", on);
        cells[r][c].setAttribute("aria-pressed", on ? "true" : "false");
      }
  }
  paint();
  box.appendChild(g);
  box.appendChild(el("p", "dw-pnote",
    "rows are chord DEGREES, not pitches — root / octave / fifth of whatever chord is sounding. " +
    "An authored bar follows the harmony and survives a reharmonisation. Each note holds until the next one starts."));
  host.appendChild(box);
}

// ---------- MACHINE 2: mutation — the cell breathes ----------
function mutationBlock(host, ctx) {
  const box = el("div", "dw-ed");
  box.appendChild(el("div", "dw-edhead", "mutation — the cell breathes"));
  const tiles = el("div", "dw-tiles");
  ctx.controls.makeTile(tiles, {
    label: "mutate", unit: "", hue: ctx.hue,
    read: () => {
      const st = ctx.song.state();
      const v = readLayer(st, "bass", "mutate");
      const p = ctx.song.SONG.patch;
      const stock = !((p.layers || {}).bass && p.layers.bass.mutate != null)
        && !(p.rhythm && p.rhythm.complexity != null);
      return { v, txt: fmtLayer("bass", "mutate", v), stock };
    },
    write: (v) => ctx.song.editLayer("bass", "mutate", v),
    revert: () => {
      ctx.song.editLayer("bass", "mutate", null);
      // the machines path (patch.rhythm.complexity) may also carry a value —
      // revert means STOCK, whichever door the edit came in through
      const p = ctx.song.SONG.patch;
      if (p.rhythm && "complexity" in p.rhythm) {
        const r = Object.assign({}, p.rhythm);
        delete r.complexity;
        const np = Object.assign({}, p);
        if (Object.keys(r).length) np.rhythm = r; else delete np.rhythm;
        ctx.song.edit({ patch: np });
      }
    },
    onDrag: (v, txt) => ctx.setEcho("mutate · " + txt),
  });
  box.appendChild(tiles);
  box.appendChild(el("p", "dw-pnote",
    "per cycle the cell drops, anticipates or octave-flips a note on its own dedicated stream, " +
    "capped at two moves a cycle. Zero draws nothing at all — and stays byte-identical. " +
    "Honest note: the engine reads this same knob for the melody's retiming too, so turning it " +
    "up loosens the melody as well — one groove dial, two voices, by design (csd-engine mrng)."));
  host.appendChild(box);
}
