// ui/palette.js — the chip LIBRARY: toggle(), the ONE dispatcher every chip
// goes through, and mountBanks(), which builds a named CELL's bank list into
// whatever host asks for it. There is no palette PAGE any more (2026-08-15,
// "the row and the board"): the six tabs went with pg-palette, and every bank
// now lives in the popup of the song-row cell that owns its question —
// ui/songrow.js says which cell owns which bank. What this file keeps is the
// material: .pchip with data-kind/data-value, .on/.dflt/aria-pressed, the
// bank-as-table idiom — byte-compatible with the page it replaced, because
// the gates click chips by exactly those hooks.
//
// Layer graph: ui view — imports state/derive/deps only; every change leaves
// through commit(), never through a direct call into audio.
import { GENRES, FAMILIES, MODELABEL, SCALELABEL, VOX, OPLABEL, MAX_FX, ROLES,
         RATELABEL, ARTICS, CMODES, CLAMPLABEL, OCTAVES, KITLABEL, DRUMKITS,
         BASSOPS, SWINGLABEL,
         INLABEL, OUTLABEL, ENVLABEL, MOTLABEL,
         KEYLABEL, PROGLABEL, PERIODLABEL, BREATHLABEL, PIPELABEL, PARTCHOICES,
         SINGLABEL, AUTOPARAMLABEL, AUTOSHAPELABEL, autoShape,
         MAX_NUDGE } from "./deps.js";
import { curSection, commit } from "./state.js";
import { LAYER_OPTS, stackOf, focusOf, focused, opsOf, optOf, voxOf,
         genreOf } from "./derive.js";

/* ---------- clicking things on and off in the selected box ---------- */
export function toggle(kind, value) {
  const sec = curSection();
  if (kind === "genre") {
    const st = sec.stack, i = st.findIndex(e => e.g === value);
    const wasWholeForm = !sec.len || sec.len === GENRES[st[0].g].bars;
    if (i >= 0) {
      if (st.length === 1) return;                        // the last one cannot be removed
      st.splice(i, 1);
      sec.focus = Math.min(sec.focus || 0, st.length - 1);
    } else if (st.length === 1 && st[0].g === "simple") {
      st[0].g = value;           // Simple is the blank default: the first real
                                 // genre REPLACES it rather than stacking on it
      // A GENRE MAY ASK FOR AN EFFECT. Sludge played clean is not sludge — the
      // distortion is as much the genre as the ♭II is — so a genre carrying `fx`
      // seeds the box's chain when the box has none of its own. The chips light
      // up, so it is an offer you can see and switch off, not a hidden default.
      if (!sec.fx.length && GENRES[value].fx) sec.fx = [...GENRES[value].fx];
    } else {
      // a new layer INHERITS the authority's phrases, so it sounds the moment
      // it is added; diverging from there is a click on the phrase rail. Empty
      // was defensible and silent, and silent-on-add reads as broken.
      st.push({ g: value, slots: [...st[0].slots] });
      sec.focus = st.length - 1;
    }
    if (wasWholeForm) sec.len = GENRES[st[0].g].bars;
    sec.nudge = Math.min(sec.nudge, MAX_NUDGE);
  } else if (kind === "phrase") {
    const ent = focused(sec);                  // phrases land on the FOCUSED layer
    const i = ent.slots.indexOf(value);
    i < 0 ? ent.slots.push(value) : ent.slots.splice(i, 1);
  } else if (kind === "focus") {
    sec.focus = +value;                        // which layer the phrase rail edits
  } else if (kind === "op") {
    const ent = focused(sec);
    if (!ent.ops) ent.ops = [...(sec.ops || [])];       // first edit forks the box's
    const i = ent.ops.indexOf(value);
    i < 0 ? ent.ops.push(value) : ent.ops.splice(i, 1);
  } else if (kind === "env") sec.env = sec.env === value ? null : value;
  else if (kind === "mode") sec.mode = sec.mode === value ? null : value;
  else if (kind === "rate") sec.rate = sec.rate === value ? null : value;
  else if (LAYER_OPTS.has(kind)) {
    // the per-layer one-of-these fields, all toggled the same way on the
    // FOCUSED entry (this collapsed five identical branches — scale, clamp,
    // cmode, artic, oct — into the rule they all were)
    const ent = focused(sec);
    const cur = kind === "oct" ? String(optOf(sec, ent, "oct") || "0")
                               : optOf(sec, ent, kind);
    ent[kind] = cur === value ? null : value;
  }
  else if (VOX[kind]) {
    // A VOICE KNOB IS PER LAYER, like every other thing about how a line sounds
    // — the dark 303 underneath and the bright one on top are one box.
    const ent = focused(sec);
    if (!ent.vox) ent.vox = {};
    ent.vox[kind] = voxOf(sec, ent, kind) === value ? null : value;
    if (ent.vox[kind] == null) delete ent.vox[kind];
  }
  else if (kind === "fx") {
    // AN INSERT CHAIN IS ORDERED. Chips apply in the order you switch them on,
    // exactly like the pattern operators, and for the same reason: a chorus into
    // a crunch is not a crunch into a chorus.
    if (!sec.fx) sec.fx = [];
    const i = sec.fx.indexOf(value);
    if (i >= 0) sec.fx.splice(i, 1);
    else if (sec.fx.length < MAX_FX) sec.fx.push(value);
  }
  else if (kind === "auto") {
    // ONE SHAPE PER PARAM. The chips are presets that WRITE the point list —
    // the stored truth is auto:[{param, points, curve}], which is what the
    // mixer arms and the bounce renders, so hand-drawn breakpoints can land
    // later without the save shape moving. Points are baked for the section's
    // CURRENT length in beats; "off" (or re-tapping the lit shape) removes
    // the param's entry.
    const [param, shape] = String(value).split(":");
    const cur = (sec.auto || []).find(a => a && a.param === param);
    const rest = (sec.auto || []).filter(a => !a || a.param !== param);
    if (shape !== "off" && !(cur && cur.shape === shape)) {
      const g = genreOf(sec);
      rest.push(autoShape(param, shape, (sec.len || g.bars) * 4 / g.rate));
    }
    sec.auto = rest;
  }
  // compare COERCED: compose writes numeric keys (b.key = 2) where chips carry
  // strings, and 2 === "2" is false — the first tap on a lit key chip re-set
  // the same value instead of clearing it. String(null) never matches a chip
  // value and every other BOXOPTS field is already a string, so this is exact.
  else if (BOXOPTS.has(kind))
    sec[kind] = String(sec[kind]) === String(value) ? null : value;
  commit("box");
}
// the plain one-of-these box fields, all toggled the same way. (`groove` is
// not here: it is the SONG's now — ui/chrome.js owns its control.)
const BOXOPTS = new Set(["kit", "drumkit", "bassop", "swing", "rev", "echo",
                         "verb", "dtime", "lvl", "pan", "mot", "intro", "outro", "role",
                         "key", "prog", "period", "breath", "pipe", "sing"]);

