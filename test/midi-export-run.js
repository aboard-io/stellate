#!/usr/bin/env node
// test/midi-export-run.js — THE ⤓ MIDI GATE (restored 2026-07-26, Paul: "I want
// midi back"). The download cluster was excised 2026-07-25; the MIDI half came
// back and this gate holds it to a hard contract: not "a file appeared" but
// "the bytes are a real Standard MIDI File AND they are the music on screen".
//
// It drives index.html headless, opens the ⚙ modal, CLICKS the ⤓ midi button
// like a user, captures the actual browser download, and then:
//   (A) parses the bytes as an SMF from scratch (MThd/MTrk chunk walk, running
//       status, VLQ deltas) — format, division, track count, end-of-track,
//       tempo + time-signature meta;
//   (B) compares every note-on against CsdEngine.buildEvents() run on the state
//       the app says it exported: per-channel note COUNTS and pitch HISTOGRAMS
//       for pads(ch1)/bass(ch2)/melody(ch3)/drums(ch10). A wrong state, a
//       dropped lane or a shifted transposition all fail here;
//   (C) proves it is THIS song: the exported state deep-equals S.playing, the
//       tempo meta is S.playing.bpm, the filename carries the genre + seed +
//       measure the ↗ share URL carries, and it is pure ASCII;
//   (D) moving the traveler to another point on the path changes the bytes,
//       while re-clicking without moving reproduces them byte-for-byte;
//   (E) LIVE: with audio actually playing, the file still matches S.playing and
//       the filename's measure agrees with the share URL's ?m.
//   node test/midi-export-run.js
"use strict";
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const PORT = 8963;
const SEED = 4242;
const PATH_Q = "1691.4502,1826.3140,1101.20620";
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

// ---------------------------------------------------------------- SMF parser
// Deliberately written here from the spec rather than reusing engine code: a
// gate that parsed with the writer's own helpers could not catch the writer
// emitting something only it understands.
function parseSMF(buf) {
  const r = { chunks: [], notes: {}, meta: [], tracks: 0, endsOk: 0, errors: [] };
  if (buf.length < 14) { r.errors.push("shorter than a header"); return r; }
  if (buf.toString("ascii", 0, 4) !== "MThd") { r.errors.push("no MThd magic"); return r; }
  const hlen = buf.readUInt32BE(4);
  if (hlen !== 6) r.errors.push("MThd length " + hlen + " (want 6)");
  r.format = buf.readUInt16BE(8);
  r.ntracks = buf.readUInt16BE(10);
  r.division = buf.readUInt16BE(12);
  let p = 8 + hlen;
  while (p + 8 <= buf.length) {
    const id = buf.toString("ascii", p, p + 4), len = buf.readUInt32BE(p + 4);
    const body = buf.slice(p + 8, p + 8 + len);
    if (body.length !== len) { r.errors.push("truncated chunk " + id); break; }
    r.chunks.push(id);
    if (id === "MTrk") { r.tracks++; parseTrack(body, r); }
    p += 8 + len;
  }
  if (p !== buf.length) r.errors.push("trailing bytes after the last chunk");
  return r;
}
function parseTrack(b, r) {
  let p = 0, status = 0, ended = false, name = "";
  const vlq = () => { let v = 0, c; do { if (p >= b.length) throw new Error("VLQ ran off the track"); c = b[p++]; v = (v << 7) | (c & 0x7f); } while (c & 0x80); return v; };
  try {
    while (p < b.length) {
      const dt = vlq();
      if (dt < 0) r.errors.push("negative delta");
      let s = b[p];
      if (s & 0x80) { p++; status = s; } else { s = status; }         // running status
      if (s === 0xFF) {                                                // meta
        const type = b[p++], len = vlq(), data = b.slice(p, p + len); p += len;
        if (type === 0x2F) { ended = true; if (p !== b.length) r.errors.push("bytes after end-of-track"); }
        if (type === 0x03) name = data.toString("ascii");
        if (type === 0x51) r.meta.push({ tempoUs: (data[0] << 16) | (data[1] << 8) | data[2] });
        if (type === 0x58) r.meta.push({ timeSig: [data[0], 1 << data[1]] });
      } else if (s === 0xF0 || s === 0xF7) { const len = vlq(); p += len; }
      else {
        const hi = s & 0xF0, ch = s & 0x0F;
        const nData = (hi === 0xC0 || hi === 0xD0) ? 1 : 2;
        const d1 = b[p], d2 = nData === 2 ? b[p + 1] : 0; p += nData;
        if (hi === 0x90 && d2 > 0) {
          const lane = (r.notes[ch] = r.notes[ch] || { count: 0, hist: {}, name });
          lane.count++; lane.hist[d1] = (lane.hist[d1] || 0) + 1; lane.name = lane.name || name;
          if (d1 > 127 || d2 > 127) r.errors.push("data byte out of range");
        }
      }
    }
  } catch (e) { r.errors.push("track parse: " + e.message); }
  if (ended) r.endsOk++; else r.errors.push("track '" + name + "' has no end-of-track meta");
}
const sameHist = (a, b) => {
  const ks = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of ks) if ((a[k] | 0) !== (b[k] | 0)) return "pitch " + k + ": file " + (a[k] | 0) + " vs engine " + (b[k] | 0);
  return null;
};

