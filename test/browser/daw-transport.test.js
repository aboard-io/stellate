#!/usr/bin/env node
// test/browser/daw-transport.test.js — /daw actually PLAYS, over THE GRID.
//
// "The button toggled" is not the contract. This gate taps the real audio graph
// (the live engine's own analyser, handle.rms) and requires non-silence, then
// holds the three things that make it a WORKSTATION transport:
//
//   A it sounds            RMS above a floor on the live AudioContext
//   B the playhead runs    .dw-ghead advances over the grid (transform, piecewise
//                          beat → column), and the cell canvases DO NOT repaint
//                          to move it — the head is a separate element BY LAW
//   C edits land LIVE      a drum pad edit mid-playback does not stop the music
//                          — exploreLive re-reads getState() every chord bar
//   D a new song STOPS     changing the seed is a new song, not a glide; the
//                          transport stops cleanly
//   E VOLUME reaches       a drag on the controller's volume fill calls
//                          handle.setMasterVol on the LIVE engine (spied), and
//                          the music keeps playing
//   F ONE CONTROLLER       ▶, bar·beat, bpm and volume are ONE fixed element —
//                          the transport used to be split between a header
//                          button and a bottom-right box — and bar·beat is off
//                          the SAME interpolated clock the playhead lines ride:
//                          read in one animation frame, the number the box shows
//                          IS beatNow(), and stopping hides the line and blanks
//                          the number in the same placeHeads(null) call
//
// Chromium needs --autoplay-policy=no-user-gesture-required, which the harness's
// launch flags already provide for the app's own live gates.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let checks = 0;
const ok = (m) => { checks++; console.log("  ok:", m); };
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };

const headX = (page) => page.evaluate(() => {
  const h = document.querySelector(".dw-ghead");
  const m = /translateX\(([\d.]+)px\)/.exec(h ? h.style.transform : "");
  return m ? +m[1] : null;
});

