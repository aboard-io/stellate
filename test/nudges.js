#!/usr/bin/env node
/* test/nudges.js — D7's gate. THE NUDGES, READ OFF THE RENDERED PAGE.
 *
 * (Paul, 2026-08-24: "we had lots of fun nudges to the music and motifs —
 * like arching.")
 *
 * PROGRAM.md §5, the nudges row, in full:
 *   · with env:"arch" on section 2 the box carries the key AND the rendered
 *     events show max(vel) − min(vel) >= 2, and = 0 with nothing set
 *     (kernel numbers measured: 64 flat vel-5 events -> 3 4 4 5 5 5 5 4)
 *   · THE GREY-OUT GATE: on a document with no drums voice,
 *     outro: fill|roll|tomfill|hatrun|doubles|break and intro: kit are
 *     `disabled` and nothing else is; add a drums voice and all seven come
 *     alive
 *   · zero pageerror
 *
 * TEST THE ARTIFACT. Nothing below asks a module what it would draw. Every
 * value is either a query against the DOM the browser actually built or the
 * event stream ui/derive.js actually rendered, and every state change is made
 * by CLICKING the control a thumb would click. Three features have already
 * shipped broken in this repo while every check passed.
 *
 * WHERE "= 0 WITH NOTHING SET" IS MEASURED, AND WHY IT IS NOT ON THE CHANT.
 * PROGRAM.md's own parenthetical says which stream that clause is about — "64
 * flat vel-5 events" — and it is not this record. genres.js `gregorian`
 * declares `phrase: 0.9`, `stress: 0.06` and `touch: {t:0.06, v:0.5}`, so the
 * shipped chant has NEVER rendered a flat velocity: the bar-scale arch (the
 * phrase tent, kernel.js:1337-1348) has been sounding on it since the day it
 * was written, which is precisely the nudge this slice makes SAYABLE. So §5's
 * two halves are measured where each is true — the section arch as a DELTA on
 * the record as shipped (assertion 4), and the exact `3 4 4 5 5 5 5 4` on the
 * flat stream the clause describes (assertion 6).
 *
 *   node test/nudges.js
 *   node test/nudges.js --page http://localhost:8777/nukernel/index.html
 *
 * Playwright is borrowed (NODE_PATH=/home/ford/ftrain-2025/node_modules) and
 * the executable path is EXPLICIT — chromium.launch() with no path resolves
 * shell build 1200, which is not installed on this machine.
 */
"use strict";
const { chromium } = require("playwright");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const PAGE = arg("--page", "http://localhost:8777/nukernel/index.html");
const EXE = arg("--chrome", process.env.HOME +
  "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome");

const fails = [], notes = [];
const check = (ok, what) => { (ok ? notes : fails).push((ok ? "ok   " : "FAIL ") + what); };

// THE SEVEN. Named as data rather than counted, because "seven greyed" is true
// of the wrong seven too. Each is `<field>:<value>` exactly as fields.js
// NUDGEGATE spells it, and each is a bar that would otherwise be drums nobody
// hired (kernel.js:2861 writes D() snare and cymbal events unconditionally) or
// a bar of silence (`break` and `intro: kit` keep only `kind === "hit"` events,
// of which a chant has none).
const SEVEN = ["intro:kit", "outro:fill", "outro:roll", "outro:tomfill",
               "outro:hatrun", "outro:doubles", "outro:break"].sort();

