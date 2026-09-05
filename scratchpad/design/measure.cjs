#!/usr/bin/env node
/* scratchpad/design/measure.cjs — THE DESIGN PASS'S OWN TAPE MEASURE.
 *
 * Reads the RENDERED page at 320 / 390 / 1280 and, per surface, reports:
 *   · ink per control      — border px² vs glyph/word px² over the SURFACE's
 *                            own controls (the open sheet, or the grid at rest)
 *   · plates per screen    — a box with a full border AND its own ground
 *   · rows per screen      — sheet rows whose rect is inside the viewport
 *   · fields per group     — how many fields stand under each heading
 *   · options at once      — how many words of a long vocabulary are visible
 *   · a screenshot of each surface at 390 and 1280
 *
 * `.nu-vh` — the hidden word every mark carries — is EXCLUDED from the word
 * ink: it is `position:absolute` with real client rects and it was three
 * hundred thousand px² of "text" on a table that prints almost none.
 *
 * RUN: NODE_PATH=/home/ford/ftrain-2025/node_modules node scratchpad/design/measure.cjs \
 *        --out scratchpad/design/before
 */
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const OUT = path.resolve(arg("--out", "scratchpad/design/before"));
const PAGE = arg("--page", "http://127.0.0.1:8777/nukernel/index.html");
const ONLY = arg("--only", null);
const REGGAE = "#at=Kingston&y=1969&s=1";
const EXE = (() => {
  const home = process.env.HOME;
  for (const d of ["chromium-1234", "chromium-1217"])
    for (const b of ["chrome-linux64/chrome", "chrome-linux/chrome"]) {
      const p = path.join(home, ".cache/ms-playwright", d, b);
      if (fs.existsSync(p)) return p;
    }
  return undefined;
})();

