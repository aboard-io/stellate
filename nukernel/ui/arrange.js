// ui/arrange.js — THE PATTERN VIEW of the selected box, as a tracker.
//
// Time runs DOWN. Every row is one 16th of the box, ruled every four and
// numbered in the first column with its bar; every voice is a COLUMN with its
// name in a columnheader; a note is a cell entry — the pitch at its tick, its
// sustained ticks marked the tracker way with a dim continuation glyph. The
// playhead is a ROW that lights and sweeps down the screen, and the view
// follows it while playing unless you have scrolled recently (the DAW
// convention: the machine yields to the hand for a few seconds, then takes
// the wheel back).
//
// This replaced the horizontal piano roll — lanes running left to right with
// absolutely-positioned note divs, a pixel ruler and a translateX playhead —
// under Paul's standing law: don't go left to right, go top to bottom, make
// them tables. What survives from it: the per-voice colours, the fixed-height
// internal scroll container (the lane count changes every time a transform is
// switched on, and the panel must not resize the page), and the coalesced
// render — a dirty flag flushed once per animation frame, which is what keeps
// an editor scrub (a "phrase" event per pointermove) from rebuilding the table
// at pointer-event rate.
//
// The screen is LCD glass in both faces, like every other readout on the
// machine: the lane colours are ink on near-black, which is the only way six
// saturated channel colours read at once on a silver panel.
//
// Layer graph: ui view — imports state/derive/deps. The playhead is PAINTED
// from main.js's rAF loop via paintPlayhead(), fed by transport.getPosition().
// Audio never calls in here.
import { GENRES, DRUMNAME } from "./deps.js";
import { SLOTS, curSection, on } from "./state.js";
import { sectionRender, stackOf } from "./derive.js";
import { update as updateReadout } from "./readout.js";

const gridEl = document.getElementById("grid");
const scrollEl = document.getElementById("dawscroll");

// A tracker with more rows than a screen can hold is a scroll bar; a tracker
// with more rows than a BROWSER can build cheaply is a stall. 512 ticks is 32
// bars of straight 16ths — longer than any box the composer writes — and the
// cap is stated in the header column when it bites.
const MAXROWS = 512;
// the note names are the tracker's alphabet: sharps, mono, octave numbers with
// middle C at C4 (MIDI 60), which is what every other pitch readout here says
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteName = n => NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);

let rows = 0;                 // ticks drawn
let rowEls = [];              // per tick: the .trow (display:contents, holds .play)
let tickEls = [];             // per tick: its .ttick rowheader — the thing with a BOX

