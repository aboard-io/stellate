// nukernel/ui/wordgrid.js — THE WORD GRID, AND IT IS AN INSTITUTION.
//
// Paul, 2026-09-02, after using the composer: *"When we go into structure make
// those tables of dropdowns full of tappable grids that change options rather
// than dropdowns — like the other selection table in mix. This is a powerful
// element for editing a whole song — think on it and institutionalize it."*
//
// WHAT IT IS. Sections run DOWN. Members — or questions — run ACROSS. Every
// cell is a BUTTON printing the word that is true there, dim when the record
// derived it and bright when a hand set it. Tap a cell and the row it is in
// GROWS: one `<tr class="nu-wopen">` slides in directly underneath, holding a
// wrapped strip of every word that cell could say, the current one pressed and
// the refused ones grey with their reason on them. Tap a word and it is set,
// the strip folds, the cell repaints. Tap the open cell again and it folds.
// Escape folds it. One strip is open at a time, in the whole grid.
//
// WHY A COMPONENT AND NOT FOUR TABLES. Four surfaces were drawing this shape
// and only one of them was drawing it well:
//   · Mix's section automation — the trim grid, which is the surface Paul is
//     pointing AT ("like the other selection table in mix"): word buttons, dim
//     for derived, sections down, players across, the sounding row in red;
//   · Structure's five grids — the same table with `<select>`s in the cells;
//   · the Tempo panel's pace strip — one column of the same question;
//   · a band member's per-section strip — one column, one member.
// A component is what stops the good one and the three imitations from
// drifting: one keyboard model, one accordion, one refusal spelling, one
// sounding paint. Adding a fifth grid is now a `spec`, not a table.
//
// WHY AN ACCORDION AND NOT A POPUP. Two standing laws meet here and they agree.
// MENUS NEVER SCROLL INSIDE THEMSELVES (nu.css) — a floating list of twenty-one
// development words in a 224px column would be a scroller inside a scroller
// inside a pane. And the page's own flyout law says a strip may cover nothing
// it was opened from. An inline row covers nothing at all: the grid gets taller
// and the words stand under the cell they belong to, which is also the only
// arrangement in which you can still SEE the column you are editing.
//
// WHAT IT IS NOT. It is not an owner of any vocabulary. Every word, every
// refusal and every write comes through the `cell()` the caller hands over,
// which is `NuAvail.SHEETS[key]` get/set plus `optionsFor` — the same one owner
// the `<select>`s used. This file knows what a word LOOKS like and nothing
// about what any of them mean.
//
// NO IMPORTS. It builds DOM and calls back; `el` is four lines and copying
// four lines is cheaper than an import cycle between the two files that use it.

const el = (tag, text, cls) => { const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls; return n; };

