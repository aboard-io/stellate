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
/* ...AND THE TWO READERS THE PER-VOICE METER NEEDS (2026-09-02, slice 2e).
   `soundingChans()` is the SCHEDULE after the desk (barPlan has already
   dropped every event a mute or an automation word silenced), so it is a
   PLAYHEAD — clock red, never green. `voiceLevels()` is the MEASUREMENT —
   `{ chairKey: rms }`, and a chair with no tap and no audit is ABSENT from it
   rather than reported as 0, because 0 is a claim of silence about a voice
   nobody measured. Both are pure readers on nukernel/audio/live.js and this
   file calls them from inside the page's own `on("pos")` beat: a view never
   installs a clock of its own. */
import { playing, playingSec, getPosition, passAt, rmsNow,
         soundingChans, voiceLevels } from "../audio/live.js";
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
/* ...AND `selectField` BESIDE IT SINCE 2026-09-02. The bus and master plates
   built their own `<p class="nu-sel"><label>` by hand (`labelled` below), which
   meant every menu in the rack was a BARE `<select>` — no `.nu-combo` chassis,
   no default detent, no filter on a long list. The probe of that morning
   counted them: *"Raw `<select>`s bypass `.nu-combo` on: Mix genre fx (sel|bus
   |genre|name fx1 fx2 fx3), delay (name time fb tone), reverb (name color),
   main (drive glue tape space width tilt ceiling)."* `selectField` is the one
   owner of that chassis and it takes the same spec `selectEl` does, so this is
   the wrapper being asked for rather than being re-drawn.
   THE GRID CELLS ARE NOT CONVERTED and that is by design: a `<td>` has no room
   for a label paragraph, and ui/selects.js's own header says the bare form
   exists "for a table cell". */
import { selectEl, selectField } from "./selects.js";
/* THE CATALOGUE (TABLE.md §12b). Every word this file prints is a KEY read
   here at the moment it is printed; a dB value goes through `fmt` so the sign
   and the decimal are made in one place. Three local names that shadowed these
   imports were renamed on 2026-09-05 rather than the imports being aliased:
   `line` for the legend string, `stage` for a board tab, `show` for a
   slider's own formatter. */
import { t, tn, fmt } from "./copy.js";
/* THE WORD GRID (2026-09-02, wave 4). Paul: *"make those tables of dropdowns
   full of tappable grids that change options rather than dropdowns — like the
   other selection table in mix … institutionalize it."* "The other selection
   table in mix" is the section-automation grid in this file, so this import is
   the shape being lifted out rather than copied in: `PLATES.auto` keeps every
   fact about trims and hands the component every fact about what a word grid
   IS. Four surfaces share it now. */
import { wordGrid } from "./wordgrid.js";
/* THE ONE CURVE EDITOR (src/envelope -> ui/envelope.js), in its `eq` mode.
   TABLE.md §11: one owner for every plate-handles-curve control on this page —
   the chair sheets' ADSR, the automation lanes, this strip's EQ and the
   modelled chair's XY pad are the same component with a different mode. A
   second EQ widget anywhere on this page would be the bug that law exists to
   refuse. */
import { curveEditor } from "./envelope.js";
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
// reachable; what ended is this file's need for them.
// ...AND `GLYPH`, `icon` AND `paintIcon` CAME OFF IT 2026-09-02, with the tab
// ROW (Paul: "five subicons under the 'Mix' icon"). The five marks are drawn
// by the gutter now, off the same `GLYPH.bus` table, so this file spells no
// character at all — which is the strongest form of the one-owner rule the
// paragraph above spent 2026-08-28 arguing its way back to.

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
/* THE PLATE'S TITLE, WITHOUT SAYING ITS OWN NAME TWICE (2026-08-29). Each bus
   head read `"genre fx bus · " + busName("genre")`, and busNameOf answers the
   row's own LABEL when no name is set — so the shipped default plate read
   "GENRE FX BUS · GENRE FX", one fact printed twice in its own headline
   (measured on the rendered Mix tab at 390px). The ` · name` clause is FOR the
   set name — "delay bus · throw" is a plate and what it is called — so it is
   printed exactly when a name IS set: when busNameOf's answer differs from
   what it answers with no store at all. One owner (busNameOf) for both. */
