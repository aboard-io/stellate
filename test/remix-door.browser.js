#!/usr/bin/env node
/* test/remix-door.browser.js — THE .mid UPLOAD DOOR, DRIVEN IN THE REAL APP.
 *
 * Paul, 2026-09-06: *"Could you write an auto remix function that could take a
 * midi file, arrange it, extract motifs, and make it a new genre?"*
 * `tools/remix.js` was that round and `test/remix.browser.js` proved the
 * pipeline runs on a page. Neither of them touches the DOOR — the card in the
 * Export view that a hand actually presses — and docs/REMIX.md's own §"The seam
 * the UI door must implement" is a specification, not a measurement.
 *
 * TEST THE ARTIFACT. This gate drives `nukernel/index.html` itself, at 390x844
 * under iPhone 14 emulation, with a real `.mid` fed through
 * `page.setInputFiles`. It is not a synthetic page loading the same scripts;
 * the whole claim of the round is that the CARD works, and a card lives in a
 * page or it lives nowhere.
 *
 * WHAT IS ASSERTED
 *   D0  THE CARD IS IN THE EXPORT VIEW, it is a real `<input type="file">` that
 *       takes `.mid`, it carries an accessible name, and it adds NO second
 *       `role="status"` to a deck that has one (the law at ui/eight.js
 *       `songCard`).
 *   D1  IT SAYS IT IS WORKING WHILE IT WORKS. The deck's line is watched from
 *       the moment the file is handed over; the loading and the reading
 *       sentences both have to appear before the run finishes.
 *   D2  IT IS `aria-disabled` AND NEVER `disabled` WHILE BUSY, and a second
 *       file dropped mid-run is ANSWERED rather than swallowed.
 *   D3  THE FINISHED SENTENCE SAYS WHAT THE TOOL FOUND — the section count,
 *       the motif count, and at least one answer the tool itself flagged as a
 *       guess, in the tool's own words.
 *   D4  THE WHOLE PRINTED RUN IS REACHABLE. Every decision the CLI prints goes
 *       into the page's own log, in the CLI's order.
 *   D5  THE BOX CHANGED TO THE MINED RECORD — the document's `basis` is the
 *       mined key, the mined row is in the in-memory table, the form is the
 *       form the tool found, and the page landed on the Band view.
 *   D6  IT SURVIVES A RELOAD. The page is reloaded from its own address and
 *       the record — and the ROW under it, which no catalogue holds — is still
 *       there.
 *   D7  IT REFUSES BY NAME. A file that is not a MIDI file gets the pipeline's
 *       own sentence through the deck's one line, and the record on the page
 *       is untouched.
 *   D8  ZERO pageerror over the whole run.
 *
 * THE INPUT IS THE BOX'S OWN EXPORTER'S, exactly as test/remix.test.js R2 and
 * test/remix.browser.js write it — four alternating boxes of `gregorian` and
 * `techno` — so the ground truth is known and no fixture has to be committed.
 *
 * RUN: NODE_PATH=<a tree with playwright> node test/remix-door.browser.js
 *      …--chrome <path>   name the chromium binary
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { chromium, devices } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const EXE = arg("--chrome", null) || (() => {
  const home = process.env.HOME;
  for (const d of ["chromium-1234", "chromium_headless_shell-1234", "chromium-1217"])
    for (const b of ["chrome-linux64/chrome", "chrome-linux/headless_shell", "chrome-linux/chrome"]) {
      const p = path.join(home, ".cache/ms-playwright", d, b);
      if (fs.existsSync(p)) return p;
    }
  return path.join(home, ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
})();

let pass = 0, fail = 0;
const check = (ok, what, why) => {
  if (ok) { pass++; console.log("  ok   " + what); }
  else { fail++; console.log("  FAIL " + what + (why ? "\n       " + why : "")); }
};

/* test/all.js's handler verbatim: COOP same-origin + COEP require-corp, which
   is what the app is actually served under. */
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

/** the deck's ONE status line — outside a card, which is the whole of the law
 *  the card is held to (ui/eight.js `songCard`: "ONE STATUS LINE IN THIS DECK
 *  AND IT IS THE DECK'S"). */
const DECKSAY = "#exportdeck > [role=status], #exportdeck [role=status]:not(.nu-exp [role=status])";

