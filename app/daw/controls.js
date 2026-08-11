// controls.js — THE CONTROL VOCABULARY. Three primitives, used everywhere.
//
//   PAD   a probability pad: fill height IS the probability. Tap toggles
//         off ↔ last prob; a vertical drag sets it. "Always" is the ABSENCE of
//         p (the kit-machine law), so commit hands back `null` for off and a
//         0..1 number for on — the CALLER decides how 1 is stored.
//   TILE  one continuous param: background fills bottom-up with the value,
//         label top-left, live value bottom-right in REAL units. Drag anywhere,
//         RELATIVE (start point ≠ jump; slow drag = fine). Double-tap reverts
//         to stock. The Control-Center fill-tile pattern, not a slider.
//   CHIPS segmented buttons for discrete choices. A choice is not an amount.
//   TABLE a scannable list of NAMED THINGS — kits, instruments, patterns, pipes.
//         Chips are for a handful of short words; past ~6 they become a lozenge
//         wall you cannot read down. A table has columns, so the eye scans one.
//
// MOBILE FIRST, the vector.js constraints verbatim: POINTER EVENTS ONLY (one
// code path for touch/pen/mouse, setPointerCapture keeps the drag), touch-action
// none in CSS (a vertical drag EDITS instead of scrolling), ≥44px targets, no
// hover affordances. NO <input type=range> ANYWHERE — pads and tiles carry the
// accessibility themselves: focusable, role="slider", arrow keys nudge,
// Home/End, exactly the vector.js handle contract.
//
// LIVE REGISTRIES: every pad/tile registers itself so the gates can enumerate
// real controls instead of scraping selectors (window.__DAW.controls).

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const REG = { pads: new Set(), tiles: new Set(), tables: new Set() };
const prune = (set) => { for (const h of [...set]) if (!h.el.isConnected) set.delete(h); };
export const registry = {
  pads: () => (prune(REG.pads), [...REG.pads]),
  tiles: () => (prune(REG.tiles), [...REG.tiles]),
  tables: () => (prune(REG.tables), [...REG.tables]),
};

// re-read every control from its source of truth (sheet.js calls this on song
// subs). A control mid-drag keeps the finger's value — no snap-back, ever.
export function refreshAll() {
  for (const h of registry.pads()) h.refresh();
  for (const h of registry.tiles()) h.refresh();
  for (const h of registry.tables()) h.refresh();
}

const el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };

