#!/usr/bin/env node
/* test/pool.browser.js — THE BAND, MEASURED ON THE RENDERED PAGE.
 *
 * test/pool.test.js proves the pool's arithmetic in node. It cannot prove the
 * two things Paul actually reported, because both are facts about the running
 * page: whether a band hired for one record follows you to the next one, and
 * whether anything at all can move the bass. So this file asks the artifact.
 *
 *   · a band is hired by hand, then a record is loaded from the atlas TWICE —
 *     once in session (Enter on the mark) and once as a cold load of the
 *     `#at=` link — and the pool must be null after each
 *   · a hired chair is REPORTED, not silent: ui/state.js poolSay() has a
 *     sentence for it and adoptSong publishes one on the status bus
 *   · POOL.bass reaches the ENGINE: audio/plan.js seats() must name the
 *     instrument that was hired, because that wire is the only control the
 *     bass chair has
 *
 * A WARNING ABOUT THE HARNESS, because it faked this bug report once already.
 * `page.goto(url + "#frag")` from the same url is a SAME-DOCUMENT navigation:
 * nothing reloads, no boot runs, no link is read — and the pool "survives",
 * because the tab never went away. Measured 2026-08-28: that route reports a
 * surviving pool and a #title still reading the OLD record, which is the tell.
 * Every cold load below is a goto followed by an explicit reload().
 *
 * Playwright is borrowed (NODE_PATH=/home/ford/ftrain-2025/node_modules) and
 * the executable path is EXPLICIT — chromium.launch() with no path resolves
 * shell build 1200, which is not installed on this machine.
 *
 *   node test/pool.browser.js
 *   node test/pool.browser.js --page http://localhost:8777/nukernel/index.html
 */
