// THE PIANO ROLL — a motif's notes on a grid of steps (across) by rows (down).
// Generic: the page hands it the rows (a pitched member's semitones, the scale
// lit and the tonic marked; the drummer's lanes) and the notes, and hears back
// every change. It never rebuilds itself while the band plays: the playhead
// is one absolutely positioned line moved by setPlayhead().
//
//   tap an empty cell ........ a note there, one step long (the drummer: a hit)
//   drag from it, sideways ... the note that long
//   tap a note ............... it goes
//   drag a note's body ....... moved (in time and pitch)
//   drag a note's right edge . its length
//   shift-tap a note ......... accent (the drummer) — louder

const CELL_W = 34, ROW_H = 18, LABEL_W = 46;

export class Roll {
  constructor(host, { onChange, onAudition } = {}) {
    this.host = host;
    this.onChange = onChange || (() => {});
    this.onAudition = onAudition || (() => {});
    this.el = document.createElement("div");
    this.el.className = "roll";
    host.replaceChildren(this.el);
    this.rows = []; this.notes = []; this.steps = 16; this.beat = 4; this.bar = 16;
    this.color = "#fff"; this.drum = false;
    this.drag = null;
    this.el.addEventListener("pointerdown", e => this.down(e));
    window.addEventListener("pointermove", e => this.move(e));
    window.addEventListener("pointerup", e => this.up(e));
  }

  // rows: [{ key, label, scale: bool, tonic: bool }], top to bottom
  set({ rows, notes, steps, beat, bar, color, drum }) {
    this.rows = rows; this.notes = notes.map(n => ({ ...n }));
    this.steps = steps; this.beat = beat || 4; this.bar = bar || 16;
    this.color = color || this.color; this.drum = !!drum;
    this.render();
  }

  rowIndex(key) { return this.rows.findIndex(r => r.key === key); }

  render() {
    const W = this.steps * CELL_W, H = this.rows.length * ROW_H;
    const grid = document.createElement("div");
    grid.className = "roll-grid";
    grid.style.width = (LABEL_W + W) + "px";
    grid.style.height = H + "px";
    grid.style.setProperty("--c", this.color);
    let html = "";
    this.rows.forEach((r, i) => {
      html += `<div class="roll-row${r.scale ? " in" : ""}${r.tonic ? " tonic" : ""}${r.black ? " black" : ""}" style="top:${i * ROW_H}px;height:${ROW_H}px;width:${LABEL_W + W}px">`
        + `<span class="roll-label" style="width:${LABEL_W}px">${r.label}</span></div>`;
    });
    for (let s = 0; s <= this.steps; s++) {
      const cls = s % this.bar === 0 ? "bar" : s % this.beat === 0 ? "beat" : "step";
      html += `<div class="roll-v ${cls}" style="left:${LABEL_W + s * CELL_W}px;height:${H}px"></div>`;
    }
    this.notes.forEach((n, i) => {
      const r = this.rowIndex(n.row);
      if (r < 0) return;
      const len = Math.max(1, Math.min(n.len || 1, this.steps - n.at));
      html += `<div class="roll-note${n.acc ? " acc" : ""}" data-i="${i}" style="left:${LABEL_W + n.at * CELL_W + 1}px;top:${r * ROW_H + 1}px;width:${len * CELL_W - 2}px;height:${ROW_H - 2}px">`
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
    this.head.style.transform = `translateX(${step * CELL_W}px)`;
  }

  // centre the scroll on a row key (the motif's notes or the tonic)
  scrollToRow(key) {
    const r = this.rowIndex(key);
    if (r >= 0) this.el.scrollTop = Math.max(0, r * ROW_H - this.el.clientHeight / 2);
  }

  at(e) {
    const b = this.grid.getBoundingClientRect();
    const x = e.clientX - b.left - LABEL_W, y = e.clientY - b.top;
    return { step: Math.floor(x / CELL_W), fx: x / CELL_W, row: Math.floor(y / ROW_H) };
  }

  down(e) {
    if (!this.grid || e.button > 0) return;
    const p = this.at(e);
    if (p.row < 0 || p.row >= this.rows.length || p.step < 0 || p.step >= this.steps) return;
    e.preventDefault();
    const edge = e.target.closest("[data-edge]");
    const noteEl = e.target.closest(".roll-note");
    if (edge) {
      this.drag = { kind: "len", i: +edge.dataset.edge, moved: false };
    } else if (noteEl) {
      const i = +noteEl.dataset.i, n = this.notes[i];
      if (e.shiftKey) { n.acc = n.acc ? 0 : 1; this.commit(); return; }
      this.drag = { kind: "move", i, moved: false, d0: p.step - n.at, r0: this.rowIndex(n.row) };
    } else {
      const row = this.rows[p.row].key;
      // the drummer's lanes, a pitched motif's one line (a chord: notes stacked, allowed)
      const n = { at: p.step, len: 1, row, acc: 0 };
      this.notes.push(n);
      this.drag = { kind: "new", i: this.notes.length - 1, moved: true };
      this.onAudition(row);
      this.render();
    }
    this.el.setPointerCapture?.(e.pointerId);
  }

  move(e) {
    if (!this.drag) return;
    const p = this.at(e), n = this.notes[this.drag.i];
    if (!n) return;
    if (this.drag.kind === "len" || (this.drag.kind === "new" && !this.drum)) {
      const len = Math.max(1, Math.min(this.steps - n.at, Math.ceil(p.fx - n.at)));
      if (len !== n.len) { n.len = len; this.drag.moved = true; this.render(); }
    } else if (this.drag.kind === "move") {
      const at = Math.max(0, Math.min(this.steps - 1, p.step - this.drag.d0));
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
