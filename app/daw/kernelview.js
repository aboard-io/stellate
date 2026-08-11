// kernelview.js — THE KERNEL, in the flyout. (Was kernelcard.js, page furniture.)
//
// The kernel is the top of the hierarchy but it is not the DAW: a radar and a
// seed box eating the top of every screen pushed the music below the fold on a
// phone and clipped its own axis labels into "ve" and "br". So it moved into the
// rail/sheet as the ROOT VIEW — always one tap away, never in the way — and the
// grid grew a one-line kernel ROW that opens it (grid.js).
//
// What lives here: the genre SCULPTOR (the vector.js radar you drag; the kernel
// finds the anchors nearest that shape and blends them — sculpt.js, unchanged,
// no-snap rule and ghost intact), the tempo tile (the first LIVE tile: it writes
// patch.layers.master.bpm, so tempo is the whole song's), the seed + ⟳, and the
// BASE GENRE picker — the first surface built on the new table primitive: 274
// anchors as one filterable table grouped by form, instead of a lozenge field
// nobody could have scrolled.
import { SONG, edit, state, subs, genreLabel, genreIds, editLayer } from "./song.js";
import { makeVector } from "./vector.js";
import { makeTile } from "./controls.js";
import { readLayer, fmtLayer } from "./layers.js";
import { axesOf, isDraggable } from "./machines/feel-core.js";
import * as FEEL from "./machines/feel.js";
import * as SCULPT from "./sculpt.js";
import * as TRANSPORT from "./transport.js";

const K = window.GenreKernel;
export const HUE = 190;
const $el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };

let vec = null, progEl = null, seedEl = null, glyphs = new Set(), started = false;

// what you set where you set it, the resolved value where you did not — the
// no-snap rule, verbatim from the old deck
function kernelAxes(st) {
  const set = SONG.patch.feel || {};
  return axesOf(st).filter((a) => isDraggable(a.id))
    .map((a) => (set[a.id] != null ? Object.assign({}, a, { v: +set[a.id] }) : a));
}

// the blend's name — the grid row and the view title both say it
export const label = () =>
  (SONG.weights && SONG.weights.length ? SCULPT.label(SONG.weights) : genreLabel(SONG.genre));

// ---------- boot ----------
// One-time: start learning the space and register the repaint sub. The VIEW may
// be built and thrown away many times (every push/back rebuilds it); this is not.
export function init() {
  if (started) return;
  started = true;
  SCULPT.onProgress(paint);
  SCULPT.buildIndex();
  subs.push(paint);
}

// ---------- the view ----------
export function view() {
  return {
    id: "kernel", hue: HUE, title: "kernel",
    render(host, ctx) { renderKernel(host, ctx); },
  };
}

