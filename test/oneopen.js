#!/usr/bin/env node
// test/oneopen.js — ONE OPEN THING, AND ALWAYS A WAY OUT (TABLE.md §18).
//
// Paul, sending a photograph of his phone with the hamburger, a floating
// volume panel, a play-options popup AND a section's sheet standing at once:
// *"It's easy to get into a state like that and hard to get out of it."*
//
// TEST THE ARTIFACT. Every number below is measured on the RENDERED page under
// iPhone emulation (devices['iPhone 14'], DPR 3, isMobile, hasTouch) at 390 and
// at 320, by driving the box the way a thumb drives it — no reading of source,
// no counting of module variables. What it asserts:
//
//   O1  PAUL'S OWN STATE. Open a section sheet, then the play options, then the
//       hamburger, one after the other, and count what is on the glass at each
//       step. Measured BEFORE this round: 1, then 2, then 3. It must be 1 at
//       every step, for ever.
//   O2  EVERY PAIR. For each ordered pair of the four surfaces — the menu, the
//       play fold, the log, a table sheet — opening the second closes the
//       first. Twelve pairs, no exceptions.
//   O3  THE WAY OUT, THREE WAYS, FOR EVERY SURFACE: a tap outside it, Escape,
//       and its own close (the opener pressed again — for the log, whose
//       opener is behind the menu, the × in its header). Twelve ways out.
//       Measured BEFORE, on a HEAD overlay: six of the twelve worked.
//   O4  THE OWNER AND THE GLASS AGREE. `window.__nuOpen()` — the one owner's
//       own answer — names exactly what a walk of the DOM finds open, in every
//       state above. A page that BELIEVES one thing is open while two are is
//       the bug this round exists to delete, and it would pass O1 and O2 while
//       lying.
//   O5  A VIEW IS NOT A POP-UP. Escape with nothing open takes you back to the
//       table from Score/Video/Export, which is what the × in a view's own
//       header does; and Escape while an input has focus is the FIELD's, never
//       the page's.
//
// Run:  NODE_PATH=/home/ford/aboard-daily/node_modules node test/oneopen.js

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { chromium, devices } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const EXE = (() => {
  const home = process.env.HOME || "";
  for (const c of ["chromium-1234/chrome-linux64/chrome",
                   "chromium-1217/chrome-linux64/chrome"]) {
    const p = path.join(home, ".cache/ms-playwright", c);
    if (fs.existsSync(p)) return p;
  }
  return path.join(home, ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
})();
/* KINGSTON 1969 AT READING 1 — the same subject test/table.browser.js drives,
   for the same reason: a record with several lines, a bass and a kit. */
const REGGAE = "#at=Kingston&y=1969&s=1";

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

/* WHAT IS ON THE GLASS, WALKED RATHER THAN ASKED. The four surfaces by their
   own boxes: a box that is `hidden`, `display:none` or zero-height is not
   open, whatever anything says about it. */
const GLASS = () => {
  const vis = (e) => !!e && !e.hidden &&
    getComputedStyle(e).display !== "none" &&
    e.getBoundingClientRect().height > 0;
  const out = [];
  if (vis(document.getElementById("nu-menu"))) out.push("menu");
  if (vis(document.querySelector(".nu-baropts"))) out.push("playops");
  if (vis(document.getElementById("nu-log"))) out.push("log");
  if ([...document.querySelectorAll("#pan-band .nu-wopen")].some(vis))
    out.push("sheet");
  return out;
};
/* THE FOUR DOORS, PRESSED THE WAY A THUMB PRESSES THEM. The log's door is a
   row of the menu, which is the whole reason its own opener cannot close it. */
const OPENERS = {
  menu: () => document.getElementById("burger").click(),
  playops: () => document.getElementById("playops").click(),
  log: () => { document.getElementById("burger").click();
               document.querySelector('#nu-menu [data-k="logger"]').click(); },
  sheet: () => document.querySelector('#pan-band [data-k^="trow|"]').click(),
};
const CLOSERS = {
  menu: () => document.getElementById("burger").click(),
  playops: () => document.getElementById("playops").click(),
  /* THE LOG'S THIRD WAY OUT IS THE × IN ITS HEADER (§18): its opener is
     behind the menu, and opening the menu closes the log. */
  log: () => document.querySelector('#nu-log [data-k="logclose"]').click(),
  sheet: () => document.querySelector('#pan-band [data-k^="trow|"]').click(),
};

(async () => {
  console.log("\none open thing — the four surfaces, driven on the rendered page");
  const srv = await standUpServer();
  const PAGE = "http://127.0.0.1:" + srv.port + "/nukernel/index.html";
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ ...devices["iPhone 14"] });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  await p.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  await p.goto(PAGE + REGGAE, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2600);

  const glass = () => p.evaluate(GLASS);
  const owner = () => p.evaluate(() => window.__nuOpen && window.__nuOpen());
  const press = (name) => p.evaluate((n) => {
    ({ menu: () => document.getElementById("burger").click(),
       playops: () => document.getElementById("playops").click(),
       log: () => { document.getElementById("burger").click();
                    document.querySelector('#nu-menu [data-k="logger"]').click(); },
       sheet: () => document.querySelector('#pan-band [data-k^="trow|"]').click(),
     })[n](); }, name);
  const close = (name) => p.evaluate((n) => {
    ({ menu: () => document.getElementById("burger").click(),
       playops: () => document.getElementById("playops").click(),
       log: () => document.querySelector('#nu-log [data-k="logclose"]').click(),
       sheet: () => document.querySelector('#pan-band [data-k^="trow|"]').click(),
     })[n](); }, name);
  /* THE PAGE IS PUT BACK THROUGH ITS OWN DOOR, not by hiding boxes: whatever
     is open is shut the way Escape shuts it. */
  const rest = async () => { await p.evaluate(() => { let n = 0;
    while (window.__nuShut() && n++ < 8) { /* one is enough; the loop is a fuse */ } });
    await p.waitForTimeout(250); };

  for (const W of [390, 320]) {
    await p.setViewportSize({ width: W, height: 844 });
    await p.waitForTimeout(400);
    await rest();

    /* ---- O1 · PAUL'S OWN STATE ---------------------------------------- */
    const steps = [];
    for (const s of ["sheet", "playops", "menu"]) {
      await press(s); await p.waitForTimeout(380);
      steps.push({ s, on: await glass(), own: await owner() });
    }
    check(steps.every((x) => x.on.length === 1),
      "O1 " + W + " · a sheet, then the volume's own bar, then the ≡: ONE " +
      "surface is open at every step (was 1, 2, 3) — " +
      steps.map((x) => x.s + ":" + x.on.join("+")).join(" ; "));
    /* O4 rides every reading: the owner and the glass say the same thing. */
    check(steps.every((x) => x.on.length === 1 && x.on[0] === x.own),
      "O4 " + W + " · the one owner names what the glass shows at every step — " +
      steps.map((x) => x.own + "/" + x.on.join("+")).join(" ; "));
    await rest();

    /* ---- O2 · EVERY PAIR ---------------------------------------------- */
    const names = Object.keys(OPENERS);
    const bad = [];
    for (const a of names) for (const c of names) {
      if (a === c) continue;
      await rest();
      await press(a); await p.waitForTimeout(300);
      await press(c); await p.waitForTimeout(340);
      const on = await glass();
      if (!(on.length === 1 && on[0] === c)) bad.push(a + "->" + c + " [" + on + "]");
    }
    check(!bad.length, "O2 " + W + " · for all " + (names.length * (names.length - 1)) +
      " ordered pairs, opening the second closes the first" +
      (bad.length ? " — WRONG " + bad.join(", ") : ""));

    /* ---- O3 · THE WAY OUT --------------------------------------------- */
    const stuck = [];
    for (const n of names) for (const way of ["outside", "escape", "own close"]) {
      await rest();
      await press(n); await p.waitForTimeout(320);
      if (way === "escape") await p.keyboard.press("Escape");
      /* THE TAP OUTSIDE LANDS ON THE STRIP'S OWN AIR — not on a control, which
         is DESIGN §3's *"nothing dismisses under a finger that is changing a
         value"* asked the other way round. */
      else if (way === "outside") await p.mouse.click(Math.round(W / 2), 22);
      else await close(n);
      await p.waitForTimeout(340);
      const on = await glass();
      if (on.indexOf(n) >= 0) stuck.push(n + "/" + way);
    }
    check(!stuck.length, "O3 " + W + " · every surface closes three ways — a " +
      "tap outside, Escape, its own close (12 of 12; 6 of 12 before)" +
      (stuck.length ? " — STUCK " + stuck.join(", ") : ""));
  }

  /* ---- O5 · A VIEW IS NOT A POP-UP ------------------------------------ */
  await p.setViewportSize({ width: 390, height: 844 });
  await rest();
  const views = [];
  for (const v of ["Score", "Video", "Export"]) {
    await p.evaluate((n) => window.__eightTab(n), v);
    await p.waitForTimeout(v === "Score" ? 1600 : 600);
    await p.keyboard.press("Escape");
    await p.waitForTimeout(500);
    views.push(v + ":" + (await p.evaluate(() => window.__eightTabNow())));
  }
  check(views.every((x) => x.split(":")[1] === "Band"),
    "O5 Escape with nothing open takes a VIEW back to the table, which is " +
    "what its own × does — " + views.join(" "));
  /* ...AND A FIELD KEEPS ITS OWN ESCAPE. The seed's number becomes an <input>
     under a thumb; Escape there cancels the edit and must not close a surface
     or leave the view. */
  await rest();
  const field = await p.evaluate(async () => {
    document.getElementById("seedval").click();
    await new Promise((r) => setTimeout(r, 200));
    const on = document.activeElement && document.activeElement.id;
    return { focused: on, open: window.__nuOpen() };
  });
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => ({ tab: window.__eightTabNow(),
                                          open: window.__nuOpen() }));
  check(field.focused === "seedin" && after.tab === "Band",
    "O5b the seed's field takes Escape as its own — the page does not move — " +
    JSON.stringify(field) + " -> " + JSON.stringify(after));

  check(!errs.length, "no page errors" + (errs.length ? " — " + errs.join(" | ") : ""));

  console.log("\none open: " + notes.length + " ok, " + fails.length + " failed");
  await b.close();
  srv.proc.kill();
  process.exit(fails.length ? 1 : 0);
})();
