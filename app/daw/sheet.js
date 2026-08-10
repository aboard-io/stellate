// sheet.js — THE SHEET: the one surface that appears on tap.
//
// A bottom sheet (~85vh on mobile, grab handle, scroll inside; a right-side
// panel at ≥1100px — CSS decides, this module doesn't know). Music keeps
// playing; every edit lands at the next bar (the transport contract). Pinned at
// the top: a live mini-roll of the tapped cell that repaints on every edit —
// cause next to effect.
//
// THE EDITOR TABLE below is the STABLE registration point: editors/* each
// export render(host, ctx) and are imported here ONCE. Editor agents replace
// stub BODIES in their own files; nothing else ever needs to touch this table,
// the ctx shape, or the sheet shell.
//
// ctx handed to every editor render(host, ctx):
//   {
//     track,     // {id, kind, label, hue} — null for the master sheet
//     section,   // {id, index, name, start, beats, sec} — null = whole song
//     hue,       // the surface's hue (track hue, or 300 master / 265 section)
//     song:      // the document helpers, so a stub imports nothing:
//                //   {SONG, edit, state, events, trackEvents, trackMachines,
//                //    sectionSpans, editLayer, editSecover, editSound, secId}
//     controls,  // {makePad, makeTile, makeChips} (controls.js)
//     setEcho(txt),   // header echo while dragging ("snare · 40%"); "" clears
//                     // (the shell also clears it itself when the pointer lifts,
//                     //  so an editor may set-and-forget during a drag)
//     setTab(name),   // switch this sheet's tab (pad.js's "open the sound tab")
//     rerender(),     // re-render the sheet body after a structural change
//   }
import { SONG, edit, state, events, trackEvents, trackMachines, sectionSpans,
         editLayer, editSecover, editSound, secId, trackById, subs } from "./song.js";
import { drawRoll, midiRange } from "./roll.js";
import { makePad, makeTile, makeChips, refreshAll } from "./controls.js";
import { renderSectionSheet } from "./structure.js";
import * as ED_DRUMS from "./editors/drums.js";
import * as ED_MELODY from "./editors/melody.js";
import * as ED_BASS from "./editors/bass.js";
import * as ED_PAD from "./editors/pad.js";
import * as ED_CHORDS from "./editors/chords.js";
import * as ED_SAMPLES from "./editors/samples.js";
import * as ED_MASTER from "./editors/master.js";
import * as ED_SOUND from "./editors/sound.js";

// ---------- THE TABLE (stable — see header) ----------
// target id -> ordered [tabName, renderFn]. PART|SOUND for the voices; chords/
// samples/master are single-surface. The section sheet routes to structure.js.
export const EDITORS = {
  chords:  [["part", ED_CHORDS.render]],
  melody:  [["part", ED_MELODY.render], ["sound", ED_SOUND.render]],
  bass:    [["part", ED_BASS.render], ["sound", ED_SOUND.render]],
  pad:     [["part", ED_PAD.render], ["sound", ED_SOUND.render]],
  drums:   [["part", ED_DRUMS.render], ["sound", ED_SOUND.render]],
  samples: [["part", ED_SAMPLES.render]],
  master:  [["master", ED_MASTER.render]],
};

const SONG_HELPERS = { SONG, edit, state, events, trackEvents, trackMachines,
  sectionSpans, editLayer, editSecover, editSound, secId };
const CONTROLS = { makePad, makeTile, makeChips };

const $el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };

let root = null, cur = null;   // cur = {target, track, secIdx, tab}
let pinCv = null, echoEl = null, bodyEl = null, tabsEl = null, titleEl = null;

export function mount(host) {
  root = host;
  root.innerHTML = "";
  root.hidden = true;
  const handle = $el("button", "dw-sheethandle");
  handle.type = "button";
  handle.setAttribute("aria-label", "close the sheet");
  handle.appendChild($el("i", "dw-sheetgrab"));
  handle.addEventListener("click", close);
  const head = $el("div", "dw-sheethead");
  titleEl = $el("h2", "dw-sheettitle", "");
  echoEl = $el("span", "dw-sheetecho", "");
  const x = $el("button", "dw-sheetclose", "✕");
  x.type = "button";
  x.setAttribute("aria-label", "close");
  x.addEventListener("click", close);
  head.append(titleEl, echoEl, x);
  const pin = $el("div", "dw-sheetpin");
  pinCv = document.createElement("canvas");
  pinCv.className = "dw-pinroll";
  pin.appendChild(pinCv);
  tabsEl = $el("div", "dw-sheettabs");
  tabsEl.setAttribute("role", "tablist");
  bodyEl = $el("div", "dw-sheetbody");
  root.append(handle, head, pin, tabsEl, bodyEl);
  // one sub: while open, keep the pinned roll + every control honest. The BODY
  // is not re-rendered on every edit (that would kill a drag mid-gesture) —
  // editors own their refresh through the controls registry.
  subs.push(() => { if (cur) { paintPin(); refreshAll(); } });
  // the echo is a DRAG readout: clear it whenever a pointer lifts anywhere on
  // the sheet, after the control's own rAF-throttled preview has had its last
  // word. Editors set it freely during a drag and never have to clean up.
  const clearEcho = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    if (echoEl) echoEl.textContent = "";
  }));
  root.addEventListener("pointerup", clearEcho, true);
  root.addEventListener("pointercancel", clearEcho, true);
}

