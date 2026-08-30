#!/usr/bin/env node
/* test/_veltap.cjs — DOES `kitVel` REACH THE SOUND?
   (2026-08-30. The law: no knob that cannot reach the sound. `kitVel` is a
   genres.js per-lane velocity row that kernel.js reads at
   `g.kitVel && g.kitVel[d] ? at(g.kitVel[d], i) : ... vel(subj, i)` — i.e. it
   REPLACES the melody's velocity, which is where a kit's loudness otherwise
   comes from by accident. That is a claim about the rendered sound and it is
   testable in one A/B.)

   Presses ONE drum lane solo, twice: as the row ships, and again with the
   row's `kitVel` deleted from genres.js in flight (page.route). Everything
   else — kit, tempo, seed, window — is held, so the difference is the knob.

     node test/_veltap.cjs --records industrialrock,industrialbreaks
     node test/_veltap.cjs --records industrialrock --lane kick --bars 12
*/
module.paths.push("/home/ford/ftrain-2025/node_modules");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1]; };
const PAGE = arg("page", "http://localhost:8777/nukernel/index.html");
const EXE = process.env.HOME + "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const RECORDS = arg("records", "industrialrock,industrialbreaks").split(",");
const LANES = arg("lane", "kick,snare").split(",");
const BARS = +arg("bars", 12);
const SEED = +arg("seed", 1);
const STRIP = process.argv.includes("--strip");   // serve genres.js with kitVel removed

(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  if (STRIP) await page.route("**/nukernel/genres.js", async (route) => {
    const res = await route.fetch(); const b = await res.text();
    // delete every `kitVel: { ... },` row — one line or wrapped
    const a = b.replace(/^\s*kitVel: \{[\s\S]*?\},\s*$/gm, "");
    console.log("   [kitVel stripped]" + (a === b ? " !! MATCHED NOTHING" : " ok, " +
      ((b.match(/kitVel: \{/g) || []).length) + " rows removed"));
    await route.fulfill({ response: res, body: a });
  });
  await page.route("**/nukernel/ui/eight.js", async (route) => {
    const res = await route.fetch(); const body = await res.text();
    await route.fulfill({ response: res, body: body + "\nwindow.__satPut = (d) => CTX.setDocument(d);\n" });
  });
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.__satPut === "function", null, { timeout: 30000 });

  for (const gk of RECORDS) {
    const r = await page.evaluate(async ([gk, seed, bars, lanes]) => {
      const PL = await import("/nukernel/audio/plan.js");
      const ST = await import("/nukernel/ui/state.js");
      window.__satPut(window.NuPrecompose.genreToDocument(gk, seed));
      ST.clearMixOffsets();
      await PL.deps();
      for (let i = 0; i < 60; i++) { PL.compile(); if (PL.barCount() > 0) break; await new Promise((r2) => setTimeout(r2, 250)); }
      const SP = await import("/nukernel/export/_satpress.js");
      const p0 = PL.barPlan(0);
      const keys = Object.keys(p0.units || {}).filter((k) => k.slice(0, 2) !== "__");
      const mute = (ks, on) => { for (const k of ks) ST.setMixOffset("unit:" + k, "mute", on ? true : null); };
      const rmsOf = async () => {
        const { L, R, frames } = await SP.pressFloat({ maxBars: bars });
        let s = 0, pk = 0; const B = 2205, blocks = [];
        for (let b0 = 0; b0 + B <= frames; b0 += B) {
          let bs = 0;
          for (let i = b0; i < b0 + B; i++) {
            const m = (L[i] + R[i]) * 0.5; bs += m * m; if (Math.abs(m) > pk) pk = Math.abs(m);
          }
          s += bs; blocks.push(Math.sqrt(bs / B));
        }
        const act = blocks.filter((x) => x > 3.16e-3);
        const a = act.length ? Math.sqrt(act.reduce((q, x) => q + x * x, 0) / act.length) : 0;
        return { act: +(20 * Math.log10(a || 1e-12)).toFixed(2),
                 peak: +(20 * Math.log10(pk || 1e-12)).toFixed(2),
                 hits: act.length };
      };
      const out = {};
      for (const lane of lanes) {
        if (!keys.includes(lane)) { out[lane] = "no such unit"; continue; }
        mute(keys.filter((k) => k !== lane), 1); PL.compile();
        out[lane] = await rmsOf();
        mute(keys.filter((k) => k !== lane), 0); PL.compile();
      }
      return { gk, bars: PL.barCount(), out };
    }, [gk, SEED, BARS, LANES]).catch((e) => ({ gk, error: String((e && e.message) || e) }));
    console.log((STRIP ? "STRIPPED " : "SHIPPED  ") + JSON.stringify(r));
  }
  await browser.close();
  if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 3).join(" | "));
})();
