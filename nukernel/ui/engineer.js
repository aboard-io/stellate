// nukernel/ui/engineer.js — THE ENGINEER, and THE BOARD.
//
// (2026-08-24, Paul: "we've lost the engineer entirely. we've lost buses and
// sending things to them and delay and reverb." … "an actual mixing board at
// the end is a nice idea.")
//
// THE MODEL WAS NEVER LOST — only the view was. audio/desk.js is 975 lines that
// answer what every control on a board is worth in the parent engine, fields.js
// is the vocabulary for saying it, and ui/state.js has held the stores since the
// one-engine round. Nothing in this file computes a mix number; it draws the
// ones desk.js already resolves and writes the document's own words back
// through nukernel/desk-doc.js. If a number here disagrees with the tape, this
// file is reading the wrong function, never doing its own arithmetic.
//
// TWO SURFACES, AND THEY ARE DIFFERENT THINGS (keep like with like):
//
//   THE ENGINEER is per-voice SOUND and belongs inside the voice's own sheet in
//   the band grid — a cantor's send is one more fact about the cantor, next to
//   its register and its instrument, not a room next door.
//
//   THE BOARD is a real console at the foot of the page: one column per
//   channel, one row per control, THE MASTER UNDERNEATH. Across a row compares
//   one control over the whole band; down a column reads one channel's path in
//   signal order (input → EQ → fader → sends → bus → master), which is the
//   British in-line order main:nukernel/ui/mixtbl.js:34 cites. Grid lines are
//   what make both readings possible, which is why Paul asked for them.
//
//   That sentence said "master at the right" until 2026-08-24 and it was a
//   rowSpan cell at the end of every row. It moved because the master's fifteen
//   menus became fifteen SHEETS and a rowSpan distributes its own height back
//   over the rows it spans: measured on the shipped chant at 390px, fifteen
//   sheets in that cell took the channel rows from 93–244px to 307–801px and the
//   table from 1665px to 5352px, with 92px of column to read a sheet in. The
//   console is still in signal order; the master is simply the last thing down
//   the page instead of the last thing across it, which is also where a thumb
//   can reach it without scrolling eight channels sideways.
//
// NO POPUPS. The cell-row-plus-popover tracker was REVERSED in favour of a
// board, and this does not reintroduce it: no openFader, no popover, no fold —
// every control is on the page at rest. AND NO MENUS EITHER, 2026-08-24. This
// paragraph used to end "`<select>` is the only popup allowed here, because it
// is a control and not a surface"; the measurement that reversed it is 23 —
// `document.querySelectorAll("select")` found twenty-three on this page and
// every one of them was on this board, four per channel, which is the exact
// thing Paul objected to ("the options for each instrument in a song section
// are now just one thing in a dropdown. That's not effective."). A CHANNEL GETS
// A KNOB and THE MASTER END GETS SHEETS; `knob()` below carries the test for
// which is which.
//
// FOUR LAWS CARRIED FORWARD FROM main:nukernel/ui/mixtbl.js, which shipped a
// board on this data and is the prior art:
//   * THE TRACK LIST IS THE SAME ANSWER THE AUDIO TIER BUILDS FROM (:281
//     rowsOf) — desk-doc's channelVoicesOf here, gated against voiceRoster by
//     desk-gate G2. A board cannot show a strip the desk will not build.
//   * ABSENT IS THE ONLY SPELLING OF A DEFAULT (:351 writeField) — null / "" /
//     false / 0 / [] deletes the key, and desk-doc.writeDesk is the one writer.
//   * THE FILL IS THE AUTOMATION, THE NUMBER IS YOUR OFFSET (:395 gainToF,
//     :415 liveGain) — copied below as the one place gain becomes fill.
//   * DIM IS DERIVED, BRIGHT IS SET.
// What does NOT carry: the grammar. That board was bars you drag and popovers
// you tap. This page is native controls in a table with grid lines.
import { NuFields, NuDeskDoc, GENRES, SENDS, SENDLABEL, LEVELS, LEVELLABEL,
         PANS, PANLABEL, FX, MAX_FX, EQ_BANDS, faderDb,
         MASTER_FIELDS, BUS_FIELDS } from "./deps.js";
// FXLABEL is read off the whole registry rather than added to deps.js's
// destructure list: deps is "the SOLE reader of window.*" and it already
// re-exports NuFields, so one more name there would be a second door to the
// same table. NuDeskDoc has to be added there because it is a different global.
const FXLABEL = NuFields.FXLABEL;
import { SONG, MASTER, BUSES, vol, setVol, commit } from "./state.js";
import { deskChannelBase, deskLevelAt, derivedPartTone,
         masterState } from "../audio/desk.js";
import { channelFacts } from "../audio/plan.js";
import { playing, playingSec, getPosition, passAt } from "../audio/live.js";
import { gid } from "./derive.js";
// ...THROUGH THE ONE-OPTION ROUTER, the same as ui/produce.js: same names,
// same signatures, and a spec offering one option draws as a <select> (Paul,
// 2026-08-24, evening: "in general where there is ONE option a dropdown is
// preferred"). Nothing on the board renders one option today — measured,
// `master` offers 5-6, `bus` 3-13, the `eng.*` rows 5-11 — so this changes no
// pixel now and is the guard for the day a crate or a bus list shrinks to one.
import { sheet, sheetRow } from "./selects.js";

