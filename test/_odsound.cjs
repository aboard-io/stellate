#!/usr/bin/env node
/* test/_odsound.cjs — DOES THE SEATED OVERDRIVE GUITAR ACTUALLY PLAY?
   The scan (_odguitar.cjs) says 109 records SEAT the id at seed 1. A seat is
   not a sound: this walks every bar of each record's compiled plan and counts
   the pitched events addressed to the chair, so the blast radius is records
   that are HEARD to carry one and not records that book one. */
module.paths.push("/home/ford/ftrain-2025/node_modules");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1]; };
const PAGE = arg("page", "http://localhost:8777/nukernel/index.html");
const EXE = process.env.HOME + "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const ONLY = arg("records", null);
const SEED = +arg("seed", 1);
const INSTR = arg("instr", "overdrive_guitar");
(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  await page.route("**/nukernel/ui/eight.js", async (route) => {
    const res = await route.fetch(); const body = await res.text();
    await route.fulfill({ response: res, body: body + "\nwindow.__satPut = (d) => CTX.setDocument(d);\n" });
  });
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.__satPut === "function", null, { timeout: 30000 });
  const list = ONLY.split(",");
  for (const gk of list) {
    const r = await page.evaluate(async ([gk, seed, instr]) => {
      const PL = await import("/nukernel/audio/plan.js");
      const ST = await import("/nukernel/ui/state.js");
      window.__satPut(window.NuPrecompose.genreToDocument(gk, seed));
      ST.clearMixOffsets(); await PL.deps();
      for (let i = 0; i < 60; i++) { PL.compile(); if (PL.barCount() > 0) break; await new Promise((r2) => setTimeout(r2, 250)); }
      const cast = PL.cast();
      // the cast is an array of seats whose own key is `v<index>` — the index IS
      // the position, and `e.v` on a pitched event is that same seat index
      // — and a pitched event's `voice` is that STRING key, not the number
      // (dumped from the shipped plan: { voice: "v0", beat, dur, pch, amp,
      // accent, slide }). Two versions of this probe reported 0 notes on all
      // 109 records while the press was hearing the chair at +3.3 dB, once for
      // reading a field that does not exist (`e.v`) and once for comparing a
      // string key against an integer. Both are the harness lying, not the
      // page: the count below is only believable because the press disagrees
      // with it when it is wrong.
      const ix = cast.map((c, i) => (c && c.instr === instr ? "v" + i : null)).filter(Boolean);
      const n = PL.barCount(); const cnt = {}; let tot = 0; let first = -1;
      // ...AND THE FIRST BAR IT SOUNDS IN, which is the number a press window
      // has to clear. rock and kraftwerk seat this id and play it 70 and 85
      // times, all of it past the 8-bar window the first press used: the
      // reading was "the chair contributes 0.00 dB", and the chair simply had
      // not come in yet.
      for (let b = 0; b < n; b++) {
        const p = PL.barPlan(b); if (!p) continue;
        for (const e of p.ev.pitched) {
          tot++;
          if (ix.indexOf(e.voice) >= 0) { cnt[e.voice] = (cnt[e.voice] || 0) + 1; if (first < 0) first = b; }
        }
      }
      return { gk, bars: n, seats: ix, notes: cnt, totalPitched: tot,
               sounding: ix.filter((k) => cnt[k] > 0).length, firstBar: first };
    }, [gk, SEED, INSTR]).catch((e) => ({ gk, error: String((e && e.message) || e) }));
    console.log(JSON.stringify(r));
  }
  await browser.close();
})();