/**
 * Draw one word grid into `host`.
 *
 * spec = {
 *   key,            // the `data-pane` key — the pane's scroll survives a redraw
 *   cap,            // the table's <caption>, its accessible name (one word)
 *   corner,         // the top-left <th>'s word (default "section")
 *   rows: [{ id, k?, word, sub?, num?, aria?, title?, act?, here? }],
 *   cols: [{ id, word, sub?, vi?, act?, title?, aria?, extra? }],
 *
 * `id` is the component's identity for a row or a column — what `paint()` is
 * told and what `cell()` is asked about. `k` is the ADDRESS, and it is separate
 * for the reason the whole page keeps them separate: an address does not move
 * when a row does, and four callers arrived here with four spellings already in
 * gates (`srow|<grid>|<id>`, `row|<secId>`, `col|<name>`, `scol|<grid>|<name>`).
 * A column's `id` IS its address, because every caller's already was.
 *   cell: (rowId, colId) => null | { key, value, label?, derived, options, set,
 *                                    say?, title?, why?, text?, cls? },
 *   live,           // "structrow" | "trimrow" — what the clock may write here
 * }
 * An option is `{ v, w, off?, why?, quiet? }` — `off` is REFUSED (avail.js's
 * `disabled`) and `quiet` is INERT (it would sound the same here). Both carry a
 * `why`; only the first is a refusal, and conflating them was a bug this file
 * shipped for an hour: an inert word greyed, and test/sheets.js counted eleven
 * refusals where the record has eight. A cell with `text` and no `options` is
 * a READOUT, not a control (the "one possible answer" case) and holds no
 * address. A cell with `why` is a refusal: it prints its word, carries the
 * reason, and does not open.
 *
 * ===== THE SHEET, 2026-09-04 (TABLE.md wave 2b) =========================
 * TABLE.md §6: *"a cell is a 44px tap target that opens ITS VECTOR AS A
 * SHEET: one cell-row per field in §1's order, each value tapped through its
 * vocabulary … inherited values quiet, written values bold, a clear-back on
 * every written row."* That is the SAME accordion this file already owns —
 * one `<tr>` inserted under the row you tapped, spanning the table, never a
 * popup and never scrolling inside itself — with a LIST OF FIELDS in it
 * instead of one strip of words. So it is a second BODY for the open row and
 * not a second component: a table with two accordions in it would be two
 * keyboard models, two refusal spellings and two ways to close, which is the
 * drift this file was extracted to stop.
 *
 * A cell, a row head or a column head may carry `sheet: () => [field]`, where
 * a field is one of:
 *   { key, label, word, derived, options, set, clear?, why?, note?, sub? }
 *       — a cell-row: the label, the word that is true, and a nested strip of
 *         the vocabulary when you tap it. `clear` is the clear-back (§2): it
 *         is drawn only where a hand has written, because a clear-back on an
 *         inherited row would be a button that does nothing.
 *   { kind: "ops", label?, ops: [{ k, word, act, why?, sub? }] }
 *       — a row of BUTTONS (§5's op grammar). An op with a `why` is refused
 *         the way every other refusal on this page is: greyed, `aria-disabled`,
 *         `data-why`, and the reason joined to its accessible name.
 *   { kind: "say", label, word, why? }
 *       — a READOUT. `why` is the refused-control law's reason (§4, "no silent
 *         grey"): a field the engine cannot yet reach says so on itself.
 *   { kind: "node", label?, node }
 *       — a caller-built element (a motif's preview, a chair's own knobs).
 * The sheet is asked for LAZILY, at the tap, because eighty cells' worth of
 * vocabulary built at draw time is eighty times the work of the one a thumb
 * opens.
 *
 * ===== THE FOOTER, same wave ===========================================
 * `foot: [{ id, word, sub?, k?, cells: [cell] }]` draws a `<tfoot>` — the
 * record's own rows under the section rows (TABLE.md §1: "The master is drawn
 * as the table's footer row"). A footer cell is the same record a body cell
 * is, sheet and all; what differs is that its row is not a section, so it
 * never lights and never carries a playhead cell.
 *
 * Returns { table, pane, rowHeads: Map, colHeads: Map, paint(rowId, colIds) }.
 */
