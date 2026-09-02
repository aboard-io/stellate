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
 *       single-answer row (number / enum / flag) is at most the two tap rows
 *       every other question on this page gets. Measured before this round on
 *       the same record: heights of 33 · 46 · 76 · 103 · 228 · 322 · 478.
 *   R10 THE INSTRUMENT MENU IS NATIVE FIRST, on the rendered page. Paul, wave
 *       4 §10: *"When you define a genre you seem to only allow the sample
 *       instrument not the faust instrument like on high nrg… that's the
 *       opposite those should be chosen after native"*.
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
  /* A MENU IS ANSWERED BY ITS ADDRESS AND NOT BY ITS TAG. `data-sel` is the
     address ui/selects.js stamps and focus-restore reads, and it survives the
     widget: if the `<select>` becomes an `<input role="combobox">` with a
     listbox under it (the 2026-09-02 combo round), the same address still
     names the control. So the query is tag-free and the write takes whichever
     shape it finds — a native select takes `value` + `change`, a combobox
     takes the input and then the option the list offers. */
  const say = async (sel, v) => { await p.evaluate(([s, val]) => {
      const el = document.querySelector('[data-sel="' + s + '"]');
      if (!el) return;
      if (el.tagName === "SELECT") { el.value = val;
        el.dispatchEvent(new Event("change", { bubbles: true })); return; }
      el.focus();
      el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      const list = el.getAttribute("aria-controls") &&
        document.getElementById(el.getAttribute("aria-controls"));
      const opt = list && [...list.querySelectorAll('[role="option"]')]
        .find((o) => (o.dataset.v || o.dataset.value) === String(val));
      if (opt) opt.click();
      else el.dispatchEvent(new Event("change", { bubbles: true })); }, [sel, v]);
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
      })),
      motifs: q(".nu-rule[data-rule='motifs']").map((d) =>
        ({ text: d.textContent.trim(), say: (d.dataset.say || "").length })),
      /* R10: the instrument menu's own group order, read off the rendered
         control. `<optgroup>` labels in document order — ui/selects.js never
         reorders, so this is the order `nukernel/rules.js` handed it. */
      instr: (() => {
        const m = document.querySelector('#rulesdeck [data-sel="rule.instr.0"]');
        if (!m) return null;
        const groups = [...m.querySelectorAll("optgroup")].map((g) => g.label);
        const first = m.querySelector("optgroup option");
        return { groups, first: first && first.value, n: m.options.length };
      })(),
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
    window.__nuSay('#rulesdeck .nu-rule[data-rule="bpm"]'));
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
  const SIMPLE = ["number", "enum", "flag", "said"];
  const tall = geom.filter((g) => SIMPLE.indexOf(g.shape) >= 0 && g.h > 88);
  check(!noLabel.length, "R9 every editable row is ONE sentence label " +
    JSON.stringify(noLabel.slice(0, 3)));
  check(!stacked.length, "…with nothing stacked beside it — no heading, no " +
    "tier line, no second paragraph " + JSON.stringify(stacked.slice(0, 3)));
  check(!under.length, "…and no row under the 44px tap floor " +
    JSON.stringify(under.slice(0, 3)));
  check(!tall.length, "…and every single-answer row inside the two tap rows " +
    "every other question gets " + JSON.stringify(tall.slice(0, 3)));
  console.log("       multi-answer rows (one control per chair/role): " +
    JSON.stringify(geom.filter((g) => SIMPLE.indexOf(g.shape) < 0)
      .map((g) => g.f + " " + g.shape + " " + g.h + "px")));

  /* the seven motif lines are one row now, with the list behind the hold */
  check(shape.motifs.length === 1 &&
    /the motifs are written in the tracker/.test(shape.motifs[0].text) &&
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
       address and it survives the widget. A native menu answers `.options`; a
       combobox's list answers `[role=option]` under the element its
       `aria-controls` names. */
    const optionsOf = (q) => q.options ? [...q.options]
      : (q.getAttribute("aria-controls") &&
         document.getElementById(q.getAttribute("aria-controls"))
        ? [...document.getElementById(q.getAttribute("aria-controls"))
            .querySelectorAll('[role="option"]')].map((o) => ({
              value: o.dataset.v || o.dataset.value || o.textContent,
              textContent: o.textContent,
              disabled: o.getAttribute("aria-disabled") === "true",
              dataset: o.dataset }))
        : []);
    for (const q of document.querySelectorAll('[data-sel^="rule-add|"]'))
      for (const o of optionsOf(q))
        if (o.disabled) grey.push({ sel: q.dataset.sel, v: o.value,
                                    why: o.dataset.why || "",
                                    said: o.textContent.endsWith(o.dataset.why || "\u0000") });
    const own = optionsOf(s);
    return { first: own[0] && own[0].textContent,
             has: own.map((o) => o.value), grey };
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
    still: [...((document.querySelector('[data-sel="rule-add|Time"]') || {})
      .options || [])].map((o) => o.value),
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
