// grid.js — THE GRID: tracks × sections, the screen the whole DAW works out from.
//
//   rows    = TRACKS (chords/melody/bass/pad/drums/samples), header sticky left
//   columns = state.sections in order, EQUAL width (min 72px, h-scroll on
//             overflow — the SONG bar above shows true time proportions)
//   cells   = the ACTUAL buildEvents output windowed to that section's beat
//             span (roll.js beatFrom/beatTo). Pitched cells are mini piano
//             rolls auto-ranged PER ROW (contours compare across sections);
//             drums are lane dots; chords are chord-name blocks of ONE cycle;
//             samples are placement marks. A voice off in a section: dimmed ∅.
//
// THE RACK LAW IS THE DEMO: an edit to one track's generator repaints that row
// only — canvases are per cell so the gate can hash rows and prove it.
//
// THE PLAYHEAD IS NOT A REPAINT (the standing law): one absolutely-positioned
// line, moved by the transport's rAF via the piecewise beat → (column,
// fraction) mapping. Canvases never repaint for the head.
import { TRACKS, trackById, state, events, trackEvents, sectionSpans, subs } from "./song.js";
import { drawRoll, midiRange } from "./roll.js";
import { open as openSheet } from "./sheet.js";

const E = window.CsdEngine;
const $el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };

let root = null, inner = null, headEl = null, masterEl = null;
let colIds = [];                       // section ids, to detect structural change
const cells = new Map();               // "trackId:i" -> {btn, cv}

export function build(host) {
  root = host;
  root.classList.add("dw-gridwrap");
  paint();
  subs.push(paint);
  return root;
}

// ---------- build / rebuild the DOM skeleton when the form changes ----------
function rebuild(spans) {
  root.textContent = "";
  cells.clear();
  colIds = spans.map((s) => s.id);
  inner = $el("div", "dw-gridinner");
  inner.style.setProperty("--cols", spans.length);

  for (const track of TRACKS) {
    const rh = $el("button", "dw-rowhead");
    rh.type = "button";
    rh.style.setProperty("--hue", track.hue);
    rh.appendChild($el("span", "dw-rowname", track.label));
    rh.appendChild($el("span", "dw-rowinst", ""));
    rh.title = "open the " + track.label + " sheet (whole song)";
    rh.addEventListener("click", () => openSheet(track.id));
    rh.dataset.track = track.id;
    inner.appendChild(rh);
    for (let i = 0; i < spans.length; i++) {
      const btn = $el("button", "dw-cellbtn");
      btn.type = "button";
      btn.style.setProperty("--hue", track.hue);
      btn.dataset.track = track.id;
      btn.dataset.sec = String(i);
      btn.setAttribute("aria-label", track.label + " · " + (spans[i].name || "section " + (i + 1)));
      const cv = document.createElement("canvas");
      cv.className = "dw-cellcv";
      btn.appendChild(cv);
      btn.addEventListener("click", () => openSheet(track.id, +btn.dataset.sec));
      inner.appendChild(btn);
      cells.set(track.id + ":" + i, { btn, cv });
    }
  }

  // MASTER row — one wide strip under the tracks: note fx chain · time feel
  const mh = $el("button", "dw-rowhead dw-masterhead");
  mh.type = "button";
  mh.style.setProperty("--hue", 300);
  mh.appendChild($el("span", "dw-rowname", "master"));
  mh.title = "open the master sheet — note fx and time feel";
  mh.addEventListener("click", () => openSheet("master"));
  inner.appendChild(mh);
  masterEl = $el("button", "dw-mastercell");
  masterEl.type = "button";
  masterEl.style.setProperty("--hue", 300);
  masterEl.style.gridColumn = "2 / -1";
  masterEl.addEventListener("click", () => openSheet("master"));
  inner.appendChild(masterEl);

  headEl = $el("i", "dw-ghead");
  inner.appendChild(headEl);
  root.appendChild(inner);
}

// ---------- painting ----------
export function paint() {
  if (!root) return;
  const st = state(), ev = events(), spans = sectionSpans();
  if (spans.map((s) => s.id).join("|") !== colIds.join("|")) rebuild(spans);

  for (const track of TRACKS) {
    const rowEv = track.kind === "chords" || track.kind === "found" ? null : trackEvents(track);
    const range = track.kind === "pitched" ? midiRange(rowEv) : null;   // PER ROW, not per cell
    const rh = inner.querySelector(`.dw-rowhead[data-track="${track.id}"] .dw-rowinst`);
    if (rh) rh.textContent = instWord(st, track);
    for (let i = 0; i < spans.length; i++) {
      const c = cells.get(track.id + ":" + i);
      if (!c) continue;
      const sp = spans[i];
      const off = isOff(st, ev, track, sp);
      c.btn.classList.toggle("off", off);
      if (track.kind === "chords") drawChordCell(c.cv, st, sp);
      else if (track.kind === "found") drawFoundCell(c.cv, ev, sp);
      else drawRoll(c.cv, rowEv, { totalBeats: ev.totalBeats || 1, spans: [],
        beatFrom: sp.start, beatTo: sp.start + sp.beats,
        kind: track.kind, hue: track.hue, range });
    }
  }
  if (masterEl) {
    const chain = (st.pipes || []).map((p) => p.id).join(" → ") || "no note fx";
    masterEl.textContent = "";
    masterEl.appendChild($el("span", "dw-masterchain", chain));
    masterEl.appendChild($el("span", "dw-masterfeel",
      `${Math.round(st.bpm || 0)} bpm · swing ${(st.swing || 0).toFixed(2)} · human ${(st.humanize || 0).toFixed(2)}`));
  }
}

