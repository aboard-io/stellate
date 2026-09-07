#!/usr/bin/env node
// test/_system2-measure.cjs — THE ROUND'S OWN TAPE MEASURE (design system, step 2/4).
//
// NOT A GATE. It asserts nothing and passes nothing; it drives the real app
// under iPhone emulation and prints numbers, so the same numbers can be taken
// BEFORE a surface is ported and AFTER it, on the same records, at the same
// widths, by the same code. A before/after where the two halves were measured
// by two different scripts is not a before/after.
//
// docs/DESIGN-SYSTEM.md's round asks for five of them:
//   P  the PLATE — where it sits, and where every word in it starts (the
//      spread between the leftmost and rightmost word is the whole of "icons
//      should all have same width not float left it looks uneven")
//   B  the BURGER — which end of the top strip it is on, and where the
//      record's name sits beside it
//   L  the LOZENGE FIELD — how many options are READABLE AT ONCE on the two
//      biggest vocabularies (the 147-instrument picker and the 68-word kit
//      list). "Readable at once" is measured, not asserted: an option whose
//      box is inside the viewport, has a non-zero rect, and is not clipped by
//      a fold or by its own track.
//   R  the RECORD — how much of it is on the glass: the band table's cells
//      with a box inside the viewport, and the fraction of the pane a thumb
//      can see without scrolling.
//   S  the page's own inline axis, because every one of the above is worthless
//      if the port bought it by letting the page scroll sideways.
//
// Run:  NODE_PATH=/home/ford/aboard-daily/node_modules \
//       node test/_system2-measure.cjs before   (or: after, or any tag)
// Writes scratchpad/design/system-2/measure-<tag>.json and prints a table.

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { chromium, devices } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const TAG = process.argv[2] || "now";
const OUT = path.join(ROOT, "scratchpad", "design", "system-2");
const EXE = (() => {
  const home = process.env.HOME || "";
  for (const c of ["chromium-1234/chrome-linux64/chrome",
                   "chromium-1217/chrome-linux64/chrome"]) {
    const p = path.join(home, ".cache/ms-playwright", c);
    if (fs.existsSync(p)) return p;
  }
  return path.join(home, ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
})();

/* THE TWO RECORDS THIS REPO ALWAYS MEASURES ON, and they are a pair on
   purpose: Kingston 1969 has several lines, a bass and a kit; Bristol 1994
   (noirhop — the Coach House tape) is the one whose walkthrough produced most
   of the friction this design round is answering. */
const RECORDS = [["Kingston 1969", "#at=Kingston&y=1969&s=1"],
                 ["Coach House",   "#at=Bristol&y=1994&s=1"]];

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
    const to = setTimeout(() => rej(new Error("no port")), 10000);
    proc.stdout.on("data", (d) => { buf += d; const m = buf.match(/(\d+)/);
      if (m) { clearTimeout(to); res({ proc, port: +m[1] }); } });
    proc.on("error", (e) => { clearTimeout(to); rej(e); });
  });
}

/* ---- P AND B · THE PLATE AND THE STRIP --------------------------------
   READ OFF THE GLASS AND NOT OFF THE DOM. Which END of the strip a control is
   on is a fact about rendered x, not about `children` order — a CSS `order`
   moves the first without moving the second, and the ask ("hamburger should be
   on left") is about what a thumb reaches. Every word's start edge is the
   `inline-start` of its own text box, so the SPREAD is what "the words start
   on one vertical line" means as a number: 0 is the ask, and anything else is
   how far off it is. */
