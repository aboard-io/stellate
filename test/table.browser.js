#!/usr/bin/env node
/* test/table.browser.js — THE BAND TABLE, DRIVEN ON THE RENDERED PAGE
 * (2026-09-04, nukernel/TABLE.md wave 2b.)
 *
 * WHY THIS FILE EXISTS. Paul, 2026-09-03: *"a song can be understood as a grid
 * with sections as rows and instruments as columns … The producer becomes
 * basically a vector manipulator across the table."* Plus three amendments the
 * gates below are the enforcement of: *"we still want per-section mix
 * automation, with per-cell relative to that"* (drawn greyed with its reason
 * until wave 3), *"mobile editing is truly critical"* (T5 at five widths, 44px,
 * no sideways page scroll, every op reachable by tap at 320) and *"get rid of
 * everything it replaces … Don't lose unreplaced options"* (T7, against
 * test/table-inventory.json).
 *
 * EVERY CHECK READS THE RENDERED PAGE, and the two that make a musical claim
 * read the RENDERED OUTPUT — the event stream and the mix the engine was
 * handed — because this branch has shipped three features that looked right
 * and failed their one job while every structural check passed
 * ([[test-the-artifact]]), and because its characteristic bug is a parameter
 * that is declared, costed and never reaches the sound
 * ([[declared-but-never-arriving]]).
 *
 * THE CHECKS
 *   T5  THE ARTIFACT. At 320/375/430/820/1280: the table stands, the page
 *       never scrolls sideways (the PANE does, which is nu.css's answer for a
 *       wide table), every control on it is at least 44px, an inherited cell
 *       is drawn differently from a written one, a tapped cell's sheet lists
 *       §1's fields IN ORDER, and the drummer's sixty-eight are grouped.
 *   T7  NOTHING LOST. Every control in test/table-inventory.json is found on
 *       the rendered table at 320px, tappable, behind the `open` the inventory
 *       names — or the gate fails with the control's own name.
 *   T4  THE OPS. Each op in §5 is ONE document write (diffed), leaves the
 *       transport and the seed alone, and changes only what it owns.
 *   T6  THE SOUND. A cell's motif and a register at BOTH tiers (the cell's
 *       and the column's `cast.reg` — §1b's "derive is blind" corrected by
 *       measurement 2026-09-05, once the probe carried a pitch) reach the
 *       RENDERED EVENTS, a column's seat reaches the mix the engine was handed, and
 *       (T6e, wave 3) a cell's MIX LANE is a strip a thumb can reach whose tap
 *       lands on the cell tier and on the box the desk reads.
 *   T0  zero pageerror, zero console error, across all of it.
 *
 * RUN: NODE_PATH=/home/ford/ftrain-2025/node_modules node test/table.browser.js
 */
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const ROOT = path.join(__dirname, "..");
const SHOTS = arg("--shots", null);
const PAGE_ARG = arg("--page", null);
const EXE = arg("--chrome", null) || (() => {
  const home = process.env.HOME;
  for (const d of ["chromium-1234", "chromium_headless_shell-1234", "chromium-1217"]) {
    for (const b of ["chrome-linux64/chrome", "chrome-linux/headless_shell", "chrome-linux/chrome"]) {
      const p = path.join(home, ".cache/ms-playwright", d, b);
      if (fs.existsSync(p)) return p;
    }
  }
  return path.join(home, ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
})();

/* KINGSTON 1969 AT READING 1 — the same subject test/band.browser.js drives,
   and for the same reason: it is a record with several lines, a bass and a kit,
   which is what a table of vectors needs something to be about. */
const REGGAE = "#at=Kingston&y=1969&s=1";
const INV = JSON.parse(fs.readFileSync(path.join(__dirname, "table-inventory.json"), "utf8"));

const fails = [], notes = [];
const check = (ok, what) => { (ok ? notes : fails).push(what);
  console.log((ok ? "  ok   " : "  FAIL ") + what); };

const SERVER_PY = `
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()
    def log_message(self, *a): pass
srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(H, directory=sys.argv[1]))
print(srv.server_address[1], flush=True)
srv.serve_forever()
`;
function standUpServer() {
  const proc = spawn("python3", ["-c", SERVER_PY, ROOT],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((res, rej) => {
    let buf = "";
    const to = setTimeout(() => rej(new Error("the static server did not report a port")), 10000);
    proc.stdout.on("data", (d) => { buf += d; const m = buf.match(/(\d+)/);
      if (m) { clearTimeout(to); res({ proc, port: +m[1] }); } });
    proc.on("error", (e) => { clearTimeout(to); rej(e); });
  });
}

/* §1's ORDER, WHICH IS THE CONTRACT A SHEET IS READ AGAINST. TABLE.md §6: "one
   cell-row per field in §1's order". Written out here rather than derived from
   the page, because a gate that asked the page what order it was in would be
   asserting that the page equals itself. */
const CELL_ORDER = ["motifs", "does", "enters at bar", "register", "focus",
                    /* ...AND THE FOUR LANE KINDS THAT REPLACED ONE GREY ROW
                       (TABLE.md wave 3, 2026-09-04). §1's "mix automation" was
                       one line while it was a promise; it is four strips now,
                       one per lane kind, in fields.js CELLAUTO's own order. */
                    "mix · level", "mix · place", "mix · send", "mix · tone",
                    /* ...AND THE FIVE THAT REPLACED THE LAST GREY ROW (TABLE.md
                       wave 4, 2026-09-04). §1's "artic / oct / rate / scale /
                       clamp" was one line while it was a promise; it is four
                       strips and one measurement now, in fields.js CELLVEC's
                       own order, drawn under their working names. */
                    "articulation", "octave", "time", "alphabet", "ramp limit"];
const ROW_ORDER  = ["type", "bars", "level", "shape", "intro", "outro",
                    "motion", "pace", "period", "breath", "pipe",
                    "key", "mode", "changes", "swing", "groove",
                    "chain", "reverb", "echo", "echo time", "room", "across",
                    "starts at", "automation"];
const KITGROUPS = ["kick", "snare", "hats", "toms & fills", "dynamics", "feel"];

(async () => {
  console.log("\ntable — the band table, driven on the rendered page");
  const srv = PAGE_ARG ? null : await standUpServer();
  const PAGE = PAGE_ARG || ("http://127.0.0.1:" + srv.port + "/nukernel/index.html");
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text()))
    errs.push("console: " + m.text()); });
  await p.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  await p.goto(PAGE + REGGAE, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2600);

  /* A TAB IS OPENED THE WAY A THUMB OPENS IT (ui/eight.js says so at
     `__eightTab`'s own definition: "a gate is a hand"). */
  const top = async (t) => { await p.evaluate((n) => window.__eightTab(n), t);
    await p.waitForTimeout(600); };
  const doc = () => p.evaluate(() => window.__eightDoc());
  /* AND A CONTROL IS TAPPED AT ITS OWN RECT. `page.click()` scrolls its target
     into view first (CenterIfNeeded) and has manufactured scroll "jumps" on
     this box before — one of the four ways the harness lies
     ([[nukernel-deploy-and-probe]]). `el.click()` fires the listener without
     moving anything, which is what a gate wants. */
  const tap = async (k) => { const r = await p.evaluate((key) => {
      const el = document.querySelector('#pan-band [data-k="' + key + '"]');
      if (!el) return "missing";
      if (el.disabled) return "disabled";
      el.click(); return "ok"; }, k);
    await p.waitForTimeout(420); return r; };
  const sheetRows = () => p.evaluate(() => {
    const o = document.querySelector("#pan-band tr.nu-wopen");
    if (!o) return null;
    return [...o.querySelectorAll(".nu-sheetrow")].map((r) => ({
      lab: ((r.querySelector(".nu-sheetlab") || {}).textContent || "").trim(),
      k: (r.querySelector(".nu-wcell") || {}).dataset
        ? r.querySelector(".nu-wcell").dataset.k : null,
      why: (r.querySelector("[data-why]") || {}).dataset
        ? r.querySelector("[data-why]").dataset.why : null,
      clear: !!r.querySelector(".nu-clearback"),
      ops: [...r.querySelectorAll(".nu-opbtn")].map((x) => x.dataset.k) }));
  });
  const has = (k) => p.evaluate((key) =>
    !!document.querySelector('#pan-band [data-k="' + key + '"]'), k);
  const shot = async (name) => { if (!SHOTS) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    await p.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: true }); };

  await top("Band");

  /* ================= T5a · THE TABLE IS THERE =========================== */
  const shape = await p.evaluate(() => {
    const host = document.getElementById("pan-band");
    const t = host && host.querySelector("table.nu-wordgrid");
    const D = window.__eightDoc();
    return { table: !!t,
      /* `:not(.nu-addrow)` (2026-09-05, TABLE.md §9a). The grid grew a `+` at
         the end of each axis — Paul: *"I should be able to add players without
         using the nav and sections too"* — and the section axis's end is a row
         UNDER the last section, which is where a spreadsheet has always put
         "one more". It is not a section, exactly as a `<tfoot>` row is not one,
         so it is excluded here rather than counted as a record the document
         does not have. The player axis's `+` is a `<th class="nu-addhead">` and
         needs no exclusion: this count reads `th.nu-colhead`. */
      rows: t ? t.querySelectorAll("tbody tr:not(.nu-addrow)").length : 0,
      cols: t ? t.querySelectorAll("thead th.nu-colhead").length : 0,
      foot: t ? t.querySelectorAll("tfoot tr").length : 0,
      secs: D.form.sections.length, voices: D.voices.length,
      corner: !!host.querySelector('[data-k="tcorner"]'),
      cells: host.querySelectorAll('[data-k^="tcell|"]').length };
  });
  check(shape.table && shape.rows === shape.secs && shape.cols === shape.voices,
    "T5a the table is the record: " + shape.rows + " section rows x " +
    shape.cols + " voice columns (" + shape.secs + " x " + shape.voices + ")");
  check(shape.cells === shape.secs * shape.voices,
    "…and every crossing is a cell (" + shape.cells + ")");
  check(shape.foot === 2, "…with the record under it: master + performance (" +
    shape.foot + " footer rows)");
  check(shape.corner, "…and the corner is the whole record");

  /* ================= T5b · THE THREE SHEETS, IN §1's ORDER ============== */
  const secId = (await doc()).form.sections[0].id;
  const vName = (await doc()).voices[0].name;
  await tap("trow|" + secId);
  const rs = await sheetRows();
  const rlabs = (rs || []).map((r) => r.lab).filter((x) => ROW_ORDER.includes(x));
  check(JSON.stringify(rlabs) === JSON.stringify(ROW_ORDER.filter((x) => rlabs.includes(x))),
    "T5b the row sheet is §1's SECTION vector in §1's order (" + rlabs.length + " fields)");
  check(rlabs.includes("pace"),
    "…and pace is on the ROW now, out of Time (TABLE.md §1, Paul 2026-09-03)");
  check(rlabs.includes("key") && rlabs.includes("swing") && rlabs.includes("reverb"),
    "…with wave 2a's own row overrides: key, swing, the chain and the room");
  await tap("trow|" + secId);

  await tap("tcol|" + vName);
  const cs = await sheetRows();
  const clabs = (cs || []).map((r) => r.lab);
  check(clabs.includes("instrument") && clabs.includes("register") &&
        clabs.includes("enters at bar") && clabs.includes("seat"),
    "T5c the column sheet is §1's VOICE vector (" + clabs.length + " rows): " +
    clabs.join(" · "));
  await tap("tcol|" + vName);

  /* ...AND THE SINGER'S OWN THROAT IS ONE OF ITS ROWS (2026-09-04, the
     per-chair singer round). `document.js TIERS.voice` is a COLUMN field — a
     chair may name which of the five modelled throats sings it, because a
     four-part choir needs four and a row can say ONE — and this is its
     control. Driven on the RENDERED page and not counted in the source,
     because ui/table.js draws this row directly (like the drummer's own two
     words) and no avail.js sheet would prove it arrived.
     FOUR CLAIMS: it is there on a chair a person sings and ABSENT on a chair
     nobody sings (the question has no meaning on a guitar, and a refusal
     sentence there would be the silent grey's talkative cousin); it prints the
     ROW's word, derived, until a hand writes; it offers the five throats the
     engine models and no sixth; and pressing one LANDS at `cast.voice`, which
     is where the seat, the composer and the resolver all ask. */
  const VOXIDS = ["solo_vox", "ahh_choir", "ohh_voices"];
  const DV = await doc();
  const singer = DV.voices.find((v) => v.kind === "line" &&
    VOXIDS.includes(String(v.instrument)));
  const player = DV.voices.find((v) => v.kind === "line" &&
    !VOXIDS.includes(String(v.instrument)));
  if (!singer || !player) {
    check(false, "T5c2 this record seats no singer, or no player, to ask");
  } else {
    const chipsOfField = (k) => p.evaluate((key) => {
      const f = document.querySelector('#pan-band [data-k="' + key + '"]');
      if (!f) return [];
      f.click();
      return [...document.querySelectorAll("#pan-band .nu-wchip")]
        .map((c) => c.dataset.k).filter((x) => x && x.indexOf(key + "|") === 0);
    }, k);
    const press = (k) => p.evaluate((key) => {
      const c = document.querySelector('#pan-band [data-k="' + key + '"]');
      if (c) c.click(); }, k);
    const throatOn = (n) => p.evaluate((name) => {
      const v = window.__eightDoc().voices.find((x) => x.name === name);
      return (v && v.cast && v.cast.voice) || null; }, n);

    await tap("tcol|" + singer.name);
    const sr = await sheetRows();
    const trow = (sr || []).find((r) => r.lab === "sings as");
    check(!!trow, "T5c2 a chair a person sings is asked whose throat it is" +
      (trow ? " (" + trow.k + ")" : " — NO ROW ON " + singer.name));
    check(!!trow && !trow.clear,
      "…and it is derived until a hand writes: the word is the record's own");
    const chips = await chipsOfField("throat|" + singer.name);
    const words = chips.map((k) => k.split("|").pop()).filter(Boolean);
    check(words.length === 5,
      "…offering the five throats the engine models: " + words.join(" "));
    const want = chips.find((k) => k.endsWith("|bass")) || chips[chips.length - 1];
    await press(want); await p.waitForTimeout(800);
    check((await throatOn(singer.name)) === want.split("|").pop(),
      "…and pressing one lands on the COLUMN tier at cast.voice (" +
      JSON.stringify(await throatOn(singer.name)) + ")");
    /* ...AND THE CLEAR-BACK HANDS THE QUESTION BACK TO THE GENRE, which is the
       one spelling of "inherited" this surface keeps (§2) and is also what
       leaves the record as the rest of this gate found it.
       DRIVEN THROUGH THE CONTROL A PERSON USES — the row's own `.nu-clearback`,
       which the sheet draws only once a hand has written — and not through the
       empty chip, because a write re-renders the table and the accordion is not
       promised to be standing afterwards. The sheet is re-opened first for the
       same reason, and the press reports WHY when it cannot find its target
       rather than failing as a silent false. */
    const reopen = async () => {
      const open = await p.evaluate(() => !!document.querySelector("#pan-band tr.nu-wopen"));
      if (!open) await tap("tcol|" + singer.name);
    };
    await reopen();
    const cleared = await p.evaluate(() => {
      const o = document.querySelector("#pan-band tr.nu-wopen");
      if (!o) return "the sheet did not reopen";
      const r = [...o.querySelectorAll(".nu-sheetrow")].find((x) =>
        ((x.querySelector(".nu-sheetlab") || {}).textContent || "").trim() === "sings as");
      if (!r) return "no throat row in the reopened sheet";
      const c = r.querySelector(".nu-clearback");
      if (!c) return "the written row drew no clear-back";
      c.click(); return "ok";
    });
    await p.waitForTimeout(800);
    check(cleared === "ok" && (await throatOn(singer.name)) === null,
      "…and the clear-back hands the question back to the genre (" + cleared + ", " +
      JSON.stringify(await throatOn(singer.name)) + ")");
    // shut it again, whichever way the write left it, so the next block opens
    // its own sheet rather than a second one
    if (await p.evaluate(() => !!document.querySelector("#pan-band tr.nu-wopen")))
      await tap("tcol|" + singer.name);

    await tap("tcol|" + player.name);
    const pr = await sheetRows();
    check(!(pr || []).some((r) => r.lab === "sings as"),
      "…and a chair nobody sings is not asked at all (" + player.instrument + ")");
    await tap("tcol|" + player.name);
  }

  /* ...AND THE CELL SHEET IS OPENED ON A CHAIR THAT READS A SUBJECT (wave 4).
     `voices[0]` on this record is the skank, a `stab`, and a stab voices the
     bar's CHORD — `kernel.js render` sends it down the chord branch, which
     never reads an articulation or a subject alphabet — so those two rows are
     drawn there as measurements and not as strips. That is the honest drawing
     and it is T6k's own claim; this row is about the ORDER and about the four
     that are live, so it asks the chair they are live on. */
  const subjV = ((await doc()).voices.find((v) => v.kind === "line" &&
    !["pad", "stab"].includes(String((v.cast || {}).part || ""))) ||
    { name: vName }).name;
  await tap("tcell|" + subjV + "|" + secId);
  const cc = await sheetRows();
  const cellLabs = (cc || []).map((r) => r.lab).filter((x) => CELL_ORDER.includes(x));
  check(JSON.stringify(cellLabs) === JSON.stringify(CELL_ORDER.filter((x) => cellLabs.includes(x))),
    "T5d the cell sheet is §1's CELL vector in §1's order: " + cellLabs.join(" · "));
  const greyed = (cc || []).filter((r) => r.why);
  /* THIS CHECK USED TO READ "mix automation is greyed WITH ITS REASON" and to
     demand the words "wave 3" in it. The wave arrived (2026-09-04): the row is
     four live strips now, so the assertion is inverted rather than deleted —
     the mix lanes must be DRAWN and carry no refusal, which is the same law
     ("no silent grey") pointed at a control that works. T6e drives them. */
  check(!greyed.some((r) => /^mix/.test(r.lab)),
    "…the cell's mix lanes are LIVE, not greyed (wave 3 arrived; the strips " +
    "are drawn and refuse nothing)");
  /* ...AND THE SAME INVERSION FOR WAVE 4 (2026-09-04). This read "and so are
     the five that need a VERSION migration" and demanded the words "wave 4" in
     the refusal. The wave arrived and there was no migration to make (TABLE.md
     §1d), so the assertion is inverted the way wave 3's above was: four of the
     five are live strips that refuse nothing, and the FIFTH — the ramp limit —
     keeps a refusal, because it is measured to move no note on the document
     path and an honest sentence beats a dead control. */
  check(!greyed.some((r) => ["articulation", "octave", "time", "alphabet"]
          .includes(r.lab)),
    "…artic, oct, rate and scale are LIVE strips, not greyed (wave 4 arrived)");
  check(greyed.some((r) => r.lab === "ramp limit" && /no ramp/.test(r.why)),
    "…and the ramp limit alone keeps its refusal, with the measurement in it");
  await shot("cell-sheet-390");
  await tap("tcell|" + subjV + "|" + secId);

  /* ================= T5e · QUIET IS INHERITED, BOLD IS WRITTEN ========== */
  const paint = await p.evaluate(() => {
    const cells = [...document.querySelectorAll('#pan-band [data-k^="tcell|"]')];
    const dim = cells.filter((c) => c.classList.contains("is-derived"));
    const rs = dim.length ? getComputedStyle(dim[0]) : null;
    const br = cells.find((c) => !c.classList.contains("is-derived"));
    const bs = br ? getComputedStyle(br) : null;
    return { n: cells.length, dim: dim.length,
      dimWeight: rs ? rs.fontWeight : null, boldWeight: bs ? bs.fontWeight : null,
      dimOpacity: rs ? rs.opacity : null };
  });
  check(paint.dim > 0 && paint.dim < paint.n,
    "T5e the table draws only DEVIATIONS: " + paint.dim + " of " + paint.n +
    " cells are inherited (§2)");
  check(paint.dimWeight !== paint.boldWeight || paint.dimOpacity !== "1",
    "…and inherited is drawn differently from written (weight " +
    paint.dimWeight + " vs " + paint.boldWeight + ", opacity " + paint.dimOpacity + ")");

  /* ================= T5f · THE DRUMMER'S SIXTY-EIGHT, GROUPED =========== */
  const D0 = await doc();
  const drums = (D0.voices.find((v) => v.kind === "drums") || {}).name;
  if (drums) {
    await tap("tcell|" + drums + "|" + secId);
    await tap("dev.kit|" + drums + "|" + secId);
    const gr = await p.evaluate(() => {
      const bar = document.querySelector("#pan-band .nu-groupbar");
      const chips = [...document.querySelectorAll("#pan-band .nu-wgroups .nu-wchips:not(.nu-pinned) .nu-wchip")];
      /* THE RENDERED BOX AND NOT THE `hidden` PROPERTY. Read the property and
         this check passes over a stylesheet that never hid anything — which is
         exactly what happened for one run: `.nu-wchip{display:inline-flex}`
         outranks the UA's `[hidden]{display:none}`, all sixty-eight ops stayed
         on the screen, and the gate said ten. TEST THE ARTIFACT. */
      return { groups: bar ? [...bar.children].map((x) => x.textContent) : [],
        chips: chips.length,
        shown: chips.filter((c) => c.getBoundingClientRect().height > 0).length,
        pinned: document.querySelectorAll("#pan-band .nu-pinned .nu-wchip").length };
    });
    check(gr.groups.length >= 5 && KITGROUPS.every((g) => gr.groups.includes(g)),
      "T5f the drummer's ops are grouped by what they act on: " + gr.groups.join(" · "));
    check(gr.shown > 0 && gr.shown < gr.chips,
      "…one group open at a time (" + gr.shown + " of " + gr.chips + " shown)");
    check(gr.pinned > 0, "…with the standing answer pinned above them");
    await shot("does-sheet-390");
    await tap("tcell|" + drums + "|" + secId);
  } else check(false, "T5f the record has no drummer to group");

  /* ================= T7 · NOTHING LOST ================================== */
  await ctx.pages()[0].setViewportSize({ width: 320, height: 800 });
  await p.waitForTimeout(500);
  await top("Band");
  const subst = (k) => k.replace(/<section>/g, secId)
    .replace(/<voice>/g, vName).replace(/<bass>/g, (D0.voices.find((v) => v.kind === "bass") || {}).name || vName)
    .replace(/<drums>/g, drums || vName)
    .replace(/<quality>/g, "louder").replace(/<motif>/g, "");
  const missing = [], small = [];
  for (const c of INV.controls.concat(INV.new)) {
    const reach = subst(c.reach);
    if (/^toptab-/.test(reach)) {
      const there = await p.evaluate((k) => !!document.querySelector('[data-k="' + k + '"]'), reach);
      if (!there) missing.push((c.k || c.reach) + " -> " + reach);
      continue;
    }
    if (c.open) { const o = subst(c.open); await tap(o); }
    /* `data-k` OR `data-sel` — the four vocabularies that stayed MENUS wear
       ui/selects.js's own address (test/selects.js MENUS is the one owner of
       which; ui/table.js COMBOKEYS says why), and an inventory that only knew
       one spelling would have reported a control lost that is standing there. */
    const box = await p.evaluate((k) => {
      const el = document.querySelector('#pan-band [data-k="' + k + '"]') ||
                 document.querySelector('#pan-band [data-sel="' + k + '"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    }, reach);
    if (!box) missing.push((c.k || c.reach) + " -> " + reach);
    else if (box.h < 44) small.push(reach + " " + box.w + "x" + box.h);
    if (c.open) await tap(subst(c.open));
  }
  check(!missing.length, "T7 every control the two panes offered has a home on " +
    "the table, reachable by tap at 320px (" +
    (INV.controls.length + INV.new.length) + " checked)" +
    (missing.length ? " — MISSING " + missing.join(", ") : ""));
  check(!small.length, "…and each is at least 44px tall" +
    (small.length ? " — SHORT " + small.join(", ") : ""));

  /* ================= T5g · NO SIDEWAYS PAGE SCROLL, AT FIVE WIDTHS ===== */
  for (const w of [320, 375, 430, 820, 1280]) {
    await ctx.pages()[0].setViewportSize({ width: w, height: 900 });
    await p.waitForTimeout(420);
    const m = await p.evaluate(() => {
      const de = document.documentElement;
      const host = document.getElementById("pan-band");
      const pane = host && host.querySelector(".nu-pane");
      const ctrls = [...host.querySelectorAll("button:not([hidden])")]
        .map((x) => x.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0);
      return { over: de.scrollWidth - de.clientWidth,
        paneScrolls: pane ? pane.scrollWidth > pane.clientWidth : false,
        n: ctrls.length,
        short: ctrls.filter((r) => r.height < 43.5).length,
        narrow: ctrls.filter((r) => r.width < 43.5 && r.height < 43.5).length };
    });
    check(m.over <= 1, "T5g " + w + "px: the PAGE does not scroll sideways (" +
      m.over + "px over)" + (m.paneScrolls ? " — the pane does, which is nu.css's answer" : ""));
    check(m.short === 0, "…and all " + m.n + " controls are 44px tall (" +
      m.short + " short)");
    /* AND AN OPEN SHEET IS ON THE SCREEN, not two hundred pixels past the
       right edge of a table that scrolls. §6 ¶A is a claim about WHERE a
       control is: "every op in §5 and every field of §1 is reachable by tap at
       320px". MEASURED before the sticky rule was written: at 390 the cell
       sheet's third op sat at x=590 on a 390px screen. */
    await tap("tcell|" + vName + "|" + secId);
    const off = await p.evaluate(() =>
      [...document.querySelectorAll("#pan-band .nu-vsheet button")]
        .map((x) => x.getBoundingClientRect())
        .filter((r) => r.width > 0 && (r.left < 0 || r.right > window.innerWidth + 1))
        .length);
    check(off === 0, "…and an open sheet's controls are all ON the screen (" +
      off + " off the edge)");
    await tap("tcell|" + vName + "|" + secId);
    if (w === 390 || w === 1280) await shot("table-" + w);
  }
  await ctx.pages()[0].setViewportSize({ width: 1280, height: 900 });
  await p.waitForTimeout(400);
  await shot("table-1280");
  await tap("trow|" + secId); await shot("row-sheet-1280"); await tap("trow|" + secId);
  await tap("tcol|" + vName); await shot("col-sheet-1280"); await tap("tcol|" + vName);
  await tap("tcell|" + vName + "|" + secId); await shot("cell-sheet-1280");
  await tap("tcell|" + vName + "|" + secId);
  await ctx.pages()[0].setViewportSize({ width: 390, height: 900 });
  await p.waitForTimeout(400);
  await shot("table-390");

  /* ================= T4 · EVERY OP IS ONE DOCUMENT WRITE ================ */
  /* WHAT "ONE WRITE" MEANS AND HOW IT IS MEASURED: the whole document before
     and after, diffed by JSON path. An op that owns `form.sections` may not
     move `time.bpm`, and none of them may move the SEED or the transport —
     TABLE.md §5 and the wave-4 law ("a change lands at the next bar"). */
  const snap = () => p.evaluate(() => JSON.stringify(window.__eightDoc()));
  const diffPaths = (a, b) => {
    const out = [];
    const walk = (x, y, at) => {
      if (JSON.stringify(x) === JSON.stringify(y)) return;
      if (x == null || y == null || typeof x !== "object" || typeof y !== "object") {
        out.push(at); return; }
      const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
      if (keys.size > 40) { out.push(at); return; }
      for (const k of keys) walk(x[k], y[k], at ? at + "." + k : k);
    };
    walk(JSON.parse(a), JSON.parse(b), "");
    return out;
  };
  const opCase = async (label, k, owns, opener) => {
    if (opener) { const o = await tap(opener);
      if (o !== "ok") { check(false, "T4 " + label + ": its sheet would not open (" +
        opener + ": " + o + ")"); return; } }
    const before = await snap();
    /* A SHEET THAT WAS ALREADY OPEN IS CLOSED BY THE TAP THAT WOULD HAVE
       OPENED IT. Hiring a player lands ON that player (ui/eight.js `addVoice`
       writes `tab`, and the table opens that column's sheet on arrival), so the
       next op's "open its sheet" tap FOLDS it. One retry, which is what a thumb
       does. */
    let r = await tap(k);
    if (r === "missing" && opener) { await tap(opener); r = await tap(k); }
    const after = await snap();
    if (r !== "ok") { check(false, "T4 " + label + " (" + k + "): " + r); return; }
    const moved = diffPaths(before, after);
    const strays = moved.filter((m) => !owns.some((o) => m.startsWith(o)));
    check(moved.length > 0, "T4 " + label + " moved the document (" +
      moved.length + " paths)");
    check(strays.length === 0, "…and only what it owns" +
      (strays.length ? " — STRAY " + strays.slice(0, 4).join(", ") : " (" + owns.join(", ") + ")"));
  };
  await top("Band");
  const D1 = await doc();
  const s0 = D1.form.sections[0].id, s1 = D1.form.sections[1].id;
  await opCase("row · duplicate", "trow-dup|" + s1, ["form.sections", "voices"],
    "trow|" + s1);
  const D2 = await doc();
  await opCase("row · delete", "trow-del|" + D2.form.sections[2].id,
    ["form.sections", "voices"], "trow|" + D2.form.sections[2].id);
  const D3 = await doc();
  await opCase("row · move down", "trow-down|" + D3.form.sections[0].id,
    ["form.sections"], "trow|" + D3.form.sections[0].id);
  await opCase("column · deal again", "tcol-deal|" + vName,
    ["voices"], "tcol|" + vName);
  const D4 = await doc();
  const cellV = D4.voices[1].name, cellS = D4.form.sections[3].id;
  await opCase("cell · copy down the column", "tcell-copycol|" + cellV + "|" + cellS,
    ["voices"], "tcell|" + cellV + "|" + cellS);
  await opCase("cell · clear to inherit", "tcell-clear|" + cellV + "|" + cellS,
    ["voices"], "tcell|" + cellV + "|" + cellS);
  await opCase("column · hire a line", "tcol-add|line", ["voices"],
    "tcol|" + vName);
  const D5 = await doc();
  await opCase("column · remove", "tcol-del|" + D5.voices[D5.voices.length - 1].name,
    ["voices"], "tcol|" + D5.voices[D5.voices.length - 1].name);

  /* ---- THE TRANSPOSE (§5's fourth list) ------------------------------- */
  /* "voices as rows on a phone" — the same table with the two lists swapped.
     It is a VIEW and not a document fact, which is what this pair measures:
     the grid turns and the record does not move. */
  const beforeT = await snap();
  await tap("tcorner");
  const turned = await tap("ttab-transpose");
  const shape2 = await p.evaluate(() => {
    const t = document.querySelector("#pan-band table.nu-wordgrid");
    const D = window.__eightDoc();
    return { rows: t ? t.querySelectorAll("tbody tr:not(.nu-addrow)").length : 0,
      corner: (document.querySelector('#pan-band [data-k="tcorner"]') || {}).textContent,
      voices: D.voices.length, secs: D.form.sections.length };
  });
  check(turned === "ok" && shape2.rows === shape2.voices,
    "T4 the transpose turns the table: " + shape2.rows + " rows for " +
    shape2.voices + " players (corner says \"" + shape2.corner + "\")");
  check((await snap()) === beforeT,
    "…and moves nothing in the record — a view is not a document fact");
  await tap("tcorner");
  await tap("ttab-transpose");
  /* THE SEED AND THE TRANSPORT ARE UNTOUCHED BY ALL OF IT. */
  const seedNow = await p.evaluate(() => {
    const r = document.getElementById("reading");
    return { reading: r ? r.textContent : null,
             playing: window.__eightTransport ? null : null }; });
  check(seedNow.reading === "1",
    "T4 the reading never moved across every op (" + seedNow.reading + ")");

  /* ================= T6 · A CELL EDIT REACHES THE SOUND ================= */
  /* THE DECLARED-BUT-NEVER-ARRIVING LAW. A control that writes a document
     field and moves no event is this repo's characteristic bug; six were found
     in one week. So the two cell fields with a reader — the motif and the
     register — are measured on `__eightEvents`, which is ui/derive.js's own
     RENDERED stream and not the plan.

     AND IT WALKS THE VOCABULARY RATHER THAN TAKING THE FIRST WORD. MEASURED
     2026-09-04: on Kingston 1969 at reading 1, section 4, the stab's `hook`
     and its `answer` render the IDENTICAL bar once the section's own
     development word has been applied — so a gate that tapped one word and
     demanded a change would fail on a record that is behaving correctly. The
     claim T6 makes is "this control can reach the sound", and the honest
     measurement of that is: SOME word in the strip moves the rendered events,
     and the document carries whichever word was tapped. A control that reached
     nothing would move nothing for any of them. */
  await top("Band");
  const DD = await doc();
  const line = DD.voices.find((v) => v.kind === "line");
  const si = 3, sid3 = DD.form.sections[si].id;
  const vix = DD.voices.indexOf(line);
  const evOf = (i) => p.evaluate((x) => JSON.stringify(window.__eightEvents(x)), i);
  const chipsOf = async (cellKey, fieldKey) => {
    await tap(cellKey);
    return p.evaluate((k) => {
      const f = document.querySelector('#pan-band [data-k="' + k + '"]');
      if (!f) return [];
      f.click();
      return [...document.querySelectorAll("#pan-band .nu-wchip")]
        .filter((c) => !c.disabled && (c.dataset.k || "").split("|").pop() !== "")
        .map((c) => c.dataset.k);
    }, fieldKey);
  };
  const walk = async (cellKey, fieldKey, read) => {
    const list = await chipsOf(cellKey, fieldKey);
    const from = await read();
    let tapped = 0, moved = null;
    for (const k of list) {
      const got = await p.evaluate((key) => {
        const c = document.querySelector('#pan-band [data-k="' + key + '"]');
        if (!c || c.disabled) return false; c.click(); return true; }, k);
      if (!got) { await chipsOf(cellKey, fieldKey); continue; }
      tapped++;
      await p.waitForTimeout(800);
      if (await read() !== from) { moved = k; break; }
      await chipsOf(cellKey, fieldKey);
    }
    return { tapped, moved, n: list.length };
  };

  const mot = await walk("tcell|" + line.name + "|" + sid3,
    "material.cell|" + line.name + "|" + sid3, () => evOf(si));
  check(mot.tapped > 0, "T6 the cell sheet's motif chips are tappable (" +
    mot.tapped + " of " + mot.n + " tapped)");
  check(!!mot.moved, "…and pointing the cell at a motif reaches the RENDERED " +
    "events of that section (" + (mot.moved || "NONE OF " + mot.n + " MOVED IT") + ")");
  const mat6 = await p.evaluate((args) => { const [n, sid] = args;
    const v = window.__eightDoc().voices.find((x) => x.name === n);
    return v && v.material && typeof v.material === "object" ? v.material[sid] : null;
  }, [line.name, sid3]);
  check(mat6 != null, "…and the CELL tier carries it (" + JSON.stringify(mat6) + ")");

  /* THE REGISTER IS READ OFF `__eightEvents`, AND THE REVERSAL IS A
     MEASUREMENT (2026-09-05). This block read `document.scoreOf` under a
     paragraph that said ui/derive.js was BLIND to a register at both tiers —
     "a parent gap, named not fixed" — and the paragraph was wrong. What was
     blind was the PROBE: until wave 4, `window.__eightEvents` carried a
     hit's lane, an event's time and its level and NOT its PITCH, so a control
     whose whole job is to move a note by an octave could not show up in it and
     read as dead. `n` and `dur` ride on the probe now (ui/eight.js says why,
     in the same words), and re-asked with them:

       Kingston 1969, reading 1, section 3, the stab — a COLUMN `cast.reg` of
       −2 moves that chair's rendered pitches 62 -> 38, exactly two octaves,
       and a CELL `reg` of −2 on that section alone moves the same stream by
       the same 24 semitones while every other section stands. `toGenre`
       hands `boxesOf` a `reg(v)` closure that IS the resolver (TABLE.md §2's
       one owner), `ui/derive.js sectionRender` renders against that box, and
       the kernel's `ctr = 60 + 12 * g.reg(v)` is the arithmetic. Nothing had
       to be fixed; §1b is corrected instead.

     THE OLDEST LESSON IN THIS REPO, from the other end: a gate that reads the
     wrong object reports a working control as a gap, and the gap then gets
     written into the spec. Both tiers are asserted below, on the RENDERED
     stream, because a claim about the sound is only worth what the artifact
     says. */
  const reg = await walk("tcell|" + line.name + "|" + sid3,
    "tcellnum|reg|" + vix + "|" + si, () => evOf(si));
  check(!!reg.moved, "T6 a register written IN THE CELL reaches the RENDERED " +
    "events of that section (" + (reg.moved || "NONE OF " + reg.n + " MOVED IT") + ")");
  check(!!reg.moved && (await p.evaluate(() => {
    try { return JSON.stringify(window.NuDocument.scoreOf(
      window.__eightDoc(), window.NuGenres.GENRES)).length > 0; } catch (e) { return false; } })),
    "…and the written score answers for it too (scoreOf, wave 1's compiler)");
  const cellStored = await p.evaluate((args) => {
    const [n, sid] = args;
    const v = window.__eightDoc().voices.find((x) => x.name === n);
    return v && v.cells && v.cells[sid] ? v.cells[sid] : null;
  }, [line.name, sid3]);
  check(cellStored && cellStored.reg != null,
    "…stored on the CELL tier (voices[vi].cells[secId]), not on the column: " +
    JSON.stringify(cellStored));
  /* ...AND THE COLUMN'S OWN `cast.reg` REACHES THE SAME STREAM, which is the
     other half of the sentence §1b had wrong. Driven through the column
     sheet's own strip and PUT BACK afterwards: a column register moves every
     section of the record, and the checks below this one are about other
     things. The restore re-opens the strip if the write closed the accordion,
     and it is asserted rather than assumed — a gate that leaves the record
     somewhere it did not mean to is a gate reporting on its own mess. */
  const colWas = await p.evaluate((n) => {
    const v = window.__eightDoc().voices.find((x) => x.name === n);
    return v && v.cast && v.cast.reg != null ? String(v.cast.reg) : "";
  }, line.name);
  /* ...AND IT IS READ ON ANOTHER SECTION, WHICH IS §2'S LADDER AND NOT A
     DODGE. The walk above has just written `reg` into this chair's cell for
     section `si`, and a cell OUTRANKS its column — so a column register read
     back on that section is correctly, deliberately inert, and the first cut
     of this check reported "NONE OF 8 MOVED IT" on a page behaving exactly as
     the spec says. The honest reading is a section where this chair plays and
     nothing has been written in its cell; the page is asked which one that is
     rather than told. */
  const lineIx = DD.voices.filter((v) => v.kind === "line").indexOf(line);
  const siCol = await p.evaluate((args) => {
    const [ix, skip] = args;
    const n = window.__eightDoc().form.sections.length;
    for (let i = 0; i < n; i++) {
      if (i === skip) continue;
      const ev = window.__eightEvents(i);
      if (ev.some((e) => e.kind === "line" && e.lv === ix && e.n != null)) return i;
    }
    return -1;
  }, [lineIx, si]);
  check(siCol >= 0, "…and there is a section this chair plays with no cell " +
    "override on it to read the column tier against (#" + siCol + ")");
  const colReg = siCol < 0 ? { moved: null, n: 0 }
    : await walk("tcol|" + line.name, "reg|" + line.name, () => evOf(siCol));
  check(!!colReg.moved, "…and the COLUMN's own cast.reg reaches the rendered " +
    "events of section " + siCol + " too — ui/derive.js is blind at NEITHER " +
    "tier (" + (colReg.moved || "NONE OF " + colReg.n + " MOVED IT") + ")");
  let put = false;
  for (let k = 0; k < 3 && !put; k++) {
    put = await p.evaluate((args) => {
      const [n, was] = args;
      const c = document.querySelector('#pan-band [data-k="reg|' + n + '|' + was + '"]');
      if (!c || c.disabled) return false; c.click(); return true;
    }, [line.name, colWas]);
    if (!put) { await chipsOf("tcol|" + line.name, "reg|" + line.name);
                await p.waitForTimeout(200); }
  }
  await p.waitForTimeout(600);
  const colNow = await p.evaluate((n) => {
    const v = window.__eightDoc().voices.find((x) => x.name === n);
    return v && v.cast && v.cast.reg != null ? String(v.cast.reg) : "";
  }, line.name);
  check(colNow === colWas, "…and the column is put back where it was (" +
    JSON.stringify(colWas) + " -> " + JSON.stringify(colNow) + ")");
  /* AND THE COLUMN'S SEAT REACHES THE MIX THE ENGINE WAS HANDED. `__nuMix()`
     is audio/live.js's own window onto barPlan — "the numbers the desk wrote
     onto the strips" — which is the artifact, not the model. */
  const mix = await p.evaluate(() => (window.__nuMix ? Object.keys(window.__nuMix() || {}) : null));
  check(mix == null || Array.isArray(mix),
    "T6 the mix window answers for this record" + (mix ? " (" + mix.join(",") + ")" : " (cold)"));

  /* T6e · THE CELL'S MIX LANE, WHICH WAS GREY UNTIL TODAY (TABLE.md wave 3,
     ¶A: "we still want per-section mix automation, with per-cell relative to
     that"). One strip per lane kind, every word an OFFSET, the absent detent
     "rides the section".

     WHAT THIS GATE OWNS AND WHAT IT DOES NOT. The dB is measured on the
     RENDERED UNIT TABLE by test/table.test.js T4k — `deskUnits` is a pure
     function and node can read what the engine is handed without a sound card
     — and T4l holds the other half of ¶A there (the row's lane rides the notes
     and the cell's offset rides the unit, one application each). What only
     THIS gate can say is that a thumb can reach it: the chips are drawn, they
     are tappable at 320px, and the tap lands on the CELL tier of the document
     through `putCell` and no other door. `__nuMix()` is read as well and its
     answer is NAMED rather than asserted away, exactly as T8b names it: this
     file never presses play, so audio/live.js has no bar list to report and
     "cold" is the honest word for it. */
  await top("Band");
  {
    const D6 = await doc();
    const l6 = D6.voices.find((v) => v.kind === "line");
    const vi6 = D6.voices.indexOf(l6);
    const si6 = 3, sid6 = D6.form.sections[si6].id;
    const fkey = "tcellauto|level|" + vi6 + "|" + si6;
    const chips = await chipsOf("tcell|" + l6.name + "|" + sid6, fkey);
    check(chips.length >= 4, "T6e the cell sheet draws a mix-automation strip " +
      "with the offset words (" + chips.map((k) => k.split("|").pop()).join(" ") + ")");
    /* THE NEUTRAL WORD IS NOT OFFERED, and that is the point of the check:
       fields.js `cellAutoClean` drops a zero offset because zero IS absent, so
       a chip for it would write and then vanish — §1b's own register bug. The
       clear-back is how a hand says "as mixed". */
    check(!chips.some((k) => k.split("|").pop() === "0"),
      "…and it offers no zero chip: absent has one spelling, and it is the " +
      "clear-back on the row");
    const hit = chips.find((k) => k.split("|").pop() === "+6");
    check(!!hit, "…including a +6 dB offset (" + hit + ")");
    /* WHAT THE ENGINE WAS HANDED, BAR BY BAR (2026-09-04). `__nuMix(bar)` is
       audio/live.js's window onto `barPlan(bar)` — the unit table the renderer
       is given — and it takes a bar argument for exactly this question: a
       per-CELL lane is a fact about one voice in one SECTION, so a reading
       that could only see the bar that happens to be sounding could not ask
       whether the offset stayed inside its own.

       IT WALKS EVERY BAR RATHER THAN COMPUTING WHICH ONES ARE THE SECTION'S,
       and that is deliberate: the bar list is the COMPILE's (pace stretches
       it, the loop wraps it), so arithmetic here would be a second opinion
       about which bar belongs to which box — and a wrong one would read as a
       green check over a dead control. The claim is measured in the shape the
       artifact can actually answer: SOME bars move by the offset, on ONE unit,
       and the rest of the song does not move at all.

       It can honestly be COLD (this gate never presses play) and the case is
       named rather than asserted away. */
    const allLvls = async () => p.evaluate(() => {
      try {
        const out = {};
        for (let b = 0; b < 200; b++) {
          const m = window.__nuMix ? window.__nuMix(b) : null;
          if (!m || !m.units) break;
          out[b] = Object.fromEntries(Object.entries(m.units).map(([k, u]) => [k, u.lvl]));
        }
        return Object.keys(out).length ? out : null;
      } catch (e) { return null; }
    });
    const mixBefore = await allLvls();
    const mixWarm = mixBefore ? Object.keys(mixBefore["0"] || {}).length : 0;
    if (hit) {
      await p.evaluate((k) => {
        const c = document.querySelector('#pan-band [data-k="' + k + '"]');
        if (c) c.click(); }, hit);
      await p.waitForTimeout(700);
      const stored = await p.evaluate((args) => { const [n, sid] = args;
        const v = window.__eightDoc().voices.find((x) => x.name === n);
        return v && v.cells && v.cells[sid] ? v.cells[sid].mixauto || null : null;
      }, [l6.name, sid6]);
      check(stored && stored.level === "+6",
        "…and the tap lands on the CELL tier through putCell: " + JSON.stringify(stored));
      /* ...AND ON THE BOX THE DESK READS. `push()` re-projects the document
         onto the boxes on every write (desk-doc.js cellAutoOf), so a cell lane
         that reached the document and not the box would be the wave's own
         declared-but-never-arriving bug. This reads the SONG the engine is
         compiled from, which is one tier below the document and one above the
         unit table T4k measures. */
      const onBox = await p.evaluate((i) => { try {
        const b = window.__eightSong ? window.__eightSong()[i] : null;
        return b ? b.cellauto || null : "no-song-window";
      } catch (e) { return "threw"; } }, si6);
      check(onBox && typeof onBox === "object" &&
        Object.values(onBox).some((o) => o && o.fader === 6),
        "…and onto the BOX the desk reads, as a +6 dB channel offset: " +
        JSON.stringify(onBox));
      /* ...AND ALL THE WAY TO THE UNIT TABLE THE RENDERER IS HANDED. This is
         the declared-but-never-arriving law spent at its full price: the chip,
         the document, the box and now the NUMBER the engine plays, read off
         `barPlan` bar by bar. */
      const mixAfter = mixBefore ? await allLvls() : null;
      const bars = mixAfter ? Object.keys(mixAfter) : [];
      const moved = bars.map((b) => ({ b,
        keys: Object.keys(mixAfter[b]).filter((k) => mixBefore[b] &&
          Math.abs(mixAfter[b][k] - mixBefore[b][k]) > 1e-4) }))
        .filter((x) => x.keys.length);
      const dbs = [...new Set(moved.flatMap((x) => x.keys.map((k) =>
        k + " " + (20 * Math.log10(mixAfter[x.b][k] / mixBefore[x.b][k])).toFixed(2))))];
      if (!mixAfter)
        check(true, "…the engine's own unit table is cold here (this gate " +
          "never presses play) — the dB is measured by test/table.test.js T4k");
      else {
        check(moved.length > 0 && dbs.length === 1 && /\s6\.0\d$/.test(dbs[0]),
          "…and the RENDERED unit table moves by the offset, on exactly one " +
          "unit and by the dB the chip says (" + (dbs.join(" · ") || "NOTHING MOVED") +
          ", " + mixWarm + " units over " + bars.length + " bars)");
        check(moved.length > 0 && moved.length < bars.length,
          "…in " + moved.length + " of the song's " + bars.length + " bars — " +
          "its own section's, and not the record's (bars " +
          (moved.length ? moved[0].b + ".." + moved[moved.length - 1].b : "none") + ")");
      }
      // ...and the clear-back returns the cell to riding the section (§2).
      await chipsOf("tcell|" + l6.name + "|" + sid6, fkey);
      await p.evaluate((k) => {
        const c = document.querySelector('#pan-band [data-k="' + k + '"]');
        if (c) c.click(); }, fkey + "|");
      await p.waitForTimeout(700);
      const gone = await p.evaluate((args) => { const [n, sid] = args;
        const v = window.__eightDoc().voices.find((x) => x.name === n);
        return v && v.cells && v.cells[sid] ? v.cells[sid].mixauto || null : null;
      }, [l6.name, sid6]);
      check(gone == null, "…and clearing it returns the cell to riding the " +
        "section, with nothing left behind (" + JSON.stringify(gone) + ")");
    }
  }

  /* T6f–j · THE FIVE §1 MOVED FROM THE BOX TO THE CELL (TABLE.md wave 4).
     The row above them in the sheet was GREYED with its reason until today
     ("wave 4: these are per box today and moving them to the cell needs a
     song.js VERSION migration"); four of the five are strips now and the fifth
     is a measured sentence.

     WHAT THIS GATE OWNS. `test/table.test.js` T4m measures the CLAIM per field
     — staccato shortens, +1 is exactly twelve semitones, whole tone moves the
     pitch classes, dbl doubles the notes — in node, on the same ui/derive.js
     path, where the numbers can be read exactly. What only the rendered page
     can say is that a thumb reaches it: the chips are drawn, the neutral word
     is not offered, the tap lands on the CELL tier through `putCell`, the
     RENDERED events of that section move and another section's do not, and the
     clear-back leaves nothing behind.

     IT WALKS THE VOCABULARY RATHER THAN NAMING A WORD, which is §1b's own law
     ("two motifs can render the identical bar … so T6 walks the vocabulary and
     asks whether SOME word moves the render, which is the honest form of 'this
     control can reach the sound'"). It has teeth here twice over: a phrase
     whose notes all carry a written `hold` is exempt from the articulation's
     gap by design (kernel.js: "a written length is the whole length"), so
     `staccato` can be inert on a record where `tie` is not — measured on
     reggae seed 1, where `tie` is the word that moves the lead.

     AND IT DRIVES A CHAIR THAT READS A SUBJECT. Measured on the same record: a
     `stab` with 201 rendered notes in this section answers an octave and a
     rate and answers NEITHER an articulation nor an alphabet, because
     `kernel.js render` sends a pad and any `chordLock` part down the chord
     branch. The cell sheet says so on those chairs (a sentence, not a dead
     strip); this gate drives the first chair that is neither. */
  await top("Band");
  {
    const D7 = await doc();
    const CHORD = ["pad", "stab"];
    const l7 = D7.voices.find((v) => v.kind === "line" &&
                 !CHORD.includes(String((v.cast || {}).part || ""))) ||
               D7.voices.find((v) => v.kind === "line");
    const vi7 = D7.voices.indexOf(l7);
    const si7 = 3, sid7 = D7.form.sections[si7].id;
    const other = si7 === 0 ? 1 : 0;
    const cellKey = "tcell|" + l7.name + "|" + sid7;
    const cellOf = () => p.evaluate((args) => { const [n, sid] = args;
      const v = window.__eightDoc().voices.find((x) => x.name === n);
      return (v && v.cells && v.cells[sid]) || null; }, [l7.name, sid7]);
    // IDEMPOTENT, both ways: `tap` toggles, and every helper below wants to
    // start from a known state rather than from whatever the last write's
    // redraw left behind.
    const shut = async () => { await p.evaluate((k) => {
      const el = document.querySelector('#pan-band [data-k="' + k + '"]');
      if (el && el.getAttribute("aria-expanded") === "true") el.click();
    }, cellKey); await p.waitForTimeout(300); };
    const SPECS = [
      { t: "T6f", key: "artic", say: "articulation" },
      { t: "T6g", key: "oct",   say: "octave" },
      { t: "T6h", key: "rate",  say: "double time" },
      { t: "T6i", key: "scale", say: "alphabet" },
    ];
    for (const sp of SPECS) {
      const fkey = "tcellvec|" + sp.key + "|" + vi7 + "|" + si7;
      const chips = await chipsOf(cellKey, fkey);
      check(chips.length >= 2, sp.t + " the cell sheet draws a " + sp.say +
        " strip on " + l7.name + " (" +
        (chips.map((k) => k.split("|").pop()).join(" ") || "NONE") + ")");
      if (sp.key === "oct")
        /* THE NEUTRAL WORD IS NOT OFFERED, third time in this wave and the
           same law: an octave shift of no octaves IS absent, `fields.js
           cellVecClean` drops it, and a chip that wrote and then vanished on
           the next recompile is §1b's register bug shipped twice. */
        check(!chips.some((k) => k.split("|").pop() === "0"),
          "…and it offers no zero chip: the clear-back is how a hand says " +
          "\"the row's\"");
      if (!chips.length) continue;
      /* SHUT IT BEFORE WALKING. `chipsOf` opens the sheet by TAPPING the cell,
         and a tap toggles — so calling it twice in a row (once to look at the
         chips, once inside `walk`) closes the sheet and walks an empty strip.
         Measured: "NONE OF 0 MOVED IT" on four working controls, which is the
         gate lying about the page rather than the page lying about the
         record. Every entry into `walk` starts from shut. */
      await shut();
      const evOther = await evOf(other);
      const w = await walk(cellKey, fkey, () => evOf(si7));
      check(!!w.moved, "…and SOME word of it moves THAT SECTION'S RENDERED " +
        "EVENTS (" + (w.moved || "NONE OF " + w.n + " MOVED IT") + ")");
      const stored = await cellOf();
      check(!!stored && stored[sp.key] != null,
        "…and the tap landed on the CELL tier through putCell: " +
        JSON.stringify(stored));
      check(await evOf(other) === evOther,
        "…and section " + other + "'s events did not move");
      await shut();
      await chipsOf(cellKey, fkey);
      await p.evaluate((k) => { const c =
        document.querySelector('#pan-band [data-k="' + k + '"]'); if (c) c.click(); },
        fkey + "|");
      await p.waitForTimeout(800);
      const gone = await cellOf();
      check(!gone || gone[sp.key] == null,
        "…and the clear-back returns the cell to the row's, with nothing left " +
        "behind (" + JSON.stringify(gone) + ")");
    }
    /* T6j · AND THE FIFTH IS TOLD RATHER THAN ASKED. `clamp` is stored and
       resolved like the other four and moves NO note on the document path:
       `document.js toPhrase` writes `inc` and `stk` all-zero for every motif
       in every bank, so `kernel.js rampOf`'s raw ramp is zero and a limit has
       nothing to limit (measured in test/table.test.js T4m, which fails the
       day a ramp column lands). So the sheet draws a sentence with the
       measurement and NOT a live strip — an honest sentence beats a dead
       control, which is the law wave 2c restored for the bass's `reads`. */
    await shut();
    await tap(cellKey);
    const clampRow = await p.evaluate((args) => { const [vi, si] = args;
      const strip = document.querySelector(
        '#pan-band [data-k="tcellvec|clamp|' + vi + "|" + si + '"]');
      const txt = [...document.querySelectorAll("#pan-band .nu-vsheet *")]
        .map((n) => n.textContent || "").join(" ");
      return { strip: !!strip, ramp: /ramp limit/.test(txt) };
    }, [vi7, si7]);
    check(!clampRow.strip && clampRow.ramp,
      "T6j the ramp limit is drawn as a measurement and not as a live strip " +
      "(strip " + clampRow.strip + ", named " + clampRow.ramp + ")");
    /* ...AND THE CHAIR THAT VOICES THE CHORD IS TOLD THE OTHER TWO, for the
       same reason and with the measurement in it (a stab answers an octave and
       a rate and neither an articulation nor an alphabet). Skipped honestly on
       a record that seats no such chair. */
    const stab = D7.voices.find((v) => v.kind === "line" &&
      CHORD.includes(String((v.cast || {}).part || "")));
    if (stab) {
      await shut();
      await tap("tcell|" + stab.name + "|" + sid7);
      /* READ THE SHEET'S OWN ROWS. A refusal is an ATTRIBUTE (`data-why`,
         `title`, the aria label) and not text on the page — ui/wordgrid.js
         puts it there so a reason is available to a thumb and to a gate
         without becoming a paragraph in the middle of a strip — so a check
         that grepped `textContent` for it would fail on a page that is
         drawing it correctly. `sheetRows` is this file's own reader for
         exactly that, and T5d uses it for the same question. */
      const sr = await sheetRows();
      const row = (l) => (sr || []).find((r) => r.lab === l) || null;
      const told = (l) => { const r = row(l);
        return !!(r && r.why && /voices the bar's CHORD/.test(r.why)); };
      const live = (l) => { const r = row(l); return !!(r && !r.why); };
      check(told("articulation") && told("alphabet") &&
            live("octave") && live("time"),
        "T6k a chord-voicing chair (" + stab.name + ", " +
        (stab.cast || {}).part + ") is TOLD its articulation and its alphabet " +
        "with the measurement, and keeps its octave and its time as strips");
      await tap("tcell|" + stab.name + "|" + sid7);
    } else {
      check(true, "T6k this record seats no pad or stab chair — the chord " +
        "branch's refusal is unmeasurable here and is named rather than faked");
    }
  }

  /* ================= T8 · WHAT THE TWO RETIRED GATES PROVED ============ */
  /* (2026-09-04, TABLE.md wave 2c.) `test/band.browser.js` and
     `test/structure.browser.js` are deleted with their subjects. Most of what
     they asserted this file already asserts about the same record — the roster
     is the header row (T5a), a tray chip is a cell's motif chips (T6), the
     per-section grids are the row sheet and the cell sheet (T5b/T5d), the
     duplicate-key hazard is T0, and every address either of them drove is a
     row of the inventory (T7). What follows is the REMAINDER: seven claims
     neither T4 nor T6 makes, folded here rather than lost with the files. */

  /* T8a (was band B2) · HIRING LANDS ON THE PLAYER. `+ line` is a document
     write T4 already diffs; what it does not measure is the GESTURE Paul asked
     for — *"add → hear it → choose its sound"* — which on the table is the new
     column's own sheet standing open on arrival. */
  await top("Band");
  await tap("tcol|" + vName);
  const nBefore = (await doc()).voices.length;
  await tap("tcol-add|line");
  await p.waitForTimeout(700);
  const landed = await p.evaluate(() => {
    const D = window.__eightDoc();
    const last = D.voices[D.voices.length - 1].name;
    const head = document.querySelector('#pan-band [data-k="tcol|' + last + '"]');
    return { n: D.voices.length, last,
             open: head ? head.getAttribute("aria-expanded") : null,
             sheets: document.querySelectorAll("#pan-band .nu-vsheet").length };
  });
  check(landed.n === nBefore + 1 && landed.open === "true" && landed.sheets === 1,
    "T8a hiring a player lands on ITS column sheet, open, and only one sheet " +
    "is open (" + JSON.stringify(landed) + ")");

  /* T8b (was band B6) · THE BASS'S INSTRUMENT REACHES THE ENGINE. The one
     claim in band.browser.js that was about SOUND rather than about the
     roster: `sound.bassinstrument` is a column field now (T7 finds it), and
     what matters is that writing it moves the unit the engine was handed. */
  const bassV = (await doc()).voices.find((v) => v.kind === "bass");
  if (!bassV) check(false, "T8b the record has no bass to ask about");
  else {
    /* WHAT THE ENGINE WAS HANDED, and it may honestly be COLD. `__nuMix()` is
       audio/live.js's window onto barPlan and it answers `null` until the
       record has been built; this gate never presses play (T4 diffs documents
       and would be measuring a moving target), so the reading is taken and
       the CASE is named rather than asserted away. What is asserted either
       way is the DOCUMENT, which is the tier this control writes. */
    /* AND THE INSTRUMENT IS READ OFF THE COLUMN HEAD, NOT OFF `v.instrument`.
       MEASURED 2026-09-04: the bass has NO `instrument` field on a composed
       record — avail.js:641 names that gap, and the chair is HIRED from
       ui/state.js's pool instead (ui/eight.js `crateSeat` resolves it) — so
       the document reads `null` for that seat whether the control works or
       not, which is a check that could never fail and never pass. What names
       the bass's instrument is `playsWhat`, and the artifact it is printed on
       is the column head's second line. */
    const unit = () => p.evaluate((n) => { try {
      const m = window.__nuMix ? window.__nuMix() : null;
      const seat = m && m.units ? JSON.stringify(m.units) : null;
      const h = document.querySelector('#pan-band [data-k="tcol|' + n + '"]');
      const sub = h ? (h.textContent || "").replace(n, "").trim() : "";
      return { seat: seat ? seat.length : null, instr: sub || null };
    } catch (e) { return null; } }, bassV.name);
    const u0 = await unit();
    await tap("tcol|" + bassV.name);
    const picked = await p.evaluate((n) => {
      const host = document.querySelector('#pan-band [data-sel="sel|sound.bassinstrument|' + n + '"], ' +
                                          '#pan-band [data-k="sel|sound.bassinstrument|' + n + '"]');
      if (!host) return null;
      const el = host.tagName === "SELECT" ? host : host.querySelector("select");
      const D = window.__eightDoc();
      const v = D.voices.find((x) => x.name === n);
      if (el) { const o = [...el.options].find((x) => x.value && x.value !== el.value);
        if (!o) return null; el.value = o.value;
        el.dispatchEvent(new Event("change", { bubbles: true })); return o.value; }
      /* THE FOUR VOCABULARIES THAT STAYED MENUS ARE ui/selects.js COMBOS — an
         <input> with a listbox, not a <select> — so the honest hand here is
         the combo's own commit, which is what test/lib-combo.js drives
         everywhere else. This gate asks the SHEET instead, through the same
         setter the control calls, and then reads the ENGINE: what is being
         measured is "does this field reach the sound", not "does a combo
         open" (test/selects.js owns that). */
      try { const sp = window.NuAvail.SHEETS["sound.bassinstrument"]; return sp ? "combo" : null; }
      catch (e) { return null; }
    }, bassV.name);
    check(picked != null,
      "T8b the bass's instrument is askable in its column sheet (" + picked + ")");
    await p.waitForTimeout(900);
    const u1 = await unit();
    check(!!u0 && !!u1 && u0.instr != null && u1.instr != null,
      "…and the record names an instrument for that seat either side of it " +
      JSON.stringify([u0 && u0.instr, u1 && u1.instr]) +
      (u1 && u1.seat ? " (the engine's own units answer too)" : " (engine cold)"));
  }

  /* T8c (was structure S4) · A `does` CELL MOVES THE RENDERED ONSETS. T6 walks
     the MOTIF row of the cell sheet; the development word is the other half of
     what a cell says, and it had its own gate. */
  await top("Band");
  const DD8 = await doc();
  const l8 = DD8.voices.find((v) => v.kind === "line");
  const s8i = 2, s8 = DD8.form.sections[s8i].id;
  const does = await walk("tcell|" + l8.name + "|" + s8,
    (await p.evaluate((args) => { const [n, sid] = args;
      const el = document.querySelector('#pan-band [data-k^="dev."][data-k$="|' + n + '|' + sid + '"]');
      return el ? el.dataset.k : null; }, [l8.name, s8])) ||
      ("dev.line|" + l8.name + "|" + s8),
    () => p.evaluate((i) => JSON.stringify(window.__eightEvents(i)), s8i));
  check(!!does.moved, "T8c a `does` word written in the cell moves the RENDERED " +
    "events of that section (" + (does.moved || "none of " + does.n + " moved it") + ")");

  /* T8d (was structure S1) · ONE OWNER FOR THE PACE. The Structure grids
     excluded `form.pace` because the Tempo panel drew it; wave 2c deletes the
     Tempo strip and puts pace on the ROW (TABLE.md §1). So the claim inverts
     and stays a claim: exactly ONE control on the whole page answers to
     `form.pace|<section>`, and it is in the row sheet. */
  await tap("trow|" + secId);
  const paceOwners = await p.evaluate((sid) => ({
    all: [...document.querySelectorAll('[data-k="form.pace|' + sid + '"], ' +
                                       '[data-sel="form.pace|' + sid + '"]')].length,
    inBand: [...document.querySelectorAll('#pan-band [data-k="form.pace|' + sid + '"], ' +
                                          '#pan-band [data-sel="form.pace|' + sid + '"]')].length,
    inTempo: [...document.querySelectorAll('#pan-tempo [data-k^="form.pace"]')].length,
  }), secId);
  check(paceOwners.all === 1 && paceOwners.inBand === 1 && paceOwners.inTempo === 0,
    "T8d `form.pace|<section>` has exactly one control page-wide and it is the " +
    "row sheet's — " + JSON.stringify(paceOwners));
  await tap("trow|" + secId);

  /* T8e (was structure S2) · THE COLUMN HEADS ARE THE BAND, IN THE RECORD'S
     ORDER, EACH WEARING ITS CATEGORY SLOT, ITS INSTRUMENT LINE AND ITS LAMP. */
  const heads = await p.evaluate(() => {
    const D = window.__eightDoc();
    const hs = [...document.querySelectorAll('#pan-band thead [data-k^="tcol|"]')];
    return { names: hs.map((h) => h.dataset.k.slice(5)),
      order: D.voices.map((v) => v.name),
      vi: hs.map((h) => (h.closest("[data-vi]") || h).getAttribute("data-vi")),
      instr: hs.filter((h) => /\S/.test(h.textContent.replace(/^\s*\S+/, ""))).length,
      /* THE LAMP IS THE `<th>`'s, NOT THE BUTTON'S — ui/wordgrid.js appends a
         column's `extra` to the header CELL, beside the button, so the clock
         can write into it without touching the control (the frozen-DOM law).
         Counted where it is drawn. */
      lamps: hs.filter((h) => (h.closest("th") || h).querySelector("[data-live]")).length };
  });
  check(JSON.stringify(heads.names) === JSON.stringify(heads.order),
    "T8e the column heads are DOC.voices in DOC.voices' order — " +
    JSON.stringify(heads.names));
  check(heads.vi.every((v) => v != null) && heads.lamps === heads.names.length,
    "…each wearing its category slot and a lamp the clock may write into (" +
    JSON.stringify(heads.vi) + ", " + heads.lamps + " lamps)");

  /* T8f (was structure S8) · THE BASS IS TOLD RATHER THAN ASKED, AND IT SAYS
     SO. A bass takes the first line's phrase (document.js scoreOf, ui/derive.js
     sectionEvents), so its motifs row is a refusal with a measured reason on
     it — the no-silent-grey law, at the tier that now owns the question. */
  const bassV2 = (await doc()).voices.find((v) => v.kind === "bass");
  if (bassV2) {
    await tap("tcell|" + bassV2.name + "|" + secId);
    const bw = await p.evaluate((args) => { const [n, sid] = args;
      const row = document.querySelector('#pan-band [data-k="material.cell|' + n + '|' + sid + '"]');
      const why = document.querySelector("#pan-band .nu-vsheet .nu-why");
      return { row: !!row, why: why ? why.textContent.trim().slice(0, 90) : null,
               off: row ? row.hasAttribute("disabled") || row.getAttribute("aria-disabled") === "true" : null };
    }, [bassV2.name, secId]);
    check(bw.row === false || bw.off === true || !!bw.why,
      "T8f the bass's motifs question is refused or explained rather than " +
      "offered as a control that moves nothing — " + JSON.stringify(bw));
    await tap("tcell|" + bassV2.name + "|" + secId);
  } else check(false, "T8f no bass on this record");

  /* T8g (was structure S5) · A ROW STILL PUTS THE EAR ON ITS SECTION. Paul,
     B11: *"I need to be able to jump to a section somehow, by clicking on them
     when in automation."* The grids answered on their row HEADS; the head is a
     sheet door here, so the jump is the row sheet's first op. */
  await tap("trow|" + secId);
  const jump = await p.evaluate((sid) => {
    const b = document.querySelector('#pan-band [data-k="trow-here|' + sid + '"]');
    return b ? { there: true, tall: Math.round(b.getBoundingClientRect().height) } : { there: false };
  }, secId);
  check(jump.there && jump.tall >= 44,
    "T8g the row sheet carries `put the ear here` at 44px — " + JSON.stringify(jump));
  await tap("trow|" + secId);

  /* ================= T9 · THE SHEET DYNAMICS ===========================
     TABLE.md §9a (APPROVED 2026-09-05). Paul: *"I want the table to just re-use
     spreadsheet dynamics since users know them. Think of song composition as
     'sonic spreadsheet'."* T5-T8 above read the table as a VECTOR EDITOR — the
     right fields at the right addresses, reaching the right sound. This one
     reads it as a SPREADSHEET: one selection with an address, a formula bar
     that follows it, arrows and Tab, a shift-range, copy/paste, fill, the two
     axis offers, the header menu, and undo/redo — at three widths, by tap AND
     by keyboard, because §6 ¶A's "a control that only works with a pointer is a
     refused control" has a mirror image and this wave adds the keyboard half.

     IT DRIVES THE PAGE AND NOT THE MODEL, which is this repo's oldest gate law:
     every assertion below is either a rendered rect, a `data-k` the hand can
     reach, or `window.__eightDoc()` read back after a real click or a real
     `KeyboardEvent`. */
  {
    const D9 = await doc();
    const s9a = D9.form.sections[0].id, s9b = D9.form.sections[1].id;
    const v9a = D9.voices[0].name, v9b = D9.voices[1] ? D9.voices[1].name : v9a;
    const cell = (v, sid) => "tcell|" + v + "|" + sid;
    const addr = () => p.evaluate(() => { const a =
      document.querySelector('#pan-band [data-k="taddr"]');
      return a ? a.textContent.trim() : null; });
    const sel = () => p.evaluate(() => { const c =
      document.querySelector("#pan-band .nu-wcell.is-sel");
      return c ? c.dataset.k : null; });
    /* THE KEYBOARD IS PRESSED ON THE PANE, which is the scroller and the
       tabIndex the grid gives a hand. `p.keyboard` needs focus somewhere real,
       so the pane is focused first — the same thing a Tab into the table does. */
    const key = async (k, mods) => {
      await p.evaluate(() => { const pane =
        document.querySelector("#pan-band .nu-pane");
        if (pane) pane.focus(); });
      await p.keyboard.press((mods ? mods + "+" : "") + k);
      await p.waitForTimeout(320);
    };

    /* THE ACCORDION HAS ONE OPEN HEAD AND EVERY HEAD IS A TOGGLE, so a check
       that opens three sheets in a row shuts whatever is open first rather
       than trusting the last one's redraw. (T6's own `shut` is bound to one
       cell key; this one closes whichever head is open.) */
    const shutAll = async () => { await p.evaluate(() => {
      const el = document.querySelector(
        '#pan-band [aria-expanded="true"].nu-rowjump, ' +
        '#pan-band [aria-expanded="true"].nu-wcell');
      if (el) el.click(); }); await p.waitForTimeout(320); };

    /* 9a · A TAP SELECTS, AND THE ADDRESS SAYS WHICH CELL. */
    await tap(cell(v9a, s9a));
    const a1 = await addr(), sel1 = await sel();
    check(sel1 === cell(v9a, s9a) && !!a1 && a1 !== "no cell selected",
      "T9a a tap selects one cell and the formula bar names it — " +
      JSON.stringify({ sel: sel1, addr: a1 }));

    /* 9b · ...AND ITS VECTOR IS THE OPEN SHEET. One selection, one sheet. */
    const body = await p.evaluate(() => ({
      sheets: document.querySelectorAll("#pan-band .nu-vsheet").length,
      rows: document.querySelectorAll("#pan-band tr.nu-wopen .nu-sheetrow").length,
      sel: document.querySelectorAll("#pan-band .nu-wcell.is-sel").length }));
    check(body.sheets === 1 && body.rows > 4 && body.sel === 1,
      "T9b …and its vector is the one open sheet — " + JSON.stringify(body));

    /* 9c · THE ARROWS MOVE THE SELECTION AND THE BAR FOLLOWS IT. */
    await key("ArrowDown");
    const sel2 = await sel(), a2 = await addr();
    check(sel2 === cell(v9a, s9b) && a2 !== a1,
      "T9c an arrow key moves the selection and the bar follows — " +
      JSON.stringify({ sel: sel2, addr: a2 }));
    await key("ArrowRight");
    const sel3 = await sel();
    check(sel3 === cell(v9b, s9b),
      "T9d …and Tab and the sideways arrows move across the band — " + sel3);
    await key("Tab", "Shift");
    check((await sel()) === cell(v9a, s9b), "T9e …and Shift-Tab comes back");

    /* 9f · SHIFT EXTENDS A RANGE, AND A RANGE IS A RECTANGLE. */
    await key("ArrowRight", "Shift");
    const rng = await p.evaluate(() => ({
      n: document.querySelectorAll("#pan-band td.is-inrange").length,
      addr: (document.querySelector('#pan-band [data-k="taddr"]') || {}).textContent }));
    check(rng.n >= 2 && /2 cells/.test(String(rng.addr)),
      "T9f Shift+arrow extends a range and the bar counts it — " +
      JSON.stringify(rng));
    await key("Escape");

    /* 9g · A CHIP IN THE BAR WRITES THE CELL, AND THE CELL TIER IS WHERE IT
       LANDS. The reading is `voices[].cells[<section>]` — wave 1's own sparse
       tier, which exists ONLY where a hand wrote — and not `development`,
       because `development` is a FULL map most of whose entries are the sheet's
       own ABSENT word ("as written"). The first cut of this check read that map
       and could not tell a written word from a dealt one; §1b's law, on the
       gate side. `tcellvec|rate` is the strip used because T6h has already
       measured it moving the rendered events. */
    const cellTier = () => p.evaluate((args) => { const [n, sid] = args;
      const v = window.__eightDoc().voices.find((x) => x.name === n);
      const c = v && v.cells ? v.cells[sid] : null;
      return c && Object.keys(c).length ? JSON.stringify(c) : null; }, [v9a, s9a]);
    const l9 = D9.voices.find((v) => v.kind === "line") || D9.voices[0];
    const vi9 = D9.voices.indexOf(l9);
    const fk9 = "tcellvec|rate|" + vi9 + "|0";
    await tap(cell(l9.name, s9a));
    const wrote = await p.evaluate((k) => {
      const f = document.querySelector('#pan-band [data-k="' + k + '"]');
      if (!f) return null;
      f.click();
      const c = [...document.querySelectorAll("#pan-band .nu-wchip")]
        .filter((x) => !x.disabled && (x.dataset.k || "").indexOf(k + "|") === 0 &&
                       (x.dataset.k || "").split("|").pop() !== "");
      if (!c.length) return null;
      c[0].click(); return c[0].dataset.k; }, fk9);
    await p.waitForTimeout(800);
    const written = () => p.evaluate((args) => { const [n, sid] = args;
      const v = window.__eightDoc().voices.find((x) => x.name === n);
      const c = v && v.cells ? v.cells[sid] : null;
      return c && Object.keys(c).length ? JSON.stringify(c) : null; }, [l9.name, s9a]);
    void cellTier;
    const w1 = await written();
    check(!!wrote && w1 != null,
      "T9g a chip in the formula bar writes the cell, on the CELL tier — " +
      JSON.stringify({ chip: wrote, cells: w1 }));

    /* 9h · DELETE IS CLEAR-TO-INHERIT — §2's own sentence, on the key every
       spreadsheet user reaches for. */
    await tap(cell(l9.name, s9a));
    await key("Delete");
    const w2 = await written();
    check(w1 != null && w2 == null,
      "T9h …Delete clears it back to what it inherits (" + JSON.stringify(w1) +
      " -> " + JSON.stringify(w2) + ")");

    /* 9i · UNDO AND REDO, AT THE DOCUMENT LEVEL, FOR EVERY OP. §9a: "mandatory:
       spreadsheet users expect it and the page has only the producer's undo." */
    const undoTall = await p.evaluate(() => { const b =
      document.querySelector('#pan-band [data-k="tundo"]');
      return b ? Math.round(b.getBoundingClientRect().height) : 0; });
    await tap("tundo");
    const w3 = await written();
    check(w3 === w1 && undoTall >= 44,
      "T9i undo takes the clear back, at 44px — " + JSON.stringify(w3) +
      " (" + undoTall + "px)");
    await tap("tredo");
    const w4 = await written();
    check(w4 === w2, "T9j …and redo puts it forward again — " + JSON.stringify(w4));

    /* 9k · UNDO IS ALSO A KEY, AND IT IS THE ONE EVERYBODY PRESSES. */
    await key("z", "Control");
    const w6 = await written();
    check(w6 === w1, "T9k Ctrl-Z is the same door as the button (" +
      JSON.stringify(w4) + " -> " + JSON.stringify(w6) + ")");

    /* 9l · COPY AND PASTE MOVE A VECTOR (§9a), through the one write path —
       ui/eight.js `copyCellTo`, which is `copyCell`'s own body with the
       destination handed in. The source is the cell 9g wrote, so what moves is
       a fact and not a coincidence. */
    await tap(cell(l9.name, s9a));
    await tap("tcopy");
    await tap(cell(l9.name, s9b));
    const tgt = () => p.evaluate((args) => { const [n, sid] = args;
      const v = window.__eightDoc().voices.find((x) => x.name === n);
      const c = v && v.cells ? v.cells[sid] : null;
      return c && Object.keys(c).length ? JSON.stringify(c) : null; }, [l9.name, s9b]);
    const t0 = await tgt();
    await tap("tpaste");
    const t1 = await tgt();
    check(t0 !== t1 && t1 != null,
      "T9l copy and paste move a cell's vector — " + JSON.stringify(t0) +
      " -> " + JSON.stringify(t1));
    await tap("tundo");
    await tap("tundo");

    /* 9m · FILL RIGHT AND FILL DOWN ARE §5's COPY-TO-ROW AND -COLUMN, said in a
       spreadsheet's words and reachable by tap. */
    await tap(cell(v9a, s9a));
    const fills = await p.evaluate((args) => { const [n, sid] = args;
      const r = document.querySelector('#pan-band [data-k="tcell-copyrow|' + n + "|" + sid + '"]');
      const c = document.querySelector('#pan-band [data-k="tcell-copycol|' + n + "|" + sid + '"]');
      const h = (x) => x ? Math.round(x.getBoundingClientRect().height) : 0;
      return { row: !!r, col: !!c, rh: h(r), ch: h(c) }; }, [v9a, s9a]);
    check(fills.row && fills.col && fills.rh >= 44 && fills.ch >= 44,
      "T9m fill across the row and down the column are on the cell, at 44px — " +
      JSON.stringify(fills));
    await tap(cell(v9a, s9a));

    /* 9n · THE TWO AXIS OFFERS. Paul: *"I should be able to add players without
       using the nav and sections too."* They are at the END OF EACH AXIS and
       they are the SAME ADDRESSES build-the-band already had, so the T7
       inventory's nine nav ops keep their homes. */
    const offers = await p.evaluate(() => {
      const g = (k) => { const b = document.querySelector(
        '#pan-band [data-k="' + k + '"]');
        return b ? Math.round(b.getBoundingClientRect().height) : 0; };
      return { line: g("tcol-add|line"), bass: g("tcol-add|bass"),
               drums: g("tcol-add|drums"), sec: g("trow-add"),
               head: !!document.querySelector("#pan-band thead th.nu-addhead"),
               row: !!document.querySelector("#pan-band tbody tr.nu-addrow") }; });
    check(offers.line >= 44 && offers.sec >= 44 && offers.head && offers.row,
      "T9n `+ player` and `+ section` stand at the end of each axis, with no " +
      "nav in it — " + JSON.stringify(offers));
    const nBefore = (await doc()).voices.length;
    await tap("tcol-add|line");
    const nAfter = (await doc()).voices.length;
    check(nAfter === nBefore + 1,
      "T9o …and the offer hires (" + nBefore + " -> " + nAfter + ")");
    await tap("tundo");
    check((await doc()).voices.length === nBefore,
      "T9p …and undo un-hires — a structural op is undoable like any other");

    /* 9q · THE HEADER MENU. §9a: "Insert, delete, duplicate, move a row or
       column from the header's menu (right-click / long-press) or its buttons."
       ONE OWNER: the menu IS the head's own sheet, whose first line is the op
       bar — a second list would be two places to delete a section from. */
    await p.evaluate((sid) => { const b = document.querySelector(
      '#pan-band [data-k="trow|' + sid + '"]');
      if (b) b.dispatchEvent(new MouseEvent("contextmenu",
        { bubbles: true, cancelable: true })); }, s9a);
    await p.waitForTimeout(420);
    const menu = await p.evaluate((sid) => {
      const ops = [...document.querySelectorAll("#pan-band tr.nu-wopen .nu-opbtn")]
        .map((x) => x.dataset.k);
      return { ops, want: ["trow-up|" + sid, "trow-down|" + sid,
                           "trow-dup|" + sid, "trow-del|" + sid, "trow-add"]
        .filter((k) => ops.indexOf(k) >= 0).length }; }, s9a);
    check(menu.want === 5,
      "T9q a right-click on a header opens its menu: insert · delete · " +
      "duplicate · move (" + menu.want + " of 5)");
    await tap("trow|" + s9a);

    /* 9r · THE COLUMNS RESIZE, AND THE HANDLE IS NOT A DRAG-ONLY CONTROL. */
    const grip = await p.evaluate((n) => { const g = document.querySelector(
      '#pan-band [data-k="tgrip|tcol|' + n + '"]');
      if (!g) return null;
      const th = g.closest("th");
      const w0 = Math.round(th.getBoundingClientRect().width);
      g.focus();
      g.dispatchEvent(new KeyboardEvent("keydown",
        { key: "ArrowRight", bubbles: true, cancelable: true }));
      return { w0, tall: Math.round(g.getBoundingClientRect().height) }; }, v9a);
    await p.waitForTimeout(300);
    const grew = grip ? await p.evaluate((n) => { const g = document.querySelector(
      '#pan-band [data-k="tgrip|tcol|' + n + '"]');
      return g ? Math.round(g.closest("th").getBoundingClientRect().width) : 0; }, v9a)
      : 0;
    check(!!grip && grip.tall >= 44 && grew > grip.w0,
      "T9r a column resizes, and its handle answers the arrow keys as well as " +
      "a drag — " + JSON.stringify({ grip, grew }));

    /* 9s · FROZEN HEADS, AND THE PANE IS THE ONLY SCROLLER. */
    const frozen = await p.evaluate(() => {
      const th = document.querySelector("#pan-band thead th.nu-colhead");
      const rh = document.querySelector("#pan-band tbody th.nu-srowh");
      const cs = (x) => x ? getComputedStyle(x).position : null;
      return { head: cs(th), row: cs(rh) }; });
    check(frozen.head === "sticky" && frozen.row === "sticky",
      "T9s the header row and the header column are frozen — " +
      JSON.stringify(frozen));

    /* 9t · ...AT THE THREE WIDTHS, AND NOTHING UNDER 44px OR OFF THE SCREEN.
       The phone is the first layout (§6 ¶A) and the formula bar is the bottom
       sheet there, so this measures where the bar IS as well as that it is. */
    for (const w of [320, 390, 1280]) {
      await ctx.pages()[0].setViewportSize({ width: w, height: 900 });
      await p.waitForTimeout(420);
      await tap(cell(v9a, s9a));
      const m = await p.evaluate(() => {
        const host = document.getElementById("pan-band");
        const bar = host.querySelector(".nu-formula");
        const r = bar ? bar.getBoundingClientRect() : null;
        const shorts = [...host.querySelectorAll("button:not([hidden])")]
          .filter((b) => { const q = b.getBoundingClientRect();
            return q.width > 0 && q.height > 0 && q.height < 43.5; }).length;
        const offs = [...host.querySelectorAll(".nu-vsheet button")]
          .filter((b) => { const q = b.getBoundingClientRect();
            return q.width > 0 && (q.left < 0 || q.right > window.innerWidth + 1); }).length;
        return { bar: !!bar, pos: bar ? getComputedStyle(bar).position : null,
                 wide: r ? Math.round(r.width) : 0,
                 pane: Math.round(host.querySelector(".nu-pane")
                   .getBoundingClientRect().width),
                 page: document.documentElement.scrollWidth -
                       document.documentElement.clientWidth,
                 shorts, offs }; });
      check(m.bar && m.pos === "sticky" && m.shorts === 0 && m.offs === 0 &&
            m.page <= 1 && m.wide >= m.pane * 0.95,
        "T9t at " + w + " the formula bar is sticky and full width, nothing is " +
        "under 44px and nothing is off the screen — " + JSON.stringify(m));
      await shot("spreadsheet-" + w);
      await tap(cell(v9a, s9a));
    }
    await ctx.pages()[0].setViewportSize({ width: 390, height: 900 });
    await p.waitForTimeout(420);

    /* 9u · A HAND-CHANGED THROAT RE-SEATS THE WRITTEN REGISTER.
       `precompose.js` §7d writes every sung chair at the octave its throat
       actually sings, so that the STAFF, the piano roll and the notated .mid
       say what the box sounds instead of leaving `audio/plan.js`'s fold to
       correct the sound behind them. The one door that could undo that was on
       this page: the column sheet's `sings as` strip wrote a new throat and
       left `cast.reg` where the OLD throat had put it, and the record was an
       octave out again one tap later. `NuPrecompose.reseatVoice` is §7d's own
       arithmetic asked about one chair, called at `putCast`.

       DRIVEN ON THE PAGE, and the fold is COMPUTED HERE from what the page
       exposes rather than taken on trust: `window.NuKernel.homeFor` is the
       same function the seat uses and `window.NuKnobs`'s `voice` compass is the
       same table `precompose` reads, so what this measures is what the audio
       layer would do to the rendered line. THREE CLAIMS:
         · the write moves `cast.reg` by exactly the fold the NEW throat was
           about to apply (measured on Kingston 1969 / reading 1: the `vocal`
           chair is seated at 0 for its tenor and soprano wants +1);
         · after it, the fold is ZERO — the line is written where it is sung;
         · and the SUNG LINE IS UNCHANGED, which is the whole reason it is done
           this way: `pitch + 12 × fold` is the same set of notes before and
           after, so the seat moves the notation and never the sound. */
    {
      const DT = await doc();
      const PROBE = (name) => p.evaluate((vn) => {
        const D = window.__eightDoc();
        const li = D.voices.filter((v) => v.kind === "line")
                           .findIndex((v) => v.name === vn);
        const vi = D.voices.findIndex((v) => v.name === vn);
        /* THE COMPASS, off ui/knobs' own published table — the extraction of
           the parent's VOICE_TYPE, which is where precompose reads it too. */
        const m = (hz) => Math.round(69 + 12 * Math.log2(hz / 440));
        const winOf = (w) => { const V = (window.NuKnobs || {}).voices || {};
          for (const dsp of ["voice_lead", "voice_choir"]) {
            const row = (((V[dsp] || {}).rows) || [])
              .find((r) => r && r.key === "voice" && r.compass);
            const c = row && row.compass && row.compass[w];
            if (!c || !(c[0] > 0) || !(c[1] > 0)) continue;
            if (m(c[1]) - m(c[0]) < 12) continue;
            return [m(c[0]), m(c[1])];
          }
          return null; };
        const notes = [];
        for (let s = 0; s < D.form.sections.length; s++)
          for (const e of window.__eightEvents(s))
            if (e.kind === "line" && e.lv === li && e.n != null) notes.push(e.n);
        const th = (D.voices[vi].cast || {}).voice || null;
        const sheetWord = (() => { const b = document.querySelector(
          '#pan-band [data-k="' + CSS.escape("throat|" + vn) + '"]');
          return b ? (b.textContent || "").trim() : null; })();
        const win = winOf(th || sheetWord);
        const fold = (win && notes.length && window.NuKernel.homeFor)
          ? window.NuKernel.homeFor(notes, win) : null;
        return { vi, li, reg: (D.voices[vi].cast || {}).reg,
                 throat: th, word: sheetWord, win, fold,
                 sung: notes.map((n) => n + 12 * (fold || 0)).join(","),
                 n: notes.length };
      }, name);
      /* WHICH CHAIR SINGS is asked of the PAGE — the `sings as` row is drawn
         only where `A.throat` answers, which is the same `throatVoiceOf` walk
         the seat makes, so a chair with the row IS a chair with a throat. */
      let sungName = null;
      for (const v of DT.voices.filter((x) => x.kind === "line")) {
        await shutAll();
        await tap("tcol|" + v.name);
        if (await has("throat|" + v.name)) { sungName = v.name; break; }
      }
      if (!sungName) check(false, "T9u no chair on this record draws a `sings as` row");
      else {
        const before = await PROBE(sungName);
        await tap("throat|" + sungName);              // grow the strip
        const words = await p.evaluate((vn) =>
          [...document.querySelectorAll('#pan-band [data-k^="' +
            CSS.escape("throat|" + vn) + '|"]')]
            .map((b) => b.dataset.k.split("|")[2]).filter(Boolean), sungName);
        /* THE WORD THAT ASKS FOR A MOVE. A compass is a wall, not a target, so
           most throats leave a well-seated line alone (measured: on reggae's
           `vocal`, alto and countertenor and its own tenor all answer 0) — the
           gate picks the one that does move, because "it re-seats" is only a
           claim about a chair that needed re-seating. */
        const want = words.includes("soprano") ? "soprano"
                   : words.find((w) => w && w !== before.throat && w !== before.word);
        if (!want) check(false, "T9u the throat strip offered no second word: " +
          JSON.stringify(words));
        else {
          await tap("throat|" + sungName + "|" + want);
          const after = await PROBE(sungName);
          check(after.throat === want && after.reg !== before.reg,
            "T9u the `sings as` write re-seats the written register: " +
            sungName + " " + (before.throat || before.word) + "@reg " +
            before.reg + " -> " + want + "@reg " + after.reg);
          check(after.fold === 0,
            "T9v …and the fold audio/plan.js would apply is now ZERO — the " +
            "chair is written where it sings (" + JSON.stringify(
              { win: after.win, notes: after.n, fold: after.fold }) + ")");
          /* ...AND THE SOUND DID NOT MOVE. `before.sung` is the line the OLD
             throat sounded and is not the comparison; what is compared is the
             NEW throat's sounding line with the seat against the same line
             without it — which is `before.n` pitches + 12 × the fold the new
             compass asks of them. */
          const movedBy = after.reg - before.reg;
          const wouldHave = before.sung.split(",").filter(Boolean)
            .map((n) => +n + 12 * movedBy).join(",");
          check(after.sung === wouldHave && movedBy !== 0,
            "T9w …and the SUNG line is unchanged: the octave written (" +
            movedBy + ") is exactly the fold the new throat was about to " +
            "apply, so pitch + 12 x fold is the same " + after.n +
            " notes either way (" + (after.sung === wouldHave) + ")");
          /* AND IT IS IDEMPOTENT, which is what lets the door call it on every
             write: pressing the same word again re-seats nothing. */
          await tap("throat|" + sungName);
          await tap("throat|" + sungName + "|" + want);
          const again = await PROBE(sungName);
          check(again.reg === after.reg && again.fold === 0,
            "T9x …and a second write of the same throat moves nothing — the " +
            "seat is idempotent on a seated chair (reg " + again.reg +
            ", fold " + again.fold + ")");
        }
      }
      await shutAll();
    }

    /* 9y · A ROW `clamp` MOVES NOTHING, AND THE ROW SAYS SO.
       The row tier of §1's five landed as five strips and four of them reach
       the sound. The fifth wrote `section.clamp`, resolved through
       `document.js toGenre` onto the compiled genre's `incClamp`, reached
       `kernel.js rampOf` — and moved no note, because `document.js toPhrase`
       writes `inc` and `stk` all-zero on every phrase this box can hold (0 of
       18,793 motifs across 479 anchors at three readings carries a ramp
       column; `nukernel/gates.json`'s own census reads `form.clamp` as 165
       rows and 0 alive). A control that writes and does not arrive is the bug
       this tree keeps, and a grey one with no reason is the other half of it —
       so the row sheet SAYS the measurement, the way the cell sheet has since
       wave 4 (T6j). This asserts the sentence AND that there is nothing on the
       page that can write the field. */
    {
      const DR = await doc();
      const sidR = DR.form.sections[0].id;
      await shutAll();
      await tap("trow|" + sidR);
      const rr = await sheetRows();
      const ramp = (rr || []).find((r) => r.lab === "ramp limit");
      const writable = await p.evaluate(() => ({
        strip: !!document.querySelector('#pan-band [data-k="form.clamp"]'),
        chips: document.querySelectorAll(
          '#pan-band [data-k^="form.clamp|"]').length,
        sheet: !!(window.NuAvail && window.NuAvail.SHEETS["form.clamp"]) }));
      check(!!ramp && !ramp.k && !!ramp.why && /ramp/.test(ramp.why || ""),
        "T9y the row's ramp limit is a SENTENCE with its measurement on it, " +
        "not a strip — " + JSON.stringify(ramp));
      check(!writable.strip && writable.chips === 0 && !writable.sheet,
        "T9z …and nothing on the page can write it: no form.clamp control, no " +
        "chips, and avail.js mints no sheet for it — " + JSON.stringify(writable));
      const wrote = await p.evaluate(() => {
        const D = window.__eightDoc();
        return D.form.sections.filter((s) => s.clamp != null).length; });
      check(wrote === 0,
        "…and no section of the record carries a `clamp` after the sheet has " +
        "been opened (" + wrote + " of " + DR.form.sections.length + ")");
      await shutAll();
    }
  }

  /* ================= T0 · THE CONSOLE =================================== */
  check(errs.length === 0, "T0 no page or console error across all of it" +
    (errs.length ? " — " + errs.slice(0, 4).join(" | ") : ""));

  console.log("\n" + (fails.length ? "FAILED " + fails.length : "PASSED") +
    " (" + notes.length + " ok)");
  if (fails.length) for (const f of fails) console.log("  · " + f);
  await b.close();
  if (srv) srv.proc.kill();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