const el = (tag, text) => { const n = document.createElement(tag);
  if (text != null) n.textContent = text; return n; };
const DD = () => NuDeskDoc;
// A SILENT GREY IS THE BUG THIS ROUND EXISTS TO PREVENT ("when an option makes
// another one unaccessible gray it out" — and a grey with no reason is worse
// than none). So a refusal is one function: it disables the control AND puts
// the sentence next to it, in the same parent, where a gate that walks
// `input:disabled` can find it.
function refuse(node, why) {
  node.disabled = true;
  node.setAttribute("aria-disabled", "true");
  node.title = why;
  const w = el("small", why); w.className = "nu-why";
  return w;
}

/* ---------- the level arithmetic, borrowed verbatim ----------------------- */
// main:mixtbl.js:395 — "The bar maps −36..+12 dB of GAIN to 0..1 of fill:
// LEVELS spans −8..+2.6 dB, the offset ±24/12, the pump's duck −10 — all inside
// the track with the nulls readable. gainToF is the ONE place gain becomes
// fill." Copied rather than re-derived, because two answers to "how full is the
// bar" is exactly the drift the original comment is about.
const F_LO = -36, F_HI = 12;
const gainToF = (g) => {
  const db = 20 * Math.log10(Math.max(1e-4, g));
  return Math.max(0, Math.min(1, (db - F_LO) / (F_HI - F_LO)));
};
const fmtDb = (v) => (v > 0 ? "+" : "") + v.toFixed(1);

// WHICH BOX THE NUMBERS ARE READ AGAINST. The sounding one while the transport
// runs, the first otherwise — a stopped desk shows the record's opening seating,
// which is what the parked strips of a real console show.
const atBox = () => SONG[playing && playingSec >= 0 ? playingSec : 0] || SONG[0] || null;
// THE LIVE GAIN (main:mixtbl.js:415). It used to read an AudioParam off a
// channel the page built — the second engine, and the reason the number on the
// board and the number on the tape could differ. There are no channel nodes now,
// so the fill reads the MODEL: the resolved static gain times whatever the box's
// level automation is worth at the playhead. Same arithmetic audio/desk.js hands
// the engine per note, so the meter sits where the ear is.
function liveGain(sec, key) {
  if (!sec) return 1;
  const g = deskChannelBase(sec, key).gain;
  if (!playing) return g;
  let f = 0;
  try { f = passAt(getPosition().now).f; } catch (e) { f = 0; }
  return g * deskLevelAt(sec, f);
}

/* ---------- what the engine will actually do with a channel --------------- */
// audio/plan.js channelFacts, and no table of this file's own — so the board's
// refusals and the renderer's are the same refusal. FAIL OPEN before compile()
// has run: `{}` greys nothing, because a control that vanishes before boot is
// worse than one that is briefly optimistic, and widthKept drops the chip
// anyway.
function factsNow() {
  try { return channelFacts(playing && playingSec >= 0 ? playingSec : 0) || {}; }
  catch (e) { return {}; }
}

/* ---------- the words a bus is called ------------------------------------- */
// One reader for the send rows and one for the master strip's nameplate, so
// renaming bus 1 renames it everywhere at once (main:mixtbl.js:261). The send
// row's <th> prints the bus's CURRENT name and not a hardcoded "reverb".
const busName = (bus) => NuFields.busNameOf(BUSES, bus);
// THE WARNING THE PAGE OWES YOU. Every genre in the catalog defaults its
// section send to `tone.verb`, so a channel can be 78% wet into a bus whose gain
// is zero — which is exactly what the shipped chant did for as long as this page
// existed (audio/plan.js hands toEngine `reverb: 0`; only sound.buses.rev.ret
// opens it). Not a refusal and not an auto-write: it is the fact that kept the
// finding invisible.
function returnShut() {
  const st = masterState(MASTER, BUSES);
  return !st || !(st.reverb > 0);
}

// WHAT THE SECTION IS ALREADY SENDING, in words. audio/desk.js sectionOf:
// "ABSENT MEANS 'AS THE GENRE ASKS' — every genre already declares how wet it
// wants to be (tone.verb), and that number used to be thrown away." A part's
// send adds to it, so the empty detent has to say what it is adding to or the
// number on the strip is a lie by omission.
function genreAsk(sec) {
  const g = (sec && GENRES[gid(sec)]) || {};
  const v = g.tone && g.tone.verb != null ? g.tone.verb : 0.15;
  return "the genre asks " + v;
}

/* ---------- reading and writing one strip --------------------------------- */
const deskOf = (voice) => (voice && voice.desk) || {};
function setDesk(ctx, voice, key, v) {
  DD().writeDesk(voice, key, v);
  ctx.changed();
}

