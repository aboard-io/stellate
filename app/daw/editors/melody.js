// editors/melody.js — the melody PART tab: ladder / weave+FIT / wander per machine.
//
// Per DAW-GRID spec "melody PART": per machine in trackMachines order — a
// shipped/drawn phrase cell gets the LADDER GRID (.dw-grid, machines/cells.js),
// a weave organ gets the MATRIX + legato/step facts + FIT + scratch grid
// (.dw-matrix, machines/weave.js), wander gets gait chips + step/leap/rest/
// legato tiles (machines/melody.js), and a procedural generator (fugue/motorik/
// canon…) gets the honest "code, not data" note.
//
// REPAINT POLICY: ladder cells and matrix cells are not pads/tiles, so
// controls.refreshAll() cannot reach them — every toggle/nudge repaints its own
// grid in place from the machine's source of truth. Structural changes (revert,
// clear, FIT — the edited badge appears or goes) go through ctx.rerender().
//
// Contract: export render(host, ctx) — ctx per app/daw/sheet.js header.
import * as CELLS from "../machines/cells.js";
import * as WEAVE from "../machines/weave.js";
import * as MELODY from "../machines/melody.js";

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
  const patterns = CELLS.melodyPatterns();
  if (!patterns.length) {
    const box = el("div", "dw-ed");
    box.appendChild(el("div", "dw-edhead", "melody — the phrase machines"));
    box.appendChild(el("p", "dw-pnote", "this form never turns the melody on — set a section's melody in the section sheet."));
    host.appendChild(box);
    return;
  }
  if (ctx.section) {
    const own = ctx.section.sec && ctx.section.sec.melody;
    host.appendChild(el("p", "dw-pnote",
      own && own !== "off"
        ? `this column runs “${own}” — a pattern edit lands everywhere the form plays it, not just here.`
        : "this column's melody is off — the machines below still edit the patterns the other sections play."));
  }
  for (const name of patterns) {
    if (name === "wander") continue;                       // the walk, below
    if (WEAVE.isWeave(name)) weaveEditor(host, ctx, name);
    else if (CELLS.cellOf(name)) cellEditor(host, ctx, name);
    else {
      const box = el("div", "dw-ed");
      box.appendChild(el("div", "dw-edhead", name + " — procedural"));
      box.appendChild(el("p", "dw-pnote",
        `“${name}” is a procedural generator — code, not a phrase table — so there is nothing to draw. ` +
        "Its shape lives in csd-engine's melodyEvents; shape the SOUND tab instead, or swap the section's pattern."));
      host.appendChild(box);
    }
  }
  wanderBlock(host, ctx);
}

// ---------- the phrase editor (the LADDER: y = the chord's own voicing) ----------
function cellEditor(host, ctx, name, titleOverride) {
  const nCols = CELLS.cols();
  const box = el("div", "dw-ed");
  const head = el("div", "dw-edhead", titleOverride || (name + " — phrase"));
  if (CELLS.isEdited(name)) {
    head.appendChild(el("span", "dw-badge", "edited"));
    head.appendChild(mini("revert", "back to the shipped phrase", () => { CELLS.revert(name); ctx.rerender(); }));
  }
  head.appendChild(mini("clear", "empty the phrase and start from silence", () => { CELLS.clear(name); ctx.rerender(); }));
  box.appendChild(head);

  const g = el("div", "dw-grid");
  g.style.setProperty("--hue", ctx.hue);
  g.style.setProperty("--cols", nCols);
  const cells = [];                                        // [row][col] -> button
  for (let r = 0; r < CELLS.ROWS.length; r++) {
    g.appendChild(el("span", "dw-glabel", CELLS.rowLabel(CELLS.ROWS[r])));
    cells[r] = [];
    for (let c = 0; c < nCols; c++) {
      const b = el("button", "dw-cell" + (c % 4 === 0 ? " beat" : ""));
      b.type = "button";
      b.title = `beat ${(c * CELLS.STEP).toFixed(2)} · ${CELLS.rowLabel(CELLS.ROWS[r])}`;
      b.setAttribute("aria-label", b.title);
      b.addEventListener("click", () => { CELLS.toggle(name, c, r); paint(); ctx.setEcho(""); });
      cells[r][c] = b;
      g.appendChild(b);
    }
  }
  function paint() {
    const grid = CELLS.toGrid(CELLS.cellOf(name) || []);
    for (let r = 0; r < CELLS.ROWS.length; r++)
      for (let c = 0; c < nCols; c++) {
        const on = grid.has(c + ":" + r);
        cells[r][c].classList.toggle("on", on);
        cells[r][c].setAttribute("aria-pressed", on ? "true" : "false");
      }
  }
  paint();
  box.appendChild(g);
  box.appendChild(el("p", "dw-pnote",
    "the vertical axis is the CHORD'S OWN VOICING — root / 3rd / 5th / top, and the same again an octave up — " +
    "not a keyboard. What you draw is a contour in chord tones: it follows the harmony, transposes with the key, " +
    "and survives reharmonisation. Each note holds until the next one starts."));
  host.appendChild(box);
}

