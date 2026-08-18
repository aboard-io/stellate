// ui/editor.js — the phrase editor as THE COMPOSE PAGE ("compose, arrange,
// mix", 2026-08-16). The modal died: the editor is a full page again, one of
// the rail's three verbs, and openPhraseEditor() is now a NAVIGATION — it
// loads the phrase and switches the deck to Compose (on a desk, where every
// page is visible, it just scrolls the panel into view). Reached from the
// rail, from a PHRASE thumbnail on an Arrange row, or from a row's [+].
//
// PLAIN, NOT DEEP (2026-08-17, "the phrase editor still has too much depth
// and false embossing"). Seed/Random/Clear used to be a key row with WORDS on
// it; every header used to print a numeric range under its name; the corner
// said "st" and a binary column's aria fallback said "on/off". None of that
// prints any more — icon + title tooltip is the whole control, "success is
// almost no words". Legibility comes from ALTERNATE ROW SHADING
// (kernel-daw.css .prow.alt) instead of any bevel; the load-bearing rings
// (.slot.sel etc.) are the only shadows left, exactly as they always were.
//
// A PHRASE IS 1..128 STEPS now (song.js PHRASE_MIN/MAX), not nailed to
// sixteen — the length lives in the eight vectors themselves, so growing or
// shrinking one (the two length keys below) is resizing eight arrays
// together. The grid is built once PER LENGTH: a fresh sixteen-step phrase
// never rebuilds, opening a 128-step one does — the same "rare and
// structural" exception the tray's own [+] already made for the bank's size.
// `.steps` (kernel-daw.css) scrolls its OWN rows rather than growing the page
// out from under the tray below it — "page or scroll the grid, don't shrink
// the cells". The row loop below is deliberately `i < len`, never
// `i < len - 1`: a generalized row count is exactly where that fencepost
// bites, and it is what stands between a tap and the phrase's own last row.
//
// THE MARKS (2026-08-17, "no way to do chromaticism or passing notes that I
// can see, or grace notes or flams"). A ninth column, `orn`, holding the three
// marks that had nowhere to live — grace, flam, roll — beside acc and sld,
// which were always marks and always had columns. It is a third kind of cell:
// not a fader and not a switch but a small glyph that CYCLES, because the
// value is an enum and neither existing shape can say one. The vector is grown
// lazily (ensureOrn below), so no saved song is rewritten and a phrase nobody
// marks stays the eight vectors song.js validates.
//
// THE TRAY replaces the old bank's lone [+]/[−] pair with one clone icon and
// one x PER PHRASE: clone lands at the end of the tray, x deletes THIS
// phrase (not only the last one — see deletePhrase below, which renumbers
// every stack entry in every box that referenced it, the whole reason the
// old code restricted deletion to the tail). A box a deletion leaves with
// nothing to play is flagged on the MODEL, not drawn here — `sec.silent`,
// which ui/songrow.js's row renderer reads to paint that section red.
//
// THE ROTATION READ: thumbPath (below) already drew time left-to-right (x =
// step index) and pitch bottom-to-top (a higher deg+oct sits at a SMALLER y)
// before this pass touched it — generalizing its step axis to the phrase's
// own length found no actual 90-degree swap to fix. It stays the one drawing
// of a phrase, used by the tray here AND by ui/songrow.js's Arrange-row
// chips, so the two faces of a phrase cannot disagree about which way it
// reads.
//
// THE PLAYHEAD reads audio/transport's own clock (getPosition/passAt) — the
// same accessor main.js's rAF loop already reads for the song row's fill bar
// — never a second scheduler. It IS a second requestAnimationFrame CONSUMER
// of that clock: main.js's one loop paints songrow and the mix board, and
// this file is not on its call list because main.js belongs to another lane.
// Started/stopped with the same playing-guard idiom that loop uses, and it
// paints only refs this module owns. Folding it into that one loop is the
// natural next step and is called out in this pass's report.
//
// Layer graph: ui view — imports state/derive/deps, palette (for toggle:
// clicking a slot also toggles the phrase into the focused layer), pages
// (setPage IS the open verb now) and — new this pass — audio/transport, for
// the playhead only (a read of getPosition/passAt, never a control call).
import { GENRES, DEFAULT, blank, NuSong, NSLOTS } from "./deps.js";
import { SLOTS, SONG, SUBJ, slot, setSlot, putPhrase, curSection, commit,
         on } from "./state.js";
import { isBlank, focused } from "./derive.js";
import { toggle } from "./palette.js";
import { buzz, pointers } from "./touch.js";
import { setPage } from "./pages.js";
import { openFader, refresh as refreshFader } from "./popfader.js";
import { playing, getPosition, passAt } from "../audio/live.js";

/* ---------- the page's insides ---------- */
// Built HERE, into kernel-daw.html's #composewrap (the page section owns only
// the shell). The ids the modal carried — #stepgrid #slots #seed #rnd #clear
// #edslot — are kept on the page's own elements, because they are gate-read.
const mk = (tag, cls, txt) => {
  const n = document.createElement(tag);
  n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};
// AN ICON AND A TOOLTIP, NOTHING ELSE (Paul, 2026-08-17): every key in this
// head row used to also carry a visible `.t` word. None of them do any more
// — id/title/aria-label carry the name for a screen reader and the tooltip,
// the icon carries the picture, and that is the whole control.
const ikBtn = (id, cls, label, title) => {
  const b = document.createElement("button");
  b.type = "button"; b.id = id; b.title = title;
  b.setAttribute("aria-label", label);
  const k = document.createElement("span");
  k.className = "k"; k.setAttribute("aria-hidden", "true");
  b.append(k);
  return b;
};
const wrap = document.getElementById("composewrap");

// NO HEADER, NO (?) — "get rid of headers and help buttons and table
// headers" (Paul, 2026-08-16). What stood here was an h2 reading
// "Compose · phrase 1" (the rail key already says COMPOSE, and the open
// phrase is lit in the tray below), a round (?) over a paragraph explaining
// a tracker you can simply drag on, and a second h2 + (?) pair over the
// phrase tray. All four are DELETED, not hidden — the paragraphs went with
// them, because a surface that needs a paragraph is a surface that is wrong.
//
// #edslot survives the cull: it is the one thing the head said that the page
// cannot say twice — WHICH phrase these rows are — so it rides the key row
// as a plain value instead of inside a heading.
const head = mk("div", "edhead");
const edslotEl = Object.assign(mk("span", "edslot", "phrase 1"), { id: "edslot" });
// LENGTH, not a typed number: the phrase doubles or halves, 16..PHRASE_MAX,
// so the tracker never asks for a count — "don't bother with numbers and
// ranges". Hidden at either end (patchGrid below), the way the tray's own
// [+] already hides at a full bank.
const shrinkBtn = ikBtn("shrink", "btn ik ik-shrink", "shorter phrase",
  "halve the phrase's length");