// what the engine says the file should contain, computed IN THE PAGE from the
// state app/export.js says it exported. Mirrors engine/midi-export.js's lane
// split + GM drum map — independently, so a change on one side shows up.
const EXPECTED_IN_PAGE = `(state => {
  const ev = CsdEngine.buildEvents(state);
  const lane = (notes) => { const h = {}; let n = 0;
    for (const x of notes) { const m = CsdEngine.pchToMidi(x.pch); if (m < 0 || m > 127) continue; h[m] = (h[m]||0)+1; n++; }
    return { count: n, hist: h }; };
  const DM = {kick:36,snare:38,hat:42,tom:45,crash:49,ride:51,clap:39,rim:37,perc:63};
  const dh = {}; let dn = 0;
  for (const d of ev.drums) { const note = d.drum === "hat" ? (d.open?46:42) : DM[d.drum];
    if (note == null) continue; dh[note] = (dh[note]||0)+1; dn++; }
  return { bpm: ev.bpm, meter: state.meter || null,
    0: lane(ev.pitched.filter(p=>p.voice==="pad")),
    1: lane(ev.pitched.filter(p=>p.voice==="bass")),
    2: lane(ev.pitched.filter(p=>p.voice==="melody")),
    9: { count: dn, hist: dh } };
})`;

