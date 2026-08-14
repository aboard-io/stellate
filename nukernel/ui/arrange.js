// ui/arrange.js — the arrangement view of the selected box: lanes, notes,
// ruler, playhead. The one view that genuinely has to rebuild when the music
// changes (every note is a positioned div), so its renders are COALESCED —
// a dirty flag flushed once per animation frame — which is what keeps an
// editor scrub (a "phrase" event per pointermove) from rebuilding the grid at
// pointer-event rate. The resize handler is debounced for the same reason.
//
// Layer graph: ui view — imports state/derive/deps and audio/transport only
// for nothing: the playhead is PAINTED from main.js's rAF loop via
// paintPlayhead(), fed by transport.getPosition(). Audio never calls in here.
import { GENRES, DRUMNAME } from "./deps.js";
import { SLOTS, curSection, on } from "./state.js";
import { sectionRender, stackOf } from "./derive.js";
import { update as updateReadout } from "./readout.js";

const gridEl = document.getElementById("grid");
const scrollEl = document.getElementById("dawscroll");
// THE SCREEN NEVER SCROLLS SIDEWAYS ON A PHONE — the same law as the song
// row. Narrow screens shrink the head column and let stepW floor at 3px so a
// whole section always fits the width it has.
const NARROW = matchMedia("(max-width:560px)");
let stepW = 7, phEl = null, viewSteps = 64;
export const getStepW = () => stepW;
export const getViewSteps = () => viewSteps;

