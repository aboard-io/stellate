#!/usr/bin/env node
// test/probes/nukernel-block.probe.js — HOW LONG IS THE MAIN THREAD GONE, and
// is the music gone with it.
//
//   node test/probes/nukernel-block.probe.js
//   NU_ROOT=/tmp/nuold node test/probes/nukernel-block.probe.js     # before/after
//   NU_GENRE=vaporwave NU_SEED=5 NU_SEC=120 node …
//
// Paul, on staging 2026-08-17: "The green progress bar is jumpy and there's a
// slight jumpiness in the sound that corresponds… and sometimes the mix drops
// out totally, all the reverb and so forth and it's just bare, then it comes
// back a measure later." Both halves of that are ONE reading, and it is not a
// reading any instrument in this tree took: the fill bar is painted from
// ui/main.js's rAF loop and the bars are scheduled from audio/transport.js's
// tick, and BOTH of those live on the main thread. So "the bar froze" and "the
// music stopped" are the same fact seen twice, and the number that says it is
// how long the thread was unavailable.
//
// WHAT IT READS, and why each one and not another:
//   longtask       — chromium's own PerformanceObserver. The only reading here
//                    that is not our own opinion of ourselves: the browser says
//                    how long a task held the thread, with no cooperation from
//                    the code being measured. A sampler cannot time a stall it
//                    is itself stalled by, which is exactly the trap.
//   __nuRender()   — .each is audio/bounce.js's OWN per-window render cost, and
//                    .phase is which half of the tape it is in. Lining the two
//                    up is the whole probe: when a longtask and a window carry
//                    the same milliseconds, the window IS the block.
//   __rms          — an analyser on ctx.destination. Read on the FAR SIDE of a
//                    block, because that is where the ear's evidence is: the
//                    graph plays what tick() already scheduled and then runs
//                    out, so a level at the far edge of a 3 s block says how
//                    much lookahead there really was.
//
// THE LOOKAHEAD IS THE WHOLE BUDGET. transport.js schedules 0.15 s ahead with
// the tab visible. Any block longer than that is music that was never handed to
// the audio thread, and the tail of the last scheduled bar is all there is to
// hear. 0.15 s is not a bug — it is the right number for a desk you are
// touching. It just makes the thread's availability a hard musical contract.
//
// WHY A PROBE AND NOT A GATE: wall clock IS the measurement, and it is taken
// over two minutes of real playback on a real box, so it belongs beside
// nukernel-load / nukernel-return / nukernel-section rather than in verify.sh's
// concurrent fork — where the neighbours would be the load.
"use strict";
const { serve, launchChromium } = require("../lib/probe-harness.js");
const path = require("path");

const REPO = path.join(__dirname, "..", "..");
const ROOT = process.env.NU_ROOT || REPO;
const GENRE = process.env.NU_GENRE || "beatles";
const SEED = +(process.env.NU_SEED || 3);
const SEC = +(process.env.NU_SEC || 120);

const taps = () => {
  window.__lt = [];
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries())
      window.__lt.push({ s: e.startTime, d: e.duration }); })
      .observe({ entryTypes: ["longtask"] });
  } catch (e) { window.__ltErr = String(e); }
  const AC = window.AudioContext || window.webkitAudioContext;
  window.AudioContext = function (...a) {
    const c = new AC(...a);
    if (!window.__ctx) window.__ctx = c;
    const an = c.createAnalyser(); an.fftSize = 2048;
    const orig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (d, ...r) {
      if (d === c.destination) { try { orig.call(this, an); } catch (e) {} }
      return orig.call(this, d, ...r);
    };
    window.__rms = () => {
      const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d);
      let s = 0; for (const v of d) s += v * v;
      return Math.sqrt(s / d.length);
    };
    return c;
  };
  window.AudioContext.prototype = AC.prototype;
  // A 10 ms timer, and its own GAPS are half the data: this sampler is on the
  // thread it is measuring, so a missing row is a stall by construction and
  // the audio clock beside it says how much music went past while it was away.
  window.__on = () => {
    window.__s = [];
    const step = () => {
      window.__s.push([performance.now(), +window.__rms().toFixed(5),
                       +window.__ctx.currentTime.toFixed(3)]);
      window.__iv = setTimeout(step, 10);
    };
    step();
  };
  window.__off = () => { clearTimeout(window.__iv); return window.__s; };
};

