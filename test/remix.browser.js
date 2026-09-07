#!/usr/bin/env node
/* test/remix.browser.js — THE AUTO REMIX PIPELINE, RUN IN A REAL BROWSER.
 *
 * Paul, 2026-09-07: "Make the changes to the pipeline to run in browser."
 * `nukernel/TABLE.md` §20f named five blockers and refused to hang a MIDI-upload
 * door on a pipeline that was node-only. They are gone; THIS is the gate that
 * says so, and it says it the only way [[test-the-artifact]] accepts — by
 * standing a page up, handing it BYTES, and comparing what comes back against
 * what `node tools/remix.js` produces for the same file, character for
 * character.
 *
 * WHAT IS ASSERTED
 *   B0  ZERO PAGEERROR, zero console error, on a page that loads the whole
 *       pipeline with ordinary <script> tags. (A favicon 404 is the server's,
 *       not the page's, and is named and skipped.)
 *   B1  EVERY MODULE PUBLISHED ITS GLOBAL. Sixteen files load as classic
 *       scripts in one shared scope — two of them, `tools/remix.js` and
 *       `tools/genealogy.js`, both declare a top-level `sum` — and all sixteen
 *       globals are there afterwards.
 *   B2  `eval` IS BLOCKED, AND THE PIPELINE RAN ANYWAY. The page carries
 *       `script-src 'self'` (no 'unsafe-eval', no 'unsafe-inline') and the
 *       server sends COOP/COEP `require-corp`, which is the app's own serving
 *       condition — §20f's "strict CSP and cross-origin isolation", both at
 *       once. The eval probe runs at LOAD TIME inside the page's own script,
 *       because a probe called through `page.evaluate` is answered by the
 *       debugger's realm and would report a false pass.
 *   B3  IT PRODUCED A ROW AND A SESSION at all.
 *   B4  THE BYTES ARE THE CLI'S BYTES. Row, session document, store and
 *       provenance, `JSON.stringify`d on both sides and compared as one string.
 *       This is the proof that what happened was a PORT and not a rewrite.
 *   B5  THE PRINTED DECISIONS ARE THE CLI'S, line for line — the tool's own
 *       "a run that says nothing has told you nothing" holds on a page too.
 *   B6  THE ONE THING IT CANNOT DO, IT REFUSES BY NAME. A closure of kind
 *       `formula` IS source text; `compile()` cannot interpret it and the
 *       browser path says which field and which source rather than dying in a
 *       CSP violation nobody can read.
 *   B7  AND THE NO-EVAL COMPILER IS THE SAME COMPILER. Over every closure in
 *       `nukernel/genres/`, `grammar.js compile(t)` agrees with
 *       `eval("(" + emit(t) + ")")` on every voice index 0..8 — zero
 *       mismatches — or refuses. That is checked here, under node, because it
 *       is a claim about arithmetic rather than about a page.
 *
 * The input is a `.mid` written by THE BOX'S OWN EXPORTER, exactly as
 * `test/remix.test.js` R2 writes it, so the ground truth is known.
 *
 * RUN: NODE_PATH=<a tree with playwright> node test/remix.browser.js
 *      …--chrome <path>   name the chromium binary
 *      …--keep            leave the generated page on disk to look at
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const ROOT = path.join(__dirname, "..");
const KEEP = argv.includes("--keep");
const EXE = arg("--chrome", null) || (() => {
  const home = process.env.HOME;
  for (const d of ["chromium-1234", "chromium_headless_shell-1234", "chromium-1217"])
    for (const b of ["chrome-linux64/chrome", "chrome-linux/headless_shell", "chrome-linux/chrome"]) {
      const p = path.join(home, ".cache/ms-playwright", d, b);
      if (fs.existsSync(p)) return p;
    }
  return path.join(home, ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
})();

let pass = 0, fail = 0;
const check = (ok, what, why) => {
  if (ok) { pass++; console.log("  ok   " + what); }
  else { fail++; console.log("  FAIL " + what + (why ? "\n       " + why : "")); }
};

/* the copy audit's server, and its headers: COOP/COEP `require-corp` is what
   the app is actually served under, so the page under test is cross-origin
   isolated exactly the way index.html is. */
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