/* ---------- is this chip on? ---------- */
// ONE function for the build path and the refresh path, so they can never
// disagree — a chip that lights up only after a rebuild is indistinguishable
// from a chip that does not work. Pure over the current selection.
const isOn = (kind, v) => {
  const sec = curSection();
  const ent = LAYER_OPTS.has(kind) || VOX[kind] ? focused(sec) : null;
  if (kind === "genre") return stackOf(sec).some(e => e.g === v);
  if (kind === "op") return opsOf(sec, ent).includes(v);
  if (kind === "focus") return String(focusOf(sec)) === v;
  if (kind === "fx") return sec.fx.includes(v);
  if (VOX[kind]) return voxOf(sec, ent, kind) === v;
  if (kind === "scale") return optOf(sec, ent, "scale") === v;
  if (kind === "clamp") return optOf(sec, ent, "clamp") === v;
  if (kind === "oct") return String(optOf(sec, ent, "oct") || "0") === v;
  if (kind === "cmode") return (optOf(sec, ent, "cmode") || "hold") === v;
  if (kind === "artic") return (optOf(sec, ent, "artic") || "normal") === v;
  if (kind === "part") return (optOf(sec, ent, "part") || "auto") === v;
  if (kind === "key") return String(sec.key) === v;   // compose writes numbers
  if (kind === "auto") {
    const [param, shape] = String(v).split(":");
    const cur = (sec.auto || []).find(a => a && a.param === param);
    return shape === "off" ? !cur : !!(cur && cur.shape === shape);
  }
  return sec[kind] === v;
};
// DEFAULT-LIT vs USER-SET — the machine's one state language: a lit chip is
// bright orange when YOU set it, dim (.dflt) when it is only the fallback
// answering — hold, normal, auto, oct 0, and the blank Simple kernel. Same
// aria-pressed either way: to the accessibility tree "on" is on; the dimming
// is the panel telling you which lights you own.
const isDflt = kind => {
  const sec = curSection();
  const ent = LAYER_OPTS.has(kind) || VOX[kind] ? focused(sec) : null;
  if (kind === "cmode") return optOf(sec, ent, "cmode") == null;
  if (kind === "artic") return optOf(sec, ent, "artic") == null;
  if (kind === "part") return optOf(sec, ent, "part") == null;
  if (kind === "oct") return optOf(sec, ent, "oct") == null;
  if (kind === "genre") {
    const st = stackOf(sec);
    return st.length === 1 && st[0].g === "simple";
  }
  return false;
};

