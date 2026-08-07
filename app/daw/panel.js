// panel.js — the MACHINE PANEL: open a track, see the machine that writes it.
//
// One panel shell, dispatching per track kind. The drums panel is the first real
// one because the engine's kit op grammar is already a variation language, so the
// panel is a UI over shipped data rather than a new system (machines/drums.js).
// The pitched tracks show a read-only machine summary until their own machines
// land (melodyGen -> melodyCells -> melodyWeave, then the bass op table).
//
// Every control writes through song.js edit(), which invalidates the build and
// repaints. Because state.voiceStreams is on, moving a probability slider here
// changes THIS lane and leaves the neighbouring rolls pixel-identical — which is
// the visible proof the rack law works, and the reason these sliders are safe to
// expose at all (every one of them changes a draw count).
import { SONG, state, trackMachines } from "./song.js";
import * as DRUMS from "./machines/drums.js";
import * as MELODY from "./machines/melody.js";
import * as CELLS from "./machines/cells.js";
import * as WEAVE from "./machines/weave.js";

const open = new Set();          // track ids whose panel is open
export const isOpen = (id) => open.has(id);
export function toggle(id) { open.has(id) ? open.delete(id) : open.add(id); }

const el = (tag, cls, txt) => { const d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; };

export function renderPanel(host, track) {
  host.textContent = "";
  if (!open.has(track.id)) { host.hidden = true; return; }
  host.hidden = false;
  if (track.kind === "drums") return drumsPanel(host);
  if (track.id === "melody") return melodyPanel(host, track);
  return readOnlyPanel(host, track);
}

// ---------- the kit machine ----------
function drumsPanel(host) {
  const kits = DRUMS.activeKits();
  if (!kits.length) { host.appendChild(el("p", "dw-pnote", "This song's form never turns the drums on.")); return; }

  for (const name of kits) {
    const kit = DRUMS.kitOf(name);
    const box = el("div", "dw-kit");
    const head = el("div", "dw-kithead");
    head.appendChild(el("span", "dw-kitname", name));
    if (DRUMS.isEdited(name)) {
      head.appendChild(el("span", "dw-badge", "edited"));
      const rev = el("button", "dw-mini", "revert");
      rev.title = "drop this song's override and play the stock kit again";
      rev.addEventListener("click", () => DRUMS.revert(name));
      head.appendChild(rev);
    }
    box.appendChild(head);

    if (!kit || !kit.ops || !kit.ops.length) {
      box.appendChild(el("p", "dw-pnote", "No ops — this kit is silence."));
      host.appendChild(box); continue;
    }

    for (let i = 0; i < kit.ops.length; i++) {
      const op = kit.ops[i], d = DRUMS.describeOp(op);
      const row = el("div", "dw-op");
      row.appendChild(el("span", "dw-oplane", d.lane));
      row.appendChild(el("span", "dw-opshape", d.shape));

      // PERIOD — the cycle-position rule (hits / alt / cyc / last)
      const per = document.createElement("select");
      per.className = "dw-opsel";
      per.disabled = !d.editable || !!op.grid;
      for (const p of [["hits", "every bar"], ["alt", "A / B"], ["cyc", "cycle of 4"], ["last", "last bar"]]) {
        const o = document.createElement("option"); o.value = p[0]; o.textContent = p[1];
        per.appendChild(o);
      }
      per.value = DRUMS.periodOf(op);
      per.title = "how this lane varies across the chord bars of a cycle";
      per.addEventListener("change", (e) => DRUMS.setPeriod(name, i, e.target.value));
      row.appendChild(per);

      // PROBABILITY — `p` (one draw per op) or `grid.sp` (one draw per step)
      const prob = DRUMS.probOf(op);
      const sl = document.createElement("input");
      sl.type = "range"; sl.min = "0"; sl.max = "1"; sl.step = "0.05";
      sl.value = String(prob); sl.className = "dw-opslider";
      sl.disabled = !d.editable;
      sl.title = op.grid ? "per-step chance this grid lane fires (grid.sp)" : "chance this whole op fires each bar (p)";
      sl.setAttribute("aria-label", `${d.lane} probability`);
      const val = el("span", "dw-opval", prob >= 0.999 ? "always" : Math.round(prob * 100) + "%");
      sl.addEventListener("input", (e) => { const v = +e.target.value; val.textContent = v >= 0.999 ? "always" : Math.round(v * 100) + "%"; });
      sl.addEventListener("change", (e) => DRUMS.setProb(name, i, +e.target.value));
      row.appendChild(sl); row.appendChild(val);

      box.appendChild(row);
    }
    host.appendChild(box);
  }
  host.appendChild(el("p", "dw-pnote",
    "Probability and period are RULES, not edits to a bar — they survive a change of seed, tempo or form. " +
    "Moving one lane leaves the other rolls untouched (state.voiceStreams)."));
}