// ---------- the weave machine (matrix + FIT + scratch grid) ----------
function weaveEditor(host, ctx, name) {
  const w = WEAVE.weaveOf(name);
  const box = el("div", "dw-ed");
  const head = el("div", "dw-edhead", name + " — weave");
  if (WEAVE.isEdited(name)) {
    head.appendChild(el("span", "dw-badge", "edited"));
    head.appendChild(mini("revert", "back to the mined organ", () => { WEAVE.revert(name); ctx.rerender(); }));
  }
  head.appendChild(mini("fit from my phrases", "fit this generator from the phrases you have drawn", () => {
    const r = WEAVE.fitFromSong(name);
    if (r) { ctx.setEcho(`fitted from ${r.phrases} phrase${r.phrases > 1 ? "s" : ""} · ${r.notes} notes · ${r.source}`); ctx.rerender(); }
    else ctx.setEcho("nothing to fit — draw a phrase below first");
  }));
  box.appendChild(head);

  if (!w || !w.slot) {
    box.appendChild(el("p", "dw-pnote", "no weave table."));
    host.appendChild(box);
    return;
  }

  // brush mode as chips — shift-click still weakens, but a thumb has no shift key
  let dir = 1;
  const modeRow = el("div", "dw-edrow");
  modeRow.appendChild(el("span", "dw-edlab", "brush"));
  ctx.controls.makeChips(modeRow, {
    hue: ctx.hue,
    options: [{ id: "up", label: "strengthen" }, { id: "down", label: "weaken" }],
    value: "up",
    onPick: (id) => { dir = id === "up" ? 1 : -1; },
  });
  box.appendChild(modeRow);

  const g = el("div", "dw-matrix");
  g.style.setProperty("--hue", ctx.hue);
  g.appendChild(el("span", "dw-glabel", "from \\ to"));
  for (let c = 0; c < WEAVE.SLOTS; c++) g.appendChild(el("span", "dw-mhead", WEAVE.slotLabel(c)));
  const mcells = [];                                       // [row][col] -> button
  for (let r = 0; r < WEAVE.SLOTS; r++) {
    g.appendChild(el("span", "dw-glabel", WEAVE.slotLabel(r)));
    mcells[r] = [];
    for (let c = 0; c < WEAVE.SLOTS; c++) {
      const b = el("button", "dw-mcell");
      b.type = "button";
      b.addEventListener("click", (e) => {
        WEAVE.nudge(name, r, c, e.shiftKey ? -1 : dir);
        paintMatrix();
        const p2 = (WEAVE.weaveOf(name).slot[r] || [])[c] || 0;
        ctx.setEcho(`${WEAVE.slotLabel(r)} → ${WEAVE.slotLabel(c)} · ${Math.round(p2 * 100)}%`);
      });
      mcells[r][c] = b;
      g.appendChild(b);
    }
  }
  const factsEl = el("p", "dw-pnote", "");
  function paintMatrix() {
    const cur = WEAVE.weaveOf(name);
    if (!cur || !cur.slot) return;
    for (let r = 0; r < WEAVE.SLOTS; r++)
      for (let c = 0; c < WEAVE.SLOTS; c++) {
        const p = (cur.slot[r] && cur.slot[r][c]) || 0;
        const b = mcells[r][c];
        b.style.setProperty("--p", p.toFixed(3));
        b.title = `${WEAVE.slotLabel(r)} → ${WEAVE.slotLabel(c)}: ${Math.round(p * 100)}%`;
        b.setAttribute("aria-label", b.title);
      }
    factsEl.textContent =
      `legato ${cur.legato} · step ${cur.step}` +
      (cur._fit ? ` · fitted from ${cur._fit.phrases} phrase(s), ${cur._fit.notes} notes` : "") +
      " — rows are where the line IS, columns where it goes next. This is a generator, not a melody: " +
      "same table, different tune every seed. Brush toward the diagonal for stepwise motion, toward the corners for leaps.";
  }
  paintMatrix();
  box.appendChild(g);
  box.appendChild(factsEl);
  host.appendChild(box);

  // THE SCRATCH GRID — the examples FIT fits from. Inert as vocabulary: nothing
  // can ever play `__fit` (machines/weave.js SCRATCH).
  cellEditor(host, ctx, WEAVE.SCRATCH, "example phrase — draw here, then FIT");
}

