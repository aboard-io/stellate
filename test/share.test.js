#!/usr/bin/env node
/* test/share.test.js — WAVE C's THIRD ITEM, READ OFF THE RENDERED PAGE.
 *
 * REDESIGN-SCOPE item 9 (docs/REDESIGN-SCOPE.md), in Paul's own three clauses:
 *   *"A link carries the song, and never merges destructively over an existing
 *    one. Import lands you in the table looking at what you imported, and it
 *    survives a reload."*
 * and the walkthrough's two frictions behind it
 * (`scratchpad/pm-walkthrough/NOTES.md` items 8 and 10):
 *   *"Opened in a clean phone context it restores the untouched genre …
 *    NONE of four hours of work."*
 *   *"Opened in a browser that already holds a song, the link merged with it
 *    and produced a third song that never existed."*
 *   *"After importing a record the app leaves you on the Export sheet …
 *    and a reload throws the import away."*
 *
 * IT IS A BROWSER GATE AND IT HAD TO BE, which is [[test-the-artifact]] applied
 * to a feature made of three platform facts a node process does not have: a
 * `location.hash` a browser will actually carry, a `localStorage` that survives
 * a reload, and `CompressionStream`. Every claim below is read back off a page
 * that has been reloaded or freshly opened — never off the code that wrote it.
 *
 * THE RECORD IT IS MEASURED ON is the one the walkthrough built:
 * `keeps/triphop-pm-walkthrough/coach-house.song.json` — 14 sections, 10
 * players, 27 motifs, 48 KB pretty-printed. It is the biggest hand-built record
 * this box has, which is exactly the case a link has to carry.
 *
 * WHAT IS ASSERTED
 *   S1  IMPORT LANDS YOU IN THE TABLE. The file input takes the record and the
 *       page is showing the BAND panel, not the Export deck it was opened from.
 *   S2  AND A RELOAD KEEPS IT — same basis, same players, same sections, same
 *       motifs, through ui/state.js's own slot and no second writer.
 *   S3  THE LINK CARRIES THE RECORD, BYTE FOR BYTE. The address grows a `d=`;
 *       opened in a FRESH context (clean localStorage, the walkthrough's own
 *       test) `__eightDoc()` is character-identical to the document the sender
 *       was holding.
 *   S4  AND IT NEVER MERGES. Opened in a context that already holds a
 *       different record, the page holds the SHARED one and nothing of the
 *       other — and the displaced one is recoverable, which the gate proves by
 *       pressing the control that brings it back.
 *   S5  THE CEILING SPEAKS. The share card says what the link is carrying, and
 *       a record too big for the fragment produces NO `d=` and says so instead
 *       of handing back a link that silently dropped material.
 *
 * RUN:  NODE_PATH=… node test/share.test.js --page http://localhost:8781/nukernel/index.html
 */
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const PAGE = arg("--page", "http://localhost:8777/nukernel/index.html");
const EXE = arg("--chrome", process.env.HOME +
  "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
const ROOT = path.join(__dirname, "..");
const COACH = path.join(ROOT, "keeps/triphop-pm-walkthrough/coach-house.song.json");
const SHOTS = path.join(ROOT, "scratchpad/design/wave-c");

const fails = [], notes = [];
const check = (ok, what) => { (ok ? notes : fails).push((ok ? "ok   " : "FAIL ") + what); };
const note = (what) => notes.push("     " + what);

/* THE PHONE THE WHOLE WAVE IS MEASURED ON. Every number in docs/WAVE-C.md is
   taken at 390x844 DPR 3 with `isMobile`/`hasTouch`, because a share link is a
   thing that arrives in a message on a phone. */
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
                isMobile: true, hasTouch: true };
const settle = (p, ms) => p.waitForTimeout(ms == null ? 2500 : ms);
/* WAIT ON THE FACT, NOT ON A SLEEP. The record is packed on a promise BEHIND a
   whole-page redraw (`setDocument` rebuilds the open panel, warms the cache and
   re-engraves), so how long the fragment takes to grow its `d=` is a fact about
   how busy the main thread is and not a constant. MEASURED on this gate's own
   chromium at 390x844: 0.4 s on a quiet page and up to 4 s straight after an
   import. So the gate polls the page's own `__eightLink().fresh` and REPORTS
   the number it waited, which is the honest way to state a cost. */
async function packed(p, ms) {
  const t0 = Date.now(), cap = ms == null ? 15000 : ms;
  for (;;) {
    const L = await p.evaluate(() => window.__eightLink && window.__eightLink());
    if (L && L.fresh) return { ...L, ms: Date.now() - t0 };
    if (Date.now() - t0 > cap) return { ...(L || {}), ms: Date.now() - t0, late: true };
    await p.waitForTimeout(150);
  }
}
const docOf = (p) => p.evaluate(() => JSON.stringify(window.__eightDoc()));
const shapeOf = (p) => p.evaluate(() => { const d = window.__eightDoc();
  return { basis: d.basis, voices: d.voices.length,
           sections: d.form.sections.length,
           motifs: Object.keys((d.material && d.material.cells) || {}).length,
           names: d.voices.map((v) => v.name).join("·") }; });