const growBtn = ikBtn("grow", "btn ik ik-grow", "longer phrase",
  "double the phrase's length, up to " + NuSong.PHRASE_MAX + " steps");
const seedBtn = ikBtn("seed", "btn ik ik-seed", "starter phrase", "write the starter phrase");
const rndBtn = ikBtn("rnd", "btn ik ik-rnd", "random phrase", "roll a random phrase");
const clearBtn = ikBtn("clear", "btn ik ik-clear", "clear phrase", "empty this phrase");
// SWING lives here too, not as a ninth column: a drum pattern's shuffle is
// one setting for the whole grid, the way a real machine's dial is one knob
// — shown only while a drum pattern is open (patchGrid).
//
// #pswing, NOT #swing: the SONG's swing picker is a <select id="swing"> in the
// session drawer on the Mix page, and the two ids collided the moment both
// lanes landed. Document order decides that fight and this page is built
// first, so the button would have shadowed the select for every
// getElementById("swing") in ui/chrome.js and for the `#swing` selector
// nukernel-groove.test.js drives — the song's shuffle picker, silently dead.
// A pattern's shuffle and a song's shuffle are different settings; they get
// different names.
const swingBtn = ikBtn("pswing", "btn ik ik-swing", "pattern swing", "cycle this pattern's shuffle");
head.append(edslotEl, mk("span", "spacer"), shrinkBtn, growBtn, swingBtn, seedBtn, rndBtn, clearBtn);

const stepsWell = mk("div", "steps tbl");
const gridEl = Object.assign(mk("div", "stepgrid"), { id: "stepgrid" });
const gridPlay = mk("i", "phhead");            // the grid's own playhead, see below
gridPlay.setAttribute("aria-hidden", "true");
// THE DRUM GRID — a second, fixed-size (sixteen step) grid beside the
// melodic one, lanes down the rows instead of steps: a step sequencer's own
// orientation, not the tracker's. Built once (buildDrumGrid, below); which
// of the two shows is patchGrid's call, off SUBJ.kind.
const drumGridEl = Object.assign(mk("div", "drumgrid"), { id: "drumgrid" });
stepsWell.append(gridEl, drumGridEl);

const slotsEl = Object.assign(mk("div", "slots tbl"), { id: "slots" });

wrap.append(head, stepsWell, slotsEl);

/* ---------- the step grid ---------- */
// the vector vocabulary, exported: the order here is the COLUMN order of the
// tracker table — one definition. The switches lead, the values follow.
export const ROWS = ["gate", "acc", "sld", "orn", "deg", "oct", "vel", "inc", "stk"];
export const RANGE = { deg: [-7, 7], oct: [-2, 2], vel: [0, 9], inc: [-3, 3], stk: [-2, 2] };
const clampTo = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));

// ---------- THE MARKS ----------
// A THIRD KIND OF CELL, and the reason it is not a fader and not a switch:
// `orn` is a small enum naming HOW a note is played (kernel.js ORNAMENTS), and
// the two cell shapes this tracker already had cannot say it — a bar would put
// a number on a thing that is not a quantity, and a toggle can only say one
// mark. So the cell draws a MARK and a tap cycles it, which is exactly how a
// musician reads it off paper: a corner tick is the grace note, a doubled edge
// is the flam, and the dots ARE the subdivision, one per stroke. Nothing here
// is a numeral, a word or a menu — the title tooltip is the whole explanation,
// the same law as the icon keys in the head row above.
//
// acc and sld are marks too, and they already have their own columns; this is
// the column for the three that had nowhere to live.
const MARKS = ["", "◜", "‖", "··", "···", "····"];
const MARKNAME = ["no mark", "grace note", "flam", "roll of two",
                  "roll of three", "roll of four"];

// ---------- THE DRUM PATTERN ----------
// A phrase's SECOND KIND (kernel.js kind:"drum", DRUM_LANES/DMARK, lane
// C3's own pass): a lane grid, not a line. This is its own small vocabulary,
// kept here the way MARKS/MARKNAME above keep their own copy of the melodic
// marks rather than reading kernel.js's names back out — a UI word and an
// engine word are allowed to differ, but the LETTERS and the eight integers
// they cycle through must stay the ones kernel.js DRUM_LANES/DMARK fixed.
// "Pattern" is the one place that word survives (Paul: "this is the one
// place 'pattern' survives") — every other surface in this file says phrase.
const DLANES = [["k", "kick"], ["s", "snare"], ["h", "closed hat"],
                ["o", "open hat"], ["c", "clap"], ["p", "rim"], ["t", "toms"]];
// four of these eight are MARKS' own glyphs, reused rather than reinvented —
// a flam and a roll mean the same thing on a drum lane that they mean on a
// melodic one. Accent and ghost have no melodic analogue (vel/acc are a
// separate column there); here they are two more steps of the same cycle.
const DMARKS = ["", "●", "◆", "·", "◜●", "··", "···", "····"];
const DMARKNAME = ["silent", "hit", "accent", "ghost", "flam",
                    "roll of two", "roll of three", "roll of four"];
// the pattern's OWN shuffle — one knob, not a per-step vector, cycled by a
// single head key. Names only; the fractions themselves live in kernel.js
// DRUM_SWING, read by index so this file never has to agree with a number.
const DSWING = ["straight", "light", "swing", "shuffle"];
// isBlank (derive.js) reads p.gate, which a drum pattern does not have —
// this is the same question asked of either kind.
const isBlankAny = p => p.kind === "drum"
  ? DLANES.every(([d]) => !(p[d] || []).some(Boolean))
  : isBlank(p);