export function wordGrid(host, spec) {
  const rows = spec.rows || [], cols = spec.cols || [];
  const rowHeads = new Map(), colHeads = new Map();
  const cellBtns = new Map();          // cell key -> the <button>
  const trOf = new Map();              // row id -> its <tr>
  let openKey = null, openTr = null, openBtn = null;

  const t = el("table", null, "nu-wordgrid nu-trims");
  /* AN ID ONLY WHERE ONE IS ALREADY AN ADDRESS. The board's grid has been
     `#trimgrid` since it was written and three gates reach it by that id; a
     component that renamed it would be moving an address. Every other caller
     passes none and gets none — an id is a promise to be unique in the
     document, and five grids on one panel could not keep it. */
  if (spec.id) t.id = spec.id;
  /* HOW MANY COLUMNS, AS A NUMBER THE STYLESHEET CAN DO ARITHMETIC ON. The
     grids are `table-layout: fixed` so the heads are EQUAL (the probe of
     2026-09-02 measured what they are without it: "column heads 145/195/105/
     113/119/88/88px wide so the meters are seven scales"), and a fixed table
     at 100% would then crush nine players into 20px each. CSS cannot count
     `<th>`s, so the count is handed over. It is a COUNT and not a width. */
  t.style.setProperty("--cols", String(cols.length));
  if (spec.live) t.dataset.live = spec.live;
  if (spec.cap) t.append(el("caption", spec.cap, "nu-rowlab"));

  const thead = el("thead"), hr = el("tr");
  hr.append(el("th", spec.corner == null ? "section" : spec.corner));
  for (const c of cols) {
    const th = el("th", null, "nu-colhead");
    /* THE ATTRIBUTE ON THE CELL, THE PAINT ON THE BUTTON — `.nu-vpaint`'s own
       contract in the one shape a table head allows. `[data-vi]` declares
       `--vpaint` for everything inside it; the plate has to be the BUTTON,
       because a `<button>` carries its own background from the page's global
       button rule and a colour on the `<th>` behind it would never be seen. */
    if (c.vi != null) th.dataset.vi = String(c.vi);
    const b = el("button", null, "nu-colbtn nu-vpaint");
    b.type = "button";
    b.dataset.k = c.id;
    b.append(el("b", c.word, "nu-colname"));
    if (c.sub) b.append(el("span", c.sub, "nu-colinstr"));
    b.setAttribute("aria-label", c.aria != null ? c.aria
      : c.word + (c.sub ? " — " + c.sub : ""));
    /* AND THE WHOLE NAME IS ONE HOVER AWAY. `.nu-colinstr` ellipsises inside
       its column; a `title` is the browser's own way to hand back what an
       ellipsis took, and it costs the text diet nothing because it is an
       attribute rather than a word on the page. */
    if (c.title) b.title = c.title;
    /* A COLUMN HEAD MAY OPEN A SHEET (2026-09-04) — TABLE.md §6's "header row
       = voices … tap -> the column sheet". A column has no row of its own, so
       its sheet opens as the FIRST row of the body: still one accordion, still
       a real `<tr>`, still nothing covered. `act` survives beside it for the
       four callers whose head is a jump and not a door. */
    if (c.sheet) {
      b.setAttribute("aria-expanded", "false");
      b.addEventListener("click", () => {
        if (openKey === "colsheet|" + c.id) { close(); return; }
        openSheet("colsheet|" + c.id, c.sheet(), c.aria || c.word, null, b);
      });
    } else if (c.act) b.addEventListener("click", c.act);
    th.append(b);
    /* THE EXTRA IS A SIBLING OF THE BUTTON, NEVER A CHILD OF IT. The board's
       column meter is the only user so far and it is a `[data-live]` well: a
       control INSIDE a surface the clock writes is the shape test/motif-frozen
       A1 forbids. The component reserves the seat and holds no opinion about
       what sits in it. */
    if (c.extra) th.append(c.extra);
    hr.append(th);
    colHeads.set(c.id, { th, btn: b });
  }
  thead.append(hr); t.append(thead);

  const tbody = el("tbody");

  /* ---- THE STRIP OF WORDS, WHICH IS THE WHOLE OF THE INSTITUTION -------
     ONE ROW, INSERTED, SPANNING THE TABLE. Not a `<div>` over the grid and not
     a cell that grows: a `<tr>` after the row you tapped, with one `<td>` that
     spans every column, so the table stays a table with the stylesheet off and
     a screen reader reads "the words for this cell" immediately after the cell
     that asked for them.
     IT NEVER SCROLLS INSIDE ITSELF. The chips WRAP; the row gets taller; the
     pane the grid stands in is the one scroller and it already is. */
  function close() {
    if (openTr && openTr.parentNode) openTr.parentNode.removeChild(openTr);
    /* THE BUTTON THAT OPENED IT, and since 2026-09-04 that is not always a
       CELL: a row head and a column head open sheets too, and neither is in
       `cellBtns`. `openBtn` is what actually opened the row; the `cellBtns`
       lookup stays as the fallback for the cells whose open predates it. */
    const b = openBtn || (openKey ? cellBtns.get(openKey) : null);
    if (b) b.setAttribute("aria-expanded", "false");
    openKey = null; openTr = null; openBtn = null;
  }

  /* THE STRIP ITSELF, LIFTED OUT OF `open` (2026-09-04). It was inline there
     because there was one caller; there are two now — a cell that opens ITS
     word list, and a SHEET field that opens its own inside the sheet — and the
     refusal spelling, the pressed state and the close-then-write order are the
     part of this file that must not be written twice. `after` is what the
     write is followed by: the grid's own repaint for a cell, the sheet's for a
     field. */
  function chipStrip(c, name, after) {
    const strip = el("div", null, "nu-wchips");
    strip.setAttribute("role", "group");
    strip.setAttribute("aria-label", c.say || name || "");
    const cur = c.value == null ? "" : String(c.value);
    for (const o of (c.options || [])) {
      const v = String(o.v);
      /* THE WORD IN ITS OWN SPAN, so a chip that also carries a provenance
         line reads as two things and not as one run-together string. MEASURED
         2026-09-04: `textContent` of a motif chip was "hookown", and the gate
         comparing the cell's word against the chip's picked the word it was
         already on. */
      const chip = el("button", null, "nu-wchip");
      chip.append(el("span", o.w == null ? v : String(o.w), "nu-chipword"));
      chip.type = "button";
      chip.dataset.k = c.key + "|" + v;
      chip.setAttribute("aria-pressed", String(v === cur));
      const cellWhy = c.why || null;
      if (cellWhy) {
        chip.disabled = true;
        chip.setAttribute("aria-disabled", "true");
        chip.dataset.why = cellWhy;
        chip.setAttribute("aria-label", (o.w == null ? v : o.w) + ", " + cellWhy);
        chip.title = cellWhy;
      } else if (o.off && v !== cur) {
        chip.disabled = true;
        chip.setAttribute("aria-disabled", "true");
        chip.dataset.why = o.why || "";
        chip.setAttribute("aria-label", (o.w == null ? v : o.w) +
          (o.why ? ", " + o.why : ""));
        if (o.why) chip.title = o.why;
      } else if (o.why) {
        chip.dataset.why = o.why;
        chip.title = o.why;
      }
      if (o.quiet) chip.classList.add("is-quiet");
      /* A CHIP MAY CARRY A PICTURE AND A PROVENANCE (2026-09-04, TABLE.md §3
         and §6: "the sheet's motifs row draws each candidate motif with its
         preview and its provenance; tapping a preview points the cell at it").
         Both are the CALLER's — ui/preview.js builds the svg and document.js
         `provWord` says own / guest: <genre> / hand — and both ride on the one
         control rather than beside it, because a second row of pictures under
         a row of words would be two controls for one fact. */
      if (o.pv) chip.prepend(o.pv);
      if (o.prov) {
        chip.append(el("small", o.prov, "nu-chipprov"));
        chip.setAttribute("aria-label",
          (chip.getAttribute("aria-label") || (o.w == null ? v : o.w)) + ", " + o.prov);
      }
      /* CLOSE, THEN WRITE. `set` almost always ends in the panel's own
         rebuild (`changed()` in ui/eight.js, `setDesk` on the board), which
         throws this whole table away — so a close AFTER the write would be a
         close of a node nobody is looking at, and the open row would come
         back on the next build. Closing first also means the two orders
         agree when a caller's `set` happens NOT to redraw. The ORDER is the
         caller's now, because a sheet's field closes only its own strip
         while a grid cell closes the whole open row. */
      chip.addEventListener("click", () => {
        if (chip.disabled) return;
        if (after) after(v, () => { try { c.set(v); } catch (e) {} });
        else { try { c.set(v); } catch (e) {} }
      });
      strip.append(chip, document.createTextNode(" "));
    }
    /* ---- ONE GROUP OPEN AT A TIME (2026-09-04) -------------------------
       TABLE.md §6, of the drummer's sixty-eight: *"the does-array sheet groups
       the ops by what they act on — kick, snare, hats, toms and fills,
       dynamics, feel — one group open at a time, the active ops pinned at the
       top."* Sixty-eight chips in one strip is a wall; six words and the eight
       under one of them is a sheet. The PIN is the standing answer, always
       drawn whichever group is open, because "you can always see the word you
       are on" is this page's oldest rule about a menu. */
    if (!c.groups || !c.groups.length) return strip;
    const box = el("div", null, "nu-wgroups");
    const bar = el("div", null, "nu-groupbar");
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "what it acts on");
    const cur2 = c.value == null ? "" : String(c.value);
    const pin = el("div", null, "nu-wchips nu-pinned");
    for (const ch of [...strip.children]) {
      const val = (ch.dataset && ch.dataset.k || "").split("|").pop();
      if (ch.tagName === "BUTTON" && (val === cur2 || val === "")) pin.append(ch);
    }
    box.append(bar, pin, strip);
    let openG = null;
    const showG = (name) => {
      openG = name;
      const want = new Set((c.groups.find((g) => g.word === name) || {}).vals || []);
      for (const ch of strip.children) {
        if (ch.tagName !== "BUTTON") continue;
        const val = (ch.dataset.k || "").split("|").pop();
        ch.hidden = !want.has(val);
      }
      for (const b of bar.children) b.setAttribute("aria-pressed", String(b.dataset.g === name));
    };
    for (const g of c.groups) {
      const gb = el("button", g.word, "nu-groupbtn");
      gb.type = "button";
      gb.dataset.g = g.word;
      gb.dataset.k = c.key + "|group|" + g.word;
      gb.setAttribute("aria-pressed", "false");
      gb.addEventListener("click", () => showG(openG === g.word ? null : g.word));
      bar.append(gb);
    }
    showG((c.groups.find((g) => g.vals.includes(cur2)) || c.groups[0]).word);
    return box;
  }

  /* ---- THE SHEET BODY (TABLE.md §6) ------------------------------------
     One cell-row per field, in the caller's order, which is §1's order. The
     WORD is a `.nu-wcell` — the same plate the grid's own cells wear, so
     "inherited quiet, written bold" is one rule and not two — and tapping it
     grows its strip UNDER ITS OWN ROW rather than at the foot of the sheet,
     which is the accordion's whole argument one level down. */
  function sheetBody(fields, name) {
    const box = el("div", null, "nu-vsheet");
    box.setAttribute("role", "group");
    if (name) box.setAttribute("aria-label", name);
    let openField = null, openStrip = null;
    const closeField = () => {
      if (openStrip && openStrip.parentNode)
        openStrip.parentNode.removeChild(openStrip);
      if (openField) openField.setAttribute("aria-expanded", "false");
      openField = null; openStrip = null;
    };
    for (const f of (fields || [])) {
      const line = el("div", null, "nu-sheetrow");
      if (f.kind === "ops") {
        line.classList.add("nu-sheetops");
        if (f.label) line.append(el("b", f.label, "nu-sheetlab"));
        const bar = el("div", null, "nu-opbar");
        for (const o of (f.ops || [])) {
          const b = el("button", o.word, "nu-opbtn");
          b.type = "button";
          b.dataset.k = o.k;
          b.setAttribute("aria-label", o.aria || o.word);
          if (o.why) {
            b.disabled = true;
            b.setAttribute("aria-disabled", "true");
            b.dataset.why = o.why;
            b.title = o.why;
            b.setAttribute("aria-label", (o.aria || o.word) + ", " + o.why);
          } else if (o.act) b.addEventListener("click", () => { try { o.act(); } catch (e) {} });
          bar.append(b);
        }
        line.append(bar);
        box.append(line);
        continue;
      }
      if (f.kind === "node") {
        /* A CALLER'S OWN WIDGET GETS THE WHOLE ROW, label above rather than
           beside. The one user is the voice's channel strip (ui/engineer.js
           `voiceMix`, seated in a column's sheet since 2026-09-04) and it is
           207px of inserts, sends, EQ, pan and a fader — beside an 11ch label
           at 390 that left it 128px and it overflowed, which nukernel/
           desk-gate.js measured within the hour ("panel 390 on voice|cantor:
           206 > 128"). A field with a widget in it is a BLOCK. */
        line.classList.add("nu-noderow");
        if (f.label) line.append(el("b", f.label, "nu-sheetlab"));
        if (f.node) line.append(f.node);
        box.append(line);
        continue;
      }
      line.append(el("b", f.label, "nu-sheetlab"));
      /* A FIELD MAY BRING ITS OWN CONTROL. Three vocabularies on this page are
         MENUS and not strips of words, and test/selects.js is the one owner of
         which — `cast.part`, `sound.instrument` and `sound.drumkit` are on
         Paul's own list of combo boxes (2026-09-02, *"one line instead of
         two"*), and an instrument list is a hundred and eight words, which is
         a page and not a strip. The caller builds the combo (ui/selects.js
         `selectEl`, the same widget at the same `data-sel` address) and this
         seats it in the same row, with the same label and the same
         clear-back, so a sheet reads as one list whichever widget a row
         holds. */
      if (f.node) {
        line.append(f.node);
        if (f.clear && !f.derived) {
          const cb2 = el("button", "clear", "nu-clearback");
          cb2.type = "button";
          cb2.dataset.k = "clear|" + f.key;
          cb2.setAttribute("aria-label", "clear " + f.label + " back to what it inherits");
          cb2.addEventListener("click", () => { try { f.clear(); } catch (e) {} });
          line.append(cb2);
        }
        box.append(line);
        continue;
      }
      if (f.kind === "say" || !f.options || !f.options.length) {
        /* A READOUT, AND A REFUSAL IS A READOUT WITH A REASON ON IT. §4's own
           law: the table draws a field the engine cannot yet reach GREYED WITH
           ITS REASON, never silently. */
        const s = el("span", f.word == null || f.word === "" ? "—" : String(f.word),
                     "nu-sheetsay" + (f.why ? " is-refused" : ""));
        if (f.why) { s.dataset.why = f.why; s.title = f.why;
                     s.setAttribute("aria-label", f.label + ": " + f.word + ", " + f.why); }
        line.append(s);
        if (f.sub) line.append(el("small", f.sub, "nu-sheetsub"));
        box.append(line);
        continue;
      }
      const b = el("button", f.word == null || f.word === "" ? "—" : String(f.word),
                   "nu-wcell nu-trimbtn" + (f.cls ? " " + f.cls : ""));
      b.type = "button";
      b.dataset.k = f.key;
      if (f.derived) b.classList.add("is-derived");
      b.setAttribute("aria-label", f.label + ": " +
        (f.word == null || f.word === "" ? "—" : f.word) +
        (f.derived ? ", inherited" : ", written here"));
      if (f.why) {
        b.dataset.why = f.why;
        b.setAttribute("aria-disabled", "true");
        b.classList.add("is-refused");
        b.title = f.why;
        b.setAttribute("aria-label", f.label + ": " + f.why);
      }
      b.setAttribute("aria-expanded", "false");
      b.addEventListener("click", () => {
        if (openField === b) { closeField(); return; }
        closeField();
        const strip = chipStrip(f, f.label, (v, write) => { closeField(); write(); });
        line.insertAdjacentElement("afterend", strip);
        openField = b; openStrip = strip;
        b.setAttribute("aria-expanded", "true");
        const first = strip.querySelector('button[aria-pressed="true"]')
                   || strip.querySelector("button:not([disabled])");
        if (first) first.focus();
      });
      line.append(b);
      /* THE CLEAR-BACK (§2), ON EVERY WRITTEN ROW AND ON NO OTHER. "Deleting a
         written value returns the cell to what it inherits" — so the control
         exists exactly where there is something to delete. */
      if (f.clear && !f.derived) {
        const cb = el("button", "clear", "nu-clearback");
        cb.type = "button";
        cb.dataset.k = "clear|" + f.key;
        cb.setAttribute("aria-label", "clear " + f.label + " back to what it inherits");
        cb.addEventListener("click", () => { try { f.clear(); } catch (e) {} });
        line.append(cb);
      }
      if (f.sub) line.append(el("small", f.sub, "nu-sheetsub"));
      box.append(line);
    }
    return box;
  }

  /* WHERE AN OPEN ROW GOES, said once for the three things that open one: a
     cell (under its own row), a row head (under its own row) and a column head
     (at the top of the body, because a column has no row of its own). */
  function insertOpen(body, afterTr, key, btn) {
    const tr = el("tr", null, "nu-wopen");
    const td = el("td");
    td.colSpan = cols.length + 1;
    td.append(body);
    tr.append(td);
    if (afterTr && afterTr.parentNode)
      afterTr.parentNode.insertBefore(tr, afterTr.nextSibling);
    else tbody.insertBefore(tr, tbody.firstChild);
    openKey = key; openTr = tr; openBtn = btn || null;
    if (btn) btn.setAttribute("aria-expanded", "true");
    return tr;
  }

  /* A SHEET OPENED FROM ANYWHERE — a cell, a row head, a column head. */
  function openSheet(key, fields, name, afterTr, btn) {
    close();
    const box = sheetBody(fields, name);
    insertOpen(box, afterTr, key, btn);
    const first = box.querySelector("button:not([disabled])");
    if (first) first.focus();
  }

  /* A CELL OPENS ONE OF TWO BODIES, and which one is the caller's word: a
     `sheet` is the whole VECTOR (TABLE.md §6) and everything else is the one
     question's strip of words. `tr` is handed in rather than looked up,
     because a footer row is a row this map has never heard of. */
  function openCell(tr, row, c, btn) {
    close();
    const body = c.sheet
      ? sheetBody(c.sheet(), c.say || c.key)
      : chipStrip(c, c.say || (btn.getAttribute("aria-label") || ""),
                  (v, write) => { close(); write(); paintCell(row.id, c); });
    insertOpen(body, tr || trOf.get(row.id), c.key, btn);
    const first = body.querySelector('button[aria-pressed="true"]')
               || body.querySelector("button:not([disabled])");
    if (first) first.focus();
  }

  function paintCell(rowId, c) {
    const b = cellBtns.get(c.key);
    if (!b) return;
    b.textContent = wordOf(c);
    b.classList.toggle("is-derived", !!c.derived);
  }

  /* DIM IS DERIVED, BRIGHT IS SET — the trim grid's own law, generalised. The
     WORD a derived cell prints is still the record's own word (the caller
     works that out; it is the one that knows what its sheet deals), and what
     the class says is that no hand has said it here. */
  const wordOf = (c) => (c.text != null ? String(c.text)
    : c.label != null ? String(c.label)
    : c.value == null || c.value === "" ? "—" : String(c.value));

  /* ---- ONE CELL, AND ONE PLACE THAT KNOWS WHAT A CELL IS (2026-09-04) ---
     Extracted from the row loop when the footer arrived: the master's seven
     words are cells in every sense the body's are — the same plate, the same
     dim-is-derived reading, the same refusal spelling, the same accordion —
     and a second copy of forty lines would have been the fifth imitation this
     file exists to have stopped. `row` is only needed to say WHERE the open
     row goes, so a footer row hands its own `<tr>` and its own id. */
  function mkCell(td, tr, row, c) {
    if (!c) { td.append(el("span", "\u2014")); return; }
    /* WHAT A CELL SAYS WHEN IT IS NOT A CONTROL — the two honest cases: a
       question with ONE possible answer, and a fact this panel does not own.
       Text, in the cell, so the grid keeps its shape and holds no address. */
    if (!c.key || (!c.options || !c.options.length) && !c.why && !c.sheet) {
      td.className = "nu-sgsay";
      td.append(el("span", wordOf(c)));
      return;
    }
    /* `.nu-trimbtn` IS ON EVERY CELL AND IT IS NOT A COPY. The board's trim
       grid is the surface Paul is pointing at, so its cell — the 44px word
       plate, the `w-*` colours, `is-derived`'s dim reading — IS the cell,
       and wearing its class is how that is said once instead of twice.
       `.nu-wcell` is what the accordion behaviour hangs off. `c.cls` is the
       caller's own word-colour (`w-hush`), which only the trim vocabulary
       has. */
    const b = el("button", wordOf(c), "nu-wcell nu-trimbtn" +
      (c.cls ? " " + c.cls : ""));
    b.type = "button";
    b.dataset.k = c.key;
    if (c.derived) b.classList.add("is-derived");
    b.setAttribute("aria-label", (c.say || c.key) + ": " + wordOf(c));
    if (c.title) b.title = c.title;
    /* A REFUSED CELL PRINTS ITS WORD, CARRIES ITS REASON, AND STILL SHOWS
       YOU THE SHAPE OF THE POSSIBLE.

       HIDING DESTROYS THE SHAPE OF THE POSSIBLE (avail.js's founding law:
       "The parent's answer to unavailability was the PRUNER, which DELETES
       the option. We grey it.") A `<select>` that is refused keeps its
       `<option>`s in the DOM — which is what test/sheets.js has always read
       back — but a person cannot open a disabled `<select>`, so the shape
       was in the markup and not on the screen. This is the first control on
       this page where the two agree: a refused cell OPENS, every word in the
       strip is grey, and the reason is on each of them. You can see exactly
       what you would be choosing between if the record allowed it.
       IT STILL CANNOT WRITE, which is what a refusal is. `aria-disabled`
       says so to a reader, `data-why` says why to a gate, the reason is
       joined to the accessible name, and every chip inside carries the
       refusal so no path through the strip reaches `set`.
       A REFUSAL WITH NO WORDS AT ALL IS A HARD `disabled` — the bass\'s
       `reads` cell, which is told rather than asked and has nothing to offer.
       A button that opened an empty strip would be a door onto a wall. */
    if (c.why) {
      b.dataset.why = c.why;
      b.setAttribute("aria-disabled", "true");
      b.classList.add("is-refused");
      b.setAttribute("aria-label", (c.say || c.key) + ": " + c.why);
      b.title = c.why;
      if ((!c.options || !c.options.length) && !c.sheet) b.disabled = true;
    }
    if (!b.disabled) {
      b.setAttribute("aria-expanded", "false");
      b.addEventListener("click", () => {
        if (openKey === c.key) { close(); return; }
        openCell(tr, row, c, b);
      });
    }
    cellBtns.set(c.key, b);
    td.append(b);
  }

  rows.forEach((row) => {
    const tr = el("tr");
    tr.dataset.row = String(row.id);
    if (row.here) tr.className = "nu-here";
    const th = el("th", null, "nu-srowh");
    const jb = el("button", null, "nu-rowjump");
    jb.type = "button";
    jb.dataset.k = row.k != null ? row.k : spec.key + "|row|" + row.id;
    /* THE NUMBER IS THE CLOCK'S AND NOTHING ELSE'S. `[data-live="count"]` is
       the declaration the frozen-page law reads: the playhead may write in
       here and may write nowhere else on this table. */
    let live = null;
    if (row.num != null) {
      live = el("span");
      live.dataset.live = "count";
      live.append(el("span", String(row.num)));
      jb.append(live);
    }
    jb.append(el("span", (row.num != null ? " " : "") + row.word, "nu-srowname"));
    jb.setAttribute("aria-label", row.aria != null ? row.aria
      : row.word + (row.sub ? ", " + row.sub : ""));
    if (row.title) jb.title = row.title;
    /* AND A ROW HEAD MAY OPEN ONE TOO — §6's "header column = sections … tap
       -> the row sheet". Same accordion, under the row it belongs to. */
    if (row.sheet) {
      jb.setAttribute("aria-expanded", "false");
      jb.addEventListener("click", () => {
        if (openKey === "rowsheet|" + row.id) { close(); return; }
        openSheet("rowsheet|" + row.id, row.sheet(), row.aria || row.word,
                  trOf.get(row.id), jb);
      });
    } else if (row.act) jb.addEventListener("click", row.act);
    th.append(jb);
    if (row.sub) th.append(el("small", " " + row.sub));
    tr.append(th);

    for (const c0 of cols) {
      const td = el("td");
      mkCell(td, tr, row, spec.cell(row.id, c0.id));
      tr.append(td);
    }
    tbody.append(tr);
    trOf.set(row.id, tr);
    rowHeads.set(row.id, { th, btn: jb, live });
  });
  t.append(tbody);

  /* ---- THE FOOTER: THE RECORD'S OWN ROWS (2026-09-04) -------------------
     TABLE.md §1: "The master is drawn as the table's footer row." A footer row
     is not a section — it has no ordinal, never lights, and carries no
     playhead cell — so it is built here rather than being a `rows` entry with
     three exceptions hung off it. Its CELLS are the same record a body cell
     is, and they go through the same `mkCell`, which is why a master word and
     a section word wear one plate and open one accordion.
     THE CELLS ARE THE ROW'S OWN, NOT THE COLUMNS'. A master row asks seven
     questions of the RECORD, and the record has no voices; so a footer row
     hands its own list and the last cell spans whatever is left, rather than
     pretending the columns overhead mean anything to it. */
  if (spec.foot && spec.foot.length) {
    const tf = el("tfoot");
    for (const fr of spec.foot) {
      const tr = el("tr", null, "nu-footrow");
      tr.dataset.row = String(fr.id);
      const th = el("th", null, "nu-srowh");
      const fb = el("button", null, "nu-rowjump");
      fb.type = "button";
      fb.dataset.k = fr.k != null ? fr.k : spec.key + "|foot|" + fr.id;
      fb.append(el("span", fr.word, "nu-srowname"));
      fb.setAttribute("aria-label", fr.aria != null ? fr.aria : fr.word);
      if (fr.sheet) {
        fb.setAttribute("aria-expanded", "false");
        fb.addEventListener("click", () => {
          if (openKey === "footsheet|" + fr.id) { close(); return; }
          openSheet("footsheet|" + fr.id, fr.sheet(), fr.aria || fr.word, tr, fb);
        });
      }
      th.append(fb);
      if (fr.sub) th.append(el("small", " " + fr.sub));
      tr.append(th);
      const list = fr.cells || [];
      list.forEach((c, i) => {
        const td = el("td");
        /* THE LAST CELL TAKES WHAT IS LEFT. Seven master words under nine
           players is not a coincidence to be honoured with empty `<td>`s. */
        if (i === list.length - 1 && list.length < cols.length)
          td.colSpan = cols.length - list.length + 1;
        mkCell(td, tr, { id: fr.id }, c);
        tr.append(td);
      });
      tf.append(tr);
    }
    t.append(tf);
  }

  /* ESCAPE FOLDS IT, and only Escape and the two taps do. Bound on the TABLE
     rather than on the document: a grid that closed on any Escape anywhere
     would be a second owner of a key the log, the seed strip and the hold
     explainer all already answer, and this one is scoped to the thing the
     thumb is inside. */
  t.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !openKey) return;
    const b = cellBtns.get(openKey);
    close();
    if (b) b.focus();
    e.stopPropagation();
  });

  /* THE PANE. `data-pane` is the keepPanes key (ui/eight.js): a grid's
     sideways scroll must survive the redraw a cell tap causes. */
  const pane = el("div", null, "nu-pane");
  pane.tabIndex = 0;
  pane.dataset.pane = spec.key;
  pane.append(t);
  host.append(pane);

  /* WHO IS SOUNDING, DRIVEN BY THE CALLER FROM ITS EXISTING "pos" PATH. This
     component installs no clock and subscribes to nothing — "a view never
     installs its own rAF/clock; it reads the position feed" — so lighting is a
     method somebody else calls with what the feed said. */
  let litRow = null, litCols = "";
  function paint(nowRowId, soundingColIds) {
    if (nowRowId !== litRow) {
      litRow = nowRowId;
      for (const [id, tr] of trOf) tr.classList.toggle("now", id === nowRowId);
    }
    const want = new Set(soundingColIds || []);
    const sig = [...want].sort().join(",");
    if (sig === litCols) return;
    litCols = sig;
    /* THE CLASS GOES ON THE `<th>` AND NOT ON THE BUTTON, which is where the
       board has always put it and what nu.css's own rule selects
       (`.nu-trims thead th.nu-colhead.is-sounding`): the lamp is an edge bar
       under the WHOLE head, and the button inside it is already wearing the
       player's own colour. */
    for (const [id, h] of colHeads)
      h.th.classList.toggle("is-sounding", want.has(id));
  }

  /* THE CORNER'S DOOR, for the one caller that has a corner worth opening
     (ui/table.js: the `<th>` above the row heads is the WHOLE RECORD). It is
     `openSheet` with no row to stand under, which is the column head's case —
     so the sheet lands as the body's first row and nothing is covered. */
  const openCorner = (fields, btn) => {
    if (openKey === "cornersheet") { close(); return; }
    openSheet("cornersheet", fields, btn && btn.getAttribute("aria-label"), null, btn);
  };
  return { table: t, pane, rowHeads, colHeads, paint, close, openCorner };
}
