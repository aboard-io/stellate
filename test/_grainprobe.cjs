#!/usr/bin/env node
/* test/_grainprobe.cjs — THE GRAIN, READ OFF THE RENDERED RECORD.
 *
 * _satdrive.cjs's hand on _satpress.js, with one difference: it writes the
 * float PCM to disk instead of only printing band medians. The fact under test
 * — "a broadband floor arrived that was not there" — is a DIFFERENCE between
 * two builds, and a median over a whole mix cannot show a texture 35 dB under
 * it. Two runs, one before the change and one after, and the difference signal
 * IS the grain: it can be levelled, spectrum'd, and shown to be zero on a
 * record that was not asked to change.
 *
 *   node test/_grainprobe.cjs --records portishead,rock --out /tmp/before
 *
 * THE PAGE IS NOT PATCHED — the same in-flight door _satdrive opens
 * (`window.__satPut` appended to ui/eight.js's served body, landing in the
 * module scope where CTX is private). Nothing in the tree carries a
 * measurement global.
 */
module.paths.push("/home/ford/ftrain-2025/node_modules");
const fs = require("fs"), path = require("path");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k);
  return i < 0 ? d : process.argv[i + 1]; };
const PAGE = arg("page", "http://localhost:8777/nukernel/index.html");
const EXE = arg("chrome", process.env.HOME +
  "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
const BARS = +arg("bars", 8), SEED = +arg("seed", 1);
const OUT = arg("out", "/tmp/grain");
const RECORDS = arg("records", "portishead").split(",").filter(Boolean);

(async () => {
  const { chromium } = require("playwright");
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext();
  // the in-flight door, quoted from _satdrive.cjs
  await ctx.route("**/nukernel/ui/eight.js", async (route) => {
    const r = await route.fetch();
    const b = await r.text();
    await route.fulfill({ response: r, body: b +
      "\nwindow.__satPut = (d) => CTX.setDocument(d);\n" });
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e && e.message || e)));
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.__satPut === "function", null, { timeout: 60000 });

  for (const gk of RECORDS) {
    const r = await page.evaluate(async ([gk, seed, bars]) => {
      const doc = window.NuPrecompose.genreToDocument(gk, seed);
      window.__satPut(doc);
      const PL0 = await import("/nukernel/audio/plan.js");
      await PL0.deps();
      for (let i = 0; i < 60; i++) {
        PL0.compile();
        if (PL0.barCount() > 0) break;
        await new Promise((r) => setTimeout(r, 250));
      }
      const P = await import("/nukernel/export/_satpress.js");
      const { L, R } = await P.pressFloat({ maxBars: bars });
      const st = PL0.parentState() || {};
      return { L: Array.from(L), R: Array.from(R),
               crackle: st.crackle == null ? null : st.crackle,
               instr: doc.voices.map((v) => v.instrument || "-").join(","),
               stats: P.stats(L, R) };
    }, [gk, SEED, BARS]).catch((e) => ({ error: String(e && e.message || e) }));
    if (r.error) { console.log(gk.padEnd(16), "ERROR " + r.error); continue; }
    const n = r.L.length;
    const buf = Buffer.alloc(n * 8);
    for (let i = 0; i < n; i++) { buf.writeFloatLE(r.L[i], i * 8); buf.writeFloatLE(r.R[i], i * 8 + 4); }
    fs.writeFileSync(path.join(OUT, gk + ".f32"), buf);
    fs.writeFileSync(path.join(OUT, gk + ".json"),
      JSON.stringify({ crackle: r.crackle, instr: r.instr, stats: r.stats }, null, 1));
    console.log(gk.padEnd(16), "crackle " + String(r.crackle).padEnd(6),
      "rms " + r.stats.rmsDb, "peak " + r.stats.peakDb, n + " frames");
  }
  await browser.close();
  if (errs.length) console.log("page errors:\n  " + errs.slice(0, 6).join("\n  "));
})().catch((e) => { console.error(e); process.exit(1); });