const spread = (ev) => {
  const vs = ev.map((e) => (e.vel == null ? 5 : e.vel));
  return vs.length ? Math.max(...vs) - Math.min(...vs) : -1;
};

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

  /* Click a control by its `data-k` and let ui/eight.js `changed()` rebuild.
     An <input> inside a .nu-opt is hidden BY CLIP and focusable, so it is not
     "visible" to playwright's actionability checks — .click() on the element
     itself is the honest gesture: it checks the radio and fires `change`,
     which is the only listener sheets.js installs. */
  const tap = async (k) => {
    const hit = await p.evaluate((kk) => {
      const n = document.querySelector('[data-k="' + CSS.escape(kk) + '"]');
      if (!n) return false;
      n.click();
      return true;
    }, k);
    await p.waitForTimeout(220);
    return hit;
  };
  // (`opt(sheet, value)` — the `opt|<sheet>|<value>` data-k a lit sheet gives
  //  each of its options — stood here and had no reader left once `say()`
  //  below took over: it builds that key itself for the sheet branch, and a
  //  menu has no such key at all. Deleted rather than kept warm, because a
  //  second way to name an option is a second way to be wrong about which
  //  widget is on the page.)
  /* SAY A WORD ON A SHEET *OR* ON A MENU, AND THAT IS A REVERSAL WRITTEN DOWN
     RATHER THAN A NEW HELPER. This gate drove every nudge as a radio inside a
     `.nu-opt`, because on the morning of 2026-08-24 every one of them was one
     (Paul: "sheets of organized options should light up"). That evening the
     form tab's nudges went back to menus — "in the band 'form' section --
     return to dropdowns/select" — and BOTH sentences are right about different
     controls, so this gate stops caring which widget it is looking at. What it
     is actually about is unchanged and is the only thing worth asserting: the
     word reaches the box, the box reaches the kernel, and no grey is silent.

     A <select> is driven the way a person drives one — set the value, fire
     `change`, which is the only listener ui/selects.js installs, the same as
     sheets.js's radio. A disabled control or a disabled option returns false,
     so "the sheet offers `arch` and takes a tap" still fails if it does not. */
  /* ...AND A THIRD WIDGET, 2026-09-02 (wave 4), for the same reason the second
     one was added: the page reversed which control a question is drawn in, and
     this gate is about the WORD reaching the sound. Paul: *"When we go into
     structure make those tables of dropdowns full of tappable grids that change
     options rather than dropdowns … institutionalize it."* Six of the twelve
     nudge sheets — every per-section one — are cells in a `ui/wordgrid.js`
     table now: a button printing its word, which grows a strip of words under
     its row when you tap it. So this says a word in three ways and still cares
     about none of them: a radio, a menu, or a cell and then a chip. The strip
     folds itself when a chip is pressed, which is why there is no third press
     here. */
  const say = async (sheet, value) => {
    const hit = await p.evaluate(([k, v]) => {
      const s = document.querySelector('select[data-sel="' + CSS.escape(k) + '"]');
      if (s) {
        if (s.disabled) return false;
        const o = [...s.options].find((x) => x.dataset.v === v);
        if (!o || o.disabled) return false;
        s.value = o.value;
        s.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      const c = document.querySelector('.nu-wcell[data-k="' + CSS.escape(k) + '"]');
      if (c) {
        if (c.disabled) return false;
        if (c.getAttribute("aria-expanded") !== "true") c.click();
        const chip = document.querySelector('.nu-wchip[data-k="' +
          CSS.escape(k + "|" + v) + '"]');
        if (!chip || chip.disabled) { if (c.getAttribute("aria-expanded") === "true") c.click(); return false; }
        chip.click();
        return true;
      }
      const n = document.querySelector('[data-k="' +
        CSS.escape("opt|" + k + "|" + v) + '"]');
      if (!n) return false;
      n.click();
      return true;
    }, [sheet, value]);
    await p.waitForTimeout(320);
    return hit;
  };
  const events = (si) => p.evaluate((i) => window.__eightEvents(i), si);

  /* OPEN A SECTION'S QUESTIONS, BECAUSE THE FORM TAB IS A LIST NOW.
     Paul, 2026-08-25: *"when you tap it brings up the questions about the
     section"*. The form tab — which is also where the page boots — draws the
     section LIST: five rows of names, one button each (`ui/eight.js:3369`
     writes `data-k = "sec" + sid`), and a list of names has no nudges in it.
     A section's eight nudges are one tap further in, on the detail
     (`sectionDetail`, eight.js:3470).

     WAS: `await tap("tabform")` on its own, three times, and a bare count on
     the boot page — which was the whole gate while every section's questions
     were on one page at once, and which now reads 0 and bails out before it
     asserts anything. Measured 2026-08-25 on the page as shipped: boot 0 ·
     after tapping section 2 → 8 · the performance tab → 3. Nothing went
     missing; the count was taken in the wrong room. */
  /* ===== THE FIXTURE IS NAMED NOW (2026-09-02) =========================
     This gate's checks 2 and 5 are about a box with NOTHING SAID into it —
     "ABSENT IS TODAY" — and until today that record arrived for free, because
     the page booted on a deep copy of `songs.js TERMS`, the hand-authored
     chant whose boxes carry no dealt words. The box boots on the BLANK STATE
     now (Paul: *"Add a 'silence' genre at the top of the genre list. This is a
     blank state."*), and the chant that the address lands is a COMPOSED
     anchor, which deals `env`, `pipe` and the rest — so "absent" would be a
     claim about the dice rather than about the recipe.
     So the fixture is asked for by name, through the page's own document door
     (`CTX.setDocument`, the same one a link uses). This is the inherited
     assumption made explicit; nothing about what is asserted changed. */
  await p.evaluate(() => window.__eightShipped && window.__eightShipped());
  await p.waitForTimeout(900);
  const S2 = (await p.evaluate(() =>
    window.__eightDoc().form.sections.map((s) => s.id)))[1];
  /* ...AND THE BAND TAB IS OPENED FIRST, 2026-08-28. `tabform` was a button in
     a horizontal strip inside the Band panel until the gutter took it (Paul,
     the same day: *"There should be one vertical stripe max with an 'up' icon
     to get to the parent level."*) — and a LEVEL of the gutter only exists
     while its own tab is open, which is `trayNow`'s guard and not an accident.
     The page boots on `Where`, so from that change until this one `tap
     ("tabform")` found nothing, `tap("sec…")` found nothing, and this gate
     bailed at "0 nudge sheets found" before it asserted anything — MEASURED on
     the shipped page tonight: at boot `[data-k="tabform"]` is absent and the
     stripe reports level "root". Nothing about the recipe moved; the door did.
     `__eightTab` is the page's own door and is what a thumb does — the same
     one-line repair test/sheets.js, test/selects.js and test/knobs.js each
     already took for their own `+ drums`. */
  /* ...AND THE FORM IS `Structure`'s TAB SINCE 2026-09-02. Paul: *"Sections/
     Structure has the same challenges. … It should be top level, not buried
     under band, and below band. Bring performance into structure."* So the
     door is one tab instead of a tab and a mark: `tabform` was the mark that
     opened the sections INSIDE the band level and it does not exist, because
     the thing it addressed is a tab of its own. `sec<id>` is unchanged — it is
     the heading `sectionDetail` answers to and it is still what a thumb lands
     on — and so is every claim below it. */
  const openBand = async () => {
    await p.evaluate(() => window.__eightTab("Band"));
    await p.waitForTimeout(300);
  };
  const openStructure = async () => {
    await p.evaluate(() => window.__eightTab("Structure"));
    await p.waitForTimeout(300);
  };
  const openSection = async (id) => {
    await openStructure();
    /* THE SECTION'S OWN ROW IN THE GUTTER IS THE DOOR, and it is the same
       gesture the numbered button in the form table makes (`openSection` is
       one function with two spellings, ui/eight.js). `secnav<id>` is the
       stripe's key for it; `sec<id>` is the heading it lands on, which is what
       the tap below confirms arrived. */
    await tap("secnav" + id);
    return tap("sec" + id);
  };
  await openSection(S2);

  /* ---- 0 the recipe landed at all ------------------------------------- */
  // WHICH KEYS ARE NUDGE KEYS IS DERIVED, NOT TYPED. fields.js `nudgesFor` is
  // the registry's own answer, so a row that grows an `axis` there is in this
  // gate with no edit here — and `form.role`, an older sheet living under the
  // same prefix, stays out of it with no special case.
  await p.evaluate(() => {
    const NF = window.NuFields, keys = [];
    for (const ax of ["form", "development", "performance"])
      for (const r of (NF.nudgesFor ? NF.nudgesFor(ax) : []))
        if (r.options) keys.push(ax + "." + r.key);
    window.__NUDGEKEYS = keys;
    window.__isNudge = (ds) => keys.includes(String(ds || "").split("|")[0]);
  });
  const wired = await p.evaluate(() => ({
    nudges: typeof window.__eightNudges === "function",
    events: typeof window.__eightEvents === "function",
    keys: window.__NUDGEKEYS.length,
    // A NUDGE IS DRAWN IF IT IS DRAWN AT ALL — sheet or menu. Eleven nudge keys,
    // three of them lit sheets (Performance) and eight of them menus (the form
    // tab), since 2026-08-24's evening. Counting only `.nu-sheet` here would
    // make this gate's own bail-out fire on a page that is working.
    // …AND A THIRD WIDGET IN THE CENSUS (2026-09-02): a word grid's CELL
    // carries the sheet's address as its `data-k`, so a page whose per-section
    // nudges are all cells still counts as "the nudges are drawn".
    sheets: [...document.querySelectorAll(".nu-sheet")]
      .map((f) => f.dataset.sheet).filter((s) => window.__isNudge(s)).length +
      [...document.querySelectorAll("select[data-sel]")]
      .map((s) => s.dataset.sel).filter((s) => window.__isNudge(s)).length +
      [...document.querySelectorAll(".nu-wcell[data-k]")]
      .map((c) => c.dataset.k).filter((s) => window.__isNudge(s)).length,
    askable: !!window.NuAskable,
    words: window.NuSongs ? Object.keys(window.NuSongs.WORDS).length : 0,
  }));
  /* THIS READ `wired.keys === 11`, "fields.js names eleven nudge sheets — 5 on
     the form axis, 3 on development, 3 on performance". The count moved on
     2026-09-02 and the sentence is kept above the new one because the SHAPE of
     the claim is what matters: the census is derived from the registry, so the
     number here is the only place a new axis row has to be acknowledged.
     Paul, the composer round, B7: *"Tap tempo, the tempo editor appears, same
     for key. The tempo editor does not reflect the richness of our tempo
     options."* `form.pace` is the sixth form row — the mensural word compose.js
     has dealt onto every box since 2026-08-30 with no control anywhere — and
     it is drawn as the Tempo panel's pace strip rather than in `sectionDetail`
     (one owner per fact: two tabs' panels coexist in the DOM). Which is why
     `wired.sheets` below is still "> 0" and not a count: this gate opens a
     SECTION, and one of the twelve is answered one tab over. */
  check(wired.keys === 12, "fields.js names twelve nudge sheets — 6 on the form " +
    "axis (pace joined 2026-09-02), 3 on development, 3 on performance (" +
    wired.keys + ")");
  check(wired.words === 26, "songs.js WORDS carries the five new rows (" +
    wired.words + " words)");
  check(wired.askable, "askable.js is in the page (recipe R1) — without it the " +
    "Performance sheets cannot be drawn");
  check(wired.nudges && wired.events,
    "ui/eight.js publishes __eightNudges and __eightEvents (recipe R6d)");
  check(wired.sheets > 0, "the nudge sheets are drawn (recipe R5a + R6b/c) — " +
    wired.sheets + " found");
  if (!wired.nudges || !wired.events || !wired.sheets) {
    for (const n of notes) console.log(n);
    for (const f of fails) console.log(f);
    console.log("\nFAILED " + fails.length + " of " + (fails.length + notes.length) +
      "\n  the D7 recipe (tmp/recipes/07-nudges.md) has not been applied to the " +
      "integration files; the rest of this gate cannot run.");
    await b.close();
    process.exit(1);
  }

  /* ---- 1 THE GREY-OUT GATE, on the record as shipped ------------------ */
  // Scoped to the NUDGE sheets. Other sheets on this page grey for their own
  // measured reasons (`dev.kit` goes dark entire with no drummer, which is
  // design 02's gate, not this one), and counting them here would make one
  // slice's gate fail on another slice's correct behaviour.
  /* ...AND THE GREY SCAN READS BOTH WIDGETS TOO, for the same reason and with
     the same law: NO SILENT GREY. Where a sheet hangs the reason in a
     `<small class="nu-why">` inside the option, a menu APPENDS it to the
     option's own words (an <option> may contain nothing but text) and stamps
     it as `data-why` so a gate can read it back off the artifact — which is
     what this reads. The seven drum-writing edges are the same seven whichever
     control they are drawn in, which is the whole point of one spec and two
     widgets (PROGRAM.md §2.3). */
  const greys = () => p.evaluate(() => {
    const out = { dis: [], quiet: [], silent: [], why: {}, sheets: 0 };
    for (const f of document.querySelectorAll(".nu-sheet")) {
      const key = (f.dataset.sheet || "").split("|")[0];
      if (!window.__isNudge(key)) continue;
      out.sheets++;
      const field = key.split(".")[1];
      for (const lab of f.querySelectorAll(".nu-opt")) {
        const i = lab.querySelector("input");
        const why = (lab.querySelector(".nu-why") || {}).textContent || "";
        const name = field + ":" + lab.dataset.v;
        if (why.trim()) out.why[name] = why.trim();
        if (i && i.disabled) { out.dis.push(name); if (!why.trim()) out.silent.push(name); }
        else if (lab.classList.contains("is-quiet")) {
          out.quiet.push(name); if (!why.trim()) out.silent.push(name);
        }
      }
    }
    for (const s of document.querySelectorAll("select[data-sel]")) {
      const key = (s.dataset.sel || "").split("|")[0];
      if (!window.__isNudge(key)) continue;
      out.sheets++;
      const field = key.split(".")[1];
      for (const o of s.options) {
        const why = o.dataset.why || "";
        const name = field + ":" + o.dataset.v;
        if (why.trim()) out.why[name] = why.trim();
        if (o.disabled) { out.dis.push(name); if (!why.trim()) out.silent.push(name); }
        else if (o.classList.contains("is-quiet")) {
          out.quiet.push(name); if (!why.trim()) out.silent.push(name);
        }
      }
    }
    /* ...AND THE WORD GRIDS, WHICH COST A GESTURE (2026-09-02, wave 4). A
       `<select>` carries its whole option list in the DOM at rest and a word
       grid carries the WORD, offering the list when a thumb opens the cell —
       which is the change Paul asked for and which means the grey scan has to
       OPEN each nudge cell to see the words in it. So it does: open, read the
       strip, fold it again. The law being measured is unchanged and is the
       only one that matters here — NO SILENT GREY: a refused chip is disabled,
       carries `data-why`, and joins that reason to its own accessible name.
       ONE CELL PER KEY IS ENOUGH. The census is per SHEET, not per section: a
       key's refusals are computed from the record's features, so `outro:fill`
       is refused for the same measured reason in every row of its column. This
       reads the first cell of each nudge column and asserts about the WORDS,
       which is what the old two branches did too. */
    const seenKey = {};
    for (const c of document.querySelectorAll(".nu-wcell[data-k]")) {
      const key = (c.dataset.k || "").split("|")[0];
      if (!window.__isNudge(key) || seenKey[key] || c.disabled) continue;
      seenKey[key] = 1;
      out.sheets++;
      const field = key.split(".")[1];
      const shut = c.getAttribute("aria-expanded") !== "true";
      if (shut) c.click();
      const tr = c.closest("tr") && c.closest("tr").nextElementSibling;
      const chips = tr && tr.classList.contains("nu-wopen")
        ? [...tr.querySelectorAll(".nu-wchip")] : [];
      for (const o of chips) {
        const why = o.dataset.why || "";
        const name = field + ":" + o.dataset.k.slice(c.dataset.k.length + 1);
        if (why.trim()) out.why[name] = why.trim();
        if (o.disabled) { out.dis.push(name); if (!why.trim()) out.silent.push(name); }
        else if (o.classList.contains("is-quiet")) {
          out.quiet.push(name); if (!why.trim()) out.silent.push(name);
        }
      }
      if (shut && c.getAttribute("aria-expanded") === "true") c.click();
    }
    out.dis = [...new Set(out.dis)].sort();
    out.quiet = [...new Set(out.quiet)].sort();
    return out;
  });

  await openSection(S2);
  const g0 = await greys();
  /* THE SEVEN ARE THE SUBJECT; ANYTHING ELSE MUST NOT BE ABOUT THE DRUMMER.
     This read `dis === SEVEN` — exactly the seven and nothing else — and that
     was true on the day it was written and is not a law. It is rewritten rather
     than loosened, and the sentence it replaces is the reason:

     `pipe:strum` greys on the shipped chant and is RIGHT to. The extracted
     table measured that a strum only moves the render `when cast.hasPad`
     (gates.json development.pipe), and fields.js NUDGEGATE says the same thing
     in words a person can read — "nobody is voicing a chord — a strum has
     nothing to spread". Neither has anything to do with a drummer, and a gate
     about the DRUM edges that fails on a correct chord-voicing grey is a gate
     measuring the wrong thing. So: the seven must all be there, and every OTHER
     grey has to carry a reason that is not about a drummer — which is the
     assertion the old line was actually making, said in a way that survives the
     table learning something new. */
  const extra = g0.dis.filter((k) => !SEVEN.includes(k));
  const drumWord = (k) => /drum|kit|snare|fill|roll|hat|tom/i.test(g0.why[k] || "");
  check(SEVEN.every((k) => g0.dis.includes(k)),
    "no drummer: all seven drum-writing edges are disabled — missing " +
    JSON.stringify(SEVEN.filter((k) => !g0.dis.includes(k))));
  check(!extra.some(drumWord),
    "...and every OTHER grey is greyed for a reason that is not about a " +
    "drummer — " + JSON.stringify(extra.map((k) => k + " (" + g0.why[k] + ")")));
  check(!g0.silent.length, "NO SILENT GREY: every greyed nudge option prints a " +
    "reason " + JSON.stringify(g0.silent.slice(0, 4)));

  /* ---- 2 ABSENT IS TODAY ---------------------------------------------- */
  const before = await p.evaluate(() => window.__eightNudges()[1]);
  const allNull = before && Object.keys(before).every(
    (k) => before[k] === null || (k === "nudge" && before[k] === 0));
  check(allNull, "ABSENT IS TODAY: section 2's box carries " +
    JSON.stringify(before) + " before anything is said");

  /* ---- 3 THE FIVE NEW WORDS REACH THE KERNEL --------------------------- */
  // `the rhythm, moved` is spelled `["gat4"]` — an op KEY, not a call — so if
  // nukernel/document.js `opsOf` still destructures every entry as an array it
  // calls K["g"]("a","t","4") and the page throws. Rotating the GATE alone
  // re-times the phrase and keeps every note, so the proof is that the onset
  // times move.
  const ev0 = await events(1);
  /* ...AND A VOICE IS THREE FACETS SINCE 2026-08-28 (Paul: *"A voice has:
     Instrument … / What it plays … / Per-section settings."*). `tabcantor`
     opens the cantor and lands on its INSTRUMENT facet; `dev.line` is a
     per-SECTION word and is drawn on the third one, so the tap that used to be
     the whole journey is now two. Both keys are the page's own — `facet-sec`
     is ui/glyph.js `GLYPH.facet.sec` in the gutter — and `say` still returns
     false if the control is not there, so this cannot paper over a real loss. */
  /* ...AND THE PER-SECTION FACET IS GONE, 2026-09-02. Paul: *"Make a section
     automation interface for the manipulation of the motifs and put it under
     structure/sections … Every section I can tweak every instrument."* The
     voice's fourth facet (`facet-sec`, the per-section table one player at a
     time) is a COLUMN of the Structure grids now, so the question "what does
     the cantor do in section 2" is asked of the section rather than of the
     player. `dev.line|cantor|<sec>` is the SAME KEY — the grids emit exactly
     the addresses that table emitted, which is why the table had to go rather
     than stand beside them — and it is drawn today in the section's own
     detail, which `openSection` opens. */
  await openSection(S2);
  const moved = await say("dev.line|cantor|" + S2, "the rhythm, moved");
  const ev1 = await events(1);
  check(moved, "the development sheet offers `the rhythm, moved` (songs.js, new)");
  check(JSON.stringify(ev0.map((e) => e.t)) !== JSON.stringify(ev1.map((e) => e.t)),
    "an op-KEY word re-times the rendered stream (" + ev0.length + " -> " +
    ev1.length + " events, onsets moved)");
  await say("dev.line|cantor|" + S2, "as written");

  /* ---- 4 THE ARCH OVER THE SECTION ------------------------------------ */
  await openSection(S2);
  const evFlat = await events(1);
  const sFlat = spread(evFlat);
  const archOk = await say("form.env|" + S2, "arch");
  check(archOk, "the shape sheet offers `arch` on section 2 and takes a tap");
  const after = await p.evaluate(() => window.__eightNudges()[1]);
  check(after && after.env === "arch",
    "THE BOX CARRIES THE KEY: section 2's box env = " +
    JSON.stringify(after && after.env));
  const evArch = await events(1);
  const sArch = spread(evArch);
  check(sArch >= 2, "THE SOUND MOVED: under arch max(vel) − min(vel) = " + sArch +
    " (>= 2) over " + evArch.length + " events");
  check(sArch > sFlat, "and it moved BECAUSE of the arch: the same section read " +
    sFlat + " before the tap and " + sArch + " after");

  // ...and it is an ARCH and not a fade: kernel.js:2655, "this rises to a peak
  // two thirds through and settles back to a level you can still hear — the
  // shape a section of music has when nobody is fading anything." So the loud
  // events sit around two thirds of the way in, and neither end is silent.
  const shape = (() => {
    if (!evArch.length) return null;
    const T = Math.max(...evArch.map((e) => e.t)) || 1;
    const hi = Math.max(...evArch.map((e) => e.vel));
    const at = evArch.filter((e) => e.vel === hi).map((e) => e.t / T);
    return { peak: at.reduce((a, x) => a + x, 0) / at.length,
             lowest: Math.min(...evArch.map((e) => e.vel)) };
  })();
  check(!!shape && shape.peak > 0.35 && shape.peak < 0.95 && shape.lowest > 0,
    "it ARCHES rather than fades: the loudest events centre at " +
    (shape ? shape.peak.toFixed(2) : "?") + " of the section and the quietest is " +
    (shape ? shape.lowest : "?") + " (not silence)");

  /* ---- 5 THE ARCH INSIDE THE BAR — the phrase tent -------------------- */
  // The literal thing Paul named, at the other scale: askable.js:74, "does the
  // line breathe? … it arches". It proves the four `...(P.x != null)` spreads
  // in nukernel/document.js toGenre reach kernel.js `perform`, because `flat`
  // (0) and `it arches` (0.85) can only differ if `phrase` arrives at all.
  // ...WHICH LIVES ON ITS OWN TAB. Gate 4 left us in section 2's form detail;
  // the three Performance nudges are drawn under `tabperformance` and nowhere
  // else (measured 2026-08-25: the performance tab carries exactly 3 of the
  // eleven nudge keys). Without this tap `say` finds no control and returns
  // false, which would read as "the box lost the phrase tent".
  // ...AND THE BAND TAB FIRST, 2026-08-28: gate 3 above left the stripe INSIDE
  // the cantor (the `voice` level, three facets), where `tabperformance` is one
  // `↑` away and therefore not on the page. Same door, same one line.
  /* ...AND PERFORMANCE IS INSIDE STRUCTURE SINCE 2026-09-02. Paul: *"Bring
     performance into structure."* It is the LAST block of that panel rather
     than a tab of the band, and `tabperformance` is the row in the stripe that
     scrolls you to it — the key did not move, because an address does not move
     when a row does. */
  await openStructure();
  await tap("tabperformance");
  const flatOk = await say("performance.phrase", "flat");
  const sTentOff = spread(await events(1));
  const archOk2 = await say("performance.phrase", "it arches");
  const sTentOn = spread(await events(1));
  const said = await p.evaluate(() => window.__eightDoc().performance.phrase);
  check(flatOk && archOk2, "the Performance block asks 'does the line breathe?' " +
    "and takes a tap");
  check(said === 0.85, "the WORD writes askable.js's own NUMBER: phrase = " +
    JSON.stringify(said));
  check(sTentOn > sTentOff, "THE PHRASE TENT IS LIVE: flat -> spread " + sTentOff +
    ", it arches -> spread " + sTentOn);

  /* ---- 6 the kernel numbers PROGRAM.md quotes, on the flat stream ----- */
  // §5's "= 0 with nothing set (64 flat vel-5 events -> 3 4 4 5 5 5 5 4)" is a
  // statement about the ENVELOPE, and it is worth pinning exactly: it is the
  // arithmetic all twelve shapes ride on, and the eight numbers are the ones
  // the round was specified against.
  const K64 = await p.evaluate(() => {
    const ev = [];
    for (let i = 0; i < 64; i++) ev.push({ t: i, vel: 5, kind: "line" });
    const s = (l) => Math.max(...l.map((e) => e.vel)) - Math.min(...l.map((e) => e.vel));
    const none = window.NuKernel.envelope(ev, null, 64, 16);
    const arch = window.NuKernel.envelope(ev, "arch", 64, 16);
    return { none: s(none), arch: s(arch),
             eighths: [0, 8, 16, 24, 32, 40, 48, 56].map((i) => arch[i].vel) };
  });
  check(K64.none === 0, "64 flat vel-5 events with NOTHING SET: spread " + K64.none);
  check(JSON.stringify(K64.eighths) === JSON.stringify([3, 4, 4, 5, 5, 5, 5, 4]),
    "…and under arch they are exactly PROGRAM.md's own numbers " +
    JSON.stringify(K64.eighths));

  /* ---- 7 HIRE A DRUMMER AND ALL SEVEN COME ALIVE ---------------------- */
  await openBand();                       // ...and so is the button that hires one
  const hired = await tap("adddrums");
  check(hired, "the page offers a drummer (+ drums)");
  await openSection(S2);
  const g1 = await greys();
  // ...AND THE SAME REWRITE ON THE OTHER SIDE OF THE HIRE. This said
  // `dis.length === 0`, which asked the whole page to have no grey at all; what
  // the hire is evidence about is THE SEVEN. `pipe:strum` is still greyed after
  // a drummer arrives, because a drummer is not a pad — see the note above.
  check(!SEVEN.some((k) => g1.dis.includes(k)),
    "hire a drummer and all seven come alive — still dark: " +
    JSON.stringify(SEVEN.filter((k) => g1.dis.includes(k))) +
    "  (other greys, for other reasons: " +
    JSON.stringify(g1.dis.filter((k) => !SEVEN.includes(k))) + ")");

  /* ---- 8 nothing threw ------------------------------------------------ */
  check(!errs.length, "zero console errors / pageerrors " +
    JSON.stringify(errs.slice(0, 3)));

  for (const n of notes) console.log(n);
  for (const f of fails) console.log(f);
  console.log(fails.length ? "\nFAILED " + fails.length + " of " +
    (fails.length + notes.length) : "\nALL PASS (" + notes.length + " checks)  " + PAGE);
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
