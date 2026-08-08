// deck.js — THE DECK. One vertical scroll: every layer is a strip, and every
// strip is what it plays on top with the knobs that make it underneath.
//
//     ┌───────────────────────────────────────┐
//     │ kernel        tempo tract             │   ← what the whole song does
//     │               structure tract          │
//     │               ● kernel radar           │
//     ├───────────────────────────────────────┤
//     │ chords        chord lane               │
//     │               ● chords radar           │
//     ├───────────────────────────────────────┤
//     │ melody        piano roll               │
//     │               ● melody radar + refiner │
//     └───────────────────────────────────────┘
//
// The single orbit is gone. It answered "where am I in the stack" but made you
// zoom past the thing you were trying to hear — the roll and the knobs that shape
// it were never on screen together. Under-the-roll puts a cause next to its
// effect: turn a spoke, watch THAT roll redraw.
//
// LIKE WITH LIKE, top to bottom: the whole song (kernel + tempo + form), then the
// harmony, then the four voices, then the samples, then the transforms that run
// over all of it. Reading down is still reading the pipeline.
import { subs, state, events, sectionSpans, trackEvents, trackMachines, SONG, edit } from "./song.js";
import { drawRoll } from "./roll.js";
import { makeVector } from "./vector.js";
import { LAYERS, layerById } from "./layers.js";
import * as FEEL from "./machines/feel.js";
import * as SCULPT from "./sculpt.js";
import { renderRefiner } from "./panel.js";

// layer id -> what it plays, in the order the deck reads
const STRIPS = [
  { layer: "genre",   label: "kernel",  tracts: true },
  { layer: "chords",  label: "chords",  lane: "chords" },
  { layer: "melody",  label: "melody",  lane: "pitched", voice: "melody" },
  { layer: "bass",    label: "bass",    lane: "pitched", voice: "bass" },
  { layer: "pad",     label: "pad",     lane: "pitched", voice: "pad" },
  { layer: "drums",   label: "drums",   lane: "drums" },
  { layer: "samples", label: "samples", lane: "found" },
  { layer: "notefx",  label: "note fx" },
];

const strips = new Map();
const el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };

export function buildDeck(root) {
  root.textContent = "";
  strips.clear();

  for (const S of STRIPS) {
    const L = layerById(S.layer);
    const sec = el("section", "dw-strip2");
    sec.dataset.layer = S.layer;
    sec.style.setProperty("--hue", L.hue);

    const head = el("div", "dw-s2head");
    head.appendChild(el("h2", "dw-s2name", S.label));
    head.appendChild(el("span", "dw-s2machine"));
    head.appendChild(el("span", "dw-s2count"));
    sec.appendChild(head);

    // TRACTS (kernel only): tempo and structure ride ATOP the kernel radar,
    // because they are the two things that describe the whole song rather than
    // any one voice.
    if (S.tracts) {
      const tw = el("div", "dw-tracts");
      for (const id of ["tempo", "structure"]) {
        const t = el("div", "dw-tract");
        t.appendChild(el("span", "dw-tlab", id));
        const c = document.createElement("canvas");
        c.className = "dw-tcanvas"; c.dataset.tract = id;
        t.appendChild(c);
        tw.appendChild(t);
      }
      sec.appendChild(tw);
    }

    if (S.lane) {
      const wrap = el("div", "dw-rollwrap");
      const cv = document.createElement("canvas");
      cv.className = "dw-roll"; cv.setAttribute("role", "img");
      wrap.appendChild(cv);
      sec.appendChild(wrap);
    }

    const vhost = el("div", "dw-s2vec");
    sec.appendChild(vhost);
    const refiner = el("div", "dw-s2refine");
    sec.appendChild(refiner);

    root.appendChild(sec);

    const vec = makeVector(vhost, {
      size: 300, hue: L.hue,
      onCommit: (axisId, v) => commit(S.layer, axisId, v),
    });
    strips.set(S.layer, { sec, vec, refiner, spec: S,
      cv: sec.querySelector(".dw-roll"),
      tracts: [...sec.querySelectorAll(".dw-tcanvas")],
      machineEl: head.querySelector(".dw-s2machine"),
      countEl: head.querySelector(".dw-s2count") });
  }

  SCULPT.onProgress(() => paintDeck());
  SCULPT.buildIndex();
  paintDeck();
  subs.push(paintDeck);
  window.__DAWDECK = { layers: STRIPS.map((s) => s.layer), focus: () => null, focusLayer: () => {} };
  return root;
}

// the kernel ring shapes the BLEND; every other ring writes its own layer
function commit(layerId, axisId, v) {
  if (layerId === "genre") {
    FEEL.setAxis(axisId, v);
    if (SCULPT.isReady()) {
      const target = {};
      for (const a of kernelAxes(state())) target[a.id] = a.v;
      const w = SCULPT.weightsFor(target, 3);
      if (w.length) edit({ weights: w });
    }
    return;
  }
  const layers = Object.assign({}, SONG.patch.layers || {});
  layers[layerId] = Object.assign({}, layers[layerId] || {}, { [axisId]: v });
  edit({ patch: Object.assign({}, SONG.patch, { layers }) });
}

// what you set where you set it, the resolved value where you did not — the
// no-snap rule, unchanged from the orbit
function kernelAxes(st) {
  const set = SONG.patch.feel || {};
  return LAYERS[0].axes(st).map((a) => (set[a.id] != null ? Object.assign({}, a, { v: +set[a.id] }) : a));
}

