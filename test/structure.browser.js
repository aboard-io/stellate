#!/usr/bin/env node
/* test/structure.browser.js — THE SECTION AUTOMATION GRIDS, DRIVEN ON THE PAGE
 * (2026-09-02, the composer round, slice 2d.)
 *
 * WHY THIS FILE EXISTS. Paul, B9: *"Sections/Structure has the same challenges.
 * Things should fly out under the nav item for each structure element. It should
 * be top level, not buried under band, and below band. Bring performance into
 * structure."* And, in the same breath: *"Make a section automation interface
 * for the manipulation of the motifs and put it under structure/sections …
 * Every section I can tweak every instrument. … for each question you add per
 * section, you could have a WHOLE section automation grid."* And, of the same
 * grid on the board (B11): *"the columns should list the instrument and when I
 * click on the column head let me edit the instrument! … I need to be able to
 * jump to a section somehow, by clicking on them when in automation."*
 *
 * TEST THE ARTIFACT. Every claim below is a claim about a thing a THUMB does
 * and about what the DOM or the rendered event stream did in answer. Nothing
 * asks a module what it would draw. Three features have shipped broken in this
 * repo while every structural check passed.
 *
 * THE CHECKS
 *   S1  the grids exist, one row per section, in the round's own order, and
 *       `form.pace` is NOT among them — it has exactly one control page-wide
 *       and it is the Tempo panel's pace strip (one owner per fact).
 *   S2  the `reads` and `does` columns are DOC.voices in DOC.voices' ORDER,
 *       each head wearing that player's CATEGORY slot and its instrument line.
 *   S3  a `reads` cell writes `voice.material[<secId>]` and the motif's own
 *       nav sub-line ("read by …") changes with it.
 *   S4  a `does` cell moves the RENDERED onsets (test/nudges.js's measurement).
 *   S5  a row head opens that section AND asks the transport for it.
 *   S6  a column head lands on that member's INSTRUMENT facet.
 *   S7  Band and Structure both visited: exactly one control per
 *       `key|voice|section`, nothing suffixed, no duplicate-key error.
 *   S8  the bass's `reads` cell is a REFUSAL carrying its measured reason.
 *   S9  zero pageerror, zero console error, across all of it.
 *
 * RUN: NODE_PATH=/home/ford/ftrain-2025/node_modules node test/structure.browser.js
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

/* THE SUBJECT IS NAMED IN THE ADDRESS, for the reason test/band.browser.js
   names it: the box opens on the blank state and draws a NEW SEED unless the
   URL carries one, so a gate that took what it was given would measure a
   different record every run. Kingston 1969 at reading 1 has thirteen sections,
   five lines, a BASS and a kit — a grid needs something to be a grid ABOUT. */
const REGGAE = "#at=Kingston&y=1969&s=1";

/* THE FIVE GRIDS, IN THE ROUND'S OWN ORDER, TYPED. A gate that read the
   captions off the page and compared them to themselves would prove nothing;
   this is COMPOSER.md §2.6's list, minus the one that is drawn elsewhere. */
