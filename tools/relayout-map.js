#!/usr/bin/env node
// relayout-map.js — re-bake app/world.js POS so every genre's NAME has room.
//
//   node tools/relayout-map.js [--write] [--capacity 400] [--report]
//
// THE PROBLEM THIS SOLVES. drawMap fits each axis to the viewport
// INDEPENDENTLY, so the world's own aspect ratio is invisible in the render —
// what matters is the distribution in normalized [0,1] space. The baked layout
// grew as a tall thin ribbon (2.5k x 25k, 1:10), which after the per-axis fit
// stacks stars vertically: measured median gap between vertical neighbours is
// 3.9 px against a 14.4 px label height, so more than half the catalogue sits
// closer together than one name is tall. That is why names get culled — not
// area. At default zoom the rendered world is 12.5M px² and 400 labels want
// 0.57M of it: FOUR AND A HALF PERCENT. There was never a space problem, only
// a packing one.
//
// WHAT IT DOES. Relaxes the label RECTANGLES (not the dots — the dot is 2px and
// the name beside it is ~105x14) until none overlap, with each star on a weak
// spring to where it started so musical neighbourhoods survive. Boxes are
// inflated by sqrt(capacity/current) so the result has room for genres that do
// not exist yet: at --capacity 400 every name still places with a catalogue
// half again as large.
//
// WHAT IT COSTS, because this is not free. weightsAt() reads WORLD-SPACE
// distance, so moving a star changes the blend you hear at a point, and paths
// are stored in share URLs as coordinates — an old ?path= link lands in the
// same place on a different musical landscape. The spring keeps that drift as
// small as the packing allows; --report prints how much neighbourhood survived.
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const WORLD = path.join(ROOT, "app", "world.js");
const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i >= 0 ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes("--" + n);

const CAPACITY = +arg("capacity", 400);
// The reference render the packing is solved against. Labels are laid out in
// px, so the solve needs one canonical viewport; a wider screen only ever has
// MORE room than this, and zoom adds more still.
// Solved at the GATE's viewport (test/explorer-ui-test.js uses 1200x850), not a
// generous desktop one. Label px size depends only on zoom, but the canvas they
// must fit in is vw*k by vh*k — so the smaller the viewport, the tighter the
// pack. Solve the tight case and the roomy one follows for free.
const VW = 1200, VH = 850, K = 2.8;
// STARS must stay apart too, not just their names: explorer-ui asserts a 40px
// floor between any two dots at default zoom. Separating label rectangles alone
// happily slides two dots on top of each other (salsa/crumpetwhirl hit 35.7px
// on the first attempt), so carry it as its own constraint with headroom.
const MIN_DOT = 46;
// THE FACTOR THAT MAKES THIS A REAL PROBLEM: drawMap grows the type with zoom,
// fs = min(3, max(1, k^0.85)), so at the DEFAULT k=2.8 the font is 2.4x — not
// 1x. Labels at default zoom are ~215x32 px, not ~90x14. Miss this and the
// packing looks solved when it is not; it is the whole difference between "3%
// occupancy, nothing to do" and a genuine constraint.
const FS = Math.min(3, Math.max(1, Math.pow(K, 0.85)));
const FPX = 11 * FS;                // inactive-genre font size (active is 12)
const MEASURED_AT = 12;             // app/label-widths.json was measured at 12px
const WSCALE = FPX / MEASURED_AT;   // ...so scale those widths to the real size
const LABEL_H = FPX * 1.2;          // lbox(): fpx*(0.92+0.28)
const LABEL_DX = 9 * FS;            // the name sits this far right of the star
const PAD = 6;                      // lbox() adds 3px either side
const MARGIN = 3;                   // breathing room between two names

// ---- read the baked POS + the measured label widths ------------------------
const src = fs.readFileSync(WORLD, "utf8");
const block = src.match(/export const POS=\{([\s\S]*?)\n\};/);
if (!block) { console.error("could not find the POS block in app/world.js"); process.exit(1); }
const POS = {};
for (const m of block[1].matchAll(/(\w+):\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/g))
  POS[m[1]] = [+m[2], +m[3]];

