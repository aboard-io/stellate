#!/usr/bin/env node
// faust/probe-modeld.js — VERIFICATION PROBE (item 1, NEXT.md L15-19).
// Does the LIVE Model-D voice actually glide (portamento) between legato notes,
// and is it the mono-legato contract or the generic pool?
//
// Self-serves the repo root, drives faust/live-test.html in headless chromium,
// finds a genre+seed whose LEAD resolves to model:"modeld" with glide>0, goes
// live, then:
//   - reports the live modeld pool size (mono contract = 1 node)
//   - solos the lead layer and taps the master analyser: autocorrelation pitch
//     every 25ms for ~10s -> pitch trajectory (glide = pitch moves smoothly
//     across frames; retrigger-snap = instantaneous jumps)
//   - taps the lead-layer RMS to count amplitude re-attacks (envelope retrigger)
//   - reads the modeld freq AudioParam target per node over time
// Read-only: adds no repo file besides this probe; no source is modified.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
// run: NODE_PATH=/home/ford/ftrain-2025/node_modules node faust/probe-modeld.js (same borrow as live-test-run.js)
const playwright = require("playwright");

const ROOT = path.join(__dirname, "..");
const PORT = 8793;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".wasm": "application/wasm", ".wav": "audio/wav", ".ogg": "audio/ogg", ".mp3": "audio/mpeg" };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      if (req.url === "/favicon.ico") { rsp.writeHead(204); return rsp.end(); }
      const p = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split("?")[0])));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream", "Access-Control-Allow-Origin": "*" });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(PORT, () => res(srv));
  });
}

