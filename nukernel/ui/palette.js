// ui/palette.js — the chips: click things on and off in the selected box, and
// toggle(), the ONE dispatcher every chip goes through. The palette was
// already the file's one incremental view — BUILT ONCE, then only its ON
// states change, with a stack signature forcing a rebuild — and that pattern
// is the one the editor and the song row now copy.
//
// Layer graph: ui view — imports state/derive/deps only; every change leaves
// through commit(), never through a direct call into audio.
import { GENRES, MODELABEL, SCALELABEL, VOX, OPS, OPLABEL, MAX_FX, FX, ROLES,
         RATELABEL, ARTICS, CMODES, CLAMPLABEL, OCTAVES, KITLABEL, DRUMKITS,
         BASSOPS, SWINGLABEL, GROOVELABEL, SENDLABEL, VERBS, DTLABEL,
         LEVELLABEL, PANLABEL, INLABEL, OUTLABEL, ENVLABEL, MOTLABEL,
         MAX_NUDGE } from "./deps.js";
import { curSection, commit, on } from "./state.js";
import { LAYER_OPTS, stackOf, focusOf, focused, opsOf, optOf, voxOf } from "./derive.js";

const paletteEl = document.getElementById("palette");

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
  else if (BOXOPTS.has(kind)) sec[kind] = sec[kind] === value ? null : value;
  commit("box");
}
// the plain one-of-these box fields, all toggled the same way
const BOXOPTS = new Set(["kit", "drumkit", "bassop", "swing", "groove", "rev", "echo",
                         "verb", "dtime", "lvl", "pan", "mot", "intro", "outro", "role"]);

/* ---------- the palette itself ---------- */
// BUILT ONCE, then only its ON states change. Rebuilding it on every draw
// destroyed the button under the pointer mid-click, which lost focus and made
// the page jump — and it took the keyboard focus ring with it.
let paletteBuilt = false, paletteSig = "", paletteTab = "sound";
const PTABS = [["sound", "sound"], ["line", "line"], ["voice", "voice"],
               ["rhythm", "rhythm"], ["fx", "effects"], ["move", "transitions"]];
