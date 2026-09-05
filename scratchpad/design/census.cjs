#!/usr/bin/env node
/* scratchpad/design/census.cjs — WHO IS DRAWING THE BOXES.
 * Names the classes responsible for the plates, the thick rules and the big
 * radii on each surface, so the restyle edits the rule and not the symptom. */
"use strict";
const { chromium } = require("playwright");
const path = require("path"); const fs = require("fs");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const OUT = path.resolve(arg("--out", "scratchpad/design/before/census.json"));
const EXE = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
const PAGE = "http://127.0.0.1:8777/nukernel/index.html#at=Kingston&y=1969&s=1";
const CENSUS = `(() => {
  const V = { w: innerWidth, h: innerHeight };
  const vis = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < V.h && r.right > 0 && r.left < V.w;
  const px = (s) => { const n = parseFloat(s); return isFinite(n) ? n : 0; };
  const name = (el) => el.tagName.toLowerCase() +
    (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\\s+/).slice(0,2).join(".") : "");
  const plates = {}, thick = {}, radii = {};
  const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
  for (const el of document.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect(); if (!vis(r)) continue;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden") continue;
    const bt = px(cs.borderTopWidth), bb = px(cs.borderBottomWidth),
          bl = px(cs.borderLeftWidth), br = px(cs.borderRightWidth);
    const bg = cs.backgroundColor || "";
    const opaque = bg && !/rgba\\(0, 0, 0, 0\\)/.test(bg) && bg !== "transparent";
    if (r.width >= 24 && r.height >= 18 && bt > 0 && bb > 0 && bl > 0 && br > 0 && opaque) bump(plates, name(el));
    if (Math.max(bt, bb, bl, br) > 1.01) bump(thick, name(el) + " b=" + Math.max(bt,bb,bl,br));
    const ow = px(cs.outlineWidth);
    if (ow > 1.01 && cs.outlineStyle !== "none") bump(thick, name(el) + " outline=" + ow);
    const rad = Math.max(px(cs.borderTopLeftRadius), px(cs.borderTopRightRadius));
    if (rad > 6.5 && rad < Math.min(r.width, r.height) / 2 - 1 && (bt||bb||bl||br||opaque))
      bump(radii, name(el) + " r=" + rad);
  }
  const top = (o) => Object.entries(o).sort((a,b) => b[1]-a[1]).slice(0, 22);
  return { plates: top(plates), thick: top(thick), radii: top(radii) };
})()`;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const out = {};
  for (const W of [390, 1280]) {
    const p = await (await b.newContext({ viewport: { width: W, height: W === 1280 ? 900 : 844 }, hasTouch: W < 800 })).newPage();
    await p.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
    await p.goto(PAGE, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2800);
    await p.evaluate(() => window.__eightTab("Band"));
    await p.waitForTimeout(400);
    out["rest@" + W] = await p.evaluate(CENSUS);
    const D = await p.evaluate(() => window.__eightDoc());
    await p.evaluate((s) => document.querySelector('#pan-band [data-k="trow|' + s + '"]').click(), D.form.sections[0].id);
    await p.waitForTimeout(500);
    await p.evaluate(() => { const o = document.querySelector("#pan-band tr.nu-wopen"); if (o) o.scrollIntoView({ block: "start" }); });
    await p.waitForTimeout(250);
    out["row@" + W] = await p.evaluate(CENSUS);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  for (const k of Object.keys(out)) {
    console.log("\n== " + k);
    for (const g of ["plates", "thick", "radii"]) {
      console.log(" " + g + ":");
      for (const [n, c] of out[k][g]) console.log("   " + String(c).padStart(4) + "  " + n);
    }
  }
  await b.close();
})();