const cells = {};                          // key -> [len {b,bar,cv}], alive until a resize
let gridLen = 0;                           // the row count the grid is CURRENTLY built for
// A PHRASE THAT PREDATES THE MARKS HAS NO `orn` VECTOR, and that is not a
// migration — song.js validates the eight vectors it always did and carries
// anything else through the save untouched, kernel.js reads an absent vector
// as all-zero. So the vector is grown HERE, lazily, the first time this page
// looks at a phrase: no version bump, no rewrite of anybody's saved song, and
// a phrase nobody ever marks stays exactly the eight vectors it was.
const ensureOrn = (p, len) => {
  if (!Array.isArray(p.orn)) p.orn = new Array(len).fill(0);
  while (p.orn.length < len) p.orn.push(0);
  if (p.orn.length > len) p.orn.length = len;
  return p.orn;
};
// ONE CAPTION LEFT ON THE MACHINE, and it is not a header row: nine columns
// of bare numerals cannot name themselves ("deg" is not recoverable from a
// value), but the RANGE that used to ride under each name is gone — "don't
// bother with numbers and ranges" — and so is the corner's "st" and the
// binary columns' visible "on/off": nothing here prints a number or a word
// that is not a column's own three-letter name.
function buildHead() {
  const label = key2 => {
    const rl = document.createElement("div");
    rl.className = "rowlab"; rl.dataset.row = key2;
    rl.setAttribute("role", "columnheader");
    rl.textContent = key2;
    return rl;
  };
  gridEl.setAttribute("role", "grid");
  gridEl.setAttribute("aria-label", "phrase");
  const headRow = document.createElement("div");
  headRow.className = "prow"; headRow.setAttribute("role", "row");
  const corner = document.createElement("div");
  corner.className = "rowlab corner";
  corner.setAttribute("role", "columnheader");
  corner.setAttribute("aria-label", "step");     // the one place "step" still lives: read, not shown
  headRow.append(corner);
  for (const key2 of ROWS) headRow.append(label(key2));
  gridEl.append(headRow, gridPlay);
}
// THE ROWS, rebuilt only when the OPEN phrase's own length changed (opening
// a differently-sized phrase, or a resize) — the same "rare and structural"
// exception the tray's own [+] already made for the bank's size. `len` is
// read off the phrase itself; the loop is `i < len`, never `i < len - 1` — a
// generalized row count is exactly where that fencepost would cut the
// phrase's own LAST row out of reach.
function buildBody(len) {
  while (gridEl.children.length > 1) gridEl.removeChild(gridEl.lastChild);
  for (const key2 of ROWS) cells[key2] = [];
  const beatEvery = Math.max(1, len / 4);        // four groups, whatever the length
  for (let i = 0; i < len; i++) {
    // the beat ruling and the zebra shading are both CLASSES, not :nth-child
    // rules — every `beatEvery`th row heads a quarter and rules across it,
    // every other row shades a touch darker (kernel-daw.css .prow.alt), the
    // one legibility aid this table keeps now the depth is gone
    const beat = i % beatEvery === 0;
    const r = document.createElement("div");
    r.className = "prow" + (beat ? " beat" : "") + (i % 2 ? " alt" : "");
    r.setAttribute("role", "row");
    r.dataset.step = String(i + 1);
    const q = Math.min(4, 1 + Math.floor(i / beatEvery));
    // .tnum is the shared numeral column — the step here, the section number
    // in the song: one material for "which row is this"
    const n = document.createElement("div");
    n.className = "num tnum" + (beat ? " q" : "");
    n.textContent = String(i + 1);
    n.dataset.q = String(q);                 // the row's quarter lamp (CSS reads it)
    n.setAttribute("role", "rowheader");
    r.append(n);
    for (const key2 of ROWS) {
      const b = document.createElement("button"); b.type = "button";
      // the skin reads these, the code never does: which COLUMN a cell sits in
      // and which quarter of the phrase — the level ramp lives entirely in
      // CSS off these two attributes.
      b.dataset.row = key2; b.dataset.q = String(q);
      b.setAttribute("role", "gridcell");  // still a <button>: Enter/Space work
      const num = RANGE[key2];
      // TWO WAYS INTO A VALUE, both of them one-handed on a phone:
      //   drag   up/down on the cell scrubs it (pointer events, so touch too)
      //   tap    opens the pop-up fader beside the cell (ui/popfader.js) —
      //          a tap SHOWS the value instead of moving it a remembered
      //          direction.
      // The binary rows are unaffected: a toggle has nowhere to go but the
      // other way, so a tap has always been enough there.
      let bar = null, cv = null;
      if (num) {
        // THE BAR IS THE VALUE. .cbar (not .bar — that class is the transport
        // panel) is an absolute strip whose --b/--h the patch writes; .cv is
        // the small numeral that rides it where the CSS finds room. The
        // aria-label stays the machine-readable truth.
        bar = Object.assign(document.createElement("i"), { className: "cbar" });
        cv = Object.assign(document.createElement("b"), { className: "cv" });
        bar.setAttribute("aria-hidden", "true");
        cv.setAttribute("aria-hidden", "true");
        b.append(bar, cv);
        let from = null, fromX = 0, base = 0, moved = false, wasFine = false;
        b.addEventListener("pointerdown", ev => {
          from = ev.clientY; fromX = ev.clientX;
          base = SUBJ[key2][i]; moved = false; wasFine = false;
          try { b.setPointerCapture(ev.pointerId); } catch (e) {}
        });
        b.addEventListener("pointermove", ev => {
          if (from == null) return;
          // FINE MODE (hw.css verb #6): shift, a second finger down anywhere,
          // or walking the pointer >64px sideways — the Elektron "walk away
          // from the knob", and the one that needs no second hand. 70px per
          // step instead of 14. Crossing in or out REBASES the drag so the
          // value under the finger never jumps.
          const fine = ev.shiftKey || pointers() > 1 ||
            Math.abs(ev.clientX - fromX) > 64;
          if (fine !== wasFine) { wasFine = fine; from = ev.clientY; base = SUBJ[key2][i]; }
          const step = Math.round((from - ev.clientY) / (fine ? 70 : 14)); // up is more
          if (!step) return;
          const v = clampTo(base + step, num);
          if (v === SUBJ[key2][i]) return;
          moved = true; SUBJ[key2][i] = v;
          buzz(4);                            // a value landed (rate-limited)
          commit("phrase");
        });
        const end = () => { from = null; };
        b.addEventListener("pointerup", end);
        b.addEventListener("pointercancel", end);
        b.addEventListener("click", () => {
          if (moved) { moved = false; return; }              // that was a scrub
          openFader({
            anchor: b,
            label: key2 + " · step " + (i + 1),
            min: num[0], max: num[1],
            fmt: key2 === "vel" ? String : v => (v > 0 ? "+" + v : String(v)),
            get: () => SUBJ[key2][i],
            set: v => { SUBJ[key2][i] = clampTo(v, num); commit("phrase"); },
          });
        });
      } else if (key2 === "orn") {
        // the mark cycles — none, grace, flam, then the three rolls, and round
        b.addEventListener("click", () => {
          const v = ensureOrn(SUBJ, len);
          v[i] = (v[i] + 1) % MARKS.length;
          buzz(4);
          commit("phrase");
        });
      } else {
        b.addEventListener("click", () => {
          SUBJ[key2][i] = SUBJ[key2][i] ? 0 : 1;
          buzz(4);
          commit("phrase");
        });
      }
      cells[key2][i] = { b, bar, cv };
      r.append(b);
    }
    gridEl.append(r);
  }
  gridEl.append(gridPlay);                       // stays the grid's last child
  gridLen = len;
}
// ---------- THE DRUM GRID ----------
// Lanes down the rows, sixteen steps across — a step sequencer's own
// orientation, transposed from the tracker's (steps down, vectors across)
// because the two things being arranged are different shapes: one line's
// nine facts per step, versus seven lanes' one fact per step. Built ONCE —
// a drum pattern is always sixteen steps, so there is no resize case to
// rebuild for the way the melodic grid has.
const dcells = {};                          // lane -> [16 buttons]
function buildDrumGrid() {
  drumGridEl.setAttribute("role", "grid");
  drumGridEl.setAttribute("aria-label", "drum pattern");
  const head2 = document.createElement("div");
  head2.className = "drow"; head2.setAttribute("role", "row");
  const corner = document.createElement("div");
  corner.className = "rowlab corner"; corner.setAttribute("role", "columnheader");
  corner.setAttribute("aria-label", "step");
  head2.append(corner);
  for (let i = 0; i < 16; i++) {
    const n = document.createElement("div");
    // NOT .tnum — that class sticks a cell to the left edge, right for the
    // melodic grid's row-numeral COLUMN, wrong for this grid's numeral ROW.
    n.className = "num dhead" + (i % 4 === 0 ? " q" : "");
    n.textContent = String(i + 1);
    n.dataset.q = String(1 + Math.floor(i / 4));
    n.setAttribute("role", "columnheader");
    head2.append(n);
  }
  drumGridEl.append(head2);
  for (const [d, name] of DLANES) {
    const row = document.createElement("div");
    row.className = "drow"; row.setAttribute("role", "row");
    const lab = document.createElement("div");
    lab.className = "rowlab"; lab.textContent = name;
    lab.setAttribute("role", "rowheader");
    row.append(lab);
    dcells[d] = [];
    for (let i = 0; i < 16; i++) {
      const b = document.createElement("button"); b.type = "button";
      b.className = "cell mark"; b.dataset.lane = d; b.dataset.q = String(1 + Math.floor(i / 4));
      b.setAttribute("role", "gridcell");
      // ONE TAP CYCLES THE MARK — the same interaction as the melodic `orn`
      // column, for the same reason: a small enum has nowhere for a drag to
      // go, and a tap already shows the value the way it always has here.
      b.addEventListener("click", () => {
        const v = SUBJ[d];
        v[i] = (v[i] + 1) % DMARKS.length;
        buzz(4);
        commit("phrase");
      });
      dcells[d][i] = b;
      row.append(b);
    }
    drumGridEl.append(row);
  }
}
function patchDrumGrid() {
  for (const [d] of DLANES) {
    for (let i = 0; i < 16; i++) {
      const b = dcells[d][i], raw = SUBJ[d] ? SUBJ[d][i] : 0;
      const m = raw > 0 && raw < DMARKS.length ? raw : 0;
      if (b.textContent !== DMARKS[m]) b.textContent = DMARKS[m];
      const t = name2(d) + " · step " + (i + 1) + " · " + DMARKNAME[m];
      if (b.title !== t) b.title = t;
      const cls = "cell mark" + (m ? " on" : "") +
        (m === 2 ? " accent" : m === 3 ? " ghost" : "");
      if (b.className !== cls) b.className = cls;
      if (b.getAttribute("aria-label") !== t) b.setAttribute("aria-label", t);
    }
  }
}
const name2 = d => (DLANES.find(([l]) => l === d) || ["", d])[1];
swingBtn.addEventListener("click", () => {
  SUBJ.swing = ((SUBJ.swing || 0) + 1) % DSWING.length;
  buzz(4);
  commit("phrase");
});

