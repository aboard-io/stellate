// sheet.js — THE FLYOUT: the one surface that shows whatever you tapped.
//
// It is a VIEW STACK, not a panel. `root()` is the kernel (the DAW's own top of
// the hierarchy); `open(target)` resets the stack to a track/master/section
// view; `push(view)` drills in (a picker is a PLACE YOU GO, which is what kills
// the lozenge walls) and `back()` pops. The ← in the head is the whole
// navigation model.
//
// RAIL OR BOTTOM SHEET IS A CSS QUESTION AND THIS MODULE DOES NOT KNOW THE
// ANSWER. At ≥1000px the element is the permanent right rail, always visible,
// showing the kernel when nothing else is open; below that it is the bottom
// sheet with a grab handle. All this file does is add/remove `dw-sheet-open` on
// <body> — a STATE, not a layout — and render the top of the stack.
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
//     controls,  // {makePad, makeTile, makeChips, makeTable} (controls.js)
//     setEcho(txt),   // header echo while dragging ("snare · 40%"); "" clears
//                     // (the shell also clears it itself when the pointer lifts,
//                     //  so an editor may set-and-forget during a drag)
//     setTab(name),   // switch this sheet's tab (pad.js's "open the sound tab")
//     rerender(),     // re-render the sheet body after a structural change
//     push(view),     // push any {id,title,hue,render} view onto the stack
//     back(),         // pop one view
//     picker(opts),   // push a TABLE picker view; picking commits and pops
//   }
import { SONG, edit, state, events, trackEvents, trackMachines, sectionSpans,
         editLayer, editSecover, editSound, secId, trackById, subs } from "./song.js";
import { drawRoll, midiRange } from "./roll.js";
import { makePad, makeTile, makeChips, makeTable, refreshAll } from "./controls.js";
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
const CONTROLS = { makePad, makeTile, makeChips, makeTable };

const $el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };

let hostEl = null;
let stack = [], rootView = null;
let pinCv = null, echoEl = null, bodyEl = null, tabsEl = null, titleEl = null, backEl = null;

export function mount(host) {
  hostEl = host;
  hostEl.innerHTML = "";
  hostEl.hidden = false;            // the rail is never hidden; CSS parks the sheet
  const handle = $el("button", "dw-sheethandle");
  handle.type = "button";
  handle.setAttribute("aria-label", "close the sheet");
  handle.appendChild($el("i", "dw-sheetgrab"));
  handle.addEventListener("click", close);
  const head = $el("div", "dw-sheethead");
  backEl = $el("button", "dw-sheetback", "←");
  backEl.type = "button";
  backEl.setAttribute("aria-label", "back");
  backEl.addEventListener("click", back);
  titleEl = $el("h2", "dw-sheettitle", "");
  echoEl = $el("span", "dw-sheetecho", "");
  const x = $el("button", "dw-sheetclose", "✕");
  x.type = "button";
  x.setAttribute("aria-label", "close");
  x.addEventListener("click", close);
  head.append(backEl, titleEl, echoEl, x);
  const pin = $el("div", "dw-sheetpin");
  pinCv = document.createElement("canvas");
  pinCv.className = "dw-pinroll";
  pin.appendChild(pinCv);
  tabsEl = $el("div", "dw-sheettabs");
  tabsEl.setAttribute("role", "tablist");
  bodyEl = $el("div", "dw-sheetbody");
  hostEl.append(handle, head, pin, tabsEl, bodyEl);
  // one sub: while open, keep the pinned roll + every control honest. The BODY
  // is not re-rendered on every edit (that would kill a drag mid-gesture) —
  // editors own their refresh through the controls registry.
  subs.push(() => { if (stack.length) { paintPin(); refreshAll(); } });
  // the echo is a DRAG readout: clear it whenever a pointer lifts anywhere on
  // the sheet, after the control's own rAF-throttled preview has had its last
  // word. Editors set it freely during a drag and never have to clean up.
  const clearEcho = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    if (echoEl) echoEl.textContent = "";
  }));
  hostEl.addEventListener("pointerup", clearEcho, true);
  hostEl.addEventListener("pointercancel", clearEcho, true);
}

export const el = () => hostEl;
const top = () => stack[stack.length - 1] || null;
export const isOpen = () => document.body.classList.contains("dw-sheet-open");
export const view = () => top();
export const stackIds = () => stack.map((v) => v.id);
export const depth = () => stack.length;
export const current = () => {
  const v = top();
  return v && { id: v.id, target: v.target || v.id, tab: v.tab || null,
    secIdx: v.secIdx != null ? v.secIdx : null };
};

// ---------- the stack ----------
// setRoot(view) — the kernel. Registered once at boot; the rail shows it when
// nothing else is open, and every back() bottoms out here.
export function setRoot(v) {
  rootView = v;
  if (!stack.length) { stack = [v]; render(); }
}
function show() { document.body.classList.add("dw-sheet-open"); }

export function push(v) {
  if (!v || !hostEl) return null;
  stack.push(v);
  show();
  render();
  return v;
}
export function back() {
  if (stack.length > 1) stack.pop();
  else if (rootView && top() !== rootView) stack = [rootView];
  else if (rootView) stack = [rootView];
  render();
  return top();
}
// root() — reset to the kernel AND show it (the grid's kernel row taps this).
export function root() {
  stack = rootView ? [rootView] : [];
  show();
  render();
}

