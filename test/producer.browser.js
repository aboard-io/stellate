#!/usr/bin/env node
/* test/producer.browser.js — D4's ARTIFACT gate. THE PRODUCER, TAPPED.
 *
 * (Paul, 2026-08-24: "we've lost the producer entirely.")
 *
 * test/producer-eight.test.js proves the producer's ARITHMETIC — 26 checks over
 * 5 rungs and 200 random stacks, in node, with no DOM. It cannot prove that
 * three taps on a phone reach the compiler, because the taps are radios inside
 * a fieldset that sheets.js drew, the landing is `ctx.changed()`, and the thing
 * that has to move is a timeline in audio/plan.js on the other side of push().
 * PROGRAM.md §5 names three things and this file is those three:
 *
 *   · three real taps -> window.__eightProd() shows the note with a non-empty
 *     `said`
 *   · the compiled bar the ENGINE is handed changes, measured off the
 *     audio/plan.js timeline
 *   · "take it off" restores it byte-identical
 *
 * THE THREE TAPS ARE PAUL'S OWN SENTENCE. "make" -> "the sound" -> "punk", the
 * three-tap version of "more punk", because the shipped record is a chant with
 * no drummer: tap two offers `record / cantor / schola / mix` and nothing else,
 * so a gate that tapped "drums" would be testing a record this page does not
 * ship. Measured 2026-08-24: the note moves the chant from 58 bpm to 63 and the
 * song from 149.13 s to 137.29 s.
 *
 * WHY durSec IS "THE audio/plan.js TIMELINE". plan.js:261 `songDurSec()` is
 * `TL.reduce(barSteps) * stepDur()` over the bar list `compile()` built and
 * over plan.js's OWN bpm — not eight.js's, not the document's. If push() failed
 * to hand the produced tempo across the seam, this number would not move, and
 * it is the cheapest honest reading of the compiled timeline that does not
 * require the audio to be running.
 *
 *   node test/producer.browser.js
 *   node test/producer.browser.js --page http://localhost:8777/nukernel/index.html
 *
 * Playwright is borrowed (NODE_PATH=/home/ford/ftrain-2025/node_modules) and
 * the executable path is EXPLICIT — chromium.launch() with no path resolves
 * shell build 1200, which is not installed on this machine.
 */
"use strict";
const CHANT = "#at=Rome&y=600&s=1";   // the shipped chant, named (2026-09-02)
const { chromium } = require("playwright");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const PAGE = arg("--page", "http://localhost:8777/nukernel/index.html");
const EXE = arg("--chrome", process.env.HOME +
  "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome");

