#!/usr/bin/env node
/* test/selects.js — THE SETTLED PARAMETERS, READ OFF THE RENDERED PAGE.
 *
 * "TEST THE ARTIFACT: gates must read the rendered output; three features
 * shipped broken here while every check passed." So nothing below asks a
 * module what it would draw. Every assertion is a query against the DOM the
 * browser actually built, and the interactive ones are driven by choosing
 * options the way a thumb would.
 *
 *   node test/selects.js
 *   node test/selects.js --page http://localhost:8777/test/fixtures/selects-harness.html
 *
 * The default target is nukernel/index.html, which draws none of these until
 * the integrator has applied this slice's recipe to ui/eight.js (an integration
 * file, one owner, serial pass). `--page` takes the harness instead: the same
 * avail.js + gates.js + ui/sheets.js + ui/selects.js over the same shipped
 * record, drawing the same sites the recipe describes.
 *
 * ...AND SINCE 2026-08-25 IT IS ALSO THE GATE ON THE CIRCLE OF FIFTHS (check 7),
 * ON WHICHEVER PAGE IT IS POINTED AT. The fixture drew the key as a menu for a
 * day after the page had moved it onto a ring, which cost this file two
 * apologies — check 7 went index.html-only and check 3 carried a named
 * exemption for `alphabet.key`. The fixture was taught the circle the same
 * evening and both apologies are deleted: harness and page draw the same
 * widget, so the gate asks the same question of both.
 * Paul: "Maybe put the circle of fifths back in there for key selection, it was
 * nice." The key came off the menu list and onto a diagram, which does not make
 * this a different file: the question is still "is a settled parameter drawn
 * with the widget it was decided to have", and the key's widget is now a ring.
 * Everything check 7 asserts it asserts against the rendered page — twelve
 * hours in fifths order, twelve relative minors, twenty-four real radios, the
 * arrow keys walking round rather than down, one tap answering two questions,
 * no silent grey, and the whole thing still a readable fieldset with
 * `document.styleSheets[0].disabled = true`.
 *
 * THIS GATE IS THE OTHER HALF OF test/sheets.js AND MUST BE RUN WITH IT. That
 * one proves the development words are lit sheets that grey with a reason; this
 * one proves the settled parameters are menus — and both directions are checked
 * HERE, because the failure mode this round can produce is a slice converting
 * one control too many. (test/sheets.js check 1, "#app select is empty", is the
 * one assertion in that file this round makes false on purpose; it is amended
 * there rather than deleted, so the reversal stays legible.)
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
const REAL = /nukernel\/index\.html/.test(PAGE);

/* WHAT PAUL NAMED, 2026-08-24, VERBATIM AND IN HIS ORDER. The list is the
 * gate: a control on it that is still a sheet is a fail, and a control NOT on
 * it that has become a select is also a fail ("exactly this list and no more").
 *
 *   "We can return some things to select menus: meter / reading speed / swing /
 *   key (although please spell things out like not just A# but A#/Bb) / mode /
 *   the changes / chord quality can be selects inside the 'the changes' table
 *   … in the band 'form' section -- return to dropdowns/select … in voices --
 *   plays, material, instrument -- dropdowns/selects" */
const MENUS = {
  "time.meter":       "meter",
  /* ...AND `time.rate` LEFT THE LIST, 2026-08-27 (FUTURE.md §5: "`reading
   * speed` select deleted — the 1×/half/double buttons own the fact — one
   * fact, one control"). Paul named it on the evening list, and then the
   * tempo row's own glyph buttons (half time / double time / as written /
   * default, ui/eight.js TEMPOS) grew to cover every case the menu offered —
   * two writable owners of `time.rate` on one page. The menu died, the
   * buttons stayed (test/knobs.js 8e drives them), and avail.js
   * SHEETS["time.rate"] keeps the three-way mapping in the data tier;
   * test/text-diet.test.js pins the Time axis at exactly two selects. */
  "time.swing":       "swing",
  /* ...AND `alphabet.key` IS NOT ON THIS LIST ANY MORE. It was, from the evening
   * of 2026-08-24 until the morning of 2026-08-25, and the line that carried it
   * is rewritten here rather than deleted because the reason it was here has not
   * been withdrawn. Paul named the key in the same breath as the meter and the
   * mode, and for the same reason: it is a SETTLED PARAMETER, one value decided
   * once that nobody browses, and a lit sheet of twelve was the wrong widget for
   * it. Then, later the same day: "Maybe put the circle of fifths back in there
   * for key
   * selection, it was nice." A menu and a circle are the same claim about the
   * key — decided, not shopped — drawn two ways, and the circle is the better
   * drawing because it is the only one that shows a composer which keys are next
   * door. So the key leaves MENUS for CIRCLE below, the assertions get harder
   * rather than fewer, and check 3 still refuses to let it quietly become a menu
   * again. The MODE stays here, beside it, exactly as it was. */
  "alphabet.mode":    "mode",
  // labelled "harmony" since 2026-08-27 (FUTURE.md §5: "two controls, one
  // heading" — the table alone keeps "the changes"); the KEY never moved.
  "alphabet.harmony": "harmony",
  "alphabet.quality": "chord quality, inside the changes table",
  "form.role":        "the band > form",
  "cast.part":        "voices > plays",
  "cast.material":    "voices > material",
  "sound.instrument": "voices > instrument",
  /* ...and `material.cell` is "voices > material" ONE SCOPE DOWN, added by the
   * integrator on the same evening and from the same two sentences. The band's
   * voice tab now says which of the record's motifs a player reads SECTION BY
   * SECTION, because the makers left the voices for the shared bank in the
   * Material axis ("i thought motifs were universal not per voice?" — they are)
   * and "'the band' is where I thought voices would be established,
   * interpreting the progression, structure, and motif". It is a menu for
   * exactly the reason `cast.material` is one: which cell a voice reads in the
   * bridge is a settled parameter, and the sheet beside it is the WORD the
   * voice does to what it reads, which is the comparison. */
  "material.cell":    "voices > material, per section",
  /* ...and `sound.drumkit`, which joined the list on 2026-08-24 by the same
   * sentence and by a measurement. Paul asked "can i pick more than one options
   * for the drum kit?" and the selects round read that QUESTION as a request,
   * leaving it a lit sheet on the note that "multi-select is a row of
   * checkboxes and never a <select multiple>". Both halves are gone: he has
   * since asked for the standard multiselect element where multiple IS allowed
   * ("Wherever we allow multiple selections use a standard multiselect form
   * element please."), and multiple is NOT allowed here — document.js:192
   * writes `drumkit` as a STRING, to-engine.js:1141 does
   * `Object.assign(D, MACHINE_KIT[kit])`, and `drumVoice(kit, lane)` resolves
   * every lane through that one kit. So it is a voice's INSTRUMENT (avail.js
   * :551 gets and sets `V(doc, s).instrument`, exactly as `sound.instrument`
   * does) and it is on the evening list by name: "in voices -- plays,
   * material, instrument -- dropdowns/selects". */
  "sound.drumkit":    "voices > instrument, for a drummer",
};
/* THE ONE CONTROL ON THE PAGE THAT ALLOWS MORE THAN ONE ANSWER.
 * (Paul, 2026-08-24: "Wherever we allow multiple selections use a standard
 * multiselect form element please.")
 *
 * It is listed here by name and by cap for the same reason MENUS is a list: a
 * control that quietly becomes a multiselect is as much a fail as one that
 * quietly becomes a menu. `n` is checked against the page and `max` is driven
 * — check 12 below picks three chips and then forces a fourth. */
/* IT IS EMPTY BECAUSE THE ONE CONTROL IT NAMED CHANGED ADDRESS — REWRITTEN
 * 2026-08-26, and the page was right. This table held `eng.fx`, the per-voice
 * character chips, and asserted their presence on index.html. Paul, 2026-08-26:
 * "Don't let me add effects to instruments. That's bus and board stuff." The
 * buses round obeyed the sentence's FIRST half by taking the chip off every
 * instrument, and its second half by giving it an address: the same eleven
 * chips, the same MAX_FX cap, went to `master.fx` on the board, because that
 * chain was the RECORD's — audio/desk.js handed it to every seated voice — and
 * not any one instrument's. The chips did not go away; they moved.
 *
 * ...AND ON 2026-08-27 THEY MOVED BACK, TWICE IN ONE DAY AND BOTH TIMES BY
 * PAUL — which is why this table is still empty and now for a different
 * reason. First: *"I think we need to do what everyone else does with effects.
 * Add per voice effects, up to three. Each has a wet dry mix and its own
 * settings."* — the chip is on the instrument again, WITH slot knobs, and
 * drawn on the board's strips. Then, of the record-wide control: *"We can get
 * rid of Character right? We don't really use it any more do we?"* So
 * `master.fx` is gone too, and the three slots that replaced it are ordinary
 * `<select>`s — a slot allows ONE chip, so there is no multiple-selection
 * control anywhere on the shipped page today. The law this table states is
 * unchanged and still the point: a control that quietly becomes a multiselect
 * is as much a fail as one that quietly becomes a menu, and `undeclaredMulti`
 * below is what enforces it against an empty declaration.
 *
 * SO THIS FILE STOPS OWNING THEM, rather than following them. Everything this
 * gate surveys is `#app`-scoped ON PURPOSE (see the note over `survey`, and the
 * one over `sheets`): the board's controls are `nukernel/desk-gate.js` G3's
 * vocabulary, G10's cap and G11's placement, and one owner per fact is the law
 * that stops two gates disagreeing about one widget — which is exactly what
 * happened here, with this file demanding a control on a page where desk-gate,
 * green at 123 checks in the same run, was demanding its absence.
 *
 * The list stays as a list rather than being deleted, because the OTHER
 * direction is unchanged and is the half worth keeping: nothing inside `#app`
 * may quietly become a multiselect. The day a multiple choice belongs to the
 * record's own eight axes again, it is declared here with its cap and check 13
 * drives it. */