async function grabMidi(page, dir, tag) {
  const btn = page.locator("#panel button", { hasText: "midi" });
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), btn.click()]);
  const file = path.join(dir, tag + "-" + dl.suggestedFilename());
  await dl.saveAs(file);
  const bytes = fs.readFileSync(file);
  const info = await page.evaluate((src) => {
    const E = window.__EXPORT;
    return { name: E.lastName, len: E.lastMidi ? E.lastMidi.length : 0, status: window.__S.status,
      state: E.lastState, playing: window.__S.playing, share: window.__X.shareUrl(),
      expect: eval(src)(E.lastState) };
  }, EXPECTED_IN_PAGE);
  return { bytes, name: dl.suggestedFilename(), info };
}

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = capturePageErrors(page);
  const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "stellate-midi-"));

  await page.goto(`http://localhost:${PORT}/index.html?seed=${SEED}&path=${PATH_Q}&m=33`);
  await page.waitForFunction(() => window.__X && window.__S && window.__S.playing, { timeout: 30000 });
  await page.waitForTimeout(400);

  // ---- the button is really there, in the ⚙ modal, enabled ----------------
  await page.click("#cfgChip");
  await page.waitForTimeout(200);
  const btn = page.locator("#panel button", { hasText: "midi" });
  if ((await btn.count()) === 1) ok("exactly one ⤓ midi button in the ⚙ panel"); else fail(`${await btn.count()} midi buttons in #panel`);
  if (await btn.isVisible() && await btn.isEnabled()) ok("the ⤓ midi button is visible and enabled with a song loaded");
  else fail("the ⤓ midi button is hidden or disabled");
  const cls = await btn.getAttribute("class");
  if (/\bmini\b/.test(cls || "")) ok("house style: it is a button.mini, like ↗ share / ⧉ copy embed"); else fail(`button class "${cls}"`);

  // ---- (A) real bytes, real SMF -------------------------------------------
  const a = await grabMidi(page, tmp, "stopped");
  const smf = parseSMF(a.bytes);
  if (a.bytes.length > 200) ok(`downloaded ${a.bytes.length} bytes (${a.name})`); else fail(`only ${a.bytes.length} bytes`);
  if (a.bytes.length === a.info.len) ok("the downloaded bytes are the bytes the app built"); else fail(`download ${a.bytes.length} vs app ${a.info.len}`);
  if (!smf.errors.length) ok("parses as a Standard MIDI File with no structural errors"); else fail("SMF errors: " + smf.errors.join("; "));
  if (smf.format === 1) ok("MThd format 1 (multi-track)"); else fail(`format ${smf.format}`);
  if (smf.division === 480 && smf.division > 0 && !(smf.division & 0x8000)) ok(`sane division: ${smf.division} ticks/quarter (metrical, not SMPTE)`);
  else fail(`division ${smf.division}`);
  if (smf.tracks >= 2 && smf.tracks === smf.ntracks) ok(`${smf.tracks} MTrk chunks, matching the header's ntracks`);
  else fail(`${smf.tracks} tracks vs header ${smf.ntracks}`);
  if (smf.endsOk === smf.tracks) ok("every track ends with FF 2F 00"); else fail(`${smf.endsOk}/${smf.tracks} tracks end properly`);
  const totalNotes = Object.values(smf.notes).reduce((n, l) => n + l.count, 0);
  if (totalNotes > 32) ok(`${totalNotes} note-on events (non-empty music, not a header with silence)`); else fail(`only ${totalNotes} note-ons`);

  // ---- (B) the notes ARE the state's buildEvents lanes ---------------------
  const LANES = { 0: "pads", 1: "bass", 2: "melody", 9: "drums" };
  let lanesChecked = 0;
  for (const ch of Object.keys(LANES)) {
    const want = a.info.expect[ch], got = smf.notes[ch] || { count: 0, hist: {} };
    if (!want || !want.count) { if (got.count) fail(`channel ${ch} (${LANES[ch]}) has ${got.count} notes but buildEvents has none`); continue; }
    lanesChecked++;
    if (got.count !== want.count) { fail(`${LANES[ch]}: file has ${got.count} note-ons, buildEvents has ${want.count}`); continue; }
    const diff = sameHist(got.hist, want.hist);
    if (diff) fail(`${LANES[ch]}: pitch histogram differs — ${diff}`);
    else ok(`${LANES[ch]} (ch${+ch + 1}): ${got.count} notes, pitch-for-pitch the state's buildEvents lane`);
  }
  if (lanesChecked >= 3) ok(`${lanesChecked} lanes verified against the engine`); else fail(`only ${lanesChecked} lanes present to verify`);
  if (smf.notes[9] && smf.notes[9].count) {
    const bad = Object.keys(smf.notes[9].hist).filter((n) => +n < 27 || +n > 87);
    if (!bad.length) ok(`drums land in the GM percussion range on channel 10 (${smf.notes[9].count} hits)`);
    else fail(`drum notes outside GM percussion: ${bad.join(",")}`);
  }

  // ---- (C) it is THIS song: tempo, meter, state identity, filename ---------
  const wantUs = Math.round(60000000 / (a.info.expect.bpm || 88));
  const tempo = smf.meta.find((m) => m.tempoUs != null);
  if (tempo && Math.abs(tempo.tempoUs - wantUs) <= 1) ok(`tempo meta = ${Math.round(60000000 / tempo.tempoUs)} bpm, the playing state's tempo`);
  else fail(`tempo meta ${tempo && tempo.tempoUs} vs wanted ${wantUs}`);
  const ts = smf.meta.find((m) => m.timeSig);
  const wantTs = a.info.expect.meter ? [a.info.expect.meter.beats, a.info.expect.meter.unit] : [4, 4];
  if (ts && ts.timeSig[0] === wantTs[0] && ts.timeSig[1] === wantTs[1]) ok(`time signature ${ts.timeSig[0]}/${ts.timeSig[1]} = the state's meter`);
  else fail(`time sig ${ts && ts.timeSig} vs wanted ${wantTs}`);
  if (JSON.stringify(a.info.state) === JSON.stringify(a.info.playing)) ok("the exported state IS S.playing (the mix on screen, not a rebuild)");
  else fail("the exported state differs from S.playing");
  if (/^[\x20-\x7e]+$/.test(a.name)) ok(`filename is pure ASCII: ${a.name}`); else fail(`non-ASCII filename: ${a.name}`);
  if (/^stellate-[a-z0-9-]+-seed\d+(-m\d+)?\.mid$/.test(a.name)) ok("filename carries genre + seed (+measure) and ends .mid");
  else fail(`filename shape: ${a.name}`);
  if (a.name.includes("seed" + SEED)) ok(`filename names the session seed (${SEED})`); else fail(`filename seed: ${a.name}`);
  const shareM = new URLSearchParams(a.info.share.split("?")[1]).get("m") || "1";
  const nameM = (/-m(\d+)\.mid$/.exec(a.name) || [, "1"])[1];
  if (nameM === shareM) ok(`filename measure m${nameM} == the share URL's ?m (one measure law)`); else fail(`filename m${nameM} vs share m=${shareM}`);
  if (/MIDI saved/.test(a.info.status || "")) ok(`status toast: "${a.info.status}"`); else fail(`status after save: ${a.info.status}`);

  // ---- (D) determinism + it tracks the traveler ---------------------------
  const a2 = await grabMidi(page, tmp, "again");
  if (a2.bytes.equals(a.bytes)) ok("clicking again with nothing changed reproduces the file byte-for-byte");
  else fail(`re-export differs (${a.bytes.length} vs ${a2.bytes.length} bytes)`);
  await page.evaluate(() => {                   // walk the traveler to the far waypoint
    const w = window.__S.waypoints[1];
    window.__X.retarget({ x: w.x, y: w.y }, true);
  });
  await page.waitForTimeout(300);
  const b = await grabMidi(page, tmp, "moved");
  if (!b.bytes.equals(a.bytes)) ok("moving to another point on the path exports different music");
  else fail("the MIDI did not change after moving the traveler");
  const bwant = b.info.expect[2] || { count: 0 }, bgot = (parseSMF(b.bytes).notes[2] || { count: 0 });
  if (bgot.count === bwant.count) ok(`after the move the melody lane still matches the engine (${bgot.count} notes)`);
  else fail(`after the move: file ${bgot.count} vs engine ${bwant.count} melody notes`);

  // ---- (E) LIVE: the file is the music you are hearing ---------------------
  await page.evaluate(() => window.__X.goLive());
  await page.waitForFunction(() => window.__S.live && window.__S.barInfo, {}, { timeout: 40000 });
  await page.waitForFunction(() => { try { return window.__X.handle().rms() > 0.0008; } catch (e) { return false; } }, {}, { timeout: 40000 });
  ok("audio is really playing (rms > 0)");
  const panelOpen = () => page.evaluate(() => document.getElementById("panelWrap").classList.contains("open"));
  if (!(await panelOpen())) { await page.click("#cfgChip"); await page.waitForTimeout(250); }
  const c = await grabMidi(page, tmp, "live");
  const csmf = parseSMF(c.bytes);
  if (!csmf.errors.length && Object.values(csmf.notes).reduce((n, l) => n + l.count, 0) > 32) ok("the live export is a valid, non-empty SMF");
  else fail("live export invalid: " + (csmf.errors.join("; ") || "empty"));
  if (JSON.stringify(c.info.state) === JSON.stringify(c.info.playing)) ok("live: the exported state is exactly what the engine is playing");
  else fail("live: exported state != S.playing");
  const cWantUs = Math.round(60000000 / (c.info.expect.bpm || 88));
  const cTempo = csmf.meta.find((m) => m.tempoUs != null);
  if (cTempo && Math.abs(cTempo.tempoUs - cWantUs) <= 1) ok("live: the file's tempo is the tempo you are hearing");
  else fail(`live tempo ${cTempo && cTempo.tempoUs} vs ${cWantUs}`);
  let lanesOk = 0;
  for (const ch of [0, 1, 2, 9]) {
    const want = c.info.expect[ch], got = csmf.notes[ch] || { count: 0, hist: {} };
    if (!want || !want.count) continue;
    if (got.count === want.count && !sameHist(got.hist, want.hist)) lanesOk++;
    else fail(`live ${LANES[ch]}: file ${got.count} vs engine ${want.count}`);
  }
  if (lanesOk >= 3) ok(`live: ${lanesOk} lanes match the engine note-for-note`); else fail(`live: only ${lanesOk} lanes matched`);
  const cShareM = new URLSearchParams(c.info.share.split("?")[1]).get("m") || "1";
  const cNameM = (/-m(\d+)\.mid$/.exec(c.name) || [, "1"])[1];
  if (cNameM === cShareM) ok(`live: filename measure m${cNameM} == the share URL's ?m`); else fail(`live filename m${cNameM} vs share m=${cShareM}`);
  await page.evaluate(() => window.__X.stopLive());
  await page.waitForTimeout(300);

  // ---- housekeeping --------------------------------------------------------
  const gone = await page.evaluate(() => ({
    wav: [...document.querySelectorAll("#panel button")].some((b) => /wav|mp3|video/i.test(b.textContent)),
    prog: !!document.querySelector("#panel .exprog"),
  }));
  if (!gone.wav && !gone.prog) ok("wav / mp3 / video buttons and the export progress bar stay gone");
  else fail(`resurrected UI: ${JSON.stringify(gone)}`);
  const real = errs.filter((e) => !/favicon|goatcounter|gc\/count|ERR_/i.test(e));
  if (!real.length) ok("zero page errors"); else fail("page errors: " + JSON.stringify(real.slice(0, 4)));

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  await browser.close(); srv.close();
  console.log(process.exitCode ? "\nMIDI-EXPORT: FAILED" : `\nMIDI-EXPORT: PASS (${checks} checks)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
