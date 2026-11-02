// THE PHRASE TOOL — a phrase's notes on a grid of steps (across) by rows (down).
// Generic: the page hands it the rows (a pitched member's steps over the chord;
// the drummer's lanes) and the notes, and hears back every change. It never
// rebuilds itself while the band plays: the playhead is one absolutely
// positioned line moved by setPlayhead().
//
// "The smallest possible tool for writing phrases, and quite powerful" (Paul,
// 2026-11-02). Two tools and a rule:
//
//   PENCIL (draw)
//     tap an empty cell ........ a note there, one step long (the drummer: a hit)
//     drag from it .............. a line: a note on every step the pointer crosses,
//                                 at the row it is over (a run, a hat line)
//     tap a note ................ it goes
//     drag a note's body ........ moved (in time and pitch)
//     drag a note's right edge .. its length
//     shift-tap a note .......... accent — louder
//     alt-tap a note ............ broken up on the grid (as the scissors)
//   THE GRID (Paul, 2026-11-02: "if I'm on a quarter-note grid I enter quarter
//     notes by default"): a tap puts in a note the grid's length on its line,
//     a drag draws them a grid apart, a move lands on it, a stretch goes by
//     it, the scissors cut by it. Notes written finer stay where they are.
//   SCISSORS (split)
//     tap a note ................ broken into one-step notes on the grid
//   THE SHADOW
//     under the phrase, what the band actually plays from it in a section —
//     the transformation applied, at the timing it is heard — so a change to
//     either is seen before it is heard. Not touchable.
//   THE BAND, UNDER IT (Paul, 2026-11-02: "I need to SEE the melody to
//     harmonize"): the other members' notes in the same bars, outlined in
//     their colours (setLayers), and their rhythm as ticks along the top
//     (setRhythm) — what this phrase answers, melodically and rhythmically.
//   MONO (a melodic phrase is one line: one note on a step)
//     a note moved, stretched or drawn over another takes its place — the
//     covered note goes away. A drummer's lanes are a kit, so they stack.

const ROW_H = 18, LABEL_W = 46, RH = 9;      // RH: a rhythm row's height, along the top
// TWO BARS A SCREEN (Paul, 2026-11-02: "make it possible to edit two bars per
// screen"): a step is as wide as two bars across the roll allow, never narrower
// than MIN_W; a longer phrase scrolls, two bars at a time.
const MIN_W = 14, DEF_W = 34;

export class Roll {
  constructor(host, { onChange, onAudition } = {}) {
    this.host = host;
    this.onChange = onChange || (() => {});
    this.onAudition = onAudition || (() => {});
    this.el = document.createElement("div");
    this.el.className = "roll";
    host.replaceChildren(this.el);
    this.rows = []; this.notes = []; this.steps = 16; this.beat = 4; this.bar = 16;
    this.color = "#fff"; this.drum = false; this.shadow = [];
    this.layers = []; this.rhythm = []; this.top = 0;
    this.tool = "draw";
    this.snap = 1;                          // the grid, in steps (1 = a sixteenth)
    this.cellW = DEF_W;
    if (window.ResizeObserver) new ResizeObserver(() => { if (this.rows.length && this.fit()) this.render(); }).observe(this.el);
    this.drag = null;
    this.el.addEventListener("pointerdown", e => this.down(e));
    window.addEventListener("pointermove", e => this.move(e));
    window.addEventListener("pointerup", e => this.up(e));
  }

  // a melodic phrase is mono; the kit's lanes stack
  get mono() { return !this.drum; }
  setTool(t) { this.tool = t === "split" ? "split" : "draw"; this.el.dataset.tool = this.tool; }

  // rows: [{ key, label, scale: bool, tonic: bool }], top to bottom
  set({ rows, notes, steps, beat, bar, color, drum }) {
    this.rows = rows; this.notes = notes.map(n => ({ ...n }));
    this.steps = steps; this.beat = beat || 4; this.bar = bar || 16;
    this.color = color || this.color; this.drum = !!drum;
    this.el.dataset.tool = this.tool;
    this.render();
  }