const MULTI = {};
/* ...and the form tab's per-section nudges, which are drawn in that same tab
 * and are the same kind of fact — one settled answer per section. They are
 * listed separately because they are a READING of "in the band 'form' section
 * -- return to dropdowns/select" (everything in that tab) rather than a name he
 * typed, and a reading that turns out wrong should be revertible by deleting a
 * block rather than by unpicking a list. */
const FORM_NUDGE = /^(form|development)\.(env|intro|outro|mot|lvl|period|breath|pipe)$/;
/* THE THREE DEVELOPMENT KEYS, AND WHAT THIS LIST IS FOR NOW.
 * It was called THE SHEETS THAT MUST SURVIVE, and the sentence under that name
 * is kept because it is the argument that lost: "the development words are what
 * the sheets round was FOR — a per-voice, per-section choice among twenty-one
 * melodic operators or sixty-eight kit words, where greying-with-a-reason is
 * the whole point."
 *
 * Greying-with-a-reason IS still the whole point and it is still gated (checks
 * 5 and 6 below, and test/sheets.js gate 6) — a menu carries the reason in the
 * <option>'s own words and stamps `data-why`, which is if anything easier to
 * read back off the artifact than a `<small class="nu-why">` was. What went is
 * the WIDGET: Paul, 2026-08-25, *"There are still many boxes that should be
 * selects"*. So the same three keys are now the list check 2 uses to say the
 * opposite thing — none of them may still be a lit sheet. */
const LIT = ["dev.line", "dev.bass", "dev.kit"];
/* THE FIVE BLACK KEYS, SPELLED BOTH WAYS (fields.js KEYNAMES). ♯/♭ and not #/b
 * because eSpeak NG — NVDA's default synthesiser — says "A sharp slash B flat"
 * for the first and "A hash slash B B" for the second; the measurement is in
 * the comment over KEYNAMES. */
const BLACK = ["C♯/D♭", "D♯/E♭", "F♯/G♭", "G♯/A♭", "A♯/B♭"];

/* ---------- THE CIRCLE OF FIFTHS, WRITTEN OUT ------------------------------
 * (Paul, 2026-08-24: "Maybe put the circle of fifths back in there for key
 * selection, it was nice.")
 *
 * TYPED OUT RATHER THAN IMPORTED, ON PURPOSE. Everything else in this file
 * reads the page and compares it with the page; this one table is the gate's
 * OWN copy of what a circle of fifths is, so that a wrong ring in fields.js
 * fails here instead of agreeing with itself. C at the top, sharps clockwise,
 * twelve hours; each hour is [what the outer ring says, what the inner ring
 * says, what the key VALUE is]. The outer word is the both-ways spelling every
 * black key on this page wears; the inner word is the fifths-proper minor,
 * which is the one spelling that hour can have (at F♯'s hour the relative minor
 * is D♯m, six sharps like its major, and not E♭m, which is G♭'s). */
const FIFTHS = [
  ["C", "Am", "0"], ["G", "Em", "-5"], ["D", "Bm", "2"], ["A", "F♯m", "-3"],
  ["E", "C♯m", "4"], ["B", "G♯m", "-1"], ["F♯/G♭", "D♯m", "-6"],
  ["C♯/D♭", "B♭m", "1"], ["G♯/A♭", "Fm", "-4"], ["D♯/E♭", "Cm", "3"],
  ["A♯/B♭", "Gm", "-2"], ["F", "Dm", "5"],
];
/* ...and the key each inner minor ANSWERS, which is not its hour's key: the
 * relative minor's tonic is nine semitones up, folded onto the −6..5 the table
 * offers. Tapping Am must sound A minor, never C minor at C's hour. */
const RELKEY = ["-3", "4", "-1", "-6", "1", "-4", "3", "-2", "5", "0", "-5", "2"];