// Label widths come from a browser measurement (the LOD cull measures the same
// monospace metrics). Fall back to a character estimate if the dump is absent,
// so this tool still runs in CI or on a fresh clone.
let WIDTH = {};
const dump = arg("widths", path.join(ROOT, "app", "label-widths.json"));
if (fs.existsSync(dump)) WIDTH = JSON.parse(fs.readFileSync(dump, "utf8"));
const K_ = require(path.join(ROOT, "engine", "genre-kernel.js"));
const labelOf = (g) => (K_.GENRES[g] && K_.GENRES[g].label) || g;
const widthOf = (g) => (WIDTH[g] != null ? WIDTH[g] : labelOf(g).length * 7.1) * WSCALE;

const names = Object.keys(POS);
const bbox = names.reduce((a, g) => ({
  minx: Math.min(a.minx, POS[g][0]), maxx: Math.max(a.maxx, POS[g][0]),
  miny: Math.min(a.miny, POS[g][1]), maxy: Math.max(a.maxy, POS[g][1]),
}), { minx: 1e9, maxx: -1e9, miny: 1e9, maxy: -1e9 });
const WW = bbox.maxx + 90, WH = bbox.maxy + 90;   // recomputeWorld's convention

// ---- solve in RENDERED PIXELS, which is where the collisions actually are ---
const inflate = Math.sqrt(CAPACITY / names.length);
const SW = VW * K, SH = VH * K;                   // rendered world size
const pt = names.map((g) => ({
  g,
  x: (POS[g][0] / WW) * SW, y: (POS[g][1] / WH) * SH,
  x0: (POS[g][0] / WW) * SW, y0: (POS[g][1] / WH) * SH,
  w: (widthOf(g) + PAD + LABEL_DX + MARGIN) * inflate,
  h: (LABEL_H + MARGIN) * inflate,
}));

// Axis-aligned overlap removal. Each pair that intersects is pushed apart along
// its MINIMUM translation axis, which keeps displacement small and preserves the
// relative arrangement far better than a radial shove.
function relax(iters, spring) {
  for (let it = 0; it < iters; it++) {
    let moved = 0;
    // sweep by y so the common case (a vertical stack) resolves in few passes
    pt.sort((a, b) => a.y - b.y);
    for (let i = 0; i < pt.length; i++) {
      for (let j = i + 1; j < pt.length; j++) {
        const a = pt[i], b = pt[j];
        const dy = Math.abs(a.y - b.y), needY = (a.h + b.h) / 2;
        if (dy >= needY) break;                    // sorted: nothing below can hit
        // labels extend RIGHT of the star, so the x extent is asymmetric
        const ax1 = a.x, ax2 = a.x + a.w, bx1 = b.x, bx2 = b.x + b.w;
        if (ax2 <= bx1 || bx2 <= ax1) continue;
        const ovX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
        const ovY = needY - dy;
        if (ovX <= 0 || ovY <= 0) continue;
        if (ovY <= ovX) {                          // cheaper to separate vertically
          const push = (ovY / 2) * 0.5, s = a.y <= b.y ? -1 : 1;
          a.y += push * s; b.y -= push * s;
        } else {
          const push = (ovX / 2) * 0.5, s = a.x <= b.x ? -1 : 1;
          a.x += push * s; b.x -= push * s;
        }
        moved++;
      }
    }
    // DOT separation: the names may clear while the stars themselves collide.
    for (let i = 0; i < pt.length; i++) {
      for (let j = i + 1; j < pt.length; j++) {
        const a = pt[i], b = pt[j];
        const dy = b.y - a.y; if (dy >= MIN_DOT) break;
        const dx = a.x - b.x, d = Math.hypot(dx, dy);
        if (d >= MIN_DOT || d === 0) continue;
        const push = (MIN_DOT - d) / 2 * 0.5, ux = dx / d, uy = (a.y - b.y) / d;
        a.x += ux * push; a.y += uy * push; b.x -= ux * push; b.y -= uy * push;
        moved++;
      }
    }
    // weak pull home: without it the field slowly boils and neighbourhoods rot
    for (const p of pt) { p.x += (p.x0 - p.x) * spring; p.y += (p.y0 - p.y) * spring; }
    // keep everything on the board
    for (const p of pt) {
      p.x = Math.max(4, Math.min(SW - p.w - 4, p.x));
      p.y = Math.max(8, Math.min(SH - 8, p.y));
    }
    if (!moved) return it + 1;
  }
  return iters;
}

