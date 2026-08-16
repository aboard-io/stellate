// ui/mixtbl.js — THE BOARD AND THE RACK: the MIX page as a mixing desk.
//
// The mix table this file used to draw ("a mixer is the most table-shaped
// object in music") was right about the DATA and wrong about the instrument:
// a row of abbreviations can say what a channel is set to, but it cannot show
// the level MOVING — and the composer's arc, the pump, the level automation
// all move. "The SSL board" (2026-08-15) is the redesign: vertical CHANNEL
// STRIPS, one per part the selected box sounds, each with its label block,
// its value keys, M/S and a long-throw AUTOMATED fader; then the SHARED-BUS
// strips (reverb, echo, drum room — audio/graph.js's own roster, plus a slim
// strip per character send bus as it builds); then the MASTER strip with a
// meter. Below the board, the EFFECTS RACK: one row of detented knobs per
// bus, and the MASTER row — the fields.js MASTER registry, moved here off the
// SONG page's session bank with its #m-<key> ids intact.
//
// THE AUTOMATED FADER'S LAW (the round's one new idea): the cap follows the
// level actually driving the channel — the enum level, the composer's arc, a
// `pump` — read per frame off the built gain nodes (CHAN, audio/mixer.js).
// A drag does NOT fight that: it writes a persistent dB OFFSET (fields.js
// `fader`, PARTMIX `fader`) that multiplies the automated value, shown as its
// own small readout under the slot. Automation keeps moving under your trim.
// During the drag the target gain is eased onto the live AudioParam for
// immediacy; the value commits on pointerup — one writer, no fight.
//
// WHAT SURVIVES THE TABLE, deliberately: rowsOf (the track list is still the
// mixer's own roster), readField/writeField (one writer, absent the only
// spelling of a default), the cell POPOVER with its chips (a strip's fx/rev/
// echo/lvl/pan keys open the same chip sets — the discrete vocabulary stays
// reachable, so old songs' values stay legible beside the fader), and the
// .mrow/.msec/.mval/.mk-*/.mchip class names, which are LOAD-BEARING: two
// browser gates (nukernel-drums deskUI, nukernel-audio (E)) drive this
// surface through exactly those hooks. Only CHANNEL strips carry .mrow — the
// drums gate counts them against the part roster.
//
// Layer graph: ui view — imports state/derive/deps, audio/graph, audio/mixer
// and audio/assets for READS ONLY, and leaves every change through commit().
// Audio never calls the board; the board only reads node params per frame
// (main.js's one rAF loop calls paintBoard) — the one-way rule holds.
import { GENRES, FX, MAX_FX, SENDS, SENDLABEL, DRUMKITS, PARTMIX,
         partChairLabel, BASS_INSTR, BASSSYNTH, LEVELS, faderDb,
         resolvePartMix, MASTER_FIELDS, BUS_FIELDS,
         VERBS, DTIMES, DTLABEL } from "./deps.js";
import { curSection, commit, on, emit, MASTER, setMaster, BUSES, setBuses,
         vol, setVol } from "./state.js";
import { stackOf, kitOf, voiceOwners } from "./derive.js";
import { voiceRoster, partKeysOf, CHAN } from "../audio/mixer.js";
import { initAudio, rmsNow, masterReport, busReport,
         SENDBUS } from "../audio/graph.js";
import { isSynthFont, fontDef } from "../audio/assets.js";
import { hintKey } from "./editor.js";
import { openFader } from "./popfader.js";
import { buzz } from "./touch.js";

const el = document.getElementById("mixtbl");
// TABLE SEMANTICS still — a board is a table rotated: a strip is a row you
// read DOWN, and you compare across the board the way you compared down a
// column. The roles are static because the DOM is.
el.setAttribute("role", "table");
el.setAttribute("aria-label", "the mixing board for the selected box");
hintKey("mixhelp", "mixhint");

// the width at which there is daylight beside a cell rather than only under
// the deck — the same 900px boundary the row sheet and the pop-up fader use.
const WIDE = 900;

/* ---------- what the value keys are ---------- */
// The five PARTMIX enum fields, in registry order — same contract as the old
// table's columns: adding a control to the desk registry adds a key to every
// strip and nothing else.
const COLS = PARTMIX.filter(f => f.type !== "flag" && f.type !== "num");
// …PLUS THE TWO SECTION-ONLY FIELDS the palette's fx tab used to carry: which
// ROOM the reverb send lands in (sec.verb) and the echo's subdivision
// (sec.dtime). They are box fields with no part twin, so only the SECTION
// strip draws them — dropping them here would make them unreachable, and the
// inventory law is that nothing may.
const SECCOLS = [
  { key: "verb",  table: VERBS,  labels: VERBS },
  { key: "dtime", table: DTIMES, labels: DTLABEL },
];
const colsOf = row => (row.sect ? [...COLS, ...SECCOLS] : COLS);
const SHORT = {
  rev: SENDLABEL, echo: SENDLABEL, dtime: DTLABEL,
  lvl: { hush: "hush", back: "back", norm: "norm", fwd: "fwd" },
  pan: { l: "L", hl: "L·", c: "C", hr: "·R", r: "R" },
};
const LONG = {};
for (const f of [...COLS, ...SECCOLS]) LONG[f.key] = f.labels;
const shortOf = (f, v) => (SHORT[f] && SHORT[f][v]) || v;
const longOf = (f, v) => (LONG[f] && LONG[f][v]) || v;
// the silkscreen word over each value key — a strip has no header row to
// borrow a column name from, so every key carries its own legend
const KEYLEG = { fx: "fx", rev: "rev", echo: "echo", lvl: "lvl", pan: "pan",
                 verb: "room", dtime: "time" };