"use strict";
const { chromium } = require("playwright");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const PAGE = arg("--page", "http://localhost:8777/nukernel/index.html");
const EXE = arg("--chrome", process.env.HOME +
  "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
const ORIGIN = new URL(PAGE).origin;

const fails = [], notes = [];
const check = (okay, what) => { (okay ? notes : fails).push((okay ? "ok   " : "FAIL ") + what); };
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

  /* THE STORE IS ASKED FOR ITSELF. A dynamic import of ui/state.js inside the
     page returns the module the page is already running — ES modules are
     cached by URL — so this reads the live POOL and calls the live writers,
     not a second copy. */
  const S = (fn, a) => p.evaluate(([o, f, x]) =>
    import(o + "/nukernel/ui/state.js").then((M) => (0, eval)("(" + f + ")")(M, x)),
    [ORIGIN, String(fn), a === undefined ? null : a]);
  const pool = () => S((M) => (M.POOL ? JSON.parse(JSON.stringify(M.POOL)) : null));
  const say = () => S((M) => M.poolSay());
  const band = () => S((M) => M.poolBand());
  /* THE RECORD'S NAME IS `document.title` (2026-09-02). This read
     `#title`.textContent, and the <h1> it named was deleted on 2026-08-29 with
     the when-slider — test/atlas.js G8 already carries the same correction
     ("the when-slider and the <h1> were both deleted … the two facts moved
     rather than went"). Every check below that asks which record arrived has
     been reading "(no #title)" ever since, which is a stale gate and not a
     regression: ui/eight.js `draw()` is the one writer of the page's own name
     and it writes it where a browser tab shows it. */
  const name = () => p.evaluate(() =>
    String(document.title || "").trim() || "(no name)");
  /* THE CAST, OFF audio/plan.js ITSELF. `compile()` walks the song and fills
     the seat table; asked too early — inside the first frames after a cold
     load, before the record has been pushed across the seam — it answers with
     an empty list, which is not "no bass" but "not yet". So it is retried
     until a seat exists, and a genuinely empty cast still fails the check
     rather than passing it. */
  const seats = async () => {
    for (let i = 0; i < 20; i++) {
      const out = await p.evaluate((o) =>
        import(o + "/nukernel/audio/plan.js").then((P) => { P.compile();
          return P.seats().map((s) => s.chair + "=" + s.instr); }), ORIGIN);
      if (out.length) return out;
      await p.waitForTimeout(250);
    }
    return [];
  };
  const cold = async (frag) => { await p.goto(PAGE + frag, { waitUntil: "networkidle" });
    await p.reload({ waitUntil: "networkidle" }); await p.waitForTimeout(2200); };

  /* ---- 1 A PLAIN BOOT HIRES NOBODY ------------------------------------- */
  await cold("");
  check((await pool()) === null && (await say()) === null,
    "1 · a plain boot hires nobody — POOL is " + JSON.stringify(await pool()));

  /* ---- 2 A HIRED BAND IS SAYABLE --------------------------------------- */
  await S((M) => { M.hirePoolChair("lead", "overdrive_guitar");
                   M.hirePoolChair("bass", "slap_bass"); });
  await p.waitForTimeout(400);
  const hired = await pool(), sentence = await say(), rows = await band();
  check(hired && hired.lead === "overdrive_guitar" && hired.bass === "slap_bass",
    "2 · two chairs hired: " + JSON.stringify(hired));
  check(typeof sentence === "string" && /lead/.test(sentence) &&
        /overdrive guitar/.test(sentence),
    "2b · and there is a sentence for it: " + JSON.stringify(sentence));
  /* ...AND WHETHER THAT SENTENCE HAS REACHED THE PAGE IS PRINTED, NOT
     ASSERTED. ui/state.js publishes it on the "status" bus, and measured
     2026-08-28 NOTHING on this page subscribes to that bus — readout.js is
     not loaded and no view calls `on("status")`, so the genre note has been
     landing nowhere too. Asserting "the reader can see it" here would be the
     gate lying about the artifact; printing it is what makes the day it lands
     visible in a run. The mount is one line in ui/eight.js and it is named in
     this round's notes. */
  const onPage = await p.evaluate((t) =>
    document.body.innerText.indexOf(t.slice(0, 28)) >= 0, sentence);
  console.log("     (the sentence is " + (onPage ? "ON" : "NOT YET ON") +
    " the rendered page — ui/state.js emits it on the \"status\" bus, which " +
    "has no subscriber in ui/ today; one line in bandBlock mounts it)");
  check(rows.length === 2 && rows.every((r) => r.chair && r.id && r.label),
    "2c · …as rows a surface can draw and fire one by one: " + JSON.stringify(rows));

  /* ---- 3 THE BASS REACHES THE ENGINE ----------------------------------- */
  // the bass is the one chair whose instrument the document cannot carry, so
  // this is the whole of its control surface and it has to be measured at the
  // seat, not at the store.
  /* `&s=1` SINCE 2026-09-02. Paul: *"Boot up every new session with a new seed
     unless there's a seed in the URL."* An absent `s` used to mean 1 (the atlas
     clamped anything unreadable to it); it means A FRESH DRAW now, so a cold
     load with no seed is a different record every run and every byte-level
     claim below would be measuring the dice. The seed is named in the address,
     which is the door the sentence itself points at. */
  await cold("#at=Kingston&y=1969&s=1");
  const seat0 = (await seats()).filter((s) => s.slice(0, 5) === "bass=");
  await S((M) => M.hirePoolChair("bass", "fretless_bass"));
  await p.waitForTimeout(500);
  const seat1 = (await seats()).filter((s) => s.slice(0, 5) === "bass=");
  check(String(seat0) === "bass=acoustic_bass",
    "3 · with no band the bass seat is the chair's own: " + JSON.stringify(seat0));
  check(String(seat1) === "bass=fretless_bass",
    "3b · hiring a bass MOVES THE ENGINE'S SEAT: " + JSON.stringify(seat1));

  /* ---- 4 AN ATLAS LOAD FIRES THE BAND ---------------------------------- */
  // in session first: pressing a record is the same door a tap is
  // (ui/atlas.js -> CTX.setDocument -> push(true) -> adoptSong).
  /* ===== THE DOOR IS THE LIST ROW NOW, 2026-09-02 =======================
     WHAT STOOD HERE drove `#atlasYear` — "r.value = NuAtlas.indexOf(1988)",
     an `input` event, then Enter on the globe's Faisalabad mark. That control
     was DELETED on 2026-08-29 (Paul: *"Get rid of the time slider. Make the
     genre list permanent and always expanded"*; ui/atlas.js carries the
     tombstone and names its three replacements), so this step has been
     throwing `Cannot set properties of null (setting 'value')` ever since and
     taking the four checks after it down with it.
     THE REPLACEMENT IS THE GESTURE THAT REPLACED IT: the row in the permanent
     index, pressed. `openRow(gk)` is what that button runs and it lands on the
     record's own year by itself, so the year no longer has to be set first —
     which is exactly the sentence the tombstone makes about the list being
     the time instrument. `__eightTab("Where")` first because a row in a shut
     panel has a zero rect and cannot be pressed; the tab is a HAND's door
     (ui/eight.js `__eightTab` is the button's own listener), not a reach into
     private state. */
  const before = await pool();
  await p.evaluate(() => window.__eightTab("Where"));
  await p.waitForTimeout(400);
  const pressed = await p.evaluate(() => {
    const li = [...document.querySelectorAll("#atlasIndexRows .nu-ixli")]
      .find((x) => x.dataset.place === "Faisalabad" && x.dataset.year === "1988");
    const b = li && li.querySelector(".nu-ixrow");
    if (!b) return null;
    b.click();
    return b.dataset.gk || true;
  });
  check(!!pressed, "4a · the index has a Faisalabad 1988 row to press: " +
    JSON.stringify(pressed));
  await p.waitForTimeout(2500);
  check(/Faisalabad/.test(await name()),
    "4 · the record swapped in session: #title is " + JSON.stringify(await name()));
  check((await pool()) === null,
    "4b · …and the band hired for the LAST record was fired — was " +
    JSON.stringify(before) + ", now " + JSON.stringify(await pool()));

  /* ---- 5 …AND SO DOES A COLD LOAD OF THE LINK -------------------------- */
  await S((M) => M.hirePoolChair("lead", "overdrive_guitar"));
  await p.waitForTimeout(300);
  await p.evaluate(() => { try { localStorage.setItem("nukernel.pool.probe", "1"); }
    catch (e) {} });
  await cold("#at=Faisalabad&y=1988&s=1&t=where");
  check(/Faisalabad/.test(await name()),
    "5 · a cold load of the link lands the record: " + JSON.stringify(await name()));
  check((await pool()) === null,
    "5b · …with no band inherited from the session that hired one — POOL is " +
    JSON.stringify(await pool()));

  /* ---- 6 NO SILENT OUTRANKING ------------------------------------------ */
  // ui/derive.js `poolOverrideOf` is the refusal law applied to a VALUE: when
  // the pool answers for a chair, the control that lost has a sentence to
  // print. Asked of a CATALOG genre, which is the only case where the pool can
  // still legitimately win — a document's genre declares `chairs`, and a chair
  // that has spoken has spoken (the fix a round earlier).
  const over = await p.evaluate((o) => Promise.all([
      import(o + "/nukernel/ui/derive.js"), import(o + "/nukernel/ui/deps.js")])
    .then(([D, X]) => {
      const sec = { stack: [{ g: "reggae", slots: [0] }], focus: 0 };
      const g = X.GENRES.reggae, chairs = [], full = {};
      for (let v = 0; v < g.voices; v++) chairs.push(D.chairOf(sec, sec.stack[0], v));
      for (const c of chairs) full[c] = "overdrive_guitar";
      return { none: D.poolOverrideOf(sec, "reggae", 0, null),
               agree: D.poolOverrideOf(sec, "reggae", 0,
                 { [chairs[0]]: D.instrIdOf(sec, "reggae", 0, null) }),
               won: D.poolOverrideOf(sec, "reggae", 0, full),
               bass: D.bassOverrideOf({ bass: "fretless_bass" }),
               bassNone: D.bassOverrideOf(null) }; }), ORIGIN);
  check(over.none === null && over.agree === null,
    "6 · a chair playing its own is NOT reported as overridden " +
    JSON.stringify([over.none, over.agree]));
  check(over.won && over.won.playing === "overdrive_guitar" &&
        over.won.own && over.won.own !== over.won.playing && over.won.ownLabel,
    "6b · …and when the pool wins, the control that lost has its sentence: " +
    JSON.stringify(over.won));
  check(over.bassNone === null && over.bass && over.bass.own === "acoustic_bass" &&
        over.bass.playing === "fretless_bass",
    "6c · …including the bass, which no chairs seam can reach: " +
    JSON.stringify(over.bass));

  check(errs.length === 0, "7 · zero console errors / pageerrors " +
    JSON.stringify(errs.slice(0, 3)));

  await b.close();
  report();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