const fails = [], notes = [];
const check = (ok, what) => { (ok ? notes : fails).push((ok ? "ok   " : "FAIL ") + what); };
const bare = (k) => String(k).split("|")[0].replace(/#\d+$/, "");

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const p = await b.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text()))
    errs.push("console: " + m.text()); });
  await p.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  await p.goto(PAGE, { waitUntil: "networkidle" });
  await p.waitForFunction(() => document.querySelectorAll("#app select, #app .nu-sheet").length > 0,
    null, { timeout: 20000 }).catch(() => {});
  await p.evaluate(() => { window.__D = window.__eightDoc || window.__doc; });
  await p.evaluate((v) => { window.__menus = v; }, MENUS);

  /* THE WHOLE PAGE, NOT THE FIRST TAB OF IT. The band block is a tab strip and
   * a voice's controls only exist while its tab is up (test/sheets.js gate 6
   * learned this the hard way and left the note). So the survey below is run
   * once per tab and unioned — a control that is a sheet on one tab and a
   * select on another is exactly the kind of half-applied recipe this gate is
   * for. */
  const survey = () => p.evaluate(() => {
    const q = (s) => [...document.querySelectorAll(s)];
    const bare = (k) => String(k).split("|")[0].replace(/#\d+$/, "");
    const nameOf = (s) => {
      if (s.getAttribute("aria-label")) return s.getAttribute("aria-label").trim();
      const l = s.closest("label");
      return l ? l.textContent.trim() : "";
    };
    return {
      sel: q("#app select[data-sel]").map((s) => ({
        key: s.dataset.sel, k: bare(s.dataset.sel), name: nameOf(s),
        value: s.value,
        // THE STANDARD MULTISELECT, READ OFF THE ARTIFACT. `.multiple` is the
        // property the browser resolved and `[multiple]` is the attribute in
        // the markup; both are recorded because a gate that trusted only the
        // property could be satisfied by a script setting it after the fact.
        multi: s.multiple, multiAttr: s.hasAttribute("multiple"), size: s.size,
        inSheet: !!s.closest("fieldset.nu-sheet[data-multi]"),
        // ANSWERS, not <option> elements: selects.js prefixes a placeholder to
        // a control whose value is not in its own table ("choose one"), and
        // that is a state of the page, not a choice on offer.
        n: s.querySelectorAll("option:not([data-placeholder])").length,
        inCell: !!s.closest("td"), disabled: s.disabled,
        why: s.dataset.why || "",
        /* ...AND WHETHER THE REASON IS ON THE SCREEN *HERE*, 2026-08-28. The
           check below used to read `document.body.innerText` ONCE, at the end
           of the walk, against every reason collected across every view — which
           was exact while the refusals happened to live on the last panel
           surveyed, and is unprovable now that a refusal can sit on a facet of
           one voice three levels into the gutter. The reason a select prints is
           its own wrapper's `<small class="nu-why">` (ui/selects.js
           `selectField`), so the honest question is "is it visible in the view
           that draws the control", and that is a question only this evaluate
           can answer — the view is gone by the time the assertions run. */
        saidWhy: !s.dataset.why ||
          document.body.innerText.includes(s.dataset.why),
        opts: q("#app select[data-sel]").length ? [...s.querySelectorAll("option")]
          .map((o) => ({ t: o.textContent, v: o.value, off: o.disabled,
                         why: o.dataset.why || "" })) : [],
      })),
      // a select that is NOT one of ours (the board's own, outside #app) is not
      // this gate's business; the query above is #app-scoped for that reason.
      // ...and WHICH SUBTREE each one is in, because the claim below is about
      // `#app`. The board's own controls are nukernel/desk-gate.js G11's fact
      // and not this file's — one owner per fact — and a check worded "in #app"
      // must not be able to go red on something outside it.
      sheets: q(".nu-sheet").map((f) => ({ key: f.dataset.sheet, k: bare(f.dataset.sheet),
        inApp: !!f.closest("#app"),
        // A MULTI SHEET COUNTS ITS <option>s, NOT ITS `.nu-opt`s. It has none of
        // the latter any more — the answers live inside one `<select multiple>`
        // — and a check that counted rows would read every multiselect on the
        // page as a sheet of zero options.
        multi: f.hasAttribute("data-multi"),
        n: f.hasAttribute("data-multi")
          ? f.querySelectorAll("option:not([data-placeholder])").length
          : f.querySelectorAll(".nu-opt").length,
        boxes: f.querySelectorAll('input[type=checkbox]').length,
        off: f.disabled })),
    };
  });

  /* ---- AND THE PAGE IS NINE TOP-LEVEL TABS (2026-08-27) ----------------
   * Paul: *"Why don't we make tabs at the top level and let go of the idea of
   * scrolling everything? The tabs are: Where / Tempo / Key / Motif / Band /
   * Mix / Produce / Score / Export."* The paragraph above — "THE WHOLE PAGE,
   * NOT THE FIRST TAB OF IT" — was written about the BAND's tab strip and is
   * now true twice over, at two depths. Every survey below is unioned across
   * the outer nine as well as the inner voices, through the page's own
   * `window.__eightTab` (the call the tab button's own listener makes).
   *
   * MEASURED BEFORE THIS CHANGE, against the tabbed page: "no tab strip · 0
   * selects, 0 sheets", and nine checks red about a page that was fine — the
   * gate was standing on the Where tab, where the globe is, and reporting the
   * absence of every menu on the record.
   *
   * `openTop` and not a click on the tab button: a click would work, and it
   * would also make every one of these surveys depend on the tab row's
   * geometry at whatever viewport the gate happens to run at. What is under
   * test here is the option lists, not the strip; test/shell.js A6c and A6d
   * are where the strip itself is measured. */
  const TOPS = await p.evaluate(() =>
    window.__eightTabs ? window.__eightTabs() : []);
  const openTop = async (t) => {
    if (!TOPS.length) return;
    await p.evaluate((tt) => window.__eightTab(tt), t);
    await p.waitForTimeout(t === "Score" ? 1200 : 250);
  };

  /* HIRE A DRUMMER FIRST, OR THE KIT TAB DOES NOT EXIST. The shipped chant is
   * two voices and no drums, so `sound.drumkit` — on the MENUS list as of
   * 2026-08-24 — is not on the page at all until somebody is hired to play it.
   * test/sheets.js gate 4 does the same thing for the same reason.
   * ...ON THE BAND TAB, since 2026-08-27: `+ drums` was a button inside the
   * Band panel, and a shut panel is `inert` — the click finds the element and
   * fires nothing. Since 2026-08-28 it is a mark in the stripe's `band` level,
   * and the tab still has to be open for a different reason: the stripe draws
   * one level, and that level only exists while the Band panel is the open
   * one. */
  await openTop("Band");
  await p.evaluate(() => {
    const add = document.querySelector('[data-k="adddrums"]');
    if (add) { add.click(); return; }
    if (window.__addDrums) window.__addDrums(true);
  });
  await p.waitForTimeout(300);

  /* OFF THE STRIPE SINCE 2026-08-28 — see the same rewrite in test/sheets.js.
     `#tabs` was the band's horizontal strip; it is the `band` level of
     `#nu-tray`, `openTop("Band")` above has already descended into it, and
     every `data-k` is byte-identical. */
  const tabs = await p.evaluate(() =>
    [...document.querySelectorAll('#nu-tray [data-k^="tab"]')].map((t) => t.dataset.k));
  let sel = [], sheets = [];
  const eat = (s) => { sel = sel.concat(s.sel); sheets = sheets.concat(s.sheets); };
  // EVERY ONE OF THE NINE, FIRST — the Tempo tab's meter and swing, the Key
  // tab's mode, harmony and quality cells, the Motif tab's per-cell menus and
  // the producer's verbs are each on a panel of their own now, and none of
  // them is reachable from the band's strip.
  for (const t of TOPS) { await openTop(t); eat(await survey()); }
  await openTop("Band");
  eat(await survey());
  // ...AND THE FORM TAB IS A LIST, so its own controls are one tap further in.
  // Paul, 2026-08-25: *"when you tap it brings up the questions about the
  // section"* — `tabform` draws five section names (`ui/eight.js:3369` writes
  // `data-k = "sec" + sid`) and the eight per-section nudges FORM_NUDGE names
  // live in the DETAIL. Walking the tab alone, this gate never saw one of them
  // and its exemption was excusing nothing. Measured 2026-08-25: the tab 0,
  // section 2's detail 8.
  const SEC1 = await p.evaluate(() => {
    const d = window.__D();
    return (d.form.sections[1] || d.form.sections[0] || {}).id;
  });
  /* ...AND A VOICE IS THREE FACETS SINCE 2026-08-28, so the walk goes one
     level further in. Paul: *"A voice has: Instrument voice with settings from
     the mixer / What it plays, register, material / Per-section settings."*
     The band panel draws exactly the facet you are standing on (ui/eight.js
     `voiceFacet`), so a walk that stopped at the voice's own mark saw its
     instrument and none of its plays or its per-section table — and this gate
     went red on `voices > plays`, `voices > material` and `voices > material,
     per section`, which had not gone anywhere: the survey had. The facet keys
     are read off the stripe rather than typed, for the same reason the tab
     keys are — `#nu-tray [data-k^="facet-"]` is whatever the level offers. */
  for (const t of tabs) {
    await openTop("Band");
    await p.click('[data-k="' + t + '"]'); await p.waitForTimeout(150);
    eat(await survey());
    const facets = await p.evaluate(() =>
      [...document.querySelectorAll('#nu-tray [data-k^="facet-"]')].map((n2) => n2.dataset.k));
    for (const f of facets) {
      await p.click('[data-k="' + f + '"]'); await p.waitForTimeout(200);
      eat(await survey());
    }
    if (t === "tabform") {
      const opened = await p.evaluate((id) => {
        const n2 = document.querySelector('[data-k="sec' + id + '"]');
        if (!n2) return false;
        n2.click(); return true;
      }, SEC1);
      if (opened) { await p.waitForTimeout(200); eat(await survey()); }
    }
  }
  const selKeys = new Set(sel.map((s) => s.k));
  const sheetKeys = new Set(sheets.map((s) => s.k));
  notes.push("     " + (tabs.length ? "tabs walked: " + tabs.join(" ") : "no tab strip") +
    "  ·  " + sel.length + " selects, " + sheets.length + " sheets");

  /* ---- 1 EVERY NAMED CONTROL IS A <select>, AND IS NO LONGER A SHEET ---- */
  const missing = Object.keys(MENUS).filter((k) => !selKeys.has(k));
  const stillLit = Object.keys(MENUS).filter((k) => sheetKeys.has(k));
  check(!missing.length, "every control Paul named is a <select> " +
    JSON.stringify(missing.map((k) => MENUS[k])));
  check(!stillLit.length, "...and none of them is still a sheet " + JSON.stringify(stillLit));

  /* ---- 2 THE DEVELOPMENT WORDS ARE MENUS TOO — A REVERSAL, REWRITTEN ----
     THIS PAIR SAID THE OPPOSITE AND IT IS WORTH READING WHAT IT SAID, because
     the argument was a good one and it lost on the page rather than on paper:

         check(!devSel.length, "NO development word became a menu")
         check(devLit.length > 0, "the development words are still lit sheets")

     The reasoning behind it is at LIT above — "a per-voice, per-section choice
     among twenty-one melodic operators or sixty-eight kit words, where
     greying-with-a-reason is the whole point" — and Paul had drawn the line
     under it himself on the morning of 2026-08-24 ("the options for each
     instrument in a song section are now just one thing in a dropdown. That's
     not effective"). Then, having used the page: *"There are still many boxes
     that should be selects"*, said twice, the second time after the settled
     parameters had already gone back. There is no line left to draw: A
     SINGLE-CHOICE CONTROL IS A `<select>`, development words included.

     THE PART OF THE OLD CLAIM THAT SURVIVES IS THE PART THAT MATTERED, and it
     is asserted below and in test/sheets.js rather than lost with the widget:
     a greyed development word still says WHY in its own text. An <option>
     cannot carry a `<small class="nu-why">`, so ui/selects.js appends the
     reason to the option's own words and stamps `data-why` — checks 5 and 6
     read exactly that, and test/sheets.js gate 6 measures the eight words a
     pad greys and the sentence each of them prints. Nothing about greys got
     weaker; only the widget changed.

     Measured 2026-08-25 on the shipped page: 10 `dev.*` menus (5 line × 26
     options, 5 kit × 69) and 0 `dev.*` sheets. */
  const devSel = sel.filter((s) => /^dev\./.test(s.k)).map((s) => s.key);
  const devLit = LIT.filter((k) => sheetKeys.has(k));
  if (REAL) {
    check(devSel.length > 0, "EVERY development word is a menu now — " +
      devSel.length + " of them " + JSON.stringify([...new Set(devSel.map(bare))]));
    check(!devLit.length, "...and not one of them is still a lit sheet " +
      JSON.stringify(devLit));
  } else {
    notes.push("     (which widget a development word gets is ui/selects.js's " +
      "router over the shipped page — index.html only)");
  }

  /* ---- 3 nothing OFF the list quietly became a menu ----
     ...except by the one-option law, which is a menu for a different reason:
     "in general where there is ONE option a dropdown is preferred". A control
     off the list is a fail only if it was offering a real comparison. */
  /* ...and NO exemption for the key any more, on either page. There was one,
   * from 2026-08-25 morning until 2026-08-25 evening: the fixture still drew
   * `alphabet.key` as a menu after the shipped page had moved it onto a ring,
   * so `--page <harness>` tolerated the old <select> and named it. The fixture
   * draws the circle now (test/fixtures/selects-harness.html R4), so the
   * exemption is deleted rather than left sitting: an excuse that can no longer
   * be true can only ever hide the thing it was written to excuse, and a key
   * that came back as a <select> on EITHER page means the circle was quietly
   * un-done. */
  /* ...AND THE ALLOWLIST STOPPED BEING THE GATE, WHICH IS THE SAME REVERSAL
     CHECK 2 CARRIES AND IS WRITTEN DOWN THE SAME WAY. This read:

         const stray = sel.filter(s => !MENUS[s.k] && !MULTI[s.k] &&
           !FORM_NUDGE.test(s.k) && s.n > 1)
         check(!stray.length, "no control outside the list became a menu")

     — "exactly this list and no more", which is the right shape for a gate
     while the list is the design. It is not any more. Paul: *"There are still
     many boxes that should be selects"*, and MENUS is a transcript of one
     afternoon rather than a rule, so a control that went to a menu AFTER that
     afternoon (the rack's five `eng.*` sends and places, the three Performance
     nudges, the producer's own taps, the development words) turned this red
     for being right. Measured 2026-08-25 it named 48 of them.

     SO THE RULE IS ASSERTED INSTEAD OF THE LIST, and it is a stronger check
     than the one it replaces because it runs the other way round — off the
     PAGE rather than off the transcript, so a control this file has never
     heard of is still covered:

       A SINGLE-CHOICE CONTROL IN #app IS A `<select>`.

     Three things are deliberately not, and each is named with its reason:
       · the fx chips — more than one answer, so `<select multiple>`, which is
         the fieldset MULTI declares and check 12 drives;
       · the drum STEP GRID — sixteen independent booleans per lane, not a
         choice at all (test/sheets.js gate 8b counts its 48 boxes);
       · the CIRCLE OF FIFTHS — one choice, deliberately not a menu, because
         Paul asked for the diagram back ("Maybe put the circle of fifths back
         in there for key selection, it was nice") and a ring shows which keys
         are next door. Check 7 below is its gate.
       · a single boolean (mute, solo, diatonic, drums) is a checkbox, which is
         not a choice among options either.

     MENUS is kept and check 1 still runs it, because "every control Paul named
     by name is a menu" is a real and independent claim; what is gone is its
     converse. */
  const litSingles = sheets.filter((f) => f.inApp && !f.multi).map((f) => f.key);
  const radios = await p.evaluate(() => {
    const out = {};
    for (const i of document.querySelectorAll("#app input[type=radio]")) {
      // THE TWO THAT ARE ALLOWED, BY THE CONTAINER THEY ARE IN AND NOT BY NAME:
      // the circle's own fieldset, and a step grid's per-step play radio.
      if (i.closest("fieldset.nu-circ") || i.closest(".nu-grid")) continue;
      out[i.name] = (out[i.name] || 0) + 1;
    }
    return Object.keys(out).map((k) => k + " x" + out[k]);
  });
  check(!litSingles.length,
    "every single-choice control in #app is a <select> — still drawn as a lit " +
    "sheet: " + JSON.stringify(litSingles));
  check(!radios.length,
    "...and the only radio groups left are the circle of fifths and the step " +
    "grid — also found: " + JSON.stringify(radios));
  const byLaw = sel.filter((s) => !MENUS[s.k] && !MULTI[s.k] && !FORM_NUDGE.test(s.k) &&
    s.n <= 1).map((s) => s.key);
  if (byLaw.length) notes.push("     one-option law converted: " + JSON.stringify(byLaw));
  notes.push("     menus off Paul's own list, by the rule rather than by name: " +
    JSON.stringify([...new Set(sel.filter((s) => !MENUS[s.k] && !MULTI[s.k])
      .map((s) => bare(s.key)))]));

  /* THE CHANGES, THE MODE AND THE CIRCLE ARE ALL ON THE `Key` TAB (2026-08-27)
     and checks 4, 5, 5b, 7 and 9 all read them off the rendered page, so the
     page is put on that tab once, here, and left there. Nothing between here
     and check 10 touches the band. */
  await openTop("Key");

  /* ---- 4 THE CHORD QUALITY IS INSIDE THE CHANGES TABLE, ONE PER BAR ---- */
  const bars = await p.evaluate(() => (window.__D().alphabet.prog || []).length);
  const qual = sel.filter((s) => s.k === "alphabet.quality");
  const qualCell = qual.filter((s) => s.inCell).length;
  check(qual.length >= bars && bars > 0,
    "one quality menu per bar of the changes (" + qual.length + " for " + bars + " bars)");
  check(qual.length > 0 && qualCell === qual.length,
    "...and every one of them is in a table cell " + qualCell + "/" + qual.length);

  /* ---- 5 NO SILENT GREY. The one law both widgets exist for. ---- */
  const greyNoWhy = [], greyNotSaid = [];
  for (const s of sel) for (const o of s.opts) {
    if (!o.off && !o.why) continue;
    if (o.off && !o.why) { greyNoWhy.push(s.key + " / " + o.v); continue; }
    if (o.why && !o.t.endsWith(", " + o.why)) greyNotSaid.push(s.key + " / " + o.v);
  }
  check(!greyNoWhy.length, "NO SILENT GREY — every disabled <option> carries a reason " +
    JSON.stringify(greyNoWhy.slice(0, 5)));
  check(!greyNotSaid.length, "...and the reason is IN THE WORDS THE OPTION SAYS " +
    JSON.stringify(greyNotSaid.slice(0, 5)));
  // A DISABLED CONTROL SAYS WHY TWICE: on the element, where a gate and a
  // screen reader can both have it (selects.js stamps `data-why` and folds it
  // into the aria-label), and in the words on the page. The second half is
  // checked against body.innerText rather than against a fixed wrapper,
  // because a quality menu lives in a <td> and its reason is printed once
  // under the table.
  const offNoWhy = sel.filter((s) => s.disabled && !s.why).map((s) => s.key);
  check(!offNoWhy.length, "NO SILENT GREY — every disabled <select> carries data-why " +
    JSON.stringify(offNoWhy));
  /* REWRITTEN 2026-08-28 — same claim, asked where it can be true. It read:
     `const said = await p.evaluate((whys) => { const t =
     document.body.innerText; return whys.filter((w) => !t.includes(w)); },
     [...new Set(sel.filter((s) => s.disabled && s.why).map((s) => s.why))]);`
     — one reading of `body.innerText`, taken after the walk had left every
     panel it collected from. A reason on a panel that is `display: none` is not
     in `innerText` and never was; the check only passed because every refused
     select in the catalogue happened to be on the view the walk ended on. The
     survey now records the answer AT EACH VIEW (`saidWhy`), which is the same
     assertion made where the control actually is. */
  /* ...AND "AT LEAST ONE VIEW", NOT "EVERY VIEW", which is the second half of
     the same 2026-08-28 rewrite and is what the survey's shape forces. The
     query is `#app select[data-sel]` and the eight shut panels are
     `display: none` + `inert` but still in the DOM — so ONE refused control on
     the Band panel is collected nine times, once per view, and its reason is in
     `innerText` on exactly the one view that draws it. The claim is "the reason
     is on the page where the control is", so a reason is a failure only when no
     occurrence of it was ever printed. */
  const sawWhy = new Set(sel.filter((s) => s.saidWhy && s.why).map((s) => s.why));
  const said = [...new Set(sel.filter((s) => s.disabled && s.why &&
    !sawWhy.has(s.why)).map((s) => s.why))];
  check(!said.length, "...and every one of those reasons is printed on the page " +
    JSON.stringify(said));

  /* ---- 5b DRIVE IT DARK. Modal harmony has no changes (kernel.js:671 throws
     the progression away), so choosing a modal harmony must refuse every
     quality menu IN THE TABLE and say why — the same law test/sheets.js gate 5
     holds the sheet to, now on a <select> in a <td> where there is no fieldset
     to carry it. ---- */
  const dark = await p.evaluate(async () => {
    const h = document.querySelector('#app select[data-sel="alphabet.harmony"]');
    if (!h) return "no harmony menu";
    const os = [...h.options].filter((x) => !x.disabled && x.value !== "cycle");
    const o = os.find((x) => x.value === "modal") || os[0];
    if (!o) return "no non-cycle harmony";
    h.value = o.value; h.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    const q = [...document.querySelectorAll('#app select[data-sel^="alphabet.quality"]')];
    return { said: o.value, n: q.length, off: q.filter((x) => x.disabled).length,
             why: q.length ? q[0].dataset.why || "" : "",
             onPage: q.length ? document.body.innerText.includes(q[0].dataset.why || "\u0000") : false };
  });
  check(dark && dark.n > 0 && dark.off === dark.n && !!(dark.why || "").trim() &&
    dark.onPage, "a harmony with no changes refuses every quality menu, with the " +
    "reason on the page " + JSON.stringify(dark));

  /* ---- 6 A SHEET OF ONE OPTION IS A LABEL PRETENDING TO BE A CHOICE ---- */
  const lonely = sheets.filter((s) => s.n <= 1).map((s) => s.key + " n=" + s.n);
  // (a multi sheet is counted by its <option>s above, so it lands here honestly
  // rather than as a sheet of zero)
  check(!lonely.length, "no sheet anywhere renders one option " +
    JSON.stringify(lonely.slice(0, 8)));

  /* ---- 7 THE KEY IS THE CIRCLE OF FIFTHS -------------------------------
     (Paul, 2026-08-24: "Maybe put the circle of fifths back in there for key
     selection, it was nice.")

     This check used to be four lines and it read the key MENU's <option>s for
     the both-ways spelling. The spelling assertion survives whole — it is the
     thing Paul asked for in the same sentence he asked for menus and it is
     measured against eSpeak NG — and it is now read off the ring instead,
     along with everything the ring has to be that a list did not: twelve hours
     in fifths order, twelve relative minors inside them, a real focusable
     radio at every one of the twenty-four positions, arrow keys that walk
     ROUND rather than down, one gesture that answers two questions, no silent
     grey, and the whole thing still a readable fieldset with the stylesheet
     off. Every assertion is a query against the DOM the browser built or a
     gesture driven into it; nothing here asks a module what it would draw. */
  const circ = await p.evaluate(() => {
    const c = document.querySelector('#app .nu-circ[data-circ="alphabet.key"]');
    if (!c) return null;
    const ring = (cls) => [...c.querySelectorAll(".nu-opt." + cls)].map((l) => {
      const i = l.querySelector("input");
      const w = l.querySelector(".nu-w");
      const cs = i ? getComputedStyle(i) : null;
      return {
        v: l.dataset.v,
        word: w ? w.textContent.trim() : "",
        // WHAT A SCREEN READER IS HANDED, which is the label's whole text —
        // the visible word plus whatever `.nu-vh` adds beside it. Read off
        // textContent and not off an aria-label, because a <label> around an
        // <input> IS the accessible name and inventing a second one would be
        // the page telling the gate what it meant to say.
        said: l.textContent.replace(/\s+/g, " ").trim(),
        on: !!(i && i.checked), off: !!(i && i.disabled),
        // A REAL INPUT, NOT A PAINTED ONE. `display:none` and
        // `visibility:hidden` both leave the accessibility tree and the tab
        // order; the page's own law is clip-and-keep (PROGRAM.md §2.3).
        real: !!(i && i.tagName === "INPUT" && i.type === "radio" && !!i.name),
        gone: cs ? (cs.display === "none" || cs.visibility === "hidden") : true,
        k: i ? i.dataset.k || "" : "", why: i ? i.dataset.why || "" : "",
        ownWhy: !!l.querySelector(".nu-why"),
      };
    });
    const face = c.querySelector(".nu-circ-face");
    return {
      legend: (c.querySelector("legend") || {}).textContent || "",
      outer: ring("nu-ko"), inner: ring("nu-ki"),
      // THE FROZEN-DOM LAW (nukernel/MOTIF.md): the clock may only write inside
      // a `[data-live]` element, and no `[data-live]` subtree may contain a
      // control. A circle of twenty-four radios is a control, so it must be
      // neither inside one nor host one — asked of the artifact both ways.
      inLive: !!c.closest("[data-live]"),
      hostsLive: c.querySelectorAll("[data-live]").length,
      // ...and the ring strokes are decoration, so they must not eat the tap.
      // Measured 2026-08-25: `::after` is the face's last child and painted
      // over the whole inner ring, which made every relative minor untappable.
      strokes: face
        ? [getComputedStyle(face, "::before").pointerEvents,
           getComputedStyle(face, "::after").pointerEvents]
        : null,
      stillAMenu: !!document.querySelector('#app select[data-sel^="alphabet.key"]'),
    };
  });
  // ON BOTH PAGES, WITH NO RESERVATION. This block carried one for a day —
  // "check 7 is index.html only; the harness fixture still draws the key as a
  // menu" — in the shape of the reservations checks 10, 12 and 13 make for the
  // producer, the engineer's chips and the step grid. Those three are honest:
  // the harness genuinely cannot draw a live producer. This one was not: the
  // fixture could draw a circle and simply had not been taught one, and a gate
  // that excuses a fixture for being behind the page is a gate that stops
  // noticing when the page moves. The fixture was taught the circle on
  // 2026-08-25 (test/fixtures/selects-harness.html R4) and this now runs whole
  // wherever it is pointed.
  check(!!circ, "the key is a circle of fifths — one .nu-circ[data-circ=alphabet.key]");
  if (!circ) {
    notes.push("     (the rest of check 7 needs the circle and there is none)");
  } else {
  check(!circ.stillAMenu, "...and it is NOT also still a <select>");
  check(circ.legend.trim() === "key",
    "the circle is a fieldset that says what it is " + JSON.stringify(circ.legend.trim()));

  /* 7a TWELVE HOURS, IN FIFTHS ORDER, C AT THE TOP. The DOM order IS the ring
     order — that is the whole reason this widget can degrade to a list and
     still be right — so reading the labels top to bottom must give the circle
     of fifths and nothing else. */
  const outWords = circ.outer.map((o) => o.word);
  const outVals = circ.outer.map((o) => o.v);
  check(JSON.stringify(outWords) === JSON.stringify(FIFTHS.map((f) => f[0])),
    "twelve outer positions in fifths order, C at the top " + outWords.join(" "));
  check(JSON.stringify(outVals) === JSON.stringify(FIFTHS.map((f) => f[2])),
    "...and each hour carries the KEY VALUE that hour means " + outVals.join(" "));

  /* 7b TWELVE RELATIVE MINORS, INSIDE, AT THE SAME HOURS — and each one
     answering ITS OWN tonic, not its hour's. Am at C's hour must be key A. */
  const inWords = circ.inner.map((o) => o.word);
  check(JSON.stringify(inWords) === JSON.stringify(FIFTHS.map((f) => f[1])),
    "twelve inner relative minors at the same hours " + inWords.join(" "));
  check(JSON.stringify(circ.inner.map((o) => o.v)) === JSON.stringify(RELKEY),
    "...each answering its OWN tonic, not its hour's " +
    circ.inner.map((o) => o.word + "=" + o.v).join(" "));

  /* 7c EVERY POSITION IS A REAL FOCUSABLE INPUT. This is the property the
     original circle was built for and the one a canvas or a pile of <span>s
     would have thrown away. */
  const notReal = [...circ.outer, ...circ.inner].filter((o) => !o.real || o.gone)
    .map((o) => o.word);
  check(circ.outer.length === 12 && circ.inner.length === 12 && !notReal.length,
    "all 24 positions are real radios, clipped and never display:none " +
    JSON.stringify(notReal));
  const noKey = [...circ.outer, ...circ.inner].filter((o) => !o.k).map((o) => o.word);
  check(!noKey.length, "...and every one carries a data-k, so focus survives the " +
    "redraw " + JSON.stringify(noKey));

  /* 7d THE ENHARMONIC SPELLING PAUL ASKED FOR, still measured, now on the ring.
     ("key (although please spell things out like not just A# but A#/Bb)") */
  const missBlack = BLACK.filter((n) => !outWords.includes(n));
  check(!missBlack.length, "the circle spells the five black keys both ways " +
    JSON.stringify(missBlack.length ? missBlack : BLACK));
  const ascii = [...circ.outer, ...circ.inner].map((o) => o.said)
    .filter((t) => /[A-G](#|b)(?![a-z])/.test(t));
  check(!ascii.length, "...in ♯/♭ and not #/b — eSpeak says \"A hash slash B B\" " +
    "for the ASCII " + JSON.stringify(ascii));
  /* ...AND THE INNER RING SAYS THE BOTH-WAYS SPELLING TOO, out loud rather than
     on the page. "D♯m" is what fits on the tightest twelve positions on the
     page; the `.nu-vh` beside it is where the whole name goes, built from the
     same KEYLABEL the outer ring wears, so the ring cannot drift from the menu
     or from the staff. */
  const relSaid = circ.inner.filter((o, i) => {
    const outer = FIFTHS.find((f) => f[2] === RELKEY[i]);
    return !outer || !o.said.includes(outer[0] + " minor");
  }).map((o) => o.said);
  check(!relSaid.length, "each relative minor SAYS its tonic in full, both ways " +
    JSON.stringify(relSaid.length ? relSaid.slice(0, 3) : [circ.inner[3].said]));

  /* 7e WHAT IS TRUE RIGHT NOW. The outer ring is the key question: twelve
     values, exactly one of them true, always. The inner ring is a different
     question and may honestly have nothing checked. */
  const onOut = circ.outer.filter((o) => o.on);
  check(onOut.length === 1, "exactly one key is checked on the outer ring " +
    JSON.stringify(onOut.map((o) => o.word)));

  /* 7f NO SILENT GREY, on a diagram. gates.json carries no option rule for
     `alphabet.key`, so nothing on the shipped record greys here and this check
     passes by being vacuous — which is the point of writing it as an INVARIANT
     over whatever the page drew rather than as a list of expected greys. The
     day a rule lands on a key, the ring has to say why in the same three
     places every other control on this page does. */
  const greyNoWhy = [...circ.outer, ...circ.inner]
    .filter((o) => o.off && !(o.why && o.ownWhy)).map((o) => o.word);
  check(!greyNoWhy.length, "NO SILENT GREY — a greyed key carries data-why AND a " +
    "visible .nu-why " + JSON.stringify(greyNoWhy));
  const greyN = [...circ.outer, ...circ.inner].filter((o) => o.off).length;
  notes.push("     (" + greyN + " of 24 positions are greyed on this record — " +
    "gates.json has no option rule for alphabet.key, so the reason law above " +
    "is an invariant waiting for one)");

  /* 7g THE FROZEN-DOM LAW (nukernel/MOTIF.md). */
  check(!circ.inLive && circ.hostsLive === 0,
    "the circle is a control: not inside [data-live], and hosting none " +
    JSON.stringify({ inLive: circ.inLive, hostsLive: circ.hostsLive }));
  check(!!circ.strokes && circ.strokes.every((v) => v === "none"),
    "the ring strokes are decoration and do not swallow the tap " +
    JSON.stringify(circ.strokes));

  /* 7h THE KEYBOARD WALKS ROUND THE CIRCLE, driven. A radio group is one tab
     stop and the arrows traverse it in DOM ORDER, so this is the assertion
     that "the DOM order IS fifths order" is worth anything: stand on C, press
     the arrow three times, and the record must go C -> G -> D -> A. Three and
     not one, because one press cannot tell fifths order from any other order
     that happens to put G after C. */
  await p.evaluate(() => {
    const i = document.querySelector('#app .nu-circ .nu-ko[data-v="0"] input');
    if (i) { i.click(); }
  });
  await p.waitForTimeout(350);
  const walk = [];
  for (let n = 0; n < 3; n++) {
    await p.evaluate(() => {
      const on = document.querySelector('#app .nu-circ .nu-ko input:checked');
      if (on) on.focus({ preventScroll: true });
    });
    await p.keyboard.press("ArrowRight");
    await p.waitForTimeout(300);
    walk.push(await p.evaluate(() => String(window.__D().alphabet.key)));
  }
  check(JSON.stringify(walk) === JSON.stringify(["-5", "2", "-3"]),
    "the arrow keys walk ROUND the circle, C -> G -> D -> A " + JSON.stringify(walk));
  /* ...AND TAB LEAVES THE OUTER RING FOR THE INNER ONE, AND THE INNER ONE FOR
     THE MODE MENU BESIDE IT. A radio group is ONE tab stop with arrow-key
     traversal inside it (test/sheets.js says so in its own header), so "the
     keyboard tabs round the circle" means exactly two stops here: the key, then
     the relative minors, then out of the diagram into the mode. Driven with
     real Tab presses, because tabIndex reads 0 on every radio in a group and
     would have proved nothing. */
  const stops = [];
  await p.evaluate(() => {
    const on = document.querySelector('#app .nu-circ .nu-ko input:checked');
    if (on) on.focus({ preventScroll: true });
  });
  for (let n = 0; n < 2; n++) {
    await p.keyboard.press("Tab");
    stops.push(await p.evaluate(() => {
      const a = document.activeElement;
      return (a && a.dataset && a.dataset.k) || (a ? a.tagName.toLowerCase() : "none");
    }));
  }
  check(/^opt\|alphabet\.key\.rel\|/.test(stops[0]) && stops[1] === "sel|alphabet.mode",
    "Tab goes outer ring -> inner ring -> the mode menu beside the circle " +
    JSON.stringify(stops));

  /* 7i ONE TAP, TWO ANSWERS — the whole argument for the inner ring. Driven
     from a MAJOR record on purpose: a browser fires no `change` on a radio
     that was already checked, so tapping Am while the record is already in a
     minor would prove nothing at all. */
  await p.evaluate(async () => {
    const m = document.querySelector('#app select[data-sel="alphabet.mode"]');
    m.value = "ionian"; m.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await p.waitForTimeout(350);
  await p.evaluate(() => {
    const i = document.querySelector('#app .nu-circ .nu-ko[data-v="0"] input');
    if (i) i.click();
  });
  await p.waitForTimeout(350);
  const major = await p.evaluate(() => ({
    doc: { key: String(window.__D().alphabet.key), mode: window.__D().alphabet.mode },
    inner: [...document.querySelectorAll('#app .nu-circ .nu-ki input')]
      .filter((i) => i.checked).length }));
  check(major.doc.key === "0" && major.doc.mode === "ionian" && major.inner === 0,
    "in C major the outer ring is checked and the inner ring is not " +
    JSON.stringify(major));
  // A REAL POINTER TAP, AND THE STICKY BAR IS 52px OF THE TOP OF THE WINDOW.
  // `scrollIntoViewIfNeeded` parks an element at the edge of the viewport,
  // which on this page can be under `.nu-bar` — so the position is put in the
  // MIDDLE of the window first and then tapped, which is where a thumb would
  // have found it anyway. (This scroll is the gate's, not the page's; check
  // 7i's own no-scroll assertion is measured across the tap alone.)
  await p.evaluate(() => {
    const l = document.querySelector('#app .nu-circ .nu-ki[data-v="-3"]');
    if (l) l.scrollIntoView({ block: "center" });
  });
  await p.waitForTimeout(200);
  const yBefore = await p.evaluate(() => window.scrollY);
  await p.click('#app .nu-circ .nu-ki[data-v="-3"]');
  await p.waitForTimeout(450);
  const two = await p.evaluate(() => ({
    key: String(window.__D().alphabet.key), mode: window.__D().alphabet.mode,
    ko: [...document.querySelectorAll('#app .nu-circ .nu-ko input')]
      .filter((i) => i.checked).map((i) => i.value),
    ki: [...document.querySelectorAll('#app .nu-circ .nu-ki input')]
      .filter((i) => i.checked).map((i) => i.value),
    menu: document.querySelector('#app select[data-sel="alphabet.mode"]').value,
    y: window.scrollY }));
  check(two.key === "-3" && two.mode === "aeolian",
    "tapping Am answers TWO questions — the key of A, and minor " +
    JSON.stringify({ key: two.key, mode: two.mode }));
  check(two.menu === "aeolian" && JSON.stringify(two.ko) === '["-3"]' &&
        JSON.stringify(two.ki) === '["-3"]',
    "...and the ring and the mode menu beside it both show it " +
    JSON.stringify({ ko: two.ko, ki: two.ki, menu: two.menu }));
  /* ...AND THE TAP DID NOT MOVE THE PAGE. ui/eight.js's `restoreAnchor` clamps
     its own correction at ANCHOR_MAX = 240px and gives the window back to
     whoever touched it; a circle whose positions jumped under a thumb would be
     a circle you could not use twice in a row. */
  check(Math.abs(two.y - yBefore) <= 240,
    "...and tapping the circle did not scroll the page " + yBefore + " -> " + two.y);

  /* 7j PUSH IT TO DORIAN AND THE RING STAYS WHERE YOU PUT IT — the flow this
     round settled on (2026-08-25): tap Am and you have A minor, and you can
     still push it to A dorian with the menu next to it without the circle
     having to grow. The
     page must not act like it forgot which minor you are standing in, which is
     why `minorish` asks the interval table for a minor third instead of asking
     for the word "aeolian". */
  await p.evaluate(() => {
    const m = document.querySelector('#app select[data-sel="alphabet.mode"]');
    m.value = "dorian"; m.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await p.waitForTimeout(400);
  const dorian = await p.evaluate(() => ({
    mode: window.__D().alphabet.mode,
    ki: [...document.querySelectorAll('#app .nu-circ .nu-ki input')]
      .filter((i) => i.checked).map((i) => i.value) }));
  check(dorian.mode === "dorian" && JSON.stringify(dorian.ki) === '["-3"]',
    "pushing A minor to A dorian with the menu leaves Am lit on the ring " +
    JSON.stringify(dorian));

  /* 7k WITH THE STYLESHEET OFF IT IS A READABLE FIELDSET IN FIFTHS ORDER.
     The roundness is nu.css alone; take the sheet away and what is left has to
     be twenty-four labelled radios under a <legend>, in the order the circle
     goes. This is check 11's law asked of the one control on the page whose
     entire appearance is CSS. */
  const bare = await p.evaluate(() => {
    for (const s of document.styleSheets) try { s.disabled = true; } catch (e) {}
    const c = document.querySelector('#app .nu-circ[data-circ="alphabet.key"]');
    const words = [...c.querySelectorAll(".nu-opt .nu-w")].map((w) => w.textContent.trim());
    const t = document.body.innerText;
    const box = c.getBoundingClientRect();
    // THE CONTROL'S OWN RENDERED TEXT, not the page's. `body.innerText` contains
    // the word "key" in four other places ("the line stays in the key"), so a
    // check against it would pass on a page with no legend at all; what has to
    // be true is that the fieldset READS as "key" followed by its twenty-four
    // positions, which is exactly what a screen reader is handed.
    const fsText = c.innerText.replace(/\s+/g, " ").trim();
    return { words, missing: words.filter((w) => !t.includes(w)),
             legendFirst: /^key\b/.test(fsText), tall: box.height > 0,
             // A LIST OF WORDS AND NOT ONE LONG WORD. Twenty-four absolutely
             // positioned labels have no whitespace between them unless
             // somebody put it there, and with the stylesheet off the fieldset
             // read "key CGDAEBF♯/G♭…" until ui/selects.js did (2026-08-25).
             // Asserted on the FIRST FOUR HOURS, which are the four positions
             // whose words are single letters and therefore the four that
             // would run together invisibly.
             spaced: /\bC G D A\b/.test(fsText),
             reads: fsText.slice(0, 40) };
  });
  check(!bare.missing.length && bare.legendFirst && bare.tall && bare.spaced,
    "with the stylesheet off all 24 positions are still readable text under " +
    "their legend, one word at a time " +
    JSON.stringify(bare.missing.length ? bare.missing : bare.reads));
  check(JSON.stringify(bare.words) ===
        JSON.stringify(FIFTHS.map((f) => f[0]).concat(FIFTHS.map((f) => f[1]))),
    "...and they read in fifths order, outer ring then inner " +
    bare.words.slice(0, 4).join(" ") + " … " + bare.words.slice(-2).join(" "));
  // and put the sheet back, because checks 8-13 below are still to run
  await p.evaluate(() => {
    for (const s of document.styleSheets) try { s.disabled = false; } catch (e) {}
  });
  }

  /* ---- 8 EVERY MENU SAYS WHAT IT IS ---- */
  const unnamed = sel.filter((s) => !s.name).map((s) => s.key);
  check(!unnamed.length, "every menu has an accessible name " + JSON.stringify(unnamed));

  /* ---- 9 CHOOSING ONE MOVES THE RECORD — driven, not asked ---- */
  const before = await p.evaluate(() => window.__D().alphabet.mode);
  const moved = await p.evaluate(() => {
    const s = document.querySelector('#app select[data-sel="alphabet.mode"]');
    if (!s) return null;
    const o = [...s.options].find((x) => !x.disabled && x.value !== s.value);
    if (!o) return null;
    s.value = o.value;
    s.dispatchEvent(new Event("change", { bubbles: true }));
    return o.value;
  });
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => window.__D().alphabet.mode);
  check(moved != null && after === moved && after !== before,
    "choosing a mode moved the document " + before + " -> " + after +
    " (asked for " + moved + ")");
  const held = await p.evaluate(() => {
    const s = document.querySelector('#app select[data-sel="alphabet.mode"]');
    return s ? s.value : null;
  });
  check(held === after, "...and the redrawn menu shows it " + JSON.stringify(held));

  // …AND THE PRODUCER HAS HIS OWN TAB NOW (2026-08-27, Paul's list: "Produce").
  await openTop("Produce");

  /* ---- 10 THE PRODUCER'S ONE-OPTION SHEET, on the real page only ----
     Measured 2026-08-24: "add" -> "cantor" -> "add cantor — like what?" draws
     `prod.bare` with exactly ONE option. It is the only place the shipped page
     can reach the one-option law, so it is the only place the law can be
     proved on the artifact. On the harness the same spec is reproduced in the
     producer's own shape and check 6 covers it.

     THE TWO TAPS THAT GET THERE ARE MENUS THEMSELVES NOW, and this check could
     not reach its own subject any more. `tap()` did the right thing already
     (it took a `<select>` or a `.nu-opt`), but the line that PICKED the voice
     scope did not: it read `.nu-sheet[data-sheet="prod.scope"] .nu-opt`, found
     nothing, and returned the string "no voice scope" — which is the gate
     failing to walk to the control rather than the control being wrong. Since
     the settled-parameters conversion (check 2/3) every one of the producer's
     taps is a `<select>`: measured 2026-08-25, `prod.verb` 6 options,
     `prod.scope` 4 with `record` and `mix` greyed under "add", `prod.bare` 1.
     So the scope is chosen through whichever widget is there, exactly as
     `tap()` already was, and the assertion underneath is untouched.

     Note also `tap()`'s own bug, fixed here while its caller was: it set
     `select.value = v` with the OPTION'S OWN `data-v`, and ui/selects.js writes
     the machine value into `option.value`. Setting `.value` to a string that
     is not any option's value silently selects nothing — the assignment does
     not throw — and the change event then reported whatever was already
     chosen. */
  if (REAL) {
    const three = await p.evaluate(async () => {
      const tap = (k, v) => {
        const s2 = document.querySelector('select[data-sel="' + k + '"]');
        if (s2) {
          const o = [...s2.options].find((x) => x.dataset.v === v);
          if (!o || o.disabled) return false;
          s2.value = o.value;
          s2.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
        const l = document.querySelector(
          '.nu-sheet[data-sheet="' + k + '"] .nu-opt[data-v="' + v + '"] input');
        if (!l) return false;
        l.checked = true;
        l.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      };
      if (!tap("prod.verb", "add")) return "no verb";
      await new Promise((r) => setTimeout(r, 250));
      // WHO "add" MAY BE SAID ABOUT, off whichever widget offers it. A voice
      // scope is `v:<name>`; `record` and `mix` are greyed under this verb.
      const scMenu = document.querySelector('select[data-sel="prod.scope"]');
      const scope = scMenu
        ? ([...scMenu.options].find((o) => !o.disabled && /^v:/.test(o.dataset.v || "")) || {}).dataset
        : ([...document.querySelectorAll('.nu-sheet[data-sheet="prod.scope"] .nu-opt')]
            .find((l) => !l.querySelector("input").disabled && /^v:/.test(l.dataset.v)) || {}).dataset;
      if (!scope || !scope.v) return "no voice scope";
      if (!tap("prod.scope", scope.v)) return "scope tap failed";
      await new Promise((r) => setTimeout(r, 250));
      const lit = document.querySelector('.nu-sheet[data-sheet="prod.bare"]');
      const men = document.querySelector('select[data-sel="prod.bare"]');
      return { scope: scope.v, lit: !!lit,
               litN: lit ? lit.querySelectorAll(".nu-opt").length : 0,
               menu: !!men,
               menuN: men ? men.querySelectorAll("option:not([data-placeholder])").length : 0 };
    });
    check(three && three.menu === true && three.lit === false,
      "the producer's one-option tap is a menu, not a lit grid of one " +
      JSON.stringify(three));
  } else {
    notes.push("     (check 10 — the producer's live path — is index.html only)");
  }

  /* ---- 12 WHEREVER MULTIPLE IS ALLOWED IT IS THE STANDARD ELEMENT ----
     (Paul, 2026-08-24: "Wherever we allow multiple selections use a standard
     multiselect form element please.")

     Three assertions, all off the artifact: every control that allows more than
     one answer is a `<select multiple>` and is one of the declared ones; the
     ones declared are all present; and none of them is a one-row list box,
     which looks exactly like a closed dropdown and is therefore a trap. */
  const multis = sel.filter((s2) => s2.multi);
  const undeclaredMulti = multis.filter((s2) => !MULTI[s2.k]).map((s2) => s2.key);
  const missingMulti = Object.keys(MULTI).filter((k) => !multis.some((s2) => s2.k === k));
  const notAttr = multis.filter((s2) => !s2.multiAttr).map((s2) => s2.key);
  const oneRow = multis.filter((s2) => s2.size < 2).map((s2) => s2.key + " size=" + s2.size);
  // THE HARNESS DOES NOT DRAW THE ENGINEER, and the fx chips are the engineer's
  // (ui/engineer.js:360). So "the declared multi controls are all here" is a
  // claim about the SHIPPED PAGE, held only there — the same reservation
  // check 10 makes for the producer's live path. The other direction, "nothing
  // quietly became one", is held everywhere, because that one can fail on any
  // page that draws sheets at all.
  if (REAL)
    check(!missingMulti.length, Object.keys(MULTI).length
      ? "every control that allows multiple selection is a <select multiple> " +
        JSON.stringify(missingMulti.map((k) => MULTI[k].what))
      : "no multiple-choice control is left inside #app (" + multis.length +
        " <select multiple> there): the chips moved OFF the instruments onto " +
        "the board as `master.fx` (2026-08-26) and then off the board " +
        "altogether (2026-08-27, Paul: \"We can get rid of Character right?\") " +
        "into the strips' own three one-chip slots, which are <select>s — so " +
        "the page draws none, and this asserts it rather than assuming it");
  else if (missingMulti.length)
    notes.push("     (the harness draws no engineer, so " +
      JSON.stringify(missingMulti) + " is index.html only)");
  check(!undeclaredMulti.length, "...and no control quietly became one " +
    JSON.stringify(undeclaredMulti));
  check(!notAttr.length, "...written as the `multiple` ATTRIBUTE, not set by script " +
    JSON.stringify(notAttr));
  check(!oneRow.length, "...and none of them is a one-row list box pretending to be " +
    "a dropdown " + JSON.stringify(oneRow.length ? oneRow : multis.map((s2) => s2.key + " size=" + s2.size)));

  /* ---- 12b NO CHECKBOX IS LEFT STANDING FOR A MULTIPLE CHOICE ----
     The other direction, and the one a half-applied change would leave behind.
     Every checkbox on the page must be a SINGLE BOOLEAN or a STEP OF THE DRUM
     GRID; a checkbox inside a `.nu-sheet` would mean a multi sheet that did not
     convert. The step grid is emphatically NOT a multiselect — it is a grid of
     independent on/off steps, one per column, and it keeps its boxes. */
  const boxes = await p.evaluate(() => {
    const q = (s2) => [...document.querySelectorAll(s2)];
    return {
      inSheet: q("fieldset.nu-sheet input[type=checkbox]").map((c) => c.dataset.k || "(no key)"),
      grid: q(".nu-grid input[type=checkbox]").length,
      kcs: q(".nu-grid .nu-kc").length,
      // every remaining checkbox, by its key family, so a new one has to be
      // looked at rather than absorbed
      loose: [...new Set(q("input[type=checkbox]")
        .filter((c) => !c.closest(".nu-grid"))
        .map((c) => String(c.dataset.k || "(no key)").replace(/\|[^|]*$/, "|*")))].sort(),
    };
  });
  check(!boxes.inSheet.length, "no checkbox inside a sheet — a multiple choice is a " +
    "<select multiple> now " + JSON.stringify(boxes.inSheet.slice(0, 5)));
  // REWRITTEN 2026-08-27, per the reversal law. This held "the drum step grid
  // still has its N checkboxes". The Bench replaced them (Paul, 2026-08-27:
  // "velocity 0 to 7") with one velocity BUTTON per step — .nu-kc, its fill's
  // width the level; ui/eight.js drumGrid, driven on the render by
  // test/bench.test.js B5. THE CLAIM THIS GATE OWNS SURVIVES THE FACE: the
  // steps stay independent controls — no checkbox is left in any grid, and no
  // grid was folded into a <select multiple>.
  if (REAL || boxes.grid || boxes.kcs)
    check(boxes.grid === 0, "...and the drum step grid's checkboxes are gone — " +
      "independent velocity cells now (" + boxes.kcs + " .nu-kc on this tab, " +
      boxes.grid + " checkboxes left)");
  else notes.push("     (the harness draws no step grid — index.html only)");
  // THE SINGLE BOOLEANS, BY NAME. `drums` is the drummer's on/off (eight.js
  // :1943), `diatonic` and `ontime` are the two the producer owns, and
  // `eng|mute|*` / `eng|solo|*` / `b|mute|*` / `b|solo|*` are the engineer's and
  // the board's. Every one of them is ONE fact that is true or false.
  /* `v|mute|*` / `v|solo|*` LIVED FOR ONE DAY AND THE ENTRY IS KEPT, DATED.
     They arrived 2026-08-28 morning — Paul: *"simply move the sound controls
     out of the mixer and into this section"* — as ui/eight.js `voiceSound`'s
     own checkbox pair, drawn on the voice BESIDE the board's `b|mute|*` /
     `b|solo|*` buttons, in a separate namespace precisely so two controls for
     one fact could not share a `data-k`. Its own note said the duplication was
     "exactly the condition this codebase legislates against, and it is stated
     here rather than discovered later".

     THEY WENT THE SAME EVENING, with the whole of `voiceSound`. Paul: *"when i
     get to the strip it is just a bunch of dropdowns instead of a nice strip …
     that is a regression … add it in a new nav element called mix that is per
     voice."* The board's strip was LIFTED into the voice whole
     (ui/engineer.js `channelStrip`), so mute and solo are the `b|…` BUTTONS
     they always were, drawn once, now inside the voice. The `v|…` half is
     deleted and is asserted gone by this very pattern: a `v|mute|*` appearing
     again would mean the second spelling came back.

     `eng|…` is the older ghost, from the read-only engineer mirror that was
     deleted the same night; it is kept for the same reason. */
  const BOOLEANS = /^(drums|diatonic|ontime|(eng|b|v)\|(mute|solo)\|\*|\(no key\))$/;
  const oddBox = boxes.loose.filter((k) => !BOOLEANS.test(k));
  check(!oddBox.length, "every checkbox left on the page is a single boolean " +
    JSON.stringify(oddBox.length ? oddBox : boxes.loose));

  /* ---- 13 THE CAP, DRIVEN. Three chips is the limit (fields.js MAX_FX) and a
     <select multiple> cannot refuse a fourth the way an unticked checkbox
     could. So: pick three, prove the rest went grey WITH A REASON IN THEIR OWN
     WORDS, then force a fourth past the grey and prove the page refused it OUT
     LOUD rather than silently keeping three. ---- */
  // ...AND IT SURVIVES AN EMPTY `MULTI`. Until 2026-08-26 this pair could not
  // be undefined, because the table always had a row in it; when the one row
  // moved to the board the next line threw and took every assertion after it
  // with it — a broken gate asserts nothing, which is the failure this repo has
  // now made twice. The driver below is guarded by `multis.length` already; the
  // lookup has to be too.
  const capKey = Object.keys(MULTI)[0] || null;
  const capMax = capKey ? MULTI[capKey].max : 0;
  if (!multis.length) notes.push("     (check 13 — the cap, driven — has no " +
    "customer anywhere: the one capped multiselect went to the board as " +
    "`master.fx` on 2026-08-26 and was retired from it on 2026-08-27. MAX_FX " +
    "still caps a chain — three slots per strip — and desk-gate G15 drives THAT " +
    "cap on the control that now holds it. The driver is kept for the next " +
    "multiselect rather than deleted.)");
  else {
  await p.evaluate(() => {
    const v = window.__D().voices.find((x) => x.kind === "line");
    const t = v && document.querySelector('[data-k="tab' + v.name + '"]');
    if (t) t.click();
  });
  await p.waitForTimeout(250);
  const picked = await p.evaluate((k) => {
    const s2 = document.querySelector('#app select[data-sel^="' + k + '"]');
    if (!s2) return null;
    const want = [...s2.options].filter((o) => !o.disabled).slice(0, 3).map((o) => o.value);
    for (const o of s2.options) o.selected = want.includes(o.value);
    s2.dispatchEvent(new Event("change", { bubbles: true }));
    return want;
  }, capKey);
  await p.waitForTimeout(400);
  const atCap = await p.evaluate((k) => {
    const s2 = document.querySelector('#app select[data-sel^="' + k + '"]');
    if (!s2) return null;
    const on = [...s2.options].filter((o) => o.selected).map((o) => o.value);
    const off = [...s2.options].filter((o) => o.disabled);
    return { on, nOff: off.length,
             noWhy: off.filter((o) => !o.dataset.why).map((o) => o.value),
             notSaid: off.filter((o) => !o.textContent.endsWith(", " + o.dataset.why))
               .map((o) => o.value) };
  }, capKey);
  check(!!picked && !!atCap && atCap.on.length === capMax,
    "picking " + capMax + " chips leaves exactly " + capMax + " selected " +
    JSON.stringify(atCap && atCap.on));
  check(!!atCap && atCap.nOff > 0 && !atCap.noWhy.length && !atCap.notSaid.length,
    "...and every remaining option is greyed WITH THE REASON IN ITS OWN TEXT (" +
    (atCap && atCap.nOff) + " of them) " +
    JSON.stringify({ noWhy: (atCap || {}).noWhy, notSaid: (atCap || {}).notSaid }));
  const forced = await p.evaluate((k) => {
    const f = document.querySelector('fieldset.nu-sheet[data-multi] select[data-sel^="' + k + '"]');
    if (!f) return null;
    const four = [...f.options].find((o) => o.disabled && !o.selected);
    if (!four) return "nothing left to force";
    four.selected = true;                       // past the browser's own refusal
    f.dispatchEvent(new Event("change", { bubbles: true }));
    const fs = document.querySelector('fieldset.nu-sheet[data-multi]');
    const s2 = fs.querySelector("select");
    const cap = fs.querySelector('.nu-why[data-cap]');
    return { tried: four.value,
             on: [...s2.options].filter((o) => o.selected).map((o) => o.value),
             why: cap ? cap.textContent.trim() : "",
             onPage: cap ? document.body.innerText.includes(cap.textContent.trim()) : false,
             live: cap ? cap.getAttribute("aria-live") : null };
  }, capKey);
  check(forced && forced.on && forced.on.length === capMax && !forced.on.includes(forced.tried),
    "forcing a " + (capMax + 1) + "th selection does NOT enter the record " +
    JSON.stringify(forced && { tried: forced.tried, on: forced.on }));
  check(forced && !!forced.why && forced.onPage && forced.live === "polite",
    "...and the refusal is PRINTED beside the control, not silent " +
    JSON.stringify(forced && { why: forced.why, onPage: forced.onPage, live: forced.live }));
  }

  /* ---- 11 WITH THE STYLESHEET OFF IT STILL READS AS THE SAME DOCUMENT ---- */
  const off = await p.evaluate(() => {
    for (const s of document.styleSheets) try { s.disabled = true; } catch (e) {}
    const whys = [...document.querySelectorAll("#app .nu-sel > .nu-why")]
      .map((w) => w.textContent.trim()).filter(Boolean);
    const t = document.body.innerText;
    return { n: whys.length, missing: whys.filter((w) => !t.includes(w)).slice(0, 3) };
  });
  check(!off.missing.length, "with the stylesheet off, all " + off.n +
    " control-level reasons are still in body.innerText " + JSON.stringify(off.missing));

  check(!errs.length, "zero console errors / pageerrors " + JSON.stringify(errs.slice(0, 3)));

  for (const n of notes) console.log(n);
  for (const f of fails) console.log(f);
  console.log(fails.length ? "\nFAILED " + fails.length + " of " +
    (fails.length + notes.filter((n) => /^ok /.test(n)).length) + "  " + PAGE
    : "\nALL PASS  " + PAGE);
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