const PROBE = (sel) => `(() => {
  const SEL = ${JSON.stringify(sel || null)};
  const V = { w: innerWidth, h: innerHeight };
  const vis = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < V.h &&
                     r.right > 0 && r.left < V.w;
  const px = (s) => { const n = parseFloat(s); return isFinite(n) ? n : 0; };
  const CTRL = 'button, select, input, textarea, [role="slider"], .nu-wchip, .nu-wcell, .nu-lz';
  const surface = (SEL && document.querySelector(SEL)) || document.body;
  const screen = document.body;

  /* ---- INK, over the SURFACE's own controls (visible or scrolled) ---- */
  let borderInk = 0, glyphInk = 0, wordInk = 0, ctrls = 0, under44 = 0,
      platedControls = 0, marked = 0, radii = [];
  for (const el of surface.querySelectorAll(CTRL)) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden") continue;
    ctrls++;
    if (r.height < 43.5) under44++;
    const bt = px(cs.borderTopWidth), bb = px(cs.borderBottomWidth),
          bl = px(cs.borderLeftWidth), br = px(cs.borderRightWidth);
    const inner = Math.max(0, r.width - bl - br) * Math.max(0, r.height - bt - bb);
    borderInk += Math.max(0, r.width * r.height - inner);
    const rad = Math.max(px(cs.borderTopLeftRadius), px(cs.borderTopRightRadius));
    radii.push(rad);
    const bg = cs.backgroundColor || "";
    const opaque = bg && bg !== "transparent" && !/rgba\\(0, 0, 0, 0\\)/.test(bg);
    if (bt > 0 && bb > 0 && bl > 0 && br > 0 && opaque) platedControls++;
    let g = 0;
    for (const m of el.querySelectorAll(".nu-g, svg")) {
      const mr = m.getBoundingClientRect(); g += mr.width * mr.height; }
    if (g > 0) marked++;
    glyphInk += g;
    /* WORDS: leaf text nodes, minus the hidden ones. */
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        let p = n.parentElement;
        while (p && p !== el) { if (p.classList && (p.classList.contains("nu-vh") ||
          p.classList.contains("nu-g"))) return NodeFilter.FILTER_REJECT; p = p.parentElement; }
        return NodeFilter.FILTER_ACCEPT; } });
    let n; const rg = document.createRange();
    while ((n = w.nextNode())) { rg.selectNodeContents(n);
      for (const rr of rg.getClientRects()) wordInk += rr.width * rr.height; }
  }

  /* ---- PLATES AND RULES, per SCREEN ---------------------------------- */
  let plates = 0, thick = 0, edges = 0, bigR = 0;
  for (const el of screen.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (!vis(r)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden") continue;
    const bt = px(cs.borderTopWidth), bb = px(cs.borderBottomWidth),
          bl = px(cs.borderLeftWidth), br = px(cs.borderRightWidth);
    for (const w of [bt, bb, bl, br]) if (w > 0) { edges++; if (w > 1.01) thick++; }
    const ow = px(cs.outlineWidth);
    if (ow > 1.01 && cs.outlineStyle !== "none" && cs.outlineStyle !== "") thick++;
    const bg = cs.backgroundColor || "";
    const opaque = bg && !/rgba\\(0, 0, 0, 0\\)/.test(bg) && bg !== "transparent";
    if (r.width >= 24 && r.height >= 18 && bt > 0 && bb > 0 && bl > 0 && br > 0 && opaque) plates++;
    const rad = Math.max(px(cs.borderTopLeftRadius), px(cs.borderTopRightRadius));
    if (rad > 6.5 && rad < Math.min(r.width, r.height) / 2 - 1 &&
        (bt || bb || bl || br || opaque)) bigR++;
  }

  /* ---- ROWS, GROUPS, VOCABULARY -------------------------------------- */
  const open = document.querySelector("#pan-band tr.nu-wopen");
  const rowsAll = open ? [...open.querySelectorAll(".nu-sheetrow")] : [];
  const rows = rowsAll.filter((x) => vis(x.getBoundingClientRect()));
  const groups = open ? [...open.querySelectorAll(".nu-sheetgroup")].map((g) => ({
    head: ((g.querySelector(".nu-grouphead") || {}).textContent || "").trim(),
    fields: g.querySelectorAll(".nu-sheetrow").length })) : [];
  const chipsAll = [...surface.querySelectorAll(".nu-wchip")];
  const chips = chipsAll.filter((x) => vis(x.getBoundingClientRect()));
  const lzAll = [...surface.querySelectorAll(".nu-lz")];
  const lz = lzAll.filter((x) => vis(x.getBoundingClientRect()));
  const natives = [...surface.querySelectorAll("select")].filter((x) => x.getBoundingClientRect().width > 0);
  const nativeOpts = natives.reduce((a, s) => a + s.options.length, 0);
  radii.sort((a, b) => a - b);
  return {
    viewport: V, surface: SEL || "body",
    controls: ctrls, under44, marked,
    borderInk: Math.round(borderInk), glyphInk: Math.round(glyphInk),
    wordInk: Math.round(wordInk),
    inkRatio: (glyphInk + wordInk) ? +(borderInk / (glyphInk + wordInk)).toFixed(3) : null,
    borderPerControl: ctrls ? +(borderInk / ctrls).toFixed(1) : 0,
    maxRadius: radii.length ? radii[radii.length - 1] : 0,
    plates, platedControls, thickEdges: thick, edges, bigRadii: bigR,
    sheetRowsTotal: rowsAll.length, sheetRowsOnScreen: rows.length,
    groups: groups.length, groupShape: groups,
    chipsVisible: chips.length, chipsTotal: chipsAll.length,
    lozengesVisible: lz.length, lozengesTotal: lzAll.length,
    nativeSelects: natives.length, nativeOptions: nativeOpts,
    optionsAtOnce: chips.length + lz.length + (natives.length ? natives.length : 0),
    optionsTotal: chipsAll.length + lzAll.length + nativeOpts,
    pageScrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
})()`;

