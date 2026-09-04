#!/usr/bin/env node
/* test/mix-heads.browser.js — THE MIX PLATE'S HEADS, DRIVEN ON THE RENDERED
 * PAGE (2026-09-02, the composer round, slice 2e).
 *
 * WHY THIS FILE EXISTS. Paul, B11, in one breath: *"Instead of having four
 * icons on top and section automation that should have been five subicons
 * under the 'Mix' icon. One of them is section automation. … the columns
 * should list the instrument and when I click on the column head let me edit
 * the instrument! Light up which instrument is playing, make a little volume
 * meter INSIDE the heading. … I need to be able to jump to a section somehow,
 * by clicking on them when in automation."*
 *
 * Four claims, and every one of them is about what the browser DRAWS and what
 * happens when a finger lands on it — which is why this is a browser gate and
 * why it presses play. nukernel/desk-gate.js holds the STRUCTURE of the same
 * surface (one plate per child, the keys, no sideways growth, no page move on
 * a tap) and test/meter-reach.browser.js holds the NUMBER behind the meter
 * (rms > 0 on a chair that is sounding, off the two `__nu*` probes). This one
 * holds the JOIN: that the numbers and the playhead reach the heads a hand
 * actually touches, and that the two taps go where they say.
 *
 * TEST THE ARTIFACT. Nothing here reads a module, a spec or a probe where the
 * page itself can be asked: the meter is measured off the drawn `.nu-meterbar`
 * height, the lit head off its class, the jump off the transport's own `si`.
 *
 * THE CHECKS
 *   X1  Mix > section automation opens from the NAV (the five children), and
 *       the plate is the one on the board.
 *   X2  every column head names an INSTRUMENT and a PLAYER, in a button keyed
 *       `col|<voice>`, wearing that player's category colour (`data-vi`).
 *   X3  every head carries a `.nu-meterwell[data-live="meter"]` and it is
 *       captioned with what the number IS — per frame, per bar, or not yet
 *       measured. A well that filled without saying so would be the fake
 *       measurement METER_WHY spent a fortnight refusing.
 *   X4  after 8 s of play at least one head is `is-sounding` and its bar has
 *       height > 0, while a MUTED chair's bar is 0 — the honest pair, because
 *       a meter that reads the master would light the muted one too.
 *   X5  tapping a row head shows a pending jump (the gutter's countdown) and
 *       playback reaches that section within its own bar count plus the
 *       engine's runway.
 *   X6  tapping a column head lands on Band with that member's `inst` facet
 *       open.
 *
 * THE HONEST BOUNDARIES. (a) The engine runs an ~8 s prefill runway before the
 * first bar is heard, so X4 waits and then POLLS rather than asserting on one
 * sample — a bar has rests in it and one look between two notes is evidence of
 * nothing. (b) A queued jump lands on a BAR LINE, and the wait is bars plus
 * that runway; X5's budget is computed from the record's own bars rather than
 * guessed. (c) A chair on the Faust lane is measured per BAR, so X4 accepts a
 * head lit by either lane and says which it saw.
 *
 * RUN:  NODE_PATH=/home/ford/ftrain-2025/node_modules node test/mix-heads.browser.js
 *       (stands up its own COOP/COEP server, like meter-reach and vol-reach)
 */