// ---------- PAD ----------
// makePad(host, {value, on, hue, label, onCommit(v|null), onDrag(v)})
//   value: 0..1 probability while on; on: boolean; onCommit(null) = off.
//   onDrag fires live during a drag (the sheet header echoes "snare · 40%").
//   read(): optional — when given, refresh() re-reads {value,on} from it.
export function makePad(host, opts) {
  const o = Object.assign({ value: 1, on: true, hue: 200, label: "", onCommit: null, onDrag: null, read: null }, opts || {});
  let v = clamp01(+o.value || 0), on = !!o.on, last = v > 0 ? v : 1;
  let dragging = false, moved = false, sy = 0, sv = 0, pid = null;

  const b = el("button", "dw-pad");
  b.type = "button";
  b.style.setProperty("--hue", o.hue);
  const fill = el("i", "dw-padfill");
  b.appendChild(fill);
  if (o.label) b.appendChild(el("span", "dw-padlab", o.label));
  host.appendChild(b);

  const text = () => (on ? Math.round(v * 100) + "%" : "off");
  function paint() {
    b.classList.toggle("on", on);
    fill.style.height = (on ? Math.round(clamp01(v) * 100) : 0) + "%";
    b.setAttribute("role", "slider");
    b.setAttribute("tabindex", "0");
    b.setAttribute("aria-label", o.label || "probability");
    b.setAttribute("aria-valuemin", "0");
    b.setAttribute("aria-valuemax", "1");
    b.setAttribute("aria-valuenow", on ? v.toFixed(2) : "0");
    b.setAttribute("aria-valuetext", text());
  }
  paint();

  const commit = () => o.onCommit && o.onCommit(on ? clamp01(v) : null);

  b.addEventListener("pointerdown", (ev) => {
    dragging = true; moved = false; sy = ev.clientY; sv = on ? v : (last || 1);
    pid = ev.pointerId;
    try { b.setPointerCapture(pid); } catch (e) {}
    ev.preventDefault();
  });
  b.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    const dy = sy - ev.clientY;
    if (!moved && Math.abs(dy) < 6) return;      // a wobbly tap is still a tap
    moved = true;
    on = true;
    v = clamp01(sv + dy / (b.clientHeight || 56));   // full pad height = full range
    paint();
    o.onDrag && o.onDrag(v);
    ev.preventDefault();
  });
  const end = (ev) => {
    if (!dragging) return;
    dragging = false;
    try { b.releasePointerCapture(pid); } catch (e) {}
    if (moved) { if (v > 0) last = v; }
    else { on = !on; if (on) v = last || 1; }        // tap = toggle, restoring last prob
    paint();
    commit();
  };
  b.addEventListener("pointerup", end);
  b.addEventListener("pointercancel", (ev) => { dragging = false; paint(); });
  b.addEventListener("click", (ev) => ev.preventDefault());   // pointer path owns it

  b.addEventListener("keydown", (ev) => {
    const step = ev.shiftKey ? 0.15 : 0.05;
    if (ev.key === "ArrowUp" || ev.key === "ArrowRight") { on = true; v = clamp01((on ? v : last) + step); }
    else if (ev.key === "ArrowDown" || ev.key === "ArrowLeft") {
      if (!on) return;
      v = v - step;
      if (v <= 0.001) { on = false; v = 0; } else v = clamp01(v);
    }
    else if (ev.key === "Home") { on = false; }
    else if (ev.key === "End") { on = true; v = 1; }
    else if (ev.key === " " || ev.key === "Enter") { on = !on; if (on) v = last || 1; }
    else return;
    ev.preventDefault();
    if (on && v > 0) last = v;
    paint();
    commit();
  });

  const handle = {
    el: b, kind: "pad", label: o.label,
    value: () => (on ? v : null),
    set: (nv, non) => { if (dragging) return; if (nv != null) { v = clamp01(nv); if (v > 0) last = v; } if (non != null) on = !!non; paint(); },
    refresh: () => { if (dragging || !o.read) return; const r = o.read(); if (r) handle.set(r.value, r.on); },
  };
  REG.pads.add(handle);
  return handle;
}

