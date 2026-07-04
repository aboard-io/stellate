#!/usr/bin/env node
// faust/probe-dx7morph.js — VERIFICATION PROBE (item 2, NEXT.md L20-25).
// Do the LIVE DX7 params actually MOVE during a same-algorithm blend?
//
// Drives the REAL explorer.html glideStep/timbreFlip code headlessly:
//   - finds a voice + genre pair whose leads/pads/bass resolve to the SAME DX7
//     algorithm (so the 144-dim lerp path is taken, not a discrete flip)
//   - seeds S.playing = endpoint A, goes LIVE (so a dx7 voice pool exists and
//     faust/live.js applyDx7 runs), sets S.target = endpoint B
//   - each bar, onBar -> glideStep lerps S.playing.instruments[v].dx7.params
//     and applyDx7 STEP-sets the worklet /DX7 params; we sample BOTH the
//     kernel-state params AND the live worklet AudioParam values per bar
//   - reports the trajectory of several params: monotone approach to target,
//     no jumps straight to the endpoint
// Read-only: adds no repo file besides this probe; no source is modified.
"use strict";
const path = require("path");
// run: NODE_PATH=/home/ford/ftrain-2025/node_modules node faust/probe-dx7morph.js (same borrow as live-test-run.js)
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");

const ROOT = path.join(__dirname, "..");
const PORT = 8794;

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium();   // lenient: fall back to the bundled browser if the pinned build is absent
  const page = await browser.newPage();
  const pageErrors = capturePageErrors(page);

  await page.goto(`http://localhost:${PORT}/explorer.html`);
  // explorer exposes window.GenreKernel (not window.K) + __S/__X from the module;
  // DX7_PATCHES is populated by an async fetch. Wait for all, then alias K.
  await page.waitForFunction(() => window.GenreKernel && window.GenreKernel.DX7_PATCHES && Object.keys(window.GenreKernel.DX7_PATCHES).length > 0 && window.__S && window.__X, null, { timeout: 30000 });
  await page.evaluate(() => { window.K = window.GenreKernel; });

  // 1) find a same-algorithm DX7 pair on a voice
  const pair = await page.evaluate(() => {
    const K = window.K, VKS = ["melody", "bass", "pad"];
    const genres = Object.keys(K.GENRES);
    const endpoint = (g, seed) => K.mix([{ g, w: 1 }], { seed });
    for (let seed = 1; seed <= 16; seed++) {
      for (const vk of VKS) {
        const es = [];
        for (const g of genres) {
          const st = endpoint(g, seed);
          const d = st.instruments[vk] && st.instruments[vk].dx7;
          if (d && d.algorithm != null && d.params) es.push({ g, alg: d.algorithm, name: d.name });
        }
        const byAlg = {};
        for (const e of es) (byAlg[e.alg] = byAlg[e.alg] || []).push(e);
        for (const alg of Object.keys(byAlg)) {
          const arr = byAlg[alg];
          for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++)
            if (arr[i].name !== arr[j].name) return { seed, vk, alg: +alg, a: arr[i].g, b: arr[j].g, aName: arr[i].name, bName: arr[j].name };
        }
      }
    }
    return null;
  });
  if (!pair) { console.log("no same-algorithm DX7 pair found"); await browser.close(); srv.close(); process.exit(2); }
  console.log("pair:", JSON.stringify(pair));

  // 2) seed playing=A, target=B; go live; then sample per bar
  const setup = await page.evaluate((pr) => {
    const K = window.K, S = window.__S;
    const A = K.mix([{ g: pr.a, w: 1 }], { seed: pr.seed });
    const B = K.mix([{ g: pr.b, w: 1 }], { seed: pr.seed });
    S.seed = pr.seed;
    S.playing = JSON.parse(JSON.stringify(A));
    S.target = JSON.parse(JSON.stringify(B));
    S.weights = [{ g: pr.b, w: 1 }];
    S.waypoints = [];
    const pa = A.instruments[pr.vk].dx7.params, pb = B.instruments[pr.vk].dx7.params;
    const keys = Object.keys(pa).filter((k) => typeof pa[k] === "number" && typeof pb[k] === "number");
    const moved = keys.map((k) => ({ k, d: Math.abs(pb[k] - pa[k]) })).sort((x, y) => y.d - x.d).slice(0, 6).map((x) => x.k);
    window.__MOVED = moved;
    return { moved, aVals: moved.map((k) => pa[k]), bVals: moved.map((k) => pb[k]) };
  }, pair);
  console.log("tracked params:", setup.moved.join(", "));
  console.log("A params:", JSON.stringify(setup.aVals));
  console.log("B params (target):", JSON.stringify(setup.bVals));

  await page.evaluate(() => window.__X.goLive());
  // sample per ~bar. The DX7 lead pool only instantiates in the (late) "bridge"
  // section, and the DISCRETE "lead voice" timbre flip (fires when the A/B patch
  // NAMES differ) drains from a randomly-ordered queue over many bars — so we
  // must sample long enough to catch both. ~90s.
  const samples = [];
  for (let i = 0; i < 130; i++) {
    await page.waitForTimeout(700);
    const s = await page.evaluate((vk) => {
      const S = window.__S, moved = window.__MOVED;
      const kd = S.playing.instruments[vk].dx7;
      const kernel = moved.map((k) => (kd && kd.params ? kd.params[k] : null));
      // worklet-applied values from the live pool
      let worklet = moved.map(() => null), nodes = 0, module = null;
      const h = window.FaustLive && window.FaustLive.lastHandle;
      const poolKey = vk === "melody" ? "melody" : vk;
      const pool = h && h._pools && h._pools.get(poolKey);
      if (pool) {
        nodes = pool.nodes.length; module = pool.module;
        const n0 = pool.nodes[0].node;
        worklet = moved.map((k) => {
          const key = k.slice(0, 4) === "/DX7" ? k : "/DX7" + k;
          for (const pk of n0.parameters.keys()) if (pk === key || pk.endsWith(k)) return Math.round(n0.parameters.get(pk).value * 1e4) / 1e4;
          return null;
        });
      }
      return { bar: S.barCount, name: kd ? kd.name : null, kernel, worklet, nodes, module, status: S.status };
    }, pair.vk);
    samples.push(s);
  }
  await page.evaluate(() => window.__X.stopLive());
  await page.waitForTimeout(400);
  await browser.close();
  srv.close();

  // ---- report ----
  console.log("\n=== ITEM 2: live DX7 patch morphing ===");
  console.log(`voice=${pair.vk} alg=${pair.alg} module=${samples.find(s=>s.module)?.module} nodes=${samples.find(s=>s.nodes)?.nodes}`);
  console.log("bar | name | kernel params | worklet params");
  for (const s of samples.filter((_, i) => i % 2 === 0))
    console.log(`${String(s.bar).padStart(3)} | ${String(s.name).slice(0,18).padEnd(18)} | ${JSON.stringify(s.kernel)} | ${JSON.stringify(s.worklet)}`);

  // monotonicity per tracked param on the kernel + worklet series
  const analyze = (series) => setup.moved.map((k, ki) => {
    const seq = samples.map((s) => series(s)[ki]).filter((v) => v != null);
    if (seq.length < 3) return { k, mono: "n/a" };
    const a = setup.aVals[ki], b = setup.bVals[ki];
    const inc = seq.every((v, i) => i === 0 || v >= seq[i - 1] - 1e-4);
    const dec = seq.every((v, i) => i === 0 || v <= seq[i - 1] + 1e-4);
    const reachedFrac = Math.abs(b - a) < 1e-6 ? 1 : (seq[seq.length - 1] - a) / (b - a);
    // detect a jump straight to endpoint (>80% closed in a single bar step)
    let jump = false;
    for (let i = 1; i < seq.length; i++) if (Math.abs(b - a) > 1e-6 && Math.abs(seq[i] - seq[i - 1]) / Math.abs(b - a) > 0.8) jump = true;
    return { k, mono: inc || dec, reachedFrac: Math.round(reachedFrac * 100) / 100, jump };
  });
  console.log("\nkernel-state (explorer glideStep) monotonicity:");
  for (const r of analyze((s) => s.kernel)) console.log("  ", JSON.stringify(r));
  console.log("worklet-applied (faust live applyDx7) monotonicity:");
  for (const r of analyze((s) => s.worklet)) console.log("  ", JSON.stringify(r));

  // ---- FLIP-STEP magnitude: the discrete "lead voice" timbre flip (fires
  // because the A/B patch NAMES differ, even at the SAME algorithm) hard-writes
  // cd.dx7 = target, snapping the continuously-lerped params to B in ONE bar.
  // Find the sample where kd.name changes and measure that single-step delta,
  // normalized by |B-A| per param (0 = invisible, 1 = full A->B jump). ----
  const nameChanges = [];
  for (let i = 1; i < samples.length; i++)
    if (samples[i].name !== samples[i - 1].name && samples[i].name && samples[i - 1].name)
      nameChanges.push(i);
  console.log(`\nname trajectory: ${[...new Set(samples.map((s) => s.name))].join(" -> ")}`);
  if (!nameChanges.length) {
    console.log("FLIP-STEP: no lead-voice name flip fired within the sampled window (continuous lerp only).");
  } else {
    for (const i of nameChanges) {
      const before = samples[i - 1].kernel, after = samples[i].kernel;
      const frac = setup.moved.map((k, ki) => {
        const a = setup.aVals[ki], b = setup.bVals[ki];
        return Math.abs(b - a) < 1e-6 ? 0 : Math.abs(after[ki] - before[ki]) / Math.abs(b - a);
      });
      const maxFrac = Math.max(...frac);
      console.log(`FLIP-STEP at bar ${samples[i].bar} (${samples[i - 1].name} -> ${samples[i].name}): ` +
        `per-param single-bar jump as frac of |B-A| = [${frac.map((f) => f.toFixed(2)).join(", ")}], max ${maxFrac.toFixed(2)} ` +
        `(${maxFrac < 0.1 ? "SMALL/invisible" : maxFrac < 0.35 ? "MODEST" : "VISIBLE JUMP"})`);
    }
  }
  const poolSeen = samples.find((s) => s.module);
  console.log(`worklet pool observed: ${poolSeen ? `yes (module=${poolSeen.module}, nodes=${poolSeen.nodes}, first at bar ${poolSeen.bar})` : "NO (dx7 lead pool never instantiated in window)"}`);
  console.log(`errors: ${pageErrors.length}${pageErrors.length ? "\n  " + pageErrors.slice(0, 6).join("\n  ") : ""}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
