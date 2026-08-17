// ui/poolbank.js — THE INSTRUMENT POOL BANK ("the band is hired for the
// record, not the scene", 2026-08-16): the ONE place you cast the band. One
// labeled row per chair (fields.js POOLCHAIRS — the kernel's own roles plus
// the bass), each showing its current pick — the genre's own choice dim-lit
// while the chair is uncast — and unfolding, in place, the same twelve-family
// instrument picker the VOICE cell used to carry (ui/palette.js INSTRFAMS,
// unchanged). A pick writes ONE song fact (ui/state.js POOL, one chair) and
// leaves through commit("pool"): the transport recompiles, the bounce re-cuts
// the carrier, the board relabels, every VOICE cell renames — one resolver,
// derive.js instrIdOf, everywhere at once.
//
// It lives on the MIX page now, beside the desk it casts ("move all the
// sound definition and saving functionality into mix", Paul, 2026-08-16) —
// #poolbank is a tappable <details> there, closed by default. It is still a
// SONG operation, not a box one: like the groove and the swing it outlives
// every section, and a per-section instrument was several bands pretending
// to be one. This module never queried its own page, so the move cost it
// nothing — #poolbank/.poolrows are read wherever they sit in the DOM.
//
// Layer graph: ui view — imports state/derive/deps and palette's bank shape;
// every change leaves through commit(), never through a direct call into
// audio. The unfold idiom is the song row's (one open at a time, chips commit
// and the menu PATCHES, never closes; Esc or re-tap dismisses).
import { GENRES, INSTRCHOICES, POOLCHAIRS, PARTLABEL, instrOf,
         BASS_INSTR } from "./deps.js";
import { SONG, POOL, setPoolChair, commit, on } from "./state.js";
import { stackOf, chairOf, genreOf } from "./derive.js";
import { INSTRFAMS } from "./palette.js";
import { buzz } from "./touch.js";

const bank = document.getElementById("poolbank");
const rowsEl = bank && bank.querySelector(".poolrows");

/* ---------- what a chair plays today ---------- */
// THE GENRE'S OWN PICKS for a chair, across the whole song — what the chair
// plays while it is uncast, and the dim-lit truth the row and the picker both
// show. First occurrence first, deduped; a signature synth is named honestly
// (a 303 is a 303 until the pool says otherwise — transport's own switch); an
// unseated chair answers "—", because casting a seat nobody sits in is legal
// but should look like what it is.
function defaultsFor(chair) {
  const ids = [];
  const add = id => { if (id && !ids.includes(id)) ids.push(id); };
  if (chair === "bass") {
    for (const sec of SONG)
      if (!genreOf(sec).nobass) { add(BASS_INSTR); break; }
    return ids;
  }
  for (const sec of SONG)
    for (const ent of stackOf(sec)) {
      const g = GENRES[ent.g];
      if (!g) continue;
      for (let v = 0; v < g.voices; v++)
        if (chairOf(sec, ent, v) === chair)
          add(g.synth ? (g.synth.root || g.synth.dsp) : instrOf(ent.g, v));
    }
  return ids;
}
const say = id => String(id || "").replace(/_/g, " ");

/* ---------- the rows, built once ---------- */
let openChair = null;                       // which chair's picker is unfolded
const rows = new Map();                     // chair -> { row, btn, val }
// ONE picker element for every chair — the #rowpop idiom one bank over:
// inserted directly below the row whose chair is open, parked on the bank
// whenever closed. The chips are rebuilt per open (they are cheap and the
// mount is emptied anyway); their lights are patched per commit.
const mount = Object.assign(document.createElement("div"),
  { className: "poolmount", hidden: true });

function buildRow(chair) {
  const row = document.createElement("div");
  row.className = "poolrow";
  row.dataset.chair = chair;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "poolpick";
  btn.dataset.chair = chair;
  btn.setAttribute("aria-expanded", "false");
  const lab = Object.assign(document.createElement("span"),
    { className: "glab", textContent: PARTLABEL[chair] || chair });
  const val = Object.assign(document.createElement("span"), { className: "pv" });
  btn.append(lab, val);
  btn.addEventListener("click", ev => {
    ev.stopPropagation();
    if (openChair === chair) { closePicker(); return; }
    openPicker(chair);
  });
  row.append(btn);
  rows.set(chair, { row, btn, val });
  return row;
}