const fails = [], notes = [];
const check = (ok, what) => { (ok ? notes : fails).push((ok ? "ok   " : "FAIL ") + what); };
// PRINT WHAT WAS MEASURED, from wherever this file stops. It used to have one
// exit and a bare `hot.prod.notes[0].w` that threw past it; the early bail at
// gate 3 needs the same report or a red run says nothing at all.
const report = () => {
  for (const n of notes) console.log(n);
  for (const f of fails) console.log(f);
  console.log(fails.length ? "\nFAILED " + fails.length + " of " +
    (fails.length + notes.length) : "\nALL PASS (" + notes.length + " checks)  " + PAGE);
};

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
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
  await p.goto(PAGE, { waitUntil: "networkidle" });
  /* ...AND THE FIXTURE IS THE SHIPPED CHANT ITSELF, BY NAME (2026-09-02).
     This gate's checks NAME the chant's own players (`cantor`, `schola`),
     and a COMPOSED anchor at Rome 600 names its players `voice`, `voice2`,
     `vocal` — so the address lands the right PLACE and the wrong ROSTER.
     `__eightShipped()` is `CTX.setDocument(a deep copy of songs.js TERMS)`,
     the same document door a link uses; it is the record this file
     inherited from the boot until the box began booting on the blank state
     (Paul: *"Add a 'silence' genre at the top of the genre list. This is a
     blank state."*), asked for by name instead of assumed. */
  await p.evaluate(() => window.__eightShipped && window.__eightShipped());
  await p.waitForTimeout(1200);
  /* WALK TO THE SUBJECT. THE GATE HAD STOPPED DOING IT, AND WAS RED ON HEAD.
     (Measured 2026-09-01 against a clean checkout of HEAD, before a line of the
     one-verb collapse: 14 of 16 checks failed, every one of them downstream of
     `P0 · the ninth block is on the page (#ax-produce)`.)

     It read:

       await p.waitForFunction(() => document.querySelectorAll(".nu-sheet").length > 0,
         null, { timeout: 20000 }).catch(() => {});

     and then surveyed the DOM. Two things had moved under it. `#app` became a
     set of TABS built lazily — `buildTab` (ui/eight.js:9459) builds a panel the
     first time its tab is SHOWN, and the page boots on `Where`, whose panel is
     the atlas — so `#produce` was an empty div for the whole run and every
     producer assertion was measuring a panel nobody had opened. And the wait
     itself could never end: the producer's taps are all `<select>`s since the
     2026-08-24 settled-parameters conversion, so `.nu-sheet` is not what this
     page draws; the wait spent its whole 20 s timeout and then swallowed it.

     A gate that cannot reach its own control is the GATE failing, not the page
     (test/selects.js check 10 says the same thing about its own walk). So the
     tab is opened the way a thumb opens it, and the wait is for the artifact
     the panel actually builds. */
  await p.waitForFunction(() => !!document.querySelector('[data-k="toptab-Produce"]'),
    null, { timeout: 20000 }).catch(() => {});
  const opened = await p.evaluate(() => {
    const n = document.querySelector('[data-k="toptab-Produce"]');
    if (!n) return false; n.click(); return true; });
  await p.waitForFunction(() => !!document.getElementById("ax-produce"),
    null, { timeout: 20000 }).catch(() => {});
  check(opened, "P0 · the Produce tab is in the stripe and opens it " +
    "(data-k=\"toptab-Produce\")");

  /* An <input> inside a .nu-opt is hidden BY CLIP and focusable, so playwright's
     actionability checks call it invisible. .click() on the element itself is
     the honest gesture: it checks the radio and fires `change`, which is the
     only listener sheets.js installs. */
  const tap = async (k) => {
    const hit = await p.evaluate((kk) => {
      const n = document.querySelector('[data-k="' + CSS.escape(kk) + '"]');
      if (!n) return false;
      n.click(); return true;
    }, k);
    await p.waitForTimeout(420);
    return hit;
  };
  /* SAY ONE OF THE PRODUCER'S THREE WORDS, THROUGH WHICHEVER WIDGET IT IS —
     A REVERSAL WRITTEN DOWN RATHER THAN A NEW HELPER.

     WAS: `tap("opt|prod.verb|make")`, three times, and it is worth being exact
     about what that key was. `opt|<sheet>|<value>` is the `data-k` ui/sheets.js
     hangs on one option of a LIT SHEET, and on 2026-08-24 the producer's three
     taps were three lit sheets. Paul, since, twice: *"There are still many
     boxes that should be selects"*, and a producer verb is one answer decided
     once, so all three went to menus. There is no `opt|…` key on a `<select>`
     at all — `tap()` returned false three times, no note ever entered the
     record, `hot.prod.notes` came back `[]`, and this file CRASHED at
     `hot.prod.notes[0].w` reading `.w` of undefined. Every assertion after
     line 152 went unmade, and the three before it were never printed because
     the crash beat the report to the console.

     Measured 2026-08-25 on the shipped page: `prod.verb` is a <select> of 6,
     `prod.scope` of 4 (record / cantor / schola / mix), `prod.record` of 130+.
     `prod.verb` IS GONE, 2026-09-01 (Paul: "The only verb is 'make' from now
     on. Make X Y.") — the sentence is two taps, scope then target, and this
     helper drives the two that are left exactly as it drove the three.
     A <select> is driven the way a person drives one — pick the option, fire
     `change`, which is the only listener ui/selects.js installs, exactly as
     the radio's was. The `data-v` is the WORD; `option.value` is the machine
     value ui/selects.js wrote, and assigning `.value` a string that is no
     option's value selects nothing and does not throw, so the option is found
     by `data-v` and its own `.value` is used. */
  const say = async (sheet, value) => {
    const hit = await p.evaluate(([k, v]) => {
      const s = document.querySelector('select[data-sel="' + CSS.escape(k) + '"]');
      if (s) {
        const o = [...s.options].find((x) => x.dataset.v === v);
        if (s.disabled || !o || o.disabled) return false;
        s.value = o.value;
        s.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      const n = document.querySelector('[data-k="' +
        CSS.escape("opt|" + k + "|" + v) + '"]');
      if (!n) return false;
      n.click(); return true;
    }, [sheet, value]);
    await p.waitForTimeout(420);
    return hit;
  };
  const shot = () => p.evaluate(() => ({
    dur: window.__nuBounce().durSec,          // the audio/plan.js timeline
    bars: window.__nuBounce().unrouted === undefined ? 0 : window.__nuRender().bars,
    ev: JSON.stringify(window.__eightEvents(0)),
    doc: JSON.stringify(window.__eightDoc()),
    prod: window.__eightProd(),
  }));

  /* ---- 0 THE ABSENT-IS-TODAY LAW, AT THE ARTIFACT ---------------------- */
  // producer G1 asserts this in node against `secs` by reference. Here it is
  // asserted about the page a thumb actually opens: a record nobody has said
  // anything about carries no notes, no tempo move and no fader.
  const base = await shot();
  check(base.prod.notes.length === 0 && base.prod.said.length === 0 &&
        Object.keys(base.prod.mix).length === 0,
    "P0 · a record with nothing said about it: 0 notes, 0 sentences, no mix " +
    "offsets (bpm " + base.prod.bpm + ", song " + base.dur.toFixed(2) + "s)");
  const seen = await p.evaluate(() => ({
    sec: !!document.getElementById("ax-produce"),
    tbl: !!document.querySelector(".nu-notes"),
    // THE VERB SHEET, WHICH MUST NOT BE THERE AT ALL (2026-09-01).
    verbAny: document.querySelector('select[data-sel="prod.verb"]') ? "menu"
      : (document.querySelector('.nu-sheet[data-sheet="prod.verb"]') ? "sheet" : "absent"),
    // ...and TAP ONE IS THE CAST, A ROW OF CHIPS (2026-09-02). One button per
    // cast row, keyed `cast|<id>`, one of them pressed once a subject is
    // chosen. The `scopes` list is read off the chips' own keys.
    scopes: [...document.querySelectorAll('[data-k^="cast|"]')]
      .map((b) => b.dataset.k.slice(5)),
    chipsAre: [...document.querySelectorAll('[data-k^="cast|"]')]
      .map((b) => b.tagName).filter((t, i, a) => a.indexOf(t) === i).join("+") ||
      "absent",
    // a refused chip must SAY WHY — the same law the greyed option obeys
    naked: [...document.querySelectorAll('[data-k^="cast|"]')]
      .filter((b) => b.disabled && !(b.dataset.why || "").trim())
      .map((b) => b.dataset.k),
    plate: (() => { const n = document.querySelector('[data-k="prod.name"]');
      return n ? n.textContent.replace(/\s+/g, " ").trim() : null; })(),
    // ...and the SCOPE MENU MUST NOT BE THERE AT ALL, the same way the verb's
    // must not: a chip row and a <select> saying the same thing would be two
    // owners of which subject is being spoken about.
    scopeAny: document.querySelector('select[data-sel="prod.scope"]') ? "menu"
      : (document.querySelector('.nu-sheet[data-sheet="prod.scope"]') ? "sheet" : "absent"),
  }));
  check(seen.sec, "P0 · the ninth block is on the page (#ax-produce)");
  /* THE SIX VERBS STOOD HERE AND ARE ONE, 2026-09-01. The two assertions this
     replaces read:
       check(seen.verbsAs === "menu", "P0 · …and the verbs are a <select> — a
             single choice is a menu now");
       check(seen.verbs.length === 6, "P0 · six verbs, and the minus half is
             there: " + seen.verbs.join(" "));
     Paul, COMPOSER.md §1 B12: "The only verb is 'make' from now on. Make X Y."
     A menu of one is not a choice, so the sheet is not drawn at all and its
     ABSENCE is what is asserted — the minus half of the vocabulary is not lost
     with it, it moved to the words (louder / quieter / gone / back in /
     alone), which P5 says at the artifact. */
  check(seen.verbAny === "absent", "P0 · there is no verb sheet — the only verb " +
    "is `make` (drawn as: " + seen.verbAny + ")");
  /* THE SCOPE MENU STOOD HERE AND IS A ROW OF CHIPS, 2026-09-02. It read:
       check(seen.scopesAs === "menu", "P0 · …and tap one is the SCOPE, a
             <select> — a single choice is a menu (drawn as: …)");
     Paul, COMPOSER.md §1 B12: *"The implementation is good but the design is
     confusing and feels unconsidered. Design a good producer interface."* The
     cast is the record's own roster and it stays on the page while you speak
     about it — a level of siblings with one pressed, which is the shape the
     nav and the Band roster already use for the same players. So the claim
     turns over: the menu must be GONE, and the chips must be there instead.
     The one-answer-is-a-menu law is untouched — it is about a CHOICE among
     alternatives, and it still holds the two target sheets below. */
  check(seen.scopeAny === "absent", "P0 · …and there is no scope menu either — " +
    "the cast is a row of chips (drawn as: " + seen.scopeAny + ")");
  check(seen.chipsAre === "BUTTON", "P0 · …and every cast chip is a <button> (" +
    seen.chipsAre + ")");
  check(!seen.tbl, "P0 · …and there is no note table until something is said");
  check(seen.scopes.length > 1,
    "P0 · the cast is on it: " + seen.scopes.join(" "));
  check(!seen.naked.length, "P0 · no refused chip is silently grey — every " +
    "greyed one carries its reason " + JSON.stringify(seen.naked));
  check(!!seen.plate && /producer/i.test(seen.plate) && /of 10/.test(seen.plate),
    "P0 · the plate names the producer and counts what has been said: " +
    JSON.stringify(seen.plate));

  /* ---- 1 TWO REAL TAPS ------------------------------------------------- */
  // THREE UNTIL 2026-09-01: `const t1 = await say("prod.verb", "make");` stood
  // above the scope tap and is deleted with the verb sheet. The sentence the
  // page assembles is "make the sound punk" either way.
  //
  // AND TAP ONE IS A CHIP SINCE 2026-09-02: `await say("prod.scope", "record")`
  // drove a `<select>`; the same subject is now a button in the cast row, so
  // it is PRESSED. `tap()` — which clicks a `[data-k]` node and is what every
  // other gesture in this file already used — is the driver, unchanged.
  // The TARGET stays `punk` rather than moving to a quality word: P2 below
  // measures the produced tempo and the audio/plan.js timeline against
  // numbers calibrated on this anchor (58 -> 63 bpm, 149.13 -> 137.29 s), and
  // a gate that changed its own subject in the same edit as its widget would
  // be measuring two things at once. The quality half of the vocabulary is
  // driven at P5.
  const t2 = await tap("cast|record");
  const pressed = await p.evaluate(() => {
    const b = document.querySelector('[data-k="cast|record"]');
    return b ? b.getAttribute("aria-pressed") : null; });
  check(pressed === "true",
    "P1 · the pressed chip says so (aria-pressed=" + JSON.stringify(pressed) + ")");
  // ...and how many records tap three offered, off whichever widget drew it.
  const scope = await p.evaluate(() => {
    const s = document.querySelector('select[data-sel="prod.record"]');
    if (s) return s.querySelectorAll("option:not([data-placeholder])").length;
    return document.querySelectorAll('.nu-sheet[data-sheet="prod.record"] input').length;
  });
  const t3 = await say("prod.record", "punk");
  check(t2 && t3, "P1 · two taps landed — a chip for the sound, then punk from " +
    "the records sheet, and the verb is `make` without being asked (tap two " +
    "offered " + scope + " records)");

  const hot = await shot();
  const line = hot.prod.said[0] || {};
  check(hot.prod.notes.length === 1 && hot.prod.notes[0].d === "punk",
    "P1 · one note on the record: " + JSON.stringify(hot.prod.notes[0] || null));
  check(!!line.sentence && Array.isArray(line.said) && line.said.length > 0,
    "P1 · …and it SAYS what it moved: " + JSON.stringify(line.sentence) +
    " — " + JSON.stringify(line.said));
  check(line.moved === true && line.refused === false,
    "P1 · the producer reports the record actually moved (moved=" + line.moved +
    ", refused=" + line.refused + ")");
  const tbl = await p.evaluate(() => {
    const t = document.querySelector(".nu-notes");
    if (!t) return null;
    return { rows: t.querySelectorAll("tr").length,
             head: t.querySelector("th").textContent.trim(),
             ops: [...t.querySelectorAll("td button")].map((b) => b.dataset.k) };
  });
  check(tbl && tbl.rows === 2, "P1 · the note stack is DRAWN — one heading row " +
    "and one note (" + (tbl ? tbl.rows : 0) + " rows, first says " +
    JSON.stringify(tbl && tbl.head) + ")");
  check(tbl && tbl.ops.join(" ") === "pnup|0 pndn|0 pndel|0",
    "P1 · every note carries more / less / take it off (" +
    JSON.stringify(tbl && tbl.ops) + ")");

  /* ---- 2 THE COMPILED BAR THE ENGINE IS HANDED ------------------------ */
  check(hot.prod.bpm !== base.prod.bpm,
    "P2 · the produced tempo moved: " + base.prod.bpm + " -> " + hot.prod.bpm + " bpm");
  check(Math.abs(hot.dur - base.dur) > 0.5,
    "P2 · …and it CROSSED THE SEAM into audio/plan.js: songDurSec " +
    base.dur.toFixed(2) + "s -> " + hot.dur.toFixed(2) + "s");
  check(hot.ev !== base.ev,
    "P2 · the rendered events of section 0 changed (" + base.ev.length +
    " -> " + hot.ev.length + " chars of event stream)");
  check(hot.doc !== base.doc,
    "P2 · the DOCUMENT carries the note — `produce` is in the record, not in " +
    "a view's private state");

  /* ---- 3 A SECOND NOTE STACKS, AND "more" PUSHES IT HARDER ------------ */
  /* AND IT IS A GUARD NOW, NOT A DEREFERENCE. `hot.prod.notes[0].w` threw a
     bare TypeError out of the whole file when tap one silently failed, which
     cost this gate every assertion below it AND the three above it. A gate
     that cannot reach its subject must SAY SO and go on being a gate. */
  if (!hot.prod.notes.length) {
    check(false, "P3 · the three taps never reached the record, so nothing " +
      "below this line was measured — prod = " + JSON.stringify(hot.prod));
    report();
    await b.close();
    process.exit(1);
  }
  const w0 = hot.prod.notes[0].w;
  await tap("pnup|0");
  const up = await shot();
  check(up.prod.notes[0].w > w0, "P3 · \"more\" pushes the SAME note harder — " +
    w0 + " -> " + up.prod.notes[0].w);
  await tap("pndn|0");
  const dn = await shot();
  check(Math.abs(dn.prod.notes[0].w - w0) < 1e-9,
    "P3 · \"less\" is its exact inverse — back to " + dn.prod.notes[0].w);

  /* ---- 4 "TAKE IT OFF" RESTORES IT BYTE-IDENTICAL --------------------- */
  const off = await tap("pndel|0");
  const back = await shot();
  check(off, "P4 · \"take it off\" is a real button");
  check(back.doc === base.doc,
    "P4 · the document is byte-identical to before anything was said (" +
    back.doc.length + " vs " + base.doc.length + " chars)");
  check(back.ev === base.ev,
    "P4 · the rendered events of section 0 are byte-identical");
  check(Math.abs(back.dur - base.dur) < 1e-9,
    "P4 · and the audio/plan.js timeline is back to " + back.dur.toFixed(2) + "s");
  check(back.prod.notes.length === 0 &&
        Object.keys(back.prod.mix).length === 0,
    "P4 · no notes left and no fader left behind (clearMixOffsets, eight.js:263)");
  const gone = await p.evaluate(() => !document.querySelector(".nu-notes"));
  check(gone, "P4 · …and the note table is gone from the page");

  /* ---- 5 A NOTE THAT MOVES THE DESK, NOT THE TEMPO -------------------- */
  // The other half of the seam: R.mix -> setMixOffset. "make the cantor
  // quieter" is a fader, and a fader that never reaches audio/desk.js is a
  // producer that only pretends. Offsets ADD (desk.js:593), which is why they
  // are cleared and rewritten whole on every push.
  //
  // THE ASSERTION THAT STOOD HERE WAS THE TWO-TAP VERB LAW ITSELF, and it is
  // rewritten rather than deleted because the FACT it was protecting — that
  // the minus half of production reaches the desk — is the same fact. It read:
  //     await say("prod.verb", "less");
  //     const l2 = await say("prod.scope", "v:cantor");
  //     check(l2, 'P5 · "less" takes no descriptor — the note lands on tap TWO');
  // Paul, 2026-09-01: "The only verb is 'make' from now on. Make X Y." `less`
  // is the quality `quieter` now (producer.js ADJ, the ±7 dB fader path the
  // verb carried), so the sentence is three words and lands on tap TWO of two.
  // ...and tap one is the cantor's CHIP since 2026-09-02 (see P1): it read
  // `const l1 = await say("prod.scope", "v:cantor");`. This is the check that
  // proves a MEMBER can be spoken about from the cast row — the chips carry
  // `v:<name>` ids and a `[data-vi]` category slot — and the desk seam under
  // it is untouched.
  const l1 = await tap("cast|v:cantor");
  const l2 = await say("prod.word", "quieter");
  const quiet = await shot();
  check(l1 && l2, "P5 · \"make the cantor quieter\" — the level is a WORD now, " +
    "and it lands on the last tap: " +
    JSON.stringify((quiet.prod.notes[0] || {})));
  check((quiet.prod.notes[0] || {}).d === "quieter",
    "P5 · …and the note carries the quality, not a verb");
  const mixKeys = Object.keys(quiet.prod.mix);
  check(mixKeys.length > 0, "P5 · it writes a mix offset the desk will add: " +
    JSON.stringify(quiet.prod.mix));
  const said2 = (quiet.prod.said[0] || {}).said || [];
  check(said2.length > 0, "P5 · …and says so: " +
    JSON.stringify((quiet.prod.said[0] || {}).sentence) + " — " +
    JSON.stringify(said2));
  await tap("pclear");
  const clean = await shot();
  check(clean.doc === base.doc,
    "P5 · \"forget all of it\" restores the record byte-identical too");

  /* ---- 6 nothing threw ------------------------------------------------ */
  check(!errs.length, "P6 · zero console errors / pageerrors " +
    JSON.stringify(errs.slice(0, 3)));

  report();
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
