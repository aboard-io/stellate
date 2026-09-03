#!/usr/bin/env node
/* test/als-page.browser.js — THE ⤓ .als BUTTON, AND THE TWO OPINIONS IT HAS.
 *
 * (Paul, 2026-08-29: "Can I download Ableton yet" — then, when the answer
 * involved fetching a donor off the deployed site: "Why is any of it on the
 * server just make it all browser.")
 *
 * TEST THE ARTIFACT. This gate does not check wiring. It drives the real button
 * in a real chromium, catches the real download, un-gzips it, and reads the
 * bytes — the memory law "gates must read the RENDERED output; three features
 * shipped broken while every check passed" applied to a file instead of a page.
 *
 * THE LUXURY HERE IS A SECOND IMPLEMENTATION, and this gate is built around it.
 * The page and `tools/ableton/export-als.js` share `nukernel/export/als.js` for
 * the splice and `nukernel/export/score.js` for the fold, so for the SAME record
 * they must produce the SAME XML — the page off its EMBEDDED donor, the CLI off
 * the committed donor ON DISK — and the two decompressed documents are compared
 * BYTE FOR BYTE.
 *
 * WHAT THAT COMPARISON PROVES, EXACTLY, because a gate that oversells itself is
 * worse than no gate. Identical XML proves the three things that actually
 * differ between the two ends: (1) the donor embedded in nukernel/export/donor.js
 * IS the committed tools/ableton/donor/Generic.als, to the byte, since a stale
 * or truncated embed changes the document everywhere; (2) the splice is one
 * implementation and not two that agree; (3) the browser's gzip round-trips —
 * node's zlib opens what chromium's CompressionStream wrote. It does NOT prove
 * two independent folds agree, and it cannot: the fold moved to
 * nukernel/export/score.js so there is only one, which is the point. The fold's
 * own gate is `--genre <key>`, which recompiles from the record; that is what
 * als-gate.js Gate 1 has always run and it still does.
 *
 * AND THE RECORD REACHES NODE AS A SCORE, NOT AS A SONG — a finding, not a
 * preference. `ui/state.js songJSON()` cannot round-trip an eight.js record:
 * eight.js push() (eight.js:413) installs its compiled sections directly as
 * `GENRES["lab.eight."+i]` and adopts with `genres: {}`, so the saved JSON names
 * five genre keys whose recipes it does not carry. Handed back to node, all five
 * miss and song.js falls back to `simple` — MEASURED HERE on the first run of
 * this gate: the shipped chant came back as five boxes of "Simple" at 126 bpm
 * where the page had the record at 58. That is a real gap in state.js's
 * serialiser, it is outside this slice's fence, and what it means for the gate
 * is that "the same record" travels as the page's own `pageScore()` output
 * (score-node.mjs `--score` says the same thing from the other side).
 *
 *   · XML, never .als. Two gzip implementations legitimately differ in their
 *     output — zlib's and chromium's deflate make different (valid) streams for
 *     the same input — so comparing the containers would fail for a reason that
 *     has nothing to do with the export. What must be identical is the document
 *     inside, and that is what is compared. The gate proves the container is
 *     good by DECOMPRESSING it with node's zlib: a file zlib can gunzip and
 *     als-gate.js can then pass is a real .als, whatever bytes carried it.
 *
 * THEN THE SHIPPED GATES, OVER THE PAGE'S OWN FILE. `tools/ableton/als-gate.js`
 * is what has held the CLI since it shipped (well-formed + unique pointee ids,
 * the note multiset round-tripped against a recompile of the song, donor
 * conformance with the <Locator> refusal, the sample audit). The button is held
 * to the identical standard, on the file the button wrote, with no --no-gate
 * anywhere. Gate 4 is Live on Paul's machine and no machine here claims it.
 *
 * AND THE EMBED IS CURRENT. `node nukernel/export/donor-extract.js --check`
 * runs first, so an edited donor or a stale nukernel/export/donor.js fails
 * loudly rather than shipping a page that splices last week's set.
 *
 *   node test/als-page.browser.js
 *   node test/als-page.browser.js --page http://localhost:8777/nukernel/index.html
 *
 * Playwright is borrowed (NODE_PATH=/home/ford/ftrain-2025/node_modules) and
 * the executable path is EXPLICIT — chromium.launch() with no path resolves
 * shell build 1200, which is not installed on this machine.
 */
