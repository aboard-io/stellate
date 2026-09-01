#!/usr/bin/env node
/* test/_chairtap.cjs — A CHAIR'S TRUE CONTRIBUTION, BY MUTE-COMPLEMENT.
   (2026-08-30, Paul: "In general the riff and solo guitars are about 30
   percent too loud everywhere." ~ -3.1 dB, role-shaped, catalogue-wide.)

   For each record: press 8 bars three ways through the page's own measurement
   press (export/_satpress.js pressFloat — the RING's output, deliberately
   UPSTREAM of the master make-up rider; _livetap.cjs's own header documents
   that the rider hands a cut straight back, so a mute-complement difference
   taken at the ear reads the rider, not the chair):

     full     every seat sounding
     without  the target chairs muted (MIXER unit:vN mute — the board's own
              layer, read by deskUnits on the press's barPlan path)
     solo     the complement muted — the chairs alone

   contribution = rmsFull − rmsWithout;  solo = the chair's own level in the
   same room. Targets are found from the COMPILED cast, never by name lists:
   line seats whose unit module is stk_guitar or whose sampler id matches
   /guitar/ (the guitar chairs), else line seats matching --chairs <re>.

     node test/_chairtap.cjs --records rock,garagerock,rocknroll,jazzrock
     node test/_chairtap.cjs --records jazz --chairs "sax|trumpet"
     node test/_chairtap.cjs --records rock --trim stk_guitar=1.79   (in flight)
*/
module.paths.push("/home/ford/ftrain-2025/node_modules");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1]; };
const PAGE = arg("page", "http://localhost:8777/nukernel/index.html");
const EXE = process.env.HOME + "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const RECORDS = arg("records", "rock,garagerock,rocknroll,jazzrock,jazz,funk").split(",");
const CHAIRS = arg("chairs", null);          // control override: line seats matching re
const BARS = +arg("bars", 8);
const SEED = +arg("seed", 1);
const TRIM = (arg("trim", "") || "").split(",").filter(Boolean);   // PAGE_TRIM row, in flight

(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  /* THE MUTE LEVER CAME OUT 2026-08-30 (the fader lane). It stood here
     because the board's unit mute wrote v.lvl = 0 and a MODELLED chair
     ignored lvl, so this probe extended the mute to the ROUTE in the served
     source only. The tree itself routes the offset layer's mute AND fader to
     modelled voices now (audio/desk.js, the offset-layer block after the
     p.gain one — measured at the ring by test/_deskreach.cjs: mute = silence,
     -12 dB fader = -11.5 rendered on the very chairs this probe measures),
     so the lever would have been a second application of the same zero.
     What it patched is what the fix landed; nothing here needs to reach into
     the served source any more. */
  if (TRIM.length) await page.route("**/nukernel/audio/to-engine.js", async (route) => {
    const res = await route.fetch(); const b = await res.text();
    let a = b;
    for (const t of TRIM) {
      const [dsp, v] = t.split("=");
      a = a.replace(new RegExp("(" + dsp + ": *)[0-9.]+"), "$1" + v);
    }
    console.log("   [trim " + TRIM.join(" ") + "]" + (a === b ? " !! MATCHED NOTHING" : " ok"));
    await route.fulfill({ response: res, body: a });
  });
  await page.route("**/nukernel/ui/eight.js", async (route) => {
    const res = await route.fetch(); const body = await res.text();
    await route.fulfill({ response: res, body: body + "\nwindow.__satPut = (d) => CTX.setDocument(d);\n" });
  });
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.__satPut === "function", null, { timeout: 30000 });

  for (const gk of RECORDS) {
    const r = await page.evaluate(async ([gk, seed, bars, chairsRe]) => {
      const PL = await import("/nukernel/audio/plan.js");
      const ST = await import("/nukernel/ui/state.js");
      window.__satPut(window.NuPrecompose.genreToDocument(gk, seed));
      ST.clearMixOffsets();
      await PL.deps();
      for (let i = 0; i < 60; i++) { PL.compile(); if (PL.barCount() > 0) break; await new Promise((r2) => setTimeout(r2, 250)); }
      const SP = await import("/nukernel/export/_satpress.js");
      const cast = PL.cast();
      const p0 = PL.barPlan(0);
      const isLine = (i) => cast[i] && (cast[i].chair === "line" || cast[i].chair === "lead");
      const targets = [], others = [];
      for (const [k, u] of Object.entries(p0.units || {})) {
        if (!u || k.slice(0, 2) === "__") continue;
        const i = k[0] === "v" ? +k.slice(1) : NaN;
        const mid = (u.sampler && (u.sampler.id || u.sampler.instr)) || u.module || "";
        const hit = chairsRe ? (isFinite(i) && isLine(i) && new RegExp(chairsRe).test(mid))
          : (isFinite(i) && isLine(i) && (u.module === "stk_guitar" || /guitar/.test(mid)));
        (hit ? targets : others).push(k);
      }
      if (!targets.length) return { gk, error: "no target chairs", cast, units: Object.keys(p0.units || {}) };
      const rmsOf = async () => {
        const { L, R, frames } = await SP.pressFloat({ maxBars: bars });
        // whole-record RMS, plus ACTIVE RMS over 50 ms blocks above -50 dBFS —
        // a sparse lead rests between phrases and a riff never does, so the
        // whole-record number under-reads the chair that plays less; the
        // active number is the level of the chair WHILE IT SOUNDS.
        let s = 0;
        const B = 2205, blocks = [];
        for (let b0 = 0; b0 + B <= frames; b0 += B) {
          let bs = 0;
          for (let i = b0; i < b0 + B; i++) { const m = (L[i] + R[i]) * 0.5; bs += m * m; }
          s += bs; blocks.push(Math.sqrt(bs / B));
        }
        const act = blocks.filter((x) => x > 3.16e-3);       // -50 dBFS
        const actRms = act.length ? Math.sqrt(act.reduce((a, x) => a + x * x, 0) / act.length) : 0;
        return { db: 20 * Math.log10(Math.sqrt(s / Math.max(1, frames)) || 1e-12),
                 act: 20 * Math.log10(actRms || 1e-12),
                 duty: +(act.length / Math.max(1, blocks.length)).toFixed(3) };
      };
      const mute = (keys, on) => { for (const k of keys) ST.setMixOffset("unit:" + k, "mute", on ? true : null); };
      const full = await rmsOf();
      mute(targets, 1); PL.compile();
      const without = await rmsOf();
      mute(targets, 0); mute(others, 1); PL.compile();
      const solo = await rmsOf();
      mute(others, 0); PL.compile();
      return { gk, targets: targets.map((k) => k + ":" + ((p0.units[k].sampler && p0.units[k].sampler.id) || p0.units[k].module)),
               full: +full.db.toFixed(2), without: +without.db.toFixed(2),
               solo: +solo.db.toFixed(2), soloAct: +solo.act.toFixed(2), soloDuty: solo.duty,
               contribution: +(full.db - without.db).toFixed(2),
               vsBand: +(solo.act - without.db).toFixed(2) };
    }, [gk, SEED, BARS, CHAIRS]).catch((e) => ({ gk, error: String((e && e.message) || e) }));
    console.log(JSON.stringify(r));
  }
  await browser.close();
  if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5).join(" | "));
})();
