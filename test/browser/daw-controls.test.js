#!/usr/bin/env node
// test/browser/daw-controls.test.js — THE CONTROL VOCABULARY at 390×844 touch.
//
// Pads, tiles, chips and (since 2026-08-11) TABLES are the whole answer to "not
// radar, not sliders" — so this gate drives them the way a thumb does and holds
// their contracts:
//
//   A pad drag       a real touch drag on a drum-op PAD: the fill follows the
//                    finger MID-GESTURE, the release commits to patch.kits,
//                    and the landed value is the drag's geometry (Δy / height)
//   B tile drag      RELATIVE drag — starting at the tile's edge does NOT jump
//                    the value there; Δy/240 lands on top of where it was —
//                    committed to patch.layers with the "yours" dot
//   C double-tap     two quick taps on the tile revert to stock: the patch
//                    entry drops, the dot clears, the value returns
//   D no sliders     zero input[type=range] on the whole page, sheet open
//   E thumb floor    every ENABLED pad/tile/chip/tab in an open sheet ≥44px
//                    (ladder/matrix cells are row-height targets by law —
//                    columns stay fractional and are not measured here)
//   F keyboard       pads and tiles are role=slider for real: focus + arrow
//                    keys move the value AND commit through the same edit path
//   G table          the primitive that killed the lozenge walls: 44px rows, a
//                    ROVING tabindex (exactly one row tabbable), arrows move the
//                    focus, Enter picks, the filter narrows the list and empties
//                    its group headers with it — and a pick commits THROUGH THE
//                    DOCUMENT (patch.secover), pops the picker, and is already
//                    showing in the table you came back to
//   H volume         the controller's volume: a RELATIVE sideways drag moves
//                    TRANSPORT.volume() by the drag's geometry, arrows/Home/End
//                    work, it persists — and it is still not a range input. The
//                    table's filter IS an <input>, and must be type="search":
//                    the no-slider law is about AMOUNTS, and a filter is a word.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let checks = 0;
const ok = (m) => { checks++; console.log("  ok:", m); };
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };

// a touch-type pointer sequence dispatched on the element — the controls.js
// listeners are pointer-events-only, so this is the real code path
const TOUCH_LIB = `
  window.__gateTouch = (el, pts) => {
    for (const [t, x, y] of pts)
      el.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: "touch",
        isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y }));
  };
`;