// ---------- TILE ----------
// makeTile(host, {label, unit, read():{v,txt,stock}, write(v01), revert(), hue})
//   read() -> {v: 0..1 fill, txt: real-units string, stock: boolean}
//   write(v01) is called throttled-to-rAF during the drag (live preview through
//   song.js edit — the build is memoized and ms-cheap) and once on release.
//   Double-tap calls revert() — drop the patch entry, back to stock. The small
//   dot badge shows stock vs yours.
export function makeTile(host, opts) {
  const o = Object.assign({ label: "", unit: "", read: null, write: null, revert: null, hue: 200, onDrag: null }, opts || {});
  let v = 0, dragging = false, sy = 0, sv = 0, pid = null, raf = 0, lastUp = 0;

  const b = el("button", "dw-tile");
  b.type = "button";
  b.style.setProperty("--hue", o.hue);
  const fill = el("i", "dw-tilefill");
  const lab = el("span", "dw-tilelab", o.label);
  const val = el("span", "dw-tileval", "");
  const dot = el("i", "dw-tiledot");
  dot.title = "edited — double-tap to revert";
  b.append(fill, lab, val, dot);
  host.appendChild(b);

  function paint(r) {
    r = r || (o.read ? o.read() : { v, txt: "", stock: true });
    if (!dragging) v = clamp01(r.v || 0);
    fill.style.height = Math.round(clamp01(dragging ? v : r.v || 0) * 100) + "%";
    val.textContent = r.txt || "";
    b.classList.toggle("edited", !r.stock);
    b.setAttribute("role", "slider");
    b.setAttribute("tabindex", "0");
    b.setAttribute("aria-label", o.label + (o.unit ? " (" + o.unit + ")" : ""));
    b.setAttribute("aria-valuemin", "0");
    b.setAttribute("aria-valuemax", "1");
    b.setAttribute("aria-valuenow", clamp01(dragging ? v : r.v || 0).toFixed(2));
    b.setAttribute("aria-valuetext", r.txt || Math.round(clamp01(v) * 100) + "%");
  }
  paint();

  const preview = () => {                        // rAF-throttled write during drag
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      o.write && o.write(v);
      paint();
      o.onDrag && o.onDrag(v, val.textContent);
    });
  };

  b.addEventListener("pointerdown", (ev) => {
    dragging = true; sy = ev.clientY; sv = v; pid = ev.pointerId;
    try { b.setPointerCapture(pid); } catch (e) {}
    ev.preventDefault();
  });
  b.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    const dy = sy - ev.clientY;
    if (Math.abs(dy) < 3) return;
    // RELATIVE drag: ~240px of travel = full range, from wherever the value
    // was. Nothing jumps to the touch point; a slow short drag is a fine trim.
    v = clamp01(sv + dy / 240);
    preview();
    ev.preventDefault();
  });
  const end = (ev) => {
    if (!dragging) return;
    dragging = false;
    try { b.releasePointerCapture(pid); } catch (e) {}
    const now = performance.now();
    const wasTap = Math.abs(v - sv) < 0.004;
    if (wasTap && now - lastUp < 350) {          // double-tap = revert to stock
      lastUp = 0;
      o.revert && o.revert();
      paint();
      return;
    }
    lastUp = wasTap ? now : 0;
    if (!wasTap) { o.write && o.write(v); }      // COMMIT on release
    paint();
  };
  b.addEventListener("pointerup", end);
  b.addEventListener("pointercancel", () => { dragging = false; paint(); });
  b.addEventListener("click", (ev) => ev.preventDefault());

  b.addEventListener("keydown", (ev) => {
    const step = ev.shiftKey ? 0.1 : 0.02;
    if (ev.key === "ArrowUp" || ev.key === "ArrowRight") v = clamp01(v + step);
    else if (ev.key === "ArrowDown" || ev.key === "ArrowLeft") v = clamp01(v - step);
    else if (ev.key === "Home") v = 0;
    else if (ev.key === "End") v = 1;
    else if (ev.key === "Backspace" || ev.key === "Delete") { ev.preventDefault(); o.revert && o.revert(); paint(); return; }
    else return;
    ev.preventDefault();
    o.write && o.write(v);                        // commit on each keyboard step
    paint();
  });

  const handle = {
    el: b, kind: "tile", label: o.label,
    value: () => v,
    refresh: () => { if (!dragging) paint(); },
  };
  REG.tiles.add(handle);
  return handle;
}

// ---------- CHIPS ----------
// makeChips(host, {options:[{id,label}], value, onPick(id), hue})
// Real buttons with aria-pressed. Returns {el, set(id)}.
export function makeChips(host, opts) {
  const o = Object.assign({ options: [], value: null, onPick: null, hue: 200 }, opts || {});
  let cur = o.value;
  const row = el("div", "dw-chips");
  row.style.setProperty("--hue", o.hue);
  const btns = new Map();
  for (const opt of o.options) {
    const b = el("button", "dw-chip", opt.label != null ? opt.label : opt.id);
    b.type = "button";
    if (opt.title) b.title = opt.title;
    b.setAttribute("aria-pressed", String(opt.id === cur));
    b.classList.toggle("on", opt.id === cur);
    b.addEventListener("click", () => { set(opt.id); o.onPick && o.onPick(opt.id); });
    btns.set(opt.id, b);
    row.appendChild(b);
  }
  host.appendChild(row);
  function set(id) {
    cur = id;
    for (const [k, b] of btns) { b.classList.toggle("on", k === cur); b.setAttribute("aria-pressed", String(k === cur)); }
  }
  return { el: row, set, value: () => cur };
}

