#!/usr/bin/env node
/* test/rules-view.browser.js — THE GENRE EDITOR, DRIVEN
 * (2026-09-02, the composer round, slice 2b).
 *
 * WHY THIS FILE EXISTS. Paul, B6: *"I click the genre, it starts to play, and
 * there's a new view: A genre editor appears. This is the 'Rules' section …
 * The genre data is expressed as logical sentences and rules derived from the
 * data in the genre. They should be readable to a musician. You can edit them,
 * add new rules from a palette, and set thresholds."*
 *
 * `test/rules.test.js` already holds the DATA half — thirty-eight rules over
 * every anchor, every sentence non-empty, every option word walked back to the
 * table that owns it. What no node assertion can reach is the half Paul asked
 * for: that a hand can move a sentence on a rendered page and hear the record
 * change. TEST THE ARTIFACT (three features have shipped broken in this repo
 * while every structural check passed), so every claim below is a query
 * against the DOM the browser actually built, driven through the controls a
 * thumb would touch.
 *
 * THE CHECKS
 *   R1  the panel draws the eight axes of AXES.md, and the name plate says
 *       the genre's name, its place-and-year and one line of lineage.
 *   R2  the tempo rule's slider writes 100 and the record is COMPOSED AGAIN
 *       at the reading in the address — `doc.time.bpm` within the row's own
 *       jitter of 100, and `doc.rules` holds `{f:"bpm", v:100}`.
 *   R3  reset removes the entry and the tempo goes back to the anchor's.
 *   R4  a RENDER-tier rule (`maxHold`) reaches the COMPILED genre with no
 *       recompose at all: `__eightGenres()` moves, and the document object is
 *       the same one it was (a sentinel set from here survives).
 *   R5  the palette adds a rule the row does not declare, the row appears with
 *       its control, and every greyed option in the palette carries a reason.
 *   R6  `GENRES` is byte-unchanged after all of it — `applyRules` copies, so
 *       share links and precompose's purity sweep both still stand.
 *   R7  zero pageerror, zero console error, across all of it.
 *
 * RUN: NODE_PATH=/home/ford/ftrain-2025/node_modules node test/rules-view.browser.js
 *      (stands up its own COOP/COEP server; also honours an injected --page)
 */
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const ROOT = path.join(__dirname, "..");
const PAGE_ARG = arg("--page", null);
/* the executablePath ladder — bare chromium.launch() picks whatever playwright
   last installed and has faked a bug report on this box before */
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

/* THE SUBJECT IS NAMED IN THE ADDRESS, NOT INHERITED FROM THE BOOT. The box
   opens on the blank state now (Paul: *"Add a 'silence' genre at the top of the
   genre list. This is a blank state."*) and draws a NEW SEED unless the URL
   carries one, so a gate that took what it was given would measure a different
   record every run. `reggae` at reading 3 — a row that declares a tempo, a
   mode, a cast and a kit, which is what a rules panel has to have something to
   say about. */
const REGGAE = "#at=Kingston&y=1969&s=3";

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

