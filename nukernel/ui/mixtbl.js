// ui/mixtbl.js — THE BOARD: the MIX page as a stack of labelled bars.
//
// THE COSTUME CAME OFF (Paul, 2026-08-16: "Mix is too skeuomorphic. Just give
// everything except master level sliders a horizontal slider type with inner
// labeled indicators — here a bar graph simple thing is okay. Use color. Make
// the effects busses into special channel strips. Label the channels at the
// top."). This reverses the SSL 4000 dress of 38a509c deliberately: the
// molded caps, the colorway plastic, the milled slots and the rotary rack are
// gone, and every one of them is replaced by ONE control.
//
// THE BAR is that control, and there is nothing else on this page that takes
// a value: a flat track, a FILL that is the value, and the two words printed
// INSIDE it — the control's name left-anchored, its number right-anchored.
// You read a strip the way you read a sentence, without a legend, because
// every bar says its own name. It drags across its width (and up its height:
// the house's DRAG-VERTICAL verb still means "more", so the dominant axis
// wins and neither gesture is dead), it is a role=slider with arrow keys, and
// a tap opens the surface behind it — the pop-up fader on a continuous bar,
// the chip set on a value key. Level, sends, pan, the EQ bands, the returns'
// trims and the master's seven stages are all the same object at different
// scales. The ONE exception Paul named is the MASTER LEVEL, which stays a
// vertical slider beside its meter, because that is the one control on the
// page you reach for while listening rather than while reading.
//
// COLOR IS THE WAYFINDING, not decoration. One hue per control FAMILY —
// level / pan / sends / inserts / EQ / bus returns / master — declared as
// tokens on the board in kernel-daw.css and spent by `data-fam`. Nothing on
// this page is coloured for looks, and a hue never means two things.
//
// STATE IS FILL, and the derived-vs-user law survives the redesign intact: a
// DIM fill is the song's own answer (the composer's seating, the genre's
// wetness, the enum default) and a BRIGHT one is a value YOU set. The
// automated level keeps moving inside its bar while the transport runs.
//
// THE AUTOMATED LEVEL BAR'S LAW (unchanged from the fader it replaces): the
// FILL follows the level actually driving the channel — the enum level, the
// composer's arc, a `pump` — read per frame off the built gain nodes (CHAN,
// audio/mixer.js). A drag does NOT fight that: it writes a persistent dB
// OFFSET (fields.js `fader`, PARTMIX `fader`) that multiplies the automated
// value, and that offset is the NUMBER printed in the bar. Automation keeps
// moving under your trim. During the drag the target gain is eased onto the
// live AudioParam for immediacy; the value commits on pointerup — one writer,
// no fight.
//
// THE BUSES TAKE SEATS. reverb / echo / drum room are CHANNEL STRIPS now, in
// the same grammar as a voice's, marked by their own hue and a "return" tag —
// and the separate knob RACK that used to sit under the board is ABSORBED
// into them: each bus's rack row (return, repeats, tone) is now that strip's
// own bars, ids `#b-<bus>-<key>` intact. The MASTER registry's seven stages
// (`#m-<key>`) moved the same way, onto the master strip. Nothing at all is
// left below the board: #rack keeps its id and stays permanently empty.
//
// WHAT SURVIVES, deliberately: rowsOf (the track list is still the mixer's
// own roster), readField/writeField (one writer, absent the only spelling of
// a default), the cell POPOVER with its chips, and the .mrow/.msec/.mval/
// .mk-*/.mchip/.eqk/.fcap class names and the #m-*/#b-* ids, which are
// LOAD-BEARING: four browser gates drive this surface through exactly those
// hooks. Only CHANNEL strips carry .mrow — the drums gate counts them against
// the part roster.
//
// Layer graph: ui view — imports state/derive/deps, audio/graph, audio/mixer
// and audio/assets for READS ONLY, and leaves every change through commit().
// Audio never calls the board; the board only reads node params per frame
// (main.js's one rAF loop calls paintBoard) — the one-way rule holds.
import { GENRES, FX, MAX_FX, SENDS, SENDLABEL, DRUMKITS, PARTMIX,
         partChairLabel, BASS_INSTR, BASSSYNTH, LEVELS, faderDb,
         resolvePartMix, MASTER_FIELDS, BUS_FIELDS,
         EQ_BANDS, EQ_RANGE, eqDb, INSTRCHOICES, POOLCHAIRS,
         VERBS, DTIMES, DTLABEL } from "./deps.js";
import { curSection, commit, on, emit, MASTER, setMaster, BUSES, setBuses,
         vol, setVol, SONG, POOL, setPoolChair } from "./state.js";
// the same twelve families the SONG page's pool bank offers — two views, one
// store (ui/state.js POOL): a strip's instrument label opens THIS picker
import { INSTRFAMS } from "./palette.js";
// READ-ONLY, and the allowed direction (a view importing audio — main.js does
// the same): the two live bindings that say which box is SOUNDING, so the desk
// can play along instead of staring at the selection while the song moves on.
import { playing as transportOn, playingSec } from "../audio/transport.js";
import { stackOf, kitOf, voiceOwners } from "./derive.js";
import { voiceRoster, partKeysOf, CHAN, resolvedPart, derivedPartTone,
         derivedSecEq } from "../audio/mixer.js";
import { initAudio, rmsNow, masterReport, busReport,
         SENDBUS } from "../audio/graph.js";
import { isSynthFont, fontDef } from "../audio/assets.js";
import { openFader } from "./popfader.js";
import { buzz } from "./touch.js";

const el = document.getElementById("mixtbl");
// TABLE SEMANTICS still — a strip is a row you read DOWN, and you compare
// across the board the way you compared down a column. The roles are static
// because the DOM is.
el.setAttribute("role", "table");
el.setAttribute("aria-label",
  "the mixing board — the sounding box while playing, the selected box at rest");

// the width at which there is daylight beside a cell rather than only under
// the deck — the same 900px boundary the row sheet and the pop-up fader use.
const WIDE = 900;

/* ---------- which box the desk is aimed at ---------- */
// THE BOARD FOLLOWS THE SOUNDING BOX. While the transport runs, the strips
// re-target to the section the ear is in — the roster, the value keys, the
// bars all read (and write) THAT box. The SELECTED box wins only while the
// transport is stopped, or while the user is mid-edit: a finger down on a
// board control, an open value-key popover, or an open pop-up fader PINS the
// section, so the desk cannot swap out from under an edit and a commit cannot
// land on a box the user never touched.
let touching = 0;                          // fingers currently down on the board
let heldSec = null;                        // the section pinned under an edit
let pfEl = null;                           // ui/popfader.js's one element, lazily
function editing() {
  if (touching > 0 || popRow) return true;
  if (!pfEl) pfEl = document.getElementById("popfader");
  return !!(pfEl && !pfEl.hidden);
}
function boardSec() {
  if (editing() && heldSec) return heldSec;
  const s = (transportOn && playingSec >= 0 && SONG[playingSec])
    ? SONG[playingSec] : curSection();
  heldSec = s;
  return s;
}
// every drag opens with touchOn (which pins first) and must close with
// touchOff AFTER its commit, so the write lands on the box the drag edited
const touchOn = () => { boardSec(); touching++; };
const touchOff = () => { touching = Math.max(0, touching - 1); };