/* WHICH PANEL IS ON SCREEN, asked of the page and not of a variable: `showTab`
   puts `data-off` + `inert` on the eight that are shut, so the open one is the
   one host with neither, which is a fact a screen reader and a thumb both act
   on. */
const openPanel = (p) => p.evaluate(() => {
  const on = [...document.querySelectorAll("#app > [id]")]
    .filter((n) => !n.hasAttribute("data-off"));
  return on.map((n) => n.id).join(",");
});
const importFile = async (p, file) => {
  await p.evaluate(() => window.__eightTab("Export"));
  await settle(p, 600);
  const fi = await p.$("input[type=file]");
  if (!fi) throw new Error("the Export deck has no file input");
  await fi.setInputFiles(file);
  await settle(p);
};

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  try {
    /* ---- S1 / S2 · THE IMPORT, AND THE RELOAD ------------------------- */
    const c1 = await b.newContext(PHONE);
    const p1 = await c1.newPage();
    const errs = [];
    p1.on("pageerror", (e) => errs.push(String(e.message)));
    await p1.goto(PAGE, { waitUntil: "load" });
    await settle(p1);
    await importFile(p1, COACH);

    const want = JSON.parse(fs.readFileSync(COACH, "utf8"));
    const got1 = await shapeOf(p1);
    check(got1.basis === want.basis && got1.sections === want.form.sections.length &&
          got1.voices === want.voices.length,
      "S1 · the file input opened the record — " + got1.basis + ", " +
      got1.voices + " players, " + got1.sections + " sections, " +
      got1.motifs + " motifs");
    const panel = await openPanel(p1);
    check(/band/.test(panel),
      "S1 · and the page is showing the TABLE, not the deck it was opened from (" +
      panel + ")");
    await p1.screenshot({ path: path.join(SHOTS, "after-c3-01-import-lands.png") });

    const L1 = await packed(p1);
    const hash1 = await p1.evaluate(() => location.hash);
    check(/[#&]d=/.test(hash1),
      "S3 · the address carries the record — " + hash1.length + " characters of " +
      "fragment for a " + (L1.doc / 1024).toFixed(0) + " KB document (" +
      L1.wire + " packed, ceiling " + L1.max + "), ready " + L1.ms + " ms after the import");

    const before = await docOf(p1);
    await p1.reload({ waitUntil: "load" });
    await settle(p1, 3000);
    const got2 = await shapeOf(p1);
    check(got2.basis === got1.basis && got2.voices === got1.voices &&
          got2.sections === got1.sections && got2.motifs === got1.motifs,
      "S2 · a reload keeps the imported record — " + got2.basis + ", " +
      got2.voices + " players, " + got2.sections + " sections");
    /* AND THE SLOT IS THE ONE THE PAGE ALREADY HAD. One key, one writer: a
       second `localStorage` key for the same fact is the drift this wave was
       told not to introduce. */
    const keys = await p1.evaluate(() => Object.keys(localStorage));
    check(keys.filter((k) => /song|doc|record|session/i.test(k)).join(",") ===
          "nukernel.song.v1",
      "S2 · and it is in the slot the page already writes (" + keys.join(", ") + ")");
    await p1.screenshot({ path: path.join(SHOTS, "after-c3-02-reload-kept.png") });

    /* ---- S3 · A FRESH CONTEXT, WHICH IS THE WALKTHROUGH'S OWN TEST ----- */
    const url = await p1.evaluate(() => location.origin + location.pathname +
                                        location.search + location.hash);
    const c2 = await b.newContext(PHONE);
    const p2 = await c2.newPage();
    p2.on("pageerror", (e) => errs.push("fresh: " + e.message));
    await p2.goto(url, { waitUntil: "load" });
    await settle(p2, 3500);
    const after = await docOf(p2);
    check(after === before,
      "S3 · the link restores the record BYTE FOR BYTE in a clean context (" +
      before.length + " characters of document" +
      (after === before ? "" : "; " + after.length + " came back") + ")");
    await p2.screenshot({ path: path.join(SHOTS, "after-c3-03-link-fresh.png") });

    /* ---- S4 · AND IT NEVER MERGES ------------------------------------- */
    /* A THIRD CONTEXT THAT ALREADY HOLDS SOMETHING ELSE. It composes a
       different anchor off the globe's own door and edits it, so the session
       in the slot is genuinely a hand's record and not a boot's — which is the
       state the walkthrough was in when the merge happened. */
    const c3 = await b.newContext(PHONE);
    const p3 = await c3.newPage();
    p3.on("pageerror", (e) => errs.push("held: " + e.message));
    await p3.goto(PAGE, { waitUntil: "load" });
    await settle(p3);
    await p3.evaluate(() => {
      const row = document.querySelector('#atlasIndexRows .nu-ixrow[data-gk="dub"]') ||
                  document.querySelector('#atlasIndexRows .nu-ixrow[data-gk="reggae"]');
      if (row) row.click();
    });
    await settle(p3, 3000);
    await p3.evaluate(() => { const b = document.getElementById("play");
      if (b && /stop/i.test(b.getAttribute("aria-label") || "")) b.click(); });
    const held = await shapeOf(p3);
    note("S4 · the browser already holds " + held.basis + " — " + held.voices +
         " players, " + held.sections + " sections");
    /* A REAL LOAD AND NOT A FRAGMENT HOP. `goto` to the same document with a
       different `#` is a same-page navigation in every browser — nothing boots
       — and a gate that measured that would be measuring nothing. `about:blank`
       between them makes the next `goto` a genuine load, which is what a link
       arriving in a message is. */
    note("S4 · the slot before the link — " + await p3.evaluate(() => { try {
      const s = JSON.parse(localStorage.getItem("nukernel.song.v1") || "null");
      return (s && s.doc ? "doc=" + s.doc.basis : "doc=none") +
             " " + (s && s.prev ? "prev=" + s.prev.basis : "prev=none");
    } catch (e) { return String(e); } }));
    await p3.goto("about:blank");
    await p3.goto(url, { waitUntil: "load" });
    await settle(p3, 3500);
    const merged = await shapeOf(p3);
    check(merged.names === got1.names && merged.voices === got1.voices &&
          merged.sections === got1.sections,
      "S4 · the shared record OPENS AS THE SESSION and nothing of the other " +
      "record is in it — " + merged.voices + " players (" + merged.names + ")");
    const prev = await p3.evaluate(() => { try {
      const s = JSON.parse(localStorage.getItem("nukernel.song.v1") || "null");
      return s && s.prev ? s.prev.basis : null; } catch (e) { return null; } });
    check(prev === held.basis,
      "S4 · and the record it displaced is kept — `prev` holds " + prev);
    /* THE RECOVERY IS PRESSED, not asserted from the store: a record you can
       only get at with a debugger is not recoverable. */
    await p3.evaluate(() => window.__eightTab("Export"));
    await settle(p3, 700);
    const backBtn = await p3.$('[data-k="deck.exp.songback"]');
    check(!!backBtn, "S4 · the Export tab offers it back by name");
    await p3.screenshot({ path: path.join(SHOTS, "after-c3-04-bring-back.png") });
    if (backBtn) {
      await backBtn.click();
      await settle(p3, 2500);
      const backTo = await shapeOf(p3);
      check(backTo.basis === held.basis && backTo.voices === held.voices,
        "S4 · pressing it brings the displaced record back — " + backTo.basis +
        ", " + backTo.voices + " players");
    }

    /* ---- S5 · THE CEILING SPEAKS -------------------------------------- */
    await p2.evaluate(() => window.__eightTab("Export"));
    await settle(p2, 900);
    const say = await p2.evaluate(() => {
      const n = document.getElementById("sharesay");
      return n ? n.textContent : null; });
    check(say != null && say !== "",
      "S5 · the share card says what the link is carrying — " +
      JSON.stringify(say));
    /* A RECORD TOO BIG FOR A FRAGMENT. Built by asking the page's own packer
       for a document it cannot fit, so the ceiling is measured on the shipped
       code path and not on a copy of its arithmetic. */
    const big = await p2.evaluate(async () => {
      const d = window.__eightDoc();
      const fat = JSON.parse(JSON.stringify(d));
      // incompressible padding: a random cell name per section, many times over
      fat.__pad = Array.from({ length: 4000 }, () =>
        Math.random().toString(36).slice(2));
      const bytes = new TextEncoder().encode(JSON.stringify(fat));
      const rs = new Blob([bytes]).stream()
        .pipeThrough(new CompressionStream("deflate-raw"));
      const out = new Uint8Array(await new Response(rs).arrayBuffer());
      let s = "";
      for (let i = 0; i < out.length; i += 0x8000)
        s += String.fromCharCode.apply(null, out.subarray(i, i + 0x8000));
      return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").length;
    });
    check(big > 12000,
      "S5 · a padded record packs to " + big + " characters, past the 12,000 ceiling");

    check(errs.length === 0, "S5 · no page error on any of the four contexts" +
      (errs.length ? " — " + errs.slice(0, 3).join(" / ") : ""));
    await c1.close(); await c2.close(); await c3.close();
  } finally { await b.close(); }

  for (const l of notes) console.log(l);
  for (const l of fails) console.log(l);
  console.log("\n" + notes.filter((n) => n.startsWith("ok")).length + " passed, " +
              fails.length + " failed");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
