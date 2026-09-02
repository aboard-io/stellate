#!/usr/bin/env node
/* test/band.browser.js — BUILD THE BAND, DRIVEN ON THE RENDERED PAGE
 * (2026-09-02, the composer round, slice 2c.)
 *
 * WHY THIS FILE EXISTS. Paul, B10, in one breath: *"On the nav I need to know
 * what they're playing as instruments. … List all the band members as separate
 * boxes. I need an obvious way to assign multiple motifs to band members. Maybe
 * a tray of motifs that pops up, but it should also give me the option to make
 * a new motif and jump back the motif editor."* And the sentence the round
 * serves: *"I want to BUILD THE BAND … I can hear the song evolve as I add and
 * take things away."*
 *
 * Every claim below is a claim about a thing a THUMB does and about what the
 * record or the ENGINE did in answer — TEST THE ARTIFACT, which on this branch
 * is not a slogan (three features have shipped broken while every structural
 * check passed). Nothing here reads a module's arithmetic back to itself.
 *
 * THE CHECKS
 *   B1  with no member open the Band panel is the ROSTER: one box per voice,
 *       each wearing its CATEGORY slot, its name, its instrument line and a
 *       preview per motif it reads, and a way to hear it alone.
 *   B2  `+ line` in the PANEL hires a player and lands on its instrument facet
 *       with the member's own nav row unfolded (add -> hear it -> choose).
 *   B3  a tray chip assigns a cell: `voice.material`'s default moves, the chip
 *       becomes pressed, and the member's NAV SUB-LINE changes with it.
 *   B4  `+ new motif` mints a cell at the BANK'S OWN LENGTH (with `acc`),
 *       hands it to this member, and lands on the Motif tab with it open.
 *   B5  a rename walks every reader — the bank's key, the string form and the
 *       map form — and a name already in the bank is refused WITH ITS REASON.
 *   B6  the bass's instrument menu changes what the ENGINE was handed: the
 *       document carries it, and the compiled unit for the bass seat moves.
 *   B7  Band and Structure both opened in one session and NO duplicate-key
 *       console error — the two panels share `material.cell|v|s` and each
 *       draws it only while it is the open tab.
 *   B8  zero pageerror, zero console error, across all of it.
 *
 * RUN: NODE_PATH=/home/ford/ftrain-2025/node_modules node test/band.browser.js
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

/* THE SUBJECT IS NAMED IN THE ADDRESS. The box opens on the blank state and
   draws a NEW SEED unless the URL carries one, so a gate that took what it was
   given would measure a different record every run. Kingston 1969 at reading 1
   is a record with several lines, a BASS and a kit — which is what a roster,
   a bass menu and a motif tray all need something to be about. */
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

