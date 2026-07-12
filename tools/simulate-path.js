#!/usr/bin/env node
// tools/simulate-path.js — THE PATH SIMULATOR (Paul: "are you able to fully
// simulate a path?"). A VIRTUAL ride of a whole journey at the STATE level —
// the fast middle layer between the pure glide math and a realtime headless
// ride with audio:
//
//   1. simulate-path.js        — this: the real app, headless, NO audio clock.
//   2. headless live gates     — transit-arrival-run.js etc: real engine, real
//                                RMS, realtime (slow, sound-true).
//   3. journey CLI full render — node engine/genre-kernel.js journey … --render.
//
// HOW IT WORKS (no forked logic — the app's own modules do the riding):
//   - serve the repo + boot index.html in the pinned headless chromium
//     (probe-harness pattern), WITHOUT goLive: no engine, no worklets, no clock;
//   - dynamic-import app/targeting.js IN PAGE — ES-module identity means we get
//     the exact singleton main.js wired (same S, same glide queue, same holds),
//     so travelStep()/glideStep() here ARE the app's travel + glide engine;
//   - replace __S.waypoints from the input path, snap the traveler to the start
//     (retarget while !live), then set S.live=true VIRTUALLY (never goLive):
//     retarget must GLIDE per bar, not snap — every faustHandle use in the app
//     is null-guarded, so a handle-less "live" is safe headless;
//   - per VIRTUAL BAR: barCount++, travelStep(), glideStep() — the exact order
//     of live.js's onBar. Both are clock-independent (the non-live 1.4s
//     interval in app/live.js ticks glideStep without audio; explorer-ui-test
//     drives travelStep bare), so a bar here is just an iteration;
//   - per bar we sample: weights top-3, the flip queue, and S.playing's
//     essentials (kit / lead / bass / bpm / meter / progression) vs S.target's;
//   - per DOMINANT-GENRE SEGMENT (weights[0].w >= 0.5) we deep-snapshot
//     S.playing at its most-SETTLED bar (minimum flip-queue depth — the most
//     arrived state that neighborhood reached; a peak-weight snapshot can
//     catch a mid-glide chimera whose "sample" flip hasn't landed and fail
//     bloom on a state the dwell then repairs) and run the musicality audit
//     on it (engine/musicality.js is injected — index.html doesn't load it),
//     plus the ARRIVAL check: bars from dominance until the playing state's
//     identity (kit AND lead) matches the target's — the transit-arrival
//     contract (<= 8 bars), applied path-wide to EVERY crossed genre.
//
// ARRIVAL SEMANTICS (measured, then chosen deliberately): arrival is judged
// against the INSTANTANEOUS target, over [enter-2 .. enter+8] — the pre-window
// because the tier-0 identity flip often lands ON the dominance boundary (the
// bar before w0 crosses 0.5). What the pre-window does NOT forgive is Paul's
// dnb bug (a stale lead NEVER matching the new genre) — that still reads
// "never". Separately, the target's own identity picks can CHURN as the blend
// sharpens (K.mix re-picks lead at w=0.5 vs w=0.96). The re-queued revision
// used to wait at the bottom tier behind the whole already-applied set (~a
// full re-cycle; the default loop's closing disco re-entry measured 12
// mismatched bars, never re-converging inside the segment) — fixed in
// targeting.js's rebuildQueue: a REVISED dim (applied, but the target moved
// since) now ranks above applied-and-current, below never-applied. Churn is
// still REPORTED per segment so a regression is visible.
//
// BRUSHED vs VISITED (dwell-scaled arrival semantics): the arrival contract
// is <=CONTRACT_BARS of dominance, so a segment can only honestly EXHIBIT a
// contract-max arrival if it stays dominant longer than the contract window.
// A crossing with dwell <= CONTRACT_BARS is a BRUSH — the traveler clipped
// the neighborhood for less time than the arrival budget itself (at pace 48
// that's ~15 seconds of half-dominance; not a visit, and the flip pacing +
// the 4-bar instrument holds cannot deliver kit AND lead faster without the
// re-pick thrash the holds exist to prevent). Brushes are classified and
// reported, NOT judged — neither arrival nor musicality gates them. Any
// VISITED segment (dwell > CONTRACT_BARS) that never arrives still FAILS.
//
// KNOWN REAL DEFECT CLASS (transit chimera, found by this tool and KEPT
// failing — press evidence in the 2026-07-10 queue-work round): the "form"
// flip adopts the target's sections wholesale, including their found
// sourceIds, but the CRATE arrives only with the separate "sample" flip
// (hash-ranked later). Between the two, the settled state declares a found
// layer whose sourceId its foundSources don't carry — buildEvents emits ZERO
// found events (csd-engine srcById lookup misses), so a listener in that
// segment genuinely never hears the declared part. Stress path
// blues,dnb,industrial --pace 48: duststrut dwell 13, form landed, "sample"
// still queued at the most-settled bar, ev.found=0 -> bloom hard-fail is
// REAL, not an audit artifact. The fix is a flip-dependency question (form
// carrying the found sources it declares, the way "drum kit" carries its
// zone wavs), owned by the queue work, not by this auditor.
//
// WHAT A VIRTUAL RIDE CANNOT PROVE (documented honestly):
//   - nothing about SOUND: a flip "lands" when the STATE carries it; whether
//     the live engine voices it (buffers decoded, worklets alive, RMS real) is
//     tier 2's job (transit-arrival-run.js / explorer-ui-test's ride);
//   - no barInfo: the engine's section walk / serials never happen, so
//     anything keyed to onBar's info (scheduleBarNotes, video pulses) is
//     inert; the musicality audit reads buildEvents(state) — the score, not
//     the live section pointer;
//   - genreMeta.genres attribution: glide flips never rewrite playing's
//     genres list, so the audit is run on a copy with genres=[segment genre]
//     to check the RIGHT promises card.
//
// USAGE
//   node tools/simulate-path.js <default|path.json|genreA,genreB,…>
//        [--seed N] [--pace 256] [--bars auto|N] [--json] [--trace]
//   - "default" (or no arg): the app's seeded default loop (3 nodes);
//   - path.json: ⤓ path export ({waypoints:[{x,y},…]}) or bare [[x,y],…];
//   - genre list: waypoints placed ON those stars via __X.POS.
//   Exit 0 = simulated + contract PASS, 1 = contract FAIL or crash, 2 = usage.
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node tools/simulate-path.js default --seed 43 --pace 64
"use strict";
const fs = require("fs");
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("../test/probe-harness.js");

