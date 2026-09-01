#!/usr/bin/env node
/* _livetap.cjs — THE LISTENER'S OWN NODE, MEASURED. The sibling of
   _satdrive.cjs, and it exists because of what _satdrive CANNOT see.

   _satdrive presses a record through the shipped stream-worker and reads the
   float PCM that comes out. That PCM is the RING's output — every stage of
   engine/faust/live/live.js's master bus (the user fader, the glue compressor,
   the make-up rider, the two master lowpasses, the brickwall) sits DOWNSTREAM
   of it and none of them is in the number. So every turn-down since 2026-08-26
   was judged on a measurement taken before the stage that decides how loud the
   record actually is, and the make-up rider handed most of each cut straight
   back: six records arriving at that bus 13 dB apart left it 2.6 dB apart, with
   the brickwall holding all of them at the ceiling. A cut a normaliser undoes
   is not a cut, and this is the harness that can tell.

   It opens nukernel in a borrowed Chromium, writes a named record with the same
   in-flight door _satdrive uses, presses PLAY through the page's own transport,
   and taps `handle.analyser` — the node live.js hangs off masterOut, i.e. the
   last thing before the ear.

     node nukernel/export/_livetap.cjs                        — the six records
     node nukernel/export/_livetap.cjs --records rock --secs 30
     node nukernel/export/_livetap.cjs --mk -20 --mkmin 0.35  — the rider, patched
     node nukernel/export/_livetap.cjs --lane 0.708           — LEVEL_LANES, scaled

   THREE THINGS THAT WILL FAKE A RESULT IF YOU CHANGE THEM:
     * SERVICE WORKERS MUST BE BLOCKED. The page ships one, and a SW-served
       response bypasses page.route entirely — the first --mk run here reported
       no patch and no change, and the "no change" was the harness, not the
       stage. It is the fifth lie of this kind on this page.
     * THE SETTLE MUST BE LONG. The rider moves on a 1.5 s time constant off a
       one-pole envelope, so a 6 s settle reads its ATTACK. 8 s settle + a 30 s
       window is the shortest pair that repeats: the same six records read 5 dB
       apart at 10 s and within 0.4 dB at 30 s.
     * THE FADER IS PART OF THE READING. ui/state.js boots vol at 80, so the tap
       is 1.9 dB under the engine's own output. Constant across runs; do not
       compare a run of this against anything that had a different volume. */
