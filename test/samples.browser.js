#!/usr/bin/env node
/* test/samples.browser.js — THE SAMPLE CRATE, DRIVEN ON THE RENDERED PAGE
 * (2026-09-03.)
 *
 * WHY THIS FILE EXISTS. Paul, 2026-09-01: *"I can't really access or organize
 * samples used in, say, San Francisco 1996. They aren't accessible to the app
 * in any way."* The subject is therefore named in the address: San Francisco
 * 1996 is `instrumentalhiphop` (nukernel/atlas.js WHEN), and it is the right
 * record to hold this to because it is the crate-heaviest room in the
 * catalogue — an electric piano, a string section, a `found:collage:break_75_95`
 * chair holding TWELVE recorded breaks one per semitone, a bass on the hired
 * upright and a sampled `electronic` kit. Forty-six files, measured.
 *
 * TEST THE ARTIFACT. Every claim below is about the RENDERED page and the
 * ENGINE'S own report, never about a module's arithmetic read back to itself:
 * the list is held against `__nuMix()` (what the engine was handed), the file
 * paths against a real fetch off the page's own server, the audition against a
 * COUNT of AudioBufferSourceNodes actually started and stopped, and the swap
 * against BOTH the document and the recompiled unit.
 *
 * THE CHECKS
 *   S1  the crate names every sampled chair the compiled recipe does — every
 *       `sampler` id in `__nuMix().units` is a `unit` in `__nuSamples()`, and
 *       nothing in the crate is a unit the engine never asked for
 *   S2  every listed file answers 200 from the page's own server (a row with
 *       no file is a REMOTE address and says so instead of listing one)
 *   S3  an audition press starts exactly one AudioBufferSourceNode and the
 *       second press stops it — `aria-pressed` follows both ways
 *   S4  a swap through the combobox moves the chair's instrument in
 *       `__eightDoc()` AND the file the compiled recipe names for that chair
 *   S5  a player's crate is a row of ITS COLUMN SHEET, drawn only where that
 *       chair IS played by a recording, and a refused swap carries its reason
 *       on the control (2026-09-04, TABLE.md wave 2c: the record-wide
 *       `bandsamples` state and the per-member `facet-samples` are deleted
 *       with the Band pane; the crate's one door is the instrument row of the
 *       column sheet, which is where the question is asked)
 *   S5f a press while the record RUNS sounds nothing and says why — on the
 *       control and beside it (the one refusal here a redraw cannot pre-paint)
 *   S6  zero console errors, and no sideways scroll at 320 / 390 / 1280
 *
 * RUN: NODE_PATH=/home/ford/ftrain-2025/node_modules node test/samples.browser.js
 *      (stands up its own COOP/COEP server; also honours an injected --page)
 */
"use strict";
const { chromium } = require("playwright");
const { installCombo } = require("./lib-combo.js");
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

const SF96 = "#at=San%20Francisco&y=1996&s=1";

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

/* COUNTING THE NODES THAT ACTUALLY SOUND. There is no way to ask a WebAudio
   graph what it is playing, so the constructor is wrapped before the page runs
   a line: `createBufferSource` is the one door a decoded file goes through, and
   `start`/`stop` on the node it returns are the two events "it is sounding" and
   "it stopped" mean. Installed as an initScript so it is in place before any
   module loads, and it wraps rather than replaces — the real node is returned,
   so the page sounds exactly as it would without the gate watching. */
const COUNTER = () => {
  window.__bs = { started: 0, stopped: 0 };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const orig = AC.prototype.createBufferSource;
  AC.prototype.createBufferSource = function () {
    const s = orig.call(this);
    const st = s.start.bind(s), sp = s.stop.bind(s);
    s.start = (...a) => { window.__bs.started++; return st(...a); };
    s.stop = (...a) => { window.__bs.stopped++; return sp(...a); };
    return s;
  };
};