/* ---------- the table ---------- */
export function render() {
  const sec = curSection(), { g, bars, ev } = sectionRender(sec, SLOTS);
  // hold the scroll across the rebuild: innerHTML = "" resets it to 0, which
  // yanked the view back to tick 1 on every single chip click
  const keepX = scrollEl.scrollLeft, keepY = scrollEl.scrollTop;
  gridEl.textContent = ""; rowEls = []; tickEls = []; curRow = -1;

  // ---- the columns, in the order the band sits in: the authority's voices,
  // then each stacked layer's, then the bass, then the kit
  const cols = [];
  const aSlots = stackOf(sec)[0].slots, nP = Math.max(1, aSlots.length);
  // one pass into per-kind pools, then per-column picks are over the small pools
  // A BUCKET PER KIND, NAMED. This was a two-level ternary whose ELSE arm was
  // `hits`, so the first event kind anyone added — `sing` — landed in the drum
  // pool and threw on `e.d.toUpperCase()`. An unknown kind now goes nowhere
  // rather than into the last bucket that happened to be written.
  const lines = [], basses = [], hits = [], sings = [];
  const POOL = { line: lines, bass: basses, hit: hits, sing: sings };
  for (const e of ev) { const p = POOL[e.kind]; if (p) p.push(e); }
  for (let v = 0; v < g.voices; v++)
    cols.push({ name: (g.realize(v) === "pad" ? "Pad " : "Voice ") + v,
      op: (aSlots.length > 1 ? "phrase " + (aSlots[v % nP] + 1) + " · " : "") + (g.words[v] || ""),
      kind: "pitch", color: "var(--v" + (v % 4) + ")",
      ev: lines.filter(e => e.v === v) });
  let lv = g.voices;
  for (const ent of stackOf(sec).slice(1)) {
    const L = GENRES[ent.g], lnP = Math.max(1, ent.slots.length);
    for (let v = 0; v < L.voices; v++)
      cols.push({ name: L.label + " " + v,
        op: (ent.slots.length ? "phrase " + (ent.slots[v % lnP] + 1) + " · " : "") + (L.words[v] || ""),
        kind: "pitch", color: "var(--v" + ((v + 2) % 4) + ")",
        ev: lines.filter(e => e.v === lv + v) });
    lv += L.voices;
  }
  cols.push({ name: "Bass", op: (g.bassStyle === "walk" ? "walking · " : "roots · ") + g.harmony,
    kind: "pitch", color: "var(--vb)", ev: basses });
  // THE SINGER, one column per voice, and it reads as a LINE because that is
  // what it is: a pitch per tick with a duration. The op line carries the
  // words, which is the one thing about this column a note name cannot say.
  for (const vi of [...new Set(sings.map(e => e.vi))].sort()) {
    const mine = sings.filter(e => e.vi === vi);
    cols.push({ name: vi ? "Harmony" : "Voice",
      op: [...new Set(mine.map(e => e.syl))].join(" "),
      kind: "pitch", color: "var(--v" + ((vi + 1) % 4) + ")", ev: mine });
  }
  // THE KIT IS ONE COLUMN GROUP, not six unrelated channels: the drums share a
  // rule down their left edge and narrower cells, because a hit is a lamp and
  // a pitch is a word.
  const drums = [...new Set(hits.map(e => e.d))];
  drums.forEach((d, i) => cols.push({ name: DRUMNAME[d] || d, short: d.toUpperCase(),
    op: d === "p" ? "only(acc, rotate 3)"
      : (g.fill && g.fill[d]) ? "grid + fill every " + g.bars : "grid",
    kind: "drum", group: "drums", first: i === 0,
    color: "var(--drum)", ev: hits.filter(e => e.d === d) }));

  const barSteps = 16 / g.rate;
  const steps = Math.round(bars * barSteps);
  rows = Math.min(MAXROWS, Math.max(1, steps));

  gridEl.setAttribute("role", "grid");
  gridEl.setAttribute("aria-label", "arrangement of the selected box, one row per 16th");
  gridEl.setAttribute("aria-rowcount", String(rows + 1));
  gridEl.setAttribute("aria-colcount", String(cols.length + 1));
  gridEl.className = "tgrid";
  gridEl.style.gridTemplateColumns = "var(--tickw) " +
    cols.map(c => c.kind === "drum" ? "var(--drumw)" : "var(--voicew)").join(" ");

  // ---- the header row: the corner over the tick numbers, one columnheader
  // per voice, its swatch in its own colour
  const head = document.createElement("div");
  head.className = "trow"; head.setAttribute("role", "row");
  const corner = document.createElement("div");
  // .thd / .tnum are the shared TABLE header and numeral column (see
  // kernel-daw.css): the same silkscreen, rule and frozen edges the pattern
  // editor and the song table wear, on this table's glass ground
  corner.className = "tcorner thd tnum"; corner.setAttribute("role", "columnheader");
  corner.textContent = rows < steps ? "bar⋯" : "bar";
  corner.title = rows < steps
    ? "showing the first " + rows + " of " + steps + " ticks" : "bar : 16th";
  head.append(corner);
  cols.forEach(c => {
    const h = document.createElement("div");
    h.className = "tcol thd" + (c.kind === "drum" ? " drum" : "") + (c.first ? " gstart" : "");
    h.setAttribute("role", "columnheader");
    if (c.group) h.dataset.group = c.group;
    const nm = document.createElement("div");
    nm.className = "nm";
    const sw = document.createElement("span");
    sw.className = "swatch"; sw.style.background = c.color;
    nm.append(sw, document.createTextNode(c.kind === "drum" ? c.short : c.name));
    h.append(nm);
    const op = document.createElement("div");
    op.className = "op"; op.textContent = c.op;
    h.append(op);
    h.title = c.name + (c.op ? " — " + c.op : "");
    head.append(h);
  });
  gridEl.append(head);

  // ---- what each column says at each tick. A pitch cell is the note name (or
  // names — a chord voicing lands several notes on one voice at one tick, and
  // a tracker shows what is there); a held note marks its remaining ticks with
  // a continuation glyph, which is how a tracker draws duration without
  // drawing a rectangle.
  const maps = cols.map(c => {
    const m = new Map();
    const at = t => {
      let x = m.get(t);
      if (!x) m.set(t, x = { ns: [], hit: false, cont: false, vel: 0, acc: false, fill: false, sld: false });
      return x;
    };
    for (const e of c.ev) {
      const t0 = Math.round(e.t);
      if (t0 < 0 || t0 >= rows) continue;
      const x = at(t0);
      x.cont = false;                                  // a real note beats a tail
      if (c.kind === "pitch") { if (e.n != null) x.ns.push(e.n); } else x.hit = true;
      x.vel = Math.max(x.vel, e.vel == null ? 5 : e.vel);
      if (e.acc) x.acc = true;
      if (e.fill) x.fill = true;
      if (e.sld) x.sld = true;
      if (c.kind !== "pitch") continue;
      const dur = Math.max(1, Math.round(e.dur || 1));
      for (let k = 1; k < dur && t0 + k < rows; k++) {
        const y = at(t0 + k);
        if (!y.ns.length && !y.hit) y.cont = true;
      }
    }
    return m;
  });

  // ---- the rows. Each .trow is display:contents — its children are the grid
  // items — and carries a .trule spanning every column, which is both the beat
  // ruling and the playhead's lamp. Building the rule as one element per row
  // (rather than a border per cell) is what makes the playhead one class write.
  for (let t = 0; t < rows; t++) {
    const bar = Math.floor(t / barSteps), inBar = t - bar * barSteps;
    const r = document.createElement("div");
    r.className = "trow" + (inBar === 0 ? " bar" : t % 4 === 0 ? " beat" : "");
    r.setAttribute("role", "row");
    r.setAttribute("aria-rowindex", String(t + 2));
    r.dataset.tick = String(t);
    const rule = document.createElement("div");
    rule.className = "trule"; rule.setAttribute("aria-hidden", "true");
    r.append(rule);
    const tick = document.createElement("div");
    tick.className = "ttick tnum"; tick.setAttribute("role", "rowheader");
    // the ruler that used to run across the top now runs down the side, and
    // every row says where it is: bar : 16th. A bare step number restarting at
    // 01 each bar tells you nothing about which bar you are in, and a running
    // 0…N count tells you nothing about the beat — this says both in 4 glyphs.
    tick.textContent = (sec.nudge + bar + 1) + ":" + String(inBar + 1).padStart(2, "0");
    tick.setAttribute("aria-label", "bar " + (sec.nudge + bar + 1) + " step " + (inBar + 1));
    r.append(tick);
    cols.forEach((c, ci) => {
      const x = maps[ci].get(t);
      const d = document.createElement("div");
      let cls = "tcell" + (c.kind === "drum" ? " drum" : "") + (c.first ? " gstart" : "");
      if (x) {
        if (x.ns.length) {
          const ns = x.ns.slice().sort((a, b) => a - b).map(noteName);
          d.textContent = ns.join(" ");
          if (ns.length > 1) d.title = ns.join(" ");
        } else if (x.hit) d.textContent = x.acc ? "◆" : "●";
        else if (x.cont) { d.textContent = "│"; cls += " cont"; }
        if (x.ns.length || x.hit) {
          cls += " on";
          if (x.acc) cls += " acc";
          if (x.fill) cls += " fill";
          if (x.sld) cls += " sld";
          d.style.color = c.color;
          d.style.opacity = String(0.34 + 0.66 * (x.vel / 9));
        }
      }
      d.className = cls;
      d.setAttribute("role", "gridcell");
      d.setAttribute("aria-colindex", String(ci + 2));
      r.append(d);
    });
    rowEls.push(r); tickEls.push(tick);
    gridEl.append(r);
  }

  // the scroll restore has to outlive the layout pass, and it must not read as
  // the USER scrolling (that would freeze the playhead follow for 2.5s on
  // every chip click)
  requestAnimationFrame(() => {
    scrollEl.scrollLeft = keepX; scrollEl.scrollTop = keepY;
    progTop = scrollEl.scrollTop;
  });
  updateReadout();
}

