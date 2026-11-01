#!/usr/bin/env node
/* test/lilguys-fuzz.browser.js — the lilguys page, fuzzed (nukernel/lilguys/fuzz.js).
 *
 * The walks, the invariants, the properties and the shrinking all live in the
 * page's own module, so the same fuzzer runs on a phone (lilguys.html#fuzz) and
 * here. This file is what a page cannot do for itself: it stands up the server,
 * plays the part of TWO DEVICES — a laptop, and an iPhone (touch, 3x, and
 * turned round mid-walk: 844×390 sideways, 390×844 upright) — catches the
 * console errors a page's own listeners never see, and writes the graph walked
 * as JSON and DOT.
 *
 *   node test/lilguys-fuzz.browser.js [walks=4] [ops=50] [seed=1]
 *        [--device desktop|iphone|both] [--out DIR] [--page URL]
 *   node test/lilguys-fuzz.browser.js replay '[ {"op":...}, ... ]' [--seed N] [--device iphone]
 *
 * A failure prints its shrunk replay; the replay command walks it again and
 * prints the state and the verdict after every step. Exit 1 on any failure.
 * Missing sample files (/found/**, not in git) 404 in a fresh clone; those
 * console lines are not this gate's business and are not counted.
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const pos = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
const REPLAY = pos[0] === "replay" ? JSON.parse(pos[1]) : null;
const WALKS = REPLAY ? 1 : +(pos[0] || 4), OPS = +(pos[1] || 50), SEED = +(flag("--seed", pos[2] || 1));
const DEVICE = flag("--device", REPLAY ? "desktop" : "both");
const OUT = flag("--out", path.join(os.tmpdir(), "lilguys-fuzz"));
const ROOT = path.join(__dirname, "..");

const SIZES = { desktop: { width: 1280, height: 900 }, landscape: { width: 844, height: 390 }, portrait: { width: 390, height: 844 } };
const DEVICES = {
  desktop: { viewport: SIZES.desktop },
  iphone: { viewport: SIZES.landscape, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
            userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1" },
};

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
  const proc = spawn("python3", ["-c", SERVER_PY, ROOT], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((res, rej) => {
    let buf = "";
    const to = setTimeout(() => rej(new Error("the static server did not report a port")), 10000);
    proc.stdout.on("data", (d) => { buf += d; const m = buf.match(/(\d+)/); if (m) { clearTimeout(to); res({ proc, port: +m[1] }); } });
    proc.on("error", (e) => { clearTimeout(to); rej(e); });
  });
}

async function device(browser, base, name) {
  const ctx = await browser.newContext(DEVICES[name]);
  const page = await ctx.newPage();
  const consoleErrs = [];
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) consoleErrs.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => consoleErrs.push("pageerror: " + e.message.slice(0, 200)));
  // the one thing the page cannot do to itself: be turned round
  await page.exposeFunction("__lilRotate", async (to) => {
    const size = name === "iphone" ? (to === "portrait" ? SIZES.portrait : SIZES.landscape) : SIZES.desktop;
    await page.setViewportSize(size);
  });
  await page.goto(base + "#g=funk&s=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__lil && window.__lil.SCORE && !document.getElementById("play").disabled, null, { timeout: 90000 });
  await page.evaluate(() => { window.__lil.rotate = (to) => window.__lilRotate(to); });
  return { ctx, page, consoleErrs };
}

(async () => {
  const srv = flag("--page", null) ? null : await standUpServer();
  const BASE = flag("--page", null) || `http://127.0.0.1:${srv.port}/nukernel/lilguys.html`;
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  let failed = 0;
  try {
    const names = DEVICE === "both" ? ["desktop", "iphone"] : [DEVICE];
    if (REPLAY) {
      const { page, consoleErrs } = await device(browser, BASE, names[0]);
      const steps = await page.evaluate(async ({ ops, seed }) => {
        const F = await import("./lilguys/fuzz.js");
        const errors = [], out = [];
        addEventListener("error", (e) => errors.push(F.describe(e)));
        await F.walk(window.__lil, { seed, given: ops, errors,
          onStep: (i, o, to, fail) => out.push(`${JSON.stringify(o)} -> ${to}${fail ? "   FAIL " + fail : ""}`) });
        return out;
      }, { ops: REPLAY, seed: SEED });
      steps.forEach((l) => console.log(l));
      if (consoleErrs.length) console.log("console:", consoleErrs.slice(0, 5).join(" | "));
      failed = steps.some((l) => /FAIL/.test(l)) ? 1 : 0;
    } else {
    fs.mkdirSync(OUT, { recursive: true });
    console.log(`\nlilguys-fuzz — ${WALKS} walks of ${OPS} operations from seed ${SEED}, on ${names.join(" and ")}`);
    for (const name of names) {
      const { page, consoleErrs } = await device(browser, BASE, name);
      const t0 = Date.now();
      const res = await page.evaluate(async (o) => {
        const F = await import("./lilguys/fuzz.js");
        const errors = [];
        addEventListener("error", (e) => errors.push(F.describe(e)));
        addEventListener("unhandledrejection", (e) => errors.push("unhandled rejection: " + F.describe(e.reason)));
        const r = await F.run(window.__lil, { ...o, errors });
        r.dot = F.dot(r);
        return r;
      // each device its own seeds: the same seed on both walks the same path twice
      }, { walks: WALKS, ops: OPS, seed: SEED + (name === "iphone" ? 500 : 0) });
      fs.writeFileSync(path.join(OUT, `${name}-graph.json`), JSON.stringify({ states: res.states, edges: res.edges }, null, 1));
      fs.writeFileSync(path.join(OUT, `${name}-graph.dot`), res.dot);
      fs.writeFileSync(path.join(OUT, `${name}-fails.json`), JSON.stringify(res.fails, null, 1));
      const secs = ((Date.now() - t0) / 1000).toFixed(0);
      console.log(`${name}: ${res.walks} walks, ${res.ops} operations in ${secs}s; graph: ${Object.keys(res.states).length} states, ` +
        `${res.edges.length} edges (${path.join(OUT, name + "-graph.dot")})`);
      for (const f of res.fails) {
        failed++;
        console.log(`  FAIL ${f.fail}  (${f.count}x; seed ${f.seed}; shrunk to ${f.replay.length} operations)`);
        console.log(`       node test/lilguys-fuzz.browser.js replay '${JSON.stringify(f.replay)}' --seed ${f.seed} --device ${name}`);
      }
      if (consoleErrs.length) {
        failed++;
        console.log(`  FAIL the console: ${consoleErrs.length} error(s): ${[...new Set(consoleErrs)].slice(0, 4).join(" | ")}`);
      }
      if (!res.fails.length && !consoleErrs.length) console.log("  ok   every walk held every invariant and property");
    }
    }
  } finally {
    await browser.close();
    if (srv) srv.proc.kill();
  }
  console.log(failed ? `lilguys-fuzz: ${failed} failure(s)` : "lilguys-fuzz: all ok");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
