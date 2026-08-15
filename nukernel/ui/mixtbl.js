// ui/mixtbl.js — THE MIX TABLE: one row per SOUND the selected box makes.
//
// Stage 1 gave a box a desk (fields.js PARTMIX, audio/mixer.js partSpecs/
// buildChannel): every chair — lead, riff, pad, bass, drums — can carry its
// own inserts, its own two sends, its own level, place, mute and solo. It had
// no surface. The only way to reach it was to type into `sec.parts` from a
// gate, which is a capability nobody has.
//
// The surface is a TABLE, because this machine already is one: the pattern,
// the song, the arrangement and every palette bank are one component (the
// .tbl block in kernel-daw.css), and a mixer is the most table-shaped object
// in music — rows are channels, columns are the strip, and the whole point is
// that you read DOWN a column to compare and ACROSS a row to understand one
// sound. A rack of vertical faders would have been a fifth idiom for the one
// screen that least needs one.
//
//   #  PART   SOUND          FX          REV    ECHO  LVL   PAN  M S
//   1  lead   clean guitar   chorus      touch   —    norm   C   · ·
//   2  pad    synth strings   —          wet     —    hush   L   · ·
//   3  bass   acoustic bass   —          —       —    fwd    C   · ·
//   4  drums  power           crunch     touch   —    norm   C   · ·
//   ─────────────────────────────────────────────────────────────────
//      section  whole box     tape echo  some    —    norm   C
//
// THE SECTION ROW IS LAST, AND THAT IS THE SIGNAL FLOW. Every part bus feeds
// the section strip (mixer.buildChannel: part inserts → pan → level → gate →
// the section's input), so the row underneath the rule is downstream of the
// rows above it — the master strip at the end of the desk. It is also the
// answer to "which of these is per-sound and which is section-wide": one rule,
// one label, and the two columns a section cannot have (M and S) are left
// visibly empty rather than drawn dead.
//
// THE OLD FLAT CHIPS STILL WORK, because the section row writes the very same
// box fields the palette's EFFECTS tab writes — sec.fx / rev / echo / lvl /
// pan. There is no migration and no second spelling: a saved song from before
// the desk opens with its whole mix on the section row, and either surface
// repaints the other through commit("box").
//
// A CELL OPENS A POPOVER, NOT AN INLINE CHIP ROW. Both were tried on paper.
// An inline row is fewer moving parts, but a part with the effects chip set
// open is a row four lines tall, which at 390px pushes every other sound off
// the screen — and comparing sounds is the entire reason this is a table. The
// popover keeps every row one line high whatever is open, and it is the
// mechanism the song table already uses for exactly this (songrow.js's row
// sheet), so it is one behaviour to learn: tap a thing, its options appear
// beside it, tap away to dismiss.
//
// Layer graph: ui view — imports state/derive/deps, audio/mixer and
// audio/assets for READS ONLY (the roster the mixer builds its channel from,
// and which soundfont is loaded), and leaves every change through commit().
// (the value tables arrive through PARTMIX — every column carries its own
// `table` and `labels`, so this file names no enum of its own. SENDS is the
// one exception, read directly to say which bucket a genre's own wetness
// lands in on the section row.)
import { GENRES, FX, MAX_FX, SENDS, SENDLABEL, DRUMKITS, PARTMIX,
         partChairLabel, BASS_INSTR, BASSSYNTH } from "./deps.js";
import { curSection, commit, on } from "./state.js";
import { stackOf, kitOf, voiceOwners } from "./derive.js";
import { voiceRoster, partKeysOf } from "../audio/mixer.js";
import { isSynthFont, fontDef } from "../audio/assets.js";
import { hintKey } from "./editor.js";
import { buzz } from "./touch.js";

const el = document.getElementById("mixtbl");
// TABLE SEMANTICS, like the song table: the same fields on every row, one row
// per sound, a header naming the columns. The roles are static because the DOM
// is — a row is built once and patched for ever after.
el.setAttribute("role", "table");
el.setAttribute("aria-label", "the mix of the selected box");
hintKey("mixhelp", "mixhint");

// the width at which there is daylight beside a cell rather than only under
// the deck — the same 900px boundary the row sheet and the pop-up fader use.
// One definition of "there is room beside this", three users.
const WIDE = 900;

