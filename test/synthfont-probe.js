#!/usr/bin/env node
// synthfont-probe.js — verifies B (synth fonts): selecting the MiniMoog synth
// font routes the sampler lane to modeld/juno60 voices AND still produces audio.
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node test/synthfont-probe.js
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8802;
const FONT = process.argv[2] || "minimoog";   // "minimoog" | "dx7"

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 850 });
  const errs = capturePageErrors(page);
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); return c; };

  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => window.__X && window.__S, { timeout: 20000 });
  await page.waitForTimeout(500);

  // the manifest must list minimoog (from fonts.json)
  const hasOption = await page.evaluate((FONT) => {
    document.getElementById("cfgChip").click();
    const sel = document.querySelector("select.sfsel");
    return sel ? [...sel.options].some(o => o.value === FONT) : false;
  }, FONT);
  ok(hasOption, "B1: no 'minimoog' option in the soundfont switcher");

  // start playback (so __EXPORT.exportAudio can capture the current song via the
  // deterministic PRESS path — the reliable audio check, as explorer-ui-test uses;
  // live rms() reads 0 headless because there's no real output device).
  await page.evaluate(() => __X.goLive());
  await page.waitForFunction(() => window.__S.playing, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(2500);

  // switch to MiniMoog LIVE (setSoundfont stops + retargets + restarts the engine)
  await page.evaluate((FONT) => {
    const sel = document.querySelector("select.sfsel");
    sel.value = FONT; sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, FONT);
  await page.waitForTimeout(4000);   // reload + retarget on the new font

  const st = await page.evaluate(() => {
    const p = window.__S.playing || {};
    const ins = p.instruments || {};
    const pick = (u) => u ? { model: u.model, sampler: !!u.sampler } : null;
    return { font: window.__S.soundfont, melody: pick(ins.melody), bass: pick(ins.bass), pad: pick(ins.pad) };
  });
  ok(st.font === FONT, `B2: soundfont not the synth font (got ${st.font})`);
  const noSampler = ["melody", "bass", "pad"].every(r => !st[r] || !st[r].sampler);
  ok(noSampler, `B3: a voice is still a sampler under the synth font: ${JSON.stringify(st)}`);

  // AUDIO: render the current song under the synth font via the press path.
  const wav = await page.evaluate(async () => {
    try {
      const buf = await window.__EXPORT.exportAudio("wav", { durSec: 8, noDownload: true });
      if (!buf) return { ok: false, status: window.__S.status };
      const dv = new DataView(buf); let sq = 0, n = 0;
      for (let o = 44; o + 1 < buf.byteLength; o += 2) { const s = dv.getInt16(o, true) / 32768; sq += s * s; n++; }
      return { ok: true, rms: Math.sqrt(sq / Math.max(1, n)), bytes: buf.byteLength };
    } catch (e) { return { ok: false, err: String(e) }; }
  });
  ok(wav.ok && wav.rms > 1e-4, `B4: synth font rendered silence (${wav.ok ? "rms " + wav.rms.toExponential(2) : "err " + (wav.err || wav.status)})`);
  const maxRms = wav.rms || 0;

  const otherErrs = errs.filter(e => !/AudioContext|autoplay|user gesture/i.test(e));
  ok(otherErrs.length === 0, `page errors: ${otherErrs.join(" | ")}`);

  console.log(`\n=== SYNTH-FONT PROBE (${FONT}) ===`);
  console.log(`  option=${hasOption} font=${st.font}`);
  console.log(`  voices: melody=${JSON.stringify(st.melody)} bass=${JSON.stringify(st.bass)} pad=${JSON.stringify(st.pad)}`);
  console.log(`  peak rms=${maxRms.toFixed(4)}`);

  await browser.close(); srv.close();
  if (fails.length) { console.log(`\nFAIL:\n  ${fails.join("\n  ")}`); process.exit(1); }
  console.log(`\nSYNTH-FONT PROBE: PASS`);
}
main().catch(e => { console.error(e); process.exit(1); });
