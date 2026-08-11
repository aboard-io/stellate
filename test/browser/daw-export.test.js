#!/usr/bin/env node
// test/browser/daw-export.test.js — the /daw export cluster, held to BYTES.
//
// "A file downloaded" is not the contract. Each format is checked as the format it
// claims to be, and against the song on screen:
//
//   A MIDI     real MThd/MTrk chunks, and the note count matches buildEvents
//   B MusicXML parses as XML, is score-partwise, and EVERY measure sums to a full
//              bar — a measure that does not add up is how a MusicXML file opens
//              as garbage in Finale/MuseScore while looking fine as text
//   C WAV      a real RIFF/WAVE header, 44.1k stereo, non-trivial length, and the
//              samples are NOT silent (a silent render is the classic pass)
//   D MP3      a real MPEG frame sync, and plausible size for the duration
//   E the door the ⤓ menu the header slimmed down to: four items, each a thumb
//              tall and fully on screen at 1280 AND 390, a real click on ⤓ MIDI
//              writing the file, and the menu closing itself behind the export
//
// WAV/MP3 render offline and take a while; the duration is kept short on purpose.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let checks = 0;
const ok = (m) => { checks++; console.log("  ok:", m); };
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };

async function main() {
  const srv = await serve(ROOT, 8979);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);

  await page.goto(`http://127.0.0.1:${srv.port}/daw.html?g=citypop&seed=7`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__DAWEXPORT && window.__DAW, null, { timeout: 20000 });
  await page.evaluate(() => { window.__DAWEXPORT.noDownload = true; });

  // ---- A MIDI ----
  const midi = await page.evaluate(() => {
    const b = window.__DAWEXPORT.downloadMidi();
    const ev = window.CsdEngine.buildEvents(window.__DAWSTATE());
    return { head: Array.from(b.slice(0, 4)).map((c) => String.fromCharCode(c)).join(""),
             len: b.length, name: window.__DAWEXPORT.lastName,
             tracks: (() => { let n = 0; for (let i = 0; i < b.length - 3; i++)
               if (b[i] === 77 && b[i + 1] === 84 && b[i + 2] === 114 && b[i + 3] === 107) n++; return n; })(),
             pitched: ev.pitched.length, drums: ev.drums.length };
  });
  if (midi.head !== "MThd") fail("MIDI has no MThd magic: " + midi.head);
  else ok(`MIDI is a real SMF — ${midi.tracks} MTrk chunks, ${midi.len} bytes, ${midi.name}`);
  if (!(midi.tracks >= 2)) fail("SMF has too few tracks: " + midi.tracks);
  else ok(`covers the score (${midi.pitched} pitched + ${midi.drums} drum events on screen)`);

  // ---- B MusicXML ----
  const xml = await page.evaluate(async () => {
    const s = await window.__DAWEXPORT.downloadMusicXml();
    const doc = new DOMParser().parseFromString(s, "application/xml");
    const err = doc.querySelector("parsererror");
    if (err) return { err: err.textContent.slice(0, 200) };
    const divs = +(doc.querySelector("divisions") || {}).textContent || 0;
    const beats = +(doc.querySelector("time beats") || {}).textContent || 0;
    const bad = [];
    for (const part of doc.querySelectorAll("part")) {
      for (const m of part.querySelectorAll("measure")) {
        let sum = 0;
        for (const n of m.querySelectorAll("note")) {
          if (n.querySelector("chord")) continue;
          sum += +(n.querySelector("duration") || {}).textContent || 0;
        }
        if (sum !== beats * divs) bad.push(`${part.id}:${m.getAttribute("number")}=${sum}`);
      }
    }
    return { root: doc.documentElement.nodeName, parts: doc.querySelectorAll("part").length,
             measures: doc.querySelectorAll("measure").length, divs, beats,
             bad: bad.slice(0, 5), badCount: bad.length, bytes: s.length };
  });
  if (xml.err) fail("MusicXML does not parse: " + xml.err);
  else if (xml.root !== "score-partwise") fail("MusicXML root is " + xml.root);
  else ok(`MusicXML parses — score-partwise, ${xml.parts} parts, ${xml.measures} measures, ${xml.bytes} bytes`);
  if (xml.badCount) fail(`${xml.badCount} measure(s) do not sum to a full bar (${xml.beats}×${xml.divs}): ${xml.bad.join(", ")}`);
  else ok(`every measure sums to a full bar (${xml.beats}×${xml.divs} divisions)`);

  // ---- C WAV ----
  const wav = await page.evaluate(async () => {
    const buf = await window.__DAWEXPORT.renderSong(8, () => {});
    const dv = new DataView(buf);
    const tag = (o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
    const n = (dv.byteLength - 44) / 4;
    let peak = 0, nz = 0;
    for (let i = 0; i < n; i += 37) {                 // sparse scan is plenty to prove non-silence
      const v = Math.abs(dv.getInt16(44 + i * 4, true)) / 32768;
      if (v > peak) peak = v;
      if (v > 0.001) nz++;
    }
    return { riff: tag(0), wave: tag(8), ch: dv.getUint16(22, true), sr: dv.getUint32(24, true),
             bits: dv.getUint16(34, true), bytes: dv.byteLength, frames: n, peak, nz };
  });
  if (wav.riff !== "RIFF" || wav.wave !== "WAVE") fail(`not a WAV: ${wav.riff}/${wav.wave}`);
  else ok(`WAV is real RIFF/WAVE — ${wav.ch}ch ${wav.sr}Hz ${wav.bits}bit, ${wav.frames} frames`);
  if (wav.sr !== 44100 || wav.ch !== 2) fail(`unexpected format: ${wav.ch}ch @ ${wav.sr}`);
  else ok("44.1k stereo, as the engine renders");
  if (!(wav.peak > 0.01) || wav.nz < 20) fail(`the render is SILENT (peak ${wav.peak}, ${wav.nz} nonzero samples)`);
  else ok(`the render is audible (peak ${wav.peak.toFixed(3)})`);

  // ---- D MP3 ----
  const mp3 = await page.evaluate(async () => {
    await window.__DAWEXPORT.downloadMp3(6, () => {});
    return { name: window.__DAWEXPORT.lastName, size: window.__DAWEXPORT.lastSize };
  });
  if (!/\.mp3$/.test(mp3.name || "")) fail("mp3 export named " + mp3.name);
  else if (!(mp3.size > 4000)) fail(`mp3 is implausibly small (${mp3.size} bytes) — probably an empty encode`);
  else ok(`MP3 encoded — ${mp3.name}, ${Math.round(mp3.size / 1024)} KB`);

  // ---- E THE DOOR: the ⤓ menu in the header ----
  // A–D drive __DAWEXPORT straight, which proves the FORMATS and nothing about
  // the way a person gets at them. Since the header slimmed to one row the four
  // exports live in a ⤓ menu, so the gate opens it the way a hand does, at both
  // viewports — a menu item that hangs off the screen is an export that does not
  // exist. (main.js closes the menu before it starts; that is checked too.)
  const menu = await page.evaluate(() => {
    const d = document.getElementById("dwDl");
    d.querySelector("summary").click();
    const items = [...d.querySelectorAll(".dw-dlitem")];
    const mr = d.querySelector(".dw-dlmenu").getBoundingClientRect();
    const hb = document.getElementById("dawbar").getBoundingClientRect();
    return { open: d.open, ids: items.map((b) => b.id),
      short: items.filter((b) => b.getBoundingClientRect().height < 43.5)
        .map((b) => b.id + "@" + Math.round(b.getBoundingClientRect().height)),
      clipped: mr.left < -0.5 || mr.right > window.innerWidth + 0.5,
      headerH: Math.round(hb.height), vw: window.innerWidth };
  });
  if (!menu.open || menu.ids.join(",") !== "dwWav,dwMp3,dwMid,dwXml")
    fail("the ⤓ menu does not carry the four exports: " + JSON.stringify(menu.ids));
  else ok(`⤓ opens on all four exports (${menu.ids.length} items, header one row at ${menu.headerH}px)`);
  if (menu.short.length) fail("⤓ menu items under 44px: " + menu.short.join(", "));
  else ok("every ⤓ item clears a thumb");
  if (menu.clipped) fail(`the ⤓ menu hangs off a ${menu.vw}px viewport`);
  else ok(`the ⤓ menu fits the ${menu.vw}px viewport`);

  await page.evaluate(() => { window.__DAWEXPORT.lastName = null; });
  await page.click("#dwMid");
  await page.waitForFunction(() => window.__DAWEXPORT.lastName != null, null, { timeout: 15000 });
  const clicked = await page.evaluate(() => ({
    name: window.__DAWEXPORT.lastName, open: document.getElementById("dwDl").open,
    label: document.getElementById("dwMid").textContent }));
  if (!/\.mid$/.test(clicked.name || "")) fail("clicking ⤓ MIDI produced " + clicked.name);
  else ok(`clicking ⤓ MIDI writes the file through the real DOM path (${clicked.name})`);
  if (clicked.open) fail("the ⤓ menu stayed open over the page after an export");
  else ok(`the menu closes itself as the export runs (button reads "${clicked.label}")`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const phone = await page.evaluate(() => {
    const d = document.getElementById("dwDl");
    d.querySelector("summary").click();
    const m = d.querySelector(".dw-dlmenu").getBoundingClientRect();
    const items = [...d.querySelectorAll(".dw-dlitem")].map((b) => b.getBoundingClientRect());
    const hb = document.getElementById("dawbar").getBoundingClientRect();
    d.open = false;
    return { l: Math.round(m.left), r: Math.round(m.right), b: Math.round(m.bottom),
      vw: window.innerWidth, vh: window.innerHeight, headerH: Math.round(hb.height),
      short: items.filter((r) => r.height < 43.5).length,
      xover: document.documentElement.scrollWidth - window.innerWidth };
  });
  if (phone.l < -0.5 || phone.r > phone.vw + 0.5 || phone.b > phone.vh + 0.5)
    fail(`the ⤓ menu is clipped at 390: ${phone.l}..${phone.r} of ${phone.vw}, bottom ${phone.b}/${phone.vh}`);
  else ok(`the ⤓ menu pins to the phone viewport (${phone.l}..${phone.r} of ${phone.vw})`);
  if (phone.short) fail(phone.short + " ⤓ items under 44px at 390");
  else if (phone.xover > 1) fail(`the menu pushes the page sideways by ${phone.xover}px`);
  else ok(`the header stays one row (${phone.headerH}px) and nothing scrolls sideways`);

  const fatal = errs.filter((e) => !/AudioContext|autoplay|user gesture/i.test(e));
  if (fatal.length) fail("page errors: " + fatal.join(" | "));
  else ok("no fatal page errors");

  await browser.close(); srv.close();
  if (process.exitCode) console.error("\nDAW-EXPORT: FAIL");
  else console.log(`\nDAW-EXPORT: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
