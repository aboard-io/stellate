/* test/text-diet.test.js — THE TEXT DIET IS A LAW WITH A NUMBER.
 *
 * FUTURE.md §2 (Paul: "get rid of all extra text"): three kinds of words may
 * exist outside [data-live] — control labels, refusals-with-reasons, and
 * value captions. This gate measures the RENDERED page (test-the-artifact:
 * a source count would bless prose a hidden branch never draws and miss
 * prose a template assembles), at both widths shell.js measures, and holds
 * three claims:
 *
 *   T1  static prose stays under the ceiling this wave achieved plus 10%,
 *       and under the plan's own < 1200. Measured on 2026-08-27, the day the
 *       diet landed: 933 chars at 1280 and at 390 (from 3,688 in the UX
 *       review that wrote the law). The +10% is room for value captions that
 *       grow with the record (the atlas sentence, the deck caption), not for
 *       new paragraphs.
 *   T2  the heading list IS the §5 rename table's final list, in order —
 *       ordinals gone, Alphabet→Harmony, Sheet music→Motifs, one case rule.
 *   T3  every disabled control still carries a non-empty reason — the diet
 *       must never have been paid for with a refusal (refusals are
 *       load-bearing and excluded from the count precisely so deleting them
 *       buys nothing).
 *
 * WHAT COUNTS AS PROSE, written down so the number means something. A text
 * node counts unless an ancestor is one of:
 *   · machine surfaces: script/style/svg/noscript, [aria-hidden=true],
 *     anything hidden by CSS (the deck's folded view is not on the page);
 *   · the clock's: [data-live] — the playhead may write what it likes there;
 *   · labels: h1–h4, button, select/option/optgroup, label, output, legend,
 *     th, summary, a (a link is a control), and the page's own label classes
 *     .nu-rowlab / .nu-vs-lab / .nu-flowlab / .nu-vh;
 *   · refusals: .nu-why, .nu-refusals, .nu-mutewhy (the bench's "held — 1̂
 *     still rings" line is the WHY of that row's disabled bars).
 * Everything left — nu-hint captions, bus in/out lines, the atlas sentence,
 * export subtitles — is the prose the diet governs, and it counts whole.
 */
"use strict";
const path = require("path");
const fs = require("fs");
const os = require("os");

const PAGE = process.env.PAGE || "http://localhost:8777/nukernel/index.html";

/* the ceiling this wave achieved (see header), and the law's own hard line */
const ACHIEVED = 933;
const CEILING = Math.ceil(ACHIEVED * 1.10);   // 1027
const HARD = 1200;

/* the §5 table's final heading list, in scroll order — T2's one fact */
const HEADINGS = ["Where & when", "Time", "Harmony", "Motifs",
                  "The band", "The board", "The producer", "The score"];

function executable() {
  const p = path.join(os.homedir(),
    ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
  if (!fs.existsSync(p)) { console.error("no chromium at " + p); process.exit(2); }
  return p;
}
let chromium;
try { chromium = require("playwright").chromium; }
catch (e) { console.error("playwright not on NODE_PATH — " +
  "NODE_PATH=/home/ford/ftrain-2025/node_modules"); process.exit(2); }

const fails = [], notes = [];
const check = (ok, what) => { (ok ? notes : fails).push((ok ? "ok   " : "FAIL ") + what); };

const MEASURE = () => {
  const SKIP = "script,style,svg,noscript,[data-live],h1,h2,h3,h4,button," +
    "select,option,optgroup,label,output,legend,th,summary,a," +
    "[aria-hidden=true],.nu-why,.nu-refusals,.nu-mutewhy," +
    ".nu-rowlab,.nu-vs-lab,.nu-flowlab,.nu-vh";
  const hidden = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden") return true;
      if (e.hidden) return true;
    }
    return false;
  };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const rows = []; let n;
  while ((n = w.nextNode())) {
    const t = n.textContent.replace(/\s+/g, " ").trim();
    if (!t) continue;
    const el = n.parentElement;
    if (!el || el.closest(SKIP) || hidden(el)) continue;
    rows.push({ t, chars: t.length,
                where: String(el.className || el.tagName).slice(0, 40) });
  }
  return {
    total: rows.reduce((a, r) => a + r.chars, 0),
    top: rows.sort((a, b) => b.chars - a.chars).slice(0, 8),
    h2: [...document.querySelectorAll("h2")].map((h) => h.textContent.trim()),
    rateSel: document.querySelectorAll('select[data-sel^="time.rate"]').length,
    /* T3 — every visible disabled control and where its reason lives. A
       reason is data-why on the control itself, or a .nu-why / .nu-mutewhy
       with text in the control's own row/slot/card (the mp3 button's sentence
       sits beside it; a bench bar's sits on its row). */
    naked: [...document.querySelectorAll(
      "button[disabled],input[disabled],select[disabled]")]
      .filter((c) => !hidden(c))
      .filter((c) => {
        if ((c.dataset.why || "").trim()) return false;
        /* the reason may sit one host out: a bench row's disabled weight bar
           is explained by the row's own .nu-mutewhy (in the pitch cell), so
           the row is searched as well as the cell. */
        const hosts = [c.closest("td,.nu-slot,.nu-exp,.nu-vs,.nu-benchbar,p"),
                       c.closest("tr"), c.closest(".nu-plate")];
        return !hosts.some((h) => {
          const why = h && h.querySelector(".nu-why,.nu-mutewhy");
          return why && why.textContent.trim();
        });
      })
      .map((c) => (c.dataset.k || c.getAttribute("aria-label") || c.tagName)),
  };
};

(async () => {
  const b = await chromium.launch({ executablePath: executable() });
  for (const width of [1280, 390]) {
    const p = await b.newPage({ viewport: { width, height: 900 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
    await p.goto(PAGE, { waitUntil: "networkidle" });
    await p.waitForSelector("#strips .nu-strip", { timeout: 20000 });
    await p.waitForTimeout(1500);
    const m = await p.evaluate(MEASURE);

    check(m.total <= CEILING,
      "T1 " + width + " · static prose is " + m.total + " chars ≤ " + CEILING +
      " (the achieved " + ACHIEVED + " +10%)" +
      (m.total > CEILING ? " — grew: " +
        m.top.map((r) => r.chars + " " + JSON.stringify(r.t.slice(0, 40))).join("; ") : ""));
    check(m.total < HARD,
      "T1 " + width + " · …and under the plan's own hard line " + HARD +
      " (FUTURE.md Phase 1)");
    check(JSON.stringify(m.h2) === JSON.stringify(HEADINGS),
      "T2 " + width + " · the heading list IS the §5 table's final list — " +
      JSON.stringify(m.h2));
    check(m.rateSel === 0,
      "T2 " + width + " · the `reading speed` menu stays deleted — the tempo " +
      "glyphs own time.rate (" + m.rateSel + " rate selects)");
    check(m.naked.length === 0,
      "T3 " + width + " · every disabled control carries a non-empty reason — " +
      (m.naked.length ? "naked: " + JSON.stringify(m.naked.slice(0, 8)) : "none naked"));
    check(errs.length === 0,
      width + " · no page errors (" + (errs[0] || "clean") + ")");
    await p.close();
  }
  await b.close();
  for (const n of notes) console.log(n);
  for (const f of fails) console.log(f);
  console.log(fails.length ? "\n" + fails.length + " FAIL of " +
    (fails.length + notes.length) : "\nALL PASS (" + notes.length + " checks)  " + PAGE);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
