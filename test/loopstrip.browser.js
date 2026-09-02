#!/usr/bin/env node
/* test/loopstrip.browser.js — THE LOOP STRIP, READ OFF THE RENDERED PAGE.
 *
 * (Paul, 2026-08-30: "add loop points and make them editable." Memory:
 * "TEST THE ARTIFACT — three features shipped broken while every check
 * passed"; "six params declared, costed and reaching no sound; measure,
 * never trust a slider".)
 *
 * A two-handle horizontal strip is a scroll-steal magnet, so the drags below
 * are REAL CDP touch sequences against the shipped page at BOTH widths the
 * design must hold at — 320 and 1280 — and every fact is read back off the
 * DOCUMENT the page edits (window.__eightDoc), never off the widget's own
 * state. What is asserted, per width:
 *
 *   S1  the crate is seatable through the same dropdown every instrument
 *       uses: the voice's `sound.instrument` <select> OFFERS "sea_shore",
 *       and choosing it draws EXACTLY ONE .nu-loop strip on the panel.
 *   S2  nothing greys silently, in the only direction this control has: on
 *       a modelled chair (solo_vox) there is NO loop editor at all — not a
 *       grey one — and it appears when the chair becomes sampled.
 *   S3  THE TOUCH LAW: a real diagonal touch drag on the strip moves the
 *       nearest handle — voice.sound.loopout lands within 0.08 of where the
 *       finger stopped, as a NUMBER — and window.scrollY does not move a
 *       pixel under it (the page is scrolled somewhere it could move first,
 *       when it can move at all). touch-action on the strip is "none", on
 *       the control and only the control.
 *   S4  the native inputs are the keyboard channel: ArrowRight on the
 *       focused (opacity-0, pointer-events-none) range writes loopin 0.01
 *       to the document.
 *   S5  the looping word cycles — (zone's own) -> loops -> one-shot -> back
 *       — through voice.sound.looping, and ↺ puts stated points back to
 *       ABSENT (the keys deleted, not set to 0/1).
 *   S6  nothing scrolls sideways at 320, and the page raises no errors.
 *
 * RUN:  NODE_PATH=/home/ford/ftrain-2025/node_modules node test/loopstrip.browser.js
 */
