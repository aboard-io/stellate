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
// (FAMILIES is no longer imported: the genre bank is chronological now, and
// nothing else in this file asked the table which cluster a genre belongs to.
// The field itself is untouched — genres.js still stamps `family` and the
// unit gate still holds every anchor to exactly one.)
import { GENRES, MODELABEL, SCALELABEL, VOX, OPLABEL, MAX_FX, ROLES,
         ARTICS, CMODES, CLAMPLABEL, OCTAVES, KITLABEL, DRUMKITS,
         BASSOPS, INSTRCHOICES, familyOf,
         INLABEL, OUTLABEL, ENVLABEL, MOTLABEL,
         KEYLABEL, PROGLABEL, PERIODLABEL, BREATHLABEL, PIPELABEL, PARTCHOICES,
         SINGLABEL, AUTOPARAMLABEL, AUTOSHAPELABEL, autoShape,
         MAX_NUDGE } from "./deps.js";
import { curSection, commit } from "./state.js";
import { LAYER_OPTS, stackOf, focusOf, focused, opsOf, optOf, voxOf,
         genreOf } from "./derive.js";

/* ---------- THE CHRONOLOGY ---------- */
// "Organize the genres chronologically in the menu" (Paul, 2026-08-16). Every
// real anchor is named PLACE YEAR — "Rome 600", "Leipzig 1725", "Portland
// 2011" ("every genre is a city and a year", 102bb37) — so the ordering key
// is already printed on the chip, and the year is READ OFF THE LABEL rather
// than stored a second time as a field. That is deliberate: a `year:` on the
// anchor would be a second copy of a fact the label must carry anyway, free
// to drift, and genres.js is written by other hands than this file's. The
// parse is a trailing 3-or-4 digit run, which every place-year label ends in
// and no function genre ("Simple", "Backing vocals") contains at all.
//
// NOTHING COUNTS THE ROSTER. Both lists below are computed from
// Object.keys(GENRES) at call time, so a genre added to the table appears in
// the menu at its own year with no edit here.
export const genreYear = k => {
  const g = GENRES[k];
  const m = g && /(\d{3,4})\s*$/.exec(g.label);
  return m ? +m[1] : null;
};
// oldest first, then the yearless ones (the FUNCTION genres — a part has a
// job, not a history) in table order behind them. Ties break on the key so
// two anchors from the same year never swap places between repaints.
export function chronoGenres() {
  const keys = Object.keys(GENRES);
  const dated = keys.filter(k => genreYear(k) != null)
    .sort((a, b) => genreYear(a) - genreYear(b) || (a < b ? -1 : a > b ? 1 : 0));
  return { dated, undated: keys.filter(k => genreYear(k) == null) };
}
// THE ERA TINT, and it is the only thing standing in for the group headers
// the house forbids: six bands of years, each lighting the chip's existing
// LED dot a different colour (kernel-daw.css .pchip.e1…e6). Nothing is
// LABELLED "baroque" or "the eighties" — the chronology does its own work,
// the labels say the years, and the colour just gives the eye somewhere to
// rest as it scrolls a list that only grows.
//
// EXPORTED because the LAB's parent bank (ui/lab.js) deals the same
// chronological list and must wear the same tint — a second copy of the cut
// years is a second chronology, free to disagree about when the eighties start.
const ERAS = [1600, 1900, 1960, 1980, 2000];
export const eraOf = k => {
  const y = genreYear(k);
  if (y == null) return "";
  let e = 1;
  for (const cut of ERAS) if (y >= cut) e++;
  return " e" + e;
};

