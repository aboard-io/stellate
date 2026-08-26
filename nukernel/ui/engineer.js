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
//   THE BOARD is a real console at the foot of the page, and since 2026-08-25 it
//   is TWO tables rather than one: the CHANNELS, then the RETURNS AND THE MAIN.
//   One column per strip and one row per control on each. Across a row compares
//   one control over the strips that HAVE it; down a column reads one strip's
//   path in signal order (input → EQ → fader → sends · bus → master), which is
//   the British in-line order main:nukernel/ui/mixtbl.js:34 cites. Grid lines
//   are what make both readings possible, which is why Paul asked for them.
//
//   THE TWO TABLES ARE ONE MEASUREMENT. Paul, 2026-08-25: "Do you want to put
//   the bus and main into their own board so it's not all empty". Measured on
//   the rendered page: one table, 7 columns, 177 cells, 99 of them EMPTY —
//   55.9%, and 68.1% of the body cells — because a channel's rows and a
//   return's rows and the master's are almost disjoint sets. VIEW 2 below
//   carries the whole argument and the second law it needed ("a row is a
//   comparison"), and the numbers after, counted the same way on the same page:
//   24 body cells and NONE empty on the channel board, 16 and one on the rack —
//   39 and 25 cells in all, 1 and 2 empty, and both of those are the corner of
//   a <thead>. desk-gate G13 holds it.
//
//   THE MASTER HAS BEEN AT THE RIGHT, THEN UNDERNEATH, THEN AT THE RIGHT AGAIN,
//   AND IS NOW THE LAST STRIP OF THE SECOND BOARD — every sentence is kept
//   because the measurement in the middle one is still true and is still what
//   decides the shape. It read: "That sentence said 'master at the right' until
//   2026-08-24 and it was a rowSpan cell at the end of every row. It moved
//   because the master's fifteen menus became fifteen SHEETS and a rowSpan
//   distributes its own height back over the rows it spans: measured on the
//   shipped chant at 390px, fifteen sheets in that cell took the channel rows
//   from 93–244px to 307–801px and the table from 1665px to 5352px, with 92px
//   of column to read a sheet in."
//
//   EVERY WORD OF THAT IS ABOUT A ROWSPAN FULL OF LIT SHEETS, and there is no
//   rowSpan and there are no sheets. The rack's controls became `<select>`s on
//   2026-08-25 — a single choice is a menu, Paul twice — a menu is ONE control
//   tall. What the split changed is only WHICH TABLE the master sits in: it is
//   still the strip at the right, which is where Paul asked for it ("master and
//   the buses should also be arranged like the mixing board no?") and where a
//   console keeps it, and the height problem stays solved because its seven
//   menus are a stack inside ONE cell of ONE row rather than a spanned column.
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
         masterState, deskBusFeed } from "../audio/desk.js";
import { channelFacts } from "../audio/plan.js";
import { playing, playingSec, getPosition, passAt } from "../audio/live.js";
import { gid } from "./derive.js";
// ...THROUGH THE ONE-OPTION ROUTER, the same as ui/produce.js: same names,
// same signatures, and a spec offering one option draws as a <select> (Paul,
// 2026-08-24, evening: "in general where there is ONE option a dropdown is
// preferred"). Only `sheet` is left of the pair: `sheetRow` was the engineer's
// door for the five `eng.*` menus and those became pots on 2026-08-25 ("level,
// place, delay, and room are obvious sliders"), so the one caller left is the
// character chips, which are `multi` and route to `<select multiple>`.
// ...and `selectEl`, the bare control, because a bus strip is a COLUMN and a
// column has no room for `selectField`'s `<p class=nu-sel><label>` wrapper.
// Same widget, same `data-sel`, same refusal-with-a-reason; the visible copy of
// the reason is placed by this file, which is the chord-quality precedent
// (ui/selects.js:238: "the VISIBLE copy is still the caller's to place").
import { sheet, selectEl } from "./selects.js";

const el = (tag, text) => { const n = document.createElement(tag);
  if (text != null) n.textContent = text; return n; };