const CHANT = "#at=Rome&y=600&s=1";   // the shipped chant, named (2026-09-02)
"use strict";
const { chromium } = require("playwright");
const { spawn, execFileSync } = require("child_process");
const { gunzipSync } = require("zlib");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const PAGE_ARG = arg("--page", null);
const EXE = arg("--chrome", process.env.HOME +
  "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "als-page-"));

const fails = [], notes = [];
const check = (ok, what) => { (ok ? notes : fails).push((ok ? "ok   " : "FAIL ") + what); };
const report = () => {
  for (const n of notes) console.log(n);
  for (const f of fails) console.log(f);
  console.log(fails.length ? "\nFAILED " + fails.length + " of " + (fails.length + notes.length)
    : "\nALL PASS (" + notes.length + " checks)");
};

/* ---------- the runner's own static server, on a port it discovers ----------
   test/all.js's handler verbatim — COOP: same-origin, COEP: require-corp, so
   the page is cross-origin isolated and the ring engine gets its
   SharedArrayBuffer. Port 0, and it prints back what the OS gave it. */
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
  const p = spawn("python3", ["-c", SERVER_PY, ROOT], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((res, rej) => {
    let buf = "";
    const to = setTimeout(() => rej(new Error("the static server did not report a port")), 10000);
    p.stdout.on("data", (d) => { buf += d; const m = buf.match(/(\d+)/);
      if (m) { clearTimeout(to); res({ proc: p, port: +m[1] }); } });
    p.on("error", (e) => { clearTimeout(to); rej(e); });
  });
}

const node = (args) => execFileSync(process.execPath, args, { cwd: ROOT, encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"] });

(async () => {
  /* ---- 0. the embed is the committed donor ------------------------------ */
  try {
    const out = node(["nukernel/export/donor-extract.js", "--check"]).trim();
    check(/OK/.test(out), "donor-extract --check — " + out);
  } catch (e) {
    check(false, "donor-extract --check FAILED: " +
      String((e.stderr || "") + (e.stdout || "")).trim());
  }
  /* ...AND SO ARE THE OTHER FOUR PHOTOGRAPHS. The page carries five pieces of
     donor in its module graph now — the whole splice base (donor.js), the drum
     rack (drumrack.js), the seven audio devices Paul put in the second donor
     that the first one has not got (fxrack.js), the three MASTER-CHAIN devices
     only the third donor has (masterrack.js: Saturator, Glue Compressor,
     Limiter, which the record's `master` words land on), and — since the
     Answers2 round — the three the FOURTH donor brought (fxrack2.js: PhaserNew,
     Cabinet, Amp, which the `phaser` and `crunch` chips land on). Each has a
     generator and a `--check`, and each is a file that can silently go stale
     against the committed `.als`; checking four of the five and trusting the
     fifth is exactly the gap this test exists to close. */
  for (const gen of ["drumrack-extract.js", "fxrack-extract.js", "masterrack-extract.js",
                     "fxrack2-extract.js"]) {
    try {
      const out = node(["nukernel/export/" + gen, "--check"]).trim();
      check(/matches/.test(out), gen + " --check — " + out);
    } catch (e) {
      check(false, gen + " --check FAILED: " +
        String((e.stderr || "") + (e.stdout || "")).trim());
    }
  }

  let server = null, PAGE = PAGE_ARG;
  if (!PAGE) {
    server = await standUpServer().catch((e) => { console.error("!! " + e.message); return null; });
    if (!server) { check(false, "could not stand up a static server"); report(); process.exit(2); }
    PAGE = "http://127.0.0.1:" + server.port + "/nukernel/index.html";
  }
  const ORIGIN = new URL(PAGE).origin;

  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text()))
    errs.push("console: " + m.text()); });

  /* NOTHING IS FETCHED, AND THE GATE IS WHAT PROVES IT. Paul's constraint is
     the design, so it gets a measurement and not a promise: every request the
     page makes from the click onward is recorded, and the donor must not be
     among them. `donor/Generic.als` is served by this very server — it is under
     ROOT — so a fetch WOULD succeed here and pass unnoticed. This is the check
     that would catch it. */
  const asked = [];
  p.on("request", (r) => asked.push(r.url()));

  await p.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  /* THE BOX BOOTS ON THE BLANK STATE (2026-09-02). Paul, the composer round:
     *"Add a 'silence' genre at the top of the genre list. This is a blank
     state."* — one eight-bar section, ZERO voices, one cell of rests. This gate
     is about a record with a band in it, so it names one in the address, the way
     a link does: the shipped chant, at seed 1 because the boot draws a seed now
     (*"Boot up every new session with a new seed unless there's a seed in the
     URL"*) and a gate that re-rolled its own subject would measure a different
     record every run. */
  await p.goto(PAGE + CHANT, { waitUntil: "networkidle" });
  await p.waitForFunction(() => typeof window.__deckState === "function", null, { timeout: 30000 });

  /* ---- 1. the card is live, and says nothing about a command line ------- */
  await p.evaluate(() => window.__eightTab("Export"));
  await p.waitForFunction(() => (window.__deckState().exports || [])
    .some((e) => e.k === "deck.exp.als"), null, { timeout: 20000 });
  const card = (await p.evaluate(() => window.__deckState().exports))
    .find((e) => e.k === "deck.exp.als");
  check(!!card && !card.disabled, "the ALS card is enabled — label " + JSON.stringify(card && card.label));
  check(!!card && !card.why, "…and carries no refusal text (was: \"exports from the " +
    "command line today…\") — got " + JSON.stringify((card && card.why) || ""));

  /* PAUL'S RUBATO SETTING, READ BEFORE ANYTHING EXPORTS. als-page.js turns
     rubato OFF for the length of the fold — the CLI's own argument: rubato
     gives bars of 15.927 steps against Live's metric grid, so the set plays
     right and is unreadable — and puts it back in a `finally`. Nothing else in
     the gate can catch a failed restore: two exports in a row would agree with
     each other either way. So it is read here and read again at the end, and
     the localStorage key with it, because setRubato writes through to it and a
     silently flipped preference would outlive the tab. */
  const rubBefore = await p.evaluate(async (origin) => {
    const st = await import(origin + "/nukernel/ui/state.js");
    return { on: st.RUBATO, stored: localStorage.getItem("nukernel.rubato.v1") };
  }, ORIGIN);

  /* ---- 2. the record on screen, as the page's own exporter folds it ---- */
  /* The SAME module instance the page is running: an ES module is keyed by its
     resolved URL, so this imports eight.js's own als-page.js and its own
     state.js underneath it, not a second copy with a fresh SONG. `pageScore()`
     is called a SECOND time here — the click at step 3 called it once — so a
     byte-identical result downstream is also a determinism check on the fold. */
  const scoreObj = await p.evaluate(async (origin) => {
    const m = await import(origin + "/nukernel/export/als-page.js");
    return JSON.parse(JSON.stringify(await m.pageScore()));
  }, ORIGIN);
  const SCORE = path.join(TMP, "score.json");
  fs.writeFileSync(SCORE, JSON.stringify(scoreObj));
  const laneN = scoreObj.boxes.reduce((n, b) => n + b.lanes.length, 0);
  check(scoreObj.boxes.length > 0 && laneN > 0,
    "the page folded its record — " + scoreObj.boxes.length + " boxes, " + laneN +
    " lanes, " + scoreObj.bpm + " bpm, cast " +
    (scoreObj.cast.map((c) => c.v + " " + c.instr).join(", ") || "(none)"));

  /* ...AND IT IS THE RECORD ON SCREEN, tied to the document by DATA and not by
     trust. The tempo and the section labels are things eight.js's DOC states
     and the exported score must repeat; a score re-derived from a genre key
     could not match both. (The names carry the box number — score.js labelOf
     says why — so this is a containment check, not equality.) */
  const doc = await p.evaluate(() => {
    const d = window.__eightDoc();
    return { bpm: d.time.bpm, sections: d.form.sections.map((x) => x.name || x.label || "") };
  });
  check(scoreObj.bpm === doc.bpm, "the score's tempo IS the document's — " +
    scoreObj.bpm + " vs DOC.time.bpm " + doc.bpm);
  check(scoreObj.boxes.length === doc.sections.length,
    "one box per section of the document on screen — " + scoreObj.boxes.length +
    " vs " + doc.sections.length);

  /* ---- 3. press the real button, catch the real download ---------------- */
  const askedFrom = asked.length;
  const dlP = p.waitForEvent("download", { timeout: 120000 });
  await p.click('[data-k="deck.exp.als"]');
  let PAGE_ALS = null;
  try {
    const dl = await dlP;
    PAGE_ALS = path.join(TMP, "page.als");
    await dl.saveAs(PAGE_ALS);
    check(/\.als$/.test(dl.suggestedFilename()),
      "the button handed over a download — " + dl.suggestedFilename() + ", " +
      fs.statSync(PAGE_ALS).size + " bytes");
  } catch (e) {
    const said = await p.evaluate(() => {
      const n = document.querySelector("#exportdeck [role=status]");
      return n ? n.textContent : "";
    }).catch(() => "");
    check(false, "no download after the click — the card said " + JSON.stringify(said));
  }
  // the deck's own line — and the only one, since ui/eight.js deleted the JSON
  // card's second `[role=status]` (see the tombstone at 3b)
  const said = await p.evaluate(() => {
    const n = document.querySelector("#exportdeck [role=status]");
    return n ? n.textContent : "";
  });
  check(/^spliced —/.test(said), "the card said what happened — " + JSON.stringify(said));

  const rubAfter = await p.evaluate(async (origin) => {
    const st = await import(origin + "/nukernel/ui/state.js");
    return { on: st.RUBATO, stored: localStorage.getItem("nukernel.rubato.v1") };
  }, ORIGIN);
  check(rubAfter.on === rubBefore.on && rubAfter.stored === rubBefore.stored,
    "rubato was put back exactly as it was found — " + JSON.stringify(rubBefore) +
    " then " + JSON.stringify(rubAfter));

  /* ---- 3b. NO CompressionStream: it REFUSES, and says why -------------- */
  /* "Nothing greys silently", and the other half of that law is that nothing
     hands over a corrupt file either. An .als IS gzipped XML; a browser that
     cannot gzip has nothing honest to give, so the card must say the true
     reason and re-enable itself rather than write a Blob of raw XML with an
     .als on the end — which Live would open as an error dialog and Paul would
     read as "the exporter is broken".
     THE GLOBAL IS TAKEN AWAY FOR REAL, not stubbed out in a branch: canGzip()
     reads `typeof CompressionStream` at call time, so deleting it here is the
     same page an old Safari would be. This runs LAST on this page because it
     is destructive to the window it runs in — everything measured above is
     already measured by the time it fires. */
  /* IT WAS READING THE WRONG STATUS LINE (2026-09-02, the wave-4 round) — and
     then there was only one. `#exportdeck [role=status]` matched TWO kinds of
     paragraph, and `querySelector` returned the JSON card's, which only ever
     speaks when somebody saves a .song.json: this gate read `""` and reported
     a card refusing without naming a reason, which is the one thing this card
     does not do. The card's line is DELETED now (ui/eight.js `songCard`), so
     the filter that worked around it is gone too. It is still re-asked every
     poll, because ui/eight.js rebuilds the Export tab from scratch on a
     redraw. */
  const refusal = await p.evaluate(async () => {
    delete window.CompressionStream;
    const sayNow = () => {
      const n = document.querySelector("#exportdeck [role=status]");
      return n ? n.textContent : "";
    };
    const btn = document.querySelector('[data-k="deck.exp.als"]');
    btn.click();
    for (let i = 0; i < 100 && !/CompressionStream|failed/.test(sayNow()); i++)
      await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 100));
    return { said: sayNow(), disabled: btn.disabled,
             gone: typeof window.CompressionStream };
  });
  check(/CompressionStream/.test(refusal.said) && /gzipped XML/.test(refusal.said),
    "with CompressionStream gone (typeof " + refusal.gone + ") the card REFUSES and " +
    "names the reason — " + JSON.stringify(refusal.said));
  check(refusal.disabled === false,
    "…and the button came back in the finally, exactly like WAV and MP3 — disabled=" +
    refusal.disabled);

  /* ---- 4. no donor was fetched --------------------------------------- */
  /* SAY THE TRUE THING. The donor is not fetched: it arrives as an ES module in
     the app's own tree (nukernel/export/donor.js, pulled by the dynamic import
     inside the click, exactly as export/wav.js and export/mp3.js are). What is
     REFUSED is a data asset — anything under tools/, anything ending .als, and
     anything off-origin. That distinction is the whole of Paul's constraint:
     tools/ is not in the deployed web root at all, so a fetch of
     donor/Generic.als is a path that cannot survive a deploy, while a module
     beside eight.js ships with eight.js or nothing ships. This server serves
     ROOT, so donor/Generic.als IS reachable here and a fetch WOULD have quietly
     worked — which is exactly why the check is worth having. */
  const during = asked.slice(askedFrom);
  const asset = during.filter((u) => /\.als(\?|$)/i.test(u) || /\/tools\//.test(u));
  const offsite = during.filter((u) => !u.startsWith(ORIGIN) && !u.startsWith("blob:") &&
                                       !u.startsWith("data:"));
  check(!asset.length, "no donor DATA file was fetched — nothing under tools/, no .als " +
    "(both are reachable from this server, so a fetch would have worked) — " +
    (asset[0] || "0 of " + during.length + " requests"));
  check(!offsite.length, "nothing off-origin during the export — " +
    (offsite[0] || during.length + " requests, all " + ORIGIN));
  const donorMod = during.filter((u) => /nukernel\/export\/donor\.js$/.test(u));
  check(donorMod.length === 1, "the donor came in as ONE module out of the app's own " +
    "tree, on demand — " + (donorMod[0] || "NOT REQUESTED (already imported?)"));

  await ctx.close(); await b.close();
  if (server) server.proc.kill();

  if (!PAGE_ALS) { check(false, "no file to compare"); report(); process.exit(1); }

  /* ---- 5. the container is a real gzip, and node can open it ------------ */
  let pageXml = null;
  try { pageXml = gunzipSync(fs.readFileSync(PAGE_ALS)); }
  catch (e) { check(false, "node's zlib could NOT gunzip the page's .als: " + e.message); }
  if (pageXml) check(pageXml.slice(0, 6).toString() === "<?xml ",
    "chromium's CompressionStream wrote a gzip node can open — " + pageXml.length +
    " bytes of XML out of " + fs.statSync(PAGE_ALS).size + " on disk");

  /* ---- 6. the CLI's second opinion, over the same record ---------------- */
  const CLI_ALS = path.join(TMP, "cli.als");
  let cliXml = null;
  try {
    node(["tools/ableton/export-als.js", "--score", SCORE, "--all", "--no-gate",
          "--out", CLI_ALS]);
    cliXml = gunzipSync(fs.readFileSync(CLI_ALS));
    check(true, "the CLI spliced the DISK donor with the page's own score — " +
      fs.statSync(CLI_ALS).size + " bytes, " + cliXml.length + " of XML");
  } catch (e) {
    check(false, "the CLI failed on the page's score: " +
      String((e.stderr || "") + (e.stdout || e.message || "")).trim().split("\n").slice(-3).join(" / "));
  }

  if (pageXml && cliXml) {
    if (pageXml.equals(cliXml)) {
      check(true, "the page's XML is BYTE-IDENTICAL to the CLI's — " + pageXml.length +
        " bytes, same splice, same fold, one exporter with two ends");
    } else {
      // NO FUDGING. Say exactly where they part and how far apart they are.
      let i = 0;
      const n = Math.min(pageXml.length, cliXml.length);
      while (i < n && pageXml[i] === cliXml[i]) i++;
      const near = (buf) => JSON.stringify(buf.slice(Math.max(0, i - 60), i + 60).toString());
      check(false, "the page's XML DIFFERS from the CLI's — lengths " + pageXml.length +
        " vs " + cliXml.length + ", first difference at byte " + i +
        "\n       page: " + near(pageXml) + "\n       cli : " + near(cliXml));
    }
  }

  /* ---- 7. the shipped gates, over the PAGE's file ----------------------- */
  try {
    const out = node(["tools/ableton/als-gate.js", PAGE_ALS, "--score", SCORE, "--all"]);
    process.stdout.write(out.replace(/^/gm, "       "));
    check(true, "tools/ableton/als-gate.js passed over the PAGE-produced .als");
  } catch (e) {
    process.stdout.write(String((e.stdout || "") + (e.stderr || "")).replace(/^/gm, "       "));
    check(false, "tools/ableton/als-gate.js FAILED over the PAGE-produced .als");
  }

  check(!errs.length, "no page errors — " + (errs[0] || "clean"));
  console.log("\n       page .als kept at " + PAGE_ALS);
  report();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(2); });