const CAPS = ["reads", "does", "level", "shape", "the rest"];

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
  console.log("\nstructure — the section automation grids, on the rendered page");
  const srv = PAGE_ARG ? null : await standUpServer();
  const PAGE = PAGE_ARG || ("http://127.0.0.1:" + srv.port + "/nukernel/index.html");
  const b = await chromium.launch({ executablePath: EXE });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text()))
    errs.push("console: " + m.text()); });
  await p.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  await p.goto(PAGE + REGGAE, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);

  /* A TAB IS OPENED THE WAY A THUMB OPENS IT — `__eightTab` is the same call
     the stripe's own row makes (ui/eight.js says so at its definition). */
  const top = async (t) => { await p.evaluate((n) => window.__eightTab(n), t);
    await p.waitForTimeout(450); };
  const doc = () => p.evaluate(() => window.__eightDoc());
  const press = async (k) => { const hit = await p.evaluate((key) => {
      const el = document.querySelector('[data-k="' + key + '"]');
      if (!el || el.disabled) return false; el.click(); return true; }, k);
    await p.waitForTimeout(700); return hit; };
  const say = async (sel, v) => p.evaluate(([s, val]) => {
      const el = document.querySelector('select[data-sel="' + s + '"]');
      if (!el || el.disabled) return false;
      el.value = val;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return el.value === String(val); }, [sel, v])
    .then(async (r) => { await p.waitForTimeout(900); return r; });
  /* THE RENDERED STREAM, which is test/nudges.js's own measurement of "the
     sound moved": the onsets ui/derive.js actually produced for a section. */
  const onsets = (si) => p.evaluate((i) =>
    (window.__eightEvents(i) || []).map((e) => e.t), si);

  /* THE TEMPO PANEL IS OPENED FIRST AND LEFT BEHIND, so S1c can measure it.
     A panel is built the first time its tab is opened and then KEPT in the DOM
     (that is the whole of what the tabs buy), which is also exactly why the
     one-owner law needs measuring page-wide rather than per panel: two shut
     panels holding one `data-k` is the failure. A gate that never opened Tempo
     would read "no pace control anywhere" as a pass. */
  await top("Tempo");
  await top("Structure");

  /* ================= S1 · THE GRIDS ==================================== */
  const G = await p.evaluate(() => ({
    grids: [...document.querySelectorAll("#pan-structure .nu-sgrid")].map((t) => ({
      cap: (t.querySelector("caption") || {}).textContent || "",
      rows: t.querySelectorAll("tbody tr").length,
      /* a pane per grid, so each keeps its own sideways scroll across the
         redraw every cell tap causes (ui/eight.js keepPanes/putPanes) */
      paned: !!t.closest(".nu-pane"),
    })),
    secs: window.__eightDoc().form.sections.length,
    /* ONE OWNER PER FACT, MEASURED PAGE-WIDE rather than asserted in prose:
       the pace is a per-section question with a control, and it has exactly
       one, and it is the Tempo panel's (COMPOSER §2.5, Paul's B7). */
    pace: [...document.querySelectorAll('select[data-sel^="form.pace|"]')]
      .map((s) => (s.closest(".nu-pan") || {}).id || "?"),
  }));
  check(JSON.stringify(G.grids.map((x) => x.cap)) === JSON.stringify(CAPS),
    "S1 the five grids stand in COMPOSER §2.6's order " +
    JSON.stringify(G.grids.map((x) => x.cap)));
  check(G.grids.length > 0 && G.grids.every((x) => x.rows === G.secs),
    "S1a …one row per section in every one of them (" + G.secs + " sections, " +
    JSON.stringify(G.grids.map((x) => x.rows)) + ")");
  check(G.grids.every((x) => x.paned),
    "S1b …each in its own scroll pane");
  check(G.pace.length === G.secs && new Set(G.pace).size === 1 &&
        G.pace[0] === "pan-tempo",
    "S1c the sixth question, `pace`, has ONE owner and it is the Tempo panel " +
    JSON.stringify([...new Set(G.pace)]));

  /* ================= S2 · THE COLUMNS ARE THE BAND ===================== */
  const cols = await p.evaluate(() => {
    const g = [...document.querySelectorAll("#pan-structure .nu-sgrid")];
    const heads = (t) => [...t.querySelectorAll("thead th .nu-scol")].map((b) => ({
      key: b.dataset.k,
      name: (b.querySelector(".nu-scolname") || {}).textContent || "",
      instr: (b.querySelector(".nu-scolinstr") || {}).textContent || "",
      vi: (b.closest("th") || {}).dataset ? b.closest("th").dataset.vi : null,
      lamp: !!b.querySelector('[data-live="lamp"]'),
    }));
    return { reads: heads(g[0]), does: heads(g[1]),
             voices: window.__eightDoc().voices.map((v) => v.name) };
  });
  check(JSON.stringify(cols.reads.map((x) => x.name)) ===
        JSON.stringify(cols.voices),
    "S2 the `reads` columns are the band, in the record's own order " +
    JSON.stringify(cols.reads.map((x) => x.name)));
  check(JSON.stringify(cols.does.map((x) => x.name)) ===
        JSON.stringify(cols.voices),
    "S2a …and so are `does`'s");
  check(cols.reads.every((x) => /^[0-5]$/.test(String(x.vi))) &&
        new Set(cols.reads.map((x) => x.vi)).size > 1,
    "S2b …each head wearing that player's CATEGORY slot " +
    JSON.stringify(cols.reads.map((x) => x.vi)));
  /* THE BASS IS EXEMPT FROM THE INSTRUMENT LINE UNTIL A HAND NAMES ONE — the
     record composes it with no `instrument` and absent is the only spelling of
     a default (test/band.browser.js B1a makes the same allowance). */
  check(cols.reads.filter((x) => !x.instr.trim()).length <= 1,
    "S2c …and saying what that player is on " +
    JSON.stringify(cols.reads.filter((x) => !x.instr.trim()).map((x) => x.name)));
  check(cols.reads.every((x) => x.lamp),
    "S2d …with a lamp well that exists while the record is stopped " +
    "(motif-frozen A2: a surface that appears on play is the interface changing)");

  /* ================= S3 · A `reads` CELL MOVES THE RECORD =============== */
  const D0 = await doc();
  const SEC1 = D0.form.sections[1].id;
  /* THE FIRST MEMBER WITH SOMETHING TO CHOOSE. `cellsFor` answers with one cell
     for some players, and a menu that can only say what it already says is not
     drawn at all (the `> 1` rule) — so the subject is found rather than
     assumed. */
  /* …AND A MOTIF THIS PLAYER DOES NOT ALREADY READ SOMEWHERE ELSE, which is
     the difference between measuring the write and measuring the READERS. The
     nav's second line is `usesCell`, the RECORD-WIDE question ("read by stab,
     lead, bass"), so handing a voice a cell it already reads in another section
     is a true write with nothing to show for it in the stripe — measured on
     Kingston, where `stab` already reads `hook` in the head. */
  const subject = await p.evaluate((sec) => {
    const D = window.__eightDoc();
    const used = (name) => {
      const v = D.voices.find((x) => x.name === name) || {};
      const m = v.material;
      const out = new Set();
      if (typeof m === "string") out.add(m);
      else if (m && typeof m === "object") for (const k of Object.keys(m)) out.add(m[k]);
      return out;
    };
    const sels = [...document.querySelectorAll(
      '#pan-structure select[data-sel^="material.cell|"]')]
      .filter((s) => !s.disabled && s.dataset.sel.endsWith("|" + sec));
    for (const s of sels) {
      const voice = s.dataset.sel.split("|")[1];
      const mine = used(voice);
      const want = [...s.options].filter((o) => o.value && !o.disabled &&
        o.value !== s.value && !mine.has(o.value)).map((o) => o.value)[0];
      if (want) return { sel: s.dataset.sel, voice, was: s.value, want };
    }
    return null;
  }, SEC1);
  check(!!(subject && subject.want),
    "S3 a `reads` cell offers this record another motif " + JSON.stringify(subject));
  if (subject && subject.want) {
    /* THE MOTIF'S NAV SUB-LINE BEFORE, off the stripe rather than off a module:
       the gutter builds "N bars · read by …" and the gutter is what a person
       reads. */
    const subOf = async (cell) => { await top("Motif");
      return p.evaluate((c) => { const t = window.__eightTree();
        const r = t.rows.find((x) => x.key === "motiftab-" + c);
        return r ? r.sub : null; }, cell); };
    const before = await subOf(subject.want);
    await top("Structure");
    const took = await say(subject.sel, subject.want);
    const D1 = await doc();
    const v1 = D1.voices.find((v) => v.name === subject.voice) || {};
    const m1 = v1.material;
    check(took && m1 && typeof m1 === "object" && m1[SEC1] === subject.want,
      "S3a …and the tap writes voice.material[" + SEC1 + "] = " +
      JSON.stringify(m1 && m1[SEC1]) + " (wanted " + subject.want + ")");
    const after = await subOf(subject.want);
    check(before !== after && /read by/.test(String(after)),
      "S3b …and the motif's own nav sub-line says so: " +
      JSON.stringify(before) + " -> " + JSON.stringify(after));
    await top("Structure");
  }

  /* ================= S4 · A `does` CELL MOVES THE SOUND ================= */
  /* The same proof test/nudges.js makes of `dev.line`: an op-KEY word re-times
     the phrase and keeps every note, so what must move is the ONSETS. */
  const line = (await doc()).voices.find((v) => v.kind === "line");
  const devKey = "dev.line|" + (line || {}).name + "|" + SEC1;
  const ev0 = await onsets(1);
  const moved = await say(devKey, "backwards");
  const ev1 = await onsets(1);
  check(moved, "S4 the `does` grid offers `backwards` at " + devKey);
  check(JSON.stringify(ev0) !== JSON.stringify(ev1),
    "S4a …and the RENDERED onsets moved (" + ev0.length + " -> " + ev1.length +
    " events)");
  await say(devKey, "");

  /* ================= S5 · A ROW HEAD IS THE JUMP ======================= */
  const SEC3 = (await doc()).form.sections[3].id;
  const before5 = await p.evaluate(() => ({
    view: window.__eightViewSec(),
    play: (document.querySelector("#play") || {}).getAttribute
      ? document.querySelector("#play").getAttribute("aria-label") : null }));
  const hit5 = await press("srow|reads|" + SEC3);
  await p.waitForTimeout(900);
  const after5 = await p.evaluate((sec) => ({
    view: window.__eightViewSec(),
    tab: window.__eightTabNow(),
    /* the section's own questions are open — `sec<id>` is the heading
       `sectionDetail` answers to and is what a thumb lands on */
    detail: !!document.querySelector('#pan-structure [data-k="sec' + sec + '"]'),
    play: (document.querySelector("#play") || {}).getAttribute("aria-label"),
  }), SEC3);
  check(hit5 && after5.view === 3 && after5.detail && after5.tab === "Structure",
    "S5 a row head opens that section and makes it the one you are writing " +
    JSON.stringify(after5));
  /* …AND ASKS THE TRANSPORT FOR IT. `CTX.playFrom` is `startAt(si)` plus the
     play mark repainted; cold it seeks, playing it QUEUES on the next box line.
     What is measured is the ASK — the mark now offers to stop — because the
     landing is bars away behind an eight-second runway and this gate does not
     render audio to test. */
  check(/stop/i.test(String(after5.play)) && !/stop/i.test(String(before5.play)),
    "S5a …and puts the ear on it: the transport mark went " +
    JSON.stringify(before5.play) + " -> " + JSON.stringify(after5.play));
  await press("play");

  /* ================= S6 · A COLUMN HEAD IS THE PLAYER ================== */
  await top("Structure");
  const who = (await doc()).voices.find((v) => v.kind === "line");
  const hit6 = await press("scol|reads|" + who.name);
  const at6 = await p.evaluate((n) => ({
    tab: window.__eightTabNow(),
    /* the panel is showing THIS member's instrument, not somebody's roster */
    instr: !!document.querySelector('select[data-sel="sound.instrument|' + n + '"]'),
    facet: (window.__eightTray().rows.find((r) => r.key === "facet-inst") || {}).on,
  }), who.name);
  check(hit6 && at6.tab === "Band" && at6.instr,
    "S6 a column head opens that player's INSTRUMENT facet " + JSON.stringify(at6));

  /* ================= S7 · ONE CONTROL PER ADDRESS ====================== */
  /* `material.cell|<voice>|<section>` has two would-be owners — this grid and
     the Band tab's motif tray — and each draws it only while it is the open
     tab. ui/selects.js console.errors AND SUFFIXES a duplicate, so the proof is
     three readings: one control per key, no key wearing a `#`, and no error. */
  await top("Structure");
  await top("Band");
  await top("Structure");
  const S7 = await p.evaluate(() => {
    const keys = [...document.querySelectorAll("[data-sel]")].map((s) => s.dataset.sel);
    const scoped = keys.filter((k) => k.split("|").length === 3);
    const seen = {}, twice = [];
    for (const k of scoped) { if (seen[k]) twice.push(k); seen[k] = 1; }
    return { scoped: scoped.length, twice: [...new Set(twice)].slice(0, 4),
             suffixed: keys.filter((k) => k.indexOf("#") >= 0).slice(0, 4) };
  });
  check(S7.scoped > 20 && !S7.twice.length,
    "S7 exactly one control per key|voice|section after Band and Structure " +
    "were both visited (" + S7.scoped + " addresses, " +
    JSON.stringify(S7.twice) + " twice)");
  check(!S7.suffixed.length,
    "S7a …and nothing was suffixed " + JSON.stringify(S7.suffixed));
  check(!errs.filter((e) => /duplicate select key/.test(e)).length,
    "S7b …and no duplicate-key error was logged " +
    JSON.stringify(errs.filter((e) => /duplicate/.test(e)).slice(0, 2)));

  /* ================= S8 · THE BASS IS TOLD, IN THE CELL ================ */
  const bass = (await doc()).voices.find((v) => v.kind === "bass");
  const S8 = bass ? await p.evaluate((n) => {
    const s = document.querySelector(
      '#pan-structure select[data-sel^="material.cell|' + n + '|"]');
    return s ? { off: !!s.disabled, why: s.dataset.why || "",
                 name: s.getAttribute("aria-label") || "" } : null;
  }, bass.name) : null;
  check(!!S8 && S8.off && /first line|no line voice/.test(S8.why),
    "S8 the bass's `reads` cell is a refusal carrying its measurement " +
    JSON.stringify(S8));

  /* ================= S9 · NOTHING THREW ================================ */
  check(!errs.length, "S9 zero page and console errors " +
    JSON.stringify(errs.slice(0, 3)));

  await b.close();
  if (srv) srv.proc.kill();
  console.log("\nstructure: " + notes.length + " ok, " + fails.length + " failed");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error("structure: " + (e && e.stack || e)); process.exit(1); });