// ---------- the melody machines ----------
// A form can run several melody patterns across its sections, and they are not
// all the same KIND of machine: `wander` is a walk with knobs, a shipped phrase
// cell is a drawable contour, and the procedural ones (fugue/motorik/canon) are
// code rather than data. Show the right machine for each, and say plainly which
// is which — an editor offered for something it cannot reach is worse than none.
function melodyPanel(host, track) {
  for (const name of CELLS.melodyPatterns()) {
    if (name === "wander") continue;                       // the knobs, below
    if (WEAVE.isWeave(name)) weaveEditor(host, name);
    else if (CELLS.isCell(name)) cellEditor(host, name);
    else host.appendChild(el("p", "dw-pnote",
      `“${name}” is a procedural generator (code, not a phrase table), so there is nothing to draw. ` +
      `Its shape lives in csd-engine's melodyEvents.`));
  }
  wanderMachine(host, track);
}

// ---------- the weave machine ----------
// A weave is the DISTRIBUTION a phrase is drawn from, so the editor is a matrix,
// not a grid of notes: row = the slot the line is on, column = where it goes next.
// Click to strengthen a move, shift-click to weaken it — brush toward the diagonal
// for stepwise motion, toward the corners for leaps. And FIT turns the phrases you
// drew into exactly this table (machines/weave.js) — the loop this DAW is for.
function weaveEditor(host, name) {
  const w = WEAVE.weaveOf(name);
  const box = el("div", "dw-kit");
  const head = el("div", "dw-kithead");
  head.appendChild(el("span", "dw-kitname", name + " — weave"));
  if (WEAVE.isEdited(name)) {
    head.appendChild(el("span", "dw-badge", "edited"));
    const rev = el("button", "dw-mini", "revert");
    rev.title = "back to the mined organ";
    rev.addEventListener("click", () => WEAVE.revert(name));
    head.appendChild(rev);
  }
  const fitb = el("button", "dw-mini", "fit from my phrases");
  fitb.title = "fit this generator from the phrases you have drawn";
  fitb.addEventListener("click", () => { if (!WEAVE.fitFromSong(name)) fitb.textContent = "nothing to fit"; });
  head.appendChild(fitb);
  box.appendChild(head);

  if (!w || !w.slot) { box.appendChild(el("p", "dw-pnote", "No weave table.")); host.appendChild(box); return; }

  const g = el("div", "dw-matrix");
  g.appendChild(el("span", "dw-glabel", "from \\ to"));
  for (let c = 0; c < WEAVE.SLOTS; c++) g.appendChild(el("span", "dw-mhead", WEAVE.slotLabel(c)));
  for (let r = 0; r < WEAVE.SLOTS; r++) {
    g.appendChild(el("span", "dw-glabel", WEAVE.slotLabel(r)));
    for (let c = 0; c < WEAVE.SLOTS; c++) {
      const p = (w.slot[r] && w.slot[r][c]) || 0;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dw-mcell";
      b.style.setProperty("--p", p.toFixed(3));
      b.title = `${WEAVE.slotLabel(r)} → ${WEAVE.slotLabel(c)}: ${Math.round(p * 100)}% (click strengthens, shift-click weakens)`;
      b.setAttribute("aria-label", b.title);
      b.addEventListener("click", (e) => WEAVE.nudge(name, r, c, e.shiftKey ? -1 : 1));
      g.appendChild(b);
    }
  }
  box.appendChild(g);
  box.appendChild(el("p", "dw-pnote",
    `legato ${w.legato} · step ${w.step}` + (w._fit ? ` · fitted from ${w._fit.phrases} phrase(s), ${w._fit.notes} notes` : "") +
    " — rows are where the line IS, columns where it goes next. This is a generator, not a melody: " +
    "same table, different tune every seed."));
  host.appendChild(box);

  // THE SCRATCH GRID. A weave-driven form has no phrase of its own to fit from,
  // so the loop needs somewhere to draw the examples: draw a phrase here, press
  // FIT, and the table above becomes the distribution that phrase came from.
  // Inert as vocabulary — nothing can ever play `__fit` (machines/weave.js).
  cellEditor(host, WEAVE.SCRATCH, "example phrase — draw here, then FIT");
}