(async () => {
  console.log("\nrules-view — the genre editor, driven on the rendered page");
  const srv = PAGE_ARG ? null : await standUpServer();
  const PAGE = PAGE_ARG || ("http://127.0.0.1:" + srv.port + "/nukernel/index.html");
  const b = await chromium.launch({ executablePath: EXE });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text()))
    errs.push("console: " + m.text()); });
  await p.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  await p.goto(PAGE + REGGAE, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);

  /* A TAB IS OPENED THE WAY A THUMB OPENS IT — `__eightTab` is the same call
     the stripe's own button makes (ui/eight.js says so at its definition). */
  const top = async (t) => { await p.evaluate((n) => window.__eightTab(n), t);
    await p.waitForTimeout(400); };
  const doc = () => p.evaluate(() => window.__eightDoc());
  /* a slider is DRAGGED, not assigned: `input` moves the readout and `change`
     is the one that commits, which is the two-event discipline every range on
     this page keeps */
  const drag = async (k, v) => { await p.evaluate(([key, val]) => {
      const el = document.querySelector('[data-k="' + key + '"]');
      if (!el) return;
      el.value = String(val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true })); }, [k, v]);
    await p.waitForTimeout(700); };
  const say = async (sel, v) => { await p.evaluate(([s, val]) => {
      const el = document.querySelector('select[data-sel="' + s + '"]');
      if (!el) return; el.value = val;
      el.dispatchEvent(new Event("change", { bubbles: true })); }, [sel, v]);
    await p.waitForTimeout(700); };
  const press = async (k) => { const hit = await p.evaluate((key) => {
      const el = document.querySelector('[data-k="' + key + '"]');
      if (!el || el.disabled) return false; el.click(); return true; }, k);
    await p.waitForTimeout(700); return hit; };

  /* THE CATALOGUE, BEFORE ANYTHING IS TOUCHED. Functions do not cross the
     bridge, which is fine: `applyRules` writes VALUES, so a mutation would show
     up in the JSON. `lab.eight.*` is excluded because those rows are this
     page's own compiled sections — push() rewrites them on every edit by
     design (ui/eight.js:501) and they are not the catalogue. */
  const catalogue = () => p.evaluate(() => {
    const G = window.NuGenres.GENRES, out = {};
    for (const k of Object.keys(G)) { if (k.startsWith("lab.")) continue;
      out[k] = JSON.stringify(G[k]); }
    return JSON.stringify(out); });
  const cat0 = await catalogue();

  await top("Rules");

  /* ================= R1 · THE EIGHT AXES AND THE NAME ==================== */
  const shape = await p.evaluate(() => {
    const q = (s) => [...document.querySelectorAll("#rulesdeck " + s)];
    const plate = document.querySelector("#rulesdeck .nu-namebar");
    return {
      h2: (document.querySelector("#rulesdeck h2") || {}).textContent,
      axes: q("section.nu-rulax").map((s) => s.dataset.axis),
      words: q("h3.nu-axword").map((h) => h.textContent.trim()),
      rows: q(".nu-rule").length,
      plate: plate ? plate.textContent : null,
      kin: (q(".nu-rulekin")[0] || {}).textContent || null,
      palettes: q('select[data-sel^="rule-add|"]').length,
      tiers: q(".nu-rule > .nu-why").length,
    };
  });
  const EIGHT = ["Time", "Alphabet", "Material", "Form",
                 "Development", "Cast", "Sound", "Performance"];
  check(JSON.stringify(shape.axes) === JSON.stringify(EIGHT),
    "R1 the panel is the eight axes of AXES.md, in the evaluation order " +
    JSON.stringify(shape.axes));
  check(JSON.stringify(shape.words) === JSON.stringify(EIGHT),
    "…and each block wears its axis word as a heading " + JSON.stringify(shape.words));
  check(String(shape.h2).trim() === "The rules",
    "…under the panel's own <h2> " + JSON.stringify(shape.h2));
  check(/Reggae/i.test(shape.plate || "") && /Kingston 1969/.test(shape.plate || ""),
    "R1a the name plate says the genre and its place and year " +
    JSON.stringify(shape.plate));
  check(!!shape.kin && /rocksteady|ska/.test(shape.kin) && /dub/.test(shape.kin),
    "R1b …and one line of lineage, up and down " + JSON.stringify(shape.kin));
  check(shape.rows > 10 && shape.palettes >= 6,
    "R1c the record's own rules have rows and the axes have palettes " +
    JSON.stringify({ rows: shape.rows, palettes: shape.palettes }));

  /* ================= R2 · A THRESHOLD, AND A RECOMPOSE =================== */
  /* `bpm` is a COMPOSE-tier rule: the record is written again at the reading in
     the address. compose.js jitters the row's tempo on its own stream, ±4 by
     default and ±`jitter` when the row says one, so the claim is the FENCE and
     not an equality — asserting 100 exactly would be asserting that the jitter
     had been deleted. */
  const bpm0 = (await doc()).time.bpm;
  await drag("rule|bpm", 100);
  const after = await doc();
  check(Math.abs(after.time.bpm - 100) <= 5,
    "R2 the tempo rule recomposes the record at 100 give or take its own " +
    "jitter — " + bpm0 + " -> " + after.time.bpm);
  check(JSON.stringify((after.rules || []).find((r) => r.f === "bpm")) ===
    JSON.stringify({ f: "bpm", v: 100 }),
    "…and the record carries the sentence it was composed with " +
    JSON.stringify(after.rules));
  const sliderNow = await p.evaluate(() =>
    +document.querySelector('#rulesdeck [data-k="rule|bpm"]').value);
  check(sliderNow === 100, "…and the panel came back showing 100, not the " +
    "jittered tempo (the rule is what a hand said) — " + sliderNow);

  /* ================= R3 · RESET ========================================== */
  const hadReset = await p.evaluate(() =>
    !!document.querySelector('#rulesdeck [data-k="rule-reset|bpm"]'));
  check(hadReset, "R3 a rule a hand has written wears a reset");
  await press("rule-reset|bpm");
  const back = await doc();
  check(!(back.rules || []).some((r) => r.f === "bpm") &&
    Math.abs(back.time.bpm - 76) <= 5,
    "…and reset takes it off the record and gives the anchor's tempo back " +
    JSON.stringify({ rules: back.rules || null, bpm: back.time.bpm }));
  const gone = await p.evaluate(() =>
    !!document.querySelector('#rulesdeck [data-k="rule-reset|bpm"]'));
  check(!gone, "…and the reset mark goes with it");

  /* ================= R4 · THE RENDER TIER, WITHOUT A RECOMPOSE ==========
     `maxHold` is one of the fields `document.js toGenre` spreads UNDER the
     document, so it reaches the kernel on the next frame with no new record at
     all. The proof that no record was written is a sentinel put on the document
     object from here: `ctx.setDocument` replaces `DOC` wholesale, so a
     surviving sentinel is the same object. */
  const hold0 = await p.evaluate(() => {
    window.__eightDoc().__ruleProbe = "kept";
    const g = window.__eightGenres();
    const k = Object.keys(g)[0];
    return { maxHold: g[k].maxHold, k }; });
  await drag("rule|maxHold", 2);
  const hold1 = await p.evaluate(() => {
    const g = window.__eightGenres();
    const k = Object.keys(g)[0];
    return { maxHold: g[k].maxHold,
             kept: window.__eightDoc().__ruleProbe === "kept",
             rules: window.__eightDoc().rules }; });
  check(hold1.maxHold === 2 && hold0.maxHold !== 2,
    "R4 a render-tier rule reaches the COMPILED genre " +
    JSON.stringify({ was: hold0.maxHold, now: hold1.maxHold }));
  check(hold1.kept, "…without writing a new record — the document is the same " +
    "object it was (no recompose on the render tier)");
  check(JSON.stringify((hold1.rules || []).find((r) => r.f === "maxHold")) ===
    JSON.stringify({ f: "maxHold", v: 2 }),
    "…and the sentence is on the record " + JSON.stringify(hold1.rules));
  await press("rule-reset|maxHold");

  /* ================= R5 · THE PALETTE ==================================== */
  /* `reggae` states no `swing` — its eighths are straight — so the Time
     palette is the way in, which is the whole of what a palette is for. */
  const pal = await p.evaluate(() => {
    const s = document.querySelector('select[data-sel="rule-add|Time"]');
    if (!s) return null;
    /* THE GREY IS COLLECTED OFF EVERY PALETTE, not off this one. A vacuous
       pass is the failure mode this check has — `reggae` greys nothing in
       Time, so asking Time alone would assert nothing at all — so the sweep is
       page-wide and it also asserts that SOMETHING is refused, which on this
       record it is: `artic` is capped by a `maxHold` the row states, and the
       changes are the Key panel's. */
    const grey = [];
    for (const q of document.querySelectorAll('select[data-sel^="rule-add|"]'))
      for (const o of q.options)
        if (o.disabled) grey.push({ sel: q.dataset.sel, v: o.value,
                                    why: o.dataset.why || "",
                                    said: o.textContent.endsWith(o.dataset.why || "\u0000") });
    return { first: s.options[0] && s.options[0].textContent,
             has: [...s.options].map((o) => o.value), grey };
  });
  check(!!pal && /add a rule/.test(pal.first || ""),
    "R5 each axis ends in a palette whose first word is the offer " +
    JSON.stringify(pal && pal.first));
  check(!!pal && pal.has.indexOf("swing") >= 0,
    "…listing a rule this row does not declare " + JSON.stringify(pal && pal.has));
  check(!!pal && pal.grey.length > 0 && pal.grey.every((o) => o.why.trim() && o.said),
    "R5a NO SILENT GREY — all " + (pal ? pal.grey.length : 0) + " greyed offers " +
    "carry a measured reason and SAY it " + JSON.stringify(pal && pal.grey.slice(0, 2)));
  await say("rule-add|Time", "swing");
  const added = await p.evaluate(() => ({
    rules: window.__eightDoc().rules,
    swing: window.__eightDoc().time.swing,
    control: !!document.querySelector('#rulesdeck [data-k="rule|swing"]'),
    still: [...(document.querySelector('select[data-sel="rule-add|Time"]') || { options: [] })
      .options].map((o) => o.value),
  }));
  check((added.rules || []).some((r) => r.f === "swing"),
    "…and choosing one writes it onto the record " + JSON.stringify(added.rules));
  check(added.control, "…the rule now has a row with a control on it");
  check(added.still.indexOf("swing") < 0,
    "…and the palette stops offering what the record now says " +
    JSON.stringify(added.still));

  /* ================= R6 · GENRES IS UNTOUCHED ============================ */
  const cat1 = await catalogue();
  check(cat0 === cat1, "R6 GENRES is byte-unchanged after every edit — " +
    "applyRules copies the row and a share link stays good");

  /* ================= R7 · NOTHING THREW ================================== */
  check(!errs.length, "R7 zero page and console errors " +
    JSON.stringify(errs.slice(0, 3)));

  await b.close();
  if (srv) srv.proc.kill();
  console.log("\nrules-view: " + notes.length + " ok, " + fails.length + " failed");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error("rules-view: " + (e && e.stack || e)); process.exit(1); });