/* ---------- what the strips are ---------- */
const humanize = id => String(id || "").replace(/_/g, " ");
// WHAT A CHAIR ACTUALLY PLAYS — the roster carries the sampled instrument, but
// a genre with a signature `synth` never plays it, and a synth FONT overrides
// even that. A board that labels a 303 "clean guitar" is lying about the
// thing you are about to fade, so this mirrors that same switch.
function soundOf(g, r) {
  const syn = isSynthFont() ? fontDef().synth : (g && g.synth);
  const useSyn = syn && !(syn.lineOnly && r.pad && !isSynthFont());
  return useSyn ? (syn.root || syn.dsp) : humanize(r.id);
}
// THE TRACK LIST, from the same two functions the audio tier builds the desk
// from. This board cannot show a strip the mixer will not build a bus for,
// and cannot miss one it will: it is the same answer, drawn.
function rowsOf(sec) {
  const roster = voiceRoster(sec);
  const owners = voiceOwners(sec);
  const out = roster.map((r, i) => ({
    key: r.key,
    label: partChairLabel(r.key),
    sound: soundOf(GENRES[owners[i]], r),
  }));
  const keys = partKeysOf(sec, roster);
  if (keys.includes("bass")) {
    const bs = BASSSYNTH[sec.bassop];
    out.push({ key: "bass", label: partChairLabel("bass"),
               sound: bs ? (bs.root || bs.dsp) : humanize(BASS_INSTR) });
  }
  if (keys.includes("drums")) {
    const k = kitOf(sec);
    out.push({ key: "drums", label: partChairLabel("drums"),
               sound: DRUMKITS[k] || k || "" });
  }
  // the section strip, last before the buses: downstream of every part
  out.push({ key: null, label: "section", sound: "whole box", sect: true });
  return out;
}

/* ---------- reading and writing one field ---------- */
// THE SECTION STRIP IS THE BOX'S OWN FIELDS — no new storage, the palette's
// old fields, either surface repaints the other through commit("box").
const entryOf = (sec, key) => (key == null ? sec
  : ((sec.parts && sec.parts[key]) || null));
function readField(sec, key, f) {
  const e = entryOf(sec, key);
  if (!e) return f === "fx" ? [] : null;
  const v = e[f];
  return f === "fx" ? (v || []) : (v == null ? null : v);
}
// ONE WRITER, so a chip, a key and a fader cannot disagree about what "off"
// spells. Absent is the ONLY spelling of a default (song.js normalizes a save
// the same way): an entry with nothing set is deleted, and a map with no
// entries becomes null — the mixer's absent-is-today law.
function writeField(sec, key, f, v) {
  const dead = v == null || v === false || (Array.isArray(v) && !v.length);
  if (key == null) {                       // the section: the box's own field
    if (f === "fx") sec.fx = v || [];
    else sec[f] = dead ? null : v;
  } else {
    if (!sec.parts) { if (dead) return; sec.parts = {}; }
    const e = sec.parts[key] || (sec.parts[key] = {});
    if (dead) delete e[f]; else e[f] = v;
    for (const k of Object.keys(sec.parts))
      if (!Object.keys(sec.parts[k]).length) delete sec.parts[k];
    if (!Object.keys(sec.parts).length) sec.parts = null;
  }
  commit("box");
}
// WHAT THE DEFAULT RESOLVES TO, said in the key's own vocabulary and dimmed —
// a bright value is one you set, a dim one is the fallback answering.
const nearest = (tbl, x) => Object.keys(tbl)
  .reduce((a, b) => (Math.abs(tbl[b] - x) < Math.abs(tbl[a] - x) ? b : a));
function defaultOf(sec, key, f) {
  if (f === "fx") return null;
  if (key == null && f === "rev") {
    const g = GENRES[stackOf(sec)[0].g];
    const x = g && g.tone && g.tone.verb != null ? g.tone.verb : 0.15;
    return { v: nearest(SENDS, x), note: "as the genre asks (" + x + ")" };
  }
  if (f === "rev" || f === "echo") return { v: "none" };
  if (f === "lvl") return { v: "norm" };
  if (f === "pan") return { v: "c" };
  // the two section-only fields resolve exactly as chanSpec/scheduleBar do:
  // the genre's own wetness picks the hall, the echo rides the dotted eighth
  if (f === "verb") {
    const g = GENRES[stackOf(sec)[0].g];
    return { v: g && g.tone && g.tone.verb > 0.4 ? "hall" : "room",
             note: "as the genre asks" };
  }
  if (f === "dtime") return { v: "d8" };
  return null;
}

