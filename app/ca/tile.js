// tile.js — THE ONE CONTINUOUS CONTROL. There is exactly one on this page and
// this is it: tempo uses it, volume uses it, and nothing else needs it.
//
// Not a slider — the project's standing law is that `input[type=range]` count
// stays zero, and the reason is a real one rather than taste: a range input's
// thumb is an 8px target that jumps to wherever you first touch, which on a
// phone means every adjustment starts with an accident. This is /daw's TILE
// (docs/DAW.md "The control vocabulary"), ported: a fill bar you drag ANYWHERE,
// RELATIVELY — starting at the edge does not slam the value to the edge, and a
// slow drag is a fine adjustment.
//
// Three behaviours it must have, all of which the DAW learned the hard way:
//   - the live value reads out in REAL UNITS ("128 bpm"), not 0..1
//   - a DOUBLE TAP reverts to stock, and reverting means DROPPING the override
//     rather than writing the stock number — otherwise "the genre's own tempo"
//     becomes a frozen copy that stops following the genre
//   - a dot marks "yours" so stock and set are distinguishable at a glance
//
// Keyboard reaches the same commit path: role="slider", arrows, shift for
// coarse, Home/End for the ends.

export function makeTile(o) {
  // o = {label, min, max, get() -> number, set(v), stock() -> number|null,
  //      isSet() -> bool, revert(), fmt(v) -> string, step, big}
  const el = document.createElement("div");
  el.className = "ca-tile";
  el.tabIndex = 0;
  el.setAttribute("role", "slider");
  el.setAttribute("aria-label", o.label);
  el.setAttribute("aria-valuemin", String(o.min));
  el.setAttribute("aria-valuemax", String(o.max));

  const fill = document.createElement("i");
  const lab = document.createElement("b");
  const val = document.createElement("span");
  el.append(fill, lab, val);

  const step = o.step || 1, big = o.big || 5;
  const clamp = (v) => Math.max(o.min, Math.min(o.max, v));
  const fmt = o.fmt || ((v) => String(Math.round(v)));

  function paint() {
    const v = o.get();
    const set = o.isSet ? o.isSet() : false;
    fill.style.width = (100 * (v - o.min) / (o.max - o.min)).toFixed(1) + "%";
    lab.textContent = o.label + (set ? " ·" : "");        // the dot: this one is YOURS
    el.classList.toggle("yours", set);
    val.textContent = fmt(v);
    el.setAttribute("aria-valuenow", String(Math.round(v)));
    el.setAttribute("aria-valuetext", fmt(v) + (set ? "" : " (stock)"));
  }

  // RELATIVE DRAG. `from` is the value the gesture started at and `at` the x it
  // started at, so the tile moves BY the distance travelled — the pointer never
  // teleports the value to where the finger happened to land.
  let from = 0, at = 0, last = 0, dragging = false;
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const now = performance.now();
    if (now - last < 320) { if (o.revert) o.revert(); paint(); last = 0; return; }   // double tap
    last = now;
    from = o.get(); at = e.clientX; dragging = true;
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
  });
  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const span = el.getBoundingClientRect().width || 1;
    o.set(clamp(from + (e.clientX - at) / span * (o.max - o.min)));
    paint();
  });
  const end = () => { dragging = false; };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("keydown", (e) => {
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (d != null) { e.preventDefault(); o.set(clamp(o.get() + d * (e.shiftKey ? big : step))); paint(); return; }
    if (e.key === "Home") { e.preventDefault(); o.set(o.min); paint(); }
    else if (e.key === "End") { e.preventDefault(); o.set(o.max); paint(); }
    else if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); if (o.revert) o.revert(); paint(); }
  });

  el.repaint = paint;
  paint();
  return el;
}