export const el = () => root;
export const isOpen = () => !!cur;
export const current = () => cur && { target: cur.target, tab: cur.tab, secIdx: cur.secIdx };

// open(target, secIdx?) — target: trackId | "master" | "section:<id>"
export function open(target, secIdx) {
  if (!root) return;
  const t = String(target || "");
  cur = { target: t, secIdx: secIdx != null ? secIdx : null, tab: null, track: null };
  if (t.indexOf("section:") === 0) cur.secId = t.slice(8);
  else if (t !== "master") cur.track = trackById(t);
  root.hidden = false;
  document.body.classList.add("dw-sheet-open");
  render();
}
export function close() {
  cur = null;
  if (root) root.hidden = true;
  document.body.classList.remove("dw-sheet-open");
}
export function tab(name) {
  if (!cur) return;
  cur.tab = name;
  render();
}

function sectionOf() {
  if (!cur) return null;
  const spans = sectionSpans();
  if (cur.secId != null) return spans.find((s) => s.id === cur.secId) || null;
  if (cur.secIdx != null) return spans[cur.secIdx] || null;
  return null;
}

function ctxFor(track, section, hue) {
  return {
    track, section, hue,
    song: SONG_HELPERS,
    controls: CONTROLS,
    setEcho: (txt) => { if (echoEl) echoEl.textContent = txt || ""; },
    setTab: tab,
    rerender: render,
  };
}

function render() {
  if (!cur || !root) return;
  echoEl.textContent = "";
  const section = sectionOf();

  // section sheet — one surface, rendered by structure.js
  if (cur.secId != null) {
    titleEl.textContent = "section — " + ((section && section.name) || cur.secId);
    root.style.setProperty("--hue", 265);
    tabsEl.textContent = "";
    tabsEl.hidden = true;
    pinCv.parentElement.hidden = true;      // a section is not a cell — no pinned roll
    bodyEl.textContent = "";
    renderSectionSheet(bodyEl, ctxFor(null, section, 265));
    return;
  }

  const isMaster = cur.target === "master";
  const track = cur.track;
  const hue = isMaster ? 300 : (track ? track.hue : 200);
  root.style.setProperty("--hue", hue);
  titleEl.textContent = isMaster ? "master"
    : (track ? track.label : cur.target) + (section ? " · " + (section.name || "section") : "");

  const tabs = EDITORS[isMaster ? "master" : (track ? track.id : "")] || [];
  if (!cur.tab || !tabs.some(([n]) => n === cur.tab)) cur.tab = tabs.length ? tabs[0][0] : null;

  // tab row (hidden when there is only one surface)
  tabsEl.textContent = "";
  tabsEl.hidden = tabs.length < 2;
  for (const [name] of tabs) {
    const b = $el("button", "dw-sheettab" + (name === cur.tab ? " on" : ""), name);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(name === cur.tab));
    b.addEventListener("click", () => tab(name));
    tabsEl.appendChild(b);
  }

  pinCv.parentElement.hidden = isMaster || !track || track.kind === "chords" || track.kind === "found";
  bodyEl.textContent = "";
  const entry = tabs.find(([n]) => n === cur.tab);
  if (entry) entry[1](bodyEl, ctxFor(track, section, hue));
  paintPin();
}

// ---------- the pinned mini-roll: the tapped cell, live ----------
function paintPin() {
  if (!cur || !pinCv || pinCv.parentElement.hidden) return;
  const track = cur.track;
  if (!track || (track.kind !== "pitched" && track.kind !== "drums")) return;
  const section = sectionOf();
  const ev = trackEvents(track);
  const total = events().totalBeats || 1;
  const opts = { totalBeats: total, spans: sectionSpans(), kind: track.kind, hue: track.hue };
  if (section) { opts.beatFrom = section.start; opts.beatTo = section.start + section.beats; }
  if (track.kind === "pitched") { const r = midiRange(ev); if (r) opts.range = r; }
  drawRoll(pinCv, ev, opts);
}