/* THE ORDER IS nukernel/index.html's ORDER for the app tier, then the eight
   files of the pipeline. Anything a door builds has to load these, and this
   list is the seam written down. */
const APP = ["/engine/theory.js", "/nukernel/kernel.js", "/nukernel/genres.js",
  "/nukernel/genres-tables.js", "/nukernel/askable.js", "/nukernel/fields.js",
  "/nukernel/song.js", "/nukernel/instruments.js", "/nukernel/compose.js",
  "/nukernel/presets.js", "/nukernel/songs.js", "/nukernel/document.js",
  "/nukernel/knobs.js", "/nukernel/chair.js", "/nukernel/ideas-kit.js",
  "/nukernel/rules.js", "/nukernel/precompose.js"];
const PIPE = ["/tools/theory.js", "/tools/genealogy.js", "/tools/mine/mine-midi.js",
  "/tools/mine/mine-melody.js", "/tools/mine/mine-groove.js",
  "/tools/genres/grammar.js", "/tools/genres/emit.js", "/tools/remix.js"];
const GLOBALS = ["NuKernel", "NuGenres", "NuGenreTables", "NuFields", "NuSong",
  "NuInstruments", "NuCompose", "NuSongs", "NuDocument", "NuPrecompose",
  "NuTheory", "NuGenealogy", "NuMineMidi", "NuMineMelody", "NuMineGroove",
  "NuGenreGrammar", "NuGenreEmit", "NuRemix"];

const HARNESS = `/* generated by test/remix.browser.js — the page's own harness, in a FILE so
   the CSP can stay \`script-src 'self'\` with no 'unsafe-inline' beside it. */
window.__globals = ${JSON.stringify(GLOBALS)}.filter(function (k) { return !window[k]; });
/* EVAL AT LOAD TIME, in the page's own realm: a probe called through the
   driver's page.evaluate is answered by the debugger's realm, which is exempt
   from this page's CSP, and would report a false pass. */
window.__evalProbe = (function () {
  try { (0, eval)("1+1"); } catch (e) { return "BLOCKED: " + String(e.message).split("\\n")[0]; }
  try { new Function("return 1")(); } catch (e) { return "BLOCKED (new Function)"; }
  return "RAN";
})();
/* THE SEAM ITSELF, called the way a door would call it: bytes in, a row and a
   session out, nothing written. */
window.remixBytes = function (u8, name, key, seed) {
  var log = [], o = console.log;
  console.log = function (s) { log.push(s); };
  try {
    var r = window.NuRemix.runBytes(u8, name, key, { seed: seed || 1, dry: true, parents: false });
    return { ok: true, log: log, payload: {
      row: r.row, store: r.store, doc: r.doc,
      R: { felt: r.R.felt, abc: r.R.abc, notated: r.R.notated, factor: r.R.factor, keyConf: r.R.keyConf },
      A: { nBars: r.A.nBars, sections: r.A.sections, Tsim: r.A.Tsim },
      prov: r.prov, fig: r.fig } };
  } catch (e) { return { ok: false, err: e.message, stack: e.stack, log: log }; }
  finally { console.log = o; }
};
window.probeRefusal = function () {
  try { window.NuRemix.resolveRow({ entry: { kind: "formula", src: "v => v * 2" } });
        return { refused: false }; }
  catch (e) { return { refused: true, message: e.message }; }
};
`;

const PAGE = `<!doctype html>
<meta charset="utf-8">
<!-- THE CSP IS THE POINT. \`script-src 'self'\` forbids eval and new Function
     outright. If any part of the pipeline still evaluated source, this page
     would die the moment a file was dropped. -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'unsafe-inline'">
<title>remix in the browser</title>
<body style="font:13px ui-monospace,monospace;padding:1rem">
<h1>tools/remix.js, on a page</h1>
<p>Bytes of a <code>.mid</code> in, a genre row and a session out — no node, no
bundler, no <code>eval</code>.</p>
<input type="file" id="f" accept=".mid,.midi">
<pre id="out">ready</pre>
${APP.concat(PIPE).map((s) => `<script src="${s}"></script>`).join("\n")}
<script src="./harness.js"></script>
`;