  // the shadow: [{ at (fractional steps), len, row }], drawn under the notes
  setShadow(notes) {
    this.shadow = notes || [];
    if (!this.grid) return;
    this.grid.querySelectorAll(".roll-ghost").forEach((g) => g.remove());
    this.grid.insertAdjacentHTML("afterbegin", this.ghosts());
  }
  // others' notes: [{ color, notes: [{ at, len, row }] }]; others' onsets: [{ color, hits: [{ at, v }] }]
  setLayers(layers) { this.layers = layers || []; this.paintBand(); }
  setRhythm(rows) {
    const was = this.rhythm.length;
    this.rhythm = rows || [];
    if (this.rhythm.length !== was) this.render(); else this.paintBand();
  }
  paintBand() {
    if (!this.grid) return;
    this.grid.querySelectorAll(".roll-layer, .roll-tick").forEach((g) => g.remove());
    this.grid.insertAdjacentHTML("afterbegin", this.band());
  }
  band() {
    let html = "";
    for (const L of this.layers) for (const n of L.notes) {
      const r = this.rowIndex(n.row);
      if (r < 0 || n.at >= this.steps || n.at + n.len <= 0) continue;
      const at = Math.max(0, n.at), len = Math.min(n.len, this.steps - at);
      html += `<div class="roll-layer" style="--lc:${L.color};left:${(LABEL_W + at * this.cellW).toFixed(1)}px;top:${this.top + r * ROW_H + 3}px;width:${Math.max(3, len * this.cellW).toFixed(1)}px;height:${ROW_H - 6}px"></div>`;
    }
    this.rhythm.forEach((R, k) => {
      for (const h of R.hits) {
        if (h.at < 0 || h.at >= this.steps) continue;
        const tall = Math.max(2, Math.round(RH * (0.45 + 0.55 * (h.v == null ? 1 : h.v))));
        html += `<div class="roll-tick" style="background:${R.color};left:${(LABEL_W + h.at * this.cellW).toFixed(1)}px;top:${k * RH + RH - tall}px;height:${tall}px;width:${Math.max(2, Math.min(this.cellW * 0.45, 6)).toFixed(1)}px"></div>`;
      }
    });
    return html;
  }
  ghosts() {
    let html = "";
    for (const n of this.shadow) {
      const r = this.rowIndex(n.row);
      if (r < 0 || n.at >= this.steps || n.at + n.len <= 0) continue;
      const at = Math.max(0, n.at), len = Math.min(n.len, this.steps - at);
      html += `<div class="roll-ghost" style="left:${(LABEL_W + at * this.cellW + 1).toFixed(1)}px;top:${this.top + r * ROW_H + 1}px;width:${Math.max(4, len * this.cellW - 2).toFixed(1)}px;height:${ROW_H - 2}px"></div>`;
    }
    return html;
  }

  setSnap(n) { this.snap = Math.max(1, n | 0); if (this.rows.length) this.render(); }
  // the grid line at or before a step
  q(step) { return Math.floor(step / this.snap) * this.snap; }

  rowIndex(key) { return this.rows.findIndex(r => r.key === key); }

  // the step width that puts two bars across the roll; true if it changed
  fit() {
    const w = this.el.clientWidth;
    if (!w) return false;
    const cw = Math.max(MIN_W, Math.floor((w - LABEL_W - 2) / Math.max(1, Math.min(this.steps, this.bar * 2))));
    if (cw === this.cellW) return false;
    this.cellW = cw;
    return true;
  }
  // every note gone (the clear button)
  clearAll() { this.notes = []; this.commit(); }