/* ---------- what the columns are ---------- */
// The five value columns are PARTMIX's own enum fields, in its own order, so
// adding a control to the desk registry adds a column here and nothing else.
// mute/solo are not in this list: they are keys, not choices between values,
// and they get the two narrow key columns at the end.
const COLS = PARTMIX.filter(f => f.type !== "flag");
// TERSE ON THE GLASS, THE WHOLE WORD IN THE EAR. A tracker cell is four
// characters wide; "left-ish" and "forward" are not. Every cell carries the
// full label from the registry as its title and its accessible name, so the
// abbreviation is silkscreen and never the only place the value is said.
const SHORT = {
  rev: SENDLABEL, echo: SENDLABEL,
  lvl: { hush: "hush", back: "back", norm: "norm", fwd: "fwd" },
  pan: { l: "L", hl: "L·", c: "C", hr: "·R", r: "R" },
};
const LONG = {};
for (const f of COLS) LONG[f.key] = f.labels;
const shortOf = (f, v) => (SHORT[f] && SHORT[f][v]) || v;
const longOf = (f, v) => (LONG[f] && LONG[f][v]) || v;

/* ---------- what the rows are ---------- */
const humanize = id => String(id || "").replace(/_/g, " ");
// WHAT A CHAIR ACTUALLY PLAYS. The roster carries the sampled instrument, but
// a genre with a signature `synth` never plays it (transport.js scheduleBar:
// the synth wins unless it is lineOnly and the voice is a pad), and a synth
// FONT overrides even that. A desk that labels a 303 "clean guitar" is lying
// about the thing you are about to fade, so this mirrors that same switch.
function soundOf(g, r) {
  const syn = isSynthFont() ? fontDef().synth : (g && g.synth);
  const useSyn = syn && !(syn.lineOnly && r.pad && !isSynthFont());
  return useSyn ? (syn.root || syn.dsp) : humanize(r.id);
}
// THE TRACK LIST, from the same two functions the audio tier builds the desk
// from — mixer.voiceRoster for the chairs and mixer.partKeysOf for the whole
// address list, in that order. This table cannot show a row the mixer will not
// build a bus for, and cannot miss one it will, because it is not a second
// opinion about what the box contains: it is the same answer, drawn.
// voiceOwners is joined BY INDEX (derive.js says why it may be).
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
  // the master strip, last: downstream of every row above it
  out.push({ key: null, label: "section", sound: "whole box", sect: true });
  return out;
}

/* ---------- reading and writing one cell ---------- */
// THE SECTION ROW IS THE BOX'S OWN FIELDS. This is the whole of requirement
// "do not orphan saved songs": there is no new storage for the section strip,
// because the box already had one and the palette already writes it.
const entryOf = (sec, key) => (key == null ? sec
  : ((sec.parts && sec.parts[key]) || null));
function readField(sec, key, f) {
  const e = entryOf(sec, key);
  if (!e) return f === "fx" ? [] : null;
  const v = e[f];
  return f === "fx" ? (v || []) : (v == null ? null : v);
}
// ONE WRITER, so a chip and a key cannot disagree about what "off" spells.
// Absent is the ONLY spelling of a default (song.js normalizes a save the same
// way): an entry with nothing set is deleted, and a map with no entries becomes
// null — which is also what makes the mixer's absent-is-today law hold, since
// partSpecs builds no bus for a box whose `parts` is null.
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
// WHAT THE DEFAULT RESOLVES TO, said in the cell's own vocabulary and dimmed.
// This is the machine's one state language (palette.js .dflt): a bright value
// is one you set, a dim one is the fallback answering. A part's default send is
// zero — the part asks for nothing ON TOP of the section — but the SECTION's
// reverb default is the genre's own tone.verb, which is a number rather than a
// chip, so it is shown as the bucket it lands nearest with the real figure in
// the title. Dimming the truth beats printing a dash over it.
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
  return null;
}

/* ---------- the table ---------- */
// BUILT ONCE PER TRACK LIST, then only its values change — the palette's law,
// for the palette's reason: rebuilding destroys the element under the pointer
// mid-click. The signature is the addresses and their sounds, so switching a
// genre (which changes the chairs) rebuilds and a mix move does not.
let sig = "", rows = [], refs = [];

const mk = (tag, cls, txt) => {
  const n = document.createElement(tag);
  n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};
const headRow = (() => {
  const r = mk("div", "mhead thd");
  r.setAttribute("role", "row");
  const names = { fx: "fx", rev: "rev", echo: "echo", lvl: "lvl", pan: "pan" };
  const add = (cls, txt) => {
    const c = mk("span", cls, txt);
    c.setAttribute("role", "columnheader");
    r.append(c);
  };
  // the part column holds BOTH lines — the address in silkscreen and what it
  // is playing under it — so it is one column and one header, not two
  add("mh mhnum", "#"); add("mh mhpart", "part");
  for (const f of COLS) add("mh mh-" + f.key, names[f.key] || f.key);
  add("mh mhkey", "m"); add("mh mhkey", "s");
  return r;
})();

