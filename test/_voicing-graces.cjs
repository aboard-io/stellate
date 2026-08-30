#!/usr/bin/env node
/* test/_voicing-graces.cjs — THE GRACE-RUN WINDOW, MEASURED AT THE PCM.
   (2026-08-30, the iranpop listening report: "grace notes … now they all seem
   to run together. It happens when I switch off of voice mode".)

   Presses iranpop through the page's OWN offline press (export/wav.js
   pressPcm — the same plan.js module instance the transport plays, so
   plan.setVoicing() reaches the press's castOf exactly as it reaches the
   speakers) with every unit but the VOCAL line's taker muted through the
   mixer-offset layer (unit:vN mute — deskUnits reads MIXER on the press's
   barPlan path). Then, at the samples:

     runRms   RMS inside each ornament run's window (first grace onset to
              last grace offset + 0.1 s) — the cluster's own level
     gapDb    RMS in the inter-grace gaps (written note end + 20 ms to the
              next onset) relative to RMS at the strikes — the articulation:
              a taker that lets go reads low, stacked tails read ~0
     tailDb   RMS 0.25–0.55 s after the run's last written offset, relative
              to runRms — the ring-out a 1.1 s release leaves behind

   --before serves instruments.js with ORNATE_MOUTHS emptied, which disables
   both 2026-08-30 clauses exactly (the taker falls back to the genre's first
   non-vocal instr, no vox clamp) — one variable, same tree.
   --voxsha presses the record in VOX mode and prints the PCM's sha256: the
   control record; before/after must be byte-identical.

   Usage: node test/_voicing-graces.cjs [--before] [--voxsha] [--genre iranpop]
*/
module.paths.push("/home/ford/ftrain-2025/node_modules");
const crypto = require("crypto");
const arg = (k) => process.argv.includes("--" + k);
const val = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1]; };
const PAGE = val("page", "http://localhost:8777/nukernel/index.html");
const EXE = process.env.HOME + "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const GENRE = val("genre", "iranpop");
const BEFORE = arg("before");
const VOXSHA = arg("voxsha");