/* ---------- what the value keys are ---------- */
// The five PARTMIX enum fields, in registry order — same contract as ever:
// adding a control to the desk registry adds a bar to every strip and nothing
// else.
const COLS = PARTMIX.filter(f => f.type !== "flag" && f.type !== "num" &&
                                 f.type !== "eq");
// …PLUS THE TWO SECTION-ONLY FIELDS the palette's fx tab used to carry: which
// ROOM the reverb send lands in (sec.verb) and the echo's subdivision
// (sec.dtime). They are box fields with no part twin, so only the SECTION
// strip draws them — dropping them here would make them unreachable, and the
// inventory law is that nothing may.
const SECCOLS = [
  { key: "verb",  table: VERBS,  labels: VERBS },
  { key: "dtime", table: DTIMES, labels: DTLABEL },
];
// THE READING ORDER IS THE COLOUR ORDER, which is what the redesign buys: a
// strip descends level → place → sends → inserts → tone, so the hues run in
// bands down the strip and you find the send you want by colour before you
// have read a word.
const KEYORD = ["lvl", "pan", "rev", "echo", "verb", "dtime", "fx"];
const colsOf = row => [...(row.sect ? [...COLS, ...SECCOLS] : COLS)]
  .sort((a, b) => KEYORD.indexOf(a.key) - KEYORD.indexOf(b.key));
// THE FAMILY of each value key — the hue token kernel-daw.css spends. One hue
// per family, and a hue never means two things.
const FAM = { lvl: "level", pan: "pan", rev: "send", echo: "send",
              verb: "send", dtime: "send", fx: "fx" };
// which keys read BIPOLAR (a fill out of the centre rather than up from the
// left): pan is the only value key that has a middle
const BIPOLAR = { pan: true };
const SHORT = {
  rev: SENDLABEL, echo: SENDLABEL, dtime: DTLABEL,
  lvl: { hush: "hush", back: "back", norm: "norm", fwd: "fwd" },
  pan: { l: "left", hl: "left-ish", c: "centre", hr: "right-ish", r: "right" },
};
const LONG = {};
for (const f of [...COLS, ...SECCOLS]) LONG[f.key] = f.labels;
const shortOf = (f, v) => (SHORT[f] && SHORT[f][v]) || v;
const longOf = (f, v) => (LONG[f] && LONG[f][v]) || v;
// the word printed at the LEFT of each bar — a strip has no header row to
// borrow a column name from, so every bar carries its own name
const KEYLEG = { fx: "inserts", rev: "reverb", echo: "echo", lvl: "level",
                 pan: "pan", verb: "room", dtime: "time" };

