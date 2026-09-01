#!/usr/bin/env node
/* test/_odguitar.cjs — WHO SEATS THE OVERDRIVE GUITAR, AND WHAT THE DESK SENDS.
   (2026-08-30, Paul: "Wherever you use overdrive guitar bring it down 12.
   Throw it to some mild reverb and delay. I did this for bristolsound and it
   did wonders.")

   Reads the COMPILED cast and the bar-0 unit table on the shipped page — the
   numbers the engine is actually handed, after audio/desk.js has composed every
   send — so the distribution below is what records ASK FOR, not what a table
   says they might.

     node test/_odguitar.cjs                       # every anchor, seed 1
     node test/_odguitar.cjs --records rock,heavymetal
*/
module.paths.push("/home/ford/ftrain-2025/node_modules");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1]; };
const PAGE = arg("page", "http://localhost:8777/nukernel/index.html");
const EXE = process.env.HOME + "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const ONLY = arg("records", null);
const SEED = +arg("seed", 1);

(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  await page.route("**/nukernel/ui/eight.js", async (route) => {
    const res = await route.fetch(); const body = await res.text();
    await route.fulfill({ response: res, body: body + "\nwindow.__satPut = (d) => CTX.setDocument(d);\n" });
  });
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.__satPut === "function", null, { timeout: 30000 });

  const list = ONLY ? ONLY.split(",") : await page.evaluate(() =>
    Object.keys(window.NuGenres.GENRES).filter(g => window.NuGenres.GENRES[g]
      && window.NuGenres.GENRES[g].bars != null).sort());
  console.log("# anchors: " + list.length);

  const rows = [];
  for (const gk of list) {
    const r = await page.evaluate(async ([gk, seed]) => {
      const PL = await import("/nukernel/audio/plan.js");
      const ST = await import("/nukernel/ui/state.js");
      window.__satPut(window.NuPrecompose.genreToDocument(gk, seed));
      ST.clearMixOffsets();
      await PL.deps();
      for (let i = 0; i < 60; i++) { PL.compile(); if (PL.barCount() > 0) break; await new Promise((r2) => setTimeout(r2, 250)); }
      const cast = PL.cast(); const p0 = PL.barPlan(0);
      const out = [];
      for (const [k, u] of Object.entries((p0 && p0.units) || {})) {
        if (!u || k.slice(0, 2) === "__" || u.drum) continue;
        const i = k[0] === "v" ? +k.slice(1) : NaN;
        const c = isFinite(i) ? cast[i] : null;
        out.push({ k, chair: c ? c.chair : (k === "bass" ? "bass" : "?"),
                   instr: c ? c.instr : null,
                   mod: u.module || null,
                   samp: (u.sampler && (u.sampler.id || u.sampler.instr)) || null,
                   rev: +(u.rev || 0).toFixed(4), del: +(u.del || 0).toFixed(4),
                   dry: u.dry != null ? +u.dry.toFixed(4) : null,
                   pt: u.pageTrim || null, lvl: u.lvl != null ? +u.lvl.toFixed(4) : null });
      }
      return { gk, decl: (window.NuGenres.GENRES[gk].instr || []).slice(), chairs: out };
    }, [gk, SEED]).catch((e) => ({ gk, error: String((e && e.message) || e) }));
    rows.push(r);
    console.log(JSON.stringify(r));
  }
  await browser.close();
  if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5).join(" | "));
})();