function patchGrid() {
  const isDrum = SUBJ.kind === "drum";
  gridEl.hidden = isDrum;
  drumGridEl.hidden = !isDrum;
  swingBtn.hidden = !isDrum;
  if (isDrum) {
    shrinkBtn.hidden = true; growBtn.hidden = true;
    edslotEl.textContent = "pattern " + (slot + 1);
    swingBtn.title = "cycle this pattern's shuffle (" + DSWING[SUBJ.swing || 0] + ")";
    patchDrumGrid();
    return;
  }
  const len = SUBJ.gate.length;
  ensureOrn(SUBJ, len);                          // before anything reads the column
  if (gridLen !== len) buildBody(len);
  edslotEl.textContent = "phrase " + (slot + 1);
  shrinkBtn.hidden = len <= 16;
  growBtn.hidden = len >= NuSong.PHRASE_MAX;
  // a scrub commits per pointermove and this patches every cell each time;
  // writing only what CHANGED keeps the style recalc to the one cell under
  // the finger instead of the whole grid (an unchanged className write still
  // invalidates the element)
  const put = (b, cls, al) => {
    if (b.className !== cls) b.className = cls;
    if (b.getAttribute("aria-label") !== al) b.setAttribute("aria-label", al);
  };
  for (const key2 of ROWS) {
    const num = RANGE[key2];
    for (let i = 0; i < len; i++) {
      const c = cells[key2][i], val = SUBJ[key2][i];
      if (num) {
        // the bar's geometry, as two custom properties the CSS positions by:
        // vel fills from the floor; the bipolar four fill from the midline,
        // up for +, down for −. Height 0 at zero — the midline hairline is
        // what says "zero", not an invisible sliver.
        let b0, h0;
        if (key2 === "vel") { h0 = val / num[1] * 100; b0 = 0; }
        else { h0 = Math.abs(val) / num[1] * 50; b0 = val >= 0 ? 50 : 50 - h0; }
        const bs = b0.toFixed(1) + "%", hs = h0.toFixed(1) + "%";
        if (c.b.style.getPropertyValue("--b") !== bs) c.b.style.setProperty("--b", bs);
        if (c.b.style.getPropertyValue("--h") !== hs) c.b.style.setProperty("--h", hs);
        const txt = key2 === "vel" ? String(val) : (val > 0 ? "+" + val : String(val));
        if (c.cv.textContent !== txt) c.cv.textContent = txt;
        put(c.b,
          "cell deg" + (key2 === "vel" ? "" : " bip") +
            (SUBJ.gate[i] ? "" : " rest") + (val === 0 ? " zero" : ""),
          "step " + (i + 1) + " " + key2 + " " + val);
      } else if (key2 === "orn") {
        // the mark itself is the whole cell: glyph, tooltip, aria. `m` is
        // clamped because a save from a build that knows more marks than this
        // one must draw as "no mark" rather than as undefined.
        const m = val > 0 && val < MARKS.length ? val : 0;
        if (c.b.textContent !== MARKS[m]) c.b.textContent = MARKS[m];
        const t = "step " + (i + 1) + " · " + MARKNAME[m];
        if (c.b.title !== t) c.b.title = t;
        put(c.b, "cell mark" + (m ? " on" : ""), t);
      } else {
        if (c.b.textContent !== (val ? "●" : "")) c.b.textContent = val ? "●" : "";
        put(c.b,
          "cell" + (val ? " on" : ""),
          "step " + (i + 1) + " " + key2 + (val ? " on" : " off"));
      }
    }
  }
}
// GROW/SHRINK: doubling and halving keep every existing step where it is — a
// resize is never a reflow of the music, only more or less of it. New steps
// land silent (gate 0) at a genre-true velocity of 5, matching blank()'s own
// default, so a grown phrase does not need its new half re-tuned before it
// is usable.
function resizePhrase(mult) {
  const cur = SUBJ.gate.length;
  const next = Math.max(16, Math.min(NuSong.PHRASE_MAX, Math.round(cur * mult)));
  if (next === cur) return;
  const grow = next > cur;
  ensureOrn(SUBJ, cur);                          // the marks resize with the rest
  for (const key2 of ROWS) {
    const v = SUBJ[key2];
    SUBJ[key2] = grow
      ? v.concat(new Array(next - cur).fill(key2 === "vel" ? 5 : 0))
      : v.slice(0, next);
  }
  buzz(4);
  commit("phrase");
}
shrinkBtn.addEventListener("click", () => resizePhrase(0.5));
growBtn.addEventListener("click", () => resizePhrase(2));