/** the payload both sides produce, so the two can be compared as one string */
function cliPayload(midPath, key, seed) {
  const Remix = require(ROOT + "/tools/remix.js");
  const log = [];
  const o = console.log; console.log = (s) => log.push(s);
  let r;
  try { r = Remix.run(midPath, key, { seed, dry: true, parents: false }); }
  finally { console.log = o; }
  return { log, payload: {
    row: r.row, store: r.store, doc: r.doc,
    R: { felt: r.R.felt, abc: r.R.abc, notated: r.R.notated, factor: r.R.factor, keyConf: r.R.keyConf },
    A: { nBars: r.A.nBars, sections: r.A.sections, Tsim: r.A.Tsim },
    prov: r.prov, fig: r.fig } };
}

(async () => {
  console.log("test/remix.browser.js — the pipeline, in a browser");

  /* ---- B7 first: it is node arithmetic and it needs no page ------------ */
  console.log("\nB7 — compile() is the same compiler eval(emit()) was");
  {
    const G = require(ROOT + "/tools/genres/grammar.js");
    const T = require(ROOT + "/nukernel/genres-tables.js");
    const dir = path.join(ROOT, "nukernel/genres");
    let seen = 0, agreed = 0, refused = 0, mismatch = [];
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json") && x !== "_order.json")) {
      const row = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      for (const k of ["entry", "reg", "realize", "word", "throat"]) {
        if (!row[k]) continue;
        seen++;
        let built;
        try { built = G.compile(row[k], { tables: T, where: f + "." + k }); }
        catch (e) { refused++; continue; }
        // eslint-disable-next-line no-eval
        const evald = eval("(" + G.emit(row[k]) + ")");
        let same = true;
        for (let v = 0; v < 9; v++) {
          const a = (() => { try { return JSON.stringify(built(v)); } catch (e) { return "ERR " + e.message; } })();
          const b = (() => { try { return JSON.stringify(evald(v)); } catch (e) { return "ERR " + e.message; } })();
          if (a !== b) { same = false; break; }
        }
        if (same) agreed++; else mismatch.push(f + "." + k);
      }
    }
    check(seen > 1500, `the catalogue's closures were all read (${seen} over ${
      fs.readdirSync(dir).filter((x) => x.endsWith(".json") && x !== "_order.json").length} rows)`);
    check(mismatch.length === 0,
      `compile(t) === eval(emit(t)) on v=0..8, ${agreed} closures, ZERO mismatches ` +
      `(${refused} refused: \`formula\`, and \`$src\` naming the WORDS scope — none of ` +
      `them reachable from a mined row, because the catalogue arrives at a page ` +
      `already compiled inside genres.js)`,
      mismatch.slice(0, 5).join(", "));
  }

  /* ---- the input: a record the box itself wrote ----------------------- */
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "nu-remix-br-"));
  const SN = await import(ROOT + "/tools/ableton/score-node.mjs");
  SN.shimWindow();
  const { smfFromScore } = await import(ROOT + "/nukernel/export/smf.js");
  const state = await import(ROOT + "/nukernel/ui/state.js");
  const { GENRES } = require(ROOT + "/nukernel/genres.js");
  const KEYS = ["gregorian", "techno", "gregorian", "techno"];
  const raw = state.defaultSong();
  const tmpl = JSON.stringify(raw.song[0]);
  raw.song = KEYS.map((k) => { const b = JSON.parse(tmpl);
    b.stack = [{ g: k, slots: [0] }]; b.len = GENRES[k].bars || 4; return b; });
  const songPath = path.join(TMP, "gt.song.json");
  fs.writeFileSync(songPath, JSON.stringify(raw));
  const score = await SN.loadScore({ songPath });
  const midPath = path.join(TMP, "gt.mid");
  fs.writeFileSync(midPath, Buffer.from(smfFromScore(score)));

  /* ---- the CLI's answer, first, so the page has something to match ---- */
  const cli = cliPayload(midPath, "remixgate", 1);

  /* ---- the page ------------------------------------------------------- */
  /* THE PAGE IS SERVED FROM THIS REPO because it loads twenty-five same-origin
     scripts, so it has to be written INSIDE it — under `scratchpad/`, which is
     .gitignored, so a crashed run cannot leave untracked junk in the tree. */
  fs.mkdirSync(path.join(ROOT, "scratchpad"), { recursive: true });
  const dir = fs.mkdtempSync(path.join(ROOT, "scratchpad", "remix-browser-"));
  fs.writeFileSync(path.join(dir, "page.html"), PAGE);
  fs.writeFileSync(path.join(dir, "harness.js"), HARNESS);
  const rel = "scratchpad/" + path.basename(dir);
  const { proc, port } = await standUpServer();
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage();
  const pageErrors = [], consoleErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  let got, refusal, evalProbe, missing;
  try {
    await page.goto(`http://127.0.0.1:${port}/${rel}/page.html`, { waitUntil: "networkidle" });
    missing = await page.evaluate(() => window.__globals);
    evalProbe = await page.evaluate(() => window.__evalProbe);
    const b64 = fs.readFileSync(midPath).toString("base64");
    got = await page.evaluate((s) => {
      const bin = atob(s), u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return window.remixBytes(u8, "gt.mid", "remixgate", 1);
    }, b64);
    refusal = await page.evaluate(() => window.probeRefusal());
    if (KEEP) {
      /* paint what the run said, so the kept screenshot shows the pipeline's
         own decisions rather than an untouched "ready". */
      await page.evaluate((lines) => { document.getElementById("out").textContent = lines.join("\n"); },
        got.ok ? got.log : ["REFUSED: " + got.err]);
      await page.screenshot({ path: path.join(dir, "page.png"), fullPage: true });
    }
  } finally {
    await browser.close();
    proc.kill();
    if (!KEEP) fs.rmSync(dir, { recursive: true, force: true });
    else console.log("\n  (--keep) the page is at " + dir);
  }

  /* THE FAVICON IS THE SERVER'S PROBLEM. A static server with no favicon.ico
     answers 404 and chromium logs it; it is not the page failing. */
  const realConsole = consoleErrors.filter((t) => !/favicon/i.test(t) &&
    !/Failed to load resource: the server responded with a status of 404/.test(t));

  console.log("\nB0 — the page loads clean");
  check(pageErrors.length === 0, "zero pageerror over " + (APP.length + PIPE.length) +
    " classic scripts", pageErrors.join("\n       "));
  check(realConsole.length === 0, "zero console error (the favicon 404 is the server's and is named)",
    realConsole.join("\n       "));

  console.log("\nB1 — every module published its global");
  check(missing && missing.length === 0,
    `all ${GLOBALS.length} globals are there — including the two files that BOTH ` +
    `declare a top-level \`sum\` (tools/remix.js, tools/genealogy.js), which two ` +
    `unwrapped scripts could not have done`,
    missing && missing.join(", "));

  console.log("\nB2 — eval is blocked, and the pipeline ran anyway");
  check(/^BLOCKED/.test(String(evalProbe)),
    "eval is refused by the page's own CSP: " + evalProbe);

  console.log("\nB3..B6 — the run");
  check(got && got.ok, "the pipeline ran on the page and produced a row and a session",
    got && got.err ? got.err + "\n       " + got.stack : "");
  if (got && got.ok) {
    const a = JSON.stringify(cli.payload), b = JSON.stringify(got.payload);
    check(a === b, `the row, the session document, the store and the provenance are ` +
      `BYTE-IDENTICAL to the node CLI's (${a.length} characters)`,
      a === b ? "" : firstDiff(a, b));
    check(cli.log.join("\n") === got.log.join("\n"),
      `every printed decision is the CLI's, line for line (${cli.log.length} lines)`,
      diffLines(cli.log, got.log));
  } else { fail += 2; }
  check(refusal && refusal.refused && /does not evaluate source/.test(refusal.message),
    "a `formula` closure REFUSES BY NAME on the page rather than dying in a CSP violation",
    refusal && JSON.stringify(refusal));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

function firstDiff(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    if (a[i] !== b[i]) return "first difference at " + i + ":\n       cli … " +
      a.slice(Math.max(0, i - 40), i + 40) + "\n       page… " + b.slice(Math.max(0, i - 40), i + 40);
  return "";
}
function diffLines(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    if (a[i] !== b[i]) return "line " + i + ":\n       cli  " + a[i] + "\n       page " + b[i];
  return "";
}
