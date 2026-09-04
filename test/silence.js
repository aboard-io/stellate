/* ===== THE BLANK STATE — `silence` (2026-09-02) =========================
 *
 * Paul, the composer round: *"Add a 'silence' genre at the top of the genre
 * list. This is a blank state."* And the sentence the whole round serves: *"I
 * want to BUILD THE BAND … I can hear the song evolve as I add and take things
 * away."*
 *
 * A BLANK STATE THAT CANNOT BE PLAYED IS A BLANK PAGE. The point of it is that
 * the transport WORKS on it — you press play, one eight-bar box goes round, and
 * you build a band into a record that is already running. So this gate asserts
 * the row, the document AND the sound, because the first two shipped correct
 * once with the third missing (`ui/derive.js songBars` dropped every box with
 * no events, so the blank state compiled to zero bars and `audio/live.js`
 * answered "nothing to play — click a genre to fill a box first").
 *
 * B1  the list PINS it first, with no year and no place, so the scroll that
 *     drives the year skips it the way it skips a role
 * B2  the box BOOTS on it — one section, zero voices — and the address says
 *     nothing, because nothing has been chosen
 * B3  #play works on it: the engine goes to `ready` and the transport says so
 * B4  tapping a genre row leaves it: the record is composed at the shown seed,
 *     it plays, and the page STAYS ON WHERE (2026-09-02, in place of "lands on
 *     that genre's Rules" — Paul: "I was wrong to have you switch to the genre
 *     panel. Add a genre editor nav element and stay on the globe and list.")
 *
 * RUN:  NODE_PATH=/home/ford/ftrain-2025/node_modules node test/silence.js
 */
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const { spawn } = require("child_process");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const EXE = arg("--chrome", process.env.HOME +
  "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
const ROOT = path.join(__dirname, "..");
const PAGE_ARG = arg("--page", null);

const fails = [], notes = [];
const check = (ok, what) => { (ok ? notes : fails).push((ok ? "ok   " : "FAIL ") + what); };

/* serve.sh's handler exactly, on a port the OS gives us (test/all.js's own, and
   test/gutter.js's — the ring engine wants a SharedArrayBuffer and a page that
   is not cross-origin isolated is a different page from the one that ships). */
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
  const srv = PAGE_ARG ? null : await standUpServer();
  const BASE = PAGE_ARG ||
    ("http://localhost:" + srv.port + "/nukernel/index.html");
  const b = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
  await p.goto(BASE, { waitUntil: "load" });
  await p.waitForTimeout(2600);

  /* ---- B1 THE ROW IS FIRST, AND IT IS NOT A DATE -------------------- */
  /* The list is a CHRONOLOGY and the blank state is not a point in it, so the
     row carries no `data-place` and no `data-year` — which is exactly what
     makes `sweep()` skip it (ui/atlas.js: "a row with no data-place/data-year
     moves no year and lights no mark"), the same way it skips the six roles
     that close the list. Its caption is "the blank state" and not "a role",
     because a role is a job the catalogue does and this is where the box
     starts. */
  const first = await p.evaluate(() => {
    const li = document.querySelector("#atlasIndexRows li");
    const rows = [...document.querySelectorAll("#atlasIndexRows li")];
    return { gk: li.dataset.gk,
             year: li.dataset.year == null ? null : li.dataset.year,
             place: li.dataset.place == null ? null : li.dataset.place,
             cellYear: li.querySelector(".nu-ixy").textContent,
             cellPlace: li.querySelector(".nu-ixp").textContent,
             h: +li.querySelector(".nu-ixrow").getBoundingClientRect()
                  .height.toFixed(1),
             /* AND IT IS THERE ONCE. `silence` is an EXCLUDE row, and EXCLUDE
                is what the closing loop walks — a pin that forgot to take it
                out of that loop would draw the row twice, at both ends. */
             n: rows.filter((x) => x.dataset.gk === "silence").length,
             total: rows.length };
  });
  check(first.gk === "silence" && first.year === null && first.place === null,
    "B1 · the list pins `silence` FIRST, with no year and no place for the " +
    "sweep to read — " + JSON.stringify(first));
  check(first.n === 1 && first.cellPlace === "the blank state" && first.h >= 44,
    "B1 · …once, captioned \"the blank state\" and not \"a role\", and a " +
    "thumb's target (" + first.h + " px)");

  /* ---- B2 THE BOX BOOTS ON IT --------------------------------------- */
  /* `let DOC = JSON.parse(JSON.stringify(TERMS))` — a copy of the shipped
     chant — stood at the head of ui/eight.js and the box opened playing
     somebody else's record. It boots on `genreToDocument("silence", 1)` now:
     one eight-bar section, ZERO voices, one cell of rests. The address is
     empty because nothing has been chosen (test/seed.js S1 owns that half). */
  const boot = await p.evaluate(() => {
    const d = window.__eightDoc();
    return { basis: d.basis, voices: d.voices.length,
             sections: d.form.sections.length, bars: d.form.sections[0].bars,
             cells: Object.keys(d.material.cells).length,
             title: document.title, hash: location.hash };
  });
  check(boot.basis === "silence" && boot.voices === 0 &&
        boot.sections === 1 && boot.cells >= 1 && boot.hash === "",
    "B2 · the box boots on the blank state — " + JSON.stringify(boot));

  /* ---- B3 AND IT PLAYS ---------------------------------------------- */
  /* THE HALF THAT SHIPPED MISSING. `ui/derive.js songBars` skips a box with no
     events ("a box that produces nothing takes no time" — right for the empty
     boxes a fresh page used to deal, wrong for a genre whose whole declaration
     is silence), so the blank state compiled to zero bars and `startAt`
     answered "nothing to play". The exemption is BY DECLARATION (`g.silent`,
     genres.js's own word) and this is the artifact-proof of it: the engine
     reaches `ready`, `playing` is true, and #play's word — which is the NEXT
     tap — reads "stop". */
  await p.evaluate(() => document.getElementById("play").click());
  const played = await p.waitForFunction(
    () => window.__nuBounce && window.__nuBounce().playing === true,
    null, { timeout: 12000 }).then(() => true).catch(() => false);
  const state = await p.evaluate(() => ({
    b: window.__nuBounce(), bars: window.__nuRender().bars,
    word: (document.getElementById("play").getAttribute("aria-label") || "").trim() }));
  check(played && state.bars > 0 && state.word === "stop",
    "B3 · #play works on the blank state: " + state.bars + " bars compiled, " +
    "state " + JSON.stringify(state.b.state) + ", the mark reads " +
    JSON.stringify(state.word));
  await p.evaluate(() => document.getElementById("play").click());
  await p.waitForTimeout(600);

  /* ---- B4 AND A GENRE TAKES YOU OUT OF IT --------------------------- */
  /* Paul: *"I click the genre, it starts to play, and there's a new view: A
     genre editor appears. This is the 'Rules' section."* One gesture, three
     effects — compose at the shown seed, start, and land on the rules — and
     the third is what this asserts, because the first two have shipped since
     2026-08-29 and the third is this round's. The genre is picked from the
     LIST, which is the row Paul means. */
  /* ...AND THE THIRD EFFECT IS REVERSED, 2026-09-02, after Paul used the page:
     *"I was wrong to have you switch to the genre panel. Add a genre editor
     nav element and stay on the globe and list."*

     TWO EFFECTS NOW, AND THE THIRD IS AN ABSENCE THIS GATE ASSERTS. The
     sentence above is kept because it is what the tab was built for and the
     Rules panel it names is still there — as a ROOT NAV ROW you open, which is
     Paul's own remedy in the same breath. What changed is that a pick may not
     move the page out from under the reader: you asked for a place, so you are
     still standing on the map, with the record playing and its name on the
     plate. Asserting the tab is UNCHANGED is the only way this stays fixed;
     "not Rules" would pass on a pick that landed on Export. */
  const seedShown = await p.evaluate(() =>
    +document.getElementById("reading").textContent);
  const tabBefore = await p.evaluate(() => window.__eightTabNow());
  await p.evaluate(() => {
    const r = [...document.querySelectorAll("#atlasIndexRows .nu-ixrow")]
      .find((x) => x.dataset.gk === "dub");
    r.scrollIntoView({ block: "center" }); r.click();
  });
  await p.waitForFunction(() => window.__eightDoc().basis === "dub",
    null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const after = await p.evaluate(() => ({
    basis: window.__eightDoc().basis,
    voices: window.__eightDoc().voices.length,
    tab: window.__eightTabNow(),
    /* THE RULES ROW IS STILL A DOOR, and this is the half of Paul's sentence
       that is a presence rather than an absence: *"Add a genre editor nav
       element."* The row is in the stripe, at the ROOT, addressable — so the
       editor the pick no longer forces on you is one tap away. */
    /* ...AND IT IS A ROW OF THE TABLE SINCE 2026-09-06 (TABLE.md §10b step
       2), not a row of the stripe. The claim is the same one — the editor is
       one tap away — read at the address it now has. */
    rulesRow: !!document.querySelector('#pan-band [data-k="trules"]'),
    word: (document.getElementById("play").getAttribute("aria-label") || "").trim(),
    plate: (() => { const b2 = document.querySelector('.nu-trayfoot [data-k="toptab-Where"] .nu-vh');
      return b2 ? b2.textContent.trim() : null; })() }));
  const want = await p.evaluate((s2) =>
    JSON.stringify(window.NuPrecompose.genreToDocument("dub", s2)), seedShown);
  const got = await p.evaluate(() => JSON.stringify(window.__eightDoc()));
  check(after.basis === "dub" && got === want,
    "B4 · tapping a genre row composes it AT THE SHOWN SEED (" + seedShown +
    "), byte for byte, and leaves the blank state — " + after.voices + " voices");
  check(after.tab === tabBefore && after.rulesRow,
    "B4 · …and STAYS where it was (" + JSON.stringify(tabBefore) + ") — a " +
    "pick does not move the page out from under the map — with the genre " +
    "editor a root nav row away: " + JSON.stringify({ tab: after.tab,
      rulesRow: after.rulesRow }));
  check(after.word === "stop" && !!after.plate,
    "B4 · …playing, with the record's name in the foot at every depth (" +
    JSON.stringify(after.plate) + ")");

  check(!errs.length, "B· zero pageerrors / console errors " +
    JSON.stringify(errs.slice(0, 4)));

  for (const n of notes) console.log(n);
  for (const f of fails) console.log(f);
  console.log(fails.length ? "\nFAILED " + fails.length + " of " +
    (fails.length + notes.length) + " checks"
    : "\nALL PASS (" + notes.length + " checks)  " + BASE);
  await b.close();
  if (srv) srv.proc.kill();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
