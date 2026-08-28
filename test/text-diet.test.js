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

/* the ceiling this wave achieved (see header), and the law's own hard line.
   THE NUMBER IS NOW A SUM OVER THE NINE TABS (2026-08-27) and it is the same
   number for the same reason: it counts every word of prose the record can
   show a reader, whether the page shows them one after another down a scroll
   or one panel at a time. Re-measured the day the tabs landed and printed by
   this gate on every run. */
const ACHIEVED = 933;
const CEILING = Math.ceil(ACHIEVED * 1.10);   // 1027
const HARD = 1200;

/* PAUL'S OWN LIST, 2026-08-27: *"The tabs are: Where / Tempo / Key / Motif /
   Band / Mix / Produce / Score / Export."* This is T2's one fact now, and it
   is typed rather than read off the page for the reason every quotation in a
   gate is typed: the page agreeing with itself is not evidence. */
const TABS = ["Where", "Tempo", "Key", "Motif", "Band",
              "Mix", "Produce", "Score", "Export"];

/* …AND THE VOCABULARY'S OWN NAMES, WHICH ARE STILL IN THE DOCUMENT AND ARE NO
   LONGER ON THE SCREEN. This was T2's whole fact and it read: "the §5 table's
   final heading list, in SCROLL ORDER — ordinals gone, Alphabet→Harmony,
   Sheet music→Motifs, one case rule". There is no scroll order any more; there
   is Paul's tab order, above. The headings themselves did not go — nu.css
   makes `.nu-ax > h2` visually hidden (THE SECOND BAND IS THE TAB ROW), so
   they are still the document's structure, still what a screen reader
   announces, and still what the page reads as with the stylesheet off. What
   they stopped being is a SECOND visible name for a panel the tab already
   names — one owner per fact. So the list is asserted where it now lives:
   one `<h2>` per panel, in tab order, still saying the vocabulary's words.
   `Export` joins it because Paul made the export row a tab of its own. */
const HEADINGS = ["Where & when", "Time", "Harmony", "Motifs",
                  "The band", "The board", "The producer", "The score",
                  "Export"];

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
    /* THE OPEN PANEL'S OWN HEADING, not every h2 on the page. Eight panels out
       of nine are shut but still in the DOM once they have been built, so a
       document-wide query would return the headings of every tab the walk has
       already visited, in build order, and grow by one on every step. */
    h2: (() => { const pan = document.querySelector(".nu-pan:not([data-off])");
      const h = pan && pan.querySelector("h2");
      return h ? h.textContent.trim() : null; })(),
    /* THE TAB'S NAME IS ITS `aria-label` SINCE 2026-08-28, because the nine
       are glyphs now (Paul: "make all the tabs and top buttons into sensible
       icons"). T2's claim never was "these characters are painted here" — it
       is "the page names its sections, in Paul's words, in Paul's order" — and
       the accessible name is where that word lives. `nakedTabs` below is the
       other half and it is new: a glyph with no name would satisfy a list of
       words read off `aria-label` and fail a reader, so the gate asks for the
       `.nu-vh` word as well. Between them, "no control is naked" is measured
       rather than assumed. */
    /* OFF THE STRIPE'S ROOT LEVEL SINCE 2026-08-28. This read `#toptabs
       button` — the nine drawn as a horizontal band. Paul: *"There should be
       one vertical stripe max with an 'up' icon to get to the parent level"*,
       so the nine are the ROOT level of `#nu-tray` and the level is put back
       to root before they are read (`__eightUp` is the ↑ button pressed, the
       same call the button makes). T2's claim is unchanged and unweakened:
       "the page names its sections, in Paul's words, in Paul's order". */
    tabNames: (() => { if (window.__eightUp) window.__eightUp();
      return [...document.querySelectorAll(".nu-traylist button")]
        .map((b) => (b.getAttribute("aria-label") || "").trim()); })(),
    nakedTabs: [...document.querySelectorAll("button .nu-g")]
      .map((g) => g.closest("button"))
      .filter((b) => !(b.getAttribute("aria-label") || "").trim() ||
                     !b.querySelector(".nu-vh") ||
                     !b.querySelector(".nu-vh").textContent.trim())
      .map((b) => b.dataset.k || b.id || "?"),
    openTab: window.__eightTabNow ? window.__eightTabNow() : null,
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
    await p.waitForTimeout(2000);
    /* ---- THE DIET IS MEASURED TAB BY TAB AND ADDED UP (2026-08-27) --------
       Paul: *"Why don't we make tabs at the top level and let go of the idea
       of scrolling everything?"* This gate's own definition of prose already
       excluded "anything hidden by CSS (the deck's folded view is not on the
       page)", and eight of the nine panels are `display: none` at any instant
       — so ONE reading of the tabbed page would have measured a ninth of the
       words and called the diet kept. The law is about how much prose the
       RECORD shows a reader, so the walk opens each tab through the page's own
       `window.__eightTab` and sums. The `#strips .nu-strip` wait went with it:
       the board is behind the Mix tab and there is nothing to wait for until
       that tab is opened. */
    const m = { total: 0, top: [], h2: [], naked: [], rateSel: 0,
                tabNames: [], nakedTabs: [], per: {} };
    for (const t of TABS) {
      await p.evaluate((tt) => window.__eightTab && window.__eightTab(tt), t);
      await p.waitForTimeout(t === "Score" ? 1600 : 500);
      const r = await p.evaluate(MEASURE);
      m.total += r.total;
      m.per[t] = r.total;
      m.top = m.top.concat(r.top).sort((a, b) => b.chars - a.chars).slice(0, 8);
      m.h2.push(r.h2);
      m.naked = m.naked.concat(r.naked);
      m.rateSel += r.rateSel;
      m.tabNames = r.tabNames;
      m.nakedTabs = m.nakedTabs.concat(r.nakedTabs);
    }
    console.log("     [" + width + "] prose per tab: " +
      TABS.map((t) => t + " " + m.per[t]).join(" · "));

    check(m.total <= CEILING,
      "T1 " + width + " · static prose is " + m.total + " chars ≤ " + CEILING +
      " (the achieved " + ACHIEVED + " +10%)" +
      (m.total > CEILING ? " — grew: " +
        m.top.map((r) => r.chars + " " + JSON.stringify(r.t.slice(0, 40))).join("; ") : ""));
    check(m.total < HARD,
      "T1 " + width + " · …and under the plan's own hard line " + HARD +
      " (FUTURE.md Phase 1)");
    check(JSON.stringify(m.tabNames) === JSON.stringify(TABS),
      "T2 " + width + " · the nine tabs are Paul's words in Paul's order — " +
      JSON.stringify(m.tabNames));
    /* T2 · …AND NO CONTROL IS NAKED, which is the half of this gate's claim
       that a row of pictures can newly get wrong (2026-08-28). A glyph button
       must carry its full word twice — as `aria-label`, so a screen reader
       hears "reverb" and not "almost equal to", and as a `.nu-vh` span, so the
       page still reads as itself with the stylesheet off. Summed over all nine
       tabs, so the band's, the board's, the motifs' and the deck's strips are
       all measured and not just the nine at the top. */
    check(m.nakedTabs.length === 0,
      "T2 " + width + " · every glyph carries its word, as a name and in the " +
      "DOM — " + (m.nakedTabs.length ? JSON.stringify(m.nakedTabs.slice(0, 8))
                                     : "none naked"));
    check(JSON.stringify(m.h2) === JSON.stringify(HEADINGS),
      "T2 " + width + " · one hidden <h2> per panel, in tab order, still the " +
      "vocabulary's own names — " + JSON.stringify(m.h2));
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
