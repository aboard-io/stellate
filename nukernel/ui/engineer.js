// nukernel/ui/engineer.js — THE ONE BOARD.
//
// REBUILT 2026-08-27 against nukernel/ideal/one-board.html (iterated with Paul,
// binding). Paul, 2026-08-27: *"I think we need to do what everyone else does
// with effects. Add per voice effects, up to three. Each has a wet dry mix and
// its own settings. Have one bus for genre specific effects, into a delay bus,
// into reverb, into main. Each instrument can send post effects mix to all of
// the four buses."* And the three laws of the same day: *"Vertical space is
// cheap. Don't use knobs. Have simple vertical sliders stacked and labeled"*;
// time runs down; *"when I touch them I scroll the whole window and can't
// interact"* — every drag surface captures its pointer.
//
// WHAT THIS REPLACES, and the reversal written down rather than deleted: the
// TWO-TABLE board of 2026-08-25 (#boardtbl the channels, #racktbl the returns
// and the main — one column per strip, one row per control, split because one
// grid over three kinds of strip was 55.9% hole). Every measurement that built
// it was real and is kept in the git history of this file; what changed is the
// GEOMETRY, on Paul's word: strips are TALL now — down a strip reads in signal
// order (instrument → three inserts → four sends → EQ → pan → the fader) and
// the buses are a RACK IN SERIES below them, genre → delay → reverb → main,
// drawn top to bottom because time and signal both run down. The two GROUP
// buses (bus 3 `room`, bus 4 `aux`, 2026-08-26's "let me have up to four buses
// and a way to direct them to each other") LEAVE THE SURFACE in the same turn:
// the 2026-08-27 sentence names the four buses in a line and the groups are
// not in it. Their vocabulary stays (fields.js BUSROWS, busRoute — an old save
// with a `room` send or an aim loads and sounds exactly as it did), the wire
// stays proven (desk-gate G14 model checks), and nothing here draws a control
// for them — a fact can rest in the record without a knob, but a knob may
// never point at nothing.
//
// THE MODEL WAS NEVER LOST — audio/desk.js answers what every control is worth
// in the parent engine; fields.js is the vocabulary for saying it. Nothing in
// this file computes a mix number: it draws the ones desk.js resolves and
// writes the document's own words back through nukernel/desk-doc.js. If a
// number here disagrees with the tape, this file is reading the wrong
// function, never doing its own arithmetic.
//
// ONE WRITABLE OWNER PER FACT (FUTURE.md, the one-board decision), AND THE
// OWNER MOVED HOUSE ON 2026-08-28 WITHOUT BEING COPIED. It read: "the board is
// now the ONLY place a hand touches gain/send/eq/insert facts. The engineer's
// rows inside a voice's sheet (VIEW 1 below) became READ-ONLY MIRRORS the same
// day — they print the value and point here." Paul: *"You were supposed to
// remove the voices from the mixing board and just put them as nav items in
// the voices themselves"*, and, on the menu rows that had been put there
// instead of the strip: *"when i get to the strip it is just a bunch of
// dropdowns instead of a nice strip and when I add effects they pop up without
// design. So that is a regression … add it in a new nav element called mix
// that is per voice."*
//
// SO THE LAW IS INTACT AND THE ADDRESS IS DIFFERENT: a voice's channel strip
// is drawn ONCE, by `channelStrip` in this file, on that voice's own `mix`
// facet (`voiceMix`, VIEW 1). The BOARD keeps what is record-level — the
// genre stage, the delay, the reverb, the main, and the section-automation
// grid, which is a cross-voice table and never was a strip. The mirror is
// DELETED rather than re-homed: a read-only copy beside the real control is
// the second owner this paragraph exists to forbid.
//
// AND THE INSTRUMENTS WENT INTO TABS the same evening — Paul, 2026-08-27: *"In
// the mixing board — Put the instruments inside tabs the mixing board instead
// of stacking them."* — AND THEN OUT OF THE BOARD ALTOGETHER on 2026-08-28,
// which is the reversal this file's THE VOICES LEFT THE BOARD block argues
// with the measurements that bought each step. Nothing about what a strip IS
// changed at either step: same rows, same keys, same writes. `#strips` is
// gone from the board and the `.nu-strips` class is worn by the voice.
//
// ...AND THEN THE BUSES AND THE MAIN JOINED THEM, later the same day, which
// REVERSES "THE RACK IS NOT A TAB" BY NAME. Paul, 2026-08-27: *"Put the
// effects buses and mains into special tabs after the voices -- now the board
// is one tabbed space that is consistent and easy to understand."* The
// paragraph that argued the rack out of the tabs is kept below, dated, with
// the measurement it stood on and the measurement that beat it (THE TAB ROW).
// WHAT MOVED, line for line and nothing else: the four `.nu-plate` bodies —
// genre, delay, reverb, main — are the same nodes with the same controls, the
// same `data-k` keys, the same refusal sentences and the same `data-live`
// declarations; what changed is that each is built by a function the tab row
// calls instead of being appended to a rack that was always on the page. The
// four `.nu-flow` connectors that stood BETWEEN the plates became each plate's
// own FOOTER (a plate says where it goes), except the first, whose sentence
// ("the strips send into every stage below") is now the tab row's own seam
// label — so no sentence was deleted, each moved to the one place it is still
// true. The section-automation word grid is a cross-voice table and stays
// outside the tabs, unmoved.
//
// LAWS CARRIED FORWARD, verbatim where they still bind:
//   * THE TRACK LIST IS THE SAME ANSWER THE AUDIO TIER BUILDS FROM —
//     desk-doc's channelVoicesOf, gated against voiceRoster by desk-gate G2.
//   * ABSENT IS THE ONLY SPELLING OF A DEFAULT — null/""/false/0/[] deletes
//     the key, and desk-doc.writeDesk is the one writer.
//   * DIM IS DERIVED, BRIGHT IS SET.
//   * A SILENT GREY IS THE BUG — a refusal is disabled AND carries its
//     sentence, `data-why` for the gate, printed on the page for the person.
//   * NEVER FAKE A MEASUREMENT (2026-08-27, this wave): the engine has ONE
//     master tap (audio/live.js rmsNow — every voice sums into shared buses),
//     so the MAIN strip's meter is green and measured, and a per-strip meter
//     well is REFUSED with that reason. The model's own number (liveGain) is
//     printed beside each fader, dim, labelled as the model.
import { NuFields, NuDeskDoc, GENRES, SENDS, SENDLABEL, LEVELS, LEVELLABEL,
         PANS, PANLABEL, FX, MAX_FX, EQ_BANDS, faderDb,
         MASTER_FIELDS, BUS_FIELDS } from "./deps.js";
const FXLABEL = NuFields.FXLABEL;
import { SONG, MASTER, BUSES, vol, setVol, commit } from "./state.js";
import { deskChannelBase, deskLevelAt, derivedPartTone, derivedTrim,
         masterState, deskBusFeed, MAIN_TO_BUS1, FIXED_EDGES } from "../audio/desk.js";
import { playing, playingSec, getPosition, passAt, rmsNow } from "../audio/live.js";
// WHAT THE ENGINE WILL DO WITH A CHANNEL — audio/plan.js channelFacts, and no
// table of this file's own, so the board's refusals and the renderer's are the
// same refusal. `stereo` is the one fact the insert slots ask for: the
// parent's insert path is MONO and audio/desk.js widthKept drops a wide
// unit's whole chain — under the 2026-08-27 architecture that silence is a
// REFUSAL ON THE SLOT, never a silent strip (FUTURE.md). FAIL OPEN before
// compile() has run: `{}` greys nothing, because a control that vanishes
// before boot is worse than one that is briefly optimistic, and widthKept
// drops the chain anyway.
import { channelFacts } from "../audio/plan.js";
import { gid } from "./derive.js";
// `sheet` CAME OFF THIS IMPORT 2026-08-27, with the one control on this page
// that took one. It drew the `master.fx` multiselect — the record's Character
// chips — and Paul retired it ("We can get rid of Character right? We don't
// really use it any more do we?"); the chain is dealt to each strip's own
// three insert slots, which are `selectEl` menus. ui/selects.js still exports
// `sheet` and ui/produce.js still calls it, so the widget lives; what ended is
// this file's need for it.
import { selectEl } from "./selects.js";
// THE MARKS ON THE TABS (2026-08-28). THIS FILE REFUSED THE GLYPHS ONCE AND
// SAID SO — see THE TAB ROW below: "THE GLYPHS STAY IN eight.js … copying
// three characters here would be that drift again, so a board tab wears the
// voice's NAME." That refusal was right about the hazard and wrong about the
// only available fix; Paul asked for marks on every tab row on the page
// (2026-08-28), so the table was EXTRACTED out of ui/eight.js into ui/glyph.js
// and this file reads the same three characters rather than copying them.
// `kindGlyph` AND `sayVoice` CAME OFF THIS LINE 2026-08-28, with the voice
// tabs (Paul: "remove the voices from the mixing board"). ui/glyph.js still
// exports both and ui/eight.js's gutter still calls them — one owner, still
// reachable; what ended is this file's need for them. `GLYPH` stays for the
// four bus marks and `icon`/`paintIcon` for the row that wears them.
import { GLYPH, icon, paintIcon } from "./glyph.js";