/* ---------- the banks, built into a host ---------- */
// A GROUP IS A BANK: silkscreen header over a uniform grid of keys, never a
// label beside a ragged run of chips. The header is a real <span> and the
// chips live in their own grid wrapper so the columns align — Elektron bank
// select, not a tag cloud. The gates click .pchip by text and data-*, and
// neither moved when the banks moved into the cell popups.
function makeBuilders(host) {
  const group = (title, items) => {
    // A BANK IS A TABLE SECTION: .tbl is the shared well and .thd the shared
    // header row (kernel-daw.css) — the same material the pattern editor and
    // the song table are cut from.
    const g = document.createElement("div"); g.className = "pgroup tbl";
    g.append(Object.assign(document.createElement("span"),
      { className: "plabel thd", textContent: title }));
    const wrap = document.createElement("div");
    wrap.className = "pchips" +
      (items.every(i => String(i[2]).length <= 4) ? " compact" : "");
    for (const [kind, value, label, cls] of items) {
      const b = document.createElement("button");
      const on2 = isOn(kind, String(value));
      b.type = "button"; b.className = "pchip " + (cls || "") + (on2 ? " on" : "") +
        (on2 && isDflt(kind) ? " dflt" : "");
      b.textContent = label; b.setAttribute("aria-pressed", String(!!on2));
      b.dataset.kind = kind; b.dataset.value = String(value);
      b.addEventListener("click", ev => { ev.stopPropagation(); toggle(kind, value); });
      wrap.append(b);
    }
    g.append(wrap);
    host.append(g);
  };
  // one row per table, from the table — a new option is a new entry, never a
  // new line of UI code
  const rowOf = (title, kind, table, cls) =>
    group(title, Object.keys(table).map(k => [kind, k, table[k], cls]));
  const opRow = (title, keys, cls) =>
    group(title, keys.map(k => ["op", k, OPLABEL[k], cls]));
  const note = txt => {
    const p = document.createElement("p");
    p.className = "pnote"; p.textContent = txt;
    host.append(p);
  };
  return { group, rowOf, opRow, note };
}