// ---------- the phrase editor ----------
function cellEditor(host, name, titleOverride) {
  const cell = CELLS.cellOf(name) || [], nCols = CELLS.cols(), grid = CELLS.toGrid(cell);
  const box = el("div", "dw-kit");
  const head = el("div", "dw-kithead");
  head.appendChild(el("span", "dw-kitname", titleOverride || (name + " — phrase")));
  if (CELLS.isEdited(name)) {
    head.appendChild(el("span", "dw-badge", "edited"));
    const rev = el("button", "dw-mini", "revert");
    rev.title = "back to the shipped phrase";
    rev.addEventListener("click", () => CELLS.revert(name));
    head.appendChild(rev);
  }
  const clr = el("button", "dw-mini", "clear");
  clr.title = "empty the phrase and start from silence";
  clr.addEventListener("click", () => CELLS.clear(name));
  head.appendChild(clr);
  box.appendChild(head);

  const g = el("div", "dw-grid");
  g.style.setProperty("--cols", nCols);
  for (let r = 0; r < CELLS.ROWS.length; r++) {
    g.appendChild(el("span", "dw-glabel", CELLS.rowLabel(CELLS.ROWS[r])));
    for (let c = 0; c < nCols; c++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dw-cell" + (grid.has(c + ":" + r) ? " on" : "") + (c % 4 === 0 ? " beat" : "");
      b.dataset.c = c; b.dataset.r = r;
      b.title = `beat ${(c * CELLS.STEP).toFixed(2)} · ${CELLS.rowLabel(CELLS.ROWS[r])}`;
      b.setAttribute("aria-label", b.title);
      b.setAttribute("aria-pressed", grid.has(c + ":" + r) ? "true" : "false");
      b.addEventListener("click", () => CELLS.toggle(name, c, r));
      g.appendChild(b);
    }
  }
  box.appendChild(g);
  box.appendChild(el("p", "dw-pnote",
    "The vertical axis is the CHORD'S OWN VOICING — root / 3rd / 5th / top, and the same again an octave up — " +
    "not a keyboard. So what you draw is a contour in chord tones: it follows the harmony, transposes with the key, " +
    "and survives reharmonisation. Each note holds until the next one starts."));
  host.appendChild(box);
}

