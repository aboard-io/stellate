#!/usr/bin/env node
/* test/meter-reach.browser.js — THE PER-VOICE METER, PROVED AT THE SOUND
 * (2026-09-01, the composer round, slice 0b).
 *
 * WHY THIS FILE EXISTS. Paul, of the Mix deck: *"the columns should list the
 * instrument and when I click on the column head let me edit the instrument!
 * Light up which instrument is playing, make a little volume meter INSIDE the
 * heading."*
 *
 * The page had refused that meter, in writing and for a good reason —
 * ui/engineer.js METER_WHY: "one master tap — the engine sums every voice into
 * shared buses, so there is no per-channel signal to measure ... a green bar
 * here would be a fake measurement." That was a fact about the WIRING, not
 * about the world, so this round rewired it: engine/faust/live/live.js
 * `samplerOf` now gives every unit key its own gain -> AnalyserNode on the way
 * to the shared dry bus and exposes `handle.voiceRms(key)`, and
 * nukernel/audio/live.js joins unit keys to CHAIR keys through the newly
 * exported `plan.js addrOf(si)` to answer two questions:
 *   soundingChans() -> which chairs have an event covering this instant
 *   voiceLevels()   -> { chairKey: measured rms }
 *
 * WHY IT IS A BROWSER GATE AND CANNOT BE A NODE ONE. Both halves are WebAudio:
 * the tap is an AnalyserNode in a live AudioContext and the join needs a
 * compiled plan under a running transport. There is no node assertion that can
 * reach either. So this gate reads THE ARTIFACT — the two `__nu*` probes the
 * module hangs on the window, on the shipped record, with the engine actually
 * sounding — and never a copy of the arithmetic.
 *
 * THE LAW IT HOLDS, and it is the one METER_WHY was defending: a chair nobody
 * measured is ABSENT from voiceLevels(), never 0. 0 is a claim of silence; the
 * absence is the refusal, and a view drawing green off this map draws it only
 * where a number arrived.
 *
 * THE CHECKS
 *   M1  while the record plays, soundingChans() names at least one chair.
 *   M2  every name it returns is a CHAIR key (channelVoicesOf's own list, or
 *       "drums") and never a unit key ("v0") — i.e. addrOf's join really ran.
 *   M3  voiceLevels() reports rms > 0 for a chair that is sounding at that
 *       instant. This is the whole slice in one assertion.
 *   M4  every level is a finite number >= 0 on a chair the record has; a chair
 *       with no tap and no audit is absent rather than zero.
 *   M5  stopped, soundingChans() is empty — the playhead does not lie about a
 *       silent record.
 *
 * THE HONEST BOUNDARY. The engine runs an ~8 s prefill runway before the first
 * bar is heard (audio/live.js: "anything fed through the walk ... is heard up
 * to ~5 s later than it was"), so this waits 6 s after the press and then
 * POLLS for the first sounding instant rather than asserting on one sample:
 * a bar of the shipped chant has rests in it, and a single look between two
 * notes is not evidence of anything.
 *
 * RUN:  NODE_PATH=/home/ford/ftrain-2025/node_modules node test/meter-reach.browser.js
 *       (stands up its own COOP/COEP server, serve.sh's handler, like vol-reach)
 */