const PLATE = () => {
  const vw = innerWidth;
  const strip = document.getElementById("nu-topstrip");
  const burger = document.getElementById("burger");
  const name = document.querySelector('#nu-topstrip [data-k="toptab-Where"]');
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect();
    return { x: +r.left.toFixed(1), y: +r.top.toFixed(1),
             w: +r.width.toFixed(1), h: +r.height.toFixed(1),
             right: +r.right.toFixed(1) }; };
  const endOf = (e) => { const r = box(e); if (!r) return null;
    /* which half its CENTRE is in — the honest reading of "which end" */
    return (r.x + r.w / 2) < vw / 2 ? "start" : "end"; };
  const menu = document.getElementById("nu-menu");
  const rows = menu ? [...menu.querySelectorAll("button")] : [];
  const words = [], marks = [];
  for (const b of rows) {
    const w = b.querySelector(".nu-vh");
    const g = b.querySelector(".nu-g");
    const wr = w && w.getBoundingClientRect();
    const gr = g && g.getBoundingClientRect();
    if (wr && wr.width > 0) words.push({
      k: b.dataset.k || "", x: +wr.left.toFixed(1),
      word: (w.textContent || "").trim() });
    if (gr && gr.width > 0) marks.push({
      k: b.dataset.k || "", x: +gr.left.toFixed(1),
      w: +gr.width.toFixed(1), g: (g.textContent || "").trim() });
  }
  const xs = words.map((w) => w.x);
  const mw = marks.map((m) => m.w);
  return {
    vw,
    strip: box(strip),
    burger: { ...box(burger), end: endOf(burger),
              label: burger ? burger.getAttribute("aria-label") : null },
    name: { ...box(name), end: endOf(name) },
    stripKids: strip ? [...strip.children].map((c) =>
      c.id || c.dataset.k || c.className) : [],
    /* the strip's children in RENDERED order, which is the order a thumb
       meets them and is not always the DOM's */
    stripByX: strip ? [...strip.children]
      .map((c) => ({ id: c.id || c.dataset.k || c.className,
                     x: +c.getBoundingClientRect().left.toFixed(1) }))
      .sort((a, b2) => a.x - b2.x).map((c) => c.id) : [],
    plate: box(menu),
    plateEnd: endOf(menu),
    plateOpen: !!(menu && !menu.hidden),
    rows: rows.length,
    wordStarts: words,
    wordSpread: xs.length ? +(Math.max(...xs) - Math.min(...xs)).toFixed(1) : null,
    wordStartsDistinct: [...new Set(xs.map((x) => x.toFixed(1)))].length,
    markWidths: marks,
    markSpread: mw.length ? +(Math.max(...mw) - Math.min(...mw)).toFixed(1) : null,
  };
};

/* ---- L · HOW MANY OPTIONS ARE READABLE AT ONCE -------------------------
   THE NUMBER THE ROUND IS BUYING. An option counts as READABLE when it has a
   real box, that box is inside the viewport on both axes, and its word is not
   clipped to nothing by its own column. Drawn-but-off-track options are
   counted separately, because "on the track, one push away" and "behind a
   fold, three taps away" are different facts and the lozenge-to-cell change is
   about which of the two the vocabulary is in. */
