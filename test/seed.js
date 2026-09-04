/* ===== THE SEED — a die and a number (2026-09-02, rewritten 2026-09-03) ==
 *
 * Paul, the composer round: *"Boot up every new session with a new seed unless
 * there's a seed in the URL. When I click seed pop up a vertical slider from
 * zero to 2^16."*
 *
 * ...AND THE FLYOUT IS GONE, 2026-09-03. Paul, after using it: *"Instead of a
 * popup for seed, just get rid of the word seed and put the number. I tap the
 * die and there's a new number. I tap the number and I can enter a new number
 * by hand. Instead of stopping the music compose the new song then show a
 * countdown until the new version plays."* So S3 is the NUMBER FIELD where it
 * was the flyout's field, S5 is the DIE where it was `roll`/`next` inside the
 * panel (and asserts the panel is gone, with nothing it offered lost), and
 * S6's six spellings are four — the fader and `next` were deleted with the
 * strip, and ui/eight.js accounts for where each went. S7 and S8 are the new
 * law: a seed change while the record is PLAYING evolves it instead of
 * stopping it, and says how many beats away the new version is.
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
 * S3  THE NUMBER, TYPED BY HAND, writes THROUGH the atlas: tapping the digit
 *     turns it into a numeric field, Enter commits, the reading moves, the
 *     record is composed again, and Escape abandons without writing anything
 * S4  0 and 1 compose the same record — precompose's "the idiom as written" —
 *     and the page says so ON the number rather than in a comment
 * S5  THE DIE rolls a new number in one press, and the flyout is GONE: no
 *     panel, no slider, no `roll`, no `next`, and no `aria-expanded` on a
 *     control that opens nothing
 * S6  A SEED CHANGE STARTS PLAYING (2026-09-03, Paul: *"When I change the seed
 *     start playing."*) — every spelling of the gesture the box still has, on
 *     a DEFAULT-autoplay browser: the typed number as the first interaction on
 *     a fresh page, the die, and a tap on the mark the record is on; the
 *     context is proved resumed at `__nuEngine().rms`; and a reload is silent,
 *     so nothing autoplays on load or on a restored session
 * S7  …AND A SEED CHANGE WHILE IT PLAYS DOES NOT STOP IT (2026-09-03, Paul:
 *     *"Instead of stopping the music compose the new song then show a
 *     countdown until the new version plays."*) — zero `transport:state`
 *     events across the die press, the walk's bar serial monotone, the engine
 *     still sounding, a countdown that ticks DOWN on the beat feed beside the
 *     number and clears when it lands, and the record on the page is
 *     `genreToDocument(basis, the new reading)` afterwards
 * S8  the same, hand-typed: the field commits a number while the record plays
 *     and the transport never hears about it
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
  /* THE GESTURE WAS `__eightTab("Motifs")` UNTIL 2026-09-08 (TABLE.md §10b
     step 4). Any tab switch is the gesture this check needs — what is asserted
     is that MOVING SOMETHING writes an address, never which thing was moved —
     and the Motifs tab is deleted with its pane: the bank is a merged row of
     the Band table now, so `__eightTab("Motifs")` is a no-op on a word that is
     not in `TABS` and the hash would stay empty for the honest reason that
     nothing happened. `Score` is a tab this box still has; `linkFrag` writes
     `t=score/<view>` for it through the same debounced `markLink`. */
  await p1.evaluate(() => window.__eightTab("Score"));
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
     debounce takes. (`t=motif` was the word until 2026-09-08 — see the note at
     the gesture above.) */
  const h1b = await p1.waitForFunction(
    () => (/t=score/.test(location.hash) ? location.hash : false),
    null, { timeout: 8000, polling: 100 })
    .then((h) => h.jsonValue())
    .catch(() => p1.evaluate(() => location.hash));
  check(/t=score/.test(h1b),
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

  /* ---- S3 THE NUMBER, TYPED, WRITES THROUGH THE ATLAS ---------------- */
  /* ONE OWNER FOR THE SEED (ui/atlas.js, 2026-08-27: "a second store in
     ui/eight.js would be a second answer to the same question"). The field has
     no number of its own: it calls `ATLAS.setReading(n, done)` and reads the
     answer back off `#reading`, which `printReading` is still the only writer
     of. So the proof is that a typed number moves BOTH the readout and the
     RECORD — a control that moved the digit and not the document would be the
     "declared but never arriving" bug in its purest form.
     AND IT IS TYPED, NOT FILLED. Paul, 2026-09-03: *"I tap the number and I
     can enter a new number by hand."* — two gestures, in order: the digit is
     PRESSED (at its own rect, never `page.click`) and becomes a field, then
     the number is typed into it and committed with Enter. A gate that set
     `.value` and dispatched `change` would pass on a page where the digit was
     not pressable at all, which is the whole of what this round changed.
     (`document.getElementById("rewrite").click()` STOOD HERE and was the old
     panel being opened before its field could be typed in. There is no panel;
     the line is not replaced by anything, because the digit is on the page at
     every moment now — which is the point of the round.) */
  const numRect = async (id) => p4.evaluate((k) => {
    const n = document.getElementById(k);
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2,
             w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; }, id);
  const at3 = await numRect("seedval");
  await p4.mouse.click(at3.x, at3.y);
  await p4.waitForTimeout(200);
  const field = await p4.evaluate(() => {
    const i = document.getElementById("seedin"), v = document.getElementById("seedval");
    return { there: !!i, shown: i && !i.hidden, hid: v && v.hidden,
             mode: i && i.getAttribute("inputmode"),
             pat: i && i.getAttribute("pattern"),
             say: i && i.getAttribute("aria-label"),
             focused: document.activeElement === i,
             value: i && i.value,
             h: i ? +i.getBoundingClientRect().height.toFixed(1) : 0 };
  });
  check(field.shown && field.hid && field.mode === "numeric" &&
        field.focused && field.h >= 44,
    "S3 · a press on the number turns it into a numeric field, focused, at " +
    "the tap floor — " + JSON.stringify(field));
  const docWas = await p4.evaluate(() => JSON.stringify(window.__eightDoc()));
  await p4.keyboard.type("4242");
  await p4.keyboard.press("Enter");
  await p4.waitForTimeout(1500);
  const wrote = await p4.evaluate(() => ({
    reading: document.getElementById("reading").textContent,
    doc: JSON.stringify(window.__eightDoc()),
    back: document.getElementById("seedin").hidden &&
          !document.getElementById("seedval").hidden,
    basis: window.__eightDoc().basis }));
  const want4242 = await p4.evaluate(() =>
    JSON.stringify(window.NuPrecompose.genreToDocument("reggae", 4242)));
  check(wrote.reading === "4242" && wrote.doc !== docWas &&
        wrote.doc === want4242,
    "S3 · a typed number writes through the atlas and RECOMPOSES: reading " +
    wrote.reading + ", and the page holds exactly " +
    "genreToDocument(\"reggae\", 4242) (" + (wrote.doc === want4242) + ")");
  check(wrote.back,
    "S3 · …and the number comes back where the field was, so the row does " +
    "not move under the thumb that typed in it");
  /* AND ESCAPE ABANDONS. A field that committed whatever was in it when you
     backed out would be a control that writes a record you did not ask for —
     and the number is the one control on this page whose only readout is the
     RECORD, so an accidental write is a song you cannot get back by undoing. */
  await p4.mouse.click(at3.x, at3.y);
  await p4.waitForTimeout(150);
  await p4.keyboard.type("999");
  await p4.keyboard.press("Escape");
  await p4.waitForTimeout(600);
  const esc = await p4.evaluate(() => ({
    reading: document.getElementById("reading").textContent,
    hidden: document.getElementById("seedin").hidden }));
  check(esc.reading === "4242" && esc.hidden,
    "S3 · …and Escape abandons the edit without writing a record — still " +
    "reading " + esc.reading);

  /* ---- S4 0 AND 1 ARE ONE RECORD, AND THE PAGE SAYS SO -------------- */
  /* precompose.js's two seed-gated blocks return null at `seed <= 1`, so the
     domain Paul asked for has two positions that sound identical. That is a
     fact about the composer and not a defect, and this page's own law is that
     such a fact lives ON the artifact — so it is the number's own explainer
     (`data-say`, the hold-and-hover ui/glyph.js `wireSay` gives every mark in
     the gutter) now that the panel that carried the sentence is gone, and
     this reads it back off the rendered control. */
  const zeroOne = await p4.evaluate(() => {
    const a = JSON.stringify(window.NuPrecompose.genreToDocument("reggae", 0));
    const b2 = JSON.stringify(window.NuPrecompose.genreToDocument("reggae", 1));
    return { same: a === b2,
             why: (document.getElementById("seedval") || {}).dataset.say };
  });
  check(zeroOne.same && /0 and 1/.test(zeroOne.why || ""),
    "S4 · 0 and 1 compose the same record — the idiom as written — and the " +
    "number says so on itself: " + JSON.stringify(zeroOne.why));

  /* ---- S5 THE DIE, AND THE PANEL THAT IS GONE ----------------------- */
  /* Paul, 2026-09-03: *"I tap the die and there's a new number."* It was
     `rewriteNow` until 2026-09-02, then two presses (the die opened a flyout
     and `roll` inside it rolled); it is one press again, and `rewriteNow` is
     still the ONE reseed path this box has — the same function `album` takes
     at the end of a record — so nothing about the throw itself changed.
     IT ROLLS RATHER THAN COUNTS, and never lands on the face it is already on
     (ui/atlas.js `reseed`): a seed is a POSITION in a domain, and `seed++` had
     no ceiling and no wrap.
     AND THE PANEL IS ASSERTED ABSENT, not merely unused. A flyout still in the
     DOM would be a second way to say the same number — the two-owner drift
     every note in ui/eight.js argues against — and `aria-expanded` left on a
     control that opens nothing is a lie a screen reader is told. */
  const before5 = await reading(p4);
  const at5 = await numRect("rewrite");
  await p4.mouse.click(at5.x, at5.y);
  await p4.waitForTimeout(1500);
  const rolled = await reading(p4);
  check(rolled !== before5 && +rolled >= 0 && +rolled <= 65536,
    "S5 · one press of the die throws a new reading inside the domain: " +
    before5 + " -> " + rolled);
  const gone = await p4.evaluate(() => ({
    panel: !!document.getElementById("nu-seedout"),
    slide: !!document.querySelector('[data-k="seed-slide"]'),
    roll: !!document.querySelector('[data-k="seed-roll"]'),
    next: !!document.querySelector('[data-k="seed-next"]'),
    num: !!document.querySelector('[data-k="seed-num"]'),
    exp: document.getElementById("rewrite").getAttribute("aria-expanded"),
    name: document.getElementById("rewrite").getAttribute("aria-label"),
    /* THE WORD IS IN THE DOM AND NOT ON THE FACE, which is two claims and
       neither of them is "it was deleted": the span still says "seed" (the
       page reads as itself with the stylesheet off — test/shell.js A6g/A6h)
       and it is `.nu-vh`'s original visually-hidden recipe again, so an eye
       sees the NUMBER where the word was. 2px is the recipe's own 1px box
       plus a rounding hair. */
    word: (() => { const v = document.querySelector("#rewrite .nu-vh");
      if (!v) return "deleted";
      const r = v.getBoundingClientRect();
      return { says: v.textContent.trim(), seen: r.width > 2 || r.height > 2 };
    })(),
    /* THE ROW IS IN THE BAR SINCE 2026-09-09 (TABLE.md §10b step 6). It was
       `.nu-trayfoot .nu-seedrow`, the gutter's foot; the gutter is deleted and
       the die, the number, the field and the two countdowns are the middle of
       `#nu-bar`. Not one id moved. */
    row: !!document.querySelector("#nu-bar .nu-seedrow #reading") }));
  check(!gone.panel && !gone.slide && !gone.roll && !gone.next && !gone.num &&
        gone.exp === null,
    "S5 · …and the flyout is GONE — no panel, no slider, no roll, no next, " +
    "no field of its own, and no aria-expanded on the die: " +
    JSON.stringify(gone));
  check(gone.name === "rewrite " + rolled && gone.word &&
        gone.word.says === "seed" && gone.word.seen === false && gone.row,
    "S5 · …the die keeps its accessible name, its word leaves the FACE " +
    "without leaving the DOM (Paul: \"get rid of the word seed and put the " +
    "number\"), and the number stands beside it in the foot: " +
    JSON.stringify([gone.name, gone.word]));
  /* ---- S6 A SEED CHANGE STARTS PLAYING (2026-09-03) ------------------ */
  /* Paul: *"When I change the seed start playing."*
   *
   * WHAT WAS WRONG, AND IT IS THIS BOX'S CHARACTERISTIC BUG. `writeSeed` read
   * the transport to decide whether the gesture had an effect (`wasPlaying ?
   * startNow : null`), so on a stopped box the flyout's controls moved the
   * digit, composed a whole new record, and made no sound: DECLARED BUT NEVER
   * ARRIVING, with a condition for a hat. The fix is one argument at ONE
   * landing (ui/eight.js `startIfDown`, handed as the `done` every seed door
   * gives the atlas), which is why the checks below drive every spelling the
   * box has and assert the same fact — a per-caller autoplay would pass two of
   * them and fail the third.
   *
   * THREE SPELLINGS, NOT FIVE, AND THAT IS THE ROUND AND NOT A RETREAT. The
   * fader and `next` were deleted with the flyout on 2026-09-03 (Paul: *"just
   * get rid of the word seed and put the number"*); ui/eight.js's own note
   * accounts for where each of them went, and S5 above asserts they are not
   * still on the page under another name.
   *
   * A SECOND BROWSER, WITH THE AUTOPLAY POLICY LEFT ALONE. The browser above
   * is launched with `--autoplay-policy=no-user-gesture-required`, which is
   * right for S1..S5 (they are about numbers) and would make S6 a test of a
   * command-line flag. This one takes Chromium's DEFAULT policy, so "the seed
   * change is a user gesture and the AudioContext therefore resumes" is a
   * claim the gate actually measures — at `__nuEngine().rms`, which is the
   * ring engine's own output and not a promise about it.
   *
   * EVERY GESTURE IS A HAND. The die and the number are clicked at their own
   * RECTS (page.click scrolls its target into view and has faked bug reports
   * on this box); the number is TYPED and committed with Enter; the mark is a
   * pointer at the globe's own dot.
   *
   *   S6a  a fresh boot is SILENT — nothing autoplays on load
   *   S6b  the FIRST interaction on the page is a seed change: the record
   *        plays, the reading is the typed one, and rms > 0 (the context did
   *        resume under the default policy)
   *   S6c  the die, from a stopped box
   *   S6d  a tap on the mark the record is already on (which rolls the seed)
   *   S7   …and while it PLAYS, the die evolves instead of restarting
   *   S8   …and so does the typed number
   *   S6g  and a RELOAD does not autoplay — a restored session is silent
   */
  const b6 = await chromium.launch({ executablePath: EXE });   // DEFAULT policy
  const errs6 = [];
  const p6 = await b6.newPage({ viewport: { width: 390, height: 844 } });
  p6.on("pageerror", (e) => errs6.push("pageerror: " + e.message));
  p6.on("console", (m) => { if (m.type() === "error") errs6.push("console: " + m.text()); });
  await p6.goto(BASE + "#at=Kingston&y=1969&s=1", { waitUntil: "load" });
  await p6.waitForTimeout(2600);

  const bounce = () => p6.evaluate(() => window.__nuBounce());
  const read6 = () => p6.evaluate(() =>
    (document.getElementById("reading") || {}).textContent);
  /* A START IS SLOW AND THE GATE SAYS SO RATHER THAN GUESSING. From a stopped
     box `reseed` lands a whole new record — `CTX.setDocument`, `stop()`, then
     `startNow` — so the next song pays the ordinary cost of an open, and
     ui/eight.js's own note measures that at about five seconds (audio/live.js
     buys zero dropouts with an eight-second prefill). "Within a bar" is
     therefore a claim about the GESTURE being taken, not about the first
     sample; the poll waits for the transport and reports how long it took. */
  const waitPlaying = async (ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const b2 = await bounce();
      if (b2.playing) return Date.now() - t0;
      await p6.waitForTimeout(250);
    }
    return -1;
  };
  /* PUT IT DOWN AGAIN BETWEEN THE CHECKS, through #play's own word — the mark
     says the NEXT tap, so "stop" means it is playing (test/gutter.js `quiet`,
     the same hand for the same reason: a start left in flight is the state
     every check after it would inherit). */
  const quiet6 = async () => {
    for (let i = 0; i < 60; i++) {
      const s = await bounce();
      if (s.playing || s.state !== "starting") break;
      await p6.waitForTimeout(500);
    }
    await p6.evaluate(() => { const b2 = document.getElementById("play");
      if ((b2.getAttribute("aria-label") || "").trim() === "stop") b2.click(); });
    for (let i = 0; i < 40; i++) {
      if (!(await bounce()).playing) break;
      await p6.waitForTimeout(250);
    }
    return (await bounce()).playing;
  };
  /* A CONTROL, PRESSED AT ITS OWN RECT — never `page.click`, which scrolls its
     target into view first (memory: nukernel-deploy-and-probe, four ways the
     harness lies). */
  const tap6 = async (id) => {
    const at = await p6.evaluate((k) => {
      const n = document.getElementById(k);
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, id);
    if (!at) return false;
    await p6.mouse.click(at.x, at.y);
    await p6.waitForTimeout(250);
    return true;
  };

  const boot6 = await bounce();
  await p6.waitForTimeout(1200);
  const boot6b = await bounce();
  check(!boot6.playing && !boot6b.playing,
    "S6a · a fresh boot is silent — nothing autoplays on load " +
    JSON.stringify({ playing: boot6b.playing, state: boot6b.state }));

  /* S6b — THE FIRST INTERACTION ON THE PAGE IS A SEED CHANGE. */
  const opened = await tap6("seedval");
  await p6.keyboard.type("4242");
  await p6.keyboard.press("Enter");
  const tB = await waitPlaying(30000);
  const rB = await read6();
  /* AND THE SOUND IS MEASURED, NOT ASSUMED — `__nuEngine().rms` is the ring's
     own output, which is zero if the AudioContext never resumed. */
  let rms = 0;
  for (let i = 0; i < 40 && !rms; i++) {
    rms = await p6.evaluate(() => window.__nuEngine().rms || 0);
    if (!rms) await p6.waitForTimeout(300);
  }
  check(opened && tB >= 0 && rB === "4242",
    "S6b · a typed seed, the first interaction on a fresh page, STARTS the " +
    "record: reading " + rB + ", playing after " + tB + " ms");
  check(rms > 0,
    "S6b · …and the AudioContext resumed on the gesture under the DEFAULT " +
    "autoplay policy — engine rms " + rms.toFixed(5));

  /* S6c — THE DIE, from a stopped box. It has gone through `startNow` since
     it landed; it is held here so a later edit cannot quietly take it back. */
  check(!(await quiet6()), "S6c · …and #play puts it down again");
  const wasC = await read6();
  await tap6("rewrite");
  const tC = await waitPlaying(30000);
  const rC = await read6();
  check(tC >= 0 && rC !== wasC,
    "S6c · one press of the die STARTS the record: " + wasC + " -> " +
    rC + ", playing after " + tC + " ms");

  /* S6d — A TAP ON THE MARK THE RECORD IS ALREADY ON, which is the box's
     other way to move a seed (ui/atlas.js `choose`: "tapping the mark you are
     already on bumps the seed"). It reaches the transport through `ctx.play`,
     which IS `startNow` — the same door, from the other file. */
  check(!(await quiet6()), "S6d · …and #play puts it down again");
  await p6.evaluate(() => { window.__eightTab("Where"); });
  await p6.waitForTimeout(900);
  const wasF = await read6();
  const atF = await p6.evaluate(() => {
    const g = document.querySelector('#atlasMap .place[data-place="Kingston"]');
    if (!g) return null;
    const r = g.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (atF) await p6.mouse.click(atF.x, atF.y);
  const tF = atF ? await waitPlaying(30000) : -1;
  const rF = await read6();
  check(!!atF && tF >= 0 && rF !== wasF,
    "S6d · a tap on the mark it is already on rolls the seed AND starts it: " +
    wasF + " -> " + rF + ", playing after " + tF + " ms");

  /* ---- S7 A SEED CHANGE WHILE IT PLAYS EVOLVES IT (2026-09-03) ------- */
  /* Paul: *"Instead of stopping the music compose the new song then show a
     countdown until the new version plays."*
   *
   * WHAT THIS MEASURED BEFORE THE FIX, on this page and this record: the die
   * called `ATLAS.reseed(DOC.basis, startNow)`, the atlas composed and handed
   * the record to `CTX.setDocument`, whose first word is `stop()` — so the
   * music stopped, the engine paid its whole eight-second ring prefill again,
   * and the new song began at bar 0 several seconds later. That is the same
   * bug ui/rules.js was measured for the same day (test/rules-view.browser.js
   * R11: two `transport:state` events, the position feed's serial back to 0),
   * and it takes the same door out: `CTX.evolve`, the swap that leaves the
   * transport alone and lets audio/live.js's next-bar landing carry it.
   *
   * FIVE CLAIMS, ASKED OF THE RUNNING PAGE AND NOT OF A FIELD:
   *   the transport never stops   `transport:state` is silent across the press
   *   the walk keeps counting     the `pos` feed's serial is MONOTONE (the
   *                               restart took it back to 0 before the fix)
   *   the engine keeps sounding   `__nuEngine().rms` is above zero through it
   *   the countdown is drawn      `.nu-seedwait` fills, ticks DOWN on the beat
   *                               feed (never up), and CLEARS when it lands
   *   the new record arrives      the page then holds exactly
   *                               `genreToDocument(basis, the new reading)`
   * THE FEED IS THE PAGE'S OWN: importing ui/state.js by the same URL the page
   * loaded hands back the same instance and the same bus the transport
   * publishes on — no probe added to the shipped source for a gate. */
  check(!(await quiet6()), "S7 · …and #play puts it down again");
  await p6.evaluate(() => { window.__eightTab("Where"); });
  await p6.waitForTimeout(400);
  await p6.evaluate(async () => {
    const S = await import("./ui/state.js");
    window.__posLog = []; window.__stateLog = [];
    S.on("pos", (d) => window.__posLog.push(d.serial));
    S.on("transport:state", (d) => window.__stateLog.push(d.playing));
  });
  await tap6("play");
  let bars = -1;
  for (const t0 = Date.now(); Date.now() - t0 < 60000;) {
    if ((await p6.evaluate(() => window.__posLog.length)) >= 3) {
      bars = Date.now() - t0; break; }
    await p6.waitForTimeout(400);
  }
  check(bars >= 0, "S7 · the record plays and the walk is announcing bars — " +
    bars + " ms to the third bar");
  const live7 = () => p6.evaluate(() => ({
    playing: window.__nuBounce().playing, rms: window.__nuEngine().rms,
    pos: window.__posLog.slice(), st: window.__stateLog.slice(),
    seed: (document.getElementById("reading") || {}).textContent,
    wait: (document.querySelector(".nu-seedwait") || {}).textContent,
    doc: JSON.stringify(window.__eightDoc()) }));
  /* THE WALK KEPT GOING FORWARD, WHICH IS WHAT "the position is kept" MEANS
     WHEN THE RECORD'S OWN LENGTH CHANGES. test/rules-view.browser.js R11d
     asserts a strictly monotone serial and is right to: a bpm rule keeps the
     plan's shape, so nothing can re-base it. A SEED change swaps the record
     for one with different sections and different bars, and audio/live.js's
     crossfade path prunes queued bars and jumps serials on the way in ("a
     change can sound EARLIER than the serial rule predicted" — its own note at
     the onBar clamp): measured here, the serial usually steps forward over a
     gap and was once seen to step back by one at the landing. Neither is the
     restart this gate is for — that was serial 0 with two `transport:state`
     events beside it, which S7a and S7f already forbid — so the claim is that
     the counter ENDS PAST where it was when the die was pressed, with the tail
     printed for a reader. */
  const wentOn = (a2, b2) => b2.pos.length > a2.pos.length &&
    b2.pos[b2.pos.length - 1] > a2.pos[a2.pos.length - 1];
  /* THE COUNTDOWN IS WATCHED, NOT SAMPLED ONCE. It is drawn from the `pending`
     feed, which emits only when the number CHANGES, so the honest instrument
     is a poll across the whole runway (measured at 12 beats, 5.1 to 8.2 s on
     every record in the catalogue) collecting what the element said. */
  /* ...AND "COUNTS DOWN" IS AN ARC, NOT A STAIRCASE, AND THAT IS MEASURED.
     This asserted strict monotonicity and went red twice on the rendered page
     with sequences like [14, 11, 10, 12, 11, 8, 7, 6, 8, 7] — a real wobble
     with a real cause, and not one to fix in the UI. audio/live.js `tickPos`
     computes the beats left as "the rest of this bar plus every whole bar
     between here and the landing", and it reads those bar lengths off the
     CURRENT timeline; a seed change swaps a record for one with different
     sections and different bar counts, so the same fixed landing serial is
     re-measured against new bars and the sum can step UP by a beat or two.
     live.js says so itself ("the in-flight bars were fed at the OLD lengths…
     the onBar landing clamp is the truth") and refuses only the +1 blip.
     So the claim is the one a reader actually has: the wait APPEARS, it is a
     plausible number of beats, it ENDS LOWER than it started, and it CLEARS
     when the record lands. A gate that demanded a perfect staircase would be
     asserting that the box knows the length of bars it has not written yet. */
  const watchWait = async (ms) => {
    const seen = [], t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const w = await p6.evaluate(() => {
        const n = document.querySelector(".nu-seedwait");
        const b2 = n && n.querySelector("b");
        return { txt: n ? n.textContent : null, n: b2 ? +b2.textContent : null,
                 shown: !!(n && n.getClientRects().length) }; });
      if (!seen.length || seen[seen.length - 1].n !== w.n) seen.push(w);
      if (seen.length > 1 && w.n == null) break;
      await p6.waitForTimeout(200);
    }
    return seen;
  };
  const L7a = await live7();
  await tap6("rewrite");
  const wait7 = await watchWait(30000);
  await p6.waitForTimeout(1200);
  const L7b = await live7();
  const nums7 = wait7.map((w) => w.n).filter((n) => n != null);
  const want7 = await p6.evaluate((s) => JSON.stringify(
    window.NuPrecompose.genreToDocument(window.__eightDoc().basis, +s)),
    L7b.seed);
  check(L7b.playing && L7b.st.length === L7a.st.length,
    "S7a · the die EVOLVES the record while it plays: the transport never " +
    "stopped — " + (L7b.st.length - L7a.st.length) + " transport:state " +
    "events across the press (it was two, false then true, before 2026-09-03)");
  check(wentOn(L7a, L7b),
    "S7b · …with the walk still counting FORWARD across the swap — " +
    (L7b.pos.length - L7a.pos.length) + " new bars, serial " +
    L7a.pos[L7a.pos.length - 1] + " -> " + L7b.pos[L7b.pos.length - 1] +
    ", tail " + JSON.stringify(L7b.pos.slice(-6)) +
    " (the restart took it back to 0)");
  check(L7b.seed !== L7a.seed,
    "S7c · …and the reading moved on the press: " + L7a.seed + " -> " + L7b.seed);
  check(nums7.length >= 2 && nums7[nums7.length - 1] < nums7[0] &&
        nums7.every((n) => n > 0 && n < 400) &&
        wait7[wait7.length - 1].n == null,
    "S7d · …and a countdown stands beside the number, counts DOWN on the " +
    "walk's own beats and CLEARS when it lands: " + JSON.stringify(nums7));
  check(L7b.doc === want7,
    "S7e · …and the record on the page is genreToDocument(basis, " +
    L7b.seed + ") — the new song, landed (" + (L7b.doc === want7) + ")");
  check(L7b.rms > 0,
    "S7f · …and the engine is still making sound through all of it — rms " +
    (L7b.rms || 0).toFixed(5));

  /* ---- S8 THE HAND-ENTERED NUMBER, WHILE IT PLAYS -------------------- */
  /* Paul, in the same sentence: *"I tap the number and I can enter a new
     number by hand."* The die and the field are two gestures on one subject
     and they land through ONE door (`armSeed` -> the atlas -> `CTX.evolve`),
     so this is not a second copy of S7: it is the check that would have gone
     red if the evolve had been wired at the die's listener instead of at the
     landing every seed change shares. */
  const L8a = await live7();
  await tap6("seedval");
  await p6.keyboard.type("777");
  await p6.keyboard.press("Enter");
  const wait8 = await watchWait(30000);
  await p6.waitForTimeout(1200);
  const L8b = await live7();
  const nums8 = wait8.map((w) => w.n).filter((n) => n != null);
  const want8 = await p6.evaluate(() => JSON.stringify(
    window.NuPrecompose.genreToDocument(window.__eightDoc().basis, 777)));
  check(L8b.playing && L8b.st.length === L8a.st.length && L8b.seed === "777",
    "S8a · a number typed by hand while it plays lands the same way: " +
    "reading " + L8b.seed + ", " + (L8b.st.length - L8a.st.length) +
    " transport:state events");
  check(wentOn(L8a, L8b) && L8b.rms > 0,
    "S8b · …the walk never restarted and the engine never went quiet — " +
    (L8b.pos.length - L8a.pos.length) + " new bars, serial " +
    L8a.pos[L8a.pos.length - 1] + " -> " + L8b.pos[L8b.pos.length - 1] +
    ", rms " + (L8b.rms || 0).toFixed(5));
  check(nums8.length >= 2 && nums8[nums8.length - 1] < nums8[0] &&
        nums8.every((n) => n > 0 && n < 400),
    "S8c · …and the same countdown counted it down: " + JSON.stringify(nums8));
  check(L8b.doc === want8,
    "S8d · …and the page holds genreToDocument(basis, 777) afterwards (" +
    (L8b.doc === want8) + ")");
  /* S6g — AND A RELOAD IS SILENT. The other half of what was asked: a seed
     change the READER made plays; a page that came back on its own does not.
     A reload is also the session-restore path (localStorage nu.band.session),
     so this is the one assertion that covers both. */
  await quiet6();
  await p6.reload({ waitUntil: "load" });
  await p6.waitForTimeout(6000);
  const afterReload = await bounce();
  check(!afterReload.playing,
    "S6g · a RELOAD does not autoplay — a restored session is silent " +
    JSON.stringify({ playing: afterReload.playing, state: afterReload.state }));

  check(!errs6.length, "S6 · zero pageerrors / console errors on the " +
    "default-policy page " + JSON.stringify(errs6.slice(0, 4)));
  await b6.close();

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