export function render() {
  const sec = curSection(), { g, bars, ev } = sectionRender(sec, SLOTS);
  // hold the scroll across the rebuild: innerHTML = "" resets it to 0, which
  // yanked the view back to bar 1 on every single chip click
  const keepX = scrollEl.scrollLeft, keepY = scrollEl.scrollTop;
  gridEl.innerHTML = ""; phEl = null;
  requestAnimationFrame(() => { scrollEl.scrollLeft = keepX; scrollEl.scrollTop = keepY; });
  const lanes = [];
  const aSlots = stackOf(sec)[0].slots, nP = Math.max(1, aSlots.length);
  // one pass into per-kind pools, then per-lane picks are over the small pools
  const lines = [], basses = [], hits = [];
  for (const e of ev) (e.kind === "line" ? lines : e.kind === "bass" ? basses : hits).push(e);
  for (let v = 0; v < g.voices; v++)
    lanes.push({ name: (g.realize(v) === "pad" ? "Pad " : "Voice ") + v,
      op: (aSlots.length > 1 ? "phrase " + (aSlots[v % nP] + 1) + " · " : "") + (g.words[v] || ""),
      kind: "pitch", color: "var(--v" + v + ")",
      ev: lines.filter(e => e.v === v) });
  let lv = g.voices;
  for (const ent of stackOf(sec).slice(1)) {
    const L = GENRES[ent.g], lnP = Math.max(1, ent.slots.length);
    for (let v = 0; v < L.voices; v++)
      lanes.push({ name: L.label + " " + v,
        op: (ent.slots.length ? "phrase " + (ent.slots[v % lnP] + 1) + " · " : "") + (L.words[v] || ""),
        kind: "pitch", color: "var(--v" + ((v + 2) % 4) + ")",
        ev: lines.filter(e => e.v === lv + v) });
    lv += L.voices;
  }
  lanes.push({ name: "Bass", op: (g.bassStyle === "walk" ? "walking · " : "roots · ") + g.harmony,
    kind: "pitch", color: "var(--vb)", ev: basses });
  for (const d of [...new Set(hits.map(e => e.d))])
    lanes.push({ name: DRUMNAME[d] || d,
      op: d === "p" ? "only(acc, rotate 3)"
        : (g.fill && g.fill[d]) ? "grid + fill every " + g.bars : "grid",
      kind: "drum", color: "var(--drum)", ev: hits.filter(e => e.d === d) });

  const steps = bars * 16 / g.rate; viewSteps = steps;
  const narrow = NARROW.matches, headW = narrow ? 64 : 118;
  // clientWidth is 0 if the stylesheet has not applied yet (module scripts can
  // outrun a slow stylesheet) — the 560 floor keeps the first draw sane either
  // way. On a narrow screen the floor is the screen itself: fit, never scroll.
  const avail = narrow ? Math.max(220, scrollEl.clientWidth - headW)
                       : Math.max(560, scrollEl.clientWidth - headW);
  stepW = Math.max(narrow ? 3 : 4, Math.min(22, avail / steps));
  gridEl.style.gridTemplateColumns = headW + "px " + steps * stepW + "px";

  gridEl.append(Object.assign(document.createElement("div"), { className: "rulerpad" }));
  const ruler = document.createElement("div"); ruler.className = "ruler";
  for (let b = 0; b < bars; b++) {
    const t = document.createElement("div"); t.className = "tick b";
    t.style.left = (b * 16 * stepW / g.rate) + "px";
    t.textContent = "bar " + (sec.nudge + b + 1);
    ruler.append(t);
  }
  gridEl.append(ruler);

  lanes.forEach((L, li) => {
    const h = document.createElement("div"); h.className = "head";
    h.innerHTML = '<div class="nm"><span class="swatch" style="background:' + L.color +
      '"></span>' + L.name + '</div><div class="op">' + L.op + "</div>";
    gridEl.append(h);
    const lane = document.createElement("div");
    lane.className = "lane" + (li % 2 ? " alt" : "");
    lane.style.height = (L.kind === "pitch" ? 54 : 22) + "px";
    for (let b = 1; b < bars; b++) {
      const bl = document.createElement("div"); bl.className = "barline";
      bl.style.left = (b * 16 * stepW / g.rate) + "px"; lane.append(bl);
    }
    if (L.ev.length) {
      const ns = L.ev.map(e => e.n).filter(n => n != null);
      const lo = ns.length ? Math.min(...ns) : 0, hi = ns.length ? Math.max(...ns) : 1;
      const span = Math.max(1, hi - lo);
      for (const e of L.ev) {
        const d = document.createElement("div");
        d.className = "note" + (e.acc ? " acc" : "") + (e.fill ? " fill" : "");
        d.style.left = (e.t * stepW) + "px";
        d.style.background = L.color;
        d.style.opacity = String(0.18 + 0.82 * ((e.vel == null ? 5 : e.vel) / 9));
        if (L.kind === "pitch") {
          const hh = Math.max(3, Math.min(7, 54 / (span + 2)));
          d.style.width = Math.max(2, (e.dur || 1) * stepW - 1) + "px";
          d.style.height = hh + "px";
          d.style.top = (4 + (1 - (e.n - lo) / span) * (54 - 8 - hh)) + "px";
          if (e.sld) d.style.background = "linear-gradient(90deg,transparent," + L.color + ")";
        } else {
          d.style.width = Math.max(2, stepW - 1) + "px";
          d.style.height = e.acc ? "14px" : "9px";
          d.style.top = e.acc ? "4px" : "6px";
        }
        lane.append(d);
      }
    }
    gridEl.append(lane);
  });
  // ONE playhead over the whole lane stack, not one per lane. Fourteen lanes
  // meant fourteen transform writes and fourteen glow repaints per frame;
  // this is one absolutely-positioned line over the grid (CSS pins it at the
  // lane column's left edge) and one compositor transform per frame.
  phEl = document.createElement("div"); phEl.className = "playhead";
  phEl.style.left = headW + "px";                     // the CSS pin assumes 118
  phEl.style.transform = "translateX(-9999px)";       // parked off-screen
  gridEl.append(phEl);
  updateReadout();
}

/* ---------- the playhead ---------- */
// fed by main.js's rAF loop from transport.getPosition() — the view never
// reads audio internals directly
export function paintPlayhead(x) {
  if (phEl) phEl.style.transform = "translateX(" + x + "px)";
}
export function resetPlayhead() {
  if (phEl) phEl.style.transform = "translateX(-9999px)";
}
export function resetScroll() { scrollEl.scrollLeft = 0; }

/* ---------- coalesced renders ---------- */
// every "the music changed" event marks the grid dirty; one real rebuild per
// animation frame however fast the events arrive
let dirty = false;
function invalidate() {
  if (dirty) return;
  dirty = true;
  requestAnimationFrame(() => { dirty = false; render(); });
}
for (const t of ["song", "box", "selection", "phrase", "refresh"]) on(t, invalidate);
let rsz = null;
addEventListener("resize", () => { clearTimeout(rsz); rsz = setTimeout(render, 120); });
