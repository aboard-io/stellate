#!/usr/bin/env node
/* test/envelope.browser.js — THE ENVELOPE EDITOR, DRIVEN ON THE RENDERED PAGE.
 *
 * (nukernel/TABLE.md §11, RULED 2026-09-05. Paul, after the AUX spike: *"Don't
 * do aux. keep our stuff but make it less chunky and more stylish. Make an Adsr
 * and envelope editor though and use that for samples etc."*)
 *
 * WHAT IS ASSERTED, and every one of them is read off the rendered page or off
 * rendered PCM — never off a spec, because this box's characteristic bug is a
 * parameter that is declared, costed and never reaches the sound
 * ([[declared-but-never-arriving]]) and its second-commonest is a gate that
 * tests the plan ([[test-the-artifact]]).
 *
 *   E1  A SAMPLED CHAIR GETS ONE. The column sheet draws exactly one plate
 *       with a real curve (an SVG path with more than two points in it) and
 *       four handles — attack, decay, sustain, release — each a 44px control
 *       with `role=slider`, its own `data-k`, and the value printed beside it
 *       in the field's own units. `touch-action` is `none` on the plate AND on
 *       every handle (the AUX spike measured a page scrolling 400 -> 246 under
 *       a drag that had not declared it).
 *   E2  A MODELLED CHAIR GETS ONE TOO, and the knob table it replaces no
 *       longer draws those rows — §11's "nothing lost, the numbers print
 *       beside the handles", measured as: the editor's handles exist AND the
 *       old slider rows for the same keys do not.
 *   E3  A THUMB DRAG ON THE RELEASE HANDLE WRITES THE FIELD. A real CDP touch
 *       drag moves `voices[].sound.rel` to a NUMBER, and the page does not
 *       scroll a pixel under the finger.
 *   E4  ...AND THE RENDERED TAIL LENGTHENS. The page's own press
 *       (nukernel/export/_satpress.js `pressFloat`, the float-PCM twin of the
 *       WAV export) is run twice — a short release and a long one — and the
 *       energy in the last half second of the render is compared. This is the
 *       whole point of the round: the sampler lane was A-H-R and gained a
 *       decay and a sustain, and an envelope editor whose handles reach no
 *       sound is the bug this file exists to refuse.
 *   E5  THE KEYBOARD REACHES EVERY HANDLE. ArrowRight on a focused handle
 *       writes; Home and End go to the field's own ends. §6 ¶A: a control that
 *       only works with a pointer is a refused control.
 *   E6  RESET WORKS TWICE OVER — a long press on the handle and the clear-back
 *       beside the printed number both return the field to ABSENT (the key
 *       deleted, not set to a default). Double-tap is NOT offered and must not
 *       be: the spike measured zero `dblclick` events at four touch gaps.
 *   E7  NOTHING OVERHANGS AND NOTHING SCROLLS SIDEWAYS at 320, 390 and 1280.
 *       A 44px handle at a plate's edge overhangs by 22 — measured on AUX's
 *       own chart — so every handle's box must be inside the plate's box.
 *   E0  zero pageerror, zero console error across all of it.
 *
 * ===== AND THE OTHER TWO MODES OF THE SAME COMPONENT (2026-09-05) =========
 * TABLE.md §11's third item: *"the per-voice EQ (lo/mid/hi shelves, the desk's
 * FAM_EQ and the seat eq) and the master tilt as an EQ CURVE with draggable
 * bands; cutoff and resonance as an XY pad"*. Same file because it is the same
 * component (`src/envelope/` in its `eq` and `xy` modes) and the same risk:
 *
 *   Q1  THE CHANNEL STRIP DRAWS AN EQ CURVE. One plate in the voice's `mix`
 *       facet, three handles at the addresses the three sliders wore —
 *       `b|eqlo|<voice>`, `b|eqmid|`, `b|eqhi|` — each 44px, `role=slider`,
 *       `touch-action: none`, inside the plate.
 *   Q2  ...AND THE THREE SLIDERS ARE GONE, with the numbers printed beside the
 *       curve in dB. Two controls on one address is the shape test/selects.js
 *       fails a page for; a number that stopped being printed is T7's loss.
 *   Q3  THE CURVE ANSWERS THE HANDLE. The drawn path is read before and after
 *       a key press and must BEND — a plate that draws a picture unrelated to
 *       its own control is the same bug one layer up.
 *   Q4  A HAND ON A BAND MOVES THE NUMBER THE ENGINE IS HANDED. `__nuMix()` is
 *       the unit table `audio/plan.js` gives the parent for the sounding bar;
 *       the band's dB is read out of it before and after, and putting the band
 *       back puts the engine's number back.
 *   X1  A MODELLED CHAIR WITH BOTH HALVES DRAWS AN XY PAD: one handle at
 *       `xy|<voice>`, two crosshairs, both numbers printed in their own units.
 *   X2  ...AND THE TWO KNOB ROWS ARE GONE, with the table's addresses, the
 *       curve's handles and the pad's two axes together still adding up to the
 *       instrument's WHOLE measured census (nukernel/knobs.js) — a count alone
 *       would pass if the rows had simply been deleted.
 *   X3  THE KEYBOARD REACHES BOTH AXES on one handle: left/right and Home/End
 *       are the cutoff, up/down are the resonance, Backspace clears.
 *   X4  AND BOTH REACH THE RENDERED PCM. The page's own float press, with the
 *       cutoff sent to its floor and then its ceiling THROUGH THE PAGE, and
 *       then the resonance the same way with the cutoff untouched. This is the
 *       half that matters: a curve that draws beautifully and moves no sound
 *       is [[declared-but-never-arriving]] drawn on purpose.
 *
 * RUN: NODE_PATH=/home/ford/ftrain-2025/node_modules node test/envelope.browser.js
 */