const WIDTHS = [320, 390, 1280];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: EXE });
  const report = {};
  for (const W of WIDTHS) {
    const ctx = await b.newContext({ viewport: { width: W, height: W === 1280 ? 900 : 844 },
      hasTouch: W < 800, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(String(e.message)));
    await p.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
    await p.goto(PAGE + REGGAE, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2800);
    await p.evaluate(() => window.__eightTab("Band"));
    await p.waitForTimeout(500);

    const D = await p.evaluate(() => window.__eightDoc());
    const secId = D.form.sections[0].id;
    const chair = D.voices[0].name;
    const drums = "kit";

    const tap = async (k) => { const r = await p.evaluate((key) => {
        const el = document.querySelector('#pan-band [data-k="' + key + '"]');
        if (!el) return "missing"; el.click(); return "ok"; }, k);
      await p.waitForTimeout(380); return r; };
    const openCell = async (k) => { await p.evaluate((key) => {
        const el = document.querySelector('#pan-band [data-k="' + key + '"]');
        if (!el) return; if (!el.classList.contains("is-sel")) el.click();
        const e2 = document.querySelector('#pan-band [data-k="' + key + '"]');
        if (e2 && e2.getAttribute("aria-expanded") !== "true") e2.click(); }, k);
      await p.waitForTimeout(420); };
    const closeAll = async () => { await p.evaluate(() => {
        window.scrollTo(0, 0);
        const pane = document.querySelector(".nu-pane"); if (pane) pane.scrollTo(0, 0);
        for (const el of document.querySelectorAll('#pan-band [aria-expanded="true"]'))
          try { el.click(); } catch (e) {} }); await p.waitForTimeout(360); };
    const seeSheet = async () => { await p.evaluate(() => {
        const o = document.querySelector("#pan-band tr.nu-wopen");
        if (o) o.scrollIntoView({ block: "start" }); }); await p.waitForTimeout(250); };

    const shot = async (name) => { if (W === 320) return;
      await p.screenshot({ path: path.join(OUT, name + "-" + W + ".png"), fullPage: false }); };
    const take = async (name, setup, sel) => {
      if (ONLY && name !== ONLY) return;
      await closeAll();
      try { await setup(); } catch (e) {
        report[name] = report[name] || {}; report[name][W] = { error: String(e.message) }; return; }
      await seeSheet();
      const m = await p.evaluate(PROBE(sel || "#pan-band tr.nu-wopen"));
      report[name] = report[name] || {}; report[name][W] = m;
      await shot(name);
    };

    await take("sheet-at-rest", async () => {}, "#pan-band table.nu-wordgrid");
    await take("cell-sheet", async () => { await openCell("tcell|" + chair + "|" + secId); });
    await take("column-sheet", async () => { await tap("tcol|" + chair); });
    await take("row-sheet", async () => { await tap("trow|" + secId); });
    await take("time-row", async () => { await p.evaluate(() => window.__eightRow("time", true)); });
    await take("rules-row", async () => { await p.evaluate(() => window.__eightRow("rules", true)); });
    await take("motifs-row", async () => { await p.evaluate(() => window.__eightMotif()); });
    await take("mix-row", async () => { await p.evaluate((v) => window.__eightMix(v), chair); });
    await take("produce-row", async () => { await p.evaluate(() => window.__eightRow("produce", true)); });
    await take("drums-does", async () => {
      await openCell("tcell|" + drums + "|" + secId);
      await tap("dev.kit|" + drums + "|" + secId);
    });
    await take("quality-picker", async () => {
      await p.evaluate(() => window.__eightRow("time", true));
      await p.waitForTimeout(300);
      const r = await p.evaluate(() => {
        const el = document.querySelector('#pan-band [data-k="sel|alphabet.quality|bar0"], ' +
          '#pan-band [data-sel="alphabet.quality|bar0"]');
        if (!el) return "missing";
        el.scrollIntoView({ block: "center" });
        const f = el.querySelector("input,select,button") || el;
        f.click(); if (f.focus) f.focus(); return "ok"; });
      await p.waitForTimeout(500); if (r === "missing") throw new Error("no quality picker");
    }, "#pan-band tr.nu-wopen");
    await take("scale-picker", async () => {
      await p.evaluate(() => window.__eightRow("time", true));
      await p.waitForTimeout(300);
      const r = await p.evaluate(() => {
        const el = document.querySelector('#pan-band [data-k="sel|alphabet.scale"], ' +
          '#pan-band [data-sel="alphabet.scale"]');
        if (!el) return "missing";
        el.scrollIntoView({ block: "center" });
        const f = el.querySelector("input,select,button") || el;
        f.click(); if (f.focus) f.focus(); return "ok"; });
      await p.waitForTimeout(500); if (r === "missing") throw new Error("no scale picker");
    });
    await take("envelope-plate", async () => {
      await tap("tcol|" + chair);
      await p.evaluate(() => { const el = document.querySelector("nu-envelope, .nu-envplate, .nu-plate");
        if (el) el.scrollIntoView({ block: "center" }); });
      await p.waitForTimeout(300);
    });
    await take("hamburger", async () => {
      await p.evaluate(() => { if (window.__eightMenuOpen) window.__eightMenuOpen(true);
        else { const b = document.getElementById("burger"); if (b) b.click(); } });
      await p.waitForTimeout(450);
    }, "#pan-menu, .nu-menusheet, body");

    if (!ONLY || ONLY === "bar") {
      await closeAll();
      const bar = await p.evaluate(() => {
        const el = document.querySelector(".nu-bar, #bar, .nu-foot, [data-bar], .nu-transport");
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const ctrls = [...el.querySelectorAll("button, select, input")];
        const px = (s) => { const n = parseFloat(s); return isFinite(n) ? n : 0; };
        let border = 0, glyph = 0, word = 0;
        for (const c of ctrls) {
          const cr = c.getBoundingClientRect(); const cs = getComputedStyle(c);
          const bt = px(cs.borderTopWidth), bb = px(cs.borderBottomWidth),
                bl = px(cs.borderLeftWidth), br2 = px(cs.borderRightWidth);
          border += cr.width * cr.height -
            Math.max(0, cr.width - bl - br2) * Math.max(0, cr.height - bt - bb);
          for (const m of c.querySelectorAll(".nu-g, svg")) {
            const mr = m.getBoundingClientRect(); glyph += mr.width * mr.height; }
        }
        return { cls: el.className || el.id, h: +r.height.toFixed(1),
          controls: ctrls.length,
          marked: ctrls.filter((c) => c.querySelector(".nu-g, svg")).length,
          visibleWords: ctrls.filter((c) => {
            const t = [...c.childNodes].filter((n) => n.nodeType === 3)
              .map((n) => n.nodeValue.trim()).join("");
            const spans = [...c.querySelectorAll("span:not(.nu-vh):not(.nu-g)")]
              .map((s) => s.textContent.trim()).join("");
            return (t + spans).length > 0; }).length,
          borderInk: Math.round(border), glyphInk: Math.round(glyph),
          under44: ctrls.filter((c) => c.getBoundingClientRect().height < 43.5).length };
      });
      report.bar = report.bar || {}; report.bar[W] = bar;
    }
    report.__errors = report.__errors || {};
    report.__errors[W] = errs.slice(0, 8);
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, "measure.json"), JSON.stringify(report, null, 2));
  const keys = Object.keys(report).filter((k) => !k.startsWith("__"));
  const F = (v) => v == null ? "-" : String(v);
  console.log("\n" + "surface".padEnd(17) + "w".padEnd(6) + "ctrl".padEnd(6) +
    "brd px2".padEnd(9) + "ink px2".padEnd(9) + "b:i".padEnd(7) + "brd/ctl".padEnd(9) +
    "plates".padEnd(8) + "thick".padEnd(7) + "rows".padEnd(8) + "grp".padEnd(5) +
    "opts".padEnd(10) + "mark");
  for (const k of keys) for (const W of WIDTHS) {
    const m = report[k][W]; if (!m) continue;
    if (k === "bar") { console.log(k.padEnd(17) + String(W).padEnd(6) +
      F(m.controls).padEnd(6) + F(m.borderInk).padEnd(9) + F(m.glyphInk).padEnd(9) +
      ("h=" + F(m.h)).padEnd(7) + ("marks " + F(m.marked)).padEnd(9) +
      ("words " + F(m.visibleWords))); continue; }
    if (m.error) { console.log(k.padEnd(17) + String(W).padEnd(6) + "ERROR " + m.error); continue; }
    console.log(k.padEnd(17) + String(W).padEnd(6) + F(m.controls).padEnd(6) +
      F(m.borderInk).padEnd(9) + F(m.glyphInk + m.wordInk).padEnd(9) +
      F(m.inkRatio).padEnd(7) + F(m.borderPerControl).padEnd(9) +
      F(m.plates).padEnd(8) + F(m.thickEdges).padEnd(7) +
      (F(m.sheetRowsOnScreen) + "/" + F(m.sheetRowsTotal)).padEnd(8) +
      F(m.groups).padEnd(5) +
      (F(m.optionsAtOnce) + "/" + F(m.optionsTotal)).padEnd(10) + F(m.marked));
  }
  console.log("\nwrote " + path.join(OUT, "measure.json"));
})().catch((e) => { console.error(e); process.exit(1); });
