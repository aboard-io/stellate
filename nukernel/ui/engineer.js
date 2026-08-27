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
// ONE WRITABLE OWNER PER FACT (FUTURE.md, the one-board decision): the board
// is now the ONLY place a hand touches gain/send/eq/insert facts. The
// engineer's rows inside a voice's sheet (VIEW 1 below) became READ-ONLY
// MIRRORS the same day — they print the value and point here.
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
import { deskChannelBase, deskLevelAt, derivedPartTone,
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
import { sheet, selectEl } from "./selects.js";

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
   one-board.html: genre → delay → reverb → main, tapped post-insert. Two are
   live and two are refused, and the split is the ENGINE's, not taste:
     * delay and reverb ARE today's per-unit u.del / u.rev (fields.js `echo` /
       `rev` — "the sends are real and already post-insert", one-board §IV.3;
       the insert chain runs in the unit's own buffer BEFORE the bus taps, so
       the tap is genuinely post-insert: stream-renderer runChain, then the
       rev/del sums).
     * the GENRE send is refused: fx_bus.dsp has no genre stage — the bus is
       the one genuinely new stage in the line and it is ENGINE work (FUTURE.md
       Phase 2 scopes it). A slider into a bus that does not exist would be a
       knob that lies.
     * the MAIN send is refused: the dry path to the main IS the fader, and a
       second gain on the same wire is two owners of one fact.
   The two refusals are drawn (never live-and-dead, never missing) with their
   sentences, per the standing law. */
const GENRE_WHY = "the genre bus is engine work — not wired";
const GENRE_WHY_LONG = GENRE_WHY + ": fx_bus.dsp has no genre stage ahead of " +
  "the delay, so nothing this page writes can put a signal into one. The bus " +
  "is the one genuinely new stage in the series and it is the engine edit " +
  "FUTURE.md Phase 2 buys; a live slider here today would be a knob that lies.";
const MAINSEND_WHY = "the dry path to the main is the fader below — one owner " +
  "per fact, so this send is parked rather than drawn as a second gain on the " +
  "same wire";
