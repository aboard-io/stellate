// ui/touch.js — the shared touch vocabulary: haptics, the live pointer count
// (two fingers = fine mode, hw.css header verb #6), and long-press. One
// module so every control buzzes and holds the same way; the six-verb law
// lives in hw.css and this file is its runtime half.
//
// Layer graph: ui utility — imports nothing, publishes nothing; views import it.

/* ---------- haptics ---------- */
// Guarded three ways: coarse pointers only (a desktop must never try), the
// API must exist, and ONE buzz per 60ms globally — a scrub that vibrated per
// value change would be a phone-sized kazoo. 4ms is a tick, not a buzz:
// enough to feel a commit land, short enough to disappear under the music.
const coarse = matchMedia("(pointer:coarse)");
let lastBuzz = 0;
export function buzz(ms = 4) {
  if (!coarse.matches || !navigator.vibrate) return;
  const now = performance.now();
  if (now - lastBuzz < 60) return;
  lastBuzz = now;
  try { navigator.vibrate(ms); } catch (e) { /* some UAs throw off-gesture */ }
}

/* ---------- the pointer census ---------- */
// Capture-phase counting on window, so a second finger landing ANYWHERE turns
// an active drag fine — the finger does not have to find the control.
let count = 0;
addEventListener("pointerdown", () => { count++; }, true);
const drop = () => { count = Math.max(0, count - 1); };
addEventListener("pointerup", drop, true);
addEventListener("pointercancel", drop, true);
export const pointers = () => count;

/* ---------- long-press ---------- */
// Verb #4: hold 450ms to open the full surface of the thing under the finger.
// Movement past 10px cancels (that is a drag starting, not a hold), and the
// click that follows the release is swallowed ONCE so a hold never also
// selects/plays. `skip` is a selector for children that own their own drag
// (the box grips) — a hold that starts on one never arms.
export function onLongPress(el, fn, { ms = 450, skip = null } = {}) {
  let t = null, x0 = 0, y0 = 0;
  const cancel = () => { if (t != null) { clearTimeout(t); t = null; } };
  el.addEventListener("pointerdown", e => {
    if (e.button) return;
    if (skip && e.target.closest(skip)) return;
    x0 = e.clientX; y0 = e.clientY;
    cancel();
    t = setTimeout(() => {
      t = null;
      const swallow = ev => { ev.stopPropagation(); ev.preventDefault(); };
      el.addEventListener("click", swallow, { capture: true, once: true });
      // if the finger slides off and no click ever arrives, drop the trap
      // rather than eating the NEXT tap
      setTimeout(() => el.removeEventListener("click", swallow, { capture: true }), 700);
      buzz(8);
      fn(e);
    }, ms);
  });
  el.addEventListener("pointermove", e => {
    if (t != null && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) cancel();
  });
  el.addEventListener("pointerup", cancel);
  el.addEventListener("pointercancel", cancel);
}
