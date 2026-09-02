#!/usr/bin/env node
/* test/sheets.js — D2's gate. THE SHEETS, READ OFF THE RENDERED PAGE.
 *
 * "TEST THE ARTIFACT: gates must read the rendered output; three features
 * shipped broken here while every check passed." So nothing below asks a module
 * what it would draw — every assertion is a query against the DOM the browser
 * actually built, and the interactive gates are driven by CLICKING the controls
 * a thumb would click.
 *
 *   node test/sheets.js
 *   node test/sheets.js --page http://localhost:8777/test/fixtures/sheets-harness.html
 *
 * The default target is nukernel/index.html, which draws no sheet until the
 * wave-2 recipe has been applied to ui/eight.js. `--page` takes the harness
 * instead: the same avail.js + gates.js + ui/sheets.js over the same shipped
 * record, so the sheets tier can be held to this gate on its own.
 *
 * Playwright is borrowed (NODE_PATH=/home/ford/ftrain-2025/node_modules) and the
 * executable path is EXPLICIT — chromium.launch() with no path resolves shell
 * build 1200, which is not installed on this machine.
 */
"use strict";
const { chromium } = require("playwright");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const PAGE = arg("--page", "http://localhost:8777/nukernel/index.html");
const EXE = arg("--chrome", process.env.HOME +
  "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
// WHICH PAGE THIS IS. A few claims below are about the SHIPPED page and not
// about the sheets tier — the widget ui/selects.js's router picks, and the drum
// step grid ui/eight.js draws — and a harness that cannot draw them must say
// "not here" rather than "broken". test/selects.js:38 carries the same flag.
const REAL = /nukernel\/index\.html/.test(PAGE);

/* SHEETS THE VOCABULARY DOES NOT OWN, DECLARED HERE BY NAME AND BY REASON.
 * Two assertions below ask nukernel/avail.js what a sheet should contain, and
 * they were written when every sheet on the page came out of `optionsFor`.
 * Wave 3 put three that do not there (D4): the producer's taps are PAGE state —
 * which verb you are half-way through saying — and not a fact about the record,
 * so avail.js SHEETS, whose rows carry a `get`/`set` over the document, is the
 * wrong owner for them (ui/produce.js builds their specs itself and marks them
 * `ungated`, which §2.3 provides for). They are exempted BY NAME rather than by
 * a wildcard, and the third check below fails on any sheet that is neither an
 * avail row nor on this list — so a slice that quietly invents a sheet outside
 * the vocabulary still turns this gate red.
 *
 * `prod.scope` and the ones after it are also the only sheets on the page with
 * NOTHING checked, and that is what they mean: nothing has been said yet.
 * (It read "`prod.verb` and the two after it" until 2026-09-01, when the verb
 * sheet was deleted — Paul: "The only verb is 'make' from now on. Make X Y.")
 *
 * `master` and `bus` joined them 2026-08-24, when the board's fifteen master
 * dropdowns became fifteen sheets (STATE.md item 20 — twenty-three `<select>`s
 * survived, all on the board, outside the `#app` subtree check 1 below looks
 * at). They are NOT page state: they are facts about the record. But avail.js is
 * not their vocabulary and never has been — THE RACK HAS ITS OWN REGISTRY,
 * `fields.js` MASTER and BUSES, which is where every one of these rows, its
 * label, its table and its default is declared, and `nukernel/desk-gate.js` G3
 * is the gate that holds a document's spelling to it. Two entries and not
 * fifteen because §2.3's key is bare-key-then-scope: `master|drive`,
 * `bus|rev|ret`. If they are ever taught to avail.js, delete these two lines
 * and the count check below starts holding them too. */
const VIEW_SHEETS = {
  /* `prod.verb` — "which of the six verbs is being said (page state)" — is
     DELETED, 2026-09-01, in the same commit as the sheet itself (Paul: "The
     only verb is 'make' from now on. Make X Y."). A declared sheet nobody
     draws is a registry that has stopped describing the page, so the row and
     the sheet go together; the `undeclared` check below is what would have
     caught the other order. */
  "prod.scope":  "ui/produce.js — who it is being said about (page state)",
  "prod.word":   "ui/produce.js — the adjective, drawn from producer.js's own table",
  "prod.record": "ui/produce.js — the same tap aimed at the whole record",
  "prod.section":"ui/produce.js — the same tap aimed at one section",
  "master": "ui/engineer.js — the master strip, declared by fields.js MASTER " +
            "(drive/glue/tape/space/width/tilt/ceiling), gated by desk-gate G3 and G11",
  "bus":    "ui/engineer.js — the three shared returns, declared by fields.js " +
            "BUSES (name/ret/color/time/fb/tone), gated by desk-gate G3 and G11",
  /* ...and the CHANNEL's own rack row, for exactly the reason the two above
     give and found the day this gate started walking the voice tabs
     (2026-08-25). `eng.fx` is the character chips — ui/engineer.js:360, the one
     control on the page that allows more than one answer — and its vocabulary
     is fields.js `FX`, declared at fields.js:1491 as
     `{ key: "fx", scope: "box", type: "list", table: FX, max: MAX_FX }`. Same
     registry as MASTER and BUSES, same gate (nukernel/desk-gate.js), same
     reason it is not an avail.js row and never has been.

     It was not on this list because until today this gate only ever looked at
     the page it booted on, and `eng.fx` is drawn on a VOICE's tab. Its five
     neighbours — eng.lvl / pan / rev / echo / room — are `<select>`s now and so
     are not sheets at all; the chips are the only one left.

     THE KEY IS `master.fx` NOW — RENAMED 2026-08-26, AND THE PAGE WAS RIGHT.
     Paul, 2026-08-26: "Don't let me add effects to instruments. That's bus and
     board stuff." The chip came off every instrument and got an address on the
     board instead (`ui/engineer.js:1119`), because the chain it writes is the
     RECORD's — audio/desk.js hands `S.fx` to every seated voice — so one voice's
     tab was never where it belonged. Same eleven options, same fields.js `FX`
     table, same MAX_FX cap, same desk-gate rows holding it; only the key and the
     place moved, and this list is a list of keys. The round that moved it left
     the recipe (`multiselect-moved-to-the-main-strip.md`) saying this file and
     test/selects.js each needed one line; this is that line. It is NOT
     `#app`-scoped — the `.nu-sheet` survey below walks the whole document —
     which is why this gate sees it at all and test/selects.js, which is
     `#app`-scoped on purpose, correctly stopped seeing it. */
  /* `master.fx` CAME OFF THIS LIST 2026-08-27 with the control it declared.
     It read: "ui/engineer.js — the RECORD's character chips, under the board,
     declared by fields.js FX (capped at MAX_FX), gated by desk-gate G3 (the
     vocabulary) and G10 (the cap: six chips resolve to MAX_FX)". Paul: *"We
     can get rid of Character right? We don't really use it any more do we?"*
     The chain is dealt to each chair's own three insert slots, which are
     `<select>`s and so are not sheets at all — the same reason the five
     neighbours named in the paragraph above are not on this list. */
  /* ...and the sheets harness's own multi sheet, 2026-08-24. The live control
   * that allows more than one answer is the engineer's character chips
   * (ui/engineer.js:360) and the engineer is not in that harness, so the SHAPE
   * is reproduced there — `multi`, `max`, a capped option list, `set` taking
   * the whole array — in order that the sheets tier's new `<select multiple>`
   * can be held to gate 8b on its own page as well as on the shipped one. Page
   * state and `ungated`, exactly as the producer's taps above are. It never
   * appears on nukernel/index.html. */
  "harness.chips": "test/fixtures/sheets-harness.html — the multi shape, so the " +
                   "sheets tier can be gated without the engineer (page state)",
};

const fails = [], notes = [];
const check = (ok, what) => { (ok ? notes : fails).push((ok ? "ok   " : "FAIL ") + what); };

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const p = await b.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text()))
    errs.push("console: " + m.text()); });
  await p.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  await p.goto(PAGE, { waitUntil: "networkidle" });
  await p.waitForFunction(() => document.querySelectorAll(".nu-sheet").length > 0,
    null, { timeout: 20000 }).catch(() => {});

  await p.evaluate((v) => { window.__viewSheets = v; }, VIEW_SHEETS);

  // THE DOCUMENT, whichever page this is. The real page publishes __eightDoc;
  // the harness publishes __doc. A gate that only knew one of them would be a
  // gate that could not run until somebody else's serial pass had landed.
  await p.evaluate(() => { window.__D = window.__eightDoc || window.__doc; });

  /* ---- WALK EVERY VIEW, BECAUSE `#app` IS TABS NOW -----------------------
     THIS IS THE HOLE THAT LET THE THREE SURVEY GATES BELOW PASS ON NOTHING.
     `#app` used to be one long scroll with every control on it, so one
     snapshot was the whole page. It is a set of tabs over a section LIST now
     (Paul, 2026-08-25: *"when you tap it brings up the questions about the
     section"*), and the page BOOTS on the form tab, whose list is five names
     and no controls. Measured 2026-08-25 on nukernel/index.html: at boot `#app`
     carries 0 sheets and 0 development menus, so "0 sheets drawn" was a real
     failure and "NO DEVELOPMENT WORD IS A MENU []" was a vacuous pass — the
     same snapshot, telling the truth once and lying once.

     A survey is therefore taken once PER VIEW and unioned. On the sheets
     harness there are no tabs at all — it is one page with everything on it,
     which is what the harness is for — so `eachView` runs its body once and
     `views` is `[null]`. */
  const tapK = async (k) => {
    const hit = await p.evaluate((kk) => {
      const n2 = document.querySelector('[data-k="' + CSS.escape(kk) + '"]');
      if (!n2) return false;
      n2.click(); return true;
    }, k);
    await p.waitForTimeout(250);
    return hit;
  };
  // THE FORM TAB NEEDS A SECOND TAP. Its list is names; a section's questions
  // are one tap further in, on `sec<id>` (ui/eight.js:3369).
  const SEC1 = await p.evaluate(() => {
    const d = window.__D();
    return (d.form.sections[1] || d.form.sections[0] || {}).id;
  });
  /* ---- AND THE PAGE IS NINE TOP-LEVEL TABS NOW (2026-08-27) -------------
     Paul: *"Why don't we make tabs at the top level and let go of the idea of
     scrolling everything? The tabs are: Where / Tempo / Key / Motif / Band /
     Mix / Produce / Score / Export."* This block read the band's voice tabs
     off `[data-k^="tab"]` and walked those, which is exactly the right walk
     for a page where every one of those buttons is on the screen at boot. It
     is not any more: the voice tabs live INSIDE the Band panel, eight panels
     out of nine are `display: none`, and the page boots on Where. Measured
     against the tabbed page before this change: `views` came back EMPTY, so
     `eachView` ran its body zero times and nine survey checks failed with the
     empty list — the same hole this block was written to close, one level up.

     So the walk is now two deep and the outer level is the page's own tab
     table, read off `window.__eightTabs()` and opened through
     `window.__eightTab` — the same call the tab button's listener makes. The
     inner level is unchanged: on the Band tab, and only there, every voice tab
     is opened as well, and the form tab still needs its second tap.

     AND IT IS OPENED, NOT JUST FOUND. `document.querySelector` finds a button
     inside a `display: none` panel perfectly well and `.click()` on it fires
     nothing, because ui/eight.js marks a shut panel `inert`. A gate that
     tapped without opening would therefore survey the tab it was already on
     nine times and report it as nine views. */
  const TOPS = REAL
    ? await p.evaluate(() => window.__eightTabs ? window.__eightTabs() : [])
    : [];
  const openTop = async (t) => {
    await p.evaluate((tt) => window.__eightTab(tt), t);
    await p.waitForTimeout(t === "Score" ? 1200 : 300);
  };
  const views = REAL ? [] : [null];
  if (REAL) for (const t of TOPS) {
    if (t !== "Band") { views.push({ top: t, k: null }); continue; }
    await openTop(t);
    /* THE BAND'S VOICE KEYS, OFF THE STRIPE (2026-08-28). This read
       `#tabs [data-k^="tab"]` — the horizontal strip inside the Band panel.
       The strip is the `band` LEVEL of `#nu-tray` now (Paul: *"one vertical
       stripe max with an 'up' icon to get to the parent level"*) and
       `openTop("Band")` has already dropped the stripe onto it, because
       arriving on a tab IS descending into it. The keys did not move — the
       gate asks for the same `tabform` / `tabcantor` / `tabschola` it always
       did — so nothing below this line changed. `#nu-tray` and not
       `.nu-traylist`: the ↑ button's key is `trayup`, which `^="tab"` does not
       match, and neither does a root level's `toptab-…`. */
    const voices = await p.evaluate(() =>
      [...document.querySelectorAll('#nu-tray [data-k^="tab"]')].map((n2) => n2.dataset.k));
    /* ...AND A VOICE IS THREE FACETS SINCE 2026-08-28. Paul: *"A voice has:
       Instrument voice with settings from the mixer / What it plays, register,
       material / Per-section settings."* The band panel draws exactly the facet
       you are standing on (ui/eight.js `voiceFacet`), so a survey that stopped
       at the voice's own mark saw its instrument and neither of the other two
       — and every `dev.*` claim in this file went red for want of a tap, not
       for want of a control. The facet keys are read off the stripe rather than
       typed, exactly as the voice keys above are; a voice with none (the form
       and performance marks) yields the single view it always did. */
    for (const k of voices) {
      views.push({ top: t, k });
      // BACK TO THE BAND LEVEL BEFORE EACH ONE. A mark DESCENDS since
      // 2026-08-28 — `tabform` opens the sections, a voice opens its facets —
      // so a loop that tapped the next key without coming up first would be
      // asking for a button that is one level above where it is standing, and
      // `tapK` would answer false for every voice after the first.
      await openTop(t);
      await tapK(k);
      const facets = await p.evaluate(() =>
        [...document.querySelectorAll('#nu-tray [data-k^="facet-"]')].map((n2) => n2.dataset.k));
      for (const f of facets) views.push({ top: t, k, f });
    }
  }
  const eachView = async (fn) => {
    const out = [];
    for (const v of views) {
      if (v) {
        await openTop(v.top);
        if (v.k) {
          await tapK(v.k);
          if (v.f) await tapK(v.f);
          if (v.k === "tabform") await tapK("sec" + SEC1);
        }
      }
      out.push({ view: v ? (v.top + (v.k ? "/" + v.k : "")) : null,
                 r: await p.evaluate(fn) });
    }
    return out;
  };
  /* THE MAIN PLATE IS BEHIND A TAB, 2026-08-27, and this is the tap that goes
     there rather than a survey that quietly stops at the tab row.

     Paul, 2026-08-27: *"Put the effects buses and mains into special tabs
     after the voices -- now the board is one tabbed space that is consistent
     and easy to understand."* `views` above is the #app tab row and the board
     is not in #app, so the board's own tab is opened once, here, and stays
     open — `BOARDTAB` in ui/engineer.js is a module `let` that survives the
     remount every #app tab tap causes, so one tap holds for the whole survey.

     WHAT THIS TAP WAS ADDED FOR IS GONE AND THE TAP IS NOT. It was written
     the same day for `master.fx`, the record's Character chips: the page's ONE
     `<select multiple>`, sitting on this plate, which two checks below counted
     — and without the tap both would have answered 0, been right about the
     page they looked at and wrong about the page. Hours later Paul retired the
     control itself (*"We can get rid of Character right? We don't really use
     it any more do we?"*; the chain is dealt to the strips' own one-chip
     slots). The tap stays because the SURVEY is the claim, not the sheet: the
     `.nu-sheet` walk, the `<select>`-provenance check and the no-silent-grey
     walk all run over `document`, and a main plate that never opened is a
     region of the shipped page none of them ever looked at. Measured after the
     retirement: with the tap, 0 sheets and 0 multi sheets on the shipped page,
     and 9 controls on this plate surveyed that would otherwise not be — the
     seven master words, the record gain and the listening column. */
  if (REAL) { await openTop("Mix"); await tapK("boardtab|bus|main"); }

  const union = (rows, key) => {
    const seen = new Set(), out = [];
    for (const { r } of rows) for (const x of r[key])
      { const s2 = JSON.stringify(x); if (!seen.has(s2)) { seen.add(s2); out.push(x); } }
    return out;
  };
  const total = (rows, key) => rows.reduce((a, { r }) => a + r[key], 0);

  /* ---- 1 EVERY <select> IN #app IS ONE THAT WAS ASKED FOR BACK ----
     THIS CHECK IS A REVERSAL, WRITTEN DOWN RATHER THAN DELETED. It read
     `check(nSel === 0, "#app select is empty")` and it was right on the morning
     of 2026-08-24: "the options for each instrument in a song section are now
     just one thing in a dropdown. That's not effective." That evening, having
     looked at the page: "We can return some things to select menus: meter /
     reading speed / swing / key / mode / the changes / chord quality … in
     voices -- plays, material, instrument … in general where there is ONE
     option a dropdown is preferred."

     Both sentences are about the same page and neither one cancels the other.
     The first is about the DEVELOPMENT WORDS — a per-voice, per-section choice
     among twenty-one melodic operators, where you are comparing and where a
     grey with a reason on it is the most useful thing the page can say. The
     second is about SETTLED PARAMETERS — one value, decided once. So the law
     this file holds is no longer "no menus"; it is "no menu where you are
     comparing", and the half of it this file owns is: a development word is
     never a menu. WHICH controls came back is test/selects.js's list, and it is
     not restated here — one owner per fact.

     ...AND THEN THE SECOND SENTENCE WENT ALL THE WAY OVER, WHICH IS A REVERSAL
     REWRITTEN AND NOT DELETED. The line below read `check(!devMenu.length, "NO
     DEVELOPMENT WORD IS A MENU — that is what the sheets are for")`, and it was
     the whole half of the law this file owned. Paul said it twice more, most
     recently: *"There are still many boxes that should be selects"*. The rule
     that settled is not "no menu where you are comparing" but the simpler thing
     it turned into: A SINGLE-CHOICE CONTROL IS A `<select>`. What stays a lit
     sheet is the one `<select multiple>` (the engineer's fx chips), the drum
     STEP GRID, and single booleans — everything in `#app` that asks for one
     answer is a menu now, development words included. Measured 2026-08-25 on
     the shipped page: 5 `dev.line|cantor|*` menus of 26 options each, 5
     `dev.kit|kit|*` of 69, and not one `.nu-sheet[data-sheet^="dev."]` left.

     So the assertion is turned around and left pointed at the same fact. What
     did not move: every menu in `#app` is one nukernel/ui/selects.js drew (they
     carry `data-sel`), not a hand-rolled <select> smuggled back in. What is
     new: no key may be drawn BOTH ways at once — the hole a half-finished
     conversion falls into, which neither the old line nor its opposite would
     have caught on its own. */
  const widgets = await eachView(() => ({
    // the fallback name carries WHERE it was found as well as WHAT it is, so
    // the seat exemption above can be by key shape AND container together
    // rather than by key alone (2026-08-28)
    menus: [...document.querySelectorAll("#app select")]
      .map((s) => s.dataset.sel || "(no data-sel: " +
        (s.dataset.k || s.outerHTML.slice(0, 40)) +
        (s.closest(".nu-strip") ? " IN A STRIP" : "") + ")"),
    sheetKeys: [...document.querySelectorAll("#app .nu-sheet")].map((f) => f.dataset.sheet),
    multiKeys: [...document.querySelectorAll("#app .nu-sheet[data-multi]")]
      .map((f) => f.dataset.sheet),
  }));
  const menus = union(widgets, "menus");
  const sheetKeys = union(widgets, "sheetKeys");
  /* THE INSERT SEATS ARE NAMED, NOT COUNTED AS ROGUE (2026-08-28), and this
     is a scope moving rather than a law relaxing. `rogue` asks "is every
     <select> in #app one ui/selects.js drew" — the guard against a hand-rolled
     menu being smuggled back in — and until today every hand-rolled one on the
     page was outside #app, on the board.

     PAUL, 2026-08-28: *"In the voice -- add another nav item for the mixing and
     give it a channel design like the mixer … add it in a new nav element
     called mix that is per voice"*, and *"remove the voices from the mixing
     board."* A voice's channel strip is inside the voice now — inside #app —
     and it brings ui/engineer.js's own `seatSelect` with it: three per strip,
     keyed `ins|<voice>|<n>`, one per insert slot.

     WHY IT IS EXEMPT RATHER THAN CONVERTED. The seat is not an unowned
     <select>: it is a NAMED control with its own gate. desk-gate G11 asserts
     that a strip carries EXACTLY MAX_FX of them, keyed `ins|<voice>|<n>` and
     nothing else on it is a menu at all; G14 asserts that every control on the
     page offering the FX vocabulary against a voice IS one of these seats; G15
     drives one, reads the document back and drives it off again. That is more
     coverage than `data-sel` provenance buys. What this line still refuses is
     what it was written to refuse — an ANONYMOUS hand-rolled menu — so the
     exemption is by KEY SHAPE and by CONTAINER TOGETHER: an `ins|…` select
     that is not inside a `.nu-strip` still fails here, and so does any other
     shape.

     (The board's own half of the walk did not change: the seats used to be
     found by desk-gate's "every <select> outside #app" sweep and are not out
     there any more; that file carries the same note at its `sweepSelects`.) */
  const SEAT = /^\(no data-sel: ins\|[^|]+\|\d+ IN A STRIP\)$/;
  const rogue = menus.filter((k) => /^\(no data-sel/.test(k) && !SEAT.test(k));
  const devMenu = menus.filter((k) => /^dev\./.test(k));
  const devSheet = sheetKeys.filter((k) => /^dev\./.test(k));
  /* A MULTI SHEET IS A FIELDSET AROUND ITS OWN `<select multiple>` and the two
     share a key by construction (ui/sheets.js draws `multi` that way since
     Paul, 2026-08-24: "Wherever we allow multiple selections use a standard
     multiselect form element please."). That is the shape gate 8b holds, not a
     half-finished conversion, so it is not what this line is looking for. */
  const multiKeys = union(widgets, "multiKeys");
  const bothWays = menus.filter((k) =>
    sheetKeys.includes(k) && !multiKeys.includes(k));
  const seats = menus.filter((k) => SEAT.test(k));
  check(!rogue.length, "every <select> in #app came from ui/selects.js, or is " +
    "an insert SEAT on a channel strip (" + seats.length + " of those — " +
    "ui/engineer.js `seatSelect`, named and driven by desk-gate G11/G14/G15) " +
    JSON.stringify(rogue.slice(0, 3)));
  check(seats.length > 0, "…and the strip that carries them is on the page at " +
    "all: the voices' `mix` facet is one of the views this survey walks, so a " +
    "strip that stopped being drawn fails here rather than passing quietly " +
    JSON.stringify(seats.slice(0, 3)));
  check(!bothWays.length, "no key is drawn as a sheet AND as a menu " +
    JSON.stringify(bothWays));
  if (REAL)
    check(devMenu.length > 0 && devSheet.length === 0,
      "EVERY DEVELOPMENT WORD IS A MENU — " + devMenu.length + " of them, and " +
      devSheet.length + " still drawn as a sheet " + JSON.stringify(devSheet));
  else notes.push("     (which widget a development word gets is ui/selects.js's " +
    "router, which this harness does not import — index.html only)");

  /* ---- 2 every sheet has a legend, and its options are avail.js's own ---- */
  const shapes = await eachView(() => {
    const q = (s) => [...document.querySelectorAll(s)];
    const scopeOf = (ds, doc) => {
      const out = {};
      for (const seg of ds.split("|").slice(1)) {
        if (/^bar\d+$/.test(seg)) out.bar = +seg.slice(3);
        else if (doc.voices.some((v) => v.name === seg)) out.voice = seg;
        else out.section = seg;
      }
      return out;
    };
    const doc = window.__D();
    // THE FLEET IS THE PAGE'S. `sound.instrument` offers one option per modelled
    // Faust voice, and audio/to-engine.js SYNTH is the only table that knows
    // which those are — an ES module the data tier cannot require. So the page
    // says: ui/eight.js publishes __eightEnv beside its other console hooks and
    // the harness publishes __env. A gate that guessed the empty fleet would
    // count two options short and call the page wrong.
    const env = (window.__eightEnv || window.__env || (() => ({ fleet: [] })))();
    return {
      n: q(".nu-sheet").length,
      multiKeys: q(".nu-sheet[data-multi]").map((f) => f.dataset.sheet),
      noLegend: q(".nu-sheet").filter((f) => !(f.querySelector("legend") || {}).textContent)
        .map((f) => f.dataset.sheet),
      notOne: q(".nu-sheet:not([data-multi])")
        .filter((f) => !window.__viewSheets[f.dataset.sheet.split("|")[0]])
        .map((f) => [f.dataset.sheet, f.querySelectorAll("input:checked").length])
        .filter(([, n]) => n !== 1),
      // ...and any sheet that is neither an avail.js row nor a declared
      // view-owned one. This is the check that keeps the two exemptions above
      // from being a hole: a new sheet outside the vocabulary lands here.
      undeclared: q(".nu-sheet").map((f) => f.dataset.sheet.split("|")[0]
          .replace(/#\d+$/, ""))
        .filter((k) => !window.NuAvail.SHEETS[k] && !window.__viewSheets[k])
        .filter((k, i, a) => a.indexOf(k) === i),
      dup: (() => { const seen = {}, d = [];
        for (const f of q(".nu-sheet")) { if (seen[f.dataset.sheet]) d.push(f.dataset.sheet);
          seen[f.dataset.sheet] = 1; } return d; })(),
      counts: q(".nu-sheet").map((f) => {
        const bare = f.dataset.sheet.split("|")[0].replace(/#\d+$/, "");
        if (window.__viewSheets[bare]) return null;
        const row = window.NuAvail.SHEETS[bare];
        if (!row) return [f.dataset.sheet, "no SHEETS row", 0];
        const want = row.values(doc, scopeOf(f.dataset.sheet, doc), env).length;
        // A MULTI SHEET COUNTS ITS <option>s. As of 2026-08-24 `multi` draws a
        // `<select multiple>` and not a row of checkboxes (Paul: "Wherever we
        // allow multiple selections use a standard multiselect form element
        // please."), so it has no `.nu-opt` rows at all and a check that
        // counted them would read every one of them as a sheet of zero.
        const got = f.hasAttribute("data-multi")
          ? f.querySelectorAll("option:not([data-placeholder])").length
          : f.querySelectorAll(".nu-opt").length;
        return want === got ? null : [f.dataset.sheet, want, got];
      }).filter(Boolean),
    };
  });
  const shape = {
    n: total(shapes, "n"),
    noLegend: union(shapes, "noLegend"), notOne: union(shapes, "notOne"),
    undeclared: union(shapes, "undeclared"), dup: union(shapes, "dup"),
    counts: union(shapes, "counts"),
  };
  /* HOW MANY SHEETS ARE LEFT, AND WHY THAT NUMBER IS NOW SMALL. This read
     `shape.n > 0` against ONE snapshot, and the snapshot was the boot page: 0,
     which is why the gate failed here before it crashed further down. Walked
     across every tab (above), the shipped page draws exactly one sheet per
     voice — the engineer's fx chips — because every single-choice control on
     it is a `<select>` now (gate 1). The claim worth making is therefore not
     "more than none" but "the ones that are left are the ones that are allowed
     to be": a sheet on the shipped page is a `<select multiple>`, and nothing
     else is drawn as one. The harness is the sheets tier's own page and keeps
     the plain count. */
  /* ...AND THEN THERE WERE NONE, 2026-08-27. The paragraph above is still the
     right law and its subject has gone: the last sheet on the shipped page was
     `master.fx`, the record's Character chips, and Paul retired it — *"We can
     get rid of Character right? We don't really use it any more do we?"* The
     chain is dealt to the strips' own slots, which are `<select>`s. So the
     claim is stated as what it always meant — a sheet on the shipped page is a
     `<select multiple>` and nothing else is drawn as one — and it is now
     vacuously true, which the count says out loud rather than hides. The
     harness keeps the plain "more than none" count, so the shape assertions
     below still have thirty sheets to be made about. */
  if (REAL) {
    const singles = sheetKeys.filter((k) => !multiKeys.includes(k));
    check(!singles.length,
      shape.n + " sheet(s) left on the shipped page and every one is a " +
      "<select multiple> — single-choice sheets still drawn: " + JSON.stringify(singles));
  } else check(shape.n > 0, shape.n + " sheets drawn");
  check(!shape.noLegend.length, "every sheet has a legend " + JSON.stringify(shape.noLegend));
  check(!shape.notOne.length, "exactly one input:checked per non-multi sheet " +
    JSON.stringify(shape.notOne));
  check(!shape.dup.length, "no duplicate data-sheet " + JSON.stringify(shape.dup));
  check(!shape.counts.length, ".nu-opt count == NuAvail.SHEETS[key].values().length " +
    JSON.stringify(shape.counts));
  check(!shape.undeclared.length, "every sheet is an avail.js row or a declared " +
    "view sheet " + JSON.stringify(shape.undeclared));

  /* ---- 3 NO SILENT GREY. The one law this whole slice exists for. ---- */
  const silentFn = () => {
    const q = (s) => [...document.querySelectorAll(s)];
    return {
      // AN OPTION INSIDE A DISABLED SHEET IS NOT A SILENT GREY. `input.disabled`
      // reads true for every control inside a `<fieldset disabled>` — that is
      // what the attribute is FOR — so the literal reading of "every
      // input:disabled has a non-empty .nu-why" fails the moment a whole sheet
      // goes dark, and it fails on the one case D2 is proudest of: sixty-nine
      // kit words greyed under one reason that says "no drummer". The law is
      // that no grey is unexplained, and a sheet-level reason explains a
      // sheet-level grey. Options whose OWN input carries `disabled` are
      // checked; the fieldset's reason is checked separately below.
      opt: q(".nu-opt input:disabled").filter((i) => {
        const fs = i.closest("fieldset.nu-sheet");
        if (fs && fs.disabled) {
          const sw = [...fs.children].find((c) => c.tagName === "P" &&
            c.classList.contains("nu-why"));
          if (sw && sw.textContent.trim()) return false;
        }
        const w = i.closest(".nu-opt").querySelector(".nu-why");
        return !w || !w.textContent.trim(); }).map((i) => i.dataset.k),
      sheet: q("fieldset.nu-sheet[disabled]").filter((f) => {
        const w = [...f.children].find((c) => c.tagName === "P" &&
          c.classList.contains("nu-why"));
        return !w || !w.textContent.trim(); }).map((f) => f.dataset.sheet),
    };
  };
  const silent = () => p.evaluate(silentFn);
  // ...ACROSS EVERY VIEW, for the reason given at `eachView`: taken once on the
  // boot page this scanned a list of five section names and found no greys to
  // be silent about. Unioned over the tabs it scans every control the record
  // actually draws.
  const s0rows = await eachView(silentFn);
  const s0 = { opt: union(s0rows, "opt"), sheet: union(s0rows, "sheet") };
  check(!s0.opt.length, "NO SILENT GREY — every input:disabled has a reason " +
    JSON.stringify(s0.opt));
  check(!s0.sheet.length, "NO SILENT GREY — every fieldset[disabled] has a reason " +
    JSON.stringify(s0.sheet));

  /* ---- 4 the drummer. Hire one, then switch him off. ---- */
  // ON THE BAND TAB, WHICH IS WHERE THE BAND IS (2026-08-27). `+ drums` was a
  // button in `#tabs`, inside the Band panel, and eight panels out of nine are
  // `display: none` and `inert` — a `.click()` on a button in a shut panel
  // finds the element and fires nothing.
  // IT IS IN THE STRIPE NOW (2026-08-28) and the tab still has to be opened,
  // for a reason that only looks like the same one: `#nu-tray` is never inert,
  // but the stripe shows the `band` LEVEL only while the Band tab is open, so
  // `[data-k="adddrums"]` is not on the page until you are there.
  if (REAL) await openTop("Band");
  await p.evaluate(async () => {
    const add = document.querySelector('[data-k="adddrums"]');
    if (add) { add.click(); return; }
    if (window.__addDrums) window.__addDrums(true);
  });
  await p.waitForTimeout(200);
  /* ...AND ONE MORE TAP FOR THE FACET, 2026-08-28. Paul: *"A voice has:
     Instrument voice with settings from the mixer / What it plays, register,
     material / Per-section settings."* Opening a voice lands on its INSTRUMENT
     facet; `dev.kit` is a per-SECTION word and `[data-k="drums"]` (the
     drummer's on/off) is under WHAT IT PLAYS, so each of the three reads below
     names the facet it needs instead of assuming one panel holds all of them.
     `facet` is a no-op wherever the mark is absent, so the harness page — which
     has no gutter at all — is untouched. */
  const facet = async (f) => {
    await p.evaluate((k) => { const n2 = document.querySelector('[data-k="' + k + '"]');
      if (n2) n2.click(); }, f);
    await p.waitForTimeout(250);
  };
  /* THE KIT'S DEVELOPMENT WORDS MOVED WIDGET, THE LAW DID NOT — the same
     rewrite gate 5 below already carries for `alphabet.quality`, and the same
     sentence: Paul, *"There are still many boxes that should be selects"*.
     WAS: `.nu-sheet[data-sheet^="dev.kit"]:not([disabled])`, which on the
     shipped page now matches nothing at all and read as "the kit is dead"
     while the kit was fine. Measured 2026-08-25: `dev.kit|kit|c1` is a
     `<select>` of 69 options, and it lives on the drummer's own tab, so the
     tab has to be opened before it can be looked at. */
  await p.evaluate(() => {
    const t = document.querySelector('[data-k="tabkit"]');
    if (t) t.click();
  });
  await p.waitForTimeout(250);
  await facet("facet-sec");
  const kitLive = await p.evaluate(() => {
    const f = document.querySelector('.nu-sheet[data-sheet^="dev.kit"]');
    if (f) return { as: "sheet", live: !f.disabled };
    const s2 = document.querySelector('select[data-sel^="dev.kit"]');
    return s2 ? { as: "menu", live: !s2.disabled } : { as: "absent", live: false };
  });
  check(kitLive.live, "with a drummer, the kit's development words are live " +
    "(as a " + kitLive.as + ")");
  await facet("facet-plays");             // the drummer's on/off lives here
  await p.evaluate(() => {
    const c = document.querySelector('[data-k="drums"]');
    if (c) { c.checked = false; c.dispatchEvent(new Event("change", { bubbles: true })); return; }
    const d = window.__D().voices.find((v) => v.kind === "drums");
    if (d) { d.cast.on = false; (window.__draw || (() => {}))(); }
  });
  await p.waitForTimeout(200);
  await facet("facet-sec");               // ...and the words it greys do not
  // ...AND IT IS READ BACK THROUGH WHICHEVER WIDGET IT IS, for the reason
  // above. A disabled <select> keeps its <option>s in the list exactly as a
  // disabled fieldset keeps its `.nu-opt` rows: greyed, not hidden, which is
  // the half of this assertion that is actually about the design.
  const kit = await p.evaluate(() => {
    const f = document.querySelector('.nu-sheet[data-sheet^="dev.kit"]');
    if (f) { const w = [...f.children].find((c) => c.classList.contains("nu-why"));
      return { as: "sheet", off: f.disabled, why: w ? w.textContent : null,
               visible: f.querySelectorAll(".nu-opt").length }; }
    const s2 = document.querySelector('select[data-sel^="dev.kit"]');
    if (!s2) return null;
    return { as: "menu", off: s2.disabled, why: s2.dataset.why || null,
             visible: s2.options.length };
  });
  check(!!kit && kit.off && /no drummer/.test(kit.why || ""),
    "no drummer -> dev.kit disabled (as a " + (kit && kit.as) + ") reading " +
    JSON.stringify(kit && kit.why));
  check(!!kit && kit.visible > 60,
    "...and its " + (kit && kit.visible) + " options are STILL VISIBLE — greyed, not hidden");

  /* ---- 4b THE DRUM KIT IS NOT A MULTISELECT, AND THAT IS THE SAME RULE ----
     Paul asked, 2026-08-24: "can i pick more than one options for the drum
     kit?" The measured answer is no — document.js:192 writes `drumkit` as a
     STRING, audio/to-engine.js:1141 does `Object.assign(D, MACHINE_KIT[kit])`,
     and `drumVoice(kit, lane)` resolves every lane through that one kit. So
     the same sentence that made the fx chips a `<select multiple>` makes this
     one a plain single `<select>`: a multiselect offering one legal answer is a
     worse lie than the checkboxes were. The drummer hired above is still on the
     record; his tab is where the control lives. */
  await p.evaluate(() => {
    const t = document.querySelector('[data-k="tabkit"]');
    if (t) t.click();
  });
  await p.waitForTimeout(250);
  await facet("facet-inst");              // the machine is what the kit IS
  const dk = await p.evaluate(() => {
    const f = document.querySelector('.nu-sheet[data-sheet^="sound.drumkit"]');
    const s2 = document.querySelector('select[data-sel^="sound.drumkit"]');
    return { sheet: !!f, sheetMulti: f ? f.hasAttribute("data-multi") : null,
             menu: !!s2, multiple: s2 ? s2.multiple : null,
             n: s2 ? s2.options.length : 0,
             name: s2 ? s2.getAttribute("aria-label") : null };
  });
  // NOT A MULTISELECT, ANYWHERE. This half is the rule and it holds on every
  // page that draws the control at all.
  check(!dk.sheetMulti && dk.multiple !== true,
    "the drum kit allows exactly one answer, and says so " + JSON.stringify(dk));
  // ...AND ON THE SHIPPED PAGE IT IS A MENU. The sheets harness imports
  // ui/sheets.js directly and by design — it is the sheets tier's own page and
  // knows nothing about ui/selects.js's router, which is what converts this
  // control. So "it is a <select>" is index.html's claim to answer.
  if (REAL)
    check(dk.menu && !dk.sheet, "...and on the shipped page it is a single " +
      "<select>, not a sheet " + JSON.stringify(dk));
  else notes.push("     (the drum kit's WIDGET is ui/selects.js's router, which " +
    "this harness does not import — index.html only)");

  /* ---- 5 modal harmony has no changes ----
     THE SUBJECT MOVED WIDGET, THE LAW DID NOT. Paul asked for the chord quality
     back as "selects inside the 'the changes' table" (2026-08-24), so on
     nukernel/index.html this is a disabled <select> carrying `data-why` and on
     the sheets harness it is still a disabled <fieldset> carrying a
     `<p class="nu-why">`. Both are held to the same sentence, because the
     sentence is the point: kernel.js:671 throws the progression away under a
     modal harmony and every quality is then a word about nothing. */
  // ON THE KEY TAB (2026-08-27): "the changes" is the Alphabet axis, which is
  // Paul's `Key`, and the quality menus are cells of its chord table.
  if (REAL) await openTop("Key");
  const qual = await p.evaluate(() => {
    const f = document.querySelector('.nu-sheet[data-sheet^="alphabet.quality"]');
    if (f) { const w = [...f.children].find((c) => c.classList.contains("nu-why"));
             return { as: "sheet", off: f.disabled, why: w ? w.textContent : null }; }
    const s = document.querySelector('select[data-sel^="alphabet.quality"]');
    return s ? { as: "menu", off: s.disabled, why: s.dataset.why || null } : null;
  });
  check(!!qual && qual.off && /modal harmony has no changes/.test(qual.why || ""),
    "modal harmony -> alphabet.quality disabled (as a " + (qual && qual.as) +
    ") reading " + JSON.stringify(qual && qual.why));

  /* ---- 6 a pad may not be transposed, but it may be silenced ---- */
  // STAND ON A VOICE'S TAB FIRST. This asked for `cast.part` on whatever the
  // page happened to be showing and got nothing: the band block lands on the
  // FORM tab (`eight.js:598` — the form is a tab of its own now), and gate 4
  // above then walked the page onto the DRUMS tab by hiring a drummer, which
  // has no `cast.part` sheet at all. The gate read `undefined` and called the
  // page broken while the page was right. Click the first line voice's tab,
  // the way a thumb would, and the sheets this section is about exist.
  if (REAL) await openTop("Band");
  await p.evaluate(() => {
    const v = window.__D().voices.find((x) => x.kind === "line");
    const t = v && document.querySelector('[data-k="tab' + v.name + '"]');
    if (t) t.click();
  });
  await p.waitForTimeout(200);
  // ...AND ON ITS PER-SECTION FACET, 2026-08-28, for the same reason gate 4
  // above names one: `dev.line` is a per-SECTION word and a voice draws one
  // facet at a time now. `cast.part` — the word this gate SAYS — is on the
  // `plays` facet, so the three reads below each stand where their control is.
  await facet("facet-sec");
  // ...AND READ THE WORDS BEFORE ANYTHING IS SAID, so "8 greyed" is evidence
  // about the pad rather than about the record it happened to be measured on.
  const padWas = (await p.evaluate(() => {
    const rows = [];
    for (const f of document.querySelectorAll('.nu-sheet[data-sheet^="dev.line"]'))
      { for (const l of f.querySelectorAll(".nu-opt")) rows.push({ v: l.dataset.v,
          off: l.querySelector("input").disabled }); break; }
    if (rows.length) return rows;
    for (const s2 of document.querySelectorAll('select[data-sel^="dev.line"]'))
      { for (const o of s2.options) rows.push({ v: o.dataset.v, off: o.disabled }); break; }
    return rows;
  })).filter((r) => r.off);
  // SAY "PAD" THROUGH WHICHEVER WIDGET `cast.part` IS. It was a sheet all
  // morning and it is a <select> again this evening (Paul: "in voices -- plays,
  // material, instrument -- dropdowns/selects"), and what this gate is about is
  // neither — it is about what happens to the DEVELOPMENT sheet next door once
  // the voice is a pad. Reaching for the sheet alone made this gate read
  // `undefined` and call the page broken while the page was right, which is the
  // same mistake its own comment above records having made once already.
  await facet("facet-plays");             // `cast.part` is what it PLAYS
  await p.evaluate(() => {
    const f = document.querySelector('.nu-sheet[data-sheet^="cast.part"]');
    const i = f && f.querySelector('.nu-opt[data-v="pad"] input');
    if (i) { i.checked = true; i.dispatchEvent(new Event("change", { bubbles: true })); return; }
    const s = document.querySelector('select[data-sel^="cast.part"]');
    if (s) { s.value = "pad"; s.dispatchEvent(new Event("change", { bubbles: true })); }
  });
  await p.waitForTimeout(200);
  await facet("facet-sec");               // ...and the words it greys are per-section
  /* READ THE LAW OFF THE PAGE, NOT ONE WORD OFF A TABLE THAT IS DERIVED.
     WAS: `a pad's \`at the fifth\` is disabled and \`out\` is not`. That was
     true when it was written and it is stale for a reason worth keeping: the
     option table is EXTRACTED, never typed (gates.json is generated), and
     gates-extract no longer fits any rule to `at the fifth` — transposing a
     pad up a fifth is still audible, so nothing greys it. Naming one word made
     this gate an assertion about the extractor's output rather than about the
     design. It failed on BOTH pages, and the page was right on both.

     What the design says is the sentence fields.js prints in the greys: "a pad
     voices the chord, it does not follow a line". So: before the change NOT ONE
     of the twenty-six words is greyed at all; after it, some are, every one of
     them says that sentence in its own text, and `out` — silence, which any
     voice may always be told to do — is never among them. Measured 2026-08-25, identically on
     index.html and on the harness: 8 words grey (the head only · fading ·
     filled in · down a degree · in wider steps · at the fourth · below, at the
     fifth · the rhythm, moved) and `out` stays live. */
  const PADWHY = "a pad voices the chord, it does not follow a line";
  const padRead = () => p.evaluate(() => {
    const rows = [];
    for (const f of document.querySelectorAll('.nu-sheet[data-sheet^="dev.line"]'))
      { for (const l of f.querySelectorAll(".nu-opt")) rows.push({ v: l.dataset.v,
          off: l.querySelector("input").disabled,
          why: (l.querySelector(".nu-why") || {}).textContent || "" }); break; }
    if (rows.length) return rows;
    for (const s2 of document.querySelectorAll('select[data-sel^="dev.line"]'))
      { for (const o of s2.options) rows.push({ v: o.dataset.v, off: o.disabled,
          why: o.dataset.why || "" }); break; }
    return rows;
  });
  const padOn = await padRead();
  const padGrey = padOn.filter((r) => r.off);
  const padSays = padGrey.filter((r) => r.why.includes(PADWHY));
  const padOut = padOn.find((r) => r.v === "out");
  check(padWas.length === 0 && padGrey.length > 0 &&
        padSays.length === padGrey.length,
    "a pad greys " + padGrey.length + " development words (0 before the tap) " +
    "and every one of them says why in its own text: " +
    JSON.stringify(padGrey.map((r) => r.v)));
  check(!!padOut && !padOut.off,
    "...and `out` is never one of them — a pad may always be told to sit out");

  /* ---- 7 the standing answer is always offered ---- */
  const standing = await p.evaluate(() => {
    const d = window.__D();
    const v = d.voices.find((x) => x.kind === "line");
    for (const s of d.form.sections) v.development[s.id] = "at the fifth";
    return true;
  });
  // ...and the same redraw, through whichever widget it is (see gate 6).
  // ...AND A FACET TAP IS ITSELF A REDRAW, 2026-08-28: `cast.part` is on the
  // `plays` facet and gate 6 above leaves the page on `sec`, so the trip out
  // and back is both the way to reach the control and the redraw this needs.
  await facet("facet-plays");
  await p.evaluate(() => {
    const i = document.querySelector('.nu-sheet[data-sheet^="cast.part"] .nu-opt[data-v="pad"] input');
    if (i) { i.dispatchEvent(new Event("change", { bubbles: true })); return; }
    const s = document.querySelector('select[data-sel^="cast.part"]');
    if (s) { s.dispatchEvent(new Event("change", { bubbles: true })); return; }
    if (window.__draw) window.__draw();
  });
  await p.waitForTimeout(200);
  await facet("facet-sec");
  // ...THROUGH WHICHEVER WIDGET, for the reason gate 5 gives. WAS: the sheet
  // branch alone, which found nothing on the shipped page and read `null` —
  // "the standing answer is gone" — while the answer was sitting selected in a
  // <select> one line away.
  const stand = await p.evaluate(() => {
    for (const f of document.querySelectorAll('.nu-sheet[data-sheet^="dev.line"]')) {
      const l = f.querySelector('.nu-opt[data-v="at the fifth"]');
      if (!l) continue;
      const i = l.querySelector("input");
      if (i.checked) return { as: "sheet", off: i.disabled,
        why: (l.querySelector(".nu-why") || {}).textContent || null };
    }
    for (const s2 of document.querySelectorAll('select[data-sel^="dev.line"]')) {
      const o = [...s2.options].find((x) => x.dataset.v === "at the fifth");
      if (!o || !o.selected) continue;
      return { as: "menu", off: o.disabled || s2.disabled, why: o.dataset.why || null };
    }
    return null;
  });
  check(!!stand && !stand.off,
    "THE STANDING ANSWER IS ALWAYS OFFERED (band-kit.js:3956) — " + JSON.stringify(stand));

  /* ---- 8 arrow traversal moves the value AND the focus key ----
     ON A DEVELOPMENT SHEET, WHICH IS THE ONE THIS ARGUMENT WAS ABOUT. This
     stood on `alphabet.mode` — a fine radio group, and as of 2026-08-24 a
     <select> again, where ArrowDown is the browser's own behaviour and proves
     nothing about this file. The claim being made is the one in sheets.js's
     header: "a radio group is ONE tab stop with arrow-key traversal", and the
     sheets that are left to make it are the development words, so it is made on
     one of those. Same two assertions, same key: the value moves in the record
     and `activeElement.dataset.k` moves with it. */
  /* ...AND THEN THE DEVELOPMENT WORDS BECAME MENUS TOO, WHICH TOOK THE LAST
     RADIO-GROUP SHEET OFF THE SHIPPED PAGE. See gate 1: a single-choice
     control is a `<select>` now, and `alphabet.mode` was only the first of
     them. Measured 2026-08-25 on nukernel/index.html, walking every tab: the
     ONLY `.nu-sheet` left anywhere is the engineer's `eng.fx|<voice>` chips,
     which is a `<select multiple>` and has no radio in it. (That one sheet
     became `master.fx` under the board on 2026-08-26, and on 2026-08-27 Paul
     retired it — *"We can get rid of Character right?"* — so the count is ZERO
     now. The sentence the measurement was making is unchanged and is the
     stronger for it: not one radio-group sheet is left to traverse anywhere on
     the shipped page.) `devKey` came back
     null, `readDev` did `null.split("|")` and the whole gate CRASHED at
     line 404 — asserting nothing, including the twenty-odd checks after it.

     Two things follow and both are done. HERE: the crash is a guard, and on
     the shipped page the assertion is the reversal stated as a truth — there
     is no roving-tabindex radio group left, and that is the design. THERE:
     ui/sheets.js still implements one and the sheets HARNESS still draws
     thirty of them, so test/all.js runs this same file a second time against
     `test/fixtures/sheets-harness.html` (the `sheets-tier` gate) and the
     traversal claim keeps being made where it is still true. A claim that only
     ever skips is a claim nobody is making. */
  const devKey = await p.evaluate(() => {
    const f = document.querySelector('.nu-sheet[data-sheet^="dev.line"]');
    return f ? f.dataset.sheet : null;
  });
  const radioSheets = await p.evaluate(() =>
    [...document.querySelectorAll(".nu-sheet:not([data-multi])")].map((f) => f.dataset.sheet));
  const readDev = (k) => p.evaluate((k) => {
    const [, voice, section] = k.split("|");
    const v = window.__D().voices.find((x) => x.name === voice);
    return { w: String((v && v.development[section]) || ""),
             k: document.activeElement && document.activeElement.dataset.k };
  }, k);
  await p.evaluate((k) => {
    const f = document.querySelector('.nu-sheet[data-sheet="' + k + '"]');
    const on = f && f.querySelector("input:checked");
    if (on) on.focus();
  }, devKey);
  if (!devKey) {
    check(REAL && !radioSheets.length,
      "no radio-group sheet is left to traverse — every single-choice control " +
      "is a <select>, whose ArrowDown is the browser's own. Still drawn as " +
      "single-choice sheets: " + JSON.stringify(radioSheets) +
      "  (the traversal claim is asserted on the sheets harness — test/all.js " +
      "`sheets-tier`)");
  } else {
    const kb0 = await readDev(devKey);
    await p.keyboard.press("ArrowDown");
    await p.waitForTimeout(200);
    const kb1 = await readDev(devKey);
    check(kb0.w !== kb1.w, "ArrowDown moved the document value on " +
      devKey + ": " + JSON.stringify(kb0.w) + " -> " + JSON.stringify(kb1.w));
    check(!!kb1.k && kb1.k !== kb0.k, "ArrowDown moved activeElement.dataset.k " +
      kb0.k + " -> " + kb1.k);
  }

  /* ---- 8b THE STANDARD MULTISELECT, AND NOTHING LEFT PRETENDING TO BE ONE ----
     (Paul, 2026-08-24: "Wherever we allow multiple selections use a standard
     multiselect form element please.")

     test/selects.js drives this control — picks three chips, forces a fourth,
     reads the refusal. What is held HERE is the sheets tier's own half: a
     `multi` sheet is still a <fieldset> with a <legend> and a whole-control
     `.nu-why`, its answers are inside ONE `<select multiple>`, and there is not
     a checkbox left in any sheet on the page. The drum step grid is NOT one of
     these and never was — it is a grid of independent steps, one column each —
     and it keeps its boxes. A line voice's tab is up from gate 6. */
  const ms = await p.evaluate(() => {
    const q = (x) => [...document.querySelectorAll(x)];
    return {
      n: q("fieldset.nu-sheet[data-multi]").length,
      bad: q("fieldset.nu-sheet[data-multi]").map((f) => {
        const sels = f.querySelectorAll("select[multiple]");
        return { key: f.dataset.sheet,
                 legend: !!(f.querySelector("legend") || {}).textContent,
                 sels: sels.length,
                 boxes: f.querySelectorAll("input[type=checkbox]").length,
                 size: sels.length ? sels[0].size : 0,
                 opts: f.querySelectorAll("option").length };
      }).filter((r) => !r.legend || r.sels !== 1 || r.boxes || r.size < 2 || !r.opts),
      inSheet: q("fieldset.nu-sheet input[type=checkbox]").length,
      grid: q(".nu-grid input[type=checkbox]").length,
      kcs: q(".nu-grid .nu-kc").length,
      // NO SILENT GREY, in the shape an <option> can carry it: the reason is in
      // the option's own words and stamped as data, exactly as ui/selects.js
      // does it, because a `<small class="nu-why">` cannot ride inside an
      // <option>.
      greyNoWhy: q("fieldset.nu-sheet[data-multi] option:disabled")
        .filter((o) => !(o.dataset.why || "").trim()).map((o) => o.value),
      greyNotSaid: q("fieldset.nu-sheet[data-multi] option:disabled")
        .filter((o) => o.dataset.why && !o.textContent.endsWith(", " + o.dataset.why))
        .map((o) => o.value),
    };
  });
  /* ...ON THE PAGE THAT STILL HAS ONE, 2026-08-27. This was unconditional and
     the shipped page's only multiselect was `master.fx` — the record's
     Character chips, which Paul retired that day ("We can get rid of Character
     right?"; the chain is dealt to the strips' own `<select>` slots). A claim
     that the SHIPPED page must contain a multiple-selection control was never
     the point: what this gate owns is that WHERE one is drawn it is a legend
     plus one `<select multiple>` and never a row of checkboxes, and that is
     asserted on the next line, on both pages. The count keeps being made on
     the sheets HARNESS, which draws thirty of them and is where the tier's own
     traversal claims live — the same split the radio-group reversal took at
     line 645. */
  if (!REAL) check(ms.n > 0, ms.n + " multi sheet(s) drawn — the page has somewhere " +
    "to allow multiple selection");
  else notes.push("     (the shipped page draws no <select multiple> since " +
    "Character was retired, 2026-08-27 — the harness carries the count)");
  check(!ms.bad.length, "every multi sheet is a legend + ONE <select multiple> of at " +
    "least two rows, with no checkbox in it " + JSON.stringify(ms.bad.slice(0, 3)));
  check(!ms.inSheet, "no checkbox survives inside any sheet " + ms.inSheet);
  /* REWRITTEN 2026-08-27, per the reversal law. This held "the drum step grid
     still has its N checkboxes — a grid of independent steps is not a multiple
     choice". THE FACE REVERSED AND THE CLAIM DID NOT: the Bench replaced the
     kit's checkboxes with velocity cells (Paul, 2026-08-27: "velocity 0 to 7"
     — one BUTTON per step whose fill's width is its level; ui/eight.js
     drumGrid, proven on the render by test/bench.test.js B5). What this gate
     still owns is the half that was always its own: the steps stay INDEPENDENT
     CONTROLS — no checkbox is left in any grid, and no grid was folded into a
     <select multiple> to satisfy the sheet law above. */
  if (REAL || ms.grid || ms.kcs)
    check(ms.grid === 0, "...and the drum step grid's checkboxes are gone — " +
      "its steps are independent velocity cells now (" + ms.kcs +
      " .nu-kc drawn on this tab, " + ms.grid + " checkboxes left)");
  else notes.push("     (the step grid is ui/eight.js's — index.html only)");
  check(!ms.greyNoWhy.length && !ms.greyNotSaid.length,
    "NO SILENT GREY — every disabled <option> says its reason in its own text " +
    JSON.stringify({ noWhy: ms.greyNoWhy, notSaid: ms.greyNotSaid }));

  /* ---- 9 with the stylesheet off it still reads as the same document ---- */
  const off = await p.evaluate(() => {
    for (const s of document.styleSheets) try { s.disabled = true; } catch (e) {}
    const whys = [...document.querySelectorAll(".nu-why")].map((w) => w.textContent.trim());
    const t = document.body.innerText;
    return { n: whys.length, missing: whys.filter((w) => w && !t.includes(w)).slice(0, 3) };
  });
  const s1 = await silent();
  check(!off.missing.length && !s1.opt.length && !s1.sheet.length,
    "with the stylesheet off, all " + off.n +
    " reasons are still in body.innerText and nothing is silently grey " +
    JSON.stringify({ missing: off.missing, opt: s1.opt, sheet: s1.sheet }));

  check(!errs.length, "zero console errors / pageerrors " + JSON.stringify(errs.slice(0, 3)));

  for (const n of notes) console.log(n);
  for (const f of fails) console.log(f);
  console.log(fails.length ? "\nFAILED " + fails.length + " of " +
    (fails.length + notes.length) : "\nALL PASS (" + notes.length + " checks)  " + PAGE);
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