(async () => {
  console.log("test/remix-door.browser.js — the .mid door, in the real app");

  /* ---- the input: a record the box itself wrote ------------------------ */
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "nu-remix-door-"));
  const SN = await import(ROOT + "/tools/ableton/score-node.mjs");
  SN.shimWindow();
  const { smfFromScore } = await import(ROOT + "/nukernel/export/smf.js");
  const state = await import(ROOT + "/nukernel/ui/state.js");
  const { GENRES } = require(ROOT + "/nukernel/genres.js");
  const KEYS = ["gregorian", "techno", "gregorian", "techno"];
  const raw = state.defaultSong();
  const tmpl = JSON.stringify(raw.song[0]);
  raw.song = KEYS.map((k) => { const b = JSON.parse(tmpl);
    b.stack = [{ g: k, slots: [0] }]; b.len = GENRES[k].bars || 4; return b; });
  const songPath = path.join(TMP, "gt.song.json");
  fs.writeFileSync(songPath, JSON.stringify(raw));
  const score = await SN.loadScore({ songPath });
  const MID = path.join(TMP, "gt.mid");
  fs.writeFileSync(MID, Buffer.from(smfFromScore(score)));
  /* ...AND A FILE THAT IS NOT ONE, for D7. Named `.mid` so the input's own
     `accept` cannot be what refuses it: the refusal has to come from the
     pipeline, by name. */
  const NOTMID = path.join(TMP, "notes.mid");
  fs.writeFileSync(NOTMID, "this is not a MIDI file, it is a sentence.\n");

  const { proc, port } = await standUpServer();
  const PAGE = "http://127.0.0.1:" + port + "/nukernel/index.html";
  const browser = await chromium.launch({ executablePath: EXE });
  /* iPhone 14, 390x844 — the phone the table is designed for (TABLE.md
     "mobile-first"). `devices` may not carry the name on an older playwright,
     so the viewport is stated as well as named. */
  const ctx = await browser.newContext({
    ...(devices["iPhone 14"] || {}),
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));

  try {
    await page.goto(PAGE, { waitUntil: "networkidle" });
    await page.waitForFunction(() => typeof window.__eightTab === "function",
                               null, { timeout: 30000 });
    await page.evaluate(() => window.__eightTab("Export"));
    await page.waitForSelector('#exportdeck input[data-k="deck.exp.remix"]',
                               { timeout: 20000 });

    /* ---- D0 the card ------------------------------------------------- */
    console.log("\nD0 — the card is in the Export view");
    const card = await page.evaluate(() => {
      const f = document.querySelector('#exportdeck input[data-k="deck.exp.remix"]');
      const c = f && f.closest(".nu-exp");
      return {
        type: f && f.type, accept: f && f.accept,
        aria: f && f.getAttribute("aria-label"),
        disabled: !!(f && f.disabled),
        ariaDisabled: f && f.getAttribute("aria-disabled"),
        head: c ? (c.querySelector(".nu-exp-head") || {}).textContent : null,
        sub: c ? (c.querySelector(".nu-hint") || {}).textContent : null,
        statusInCard: c ? c.querySelectorAll("[role=status]").length : -1,
        statusInDeck: document.querySelectorAll("#exportdeck [role=status]").length,
        /* the two cards are neighbours: the record import is the one before it */
        prev: c && c.previousElementSibling
          ? !!c.previousElementSibling.querySelector('[data-k="deck.exp.songopen"]') : false,
      };
    });
    check(card.type === "file" && /\.mid/.test(card.accept || ""),
      "it is an <input type=file> that takes .mid — accept " + JSON.stringify(card.accept));
    check(!!card.aria && card.aria.length > 3,
      "…with an accessible name that says what it takes: " + JSON.stringify(card.aria));
    check(card.statusInCard === 0,
      "…and NO status line of its own — the deck has " + card.statusInDeck +
      ", and it is the deck's (ui/eight.js songCard's law)");
    check(card.prev === true,
      "…standing beside the record import, which is the same gesture on the other file type");
    console.log("       head " + JSON.stringify(card.head) + "  sub " + JSON.stringify(card.sub));

    /* ---- D1/D2 it says it is working, and stays pressable ------------- */
    console.log("\nD1/D2 — it says it is working WHILE it works");
    /* THE LINE IS WATCHED FROM INSIDE THE PAGE, because the run is seconds and
       polling from the driver can step straight over a sentence.

       AND IT IS RE-QUERIED ON EVERY TICK, NOT OBSERVED. `expSay` writes the
       module-level `deckSay` AT CALL TIME, and landing the record calls
       `setDocument`, which redraws — so the paragraph the last sentence lands
       on is a DIFFERENT NODE from the one the first two landed on. A
       MutationObserver bound to the first node reports the run as ending in
       silence, which is exactly the bug ui/eight.js's own `expSay` note says
       this deck already had once. The same tick reads the control's two
       states, so "aria-disabled and never disabled" is measured over the whole
       busy window rather than sampled once. */
    await page.evaluate((sel) => {
      window.__said = [];
      window.__ariaSeen = [];
      window.__tick = setInterval(() => {
        const el = document.querySelector(sel);
        const t = el ? el.textContent : null;
        if (t && t !== window.__said[window.__said.length - 1]) window.__said.push(t);
        const f = document.querySelector('#exportdeck input[data-k="deck.exp.remix"]');
        if (f) window.__ariaSeen.push({ aria: f.getAttribute("aria-disabled"),
                                        disabled: f.disabled });
      }, 10);
    }, DECKSAY);

    await page.setInputFiles('#exportdeck input[data-k="deck.exp.remix"]', MID);
    /* THE SECOND PRESS, WHILE IT RUNS. `setInputFiles` fires `change`
       synchronously enough that this lands inside the busy window — the run
       takes seconds — and what comes back must be a SENTENCE, not silence. */
    await page.setInputFiles('#exportdeck input[data-k="deck.exp.remix"]', MID);
    const busyState = await page.evaluate(() => {
      const f = document.querySelector('#exportdeck input[data-k="deck.exp.remix"]');
      return { aria: f.getAttribute("aria-disabled"), disabled: f.disabled };
    });

    await page.waitForFunction(
      () => window.__said.some((s) => /^Mined |^Cannot remix |could not be loaded/.test(s)),
      null, { timeout: 120000 });
    const said = await page.evaluate(() => window.__said);
    const ariaSeen = await page.evaluate(() => {
      clearInterval(window.__tick);
      /* only the ticks taken while it was busy: the poll keeps running after
         the run lands, and a control that is not busy is not aria-disabled */
      return window.__ariaSeen.filter((a) => a.aria === "true" || a.disabled); });
    console.log("       the line said, in order:");
    for (const s of said) console.log("         · " + s);

    check(said.some((s) => /remix tools/i.test(s)),
      "it said the tools were being fetched before it fetched them");
    check(said.some((s) => /^Reading /.test(s)),
      "…and said it was reading the file before it read it");
    check(said.some((s) => /^Still reading /.test(s)),
      "a second file dropped mid-run is ANSWERED, not swallowed — " +
      JSON.stringify(said.find((s) => /^Still reading /.test(s)) || null));
    check(busyState.aria === "true" && busyState.disabled === false,
      "…and while busy the control is aria-disabled and NEVER disabled — " +
      JSON.stringify(busyState));
    check(ariaSeen.length > 0 && ariaSeen.every((a) => a.disabled === false),
      "…which held for every tick it was busy (" + ariaSeen.length + " sampled)");

    /* ---- D3 what it FOUND, in the tool's own words -------------------- */
    console.log("\nD3 — the finished sentence says what the tool found");
    const done = said.find((s) => /^Mined /.test(s)) || "";
    console.log("       " + JSON.stringify(done));
    check(/\d+ sections/.test(done), "it names the section count");
    check(/\d+ motifs/.test(done), "…and the motif count");
    check(/Guesses: .+/.test(done) && /form:|melody line:/.test(done),
      "…and names what the tool itself flagged as a guess, in the tool's own words");

    /* ---- D4 the whole printed run is reachable ------------------------ */
    console.log("\nD4 — every decision the tool printed is in the log");
    const log = await page.evaluate(() => {
      const btn = document.querySelector('[data-k="logger"]');
      if (btn) btn.click();
      return [...document.querySelectorAll("#nu-log li")]
        .map((li) => (li.querySelector("span") || {}).textContent || "");
    });
    check(log.some((l) => /step\s+what\s+decided/.test(l)),
      "the tool's own header line is in the log");
    check(log.some((l) => /THE NAMES ARE GUESSES/.test(l)) &&
          log.some((l) => /A GUESS/.test(l)),
      "…and both of the lines it marked as guesses");
    check(log.filter((l) => /\bconf \d/.test(l)).length >= 15,
      "…and the whole run of decisions (" +
      log.filter((l) => /\bconf \d/.test(l)).length + " decision lines)");

    /* ---- D5 the box actually changed --------------------------------- */
    console.log("\nD5 — the box changed to the mined record");
    const after = await page.evaluate(() => ({
      basis: window.__eightDoc().basis,
      sections: window.__eightDoc().form.sections.map((s) => s.role + ":" + s.bars).join(" "),
      cells: Object.keys(window.__eightDoc().material.cells),
      voices: window.__eightDoc().voices.length,
      rowHere: !!(window.NuGenres && window.NuGenres.GENRES &&
                  window.NuGenres.GENRES[window.__eightDoc().basis]),
      openTab: window.__eightTabNow ? window.__eightTabNow() : null,
      slot: localStorage.getItem("nukernel.remix.v1") ? "held" : "empty",
    }));
    check(/^remix/.test(after.basis || ""),
      "the record on the page is the mined one — basis " + JSON.stringify(after.basis));
    check(after.rowHere,
      "…and the mined row is in the in-memory table under that key (nothing " +
      "was written to the catalogue)");
    check(after.sections.length > 0 &&
          done.indexOf(after.sections.replace(/(\w+):(\d+)/g, "$1:$2")) >= 0,
      "…with the very form the finished sentence named as a guess: " + after.sections);
    check(after.openTab === "Band",
      "…and it landed you on the record — the open view is " +
      JSON.stringify(after.openTab));
    check(after.voices > 0 && after.cells.length > 0,
      "…and " + after.voices + " players over " + after.cells.length + " motifs: " +
      after.cells.join(", "));
    check(after.slot === "held", "…and the row is kept for the next boot");

    /* ---- D6 it survives a reload ------------------------------------- */
    console.log("\nD6 — the session survives a reload");
    /* THE SLOT IS FLUSHED BEFORE THE RELOAD. `ui/state.js save()` is debounced
       250 ms and flushed on `pagehide`; a driver reload does fire pagehide,
       but waiting is what a hand does and it is what makes this a measurement
       of the app rather than of a race. */
    await page.waitForTimeout(600);
    const wantBasis = after.basis, wantSections = after.sections;
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => typeof window.__eightDoc === "function",
                               null, { timeout: 30000 });
    /* the row is reinstalled asynchronously — the pipeline is fetched again —
       so the gate waits for it the way the page does */
    await page.waitForFunction((k) => window.NuGenres && window.NuGenres.GENRES &&
                                      !!window.NuGenres.GENRES[k],
                               wantBasis, { timeout: 120000 })
      .catch(() => {});
    const back = await page.evaluate(() => ({
      basis: window.__eightDoc().basis,
      sections: window.__eightDoc().form.sections.map((s) => s.role + ":" + s.bars).join(" "),
      cells: Object.keys(window.__eightDoc().material.cells),
      rowHere: !!(window.NuGenres && window.NuGenres.GENRES &&
                  window.NuGenres.GENRES[window.__eightDoc().basis]),
    }));
    check(back.basis === wantBasis,
      "the mined record is still there after a reload — basis " + JSON.stringify(back.basis));
    check(back.sections === wantSections,
      "…with the same form: " + back.sections, "was " + wantSections);
    check(back.rowHere,
      "…AND the row under it is back, which no catalogue holds and no genre " +
      "set can rebuild");

    /* ---- D7 it refuses by name --------------------------------------- */
    console.log("\nD7 — a file that is not a MIDI file is refused BY NAME");
    await page.evaluate(() => window.__eightTab("Export"));
    await page.waitForSelector('#exportdeck input[data-k="deck.exp.remix"]',
                               { timeout: 20000 });
    const beforeRefuse = await page.evaluate(() => JSON.stringify(window.__eightDoc()));
    await page.setInputFiles('#exportdeck input[data-k="deck.exp.remix"]', NOTMID);
    await page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return el && /^Cannot remix /.test(el.textContent);
    }, DECKSAY, { timeout: 120000 }).catch(() => {});
    const refusal = await page.evaluate((sel) => {
      const el = document.querySelector(sel); return el ? el.textContent : ""; }, DECKSAY);
    console.log("       " + JSON.stringify(refusal));
    check(/^Cannot remix notes\.mid — .+/.test(refusal),
      "the refusal names the file and carries the tool's own sentence");
    check(await page.evaluate(() => JSON.stringify(window.__eightDoc())) === beforeRefuse,
      "…and the record on the page is unchanged");

    /* ---- D8 -------------------------------------------------------- */
    console.log("\nD8 — the page never threw");
    check(pageErrors.length === 0, "zero pageerror over the whole run",
      pageErrors.join("\n       "));
  } finally {
    await browser.close();
    proc.kill();
    fs.rmSync(TMP, { recursive: true, force: true });
  }

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
