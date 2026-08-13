// tri.js — the terminal wrapper: ASCII piano rolls for all three genres.
// Nothing musical happens here; it is a PRINTER over kernel.js + genres.js.
//   node nukernel/tri.js
const { render, drums, bass } = require("./kernel.js");
const { DEFAULT: SUBJ, GENRES } = require("./genres.js");

const BARS = 8;
const GLYPH = "0123456789abcdefghijklmnopqrstuvwxyz";

function roll(name, cols = 64) {
  const g = GENRES[name], ev = render(SUBJ, g, BARS);
  const lo = Math.min(...ev.map(e => e.n));
  console.log(`\n${name.toUpperCase()}  rate=${g.rate} voices=${g.voices} ` +
              `events=${ev.length}  span=${lo}..${Math.max(...ev.map(e => e.n))}`);

  for (let v = 0; v < g.voices; v++) {
    const row = Array(cols).fill(".");
    for (const e of ev.filter(e => e.v === v)) {
      const c = Math.round(e.t), ch = GLYPH[(e.n - lo) % GLYPH.length];
      if (c < cols) row[c] = e.sld ? "~" : e.acc ? ch.toUpperCase() : ch;
    }
    console.log(`  v${v} ${g.realize(v)[0]} |${row.join("")}|`);
  }

  const dr = drums(SUBJ, g, BARS), lanes = [...new Set(dr.map(e => e.d))];
  for (const d of lanes) {
    const row = Array(cols).fill(".");
    for (const e of dr.filter(e => e.d === d)) {
      const c = Math.round(e.t);
      if (c < cols) row[c] = e.acc ? d.toUpperCase() : d;
    }
    console.log(`  ${d}      |${row.join("")}|`);
  }
  if (!lanes.length) console.log("  (no kit)");

  const brow = Array(cols).fill(".");
  for (const e of bass(SUBJ, g, BARS)) {
    const c = Math.round(e.t);
    if (c < cols) brow[c] = "IiVvXxL"[e.r];
  }
  console.log(`  bass   |${brow.join("")}|  harmony=${g.harmony}`);
}

Object.keys(GENRES).forEach(n => roll(n));
