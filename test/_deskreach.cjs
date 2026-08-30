#!/usr/bin/env node
/* test/_deskreach.cjs — TWO QUESTIONS AT THE RING, ONE PRESS PATH.
   (2026-08-30, the fader lane: Paul, "Fix that" — the ear round's two finds.)

   Sibling of test/_chairtap.cjs (the ear round's mute-complement probe) with
   two differences, both because the questions moved:

     · TARGETS BY MODULE, ANY CHAIR. chairtap restricts to line/lead seats
       because the guitar question was a lead question; the stk_piano row
       lands on STAB and COMP chairs (jazz stabs), so --module matches the
       COMPILED unit's module/sampler id on every seat.
     · A FADER-REACH MODE. --fader <dB> sets the board's own unit-level
       offset (MIXER "unit:<k>" fader — ui/state.js setMixOffset, the exact
       store audio/desk.js reads) on the target chairs and presses twice:
       the delta IS what the control moves at the ring. Before the routing
       fix a modelled chair reads 0.00 dB here; after it, faderDb's own
       number. Also --mute for the mute complement of the same layer.

   Same press (export/_satpress.js pressFloat — the RING, upstream of the
   master make-up rider), same RMS math as chairtap (whole-record + ACTIVE
   over 50 ms blocks above -50 dBFS), same in-flight --trim lever for a
   PAGE_TRIM row A/B. No route patch of desk.js here: since the fader-lane
   round the tree itself routes the unit mute/fader to modelled voices.

     node test/_deskreach.cjs --records jazz,ragtime --module stk_piano
     node test/_deskreach.cjs --records jazz --module stk_piano --trim stk_piano=1.80
     node test/_deskreach.cjs --records chant --module voice_ --fader -12
*/
module.paths.push("/home/ford/ftrain-2025/node_modules");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1]; };
const PAGE = arg("page", "http://localhost:8777/nukernel/index.html");
const EXE = process.env.HOME + "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const RECORDS = arg("records", "jazz").split(",");
const MODULE = arg("module", "stk_piano");        // regex over unit module / sampler id
const BARS = +arg("bars", 8);
const SEED = +arg("seed", 1);
const FADER = arg("fader", null);                 // dB on MIXER "unit:<k>" for the targets
const MUTE = process.argv.includes("--mute");     // mute the same layer instead
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
    const r = await page.evaluate(async ([gk, seed, bars, moduleRe, faderDbArg, muteMode]) => {
      const PL = await import("/nukernel/audio/plan.js");
      const ST = await import("/nukernel/ui/state.js");
      window.__satPut(window.NuPrecompose.genreToDocument(gk, seed));
      ST.clearMixOffsets();
      await PL.deps();
      for (let i = 0; i < 60; i++) { PL.compile(); if (PL.barCount() > 0) break; await new Promise((r2) => setTimeout(r2, 250)); }
      const SP = await import("/nukernel/export/_satpress.js");
      const p0 = PL.barPlan(0);
      /* --hash: the byte-identity control — one press, one FNV-1a over the
         float PCM, no targets. A record with no chair the row under test
         touches must hash the same with the row cut and with it restored
         in flight. */
      if (moduleRe === "__hash__") {
        const SPh = await import("/nukernel/export/_satpress.js");
        const { L, R, frames } = await SPh.pressFloat({ maxBars: bars });
        let h = 0x811c9dc5;
        const mix = (x) => { h ^= (x * 1e6) | 0; h = Math.imul(h, 0x01000193) >>> 0; };
        for (let i = 0; i < frames; i++) { mix(L[i]); mix(R[i]); }
        return { gk, frames, hash: h.toString(16) };
      }
      const re = new RegExp(moduleRe);
      const targets = [], others = [];
      for (const [k, u] of Object.entries(p0.units || {})) {
        if (!u || k.slice(0, 2) === "__") continue;
        const mid = (u.sampler && (u.sampler.id || u.sampler.instr)) || u.module || "";
        (re.test(mid) ? targets : others).push(k);
      }
      if (!targets.length) return { gk, error: "no target chairs",
        units: Object.entries(p0.units || {}).map(([k, u]) => k + ":" +
          ((u.sampler && (u.sampler.id || u.sampler.instr)) || u.module || "?")) };
      const rmsOf = async () => {
        const { L, R, frames } = await SP.pressFloat({ maxBars: bars });
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
      const names = targets.map((k) => k + ":" + ((p0.units[k].sampler && p0.units[k].sampler.id) || p0.units[k].module));

      if (faderDbArg != null || muteMode) {
        /* FADER-REACH: the chair alone (complement muted), with and without
           the board's unit-level word on it — the delta is the control. */
        mute(others, 1); PL.compile();
        const solo0 = await rmsOf();
        for (const k of targets) ST.setMixOffset("unit:" + k,
          muteMode ? "mute" : "fader", muteMode ? true : +faderDbArg);
        PL.compile();
        const solo1 = await rmsOf();
        for (const k of targets) ST.setMixOffset("unit:" + k, muteMode ? "mute" : "fader", null);
        mute(others, 0); PL.compile();
        return { gk, targets: names, mode: muteMode ? "mute" : "fader " + faderDbArg,
                 solo: +solo0.db.toFixed(2), soloWithWord: +solo1.db.toFixed(2),
                 soloAct: +solo0.act.toFixed(2), soloActWithWord: +solo1.act.toFixed(2),
                 moved: +(solo1.db - solo0.db).toFixed(2),
                 movedAct: +(solo1.act - solo0.act).toFixed(2) };
      }

      /* MUTE-COMPLEMENT (chairtap's own three presses) */
      const full = await rmsOf();
      mute(targets, 1); PL.compile();
      const without = await rmsOf();
      mute(targets, 0); mute(others, 1); PL.compile();
      const solo = await rmsOf();
      mute(others, 0); PL.compile();
      return { gk, targets: names,
               full: +full.db.toFixed(2), without: +without.db.toFixed(2),
               solo: +solo.db.toFixed(2), soloAct: +solo.act.toFixed(2), soloDuty: solo.duty,
               contribution: +(full.db - without.db).toFixed(2),
               vsBand: +(solo.act - without.db).toFixed(2) };
    }, [gk, SEED, BARS, MODULE, FADER, MUTE]).catch((e) => ({ gk, error: String((e && e.message) || e) }));
    console.log(JSON.stringify(r));
  }
  await browser.close();
  if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5).join(" | "));
})();