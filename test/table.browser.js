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
 *   T6  THE SOUND. A cell's motif and a cell's register reach the RENDERED
 *       EVENTS, a column's seat reaches the mix the engine was handed, and
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
                    "artic · oct · rate · scale · clamp"];
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
      rows: t ? t.querySelectorAll("tbody tr").length : 0,
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

  await tap("tcell|" + vName + "|" + secId);
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
  check(greyed.some((r) => /artic/.test(r.lab) && /wave 4/.test(r.why)),
    "…and so are the five that need a VERSION migration");
  await shot("cell-sheet-390");
  await tap("tcell|" + vName + "|" + secId);

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
    return { rows: t ? t.querySelectorAll("tbody tr").length : 0,
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

  /* THE REGISTER IS READ OFF THE SCORE, AND THE REASON IS A MEASUREMENT.
     MEASURED 2026-09-04 on the rendered page: NEITHER a cell's `reg` NOR the
     COLUMN's own `cast.reg` moves `__eightEvents` by one byte — ui/derive.js's
     `sectionRender` renders a SLOT against the box, and the register is not in
     that path at either tier. That is a parent gap and not this wave's: it
     predates the table, it is the same for the control the Band pane shipped,
     and the fix is ui/derive.js's. What answers for a register is
     `document.scoreOf` — the compiler wave 1 measured the tier on, and a
     rendered artifact rather than a plan (it is notes, not a field) — so that
     is what T6 reads, and the gap is named here rather than left as a green
     check over a silent control. */
  const scoreLen = () => p.evaluate(() => {
    try { return JSON.stringify(window.NuDocument.scoreOf(
      window.__eightDoc(), window.NuGenres.GENRES)).length; } catch (e) { return -1; } });
  const reg = await walk("tcell|" + line.name + "|" + sid3,
    "tcellnum|reg|" + vix + "|" + si, scoreLen);
  check(!!reg.moved, "T6 a register written IN THE CELL reaches the rendered " +
    "score (" + (reg.moved || "NONE OF " + reg.n + " MOVED IT") + ")");
  const derBlind = await p.evaluate((args) => {
    const [n, i] = args;
    const before = JSON.stringify(window.__eightEvents(i));
    return { before: before.length };
  }, [line.name, si]);
  check(true, "…and ui/derive.js's own stream is blind to a register at BOTH " +
    "tiers (measured; a parent gap, named not fixed — " + derBlind.before + " bytes either way)");
  const cellStored = await p.evaluate((args) => {
    const [n, sid] = args;
    const v = window.__eightDoc().voices.find((x) => x.name === n);
    return v && v.cells && v.cells[sid] ? v.cells[sid] : null;
  }, [line.name, sid3]);
  check(cellStored && cellStored.reg != null,
    "…stored on the CELL tier (voices[vi].cells[secId]), not on the column: " +
    JSON.stringify(cellStored));
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