function build() {
  el.textContent = "";
  el.append(headRow);
  refs = rows.map((row, i) => {
    const tr = mk("div", "mrow" + (row.sect ? " msec" : ""));
    tr.setAttribute("role", "row");
    const num = mk("b", "mnum tnum", row.sect ? "" : String(i + 1));
    num.setAttribute("role", "cell");
    const part = mk("span", "mpart");
    part.setAttribute("role", "cell");
    const pn = mk("b", "mpn", row.label), ps = mk("i", "mps", row.sound);
    part.append(pn, ps);
    tr.append(num, part);
    const cells = {};
    for (const f of COLS) {
      const wrap = mk("span", "mcell mc-" + f.key);
      wrap.setAttribute("role", "cell");
      const b = mk("button", "mval");
      b.type = "button";
      b.dataset.part = row.key == null ? "" : row.key;
      b.dataset.field = f.key;
      b.addEventListener("click", ev => { ev.stopPropagation(); openPop(b, row, f); });
      wrap.append(b); tr.append(wrap);
      cells[f.key] = b;
    }
    // THE TWO KEYS. Mute and solo are the only controls here that are not a
    // choice between values, so they are not cells that open anything: they
    // latch under the finger, which is what a mute button is everywhere else
    // in music. SOLO REACHES THE OTHER ROWS (mixer.partSpecs resolves it: any
    // solo in the box mutes every part that is not soloed), and the rows it
    // silences say so — see patch().
    const keys = {};
    for (const k of ["mute", "solo"]) {
      const wrap = mk("span", "mcell mc-" + k);
      wrap.setAttribute("role", "cell");
      if (row.sect) { tr.append(wrap); keys[k] = null; continue; }
      const b = mk("button", "mkey mk-" + k, k === "mute" ? "M" : "S");
      b.type = "button";
      b.addEventListener("click", ev => {
        ev.stopPropagation();
        writeField(curSection(), row.key, k, !readField(curSection(), row.key, k));
        buzz(4);
      });
      wrap.append(b); tr.append(wrap);
      keys[k] = b;
    }
    el.append(tr);
    return { tr, num, pn, ps, cells, keys };
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
    // the rows solo has silenced read as silenced — the whole reason solo is
    // resolved across the box rather than per row
    const off = !row.sect && (muted || (solo && !(ent && ent.solo)));
    R.tr.className = "mrow" + (row.sect ? " msec" : "") + (off ? " off" : "");
    R.tr.setAttribute("aria-label", row.label + " · " + row.sound +
      (off ? " · silent" : ""));
    for (const f of COLS) {
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
      const on = !!(ent && ent[k]);
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
      b.setAttribute("aria-label", (on ? "un-" : "") + k + " " + row.label);
    }
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

/* ---------- the cell popover ---------- */
// ONE dialog and one scrim, built once and hidden between uses (popfader.js's
// law). It carries the chip set for exactly one cell — the same chips the
// palette shows for the same field, from the same registry table, so "wet" is
// one word on this machine and not two.
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
// A CHIP IS A TOGGLE, exactly as it is in the palette: tapping the lit one
// clears the field back to its default, and the effects chips latch in the
// ORDER you switch them on, because a chorus into a crunch is not a crunch
// into a chorus (palette.js says the same thing about the box's own chain).
//
// A ONE-OF-THESE CELL CLOSES ON THE CHOICE; THE EFFECTS CELL DOES NOT. Reverb,
// echo, level and place are single decisions — the sheet has answered its
// question and leaving it up only puts a scrim between you and the next row.
// A chain is up to three decisions in an order, so it stays open until you
// dismiss it. (This is the difference between a menu and a bank of chips, and
// it is worth two behaviours rather than one wrong one.)
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
    const on = popField.key === "fx" ? v.includes(b.dataset.value)
                                     : v === b.dataset.value;
    const dflt = !on && popField.key !== "fx" && v == null && !!d && d.v === b.dataset.value;
    b.classList.toggle("on", on || dflt);
    b.classList.toggle("dflt", dflt);
    b.setAttribute("aria-pressed", String(on));
  }
}
// WHERE IT GOES: beside the cell where there is daylight (a desk), a bottom
// sheet where there is not (a phone) — the row sheet's two placements, for the
// row sheet's reason. Anchored, the table stays visible and in place while you
// work on one cell of it, which is the thing a modal cannot do.
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
  if (same) return closePop();             // a second tap on the same cell shuts it
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
// a resize moves the anchor out from under it, and a page switch or a new song
// means the cell it belongs to may not even exist any more
addEventListener("resize", () => { if (popRow) place(); });
on("page", () => closePop());
on("song", () => { closePop(); sig = ""; drawMix(); });
on("box", drawMix);
on("selection", drawMix);
on("refresh", drawMix);