/* ---------- the playhead: a ROW, not a line ---------- */
// fed by main.js's rAF loop from transport.getPosition() — the view never reads
// audio internals directly. The argument is the position in TICKS (the same
// units the rows are), fractional; only whole-row changes cost anything.
let curRow = -1;
export function paintPlayhead(step) {
  // a negative tick means the next pass is already scheduled but has not
  // sounded yet (the transport sets passStart a lookahead early) — the honest
  // reading is "still on the last row", so hold rather than snap to the top
  if (!(step >= 0)) return;
  const r = Math.min(rows - 1, Math.floor(step));
  if (r === curRow) return;
  if (rowEls[curRow]) rowEls[curRow].classList.remove("play");
  curRow = r;
  if (rowEls[r]) { rowEls[r].classList.add("play"); follow(r); }
}
export function resetPlayhead() {
  if (rowEls[curRow]) rowEls[curRow].classList.remove("play");
  curRow = -1;
}
export function resetScroll() {
  scrollEl.scrollLeft = 0; scrollEl.scrollTop = 0; progTop = 0;
}

/* ---------- scroll follows the playhead, and yields to the hand ---------- */
// The DAW convention, and the reason it is a convention: a view that always
// snaps back cannot be read ahead of the music, and a view that never follows
// stops showing the music the moment it passes the fold. So: follow, unless a
// hand has touched the scroll in the last few seconds.
const YIELD_MS = 2500;
let lastUser = -1e9, progTop = 0;
const touched = () => { lastUser = performance.now(); };
for (const t of ["wheel", "touchstart", "pointerdown", "keydown"])
  scrollEl.addEventListener(t, touched, { passive: true });
