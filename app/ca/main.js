// main.js — the /ca entry: read the URL, wire the four surfaces, paint once.
//
// The boot sequence is short because the page is short. There is no layout to
// relax, no font race to win and no idle index to build — the document is 24
// bits and everything downstream of it is a pure function that runs in
// microseconds. That is not an optimisation; it is what the design is FOR.
import { DOC, BASES, BARS, BPM_MIN, BPM_MAX, edit, readUrl, url, roll, resolved, touch, subs,
  bpm, bpmSet, setBpm, bpmRevert, undo, redo, canUndo, canRedo, playState as PLAYSTATE,
  beginGesture, endGesture } from "./doc.js";
import * as GRID from "./grid.js";
import * as RULES from "./rules.js";
import * as TON from "./tonnetz.js";
import * as PLAY from "./play.js";
import { makeTile } from "./tile.js";
import * as LANES from "./lanes.js";
import * as BITS from "./rulebits.js";

const K = window.GenreKernel;
const $ = (id) => document.getElementById(id);

readUrl();

GRID.buildSeed($("caSeed"));
GRID.buildOrbit($("caOrbit"), $("caWord"), $("caOrbitNote"), $("caBits"));
LANES.build($("caLanes"));
BITS.build($("caBits8"));
RULES.build($("caRules"), $("caRuleNote"));
TON.build($("caTonnetz"), $("caKey"));
PLAY.build($("caCtl"));

// THE TEMPO, beside the bar it counts. Tempo used to ride the base genre alone,
// so "make it faster" meant "pick a different orchestra" — which is backwards:
// how fast the bar goes is composition, the instruments playing it are not.
// Absent = the genre's own, and double-tap gives that back (doc.js says why the
// revert drops the field instead of writing the number).
const tempoTile = makeTile({
  label: "tempo", min: BPM_MIN, max: BPM_MAX, step: 1, big: 5,
  get: bpm, set: setBpm, isSet: bpmSet, revert: bpmRevert,
  begin: beginGesture, end: endGesture,
  fmt: (v) => Math.round(v) + " bpm",
});
$("caTempo").appendChild(tempoTile);
subs.push(() => tempoTile.repaint());

// the beat ruler under the row — sixteen cells is a BAR, and without this it is
// sixteen anonymous boxes
const beats = $("caBeats");
for (let i = 0; i < 16; i++) {
  const b = document.createElement("i");
  b.textContent = i % 2 === 0 ? String(1 + i / 2) : "";
  if (i % 2 === 0) b.className = "on";
  beats.appendChild(b);
}

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

// HOW LONG THE SONG IS. The orbit can run for hundreds of generations, so
// something has to say where to stop — and that is a composer's decision, not
// the automaton's. Four chips, because it is a choice and not an amount.
const barsHost = $("caBars");
for (const n of BARS) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "ca-chip";
  b.textContent = n + " sections";
  b.addEventListener("click", () => edit({ bars: n }));
  barsHost.appendChild(b);
}
subs.push(() => { for (const b of barsHost.children) b.classList.toggle("on", b.textContent === DOC.bars + " sections"); });

// UNDO. Every edit here is GLOBAL — one cell rewrites the whole song — so an
// accidental tap is not recoverable by hand the way a wrong note is.
$("caUndo").addEventListener("click", () => undo());
$("caRedo").addEventListener("click", () => redo());
subs.push(() => { $("caUndo").disabled = !canUndo(); $("caRedo").disabled = !canRedo(); });

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
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    return e.shiftKey ? redo() : undo();
  }
  if (e.target !== document.body) return;
  if (e.code === "Space") { e.preventDefault(); return PLAY.toggle(); }
  // L for loop, the way every DAW spells it
  if (e.key.toLowerCase() === "l") { e.preventDefault(); window.__CA.transport.setLoop(!window.__CA.transport.isLoop()); }
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
  playSections: () => PLAYSTATE().sections.length,
  ready: true,
});