// THE STANDING ANSWER IS ALWAYS OFFERED (main:nukernel/band-kit.js:3956 — "you
// can always see the word you are on"). An option that IS the current value is
// never disabled, whatever the gate says, and it says why: without this a loaded
// document is un-editable at exactly the moment it matters.
// THE EMPTY DETENT IS AN OPTION, and it carries the answer the default gives —
// "WHAT THE DEFAULT RESOLVES TO, said in the key's own vocabulary and dimmed"
// (main:mixtbl.js defaultOf). Two things need it. A sheet must have exactly one
// checked input, and a strip that has never been touched has no value to check;
// and a person needs somewhere to click to UNDO a choice, because absent is the
// only spelling of a default and there is no other way to spell it.
function optionsFor(table, labels, cur, gate, emptyLabel) {
  const head = [{ value: "", label: emptyLabel, group: "as it stands" }];
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

/* ========================= VIEW 1 · THE ENGINEER ==========================
   Appended by bandBlock directly after the voice's cast/material/instrument
   table, in the same row(label, kid) grammar, so it reads as more of the
   voice's own facts.

   THE THIRD COLUMN IS THE WHOLE OF "SHOW BOTH WITHOUT LYING": the control holds
   YOUR value, the column holds what it is riding on (desk.js derivedPartTone,
   deskChannelBase), and when yours is absent the two agree. */
export function engineer(parent, ctx, voiceName) {
  const doc = ctx.doc();
  const chans = DD().channelVoicesOf(doc, GENRES);
  const me = chans.find((c) => c.voice.name === voiceName);
  if (!me) return;                       // a voice with no channel has no strip
  const key = me.key, voice = me.voice, d = deskOf(voice);
  const sec = atBox();
  const facts = factsNow()[key] || null;
    const drv = sec ? derivedPartTone(sec, key) : { db: 0, eq: null };
  const soloElsewhere = chans.some((c) => c.voice !== voice && deskOf(c.voice).solo);

  if (ctx.heading) ctx.heading(parent, "the engineer");
  else parent.append(el("h3", "the engineer"));

  const t = el("table");
  t.className = "nu-eng";
  t.setAttribute("cellpadding", "0"); t.setAttribute("cellspacing", "0");
  // A NON-SOLOED CHANNEL IS DIMMED, NEVER DISABLED (desk.js partsOf:373): a
  // solo somewhere else is not a refusal — the value is still yours to set, it
  // just cannot sound until the solo comes off.
  if (soloElsewhere || d.mute) {
    t.classList.add("is-off");
    t.setAttribute("aria-disabled", "true");
  }
  const row = (label, kid, drvText) => {
    const tr = el("tr");
    tr.append(el("th", label));
    const td = el("td"); td.append(kid); tr.append(td);
    const td2 = el("td", drvText == null ? "" : drvText);
    td2.className = "nu-hint"; tr.append(td2);
    t.append(tr);
    return tr;
  };

  // THE FADER IS AN OFFSET, in dB, riding ON TOP of the seated gain — never
  // replacing it. Numeric because a long-throw fader is not a detented list.
  {
    const wrap = el("span");
    const r = document.createElement("input");
    r.type = "range"; r.min = "-24"; r.max = "12"; r.step = "0.5";
    r.value = String(faderDb(d.fader));
    r.dataset.k = "eng|fader|" + voiceName;
    r.setAttribute("aria-label", voiceName + " fader");
    const out = el("output", fmtDb(faderDb(d.fader)) + " dB");
    r.addEventListener("input", () => { out.textContent = fmtDb(+r.value) + " dB"; });
    r.addEventListener("change", () => setDesk(ctx, voice, "fader", +r.value));
    wrap.append(r, document.createTextNode(" "), out);
    row("fader", wrap, "riding " + fmtDb(drv.db) + " dB seated");
  }
  // THE STRIP EQ, absolute rather than automated — tone is set and left, so
  // there is no offset dance.
  //
  // THESE THREE ROWS USED TO DRAW DEAD ON A MODELLED VOICE, and the refusal they
  // printed was true when it was written: "a modelled voice has no sampler strip
  // for an EQ to land on", because audio/desk.js wrote the merged EQ only
  // `if (u.sampler)` and a Faust module has no sampler key. It is no longer true.
  // The strip is a stage the RENDERER owns now (engine/faust/live/
  // stream-renderer.js renderUnitWindow reads `u.strip`), so a modelled channel's
  // knob turns the same filter a sampled channel's does, and there is nothing
  // left to refuse. The refusal is gone rather than reworded: a control that
  // works needs no apology, and the third column below — "riding X dB", the
  // derived shading — used to print beside a slider that had just been disabled,
  // which was the one place a reader would have gone to check.
  for (const b of EQ_BANDS) {
    const cur = (d.eq && d.eq[b.key]) || 0;
    const wrap = el("span");
    const r = document.createElement("input");
    r.type = "range"; r.min = "-12"; r.max = "12"; r.step = "0.5";
    r.value = String(cur);
    r.dataset.k = "eng|eq" + b.key + "|" + voiceName;
    r.setAttribute("aria-label", voiceName + " " + b.label);
    const out = el("output", fmtDb(cur));
    r.addEventListener("input", () => { out.textContent = fmtDb(+r.value); });
    r.addEventListener("change", () => {
      const next = { ...(d.eq || {}) };
      next[b.key] = +r.value;
      setDesk(ctx, voice, "eq", next);
    });
    wrap.append(r, document.createTextNode(" "), out);
    row(b.label, wrap,
        drv.eq && drv.eq[b.key] ? "riding " + fmtDb(drv.eq[b.key]) : "flat");
  }
  for (const [k, label] of [["mute", "cut"], ["solo", "alone"]]) {
    const c = document.createElement("input");
    c.type = "checkbox"; c.checked = !!d[k];
    c.dataset.k = "eng|" + k + "|" + voiceName;
    c.setAttribute("aria-label", voiceName + " " + label);
    c.addEventListener("change", () => setDesk(ctx, voice, k, c.checked));
    row(label, c, k === "solo" && soloElsewhere ? "another channel is alone" : "");
  }
  // EVERY TABLE ON THIS PAGE IS IN A PANE (08-shell recipe note 4, applied by
  // the integrator because the shell slice cannot reach this file and the
  // engineer slice had shipped). This one appended straight to the parent and
  // was the last orphan: a table that is wider than a phone scrolls inside
  // itself or it scrolls the document, and there is no third option. It is
  // written out longhand rather than calling eight.js's `pane()` — a view does
  // not import another view — and it is the same three lines.
  const tp = el("div");
  tp.className = "nu-pane";
  tp.tabIndex = 0;
  // ...and the fourth line, for the same reason the other three are here:
  // ui/eight.js keepPanes/putPanes puts a pane's sideways scroll back after a
  // rebuild, and it finds a pane again by the first control inside it
  // (2026-08-25). The board is re-mounted by every draw(), so without this the
  // channel strip snapped back to channel 1 on every gesture anywhere.
  const t0 = t.querySelector("[data-k]");
  if (t0) tp.dataset.pane = t0.dataset.k;
  tp.append(t);
  parent.append(tp);

  /* the enumerated half, as sheets — one lit sheet per question, greyed with a
     reason wherever the engine will refuse it */
  const base = sec ? deskChannelBase(sec, key) : { rev: 0, del: 0, pan: 0 };
  const q = (k) => "eng." + k + "|" + voiceName;
  sheetRow(parent, "where it sits", [
    { key: q("lvl"), label: "level",
      options: optionsFor(LEVELS, LEVELLABEL, d.lvl, null, "normal"),
      value: d.lvl == null ? "" : String(d.lvl),
      set: (v) => setDesk(ctx, voice, "lvl", v) },
    { key: q("pan"), label: "place",
      options: optionsFor(PANS, PANLABEL, d.pan, null, "centre"),
      value: d.pan == null ? "" : String(d.pan),
      set: (v) => setDesk(ctx, voice, "pan", v) },
  ]);

  // THE THREE SENDS. Bus 3 is `room` and it IS the reverb bus (desk.js:590
  // folds a part's room into its rev) — it is offered only where it can sound,
  // which is desk.js partKeysOf's own law: never an address that cannot.
  const hasKit = chans.some((c) => c.key === "drums");
  const roomWhy = key !== "drums" && !hasKit
    ? "bus 3 is the kit's ambience and this record has no kit" : null;
  const revLabel = "→ " + busName("rev") +
    (returnShut() ? " (the return is shut — Sound ▸ the rack)" : "");
  sheetRow(parent, "the sends", [
    { key: q("rev"), label: revLabel,
      options: optionsFor(SENDS, SENDLABEL, d.rev, null, genreAsk(sec)),
      value: d.rev == null ? "" : String(d.rev),
      set: (v) => setDesk(ctx, voice, "rev", v) },
    { key: q("echo"), label: "→ " + busName("echo"),
      options: optionsFor(SENDS, SENDLABEL, d.echo, null, "dry"),
      value: d.echo == null ? "" : String(d.echo),
      set: (v) => setDesk(ctx, voice, "echo", v) },
    { key: q("room"), label: "→ " + busName("room"),
      options: optionsFor(SENDS, SENDLABEL, d.room, null, "dry"),
      value: d.room == null ? "" : String(d.room),
      why: roomWhy,
      set: (v) => setDesk(ctx, voice, "room", v) },
  ]);

  // THE CHARACTER CHIP, back on the track after 2026-08-17 took it off. It is
  // an INSERT and the parent's insert path is MONO, so a wide unit's chain is
  // dropped outright (desk.js widthKept: "stereo voices are folded to channel 0
  // through the mono insert chain"). Saying so is cheaper than pretending.
  const chips = d.fx || [];
  const wideWhy = facts && facts.stereo
    ? "this voice is wide; a chip would fold it to mono" : null;
  // THE ONE CONTROL ON THIS PAGE THAT ALLOWS MORE THAN ONE ANSWER, and as of
  // 2026-08-24 it is the browser's own element for that (Paul: "Wherever we
  // allow multiple selections use a standard multiselect form element
  // please."). ui/sheets.js draws `multi` as a `<select multiple>` now; nothing
  // about this call site changed except the two words below.
  //
  // THE CAP IS SAID TWICE BECAUSE A MULTISELECT NEEDS IT TWICE. Greying the
  // unreachable chips is what a reader SEES and it is the same line it always
  // was; `max` is the backstop, because a <select multiple> can be handed a
  // fourth selection by a ctrl-click or a Ctrl+A in a way an unticked checkbox
  // never could, and quietly keeping the first three would be a lie about what
  // the record now says.
  sheet(parent, {
    key: q("fx"), label: "character",
    multi: true,
    max: MAX_FX,
    maxWhy: "three chips is the limit on one track — the fourth was refused",
    why: wideWhy,
    options: Object.keys(FX).map((k) => {
      const on = chips.includes(k);
      if (!on && chips.length >= MAX_FX)
        return { value: k, label: FXLABEL[k] || k, disabled: true,
                 why: "three chips is the limit on one track" };
      return { value: k, label: FXLABEL[k] || k };
    }),
    value: chips.map(String),
    set: (list) => setDesk(ctx, voice, "fx", list),
  });

  const note = el("p",
    "riding " + fmtDb(20 * Math.log10(Math.max(1e-4, base.gain || 1))) +
    " dB · " + Math.round((base.rev || 0) * 100) + "% into " + busName("rev") +
    " · " + Math.round((base.del || 0) * 100) + "% into " + busName("echo"));
  note.className = "nu-hint";
  parent.append(note);
}

/* ========================= VIEW 2 · THE BOARD =============================
   One <table>, one column per channel, one row per control, master last.

   THE AUTOMATED FADER, IN PLAIN HTML, WITHOUT LYING. Two native elements, two
   quantities, neither pretending to be the other:
     * <input type=range> is YOUR OFFSET (voice.desk.fader, ±24/12 dB) and never
       moves by itself.
     * <meter> is THE AUTOMATION — the gain actually driving the channel at the
       sounding box, deskChannelBase().gain × deskLevelAt(), mapped through
       gainToF. It moves per beat under a `pump` and steps at every boundary as
       shade() re-seats the band.
   <meter> draws its own bar, so this needs no CSS and no rAF loop. paint() runs
   from the page's existing on("pos") handler, once a beat. AUDIO NEVER CALLS A
   VIEW. */
let CURRENT = null;

export function mount(parent, ctx) {
  const host = ctx.section
    ? ctx.section(parent, "board", "The board")
    : (() => { const s = el("section"); s.className = "nu-ax"; s.id = "board";
               s.append(el("h2", "The board")); parent.append(s); return s; })();
  const doc = ctx.doc();
  const chans = DD().channelVoicesOf(doc, GENRES);
  const sec = atBox();
  // no channelFacts here any more: the board grid's ONLY per-channel refusal was
  // the modelled-voice EQ, and that control works now. `stereo` is still read on
  // the engineer's sheet (wideWhy, above), where the chips live — the one place
  // widthKept still takes something away.
  const anySolo = chans.some((c) => deskOf(c.voice).solo);
  const shut = returnShut();

  const pane = el("div"); pane.className = "nu-pane";
  const t = el("table"); t.id = "boardtbl"; t.className = "nu-board";
  t.setAttribute("cellpadding", "0"); t.setAttribute("cellspacing", "0");
  const cap = el("caption", "one column per channel · the slider is your offset,"
    + " the bar is what the record is already doing");
  t.append(cap);

  /* ---- the head: who each column is ---- */
  const thead = el("thead"), hr = el("tr");
  const corner = el("th"); corner.setAttribute("scope", "col"); hr.append(corner);
  for (const c of chans) {
    const th = el("th"); th.setAttribute("scope", "col");
    th.className = "nu-ch";
    if (anySolo && !deskOf(c.voice).solo) { th.classList.add("is-off");
      th.setAttribute("aria-disabled", "true"); }
    th.dataset.ch = c.key;
    th.append(el("span", c.voice.name));
    // THE BOARD PRINTS THE VOICE'S OWN NAME, not its chair key, and this is
    // deliberate rather than cosmetic: ui/eight.js hands the kernel `realize`
    // and never `part`, so a voice the document calls a `counter` is ADDRESSED
    // `line2` (desk-doc.js says why fixing the name would move the music). The
    // address is printed under the name so the two are never confused.
    th.append(el("small", (c.voice.instrument || c.voice.kind || "") + " · " + c.key));
    hr.append(th);
  }
  // THE MASTER IS NO LONGER A COLUMN. A `<th scope=col>main / the record` stood
  // here over a rowSpan cell; see the layout paragraph at the head of this file
  // for the measurement that moved it under the table (307–801px rows, a 5352px
  // console). The board is now channels and only channels, which is also what
  // its caption has always claimed.
  thead.append(hr); t.append(thead);

  const tbody = el("tbody");
  const meters = [], outs = [];
  const rowOf = (label) => {
    const tr = el("tr");
    const th = el("th", label); th.setAttribute("scope", "row");
    tr.append(th); tbody.append(tr);
    return tr;
  };
  const cellFor = (tr, c) => {
    const td = el("td");
    if (anySolo && !deskOf(c.voice).solo) { td.classList.add("is-off");
      td.setAttribute("aria-disabled", "true"); }
    tr.append(td); return td;
  };
  /* ---- EQ, fader, place, the three sends, cut, alone ---- */
  for (const b of EQ_BANDS) {
    const tr = rowOf(b.label);
    for (const c of chans) {
      const td = cellFor(tr, c);
      const d = deskOf(c.voice);
      const r = document.createElement("input");
      r.type = "range"; r.min = "-12"; r.max = "12"; r.step = "0.5";
      r.value = String((d.eq && d.eq[b.key]) || 0);
      r.dataset.k = "b|eq" + b.key + "|" + c.voice.name;
      r.setAttribute("aria-label", c.voice.name + " " + b.label);
      r.addEventListener("change", () => {
        const next = { ...(deskOf(c.voice).eq || {}) };
        next[b.key] = +r.value;
        setDesk(ctx, c.voice, "eq", next);
      });
      td.append(r);
      // no refusal here any more: the board EQ reaches a MODELLED voice the same
      // way it reaches a sampled one (audio/desk.js, the eqAll write — one merged
      // fact, carried at `sampler.strip` or at `strip` depending only on which of
      // the parent's two renderers plays the voice). This cell printed
      // "a modelled voice has no sampler strip for an EQ to land on" until
      // 2026-08-24, and it was right until the strip became a renderer stage.
    }
  }
  {
    const tr = rowOf("fader"); tr.dataset.row = "fader";
    for (const c of chans) {
      const td = cellFor(tr, c);
      const d = deskOf(c.voice);
      const r = document.createElement("input");
      r.type = "range"; r.min = "-24"; r.max = "12"; r.step = "0.5";
      r.value = String(faderDb(d.fader));
      r.dataset.k = "b|fader|" + c.voice.name;
      r.setAttribute("aria-label", c.voice.name + " fader");
      const m = document.createElement("meter");
      m.min = 0; m.max = 1;
      m.title = "what is driving the channel";
      const o = el("output", fmtDb(faderDb(d.fader)));
      r.addEventListener("input", () => { o.textContent = fmtDb(+r.value); });
      r.addEventListener("change", () => setDesk(ctx, c.voice, "fader", +r.value));
      td.append(r, m, o);
      meters.push({ m, key: c.key });
      outs.push({ o, voice: c.voice });
    }
  }
  {
    const tr = rowOf("place");
    for (const c of chans) {
      const td = cellFor(tr, c);
      td.append(knob("b|pan|" + c.voice.name, "pan", PANS, PANLABEL,
        deskOf(c.voice).pan, c.voice.name + " place",
        // "as it stands" and not "centre": PANLABEL already spells 0 `centre`,
        // so labelling the blank detent the same word put TWO detents reading
        // "centre" side by side (measured: the sweep came out left, left-ish,
        // centre, centre, right-ish, right). One word for absence everywhere on
        // this board, and its POSITION is what says the record is dead centre.
        (v) => setDesk(ctx, c.voice, "pan", v), "as it stands"));
    }
  }
  const hasKit = chans.some((c) => c.key === "drums");
  for (const [field, bus] of [["rev", "rev"], ["echo", "echo"], ["room", "room"]]) {
    const tr = rowOf("→ " + busName(bus) +
      (field === "rev" && shut ? " (shut)" : ""));
    if (field === "rev" && shut)
      tr.firstChild.title = "every channel below is sending into a return whose"
        + " gain is zero — open it on the master strip (buses.rev.ret)";
    for (const c of chans) {
      const td = cellFor(tr, c);
      // THE EMPTY DETENT'S WORD IS SHORT ON THE BOARD AND LONG IN THE VOICE'S
      // OWN TAB, on purpose: a 92px column cannot carry "the genre asks 0.78"
      // without wrapping it to four lines, so the sentence goes on the control's
      // `title` and the engineer's sheet (which has the width) still prints it
      // whole.
      const w = knob("b|" + field + "|" + c.voice.name, field, SENDS, SENDLABEL,
        deskOf(c.voice)[field], c.voice.name + " " + busName(bus) + " send",
        (v) => setDesk(ctx, c.voice, field, v), "as it stands");
      const s = w.querySelector("input");
      if (field === "rev") s.title = genreAsk(sec) +
        "; a part send adds to it, so absent adds nothing";
      td.append(w);
      if (field === "room" && c.key !== "drums" && !hasKit)
        td.append(refuse(s,
          "bus 3 is the kit's ambience and this record has no kit"));
    }
  }
  for (const [k, label] of [["mute", "cut"], ["solo", "alone"]]) {
    const tr = rowOf(label);
    for (const c of chans) {
      const td = cellFor(tr, c);
      const b = document.createElement("input");
      b.type = "checkbox"; b.checked = !!deskOf(c.voice)[k];
      b.dataset.k = "b|" + k + "|" + c.voice.name;
      b.setAttribute("aria-label", c.voice.name + " " + label);
      b.addEventListener("change", () => setDesk(ctx, c.voice, k, b.checked));
      td.append(b);
    }
  }
  t.append(tbody);
  // ...and this pane keeps its sideways scroll across a rebuild too
  // (ui/eight.js keepPanes/putPanes, 2026-08-25). The board is one column per
  // channel and it is re-mounted by every draw() on the page, so a thumb that
  // had swiped along to the fourth channel to move its fader was thrown back
  // to the first by the very gesture that moved it. Keyed by the first control
  // inside it, exactly as eight.js's own `pane()` keys one.
  const b0 = t.querySelector("[data-k]");
  if (b0) pane.dataset.pane = b0.dataset.k;
  pane.append(t); host.append(pane);

  masterStrip(host, ctx);

  const paint = () => {
    const s = atBox();
    for (const x of meters) {
      const g = liveGain(s, x.key);
      x.m.value = gainToF(g);
      x.m.title = "driving this channel: " + fmtDb(20 * Math.log10(Math.max(1e-4, g)));
    }
    for (const x of outs) x.o.textContent = fmtDb(faderDb(deskOf(x.voice).fader));
  };
  paint();
  const handle = { paint };
  CURRENT = handle;
  return handle;
}

// the free function the page's on("pos") handler calls. It paints whatever
// board is mounted right now, so eight.js keeps no handle and a board that has
// been rebuilt under it cannot be repainted by mistake.
export const paintBoard = () => { if (CURRENT) CURRENT.paint(); };

/* ---------- one detented knob ----------------------------------------- */
// REVERSED, 2026-08-24, and the old comment is rewritten rather than deleted
// because it is the record of why the menu was there. It read: "A <select> and
// not a sheet: on the BOARD a control has to fit a table cell with fifteen
// others beside it, and a sheet is a surface. The sheets are on the engineer's
// own page, where there is room to read the shape of the possible."
//
// HALF OF THAT STANDS AND HALF OF IT WAS THE BUG. A sheet still does not fit a
// 92px column (nu.css:265) and the per-voice sheets still live in the voice's
// own tab. What was wrong is the conclusion that the only other answer is a
// menu. THE TEST IS WHETHER THE TABLE IS A SCALE OR A SET, and fields.js
// already answers it: `place` and the three sends are numbers with names on
// them — PANS runs -0.7 .. 0.7 and SENDS runs 0 .. 0.9 (fields.js:451,459) —
// so they are a CONTINUOUS VALUE and the honest control is the one a real
// console puts on a strip, a pot. The genuinely enumerated things — which room
// the reverb is, what a bus is called, how long the echo waits — are not on the
// channel at all; they are on the BUS, once each, and they are sheets down at
// the master end where there is width to read them.
//
// `<input type=range step=1>` over the words IN VALUE ORDER, with the word
// itself printed under it. Numeric tables ONLY: a slider over an unordered set
// would be a lie about the shape of the thing, so a non-numeric entry is
// dropped and said out loud rather than drawn at some arbitrary index.
const ZERO_STRIP = NuFields.resolvePartMix({});
// WHICH FIELD RESOLVES TO WHICH NUMBER — fields.js:838's own mapping, quoted
// rather than re-derived ("the field is `echo`, the bus is `del`").
const RESOLVES_TO = { rev: "rev", echo: "del", room: "room", pan: "pan", lvl: "lvl" };
function knob(k, field, table, labels, cur, aria, set, emptyLabel) {
  // WHERE THE EMPTY DETENT SITS, read off fields.js rather than typed. A strip
  // with nothing set resolves to resolvePartMix({}) — 0 for all three sends
  // ("A PART's default is 0 — the part send is what this chair asks for ON TOP
  // of the section, so absent must mean 'adds nothing'", fields.js:757) and 0
  // for pan, which is dead centre. So the blank belongs AT ITS OWN NUMBER'S
  // PLACE in the run and not at one end: on a send it lands first, beside
  // `dry`, which is also 0; on `place` it lands in the middle, beside `centre`,
  // which is also 0. Put it at the left of `place` instead and the slider would
  // read hard left for a record that is dead centre.
  const dflt = ZERO_STRIP[RESOLVES_TO[field]] || 0;
  const d = Object.keys(table)
    .filter((x) => Number.isFinite(table[x]))
    .sort((a, b) => table[a] - table[b])
    .map((x) => ({ v: x, w: (labels && labels[x]) || x, n: table[x] }));
  if (d.length !== Object.keys(table).length)
    console.error("engineer: knob(" + field + ") got a table that is not a scale");
  let i = 0;
  while (i < d.length && d[i].n < dflt) i++;
  d.splice(i, 0, { v: "", w: emptyLabel == null ? "as it stands" : emptyLabel,
                   n: dflt });

  const wrap = el("span");
  const r = document.createElement("input");
  r.type = "range"; r.min = "0"; r.max = String(d.length - 1); r.step = "1";
  // A WORD THE TABLE NO LONGER NAMES READS AS ABSENT rather than as position 0,
  // which would silently move a loaded record to hard left. Same law as
  // fields.js resolvePartMix: "words no table names resolve to the default".
  let at = d.findIndex((x) => x.v === (cur == null ? "" : String(cur)));
  if (at < 0) at = d.findIndex((x) => x.v === "");
  r.value = String(at);
  r.dataset.k = k;
  r.setAttribute("aria-label", aria);
  const out = el("output", d[at].w);
  // A RANGE READS OUT ITS INDEX — "3 of 5" — to a screen reader, which is the
  // one thing the <select> was better at. `aria-valuetext` is the fix, and it
  // is kept in step with the printed word by one function, so the eye and the
  // ear can never be told different things.
  const say = (n) => { out.textContent = d[n].w;
                       r.setAttribute("aria-valuetext", d[n].w); };
  say(at);
  r.addEventListener("input", () => say(+r.value));
  // null, not "" — absent is the only spelling of a default and writeDesk
  // deletes on null (desk-doc.js:154).
  r.addEventListener("change", () => set(d[+r.value].v || null));
  wrap.append(r, out);
  return wrap;
}

/* ---------- the master strip ------------------------------------------- */
// The four master words and the two bus rows ARE the record; the listening
// level is a session fact and the strip says so in words. #vol2 and the page's
// existing #vol are TWO VIEWS OVER ONE STORE (setVol — main:mixtbl.js:104's
// law), never two levels.
//
// SHEETS HERE, KNOBS ON THE STRIP, and that is the whole answer to the
// twenty-three dropdowns. `knob()` above has the test: a channel's `place` and
// its sends are a scale, so they get a pot in a 92px column. NONE OF THE
// FIFTEEN CONTROLS BELOW IS PER-INSTRUMENT — there is one drive, one glue, one
// reverb room and one echo time for the whole record, which is what fields.js
// MASTER and BUSES have always said by being per-bus rather than per-part. A
// thing you say ONCE about the record deserves the surface Paul asked for
// ("sheets of organized options should light up"), and down here the page is
// its full width, so it has one.
//
// `master|<key>` and `bus|<bus>|<knob>` are the sheet keys: §2.3's own
// scope-qualified form, bare key first. They are also `data-k` stems, and
// `data-k` is how focus survives the full rebuild (ui/eight.js:1156), so the
// surface AND the row it belongs to are both in the name.
const MASTER_WHY = "this one round-trips and draws but reaches no sound" +
  " — audio/desk.js:769 names all three and says why";
function masterStrip(host, ctx) {
  const doc = ctx.doc();
  const mv = (k) => (doc.sound && doc.sound.master && doc.sound.master[k]) || "";
  const spec = (key, label, f, cur, set, why) => ({
    key, label,
    // "nothing set" and not "as it stands": optionsFor already prints "as it
    // stands" as the GROUP over this option, and a heading and its only option
    // reading the same three words says nothing twice. What absence means here
    // is not a number — it is the engine's own answer (fields.js resolveMaster:
    // five resolve to null and build nothing at all, glue and ceiling resolve
    // to their shipped default) — and "nothing set" is the one phrase true of
    // all seven without naming a value that seven different tables spell
    // differently.
    options: optionsFor(f.table, f.labels, cur, null, "nothing set"),
    value: cur == null ? "" : String(cur),
    ...(why ? { why } : {}),
    set,
  });
  // WIDTH, TILT AND CEILING'S PUSH REACH NOTHING (audio/desk.js:769 names all
  // three and says why: the parent gets its width from placement, its tone
  // stage is a pair of cuts rather than a tilt, and master_limit's threshold is
  // fixed in the DSP). They round-trip and they draw; they are drawn DISABLED
  // with the reason printed, because saying so is cheaper than pretending —
  // and as a sheet the reason is IN THE PAGE rather than in a `title` no phone
  // will ever show (§2.3: a whole sheet off, its options still visible).
  const HOMELESS = { width: 1, tilt: 1, ceiling: 1 };
  const mset = (f) => (v) => { DD().writeMaster(doc, f.key, v); ctx.changed(); };
  sheetRow(host, "the master", MASTER_FIELDS.filter((f) => !HOMELESS[f.key])
    .map((f) => spec("master|" + f.key, f.label, f, mv(f.key), mset(f))));
  sheetRow(host, "…and three that reach no sound",
    MASTER_FIELDS.filter((f) => HOMELESS[f.key])
      .map((f) => spec("master|" + f.key, f.label, f, mv(f.key), mset(f),
                       MASTER_WHY)));

  for (const row of BUS_FIELDS) {
    const n = row.bus === "rev" ? "1" : row.bus === "echo" ? "2" : "3";
    const bv = (k) => (doc.sound && doc.sound.buses && doc.sound.buses[row.bus]
      && doc.sound.buses[row.bus][k]) || "";
    sheetRow(host, "bus " + n + " · " + busName(row.bus), row.knobs.map((k) =>
      spec("bus|" + row.bus + "|" + k.key, k.label, k, bv(k.key),
        (v) => { DD().writeBus(doc, row.bus, k.key, v); ctx.changed(); })));
    // a bus with nothing but a nameplate says what feeds it, or the row reads
    // as a knobless mystery
    if (!row.knobs.filter((k) => k.key !== "name").length) {
      const w = el("small", row.feed); w.className = "nu-hint";
      const p = el("p"); p.append(w); host.append(p);
    }
  }

  {
    const r = document.createElement("input");
    r.type = "range"; r.min = "0"; r.max = "1"; r.step = "0.01";
    r.value = String(vol); r.id = "vol2"; r.dataset.k = "m|listening";
    r.setAttribute("aria-label", "listening level");
    r.addEventListener("input", () => { setVol(+r.value); commit("transport"); });
    // THE WORD ON ITS OWN LINE, THE FADER UNDER IT — Paul, 2026-08-25: "Put
    // interactive elements on new lines below the titles or questions." The
    // shape is ui/eight.js `number()`'s and ui/selects.js `selectField`'s:
    // `<p class="nu-field"><label><span class="nu-w">…</span><control></label>`,
    // and nu.css `.nu-field > label` does the stacking for all three.
    const l = el("label");
    const w2 = el("span", "listening"); w2.className = "nu-w";
    l.append(w2, r);
    const p = el("p"); p.className = "nu-field"; p.append(l); host.append(p);
    const w = el("small", "how loud it is in the room — a session fact, not"
      + " part of the record");
    w.className = "nu-hint";
    p.append(w);
  }
}