/* ---------- the phrase THUMBNAIL ---------- */
// THE ONE DRAWING OF A PHRASE, exported: A MINIATURE OF THE GRID ABOVE — not
// a bar chart ("make the pattern previews tiny versions of the pattern grid,
// not bar charts", Paul, 2026-08-16). The velocity bar chart it replaces was
// a summary of the phrase; this is the phrase, at 1:8. A preview now looks
// like the thing you tap it to edit, which is the whole point of a preview.
//
// THE REDUCTION, and it is a reduction on purpose — eight vectors in 24 user
// units would be three-pixel lanes. The tracker's own column order runs down
// the miniature (gate, acc, sld, then pitch), and the steps run ACROSS,
// because a thumbnail is twice as wide as it is tall and the step axis is
// the long one. TIME LEFT-TO-RIGHT, PITCH BOTTOM-TO-TOP, always — the one
// orientation this drawing has ever used, in the editor's tray and on the
// Arrange row's chips alike, so "the phrase icons are rotated 90 degrees"
// has nowhere left to hide:
//   GATE   a full-width block in its lane: the rhythm, read as a row of teeth
//   ACC    a narrower block, centred in the step: an accent is a gate with
//          emphasis, so it is the same mark, smaller
//   SLD    a TIE running from this step into the next, which is what a slide
//          IS — and it wraps at the last step because the phrase loops
//   PITCH  a mini piano roll over deg + 7·oct, clamped to ±10 (deg alone is
//          ±7, so the clamp only bites on a phrase that octave-jumps), one
//          block per gated step at the height its note sits — SMALLER y is
//          HIGHER pitch, the same up-is-higher the tracker's own bars use
// deg/vel/inc/stk are not drawn: velocity was the OLD picture and it told
// phrases apart worst of all — two phrases with the same rhythm and different
// tunes drew identically.
//
// THE GRID ITSELF IS CSS, not path data (.bcmini/.mini in kernel-daw.css): a
// column ruling with the beat lines stronger and one rule under the switch
// lanes, painted as a static background-image. So an EMPTY phrase still draws
// as an empty grid rather than as a blank key, and the repaint contract is
// untouched — ONE <path d> string per thumbnail, one attribute write per
// patch, which is what makes an editor scrub cheap (ui/songrow.js
// patchChipPaths). Drawn by the Compose tray pads here AND the Arrange rows'
// phrase thumbnails: one routine is the only way the pad and the thumbnail
// can agree about what a phrase looks like — including at a length other
// than sixteen, since a phrase is 1..128 steps now: the geometry is read off
// the phrase's OWN length (p.gate.length) rather than assuming, so the same
// 64×24 viewBox holds a sixteen-step phrase's wide teeth or a 128-step one's
// fine ones without a caller ever knowing the difference.
const STEP_CELL = 0.8;                     // the mark is 4/5 of its step, .8 of air after
// lane tops and heights, in the 64×24 viewBox — the CSS grid's horizontal
// rule sits at 43%, i.e. between the sld lane and the pitch band
const L_GATE = [0.5, 3.2], L_ACC = [4.5, 2.4], L_SLD = [7.7, 2.0];
const BAND_TOP = 11, BAND_H = 12.4, NOTE_H = 2, PITCH_SPAN = 10;
const box = (x, y, w, h) =>
  "M" + x.toFixed(1) + " " + y.toFixed(1) + "h" + w.toFixed(1) +
  "v" + h.toFixed(1) + "h" + (-w).toFixed(1) + "Z";
