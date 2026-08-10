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
const REG = { pads: new Set(), tiles: new Set() };
const prune = (set) => { for (const h of [...set]) if (!h.el.isConnected) set.delete(h); };
export const registry = {
  pads: () => (prune(REG.pads), [...REG.pads]),
  tiles: () => (prune(REG.tiles), [...REG.tiles]),
};

// re-read every control from its source of truth (sheet.js calls this on song
// subs). A control mid-drag keeps the finger's value — no snap-back, ever.
export function refreshAll() {
  for (const h of registry.pads()) h.refresh();
  for (const h of registry.tiles()) h.refresh();
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