/* ---------- what the strips are ---------- */
const humanize = id => String(id || "").replace(/_/g, " ");
// WHAT A CHAIR ACTUALLY PLAYS — the roster carries the sampled instrument, but
// a genre with a signature `synth` never plays it, and a synth FONT overrides
// even that. A board that labels a 303 "clean guitar" is lying about the
// thing you are about to fade, so this mirrors that same switch.
function soundOf(g, r) {
  // the song POOL's pick mutes the signature synth (transport's law), and the
  // roster's r.id/r.over already carry the pool resolution — so the board's
  // chair labels read the pooled instrument, one resolver everywhere
  const syn = isSynthFont() ? fontDef().synth : (r.over ? null : (g && g.synth));
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
               sound: bs ? (bs.root || bs.dsp)
                 : humanize((POOL && POOL.bass) || BASS_INSTR) });
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
// ONE CHANNEL PER VOICE — the board's roster is the SONG's, not the section's
// ("One channel per voice!!", 2026-08-16). The strip set is the union of every
// section's chairs, in first-appearance order (so the opening box's chairs
// lead), bass and drums held to the tail, the section strip last — and it is
// FIXED for the whole song: a boundary changes VALUES on stable strips, never
// the strip set. A chair the current section does not sound stays on the desk,
// dimmed (patch marks it .idle), parked on its resolved static, and wakes when
// its section arrives. Identity is the chair KEY — the same vocabulary
// derive.js and the mixer address — which is what lets a label or a stored mix
// follow the chair across sections.
function songRows() {
  const idx = new Map();
  for (const sec of SONG) {
    if (!sec) continue;
    for (const r of rowsOf(sec)) {
      if (r.sect) continue;
      if (!idx.has(r.key)) idx.set(r.key, r);
    }
  }
  const tail = ["bass", "drums"];
  const out = [...idx.values()].filter(r => !tail.includes(r.key));
  for (const k of tail) if (idx.has(k)) out.push(idx.get(k));
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
// ONE WRITER, so a chip, a bar and a drag cannot disagree about what "off"
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
// a bright fill is one you set, a dim one is the fallback answering.
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

/* ---------- the level arithmetic ---------- */
// The bar maps −36..+12 dB of GAIN to 0..1 of fill: LEVELS spans −8..+2.6 dB,
// the offset ±24/12, the pump's duck −10 — all inside the track with the
// nulls readable. gainToF is the ONE place gain becomes fill.
const F_LO = -36, F_HI = 12;
const gainToF = g => {
  const db = 20 * Math.log10(Math.max(1e-4, g));
  return Math.max(0, Math.min(1, (db - F_LO) / (F_HI - F_LO)));
};
const fmtDb = v => (v > 0 ? "+" : "") + v.toFixed(1);
// the resolved STATIC level a strip rests at when its channel is not built —
// the mixer's own resolver (resolvedPart: derived seating × user trim), cited
// not re-invented, so the fill's rest length IS the part's built gain
const secBase = sec => (sec.lvl ? LEVELS[sec.lvl] : 1);
function staticGain(sec, key) {
  if (key == null) return secBase(sec) * Math.pow(10, faderDb(sec.fader) / 20);
  return resolvedPart(sec, key).gain;
}
// the LIVE gain: the built nodes when the channel exists (automation included
// — AudioParam.value reads the timeline), the resolved static value when not.
// Node reads only while the transport runs or a finger is down (the drag's
// eased param is its own feedback) — at rest the fills PARK on the resolved
// statics rather than on wherever a pump's duck happened to freeze.
function liveGain(sec, key) {
  const c = (transportOn || touching) && CHAN.get(sec);
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
  // the drag's target rides ON the derived seating (derivedPartTone.db), the
  // same composition buildChannel bakes — or the first frame after pointerup
  // would snap to a different gain than the hand just heard
  const base = key == null ? secBase(sec)
    : resolvePartMix(sec.parts && sec.parts[key]).lvl *
      Math.pow(10, derivedPartTone(sec, key).db / 20);
  const target = base * Math.pow(10, off / 20);
  const P = key == null ? null : c.parts.get(key);
  const p = key == null ? c.lvl.gain : (P ? P.lvl.gain : null);
  if (!p) return;                          // no bus yet: the commit builds one
  try {
    const t = c.input.context.currentTime;
    p.cancelScheduledValues(t); p.setTargetAtTime(target, t, 0.02);
  } catch (e) {}
}

/* ---------- the strip EQ ---------- */
// ONE READER, ONE WRITER, the field law: a band is read off the entry's `eq`
// map and written back through writeField, with zero (flat) deleted so absent
// stays the one spelling — song.js normalizes a save identically.
const eqBand = (sec, key, band) => {
  const e = entryOf(sec, key);
  return e && e.eq && e.eq[band] != null ? e.eq[band] : null;
};
function writeEqBand(sec, key, band, db) {
  const e = entryOf(sec, key);
  const cur = { ...((e && e.eq) || {}) };
  const v = db == null ? 0 : eqDb(db);
  if (v) cur[band] = v; else delete cur[band];
  writeField(sec, key, "eq", Object.keys(cur).length ? cur : null);
}
// ease the drag onto the LIVE biquad so the hand hears the tone move before
// the commit rebuilds the channel — easeLive's law for the level, per band.
// A flat strip has no node to ease (zero-nodes law); the commit builds one.
function easeEqLive(sec, key, band, db) {
  const c = CHAN.get(sec);
  if (!c) return;
  const by = key == null ? c.eq
    : (() => { const P = c.parts.get(key); return P && P.eq; })();
  const f = by && by[band];
  if (!f) return;
  try {
    const t = c.input.context.currentTime;
    f.gain.cancelScheduledValues(t); f.gain.setTargetAtTime(db || 0, t, 0.02);
  } catch (e) {}
}
// short dB for a bar-sized readout: "+4", "-2.5", "0" dim when flat
const fmtEq = v => (v > 0 ? "+" : "") +
  (Math.round(v * 10) % 10 ? v.toFixed(1) : String(Math.round(v)));

/* ==================== THE BAR ==================== */
// The page's ONE control. Everything below builds one of these and hands it a
// getter, a writer and a name; nothing on this board draws a second widget.
//
// GEOMETRY: the fill is spelled as two edges, --a and --b, in fractions of
// the track. Unipolar controls run 0 → f; BIPOLAR ones (pan, the EQ bands)
// run from the .5 centre out to .5 ± f/2, so "flat" is a hairline at the
// middle and the direction of a cut is visible without reading the number.
// --f carries the raw fraction beside them: it is what the board gates read
// off .fcap, and it is the honest name for how far along the throw a value
// sits.
//
// GESTURE: pointer drag on the DOMINANT AXIS (across is the natural reading
// of a horizontal bar; up is the house's DRAG-VERTICAL verb and every browser
// gate's habit — supporting both costs one Math.abs and kills no gesture),
// arrow keys, and a tap that opens whatever surface the caller passes as
// `tap`. touch-action none: the drag is the control's own gesture, not a
// scroll.
const mk = (tag, cls, txt) => {
  const n = document.createElement(tag);
  n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};
// the dominant axis of a drag, in "more" units: right is more, up is more
const axis = (ev, d) => {
  const dx = ev.clientX - d.x0, dy = d.y0 - ev.clientY;
  return Math.abs(dx) >= Math.abs(dy) ? dx : dy;
};
function makeBar({ cls, fillCls, fam, legend, label, bipolar, aria }) {
  const b = mk("button", "mbar " + (cls || ""));
  b.type = "button";
  b.dataset.fam = fam;
  if (bipolar) b.dataset.bipolar = "1";
  b.setAttribute("role", "slider");
  b.setAttribute("aria-label", label);
  if (aria) for (const [k, v] of Object.entries(aria)) b.setAttribute(k, v);
  const fill = mk("i", "bfill " + (fillCls || ""));
  const lab = mk("i", "blab", legend);
  const val = mk("b", "bval", "");
  b.append(fill, lab, val);
  // f is a FRACTION: 0..1 unipolar, −1..1 bipolar
  const setF = f => {
    const x = Math.max(bipolar ? -1 : 0, Math.min(1, f || 0));
    fill.style.setProperty("--a", String(bipolar ? Math.min(0.5, 0.5 + x / 2) : 0));
    fill.style.setProperty("--b", String(bipolar ? Math.max(0.5, 0.5 + x / 2) : x));
    fill.style.setProperty("--f", String(x));
  };
  // a bright fill is a value you set; a dim one is the song answering
  const setLit = on2 => { b.classList.toggle("set", !!on2); };
  return { b, fill, lab, val, setF, setLit };
}

/* ---------- a CONTINUOUS bar: dB, over a range ---------- */
// The EQ bands and (through buildLevelBar) the channel level. Arrows step 1
// unit, PageUp/Down 3, Home clears to the DERIVED answer (absent, the one
// spelling — the song's own tone shows again), drag moves at 0.15 units/px
// with the live param eased under the hand, a tap opens the pop-up fader,
// dblclick clears.
//
// data-part/data-bus/data-band/data-value are the gates' hooks; data-derived
// carries the song's derived dB when no user value overrides it. `derived()`
// is the dim half of the dim-vs-lit law: the bar fills to the derived value
// unlit, and only a user value brightens it.
function buildEqBar({ band, legend, label, part, bus, get, drag, write, derived }) {
  const { b, val, setF, setLit } = makeBar({
    cls: "eqk", fillCls: "eqface", fam: "eq", legend, label, bipolar: true,
    aria: { "aria-valuemin": String(-EQ_RANGE), "aria-valuemax": String(EQ_RANGE) },
  });
  b.dataset.band = band;
  if (part != null) b.dataset.part = part;
  if (bus != null) b.dataset.bus = bus;
  const show = (db, set) => {
    setF(db / EQ_RANGE);
    val.textContent = fmtEq(db);
    setLit(set);
  };
  // the value the bar SHOWS: the user's (lit) or the song's derived (dim)
  const shown = () => {
    const v = get();
    if (v != null) return v;
    const dv = derived ? derived() : null;
    return dv == null ? 0 : dv;
  };
  const paint = () => {
    if (d) return;                         // the finger owns the fill mid-drag
    const v = get();
    const dv = v == null && derived ? derived() : null;
    show(v != null ? v : (dv || 0), v != null);
    b.dataset.value = v == null ? "" : String(v);
    b.dataset.derived = dv == null ? "" : String(dv);
    b.setAttribute("aria-valuenow", String(v != null ? v : (dv || 0)));
    b.setAttribute("aria-valuetext", v != null ? fmtEq(v) + " dB"
      : (dv ? "derived " + fmtEq(dv) + " dB" : "flat"));
  };
  // zero IS flat, so a write that lands on 0 stores absent — the bar has no
  // second spelling of the default to offer
  const commitDb = x => { write(x != null && eqDb(x) ? eqDb(x) : null); buzz(4); };
  b.addEventListener("keydown", ev => {
    const v = shown();                     // a step rides off the derived value
    if (ev.key === "ArrowUp" || ev.key === "ArrowRight") commitDb(v + 1);
    else if (ev.key === "ArrowDown" || ev.key === "ArrowLeft") commitDb(v - 1);
    else if (ev.key === "PageUp") commitDb(v + 3);
    else if (ev.key === "PageDown") commitDb(v - 3);
    else if (ev.key === "Home") commitDb(null);
    else return;
    ev.preventDefault();
  });
  let d = null;
  b.addEventListener("pointerdown", ev => {
    if (ev.button) return;
    ev.preventDefault();
    b.focus({ preventScroll: true });
    try { b.setPointerCapture(ev.pointerId); } catch (e) {}
    touchOn();                             // pin the section under the finger
    b.classList.add("drag");               // the ease is for the song's moves
    const v = shown();                     // a drag departs the derived value
    d = { x0: ev.clientX, y0: ev.clientY, v0: v, cur: v, moved: false };
  });
  b.addEventListener("pointermove", ev => {
    if (!d) return;
    const n = axis(ev, d);
    if (!d.moved && Math.abs(n) < 3) return;
    d.moved = true;
    d.cur = eqDb(d.v0 + n * 0.15);
    drag(d.cur);
    show(d.cur, true);
  });
  b.addEventListener("pointerup", () => {
    if (!d) return;
    const moved = d.moved, cur = d.cur;
    if (moved) commitDb(cur);
    else openFader({ anchor: b, label, min: -EQ_RANGE, max: EQ_RANGE,
                     get: () => Math.round(shown() || 0),
                     set: x => commitDb(x),
                     fmt: x => (x ? fmtEq(x) + " dB" : "flat") });
    d = null;                              // …then release the pin (write first)
    b.classList.remove("drag");
    touchOff();
    paint();
  });
  b.addEventListener("pointercancel", () => {
    d = null; b.classList.remove("drag"); touchOff(); paint();
  });
  b.addEventListener("dblclick", () => commitDb(null));
  paint();
  return { el: b, paint };
}

/* ---------- a DETENTED bar: one of a registry's words ---------- */
// The absorbed rack: the bus returns (#b-<bus>-<key>) and the master's seven
// stages (#m-<key>). The empty detent sits at the left end and IS the default
// ("as built", absent — the one spelling of off), so an untouched bus reads as
// an empty track and a set one fills. Home is that empty detent, arrows step,
// data-value mirrors the current key so a gate can drive it blind — the knob's
// whole keyboard contract, kept across the shape change.
function buildDetentBar({ id, fam, label, keys, labels, get, set, status }) {
  const det = ["", ...keys];
  const { b, val, setF, setLit } = makeBar({
    cls: "detbar", fam, legend: label, label,
    aria: { "aria-valuemin": "0", "aria-valuemax": String(det.length - 1) },
  });
  if (id) b.id = id;
  b.dataset.detents = JSON.stringify(det);
  const idx = () => Math.max(0, det.indexOf(get() || ""));
  const paint = () => {
    const i = idx(), n = det.length - 1, k = det[i];
    setF(n ? i / n : 0);
    val.textContent = k ? labels[k] : "—";
    b.dataset.value = k;
    setLit(!!k);
    b.setAttribute("aria-valuenow", String(i));
    b.setAttribute("aria-valuetext", k ? labels[k] : "as built");
  };
  const setIdx = i => {
    const c = Math.max(0, Math.min(det.length - 1, i));
    if (c === idx()) return;
    set(det[c] || null);
    buzz(4);
    paint();
    // the chyron says what landed, the way the old session-bank selects did
    if (status) emit("status", { text: label + ": " + (det[c] ? labels[det[c]] : "off") });
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
    d = { x0: ev.clientX, y0: ev.clientY, i0: idx(), moved: false };
  });
  b.addEventListener("pointermove", ev => {
    if (!d) return;
    const di = Math.round(axis(ev, d) / 26);   // one detent per 26px of travel
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
  b.addEventListener("dblclick", () => setIdx(0));
  paint();
  return { el: b, paint };
}

/* ---------- the LEVEL bar: the automated one ---------- */
// The fill is the gain ACTUALLY driving the channel and keeps moving while the
// transport runs; the number is YOUR offset over it. `write(off|null)`
// commits; `drag(off)` is the live-ease path. The unity tick is a real
// boundary — 0 dB — so it is a hairline and nothing else.
function buildLevelBar({ label, getOffset, getGain, write, drag }) {
  const wrap = mk("div", "fwell");
  wrap.setAttribute("role", "cell");
  const { b, val, setF } = makeBar({
    cls: "fslot", fillCls: "fcap", fam: "level", legend: "fader",
    label: label + " level (your offset over the automation)",
    aria: { "aria-valuemin": "-24", "aria-valuemax": "12" },
  });
  b.tabIndex = 0;
  const zero = mk("i", "fzero");                 // the 0 dB boundary, a hairline
  zero.style.setProperty("--f", String(gainToF(1)));
  b.insertBefore(zero, b.querySelector(".blab"));
  val.classList.add("foff");
  wrap.append(b);
  const R = { wrap, slot: b, off: val,
    paint() {
      // the fill follows the live gain even under a finger (easeLive is moving
      // the real param — the fill IS the feedback); the offset readout is the
      // drag's own while one is down, or the two writers fight per frame
      setF(gainToF(getGain()));
      if (d) return;
      const o = getOffset();
      val.textContent = fmtDb(o == null ? 0 : o);
      val.classList.toggle("dflt", o == null);
      b.classList.toggle("set", o != null);
      b.setAttribute("aria-valuenow", String(o == null ? 0 : o));
      b.setAttribute("aria-valuetext", fmtDb(o == null ? 0 : o) + " dB");
    } };
  let d = null;
  b.addEventListener("pointerdown", ev => {
    if (ev.button) return;
    ev.preventDefault();
    b.focus({ preventScroll: true });
    try { b.setPointerCapture(ev.pointerId); } catch (e) {}
    touchOn();                             // pin the section under the finger
    const o = getOffset();
    d = { x0: ev.clientX, y0: ev.clientY, o0: o == null ? 0 : o,
          cur: o == null ? 0 : o, moved: false };
  });
  b.addEventListener("pointermove", ev => {
    if (!d) return;
    const n = axis(ev, d);
    if (!d.moved && Math.abs(n) < 3) return;
    d.moved = true;
    // 0.15 dB per px: the ±24/12 range inside ~one track of travel, fine
    // enough that a flick is a trim and a sweep is a move
    d.cur = faderDb(d.o0 + n * 0.15);
    drag(d.cur);
    val.textContent = fmtDb(d.cur);
    val.classList.remove("dflt");
  });
  const finish = () => {
    if (!d) return;
    const moved = d.moved, cur = d.cur;
    if (moved) write(cur === 0 ? null : cur);      // write lands on the pin
    else openFader({ anchor: b, label: label + " level", min: -24, max: 12,
                     get: () => Math.round(getOffset() || 0),
                     set: x => write(x === 0 ? null : faderDb(x)),
                     fmt: x => fmtDb(x) + " dB" });
    d = null;
    touchOff();
  };
  b.addEventListener("pointerup", finish);
  b.addEventListener("pointercancel", () => { if (d) { d = null; touchOff(); } });
  b.addEventListener("dblclick", () => { write(null); buzz(4); });
  b.addEventListener("keydown", ev => {
    const o = getOffset() == null ? 0 : getOffset();
    const step = (n) => { write(faderDb(o + n) || null); ev.preventDefault(); };
    if (ev.key === "ArrowUp" || ev.key === "ArrowRight") step(0.5);
    else if (ev.key === "ArrowDown" || ev.key === "ArrowLeft") step(-0.5);
    else if (ev.key === "PageUp") step(3);
    else if (ev.key === "PageDown") step(-3);
    else if (ev.key === "Home") { write(null); ev.preventDefault(); }
  });
  return R;
}

/* ==================== THE BOARD ==================== */
// BUILT ONCE PER TRACK LIST, then only its values change — the palette's law.
// Two wells inside #mixtbl: the channel strips (rebuilt when the roster
// changes) and the bus strips (built once — the shared returns are the
// page's).
let sig = "", rows = [], refs = [];
const chanWell = mk("div", "strips chans");
const busWell = mk("div", "strips buses");
el.append(chanWell, busWell);

// THE HEAD: a strip says who it is at the TOP, in the page's largest strip
// type ("Label the channels at the top", 2026-08-16). On a pool chair the
// instrument line is a CONTROL: tapping it unfolds the same twelve-family
// picker the SONG page's pool bank carries, for THIS chair — same chips, same
// commit("pool") path, two views over one store. The drums chair stays passive
// on purpose: the kit is a kit, chosen by the RHYTHM cell, not an instrument
// id (fields.js POOLCHAIRS' law).
function buildHead(row, i) {
  const head = mk("div", "mlabel");
  head.setAttribute("role", "cell");
  const top = mk("div", "mtop");
  const num = mk("b", "mnum", row.sect ? "" : String(i + 1));
  const pn = mk("b", "mpn", row.label);
  top.append(pn, num);
  const pool = !row.sect && POOLCHAIRS.includes(row.key);
  const ps = mk(pool ? "button" : "i", "mps" + (pool ? " minstr" : ""), row.sound);
  if (pool) {
    ps.type = "button";
    ps.dataset.chair = row.key;
    ps.addEventListener("click", ev => {
      ev.stopPropagation(); openPop(ps, row, POOLFIELD);
    });
  } else if (row.key === "drums") {
    ps.title = "the kit — chosen by the RHYTHM cell, not the instrument pool";
  }
  const feed = mk("i", "mfeed", row.sect ? "→ master bus" : "→ section");
  head.append(top, ps, feed);
  return { head, num, pn, ps };
}

function build() {
  chanWell.textContent = "";
  refs = rows.map((row, i) => {
    const tr = mk("div", "strip mrow" + (row.sect ? " msec" : ""));
    tr.setAttribute("role", "row");
    const H = buildHead(row, i);
    tr.append(H.head);
    // ---- the LEVEL bar, straight under the name: the one control you reach
    // for first, and the only one on a channel strip that MOVES by itself ----
    const level = buildLevelBar({
      label: row.label,
      getOffset: () => offsetOf(boardSec(), row.key),
      getGain: () => liveGain(boardSec(), row.key),
      write: off => writeField(boardSec(), row.key, "fader", off),
      drag: off => easeLive(boardSec(), row.key, off),
    });
    tr.append(level.wrap);
    // ---- the value keys, in the colour order (KEYORD): level word, place,
    // sends, inserts. Each is a detented bar over its registry's table whose
    // TAP still opens that key's chip set — the discrete vocabulary stays one
    // tap away, and the gates click .mval[data-field] exactly as before ----
    const vals = mk("div", "mvals");
    vals.setAttribute("role", "cell");
    const cells = {};
    for (const f of colsOf(row)) {
      const { b, val, setF, setLit } = makeBar({
        cls: "mval", fam: FAM[f.key] || "level", legend: KEYLEG[f.key] || f.key,
        label: row.label + " " + f.key, bipolar: !!BIPOLAR[f.key],
      });
      b.dataset.part = row.key == null ? "" : row.key;
      b.dataset.field = f.key;
      // a click opens the chips; a drag steps the table under the finger and
      // swallows the click that follows it (one gesture, one outcome)
      let d = null, ate = false;
      // where a word sits in its registry's own order — the fill's length.
      // An unknown word (or the fx chain, which has no scalar) reads as the
      // first detent rather than as −1: a bar never fills backwards.
      const rank = v => {
        const ks = Object.keys(f.table);
        return { i: Math.max(0, ks.indexOf(v)), n: ks.length - 1, ks };
      };
      b.addEventListener("click", ev => {
        ev.stopPropagation();
        if (ate) { ate = false; return; }
        openPop(b, row, f);
      });
      if (f.key !== "fx") {                // a chain has no scalar to drag
        b.addEventListener("pointerdown", ev => {
          if (ev.button) return;
          try { b.setPointerCapture(ev.pointerId); } catch (e) {}
          touchOn();
          const shown = readField(boardSec(), row.key, f.key) ||
            (defaultOf(boardSec(), row.key, f.key) || {}).v;
          d = { x0: ev.clientX, y0: ev.clientY, i0: rank(shown).i, moved: false };
        });
        b.addEventListener("pointermove", ev => {
          if (!d) return;
          const n = axis(ev, d);
          if (!d.moved && Math.abs(n) < 6) return;
          d.moved = true; ate = true;
          const { ks } = rank("");
          const want = ks[Math.max(0, Math.min(ks.length - 1,
            d.i0 + Math.round(n / 26)))];
          if (want && want !== readField(boardSec(), row.key, f.key))
            writeField(boardSec(), row.key, f.key, want);
        });
        const done = () => { if (d) { d = null; touchOff(); } };
        b.addEventListener("pointerup", done);
        b.addEventListener("pointercancel", done);
        b.addEventListener("keydown", ev => {
          const ks = Object.keys(f.table);
          const cur = readField(boardSec(), row.key, f.key) ||
            (defaultOf(boardSec(), row.key, f.key) || {}).v;
          const at = ks.indexOf(cur);
          const go = n => {
            const j = Math.max(0, Math.min(ks.length - 1, at + n));
            writeField(boardSec(), row.key, f.key, ks[j]);
            buzz(4); ev.preventDefault();
          };
          if (ev.key === "ArrowRight" || ev.key === "ArrowUp") go(1);
          else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") go(-1);
          else if (ev.key === "Home") {
            writeField(boardSec(), row.key, f.key, null); ev.preventDefault();
          }
        });
      }
      vals.append(b);
      cells[f.key] = { b, val, setF, setLit, rank };
    }
    tr.append(vals);
    // ---- the TONE block: three bipolar bars, always present and flat (dim)
    // by default — a strip that could hide its EQ would be a strip you have
    // to open to trust ----
    const eqrow = mk("div", "eqrow");
    eqrow.setAttribute("role", "cell");
    const eqs = [...EQ_BANDS].reverse().map(bd => buildEqBar({
      band: bd.key, legend: bd.label, part: row.key == null ? "" : row.key,
      label: row.label + " " + bd.label + " EQ",
      get: () => eqBand(boardSec(), row.key, bd.key),
      // the song's own tone, dim under the finger's: genre character on the
      // section strip, family/arc seating on the parts (audio/mixer.js — the
      // same derivation the built biquads bake, so the fill IS the graph)
      derived: () => {
        const e = row.sect ? derivedSecEq(boardSec())
                           : derivedPartTone(boardSec(), row.key).eq;
        return e && e[bd.key] ? e[bd.key] : null;
      },
      drag: db => easeEqLive(boardSec(), row.key, bd.key, db),
      write: db => writeEqBand(boardSec(), row.key, bd.key, db),
    }));
    for (const e of eqs) eqrow.append(e.el);
    tr.append(eqrow);
    // ---- CUT and SOLO: the two that LATCH rather than take a value, so they
    // are the one pair on the page that is not a bar ----
    const ms = mk("div", "mms");
    ms.setAttribute("role", "cell");
    const keys = {};
    for (const k of ["mute", "solo"]) {
      if (row.sect) { keys[k] = null; continue; }
      const b = mk("button", "mkey mk-" + k, k === "mute" ? "cut" : "solo");
      b.type = "button";
      b.addEventListener("click", ev => {
        ev.stopPropagation();
        writeField(boardSec(), row.key, k, !readField(boardSec(), row.key, k));
        buzz(4);
      });
      ms.append(b);
      keys[k] = b;
    }
    tr.append(ms);
    chanWell.append(tr);
    return { tr, num: H.num, pn: H.pn, ps: H.ps, cells, keys, fader: level, eqs };
  });
}

function patch() {
  const sec = boardSec();
  const P = sec.parts || null;
  const solo = !!P && rows.some(r => r.key && P[r.key] && P[r.key].solo);
  // which of the song's chairs THIS section sounds, and what plays them here:
  // the strip set never changes at a boundary (songRows), only these values do
  const here = new Map(rowsOf(sec).filter(r => !r.sect).map(r => [r.key, r]));
  rows.forEach((row, i) => {
    const R = refs[i];
    const ent = entryOf(sec, row.key);
    const cur = row.sect ? null : here.get(row.key);
    const idle = !row.sect && !cur;
    const sound = row.sect ? row.sound : (cur ? cur.sound : row.sound);
    if (R.ps.textContent !== sound) R.ps.textContent = sound;
    // a CAST chair lights its label (the pool's pick), a genre default reads
    // dim — the one state language, on the strip's own nameplate
    if (!row.sect && POOLCHAIRS.includes(row.key)) {
      const cast = !!(POOL && POOL[row.key]);
      R.ps.classList.toggle("set", cast);
      R.ps.setAttribute("aria-label", row.label + " instrument: " + sound +
        (cast ? " — cast from the pool" : " — the genre's own") +
        " — opens the instrument picker");
    }
    const muted = !row.sect && !!ent && !!ent.mute;
    const off = !row.sect && (muted || (solo && !(ent && ent.solo)));
    R.tr.className = "strip mrow" + (row.sect ? " msec" : "") + (off ? " off" : "") +
      (idle ? " idle" : "");
    R.tr.setAttribute("aria-label", row.label + " · " + sound +
      (off ? " · silent" : "") + (idle ? " · idle this section" : ""));
    for (const f of colsOf(row)) {
      const C = R.cells[f.key], v = readField(sec, row.key, f.key);
      const d = defaultOf(sec, row.key, f.key);
      if (f.key === "fx") {
        C.val.textContent = "";
        if (v.length) for (const k of v) C.val.append(mk("i", "mfxc", FX[k].label));
        else C.val.append(mk("i", "mfxc none", "—"));
        C.setF(v.length / MAX_FX);
        C.setLit(!!v.length);
        C.b.classList.toggle("dflt", !v.length);
        C.b.title = v.length ? v.map(k => FX[k].label).join(" → ")
                             : "no effects on this " + (row.sect ? "section" : "part");
      } else {
        const shown = v != null ? v : (d && d.v);
        C.val.textContent = shown ? shortOf(f.key, shown) : "—";
        const { i: at, n } = C.rank(shown);
        C.b.setAttribute("aria-valuenow", String(at));
        C.b.setAttribute("aria-valuemin", "0");
        C.b.setAttribute("aria-valuemax", String(n));
        // pan runs out of the centre; everything else fills from the left
        C.setF(BIPOLAR[f.key] ? (n ? (at / n) * 2 - 1 : 0) : (n ? at / n : 0));
        C.setLit(v != null);
        C.b.classList.toggle("dflt", v == null);
        C.b.title = (v != null ? longOf(f.key, v)
                               : (shown ? longOf(f.key, shown) : "—") +
                                 (d && d.note ? " · " + d.note : " · default")) + "";
      }
      C.b.setAttribute("aria-label", row.label + " " + f.key + ": " + C.b.title);
      C.b.setAttribute("aria-valuetext", C.b.title);
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
    for (const e of R.eqs) e.paint();
  });
  patchPop();
}

export function drawMix() {
  const next = songRows();
  // the signature is the CHAIR LIST — not the sounds, which change per section
  // and are patched onto the stable strips. A boundary crossing therefore
  // never rebuilds the board; only a song/stack edit that changes the union
  // does. That is the fixed-desk law: strips never appear or disappear while
  // the song plays.
  const s = next.map(r => r.key + ":" + r.label).join("|");
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

// THE POOL PSEUDO-FIELD: the strip's instrument label opens the picker
// through the same one popover — the pool bank's chips and commit("pool")
// path, the mixer's .mchip material (never .pchip: the gates click .pchip by
// exact text, and a twin would make those locators a coin toss).
const POOLFIELD = { key: "pool" };
const chipList = f => (f.key === "fx"
  ? Object.keys(FX).map(k => [k, FX[k].label])
  : Object.keys(f.table).map(k => [k, f.labels[k]]));
function buildPop() {
  popChips.textContent = "";
  if (popField.key === "pool") {
    // the pool bank's shape: the un-cast chip first, then the twelve families
    const chip = (v, label) => {
      const b = mk("button", "mchip", label);
      b.type = "button";
      b.dataset.value = v;
      b.addEventListener("click", () => hit(v));
      popChips.append(b);
    };
    popChips.append(mk("span", "mgrp", "the genre's own"));
    chip("", "genre default");
    for (const [fam, ids] of INSTRFAMS) {
      popChips.append(mk("span", "mgrp", "instrument · " + fam));
      for (const id of ids) chip(id, INSTRCHOICES[id]);
    }
    return;
  }
  for (const [v, label] of chipList(popField)) {
    const b = mk("button", "mchip", label);
    b.type = "button";
    b.dataset.value = v;
    b.addEventListener("click", () => hit(v));
    popChips.append(b);
  }
}
function hit(v) {
  const sec = boardSec();
  if (popField.key === "pool") {
    // ONE song fact, the pool bank's exact path — the roster re-resolves, the
    // strip relabels, every VOICE cell renames. Patch, never close (the pool
    // bank's one-visit law): casting a band is several decisions.
    setPoolChair(popRow.key, v || null);
    commit("pool");
    buzz(4);
    return;
  }
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
  const sec = boardSec();
  if (popField.key === "pool") {
    // the pick lit bright; uncast, the "genre default" chip answers dim
    const pick = POOL && POOL[popRow.key];
    for (const b of popChips.children) {
      if (!b.classList.contains("mchip")) continue;
      const on2 = pick ? b.dataset.value === pick : b.dataset.value === "";
      b.classList.toggle("on", on2);
      b.classList.toggle("dflt", on2 && !pick);
      b.setAttribute("aria-pressed", String(on2));
    }
    return;
  }
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
  popTitle.textContent = row.label + " · " +
    (f.key === "fx" ? "effects" : f.key === "pool" ? "instrument" : f.key) +
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
// "Make the effects busses into special channel strips" (2026-08-16): reverb,
// echo and drum room are strips in the SAME grammar as a voice's — a head
// with the name at the top, then bars — distinguished by their own hue and a
// `return` tag rather than by a different widget. The rack row each bus used
// to own below the board is now those bars: `ret` (and echo's `fb`/`tone`)
// with their #b-<bus>-<key> ids intact, driving the song's `buses` trims
// (fields.js BUS_FIELDS). One control per fact; the duplicate detented fader
// that used to sit beside the rack knob is gone.
const busWrite = (bus, key, val) => {
  const next = JSON.parse(JSON.stringify(BUSES || {}));
  const e = next[bus] || (next[bus] = {});
  if (val) e[key] = val; else delete e[key];
  if (!Object.keys(e).length) delete next[bus];
  setBuses(next);
  initAudio();                             // a bar move is a user gesture
  commit("buses");
};
const busVal = (bus, key) => (BUSES && BUSES[bus] && BUSES[bus][key]) || "";
// the return's EQ pair rides the same song map (`buses.<bus>.eq`, fields.js
// BUS_EQ_BANDS). Unlike a channel band this needs no separate ease path: a
// bus EQ change is param writes on the shared rack (graph.applyBuses), so the
// drag writes straight through — the dedup below keeps the move-storm quiet.
const busEqBand = (bus, band) => {
  const e = BUSES && BUSES[bus] && BUSES[bus].eq;
  return e && e[band] != null ? e[band] : null;
};
const busEqWrite = (bus, band, db) => {
  const v = db == null ? 0 : eqDb(db);
  if ((busEqBand(bus, band) || 0) === v) return;
  const next = JSON.parse(JSON.stringify(BUSES || {}));
  const e = next[bus] || (next[bus] = {});
  const eq = { ...(e.eq || {}) };
  if (v) eq[band] = v; else delete eq[band];
  if (Object.keys(eq).length) e.eq = eq; else delete e.eq;
  if (!Object.keys(e).length) delete next[bus];
  setBuses(next);
  initAudio();                             // a bar move is a user gesture
  commit("buses");
};

const busRefs = [];                        // { paint() } for everything below
const detBars = [];                        // the absorbed rack: bus + master bars
function buildBusStrip(row) {
  const tr = mk("div", "strip bstrip");
  tr.setAttribute("role", "row");
  const head = mk("div", "mlabel");
  head.setAttribute("role", "cell");
  const top = mk("div", "mtop");
  top.append(mk("b", "mpn", row.label), mk("i", "btag", "return"));
  const ps = mk("i", "mps", row.feed);
  const state = mk("i", "mfeed", "");
  head.append(top, ps, state);
  tr.append(head);
  // the bus's own rack row, absorbed: return level first, then whatever else
  // this return has to say about itself (echo's repeats and tone)
  const vals = mk("div", "mvals");
  vals.setAttribute("role", "cell");
  const knobs = row.knobs.map(kn => {
    const B = buildDetentBar({
      id: "b-" + row.bus + "-" + kn.key, fam: "bus", label: kn.label,
      keys: Object.keys(kn.table), labels: kn.labels,
      get: () => busVal(row.bus, kn.key),
      set: v => busWrite(row.bus, kn.key, v),
      status: true,
    });
    vals.append(B.el);
    return B;
  });
  tr.append(vals);
  // the return's tone pair — HI over LO, the simpler strip a bus earns
  const eqrow = mk("div", "eqrow");
  eqrow.setAttribute("role", "cell");
  const eqs = [...(row.eq || [])].reverse().map(bd => buildEqBar({
    band: bd.key, legend: bd.label, bus: row.bus,
    label: row.label + " return " + bd.label + " EQ",
    get: () => busEqBand(row.bus, bd.key),
    drag: db => busEqWrite(row.bus, bd.key, db),
    write: db => busEqWrite(row.bus, bd.key, db),
  }));
  for (const e of eqs) eqrow.append(e.el);
  tr.append(eqrow);
  busWell.append(tr);
  for (const k of knobs) detBars.push(k.paint);
  busRefs.push({ paint() {
    for (const k of knobs) k.paint();
    for (const e of eqs) e.paint();
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

// a slim page-lifetime strip per BUILT character send bus: its bar is the
// bus's own `ret` gain, a trim on the page rather than on the song (which is
// why it commits nothing and appears only once the bus exists)
const sendStrips = new Map();              // fx key -> strip element
function ensureSendStrips() {
  const list = SENDBUS ? Object.keys(SENDBUS).filter(k => SENDBUS[k]) : [];
  for (const k of list) {
    if (sendStrips.has(k)) continue;
    const bus = SENDBUS[k];
    const name = (FX[k] && FX[k].label) || k;
    const tr = mk("div", "strip bstrip send");
    tr.setAttribute("role", "row");
    const head = mk("div", "mlabel");
    head.setAttribute("role", "cell");
    const top = mk("div", "mtop");
    top.append(mk("b", "mpn", name), mk("i", "btag", "send"));
    head.append(top, mk("i", "mps", "this session only"));
    tr.append(head);
    const vals = mk("div", "mvals");
    const { b, val, setF, setLit } = makeBar({
      cls: "mval", fam: "bus", legend: "return", label: name + " bus return",
      aria: { "aria-valuemin": "0", "aria-valuemax": "1.6" },
    });
      vals.append(b);
    tr.append(vals);
    const paint = () => {
      const v = bus.ret.gain.value;
      setF(Math.max(0, Math.min(1, v / 1.6)));
      setLit(Math.abs(v - 1) > 0.001);
      val.textContent = v.toFixed(2);
      b.setAttribute("aria-valuenow", v.toFixed(2));
    };
    let d = null;
    b.addEventListener("pointerdown", ev => {
      if (ev.button) return;
      ev.preventDefault();
      try { b.setPointerCapture(ev.pointerId); } catch (e) {}
      d = { x0: ev.clientX, y0: ev.clientY, v0: bus.ret.gain.value };
    });
    b.addEventListener("pointermove", ev => {
      if (!d) return;
      const v = Math.max(0, Math.min(1.6, d.v0 + axis(ev, d) * 0.01));
      try { bus.ret.gain.value = v; } catch (e) {}
      paint();
    });
    b.addEventListener("pointerup", () => { d = null; });
    b.addEventListener("pointercancel", () => { d = null; });
    busWell.insertBefore(tr, masterStrip);
    sendStrips.set(k, tr);
    busRefs.push({ paint });
  }
}

/* ---------- the MASTER strip ---------- */
// THE ONE EXCEPTION Paul named: the master LEVEL keeps its vertical slider,
// flat — a track, a fill, a 2px cap — beside the meter, because it is the
// control you reach for while listening rather than while reading. The fader
// here IS the transport's volume fader (ui/state.js VOLSTORE), two views over
// one store, deliberately NOT in the song; the meter reads graph.rmsNow() per
// frame (the sum, pre-volume).
//
// Everything ELSE the master owns is bars: the seven MASTER_FIELDS stages,
// absorbed off the old rack with their #m-<key> ids and their whole keyboard
// contract intact. The strip runs full width because seven bars want the room
// and because the sum is not one voice among the others.
let masterStrip = null;
{
  const tr = mk("div", "strip bstrip mstr");
  tr.setAttribute("role", "row");
  const head = mk("div", "mlabel");
  head.setAttribute("role", "cell");
  const top = mk("div", "mtop");
  // (no (?) key here: the four help buttons on the app are gone with their
  // paragraphs — "get rid of headers and help buttons", 2026-08-16)
  top.append(mk("b", "mpn", "master"), mk("i", "btag", "the sum"));
  const stages = mk("i", "mfeed mstages", "");
  head.append(top, mk("i", "mps", "device volume · every strip lands here"), stages);
  tr.append(head);
  const body = mk("div", "mbody");
  // the meter and the one vertical slider left on the page
  const lvlwrap = mk("div", "mlevel");
  // the one control on the page with no room to print its own name inside
  // itself, so it says it above — the bars' contract, kept honest
  const vlab = mk("i", "vlab", "volume");
  const meter = mk("div", "meter");
  const mfill = mk("i", "mfill");
  meter.append(mfill);
  const slot = mk("div", "fslot vslot");
  slot.tabIndex = 0;
  slot.setAttribute("role", "slider");
  slot.setAttribute("aria-label", "master volume");
  slot.setAttribute("aria-valuemin", "0");
  slot.setAttribute("aria-valuemax", "100");
  const cap = mk("i", "fcap");
  const vout = mk("output", "foff", String(vol));
  slot.append(cap);
  lvlwrap.append(vlab, meter, slot, vout);
  // the seven stages, as bars
  const grid = mk("div", "mgrid");
  const stageBars = MASTER_FIELDS.map(f => buildDetentBar({
    id: "m-" + f.key, fam: "master", label: f.label,
    keys: Object.keys(f.table), labels: f.labels,
    get: () => (MASTER && MASTER[f.key]) || "",
    set: v => {
      const next = { ...(MASTER || {}) };
      if (v) next[f.key] = v; else delete next[f.key];
      setMaster(next);
      initAudio();                         // a bar move is a user gesture
      commit("master");
    },
    status: true,
  }));
  for (const s of stageBars) { grid.append(s.el); detBars.push(s.paint); }
  body.append(lvlwrap, grid);
  tr.append(body);
  busWell.append(tr);
  masterStrip = tr;
  const paint = () => {
    cap.style.setProperty("--f", String(vol / 100));
    vout.textContent = String(vol);
    slot.setAttribute("aria-valuenow", String(vol));
    const rep = masterReport();
    const t = rep && rep.stages.length ? rep.stages.join(" · ") : "default chain";
    if (stages.textContent !== t) stages.textContent = t;
    // −60..0 dBFS onto the meter — the same log window every meter uses.
    // Parked at zero when the transport is stopped: notes scheduled ahead of a
    // stop keep ringing into the (pre-mute) analyser tap, and a meter that
    // twitches on a stopped desk reads as broken.
    const r = transportOn ? rmsNow() : 0;
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
// send strips could insert before it); put the master back at the end
busWell.append(masterStrip);

/* ---------- what is left below the board ---------- */
// NOTHING. The RACK's rows became the bus and master strips above, and the
// master's hint paragraph — the last (?) on the machine — is deleted with
// the other three ("get rid of headers and help buttons", 2026-08-16): every
// stage it described is a labelled bar on the master strip, reading its own
// value. #rack keeps its id and stays empty, so no page, gate or stylesheet
// has to learn a new address.
const paintKnobs = () => { for (const p of detBars) p(); };

/* ---------- the frame paint ---------- */
// Called from main.js's one rAF loop while the transport runs (the one-loop
// rule), and from the event subscriptions below when it does not — so the
// fills follow the automation live and settle to the resolved statics at rest.
export function paintBoard() {
  const sec = boardSec();
  for (let i = 0; i < rows.length; i++) refs[i] && refs[i].fader.paint(sec);
  ensureSendStrips();
  for (const r of busRefs) r.paint();
}

/* ---------- subscriptions ---------- */
on("page", () => closePop());
on("song", () => { closePop(); sig = ""; drawMix(); paintKnobs(); paintBoard(); });
on("box", () => { drawMix(); paintBoard(); });
on("pool", () => { drawMix(); paintBoard(); });   // a recast chair relabels the strips
on("selection", () => { drawMix(); paintBoard(); });
on("refresh", () => { drawMix(); paintBoard(); });
on("master", () => { paintKnobs(); paintBoard(); });
on("buses", () => { paintKnobs(); paintBoard(); });
on("transport", () => paintBoard());       // the master strip mirrors the vol fader
// THE DESK PLAYS ALONG: the sounding box moved, so the strips re-target — the
// roster rebuilds if the parts changed, the value keys / EQ bars re-read the
// new section, and the fills land on the new channel's gains. Deliberately
// NOT closePop(): an open popover pins the section (boardSec), because the
// user mid-edit wins over the transport.
on("transport:section", () => { drawMix(); paintBoard(); });
// play/stop flipped: back to the selected box at rest, and one last paint so
// the meter parks at zero and the fills settle on the resolved statics
on("transport:state", () => { drawMix(); paintBoard(); });