const ROOT = path.join(__dirname, "..");
const PORT = 8957;
const CONTRACT_BARS = 8;    // the transit-arrival contract: identity within 8 bars of dominance
const PRE_BARS = 2;         // …counting a flip that lands on the boundary (see ARRIVAL SEMANTICS)
const CHUNK = 200;          // virtual bars per page.evaluate (keeps each call short)

// ---------- CLI ----------
function parseArgs(argv) {
  const a = { input: "default", seed: 43, pace: 256, bars: "auto", json: false, trace: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--json") a.json = true;
    else if (v === "--trace") a.trace = true;
    else if (v === "--seed") a.seed = parseInt(argv[++i], 10);
    else if (v === "--pace") a.pace = parseInt(argv[++i], 10);
    else if (v === "--bars") a.bars = argv[++i];
    else if (v.startsWith("--")) { console.error("unknown flag " + v); process.exit(2); }
    else rest.push(v);
  }
  if (rest.length) a.input = rest[0];
  if (!(a.seed > 0) || !(a.pace >= 8)) { console.error("bad --seed/--pace"); process.exit(2); }
  return a;
}

// input -> { kind:"default" } | { kind:"points", pts:[{x,y},…] } | { kind:"genres", names:[…] }
function parseInput(input) {
  if (!input || input === "default") return { kind: "default" };
  if (/\.json$/i.test(input) || fs.existsSync(input)) {
    const raw = JSON.parse(fs.readFileSync(input, "utf8"));
    const list = Array.isArray(raw) ? raw : raw.waypoints;
    if (!Array.isArray(list) || list.length < 2) throw new Error("path.json needs >=2 waypoints");
    const pts = list.map((w) => Array.isArray(w) ? { x: +w[0], y: +w[1] } : { x: +w.x, y: +w.y });
    if (!pts.every((p) => isFinite(p.x) && isFinite(p.y))) throw new Error("path.json: non-numeric waypoint");
    return { kind: "points", pts };
  }
  const names = input.split(",").map((s) => s.trim()).filter(Boolean);
  if (names.length < 2) throw new Error("need >=2 genres (or a path.json / 'default')");
  return { kind: "genres", names };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inp = parseInput(args.input);
  const t0 = Date.now();

  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 850 });
  const errs = capturePageErrors(page);

  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => window.__X && window.__S && window.__LOOP, { timeout: 20000 });
  // DETERMINISM: main.js boot fetches the DX7 bank async and forceRetarget()s
  // when it lands — wait for it so the bank can't land MID-ride and reshuffle
  // the flip queue at a wall-clock-dependent bar.
  await page.waitForFunction(() => Object.keys((window.GenreKernel || {}).DX7_PATCHES || {}).length > 0,
    { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  // the musicality law library isn't loaded by index.html — inject it (classic
  // script, registers window.Musicality; READ-ONLY use of another agent's file)
  await page.addScriptTag({ url: `http://localhost:${PORT}/engine/musicality.js` });
  await page.waitForFunction(() => window.Musicality && window.Musicality.audit, { timeout: 5000 });

  // ---------- resolve waypoints + set up the virtual ride ----------
  const setup = await page.evaluate(async ({ inp, seed, pace }) => {
    const S = window.__S, X = window.__X;
    // the SAME module instance main.js wired (ES module identity by URL):
    // gives us glideStep/rebuildQueue, which __X doesn't export.
    const T = await import("/app/targeting.js");
    window.__SIM_T = T;
    let wps, label;
    if (inp.kind === "default") { wps = S.waypoints.map((w) => ({ x: w.x, y: w.y })); label = "default " + wps.length + "-node loop (centre → " + (window.__LOOP.genres || []).join(" → ") + ")"; }
    else if (inp.kind === "points") { wps = inp.pts; label = wps.length + "-point path"; }
    else {
      const missing = inp.names.filter((g) => !X.POS[g]);
      if (missing.length) return { err: "unknown genres: " + missing.join(", ") };
      wps = inp.names.map((g) => ({ x: X.POS[g][0], y: X.POS[g][1] }));
      label = inp.names.join(" → ");
    }
    if (wps.length < 2) return { err: "need >=2 waypoints" };
    // goLive()'s fresh-start sequence, minus the audio engine:
    S.seed = seed; S.pace = pace;
    S.live = false;                                   // retarget below must SNAP playing to the start
    S.waypoints = wps; S.travel = { seg: 0, t: 0 }; S.queue = [];
    T.retarget({ x: wps[0].x, y: wps[0].y });
    Object.assign(S, { live: true, barCount: 0, holdUntil: {} });   // VIRTUAL live: glide, don't snap (no handle — all uses null-guarded)
    T.rebuildQueue();
    // ---- per-bar recorder + segmenter ----
    const leadOf = (st) => { const m = ((st || {}).instruments || {}).melody || {}; return (m.sampler && m.sampler.id) || m.model; };
    const bassOf = (st) => { const m = ((st || {}).instruments || {}).bass || {}; return (m.sampler && m.sampler.id) || m.model; };
    const SIM = window.__SIM = { rows: [], segs: [], cur: null };
    SIM.tick = () => {
      S.barCount++;                    // live.js onBar: set({barCount:S.barCount+1}) …
      T.travelStep();                  // … then travelStep() …
      T.glideStep();                   // … then glideStep(). Exact order mirrored.
      const p = S.playing || {}, t = S.target || {};
      const w = (S.weights || []).slice(0, 3).map((x) => ({ g: x.g, w: +(+x.w).toFixed(3) }));
      const w0 = w[0] || {};
      const dom = w0.w >= 0.5 ? w0.g : null;
      const row = { bar: S.barCount, w, dom,
        pKit: (p.genreMeta || {}).kit, tKit: (t.genreMeta || {}).kit,
        pLead: leadOf(p), tLead: leadOf(t), pBass: bassOf(p),
        bpm: Math.round(p.bpm || 0), prog: p.progression,
        meter: p.meter ? p.meter.beats + "/" + p.meter.unit : "4/4",
        q: (S.queue || []).length, flips: (S.queue || []).map((f) => f[0]) };
      SIM.rows.push(row);
      if (dom) {
        if (!(SIM.cur && SIM.cur.genre === dom)) { SIM.cur = { genre: dom, enter: row.bar, end: row.bar, peakW: 0, peakBar: row.bar, minQ: Infinity, snapBar: row.bar, state: null }; SIM.segs.push(SIM.cur); }
        SIM.cur.end = row.bar;
        if (w0.w > SIM.cur.peakW) { SIM.cur.peakW = w0.w; SIM.cur.peakBar = row.bar; }
        // most-SETTLED snapshot: fewest queued flips (ties -> later bar)
        if (row.q <= SIM.cur.minQ) { SIM.cur.minQ = row.q; SIM.cur.snapBar = row.bar; SIM.cur.state = JSON.parse(JSON.stringify(S.playing)); }
      } else SIM.cur = null;
    };
    // loopBars() is one FULL loop at the current travel speed (now a duration model, not
    // fixed bars-per-leg) — the auto walk length so every seeded genre is actually crossed.
    const loopBars = (window.__X && window.__X.loopBars) ? window.__X.loopBars() : (pace * wps.length);
    return { label, wps, legs: wps.length, loopBars, loopGenres: inp.kind === "default" ? (window.__LOOP.genres || []) : null,
      startWeights: (S.weights || []).slice(0, 3).map((x) => ({ g: x.g, w: +(+x.w).toFixed(3) })) };
  }, { inp, seed: args.seed, pace: args.pace });
  if (setup.err) { console.error(setup.err); await browser.close(); srv.close(); process.exit(2); }

  // AUTO = one full loop at the current speed (loopBars), + a little so the closing leg's
  // arrival is observed. (Was pace×legs — the old fixed-bars-per-leg length, which under the
  // duration speed model no longer completes a loop, so far genres were never reached.)
  const autoBars = Math.round(setup.loopBars * 1.1);
  const totalBars = args.bars === "auto" ? autoBars : Math.max(1, parseInt(args.bars, 10) || autoBars);

  // ---------- ride (chunked so no single evaluate runs long) ----------
  for (let done = 0; done < totalBars; done += CHUNK) {
    const n = Math.min(CHUNK, totalBars - done);
    await page.evaluate((n) => { for (let i = 0; i < n; i++) window.__SIM.tick(); }, n);
    if (!args.json) process.stderr.write(`\r  riding… bar ${Math.min(done + n, totalBars)}/${totalBars}`);
  }
  if (!args.json) process.stderr.write("\n");

  // ---------- analyze in page (needs the peak states + Musicality) ----------
  const analysis = await page.evaluate(({ CONTRACT_BARS, PRE_BARS }) => {
    const SIM = window.__SIM, rows = SIM.rows;
    // merge same-genre segments split by a <=2-bar blend gap (boundary flicker)
    const segs = [];
    for (const s of SIM.segs) {
      const prev = segs[segs.length - 1];
      if (prev && prev.genre === s.genre && s.enter - prev.end <= 3) {
        prev.end = s.end;
        if (s.peakW > prev.peakW) { prev.peakW = s.peakW; prev.peakBar = s.peakBar; }
        if (s.minQ <= prev.minQ) { prev.minQ = s.minQ; prev.snapBar = s.snapBar; prev.state = s.state; }
      } else segs.push({ genre: s.genre, enter: s.enter, end: s.end, peakW: s.peakW, peakBar: s.peakBar, minQ: s.minQ, snapBar: s.snapBar, state: s.state });
    }
    const out = [];
    for (const s of segs) {
      const dwell = s.end - s.enter + 1;
      // ARRIVAL: first bar in [enter-PRE_BARS .. end] where playing's identity
      // (kit AND lead) matches the instantaneous target's — the transit
      // contract's two dimensions; the pre-window counts a flip that lands on
      // the dominance boundary (see ARRIVAL SEMANTICS up top). The match bar
      // must have THIS genre on top of the weights (w0.g), else a pre-window
      // bar still matching the PREVIOUS genre's target would count spuriously.
      const match = (b) => { const r = rows[b - 1];
        return r && r.w[0] && r.w[0].g === s.genre && r.pKit === r.tKit && r.pLead === r.tLead; };
      let arriveBar = -1;
      for (let b = Math.max(1, s.enter - PRE_BARS); b <= s.end; b++) if (match(b)) { arriveBar = b; break; }
      const lag = arriveBar >= 0 ? Math.max(0, arriveBar - s.enter) : -1;
      // IDENTITY CHURN (reported, not gated): bars AFTER arrival where the
      // target re-picked and playing no longer matches; when it re-converged.
      let churnBars = 0, reconvergeBar = -1;
      if (arriveBar >= 0) {
        let diverged = false;
        for (let b = Math.max(arriveBar + 1, s.enter); b <= s.end; b++) {
          if (!match(b)) { churnBars++; diverged = true; }
          else if (diverged && reconvergeBar < 0) reconvergeBar = b;
        }
        if (diverged && reconvergeBar < 0) reconvergeBar = -1; else if (!diverged) reconvergeBar = arriveBar;
      }
      // MUSICALITY on the most-settled playing state (min flip-queue bar).
      // genres attribution is forced to this segment's genre (glide flips
      // never rewrite the list) so the right promises card is checked.
      let audit = null;
      try {
        const st = JSON.parse(JSON.stringify(s.state));
        st.genreMeta = st.genreMeta || {}; st.genreMeta.genres = [s.genre];
        const a = window.Musicality.audit(st);
        const pf = a.laws.promises.failures.map((f) => f.what);
        audit = { verdict: a.verdict, overall: a.overall, worst: a.worst,
          promisesDeclared: a.laws.promises.declared || 0,
          promisesKept: Math.max(0, (a.laws.promises.declared || 0) - pf.length),
          promiseFailures: pf };
      } catch (e) { audit = { verdict: "ERROR", overall: 0, worst: String(e && e.message || e), promisesDeclared: 0, promisesKept: 0, promiseFailures: [] }; }
      // VISITED vs BRUSHED (see the header note): the arrival contract can
      // only be exhibited inside the segment if dominance outlasts the
      // contract window itself — dwell <= CONTRACT_BARS is a brush (the
      // traveler clipped the neighborhood for less than the arrival budget),
      // classified and reported but not judged.
      out.push({ genre: s.genre, enter: s.enter, end: s.end, dwell, peakW: s.peakW, peakBar: s.peakBar,
        snapBar: s.snapBar, minQueue: s.minQ,
        arriveBar, lag, churnBars, reconvergeBar, visited: dwell > CONTRACT_BARS, audit });
    }
    const blendBars = rows.filter((r) => !r.dom).length;
    const flipsSeen = rows.filter((r, i) => i && r.q < rows[i - 1].q).length;   // queue shrank = a flip landed
    return { segments: out, blendBars, flipsSeen, bars: rows.length, rows };
  }, { CONTRACT_BARS, PRE_BARS });

  await browser.close(); srv.close();
  const runtimeMs = Date.now() - t0;

  // ---------- verdict ----------
  const segs = analysis.segments;
  const visited = segs.filter((s) => s.visited);
  const brushed = segs.length - visited.length;
  const lateOrLost = visited.filter((s) => s.lag < 0 || s.lag > CONTRACT_BARS);
  const hardFails = visited.filter((s) => s.audit.verdict === "FAIL" || s.audit.verdict === "ERROR");
  const worst = visited.reduce((w, s) => (s.lag < 0 ? { lag: Infinity, genre: s.genre } : (s.lag > (w ? w.lag : -1) ? { lag: s.lag, genre: s.genre } : w)), null);
  const pass = lateOrLost.length === 0 && hardFails.length === 0 && errs.length === 0 && segs.length > 0;
  const verdict = pass
    ? (visited.length
      ? `PASS — ${visited.length}/${visited.length} visited segments (of ${segs.length} crossed, ${brushed} brushed) met the <=${CONTRACT_BARS}-bar arrival contract (worst lag +${worst ? worst.lag : 0} ${worst ? worst.genre : ""}); no musicality hard-fails`
      : `PASS (vacuous) — ${segs.length} genres crossed but every crossing was a brush (dwell <= ${CONTRACT_BARS} bars — pace outran the arrival window everywhere); no page errors`)
    : `FAIL — ${lateOrLost.length ? "late/lost arrivals: " + lateOrLost.map((s) => s.genre + "(+" + (s.lag < 0 ? "never" : s.lag) + ", dwell " + s.dwell + ")").join(", ") : ""}${hardFails.length ? " musicality FAIL: " + hardFails.map((s) => s.genre).join(", ") : ""}${errs.length ? " page errors: " + errs.length : ""}${segs.length ? "" : " no dominant segments crossed"}`;

  const report = { tool: "simulate-path", input: args.input, label: setup.label, seed: args.seed, pace: args.pace,
    bars: analysis.bars, legs: setup.legs, loopGenres: setup.loopGenres, contractBars: CONTRACT_BARS,
    segments: segs, blendBars: analysis.blendBars, flipsLanded: analysis.flipsSeen,
    worstArrival: worst && worst.lag !== Infinity ? worst : (worst ? { lag: null, genre: worst.genre, never: true } : null),
    pass, verdict, pageErrors: errs.slice(0, 10), runtimeMs };
  if (args.trace) report.rows = analysis.rows;

  if (args.json) { console.log(JSON.stringify(report, null, 2)); }
  else {
    console.log(`\nSTELLATE PATH SIMULATOR — virtual ride (state-level, no audio clock)`);
    console.log(`path: ${setup.label}   seed ${args.seed}   pace ${args.pace} bars/leg   ${analysis.bars} bars (${setup.legs} legs)\n`);
    const pad = (s, n, r) => (r ? String(s).padStart(n) : String(s).padEnd(n));
    console.log(`  ${pad("genre", 18)} ${pad("enter", 6, 1)} ${pad("dwell", 6, 1)} ${pad("peakW", 6, 1)} ${pad("arrive", 11, 1)}  ${pad("musicality", 12)} promises`);
    for (const s of segs) {
      const arr = s.lag < 0 ? "never" : `bar ${s.arriveBar} (+${s.lag})`;
      const gate = s.visited ? (s.lag >= 0 && s.lag <= CONTRACT_BARS ? " ok" : " LATE") : " (brushed)";
      const prom = s.audit.promisesDeclared ? `${s.audit.promisesKept}/${s.audit.promisesDeclared} kept${s.audit.promiseFailures.length ? " — " + s.audit.promiseFailures[0] : ""}` : "none declared";
      console.log(`  ${pad(s.genre, 18)} ${pad(s.enter, 6, 1)} ${pad(s.dwell, 6, 1)} ${pad(s.peakW.toFixed(2), 6, 1)} ${pad(arr, 11, 1)}${gate}  ${pad(s.audit.verdict + " " + s.audit.overall.toFixed(2), 12)} ${prom}`);
      if (s.churnBars > 0) console.log(`  ${pad("", 18)} └ identity churn: target re-picked after arrival — ${s.churnBars} mismatched bars, ${s.reconvergeBar >= 0 ? "re-converged at bar " + s.reconvergeBar : "NOT re-converged within the segment"} (gated on visited segments by test/simulate-path-run.js)`);
      if (s.audit.worst) console.log(`  ${pad("", 18)} └ ${s.audit.worst}`);
    }
    console.log(`\n  blend bars (no dominant genre): ${analysis.blendBars}/${analysis.bars}   flips landed: ${analysis.flipsSeen}   page errors: ${errs.length}`);
    if (worst) console.log(`  transitions: worst arrival lag ${worst.lag === Infinity ? "NEVER (" + worst.genre + ")" : "+" + worst.lag + " bars (" + worst.genre + ")"} — contract <=${CONTRACT_BARS}`);
    console.log(`  runtime: ${(runtimeMs / 1000).toFixed(1)}s\n\nVERDICT: ${verdict}`);
  }
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
