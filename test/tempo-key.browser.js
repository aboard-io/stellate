#!/usr/bin/env node
/* test/tempo-key.browser.js — THE TEMPO AND KEY EDITORS, DRIVEN
 * (2026-09-02, the composer round, slice 2a).
 *
 * WHY THIS FILE EXISTS. Paul, B7: *"Tap tempo, the tempo editor appears, same
 * for key. The tempo editor does not reflect the richness of our tempo
 * options. Key may not either. … The left nav elements for tweaking tempo
 * should be brought inside tempo."*
 *
 * The slice added five facts a hand could not say before today, and every one
 * of them is the shape of this repo's characteristic bug — DECLARED BUT NEVER
 * ARRIVING. Each already reached the sound; none had a control:
 *
 *   · `time.groove` — ui/eight.js has called `setGroove(DOC.time.groove)`
 *     since the day that writer was written, ui/state.js normalises it against
 *     GROOVELABEL and ui/derive.js hands it to the kernel. No sheet, no menu.
 *   · `form.pace` — compose.js dealPaces has stamped a mensural word on every
 *     box since 2026-08-30 and audio/plan.js paceTL multiplies it into bar
 *     seconds. ui/engineer.js PRINTED it, in a row header, with a note saying a
 *     control "is not asked".
 *   · the length of `alphabet.prog` — every field of every chord was editable
 *     and the number of bars was not.
 *   · a tap tempo — `grep -rniE "tap.?tempo"` over the whole tree returned
 *     zero before today.
 *   · and one bug the other way: tapping a relative minor on the circle of
 *     fifths wrote `mode = "aeolian"` unconditionally, which silently retuned
 *     a shur or slendro record to twelve equal semitones.
 *
 * WHY A BROWSER GATE. Every claim below is about the RENDERED page — a control
 * exists, a thumb presses it, and the record moves — which is this box's own
 * law (TEST THE ARTIFACT: three features have shipped broken here while every
 * check passed). One of them additionally needs the PLAN — the pace's effect
 * on bar seconds — and the plan is an ES-module graph that only exists in a
 * page.
 *
 * WHY NO AUDIO IS RENDERED. The pace's effect is measured at
 * `window.__nuBarSecs()` — audio/plan.js's own compiled timeline, after
 * `paceTL` — and not at the PCM. test/pace-meter.test.js already owns the PCM
 * claim; rendering here would be measuring somebody else's assertion slowly.
 *
 * THE CHECKS
 *   T1  four taps 500 ms apart — 120 a minute — write time.bpm 118..122,
 *       through the SLIDER's own key.
 *   T1b …and the tap count is printed beside the mark.
 *   T2  the groove menu writes doc.time.groove AND the word reaches ui/state.js
 *       GROOVE (which is the value ui/derive.js is handed).
 *   T3  the pace strip has one row per section, writes section 2's `pace` to
 *       `push`, and audio/plan.js's bar SECONDS for that section shrink.
 *   T4  `+ bar` grows the cycle to five and the fifth chord reaches the
 *       COMPILED genre (`__eightGenres().prog`); `− bar` puts it back.
 *   T5  on a shur record, tapping a relative minor moves the KEY and leaves
 *       the alphabet alone — and on a 12-TET record it still answers both;
 *       on slendro the degree slider has FIVE degrees' worth of rungs, not
 *       seven, and the caption says the period.
 *   T6  zero pageerror, zero console error, across all of it.
 *
 * RUN: NODE_PATH=/home/ford/ftrain-2025/node_modules node test/tempo-key.browser.js
 *      (stands up its own COOP/COEP server; also honours an injected --page)
 */
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const ROOT = path.join(__dirname, "..");
const PAGE_ARG = arg("--page", null);
/* the executablePath ladder — bare chromium.launch() picks whatever playwright
   last installed and has faked a bug report on this box before */
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

/* THE BOX BOOTS ON THE BLANK STATE (2026-09-02, Paul: *"Add a 'silence' genre
   at the top of the genre list. This is a blank state."*) — one section, zero
   voices. Every claim here is about a record with a form and a band in it, so
   one is named in the address the way a link does: the shipped chant, at seed
   1 because the boot draws a seed now and a gate that re-rolled its own
   subject would measure a different record every run. */
const CHANT = "#at=Rome&y=600&s=1";

