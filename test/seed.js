/* ===== THE SEED — a new one every session (2026-09-02) ==================
 *
 * Paul, the composer round: *"Boot up every new session with a new seed unless
 * there's a seed in the URL. When I click seed pop up a vertical slider from
 * zero to 2^16."*
 *
 * THIS REVERSES A DATED LAW AND THE GATE SAYS SO. 2026-08-27: *"READING 1 IS
 * TODAY, BYTE FOR BYTE — the atlas opens every anchor at seed 1, so the record
 * a hand lands on is the record it has always been; only pressing REWRITE
 * moves."* A hand-landed record is at the SHOWN seed now, and the shown seed
 * is drawn fresh unless the address named one. The old law's own gate
 * (test/precompose.test.js G6g) is untouched and still true — reading 1 still
 * composes what `cellOf` composes with no reading at all; what moved is which
 * reading a boot lands on.
 *
 * S1  a fragment-less boot shows a reading that is not 1, and writes NO
 *     address — a reload of a box nobody has touched is a new session, which
 *     it could not be while the boot wrote `s=` on every load
 * S2  `#s=7` alone is honoured, with no place beside it
 * S3  the flyout's number field writes THROUGH the atlas: the reading moves,
 *     the record is composed again, and the digit on the die follows
 * S4  0 and 1 compose the same record — precompose's "the idiom as written" —
 *     and the panel says so on itself rather than in a comment
 * S5  roll changes the number; next is +1
 *
 * RUN:  NODE_PATH=/home/ford/ftrain-2025/node_modules node test/seed.js
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
  const errs = [];
  const open = async (frag) => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
    p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
    await p.goto(BASE + (frag || ""), { waitUntil: "load" });
    await p.waitForTimeout(2600);
    return p;
  };
  const reading = (p) => p.evaluate(() =>
    (document.getElementById("reading") || {}).textContent);

  /* ---- S1 A FRESH BOX DRAWS, AND WRITES NOTHING ---------------------- */
  /* TWO CLAIMS AND THEY ARE ONE FEATURE. The draw is 1..65535 (never 0 and
     never the top: precompose returns null from both of its seed-gated blocks
     at `seed <= 1`, so 0 and 1 are the same record and drawing either would
     mean "a new session" sometimes meant "the written idiom"). And the boot
     writes NO address — because a URL written at boot is a URL the next reload
     obeys, and then no session is new. test/atlas.js has documented that exact
     failure since `fresh()` was written; the box does not need clearing now.
     TWO SEPARATE BOOTS, because "random" is a claim about two draws and one
     draw is a number. */
  const p1 = await open("");
  const p2 = await open("");
  const r1 = await reading(p1), r2 = await reading(p2);
  const h1 = await p1.evaluate(() => location.hash);
  check(r1 !== "1" && r2 !== "1" && +r1 >= 1 && +r1 <= 65535,
    "S1 · a fragment-less boot draws a reading of its own, not 1 — " +
    JSON.stringify([r1, r2]));
  check(r1 !== r2,
    "S1 · …and two boots draw two different ones (" + r1 + " vs " + r2 + ")");
  check(h1 === "",
    "S1 · …and the boot writes NO address, so a reload is a new session — " +
    JSON.stringify(h1));
  /* AND A HAND WRITES ONE. The other half of the same rule: the address is
     still worth copying the moment somebody has moved something (`markLink`
     is guarded by `booted`, not deleted). */
  await p1.evaluate(() => window.__eightTab("Motif"));
  /* AND THE ADDRESS IS WAITED FOR, NOT SLEPT THROUGH (2026-09-02). This was
     `waitForTimeout(600)` and it went red in the full suite while passing
     alone: the write is DEBOUNCED (`markLink` arms a 250 ms timer and every
     further `markLink` re-arms it — ui/eight.js LINKMS), so 600 ms is a bet
     about how long the Motif panel's own draw takes to stop moving, and eight
     browser gates sharing a machine lose that bet. Measured on an idle box the
     hash was written well inside 1.2 s; measured in the suite it was not
     written at 600 ms and the check read `""` off a page that was about to be
     right. A poll is the honest shape for a debounced write: what is asserted
     is that the gesture writes an address, never how many milliseconds the
     debounce takes. */
  const h1b = await p1.waitForFunction(
    () => (/t=motif/.test(location.hash) ? location.hash : false),
    null, { timeout: 8000, polling: 100 })
    .then((h) => h.jsonValue())
    .catch(() => p1.evaluate(() => location.hash));
  check(/t=motif/.test(h1b),
    "S1 · …but the first gesture writes one: " + JSON.stringify(h1b));
  await p2.close();

  /* ---- S2 `s=` ALONE IS HONOURED ------------------------------------ */
  /* `#s=7` WITH NO PLACE. The boot's own precedence line gated the whole link
     on `LINK.at` — "a URL with `s` but no place is ignored" — which was right
     while the seed only mattered at a place; with a drawn boot seed it means
     "you may not ask for a reading unless you also ask for a record", and Paul
     asked for the opposite: *"unless there's a seed in the URL"*. */
  const p3 = await open("#s=7");
  check((await reading(p3)) === "7",
    "S2 · `#s=7` alone is honoured, with no place beside it — reading " +
    (await reading(p3)));
  /* …AND A PLACE PLUS A SEED STILL LANDS BOTH. The case that already worked
     must go on working: this is the link a reader shares. */
  const p4 = await open("#at=Kingston&y=1969&s=1");
  const landed = await p4.evaluate(() => ({
    reading: document.getElementById("reading").textContent,
    basis: window.__eightDoc().basis, title: document.title }));
  check(landed.reading === "1" && landed.basis === "reggae",
    "S2 · …and a place with a seed still lands both — " + JSON.stringify(landed));
  await p3.close();

  /* ---- S3 THE FLYOUT WRITES THROUGH THE ATLAS ----------------------- */
  /* ONE OWNER FOR THE SEED (ui/atlas.js, 2026-08-27: "a second store in
     ui/eight.js would be a second answer to the same question"). The flyout has
     no number of its own: it calls `ATLAS.setReading(n, done)` and reads the
     answer back off `#reading`, which `printReading` is still the only writer
     of. So the proof is that a typed number moves BOTH the readout and the
     RECORD — a control that moved the digit and not the document would be the
     "declared but never arriving" bug in its purest form. */
  await p4.evaluate(() => document.getElementById("rewrite").click());
  await p4.waitForTimeout(300);
  const flyout = await p4.evaluate(() => {
    const box = document.getElementById("nu-seedout");
    return { open: !!(box && !box.hidden),
             num: (document.querySelector('[data-k="seed-num"]') || {}).value,
             max: (document.querySelector('[data-k="seed-num"]') || {}).max,
             slide: !!document.querySelector('[data-k="seed-slide"]'),
             slideMax: (document.querySelector('[data-k="seed-slide"]') || {}).max,
             why: (box && box.querySelector(".nu-why") || {}).textContent };
  });
  check(flyout.open && flyout.num === "1" && flyout.max === "65536" &&
        flyout.slide && flyout.slideMax === "65536",
    "S3 · the die opens a flyout over 0..2^16 showing the reading — " +
    JSON.stringify(flyout));
  const docWas = await p4.evaluate(() => JSON.stringify(window.__eightDoc()));
  await p4.evaluate(() => { const n = document.querySelector('[data-k="seed-num"]');
    n.value = "4242"; n.dispatchEvent(new Event("change", { bubbles: true })); });
  await p4.waitForTimeout(1500);
  const wrote = await p4.evaluate(() => ({
    reading: document.getElementById("reading").textContent,
    doc: JSON.stringify(window.__eightDoc()),
    basis: window.__eightDoc().basis }));
  const want4242 = await p4.evaluate(() =>
    JSON.stringify(window.NuPrecompose.genreToDocument("reggae", 4242)));
  check(wrote.reading === "4242" && wrote.doc !== docWas &&
        wrote.doc === want4242,
    "S3 · a typed number writes through the atlas and RECOMPOSES: reading " +
    wrote.reading + ", and the page holds exactly " +
    "genreToDocument(\"reggae\", 4242) (" + (wrote.doc === want4242) + ")");

  /* ---- S4 0 AND 1 ARE ONE RECORD, AND THE PANEL SAYS SO ------------- */
  /* precompose.js's two seed-gated blocks return null at `seed <= 1`, so the
     domain Paul asked for has two positions that sound identical. That is a
     fact about the composer and not a defect, and this page's own law is that
     such a fact lives ON the artifact — so the flyout carries the sentence
     under its slider and this reads it back off the rendered page. */
  const zeroOne = await p4.evaluate(() => {
    const a = JSON.stringify(window.NuPrecompose.genreToDocument("reggae", 0));
    const b2 = JSON.stringify(window.NuPrecompose.genreToDocument("reggae", 1));
    return { same: a === b2,
             why: (document.querySelector("#nu-seedout .nu-why") || {}).textContent };
  });
  check(zeroOne.same && /0 and 1/.test(zeroOne.why || ""),
    "S4 · 0 and 1 compose the same record — the idiom as written — and the " +
    "panel says so on itself: " + JSON.stringify(zeroOne.why));

  /* ---- S5 ROLL AND NEXT --------------------------------------------- */
  /* `roll` is `rewriteNow`, which is still the ONE reseed path in this box
     (2026-08-27: "a second ATLAS.reseed written for the clock would be the
     two-owner drift every note in this file argues against"), and it now
     throws rather than counting — a seed is a position in a domain, and
     `seed++` had no ceiling and no wrap. `next` is the +1 a hand wants when it
     is auditioning neighbours. */
  /* ...AND ROLL SHUTS THE STRIP, 2026-09-02. Paul, after using the page:
     *"When I 'roll' with the seed modal dismiss it."* So this walk is three
     assertions instead of two: the reading moved, the strip is GONE, and the
     die's own `aria-expanded` says so. `next` then has to re-open it, which is
     the reader's gesture too — and is the proof that the closing is `roll`'s
     alone and not something every button in the strip does. */
  const before5 = await reading(p4);
  await p4.evaluate(() => document.querySelector('[data-k="seed-roll"]').click());
  await p4.waitForTimeout(1500);
  const rolled = await reading(p4);
  check(rolled !== before5 && +rolled >= 0 && +rolled <= 65536,
    "S5 · roll throws a new reading inside the domain: " + before5 + " -> " + rolled);
  const shut = await p4.evaluate(() => ({
    hidden: document.getElementById("nu-seedout").hidden,
    exp: document.getElementById("rewrite").getAttribute("aria-expanded") }));
  check(shut.hidden === true && shut.exp === "false",
    "S5 · …and the strip is dismissed behind it, with the die's own door " +
    "shut too: " + JSON.stringify(shut));
  await p4.evaluate(() => document.getElementById("rewrite").click());
  await p4.waitForTimeout(250);
  const back = await p4.evaluate(() =>
    document.getElementById("nu-seedout").hidden === false);
  check(back, "S5 · …and the die opens it again — the dismissal is roll's " +
    "alone, not the strip giving up");
  await p4.evaluate(() => document.querySelector('[data-k="seed-next"]').click());
  await p4.waitForTimeout(1500);
  const nexted = await reading(p4);
  const still = await p4.evaluate(() =>
    document.getElementById("nu-seedout").hidden === false);
  check(+nexted === +rolled + 1,
    "S5 · …and next is the one after it: " + rolled + " -> " + nexted);
  check(still, "S5 · …with the strip STILL OPEN under it — `next` is aiming " +
    "and aiming needs the panel; only `roll` is finished when it lands");

  check(!errs.length, "S· zero pageerrors / console errors " +
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