// One sentence per tab, and only where the answer is not obvious from the chips.
// The two that need it are the two that are per LAYER — which is a real fact
// about how a stacked box works and used to be repeated, uselessly, on twelve
// separate group labels.
const PNOTE = {
  line: "These apply to the layer you are editing, not to the whole box. " +
        "They compose in the order you switch them on.",
  voice: "Also per layer. The five synth knobs reach any voice that has them — " +
         "the 303, the Model D, the reese and wobble basses.",
  fx: "The whole section goes through this chain, and out to the two sends.",
  move: "Intro and outro replace the first and last bar; the other two shape " +
        "the whole section.",
};
export function drawPalette() {
  const el = paletteEl;
  const sec = curSection();
  // The layer picker only EXISTS when there is more than one layer, and its
  // chips are LABELLED with each layer's phrases — neither of which a
  // build-once palette can update. Rebuild on a signature of the stack, so it
  // still does not rebuild on an ordinary chip click, which is what kept the
  // button from vanishing under the pointer.
  const sig = stackOf(sec).map(e => e.g + ":" + e.slots.join(",")).join("|");
  if (paletteBuilt && sig !== paletteSig) paletteBuilt = false;
  // IS THIS CHIP ON? One function, so the build path and the cheap refresh path
  // can never disagree — which they had already started to, and a chip that
  // lights up only after a rebuild is indistinguishable from a chip that does
  // not work.
  const isOn = (kind, v) => {
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
    return sec[kind] === v;
  };
  if (paletteBuilt) {
    el.querySelectorAll(".pchip").forEach(b => {
      const on2 = isOn(b.dataset.kind, b.dataset.value);
      b.classList.toggle("on", !!on2);
      b.setAttribute("aria-pressed", String(!!on2));
    });
    return;
  }
  el.innerHTML = "";
  // TABS, because there are now a hundred and forty of these and a hundred and
  // forty chips in one heap is not a palette, it is a haystack. Six headings,
  // each answering one question about the section, and the question is the
  // heading. (This is also what replaced the "· layer" / "· box" suffix on every
  // group label: the suffix was on twelve labels and told you the same two
  // things over and over. What is per layer is now said once, at the top of the
  // LINE and VOICE tabs, where it is actually a fact you need.)
  const tabs = document.createElement("div"); tabs.className = "ptabs";
  for (const [k, lab] of PTABS) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "ptab" + (k === paletteTab ? " on" : "");
    b.textContent = lab; b.setAttribute("aria-pressed", String(k === paletteTab));
    b.addEventListener("click", () => {
      paletteTab = k; paletteBuilt = false; drawPalette();
    });
    tabs.append(b);
  }
  el.append(tabs);
  const note = document.createElement("p"); note.className = "pnote";
  note.textContent = PNOTE[paletteTab] || "";
  if (note.textContent) el.append(note);

  const group = (title, items) => {
    const g = document.createElement("div"); g.className = "pgroup";
    g.append(Object.assign(document.createElement("span"),
      { className: "plabel", textContent: title }));
    for (const [kind, value, label, cls] of items) {
      const b = document.createElement("button");
      const on2 = isOn(kind, String(value));
      b.type = "button"; b.className = "pchip " + (cls || "") + (on2 ? " on" : "");
      b.textContent = label; b.setAttribute("aria-pressed", String(!!on2));
      b.dataset.kind = kind; b.dataset.value = String(value);
      b.addEventListener("click", () => toggle(kind, value));
      g.append(b);
    }
    el.append(g);
  };
  // one row per table, from the table — a new option is a new entry, never a
  // new line of UI code
  const rowOf = (title, kind, table, cls) =>
    group(title, Object.keys(table).map(k => [kind, k, table[k], cls]));
  const opRow = (title, keys, cls) =>
    group(title, keys.map(k => ["op", k, OPLABEL[k], cls]));

  if (paletteTab === "sound") {
    group("genre", Object.keys(GENRES).map(k => ["genre", k, GENRES[k].label, "gen"]));
    if (stackOf(sec).length > 1)
      group("editing", stackOf(sec).map((e, i) =>
        ["focus", String(i), GENRES[e.g].label + (e.slots.length
          ? " · " + e.slots.map(n => n + 1).join("+") : " · —"), "foc"]));
    rowOf("section", "role", ROLES, "role");
    rowOf("chord mode", "mode", MODELABEL, "mode");
    rowOf("tempo", "rate", RATELABEL, "rate");
    rowOf("articulation", "artic", ARTICS, "art");
  } else if (paletteTab === "line") {
    opRow("pattern", ["rev", "inv", "gateflip", "accflip", "slides", "stick"], "");
    opRow("rotate", ["rot1", "rot2", "rot3", "rot4", "rot5", "rot6", "rot7"], "lst");
    opRow("rotate rhythm only", ["gat2", "gat4", "gat8"], "lst");
    opRow("rotate pitch only", ["pit2", "pit4", "pit8"], "lst");
    opRow("split", ["rep2", "rep3", "rep4", "rep5", "rep6", "rep7", "rep8"], "lst");
    opRow("delete", ["del2", "del3", "del4", "del5", "del6", "del7", "del8"], "lst");
    opRow("thin", ["thin2", "thin3", "thin4"], "lst");
    opRow("fill in", ["dens2", "dens3", "dens4"], "lst");
    opRow("loop a fragment", ["ex4", "ex8"], "lst");
    opRow("shift degrees", ["trm2", "trm1", "trp1", "trp2"], "lst");
  } else if (paletteTab === "voice") {
    rowOf("register", "oct", OCTAVES, "rng");
    group("width", [["op", "wide", OPLABEL.wide, "rng"],
                    ["op", "tight", OPLABEL.tight, "rng"]]);
    rowOf("alphabet", "scale", SCALELABEL, "rng");
    rowOf("filter", "cut", VOX.cut.labels, "vox");
    rowOf("resonance", "res", VOX.res.labels, "vox");
    rowOf("env mod", "emod", VOX.emod.labels, "vox");
    rowOf("decay", "dec", VOX.dec.labels, "vox");
    rowOf("waveform", "wave", VOX.wave.labels, "vox");
    rowOf("ramp limit", "clamp", CLAMPLABEL, "clp");
    rowOf("at the limit", "cmode", CMODES, "clp");
  } else if (paletteTab === "rhythm") {
    rowOf("drum pattern", "kit", KITLABEL, "kit");
    rowOf("drum sound", "drumkit", DRUMKITS, "kit");
    rowOf("bass", "bassop", BASSOPS, "bas");
    rowOf("swing", "swing", SWINGLABEL, "rate");
    rowOf("groove", "groove", GROOVELABEL, "rate");
  } else if (paletteTab === "fx") {
    group("effects (up to " + MAX_FX + ", in the order you switch them on)",
      Object.keys(FX).map(k => ["fx", k, FX[k].label, "fx"]));
    rowOf("reverb", "rev", SENDLABEL, "env");
    rowOf("space", "verb", VERBS, "env");
    rowOf("echo", "echo", SENDLABEL, "env");
    rowOf("echo time", "dtime", DTLABEL, "env");
    rowOf("level", "lvl", LEVELLABEL, "bas");
    rowOf("place", "pan", PANLABEL, "bas");
  } else {
    rowOf("intro", "intro", INLABEL, "env");
    rowOf("outro", "outro", OUTLABEL, "env");
    rowOf("level over the section", "env", ENVLABEL, "env");
    rowOf("filter over the section", "mot", MOTLABEL, "mode");
  }
  paletteBuilt = true; paletteSig = sig;
}
// The page rail drives the tab too: on a phone SOUND/MIX/MOVE are this
// palette wearing a different tab (ui/pages.js), through the same rebuild a
// .ptab click takes — one path, so the rail and the tabs can never disagree.
export function showTab(k) {
  if (paletteTab === k) return;
  paletteTab = k; paletteBuilt = false; drawPalette();
}

on("song", () => { paletteBuilt = false; drawPalette(); });
on("box", drawPalette);
on("selection", drawPalette);