const BLEED_WHY = "the bleed is a constant in the DSP — not wired";
const BLEED_WHY_LONG = BLEED_WHY + ": fx_bus.dsp:221 runs the delay into the " +
  "reverb at the literal 0.2 (`d*0.2`) on every record ever rendered; making " +
  "it this slider is a .dsp edit plus a recompile plus the byte-parity gates, " +
  "which is not this page's to take.";
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
                      pan: "pan", lvl: "lvl" };
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
function vchassis(input, frac) {
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
  const s = slots[i];
  if (!s) { box.append(el("small", "no effect seated", "nu-hint")); return box; }
  const body = el("div", null, "nu-slotbody");
  const n = i + 1;
  // THE WET IS THE CHIP'S OWN MIX PARAM, SURFACED — or refused where the
  // module has none (fields.js fxHasMix: only `sweep`, whose sentence is on
  // the control and under the rack).
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

/* ========================= VIEW 1 · THE ENGINEER ==========================
   READ-ONLY MIRROR SINCE 2026-08-27, and the reversal is the one-owner law
   landing where FUTURE.md said it would: "the engineer's per-voice pots
   (sheets keep a read-only mirror that links to the board)". Until today this
   view was a second full set of writers — the same eq/fader/place/send facts
   as the board, two data-k namespaces (`eng|…` and `b|…`), two controls per
   fact. The board is the one place a hand touches the sound now; this table
   PRINTS the voice's strip — bright where the record says a word, dim where
   the answer is derived — and points at the board to change it. The third
   column (what the value is riding on) survives, because it was always the
   best thing about this view. */
export function engineer(parent, ctx, voiceName) {
  const doc = ctx.doc();
  const chans = DD().channelVoicesOf(doc, GENRES);
  const me = chans.find((c) => c.voice.name === voiceName);
  if (!me) return;                       // a voice with no channel has no strip
  const key = me.key, voice = me.voice, d = deskOf(voice);
  const sec = atBox();
  const drv = sec ? derivedPartTone(sec, key) : { db: 0, eq: null };
  const base = sec ? deskChannelBase(sec, key) : { rev: 0, del: 0, pan: 0, gain: 1 };
  const pct = (x) => Math.round((x || 0) * 100) + "%";

  if (ctx.heading) ctx.heading(parent, "the engineer");
  else parent.append(el("h3", "the engineer"));

  const t = el("table");
  t.className = "nu-eng nu-mirror";
  const row = (label, yours, riding) => {
    const tr = el("tr");
    tr.append(el("th", label));
    const td = el("td", yours == null || yours === "" ? "default" : yours);
    if (yours == null || yours === "") td.className = "is-dflt";
    tr.append(td);
    const td2 = el("td", riding == null ? "" : riding);
    td2.className = "nu-hint"; tr.append(td2);
    t.append(tr);
  };
  for (const b of EQ_BANDS)
    row(b.label, d.eq && d.eq[b.key] ? fmtDb(d.eq[b.key]) + " dB" : null,
        drv.eq && drv.eq[b.key] ? "riding " + fmtDb(drv.eq[b.key]) : "flat");
  row("fader", d.fader ? fmtDb(faderDb(d.fader)) + " dB" : null,
      "riding " + fmtDb(drv.db) + " dB seated");
  row("level", d.lvl ? (LEVELLABEL[d.lvl] || d.lvl) : null,
      "the record seats it at " +
      fmtDb(20 * Math.log10(Math.max(1e-4, base.gain || 1))) + " dB");
  row("pan", d.pan ? (PANLABEL[d.pan] || d.pan) : null,
      "the record sits at " + (base.pan || 0).toFixed(2));
  row("→ " + busName("echo"), d.echo ? (SENDLABEL[d.echo] || d.echo) : null,
      pct(base.del) + " into " + busName("echo"));
  row("→ " + busName("rev"), d.rev ? (SENDLABEL[d.rev] || d.rev) : null,
      pct(base.rev) + " into " + busName("rev") + " — " + genreAsk(sec));
  const slots = slotsOf(voice);
  row("inserts", slots.length
        ? slots.map((s) => FXLABEL[s.k] || s.k).join(" → ") : null,
      slots.length ? "wet and settings on the board" : "");
  row("cut / alone", (d.mute ? "cut" : "") + (d.mute && d.solo ? " · " : "") +
      (d.solo ? "alone" : "") || null, "");
  const tp = el("div");
  tp.className = "nu-pane";
  tp.tabIndex = 0;
  // WHICH PANE THIS IS ACROSS A REBUILD (ui/eight.js keepPanes/putPanes,
  // 2026-08-25) — keyed by the voice, since a mirror carries no [data-k]
  // control of its own to key on.
  tp.dataset.pane = "mirror|" + voiceName;
  tp.append(t);
  parent.append(tp);
  const go = el("p", null, "nu-hint");
  const a = document.createElement("a");
  a.href = "#board"; a.textContent = "set it on the board";
  go.append(document.createTextNode("read-only — one writable owner per fact, and it is the board. "), a);
  parent.append(go);
}

/* ======================= VIEW 2 · THE ONE BOARD =========================== */
let CURRENT = null;

export function mount(parent, ctx) {
  const host = ctx.section
    ? ctx.section(parent, "board", "The board")
    : (() => { const s = el("section"); s.className = "nu-ax"; s.id = "board";
               s.append(el("h2", "The board")); parent.append(s); return s; })();
  const doc = ctx.doc();
  const chans = DD().channelVoicesOf(doc, GENRES);
  const sec = atBox();
  const anySolo = chans.some((c) => deskOf(c.voice).solo);
  const shut = returnShut();
  const facts = (() => { try { return channelFacts(playing && playingSec >= 0
    ? playingSec : 0) || {}; } catch (e) { return {}; } })();
  const drives = [];            // { el, key } — the model readout per strip

  const note = el("p", "down a strip reads in signal order: instrument → three"
    + " inserts (each with its own wet) → sends, tapped after the inserts → EQ"
    + " → pan → the fader. Dim is derived, bright is set; the green bar on the"
    + " main strip is measured.", "nu-hint");
  host.append(note);

  /* ================= THE STRIPS ================= */
  const board = el("div", null, "nu-strips");
  board.id = "strips";
  for (const c of chans) {
    const voice = c.voice, key = c.key, d = deskOf(voice);
    const off = anySolo && !d.solo;
    const strip = el("article", null, "nu-strip" + (off || d.mute ? " is-off" : ""));
    strip.dataset.ch = key;
    strip.setAttribute("aria-label", voice.name + " strip");
    const head = el("header");
    head.append(el("b", voice.name, "nu-sname"));
    head.append(el("small", (voice.instrument || voice.kind || "") + " · " + key));
    strip.append(head);

    // ---- inserts: up to three, in order --------------------------------
    const srow1 = el("div", null, "nu-srow");
    srow1.append(el("p", "inserts · up to three · in order", "nu-rowlab"));
    const stereoWhy = facts[key] && facts[key].stereo ? STEREO_WHY : null;
    const slots = slotsOf(voice);
    for (let i = 0; i < MAX_FX; i++)
      srow1.append(slotEl(ctx, voice, slots, i, stereoWhy));
    strip.append(srow1);

    // ---- sends: four, post-insert --------------------------------------
    const srow2 = el("div", null, "nu-srow");
    srow2.append(el("p", "sends · post-insert", "nu-rowlab"));
    const sends = el("div", null, "nu-sends");
    sends.append(col("genre", vrefused("b|genre|" + voice.name,
      voice.name + " send to the genre bus", "not wired", GENRE_WHY_LONG)));
    sends.append(col(busName("echo"), vknob("b|echo|" + voice.name, "echo",
      SENDS, SENDLABEL, d.echo, voice.name + " send to " + busName("echo"),
      (v) => setDesk(ctx, voice, "echo", v), "default")));
    const revK = vknob("b|rev|" + voice.name, "rev",
      SENDS, SENDLABEL, d.rev, voice.name + " send to " + busName("rev"),
      (v) => setDesk(ctx, voice, "rev", v), "default");
    { const inp = revK.querySelector("input");
      inp.title = genreAsk(sec) + "; a part send adds to it, so absent adds nothing"; }
    sends.append(col(busName("rev") + (shut ? " (shut)" : ""), revK));
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
    for (const [k2, label] of [["mute", "cut"], ["solo", "alone"]]) {
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
    drives.push({ el: drive, key });
    fw.append(duo);
    srow5.append(fw);
    strip.append(srow5);

    const goes = el("p", null, "nu-goes");
    goes.append(document.createTextNode("→ "));
    goes.append(el("b", busName("echo") + " · " + busName("rev") + " · main"));
    strip.append(goes);
    board.append(strip);
  }
  host.append(board);

  /* ================= THE BUS RACK · IN SERIES ================= */
  // one line, top to bottom: genre → delay → reverb → main (Paul, 2026-08-27:
  // "Have one bus for genre specific effects, into a delay bus, into reverb,
  // into main"). Arrows make the topology; each plate carries its REAL knobs
  // and nothing else. The delay and reverb stages are fields.js BUSROWS bus 2
  // and bus 1 — the engine's own two accumulators — wearing the series' order.
  const rack = el("div", null, "nu-rack");
  rack.id = "rack";
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
  const feeds = deskBusFeed(sec, MASTER, BUSES);
  const busSays = [];           // { el, bus } — model in/out lines per plate

  rack.append(flow("the strips send into every stage below"));

  // -- the genre bus: the one genuinely new stage, and it is not wired ------
  {
    const p = el("div", null, "nu-plate is-off");
    p.dataset.bus = "genre";
    p.setAttribute("aria-label", "genre fx bus");
    const h = el("div", null, "nu-bushead");
    h.append(el("b", "genre fx bus", "nu-busname"));
    h.append(el("small", "in ← the strips' genre sends · chain dealt by the" +
      " genre at compose", "nu-busin"));
    p.append(h);
    const r = el("div", null, "nu-busrow");
    // `x|…` and not `bus|…`, deliberately: `bus|<bus>|<knob>` keys name
    // registry rows (fields.js BUSES) and desk-gate walks that pairing; a
    // refused slider names no row, so it wears a namespace the walk ignores.
    r.append(col("level → delay", vrefused("x|genre|level",
      "genre bus level into the delay bus", "not wired", GENRE_WHY_LONG)));
    r.append(el("small", GENRE_WHY_LONG, "nu-why"));
    p.append(r);
    rack.append(p);
  }
  rack.append(flow("into the delay bus"));

  // -- the delay bus: fields.js bus 2, its real knobs -----------------------
  {
    const p = el("div", null, "nu-plate");
    p.dataset.bus = "echo";
    p.setAttribute("aria-label", "delay bus");
    const h = el("div", null, "nu-bushead");
    h.append(el("b", "delay bus · " + busName("echo"), "nu-busname"));
    h.append(el("small", "in ← the strips' " + busName("echo") + " sends", "nu-busin"));
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
    // THE BLEED, REFUSED WITH ITS REASON — the series the engine half-does
    // already (one-board §IV.2): delay pours into reverb at a fixed 0.2.
    r.append(col("bleed → reverb", vrefused("x|echo|bleed",
      "delay bus bleed into the reverb bus", "a constant", BLEED_WHY_LONG, true)));
    const says = el("small", "", "nu-busmodel nu-hint");
    says.dataset.live = "model";   // the clock writes it, so it says so
    r.append(says);
    busSays.push({ el: says, bus: "echo" });
    p.append(r);
    p.append(el("small", BLEED_WHY_LONG, "nu-why"));
    rack.append(p);
  }
  rack.append(flow("into the reverb bus"));

  // -- the reverb bus: fields.js bus 1 --------------------------------------
  {
    const p = el("div", null, "nu-plate");
    p.dataset.bus = "rev";
    p.setAttribute("aria-label", "reverb bus");
    const h = el("div", null, "nu-bushead");
    h.append(el("b", "reverb bus · " + busName("rev"), "nu-busname"));
    h.append(el("small", "in ← the strips' " + busName("rev") +
      " sends + the delay's fixed bleed", "nu-busin"));
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
    if (shut) p.append(el("small", "every strip above is sending into a return" +
      " whose gain is zero — open it on this return", "nu-why"));
    rack.append(p);
  }
  rack.append(flow("into main — the record"));

  // -- the main -------------------------------------------------------------
  const HOMELESS = { width: 1, tilt: 1, ceiling: 1 };
  const mv = (k) => (doc.sound && doc.sound.master && doc.sound.master[k]) || "";
  let masterMeter = null;
  {
    const p = el("div", null, "nu-plate");
    p.dataset.bus = "main";
    p.setAttribute("aria-label", "main");
    const h = el("div", null, "nu-bushead");
    h.append(el("b", "main · the record", "nu-busname"));
    h.append(el("small", "in ← the strips' dry + the reverb bus out · out → " +
      "the speakers", "nu-busin"));
    p.append(h);
    const g = el("div", null, "nu-gear");
    for (const f of MASTER_FIELDS) {
      const why = HOMELESS[f.key] ? MASTER_WHY : null;
      const s = selectEl({
        key: "master|" + f.key, label: f.label,
        options: optionsFor(f.table, f.labels, mv(f.key), null, "default"),
        value: mv(f.key),
        ...(why ? { why } : {}),
        set: (v) => { DD().writeMaster(doc, f.key, v); ctx.changed(); },
      });
      const pl = labelled(g, f.label, s);
      if (why) { pl.classList.add("is-off");
        const w = el("small", "reaches no sound", "nu-why");
        w.title = why; pl.append(w); }
    }
    p.append(g);
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
    /* the record's own character — the one multiple-selection control
       (sound.fx, every seated voice; kept from the previous board: it is a
       RECORD fact, which is board stuff by Paul's own 2026-08-26 division,
       and the 2026-08-27 sentence adds per-voice slots beside it rather than
       retiring it) */
    {
      const rec = DD().boxFxOf(doc);
      const wrap = el("div", null, "nu-rec");
      wrap.append(el("p", "…and what the whole record is dipped in — every " +
        "seated voice at once.", "nu-hint"));
      sheet(wrap, {
        key: "master.fx", label: "character",
        multi: true, max: MAX_FX,
        maxWhy: "three is the limit on the record's chain — the fourth was refused",
        options: Object.keys(FX).map((k) => {
          const on = rec.includes(k);
          if (!on && rec.length >= MAX_FX)
            return { value: k, label: FXLABEL[k] || k, disabled: true,
                     why: "three is the limit on the record's chain" };
          return { value: k, label: FXLABEL[k] || k };
        }),
        value: rec.map(String),
        set: (list) => { DD().writeBoxFx(doc, list); ctx.changed(); },
      });
      wrap.append(el("p", "hold ⌘ (or Ctrl) to pick a second and a third — a" +
        " plain tap replaces the whole selection, which is what a <select" +
        " multiple> does.", "nu-hint"));
      p.append(wrap);
    }
    p.append(el("p", "the bar's volume slider is the room, not the record —" +
      " unchanged, unsaved", "nu-goes"));
    rack.append(p);
  }
  host.append(rack);

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
    wrap.append(el("p", "section automation · a word is a trim on the strip's" +
      " fader for that section · sections run down · tap a cell to cycle",
      "nu-rowlab"));
    const pane = el("div", null, "nu-pane");
    pane.tabIndex = 0;
    // the keepPanes key (ui/eight.js, 2026-08-25): the grid is one pane and
    // its sideways scroll must survive the redraw every cell tap causes.
    pane.dataset.pane = "trimgrid";
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
      th.append(el("small", " " + s2.bars + " bars"));
      tr.append(th);
      for (const c of chans) {
        const td = el("td");
        const cur = (deskOf(c.voice).trim || {})[s2.id] || "";
        const b = el("button", WSHOW(cur), "nu-trimbtn w-" + (cur || "mid"));
        b.type = "button";
        b.dataset.k = "t|" + c.voice.name + "|" + s2.id;
        b.setAttribute("aria-label", c.voice.name + " in " + s2.id + ": " +
          (cur === "" ? "as mixed" : cur));
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
    wrap.append(el("p", "vocabulary: out · hush · back · — (as mixed) · fwd ·" +
      " lift — fields.js TRIMS, in dB on the fader; `out` is the cut. Absent" +
      " is as mixed, which is today, byte for byte.", "nu-hint"));
    host.append(wrap);
  }

  /* ---- the routing and refusal sentences, once, under the rack ---------- */
  // A GROUP HAS NO PLATE ANY MORE, and the sentence saying so is the reversal
  // written down: bus 3 and bus 4 (2026-08-26's groups) left the surface on
  // 2026-08-27 when Paul named the series — "one bus for genre specific
  // effects, into a delay bus, into reverb, into main" — and the groups are
  // not in the line. Their sends and aims still LOAD and still SOUND
  // (fields.js busRoute, audio/desk.js feedSplit — an old save is untouched);
  // there is simply no knob for them here, because a knob must point at a
  // stage the board draws.
  const edges = el("ul", null, "nu-hint");
  edges.append(el("li", MAIN_TO_BUS1.from + " → " + MAIN_TO_BUS1.to +
    ": set it with the main strip's `" + MAIN_TO_BUS1.knob + "` above — " +
    MAIN_TO_BUS1.why));
  for (const e of FIXED_EDGES)
    edges.append(el("li", e.from + " → " + e.to + ": " + e.why));
  edges.append(el("li", "bus 3 and bus 4 (the groups of 2026-08-26) keep " +
    "their saved sends and aims in the record and in the engine " +
    "(fields.js busRoute), and draw no plate here: the 2026-08-27 series — " +
    "genre → delay → reverb → main — is the rack, on Paul's word."));
  host.append(edges);
  const refusals = el("ul", null, "nu-hint nu-refusals");
  for (const w of [GENRE_WHY_LONG, MAINSEND_WHY, BLEED_WHY_LONG, METER_WHY,
                   STEREO_WHY, SWEEP_WET_WHY, MASTER_WHY])
    refusals.append(el("li", w));
  host.append(refusals);

  /* ---- the paint, once a beat off the page's own on("pos") -------------- */
  const paint = () => {
    const s = atBox();
    for (const x of drives) {
      const g = liveGain(s, x.key);
      x.el.textContent = "model " + fmtDb(20 * Math.log10(Math.max(1e-4, g))) + " dB";
    }
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
  const w = el("small", "the room, not the record — not saved with the song", "nu-hint");
  wrap.append(w);
  return wrap;
}

// THE THREE THAT REACH NO SOUND, in one sentence, so the master strip's cells
// and any gate reading them back quote the same words.
const MASTER_WHY = "this one round-trips and draws but reaches no sound" +
  " — audio/desk.js:769 names all three and says why";