export function thumbPath(p) {
  const len = p.gate.length, stepW = 64 / len, cellW = stepW * STEP_CELL;
  let d = "";
  for (let i = 0; i < len; i++) {
    const x = i * stepW + (stepW - cellW) / 2;
    if (p.gate[i]) {
      d += box(x, L_GATE[0], cellW, L_GATE[1]);
      // the note, where it sits: up is higher, the way the deg column's bar is
      const v = Math.max(-PITCH_SPAN, Math.min(PITCH_SPAN,
        p.deg[i] + 7 * p.oct[i]));
      const t = (v + PITCH_SPAN) / (2 * PITCH_SPAN);
      d += box(x, BAND_TOP + (1 - t) * (BAND_H - NOTE_H), cellW, NOTE_H);
    }
    if (p.acc[i]) d += box(x + cellW / 4, L_ACC[0], cellW / 2, L_ACC[1]);
    // a slide REACHES: it is drawn as the tie it is, clipped at the right edge
    if (p.sld[i]) {
      const sx = x + cellW / 2;
      d += box(sx, L_SLD[0], Math.min(stepW, 64 - sx), L_SLD[1]);
    }
  }
  return d;
}
// A DRUM PATTERN'S OWN PICTURE — seven lane rows of hit dots, the same
// 64×24 viewBox as thumbPath so a pad never resizes swapping between kinds.
// It reads nothing like the melodic drawing (teeth, a piano-roll band) ON
// PURPOSE: "drawn differently... a distinct outline and a drum glyph, not a
// colour alone" (the model Paul approved) — the shape itself is the tell,
// the outline (kernel-daw.css .slot.drum) and the corner glyph are the rest.
export function thumbPathDrum(p) {
  const rows = DLANES.length, rowH = 24 / rows, cellW = 64 / 16;
  let d = "";
  DLANES.forEach(([lane], r) => {
    const y = r * rowH + rowH * 0.16, h = rowH * 0.68, vec = p[lane] || [];
    for (let i = 0; i < 16; i++)
      if (vec[i]) d += box(i * cellW + cellW * 0.12, y, cellW * 0.76, h);
  });
  return d;
}