/* ---------- the fader arithmetic ---------- */
// The slot maps −36..+12 dB of GAIN to 0..1 of travel: LEVELS spans −8..+2.6
// dB, the offset ±24/12, the pump's duck −10 — all inside the throw with the
// nulls readable. gainToF is the ONE place gain becomes travel.
const F_LO = -36, F_HI = 12;
const gainToF = g => {
  const db = 20 * Math.log10(Math.max(1e-4, g));
  return Math.max(0, Math.min(1, (db - F_LO) / (F_HI - F_LO)));
};
const fmtDb = v => (v > 0 ? "+" : "") + v.toFixed(1);
// the resolved STATIC level a strip rests at when its channel is not built —
// the same tables chanSpec/resolvePartMix read, cited not re-invented
const secBase = sec => (sec.lvl ? LEVELS[sec.lvl] : 1);
function staticGain(sec, key) {
  if (key == null) return secBase(sec) * Math.pow(10, faderDb(sec.fader) / 20);
  const m = resolvePartMix(sec.parts && sec.parts[key]);
  return m.lvl * Math.pow(10, m.fader / 20);
}
// the LIVE gain: the built nodes when the channel exists (automation included
// — AudioParam.value reads the timeline), the resolved static value when not
function liveGain(sec, key) {
  const c = CHAN.get(sec);
  if (c) {
    if (key == null) {
      let g = c.lvl.gain.value;
      const ap = c.autoParam && c.autoParam("level");
      if (ap) g *= ap.value;
      return g;
    }
    const P = c.parts.get(key);
    if (P) return P.lvl.gain.value;
  }
  return staticGain(sec, key);
}
const offsetOf = (sec, key) => {
  const e = entryOf(sec, key);
  return e && e.fader != null ? faderDb(e.fader) : null;   // null = unset
};
// ease the drag onto the LIVE param so the hand hears itself before the
// commit rebuilds the channel — the offset is a separate multiplicand, so
// this cannot fight a level automation (which rides its own node)
function easeLive(sec, key, off) {
  const c = CHAN.get(sec);
  if (!c) return;
  const base = key == null ? secBase(sec)
    : resolvePartMix(sec.parts && sec.parts[key]).lvl;
  const target = base * Math.pow(10, off / 20);
  const P = key == null ? null : c.parts.get(key);
  const p = key == null ? c.lvl.gain : (P ? P.lvl.gain : null);
  if (!p) return;                          // no bus yet: the commit builds one
  try {
    const t = c.input.context.currentTime;
    p.cancelScheduledValues(t); p.setTargetAtTime(target, t, 0.02);
  } catch (e) {}
}

/* ---------- the board ---------- */
// BUILT ONCE PER TRACK LIST, then only its values change — the palette's law.
// Two wells inside #mixtbl: the channel strips (rebuilt when the roster
// changes) and the bus strips (built once — the shared rack is the page's).
let sig = "", rows = [], refs = [];

const mk = (tag, cls, txt) => {
  const n = document.createElement(tag);
  n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};
const chanWell = mk("div", "strips chans");
const busWell = mk("div", "strips buses");
el.append(chanWell, busWell);

// one long-throw fader: the slot, the groove, the automated cap, the dB
// readout. `write(off|null)` commits; `drag(off)` is the live-ease path.
function buildFader({ label, getOffset, getGain, write, drag }) {
  const wrap = mk("div", "fwell");
  wrap.setAttribute("role", "cell");
  const slot = mk("div", "fslot");
  slot.tabIndex = 0;
  slot.setAttribute("role", "slider");
  slot.setAttribute("aria-label", label + " fader offset (dB over the automation)");
  slot.setAttribute("aria-valuemin", "-24");
  slot.setAttribute("aria-valuemax", "12");
  const groove = mk("i", "fgroove");
  const zero = mk("i", "fzero");                 // the 0 dB silkscreen line
  zero.style.setProperty("--f", String(gainToF(1)));
  const cap = mk("i", "fcap");
  slot.append(groove, zero, cap);
  const off = mk("output", "foff", "0.0");
  wrap.append(slot, off);
  const R = { wrap, slot, cap, off,
    paint(sec) {
      cap.style.setProperty("--f", String(gainToF(getGain())));
      const o = getOffset();
      off.textContent = fmtDb(o == null ? 0 : o);
      off.classList.toggle("dflt", o == null);
      slot.setAttribute("aria-valuenow", String(o == null ? 0 : o));
      slot.setAttribute("aria-valuetext", fmtDb(o == null ? 0 : o) + " dB");
    } };
  let d = null;
  slot.addEventListener("pointerdown", ev => {
    if (ev.button) return;
    ev.preventDefault();
    slot.focus({ preventScroll: true });
    try { slot.setPointerCapture(ev.pointerId); } catch (e) {}
    const o = getOffset();
    d = { y0: ev.clientY, o0: o == null ? 0 : o, cur: o == null ? 0 : o, moved: false };
  });
  slot.addEventListener("pointermove", ev => {
    if (!d) return;
    const dy = d.y0 - ev.clientY;                // up is more, everywhere
    if (!d.moved && Math.abs(dy) < 3) return;
    d.moved = true;
    // 0.15 dB per px: the ±24/12 range inside ~one slot of travel, fine
    // enough that a flick is a trim and a sweep is a move
    d.cur = faderDb(d.o0 + dy * 0.15);
    drag(d.cur);
    off.textContent = fmtDb(d.cur);
    off.classList.remove("dflt");
  });
  const finish = () => {
    if (!d) return;
    if (d.moved) write(d.cur === 0 ? null : d.cur);
    d = null;
  };
  slot.addEventListener("pointerup", finish);
  slot.addEventListener("pointercancel", () => { d = null; });
  slot.addEventListener("dblclick", () => { write(null); buzz(4); });
  slot.addEventListener("keydown", ev => {
    const o = getOffset() == null ? 0 : getOffset();
    const step = (n) => { write(faderDb(o + n) || null); ev.preventDefault(); };
    if (ev.key === "ArrowUp") step(0.5);
    else if (ev.key === "ArrowDown") step(-0.5);
    else if (ev.key === "PageUp") step(3);
    else if (ev.key === "PageDown") step(-3);
    else if (ev.key === "Home") { write(null); ev.preventDefault(); }
  });
  return R;
}

