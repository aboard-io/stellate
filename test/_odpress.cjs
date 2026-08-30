#!/usr/bin/env node
/* test/_odpress.cjs — THE OVERDRIVE GUITAR'S CONTRIBUTION AND THE MIX AROUND IT,
   on the RENDERED artifact, deterministically.
   (2026-08-30, Paul: "Wherever you use overdrive guitar bring it down 12. Throw
   it to some mild reverb and delay. I did this for massiveattack and it did
   wonders.")

   Targets are found from the COMPILED CAST by INSTRUMENT ID — never by module
   (stk_guitar carries all six guitar ids) and never by a name list. For each
   record, through the page's own measurement press (export/_satpress.js
   pressFloat, the RING's output):

     full     every seat sounding
     without  the overdrive_guitar chairs muted (MIXER unit:vN mute)
     solo     the complement muted — the guitar alone

   contribution = rmsFull - rmsWithout.  Also: whole-mix rms / peak / crest, a
   six-band spectrum (linear power per band, printed as dB below the total), and
   a CHECKSUM of the float PCM so a control record can be proved byte-identical
   and a changed one proved deterministic twice.

     node test/_odpress.cjs --records massiveattack,rock,sabbath
     node test/_odpress.cjs --records jazz --instr none      (control: no mute pass)
*/
module.paths.push("/home/ford/ftrain-2025/node_modules");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1]; };
const PAGE = arg("page", "http://localhost:8777/nukernel/index.html");
const EXE = process.env.HOME + "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const RECORDS = arg("records", "massiveattack,rock,sabbath,shoegaze,morricone,portishead").split(",");
const INSTR = arg("instr", "overdrive_guitar");
const BARS = +arg("bars", 8);
const SEED = +arg("seed", 1);
/* THE ROUND'S OWN A/B, IN FLIGHT. `--od off` serves audio/to-engine.js with
   ID_ROUTE.overdrive_guitar neutralised (trim 1, no sends), which is the tree
   as it stood this morning. Both conditions are then measured against the SAME
   working copy of genres.js — a concurrent lane is editing that file today, and
   a before taken from `git stash` and an after taken ten minutes later would
   have been comparing two catalogues, not two trims. */
const OD = arg("od", null);