// one word of instrument truth for the row header ("melody · jazz gtr")
function instWord(st, track) {
  if (track.kind === "chords") return st.progression || "";
  if (track.kind === "found") {
    const n = (st.foundSources || []).filter((s) => (s.vol || 0) > 0.001).length;
    return n ? n + " src" : "—";
  }
  const I = (st.instruments || {})[track.id] || {};
  if (I.sampler && I.sampler.id) return String(I.sampler.id).replace(/_/g, " ").slice(0, 16);
  return I.model || "";
}

function isOff(st, ev, track, sp) {
  const sec = sp.sec;
  if (track.kind === "chords") return false;
  if (track.id === "pad") return !sec.pads;
  if (track.kind === "found")
    return !(ev.found || []).some((f) => f.beat < sp.start + sp.beats && f.beat + (f.dur || 1) > sp.start);
  const v = sec[track.id];
  return !v || v === "off";
}

// chords: chord-name blocks of ONE CYCLE (the section repeats it)
function drawChordCell(cv, st, sp) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 72, h = cv.clientHeight || 44;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  let prg = null;
  try { prg = E.resolveProgression ? E.resolveProgression(st) : null; } catch (e) {}
  prg = prg || E.PROGRESSIONS[st.progression];
  const chords = (prg && prg.chords) || [];
  if (!chords.length) return;
  const bw = w / chords.length;
  g.font = "600 10px ui-monospace, monospace";
  for (let i = 0; i < chords.length; i++) {
    g.fillStyle = `hsla(265,55%,60%,${i % 2 ? 0.18 : 0.28})`;
    g.fillRect(i * bw + 0.5, 4, Math.max(1, bw - 1), h - 8);
    if (bw > 22) { g.fillStyle = "#d8d2f0"; g.fillText(String((chords[i] && chords[i].name) || ""), i * bw + 3, h / 2 + 3); }
  }
}

// samples: placement marks windowed to the section
function drawFoundCell(cv, ev, sp) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 72, h = cv.clientHeight || 44;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const from = sp.start, to = sp.start + sp.beats;
  for (const f of ev.found || []) {
    if (f.beat >= to || f.beat + (f.dur || 1) <= from) continue;
    const x = ((f.beat - from) / (to - from)) * w;
    const bw = Math.max(1.5, ((f.dur || 1) / (to - from)) * w);
    g.fillStyle = "hsla(120,50%,62%,.55)";
    g.fillRect(x, 8, bw, h - 16);
  }
}

// ---------- the playhead: piecewise beat → (column, fraction) ----------
export function placeHead(beat) {
  if (!headEl || !inner) return;
  if (beat == null) { headEl.style.opacity = "0"; return; }
  const spans = sectionSpans();
  if (!spans.length) return;
  let i = spans.length - 1, frac = 1;
  for (let k = 0; k < spans.length; k++) {
    if (beat < spans[k].start + spans[k].beats) { i = k; frac = (beat - spans[k].start) / spans[k].beats; break; }
  }
  const c = cells.get(TRACKS[0].id + ":" + i);
  if (!c) return;
  const x = c.btn.offsetLeft + Math.max(0, Math.min(1, frac)) * c.btn.offsetWidth;
  headEl.style.opacity = "";
  headEl.style.transform = `translateX(${x.toFixed(1)}px)`;
}

// ---------- probe surface (window.__DAW.grid) ----------
export const rows = () => TRACKS.map((t) => t.id);
export const cols = () => colIds.length;
export const cellCount = () => cells.size;
export function openCell(trackId, secIdx) {
  const c = cells.get(trackId + ":" + secIdx);
  if (c) c.btn.click();
  else openSheet(trackId, secIdx);
}
// hash a whole row's pixels — the rack-law gate's currency
export function rowHash(trackId) {
  let h = 5381;
  const mix = (s) => { for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; };
  for (let i = 0; i < colIds.length; i++) {
    const c = cells.get(trackId + ":" + i);
    if (c) mix(c.cv.toDataURL());
  }
  return h.toString(16);
}