function build() {
  chanWell.textContent = "";
  refs = rows.map((row, i) => {
    const tr = mk("div", "strip mrow" + (row.sect ? " msec" : ""));
    tr.setAttribute("role", "row");
    // ---- the label block: who this is, what plays it, where it goes ----
    const head = mk("div", "mlabel");
    head.setAttribute("role", "cell");
    const num = mk("b", "mnum tnum", row.sect ? "" : String(i + 1));
    const pn = mk("b", "mpn", row.label), ps = mk("i", "mps", row.sound);
    const feed = mk("i", "mfeed", row.sect ? "→ master bus" : "→ section");
    head.append(num, pn, ps, feed);
    tr.append(head);
    // ---- the value keys: the same chips, one tap away ----
    const vals = mk("div", "mvals");
    vals.setAttribute("role", "cell");
    const cells = {};
    for (const f of colsOf(row)) {
      const kwrap = mk("span", "mcell mc-" + f.key);
      const leg = mk("i", "mvlab", KEYLEG[f.key] || f.key);
      const b = mk("button", "mval");
      b.type = "button";
      b.dataset.part = row.key == null ? "" : row.key;
      b.dataset.field = f.key;
      b.addEventListener("click", ev => { ev.stopPropagation(); openPop(b, row, f); });
      kwrap.append(leg, b); vals.append(kwrap);
      cells[f.key] = b;
    }
    tr.append(vals);
    // ---- M and S: the two that latch rather than open ----
    const ms = mk("div", "mms");
    ms.setAttribute("role", "cell");
    const keys = {};
    for (const k of ["mute", "solo"]) {
      if (row.sect) { keys[k] = null; continue; }
      const b = mk("button", "mkey mk-" + k, k === "mute" ? "M" : "S");
      b.type = "button";
      b.addEventListener("click", ev => {
        ev.stopPropagation();
        writeField(curSection(), row.key, k, !readField(curSection(), row.key, k));
        buzz(4);
      });
      ms.append(b);
      keys[k] = b;
    }
    tr.append(ms);
    // ---- the automated fader ----
    const fader = buildFader({
      label: row.label,
      getOffset: () => offsetOf(curSection(), row.key),
      getGain: () => liveGain(curSection(), row.key),
      write: off => writeField(curSection(), row.key, "fader", off),
      drag: off => easeLive(curSection(), row.key, off),
    });
    tr.append(fader.wrap);
    chanWell.append(tr);
    return { tr, num, pn, ps, cells, keys, fader };
  });
}

function patch() {
  const sec = curSection();
  const P = sec.parts || null;
  const solo = !!P && rows.some(r => r.key && P[r.key] && P[r.key].solo);
  rows.forEach((row, i) => {
    const R = refs[i];
    const ent = entryOf(sec, row.key);
    const muted = !row.sect && !!ent && !!ent.mute;
    const off = !row.sect && (muted || (solo && !(ent && ent.solo)));
    R.tr.className = "strip mrow" + (row.sect ? " msec" : "") + (off ? " off" : "");
    R.tr.setAttribute("aria-label", row.label + " · " + row.sound +
      (off ? " · silent" : ""));
    for (const f of colsOf(row)) {
      const b = R.cells[f.key], v = readField(sec, row.key, f.key);
      const d = defaultOf(sec, row.key, f.key);
      if (f.key === "fx") {
        b.textContent = "";
        if (v.length) for (const k of v) b.append(mk("i", "mfxc", FX[k].label));
        else b.append(mk("i", "mfxc none", "—"));
        b.classList.toggle("set", !!v.length);
        b.classList.toggle("dflt", !v.length);
        b.title = v.length ? v.map(k => FX[k].label).join(" → ")
                           : "no effects on this " + (row.sect ? "section" : "part");
      } else {
        const shown = v != null ? v : (d && d.v);
        b.textContent = shown ? shortOf(f.key, shown) : "—";
        b.classList.toggle("set", v != null);
        b.classList.toggle("dflt", v == null);
        b.title = (v != null ? longOf(f.key, v)
                             : (shown ? longOf(f.key, shown) : "—") +
                               (d && d.note ? " · " + d.note : " · default")) + "";
      }
      b.setAttribute("aria-label", row.label + " " + f.key + ": " + b.title);
    }
    for (const k of ["mute", "solo"]) {
      const b = R.keys[k];
      if (!b) continue;
      const on2 = !!(ent && ent[k]);
      b.classList.toggle("on", on2);
      b.setAttribute("aria-pressed", String(on2));
      b.setAttribute("aria-label", (on2 ? "un-" : "") + k + " " + row.label);
    }
    R.fader.paint(sec);
  });
  patchPop();
}

export function drawMix() {
  const sec = curSection();
  const next = rowsOf(sec);
  const s = next.map(r => r.key + ":" + r.label + ":" + r.sound).join("|");
  rows = next;
  if (s !== sig) { sig = s; build(); }
  patch();
}

/* ---------- the value-key popover ---------- */
// ONE dialog and one scrim, built once and hidden between uses. It carries the
// chip set for exactly one key — the same chips, the same registry tables, so
// "wet" is one word on this machine and not two. Behaviour unchanged from the
// table era (the browser gates drive it): a one-of key closes on the choice,
// the effects key stays open, Esc/scrim/other dismisses.
let popRow = null, popField = null, popSig = "", popCell = null;
const scrim = Object.assign(document.createElement("div"),
  { className: "mpscrim", hidden: true });
const pop = Object.assign(document.createElement("div"),
  { className: "mixpop", id: "mixpop", hidden: true });
