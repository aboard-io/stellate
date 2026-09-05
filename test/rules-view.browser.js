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
 *   R4  a RENDER-tier rule (`phrase`) reaches the COMPILED genre with no
 *       recompose at all: `__eightGenres()` moves, and the document object is
 *       the same one it was (a sentinel set from here survives).
 *       (It read `maxHold` until 2026-09-02. The tier audit of that day
 *       measured `maxHold` as a COMPOSE rule — `precompose.js capOf` writes
 *       the cap into every cell's `play` row, 182 steps of the document on
 *       reggae — so this check now drives `phrase`, which nothing in
 *       precompose reads and `toGenre` spreads straight to kernel.js's arch.)
 *   R8  THE TIER IS NOT PRINTED AT ALL. The line above stood until 2026-09-02
 *       and it read: "R8 the tier sentence is said ONCE PER AXIS, not once per
 *       row. The probe of 2026-09-02: '\"the record is written again at this
 *       seed\" printed under EVERY compose-tier row in Rules (~12x)'." That
 *       move was right and did not go far enough. Paul, wave 4 §4, after
 *       using the deployed page: *"The genre editor is great. It can be a lot
 *       tighter though — it has text all over the place. Look at it from the
 *       point of view of a user just seeing it for the first time."* So the
 *       tier rides `data-tier` (data) and `data-say` (the hold explainer
 *       ui/glyph.js runs for the whole page), and this check counts the
 *       printed ones and requires ZERO.
 *   R9  ONE SENTENCE PER ROW, AND THE CONTROL IS IN IT. Every rule row is one
 *       `<label class="nu-said">`, no row is under the 44px tap floor, and a
 *       single-answer row (number / enum / flag) is at most a sentence line
 *       plus THE LINES ITS CONTROL OCCUPIES (2026-09-07: a chip strip wraps,
 *       so the ceiling counts the strip's rendered lines at 44px each instead
 *       of assuming one). Measured before wave 4 §4 on the same record:
 *       heights of 33 · 46 · 76 · 103 · 228 · 322 · 478.
 *   R9b …AND THE ROW IS TWO LINES (2026-09-03). Paul: *"Arrange things so the
 *       slider and function descriptions are on a line with the slider after
 *       that line, not bunched together."* The control line is BELOW the
 *       sentence line on the glass (never beside it) and a single answer has
 *       the whole width of it.
 *   R10 THE INSTRUMENT MENU IS NATIVE FIRST, on the rendered page. Paul, wave
 *       4 §10: *"When you define a genre you seem to only allow the sample
 *       instrument not the faust instrument like on high nrg… that's the
 *       opposite those should be chosen after native"*.
 *   R11 A CHANGE EVOLVES THE RECORD, DRIVEN WHILE IT PLAYS (2026-09-03).
 *       Paul: *"When I change things in the 'Rules' section, evolve the song,
 *       don't just restart it."* The transport keeps running, the seed stays,
 *       the walk's bar serial stays monotone, the engine keeps sounding, and
 *       the document differs only where the rule reaches.
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
const { installCombo } = require("./lib-combo.js");
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
  await installCombo(p);

  /* A TAB IS OPENED THE WAY A THUMB OPENS IT — `__eightTab` is the same call
     the stripe's own button makes (ui/eight.js says so at its definition). */
  /* ...AND `Time` AND `Rules` ARE NOT TABS ANY MORE (2026-09-06,
     nukernel/TABLE.md §10b): each is a MERGED ROW at the top of the Band
     table's own sheet, so the door is `__eightRow`, which opens Band and
     presses the row's head — a hand's two taps, and idempotent, so a second
     arrival does not close what the first opened. Every `#pan-tempo` /
     `#pan-band` selector below is the same selector inside `#pan-band`. */
  const top = async (t) => {
    if (t === "Time" || t === "Rules") {
      await p.evaluate((x) => window.__eightRow(x), t.toLowerCase());
      await p.waitForTimeout(900); return; }
    await p.evaluate((n) => window.__eightTab(n), t);
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
  /* A MENU IS ANSWERED BY ITS ADDRESS AND NOT BY ITS TAG. `data-sel` is the
     address ui/selects.js stamps and focus-restore reads, and it survives the
     widget: if the `<select>` becomes an `<input role="combobox">` with a
     listbox under it (the 2026-09-02 combo round), the same address still
     names the control. So the query is tag-free and the write takes whichever
     shape it finds — a native select takes `value` + `change`, a combobox
     takes the input and then the option the list offers. */
  const say = async (sel, v) => {
    const hit = await p.evaluate(([s, val]) => {
      const el = document.querySelector('[data-sel="' + s + '"]');
      return el ? window.__combo.say(el, val) : false; }, [sel, v]);
    await p.waitForTimeout(700); return hit; };
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
    const q = (s) => [...document.querySelectorAll("#pan-band " + s)];
    const plate = document.querySelector("#pan-band .nu-namebar");
    return {
      /* THE PANEL'S OWN <h2> IS "The band" SINCE 2026-09-06 (TABLE.md §10b
         step 2): the editor is the table's RULES ROW, so the heading it draws
         is the SHEET's and not the panel's. `ui/rules.js` still opens with
         `ctx.section(host, "ax-rules", "The rules")`, and that is the one this
         check has always been about — the panel it happens to be inside is the
         Band table's now. */
      h2: (document.querySelector("#pan-band #ax-rules > h2") ||
           document.querySelector("#pan-band h2") || {}).textContent,
      axes: q("section.nu-rulax").map((s) => s.dataset.axis),
      words: q("h3.nu-axword").map((h) => h.textContent.trim()),
      rows: q(".nu-rule").length,
      plate: plate ? plate.textContent : null,
      kin: (q(".nu-rulekin")[0] || {}).textContent || null,
      palettes: q('[data-sel^="rule-add|"]').length,
      tiers: q(".nu-rule > .nu-why").length,
      /* R8: how many tier sentences the panel PRINTS — the axis-foot ones and
         the per-row departures both — against how many rows carry the tier as
         data and as the hold explainer. The answer the law wants is zero, all,
         all. */
      axtiers: q(".nu-axtier").length,
      rowtiers: q(".nu-rule[data-tier]").length,
      rowsaid: q(".nu-rule > small.nu-why").length,
      rowsay: q(".nu-rule[data-say]").length,
      /* R9: the row's own shape on the glass. `said` is the one sentence
         label; `stacked` is any row that grew a second block-level thing
         beside it (a heading over a group of controls, a tier line, a second
         paragraph) — the "text all over the place" this round took out. */
      geom: q(".nu-rule").map((d) => ({
        f: d.dataset.rule, shape: d.dataset.shape || "said",
        h: Math.round(d.getBoundingClientRect().height),
        said: d.querySelectorAll(":scope > label.nu-said").length,
        stacked: d.querySelectorAll(":scope > h4, :scope > p:not(.nu-why), " +
          ":scope > small").length,
        /* HOW MANY LINES THE CONTROL ITSELF OCCUPIES, off the glass. A chip
           strip wraps — `.nu-wchips` is `flex-wrap: wrap` — so three long
           words at 390 are three tap rows and the row is honestly that tall.
           Counted as DISTINCT ROUNDED TOPS of the chips, which is what a line
           is; every other widget answers 1 because it has no chips. */
        lines: (() => {
          const c = [...d.querySelectorAll(".nu-wchip")];
          if (!c.length) return 1;
          return new Set(c.map((x) =>
            Math.round(x.getBoundingClientRect().top))).size;
        })(),
        /* ...AND WHETHER ANY OF THEM IS PRINTING A REASON, which is a second
           line INSIDE one chip (`.nu-wchip > .nu-why`) and so a second row of
           height the strip's own line count cannot see. */
        whys: d.querySelectorAll(".nu-wchip > .nu-why").length,
      })),
      motifs: q(".nu-rule[data-rule='motifs']").map((d) =>
        ({ text: d.textContent.trim(), say: (d.dataset.say || "").length })),
      /* R10: the instrument menu's own group order, read off the rendered
         control. Group headings in document order — ui/selects.js never
         reorders, so this is the order `nukernel/rules.js` handed it.
         2026-09-02: an `<optgroup>` is an `<li class="nu-combogrp" data-grp>`
         since the combo round, and `m.options` is undefined on an `<input
         role=combobox>` — which threw here and killed the run before R1 was
         asked. Both spellings are read; the CLAIM ("native, then sampled") did
         not move. */
      instr: (() => {
        const m = document.querySelector('#pan-band [data-sel="rule.instr.0"]');
        if (!m) return null;
        const box = m.closest(".nu-combo") || m.parentElement;
        const groups = m.options
          ? [...m.querySelectorAll("optgroup")].map((g) => g.label)
          : [...box.querySelectorAll("li.nu-combogrp")].map((g) => g.dataset.grp);
        const words = window.__combo.words(m);
        return { groups, first: words[0] && words[0].v, n: words.length };
      })(),
    };
  });
  const EIGHT = ["Time", "Alphabet", "Material", "Form",
                 "Development", "Cast", "Sound", "Performance"];
  check(JSON.stringify(shape.axes) === JSON.stringify(EIGHT),
    "R1 the panel is the eight axes of AXES.md, in the evaluation order " +
    JSON.stringify(shape.axes));
  /* THE HEADING IS THE CATALOGUE'S WORD FOR THE AXIS, and the axis itself is
     the ADDRESS (`section[data-axis]`, which R1 above still reads as AXES.md's
     own eight). They were the same string until the functional text pass
     (2026-09-05): the review's glossary renames what a reader sees — alphabet
     → SCALE — while `rules.js AXES` keeps the word the rows claim. */
  const HEADS = ["Time", "Scale", "Material", "Form",
                 "Development", "Cast", "Sound", "Performance"];
  check(JSON.stringify(shape.words) === JSON.stringify(HEADS),
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

  /* ================= R8 · THE TIER IS NOT PRINTED ========================
     THE PARAGRAPH THIS REPLACES STOOD FOR HALF A DAY and it read: "Every row
     still DECLARES its tier — `data-tier` … — and the sentence is printed once
     at the foot of its axis block, plus once on any row that departs from that
     block's common tier. So the count of spoken tiers is at most the eight
     blocks plus the handful of departures, and nowhere near the one-per-row
     the probe measured." Every clause of that is still true of the DATA. What
     changed is the printing, on Paul's own sentence (wave 4 §4): *"It can be a
     lot tighter though — it has text all over the place."* Eight tier
     sentences under eight blocks is eight sentences a first-time reader did
     not ask for, so the panel prints none and carries all of them on
     `data-say`, which ui/glyph.js opens on a hover or a hold. */
  check(shape.axtiers === 0 && shape.rowsaid === 0,
    "R8 the panel prints no tier sentence at all — " + shape.axtiers +
    " axis feet, " + shape.rowsaid + " row lines (was 8 + departures this " +
    "morning, ~12 one-per-row before that)");
  check(shape.rowtiers >= shape.rows - 1,
    "…while every rule row still declares its tier as data — " +
    shape.rowtiers + " of " + shape.rows + " rows carry data-tier");
  check(shape.rowsay === shape.rows,
    "…and every row carries the explainer a hold opens — " + shape.rowsay +
    " of " + shape.rows + " carry data-say");
  const sayText = await p.evaluate(() =>
    window.__nuSay('#pan-band .nu-rule[data-rule="bpm"]'));
  await p.evaluate(() => window.__nuSayOff && window.__nuSayOff());
  check(/written again at this seed/.test(String(sayText)),
    "…and holding the tempo row opens the tier it used to print " +
    JSON.stringify(sayText));

  /* ================= R9 · ONE SENTENCE PER ROW ==========================
     Paul: *"Look at it from the point of view of a user just seeing it for the
     first time."* A row is ONE `<label class="nu-said">` with the control
     standing in the sentence, and nothing else is stacked beside it — no `<h4>`
     over a group of controls, no tier line, no second paragraph. */
  const geom = shape.geom || [];
  const noLabel = geom.filter((g) => g.shape !== "said" && g.said !== 1);
  const stacked = geom.filter((g) => g.stacked > 0);
  const under = geom.filter((g) => g.h < 44);
  /* THE 88px CEILING IS ASKED OF THE SINGLE-ANSWER ROWS ONLY, and the reason
     is arithmetic rather than indulgence: a positional `list` is one menu PER
     CHAIR and a numeric `map` is one slider PER DECORATION, so `instr` on a
     three-chair record is three controls and cannot be two tap rows at 390 by
     any drawing that does not hide one of them. The multi-answer rows are
     printed every run instead, which is what makes a regression visible. */
  /* THE CEILING IS 96px AND NOT 88px SINCE 2026-09-03, and the number moved
     because Paul moved the row. *"Arrange things so the slider and function
     descriptions are on a line with the slider after that line, not bunched
     together."* A row is a sentence line plus a control line now, by his
     instruction, so "two tap rows" is no longer the arithmetic: MEASURED on
     the rendered panel at 390 after the change, every single-answer row is
     74px (an 18px sentence, a 44px control, the row's own padding) and the
     one row whose sentence wraps to two lines — `stress`, "the band leans on
     the beat 0.42 — a little" — is 93. 96 is that, and it still catches the
     regression the 88 was written for: a row that grows a THIRD block. */
  /* AND THE CEILING IS THE ROW'S OWN ARITHMETIC SINCE 2026-09-07, because a
     WRAPPING CONTROL IS THE ROW'S HEIGHT AND NOT A REGRESSION. The 96 was
     measured on a page whose every single-answer control was one line — a
     `<select>`, a slider, a two-word flag. `src/menus/pick.ts` hands every
     vocabulary of eight words or fewer a CHIP STRIP now (v272), and a strip of
     three long words at 390 is three tap rows, not one: MEASURED on this
     record, `rate` 129px and `plan` 129px are two lines of chips, `harmony`
     176px is three. Holding those to 96 is asking a chip strip to be a
     `<select>`, which is the widget Paul took off the phone.
     So the ceiling counts the lines the control actually occupies and the row
     is allowed 44px — one tap target — for each of them, plus the 52 that is
     the sentence line and the row's own padding (74px measured for the
     one-line rows, which is 52 + one 44px control minus the 22px the sentence
     and the control share by sitting in one bordered box; the arithmetic is
     read off the glass, not declared). A REFUSED CHIP'S REASON is a further
     line inside one chip — the round that made a grey chip say why, in
     `src/menus/index.ts` — and it costs that chip's own height, so a strip
     carrying one is allowed one more 20px line of type.
     WHAT THE CHECK STILL CATCHES is exactly what the 96 was written for: a row
     that grows a THIRD BLOCK — a second control, a stacked paragraph, a
     heading — because none of those is a wrapped chip line and none of them is
     in this sum. */
  const SIMPLE = ["number", "enum", "flag", "said"];
  const ceil = (g) => 52 + 44 * Math.max(1, g.lines || 1) + (g.whys ? 20 : 0);
  const tall = geom.filter((g) => SIMPLE.indexOf(g.shape) >= 0 && g.h > ceil(g))
    .map((g) => ({ ...g, ceiling: ceil(g) }));
  check(!noLabel.length, "R9 every editable row is ONE sentence label " +
    JSON.stringify(noLabel.slice(0, 3)));
  check(!stacked.length, "…with nothing stacked beside it — no heading, no " +
    "tier line, no second paragraph " + JSON.stringify(stacked.slice(0, 3)));
  check(!under.length, "…and no row under the 44px tap floor " +
    JSON.stringify(under.slice(0, 3)));
  check(!tall.length, "…and every single-answer row inside a sentence line " +
    "plus the lines its control actually occupies " +
    JSON.stringify(tall.slice(0, 3)));
  console.log("       single-answer rows, height vs their own ceiling: " +
    JSON.stringify(geom.filter((g) => SIMPLE.indexOf(g.shape) >= 0)
      .map((g) => g.f + " " + g.h + "/" + ceil(g) +
        " (" + g.lines + (g.whys ? "+why" : "") + ")")));
  /* R9b · THE TWO LINES, READ OFF THE GLASS. Paul's own sentence, asserted as
     geometry and not as markup: the words are ABOVE the control, they do not
     share a line with it, and the control is the width of the row. */
  const two = await p.evaluate(() => {
    const out = [];
    for (const d of document.querySelectorAll("#pan-band .nu-rule[data-shape]")) {
      const wl = d.querySelector(".nu-wline"), ct = d.querySelector(".nu-ctl");
      if (!wl || !ct) { out.push({ f: d.dataset.rule, missing: true }); continue; }
      const a = wl.getBoundingClientRect(), b2 = ct.getBoundingClientRect();
      const one = d.dataset.shape === "number" || d.dataset.shape === "enum" ||
                  d.dataset.shape === "flag";
      out.push({ f: d.dataset.rule, shape: d.dataset.shape,
        below: Math.round(b2.top - a.bottom),
        overlap: b2.top < a.bottom - 1,
        fill: one ? Math.round(100 * b2.width /
          d.querySelector("label.nu-said, fieldset.nu-said").getBoundingClientRect().width) : null });
    }
    return out;
  });
  check(two.length > 10 && two.every((t) => !t.missing && !t.overlap),
    "R9b every editable row is TWO lines — the sentence, and the control on " +
    "the line under it, never beside it " +
    JSON.stringify(two.filter((t) => t.missing || t.overlap).slice(0, 3)));
  const narrow = two.filter((t) => t.fill != null && t.fill < 95);
  check(!narrow.length, "…and a single-answer control has the whole of that " +
    "line " + JSON.stringify(narrow.slice(0, 3)));
  console.log("       multi-answer rows (one control per chair/role): " +
    JSON.stringify(geom.filter((g) => SIMPLE.indexOf(g.shape) < 0)
      .map((g) => g.f + " " + g.shape + " " + g.h + "px")));

  /* the seven motif lines are one row now, with the list behind the hold */
  check(shape.motifs.length === 1 &&
    /* IT READ `/the motifs are written in the tracker/` UNTIL 2026-09-05 (the
       functional text pass, TABLE.md §11): "motif" is "phrase" in the review's
       glossary and "the tracker" is a name no composer uses. The claim is
       unchanged — ONE row, whose text points at where phrases are edited, with
       the list itself behind `data-say`. */
    /phrase editor/i.test(shape.motifs[0].text) &&
    shape.motifs[0].say > 40,
    "R9a the motifs are ONE read-only row with the list behind data-say " +
    JSON.stringify(shape.motifs));

  /* ================= R10 · NATIVE INSTRUMENTS FIRST =====================
     Paul, wave 4 §10: *"When you define a genre you seem to only allow the
     sample instrument not the faust instrument like on high nrg… that's the
     opposite those should be chosen after native"*. `nukernel/rules.js`
     groups the menu off `instruments.js sampledId` (one owner, gated against
     `to-engine.js recipeFor`) and ui/selects.js never reorders, so the order
     on the glass is the order the data tier asked for. */
  check(!!shape.instr &&
    JSON.stringify(shape.instr.groups) === JSON.stringify(["native", "sampled"]),
    "R10 the instrument menu is two groups, native first — " +
    JSON.stringify(shape.instr));

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
    +document.querySelector('#pan-band [data-k="rule|bpm"]').value);
  check(sliderNow === 100, "…and the panel came back showing 100, not the " +
    "jittered tempo (the rule is what a hand said) — " + sliderNow);

  /* ================= R3 · RESET ========================================== */
  const hadReset = await p.evaluate(() =>
    !!document.querySelector('#pan-band [data-k="rule-reset|bpm"]'));
  check(hadReset, "R3 a rule a hand has written wears a reset");
  await press("rule-reset|bpm");
  const back = await doc();
  check(!(back.rules || []).some((r) => r.f === "bpm") &&
    Math.abs(back.time.bpm - 76) <= 5,
    "…and reset takes it off the record and gives the anchor's tempo back " +
    JSON.stringify({ rules: back.rules || null, bpm: back.time.bpm }));
  const gone = await p.evaluate(() =>
    !!document.querySelector('#pan-band [data-k="rule-reset|bpm"]'));
  check(!gone, "…and the reset mark goes with it");

  /* ================= R4 · THE RENDER TIER, WITHOUT A RECOMPOSE ==========
     `phrase` is one of the two fields `document.js toGenre` spreads UNDER the
     document with nothing in precompose reading it, so it reaches the kernel on
     the next frame with no new record at all. The proof that no record was
     written is a sentinel put on the document object from here:
     `ctx.setDocument` replaces `DOC` wholesale, so a surviving sentinel is the
     same object.

     IT WAS `maxHold` UNTIL 2026-09-02, and the tier audit of that day is why it
     is not any more: `precompose.js capOf` (:679) reads `maxHold` FIRST while
     it writes each cell's `play` row, so an edit there moves 182 steps of the
     reggae document and a render tier would have handed the kernel a new cap
     over cells still written with the old one. `maxHold` is a compose rule now
     and `phrase` — measured over twelve anchors x five values, not one byte of
     the composed document — is the honest render one. */
  /* READ OFF THE EVENT STREAM AND NOT OFF A FIELD LIST. `__eightGenres()`
     publishes a HAND-PICKED set of compiled fields (kitSeed, bpm, rate,
     maxHold, prog, pipes) and `phrase` is not among them — adding it there is
     ui/eight.js's to do. It does not need to be: `__eightEvents(si)` is
     `ui/derive.js sectionRender`, the stream the band actually plays, and
     `phrase` IS the arch on it (kernel.js:1337-1348 — the phrase tent plus the
     agogic peak, which lands on the velocities). So this asks the strongest
     form of the question the tier makes: the SOUND of section 0 changed, and
     no new record was written. */
  /* EVERY SECTION, NOT THE FIRST. Measured in node before this was written:
     an arch has to have a phrase to arch, so `reggae`'s two-bar `bass` and
     `groove` BEDS do not move at all under `phrase` and the eleven sections
     with a line in them do (39 events in the first verse, 41 in the first
     chorus). A check that read section 0 would have been a false red about a
     record behaving correctly. */
  const velsOf = () => p.evaluate(() => {
    const n = (window.__eightDoc().form.sections || []).length, out = [];
    for (let i = 0; i < n; i++)
      out.push((window.__eightEvents(i) || []).map((e) => e.vel).join(","));
    return out.join("|"); });
  await p.evaluate(() => { window.__eightDoc().__ruleProbe = "kept"; });
  const hold0 = { vel: await velsOf() };
  await drag("rule|phrase", 0.9);
  const hold1 = { vel: await velsOf(), ...(await p.evaluate(() => ({
    kept: window.__eightDoc().__ruleProbe === "kept",
    rules: window.__eightDoc().rules }))) };
  const moved = hold0.vel.split("|").filter((v, i) => v !== hold1.vel.split("|")[i]).length;
  check(!!hold0.vel && hold1.vel !== hold0.vel,
    "R4 a render-tier rule reaches THE BAND — the velocities move in " +
    moved + " of the record's sections, with no new record written");
  check(hold1.kept, "…without writing a new record — the document is the same " +
    "object it was (no recompose on the render tier)");
  check(Math.abs(((hold1.rules || []).find((r) => r.f === "phrase") || {}).v - 0.9) < 0.001,
    "…and the sentence is on the record " + JSON.stringify(hold1.rules));
  await press("rule-reset|phrase");

  /* ================= R5 · THE PALETTE ==================================== */
  /* `reggae` states no `swing` — its eighths are straight — so the Time
     palette is the way in, which is the whole of what a palette is for. */
  const pal = await p.evaluate(() => {
    const s = document.querySelector('[data-sel="rule-add|Time"]');
    if (!s) return null;
    /* THE GREY IS COLLECTED OFF EVERY PALETTE, not off this one. A vacuous
       pass is the failure mode this check has — `reggae` greys nothing in
       Time, so asking Time alone would assert nothing at all — so the sweep is
       page-wide and it also asserts that SOMETHING is refused, which on this
       record it is: `artic` is capped by a `maxHold` the row states, and the
       changes are the Key panel's. */
    const grey = [];
    /* tag-free, for the same reason `say()` above is: `data-sel` is the
       address and it survives the widget. test/lib-combo.js's `words()` reads
       either one and answers in one shape. */
    const optionsOf = (q) => window.__combo.words(q);
    for (const q of document.querySelectorAll('[data-sel^="rule-add|"]'))
      for (const o of optionsOf(q))
        if (o.off) grey.push({ sel: q.dataset.sel, v: o.v, why: o.why || "",
                               said: o.w.endsWith(o.why || "\u0000") });
    const own = optionsOf(s);
    return { first: own[0] && own[0].w,
             has: own.map((o) => o.v), grey };
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
    control: !!document.querySelector('#pan-band [data-k="rule|swing"]'),
    // `.options` is a `<select>`'s and answered [] on the combo box, which
    // made "the palette stops offering what the record now says" pass on an
    // empty list (2026-09-02)
    still: window.__combo.words(
      document.querySelector('[data-sel="rule-add|Time"]')).map((o) => o.v),
  }));
  check((added.rules || []).some((r) => r.f === "swing"),
    "…and choosing one writes it onto the record " + JSON.stringify(added.rules));
  check(added.control, "…the rule now has a row with a control on it");
  check(added.still.indexOf("swing") < 0,
    "…and the palette stops offering what the record now says " +
    JSON.stringify(added.still));

  /* ================= R11 · A CHANGE EVOLVES THE RECORD ====================
     (2026-09-03.) Paul, after using the deployed composer: *"When I change
     things in the 'Rules' section, evolve the song, don't just restart it."*

     WHAT THIS MEASURED BEFORE THE FIX, on this very page and this very
     record: a drag of the tempo rule while playing fired `transport:state`
     false and then true 361 ms later, took the position feed's serial from 1
     back to 0, replaced the document object and paid the engine's whole
     eight-second ring prefill again. The record stopped and started from the
     top, for a number.

     THE FOUR CLAIMS, and they are asked of the RUNNING page rather than of a
     field: the transport never stops (`transport:state` is silent), the seed
     is the one in the address, the bar counter only ever goes up (the walk's
     own serial off the `pos` feed, which is what "the position is kept"
     means when the record's length itself may change), and the document
     differs ONLY where the rule reaches — everything the rule does not
     govern, which is the slots, the section plan and the cast, is
     byte-identical because `genreToDocument` is composed again at the SAME
     reading.

     THE FEED IS THE PAGE'S OWN. `ui/state.js` is an ES module the page has
     already loaded, so importing it by the same URL hands back the same
     instance and the same bus the transport publishes on — no probe added to
     the shipped source for a gate's convenience. */
  const diff = (a2, b2) => {
    const out = [];
    const walk = (x, y, at2) => {
      if (out.length > 80 || x === y) return;
      const tx = Object.prototype.toString.call(x);
      if (tx !== Object.prototype.toString.call(y)) {
        out.push(at2 + ": " + JSON.stringify(x) + " -> " + JSON.stringify(y)); return; }
      if (tx === "[object Object]") {
        for (const k of new Set([...Object.keys(x), ...Object.keys(y)]))
          walk(x[k], y[k], at2 + "." + k);
        return; }
      if (tx === "[object Array]") {
        if (x.length !== y.length) out.push(at2 + ".length: " + x.length + " -> " + y.length);
        for (let i = 0; i < Math.max(x.length, y.length); i++) walk(x[i], y[i], at2 + "[" + i + "]");
        return; }
      out.push(at2 + ": " + JSON.stringify(x) + " -> " + JSON.stringify(y));
    };
    walk(a2, b2, "");
    return out;
  };
  await p.evaluate(async () => {
    const S = await import("./ui/state.js");
    window.__posLog = []; window.__stateLog = [];
    S.on("pos", (d) => window.__posLog.push(d.serial));
    S.on("transport:state", (d) => window.__stateLog.push(d.playing));
  });
  /* PRESSED AT ITS OWN RECT, never `page.click` — which scrolls its target
     into view first and has faked bug reports on this box. It is also the
     gesture that resumes the AudioContext under the default autoplay policy,
     which is why this browser needs no flag. */
  const playAt = await p.evaluate(() => {
    const r = document.getElementById("play").getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.click(playAt.x, playAt.y);
  let sounded = -1;
  for (const t0 = Date.now(); Date.now() - t0 < 60000;) {
    if ((await p.evaluate(() => window.__posLog.length)) >= 3) { sounded = Date.now() - t0; break; }
    await p.waitForTimeout(400);
  }
  check(sounded >= 0, "R11 the record plays, and the walk is announcing bars " +
    "— " + sounded + " ms to the third bar");
  const live = () => p.evaluate(() => ({
    playing: window.__nuBounce().playing, rms: window.__nuEngine().rms,
    pos: window.__posLog.slice(), st: window.__stateLog.slice(),
    seed: (document.getElementById("reading") || {}).textContent,
    doc: JSON.parse(JSON.stringify(window.__eightDoc())) }));
  const mono = (xs) => xs.every((v, i) => !i || v >= xs[i - 1]);

  /* the RENDER tier first: it never wrote a record and must still not */
  const L0 = await live();
  await drag("rule|phrase", 0.7);
  await p.waitForTimeout(4000);
  const L1 = await live();
  check(L1.playing && L1.st.length === L0.st.length,
    "R11a a RENDER-tier change keeps the transport running and says nothing " +
    "to it " + JSON.stringify({ playing: L1.playing, events: L1.st }));

  /* ...and the COMPOSE tier, which is the one that used to stop */
  const L2 = await live();
  await drag("rule|bpm", 120);
  await p.waitForTimeout(6000);
  const L3 = await live();
  const dEv = L3.st.length - L2.st.length;
  const grew = L3.pos.length - L2.pos.length;
  const dDoc = diff(L2.doc, L3.doc);
  const OWNED = /^(\.time\.bpm|\.rules)/;
  const strays = dDoc.filter((d2) => !OWNED.test(d2));
  check(L3.playing && dEv === 0,
    "R11b a COMPOSE-tier change EVOLVES the record: the transport never " +
    "stopped — " + dEv + " transport:state events across the edit (it was " +
    "two, false then true, before 2026-09-03)");
  check(L3.seed === "3" && L2.seed === "3",
    "R11c …at the same seed " + JSON.stringify([L2.seed, L3.seed]));
  check(mono(L3.pos) && grew > 0,
    "R11d …with the bar counter monotone and still counting — " + grew +
    " new bars announced, serials " + JSON.stringify(L3.pos.slice(-6)) +
    " (the restart took it back to 0)");
  check(!strays.length && dDoc.length > 0,
    "R11e …and the document differs ONLY where the rule reaches — " +
    JSON.stringify(dDoc.slice(0, 6)) +
    (strays.length ? " STRAYS " + JSON.stringify(strays.slice(0, 6)) : ""));
  check(L3.rms > 0, "R11f …and the engine is still making sound through it — " +
    "rms " + L3.rms.toFixed(5));
  await press("rule-reset|bpm");
  await p.mouse.click(playAt.x, playAt.y);          // put it down again
  await p.waitForTimeout(1200);

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