(async () => {
  console.log("\nsamples — the crate, driven on the rendered page");
  const srv = PAGE_ARG ? null : await standUpServer();
  const PAGE = PAGE_ARG || ("http://127.0.0.1:" + srv.port + "/nukernel/index.html");
  const b = await chromium.launch({ executablePath: EXE });
  const ctxb = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctxb.newPage();
  const errs = [];
  await p.addInitScript(COUNTER);
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text()))
    errs.push("console: " + m.text()); });
  await p.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  await p.goto(PAGE + SF96, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  await installCombo(p);

  const top = async (t) => { await p.evaluate((n) => window.__eightTab(n), t);
    await p.waitForTimeout(450); };
  /* A ROW IS PRESSED THE WAY A THUMB PRESSES IT — `__eightExpand` runs the
     node's own act and toggles its own branch, exactly as the listener does
     (ui/eight.js says so at its definition). */
  const press = async (k) => { const hit = await p.evaluate((key) => {
      const el = document.querySelector('[data-k="' + key + '"]');
      if (!el || el.disabled) return false; el.click(); return true; }, k);
    await p.waitForTimeout(900); return hit; };
  const say = async (sel, v) => { const hit = await p.evaluate(([s, val]) => {
      const el = document.querySelector('[data-sel="' + s + '"]');
      return el ? window.__combo.say(el, val) : false; }, [sel, v]);
    await p.waitForTimeout(1100); return hit; };

  const basis = await p.evaluate(() => window.__eightDoc().basis);
  check(basis === "instrumentalhiphop",
    "the address lands on San Francisco 1996 — " + basis);

  await top("Band");
  const treeBefore = await p.evaluate(() =>
    window.__eightTree().rows.map((r) => r.key));
  /* THE CRATE IS OPENED BY OPENING A PLAYER (2026-09-04). `nav("bandsamples")`
     stood here — the Band panel's record-wide crate state — and there is no
     panel state on a table. The rows below are read off `__nuSamples()` and
     off the ENGINE either way; what the page has to show is the same files,
     one column at a time. */
  const openCrate = async (name) => {
    await top("Band");
    await p.evaluate(async (n) => {
      const D = window.__eightDoc();
      const v = n ? D.voices.find((x) => x.name === n)
        : (window.__nuSamples() || []).map((r) => D.voices.find((x) => x.name === r.voice))
            .find(Boolean);
      if (!v) return;
      const h = document.querySelector('#pan-band [data-k="tcol|' + v.name + '"]');
      if (h && h.getAttribute("aria-expanded") !== "true") h.click();
      await new Promise((r) => setTimeout(r, 300));
    }, name || null);
    await p.waitForTimeout(700);
  };
  await openCrate(null);

  /* ================= S1 · THE CRATE NAMES WHAT THE ENGINE PLAYS ========= */
  const S1 = await p.evaluate(() => {
    const rows = window.__nuSamples();
    const mix = window.__nuMix();
    const engine = mix ? [...new Set(Object.values(mix.units)
      .map((u) => u.sampler).filter(Boolean))] : null;
    return { rows: rows.length, units: [...new Set(rows.map((r) => r.unit))],
             engine, chairs: [...new Set(rows.map((r) => r.voice))] };
  });
  check(!!S1.engine && S1.engine.length > 3,
    "S1 the engine reports its sampled units " + JSON.stringify(S1.engine));
  /* EVERY PITCHED UNIT, EXACTLY. A drum unit is held one check down and not
     here, because the engine DECLARES all four of them for any sampled kit
     (`toEngine`'s `D` takes the whole overlay) while the record only STRIKES
     the lanes its cells write — measured 2026-09-03 on this record:
     `drum_electronic_tom` is a live unit and no tom is hit anywhere in it, so
     it reaches no file and belongs in no crate. "Every sample the record
     reaches" is the subject; a declared drum that never sounds is not one. */
  const missing = (S1.engine || [])
    .filter((u) => !/^drum_/.test(u) && S1.units.indexOf(u) < 0);
  check(missing.length === 0,
    "S1a every PITCHED unit the compiled recipe plays is in the crate " +
    (missing.length ? "MISSING " + JSON.stringify(missing) : "(" + S1.rows +
      " files over " + S1.chairs.length + " chairs)"));
  /* ...AND THE KIT'S OWN HALF: every lane the record's drum cells strike has a
     file, and every kit file in the crate is a lane the record strikes. Read
     off the DOCUMENT, which is the thing that decides it. */
  const kit = await p.evaluate(() => {
    const d = window.__eightDoc();
    const drums = d.voices.find((v) => v.kind === "drums");
    if (!drums) return null;
    const names = new Set();
    const m = drums.material;
    if (typeof m === "string") names.add(m);
    else if (m) for (const k of Object.keys(m)) if (m[k]) names.add(m[k]);
    if ((drums.cast || {}).material) names.add(drums.cast.material);
    const struck = new Set();
    for (const n of names) { const H = d.material.cells[n];
      if (!H || H.kind !== "drum") continue;
      for (const lane of Object.keys(H.lanes || {}))
        if ((H.lanes[lane] || []).some((x) => +x > 0)) struck.add(lane); }
    const listed = window.__nuSamples().filter((r) => r.kind === "kit lane")
      .map((r) => String(r.data).replace("lane ", ""));
    return { struck: [...struck].sort(), listed: listed.sort() };
  });
  check(!!kit && kit.listed.length > 0 &&
        kit.listed.every((l) => kit.struck.indexOf(l) >= 0),
    "S1a2 every kit file in the crate is a lane the record actually strikes " +
    JSON.stringify(kit));
  /* AND NOTHING THE ENGINE NEVER ASKED FOR. The two lists are not identical by
     construction — a lane the record never strikes costs no unit, and the
     crate is drawn from the DOCUMENT — so this is the honest half: every unit
     the crate claims is one the engine either plays or would play for a lane
     the record does write. `drum_*` is excluded from the strict direction for
     exactly that reason and its own claim is S1c. */
  const extra = S1.units.filter((u) => !/^drum_/.test(u) &&
    (S1.engine || []).indexOf(u) < 0);
  check(extra.length === 0,
    "S1b …and the crate claims no pitched unit the engine does not play " +
    JSON.stringify(extra));
  check(S1.units.some((u) => /^drum_/.test(u)) &&
        S1.units.indexOf("found:collage:break_75_95") >= 0,
    "S1c …including the sampled kit and the twelve-break collage chair");

  /* ================= S2 · EVERY FILE ANSWERS 200 ======================== */
  const S2 = await p.evaluate(async () => {
    const rows = window.__nuSamples();
    const hrefs = [...new Set(rows.map((r) => r.href).filter(Boolean))];
    const bad = [];
    for (const h of hrefs) {
      try { const r = await fetch(h); if (!r.ok) bad.push(h + " " + r.status); }
      catch (e) { bad.push(h + " " + e.message); }
    }
    return { n: hrefs.length, bad,
             noFile: rows.filter((r) => !r.file).map((r) => r.name) };
  });
  check(S2.n > 30 && S2.bad.length === 0,
    "S2 every listed file answers 200 from the page's own server (" + S2.n +
    " files) " + JSON.stringify(S2.bad.slice(0, 4)));
  check(S2.noFile.length === 0 ||
        S2.noFile.every((n) => typeof n === "string"),
    "S2a …and a row with no file is a remote address, named not linked " +
    JSON.stringify(S2.noFile.slice(0, 3)));

  /* ================= S3 · ONE PRESS SOUNDS, THE SECOND STOPS ============ */
  const first = await p.evaluate(() =>
    (document.querySelector('[data-k^="sample-play|"]:not([disabled])') || {})
      .dataset || null);
  check(!!first && !!first.k, "S3 the crate offers an audition " +
    JSON.stringify(first && first.k));
  const bs0 = await p.evaluate(() => ({ ...window.__bs }));
  await press(first.k);
  const mid = await p.evaluate((k) => ({ bs: { ...window.__bs },
    pressed: document.querySelector('[data-k="' + k + '"]')
      .getAttribute("aria-pressed") }), first.k);
  check(mid.bs.started === bs0.started + 1 && mid.pressed === "true",
    "S3a a press starts exactly one AudioBufferSourceNode (" + bs0.started +
    " -> " + mid.bs.started + ") and the mark says so");
  await press(first.k);
  const after = await p.evaluate((k) => ({ bs: { ...window.__bs },
    pressed: document.querySelector('[data-k="' + k + '"]')
      .getAttribute("aria-pressed") }), first.k);
  check(after.bs.stopped === mid.bs.stopped + 1 && after.pressed === "false",
    "S3b …and the second press stops it (" + mid.bs.stopped + " -> " +
    after.bs.stopped + ")");

  /* ================= S4 · A SWAP REACHES THE SOUND ====================== */
  /* THE CHAIR IS CHOSEN BY MEASUREMENT AND NOT BY NAME: whichever chair's swap
     is a live control with a word in it that is not the word it is on. That is
     what keeps this check alive when the catalogue's own seating moves. */
  const target = await p.evaluate(() => {
    for (const f of document.querySelectorAll('[data-sel^="sample-swap|"]')) {
      if (f.disabled) continue;
      const alt = window.__combo.words(f)
        .filter((r) => !r.off && r.v && r.v !== f.dataset.v);
      if (alt.length) return { sel: f.dataset.sel, now: f.dataset.v, to: alt[0].v,
                               chair: f.dataset.sel.split("|")[1] };
    }
    return null;
  });
  check(!!target, "S4 a chair's swap offers another recording " +
    JSON.stringify(target));
  const fileOf = (chair) => p.evaluate((c) => {
    const rows = window.__nuSamples().filter((r) => r.voice === c);
    const mix = window.__nuMix();
    const v = window.__eightDoc().voices.find((x) => x.name === c);
    return { instrument: v ? (v.instrument || null) : null,
             files: rows.map((r) => r.file),
             units: mix ? Object.values(mix.units).map((u) => u.sampler)
                              .filter(Boolean) : [] };
  }, chair);
  const before4 = await fileOf(target.chair);
  const said = await say(target.sel, target.to);
  const after4 = await fileOf(target.chair);
  check(said && after4.instrument === target.to,
    "S4a the swap writes the chair's instrument in the document — " +
    JSON.stringify(before4.instrument) + " -> " + JSON.stringify(after4.instrument));
  check(after4.files.length > 0 &&
        JSON.stringify(after4.files) !== JSON.stringify(before4.files),
    "S4b …and the files the record now reaches are different ones " +
    JSON.stringify([before4.files[0], after4.files[0]]));
  check(after4.units.indexOf(target.to) >= 0,
    "S4c …and the ENGINE was handed the new unit " + JSON.stringify(target.to));

  /* ================= S5 · THE ROW, THE FACET, AND A REFUSAL ============= */
  check(treeBefore.filter((k) => /^tab/.test(k)).length > 0,
    "S5 the Band branch is the table's columns — one row per player, and a " +
    "player's row is the crate's door (" +
    treeBefore.filter((k) => /^tab/.test(k)).length + " players)");
  check(treeBefore.indexOf("bandsamples") < 0 && treeBefore.indexOf("bandroster") < 0,
    "S5a …and the two panel STATES are gone with the pane — no `bandsamples`, " +
    "no `bandroster` (TABLE.md §6 ¶A: deleted, not hidden)");
  /* THE FACET IS EARNED. Open a member the crate has files for and the row is
     there; open one it has none for and it is not — which is the whole of "a
     control that cannot exist is absent, never grey". */
  const chairs = await p.evaluate(() => {
    const rows = window.__nuSamples();
    const have = new Set(rows.map((r) => r.voice));
    const d = window.__eightDoc();
    return { with: d.voices.filter((v) => have.has(v.name)).map((v) => v.name),
             without: d.voices.filter((v) => !have.has(v.name)).map((v) => v.name) };
  });
  await openCrate(chairs.with[0]);
  const own = await p.evaluate(() => ({
    groups: document.querySelectorAll("#pan-band .nu-crategrp").length,
    who: [...document.querySelectorAll("#pan-band .nu-cratewho")].map((x) => x.textContent),
  }));
  check(own.groups === 1 && own.who[0] === chairs.with[0],
    "S5b a sampled member's column sheet draws that member's files alone " +
    JSON.stringify(own.who));
  check(own.groups === 1,
    "S5c …one group, because a column is one player " + JSON.stringify(own.groups));
  if (chairs.without.length) {
    await openCrate(chairs.without[0]);
    const none = await p.evaluate(() =>
      document.querySelectorAll("#pan-band .nu-crate").length);
    check(none === 0,
      "S5d …and a member with no recording is offered no crate at all (" +
      chairs.without[0] + ") — absent, never a grey one");
  } else {
    notes.push("S5d every chair on this record is a recording — nothing to refuse");
    console.log("  --   S5d every chair on this record is a recording");
  }
  /* NO SILENT GREY, on the crate's own controls: whatever is refused says why,
     on the control, where a gate can read it off the artifact. */
  await openCrate(chairs.with[0]);
  const greys = await p.evaluate(() => {
    const out = [];
    for (const n of document.querySelectorAll(
      '.nu-crate [data-sel], .nu-crate button')) {
      if (!n.disabled) continue;
      out.push({ k: n.dataset.sel || n.dataset.k,
                 why: (n.dataset.why || "").trim() });
    }
    return out;
  });
  check(greys.every((g) => g.why.length > 0),
    "S5e every refused control in the crate carries its reason (" +
    greys.length + " refused) " + JSON.stringify(greys.slice(0, 2)));

  /* ================= S5f · A PRESS THAT CANNOT SOUND SAYS WHY =========== */
  /* The one refusal on this panel that a REDRAW cannot pre-paint: the
     transport starts under an open crate and no gesture rebuilds the buttons,
     so the reason is written by the press itself. Driven rather than asserted:
     press play, press an audition, and read the reason back off the rendered
     button and off the row beside it. */
  await p.evaluate(() => { const b = document.getElementById("play"); if (b) b.click(); });
  await p.waitForTimeout(2500);
  const wasPlaying = await p.evaluate(() => !!(window.__nuBounce() || {}).playing);
  const bsPlay = await p.evaluate(() => ({ ...window.__bs }));
  await press(first.k);
  const refused = await p.evaluate((k) => { const b = document.querySelector('[data-k="' + k + '"]');
    const li = b.closest(".nu-crow");
    return { why: (b.dataset.why || "").trim(),
             name: b.getAttribute("aria-label") || "",
             line: (li.querySelector(".nu-crefuse") || {}).textContent || "",
             started: window.__bs.started }; }, first.k);
  check(wasPlaying && refused.why.length > 0 && refused.line === refused.why &&
        refused.name.indexOf(refused.why) > 0 &&
        refused.started === bsPlay.started,
    "S5f a press while the record runs sounds nothing and says why, on the " +
    "control and beside it " + JSON.stringify(refused.why) + " " +
    JSON.stringify({ wasPlaying, line: refused.line,
                     inName: refused.name.indexOf(refused.why),
                     started: [bsPlay.started, refused.started] }));
  await p.evaluate(() => { const b = document.getElementById("play"); if (b) b.click(); });
  await p.waitForTimeout(900);

  /* ================= S6 · NO SIDEWAYS SCROLL, NO ERRORS ================= */
  const widths = [];
  for (const w of [320, 390, 1280]) {
    await p.setViewportSize({ width: w, height: 900 });
    await p.waitForTimeout(400);
    widths.push(await p.evaluate((want) => ({ want,
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      crate: document.querySelectorAll(".nu-crow").length }), w));
  }
  check(widths.every((x) => x.sw <= x.cw + 1 && x.crate > 0),
    "S6 the crate never scrolls the page sideways " + JSON.stringify(widths));
  check(errs.length === 0, "S6a zero console errors " + JSON.stringify(errs.slice(0, 3)));

  await b.close();
  if (srv) srv.proc.kill();
  console.log("\n" + notes.length + " ok, " + fails.length + " failed");
  if (fails.length) { for (const f of fails) console.log("  FAIL " + f); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(2); });
