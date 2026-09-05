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
 * ...AND SINCE 2026-09-02 A MENU ON THIS PAGE IS A COMBO BOX, WHICH IS WHY
 * EVERY QUERY BELOW READS `[data-sel]` AND NOT `select[data-sel]`. Paul, after
 * using the composer on staging: *"The combo boxes just don't work and are
 * confusing. I was expecting more of onfocus show custom dropdown then filter
 * based on input — one line instead of two."* ui/selects.js draws one control
 * now — an `<input role=combobox>` carrying the word, with a `<ul
 * role=listbox>` under it IN THE FLOW — and the reversal is argued in full at
 * `buildCombo` there.
 *
 * WHAT THIS FILE ASSERTS IS UNCHANGED, WORD FOR WORD, and that is the test of
 * whether the reversal was clean: "is a settled parameter drawn with the widget
 * it was decided to have", no silent grey, the reason in the option's own
 * words, the standing answer offered, one gesture moving the record. Only the
 * ELEMENT the assertions are read off has moved — `data-sel`, `data-k` and
 * `data-v` are byte-identical, an option is an `<li role=option>` where it was
 * an `<option>`, and `optionEls()` below is the one place that difference is
 * written down. `MENUS` is still the list of controls Paul named; what counts
 * as "a menu" is now `role=combobox`.
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
const CHANT = "#at=Rome&y=600&s=1";   // the shipped chant, named (2026-09-02)
const { chromium } = require("playwright");
/* THE ONE DRIVER FOR A MENU, shared with every other browser gate. It knows all
   three widgets `nukernel/src/menus/` draws (2026-09-06) and it is installed
   once, after the goto, because check 5b drives a control whose widget is now
   decided by the vocabulary rather than named in this file. */
const { installCombo } = require("./lib-combo.js");
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
  /* ...AND `time.groove` JOINED THE LIST, 2026-09-02. It is not a name Paul
   * typed on the evening of 2026-08-24 — nothing could have been, because the
   * control did not exist — but it is the same sentence's subject: *"We can
   * return some things to select menus: meter / reading speed / swing"*, and
   * the groove is the fourth member of exactly that family (fields.js says so
   * itself: swing, groove and meter are the three SONG facts with no FIELDS
   * row, "nothing in a section tells time"). It arrives by B7 — *"The tempo
   * editor does not reflect the richness of our tempo options"* — as a fact
   * that already reached the sound through ui/state.js `setGroove` and had no
   * control at all. One value for the whole record, decided once: a menu,
   * beside the two it belongs with. */
  "time.groove":      "groove",
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
  /* ...and `alphabet.scale`, 2026-09-02, on the same terms and by the same
   * sentence one clause along: Paul, B7, *"Key may not either"* — the key
   * editor does not reflect the richness of the options. The SUBJECT's
   * alphabet has been in the document since PROGRAM.md §2.1 named it and
   * document.js:172 has always resolved it; there was no sheet and no control,
   * so the one fact that decides how wide a phrase sings could only be changed
   * by editing JSON. A settled parameter of the mode's own kind — one value,
   * decided once — so it is the menu beside it and never a lit sheet. */
  "alphabet.scale":   "scale",
  // labelled "harmony" since 2026-08-27 (FUTURE.md §5: "two controls, one
  // heading" — the table alone keeps "the changes"); the KEY never moved.
  "alphabet.harmony": "harmony",
  "alphabet.quality": "chord quality, inside the changes table",
  "form.role":        "the band > form",
  "cast.part":        "voices > plays",
  /* `"cast.material": "voices > material"` STOOD HERE AND IS A DATED REVERSAL
   * (2026-09-02, the composer round, slice 2c) — kept as this line rather than
   * deleted, because the sentence that put it here is Paul's and the sentence
   * that takes it out is Paul's, and both are still true of the same fact.
   *
   * WHAT PUT IT HERE, 2026-08-24 evening: *"in voices -- plays, material,
   * instrument -- dropdowns/selects."* A voice's default cell is a settled
   * parameter — one value, decided once, not shopped — which is this file's own
   * test for a menu, and it was a menu.
   *
   * WHAT TAKES IT OUT, 2026-09-01 (B10): *"I need an obvious way to assign
   * multiple motifs to band members. Maybe a tray of motifs that pops up"*, and
   * (B8) *"the motif editor should show me previews."* The fact has not moved
   * and has not lost its owner — `avail.js cast.material` is still the one
   * setter, and ui/eight.js `motifTray` still writes through it — it has
   * changed DRAWING, to a chip per motif carrying that motif's `.nu-preview`.
   * An `<option>` cannot carry a picture.
   *
   * THIS IS THE SAME REVERSAL THE CIRCLE OF FIFTHS IS, argued the same way one
   * table down: *"the key has a shape, the oldest one in the trade, and drawn
   * as that shape twelve values … say something a list cannot."* A motif has a
   * shape too — sixteen bars of velocity — and it is the thing that tells two
   * of them apart before either name is read. So the tray joins the circle as
   * a NAMED exception to the single-choice-is-a-menu rule (see check 3's own
   * list, where it is written down with its reason), and test/band.browser.js
   * B3 is the gate that drives it: press a chip, and the record's default cell
   * moves.
   *
   * THE PER-SECTION HALF WAS A MENU UNTIL 2026-09-02 — see the tombstone under
   * `sound.instrument`, where it went and by whose sentence. */
  "sound.instrument": "voices > instrument",
  /* (`"material.cell": "voices > material, per section"` STOOD HERE and is a
   * WORD GRID since 2026-09-02. It was on this list for the reason written
   * beside it — "which cell a voice reads in the bridge is a settled
   * parameter", asked thirteen times down a column — and every word of that is
   * still true; what changed is that Paul named a better widget for exactly
   * that shape. *"When we go into structure make those tables of dropdowns
   * full of tappable grids that change options rather than dropdowns — like
   * the other selection table in mix. This is a powerful element for editing a
   * whole song — think on it and institutionalize it."* Thirteen menus down a
   * column IS the table that sentence is about. It is one column of a
   * `ui/wordgrid.js` grid now: a cell printing the word, a strip of chips
   * under the row when you open it, and the SAME address — `material.cell|
   * <voice>|<section>` is the cell's `data-k` where it was the select's
   * `data-sel`. Check 1a below asserts it is drawn as a cell, so this fact
   * cannot quietly stop being drawn at all; test/band.browser.js B3 drives it.) */
  /* ...and `sound.drumkit`, which joined the list on 2026-08-24 by the same
   * sentence and by a measurement. Paul asked "can i pick more than one options
   * for the drum kit?" and the selects round read that QUESTION as a request,
   * leaving it a lit sheet on the note that "multi-select is a row of
   * checkboxes and never a <select multiple>". Both halves are gone: he has
   * since asked for the standard multiselect element where multiple IS allowed
   * ("Wherever we allow multiple selections use a standard multiselect form
   * element please."), and multiple is NOT allowed here — document.js:192
   * writes `drumkit` as a STRING, to-engine.js:1141 does
   * `Object.assign(D, MACHINE_KIT[plan.kit])`, and every lane's hit is sent
   * with that one kit's models on it. So it is a voice's INSTRUMENT (avail.js
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
/* (`pace` joined this list 2026-09-02 — fields.js grew a `form.pace` row for
 * the mensural word compose.js has dealt onto every box since 2026-08-30, and
 * Paul asked for the tempo editor to reflect the richness of the options. It
 * is drawn on the TEMPO tab rather than in `sectionDetail`, which is why the
 * survey below finds it there and not under a section; the regex names the
 * KEY, and a key does not move when a row moves.) */