(async () => {
  const srv = await serve(ROOT, 8993);
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(taps);
  page.on("pageerror", e => console.log("   page error:", String(e).slice(0, 160)));
  console.log(`tree: ${ROOT}`);
  // ?idle= long — the desk must not hand itself to the tape mid-reading; the
  // question is what the LIVE path costs while the tape is being made.
  await page.goto(`http://localhost:${srv.port}/nukernel/kernel-daw.html?idle=900000`,
    { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("nukernel.song.v1"));
  await page.reload({ waitUntil: "networkidle" });
  // composed through the same adoptSong the ✎ Write key uses — a real
  // arrangement, because a one-box loop never opens a second render window
  await page.evaluate(async a => {
    const S = await import("/nukernel/ui/state.js");
    if (!S.adoptSong(window.NuCompose.compose(a.g, a.s), "probe"))
      throw new Error("the loader refused the song");
  }, { g: GENRE, s: SEED });
  await page.waitForTimeout(600);
  const boxes = await page.evaluate(() => document.querySelectorAll("#song .box").length);
  console.log(`song: ${boxes} boxes (${GENRE}/${SEED})`);

  await page.click("#play");
  await page.waitForFunction(() => window.__rms && window.__rms() > 0.003, null, { timeout: 40000 });
  await page.evaluate(() => window.__on());
  // POLLED, not read once at the end: __nuRender().each is the LAST completed
  // render's window list, and the short insurance tape finishes first — so a
  // single read after two minutes reports one 8-second stage's one window and
  // makes the join below say something false about the full render underneath.
  for (let k = 0; k < SEC; k++) {
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const x = window.__nuRender();
      const e = (x.each || []).map(v => (Array.isArray(v) ? v[0] : v));
      if (e.length > (window.__each || []).length) window.__each = e;
    });
  }
  const s = await page.evaluate(() => window.__off());
  const lt = await page.evaluate(() => window.__lt.map(e => ({ s: e.s, d: e.d })));
  const r = await page.evaluate(() => window.__nuRender());
  const m = await page.evaluate(() => { const x = window.__nuMix();
    return { chans: x.channels.length, worklets: x.worklets, nodes: x.nodes.total }; });

  const rms = s.map(x => x[1]).filter(v => v > 0).sort((a, b) => a - b);
  const med = rms[Math.floor(rms.length / 2)] || 0;
  console.log(`\n${s.length} samples over ${SEC}s · median rms ${med.toFixed(4)} · ` +
              `${m.chans} channels, ${m.worklets} worklets, ${m.nodes} nodes`);
  console.log(`tape: stage ${r.stage}, ${r.chunks} windows of ${r.chunkSec}s, ` +
              `parallel ${r.parallel}, render ${r.ms} ms for ${(r.durSec || 0).toFixed(1)} s ` +
              `(ratio ${r.ratio})`);

  /* ---- (1) the thread, as the browser reports it --------------------------- */
  const big = lt.filter(e => e.d > 400).sort((a, b) => b.d - a.d);
  const blocked = Math.round(lt.reduce((n, e) => n + e.d, 0));
  const life = Math.round(s[s.length - 1][0]);
  console.log(`\n── THE THREAD ─────────────────────────────────────────────────`);
  console.log(`${lt.length} longtasks, ${big.length} of them over 400 ms`);
  console.log(`blocked ${blocked} ms of ${life} ms — ${(100 * blocked / life).toFixed(0)}% of wall clock`);
  console.log(`worst: ${big.slice(0, 8).map(e => Math.round(e.d) + "ms@" + Math.round(e.s)).join("  ")}`);
  // THE JOIN THAT NAMES THE CAUSE: a render window's own cost, matched to a
  // block of the same length. Same milliseconds means same task.
  const each = await page.evaluate(() => window.__each || []);
  if (each.length) {
    const wins = [...each].sort((a, b) => b - a);
    console.log(`worst render windows: ${wins.slice(0, 8).map(n => Math.round(n) + "ms").join("  ")}`);
    const matched = wins.filter(w => w > 400 &&
      big.some(e => Math.abs(e.d - w) < Math.max(150, w * 0.1))).length;
    console.log(`${matched} of the ${wins.filter(w => w > 400).length} windows over 400 ms ` +
                `are a longtask of their own length`);
  }

  /* ---- (2) what the ear got, on the far side of each block ----------------- */
  console.log(`\n── THE EAR ────────────────────────────────────────────────────`);
  console.log(`(0.15 s is transport.js's visible-tab lookahead — anything past it is unscheduled music)`);
  let n = 0, dead = 0;
  for (let i = 1; i < s.length; i++) {
    const dw = s[i][0] - s[i - 1][0];
    if (dw < 500) continue;
    n++;
    const after = s[i][1];
    if (after < med * 0.3) dead++;
    if (n <= 30) console.log(`  at ${String(Math.round(s[i - 1][0])).padStart(6)}  ` +
      `blocked ${String(Math.round(dw)).padStart(5)} ms  ` +
      `clock +${(s[i][2] - s[i - 1][2]).toFixed(2)}s  ` +
      `rms ${s[i - 1][1].toFixed(4)} -> ${after.toFixed(4)}` +
      (after < med * 0.3 ? "   <-- the music is gone" : ""));
  }
  console.log(`\n${n} blocks over 500 ms; the music was under 30% of level at the end of ${dead} of them`);

  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