(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  if (OD) await page.route("**/nukernel/audio/to-engine.js", async (route) => {
    // `off` is the whole row neutralised; anything else is read as an explicit
    // row — `--od "trim=1,rev=0,del=0.12"` serves the delay send ALONE, which
    // is how bus 2's arrival is proved on a record that never named an echo.
    const R = { trim: 1, rev: 0, del: 0 };
    if (OD !== "off") for (const kv of OD.split(",")) { const [k, v] = kv.split("="); R[k] = +v; }
    const res = await route.fetch(); const b = await res.text();
    const a = b.replace(/overdrive_guitar: \{ trim: [0-9.]+, rev: [0-9.]+, del: [0-9.]+ \}/,
      "overdrive_guitar: { trim: " + R.trim + ", rev: " + R.rev + ", del: " + R.del + " }");
    console.log("   [od " + OD + "]" + (a === b ? " !! MATCHED NOTHING" : " ok"));
    await route.fulfill({ response: res, body: a });
  });
  await page.route("**/nukernel/ui/eight.js", async (route) => {
    const res = await route.fetch(); const body = await res.text();
    await route.fulfill({ response: res, body: body + "\nwindow.__satPut = (d) => CTX.setDocument(d);\n" });
  });
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.__satPut === "function", null, { timeout: 30000 });

  for (const gk of RECORDS) {
    const r = await page.evaluate(async ([gk, seed, bars, instr]) => {
      const PL = await import("/nukernel/audio/plan.js");
      const ST = await import("/nukernel/ui/state.js");
      window.__satPut(window.NuPrecompose.genreToDocument(gk, seed));
      ST.clearMixOffsets();
      await PL.deps();
      for (let i = 0; i < 60; i++) { PL.compile(); if (PL.barCount() > 0) break; await new Promise((r2) => setTimeout(r2, 250)); }
      const SP = await import("/nukernel/export/_satpress.js");
      const cast = PL.cast(), p0 = PL.barPlan(0);
      const targets = [], others = [];
      for (const [k, u] of Object.entries((p0 && p0.units) || {})) {
        if (!u || k.slice(0, 2) === "__") continue;
        const i = k[0] === "v" ? +k.slice(1) : NaN;
        const hit = isFinite(i) && cast[i] && cast[i].instr === instr;
        (hit ? targets : others).push(k);
      }
      /* ---- the readings ------------------------------------------------ */
      // a radix-2 FFT, written here rather than borrowed: the press returns
      // float PCM and nothing in the tree turns that into bands.
      const fft = (re, im) => {
        const n = re.length;
        for (let i = 1, j = 0; i < n; i++) {
          let bit = n >> 1;
          for (; j & bit; bit >>= 1) j ^= bit;
          j ^= bit;
          if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
        }
        for (let len = 2; len <= n; len <<= 1) {
          const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
          for (let i = 0; i < n; i += len) {
            let cr = 1, ci = 0;
            for (let j = 0; j < len / 2; j++) {
              const ur = re[i + j], ui = im[i + j];
              const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
              const vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
              re[i + j] = ur + vr; im[i + j] = ui + vi;
              re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
              const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
            }
          }
        }
      };
      const BANDS = [[20, 200], [200, 500], [500, 2000], [2000, 4000], [4000, 8000], [8000, 16000]];
      const read = async () => {
        const { L, R, frames, sampleRate } = await SP.pressFloat({ maxBars: bars });
        const SR = sampleRate || 44100;
        let s = 0, pk = 0;
        const B = 2205, blocks = [];
        for (let b0 = 0; b0 + B <= frames; b0 += B) {
          let bs = 0;
          for (let i = b0; i < b0 + B; i++) {
            const m = (L[i] + R[i]) * 0.5; bs += m * m; const a = Math.abs(m); if (a > pk) pk = a;
          }
          s += bs; blocks.push(Math.sqrt(bs / B));
        }
        const act = blocks.filter((x) => x > 3.16e-3);
        const actRms = act.length ? Math.sqrt(act.reduce((a, x) => a + x * x, 0) / act.length) : 0;
        // spectrum: 16384-sample Hann windows, hopped, linear power summed
        const N = 16384, pw = BANDS.map(() => 0);
        let win = 0;
        for (let o = 0; o + N <= frames; o += N) {
          const re = new Float64Array(N), im = new Float64Array(N);
          for (let i = 0; i < N; i++) {
            const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
            re[i] = (L[o + i] + R[o + i]) * 0.5 * w;
          }
          fft(re, im);
          const hz = SR / N;
          for (let b = 0; b < BANDS.length; b++) {
            const i0 = Math.max(1, Math.round(BANDS[b][0] / hz));
            const i1 = Math.min(N / 2 - 1, Math.round(BANDS[b][1] / hz));
            let p = 0;
            for (let i = i0; i <= i1; i++) p += re[i] * re[i] + im[i] * im[i];
            pw[b] += p;
          }
          win++;
        }
        const tot = pw.reduce((a, b) => a + b, 0) || 1;
        // a cheap deterministic checksum of the float PCM
        let h = 2166136261 >>> 0;
        const dv = new DataView(new ArrayBuffer(4));
        for (let i = 0; i < frames; i += 7) {
          dv.setFloat32(0, L[i]); h ^= dv.getUint32(0); h = Math.imul(h, 16777619) >>> 0;
          dv.setFloat32(0, R[i]); h ^= dv.getUint32(0); h = Math.imul(h, 16777619) >>> 0;
        }
        const db = (x) => (x > 0 ? +(20 * Math.log10(x)).toFixed(2) : -999);
        return { rms: db(Math.sqrt(s / Math.max(1, frames))), peak: db(pk),
                 crest: +(db(pk) - db(Math.sqrt(s / Math.max(1, frames)))).toFixed(2),
                 act: db(actRms), duty: +(act.length / Math.max(1, blocks.length)).toFixed(3),
                 bands: pw.map((p) => +(10 * Math.log10(Math.max(1e-15, p / tot))).toFixed(1)),
                 frames, hash: h.toString(16) };
      };
      const mute = (keys, on) => { for (const k of keys) ST.setMixOffset("unit:" + k, "mute", on ? true : null); };
      const full = await read();
      const chairs = targets.map((k) => {
        const u = p0.units[k], i = +k.slice(1);
        return { k, instr: cast[i] && cast[i].instr, chair: cast[i] && cast[i].chair,
                 rev: +(u.rev || 0).toFixed(4), del: +(u.del || 0).toFixed(4),
                 dry: u.dry != null ? +u.dry.toFixed(4) : null, pt: u.pageTrim || null };
      });
      if (!targets.length) return { gk, targets: [], full, note: "no " + instr + " chair" };
      mute(targets, 1); PL.compile();
      const without = await read();
      mute(targets, 0); mute(others, 1); PL.compile();
      const solo = await read();
      mute(others, 0); PL.compile();
      return { gk, chairs, full, without, solo,
               contribution: +(full.rms - without.rms).toFixed(2),
               vsBand: +(solo.act - without.rms).toFixed(2) };
    }, [gk, SEED, BARS, INSTR]).catch((e) => ({ gk, error: String((e && e.message) || e) }));
    console.log(JSON.stringify(r));
  }
  await browser.close();
  if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5).join(" | "));
})();