function renderKernel(host, ctx) {
  host.classList.add("dw-kview");

  // ---- the shape ----
  const vhost = $el("div", "dw-kvec");
  host.appendChild(vhost);
  vec = makeVector(vhost, {
    size: 300, hue: HUE,
    // the radar draws its labels OUTSIDE the ring; without a gutter in the
    // viewBox the outermost words are clipped by the svg's own edge (the card
    // era's "ve" / "br"). 46 is the width of the longest axis word at 12px.
    labelPad: 48,
    onCommit: (axisId, v) => {
      FEEL.setAxis(axisId, v);
      if (SCULPT.isReady()) {
        const target = {};
        for (const a of kernelAxes(state())) target[a.id] = a.v;
        const w = SCULPT.weightsFor(target, 3);
        if (w.length) edit({ weights: w });
      }
    },
  });
  progEl = $el("p", "dw-pnote dw-kprog", "");
  host.appendChild(progEl);
  host.appendChild($el("p", "dw-pnote",
    "drag the shape — the space finds the genres nearest it and blends them. " +
    "what you set stays put; the dashed ghost is what the space actually gave you."));

  // ---- the base genre: one table, 274 rows, filter on ----
  const gRow = $el("div", "dw-edrow");
  gRow.appendChild($el("span", "dw-edlab", "genre"));
  const gBtn = $el("button", "dw-pick", "");
  gBtn.type = "button";
  gBtn.appendChild($el("span", "dw-pickval", genreLabel(SONG.genre)));
  gBtn.appendChild($el("span", "dw-pickid", SONG.genre));
  gBtn.appendChild($el("span", "dw-pickmore", "›"));
  gBtn.title = "choose the anchor the song starts from";
  gBtn.addEventListener("click", () => ctx.picker({
    title: "genre", hue: HUE, label: "genre",
    note: "the anchor the song is built from — picking one drops a sculpted blend.",
    columns: [{ id: "name", label: "genre" }, { id: "bpm", label: "bpm", align: "right", w: 72 }],
    groups: genreGroups(),
    value: () => SONG.genre,
    filter: true,
    onPick: (id) => {
      if (id === SONG.genre) return;
      TRANSPORT.songChanged();                 // a new genre is a NEW SONG
      edit({ genre: id, weights: null });
    },
  }));
  gRow.appendChild(gBtn);
  host.appendChild(gRow);

  // ---- tempo + seed ----
  const tiles = $el("div", "dw-ktiles");
  const tileHost = $el("div", "dw-ktile");
  makeTile(tileHost, {
    label: "tempo", hue: HUE,
    read: () => {
      const st = state();
      const set = (SONG.patch.layers || {}).master || {};
      const v = set.bpm != null ? +set.bpm : readLayer(st, "master", "bpm");
      return { v, txt: fmtLayer("master", "bpm", v), stock: set.bpm == null };
    },
    write: (v) => editLayer("master", "bpm", v),
    revert: () => editLayer("master", "bpm", null),
  });
  tiles.appendChild(tileHost);
  host.appendChild(tiles);

  const sRow = $el("div", "dw-edrow");
  sRow.appendChild($el("span", "dw-edlab", "seed"));
  seedEl = document.createElement("input");
  seedEl.id = "dwSeed";
  seedEl.type = "number";
  seedEl.min = "1"; seedEl.max = "99999"; seedEl.step = "1";
  seedEl.className = "dw-seedinput";
  seedEl.value = String(SONG.seed);
  seedEl.setAttribute("aria-label", "seed");
  seedEl.addEventListener("change", () => {
    const v = Math.max(1, Math.min(99999, parseInt(seedEl.value, 10) || 1));
    seedEl.value = String(v);
    TRANSPORT.songChanged();
    edit({ seed: v });
  });
  const re = $el("button", "dw-mini", "⟳ reseed");
  re.type = "button";
  re.id = "dwReseed";
  re.title = "a new random seed — the same rules, a different take";
  re.addEventListener("click", () => { TRANSPORT.songChanged(); edit({ seed: Math.floor(Math.random() * 99999) + 1 }); });
  sRow.append(seedEl, re);
  host.appendChild(sRow);
  host.appendChild($el("p", "dw-pnote",
    "the seed picks the take; every rule on every other surface survives it."));

  paint();
}

// genres grouped by the anchor's FORM — the engine's own word for how a track is
// laid out (dj / drop / vamp / song), which is the most useful thing to scan by.
function genreGroups() {
  const G = (K && K.GENRES) || {};
  const byForm = new Map();
  for (const id of genreIds()) {
    const g = G[id] || {};
    const form = g.form || "song";
    if (!byForm.has(form)) byForm.set(form, []);
    const bpm = Array.isArray(g.bpm) ? Math.round(g.bpm[0]) + "–" + Math.round(g.bpm[1]) : "";
    byForm.get(form).push({ id, cells: [id.replace(/_/g, " "), bpm], title: g.label || id });
  }
  return [...byForm.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([form, rows]) => ({ label: form, rows }));
}

// ---------- repaint (song subs + sculpt progress) ----------
export function paint() {
  // the radar/seed only exist while the kernel view is on screen
  if (vec && vec.el && vec.el.isConnected) {
    const st = state();
    const axes = kernelAxes(st).map((a) => Object.assign({ kind: "direct" }, a));
    vec.set(axes);
    vec.setGhost(axesOf(st).filter((a) => isDraggable(a.id)).map((a) => a.v));
  }
  if (seedEl && seedEl.isConnected && +seedEl.value !== SONG.seed) seedEl.value = String(SONG.seed);
  if (progEl && progEl.isConnected) {
    const p = SCULPT.progress();
    progEl.textContent = p.done ? "" : `learning the space… ${p.built}/${p.total || "?"}`;
    progEl.hidden = p.done;
  }
  for (const g of [...glyphs]) {
    if (!g.isConnected) { glyphs.delete(g); continue; }
    drawGlyph(g);
  }
}

// ---------- the ◇ glyph (the grid's kernel row) ----------
// The same shape at 40px, non-interactive: the row is the button.
export function paintGlyph(svg) {
  glyphs.add(svg);
  drawGlyph(svg);
  return svg;
}
function drawGlyph(svg) {
  const axes = kernelAxes(state());
  if (!axes.length) return;
  const C = 20, R = 16;
  const pts = axes.map((a, i) => {
    const ang = -Math.PI / 2 + (i * Math.PI * 2) / axes.length;
    const r = Math.max(0.08, Math.min(1, a.v)) * R;
    return (C + Math.cos(ang) * r).toFixed(1) + "," + (C + Math.sin(ang) * r).toFixed(1);
  }).join(" ");
  svg.innerHTML = `<circle cx="20" cy="20" r="16" class="dw-kthumbring"/><polygon points="${pts}" class="dw-kthumbpoly"/>`;
}