module.paths.push("/home/ford/ftrain-2025/node_modules");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1]; };
const PAGE = arg("page", "http://localhost:8777/nukernel/index.html");
const EXE = process.env.HOME + "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const RECORDS = arg("records", "iranpop,jazzrock,rock,neoclassical,ambient,hymn").split(",");
const SEED = +arg("seed", 1);
const SECS = +arg("secs", 14);
const MK = arg("mk", null);            // rewrite MK_TARGET_DB in flight
const MKMIN = arg("mkmin", null);      // ...and the rider's floor
const LANE = arg("lane", null);        // scale LEVEL_LANES in flight
// ...and PAGE_TRIM, one row at a time: `--trim stk_piano=0.21`. The lane flag
// above moves every voice on the page at once, which is the wrong instrument
// for a question about ONE module — and PAGE_TRIM is the table with a row that
// says in its own comment it was never measured. Repeat with commas.
const TRIM = (arg("trim", "") || "").split(",").filter(Boolean);
// THE COMMUTED PIANO'S STABILITY FENCE, in flight. state-engine's pianoFence
// decides how high a note may reach stk_piano before mapEvents folds it an
// octave, and the table it returns was fitted against a NaN sweep. `--fence
// 1245` serves the module's ceiling as one number so the ear can hear what a
// different fence would sound like WITHOUT editing the engine.
const FENCE = arg("fence", null);
// THE SETTLE, SAYABLE. The header above says 8 s and the loop below said 6 —
// the two disagreed, and the rider's 1.5 s time constant is exactly the range
// where that gap changes the answer. Default is now the number the header
// argues for; --settle keeps an old run reproducible.
const SETTLE = +arg("settle", 8);
// THE 2026-08-29 STAGES, PROVABLE IN FLIGHT (the declared-but-never-arriving
// law: a stage you cannot switch off from here is a stage you cannot claim).
//   --mud -6|0    rewrite state-engine MASTER_MUD_DB (the master 316 Hz dip)
//   --seat 0|2    scale the to-engine SEAT_WIDTH table + SEAT_DEFAULT (the
//                 seating plan; 0 = every chair centred, the pre-plan mono)
// Each conflicts with other routes on the same file (--fence / --trim /
// --lane): use one patch flag per run, like the header's other instruments.
const MUD = arg("mud", null);
const SEAT = arg("seat", null);
(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
  // SERVICE WORKERS BLOCKED — the page ships one, and a SW-served response
  // bypasses page.route entirely: the first --mk run reported no patch and no
  // change because engine/faust/live/live.js came out of the SW cache.
  const ctx0 = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const page = await ctx0.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  if (MK || MKMIN) await page.route("**/engine/faust/live/live.js", async (route) => {
    const res = await route.fetch(); const b = await res.text();
    let a = b;
    if (MK) a = a.replace(/MK_TARGET_DB = -?[0-9.]+/, "MK_TARGET_DB = " + MK);
    if (MKMIN) a = a.replace(/MK_MIN = [0-9.]+/, "MK_MIN = " + MKMIN);
    console.log("   [mk " + MK + " min " + MKMIN + "]" + (a === b ? " !! MATCHED NOTHING" : " ok"));
    await route.fulfill({ response: res, body: a });
  });
  if (MUD != null) await page.route("**/engine/faust/voices/state-engine.js", async (route) => {
    const res = await route.fetch(); const b = await res.text();
    const a = b.replace(/MASTER_MUD_DB = -?[0-9.]+/, "MASTER_MUD_DB = " + MUD);
    console.log("   [mud " + MUD + "]" + (a === b ? " !! MATCHED NOTHING" : " ok"));
    await route.fulfill({ response: res, body: a });
  });
  if (SEAT != null) await page.route("**/nukernel/audio/to-engine.js", async (route) => {
    const res = await route.fetch(); const b = await res.text();
    let a = b.replace(/const SEAT_WIDTH = \{[\s\S]*?\};/, (m) =>
      m.replace(/([a-z]+): ([0-9.]+)/g, (_, k, v) => k + ": " + +(+v * +SEAT).toFixed(4)));
    a = a.replace(/SEAT_DEFAULT = ([0-9.]+)/, (_, v) => "SEAT_DEFAULT = " + +(+v * +SEAT).toFixed(4));
    console.log("   [seat x" + SEAT + "]" + (a === b ? " !! MATCHED NOTHING" : " ok"));
    await route.fulfill({ response: res, body: a });
  });
  if (FENCE) await page.route("**/engine/faust/voices/state-engine.js", async (route) => {
    const res = await route.fetch(); const b = await res.text();
    const a = b.replace(
      /stiff <= 0\.25 \? 4000 : stiff <= 0\.35 \? 2000 : stiff <= 0\.55 \? 1880 : 1770;/,
      FENCE + ";");
    console.log("   [fence " + FENCE + "]" + (a === b ? " !! MATCHED NOTHING" : " ok"));
    await route.fulfill({ response: res, body: a });
  });
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
  if (LANE) await page.route("**/nukernel/audio/to-engine.js", async (route) => {
    const res = await route.fetch(); const b = await res.text();
    const a = b.replace(/const LEVEL_LANES = \{[\s\S]*?\n *\};/, (m) =>
      m.replace(/(scale|lo|hi): ([0-9.]+)/g, (_, k, v) => k + ": " + +(+v * +LANE).toFixed(4)));
    console.log("   [lane x" + LANE + "]" + (a === b ? " !! MATCHED NOTHING" : " ok"));
    await route.fulfill({ response: res, body: a });
  });
  await page.route("**/nukernel/ui/eight.js", async (route) => {
    const res = await route.fetch(); const body = await res.text();
    await route.fulfill({ response: res, body: body + "\nwindow.__satPut = (d) => CTX.setDocument(d);\n" });
  });
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.__satPut === "function", null, { timeout: 30000 });
  for (const gk of RECORDS) {
    const r = await page.evaluate(async ([gk, seed, secs, settle]) => {
      const LV = await import("/nukernel/audio/live.js");
      try { LV.stop(); } catch (e) {}
      window.__satPut(window.NuPrecompose.genreToDocument(gk, seed));
      const PL = await import("/nukernel/audio/plan.js");
      await PL.deps();
      for (let i = 0; i < 60; i++) { PL.compile(); if (PL.barCount() > 0) break; await new Promise((r) => setTimeout(r, 250)); }
      await LV.startAt(0);
      const t0 = Date.now();
      while (!LV.playing && Date.now() - t0 < 30000) await new Promise((r) => setTimeout(r, 200));
      const h = LV.engineHandle();
      if (!h || !h.analyser) return { error: "no analyser (playing=" + LV.playing + ")" };
      const an = h.analyser, buf = new Float32Array(an.fftSize);
      // THE EAR IN STEREO (2026-08-29). h.analyser is a pass-through node and
      // AnalyserNode ANALYSES a mono downmix, so every number this file ever
      // printed was the mid channel. Tapping two more analysers off a splitter
      // on its OUTPUT reads L and R at the same point in the chain without
      // adding a single node to the audible path (analyser output == input).
      const split = h.ctx.createChannelSplitter(2);
      const anL = h.ctx.createAnalyser(), anR = h.ctx.createAnalyser();
      anL.fftSize = an.fftSize; anR.fftSize = an.fftSize;
      an.connect(split); split.connect(anL, 0, 0); split.connect(anR, 1, 0);
      const bufL = new Float32Array(an.fftSize), bufR = new Float32Array(an.fftSize);
      // spectral tilt at the ear: the mono analyser's own FFT, averaged as
      // linear power per band across the window. smoothingTimeConstant is the
      // node default (0.8) — constant across runs, so band DELTAS are honest.
      const fbuf = new Float32Array(an.frequencyBinCount);
      const hzPerBin = h.ctx.sampleRate / an.fftSize;
      const BANDS = [[20, 200], [200, 500], [500, 2000], [2000, 4000], [4000, 8000], [8000, 16000]];
      const bandPow = BANDS.map(() => 0); let bandN = 0;
      // let the rider settle: it moves on a 1.5 s time constant off a 0.06
      // one-pole, so anything under ~6 s reads the ATTACK and not the record.
      await new Promise((r) => setTimeout(r, settle * 1000));
      let peak = 0, sum = 0, n = 0, silent = 0;
      let sl2 = 0, sr2 = 0, slr = 0, sm2 = 0, ss2 = 0;
      // section contrast at the ear: rms per ~1 s block. If the composer's
      // lvl/env words survive the make-up rider, loud and soft blocks differ;
      // if the rider flattens them the p90-p10 spread reads near zero.
      const blocks = []; let bSum = 0, bN = 0, bT = Date.now();
      const end = Date.now() + secs * 1000;
      while (Date.now() < end) {
        an.getFloatTimeDomainData(buf);
        anL.getFloatTimeDomainData(bufL); anR.getFloatTimeDomainData(bufR);
        an.getFloatFrequencyData(fbuf);
        let s = 0, p = 0;
        for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > p) p = a; s += buf[i] * buf[i]; }
        if (p < 1e-6) silent++;
        if (p > peak) peak = p;
        sum += s; n += buf.length;
        bSum += s; bN += buf.length;
        for (let i = 0; i < bufL.length; i++) {
          const l = bufL[i], r = bufR[i], m = (l + r) * 0.5, sd = (l - r) * 0.5;
          sl2 += l * l; sr2 += r * r; slr += l * r; sm2 += m * m; ss2 += sd * sd;
        }
        if (p >= 1e-6) {   // silent windows would fake the tilt with the floor
          for (let b = 0; b < BANDS.length; b++) {
            const i0 = Math.max(1, Math.round(BANDS[b][0] / hzPerBin));
            const i1 = Math.min(fbuf.length - 1, Math.round(BANDS[b][1] / hzPerBin));
            let bp = 0;
            for (let i = i0; i <= i1; i++) bp += Math.pow(10, fbuf[i] / 10);
            bandPow[b] += bp;
          }
          bandN++;
        }
        if (Date.now() - bT >= 1000) {
          if (bN) blocks.push(Math.sqrt(bSum / bN));
          bSum = 0; bN = 0; bT = Date.now();
        }
        await new Promise((r) => setTimeout(r, 40));
      }
      try { LV.stop(); } catch (e) {}
      try { an.disconnect(split); } catch (e) {}
      const rms = Math.sqrt(sum / Math.max(1, n));
      const db = (x) => (x > 0 ? +(20 * Math.log10(x)).toFixed(2) : -999);
      const corr = (sl2 > 0 && sr2 > 0) ? +(slr / Math.sqrt(sl2 * sr2)).toFixed(3) : 1;
      const widthDb = (sm2 > 0 && ss2 > 0) ? +(10 * Math.log10(ss2 / sm2)).toFixed(1) : -999;
      const tot = bandPow.reduce((a, b) => a + b, 0) || 1;
      const bands = bandPow.map((p) => +(10 * Math.log10(Math.max(1e-12, p / tot))).toFixed(1));
      const sorted = blocks.slice().sort((a, b) => a - b);
      const q = (f) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))] : 0;
      const contrast = sorted.length ? +(db(q(0.9)) - db(q(0.1))).toFixed(2) : 0;
      return { peakDb: db(peak), rmsDb: db(rms), crest: +(db(peak) - db(rms)).toFixed(2),
               windows: Math.round(n / buf.length), silentWindows: silent,
               corr, widthDb, bands, contrast };
    }, [gk, SEED, SECS, SETTLE]).catch((e) => ({ error: String((e && e.message) || e) }));
    console.log(gk.padEnd(14), r.error ? "ERROR " + r.error
      : ["peak " + r.peakDb, "rms " + r.rmsDb, "crest " + r.crest,
         "win " + r.windows, "silent " + r.silentWindows].join("  "));
    if (!r.error && r.bands) console.log("".padEnd(14),
      ["S/M " + r.widthDb + "dB", "corr " + r.corr,
       "bands[" + r.bands.join(" ") + "]", "contrast " + r.contrast + "dB"].join("  "));
    await new Promise((r) => setTimeout(r, 500));
  }
  await browser.close();
  if (errs.length) console.log("page errors:\n  " + errs.slice(0, 5).join("\n  "));
})().catch((e) => { console.error(e); process.exit(1); });