async function main() {
  const { chromium } = playwright;
  const srv = await serve();
  const exe = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
  const launchOpts = { headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox"] };
  if (fs.existsSync(exe)) launchOpts.executablePath = exe;
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") pageErrors.push("console: " + m.text()); });

  await page.goto(`http://localhost:${PORT}/faust/live-test.html`);

  // 1) find a genre+seed whose LEAD is modeld with glide>0 (deterministic search)
  const pick = await page.evaluate(() => {
    const genres = ["synthwave", "darksynth", "italo", "disco", "krautrock", "spacelounge", "edm"];
    for (const g of genres) {
      for (let seed = 1; seed <= 60; seed++) {
        let st; try { st = GenreKernel.track(g, { seed }); } catch (e) { continue; }
        const m = (st.instruments && st.instruments.melody) || {};
        const b = (st.instruments && st.instruments.bass) || {};
        if (m.model === "modeld" && (m.glide || 0) > 0)
          return { genre: g, seed, role: "melody", glide: m.glide, model: m.model,
            bassModel: b.model, bpm: st.bpm };
      }
    }
    // fallback: a bass modeld
    for (const g of genres) for (let seed = 1; seed <= 60; seed++) {
      let st; try { st = GenreKernel.track(g, { seed }); } catch (e) { continue; }
      const b = (st.instruments && st.instruments.bass) || {};
      if (b.model === "modeld" && (b.glide || 0) > 0)
        return { genre: g, seed, role: "bass", glide: b.glide, model: b.model, bpm: st.bpm };
    }
    return null;
  });
  if (!pick) { console.log("NO modeld genre/seed found in search space"); await browser.close(); srv.close(); process.exit(2); }
  console.log("picked:", JSON.stringify(pick));

  // 2) go live on it
  await page.evaluate((p) => window.goLive(p.genre, p.seed), pick);

  // 2b) The modeld lead only plays in the (late) "bridge" section, and the
  // live scheduler keys the pool by unit key ("melody", or "solo:{...}" for
  // section solos) — NOT the role. Poll all pools until one whose module is
  // "modeld" appears; remember its exact key for the measurement below.
  let modeldKey = null;
  for (let w = 0; w < 40; w++) {   // up to ~80s
    modeldKey = await page.evaluate(() => {
      const h = window.FaustLive && window.FaustLive.lastHandle;
      if (!h || !h._pools) return null;
      for (const [k, pool] of h._pools) if (pool.module === "modeld") { window.__MODELDKEY = k; return k; }
      return null;
    });
    if (modeldKey) break;
    await page.waitForTimeout(2000);
  }
  console.log("modeld pool key discovered:", JSON.stringify(modeldKey),
    "poolKeys now:", JSON.stringify(await page.evaluate(() => { const h = window.FaustLive.lastHandle; return h && h._pools ? [...h._pools.keys()] : []; })));

  // 3) inspect the live modeld pool (nodes.length = mono?  freq param present?)
  const poolInfo = await page.evaluate((role) => {
    const h = window.FaustLive.lastHandle;
    const key = window.__MODELDKEY || (role === "bass" ? "bass" : "melody");
    const pool = h && h._pools && h._pools.get(key);
    if (!pool) return { found: false, poolKeys: h ? [...h._pools.keys()] : [] };
    const freqKey = (node) => { for (const k of node.parameters.keys()) if (k.endsWith("/freq")) return k; return null; };
    const gateKey = (node) => { for (const k of node.parameters.keys()) if (k.endsWith("/gate")) return k; return null; };
    const glideKey = (node) => { for (const k of node.parameters.keys()) if (k.endsWith("/glide")) return k; return null; };
    const n0 = pool.nodes[0].node;
    const gk = glideKey(n0);
    return { found: true, module: pool.module, nodes: pool.nodes.length,
      hasFreq: !!freqKey(n0), hasGate: !!gateKey(n0),
      glideParam: gk ? pool.nodes[0].node.parameters.get(gk).value : null };
  }, pick.role);
  console.log("live modeld pool:", JSON.stringify(poolInfo));

  // 4) solo the lead/bass layer so the analyser is dominated by the modeld voice
  await page.evaluate((role) => {
    const h = window.FaustLive.lastHandle;
    const id = role === "bass" ? "bass" : "lead";
    for (const L of h.layers()) L.setSolo(L.id === id);
  }, pick.role);

  // 5) time series: autocorrelation pitch + lead RMS + freq-param targets, 25ms x ~11s
  await page.evaluate((role) => {
    const h = window.FaustLive.lastHandle;
    const an = h.analyser; const N = an.fftSize; const buf = new Float32Array(N);
    const key = window.__MODELDKEY || (role === "bass" ? "bass" : "melody");
    const pool = h._pools.get(key);
    const freqParams = pool ? pool.nodes.map((v) => {
      for (const k of v.node.parameters.keys()) if (k.endsWith("/freq")) return v.node.parameters.get(k);
      return null;
    }) : [];
    const sr = h.ctx.sampleRate;
    function pitch() {
      an.getFloatTimeDomainData(buf);
      // RMS gate
      let rms = 0; for (let i = 0; i < N; i++) rms += buf[i] * buf[i]; rms = Math.sqrt(rms / N);
      if (rms < 0.003) return { f: 0, rms };
      // autocorrelation (normalized), search 70..1200 Hz
      const minLag = Math.floor(sr / 1200), maxLag = Math.floor(sr / 70);
      let bestLag = -1, best = 0;
      let e0 = 0; for (let i = 0; i < N; i++) e0 += buf[i] * buf[i];
      for (let lag = minLag; lag <= maxLag; lag++) {
        let s = 0; for (let i = 0; i < N - lag; i++) s += buf[i] * buf[i + lag];
        const norm = s / (e0 + 1e-9);
        if (norm > best) { best = norm; bestLag = lag; }
      }
      const f = bestLag > 0 && best > 0.5 ? sr / bestLag : 0;
      return { f, rms, ac: best };
    }
    window.__PT = [];
    window.__ptTimer = setInterval(() => {
      const p = pitch();
      window.__PT.push({ t: performance.now(), f: Math.round(p.f * 100) / 100, rms: Math.round(p.rms * 1e4) / 1e4,
        ac: p.ac != null ? Math.round(p.ac * 100) / 100 : null,
        fp: freqParams.map((pp) => pp ? Math.round(pp.value * 100) / 100 : null) });
    }, 25);
    return true;
  }, pick.role);
  await page.waitForTimeout(11000);

  const series = await page.evaluate(() => { clearInterval(window.__ptTimer); return window.__PT; });
  const errs0 = await page.evaluate(() => window.TEST ? window.TEST.errors.slice() : []);
  await page.evaluate(() => window.stopLive && window.stopLive());
  await page.waitForTimeout(400);
  await browser.close();
  srv.close();

  // ---- offline analysis ----
  const t0 = series.length ? series[0].t : 0;
  const S = series.map((s) => ({ t: (s.t - t0) / 1000, f: s.f, rms: s.rms, ac: s.ac, fp: s.fp }));
  const voiced = S.filter((s) => s.f > 0);
  const rmsMax = Math.max(...S.map((s) => s.rms), 0);

  // distinct freq-param TARGETS observed per node (how many notes each node got)
  const nodeTargets = {};
  for (const s of S) s.fp.forEach((v, i) => { if (v != null) { (nodeTargets[i] = nodeTargets[i] || new Set()).add(v); } });
  const nodeNoteCounts = Object.entries(nodeTargets).map(([i, set]) => `node${i}:${set.size}`);

  // GLIDE detection on the DETECTED PITCH: a glide = a run of >=3 consecutive
  // voiced frames where pitch moves monotonically by a total >30 cents while
  // each step stays <300 cents (i.e. a slew, not an octave-jump artifact).
  const cents = (a, b) => 1200 * Math.log2(a / b);
  let glides = 0, snaps = 0, maxGlideCents = 0;
  for (let i = 1; i < voiced.length; i++) {
    const dc = Math.abs(cents(voiced[i].f, voiced[i - 1].f));
    const dt = voiced[i].t - voiced[i - 1].t;
    if (dt > 0.12) continue; // gap (unvoiced between) — not a glide frame pair
    if (dc > 700) snaps++; // near-instant large jump between adjacent frames
  }
  // find monotone slew runs
  let run = [];
  const flush = () => {
    if (run.length >= 3) {
      const tot = Math.abs(cents(run[run.length - 1].f, run[0].f));
      if (tot > 30) { glides++; maxGlideCents = Math.max(maxGlideCents, tot); }
    }
    run = [];
  };
  for (let i = 1; i < voiced.length; i++) {
    const dt = voiced[i].t - voiced[i - 1].t;
    const dc = cents(voiced[i].f, voiced[i - 1].f);
    if (dt <= 0.12 && Math.abs(dc) > 3 && Math.abs(dc) < 500) {
      if (run.length === 0) run.push(voiced[i - 1]);
      const dir = run.length >= 2 ? Math.sign(cents(run[run.length - 1].f, run[run.length - 2].f)) : Math.sign(dc);
      if (Math.sign(dc) === dir || run.length < 2) run.push(voiced[i]); else { flush(); run = [voiced[i - 1], voiced[i]]; }
    } else flush();
  }
  flush();

  // envelope re-attacks: rising edges in RMS crossing 40% of max after a dip
  let attacks = 0; const thr = rmsMax * 0.4; let armed = true;
  for (const s of S) {
    if (s.rms < rmsMax * 0.18) armed = true;
    else if (armed && s.rms > thr) { attacks++; armed = false; }
  }

  const errs = [...errs0, ...pageErrors];
  console.log("");
  console.log("=== ITEM 1: Model-D live mono-legato ===");
  console.log(`pool module=${poolInfo.module} nodes=${poolInfo.nodes} (mono contract wants 1) glideParam=${poolInfo.glideParam}ms`);
  console.log(`freq-param notes per node: ${nodeNoteCounts.join(" ") || "n/a"}`);
  console.log(`pitch frames: ${S.length}, voiced(f>0): ${voiced.length}, rmsMax ${rmsMax.toFixed(4)}`);
  console.log(`pitch range: ${voiced.length ? Math.min(...voiced.map(v=>v.f)).toFixed(1)+"-"+Math.max(...voiced.map(v=>v.f)).toFixed(1)+" Hz" : "n/a"}`);
  console.log(`GLIDE runs (>=3 frames, monotone, >30 cents): ${glides}, maxGlide ${maxGlideCents.toFixed(0)} cents`);
  console.log(`snap frame-pairs (>700 cents in <=25ms adjacent): ${snaps}`);
  console.log(`envelope re-attacks (RMS): ${attacks}`);
  // sample trajectory: every 8th voiced frame
  const traj = voiced.filter((_, i) => i % 8 === 0).slice(0, 40).map((v) => `${v.t.toFixed(2)}:${v.f.toFixed(0)}`).join(" ");
  console.log(`pitch trajectory (t:Hz): ${traj}`);
  console.log(`errors: ${errs.length}${errs.length ? "\n  " + errs.slice(0, 6).join("\n  ") : ""}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
