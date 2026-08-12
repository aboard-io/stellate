// lanes.js — WHAT THE ROW TURNS INTO, drawn directly under the row.
//
// This is the answer to the only question that matters on this page: I tapped
// sixteen boxes — so what? Before this existed you had to hold the whole lens
// table in your head and imagine the result, which is exactly the wrong way
// round for an instrument.
//
// FIVE LANES, ONE GRID. The lanes use the SAME sixteen-column grid as the seed
// row, so column 3 of "kick" sits exactly under cell 3 of the seed. That
// alignment IS the teaching: light a cell, watch which lane lights under it.
// Nothing here is a new idea about the music — every lane is just
// CsdCA.lensDrums / lensBass / lensMelody rendered, so if the lane says "kick"
// then the engine plays a kick.
//
// It also states the rules in words, because a picture shows you WHAT and a
// sentence tells you WHY. Keep the WHY table below honest: it is prose about
// engine/ca.js's lenses and nothing enforces the agreement, so a lens change
// that does not land here turns the page's one explanation into a lie.
import { DOC, subs } from "./doc.js";

const CA = window.CsdCA;
const $ = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };
const col = (beat) => Math.round(beat / CA.STEP);       // beat -> cell column

let host = null;

// what each lane means, in one line, shown under the lanes
const WHY = [
  ["kick", "a hit on beat 1, 3, 5 or 7"],
  ["snare", "a hit on beat 2, 4, 6 or 8"],
  ["hat", "a hit off the beat, or anywhere inside a run"],
  ["bass", "one note per run, root/fifth — two or more lifts an octave"],
  ["melody", "climbs a step for every lit cell, then folds"],
  ["next", "what the rule does to this row — ▲ born, ▽ died"],
];

export function build(h) { host = h; }

export function paint() {
  if (!host) return;
  const row = DOC.seed;
  const kit = CA.lensDrums(row), bass = CA.lensBass(row), mel = CA.lensMelody(row);

  // drums: three lanes off the one kit
  const lanes = [];
  for (const d of ["kick", "snare", "hat"]) {
    const hits = (kit.ops.find((o) => o.d === d) || { hits: [] }).hits;
    const cells = new Array(CA.N).fill(null);
    for (const [beat, amp] of hits) cells[col(beat)] = { on: true, hot: amp > 0.14 };
    lanes.push({ id: d, cells });
  }
  // bass: the onset cell is solid, the cells it HOLDS through are faint, and the
  // degree is printed on the onset — R (root) / 5 (fifth) / 8 (octave)
  {
    const cells = new Array(CA.N).fill(null);
    for (const [beat, dur, tone] of bass) {
      const c = col(beat), span = Math.max(1, Math.round(dur / CA.STEP));
      cells[c] = { on: true, text: { r5: "R", f6: "5", r6: "8" }[tone] };
      for (let i = 1; i < span && c + i < CA.N; i++) if (!cells[c + i]) cells[c + i] = { hold: true };
    }
    lanes.push({ id: "bass", cells });
  }
  // melody: the bar's HEIGHT is the ladder slot, so the lane draws the contour —
  // which is the thing the prefix-sum read exists to produce
  {
    const cells = new Array(CA.N).fill(null);
    for (const [beat, dur, slot, oct] of mel) {
      const step = slot + oct * 4;                              // 0..7 up the voicing
      cells[col(beat)] = { on: true, h: (step + 1) / 8 };
    }
    lanes.push({ id: "melody", cells });
  }

  // AND WHAT THE RULE DOES TO IT. The eight switches and the sixteen cells were
  // two abstractions side by side with nothing joining them; this is the join.
  // One more lane, same grid, showing the NEXT generation — a cell that came
  // alive and a cell that died are marked differently, so flipping a switch has
  // a visible consequence on the row in front of you rather than three screens
  // down in the orbit.
  {
    const nxt = CA.step(row, DOC.rule), cells = new Array(CA.N).fill(null);
    for (let i = 0; i < CA.N; i++) {
      const was = CA.at(row, i), now = CA.at(nxt, i);
      if (now && !was) cells[i] = { on: true, born: true };
      else if (now) cells[i] = { on: true };
      else if (was) cells[i] = { died: true };
    }
    lanes.push({ id: "next", cells });
  }

  host.textContent = "";
  for (const lane of lanes) {
    const r = $("div", "ca-lane l-" + lane.id);
    r.appendChild($("b", "ca-lanelab", lane.id));
    const g = $("span", "ca-lanecells");
    for (let i = 0; i < CA.N; i++) {
      const c = lane.cells[i];
      const e = $("i", "ca-lanecell" + (c && c.on ? " on" : "") + (c && c.hold ? " hold" : "")
        + (c && c.hot ? " hot" : "") + (c && c.born ? " born" : "") + (c && c.died ? " died" : ""));
      if (c && c.text) e.textContent = c.text;
      if (c && c.h != null) e.style.setProperty("--h", (c.h * 100).toFixed(0) + "%");
      g.appendChild(e);
    }
    r.appendChild(g);
    host.appendChild(r);
  }

  const why = $("p", "ca-note ca-why");
  why.textContent = WHY.map(([k, v]) => k + " = " + v).join("  ·  ");
  host.appendChild(why);
}

subs.push(paint);
