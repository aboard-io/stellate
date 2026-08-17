#!/usr/bin/env node
// test/probes/nukernel-section.probe.js — HOW BIG IS THE HOLE AT A SECTION
// BOUNDARY, in milliseconds and in samples, on BOTH audible paths.
//
//   node test/probes/nukernel-section.probe.js
//   NU_MODE=tape NU_ROOT=/tmp/nuold node test/probes/nukernel-section.probe.js
//
// Paul, listening to staging on 2026-08-17: "The audio is skipping between
// sections. There's a gap." A regression — it was not there the night before.
// Four things could make it and only a measurement can say which:
//
//   1. the live scheduler's lookahead is too narrow to cover the section change
//   2. the section change itself got more expensive (its own key, its own kit)
//   3. the hole is baked into the RENDERED TAPE, which is the audible path
//      whenever nobody is touching the desk (audio/bounce.js)
//   4. something simpler — a voice re-acquired late, a bar count off by one
//
// So this reads both paths, at every seam of a real composed arrangement, and
// says which of them changes KEY and which changes KIT — because that
// comparison names the cause on its own.
//
// THE TAPE is read as SAMPLES: __nuRenderNow's { tap } hands back the raw float
// span around a boundary, so "is there a hole" is answered on the artifact
// rather than on an analyser's opinion of it. A GAP IS NOT ONLY SILENCE — the
// audible failure is a DUCK, a level that falls out from under the music and
// comes back, so the reading is the deepest 20 ms trough in the span as a
// fraction of the music either side of it, and the run of samples under a fifth
// of that. THE LIVE GRAPH is read the way test/probes/nukernel-return.probe.js
// reads the return — window.__rms every 10 ms — against the audio clock, with a
// main-thread lateness sampler beside it, because a scheduler that misses a
// downbeat misses it by being BLOCKED and the block shows in a timer long
// before it is audible.
//
// NU_ROOT serves a different tree at the same measurement (git archive an old
// commit, symlink found/ and engine/faust/node_modules into it), which is how
// the before/after of a regression is taken by one instrument.
"use strict";
const { serve, launchChromium } = require("../lib/probe-harness.js");
const path = require("path");
const fs = require("fs");

const REPO = path.join(__dirname, "..", "..");
const ROOT = process.env.NU_ROOT || REPO;
const SR = 44100;
const GENRE = process.env.NU_GENRE || "beatles";
const SEED = process.env.NU_SEED || "3";           // beatles/3 modulates: keys 5 -> 2
const MODE = process.env.NU_MODE || "both";
const SONGJSON = process.env.NU_SONG || "";

const sampler = () => {
  window.__secOn = () => {
    window.__sec = [];
    window.__secMarks = [];
    const t0 = performance.now();
    let want = performance.now() + 10;
    const step = () => {
      const now = performance.now();
      const b = window.__nuBounce();
      window.__sec.push({
        t: +(now - t0).toFixed(1),
        // THE AUDIO CLOCK, on every sample. A section mark is emitted when the
        // bar is SCHEDULED — a whole lookahead before it sounds — so a hole
        // measured against wall time is measured against the wrong instant.
        ct: +window.__ctx.currentTime.toFixed(4),
        late: +(now - want).toFixed(1),
        rms: +window.__rms().toFixed(5),
        c: b.carrying ? 1 : 0, v: b.elVolume, p: b.elPaused ? 1 : 0,
        dr: window.__nuDropped || 0, fb: window.__nuFallback || 0,
      });
      want = now + 10;
      window.__secIv = setTimeout(step, 10);
    };
    window.__secIv = setTimeout(step, 10);
    window.__secT0 = t0;
  };
  window.__secOff = () => { clearTimeout(window.__secIv);
                            return { rows: window.__sec, marks: window.__secMarks }; };
};

const taps = () => {
  const AC = window.AudioContext || window.webkitAudioContext;
  window.AudioContext = function (...a) {
    const c = new AC(...a);
    window.__ctx = c;
    const an = c.createAnalyser(); an.fftSize = 2048;
    const orig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest === c.destination) { try { orig.call(this, an); } catch (e) {} }
      return orig.call(this, dest, ...rest);
    };
    window.__rms = () => {
      const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d);
      let s = 0; for (const v of d) s += v * v;
      return Math.sqrt(s / d.length);
    };
    return c;
  };
};