  render() {
    this.fit();
    const CELL_W = this.cellW;
    this.top = this.rhythm.length ? this.rhythm.length * RH + 3 : 0;
    const T = this.top;
    const W = this.steps * CELL_W, H = this.rows.length * ROW_H + T;
    const grid = document.createElement("div");
    grid.className = "roll-grid";
    grid.style.width = (LABEL_W + W) + "px";
    grid.style.height = H + "px";
    grid.style.setProperty("--c", this.color);
    let html = "";
    this.rows.forEach((r, i) => {
      html += `<div class="roll-row${r.scale ? " in" : ""}${r.tonic ? " tonic" : ""}${r.black ? " black" : ""}" style="top:${T + i * ROW_H}px;height:${ROW_H}px;width:${LABEL_W + W}px">`
        + `<span class="roll-label" style="width:${LABEL_W}px">${r.label}</span></div>`;
    });
    for (let s = 0; s <= this.steps; s++) {
      const cls = s % this.bar === 0 ? "bar" : s % this.beat === 0 ? "beat" : s % this.snap === 0 ? "step" : "sub";
      html += `<div class="roll-v ${cls}" style="left:${LABEL_W + s * CELL_W}px;height:${H}px"></div>`;
    }
    if (T) html += `<div class="roll-band" style="width:${LABEL_W + W}px;height:${T}px"></div>`;
    html += this.band();
    html += this.ghosts();
    this.notes.forEach((n, i) => {
      const r = this.rowIndex(n.row);
      if (r < 0) return;
      const len = Math.max(1, Math.min(n.len || 1, this.steps - n.at));
      html += `<div class="roll-note${n.acc ? " acc" : ""}${len > 1 ? " held" : ""}" data-i="${i}" style="left:${LABEL_W + n.at * CELL_W + 1}px;top:${T + r * ROW_H + 1}px;width:${len * CELL_W - 2}px;height:${ROW_H - 2}px">`
        + (this.drum ? "" : `<span class="roll-edge" data-edge="${i}"></span>`) + `</div>`;
    });
    html += `<div class="roll-head" style="left:${LABEL_W}px;height:${H}px;display:none"></div>`;
    grid.innerHTML = html;
    this.grid = grid;
    this.head = grid.querySelector(".roll-head");
    const keepX = this.el.scrollLeft, keepY = this.el.scrollTop;
    this.el.replaceChildren(grid);
    this.el.scrollLeft = keepX; this.el.scrollTop = keepY;
  }

  // the step sounding, or -1 (fractional steps glide)
  setPlayhead(step) {
    if (!this.head) return;
    if (step < 0 || step >= this.steps) { this.head.style.display = "none"; return; }
    this.head.style.display = "";
    this.head.style.transform = `translateX(${step * this.cellW}px)`;
    // a phrase longer than the screen: the view turns the page with the
    // playhead, two bars at a time (not while a note is in hand)
    if (this.drag) return;
    const x = LABEL_W + step * this.cellW, view = this.el.clientWidth - LABEL_W;
    if (x < this.el.scrollLeft + LABEL_W || x > this.el.scrollLeft + this.el.clientWidth - 4) {
      const page = Math.max(1, Math.floor(view / this.cellW));
      this.el.scrollLeft = Math.floor(step / page) * page * this.cellW;
    }
  }

  // centre the scroll on a row key (the phrase's notes or the root)
  scrollToRow(key) {
    const r = this.rowIndex(key);
    if (r >= 0) this.el.scrollTop = Math.max(0, r * ROW_H - this.el.clientHeight / 2);
  }

  at(e) {
    const b = this.grid.getBoundingClientRect();
    const x = e.clientX - b.left - LABEL_W, y = e.clientY - b.top - this.top;
    return { step: Math.floor(x / this.cellW), fx: x / this.cellW, row: Math.floor(y / ROW_H) };
  }

  // MONO: `keep` stays and every other note on the steps it covers goes (a
  // note that started earlier and is held into it is cut short instead)
  clear(keep) {
    if (!this.mono) return;
    const a = keep.at, b = keep.at + (keep.len || 1);
    this.notes = this.notes.filter(n => n === keep || !(n.at >= a && n.at < b));
    for (const n of this.notes) if (n !== keep && n.at < a && n.at + n.len > a) n.len = a - n.at;
  }
  // the scissors: a held note into one-step notes on the grid
  split(n) {
    if (!n || (n.len || 1) < 2) return false;
    const i = this.notes.indexOf(n);
    const parts = [];
    const cut = n.len > this.snap ? this.snap : 1;    // by the grid; a note no longer than it, to steps
    for (let k = 0; k < n.len; k += cut) parts.push({ at: n.at + k, len: Math.min(cut, n.len - k), row: n.row, acc: k === 0 ? n.acc : 0 });
    this.notes.splice(i, 1, ...parts);
    return true;
  }