/* ---------- clicking things on and off in the selected box ---------- */
// `ent` is the LAYER SCOPE, and only the GENRE branch reads it: a menu opened
// from a layer's own sub-row (ui/songrow.js popEnt) hands its stack entry
// down, and then a genre chip means "make THIS LAYER that genre" rather than
// "stack another layer on the box". Without it the [+ layer] key was a trap —
// you grew a blank sub-row, its genre menu opened on it, and the first chip
// you tapped grew a SECOND sub-row and left the blank one sitting there. The
// parent row still passes nothing, so its GENRE menu keeps the old law: a
// dark chip adds a layer, a lit one takes it off.
export function toggle(kind, value, ent) {
  const sec = curSection();
  if (kind === "genre" && ent) {
    // SCOPED: one entry, never the authority (index 0 IS the box's genre, and
    // its cell is the parent row's, which passes no scope). Genre keys stay
    // UNIQUE inside a stack — ui/derive.js poolInstrOf looks a layer up by its
    // key — so becoming a genre another layer already plays is a no-op.
    const st = sec.stack, i = st.indexOf(ent);
    if (i > 0) {
      if (ent.g === value) {                   // its own genre: take the layer off
        st.splice(i, 1);
        sec.focus = Math.min(sec.focus || 0, st.length - 1);
      } else if (!st.some(e => e.g === value)) ent.g = value;
      commit("box");
      return;
    }
  }
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
// the plain one-of-these box fields, all toggled the same way. (`groove` and
// `swing` are not here: they are the SONG's now — ui/chrome.js owns their
// controls, and no section surface may tell time.)
const BOXOPTS = new Set(["kit", "drumkit", "bassop", "rev", "echo",
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
  // (no "instr" branch: the instrument is the SONG's pool now — ui/poolbank.js
  // owns those chips, and no section surface offers an instrument at all)
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

/* ---------- THE DNA OF A GENRE ---------- */
// "Show the DNA of a genre somewhere" (Paul, 2026-08-16). Somewhere is the
// GENRE menu, over the chronological bank, reading the genre the menu is
// currently pointed at: a flat bar of its weighted parents, one colour each,
// ending in THE INVENTION — the share of this music that its parents do not
// explain. Under the bar, the parents in words, then the children it went on
// to have and the ancestors it is still missing.
//
// TWO SOURCES, AND BOTH ARE READ LIVE — nothing here is a copied number:
//   THE CLAIM     GENRES[k].parents / .wants, the annotation each anchor
//                 declares (001766e). Always present, and it grows: another
//                 hand is seating new ancestors in genres.js right now, so
//                 the parents map is walked at paint time, never cached.
//   THE FIT       nukernel/GENEALOGY.md, the committed finding that
//                 genealogy.js writes — how much of the child its declared
//                 parents ACTUALLY explain (R²) and at what weights. Fetched
//                 once, lazily, on the first genre menu; parsed out of the
//                 report's own table. When a genre is missing from it (a new
//                 anchor whose fit has not been re-run) or the file is not
//                 served at all, the panel falls back to the DECLARED weights
//                 and says so, rather than inventing a residue.
// The bar is the honest arithmetic either way: with a fit, each parent takes
// fitted-weight × R² and the invention takes 1 − R², so the segments sum to
// one; without one, the declared weights sum to one and there is no invention
// segment to draw, because nothing measured it.
const FIT = new Map();                       // key -> { r2, w: {parent: share} }
let fitAsked = false;
function loadFit() {
  if (fitAsked) return;
  fitAsked = true;
  // relative to THIS module, not to the page: the same URL works from
  // nukernel/kernel-daw.html and from any probe that serves the tree
  fetch(new URL("../GENEALOGY.md", import.meta.url))
    .then(r => (r.ok ? r.text() : ""))
    .then(md => {
      // the report's row shape: | key — Label | 93.8% | 0.082 | a 0.08 (0.65), … |
      for (const line of md.split("\n")) {
        const m = /^\|\s*([a-z0-9]+)\s+—[^|]*\|\s*([\d.]+)%\s*\|[^|]*\|([^|]*)\|/.exec(line);
        if (!m) continue;
        const w = {};
        for (const part of m[3].split(",")) {
          const p = /\s*([a-z0-9]+)\s+([\d.]+)\s*\(/.exec(part);
          if (p) w[p[1]] = +p[2];
        }
        FIT.set(m[1], { r2: +m[2] / 100, w });
      }
      if (FIT.size) repaintDna();
    })
    .catch(() => {});
}
// the six colours a parent can wear, cycled by position — category colour in
// its plainest use: which strand of the braid is this one
const STRAND = ["--v0", "--v1", "--v2", "--v3", "--vb", "--drum"];
const childrenOf = k => Object.keys(GENRES)
  .filter(c => GENRES[c].parents && GENRES[c].parents[k] != null);

// THE SHARES, as one function so the bar, the legend and any probe reading
// the DOM can never disagree: [{ key, label, share, colour }], plus the
// invention when a fit is what produced them.
function dnaShares(k) {
  const declared = GENRES[k].parents || {};
  const names = Object.keys(declared);
  const fit = FIT.get(k);
  const out = names.map((p, i) => ({
    key: p, label: (GENRES[p] && GENRES[p].label) || p,
    share: fit && fit.w[p] != null ? fit.w[p] * fit.r2 : declared[p],
    colour: "var(" + STRAND[i % STRAND.length] + ")",
  }));
  if (fit) out.push({ key: "", label: "the invention", invention: true,
                      share: Math.max(0, 1 - fit.r2), colour: "var(--accent)" });
  return { rows: out, fitted: !!fit, r2: fit ? fit.r2 : null };
}

// THE PRINTED PERCENTAGES MUST ADD UP. Rounding each share on its own gave
// "39% inherited, 62% invented" over a bar of 12 + 27 + 62 — three true
// numbers that read as a mistake. The LAST row (the invention, wherever a fit
// produced one) takes the remainder, so the words on screen sum to 100 while
// the exact shares stay on the segments as data.
function pcts(rows) {
  const out = rows.map(r => Math.round(r.share * 100));
  if (out.length) out[out.length - 1] =
    Math.max(0, 100 - out.slice(0, -1).reduce((a, b) => a + b, 0));
  return out;
}
let dnaEl = null;                            // the mounted panel, if any
function buildDna(host) {
  loadFit();
  const d = document.createElement("div");
  d.className = "dna";
  d.append(Object.assign(document.createElement("span"), { className: "dnahead" }),
           Object.assign(document.createElement("div"), { className: "dnabar" }),
           Object.assign(document.createElement("div"), { className: "dnakeys" }),
           Object.assign(document.createElement("p"), { className: "dnaline dnakids" }),
           Object.assign(document.createElement("p"), { className: "dnaline dnawant" }));
  host.append(d);
  dnaEl = d;
  paintDna(d);
}
// REBUILT ON EVERY PAINT, and that is fine here where it is a sin on a row:
// this is a dozen nodes behind no pointer — no key of it is tappable, so
// nothing can be destroyed under a finger mid-click — and the shares change
// shape (a different genre has a different number of parents) rather than
// changing value.
function paintDna(d) {
  const k = focused(curSection()).g;
  const g = GENRES[k];
  const { rows, fitted } = dnaShares(k);
  const shown = pcts(rows);
  const inherited = rows.reduce((a, r, i) => a + (r.invention ? 0 : shown[i]), 0);
  const head = d.querySelector(".dnahead");
  head.textContent = "";
  head.append(Object.assign(document.createElement("b"), { textContent: g.label }));
  head.append(document.createTextNode(
    !rows.length ? " · a root: it has no parents in this catalog"
    : fitted ? " · " + inherited + "% inherited, " + (100 - inherited) + "% invented"
    : " · as declared (the fit has not measured this one yet)"));
  const bar = d.querySelector(".dnabar");
  const keys = d.querySelector(".dnakeys");
  bar.textContent = ""; keys.textContent = "";
  bar.hidden = keys.hidden = !rows.length;
  rows.forEach((r, i) => {
    const seg = document.createElement("i");
    seg.className = "dnaseg" + (r.invention ? " inv" : "");
    seg.style.setProperty("--w", (r.share * 100).toFixed(2) + "%");
    seg.style.setProperty("--c", r.colour);
    // the numbers live in the DOM as data, so the picture and any reader of
    // it are the same fact
    seg.dataset.share = r.share.toFixed(4);
    if (r.key) seg.dataset.parent = r.key;
    bar.append(seg);
    const kk = document.createElement("span");
    kk.className = "dnak" + (r.invention ? " inv" : "");
    const dot = document.createElement("i");
    dot.style.setProperty("--c", r.colour);
    kk.append(dot, document.createTextNode(r.label + " "));
    kk.append(Object.assign(document.createElement("b"),
      { textContent: shown[i] + "%" }));
    keys.append(kk);
  });
  bar.setAttribute("role", "img");
  bar.setAttribute("aria-label", rows.length
    ? g.label + " is " + rows.map((r, i) => r.label + " " + shown[i] + "%").join(", ")
    : g.label + " has no declared parents");
  const kids = childrenOf(k);
  const kidLine = d.querySelector(".dnakids");
  kidLine.textContent = kids.length
    ? "went on to father " + kids.map(c => GENRES[c].label).join(", ")
    : "";
  kidLine.hidden = !kids.length;
  const want = (g.wants || []);
  const wantLine = d.querySelector(".dnawant");
  wantLine.textContent = want.length
    ? "still missing its " + want.join(", ") : "";
  wantLine.hidden = !want.length;
}
function repaintDna() { if (dnaEl && dnaEl.isConnected) paintDna(dnaEl); else dnaEl = null; }

/* ---------- the banks, built into a host ---------- */
// A GROUP IS A BANK: silkscreen header over a uniform grid of keys, never a
// label beside a ragged run of chips. The header is a real <span> and the
// chips live in their own grid wrapper so the columns align — Elektron bank
// select, not a tag cloud. The gates click .pchip by text and data-*, and
// neither moved when the banks moved into the cell popups.
function makeBuilders(host, ent) {
  // `gcls` is an optional class on the BANK (not on its chips) — one user so
  // far, the chronological genre bank, which is one long list where every
  // other bank is a short one and so wants the whole fold rather than a
  // 300px column of it
  const group = (title, items, gcls) => {
    // A BANK IS NAMED, and .plabel is not a table header: it says WHICH of a
    // dozen banks stacked in the same fold this one is ("instrument ·
    // strings"), which no chip inside it can say for itself. That is the
    // whole test the header cull applies ("get rid of ... table headers",
    // 2026-08-16) — a column label goes, a thing's own name stays — and the
    // .thd class goes with the rest.
    const g = document.createElement("div");
    g.className = "pgroup tbl" + (gcls ? " " + gcls : "");
    g.append(Object.assign(document.createElement("span"),
      { className: "plabel", textContent: title }));
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
      // the LAYER SCOPE rides along (null from a parent row's cell): toggle()
      // reads it in the genre branch and nowhere else
      b.addEventListener("click", ev => { ev.stopPropagation(); toggle(kind, value, ent); });
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
  // (there is no .note() any more: a panel's own rows are all it says now —
  // "no text... none of that", Paul, 2026-08-16. Every caller that used to
  // open with an explanatory paragraph had it deleted, not shortened.)
  return { group, rowOf, opRow, dna: () => buildDna(host) };
}

// THE INSTRUMENT BANK'S SHAPE, built once: family -> ids, in a musical order
// (keyboards first, synth colours last), each family named the way a crate is.
// EXPORTED for the one surface that still offers instruments — the SONG
// page's INSTRUMENT POOL bank (ui/poolbank.js): the band is hired for the
// record, so the VOICE cells below carry no instrument banks any more, but
// the picker they open is the same twelve families, unchanged.
export const INSTRFAMS = (() => {
  const order = ["keys", "organ", "guitar", "dirty", "strings", "bowed",
                 "brass", "reed", "mallet", "vox", "pad", "lead"];
  const label = { keys: "keys", organ: "organs", guitar: "guitars",
                  dirty: "driven guitars", strings: "string sections",
                  bowed: "bowed", brass: "brass", reed: "winds + reeds",
                  mallet: "struck + tuned", vox: "voices", pad: "pads",
                  lead: "synths" };
  const by = new Map();
  for (const id of Object.keys(INSTRCHOICES)) {
    const f = familyOf(id, false);
    if (!by.has(f)) by.set(f, []);
    by.get(f).push(id);
  }
  const fams = [...by.keys()].sort((a, b2) =>
    (order.indexOf(a) + 99 * (order.indexOf(a) < 0)) -
    (order.indexOf(b2) + 99 * (order.indexOf(b2) < 0)));
  return fams.map(f => [label[f] || f, by.get(f)]);
})();

// WHICH BANKS A CELL OWNS — the inventory made code (nukernel-plan.md §1e is
// the law; ui/songrow.js names the cells). What is NOT here is deliberate:
// fx / rev / verb / echo / dtime / lvl / pan are the MIX page's section row
// (ui/mixtbl.js writes the same box fields), and the genre FOCUS list is the
// GENRE popup's own layer rows, built by songrow because it is rows, not chips.
const CELLBANKS = {
  genre: b => {
    // THE DNA FIRST: what this genre IS, before the list of what it could be.
    b.dna();
    // THE HAYSTACK IN TIME ORDER, oldest first — Rome 600 down to whatever was
    // named last. The eleven FAMILIES banks it replaces (vox · club · soul ·
    // groove · band · studio · drift · roots) sorted by TRADITION, which is a
    // taxonomy the reader has to learn before the menu is usable; a year is a
    // fact everyone already has, and the chip prints it. One bank, no era
    // headers (the house forbids them and they would only repeat the labels) —
    // the chronology is the organisation, and the era tint on each chip's dot
    // is all the banding it gets.
    //
    // One bank serves BOTH halves of the stack edit — a dark chip ADDS the
    // genre (as the authority on a blank box, as a rider otherwise: toggle()'s
    // own rules), a lit chip TAKES IT OFF — which is what retired the
    // standalone #gpick picker panel. Opened from a LAYER's sub-row (the
    // scoped case) the same bank means one layer instead of the stack: a dark
    // chip makes THIS layer that genre, its own lit chip takes the layer off,
    // and another layer's lit chip stands for that layer and does nothing.
    const { dated, undated } = chronoGenres();
    b.group("genre · oldest first",
      dated.map(k => ["genre", k, GENRES[k].label, "gen" + eraOf(k)]), "chrono");
    // ...and the yearless ones behind them, in table order: the FUNCTION
    // genres are parts, not styles, and chronology has nothing to say about a
    // part. They sit last for the reason FAMILIES always put them last — you
    // pick the music first and the part second.
    if (undated.length)
      b.group("parts", undated.map(k => ["genre", k, GENRES[k].label, "gen"]));
    b.rowOf("chord mode", "mode", MODELABEL, "mode");
    b.rowOf("key", "key", KEYLABEL, "mode");
    b.rowOf("progression", "prog", PROGLABEL, "mode");
  },
  role: b => b.rowOf("section", "role", ROLES, "role"),
  // (no `timing` bank any more: NOTHING IN A SECTION TELLS TIME. Tempo,
  // groove and swing all belong to the SONG — the transport fader and the
  // session bank's pickers, ui/chrome.js. A genre still keeps its own derived
  // rate and its own lean, but that is identity, not a per-section control.
  // The cell's two genuinely-per-pattern survivors moved into MODS: the nudge
  // stepper — ui/songrow.js mounts it — and the articulation row below.)
  mods: b => {
    // (no explanatory note here any more — "no text... none of that", Paul,
    // 2026-08-16. These apply to the layer being edited, not the whole box,
    // and compose in the order they are switched on; that is what the rest
    // of the machine's chip material already says without a sentence.)
    // HOW THE PATTERN SPEAKS is a mod of the pattern — articulation rode the
    // retired timing cell only because it changes note LENGTHS
    b.rowOf("articulation", "artic", ARTICS, "art");
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
    // (no explanatory note here any more, same law as MODS above. What this
    // popup covers — register, width, alphabet, part, the five synth knobs —
    // is exactly what its rows say; no prose repeats it.)
    // (no instrument banks here: the band is hired for the RECORD, not the
    // scene — the same twelve-family picker lives in the SONG page's
    // INSTRUMENT POOL bank, ui/poolbank.js, one pick per chair.)
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
    // (no explanatory note here any more, same law as MODS/VOICE above.)
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
// `ent` is the sub-row's stack entry when a LAYER opened the menu, threaded
// straight through to every chip's toggle() — see the scope note on toggle().
export function mountBanks(cellKey, host, ent) {
  const def = CELLBANKS[cellKey];
  if (!def) return false;
  def(makeBuilders(host, ent || null));
  return true;
}
// the cheap pass: only the ON states move (a chip click, a focus change, an
// arriving song). Structure never changes under a mounted bank — the one
// structural dependency the old page had (the focus bank) lives in songrow.
// The DNA panel rides the same pass, because it reads the FOCUSED genre and
// that is exactly what a chip click moves: adding a layer makes the new genre
// the focused one, so its blood is on screen the moment it joins the stack.
export function refreshChips(root) {
  if (dnaEl && root.contains(dnaEl)) paintDna(dnaEl);
  root.querySelectorAll(".pchip").forEach(b => {
    const on2 = isOn(b.dataset.kind, b.dataset.value);
    b.classList.toggle("on", !!on2);
    b.classList.toggle("dflt", !!on2 && isDflt(b.dataset.kind));
    b.setAttribute("aria-pressed", String(!!on2));
  });
}