// ---- reading a span of tape ------------------------------------------------
// RMS in a sliding 20 ms window: the trough is the DUCK, the run under a fifth
// of the music either side is the HOLE. 20 ms because that is about the
// shortest dropout an ear calls a gap rather than a click.
function troughIn(ch, mid) {
  const W = Math.round(0.020 * SR);
  const box = new Float64Array(Math.max(0, ch.length - W));
  let acc = 0;
  for (let i = 0; i < W && i < ch.length; i++) acc += ch[i] * ch[i];
  for (let i = 0; i < box.length; i++) {
    box[i] = Math.sqrt(acc / W);
    acc += ch[i + W] * ch[i + W] - ch[i] * ch[i];
  }
  const span = (a, b) => {              // mean rms over a sample range
    let s = 0, n = 0;
    for (let i = Math.max(0, a); i < Math.min(box.length, b); i++) { s += box[i]; n++; }
    return n ? s / n : 0;
  };
  const pre = span(mid - 0.30 * SR, mid - 0.05 * SR);
  const post = span(mid + 0.05 * SR, mid + 0.30 * SR);
  const ref = Math.min(pre, post);
  let lo = Infinity, loAt = 0;
  const a = Math.max(0, Math.round(mid - 0.25 * SR)), b = Math.min(box.length, Math.round(mid + 0.25 * SR));
  for (let i = a; i < b; i++) if (box[i] < lo) { lo = box[i]; loAt = i; }
  const floor = ref * 0.2;
  let run = 0, best = 0, bestAt = 0;
  for (let i = a; i < b; i++) {
    if (box[i] < floor) { run++; if (run > best) { best = run; bestAt = i - run + 1; } }
    else run = 0;
  }
  let step = 0;
  for (let i = a + 1; i < b && i < ch.length; i++) {
    const d = Math.abs(ch[i] - ch[i - 1]); if (d > step) step = d;
  }
  return { pre: +pre.toFixed(5), post: +post.toFixed(5),
           trough: +lo.toFixed(5), troughAtMs: +((loAt - mid) * 1000 / SR).toFixed(1),
           dip: ref > 0 ? +(lo / ref).toFixed(3) : 1,
           holeSamples: best, holeMs: +(best * 1000 / SR).toFixed(1),
           holeAtMs: best ? +((bestAt - mid) * 1000 / SR).toFixed(1) : null,
           step: +step.toFixed(4) };
}