const fails = [], notes = [];
const check = (ok, what) => { (ok ? notes : fails).push(what);
  console.log((ok ? "  ok   " : "  FAIL ") + what); };

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
  console.log("\ntempo-key — the two editors, driven on the rendered page");
  const srv = PAGE_ARG ? null : await standUpServer();
  const PAGE = PAGE_ARG || ("http://127.0.0.1:" + srv.port + "/nukernel/index.html");
  const b = await chromium.launch({ executablePath: EXE });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text()))
    errs.push("console: " + m.text()); });
  await p.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  await p.goto(PAGE + CHANT, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);

  /* A TAB IS OPENED THE WAY A THUMB OPENS IT — `__eightTab` is the same call
     the stripe's own button makes (ui/eight.js says so at its definition). */
  const top = async (t) => { await p.evaluate((n) => window.__eightTab(n), t);
    await p.waitForTimeout(400); };
  const doc = () => p.evaluate(() => window.__eightDoc());
  const press = async (k) => { const hit = await p.evaluate((key) => {
      const el = document.querySelector('[data-k="' + key + '"]');
      if (!el || el.disabled) return false; el.click(); return true; }, k);
    await p.waitForTimeout(450); return hit; };
  const say = async (sel, v) => { await p.evaluate(([s, val]) => {
      const el = document.querySelector('select[data-sel="' + s + '"]');
      if (!el) return; el.value = val;
      el.dispatchEvent(new Event("change", { bubbles: true })); }, [sel, v]);
    await p.waitForTimeout(600); };

  /* ================= T1 · TAP TEMPO ================================== */
  await top("Tempo");
  const panel = await p.evaluate(() => ({
    big: !!document.querySelector("#pan-tempo .nu-bpmbig"),
    bigLive: !!document.querySelector("#pan-tempo .nu-bpmbig[data-live]"),
    tap: !!document.querySelector('#pan-tempo [data-k="tempo-tap"]'),
    ops: document.querySelectorAll('#pan-tempo [data-k^="tempo-"]').length,
    bpm: !!document.querySelector('#pan-tempo input[data-k="bpm"]'),
  }));
  check(panel.big && panel.tap && panel.bpm && panel.ops === 9,
    "the Tempo panel holds the big readout, the slider, the tap and the eight " +
    "operations " + JSON.stringify(panel));
  /* THE FROZEN-PAGE LAW, on the one element that looks like it should break it
     (MOTIF.md / test/motif-frozen A1): the clock writes only inside
     `[data-live]`, and a tempo readout that WAS live would be a metronome. */
  check(!panel.bigLive, "T1a the big readout is not [data-live] — it follows a " +
    "hand, never the clock");

  /* FOUR TAPS AT 120 A MINUTE. The first tap measures nothing (one timestamp
     is not an interval), so four taps is three intervals — which is what a
     hand actually gives a tap tempo, and one short of the four the median
     window holds.

     WHY THE TAPS ARE SCHEDULED INSIDE THE PAGE, AGAINST AN ABSOLUTE DEADLINE.
     Driving them from node — click, `waitForTimeout(500)`, click — measured
     105 and not 120, and the arithmetic says why: each tap calls `changed()`
     SYNCHRONOUSLY inside its own handler, so a sleep that starts after the
     click starts after the rebuild, and the intervals came out ~570 ms. That
     is the harness's latency being read as the composer's tempo, which is the
     same species of false bug report as `page.click()` scrolling its target
     (test/knobs.js 11d says so about a drag). So the run is scheduled on the
     page's own clock — the one the listener reads — at t0 + i·500, with the
     last two milliseconds spun rather than slept, and the rebuild happens
     inside the gap where a hand's would. */
  const bpm0 = (await doc()).time.bpm;
  await p.evaluate(async () => {
    const t0 = performance.now();
    for (let i = 0; i < 4; i++) {
      const at = t0 + i * 500;
      while (performance.now() < at - 2)
        await new Promise((r) => setTimeout(r, 1));
      while (performance.now() < at) { /* the last 2 ms, spun */ }
      // re-queried every time: `changed()` rebuilds the panel under the thumb
      document.querySelector('[data-k="tempo-tap"]').click();
    }
  });
  await p.waitForTimeout(700);
  const tapped = await p.evaluate(() => ({
    doc: window.__eightDoc().time.bpm,
    state: window.__eightTime().bpm,
    slider: +document.querySelector('#pan-tempo input[data-k="bpm"]').value,
    big: (document.querySelector("#pan-tempo .nu-bpmbig") || {}).textContent,
    count: [...document.querySelectorAll("#pan-tempo .nu-taprow output")]
      .map((o) => o.textContent).join(""),
  }));
  check(tapped.doc >= 118 && tapped.doc <= 122,
    "T1 four taps 500 ms apart write time.bpm 118..122 — " + bpm0 + " -> " +
    tapped.doc);
  check(tapped.slider === tapped.doc && String(tapped.big).trim() === String(tapped.doc),
    "…and the slider and the big readout say the same number " +
    JSON.stringify(tapped));
  check(/\d+\s+taps?/.test(tapped.count),
    "T1b the count of taps is printed beside the mark (" + tapped.count + ")");

  /* ================= T2 · THE GROOVE ================================== */
  const g0 = await p.evaluate(() => ({ doc: window.__eightDoc().time.groove,
                                       state: window.__eightTime().groove }));
  await say("time.groove", "funk");
  const g1 = await p.evaluate(() => ({ doc: window.__eightDoc().time.groove,
                                       state: window.__eightTime().groove }));
  check(g1.doc === "funk" && g1.state === "funk",
    "T2 the groove menu writes the document AND reaches ui/state.js GROOVE " +
    JSON.stringify({ was: g0, now: g1 }));

  /* ================= T3 · THE PACE STRIP ============================== */
  const secs = (await doc()).form.sections.map((s) => s.id);
  const strip = await p.evaluate(() =>
    [...document.querySelectorAll('#pan-tempo select[data-sel^="form.pace"]')]
      .map((s) => s.dataset.sel));
  check(strip.length === secs.length,
    "T3 one pace row per section (" + strip.length + " of " + secs.length + ")");
  /* THE BAR SECONDS BEFORE AND AFTER, off audio/plan.js's own compiled
     timeline — `paceTL` has already had its say by the time `timeline()`
     answers, so this is the number the transport would play. */
  const secsOf = async (si) => p.evaluate((i) => {
    const bars = window.__nuBarSecs ? window.__nuBarSecs() : [];
    const mine = bars.filter((b) => b.si === i).map((b) => b.sec);
    return mine.length ? mine.reduce((a, x) => a + x, 0) / mine.length : null;
  }, si);
  const was = await secsOf(1);
  await say("form.pace|" + secs[1], "push");
  const now = await secsOf(1);
  const pace1 = (await doc()).form.sections[1].pace;
  check(pace1 === "push", "…and it writes form.sections[1].pace (" + pace1 + ")");
  check(was != null && now != null && now < was * 0.9,
    "T3b …and audio/plan.js's bar seconds for that section SHRINK — " +
    (was == null ? "?" : was.toFixed(3)) + "s -> " +
    (now == null ? "?" : now.toFixed(3)) + "s");
  /* put it back, so T4 and T5 measure a record nobody has paced */
  await say("form.pace|" + secs[1], "");

  /* ================= T4 · THE CYCLE GROWS ============================= */
  await top("Key");
  const p0 = await p.evaluate(() => ({
    doc: window.__eightDoc().alphabet.prog.length,
    add: !!document.querySelector('[data-k="prog-add"]'),
    cut: !!document.querySelector('[data-k="prog-cut"]'),
  }));
  check(p0.add && p0.cut, "T4 the changes grid has + bar and − bar " +
    JSON.stringify(p0));
  /* A MODAL RECORD'S CYCLE IS ONE BAR, so `− bar` must be refused AND SAY WHY
     — the page's own law, read off the artifact (`data-why`), which is the
     only place a gate may read a refusal from. */
  if (p0.doc <= 1) {
    const why = await p.evaluate(() => { const el =
      document.querySelector('[data-k="prog-cut"]');
      return { off: !!el.disabled, why: (el.dataset.why || "").trim() }; });
    check(why.off && !!why.why, "T4a NO SILENT GREY: at one bar, − bar is " +
      "refused and says why (" + why.why + ")");
  }
  while ((await doc()).alphabet.prog.length < 5) {
    if (!(await press("prog-add"))) break;
  }
  const grown = await p.evaluate(() => {
    const G = window.__eightGenres(), k = Object.keys(G)[0];
    return { doc: window.__eightDoc().alphabet.prog.length,
             compiled: k ? G[k].prog : null };
  });
  check(grown.doc === 5 && grown.compiled === 5,
    "T4b + bar grows the cycle to five bars and the fifth chord reaches the " +
    "COMPILED genre " + JSON.stringify(grown));
  await press("prog-cut");
  const cutBack = (await doc()).alphabet.prog.length;
  check(cutBack === 4, "T4c − bar takes one off again (" + cutBack + ")");

  /* THE DEGREE SLIDER'S RUNGS ARE THE ALPHABET'S OWN — seven on a diatonic
     mode, five on slendro (`K.romanOf(MODES[mode]).length - 1`). Read off the
     control, because a duplicate rung is invisible in the document. */
  const rungs = await p.evaluate(() => {
    const r = document.querySelector('#pan-key input[data-k="prog0d"]');
    return r ? { max: +r.max, mode: window.__eightDoc().alphabet.mode,
                 n: (window.NuKernel.romanOf(
                   window.NuGenres.MODES[window.__eightDoc().alphabet.mode]) || []).length }
             : null; });
  check(!!rungs && rungs.max === rungs.n - 1,
    "T4d the degree slider has one rung per degree of the record's own " +
    "alphabet " + JSON.stringify(rungs));

  /* ================= T5 · THE CIRCLE AND A TUNING ===================== */
  /* A 12-TET RECORD FIRST, so the reversal is proved to be a NARROWING and not
     a deletion: tapping a relative minor still answers two questions where the
     alphabet has a minor to be in. Pushed to `ionian` first, because a browser
     fires no `change` on a control that is already where you put it. */
  await say("alphabet.mode", "ionian");
  await p.evaluate(() => { const l =
    document.querySelector('#pan-key .nu-circ .nu-ki[data-v="-3"]');
    if (l) l.click(); });
  await p.waitForTimeout(500);
  const tet = await p.evaluate(() => ({ key: String(window.__eightDoc().alphabet.key),
                                        mode: window.__eightDoc().alphabet.mode }));
  check(tet.key === "-3" && tet.mode === "aeolian",
    "T5 on a 12-TET record the ring still answers two questions " +
    JSON.stringify(tet));
  /* NOW A TUNED ONE. `shur` carries a quarter-tone second — a `.5` in the
     numbers — so it is not the twelve equal semitones, and the tap must move
     the tonic and leave the alphabet where it is. */
  await say("alphabet.mode", "shur");
  const cap = await p.evaluate(() =>
    [...document.querySelectorAll("#pan-key .nu-cap")].map((c) => c.textContent.trim()));
  check(cap.length === 1 && /quarter/.test(cap[0]),
    "T5a …and a non-12-TET mode says what it is, under its own field " +
    JSON.stringify(cap));
  await p.evaluate(() => { const l =
    document.querySelector('#pan-key .nu-circ .nu-ki[data-v="4"]');
    if (l) l.click(); });
  await p.waitForTimeout(500);
  const shur = await p.evaluate(() => ({ key: String(window.__eightDoc().alphabet.key),
                                         mode: window.__eightDoc().alphabet.mode }));
  check(shur.mode === "shur" && shur.key === "4",
    "T5b tapping a relative minor on a shur record moves the KEY and leaves " +
    "the alphabet alone " + JSON.stringify(shur));

  /* T5c THE SLENDRO CASE, WHICH IS THE ONE THE DUPLICATE RUNG WAS ABOUT. Five
     degrees, a 12.08-semitone period. The degree slider must offer FOUR rungs
     above zero and not six (rungs 5 and 6 used to wrap round and print `i` and
     `ii` a second time), and the caption must say the period, because a mode
     with its own octave is a thing a composer has to be told. */
  await say("alphabet.mode", "slendro");
  const slen = await p.evaluate(() => {
    const r = document.querySelector('#pan-key input[data-k="prog0d"]');
    return { mode: window.__eightDoc().alphabet.mode,
             max: r ? +r.max : null,
             cap: [...document.querySelectorAll("#pan-key .nu-cap")]
               .map((c) => c.textContent.trim()) }; });
  check(slen.mode === "slendro" && slen.max === 4,
    "T5c a five-degree alphabet gives the degree slider four rungs, not six " +
    JSON.stringify(slen));
  check(slen.cap.length === 1 && /12\.08/.test(slen.cap[0]),
    "T5d …and the caption says the period it plays in " + JSON.stringify(slen.cap));

  /* ================= T6 · NOTHING THREW ============================== */
  check(!errs.length, "T6 zero page and console errors " +
    JSON.stringify(errs.slice(0, 3)));

  await b.close();
  if (srv) srv.proc.kill();
  console.log("\ntempo-key: " + notes.length + " ok, " + fails.length + " failed");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error("tempo-key: " + (e && e.stack || e)); process.exit(1); });