  down(e) {
    if (!this.grid || e.button > 0) return;
    const p = this.at(e);
    if (p.row < 0 || p.row >= this.rows.length || p.step < 0 || p.step >= this.steps) return;
    e.preventDefault();
    const edge = e.target.closest("[data-edge]");
    const noteEl = e.target.closest(".roll-note");
    if (noteEl && (this.tool === "split" || e.altKey)) {
      if (this.split(this.notes[+noteEl.dataset.i])) this.commit();
      return;
    }
    if (edge && this.tool === "draw") {
      this.drag = { kind: "len", i: +edge.dataset.edge, moved: false };
    } else if (noteEl) {
      const i = +noteEl.dataset.i, n = this.notes[i];
      if (e.shiftKey) { n.acc = n.acc ? 0 : 1; this.commit(); return; }
      this.drag = { kind: "move", i, moved: false, d0: p.fx - n.at, r0: this.rowIndex(n.row) };
    } else {
      if (this.tool === "split") return;
      const row = this.rows[p.row].key;
      const at = this.q(p.step), len = this.drum ? 1 : Math.min(this.snap, this.steps - at);
      const n = { at, len, row, acc: 0 };
      this.notes.push(n);
      this.clear(n);
      this.drag = { kind: "paint", n, last: at, moved: true };
      this.onAudition(row);
      this.render();
    }
    // (capture is a nicety — moves and the release are heard on window anyway —
    // and it throws when the pointer is already gone: a tap must not depend on it)
    try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* moves still reach window */ }
  }

  move(e) {
    if (!this.drag) return;
    const p = this.at(e);
    if (this.drag.kind === "paint") {
      // a line: every step crossed since the last one gets a note at this row
      const ri = Math.max(0, Math.min(this.rows.length - 1, p.row));
      const step = this.q(Math.max(0, Math.min(this.steps - 1, p.step)));
      if (step === this.drag.last) return;
      const g = this.snap, dir = step > this.drag.last ? g : -g, row = this.rows[ri].key;
      for (let s = this.drag.last + dir; dir > 0 ? s <= step : s >= step; s += dir) {
        if (this.notes.some(n => n.at === s && n.row === row)) continue;
        const n = { at: s, len: this.drum ? 1 : Math.min(g, this.steps - s), row, acc: 0 };
        this.notes.push(n);
        this.clear(n);
      }
      this.drag.last = step;
      this.render();
      return;
    }
    const n = this.notes[this.drag.i];
    if (!n) return;
    if (this.drag.kind === "len") {
      // the end goes by the grid: onto its lines, however finely the note starts
      const end = Math.ceil(p.fx / this.snap) * this.snap;
      const len = Math.max(1, Math.min(this.steps - n.at, end - n.at));
      if (len !== n.len) { n.len = len; this.clear(n); this.drag.i = this.notes.indexOf(n); this.drag.moved = true; this.render(); }
    } else if (this.drag.kind === "move") {
      const at = Math.max(0, Math.min(this.steps - 1, Math.round((p.fx - this.drag.d0) / this.snap) * this.snap));
      const ri = Math.max(0, Math.min(this.rows.length - 1, p.row));
      const row = this.rows[ri].key;
      if (at !== n.at || row !== n.row) {
        if (row !== n.row) this.onAudition(row);
        n.at = at; n.row = row; this.drag.moved = true; this.render();
      }
    }
  }

  up() {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (d.kind === "move" && !d.moved) this.notes.splice(d.i, 1); // a tap on a note: it goes
    else if (d.kind === "move") this.clear(this.notes[d.i]);      // mono: what it lands on goes
    // two notes on one cell and row: one
    const seen = new Set();
    this.notes = this.notes.filter(n => {
      const k = n.at + ":" + n.row;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    this.commit();
  }

  commit() {
    this.notes.sort((a, b) => a.at - b.at);
    this.render();
    this.onChange(this.notes.map(n => ({ ...n })));
  }
}