(async () => {
  const srv = await serve(ROOT, 8983);
  const PORT = srv.port;
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.addInitScript(taps);
  await page.addInitScript(sampler);
  page.on("pageerror", e => console.log("   page error:", String(e).slice(0, 200)));

  console.log(`tree: ${ROOT}`);
  // ?idle=600000 — the desk must NOT hand itself to the tape during the live
  // reading. The tape reading does not need the handoff at all: it renders on
  // demand and reads the bytes.
  await page.goto(`http://localhost:${PORT}/nukernel/kernel-daw.html?idle=600000`,
    { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("nukernel.song.v1"));
  await page.reload({ waitUntil: "networkidle" });

  // A COMPOSED SONG OF ELEVEN BOXES — a real arrangement with real seams. The
  // seed matters (beatles/3 modulates at the bridge) and the transport bar
  // prints no seed field any more, so the composer is called directly through
  // the same adoptSong the ✎ Write key uses. NU_SONG adopts a song from disk
  // instead, which is how two trees are measured on ONE arrangement.
  const song = SONGJSON ? JSON.parse(fs.readFileSync(SONGJSON, "utf8")) : null;
  await page.evaluate(async (a) => {
    const S = await import("/nukernel/ui/state.js");
    const s = a.song || window.NuCompose.compose(a.genre, +a.seed);
    if (!S.adoptSong(s, "probe")) throw new Error("the loader refused the song");
  }, { song, genre: GENRE, seed: SEED });
  await page.waitForTimeout(800);
  const boxes = await page.evaluate(() => document.querySelectorAll("#song .box").length);
  console.log(`song: ${boxes} boxes` + (song ? " (from disk)" : ` (${GENRE}/${SEED})`));

  await page.click("#play");
  await page.waitForFunction(() => window.__rms && window.__rms() > 0.003,
    null, { timeout: 30000 });

  // ---- where the seams are, and what changes at each -----------------------
  const seams = await page.evaluate(async () => {
    const [t, s, d, bo] = await Promise.all([
      import("/nukernel/audio/transport.js"),
      import("/nukernel/ui/state.js"),
      import("/nukernel/ui/derive.js"),
      import("/nukernel/audio/bounce.js")]);
    const TL = t.buildTimeline(), sd = t.stepDur();
    // WHICH SEAMS ALSO OPEN A RENDER WINDOW. The tape is a concatenation of
    // ~6 s windows with a one-bar pre-roll, and a four-bar box on a four-bar
    // window grid puts many of those seams in exactly the same place — so
    // "does the hole only happen where a window opens" is the question that
    // separates a tape defect from a musical rest.
    const opens = new Set((bo.planFor ? bo.planFor(TL, sd).chunks : []).map(c => c.a));
    const out = []; let acc = 0;
    const t0 = TL.map(b => { const v = acc; acc += b.barSteps * sd; return v; });
    for (let i = 1; i < TL.length; i++) {
      if (TL[i].si === TL[i - 1].si) continue;
      const A = s.SONG[TL[i - 1].si], B = s.SONG[TL[i].si];
      out.push({ bar: i, at: +t0[i].toFixed(4), from: TL[i - 1].si, to: TL[i].si,
                 roleA: A.role, roleB: B.role,
                 keyA: A.key == null ? null : +A.key, keyB: B.key == null ? null : +B.key,
                 kitA: d.kitOf(A), kitB: d.kitOf(B), opens: opens.has(i),
                 evA: TL[i - 1].ev.length, evB: TL[i].ev.length });
    }
    return { seams: out, total: acc, bars: TL.length };
  });
  console.log(`${seams.bars} bars, ${seams.total.toFixed(1)} s, ${seams.seams.length} seams\n`);

  // ---- (1) THE RENDERED TAPE, read as samples across EVERY seam ------------
  if (MODE !== "live") {
    console.log(`── THE TAPE (the audible path whenever nobody is touching) ─────`);
    for (let k = 0; k < 120; k++) {
      const b = await page.evaluate(() => {
        const x = window.__nuBounce();
        return { state: x.state, stage: x.stage, phase: x.phase, want: x.wantSec };
      });
      if (b.state === "ready" && b.stage === "full") break;
      if (k % 6 === 0) console.log(`  …tape ${b.stage}/${b.state} ${b.phase || ""}`);
      await page.waitForTimeout(5000);
    }

    // THE ARTIFACT ITSELF, not a re-render of it. st.url is the blob the
    // <audio> element is playing — one fetch and one decode gives every seam,
    // where __nuRenderNow re-assembles 150 s of tape per span. What Paul hears
    // is these bytes.
    const HALF = 0.45;
    const info = await page.evaluate(async (spans) => {
      const b = window.__nuBounce();
      if (!b.url) return { err: "no tape url" };
      const buf = await (await fetch(b.url)).arrayBuffer();
      const dec = await window.__ctx.decodeAudioData(buf);
      const d = dec.getChannelData(0);
      const SR2 = dec.sampleRate;
      const out = spans.map(([a, z]) => Array.from(
        d.slice(Math.max(0, Math.round(a * SR2)), Math.round(z * SR2))));
      return { sr: SR2, durSec: dec.duration, bytes: buf.byteLength, spans: out,
               lanes: b.lanes, lanesWant: b.lanesWant, lanesMissing: b.lanesMissing,
               fallbacks: b.fallbacks, sampledOnly: b.sampledOnly, seam: b.seam };
    }, seams.seams.map(s => [Math.max(0, s.at - HALF), s.at + HALF]));
    if (info.err) console.log("  " + info.err);
    else {
      console.log(`  tape: ${info.durSec.toFixed(2)}s decoded at ${info.sr} Hz, ` +
        `${(info.bytes / 1e6).toFixed(1)} MB; lanes [${(info.lanes || []).join(",")}] ` +
        `missing [${(info.lanesMissing || []).join(",")}] fallbacks ${info.fallbacks} ` +
        `sampledOnly ${info.sampledOnly}`);
      seams.seams.forEach((s, i) => {
        const ch = Float32Array.from(info.spans[i]);
        const h = troughIn(ch, Math.round(Math.min(HALF, s.at) * SR));
        const tag = ((s.keyA !== s.keyB ? " KEY" : "") +
                     (s.kitA !== s.kitB ? " KIT" : "") +
                     (s.opens ? " WIN" : "")) || " ---";
        console.log(`  bar ${String(s.bar).padStart(3)} @ ${s.at.toFixed(2).padStart(7)}s ` +
          `${(s.roleA + "->" + s.roleB).padEnd(17)}${tag}  rms ${h.pre}|${h.post}  ` +
          `dip ${String((h.dip * 100).toFixed(0)).padStart(3)}% at ${h.troughAtMs} ms  ` +
          `HOLE ${h.holeMs} ms (${h.holeSamples} samples)` +
          (h.holeAtMs != null ? ` from ${h.holeAtMs} ms` : "") + `  step ${h.step}`);
      });
    }
  }

  // ---- (2) THE LIVE GRAPH, across every seam it reaches --------------------
  if (MODE !== "tape") {
    console.log(`\n── THE LIVE GRAPH (someone is touching the desk) ───────────────`);
    await page.evaluate(async () => {
      const [s, t] = await Promise.all([
        import("/nukernel/ui/state.js"), import("/nukernel/audio/transport.js")]);
      s.on("transport:section", d => {
        if (!window.__sec) return;
        // passStart is the CONTEXT TIME the section's first bar sounds at — the
        // instant the ear calls the boundary. The wall clock is a lookahead
        // ahead of it.
        const p = t.getPosition();
        window.__secMarks.push({ t: +(performance.now() - window.__secT0).toFixed(1),
                                 si: d.si, at: +p.passStart.toFixed(4) });
      });
    });
    await page.evaluate(() => window.__secOn());
    const WATCH = +(process.env.NU_WATCH || 0) || 75000;
    await page.waitForTimeout(WATCH);
    const live = await page.evaluate(() => window.__secOff());
    const rows = live.rows, FLOOR = 0.01, LAG = 2048 / 2 / SR;
    let worst = 0, worstAt = 0;
    for (const r of rows) if (r.late > worst) { worst = r.late; worstAt = r.t; }
    console.log(`  ${rows.length} samples over ${(WATCH / 1000).toFixed(0)}s; ` +
      `worst main-thread lateness ${worst.toFixed(0)} ms at ${(worstAt / 1000).toFixed(1)}s`);
    for (const m of live.marks) {
      const near = rows.filter(r => r.ct > m.at - 1.0 && r.ct < m.at + 1.0);
      if (near.length < 20) continue;
      // the same two readings the tape gets: the deepest trough as a fraction
      // of the music either side, and the run of nothing at all
      const mean = (a, b) => {
        const w = near.filter(r => r.ct > a && r.ct < b);
        return w.length ? w.reduce((s, r) => s + r.rms, 0) / w.length : 0;
      };
      const ref = Math.min(mean(m.at - 0.8, m.at - 0.1), mean(m.at + 0.1, m.at + 0.8));
      let lo = Infinity, loAt = 0, run = 0, best = 0, bestAt = null;
      for (const r of near) {
        if (r.ct < m.at - 0.5 || r.ct > m.at + 0.5) continue;
        if (r.rms < lo) { lo = r.rms; loAt = r.ct; }
        const audible = r.rms > FLOOR || (r.v > 0.02 && !r.p);
        if (!audible) { run++; if (run > best) { best = run; bestAt = r.ct - (run - 1) * 0.01; } }
        else run = 0;
      }
      const blk = near.reduce((a, r) => Math.max(a, r.late), 0);
      const drops = near[near.length - 1].dr - near[0].dr;
      console.log(`   si${String(m.si).padStart(2)} downbeat ctx ${m.at.toFixed(2)}s: ` +
        `dip ${ref > 0 ? ((lo / ref) * 100).toFixed(0) : "?"}% at ` +
        `${((loAt - LAG - m.at) * 1000).toFixed(0)} ms, ` +
        `HOLE ${best * 10} ms (${Math.round(best * 10 * SR / 1000)} samples)` +
        (bestAt != null ? ` from ${((bestAt - LAG - m.at) * 1000).toFixed(0)} ms` : "") +
        `, block ${blk.toFixed(0)} ms, ${drops} drops`);
    }
  }

  await browser.close();
  srv.close();
})();