/* ---------- the TRAY: a horizontal strip of phrases ---------- */
// the picture is ONE <svg><path> per pad, not sixteen <i> bars — one node per
// pad on the strip instead of sixteen, one attribute write per patch instead
// of 32 style writes, and the picture survives the pad's flat material.
//
// EACH PAD IS A GROUP NOW, not a single button: `.slot` is the flex item
// (positions the two corner icons), `.slotbody` is the actual button (select
// + toggle into the focused layer — everything the whole pad used to do), and
// a small `.slotico` cluster overlays its top-right corner with a clone icon
// and an x. The overlay sits OUTSIDE the body's own hit area, so a plain
// centre tap/click still lands on .slotbody exactly as it always has — the
// body fills the pad, the icons are a small claim on one corner of it.
//
// THE BANK IS VARIABLE (1..NSLOTS, fields.js): the tray shows the phrases the
// SONG has, then [+] to grow it (a clone or the [+] both can reach the cap).
// The tray is rebuilt whenever the bank's SIZE moves (patch() below compares
// lengths) — a size change is rare and structural, exactly the case the
// built-once law carves out, and every cell listener still binds once per
// build.
const SVGNS = "http://www.w3.org/2000/svg";
const slotEls = [];                        // { b, body, sn, line, ph }
// the one bank key that survives, built ONCE and re-appended after every
// tray rebuild: [+] grows the bank (to NSLOTS). Shrinking is now PER PHRASE
// (the x on each pad, deletePhrase below) rather than tail-only, so there is
// no more paired [−].
const addKey = (() => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "slotadd"; b.id = "slotadd"; b.textContent = "+";
  b.title = "add a phrase (up to " + NSLOTS + ")";
  b.setAttribute("aria-label", "add a phrase");
  b.addEventListener("click", () => {
    if (SLOTS.length >= NSLOTS) return;    // the key is hidden at the cap anyway
    SLOTS.push(blank());
    setSlot(SLOTS.length - 1);             // the new phrase opens in the editor
    commit("phrase"); commit("selection");
  });
  return b;
})();
// THE SECOND [+]. Creating a drum pattern is an explicit choice, not a menu
// on the plain one — a second, iconic key beside it (kernel-daw.css
// .slotadd-drum's own glyph carries the difference; the two keys otherwise
// behave identically, cap included).
const addDrumKey = (() => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "slotadd slotadd-drum ik-drum"; b.id = "slotadddrum";
  b.title = "add a drum pattern (up to " + NSLOTS + ")";
  b.setAttribute("aria-label", "add a drum pattern");
  b.addEventListener("click", () => {
    if (SLOTS.length >= NSLOTS) return;
    SLOTS.push(NuSong.blankDrum());
    setSlot(SLOTS.length - 1);
    commit("phrase"); commit("selection");
  });
  return b;
})();
// THE RED FLAG. `sec.silent` is the fact — a box every one of whose stack
// entries has an empty `slots` list, so nothing in it can play — set here on
// the SONG's own box objects (not drawn here: ui/songrow.js's row renderer
// owns painting a silent section red, the way it already owns every other
// row state). Recomputed on every delete (the only edit on this page that can
// empty a box's list) and on every song/box load, so a file that already had
// the gap shows it too.
function markSilence() {
  for (const sec of SONG)
    sec.silent = !!(sec.stack && sec.stack.length) &&
      sec.stack.every(e => !e || !e.slots || !e.slots.length);
}
// DELETE RENUMBERS. Slots are referenced BY INDEX from every stack entry in
// every box — the old tail-only rule existed only because a middle delete
// used to leave every later reference pointing at the wrong phrase. An x on
// every pad means a real middle delete now, so this walks the whole song: i
// itself drops out of an entry's list (that voice falls silent), anything
// past i steps down one to follow the phrase it actually names.
function deletePhrase(i) {
  if (SLOTS.length <= 1) return;             // the bank keeps its last phrase
  SLOTS.splice(i, 1);
  for (const sec of SONG) for (const e of sec.stack || []) {
    if (!e || !Array.isArray(e.slots)) continue;
    e.slots = e.slots.filter(x => x !== i).map(x => (x > i ? x - 1 : x));
  }
  if (slot === i) setSlot(Math.min(i, SLOTS.length - 1));
  else if (slot > i) setSlot(slot - 1);
  markSilence();
  commit("phrase"); commit("box"); commit("selection");
}
// CLONE LANDS AT THE END. A copy is a new, independent phrase — editing it
// never touches the one it came from — so it is pushed like any other new
// phrase and opens immediately, the same as [+].
function clonePhrase(i) {
  if (SLOTS.length >= NSLOTS) return;        // the bank is full
  SLOTS.push(structuredClone(SLOTS[i]));
  setSlot(SLOTS.length - 1);
  commit("phrase"); commit("selection");
}
function buildSlots() {
  slotEls.length = 0;
  slotsEl.textContent = "";                // the [+] key survives: appended below
  SLOTS.forEach((p, i) => {
    const s = document.createElement("div");
    s.className = "slot";
    const body = document.createElement("button");
    body.type = "button"; body.className = "slotbody";
    const sn = document.createElement("span"); sn.className = "sn";
    const mini = document.createElementNS(SVGNS, "svg");
    mini.setAttribute("class", "mini");
    mini.setAttribute("viewBox", "0 0 64 24");
    mini.setAttribute("preserveAspectRatio", "none");
    mini.setAttribute("aria-hidden", "true");
    const line = document.createElementNS(SVGNS, "path");
    mini.append(line);
    const ph = document.createElement("i");    // the tray's own playhead, see below
    ph.className = "phth"; ph.setAttribute("aria-hidden", "true");
    body.append(sn, mini, ph);
    body.addEventListener("click", () => {
      setSlot(i);
      toggle("phrase", i);              // toggle() commits, which saves
      commit("selection");
    });
    const icos = document.createElement("span");
    icos.className = "slotico";
    const copyBtn = document.createElement("button");
    copyBtn.type = "button"; copyBtn.className = "ico ico-copy";
    copyBtn.title = "clone phrase " + (i + 1);
    copyBtn.setAttribute("aria-label", "clone phrase " + (i + 1));
    copyBtn.addEventListener("click", ev => { ev.stopPropagation(); clonePhrase(i); });
    const delBtn = document.createElement("button");
    delBtn.type = "button"; delBtn.className = "ico ico-x";
    delBtn.title = "delete phrase " + (i + 1);
    delBtn.setAttribute("aria-label", "delete phrase " + (i + 1));
    delBtn.addEventListener("click", ev => { ev.stopPropagation(); deletePhrase(i); });
    icos.append(copyBtn, delBtn);
    // THE DRUM BADGE. Always in the DOM (patch, not rebuild, toggles it —
    // the same law every other state here follows), a corner glyph opposite
    // the clone/delete cluster so a drum pattern reads as one even before its
    // picture is scanned — "a distinct outline and a drum glyph, not a
    // colour alone" (kernel-daw.css .slot.drum draws the outline).
    const badge = document.createElement("span");
    badge.className = "icobadge ik-drum"; badge.setAttribute("aria-hidden", "true");
    s.append(body, icos, badge);
    slotEls.push({ b: s, body, sn, line, badge, ph });
    slotsEl.append(s);
  });
  slotsEl.append(addKey, addDrumKey);
}
// the picture is thumbPath/thumbPathDrum above — the Arrange rows' phrase
// thumbnails draw the same ones, and one drawing routine per kind is the
// only way the pad and the thumbnail can agree about what a phrase looks
// like
function patchSlots() {
  const sec = curSection(), ent = focused(sec);
  addKey.hidden = SLOTS.length >= NSLOTS;  // full bank: the keys go, not grey
  addDrumKey.hidden = SLOTS.length >= NSLOTS;
  SLOTS.forEach((p, i) => {
    const s = slotEls[i], inBox = ent.slots.includes(i), isDrum = p.kind === "drum";
    // `live` is folded in here from the playhead's own record (liveSet,
    // below) rather than left for the rAF loop to add on top — this function
    // rewrites the WHOLE className on every phrase/box/selection event
    // (a scrub included), and a separate classList.toggle("live",...) from
    // the playhead loop would otherwise be stomped the next time either one
    // runs, flickering the sounding ring while a scrub and a play overlap.
    s.b.className = "slot" + (isDrum ? " drum" : "") + (i === slot ? " sel" : "") +
      (inBox ? " inbox" : "") + (liveSet.has(i) ? " live" : "");
    s.body.setAttribute("aria-pressed", String(inBox));
    s.body.setAttribute("aria-label",
      (isDrum ? "drum pattern " : "phrase ") + (i + 1) +
      (isBlankAny(p) ? ", empty" : ", filled") +
      (inBox ? ", in " + GENRES[ent.g].label : ""));
    s.b.setAttribute("aria-pressed", String(inBox));   // the old test-visible attribute, kept
    s.sn.textContent = (i + 1) + (isBlankAny(p) ? "" : " •");
    const d = isDrum ? thumbPathDrum(p) : thumbPath(p);
    if (s.line.getAttribute("d") !== d) s.line.setAttribute("d", d);
  });
}

/* ---------- the playhead: the transport's own clock, read, not run ------- */
// WHICH SLOTS ARE SOUNDING. A box's stack entries reference their phrases
// SIMULTANEOUSLY (derive.js sectionEvents hands each of an entry's `slots` a
// share of the genre's voices — never a per-bar rotation), so every index any
// entry of the PLAYING box names is sounding for that box's whole run. That is
// the set the tray lights.
function soundingSet(si) {
  const sec = SONG[si], out = new Set();
  if (!sec) return out;
  for (const e of sec.stack || []) for (const i of (e && e.slots) || []) out.add(i);
  return out;
}
let liveSet = new Set();                   // read by patchSlots above, written here
// the grid's own playhead position, across (header + len rows) as a percent
// of #stepgrid's total height — every row (header included) shares one
// height, so this is exact without measuring layout
const gridPct = f => (100 * (1 + f * SUBJ.gate.length) /
  (1 + SUBJ.gate.length)).toFixed(2) + "%";