pop.setAttribute("role", "dialog");
const popTitle = mk("span", "mptitle", "");
const popX = mk("button", "rpk mpx", "✕");
popX.type = "button"; popX.setAttribute("aria-label", "close");
popX.addEventListener("click", () => closePop());
const popHead = mk("div", "mphead");
popHead.append(popTitle, popX);
const popChips = mk("div", "mchips");
pop.append(popHead, popChips);
document.body.append(scrim, pop);

const chipList = f => (f.key === "fx"
  ? Object.keys(FX).map(k => [k, FX[k].label])
  : Object.keys(f.table).map(k => [k, f.labels[k]]));
function buildPop() {
  popChips.textContent = "";
  for (const [v, label] of chipList(popField)) {
    const b = mk("button", "mchip", label);
    b.type = "button";
    b.dataset.value = v;
    b.addEventListener("click", () => hit(v));
    popChips.append(b);
  }
}
function hit(v) {
  const sec = curSection();
  if (popField.key === "fx") {
    const cur = readField(sec, popRow.key, "fx").slice();
    const i = cur.indexOf(v);
    if (i >= 0) cur.splice(i, 1);
    else if (cur.length < MAX_FX) cur.push(v);
    else return buzz(8);                   // the chain is full: say so in the hand
    writeField(sec, popRow.key, "fx", cur);
    buzz(4);
    return;
  }
  const cur = readField(sec, popRow.key, popField.key);
  writeField(sec, popRow.key, popField.key, cur === v ? null : v);
  buzz(4);
  closePop();
}
function patchPop() {
  if (!popRow) return;
  const sec = curSection();
  const v = readField(sec, popRow.key, popField.key);
  const d = defaultOf(sec, popRow.key, popField.key);
  for (const b of popChips.children) {
    const on2 = popField.key === "fx" ? v.includes(b.dataset.value)
                                      : v === b.dataset.value;
    const dflt = !on2 && popField.key !== "fx" && v == null && !!d && d.v === b.dataset.value;
    b.classList.toggle("on", on2 || dflt);
    b.classList.toggle("dflt", dflt);
    b.setAttribute("aria-pressed", String(on2));
  }
}
function place() {
  if (!popCell) return;
  const r = popCell.getBoundingClientRect();
  if (innerWidth >= WIDE) {
    pop.classList.add("beside"); scrim.classList.add("beside");
    pop.style.maxHeight = "";
    const w = pop.offsetWidth;
    const below = innerHeight - r.bottom - 12, above = r.top - 12;
    const under = below >= 220 || below >= above;
    const room = Math.max(160, under ? below : above);
    const h = Math.min(pop.offsetHeight, room);
    pop.style.left = Math.min(Math.max(8, r.left - 6), innerWidth - w - 8) + "px";
    pop.style.top = (under ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + "px";
    pop.style.maxHeight = room + "px";
    return;
  }
  pop.classList.remove("beside"); scrim.classList.remove("beside");
  pop.style.left = ""; pop.style.top = ""; pop.style.maxHeight = "";
}
function openPop(cell, row, f) {
  const same = popRow && popRow.key === row.key && popField === f;
  if (same) return closePop();             // a second tap on the same key shuts it
  popRow = row; popField = f; popCell = cell;
  const s = row.key + "|" + f.key;
  if (s !== popSig) { popSig = s; buildPop(); }
  popTitle.textContent = row.label + " · " + (f.key === "fx" ? "effects" : f.key) +
    (f.key === "fx" ? "  (up to " + MAX_FX + ", in order)" : "");
  pop.setAttribute("aria-label", popTitle.textContent);
  scrim.hidden = false; pop.hidden = false;
  cell.classList.add("open");
  place();
  patchPop();
  popX.focus({ preventScroll: true });
  buzz(4);
}
function closePop() {
  if (!popRow) return;
  if (popCell) popCell.classList.remove("open");
  popRow = null; popField = null; popCell = null;
  pop.hidden = true; scrim.hidden = true;
}
scrim.addEventListener("click", () => closePop());
addEventListener("keydown", ev => {
  if (popRow && ev.key === "Escape") { closePop(); ev.preventDefault(); }
});
addEventListener("resize", () => { if (popRow) place(); });

/* ==================== THE BUS STRIPS ==================== */
// One strip per SHARED bus (graph.js's roster: reverb, echo, drum room), a
// slim strip per character send bus as it builds, and the MASTER strip. The
// three fixed buses' faders are DETENTED — they drive the song's `buses`
// trims (fields.js BUS_FIELDS `ret`), the same value the rack's return knob
// turns: two views, one state, the transport-fader/master-strip pattern.
const busWrite = (bus, key, val) => {
  const next = JSON.parse(JSON.stringify(BUSES || {}));
  const e = next[bus] || (next[bus] = {});
  if (val) e[key] = val; else delete e[key];
  if (!Object.keys(e).length) delete next[bus];
  setBuses(next);
  initAudio();                             // a knob move is a user gesture
  commit("buses");
};
const busVal = (bus, key) => (BUSES && BUSES[bus] && BUSES[bus][key]) || "";

// a detented vertical fader over one knob row's table: positions ordered by
// value with the empty detent ("as built") sitting at its own value slot
function buildBusFader(busKey, kn) {
  const det = ["", ...Object.keys(kn.table)]
    .sort((a, b) => (a ? kn.table[a] : 1) - (b ? kn.table[b] : 1));
  const wrap = mk("div", "fwell");
  const slot = mk("div", "fslot bslot");
  slot.tabIndex = 0;
  slot.setAttribute("role", "slider");
  slot.setAttribute("aria-label", busKey + " bus " + kn.label);
  slot.setAttribute("aria-valuemin", "0");
  slot.setAttribute("aria-valuemax", String(det.length - 1));
  const groove = mk("i", "fgroove");
  const cap = mk("i", "fcap");
  slot.append(groove, cap);
  const off = mk("output", "foff", "—");
  wrap.append(slot, off);
  const idx = () => Math.max(0, det.indexOf(busVal(busKey, kn.key)));
  const paint = () => {
    const i = idx(), k = det[i];
    cap.style.setProperty("--f", String(det.length > 1 ? i / (det.length - 1) : 0));
    off.textContent = k ? kn.labels[k] : "—";
    off.classList.toggle("dflt", !k);
    slot.setAttribute("aria-valuenow", String(i));
    slot.setAttribute("aria-valuetext", k ? kn.labels[k] : "as built");
  };
  const setIdx = i => {
    const c = Math.max(0, Math.min(det.length - 1, i));
    if (c === idx()) return;
    busWrite(busKey, kn.key, det[c] || null);
    buzz(4);
  };
  let d = null;
  slot.addEventListener("pointerdown", ev => {
    if (ev.button) return;
    ev.preventDefault();
    slot.focus({ preventScroll: true });
    try { slot.setPointerCapture(ev.pointerId); } catch (e) {}
    d = { y0: ev.clientY, i0: idx() };
  });
  slot.addEventListener("pointermove", ev => {
    if (!d) return;
    setIdx(d.i0 + Math.round((d.y0 - ev.clientY) / 22));
  });
  slot.addEventListener("pointerup", () => { d = null; });
  slot.addEventListener("pointercancel", () => { d = null; });
  slot.addEventListener("dblclick", () => setIdx(det.indexOf("")));
  slot.addEventListener("keydown", ev => {
    if (ev.key === "ArrowUp") { setIdx(idx() + 1); ev.preventDefault(); }
    else if (ev.key === "ArrowDown") { setIdx(idx() - 1); ev.preventDefault(); }
    else if (ev.key === "Home") { setIdx(det.indexOf("")); ev.preventDefault(); }
  });
  return { wrap, paint };
}

const busRefs = [];                        // { paint() } for everything below
function buildBusStrip(row) {
  const tr = mk("div", "strip bstrip");
  tr.setAttribute("role", "row");
  const head = mk("div", "mlabel");
  head.setAttribute("role", "cell");
  const pn = mk("b", "mpn", row.label);
  const ps = mk("i", "mps", row.feed);
  const state = mk("i", "mfeed", "");
  head.append(pn, ps, state);
  tr.append(head);
  const ret = row.knobs.find(k => k.key === "ret");
  const fader = buildBusFader(row.bus, ret);
  tr.append(fader.wrap);
  busWell.append(tr);
  busRefs.push({ paint() {
    fader.paint();
    // the built state, read off the nodes (graph.busReport): which returns
    // exist and where they actually sit — dim silence before initAudio
    const rep = busReport();
    let t = "";
    if (rep) {
      if (row.bus === "rev") {
        const built = Object.keys(rep.rev || {});
        t = built.length ? built.map(n => n + " " + rep.rev[n]).join(" · ")
                         : "no verb built yet";
      } else if (row.bus === "echo" && rep.echo) {
        t = "ret " + rep.echo.ret + " · fb " + rep.echo.fb + " · " + rep.echo.tone + " Hz";
      } else if (row.bus === "room") {
        t = rep.room != null ? "return " + rep.room : "no room (dry)";
      }
    }
    if (state.textContent !== t) state.textContent = t;
  } });
}

// a slim page-lifetime strip per BUILT character send bus: its fader is the
// bus's own `ret` gain, a trim on the page rather than on the song (which is
// why it commits nothing and appears only once the bus exists)
const sendStrips = new Map();              // fx key -> strip element
function ensureSendStrips() {
  const list = SENDBUS ? Object.keys(SENDBUS).filter(k => SENDBUS[k]) : [];
  for (const k of list) {
    if (sendStrips.has(k)) continue;
    const bus = SENDBUS[k];
    const tr = mk("div", "strip bstrip send");
    tr.setAttribute("role", "row");
    const head = mk("div", "mlabel");
    head.setAttribute("role", "cell");
    head.append(mk("b", "mpn", (FX[k] && FX[k].label) || k),
                mk("i", "mps", "send bus · this session"));
    tr.append(head);
    const wrap = mk("div", "fwell");
    const slot = mk("div", "fslot bslot");
    slot.tabIndex = 0;
    slot.setAttribute("role", "slider");
    slot.setAttribute("aria-label", ((FX[k] && FX[k].label) || k) + " bus return");
    const groove = mk("i", "fgroove"), cap = mk("i", "fcap");
    slot.append(groove, cap);
    const off = mk("output", "foff", "1.00");
    wrap.append(slot, off);
    tr.append(wrap);
    const paint = () => {
      const v = bus.ret.gain.value;
      cap.style.setProperty("--f", String(Math.max(0, Math.min(1, v / 1.6))));
      off.textContent = v.toFixed(2);
    };
    let d = null;
    slot.addEventListener("pointerdown", ev => {
      if (ev.button) return;
      ev.preventDefault();
      try { slot.setPointerCapture(ev.pointerId); } catch (e) {}
      d = { y0: ev.clientY, v0: bus.ret.gain.value };
    });
    slot.addEventListener("pointermove", ev => {
      if (!d) return;
      const v = Math.max(0, Math.min(1.6, d.v0 + (d.y0 - ev.clientY) * 0.01));
      try { bus.ret.gain.value = v; } catch (e) {}
      paint();
    });
    slot.addEventListener("pointerup", () => { d = null; });
    slot.addEventListener("pointercancel", () => { d = null; });
    busWell.insertBefore(tr, masterStrip);
    sendStrips.set(k, tr);
    busRefs.push({ paint });
  }
}

// ---- the MASTER strip: the meter, the device volume, the active stages ----
// The fader here IS the transport's volume fader — the sticky device vol
// (ui/state.js VOLSTORE), two views over one store, deliberately NOT in the
// song. The meter reads graph.rmsNow() per frame: the sum, pre-volume.
let masterStrip = null;
{
  const tr = mk("div", "strip bstrip mstr");
  tr.setAttribute("role", "row");
  const head = mk("div", "mlabel");
  head.setAttribute("role", "cell");
  const pn = mk("b", "mpn", "master");
  const ps = mk("i", "mps", "the sum · device volume");
  const stages = mk("i", "mfeed mstages", "");
  head.append(pn, ps, stages);
  tr.append(head);
  const body = mk("div", "mbody");
  const meter = mk("div", "meter");
  const mfill = mk("i", "mfill");
  meter.append(mfill);
  const wrap = mk("div", "fwell");
  const slot = mk("div", "fslot vslot");
  slot.tabIndex = 0;
  slot.setAttribute("role", "slider");
  slot.setAttribute("aria-label", "master volume");
  slot.setAttribute("aria-valuemin", "0");
  slot.setAttribute("aria-valuemax", "100");
  const groove = mk("i", "fgroove"), cap = mk("i", "fcap");
  slot.append(groove, cap);
  const off = mk("output", "foff", String(vol));
  wrap.append(slot, off);
  body.append(meter, wrap);
  tr.append(body);
  busWell.append(tr);
  masterStrip = tr;
  const paint = () => {
    cap.style.setProperty("--f", String(vol / 100));
    off.textContent = String(vol);
    slot.setAttribute("aria-valuenow", String(vol));
    const rep = masterReport();
    const t = rep && rep.stages.length ? rep.stages.join(" · ") : "default chain";
    if (stages.textContent !== t) stages.textContent = t;
    // −60..0 dBFS onto the meter — the same log window every meter uses
    const r = rmsNow();
    const db = 20 * Math.log10(Math.max(1e-4, r));
    mfill.style.setProperty("--f", String(Math.max(0, Math.min(1, (db + 60) / 60))));
  };
  const setV = v => {
    const c = Math.round(Math.max(0, Math.min(100, v)));
    if (c === vol) return;
    setVol(c);
    commit("transport");
    paint();
  };
  let d = null;
  slot.addEventListener("pointerdown", ev => {
    if (ev.button) return;
    ev.preventDefault();
    slot.focus({ preventScroll: true });
    try { slot.setPointerCapture(ev.pointerId); } catch (e) {}
    d = { y0: ev.clientY, v0: vol };
  });
  slot.addEventListener("pointermove", ev => {
    if (!d) return;
    setV(d.v0 + (d.y0 - ev.clientY) * 0.6);
  });
  slot.addEventListener("pointerup", () => { d = null; });
  slot.addEventListener("pointercancel", () => { d = null; });
  slot.addEventListener("keydown", ev => {
    if (ev.key === "ArrowUp") { setV(vol + 1); ev.preventDefault(); }
    else if (ev.key === "ArrowDown") { setV(vol - 1); ev.preventDefault(); }
  });
  busRefs.push({ paint });
}
for (const row of BUS_FIELDS) buildBusStrip(row);
// the fixed strips were appended after the master (it was built first so the
// send strips could insert before it); put the master back at the right edge
busWell.append(masterStrip);

/* ==================== THE EFFECTS RACK ==================== */
// One knob row per shared bus (fields.js BUS_FIELDS), then the MASTER row —
// the fields.js MASTER registry, moved here off the SONG page's session bank.
// No hand-written label table anywhere: every word is the registry's.
//
// THE KNOB is this page's one rotary: role="slider", ArrowLeft/Right steps
// the detents, Home is the empty detent (absent, the only spelling of off),
// pointer drag rotates, a tap opens the pop-up fader on the same detents.
// `data-value` mirrors the current key so a gate can drive it blind.
const rack = document.getElementById("rack");
const rackKnobs = [];
function buildKnob({ id, label, keys, labels, get, set }) {
  const det = ["", ...keys];
  const wrap = mk("div", "kwrap");
  const leg = mk("span", "klab", label);
  const b = mk("button", "knobk");
  b.type = "button";
  if (id) b.id = id;
  b.setAttribute("role", "slider");
  b.setAttribute("aria-label", label);
  b.setAttribute("aria-valuemin", "0");
  b.setAttribute("aria-valuemax", String(det.length - 1));
  b.dataset.detents = JSON.stringify(det);
  const face = mk("span", "kface");
  const markEl = mk("i", "kmark");
  face.append(markEl);
  const val = mk("span", "kval", "—");
  b.append(face);
  wrap.append(leg, b, val);
  const idx = () => Math.max(0, det.indexOf(get() || ""));
  const paint = () => {
    const i = idx(), n = det.length - 1, k = det[i];
    face.style.setProperty("--ka", (-135 + (n ? (i / n) * 270 : 0)) + "deg");
    val.textContent = k ? labels[k] : "—";
    b.dataset.value = k;
    b.classList.toggle("set", !!k);
    b.setAttribute("aria-valuenow", String(i));
    b.setAttribute("aria-valuetext", k ? labels[k] : "off");
  };
  const setIdx = i => {
    const c = Math.max(0, Math.min(det.length - 1, i));
    if (c === idx()) return;
    set(det[c] || null);
    buzz(4);
    paint();
    // the chyron says what landed, the way the old session-bank selects did
    emit("status", { text: label + ": " + (det[c] ? labels[det[c]] : "off") });
  };
  b.addEventListener("keydown", ev => {
    if (ev.key === "ArrowRight" || ev.key === "ArrowUp") { setIdx(idx() + 1); ev.preventDefault(); }
    else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") { setIdx(idx() - 1); ev.preventDefault(); }
    else if (ev.key === "Home") { setIdx(0); ev.preventDefault(); }
    else if (ev.key === "End") { setIdx(det.length - 1); ev.preventDefault(); }
  });
  let d = null;
  b.addEventListener("pointerdown", ev => {
    if (ev.button) return;
    ev.preventDefault();
    b.focus({ preventScroll: true });
    try { b.setPointerCapture(ev.pointerId); } catch (e) {}
    d = { y0: ev.clientY, i0: idx(), moved: false };
  });
  b.addEventListener("pointermove", ev => {
    if (!d) return;
    const di = Math.round((d.y0 - ev.clientY) / 24);
    if (di) d.moved = true;
    setIdx(d.i0 + di);
  });
  b.addEventListener("pointerup", () => {
    if (d && !d.moved)
      openFader({ anchor: b, label, min: 0, max: det.length - 1,
                  get: idx, set: setIdx,
                  fmt: i => (det[i] ? labels[det[i]] : "—") });
    d = null;
  });
  b.addEventListener("pointercancel", () => { d = null; });
  paint();
  rackKnobs.push(paint);
  return wrap;
}
{
  rack.append(mk("div", "thd", "Effects rack"));
  // one row per shared bus
  for (const row of BUS_FIELDS) {
    const rr = mk("div", "rrow");
    rr.append(mk("b", "rname", row.label));
    const ks = mk("div", "rknobs");
    for (const kn of row.knobs)
      ks.append(buildKnob({
        id: "b-" + row.bus + "-" + kn.key,
        label: kn.label, keys: Object.keys(kn.table), labels: kn.labels,
        get: () => busVal(row.bus, kn.key),
        set: v => busWrite(row.bus, kn.key, v),
      }));
    rr.append(ks);
    rack.append(rr);
  }
  // the MASTER row: chrome.js's registry loop, re-homed — same read-modify-
  // write through the store's own setter, same ids, the widget now a knob
  const rr = mk("div", "rrow rmaster");
  const name = mk("b", "rname", "master");
  const help = mk("button", "btn hint", "?");
  help.type = "button"; help.id = "mhelp";
  help.setAttribute("aria-expanded", "false");
  help.setAttribute("aria-controls", "mhint");
  help.title = "what the master bus does";
  name.append(help);
  rr.append(name);
  const ks = mk("div", "rknobs");
  for (const f of MASTER_FIELDS)
    ks.append(buildKnob({
      id: "m-" + f.key,
      label: f.label, keys: Object.keys(f.table), labels: f.labels,
      get: () => (MASTER && MASTER[f.key]) || "",
      set: v => {
        const next = { ...(MASTER || {}) };
        if (v) next[f.key] = v; else delete next[f.key];
        setMaster(next);
        initAudio();                       // a knob move is a user gesture
        commit("master");
      },
    }));
  rr.append(ks);
  rack.append(rr);
  const hint = mk("p", "edhint ghint");
  hint.id = "mhint"; hint.hidden = true;
  hint.innerHTML = "The chain the whole song lands on, after every strip on " +
    "the board. <b>Drive</b> is grit on the sum; <b>glue</b> is the character " +
    "of the bus compressor that is always there; <b>tape</b> is a transport " +
    "that drifts and a head that saturates; <b>space</b> bleeds a little of " +
    "the dry mix into one shared room, which is what makes it different from " +
    "a strip's reverb send; <b>width</b> trims the sides; <b>tilt</b> rocks " +
    "the spectrum about its middle; <b>ceiling</b> is how hard the end of the " +
    "chain works. The bus rows above trim the shared returns the same way. " +
    "Every knob is off until you set it, they save with the song, and the " +
    "background carrier renders through the same chain — a song sounds the " +
    "way you left it wherever it is played.";
  rack.append(hint);
  hintKey("mhelp", "mhint");
}
const paintKnobs = () => { for (const p of rackKnobs) p(); };

/* ---------- the frame paint ---------- */
// Called from main.js's one rAF loop while the transport runs (the one-loop
// rule), and from the event subscriptions below when it does not — so the
// caps follow the automation live and settle to the resolved statics at rest.
export function paintBoard() {
  const sec = curSection();
  for (let i = 0; i < rows.length; i++) refs[i] && refs[i].fader.paint(sec);
  ensureSendStrips();
  for (const r of busRefs) r.paint();
}

/* ---------- subscriptions ---------- */
on("page", () => closePop());
on("song", () => { closePop(); sig = ""; drawMix(); paintKnobs(); paintBoard(); });
on("box", () => { drawMix(); paintBoard(); });
on("selection", () => { drawMix(); paintBoard(); });
on("refresh", () => { drawMix(); paintBoard(); });
on("master", () => { paintKnobs(); paintBoard(); });
on("buses", () => { paintKnobs(); paintBoard(); });
on("transport", () => paintBoard());       // the master strip mirrors the vol fader
