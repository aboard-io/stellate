// main.js — the /ca entry: read the URL, wire the four surfaces, paint once.
//
// The boot sequence is short because the page is short. There is no layout to
// relax, no font race to win and no idle index to build — the document is 24
// bits and everything downstream of it is a pure function that runs in
// microseconds. That is not an optimisation; it is what the design is FOR.
import { DOC, BASES, edit, readUrl, url, roll, resolved, touch, subs } from "./doc.js";
import * as GRID from "./grid.js";
import * as RULES from "./rules.js";
import * as TON from "./tonnetz.js";
import * as PLAY from "./play.js";

const K = window.GenreKernel;
const $ = (id) => document.getElementById(id);

readUrl();

GRID.buildSeed($("caSeed"));
GRID.buildOrbit($("caOrbit"), $("caWord"), $("caOrbitNote"), $("caBits"));
RULES.build($("caRules"), $("caRuleNote"));
TON.build($("caTonnetz"), $("caKey"));
PLAY.build($("caCtl"));

// the base chips. Twelve anchors spread across the space; `?g=` reaches all 274
// (doc.js says why the picker is not a table).
const baseHost = $("caBase");
for (const g of BASES) {
  if (!K.GENRES[g]) continue;
  const b = document.createElement("button");
  b.type = "button"; b.className = "ca-chip";
  b.textContent = g;
  b.addEventListener("click", () => edit({ genre: g }));
  baseHost.appendChild(b);
}
// a genre arriving by URL that is not one of the twelve still has to be visible,
// or the page would silently misreport what it is playing
subs.push(() => {
  let shown = false;
  for (const b of baseHost.children) { const on = b.textContent === DOC.genre; b.classList.toggle("on", on); shown = shown || on; }
  if (!shown) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "ca-chip on"; b.textContent = DOC.genre;
    b.addEventListener("click", () => edit({ genre: DOC.genre }));
    baseHost.appendChild(b);
  }
});

$("caDice").addEventListener("click", () => roll());
$("caShare").addEventListener("click", async (e) => {
  const btn = e.currentTarget, was = btn.textContent;
  try { await navigator.clipboard.writeText(url()); btn.textContent = "✓ copied"; }
  catch (err) { btn.textContent = "⌘C to copy"; }
  setTimeout(() => { btn.textContent = was; }, 1400);
});

// space toggles play, the way it does in every other transport anyone has used —
// but not while a control has focus, or tapping a cell with the keyboard would
// also start the music
window.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || e.target !== document.body) return;
  e.preventDefault();
  PLAY.toggle();
});

touch();

// The probe surface for test/browser/ca.test.js — the gates read this rather
// than scraping selectors or racing a click.
window.__CA = window.__CA || {};
Object.assign(window.__CA, {
  doc: DOC, edit, url, roll,
  resolved: () => resolved(),
  plan: () => resolved().plan.map((p) => ({ pos: p.pos, gen: p.gen, role: p.role, density: p.density, row: p.row,
    drums: p.section.drums, bass: p.section.bass, melody: p.section.melody })),
  ready: true,
});
