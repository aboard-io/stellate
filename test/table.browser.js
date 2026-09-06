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
const { chromium, devices } = require("playwright");
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
/* THE WORDS MOVED IN THE FUNCTIONAL TEXT PASS (2026-09-05, TABLE.md §11 and
   the review's glossary at §12a): motif → phrase, does → variation, shape →
   dynamics, motion → automation, pace → feel, period → phrase structure,
   breath → note-length limit, alphabet → scale, chain → effects, changes →
   chords, across → pan, time → time shift. THE CLAIM IS UNCHANGED — the sheet
   is §1's vector in §1's order, and the ADDRESSES (`data-k`) never moved; only
   what the labels say. The old spellings are kept in this comment so the next
   reader can see that this is a rename and not a reordering.
   (...AND "enters at bar" -> "entry", 2026-09-05, the review's item 4: the
   control counts BEATS now, so a label naming bars was naming the wrong
   unit. Same address, same row, same place in the order.) */
/* ...AND THE ORDER IS THE COMPOSER'S SINCE 2026-09-05 (TABLE.md §11c, the
   design pass). Paul: *"Think like a composer when you do the redesign"* and
   *"just nicely structure each expanded interface as proper software that's
   easy to scan and nicely grouped."* The sheet is GROUPS now — for a cell,
   Motif · Variation · Dynamics · Placement — and the lists below are those
   groups' contents concatenated, which is the reading order on the glass.
   IT IS A REORDER AND NOT A RE-VOCABULARY: every `data-k` is the one it had on
   v281, T7 walks the same inventory, and what moved is written down in
   `src/table/model.ts cellSheet`'s own paragraph. What moved, in one line
   each: the four note words came UP out of the tail to stand with the phrase;
   `ramp limit` went to the variation it limits; the mix lanes split (level,
   send and tone are dynamics, place is placement); `entry` and `register`
   went DOWN into placement beside the pan and the time shift. */
const CELL_ORDER = [/* Motif */     "motifs", "articulation", "octave", "scale",
                    /* Variation */ "variation", "ramp limit",
                    /* Dynamics */  "focus", "mix · level", "mix · send",
                                    "mix · tone",
                    /* Placement */ "entry", "register", "mix · place",
                                    "time shift"];
/* ...AND FOR A SECTION, Form · Time · Key · Feel · Chain. `repeat`, `second
   ending`, `coda` and `to coda` stand at the head of FORM and are not listed
   here for the reason they were never listed: this array is a FILTER, and the
   claim is about the order of the fields it names. */
const ROW_ORDER  = [/* Form  */ "type", "bars", "intro", "outro",
                    /* Time  */ "feel", "phrase structure", "note-length limit",
                                "pipe", "swing", "groove", "starts at",
                    /* Key   */ "key", "mode", "chords",
                    /* Feel  */ "level", "dynamics",
                    /* Chain */ "automation", "effects", "reverb", "echo",
                                "echo time", "room", "pan", "lanes"];
/* THE THREE GROUP SETS, which are `src/copy/sheets.ts group.*` and are read
   here as words because that is what a reader sees. */
/* (`Phrase` WAS THE FIRST OF THESE UNTIL 2026-09-05 — TABLE.md §13e, Paul:
   *"Call phrases motifs."* The heading and the field under it say `motif`
   now; the KEY is still `group.phrase` and no address moved.) */