"use strict";
const KINGSTON = "#at=Kingston&y=1969&s=1";   // named: a record with a band in it
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const ROOT = path.join(__dirname, "..");
const PAGE_ARG = arg("--page", null);
const EXE = arg("--chrome", null) || (() => {
  const home = process.env.HOME;
  for (const d of ["chromium-1234", "chromium_headless_shell-1234", "chromium-1217"]) {
    for (const b of ["chrome-linux64/chrome", "chrome-linux/headless_shell", "chrome-linux/chrome"]) {
      const p = path.join(home, ".cache/ms-playwright", d, b);
      if (fs.existsSync(p)) return p;
    }
  }
  return path.join(home, ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
})();

const fails = [], notes = [];
const check = (ok, what, extra) => { (ok ? notes : fails).push(what);
  console.log((ok ? "  ok   " : "  FAIL ") + what +
    (!ok && extra ? "\n         " + extra : "")); };

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
  console.log("\nmix-heads — the automation plate's column and row heads, driven");
  const srv = PAGE_ARG ? null : await standUpServer();
  const PAGE = PAGE_ARG || ("http://127.0.0.1:" + srv.port + "/nukernel/index.html");
  const b = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  /* THE ADDRESS NAMES THE RECORD AND ITS SEED. The box boots on the blank
     state and draws a new seed every session (Paul, B1/B3), so a gate that
     asked for "whatever is playing" would measure a different record each
     run. */
  await p.goto(PAGE + KINGSTON, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3500);

  /* ---- X1 · the plate opens from the NAV ------------------------------ */
  const opened = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    if (window.__eightTab) window.__eightTab("Mix");
    await wait(350);
    const a = document.querySelector('[data-k="boardtab|auto|auto"]');
    const inTray = !!(a && a.closest("#nu-tray"));
    if (a) a.click();
    await wait(500);
    const plate = document.querySelector("#boardpanel #rack .nu-plate");
    return { inTray, bus: plate && plate.dataset.bus,
             oldRow: document.querySelectorAll("#boardtabs").length,
             grid: !!document.querySelector("#trimgrid") };
  });
  check(opened.inTray && opened.bus === "auto" && opened.grid && !opened.oldRow,
    "X1 Mix > section automation opens from the NAV's own child row, and the " +
    "grid is the plate on the board (no in-panel tab row left)",
    JSON.stringify(opened));

  /* ---- X2/X3 · what a column head is ---------------------------------- */
  const chairs = await p.evaluate(() =>
    window.NuDeskDoc.channelVoicesOf(window.__eightDoc(), window.NuGenres.GENRES)
      .map((c) => ({ key: c.key, name: c.voice.name })));
  const headsRead = await p.evaluate(() =>
    [...document.querySelectorAll("#trimgrid thead th")].slice(1).map((th) => {
      const btn = th.querySelector("button[data-k^='col|']");
      const well = th.querySelector(".nu-meterwell");
      return { k: btn && btn.dataset.k,
               /* THE CATEGORY SLOT IS ON THE `<th>` SINCE 2026-09-02 (the
                  word-grid component). `[data-vi]` declares `--vpaint` for
                  everything inside it and `.nu-vpaint` on the button spends
                  it — the same shape the Structure grids have always used, and
                  the unification made the two heads one. The claim is the same
                  claim: this column wears this player's colour. */
               vi: th.dataset.vi,
               instr: btn && (btn.querySelector(".nu-colinstr") || {}).textContent,
               name: btn && (btn.querySelector(".nu-colname") || {}).textContent,
               aria: btn && btn.getAttribute("aria-label"),
               live: well && well.dataset.live,
               bar: !!(well && well.querySelector(".nu-meterbar")),
               title: well && well.title };
    }));
  const wantCols = chairs.map((c) => "col|" + c.name);
  const badHead = headsRead.filter((h, i) =>
    h.k !== wantCols[i] || !h.instr || !h.name || h.vi == null ||
    !/ — open this player's instrument$/.test(h.aria || ""));
  check(headsRead.length === chairs.length && !badHead.length,
    "X2 every column head is a `col|<voice>` button naming an INSTRUMENT over " +
    "a PLAYER, in that player's category colour — " +
    JSON.stringify(headsRead.map((h) => h.instr + " / " + h.name)),
    JSON.stringify(badHead));
  const SAYS = /rms — per (frame|bar)$|^not yet measured — plays first$/;
  const badWell = headsRead.filter((h) =>
    h.live !== "meter" || !h.bar || !SAYS.test(h.title || ""));
  check(headsRead.length > 0 && !badWell.length,
    "X3 every head carries a `.nu-meterwell[data-live=\"meter\"]` captioned " +
    "with what its number IS (per frame, per bar, or not yet measured) — " +
    JSON.stringify(headsRead.map((h) => h.title)),
    JSON.stringify(badWell));

  /* ---- X4 · lit and measured while it plays, dark while it is muted ---- */
  await p.evaluate(() => { const b2 = document.getElementById("play"); if (b2) b2.click(); });
  await p.waitForTimeout(8000);

  const readHeads = () => p.evaluate(() =>
    [...document.querySelectorAll("#trimgrid thead th")].slice(1).map((th) => {
      const btn = th.querySelector("button[data-k^='col|']");
      const bar = th.querySelector(".nu-meterbar");
      return { name: btn && (btn.querySelector(".nu-colname") || {}).textContent,
               on: th.classList.contains("is-sounding"),
               w: bar ? parseFloat(bar.style.width) || 0 : 0,
               title: (th.querySelector(".nu-meterwell") || {}).title };
    }));
  let lit = null;
  for (let i = 0; i < 120 && !lit; i++) {
    const s = await readHeads();
    const hot = s.filter((h) => h.on && h.w > 0);
    if (hot.length) lit = { rows: s, hot };
    else await p.waitForTimeout(250);
  }
  const seen = lit || { rows: await readHeads(), hot: [] };
  check(seen.hot.length > 0,
    "X4 while the record plays, a column head is `is-sounding` AND its meter " +
    "bar has height > 0 — the playhead and the measurement, both in the " +
    "heading (" + seen.hot.map((h) => h.name + " " + h.w + "%").join(", ") + ")",
    JSON.stringify(seen.rows));

  /* ...AND THE SAME HEAD GOES DARK WHEN THAT PLAYER IS MUTED, which is the
     half that can only be true of a REAL per-voice number: a meter fed the
     master's RMS would light a muted chair exactly as brightly as a sounding
     one, and that is the fake measurement METER_WHY spent a fortnight
     refusing.

     THE MUTE IS THE PAGE'S OWN GESTURE, not a write into the document. An
     earlier draft of this check called `NuDeskDoc.writeDesk(voice,"mute",true)`
     from the gate and then measured — and it FAILED, correctly: writing the
     record behind the page's back never reaches `push()`, so the engine went
     on playing the tune it had been handed and the meter went on measuring it
     honestly. That is the "test the artifact" law finding its own violation.
     So the gate presses the mute button on that player's own strip, the way a
     hand does, and then WAITS: the walk runs a runway ahead of the ear, so the
     mute is heard bars later, which is the honest cost this box states
     everywhere else. */
  const victim = (seen.hot[0] || {}).name;
  const muteTrip = victim ? await p.evaluate(async (n) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    if (window.__eightTab) window.__eightTab("Band");
    await wait(350);
    let b2 = document.querySelector('[data-k="tab' + n + '"]');
    if (!b2 && window.__eightUp) { window.__eightUp(); await wait(300);
                                   b2 = document.querySelector('[data-k="tab' + n + '"]'); }
    if (!b2) return { found: false };
    b2.click(); await wait(350);
    /* THE MUTE IS IN THE PLAYER'S COLUMN SHEET SINCE 2026-09-04 (TABLE.md wave
       2c): `facet-mix` is deleted and `voiceMix` is seated in the sheet the
       column head opens, which the mark's own `openVoice` opens on arrival. */
    const h2 = document.querySelector('#pan-band [data-k="tcol|' + n + '"]');
    if (h2 && h2.getAttribute("aria-expanded") !== "true") h2.click();
    await wait(500);
    const m = document.querySelector('[data-k="b|mute|' + n + '"]');
    if (!m) return { found: false, facet: true };
    m.click(); await wait(400);
    if (window.__eightTab) window.__eightTab("Mix");
    await wait(350);
    const a = document.querySelector('[data-k="boardtab|auto|auto"]');
    if (a) a.click();
    await wait(400);
    return { found: true };
  }, victim) : { found: false };
  let dark = null;
  for (let i = 0; i < 80 && !dark; i++) {
    const s = await readHeads();
    const me = s.find((h) => h.name === victim);
    if (me && me.w === 0 && s.some((h) => h.name !== victim && h.w > 0)) dark = s;
    else await p.waitForTimeout(500);
  }
  check(!!victim && muteTrip.found && !!dark,
    "…and MUTING that player through its own strip takes its bar to 0 while a " +
    "neighbour's stays lit (" + victim + ") — a meter reading the master " +
    "would have kept it burning, which is exactly the fake measurement " +
    "METER_WHY refused",
    JSON.stringify({ victim, muteTrip, last: await readHeads() }));
  // put the record back the way it was found — the mute is a page gesture and
  // the next check plays from a section, which must not audition a hole.
  if (victim && muteTrip.found) await p.evaluate(async (n) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    if (window.__eightTab) window.__eightTab("Band");
    await wait(350);
    const m = document.querySelector('[data-k="b|mute|' + n + '"]');
    if (m) m.click();
    await wait(400);
    if (window.__eightTab) window.__eightTab("Mix");
    await wait(300);
    const a = document.querySelector('[data-k="boardtab|auto|auto"]');
    if (a) a.click();
    await wait(400);
  }, victim);

  /* ---- X5 · a row head is a jump -------------------------------------- */
  const secs = await p.evaluate(() => window.__eightDoc().form.sections
    .map((s2, i) => ({ id: s2.id, i, bars: s2.bars })));
  const target = secs.length > 1 ? secs[secs.length - 1] : secs[0];
  const jumped = await p.evaluate(async (id) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const b2 = document.querySelector('[data-k="row|' + id + '"]');
    if (!b2) return { found: false };
    b2.click();
    await wait(700);
    const c = document.querySelector(".nu-count");
    return { found: true, said: c ? c.textContent.trim() : "" };
  }, target.id);
  check(jumped.found && /\d/.test(jumped.said || ""),
    "X5 tapping a row head queues a jump and the gutter's countdown SAYS WHEN " +
    "(\"" + (jumped.said || "") + "\") — a queued gesture that says nothing " +
    "for a whole box is a gesture nobody can tell landed",
    JSON.stringify(jumped));
  /* THE BUDGET IS THE RECORD'S OWN. A jump lands on the next bar line and the
     ear is a runway behind the walk, so the wait is bounded by the record's
     bars plus that runway rather than by a number typed here. */
  const secsToWait = await p.evaluate(() => {
    const bars = (window.__nuBarSecs ? window.__nuBarSecs() : []) || [];
    const tot = bars.reduce((a, x) => a + (x.sec || 0), 0);
    return Math.min(90, Math.max(20, Math.ceil(tot) + 12));
  });
  /* LANDED IS READ OFF THE GRID ITSELF, not off a probe. The board paints
     `tr.now` on the SOUNDING section once a beat (ui/engineer.js `paint`, off
     `playingSec`), and that row mark is the page's own answer to "where is the
     ear" — so the assertion reads the artifact rather than a number beside
     it. It also happens to be the only reading that proves the two halves
     agree: the transport moved AND the plate says so. */
  let landed = false;
  for (let i = 0; i < secsToWait * 2 && !landed; i++) {
    /* THE ROW'S IDENTITY IS THE SECTION'S OWN ID SINCE 2026-09-02 (the
       word-grid component): `tr[data-row]`, not `tr[data-sec]` with an index
       in it. An index is a position and a position moves when a section is
       added; the id is the address every cell in the row already uses. Same
       reading of the same paint — `tr.now` is still what the board writes on
       the sounding row and this still reads the artifact rather than a probe. */
    landed = await p.evaluate((id) => {
      const tr = document.querySelector("#trimgrid tbody tr.now");
      return !!(tr && tr.dataset.row === id);
    }, target.id);
    if (!landed) await p.waitForTimeout(500);
  }
  check(landed,
    "…and playback REACHES that section within its own bar count plus the " +
    "runway (" + target.id + ", index " + target.i + ", budget " + secsToWait + "s)");

  await p.evaluate(() => { const b2 = document.getElementById("play"); if (b2) b2.click(); });
  await p.waitForTimeout(800);

  /* ---- X6 · a column head is a player --------------------------------- */
  const who = chairs[0].name;
  const landedOn = await p.evaluate(async (n) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    if (window.__eightTab) window.__eightTab("Mix");
    await wait(300);
    const a = document.querySelector('[data-k="boardtab|auto|auto"]');
    if (a) a.click();
    await wait(400);
    const h = document.querySelector('button[data-k="col|' + n + '"]');
    if (!h) return { found: false };
    h.click();
    await wait(600);
    const tray = window.__eightTray ? window.__eightTray() : null;
    return { found: true, tab: window.__eightTabNow && window.__eightTabNow(),
             /* ...AND "ITS FACET IS OPEN" IS "ITS COLUMN SHEET IS OPEN"
                SINCE 2026-09-04: a player is one vector and its head opens all
                of it, so what X6 asserts is that the head this landed on is
                EXPANDED — the same claim, at the tier that now holds it. */
             facet: (() => { const h = document.querySelector(
               '#pan-band [data-k="tcol|' + n + '"]');
               return !!h && h.getAttribute("aria-expanded") === "true"; })(),
             marked: tray ? tray.mark : null,
             strip: !!document.querySelector('[data-sel^="sound.instrument"],' +
                                            '[data-k^="sel|sound.instrument"]') };
  }, who);
  check(landedOn.found && landedOn.tab === "Band" && landedOn.facet,
    "X6 tapping a column head lands on Band with that member's row unfolded " +
    "and its `inst` facet open (" + who + ")", JSON.stringify(landedOn));

  check(!errs.length, "the page raised no console error while the heads were driven",
    errs.slice(0, 3).join(" | "));

  await b.close();
  if (srv) srv.proc.kill();
  console.log("\nmix-heads: " + notes.length + " ok, " + fails.length + " failed");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error("mix-heads: " + (e && e.stack || e)); process.exit(1); });