/* ---------- the picker ---------- */
// the same bank-as-table material every chip surface is cut from: .pgroup +
// .plabel + .pchips of .pchip — and the same twelve families, because "driven
// guitar" here IS the dirty strip on the desk. The leading GENRE'S OWN chip
// is the un-cast: it clears the chair back to whatever each genre brought.
function buildPicker(chair) {
  mount.textContent = "";
  const chip = (value, label, cls) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pchip " + (cls || "");
    b.textContent = label;
    b.dataset.kind = "pool";
    b.dataset.value = value;
    b.addEventListener("click", ev => {
      ev.stopPropagation();
      setPoolChair(chair, value || null);
      commit("pool");
      refresh();                            // patch, never close — one visit
      buzz(4);
    });
    return b;
  };
  const own = document.createElement("div");
  own.className = "pgroup tbl";
  own.append(Object.assign(document.createElement("span"),
    { className: "plabel", textContent: "the genre's own" }));
  const ownWrap = document.createElement("div");
  ownWrap.className = "pchips";
  ownWrap.append(chip("", "genre default", "gen"));
  own.append(ownWrap);
  mount.append(own);
  for (const [fam, ids] of INSTRFAMS) {
    const g = document.createElement("div");
    g.className = "pgroup tbl";
    g.append(Object.assign(document.createElement("span"),
      { className: "plabel", textContent: "instrument · " + fam }));
    const wrap = document.createElement("div");
    wrap.className = "pchips";
    for (const id of ids) wrap.append(chip(id, INSTRCHOICES[id], "gen"));
    g.append(wrap);
    mount.append(g);
  }
}
function openPicker(chair) {
  openChair = chair;
  buildPicker(chair);
  const r = rows.get(chair);
  r.row.after(mount);
  mount.hidden = false;
  refresh();
  buzz(4);
}
function closePicker() {
  if (openChair == null) return;
  openChair = null;
  mount.hidden = true;
  bank.append(mount);                       // parked out of the rows
  refresh();
}
addEventListener("keydown", ev => {
  if (openChair != null && ev.key === "Escape") { closePicker(); ev.preventDefault(); }
});

/* ---------- the lights ---------- */
// the machine's one state language, the palette's exactly: a CAST chair is
// bright (.on) on its row and its chip; an uncast chair shows the genre's own
// answer dim (.dflt) — on the row as the readout, in the picker as the
// "genre default" chip plus every instrument the song's genres bring to that
// chair, lit the way the fallback answering has always been lit.
function refresh() {
  for (const [chair, r] of rows) {
    const pick = POOL && POOL[chair];
    const dfl = defaultsFor(chair);
    const txt = pick ? say(pick)
      : dfl.length ? dfl.map(say).join(" · ") : "—";
    if (r.val.textContent !== txt) r.val.textContent = txt;
    r.val.classList.toggle("dflt", !pick);
    r.btn.classList.toggle("on", !!pick);
    r.btn.classList.toggle("unseated", !pick && !dfl.length);
    r.btn.setAttribute("aria-expanded", String(openChair === chair));
    r.btn.setAttribute("aria-label", (PARTLABEL[chair] || chair) + " chair: " +
      (pick ? say(pick) : (dfl.length ? "genre default (" + txt + ")" : "no seat in this song")) +
      " — opens the instrument picker");
    r.row.classList.toggle("open", openChair === chair);
  }
  if (openChair != null && !mount.hidden) {
    const pick = POOL && POOL[openChair];
    const dfl = new Set(defaultsFor(openChair));
    mount.querySelectorAll(".pchip").forEach(b => {
      const v = b.dataset.value;
      const on = pick ? v === pick : v === "" || dfl.has(v);
      b.classList.toggle("on", on);
      b.classList.toggle("dflt", on && !pick);
      b.setAttribute("aria-pressed", String(on));
    });
  }
}

/* ---------- boot + subscriptions ---------- */
if (rowsEl) {
  for (const chair of POOLCHAIRS) rowsEl.append(buildRow(chair));
  bank.append(mount);
  refresh();
  on("pool", refresh);
  on("song", () => { closePicker(); refresh(); });
  on("box", refresh);                       // a genre swap moves the defaults
}