// ---------- the tracts ----------
// THIN LINES, BIG LABELS: these read at a glance while scrolling, so the ink is
// a hairline and the type is the thing you actually see.
function drawTempo(cv, st, total) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 600, h = cv.clientHeight || 26;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const bpm = Math.round(st.bpm || 110);
  const y = h - 4 - (h - 10) * Math.max(0, Math.min(1, (bpm - 50) / 130));
  g.strokeStyle = "hsla(190,62%,66%,.85)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); g.stroke();
  g.fillStyle = "#e8e6f3"; g.font = "600 13px ui-monospace, monospace";
  g.fillText(bpm + " bpm", 6, Math.min(h - 5, y + 15));
}
function drawStructure(cv, spans, total) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 600, h = cv.clientHeight || 26;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  g.font = "600 12px ui-monospace, monospace";
  for (const s of spans) {
    const x = (s.start / total) * w, bw = (s.beats / total) * w;
    g.strokeStyle = "rgba(255,255,255,.20)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(Math.round(x) + 0.5, 0); g.lineTo(Math.round(x) + 0.5, h); g.stroke();
    g.fillStyle = "#9c97b8";
    g.save(); g.beginPath(); g.rect(x + 4, 0, Math.max(0, bw - 6), h); g.clip();
    g.fillText(s.name || "", x + 5, h - 8);
    g.restore();
  }
}
// chords as blocks: one per chord bar, labelled where there is room
function drawChords(cv, st, total) {
  const E = window.CsdEngine;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 600, h = cv.clientHeight || 56;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  let prg = null;
  try { prg = E.resolveProgression ? E.resolveProgression(st) : null; } catch (e) {}
  prg = prg || E.PROGRESSIONS[st.progression];
  const chords = (prg && prg.chords) || [];
  if (!chords.length) return;
  const cb = Math.max(2, Math.round(st.chordEvery || (st.meter ? 6 : 8)));
  g.font = "600 12px ui-monospace, monospace";
  for (let b = 0, i = 0; b < total; b += cb, i++) {
    const x = (b / total) * w, bw = (cb / total) * w;
    const c = chords[i % chords.length];
    g.fillStyle = `hsla(265,55%,60%,${i % 2 ? 0.16 : 0.24})`;
    g.fillRect(x, 6, Math.max(1, bw - 1), h - 12);
    if (bw > 26) { g.fillStyle = "#d8d2f0"; g.fillText(String((c && c.name) || ""), x + 5, h / 2 + 4); }
  }
}
// the found layer over time: one mark per event, height by volume
function drawFound(cv, ev, total) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 600, h = cv.clientHeight || 56;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const list = ev.found || [];
  if (!list.length) {
    g.fillStyle = "rgba(255,255,255,.28)"; g.font = "13px ui-monospace, monospace";
    g.fillText("— no found layer —", 8, h / 2 + 4); return;
  }
  for (const f of list) {
    const x = (f.beat / total) * w;
    const bw = Math.max(1.5, ((f.dur || 1) / total) * w);
    g.fillStyle = "hsla(120,50%,62%,.55)";
    g.fillRect(x, 8, bw, h - 16);
  }
}

export function paintDeck() {
  const st = state(), ev = events(), spans = sectionSpans(), total = ev.totalBeats || 1;

  for (const S of STRIPS) {
    const r = strips.get(S.layer);
    if (!r) continue;
    const L = layerById(S.layer);

    const axes = (S.layer === "genre" ? kernelAxes(st) : L.axes(st))
      .map((a) => Object.assign({ kind: "direct" }, a));
    r.vec.set(axes);

    if (S.tracts) {
      drawTempo(r.tracts[0], st, total);
      drawStructure(r.tracts[1], spans, total);
      r.machineEl.textContent = SONG.weights && SONG.weights.length ? SCULPT.label(SONG.weights) : "";
      const p = SCULPT.progress();
      if (!p.done) r.machineEl.textContent = `learning the space… ${p.built}/${p.total || "?"}`;
      r.countEl.textContent = `${spans.length} sections · ${Math.round(total)} beats`;
    } else if (S.lane === "chords") {
      drawChords(r.cv, st, total);
      r.machineEl.textContent = st.progression || "";
      r.countEl.textContent = (st.chordEvery || 8) + " beats a chord";
    } else if (S.lane === "found") {
      drawFound(r.cv, ev, total);
      r.machineEl.textContent = String((st.genreMeta && st.genreMeta.found) || "").split("/").pop() || "";
      r.countEl.textContent = (ev.found || []).length + " placements";
    } else if (S.lane) {
      const track = { id: S.voice || "drums", kind: S.lane === "drums" ? "drums" : "pitched" };
      const evs = trackEvents(track);
      const machines = trackMachines(track);
      drawRoll(r.cv, evs, { totalBeats: total, spans, kind: track.kind, hue: L.hue });
      r.machineEl.textContent = machines.length ? machines.join(" → ") : "off";
      r.countEl.textContent = evs.length ? evs.length + " notes" : "";
      r.sec.classList.toggle("dw-off", !evs.length);
    } else {
      r.machineEl.textContent = (st.pipes || []).length + " in the chain";
      r.countEl.textContent = "";
    }

    renderRefiner(r.refiner, S.layer);
  }
}

let rz = 0;
export function watchDeckResize() {
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(paintDeck, 120); });
}