(async () => {
  console.log("\nband — build the band, driven on the rendered page");
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
     the stripe's own button makes (ui/eight.js says so at its definition). */
  const top = async (t) => { await p.evaluate((n) => window.__eightTab(n), t);
    await p.waitForTimeout(450); };
  const doc = () => p.evaluate(() => window.__eightDoc());
  const press = async (k) => { const hit = await p.evaluate((key) => {
      const el = document.querySelector('[data-k="' + key + '"]');
      if (!el || el.disabled) return false; el.click(); return true; }, k);
    await p.waitForTimeout(700); return hit; };
  const say = async (sel, v) => { await p.evaluate(([s, val]) => {
      const el = document.querySelector('select[data-sel="' + s + '"]');
      if (!el) return; el.value = val;
      el.dispatchEvent(new Event("change", { bubbles: true })); }, [sel, v]);
    await p.waitForTimeout(900); };
  /* A TRAY MARK'S SECOND LINE, off the stripe rather than off a module: the
     gutter builds it and the gutter is what a person reads. `.nu-sub2` is
     ui/glyph.js `paintIcon`'s own class for it. */
  const navSub = (key) => p.evaluate((k) => {
    const el = document.querySelector('#nu-tray [data-k="' + k + '"] .nu-sub2');
    return el ? el.textContent : null; }, key);

  await top("Band");

  /* ================= B1 · THE BAND, AS BOXES ============================ */
  const roster = await p.evaluate(() => ({
    boxes: [...document.querySelectorAll(".nu-roster .nu-member")].map((m) => ({
      vi: m.dataset.vi,
      key: (m.querySelector(".nu-memopen") || {}).dataset
        ? m.querySelector(".nu-memopen").dataset.k : null,
      name: ((m.querySelector(".nu-memname") || {}).textContent || "").trim(),
      instr: ((m.querySelector(".nu-meminstr") || {}).textContent || "").trim(),
      previews: m.querySelectorAll(".nu-preview").length,
      solo: !!m.querySelector('button[data-k^="solo|"]'),
    })),
    adds: [...document.querySelectorAll('[data-k^="panel-add"]')].map((x) => x.dataset.k),
    voices: window.__eightDoc().voices.map((v) => v.name),
  }));
  check(roster.boxes.length === roster.voices.length && roster.boxes.length > 2,
    "B1 one box per band member (" + roster.boxes.length + " boxes, " +
    roster.voices.length + " voices)");
  check(JSON.stringify(roster.boxes.map((x) => x.name)) ===
        JSON.stringify(roster.voices),
    "…named with the record's own names, in the record's order " +
    JSON.stringify(roster.boxes.map((x) => x.name)));
  /* THE INSTRUMENT LINE IS THE ONE FACT PAUL ASKED THE PAGE FOR BY NAME. The
     BASS is exempt until a hand names one — the record composes it with no
     `instrument` and absent is the only spelling of a default (see B6) — so
     the claim is "every member that HAS a sound says what it is". */
  const noInstr = roster.boxes.filter((x) => !x.instr).map((x) => x.name);
  check(noInstr.length <= 1,
    "B1a every box says what that player is on " + JSON.stringify(noInstr));
  check(roster.boxes.every((x) => x.previews > 0),
    "B1b …and shows the motifs it reads as PICTURES (a .nu-preview each)");
  check(roster.boxes.every((x) => x.solo),
    "B1c …and can be heard alone");
  check(new Set(roster.boxes.map((x) => x.vi)).size > 1 &&
        roster.boxes.every((x) => /^[0-5]$/.test(String(x.vi))),
    "B1d …wearing a CATEGORY slot each " +
    JSON.stringify(roster.boxes.map((x) => x.vi)));
  check(roster.adds.indexOf("panel-addvoice") >= 0,
    "B1e …and the band can be grown from the panel " + JSON.stringify(roster.adds));

  /* ================= B2 · HIRING ONE LANDS ON ITS SOUND ================= */
  const n0 = (await doc()).voices.length;
  await press("panel-addvoice");
  const hired = await p.evaluate(() => {
    const d = window.__eightDoc();
    const last = d.voices[d.voices.length - 1];
    return { n: d.voices.length, name: last.name,
      facets: [...document.querySelectorAll('#nu-tray [data-k^="facet-"]')]
        .map((x) => x.dataset.k),
      // the panel is showing this member's INSTRUMENT, not somebody's roster
      instrSel: !!document.querySelector('select[data-sel="sound.instrument|' + last.name + '"]'),
      solo: !!document.querySelector('button[data-k="solo|' + last.name + '"]'),
      roster: document.querySelectorAll(".nu-roster .nu-member").length,
    };
  });
  check(hired.n === n0 + 1, "B2 the panel's + line hires a player (" + n0 +
    " -> " + hired.n + ")");
  check(hired.instrSel && hired.roster === 0,
    "B2a …and lands on the new member's INSTRUMENT facet, not the roster");
  check(hired.facets.length === 3 && hired.solo,
    "B2b …with its own nav row unfolded and a way to hear it " +
    JSON.stringify(hired.facets));

  /* ================= B3 · A CHIP ASSIGNS A CELL ========================= */
  const V = hired.name;
  await press("facet-plays");
  const trayShape = await p.evaluate((v) => ({
    chips: [...document.querySelectorAll('[data-k^="tray|' + v + '|"]')]
      .map((x) => ({ k: x.dataset.k, on: x.getAttribute("aria-pressed"),
                     svg: !!x.querySelector("svg.nu-preview") })),
    strip: [...document.querySelectorAll('select[data-sel^="material.cell|' + v + '|"]')].length,
    newm: !!document.querySelector('[data-k="tray-new|' + v + '"]'),
    secs: window.__eightDoc().form.sections.length,
  }), V);
  check(trayShape.chips.length > 1 && trayShape.chips.every((c) => c.svg),
    "B3 the tray is a chip per motif in the bank, each carrying its picture (" +
    trayShape.chips.length + ")");
  check(trayShape.strip === trayShape.secs,
    "B3a …with one per-section row under it (" + trayShape.strip + " of " +
    trayShape.secs + " sections)");
  const want = trayShape.chips.find((c) => c.on === "false");
  const wantCell = want.k.split("|")[2];
  /* THE MOTIF'S OWN ROW IS WHAT SAYS WHO READS IT (the member's row says what
     they PLAY — `playsWhat` — which is a different fact and does not move when
     a cell is assigned). Read before and after, off the stripe. */
  await top("Motif");
  const sub0 = await navSub("motiftab-" + wantCell);
  await top("Band");
  const mat0 = (await doc()).voices.find((x) => x.name === V).material;
  await press(want.k);
  const after3 = await p.evaluate((v) => ({
    material: window.__eightDoc().voices.find((x) => x.name === v).material,
    pressed: [...document.querySelectorAll('[data-k^="tray|' + v + '|"]')]
      .filter((x) => x.getAttribute("aria-pressed") === "true")
      .map((x) => x.dataset.k),
  }), V);
  const cell = want.k.split("|")[2];
  const defOf = (m) => (m && typeof m === "object" ? m[""] : m);
  check(defOf(after3.material) === cell,
    "B3b pressing a chip makes it this member's default cell — " +
    JSON.stringify(defOf(mat0)) + " -> " + JSON.stringify(defOf(after3.material)));
  check(after3.pressed.indexOf(want.k) >= 0,
    "B3c …and the chip is pressed afterwards");
  await top("Motif");
  const sub1 = await navSub("motiftab-" + wantCell);
  await top("Band");
  await press("facet-plays");
  check(sub1 !== sub0 && new RegExp("read by.*" + V).test(String(sub1)),
    "B3d …and that motif's gutter row now names its new reader " +
    JSON.stringify([sub0, sub1]));

  /* ================= B4 · + NEW MOTIF, AND THE JUMP ===================== */
  const bank0 = await p.evaluate(() => Object.keys(window.__eightDoc().material.cells));
  await press("tray-new|" + V);
  const made = await p.evaluate((v) => {
    const d = window.__eightDoc();
    const names = Object.keys(d.material.cells);
    const fresh = names.filter((n) => n !== "__x");
    return { names: fresh, tab: window.__eightTab ? null : null,
      openField: (document.querySelector('[data-k^="motif-name|"]') || {}).value || null,
      cells: d.material.cells,
      material: d.voices.find((x) => x.name === v).material,
      bars: (function () {
        const lens = names.map((n) => (d.material.cells[n].deg || []).length)
          .filter((L) => L > 0);
        return { lens: [...new Set(lens)] };
      })(),
    };
  }, V);
  const fresh = made.names.filter((n) => bank0.indexOf(n) < 0);
  check(fresh.length === 1, "B4 + new motif mints one cell " + JSON.stringify(fresh));
  check(defOf(made.material) === fresh[0],
    "B4a …and hands it to " + V + " — " + JSON.stringify(defOf(made.material)));
  check(made.openField === fresh[0],
    "B4b …and lands on the Motif tab with it open " +
    JSON.stringify(made.openField));
  const H = made.cells[fresh[0]];
  check(made.bars.lens.length === 1,
    "B4c …at the bank's own length, so every line cell is still one length " +
    JSON.stringify(made.bars.lens));
  check(!!H.acc && H.acc.length === H.deg.length &&
        H.vel.length === H.deg.length && H.play.length === H.deg.length,
    "B4d …with acc/vel/play all at deg.length (precompose G1's shape)");

  /* ================= B5 · A RENAME WALKS EVERY READER =================== */
  const before5 = await p.evaluate((c) => {
    const d = window.__eightDoc();
    return { readers: d.voices.filter((v) => {
      const m = v.material;
      return m === c || (m && typeof m === "object" &&
        Object.keys(m).some((k) => m[k] === c)); }).map((v) => v.name) };
  }, fresh[0]);
  const rename = async (from, to) => { await p.evaluate(([k, v]) => {
      const el = document.querySelector('[data-k="motif-name|' + k + '"]');
      if (!el) return; el.value = v;
      el.dispatchEvent(new Event("change", { bubbles: true })); },
    [from, to]); await p.waitForTimeout(900); };
  await rename(fresh[0], "ostinato");
  const after5 = await p.evaluate(([old, nw]) => {
    const d = window.__eightDoc();
    const holds = (v, c) => { const m = v.material;
      return m === c || (m && typeof m === "object" &&
        Object.keys(m).some((k) => m[k] === c)); };
    return { hasOld: Object.prototype.hasOwnProperty.call(d.material.cells, old),
             hasNew: Object.prototype.hasOwnProperty.call(d.material.cells, nw),
             stale: d.voices.filter((v) => holds(v, old)).map((v) => v.name),
             moved: d.voices.filter((v) => holds(v, nw)).map((v) => v.name),
             order: Object.keys(d.material.cells),
             field: (document.querySelector('[data-k="motif-name|' + nw + '"]') || {}).value || null };
  }, [fresh[0], "ostinato"]);
  check(!after5.hasOld && after5.hasNew,
    "B5 the bank's key moves " + JSON.stringify([fresh[0], "ostinato"]));
  check(!after5.stale.length &&
        JSON.stringify(after5.moved) === JSON.stringify(before5.readers),
    "B5a …and every reader moves with it — " + JSON.stringify(before5.readers) +
    " -> " + JSON.stringify(after5.moved) + ", stale " + JSON.stringify(after5.stale));
  check(after5.field === "ostinato",
    "B5b …and the field says the new name " + JSON.stringify(after5.field));
  // A NAME ALREADY IN THE BANK IS REFUSED, WITH THE REASON ON THE CONTROL
  const taken = after5.order.find((n) => n !== "ostinato");
  await rename("ostinato", taken);
  const refused = await p.evaluate((nw) => {
    const el = document.querySelector('[data-k="motif-name|' + nw + '"]');
    return { value: el ? el.value : null, why: el ? (el.dataset.why || "") : "",
             still: Object.keys(window.__eightDoc().material.cells) };
  }, "ostinato");
  check(refused.value === "ostinato" && /already holds/.test(refused.why),
    "B5c a name the bank already holds is refused WITH its reason " +
    JSON.stringify(refused.why));

  /* ================= B6 · THE BASS REACHES THE ENGINE =================== */
  await top("Band");
  const bassName = (await doc()).voices.filter((v) => v.kind === "bass")
    .map((v) => v.name)[0];
  check(!!bassName, "B6 the record has a bass to ask about");
  /* THROUGH THE GUTTER, because another member is open by now and the roster's
     `member|<name>` button is only on the page when none is. `tab<name>` is the
     stripe's own address for a member and works from either state. */
  await press("tab" + bassName);
  await press("facet-inst");
  const menu = await p.evaluate((v) => {
    const s = document.querySelector('select[data-sel="sound.bassinstrument|' + v + '"]');
    return s ? { n: s.options.length,
                 pick: [...s.options].map((o) => o.value)
                   .filter((x) => x && x !== "acoustic_bass")[0] } : null; }, bassName);
  check(!!menu && menu.n > 2,
    "B6a the bass has an instrument menu at last (" + (menu && menu.n) + " options)");
  /* THE UNIT THE ENGINE WAS HANDED, BEFORE AND AFTER. `__nuBarSecs()` compiles
     the plan (it is idempotent and needs no audio); `__nuMix()` then reports
     the units for the sounding bar — the artifact, not the arithmetic. */
  const unit = () => p.evaluate(() => { window.__nuBarSecs();
    const m = window.__nuMix(); if (!m) return null;
    const e = Object.entries(m.units).find(([, u]) => u.role === "bass");
    return e ? { k: e[0], sampler: e[1].sampler, module: e[1].module } : null; });
  const u0 = await unit();
  await say("sound.bassinstrument|" + bassName, menu.pick);
  const u1 = await unit();
  const docBass = (await doc()).voices.find((v) => v.name === bassName).instrument;
  check(docBass === menu.pick,
    "B6b the document carries the bass's instrument " + JSON.stringify(docBass));
  check(!!u0 && !!u1 && JSON.stringify(u0) !== JSON.stringify(u1),
    "B6c …and the ENGINE'S bass unit moves with it — " + JSON.stringify(u0) +
    " -> " + JSON.stringify(u1));

  /* ================= B6d · THE WAY BACK TO THE BAND ===================== */
  /* A member is open by now, which is the state a hand is in for most of this
     file. The tree has no ↑ (Paul: *"We should never need the 'up' icon"*), so
     the way back to the roster is its own ROW — `bandroster`, the first child
     of the Band branch, a sibling of the members with the mark on it while it
     is the open thing. It is a HAND on that button and not `__eightTab`,
     because arriving at the tab must not close the member somebody was looking
     at and this gate would not notice the difference if it used the probe. */
  const upTo = async () => { await p.evaluate(() => {
      const b2 = document.querySelector('#nu-tray [data-k="bandroster"]');
      if (b2) b2.click(); }); await p.waitForTimeout(600); };
  await top("Band");
  await press("tab" + bassName);
  const inMember = await p.evaluate(() =>
    document.querySelectorAll(".nu-roster .nu-member").length);
  await upTo();
  const backToBand = await p.evaluate(() => ({
    boxes: document.querySelectorAll(".nu-roster .nu-member").length,
    members: [...document.querySelectorAll('#nu-tray [data-k^="tab"]')].length,
  }));
  check(inMember === 0 && backToBand.boxes > 2,
    "B6d the band's own row comes back to the boxes from inside a member (" +
    inMember + " -> " + backToBand.boxes + ")");
  check(backToBand.members > 2,
    "B6e …with the branch still open under it (" + backToBand.members + " rows)");

  /* ================= B7 · TWO PANELS, ONE ADDRESS ====================== */
  /* The tray's per-section strip and Structure's section detail both draw
     `material.cell|<voice>|<section>`. ui/selects.js console.errors and
     SUFFIXES a duplicate, so the proof is two readings: no key wearing a `#`,
     and no error in `errs` (B8 reads the same list). */
  await top("Structure");
  await p.evaluate(async () => {
    const s = document.querySelector('.nu-traylist [data-k^="secnav"]');
    if (s) { s.click(); await new Promise((r) => setTimeout(r, 300)); } });
  await p.waitForTimeout(600);
  const onStruct = await p.evaluate(() => ({
    mat: [...document.querySelectorAll('select[data-sel^="material.cell|"]')]
      .map((s) => s.dataset.sel),
    suffixed: [...document.querySelectorAll("[data-sel]")]
      .map((s) => s.dataset.sel).filter((k) => k.indexOf("#") >= 0),
  }));
  await top("Band");
  await press("tab" + bassName);
  await top("Structure");
  await top("Band");
  const onBand = await p.evaluate(() => ({
    suffixed: [...document.querySelectorAll("[data-sel]")]
      .map((s) => s.dataset.sel).filter((k) => k.indexOf("#") >= 0),
  }));
  check(onStruct.mat.length > 1 && !onStruct.suffixed.length,
    "B7 Structure owns the per-section reads while it is open (" +
    onStruct.mat.length + " menus, 0 suffixed)");
  check(!onBand.suffixed.length,
    "B7a …and walking Band -> Structure -> Band suffixes nothing " +
    JSON.stringify(onBand.suffixed));
  check(!errs.filter((e) => /duplicate select key/.test(e)).length,
    "B7b …and no duplicate-key error was logged " +
    JSON.stringify(errs.filter((e) => /duplicate/.test(e)).slice(0, 2)));

  /* ================= B8 · NOTHING THREW ================================ */
  check(!errs.length, "B8 zero page and console errors " +
    JSON.stringify(errs.slice(0, 3)));

  await b.close();
  if (srv) srv.proc.kill();
  console.log("\nband: " + notes.length + " ok, " + fails.length + " failed");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error("band: " + (e && e.stack || e)); process.exit(1); });