// ---------- TABLE ----------
// makeTable(host, {columns, groups|rows, value, onPick(id), hue, filter, max, ...})
//
//   columns: [{id, label, align:"left"|"right", w}]   2–3 of them; col 0 is the
//            NAME. Omit and two columns are assumed (name, right-aligned meta).
//   groups:  [{label, rows}] — sticky group headers — or just pass `rows`.
//   rows:    [{id, cells:[…], title, dim}]  cells[0] is the name.
//   value:   the picked row id · onPick(id) commits · hue tints the selection.
//   filter:  true | false | "auto" (the default: ON above 24 rows). A real
//            <input type="search"> — the ONE text control in the vocabulary, and
//            explicitly NOT a range: the no-slider law is about amounts.
//   max:     px of internal scroll (default 340; 0/null = grow, the picker view
//            case where the sheet body is already the scroller).
//
// SEMANTICS: a real <table> so the columns are columns, carrying listbox roles
// so a screen reader hears a choice rather than a data grid — role="listbox" on
// the table, role="option" + aria-selected on each row, ROVING tabindex (exactly
// one row is tabbable), arrows to move, Enter/Space to pick. 44px rows, a 28px
// leading marker column for the ✓, one hairline per row (no zebra).
export function makeTable(host, opts) {
  const o = Object.assign({ columns: null, groups: null, rows: null, value: null,
    onPick: null, hue: 200, filter: "auto", max: 340, label: "", empty: "nothing here",
    scrollToValue: true, read: null }, opts || {});

  // ---- normalise the shape: everything becomes [{label, rows}] ----
  let src = o.groups || o.rows || [];
  if (!Array.isArray(src)) src = [];
  const grouped = src.length && src[0] && Array.isArray(src[0].rows);
  const groups = (grouped ? src : [{ label: null, rows: src }])
    .map((g) => ({ label: g.label || null, rows: (g.rows || []).filter((r) => r && r.id != null) }))
    .filter((g) => g.rows.length);
  const all = groups.reduce((n, g) => n + g.rows.length, 0);
  const ncol = Math.max(1, (o.columns && o.columns.length) ||
    groups.reduce((n, g) => Math.max(n, ...g.rows.map((r) => (r.cells || [r.id]).length)), 1));
  const columns = o.columns && o.columns.length ? o.columns
    : Array.from({ length: ncol }, (_, i) => ({ id: "c" + i, align: i ? "right" : "left" }));
  const wantFilter = o.filter === true || (o.filter !== false && all > 24);
  // NO `value` = this table is a MENU OF DOORS (the section table, the section
  // rules, master's ADD list), not a choice. Picking a door is an ACTION — it
  // drills in or adds a pipe — so it must never leave the row you passed through
  // announced as `aria-selected` with the selection fill. One flag, read by both
  // the stylesheet hook below and pick().
  const doors = o.value == null;
  let cur = o.value;

  const wrap = el("div", "dw-tablewrap");
  wrap.style.setProperty("--hue", o.hue);
  // TWO FACTS THE STYLESHEET CANNOT SEE FROM THE DOM, so they are stated here:
  //   .grows  — no max-height, so this table is NOT a scroll container and its
  //             sticky heads must resolve against whatever is (the sheet body).
  //   .nomark — no `value`, so this is a menu of doors, not a choice: there is
  //             never a ✓ and the marker gutter collapses.
  wrap.classList.toggle("grows", !o.max);
  wrap.classList.toggle("nomark", doors);

  let filterEl = null;
  if (wantFilter) {
    const fh = el("div", "dw-tfilterhold");
    filterEl = document.createElement("input");
    filterEl.type = "search";                 // a search box, never a range
    filterEl.className = "dw-tfilter";
    filterEl.placeholder = "filter" + (o.label ? " " + o.label : "") + "…";
    filterEl.setAttribute("aria-label", "filter" + (o.label ? " " + o.label : "") + " by name");
    fh.appendChild(filterEl);
    wrap.appendChild(fh);
  }

  const scroll = el("div", "dw-tablescroll");
  if (o.max) scroll.style.maxHeight = (+o.max) + "px";
  const table = el("table", "dw-table");
  table.setAttribute("role", "listbox");
  if (o.label) table.setAttribute("aria-label", o.label);
  const hasHead = columns.some((c) => c.label);
  if (hasHead) {
    const thead = el("thead");
    const tr = el("tr");
    tr.appendChild(el("th", "dw-tmark"));
    for (const c of columns) {
      const th = el("th", "dw-th" + (c.align === "right" ? " dw-tright" : ""), c.label || "");
      if (c.w) th.style.width = typeof c.w === "number" ? c.w + "px" : c.w;
      tr.appendChild(th);
    }
    thead.appendChild(tr);
    table.appendChild(thead);
  }
  wrap.classList.toggle("hashead", hasHead);
  const tbody = el("tbody");
  table.appendChild(tbody);
  scroll.appendChild(table);
  wrap.appendChild(scroll);
  host.appendChild(wrap);

  const rowEls = [];             // {tr, row, text}
  for (const g of groups) {
    if (g.label) {
      const gr = el("tr", "dw-tgroup");
      const th = el("th", "dw-tgroupth", g.label);
      th.colSpan = columns.length + 1;
      th.setAttribute("scope", "colgroup");
      gr.appendChild(th);
      tbody.appendChild(gr);
      gr.dataset.group = g.label;
    }
    for (const r of g.rows) {
      const tr = el("tr", "dw-trow" + (r.dim ? " dim" : ""));
      tr.setAttribute("role", "option");
      tr.setAttribute("aria-selected", String(r.id === cur));
      tr.tabIndex = -1;
      tr.dataset.id = String(r.id);
      if (r.title) tr.title = r.title;
      const mk = el("td", "dw-tmark", r.id === cur ? "✓" : "");
      tr.appendChild(mk);
      const cells = r.cells || [r.id];
      for (let i = 0; i < columns.length; i++) {
        const c = columns[i];
        const td = el("td", "dw-tcell" + (i === 0 ? " dw-tname" : "") + (c.align === "right" ? " dw-tright" : ""),
          cells[i] == null ? "" : String(cells[i]));
        tr.appendChild(td);
      }
      tr.addEventListener("click", () => pick(r.id));
      tbody.appendChild(tr);
      rowEls.push({ tr, row: r, mark: mk, group: g.label,
        text: (cells.join(" ") + " " + r.id).toLowerCase() });
    }
  }
  if (!rowEls.length) {
    const tr = el("tr", "dw-tempty");
    const td = el("td", "dw-tcell", o.empty);
    td.colSpan = columns.length + 1;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  const visible = () => rowEls.filter((r) => !r.tr.hidden);
  function roving() {
    const vis = visible();
    const want = vis.find((r) => r.row.id === cur) || vis[0];
    for (const r of rowEls) r.tr.tabIndex = r === want ? 0 : -1;
  }
  function paintSel() {
    for (const r of rowEls) {
      const on = r.row.id === cur;
      r.tr.classList.toggle("on", on);
      r.tr.setAttribute("aria-selected", String(on));
      r.mark.textContent = on ? "✓" : "";
    }
    roving();
  }
  function pick(id) {
    if (!doors) { cur = id; paintSel(); }   // a door is walked through, not chosen
    if (o.onPick) o.onPick(id);
  }
  // the nearest ancestor that ACTUALLY scrolls — see scrollToCur
  function outerScroller() {
    let p = wrap.parentElement;
    while (p && p !== document.body) {
      const ov = getComputedStyle(p).overflowY;
      if ((ov === "auto" || ov === "scroll") && p.scrollHeight > p.clientHeight + 1) return p;
      p = p.parentElement;
    }
    return null;
  }
  function scrollToCur() {
    const r = rowEls.find((x) => x.row.id === cur);
    if (!r || !o.scrollToValue) return;
    if (scroll.scrollHeight > scroll.clientHeight + 1) {
      scroll.scrollTop = Math.max(0, r.tr.offsetTop - scroll.clientHeight / 2 + r.tr.offsetHeight / 2);
      return;
    }
    // `max: 0` — the PICKER VIEW case, which is most of them: the table grows and
    // the SHEET BODY is the scroller, so the line above measured a box that never
    // overflows and did nothing. A 23-row kit picker then opened 650px above the
    // kit you already chose. Centre the row in whatever really scrolls.
    const sc = outerScroller();
    if (!sc) return;
    const rr = r.tr.getBoundingClientRect(), sr = sc.getBoundingClientRect();
    sc.scrollTop = Math.max(0, sc.scrollTop + (rr.top - sr.top) - (sc.clientHeight - rr.height) / 2);
  }

  // ---- filter: narrows rows AND drops group headers that emptied ----
  function applyFilter(q) {
    const s = String(q || "").trim().toLowerCase();
    for (const r of rowEls) r.tr.hidden = !!s && r.text.indexOf(s) < 0;
    for (const gr of tbody.querySelectorAll(".dw-tgroup")) {
      const label = gr.dataset.group;
      gr.hidden = !rowEls.some((r) => r.group === label && !r.tr.hidden);
    }
    roving();
  }
  if (filterEl) {
    filterEl.addEventListener("input", () => applyFilter(filterEl.value));
    filterEl.addEventListener("keydown", (ev) => {
      const vis = visible();
      if (ev.key === "ArrowDown" && vis.length) { ev.preventDefault(); vis[0].tr.focus(); }
      else if (ev.key === "Enter" && vis.length) { ev.preventDefault(); pick(vis[0].row.id); }
      else if (ev.key === "Escape" && filterEl.value) { ev.preventDefault(); filterEl.value = ""; applyFilter(""); }
    });
  }

  // ---- keyboard: roving tabindex, arrows move, Enter/Space picks ----
  table.addEventListener("keydown", (ev) => {
    const tr = ev.target && ev.target.closest ? ev.target.closest(".dw-trow") : null;
    if (!tr) return;
    const vis = visible();
    const i = vis.findIndex((r) => r.tr === tr);
    if (i < 0) return;
    let j = -1;
    if (ev.key === "ArrowDown") j = Math.min(vis.length - 1, i + 1);
    else if (ev.key === "ArrowUp") j = Math.max(0, i - 1);
    else if (ev.key === "Home") j = 0;
    else if (ev.key === "End") j = vis.length - 1;
    else if (ev.key === "PageDown") j = Math.min(vis.length - 1, i + 7);
    else if (ev.key === "PageUp") j = Math.max(0, i - 7);
    else if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      pick(vis[i].row.id);
      return;
    } else return;
    ev.preventDefault();
    const next = vis[j];
    if (!next) return;
    for (const r of rowEls) r.tr.tabIndex = r === next ? 0 : -1;
    next.tr.focus();
  });

  paintSel();
  requestAnimationFrame(scrollToCur);

  const handle = {
    el: wrap, kind: "table", label: o.label,
    value: () => cur,
    count: () => rowEls.length,
    ids: () => rowEls.map((r) => r.row.id),
    visibleIds: () => visible().map((r) => r.row.id),
    rowEl: (id) => (rowEls.find((r) => String(r.row.id) === String(id)) || {}).tr || null,
    set: (id) => { cur = id; paintSel(); },
    filterEl: () => filterEl,
    filter: (q) => { if (filterEl) filterEl.value = q == null ? "" : q; applyFilter(q); },
    focus: () => { const t = rowEls.find((r) => r.tr.tabIndex === 0); if (t) t.tr.focus(); },
    refresh: () => { if (o.read) { const v = o.read(); if (v !== cur) { cur = v; paintSel(); } } },
  };
  REG.tables.add(handle);
  return handle;
}