"use strict";
const CHANT = "#at=Rome&y=600&s=1";   // the shipped chant, named (2026-09-02)
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
  const PAGE = PAGE_ARG ||
    ("http://localhost:" + srv.port + "/nukernel/index.html");
  const b = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required"] });

  for (const vw of [{ width: 320, height: 700 }, { width: 1280, height: 900 }]) {
    const W = vw.width;
    const p = await b.newPage({ viewport: vw, hasTouch: true });
    const errs = [];
    p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
    p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
    /* ===== THE BOX BOOTS ON THE BLANK STATE NOW (2026-09-02) ================
       Paul, the composer round: *"Add a 'silence' genre at the top of the genre
       list. This is a blank state."* The box opens on `silence` — one eight-bar
       section, ZERO voices, one cell of rests — instead of on a copy of the
       shipped chant, because a box that opened playing somebody else's record was
       answering a question nobody had asked yet.
       THIS GATE IS ABOUT A RECORD WITH A BAND IN IT, so it asks for one, in the
       address, the way a link does: `#at=Rome&y=600&s=1` is the shipped chant —
       the very `songs.js TERMS` this file used to inherit from the boot — named
       rather than assumed. `s=1` because the boot draws a seed now (Paul: *"Boot
       up every new session with a new seed unless there's a seed in the URL"*) and
       a gate that re-rolled its own subject would measure a different record every
       run. Naming the fixture is the honest half of the change: what this file
       asserts about "the record" is now a claim about a record it chose. */
    await p.goto(PAGE + CHANT, { waitUntil: "load" });
    await p.waitForTimeout(2500);

    /* ---- stand on the first line voice's inst facet -------------------- */
    const who = await p.evaluate(async () => {
      window.__eightTab("Band");
      await new Promise((r) => setTimeout(r, 250));
      const v = window.__eightDoc().voices.find((x) => x.kind === "line");
      const tab = document.querySelector('#nu-tray [data-k="tab' + v.name + '"]');
      if (tab) { tab.click(); await new Promise((r) => setTimeout(r, 250)); }
      const fi = document.querySelector('#nu-tray [data-k="facet-inst"]');
      if (fi) { fi.click(); await new Promise((r) => setTimeout(r, 250)); }
      return { name: v.name, tab: !!tab };
    });
    check(who.tab, W + " · the band level offers a tab for voice " + JSON.stringify(who.name));
    const V = who.name;
    const seat = async (id) => p.evaluate(async ({ V, id }) => {
      const sel = document.querySelector('select[data-k="sel|sound.instrument|' + V + '"]');
      if (!sel) return { sel: false };
      const has = [...sel.options].some((o) => o.value === id);
      if (has) { sel.value = id; sel.dispatchEvent(new Event("change", { bubbles: true })); }
      await new Promise((r) => setTimeout(r, 350));
      return { sel: true, has,
               strips: document.querySelectorAll(".nu-loop").length,
               instr: window.__eightDoc().voices.find((x) => x.name === V).instrument };
    }, { V, id });

    /* ---- S2 a modelled chair gets NO editor ---------------------------- */
    const mod = await seat("solo_vox");
    check(mod.sel && mod.has && mod.instr === "solo_vox" && mod.strips === 0,
      W + " · S2 a modelled chair (solo_vox) draws no loop editor at all (" +
      mod.strips + " strips, instr " + JSON.stringify(mod.instr) + ")");

    /* ---- S1 the crate seats through the same dropdown ------------------- */
    const smp = await seat("sea_shore");
    check(smp.has, W + " · S1 the instrument menu OFFERS sea_shore (the crate is in the pool)");
    check(smp.instr === "sea_shore" && smp.strips === 1,
      W + " · S1 …choosing it seats it and draws exactly one loop strip (" +
      smp.strips + " strips, instr " + JSON.stringify(smp.instr) + ")");
    const ta = await p.evaluate(() => {
      const s = document.querySelector(".nu-lps");
      return s ? getComputedStyle(s).touchAction : null;
    });
    check(ta === "none", W + " · S3 touch-action is \"none\" on the strip and only read off it (" + ta + ")");

    /* ---- S3 the touch law ----------------------------------------------- */
    const pre = await p.evaluate(() => {
      const over = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.min(160, Math.max(0, over)));
      return new Promise((res) => setTimeout(() => {
        const bar = document.querySelector(".nu-lpb").getBoundingClientRect();
        res({ over, y: window.scrollY,
              x0: bar.x + bar.width * 0.9, x1: bar.x + bar.width * 0.5,
              ym: bar.y + bar.height / 2, w: bar.width,
              side: document.documentElement.scrollWidth - document.documentElement.clientWidth });
      }, 150));
    });
    check(pre.side === 0, W + " · S6 nothing scrolls sideways (" + pre.side + " px)");
    const cdp = await p.context().newCDPSession(p);
    const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", {
      type, touchPoints: type === "touchEnd" ? []
        : [{ x, y, radiusX: 8, radiusY: 8 }] });
    // a DIAGONAL drag — the finger drifts 24px down while travelling the bar,
    // which is exactly the gesture a pan-steal would take from the handle
    await touch("touchStart", pre.x0, pre.ym);
    for (let i = 1; i <= 12; i++)
      await touch("touchMove", pre.x0 + (pre.x1 - pre.x0) * i / 12, pre.ym + 2 * i);
    await touch("touchEnd", pre.x1, pre.ym + 24);
    await p.waitForTimeout(400);
    const post = await p.evaluate((V2) => {
      const v = window.__eightDoc().voices.find((x) => x.name === V2);
      return { y: window.scrollY, sound: v.sound || null,
               strips: document.querySelectorAll(".nu-loop").length,
               abs: !!document.querySelector(".nu-loop.abs"),
               reset: !!document.querySelector(".nu-lpr:not(.off)") };
    }, V);
    const lo = post.sound && post.sound.loopout;
    check(typeof lo === "number" && Math.abs(lo - 0.5) <= 0.08,
      W + " · S3 the drag moved the OUT handle: voice.sound.loopout = " +
      JSON.stringify(lo) + " (a number near 0.5)");
    check(post.y === pre.y,
      W + " · S3 …and the page did not move a pixel under the finger: scrollY " +
      pre.y + " -> " + post.y + (pre.over > 0 ? " (page scrollable, " + pre.over + "px)" :
      " (page has no overflow at this width — the steal had nothing to take)"));
    check(post.strips === 1 && !post.abs && post.reset,
      W + " · S3 …and the redrawn strip is STATED (not .abs) with the ↺ word offered");

    /* ---- S4 the keyboard channel ----------------------------------------- */
    await p.evaluate((V2) => {
      const i = document.querySelector('input[data-k="loopin' + V2 + '"]');
      i.focus();
    }, V);
    await p.keyboard.press("ArrowRight");
    await p.waitForTimeout(120);
    const kb = await p.evaluate((V2) =>
      (window.__eightDoc().voices.find((x) => x.name === V2).sound || {}).loopin, V);
    check(typeof kb === "number" && Math.abs(kb - 0.01) < 1e-9,
      W + " · S4 ArrowRight on the hidden native input writes loopin 0.01 (" + JSON.stringify(kb) + ")");

    /* ---- S5 the word and the way back ------------------------------------ */
    const cyc = [];
    for (let i = 0; i < 3; i++) {
      await p.evaluate((V2) => {
        document.querySelector('[data-k="looping' + V2 + '"]').click(); }, V);
      await p.waitForTimeout(250);
      cyc.push(await p.evaluate((V2) =>
        (window.__eightDoc().voices.find((x) => x.name === V2).sound || {}).looping || "", V));
    }
    check(cyc.join(">") === "loop>once>",
      W + " · S5 the looping word cycles loops -> one-shot -> the zone's own (" +
      JSON.stringify(cyc) + ")");
    await p.evaluate((V2) => {
      document.querySelector('[data-k="loopreset' + V2 + '"]').click(); }, V);
    await p.waitForTimeout(250);
    const clr = await p.evaluate((V2) => {
      const s = window.__eightDoc().voices.find((x) => x.name === V2).sound || {};
      return { loopin: "loopin" in s, loopout: "loopout" in s,
               abs: !!document.querySelector(".nu-loop.abs") };
    }, V);
    check(!clr.loopin && !clr.loopout && clr.abs,
      W + " · S5 ↺ deletes the stated points — ABSENT, not 0 and 1 — and the strip dims back to .abs");

    check(!errs.length, W + " · S6 the page raised no errors (" +
      (errs[0] || "clean") + ")");
    await p.close();
  }

  for (const n of notes) console.log("  " + n);
  for (const f of fails) console.log("  " + f);
  console.log("\n" + notes.length + " passed, " + fails.length + " failed");
  if (srv) srv.proc.kill();
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error("HARNESS: " + e.stack); process.exit(2); });