async function main() {
  const srv = await serve(ROOT, 8983);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`http://127.0.0.1:${srv.port}/daw.html?g=techno&seed=3`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__DAW && window.__DAW.grid && window.__DAW.grid.cols() > 0,
    null, { timeout: 20000 });
  await page.waitForTimeout(300);
  await page.evaluate(TOUCH_LIB);

  // ---- A: a real touch drag on a drum-op pad ----
  await page.evaluate(() => window.__DAW.sheet.open("drums"));
  await page.waitForTimeout(300);
  const padDrag = await page.evaluate(() => {
    const pad = [...document.querySelectorAll(".dw-sheetbody .dw-pad")]
      .find((p) => +p.getAttribute("aria-valuenow") > 0.2);
    if (!pad) return { err: "no on-pad in the drums sheet" };
    pad.scrollIntoView({ block: "center" });
    const r = pad.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const v0 = +pad.getAttribute("aria-valuenow");
    const H = pad.clientHeight || 56;
    const fill = pad.querySelector(".dw-padfill");
    const f0 = fill.style.height;
    window.__gateTouch(pad, [["pointerdown", cx, cy],
      ["pointermove", cx, cy + 8], ["pointermove", cx, cy + 16],
      ["pointermove", cx, cy + 24], ["pointermove", cx, cy + 30]]);
    const mid = { fill: fill.style.height, now: +pad.getAttribute("aria-valuenow") };
    window.__gateTouch(pad, [["pointerup", cx, cy + 30]]);
    const v1 = +pad.getAttribute("aria-valuenow");
    const want = Math.max(0, Math.min(1, v0 - 30 / H));
    return { v0, v1, want, f0, mid, f1: fill.style.height,
      label: pad.getAttribute("aria-label") };
  });
  if (padDrag.err) fail(padDrag.err);
  else {
    if (padDrag.mid.fill === padDrag.f0 || Math.abs(padDrag.mid.now - padDrag.v0) < 0.01)
      fail(`the fill did not follow the finger mid-drag (${padDrag.f0} → ${padDrag.mid.fill})`);
    else ok(`the pad fill follows the finger mid-gesture (${padDrag.f0} → ${padDrag.mid.fill})`);
    if (Math.abs(padDrag.v1 - padDrag.want) > 0.1)
      fail(`pad landed at ${padDrag.v1}, drag geometry says ${padDrag.want.toFixed(2)}`);
    else ok(`the drag set the probability: "${padDrag.label}" ${padDrag.v0.toFixed(2)} → ${padDrag.v1.toFixed(2)}`);
    if (padDrag.f1 !== Math.round(padDrag.v1 * 100) + "%")
      fail(`fill ${padDrag.f1} disagrees with value ${padDrag.v1}`);
    else ok("the fill height IS the probability");
  }
  await page.waitForTimeout(400);
  const kits = await page.evaluate(() => Object.keys(window.__DAW.SONG.patch.kits || {}));
  if (!kits.length) fail("the pad release committed nothing to patch.kits");
  else ok(`release committed through the kit machine (patch.kits: ${kits.join(",")})`);

  // ---- B: tile RELATIVE drag (melody sound tab's level tile) ----
  await page.evaluate(() => { window.__DAW.sheet.open("melody"); window.__DAW.sheet.tab("sound"); });
  await page.waitForTimeout(300);
  const tileDrag = await page.evaluate(() => {
    const tile = [...document.querySelectorAll(".dw-sheetbody .dw-tile")]
      .find((t) => t.querySelector(".dw-tilelab").textContent === "level");
    if (!tile) return { err: "no level tile on the melody sound tab" };
    tile.scrollIntoView({ block: "center" });
    const r = tile.getBoundingClientRect();
    const v0 = +tile.getAttribute("aria-valuenow");
    // start at the EDGE the value is far from: if a start-point jump existed,
    // the value would leap there; relative means Δy/240 lands on top of v0
    const down = v0 >= 0.5;                     // drag down from the top edge
    const sx = r.left + r.width / 2;
    const sy = down ? r.top + 6 : r.bottom - 6;
    const dy = down ? 60 : -60;                 // 60px = 0.25 of range
    const pts = [["pointerdown", sx, sy]];
    for (let k = 1; k <= 4; k++) pts.push(["pointermove", sx, sy + (dy * k) / 4]);
    pts.push(["pointerup", sx, sy + dy]);
    window.__gateTouch(tile, pts);
    const want = Math.max(0, Math.min(1, v0 + (down ? -0.25 : 0.25)));
    return { v0, want, down, edgeV: down ? 1 - 6 / r.height : 6 / r.height };
  });
  if (tileDrag.err) fail(tileDrag.err);
  await page.waitForTimeout(400);
  const tileAfter = await page.evaluate(() => {
    const tile = [...document.querySelectorAll(".dw-sheetbody .dw-tile")]
      .find((t) => t.querySelector(".dw-tilelab").textContent === "level");
    return { v: +tile.getAttribute("aria-valuenow"), edited: tile.classList.contains("edited"),
      patch: ((window.__DAW.SONG.patch.layers || {}).melody || {}).level,
      txt: tile.querySelector(".dw-tileval").textContent };
  });
  if (!tileDrag.err) {
    if (Math.abs(tileAfter.v - tileDrag.want) > 0.06)
      fail(`tile landed at ${tileAfter.v} — relative drag says ${tileDrag.want.toFixed(2)} ` +
        `(a start-point jump would sit near ${tileDrag.edgeV.toFixed(2)})`);
    else ok(`RELATIVE drag: ${tileDrag.v0.toFixed(2)} ${tileDrag.down ? "−" : "+"}0.25 → ${tileAfter.v.toFixed(2)} (no jump to the touch point)`);
    if (tileAfter.patch == null) fail("the tile drag wrote nothing to patch.layers.melody.level");
    else ok(`committed to patch.layers (level: ${(+tileAfter.patch).toFixed(2)})`);
    if (!tileAfter.edited) fail("no \"yours\" dot after an edit");
    else ok("the edited dot marks yours (" + (tileAfter.txt || "…") + ")");
  }

  // ---- C: double-tap reverts to stock ----
  const v0Stock = await page.evaluate(async () => {
    const tile = [...document.querySelectorAll(".dw-sheetbody .dw-tile")]
      .find((t) => t.querySelector(".dw-tilelab").textContent === "level");
    const r = tile.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    window.__gateTouch(tile, [["pointerdown", x, y], ["pointerup", x, y]]);
    await new Promise((z) => setTimeout(z, 120));
    window.__gateTouch(tile, [["pointerdown", x, y], ["pointerup", x, y]]);
    await new Promise((z) => setTimeout(z, 250));
    return { v: +tile.getAttribute("aria-valuenow"), edited: tile.classList.contains("edited"),
      patch: ((window.__DAW.SONG.patch.layers || {}).melody || {}).level };
  });
  if (v0Stock.patch != null) fail("double-tap left the patch entry: " + v0Stock.patch);
  else ok("double-tap drops the patch entry — back to stock");
  if (v0Stock.edited) fail("the edited dot survived the revert");
  else ok("the dot clears on revert");
  if (!tileDrag.err && Math.abs(v0Stock.v - tileDrag.v0) > 0.02)
    fail(`revert did not restore the stock value: ${v0Stock.v} vs ${tileDrag.v0}`);
  else ok(`the value returns to stock (${v0Stock.v.toFixed(2)})`);

  // ---- D: no sliders, ever ----
  const nRange = await page.evaluate(() => document.querySelectorAll('input[type="range"]').length);
  if (nRange) fail(`${nRange} <input type=range> with the sound sheet open`);
  else ok("zero range inputs on the whole page (sheet open)");

  // ---- E: thumb floor across BOTH sheets we opened ----
  const floorOf = () => page.evaluate(() => {
    const small = [];
    for (const b of document.querySelectorAll(
      ".dw-sheetbody .dw-pad, .dw-sheetbody .dw-tile, .dw-sheetbody .dw-chip, #dwSheet .dw-sheettab, .dw-sheetbody .dw-mini")) {
      if (b.disabled) continue;
      const r = b.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.width < 43.5 || r.height < 43.5)
        small.push(b.className.split(" ")[0] + "@" + Math.round(r.width) + "x" + Math.round(r.height));
    }
    return [...new Set(small)].slice(0, 6);
  });
  const smallSound = await floorOf();
  if (smallSound.length) fail("melody sound sheet controls under 44px: " + smallSound.join(", "));
  else ok("every enabled control on the sound sheet clears 44px");
  await page.evaluate(() => window.__DAW.sheet.open("drums"));
  await page.waitForTimeout(300);
  const smallDrums = await floorOf();
  if (smallDrums.length) fail("drums sheet controls under 44px: " + smallDrums.join(", "));
  else ok("every enabled control on the drums sheet clears 44px");

  // ---- F: keyboard — arrows on a pad, then on a tile ----
  const padKey0 = await page.evaluate(() => {
    const pad = [...document.querySelectorAll(".dw-sheetbody .dw-pad")]
      .find((p) => +p.getAttribute("aria-valuenow") > 0.2);
    if (!pad) return { err: "no on-pad to focus" };
    pad.focus();
    return { v: +pad.getAttribute("aria-valuenow"),
      kits: JSON.stringify(window.__DAW.SONG.patch.kits || {}),
      focused: document.activeElement === pad };
  });
  if (padKey0.err || !padKey0.focused) fail("pad not focusable: " + (padKey0.err || "focus lost"));
  else ok("a pad takes keyboard focus (role=slider)");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(300);
  const padKey1 = await page.evaluate(() => ({
    v: +document.activeElement.getAttribute("aria-valuenow"),
    kits: JSON.stringify(window.__DAW.SONG.patch.kits || {}) }));
  if (Math.abs(padKey1.v - (padKey0.v - 0.05)) > 0.01)
    fail(`ArrowDown moved the pad ${padKey0.v} → ${padKey1.v} (want −0.05)`);
  else ok(`ArrowDown nudges the pad: ${padKey0.v.toFixed(2)} → ${padKey1.v.toFixed(2)}`);
  if (padKey1.kits === padKey0.kits) fail("the keyboard step did not commit to patch.kits");
  else ok("each keyboard step commits through the kit machine");

  await page.evaluate(() => { window.__DAW.sheet.open("melody"); window.__DAW.sheet.tab("sound"); });
  await page.waitForTimeout(300);
  const tileKey0 = await page.evaluate(() => {
    const tile = [...document.querySelectorAll(".dw-sheetbody .dw-tile")]
      .find((t) => t.querySelector(".dw-tilelab").textContent === "level");
    tile.focus();
    return { v: +tile.getAttribute("aria-valuenow"), focused: document.activeElement === tile };
  });
  if (!tileKey0.focused) fail("tile not focusable");
  else ok("a tile takes keyboard focus (role=slider)");
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(300);
  const tileKey1 = await page.evaluate(() => ({
    v: +document.activeElement.getAttribute("aria-valuenow"),
    patch: ((window.__DAW.SONG.patch.layers || {}).melody || {}).level }));
  if (Math.abs(tileKey1.v - Math.min(1, tileKey0.v + 0.02)) > 0.011)
    fail(`ArrowUp moved the tile ${tileKey0.v} → ${tileKey1.v} (want +0.02)`);
  else ok(`ArrowUp nudges the tile: ${tileKey0.v.toFixed(2)} → ${tileKey1.v.toFixed(2)}`);
  if (tileKey1.patch == null) fail("the tile's keyboard step did not commit to patch.layers");
  else ok("the tile's keyboard step commits through editLayer");

  // ---- G: THE TABLE — a picker is a place you go, not a wall you scroll past ----
  // The drums PART tab is the honest test bed: a SECTION table (rows = sections,
  // no ✓ because it is a menu of doors) whose every row drills into ONE kit
  // picker (grouped, filtered, a real choice with a ✓).
  await page.evaluate(() => window.__DAW.sheet.open("drums"));
  await page.waitForTimeout(400);
  const secTable = await page.evaluate(() => {
    const t = (window.__DAW.tables() || [])[0];
    if (!t) return { err: "the drums sheet rendered no table" };
    const rows = [...document.querySelectorAll(".dw-sheetbody .dw-trow")];
    return { label: t.label, n: t.count(), first: t.ids()[0], value: t.value(),
      short: rows.filter((r) => r.getBoundingClientRect().height < 43.5)
        .map((r) => r.dataset.id + "@" + Math.round(r.getBoundingClientRect().height)),
      nomark: t.el.classList.contains("nomark"),
      marks: rows.filter((r) => (r.querySelector(".dw-tmark").textContent || "").trim()).length,
      cols: [...document.querySelectorAll(".dw-sheetbody .dw-th")].map((h) => h.textContent) };
  });
  if (secTable.err) fail(secTable.err);
  else {
    if (secTable.n < 2) fail("the section table has " + secTable.n + " rows — that is not a table");
    else ok(`the drums sheet is a SECTION TABLE: ${secTable.n} rows, columns [${secTable.cols.join(" · ")}]`);
    if (secTable.short.length) fail("table rows under 44px: " + secTable.short.join(", "));
    else ok("every table row clears the 44px thumb floor");
    if (secTable.value != null || !secTable.nomark || secTable.marks)
      fail("a door table drew a ✓ gutter (value " + secTable.value + ", " + secTable.marks + " marks)");
    else ok("a table of DOORS carries no ✓ and collapses the marker gutter");
  }

  const openedPicker = await page.evaluate(() => {
    const t = (window.__DAW.tables() || [])[0];
    const secRow = t.ids()[0];
    const tr = t.rowEl(secRow);
    tr.click();                                    // the row IS the door
    // read the row we walked through, still holding the reference the push
    // detached: a door must not come back marked as a choice
    return { secRow, depth: window.__DAW.sheet.depth(), stack: window.__DAW.sheet.stack(),
      doorSel: tr.getAttribute("aria-selected"), doorOn: tr.classList.contains("on"),
      doorMark: (tr.querySelector(".dw-tmark").textContent || "").trim() };
  });
  await page.waitForTimeout(300);
  if (openedPicker.depth !== 2)
    fail("a section row did not push a picker view (depth " + openedPicker.depth + ")");
  else ok(`a row drills in: ${openedPicker.stack.join(" → ")}`);
  if (openedPicker.doorSel === "true" || openedPicker.doorOn || openedPicker.doorMark)
    fail(`walking through a door marked it chosen (aria-selected=${openedPicker.doorSel}, ` +
      `mark "${openedPicker.doorMark}") — a door table has no selection`);
  else ok("walking through a door does NOT mark it selected — it is an action, not a choice");

  const pickerShape = await page.evaluate(() => {
    const t = (window.__DAW.tables() || [])[0];
    if (!t) return { err: "the picker view rendered no table" };
    const rows = [...document.querySelectorAll(".dw-sheetbody .dw-trow")];
    const fe = t.filterEl();
    const fr = fe && fe.getBoundingClientRect();
    return { label: t.label, n: t.count(), value: t.value(),
      groups: [...document.querySelectorAll(".dw-sheetbody .dw-tgroup")].map((g) => g.dataset.group),
      short: rows.filter((r) => r.getBoundingClientRect().height < 43.5).length,
      filter: !!fe, filterType: fe && fe.type, filterH: fr && Math.round(fr.height),
      role: document.querySelector(".dw-sheetbody .dw-table").getAttribute("role"),
      optRoles: new Set(rows.map((r) => r.getAttribute("role"))).size === 1 && rows[0].getAttribute("role"),
      selected: rows.filter((r) => r.getAttribute("aria-selected") === "true").map((r) => r.dataset.id),
      tabbable: rows.filter((r) => r.tabIndex === 0).map((r) => r.dataset.id),
      ranges: document.querySelectorAll('input[type="range"]').length };
  });
  if (pickerShape.err) fail(pickerShape.err);
  else {
    if (pickerShape.n < 10 || pickerShape.groups.length < 2)
      fail(`the kit picker is ${pickerShape.n} rows in ${pickerShape.groups.length} groups — expected a grouped wall`);
    else ok(`the picker is ONE table: ${pickerShape.n} rows under ${pickerShape.groups.length} sticky group heads (${pickerShape.groups.join(", ")})`);
    if (pickerShape.short) fail(pickerShape.short + " picker rows under 44px");
    else ok("every picker row clears 44px");
    if (pickerShape.role !== "listbox" || pickerShape.optRoles !== "option")
      fail(`listbox semantics missing (table ${pickerShape.role}, rows ${pickerShape.optRoles})`);
    else ok("real listbox semantics: role=listbox over role=option rows");
    if (pickerShape.selected.length !== 1 || pickerShape.tabbable.length !== 1)
      fail(`roving tabindex broken: ${pickerShape.tabbable.length} tabbable, ${pickerShape.selected.length} selected`);
    else ok(`exactly one row is tabbable and selected ("${pickerShape.tabbable[0]}") — a ROVING tabindex, not 23 tab stops`);
    if (!pickerShape.filter || pickerShape.filterType !== "search")
      fail(`the filter is type="${pickerShape.filterType}" — it must be a search box, never a range`);
    else ok('the filter is <input type="search"> (the no-slider law is about amounts)');
    if (pickerShape.filterH < 43.5) fail("the filter box is " + pickerShape.filterH + "px tall");
    else ok("the filter box clears 44px too");
    if (pickerShape.ranges) fail(pickerShape.ranges + " range inputs appeared with the picker open");
    else ok("still zero <input type=range> on the page, picker open");
  }

  // the filter NARROWS — rows and the group headers that emptied with them
  const filtered = await page.evaluate(() => {
    const t = (window.__DAW.tables() || [])[0];
    const all = t.ids();
    // pick a stem that really NARROWS but leaves several rows standing — a
    // filter that lands on one row proves nothing about roving or group heads
    const stems = [];
    for (const id of all) for (const n of [2, 3]) stems.push(String(id).slice(0, n));
    let q = null;
    for (const s of [...new Set(stems)]) {
      t.filter(s);
      const k = t.visibleIds().length;
      if (k >= 3 && k <= all.length - 3) { q = s; break; }
    }
    if (!q) { q = String(all[all.length - 1]).slice(0, 3); }
    t.filter("");
    const before = t.visibleIds();
    const tabBefore = [...document.querySelectorAll(".dw-sheetbody .dw-trow")]
      .filter((r) => r.tabIndex === 0).map((r) => r.dataset.id)[0];
    const groupsBefore = [...document.querySelectorAll(".dw-sheetbody .dw-tgroup")].filter((g) => !g.hidden).length;
    t.filter(q);
    const vis = t.visibleIds();
    const tabAfter = [...document.querySelectorAll(".dw-sheetbody .dw-trow")]
      .filter((r) => r.tabIndex === 0).map((r) => r.dataset.id);
    const out = { q, all: all.length, vis: vis.length, groupsBefore, tabBefore, tabAfter,
      tabVisible: tabAfter.length === 1 && vis.indexOf(tabAfter[0]) >= 0,
      hidTabBefore: vis.indexOf(tabBefore) < 0,
      groupsAfter: [...document.querySelectorAll(".dw-sheetbody .dw-tgroup")].filter((g) => !g.hidden).length,
      stray: vis.filter((id) => {
        const r = t.rowEl(id);
        return (r.textContent + " " + id).toLowerCase().indexOf(q.toLowerCase()) < 0;
      }),
      dropped: before.filter((id) => vis.indexOf(id) < 0).length };
    t.filter("");                                  // back to the whole list
    return Object.assign(out, { restored: t.visibleIds().length });
  });
  if (!(filtered.vis >= 3 && filtered.vis < filtered.all))
    fail(`the filter "${filtered.q}" left ${filtered.vis} of ${filtered.all} rows — it narrowed nothing`);
  else if (filtered.stray.length) fail("the filter left non-matching rows: " + filtered.stray.join(","));
  else ok(`the filter narrows: "${filtered.q}" → ${filtered.vis} of ${filtered.all} rows (${filtered.dropped} dropped)`);
  if (!(filtered.groupsAfter < filtered.groupsBefore))
    fail(`the group headers survived the filter (${filtered.groupsBefore} → ${filtered.groupsAfter}) — empty heads are a lie`);
  else ok(`the emptied group heads went with them (${filtered.groupsBefore} → ${filtered.groupsAfter})`);
  if (filtered.tabAfter.length !== 1 || !filtered.tabVisible)
    fail(`the tab stop is on a hidden row after filtering (${filtered.tabAfter.join(",")} not among the visible)`);
  else if (!filtered.hidTabBefore)
    fail(`the filter never hid the row that held the tab stop ("${filtered.tabBefore}") — the roving claim is untested`);
  else ok(`the tab stop ROVES off the filtered-out row: "${filtered.tabBefore}" → "${filtered.tabAfter[0]}"`);
  if (filtered.restored !== filtered.all) fail("clearing the filter did not restore every row");
  else ok("clearing the filter restores the whole list");

  // arrows move the focus, Enter picks — the keyboard is a real way through
  await page.evaluate(() => (window.__DAW.tables() || [])[0].focus());
  const kb0 = await page.evaluate(() => document.activeElement.dataset.id);
  await page.keyboard.press("ArrowDown");
  const kb1 = await page.evaluate(() => document.activeElement.dataset.id);
  await page.keyboard.press("ArrowDown");
  const kb2 = await page.evaluate(() => ({ id: document.activeElement.dataset.id,
    tabbable: [...document.querySelectorAll(".dw-sheetbody .dw-trow")].filter((r) => r.tabIndex === 0).length,
    selected: (window.__DAW.tables() || [])[0].value() }));
  if (!kb0 || kb1 === kb0 || kb2.id === kb1)
    fail(`ArrowDown did not walk the rows (${kb0} → ${kb1} → ${kb2.id})`);
  else ok(`ArrowDown walks the rows: ${kb0} → ${kb1} → ${kb2.id}`);
  if (kb2.tabbable !== 1) fail(`${kb2.tabbable} rows tabbable after arrowing — the tabindex must ROVE`);
  else ok("still exactly one tab stop after arrowing");
  if (kb2.selected !== kb0) fail("moving the focus already changed the value — arrows must not commit");
  else ok(`moving the focus does NOT pick (value still "${kb2.selected}")`);

  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const committed = await page.evaluate((want) => {
    const so = window.__DAW.SONG.patch.secover || {};
    const t = (window.__DAW.tables() || [])[0];
    const hit = Object.keys(so).find((k) => so[k].drums === want);
    return { depth: window.__DAW.sheet.depth(), secover: hit ? { id: hit, drums: so[hit].drums } : null,
      backLabel: t && t.label,
      yours: t && t.rowEl(hit) ? [...t.rowEl(hit).querySelectorAll(".dw-tcell")].map((c) => c.textContent) : null };
  }, kb2.id);
  if (committed.depth !== 1) fail("Enter did not pop the picker (depth " + committed.depth + ")");
  else ok("Enter picks and pops the picker — you go there, choose, and come back");
  if (!committed.secover)
    fail(`Enter wrote no "${kb2.id}" into patch.secover — the pick did not reach the document`);
  else ok(`the pick committed THROUGH the document: secover["${committed.secover.id}"].drums = ${committed.secover.drums}`);
  if (committed.backLabel !== "section")
    fail("popping did not land back on the section table: " + committed.backLabel);
  else if (!committed.yours || committed.yours.indexOf(kb2.id) < 0)
    fail(`the section table you came back to does not show the pick: ${JSON.stringify(committed.yours)}`);
  else ok(`the table you came back to already reads it (${committed.yours.join(" · ")})`);

  // …and reopening the picker OPENS ON THE CHOICE. A picker view's table has no
  // max-height (the sheet body is the scroller), so a table that only scrolled
  // its own box scrolled nothing at all — a 23-row list opening hundreds of
  // pixels above the kit you already picked.
  const reopened = await page.evaluate(async (sec) => {
    const open = async () => { (window.__DAW.tables() || [])[0].rowEl(sec).click();
      await new Promise((r) => setTimeout(r, 500)); return (window.__DAW.tables() || [])[0]; };
    let t = await open();
    const last = t.ids()[t.count() - 1];           // the row furthest down the list
    t.rowEl(last).click();                         // commits + pops
    await new Promise((r) => setTimeout(r, 400));
    t = await open();                              // …and back in, on the choice
    const tr = t.rowEl(t.value());
    const body = document.querySelector(".dw-sheetbody");
    const rr = tr.getBoundingClientRect(), br = body.getBoundingClientRect();
    return { want: last, value: t.value(), idx: t.ids().indexOf(t.value()), n: t.count(),
      scrolled: body.scrollTop,
      inView: rr.top >= br.top - 1 && rr.bottom <= br.bottom + 1,
      row: Math.round(rr.top), body: [Math.round(br.top), Math.round(br.bottom)] };
  }, openedPicker.secRow);
  if (reopened.value !== reopened.want)
    fail(`the reopened picker shows "${reopened.value}" as chosen, not "${reopened.want}"`);
  else if (!reopened.scrolled)
    fail("the picker did not scroll at all — the sheet body is the scroller, not the table's own box");
  else if (!reopened.inView)
    fail(`the picker opened with the chosen row off screen (row at ${reopened.row}, body ${reopened.body.join("–")})`);
  else ok(`reopening scrolls the choice into view: row ${reopened.idx + 1}/${reopened.n} ("${reopened.value}") at y ${reopened.row}, body ${reopened.body.join("–")}, scrolled ${Math.round(reopened.scrolled)}px`);
  await page.evaluate(() => window.__DAW.sheet.back());
  await page.waitForTimeout(200);

  // ---- H: VOLUME — the tile gesture laid sideways, on the ONE controller ----
  const volShape = await page.evaluate(() => {
    const el = window.__DAW.controller.volEl();
    const r = el.getBoundingClientRect();
    return { role: el.getAttribute("role"), w: Math.round(r.width), h: Math.round(r.height),
      inController: window.__DAW.controller.el().contains(el),
      tag: el.tagName.toLowerCase() };
  });
  if (volShape.role !== "slider" || volShape.tag === "input")
    fail(`the volume control is <${volShape.tag} role=${volShape.role}> — it must be role=slider and not an input`);
  else ok("volume is a role=slider element, not an <input>");
  if (volShape.h < 43.5 || volShape.w < 43.5) fail(`the volume control is ${volShape.w}×${volShape.h}`);
  else ok(`the volume control clears the thumb floor (${volShape.w}×${volShape.h})`);
  if (!volShape.inController) fail("the volume control is not inside the controller");
  else ok("volume lives in the ONE controller, beside ▶ and the readout");

  const volDrag = await page.evaluate(() => {
    const el = window.__DAW.controller.volEl();
    const r = el.getBoundingClientRect();
    const y = r.top + r.height / 2;
    const v0 = window.__DAW.controller.volume();
    const sx = r.left + r.width - 6;               // start at the FULL edge…
    const dx = -Math.round(r.width * 0.5);         // …and drag half a sweep back
    const pts = [["pointerdown", sx, y]];
    for (let k = 1; k <= 4; k++) pts.push(["pointermove", sx + (dx * k) / 4, y]);
    pts.push(["pointerup", sx + dx, y]);
    window.__gateTouch(el, pts);
    const sweep = Math.max(90, el.clientWidth);
    return { v0, want: Math.max(0, Math.min(1, v0 + dx / sweep)),
      v1: window.__DAW.controller.volume(), transport: window.__DAWTRANSPORT.volume(),
      stored: parseFloat(localStorage.getItem("dw.vol")),
      aria: +el.getAttribute("aria-valuenow"),
      fill: el.querySelector(".dw-cvolfill").style.width };
  });
  if (Math.abs(volDrag.v1 - volDrag.want) > 0.06)
    fail(`the volume drag landed at ${volDrag.v1} — the drag's geometry says ${volDrag.want.toFixed(2)}`);
  else ok(`a sideways drag sets the volume by its geometry: ${volDrag.v0.toFixed(2)} → ${volDrag.v1.toFixed(2)}`);
  if (volDrag.transport !== volDrag.v1)
    fail(`the controller says ${volDrag.v1} and TRANSPORT.volume() says ${volDrag.transport}`);
  else ok("the controller reads TRANSPORT.volume() — one source of truth");
  if (!(Math.abs(volDrag.stored - volDrag.v1) < 1e-9))
    fail("the volume did not persist to localStorage dw.vol: " + volDrag.stored);
  else ok("the volume persists (localStorage dw.vol)");
  if (Math.abs(volDrag.aria - volDrag.v1) > 0.005 || volDrag.fill !== Math.round(volDrag.v1 * 100) + "%")
    fail(`the fill/aria disagree with the value (${volDrag.fill}, aria ${volDrag.aria})`);
  else ok(`the fill width IS the volume (${volDrag.fill})`);

  await page.evaluate(() => window.__DAW.controller.volEl().focus());
  const volFocused = await page.evaluate(() =>
    document.activeElement === window.__DAW.controller.volEl());
  if (!volFocused) fail("the volume control does not take keyboard focus");
  else ok("the volume control takes keyboard focus");
  await page.keyboard.press("ArrowRight");
  const volK1 = await page.evaluate(() => window.__DAW.controller.volume());
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  const volK2 = await page.evaluate(() => window.__DAW.controller.volume());
  if (Math.abs(volK1 - Math.min(1, volDrag.v1 + 0.05)) > 0.011)
    fail(`ArrowRight moved the volume ${volDrag.v1} → ${volK1} (want +0.05)`);
  else ok(`ArrowRight nudges the volume: ${volDrag.v1.toFixed(2)} → ${volK1.toFixed(2)}`);
  if (Math.abs(volK2 - Math.max(0, volK1 - 0.1)) > 0.011)
    fail(`ArrowLeft×2 moved the volume ${volK1} → ${volK2} (want −0.10)`);
  else ok(`ArrowLeft nudges it back: ${volK1.toFixed(2)} → ${volK2.toFixed(2)}`);
  await page.keyboard.press("Home");
  const volMin = await page.evaluate(() => window.__DAW.controller.volume());
  await page.keyboard.press("End");
  const volMax = await page.evaluate(() => ({ v: window.__DAW.controller.volume(),
    ranges: document.querySelectorAll('input[type="range"]').length,
    searches: document.querySelectorAll('input[type="search"]').length }));
  if (volMin !== 0 || volMax.v !== 1) fail(`Home/End did not reach the ends (${volMin} / ${volMax.v})`);
  else ok("Home/End reach silence and full");
  if (volMax.ranges) fail(volMax.ranges + " <input type=range> after driving the volume");
  else ok("after all of that, still ZERO <input type=range> on the page");

  if (errs.length) fail("page errors: " + errs.join(" | "));
  else ok("no page errors");

  await browser.close(); srv.close();
  if (process.exitCode) console.error("\nDAW-CONTROLS: FAIL");
  else console.log(`\nDAW-CONTROLS: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
