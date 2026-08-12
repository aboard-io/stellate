// main.js — /fugue: the page IS the documentation.
//
// Every option the system has gets a section, in the order you would meet them,
// and the EFFECT of each is rendered in the element directly below its prose. So
// scrolling top to bottom is reading the manual and playing the instrument at
// the same time, and by the bottom you have been shown all six options and
// nothing else — the system is small enough that "exhaustive" is a page.
//
// SCROLLING IS THE POINT HERE, which is the opposite of /ca and deliberately so.
// /ca is an instrument you play with a thumb and must not scroll; this is an
// explanation you read. Same engine, same kernel shape, different job.
//
// EVERY SECTION PLAYS ITS OWN CONFIGURATION, not the finished piece: the answer
// section plays two voices, the exposition section plays the entries so far, the
// transform section plays only what you added. Hearing the whole fugue when you
// are being shown one option teaches nothing about that option.
import { DOC, subs, edit, url, readUrl, state, planNow, cellsNow } from "./doc.js";

const F = window.CsdFugue, K = window.GenreKernel;
const $ = (id) => document.getElementById(id);
const el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };

// ---------------------------------------------------------------- the subject
// An 8 x N ladder. One note per column, because a subject is a LINE — the same
// rule /daw's phrase editor holds, and the reason a fugue subject is singable.
const COLS = 16;
function buildGrid() {
  const host = $("fgGrid");
  host.textContent = "";
  for (let g = F.LADDER - 1; g >= 0; g--) {
    const row = el("div", "fg-gridrow");
    row.appendChild(el("b", "fg-gridlab", ["root", "3rd", "5th", "top"][g % 4] + (g >= 4 ? "′" : "")));
    for (let c = 0; c < COLS; c++) {
      const b = el("button", "fg-cell");
      b.type = "button"; b.dataset.c = String(c); b.dataset.g = String(g);
      b.setAttribute("aria-label", "beat " + (1 + c * 0.5) + ", " + ["root", "3rd", "5th", "top"][g % 4] + (g >= 4 ? " octave up" : ""));
      b.addEventListener("click", () => toggleNote(c, g));
      row.appendChild(b);
    }
    host.appendChild(row);
  }
}
function toggleNote(c, g) {
  const at = c * 0.5;
  const s = DOC.subject.filter((n) => n[0] !== at);
  const had = DOC.subject.find((n) => n[0] === at && n[2] === g);
  if (!had) s.push([at, 0.5, g]);
  s.sort((a, b) => a[0] - b[0]);
  // DURATIONS ARE DERIVED, never drawn: each note holds until the next onset, so
  // a drawn line comes out legato instead of a row of staccato eighths (the
  // phrase-editor rule from docs/DAW.md, which learned it the hard way).
  for (let i = 0; i < s.length; i++) s[i][1] = Math.min((i + 1 < s.length ? s[i + 1][0] : s[i][0] + 0.5) - s[i][0], 2);
  edit({ subject: s.length ? s : DOC.subject });
}
function paintGrid() {
  for (const b of $("fgGrid").querySelectorAll(".fg-cell")) {
    const c = +b.dataset.c, g = +b.dataset.g;
    const on = DOC.subject.some((n) => Math.round(n[0] / 0.5) === c && n[2] === g);
    b.classList.toggle("on", on);
    b.classList.toggle("beat", c % 4 === 0);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  }
  $("fgSubHint").textContent = DOC.subject.length + " notes · " + F.spanOf(DOC.subject) + " beats long";
}

// ------------------------------------------------------------------ the rolls
// A tiny read-only ladder view, used to show a transform or an entry pair. It is
// the same 8-row geometry as the editor above, so a shape you drew there is
// recognisable here — which is the whole point of showing it twice.
function roll(host, lines, span, h) {
  host.textContent = "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const W = 320, H = h || 64;
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.setAttribute("class", "fg-rollsvg");
  const sp = Math.max(span || 1, 1);
  lines.forEach((line, li) => {
    for (const [b, d, g] of line.notes) {
      const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      r.setAttribute("x", (b / sp * W).toFixed(1));
      r.setAttribute("y", ((F.LADDER - 1 - g) / F.LADDER * (H - 6) + 3).toFixed(1));
      r.setAttribute("width", Math.max(2, (d / sp * W) - 1).toFixed(1));
      r.setAttribute("height", ((H - 6) / F.LADDER - 1).toFixed(1));
      r.setAttribute("class", "fg-note v" + (li % 4));
      svg.appendChild(r);
    }
  });
  host.appendChild(svg);
}