"use strict";
const CHANT = "#at=Rome&y=600&s=1";   // the shipped chant, named
const { chromium } = require("playwright");
const { INSTALL } = require("./lib-combo.js");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const ROOT = path.join(__dirname, "..");
const PAGE_ARG = arg("--page", null);
const SHOTS = arg("--shots", null);
const EXE = arg("--chrome", null) || (() => {
  const home = process.env.HOME;
  for (const d of ["chromium-1234", "chromium_headless_shell-1234", "chromium-1217"])
    for (const b of ["chrome-linux64/chrome", "chrome-linux/headless_shell", "chrome-linux/chrome"]) {
      const p = path.join(home, ".cache/ms-playwright", d, b);
      if (fs.existsSync(p)) return p;
    }
  return path.join(process.env.HOME, ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
})();

/* ===== HOW A CHAIR IS SEATED, AND WHY THIS IS A FUNCTION NOW ============
   The instrument picker MOVED (2026-09-05, the cells-as-cells round and the
   lozenge field). It was `[data-k="sel|sound.instrument|<voice>"]`, a widget
   standing open in the chair's sheet; it is a CELL now — `[data-k=
   "sound.instrument|<voice>"]`, plain at rest — and the picker only exists
   after a tap, wearing `data-sel="sound.instrument|<voice>"` (DESIGN.md
   component 16: *"the lozenge field stamps `data-sel`"*, and test/lib-combo.js
   already reads all four widget shapes through that one address).

   This file drove the OLD query and read "the instrument menu offers no
   modelled chair" — five red checks about a control that works, and E4
   pressing 0 sampled chairs and reporting the engine dead. So the seating is
   one function, installed on the page, and every check that needs a chair
   asks it rather than writing the query out again. THE ADDRESS IS THE CELL'S
   AND THE TAP IS A HAND'S: nothing here assigns `voice.instrument`.  */
const SEATERS = `
window.__nap = (ms) => new Promise((r) => setTimeout(r, ms));
window.__col = async (name, want) => {
  const h = document.querySelector('#pan-band [data-k="tcol|' + name + '"]');
  if (h && h.getAttribute("aria-expanded") !== want) h.click();
  await window.__nap(500);
  return !!h;
};
/* pick(offers) -> the id to seat, or null. Returns what was seated. */
window.__seat = async (name, pick) => {
  await window.__col(name, "true");
  const cell = document.querySelector('#pan-band [data-k="sound.instrument|' + name + '"]');
  if (!cell) return null;
  /* A TAP TOGGLES, SO THE TAP IS REPEATED UNTIL THE PICKER IS THERE. Measured:
     seating a chair leaves its cell SELECTED, and the next tap on a selected
     cell CLOSES the editor instead of opening it — so the second __seat of a
     run shut the picker it came to use and reported "the menu offers no
     modelled chair" about a menu that offers eleven. Three taps is enough for
     either starting state and stops rather than spinning. */
  let sel = null;
  for (let i = 0; i < 3 && !sel; i++) {
    cell.click();
    await window.__nap(550);
    sel = document.querySelector('[data-sel="sound.instrument|' + name + '"]');
  }
  if (!sel) return null;
  const offers = window.__combo.words(sel).map((o) => o.v);
  const want = pick(offers);
  if (!want || offers.indexOf(want) < 0) return null;
  window.__combo.say(sel, want);
  await window.__nap(1100);
  await window.__col(name, "true");
  return want;
};
/* the chairs nukernel/knobs.js measured BOTH halves of the pad on. Asked of
   the page's own table, never named here — a fixture that named an instrument
   measured "the menu does not offer it" and reported a round unmeasurable. */
window.__xyChair = (offers) => {
  const K = (window.NuKnobs || {}).voices || {};
  return offers.find((id) => { const V = K[id]; if (!V) return false;
    const by = {}; for (const r of V.rows) by[r.key] = r;
    return !!(by.cutoff && (by.res || by.resonance)); }) || null;
};
window.__xyKeys = (id) => {
  const V = ((window.NuKnobs || {}).voices || {})[id]; if (!V) return null;
  const by = {}; for (const r of V.rows) by[r.key] = r;
  const res = by.res || by.resonance;
  return by.cutoff && res ? { x: by.cutoff, y: res } : null;
};
window.__mix = async (name) => {
  const h = document.querySelector('#pan-band [data-k="tmix|' + name + '"]');
  if (h && h.getAttribute("aria-expanded") !== "true") h.click();
  await window.__nap(900);
  return !!h;
};
/* THE NUMBER THE ENGINE IS HANDED, for one channel's EQ: __nuMix() is the
   unit table audio/plan.js gives the parent for the sounding bar, and a
   strip's eq lands on 'u.strip' (or 'u.sampler.strip' for a recording). */
window.__eqOnUnits = () => {
  const m = window.__nuMix ? window.__nuMix() : null;
  if (!m || !m.units) return null;
  const out = {};
  for (const [k, u] of Object.entries(m.units))
    out[k] = JSON.stringify((u.sampler && u.sampler.strip) || u.strip || null);
  return out;
};
/* one keydown on a handle, focused first — the way a thumb sends it. */
window.__key = async (k, which, shift, ms) => {
  /* RE-QUERIED EVERY TIME, because the write rebuilds the surface: every
     spec.set ends in the caller's changed() -> push() -> draw(), which throws
     the plate away and builds a new one, so a handle held across two presses
     is a detached node and the second press lands on nothing. */
  const h = document.querySelector('.nu-envh[data-k="' + k + '"]');
  if (!h) return false;
  h.focus();
  h.dispatchEvent(new KeyboardEvent("keydown",
    { key: which, shiftKey: !!shift, bubbles: true, cancelable: true }));
  await window.__nap(ms == null ? 700 : ms);
  return true;
};
true;`;

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
  console.log("\nenvelope — the ADSR editor, driven on the rendered page");
  const srv = PAGE_ARG ? null : await standUpServer();
  const PAGE = PAGE_ARG || ("http://127.0.0.1:" + srv.port + "/nukernel/index.html");
  const b = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required"] });
  const errs = [];

  /* 1280 JOINED THE SWEEP with the EQ curve and the pad (2026-09-05): the
     strip is a full-width row of the MIX special row at the desktop width and
     a stacked one at 390, and a handle clamped inside a 320px plate says
     nothing about one inside an 1100px plate. */
  for (const vw of [{ width: 390, height: 900 }, { width: 320, height: 700 },
                    { width: 1280, height: 900 }]) {
    const W = vw.width;
    const p = await b.newPage({ viewport: vw, hasTouch: true });
    p.on("pageerror", (e) => errs.push(W + " pageerror: " + e.message));
    p.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text()))
      errs.push(W + " console: " + m.text()); });
    await p.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
    await p.goto(PAGE + CHANT, { waitUntil: "load" });
    await p.evaluate(INSTALL);
    /* WAIT FOR THE RECORD, NOT FOR A CLOCK. The box boots on `silence` — one
       section, ZERO voices — and the address lands the chant a moment later;
       at 320 the second page of this run reached 2,600 ms with an empty band
       and the fixture read `D.voices[0].name` off nothing. A gate that sleeps
       is a gate that flakes on a loaded machine. */
    await p.waitForFunction(() => {
      try { const D = window.__eightDoc && window.__eightDoc();
            return !!(D && D.voices && D.voices.length); }
      catch (e) { return false; } }, null, { timeout: 20000 });
    await p.waitForTimeout(600);

    /* ---- stand in a SAMPLED chair's column sheet ----------------------
       The chant's own chairs are MODELLED (ahh_choir, solo_vox), and a
       modelled chair honestly gets two handles rather than four: `decay` and
       `sustain` are what the SAMPLER lane gained today, and drawing them on a
       chair whose engine has no port for them would be the declared-and-never-
       arriving bug drawn as a picture. So the gate seats a recording first —
       `sea_shore`, the crate instrument test/loopstrip.browser.js already
       proves the instrument menu offers — and E2 below seats a modelled one
       back and asks the other half of the claim. */
    await p.evaluate(SEATERS);
    const V = await p.evaluate(async () => {
      window.__eightTab("Band");
      await new Promise((r) => setTimeout(r, 400));
      const D = window.__eightDoc();
      const v = D.voices.find((x) => x.kind === "line") || D.voices[0];
      await window.__seat(v.name, () => "sea_shore");
      return v.name;
    });

    /* ---- E1 · the plate, the curve, the four handles ------------------ */
    const one = await p.evaluate(() => {
      /* THE ADSR IS ASKED FOR BY ITS OWN SEAT since the family grew to four
         modes (2026-09-05): `#pan-band .nu-envplate` also matches the EQ curve
         in the MIX row and the XY pad in this same sheet, and "exactly one
         plate" is a claim about the chair's ENVELOPE. `voiceEnv` seats it in
         `.nu-seatenv`, which is the address of that claim. */
      const plate = document.querySelector("#pan-band .nu-seatenv .nu-envplate");
      if (!plate) return null;
      const pr = plate.getBoundingClientRect();
      const hs = [...plate.querySelectorAll(".nu-envh")].map((h) => {
        const r = h.getBoundingClientRect();
        return { k: h.dataset.k, role: h.getAttribute("role"),
                 w: Math.round(r.width), h: Math.round(r.height),
                 ta: getComputedStyle(h).touchAction,
                 now: h.getAttribute("aria-valuenow"),
                 text: h.getAttribute("aria-valuetext"),
                 inside: r.left >= pr.left - 0.5 && r.right <= pr.right + 0.5 &&
                         r.top >= pr.top - 0.5 && r.bottom <= pr.bottom + 0.5 };
      });
      const d = (plate.querySelector(".nu-envcurve") || {}).getAttribute
        ? plate.querySelector(".nu-envcurve").getAttribute("d") : "";
      const says = [...document.querySelectorAll("#pan-band .nu-seatenv .nu-envsay")]
        .map((x) => x.textContent.replace(/\s+/g, " ").trim());
      return { plates: document.querySelectorAll("#pan-band .nu-seatenv .nu-envplate").length,
               ta: getComputedStyle(plate).touchAction,
               hs, d, pts: (d.match(/[MLQ]/g) || []).length, says,
               pw: Math.round(pr.width), ph: Math.round(pr.height) };
    });
    if (!one) { check(false, W + " · E1 no envelope plate is drawn in " + V + "'s sheet"); }
    else {
      const segs = one.hs.map((h) => (h.k || "").split("|").pop()).sort();
      check(one.plates === 1 && one.ta === "none" &&
            JSON.stringify(segs) === JSON.stringify(
              ["attack", "decay", "release", "sustain"]),
        W + " · E1 one plate, touch-action none, four named handles — " +
        JSON.stringify({ plates: one.plates, ta: one.ta, segs }));
      check(one.pts >= 4 && /Q/.test(one.d),
        W + " · E1 …with a REAL curve between them (" + one.pts +
        " path commands, and a curve among them)");
      check(one.hs.every((h) => h.w >= 44 && h.h >= 44 && h.ta === "none" &&
                                h.role === "slider" && h.inside),
        W + " · E1 …every handle is 44px, `role=slider`, touch-action none, " +
        "and INSIDE the plate — " + JSON.stringify(one.hs.map((h) =>
          [h.k.split("|").pop(), h.w + "x" + h.h, h.ta, h.inside])));
      check(one.says.length === one.hs.length && one.says.every((s) => /\d/.test(s)),
        W + " · E1 …and the value is printed beside each handle in the " +
        "field's own units — " + JSON.stringify(one.says));
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true });
        /* THE SHOT IS OF THE PLATE, which is a long way down a chair's sheet:
           a screenshot of the top of the panel is a picture of the panel, not
           of the thing this file is about. */
        await p.evaluate(() => { const pl =
          document.querySelector("#pan-band .nu-seatenv .nu-envplate");
          if (pl) pl.scrollIntoView({ block: "center" }); });
        await p.waitForTimeout(400);
        await p.screenshot({ path: path.join(SHOTS, "envelope-" + W + ".png"),
                             fullPage: false }); }
    }

    /* ---- E7 · nothing scrolls sideways -------------------------------- */
    const side = await p.evaluate(() => document.documentElement.scrollWidth -
                                        document.documentElement.clientWidth);
    check(side <= 1, W + " · E7 the page does not scroll sideways with the " +
      "plate open (" + side + "px)");

    /* ---- E3 · a thumb drag on the release handle ---------------------- */
    /* THE SCROLL HAPPENS FIRST AND IS ITS OWN ROUND TRIP. Measured the hour
       this was one `evaluate`: `scrollTo(0, 120)` put the handle at y = 1427 on
       a 900px page — the chair's sheet is a long way down a record with a band
       in it — so the CDP touch was dispatched a thousand pixels below the
       viewport, landed on nothing, and the TAP-OUTSIDE LAW closed the sheet.
       That read back as "the drag wrote nothing" about a control that works
       (proved separately: the same handle's ArrowRight writes `sound.rel`
       2.205 the first time it is asked). The handle is scrolled INTO VIEW and
       the rect measured after, in its own round trip; the page still has
       2,186px of scroll under it, so "it did not move under the finger" is
       still a claim about a page that could have moved. */
    await p.evaluate((n) => { const h = document.querySelector(
      '#pan-band .nu-envh[data-k="env|' + n + '|release"]');
      if (h) h.scrollIntoView({ block: "center" }); }, V);
    await p.waitForTimeout(400);
    const pre = await p.evaluate((n) => {
      const over = document.documentElement.scrollHeight - window.innerHeight;
      const h = document.querySelector(
        '#pan-band .nu-envh[data-k="env|' + n + '|release"]');
      if (!h) return null;
      const r = h.getBoundingClientRect();
      const plate = h.closest(".nu-envplate").getBoundingClientRect();
      const v = window.__eightDoc().voices.find((x) => x.name === n);
      return { x: r.x + r.width / 2, y: r.y + r.height / 2,
               left: plate.left + 24, scrollY: window.scrollY, over,
               before: (v.sound || {}).rel == null ? null : (v.sound || {}).rel,
               was: h.getAttribute("aria-valuenow") };
    }, V);
    if (!pre) check(false, W + " · E3 there is no release handle to drag");
    else {
      const cdp = await p.context().newCDPSession(p);
      const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", {
        type, touchPoints: type === "touchEnd" ? []
          : [{ x, y, radiusX: 8, radiusY: 8 }] });
      /* A DIAGONAL DRAG — the finger drifts 20px down while it travels, which
         is exactly the gesture a pan-steal takes from a handle. It goes LEFT,
         toward a shorter release, because the handle starts at the plate's
         right edge and there is nowhere right to go. */
      await touch("touchStart", pre.x, pre.y);
      for (let i = 1; i <= 12; i++)
        await touch("touchMove", pre.x + (pre.left - pre.x) * i / 12, pre.y + 1.6 * i);
      await touch("touchEnd", pre.left, pre.y + 20);
      await p.waitForTimeout(800);
      const post = await p.evaluate((n) => { const v =
        window.__eightDoc().voices.find((x) => x.name === n);
        const h = document.querySelector(
          '#pan-band .nu-envh[data-k="env|' + n + '|release"]');
        return { rel: (v.sound || {}).rel, scrollY: window.scrollY,
                 now: h ? h.getAttribute("aria-valuenow") : null,
                 said: h ? h.getAttribute("aria-valuetext") : null }; }, V);
      check(typeof post.rel === "number" && post.rel !== pre.before,
        W + " · E3 a thumb drag on the release handle writes voice.sound.rel " +
        "as a NUMBER — " + JSON.stringify(pre.before) + " -> " +
        JSON.stringify(post.rel) + " (" + post.said + ")");
      check(post.scrollY === pre.scrollY,
        W + " · E3 …and the page did not move a pixel under the finger: " +
        pre.scrollY + " -> " + post.scrollY +
        (pre.over > 0 ? " (page scrollable, " + pre.over + "px)"
                      : " (no overflow at this width — nothing to steal)"));
    }

    /* ---- E5 · the keyboard reaches it -------------------------------- */
    await p.evaluate((n) => { const h = document.querySelector(
      '#pan-band .nu-envh[data-k="env|' + n + '|attack"]'); if (h) h.focus(); }, V);
    const kbBefore = await p.evaluate((n) =>
      (window.__eightDoc().voices.find((x) => x.name === n).sound || {}).atk, V);
    await p.keyboard.press("ArrowRight");
    await p.waitForTimeout(600);
    const kb = await p.evaluate((n) =>
      (window.__eightDoc().voices.find((x) => x.name === n).sound || {}).atk, V);
    await p.evaluate((n) => { const h = document.querySelector(
      '#pan-band .nu-envh[data-k="env|' + n + '|attack"]'); if (h) h.focus(); }, V);
    await p.keyboard.press("End");
    await p.waitForTimeout(600);
    const kbEnd = await p.evaluate((n) =>
      (window.__eightDoc().voices.find((x) => x.name === n).sound || {}).atk, V);
    check(typeof kb === "number" && kb !== kbBefore,
      W + " · E5 ArrowRight on a focused handle writes the field (" +
      JSON.stringify(kbBefore) + " -> " + JSON.stringify(kb) + ")");
    check(typeof kbEnd === "number" && kbEnd > kb,
      W + " · E5 …and End goes to the field's own top (" + JSON.stringify(kbEnd) + ")");

    /* ---- E6 · reset, twice over -------------------------------------- */
    const cb = await p.evaluate((n) => { const b2 = document.querySelector(
      '#pan-band .nu-clearback[data-k="clear|env|' + n + '|attack"]');
      if (!b2) return false; b2.click(); return true; }, V);
    await p.waitForTimeout(700);
    const afterClear = await p.evaluate((n) =>
      (window.__eightDoc().voices.find((x) => x.name === n).sound || {}).atk, V);
    check(cb && afterClear === undefined,
      W + " · E6 the clear-back beside the printed number returns the field to " +
      "ABSENT — the key deleted, not set to a default (" +
      JSON.stringify(afterClear) + ")");

    /* ...AND THE LONG PRESS, which is the touch affordance the dead double-tap
       had to be replaced with (the spike measured 0 dblclick events at 60, 120,
       200 and 300 ms gaps). 700ms > the component's own 600. */
    await p.evaluate((n) => { const h = document.querySelector(
      '#pan-band .nu-envh[data-k="env|' + n + '|release"]');
      if (h) h.dispatchEvent(new PointerEvent("pointerdown",
        { bubbles: true, pointerId: 9, clientX: 10, clientY: 10 })); }, V);
    await p.waitForTimeout(900);
    const held = await p.evaluate((n) =>
      (window.__eightDoc().voices.find((x) => x.name === n).sound || {}).rel, V);
    check(held === undefined,
      W + " · E6 …and a LONG PRESS on the handle does the same (rel is " +
      JSON.stringify(held) + "); double-tap is not offered, because on touch " +
      "it does not exist");

    /* ---- E2 · a modelled chair, and the knob rows it replaced --------- */
    const mod = await p.evaluate(async ({ n }) => {
      /* WHICH MODELLED CHAIR IS ASKED OF THE PAGE, not named here. A fixture
         that named `juno60` measured "the menu does not offer it" on the chant
         and reported the round unmeasurable; the honest question is "any
         instrument this menu offers that nukernel/knobs.js has two or more
         envelope rows for", which is exactly the condition `envSpecFor` draws
         the modelled editor under. */
      const K = (window.NuKnobs || {}).voices || {};
      const want = await window.__seat(n, (offers) => offers
        .find((id) => { const V2 = K[id];
          return V2 && (V2.rows || []).filter((r) =>
            ["attack", "decay", "sustain", "release"].includes(r.key) &&
            r.kind === "number").length >= 2; }) || null);
      const has = !!want;
      const segs = [...document.querySelectorAll("#pan-band .nu-seatenv .nu-envh")]
        .map((x) => (x.dataset.k || "").split("|").pop());
      /* THE ROWS THE EDITOR TOOK: `knobsBlock` draws each key as a range with
         `data-k = "<key>#<voice>"`-shaped ids and a clear at
         `clear|<voice>|<key>`; the honest reading is the knob TABLE's own row
         labels, which is what a hand sees. */
      const labs = [...document.querySelectorAll("#pan-band table.nu-knobs th")]
        .map((x) => (x.textContent || "").trim().toLowerCase());
      return { seated: true, has,
        instr: window.__eightDoc().voices.find((x) => x.name === n).instrument,
        segs, labs,
        plates: document.querySelectorAll("#pan-band .nu-seatenv .nu-envplate").length };
    }, { n: V });
    if (!mod.seated || !mod.has) {
      check(false, W + " · E2 the instrument menu offers no modelled chair with " +
        "two or more measured envelope rows — the modelled half of the claim " +
        "is unmeasurable on this record");
    } else {
      check(mod.plates === 1 && mod.segs.length >= 2,
        W + " · E2 a MODELLED chair (" + mod.instr + ") draws the same one plate — " +
        JSON.stringify({ instr: mod.instr, plates: mod.plates, segs: mod.segs }));
      const taken = mod.segs.filter((sg) => mod.labs.includes(sg));
      check(taken.length === 0,
        W + " · E2 …and the knob table no longer draws a slider for any key " +
        "the curve took (§11's nothing-lost: the numbers print beside the " +
        "handles) — overlap " + JSON.stringify(taken) + ", knob rows " +
        JSON.stringify(mod.labs.slice(0, 12)));
    }

    /* ================= X · THE XY PAD ================================
       Same sheet, one row down from the envelope: `knobsBlock` draws the pad
       over the knob table on any chair whose MEASURED census has a cutoff and
       a resonance. Which chair that is is asked of the page (`__xyChair`),
       never named here. */
    const xy = await p.evaluate(async ({ n }) => {
      const id = await window.__seat(n, (offers) => window.__xyChair(offers));
      if (!id) return { has: false };
      const rows = window.__xyKeys(id);
      const plate = document.querySelector("#pan-band .nu-xyplate");
      if (!plate) return { has: true, id, rows, drawn: false };
      const pr = plate.getBoundingClientRect();
      const hs = [...plate.querySelectorAll(".nu-envh")].map((x) => {
        const r = x.getBoundingClientRect();
        return { k: x.dataset.k, role: x.getAttribute("role"),
                 ta: getComputedStyle(x).touchAction,
                 w: Math.round(r.width), h: Math.round(r.height),
                 now: x.getAttribute("aria-valuenow"),
                 text: x.getAttribute("aria-valuetext"),
                 inside: r.left >= pr.left - 0.5 && r.right <= pr.right + 0.5 &&
                         r.top >= pr.top - 0.5 && r.bottom <= pr.bottom + 0.5 }; });
      /* T7, THE fm2op PATTERN (test/knobs.js check 4): a COUNT alone would
         pass if the rows had simply been deleted, so what is asserted is the
         MOVE — the knob table's own addresses, the envelope curve's handles
         and the pad's two axes together are the instrument's whole measured
         census, read off nukernel/knobs.js rather than typed here. */
      const addr = (k) => String(k || "").split("#")[0];
      const tbl = [...document.querySelectorAll("#pan-band table.nu-knobs input, " +
        "#pan-band table.nu-knobs select")].map((c) => addr(c.dataset.k));
      const sel = [...document.querySelectorAll("#pan-band table.nu-knobs [data-sel]")]
        .map((c) => String(c.dataset.sel || "").split("|")[0]);
      const env = [...document.querySelectorAll("#pan-band .nu-seatenv .nu-envh")]
        .map((c) => (c.dataset.k || "").split("|").pop());
      const pad = [rows.x.key, rows.y.key];
      return { has: true, id, rows, drawn: true, hs, tbl, sel, env, pad,
        pads: document.querySelectorAll("#pan-band .nu-xyplate").length,
        cross: plate.querySelectorAll(".nu-xycross").length,
        ta: getComputedStyle(plate).touchAction,
        says: [...document.querySelectorAll("#pan-band .nu-xybox .nu-envsay")]
          .map((x) => x.textContent.replace(/\s+/g, " ").trim()),
        oldRows: tbl.filter((k) => pad.indexOf(k) >= 0) };
    }, { n: V });
    if (!xy.has) {
      check(false, W + " · X1 the instrument menu offers no modelled chair " +
        "with a measured cutoff AND a resonance — the pad is unmeasurable " +
        "on this record");
    } else if (!xy.drawn) {
      check(false, W + " · X1 " + xy.id + " has both halves in knobs.js and " +
        "draws no XY pad");
    } else {
      check(xy.pads === 1 && xy.hs.length === 1 &&
            xy.hs[0].k === "xy|" + V && xy.ta === "none" && xy.cross === 2,
        W + " · X1 " + xy.id + " draws ONE pad with ONE handle at `xy|" + V +
        "`, touch-action none, and two crosshairs — " +
        JSON.stringify({ pads: xy.pads, k: xy.hs[0].k, ta: xy.ta, cross: xy.cross }));
      check(xy.hs.every((h) => h.w >= 44 && h.h >= 44 && h.ta === "none" &&
                               h.role === "slider" && h.inside),
        W + " · X1 …the handle is 44px, `role=slider`, touch-action none and " +
        "INSIDE the plate — " + JSON.stringify(xy.hs.map((h) =>
          [h.w + "x" + h.h, h.ta, h.role, h.inside])));
      check(xy.says.length === 2 && xy.says.every((t2) => /\d/.test(t2)) &&
            /Hz|kHz/.test(xy.says.join(" ")),
        W + " · X2 …and BOTH numbers print beside it in their own units — " +
        JSON.stringify(xy.says));
      check(xy.oldRows.length === 0,
        W + " · X2 …and the knob table draws no slider for either key the pad " +
        "took (§11's nothing-lost) — overlap " + JSON.stringify(xy.oldRows));
      /* the census, off the page's own table */
      const census = await p.evaluate((id) =>
        ((window.NuKnobs || {}).voices || {})[id].rows.map((r) => r.key).sort(), xy.id);
      const owned = [...xy.tbl, ...xy.sel, ...xy.env, ...xy.pad]
        .filter((x2) => census.indexOf(x2) >= 0);
      const missing = census.filter((k) => owned.indexOf(k) < 0);
      check(missing.length === 0,
        W + " · X2 …and the three owners together are " + xy.id + "'s WHOLE " +
        "measured census (" + census.length + " rows: table " + xy.tbl.length +
        " · curve " + xy.env.length + " · pad 2) — nothing lost, " +
        JSON.stringify({ missing }));
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true });
        await p.evaluate(() => { const pl =
          document.querySelector("#pan-band .nu-xyplate");
          if (pl) pl.scrollIntoView({ block: "center" }); });
        await p.waitForTimeout(400);
        await p.screenshot({ path: path.join(SHOTS, "xypad-" + W + ".png"),
                             fullPage: false }); }
    }

    /* ---- X3 · the keyboard reaches both axes on one handle ---------- */
    if (xy.has && xy.drawn) {
      const kb = await p.evaluate(async ({ n, xk, yk }) => {
        const setOf = () => ({ ...(window.__eightDoc().voices
          .find((x) => x.name === n).set || {}) });
        const before = setOf();
        await window.__key("xy|" + n, "End");
        const atEnd = setOf();
        await window.__key("xy|" + n, "ArrowUp", true);
        const up = setOf();
        await window.__key("xy|" + n, "Backspace");
        const cleared = setOf();
        const h = document.querySelector('.nu-envh[data-k="xy|' + n + '"]');
        return { before, atEnd, up, cleared, xk, yk,
                 said: h ? h.getAttribute("aria-valuetext") : null };
      }, { n: V, xk: xy.rows.x.key, yk: xy.rows.y.key });
      check(kb.atEnd[kb.xk] === xy.rows.x.max,
        W + " · X3 End on the pad's handle writes the CUTOFF to the row's own " +
        "measured top (" + JSON.stringify(kb.before[kb.xk]) + " -> " +
        JSON.stringify(kb.atEnd[kb.xk]) + " of " + xy.rows.x.max + ")");
      check(typeof kb.up[kb.yk] === "number" &&
            kb.up[kb.yk] > (kb.atEnd[kb.yk] == null ? xy.rows.y.derived
                                                    : kb.atEnd[kb.yk]),
        W + " · X3 …and Shift+ArrowUp writes the RESONANCE up the other axis " +
        "of the same handle (" + JSON.stringify(kb.atEnd[kb.yk]) + " -> " +
        JSON.stringify(kb.up[kb.yk]) + ")");
      check(kb.cleared[kb.xk] === undefined && kb.cleared[kb.yk] === undefined,
        W + " · X3 …and Backspace on it returns BOTH to ABSENT — the keys " +
        "deleted, not zeroed (" + JSON.stringify(kb.cleared) + ")");
    }

    /* ================= Q · THE EQ CURVE ==============================
       The voice's `mix` facet, which is ui/engineer.js's own channel strip
       seated in the MIX row. Opened LAST at each width because it is a
       different row of the table and the sheet above is what E1..X3 measured. */
    const eq = await p.evaluate(async ({ n }) => {
      await window.__mix(n);
      const plate = document.querySelector("#pan-band .nu-eqplate");
      if (!plate) return { drawn: false,
        keys: [...document.querySelectorAll("#pan-band [data-k]")]
          .map((x) => x.dataset.k).filter((k) => /eq/.test(k || "")).slice(0, 8) };
      const pr = plate.getBoundingClientRect();
      const hs = [...plate.querySelectorAll(".nu-envh")].map((x) => {
        const r = x.getBoundingClientRect();
        return { k: x.dataset.k, role: x.getAttribute("role"),
                 ta: getComputedStyle(x).touchAction,
                 w: Math.round(r.width), h: Math.round(r.height),
                 text: x.getAttribute("aria-valuetext"),
                 inside: r.left >= pr.left - 0.5 && r.right <= pr.right + 0.5 &&
                         r.top >= pr.top - 0.5 && r.bottom <= pr.bottom + 0.5 }; });
      /* THE PLATE IS RE-QUERIED FOR EVERY READING. A key press ends in
         `setDesk` -> `ctx.changed()`, which rebuilds the whole strip: the node
         this function was handed is DETACHED a moment later, its curve still
         drawn as it was, and `getComputedStyle` on it answers "" for every
         property. Both were measured as red checks about a control that works
         — "touch-action is ''" on a plate whose own stylesheet sets it to
         none, and "the curve did not move" about a curve that had. */
      const dOf = () => { const pl = document.querySelector("#pan-band .nu-eqplate");
        const q = pl && pl.querySelector(".nu-envcurve");
        return q ? q.getAttribute("d") : ""; };
      const ta = getComputedStyle(plate).touchAction;
      /* THE CURVE MUST ANSWER THE HANDLE. Read before, one key press, read
         after: the path changes AND the shape it changes into is not a
         straight line — a plate whose picture ignores its own control is the
         same bug as a control that reaches no sound, one layer up. */
      const before = dOf();
      await window.__key("b|eqhi|" + n, "End");
      const after = dOf();
      const ys = (after.match(/[ML] [\d.]+ ([\d.]+)/g) || [])
        .map((m2) => +m2.split(" ")[2]);
      return { drawn: true, hs, before, after,
        plates: document.querySelectorAll("#pan-band .nu-eqplate").length,
        ta,
        pts: (after.match(/[ML]/g) || []).length,
        bend: ys.length ? +(Math.max(...ys) - Math.min(...ys)).toFixed(1) : 0,
        sliders: [...document.querySelectorAll('input[data-k^="b|eq"]')]
          .map((x) => x.dataset.k),
        says: [...document.querySelectorAll("#pan-band .nu-eqbox .nu-envsay")]
          .map((x) => x.textContent.replace(/\s+/g, " ").trim()) };
    }, { n: V });
    if (!eq.drawn) {
      check(false, W + " · Q1 the voice's mix facet draws no EQ curve — " +
        JSON.stringify(eq.keys));
    } else {
      const want = ["b|eqlo|" + V, "b|eqmid|" + V, "b|eqhi|" + V];
      check(eq.plates === 1 && eq.ta === "none" &&
            JSON.stringify(eq.hs.map((h) => h.k)) === JSON.stringify(want),
        W + " · Q1 one EQ plate, touch-action none, three handles AT THE " +
        "ADDRESSES THE THREE SLIDERS WORE — " +
        JSON.stringify({ plates: eq.plates, ta: eq.ta, ks: eq.hs.map((h) => h.k) }));
      check(eq.hs.every((h) => h.w >= 44 && h.h >= 44 && h.ta === "none" &&
                               h.role === "slider" && h.inside),
        W + " · Q1 …every band handle is 44px, `role=slider`, touch-action " +
        "none and INSIDE the plate — " + JSON.stringify(eq.hs.map((h) =>
          [h.k.split("|")[1], h.w + "x" + h.h, h.ta, h.inside])));
      check(eq.sliders.length === 0 && eq.says.length === 3 &&
            eq.says.every((t2) => /dB/.test(t2)),
        W + " · Q2 …the three vertical sliders are GONE and the numbers " +
        "print beside the curve in dB — " + JSON.stringify(eq.says) +
        ", sliders left " + JSON.stringify(eq.sliders));
      check(eq.pts >= 20 && eq.after !== eq.before && eq.bend > 12,
        W + " · Q3 …and the CURVE ANSWERS THE HANDLE: " + eq.pts +
        " path points, the path moved under one key press, and the drawn " +
        "shape spans " + eq.bend + "px of the plate rather than being a line");
      const side2 = await p.evaluate(() => document.documentElement.scrollWidth -
                                           document.documentElement.clientWidth);
      check(side2 <= 1, W + " · E7 …and the page still does not scroll " +
        "sideways with the EQ curve open (" + side2 + "px)");
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true });
        await p.evaluate(() => { const pl =
          document.querySelector("#pan-band .nu-eqplate");
          if (pl) pl.scrollIntoView({ block: "center" }); });
        await p.waitForTimeout(400);
        await p.screenshot({ path: path.join(SHOTS, "eqcurve-" + W + ".png"),
                             fullPage: false }); }

      /* ---- Q4 · A HAND ON A BAND MOVES WHAT THE ENGINE IS HANDED ---- */
      const reach = await p.evaluate(async ({ n }) => {
        /* FROM ABSENT, AND BACK TO ABSENT. The reading starts with a
           clear-back rather than with whatever the genre dealt this chair
           (`precompose deskThe` writes an `eq.lo` on some of them), so
           "putting it back puts the engine's number back" is a claim about
           one spelling of flat and not about a number the record happened to
           carry. */
        await window.__key("b|eqlo|" + n, "Backspace");
        const b0 = window.__eqOnUnits();
        await window.__key("b|eqlo|" + n, "End");
        const b1 = window.__eqOnUnits();
        await window.__key("b|eqlo|" + n, "Backspace");
        const b2 = window.__eqOnUnits();
        return { b0, b1, b2 };
      }, { n: V });
      const moved = reach.b0 && reach.b1
        ? Object.keys(reach.b1).filter((k) => reach.b1[k] !== reach.b0[k]) : [];
      check(moved.length > 0,
        W + " · Q4 A HAND ON THE LOW BAND MOVES THE NUMBER THE ENGINE IS " +
        "HANDED — `__nuMix().units[].strip` on " + JSON.stringify(moved) +
        ": " + JSON.stringify(moved.map((k) => reach.b0[k])) + " -> " +
        JSON.stringify(moved.map((k) => reach.b1[k])));
      check(moved.length > 0 &&
            moved.every((k) => reach.b2 && reach.b2[k] === reach.b0[k]),
        W + " · Q4 …and clearing the band puts the engine's own number back " +
        "exactly — absent is the only spelling of flat (" +
        JSON.stringify(moved.map((k) => reach.b2 && reach.b2[k])) + ")");
    }

    await p.close();
  }

  /* ================= E4 · THE RENDERED TAIL ==========================
     The measurement the whole round turns on, and it reads PCM. A short
     release and a long one on the same chair of the same record, each pressed
     through nukernel/export/_satpress.js `pressFloat` — the float twin of the
     WAV export, which is the page's own renderer and not a second engine —
     and the energy in the last half second compared. */
  {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    p.on("pageerror", (e) => errs.push("press pageerror: " + e.message));
    await p.goto(PAGE + CHANT, { waitUntil: "load" });
    await p.waitForTimeout(3000);
    /* THE CHAIR MUST BE A RECORDING FOR THIS TO BE A CLAIM ABOUT THE SAMPLER.
       Measured first without this: the chant's chairs are MODELLED, `rel` on
       them rides `synthRecipe` and not `samplerVox`, and both presses came back
       byte-identical (0.102342 RMS either way) — a true reading of the wrong
       subject. `sea_shore` is the crate instrument the menu offers, seated
       through the page's own combo. */
    await p.evaluate(INSTALL);
    await p.evaluate(SEATERS);
    await p.evaluate(async () => {
      window.__eightTab("Band");
      await new Promise((r) => setTimeout(r, 400));
      const D = window.__eightDoc();
      for (const v of D.voices.filter((x) => x.kind === "line")) {
        await window.__seat(v.name, (offers) =>
          offers.indexOf("sea_shore") >= 0 ? "sea_shore" : null);
        await window.__col(v.name, "false");
      }
    });
    await p.waitForTimeout(1200);
    /* AND THE RELEASE IS WRITTEN THROUGH THE HANDLE, NOT ONTO THE DOCUMENT.
       Measured, and it is this repo's oldest trap said in a new place: the
       press reads `ui/state.js`'s SONG, and the document becomes the song at
       `push()` — so a gate that assigned `voice.sound.rel` and pressed got the
       SAME BYTES twice and would have reported the engine dead on a wire that
       works. Every value below travels the way a thumb sends it: focus the
       chair's own release handle, press Home (the field's floor) or End (its
       ceiling), which is one document write through `spec.set` -> `changed()`
       -> `push()` -> the recompile. */
    const tail = await p.evaluate(async () => {
      const M = await import("/nukernel/export/_satpress.js");
      const out = [];
      const key = async (k) => { const h = document.querySelector(
        '#pan-band .nu-envh[data-k="' + k + '"]');
        if (!h) return false;
        h.focus();
        h.dispatchEvent(new KeyboardEvent("keydown",
          { key: "End", bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 600));
        return true; };
      const press = async (which) => {
        const D = window.__eightDoc();
        for (const v of D.voices.filter((x) => x.kind === "line")) {
          const h = document.querySelector('#pan-band [data-k="tcol|' + v.name + '"]');
          if (h && h.getAttribute("aria-expanded") !== "true") h.click();
          await new Promise((r) => setTimeout(r, 400));
          const kk = "env|" + v.name + "|release";
          const el = document.querySelector('#pan-band .nu-envh[data-k="' + kk + '"]');
          if (el) { el.focus();
            el.dispatchEvent(new KeyboardEvent("keydown",
              { key: which, bubbles: true, cancelable: true }));
            await new Promise((r) => setTimeout(r, 700)); }
          const h2 = document.querySelector('#pan-band [data-k="tcol|' + v.name + '"]');
          if (h2 && h2.getAttribute("aria-expanded") === "true") h2.click();
          await new Promise((r) => setTimeout(r, 250));
        }
        return window.__eightDoc().voices.filter((x) => x.kind === "line")
          .map((x) => (x.sound || {}).rel);
      };
      void key;
      for (const which of ["Home", "End"]) {
        const rels = await press(which);
        const rel = rels[0];
        await new Promise((r) => setTimeout(r, 400));
        const t = await M.pressFloat({ maxBars: 2 });
        const L = t.L, n = L.length, sr = 44100;
        const win = Math.min(n, Math.floor(0.5 * sr));
        let e = 0; for (let i = n - win; i < n; i++) e += L[i] * L[i];
        out.push({ which, rel, rels, frames: n,
                   sampled: window.__eightDoc().voices
                     .filter((v) => v.instrument === "sea_shore").length,
                   tail: +Math.sqrt(e / win).toFixed(6) });
      }
      return out;
    });
    const [shortR, longR] = tail;
    /* THE BAR IS 1.10x AND THE REASON IS A MEASUREMENT, not a taste. A press
       is deterministic: the same document at the same seed renders the same
       bytes, and the two earlier spellings of this check — one that assigned
       the document instead of writing through the page, one that measured a
       record whose chairs are modelled — both returned a ratio of EXACTLY
       1.000000 (0.102342 vs 0.102342; 0.009444 vs 0.009444). So the noise
       floor of "nothing arrived" is zero, and any clear movement is arrival.
       What a whole release actually buys here is x1.21 (+1.7 dB) in the last
       half second of a two-bar press of a three-chair record — the window
       holds the room and the buses as well as the chair, so the chair's own
       tail is a share of it and not the whole of it. */
    check(longR.tail > shortR.tail * 1.10,
      "E4 THE RENDERED TAIL LENGTHENS WITH THE RELEASE — every sampled chair's " +
      "release handle sent to its floor and then to its ceiling THROUGH THE " +
      "PAGE, and the last half second of the page's own float press carries " +
      shortR.tail + " RMS at rel " + JSON.stringify(shortR.rels) + " and " +
      longR.tail + " at rel " + JSON.stringify(longR.rels) + " (x" +
      (shortR.tail > 0 ? (longR.tail / shortR.tail).toFixed(1) : "inf") +
      ", " + longR.sampled + " sampled chairs)");
    await p.close();
  }

  /* ============ X4 · THE PAD REACHES THE RENDERED PCM ================
     The measurement the XY half turns on, and it reads PCM for the same
     reason E4 does: `nukernel/knobs.js` says a probe once moved a parameter
     called `cutoff`, and a parameter moving is not a sound moving. Both axes
     are driven THROUGH THE PAGE — focus the pad's own handle and press a key,
     which is one write through `spec.set` -> `changed()` -> `push()` -> the
     recompile — and the page's own float press (`export/_satpress.js
     pressFloat`, the float twin of the WAV export) is read after each.

     TWO NUMBERS OFF THE SAME RENDER: `rms` is how much got through and `hf`
     is the RMS of the first difference, which is a +6 dB/octave highpass and
     so is how BRIGHT it is. A lowpass moved from 60 Hz to its ceiling changes
     the first; a resonance moved with the cutoff untouched changes both, and
     the cutoff being untouched is asserted rather than assumed. */
  {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    p.on("pageerror", (e) => errs.push("xy press pageerror: " + e.message));
    await p.goto(PAGE + CHANT, { waitUntil: "load" });
    await p.waitForTimeout(2500);
    await p.evaluate(INSTALL);
    await p.evaluate(SEATERS);
    const seated = await p.evaluate(async () => {
      window.__eightTab("Band");
      await new Promise((r) => setTimeout(r, 500));
      const out = [];
      for (const v of window.__eightDoc().voices.filter((x) => x.kind === "line")) {
        const id = await window.__seat(v.name, (o) => window.__xyChair(o));
        if (id) out.push([v.name, id]);
        await window.__col(v.name, "false");
      }
      return out;
    });
    if (!seated.length) {
      check(false, "X4 no chair on this record can be seated with both halves " +
        "of the pad — the XY arrival is unmeasurable here");
    } else {
      const pcm = await p.evaluate(async ({ names }) => {
        const M = await import("/nukernel/export/_satpress.js");
        /* HOW LOUD AND HOW BRIGHT, off one render. */
        const read = (L) => { let e = 0, d = 0;
          for (let i = 1; i < L.length; i++) {
            e += L[i] * L[i]; const x = L[i] - L[i - 1]; d += x * x; }
          return { rms: +Math.sqrt(e / L.length).toFixed(6),
                   hf: +Math.sqrt(d / L.length).toFixed(6) }; };
        const drive = async (which, n, shift) => {
          for (const name of names) {
            await window.__col(name, "true");
            /* ONLY THE LAST PRESS OF A SWEEP WAITS FOR THE RECOMPILE. The
               ones before it are the same write again with a bigger number,
               and 36 full settles per chair is four minutes of a gate waiting
               for bars nobody reads. */
            for (let i = 0; i < n; i++) {
              if (!(await window.__key("xy|" + name, which, shift,
                                       i === n - 1 ? 700 : 130))) break; }
            await window.__col(name, "false");
          }
          await new Promise((r) => setTimeout(r, 500));
          const t = await M.pressFloat({ maxBars: 2 });
          const sets = names.map((name) => window.__eightDoc().voices
            .find((v) => v.name === name).set || {});
          return { ...read(t.L), cut: sets.map((x) => x.cutoff),
                   res: sets.map((x) => x.res == null ? x.resonance : x.res) };
        };
        const shut = await drive("Home", 1);              // cutoff to its floor
        const open = await drive("End", 1);               // ...and to its ceiling
        /* now the RESONANCE, with the cutoff left exactly where "End" put it */
        const dry = await drive("ArrowDown", 12, true);
        const wet = await drive("ArrowUp", 24, true);
        return { shut, open, dry, wet };
      }, { names: seated.map(([n]) => n) });
      check(pcm.open.rms > pcm.shut.rms * 1.5,
        "X4 THE CUTOFF REACHES THE RENDER — every pad's handle sent to its " +
        "floor and then its ceiling THROUGH THE PAGE, and the page's own " +
        "float press carries " + pcm.shut.rms + " RMS at cutoff " +
        JSON.stringify(pcm.shut.cut) + " and " + pcm.open.rms + " at " +
        JSON.stringify(pcm.open.cut) + " (x" +
        (pcm.shut.rms > 0 ? (pcm.open.rms / pcm.shut.rms).toFixed(1) : "inf") +
        ", " + seated.length + " chairs: " + JSON.stringify(seated) + ")");
      const sameCut = JSON.stringify(pcm.dry.cut) === JSON.stringify(pcm.wet.cut);
      check(sameCut && (pcm.wet.rms !== pcm.dry.rms || pcm.wet.hf !== pcm.dry.hf),
        "X4 …AND SO DOES THE RESONANCE, on the OTHER axis of the same handle " +
        "with the cutoff untouched (" + JSON.stringify(pcm.dry.cut) + "): res " +
        JSON.stringify(pcm.dry.res) + " renders " + pcm.dry.rms + " RMS / " +
        pcm.dry.hf + " bright, res " + JSON.stringify(pcm.wet.res) + " renders " +
        pcm.wet.rms + " / " + pcm.wet.hf);
    }
    await p.close();
  }

  check(errs.length === 0, "E0 no page or console error across all of it" +
    (errs.length ? " — " + JSON.stringify(errs.slice(0, 4)) : ""));

  await b.close();
  if (srv) srv.proc.kill();
  console.log("\n" + (fails.length ? "FAILED " + fails.length : "PASSED") +
              " (" + notes.length + " ok)");
  for (const f of fails) console.log("  · " + f);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
