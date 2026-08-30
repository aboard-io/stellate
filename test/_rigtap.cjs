#!/usr/bin/env node
/* test/_rigtap.cjs — WHAT ACTUALLY ARRIVES ON EACH UNIT.
   (2026-08-30. The declared-but-never-arriving law: a chip a row declares is
   not a chip the record plays. genres.js `fx: ["crunch","sweep"]` seeds every
   BOX (compose.js skeleton), audio/desk.js then deals it to every SEATED voice
   through insertsFor — but `seated && !u.stereo` drops the whole chain on a
   stereo unit, and STRIP_PROFILES/board EQ arrive by a different door. The only
   way to know which of those a given record got is to read the compiled plan.)

   Prints, per unit of bar 0: the module or sampler id, the chair, the insert
   chain as type(params), whether it carries a strip (EQ/comp), lvl and pan.

     node test/_rigtap.cjs --records industrialrock,industrialbreaks
     node test/_rigtap.cjs --records ebm --bar 0 --seed 1
*/
module.paths.push("/home/ford/ftrain-2025/node_modules");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1]; };
const PAGE = arg("page", "http://localhost:8777/nukernel/index.html");
const EXE = process.env.HOME + "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const RECORDS = arg("records", "industrialrock,industrialbreaks").split(",");
const SEED = +arg("seed", 1);
const BAR = +arg("bar", 0);

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

  for (const gk of RECORDS) {
    const r = await page.evaluate(async ([gk, seed, bar]) => {
      const PL = await import("/nukernel/audio/plan.js");
      const ST = await import("/nukernel/ui/state.js");
      window.__satPut(window.NuPrecompose.genreToDocument(gk, seed));
      ST.clearMixOffsets();
      await PL.deps();
      for (let i = 0; i < 60; i++) { PL.compile(); if (PL.barCount() > 0) break; await new Promise((r2) => setTimeout(r2, 250)); }
      const cast = PL.cast();
      const bars = PL.barCount();
      const p = PL.barPlan(bar);
      const rows = [];
      for (const [k, u] of Object.entries(p.units || {})) {
        if (!u || k.slice(0, 2) === "__") continue;
        const i = k[0] === "v" ? +k.slice(1) : NaN;
        rows.push({
          unit: k,
          chair: isFinite(i) && cast[i] ? cast[i].chair : (u.drum ? "drums" : "-"),
          id: (u.sampler && (u.sampler.id || u.sampler.instr)) || u.module || "?",
          drum: !!u.drum, stereo: !!u.stereo,
          lvl: u.lvl == null ? null : +(+u.lvl).toFixed(3),
          pan: u.pan == null ? null : +(+u.pan).toFixed(3),
          inserts: (u.inserts || []).map((c) => {
            const flat = (o) => Object.entries(o).filter(([kk]) => kk !== "type" && kk !== "module")
              .map(([kk, vv]) => (vv && typeof vv === "object")
                ? flat(vv) : kk + "=" + (typeof vv === "number" ? +vv.toFixed(3) : vv)).join(" ");
            return c.type + "[" + flat(c) + "]";
          }),
          strip: (u.sampler && u.sampler.strip) ? JSON.stringify(u.sampler.strip)
               : (u.strip ? JSON.stringify(u.strip) : null),
        });
      }
      const evc = { pitched: (p.ev && p.ev.pitched || []).length,
                    drums: (p.ev && p.ev.drums || []).length,
                    sfx: (p.ev && p.ev.sfx || []).length };
      return { gk, bars, section: p.section || p.role || null, fx: p.fx || null, evc, rows };
    }, [gk, SEED, BAR]).catch((e) => ({ gk, error: String((e && e.message) || e) }));
    if (r.error) { console.log(r.gk + "  ERROR " + r.error); continue; }
    console.log("\n=== " + r.gk + "  bars " + r.bars + "  bar " + BAR +
      "  ev{pitched " + r.evc.pitched + " drums " + r.evc.drums + " sfx " + r.evc.sfx + "}");
    for (const x of r.rows) {
      console.log("  " + x.unit.padEnd(8) + x.chair.padEnd(8) + x.id.padEnd(22) +
        (x.drum ? "DRUM " : "     ") + (x.stereo ? "ST " : "   ") +
        "lvl " + String(x.lvl).padStart(6) + "  pan " + String(x.pan).padStart(6));
      if (x.inserts.length) console.log("           inserts: " + x.inserts.join("  "));
      else console.log("           inserts: (none)");
      if (x.strip) console.log("           strip:   " + x.strip);
    }
  }
  await browser.close();
  if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5).join(" | "));
})();