// -------------------------------------------------------------- the entry map
// When each voice comes in, as bars on a shared timeline. This is the only way
// stretto is legible: the bars slide left and start overlapping.
function entryMap(host) {
  const p = planNow();
  host.textContent = "";
  for (let v = 0; v < p.voices; v++) {
    const lane = el("div", "fg-lane");
    lane.appendChild(el("b", "fg-lanelab", "voice " + (v + 1)));
    const track = el("span", "fg-track");
    for (const e of p.entries.filter((x) => x.voice === v)) {
      const bar = el("i", "fg-entry" + (e.role === "answer" ? " ans" : ""), e.role);
      const l = e.at / p.total * 100;
      bar.style.left = l.toFixed(2) + "%";
      // clamped as well as fixed upstream: a bar can never be wider than the
      // timeline it is drawn on, whatever the plan says
      bar.style.width = Math.max(2, Math.min(100 - l, F.spanOf(F.transform(p.subject, e.transform)) / p.total * 100)).toFixed(2) + "%";
      track.appendChild(bar);
    }
    lane.appendChild(track);
    host.appendChild(lane);
  }
}

// ---------------------------------------------------------------- the choices
function chips(host, values, get, set, label) {
  host.textContent = "";
  for (const [v, text] of values) {
    const b = el("button", "fg-chip", text);
    b.type = "button"; b.dataset.v = String(v);
    b.addEventListener("click", () => set(v));
    host.appendChild(b);
  }
  return () => { for (const b of host.children) b.classList.toggle("on", String(get()) === b.dataset.v); };
}
const painters = [];

function buildTransforms() {
  const host = $("fgTrans");
  host.textContent = "";
  for (const t of F.TRANSFORMS) {
    if (t === "subject") continue;
    const card = el("button", "fg-tcard");
    card.type = "button"; card.dataset.t = t;
    card.appendChild(el("b", "fg-tname", t));
    const box = el("div", "fg-troll");
    card.appendChild(box);
    card.appendChild(el("em", "fg-tcount"));
    card.addEventListener("click", () => {
      const later = DOC.later.slice();
      const i = later.indexOf(t);
      if (i >= 0) later.splice(i, 1); else later.push(t);
      edit({ later });
    });
    host.appendChild(card);
    card._box = box;
  }
}
function paintTransforms() {
  for (const card of $("fgTrans").children) {
    const t = card.dataset.t;
    const line = F.transform(DOC.subject, t);
    roll(card._box, [{ notes: line }], Math.max(F.spanOf(line), F.spanOf(DOC.subject) * 2), 48);
    const n = DOC.later.filter((x) => x === t).length;
    card.classList.toggle("on", n > 0);
    card.setAttribute("aria-pressed", n > 0 ? "true" : "false");
    card.querySelector(".fg-tcount").textContent = n ? "added" : "";
  }
  $("fgLaterHint").textContent = DOC.later.length
    ? DOC.later.join(" → ") + " after the exposition"
    : "no later entries yet — the piece is just the exposition";
}