const CHANT = "#at=Rome&y=600&s=1";   // the shipped chant, named (2026-09-02)
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const ROOT = path.join(__dirname, "..");
const PAGE_ARG = arg("--page", null);
/* the executablePath ladder — test/shell.js:180-192 is the one that exists;
   chromium.launch() bare picks whatever playwright last installed and has
   faked a bug report on this box before. */
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
  console.log("\nmeter-reach — the per-voice meter and the sounding feed, read off the page");
  const srv = PAGE_ARG ? null : await standUpServer();
  const PAGE = PAGE_ARG || ("http://127.0.0.1:" + srv.port + "/nukernel/index.html");
  const b = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  p.on("pageerror", (e) => console.log("  pageerror: " + e.message));
  /* THE BOX BOOTS ON THE BLANK STATE (2026-09-02). Paul, the composer round:
     *"Add a 'silence' genre at the top of the genre list. This is a blank
     state."* — one eight-bar section, ZERO voices, one cell of rests. This gate
     is about a record with a band in it, so it names one in the address, the way
     a link does: the shipped chant, at seed 1 because the boot draws a seed now
     (*"Boot up every new session with a new seed unless there's a seed in the
     URL"*) and a gate that re-rolled its own subject would measure a different
     record every run. */
  await p.goto(PAGE + CHANT, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);

  /* the record's own chair keys, from the ONE owner of that list */
  const chairs = await p.evaluate(() => {
    try {
      const ks = window.NuDeskDoc.channelVoicesOf(window.__eightDoc(), window.NuGenres.GENRES)
        .map((c) => c.key);
      if (ks.indexOf("drums") < 0) ks.push("drums");
      return ks;
    } catch (e) { return null; }
  });
  check(!!(chairs && chairs.length), "the record has chairs to meter (" +
    (chairs ? chairs.join(" ") : "none") + ")");

  await p.evaluate(() => document.getElementById("play").click());
  await p.waitForTimeout(6000);

  const probesThere = await p.evaluate(() =>
    typeof window.__nuSounding === "function" && typeof window.__nuVoiceLevels === "function");
  check(probesThere, "__nuSounding and __nuVoiceLevels are on the page (the __nu* family)");

  /* POLL for a sounding instant. A single look can land in a rest; the record
     is not silent because one sample was. Budget: 40 s, which is the runway
     (~8 s) plus room for a slow cold decode of the GM bank. */
  let best = null, played = false;
  for (let i = 0; i < 160 && !best; i++) {
    const s = await p.evaluate(() => {
      const bounce = window.__nuBounce ? window.__nuBounce() : null;
      const sounding = window.__nuSounding ? window.__nuSounding() : null;
      const levels = window.__nuVoiceLevels ? window.__nuVoiceLevels() : null;
      return { playing: !!(bounce && bounce.playing), route: bounce ? bounce.route : "",
               sounding, levels };
    });
    played = played || s.playing;
    if (s.sounding && s.sounding.length) {
      const hot = s.sounding.filter((c) => s.levels && +s.levels[c] > 0);
      // keep the first instant that has BOTH halves; else remember the first
      // instant that had a playhead at all, so a failure prints what it saw
      if (hot.length) best = { ...s, hot };
      else if (!best && i > 60) best = { ...s, hot: [] };
    }
    if (!best) await p.waitForTimeout(250);
  }
  const seen = best || await p.evaluate(() => ({
    playing: !!(window.__nuBounce && window.__nuBounce().playing),
    route: window.__nuBounce ? window.__nuBounce().route : "",
    sounding: window.__nuSounding ? window.__nuSounding() : null,
    levels: window.__nuVoiceLevels ? window.__nuVoiceLevels() : null, hot: [] }));

  console.log("  · route " + seen.route + ", sounding [" + (seen.sounding || []).join(" ") +
    "], levels " + JSON.stringify(seen.levels));

  check(played && seen.sounding && seen.sounding.length > 0,
    "M1 while the record plays, soundingChans() names a chair (" +
    (seen.sounding || []).length + ": " + (seen.sounding || []).join(" ") + ")");

  const strays = (seen.sounding || []).filter((c) => chairs && chairs.indexOf(c) < 0);
  check(!!chairs && strays.length === 0,
    "M2 every sounding name is a CHAIR key, not a unit key" +
    (strays.length ? " — stray: " + strays.join(" ") : ""));

  check(seen.hot && seen.hot.length > 0,
    "M3 voiceLevels() measures rms > 0 on a sounding chair (" +
    (seen.hot || []).map((c) => c + " " + (+seen.levels[c]).toFixed(5)).join(", ") + ")");

  const lv = seen.levels || {};
  const badKeys = Object.keys(lv).filter((c) => chairs && chairs.indexOf(c) < 0);
  const badVals = Object.entries(lv).filter(([, v]) => !(typeof v === "number" && isFinite(v) && v >= 0));
  check(badKeys.length === 0 && badVals.length === 0,
    "M4 every level is a finite rms >= 0 on a chair the record has; unmeasured chairs are " +
    "ABSENT, not 0 (" + Object.keys(lv).length + " of " + (chairs || []).length + " measured)" +
    (badKeys.length ? " — stray keys " + badKeys.join(" ") : "") +
    (badVals.length ? " — bad values " + JSON.stringify(badVals) : ""));

  await p.evaluate(() => document.getElementById("play").click());
  await p.waitForTimeout(1500);
  const after = await p.evaluate(() => ({
    playing: !!(window.__nuBounce && window.__nuBounce().playing),
    sounding: window.__nuSounding ? window.__nuSounding() : null }));
  check(!after.playing && after.sounding && after.sounding.length === 0,
    "M5 stopped, soundingChans() is empty — the playhead does not light a silent record");

  await b.close();
  if (srv) srv.proc.kill();
  console.log("\nmeter-reach: " + notes.length + " ok, " + fails.length + " failed");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error("meter-reach: " + (e && e.stack || e)); process.exit(1); });