const busTitle = (bus, plate) => {
  const n = busName(bus);
  return n === NuFields.busNameOf(null, bus) ? plate : plate + " \u00b7 " + n;
};
function returnShut() {
  const st = masterState(MASTER, BUSES);
  return !st || !(st.reverb > 0);
}
function genreAsk(sec) {
  const g = (sec && GENRES[gid(sec)]) || {};
  const v = g.tone && g.tone.verb != null ? g.tone.verb : 0.15;
  return t("board.send.rev.title", { value: fmt(v) });
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
/* THE REASON IS THE SAME AND THE ARGUMENT IS A COMMENT NOW (2026-09-05, the
   functional text pass): the dry path to the main IS the fader below, one
   owner per fact, so this send is parked rather than drawn as a second gain on
   the same wire. The user reads the first clause; the rest stays here. */
const MAINSEND_WHY = t("board.mainSend.why");
// THE BLEED WAS REFUSED and is LIVE as of 2026-08-27 (same round). The refusal
// read: "the bleed is a constant in the DSP — not wired: fx_bus.dsp:221 runs
// the delay into the reverb at the literal 0.2 (`d*0.2`)… a .dsp edit plus a
// recompile plus the byte-parity gates, which is not this page's to take."
// The engine round took it: `bleed` is an fx_bus slider now (default 0.2 = the
// literal, byte-identical at the default on two pressed records), rev_bleed
// mirrors it for colored rooms, and buses.echo.bleed (fields.js EBLEEDS) is
// the hand — masterState -> state.bleed -> fxParams.
/* METER_WHY IS RETIRED, 2026-09-02 (slice 2e), THE WAY THE BLEED ABOVE WAS.
   It read: "one master tap — the engine sums every voice into shared buses
   (render-core.js), so there is no per-channel signal to measure; the dim
   number beside the fader is the MODEL's gain, and a green bar here would be
   a fake measurement." It was drawn on every strip by `vrefused(null, …, "no
   tap", METER_WHY, true)`.

   IT WAS A FACT ABOUT THE WIRING AND NOT ABOUT THE WORLD, and the wiring
   changed. Paul, B11: *"Light up which instrument is playing, make a little
   volume meter INSIDE the heading."* Slice 0b took the engine work the
   refusal's own words implied: engine/faust/live/live.js `samplerOf` gives
   every unit key its own gain → AnalyserNode on the way to the shared dry bus
   and exposes `handle.voiceRms(key)`; the Faust lane, which is rendered in a
   worker and owns no node, is measured instead by the bar audit's own rms
   (`auditFor(serial).voices[unit].rms`); and nukernel/audio/live.js
   `voiceLevels()` joins both to CHAIR keys through the newly exported
   `plan.js addrOf(si)`. test/meter-reach.browser.js proves rms > 0 on a chair
   that is sounding, on the rendered page, with the engine actually running.

   SO THE REFUSAL IS DELETED RATHER THAN SOFTENED — "a refusal that has been
   kept is not a refusal" (the file's own law, MASTER_WHY's tombstone). What
   replaces it is the SAME well the main plate draws, fed from the per-voice
   measurement, and what it must go on being honest about is the GRAIN: a
   sampled chair is measured per frame, a Faust chair per bar, the well says
   which in its title, and a chair with neither number draws an EMPTY well
   saying "not yet measured — plays first". Absent is still not zero. */
/* SAME TWO REFUSALS, AND THE MODULE NAMES ARE COMMENTS (2026-09-05). STEREO:
   the parent's insert path is mono and a chain would fold this voice's width
   to one channel (audio/desk.js `widthKept`), so the seats are refused rather
   than silently stripped. SWEEP: the module declares no mix param — a swept
   resonant lowpass is a replacement, not a blend — so there is no wet. */
const STEREO_WHY = t("board.stereo.why");
const SWEEP_WET_WHY = t("board.sweepWet.why");

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
  const head = [{ value: "", label: emptyLabel, group: t("value.default") }];
  return head.concat(Object.keys(table).map((k) => {
    const g = gate ? gate(k) : null;
    const isCur = String(cur) === k;
    if (g && isCur)
      return { value: k, label: (labels && labels[k]) || k,
               group: t("board.group.words"), quiet: true,
               why: t("board.currentAnyway.why", { why: g }) };
    return { value: k, label: (labels && labels[k]) || k,
             group: t("board.group.words"),
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
  d.splice(i, 0, { v: "", w: emptyLabel == null ? t("value.default") : emptyLabel,
                   n: dflt });
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
  const show = opts.fmt || ((v) => String(v));
  const out = el("output", show(+input.value), "nu-vs-val");
  input.addEventListener("input", () => { out.textContent = show(+input.value); });
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
  input.setAttribute("aria-label", t("board.aria.refused", { name: aria }));
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
   shape song.js's loader has always validated); the wet is the effect's OWN mix
   param surfaced (fields.js FXWETS -> params.mix, clamped by the parent's own
   insertChain), and the one-or-two settings are the module's own face params
   (FXFACE, ranges read off engine/faust/dist insert_*-meta.json). An effect
   changed in a seat RESETS that seat's knobs — a fraction of another module's
   range is not a value, it is a coincidence.

   ...AND THE GENRE BUS TAKES THE SAME DRAWING, 2026-09-03. Paul: *"The 'genre
   bus' doesn't really make a lot of sense. I was expecting it to just be three
   effects I could set normally. It has this concept of chips. We don't need all
   that, just a set of chained effects that can be fed."* The bus had three bare
   `<select>`s of effect NAMES ("chip 1..3") while this file, forty lines down,
   was already drawing the honest thing on every voice strip: a seat, its wet,
   its own one or two settings. So there is ONE drawing and two OWNERS of it —
   the second drawing is exactly the mistake `channelStrip`'s own note is about
   ("two drawings of one fact, and the ugly one was where Paul was standing").

   AN OWNER ANSWERS FOUR QUESTIONS and nothing else: what a slot's controls are
   KEYED (`seatK`/`knobK` — the `data-k` a gate drives), what they are CALLED
   (`seatAria`/`knobAria`/`faceAria`), what the slots ARE right now (`read`),
   and how a change is WRITTEN (`write` for a whole re-seat, `setKnob` for one
   pot). A voice writes `voice.desk` through NuDeskDoc.writeDesk and numbers its
   knobs by LIST POSITION; a bus writes `doc.sound.buses.<bus>` through
   writeBus and numbers them by SLOT. That difference is the whole of what an
   owner is for, and it is the same difference fields.js `fxChainFor` and
   `busFxChain` carry on the audio side. */
function voiceSlotOwner(ctx, voice) {
  return {
    seatK: (n) => "ins|" + voice.name + "|" + n,
    knobK: (kind, n) => "b|" + kind + n + "|" + voice.name,
    seatAria: (n) => t("board.slot.insert.aria", { name: voice.name, n }),
    knobAria: (n, word) => t("board.slot.insert.knob.aria",
                             { name: voice.name, n, word }),
    faceAria: (n, k, label) => t("board.slot.face.aria",
                                 { name: voice.name, fx: k, label }),
    read: () => slotsOf(voice),
    write: (slots) => writeSlots(ctx, voice, slots),
    setKnob: (n, kind, v) => setDesk(ctx, voice, kind + n, v),
  };
}
/* THE BUS OWNER. `fx<n>`/`fxw<n>`/`fxa<n>`/`fxb<n>` are the row's own keys
   (fields.js BUSROWS, genre) — `fx1..3` unchanged from the day the bus was
   built, which is why every saved session opens onto these slots with the same
   three effects rather than being migrated or dropped. A HOLE COMPACTS on
   read, the same way a voice's list has always compacted: a save with slot 1
   empty and slot 2 seated draws one effect in seat 1 and writes itself back
   that way on the next touch. Order is slot order either way — fields.js
   busFxChain walks 1..3 and skips what is not there. */
function busSlotOwner(ctx, doc, bus, name) {
  const row = () => (doc.sound && doc.sound.buses && doc.sound.buses[bus]) || {};
  return {
    seatK: (n) => "bus|" + bus + "|fx" + n,
    knobK: (kind, n) => "bus|" + bus + "|" + kind + n,
    seatAria: (n) => t("board.slot.effect.aria", { name, n }),
    knobAria: (n, word) => t("board.slot.effect.knob.aria", { name, n, word }),
    faceAria: (n, k, label) => t("board.slot.face.aria", { name, fx: k, label }),
    read: () => {
      const e = row(), out = [];
      for (let n = 1; n <= MAX_FX; n++) {
        const k = e["fx" + n];
        if (!k || !FX[k]) continue;
        out.push({ k, w: e["fxw" + n] || null, a: e["fxa" + n] || null,
                   b: e["fxb" + n] || null });
      }
      return out;
    },
    write: (slots) => {
      const D = DD();
      for (let n = 1; n <= MAX_FX; n++) {
        const s = slots[n - 1] || {};
        D.writeBus(doc, bus, "fx" + n, s.k || null);
        D.writeBus(doc, bus, "fxw" + n, s.w || null);
        D.writeBus(doc, bus, "fxa" + n, s.a || null);
        D.writeBus(doc, bus, "fxb" + n, s.b || null);
      }
      ctx.changed();
    },
    setKnob: (n, kind, v) => { DD().writeBus(doc, bus, kind + n, v); ctx.changed(); },
  };
}
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
// one seat's MENU: default "—" + the FX vocabulary. Keyed by the owner
// (`ins|voice|n` on a strip, `bus|genre|fx<n>` on the bus).
//
// IT WAS A BARE `<select>` UNTIL 2026-09-06, and it was the last one on the
// page — the header of this file counted them in Paul's own words (*"Raw
// `<select>`s bypass `.nu-combo` on: Mix genre fx"*), fixed the bus PLATES with
// `selectField` and left the fifteen SEATS behind. They go through
// `ui/menus.js` now, which is the one owner of every menu on this page: twelve
// words, so a thumb gets the native picker and a keyboard gets the typed combo,
// and either way the seat wears the page's own plate, its ▾ and its detent
// (`is-seated` / `is-said`, which have a stylesheet, where the bare `seated` /
// `said` this wrote had none).
//
// THE ADDRESS DID NOT MOVE, WHICH IS THE MEASUREMENT THAT MAKES THIS A SWAP:
// `data-k` is still `own.seatK(n)` exactly — `spec.k` exists in the menu API
// for this caller, because nukernel/desk-gate.js drives these at that literal
// string — and `data-sel` is the same key, so the seats join the menu census
// they should always have been in.
function seatSelect(ctx, own, slots, i, why) {
  const cur = slots[i] ? slots[i].k : null;
  const taken = slots.map((s, j) => (j === i ? null : s.k));
  const words = [{ value: "", label: "—", group: t("value.default") }];
  for (const k of Object.keys(FX)) {
    const w = { value: k, label: FXLABEL[k] || k, group: t("board.group.words") };
    // AN EFFECT SEATS ONCE PER CHAIN: the slots are a chain and the same pedal
    // twice in it is the same pedal once, louder about it.
    if (taken.includes(k) && k !== cur) {
      w.disabled = true; w.why = t("board.seatTaken.why");
    }
    words.push(w);
  }
  const key = own.seatK(i + 1);
  const sel = selectEl({ key, k: key, label: own.seatAria(i + 1),
    options: words, value: cur || "", why: why || null,
    set: (word) => {
      const next = slots.slice();
      if (!word) { if (i < next.length) next.splice(i, 1); }
      else if (i < next.length) next[i] = { k: word, w: null, a: null, b: null };
      else next.push({ k: word, w: null, a: null, b: null });
      own.write(next);
    } });
  let whyEl = null;
  // ...AND THE SENTENCE, NOT THE WORD "refused". It printed the short word while
  // the seat had no `data-sel` and so was invisible to test/selects.js's census;
  // it is a menu now, check 5's *"every one of those reasons is printed on the
  // page"* reads it, and it was right to: a control that is off and says only
  // "refused" is the silent grey with one syllable in front of it.
  if (why) whyEl = refuse(sel.querySelector("[data-sel]") || sel, why, why);
  return { sel, whyEl };
}
// one whole slot: seat + wet + the effect's own one-or-two settings
function slotEl(ctx, own, slots, i, stereoWhy) {
  const box = el("div", null, "nu-slot" + (slots[i] ? "" : " is-empty"));
  box.dataset.slot = String(i + 1);
  const row = el("div", null, "nu-slotrow");
  row.append(el("b", String(i + 1), "nu-slotn"));
  const { sel, whyEl } = seatSelect(ctx, own, slots, i, stereoWhy);
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
  // THE WET IS THE EFFECT'S OWN MIX PARAM, SURFACED — or refused where the
  // module has none (fields.js fxHasMix: only `sweep`, whose sentence is on
  // the control itself — `title`, `data-why` and the short word beside it —
  // since the page-foot digest was deleted 2026-08-28).
  if (NuFields.fxHasMix(s.k)) {
    const dfltMix = NuFields.fxMix(s.k);
    body.append(col(t("board.col.wet"), vknob(own.knobK("fxw", n), null,
      NuFields.FXWETS, NuFields.FXWETLABEL, s.w,
      own.knobAria(n, t("board.col.wet")),
      (v) => own.setKnob(n, "fxw", v), t("value.default"), dfltMix)));
  } else {
    body.append(col(t("board.col.wet"),
      vrefused(null, own.knobAria(n, t("board.col.wet")),
      t("board.sweepWet.short"), SWEEP_WET_WHY)));
  }
  // ...AND ITS OWN SETTINGS: the module's declared face params, in the
  // module's own units (fields.js FXFACE, off the dist manifests), as
  // fractions of their own span so one detent table serves every effect.
  const face = NuFields.FXFACE[s.k] || [];
  const dfltFrac = (spec) => {
    const dv = FX[s.k].params[spec.key];
    if (dv == null) return 0;
    return Math.max(0, Math.min(1, (dv - spec.min) / (spec.max - spec.min)));
  };
  if (face[0]) body.append(col(face[0].label,
    vknob(own.knobK("fxa", n), null, NuFields.FXPOTS,
      NuFields.FXPOTLABEL, s.a, own.faceAria(n, s.k, face[0].label),
      (v) => own.setKnob(n, "fxa", v), t("value.default"), dfltFrac(face[0]))));
  if (face[1]) body.append(col(face[1].label,
    vknob(own.knobK("fxb", n), null, NuFields.FXPOTS,
      NuFields.FXPOTLABEL, s.b, own.faceAria(n, s.k, face[1].label),
      (v) => own.setKnob(n, "fxb", v), t("value.default"), dfltFrac(face[1]))));
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
  strip.setAttribute("aria-label", t("board.strip.aria", { name: voice.name }));
  const head = el("header");
  head.append(el("b", voice.name, "nu-sname"));
  head.append(el("small", (voice.instrument || voice.kind || "") + " · " + key));
  strip.append(head);

  // ---- inserts: up to three, in order --------------------------------
  // `nu-srow-ins`: the three slots sit SIDE BY SIDE in the width the tab
  // bought, and stack again under ~460px (nu.css).
  const srow1 = el("div", null, "nu-srow nu-srow-ins");
  srow1.append(el("p", t("board.row.inserts"), "nu-rowlab"));
  const stereoWhy = env.facts[key] && env.facts[key].stereo ? STEREO_WHY : null;
  const own = voiceSlotOwner(ctx, voice);
  const slots = own.read();
  for (let i = 0; i < MAX_FX; i++)
    srow1.append(slotEl(ctx, own, slots, i, stereoWhy));
  strip.append(srow1);

  // ---- sends: four, post-insert --------------------------------------
  const srow2 = el("div", null, "nu-srow");
  srow2.append(el("p", t("board.row.sends"), "nu-rowlab"));
  const sends = el("div", null, "nu-sends");
  // UN-REFUSED 2026-08-27 (the series-bus engine round). This column was
  // drawn refused — "the genre bus is engine work — not wired" — and the
  // engine work happened: fx_bus grew nothing, the RENDERERS grew a fifth
  // accumulator (stream-renderer/press `gen`) whose chained return sums into
  // the DELAY bus, so the send is a real wire: genre → delay → reverb →
  // main. The word is desk `genre` (fields.js PARTMIX, SENDS family).
  sends.append(col(t("noun.genre"), vknob("b|genre|" + voice.name, "genre",
    SENDS, SENDLABEL, d.genre, t("board.send.aria.genre", { name: voice.name }),
    (v) => setDesk(ctx, voice, "genre", v), t("value.default"))));
  sends.append(col(busName("echo"), vknob("b|echo|" + voice.name, "echo",
    SENDS, SENDLABEL, d.echo,
    t("board.send.aria.bus", { name: voice.name, bus: busName("echo") }),
    (v) => setDesk(ctx, voice, "echo", v), t("value.default"))));
  const revK = vknob("b|rev|" + voice.name, "rev",
    SENDS, SENDLABEL, d.rev,
    t("board.send.aria.bus", { name: voice.name, bus: busName("rev") }),
    (v) => setDesk(ctx, voice, "rev", v), t("value.default"));
  { const inp = revK.querySelector("input");
    inp.title = genreAsk(env.sec); }
  sends.append(col(env.shut ? t("board.bus.shut", { name: busName("rev") })
                            : busName("rev"), revK));
  sends.append(col(t("board.bus.main.name"), vrefused("b|main|" + voice.name,
    t("board.send.aria.main", { name: voice.name }),
    t("board.mainSend.short"), MAINSEND_WHY)));
  srow2.append(sends);
  strip.append(srow2);

  /* ---- eq: A SHELF IS A CURVE (2026-09-05, TABLE.md §11) --------------
     Paul: *"Look for places where UX could help like eq editors too."* §11's
     own test for this family is *"Each replaces its number rows only where the
     drawing is the honest control (a shelf is a curve; a bar count is a
     number), and prints the numbers beside the curve"* — and three vertical
     sliders labelled lo / mid / hi are the clearest case of it on this page.
     They were three unrelated numbers; they are the one thing a hand is
     deciding, which is where this instrument sits against the others.

     WHAT STOOD HERE: three `vnum` columns, `min -12 max 12 step 0.5`, each
     writing one band of `voice.desk.eq` through `setDesk`. The RANGE and the
     STEP below are those, read off the control rather than invented — and the
     ±12 is `fields.js EQ_RANGE`, which is the same number `eqDb` clamps a save
     to, so the plate cannot offer a gain the loader would quietly trim.

     THE ADDRESSES DO NOT MOVE. Each handle wears the exact `data-k` its slider
     wore — `b|eqlo|<voice>`, `b|eqmid|`, `b|eqhi|` — because this repo's
     standing law is that an address does not move when a widget does and
     nukernel/desk-gate.js drives the desk by name. Nothing was renamed here,
     and the three columns leave: two controls on one address is the shape
     test/selects.js's own guard fails a page for.

     AND THE CURVE IS THE ENGINE'S OWN. `fields.js EQ_BANDS` carries the type,
     the frequency and the bell's Q, and `graph.js buildEq` puts those three
     straight onto a BiquadFilterNode — so `src/envelope/bands.ts` draws the
     RBJ magnitude of the biquads the renderer builds, not a picture of them. */
  const srow3 = el("div", null, "nu-srow");
  srow3.append(el("p", t("board.row.eq"), "nu-rowlab"));
  const eqbox = el("div", null, "nu-eqwrap");
  {
    const RANGE = NuFields.EQ_RANGE;
    const eqNow = () => deskOf(voice).eq || {};
    const bandWord = (b) => b.label.replace(/^eq\s*/, "");
    try {
      curveEditor(eqbox, {
        mode: "eq",
        k: "b|eq|" + voice.name,
        label: t("board.eq.aria", { name: voice.name, band: t("board.row.eq") }),
        lo: -RANGE, hi: RANGE, step: 0.5, unit: "dB",
        /* THE DRAWN SPAN. Under the low shelf's own 120 Hz and over the high
           shelf's 7.2 kHz, so both shelves have a shoulder to show; inside the
           master's unconditional 10 Hz highpass and 20.5 kHz lowpass, so the
           plate never draws a frequency the record cannot pass. */
        fLo: 40, fHi: 18000,
        bands: EQ_BANDS.map((b) => ({
          key: b.key,
          k: "b|eq" + b.key + "|" + voice.name,
          label: bandWord(b), freq: b.freq, type: b.type, q: b.q,
          /* ABSENT IS FLAT, and absent is the only spelling of it — `writeDesk`
             deletes a band that lands on 0 and `eqIsFlat` deletes the map when
             all three do, so `null` here is what the record says and 0 is what
             stands. */
          value: eqNow()[b.key] != null ? +eqNow()[b.key] : null,
          derived: 0,
        })),
        set: (key, v) => { const next = { ...eqNow() }; next[key] = v;
                           setDesk(ctx, voice, "eq", next); },
        clear: (key) => { if (key == null) { setDesk(ctx, voice, "eq", null); return; }
                          const next = { ...eqNow() }; delete next[key];
                          setDesk(ctx, voice, "eq", next); },
      });
    } catch (e) { /* the plate is the control; a strip without one is caught by
                     desk-gate's own reachability walk, not papered over here */ }
  }
  srow3.append(eqbox);
  strip.append(srow3);

  // ---- pan: a left/right fact, five detents --------------------------
  // BUTTONS AND NOT A SLIDER, per the sketch's own panrow: five stops is a
  // detent row a thumb can hit, and `place` was the collision the rename
  // table killed ("pan — the one universal word"). Tapping the stop the
  // record is on CLEARS it — absent is the only spelling of a default, and
  // there is no other way to spell it with buttons.
  const srow4 = el("div", null, "nu-srow");
  srow4.append(el("p", t("field.pan"), "nu-rowlab"));
  const panrow = el("div", null, "nu-panrow");
  panrow.setAttribute("role", "group");
  panrow.setAttribute("aria-label", t("board.pan.aria", { name: voice.name }));
  const marks = { l: "L", hl: "l", c: "C", hr: "r", r: "R" };
  const cur = d.pan || null;
  const word = el("p", cur ? (PANLABEL[cur] || cur) : t("value.default"),
    "nu-panword" + (cur ? "" : " is-dflt"));
  for (const p of Object.keys(PANS)) {
    const b = el("button", marks[p], "nu-panbtn");
    b.type = "button";
    b.dataset.k = "b|pan|" + voice.name + "|" + p;
    b.setAttribute("aria-label", t("board.pan.btn.aria",
      { name: voice.name, word: PANLABEL[p] || p }));
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
  srow5.append(el("p", t("board.row.fader"), "nu-rowlab"));
  const fw = el("div", null, "nu-fadwrap");
  const fout = { o: null };
  const fader = vnum("b|fader|" + voice.name, {
    min: -24, max: 12, step: 0.5, value: faderDb(d.fader),
    aria: t("board.fader.aria", { name: voice.name }), tall: true,
    fmt: (v) => fmtDb(v),
    set: (v) => setDesk(ctx, voice, "fader", v) });
  fw.append(col(t("field.level"), fader));
  /* THE METER WELL, MEASURED — 2026-09-02. It was `vrefused(null, …, "no tap",
     METER_WHY, true)` for as long as the engine had one tap; METER_WHY's
     tombstone at the head of this file carries the whole reversal. The well is
     the main plate's own markup, stood tall in the strip's trough, and it is
     fed by `paintVoiceMix` off `voiceLevels()` — the same map and the same
     honesty rule the automation plate's column heads use, so a voice's own
     strip and its column in the grid cannot disagree about how loud it is. */
  {
    const wellWrap = el("span", null, "nu-vs nu-vs-tall");
    const well = el("span", null, "nu-meterwell");
    well.dataset.live = "meter";       // the clock writes it, so it says so
    const wbar = el("i", null, "nu-meterbar");
    well.append(wbar);
    const wout = el("output", "", "nu-vs-val");
    wout.dataset.live = "meter";
    wellWrap.append(well, wout);
    fw.append(col(t("noun.meter"), wellWrap));
    (env.meters = env.meters || []).push({ chan: key, well, bar: wbar, out: wout,
      said: null,
      grain: (env.facts[key] || {}).sampled ? "per frame" : "per bar" });
  }
  const duo = el("div", null, "nu-duo");
  // mute/solo WEAR THEIR OWN NAMES since 2026-08-27 (FUTURE.md §5: "cut"
  // collided with EQ cut three rows up; the desk keys were always mute/solo,
  // so the buttons stop translating them).
  for (const [k2, key2] of [["mute", "board.tgl.mute"],
                            ["solo", "state.solo"]]) {
    const label = t(key2);
    const b = el("button", label, "nu-tgl");
    b.type = "button";
    b.dataset.k = "b|" + k2 + "|" + voice.name;
    b.setAttribute("aria-label",
                   t("board.tgl.aria", { name: voice.name, word: label }));
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
  // WHAT THE NUMBER IS, for a hand reading the code rather than the page:
  // `deskChannelBase().gain` × the section's level automation, per beat.
  drive.title = t("board.drive.title");
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
/* ===== WHAT A SEAT IS DOING, IN ONE LINE (2026-09-07, TABLE.md §10b step 3)
   The MIX row of the Band table draws one cell per voice column and the cell's
   collapsed face is that seat's own word. It is asked HERE and not computed in
   ui/eight.js for the reason every other reading on this surface is: the
   arithmetic is the strip's — `faderDb` is the one clamp every fader on this
   machine takes and `fmtDb` is how this file prints a decibel — and a second
   spelling of "−3.0 dB" would be a second owner of the number the strip under
   the cell is showing. A CHANNEL THE DESK DOES NOT SEAT SAYS SO rather than
   printing a silent zero: `channelVoicesOf` is the audio tier's own answer to
   which voices have a strip at all, and "0 is a claim of silence about a voice
   nobody measured" is this file's oldest law. */
export function seatWord(doc, name) {
  const v = ((doc && doc.voices) || []).find((x) => x.name === name);
  if (!v) return "\u2014";
  let seated = true;
  try { seated = DD().channelVoicesOf(doc, GENRES)
    .some((c) => c.voice.name === name); } catch (e) { seated = true; }
  if (!seated) return t("board.seat.noChannel");
  /* NOTHING WRITTEN IS AN EM DASH, WHICH IS THIS TABLE'S OWN SPELLING FOR IT
     and not a shrug: the cell is `is-derived` (dim) beside it, and the words
     it would otherwise carry — "as mixed" — MEASURED at 56px, the width of a
     player's column at 390, as "as mi". A cell says what a hand has done to
     this seat; a seat nobody has touched has nothing to say and the strip
     under it says what the genre dealt. */
  const d = deskOf(v);
  const out = [];
  const db = faderDb(d.fader);
  if (db) out.push(fmtDb(db));
  if (d.pan) out.push(PANLABEL[d.pan] || d.pan);
  if (d.mute) out.push(t("state.muted"));
  if (d.solo) out.push(t("state.solo"));
  const n = slotsOf(v).length;
  if (n) out.push(tn("board.count.fx", n));
  return out.length ? out.join(" \u00b7 ") : "\u2014";
}
/** ...and whether a HAND put any of it there, which is the dim-is-derived
 *  reading every cell in this table makes. Every key below is one a strip
 *  writes; absent is the only spelling of a default on this desk. */
export function seatWritten(doc, name) {
  const v = ((doc && doc.voices) || []).find((x) => x.name === name);
  if (!v) return false;
  const d = deskOf(v);
  if (d.fader || d.pan || d.mute || d.solo || d.genre || d.echo || d.rev)
    return true;
  if (d.eq && Object.keys(d.eq).some((k) => d.eq[k])) return true;
  return slotsOf(v).length > 0;
}

export function voiceMix(parent, ctx, voiceName) {
  const doc = ctx.doc();
  const chans = DD().channelVoicesOf(doc, GENRES);
  const c = chans.find((x) => x.voice.name === voiceName);
  if (ctx.heading) ctx.heading(parent, t("special.mix.word"));
  else parent.append(el("h3", t("special.mix.word")));
  if (!c) {
    /* THE DESK SEATS A KIT ONLY ONCE IT IS HIRED (desk-doc
       `channelVoicesOf`), so there is no strip to draw rather than an empty
       one. The reason is here; the page says the fact. */
    const w = el("p", t("board.strip.noChannel.why", { name: voiceName }), "nu-why");
    parent.append(w);
    MIX = null;
    return;
  }
  const env = { anySolo: chans.some((x) => deskOf(x.voice).solo),
                sec: atBox(), shut: returnShut(), facts: factsNow(),
                // `meters` JOINED `drives` 2026-09-02: the strip now carries a
                // MEASURED well beside its model readout (METER_WHY's
                // tombstone at the head of this file), and both are written
                // once a beat by `paintVoiceMix` off the page's own on("pos").
                drives: [], meters: [] };
  // `.nu-strips` AND NOT `#strips`. The class is the skin (nu.css, the grid
  // and the 100% width Paul asked every table and grid for on 2026-08-28);
  // the ID belonged to the board's panel and stays there, because two nodes
  // wearing one id is the bug a gate cannot see round. Keyed for the gates and
  // for a person's own muscle memory as `#voicemix`, which is what this is.
  const host = el("div", null, "nu-strips");
  host.id = "voicemix";
  host.setAttribute("aria-label", t("board.strip.aria", { name: voiceName }));
  host.append(channelStrip(ctx, c, env));
  parent.append(host);
  // WHERE IT GOES, said on the voice as well as on the board. The strip's own
  // footer already draws the four destinations (`.nu-goes`); this is the way
  // to the plates that answer for them, and it is a LINK and not a copy of
  // their controls — one owner per fact, and the buses' owner is the board.
  const go = el("p", null, "nu-hint");
  const a = document.createElement("a");
  a.href = "#board"; a.textContent = t("board.link.buses");
  go.append(a);
  parent.append(go);
  // the model readout under the fader is written once a beat by the page's own
  // `on("pos")` feed — see `paintVoiceMix`, and the [data-live] law on the
  // `.nu-drive` element itself.
  MIX = { drives: env.drives, meters: env.meters || [], host };
  sayDrives(env.drives);            // the first reading, before the first beat
  sayMeters(MIX.meters);            // ...and the first well, empty and captioned
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
    ? ctx.section(parent, "board", t("board.title"))
    : (() => { const s = el("section"); s.className = "nu-ax"; s.id = "board";
               s.append(el("h2", t("board.title"))); parent.append(s); return s; })();
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
  let masterMeter = null;       // the master's measured meter, on the main plate
  /* ...AND ONE PER COLUMN HEAD ON THE AUTOMATION PLATE (2026-09-02, slice 2e).
     Same shape as `busSays` and `masterMeter` and reset in the same line of
     `showPanel`: a plate's handles belong to the plate that is open, and a
     handle left over from the last one would be a beat's worth of writes into
     a detached node. Each entry is `{ chan, th, well, bar, said }` — `said` is
     the last title written, so the honest/measured swap costs a string compare
     per beat rather than a DOM write. */
  let headMeters = [];
  /* AND THE OPEN WORD GRID, IF THE FIFTH PLATE IS THE ONE ON THE BOARD
     (2026-09-02, wave 4). `paint()` used to walk `#trimgrid tbody tr` and
     toggle `.now` by `+tr.dataset.sec`; the grid is a ui/wordgrid.js instance
     now and lighting it is a METHOD it hands back, which is also what keeps the
     accordion's own inserted `<tr>` out of the walk. Cleared with the other
     paint targets in `showPanel` for the reason they are: a handle left over
     from the last plate is a beat's worth of writes into a detached node. */
  let autoGrid = null;

  // COMPRESSED 2026-08-27 (the text diet, FUTURE.md §2: "signal flow is drawn
  // as arrows, not narrated"). It read 230 chars narrating the strip order the
  // strip's own row labels and footer arrows already draw; what stays is the
  // three-word legend no control carries.
  /* ...AND THE THIRD CLAUSE IS ONLY TRUE ON TWO OF THE FIVE PLATES
     (2026-09-02). The line was fixed prose, written once, above whichever
     plate happened to be open — and the probe of that morning caught what that
     claims: *"'green is measured' legend on Mix, but genre fx / delay / reverb
     plates carry NO meter well and the genre-fx fader fill is blue. Either a
     measured bus well (if the engine can measure a bus return) or drop the
     legend clause from those plates."*
     THE ENGINE CANNOT MEASURE A BUS RETURN — `voiceLevels()` is a per-CHAIR
     tap and `rmsNow()` is the master's, and this board has refused a fake
     measurement in writing since METER_WHY was written ("0 is a claim of
     silence about a voice nobody measured") — so the clause comes off the
     plates that have no well rather than a well being invented for them.
     Two plates have one: `main` (the master meter) and `auto` (a well per
     column head). The other three are words and faders.
     IT IS REPAINTED BY `showPanel`, which is a HAND (a tap on the gutter's
     plate row), never the clock. */
  const note = el("p", "", "nu-hint");
  note.dataset.k = "board.legend";
  const WELLED = { main: true, auto: true };
  const sayLegend = () => {
    const line = t(WELLED[BOARDTAB.key] || BOARDTAB.kind === "auto"
                     ? "board.legend.measured" : "board.legend");
    if (note.textContent !== line) note.textContent = line;
  };
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
  /* ONE MENU IN THE RACK, WITH THE CHASSIS ON IT (2026-09-02). `word` is the
     LABEL A HAND READS and it is now also the control's accessible name: the
     two used to disagree on three of these menus ("called" on the page,
     "name" in the tree; "reverb type" against "color"), which is one fact
     wearing two names for no reason anybody could state. The registry's own
     `spec.label` is the fallback, so a knob whose visible word is its
     registry word passes nothing extra. */
  const busSel = (g, busKey, spec, word) => selectField(g, {
    key: "bus|" + busKey + "|" + spec.key, label: word || spec.label,
    options: optionsFor(spec.table, spec.labels, bv(busKey, spec.key), null,
                        t("value.default")),
    value: bv(busKey, spec.key),
    set: (v) => { DD().writeBus(doc, busKey, spec.key, v); ctx.changed(); },
  });
  /* `labelled` STILL EXISTS AND IS STILL THE HAND-BUILT ROW, for the controls
     in this rack that are NOT menus (the faders and the wells build their own
     chassis). Every `<select>` it used to wrap goes through `selectField`
     now. */
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
  // it lands on the delay bus — series into everything downstream.
  //
  // THREE CHAINED EFFECTS, SET NORMALLY, 2026-09-03. Paul: *"The 'genre bus'
  // doesn't really make a lot of sense. I was expecting it to just be three
  // effects I could set normally. It has this concept of chips. We don't need
  // all that, just a set of chained effects that can be fed."* What stood here
  // were three `busSel` menus of effect NAMES, labelled "chip 1..3" — a word
  // for a decision, out of the era when this surface's law was "chips are
  // decisions, sliders are fiddles" — and nothing else: no wet, no settings,
  // while the voice strips six hundred lines up have carried all three per seat
  // since 2026-08-27. So the bus takes THE STRIP'S OWN SLOT DRAWING (`slotEl`,
  // one drawing and two owners) through `busSlotOwner`, the word "chip" leaves
  // the page, and every knob a slot draws is a value fields.js `busFxChain`
  // reads and hands the engine. Nothing about the FEED changed and it is the
  // point of the bus: the per-voice `genre` sends already on every strip.
  PLATES.genre = () => {
    const p = el("div", null, "nu-plate");
    p.dataset.bus = "genre";
    p.setAttribute("aria-label", t("board.bus.genre.name"));
    const h = el("div", null, "nu-bushead");
    h.append(el("b", busTitle("genre", t("board.bus.genre.name")), "nu-busname"));
    h.append(el("small", t("board.bus.genre.in"), "nu-busin"));
    p.append(h);
    const g = el("div", null, "nu-gear");
    busSel(g, "genre", knobOf("genre", "name"), t("board.bus.sel.called"));
    p.append(g);
    // THE CHAIN. Same slot the strips draw, in slot order, keyed
    // `bus|genre|fx<n>` at the seat and `bus|genre|fxw<n>`/`fxa<n>`/`fxb<n>`
    // at its three knobs — the row's own keys, so a saved session's `fx1..3`
    // opens onto these seats unchanged and untouched knobs sound exactly as
    // they always did.
    const ins = el("div", null, "nu-srow nu-srow-ins");
    ins.append(el("p", t("board.bus.genre.chain"), "nu-rowlab"));
    const own = busSlotOwner(ctx, doc, "genre", t("board.bus.genre.slots"));
    const slots = own.read();
    for (let i = 0; i < MAX_FX; i++) ins.append(slotEl(ctx, own, slots, i, null));
    p.append(ins);
    const r = el("div", null, "nu-busrow");
    const spec = knobOf("genre", "level");
    r.append(col(t("board.col.levelDelay"),
      vknob("bus|genre|level", "level", spec.table,
      spec.labels, bv("genre", "level"), t("board.aria.genreLevel"),
      (v) => { DD().writeBus(doc, "genre", "level", v); ctx.changed(); },
      t("value.default"), 1, true)));
    p.append(r);
    p.append(flow(t("board.flow.delay")));
    return p;
  };

  // -- the delay bus: fields.js bus 2, its real knobs -----------------------
  PLATES.echo = () => {
    const p = el("div", null, "nu-plate");
    p.dataset.bus = "echo";
    p.setAttribute("aria-label", t("board.bus.echo.name"));
    const h = el("div", null, "nu-bushead");
    h.append(el("b", busTitle("echo", t("board.bus.echo.name")), "nu-busname"));
    h.append(el("small", t("board.bus.echo.in", { name: busName("echo") }),
      "nu-busin"));
    p.append(h);
    const g = el("div", null, "nu-gear");
    busSel(g, "echo", knobOf("echo", "name"), t("board.bus.sel.called"));
    busSel(g, "echo", knobOf("echo", "time"), t("board.bus.sel.time"));
    busSel(g, "echo", knobOf("echo", "fb"), t("board.bus.sel.repeats"));
    busSel(g, "echo", knobOf("echo", "tone"), t("noun.tone"));
    p.append(g);
    const r = el("div", null, "nu-busrow");
    const spec = knobOf("echo", "ret");
    r.append(col(t("board.col.returnMain"),
      vknob("bus|echo|ret", "ret", spec.table,
      spec.labels, bv("echo", "ret"), t("board.aria.echoRet"),
      (v) => { DD().writeBus(doc, "echo", "ret", v); ctx.changed(); },
      t("value.default"), 1, true)));
    // THE BLEED, LIVE 2026-08-27 (series-bus round) — it was refused here as
    // "a constant" while fx_bus ran the literal `d*0.2`; the literal is the
    // `bleed` slider now (default 0.2 = as shipped, byte-identical) and
    // buses.echo.bleed is its one hand: masterState -> state.bleed -> fxParams,
    // rev_bleed mirrored so a colored room hears the same knob.
    { const bspec = knobOf("echo", "bleed");
      r.append(col(t("board.col.bleedReverb"), vknob("bus|echo|bleed", "bleed",
        bspec.table, bspec.labels, bv("echo", "bleed"),
        t("board.aria.echoBleed"),
        (v) => { DD().writeBus(doc, "echo", "bleed", v); ctx.changed(); },
        t("value.default"), 0.2, true))); }
    const says = el("small", "", "nu-busmodel nu-hint");
    says.dataset.live = "model";   // the clock writes it, so it says so
    r.append(says);
    busSays.push({ el: says, bus: "echo" });
    p.append(r);
    p.append(flow(t("board.flow.reverb")));
    return p;
  };

  // -- the reverb bus: fields.js bus 1 --------------------------------------
  PLATES.rev = () => {
    const p = el("div", null, "nu-plate");
    p.dataset.bus = "rev";
    p.setAttribute("aria-label", t("board.bus.rev.name"));
    const h = el("div", null, "nu-bushead");
    h.append(el("b", busTitle("rev", t("board.bus.rev.name")), "nu-busname"));
    h.append(el("small", t("board.bus.rev.in", { name: busName("rev") }),
      "nu-busin"));
    p.append(h);
    const g = el("div", null, "nu-gear");
    busSel(g, "rev", knobOf("rev", "name"), t("board.bus.sel.called"));
    busSel(g, "rev", knobOf("rev", "color"), t("board.bus.sel.reverbType"));
    p.append(g);
    const r = el("div", null, "nu-busrow");
    const spec = knobOf("rev", "ret");
    r.append(col(t("board.col.returnMain"),
      vknob("bus|rev|ret", "ret", spec.table,
      spec.labels, bv("rev", "ret"), t("board.aria.revRet"),
      (v) => { DD().writeBus(doc, "rev", "ret", v); ctx.changed(); },
      t("value.default"), 0, true)));
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
    if (shut) p.append(el("small", t("board.bus.rev.shut.why"), "nu-why"));
    p.append(flow(t("board.flow.main")));
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
  /* ===== THE MASTER TILT IS NOT DRAWN AS A CURVE, AND HERE IS WHY =========
     (2026-09-05, the round that gave the strip its EQ curve. TABLE.md §11
     names it in the same sentence: *"the per-voice EQ … and the master tilt as
     an EQ CURVE with draggable bands"*, so its absence is said here rather
     than left to be found.)

     WHAT IT IS, MEASURED: `fields.js MASTER` row `tilt` is a WORD over a table
     of five — `TILTS = { none: 0, dark: -4, warm: -2, clear: 2, bright: 4 }` —
     resolved by `resolveMaster` and landing on `audio/desk.js masterState` ->
     the fx_bus `mtilt` param, ONE first-order split about 1 kHz. It reaches
     the sound; that is not the objection.

     §11'S OWN TEST IS WHAT REFUSES IT: *"Each replaces its number rows only
     where the drawing is the honest control (a shelf is a curve; a bar count
     is a number)."* This is not a number row. It is a five-word vocabulary,
     which DESIGN.md component 10 gives to the one menu owner, and a plate with
     a draggable handle would draw a CONTINUUM over a fact the record stores as
     five words: a thumb would slide it and feel it click to positions the
     plate cannot name, and the number printed beside the handle ("−2.0 dB")
     would be a number no save contains. The seat eq is the opposite case in
     every way — three continuous gains, ±12 dB at 0.5, stored as the numbers
     the handles write — which is why that one is a curve today.

     WHAT WOULD MAKE IT ONE, so the next round has the two lines rather than
     the argument: `tilt` becomes a NUMBER in `fields.js` (the five words kept
     as detents on it, the way `faderDb` clamps a continuous fader), or the
     master grows a numeric `mtilt` beside the word. Either is a fields.js
     change with a migration for 139 shipped records, and it is a spec change
     first and code second (DESIGN.md's own opening line).

     AND ONE MEASURED CONSTRAINT THE NEXT ROUND WILL MEET: `nukernel/desk-gate.js`
     drives this plate by name — it asserts `[data-sel="master|tilt"]` exists,
     offers TILTS's own words and opens with `none`, and that all seven master
     words are LIVE — so the day the widget changes, that walk changes with it.
     An address does not move when a widget does; the WIDGET moving is what the
     gate would have to be told about. */
  PLATES.main = () => {
    const p = el("div", null, "nu-plate");
    p.dataset.bus = "main";
    p.setAttribute("aria-label", t("board.bus.main.name"));
    const h = el("div", null, "nu-bushead");
    h.append(el("b", t("board.bus.main.plate"), "nu-busname"));
    h.append(el("small", t("board.bus.main.in"), "nu-busin"));
    p.append(h);
    const g = el("div", null, "nu-gear");
    for (const f of MASTER_FIELDS) {
      selectField(g, {
        key: "master|" + f.key, label: f.label,
        options: optionsFor(f.table, f.labels, mv(f.key), null,
                            t("value.default")),
        value: mv(f.key),
        set: (v) => { DD().writeMaster(doc, f.key, v); ctx.changed(); },
      });
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
        off.textContent = t(isNone ? "board.master.off" : "board.master.on");
        off.setAttribute("aria-pressed", isNone ? "true" : "false");
        off.title = t(isNone ? "board.master.off.title"
                             : "board.master.on.title");
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
      r.append(col(t("time.gain"), vnum("level", {
        min: 0.5, max, step: 0.25,
        value: doc.sound && doc.sound.level != null ? doc.sound.level : 1,
        /* THE MULTIPLIER SIGN LEADS THE NUMBER (\u00d72), which `fmt` cannot
           spell — its units follow. It is a mark on a readout, not a word. */
        aria: t("time.gain"), tall: true, fmt: (v) => "\u00d7" + v,
        set: (v) => { doc.sound = doc.sound || {}; doc.sound.level = v;
                      ctx.changed(); } })));
    }
    /* SURFACE — the crackle, on a hand's dial at last (2026-08-31).
       Paul: "how do I control the amount of crackle on noirhop it's way
       too much". He could not: `grain` shipped on ten rows the day before
       and had NO control anywhere — not in fields.js, not in avail.js. The
       box held the fact and gave nobody a way to reach it, which is the
       dead-knob law running in reverse and just as bad: a sound nobody can
       turn down is a sound nobody chose.
       It stands beside RECORD GAIN because it is the same KIND of fact —
       one number about the whole record, not a chair — and the same seam
       carries it: `doc.sound.grain` rides toGenre's tone the way
       `sound.level` rides its gain, and to-engine's grain pass already
       takes the MAX over seats (you cannot press half a record onto vinyl).
       Absent stays absent: at the genre's own value the field is deleted
       rather than written, so a row that declares no grain is byte-identical
       and the ten that do keep their measured castings until a hand moves
       them. 0 is a real value — silence is a choice — so the delete tests
       against the basis, never against zero. */
    {
      const base = ((GENRES[doc.basis] || {}).tone || {}).grain || 0;
      const cur = doc.sound && doc.sound.grain != null ? doc.sound.grain : base;
      r.append(col(t("board.col.surface"), vnum("grain", {
        min: 0, max: 1, step: 0.05, value: cur,
        aria: t("board.aria.surface"), tall: true,
        fmt: (v) => (v <= 0 ? t("board.surface.clean") : fmt(v * 100, "%")),
        set: (v) => { doc.sound = doc.sound || {};
                      if (Math.abs(v - base) < 1e-9) delete doc.sound.grain;
                      else doc.sound.grain = v;
                      if (!Object.keys(doc.sound).length) delete doc.sound;
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
      // THE NUMBER IS the engine's master RMS (audio/live.js `rmsNow`) —
      // said here, where a hand reading the code needs it, and not on a
      // tooltip, where a person listening does not.
      well.title = t("board.meter.title");
      const wellOut = el("output", "", "nu-vs-val");
      wellOut.dataset.live = "meter";   // the clock writes it, so it says so
      wellWrap.append(well, wellOut);
      masterMeter = { bar, out: wellOut };
      r.append(col(t("noun.meter"), wellWrap, "nu-metercol"));
    }
    r.append(col(t("board.col.listening"), listening()));
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

  /* ---- THE TAB ROW IS DELETED, 2026-09-02 (slice 2e) ---------------------
     Paul, the composer round, B11: *"Instead of having four icons on top and
     section automation that should have been five subicons under the 'Mix'
     icon. One of them is section automation."*

     THE FIVE ARE IN THE GUTTER (ui/eight.js `mixTrayItems`) and this row is
     gone with the marks it wore. Its own fence, written one wave ago when the
     row stood as a dated MIRROR of the nav, named the condition: "it comes out
     in wave 2e together with the desk-gate checks that drive it
     (G11/G12/G13)." They came out in the same commit — nukernel/desk-gate.js
     drives the board through `#nu-tray [data-k="boardtab|…"]` now, and the
     ADDRESSES DID NOT MOVE, which is the whole reason those three gates could
     follow a row that no longer exists.

     WHAT WENT WITH IT, said so that a reader of the gates knows what stopped
     being on the page rather than what stopped being asserted: `#boardtabs`,
     the `.nu-busgroup` role="group" ("the bus series"), the `.nu-seamlab`
     reading "the voices feed", the three `.nu-tabarrow` `→` glyphs and the
     stage numbers `.nu-n`. THE SEAM SENTENCE IS NOT RE-HOMED. It was proposed
     as the automation plate's caption and refused by the text diet
     (test/text-diet.test.js: the ceiling is re-earned, not raised, and a
     sentence naming furniture that is one panel away is exactly the prose that
     comes off); the FACT it carried — every voice's four sends land in this
     series — is still drawn by each plate's own `in ←` header and its footer
     connector, which is where the paragraph below already said the second
     owner of that picture was.

     THE ARGUMENT THAT BUILT THE ROW IS KEPT BELOW, UNEDITED, because two of
     its three claims outlived it: the series is still legible (the gutter
     draws the five in signal order, and desk-gate G12 asserts the order off
     the NAV's own rows now), and a plate still says for itself who feeds it
     and what it feeds. Only the third — that a `<p class="nu-row">` inside the
     panel is where the marks go — is reversed. ==========================

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
  /* THE FACE FIELDS CAME OFF THIS LIST 2026-09-02, WITH THE ROW THAT WORE
     THEM. It carried `glyph`, `num` and `say` per stage — the mark, the stage
     number and the sentence — and the gutter draws all three now off the same
     `GLYPH.bus` table (ui/eight.js `mixTrayItems`), so keeping a second copy
     here would be the drift this file's own import comment warns about. What
     the list is FOR is unchanged and is why it survives the row: it is the
     registry's answer to "which stages exist, in series order", which is what
     validates `BOARDTAB` below and what `busLabel` names a rack after. */
  const TABS = busKeys.map((k) => ({ kind: "bus", key: k, label: busLabel(k) }))
    .concat([{ kind: "bus", key: "main", label: "main" }]);
  // the open tab survives a redraw; a stage the registry stopped declaring
  // does not. (It read "a voice that left the bank does not" while the voices
  // were tabs — same line, same law, and now the only thing that can leave the
  // row is an engine bus.)
  /* ...AND THE FIFTH CHILD IS IN THE LIST THIS CHECKS AGAINST, 2026-09-02.
     THIS WAS A REAL BUG AND THE GATE CAUGHT IT, which is worth writing down
     rather than fixing quietly. `TABS` is the four BUS stages; the automation
     grid is `{ kind: "auto", key: "auto" }`, so the line above answered "that
     is not a stage the registry declares" and reset the open plate to `genre`
     — on EVERY rebuild, which means on every `ctx.changed()`, which means on
     every tap of a trim cell. The grid could be opened and could not be
     WORKED: one cell tap and the board threw you back to the genre plate.
     It did not happen while the grid was appended to the host (it stood under
     whichever plate was open and belonged to no tab), so it arrived with the
     fifth plate and was invisible to every check that opened a plate without
     then editing on it — nukernel/desk-gate.js G15, which taps a cell six
     times, is the one that found it.
     THE LIST IS THEREFORE "WHICH CHILDREN THIS BOARD DRAWS" and not "which
     stages the registry declares"; the two were the same thing until the grid
     joined them. The law it enforces is unchanged and is why it exists: an
     open plate survives a redraw, and a stage the registry stopped declaring
     does not. */
  const CHILDREN = TABS.concat([{ kind: "auto", key: "auto",
                                  label: t("board.auto.label") }]);
  if (!CHILDREN.some((x) => x.kind === BOARDTAB.kind && x.key === BOARDTAB.key))
    BOARDTAB = CHILDREN[0] ? { kind: CHILDREN[0].kind, key: CHILDREN[0].key }
                           : { kind: "bus", key: null };

  /* ===== THE PLATE ROW IS BACK, AND THIS TIME IT IS THE ONLY OWNER =======
     (2026-09-07, TABLE.md §10b step 3.) It stood here until 2026-09-02, was
     deleted as a dated MIRROR of the gutter's five rows, and its own fence said
     what would end it. What ends it now is the other half: the MIX PANE IS
     DELETED, the gutter has no `Mix` branch to hang `mixTrayItems` on, and a
     board whose five plates could only be switched from a tray that no longer
     exists is four plates lost — the loss T7 refuses.
     SO THE ROW COMES BACK WITH THE SAME ADDRESSES IT ALWAYS HAD:
     `boardtab|bus|<key>` and `boardtab|auto|auto`, which is what
     nukernel/desk-gate.js's `openBus` has driven since the buses became tabs.
     An address does not move when a row does, and this one has now moved
     twice without moving.
     WHAT IS NOT RE-DRAWN: the `.nu-busgroup`, the `.nu-seamlab` ("the voices
     feed") and the three `→` glyphs. The seam sentence was refused by the text
     diet when it was proposed as a caption and it is refused again; the arrows
     drew a series that each plate's own `in ←` header and footer connector
     already draw. This is five buttons and a `<mark>`, which is the idiom every
     row of marks on this page wears. */
  const tabsBar = el("p", null, "nu-row");
  tabsBar.id = "boardtabs";
  tabsBar.setAttribute("role", "group");
  tabsBar.setAttribute("aria-label", t("board.tabs.aria"));
  const tabBtn = new Map();
  const markTabs = () => {
    for (const [k, b] of tabBtn) {
      const on = k === BOARDTAB.kind + "|" + BOARDTAB.key;
      b.setAttribute("aria-pressed", String(on));
      const m = b.querySelector("mark");
      if (m) m.replaceWith(...m.childNodes);
      if (on) { const mk = el("mark"); mk.append(...b.childNodes); b.append(mk); }
    }
  };
  for (const stage of CHILDREN) {
    /* THE WORD IS THE REGISTRY'S FOR THE FOUR BUSES AND `automation` FOR THE
       FIFTH. `CHILDREN` spells the grid "section automation" because that is
       what the RACK is labelled when it is open; on a button in a row of five
       it is the only word that is a sentence, and `automation` is the word the
       gutter's five rows wore for a wave and the word nukernel/desk-gate.js
       joins into the chain it asserts. The full sentence rides `title`. */
    const word = stage.kind === "auto" ? t("noun.automation") : stage.label;
    const b = el("button", word);
    b.type = "button";
    b.dataset.k = "boardtab|" + stage.kind + "|" + stage.key;
    /* THE ACCESSIBLE NAME IS THE STAGE'S OWN WORD AND NOTHING ELSE, because
       nukernel/desk-gate.js joins these five `aria-label`s into the chain it
       asserts — `genre fx → delay → reverb → main → automation` — and a name
       carrying a sentence would read as a chain of sentences. What the
       sentence is FOR rides `title`. */
    b.setAttribute("aria-label", word);
    b.title = t(stage.kind === "auto" ? "board.tab.auto.title"
                                       : "board.tab.bus.title");
    b.addEventListener("click", () => { showBoardHere(stage.kind, stage.key); });
    tabBtn.set(stage.kind + "|" + stage.key, b);
    tabsBar.append(b);
  }
  host.append(tabsBar);
  const showPanel = () => {
    busSays = []; masterMeter = null; headMeters = []; autoGrid = null;
    panel.textContent = "";
    const rack = el("div", null, "nu-rack");
    rack.id = "rack";
    const make = PLATES[BOARDTAB.key];
    if (make) rack.append(make());
    // the fifth plate is not a bus and has no BUSROWS label (2026-09-02); it
    // is the one word this file spells beside `main`, for the same reason.
    rack.setAttribute("aria-label", t("board.rack.aria", { name:
      BOARDTAB.kind === "auto" ? t("board.auto.label")
                               : busLabel(BOARDTAB.key) }));
    panel.append(rack);
    // the legend says what THIS plate can say — see its own block above
    sayLegend();
  };
  /* ===== THE DOOR THE GUTTER DRIVES THIS BOARD BY (2026-09-02) ==========
     `showPanel` is a closure inside `mount()` and stays that way — nothing
     outside this file may reach into the board's furniture. What leaves is a
     pair of FUNCTIONS on the module handle, in the shape `paintBoard` already
     takes: one that opens a plate (swap the rack, repaint the model readouts)
     and one that says which is open. eight.js `mixTrayItems` is the caller,
     and it is the ONLY caller now — `markTabs()` stood between these two lines
     and repainted an in-panel row of marks that this wave deleted. The GUTTER
     wears the mark instead, and it wears it without being told: `mixTrayItems`
     reads `boardTabNow()` when the stripe is painted, and the stripe is
     painted by the `draw()` the nav's own act already runs.
     A KIND THIS FILE DOES NOT DRAW IS REFUSED SILENTLY rather than left
     half-applied: `BOARDTAB` is the board's own state and a plate that does
     not exist would empty the rack. */
  const showBoardHere = (kind, key) => {
    if (!PLATES[key]) return false;
    BOARDTAB = { kind: kind || "bus", key };
    showPanel();
    markTabs();
    paint();
    return true;
  };
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
  /* ===== IT IS THE FIFTH PLATE NOW, 2026-09-02 ==========================
     Paul: *"Instead of having four icons on top and section automation that
     should have been five subicons under the 'Mix' icon. One of them is
     section automation."*

     THIS BLOCK WAS `{ … host.append(wrap); }` — built once, appended to the
     HOST rather than to the panel, so it stood under whichever plate was open
     and was not a tab at all (this file's own note said so: "a cross-voice
     table that is not per-bus"). That was the right shape while the board had
     four bus plates and one grid; it is the wrong one now that the grid is a
     sibling of the four in the gutter. Not a line inside it changed: the same
     `wrap`, the same `#trimgrid`, the same `data-pane="trimgrid"` scroll key,
     the same cells and the same `paint()` (which finds the table with
     `host.querySelector("#trimgrid")` and therefore does not care which box it
     is in). What changed is that it is RETURNED instead of appended, and
     `showPanel` seats it in `#rack` like every other plate. */
  /* ===== …AND IT IS A `ui/wordgrid.js` INSTANCE NOW, 2026-09-02 (wave 4) ==
     Paul, after using the composer: *"When we go into structure make those
     tables of dropdowns full of tappable grids that change options rather than
     dropdowns — like the other selection table in mix. This is a powerful
     element for editing a whole song — think on it and institutionalize it."*

     "LIKE THE OTHER SELECTION TABLE IN MIX" IS THIS TABLE, so what happened
     here is that the shape was LIFTED OUT rather than changed: every fact this
     block owned it still owns (which words there are, what a word is worth in
     dB, what the record deals where a hand is silent, which column is which
     chair), and every fact about what a word GRID is — the accordion, the
     refusal spelling, the sounding row and column, the pane — moved to the
     component that four surfaces now share.
     NOT ONE ADDRESS MOVED. `#trimgrid`, `data-pane="trimgrid"`,
     `data-live="trimrow"`, `t|<voice>|<secId>`, `col|<voice>` and
     `row|<secId>` are the same strings on the same nodes; nukernel/desk-gate.js
     and test/mix-heads.browser.js reach every one of them by name.
     WHAT CHANGED FOR A THUMB, and it is the one behaviour Paul asked to
     change: a tap used to CYCLE ("— → out → hush → …"), which is six taps to
     say `lift` and no way to see the six words at all. A tap now OPENS the six
     words under the row and the second tap says one. desk-gate G15 is
     rewritten to that gesture in place. */
  PLATES.auto = () => {
    /* IT IS A `.nu-plate` NOW, 2026-09-02 (slice 2e). It was a bare
       `.nu-autopanel` while it was the one thing on the board that was not a
       tab; it is the fifth child of the Mix icon, seated in `#rack` beside the
       four bus plates, and nukernel/desk-gate.js G11 asks the same question of
       all five ("one panel holds exactly one plate at a time"). A `data-bus`
       of `auto` is the address that answers it — the grid is not a bus and
       says so by spelling a word no BUSROWS row holds, exactly as the rack's
       own aria-label does two blocks up. */
    const wrap = el("div", null, "nu-autopanel nu-plate");
    wrap.dataset.bus = "auto";
    // compressed 2026-08-27 (text diet): the grid draws sections running down
    // and a tap teaches itself; what the label must say is what a word IS.
    wrap.append(el("p", t("board.auto.rowlab"), "nu-rowlab"));
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
    const facts0 = factsNow();
    /* ===== THE COLUMN HEADS, 2026-09-02 (slice 2e) =======================
       Paul, B11: *"the columns should list the instrument and when I click on
       the column head let me edit the instrument! Light up which instrument is
       playing, make a little volume meter INSIDE the heading."*

       IT READ `for (const c of chans) hr.append(el("th", c.voice.name));` —
       a plain `<th>` of the voice's NAME, no button, no instrument, no colour,
       no meter and no click, which is three of Paul's four sentences missing
       from one line.

       THE NAME LEADS AND THE INSTRUMENT IS THE SECOND LINE (2026-09-02, wave
       4 — the head was the other way up until the component unified the three
       column heads on this page). Both facts are still there and both are
       still asked for; what settles the order is that the gutter's rows, the
       roster's boxes and the Structure grids all say NAME over INSTRUMENT, and
       three surfaces saying one thing and a fourth saying it upside down is
       the drift a component exists to stop. `.nu-colname` and `.nu-colinstr`
       keep their meanings — the classes name the FACT, not the position.

       THE NAME IS KEPT AND IS NOT DECORATION: `voice.name` is the address
       every cell under this column already uses (`t|<voice.name>|<secId>`), so
       a head that named only the instrument would leave the column's own key
       unreadable on the page. Two Rhodes players are two columns.

       THE THREE FACTS THIS FILE DOES NOT OWN ARE ASKED FOR (`ctx.voiceFace`,
       `ctx.openVoice`, `ctx.secName`). The instrument LINE is the registry's
       word through ui/eight.js `playsWhat` — which is the only reader that
       gets a kit naming itself through its cast and a bass hired from the pool
       right — the colour SLOT is `vpaintOf`, and opening a player is four
       writes into ui/eight.js's own page state. Copying any of the three here
       would be the drift this file spent 2026-08-28 extracting its way out of.

       THE METER IS NOT THE MASTER'S RMS REPRINTED, which is the thing
       METER_WHY was defending and which would have been the easy fake. It is
       `voiceLevels()[chair]` — the engine's own per-unit tap (sampled chairs)
       or the bar audit's rms (Faust chairs) — and a chair that answers with
       neither shows an EMPTY well saying so. See `paint()` below. */
    const cols = chans.map((c) => {
      const face = (ctx.voiceFace && ctx.voiceFace(c.voice.name)) || {};
      const line = face.line || c.voice.instrument || c.voice.kind || "";
      /* THE WELL IS A SIBLING OF THE BUTTON, NOT A CHILD OF IT. A control
         inside a surface the clock writes is the shape test/motif-frozen A1
         forbids, and the rule is the page's discipline rather than this
         board's geometry (the board is outside `#app`, where the clock is free
         — which is exactly why it must declare itself by hand). */
      const well = el("span", null, "nu-meterwell nu-meterh");
      well.dataset.live = "meter";
      well.setAttribute("aria-hidden", "true");
      const bar = el("i", null, "nu-meterbar");
      well.append(bar);
      const o = { id: "col|" + c.voice.name, word: c.voice.name, sub: line,
        vi: face.slot >= 0 ? face.slot : null, extra: well,
        /* WITH NO INSTRUMENT TO NAME, THE NAME IS THE WHOLE LABEL and no key
           is needed: a player's name is data, not copy. */
        aria: line ? t("board.col.aria.on", { name: c.voice.name, inst: line })
                   : c.voice.name,
        title: t("board.col.title", { name: c.voice.name }),
        act: () => { if (ctx.openVoice) ctx.openVoice(c.voice.name); },
        chan: c };
      headMeters.push({ chan: c.key, th: null, well, bar, said: null,
                        // WHICH LANE THIS CHAIR IS MEASURED ON, so the title
                        // can say what the number IS: a sampled chair has a
                        // live AnalyserNode on its own unit (per frame), a
                        // Faust chair is rendered in a worker and owns no node,
                        // so its only honest number is the bar audit's own rms
                        // (per bar). audio/plan.js channelFacts is the owner of
                        // that fact and this file asks it rather than guessing.
                        grain: (facts0[c.key] || {}).sampled ? "per frame" : "per bar" });
      return o;
    });
    /* ===== THE ROW HEAD IS A JUMP, AND IT IS NAMED, 2026-09-02 =========
       Paul, B11: *"I need to be able to jump to a section somehow, by
       clicking on them when in automation."* And 2026-08-28: *"The sections
       are named so name them."*

       IT READ `const th = el("th", s2.id);` — the raw id, `s0`, which the
       2026-08-28 naming law has forbidden since the day it was written and
       which this file's own map wrote down as an outstanding contradiction
       ("the trim grid's row heads still print s2.id, which predates and
       contradicts this law"). Two sentences, one line: the head is a BUTTON
       carrying `secName(i)` — `verse 2` — and a tap on it puts the ear there.

       THE ID IS STILL THE ADDRESS AND ONLY THE ADDRESS: `row|<secId>`, the
       same `s2.id` every cell in the row already keys by. A name is not an
       address and an address is nobody's name for anything.

       THE JUMP IS `ctx.playFrom(si)` AND NEVER AN IMPORT. ui/eight.js's
       standing argument: a view "cannot import startAt without becoming a
       second door into the engine — so the page hands it the door it already
       has." Cold it seeks; playing it queues on the next bar line, and the
       wait now has a countdown — audio/live.js `announceJump`, added the same
       day for the same gesture, because a queued jump that says nothing for a
       whole box is a gesture nobody can tell landed.

       WHERE THE DIM NUMBERS COME FROM, on the row that causes them: the
       section's own dealt words. `shade` reads lvl and env, so a reader who
       wonders why a column of cells woke up can see the cause in the header
       rather than having to know the table. Absent words print nothing, which
       is what the record says.
       …AND THE SECTION'S PACE BESIDE THEM (2026-08-30, the five-walls
       follow-up): `pace` is dealt the same way (compose.js dealPaces) and was
       the one dealt word with no surface — the declared-but-invisible shape
       this page legislates against. DISPLAY ONLY, extracted off the box like
       lvl/env; a pace CONTROL would need the deal to read a hand back, and
       that is not asked.
         REVERSED 2026-09-02, and the sentence above is kept because its
         PREMISE is the interesting half and it was wrong. Paul, B7: *"Tap
         tempo, the tempo editor appears, same for key. The tempo editor does
         not reflect the richness of our tempo options."* The pace is the
         richest of them, so it has a control now — the Tempo panel's pace
         strip (the Time PANE's, ui/eight.js `timeAxis` — both deleted 2026-09-06;
         the questions are the table's TIME row and its section rows now),
         through the `form.pace` sheet.
         WHAT DOES NOT CHANGE IS THIS LINE. The row header still PRINTS the
         word and still owns no control — one owner per fact, and the owner is
         one tab over. */
    const rows = doc.form.sections.map((s2, si) => {
      const name = ctx.secName ? ctx.secName(si) : (s2.role || s2.id);
      const dealt = [(SONG[si] || {}).lvl, (SONG[si] || {}).env,
                     (SONG[si] || {}).pace].filter(Boolean).join(" · ");
      const bars = tn("count.bar", s2.bars);
      return { id: s2.id, k: "row|" + s2.id, word: name,
               sub: dealt ? t("board.row.sub", { bars, dealt }) : bars,
               aria: t("board.row.aria", { name }),
               title: t("board.row.title"),
               act: () => { if (ctx.playFrom) ctx.playFrom(si); } };
    });
    /* WORDS ON BOTH SIDES OF THE CELL, 2026-08-28. Paul: *"The settings you
       put into automation are floats. Mine are words. Make them all words
       please."* He is right and the mismatch was mine: a hand's trim printed
       `lift`, and the record's own dealt trim printed `+2.5` in the very same
       column — one grid answering one question in two vocabularies. The dealt
       dB is now said in the SAME words the hand writes, by naming the nearest
       TRIMS rung, so a column reads as one list of words whether the box wrote
       it or you did.
       WHY THE WORD AND NOT THE NUMBER, given that yesterday's argument for the
       number was that rounding -2.0 to `back` prints a value that is not the
       value in play: because the cell is not the owner of that value —
       `derivedTrim` is, and the exact dB is one long-press away in the
       explainer on the cell. A grid is for reading a shape down a column, and
       a column of words has a shape a column of decimals does not.
       THE OPTIONS ARE `CYCLE`, WHICH IS STILL fields.js DATA. The list that
       used to be walked one tap at a time is now shown all at once; it is the
       same list, from the same table, in the same order — "" (as mixed, the
       absent spelling) and then TRIMS' own keys — so a word added or renamed
       there is on the strip by existing. */
    const cell = (secId, colId) => {
      const c = (cols.find((x) => x.id === colId) || {}).chan;
      const si = doc.form.sections.findIndex((x) => x.id === secId);
      if (!c || si < 0) return null;
      const cur = (deskOf(c.voice).trim || {})[secId] || "";
      // the record's own dealt trim for THIS voice in THIS section — drawn
      // only where the hand is silent, because a set word replaces the derived
      // one on the fader (fields.js trimApply) as well as on the page
      const d = cur === "" ? DRV(si, c.key) : null;
      const shown = cur !== "" ? WSHOW(cur)
        : (d && d.db) ? WSHOW(nearestTrim(d.db))
        : WSHOW("");
      // THE EXPLAINER ON THE CELL IS BOTH HALVES (2026-08-28, with the
      // legend's deletion): a SET word says what it is worth in dB — the one
      // fact the deleted paragraph carried that a reader genuinely needs to
      // work the grid, and TRIMS is still its only owner.
      /* ONE SENTENCE PER STATE, AND THE TAP-TO INSTRUCTION CAME OFF
         (2026-09-05, the functional text pass). This built twenty-one
         rendered variants out of six fragments — "derived: the section's own
         fwd + lift deals this voice +1.0 dB and a tone move — tap to set a
         word over it" — which is a sentence no second language can be given
         in that order. It is three keys now, each a whole sentence with a
         {value} the formatter makes, and the instruction is gone because
         DESIGN.md §3 already says a tap edits and delete returns to default.
         (The section's own words — `lvl` and `env` — named the CAUSE and are
         one long-press away on the row head, which is where the cause lives.) */
      let title;
      if (cur !== "") {
        const dbv = NuFields.TRIMS[cur];
        title = dbv == null
          ? t("board.cell.setSilent.title", { word: WSHOW(cur) })
          : t("board.cell.setDb.title",
              { word: WSHOW(cur), value: fmt(dbv, "dB") });
      } else if (!(d && d.db)) {
        title = t("board.cell.default.title");
      } else {
        title = t(d.eq ? "board.cell.derivedTone.title"
                       : "board.cell.derived.title",
                  { value: fmt(d.db, "dB") });
      }
      return { key: "t|" + c.voice.name + "|" + secId,
        value: cur, label: shown, cls: "w-" + (cur || "mid"),
        derived: cur === "" && !!(d && d.db),
        say: t("board.cell.say", { name: c.voice.name, section: secId }),
        title,
        options: CYCLE.map((w) => ({ v: w, w: WSHOW(w) })),
        set: (v) => {
          const map = { ...(deskOf(c.voice).trim || {}) };
          if (v === "") delete map[secId]; else map[secId] = v;
          setDesk(ctx, c.voice, "trim", Object.keys(map).length ? map : null);
        } };
    };
    autoGrid = wordGrid(wrap, { key: "trimgrid", id: "trimgrid",
                                live: "trimrow", corner: t("noun.section"),
                                rows, cols, cell });
    // the heads were built before the grid was, so their `<th>`s are seated
    // here — the meter registry needs the cell the well ended up in, and the
    // component is the only thing that knows which that is
    for (const m of headMeters) {
      const h = autoGrid.colHeads.get("col|" +
        (chans.find((c) => c.key === m.chan) || { voice: {} }).voice.name);
      if (h) m.th = h.th;
    }
    // THE LEGEND IS DELETED, 2026-08-28. Paul: *"the text below Section
    // Automation is vast and should all be removed."* It printed the six words
    // in TRIMS' order plus the two facts a reader needs to work the grid —
    // "absent is as mixed, and a dim number is what the record already deals
    // that voice there" — and both facts survive ON THE CONTROL, where the
    // page already teaches: a cell's `title` (the long-press explainer) and
    // its `aria-label` say what its own word is worth in dB, what "as mixed"
    // means, and where a dim number came from. The list of six was a second
    // owner of TRIMS anyway; the strip spells them all at once now.
    return wrap;
  };

  /* THE PANEL IS SEATED HERE, AFTER `PLATES.auto` EXISTS (2026-09-02).
     `showPanel()` reads `PLATES[BOARDTAB.key]` at call time — so opening a
     board whose last plate was the automation grid would have found no builder
     and drawn an empty rack. (It read `host.append(tabsBar, panel)` until the
     row above was deleted the same day; the DOM order is what is left of it —
     the panel, then the routing pointer.) */
  host.append(panel);
  showPanel();
  markTabs();                 // the mark on the plate that is open, first draw

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
  /* ...AND IT IS DRESSED AS A CONTROL SINCE 2026-09-02. The probe of that
     morning: *"A raw markdown link 'the fixed wires — docs/BOARD-ROUTING.md'
     in the Mix panel: the app's only blue underlined hyperlink; serves raw
     .md."* Both halves are fair — it was the one hypertext on a page made
     entirely of controls, and it hands a reader a markdown file.
     IT STAYS AN `<a>` AND KEEPS ITS TEXT, because `desk-gate.js` G14 reads
     exactly this element by `href` and asserts the printed ADDRESS ("an edge
     nobody knows about is the same as no edge" — the essay moved and the page
     must still say where). Deleting it would be deleting the pointer that
     claim rests on, and desk-gate is not this file's to rewrite. What changes
     is what it LOOKS like: `.nu-routelink` in nu.css gives it the page's own
     button chassis and the 44px floor every other target keeps, so it reads as
     the control it functionally is rather than as the page's only underline. */
  { const a2 = document.createElement("a");
    a2.href = "docs/BOARD-ROUTING.md";
    a2.className = "nu-routelink";
    /* THE PRINTED WORDS ARE NOT THE PATH ANY MORE (2026-09-05). DESIGN.md §4
       forbids a source file in the UI, and this was the one markdown path the
       page showed a listener. The ADDRESS is unchanged and is where it always
       belonged — the `href` above — so the pointer the essay's move rests on
       is intact. nukernel/desk-gate.js G14 still tests the printed TEXT for
       the path and must be moved onto the `href` it reads two lines earlier. */
    a2.textContent = t("board.routing");
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
      x.el.textContent = f.ret != null
        ? t("board.model.bus.ret", { in: fmt(f.feed), ret: f.ret,
                                     out: fmt(f.out) })
        : t("board.model.bus", { in: fmt(f.feed), out: fmt(f.out) });
    }
    if (masterMeter) {
      const r = rmsNow();
      const f = Math.max(0, Math.min(1, gainToF(r * 4)));
      masterMeter.bar.style.height = Math.round(f * 100) + "%";
      masterMeter.out.textContent = t(playing
        ? (r > 0 ? "board.meter.live" : "board.meter.wait")
        : "board.meter.stopped");
    }
    /* THE SOUNDING ROW AND THE SOUNDING COLUMNS, IN ONE CALL (2026-09-02,
       wave 4). It read `#trimgrid tbody tr` and compared `+tr.dataset.sec`,
       which is now two bugs waiting: the accordion inserts a `<tr>` that has
       no `data-sec` (it would read NaN and clear nothing, correctly, by luck),
       and the section INDEX is not the row's identity any more — the row is
       keyed by the section's own id, which is the address every cell in it
       uses. `paint(rowId, colIds)` is the component's own method and takes
       both facts at once, so the red row and the lit heads can never be
       painted from two different readings of the same beat. */
    if (autoGrid) {
      const si = playing && playingSec >= 0 ? playingSec : -1;
      const sec = si >= 0 ? (doc.form.sections[si] || null) : null;
      let hot = [];
      try {
        const on = soundingChans();
        if (on && on.length)
          hot = chans.filter((c) => on.indexOf(c.key) >= 0)
                     .map((c) => "col|" + c.voice.name);
      } catch (e) { hot = []; }
      autoGrid.paint(sec ? sec.id : null, hot);
    }
    /* ===== THE COLUMN HEADS' TWO LIVE FACTS, 2026-09-02 (slice 2e) =======
       Paul, B11: *"Light up which instrument is playing, make a little volume
       meter INSIDE the heading."* TWO facts, two feeds, two paints, and the
       page's own law is why they are not one:

         WHICH IS PLAYING — `soundingChans()`, the schedule after the desk. It
         is a PLAYHEAD (clock red, `is-sounding`, the same class and the same
         ink the gutter's band rows wear), never green, because green on this
         page means MEASURED and a schedule is not a measurement.

         HOW LOUD — `voiceLevels()`, the engine's own per-voice number, in the
         green well. A chair ABSENT from that map has no tap and no audit: the
         well is drawn EMPTY and says "not yet measured — plays first" rather
         than filling to zero, because 0 is a claim of silence about a voice
         nobody measured, and a fake measurement is the one thing this board
         has refused in writing since METER_WHY was written.

       BOTH ARE GUARDED. The readers are pure but they reach a compiled plan
       and a live handle; before compile, mid-swap or on a route that answers
       null they must not take the board's beat down with them. Same shape as
       `factsNow`'s try/catch above.

       THE TITLE IS WRITTEN ONLY WHEN IT CHANGES (`said`), so a head costs one
       string compare per beat rather than a DOM write. */
    if (headMeters.length) {
      let hot = [], lv = {};
      try { hot = soundingChans() || []; } catch (e) { hot = []; }
      try { lv = voiceLevels() || {}; } catch (e) { lv = {}; }
      for (const h of headMeters) {
        /* (`h.th.classList.toggle("is-sounding", …)` stood on this line and
           came off 2026-09-02, wave 4. The head's LAMP is the word grid's now
           — `autoGrid.paint(rowId, colIds)` above lights the sounding row and
           the sounding columns in one call — and two writers of one class,
           reading two calls of the same feed on the same beat, is the drift
           the component was made to end. What is left here is the METER, which
           is a different fact from a different feed: a schedule lights the
           lamp, a number fills the well.) */
        const r = lv[h.chan];
        const measured = typeof r === "number" && isFinite(r);
        h.bar.style.width = measured
          ? Math.round(Math.max(0, Math.min(1, gainToF(r * 4))) * 100) + "%" : "0%";
        h.well.classList.toggle("is-unmeasured", !measured);
        /* WHAT THE NUMBER IS: this chair's rms, per frame on a sampled
           chair (a live AnalyserNode on its own unit) and per bar on a Faust
           one (the bar audit's). The grain is the honest half and stays on
           the page; the chair's key and the word "rms" do not. */
        const say = measured
          ? t(h.grain === "per frame" ? "board.meter.frame" : "board.meter.bar")
          : t("board.meter.none");
        if (h.said !== say) { h.well.title = say; h.said = say; }
      }
    }
  };
  paint();
  const handle = { paint, show: showBoardHere, host };
  CURRENT = handle;
  return handle;
}

/* the free function the page's on("pos") handler calls.
   ...AND IT ASKS THE DOM WHETHER THE BOARD IS STILL ON IT (2026-09-07), which
   is `paintVoiceMix`'s own guard for `paintVoiceMix`'s own reason, arriving
   here because the board became a SHEET. While it was a pane its DOM survived
   every other tab; it is the MIX row's master now, one accordion with every
   other sheet on that surface, so shutting the row — or opening a seat — takes
   the whole board off the page while `CURRENT` still points at it. A handle
   left over from a closed sheet is a beat's worth of writes into detached
   nodes, which is the hazard this file has named at three other handles. */
export const paintBoard = () => {
  if (!CURRENT || (CURRENT.host && !CURRENT.host.isConnected)) return;
  CURRENT.paint();
};
/* ...AND THE TWO THE GUTTER CALLS (2026-09-02). Same shape and same reason as
   `paintBoard`: the mount stores its closures in `CURRENT` and these are the
   whole of what the rest of the page may reach. `boardTabNow()` answers with a
   COPY, because `BOARDTAB` is this file's state and a caller that could write
   it would be the second owner of which plate is open. Before the board has
   ever been built there is no open plate and the honest answer is the state
   the module is holding, which is what the nav marks its row from. */
export const showBoard = (kind, key) =>
  (CURRENT && CURRENT.show ? CURRENT.show(kind, key) : false);
export const boardTabNow = () => ({ kind: BOARDTAB.kind, key: BOARDTAB.key });

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
    /* `fmtDb` AND NOT `fmt(v, "dB")`: nukernel/desk-gate.js compares this
       readout to a number it builds with an ASCII minus and a fixed decimal,
       and the catalogue's formatter spells a real minus sign and trims a
       trailing zero. The unit lives in the key, where a translator can move
       it; the number keeps the desk's own spelling. */
    x.el.textContent = t("board.model.level",
      { value: fmtDb(20 * Math.log10(Math.max(1e-4, g))) });
  }
};
/* THE MEASURED HALF OF THE STRIP, 2026-09-02 — the same arithmetic and the
   same honesty as the automation plate's column heads, written once and read
   by both callers. What is drawn is `voiceLevels()[chair]`, the engine's own
   per-voice number; a chair ABSENT from that map is drawn EMPTY and says so,
   because 0 is a claim of silence about a voice nobody measured.
   THE WELL EXISTS WHILE THE RECORD IS STOPPED and is empty then, which is
   test/motif-frozen A2's rule said about a meter: a surface that only appears
   once playing is the editing interface changing on play. */
const sayMeters = (meters) => {
  if (!meters || !meters.length) return;
  let lv = {};
  try { lv = voiceLevels() || {}; } catch (e) { lv = {}; }
  for (const m of meters) {
    const r = lv[m.chan];
    const measured = typeof r === "number" && isFinite(r);
    m.bar.style.height = measured
      ? Math.round(Math.max(0, Math.min(1, gainToF(r * 4))) * 100) + "%" : "0%";
    m.well.classList.toggle("is-unmeasured", !measured);
    m.out.textContent = t(measured
      ? (r > 0 ? "board.meter.live" : "board.meter.wait")
      : (playing ? "board.meter.wait" : "board.meter.stopped"));
    const say = measured
      ? t(m.grain === "per frame" ? "board.meter.frame" : "board.meter.bar")
      : t("board.meter.none");
    if (m.said !== say) { m.well.title = say; m.said = say; }
  }
};
export const paintVoiceMix = () => {
  if (!MIX || !MIX.host.isConnected) return;
  sayDrives(MIX.drives);
  sayMeters(MIX.meters);
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
  r.setAttribute("aria-label", t("board.aria.listening"));
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
  const w = el("small", t("board.listening.why"), "nu-why");
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