// ---------- the wander machine (gait chips + walk tiles) ----------
function wanderBlock(host, ctx) {
  const runs = MELODY.wanderSections();
  const box = el("div", "dw-ed");
  const head = el("div", "dw-edhead", "wander — the walk");
  if (MELODY.isEdited()) {
    head.appendChild(el("span", "dw-badge", "edited"));
    head.appendChild(mini("revert", "back to the engine's own constants", () => { MELODY.revert(); ctx.rerender(); }));
  }
  box.appendChild(head);

  // GAIT — the rhythm pool as named characters; a choice, not an amount
  const grow = el("div", "dw-edrow");
  grow.appendChild(el("span", "dw-edlab", "gait"));
  const cur = MELODY.gaitOf(MELODY.current());
  const opts = MELODY.GAITS.map((g) => ({ id: g.id, label: g.label, title: "[" + g.pool.join(" ") + "]" }));
  if (cur === "custom") opts.push({ id: "custom", label: "custom" });
  ctx.controls.makeChips(grow, {
    hue: ctx.hue, options: opts, value: cur,
    onPick: (id) => { if (id !== "custom") MELODY.setGait(id); },
  });
  box.appendChild(grow);

  // the four walk knobs as TILES, real units via each knob's own fmt
  const tiles = el("div", "dw-tiles");
  for (const K of MELODY.KNOBS) {
    const to01 = (real) => Math.max(0, Math.min(1, (real - K.min) / (K.max - K.min)));
    const from01 = (v) => {
      const real = K.min + Math.max(0, Math.min(1, v)) * (K.max - K.min);
      return K.step >= 1 ? Math.round(real) : +real.toFixed(3);
    };
    ctx.controls.makeTile(tiles, {
      label: K.label, unit: "", hue: ctx.hue,
      read: () => {
        const g = MELODY.current();
        const patch = ctx.song.SONG.patch.melodyGen || null;
        return { v: to01(g[K.id]), txt: K.fmt(g[K.id]), stock: !(patch && K.id in patch) };
      },
      write: (v) => MELODY.setKnob(K.id, from01(v)),
      revert: () => MELODY.setKnob(K.id, MELODY.DEFAULTS[K.id]),
      onDrag: (v, txt) => ctx.setEcho(K.label + " · " + txt),
    });
  }
  box.appendChild(tiles);

  box.appendChild(el("p", "dw-pnote", runs.length
    ? `these knobs shape the WALK, not the notes — they survive a change of seed, tempo or form. This form runs wander in: ${runs.join(", ")}.`
    : "nothing in this form runs the wander generator, so these knobs will not change what you hear — " +
      "set a section's melody to “wander” in the section sheet, or try a genre that uses it."));
  host.appendChild(box);
}