const el = (tag, text, cls) => { const n = document.createElement(tag);
  if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
const DD = () => NuDeskDoc;

function refuse(node, why, short) {
  node.disabled = true;
  node.setAttribute("aria-disabled", "true");
  node.title = why;
  node.dataset.why = why;
  const w = el("small", short || why); w.className = "nu-why";
  return w;
}

/* ---------- the level arithmetic, borrowed verbatim ----------------------- */
// main:mixtbl.js:395 — gainToF is the ONE place gain becomes fill/percent.
const F_LO = -36, F_HI = 12;
const gainToF = (g) => {
  const db = 20 * Math.log10(Math.max(1e-4, g));
  return Math.max(0, Math.min(1, (db - F_LO) / (F_HI - F_LO)));
};
const fmtDb = (v) => (v > 0 ? "+" : "") + v.toFixed(1);

// WHICH BOX THE NUMBERS ARE READ AGAINST: the sounding one while the transport
// runs, the first otherwise.
const atBox = () => SONG[playing && playingSec >= 0 ? playingSec : 0] || SONG[0] || null;
// WHAT THE ENGINE WILL DO WITH EACH CHANNEL, at the sounding box. Hoisted to
// module scope 2026-08-28 with the strip (it was a const inside `mount()`), so
// the one drawing can be built from either caller. FAIL OPEN before compile()
// has run, for the reason the import comment gives: `{}` greys nothing,
// because a control that vanishes before boot is worse than one that is
// briefly optimistic.
const factsNow = () => { try {
  return channelFacts(playing && playingSec >= 0 ? playingSec : 0) || {};
} catch (e) { return {}; } };
// THE LIVE GAIN — the MODEL: resolved static gain × the box's level automation
// at the playhead. Same arithmetic audio/desk.js hands the engine per note.
function liveGain(sec, key) {
  if (!sec) return 1;
  const g = deskChannelBase(sec, key).gain;
  if (!playing) return g;
  let f = 0;
  try { f = passAt(getPosition().now).f; } catch (e) { f = 0; }
  return g * deskLevelAt(sec, f);
}

/* ---------- the words a bus is called ------------------------------------- */
const busName = (bus) => NuFields.busNameOf(BUSES, bus);
function returnShut() {
  const st = masterState(MASTER, BUSES);
  return !st || !(st.reverb > 0);
}
function genreAsk(sec) {
  const g = (sec && GENRES[gid(sec)]) || {};
  const v = g.tone && g.tone.verb != null ? g.tone.verb : 0.15;
  return "the genre asks " + v;
}

/* ---------- THE FOUR SENDS OF A STRIP (2026-08-27) ------------------------
   one-board.html: genre → delay → reverb → main, tapped post-insert. Three are
   live and one is refused, and the split is the ENGINE's, not taste:
     * delay and reverb ARE today's per-unit u.del / u.rev (fields.js `echo` /
       `rev` — "the sends are real and already post-insert", one-board §IV.3;
       the insert chain runs in the unit's own buffer BEFORE the bus taps, so
       the tap is genuinely post-insert: stream-renderer runChain, then the
       rev/del sums).
     * the GENRE send WAS refused and is LIVE as of 2026-08-27 (the series-bus
       engine round). The refusal read: "fx_bus.dsp has no genre stage ahead
       of the delay, so nothing this page writes can put a signal into one…
       a live slider here today would be a knob that lies." True the day it
       was written; the engine round built the stage — a fifth accumulator in
       BOTH renderers (`u.genre` at the same three send sites as u.rev/u.del),
       its chained return summed into the DELAY bus at the rack's level — so
       the slider is now a wire, proven on rendered samples by
       test/series-bus.test.js (spectrum moves; kill the delay return and the
       genre contribution dies with it — series, not a side door to main).
     * the MAIN send is refused: the dry path to the main IS the fader, and a
       second gain on the same wire is two owners of one fact.
   The refusal still standing is drawn (never live-and-dead, never missing)
   with its sentence, per the standing law. */
const MAINSEND_WHY = "the dry path to the main is the fader below — one owner " +
  "per fact, so this send is parked rather than drawn as a second gain on the " +
  "same wire";
// THE BLEED WAS REFUSED and is LIVE as of 2026-08-27 (same round). The refusal
// read: "the bleed is a constant in the DSP — not wired: fx_bus.dsp:221 runs
// the delay into the reverb at the literal 0.2 (`d*0.2`)… a .dsp edit plus a
// recompile plus the byte-parity gates, which is not this page's to take."
// The engine round took it: `bleed` is an fx_bus slider now (default 0.2 = the
// literal, byte-identical at the default on two pressed records), rev_bleed
// mirrors it for colored rooms, and buses.echo.bleed (fields.js EBLEEDS) is
// the hand — masterState -> state.bleed -> fxParams.
const METER_WHY = "one master tap — the engine sums every voice into shared " +
  "buses (render-core.js), so there is no per-channel signal to measure; the " +
  "dim number beside the fader is the MODEL's gain, and a green bar here " +
  "would be a fake measurement";
const STEREO_WHY = "this voice is stereo — the parent's insert path is mono " +
  "and a chain would fold its width to one channel (audio/desk.js widthKept), " +
  "so the seats are refused rather than silently stripped";
const SWEEP_WET_WHY = "filter sweep is serial — the module declares no mix " +
  "param (a swept resonant lowpass is a replacement, not a blend), so there " +
  "is no wet to move";

/* ---------- reading and writing one strip --------------------------------- */
const deskOf = (voice) => (voice && voice.desk) || {};
function setDesk(ctx, voice, key, v) {
  DD().writeDesk(voice, key, v);
  ctx.changed();
}

// THE STANDING ANSWER IS ALWAYS OFFERED; THE EMPTY DETENT IS AN OPTION and the
// word for it is `default`, everywhere (Paul, 2026-08-26: "just use 'default'
// for 'nothing set'").
function optionsFor(table, labels, cur, gate, emptyLabel) {
  const head = [{ value: "", label: emptyLabel, group: "default" }];
  return head.concat(Object.keys(table).map((k) => {
    const g = gate ? gate(k) : null;
    const isCur = String(cur) === k;
    if (g && isCur)
      return { value: k, label: (labels && labels[k]) || k, group: "as you say",
               quiet: true, why: g + ", and it is what the record says" };
    return { value: k, label: (labels && labels[k]) || k,
             group: "as you say",
             ...(g ? { disabled: true, why: g } : {}) };
  }));
}

/* ================== THE VERTICAL SLIDER =====================================
   Replaces every knob and every horizontal range on the board (Paul,
   2026-08-27: "Don't use knobs. Have simple vertical sliders stacked and
   labeled"). Two native facts, one gesture law:
     * the <input type=range> is the KEYBOARD AND SCREEN-READER CHANNEL — it
       keeps `data-k` (so desk-gate drives it and focus survives a redraw),
       `aria-label`, `aria-valuetext`, and arrow keys move it natively. It sits
       over the track at opacity 0 with `pointer-events: none`.
     * the TRACK owns the pointer: `setPointerCapture` on pointerdown, value
       computed against the track's own rect, `touch-action: none` ON THE
       CONTROL AND ONLY THE CONTROL (nu.css .nu-vs-track) — the page keeps its
       scroll everywhere else. `change` fires on pointerup, exactly as a
       native range does, so every existing write path is untouched.
   THE DETENTED KIND is knob()'s own arithmetic stood upright: the words of a
   fields.js SCALE in value order with the blank detent spliced AT ITS OWN
   NUMBER's place (a send's blank sits beside `dry` at 0; `place`'s sits at
   centre), aria-valuetext kept in step with the printed word by one function.
   Numeric tables only — a slider over an unordered set is a lie about the
   shape of the thing, which is why the master's words stay <select>s. */
const ZERO_STRIP = NuFields.resolvePartMix({});
const RESOLVES_TO = { rev: "rev", echo: "del", room: "room", aux: "aux",
                      genre: "genre", pan: "pan", lvl: "lvl" };
function detentsOf(field, table, labels, emptyLabel, dfltOverride) {
  const dflt = dfltOverride != null ? dfltOverride
    : (ZERO_STRIP[RESOLVES_TO[field]] || 0);
  const d = Object.keys(table)
    .filter((x) => Number.isFinite(table[x]))
    .sort((a, b) => table[a] - table[b])
    .map((x) => ({ v: x, w: (labels && labels[x]) || x, n: table[x] }));
  if (d.length !== Object.keys(table).length)
    console.error("engineer: detentsOf(" + field + ") got a table that is not a scale");
  let i = 0;
  while (i < d.length && d[i].n < dflt) i++;
  d.splice(i, 0, { v: "", w: emptyLabel == null ? "default" : emptyLabel, n: dflt });
  return d;
}

// the shared vertical chassis: track + fill + thumb + the hidden input.
// `paint` maps input.value -> fill fraction; callers wire input/change.
// EXPORTED 2026-08-29, and that is the only edit this round made to this file.
// Paul: *"The volume slider is now vertical."* The room fader moved into the
// gutter (ui/eight.js, THE FIVE CONTROLS) and it is THIS control stood in a
// 56px column, not a second one — so the touch law above keeps one owner
// instead of acquiring a copy that drifts the first time either is fixed.
export function vchassis(input, frac) {
  const track = el("span", null, "nu-vs-track");
  const fill = el("i", null, "nu-vs-fill");
  const thumb = el("b", null, "nu-vs-thumb");
  track.append(fill, thumb, input);
  const paint = () => {
    const f = Math.max(0, Math.min(1, frac()));
    track.style.setProperty("--v", f.toFixed(4));
  };
  input.addEventListener("input", paint);
  const fromPointer = (e) => {
    const r = track.getBoundingClientRect();
    const min = +input.min, max = +input.max, step = +input.step || 1;
    const pad = 12;                       // the thumb's half-height
    const usable = r.height - pad * 2;
    let f = usable > 0 ? (r.bottom - pad - e.clientY) / usable : 0;
    f = Math.max(0, Math.min(1, f));
    let val = min + f * (max - min);
    val = Math.max(min, Math.min(max, Math.round(val / step) * step));
    const dec = (String(step).split(".")[1] || "").length;
    input.value = val.toFixed(dec);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  track.addEventListener("pointerdown", (e) => {
    if (input.disabled) return;
    e.preventDefault();
    try { track.setPointerCapture(e.pointerId); } catch (err) {}
    input.focus({ preventScroll: true });
    fromPointer(e);
  });
  track.addEventListener("pointermove", (e) => {
    if (track.hasPointerCapture && track.hasPointerCapture(e.pointerId)) fromPointer(e);
  });
  track.addEventListener("pointerup", (e) => {
    if (track.hasPointerCapture && track.hasPointerCapture(e.pointerId)) {
      try { track.releasePointerCapture(e.pointerId); } catch (err) {}
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  paint();
  return { track, paint };
}

// ONE DETENTED VERTICAL SLIDER over a fields.js scale. Writes the WORD (or
// null for the blank detent — absent is the only spelling of a default).
function vknob(k, field, table, labels, cur, aria, set, emptyLabel, dflt, tall) {
  const d = detentsOf(field, table, labels, emptyLabel, dflt);
  const input = document.createElement("input");
  input.type = "range"; input.min = "0"; input.max = String(d.length - 1);
  input.step = "1"; input.className = "nu-vs-in";
  let at = d.findIndex((x) => x.v === (cur == null ? "" : String(cur)));
  if (at < 0) at = d.findIndex((x) => x.v === "");
  input.value = String(at);
  input.dataset.k = k;
  input.setAttribute("aria-label", aria);
  const out = el("output", d[at].w, "nu-vs-val");
  const say = (n) => { out.textContent = d[n].w;
                       input.setAttribute("aria-valuetext", d[n].w); };
  say(at);
  input.addEventListener("input", () => say(+input.value));
  input.addEventListener("change", () => set(d[+input.value].v || null));
  const { track } = vchassis(input, () =>
    (+input.value) / Math.max(1, d.length - 1));
  const wrap = el("span", null, "nu-vs" + (tall ? " nu-vs-tall" : ""));
  wrap.append(track, out);
  return wrap;
}

// ONE NUMERIC VERTICAL SLIDER (the fader, the EQ bands, the record gain).
function vnum(k, opts) {
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(opts.min); input.max = String(opts.max);
  input.step = String(opts.step); input.className = "nu-vs-in";
  input.value = String(opts.value);
  input.dataset.k = k;
  input.setAttribute("aria-label", opts.aria);
  const fmt = opts.fmt || ((v) => String(v));
  const out = el("output", fmt(+input.value), "nu-vs-val");
  input.addEventListener("input", () => { out.textContent = fmt(+input.value); });
  if (opts.onInput) input.addEventListener("input", () => opts.onInput(+input.value));
  input.addEventListener("change", () => opts.set(+input.value));
  const { track } = vchassis(input, () =>
    (+input.value - opts.min) / (opts.max - opts.min));
  const wrap = el("span", null, "nu-vs" + (opts.tall ? " nu-vs-tall" : ""));
  wrap.append(track, out);
  return wrap;
}

// A REFUSED SLIDER: drawn, disabled, its sentence on it and beside it — never
// live-and-dead, never missing (the wave's own words: "refused with their
// reasons ... never live-and-dead").
function vrefused(k, aria, short, why, tall) {
  const input = document.createElement("input");
  input.type = "range"; input.min = "0"; input.max = "1"; input.value = "0";
  input.className = "nu-vs-in";
  if (k) input.dataset.k = k;
  input.setAttribute("aria-label", aria + " (refused)");
  const w = refuse(input, why, short);
  const { track } = vchassis(input, () => 0);
  track.classList.add("is-off");
  const wrap = el("span", null, "nu-vs is-off" + (tall ? " nu-vs-tall" : ""));
  wrap.append(track, w);
  return wrap;
}

// a labelled column: the label over the control (the sketch's .vslider shape)
function col(label, control, cls) {
  const w = el("span", null, "nu-vcol" + (cls ? " " + cls : ""));
  w.append(el("span", label, "nu-vs-lab"), control);
  return w;
}

/* ================== THE INSERT SLOTS (2026-08-27) ==========================
   "Add per voice effects, up to three. Each has a wet dry mix and its own
   settings." The seats write `voice.desk.fx` (the list, MAX_FX, the exact
   shape song.js's loader has always validated); the wet is the chip's OWN mix
   param surfaced (fields.js FXWETS -> params.mix, clamped by the parent's own
   insertChain), and the one-or-two settings are the module's own face params
   (FXFACE, ranges read off engine/faust/dist insert_*-meta.json). A chip
   changed in a seat RESETS that seat's knobs — a fraction of another module's
   range is not a value, it is a coincidence. */
function slotsOf(voice) {
  const d = deskOf(voice);
  const keys = (d.fx || []).filter((k) => FX[k]).slice(0, MAX_FX);
  return keys.map((k, i) => ({ k,
    w: d["fxw" + (i + 1)] || null,
    a: d["fxa" + (i + 1)] || null,
    b: d["fxb" + (i + 1)] || null }));
}
function writeSlots(ctx, voice, slots) {
  const D = DD();
  D.writeDesk(voice, "fx", slots.length ? slots.map((s) => s.k) : null);
  for (let n = 1; n <= MAX_FX; n++) {
    const s = slots[n - 1] || {};
    D.writeDesk(voice, "fxw" + n, s.w || null);
    D.writeDesk(voice, "fxa" + n, s.a || null);
    D.writeDesk(voice, "fxb" + n, s.b || null);
  }
  ctx.changed();
}
// one seat's <select>: default "—" + the FX vocabulary. Keyed `ins|voice|n`.
function seatSelect(ctx, voice, slots, i, why) {
  const sel = document.createElement("select");
  sel.dataset.k = "ins|" + voice.name + "|" + (i + 1);
  sel.setAttribute("aria-label", voice.name + " insert " + (i + 1));
  const cur = slots[i] ? slots[i].k : null;
  const og0 = document.createElement("optgroup"); og0.label = "default";
  const o0 = document.createElement("option");
  o0.value = ""; o0.textContent = "—"; o0.selected = !cur;
  og0.append(o0); sel.append(og0);
  const og1 = document.createElement("optgroup"); og1.label = "as you say";
  const taken = slots.map((s, j) => (j === i ? null : s.k));
  for (const k of Object.keys(FX)) {
    const o = document.createElement("option");
    o.value = k; o.textContent = FXLABEL[k] || k;
    if (k === cur) o.selected = true;
    // A CHIP SEATS ONCE PER STRIP: the list is a chain and the same pedal
    // twice in it is the same pedal once, louder about it.
    if (taken.includes(k)) { o.disabled = true;
      o.dataset.why = "already seated in another slot"; }
    og1.append(o);
  }
  sel.append(og1);
  sel.className = cur ? "said" : "seated";
  let whyEl = null;
  if (why) whyEl = refuse(sel, why, "refused");
  sel.addEventListener("change", () => {
    const word = sel.value || null;
    const next = slots.slice();
    if (!word) { if (i < next.length) next.splice(i, 1); }
    else if (i < next.length) next[i] = { k: word, w: null, a: null, b: null };
    else next.push({ k: word, w: null, a: null, b: null });
    writeSlots(ctx, voice, next);
  });
  return { sel, whyEl };
}
// one whole slot: seat + wet + the chip's own one-or-two settings
function slotEl(ctx, voice, slots, i, stereoWhy) {
  const box = el("div", null, "nu-slot" + (slots[i] ? "" : " is-empty"));
  box.dataset.slot = String(i + 1);
  const row = el("div", null, "nu-slotrow");
  row.append(el("b", String(i + 1), "nu-slotn"));
  const { sel, whyEl } = seatSelect(ctx, voice, slots, i, stereoWhy);
  row.append(sel);
  box.append(row);
  if (whyEl) { box.append(whyEl); box.classList.add("is-off"); return box; }
  // "no effect seated" DELETED 2026-08-27 (text diet): the seat's own select
  // already prints "—", and a caption repeating a control's value is a second
  // owner of it. `.is-empty` on the box keeps the visual quiet.
  const s = slots[i];
  if (!s) return box;
  const body = el("div", null, "nu-slotbody");
  const n = i + 1;
  // THE WET IS THE CHIP'S OWN MIX PARAM, SURFACED — or refused where the
  // module has none (fields.js fxHasMix: only `sweep`, whose sentence is on
  // the control itself — `title`, `data-why` and the short word beside it —
  // since the page-foot digest was deleted 2026-08-28).
  if (NuFields.fxHasMix(s.k)) {
    const dfltMix = NuFields.fxMix(s.k);
    body.append(col("wet", vknob("b|fxw" + n + "|" + voice.name, null,
      NuFields.FXWETS, NuFields.FXWETLABEL, s.w,
      voice.name + " insert " + n + " wet",
      (v) => setDesk(ctx, voice, "fxw" + n, v), "default", dfltMix)));
  } else {
    body.append(col("wet", vrefused(null, voice.name + " insert " + n + " wet",
      "serial", SWEEP_WET_WHY)));
  }
  // ...AND ITS OWN SETTINGS: the module's declared face params, in the
  // module's own units (fields.js FXFACE, off the dist manifests), as
  // fractions of their own span so one detent table serves every chip.
  const face = NuFields.FXFACE[s.k] || [];
  const dfltFrac = (spec) => {
    const dv = FX[s.k].params[spec.key];
    if (dv == null) return 0;
    return Math.max(0, Math.min(1, (dv - spec.min) / (spec.max - spec.min)));
  };
  if (face[0]) body.append(col(face[0].label,
    vknob("b|fxa" + n + "|" + voice.name, null, NuFields.FXPOTS,
      NuFields.FXPOTLABEL, s.a, voice.name + " " + s.k + " " + face[0].label,
      (v) => setDesk(ctx, voice, "fxa" + n, v), "default", dfltFrac(face[0]))));
  if (face[1]) body.append(col(face[1].label,
    vknob("b|fxb" + n + "|" + voice.name, null, NuFields.FXPOTS,
      NuFields.FXPOTLABEL, s.b, voice.name + " " + s.k + " " + face[1].label,
      (v) => setDesk(ctx, voice, "fxb" + n, v), "default", dfltFrac(face[1]))));
  box.append(body);
  return box;
}

/* ================== ONE CHANNEL STRIP, ONE DRAWING ========================
   LIFTED OUT OF `mount()` 2026-08-28, and the lift is the whole of the round.
   Paul, correcting the previous one: *"In the voice -- add another nav item
   for the mixing and give it a channel design like the mixer; it is confusing
   now and when i get to the strip it is just a bunch of dropdowns instead of a
   nice strip and when I add effects they pop up without design. So that is a
   regression but it is easy to revert to the design and add it in a new nav
   element called mix that is per voice."* And, in the same breath: *"You were
   supposed to remove the voices from the mixing board and just put them as nav
   items in the voicers / in the voices themselves."*

   WHAT WAS WRONG, and it was not the geometry — it was the SECOND DRAWING.
   ui/eight.js `voiceSound` rebuilt this strip's facts (three insert seats plus
   their wets and face pots, five sends, pan, level, the fader, four EQ bands,
   mute and solo) as rows of <select>s and horizontal ranges on the voice's
   `instrument` facet, while THIS file already drew them as a console: vertical
   faders in a trough, insert SLOTS with their own wet and face pots, the four
   sends side by side, five pan detents, mute and solo. Two drawings of one
   fact, and the ugly one was where Paul was standing.

   SO THERE IS ONE DRAWING NOW AND IT LIVES HERE. This function is the body of
   what was `const stripOf = (c) => …` inside `mount()`, LINE FOR LINE — same
   rows in the same order, same `data-k` keys, same refusal sentences, same
   `data-live` declarations, same writes through the one writer
   (NuDeskDoc.writeDesk, via `setDesk`). What changed is that it is a module
   function two callers share instead of a closure one caller had, and the five
   facts it read off `mount()`'s scope are an `env` argument:

     anySolo · is any voice on this record soloed (this one dims if not it)
     sec     · which box the derived numbers are read against (`atBox`)
     shut    · is the reverb return shut (the send's label says so)
     facts   · audio/plan.js channelFacts — `stereo` refuses the insert seats
     drives  · the list of model readouts the caller's paint() repaints

   THE VOICE IS THE ONLY CALLER OF THE STRIP NOW. `mount()` below keeps the
   BUSES — the genre stage, the delay, the reverb, the main and the section
   automation grid — and draws no voice at all; `voiceMix()` above draws this
   strip inside the voice it belongs to. One strip, one home. */
export function channelStrip(ctx, c, env) {
  const voice = c.voice, key = c.key, d = deskOf(voice);
  const off = env.anySolo && !d.solo;
  const strip = el("article", null, "nu-strip" + (off || d.mute ? " is-off" : ""));
  strip.dataset.ch = key;
  strip.setAttribute("aria-label", voice.name + " strip");
  const head = el("header");
  head.append(el("b", voice.name, "nu-sname"));
  head.append(el("small", (voice.instrument || voice.kind || "") + " · " + key));
  strip.append(head);

  // ---- inserts: up to three, in order --------------------------------
  // `nu-srow-ins`: the three slots sit SIDE BY SIDE in the width the tab
  // bought, and stack again under ~460px (nu.css).
  const srow1 = el("div", null, "nu-srow nu-srow-ins");
  srow1.append(el("p", "inserts · up to three · in order", "nu-rowlab"));
  const stereoWhy = env.facts[key] && env.facts[key].stereo ? STEREO_WHY : null;
  const slots = slotsOf(voice);
  for (let i = 0; i < MAX_FX; i++)
    srow1.append(slotEl(ctx, voice, slots, i, stereoWhy));
  strip.append(srow1);

  // ---- sends: four, post-insert --------------------------------------
  const srow2 = el("div", null, "nu-srow");
  srow2.append(el("p", "sends · post-insert", "nu-rowlab"));
  const sends = el("div", null, "nu-sends");
  // UN-REFUSED 2026-08-27 (the series-bus engine round). This column was
  // drawn refused — "the genre bus is engine work — not wired" — and the
  // engine work happened: fx_bus grew nothing, the RENDERERS grew a fifth
  // accumulator (stream-renderer/press `gen`) whose chained return sums into
  // the DELAY bus, so the send is a real wire: genre → delay → reverb →
  // main. The word is desk `genre` (fields.js PARTMIX, SENDS family).
  sends.append(col("genre", vknob("b|genre|" + voice.name, "genre",
    SENDS, SENDLABEL, d.genre, voice.name + " send to the genre bus",
    (v) => setDesk(ctx, voice, "genre", v), "default")));
  sends.append(col(busName("echo"), vknob("b|echo|" + voice.name, "echo",
    SENDS, SENDLABEL, d.echo, voice.name + " send to " + busName("echo"),
    (v) => setDesk(ctx, voice, "echo", v), "default")));
  const revK = vknob("b|rev|" + voice.name, "rev",
    SENDS, SENDLABEL, d.rev, voice.name + " send to " + busName("rev"),
    (v) => setDesk(ctx, voice, "rev", v), "default");
  { const inp = revK.querySelector("input");
    inp.title = genreAsk(env.sec) + "; a part send adds to it, so absent adds nothing"; }
  sends.append(col(busName("rev") + (env.shut ? " (shut)" : ""), revK));
  sends.append(col("main", vrefused("b|main|" + voice.name,
    voice.name + " send to the main", "the fader's", MAINSEND_WHY)));
  srow2.append(sends);
  strip.append(srow2);

  // ---- eq -------------------------------------------------------------
  const srow3 = el("div", null, "nu-srow");
  srow3.append(el("p", "eq", "nu-rowlab"));
  const eqrow = el("div", null, "nu-sends");
  for (const b of EQ_BANDS) {
    eqrow.append(col(b.label.replace(/^eq\s*/, ""), vnum("b|eq" + b.key + "|" + voice.name, {
      min: -12, max: 12, step: 0.5, value: (d.eq && d.eq[b.key]) || 0,
      aria: voice.name + " " + b.label, fmt: (v) => fmtDb(v),
      set: (v) => {
        const next = { ...(deskOf(voice).eq || {}) };
        next[b.key] = v;
        setDesk(ctx, voice, "eq", next);
      } })));
  }
  srow3.append(eqrow);
  strip.append(srow3);

  // ---- pan: a left/right fact, five detents --------------------------
  // BUTTONS AND NOT A SLIDER, per the sketch's own panrow: five stops is a
  // detent row a thumb can hit, and `place` was the collision the rename
  // table killed ("pan — the one universal word"). Tapping the stop the
  // record is on CLEARS it — absent is the only spelling of a default, and
  // there is no other way to spell it with buttons.
  const srow4 = el("div", null, "nu-srow");
  srow4.append(el("p", "pan", "nu-rowlab"));
  const panrow = el("div", null, "nu-panrow");
  panrow.setAttribute("role", "group");
  panrow.setAttribute("aria-label", voice.name + " pan");
  const marks = { l: "L", hl: "l", c: "C", hr: "r", r: "R" };
  const cur = d.pan || null;
  const word = el("p", cur ? (PANLABEL[cur] || cur) : "default",
    "nu-panword" + (cur ? "" : " is-dflt"));
  for (const p of Object.keys(PANS)) {
    const b = el("button", marks[p], "nu-panbtn");
    b.type = "button";
    b.dataset.k = "b|pan|" + voice.name + "|" + p;
    b.setAttribute("aria-label", voice.name + " pan " + (PANLABEL[p] || p));
    const on = cur ? cur === p : p === "c";
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.addEventListener("click", () =>
      setDesk(ctx, voice, "pan", cur === p ? null : p));
    panrow.append(b);
  }
  srow4.append(panrow, word);
  strip.append(srow4);

  // ---- the fader ------------------------------------------------------
  const srow5 = el("div", null, "nu-srow");
  srow5.append(el("p", "fader", "nu-rowlab"));
  const fw = el("div", null, "nu-fadwrap");
  const fout = { o: null };
  const fader = vnum("b|fader|" + voice.name, {
    min: -24, max: 12, step: 0.5, value: faderDb(d.fader),
    aria: voice.name + " fader", tall: true, fmt: (v) => fmtDb(v),
    set: (v) => setDesk(ctx, voice, "fader", v) });
  fw.append(col("level", fader));
  // THE METER WELL, REFUSED — never fake a measurement (the header's law).
  fw.append(col("meter", vrefused(null, voice.name + " meter",
    "no tap", METER_WHY, true)));
  const duo = el("div", null, "nu-duo");
  // mute/solo WEAR THEIR OWN NAMES since 2026-08-27 (FUTURE.md §5: "cut"
  // collided with EQ cut three rows up; the desk keys were always mute/solo,
  // so the buttons stop translating them).
  for (const [k2, label] of [["mute", "mute"], ["solo", "solo"]]) {
    const b = el("button", label, "nu-tgl");
    b.type = "button";
    b.dataset.k = "b|" + k2 + "|" + voice.name;
    b.setAttribute("aria-label", voice.name + " " + label);
    b.setAttribute("aria-pressed", d[k2] ? "true" : "false");
    b.addEventListener("click", () => setDesk(ctx, voice, k2, !deskOf(voice)[k2]));
    duo.append(b);
  }
  // the MODEL's number, dim and labelled as the model — what desk.js says
  // is driving the channel right now, repainted per beat by paintBoard.
  // `data-live` because the clock writes it: a surface the transport feed
  // repaints declares itself (the trim grid's own law, below), and the
  // wave-3 artifact drive watches the WHOLE page with a MutationObserver —
  // an undeclared clock write is the finding it exists for.
  const drive = el("small", "", "nu-drive nu-hint");
  drive.dataset.live = "model";
  drive.title = "the model: deskChannelBase().gain × the box's level automation";
  duo.append(drive);
  env.drives.push({ el: drive, key });
  fw.append(duo);
  srow5.append(fw);
  strip.append(srow5);

  const goes = el("p", null, "nu-goes");
  goes.append(document.createTextNode("→ "));
  goes.append(el("b", busName("genre") + " · " + busName("echo") + " · " +
    busName("rev") + " · main"));
  strip.append(goes);
  return strip;
}

/* ============ VIEW 1 · THE VOICE'S OWN MIX — THE STRIP, AT HOME ===========
   Paul, 2026-08-28: *"add another nav item for the mixing and give it a
   channel design like the mixer … add it in a new nav element called mix that
   is per voice"*, and *"You were supposed to remove the voices from the mixing
   board and just put them as nav items in the voices themselves."*

   THIS IS THE VOICE'S `mix` FACET (ui/eight.js FACETS, the gutter's `voice`
   level). It draws `channelStrip` at full size — the same console the board
   drew, with its insert SLOTS, its four sends, its EQ, its pan detents and its
   fader — inside the player it belongs to. It is the ONE drawing of those
   facts on the page: the board keeps no strip, and `voiceSound`'s menu rows
   are deleted (their tombstone is at their old site in ui/eight.js).

   ===== WHAT STOOD HERE, AND WHY IT IS GONE ===============================
   `export function engineer(parent, ctx, voiceName)` — a `.nu-eng.nu-mirror`
   table of eleven rows, "read-only — set it on the board", bright where the
   record named a word and dim where the answer was derived, with a third
   column saying what each value was RIDING ON (`derivedPartTone`,
   `deskChannelBase` read at the sounding box). It was two writers until
   2026-08-27 (the one-board round made it a mirror) and it lost its last
   caller on 2026-08-28, when Paul asked for the controls themselves in the
   voice: *"get rid of the engineer table and simply move the sound controls
   out of the mixer and into this section."* ui/eight.js tombstoned the call
   that night and named the deletion of this function as the follow-up; this
   is that deletion, and the mirror's own argument is answered rather than
   overruled — the real strip is here now, so a read-only copy of it beside
   the real thing would be the third drawing of one fact.

   THE THIRD COLUMN IS STILL THE ONE REAL LOSS and it is still named so it can
   come back: "riding −2.5 dB seated" beside an EQ band, "the record seats it
   at −6.0 dB" beside the level. That is a READING and not a control, so it
   belongs as the `nu-hint` half of the strip's own rows rather than as a
   table of its own. It is in this round's report, with its two functions.

   A VOICE WITH NO CHANNEL HAS NO STRIP, and it says so rather than drawing an
   empty console: `channelVoicesOf` is the desk's own roster walk (G2's law)
   and it drops a kit nobody has hired, so the refusal carries the measured
   reason exactly as a greyed knob does. */
export function voiceMix(parent, ctx, voiceName) {
  const doc = ctx.doc();
  const chans = DD().channelVoicesOf(doc, GENRES);
  const c = chans.find((x) => x.voice.name === voiceName);
  if (ctx.heading) ctx.heading(parent, "mix");
  else parent.append(el("h3", "mix"));
  if (!c) {
    const w = el("p", voiceName + " has no channel on this record — the desk " +
      "seats a kit only once it is hired (desk-doc channelVoicesOf), so there " +
      "is no strip to draw rather than an empty one", "nu-why");
    parent.append(w);
    MIX = null;
    return;
  }
  const env = { anySolo: chans.some((x) => deskOf(x.voice).solo),
                sec: atBox(), shut: returnShut(), facts: factsNow(),
                drives: [] };
  // `.nu-strips` AND NOT `#strips`. The class is the skin (nu.css, the grid
  // and the 100% width Paul asked every table and grid for on 2026-08-28);
  // the ID belonged to the board's panel and stays there, because two nodes
  // wearing one id is the bug a gate cannot see round. Keyed for the gates and
  // for a person's own muscle memory as `#voicemix`, which is what this is.
  const host = el("div", null, "nu-strips");
  host.id = "voicemix";
  host.setAttribute("aria-label", voiceName + " strip");
  host.append(channelStrip(ctx, c, env));
  parent.append(host);
  // WHERE IT GOES, said on the voice as well as on the board. The strip's own
  // footer already draws the four destinations (`.nu-goes`); this is the way
  // to the plates that answer for them, and it is a LINK and not a copy of
  // their controls — one owner per fact, and the buses' owner is the board.
  const go = el("p", null, "nu-hint");
  const a = document.createElement("a");
  a.href = "#board"; a.textContent = "the buses this feeds are on the board";
  go.append(a);
  parent.append(go);
  // the model readout under the fader is written once a beat by the page's own
  // `on("pos")` feed — see `paintVoiceMix`, and the [data-live] law on the
  // `.nu-drive` element itself.
  MIX = { drives: env.drives, host };
  sayDrives(env.drives);            // the first reading, before the first beat
}

/* WHICH VOICE STRIP IS ON THE PAGE, if any. A page fact, never a document one,
   and it is REPLACED rather than accumulated: ui/eight.js rebuilds the Band
   panel on every edit, so the handle a stale draw left behind points at
   detached nodes. `paintVoiceMix` tests `isConnected` rather than trusting
   this, because a facet change or a tab change can orphan it between beats. */
let MIX = null;


/* ======================= VIEW 2 · THE ONE BOARD =========================== */
let CURRENT = null;
// WHICH TAB IS OPEN (2026-08-27, Paul: "In the mixing board — Put the
// instruments inside tabs the mixing board instead of stacking them", and,
// later the same day, "Put the effects buses and mains into special tabs after
// the voices -- now the board is one tabbed space").
// A PAGE FACT, never a document one — the same sentence ui/eight.js makes about
// its own `tab`: which tab you are looking at is not a fact about the record,
// so it is a module `let` here and there is no key for it anywhere in the
// document, in localStorage or in a share link. It survives a redraw because
// the module does.
// KEYED BY NAME, AND THE KIND IS PART OF THE NAME. It was a bare voice name
// until the buses joined the row; a bare string cannot tell a voice called
// `main` from the main plate, so the fact is a tagged pair — `{ kind: "voice",
// key: <voice name> }` or `{ kind: "bus", key: <bus key> }`. Still by NAME and
// never by index, for the reason the motif tabs give in their own file: the
// bank changes — add a voice, drop a voice, and index 2 is a different player;
// the bus keys are fields.js BUSROWS' own, which do not renumber either.
// EVERY TAB IN THIS ROW IS A BUS SINCE 2026-08-28 (see THE VOICES LEFT THE
// BOARD). The tagged pair STAYS — the `data-k` is `boardtab|bus|<key>` and
// three gates drive the row by it, and a key that changed shape because a kind
// went away would be an address moved for a reason that is not an address's.
let BOARDTAB = { kind: "bus", key: null };

export function mount(parent, ctx) {
  const host = ctx.section
    ? ctx.section(parent, "board", "The board")
    : (() => { const s = el("section"); s.className = "nu-ax"; s.id = "board";
               s.append(el("h2", "The board")); parent.append(s); return s; })();
  const doc = ctx.doc();
  const chans = DD().channelVoicesOf(doc, GENRES);
  const sec = atBox();
  const shut = returnShut();
  /* `anySolo`, `facts` AND `drives` LEFT THIS SCOPE WITH THE STRIPS,
     2026-08-28. All three were read by `stripOf` and by nothing else here:
     `anySolo` dimmed a strip that was not the soloed one, `facts` carried
     audio/plan.js's `stereo` so the insert seats could refuse, and `drives`
     collected the per-strip model readouts for paint(). They are the `env`
     `voiceMix` builds for `channelStrip` now (see ONE CHANNEL STRIP, ONE
     DRAWING). Grepped before deleting; nothing else in this function named
     them. `chans` STAYS — the section-automation grid below is a cross-voice
     table and has a column per channel. */
  // THE PLATES' OWN PAINT TARGETS. `let` rather than `const` because the panel
  // is rebuilt on a tab tap, so paint() must read the readouts of the plate
  // that is on the page NOW, not the ones that were there when mount() ran,
  // and showPanel() resets them.
  let busSays = [];             // { el, bus } — model in/out lines per plate
  let masterMeter = null;       // the ONE measured meter, on the main plate

  // COMPRESSED 2026-08-27 (the text diet, FUTURE.md §2: "signal flow is drawn
  // as arrows, not narrated"). It read 230 chars narrating the strip order the
  // strip's own row labels and footer arrows already draw; what stays is the
  // three-word legend no control carries.
  const note = el("p", "dim is derived · bright is set · green is measured",
    "nu-hint");
  host.append(note);

  /* ============= THE VOICES LEFT THE BOARD (2026-08-28) =================
     Paul, correcting the round that put them here: *"You were supposed to
     remove the voices from the mixing board and just put them as nav items in
     the voicers"* / *"in the voices themselves."* And, on what he found when
     he got to one: *"when i get to the strip it is just a bunch of dropdowns
     instead of a nice strip and when I add effects they pop up without design.
     So that is a regression … it is easy to revert to the design and add it in
     a new nav element called mix that is per voice."*

     SO THIS BOARD IS THE BUSES AND NOTHING ELSE: genre fx → delay → reverb →
     main, plus the section-automation grid, which is a CROSS-VOICE table and
     was never a strip. A voice's channel strip is drawn by `voiceMix` above,
     inside that voice, on its own `mix` facet — the SAME `channelStrip`
     function, so what Paul asked for ("give it a channel design like the
     mixer") is not a copy of the mixer's design, it IS the mixer's design.

     WHAT IS DELETED HERE, line for line: `const stripOf = (c) => …` (lifted
     whole to module scope, unchanged), the `names` list the voice tabs were
     built from, and the `#strips` branch of `showPanel`. The voices' `env`
     locals went with them (see the note where `chans` is read).

     WHAT IS KEPT, BECAUSE EVERY NUMBER IN IT WAS REAL. The argument that put
     the strips in tabs on 2026-08-27 — Paul: *"In the mixing board — Put the
     instruments inside tabs the mixing board instead of stacking them"* — was
     measured on the rendered page: seven stacked strips were 7,193px at 390
     and made a 16,608px document; one strip behind a tab was 1,007px and
     10,529px, "6,079px of queue gone". Then the buses joined the row (*"Put
     the effects buses and mains into special tabs after the voices -- now the
     board is one tabbed space that is consistent and easy to understand"*) and
     the panel became one strip OR one plate: 534/530/447/926px at 390 for
     genre / delay / reverb / main. NONE OF THAT IS WITHDRAWN — a tabbed panel
     is still what this board is, and the four plates are still the four tabs.
     What the voices leaving changes is the ROW, not the panel: the tabs are
     the series alone now, so the one queue that is left is four stages long
     and every one of them is a record-level fact, which is what the original
     "a record-level fact behind a per-voice gesture" worry was pointing at
     from the other side.

     THE SKIN IS UNCHANGED AND IS STILL THIS PAGE'S OWN: `<p class="nu-row">`
     of plain buttons carrying `aria-pressed`, a `<mark>` on the open one —
     the same idiom as `#nu-tray`'s levels and the motif tabs. The
     `.tab[aria-selected]` skin in nukernel/ideal was never shipped (grep for
     `class="tab"` answers 0, nu.css defines no `.tab` rule), and
     `aria-pressed` and `aria-selected` are not both sayable on one button.

     THE GLYPHS ARE ui/glyph.js's, ONE OWNER, and that stays true with the
     voices gone: the row reads `GLYPH.bus`, the voice's own facets read
     `GLYPH.facet`, and neither file spells a character the other one owns.

     WHICH TAB IS OPEN IS STILL A PAGE FACT AND STILL KEYED BY NAME. `BOARDTAB`
     is a module `let` — it survives every redraw (mount() runs on every edit)
     and is never written to the document, because which plate you are looking
     at is not a fact about the record. */
  // THE ONE PANEL (2026-08-27, the board tabs). It holds whichever tab is
  // open, which since 2026-08-28 is always a `.nu-rack` with one `.nu-plate`
  // in it — the strips left with the voices. `#rack` keeps its id, because it
  // is what the gates, the stylesheet and three years of muscle memory call
  // this furniture, and a rack of one plate is still the rack.
  const panel = el("div", null, "nu-boardpanel");
  panel.id = "boardpanel";

  /* ============= THE BUS PLATES · THE SERIES, ONE TAB EACH ==============
     one line, and it is still one line: genre → delay → reverb → main (Paul,
     2026-08-27: "Have one bus for genre specific effects, into a delay bus,
     into reverb, into main"). Each plate carries its REAL knobs and nothing
     else. The delay and reverb stages are fields.js BUSROWS bus 2 and bus 1 —
     the engine's own two accumulators — wearing the series' order.

     THE PLATES ARE FUNCTIONS NOW (2026-08-27, Paul: "Put the effects buses
     and mains into special tabs after the voices"). This block used to be a
     `const rack = el("div")` that four `{ … rack.append(p); }` blocks pushed
     plates onto, with `flow()` connectors between them; the four bodies below
     are those four blocks with `rack.append(p)` turned into `return p` and
     NOTHING ELSE TOUCHED — same controls, same `data-k` keys, same refusal
     sentences, same `data-live` declarations, same order of rows down a plate.

     WHERE THE CONNECTORS WENT, because a deleted sentence is a lost fact.
     There were four `.nu-flow` lines. Three sat BETWEEN plates and said where
     the plate above them goes — "into the delay bus", "into the reverb bus",
     "into main — the record" — so each is now the FOOTER of the plate whose
     output it describes, which is where it was always pointing. The fourth
     sat at the top of the rack and said "the strips send into every stage
     below"; with the rack behind tabs there is no "below", so that sentence
     is the tab row's own seam label (THE TAB ROW). The main plate takes no
     footer: its header already says `out → the speakers`, and it is the end
     of the line.

     ONE DEAD CONST WENT WITH THEM: `const feeds = deskBusFeed(sec, MASTER,
     BUSES)` stood at the top of the rack with zero readers (paint() computes
     its own `bf` once a beat). Grepped before deleting; nothing named it. */
  const flow = (label) => {
    const f = el("div", null, "nu-flow");
    f.setAttribute("aria-hidden", "true");
    f.append(el("i", null, "nu-tri"), el("span", label, "nu-flowlab"));
    return f;
  };
  const bv = (bus, k) => (doc.sound && doc.sound.buses && doc.sound.buses[bus]
    && doc.sound.buses[bus][k]) || "";
  const busSel = (busKey, spec) => selectEl({
    key: "bus|" + busKey + "|" + spec.key, label: spec.label,
    options: optionsFor(spec.table, spec.labels, bv(busKey, spec.key), null, "default"),
    value: bv(busKey, spec.key),
    set: (v) => { DD().writeBus(doc, busKey, spec.key, v); ctx.changed(); },
  });
  const labelled = (g, label, control) => {
    const p = el("p", null, "nu-sel");
    const lab = el("label");
    lab.append(el("span", label + " ", "nu-w"), control);
    p.append(lab); g.append(p);
    return p;
  };
  const knobOf = (busKey, key) =>
    BUS_FIELDS.find((b) => b.bus === busKey).knobs.find((k) => k.key === key);
  const PLATES = {};

  // -- the genre bus: the one genuinely new stage — WIRED 2026-08-27 --------
  // (the series-bus engine round). This plate was drawn `is-off` with one
  // refused slider ("the genre bus is engine work — not wired"); the engine
  // work happened and it is a registry row now (fields.js BUSES bus `genre`):
  // the strips' genre sends feed a fifth accumulator in both renderers, the
  // chain below runs over it, and `level → delay` scales the summed return as
  // it lands on the delay bus — series into everything downstream. The chips
  // are the box FX vocabulary; a genre deals its own at compose time and this
  // rack is where a hand re-deals them.
  PLATES.genre = () => {
    const p = el("div", null, "nu-plate");
    p.dataset.bus = "genre";
    p.setAttribute("aria-label", "genre fx bus");
    const h = el("div", null, "nu-bushead");
    h.append(el("b", "genre fx bus · " + busName("genre"), "nu-busname"));
    h.append(el("small", "in ← genre sends · dealt by the genre, edited here",
      "nu-busin"));
    p.append(h);
    const g = el("div", null, "nu-gear");
    labelled(g, "called", busSel("genre", knobOf("genre", "name")));
    labelled(g, "chip 1", busSel("genre", knobOf("genre", "fx1")));
    labelled(g, "chip 2", busSel("genre", knobOf("genre", "fx2")));
    labelled(g, "chip 3", busSel("genre", knobOf("genre", "fx3")));
    p.append(g);
    const r = el("div", null, "nu-busrow");
    const spec = knobOf("genre", "level");
    r.append(col("level → delay", vknob("bus|genre|level", "level", spec.table,
      spec.labels, bv("genre", "level"), "genre bus level into the delay bus",
      (v) => { DD().writeBus(doc, "genre", "level", v); ctx.changed(); },
      "default", 1, true)));
    p.append(r);
    p.append(flow("into the delay bus"));
    return p;
  };

  // -- the delay bus: fields.js bus 2, its real knobs -----------------------
  PLATES.echo = () => {
    const p = el("div", null, "nu-plate");
    p.dataset.bus = "echo";
    p.setAttribute("aria-label", "delay bus");
    const h = el("div", null, "nu-bushead");
    h.append(el("b", "delay bus · " + busName("echo"), "nu-busname"));
    h.append(el("small", "in ← " + busName("echo") + " sends", "nu-busin"));
    p.append(h);
    const g = el("div", null, "nu-gear");
    labelled(g, "called", busSel("echo", knobOf("echo", "name")));
    labelled(g, "time", busSel("echo", knobOf("echo", "time")));
    labelled(g, "repeats", busSel("echo", knobOf("echo", "fb")));
    labelled(g, "tone", busSel("echo", knobOf("echo", "tone")));
    p.append(g);
    const r = el("div", null, "nu-busrow");
    const spec = knobOf("echo", "ret");
    r.append(col("return → main", vknob("bus|echo|ret", "ret", spec.table,
      spec.labels, bv("echo", "ret"), "delay bus return",
      (v) => { DD().writeBus(doc, "echo", "ret", v); ctx.changed(); },
      "default", 1, true)));
    // THE BLEED, LIVE 2026-08-27 (series-bus round) — it was refused here as
    // "a constant" while fx_bus ran the literal `d*0.2`; the literal is the
    // `bleed` slider now (default 0.2 = as shipped, byte-identical) and
    // buses.echo.bleed is its one hand: masterState -> state.bleed -> fxParams,
    // rev_bleed mirrored so a colored room hears the same knob.
    { const bspec = knobOf("echo", "bleed");
      r.append(col("bleed → reverb", vknob("bus|echo|bleed", "bleed",
        bspec.table, bspec.labels, bv("echo", "bleed"),
        "delay bus bleed into the reverb bus",
        (v) => { DD().writeBus(doc, "echo", "bleed", v); ctx.changed(); },
        "default", 0.2, true))); }
    const says = el("small", "", "nu-busmodel nu-hint");
    says.dataset.live = "model";   // the clock writes it, so it says so
    r.append(says);
    busSays.push({ el: says, bus: "echo" });
    p.append(r);
    p.append(flow("into the reverb bus"));
    return p;
  };

  // -- the reverb bus: fields.js bus 1 --------------------------------------
  PLATES.rev = () => {
    const p = el("div", null, "nu-plate");
    p.dataset.bus = "rev";
    p.setAttribute("aria-label", "reverb bus");
    const h = el("div", null, "nu-bushead");
    h.append(el("b", "reverb bus · " + busName("rev"), "nu-busname"));
    h.append(el("small", "in ← " + busName("rev") +
      " sends + the delay's bleed", "nu-busin"));
    p.append(h);
    const g = el("div", null, "nu-gear");
    labelled(g, "called", busSel("rev", knobOf("rev", "name")));
    labelled(g, "reverb type", busSel("rev", knobOf("rev", "color")));
    p.append(g);
    const r = el("div", null, "nu-busrow");
    const spec = knobOf("rev", "ret");
    r.append(col("return → main", vknob("bus|rev|ret", "ret", spec.table,
      spec.labels, bv("rev", "ret"), "reverb bus return",
      (v) => { DD().writeBus(doc, "rev", "ret", v); ctx.changed(); },
      "default", 0, true)));
    const says = el("small", "", "nu-busmodel nu-hint");
    says.dataset.live = "model";   // the clock writes it, so it says so
    r.append(says);
    busSays.push({ el: says, bus: "rev" });
    p.append(r);
    // REWORDED 2026-08-28, WITH THE VOICES' DEPARTURE. It said "every strip
    // ABOVE is sending into a return whose gain is zero" — and there is no
    // strip above it any more, nor anywhere on this board. The measured fact
    // is untouched (`returnShut`: masterState says the reverb return resolves
    // to 0 while the voices' `rev` sends are non-zero), so only the address
    // moved: the sends are on each voice's own `mix` facet now.
    if (shut) p.append(el("small", "every voice is sending into a return" +
      " whose gain is zero — open it on this return", "nu-why"));
    p.append(flow("into main — the record"));
    return p;
  };

  // -- the main -------------------------------------------------------------
  /* HOMELESS IS GONE, 2026-08-28. `const HOMELESS = { width: 1, tilt: 1,
     ceiling: 1 }` stood here and disabled those three cells with the sentence
     "this one round-trips and draws but reaches no sound". All three reach the
     sound now (audio/desk.js masterState -> fx_bus mswidth / mtilt / clipl),
     and the last of them was the round's whole point: Paul, listening
     to the Iranian pop record, *"There doesn't seem to be a way to even turn
     the final mix off — the minimum amount of things is soft, not none"* —
     `ceiling` was the word that claimed the clipper and the clipper was
     unconditional. A refusal you have fixed must stop being printed. */
  const mv = (k) => (doc.sound && doc.sound.master && doc.sound.master[k]) || "";
  PLATES.main = () => {
    const p = el("div", null, "nu-plate");
    p.dataset.bus = "main";
    p.setAttribute("aria-label", "main");
    const h = el("div", null, "nu-bushead");
    h.append(el("b", "main · the record", "nu-busname"));
    h.append(el("small", "in ← dry + reverb out · out → the speakers",
      "nu-busin"));
    p.append(h);
    const g = el("div", null, "nu-gear");
    for (const f of MASTER_FIELDS) {
      const s = selectEl({
        key: "master|" + f.key, label: f.label,
        options: optionsFor(f.table, f.labels, mv(f.key), null, "default"),
        value: mv(f.key),
        set: (v) => { DD().writeMaster(doc, f.key, v); ctx.changed(); },
      });
      labelled(g, f.label, s);
    }
    p.append(g);
    /* THE ONE-TOUCH BYPASS (2026-08-28). Paul: *"Turning that stuff down
       doesn't do enough in the final mix. There doesn't seem to be a way to
       even turn the final mix off."* This is that way, and it is A VIEW OVER
       THE SEVEN WORDS ABOVE — it writes `none` into each of them through the
       same DD().writeMaster every <select> uses, and the selects redraw
       showing seven `none`s because that is what the record now says. There is
       no eighth stored fact: a `sound.master.bypass` flag would be a second
       owner of seven values that already own themselves, and the first hand to
       move `drive` afterwards would leave the record saying two things at once.
       The button's own label is read back off the same seven values
       (NuFields.masterIsNone), so it can never disagree with them.

       WHAT IT DOES NOT TURN OFF, said here rather than discovered: the master
       AIR shelf (-7 dB above 4.5 kHz), the 10 Hz highpass and the 20.5 kHz
       lowpass. Those are catalogue-wide corrections in the engine's own
       fxParams, not master WORDS — Paul asked for the shelf twice — so they
       are outside the seven and outside this button. */
    {
      const F = window.NuFields;
      // PLAIN <button>, no class: nu.css's design system gives "an action"
      // the browser's own chrome and "a tab" the same button plus
      // aria-pressed. This is the second — it has two states and says which.
      const off = el("button", "");
      off.type = "button";
      off.dataset.k = "master|bypass";
      const draw = () => {
        const isNone = F.masterIsNone(doc.sound && doc.sound.master);
        off.textContent = isNone ? "master: OFF — every stage bypassed"
                                 : "turn the master off — every word to none";
        off.setAttribute("aria-pressed", isNone ? "true" : "false");
        off.title = isNone
          ? "all seven words say none: no drive, no glue, no tape head, no " +
            "global room, no width trim, no tilt, no clip stage. The air " +
            "shelf and the band limits stay — they are the engine's, not the " +
            "record's."
          : "writes none into drive, glue, tape, space, width, tilt and " +
            "ceiling at once — the record with nothing done to it";
      };
      off.addEventListener("click", () => {
        const isNone = F.masterIsNone(doc.sound && doc.sound.master);
        // pressed again = put the seven back to ABSENT, which is the engine's
        // own default and NOT `none` (see fields.js: the two are different
        // facts and 139 saved records depend on the difference)
        for (const f of MASTER_FIELDS)
          DD().writeMaster(doc, f.key, isNone ? null : F.MASTER_NONE[f.key]);
        ctx.changed();
      });
      draw();
      p.append(off);
    }
    const r = el("div", null, "nu-busrow");
    // RECORD GAIN — Time's `sound.level` slider, moved onto the master strip
    // (FUTURE.md §5 rename table: "`level` (in Time) → `record gain`, on the
    // master strip — a Sound fact filed under Time; clearest 'spread
    // everywhere' exhibit"). Same key, same write, same clamp: document.js
    // toGenre multiplies the basis genre's tone.gain by it, capped at 1
    // because the engine caps a tone's gain there. ui/eight.js leaves a dim
    // pointer where it used to stand.
    {
      const tone = (GENRES[doc.basis] || {}).tone || { gain: 0.28 };
      const max = +(1 / tone.gain).toFixed(2);
      r.append(col("record gain", vnum("level", {
        min: 0.5, max, step: 0.25,
        value: doc.sound && doc.sound.level != null ? doc.sound.level : 1,
        aria: "record gain", tall: true, fmt: (v) => "×" + v,
        set: (v) => { doc.sound = doc.sound || {}; doc.sound.level = v;
                      ctx.changed(); } })));
    }
    // THE ONE MEASURED METER ON THE BOARD — the master tap the engine already
    // carries (audio/live.js rmsNow, the crackle monitor's own signal), green
    // because green is MEASURED and nothing else on this page may wear it.
    {
      const wellWrap = el("span", null, "nu-vs nu-vs-tall");
      const well = el("span", null, "nu-meterwell");
      well.dataset.live = "meter";
      const bar = el("i", null, "nu-meterbar");
      well.append(bar);
      well.title = "measured: the engine's master RMS (audio/live.js rmsNow)";
      const wellOut = el("output", "", "nu-vs-val");
      wellOut.dataset.live = "meter";   // the clock writes it, so it says so
      wellWrap.append(well, wellOut);
      masterMeter = { bar, out: wellOut };
      r.append(col("meter", wellWrap, "nu-metercol"));
    }
    r.append(col("listening", listening()));
    p.append(r);
    /* CHARACTER IS GONE (2026-08-27). Paul, listening on staging: *"We can get
       rid of Character right? We don't really use it any more do we?"* — and
       FUTURE.md §5's table had already ruled the same way, in the same breath:
       "`character` (master multiselect) → the multiselect dies … dealt, not
       embedded; tap chips delete the ⌘-instruction".

       WHAT STOOD HERE was a `<select multiple>` on `master.fx` — the ONE
       multiple-selection control on the page, and the only control left that
       needed a browser gesture (hold ⌘) nothing else here needs. Its own
       comment said the block would stand "until bus chain slots absorb
       `sound.fx`", which named its end condition; what actually absorbed it
       was the PER-VOICE slots Paul asked for the same day ("Add per voice
       effects, up to three. Each has a wet dry mix and its own settings"),
       which are drawn on every strip by `fxSlots` above.

       MEASURED BEFORE IT WENT: "we don't really use it" was true of the hand
       and false of the compiler — 27 of the 199 anchors wrote a `sound.fx`,
       and audio/desk.js folded it into every seated voice's chain, costing
       neoclassical 2.23 dB of RMS and ambient 1.96 dB of peak on the rendered
       artifact. So the chip was not deleted, it was DEALT: precompose.js
       `deskThe` writes it on each chair, document.js `normalize` folds any
       saved one the same way, and the same chips now appear in the strips'
       own three slots — visible per voice, and removable per voice. */
    // "the bar's volume slider is the room, not the record — unchanged,
    // unsaved" DELETED 2026-08-27 (text diet): the transport slider says
    // `room` itself now (index.html, §5) and the listening column beside the
    // fader carries the not-saved refusal — this line was a third owner of
    // one sentence.
    return p;
  };

  /* ---- THE TAB ROW: the series, and only the series ----------------------
     Paul, 2026-08-27: *"Put the effects buses and mains into special tabs
     after the voices -- now the board is one tabbed space that is consistent
     and easy to understand."* One row, one panel — and since 2026-08-28 there
     is no "after the voices" left in it, because there are no voices in it.
     Paul, that day: *"You were supposed to remove the voices from the mixing
     board and just put them as nav items in the voices themselves."* Four
     tabs, one per stage of the series.

     THE SPELLING IS THIS PAGE'S OWN AND UNCHANGED. `<p class="nu-row">` of
     plain buttons carrying `aria-pressed`, a `<mark>` on the open one — the
     same idiom as `#nu-tray`'s levels and `#motif-tabs`.

     THE GROUP OUTLIVES THE SEAM IT WAS CUT FOR, 2026-08-28, and it is kept
     rather than unwrapped. It was the answer to the half of the old rack
     argument that was right — a record-level fact must not read as a per-voice
     gesture — so the four bus tabs sat in their own `role="group"` labelled
     "the bus series", `flex-basis: 100%`, always beginning their own line
     UNDER the voices. There are no voices above them now, so the line it
     breaks is the row's first; what the group still does is the part that was
     never about the voices: it NAMES the four buttons as one thing ("the bus
     series") for a screen reader, and it is what the leading `.nu-seamlab`
     hangs on, which is the sentence the deleted top-of-rack connector used to
     say. A `role="group"` of four is a group whether or not anything precedes
     it; deleting it would cost the name and buy one <span>.
     THE MEASUREMENTS THAT BOUGHT THE GROUP ARE KEPT, and the last of them is
     what the voices leaving finishes. 2026-08-28, when the tabs became marks:
     "at 390 the voice tabs are one line of 2×44px and the bus group is now ONE
     line (4×44 plus its three arrows and its label fit inside 366), so the
     whole row is two lines instead of three — 147.17px to 96.78px." Take the
     voice line away and the row is ONE line at both widths, which is the
     smallest a four-stage series can be drawn in. A row that WRAPS is still
     the whole of the no-sideways-scroll law here (`.nu-row` is `flex-wrap:
     wrap`, nu.css) and desk-gate G13 measures the document, the row and the
     panel to prove none of the three grows sideways at either width.

     THE SERIES STAYS LEGIBLE BECAUSE THE ROW DRAWS IT. The bus tabs are
     separated by literal `→` glyphs — `genre fx → delay → reverb → main` — so
     the chain is on the page from EVERY tab, which is the thing a hand riding
     a send needs and is more than the old rack gave (it drew the chain only
     when you had scrolled to it). The arrows are their own row items and NOT
     part of a button's label, for two reasons measured rather than assumed:
     inside the label the `<mark>` on the open tab would swallow the arrow and
     mark a connector as a name, and with the stylesheet off a separate glyph
     is still a glyph between two words.

     THE LEADING LABEL SAYS "the voices feed", 2026-08-28, and the rewrite is
     the one sentence on this board that the move made false. It said "the
     strips feed", which was the top-of-rack connector's own words ("the strips
     send into every stage below") carried onto the row when the rack became
     tabs — and a reader standing here now would look for the strips among
     these four tabs and not find one. The FACT is unchanged and is the reason
     the sentence has to stay in some form: every voice's four sends land in
     this series. What changed is where the reader has to go to move one, so
     the label names the thing that is still on the page. A SECOND, SEPARATE
     FLOW STRIP ABOVE THE PANEL WAS REJECTED by the
     same measurement: it would be a fourth drawing of one fact (the row's
     arrows, the plate's `in ←` header, the plate's own footer connector) and
     an extra line of prose on every tab, against a text ceiling
     (test/text-diet.test.js) that a fourth owner would eat for nothing.

     WHAT A PLATE STILL SAYS FOR ITSELF, so the tab row is never the only copy:
     its header prints `in ← …` (who feeds it) and its footer prints the
     connector for where it goes — `into the delay bus`, `into the reverb bus`,
     `into main — the record`. Open the delay tab and the plate says it is fed
     by the echo sends and that it runs into the reverb; the row says the same
     shape in one line. Two owners of a picture, one owner of every number.
     AND A PLATE'S `in ←` LINE IS WHERE THE VOICES ARE NAMED, which is how the
     board goes on explaining a series it no longer draws the top of: "in ←
     genre sends", "in ← the reverb sends + the delay's bleed". Those sends are
     each voice's own, on each voice's own `mix` facet. */
  /* THE BUS TABS ARE READ OFF THE REGISTRY, IN THE ENGINE'S SERIES ORDER.
     fields.js BUSROWS yields five rows; the three carrying an `engine` tag are
     stages the renderers actually run (`rev`, `del`, `genre`) and the two
     GROUPS draw no plate — the reversal is printed under the panel and their
     saved sends still route. The registry's own order is NOT the series' order
     (the genre row is appended last there on purpose, so the four shipped
     positional names stay "bus 1".."bus 4"), so the series is named once, here,
     in the order audio/desk.js BUS_REACH describes: genre `to: "bus 2"` →
     echo `to: "main"` (plus its bleed into rev) → rev `to: "main"` → the main.
     An engine bus the registry grows that this list does not name is APPENDED
     rather than dropped: a stage with a plate and no tab would be a control
     you cannot reach, which is the one thing tabs may never do. */
  const SERIES = ["genre", "echo", "rev"];
  const engineBuses = BUS_FIELDS.filter((b) => b.engine).map((b) => b.bus);
  const busKeys = SERIES.filter((k) => engineBuses.includes(k))
    .concat(engineBuses.filter((k) => !SERIES.includes(k)));
  // the WORD on a bus tab is the registry's own label, never typed here — a
  // renamed row is renamed on the tab by existing. `main` is not a BUSROWS row
  // (it is where the series ends), so it is the one word this file spells.
  const busLabel = (k) => (BUS_FIELDS.find((b) => b.bus === k) || {}).label || k;
  /* A MARK AND A NUMBER ON EVERY TAB IN THIS ROW (Paul, 2026-08-28: "Voice 2
     for example could be more symbol plus the number 2").

     A BUS tab takes its own mark and its STAGE — 1 genre fx, 2 delay, 3
     reverb, 4 main — which is the series' own numbering, the one the four
     shipped positional names already use ("bus 1".."bus 4"). The `→` glyphs
     between them stay: they draw the chain from every tab.

     THE VOICE HALF OF THIS PARAGRAPH WENT WITH THE VOICE TABS (2026-08-28) and
     its rule is kept because it is still true one screen over: "a VOICE tab
     takes the KIND's mark and the voice's place in the RECORD's roster —
     `doc.voices`, not the channel walk — because `channelVoicesOf` orders
     lines, then bass, then drums, and DROPS a kit that has not been hired, so
     a number taken from it would make the same player voice 2 here and voice 3
     in the band. One roster, one number, both screens." That is exactly what
     ui/eight.js `bandTrayItems` does with `sayVoice`, and the gutter is the
     one row that draws a voice now. `kindGlyph` and `sayVoice` came off this
     file's import list with the row that used them.

     THE WORD IS UNTOUCHED AS A FACT. `busLabel` is still the registry's own
     label and this file still spells only `main` — "a renamed row is renamed
     on the tab by existing" — and the label is the button's `aria-label` and
     its `.nu-vh` text rather than its visible face below 700px. */
  const TABS = busKeys.map((k, i) => ({ kind: "bus", key: k, label: busLabel(k),
      glyph: (GLYPH.bus[k] || {}).g || "•", num: i + 1,
      say: (GLYPH.bus[k] || {}).s || busLabel(k) }))
    .concat([{ kind: "bus", key: "main", label: "main",
      glyph: GLYPH.bus.main.g, num: busKeys.length + 1,
      say: GLYPH.bus.main.s }]);
  const busTabs = TABS;
  // the open tab survives a redraw; a stage the registry stopped declaring
  // does not. (It read "a voice that left the bank does not" while the voices
  // were tabs — same line, same law, and now the only thing that can leave the
  // row is an engine bus.)
  if (!TABS.some((t) => t.kind === BOARDTAB.kind && t.key === BOARDTAB.key))
    BOARDTAB = TABS[0] ? { kind: TABS[0].kind, key: TABS[0].key }
                       : { kind: "bus", key: null };

  const tabsBar = el("p", null, "nu-row");
  tabsBar.id = "boardtabs";
  tabsBar.setAttribute("role", "group");
  tabsBar.setAttribute("aria-label", "which part of the board is open");
  const tabBtns = [];
  const markTabs = () => {
    for (const t2 of tabBtns) {
      const on = t2.tab.kind === BOARDTAB.kind && t2.tab.key === BOARDTAB.key;
      paintIcon(t2.b, { glyph: t2.tab.glyph, num: t2.tab.num,
                        word: t2.tab.label, say: t2.tab.say, on });
    }
  };
  // REBUILDS THE PANEL AND NOTHING ELSE — which is what makes "switching tabs
  // does not move the page" true BY CONSTRUCTION rather than by correction.
  // Everything above `#boardpanel` (the heading, the legend, the tab row
  // itself) is untouched, so no pixel above the thumb changes and scrollY has
  // nothing to be corrected against — ui/eight.js's `anchorWant` machinery is
  // not called and does not need to be. It is also why this is NOT
  // `ctx.changed()` or a board-wide remount: a full redraw would rebuild the
  // word grid, and the grid is a `.nu-pane` whose sideways scroll only
  // draw()'s keepPanes puts back.
  /* THE `#strips` BRANCH IS DELETED, 2026-08-28. It read:
       } else {
         const strips = el("div", null, "nu-strips");
         strips.id = "strips";
         const c = chans.find((x) => x.voice.name === BOARDTAB.key);
         if (c) strips.append(stripOf(c));
         strips.setAttribute("aria-label", (BOARDTAB.key || "no") + " strip");
         panel.append(strips);
       }
     — and `#strips` does not exist anywhere on this board now. The `.nu-strips`
     CLASS is alive and unchanged: `voiceMix` above wears it, because the skin
     is the skin wherever the strip is drawn. The ID stayed here as long as the
     board owned the furniture and went with it, rather than being claimed by a
     second node, which is the bug a gate cannot see round. */
  const showPanel = () => {
    busSays = []; masterMeter = null;
    panel.textContent = "";
    const rack = el("div", null, "nu-rack");
    rack.id = "rack";
    const make = PLATES[BOARDTAB.key];
    if (make) rack.append(make());
    rack.setAttribute("aria-label", busLabel(BOARDTAB.key) + " plate");
    panel.append(rack);
  };
  const tabBtn = (t) => {
    // KEYED `boardtab|<kind>|<name>`, 2026-08-27 (it was `boardtab-<name>`
    // while only voices had tabs). The page's own scoping convention — the
    // strips key `b|rev|cantor` the same way — and it is what keeps a voice
    // called `main` from claiming the main plate's tab. THE KEY DID NOT MOVE
    // WHEN THE FACE DID (2026-08-28): nukernel/desk-gate.js drives this whole
    // row by `[data-k="boardtab|…"]` and always did, which is exactly what
    // those attributes are for.
    const b = icon({ k: "boardtab|" + t.kind + "|" + t.key,
      glyph: t.glyph, num: t.num, word: t.label, say: t.say,
      on: t.kind === BOARDTAB.kind && t.key === BOARDTAB.key });
    b.addEventListener("click", () => {
      if (t.kind === BOARDTAB.kind && t.key === BOARDTAB.key) return;
      BOARDTAB = { kind: t.kind, key: t.key };
      markTabs();
      showPanel();
      paint();                           // the new panel's model readouts, now
    });
    tabBtns.push({ b, tab: t });
    return b;
  };
  /* (`for (const t of TABS.filter((x) => x.kind === "voice"))
        tabsBar.append(tabBtn(t), document.createTextNode(" "));`
     STOOD HERE — 2026-08-28, and it is the whole of "remove the voices from
     the mixing board". The literal " " between two tabs is still spelled, one
     block down, inside the series group: with the stylesheet off it is what
     keeps two marks from reading as one word.) */
  const series = el("span", null, "nu-busgroup");
  series.setAttribute("role", "group");
  series.setAttribute("aria-label", "the bus series");
  series.append(el("span", "the voices feed", "nu-seamlab"));
  busTabs.forEach((t) => {
    series.append(el("span", "→", "nu-tabarrow"), " ", tabBtn(t), " ");
  });
  tabsBar.append(series);
  markTabs();
  host.append(tabsBar, panel);
  showPanel();

  /* ================= SECTION AUTOMATION · THE WORD GRID ================= */
  // one-board §III, binding: "The grid is where you set — six words per voice
  // per section, saved with the song. Sections run DOWN; the row in clock red
  // is sounding. A word is a trim on the strip's fader for that section."
  // Stored at voice.desk.trim[<secId>] (fields.js TRIMS), applied per box at
  // push time (ui/eight.js) through the exact wire the fader already proved
  // on rendered audio (test/tape-reach R1). Tap a cell to cycle its word.
  // THE SIX WORDS ARE fields.js DATA, NEVER TYPED HERE: the cycle is "" (as
  // mixed, the absent spelling) plus the TRIMS keys in the table's own order —
  // a word added or renamed there is on the grid by existing, and a list typed
  // here would be a second owner of the vocabulary.
  const CYCLE = ["", ...Object.keys(NuFields.TRIMS)];
  const WSHOW = (w) => (w === "" ? "—" : (NuFields.TRIMLABEL[w] || w));
  {
    const wrap = el("div", null, "nu-autopanel");
    // compressed 2026-08-27 (text diet): the grid draws sections running down
    // and a tap teaches itself; what the label must say is what a word IS.
    wrap.append(el("p", "section automation · a trim on the fader, per section",
      "nu-rowlab"));
    const pane = el("div", null, "nu-pane");
    pane.tabIndex = 0;
    // the keepPanes key (ui/eight.js, 2026-08-25): the grid is one pane and
    // its sideways scroll must survive the redraw every cell tap causes.
    pane.dataset.pane = "trimgrid";
    // THE GRID ARRIVES FILLED (2026-08-28). Paul: *"Shouldn't automation
    // already have values preset per generated song."* It should, and the half
    // of that this surface owes is SHOWING what the record deals rather than
    // only what a thumb has set — the page's own law, "dim is derived, bright
    // is set", applied to the one table that had never obeyed it.
    //
    // WHAT IS DEALT, and the measurement that decided the shape. audio/desk.js
    // `shade` moves every voice per section off the section's `lvl`/`env`,
    // differentially by seat, and it reaches the sound (all twelve words move
    // the engine handoff). This paragraph used to end there and say the grid
    // would stay empty: "the composer deals neither — measured 2026-08-28 over
    // all 199 catalogue anchors, 2,075 sections, `lvl` and `env` are set on
    // ZERO … the moment a section names a word, by hand or by any composer
    // that learns to, every voice's own dealt dB appears here." The
    // measurement was true when it was taken and is kept because it is the
    // reason this surface exists; the composer learned the same afternoon.
    // Paul, on being told it had been surfaced and not dealt: *"Yes I thought
    // you did that."*
    //
    // SO THE GRID ARRIVES FULL, and from the record rather than from here:
    // compose.js deals `env` from its arc (dynOf / spreadDynamics) and `lvl`
    // from THE LEVEL DEAL (compose.js:212 — a role table tempered by the
    // genre's family and plan), and precompose.js § 8 now carries both onto
    // `form.sections[]`, which is the wire that was cut. Nothing on this page
    // changed to fill it: the dim numbers below are `derivedTrim` reading the
    // words the record now says.
    //
    // PER VOICE, AND IN dB. `derivedTrim` carries both arguments (a cell is a
    // voice × section cell, so the dim half must answer the same question the
    // bright half does; and TRIMS' rungs are −6/−2.5/+2.5/+5 where the dealt
    // values are ±0.5..2.5, so printing the nearest WORD would print a word
    // whose value is not the value in play).
    //
    // THE CYCLE STILL RIDES THE STORED WORD, not the drawn one: a tap on a dim
    // cell starts at the top of TRIMS exactly as it did before, so absent-is-
    // today survives the redraw as well as the render.
    /* THE NEAREST RUNG. The dealt values are continuous (shade's own +-0.5..2.5)
       and TRIMS' rungs are -6 / -2.5 / 0 / +2.5 / +5, so a dealt trim is named
       by the rung it is closest to — the same vocabulary a hand has, never a
       sixth word invented for the box. Ties go to the quieter rung: a record
       that is unsure should not claim to be louder than it is. */
    const nearestTrim = (db) => {
      const T = NuFields.TRIMS;
      let best = "", bd = Infinity;
      for (const w of Object.keys(T)) {
        const v = T[w] == null ? -Infinity : T[w];   // `out` is a mute, not a number
        if (v === -Infinity) continue;
        const dd = Math.abs(v - db);
        if (dd < bd || (dd === bd && v < (T[best] == null ? Infinity : T[best]))) { bd = dd; best = w; }
      }
      return Math.abs(db) < 0.75 ? "" : best;        // inside a rung's width of zero is "as mixed"
    };
    const DRV = (si, key) => {
      try { return derivedTrim(SONG[si] || null, key); }
      catch (e) { return { db: 0, eq: null }; }
    };
    const t = el("table");
    t.id = "trimgrid";
    t.className = "nu-trims";
    // the playhead's row mark (`tr.now`, paint() below) walks this table once
    // a beat, so the table declares itself to the clock the way the meters do
    // (dataset.live = "meter" above) — the board sits outside #app, where the
    // transport feed is free to write, but a surface the clock writes on
    // declares itself rather than relying on where it happens to be mounted.
    t.dataset.live = "trimrow";
    const thead = el("thead"), hr = el("tr");
    hr.append(el("th", "section"));
    for (const c of chans) hr.append(el("th", c.voice.name));
    thead.append(hr); t.append(thead);
    const tbody = el("tbody");
    doc.form.sections.forEach((s2, si) => {
      const tr = el("tr");
      tr.dataset.sec = String(si);
      const th = el("th", s2.id);
      // WHERE THE DIM NUMBERS COME FROM, on the row that causes them: the
      // section's own dealt words. `shade` reads exactly these two, so a reader
      // who wonders why a column of cells woke up can see the cause in the
      // header rather than having to know the table. Absent words print
      // nothing, which is what the record says.
      const dealt = [(SONG[si] || {}).lvl, (SONG[si] || {}).env]
        .filter(Boolean).join(" · ");
      th.append(el("small", " " + s2.bars + " bars" + (dealt ? " · " + dealt : "")));
      tr.append(th);
      for (const c of chans) {
        const td = el("td");
        const cur = (deskOf(c.voice).trim || {})[s2.id] || "";
        // the record's own dealt trim for THIS voice in THIS section — drawn
        // only where the hand is silent, because a set word replaces the
        // derived one on the fader (fields.js trimApply) as well as on the page
        const d = cur === "" ? DRV(si, c.key) : null;
        /* WORDS ON BOTH SIDES OF THE CELL, 2026-08-28. Paul: *"The settings
           you put into automation are floats. Mine are words. Make them all
           words please."* He is right and the mismatch was mine: a hand's
           trim printed `lift`, and the record's own dealt trim printed
           `+2.5` in the very same column — one grid answering one question
           in two vocabularies. The dealt dB is now said in the SAME words the
           hand writes, by naming the nearest TRIMS rung, so a column reads as
           one list of words whether the box wrote it or you did.
           WHY THE WORD AND NOT THE NUMBER, given that yesterday's argument
           for the number was that rounding -2.0 to `back` prints a value that
           is not the value in play: because the cell is not the owner of that
           value — `derivedTrim` is, and the exact dB is one long-press away in
           the explainer below. A grid is for reading a shape down a column,
           and a column of words has a shape a column of decimals does not. */
        const shown = cur !== "" ? WSHOW(cur)
          : (d && d.db) ? WSHOW(nearestTrim(d.db))
          : WSHOW("");
        const b = el("button", shown, "nu-trimbtn w-" + (cur || "mid") +
          (cur === "" && d && d.db ? " is-derived" : ""));
        b.type = "button";
        b.dataset.k = "t|" + c.voice.name + "|" + s2.id;
        b.setAttribute("aria-label", c.voice.name + " in " + s2.id + ": " +
          (cur !== "" ? cur
            : (d && d.db) ? "as mixed, and the record deals " +
                nearestTrim(d.db) + ", " +
                (d.db > 0 ? "+" : "\u2212") + Math.abs(d.db).toFixed(1) + " dB here"
            : "as mixed"));
        // THE EXPLAINER ON THE CELL IS NOW BOTH HALVES (2026-08-28, with the
        // legend's deletion): a SET word says what it is worth in dB — the one
        // fact the deleted paragraph carried that a reader genuinely needs to
        // work the grid, and TRIMS is still its only owner.
        if (cur !== "") {
          const dbv = NuFields.TRIMS[cur];
          b.title = WSHOW(cur) + " \u2014 " + (dbv == null ? "silent here"
            : (dbv > 0 ? "+" : "\u2212") + Math.abs(dbv).toFixed(1) +
              " dB on this voice's fader for this section") +
            " \u2014 tap to cycle; the last tap is \u201cas mixed\u201d";
        } else if (!(d && d.db)) {
          b.title = "as mixed \u2014 no word set here, so the fader stands " +
            "\u2014 tap to set one";
        }
        if (cur === "" && d && d.db)
          b.title = "derived: the section's own " +
            [(SONG[si] || {}).lvl, (SONG[si] || {}).env].filter(Boolean).join(" + ") +
            " deals this voice " + (d.db > 0 ? "+" : "\u2212") +
            Math.abs(d.db).toFixed(1) + " dB" +
            (d.eq ? " and a tone move" : "") + " — tap to set a word over it";
        b.addEventListener("click", () => {
          const now = (deskOf(c.voice).trim || {})[s2.id] || "";
          const next = CYCLE[(CYCLE.indexOf(now) + 1) % CYCLE.length];
          const map = { ...(deskOf(c.voice).trim || {}) };
          if (next === "") delete map[s2.id]; else map[s2.id] = next;
          setDesk(ctx, c.voice, "trim", Object.keys(map).length ? map : null);
        });
        td.append(b);
        tr.append(td);
      }
      tbody.append(tr);
    });
    t.append(tbody);
    pane.append(t);
    wrap.append(pane);
    // THE LEGEND IS DELETED, 2026-08-28. Paul: *"the text below Section
    // Automation is vast and should all be removed."* It printed the six words
    // in TRIMS' order plus the two facts a reader needs to work the grid —
    // "absent is as mixed, and a dim number is what the record already deals
    // that voice there" — and both facts survive ON THE CONTROL, where the
    // page already teaches: a cell's `title` (the long-press explainer) and
    // its `aria-label` say what its own word is worth in dB, what "as mixed"
    // means, and where a dim number came from. The list of six was a second
    // owner of TRIMS anyway; the cycle already spells them one tap at a time.
    host.append(wrap);
  }

  /* ---- the routing pointer, once, under the rack ------------------------ */
  // A GROUP HAS NO PLATE ANY MORE, and the sentence saying so is the reversal
  // written down: bus 3 and bus 4 (2026-08-26's groups) left the surface on
  // 2026-08-27 when Paul named the series — "one bus for genre specific
  // effects, into a delay bus, into reverb, into main" — and the groups are
  // not in the line. Their sends and aims still LOAD and still SOUND
  // (fields.js busRoute, audio/desk.js feedSplit — an old save is untouched);
  // there is simply no knob for them here, because a knob must point at a
  // stage the board draws.
  // THE ROUTING ESSAY MOVED TO docs/BOARD-ROUTING.md, 2026-08-27 (the text
  // diet, FUTURE.md §2: "The board's 1,629-char routing essay moves to
  // `docs/`; signal flow is drawn as arrows, not narrated"). The <ul> that
  // stood here printed MAIN_TO_BUS1 and every FIXED_EDGES sentence to end
  // users, fx_bus.dsp line numbers included. The sentences still have ONE
  // owner — audio/desk.js — and the doc quotes them; desk-gate G14 now
  // asserts the page carries this pointer AND the doc carries every edge's
  // own words, so the edges can neither vanish nor drift. What stays on the
  // page is drawn: each edge is an arrow the rack already makes.
  const edges = el("p", null, "nu-hint");
  { const a2 = document.createElement("a");
    a2.href = "docs/BOARD-ROUTING.md";
    a2.textContent = "the fixed wires — docs/BOARD-ROUTING.md";
    edges.append(a2); }
  host.append(edges);
  /* THE REFUSAL LIST UNDER THE RACK IS DELETED, 2026-08-28. Paul: *"the text
     below Section Automation is vast and should all be removed."* It was 829
     rendered characters — five sentences, the longest block on the board —
     and four of the five were a SECOND PRINTING. MAINSEND_WHY, METER_WHY,
     STEREO_WHY and SWEEP_WET_WHY are each already on their own control, put
     there by `refuse()` above as `title`, as `data-why`, and as the short
     `.nu-why` word beside the knob ("the fader's", "no tap", "serial"). The
     law that refusals-with-reasons are load-bearing is about the reason being
     REACHABLE FROM THE CONTROL, which it is; a page-foot digest of sentences
     the controls already carry is prose, and prose is what comes off.
     (Its predecessors came off the same way and for the same kind of reason:
     GENRE_WHY_LONG and BLEED_WHY_LONG on 2026-08-27 when the series-bus round
     wired both, MASTER_WHY on 2026-08-28 when width/tilt/ceiling went live.
     Those died because the refusal ended; these four are still refusals — the
     sentences are alive, on the knobs, and only the digest is gone.)

     THE FIFTH HAD NO CONTROL, so its argument is written here rather than
     drawn. It read: "bus 3 and bus 4 draw no plate — the series is the rack;
     their saved sends and aims still load and still route (fields.js
     busRoute)". Bus 3 and bus 4 were 2026-08-26's groups; they left the
     surface on 2026-08-27 when Paul named the series — *"one bus for genre
     specific effects, into a delay bus, into reverb, into main"* — and the
     groups are not in the line. A sentence about two controls that do not
     exist is explanation, not refusal: there is nothing on the page it is
     attached to and nothing a reader can do with it. What must not be lost is
     the COMPATIBILITY fact, and it is not lost — fields.js busRoute and
     audio/desk.js feedSplit still load and still route an old save's group
     sends and aims, and desk-gate G14's model half measures exactly that on
     every run. G12's rendered-sentence half is retired with the sentence. */

  /* ---- the paint, once a beat off the page's own on("pos") -------------- */
  const paint = () => {
    const s = atBox();
    /* `for (const x of drives)` STOOD HERE — the per-strip model readouts,
       gone with the strips (2026-08-28). The arithmetic did not move: it is
       `sayDrives` below, called by `paintVoiceMix` for the one strip that is
       on the page, so a readout is written by the same line whichever surface
       it is on. */
    const bf = deskBusFeed(s, MASTER, BUSES);
    for (const x of busSays) {
      const f = bf[x.bus];
      x.el.textContent = "model · in " + f.feed.toFixed(2) +
        (f.ret != null ? " · return " + f.ret : "") + " · out " + f.out.toFixed(2);
    }
    if (masterMeter) {
      const r = rmsNow();
      const f = Math.max(0, Math.min(1, gainToF(r * 4)));
      masterMeter.bar.style.height = Math.round(f * 100) + "%";
      masterMeter.out.textContent = playing ? (r > 0 ? "live" : "…") : "stopped";
    }
    const grid = host.querySelector("#trimgrid");
    if (grid) {
      const now = playing && playingSec >= 0 ? playingSec : -1;
      for (const tr of grid.querySelectorAll("tbody tr"))
        tr.classList.toggle("now", +tr.dataset.sec === now);
    }
  };
  paint();
  const handle = { paint };
  CURRENT = handle;
  return handle;
}

// the free function the page's on("pos") handler calls.
export const paintBoard = () => { if (CURRENT) CURRENT.paint(); };

/* ---------- the strip's own beat, wherever the strip is -------------------
   THE ONE ARITHMETIC, WRITTEN ONCE. `liveGain` is the MODEL — desk.js's
   resolved static gain × the box's level automation at the playhead — and this
   is the only place it becomes words on a page. It was inside `mount`'s
   `paint()` while the board drew the strips; it is here now because the strip
   is drawn by the voice, and a second copy of the format string would be a
   second owner of what "model −6.0 dB" means.

   THE [data-live] LAW IS THE ELEMENT'S, NOT THIS FUNCTION'S: `.nu-drive`
   carries `data-live="model"` where it is built (channelStrip), because a
   surface the transport feed repaints declares itself and the wave-3 artifact
   drive watches the whole page with a MutationObserver.

   `isConnected` RATHER THAN A FLAG. ui/eight.js rebuilds the Band panel on
   every edit and a facet tap swaps the panel outright, so the handle from a
   previous draw points at detached nodes; writing to them would be silent
   waste once a beat. Asking the node is cheaper than keeping a second fact
   about it in sync. */
const sayDrives = (drives) => {
  const s = atBox();
  for (const x of drives) {
    const g = liveGain(s, x.key);
    x.el.textContent = "model " + fmtDb(20 * Math.log10(Math.max(1e-4, g))) + " dB";
  }
};
export const paintVoiceMix = () => {
  if (!MIX || !MIX.host.isConnected) return;
  sayDrives(MIX.drives);
};

/* ---------- the listening level, on the main strip ------------------------ */
// Unchanged in meaning since the 2026-08-25 fix (its history is in git): the
// MAIN strip carries the monitor level — same 0..100 store and scale as the
// transport bar's `#vol` (ui/state.js readVol; audio/live.js sends vol/100),
// two views over ONE store. The sentence under it says which of the two
// things on this strip it is: the record's controls are the record; this one
// is the room.
function listening() {
  const wrap = el("span", null, "nu-vs nu-vs-tall");
  const r = document.createElement("input");
  r.type = "range"; r.min = "0"; r.max = "100"; r.step = "1";
  r.value = String(vol); r.id = "vol2"; r.dataset.k = "m|listening";
  r.className = "nu-vs-in";
  r.setAttribute("aria-label", "listening level");
  const o = el("output", Math.round(vol) + "%", "nu-vs-val");
  const say = () => { o.textContent = Math.round(+r.value) + "%";
                      r.setAttribute("aria-valuetext", o.textContent); };
  say();
  r.addEventListener("input", () => { say(); setVol(+r.value); commit("transport"); });
  const { track } = vchassis(r, () => (+r.value) / 100);
  wrap.append(track, o);
  // "room only — not saved", 2026-08-27 — FUTURE.md §5's own compression
  // ("refusal kept, halved"). `nu-why` because it IS a refusal-with-reason:
  // this value refuses to be part of the record.
  const w = el("small", "room only — not saved", "nu-why");
  wrap.append(w);
  return wrap;
}

/* MASTER_WHY IS RETIRED (2026-08-28). It said "this one round-trips and draws
   but reaches no sound — audio/desk.js:769 names all three and says why", and
   the three were width, tilt and ceiling. audio/desk.js no longer names them:
   width is fx_bus `mswidth`, tilt is `mtilt`, ceiling is `clipl`,
   and the last of those is the soft clip that had been unconditional on every
   record since the csound port. The sentence is deleted rather than softened
   because a refusal that has been kept is not a refusal. */
