#!/usr/bin/env node
/* test/_bandtap.cjs — EVERY CHAIR'S CONTRIBUTION, BY MUTE-COMPLEMENT.
   (2026-08-30, Paul: "the mix balance is off — voice and guitar bury
   everything else and drums are unprocessed.")

   test/_chairtap.cjs answers the same question for ONE named set of chairs
   (the guitars). This asks it of the WHOLE band at once: for each unit on the
   board — every pitched voice, the kit, the perc lane, the bass — press the
   record with that unit muted and subtract. What comes back is a table you can
   rank, which is the only honest way to answer "does X bury Y".

   MEASURED AT THE RING (export/_satpress.js pressFloat), deliberately, for the
   reason _chairtap.cjs's own header gives: the master make-up rider hands a cut
   straight back, so a mute-complement difference taken at the EAR reads the
   rider and not the chair. Absolute loudness questions go to _livetap.cjs; this
   is the balance question, and balance lives upstream of the normaliser.

   Per unit:
     full         the whole band
     without      this unit muted
     contribution full − without, in dB — how much of the record this seat IS
     solo         this unit alone, whole-record rms
     soloAct      ...its rms over the 50 ms blocks where it actually sounds
     vsBand       soloAct − (band without it) — the seat against its own room,
                  which is the number that answers "buries"

     node test/_bandtap.cjs --records industrialrock,industrialbreaks
     node test/_bandtap.cjs --records ebm --bars 8 --seed 1
*/
module.paths.push("/home/ford/ftrain-2025/node_modules");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1]; };
const PAGE = arg("page", "http://localhost:8777/nukernel/index.html");
const EXE = process.env.HOME + "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const RECORDS = arg("records", "industrialrock,industrialbreaks").split(",");
const BARS = +arg("bars", 24);
const SEED = +arg("seed", 1);
const JSONOUT = process.argv.includes("--json");

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
    const r = await page.evaluate(async ([gk, seed, bars]) => {
      const PL = await import("/nukernel/audio/plan.js");
      const ST = await import("/nukernel/ui/state.js");
      window.__satPut(window.NuPrecompose.genreToDocument(gk, seed));
      ST.clearMixOffsets();
      await PL.deps();
      for (let i = 0; i < 60; i++) { PL.compile(); if (PL.barCount() > 0) break; await new Promise((r2) => setTimeout(r2, 250)); }
      const SP = await import("/nukernel/export/_satpress.js");
      const cast = PL.cast();
      const p0 = PL.barPlan(0);
      const keys = Object.keys(p0.units || {}).filter((k) => k.slice(0, 2) !== "__");
      const nameOf = (k) => {
        const u = p0.units[k];
        const mid = (u && u.sampler && (u.sampler.id || u.sampler.instr)) || (u && u.module) || "?";
        const i = k[0] === "v" ? +k.slice(1) : NaN;
        const chair = isFinite(i) && cast[i] ? cast[i].chair : k;
        return k + " " + chair + " " + mid;
      };
      const rmsOf = async () => {
        const { L, R, frames } = await SP.pressFloat({ maxBars: bars });
        let s = 0; const B = 2205, blocks = [];
        for (let b0 = 0; b0 + B <= frames; b0 += B) {
          let bs = 0;
          for (let i = b0; i < b0 + B; i++) { const m = (L[i] + R[i]) * 0.5; bs += m * m; }
          s += bs; blocks.push(Math.sqrt(bs / B));
        }
        const act = blocks.filter((x) => x > 3.16e-3);
        const actRms = act.length ? Math.sqrt(act.reduce((a, x) => a + x * x, 0) / act.length) : 0;
        return { db: 20 * Math.log10(Math.sqrt(s / Math.max(1, frames)) || 1e-12),
                 act: 20 * Math.log10(actRms || 1e-12),
                 duty: +(act.length / Math.max(1, blocks.length)).toFixed(3) };
      };
      const mute = (ks, on) => { for (const k of ks) ST.setMixOffset("unit:" + k, "mute", on ? true : null); };
      const full = await rmsOf();
      const rows = [];
      // PASS 1 — contribution, one press per unit. This is the ranking, and it
      // is the number that answers "does X bury Y": a seat carrying 8.9 dB of a
      // 24 dB record IS the record.
      for (const k of keys) {
        mute([k], 1); PL.compile();
        const without = await rmsOf();
        mute([k], 0); PL.compile();
        rows.push({ key: k, unit: nameOf(k),
          contribution: +(full.db - without.db).toFixed(2),
          without: +without.db.toFixed(2),
          solo: null, soloAct: null, duty: null, vsBand: null });
      }
      rows.sort((a, b) => b.contribution - a.contribution);
      // PASS 2 — the solo, only for seats that carry something. A chair that
      // never sounds in the window presses to -430 dB and the number is noise;
      // spending a press on it is spending a minute to learn nothing.
      for (const row of rows) {
        if (row.contribution < 0.05) continue;
        mute(keys.filter((x) => x !== row.key), 1); PL.compile();
        const solo = await rmsOf();
        mute(keys.filter((x) => x !== row.key), 0); PL.compile();
        row.solo = +solo.db.toFixed(2); row.soloAct = +solo.act.toFixed(2);
        row.duty = solo.duty; row.vsBand = +(solo.act - row.without).toFixed(2);
      }
      return { gk, full: +full.db.toFixed(2), rows };
    }, [gk, SEED, BARS]).catch((e) => ({ gk, error: String((e && e.message) || e) }));
    if (JSONOUT) { console.log(JSON.stringify(r)); continue; }
    if (r.error) { console.log(r.gk + "  ERROR " + r.error); continue; }
    console.log("\n=== " + r.gk + "   full band rms " + r.full + " dB ===");
    console.log("  " + "unit".padEnd(30) + "contrib   solo  soloAct  duty  vsBand");
    for (const x of r.rows) console.log("  " + x.unit.padEnd(30) +
      String(x.contribution).padStart(6) + String(x.solo).padStart(7) +
      String(x.soloAct).padStart(8) + String(x.duty).padStart(7) + String(x.vsBand).padStart(8));
  }
  await browser.close();
  if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5).join(" | "));
})();