const DD = () => NuDeskDoc;
// A SILENT GREY IS THE BUG THIS ROUND EXISTS TO PREVENT ("when an option makes
// another one unaccessible gray it out" — and a grey with no reason is worse
// than none). So a refusal is one function: it disables the control AND puts
// the sentence next to it, in the same parent, where a gate that walks
// `input:disabled` can find it.
// `short` (2026-08-25) is the words that go IN the cell when the full sentence
// would not fit one — the board's bus columns are 124px and a ten-line reason
// there set the whole fader row 200px tall. The control still carries the WHOLE
// sentence in `title` and in `data-why`, where a gate and a screen reader both
// read it, and the caller prints the whole sentence once under the table. Same
// split ui/selects.js:238 makes for a menu inside a <td>.
function refuse(node, why, short) {
  node.disabled = true;
  node.setAttribute("aria-disabled", "true");
  node.title = why;
  node.dataset.why = why;
  const w = el("small", short || why); w.className = "nu-why";
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
  /* ---- THE FIVE THAT WERE MENUS UNTIL 2026-08-25 ----------------------------
     Paul: *"level, place, delay, and room are obvious sliders."* They were, and
     they were `<select>`s — `sheetRow` routes a single choice through
     ui/selects.js, so these five drew as five dropdowns down the voice's tab
     while the SAME five facts were pots on the board four screens below. Two
     widgets for one quantity is the drift this file's header forbids.

     WHY A SLIDER IS THE RIGHT ANSWER HERE AND NOT EVERYWHERE. fields.js says
     which: LEVELS (0.4 … 1.35), PANS (−0.7 … 0.7) and SENDS (0 … 0.9) are each
     ONE NUMBER with words on its stops, so the words are a SCALE and a pot
     shows its shape. The enumerated things on this page — what a bus is called,
     which reverb module it is, which compressor `glue` means — are SETS whose
     entries are names or whole objects, and they stay menus. `knob()` below
     carries that test in code and shouts if it is handed a table that is not a
     scale.

     THE ROWS GO IN THE TABLE, NOT BESIDE IT, because the table already has the
     third column that makes a send readable: the control holds YOUR value and
     the column holds WHAT IT IS RIDING ON. A dropdown next to nothing could not
     say "the genre asks 0.78"; a row can, and it is the same sentence the
     board puts on a `title` because a 92px column has no room for it. ---- */
  const base = sec ? deskChannelBase(sec, key) : { rev: 0, del: 0, pan: 0 };
  const pct = (x) => Math.round((x || 0) * 100) + "%";
  // "seated at", not "riding … seated": the fader row two above already prints
  // `riding X dB seated` for the DERIVED shading, and on a record with no desk
  // both numbers are 0.0 — two rows saying the same five words about two
  // different facts is how a reader learns to stop reading the column.
  row("level", knob("eng|lvl|" + voiceName, "lvl", LEVELS, LEVELLABEL, d.lvl,
        voiceName + " level", (v) => setDesk(ctx, voice, "lvl", v), "as it stands"),
      "the record seats it at " +
      fmtDb(20 * Math.log10(Math.max(1e-4, base.gain || 1))) + " dB");

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
  row("place", knob("eng|pan|" + voiceName, "pan", PANS, PANLABEL, d.pan,
        voiceName + " place", (v) => setDesk(ctx, voice, "pan", v), "as it stands"),
      "the record sits at " + (base.pan || 0).toFixed(2));

  // THE THREE SENDS. Bus 3 is `room` and it IS the reverb bus (desk.js:590
  // folds a part's room into its rev) — it is offered only where it can sound,
  // which is desk.js partKeysOf's own law: never an address that cannot.
  const hasKit = chans.some((c) => c.key === "drums");
  const roomWhy = key !== "drums" && !hasKit
    ? "bus 3 is the kit's ambience and this record has no kit" : null;
  {
    const w = knob("eng|rev|" + voiceName, "rev", SENDS, SENDLABEL, d.rev,
      voiceName + " " + busName("rev") + " send",
      (v) => setDesk(ctx, voice, "rev", v), genreAsk(sec));
    row("→ " + busName("rev") + (returnShut() ? " (shut)" : ""), w,
        pct(base.rev) + " into " + busName("rev") +
        (returnShut() ? " — but the return is shut; open it on bus 1's fader" : ""));
  }
  {
    const w = knob("eng|echo|" + voiceName, "echo", SENDS, SENDLABEL, d.echo,
      voiceName + " " + busName("echo") + " send",
      (v) => setDesk(ctx, voice, "echo", v), "dry");
    row("→ " + busName("echo"), w, pct(base.del) + " into " + busName("echo"));
  }
  {
    const w = knob("eng|room|" + voiceName, "room", SENDS, SENDLABEL, d.room,
      voiceName + " " + busName("room") + " send",
      (v) => setDesk(ctx, voice, "room", v), "dry");
    const tr = row("→ " + busName("room"), w,
      "bus 3 folds into " + busName("rev") + " (desk.js deskChannelBase)");
    if (roomWhy) tr.querySelector("td").append(refuse(w.querySelector("input"), roomWhy));
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

  const q = (k) => "eng." + k + "|" + voiceName;

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
  // HOW TO PICK A SECOND ONE, SAID OUT LOUD — the `leslie` recipe's finding
  // (2026-08-25), applied. Measured with real clicks at 390x844: a plain tap on
  // an option REPLACES the whole selection — leslie -> ["leslie"], chorus ->
  // ["chorus"], phaser -> ["phaser"] — so on a desktop pointer a second chip is
  // unreachable without ctrl/cmd, and nothing on the page said so. Three chips
  // is the documented limit and a pointer could only ever hold one, which made
  // the cap a promise the control could not keep. This is a sentence and not a
  // widget change on purpose: ui/sheets.js `rowsFor` already records that
  // deselecting is ctrl-click and that it is "legible as an accident, not as a
  // gesture", and whether to replace `<select multiple>` with something else is
  // Paul's call, not a slice's — he asked for the standard element by name.
  const how = el("p", "hold ⌘ (or Ctrl) to pick a second and a third — a plain"
    + " tap replaces the whole selection, which is what a <select multiple> does");
  how.className = "nu-hint";
  parent.append(how);

  // THE SUMMARY LINE IS GONE, and it is deleted rather than reworded because it
  // had become a SECOND OWNER of three facts. It printed "riding X dB · N% into
  // reverb · M% into delay" — which is now the third column of the level row
  // and of the two send rows, beside the control each number belongs to.
  // Keeping both would be the drift this file's header names: two answers to
  // one question, and no way to tell which one moved.
}

/* ======================= VIEW 2 · THE TWO BOARDS ==========================
   TWO <table>s SINCE 2026-08-25, AND A MEASUREMENT IS WHY. Paul: *"Do you want
   to put the bus and main into their own board so it's not all empty"*.
   Measured on the rendered page before this change: `#boardtbl` was one table
   of 7 columns and 177 cells, 99 of them EMPTY — 55.9%; of the body cells
   alone, 98 of 144, 68.1%. The cause is exactly what he says. A channel's rows
   (lo/mid/hi, level, place, three sends, cut, alone), a return's (name, room,
   time, repeats, tone) and the main's (drive … ceiling) are almost DISJOINT
   SETS, so one grid drawn over all three kinds is mostly hole.

   THE PARAGRAPH THIS REPLACES IS REWRITTEN AND NOT DELETED, because it is the
   argument that was tried and half of it is still the law. It read: "THE COST
   IS BLANK CELLS AND THEY ARE THE POINT. A bus has no `place` pot and the main
   has no `→ delay` send, so those cells are empty — which is exactly what a
   real console's master strip looks like beside a channel strip, and it is the
   honest alternative to inventing a control to fill a hole. The rows are
   grouped so the blanks read as blocks rather than gaps: the CHANNEL rows
   first, then THE RETURNS AND THE MAIN, then the two rows every strip answers."
   THE SECOND SENTENCE STANDS AND NOTHING BELOW INVENTS A CONTROL TO FILL A
   HOLE. What was wrong is the first: a console does not draw its returns on the
   channel grid at all — the returns and the master are a separate section of
   the desk, silkscreened apart — and the two `nu-sect` bands were dressing a
   hole rather than closing it. They are gone with the blanks they dressed.

   ...AND SPLITTING THE TABLE IN TWO, ON ITS OWN, ONLY MOVES THE HOLE, which is
   the second thing the measuring said. Drawn one-row-per-control the rack comes
   out 4 columns × 14 rows = 56 body cells with 34 empty, 61% — WORSE than the
   board it came out of. That 34 is COUNTED OFF THE REGISTRY and not off a page
   that was ever drawn (BUS_FIELDS gives bus 1 one gear knob, bus 2 three and
   bus 3 none; MASTER_FIELDS gives the main seven — so eleven single-owner rows,
   four of them a bus's and seven the main's, each leaving 3 of its 4 cells
   blank: 11 × 3 = 33, plus the main's blank in `name` = 34 of 56), and it is
   quoted here as arithmetic rather than as a measurement because that is what
   it is.

   So one more law, and it is a law about grids rather than about desks:

       A ROW IS A COMPARISON. Reading across a row compares ONE control over
       the whole desk; a row only ONE column can answer compares nothing — it
       is a label wearing a row's clothes — so it belongs INSIDE that strip.

   `name` is answered by all three buses and stays a row. The fader and
   where-it-goes are answered by every strip on both boards and stay rows. The
   single-owner controls stack in their own strip's `its own gear` cell, each
   with its own label, which is what a delay's front panel and a mastering
   chain look like in a rack anyway.

   SIGNAL ORDER IS STILL THE READING ORDER, it just crosses a paragraph now.
   Down a column: input → EQ → fader → sends (board one) → bus → master (board
   two), the British in-line order main:nukernel/ui/mixtbl.js:34 cites. The
   channels are first, the sentence BETWEEN the boards says where their sends
   land, and every channel's `goes to` cell names the same destinations the
   second board's columns are.

   NO POPUPS. The cell-row-plus-popover tracker was REVERSED in favour of a
   board, and this does not reintroduce it: no openFader, no popover, no fold —
   every control is on the page at rest. AND NO MENUS ON A CHANNEL, 2026-08-24.
   This paragraph used to say "no menus either"; the measurement that reversed
   HALF of it is 23 — `document.querySelectorAll("select")` found twenty-three
   on this page and every one of them was on this board, four per channel, which
   is the exact thing Paul objected to ("the options for each instrument in a
   song section are now just one thing in a dropdown. That's not effective.").
   The half that stands is the CHANNEL: a channel strip has no menu, its place
   and its sends and its level are pots. The half that reversed is the RACK:
   what a bus is called and which room it is are single choices about the whole
   record, and a single choice is a `<select>` (Paul, evening: "There are still
   many boxes that should be selects"). `knob()` below carries the test for
   which is which, and it is a fields.js question and not a taste one — which is
   also why the split above changed no widget: every pot is still a pot and
   every menu is still a menu, they only moved table.

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
   VIEW.

   ...AND A BUS FADER IS THE SAME TWO ELEMENTS ASKING THE SAME TWO QUESTIONS.
   The range is the RETURN — what this bus is worth into the main — and the
   meter is what is arriving times that return, both out of audio/desk.js
   `deskBusFeed`, which is also where the sentence lives for the two buses whose
   return this page cannot move. This file does not decide which of them are
   wired; it prints what the model says. Splitting the table did not move that
   decision and must not lose the refusals it produces: bus 2 draws at the
   engine's own unity and disabled, bus 3 gets no fader at all, and both print
   audio/desk.js's own sentence — short in the cell, whole under the table, and
   whole again in `data-why`/`title`. */
let CURRENT = null;

/* ---------- one board, built the same way twice --------------------------- */
// THE SPLIT IS WHICH STRIPS AND WHICH ROWS, AND NOTHING ELSE. Both tables are
// `.nu-board`, both ride a `.nu-pane`, both stamp `data-col` on every cell and
// `nu-edge` where a kind changes — so one CSS rule dresses both and a gate that
// reads one reads the other. A second `boardOf`-shaped block of code would have
// been two answers to "what does a strip look like".
function boardOf(id, capText, cols, headOf, dim) {
  const pane = el("div"); pane.className = "nu-pane";
  const t = el("table"); t.id = id; t.className = "nu-board";
  t.setAttribute("cellpadding", "0"); t.setAttribute("cellspacing", "0");
  t.append(el("caption", capText));
  // WHERE ONE KIND OF STRIP ENDS AND THE NEXT BEGINS, marked in the DOM rather
  // than guessed at in CSS: `:first-of-type` cannot see `data-col`, and the
  // number of channels is whatever the record has. One rule (`nu-edge`) draws
  // the heavy line a console silkscreens between its returns and its master.
  for (let i = 0; i < cols.length; i++)
    cols[i].edge = i > 0 && cols[i].kind !== cols[i - 1].kind;
  const thead = el("thead"), hr = el("tr");
  const corner = el("th"); corner.setAttribute("scope", "col"); hr.append(corner);
  for (const col of cols) {
    const th = headOf(col);
    th.setAttribute("scope", "col");
    th.dataset.col = col.kind;
    // AFTER `headOf`, never before it: each branch there assigns `th.className`
    // outright, which wipes a class added first. Caught on the rendered page —
    // the group rule was drawn on every `td` and on no `th`.
    if (col.edge) th.classList.add("nu-edge");
    hr.append(th);
  }
  thead.append(hr); t.append(thead);
  const tbody = el("tbody"); t.append(tbody);
  pane.append(t);

  const rowOf = (label) => {
    const tr = el("tr");
    const th = el("th", label); th.setAttribute("scope", "row");
    tr.append(th); tbody.append(tr);
    return tr;
  };
  const cellFor = (tr, col) => {
    const td = el("td");
    td.dataset.col = col.kind;
    if (col.edge) td.classList.add("nu-edge");
    if (dim && dim(col)) { td.classList.add("is-off");
                           td.setAttribute("aria-disabled", "true"); }
    tr.append(td); return td;
  };
  // ONE ROW, EVERY COLUMN OF THIS BOARD. `fill` is called for every strip and
  // simply returns without appending where the control has no meaning there —
  // which keeps the grid rectangular, and a rectangular grid is what makes
  // reading across a row a comparison rather than a guess. After the split
  // there is exactly ONE cell on either board where `fill` returns empty (the
  // main has no name), which is the whole point of the round.
  const strip = (label, fill) => {
    const tr = rowOf(label);
    for (const col of cols) fill(col, cellFor(tr, col));
    return tr;
  };
  // WHICH PANE THIS IS ACROSS A REBUILD (ui/eight.js keepPanes/putPanes,
  // 2026-08-25), keyed by the first control inside it exactly as eight.js's own
  // `pane()` keys one. Two boards means two panes and two keys, and they must
  // be different or the returns board would be scrolled to the channels'
  // position. Measured on the rendered page: `b|eqlo|<voice>` and
  // `sel|bus|rev|name` — the second is a <select>, and ui/selects.js gives one
  // a `data-k` of its own so focus survives a redraw, which is why the first
  // control of the rack board answers this query at all.
  const key = () => { const b0 = t.querySelector("[data-k]");
                      if (b0) pane.dataset.pane = b0.dataset.k; };
  return { pane, t, tbody, rowOf, cellFor, strip, key };
}

// ONE LABELLED CONTROL INSIDE A STRIP'S OWN CELL — ui/selects.js `selectField`'s
// shape (`<p class="nu-sel"><label><span class="nu-w">…`) built here rather
// than called, for the one difference a board column needs. `selectField`
// prints the WHOLE refusal under the control, and a 124px column cannot hold
// ten lines of it without setting the row 200px tall (measured 2026-08-25). So
// the cell carries the SHORT marker and the whole sentence is printed once
// under the table — the same split ui/selects.js:238 makes for a menu in a
// <td> ("the VISIBLE copy is still the caller's to place") — while the control
// itself still carries the whole of it in `data-why` and `title`, where the
// gate and the screen reader both read it.
function labelled(td, label, control, shortWhy) {
  const p = el("p"); p.className = "nu-sel";
  const lab = el("label");
  const w = el("span", label + " "); w.className = "nu-w";
  lab.append(w, control);
  p.append(lab);
  if (shortWhy) {
    p.classList.add("is-off");
    const s = el("small", shortWhy); s.className = "nu-why";
    s.title = control.dataset.why || shortWhy;
    p.append(s);
  }
  td.append(p);
  return p;
}

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
  // WHAT EACH BUS IS CARRYING AND WHERE IT REACHES — the model's answer, never
  // this file's arithmetic (audio/desk.js deskBusFeed, and the same law as the
  // channel meters two paragraphs up).
  const feeds = deskBusFeed(sec, MASTER, BUSES);
  const meters = [], outs = [];
  const dim = (col) => col.kind === "ch" && anySolo && !deskOf(col.c.voice).solo;

  /* ================= BOARD ONE · THE CHANNELS =================
     One column per voice that has a channel, one row per control, and after the
     split every one of those rows is answered by every one of those columns. */
  const CH = chans.map((c) => ({ kind: "ch", key: c.key, c }));
  const A = boardOf("boardtbl",
    "the channels · the slider is your offset, the bar is what the record is"
    + " already doing", CH, (col) => {
      const th = el("th");
      th.className = "nu-ch";
      if (dim(col)) { th.classList.add("is-off");
                      th.setAttribute("aria-disabled", "true"); }
      th.dataset.ch = col.key;
      th.append(el("span", col.c.voice.name));
      // THE BOARD PRINTS THE VOICE'S OWN NAME, not its chair key, and this is
      // deliberate rather than cosmetic: ui/eight.js hands the kernel `realize`
      // and never `part`, so a voice the document calls a `counter` is ADDRESSED
      // `line2` (desk-doc.js says why fixing the name would move the music). The
      // address is printed under the name so the two are never confused.
      th.append(el("small", (col.c.voice.instrument || col.c.voice.kind || "") +
        " · " + col.key));
      return th;
    }, dim);
  const chOnly = (fn) => (col, td) => { if (col.kind === "ch") fn(col.c, td); };

  for (const b of EQ_BANDS) {
    A.strip(b.label, chOnly((c, td) => {
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
    }));
  }
  // THE LEVEL ENUM, ON THE BOARD, 2026-08-25. It was on the engineer's tab only
  // and it is the first of the four Paul named ("level, place, delay, and room
  // are obvious sliders"). LEVELS is a scale — hush 0.4 through forward 1.35 —
  // so it takes the same pot as `place` and the sends, and having it here is
  // what makes the tab and the board the same surface rather than two.
  A.strip("level", chOnly((c, td) => {
    td.append(knob("b|lvl|" + c.voice.name, "lvl", LEVELS, LEVELLABEL,
      deskOf(c.voice).lvl, c.voice.name + " level",
      (v) => setDesk(ctx, c.voice, "lvl", v), "as it stands"));
  }));
  A.strip("place", chOnly((c, td) => {
    td.append(knob("b|pan|" + c.voice.name, "pan", PANS, PANLABEL,
      deskOf(c.voice).pan, c.voice.name + " place",
      // "as it stands" and not "centre": PANLABEL already spells 0 `centre`,
      // so labelling the blank detent the same word put TWO detents reading
      // "centre" side by side (measured: the sweep came out left, left-ish,
      // centre, centre, right-ish, right). One word for absence everywhere on
      // this board, and its POSITION is what says the record is dead centre.
      (v) => setDesk(ctx, c.voice, "pan", v), "as it stands"));
  }));
  const hasKit = chans.some((c) => c.key === "drums");
  for (const [field, bus] of [["rev", "rev"], ["echo", "echo"], ["room", "room"]]) {
    const tr = A.strip("→ " + busName(bus) + (field === "rev" && shut ? " (shut)" : ""),
      chOnly((c, td) => {
        // THE EMPTY DETENT'S WORD IS SHORT ON THE BOARD AND LONG IN THE VOICE'S
        // OWN TAB, on purpose: a 92px column cannot carry "the genre asks 0.78"
        // without wrapping it to four lines, so the sentence goes on the
        // control's `title` and the engineer's own row (which has the width)
        // still prints it whole.
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
      }));
    if (field === "rev" && shut)
      tr.firstChild.title = "every channel below is sending into a return whose"
        + " gain is zero — open it on bus 1's fader";
  }
  for (const [k, label] of [["mute", "cut"], ["solo", "alone"]]) {
    A.strip(label, chOnly((c, td) => {
      const b = document.createElement("input");
      b.type = "checkbox"; b.checked = !!deskOf(c.voice)[k];
      b.dataset.k = "b|" + k + "|" + c.voice.name;
      b.setAttribute("aria-label", c.voice.name + " " + label);
      b.addEventListener("change", () => setDesk(ctx, c.voice, k, b.checked));
      td.append(b);
    }));
  }
  {
    const tr = A.rowOf("fader"); tr.dataset.row = "fader";
    for (const col of CH) {
      const td = A.cellFor(tr, col);
      const c = col.c, d = deskOf(c.voice);
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
  // WHERE EACH STRIP GOES, PRINTED — and on this board it is also the arrow to
  // the next one: the words a channel leaves by are the names of the columns of
  // board two.
  A.strip("goes to", (col, td) => {
    if (col.kind === "ch") td.append(el("small", "main + its sends"));
  });
  A.key();
  host.append(A.pane);

  // THE WIRE BETWEEN THE TWO BOARDS, IN WORDS, because the split took away the
  // thing that used to say it — a channel and its return were adjacent columns
  // and now they are two tables. This is the only sentence on the page whose
  // job is the RELATIONSHIP, so it names the three sends and the destination in
  // the order the boards are read, and the bus names come off the one reader
  // (`busName`) so renaming bus 1 renames it here too.
  const flow = el("p", "↓ every channel above leaves on the main, and its three"
    + " sends leave on " + busName("rev") + ", " + busName("echo") + " and "
    + busName("room") + " — which are the first three columns below. What comes"
    + " back off them, and the main it comes back into, is the second board.");
  flow.className = "nu-flow";
  host.append(flow);

  /* ================= BOARD TWO · THE RETURNS AND THE MAIN =================
     `bus N` is the index in BUS_FIELDS and not a hand-typed number, so a fourth
     bus would be `bus 4` by existing. */
  const RK = [
    ...BUS_FIELDS.map((b, i) => ({ kind: "bus", key: b.bus, b, n: i + 1 })),
    { kind: "main", key: "main" },
  ];
  const B = boardOf("racktbl",
    "the returns and the main · what comes back off the sends, then the last"
    + " thing the record touches", RK, (col) => {
      const th = el("th");
      if (col.kind === "bus") {
        th.className = "nu-bus";
        th.dataset.bus = col.key;
        th.append(el("span", "bus " + col.n));
        // the bus's CURRENT name, off the one reader, so renaming bus 1 renames
        // its column head, the channel board's send row and the engineer's
        // sheet at once
        th.append(el("small", busName(col.key)));
      } else {
        th.className = "nu-main";
        th.dataset.main = "1";
        th.append(el("span", "main"));
        th.append(el("small", "the record"));
      }
      return th;
    }, dim);

  const busRow = (col) => BUS_FIELDS.find((b) => b.bus === col.key);
  const bv = (bus, k) => (doc.sound && doc.sound.buses && doc.sound.buses[bus]
    && doc.sound.buses[bus][k]) || "";
  const busSel = (col, spec) => selectEl({
    key: "bus|" + col.key + "|" + spec.key, label: spec.label,
    options: optionsFor(spec.table, spec.labels, bv(col.key, spec.key), null,
                        "nothing set"),
    value: bv(col.key, spec.key),
    set: (v) => { DD().writeBus(doc, col.key, spec.key, v); ctx.changed(); },
  });

  // ROW ONE, AND IT IS A ROW BECAUSE THREE COLUMNS ANSWER IT: what each return
  // is called. The main's cell is the one blank left on either board and it
  // stays blank — the main is not a bus and has no name knob, and inventing one
  // to square the grid is the thing this file refuses.
  B.strip("name", (col, td) => {
    if (col.kind !== "bus") return;
    td.append(busSel(col, busRow(col).knobs.find((k) => k.key === "name")));
  });

  // ROW TWO: EACH STRIP'S OWN FRONT PANEL. Every control here was its own row
  // until 2026-08-25 and only one column could ever answer it — `color` is bus
  // 1's, `time`/`repeats`/`tone` are bus 2's, all seven master words are the
  // main's — so by the law at the top of this view they are labels and not
  // comparisons, and they belong in the strip. Drawn in the registry's own
  // order, which for the master is the order of the chain
  // (drive → glue → tape → space → width → tilt → ceiling), so reading down
  // this cell is reading the signal through it.
  //
  // `ret` is not here because `ret` IS the fader two rows down, and drawing it
  // twice would be two owners of one fact. `name` is not here because it is the
  // row above.
  const HOMELESS = { width: 1, tilt: 1, ceiling: 1 };
  const mv = (k) => (doc.sound && doc.sound.master && doc.sound.master[k]) || "";
  B.strip("its own gear", (col, td) => {
    if (col.kind === "bus") {
      const gear = busRow(col).knobs
        .filter((k) => k.key !== "ret" && k.key !== "name");
      // BUS 3 HAS NO GEAR AND SAYS SO RATHER THAN SITTING BLANK. fields.js:
      // "`room` therefore keeps its name and no knob of its own: it IS the
      // reverb bus (audio/desk.js:590 folds a part's `room` into its `rev`)".
      // An empty cell here would read as "not drawn yet"; the sentence is the
      // fact.
      if (!gear.length) {
        const w = el("small", "no knob of its own — it IS bus 1's return, and"
          + " a part's `room` is folded into its `rev` (audio/desk.js:590)");
        w.className = "nu-why";
        td.append(w);
        return;
      }
      const g = el("div"); g.className = "nu-gear"; td.append(g);
      for (const spec of gear) labelled(g, spec.label, busSel(col, spec));
      return;
    }
    // WIDTH, TILT AND CEILING'S PUSH REACH NOTHING (audio/desk.js:769 names all
    // three and says why: the parent gets its width from placement, its tone
    // stage is a pair of cuts rather than a tilt, and master_limit's threshold
    // is fixed in the DSP). They round-trip and they draw; they are drawn
    // DISABLED with a marker beside them, the whole sentence on the control and
    // once under the table, because saying so is cheaper than pretending and a
    // `title` is a thing no phone will ever show.
    // THE CHAIN FLOWS, IT DOES NOT JUST STACK, AND THE REASON IS A NUMBER.
    // Measured 2026-08-25 with the seven in one column: the `its own gear` row
    // came out 548px tall because the main's cell was 489px, and bus 1's cell —
    // one menu, 62px — sat under 427px of white. A table row is as tall as its
    // tallest cell, so the fix is the tall cell rather than the row: `.nu-gear`
    // is a grid that takes as many columns as the strip is wide, which is two
    // for the main and one for a 124px bus. Row-major, so drive → glue → tape →
    // space → width → tilt → ceiling is still the reading order.
    const g = el("div"); g.className = "nu-gear"; td.append(g);
    for (const f of MASTER_FIELDS) {
      const why = HOMELESS[f.key] ? MASTER_WHY : null;
      labelled(g, f.label, selectEl({
        key: "master|" + f.key, label: f.label,
        // "nothing set" and not "as it stands": what absence means here is not
        // a number — it is the engine's own answer (fields.js resolveMaster:
        // five resolve to null and build nothing at all, glue and ceiling
        // resolve to their shipped default) — and "nothing set" is the one
        // phrase true of all seven without naming a value that seven different
        // tables spell differently.
        options: optionsFor(f.table, f.labels, mv(f.key), null, "nothing set"),
        value: mv(f.key),
        ...(why ? { why } : {}),
        set: (v) => { DD().writeMaster(doc, f.key, v); ctx.changed(); },
      }), why ? "reaches no sound" : null);
    }
  });

  {
    const tr = B.rowOf("fader"); tr.dataset.row = "fader";
    for (const col of RK) {
      const td = B.cellFor(tr, col);
      if (col.kind === "bus") busFader(td, col, feeds[col.key], doc, ctx, meters);
      else td.append(listening());
    }
  }
  // WHERE EACH STRIP GOES, PRINTED. This row and the channel board's twin are
  // the whole of "establish what routing actually exists": a channel's dry path
  // and its three sends, each bus's destination, and the main's. It is data
  // from audio/desk.js (`deskBusFeed`'s `to`) for the buses, so the page and
  // the model cannot disagree about a wire.
  B.strip("goes to", (col, td) => {
    if (col.kind === "bus") { td.append(el("small", feeds[col.key].to)); return; }
    td.append(el("small", "the speakers"));
  });
  B.key();
  host.append(B.pane);

  // THE ONE SENTENCE THE ROUTING OWES THE READER, once, under the second board.
  // A bus does not send to another bus and there is no knob for it — fields.js
  // took the two cross-sends off on 2026-08-24 because the WebAudio rack they
  // were written against is gone and the parent's bus graph takes no edge.
  // Saying so is what stops the next round from adding one that draws and does
  // nothing.
  const note = el("p", "a channel sends to bus 1, 2 and 3; bus 1 returns to the"
    + " main. No bus sends to another bus — the parent's bus graph takes no edge"
    + " (fields.js, 2026-08-24), so there is no knob for it rather than a knob"
    + " that does nothing.");
  note.className = "nu-hint";
  host.append(note);
  // ...AND EVERY REFUSAL'S WHOLE SENTENCE, ONCE, HERE. The cells above carry a
  // short marker because a 124px column cannot hold ten lines without setting
  // the fader row 200px tall (measured), and a marker on its own would be the
  // silent grey this file exists to prevent. So the long form is printed in one
  // place a reader can get to without a hover — the same answer ui/selects.js
  // reached for a menu in a <td> — and it stays in `data-why` and `title` on
  // each control for the gate and the screen reader.
  const refusals = el("ul"); refusals.className = "nu-hint";
  const says = [];
  for (const b of BUS_FIELDS) if (feeds[b.bus].why) says.push(feeds[b.bus].why);
  if (MASTER_FIELDS.some((f) => HOMELESS[f.key]))
    says.push(MASTER_FIELDS.filter((f) => HOMELESS[f.key]).map((f) => f.label)
      .join(", ") + ": " + MASTER_WHY);
  for (const w of says) refusals.append(el("li", w));
  if (says.length) host.append(refusals);

  const paint = () => {
    const s = atBox();
    // ONE deskBusFeed PER PAINT, not one per bus meter: paint() runs from the
    // page's on("pos") handler once a beat and the walk sums every channel's
    // sends, so three calls a beat is three times the work for one answer.
    const bf = deskBusFeed(s, MASTER, BUSES);
    for (const x of meters) {
      if (x.bus) {                          // a bus meter: what leaves it
        const f = bf[x.bus];
        x.m.value = gainToF(f.out);
        x.m.title = "leaving this bus toward " + f.to + ": " +
          Math.round(f.feed * 100) + "% in";
        continue;
      }
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

/* ---------- a bus's fader, which is its send to the main ------------------ */
// THE ANSWER TO "from the buses to the master mix too", one bus at a time, and
// the model decides — audio/desk.js `deskBusFeed` says whether a bus's return
// can be moved and, when it cannot, hands over the sentence saying why. This
// file never decides that; if it did, the board and the engine would each have
// an opinion about a wire.
function busFader(td, col, f, doc, ctx, meters) {
  if (!f.movable) {
    // BUS 2 IS A FADER THE PAGE CANNOT REACH, so it is drawn AT ITS REAL VALUE
    // and refused — fx_bus carries `dgain` and the renderers push it, but
    // fxParams emits the literal 1. BUS 3 IS NOT A FADER AT ALL, so nothing is
    // drawn for it and the sentence stands alone: inventing a slider for a
    // thing that is not a return would be the lie this whole file is about.
    if (col.key === "echo") {
      const r = document.createElement("input");
      r.type = "range"; r.min = "0"; r.max = "2"; r.step = "0.01"; r.value = "1";
      r.dataset.k = "bus|" + col.key + "|ret";
      r.setAttribute("aria-label", "bus " + col.n + " return");
      td.append(r);
      td.append(el("output", "unity"));
      td.append(refuse(r, f.why, f.short));
    } else {
      const w = el("small", f.short || f.why); w.className = "nu-why";
      w.title = f.why;
      td.append(w);
    }
  } else {
    const spec = BUS_FIELDS.find((b) => b.bus === col.key).knobs
      .find((k) => k.key === "ret");
    const cur = (doc.sound && doc.sound.buses && doc.sound.buses[col.key]
      && doc.sound.buses[col.key].ret) || "";
    // A SCALE, SO A POT — the same test `knob()` carries. RETURNS runs
    // 0 (off) .. 0.625 (huge), where `huge` is the saturation point of
    // rgain = clamp(reverb*3.2, 0, 2) and there is nothing above it
    // (fields.js). The blank detent is 0 because audio/plan.js hands toEngine
    // `reverb: 0`, so a record that never opened the rack is genuinely shut.
    // "as it stands", NOT "shut", and it is the `place`/"centre" trap one bus
    // down: RETURNLABEL already spells `off` as "shut", so labelling the blank
    // detent the same word put TWO stops reading "shut" side by side (measured
    // on the rendered page: shut · shut · a little · a room · a hall · as wet
    // as it goes). One word for absence everywhere on this board, and its
    // POSITION — first, beside `off`, because both are 0 — is what says the
    // record has not opened the return.
    td.append(knob("bus|" + col.key + "|ret", "ret", spec.table, spec.labels,
      cur, "bus " + col.n + " return",
      (v) => { DD().writeBus(doc, col.key, "ret", v); ctx.changed(); },
      "as it stands"));
  }
  const m = document.createElement("meter");
  m.min = 0; m.max = 1;
  m.title = "leaving this bus toward " + f.to;
  td.append(m);
  meters.push({ m, bus: col.key });
}

/* ---------- the listening level, on the strip it belongs to --------------- */
// PAUL, 2026-08-25: "the 'listening' slider doesn't make much sense."
//
// IT DID NOT, AND HERE IS EXACTLY WHAT IT WAS DOING. It was a second view of
// the transport bar's `volume` fader — the comment above it said so, and cited
// main:mixtbl.js:104's "two views over ONE store, never two levels" — but the
// two views were on DIFFERENT SCALES. `#vol` in index.html:68 is
// `min=0 max=100 step=1`; this one was written `min=0 max=1 step=0.01`, and
// the store is the 0..100 one (ui/state.js readVol clamps to 0..100 and
// audio/live.js:573 sends `vol / 100` to the engine). Measured on the rendered
// page: the store boots at 80, this slider drew `value="80"` against `max="1"`
// so the browser clamped it and it sat hard right looking like "full"; one
// touch anywhere on it wrote 0.5, which is `masterVol` 0.005 — 44 dB below
// where the record had been — and localStorage took it, so the page came back
// near-silent on the next boot and the only way out was the OTHER fader.
//
// SO IT IS FIXED RATHER THAN REMOVED, because the control itself is right and
// it now has somewhere to be: it is the MAIN STRIP'S FADER. A console's master
// strip carries the monitor level, that is what this is, and the row it sits in
// is the row every other strip answers with its own fader. Same store, same
// scale as the bar's, and the sentence under it says which of the two things on
// this page it is — because the main strip's OTHER controls (drive, glue, tape,
// space) are the record and this one is the room.
function listening() {
  const wrap = el("span");
  const r = document.createElement("input");
  r.type = "range"; r.min = "0"; r.max = "100"; r.step = "1";
  r.value = String(vol); r.id = "vol2"; r.dataset.k = "m|listening";
  r.setAttribute("aria-label", "listening level");
  const o = el("output", Math.round(vol) + "%");
  const say = () => { o.textContent = Math.round(+r.value) + "%";
                      r.setAttribute("aria-valuetext", o.textContent); };
  say();
  r.addEventListener("input", () => { say(); setVol(+r.value); commit("transport"); });
  const w = el("small", "the room, not the record — not saved with the song");
  w.className = "nu-hint";
  wrap.append(r, o, w);
  return wrap;
}

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
// already answers it — every entry a finite number, or not:
//   SCALES, so pots: SENDS 0..0.9 · LEVELS 0.4..1.35 · PANS −0.7..0.7 ·
//     RETURNS 0..0.625. All four are ONE quantity with words on its stops, and
//     all four are on a strip.
//   SETS, so menus: BUSNAMES (twelve names in no order) · REVERBS (five
//     different wasm modules) · GLUES / TAPES / SPACES / CEILINGS, whose
//     entries are OBJECTS of three to five parameters each — there is no single
//     number for a slider to run along, and inventing an order would be a
//     picture that lies.
// (Paul, 2026-08-25: "level, place, delay, and room are obvious sliders" — and
// the standing rule the same message carries: "A slider is for a CONTINUOUS or
// ORDERED quantity; do not turn a genuine either/or into a slider because it
// fits the board better.")
//
// `<input type=range step=1>` over the words IN VALUE ORDER, with the word
// itself printed under it. Numeric tables ONLY: a slider over an unordered set
// would be a lie about the shape of the thing, so a non-numeric entry is
// dropped and said out loud rather than drawn at some arbitrary index.
const ZERO_STRIP = NuFields.resolvePartMix({});
// WHICH FIELD RESOLVES TO WHICH NUMBER — fields.js:838's own mapping, quoted
// rather than re-derived ("the field is `echo`, the bus is `del`"). `ret` is
// not a part field and is deliberately absent: a bus's return defaults to 0
// because audio/plan.js hands toEngine `reverb: 0`, which is the same 0 the
// lookup below falls through to.
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

// THE THREE THAT REACH NO SOUND, in one sentence, so the master strip's cells
// and any gate reading them back quote the same words.
const MASTER_WHY = "this one round-trips and draws but reaches no sound" +
  " — audio/desk.js:769 names all three and says why";