// WHICH BANKS A CELL OWNS — the inventory made code (nukernel-plan.md §1e is
// the law; ui/songrow.js names the cells). What is NOT here is deliberate:
// fx / rev / verb / echo / dtime / lvl / pan are the MIX page's section row
// (ui/mixtbl.js writes the same box fields), and the genre FOCUS list is the
// GENRE popup's own layer rows, built by songrow because it is rows, not chips.
const CELLBANKS = {
  genre: b => {
    // the genre haystack, clustered: one bank per family, in FAMILIES order.
    // One bank serves BOTH halves of the stack edit — a dark chip ADDS the
    // genre (as the authority on a blank box, as a rider otherwise: toggle()'s
    // own rules), a lit chip TAKES IT OFF — which is what retired the
    // standalone #gpick picker panel.
    for (const [fam, keys] of FAMILIES)
      b.group(fam, keys.map(k => ["genre", k, GENRES[k].label, "gen"]));
    b.rowOf("chord mode", "mode", MODELABEL, "mode");
    b.rowOf("key", "key", KEYLABEL, "mode");
    b.rowOf("progression", "prog", PROGLABEL, "mode");
  },
  role: b => b.rowOf("section", "role", ROLES, "role"),
  timing: b => {
    b.rowOf("tempo", "rate", RATELABEL, "rate");
    b.rowOf("swing", "swing", SWINGLABEL, "rate");
    // (no groove row: the groove belongs to the SONG, like the tempo — its
    // one control is the session bank's GROOVE picker, ui/chrome.js)
    b.rowOf("articulation", "artic", ARTICS, "art");
  },
  mods: b => {
    b.note("These apply to the layer you are editing, not to the whole box. " +
           "They compose in the order you switch them on.");
    b.opRow("pattern", ["rev", "inv", "gateflip", "accflip", "slides", "stick"], "");
    b.opRow("rotate", ["rot1", "rot2", "rot3", "rot4", "rot5", "rot6", "rot7"], "lst");
    b.opRow("rotate rhythm only", ["gat2", "gat4", "gat8"], "lst");
    b.opRow("rotate pitch only", ["pit2", "pit4", "pit8"], "lst");
    b.opRow("split", ["rep2", "rep3", "rep4", "rep5", "rep6", "rep7", "rep8"], "lst");
    b.opRow("delete", ["del2", "del3", "del4", "del5", "del6", "del7", "del8"], "lst");
    b.opRow("thin", ["thin2", "thin3", "thin4"], "lst");
    b.opRow("fill in", ["dens2", "dens3", "dens4"], "lst");
    b.opRow("loop a fragment", ["ex4", "ex8"], "lst");
    b.opRow("shift degrees", ["trm2", "trm1", "trp1", "trp2"], "lst");
    // BOX-scope, in the mods popup on purpose: how the bar schedule phrases
    // (sentence), where a line stops (breath) and what shadows it (a pipe on
    // the rendered stream) are facts about the pattern's unfolding, even
    // though the whole box shares them
    b.rowOf("sentence", "period", PERIODLABEL, "rate");
    b.rowOf("breath", "breath", BREATHLABEL, "env");
    b.rowOf("pipe", "pipe", PIPELABEL, "env");
  },
  voice: b => {
    b.note("Also per layer. The five synth knobs reach any voice that has " +
           "them — the 303, the Model D, the reese and wobble basses.");
    b.rowOf("register", "oct", OCTAVES, "rng");
    b.group("width", [["op", "wide", OPLABEL.wide, "rng"],
                      ["op", "tight", OPLABEL.tight, "rng"]]);
    b.rowOf("alphabet", "scale", SCALELABEL, "rng");
    b.rowOf("part", "part", PARTCHOICES, "rng");
    // BOX-scope on a layer popup, like breath in mods: the box has one lyric
    // and one singer, but what a voice IS belongs here
    b.rowOf("sing", "sing", SINGLABEL, "vox");
    b.rowOf("filter", "cut", VOX.cut.labels, "vox");
    b.rowOf("resonance", "res", VOX.res.labels, "vox");
    b.rowOf("env mod", "emod", VOX.emod.labels, "vox");
    b.rowOf("decay", "dec", VOX.dec.labels, "vox");
    b.rowOf("waveform", "wave", VOX.wave.labels, "vox");
    b.rowOf("ramp limit", "clamp", CLAMPLABEL, "clp");
    b.rowOf("at the limit", "cmode", CMODES, "clp");
  },
  rhythm: b => {
    b.rowOf("drum pattern", "kit", KITLABEL, "kit");
    b.rowOf("drum sound", "drumkit", DRUMKITS, "kit");
    b.rowOf("bass", "bassop", BASSOPS, "bas");
  },
  trans: b => {
    b.note("Intro and outro replace the first and last bar; level and filter " +
           "shape the whole section; the auto rows write a moving shape over it.");
    b.rowOf("intro", "intro", INLABEL, "env");
    b.rowOf("outro", "outro", OUTLABEL, "env");
    b.rowOf("level over the section", "env", ENVLABEL, "env");
    b.rowOf("filter over the section", "mot", MOTLABEL, "mode");
    // AUTOMATION — the four public params as shape rows (send.echo stays
    // data-only: four rows is a mixer, six is a haystack). A chip writes a
    // point list for the section as it is now; the mixer arms it every pass
    // and the bounce renders it, so the chip and the carrier can never
    // disagree about what the section does.
    for (const p of ["cutoff", "level", "pan", "send.rev"])
      b.group("auto · " + AUTOPARAMLABEL[p],
        ["off", "open", "close", "rise", "fall", "pump"].map(s =>
          ["auto", p + ":" + s, AUTOSHAPELABEL[s], "env"]));
  },
};

// BUILD a cell's banks into a host (the popup mount). The host owns the
// lifecycle: it empties itself, calls this on open, and calls refreshChips()
// on every commit while it is up — this module keeps no subscription and no
// singleton element, which is what made it a library instead of a page.
export function mountBanks(cellKey, host) {
  const def = CELLBANKS[cellKey];
  if (!def) return false;
  def(makeBuilders(host));
  return true;
}
// the cheap pass: only the ON states move (a chip click, a focus change, an
// arriving song). Structure never changes under a mounted bank — the one
// structural dependency the old page had (the focus bank) lives in songrow.
export function refreshChips(root) {
  root.querySelectorAll(".pchip").forEach(b => {
    const on2 = isOn(b.dataset.kind, b.dataset.value);
    b.classList.toggle("on", !!on2);
    b.classList.toggle("dflt", !!on2 && isDflt(b.dataset.kind));
    b.setAttribute("aria-pressed", String(!!on2));
  });
}
