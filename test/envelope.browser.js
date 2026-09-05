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
 *   E7  NOTHING OVERHANGS AND NOTHING SCROLLS SIDEWAYS at 320 and 390. A 44px
 *       handle at a plate's edge overhangs by 22 — measured on AUX's own chart
 *       — so every handle's box must be inside the plate's box.
 *   E0  zero pageerror, zero console error across all of it.
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

  for (const vw of [{ width: 390, height: 900 }, { width: 320, height: 700 }]) {
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
    const V = await p.evaluate(async () => {
      window.__eightTab("Band");
      await new Promise((r) => setTimeout(r, 400));
      const D = window.__eightDoc();
      const v = D.voices.find((x) => x.kind === "line") || D.voices[0];
      const h = document.querySelector('#pan-band [data-k="tcol|' + v.name + '"]');
      if (h && h.getAttribute("aria-expanded") !== "true") h.click();
      await new Promise((r) => setTimeout(r, 450));
      const sel = document.querySelector('[data-k="sel|sound.instrument|' + v.name + '"]');
      if (sel && window.__combo.words(sel).some((o) => o.v === "sea_shore"))
        window.__combo.say(sel, "sea_shore");
      await new Promise((r) => setTimeout(r, 900));
      const h2 = document.querySelector('#pan-band [data-k="tcol|' + v.name + '"]');
      if (h2 && h2.getAttribute("aria-expanded") !== "true") h2.click();
      await new Promise((r) => setTimeout(r, 500));
      return v.name;
    });

    /* ---- E1 · the plate, the curve, the four handles ------------------ */
    const one = await p.evaluate(() => {
      const plate = document.querySelector("#pan-band .nu-envplate");
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
      const says = [...document.querySelectorAll("#pan-band .nu-envsay")]
        .map((x) => x.textContent.replace(/\s+/g, " ").trim());
      return { plates: document.querySelectorAll("#pan-band .nu-envplate").length,
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
          document.querySelector("#pan-band .nu-envplate");
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
      const sel = document.querySelector('[data-k="sel|sound.instrument|' + n + '"]');
      if (!sel) return { seated: false };
      /* WHICH MODELLED CHAIR IS ASKED OF THE PAGE, not named here. A fixture
         that named `juno60` measured "the menu does not offer it" on the chant
         and reported the round unmeasurable; the honest question is "any
         instrument this menu offers that nukernel/knobs.js has two or more
         envelope rows for", which is exactly the condition `envSpecFor` draws
         the modelled editor under. */
      const K = (window.NuKnobs || {}).voices || {};
      const want = window.__combo.words(sel)
        .map((o) => o.v)
        .find((id) => { const V2 = K[id];
          return V2 && (V2.rows || []).filter((r) =>
            ["attack", "decay", "sustain", "release"].includes(r.key) &&
            r.kind === "number").length >= 2; });
      const has = !!want;
      if (has) window.__combo.say(sel, want);
      await new Promise((r) => setTimeout(r, 900));
      const h2 = document.querySelector('#pan-band [data-k="tcol|' + n + '"]');
      if (h2 && h2.getAttribute("aria-expanded") !== "true") h2.click();
      await new Promise((r) => setTimeout(r, 500));
      const segs = [...document.querySelectorAll("#pan-band .nu-envh")]
        .map((x) => (x.dataset.k || "").split("|").pop());
      /* THE ROWS THE EDITOR TOOK: `knobsBlock` draws each key as a range with
         `data-k = "<key>#<voice>"`-shaped ids and a clear at
         `clear|<voice>|<key>`; the honest reading is the knob TABLE's own row
         labels, which is what a hand sees. */
      const labs = [...document.querySelectorAll("#pan-band table.nu-knobs th")]
        .map((x) => (x.textContent || "").trim().toLowerCase());
      return { seated: true, has,
        instr: window.__eightDoc().voices.find((x) => x.name === n).instrument,
        segs, labs, plates: document.querySelectorAll("#pan-band .nu-envplate").length };
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
    await p.evaluate(async () => {
      window.__eightTab("Band");
      await new Promise((r) => setTimeout(r, 400));
      const D = window.__eightDoc();
      for (const v of D.voices.filter((x) => x.kind === "line")) {
        const h = document.querySelector('#pan-band [data-k="tcol|' + v.name + '"]');
        if (h && h.getAttribute("aria-expanded") !== "true") h.click();
        await new Promise((r) => setTimeout(r, 350));
        const sel = document.querySelector(
          '[data-k="sel|sound.instrument|' + v.name + '"]');
        if (sel && window.__combo.words(sel).some((o) => o.v === "sea_shore"))
          window.__combo.say(sel, "sea_shore");
        await new Promise((r) => setTimeout(r, 700));
        const h2 = document.querySelector('#pan-band [data-k="tcol|' + v.name + '"]');
        if (h2 && h2.getAttribute("aria-expanded") === "true") h2.click();
        await new Promise((r) => setTimeout(r, 250));
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

  check(errs.length === 0, "E0 no page or console error across all of it" +
    (errs.length ? " — " + JSON.stringify(errs.slice(0, 4)) : ""));

  await b.close();
  if (srv) srv.proc.kill();
  console.log("\n" + (fails.length ? "FAILED " + fails.length : "PASSED") +
              " (" + notes.length + " ok)");
  for (const f of fails) console.log("  · " + f);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