const used = relax(+arg("iters", 600), +arg("spring", 0.02));

// ---- how many labels can actually place now? (the app's own greedy pass) ----
function placeable(list, scale) {
  const boxes = [];
  const hit = (b) => boxes.some((o) => b.l < o.r && b.r > o.l && b.t < o.b && b.b > o.t);
  let ok = 0;
  for (const p of list) {
    const b = { l: p.x, r: p.x + p.w / scale, t: p.y - (p.h / scale) / 2, b: p.y + (p.h / scale) / 2 };
    if (!hit(b)) { boxes.push(b); ok++; }
  }
  return ok;
}
const before = placeable(names.map((g) => ({
  x: (POS[g][0] / WW) * SW, y: (POS[g][1] / WH) * SH,
  w: (widthOf(g) + PAD + LABEL_DX), h: LABEL_H })), 1);
const after = placeable(pt.map((p) => ({ x: p.x, y: p.y, w: p.w / inflate, h: p.h / inflate })), 1);

// ---- neighbourhood preservation: did the music survive the move? -----------
function knn(getXY, k = 6) {
  const out = {};
  for (const g of names) {
    const [ax, ay] = getXY(g);
    out[g] = names.filter((h) => h !== g)
      .map((h) => { const [bx, by] = getXY(h); return [h, (ax - bx) ** 2 + (ay - by) ** 2]; })
      .sort((a, b) => a[1] - b[1]).slice(0, k).map((e) => e[0]);
  }
  return out;
}
const byName = Object.fromEntries(pt.map((p) => [p.g, p]));
const n0 = knn((g) => POS[g]);
const n1 = knn((g) => [byName[g].x * (WW / SW), byName[g].y * (WH / SH)]);
let kept = 0, tot = 0;
for (const g of names) { const s = new Set(n0[g]); kept += n1[g].filter((h) => s.has(h)).length; tot += n1[g].length; }

console.log(`relayout: ${names.length} genres, packing for ${CAPACITY} (boxes inflated ${inflate.toFixed(2)}x)`);
console.log(`  iterations used      ${used}`);
console.log(`  labels placeable     ${before} -> ${after}  (of ${names.length})`);
console.log(`  6-NN neighbourhood   ${((kept / tot) * 100).toFixed(1)}% preserved`);
const drift = pt.map((p) => Math.hypot(p.x - p.x0, p.y - p.y0)).sort((a, b) => a - b);
console.log(`  star drift (px)      median ${drift[drift.length >> 1].toFixed(0)}  p90 ${drift[Math.floor(drift.length * 0.9)].toFixed(0)}  max ${drift[drift.length - 1].toFixed(0)}`);

if (!has("write")) { console.log("\n(dry run — pass --write to re-bake app/world.js POS)"); process.exit(0); }

// ---- write the block back --------------------------------------------------
const outPos = {};
for (const p of pt) outPos[p.g] = [Math.round(p.x * (WW / SW)), Math.round(p.y * (WH / SH))];
const ordered = names.map((g) => `  ${g}:[${outPos[g][0]},${outPos[g][1]}]`);
const rows = [];
for (let i = 0; i < ordered.length; i += 3) rows.push(ordered.slice(i, i + 3).join(",").replace(/^\s+/, "  "));
const header = `// BAKED STAR POSITIONS — generated by tools/relayout-map.js.
//
// Solved as LABEL RECTANGLES, not dots: the star is 2px and the name beside it
// is ~105x14, so the packing that matters is the names'. Boxes were inflated
// for a catalogue of ${CAPACITY}, so a genre added tomorrow still gets a name
// without another re-bake.
//
// Re-bake with:  node tools/relayout-map.js --write --capacity ${CAPACITY}
// (measure fresh label widths into app/label-widths.json first if the labels
// have been renamed — the solver falls back to a character estimate otherwise.)
export const POS={
`;
const next = src.replace(/(\/\/ [^\n]*\n)*export const POS=\{[\s\S]*?\n\};/, header + rows.join(",\n") + "\n};");
fs.writeFileSync(WORLD, next);
console.log(`\n✓ re-baked ${names.length} positions into app/world.js`);
