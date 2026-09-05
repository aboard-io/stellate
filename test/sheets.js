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
const CHANT = "#at=Rome&y=600&s=1";   // the shipped chant, named (2026-09-02)
const { chromium } = require("playwright");
const { installCombo } = require("./lib-combo.js");
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
 * `prod.word` and `prod.record` are also the only sheets on the page with
 * NOTHING checked, and that is what they mean: nothing has been said yet.
 * (It read "`prod.verb` and the two after it" until 2026-09-01, when the verb
 * sheet was deleted — Paul: "The only verb is 'make' from now on. Make X Y." —
 * and "`prod.scope` and the ones after it" until 2026-09-02, when the scope
 * became the cast's chip row and left this registry with it.)
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
  /* `prod.scope` — "who it is being said about (page state)" — is DELETED,
     2026-09-02, in the same commit as the widget, exactly as `prod.verb` was
     the day before it (Paul, COMPOSER.md §1 B12: "The implementation is good
     but the design is confusing and feels unconsidered. Design a good producer
     interface."). The producer's cast is a wrapped ROW OF CHIPS now — one
     `<button data-k="cast|<id>">` per cast row, one pressed — and this
     registry declares LIT SHEETS: it is read by a walk over `.nu-sheet`
     elements, so a key hung on a `<div class="nu-row">` of buttons would make
     it describe a widget that is not on the page. The chips are addressed the
     way every other strip of buttons on this page is, and are held by
     test/producer.browser.js P0 (they exist, they carry the cast) and by
     test/text-diet T3 (a greyed one carries its reason). */
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
  /* ===== THE BOX BOOTS ON THE BLANK STATE NOW (2026-09-02) ================
     Paul, the composer round: *"Add a 'silence' genre at the top of the genre
     list. This is a blank state."* The box opens on `silence` — one eight-bar
     section, ZERO voices, one cell of rests — instead of on a copy of the
     shipped chant, because a box that opened playing somebody else's record was
     answering a question nobody had asked yet.
     THIS GATE IS ABOUT A RECORD WITH A BAND IN IT, so it asks for one, in the
     address, the way a link does: `#at=Rome&y=600&s=1` is the shipped chant —
     the very `songs.js TERMS` this file used to inherit from the boot — named
     rather than assumed. `s=1` because the boot draws a seed now (Paul: *"Boot
     up every new session with a new seed unless there's a seed in the URL"*) and
     a gate that re-rolled its own subject would measure a different record every
     run. Naming the fixture is the honest half of the change: what this file
     asserts about "the record" is now a claim about a record it chose. */
  await p.goto(PAGE + CHANT, { waitUntil: "networkidle" });
  await p.waitForFunction(() => document.querySelectorAll(".nu-sheet").length > 0,
    null, { timeout: 20000 }).catch(() => {});

  await p.evaluate((v) => { window.__viewSheets = v; }, VIEW_SHEETS);

  // THE DOCUMENT, whichever page this is. The real page publishes __eightDoc;
  // the harness publishes __doc. A gate that only knew one of them would be a
  // gate that could not run until somebody else's serial pass had landed.
  await p.evaluate(() => { window.__D = window.__eightDoc || window.__doc; });

  /* ---- THE GATE'S OWN READER FOR A COMBO BOX (2026-09-02) ---------------
     Paul, after using the composer: *"The combo boxes just don't work and are
     confusing. I was expecting more of onfocus show custom dropdown then
     filter based on input — one line instead of two."* Every single-choice
     control ui/selects.js draws is one widget now — an `<input role=combobox>`
     carrying `data-sel`/`data-k`/`data-v`, with a `<ul role=listbox>` beside it
     that is ALWAYS in the DOM and `hidden` until a hand opens it.

     THIS FILE'S SHAPE IS UNCHANGED AND THAT IS THE POINT. Every check below
     already read its subject "through whichever widget it is" — a lit sheet or
     a menu — because this file has survived that reversal twice. A combo box
     is the third widget and it needs the same two verbs the other two needed:
     WHAT WORDS DOES IT OFFER, and SAY ONE. They are installed on the page once,
     here, as the GATE's helper and not the page's: nothing in nukernel/ reads
     `window.__combo`, and putting it here rather than repeating six copies of
     the same three lines inside six `evaluate` bodies is the one-owner law
     applied to a test.

     `say()` opens the list the way a thumb does and taps the `li`, falling
     back to writing the option's VALUE and firing `change` — the gesture this
     file made at a `<select>`, which ui/selects.js answers deliberately and
     says so at its own listener ("A SYNTHETIC `change` IS A COMMIT").

     ...AND IT IS NO LONGER WRITTEN HERE, 2026-09-02 (later the same day). The
     copy that stood in this block was the first one, and within hours three
     more gates needed the same three lines — test/tempo-key.browser.js,
     test/nudges.js and test/band.browser.js, all three of which had gone
     silently vacuous on `select[data-sel=…]`. Four copies of a driver is four
     ways to be wrong about one widget, so it moved to test/lib-combo.js and
     this file requires it from there. `window.__combo`'s shape is unchanged;
     `words()` gained a `w` (the option's printed word) and nothing lost a
     field. */
  await installCombo(p);

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
  /* ...AND IT FOLDS THE TREE FIRST, 2026-09-02. Paul: *"we should really work
     hard on nesting options inside the left nav … We should never need the
     'up' icon because we can expand multiple levels of interface option."*
     Branches STAY OPEN now, and a mark is a TOGGLE — tapping the member you
     are already inside folds it. This walk taps the same member row several
     times (once per facet), so without a known starting shape the second tap
     would close what the first opened and every facet after the first would
     find no button. `__eightUp()` is "fold everything", which is the gesture a
     hand makes to get back to the tabs, and it makes each view's route
     deterministic: fold, open the tab, open the member, open the facet. */
  /* ...AND `Time` AND `Rules` ARE NOT TABS ANY MORE (2026-09-06,
     nukernel/TABLE.md §10b): each is a MERGED ROW at the top of the Band
     table's own sheet, so the door is `__eightRow`, which opens Band and
     presses the row's head — a hand's two taps, and idempotent, so a second
     arrival does not close what the first opened. Every `#pan-band` /
     `#rulesdeck` selector below is the same selector inside `#pan-band`. */
  const openTop = async (t) => {
    if (t === "Time" || t === "Rules") {
      await p.evaluate((x) => window.__eightRow(x), t.toLowerCase());
      await p.waitForTimeout(700); return; }
    await p.evaluate((tt) => { if (window.__eightUp) window.__eightUp();
                               window.__eightTab(tt); }, t);
    await p.waitForTimeout(t === "Score" ? 1200 : 300);
  };
  const views = REAL ? [] : [null];
  if (REAL) for (const t of TOPS) {
    /* ...AND `Structure` IS THE OTHER TAB WITH A LEVEL IN IT (2026-09-02).
       Paul: *"Sections/Structure … should be top level, not buried under band
       … Every section I can tweak every instrument."* A section's own
       questions — the `form.*` menus and the per-member `dev.*` words — are
       one tap further in, exactly as a voice's facets are, and a survey that
       stopped at the section LIST would see the form and none of the words.
       This is `if (t === "tabform")`'s second tap, moved to the tab that owns
       the sections. */
    if (t !== "Band") { views.push({ top: t, k: null }); continue; }
    /* ...AND THE SECTIONS ARE `Band`'s OWN BRANCH SINCE 2026-09-04 (TABLE.md
       wave 2c). `if (t === "Structure")` stood above this line and pushed the
       section LIST and one section's questions; the Structure tab is deleted
       and the sections are the TABLE's rows, so the same two views are pushed
       from inside the Band walk below — the row list is the table itself and a
       section's questions are its row sheet. */
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
    /* ...AND OFF THE TABLE'S OWN COLUMN HEADS SINCE 2026-09-09. The gutter is
       deleted (TABLE.md §10b step 7), so `#nu-tray [data-k^="tab"]` is a query
       against nothing. A player's head is `tcol|<name>` and it opens the same
       sheet the stripe's row jumped to, which is what every line below wants;
       the keys are read off the rendered heads rather than typed, exactly as
       they were read off the stripe. */
    const voices = await p.evaluate(() =>
      [...document.querySelectorAll('#pan-band th.nu-colhead button[data-k^="tcol|"]')]
        .map((n2) => n2.dataset.k));
    /* ...AND A VOICE IS THREE FACETS SINCE 2026-08-28. Paul: *"A voice has:
       Instrument voice with settings from the mixer / What it plays, register,
       material / Per-section settings."* The band panel draws exactly the facet
       you are standing on (ui/eight.js `voiceFacet`), so a survey that stopped
       at the voice's own mark saw its instrument and neither of the other two
       — and every `dev.*` claim in this file went red for want of a tap, not
       for want of a control. The facet keys are read off the stripe rather than
       typed, exactly as the voice keys above are; a voice with none (the form
       and performance marks) yields the single view it always did. */
    views.push({ top: t, sec: 1 }, { top: t, cell: 1 });
    for (const k of voices) {
      views.push({ top: t, k });
      // BACK TO THE BAND LEVEL BEFORE EACH ONE. A mark DESCENDS since
      // 2026-08-28 — `tabform` opens the sections, a voice opens its facets —
      // so a loop that tapped the next key without coming up first would be
      // asking for a button that is one level above where it is standing, and
      // `tapK` would answer false for every voice after the first.
      await openTop(t);
      await tapK(k);
      /* (THE FACETS WENT ON 2026-09-04 with the pane that switched between
         them — a voice is ONE VECTOR and its column sheet asks all of it at
         once — so this has answered `[]` since then and answers `[]` against a
         deleted gutter for the same reason. Kept as the empty list it is, so
         the loop below still reads as "every facet this voice has".) */
      const facets = [];
      for (const f of facets) views.push({ top: t, k, f });
    }
  }
  /* ...AND A COLUMN'S SHEET, WHICH IS WHERE A SEAT LIVES NOW (2026-09-04,
     TABLE.md wave 2b). The Band pane WAS a voice's four facets and one of
     them, `mix`, drew that voice's channel strip; the Band pane is the TABLE
     now and a voice is a COLUMN, whose head opens the whole VOICE vector with
     the strip in it (ui/table.js seats `voiceMix` there).
     IT IS NOT THE BOARD, and this file is why that is known: the first draft
     of test/table-inventory.json filed the seat as "elsewhere: the board" and
     this check went red at zero seats within the hour — the board has bus
     strips and no per-voice channel at all, because Paul took the voices off
     it on 2026-08-28. A control with no home is what T7 refuses and what this
     line measures. `pane` is a tap INSIDE the panel rather than on the
     stripe, which is what a column head is. */
  if (REAL) views.push({ top: "Band", pane: "thead .nu-colbtn" });
  /* ...AND THE MIX ROW'S CELL, WHICH IS WHERE A SEAT LIVES SINCE 2026-09-07
     (TABLE.md §10b step 3). The paragraph above is kept because every word of
     its argument still holds — the seat is NOT the board's, and this file is
     what proved it — but §10a gives the strip a row of its own: *"MIX is
     ALIGNED — one channel strip per voice column"*, so the head that opens it
     is `tmix|<voice>` in the footer and the column sheet draws no strip at
     all. Same `voiceMix`, same three `ins|<voice>|<n>` seats; a different
     `<td>`. */
  if (REAL) views.push({ top: "Band", pane: 'tfoot .nu-mixrow [data-k^="tmix|"]' });
  const eachView = async (fn) => {
    const out = [];
    for (const v of views) {
      if (v) {
        await openTop(v.top);
        if (v.sec) await p.evaluate(async () => {
          /* THE SECTION IS THE TABLE'S OWN ROW HEAD SINCE 2026-09-09. */
          const s2 = document.querySelector(
            '#pan-band th.nu-srowh button[data-k^="trow|"]');
          if (s2) { s2.click(); await new Promise((r) => setTimeout(r, 300)); }
        });
        if (v.sec) await p.waitForTimeout(350);
        /* ...AND A CELL, which is where the per-section `dev.*` and
           `material.cell` questions live since 2026-09-04 (TABLE.md §1's cell
           tier). Without this view every development word drops out of the
           census and the "one control per address" checks below start passing
           for want of a control. */
        if (v.cell) { await p.evaluate(async () => {
          if (!window.__eightDoc) return;
          const D = window.__eightDoc();
          const vv = D.voices[0], s2 = D.form.sections[0];
          if (!vv || !s2) return;
          const c = document.querySelector('#pan-band [data-k="tcell|' + vv.name + '|' + s2.id + '"]');
          /* TWO TAPS SINCE §11: the first selects, the second edits. */
          if (c) for (let i = 0; i < 2 &&
            c.getAttribute("aria-expanded") !== "true"; i++) c.click();
          await new Promise((r) => setTimeout(r, 300));
        }); await p.waitForTimeout(350); }
        if (v.pane) await p.evaluate(async (sel) => {
          const b = document.querySelector("#pan-band " + sel);
          if (b) { b.click(); await new Promise((r) => setTimeout(r, 300)); }
        }, v.pane);
        if (v.k) {
          await tapK(v.k);
          if (v.f) await tapK(v.f);
          /* `tabform` LEFT THE BAND LEVEL (2026-09-02, Structure): the
             sections are a tab of their own, so no view in this walk is "the
             form" any more and this line has nothing to open. The per-section
             controls are reached by `openDoes()` above, where they are
             needed. */
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
    /* A MENU IS A COMBO BOX OR A `<select multiple>` (2026-09-02). The query
       read `#app select`, which after the reversal finds only the strips'
       insert seats and the one multiselect — so `devMenu` came back empty and
       this gate would have reported "the development words are gone" about a
       page where every one of them is drawn. `rogue` is unchanged in what it
       refuses: an anonymous menu with no `data-sel`, whichever element it is
       made of. */
    menus: [...document.querySelectorAll("#app select, #app [role=combobox]")]
      .map((s) => s.dataset.sel || "(no data-sel: " +
        (s.dataset.k || s.outerHTML.slice(0, 40)) +
        (s.closest(".nu-strip") ? " IN A STRIP" : "") + ")"),
    sheetKeys: [...document.querySelectorAll("#app .nu-sheet")].map((f) => f.dataset.sheet),
    // the word grids' cells (2026-09-02): the sheet key is the cell's `data-k`
    cellKeys: [...document.querySelectorAll("#app .nu-wcell[data-k]")]
      .map((c) => c.dataset.k),
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
  /* ...AND THE SEAT HAS AN ADDRESS NOW, WHICH IS WHY THE COUNT BELOW WAS
     ZERO (fixed 2026-09-07; red since v272's menus round). `seatSelect` passes
     `ins|<voice>|<n>` as BOTH `key` and `k` since it went through
     `src/menus/`, so the seat wears `data-sel="ins|<voice>|<n>"` and the
     "(no data-sel: …)" spelling `SEAT` was written for stopped being produced
     — the filter matched nothing and "the strip that carries them is on the
     page at all" failed on an empty list, saying a strip was missing that was
     standing right there. Both spellings are read now, for the reason
     test/lib-combo.js reads three: a gate that knows one spelling of a control
     is a gate that reports the next widget as a loss. The `rogue` line is
     untouched — an ANONYMOUS menu is still what it refuses. */
  const SEATSEL = /^ins\|[^|]+\|\d+$/;
  const rogue = menus.filter((k) => /^\(no data-sel/.test(k) && !SEAT.test(k));
  const devMenu = menus.filter((k) => /^dev\./.test(k));
  const devSheet = sheetKeys.filter((k) => /^dev\./.test(k));
  /* ...AND A THIRD WIDGET, 2026-09-02 (wave 4). Paul, after using the composer:
     *"When we go into structure make those tables of dropdowns full of tappable
     grids that change options rather than dropdowns — like the other selection
     table in mix … institutionalize it."* So a per-section word is neither a
     sheet nor a menu now: it is a CELL in a `ui/wordgrid.js` table, carrying
     the sheet's own address as its `data-k` and offering its words in a strip
     that opens under the row. The claim below is unchanged in substance — a
     development word is a SINGLE-CHOICE control drawn as one control, never
     half-converted into two — so it counts cells beside menus and still refuses
     any key drawn two ways at once. */
  const cellKeys = union(widgets, "cellKeys");
  const devCell = cellKeys.filter((k) => /^dev\./.test(k));
  /* A MULTI SHEET IS A FIELDSET AROUND ITS OWN `<select multiple>` and the two
     share a key by construction (ui/sheets.js draws `multi` that way since
     Paul, 2026-08-24: "Wherever we allow multiple selections use a standard
     multiselect form element please."). That is the shape gate 8b holds, not a
     half-finished conversion, so it is not what this line is looking for. */
  const multiKeys = union(widgets, "multiKeys");
  const bothWays = menus.filter((k) =>
    sheetKeys.includes(k) && !multiKeys.includes(k))
    .concat(menus.filter((k) => cellKeys.includes(k)))
    .concat(sheetKeys.filter((k) => cellKeys.includes(k) && !multiKeys.includes(k)));
  const seats = menus.filter((k) => SEAT.test(k) || SEATSEL.test(k));
  check(!rogue.length, "every <select> in #app came from ui/selects.js, or is " +
    "an insert SEAT on a channel strip (" + seats.length + " of those — " +
    "ui/engineer.js `seatSelect`, named and driven by desk-gate G11/G14/G15) " +
    JSON.stringify(rogue.slice(0, 3)));
  /* SCOPED TO THE SHIPPED PAGE, 2026-09-02. This ran on both entry points and
     was RED on the harness from the day it was written: the sentence it makes
     — "the voices' `mix` facet is one of the views this survey walks" — is
     only true of nukernel/index.html, and this file's own header says what to
     do about that ("a harness that cannot draw them must say 'not here'
     rather than 'broken'"). test/fixtures/sheets-harness.html loads nine data
     files and no view module; its own comment at :69 says so in as many
     words: "the engineer is not in this harness". So the claim is unchanged
     and unweakened where it can be made, and the harness says not-here — the
     `REAL` branch three lines down is the same idiom for the same reason.
     (Found by slice 2a, which changed avail.js and had to know whether it had
     caused this; measured red on HEAD before the slice, at 29 of 30.) */
  if (REAL)
    check(seats.length > 0, "…and the strip that carries them is on the page at " +
      "all: the MIX ROW'S OWN CELL is one of the views this survey walks (the " +
      "seat's home since 2026-09-07, §10b step 3), so a strip that " +
      "stopped being drawn fails here rather than passing quietly " +
      JSON.stringify(seats.slice(0, 3)));
  else notes.push("     (no channel strips here — the engineer is not in this " +
    "harness, so the insert seats are index.html's claim, above)");
  check(!bothWays.length, "no key is drawn two ways at once — sheet, menu or " +
    "word-grid cell, one control per address " +
    JSON.stringify(bothWays));
  if (REAL)
    check(devMenu.length + devCell.length > 0 && devSheet.length === 0,
      "EVERY DEVELOPMENT WORD IS ONE CONTROL — " + devMenu.length +
      " menus, " + devCell.length + " word-grid cells, and " +
      devSheet.length + " still drawn as a sheet " + JSON.stringify(devSheet));
  else notes.push("     (which widget a development word gets is ui/selects.js's " +
    "router, which this harness does not import — index.html only)");

  /* ---- 1b A SINGLE-CHOICE ROW IS A COMBO BOX, NOT A `<select>` ---------
     (Paul, 2026-09-02: "The combo boxes just don't work and are confusing. I
     was expecting more of onfocus show custom dropdown then filter based on
     input — one line instead of two.")

     THE OTHER HALF OF GATE 1, AND THE ONE A HALF-APPLIED REVERSAL WOULD LEAVE
     BEHIND. Gate 1 says every menu in `#app` is one ui/selects.js drew; this
     says what ui/selects.js draws is the widget that was decided on. A
     `<select>` inside `#app` is now exactly two things and both are named: the
     one `<select multiple>` a multi sheet owns (`data-multi`, gate 8b's
     subject) and the channel strips' insert seats (`ins|…`, desk-gate
     G11/G14/G15's). Anything else means a control did not convert — which is
     the shape this file's own note calls "the hole a half-finished conversion
     falls into". */
  const stragglers = await eachView(() => ({
    left: [...document.querySelectorAll("#app select")]
      .filter((s2) => !s2.multiple && !/^ins\|/.test(s2.dataset.k || ""))
      .map((s2) => s2.dataset.sel || s2.dataset.k || s2.outerHTML.slice(0, 40)),
    combos: [...document.querySelectorAll("#app [role=combobox][data-sel]")]
      .map((s2) => s2.dataset.sel),
  }));
  const left = union(stragglers, "left");
  const combos = union(stragglers, "combos");
  check(!left.length, "every single-choice control ui/selects.js draws is a " +
    "combo box — " + combos.length + " of them; <select>s still standing " +
    "outside a multi sheet and the strips' insert seats: " +
    JSON.stringify(left.slice(0, 5)));
  if (REAL)
    check(combos.length > 0, "…and there are some (" + combos.length +
      " combo boxes across the walk), so the line above is not passing on an " +
      "empty page");
  else notes.push("     (which widget a single choice gets is ui/selects.js's " +
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
    // `tcol-add|drums` SINCE 2026-09-05 (TABLE.md §9a, "no op lives in the
    // nav"): `adddrums` was a row in the stripe's Band branch and the offer is
    // the adder cell at the end of the table's player axis now, at the address
    // the T7 inventory filed it onto. The tab still has to be open, for the
    // same reason as before — the Band PANE is where the table is drawn.
    /* ...AND THE `+` IS THE OFFER SINCE 2026-09-05 (TABLE.md §13e, Paul:
       *"Don't pop up an interface when I add a section or a voice. Just add
       it."*): the head's `+` CARRIES `tcol-add|drums` on a record with no
       drummer — which is this one — so the address is unchanged and there is
       no sheet to open first. */
    const add = document.querySelector('#pan-band [data-k="tcol-add|drums"]');
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
  /* ===== A VOICE IS ONE SHEET NOW, 2026-09-04 (nukernel/TABLE.md wave 2c) ==
     `facet-inst` / `facet-plays` / `facet-mix` are deleted with the pane they
     switched between: a player is a COLUMN of the Band table and its whole
     vector — what it plays, what it is, its sampler's four words, its seat,
     its throat's knobs, its files — is one sheet, opened by its column head.
     So the three taps this file made are ONE tap, and it is idempotent by
     construction: it opens the sheet only if it is not already open, because a
     second tap on a head FOLDS it (the accordion's own law). The name is kept
     so the call sites still read as the sentence they were making — "the
     machine is what the kit IS", "`cast.part` is what it PLAYS" — which are
     both still true and are now both true in one place. */
  const facet = async (_f) => {
    await p.evaluate(async () => {
      if (!window.__eightDoc) return;
      const D = window.__eightDoc();
      const open = document.querySelector('#pan-band thead [aria-expanded="true"]');
      if (open) return;                       // a sheet is already open
      const names = D.voices.map((v) => v.name);
      for (const n of names) {
        const b = document.querySelector('#pan-band [data-k="tcol|' + n + '"]');
        if (b && b.getAttribute("aria-pressed") === "true") { b.click(); return; }
      }
      const first = document.querySelector('#pan-band thead [data-k^="tcol|"]');
      if (first) first.click();
    });
    await p.waitForTimeout(300);
  };
  /* ...AND THE COLUMN OF A NAMED PLAYER, which is what the walks that switch
     player actually mean. `openVoice` is the page's own one door and the table
     opens that column's sheet on arrival, so this is the gesture rather than a
     second spelling of it. */
  /* IT ASKS THE RECORD FOR THE COLUMN'S NAME, THE WAY `openDoes` ALREADY DOES
     (2026-09-05). `openCol("kit")` was written when eight.js called the
     drummer's voice `kit`; b5ade6b (2026-09-02, wave 3 of the composer) renamed
     him — *"'drums' AND NOT 'kit'… `drums` is the KIND, which is the word the
     gutter's glyph row, the roster's category edge, `devSheetFor` and every one
     of Paul's own sentences ('+ drums') already use"* (eight.js:8839). So
     `#pan-band [data-k="tcol|kit"]` has matched nothing on the shipped page
     since that day, this helper has been a silent no-op at all three call
     sites, and 4b below read a shut sheet and reported the drum kit missing.
     `openDoes` survived the rename because it falls back to the voice whose
     KIND is drums; this one had no fallback, so it gets the same one. The name
     is still the word the call sites say, because it is still the sentence they
     are making — it is just resolved against the document rather than typed
     into a selector. */
  const openCol = async (name) => {
    await p.evaluate(async (n) => {
      if (!window.__eightTab || !n) return;
      window.__eightTab("Band");
      await new Promise((r) => setTimeout(r, 250));
      const D = window.__eightDoc ? window.__eightDoc() : null;
      const v = D && D.voices && (D.voices.find((x) => x.name === n) ||
                                  D.voices.find((x) => x.kind === n) ||
                                  (n === "kit" && D.voices.find((x) => x.kind === "drums")));
      const b = document.querySelector('#pan-band [data-k="tcol|' + ((v && v.name) || n) + '"]');
      if (b && b.getAttribute("aria-expanded") !== "true") b.click();
    }, name);
    await p.waitForTimeout(350);
  };
  /* ===== THE PER-SECTION WORDS ARE A SECTION'S QUESTION NOW (2026-09-02) ==
     Paul: *"Make a section automation interface for the manipulation of the
     motifs and put it under structure/sections … Every section I can tweak
     every instrument."*

     `await facet("facet-sec")` STOOD AT FIVE PLACES IN THIS FILE and it was
     the voice's fourth facet — the per-section table, one player at a time,
     inside the Band panel. That facet is deleted: the question "what does the
     kit DO in this section" is asked OF THE SECTION now, of every member at
     once, which is what a section automation interface is. The sheet KEYS did
     not move (`dev.kit|kit|<secId>` is the same address it always was), so
     every assertion below is untouched; only the door is. This opens the
     Structure tab and the record's first section, which is where those
     controls are drawn.
     IT IS A NO-OP ON THE HARNESS PAGE, exactly as `facet` is — the tier
     fixture has no gutter and no sections, and `tapK`/`facet` have always been
     written so this file can drive both pages. */
  /* ...AND SINCE 2026-09-04 IT IS A CELL. The Structure grids are deleted with
     their pane; "what does this player DO in this section" is a row of the
     CELL's own sheet on the Band table (`tcell|<voice>|<section>`), which is
     the tier TABLE.md §1 files it on. The sheet KEYS did not move — `dev.kit|
     kit|<secId>`, `dev.line|<voice>|<secId>`, `material.cell|…` are the same
     addresses they have been since 2026-08-24 — so every assertion below is
     untouched; only the door is, again. It takes the voice's NAME because a
     cell is a crossing and the old grid drew a whole column of them at once. */
  const openDoes = async (vname) => {
    const went = await p.evaluate(async (n) => {
      if (!window.__eightTab || !window.__eightDoc) return false;
      window.__eightTab("Band");
      await new Promise((r) => setTimeout(r, 300));
      const D = window.__eightDoc();
      const v = (n && D.voices.find((x) => x.name === n)) ||
                D.voices.find((x) => x.kind === "drums") || D.voices[0];
      const s2 = D.form.sections[0];
      if (!v || !s2) return false;
      const c = document.querySelector('#pan-band [data-k="tcell|' + v.name + '|' + s2.id + '"]');
      if (!c) return false;
      /* TWO TAPS SINCE §11: the first selects, the second edits. */
      for (let i = 0; i < 2 && c.getAttribute("aria-expanded") !== "true"; i++) c.click();
      return true;
    }, vname || null);
    await p.waitForTimeout(450);
    return went;
  };
  /* THE KIT'S DEVELOPMENT WORDS MOVED WIDGET, THE LAW DID NOT — the same
     rewrite gate 5 below already carries for `alphabet.quality`, and the same
     sentence: Paul, *"There are still many boxes that should be selects"*.
     WAS: `.nu-sheet[data-sheet^="dev.kit"]:not([disabled])`, which on the
     shipped page now matches nothing at all and read as "the kit is dead"
     while the kit was fine. Measured 2026-08-25: `dev.kit|kit|c1` is a
     `<select>` of 69 options, and it lives on the drummer's own tab, so the
     tab has to be opened before it can be looked at. */
  await openDoes("kit");
  /* ...AND A THIRD WIDGET, 2026-09-02 (wave 4). Paul: *"make those tables of
     dropdowns full of tappable grids that change options rather than dropdowns
     — like the other selection table in mix … institutionalize it."* Every
     per-section word is a `ui/wordgrid.js` CELL now — a button printing its
     word, which grows a strip of words under its row when you tap it. The
     sheet KEY did not move (`dev.kit|kit|<secId>`), so the law below is
     untouched and this only learns a third way to find the control. A cell
     refuses with `aria-disabled` rather than `disabled` — see the next read,
     which says why. */
  const kitLive = await p.evaluate(() => {
    const f = document.querySelector('.nu-sheet[data-sheet^="dev.kit"]');
    if (f) return { as: "sheet", live: !f.disabled };
    const s2 = document.querySelector('[data-sel^="dev.kit"]');
    if (s2) return { as: "menu", live: !s2.disabled };
    const c = document.querySelector('.nu-wcell[data-k^="dev.kit"]');
    return c ? { as: "cell", live: !c.disabled &&
                   c.getAttribute("aria-disabled") !== "true" }
             : { as: "absent", live: false };
  });
  check(kitLive.live, "with a drummer, the kit's development words are live " +
    "(as a " + kitLive.as + ")");
  await openCol("kit");                   // the drummer's on/off lives here
  /* ...AND IT IS TWO WORDS RATHER THAN A TICK SINCE 2026-09-04 (TABLE.md wave
     2c). `data-k="drums"` did not move — it is the same address, in the
     drummer's COLUMN SHEET — but the table has no `<input type=checkbox>` on
     it anywhere (§6: chips are decisions, and a control that needs a pointer
     is a refused control), so the hand is the one every other field on that
     sheet takes: tap the field, then tap the word. The harness page keeps its
     checkbox and its `__D()` fallback below. */
  await p.evaluate(async () => {
    const c = document.querySelector('[data-k="drums"]');
    if (c && c.tagName === "INPUT") {
      c.checked = false; c.dispatchEvent(new Event("change", { bubbles: true })); return; }
    if (c) {
      c.click();
      await new Promise((r) => setTimeout(r, 250));
      const off = [...document.querySelectorAll('#pan-band .nu-wchip')]
        .find((x) => /sitting out/.test(x.textContent || ""));
      if (off) { off.click(); return; }
    }
    const D = window.__D ? window.__D() : null;
    const d = D && D.voices.find((v) => v.kind === "drums");
    if (d) { d.cast.on = false; (window.__draw || (() => {}))(); }
  });
  await p.waitForTimeout(500);
  await openDoes("kit");          // ...and the words it greys do not
  // ...AND IT IS READ BACK THROUGH WHICHEVER WIDGET IT IS, for the reason
  // above. A disabled <select> keeps its <option>s in the list exactly as a
  // disabled fieldset keeps its `.nu-opt` rows: greyed, not hidden, which is
  // the half of this assertion that is actually about the design.
  /* ===== THE THIRD WIDGET MAKES THE SECOND HALF OF THIS CHECK TRUE FOR THE
     FIRST TIME (2026-09-02) ===========================================
     "…and its N options are STILL VISIBLE — greyed, not hidden" is avail.js's
     founding law ("Hiding destroys the shape of the possible") and it was read
     off a DISABLED `<select>`'s option list — which is in the markup and which
     a person cannot open. A word grid's refused cell is `aria-disabled` rather
     than `disabled`: it greys, it says why, it cannot write, and it STILL
     OPENS, so the words are on the screen and not only in the DOM. So the
     count below is taken the way a reader takes it — the cell is opened and
     the chips in the strip are counted — and every one of them is asserted
     refused, which the `<select>` branch could not say at all. */
  const kit = await p.evaluate(async () => {
    const f = document.querySelector('.nu-sheet[data-sheet^="dev.kit"]');
    if (f) { const w = [...f.children].find((c) => c.classList.contains("nu-why"));
      return { as: "sheet", off: f.disabled, why: w ? w.textContent : null,
               visible: f.querySelectorAll(".nu-opt").length }; }
    const s2 = document.querySelector('[data-sel^="dev.kit"]');
    if (s2) return { as: "menu", off: s2.disabled, why: s2.dataset.why || null,
                     visible: window.__combo.words(s2).length };
    const c = document.querySelector('.nu-wcell[data-k^="dev.kit"]');
    if (!c) return null;
    const off = !!c.disabled || c.getAttribute("aria-disabled") === "true";
    if (!c.disabled && c.getAttribute("aria-expanded") !== "true") c.click();
    await new Promise((r) => setTimeout(r, 120));
    /* THE STRIP IS A SIBLING `<div>` INSIDE A SHEET (2026-09-04) and a `<tr
       class="nu-wopen">` inside a grid — see `padRead` for the argument. */
    const tr = c.closest("tr") && c.closest("tr").nextElementSibling;
    const strip = (tr && tr.classList.contains("nu-wopen")) ? tr
      : (c.closest(".nu-sheetrow") || {}).nextElementSibling;
    /* ...AND THE SAME FOURTH WIDGET HERE — the drummer's sixty-eight are a
       lozenge field since 2026-09-05 (see `padRead`'s note). */
    const chips = strip ? [...strip.querySelectorAll(".nu-wchip, .nu-lz")] : [];
    const live = chips.filter((x) => !x.disabled &&
      x.getAttribute("aria-disabled") !== "true").length;
    const out = { as: "cell", off, why: c.dataset.why || null,
                  visible: chips.length, liveChips: live };
    if (c.getAttribute("aria-expanded") === "true") c.click();
    return out;
  });
  check(!!kit && kit.off && /no drummer/.test(kit.why || ""),
    "no drummer -> dev.kit disabled (as a " + (kit && kit.as) + ") reading " +
    JSON.stringify(kit && kit.why));
  check(!!kit && kit.visible > 60 &&
        (kit.as !== "cell" || kit.liveChips === 0),
    "...and its " + (kit && kit.visible) + " options are STILL VISIBLE — " +
    "greyed, not hidden" + (kit && kit.as === "cell"
      ? " (and on the artifact, not only in the markup: the refused cell opens " +
        "and every one of its words is grey — " + kit.liveChips + " live)" : ""));

  /* ---- 4b THE DRUM KIT IS NOT A MULTISELECT, AND THAT IS THE SAME RULE ----
     Paul asked, 2026-08-24: "can i pick more than one options for the drum
     kit?" The measured answer is no — document.js:192 writes `drumkit` as a
     STRING, audio/to-engine.js `mapEvents` does `Object.assign(D,
     MACHINE_KIT[plan.kit])`, and every lane's hit goes out with that one kit's
     models on it. So
     the same sentence that made the fx chips a `<select multiple>` makes this
     one a plain single `<select>`: a multiselect offering one legal answer is a
     worse lie than the checkboxes were. The drummer hired above is still on the
     record; his tab is where the control lives. */
  await openCol("kit");                   // the machine is what the kit IS
  /* IT TAPS THE FIELD FIRST, BECAUSE A CONTROL ON A SHEET MAY BE A POP-UP
     (2026-09-05, DESIGN.md §2 components 4 and 6: a sheet row is *"label ·
     value · clear-back"* and a control is *"what a tap on a cell/field
     opens"*). A vocabulary that knows its own kinds is drawn that way now, and
     `sound.drumkit` is one tap away from being one — so the gate does what a
     hand does before it reads. Idempotent, and a no-op on a seated widget. */
  const dk = await p.evaluate(async () => {
    const cell = document.querySelector('.nu-wcell[data-k^="sound.drumkit"]');
    if (cell && !cell.disabled && cell.getAttribute("aria-expanded") !== "true") {
      cell.click();
      await new Promise((r) => setTimeout(r, 250));
    }
    const f = document.querySelector('.nu-sheet[data-sheet^="sound.drumkit"]');
    const s2 = document.querySelector('[data-sel^="sound.drumkit"]');
    return { sheet: !!f, sheetMulti: f ? f.hasAttribute("data-multi") : null,
             menu: !!s2, multiple: s2 ? !!s2.multiple : null,
             n: s2 ? window.__combo.words(s2).length : 0,
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
      "menu, not a sheet " + JSON.stringify(dk));
  else notes.push("     (the drum kit's WIDGET is ui/selects.js's router, which " +
    "this harness does not import — index.html only)");

  /* ---- 5 modal harmony and the chord quality ----
     THE SUBJECT MOVED WIDGET, AND THEN THE LAW ITSELF TURNED OVER, and both
     are written here rather than in a new block.

     IT SAID, UNTIL 2026-09-02: "modal harmony -> alphabet.quality disabled,
     reading `modal harmony has no changes`". The sentence was true of the
     kernel — kernel.js:671 throws the progression away under a modal harmony,
     so every quality is a word about nothing — and that is exactly why the
     control was greyed. Paul, using the composer: *"I can't change chord
     quality, it's grayed"*. A refusal a person reads as a broken control is a
     refusal in the wrong place: the honest answer to "I want to change the
     quality" is to let them, and to say what that costs. So editing the
     changes on a non-cycle record now SETS `alphabet.harmony = "cycle"` first,
     with the side effect printed under the grid ("editing the changes makes
     the harmony a cycle"), and the quality is LIT on a modal record.

     THE HARNESS IS NOT PART OF THAT REVERSAL AND STILL GREYS IT, which is
     right and is why the two pages are asked different questions here. The
     sheets harness imports ui/sheets.js and avail.js directly — it is the
     sheets TIER's own page — and `avail.js` still names the rule and still
     carries the sentence, because the rule is true about the KERNEL. What
     changed is what the Key panel does about it, and the Key panel is
     index.html's. test/tempo-key.browser.js T4e is the other half of this
     claim, driven: it makes a modal record, changes the quality, and reads the
     compiled progression back. */
  // ON THE KEY TAB (2026-08-27): "the changes" is the Alphabet axis, which is
  // Paul's `Key`, and the quality menus are cells of its chord table.
  /* ...AND `Key` IS INSIDE `Time` SINCE 2026-09-04 (nukernel/TABLE.md §8:
     *"Tempo and Key fold into one Time structure"*). The Alphabet axis and its
     chord table did not move a line — `#pan-band` holds both axis sections
     now — so the door is one word different and nothing below it is. */
  if (REAL) await openTop("Time");
  const qual = await p.evaluate(() => {
    const f = document.querySelector('.nu-sheet[data-sheet^="alphabet.quality"]');
    if (f) { const w = [...f.children].find((c) => c.classList.contains("nu-why"));
             return { as: "sheet", off: f.disabled, why: w ? w.textContent : null }; }
    const q = [...document.querySelectorAll('[data-sel^="alphabet.quality"]')];
    if (!q.length) return null;
    return { as: "menu", n: q.length, off: q.filter((x) => x.disabled).length,
             why: q.map((x) => x.dataset.why || "").filter(Boolean)[0] || null,
             said: document.body.innerText
               .includes("editing the changes makes the harmony a cycle") };
  });
  if (REAL)
    check(!!qual && qual.as === "menu" && qual.n > 0 && qual.off === 0 &&
          !qual.why && qual.said,
      "the chord quality is LIT on a modal record and the page says what " +
      "editing the changes costs (Paul, 2026-09-02: \"I can't change chord " +
      "quality, it's grayed\") " + JSON.stringify(qual));
  else
    check(!!qual && qual.off && /modal harmony has no changes/.test(qual.why || ""),
      "modal harmony -> alphabet.quality disabled on the sheets tier (as a " +
      (qual && qual.as) + ") reading " + JSON.stringify(qual && qual.why));

  /* ---- 6 a pad may not be transposed, but it may be silenced ---- */
  // STAND ON A VOICE'S TAB FIRST. This asked for `cast.part` on whatever the
  // page happened to be showing and got nothing: the band block lands on the
  // FORM tab (`eight.js:598` — the form is a tab of its own now), and gate 4
  // above then walked the page onto the DRUMS tab by hiring a drummer, which
  // has no `cast.part` sheet at all. The gate read `undefined` and called the
  // page broken while the page was right. Click the first line voice's tab,
  // the way a thumb would, and the sheets this section is about exist.
  if (REAL) await openTop("Band");
  const PADV = await p.evaluate(() => {
    const v = window.__D().voices.find((x) => x.kind === "line");
    const t = v && document.querySelector('[data-k="tab' + v.name + '"]');
    if (t) t.click();
    return v ? v.name : null;
  });
  await p.waitForTimeout(200);
  // ...AND ON ITS PER-SECTION FACET, 2026-08-28, for the same reason gate 4
  // above names one: `dev.line` is a per-SECTION word and a voice draws one
  // facet at a time now. `cast.part` — the word this gate SAYS — is on the
  // `plays` facet, so the three reads below each stand where their control is.
  await openDoes(PADV);
  // ...AND READ THE WORDS BEFORE ANYTHING IS SAID, so "8 greyed" is evidence
  // about the pad rather than about the record it happened to be measured on.
  /* ...AND IT IS THAT VOICE'S ROW AND NOT THE FIRST ONE ON THE PAGE
     (2026-09-02). The per-section words were drawn one voice at a time — the
     voice's own `sec` facet — so "the first `dev.line` control on the page"
     WAS this voice's. They are asked of the SECTION now, of every member at
     once (Paul: *"Every section I can tweak every instrument"*), so the page
     holds one `dev.line|<name>|<sec>` per line voice and the first of them is
     whoever the roster puts first. The pad is a fact about ONE player, so the
     reading is scoped to that player's key. */
  const padWas = (await p.evaluate((vn) => {
    const rows = [];
    const pick = (sel) => [...document.querySelectorAll(sel)]
      .find((n2) => (n2.dataset.sheet || n2.dataset.sel || "").split("|")[1] === vn)
      || document.querySelector(sel);
    const f = pick('.nu-sheet[data-sheet^="dev.line"]');
    if (f) { for (const l of f.querySelectorAll(".nu-opt")) rows.push({ v: l.dataset.v,
      off: l.querySelector("input").disabled }); return rows; }
    const s2 = pick('[data-sel^="dev.line"]');
    if (s2) { for (const o of window.__combo.words(s2)) rows.push({ v: o.v, off: o.off });
      return rows; }
    /* ...AND A THIRD WIDGET (2026-09-02): the word grid's cell, whose words
       are in the strip it opens. Read the way a reader reads them — open the
       cell, take the chips, fold it again. */
    const c = pick('.nu-wcell[data-k^="dev.line"]');
    if (c && !c.disabled) {
      const shut = c.getAttribute("aria-expanded") !== "true";
      if (shut) c.click();
      const tr = c.closest("tr") && c.closest("tr").nextElementSibling;
      if (tr && tr.classList.contains("nu-wopen"))
        for (const o of tr.querySelectorAll(".nu-wchip"))
          rows.push({ v: o.dataset.k.slice(c.dataset.k.length + 1),
                      off: !!o.disabled });
      if (shut && c.getAttribute("aria-expanded") === "true") c.click();
    }
    return rows;
  }, PADV)).filter((r) => r.off);
  // SAY "PAD" THROUGH WHICHEVER WIDGET `cast.part` IS. It was a sheet all
  // morning and it is a <select> again this evening (Paul: "in voices -- plays,
  // material, instrument -- dropdowns/selects"), and what this gate is about is
  // neither — it is about what happens to the DEVELOPMENT sheet next door once
  // the voice is a pad. Reaching for the sheet alone made this gate read
  // `undefined` and call the page broken while the page was right, which is the
  // same mistake its own comment above records having made once already.
  /* AND THE WORD IS SAID WHERE ITS CONTROL IS DRAWN (2026-09-02). `cast.part`
     is on the voice's `plays` facet, and the two questions this block asks now
     live on TWO TABS: what a player IS is the band's, what it DOES here is the
     section's (Paul: *"Every section I can tweak every instrument"*). A panel
     that is not the open one keeps its old DOM and is not rebuilt, so tapping
     the facet from the Structure tab left the Band panel showing whichever
     facet it was last drawn with — and `cast.part` was simply not on the page
     to be said. So the walk goes back to the band, opens the voice, opens its
     `plays` facet, says the word, and only then returns to the section to read
     what greyed. That is also exactly the gesture a hand makes. */
  if (REAL) await openCol(PADV);
  // (`cast.part` is what it PLAYS, and `openCol` above is where it is asked)
  await p.evaluate(() => {
    const f = document.querySelector('.nu-sheet[data-sheet^="cast.part"]');
    const i = f && f.querySelector('.nu-opt[data-v="pad"] input');
    if (i) { i.checked = true; i.dispatchEvent(new Event("change", { bubbles: true })); return; }
    window.__combo.say(document.querySelector('[data-sel^="cast.part"]'), "pad");
  });
  await p.waitForTimeout(200);
  await openDoes(PADV);               // ...and the words it greys are per-section
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
  const padRead = () => p.evaluate((vn) => {
    const rows = [];
    const pick = (sel) => [...document.querySelectorAll(sel)]
      .find((n2) => (n2.dataset.sheet || n2.dataset.sel || "").split("|")[1] === vn)
      || document.querySelector(sel);
    const f = pick('.nu-sheet[data-sheet^="dev.line"]');
    if (f) { for (const l of f.querySelectorAll(".nu-opt")) rows.push({ v: l.dataset.v,
      off: l.querySelector("input").disabled,
      why: (l.querySelector(".nu-why") || {}).textContent || "" }); return rows; }
    const s2 = pick('[data-sel^="dev.line"]');
    if (s2) { for (const o of window.__combo.words(s2))
      rows.push({ v: o.v, off: o.off, why: o.why }); return rows; }
    // ...and the word grid's cell, read off the strip it opens (2026-09-02)
    /* ...AND THE SAME CELL INSIDE A SHEET, 2026-09-04 (TABLE.md wave 2c).
       `dev.line` is a row of the CELL's own sheet now, not a cell of a grid,
       and ui/wordgrid.js opens a sheet row's strip with
       `line.insertAdjacentElement("afterend", strip)` — a sibling `<div>`,
       not a `<tr class="nu-wopen">`. Same button, same chips, same `data-k`;
       one more place to look for the strip it opened. */
    const c = pick('.nu-wcell[data-k^="dev.line"]');
    if (c && !c.disabled) {
      const shut = c.getAttribute("aria-expanded") !== "true";
      if (shut) c.click();
      const tr = c.closest("tr") && c.closest("tr").nextElementSibling;
      const strip = (tr && tr.classList.contains("nu-wopen")) ? tr
        : (c.closest(".nu-sheetrow") || {}).nextElementSibling;
      /* `.nu-lz` IS THE FOURTH WIDGET (2026-09-05, DESIGN.md component 16). The
         development words carry avail.js's own families — "the subject", "a
         piece of it", "moved in pitch", "counterpoint" — so the strip a cell
         opens is a LOZENGE FIELD now, minting the same `<field>|<value>`
         address on every option. Read only `.nu-wchip` and this returned an
         EMPTY LIST, which reads as "a pad greys nothing" and is not the same
         claim as "the page offers nothing to grey". */
      if (strip)
        for (const o of strip.querySelectorAll(".nu-wchip, .nu-lz"))
          rows.push({ v: o.dataset.k.slice(c.dataset.k.length + 1),
                      off: !!o.disabled || o.getAttribute("aria-disabled") === "true",
                      why: o.dataset.why ||
                           ((o.querySelector(".nu-why, .nu-lzwhy") || {}).textContent || "") });
      if (shut && c.getAttribute("aria-expanded") === "true") c.click();
    }
    return rows;
  }, PADV);
  const padOn = await padRead();
  const padGrey = padOn.filter((r) => r.off);
  /* EVERY GREY SAYS *A* MEASURED REASON, AND AT LEAST ONE SAYS THE PAD'S
     (2026-09-02). `padSays.length === padGrey.length` demanded that the pad's
     own sentence be the reason for ALL of them, which was exact while the
     control was drawn on the voice's own facet: the only fact in scope was the
     part. The same key is drawn in the SECTION now, where the record's harmony
     is in scope too — measured on the shipped chant, `modal harmony has no
     changes` greys four of the same words — so requiring one sentence would be
     asserting that a control may only ever have one reason to be unreachable.
     What the law actually says is NO SILENT GREY: every greyed option carries
     a measured reason in its own text. That is what is asserted, plus the half
     this check is really about — the pad greys words that were live before it,
     and its own sentence is on them. */
  const padSays = padGrey.filter((r) => r.why.includes(PADWHY));
  const padMute = padGrey.filter((r) => !r.why.trim());
  const padOut = padOn.find((r) => r.v === "out");
  check(padWas.length === 0 && padGrey.length > 0 &&
        padSays.length > 0 && padMute.length === 0,
    "a pad greys " + padGrey.length + " development words (" +
    padWas.length + " before the tap) " +
    "and every one of them says why in its own text: " +
    JSON.stringify(padGrey.map((r) => r.v)) +
    (padMute.length ? " · SILENT: " + JSON.stringify(padMute.map((r) => r.v)) : "") +
    (padSays.length ? "" : " · none says the pad's own sentence; the reasons " +
      "found were " + JSON.stringify([...new Set(padGrey.map((r) => r.why))])));
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
  await openCol(PADV);
  await p.evaluate(() => {
    const i = document.querySelector('.nu-sheet[data-sheet^="cast.part"] .nu-opt[data-v="pad"] input');
    if (i) { i.dispatchEvent(new Event("change", { bubbles: true })); return; }
    const s = document.querySelector('[data-sel^="cast.part"]');
    if (s) { s.dispatchEvent(new Event("change", { bubbles: true })); return; }
    if (window.__draw) window.__draw();
  });
  await p.waitForTimeout(200);
  await openDoes(PADV);
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
    for (const s2 of document.querySelectorAll('[data-sel^="dev.line"]')) {
      const o = window.__combo.words(s2).find((x) => x.v === "at the fifth");
      if (!o || !o.on) continue;
      return { as: "menu", off: o.off || s2.disabled, why: o.why || null };
    }
    /* ...AND A THIRD WIDGET (2026-09-02, wave 4). On a word grid the standing
       answer is TWO things and both are read: the word the CELL is printing —
       which is the whole of "you can always see the word you are on", and
       which a `<select>` could only say by having it selected — and the chip
       for it inside the strip, which must not be refused. */
    for (const c of document.querySelectorAll('.nu-wcell[data-k^="dev.line"]')) {
      if (c.disabled) continue;
      const shut = c.getAttribute("aria-expanded") !== "true";
      if (shut) c.click();
      /* THE STRIP IS A SIBLING `<div>` INSIDE A SHEET (2026-09-04) and a
         `<tr class="nu-wopen">` inside a grid — same button, same chips, two
         places to look. See `padRead` above, which carries the argument. */
      const tr = c.closest("tr") && c.closest("tr").nextElementSibling;
      const strip = (tr && tr.classList.contains("nu-wopen")) ? tr
        : (c.closest(".nu-sheetrow") || {}).nextElementSibling;
      /* `.nu-lz` TOO, since 2026-09-05 — the development words are a lozenge
         field now (see `padRead`'s note). Same `aria-pressed`, same
         `<field>|<value>` address; only the class moved. */
      const chip = strip
        ? [...strip.querySelectorAll(".nu-wchip, .nu-lz")].find((x) =>
            x.getAttribute("aria-pressed") === "true") : null;
      const v = chip ? chip.dataset.k.slice(c.dataset.k.length + 1) : null;
      const out = v === "at the fifth"
        ? { as: "cell", off: !!chip.disabled ||
              c.getAttribute("aria-disabled") === "true",
            shown: c.textContent, why: chip.dataset.why || null }
        : null;
      if (shut && c.getAttribute("aria-expanded") === "true") c.click();
      if (out) return out;
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
     control is a menu now (a COMBO BOX since 2026-09-02, whose ArrowDown is
     this page's own and is driven by test/selects.js 7M), and `alphabet.mode`
     was only the first of
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
      "is a combo box, whose ArrowDown is its own (test/selects.js 7M). Still " +
      "drawn as " +
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
    /* ON THE PAGE, OR NOT COUNTED (2026-09-02). The seed flyout is a
       `.nu-strip-out` that ships `hidden` until a hand opens it (Paul: *"When
       I click seed pop up a vertical slider from zero to 2^16"*), and its own
       refusal — "0 and 1: as written" — is a `.nu-why` inside it. `hidden` is
       the UA stylesheet's `display:none`, so disabling the AUTHOR sheet does
       not reveal it, and a reason inside a closed popover is not a silent grey:
       it is a reason on a control nobody is looking at. What this check has
       always been about is what a reader MEETS with the stylesheet off, so it
       reads the reasons that are laid out — the same `shown()` rule
       test/shell.js applies to every measurement it makes. */
    const whys = [...document.querySelectorAll(".nu-why")]
      .filter((w) => w.getClientRects().length)
      .map((w) => w.textContent.trim());
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