const FORM_NUDGE = /^(form|development)\.(env|intro|outro|mot|lvl|period|breath|pipe|pace)$/;
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
  await installCombo(p);
  await p.waitForFunction(() => document.querySelectorAll("#app [role=combobox], #app select, #app .nu-sheet").length > 0,
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
    /* AN OPTION IS AN `<li role=option>` ON A COMBO AND AN `<option>` ON THE
       ONE `<select multiple>` LEFT, AND THIS IS THE ONLY PLACE THAT
       DIFFERENCE IS WRITTEN DOWN (2026-09-02). Everything downstream reads
       `{ t, v, off, why }` and cannot tell which shape it came off, which is
       what let the twenty assertions below survive the reversal untouched.
       The listbox is ALWAYS in the DOM (`hidden` until the field is focused —
       ui/selects.js's own note says why: "every gate that reads the shape of
       the possible off the rendered artifact can still read it without opening
       forty controls"), so this is a query and never a gesture. */
    /* ...AND ON A CHIP SINCE 2026-09-06, WHICH IS THE THIRD WIDGET AND THE
       REASON THIS ROUND EXISTS. Paul, 2026-09-05: *"In general dropdowns
       barely work."* `nukernel/src/menus/` is the one owner of every menu on
       this page now and `src/menus/pick.ts` gives a vocabulary one of three —
       CHIPS up to eight words, the NATIVE `<select>` above eight on a coarse
       pointer, the TYPED COMBO above eight with a keyboard. `data-widget` says
       which, on the same addressed element, so this reader asks the ARTIFACT
       what it is instead of guessing from a tag. */
    /* ...AND ON A LOZENGE SINCE 2026-09-05, WHICH IS THE FOURTH (DESIGN.md
       component 16 · TABLE.md §11d). Paul: *"tight lozenges, organized by
       color and clustered semantically… visibility into all of the options."*
       Same `data-sel`, same `data-widget`, same `<field>|<value>` on every
       option — so this reader still asks the ARTIFACT what it is. */
    const widgetOf = (s) => s.dataset.widget ||
      (s.getAttribute("role") === "combobox" ? "combo"
       : s.classList.contains("nu-wchips") ? "chips"
       : s.classList.contains("nu-lzfield") ? "lozenge" : "native");
    const isCombo = (s) => widgetOf(s) === "combo";
    const optionEls = (s) => {
      const kind = widgetOf(s);
      if (kind === "lozenge") return [...s.querySelectorAll(".nu-lz")].map((o) => ({
        /* A LOZENGE'S TEXT IS ITS WORD, AND ONLY ITS WORD (2026-09-05). This
           read the whole button on purpose, because a refused lozenge PRINTED
           its reason as a second line inside itself (`.nu-lzwhy`). Paul, with
           the phone: *"you added sentences of text to some of them"* — so the
           sentence left the pill and the field kept one place for it. What
           carries the reason now is the option's ACCESSIBLE NAME (`aria-label`,
           `menu.withWhy`'s own join) plus `.nu-lzsay` on a tap or a long press,
           and `n` below is what check 5 reads for this widget. */
        t: o.textContent,
        n: o.getAttribute("aria-label") || o.textContent,
        v: o.dataset.v == null ? "" : o.dataset.v,
        off: o.disabled || o.getAttribute("aria-disabled") === "true",
        why: o.dataset.why || "", ph: o.hasAttribute("data-placeholder") }));
      if (kind === "chips") return [...s.querySelectorAll(".nu-wchip")].map((o) => ({
        t: o.textContent, v: o.dataset.v == null ? "" : o.dataset.v,
        off: o.disabled || o.getAttribute("aria-disabled") === "true",
        why: o.dataset.why || "", ph: o.hasAttribute("data-placeholder") }));
      if (kind !== "combo") return [...s.querySelectorAll("option")].map((o) => ({
        t: o.textContent, v: o.value, off: o.disabled,
        why: o.dataset.why || "", ph: o.hasAttribute("data-placeholder") }));
      const box = s.closest(".nu-combo") || s.parentElement;
      const list = box && box.querySelector("ul.nu-combolist");
      return list ? [...list.querySelectorAll("li[role=option]")].map((o) => ({
        t: o.textContent, v: o.dataset.v == null ? "" : o.dataset.v,
        off: o.getAttribute("aria-disabled") === "true",
        why: o.dataset.why || "", ph: o.hasAttribute("data-placeholder") })) : [];
    };
    return {
      sel: q("#app [data-sel]").map((s) => ({
        key: s.dataset.sel, k: bare(s.dataset.sel), name: nameOf(s),
        combo: isCombo(s), widget: widgetOf(s),
        // THE WORD A COMBO IS STANDING ON IS ITS `data-v` — its `.value` is the
        // LABEL a reader sees (and, while it is open, whatever is being typed
        // into it). `data-v` is the address the record answers to and it did
        // not move.
        value: s.dataset.v == null ? (s.value == null ? "" : s.value) : s.dataset.v,
        // THE COMBO BOX, READ OFF THE ARTIFACT. A menu on this page is a
        // `role=combobox` that owns a `role=listbox`, and the three are asked
        // for separately so "it says it is one" and "it has one" cannot pass
        // for each other.
        role: s.getAttribute("role") || s.tagName.toLowerCase(),
        expanded: s.getAttribute("aria-expanded"),
        controls: (() => { const id = s.getAttribute("aria-controls");
          const t = id && document.getElementById(id);
          return t ? t.getAttribute("role") : null; })(),
        // THE STANDARD MULTISELECT, READ OFF THE ARTIFACT. `.multiple` is the
        // property the browser resolved and `[multiple]` is the attribute in
        // the markup; both are recorded because a gate that trusted only the
        // property could be satisfied by a script setting it after the fact.
        multi: !!s.multiple, multiAttr: s.hasAttribute("multiple"),
        size: isCombo(s) ? 0 : s.size,
        inSheet: !!s.closest("fieldset.nu-sheet[data-multi]"),
        // ANSWERS, not option elements: selects.js prefixes a placeholder to
        // a control whose value is not in its own table ("choose one"), and
        // that is a state of the page, not a choice on offer.
        n: optionEls(s).filter((o) => !o.ph).length,
        inCell: !!s.closest("td"),
        disabled: !!s.disabled || s.getAttribute("aria-disabled") === "true",
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
        opts: optionEls(s),
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
      /* ...AND THE THIRD WIDGET, 2026-09-02 (wave 4). Paul: *"When we go into
         structure make those tables of dropdowns full of tappable grids that
         change options rather than dropdowns — like the other selection table
         in mix. This is a powerful element for editing a whole song — think on
         it and institutionalize it."* A `ui/wordgrid.js` CELL is a button
         printing the word it stands on, which grows a strip of option chips
         under its row when a thumb opens it. It carries the sheet's own
         address as `data-k`, so it is surveyed by the same key every other
         widget on this page answers to, and the checks below can ask "is this
         fact drawn AT ALL, and in which of the three" instead of naming a tag. */
      cells: q(".nu-wcell[data-k]").map((c) => ({ key: c.dataset.k,
        k: bare(c.dataset.k), inApp: !!c.closest("#app") })),
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
  /* ...AND IT FOLDS THE TREE FIRST, 2026-09-02 — see the loop below and
     test/sheets.js's own note: branches stay open now and a mark is a TOGGLE,
     so a walk needs a known starting shape or the second tap on a row closes
     what the first opened. `__eightUp()` is "fold everything", the gesture a
     hand makes to get back to the tabs. */
  /* ...AND `Time` AND `Rules` ARE NOT TABS ANY MORE (2026-09-06,
     nukernel/TABLE.md §10b): each is a MERGED ROW at the top of the Band
     table's own sheet, so the door is `__eightRow`, which opens Band and
     presses the row's head — a hand's two taps, and idempotent, so a second
     arrival does not close what the first opened. Every `#pan-band` /
     `#rulesdeck` selector below is the same selector inside `#pan-band`. */
/* ...AND THERE ARE FOUR OF THEM NOW, 2026-09-08 (§10b steps 4 and 5): MOTIFS
   is a merged row over the grid and PRODUCE one under the mix, so `Motifs` and
   `Produce` join `Time` and `Rules` in going through `__eightRow` instead of
   `__eightTab`. THE LIST IS WHY FIVE CHECKS IN THIS FILE HAVE BEEN RED SINCE
   v272 AND IT IS THE GATE'S OWN FAULT, measured: the census walks `TOPS`,
   `TOPS` is `__eightTabs()`, and `Time` and `Rules` came off that list in the
   round that made them rows — so `sel|time.meter`, `sel|time.swing`,
   `sel|time.groove`, `sel|alphabet.mode`, `sel|alphabet.scale`,
   `sel|alphabet.harmony` and every `alphabet.quality` cell of the changes grid
   dropped out of the survey and checks 1 and 4 went red on controls that were
   standing on the page the whole time. `ROWS` below is the missing half of the
   walk, and it is spelled as the four row ids rather than as tab words because
   that is what these doors take. */
  const ROWS = ["time", "rules", "motifs", "produce"];
  const openTop = async (t) => {
    if (!TOPS.length) return;
    if (ROWS.indexOf(String(t).toLowerCase()) >= 0) {
      await p.evaluate((x) => window.__eightRow(x, true), String(t).toLowerCase());
      await p.waitForTimeout(700); return; }
    await p.evaluate((tt) => { if (window.__eightUp) window.__eightUp();
                               window.__eightTab(tt); }, t);
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
    // `tcol-add|drums` SINCE 2026-09-05 (TABLE.md §9a, "no op lives in the
    // nav") — the same rewrite as test/sheets.js's, for the same reason: the
    // stripe's `adddrums` row is the table's own adder cell now.
    const add = document.querySelector('#pan-band [data-k="tcol-add|drums"]');
    if (add) { add.click(); return; }
    if (window.__addDrums) window.__addDrums(true);
  });
  await p.waitForTimeout(300);

  /* OFF THE STRIPE 2026-08-28, OFF THE TABLE'S OWN COLUMN HEADS 2026-09-09.
     `#tabs` was the band's horizontal strip; then it was the `band` level of
     `#nu-tray`; the gutter is deleted (TABLE.md §10b step 7) and the players
     are the table's COLUMN HEADS, which is where a thumb has opened them since
     wave 2b. The keys are `tcol|<name>` rather than `tab<name>` and the census
     below only needs the NAME, so it is taken off the head's own address. */
  const tabs = await p.evaluate(() =>
    [...document.querySelectorAll('#pan-band th.nu-colhead button[data-k^="tcol|"]')]
      .map((t) => "tab" + t.dataset.k.slice(5)));
  let sel = [], sheets = [], cells = [];
  const eat = (s) => { sel = sel.concat(s.sel); sheets = sheets.concat(s.sheets);
                       cells = cells.concat(s.cells || []); };
  // EVERY ONE OF THE NINE, FIRST — the Tempo tab's meter and swing, the Key
  // tab's mode, harmony and quality cells, the Motif tab's per-cell menus and
  // the producer's verbs are each on a panel of their own now, and none of
  // them is reachable from the band's strip.
  for (const t of TOPS) { await openTop(t); eat(await survey()); }
  /* ...AND THE FOUR SPECIAL ROWS, WHICH ARE WHERE FIVE OF PAUL'S OWN CONTROLS
     LIVE NOW. See `ROWS` above for the measurement: a walk of the tabs alone
     has not seen the meter, the swing, the groove, the mode, the scale, the
     harmony or the changes grid since v272. */
  for (const r of ROWS) { await openTop(r); eat(await survey()); }
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
  /* ...AND THE TREE IS FOLDED BEFORE EACH ONE, 2026-09-02. Paul: *"we should
     really work hard on nesting options inside the left nav."* Branches stay
     open and a mark is a TOGGLE, so tapping the member you are already inside
     folds it and every facet after the first would find no button. `openTop`
     folds first (see its own note); this loop taps a DIFFERENT member each
     time, and the fold is what keeps the previous one's facets from standing
     on the stripe while this one's are read. */
  for (const t of tabs) {
    await openTop("Band");
    /* ...AND A VOICE IS ONE SHEET SINCE 2026-09-04 (nukernel/TABLE.md wave
       2c). The three facets are deleted with the pane they switched: a player
       is a COLUMN of the Band table and its whole vector is one sheet, opened
       by its column head. So the walk that was "the mark, then each of its
       facets" is "the mark, then its column head" — one more surface than the
       stripe alone, exactly as before, and every `cast.*` and `sound.*` menu
       is on the page for the survey to eat.

       AND THE STRIPE'S OWN TAP WENT WITH THE STRIPE (2026-09-05). A
       `await p.click('[data-k="tab' + name + '"]')` stood at the head of this
       loop — the gutter mark a player used to be opened from — and there has
       been no such element since §10b step 7 deleted the tray. It did not
       report a missing control: `page.click` WAITS, so the whole gate died at
       `Timeout 30000ms exceeded · waiting for locator('[data-k="tabvoice"]')`
       and nothing after this line was measured at all. A door that no longer
       exists is a red on the FIRST player, not a census. The column head below
       is the only door there is, and it is the one a thumb uses. */
    const opened = await p.evaluate((k) => {
      const name = String(k).replace(/^tab/, "");
      const b = document.querySelector('#pan-band [data-k="tcol|' + name + '"]');
      if (!b) return false;
      if (b.getAttribute("aria-expanded") !== "true") b.click();
      return true;
    }, t);
    if (opened) { await p.waitForTimeout(300); eat(await survey()); }
  }
  /* ===== AND THE SECTION'S OWN QUESTIONS, WHICH ARE A TAB NOW (2026-09-02) ==
     Paul: *"Sections/Structure has the same challenges. … It should be top
     level, not buried under band, and below band."*

     `if (t === "tabform")` STOOD INSIDE THE VOICE WALK ABOVE — the form was a
     mark in the band level, and opening a section from it put
     `sectionDetail`'s menus on the page for the survey to eat. There is no
     `tabform`: the sections are `Structure`, and their questions are that
     panel's. The survey has to visit them or every `form.*` and per-section
     `dev.*` menu drops out of this file's census and the checks below start
     passing for want of a control rather than because it is a menu. */
  /* ...AND THEY ARE THE BAND TABLE'S ROWS SINCE 2026-09-04 (wave 2c). The
     Structure tab is deleted; a section's questions are the ROW SHEET, opened
     by the same `secnav<id>` mark in the stripe — the address did not move,
     the branch it hangs under did. The CELL sheet is visited too, because the
     per-section `dev.*` and `material.cell` menus are a CELL's now and would
     otherwise drop out of this file's census. */
  await openTop("Band");
  eat(await survey());
  const openedSec = await p.evaluate(async () => {
    /* THE SECTION IS THE TABLE'S OWN ROW HEAD SINCE 2026-09-09: `secnav<id>`
       was a row of the deleted gutter and `trow|<id>` is the head that opens
       the same sheet. */
    const s2 = document.querySelector('#pan-band th.nu-srowh button[data-k^="trow|"]');
    if (!s2) return false;
    s2.click();
    await new Promise((r) => setTimeout(r, 400));
    return true;
  });
  if (openedSec) { await p.waitForTimeout(300); eat(await survey()); }
  const openedCell = await p.evaluate(async () => {
    if (!window.__eightDoc) return false;
    const D = window.__eightDoc();
    const v = D.voices[0], s2 = D.form.sections[0];
    if (!v || !s2) return false;
    const c = document.querySelector('#pan-band [data-k="tcell|' + v.name + '|' + s2.id + '"]');
    if (!c) return false;
    /* A CELL TAKES TWO TAPS SINCE TABLE.md §11 (2026-09-05): the first
       selects (the ring, the formula bar), the second edits. */
    for (let i = 0; i < 2 && c.getAttribute("aria-expanded") !== "true"; i++) c.click();
    await new Promise((r) => setTimeout(r, 400));
    return true;
  });
  if (openedCell) { await p.waitForTimeout(300); eat(await survey()); }
  /* ...AND A COLUMN'S SHEET, 2026-09-05. `sound.instrument` and
     `sound.drumkit` are MENUS keys and they live in a CHAIR's sheet; while
     they were seated `ui/menus.js` widgets the walk found them somewhere else,
     and since the design pass they are drawn by the sheet itself (a clustered
     vocabulary earns the lozenge field — `src/table/model.ts shField`). A
     survey that never opened a column sheet was reporting on a control it had
     not looked at. */
  const openedCol = await p.evaluate(async () => {
    if (!window.__eightDoc) return false;
    const v = window.__eightDoc().voices[0];
    if (!v) return false;
    const c = document.querySelector('#pan-band [data-k="tcol|' + v.name + '"]');
    if (!c) return false;
    if (c.getAttribute("aria-expanded") !== "true") c.click();
    await new Promise((r) => setTimeout(r, 400));
    /* ...AND THE INSTRUMENT FIELD IS TAPPED OPEN. Since 2026-09-05 a clustered
       vocabulary is a POP-UP like every other strip of words on a sheet
       (DESIGN.md §2 components 4 and 6) rather than a seated menu that was in
       the DOM whether or not anybody asked. A survey that only looked at the
       resting sheet would report the control missing, which is a claim about
       where the gate looked. */
    for (const k of ["sound.instrument|" + v.name, "sound.drumkit|" + v.name]) {
      const f = document.querySelector('#pan-band .nu-wcell[data-k="' + k + '"]');
      if (f && !f.disabled && f.getAttribute("aria-expanded") !== "true") {
        f.click();
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    return true;
  });
  if (openedCol) { await p.waitForTimeout(400); eat(await survey()); }
  const selKeys = new Set(sel.map((s) => s.k));
  const sheetKeys = new Set(sheets.map((s) => s.k));
  notes.push("     " + (tabs.length ? "tabs walked: " + tabs.join(" ") : "no tab strip") +
    "  ·  " + sel.length + " menus (" + sel.filter((s) => s.combo).length +
    " combo boxes), " + sheets.length + " sheets");

  /* ---- 1 EVERY NAMED CONTROL IS A <select>, AND IS NO LONGER A SHEET ---- */
  const missing = Object.keys(MENUS).filter((k) => !selKeys.has(k));
  const stillLit = Object.keys(MENUS).filter((k) => sheetKeys.has(k));
  check(!missing.length, "every control Paul named is a combo box " +
    JSON.stringify(missing.map((k) => MENUS[k])));
  /* 1a — AND THE ONE THAT LEFT THIS LIST IS DRAWN, AS THE WIDGET IT LEFT FOR.
     A control taken off MENUS with no second claim about it is a control this
     file has stopped watching; `material.cell` is the per-section motif choice
     and the tombstone above says where it went. */
  const cellKeys = new Set(cells.map((c) => c.k));
  check(cellKeys.has("material.cell"),
    "1a …and the per-section motif choice is a WORD GRID (Paul, 2026-09-02: " +
    "\"tappable grids that change options rather than dropdowns\") — " +
    cells.filter((c) => c.k === "material.cell").length + " cells");
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
     options, 5 kit × 69) and 0 `dev.*` sheets.

     ...AND ON 2026-09-02 THEY STOPPED BEING MENUS, WHICH IS THE THIRD TIME
     THIS PAIR HAS TURNED OVER AND THE FIRST TIME IT LANDED WHERE BOTH OLD
     ARGUMENTS WANTED IT. Paul: *"When we go into structure make those tables
     of dropdowns full of tappable grids that change options rather than
     dropdowns — like the other selection table in mix. This is a powerful
     element for editing a whole song — think on it and institutionalize it."*
     A development word is exactly the subject of that sentence: a per-voice,
     per-section choice, asked once per section down a column, inside a table.
     The morning-of-2026-08-24 argument at LIT above ("you are SHOPPING —
     comparing many musical options at once, and 'you cannot say that here,
     because there is no drummer' is the most useful thing the page can tell
     you") gets its comparison back, and the evening argument ("a lit sheet of
     twelve keys is 500px of page spent saying a thing that fits in a word")
     keeps its word: a `ui/wordgrid.js` cell PRINTS the word and offers the
     twenty-one only when a thumb asks. Neither sentence lost.

     SO THE CLAIM IS THE SAME CLAIM WITH THE WIDGET RENAMED: every development
     word is drawn, none of them is a lit sheet, and the refusals still say why
     — which is checks 5 and 6 below and test/sheets.js gate 6, none of which
     name a tag. Measured on the shipped page 2026-09-02: 0 `dev.*` menus, 0
     `dev.*` sheets, and the words in `.nu-wcell` cells. */
  const devSel = sel.filter((s) => /^dev\./.test(s.k)).map((s) => s.key);
  const devCell = cells.filter((c) => /^dev\./.test(c.k)).map((c) => c.key);
  const devLit = LIT.filter((k) => sheetKeys.has(k));
  if (REAL) {
    check(devSel.length + devCell.length > 0,
      "EVERY development word is a WORD GRID now (menus until 2026-09-02) — " +
      devCell.length + " cells, " + devSel.length + " menus " +
      JSON.stringify([...new Set(devCell.concat(devSel).map(bare))]));
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
         not a choice among options either;
       · THE MOTIF TRAY (2026-09-02) — one choice (a member's default cell),
         deliberately not a menu, for the circle's exact reason: Paul asked for
         *"a tray of motifs"* and for *"previews"*, and an `<option>` cannot
         carry a picture. It is a row of `aria-pressed` buttons, each holding
         that cell's `.nu-preview`, and it is not a lit SHEET (no `data-sheet`,
         no radio group), so neither reading below sees it. test/band.browser.js
         B3 is its gate. The MENUS note for `cast.material` carries the whole
         argument.

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
    "every single-choice control in #app is a combo box — still drawn as a lit " +
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

  /* THE CHANGES, THE MODE AND THE CIRCLE ARE ALL ON THE `Time` TAB SINCE
     2026-09-04 (nukernel/TABLE.md §8: *"Tempo and Key fold into one Time
     structure"*). They were `Key`'s from 2026-08-27; the Alphabet axis did not
     move a line — `#pan-band` holds both axis sections now — so checks 4, 5,
     5b, 7 and 9 read them off the same page through a door with one word
     changed. Nothing between here and check 10 touches the band. */
  await openTop("Time");

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
    /* THE THIRD WIDGET SAYS IT ON ITS OWN LINE, AND THE CLAIM IS THE SAME
       CLAIM (2026-09-08). `optionText` appends a reason to the word it refuses
       — "the changes, a modal record has no cycle of changes to write" — and
       both the native picker and the typed combo carry it that way, so the
       tail is exactly what to demand of them. A CHIP cannot: nu.css's ruling
       on where a reason may live inside a chip strip is that it costs its OWN
       chip's height and nothing else's, so it is a `<small class="nu-why">`
       second line inside the button (`src/menus/`, 2026-09-07) and the button's
       textContent is the word and then the reason with no comma between them.
       Demanding the comma of a two-line control would be demanding it be a
       one-line control, which is the widget question and not the silent-grey
       one. So the LAW — the reason is in the words the option says, on the
       glass, where a reader is — is asked of the text either way; the SPELLING
       is asked of the two widgets that have one. §10d predicted this exact
       fork for `rules-view` R5a and picked the other branch there because the
       chip had no visible reason at all; it has one now. */
    /* ...AND A CHIP HAS TWO PLACES A REASON MAY HONESTLY BE, which is
       `src/menus/index.ts`'s own ruling and not a loophole: its OWN why is a
       `<small class="nu-why">` line inside the button, and the WHOLE STRIP's
       refusal is printed ONCE under the control by `menu()` — *"a tooltip
       repeating a sentence already on the glass is the noise the refused-
       control law is against"*. When a strip is refused, every option carries
       the strip's sentence in `data-why`, so demanding it inside each chip
       would be demanding the same sentence four times on one line. The second
       case is not unchecked: the control-level claim three checks down reads
       every `s.why` back out of the visible text of the panel it was collected
       from. MEASURED on the shipped chant: `rule-add|Form` is one chip,
       refused whole, "every rule this axis has is already on the record". */
    /* A LOZENGE IS THE THIRD SPELLING (2026-09-05, DESIGN.md component 16).
       It was read as a chip while it printed a `<small class="nu-lzwhy">`
       second line inside the button; Paul photographed forty-two pills with
       sentences in two of them (*"you added sentences of text to some of
       them"*) and that line is gone. A field of forty-two words is a SHAPE and
       a sentence inside one word destroys it — which is the widget question,
       and this check is the silent-grey one. So the law is asked where the
       reason now IS for this widget: the option's own accessible NAME, which
       is what a screen reader says on it and what `.nu-lzsay` prints under it
       when a thumb taps or holds it. Still never a `title` and never nowhere:
       `.nu-lz` is `aria-disabled` and not `disabled` precisely so that a tap
       on a refused word can answer it (src/lozenge/field.ts law 6), and T12n
       in test/table.browser.js drives that tap on the rendered phone. */
    const twoLine = s.widget === "chips";
    const said = s.widget === "lozenge"
      ? ((o.n || "").indexOf(o.why) >= 0 || o.why === s.why)
      : twoLine
      ? (o.t.indexOf(o.why) >= 0 || o.why === s.why)
      : o.t.endsWith(", " + o.why);
    if (!said) greyNotSaid.push(s.key + " / " + o.v + " [" + s.widget + "]");
  }
  check(!greyNoWhy.length, "NO SILENT GREY — every refused option carries a reason " +
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
  check(!offNoWhy.length, "NO SILENT GREY — every refused menu carries data-why " +
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

  /* ---- 5b DRIVE IT DARK — AND IT DOES NOT GO DARK ANY MORE.
     REWRITTEN IN PLACE 2026-09-02 (wave 4). Paul, on the deployed composer:
     *"I can't change chord quality, it's grayed."*

     WHAT THIS ASSERTED: *"Modal harmony has no changes (kernel.js:671 throws
     the progression away), so choosing a modal harmony must refuse every
     quality menu IN THE TABLE and say why."* Every word of the mechanism is
     still true — `chordsOf` reads `c.q` only under `harmony === "cycle"`, and
     gates.json's `when alphabet.harmony.cycle` is an honest measurement of a
     record as it stands. What was wrong was the CONCLUSION: the grid whose
     menus were greyed is the one place a composer says "this record has
     changes", so the refusal was a door locked from the inside.
     THE GRID SETS THE HARMONY ITSELF NOW (ui/eight.js chordGrid `asCycle`),
     which turns a refusal into a stated side effect — so what is asserted here
     is the pair: NOT ONE quality menu in the table is disabled on a modal
     record, and the sentence "editing the changes makes the harmony a cycle"
     is printed under the table where the reason used to be. NO SILENT GREY's
     other half: nothing changes a second axis quietly either.
     THE SHEET-LEVEL CLAIM IS NOT ABANDONED, it moved to where it is still
     true: test/sheets.js gate 5 drives the same modal record through the
     `avail.js` harness, which this wave did not touch — avail.js goes on
     measuring, and only this grid routes around what it measured. ---- */
  const dark = await p.evaluate(async () => {
    const h = document.querySelector('#app [data-sel="alphabet.harmony"]');
    if (!h) return "no harmony menu";
    /* THE SAME GESTURE, WHICHEVER WIDGET IT IS (2026-09-06). `alphabet.harmony`
       is THREE words, so `src/menus/pick.ts` draws it as a strip of chips now
       and it has no `<li role=option>` to read — which is exactly the silent
       no-op test/lib-combo.js's header was written about, and it turned this
       check red the hour the rule moved ("no non-cycle harmony", on a control
       that offers three). `window.__combo` is the one driver every browser gate
       shares and it knows all three; the CLAIM below has not moved a word. */
    const words = window.__combo.words(h)
      .filter((x) => !x.off && !x.ph);
    const os = words.filter((x) => x.v !== "cycle");
    const o = os.find((x) => x.v === "modal") || os[0];
    if (!o) return "no non-cycle harmony";
    if (!window.__combo.say(h, o.v)) return "the harmony refused " + o.v;
    await new Promise((r) => setTimeout(r, 300));
    const q = [...document.querySelectorAll('#app [data-sel^="alphabet.quality"]')];
    return { said: o.v, harmony: window.__D().alphabet.harmony,
             n: q.length, off: q.filter((x) => x.disabled).length,
             said2: document.body.innerText
               .includes("editing the changes makes the harmony a cycle") };
  });
  check(dark && dark.n > 0 && dark.off === 0 && dark.said2,
    "a harmony with no changes leaves every quality menu LIT and says what " +
    "editing them will do " + JSON.stringify(dark));

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
      /* `stillAMenu` READS BOTH SHAPES (2026-09-02). It asked for a
         `<select>`, which after the combo-box reversal could only ever be
         false — an excuse that cannot fail is the thing this file's own note
         about deleted exemptions objects to. The key coming back as a MENU is
         what must not happen, whichever element a menu is made of today. */
      stillAMenu: !!document.querySelector(
        '#app [data-sel^="alphabet.key"][role=combobox], ' +
        '#app select[data-sel^="alphabet.key"]'),
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
  check(!circ.stillAMenu, "...and it is NOT also still a menu");
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
  /* THE SECOND STOP IS THE MODE FIELD'S FIRST FOCUSABLE, AND SINCE 2026-09-05
     THAT IS A CLUSTER HEADING (DESIGN.md component 16). `alphabet.mode` is a
     lozenge field now — forty-two modes in ten families — and its first tab
     stop is the first family's fold button, `alphabet.mode|cluster|<word>`,
     with the lozenges under it on a roving tab stop. The CLAIM is unchanged
     and is about the diagram: two stops take you out of the circle and into
     the mode control. Which element of that control the keyboard lands on is
     the control's business, so this asks for either spelling of its head. */
  const MODEHEAD = /^(sel\|alphabet\.mode$|alphabet\.mode\|cluster\||lz\|alphabet\.mode$)/;
  check(/^opt\|alphabet\.key\.rel\|/.test(stops[0]) && MODEHEAD.test(stops[1] || ""),
    "Tab goes outer ring -> inner ring -> the mode menu beside the circle " +
    JSON.stringify(stops));

  /* 7i ONE TAP, TWO ANSWERS — the whole argument for the inner ring. Driven
     from a MAJOR record on purpose: a browser fires no `change` on a radio
     that was already checked, so tapping Am while the record is already in a
     minor would prove nothing at all. */
  /* SAID THROUGH THE SHARED DRIVER, 2026-09-05. This wrote `.value` and fired
     `change` — the typed combo's own commit path, which `ui/selects.js`
     documents as the fallback — and a `<div class="nu-lzfield">` has no
     `.value` at all, so the day `alphabet.mode` became a lozenge field this
     line set a property on a div and the record did not move. That is the
     SILENT NO-OP test/lib-combo.js exists to prevent, and `window.__combo.say`
     is the one driver that knows all four widgets. */
  await p.evaluate(async () => {
    const m = document.querySelector('#app [data-sel="alphabet.mode"]');
    window.__combo.say(m, "ionian");
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
    menu: document.querySelector('#app [data-sel="alphabet.mode"]').dataset.v,
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
    const m = document.querySelector('#app [data-sel="alphabet.mode"]');
    window.__combo.say(m, "dorian");
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

  /* ---- 7L THE MENU IS ONE OF THREE WIDGETS, AND IT IS ONE CONTROL -------
     (Paul, 2026-09-02: "The combo boxes just don't work and are confusing. I
     was expecting more of onfocus show custom dropdown then filter based on
     input — one line instead of two.")

     THIS SAID "EVERY MENU IN #app IS AN `<input role=combobox>`" AND IT WAS
     RIGHT UNTIL 2026-09-05, when Paul said the next sentence — *"In general
     dropdowns barely work"* — and the phone said why (see check 7P below, and
     `nukernel/src/menus/pick.ts` for the whole measurement). A combo box is a
     good control WITH A KEYBOARD and a bad one without, so it is now one of
     three that `nukernel/src/menus/` draws, chosen by the vocabulary and the
     pointer. The claim is re-pointed and not weakened: a menu is a control this
     page's ONE menu owner drew, and it says which widget it is on the artifact
     (`data-widget`), so a hand-rolled `<select>` appearing somewhere new is
     still a fail — it would carry no `data-widget` and no `data-sel` and would
     be caught by check 3's law and by desk-gate's own sweep.

     The three combo claims under it are unchanged and now ask only the menus
     that ARE combos: a combo owns a `role=listbox` through `aria-controls`, it
     is shut until a hand asks, and there is no second box above it — the
     `.nu-combo-filter` the wrapper round drew is gone from the page. */
  /* FOUR WIDGETS SINCE 2026-09-05 (DESIGN.md component 16 · TABLE.md §11d).
     Paul: *"tight lozenges, organized by color and clustered semantically…
     visibility into all of the options."* A vocabulary that knows what KIND
     each of its words is — the modes and scales by `genres-tables.js
     SCALEFAMILY`, the instruments by `instruments.js familyOf`, the kernel's
     chord families — is drawn as a LOZENGE FIELD on every pointer now, which
     is the fourth thing `src/menus/index.ts` may return. It carries the same
     `data-sel` / `data-k` / `data-v` and says `data-widget="lozenge"`, so this
     gate's law is unchanged: every menu in #app is one of the widgets the
     module draws, and a hand-rolled `<select>` is still a fail. */
  const WIDGETS = ["combo", "chips", "native", "lozenge"];
  const notCombo = sel.filter((s) => !s.multi && WIDGETS.indexOf(s.widget) < 0)
    .map((s) => s.key + " is a " + s.role + " / " + s.widget);
  check(!notCombo.length, "every menu in #app is one of the three widgets " +
    "ui/menus.js draws — also found: " + JSON.stringify(notCombo.slice(0, 6)));
  notes.push("     widgets drawn: " + JSON.stringify(WIDGETS.map((w) =>
    w + " x" + sel.filter((s) => s.widget === w).length).join(" · ")));
  const noList = sel.filter((s) => s.combo && s.controls !== "listbox")
    .map((s) => s.key);
  check(!noList.length, "...and each owns a role=listbox through aria-controls " +
    JSON.stringify(noList));
  const gaping = sel.filter((s) => s.combo && s.expanded !== "false").map((s) => s.key);
  check(!gaping.length, "...shut until a hand asks for it (aria-expanded=false) " +
    JSON.stringify(gaping));
  const twoBoxes = await p.evaluate(() =>
    document.querySelectorAll(".nu-combo-filter").length);
  check(twoBoxes === 0, "...and the second box is GONE — \"one line instead of " +
    "two\" (" + twoBoxes + " .nu-combo-filter on the page)");

  /* ---- 7M IT OPENS ON A TAP, FILTERS ON A KEY, AND MOVES THE RECORD ----
     The whole of Paul's sentence, driven as a thumb and a keyboard: tap the
     field, the list is under it IN THE FLOW and does not scroll inside itself;
     type three letters and the list is the words that match; Enter writes the
     record. Then the half he did not have to ask for: after the redraw the
     page puts the thumb back on the same control (`data-k`) and the list stays
     SHUT — the 2026-08-25 bug ("When I select something the box just pops up
     again") must not come back wearing a new element. */
  await openTop("Time");
  const wasMode = await p.evaluate(() => window.__D().alphabet.mode);
  /* ---- WHICH WIDGET THIS VOCABULARY EARNED, ASKED OF THE PAGE ----------
     `alphabet.mode` was a typed combo when this check was written and is a
     LOZENGE FIELD since 2026-09-05: forty-two modes in ten families, all of
     them on the glass. The claims below split rather than move, because the
     two halves of Paul's sentence belong to different widgets — *"one line
     instead of two"* is a combo's, and *"visibility into all of the options"*
     is a lozenge's — and the half he did NOT have to ask for is the same for
     both: after the redraw the thumb is back on the control and nothing has
     popped up. That half is asserted on whichever widget is drawn. */
  const modeWidget = await p.evaluate(() => {
    const f = document.querySelector('#app [data-sel="alphabet.mode"]');
    return f ? (f.dataset.widget || null) : null; });
  if (modeWidget === "lozenge") {
    const lz = await p.evaluate(() => {
      const f = document.querySelector('#app [data-sel="alphabet.mode"]');
      const all = [...f.querySelectorAll(".nu-lz")];
      const secs = [...f.querySelectorAll(".nu-lzcluster")];
      return { n: all.length,
        rect: all.filter((c) => c.getBoundingClientRect().height > 0).length,
        short: all.filter((c) => c.getBoundingClientRect().height < 43.5).length,
        clusters: secs.length,
        hues: [...new Set(secs.map((x) =>
          getComputedStyle(x).getPropertyValue("--lz").trim()))].length,
        sideways: document.documentElement.scrollWidth -
                  document.documentElement.clientWidth }; });
    check(lz.n > 12 && lz.rect === lz.n && lz.clusters > 1,
      "the modes are a LOZENGE FIELD with every one of them on the glass, in " +
      "its own kind " + JSON.stringify(lz));
    check(lz.short === 0 && lz.sideways === 0,
      "...every lozenge 44px of thumb, and the page does not scroll sideways " +
      JSON.stringify({ short: lz.short, sideways: lz.sideways }));
    const wrote = await p.evaluate(() => {
      const f = document.querySelector('#app [data-sel="alphabet.mode"]');
      const cold = [...f.querySelectorAll(".nu-lz")].find((c) =>
        c.getAttribute("aria-pressed") !== "true" && !c.disabled &&
        c.dataset.v && !c.hasAttribute("data-placeholder"));
      if (!cold) return null;
      const want = cold.dataset.v;
      cold.click();
      return { want }; });
    await p.waitForTimeout(450);
    const landed = await p.evaluate(() => {
      const f = document.querySelector('#app [data-sel="alphabet.mode"]');
      return { mode: window.__D().alphabet.mode, still: !!f,
        hot: f ? [...f.querySelectorAll(".nu-lz")]
          .filter((c) => c.getAttribute("aria-pressed") === "true")
          .map((c) => c.dataset.v) : [] }; });
    check(!!wrote && landed.mode === wrote.want && landed.mode !== wasMode,
      "a tap on a lozenge writes the record " +
      JSON.stringify({ was: wasMode, now: landed.mode, want: wrote && wrote.want }));
    check(landed.still && landed.hot.includes(String(wrote && wrote.want)),
      "...and NOTHING DISMISSES under the thumb: the field is still there with " +
      "the word it wrote standing hot " + JSON.stringify(landed.hot));
  } else {
  await p.click('#app [data-sel="alphabet.mode"]');
  await p.waitForTimeout(250);
  const opened = await p.evaluate(() => {
    const f = document.querySelector('#app [data-sel="alphabet.mode"]');
    const ul = (f.closest(".nu-combo") || f.parentElement).querySelector("ul.nu-combolist");
    const fr = f.getBoundingClientRect(), ur = ul.getBoundingClientRect();
    const cs = getComputedStyle(ul);
    return { expanded: f.getAttribute("aria-expanded"), hidden: ul.hidden,
             rows: [...ul.querySelectorAll("li[role=option]")].filter((l) => !l.hidden).length,
             // IN THE FLOW: the list is under the field, it is not positioned
             // out of the document, and it has no scroller of its own.
             below: ur.top >= fr.bottom - 1, tall: ur.height > 0,
             pos: cs.position, ownScroll: ul.scrollHeight > ul.clientHeight + 1,
             sideways: document.documentElement.scrollWidth -
                       document.documentElement.clientWidth };
  });
  check(opened.expanded === "true" && !opened.hidden && opened.rows > 1,
    "a tap opens the list under the field " + JSON.stringify(
      { expanded: opened.expanded, rows: opened.rows }));
  check(opened.below && opened.tall && opened.pos === "static" &&
        !opened.ownScroll && opened.sideways === 0,
    "...IN THE FLOW: under the field, not positioned out of the page, and it " +
    "never scrolls inside itself " + JSON.stringify(opened));
  /* THE LETTERS ARE TAKEN OFF THE PAGE AND NOT TYPED INTO THIS FILE, because
     the thing being proved is that the FILTER works and not that a mode is
     spelled a particular way. A mode's WORD is not its value (`aeolian` is
     labelled "natural minor", measured 2026-09-02), and a gate that had typed
     a value would have proved the filter broken when it was the gate that was
     wrong. So: three letters out of the middle of a word this control is
     actually offering, and every word left standing must contain them. */
  const seed = await p.evaluate(() => {
    const f = document.querySelector('#app [data-sel="alphabet.mode"]');
    const ul = (f.closest(".nu-combo") || f.parentElement).querySelector("ul.nu-combolist");
    const other = [...ul.querySelectorAll("li[role=option]")]
      .find((l) => l.getAttribute("aria-disabled") !== "true" &&
                   !l.hasAttribute("data-placeholder") && l.dataset.v !== f.dataset.v &&
                   l.textContent.trim().length >= 4);
    return other ? { v: other.dataset.v, word: other.textContent.trim() } : null;
  });
  const letters = seed ? seed.word.slice(1, 4) : "";
  await p.keyboard.type(letters);
  await p.waitForTimeout(200);
  const typed = await p.evaluate(() => {
    const f = document.querySelector('#app [data-sel="alphabet.mode"]');
    const ul = (f.closest(".nu-combo") || f.parentElement).querySelector("ul.nu-combolist");
    return { typed: f.value,
             shown: [...ul.querySelectorAll("li[role=option]")]
               .filter((l) => !l.hidden).map((l) => l.textContent.trim()),
             active: f.getAttribute("aria-activedescendant") };
  });
  const want = new RegExp(letters.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  check(!!seed && typed.shown.length > 0 && typed.shown.length < 12 &&
        typed.shown.every((w) => want.test(w)) && !!typed.active,
    "typing " + JSON.stringify(letters) + " filters the list to the words that " +
    "carry it, and the first match is active " + JSON.stringify(typed));
  await p.keyboard.press("Enter");
  await p.waitForTimeout(450);
  const committed = await p.evaluate(() => {
    const f = document.querySelector('#app [data-sel="alphabet.mode"]');
    const ul = (f.closest(".nu-combo") || f.parentElement).querySelector("ul.nu-combolist");
    return { mode: window.__D().alphabet.mode, word: f.value, v: f.dataset.v,
             expanded: f.getAttribute("aria-expanded"), hidden: ul.hidden,
             focus: document.activeElement === f,
             // and every word is back on the page: a filter that outlived its
             // own list would hide options from every gate that reads them
             rows: [...ul.querySelectorAll("li[role=option]")].filter((l) => !l.hidden).length,
             all: ul.querySelectorAll("li[role=option]").length };
  });
  check(!!seed && committed.mode !== wasMode && committed.v === committed.mode &&
        want.test(committed.word),
    "Enter writes the record and the field says the word " +
    JSON.stringify({ was: wasMode, now: committed.mode, word: committed.word }));
  check(committed.focus && committed.expanded === "false" && committed.hidden,
    "...and after the redraw the thumb is back on the control with the list " +
    "SHUT — the box does not pop up again " + JSON.stringify(
      { focus: committed.focus, expanded: committed.expanded }));
  check(committed.rows === committed.all,
    "...and the filter did not outlive its list: all " + committed.all +
    " words are back on the page");
  }

  /* ---- 8 EVERY MENU SAYS WHAT IT IS ---- */
  const unnamed = sel.filter((s) => !s.name).map((s) => s.key);
  check(!unnamed.length, "every menu has an accessible name " + JSON.stringify(unnamed));

  /* ---- 9 CHOOSING ONE MOVES THE RECORD — driven, not asked ---- */
  const before = await p.evaluate(() => window.__D().alphabet.mode);
  /* THROUGH THE SHARED DRIVER, 2026-09-05. This reached into `li[role=option]`
     — the typed combo's own shape — and returned null the day `alphabet.mode`
     became a lozenge field, which is the SILENT NO-OP test/lib-combo.js's own
     header was written about. `window.__combo` knows all four widgets and
     reads the address, never the tag. */
  const moved = await p.evaluate(() => {
    const s = document.querySelector('#app [data-sel="alphabet.mode"]');
    if (!s) return null;
    const o = window.__combo.words(s)
      .find((x) => !x.off && !x.ph && x.v && x.v !== s.dataset.v);
    if (!o) return null;
    return window.__combo.say(s, o.v) ? o.v : null;
  });
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => window.__D().alphabet.mode);
  check(moved != null && after === moved && after !== before,
    "choosing a mode moved the document " + before + " -> " + after +
    " (asked for " + moved + ")");
  const held = await p.evaluate(() => {
    const s = document.querySelector('#app [data-sel="alphabet.mode"]');
    // `data-v` is what a combo box is standing on; `.value` is the word it
    // prints, which is the same fact spelled for a reader.
    return s ? s.dataset.v : null;
  });
  check(held === after, "...and the redrawn menu shows it " + JSON.stringify(held));

  // …AND THE PRODUCER HAS HIS OWN TAB NOW (2026-08-27, Paul's list: "Produce").
  /* ...AND HIS OWN ROW SINCE 2026-09-08 (§10b step 5), which `openTop` knows
     about: the Produce PANE is deleted and `ui/produce.js mount` is seated in
     the footer's last merged row, unchanged, so every tap below finds the same
     control at the same address one surface over. */
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

     ...AND `prod.verb` IS GONE, 2026-09-01 (Paul: "The only verb is 'make'
     from now on. Make X Y."). The measurement above stands as the day's
     record; today the walk is two taps, not three, and `prod.bare` is still
     the one sheet on the page with a single option — it is a target of `make`
     now, because the retired `add` verb's bare option and its lane anchors
     were folded into `make`'s target list. The assertion underneath is STILL
     untouched: the law being proved is the widget, not the verb.

     ...AND THAT LAST SENTENCE IS THE ONE THAT MOVED, 2026-09-02. `prod.bare`
     is not a sheet at all any more — it is a button, one press, and this check
     now proves that the page has NO one-option menu and NO lit grid of one
     where its single offer is. The argument is written out in full at the
     assertion itself, beside the line it replaces.

     Note also `tap()`'s own bug, fixed here while its caller was: it set
     `select.value = v` with the OPTION'S OWN `data-v`, and ui/selects.js writes
     the machine value into `option.value`. Setting `.value` to a string that
     is not any option's value silently selects nothing — the assignment does
     not throw — and the change event then reported whatever was already
     chosen. */
  if (REAL) {
    const three = await p.evaluate(async () => {
      const tap = (k, v) => {
        const s2 = document.querySelector('[data-sel="' + k + '"]');
        if (s2) {
          // a combo box's words are its <li role=option>s; a <select>'s are
          // its <option>s. Both carry `data-v`, which is the option's own word
          // and is what this walk has always addressed.
          const box = s2.closest(".nu-combo") || s2.parentElement;
          const o = [...box.querySelectorAll("li[role=option]"),
                     ...s2.querySelectorAll("option")]
            .find((x) => x.dataset.v === v);
          if (!o || o.disabled || o.getAttribute("aria-disabled") === "true") return false;
          s2.value = o.dataset.v;
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
      // THE VERB TAP STOOD HERE and is deleted, 2026-09-01: it read
      // `if (!tap("prod.verb", "add")) return "no verb";` and `add` was the
      // verb whose target list holds the one-option sheet. Paul: "The only
      // verb is 'make' from now on. Make X Y." — so tap one IS the scope, and
      // "just add it" is a target of `make` (producer.js targets(), where the
      // retired verb's own bare option and its lane anchors were folded in).
      //
      // ...AND THE SCOPE MENU IS A ROW OF CHIPS, 2026-09-02. It read:
      //   const scMenu = document.querySelector('select[data-sel="prod.scope"]');
      //   const scope = scMenu
      //     ? ([...scMenu.options].find((o) => !o.disabled &&
      //         /^v:/.test(o.dataset.v || "")) || {}).dataset
      //     : ([...document.querySelectorAll(
      //         '.nu-sheet[data-sheet="prod.scope"] .nu-opt')]
      //         .find((l) => !l.querySelector("input").disabled &&
      //           /^v:/.test(l.dataset.v)) || {}).dataset;
      //   if (!scope || !scope.v) return "no voice scope";
      //   if (!tap("prod.scope", scope.v)) return "scope tap failed";
      // Paul, COMPOSER.md §1 B12: "Design a good producer interface." The cast
      // is a wrapped row of `<button data-k="cast|<id>">`, one pressed. A gate
      // that cannot walk to its own subject is the GATE failing (this file's
      // own sentence, three checks up), so the walk moves and the assertion
      // underneath does not.
      const chip = [...document.querySelectorAll('[data-k^="cast|v:"]')]
        .find((b) => !b.disabled);
      if (!chip) return "no voice scope";
      chip.click();
      await new Promise((r) => setTimeout(r, 250));
      const scope = chip.dataset.k.slice(5);
      const lit = document.querySelector('.nu-sheet[data-sheet="prod.bare"]');
      const men = document.querySelector('[data-sel="prod.bare"]');
      const btn = document.querySelector('[data-k="prod.bare"]');
      return { scope, lit: !!lit,
               litN: lit ? lit.querySelectorAll(".nu-opt").length : 0,
               menu: !!men,
               menuN: men ? (men.closest(".nu-combo") || men)
                 .querySelectorAll("li[role=option]:not([data-placeholder]),option:not([data-placeholder])").length : 0,
               button: !!btn && btn.tagName === "BUTTON",
               word: btn ? btn.textContent.trim() : null };
    });
    /* THE ASSERTION THAT STOOD HERE, AND WHY IT IS REWRITTEN RATHER THAN
       DELETED (2026-09-02). It read:

         check(three && three.menu === true && three.lit === false,
           "the producer's one-option tap is a menu, not a lit grid of one " +
           JSON.stringify(three));

       The law behind it is Paul, 2026-08-24: *"in general where there is ONE
       option a dropdown is preferred"*, and it STANDS, unchanged, everywhere
       it was pointed — check 6 above holds it on the harness for every spec
       that is a CHOICE, and nothing on the shipped page draws a lit grid of
       one word.

       What moved is that `prod.bare` stopped being a choice. "just add it" is
       the only thing on its list and always was; the sheet existed because the
       page had no other way to say a target. The producer's redesign gives it
       one — the sentence is finished by a press — so a menu you must open to
       pick the only thing in it is two gestures for a one-gesture fact. A
       button is not "a dropdown of one" losing to a lit grid of one; it is the
       widget for doing a thing rather than for choosing between things.

       So this check now holds BOTH halves at the artifact, which the old one
       could not: the lone offer is a button, and there is no one-option menu
       or lit grid left of it. */
    check(three && three.button === true && three.menu === false &&
          three.lit === false,
      "the producer's lone offer is a BUTTON — one press, no menu to open and " +
      "no lit grid of one " + JSON.stringify(three));
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
     deleted the same night; it is kept for the same reason.

     `rubato` JOINED THEM 2026-09-02 (the composer round, slice 2a). Paul, B7:
     *"The tempo editor does not reflect the richness of our tempo options."*
     The tempo map's on/off has lived in ui/state.js since the map was written
     — its own localStorage key, its own note ("a DEVICE setting like the
     volume … somebody working against a grid turns the breathing off for
     their machine, not for the record") — and nothing on the page could reach
     it. It is exactly what this list is for: ONE fact that is true or false,
     so it is a checkbox and not a menu, and it is named here rather than
     matched by a pattern for the same reason every other name on this line is.
     */
  const BOOLEANS = /^(drums|diatonic|ontime|rubato|(eng|b|v)\|(mute|solo)\|\*|\(no key\))$/;
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

  /* ==== 7P · AND IT WORKS ON A PHONE, WHICH IS THE WHOLE OF THIS ROUND ====
     Paul, 2026-09-05: *"In general dropdowns barely work."*

     EVERY CHECK ABOVE RUNS AT 1280 WITH A MOUSE AND A KEYBOARD, and every one
     of them was green on the widget Paul was complaining about — which is the
     standing "test the artifact" failure said one axis along: the gate was
     measuring the right object on the wrong machine. So this block opens a
     SECOND context with `hasTouch` and a `(pointer: coarse)` media override at
     390x844 and asks the four questions a thumb asks. What it found on the
     widget this round replaced, before the replacement (the full table is in
     `nukernel/src/menus/pick.ts`): 33 of 33 menus came up as a focused,
     WRITABLE `<input type=text>` — a soft keyboard, every time — and with that
     keyboard eating 320 of the 844 pixels, NINE of the thirteen menus driven
     had exactly ONE option a thumb could reach without scrolling, `rule.instr.0`
     among them at 1 of 120. Four of thirteen flashed open and shut inside the
     one gesture.

     THE KEYBOARD IS ASSERTED AS ITS CAUSE AND NOT AS ITS SYMPTOM, because a
     headless browser has no soft keyboard to measure: what raises one is a
     focused editable `<input>`, so "no menu on a coarse pointer is a typed
     input" IS the claim "no menu can be covered by a keyboard", stated where a
     machine can check it. */
  {
    const ctx2 = await b.newContext({ hasTouch: true,
      viewport: { width: 390, height: 844 } });
    const p2 = await ctx2.newPage();
    const errs2 = [];
    p2.on("pageerror", (e) => errs2.push("pageerror: " + e.message));
    await p2.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
    const cdp = await ctx2.newCDPSession(p2);
    await cdp.send("Emulation.setEmulatedMedia", { features: [
      { name: "pointer", value: "coarse" }, { name: "any-pointer", value: "coarse" },
      { name: "hover", value: "none" }, { name: "any-hover", value: "none" }] });
    await cdp.send("Emulation.setTouchEmulationEnabled",
      { enabled: true, maxTouchPoints: 5 });
    await p2.goto(PAGE + CHANT, { waitUntil: "networkidle" });
    await installCombo(p2);
    await p2.waitForTimeout(1200);
    const coarse2 = await p2.evaluate(() => matchMedia("(pointer: coarse)").matches);
    check(coarse2, "the phone pass really is a coarse pointer (the checks under " +
      "this are worthless if it is not)");
    /* THE WHOLE PAGE, NOT THE FIRST TAB OF IT — the same walk the survey above
       makes, through the page's own tab door. */
    const tops2 = await p2.evaluate(() =>
      window.__eightTabs ? window.__eightTabs() : []);
    let ph = [];
    /* THE WALK IS THE TABS AND THEN THE FOUR SPECIAL ROWS, 2026-09-08, for the
       same measured reason the census above walks them: five of the controls
       Paul named by hand are rows of the Band table's own sheet now, and a
       phone pass that only opened tabs found none of them — measured, before
       this line: "0 addressed controls across 6 tabs". */
    /* AND EACH ROW REMEMBERS WHICH SURFACE IT WAS SEEN ON, 2026-09-08. The
       drive below re-queries every control by its `[data-sel]` in whatever
       state the page happens to be in when the loop reaches it — which was
       true enough while the walk ended on a tab full of menus and is false
       now that it ends inside a special row: measured, before this line, "0
       menus driven". A menu that is not on the screen is not a menu that
       failed to commit; it is a gate that walked away from it. `at` is the
       index of the opener that put it there and the drive re-opens it. */
    const opens = [];
    const step2 = async (open, wait) => {
      const at = opens.length; opens.push({ open, wait });
      await open();
      await p2.waitForTimeout(wait);
      ph = ph.concat((await p2.evaluate(() =>
        [...document.querySelectorAll("[data-sel]")].map((n) => {
          const r = n.getBoundingClientRect();
          return { k: n.dataset.sel, tag: n.tagName,
                   widget: n.dataset.widget || null,
                   typed: n.tagName === "INPUT",
                   h: Math.round(r.height),
                   n: window.__combo.words(n).filter((o) => !o.ph).length };
        }))).map((r) => ({ ...r, at })));
    };
    for (const t of tops2)
      await step2(() => p2.evaluate((tt) => {
        if (window.__eightUp) window.__eightUp(); window.__eightTab(tt); }, t),
        t === "Score" ? 900 : 250);
    for (const r of ROWS)
      await step2(() => p2.evaluate((x) => window.__eightRow(x, true), r), 700);
    const byKey = new Map();
    for (const r of ph) if (!byKey.has(r.k)) byKey.set(r.k, r);
    const rows = [...byKey.values()];
    check(rows.length > 20, "the phone pass found the menus (" + rows.length +
      " addressed controls across " + tops2.length + " tabs and " +
      ROWS.length + " special rows)");
    /* 1 · NO MENU IS A TYPED INPUT. See the paragraph above: this is the
           keyboard claim, said where it can be measured. */
    const typed = rows.filter((r) => r.typed).map((r) => r.k);
    check(!typed.length, "on a coarse pointer NO menu is a typed input — a " +
      "focused editable <input> is what raises a soft keyboard, and a keyboard " +
      "is what hid the list " + JSON.stringify(typed.slice(0, 6)));
    /* 2 · AND EACH IS ONE OF THE THREE WIDGETS A THUMB GETS — three since
           2026-09-05 (DESIGN.md component 16 · TABLE.md §11d). Paul, of the
           long vocabularies: *"tight lozenges, organized by color and
           clustered semantically by the kind of things they present… VISIBILITY
           INTO ALL OF THE OPTIONS"*, and §11d in as many words: *"It replaces
           the native picker for these vocabularies on EVERY POINTER; the
           native picker stays only where a vocabulary is long AND FLAT."*
           So the claim is not weakened, it is corrected: what a thumb may
           never get is the TYPED COMBO (check 1 above, which is the one this
           whole pass was written about), and a vocabulary that knows its own
           kinds gets the field that draws them, on a phone as on a desk. */
    const wrongW = rows.filter((r) => r.widget !== "chips" &&
      r.widget !== "native" && r.widget !== "lozenge")
      .map((r) => r.k + " is " + r.widget);
    check(!wrongW.length, "...and every one of them is CHIPS, the NATIVE " +
      "picker or the LOZENGE FIELD, which is src/menus/pick.ts's answer for a thumb " +
      JSON.stringify(wrongW.slice(0, 6)));
    /* 3 · A CONTROL IS A THUMB TARGET. 44px, this page's own `--tap`. */
    const short = rows.filter((r) => r.h > 0 && r.h < 43)
      .map((r) => r.k + " " + r.h + "px");
    check(!short.length, "...and each is at least 44px tall, which is what a " +
      "thumb needs " + JSON.stringify(short.slice(0, 6)));
    /* 4 · IT OPENS, COMMITS AND CLOSES BY TAP. Driven at real coordinates on
           one of each widget, because a value written by script would pass on a
           control nothing can reach. A chip is tapped; a native picker's own
           wheel is the platform's and cannot be opened from here, which IS the
           reason it is the right widget — it cannot be covered by the page or
           scrolled off by the pane under it — so it is driven at its address
           and the record is read back. */
    const drove = [];
    let standing = -1;
    for (const r of rows.slice(0, 400)) {
      if (r.n < 2) continue;
      /* AN ADD MENU IS A VERB AND HAS NOTHING TO STAND ON (2026-09-05).
         `rule-add|<axis>` offers "+ add a rule" and the kinds of rule you may
         add; saying one ADDS that rule and the control goes back to offering,
         so `data-v` is "" afterwards BY DESIGN. The claim under this loop is
         "a tap commits and the menu stands on the word that was said", which
         is a claim about a menu that holds a VALUE. It surfaced here only
         because the census grew — the lozenge fields added rows and moved
         which eight controls fall inside the drive window — and a claim that
         passes or fails on ordering is a claim asked of the wrong control.
         (What an add menu DOES is gated where it belongs:
         test/rules-view.browser.js drives `rule-add` and reads the rule back
         off the record.) */
      if (/^rule-add\|/.test(r.k)) continue;
      if (r.at !== standing && opens[r.at]) {
        standing = r.at;
        await opens[r.at].open();
        await p2.waitForTimeout(opens[r.at].wait);
      }
      const done = await p2.evaluate(async (k) => {
        const q = '[data-sel="' + k.replace(/"/g, '\\"') + '"]';
        const n = document.querySelector(q);
        if (!n) return null;
        n.scrollIntoView({ block: "center" });
        await new Promise((r2) => setTimeout(r2, 60));
        const was = n.dataset.v;
        const want = window.__combo.words(n)
          .find((o) => !o.off && !o.ph && o.v !== was);
        if (!want) return null;
        const box = n.getBoundingClientRect();
        if (box.top < 0 || box.bottom > innerHeight) return null;
        const took = window.__combo.say(n, want.v);
        await new Promise((r2) => setTimeout(r2, 250));
        const now = document.querySelector(q);
        return { k, was, want: want.v, took,
                 // the widget is SHUT afterwards: a strip has no open state and
                 // a native picker's popup is the platform's own
                 open: now ? now.getAttribute("aria-expanded") === "true" : false,
                 now: now ? now.dataset.v : null };
      }, r.k);
      if (done) drove.push(done);
      if (drove.length >= 8) break;
    }
    const stuck = drove.filter((d) => d.now !== d.want).map((d) => d.k);
    const gaping2 = drove.filter((d) => d.open).map((d) => d.k);
    check(drove.length >= 5 && !stuck.length,
      "...and a TAP commits: " + drove.length + " menus driven at their own " +
      "rects on the phone, every one of them standing on the word that was " +
      "said " + JSON.stringify(stuck.slice(0, 4)));
    check(!gaping2.length, "...and each is shut again afterwards " +
      JSON.stringify(gaping2.slice(0, 4)));
    check(!errs2.length, "...with zero console errors on the phone " +
      JSON.stringify(errs2.slice(0, 3)));
    await ctx2.close();
  }

  for (const n of notes) console.log(n);
  for (const f of fails) console.log(f);
  console.log(fails.length ? "\nFAILED " + fails.length + " of " +
    (fails.length + notes.filter((n) => /^ok /.test(n)).length) + "  " + PAGE
    : "\nALL PASS  " + PAGE);
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