// ---------- the wander machine ----------
function wanderMachine(host, track) {
  const gen = MELODY.current(), runs = MELODY.wanderSections();
  const box = el("div", "dw-kit");
  const head = el("div", "dw-kithead");
  head.appendChild(el("span", "dw-kitname", "wander — the walk"));
  if (MELODY.isEdited()) {
    head.appendChild(el("span", "dw-badge", "edited"));
    const rev = el("button", "dw-mini", "revert");
    rev.title = "back to the engine's own constants";
    rev.addEventListener("click", () => MELODY.revert());
    head.appendChild(rev);
  }
  box.appendChild(head);

  // GAIT — the rhythm pool, as named characters rather than an array editor
  const grow = el("div", "dw-op");
  grow.appendChild(el("span", "dw-oplane", "gait"));
  grow.appendChild(el("span", "dw-opshape", "[" + gen.rhythm.join(" ") + "]"));
  const gsel = document.createElement("select");
  gsel.className = "dw-opsel";
  for (const g of MELODY.GAITS) { const o = document.createElement("option"); o.value = g.id; o.textContent = g.label; gsel.appendChild(o); }
  const cur = MELODY.gaitOf(gen);
  if (cur === "custom") { const o = document.createElement("option"); o.value = "custom"; o.textContent = "custom"; gsel.appendChild(o); }
  gsel.value = cur;
  gsel.title = "the note-length pool the walk cycles through — the phrase's gait";
  gsel.addEventListener("change", (e) => MELODY.setGait(e.target.value));
  grow.appendChild(gsel);
  grow.appendChild(el("span", "", ""));
  grow.appendChild(el("span", "dw-opval", gen.rhythm.length + " step" + (gen.rhythm.length === 1 ? "" : "s")));
  box.appendChild(grow);

  for (const k of MELODY.KNOBS) {
    const row = el("div", "dw-op");
    row.appendChild(el("span", "dw-oplane", k.label));
    row.appendChild(el("span", "dw-opshape", ""));
    row.appendChild(el("span", "", ""));
    const sl = document.createElement("input");
    sl.type = "range"; sl.min = String(k.min); sl.max = String(k.max); sl.step = String(k.step);
    sl.value = String(gen[k.id]); sl.className = "dw-opslider";
    sl.title = k.doc; sl.setAttribute("aria-label", k.label);
    sl.dataset.knob = k.id;
    const val = el("span", "dw-opval", k.fmt(gen[k.id]));
    sl.addEventListener("input", (e) => { val.textContent = k.fmt(+e.target.value); });
    sl.addEventListener("change", (e) => MELODY.setKnob(k.id, +e.target.value));
    row.appendChild(sl); row.appendChild(val);
    box.appendChild(row);
  }
  host.appendChild(box);

  host.appendChild(el("p", "dw-pnote", runs.length
    ? `These knobs shape the WALK, not the notes — they survive a change of seed, tempo or form. This form runs wander in: ${runs.join(", ")}.`
    : "Nothing in this form runs the wander generator, so these knobs will not change what you hear — " +
      "set a section's melody to `wander`, or try a genre that uses it. Drawing actual phrases is the next machine (melodyCells)."));
}

// ---------- read-only, until each machine lands ----------
function readOnlyPanel(host, track) {
  const s = state(), machines = trackMachines(track);
  const box = el("div", "dw-kit");
  box.appendChild(el("div", "dw-kithead", machines.length ? machines.join(" → ") : "off"));
  const dl = el("dl", "dw-facts");
  const fact = (k, v) => { dl.appendChild(el("dt", null, k)); dl.appendChild(el("dd", null, String(v))); };
  fact("voice", track.id);
  if (track.id === "melody") {
    fact("chord bar", (s.chordEvery || (s.meter ? 6 : 8)) + " beats");
    fact("reharm", s.theory && s.theory.reharm ? "on (adventure " + (s.theory.adventure ?? "—") + ")" : "off");
    fact("tables", (s.theory && s.theory.tables) || "hand");
  }
  if (track.id === "bass") fact("rhythm complexity", s.rhythm ? (s.rhythm.complexity ?? 0) : "—");
  if (track.id === "pad") fact("strum", s.strum ? (typeof s.strum === "string" ? s.strum : s.strum.pattern) : "off");
  fact("time feel", `swing ${s.swing ?? 0} · humanize ${s.humanize ?? 0}`);
  fact("pipes", (s.pipes || []).map((p) => p.id).join(", ") || "none");
  box.appendChild(dl);
  host.appendChild(box);
  host.appendChild(el("p", "dw-pnote",
    "Read-only for now. This track's machines are next in docs/DAW.md — " +
    (track.id === "bass"
      ? "the bass cells are still a switch over 23 procedural cases; they get the same op-table treatment the kits already had."
      : "melodyGen (the walk's knobs), then melodyCells (draw phrases), then melodyWeave (paint the Markov table).")));
}