// open(target, secIdx?) — target: trackId | "master" | "section:<id>".
// Resets the stack to that view (the old semantics, kept verbatim).
export function open(target, secIdx) {
  if (!hostEl) return;
  const t = String(target || "");
  // "kernel" IS the root view, not a track. Routing it through viewForTarget
  // built a tab-less view whose render() found no entry and drew nothing: an
  // empty sheet with a correct title, which is worse than an error because it
  // looks deliberate. The grid's kernel row calls root() and was fine; every
  // other caller (the probe hook, a gate, a link) hit the blank. Any unknown
  // target bottoms out at the root for the same reason.
  if (t === "kernel" || (t !== "master" && t.indexOf("section:") !== 0 && !trackById(t))) { root(); return; }
  stack = [viewForTarget(t, secIdx)];
  show();
  render();
}
export function close() {
  document.body.classList.remove("dw-sheet-open");
  stack = rootView ? [rootView] : [];
  render();
}
export function tab(name) {
  const v = top();
  if (!v || !v.tabs) return;
  v.tab = name;
  render();
}

// ---------- views ----------
function sectionOf(v) {
  if (!v) return null;
  const spans = sectionSpans();
  if (v.secId != null) return spans.find((s) => s.id === v.secId) || null;
  if (v.secIdx != null) return spans[v.secIdx] || null;
  return null;
}

function viewForTarget(t, secIdx) {
  if (t.indexOf("section:") === 0) {
    const sid = t.slice(8);
    const v = {
      id: t, target: t, secId: sid, hue: 265, pin: false,
      title: () => "section — " + ((sectionOf(v) || {}).name || sid),
      render(host, ctx) { renderSectionSheet(host, ctx); },
    };
    return v;
  }
  const isMaster = t === "master";
  const track = isMaster ? null : trackById(t);
  const tabs = EDITORS[isMaster ? "master" : (track ? track.id : "")] || [];
  const v = {
    id: t, target: t, track, secIdx: secIdx != null ? secIdx : null,
    hue: isMaster ? 300 : (track ? track.hue : 200),
    tabs, tab: tabs.length ? tabs[0][0] : null,
    pin: !isMaster && !!track && track.kind !== "chords" && track.kind !== "found",
    title: () => {
      const sec = sectionOf(v);
      return isMaster ? "master"
        : (track ? track.label : t) + (sec ? " · " + (sec.name || "section") : "");
    },
    render(host, ctx) {
      const entry = (this.tabs || []).find(([n]) => n === this.tab);
      if (entry) entry[1](host, ctx);
    },
  };
  return v;
}

// pickerView({title, hue, note, columns, groups|rows, value, filter, max,
//             onPick(id), keepOpen}) — PUSHES a table view; picking commits and
// pops back to where you were. The whole point: a picker is a place you go.
export function pickerView(opts) {
  const o = opts || {};
  const cv = top();
  const v = {
    id: o.id || ("picker:" + (o.title || "choose")),
    picker: true,
    hue: o.hue != null ? o.hue : (cv ? cv.hue : 200),
    title: o.title || "choose",
    render(host, ctx) {
      if (o.note) host.appendChild($el("p", "dw-pnote dw-pickernote", o.note));
      ctx.controls.makeTable(host, {
        columns: o.columns, groups: o.groups, rows: o.rows,
        label: o.label || (typeof v.title === "string" ? v.title : ""),
        value: typeof o.value === "function" ? o.value() : o.value,
        hue: v.hue,
        filter: o.filter,
        max: o.max !== undefined ? o.max : 0,     // 0 = the sheet body scrolls
        empty: o.empty,
        onPick: (id) => {
          if (o.onPick) o.onPick(id);
          if (o.keepOpen) render(); else back();
        },
      });
    },
  };
  return push(v);
}

function ctxFor(v) {
  const section = sectionOf(v);
  return {
    track: v.track || null, section, hue: v.hue,
    song: SONG_HELPERS,
    controls: CONTROLS,
    setEcho: (txt) => { if (echoEl) echoEl.textContent = txt || ""; },
    setTab: tab,
    rerender: render,
    push, back, picker: pickerView,
  };
}

function render() {
  const v = top();
  if (!hostEl || !v) return;
  echoEl.textContent = "";
  hostEl.style.setProperty("--hue", v.hue != null ? v.hue : 200);
  titleEl.textContent = typeof v.title === "function" ? v.title() : (v.title || "");
  const atRoot = !!rootView && v === rootView && stack.length === 1;
  backEl.hidden = atRoot;

  const tabs = v.tabs || [];
  if (tabs.length && (!v.tab || !tabs.some(([n]) => n === v.tab))) v.tab = tabs[0][0];
  tabsEl.textContent = "";
  tabsEl.hidden = tabs.length < 2;
  for (const [name] of tabs) {
    const b = $el("button", "dw-sheettab" + (name === v.tab ? " on" : ""), name);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(name === v.tab));
    b.addEventListener("click", () => tab(name));
    tabsEl.appendChild(b);
  }

  pinCv.parentElement.hidden = !v.pin;
  bodyEl.textContent = "";
  bodyEl.scrollTop = 0;
  v.render(bodyEl, ctxFor(v));
  paintPin();
}

// ---------- the pinned mini-roll: the tapped cell, live ----------
function paintPin() {
  const v = top();
  if (!v || !pinCv || pinCv.parentElement.hidden) return;
  const track = v.track;
  if (!track || (track.kind !== "pitched" && track.kind !== "drums")) return;
  const section = sectionOf(v);
  const ev = trackEvents(track);
  const total = events().totalBeats || 1;
  const opts = { totalBeats: total, spans: sectionSpans(), kind: track.kind, hue: track.hue };
  if (section) { opts.beatFrom = section.start; opts.beatTo = section.start + section.beats; }
  if (track.kind === "pitched") { const r = midiRange(ev); if (r) opts.range = r; }
  drawRoll(pinCv, ev, opts);
}