(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
  // SW blocked — the _livetap.cjs lesson: a SW-served module bypasses route()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  if (BEFORE) await page.route("**/nukernel/instruments.js", async (route) => {
    const res = await route.fetch(); const b = await res.text();
    const a = b.replace("const ORNATE_MOUTHS = { melisma: 1, qawwal: 1, belter: 1 };",
                        "const ORNATE_MOUTHS = { };");
    console.log("   [before]" + (a === b ? " !! MATCHED NOTHING" : " ok (ornate clauses off)"));
    await route.fulfill({ response: res, body: a });
  });
  await page.route("**/nukernel/ui/eight.js", async (route) => {
    const res = await route.fetch(); const body = await res.text();
    await route.fulfill({ response: res, body: body + "\nwindow.__satPut = (d) => CTX.setDocument(d);\n" });
  });
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.__satPut === "function", null, { timeout: 30000 });

  const r = await page.evaluate(async ([gk, voxsha]) => {
    const PL = await import("/nukernel/audio/plan.js");
    const ST = await import("/nukernel/ui/state.js");
    window.__satPut(window.NuPrecompose.genreToDocument(gk, 1));
    ST.setRubato(false);                       // beats -> seconds must be affine
    PL.setVoicing(voxsha ? "vox" : "instr");   // the toggle the report names
    await PL.deps();
    for (let i = 0; i < 60; i++) { PL.compile(); if (PL.barCount() > 0) break; await new Promise((r2) => setTimeout(r2, 250)); }
    const W = await import("/nukernel/export/wav.js");

    // the vocal seat: any line event of voice 0 names it
    const tl = PL.timeline();
    let vseat = null;
    for (const bar of tl) for (const e of bar.ev)
      if (e.kind === "line" && (e.lv == null ? e.v : e.lv) === 0 && e._seat != null) { vseat = e._seat; break; }
    const cast = PL.cast();

    if (!voxsha) {
      // mute every unit but the vocal taker's, through the board's own layer
      const keep = "v" + vseat;
      const chans = new Set();
      for (let i = 0; i < PL.barCount(); i++) {
        const p = PL.barPlan(i);
        for (const k of Object.keys(p.units || {}))
          if (k !== keep && k.slice(0, 2) !== "__") chans.add("unit:" + k);
      }
      for (const c of chans) ST.setMixOffset(c, "mute", true);
      PL.compile();
    }

    // the grace runs, off the compiled timeline (beats are affine: rubato off)
    const bpm = ST.bpm, spB = 60 / bpm;
    const graces = [];
    for (const bar of tl) for (const e of bar.ev)
      if (e.kind === "line" && e._seat === vseat && e.orn)
        graces.push({ on: (bar.beat0 + e.off / 4) * spB,
                      off: (bar.beat0 + (e.off + (e.dur || 0.5)) / 4) * spB });
    graces.sort((a, b) => a.on - b.on);
    const runs = [];
    for (const g of graces) {
      const R = runs[runs.length - 1];
      if (R && g.on - R.ev[R.ev.length - 1].on < 0.6) R.ev.push(g);
      else runs.push({ ev: [g] });
    }
    const big = runs.filter((R) => R.ev.length >= 3);

    const { L, R: RR, frames } = await W.pressPcm(() => {});
    const SR = 44100;
    const rms = (a, b) => {
      const i0 = Math.max(0, Math.round(a * SR)), i1 = Math.min(frames, Math.round(b * SR));
      if (i1 <= i0) return null;
      let s = 0; for (let i = i0; i < i1; i++) { const m = (L[i] + RR[i]) * 0.5; s += m * m; }
      return Math.sqrt(s / (i1 - i0));
    };
    const db = (x) => (x > 0 ? +(20 * Math.log10(x)).toFixed(2) : -120);
    let sha = null;
    if (voxsha) {
      const u8 = new Uint8Array(L.buffer.slice(0)), u8b = new Uint8Array(RR.buffer.slice(0));
      const all = new Uint8Array(u8.length + u8b.length); all.set(u8); all.set(u8b, u8.length);
      const d = await crypto.subtle.digest("SHA-256", all);
      sha = [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
      return { sha, frames, seat: cast[vseat] || null };
    }
    const out = [];
    for (const Rn of big) {
      const t0 = Rn.ev[0].on, tN = Rn.ev[Rn.ev.length - 1].off;
      const runRms = rms(t0, tN + 0.1);
      let gs = 0, gn = 0, ss = 0, sn = 0;
      for (let i = 0; i < Rn.ev.length - 1; i++) {
        const a = Rn.ev[i], b = Rn.ev[i + 1];
        const g = rms(a.off + 0.02, b.on - 0.005);
        const s = rms(a.on, a.off + 0.02);
        if (g != null && s != null) { gs += g * g; gn++; ss += s * s; sn++; }
      }
      const gap = gn ? Math.sqrt(gs / gn) : null, str = sn ? Math.sqrt(ss / sn) : null;
      const tail = rms(tN + 0.25, tN + 0.55);
      out.push({ at: +t0.toFixed(2), n: Rn.ev.length, runDb: db(runRms),
                 gapDb: gap != null && str ? +(db(gap) - db(str)).toFixed(2) : null,
                 tailDb: tail != null && runRms ? +(db(tail) - db(runRms)).toFixed(2) : null });
    }
    return { seat: cast[vseat] || null, graces: graces.length, runs: out, frames };
  }, [GENRE, VOXSHA]).catch((e) => ({ error: String((e && e.message) || e) }));

  await browser.close();
  if (errs.length) console.log("PAGE ERRORS:", errs.join(" | "));
  console.log(JSON.stringify(r, null, 1));
})();
