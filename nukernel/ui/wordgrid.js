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
 * Returns { table, pane, rowHeads: Map, colHeads: Map, paint(rowId, colIds) }.
 */
export function wordGrid(host, spec) {
  const rows = spec.rows || [], cols = spec.cols || [];
  const rowHeads = new Map(), colHeads = new Map();
  const cellBtns = new Map();          // cell key -> the <button>
  const trOf = new Map();              // row id -> its <tr>
  let openKey = null, openTr = null;

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
    if (c.act) b.addEventListener("click", c.act);
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
    const b = openKey ? cellBtns.get(openKey) : null;
    if (b) b.setAttribute("aria-expanded", "false");
    openKey = null; openTr = null;
  }

  function open(row, c, btn) {
    close();
    const tr = el("tr", null, "nu-wopen");
    const td = el("td");
    td.colSpan = cols.length + 1;
    const strip = el("div", null, "nu-wchips");
    strip.setAttribute("role", "group");
    strip.setAttribute("aria-label", c.say || (btn.getAttribute("aria-label") || ""));
    const cur = c.value == null ? "" : String(c.value);
    for (const o of (c.options || [])) {
      const v = String(o.v);
      const chip = el("button", o.w == null ? v : String(o.w), "nu-wchip");
      chip.type = "button";
      chip.dataset.k = c.key + "|" + v;
      chip.setAttribute("aria-pressed", String(v === cur));
      /* EVERY REFUSAL CARRIES A MEASURED REASON, and it is spelled the way the
         gutter spells it (ui/glyph.js): `disabled` + `aria-disabled` +
         `data-why` + the reason JOINED to the accessible name. A grey word
         with a silent reason is the failure this box legislates against.
         A CELL-WIDE REFUSAL GREYS EVERY WORD IN THE STRIP, with the CELL's
         reason — the sheet itself is refused, so there is no path through
         these words that could reach `set`, and each of them says why. */
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
        // the standing answer is always offered — you can always see the word
        // you are on — and it keeps its sentence without becoming a refusal
        chip.dataset.why = o.why;
        chip.title = o.why;
      }
      if (o.quiet) chip.classList.add("is-quiet");
      chip.addEventListener("click", () => {
        if (chip.disabled) return;
        /* CLOSE, THEN WRITE. `set` almost always ends in the panel's own
           rebuild (`changed()` in ui/eight.js, `setDesk` on the board), which
           throws this whole table away — so a close AFTER the write would be a
           close of a node nobody is looking at, and the open row would come
           back on the next build. Closing first also means the two orders
           agree when a caller's `set` happens NOT to redraw. */
        close();
        try { c.set(v); } catch (e) {}
        paintCell(row.id, c);
      });
      strip.append(chip, document.createTextNode(" "));
    }
    td.append(strip);
    tr.append(td);
    const host2 = trOf.get(row.id);
    if (host2 && host2.parentNode)
      host2.parentNode.insertBefore(tr, host2.nextSibling);
    openKey = c.key; openTr = tr;
    btn.setAttribute("aria-expanded", "true");
    const first = strip.querySelector('button[aria-pressed="true"]')
               || strip.querySelector("button:not([disabled])");
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
    if (row.act) jb.addEventListener("click", row.act);
    th.append(jb);
    if (row.sub) th.append(el("small", " " + row.sub));
    tr.append(th);

    for (const c0 of cols) {
      const c = spec.cell(row.id, c0.id);
      const td = el("td");
      if (!c) { td.append(el("span", "—")); tr.append(td); continue; }
      /* WHAT A CELL SAYS WHEN IT IS NOT A CONTROL — the two honest cases: a
         question with ONE possible answer, and a fact this panel does not own.
         Text, in the cell, so the grid keeps its shape and holds no address. */
      if (!c.key || (!c.options || !c.options.length) && !c.why) {
        td.className = "nu-sgsay";
        td.append(el("span", wordOf(c)));
        tr.append(td);
        continue;
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
         A REFUSAL WITH NO WORDS AT ALL IS A HARD `disabled` — the bass's
         `reads` cell, which is told rather than asked and has nothing to offer.
         A button that opened an empty strip would be a door onto a wall. */
      if (c.why) {
        b.dataset.why = c.why;
        b.setAttribute("aria-disabled", "true");
        b.classList.add("is-refused");
        b.setAttribute("aria-label", (c.say || c.key) + ": " + c.why);
        b.title = c.why;
        if (!c.options || !c.options.length) b.disabled = true;
      }
      if (!b.disabled) {
        b.setAttribute("aria-expanded", "false");
        b.addEventListener("click", () => {
          if (openKey === c.key) { close(); return; }
          open(row, c, b);
        });
      }
      cellBtns.set(c.key, b);
      td.append(b);
      tr.append(td);
    }
    tbody.append(tr);
    trOf.set(row.id, tr);
    rowHeads.set(row.id, { th, btn: jb, live });
  });
  t.append(tbody);

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

  return { table: t, pane, rowHeads, colHeads, paint, close };
}