// -------------------------------------------------------------------- play
// Each section plays ITS OWN configuration. `scope` trims the plan to the part
// the section is about, which is the difference between a demonstration and a
// distraction.
let handle = null, playing = null;
async function play(scope) {
  stop();
  playing = scope;
  paintPlay();
  $("fgRead").textContent = "starting…";
  try {
    handle = await window.FaustLive.exploreLive(() => state(scope), (m) => { $("fgRead").textContent = m || ""; },
      { masterVol: 1, onBar: () => { $("fgRead").textContent = "playing · " + scope; }, onLoad: () => {} });
  } catch (e) {
    playing = null; paintPlay();
    $("fgRead").textContent = "live failed: " + ((e && e.message) || e);
  }
}
function stop() {
  try { if (handle && handle.stop) handle.stop(); } catch (e) {}
  handle = null; playing = null;
  $("fgRead").textContent = "";
  paintPlay();
}
function paintPlay() {
  for (const b of document.querySelectorAll(".fg-play")) {
    const on = playing === b.dataset.play;
    b.classList.toggle("on", on);
    b.textContent = (on ? "■ stop" : b.dataset.label);
  }
}

// ------------------------------------------------------------------- boot
readUrl();
buildGrid();
buildTransforms();

const pAns = chips($("fgAnswer"), [[0, "unison"], [1, "+1 · the third"], [2, "+2 · the fifth"], [3, "+3 · the top"], [4, "+4 · the octave"]],
  () => DOC.answer, (v) => edit({ answer: v }));
const pVox = chips($("fgVoices"), [[2, "2 voices"], [3, "3 voices"], [4, "4 voices"]],
  () => DOC.voices, (v) => edit({ voices: v }));
const pStr = chips($("fgStretto"), [[1, "1 · in turn"], [0.75, "¾"], [0.5, "½ · stretto"], [0.25, "¼ · pile-up"]],
  () => DOC.overlap, (v) => edit({ overlap: v }));
const BASES = ["neoclassical", "prelude", "citypop", "ambient", "ragtime", "vaporwave", "krautrock", "dub"];
const pBase = chips($("fgBase"), BASES.filter((g) => K.GENRES[g]).map((g) => [g, g]),
  () => DOC.genre, (v) => edit({ genre: v }));
const pPads = chips($("fgPads"), [[false, "no pads"], [true, "pads under it"]],
  () => DOC.pads, (v) => edit({ pads: v }));

for (const b of document.querySelectorAll(".fg-play")) {
  b.dataset.label = b.textContent;
  b.addEventListener("click", () => (playing === b.dataset.play ? stop() : play(b.dataset.play)));
}
$("fgStop").addEventListener("click", stop);
$("fgLink").addEventListener("click", async (e) => {
  const btn = e.currentTarget, was = btn.textContent;
  try { await navigator.clipboard.writeText(url()); btn.textContent = "✓ copied"; }
  catch (err) { btn.textContent = "⌘C"; }
  setTimeout(() => { btn.textContent = was; }, 1400);
});

function paint() {
  paintGrid();
  [pAns, pVox, pStr, pBase, pPads].forEach((f) => f());
  const p = planNow();
  // the answer section shows the two lines it is about, and nothing else
  roll($("fgAnsRoll"), [{ notes: DOC.subject },
    { notes: F.shiftDeg(DOC.subject, DOC.answer).map(([b, d, g]) => [b + p.span, d, g]) }], p.span * 2, 64);
  entryMap($("fgMap"));
  entryMap($("fgMap2"));
  paintTransforms();
  const c = cellsNow();
  roll($("fgFull"), [{ notes: c.upper.map(([b, d, i, o]) => [b, d, i + o * 4]) },
    { notes: c.lower.map(([b, d, i, o]) => [b, d, i + o * 4]) }], p.total, 150);
  $("fgSummary").textContent = DOC.subject.length + " notes, " + DOC.voices + " voices entering "
    + (DOC.overlap === 1 ? "in turn" : "every " + (DOC.overlap * p.span) + " beats")
    + ", the answer at " + (DOC.answer ? "+" + DOC.answer : "unison")
    + (DOC.later.length ? ", then " + DOC.later.join(" and ") : "")
    + " — " + p.total + " beats of counterpoint, played by " + DOC.genre + ".";
  paintPlay();
}
subs.push(paint);
paint();

window.__FUGUE = { doc: DOC, edit, url, plan: planNow, cells: cellsNow, play, stop,
  isPlaying: () => !!playing,
  rms: () => { try { return handle && handle.rms ? handle.rms() : null; } catch (e) { return null; } },
  ready: true };
