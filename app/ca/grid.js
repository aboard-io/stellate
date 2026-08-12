// grid.js — THE SEED ROW and THE ORBIT.
//
// Two surfaces, one idea: a row of sixteen cells you can draw on, and the
// picture of what that row becomes. The orbit is not a visualisation OF the
// song; it IS the song — one row per section, top to bottom, in playing order.
//
// BOTH ARE DOM, NOT CANVAS, and that is a decision rather than laziness. A
// thirteen-row diagram is ~220 elements, which is nothing to rebuild, and DOM
// buys three things a canvas would have to reinvent: every cell is a real
// button with a real 44px target, the whole thing is reachable by keyboard and
// readable by a screen reader, and THE PLAYHEAD IS A CLASS TOGGLE rather than a
// repaint (the project's standing rule — app/daw/transport.js says why).
import { DOC, cells, toggleCell, setCell, edit, resolved, subs, beginGesture, endGesture, progLabel } from "./doc.js";

const CA = window.CsdCA;
const $ = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };

let seedHost = null, orbitHost = null, wordEl = null, noteEl = null, bitsEl = null;
let cellBtns = [], genRows = [];

// ------------------------------------------------------------------ the seed
// One button per cell. Pointer events only — one path for touch, pen and mouse
// — and a DRAG PAINTS: pointerdown decides whether this gesture is drawing or
// erasing (the opposite of the cell you started on) and every cell the finger
// crosses is set to that, so laying in a run of sixteenths is one motion rather
// than sixteen taps. `touch-action: none` on the row is the single line that
// makes a sideways drag draw instead of scrolling the page.
let painting = null;
export function buildSeed(host) {
  seedHost = host; host.textContent = ""; cellBtns = [];
  for (let i = 0; i < CA.N; i++) {
    const b = $("button", "ca-cell");
    b.type = "button"; b.dataset.i = String(i);
    b.setAttribute("role", "switch");
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      painting = !cells()[i];              // draw if this cell was off, erase if it was on
      beginGesture();                      // the whole drag is ONE undo
      toggleCell(i);
      try { b.setPointerCapture(e.pointerId); } catch (err) {}
    });
    // the capture is on the cell you STARTED on, so the moves arrive here and
    // the cell under the finger is found by hit-test rather than by hover
    b.addEventListener("pointermove", (e) => {
      if (painting === null) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const j = el && el.classList && el.classList.contains("ca-cell") ? +el.dataset.i : -1;
      if (j >= 0) setCell(j, painting);
    });
    const end = () => { painting = null; endGesture(); };
    b.addEventListener("pointerup", end);
    b.addEventListener("pointercancel", end);
    b.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCell(i); }
      else if (e.key === "ArrowRight" && cellBtns[i + 1]) cellBtns[i + 1].focus();
      else if (e.key === "ArrowLeft" && cellBtns[i - 1]) cellBtns[i - 1].focus();
    });
    cellBtns.push(b); host.appendChild(b);
  }
}

// ----------------------------------------------------------------- the orbit
export function buildOrbit(host, word, note, bits) {
  orbitHost = host; wordEl = word; noteEl = note; bitsEl = bits;
}

export function paint() {
  const cs = cells();
  for (let i = 0; i < CA.N; i++) {
    const on = !!cs[i];
    cellBtns[i].classList.toggle("on", on);
    cellBtns[i].setAttribute("aria-checked", on ? "true" : "false");
    // the label is what a screen reader says, and it names the BEAT rather than
    // the index — the row is a bar of eighth notes, not an array
    cellBtns[i].setAttribute("aria-label", "cell " + (i + 1) + ", beat " + (1 + i * CA.STEP) + ", " + (on ? "on" : "off"));
  }

  const r = resolved(), orb = r.orbit;
  if (bitsEl) bitsEl.textContent = "seed " + DOC.seed.toString(16).padStart(4, "0").toUpperCase() + " · rule " + DOC.rule;
  if (wordEl) {
    // the progression is a CA object only when the harmony comes from the seed;
    // with `harmony:"genre"` it is a catalogue NAME, and reading .label off a
    // string threw on every repaint (the console said so, the page did not)
    const p = progLabel();
    wordEl.textContent = p.plr
      ? "reads as " + p.label + "  →  " + p.chords.join("  ")
      : p.chords.join("  ") + "  ·  " + p.label;
  }

  // THE DIAGRAM. Rows are sections in playing order — which is why the reprise
  // shows up twice and the generation number is printed rather than assumed.
  orbitHost.textContent = ""; genRows = [];
  for (const p of r.plan) {
    const row = $("div", "ca-gen r-" + p.role);
    row.dataset.pos = String(p.pos);
    const btn = $("button", "ca-genpick");
    btn.type = "button";
    btn.title = "make generation " + p.gen + " the seed";
    btn.setAttribute("aria-label", p.role + ", generation " + p.gen + ", density " + p.density + " of 16. Make this row the seed.");
    btn.appendChild($("b", "ca-role", p.role));
    const cellsEl = $("span", "ca-gcells");
    for (let i = 0; i < CA.N; i++) {
      const c = $("i", "ca-gcell" + (CA.at(p.row, i) ? " on" : ""));
      cellsEl.appendChild(c);
    }
    btn.appendChild(cellsEl);
    btn.appendChild($("em", "ca-gmeta", "g" + p.gen));
    // TAP A ROW TO RESEED. The CA analogue of sampling a bar: any generation
    // the automaton produced can become the row you start from, which is how you
    // follow a shape you liked instead of hunting for the seed that made it.
    btn.addEventListener("click", () => edit({ seed: p.row }));
    row.appendChild(btn);
    orbitHost.appendChild(row);
    genRows.push(row);
  }

  // RE-LIGHT THE PLAYHEAD. paint() rebuilds every row, which throws away the
  // `now` class along with the element that carried it — and `playhead()`
  // early-returns when the position has not changed, so it would never put the
  // class back. Editing a cell mid-playback therefore killed the playhead until
  // the next section boundary. The lit POSITION is state; the element is not.
  if (lit >= 0 && genRows[lit]) genRows[lit].classList.add("now");

  if (noteEl) {
    // the 24 bits are repeated here on purpose: the header's copy is the first
    // thing to go when the viewport narrows, and this line always has room
    const closed = orb.cycle > 0;
    noteEl.textContent = "seed " + DOC.seed.toString(16).padStart(4, "0").toUpperCase()
      + " · rule " + DOC.rule + " — " + (closed
      ? "tail " + orb.tail + " · cycle " + orb.cycle + " — " + (orb.tail === 0
        ? "a pure loop: it ends where it began"
        : "it settles into a " + orb.cycle + "-section loop after " + orb.tail)
      : "no loop found within " + orb.rows.length + " generations — this one is through-composed");
  }
}

// THE PLAYHEAD IS NOT A REPAINT. One class, moved.
let lit = -1;
export function playhead(pos) {
  if (pos === lit) return;
  if (genRows[lit]) genRows[lit].classList.remove("now");
  lit = pos == null ? -1 : pos;
  if (genRows[lit]) {
    genRows[lit].classList.add("now");
    // keep the playing section in view without fighting a user who has scrolled
    // somewhere on purpose: only nudge when it has actually left the box
    const el = genRows[lit], box = orbitHost.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (r.top < box.top || r.bottom > box.bottom) el.scrollIntoView({ block: "nearest" });
  }
}

subs.push(paint);