// a scroll we did not ask for is a hand (a trackpad fling, a scrollbar drag, a
// focus jump) — compare against the last position WE set, read back after the
// browser clamped it
scrollEl.addEventListener("scroll", () => {
  if (Math.abs(scrollEl.scrollTop - progTop) > 2) lastUser = performance.now();
}, { passive: true });
function follow(r) {
  if (performance.now() - lastUser < YIELD_MS) return;
  const el = tickEls[r];
  if (!el) return;
  const h = scrollEl.clientHeight, top = el.offsetTop, rowh = el.offsetHeight;
  // keep the lit row inside the middle band; recentre when it leaves
  if (top >= scrollEl.scrollTop + h * 0.28 && top + rowh <= scrollEl.scrollTop + h * 0.82) return;
  scrollEl.scrollTop = Math.max(0, top - h / 2);
  progTop = scrollEl.scrollTop;
}

/* ---------- coalesced renders ---------- */
// every "the music changed" event marks the table dirty; one real rebuild per
// animation frame however fast the events arrive
let dirty = false;
function invalidate() {
  if (dirty) return;
  dirty = true;
  requestAnimationFrame(() => { dirty = false; render(); });
}
for (const t of ["song", "box", "selection", "phrase", "refresh"]) on(t, invalidate);
// the table's column widths are constant, so a resize changes nothing about
// the layout — but the follow window is measured from clientHeight, and the
// readout under it re-flows, so a debounced rebuild keeps both honest
let rsz = null;
addEventListener("resize", () => { clearTimeout(rsz); rsz = setTimeout(render, 120); });