async function main() {
  const srv = await serve(ROOT, 8974);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);

  await page.goto(`http://127.0.0.1:${srv.port}/daw.html?g=techno&seed=3`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__DAW && window.__DAW.grid && window.__DAW.grid.cols() > 0,
    null, { timeout: 20000 });

  // spy on the live handle BEFORE the first press: the volume control has to
  // reach the engine, and the only honest proof is the engine's own method.
  await page.evaluate(() => {
    window.__VOLCALLS = [];
    const real = window.FaustLive.exploreLive;
    window.FaustLive.exploreLive = async function (...a) {
      const h = await real.apply(this, a);
      if (h && h.setMasterVol) {
        const f = h.setMasterVol.bind(h);
        h.setMasterVol = (v) => { window.__VOLCALLS.push(v); return f(v); };
      }
      return h;
    };
  });

  // press PLAY like a user — the AudioContext unlock rides the real gesture, and
  // the ONE controller carries it (there is no header play button any more)
  await page.click(".dw-cplay");
  const started = await page.waitForFunction(
    () => window.__DAWTRANSPORT && window.__DAWTRANSPORT.isPlaying(), null, { timeout: 30000 }
  ).then(() => true).catch(() => false);
  if (!started) { fail("transport never reported playing"); }
  else ok("transport started from a real click");

  // ---- A IT SOUNDS ----
  const audio = await page.evaluate(async () => {
    const samples = [];
    for (let i = 0; i < 40; i++) {                   // ~10s of sampling
      samples.push(window.__DAWTRANSPORT.rms());
      await new Promise((r) => setTimeout(r, 250));
    }
    const nums = samples.filter((v) => typeof v === "number");
    return { n: nums.length, nonzero: nums.filter((v) => v > 0.001).length,
             max: nums.length ? Math.max.apply(null, nums) : 0 };
  });
  if (!audio.n) fail("the transport exposed no RMS — cannot prove it makes sound");
  else if (audio.nonzero < 5) fail(`the graph is SILENT (${audio.nonzero}/${audio.n} nonzero, max ${audio.max})`);
  else ok(`audible: ${audio.nonzero}/${audio.n} RMS samples nonzero, peak ${audio.max.toFixed(3)}`);

  // and the beat clock must be advancing, not just the audio ringing out
  const bars = await page.evaluate(async () => {
    const t0 = window.__DAWTRANSPORT.beatNow();
    await new Promise((r) => setTimeout(r, 6000));
    return { t0, t1: window.__DAWTRANSPORT.beatNow() };
  });
  if (!(bars.t1 > bars.t0)) fail(`the beat clock did not advance (${bars.t0} -> ${bars.t1})`);
  else ok(`the beat clock advanced ${bars.t0.toFixed(1)} → ${bars.t1.toFixed(1)} beats`);

  // ---- B the playhead runs over the grid; the canvases hold still ----
  const preHash = await page.evaluate(() => ({
    drums: window.__DAW.grid.rowHash("drums"), melody: window.__DAW.grid.rowHash("melody") }));
  const a = await headX(page);
  await page.waitForTimeout(1200);
  const b = await headX(page);
  const postHash = await page.evaluate(() => ({
    drums: window.__DAW.grid.rowHash("drums"), melody: window.__DAW.grid.rowHash("melody") }));
  if (a == null || b == null) fail("no .dw-ghead playhead over the grid");
  else if (!(b > a)) fail(`the grid playhead did not advance (${a} -> ${b}) — it should GLIDE`);
  else ok(`the grid playhead glided ${a.toFixed(1)} → ${b.toFixed(1)}px`);
  const visible = await page.evaluate(() =>
    getComputedStyle(document.querySelector(".dw-ghead")).opacity);
  if (!(+visible > 0.5)) fail("the playhead line is invisible while playing");
  else ok("the playhead line is visible while playing");
  if (preHash.drums !== postHash.drums || preHash.melody !== postHash.melody)
    fail("cell canvases repainted during a still window — the head must not be a repaint");
  else ok("the cell canvases did NOT repaint while the head moved (byte-identical rows)");

  // ---- F ONE CONTROLLER, ONE CLOCK ----
  // The transport was two instruments in two corners: a ▶ in the header and a
  // bar/beat/bpm box bottom-right. It is one box now, and the gate says so by
  // CONTAINMENT — not by a class name that could be reused anywhere.
  const box = await page.evaluate(() => {
    const root = window.__DAW.controller.el();
    const has = (sel) => { const e = document.querySelector(sel); return { n: document.querySelectorAll(sel).length, inside: !!e && root.contains(e) }; };
    const r = root.getBoundingClientRect();
    return { play: has(".dw-cplay"), pos: has(".dw-cpos"), bpm: has(".dw-cbpm"),
      vol: root.contains(window.__DAW.controller.volEl()),
      legacyHead: !!document.getElementById("dwHead"),
      fixed: getComputedStyle(root).position,
      h: Math.round(r.height), onScreen: r.bottom <= innerHeight + 1 && r.top >= 0 };
  });
  for (const [name, got] of [["▶", box.play], ["bar·beat", box.pos], ["bpm", box.bpm]]) {
    if (got.n !== 1) fail(`${got.n} "${name}" readouts on the page — the controller is ONE`);
    else if (!got.inside) fail(`the "${name}" readout is not inside the controller element`);
  }
  if (box.play.n === 1 && box.pos.n === 1 && box.bpm.n === 1 &&
      box.play.inside && box.pos.inside && box.bpm.inside && box.vol)
    ok("▶, bar·beat, bpm and volume are all in ONE controller element");
  if (box.legacyHead) fail("the old bottom-right #dwHead readout is still on the page");
  else ok("the split readout is gone — no #dwHead box in the corner");
  if (box.fixed !== "fixed" || !box.onScreen)
    fail(`the controller is position:${box.fixed}, on screen ${box.onScreen}`);
  else ok(`the controller is one fixed ${box.h}px bar, fully on screen`);

  // SAME CLOCK. Read the number and the line INSIDE one animation frame, after
  // the transport's own rAF has painted them both: the box must be showing
  // beatNow(), not a wall-clock timer that happens to look similar.
  const clock = await page.evaluate(() => new Promise((res) => {
    const sample = () => {
      const s = window.__DAWSTATE();
      const cb = Math.max(2, Math.round(s.chordEvery || (s.meter ? 6 : 8)));
      const txt = document.querySelector(".dw-cpos b").textContent.trim();
      const m = /^(\d+)·([\d.]+)$/.exec(txt);
      const head = /translateX\(([\d.]+)px\)/.exec(document.querySelector(".dw-ghead").style.transform);
      return { txt, cb, beat: window.__DAWTRANSPORT.beatNow(),
        shown: m ? (+m[1] - 1) * cb + (+m[2] - 1) : null,
        head: head ? +head[1] : null,
        bpm: document.querySelector(".dw-cbpm b").textContent.trim(),
        wantBpm: String(Math.round(s.bpm || 0)) };
    };
    requestAnimationFrame(() => {
      const a = sample();
      setTimeout(() => requestAnimationFrame(() => res({ a, b: sample() })), 1500);
    });
  }));
  if (clock.a.shown == null) fail(`the bar·beat readout does not read as bar·beat: "${clock.a.txt}"`);
  else if (Math.abs(clock.a.shown - clock.a.beat) > 0.2)
    fail(`the box says beat ${clock.a.shown.toFixed(2)} while beatNow() says ${clock.a.beat.toFixed(2)} — two clocks`);
  else ok(`bar·beat "${clock.a.txt}" IS beatNow() (${clock.a.beat.toFixed(2)}, chordEvery ${clock.a.cb})`);
  if (clock.b.shown == null || Math.abs(clock.b.shown - clock.b.beat) > 0.2)
    fail("the readout drifted off beatNow() over 1.5s — it is running on its own timer");
  else if (!(clock.b.shown > clock.a.shown) || !(clock.b.head > clock.a.head))
    fail(`the number and the line did not both advance (beat ${clock.a.shown}→${clock.b.shown}, x ${clock.a.head}→${clock.b.head})`);
  else ok(`number and line advance together (beat ${clock.a.shown.toFixed(1)}→${clock.b.shown.toFixed(1)}, x ${clock.a.head.toFixed(0)}→${clock.b.head.toFixed(0)}px)`);
  if (clock.a.bpm !== clock.a.wantBpm) fail(`the controller reads ${clock.a.bpm} bpm, the song is ${clock.a.wantBpm}`);
  else ok(`the bpm in the same box is the song's own (${clock.a.bpm})`);

  // ---- C an edit lands without stopping the music ----
  const live = await page.evaluate(async () => {
    const before = window.__DAWTRANSPORT.beatNow();
    window.__DAW.sheet.open("drums");
    await new Promise((r) => setTimeout(r, 300));
    const pads = window.__DAW.controls.pads();
    if (!pads.length) return { err: "no pads registered on the drums sheet" };
    const el = pads[0].el;
    el.focus();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    await new Promise((r) => setTimeout(r, 2500));
    window.__DAW.sheet.close();
    return { before, after: window.__DAWTRANSPORT.beatNow(),
             stillPlaying: window.__DAWTRANSPORT.isPlaying(),
             kits: Object.keys(window.__DAW.SONG.patch.kits || {}) };
  });
  if (live.err) fail(live.err);
  else {
    if (!live.kits.length) fail("the pad keyboard edit wrote nothing");
    if (!live.stillPlaying) fail("editing a machine stopped the music — edits must land at the next bar");
    else if (!(live.after > live.before)) fail("the clock stalled after an edit");
    else ok(`edited the kit mid-playback and the music kept running (${live.kits.join(",")})`);
  }

  // ---- E the volume control reaches the live engine ----
  const vol = await page.evaluate(async () => {
    window.__VOLCALLS.length = 0;
    const el = window.__DAW.controller.volEl();
    const r = el.getBoundingClientRect();
    const mk = (t, x) => el.dispatchEvent(new PointerEvent(t, { pointerId: 9, pointerType: "mouse",
      isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: r.top + r.height / 2 }));
    const before = window.__DAW.controller.volume();
    mk("pointerdown", r.left + r.width - 8);
    mk("pointermove", r.left + r.width / 2);
    mk("pointerup", r.left + r.width / 2);
    await new Promise((z) => setTimeout(z, 400));
    return { before, after: window.__DAW.controller.volume(), calls: window.__VOLCALLS.slice(),
      playing: window.__DAWTRANSPORT.isPlaying(),
      stored: parseFloat(localStorage.getItem("dw.vol")),
      role: el.getAttribute("role"), ranges: document.querySelectorAll('input[type=range]').length };
  });
  if (!(vol.after < vol.before)) fail("the volume drag changed nothing: " + JSON.stringify(vol));
  else if (!vol.calls.length) fail("the volume drag never reached handle.setMasterVol");
  else if (!vol.playing) fail("the volume drag stopped the music");
  else if (!(vol.stored === vol.after)) fail("the volume did not persist to localStorage");
  else ok(`volume drag ${vol.before.toFixed(2)} → ${vol.after.toFixed(2)} reached setMasterVol ${vol.calls.length}× while playing`);
  if (vol.role !== "slider" || vol.ranges) fail("the volume control is not a keyboard slider, or a range input appeared");
  else ok("volume is role=slider with zero <input type=range> on the page");
  await page.evaluate(() => window.__DAW.controller.setVolume(1));

  // ---- D changing the song stops cleanly ----
  // the seed lives in the KERNEL VIEW now (the rail's root), so go home first
  await page.evaluate(() => window.__DAW.sheet.root());
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.getElementById("dwSeed").value = "99";
    document.getElementById("dwSeed").dispatchEvent(new Event("change", { bubbles: true })); });
  await page.waitForTimeout(700);
  const stopped = await page.evaluate(() => ({ playing: window.__DAWTRANSPORT.isPlaying(),
    label: document.querySelector(".dw-cplay").textContent.trim(),
    pos: document.querySelector(".dw-cpos b").textContent.trim(),
    headOpacity: getComputedStyle(document.querySelector(".dw-ghead")).opacity }));
  if (stopped.playing) fail("a seed change left the old song playing — the DAW is not a glide");
  else ok(`changing the song stopped playback cleanly (button reads "${stopped.label}")`);
  // the SAME placeHeads(null) that hides the line blanks the number: one clock,
  // stopped as well as running
  if (stopped.pos !== "—" || +stopped.headOpacity > 0.01)
    fail(`stopping left the readout "${stopped.pos}" and the line at opacity ${stopped.headOpacity}`);
  else ok("stopping hides the line AND blanks the number — the same call does both");

  const fatal = errs.filter((e) => !/AudioContext|autoplay|user gesture/i.test(e));
  if (fatal.length) fail("page errors: " + fatal.join(" | "));
  else ok("no fatal page errors");

  await browser.close(); srv.close();
  if (process.exitCode) console.error("\nDAW-TRANSPORT: FAIL");
  else console.log(`\nDAW-TRANSPORT: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