function paintLive(on, f) {
  liveSet = on;
  slotEls.forEach((s, i) => {
    const lit = on.has(i);
    s.b.classList.toggle("live", lit);
    if (lit) s.ph.style.left = (f * 100).toFixed(1) + "%";
  });
  // the grid's own hairline is the melodic grid's alone — a drum pattern has
  // no phhead of its own yet, so an open, sounding drum pattern lights the
  // tray pad above (already handled in the forEach) and stops there
  const openLive = on.has(slot) && SUBJ.kind !== "drum";
  gridEl.classList.toggle("live", openLive);
  if (openLive) gridPlay.style.top = gridPct(f);
}
// STARTED/STOPPED WITH THE SAME GUARD main.js's OWN rAF loop uses (playing
// fires "transport:state" on every startAt(), including a mid-play restart,
// and two loops racing the same paint is the exact leak that guard exists to
// avoid) — reading getPosition()/passAt(), transport's own clock, never a
// second one. See this file's header for why this is its own loop rather
// than a call folded into main.js's.
let phRunning = false;
function playFrame() {
  if (!playing) { phRunning = false; paintLive(new Set(), 0); return; }
  const pos = getPosition();
  if (pos.si >= 0 && SONG[pos.si]) paintLive(soundingSet(pos.si), passAt(pos.now).f);
  else paintLive(new Set(), 0);
  requestAnimationFrame(playFrame);
}
on("transport:state", d => { if (d.playing && !phRunning) { phRunning = true; requestAnimationFrame(playFrame); } });

/* ---------- the header buttons ---------- */
// RANDOM AND CLEAR ACT AT THE PHRASE'S OWN LENGTH — a grown, 64-step phrase
// stays 64 steps after either one, silenced or reshuffled in place, never
// quietly snapped back to sixteen. SEED is the one exception on purpose: it
// writes the CANONICAL starter (genres.js DEFAULT, sixteen steps), which is
// a wholesale replacement by definition, length included.
function randomPhrase(len) {
  const r = n => Math.floor(Math.random() * n), p = blank(len);
  for (let i = 0; i < len; i++) {
    p.deg[i] = r(11) - 3;
    p.oct[i] = r(8) === 0 ? -1 : r(5) === 0 ? 1 : 0;
    p.gate[i] = r(10) < 7 ? 1 : 0;
    p.acc[i] = p.gate[i] && r(10) < 3 ? 1 : 0;
    p.sld[i] = p.gate[i] && r(10) < 2 ? 1 : 0;
    p.vel[i] = p.acc[i] ? 8 + r(2) : 3 + r(5);
    p.inc[i] = r(12) === 0 ? (r(2) ? 1 : -1) : 0;   // a ramp on the odd step, not everywhere
  }
  return p;
}
// THE SAME THREE KEYS, KIND-AWARE. A drum pattern has no deg/gate for
// randomPhrase/blank to fill, so each key reads SUBJ.kind and reaches for
// the drum-shaped equivalent instead — the starter below is a four-on-the-
// floor kick and a backbeat snare under straight hats, the closest thing
// this machine has to a canonical drum pattern the way DEFAULT is a
// canonical phrase.
function defaultDrum() {
  const p = NuSong.blankDrum();
  p.k = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
  p.s = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
  p.h = new Array(16).fill(1);
  return p;
}
function randomDrum() {
  const r = n => Math.floor(Math.random() * n), p = NuSong.blankDrum();
  const odds = { k: 3, s: 3, h: 6, o: 1, c: 1, p: 1, t: 1 };
  for (const [d] of DLANES) for (let i = 0; i < 16; i++)
    if (r(10) < odds[d]) p[d][i] = r(6) === 0 ? 2 : 1;   // mostly hits, some accents
  return p;
}
const put = make => () => { putPhrase(slot, make()); commit("phrase"); };
seedBtn.addEventListener("click", put(() =>
  SUBJ.kind === "drum" ? defaultDrum() : structuredClone(DEFAULT)));
rndBtn.addEventListener("click", put(() =>
  SUBJ.kind === "drum" ? randomDrum() : randomPhrase(SUBJ.gate.length)));
clearBtn.addEventListener("click", put(() =>
  SUBJ.kind === "drum" ? NuSong.blankDrum() : blank(SUBJ.gate.length)));
// (hintKey — the exported (?) wiring, one round key toggling one paragraph,
// used four times across the app — is GONE with the paragraphs it opened
// ("get rid of ... help buttons", 2026-08-16). Nothing imports it any more;
// if a surface needs explaining, that is a note about the surface.)

/* ---------- navigation ---------- */
// ONE way in: openPhraseEditor — from a song row's PHRASE thumbnails, and
// from the trailing [+] that grows the tray into the box (ui/songrow.js).
// Takes a slot index or { slot }; with neither it opens on the current slot.
// It is a NAVIGATION now, not an open: load the phrase, switch the deck to
// the Compose page (one attribute — on a desk the rail is invisible and the
// attribute paints nothing), and scroll the panel into view so the tracker
// starts where the eye lands. There is nothing to close: Compose is a place,
// and the rail (or a tap back on Arrange's stacked panel) is the way out.
export function openPhraseEditor(opts) {
  const si = typeof opts === "number" ? opts
    : opts && opts.slot != null ? opts.slot : null;
  if (si != null && SLOTS[si]) setSlot(si);
  setPage("compose");
  commit("selection");                     // the slot may have moved; every rail
                                           // (this one included) repaints off it
  // #composewrap, not the section: the .page is display:contents on a desk
  // and a contents box has no rect to scroll to
  try { wrap.scrollIntoView({ block: "start" }); } catch (e) {}
  buzz(4);
}

/* ---------- wiring ---------- */
buildHead();
// the initial OPEN phrase may itself be a drum pattern (a loaded song can
// open on one) — buildBody always runs once at a safe length; patchGrid's
// own kind check, right below, is what actually decides which grid shows
buildBody(SUBJ.kind === "drum" ? 16 : SUBJ.gate.length);
buildDrumGrid();
buildSlots();
markSilence();
// refreshFader: an open fader shows a live value, and a song load or a second
// finger scrubbing the same cell must move its LCD too. The tray is REBUILT
// first whenever the bank's size moved (add/clone/delete/load) — the grid
// rebuilds on its own, inside patchGrid, whenever the OPEN phrase's length
// moved — the only two structural changes the phrase surface has.
function patch() {
  if (slotEls.length !== SLOTS.length) buildSlots();
  markSilence();
  patchGrid(); patchSlots(); refreshFader();
}
for (const t of ["song", "phrase", "box", "selection"]) on(t, patch);