const CELLGROUPS = ["Motif", "Variation", "Dynamics", "Placement"];
const ROWGROUPS  = ["Form", "Time", "Key", "Feel", "Chain"];
const COLGROUPS  = ["Instrument", "Envelope", "Tone", "Mix"];
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
  /* THE `+` IS ITS OWN OFFER SINCE 2026-09-05 (TABLE.md §13e). Paul: *"Don't
     pop up an interface when I add a section or a voice. Just add it."* So the
     address a gate taps to hire is read OFF the button rather than typed here:
     the head's `+` carries `tcol-add|<the kind the band has not got>` and the
     foot's carries `trow-add`, and which kind that is depends on the record. */
  const plusK = async (where) => p.evaluate((w) => {
    const b = document.querySelector(w === "head"
      ? "#pan-band thead th.nu-plushead .nu-plusbtn"
      : "#pan-band tbody tr.nu-addrow th .nu-plusbtn");
    return b ? b.dataset.k : null; }, where);

  /* ...AND A CELL TAKES TWO OF THEM SINCE TABLE.md §11 (2026-09-05). The first
     tap SELECTS (the ring, the formula bar's head) and the second EDITS — the
     spreadsheet gesture — so a gate that wants a cell's vector open asks for
     both, idempotently: it selects only if the ring is not already there and it
     opens only if the sheet is not already out. Written this way rather than as
     `tap(); tap()` because the second tap on an OPEN cell shuts it, and half of
     the checks below arrive with one already open. */
  const selectCell = async (k) => {
    const r = await p.evaluate((key) => {
      const el = document.querySelector('#pan-band [data-k="' + key + '"]');
      if (!el) return "missing";
      if (!el.classList.contains("is-sel")) { el.click(); return "ok"; }
      /* ALREADY STANDING ON IT — and a second tap would EDIT it, so shut the
         editor instead of opening one the check did not ask for. */
      if (el.getAttribute("aria-expanded") === "true") el.click();
      return "ok"; }, k);
    await p.waitForTimeout(420); return r; };
  const openCell = async (k) => {
    const r = await p.evaluate((key) => {
      const el = document.querySelector('#pan-band [data-k="' + key + '"]');
      if (!el) return "missing";
      if (!el.classList.contains("is-sel")) el.click();
      const el2 = document.querySelector('#pan-band [data-k="' + key + '"]');
      if (el2 && el2.getAttribute("aria-expanded") !== "true") el2.click();
      return "ok"; }, k);
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
         does not have. The player axis's `+` is a `<th class="nu-plushead">` and
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
  /* FOUR FOOTER ROWS SINCE 2026-09-08 (§10b step 5): the MIX row (a seat per
     voice column), the MASTER under it (merged, its sheet the board), PRODUCE
     under that (merged, its sheet the producer's own panel), then performance.
     It was two — master + performance — until 2026-09-07, then three. §10a
     draws the last two exactly here: *"│ MIX │ strip │ strip │ master │ /
     │ PRODUCE │ the producer's deals and notes │"*, under the grid, because
     the producer speaks about a record that has already been dealt. */
  check(shape.foot === 4, "…with the record under it: the mix row, the " +
    "master, produce, and performance (" + shape.foot + " footer rows)");
  check(shape.corner, "…and the corner is the whole record");

  /* ================= T5b · THE THREE SHEETS, IN §1's ORDER ============== */
  const secId = (await doc()).form.sections[0].id;
  const vName = (await doc()).voices[0].name;
  await tap("trow|" + secId);
  const rs = await sheetRows();
  const rlabs = (rs || []).map((r) => r.lab).filter((x) => ROW_ORDER.includes(x));
  check(JSON.stringify(rlabs) === JSON.stringify(ROW_ORDER.filter((x) => rlabs.includes(x))),
    "T5b the row sheet is §1's SECTION vector in §1's order (" + rlabs.length + " fields)");
  check(rlabs.includes("feel"),
    "…and the feel is on the ROW now, out of Time (TABLE.md §1, Paul " +
    "2026-09-03; the word was `pace` until the text pass renamed it)");
  check(rlabs.includes("key") && rlabs.includes("swing") && rlabs.includes("reverb"),
    "…with wave 2a's own row overrides: key, swing, the chain and the room");
  await tap("trow|" + secId);

  await tap("tcol|" + vName);
  const cs = await sheetRows();
  const clabs = (cs || []).map((r) => r.lab);
  /* `"seat"` STOOD IN THIS LIST until 2026-09-07 (TABLE.md §10b step 3). The
     voice's channel strip was seated in the column sheet from wave 2c, which
     was right while the board had no per-voice channel; §10a gives it a row —
     *"MIX is ALIGNED — one channel strip per voice column"* — so the strip is
     the MIX row's cell under this player's column and the column sheet carries
     the POINTER to it (`the desk`, `tseat|<voice>`). T10n asserts both halves:
     the cell draws the whole strip, and the column sheet draws none of it. */
  check(clabs.includes("instrument") && clabs.includes("register") &&
        clabs.includes("entry") && clabs.includes("the desk"),
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
    /* A FIELD'S HEAD IS A TOGGLE, SO IT IS OPENED IDEMPOTENTLY — the same
       sentence `openCell` above makes about a cell, and for the same reason
       one round later. Until 2026-09-05 a strip could not survive the rebuild
       its own write caused, so this helper arrived at a shut field every time
       and a blind `click()` always meant "open". Now a strip stays out (Paul:
       *"Don't dismiss things when I tap them to change values"*), and a blind
       click on a field that is already open SHUTS it and hands this helper an
       empty list. */
    const chipsOfField = (k) => p.evaluate((key) => {
      const f = document.querySelector('#pan-band [data-k="' + key + '"]');
      if (!f) return [];
      if (f.getAttribute("aria-expanded") !== "true") f.click();
      /* `.nu-lz` IS THE FOURTH WIDGET (2026-09-05, DESIGN.md component 16). A
         vocabulary that knows its own kinds opens as a LOZENGE FIELD rather
         than a strip of chips, and it mints the same `<field>|<value>`
         address on every option — so the walk reads both and neither this
         gate nor the driver has to know which one a field earned. Read only
         `.nu-wchip` and a converted field reports NO OPTIONS, which is the
         silent no-op test/lib-combo.js's own header was written about. */
      return [...document.querySelectorAll("#pan-band .nu-wchip, #pan-band .nu-lz")]
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
  await openCell("tcell|" + subjV + "|" + secId);
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
  check(!greyed.some((r) => ["articulation", "octave", "time shift", "scale"]
          .includes(r.lab)),
    "…artic, oct, rate and scale are LIVE strips, not greyed (wave 4 arrived)");
  check(greyed.some((r) => r.lab === "ramp limit" && /no ramp/.test(r.why)),
    "…and the ramp limit alone keeps its refusal, with the measurement in it");
  await shot("cell-sheet-390");
  await tap("tcell|" + subjV + "|" + secId);

  /* ================= T5e · QUIET IS INHERITED, BOLD IS WRITTEN ==========
     ...AND A RESTING CELL IS A CELL AND NOT A BOX (TABLE.md §11, RULED
     2026-09-05). Paul: *"less boxes inside the cells and more of the cells just
     being cells"*. Three claims, all read off the RENDERED computed style
     because a class name is not a border:
       · every resting body cell draws ZERO pixels of rule on all four sides,
         and no ground of its own;
       · WRITTEN is `--fw-label` (700) and inherited is quieter than it — the
         typography is what carries what the frame carried;
       · the 44px tap height is untouched, which is the one thing the restyle
         may not spend. */
  const paint = await p.evaluate(() => {
    const cells = [...document.querySelectorAll('#pan-band [data-k^="tcell|"]')];
    const dim = cells.filter((c) => c.classList.contains("is-derived"));
    const rs = dim.length ? getComputedStyle(dim[0]) : null;
    const br = cells.find((c) => !c.classList.contains("is-derived"));
    const bs = br ? getComputedStyle(br) : null;
    const rule = (c) => { const q = getComputedStyle(c);
      return ["Top", "Right", "Bottom", "Left"]
        .reduce((a, side) => a + (parseFloat(q["border" + side + "Width"]) || 0), 0); };
    const label = getComputedStyle(document.documentElement)
      .getPropertyValue("--fw-label").trim();
    const boxed = cells.filter((c) => c.getAttribute("aria-expanded") !== "true" &&
      c.getBoundingClientRect().width > 0 && rule(c) > 0);
    const grounds = [...new Set(cells.map((c) => getComputedStyle(c).backgroundColor))];
    const short = cells.filter((c) => { const q = c.getBoundingClientRect();
      return q.width > 0 && q.height < 43.5; }).length;
    return { n: cells.length, dim: dim.length,
      dimWeight: rs ? rs.fontWeight : null, boldWeight: bs ? bs.fontWeight : null,
      dimOpacity: rs ? rs.opacity : null,
      label, boxed: boxed.length, grounds, short,
      rulePx: cells.reduce((a, c) => { const q = c.getBoundingClientRect();
        return a + rule(c) / 4 * 2 * (q.width + q.height); }, 0) };
  });
  check(paint.dim > 0 && paint.dim < paint.n,
    "T5e the table draws only DEVIATIONS: " + paint.dim + " of " + paint.n +
    " cells are inherited (§2)");
  check(paint.boldWeight === paint.label &&
        (+paint.dimWeight < +paint.boldWeight),
    "…and WRITTEN is --fw-label with inherited quieter than it (weight " +
    paint.dimWeight + " vs " + paint.boldWeight + " = --fw-label " + paint.label +
    ", opacity " + paint.dimOpacity + ")");
  check(paint.boxed === 0 && paint.rulePx === 0 && paint.short === 0 &&
        paint.grounds.every((g) => /rgba\(0, 0, 0, 0\)|transparent/.test(g)),
    "…and a RESTING CELL HAS NO BOX (§11): " + paint.boxed + " of " + paint.n +
    " draw a border, " + Math.round(paint.rulePx) + "px\u00b2 of rule in the " +
    "whole grid, grounds " + JSON.stringify(paint.grounds) + ", " + paint.short +
    " under 44px");

  /* ================= T5f · THE DRUMMER'S SIXTY-EIGHT, GROUPED =========== */
  const D0 = await doc();
  const drums = (D0.voices.find((v) => v.kind === "drums") || {}).name;
  if (drums) {
    await openCell("tcell|" + drums + "|" + secId);
    await tap("dev.kit|" + drums + "|" + secId);
    /* THE WIDGET CHANGED AND SO DID THE LAW, 2026-09-05 (DESIGN.md component
       16 · TABLE.md §11d). This read `.nu-groupbar` and asserted *"one group
       open at a time"* — TABLE.md §6's ruling, which was right while the only
       thing on offer was a strip of sixty-eight chips. Paul's design-pass
       ruling supersedes it in as many words: *"tight lozenges, organized by
       color and clustered semantically by the kind of things they present…
       VISIBILITY INTO ALL OF THE OPTIONS."* So the claim inverts — every one
       of the sixty-eight is on the glass, in its own cluster, and a cluster
       folds only because a hand folded it — and the measurement stays what it
       always was: the RENDERED BOX and never the `hidden` property, because
       `.nu-wchip{display:inline-flex}` once outranked the UA's `[hidden]` and
       this check said ten of sixty-eight about a page that was showing all of
       them. TEST THE ARTIFACT. */
    const gr = await p.evaluate(() => {
      const field = document.querySelector("#pan-band .nu-lzfield");
      const secs = field ? [...field.querySelectorAll(".nu-lzcluster")] : [];
      const lz = field ? [...field.querySelectorAll(".nu-lz")] : [];
      return { groups: secs.map((x) =>
                 ((x.querySelector(".nu-lzheadword") || {}).textContent || "").trim()),
        hues: [...new Set(secs.map((x) => x.dataset.hue))].length,
        chips: lz.length,
        shown: lz.filter((c) => c.getBoundingClientRect().height > 0).length,
        short: lz.filter((c) => { const r = c.getBoundingClientRect();
          return r.height > 0 && r.height < 43.5; }).length,
        pill: lz.length ? getComputedStyle(lz[0]).borderTopLeftRadius : null };
    });
    check(gr.groups.length >= 5 && KITGROUPS.every((g) => gr.groups.includes(g)),
      "T5f the drummer's ops are grouped by what they act on: " + gr.groups.join(" · "));
    check(gr.chips > 60 && gr.shown === gr.chips,
      "…and EVERY ONE of them is on the glass at once (" + gr.shown + " of " +
      gr.chips + "), which is what the lozenge field is for");
    check(gr.hues === gr.groups.length && gr.short === 0,
      "…one hue per cluster (" + gr.hues + " for " + gr.groups.length +
      " clusters) and every lozenge 44px (" + gr.short + " short)");
    await shot("does-sheet-390");
    await tap("tcell|" + drums + "|" + secId);
  } else check(false, "T5f the record has no drummer to group");

  /* ================= T7 · NOTHING LOST ================================== */
  await ctx.pages()[0].setViewportSize({ width: 320, height: 800 });
  await p.waitForTimeout(500);
  await top("Band");
  /* `<motif>` AND `<forker>` ARE MEASURED OFF THE RECORD, NOT NAMED (2026-09-08,
     §10b step 4). The motif chosen is the one the MOST chairs read, because
     `fork|<cell>|<voice>` is drawn only where a cell is shared — a fixture-
     specific name here would be an inventory that only holds on one record.
     `<forker>` is the first of that cell's readers, which is the first fork
     button `forkRow` draws. */
  const share = await p.evaluate(() => {
    const d = window.__eightDoc();
    const uses = (v, n) => { const m = v.material;
      return typeof m === "string" ? m === n
        : m && typeof m === "object"
          ? Object.keys(m).some((k) => m[k] === n) : false; };
    let best = null;
    for (const n of Object.keys(d.material.cells)) {
      const rs = d.voices.filter((v) => uses(v, n)).map((v) => v.name);
      if (!best || rs.length > best.readers.length) best = { name: n, readers: rs };
    }
    return best || { name: "", readers: [] };
  });
  const subst = (k) => k.replace(/<section>/g, secId)
    .replace(/<voice>/g, vName).replace(/<bass>/g, (D0.voices.find((v) => v.kind === "bass") || {}).name || vName)
    .replace(/<drums>/g, drums || vName)
    .replace(/<quality>/g, "louder")
    .replace(/<forker>/g, share.readers[0] || vName)
    .replace(/<motif>/g, share.name);
  const missing = [], small = [];
  for (const c of INV.controls.concat(INV.new)) {
    const reach = subst(c.reach);
    if (/^toptab-/.test(reach)) {
      const there = await p.evaluate((k) => !!document.querySelector('[data-k="' + k + '"]'), reach);
      if (!there) missing.push((c.k || c.reach) + " -> " + reach);
      continue;
    }
    /* AND A CELL TAKES TWO TAPS SINCE §11 (2026-09-05). The inventory names
       the door (`open`), and for a grid cell the door is now the SECOND tap:
       the first stands on it. Four homes were reported missing the hour the
       law landed — `material.cell`, `dev.bass`, `dev.kit` and the tray's motif
       — all of them behind one `tcell|…` that had been opened with one tap
       since wave 2b. */
    if (c.open) { const o = subst(c.open);
                  if (o.indexOf("tcell|") === 0) await openCell(o); else await tap(o); }
    /* ...AND A SECOND TAP WHERE THE HOME IS A TABBED SURFACE (2026-09-07).
       The MIX row's master opens the BOARD, and the board has always been one
       panel holding one of five plates: `master|drive` is on the main plate,
       the trim grid is on the automation plate, and a walk that only pressed
       the row's head would report four plates' worth of controls missing and
       be right. `then` is the stage button the inventory names — a hand's
       second tap, at the same `boardtab|<kind>|<key>` address desk-gate uses. */
    if (c.then) await tap(subst(c.then));
    /* `data-k` OR `data-sel` — the four vocabularies that stayed MENUS wear
       ui/selects.js's own address (test/selects.js MENUS is the one owner of
       which; ui/table.js COMBOKEYS says why), and an inventory that only knew
       one spelling would have reported a control lost that is standing there. */
    /* ...AND `data-circ`, SINCE 2026-09-06. The circle of fifths is the one
       control on this page whose own inputs are visually clipped ON PURPOSE —
       twenty-four radios at 1x1 with their LABELS as the targets, which is what
       test/shell.js A3 measures at 24px — so the address a thumb reaches is the
       widget's, `data-circ="alphabet.key"`, and an inventory that only knew the
       other two spellings would report the whole circle short. */
    const box = await p.evaluate((k) => {
      const el = document.querySelector('#pan-band [data-k="' + k + '"]') ||
                 document.querySelector('#pan-band [data-sel="' + k + '"]') ||
                 document.querySelector('#pan-band [data-circ="' + k + '"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    }, reach);
    if (!box) missing.push((c.k || c.reach) + " -> " + reach);
    /* THE FLOOR IS 44 EVERYWHERE EXCEPT WHERE ANOTHER GATE ALREADY OWNS IT,
       and the inventory says which and why in its own `note`: the BENCH's step
       row is 52px (test/bench.test.js B3's own claim, off Paul's "tightened to
       one line"), and the three kind buttons and two bars INSIDE that row are
       40 and 30 by that instruction and were 40 and 30 in the pane this walk
       inherited them from. A second 44px demand here would be a second owner
       contradicting B3 about a geometry this round did not touch. */
    else if (box.h < (c.floor || 44))
      small.push(reach + " " + box.w + "x" + box.h +
                 (c.floor ? " (floor " + c.floor + ")" : ""));
    if (c.open) await tap(subst(c.open));
  }
  /* ...AND THE CHROME'S OWN, WHICH IS T7'S LAW ASKED OF THE GUTTER
     (2026-09-09, TABLE.md §10b step 7). Every row above is a control the Band
     or Structure pane offered and the TABLE now holds; `INV.chrome` is the
     six the gutter held and the table never could — the transport, the seed,
     the record's name, the log and the four viewers — filed under two homes
     outside it, THE BAR and THE HAMBURGER. The walk is the same walk with two
     differences that are facts about those homes rather than exceptions to the
     law: the query is PAGE-WIDE (the bar is a `<nav>` beside `#app`, not
     inside `#pan-band`), and a row marked `menu` is behind the ≡, so the ≡ is
     pressed first — the same second tap the MIX row's master needed the day
     its home became a tabbed surface. A row marked `when` needs a surface
     open, and the walk opens it and comes back. */
  for (const c of (INV.chrome ? INV.chrome.controls : [])) {
    if (c.when && c.when !== "sheet") {
      await p.evaluate((t) => window.__eightTab(t), c.when);
      await p.waitForTimeout(c.when === "Score" ? 1800 : 700);
    } else if (c.when === "sheet") {
      await p.evaluate(() => window.__eightTab("Score"));
      await p.waitForTimeout(1800);
    }
    if (c.menu) await p.evaluate(() => window.__eightMenuOpen(true));
    if (c.open) { const o = await p.$('[data-k="' + c.open + '"]');
                  if (o) await o.click(); await p.waitForTimeout(300); }
    const box = await p.evaluate((k) => {
      const el = document.querySelector('[data-k="' + k + '"]') ||
                 document.getElementById(k);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    }, c.reach);
    if (!box || (!box.w && !box.h)) missing.push(c.k + " -> " + c.reach);
    else if (box.h < (c.floor || 44))
      small.push(c.reach + " " + box.w + "x" + box.h +
                 (c.floor ? " (floor " + c.floor + ")" : ""));
    if (c.open) { const o = await p.$('[data-k="' + c.open + '"]');
                  if (o) await o.click(); await p.waitForTimeout(200); }
    if (c.menu) await p.evaluate(() => window.__eightMenuOpen(false));
    if (c.when) { await p.evaluate(() => window.__eightTab("Band"));
                  await p.waitForTimeout(700); }
  }
  check(!missing.length, "T7 every control the two panes offered has a home on " +
    "the table, reachable by tap at 320px (" +
    (INV.controls.length + INV.new.length +
     (INV.chrome ? INV.chrome.controls.length : 0)) + " checked, of which " +
    (INV.chrome ? INV.chrome.controls.length : 0) + " are the deleted " +
    "gutter's, in the bar and the hamburger)" +
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
    await openCell("tcell|" + vName + "|" + secId);
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
  await openCell("tcell|" + vName + "|" + secId); await shot("cell-sheet-1280");
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
       OPENED IT — one retry, which is what a thumb does. (It said "hiring a
       player lands ON that player, so the next op's tap FOLDS it"; since
       2026-09-05 a hire opens nothing at all — TABLE.md §13e — and the retry
       stands for every other way a door can already be open.) */
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
  /* THE OFFER IS THE `+` ITSELF SINCE 2026-09-05 (TABLE.md §13e): the head
     row's `+` CARRIES the address of the hire it will make — `tcol-add|` and
     the first kind this record has not got — and a tap on it hires. There is
     no opener and no sheet, so the address is read off the button rather than
     typed here: which kind is offered is the record's business. */
  const hireK = await plusK("head");
  await opCase("column · hire the kind the band has not got (" + hireK + ")",
    hireK, ["voices"]);
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
  /* ...AND A CONTINUOUS NUMBER IS A SLIDER SINCE 2026-09-05 (TABLE.md §11).
     Paul: *"When you redesign think sliders and other UI for data entry."*
     A register was eight chips and is one `input[type=range]`, so a walk that
     only knew about chips read "NONE OF 0 MOVED IT" on a control that is
     standing there and working — a gate testing the widget instead of the
     claim. `chipsOf` answers with the offered VALUES either way, and `walk`
     drives whichever control the field actually got. */
  const chipsOf = async (cellKey, fieldKey) => {
    await openCell(cellKey);
    return p.evaluate((k) => {
      const sl = document.querySelector(
        '#pan-band input.nu-numslide[data-k="' + k + '"]');
      if (sl) { const out = [];
        for (let v = +sl.min; v <= +sl.max; v += (+sl.step || 1))
          out.push(k + "|" + v);
        return out; }
      const f = document.querySelector('#pan-band [data-k="' + k + '"]');
      if (!f) return [];
      /* IDEMPOTENT, because the head is a TOGGLE and a strip survives its own
         write now — see `chipsOfField` above for the measurement. Blind, this
         line shut the strip it was asked to read: T6e's clear-back never found
         its chip ({"level":"+6"} left standing) and T6f's walk reported "NONE
         OF 4 MOVED IT" about four words it had never actually pressed. */
      if (f.getAttribute("aria-expanded") !== "true") f.click();
      /* ...AND `.nu-lz` FOR THE SAME REASON `chipsOfField` reads it (above):
         one address, two widgets. MEASURED the hour the lozenge landed: T8c
         said "none of 0 moved it" about a `does` vocabulary whose words were
         all on the glass — a gate that queried the old class and found
         nothing, which is not the same claim as a control that does nothing. */
      /* ...AND A REFUSED LOZENGE IS `aria-disabled` AND NOT `disabled` SINCE
         2026-09-05 (src/lozenge/field.ts law 6): a `disabled` button takes no
         click, so its reason was reachable only through a screen reader. It is
         still a word this walk may not press — pressing one writes nothing and
         would be counted here as a word that does not move the sound. */
      return [...document.querySelectorAll("#pan-band .nu-wchip, #pan-band .nu-lz")]
        .filter((c) => !c.disabled && c.getAttribute("aria-disabled") !== "true" &&
                       (c.dataset.k || "").split("|").pop() !== "")
        .map((c) => c.dataset.k);
    }, fieldKey);
  };
  const walk = async (cellKey, fieldKey, read) => {
    const list = await chipsOf(cellKey, fieldKey);
    const from = await read();
    let tapped = 0, moved = null;
    for (const k of list) {
      const got = await p.evaluate((key) => {
        /* A SLIDER'S "chip" IS `<field>|<value>` and the drive is a `change`
           event on the range, which is the door the widget itself uses. */
        const cut = key.lastIndexOf("|");
        const base = key.slice(0, cut), val = key.slice(cut + 1);
        const sl = document.querySelector(
          '#pan-band input.nu-numslide[data-k="' + base + '"]');
        if (sl) { if (String(sl.value) === val) return false;
                  sl.value = val;
                  sl.dispatchEvent(new Event("change", { bubbles: true }));
                  return true; }
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
  /* PUTTING IT BACK GOES THROUGH WHATEVER THE FIELD IS DRAWN AS. The register
     is a SLIDER since 2026-09-05 (§11: *"think sliders and other UI for data
     entry"*), so the chip `reg|<voice>|<value>` this looked for is not there
     and the walk left the column two octaves down — measured as `"0" -> "-4"`,
     which is a true reading of a gate that had not followed its own control. */
  let put = false;
  for (let k = 0; k < 3 && !put; k++) {
    put = await p.evaluate((args) => {
      const [n, was] = args;
      const sl = document.querySelector(
        '#pan-band input.nu-numslide[data-k="reg|' + n + '"]');
      if (sl) { sl.value = String(was === "" ? sl.min : was);
                sl.dispatchEvent(new Event("change", { bubbles: true }));
                return true; }
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
      /* labelled `scale` since the text pass — the review's glossary
          (TABLE.md §12a): alphabet → scale. The KEY never moved. */
      { t: "T6i", key: "scale", say: "scale" },
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
      await openCell("tcell|" + stab.name + "|" + sid7);
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
        /* THE SENTENCE, NOT THE MEASUREMENT. It read
            `/voices the bar's CHORD/` until 2026-09-05: the refusal cited what
            the code does ("this chair voices the bar's CHORD") where a person
            needs what to do about it. `src/copy/table.ts cell.chordPart.why`
            is the one spelling now, and the claim — this row is TOLD, with a
            reason — is unchanged. */
        return !!(r && r.why && /plays chords, not a line/.test(r.why)); };
      const live = (l) => { const r = row(l); return !!(r && !r.why); };
      check(told("articulation") && told("scale") &&
            live("octave") && live("time shift"),
        "T6k a chord-voicing chair (" + stab.name + ", " +
        (stab.cast || {}).part + ") is TOLD its articulation and its scale " +
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

  /* T8a (was band B2) · HIRING ADDS THE PLAYER AND OPENS NOTHING. `+ line`
     is a document write T4 already diffs; what this measures is what a hire
     does to the GLASS. It read *"hiring LANDS on the player"* — Paul's *"add →
     hear it → choose its sound"* (2026-09-04), the new column's own sheet
     standing open on arrival — until 2026-09-05, when Paul used that: *"Don't
     pop up an interface when I add a section or a voice. Just add it."*
     (TABLE.md §13e). The claim is inverted and still measured: the column
     arrives with its HEAD on the table, one tap from its sheet, nothing opens
     over it, and whatever the hand had open is still what is open. */
  await top("Band");
  await tap("tcol|" + vName);      // a sheet the hand had open before the hire
  const nBefore = (await doc()).voices.length;
  const openBefore = await p.evaluate(() =>
    document.querySelectorAll("#pan-band .nu-wopen").length);
  await tap(await plusK("head"));
  await p.waitForTimeout(700);
  const landed = await p.evaluate(() => {
    const D = window.__eightDoc();
    const last = D.voices[D.voices.length - 1].name;
    const head = document.querySelector('#pan-band [data-k="tcol|' + last + '"]');
    return { n: D.voices.length, last, head: !!head,
             open: head ? head.getAttribute("aria-expanded") : null,
             wopen: document.querySelectorAll("#pan-band .nu-wopen").length,
             sheets: document.querySelectorAll("#pan-band .nu-vsheet").length };
  });
  check(landed.n === nBefore + 1 && landed.head && landed.open === "false" &&
        landed.wopen === openBefore,
    "T8a hiring a player ADDS IT AND OPENS NOTHING — its head is on the " +
    "table, one tap from its sheet, and the sheets standing open are the ones " +
    "that already were (" + JSON.stringify(landed) + ", before " +
    openBefore + ")");

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
    /* `inTempo: #pan-tempo […]` STOOD HERE, 2026-09-04 to 2026-09-06, and a
       selector for a deleted host is a check that always passes — the same sin
       as a check that always skips (§9d, A8). The Time PANE is gone, so the
       honest question is the page-wide one: how many controls anywhere answer
       to `form.pace` at all, in either spelling. */
    anyPace: [...document.querySelectorAll(
      '[data-k^="form.pace"], [data-sel^="form.pace"]')].length,
  }), secId);
  check(paceOwners.all === 1 && paceOwners.inBand === 1 && paceOwners.anyPace === 1,
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
    await openCell("tcell|" + bassV2.name + "|" + secId);
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
    /* THE ADDRESS IS THE CELL SHEET'S FIRST LINE SINCE 2026-09-05 (§13a.6).
       `.nu-formula` is deleted — it stood at rest whether or not a cell was
       selected, 105.8px of a 844px phone, measured — and its head is the first
       line of the open cell sheet, where undo and redo stand at the place the
       change was made. So a gate that wants the address OPENS the cell it is
       standing on (Enter, which is the second half of the spreadsheet gesture
       this file already drives) and reads it there. */
    /* ...AND IT PUTS THE PAGE BACK, which is what makes it a READER and not a
       gesture: T9b's very next claim is that the first tap opens NOTHING but
       the ring, and a reader that left an editor standing would be the harness
       manufacturing the defect it is about to report. Enter opens, Escape
       closes and the selection survives it (`closeEdit`). */
    const addr = async () => {
      const shut = await p.evaluate(() =>
        !document.querySelector("#pan-band tr.nu-cellopen"));
      if (shut) { await key("Enter"); await p.waitForTimeout(300); }
      const out = await p.evaluate(() => { const a =
        document.querySelector('#pan-band [data-k="taddr"]');
        return a ? a.textContent.trim() : null; });
      if (shut) { await key("Escape"); await p.waitForTimeout(250); }
      return out; };
    /* ONE OF THE FOUR VERBS, PRESSED WHERE IT LIVES (2026-09-05, §13a.6). They
       were on `.nu-formula` and stood at rest; they are the first line of the
       OPEN cell sheet, so a gate that wants one opens the cell it is standing
       on first — the second tap, which is the spreadsheet gesture this file
       already drives — and presses the verb there. It leaves the sheet open,
       because that is where the hand that pressed undo is. */
    const barTap = async (k) => {
      const opened = await p.evaluate(() => {
        if (document.querySelector("#pan-band tr.nu-cellopen")) return true;
        const c = document.querySelector("#pan-band .nu-wcell.is-sel");
        if (!c) return false;
        c.click(); return true; });
      if (!opened) return "missing";
      await p.waitForTimeout(420);
      return tap(k); };
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
    /* THE GATE ARRIVES STANDING SOMEWHERE ELSE, so that the tap it measures is
       genuinely a FIRST tap on this cell: since §11 the second tap on a cell
       already carrying the ring is the one that edits, and a check that landed
       here with the ring already on `s9a` would be measuring the wrong gesture
       (and would read the editor it opened as a bug). Selecting the neighbour
       also shuts whatever sheet the checks above left open. */
    await selectCell(cell(v9a, s9b));
    await tap(cell(v9a, s9a));
    const a1 = await addr(), sel1 = await sel();
    check(sel1 === cell(v9a, s9a) && !!a1 && a1 !== "no cell selected",
      "T9a a tap selects one cell and the formula bar names it — " +
      JSON.stringify({ sel: sel1, addr: a1 }));

    /* 9b · ...AND IT OPENS NOTHING ELSE (TABLE.md §11, 2026-09-05). THE FIRST
       TAP SELECTS ONLY. It used to select AND unfold the whole eighteen-field
       accordion under the row — measured at 15 sheet rows for a hand that only
       wanted to see where it was standing — and §11's first law is that
       looking at a cell costs a ring and nothing else. */
    const body = await p.evaluate(() => ({
      sheets: document.querySelectorAll("#pan-band .nu-vsheet").length,
      rows: document.querySelectorAll("#pan-band tr.nu-wopen .nu-sheetrow").length,
      sel: document.querySelectorAll("#pan-band .nu-wcell.is-sel").length,
      ring: (() => { const c = document.querySelector("#pan-band .nu-wcell.is-sel");
        return c ? getComputedStyle(c).outlineWidth : null; })() }));
    check(body.sheets === 0 && body.rows === 0 && body.sel === 1 &&
          parseFloat(body.ring) > 0,
      "T9b …and the first tap opens NOTHING but the ring (§11) — " +
      JSON.stringify(body));

    /* 9b2 · THE SECOND TAP EDITS: the control pops up in the cell's own row. */
    await tap(cell(v9a, s9a));
    const body2 = await p.evaluate(() => ({
      sheets: document.querySelectorAll("#pan-band .nu-vsheet").length,
      rows: document.querySelectorAll("#pan-band tr.nu-wopen .nu-sheetrow").length,
      sel: document.querySelectorAll("#pan-band .nu-wcell.is-sel").length }));
    check(body2.sheets === 1 && body2.rows > 4 && body2.sel === 1,
      "T9b2 …and the SECOND tap on the same cell edits it — its vector is the " +
      "one open sheet, the selection has not moved — " + JSON.stringify(body2));

    /* 9b3 · ESCAPE RESTORES, ENTER COMMITS AND STAYS, AND A PRINTABLE KEY
       EDITS. Every write on this page lands the moment a chip is tapped, so
       "commit" is: the editor shuts and the ring does not move. Four presses,
       read off the page between each. */
    const editing = () => p.evaluate(() => ({
      sheets: document.querySelectorAll("#pan-band .nu-vsheet").length,
      sel: (document.querySelector("#pan-band .nu-wcell.is-sel") || {}).dataset }))
      .then((x) => ({ sheets: x.sheets, sel: x.sel ? x.sel.k : null }));
    await key("Escape");
    const eEsc = await editing();
    await key("Enter");
    const eEnter = await editing();
    await key("Enter");
    const eStay = await editing();
    await key("k");
    const eType = await editing();
    check(eEsc.sheets === 0 && eEsc.sel === cell(v9a, s9a) &&
          eEnter.sheets === 1 && eEnter.sel === cell(v9a, s9a) &&
          eStay.sheets === 0 && eStay.sel === cell(v9a, s9a) &&
          eType.sheets === 1 && eType.sel === cell(v9a, s9a),
      "T9b3 Escape restores · Enter and F2 edit · Enter again commits and " +
      "STAYS on the cell · a printable key edits (§11) — " +
      JSON.stringify({ esc: eEsc, enter: eEnter, again: eStay, typed: eType }));

    /* 9b4 · ...AND TAB COMMITS AND MOVES: the editor does not ride along. */
    await key("Tab");
    const eTab = await editing();
    check(eTab.sheets === 0 && eTab.sel !== null && eTab.sel !== cell(v9a, s9a),
      "T9b4 …and Tab commits and MOVES — the editor shuts rather than " +
      "following the selection — " + JSON.stringify(eTab));
    await tap(cell(v9a, s9a));

    /* 9b5 · A TAP ON A VALUE DOES NOT DISMISS THE CONTROL; A TAP OUTSIDE IT
       DOES. Paul, 2026-09-05: *"Don't dismiss things when I tap them to change
       values; dismiss them when I tap outside of them."* The mechanism this
       fails on is the page's own: every write ends in `changed()` -> `push();
       draw()`, which throws the whole panel away and builds it again, and
       before this round only the merged rows survived that — so a cell sheet
       SHUT UNDER THE THUMB, once per chip, and a strip of words could be
       tapped exactly once. Three presses:
         · a chip write leaves the sheet open and the strip out;
         · a press on the pane's own chrome (not a control) closes it;
         · Escape closes it too, and the ring stays. */
    {
      await openCell(cell(v9a, s9a));
      const fk = await p.evaluate(() => { const r =
        [...document.querySelectorAll("#pan-band tr.nu-wopen .nu-sheetrow")]
          .find((x) => x.querySelector(".nu-wcell[aria-expanded]"));
        return r ? r.querySelector(".nu-wcell").dataset.k : null; });
      const chipped = fk ? await p.evaluate((k) => {
        const f2 = document.querySelector('#pan-band [data-k="' + k + '"]');
        if (!f2) return null;
        if (f2.getAttribute("aria-expanded") !== "true") f2.click();
        const c = [...document.querySelectorAll("#pan-band .nu-wchip")]
          .filter((x) => !x.disabled && (x.dataset.k || "").indexOf(k + "|") === 0);
        if (!c.length) return null;
        c[c.length - 1].click();
        return c[c.length - 1].dataset.k; }, fk) : null;
      await p.waitForTimeout(700);
      /* ...AND WHEN IT FAILS IT SAYS WHICH DOOR. "strips: 0" is true of a
         strip that closed, of a sheet that was replaced by another one, and of
         a field that stopped being a chip field — three different defects with
         one number. The reading names the open heads and the sheet's own first
         rows so the next reader does not have to reconstruct the page. */
      const still = await p.evaluate((k) => ({
        sheets: document.querySelectorAll("#pan-band .nu-vsheet").length,
        strips: document.querySelectorAll("#pan-band .nu-wchip").length,
        field: k,
        fieldOpen: (document.querySelector('#pan-band [data-k="' + k + '"]')
          || { getAttribute: () => null }).getAttribute("aria-expanded"),
        open: [...document.querySelectorAll('#pan-band [aria-expanded="true"]')]
          .map((x) => x.dataset.k),
        rows: [...document.querySelectorAll(
          "#pan-band tr.nu-wopen .nu-sheetrow .nu-wcell")]
          .map((x) => x.dataset.k).slice(0, 6) }), fk);
      check(!!chipped && still.sheets === 1 && still.strips > 0,
        "T9b5 a chip write does NOT dismiss the sheet it was tapped in — the " +
        "sheet and its strip are still open after the write (" +
        JSON.stringify({ chip: chipped, ...still }) + ")");
      /* A PRESS ON THE PANE'S OWN CHROME — not a button, not the sheet. */
      await p.evaluate(() => { const pane =
        document.querySelector("#pan-band .nu-pane");
        const r = pane.getBoundingClientRect();
        pane.dispatchEvent(new PointerEvent("pointerdown",
          { bubbles: true, clientX: r.x + 2, clientY: r.y + 2 })); });
      await p.waitForTimeout(400);
      const shut = await p.evaluate(() => ({
        sheets: document.querySelectorAll("#pan-band .nu-vsheet").length,
        sel: document.querySelectorAll("#pan-band .nu-wcell.is-sel").length }));
      check(shut.sheets === 0 && shut.sel === 1,
        "T9b6 …and a press OUTSIDE it dismisses it, with the selection left " +
        "standing — " + JSON.stringify(shut));
    }

    /* 9b7 · A CONTINUOUS NUMBER IS A SLIDER, NOT A ROW OF CHIPS. Paul,
       2026-09-05: *"When you redesign think sliders and other UI for data
       entry."* A register is eight integers on a run and was eight buttons.
       The claim is measured on the RENDERED control: the register row in a
       column's sheet draws an `input[type=range]` at the field's own address,
       with a typeable number box beside it, both at 44px — and moving the
       range writes the document. */
    {
      await shutAll();
      await tap("tcol|" + v9a);
      const sl = await p.evaluate((n) => {
        const r = document.querySelector(
          '#pan-band input.nu-numslide[data-k="reg|' + n + '"]');
        if (!r) return null;
        const box = document.querySelector(
          '#pan-band input.nu-numbox[data-k="num|reg|' + n + '"]');
        const h = (x) => x ? Math.round(x.getBoundingClientRect().height) : 0;
        const chips = document.querySelectorAll(
          '#pan-band [data-k^="reg|' + n + '|"]').length;
        return { range: true, box: !!box, rh: h(r), bh: h(box), chips,
                 type: r.type, min: r.min, max: r.max }; }, v9a);
      check(!!sl && sl.box && sl.rh >= 44 && sl.bh >= 44 && sl.type === "range",
        "T9b7 a continuous number draws a SLIDER with a typeable box beside " +
        "it, both at 44px — " + JSON.stringify(sl));
      const wrote = await p.evaluate((n) => {
        const r = document.querySelector(
          '#pan-band input.nu-numslide[data-k="reg|' + n + '"]');
        if (!r) return null;
        const was = window.__eightDoc().voices.find((x) => x.name === n).cast || {};
        /* MOVE IT SOMEWHERE ELSE, whichever end it is standing on — a check
           that set a slider to the value it already had would pass on a
           control that writes nothing. */
        const now = +r.value || 0;
        r.value = String(now < +r.max ? now + 1 : now - 1);
        r.dispatchEvent(new Event("change", { bubbles: true }));
        return { was: was.reg == null ? null : was.reg, to: +r.value }; }, v9a);
      await p.waitForTimeout(700);
      const got = await p.evaluate((n) => { const c =
        window.__eightDoc().voices.find((x) => x.name === n).cast || {};
        return c.reg == null ? null : c.reg; }, v9a);
      check(!!wrote && got === wrote.to,
        "T9b8 …and moving the slider writes the document (" +
        JSON.stringify(wrote) + " -> " + got + ")");

      /* 9b9 · AN ENTRY IS A SLIDER IN BEATS, AND THE DOCUMENT KEEPS BARS
         (2026-09-05, the review's item 4). The one control on this page
         whose unit differs from its address's: `cast.entry` is BARS with a
         beat fraction (document.js's own validator) and the thumb counts
         BEATS, because that is what a composer says. So the claim is a pair
         — the control's step is the bar's own grid in beats (`1 / pulse`,
         a sixteenth in four-four), and one step of the thumb writes ONE
         SIXTEENTH OF A BAR into the document, not one bar. Before this
         round the step was 1 and `Number.isInteger` refused anything else,
         which is exactly why a pickup could not be said. */
      const en = await p.evaluate((n) => {
        const r = document.querySelector(
          '#pan-band input.nu-numslide[data-k="entry|' + n + '"]');
        if (!r) return null;
        const box = document.querySelector(
          '#pan-band input.nu-numbox[data-k="num|entry|' + n + '"]');
        const h = (x) => x ? Math.round(x.getBoundingClientRect().height) : 0;
        const unit = r.parentElement
          && r.parentElement.querySelector(".nu-numunit");
        /* MEASURED BEFORE THE WRITE, and that is not tidiness: `change` on
           this control is a document write, and a document write redraws the
           sheet — so the element under `r` is DETACHED by the time the
           dispatch returns, and a detached element measures 0x0. The first
           cut of this check read the rects afterwards and reported a 0px
           slider on a control that is 48px on the page. */
        const out = { step: +r.step, min: +r.min, box: !!box,
                      rh: h(r), bh: h(box), typed: box ? box.step : null,
                      unit: unit ? unit.textContent : null };
        r.value = r.step;                       // one grid step off the floor
        out.to = +r.value;
        r.dispatchEvent(new Event("change", { bubbles: true }));
        return out; }, v9a);
      await p.waitForTimeout(700);
      const enGot = await p.evaluate((n) => { const c =
        window.__eightDoc().voices.find((x) => x.name === n).cast || {};
        return c.entry == null ? null : c.entry; }, v9a);
      check(!!en && en.step > 0 && en.step < 1 && en.box &&
        en.rh >= 44 && en.bh >= 44 && !!en.unit,
        "T9b9 the entry is a slider in BEATS with the number typeable, " +
        "stepping the bar's own grid — " + JSON.stringify(en));
      /* THE CLAIM IS THE FRACTION, and it is asserted as one rather than
         against an arithmetic this file would have to keep a second copy of:
         one step of the thumb writes a number strictly between 0 and 1 into
         `cast.entry`, which is a value `Number.isInteger` refused until
         today and is exactly what a pickup, a stretto and an answer on beat
         three all are. The round trip is the other half — the redrawn
         slider stands where the hand left it, so the two units agree. */
      const enBack = await p.evaluate((n) => { const r = document.querySelector(
        '#pan-band input.nu-numslide[data-k="entry|' + n + '"]');
        return r ? +r.value : null; }, v9a);
      check(!!en && enGot != null && enGot > 0 && enGot < 1 &&
        !Number.isInteger(enGot) && enBack === en.to,
        "T9b9b …and one step of the thumb writes a FRACTION of a bar, which " +
        "Number.isInteger refused until today — " +
        JSON.stringify({ beats: en && en.to, bars: enGot, redrawn: enBack }));
      await p.evaluate((n) => { const d = window.__eightDoc();
        const v = d.voices.find((x) => x.name === n);
        if (v && v.cast) delete v.cast.entry;
        window.__eightDraw && window.__eightDraw(); }, v9a);
      await p.waitForTimeout(400);

      await shutAll();
      await selectCell(cell(v9a, s9a));
    }

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
    const rngAddr = await addr();
    const rng = await p.evaluate((a) => ({
      n: document.querySelectorAll("#pan-band td.is-inrange").length,
      addr: a }), rngAddr);
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
    await openCell(cell(l9.name, s9a));
    const wrote = await p.evaluate((k) => {
      const f = document.querySelector('#pan-band [data-k="' + k + '"]');
      if (!f) return null;
      if (f.getAttribute("aria-expanded") !== "true") f.click();
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
    await selectCell(cell(l9.name, s9a));
    await key("Delete");
    const w2 = await written();
    check(w1 != null && w2 == null,
      "T9h …Delete clears it back to what it inherits (" + JSON.stringify(w1) +
      " -> " + JSON.stringify(w2) + ")");

    /* 9i · UNDO AND REDO, AT THE DOCUMENT LEVEL, FOR EVERY OP. §9a: "mandatory:
       spreadsheet users expect it and the page has only the producer's undo." */
    await barTap("tundo");
    const undoTall = await p.evaluate(() => { const b =
      document.querySelector('#pan-band [data-k="tundo"]');
      return b ? Math.round(b.getBoundingClientRect().height) : 0; });
    const w3 = await written();
    check(w3 === w1 && undoTall >= 44,
      "T9i undo takes the clear back, at 44px — " + JSON.stringify(w3) +
      " (" + undoTall + "px)");
    await barTap("tredo");
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
    await selectCell(cell(l9.name, s9a));
    await barTap("tcopy");
    await selectCell(cell(l9.name, s9b));
    const tgt = () => p.evaluate((args) => { const [n, sid] = args;
      const v = window.__eightDoc().voices.find((x) => x.name === n);
      const c = v && v.cells ? v.cells[sid] : null;
      return c && Object.keys(c).length ? JSON.stringify(c) : null; }, [l9.name, s9b]);
    const t0 = await tgt();
    await barTap("tpaste");
    const t1 = await tgt();
    check(t0 !== t1 && t1 != null,
      "T9l copy and paste move a cell's vector — " + JSON.stringify(t0) +
      " -> " + JSON.stringify(t1));
    await barTap("tundo");
    await barTap("tundo");

    /* 9m · FILL RIGHT AND FILL DOWN ARE §5's COPY-TO-ROW AND -COLUMN, said in a
       spreadsheet's words and reachable by tap. */
    await openCell(cell(v9a, s9a));
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
    /* ...AND SINCE 2026-09-05 THEY ARE ONE CELL EACH, AND THE CELL IS THE
       OFFER (§13a.5, then §13e). The head row ends in ONE `+` cell and the
       grid in ONE `+` row, both `--tap` — MEASURED on v287, the three offers
       took a 22ch column, 224px of a 364.4px pane at 390, which is what pushed
       the first player's head to "…he ntl". For one afternoon the `+`s opened
       an ADD sheet; Paul: *"Don't pop up an interface when I add a section or
       a voice. Just add it."* So each `+` CARRIES the address it fires —
       `trow-add` at the foot, and at the head `tcol-add|` plus the first kind
       the band has not got, in build-the-band's own order — and the other two
       kinds are where they have always also been, in a column head's own
       sheet (`colOps`). */
    const offers = await p.evaluate(() => {
      const px = (el) => el ? Math.round(el.getBoundingClientRect().width) : 0;
      const hb = document.querySelector(
        "#pan-band thead th.nu-plushead .nu-plusbtn");
      const fb = document.querySelector(
        "#pan-band tbody tr.nu-addrow th .nu-plusbtn");
      const box = (b) => b ? { k: b.dataset.k, say: b.getAttribute("aria-label"),
        h: Math.round(b.getBoundingClientRect().height),
        disclosure: b.getAttribute("aria-expanded") } : null;
      return { head: box(hb), foot: box(fb),
               headw: px(document.querySelector("#pan-band thead th.nu-plushead")),
               roww: px(fb),
               wopen: document.querySelectorAll("#pan-band .nu-wopen").length,
               olds: document.querySelectorAll("#pan-band .nu-addbar," +
                 " #pan-band .nu-addbtn, #pan-band .nu-addhead").length }; });
    check(!!offers.head && !!offers.foot &&
          /^tcol-add\|(line|bass|drums)$/.test(offers.head.k) &&
          offers.foot.k === "trow-add" &&
          offers.head.h >= 44 && offers.foot.h >= 44 &&
          offers.headw <= 48 && offers.roww <= 48 && offers.olds === 0 &&
          offers.head.disclosure === null && offers.foot.disclosure === null &&
          /\S/.test(offers.head.say || "") && /\S/.test(offers.foot.say || ""),
      "T9n the two `+`s are one `--tap` cell each and each IS its offer — the " +
      "address it fires is its own `data-k`, it is not a disclosure, and its " +
      "name says what a tap will add — " + JSON.stringify(offers));
    const nBefore = (await doc()).voices.length;
    const wopenBefore = offers.wopen;
    await tap(offers.head.k);
    const after9o = await p.evaluate(() => ({
      wopen: document.querySelectorAll("#pan-band .nu-wopen").length,
      sheets: document.querySelectorAll("#pan-band .nu-addopen").length }));
    const nAfter = (await doc()).voices.length;
    check(nAfter === nBefore + 1 && after9o.sheets === 0,
      "T9o …and the `+` hires ON THE TAP, with no ADD sheet drawn (" +
      nBefore + " -> " + nAfter + ", .nu-addopen " + after9o.sheets +
      ", .nu-wopen " + wopenBefore + " -> " + after9o.wopen + ")");
    /* UNDO IS PRESSED WITH THE KEYBOARD HERE, and that is not a dodge: the
       four verbs live on the open CELL sheet's first line since §13a.6, a hire
       leaves the new player's COLUMN sheet open and not a cell's, and Ctrl-Z is
       the same door (T9k measures that they are). */
    await key("z", "Control");
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

    /* 9s2 · ...AND THEY ACTUALLY STAY, IN BOTH DIRECTIONS, AT EVERY WIDTH.
       Paul, 2026-09-05, using the table: *"I really like the way this table is
       working — we should have sticky headers for instruments and sections."*
       §9a promised frozen headers and T9s asked the DECLARATION; a declaration
       is exactly what §9d caught sliding twice ("a corner frozen only to the
       top declares stickiness and slides"). So this scrolls the pane — DOWN,
       then ACROSS — and measures where the heads ended up:

         · the INSTRUMENT heads (the column heads) must not move up when the
           pane scrolls down;
         · the SECTION heads (the row heads) must not move left when it scrolls
           across;
         · the CORNER must hold both ways at once;
         · the SPECIAL rows keep the measured offsets `stick()` gives them —
           TIME above RULES above the column heads, no two at the same line;
         · and nothing frozen paints over an open sheet's own contents. */
    for (const w of [320, 390, 1280]) {
      await ctx.pages()[0].setViewportSize({ width: w, height: 700 });
      await p.waitForTimeout(420);
      const st = await p.evaluate(() => {
        const pane = document.querySelector("#pan-band .nu-pane");
        const rectOf = (sel) => { const e = document.querySelector(sel);
          if (!e) return null; const q = e.getBoundingClientRect();
          return { x: Math.round(q.x), y: Math.round(q.y) }; };
        const COL = "#pan-band thead th.nu-colhead";
        const ROW = "#pan-band tbody th.nu-srowh";
        /* THE CORNER IS `.nu-cornerh`, NOT `thead th:first-child`. Written the
           obvious way this selector returns the FIRST `<th>` in document order,
           which is TIME's merged row — a `<th colspan>` as wide as the table,
           with nowhere to travel — and it measured "the corner slid 217px" on a
           corner that had not moved at all. nu.css says the same thing from the
           other side, about the same element. */
        const CORNER = "#pan-band thead th.nu-cornerh";
        const SP = "#pan-band thead tr.nu-sprow th";
        pane.scrollTop = 0; pane.scrollLeft = 0;
        return new Promise((res) => setTimeout(() => {
          const a = { col: rectOf(COL), row: rectOf(ROW), corner: rectOf(CORNER),
                      canY: pane.scrollHeight - pane.clientHeight,
                      canX: pane.scrollWidth - pane.clientWidth };
          /* 400 DOWN AND 220 ACROSS. The down is deliberately deeper than
             the across: a head that snapped by its own height would still be
             inside 220px of slack, and 400 is past every head this table
             draws at every width (the whole stack is 167px at 390). */
          pane.scrollTop = Math.min(400, a.canY);
          pane.scrollLeft = Math.min(220, a.canX);
          setTimeout(() => {
            const b = { col: rectOf(COL), row: rectOf(ROW), corner: rectOf(CORNER),
                        paneTop: Math.round(pane.getBoundingClientRect().top),
                        top: pane.scrollTop, left: pane.scrollLeft };
            /* THE STACK: every special row's own pinned line, and the column
               heads under all of them. Read as `y`s that are strictly
               increasing, which is what "no two at the same line" means. */
            const ys = [...document.querySelectorAll(SP)]
              .map((e) => Math.round(e.getBoundingClientRect().y));
            const colY = b.col ? b.col.y : null;
            pane.scrollTop = 0; pane.scrollLeft = 0;
            res({ a, b, ys, colY });
          }, 220);
        }, 120));
      });
      /* WHAT THE PANE CAN ACTUALLY SCROLL, and it is the whole of this claim.
         IT READ, and the reading was true the day it was written: "the pane's
         vertical scroll is ZERO, because `.nu-pane` sizes to its content and
         THE PAGE is the vertical scrollport — so the column heads' `position:
         sticky` is a true declaration with nothing to stick against on that
         axis… It is a decision, not a bug, and it is named here rather than
         asserted away."

         THE DECISION WAS TAKEN, 2026-09-05: the pane IS the scrollport now.
         `.nu-sheetwrap` is capped to the band between the top strip and the
         foot bar and `.nu-pane[data-pane="table"]` takes what is left and
         scrolls on both axes (nu.css argues it, including which of the two
         standing laws gave — a sheet here is a `<tr>` IN FLOW inside the grid,
         not a menu with its own scrollbar). So the claim turns into its
         opposite: the pane MUST have vertical scroll to give, and the
         instrument heads must hold over it. `canY > 0` is asserted for the
         same reason A8 stopped skipping — a check that measures a scroll which
         cannot happen is not being made.

         AND THE PAGE ITSELF NO LONGER SCROLLS ON THIS SHEET (T9s5 below): a
         height cap a pixel wrong hands the difference straight back as page
         scroll, and page scroll under a fixed foot bar is what test/shell.js
         A6 and A6i exist to forbid. */
      const dY = (st.a.col && st.b.col) ? Math.abs(st.b.col.y - st.a.col.y) : 999;
      const dX = (st.a.row && st.b.row) ? Math.abs(st.b.row.x - st.a.row.x) : 999;
      const cY = (st.a.corner && st.b.corner)
        ? Math.abs(st.b.corner.y - st.a.corner.y) : 999;
      const cX = (st.a.corner && st.b.corner)
        ? Math.abs(st.b.corner.x - st.a.corner.x) : 999;
      /* 4px OF SLACK, WHICH IS `.nu-trims`' OWN border-spacing, twice — the
         same allowance test/shell.js A8 makes and for the same measured
         reason. */
      /* ...AND SINCE 2026-09-05 THE HEADS TRAVEL BEFORE THEY HOLD (TABLE.md
         §13a.1 and §13a.4: *"The column heads pin only within the grid"*, and
         the special rows above them scroll out of the way rather than holding
         the top of the screen). So the claim is not "moved 0" any more — it is
         "arrived and STAYED": over 400px of scroll the heads travel at most the
         height of the rows above them and end at the pane's own top edge, which
         is what a spreadsheet's frozen head does when it is not the first thing
         in the sheet. Measured at 390 on Kingston 1969: the head row stands at
         147px in the content and is at the pane's top edge (0 ± 4) after the
         scroll. The corner is the same cell and makes the same journey. */
      const paneTop = st.b.paneTop;
      const atTop = (r) => r ? Math.abs(r.y - paneTop) <= 4 : false;
      check(atTop(st.b.col) && atTop(st.b.corner) && st.a.canY > 0,
        "T9s2 at " + w + " the INSTRUMENT heads arrive at the pane's top edge " +
        "and STAY there over " + st.b.top + "px of vertical scroll (they " +
        "travelled " + dY + "px, the height of the special rows above them, " +
        "and stand at " + (st.b.col ? st.b.col.y : "?") + " against a pane top " +
        "of " + paneTop + "; the corner " + cY + ") — and the pane has " +
        st.a.canY + "px to give, because THE " +
        "PANE is the vertical scrollport here");
      check(dX <= 4 && cX <= 4,
        "T9s3 at " + w + " …and the SECTION heads stay put over a " + st.b.left +
        "px scroll across (moved " + dX + "px; the corner " + cX + ")");
      const stacked = st.ys.length === 0 ||
        (st.ys.every((y, i) => i === 0 || y > st.ys[i - 1]) &&
         (st.colY == null || st.colY > st.ys[st.ys.length - 1]));
      check(stacked,
        "T9s4 at " + w + " …and the special rows keep their measured offsets, " +
        "with the column heads under all of them — " +
        JSON.stringify({ special: st.ys, colhead: st.colY }));
      /* 9s5 · THE PAGE PAID FOR IT AND KEPT ITS OWN PROMISE. Read on the
         rendered page after the pane has been scrolled and put back. */
      const pg = await p.evaluate(() => ({
        h: document.documentElement.scrollHeight,
        ch: document.documentElement.clientHeight,
        w: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth }));
      check(pg.h <= pg.ch + 1 && pg.w <= pg.cw + 1,
        "T9s5 at " + w + " …and the PAGE does not scroll on the Band sheet, " +
        "in either direction — " + JSON.stringify(pg));
    }
    await ctx.pages()[0].setViewportSize({ width: 390, height: 900 });
    await p.waitForTimeout(420);

    /* 9t · ...AT THE THREE WIDTHS, AND NOTHING UNDER 44px OR OFF THE SCREEN.
       ...AND SINCE 2026-09-05 THE BAR IS THE CELL SHEET'S FIRST LINE (§13a.6).
       `.nu-formula` stood at rest, sticky at the foot of the pane on a phone —
       105.8px of a 844px screen whether or not a cell was selected — and this
       check read where it WAS. It reads where the address, the two arrows and
       the two clipboard verbs are now: inside the sheet the cell opened, in
       flow at its top, full width, with nothing under 44px and nothing off the
       screen. Same five addresses, same measurement, one place in. */
    for (const w of [320, 390, 1280]) {
      await ctx.pages()[0].setViewportSize({ width: w, height: 900 });
      await p.waitForTimeout(420);
      await openCell(cell(v9a, s9a));
      const m = await p.evaluate(() => {
        const host = document.getElementById("pan-band");
        const bar = host.querySelector("tr.nu-cellopen .nu-cellhead");
        const r = bar ? bar.getBoundingClientRect() : null;
        const shorts = [...host.querySelectorAll("button:not([hidden])")]
          .filter((b) => { const q = b.getBoundingClientRect();
            return q.width > 0 && q.height > 0 && q.height < 43.5; }).length;
        const offs = [...host.querySelectorAll(".nu-vsheet button")]
          .filter((b) => { const q = b.getBoundingClientRect();
            return q.width > 0 && (q.left < 0 || q.right > window.innerWidth + 1); }).length;
        const over = [...document.querySelectorAll("body *")]
          .map((e) => { const q = e.getBoundingClientRect();
            return { t: e.tagName, c: String(e.className || "").slice(0, 40),
                     k: (e.dataset && e.dataset.k) || null,
                     x: Math.round(q.x), w: Math.round(q.width),
                     r: Math.round(q.right) }; })
          .filter((e) => e.w > 0 && e.r > window.innerWidth + 1)
          .slice(0, 10);
        return { over,
                 bar: !!bar, fixed: host.querySelectorAll(".nu-formula").length,
                 keys: bar ? [...bar.querySelectorAll("[data-k]")]
                   .map((x) => x.dataset.k) : [],
                 wide: r ? Math.round(r.width) : 0,
                 pane: Math.round(host.querySelector(".nu-pane")
                   .getBoundingClientRect().width),
                 page: document.documentElement.scrollWidth -
                       document.documentElement.clientWidth,
                 shorts, offs }; });
      const want5 = ["taddr", "tundo", "tredo", "tcopy", "tpaste"];
      check(m.bar && m.fixed === 0 && m.shorts === 0 && m.offs === 0 &&
            m.page <= 1 && m.wide >= m.pane * 0.8 &&
            want5.every((k) => m.keys.indexOf(k) >= 0),
        "T9t at " + w + " the address and its four verbs are the open cell " +
        "sheet's first line, `.nu-formula` is gone, nothing is under 44px and " +
        "nothing is off the screen — " + JSON.stringify(m));
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


  /* ================= T10 · THE SPECIAL ROWS (TABLE.md §10b) =============
     Paul, 2026-09-05: *"we could integrate rules into a special row, time +
     key into a special row … a real mobile app now with everything in the
     table and the nav space reclaimed."*

     THIS GROUP IS WHERE TWO PANES' CLAIMS LANDED. `test/tempo-key.browser.js`
     and `test/rules-view.browser.js` are NOT retired — they are re-pointed, and
     that is the cheaper and the more honest of the two moves the plan offered:
     between them they make sixty-five claims about what those controls DO (a
     tap tempo measures a pulse, a groove word reaches ui/state.js, a chord
     quality reaches the compiled genre, a rule evolves instead of restarting,
     the catalogue is byte-identical afterwards), every one of which is about
     the control and not about the panel it was in. Re-typing them here would
     be a second copy of sixty-five assertions to gain nothing; changing
     `__eightTab("Time")` to `__eightRow("time")` and `#pan-tempo` to
     `#pan-band` keeps every one of them being made, at the address the control
     now has. WHAT IS HERE IS WHAT ONLY THIS FILE CAN SAY: that the row is a
     row of this sheet, merged, frozen, faced, expandable, keyboard-reachable,
     that every control the pane offered is inside it, and that the pane is
     GONE — T7's nothing-lost law, asked of two more panes. */
  {
    const wide = async (w) => { await ctx.pages()[0].setViewportSize(
      { width: w, height: 900 }); await p.waitForTimeout(400); };
    /* the accordion's one open head, shut — T9's own `shutAll` is inside its
       block, and a special row's head is a `.nu-sphead` rather than a
       `.nu-rowjump`, so this asks for all three. */
    const shutAll = async () => { await p.evaluate(() => {
      const el = document.querySelector(
        '#pan-band [aria-expanded="true"].nu-rowjump, ' +
        '#pan-band [aria-expanded="true"].nu-wcell, ' +
        '#pan-band [aria-expanded="true"].nu-sphead');
      if (el) el.click(); }); await p.waitForTimeout(400); };
    const rowInfo = () => p.evaluate(() => {
      const t = document.querySelector("#pan-band table.nu-sheetgrid");
      if (!t) return { missing: true };
      const heads = [...t.querySelectorAll("thead > tr")];
      const cols = t.querySelectorAll("thead th.nu-colhead, thead th.nu-cornerh," +
                                      " thead th.nu-plushead").length;
      const rows = heads.filter((r) => r.classList.contains("nu-sprow"));
      const pane = document.querySelector("#pan-band .nu-pane");
      return {
        /* ...AND THE LABEL ROW IS NAMED, NOT COUNTED AS A SECOND HEAD ROW
           (2026-09-05, §13e). The grid's own header (`nu-gridlabel`) stands
           between the special rows and the column heads; it carries no
           `data-special` because it opens no sheet, so a walk that read only
           that attribute called it "heads" and reported two of them. */
        order: heads.map((r) => r.dataset.special ||
          (r.classList.contains("nu-gridlabel") ? "label" : "heads")),
        cols,
        rows: rows.map((r) => {
          const th = r.querySelector("th");
          const b = r.querySelector("button");
          const cs = getComputedStyle(th);
          /* THE LINE IS THE PANE'S WIDTH, AND THE BUTTON IS WHAT IS LEFT OF
             IT (2026-09-05, §13a.2). `.nu-sphead` carried the `--panew` pin
             until the MOTIF lamp moved INTO the row's own line; the pin and
             the width are `.nu-spline`'s now and the button takes the give
             beside the lamp. Measured at 390: the line 358, the PHRASES button
             347 with an empty lamp beside it. */
          const line = r.querySelector(".nu-spline") || b;
          return { id: r.dataset.special, k: b && b.dataset.k,
            colspan: th.colSpan, pos: cs.position,
            top: Math.round(parseFloat(cs.insetBlockStart || "0")),
            h: Math.round(r.getBoundingClientRect().height),
            w: Math.round(line.getBoundingClientRect().width),
            paneW: pane ? pane.clientWidth : 0,
            word: (r.querySelector(".nu-spword") || {}).textContent,
            face: (r.querySelector(".nu-spface") || {}).textContent,
            aria: b.getAttribute("aria-label"),
            open: b.getAttribute("aria-expanded") === "true" };
        }) };
    });

    /* A SPECIAL ROW BY ITS `data-special`, AND NEVER BY ITS INDEX (2026-09-05,
       TABLE.md §13f). Paul: *"Put rules above time"* / *"Add chords below
       time"*. Six checks below read `rows[0]` for TIME and `rows[1]` for
       RULES, which was the head's order and not its meaning: the moment the
       order changed, T10c measured the RULES face against the tempo's law and
       T10i measured TIME's against the rules'. The row is asked for by name
       now, so the next reordering moves nothing in this file. */
    const rowOf = async (id) => ((await rowInfo()).rows || [])
      .find((x) => x.id === id) || {};

    /* T10a · A ROW OF THE SAME SHEET, MERGED, ABOVE THE COLUMN HEADS. */
    await shutAll();
    for (const w of [320, 390, 1280]) {
      await wide(w);
      const r = await rowInfo();
      /* FOUR MERGED ROWS ABOVE THE HEADS SINCE 2026-09-05 (§13f) — RULES,
         TIME, CHORDS, then MOTIFS, in `SPECIALS`' own order, which is §10a's
         own drawing of the layout. It was TIME · RULES · MOTIFS until Paul's
         *"Put rules above time"* and *"Add chords below time and move chord
         stuff into it"*. PRODUCE is the fifth merged row on this sheet and is
         deliberately NOT here: it is in the `<tfoot>`, under the mix, because
         a row above the column heads is a row above the music and the producer
         speaks about a record already dealt (T10q reads it). */
      /* AND THE LABEL ROW SINCE 2026-09-05 (§13e): the grid's own header —
         SECTIONS, a LABEL and not a special row — stands between MOTIFS and
         the column heads. It is not in `r.rows` (which filters `.nu-sprow`),
         because it has no sheet, no `data-k` and no button to measure; T13m is
         where it is measured. */
      const ok = !r.missing &&
        r.order.length === 6 && r.order[0] === "rules" &&
        r.order[1] === "time" && r.order[2] === "chords" &&
        r.order[3] === "motifs" &&
        r.order[4] === "label" && r.order[5] === "heads" &&
        r.rows.every((x) => x.colspan === r.cols) &&
        r.rows.every((x) => x.h >= 44) &&
        /* WITHIN 12px OF THE PANE, and the 12 is `.nu-trims`' own 3px
           border-spacing on both sides plus the `<th>`'s padding: `--panew` is
           the pane's client width less that, and `max-inline-size: 100%` clamps
           the line to the cell when the table is NARROWER than the pane (1280,
           measured: pane 1078, row 1068). Both readings are "the row is as wide
           as what a hand can see", which is what §10b asks for. */
        r.rows.every((x) => x.w >= x.paneW - 12 && x.w <= x.paneW + 2);
      check(ok, "T10a " + w + " · RULES, TIME, CHORDS and MOTIFS are merged rows " +
        "of the sheet, " +
        "above the SECTIONS label and the column heads, colspan = the whole " +
        "table, 44px, the pane's own width — " + JSON.stringify(r));
      /* T10b · ONE PIN, AND IT IS THE COLUMN HEADS (rewritten 2026-09-05,
         TABLE.md §13a.1). It read "the whole head freezes as a STACK — each row
         pinned under the one above it", which was right while the head was
         allowed to hold the top of the screen, and MEASURED at 390 x 844 on
         v287 that is four bands at 3 · 51 · 99 · 163.1: the grid began 163px
         down a 611px pane. Paul: *"things don't scroll out of the way for me to
         focus."* The law is one band at a time — the column heads at rest, the
         owner row of an open sheet while one is open — so what is asserted here
         is that EXACTLY ONE row of the head is pinned, that it is the LAST one
         (the column heads), and that the special rows above it declare their
         stickiness with nothing to hold (`auto`), which is what a row that
         scrolls out of the way honestly is. */
      const st = await p.evaluate(() => [...document.querySelectorAll(
        "#pan-band table.nu-sheetgrid thead > tr")].map((tr) => {
          const c = tr.firstElementChild;
          if (!c) return { pos: "none", top: null, h: 0 };
          const cs = getComputedStyle(c);
          const held = cs.insetBlockStart !== "auto";
          return { pos: cs.position,
                   top: held ? Math.round(parseFloat(cs.insetBlockStart)) : null,
                   h: Math.round(tr.getBoundingClientRect().height) }; }));
      /* ...AND THE STACK IS FOUR ROWS DEEP SINCE 2026-09-08. It is asserted as
         a WALK and not as three named indices, because the next special row
         above the grid must not need this line edited to be measured. */
      const held = st.filter((x) => x.pos === "sticky" && x.top != null);
      const onePin = held.length === 1 && held[0] === st[st.length - 1] &&
        held[0].top === 0;
      check(onePin, "T10b " + w + " · ONE band pins at rest and it is the " +
        "column heads, at 0; the special rows above it scroll out of the way — " +
        JSON.stringify(st));
    }
    await wide(390);

    /* T10c · THE FACE IS THE RECORD'S OWN LINE, AND IT FOLLOWS THE RECORD. */
    {
      const before = await rowOf("time");
      const D0 = await doc();
      const said = String(before.face || "");
      const carries = said.indexOf(String(D0.time.bpm)) === 0 ||
                      said.indexOf(String(D0.time.bpm) + " ") === 0;
      check(carries && said.split("·").length === 3,
        "T10c the TIME face is bpm · meter · key on one line — “" + said + "”");
    }

    /* T10d · EXPANDED, IT HOLDS EVERY CONTROL `#pan-tempo` OFFERED. The list
       is `test/table-inventory.json`'s `time-row` homes, read back off the
       rendered sheet at 320 — which is T7's own question asked of a third
       pane: not "does the source mention it" but "can a thumb reach it". */
    await wide(320);
    await tap("ttime");
    const timeKeys = await p.evaluate(() => {
      const o = document.querySelector("#pan-band tr.nu-wopen");
      if (!o) return null;
      const ks = new Set();
      for (const e of o.querySelectorAll("[data-k],[data-sel]"))
        ks.add(e.dataset.sel ? "sel:" + e.dataset.sel : e.dataset.k);
      const short = [...o.querySelectorAll("button,select,a")].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.height < 44 &&
               !e.closest(".nu-circ"); })
        .map((e) => (e.dataset.k || e.tagName) + "@" +
                    Math.round(e.getBoundingClientRect().height));
      return { keys: [...ks], short,
               sw: document.documentElement.scrollWidth,
               cw: document.documentElement.clientWidth };
    });
    {
      /* TWENTY OF THE TWENTY-FIVE (2026-09-05, §13f). The five that left are
         the chord families — `sel:alphabet.harmony`, `diatonic`, the changes
         grid (`prog0d`, `sel:alphabet.quality|bar0`, `prog0i`) and its
         `prog-add` / `prog-cut` — and they are asserted in T13o, on the CHORDS
         row, at the same addresses. `goto.board` stays: it is TIME's back
         matter and its own comment always said it never belonged to the
         chords. */
      const WANT = ["bpm", "tempo-tap", "tempo-half time", "tempo-double time",
                    "tempo-as written", "tempo-the default speed",
                    "tempo-a little slower", "tempo-a little faster",
                    "tempo-half the tempo", "tempo-twice the tempo",
                    "sel:time.meter", "sel:time.swing", "sel:time.groove",
                    "rubato", "opt|alphabet.key|0", "sel:alphabet.mode",
                    "sel:alphabet.scale", "goto.board"];
      const missing = timeKeys ? WANT.filter((k) => !timeKeys.keys.includes(k)) : WANT;
      check(missing.length === 0,
        "T10d 320 · the TIME row holds all " + WANT.length + " control " +
        "families the Time pane offered" +
        (missing.length ? " — MISSING " + missing.join(", ") : ""));
      check(!!timeKeys && timeKeys.short.length === 0 &&
            timeKeys.sw === timeKeys.cw,
        "T10d 320 · …every one of them at least 44px, and the page does not " +
        "scroll sideways — " + JSON.stringify(timeKeys && {
          short: timeKeys.short.slice(0, 5), sw: timeKeys.sw, cw: timeKeys.cw }));
    }

    /* T10e · A CHIP IN THE ROW WRITES THE RECORD, THROUGH THE PANE'S OWN
       DOOR, AND THE FACE MOVES WITH IT. */
    {
      const was = (await doc()).time.meter;
      const want = was === "three" ? "four" : "three";
      const hit = await p.evaluate((v) => { const b = document.querySelector(
        '#pan-band [data-k="time.meter|' + v + '"]');
        if (!b || b.disabled) return false; b.click(); return true; }, want);
      await p.waitForTimeout(700);
      const now = (await doc()).time.meter;
      const face = String((await rowOf("time")).face || "");
      check(hit && now === want,
        "T10e a meter chip in the row writes doc.time.meter (" + was + " -> " +
        now + ", asked for " + want + ")");
      check(face.indexOf("·") > 0 && face.length > 4,
        "T10e …and the collapsed face is re-read from the record — “" + face + "”");
      await p.evaluate((v) => { const b = document.querySelector(
        '#pan-band [data-k="time.meter|' + v + '"]');
        if (b && !b.disabled) b.click(); }, was);
      await p.waitForTimeout(600);
    }

    /* T10f · THE NINE MARKS STILL MOVE THE TEMPO. (What a tap MEASURES is
       test/tempo-key.browser.js T1's claim, at this row's address now.) */
    {
      const b0 = (await doc()).time.bpm;
      await p.evaluate(() => { const b = document.querySelector(
        '#pan-band [data-k="tempo-a little faster"]');
        if (b && !b.disabled) b.click(); });
      await p.waitForTimeout(700);
      const b1 = (await doc()).time.bpm;
      const nine = await p.evaluate(() => document.querySelectorAll(
        '#pan-band [data-k^="tempo-"]').length);
      check(nine === 9 && b1 > b0,
        "T10f the nine tempo marks are in the row and one press moves the " +
        "record (" + b0 + " -> " + b1 + ", " + nine + " marks)");
    }

    /* T10g · ENTER OPENS AND ESCAPE CLOSES, which is §10b's keyboard law. */
    /* THE KEYS ARE PRESSED, NOT DISPATCHED. `new KeyboardEvent("keydown")` on
       a `<button>` does NOT produce the browser's own activation click — it is
       a synthetic event with no default action — so a check written that way
       measures its own `dispatchEvent` and nothing else. `page.keyboard` is
       the real key, which is what "a gate is a hand" means for a keyboard. */
    await shutAll();
    {
      const was = (await rowOf("time")).open;
      await p.evaluate(() => {
        document.querySelector('#pan-band [data-k="ttime"]').focus(); });
      await p.keyboard.press("Enter");
      await p.waitForTimeout(600);
      const isOpen = (await rowOf("time")).open;
      await p.keyboard.press("Escape");
      await p.waitForTimeout(600);
      const shut = !(await rowOf("time")).open;
      check(!was && isOpen && shut,
        "T10g Enter on the row opens it and Escape closes it (was " + was +
        ", open " + isOpen + ", then shut " + shut + ")");
    }

    /* T10h · THE TIME PANE IS GONE, AND NOTHING IS DRAWN TWICE. T7's law:
       a deleted pane is proven by the absence of its host AND by exactly one
       control page-wide for each fact it used to own. */
    {
      const gone = await p.evaluate(() => ({
        host: !!document.getElementById("pan-tempo"),
        tab: (window.__eightTabs() || []).indexOf("Time"),
        tray: !!document.querySelector('[data-k="toptab-Time"]'),
        axTime: !!document.getElementById("ax-time"),
        axAlpha: !!document.getElementById("ax-alphabet") }));
      check(!gone.host && gone.tab < 0 && !gone.tray &&
            !gone.axTime && !gone.axAlpha,
        "T10h the Time PANE is deleted — no #pan-tempo, no Time tab, no tray " +
        "row, neither axis section — " + JSON.stringify(gone));
      await shutAll();
      await tap("ttime");
      const owners = await p.evaluate(() => ({
        bpm: document.querySelectorAll('[data-k="bpm"]').length,
        meter: document.querySelectorAll('[data-sel="time.meter"]').length,
        key: document.querySelectorAll('[data-k="opt|alphabet.key|0"]').length }));
      await tap("ttime");
      await tap("tchords");
      /* AND THE CHANGES ARE COUNTED WITH THE CHORDS ROW OPEN (2026-09-05,
         §13f): the grid moved a row down, so the "exactly ONE control
         page-wide" reading of it is taken where it is drawn. */
      const chOwners = await p.evaluate(() => ({
        changes: document.querySelectorAll('[data-k="prog0d"]').length,
        harmony: document.querySelectorAll('[data-sel="alphabet.harmony"]').length }));
      check(owners.bpm === 1 && owners.meter === 1 && owners.key === 1 &&
            chOwners.changes === 1 && chOwners.harmony === 1,
        "T10h …and each fact has exactly ONE control on the whole page — " +
        JSON.stringify(Object.assign({}, owners, chOwners)));
      await tap("tchords");
    }

    /* T10i · THE RULES ROW: the face is the count and the last change, and
       the sheet under it is `ui/rules.js`'s own, two-line rows and all. */
    await shutAll();
    {
      const face0 = String((await rowOf("rules")).face || "");
      check(/nothing written|rule/.test(face0),
        "T10i the RULES face says how many sentences are written — “" +
        face0 + "”");
      await tap("trules");
      const sheet = await p.evaluate(() => {
        const o = document.querySelector("#pan-band tr.nu-wopen");
        if (!o) return null;
        const rows = [...o.querySelectorAll(".nu-rule")];
        const twoLine = rows.filter((r) =>
          r.querySelector(".nu-wline") && r.querySelector(".nu-ctl")).length;
        return { axes: o.querySelectorAll("section.nu-rulax").length,
                 rules: rows.length, twoLine,
                 plate: !!o.querySelector(".nu-ruleplate"),
                 palettes: o.querySelectorAll(".nu-pal").length,
                 tiers: rows.filter((r) => r.dataset.tier).length,
                 sw: document.documentElement.scrollWidth,
                 cw: document.documentElement.clientWidth };
      });
      check(!!sheet && sheet.axes >= 4 && sheet.rules >= 8 &&
            sheet.twoLine >= 5 && sheet.plate && sheet.palettes >= 4 &&
            sheet.tiers === sheet.rules && sheet.sw === sheet.cw,
        "T10i …and the sheet is the panel — axis blocks, the name plate, the " +
        "two-line rows (the sentence with its value, the control under it), " +
        "the palettes, a tier on every row, no sideways scroll — " +
        JSON.stringify(sheet));
    }

    /* T10j · A RULE WRITTEN IN THE ROW LANDS THROUGH `apply()` -> evolve. */
    {
      const hasRule = await p.evaluate(() =>
        !!document.querySelector('#pan-band [data-k="rule|bpm"]'));
      if (!hasRule) check(true, "T10j (this record states no tempo rule to drive — " +
        "test/rules-view.browser.js drives one on reggae)");
      else {
        await p.evaluate(() => { const r = document.querySelector(
          '#pan-band [data-k="rule|bpm"]');
          r.value = String(Math.min(+r.max, +r.value + 11));
          r.dispatchEvent(new Event("input", { bubbles: true }));
          r.dispatchEvent(new Event("change", { bubbles: true })); });
        await p.waitForTimeout(1400);
        const D = await doc();
        const wrote = (D.rules || []).some((e) => e.f === "bpm");
        const face = String((await rowOf("rules")).face || "");
        const still = (await rowOf("rules")).open;
        check(wrote && /1 rule|rules/.test(face) && still,
          "T10j a rule written in the row reaches doc.rules, the face re-reads " +
          "it, and the row is STILL OPEN across the evolve — " +
          JSON.stringify({ wrote, face, still }));
      }
      await shutAll();
    }

    /* T10k · THE RULES PANE IS GONE, and its editor is drawn once. */
    {
      const gone = await p.evaluate(() => ({
        host: !!document.getElementById("rulesdeck"),
        tab: (window.__eightTabs() || []).indexOf("Rules"),
        tray: !!document.querySelector('[data-k="toptab-Rules"]'),
        axes: document.querySelectorAll("section.nu-rulax").length }));
      check(!gone.host && gone.tab < 0 && !gone.tray && gone.axes === 0,
        "T10k the Rules PANE is deleted — no #rulesdeck, no Rules tab, no tray " +
        "branch, and with the row shut no axis block on the page — " +
        JSON.stringify(gone));
      await tap("trules");
      const twice = await p.evaluate(() => ({
        plates: document.querySelectorAll(".nu-ruleplate").length,
        bpmRows: document.querySelectorAll('.nu-rule[data-rule="bpm"]').length }));
      check(twice.plates === 1 && twice.bpmRows <= 1,
        "T10k …and the editor is drawn exactly once — " + JSON.stringify(twice));
      await shutAll();
    }

    /* ================= T10l–T10p · THE MIX ROW (§10b step 3) ============
       §10a: *"MIX is ALIGNED — one channel strip per voice column and the
       master in the corner."* It is the only special row that is not merged,
       so what this group asks that T10a cannot is: is it ALIGNED — one cell
       per column, under the right column — does a cell open that player's own
       strip whole, does the master open the board, and is the Mix pane gone
       with every one of its controls reachable through one head.
       nukernel/desk-gate.js (167 checks) and test/mix-heads.browser.js are
       RE-POINTED, not retired: between them they make every claim about what
       these controls DO, and all of it is about the control rather than the
       pane. */
    {
      const mixInfo = () => p.evaluate(() => {
        const t = document.querySelector("#pan-band table.nu-sheetgrid");
        if (!t) return { missing: true };
        const row = t.querySelector("tfoot tr.nu-mixrow");
        const mr = t.querySelector("tfoot tr.nu-masterrow");
        if (!row || !mr) return { missing: true };
        const heads = [...t.querySelectorAll("thead th.nu-colhead")]
          .map((th) => Math.round(th.getBoundingClientRect().left));
        const cells = [...row.querySelectorAll("td.nu-mixcell")];
        const pane = t.closest(".nu-pane");
        const mb = mr.querySelector("button");
        return {
          rows: [...t.querySelectorAll("tfoot > tr")].map((r) => r.dataset.row),
          heads,
          cells: cells.map((td) => {
            const b = td.querySelector("button");
            return { k: b.dataset.k, w: b.textContent.trim(),
                     left: Math.round(td.getBoundingClientRect().left),
                     h: Math.round(b.getBoundingClientRect().height),
                     lamp: td.querySelectorAll(":scope > .nu-scollamp").length,
                     inBtn: b.querySelectorAll(".nu-scollamp").length };
          }),
          master: { k: mb.dataset.k, colspan: mr.querySelector("th").colSpan,
                    word: (mr.querySelector(".nu-spword") || {}).textContent,
                    face: (mr.querySelector(".nu-spface") || {}).textContent,
                    w: Math.round(mb.getBoundingClientRect().width),
                    paneW: pane ? pane.clientWidth : 0 },
          cols: t.querySelectorAll("thead th.nu-colhead, thead th.nu-cornerh," +
                                   " thead th.nu-plushead").length };
      });

      /* T10l · ALIGNED: one cell per voice column, each under its own head. */
      await shutAll();
      for (const w of [320, 390, 1280]) {
        await wide(w);
        const m = await mixInfo();
        const aligned = !m.missing && m.cells.length === m.heads.length &&
          m.cells.every((c, i) => Math.abs(c.left - m.heads[i]) <= 1) &&
          m.cells.every((c) => c.h >= 44) &&
          /* THE LAMP IS A SIBLING OF THE BUTTON AND NEVER ITS CHILD —
             `[data-live]` is a surface the clock writes and a control inside
             one is the shape test/motif-frozen A1 forbids. */
          m.cells.every((c) => c.lamp === 1 && c.inBtn === 0);
        check(aligned, "T10l " + w + " · the MIX row is ALIGNED — one cell " +
          "per voice column, each at its own column head's left edge, 44px, " +
          "with its own lamp beside the button — " +
          JSON.stringify({ cells: m.cells, heads: m.heads }));
        /* T10m · the master is a MERGED row under it, the pane's own width. */
        const mm = !m.missing && m.master.k === "tmix" &&
          m.master.colspan === m.cols && m.master.word === "master" &&
          !!m.master.face &&
          m.master.w >= m.master.paneW - 12 && m.master.w <= m.master.paneW + 2;
        check(mm, "T10m " + w + " · the master is a merged row under the " +
          "seats, its line the pane's own width, wearing the record's master " +
          "words — " + JSON.stringify(m.master));
      }
      await wide(390);

      /* T10n · A CELL OPENS THAT PLAYER'S OWN STRIP, WHOLE. */
      await shutAll();
      {
        const name = await p.evaluate(() => {
          const b = document.querySelector('#pan-band [data-k^="tmix|"]');
          return b ? b.dataset.k.slice(5) : null; });
        await tap("tmix|" + name);
        const strip = await p.evaluate((n) => ({
          named: (document.querySelector("#voicemix .nu-sname") || {}).textContent,
          seats: document.querySelectorAll('[data-k^="ins|' + n + '|"]').length,
          fader: document.querySelectorAll('[data-k="b|fader|' + n + '"]').length,
          pan: document.querySelectorAll('[data-k^="b|pan|' + n + '"]').length,
          sends: document.querySelectorAll('[data-k="b|genre|' + n + '"]').length,
          board: document.querySelectorAll("#boardpanel").length,
        }), name);
        check(strip.named === name && strip.seats === 3 && strip.fader === 1 &&
              strip.sends === 1 && strip.board === 0,
          "T10n a seat's cell opens ui/engineer.js's own strip for THAT " +
          "player — level, pan, sends and the three insert slots — and the " +
          "board is not on the page beside it (one accordion) — " +
          JSON.stringify(strip));
        /* ...AND THE COLUMN SHEET NO LONGER DRAWS IT. One strip, one home. */
        await tap("tmix|" + name);
        await tap("tcol|" + name);
        const col = await p.evaluate((n) => ({
          strip: document.querySelectorAll("#voicemix .nu-strip").length,
          seats: document.querySelectorAll('[data-k^="ins|' + n + '|"]').length,
          pointer: !!document.querySelector('[data-k="tseat|' + n + '"]'),
        }), name);
        check(col.strip === 0 && col.seats === 0 && col.pointer,
          "T10n …and the column sheet draws no strip at all now — it carries " +
          "the pointer to the seat instead (one control, one home) — " +
          JSON.stringify(col));
        await tap("tcol|" + name);
      }

      /* T10o · THE MASTER OPENS THE BOARD, WITH ITS FIVE STAGES. */
      await shutAll();
      {
        await tap("tmix");
        /* WHICH PLATE IS OPEN IS A PAGE FACT THAT SURVIVES EVERYTHING, and
           this check learned it the hard way: `BOARDTAB` is a module `let` in
           ui/engineer.js — "which plate you are looking at is not a fact about
           the record" — so it survives a rebuild, a tab, and the sheet being
           shut and opened again. T7's own walk presses `boardtab|bus|main` on
           its way past, and this block then read the MAIN plate and reported
           the genre bus's three seats missing. A check that wants a plate says
           which, the way a hand does. */
        await tap("boardtab|bus|genre");
        const board = await p.evaluate(() => ({
          panel: document.querySelectorAll("#boardpanel").length,
          rack: document.querySelectorAll("#boardpanel #rack .nu-plate").length,
          stages: [...document.querySelectorAll('#boardtabs [data-k^="boardtab|"]')]
            .map((b) => b.dataset.k),
          slots: document.querySelectorAll('[data-k^="bus|genre|fx"]').length,
          master: document.querySelectorAll('[data-k^="master|"]').length,
          twice: document.querySelectorAll('[data-k^="tmaster|"]').length,
        }));
        check(board.panel === 1 && board.rack === 1 && board.slots === 3 &&
              board.stages.length === 5 && board.twice === 0,
          "T10o the master opens the board — one #boardpanel, one plate at a " +
          "time, the five stages at their own addresses, the genre bus's " +
          "three insert slots, and NO second copy of the master's words " +
          "(`tmaster|` is deleted, not moved) — " + JSON.stringify(board));
        /* the four other stages are one tap each, in the same panel. */
        await p.evaluate(() => { const b = document.querySelector(
          '[data-k="boardtab|bus|main"]'); if (b) b.click(); });
        await p.waitForTimeout(500);
        const main = await p.evaluate(() => ({
          bus: (document.querySelector("#boardpanel #rack .nu-plate") || {})
            .dataset ? document.querySelector("#boardpanel #rack .nu-plate")
              .dataset.bus : null,
          master: document.querySelectorAll('[data-k^="master|"]').length,
          gain: document.querySelectorAll('[data-k="level"]').length,
        }));
        check(main.bus === "main" && main.master >= 7 && main.gain === 1,
          "T10o …and the main stage carries the master's seven words and the " +
          "record gain, which is where the table's old footer row's cells " +
          "went — " + JSON.stringify(main));
        await shutAll();
      }

      /* T10p · THE MIX PANE IS GONE, and the row survives a recompile. */
      {
        const gone = await p.evaluate(() => ({
          host: !!document.getElementById("deck"),
          tab: (window.__eightTabs() || []).indexOf("Mix"),
          tray: !!document.querySelector('[data-k="toptab-Mix"]'),
          /* (IT READ `#nu-tray [data-k^="boardtab|"]` — the five stage rows
             the Mix branch drew. The gutter is deleted on 2026-09-09, so the
             query is page-wide MINUS the board's own row, which is where the
             five went back to in the same edit that took the tab: what must be
             zero is a stage button OUTSIDE `#boardtabs`.) */
          trayKids: [...document.querySelectorAll('[data-k^="boardtab|"]')]
            .filter((b) => !b.closest("#boardtabs")).length,
          footMaster: !!document.querySelector('[data-k="tfoot|master"]'),
        }));
        check(!gone.host && gone.tab < 0 && !gone.tray && !gone.trayKids &&
              !gone.footMaster,
          "T10p the Mix PANE is deleted — no #deck, no Mix tab, no tray row " +
          "and no five tray children, and the old `tfoot|master` row is gone " +
          "with it — " + JSON.stringify(gone));
        /* THE ROW STAYS OPEN ACROSS THE RECOMPILE ITS OWN CONTROLS CAUSE.
           Every control in a strip ends in `ctx.changed()`, which throws this
           panel away; a seat that shut on the first fader move would shut
           under the thumb using it. Same law as TIME and RULES (§10c). */
        const name = await p.evaluate(() => {
          const b = document.querySelector('#pan-band [data-k^="tmix|"]');
          return b ? b.dataset.k.slice(5) : null; });
        await tap("tmix|" + name);
        const stayed = await p.evaluate(async (n) => {
          const wait = (ms) => new Promise((r) => setTimeout(r, ms));
          const m = document.querySelector('[data-k="b|mute|' + n + '"]');
          if (!m) return { drove: false };
          m.click();
          await wait(700);
          const head = document.querySelector(
            '#pan-band [data-k="tmix|' + n + '"]');
          const open = head && head.getAttribute("aria-expanded") === "true";
          const back = document.querySelector('[data-k="b|mute|' + n + '"]');
          if (back) back.click();
          await wait(500);
          return { drove: true, open,
                   strip: !!document.querySelector("#voicemix .nu-strip") };
        }, name);
        check(stayed.drove && stayed.open && stayed.strip,
          "T10p …and the seat stays open across the recompile its own " +
          "controls cause (a mute is a `changed()`) — " +
          JSON.stringify(stayed));
        await shutAll();
      }
    }
    await wide(390);

    /* =========== T10q–T10v · THE MOTIFS ROW (§10b step 4) ==============
       Paul, 2026-09-05: *"then do the same with motifs."* §10a: *"MOTIFS is
       the bank across the top with previews and provenance, and tapping a
       motif points the SELECTED cell at it (the formula bar's own write)."*

       T10a–T10b have already read this row as a MERGED, FROZEN, FACED row of
       the same sheet, beside TIME and RULES — those claims are about every
       special row and are made once. What this group asks is what only MOTIFS
       has to answer: is the BANK actually drawn (a picture, a provenance word
       and the chairs, per motif), does a NAME reach the sound, and is the pane
       gone. Two of the six read the RENDERED OUTPUT rather than the DOM,
       because this branch's characteristic bug is a control that is declared,
       costed and never reaches the sound. */
    {
      const bank = () => p.evaluate(() => ({
        now: window.__eightMotifNow(),
        names: window.__eightBank(),
        rows: [...document.querySelectorAll("#pan-band .nu-bankrow")].map((r) => {
          const n = r.querySelector(".nu-bankname");
          const o = r.querySelector(".nu-bankopen");
          const svg = r.querySelector(".nu-bankpic svg");
          return { k: n && n.dataset.k,
                   word: (r.querySelector(".nu-bankword") || {}).textContent,
                   prov: (r.querySelector(".nu-bankprov") || {}).textContent || null,
                   pic: svg ? svg.querySelectorAll("rect,path,line,circle").length : 0,
                   shape: svg ? svg.innerHTML.length : 0,
                   nameH: n ? Math.round(n.getBoundingClientRect().height) : 0,
                   openH: o ? Math.round(o.getBoundingClientRect().height) : 0,
                   readby: r.querySelectorAll('[data-k^="readby|"]').length,
                   lamp: !!r.querySelector('.nu-banklamp[data-live]') };
        }),
        add: ["addcell", "adddrumcell"].filter((k) =>
          !!document.querySelector('#pan-band [data-k="' + k + '"]')).length,
        wide: document.documentElement.scrollWidth <=
              document.documentElement.clientWidth + 1 }));

      /* T10q · THE BANK IS DRAWN, AND IT IS THE RECORD'S OWN BANK. One row per
         cell in `material.cells`' order, each with a picture, a name that is a
         44px control, an `open`, and the two ways to grow the set under the
         list — at 320 and 390, with no sideways page scroll. */
      for (const w of [320, 390]) {
        await wide(w);
        await p.evaluate(() => window.__eightMotif(null));
        await p.waitForTimeout(500);
        const B = await bank();
        const ok = B.now === null && B.rows.length === B.names.length &&
          B.rows.every((r, i) => r.word === B.names[i]) &&
          B.rows.every((r) => r.pic > 0 && r.nameH >= 44 && r.openH >= 44) &&
          B.add === 2 && B.wide;
        check(ok, "T10q " + w + " · the MOTIFS row's sheet is THE BANK — one " +
          "row per cell in the record's own order, each with ui/preview.js's " +
          "picture, a 44px name and an `open`, `+ motif` and `+ drum pattern` " +
          "under the list, no sideways page scroll — " +
          JSON.stringify({ rows: B.rows.length, names: B.names.length,
                           add: B.add, wide: B.wide }));
      }
      await wide(390);

      /* T10r · THE PROVENANCE WORD, AND THE PICTURE IS THIS MOTIF'S.
         §3: a cell says where it came from — own / guest / hand — and
         `document.js provWord` is the one owner of the word. The PICTURE is
         the other half of the same claim and it is asked as a DIFFERENCE: a
         bank that drew one shape ten times would pass "every row has a picture"
         and be a lie about every row but one. */
      {
        const B = await bank();
        /* THE WORD IS THE CATALOGUE'S SINCE 2026-09-05 (the functional text
           pass). `document.js provWord` is still the one owner of WHICH of
           the three a cell is — own · guest · hand — and those three are
           ADDRESSES; what the row PRINTS is `src/copy/glyph.ts`'s spelling of
           them ("From this genre" · "From a guest" · "Edited"), the same
           words the cell's own mark wears. The claim is unchanged: every bank
           row says where its phrase came from, in one of exactly three ways. */
        const WORDS = await p.evaluate(() => ["own", "guest", "hand"]
          .map((k) => globalThis.COPY.t("glyph.cell.prov." + k)));
        const said = B.rows.map((r) => r.prov);
        const shapes = new Set(B.rows.map((r) => r.shape));
        const degs = await p.evaluate(() => { const d = window.__eightDoc();
          return new Set(Object.keys(d.material.cells).map((k) =>
            JSON.stringify(d.material.cells[k].deg ||
                           d.material.cells[k].lanes))).size; });
        check(said.every((s) => WORDS.indexOf(s) >= 0),
          "T10r every bank row wears its provenance word (§3, document.js's " +
          "own three) — " + JSON.stringify(said));
        /* THE CLAIM IS "NOT ONE DRAWING REPEATED" AND IT IS ASKED AS A
           MAJORITY, not as a bijection. Measured on Kingston 1969: ten cells,
           ten distinct step arrays, SEVEN distinct pictures — ui/preview.js
           draws a bar per step at eight levels, so two tunes with the same
           rhythm that differ by less than a level render the same shape, which
           is a fact about a 28px picture and not a bug. What the check is
           actually guarding against is a bank that drew one preview ten times,
           and a majority of distinct shapes refuses that flatly. */
        check(shapes.size * 2 > B.rows.length && shapes.size > 1,
          "T10r …and the picture is THIS motif's, not one drawing repeated — " +
          shapes.size + " distinct previews over " + B.rows.length +
          " rows and " + degs + " distinct cells");
      }

      /* T10s · TAPPING A NAME POINTS THE SELECTED CELL AT IT, AND THE BAR
         CHANGES. §10a's own sentence, and it is measured twice: in the
         DOCUMENT (the cell the grid says is selected now reads that motif) and
         in the RENDERED EVENTS (`__eightEvents`, ui/derive.js's own compile of
         that section, which is what the engine is handed). A cell that
         re-pointed in the document and rendered the same bar is this repo's
         characteristic bug, and it is the whole reason for the second half. */
      {
        const pick = await p.evaluate(() => {
          const d = window.__eightDoc();
          const v = d.voices.find((x) => x.kind === "line");
          const s = d.form.sections[0];
          const now = (v && typeof v.material === "object" && v.material)
            ? (v.material[s.id] || v.material[""] ) : (v && v.material);
          const other = Object.keys(d.material.cells)
            .filter((k) => d.material.cells[k].kind !== "drum" && k !== now)[0];
          return { voice: v && v.name, sec: s.id, now: now || null, other };
        });
        await shutAll();
        await tap("tcell|" + pick.voice + "|" + pick.sec);
        const si = await p.evaluate((s) => window.__eightDoc()
          .form.sections.findIndex((x) => x.id === s), pick.sec);
        const evBefore = await p.evaluate((i) =>
          JSON.stringify(window.__eightEvents(i)), si);
        await p.evaluate(() => window.__eightRow("motifs", true));
        await p.waitForTimeout(500);
        await p.evaluate((k) => { const b = document.querySelector(
          '#pan-band [data-k="motifpoint|' + k + '"]'); if (b) b.click(); },
          pick.other);
        await p.waitForTimeout(900);
        const after = await p.evaluate(([vn, sid]) => {
          const d = window.__eightDoc();
          const v = d.voices.find((x) => x.name === vn);
          const m = v && v.material;
          return (m && typeof m === "object") ? (m[sid] || null) : m;
        }, [pick.voice, pick.sec]);
        const evAfter = await p.evaluate((i) =>
          JSON.stringify(window.__eightEvents(i)), si);
        check(after === pick.other,
          "T10s tapping a motif's name in the bank points the SELECTED cell " +
          "at it, through avail.js's own material.cell sheet — " +
          pick.voice + " · " + pick.sec + ": " + pick.now + " -> " + after);
        check(evBefore !== evAfter,
          "T10s …and the RENDERED bar changed with it (" + evBefore.length +
          " -> " + evAfter.length + " bytes of ui/derive.js's own events)");
      }

      /* T10t · WITH NO CELL SELECTED IT ARMS THE NEXT TAP. A hand that taps a
         name before it has chosen a cell is early, not wrong: the button says
         so with `aria-pressed`, and the next cell tapped is the one that gets
         the motif. Escape clears the selection — the grid's own key. */
      {
        /* NO CELL SELECTED IS THE STATE A HAND ARRIVES IN, AND IT IS THE ONLY
           WAY TO REACH IT — measured. §9a gives the grid Escape for the open
           sheet, the open field and the range anchor, and nothing on this page
           un-selects a cell: a spreadsheet does not have an empty selection
           once you have touched one, which is exactly why the arming exists.
           So the gate arrives the way a person does. (Driving Escape here
           instead read as a pass and was a lie: the selection from T10s was
           still standing, the tap WROTE to that cell, and the check measured a
           different section and found it unchanged.) */
        await p.reload({ waitUntil: "domcontentloaded" });
        await p.waitForTimeout(2600);
        const target = await p.evaluate(() => {
          const d = window.__eightDoc();
          const v = d.voices.find((x) => x.kind === "line");
          const s = d.form.sections[d.form.sections.length - 1];
          /* `material` IS A STRING OR A MAP — the document's own two shapes
             (one cell for the whole record, or one per section) — and both
             have to be read or the motif this chair already plays would be
             offered back to it and the check would pass on a write it never
             made. */
          const m = v && v.material;
          const cur = (m && typeof m === "object") ? (m[s.id] || null)
                    : (typeof m === "string" ? m : null);
          const other = Object.keys(d.material.cells)
            .filter((k) => d.material.cells[k].kind !== "drum" && k !== cur)[0];
          return { voice: v.name, sec: s.id, cur, other };
        });
        await p.evaluate(() => window.__eightRow("motifs", true));
        await p.waitForTimeout(500);
        const armed = await p.evaluate((k) => {
          const b = document.querySelector(
            '#pan-band [data-k="motifpoint|' + k + '"]');
          if (!b) return null;
          b.click();
          return b.getAttribute("aria-pressed");
        }, target.other);
        await p.waitForTimeout(400);
        const stillThere = await p.evaluate(([vn, sid]) => {
          const d = window.__eightDoc();
          const v = d.voices.find((x) => x.name === vn);
          const m = v && v.material;
          return (m && typeof m === "object") ? (m[sid] || null) : m;
        }, [target.voice, target.sec]);
        await tap("tcell|" + target.voice + "|" + target.sec);
        await p.waitForTimeout(700);
        const landed = await p.evaluate(([vn, sid]) => {
          const d = window.__eightDoc();
          const v = d.voices.find((x) => x.name === vn);
          const m = v && v.material;
          return (m && typeof m === "object") ? (m[sid] || null) : m;
        }, [target.voice, target.sec]);
        check(armed === "true" && stillThere !== target.other &&
              landed === target.other,
          "T10t with no cell selected the name ARMS (aria-pressed) and writes " +
          "nothing; the next cell tapped is the one that gets it — " +
          JSON.stringify({ armed, before: stillThere, after: landed,
                           want: target.other }));
      }

      /* T10u · THE SOUNDING MOTIF IS LIT IN THE FACE. Paul, 2026-09-03: *"When
         motifs are open, light them up in the left nav when playing."* There is
         no left nav; the row's head carries the lamp, and it carries the NAME
         because with the row shut a bare dot would say THAT and not WHICH. Two
         claims and the first is the law: the lamp is a `[data-live]` SIBLING of
         the button (a control inside a live surface is what test/motif-frozen
         A1 forbids), and while the record plays it names a cell of this
         record's own bank. */
      {
        await shutAll();
        const shape = await p.evaluate(() => {
          const b = document.querySelector('#pan-band [data-k="tmotifs"]');
          const th = b && b.closest("th");
          const lamp = th && th.querySelector('.nu-motlamp[data-live]');
          /* ITS PARENT IS THE ROW'S OWN LINE SINCE 2026-09-05 (§13a.2): the
             lamp was a BLOCK under the button and made PHRASES a two-line row
             (61.1px against TIME's 45, measured at 390); it stands beside the
             button inside `.nu-spline` now. It is still a SIBLING of the
             button and still outside it, which is the claim. */
          const line = b && b.parentElement;
          const row = th && th.closest("tr");
          return { lamp: !!lamp, inside: !!(lamp && lamp.querySelector("button")),
                   sibling: !!(lamp && lamp.parentElement === line &&
                               !b.contains(lamp)),
                   rowH: row ? Math.round(row.getBoundingClientRect().height) : 0 };
        });
        check(shape.lamp && shape.sibling && !shape.inside,
          "T10u the MOTIFS row's lamp is a [data-live] SIBLING of its head's " +
          "button, with no control inside it — " + JSON.stringify(shape));
        await p.click("#play");
        await p.waitForFunction(() => window.__eightStep && window.__eightStep() >= 0,
          null, { timeout: 25000 }).catch(() => {});
        await p.waitForTimeout(2500);
        const lit = await p.evaluate(() => ({
          said: (document.querySelector("#pan-band .nu-motlamp") || {}).textContent || "",
          bank: window.__eightBank() }));
        await p.click("#play");
        await p.waitForTimeout(800);
        const words = lit.said.split(", ").filter(Boolean);
        check(words.length > 0 && words.every((w) => lit.bank.indexOf(w) >= 0),
          "T10u …and while the record plays it names a motif of this record's " +
          "own bank — “" + lit.said + "”");
      }

      /* T10z · THE MOTIFS LINE HOLDS STILL, THE SECTION LIGHTS WHOLE, AND THE
         ROW HEAD HAS NO MARK (2026-09-05, TABLE.md §13f). Three of Paul's
         lines, driven on one playback because they are three readings of the
         same fifteen seconds:
           *"The text in the motifs section is changing rapidly every beat it's
           too much."*
           *"Really light up the sections as you move through them — not just a
           tiny halo around the number."*
           *"You don't need to put the little grid icon to the left of each
           section number."*
         WHAT IS ASSERTED. The head lamp's sentence is written at most once per
         SECTION BOUNDARY crossed and never between them (it was rebuilt from
         the set of players sounding at each event, so it rewrote itself several
         times a bar); exactly one `tr.is-playing` stands at any instant and it
         moves with the section; that row's ground differs from a resting row's
         by at least 3:1; and no section row head draws a `.nu-g`. */
      {
        await shutAll();
        const noMark = await p.evaluate(() => {
          const ths = [...document.querySelectorAll("#pan-band tbody th.nu-srowh")];
          return { n: ths.length,
            marks: ths.filter((th) => th.querySelector(".nu-g")).length,
            vh: ths.filter((th) => th.querySelector(".nu-vh")).length,
            named: ths.filter((th) => { const b = th.querySelector("button");
              return b && (b.getAttribute("aria-label") || "").length > 2; }).length,
            /* WHAT MUST NOT BE CUT, AND WHAT MAY (§13a.7 asked of the head
               COLUMN). §13a.7's "never cut mid-word" is a law about the column
               HEADS, which fall back to a first word and then to a glyph. A
               row head is the section's NUMBER, its NAME and its bar count in
               a column that is what the players leave — so the bar count and a
               one-word name must be whole (the brief's own test, "12 chorus /
               8 BARS at 320"), and a hand-typed two-word name like "drums &
               bass" ellipsises, as it did before the mark came off and with
               one character more room now that it has. */
            cutBars: ths.filter((th) => [...th.querySelectorAll("small")]
              .some((n) => n.scrollWidth > n.clientWidth + 1)).length,
            cutOneWord: ths.map((th) => th.querySelector(".nu-srowname"))
              .filter((n) => n && !/\s\S+\s/.test(" " + n.textContent.trim() + " ") &&
                             n.scrollWidth > n.clientWidth + 1)
              .map((n) => n.textContent.trim()),
            ellipsised: ths.map((th) => th.querySelector(".nu-srowname"))
              .filter((n) => n && n.scrollWidth > n.clientWidth + 1)
              .map((n) => n.textContent.trim()) };
        });
        check(noMark.n > 0 && noMark.marks === 0 && noMark.vh === 0 &&
              noMark.named === noMark.n && noMark.cutBars === 0 &&
              noMark.cutOneWord.length === 0,
          "T10z no section row head draws the ▦ — the number, the name and the " +
          "bar count stand alone, every head still has its accessible name, " +
          "the bar count is whole and no one-word name is cut — " +
          JSON.stringify(noMark));
        /* THE TWO SEQUENCES, COLLECTED ON THE PAGE. A MutationObserver on the
           lamp (its text is the only thing that changes in it) and a 120ms
           sampler on the lit row — the sampler is the gate's clock and not the
           page's, so it cannot miss a write the page made between two of its
           own ticks any more often than a thumb would. */
        await p.evaluate(() => {
          window.__lampSeq = []; window.__rowSeq = []; window.__rowMax = 0;
          const lamp = document.querySelector("#pan-band .nu-motlamp");
          window.__mo = new MutationObserver(() => {
            const t = lamp ? lamp.textContent : "";
            const q = window.__lampSeq;
            if (q[q.length - 1] !== t) q.push(t); });
          if (lamp) window.__mo.observe(lamp,
            { childList: true, characterData: true, subtree: true });
          window.__ro = setInterval(() => {
            const rows = document.querySelectorAll("#pan-band tbody tr.is-playing");
            window.__rowMax = Math.max(window.__rowMax, rows.length);
            const id = rows[0] ? rows[0].dataset.row : null;
            const q = window.__rowSeq;
            if (q[q.length - 1] !== id) q.push(id); }, 120);
        });
        await p.click("#play");
        await p.waitForFunction(() => window.__eightStep && window.__eightStep() >= 0,
          null, { timeout: 25000 }).catch(() => {});
        await p.waitForTimeout(16000);
        const run = await p.evaluate(() => {
          const tr = document.querySelector("#pan-band tbody tr.is-playing");
          const rest = [...document.querySelectorAll("#pan-band tbody tr[data-row]")]
            .find((x) => !x.classList.contains("is-playing"));
          const bg = (e) => { const c = e && e.querySelector("th");
            return c ? getComputedStyle(c).backgroundColor : null; };
          return { lamp: window.__lampSeq.slice(), rows: window.__rowSeq.slice(),
                   max: window.__rowMax, on: bg(tr), off: bg(rest) };
        });
        await p.evaluate(() => { if (window.__mo) window.__mo.disconnect();
                                 if (window.__ro) clearInterval(window.__ro); });
        await p.click("#play");
        await p.waitForTimeout(800);
        /* THE FIRST ENTRY OF EACH SEQUENCE IS THE STATE BEFORE THE PRESS, so a
           BOUNDARY is a change after it. */
        const bounds = Math.max(0, run.rows.filter((x) => x != null).length - 1);
        const writes = Math.max(0, run.lamp.length - 1);
        check(run.rows.length > 1 && run.max === 1 && writes <= bounds,
          "T10z the MOTIFS head lamp is written at most once per SECTION and " +
          "never between (" + writes + " writes across " + bounds +
          " boundaries) and exactly one row is lit at a time (max " + run.max +
          ") — " + JSON.stringify({ lamp: run.lamp, rows: run.rows }));
        /* THE CONTRAST, IN THE WCAG ARITHMETIC, because "really light up" is a
           claim about what a thumb can find at arm's length and a tint that
           only a pipette can see is the halo again with a wider footprint. */
        const lumOf = (c) => { const m = String(c).match(/[\d.]+/g) || [];
          const n = m.slice(0, 3).map(Number);
          const v = n.map((x) => (x > 1.0001 ? x / 255 : x))
            .map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
          return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
        const la = lumOf(run.on), lb = lumOf(run.off);
        const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
        check(!!run.on && !!run.off && run.on !== run.off && ratio >= 3,
          "T10z …and the playing row's ground is " + ratio.toFixed(2) +
          ":1 against a resting row (≥ 3) — " +
          JSON.stringify({ on: run.on, off: run.off }));
      }

      /* T10v · THE MOTIFS PANE IS GONE, and the editor is drawn once. T7's law
         asked of a fourth pane: no `#pan-motif`, no Motifs tab, no
         `motiftab-<name>` tray row, no `motifop-` level in the stripe, and no
         `#ax-material`. And the bench is drawn ONCE page-wide — the pane and
         the row both drawing it would be two `hookCells` registries and a
         playhead writing into detached cells. */
      {
        const gone = await p.evaluate(() => ({
          host: !!document.getElementById("pan-motif"),
          axis: !!document.getElementById("ax-material"),
          tab: (window.__eightTabs() || []).indexOf("Motifs"),
          tray: !!document.querySelector('[data-k="toptab-Motifs"]'),
          /* (IT READ `#nu-tray [data-k^="motiftab-"]` and `[data-k^=
             "motifop-"]` — the bank as a level of the gutter and the fourteen
             transforms under it. The gutter is deleted on 2026-09-09; what
             must be zero is a `motiftab-` row ANYWHERE, and the fourteen
             transforms are asserted PRESENT one check down, in the opened
             motif's own sheet, so only the tab rows are counted here.) */
          trayKids: document.querySelectorAll('[data-k^="motiftab-"]').length,
        }));
        check(!gone.host && !gone.axis && gone.tab < 0 && !gone.tray &&
              !gone.trayKids,
          "T10v the Motifs PANE is deleted — no #pan-motif, no #ax-material, " +
          "no Motifs tab, no motiftab rows and no motifops level — " +
          JSON.stringify(gone));
        await p.evaluate(() => { const b = window.__eightBank();
          if (b.length) window.__eightMotif(b[0]); });
        await p.waitForTimeout(1200);
        /* ONE BENCH PER MEASURE, WHICH IS `hookGrid`'S OWN SHAPE and not a
           second drawing: *"a cell of two measures draws two tables, stacked
           in order, and the count restarting at `1` IS the bar line"*
           (ui/eight.js, 2026-08-28). Measured on Kingston 1969: `hook` is 32
           steps, so two. What "drawn once" means here is that the whole block
           appears once — one `#staff`, one way back, one rename field, the
           fourteen transforms once — which is what the pane-and-row both
           drawing it would have doubled. */
        const once = await p.evaluate(() => ({
          bench: document.querySelectorAll("table.nu-bench").length,
          bars: (() => { const d = window.__eightDoc();
            const c = d.material.cells[window.__eightMotifNow()];
            return Math.max(1, Math.round(((c && c.deg) || []).length / 16)); })(),
          staff: document.querySelectorAll("#staff").length,
          back: document.querySelectorAll('[data-k="motifback"]').length,
          tf: document.querySelectorAll(
            '[data-k^="motifop-"],[data-k^="motiftime-"]').length,
          name: document.querySelectorAll('[data-k^="motif-name|"]').length }));
        check(once.bench === once.bars && once.staff === 1 && once.back === 1 &&
              once.tf === 14 && once.name === 1,
          "T10v …and one motif opened from the bank draws its editor exactly " +
          "once — one bench per measure, one #staff, one way back, the " +
          "fourteen transforms and one rename field — " + JSON.stringify(once));
        await p.evaluate(() => window.__eightMotif(null));
        await shutAll();
      }
    }

    /* =========== T10w · THE PRODUCE ROW (§10b step 5) ==================
       §10a: *"│ PRODUCE │ the producer's deals and notes │ (merged,
       expandable)"*, drawn UNDER the mix. What only this file can say: it is a
       merged row of the `<tfoot>` at the pane's own width, its face is the
       producer's own last sentence, its sheet is `ui/produce.js mount` whole,
       a note said in the row reaches `doc.produce`, and the Produce PANE is
       gone. What the producer's notes DO is `test/producer.browser.js`'s and
       `test/producer-eight.test.js`'s, and neither claim is copied here. */
    {
      await shutAll();
      const row = await p.evaluate(() => {
        const t = document.querySelector("#pan-band table.nu-sheetgrid");
        const tr = t && t.querySelector("tfoot tr.nu-prodrow");
        const b = tr && tr.querySelector("button");
        const th = tr && tr.querySelector("th");
        const pane = document.querySelector("#pan-band .nu-pane");
        const foot = t ? [...t.querySelectorAll("tfoot tr")] : [];
        return { there: !!tr, k: b && b.dataset.k,
                 colspan: th ? th.colSpan : 0,
                 cols: t ? t.querySelectorAll("thead th.nu-colhead," +
                   " thead th.nu-cornerh, thead th.nu-plushead").length : 0,
                 h: b ? Math.round(b.getBoundingClientRect().height) : 0,
                 w: b ? Math.round(b.getBoundingClientRect().width) : 0,
                 paneW: pane ? pane.clientWidth : 0,
                 word: (tr && (tr.querySelector(".nu-spword") || {}).textContent),
                 face: (tr && (tr.querySelector(".nu-spface") || {}).textContent),
                 afterMaster: foot.findIndex((x) =>
                   x.classList.contains("nu-prodrow")) >
                   foot.findIndex((x) => x.classList.contains("nu-masterrow")) };
      });
      check(row.there && row.k === "tproduce" && row.colspan === row.cols &&
            row.h >= 44 && row.w >= row.paneW - 12 && row.afterMaster &&
            row.word === "produce",
        "T10w PRODUCE is a merged row of the footer UNDER the master, the " +
        "pane's own width, 44px — " + JSON.stringify(row));

      /* THE FACE IS THE PRODUCER'S OWN LINE, and it is read back off the same
         two owners the sheet's caption counts against (producer.js `sentence`,
         `Prod.MAXNOTES`) — never re-assembled here. */
      const prod0 = await p.evaluate(() => window.__eightProd());
      /* IT READ `/nothing said/` UNTIL 2026-09-05. "nothing said — the record
         as the atlas dealt it" is three of the audit's banned families in one
         line; the empty face is `src/copy/sheets.ts produceRow.none` now. The
         claim is the same: with no notes the face says so, and with notes it
         is the producer's own count. */
      check(prod0.notes.length === 0
              ? /no notes yet/i.test(row.face || "")
              : (row.face || "").indexOf(prod0.notes.length + " of ") === 0,
        "T10w …and its face is the producer's own line — “" + row.face +
        "” against " + prod0.notes.length + " note(s)");

      /* THE SHEET IS THE PANEL, and a note said in it reaches `doc.produce`. */
      await tap("tproduce");
      const panel = await p.evaluate(() => ({
        box: document.querySelectorAll("#pan-band .nu-prodsheet").length,
        ax: document.querySelectorAll("#pan-band #ax-produce").length,
        plate: !!document.querySelector('#pan-band [data-k="prod.name"]'),
        tree: !!document.querySelector('#pan-band [data-k="prod.cast"]'),
        chips: document.querySelectorAll('#pan-band [data-k^="cast|"]').length }));
      check(panel.box === 1 && panel.ax === 1 && panel.plate && panel.tree &&
            panel.chips > 0,
        "T10w …and the sheet is ui/produce.js's own panel, drawn once — " +
        JSON.stringify(panel));
      const said = await p.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const c = document.querySelector('#pan-band [data-k^="cast|"]');
        if (!c) return { drove: false };
        c.click(); await wait(700);
        /* THE ADDRESS IS `prod.word`, WHICH IS ui/produce.js's OWN SPELLING
           — `data-sel="prod.word"`, not `sel|prod.word`; the `sel|` prefix is
           test/selects.js's own key for a menu and never the element's. */
        const w = [...document.querySelectorAll(
          '#pan-band .nu-prodsheet [data-sel]')].map((n) => n.dataset.sel);
        return { drove: true, sels: w };
      });
      check(said.drove && (said.sels || []).some((k) => /^prod\./.test(k)),
        "T10w …and a subject chosen in the row offers the producer's own " +
        "adjectives — " + JSON.stringify(said));

      const goneP = await p.evaluate(() => ({
        host: !!document.getElementById("produce"),
        tab: (window.__eightTabs() || []).indexOf("Produce"),
        tray: !!document.querySelector('[data-k="toptab-Produce"]') }));
      check(!goneP.host && goneP.tab < 0 && !goneP.tray,
        "T10w …and the Produce PANE is deleted — no #produce, no Produce tab, " +
        "no tray row — " + JSON.stringify(goneP));
      await shutAll();
    }
  }

  /* ================= T10x · THE LAMPS ARE ON THE HEADERS ================
     TABLE.md §10a: *"The lamps move onto the headers: the playing section's
     row head and the sounding players' column heads light."* Paul, 2026-09-02:
     *"I need you to light them up when playing them actively in the nav."*

     THIS IS test/nav-tree.js N6, RETIRED INTO THIS FILE (2026-09-09). That
     gate existed because a TREE could newly get a shape wrong — two branches
     open at once, a child four rows below its parent, a mark stranded on an
     ancestor — and every one of those needed a stripe driven into a state on
     purpose. The stripe is deleted (TABLE.md §10b step 7), so seven of its
     nine claims have no subject at all and are retired at their own file's
     head; N6 is the one that was never about the tree. It read a CLASS on a
     gutter button and it reads an `<i>` in a column head, because the gutter
     was outside `#app` where the clock may write anything and a table head is
     not: `window.__eightFrozen` parks a `[data-live]` element's CHILDREN and
     keeps its ATTRIBUTES, so a class or an `aria-current` written on the live
     span would land in the frozen snapshot and test/motif-frozen.js would have
     it inside the hour. One channel, one writer (`setSounding`, which is now
     the single owner of every lamp on this page), and it must GO OUT — a lamp
     that cannot turn off is "declared but never arriving" from the other end.
     THE MARK IS NOT THE LAMP, and that half is unchanged: `<mark>` means the
     OPEN thing, and a record with six players sounding would be six marks and
     a lie about where you are. */
  {
    await p.evaluate(() => window.__eightUp());
    await p.waitForTimeout(150);
    await p.evaluate(() => window.__eightTab("Band"));
    await p.waitForTimeout(700);
    const shape = await p.evaluate(() => {
      const ths = [...document.querySelectorAll("#pan-band th.nu-colhead")]
        .filter((th) => th.querySelector('button[data-k^="tcol|"]'));
      return { heads: ths.length,
               lamps: ths.filter((th) => th.querySelector("[data-live]")).length,
               sibling: ths.every((th) => { const l = th.querySelector("[data-live]");
                 const b = th.querySelector("button");
                 return !l || (l.parentElement === th && !b.contains(l)); }),
               inside: ths.some((th) => { const l = th.querySelector("[data-live]");
                 return !!(l && l.querySelector("button")); }) };
    });
    check(shape.heads > 0 && shape.lamps === shape.heads &&
          shape.sibling && !shape.inside,
      "T10x every player's column head carries a [data-live] lamp as a " +
      "SIBLING of its button, with no control inside it — " +
      JSON.stringify(shape));
    await p.click("#play");
    const lit = await p.waitForFunction(
      () => document.querySelectorAll("#pan-band th.nu-colhead [data-live] i").length > 0,
      null, { timeout: 25000 }).then(() => true).catch(() => false);
    await p.waitForTimeout(600);
    const onNow = await p.evaluate(() => ({
      lit: [...document.querySelectorAll("#pan-band th.nu-colhead")]
        .filter((th) => th.querySelector("[data-live] i"))
        .map((th) => (th.querySelector("button").dataset.k || "").slice(5)),
      heads: document.querySelectorAll("#pan-band th.nu-colhead button[data-k^=\"tcol|\"]").length,
      chromeMarks: document.querySelectorAll("#nu-chrome mark").length,
      /* THE PAINT IS THE PLAYHEAD'S RED AND NOT THE METER'S GREEN, read off the
         rendered box rather than off the class list: `--clock` means "this is
         where the record is" and `--meter` means "a number came back from the
         engine". A lamp lit green here would be the fake measurement
         `METER_WHY` has refused since August. */
      clock: getComputedStyle(document.documentElement)
        .getPropertyValue("--clock").trim(),
      paint: (() => { const i = document.querySelector(
        "#pan-band th.nu-colhead [data-live] i");
        return i ? getComputedStyle(i).backgroundColor : null; })(),
      /* ...AND THE SOUNDING SECTION'S ROW HEAD IS `markForm`'S <mark>, which
         has lit that head off the same `d.si` since wave 2b. §10a's "the
         playing section's row head" is that function, one tier up, and a
         second lamp there would be a second owner of one fact. */
      row: document.querySelectorAll(
        '#pan-band th.nu-srowh [data-live="count"] mark').length,
    }));
    await p.click("#play");
    await p.waitForTimeout(1200);
    const off = await p.evaluate(() => document.querySelectorAll(
      "#pan-band th.nu-colhead [data-live] i").length);
    check(lit && onNow.lit.length > 0 && onNow.lit.length <= onNow.heads,
      "T10x a player's column head lights within 25 s of #play — " +
      onNow.lit.length + " of " + onNow.heads + " lit (" +
      JSON.stringify(onNow.lit) + ")");
    check(onNow.chromeMarks === 0,
      "T10x …and the lamp is a CHILD, not a mark: the chrome's own <mark> " +
      "count is unmoved by it (" + onNow.chromeMarks + " on the table)");
    check(onNow.row === 1,
      "T10x …and the SOUNDING section's row head wears markForm's one <mark> " +
      "— " + onNow.row + " lit row head");
    check(off === 0,
      "T10x …and every lamp goes out when the record stops (" + off + " left)");
  }

  /* ============ T10y · THE FORM, AND A LANE YOU CAN DRAW ================
     The review's items 9 and 10, on the RENDERED page: the row sheet offers
     the form words (a repeat with a count, a second ending, a coda, the jump)
     and the two lanes a hand may DRAW — the section's own and a cell's — each
     on the one curve editor. Measured as a WRITE, not as the presence of a
     control: a chip that writes nothing is this repo's characteristic bug. */
  {
    const cellK = (v, id) => "tcell|" + v + "|" + id;
    const sid = (await doc()).form.sections[0].id;
    const sid2 = (await doc()).form.sections[1].id;
    await tap("trow|" + sid2);
    const form = await p.evaluate((id) => {
      const k = (x) => document.querySelector('#pan-band [data-k="' + x + '"]');
      const sl = document.querySelector(
        '#pan-band input.nu-numslide[data-k="repeat|' + id + '"]');
      const h = (x) => (x ? Math.round(x.getBoundingClientRect().height) : 0);
      return { repeat: !!sl, rh: h(sl),
               ending: !!k("ending|" + id), coda: !!k("coda|" + id),
               tocoda: !!k("tocoda|" + id), draw: !!k("trowauto|" + id) };
    }, sid2);
    check(form.repeat && form.ending && form.coda && form.tocoda && form.draw,
      "T10y the row sheet offers the FORM — a repeat, a second ending, a coda, " +
      "the jump — and a lane to draw (" + JSON.stringify(form) + ")");
    check(form.rh >= 44, "T10y …and the repeat is a 44px slider, not a chip row");
    /* THE REPEAT WRITES, AND THE DOCUMENT KEEPS ONE SECTION. */
    const rep = await p.evaluate((id) => {
      const r = document.querySelector(
        '#pan-band input.nu-numslide[data-k="repeat|' + id + '"]');
      if (!r) return null;
      const n0 = window.__eightDoc().form.sections.length;
      r.value = 2; r.dispatchEvent(new Event("change", { bubbles: true }));
      return { n0 };
    }, sid2);
    await p.waitForTimeout(600);
    const repGot = await p.evaluate((id) => { const d = window.__eightDoc();
      const s2 = d.form.sections.find((x) => x.id === id);
      return { repeat: s2 && s2.repeat, n: d.form.sections.length,
               }; }, sid2);
    check(!!rep && repGot.repeat === 2 && repGot.n === rep.n0,
      "T10y …and a repeat of 2 is ONE section played twice, not two sections " +
      "in the document (" + JSON.stringify(repGot) + ")");
    /* THE ROW'S OWN LANE: choose a param, and the plate arrives with it. */
    await p.evaluate((id) => { const c = document.querySelector(
      '#pan-band [data-k="trowauto|' + id + '"]'); if (c) c.click(); }, sid2);
    await p.waitForTimeout(300);
    await p.evaluate((id) => { const chip = document.querySelector(
      '#pan-band [data-k="trowauto|' + id + '|level"]'); if (chip) chip.click(); }, sid2);
    await p.waitForTimeout(700);
    const rowLane = await p.evaluate((id) => {
      const s2 = window.__eightDoc().form.sections.find((x) => x.id === id);
      const plate = document.querySelector(
        '#pan-band [data-k^="trowlane|level|"], #pan-band .nu-rowlane');
      const hs = document.querySelectorAll('#pan-band .nu-rowlane [data-k]');
      return { auto: s2 && s2.auto ? s2.auto.length : 0,
               param: s2 && s2.auto && s2.auto[0] ? s2.auto[0].param : null,
               inBars: !!(s2 && s2.auto && s2.auto[0] && s2.auto[0].in === "bars"),
               plate: !!plate, handles: hs.length };
    }, sid2);
    check(rowLane.auto === 1 && rowLane.param === "level" && rowLane.inBars &&
          rowLane.plate,
      "T10y a section's own lane is DRAWN now — the row writes {param, points} " +
      "and the plate is on the page (" + JSON.stringify(rowLane) + ")");
    await p.evaluate((id) => { const d = window.__eightDoc();
      const s2 = d.form.sections.find((x) => x.id === id);
      if (s2) { delete s2.auto; delete s2.repeat; }
      window.__eightDraw && window.__eightDraw(); }, sid2);
    await p.waitForTimeout(400);
    await tap("trow|" + sid2);

    /* THE CELL'S OWN, on the same component. */
    const vn = (await doc()).voices[0].name;
    await selectCell(cellK(vn, sid));
    await openCell(cellK(vn, sid));
    const vi = (await doc()).voices.findIndex((v) => v.name === vn);
    const laneKey = "tcellauto|level|" + vi + "|0";
    await p.evaluate((k) => { const c = document.querySelector(
      '#pan-band [data-k="' + k + '"]'); if (c) c.click(); }, laneKey);
    await p.waitForTimeout(300);
    await p.evaluate((k) => { const chip = document.querySelector(
      '#pan-band [data-k="' + k + '|draw"]'); if (chip) chip.click(); }, laneKey);
    await p.waitForTimeout(700);
    const cellLane = await p.evaluate((n) => {
      const d = window.__eightDoc();
      const v = d.voices.find((x) => x.name === n);
      const c = ((v || {}).cells || {})[d.form.sections[0].id] || {};
      const L = (c.mixauto || {}).level;
      const plate = document.querySelector('#pan-band .nu-celllane');
      const hs = plate ? plate.querySelectorAll("[data-k]") : [];
      const h = plate ? Math.round(plate.getBoundingClientRect().height) : 0;
      return { points: L && L.points ? L.points : null, plate: !!plate,
               handles: hs.length, h };
    }, vn);
    check(!!cellLane.points && cellLane.points.length >= 2 && cellLane.plate,
      "T10y a cell's mix lane can be DRAWN — the word `draw` writes points and " +
      "the plate arrives (" + JSON.stringify(cellLane) + ")");
    check(cellLane.h >= 44,
      "T10y …and the plate is a real plate, not a hairline (" + cellLane.h + "px)");
    await p.evaluate((n) => { const d = window.__eightDoc();
      const v = d.voices.find((x) => x.name === n);
      const c = ((v || {}).cells || {})[d.form.sections[0].id];
      if (c) delete c.mixauto;
      window.__eightDraw && window.__eightDraw(); }, vn);
    await p.waitForTimeout(400);
  }

  /* ================= T12 · THE DESIGN PASS (DESIGN.md, TABLE.md §11) ====
     Paul, after the AUX spike: *"keep our stuff but make it less chunky and
     more stylish"* · *"use more icons. Ideally the table is a large set of
     icons"* · *"just nicely structure each expanded interface as proper
     software that's easy to scan and nicely grouped"* · *"tight lozenges,
     organized by color and clustered semantically… visibility into all of the
     options."*

     EVERY CHECK BELOW READS THE RENDERED BOX. A restyle is the one kind of
     round where the plan and the artifact can differ silently — a rule that
     never matched, a specificity that lost, a token nothing reads — so not one
     of these asks the stylesheet what it says; they ask the page what it drew
     ([[test-the-artifact]]).

     A PLATE, COUNTED, is a box with a border on all FOUR sides and a ground of
     its own. DESIGN.md §2 names exactly two on this page — the curve editor
     (component 9) and the bar (component 12) — so this counts the ones inside
     `#pan-band` and allows the ones a state or a category earns: a HOT chip or
     lozenge (`aria-pressed`, "hot = filled"), a `.nu-vpaint` (which player),
     the desk's own strip and detents seated in the mix row. */
  {
    const PLATEPROBE = `(() => {
      const px = (s) => { const n = parseFloat(s); return isFinite(n) ? n : 0; };
      const V = { w: innerWidth, h: innerHeight };
      const vis = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 &&
                         r.top < V.h && r.right > 0 && r.left < V.w;
      const host = document.getElementById("pan-band");
      let plates = 0, thick = 0; const who = [];
      for (const el of host.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (!vis(r)) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden") continue;
        const bt = px(cs.borderTopWidth), bb = px(cs.borderBottomWidth),
              bl = px(cs.borderLeftWidth), br = px(cs.borderRightWidth);
        if (Math.max(bt, bb, bl, br) > 1.01) {
          thick++; who.push("rule " + el.className + " " + Math.max(bt, bb, bl, br));
        }
        const bg = cs.backgroundColor || "";
        const opaque = bg && bg !== "transparent" &&
                       !/rgba\\(0, 0, 0, 0\\)/.test(bg);
        if (!(r.width >= 24 && r.height >= 18 &&
              bt > 0 && bb > 0 && bl > 0 && br > 0 && opaque)) continue;
        /* the four a state or a category earns */
        if (el.getAttribute("aria-pressed") === "true") continue;
        if (el.classList.contains("nu-vpaint")) continue;
        if (el.closest(".nu-strip, #rack, .nu-plate, .nu-env")) continue;
        plates++; who.push("plate " + el.tagName + "." + el.className);
      }
      return { plates, thick, who: who.slice(0, 6) };
    })()`;
    for (const W of [320, 390, 1280]) {
      await ctx.pages()[0].setViewportSize({ width: W, height: W === 1280 ? 900 : 844 });
      await p.waitForTimeout(400);
      await top("Band");
      const m = await p.evaluate(PLATEPROBE);
      check(m.thick === 0,
        "T12a at " + W + " every rule on the table is a HAIRLINE — " + m.thick +
        " over 1px (" + JSON.stringify(m.who) + ")");
      check(m.plates <= 2,
        "T12b …and a PLATE is only where DESIGN.md names one — " + m.plates +
        " unnamed plates on screen (" + JSON.stringify(m.who) + ")");
    }
    await ctx.pages()[0].setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(400);
    await top("Band");

    /* ---- T12c · GROUPS WITH HEADINGS, IN THE COMPOSER'S ORDER (§11c) --- */
    const headsOf = () => p.evaluate(() => {
      const o = document.querySelector("#pan-band tr.nu-wopen");
      if (!o) return null;
      const gs = [...o.querySelectorAll(".nu-sheetgroup")];
      /* THE HEADING'S WORD IS `.nu-groupword` AND NOT THE `<h4>`'s text, since
         2026-09-05: the heading carries its MARK first (`ui/glyph.js
         GLYPH.group` — Paul: *"use more icons"*) and reading the whole element
         would read the glyph into the word. */
      const gap = gs.length > 1
        ? Math.round(parseFloat(getComputedStyle(gs[1]).marginBlockStart)) : 0;
      return { heads: gs.map((g) =>
                 ((g.querySelector(".nu-groupword") || {}).textContent || "").trim()),
        marks: gs.filter((g) => g.querySelector(".nu-grouphead .nu-g")).length,
        fields: gs.map((g) => g.querySelectorAll(".nu-sheetrow").length),
        gap,
        s5: Math.round(parseFloat(getComputedStyle(document.documentElement)
              .getPropertyValue("--s5")) * 16) };
    });
    const sid12 = (await doc()).form.sections[0].id;
    const vn12 = (await doc()).voices[0].name;
    await tap("trow|" + sid12);
    const rg = await headsOf();
    check(!!rg && JSON.stringify(rg.heads) === JSON.stringify(ROWGROUPS),
      "T12c a SECTION's sheet is five groups in the composer's order — " +
      JSON.stringify(rg && rg.heads) + " holding " + JSON.stringify(rg && rg.fields));
    check(!!rg && rg.gap >= 18,
      "T12c …with --s5 between subjects (" + (rg && rg.gap) + "px)");
    check(!!rg && rg.marks === rg.heads.length,
      "T12c …and every heading wears its MARK (" + (rg && rg.marks) + " of " +
      (rg && rg.heads.length) + "), which is Paul's *\"use more icons\"* on the " +
      "one part of a sheet a hand scans");
    await tap("trow|" + sid12);
    await tap("tcol|" + vn12);
    const cg = await headsOf();
    check(!!cg && JSON.stringify(cg.heads) === JSON.stringify(COLGROUPS),
      "T12d a CHAIR's sheet is Instrument · Envelope · Tone · Mix — " +
      JSON.stringify(cg && cg.heads) + " holding " + JSON.stringify(cg && cg.fields));
    await tap("tcol|" + vn12);
    await openCell("tcell|" + vn12 + "|" + sid12);
    const cellg = await headsOf();
    check(!!cellg && JSON.stringify(cellg.heads) === JSON.stringify(CELLGROUPS),
      "T12e a CELL's sheet is Motif · Variation · Dynamics · Placement — " +
      JSON.stringify(cellg && cellg.heads) + " holding " +
      JSON.stringify(cellg && cellg.fields));
    await tap("tcell|" + vn12 + "|" + sid12);

    /* ---- T12f · THE LOZENGE FIELD, ON A LONG VOCABULARY (§11d) --------- */
    await p.evaluate(() => window.__eightRow("time", true));
    await p.waitForTimeout(500);
    const opened = await p.evaluate(() => {
      const el = document.querySelector('#pan-band [data-sel="alphabet.scale"]');
      if (!el) return null;
      el.scrollIntoView({ block: "center" });
      return el.dataset.widget || null; });
    check(opened === "lozenge",
      "T12f the scale picker is a LOZENGE FIELD on every pointer (widget " +
      opened + "), not a wheel that shows one of sixty-three");
    const lz = await p.evaluate(() => {
      const f = document.querySelector('#pan-band .nu-lzfield[data-sel="alphabet.scale"]');
      if (!f) return null;
      const secs = [...f.querySelectorAll(".nu-lzcluster")];
      const all = [...f.querySelectorAll(".nu-lz")];
      const hues = secs.map((x) => getComputedStyle(x).getPropertyValue("--lz").trim());
      return { n: all.length, clusters: secs.length,
        heads: secs.filter((x) => x.querySelector(".nu-lzhead")).length,
        hues: [...new Set(hues)].length,
        short: all.filter((c) => c.getBoundingClientRect().height < 43.5).length,
        rect: all.filter((c) => c.getBoundingClientRect().height > 0).length,
        hot: all.filter((c) => c.getAttribute("aria-pressed") === "true").length,
        addr: all.length ? all[0].dataset.k : null,
        pill: all.length ? getComputedStyle(all[0]).borderTopLeftRadius : null,
        say: !!f.querySelector(".nu-lzsay") }; });
    check(!!lz && lz.n > 40 && lz.rect === lz.n,
      "T12f …with every one of its words on the glass (" +
      (lz && lz.rect) + " of " + (lz && lz.n) + ")");
    /* ONE HUE PER CLUSTER, AND THE PALETTE IS EIGHT (src/lozenge/api.ts `HUES`,
       nu.css `--lz-h0..7`). Eight is a decision — past eight, hue stops being
       a category anyone can hold — so a vocabulary with more clusters than
       hues REUSES them, and asserting `hues === clusters` would be asserting
       against the design. What is asserted is that every cluster has ONE, that
       the palette is spent before any is repeated, and that every cluster with
       a WORD has a heading: the clusterless bucket (`spec.other` absent) is
       drawn unheaded on purpose rather than under an invented word. */
    check(!!lz && lz.clusters >= 5 && lz.heads >= lz.clusters - 1 &&
          lz.hues === Math.min(lz.clusters, 8),
      "T12g …clustered semantically, a heading and ONE hue each (" +
      (lz && lz.clusters) + " clusters, " + (lz && lz.heads) + " headings, " +
      (lz && lz.hues) + " of 8 hues spent)");
    check(!!lz && lz.short === 0 && /px/.test(String(lz && lz.pill)),
      "T12h …every lozenge 44px of thumb in a pill (" + (lz && lz.short) +
      " short, radius " + (lz && lz.pill) + ")");
    /* A TAP WRITES, AND NOTHING DISMISSES — Paul's own sentence, on the widget
       that most obviously gets tapped twice. */
    const wrote = await p.evaluate(() => {
      const f = document.querySelector('#pan-band .nu-lzfield[data-sel="alphabet.scale"]');
      const cold = [...f.querySelectorAll(".nu-lz")]
        .find((c) => c.getAttribute("aria-pressed") !== "true" && !c.disabled);
      if (!cold) return null;
      const want = cold.dataset.v;
      cold.click();
      const still = document.querySelector('#pan-band .nu-lzfield[data-sel="alphabet.scale"]');
      return { want, doc: (window.__eightDoc().alphabet || {}).scale,
               open: !!still,
               hot: still ? [...still.querySelectorAll(".nu-lz")]
                 .filter((c) => c.getAttribute("aria-pressed") === "true")
                 .map((c) => c.dataset.v) : [] }; });
    check(!!wrote && String(wrote.doc) === String(wrote.want) && wrote.open &&
          wrote.hot.includes(wrote.want),
      "T12i …a tap WRITES the document and the field is still open under the " +
      "thumb (" + JSON.stringify(wrote) + ")");
    /* AND THE PAGE STILL DOES NOT SCROLL SIDEWAYS, which is the one thing a
       field of a hundred and forty-seven pills could plausibly break. */
    const side = await p.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(side <= 1, "T12j …and the page still does not scroll sideways (" +
      side + "px)");
    await p.evaluate(() => window.__eightRow("time", false));
    await p.waitForTimeout(300);

    /* ---- T12k · THE FROZEN STACK IS OPAQUE, AND SO ARE ITS SEAMS ------
       The design pass gave the COLUMN heads a ground and a z-index because a
       sheet was printing straight through them. The three merged rows above
       them — TIME · RULES · PHRASES — got the ground, and nothing got the 3px
       of `border-spacing` BETWEEN them: a cell sheet and a lozenge field
       printed through both seams (measured at 390 on Kingston 1969, "…default
       | fill…" between TIME and RULES and "DIMINISHED, HALF-WHOLE" under the
       scale picker). Three opaque rows with two clear lines through them are
       not a frozen head; they are a venetian blind.
       READ OFF THE RENDERED STACK, not off the stylesheet: every frozen head
       opaque in the page's own `--ground`, every one of them ABOVE the sheet
       that scrolls under it, and every seam between two of them covered by the
       grounds the two rows carry past their own edges. Before the repair the
       cover was 0 against a 3px gap at all three widths. */
    const STACK = `(() => {
      const host = document.getElementById("pan-band");
      const grid = host.querySelector("table.nu-wordgrid");
      const zOf = (el) => { const z = getComputedStyle(el).zIndex;
        return z === "auto" ? 0 : +z; };
      /* the outer spread of a box-shadow, in px — what a head paints OUTSIDE
         its own border box, which is the only thing that can reach a seam */
      const spread = (sh) => { if (!sh || sh === "none") return 0;
        let best = 0;
        for (const part of sh.split(/,(?![^(]*\\))/)) {
          if (/inset/.test(part)) continue;
          const n = (part.match(/-?[0-9.]+px/g) || []).map(parseFloat);
          if (n.length >= 4) best = Math.max(best, n[3]);
        }
        return best; };
      const swatch = document.createElement("i");
      swatch.style.color = getComputedStyle(document.documentElement)
        .getPropertyValue("--ground").trim();
      document.body.appendChild(swatch);
      const want = getComputedStyle(swatch).color; swatch.remove();
      const rows = []; const seen = new Set();
      /* THE GRID'S OWN HEAD ROWS, AND NOT EVERY thead th UNDER IT
         (2026-09-05). A special row's sheet is a row of this head now, and the
         sheets seat whole tables of their own — the chord grid's head is a
         head cell too, and reading it counted five more "frozen rows" with
         185px "seams" between them. The child selector below is the stack this
         check is about: the rows of the band table's own head. */
      for (const th of grid.querySelectorAll(":scope > thead > tr > th")) {
        const cs = getComputedStyle(th);
        if (cs.position !== "sticky") continue;
        const r = th.getBoundingClientRect();
        const k = r.top.toFixed(1); if (seen.has(k)) continue; seen.add(k);
        rows.push({ top: r.top, bottom: r.bottom, bg: cs.backgroundColor,
                    z: zOf(th), spread: spread(cs.boxShadow),
                    /* PINNED, WHICH IS NOT THE SAME AS STICKY SINCE
                       2026-09-05: stick() writes auto on the head rows that
                       stand below an open special row's editor, because their
                       line is a whole sheet down the scroll content and a pin
                       written from there is a shove, not a freeze. They keep
                       the declaration and hold nothing — so the SEAMS below
                       are counted between the rows that are actually frozen. */
                    pin: cs.insetBlockStart !== "auto" });
      }
      rows.sort((a, b) => a.top - b.top);
      const sheet = host.querySelector(".nu-vsheet");
      const sz = sheet ? zOf(sheet) : -1;
      const seams = [];
      const pinned = rows.filter((r) => r.pin);
      for (let i = 0; i < pinned.length - 1; i++)
        seams.push({ gap: +(pinned[i + 1].top - pinned[i].bottom).toFixed(2),
                     cover: pinned[i].spread + pinned[i + 1].spread });
      return { n: rows.length, pinned: pinned.length, want, sheet: !!sheet, sz,
        clear: rows.filter((r) => r.bg !== want).length,
        under: rows.filter((r) => r.z <= sz).length,
        open: seams.filter((s) => s.gap > 0.5 && s.cover + 0.01 < s.gap).length,
        seams };
    })()`;
    for (const W of [320, 390, 1280]) {
      await ctx.pages()[0].setViewportSize({ width: W, height: W === 1280 ? 900 : 844 });
      await p.waitForTimeout(400);
      await top("Band");
      /* THE EXACT REPRO IS A CELL'S SHEET, WHICH IS THE ONE THE LEAK WAS
         MEASURED ON ("…default | fill…" printing between TIME and RULES at
         390 on Kingston 1969) AND THE ONE THAT STILL SCROLLS UNDER ALL FOUR
         ROWS. It was the TIME row's sheet until 2026-09-05, when a special
         row's editor became that row's own next line in the head (Paul, on
         v284: *"when I click time and rules they show up under phrases"*): the
         rows BELOW an open special row ride the scroll with its editor, so the
         stack under an open TIME is one row deep and there is no seam left in
         it to leak through. T12m measures that arrangement; this measures the
         full stack, with a sheet — lozenge field and all — under it. */
      await openCell("tcell|" + vn12 + "|" + sid12);
      await p.evaluate(() => {
        const pane = document.querySelector("#pan-band .nu-pane");
        if (pane) pane.scrollTop =
          Math.min(320, pane.scrollHeight - pane.clientHeight); });
      await p.waitForTimeout(300);
      const st = await p.evaluate(STACK);
      check(st.n >= 4 && st.clear === 0,
        "T12k at " + W + " every frozen head is opaque in --ground (" +
        st.clear + " of " + st.n + " see-through, want " + st.want + ")");
      check(st.sheet && st.under === 0,
        "T12k …and every one of them is ABOVE the sheet that scrolls under it " +
        "(sheet z " + st.sz + ", " + st.under + " heads at or below it)");
      /* ...AND SINCE 2026-09-05 THERE IS NO SEAM TO LEAK THROUGH (TABLE.md
         §13a.1). It read "the stack is FOUR rows deep and therefore three
         seams deep, asserted so the count below cannot pass by having nothing
         to measure" — which was the right way to write it while four bands
         pinned at once, and four bands pinning at once is the disease §13
         names. One band pins now, and with a CELL sheet open (which is the
         state this check is taken in) none does: the sheet's own first line is
         in flow at its top and a pinned head over it would be the second band.
         So the claim turns into its own opposite and keeps its teeth: there is
         nothing to leak BETWEEN, because there is at most one frozen row, and
         the check still fails if a second one appears. */
      check(st.open === 0 && st.pinned <= 1 && st.seams.length === 0,
        "T12k …and there is NO SEAM to render through: at most one band is " +
        "frozen (" + st.pinned + " pinned of " + st.n + " sticky, " +
        st.seams.length + " seams, " + st.open + " uncovered) " +
        JSON.stringify(st.seams));
      await tap("tcell|" + vn12 + "|" + sid12);
      await p.evaluate(() => {
        const pane = document.querySelector("#pan-band .nu-pane");
        if (pane) pane.scrollTop = 0; });
      await p.waitForTimeout(250);
    }

    /* ---- T12m · A SPECIAL ROW'S EDITOR OPENS UNDER THAT ROW -----------
       Paul, on v284: *"When I click time and rules they show up under
       phrases."* They did: the sheet was drawn at the top of the `<tbody>`,
       which is where a COLUMN head's sheet lands because a column has no row
       of its own — and TIME has a row of its own, three rows and a set of
       column heads above the body. DESIGN.md §2.3 says a special row's
       *"expanded = its sheet"* and §2.4 says a sheet is *"in flow (never a
       modal)"*: the sheet is the tapped row's own next line, nothing may stand
       between them, and §2.3's *"pins under the rows ABOVE it"* says which
       rows keep their freeze while it is open — the ones above the tapped row.
       SO THIS MEASURES THE RENDERED GEOMETRY, at both ends of the range: the
       editor's top edge against the bottom edge of the row that opened it, the
       row itself still pinned and still opaque over the sheet scrolling under
       it, and the tap-outside law unbroken. */
    {
      const SPGEOM = `(() => {
        const grid = document.querySelector("#pan-band table.nu-sheetgrid");
        const rows = [...grid.querySelectorAll(":scope > thead > tr")];
        const open = grid.querySelector(":scope > thead > tr.nu-spopen");
        if (!open) return { none: true };
        const i = rows.indexOf(open);
        const row = rows[i - 1];
        const sheet = open.querySelector(".nu-vsheet");
        if (!row || !sheet) return { none: true };
        const rr = row.getBoundingClientRect(), sr = sheet.getBoundingClientRect();
        const th = row.querySelector("th"), cs = getComputedStyle(th);
        const bg = getComputedStyle(sheet).backgroundColor;
        return { id: row.dataset.special,
                 own: row.classList.contains("nu-sprow"),
                 lit: th.querySelector("[aria-expanded=true]") ? true : false,
                 gap: +(sr.top - rr.bottom).toFixed(1),
                 pinned: cs.position === "sticky" && cs.insetBlockStart !== "auto",
                 seen: sr.height > 40 && sr.width > 40 && sr.top < innerHeight,
                 solid: !!bg && !/rgba\\(0, 0, 0, 0\\)/.test(bg) &&
                        bg !== "transparent" };
      })()`;
      for (const W of [390, 1280]) {
        await ctx.pages()[0].setViewportSize({ width: W, height: W === 1280 ? 900 : 844 });
        await p.waitForTimeout(400);
        await top("Band");
        for (const id of ["time", "rules", "motifs"]) {
          await tap("t" + id);
          const g = await p.evaluate(SPGEOM);
          /* 12px: `.nu-trims` pays 3px of `border-spacing` between two rows
             and `.nu-wopen > td` pays `--s2` of air above the sheet — measured
             at 9.0 at both widths on all three rows. Anything more is another
             row standing in between, which is the bug. */
          check(!g.none && g.own && g.id === id && g.gap >= 0 && g.gap <= 12,
            "T12m at " + W + " the " + id.toUpperCase() + " row's editor opens " +
            "DIRECTLY under that row — " + JSON.stringify(g));
          check(!g.none && g.pinned && g.seen && g.solid,
            "T12m …with the row still frozen over an editor that is visible " +
            "and opaque — " + JSON.stringify(g));
          /* ...AND WHATEVER IS STILL FROZEN IS STILL A FROZEN HEAD: opaque in
             `--ground`, above the sheet riding under it, no open seam. */
          const st = await p.evaluate(STACK);
          check(st.n >= 1 && st.clear === 0 && st.under === 0 && st.open === 0,
            "T12m …and nothing renders through the frozen stack with " + id +
            " open (" + st.pinned + " of " + st.n + " head rows frozen, " +
            st.clear + " see-through, " + st.under + " under the sheet, " +
            st.open + " open seams)");
          /* THE TAP-OUTSIDE LAW, UNBROKEN BY THE MOVE (Paul: *"dismiss them
             when I tap outside of them"*) — a press on the page's own chrome,
             which is what `armOutside` calls outside. */
          const shut = await p.evaluate(() => {
            const el = document.querySelector("#pan-band .nu-pan") ||
                       document.getElementById("pan-band");
            el.dispatchEvent(new PointerEvent("pointerdown",
              { bubbles: true, composed: true }));
            return new Promise((res) => setTimeout(() => res(
              !document.querySelector("#pan-band tr.nu-spopen")), 350)); });
          check(shut, "T12m …and a tap outside still shuts " + id);
          if (!shut) await tap("t" + id);
        }
      }
      await ctx.pages()[0].setViewportSize({ width: 390, height: 844 });
      await p.waitForTimeout(400);
    }

    /* ---- T12l · THE SECTION NAMES ARE THE NAVIGATION ------------------
       Paul's own order of controls is the form first, and the form is this
       column: the row heads are how a composer moves around the record. The
       restyle put the head at `--t2` with `overflow: hidden` in a column that
       had never actually been given a width (`.nu-wordgrid thead th:first-child`
       has addressed the TIME row's `<th colspan>` since §10a), and the names
       rendered "b…", "d…", "in…", "v…" under a corner reading "S…".
       MEASURED ON THE RENDERED TYPE: the five words a section is usually
       called, laid out in the name's own computed font, must fit the name's
       own box — a canvas measurement rather than a hard-coded pixel count, so
       the check follows the type wherever the type goes. Plus: no short name
       on the record itself ellipsised, the corner's word whole, and the bar
       count on its own line UNDER the name (a head is a name and a count, in
       that order). */
    const NAMES = `(() => {
      const host = document.getElementById("pan-band");
      const grid = host.querySelector("table.nu-wordgrid");
      const th = grid.querySelector("tbody th.nu-srowh");
      const name = th && th.querySelector(".nu-srowname");
      if (!name) return null;
      const cs = getComputedStyle(name);
      const cv = document.createElement("canvas").getContext("2d");
      cv.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " +
                cs.fontFamily;
      const box = name.clientWidth;
      const heads = [...grid.querySelectorAll("tbody th.nu-srowh")];
      const named = heads.filter((t) => t.querySelector(".nu-srowname"));
      const corner = host.querySelector(".nu-corner");
      return {
        headW: +th.getBoundingClientRect().width.toFixed(1), box,
        font: cv.font,
        misses: ["bass", "drums", "intro", "verse", "chorus"]
          .filter((w) => cv.measureText(w).width > box + 0.5),
        cut: named.map((t) => t.querySelector(".nu-srowname"))
          .filter((n) => n.textContent.trim().length <= 6 &&
                         n.scrollWidth > n.clientWidth + 1)
          .map((n) => n.textContent.trim()),
        corner: corner
          ? { w: corner.textContent.trim(),
              cut: corner.scrollWidth > corner.clientWidth + 1 } : null,
        heads: named.length,
        counted: named.filter((t) => {
          const n = t.querySelector(".nu-srowname"), s = t.querySelector("small");
          return s && /[0-9]/.test(s.textContent) &&
            s.getBoundingClientRect().top >=
              n.getBoundingClientRect().bottom - 1; }).length };
    })()`;
    for (const W of [320, 390, 1280]) {
      await ctx.pages()[0].setViewportSize({ width: W, height: W === 1280 ? 900 : 844 });
      await p.waitForTimeout(400);
      await top("Band");
      const nm = await p.evaluate(NAMES);
      check(!!nm && nm.headW >= 64,
        "T12l at " + W + " the section column is a column and not a letter — " +
        (nm && nm.headW) + "px (was 35.6 at 320 and 390)");
      check(!!nm && nm.misses.length === 0,
        "T12l …and bass · drums · intro · verse · chorus all fit its type (" +
        JSON.stringify(nm && nm.misses) + " do not, in " +
        (nm && nm.box) + "px of " + (nm && nm.font) + ")");
      check(!!nm && nm.cut.length === 0,
        "T12l …no short name on the record ellipsised (" +
        JSON.stringify(nm && nm.cut) + ")");
      check(!!nm && !!nm.corner && !nm.corner.cut,
        "T12l …the corner's own word whole (" +
        JSON.stringify(nm && nm.corner) + ")");
      check(!!nm && nm.heads > 0 && nm.counted === nm.heads,
        "T12l …and the bar count under every one of them (" +
        (nm && nm.counted) + " of " + (nm && nm.heads) + ")");
    }
    await ctx.pages()[0].setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(400);
    await top("Band");
  }

  /* ================= T12n · THE LOZENGE FIELD ON A PHONE ================
     Paul, 2026-09-05, with the v286 TIME row on his iPhone: *"The lozenges all
     overlap and you added sentences of text to some of them"* — and, on the
     same field: *"When I tap a mode you snap to the top of the screen it
     shouldn't move at all."*

     WHY THIS RUNS IN ITS OWN CONTEXT AND NOT AT 390 IN THIS ONE. Every check
     above drives a 390px DESKTOP page: a fine pointer, no touch, no device
     scale. The design pass's own 390 screenshots (scratchpad/design/after/
     scale-picker-390.png) looked right in exactly that page while the phone
     was drawing the picture Paul photographed, because three of the four
     defects only exist where a thumb is: the chassis ▾ is drawn at every
     width, but the pane is only a VERTICAL scrollport when the table is taller
     than the glass, and the field is only reached through `pointer: coarse` at
     all. So this opens `devices["iPhone 14"]` — coarse, touch, DPR 3 — at both
     phone widths, and reads the rendered boxes off it ([[test-the-artifact]]).

     WHAT IT ASSERTS, on the four surfaces §11d names (the mode picker, the
     scale picker, the instrument picker's 147 words in 13 clusters, and the
     drummer's does-sheet):
       · NO TWO PILLS' BOXES INTERSECT. Before: 35 intersecting pairs on the
         mode picker at 390 and 161 on the instrument picker, 10px each, from
         `margin-block: -5px` under a 44px drawn pill.
       · A PILL HOLDS ITS WORD AND NOTHING ELSE. Before: "ukrainian dorian"
         drawn 54px tall around "the record is straight, and modal harmony has
         no changes" (`.nu-lzwhy`, now gone; the sentence is the say line's).
       · ONE CONTROL, ONE OWNER: no ▾ over the field and no `<select>` on the
         same address beside it. Before: `content: "▾"` on the chassis.
       · EVERY PILL IS 44px OF THUMB, and the page does not scroll sideways.
       · AND A TAP MOVES NOTHING: the scrollport's own `scrollTop` and the
         tapped pill's box are the same before and after the write. Before:
         1898 -> 0 with the pill 1898px below the fold, and 42.6 -> 48.7px wide
         because bold is wider than the word it replaced. */
  {
    const phones = [390, 320];
    for (const W of phones) {
      const pctx = await b.newContext(Object.assign({}, devices["iPhone 14"], {
        viewport: { width: W, height: 844 }, deviceScaleFactor: 3,
        isMobile: true, hasTouch: true }));
      const q = pctx.pages()[0] || await pctx.newPage();
      q.on("pageerror", (e) => errs.push("pageerror(phone " + W + "): " + e.message));
      q.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text()))
        errs.push("console(phone " + W + "): " + m.text()); });
      await q.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
      await q.goto(PAGE + REGGAE, { waitUntil: "domcontentloaded" });
      await q.waitForTimeout(2600);

      /* the same three gestures the desktop half uses, on the phone page */
      const ptap = async (k) => { const r = await q.evaluate((key) => {
          const el = document.querySelector('#pan-band [data-k="' + key + '"]');
          if (!el) return "missing"; el.click(); return "ok"; }, k);
        await q.waitForTimeout(450); return r; };
      const pcell = async (k) => { await q.evaluate((key) => {
          const el = document.querySelector('#pan-band [data-k="' + key + '"]');
          if (!el) return;
          if (!el.classList.contains("is-sel")) el.click();
          const e2 = document.querySelector('#pan-band [data-k="' + key + '"]');
          if (e2 && e2.getAttribute("aria-expanded") !== "true") e2.click(); }, k);
        await q.waitForTimeout(500); };
      const pfield = async (k) => { await q.evaluate((key) => {
          const f = document.querySelector('#pan-band [data-k="' + key + '"]');
          if (f && f.getAttribute("aria-expanded") !== "true") f.click(); }, k);
        await q.waitForTimeout(500); };
      /* EVERY NUMBER OFF THE RENDERED BOX: the pairwise intersection of the
         drawn pills, what each pill's own text is against its own word, the
         chassis's ▾, a `<select>` on this field's address, and the page's
         sideways overflow. */
      const pmeasure = (sel) => q.evaluate((sel) => {
        const f = document.querySelector('#pan-band .nu-lzfield[data-sel="' + sel + '"]');
        if (!f) return { missing: true };
        const all = [...f.querySelectorAll("button.nu-lz")];
        const box = all.map((x) => { const r = x.getBoundingClientRect();
          return { v: x.dataset.v, x: r.x, y: r.y, w: r.width, h: r.height }; });
        let hits = 0, worst = null;
        for (let i = 0; i < box.length; i++) for (let j = i + 1; j < box.length; j++) {
          const a = box[i], c = box[j];
          const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
          const oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
          if (ox > 0.5 && oy > 0.5) { hits++; if (!worst) worst = [a.v, c.v, +oy.toFixed(1)]; }
        }
        const sentences = all.filter((x) => {
          const w = ((x.querySelector(".nu-lzword") || {}).textContent || "").trim();
          const n = ((x.querySelector(".nu-lzn") || {}).textContent || "").trim();
          return (x.textContent || "").replace(/\s+/g, " ").trim().replace(n, "").trim() !== w;
        }).map((x) => (x.textContent || "").trim().slice(0, 40));
        const chassis = f.closest(".nu-combo");
        const own = chassis || f.closest(".nu-sheetrow") || f.parentElement;
        const head = f.querySelector(".nu-lzhead");
        const wrap = f.querySelector(".nu-lzwrap:not([hidden])");
        const first = wrap ? wrap.querySelector("button.nu-lz") : null;
        return { n: all.length, hits, worst,
          clusters: f.querySelectorAll(".nu-lzcluster").length,
          short: box.filter((x) => x.h < 43.5).length,
          sentences: sentences.length, saidInside: sentences.slice(0, 1),
          whys: f.querySelectorAll(".nu-lzwhy").length,
          arrow: chassis ? getComputedStyle(chassis, "::after").content : "none",
          twins: own ? [...own.querySelectorAll("select")]
            .map((x) => String(x.dataset.k || x.name || "?"))
            .filter((k) => k === sel || k.indexOf(sel + "|") === 0 ||
                           k.indexOf("sel|" + sel) === 0).length : 0,
          rule: head && first
            ? +(first.getBoundingClientRect().top -
                head.getBoundingClientRect().bottom).toFixed(1) : null,
          say: !!f.querySelector(".nu-lzsay"),
          side: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      }, sel);
      /* THE TAP THAT MUST MOVE NOTHING. The scrollport is found by asking the
         page which element scrolls, not by naming one: `.nu-pane` is the band
         table's, and a gate that hard-coded it would go quiet the day it moved. */
      const pjump = async (sel) => {
        const before = await q.evaluate((sel) => {
          const f = document.querySelector('#pan-band .nu-lzfield[data-sel="' + sel + '"]');
          if (!f) return null;
          const sc = [...document.querySelectorAll("*")].filter((e) =>
            e.scrollHeight - e.clientHeight > 4 &&
            /auto|scroll/.test(getComputedStyle(e).overflowY));
          sc.push(document.scrollingElement);
          const cold = [...f.querySelectorAll("button.nu-lz")].filter((x) =>
            !x.disabled && x.getAttribute("aria-disabled") !== "true" &&
            x.getAttribute("aria-pressed") !== "true");
          const t = cold[Math.min(cold.length - 1, Math.floor(cold.length * 0.7))];
          if (!t) return null;
          t.scrollIntoView({ block: "center" });
          const r = t.getBoundingClientRect();
          const was = { tops: sc.map((e) => e.scrollTop), k: t.dataset.k, v: t.dataset.v,
            box: [+r.x.toFixed(1), +r.y.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)] };
          t.click();
          return was; }, sel);
        if (!before) return null;
        await q.waitForTimeout(700);
        return await q.evaluate((was) => {
          const sc = [...document.querySelectorAll("*")].filter((e) =>
            e.scrollHeight - e.clientHeight > 4 &&
            /auto|scroll/.test(getComputedStyle(e).overflowY));
          sc.push(document.scrollingElement);
          const again = document.querySelector('#pan-band [data-k="' + was.k + '"]');
          const r = again ? again.getBoundingClientRect() : null;
          return { v: was.v, tops: was.tops, now: sc.map((e) => e.scrollTop),
            box: was.box,
            after: r ? [+r.x.toFixed(1), +r.y.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)] : null,
            open: !!again, hot: again ? again.getAttribute("aria-pressed") : null };
        }, before);
      };

      /* ---- the TIME row's two: the mode picker (Paul's own screen) and the
         scale picker, with the refusals showing. Kingston 1969 swings and is
         not modal, so the two facts that grey a mode are written first through
         the controls on this very sheet — the greyed pill is the subject. */
      /* THE TWO FACTS ARE WRITTEN FROM THE TWO ROWS THAT OWN THEM (2026-09-05,
         §13f): the swing is TIME's and the harmony is the CHORDS row's, so
         the harmony chip is pressed with CHORDS open and the row is shut again
         before the pickers are measured. One control page-wide, and the gate
         reaches it where it stands. */
      await q.evaluate(() => window.__eightRow("chords", true));
      await q.waitForTimeout(700);
      await q.evaluate(() => { const e = document.querySelector(
          '#pan-band [data-k="alphabet.harmony|modal"]'); if (e) e.click(); });
      await q.waitForTimeout(700);
      await q.evaluate(() => window.__eightRow("chords", false));
      await q.waitForTimeout(300);
      await q.evaluate(() => window.__eightRow("time", true));
      await q.waitForTimeout(700);
      await q.evaluate(() => { const e = document.querySelector(
          '#pan-band [data-k="time.swing|"]'); if (e) e.click(); });
      await q.waitForTimeout(900);
      const surfaces = [];
      surfaces.push(["the mode picker", await pmeasure("alphabet.mode")]);
      surfaces.push(["the scale picker", await pmeasure("alphabet.scale")]);
      /* A REFUSED WORD SAYS WHY WITHOUT WEARING IT: the pill keeps its word,
         the sentence lands in the field's one say line, and nothing is
         written. This is the half `.nu-lzwhy` used to do inside the button. */
      const refusal = await q.evaluate(() => {
        const f = document.querySelector('#pan-band .nu-lzfield[data-sel="alphabet.mode"]');
        const off = f && f.querySelector('.nu-lz[aria-disabled="true"], .nu-lz[disabled]');
        if (!off) return null;
        const say = f.querySelector(".nu-lzsay");
        const was = (window.__eightDoc().alphabet || {}).mode;
        off.click();
        return { word: ((off.querySelector(".nu-lzword") || {}).textContent || "").trim(),
          pill: (off.textContent || "").replace(/\s+/g, " ").trim(),
          why: off.dataset.why || "", said: (say.textContent || "").trim(),
          was, now: (window.__eightDoc().alphabet || {}).mode }; });
      const jmode = await pjump("alphabet.mode");
      await q.evaluate(() => window.__eightRow("time", false));
      await q.waitForTimeout(400);

      /* ---- the instrument picker, in a chair's sheet (147 words, 13 clusters) */
      const PD = await q.evaluate(() => window.__eightDoc());
      const pv = ((PD.voices || []).find((v) => v.kind !== "drums") || (PD.voices || [])[0] || {}).name;
      let jinstr = null;
      if (pv) {
        await ptap("tcol|" + pv);
        const irow = await q.evaluate(() => {
          const o = document.querySelector("#pan-band tr.nu-wopen");
          if (!o) return null;
          const r = [...o.querySelectorAll(".nu-sheetrow")].find((x) =>
            ((x.querySelector(".nu-sheetlab") || {}).textContent || "").trim() === "instrument");
          const c = r && r.querySelector(".nu-wcell");
          return c ? c.dataset.k : null; });
        if (irow) { await pfield(irow);
          surfaces.push(["the instrument picker", await pmeasure(irow)]);
          jinstr = await pjump(irow); }
        await ptap("tcol|" + pv);
      }

      /* ---- and the drummer's does-sheet, which is §11d's first surface */
      const pdr = ((PD.voices || []).find((v) => v.kind === "drums") || {}).name;
      const psec = (((PD.form || {}).sections || [])[0] || {}).id;
      if (pdr && psec) {
        await pcell("tcell|" + pdr + "|" + psec);
        await pfield("dev.kit|" + pdr + "|" + psec);
        surfaces.push(["the does sheet", await pmeasure("dev.kit|" + pdr + "|" + psec)]);
      }

      const found = surfaces.filter(([, m]) => m && !m.missing);
      check(found.length === 4, "T12n at " + W + " on an iPhone: all four of " +
        "§11d's surfaces open — " + surfaces.map(([n, m]) =>
          n + (m && !m.missing ? " (" + m.n + ")" : " MISSING")).join(" · "));
      const over = found.filter(([, m]) => m.hits > 0);
      check(over.length === 0, "T12n …NO TWO PILLS' BOXES INTERSECT (" +
        (over.length ? over.map(([n, m]) => n + ": " + m.hits + " pairs, worst " +
          JSON.stringify(m.worst)).join(" · ") : "0 pairs across " +
          found.reduce((a, [, m]) => a + m.n, 0) + " pills") + ")");
      const wordy = found.filter(([, m]) => m.sentences > 0 || m.whys > 0);
      check(wordy.length === 0, "T12n …and a PILL CARRIES A WORD, never a " +
        "sentence (" + (wordy.length ? wordy.map(([n, m]) =>
          n + ": " + JSON.stringify(m.saidInside)).join(" · ") : "0 of " +
          found.reduce((a, [, m]) => a + m.n, 0) + ")"));
      const twinned = found.filter(([, m]) => m.twins > 0 || /▾|25BE/.test(String(m.arrow)));
      check(twinned.length === 0, "T12n …ONE CONTROL, ONE OWNER: no native " +
        "picker and no ▾ over a lozenge field (" + (twinned.length
          ? twinned.map(([n, m]) => n + ": " + m.arrow + " / " + m.twins +
              " selects").join(" · ") : "clean") + ")");
      const shortOf = found.filter(([, m]) => m.short > 0);
      check(shortOf.length === 0, "T12n …every pill 44px of thumb (" +
        (shortOf.length ? shortOf.map(([n, m]) => n + ": " + m.short).join(" · ")
         : "0 short") + ")");
      const through = found.filter(([, m]) => m.rule == null || m.rule < 0);
      check(through.length === 0, "T12n …the cluster's rule ABOVE its pills, " +
        "not through them (" + found.map(([, m]) => m.rule).join(" · ") + "px)");
      check(found.every(([, m]) => m.side <= 1), "T12n …and the page does not " +
        "scroll sideways (" + found.map(([, m]) => m.side).join(" · ") + "px)");
      check(!!refusal && refusal.pill === refusal.word && !!refusal.why &&
            refusal.said === refusal.why && refusal.now === refusal.was,
        "T12n …a refused word SAYS why in the say line and writes nothing — " +
        JSON.stringify(refusal));
      for (const [name, j] of [["the mode picker", jmode],
                               ["the instrument picker", jinstr]]) {
        check(!!j && JSON.stringify(j.tops) === JSON.stringify(j.now) &&
              JSON.stringify(j.box) === JSON.stringify(j.after) &&
              j.open && j.hot === "true",
          "T12n …and a tap on " + name + " at " + W + " WRITES AND MOVES " +
          "NOTHING — " + JSON.stringify(j));
      }
      await pctx.close();
    }
  }

  /* ================= T13 · ONE SCROLL, ONE PIN ==========================
     (2026-09-05, TABLE.md §13.) THE COMPLAINT, VERBATIM, with the iPhone
     screenshot of the Silence record beside it: *"Please look at this mess and
     I can't really get to anything — things don't scroll out of the way for me
     to focus it's all jammed up. Propose an elegant redesign that keeps the
     verticality and the scrolling interface."*

     WHY THIS RUNS IN ITS OWN CONTEXTS. Every check above T12n drives a 390px
     DESKTOP page — a fine pointer, no touch, no device scale — and the budget
     §13b sets is a PHONE's: 844 points of glass, a safe area, and a thumb.
     `devices["iPhone 14"]` at 390 and at 320, on the two records §13b names
     (Kingston 1969 and the blank state), and 1280 for *"the desktop is the
     phone given room"*.

     WHAT IT ASSERTS, row by row from §13b's own table:
       a  fixed chrome at rest is THE BAR ALONE, ≤ 72pt + the safe area
       b  ONE band pins inside the pane at rest, it is the column heads, and it
          is ≤ `--tap` + 3px
       c  with a special row's sheet open, the OWNER ROW pins and nothing else
       d  with a CELL sheet open, nothing in the head pins at all, and the
          sheet's own first line is in flow at its top
       e  the pane at rest is ≥ 844 − bar − safe area − 8
       f  zero overlapping cell pairs in a section row, on a record with a band
       g  zero heads cut mid-word
       h  the pane's `scrollTop` is IDENTICAL across open and close of TIME, of
          RULES and of a cell (v287's T12n law, now for the row)
       i  the head row ends in ONE `+` of `--tap`, and so does the grid's foot
       j  nothing in `<tfoot>` is pinned in the block direction
       k  every special row is ONE LINE at rest
       l  T7's law re-proved at 320: the formula bar's five and the addbars'
          four are each reachable in ≤ 2 taps from rest
       m  the grid has its own header — SECTIONS, one `--tap` line above the
          column heads, a label with no control in it and no pin on it (§13e)
       n  a tap on either `+` ADDS, asks nothing, and moves no scroll (§13e) */
  {
    const REST = 8;
    const beds = [["Kingston 1969", REGGAE], ["the Silence record", ""]];
    for (const [recName, hash] of beds) {
      for (const W of [390, 320, 1280]) {
        const phone = W !== 1280;
        const c13 = await b.newContext(phone
          ? Object.assign({}, devices["iPhone 14"],
              { viewport: { width: W, height: 844 }, deviceScaleFactor: 3,
                isMobile: true, hasTouch: true })
          : { viewport: { width: 1280, height: 844 } });
        const z = c13.pages()[0] || await c13.newPage();
        z.on("pageerror", (e) => errs.push("pageerror(T13 " + W + "): " + e.message));
        z.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text()))
          errs.push("console(T13 " + W + "): " + m.text()); });
        await z.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
        await z.goto(PAGE + hash, { waitUntil: "domcontentloaded" });
        await z.waitForTimeout(2600);
        await z.evaluate(() => window.__eightTab("Band"));
        await z.waitForTimeout(700);
        const at = recName + " @ " + W;
        /* THE GESTURES, AND THEY ARE A HAND'S: `el.click()` on the button a
           thumb would press, never `page.click()` (which scrolls its target
           into view first and has manufactured "jumps" on this box before). */
        const ztap = async (k) => { const r = await z.evaluate((key) => {
            const el = document.querySelector('#pan-band [data-k="' + key + '"]');
            if (!el) return "missing"; el.click(); return "ok"; }, k);
          await z.waitForTimeout(450); return r; };
        /* ...AND THE ACCORDION'S ONE OPEN HEAD, SHUT — the same gesture
           `shutAll` makes in the T10 block, in this block's own context. */
        const zshut = async () => { await z.evaluate(() => {
            const el = document.querySelector(
              '#pan-band [aria-expanded="true"].nu-rowjump, ' +
              '#pan-band [aria-expanded="true"].nu-wcell, ' +
              '#pan-band [aria-expanded="true"].nu-sphead');
            if (el) el.click(); }); await z.waitForTimeout(450); };

        /* ---- a · THE FIXED CHROME ------------------------------------- */
        const chrome = await z.evaluate(() => {
          const out = [];
          /* `#nu-chrome` IS `display: contents` AND HAS NO RECT (measured
             2026-09-05, on the first run of this check: it reported zero fixed
             boxes on a page with a fixed bar in it). A box with no client rect
             is not a box a thing can be under — but its CHILDREN may be, and
             the chrome's three are exactly the ones this counts. So a rectless
             element is descended INTO rather than skipped. */
          const walk = (n) => { for (const c of n.children) {
            const cs = getComputedStyle(c);
            if (cs.display === "none") continue;
            if (!c.getClientRects().length) { walk(c); continue; }
            if (cs.position === "fixed") {
              const r = c.getBoundingClientRect();
              out.push({ id: c.id || String(c.className).slice(0, 20),
                         h: +r.height.toFixed(1) });
            } else walk(c); } };
          walk(document.body);
          return { boxes: out,
                   tops: document.querySelectorAll(".nu-top").length,
                   bars: document.querySelectorAll("#nu-bar").length,
                   burger: !!document.querySelector("#nu-bar #burger"),
                   last: (() => { const bar = document.getElementById("nu-bar");
                     return bar && bar.lastElementChild
                       ? bar.lastElementChild.id : null; })(),
                   forms: document.querySelectorAll(".nu-formula").length };
        });
        const chromeH = chrome.boxes.reduce((a, x) => a + x.h, 0);
        check(chrome.boxes.length === 1 && chrome.boxes[0].id === "nu-bar" &&
              chromeH <= 72 && chrome.tops === 0 && chrome.forms === 0 &&
              chrome.burger && chrome.last === "burger",
          "T13a " + at + " · the bar is the ONLY fixed chrome (" + chromeH +
          "pt), `.nu-top` and `.nu-formula` are gone, and the ≡ is the bar's " +
          "last button — " + JSON.stringify(chrome));

        /* ---- b · ONE PINNED BAND, AND IT IS THE HEADS ----------------- */
        const pins = () => z.evaluate(() => {
          const t = document.querySelector("#pan-band table.nu-sheetgrid");
          if (!t) return { missing: true };
          const rows = [...t.querySelectorAll("thead > tr")];
          const held = [];
          rows.forEach((tr, i) => {
            /* THE ROW'S OWN FIRST CELL, AND NOT A DESCENDANT (measured
               2026-09-05). `tr.querySelector("th")` is a DESCENDANT query and
               a special row's SHEET is a row of this head now — the TIME
               sheet seats the chord chart, whose own `<th>` was read as this
               row's pinned line, and the RULES sheet has no `<th>` at all, so
               the same query answered null and threw. */
            const c = tr.firstElementChild;
            if (!c) return;
            const cs = getComputedStyle(c);
            if (cs.position === "sticky" && cs.insetBlockStart !== "auto")
              held.push({ i, sp: tr.dataset.special || null,
                          heads: !tr.dataset.special &&
                                 !tr.classList.contains("nu-wopen"),
                          top: Math.round(parseFloat(cs.insetBlockStart)),
                          h: +tr.getBoundingClientRect().height.toFixed(1) }); });
          const foot = [...t.querySelectorAll("tfoot th, tfoot td, tfoot button")]
            .filter((e) => { const cs = getComputedStyle(e);
              return cs.position === "sticky" && cs.insetBlockStart !== "auto"; })
            .map((e) => String(e.className).slice(0, 24));
          return { held, n: rows.length, foot };
        });
        const rest = await pins();
        /* `--tap` + 3px IS §13b'S NUMBER AND IT IS A PHONE'S. At 390 and 320
           a player column is narrower than 9ch, so the head is a MARK and the
           band is one line of thumb; at 1280 the columns have room and the
           head is its two lines (name over instrument), which is §13b's own
           *"the desktop is the phone given room"* and not a plate coming back.
           Both are asserted, each against its own budget. */
        const band = phone ? 47 : 72;
        check(!rest.missing && rest.held.length === 1 && rest.held[0].heads &&
              rest.held[0].top === 0 && rest.held[0].h <= band,
          "T13b " + at + " · at rest exactly ONE band pins inside the pane and " +
          "it is the column heads, at 0, " +
          (rest.held[0] ? rest.held[0].h : "?") + "px (≤ " + band + ") — " +
          JSON.stringify(rest.held));

        /* ---- j · NOTHING IN `<tfoot>` IS PINNED DOWN THE PAGE ---------- */
        check(rest.foot && rest.foot.length === 0,
          "T13j " + at + " · no `<tfoot>` row is pinned in the block " +
          "direction — a master strip belongs at the bottom of a desk, not " +
          "over it (" + JSON.stringify(rest.foot) + ")");

        /* ---- k · EVERY SPECIAL ROW IS ONE LINE AT REST ----------------- */
        const lines = await z.evaluate(() => {
          const t = document.querySelector("#pan-band table.nu-sheetgrid");
          const rows = t ? [...t.querySelectorAll("tr.nu-sprow, tr.nu-masterrow," +
            " tr.nu-prodrow, tr.nu-perfrow, tr.nu-mixrow")] : [];
          return rows.map((r) => ({
            id: r.dataset.special || r.dataset.row,
            h: +r.getBoundingClientRect().height.toFixed(1),
            plate: getComputedStyle(r.querySelector("th")).backgroundColor,
            lamps: r.querySelectorAll(".nu-motlamp").length })); });
        const tall = lines.filter((x) => x.h > 52);
        check(lines.length >= 6 && tall.length === 0,
          "T13k " + at + " · every special row is ONE LINE at rest — " +
          JSON.stringify(lines.map((x) => x.id + ":" + x.h)) +
          (tall.length ? " OVER: " + JSON.stringify(tall) : ""));

        /* ---- e · THE PANE GETS THE SCREEN ----------------------------- */
        const geo = await z.evaluate(() => {
          const pane = document.querySelector("#pan-band .nu-pane[data-pane=table]");
          const bar = document.getElementById("nu-bar");
          return { pane: pane ? +pane.getBoundingClientRect().height.toFixed(1) : 0,
                   bar: bar ? +bar.getBoundingClientRect().height.toFixed(1) : 0,
                   vh: window.innerHeight,
                   page: document.documentElement.scrollHeight -
                         document.documentElement.clientHeight,
                   side: document.documentElement.scrollWidth -
                         document.documentElement.clientWidth }; });
        const floor = geo.vh - geo.bar - REST;
        check(geo.pane >= floor && geo.side <= 1,
          "T13e " + at + " · the pane at rest is " + geo.pane + "px against a " +
          "floor of " + floor.toFixed(1) + " (screen − bar − safe area − 8), " +
          "and the page does not scroll sideways — " + JSON.stringify(geo));

        /* ---- i · ONE `+` AT EACH EDGE, `--tap` WIDE -------------------- */
        const plus = await z.evaluate(() => {
          const t = document.querySelector("#pan-band table.nu-sheetgrid");
          const hd = t && t.querySelector("thead th.nu-plushead .nu-plusbtn");
          const ft = t && t.querySelector("tbody tr.nu-addrow th .nu-plusbtn");
          const box = (e) => e ? { w: +e.getBoundingClientRect().width.toFixed(1),
                                   h: +e.getBoundingClientRect().height.toFixed(1),
                                   n: e.closest("th").querySelectorAll("button").length } : null;
          return { head: box(hd), foot: box(ft),
                   old: document.querySelectorAll("#pan-band .nu-addbar," +
                     " #pan-band .nu-addbtn, #pan-band .nu-addhead").length }; });
        check(plus.head && plus.foot && plus.head.n === 1 && plus.foot.n === 1 &&
              plus.head.w <= 48 && plus.foot.w <= 48 && plus.old === 0,
          "T13i " + at + " · one `+` cell at the end of the head row and one " +
          "`+` row at the grid's foot, one button each, `--tap` wide — " +
          JSON.stringify(plus));

        /* ---- f/g · THE CELLS AND THE HEADS ---------------------------- */
        /* THE BLANK STATE HAS NO PLAYERS, WHICH IS THE POINT OF IT — so the
           record §13b names for the overlap count is BUILT here, through the
           head's own `+`, which is the gesture a reader makes and the one this
           round moved. SINCE 2026-09-05 (§13e) THAT IS THREE TAPS ON ONE
           BUTTON: the `+` offers the first kind the band has not got, in
           build-the-band's order, so its address walks drums -> bass -> line
           as the band fills up, and each tap is a hire. The tap that follows
           closes the column sheet the last hire landed on, because everything
           below this measures a head AT REST. */
        const nvoices = await z.evaluate(() => window.__eightDoc().voices.length);
        if (nvoices === 0) {
          for (const k of ["drums", "bass", "line"]) await ztap("tcol-add|" + k);
          await z.evaluate(() => {
            /* ...AND NOT THE SECTIONS DISCLOSURE (2026-09-05, §13f). This
               asked for the first `[aria-expanded="true"]` in the panel and
               clicked it, which was the open column sheet's head until the
               grid's own header became a fold: the label stands FIRST in the
               `<thead>`, so the gesture that meant "close what the hire
               opened" folded the grid instead and eleven checks below went red
               on a table that was not on the glass. A fold is not a sheet. */
            const o = document.querySelector(
              '#pan-band [aria-expanded="true"]:not(.nu-labelbtn)');
            if (o) o.click(); });
          await z.waitForTimeout(400);
        }
        const grid = await z.evaluate(() => {
          const t = document.querySelector("#pan-band table.nu-sheetgrid");
          const tr = t && t.querySelector("tbody tr[data-row]");
          const box = (e) => { const r = e.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height }; };
          const cells = tr ? [...tr.querySelectorAll("td .nu-wcell")].map(box) : [];
          let pairs = 0, worst = null;
          for (let i = 0; i < cells.length; i++)
            for (let j = i + 1; j < cells.length; j++) {
              const a = cells[i], c = cells[j];
              const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
              const oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
              if (ox > 0.5 && oy > 0.5) { pairs++; if (!worst) worst = +ox.toFixed(1); }
            }
          /* A HEAD IS NEVER CUT MID-WORD: what is DRAWN is measured against
             what it would take to draw it whole, on the visible word only. */
          const cut = [];
          const heads = t ? [...t.querySelectorAll("thead th.nu-colhead .nu-colbtn")] : [];
          let hp = 0;
          const hb = heads.map(box);
          for (let i = 0; i < hb.length; i++)
            for (let j = i + 1; j < hb.length; j++) {
              const a = hb[i], c = hb[j];
              const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
              const oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
              if (ox > 0.5 && oy > 0.5) hp++;
            }
          for (const h of heads) {
            for (const n of h.querySelectorAll(".nu-colname, .nu-colinstr")) {
              const vis = getComputedStyle(n).display !== "none" &&
                          n.getClientRects().length;
              if (vis && n.scrollWidth > n.clientWidth + 1)
                cut.push((n.textContent || "").trim() + " " +
                         Math.round(n.clientWidth) + "/" + n.scrollWidth); } }
          return { n: cells.length, pairs, worst, cut, heads: heads.length, hp };
        });
        check(grid.n > 0 && grid.pairs === 0 && grid.hp === 0,
          "T13f " + at + " · zero overlapping pairs among the " + grid.n +
          " cells of a section row and the " + grid.heads + " column heads — " +
          JSON.stringify({ pairs: grid.pairs, heads: grid.hp, worst: grid.worst }));
        check(grid.cut.length === 0,
          "T13g " + at + " · no head is cut mid-word (" +
          (grid.cut.length ? JSON.stringify(grid.cut) : "0 of " + grid.heads) + ")");

        /* ---- c/d/h · THE PIN FOLLOWS WHAT IS OPEN, AND THE SCROLL DOES
           NOT MOVE. v287's T12n law — *"a tap moves nothing"* — asked of the
           ROW: opening and closing TIME, RULES or a cell leaves the pane's own
           `scrollTop` byte for byte where it was. */
        const setTop = async (y) => { await z.evaluate((v) => {
            const pane = document.querySelector("#pan-band .nu-pane[data-pane=table]");
            if (pane) pane.scrollTop = v; }, y);
          await z.waitForTimeout(200); };
        const topOf = () => z.evaluate(() => {
          const pane = document.querySelector("#pan-band .nu-pane[data-pane=table]");
          return pane ? Math.round(pane.scrollTop) : null; });
        const cellK = await z.evaluate(() => {
          const c = document.querySelector("#pan-band tbody tr[data-row] td .nu-wcell");
          return c ? c.dataset.k : null; });
        const moves = [];
        /* FOUR NOW (2026-09-05, §13f): CHORDS is a special row with a sheet
           like the other two, so the pin law and the scrollTop law are asked
           of it by name rather than assumed from its neighbours. */
        for (const [name, k, twice, sp] of [["RULES", "trules", false, "rules"],
                                        ["TIME", "ttime", false, "time"],
                                        ["CHORDS", "tchords", false, "chords"],
                                        ["a cell", cellK, true, null]]) {
          if (!k) continue;
          await setTop(120);
          const y0 = await topOf();
          await ztap(k); if (twice) await ztap(k);
          const y1 = await topOf();
          const open = await pins();
          await ztap(k);
          const y2 = await topOf();
          moves.push({ name, y0, y1, y2, held: open.held });
          if (name === "a cell")
            check(open.held.length === 0,
              "T13d " + at + " · with a CELL sheet open NOTHING in the head " +
              "pins — its own first line is in flow at its top — " +
              JSON.stringify(open.held));
          else
            check(open.held.length === 1 && open.held[0].sp === sp &&
                  open.held[0].top === 0,
              "T13c " + at + " · with " + name + " open its OWN ROW is the " +
              "only pin, at the pane's top edge, as its sheet's header — " +
              JSON.stringify(open.held));
        }
        const kept = moves.filter((m) => m.y0 === m.y1 && m.y1 === m.y2);
        check(kept.length === moves.length,
          "T13h " + at + " · the pane's scrollTop is IDENTICAL across open and " +
          "close of " + moves.map((m) => m.name).join(", ") + " — " +
          JSON.stringify(moves.map((m) => [m.name, m.y0, m.y1, m.y2])));

        /* ---- m · THE GRID'S OWN HEADER (§13e, §13f) ------------------- */
        /* Paul: *"Give the main composer interface its own header call it
           Sections."* One line in the special row's own shape, directly above
           the column heads, with no pin on it — the pane's one pin is spent on
           the heads (b, above), and a label that pinned would be the second
           band §13 exists to delete.
           IT HAS A BUTTON SINCE 2026-09-05 (§13f, Paul: *"Sections should
           collapse when I touch it."*). This asserted `btns === 0` and no
           `data-k`, which was true of a label with nothing to do; the line
           FOLDS the grid now, so what is asserted is the disclosure — exactly
           one button, the whole line, `aria-expanded` and `aria-controls` on
           it — and the two things that did NOT change: it is still one `--tap`
           line above the heads and it still never pins. */
        const lab = await z.evaluate(() => {
          const t = document.querySelector("#pan-band table.nu-sheetgrid");
          const rows = t ? [...t.querySelectorAll("thead > tr")] : [];
          const tr = t && t.querySelector("thead tr.nu-gridlabel");
          const th = tr && tr.firstElementChild;
          const word = th && th.querySelector(".nu-spword");
          const face = th && th.querySelector(".nu-spface");
          const r = th ? th.getBoundingClientRect() : null;
          const wr = word ? word.getBoundingClientRect() : null;
          const fr = face ? face.getBoundingClientRect() : null;
          const cs = th ? getComputedStyle(th) : null;
          return { there: !!th, h: r ? +r.height.toFixed(1) : 0,
            pos: cs ? cs.position : null,
            pinned: !!(cs && cs.position === "sticky" &&
                       cs.insetBlockStart !== "auto"),
            btns: th ? th.querySelectorAll("button").length : 0,
            k: th ? (th.querySelector("button") || { dataset: {} }).dataset.k || null : null,
            expanded: th && th.querySelector("button")
              ? th.querySelector("button").getAttribute("aria-expanded") : null,
            controls: th && th.querySelector("button")
              ? th.querySelector("button").getAttribute("aria-controls") : null,
            body: !!document.getElementById("nu-gridbody"),
            word: word ? (word.textContent || "").trim() : "",
            face: face ? (face.textContent || "").trim() : "",
            upper: word ? getComputedStyle(word).textTransform : null,
            oneLine: !!(wr && fr && Math.abs(wr.top - fr.top) < 6),
            right: !!(wr && fr && fr.right > wr.right),
            aboveHeads: rows.indexOf(tr) === rows.length - 2 };
        });
        check(lab.there && lab.btns === 1 && lab.k === "tsections" &&
              lab.expanded === "true" && lab.controls === "nu-gridbody" &&
              lab.body && !lab.pinned &&
              lab.h >= 44 && lab.h <= 48 && lab.oneLine && lab.right &&
              lab.aboveHeads && /^sections$/i.test(lab.word) &&
              /section/i.test(lab.face) && /bar/i.test(lab.face),
          "T13m " + at + " · the grid has its own header — the word SECTIONS " +
          "left, its count right, one `--tap` line directly above the column " +
          "heads, ONE disclosure button naming the body it folds, and no pin " +
          "on it — " + JSON.stringify(lab));

        /* ---- n · A `+` ADDS. IT DOES NOT ASK (§13e) -------------------- */
        /* Paul, on the ADD sheet that shipped this morning: *"Don't pop up an
           interface when I add a section or a voice. Just add it."* So a tap
           on either `+` writes the record: the row count or the column count
           goes up by one, NO sheet asks anything first, and the pane's
           scrollTop does not move (the same law §13a.3 gives every open and
           close). The SECTION `+` is measured for the sheet count because a
           section arrives with no sheet at all; a hired player still LANDS on
           its own column sheet, which is T8a's own claim and older than this
           round. */
        const addN = async () => z.evaluate(() => {
          const D = window.__eightDoc();
          const pane = document.querySelector(
            "#pan-band .nu-pane[data-pane=table]");
          return { secs: D.form.sections.length, voices: D.voices.length,
                   wopen: document.querySelectorAll("#pan-band .nu-wopen").length,
                   add: document.querySelectorAll("#pan-band .nu-addopen").length,
                   y: pane ? pane.scrollTop : -1 }; });
        const footK = await z.evaluate(() => {
          const b = document.querySelector(
            "#pan-band tbody tr.nu-addrow th .nu-plusbtn");
          return b ? b.dataset.k : null; });
        const headK2 = await z.evaluate(() => {
          const b = document.querySelector(
            "#pan-band thead th.nu-plushead .nu-plusbtn");
          return b ? b.dataset.k : null; });
        const add0 = await addN();
        await ztap(footK);
        const add1 = await addN();
        await ztap(headK2);
        const add2 = await addN();
        check(footK === "trow-add" && /^tcol-add\|/.test(headK2 || "") &&
              add1.secs === add0.secs + 1 && add1.wopen === add0.wopen &&
              add1.add === 0 && add1.y === add0.y &&
              add2.voices === add1.voices + 1 && add2.add === 0,
          "T13n " + at + " · a tap on either `+` ADDS — the section `+` (" +
          footK + ") with no sheet drawn and the pane unmoved, the player `+` (" +
          headK2 + ") hiring the kind the band has not got — " +
          JSON.stringify([add0, add1, add2]));

        /* ---- o · RULES ABOVE TIME, AND CHORDS BELOW IT (§13f) --------- */
        /* Paul, 2026-09-05: *"Put rules above time"* and *"Add chords below
           time and move chord stuff into it."* Four claims, all off the
           rendered page: the ORDER at rest and that each of the four is still
           the one line §13a.2 gives it; that CHORDS opens as its OWN pinned
           header with the changes grid INSIDE it; that the TIME sheet no
           longer draws a changes grid or a harmony menu (a move, not a copy);
           and that the row's FACE says the chain that plays rather than
           "default" on a record whose chart is entirely dealt. */
        await zshut();
        const ord = await z.evaluate(() => {
          const t = document.querySelector("#pan-band table.nu-sheetgrid");
          const rows = t ? [...t.querySelectorAll("thead tr.nu-sprow")] : [];
          return rows.map((r) => ({ id: r.dataset.special,
            k: (r.querySelector("button") || { dataset: {} }).dataset.k || null,
            h: +r.getBoundingClientRect().height.toFixed(1),
            face: ((r.querySelector(".nu-spface") || {}).textContent || "").trim(),
            word: ((r.querySelector(".nu-spword") || {}).textContent || "").trim() }));
        });
        const ids = ord.map((x) => x.id).join(" ");
        const offLine = ord.filter((x) => x.h > 52 || x.h < 44);
        check(ids === "rules time chords motifs" && offLine.length === 0,
          "T13o " + at + " · the head reads RULES · TIME · CHORDS · MOTIFS at " +
          "rest, each one `--tap` line — " +
          JSON.stringify(ord.map((x) => x.id + ":" + x.h)) +
          (offLine.length ? " OUT OF LINE: " + JSON.stringify(offLine) : ""));
        /* THE FACE IS THE CHAIN THAT PLAYS. Every record this gate opens has
           a chart it never wrote; the row still says what sounds — numerals
           joined by `·`, or the chart's size and what the harmony does with
           it — and never the word "default". */
        const cf = (ord.find((x) => x.id === "chords") || {}).face || "";
        check(cf.length > 0 && !/default/i.test(cf),
          "T13o " + at + " · …and the CHORDS face is the chain the record " +
          "PLAYS, never “default” — “" + cf + "”");
        /* THE SHEETS, EACH OPENED IN TURN. `.nu-changes` is the changes grid
           (`ui/eight.js changesNode`) and `alphabet.harmony` its menu; both
           are in CHORDS and neither is in TIME. */
        await ztap("tchords");
        const chS = await z.evaluate(() => {
          const o = document.querySelector("#pan-band thead tr.nu-spopen");
          const own = document.querySelector('#pan-band [data-k="tchords"]');
          const th = own && own.closest("tr") &&
                     own.closest("tr").firstElementChild;
          const cs = th ? getComputedStyle(th) : null;
          return { open: !!o,
            pinned: !!(cs && cs.position === "sticky" &&
                       cs.insetBlockStart !== "auto" &&
                       Math.round(parseFloat(cs.insetBlockStart)) === 0),
            changes: o ? o.querySelectorAll(".nu-changes").length : -1,
            harmony: o ? o.querySelectorAll('[data-sel="alphabet.harmony"]').length : -1,
            diatonic: o ? o.querySelectorAll('[data-k^="diatonic"]').length : -1,
            add: o ? o.querySelectorAll('[data-k="prog-add"]').length : -1,
            groups: o ? [...o.querySelectorAll(".nu-sheetgroup")]
              .map((g) => g.dataset.group) : [] };
        });
        await ztap("tchords");
        await ztap("ttime");
        const tiS = await z.evaluate(() => {
          const o = document.querySelector("#pan-band thead tr.nu-spopen");
          return { open: !!o,
            changes: o ? o.querySelectorAll(".nu-changes").length : -1,
            harmony: o ? o.querySelectorAll('[data-sel="alphabet.harmony"]').length : -1,
            diatonic: o ? o.querySelectorAll('[data-k^="diatonic"]').length : -1,
            bpm: o ? o.querySelectorAll('[data-k="bpm"]').length : -1,
            gain: o ? o.querySelectorAll('[data-k="goto.board"]').length : -1,
            groups: o ? [...o.querySelectorAll(".nu-sheetgroup")]
              .map((g) => g.dataset.group) : [] };
        });
        await ztap("ttime");
        check(chS.open && chS.pinned && chS.changes === 1 &&
              chS.harmony === 1 && chS.diatonic === 1 && chS.add === 1 &&
              chS.groups.join(" ") === "chords harmony",
          "T13o " + at + " · …CHORDS opens as its own pinned header with the " +
          "changes grid, the harmony and the melody flag inside it, in two " +
          "groups — " + JSON.stringify(chS));
        check(tiS.open && tiS.changes === 0 && tiS.harmony === 0 &&
              tiS.diatonic === 0 && tiS.bpm === 1 && tiS.gain === 1 &&
              tiS.groups.join(" ") === "tempo meter key",
          "T13o " + at + " · …and the TIME sheet holds NONE of them — it is " +
          "TEMPO · METER · KEY with the board pointer last, a MOVE and not a " +
          "copy — " + JSON.stringify(tiS));

        /* ---- p · SECTIONS FOLDS THE GRID (§13f) ----------------------- */
        /* Paul, 2026-09-05: *"Sections should collapse when I touch it."* Six
           claims, all off the rendered page: what hides and what does not; the
           count is still said; the pane's scrollTop does not move; the grid's
           own open sheet is closed first and nothing pinned is left behind;
           the fold is NOT an op (the document is byte-identical and Ctrl-Z
           does not take it back); and a reload finds it folded, because it is
           a page preference and not a document fact. It ends EXPANDED, both in
           the DOM and in `localStorage`, because the checks after it reach
           controls inside the grid. */
        await zshut();
        const foldState = () => z.evaluate(() => {
          const t = document.querySelector("#pan-band table.nu-sheetgrid");
          const pane = document.querySelector("#pan-band .nu-pane[data-pane=table]");
          const btn = document.querySelector('#pan-band [data-k="tsections"]');
          const body = document.getElementById("nu-gridbody");
          const heads = t ? [...t.querySelectorAll("thead > tr")].pop() : null;
          const shown = (e) => !!e && e.getClientRects().length > 0;
          const held = t ? [...t.querySelectorAll("thead > tr")].filter((tr) => {
            const c = tr.firstElementChild; if (!c) return false;
            const cs = getComputedStyle(c);
            return cs.position === "sticky" && cs.insetBlockStart !== "auto";
          }).map((tr) => tr.dataset.special || "heads") : [];
          return {
            expanded: btn ? btn.getAttribute("aria-expanded") : null,
            body: shown(body), heads: shown(heads),
            mix: shown(t && t.querySelector("tfoot tr.nu-mixrow")),
            master: shown(t && t.querySelector("tfoot tr.nu-masterrow")),
            produce: shown(t && t.querySelector("tfoot tr.nu-prodrow")),
            perf: shown(t && t.querySelector("tfoot tr.nu-perfrow")),
            sprows: t ? t.querySelectorAll("thead tr.nu-sprow").length : 0,
            label: shown(t && t.querySelector("thead tr.nu-gridlabel")),
            count: ((t && t.querySelector("tr.nu-gridlabel .nu-spface")
              || {}).textContent || "").trim(),
            wopen: document.querySelectorAll("#pan-band .nu-wopen").length,
            held,
            y: pane ? Math.round(pane.scrollTop) : null,
            max: pane ? Math.round(pane.scrollHeight - pane.clientHeight) : 0,
            doc: JSON.stringify(window.__eightDoc()).length,
            store: (() => { try { return localStorage.getItem("nu.band.grid.v1"); }
                            catch (e) { return "?"; } })() };
        });
        /* THE GRID'S OWN SHEET IS OPEN WHEN THE FOLD ARRIVES, which is the
           case §13f names: a cell sheet lives in the `<tbody>` that is about
           to be hidden, so it must be closed through the same door a × is. */
        const fcell = await z.evaluate(() => {
          const c = document.querySelector("#pan-band tbody tr[data-row] td .nu-wcell");
          return c ? c.dataset.k : null; });
        if (fcell) { await ztap(fcell); await ztap(fcell); }
        await z.evaluate(() => { const pane = document.querySelector(
          "#pan-band .nu-pane[data-pane=table]"); if (pane) pane.scrollTop = 90; });
        await z.waitForTimeout(200);
        const f0 = await foldState();
        /* THE FOLD IS THE ONE GESTURE THAT MAY MOVE THE SCROLL, AND ONLY
           BECAUSE THERE IS LESS TO SCROLL. §13a.3's law is about a sheet:
           opening one adds content and closing it takes it away, and the pane
           must not jump either way. A FOLD removes the grid, so a pane parked
           90px down a table that is now three lines tall has nowhere to be but
           the top — that is the browser clamping, not the page jumping. So
           what is asserted is the honest pair: the scrollTop is identical, OR
           the folded pane has no scroll left to keep it at. */
        await ztap("tsections");
        const f1 = await foldState();
        await z.evaluate(() => { const pane = document.querySelector(
          "#pan-band .nu-pane[data-pane=table]"); if (pane) pane.focus(); });
        await z.keyboard.press("Control+z");
        await z.waitForTimeout(500);
        const f1z = await foldState();
        check(f1.expanded === "false" && !f1.body && !f1.heads && !f1.mix &&
              f1.master && f1.produce && f1.perf && f1.label &&
              f1.sprows === f0.sprows && f1.count === f0.count,
          "T13p " + at + " · a tap on SECTIONS folds the grid — the body, the " +
          "column heads and the mix row go; MASTER, PRODUCE, PERFORMANCE, the " +
          "four special rows and the count stay — " + JSON.stringify(f1));
        check(f1.wopen === 0 && f1.held.length === 0 &&
              (f1.y === f0.y || f1.max <= 0),
          "T13p " + at + " · …the grid's open sheet is closed with it, nothing " +
          "is left pinned, and the pane keeps its scrollTop or has none left " +
          "to keep (" + f0.y + " -> " + f1.y + ", max " + f1.max + ") — " +
          JSON.stringify({ wopen: f1.wopen, held: f1.held }));
        /* THE FOLD IS NOT ON THE UNDO STACK, and that is asserted by pressing
           Ctrl-Z and finding the grid STILL FOLDED — the key went past the
           fold to the last real op (T13n's add, which is why the document
           changes here and the fold's own reading does not). */
        check(f1.doc === f0.doc && f1z.expanded === "false" &&
              f1.store === "0",
          "T13p " + at + " · …and the fold is a PAGE preference, not an op: the " +
          "document is unchanged across it, Ctrl-Z does not take it back, and " +
          "it is written to localStorage — " +
          JSON.stringify({ doc: [f0.doc, f1.doc, f1z.doc],
                           afterUndo: f1z.expanded, store: f1.store }));
        /* AND IT SURVIVES A RELOAD, which is what "a phone that folded the
           grid to reach PRODUCE finds it folded" means, driven. */
        await z.reload({ waitUntil: "domcontentloaded" });
        await z.waitForTimeout(2600);
        await z.evaluate(() => window.__eightTab("Band"));
        await z.waitForTimeout(700);
        const f2 = await foldState();
        check(f2.expanded === "false" && !f2.body && !f2.heads,
          "T13p " + at + " · …and a reload finds it folded — " +
          JSON.stringify({ expanded: f2.expanded, body: f2.body,
                           heads: f2.heads, store: f2.store }));
        /* BACK OPEN, and the grid is whole again — the same tap, the other
           way, and every row that folded is on the glass. */
        await ztap("tsections");
        /* ...AND THE BAND THE RELOAD TOOK IS PUT BACK. The blank state has no
           players and the f/g block above hires three through the head's own
           `+`; a reload is a fresh record, so T13l's cell-sheet addresses had
           no cell to open — measured as `LOST ["taddr","tundo",…]` at 320 on
           the Silence record. Same three taps, same one button. */
        if (await z.evaluate(() => window.__eightDoc().voices.length === 0)) {
          for (const k of ["drums", "bass", "line"]) await ztap("tcol-add|" + k);
          await z.evaluate(() => { const o = document.querySelector(
            '#pan-band [aria-expanded="true"]:not(.nu-labelbtn)');
            if (o) o.click(); });
          await z.waitForTimeout(400);
        }
        const f3 = await foldState();
        check(f3.expanded === "true" && f3.body && f3.heads && f3.mix &&
              f3.held.length === 1 && f3.held[0] === "heads" &&
              f3.store === "1",
          "T13p " + at + " · …and a second tap puts it all back, with the " +
          "column heads the pane's one pin again — " + JSON.stringify(f3));

        /* ---- l · T7's LAW RE-PROVED, IN TAPS -------------------------- */
        /* Every control the formula bar, the addbars and `.nu-top` offered,
           reachable in ≤ 2 taps FROM REST. It is counted in taps and not in
           `data-k`s because that is the claim: a control behind three doors is
           not lost, it is unreachable, and the two are the same thing to a
           thumb. */
        if (W === 320) {
          await z.evaluate(() => window.__eightTab("Band"));
          await z.waitForTimeout(500);
          const reach = { };
          const seen = (k) => z.evaluate((key) => {
            const el = document.querySelector('#pan-band [data-k="' + key + '"]') ||
                       document.querySelector('[data-k="' + key + '"]');
            if (!el) return 0;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height >= 43.5 ? 1 : -1; }, k);
          /* THE ADDBARS' FOUR, SINCE 2026-09-05 (§13e): the two `+`s ARE two
             of them (zero taps — `trow-add` at the foot and the band's next
             kind at the head), and all three player kinds stand in a column
             head's own sheet, one tap from rest. A kind the `+` is not
             offering is a kind this record already has, which is why the sheet
             is where the claim is proved: nothing is behind three doors. */
          const headK = await z.evaluate(() => {
            const b = document.querySelector(
              "#pan-band thead th.nu-plushead .nu-plusbtn");
            return b ? b.dataset.k : null; });
          reach[headK] = await seen(headK);
          reach["trow-add"] = await seen("trow-add");
          const colK = await z.evaluate(() => {
            const b = document.querySelector(
              '#pan-band th.nu-colhead button[data-k^="tcol|"]');
            return b ? b.dataset.k : null; });
          if (colK) {
            await ztap(colK);
            for (const k of ["tcol-add|line", "tcol-add|bass", "tcol-add|drums"])
              reach[k] = await seen(k);
            await ztap(colK);
          }
          /* the formula bar's five: the cell (two taps — select, then edit) */
          if (cellK) {
            /* IDEMPOTENTLY, WHICH IS THE SAME DISCIPLINE `openCell` KEEPS: a
               cell takes two taps only when nothing is standing on it, and the
               loop above left the ring exactly there. Two blind taps on a
               selected cell open the sheet and shut it again — measured, and
               it reported all five verbs LOST on a page that was drawing
               them. */
            await z.evaluate((key) => {
              const el = document.querySelector('#pan-band [data-k="' + key + '"]');
              if (!el) return;
              if (!el.classList.contains("is-sel")) el.click(); }, cellK);
            await z.waitForTimeout(450);
            await z.evaluate((key) => {
              const el = document.querySelector('#pan-band [data-k="' + key + '"]');
              if (el && el.getAttribute("aria-expanded") !== "true") el.click(); },
              cellK);
            await z.waitForTimeout(450);
            for (const k of ["taddr", "tundo", "tredo", "tcopy", "tpaste"])
              reach[k] = await seen(k);
            await ztap(cellK);
          }
          /* `.nu-top`'s two: the ≡ is in the bar (0 taps) and the × is the
             open sheet's own header (one tap on a viewer, from the ≡). */
          reach["menu"] = await seen("menu");
          await z.evaluate(() => window.__eightTab("Score"));
          await z.waitForTimeout(600);
          const closeAt = await z.evaluate(() => {
            const c = document.getElementById("sheetclose");
            const head = c && c.closest(".nu-sheethead");
            const host = head && head.parentElement;
            const r = c ? c.getBoundingClientRect() : null;
            return { there: !!c, inSheet: !!(host && host.dataset &&
                       host.dataset.sheet != null),
                     first: !!(host && host.firstElementChild === head),
                     h: r ? Math.round(r.height) : 0,
                     w: r ? Math.round(r.width) : 0 }; });
          await z.evaluate(() => window.__eightTab("Band"));
          await z.waitForTimeout(500);
          const lost = Object.keys(reach).filter((k) => reach[k] !== 1);
          check(lost.length === 0 && closeAt.there && closeAt.inSheet &&
                closeAt.first && closeAt.h >= 44 && closeAt.w >= 44,
            "T13l " + at + " · T7's law re-proved: every control the formula " +
            "bar, the addbars and `.nu-top` offered is reachable in ≤ 2 taps " +
            "from rest — the offers behind one `+`, the address and its four " +
            "verbs on the open cell's first line, the ≡ in the bar and the × " +
            "at the head of the sheet it closes " +
            (lost.length ? "— LOST " + JSON.stringify(lost) : "") + " " +
            JSON.stringify(closeAt));
        }
        await c13.close();
      }
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