const FIELD = (k) => {
  const btn = document.querySelector(
    '#pan-band .nu-sheetrow [data-k="' + k + '"]');
  const row = btn && btn.closest(".nu-sheetrow");
  const f = row && row.nextElementSibling;
  if (!f || !/nu-lzfield|nu-wchips|nu-wgroups|nu-eltable/.test(f.className))
    return { found: false };
  const vw = innerWidth, vh = innerHeight;
  const opts = [...f.querySelectorAll("button.nu-lz, .nu-wchip, nu-cell")];
  const inView = (r) => r.width > 0 && r.height > 0 &&
    r.right > 0 && r.left < vw && r.bottom > 0 && r.top < vh;
  const drawn = opts.filter((o) => {
    const r = o.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  const readable = opts.filter((o) => inView(o.getBoundingClientRect()));
  const track = f.querySelector(".nu-lztrack, nu-table, .nu-eltrack");
  const tr = track && track.getBoundingClientRect();
  const r = f.getBoundingClientRect();
  return {
    found: true, k,
    kind: f.classList.contains("nu-lzfield") ? "lozenge"
        : f.tagName.toLowerCase() === "nu-table" ? "table" : "chips",
    total: opts.length,
    drawn: drawn.length,
    readable: readable.length,
    h: Math.round(r.height),
    fieldFitsPhone: r.height <= vh,
    columns: f.querySelectorAll("section.nu-lzcluster, nu-colhead").length,
    track: !!track,
    trackW: tr ? Math.round(track.scrollWidth) : null,
    trackC: tr ? Math.round(track.clientWidth) : null,
    folded: f.querySelectorAll(".nu-lzcluster.is-folded").length,
    /* the pill's radius, which is the thing item 2 is deleting */
    radius: opts[0] ? getComputedStyle(opts[0]).borderTopLeftRadius : null,
    pageSideways: Math.round(document.documentElement.scrollWidth -
                             document.documentElement.clientWidth),
  };
};

/* ---- R · HOW MUCH OF THE RECORD IS ON THE GLASS ------------------------
   Counted as CELLS a thumb can see without scrolling anything, plus what
   fraction of the whole table that is. A port that squeezes the chrome buys
   exactly this and nothing else, so this is the number that says whether it
   was worth it. */
const RECORD = () => {
  const vh = innerHeight, vw = innerWidth;
  const cells = [...document.querySelectorAll("#pan-band td, #pan-band th")];
  const seen = cells.filter((c) => {
    const r = c.getBoundingClientRect();
    return r.width > 0 && r.height > 0 &&
           r.top < vh && r.bottom > 0 && r.left < vw && r.right > 0; });
  const rows = [...document.querySelectorAll("#pan-band tr")];
  const rowsSeen = rows.filter((c) => {
    const r = c.getBoundingClientRect();
    return r.height > 0 && r.top < vh && r.bottom > 0; });
  const pane = document.querySelector(".nu-pane");
  const pr = pane && pane.getBoundingClientRect();
  return {
    cells: cells.length, cellsOnGlass: seen.length,
    rows: rows.length, rowsOnGlass: rowsSeen.length,
    paneH: pr ? Math.round(pr.height) : null,
    paneTop: pr ? Math.round(pr.top) : null,
    /* the two fixed bands, which are what the record is competing with */
    topH: Math.round((document.getElementById("nu-topstrip") || {})
      .getBoundingClientRect ? document.getElementById("nu-topstrip")
      .getBoundingClientRect().height : 0),
    barH: (() => { const b = document.getElementById("nu-bar");
      return b ? Math.round(b.getBoundingClientRect().height) : 0; })(),
    sideways: Math.round(document.documentElement.scrollWidth -
                         document.documentElement.clientWidth),
  };
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await standUpServer();
  const b = await chromium.launch({ executablePath: EXE });
  const all = { tag: TAG, when: new Date().toISOString(), widths: {} };

  for (const W of [390, 320, 1280]) {
    const dev = W === 1280 ? {} : { ...devices["iPhone 14"] };
    dev.viewport = { width: W, height: W === 1280 ? 900 : 844 };
    all.widths[W] = {};
    for (const [name, hash] of RECORDS) {
      const ctx = await b.newContext(dev);
      const p = await ctx.newPage();
      const errs = [];
      p.on("pageerror", (e) => errs.push(String(e.message).slice(0, 120)));
      await p.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
      await p.goto("http://127.0.0.1:" + srv.port + "/nukernel/index.html" + hash,
        { waitUntil: "networkidle" });
      await p.waitForTimeout(2200);

      const rec = { errs };
      rec.record = await p.evaluate(RECORD);
      /* the plate SHUT, then OPEN — where the ≡ sits does not depend on the
         plate, but every word in the plate does. */
      rec.stripShut = await p.evaluate(PLATE);
      await p.evaluate(() => { const b2 = document.getElementById("burger");
        if (b2) b2.click(); });
      await p.waitForTimeout(400);
      rec.plateOpen = await p.evaluate(PLATE);
      await p.evaluate(() => { const b2 = document.getElementById("burger");
        if (b2) b2.click(); });
      await p.waitForTimeout(300);

      /* THE TWO BIGGEST VOCABULARIES, opened the way a thumb opens them:
         the chair's column sheet, then the field inside it. */
      rec.fields = {};
      const lineV = await p.evaluate(() => {
        try { const d = window.__eightDoc();
          const v = d.voices.find((x) => x.kind === "line");
          return v ? v.name : null; } catch (e) { return null; } });
      const drumV = await p.evaluate(() => {
        try { const d = window.__eightDoc();
          const v = d.voices.find((x) => x.kind === "drums");
          return v ? v.name : null; } catch (e) { return null; } });
      const sect = await p.evaluate(() => {
        try { const d = window.__eightDoc();
          return d.form.sections[0] ? d.form.sections[0].id : null;
        } catch (e) { return null; } });
      const openCol = async (v) => {
        await p.evaluate((k) => { const el = document.querySelector(
          '#pan-band [data-k="tcol|' + k + '"]');
          if (el && el.getAttribute("aria-expanded") !== "true") el.click(); }, v);
        await p.waitForTimeout(600); };
      const openF = async (k) => {
        await p.evaluate((kk) => { const el = document.querySelector(
          '#pan-band .nu-sheetrow [data-k="' + kk + '"]');
          if (el && el.getAttribute("aria-expanded") !== "true") el.click(); }, k);
        await p.waitForTimeout(700); };
      if (lineV) {
        await openCol(lineV);
        const ik = "sound.instrument|" + lineV;
        await openF(ik);
        rec.fields.instrument = await p.evaluate(FIELD, ik);
      }
      if (drumV && sect) {
        const kk = "dev.kit|" + drumV + "|" + sect;
        await openCol(drumV);
        await openF(kk);
        rec.fields.kit = await p.evaluate(FIELD, kk);
        if (!rec.fields.kit.found) {
          /* the kit field may hang off the drummer's CELL rather than its
             column, depending on where the round left it — try the cell. */
          await p.evaluate((v) => { const el = document.querySelector(
            '#pan-band [data-k^="tcell|' + v + '"]'); if (el) el.click(); }, drumV);
          await p.waitForTimeout(600);
          await openF(kk);
          rec.fields.kit = await p.evaluate(FIELD, kk);
        }
      }
      all.widths[W][name] = rec;
      await ctx.close();
    }
  }

  await b.close();
  try { process.kill(srv.proc.pid); } catch (e) { /* gone */ }

  const f = path.join(OUT, "measure-" + TAG + ".json");
  fs.writeFileSync(f, JSON.stringify(all, null, 1));

  console.log("\n=== " + TAG + " ===");
  for (const W of Object.keys(all.widths))
    for (const r of Object.keys(all.widths[W])) {
      const d = all.widths[W][r];
      const s = d.stripShut, o = d.plateOpen;
      console.log("\n" + W + " · " + r);
      console.log("  burger        " + (s.burger.end || "?") + "  x=" +
        s.burger.x + "  (strip by x: " + s.stripByX.join(" ") + ")");
      console.log("  name          " + (s.name.end || "?") + "  x=" + s.name.x);
      console.log("  plate         " + (o.plateEnd || "?") + "  x=" +
        (o.plate ? o.plate.x : "?") + "  w=" + (o.plate ? o.plate.w : "?") +
        "  rows=" + o.rows);
      console.log("  word starts   spread " + o.wordSpread + "px over " +
        o.wordStarts.length + " words, " + o.wordStartsDistinct + " distinct x");
      console.log("  mark widths   spread " + o.markSpread + "px");
      for (const k of Object.keys(d.fields || {})) {
        const x = d.fields[k];
        console.log("  " + k.padEnd(13) + (x.found
          ? x.kind + "  " + x.readable + " readable of " + x.total +
            " (" + x.drawn + " drawn), " + x.columns + " cols, " + x.h +
            "px tall, r=" + x.radius + ", folded=" + x.folded
          : "NOT FOUND"));
      }
      console.log("  record        " + d.record.cellsOnGlass + " of " +
        d.record.cells + " cells on the glass, " + d.record.rowsOnGlass +
        " of " + d.record.rows + " rows; sideways " + d.record.sideways);
      if (d.errs.length) console.log("  ERRORS        " + d.errs.join(" · "));
    }
  console.log("\nwritten " + f);
})().catch((e) => { console.error(e); process.exit(1); });
