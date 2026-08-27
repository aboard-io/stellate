#!/usr/bin/env node
// test/deck.test.js — THE SCORE DECK GATE (2026-08-27).
//
// The engraved score moved to the foot of the page (nukernel/ideal/
// score-deck.html; FUTURE.md Phase 3) and gained motif brackets, a vertical
// piano roll and an export row. Every assertion here reads the RENDERED page
// or the exported BYTES (TEST THE ARTIFACT), never the wiring:
//
// D1  every motif bracket's text is a member of the record's own
//     material.cells keys — extracted, zero typed strings — and there is at
//     least one bracket on the staff.
// D2  one clock, two views: flipping notation → piano roll → notation while
//     the record plays never loses the place (the step keeps advancing and
//     never resets), and the deck's DOM mutates ONLY inside [data-live]
//     while the record runs (the tabs and export buttons are still).
// D3  the WAV press is real: two presses of the same record are BYTE-EQUAL
//     (sha256 over the whole file), the bytes decode as canonical
//     44.1k/16-bit stereo PCM with nonzero RMS, and the duration matches the
//     score's own length.
// D4  the MIDI export parses back with OUR OWN reader: one track per voice
//     plus the conductor, and every note's tick position equals the score
//     fold's `at` in ticks. The tom lanes come out DISTINCT (t/m/l →
//     GM 50/47/45) — proved in node over export/smf.js with a synthetic
//     score, because the shipped chant has no toms to disagree about.
// D5  the export row is honest: four cards, each button either live or
//     `disabled` beside a non-empty reason (.nu-why) — nothing greys
//     silently, nothing pretends.
// D6  no page errors; no horizontal overflow at 390 or 1280; screenshots to
//     the wave directory.
//
// Run:  NODE_PATH=/home/ford/ftrain-2025/node_modules node test/deck.test.js

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const URL_ = process.env.MOTIF_URL || "http://localhost:8777/nukernel/index.html";
const SHOTS = process.env.DECK_SHOTS || "/home/ford/.claude/jobs/c1b341cb/tmp/wave4";

const CANDIDATES = [
  "chromium-1234/chrome-linux64/chrome",
  "chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell",
  "chromium-1217/chrome-linux64/chrome",
];
function executable() {
  const root = path.join(process.env.HOME, ".cache/ms-playwright");
  for (const c of CANDIDATES) {
    const p = path.join(root, c);
    if (fs.existsSync(p)) return p;
  }
  throw new Error("no installed chromium under " + root);
}

let FAILS = 0;
const ok = (m) => console.log("  ok   " + m);
const fail = (m) => { FAILS++; console.log("  FAIL " + m); };
const is = (cond, m) => (cond ? ok(m) : fail(m));

(async () => {
  // ---- D4a (node): the tom fix lives in the export layer, proved on bytes --
  const smf = await import(pathToFileURL(path.join(__dirname, "..",
    "nukernel", "export", "smf.js")).href);
  {
    const SCOREHEAD = { k: "F", s: "c", p: "c", c: "c", t: "e", m: "d", l: "A",
                        h: "!style=x!g", o: "!style=x!g", f: "!style=x!D",
                        r: "!style=x!f", x: "!style=x!a" };   // ui/eight.js's table
    const dm = smf.headGM(SCOREHEAD);
    is(dm.e === 50 && dm.d === 47 && dm.A === 45,
      "D4a toms map DISTINCT in the export layer (e/d/A → " +
      [dm.e, dm.d, dm.A].join("/") + ", the engine's own fold says 47/47/47)");
    const bytes = smf.writeSmf({ bpm: 120, beatsPerBar: 4, stepsPerBar: 16,
      voices: [{ name: "kit", clef: "perc", notes: [
        { at: 0, len: 1, midi: "e" }, { at: 4, len: 1, midi: "d" },
        { at: 8, len: 1, midi: "A" }] }] }, { drumMap: dm });
    const p = smf.parseSmf(bytes);
    const keys = p.tracks[1].notes.map((n) => n.key);
    is(JSON.stringify(keys) === JSON.stringify([50, 47, 45]) &&
       p.tracks[1].notes.every((n) => n.ch === 9),
      "D4a parse-back: three toms are three GM keys on channel 10 (" +
      keys.join(",") + ")");
  }

  const { chromium } = require("playwright");
  const browser = await chromium.launch({ executablePath: executable() });
  const errors = [];
  const page = await (await browser.newContext({
    viewport: { width: 1280, height: 900 } })).newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto(URL_, { waitUntil: "load", timeout: 60000 });
  await page.waitForFunction(() => window.__deckState && window.__eightScore &&
    window.__eightScore().steps > 0, null, { timeout: 30000 });
  await page.waitForTimeout(1000);

  // ---- D1 — the brackets are extraction, not typing ------------------------
  const d1 = await page.evaluate(() => window.__deckState());
  is(d1.brackets.length > 0, "D1 · the staff carries motif brackets (" +
    d1.brackets.length + ")");
  const alien = d1.brackets.filter((t) => !d1.cells.includes(t));
  is(alien.length === 0, "D1 · every bracket text IS a material.cells key (" +
    d1.brackets.join(", ") + " ⊆ " + d1.cells.join(", ") + ")" +
    (alien.length ? " — alien: " + alien.join(", ") : ""));

  // ---- D5 — the export row wears true states -------------------------------
  const exps = d1.exports;
  is(exps.length === 4, "D5 · four export cards (" + exps.length + ")");
  for (const e of exps) {
    const honest = e.label && (!e.disabled || (e.why && e.why.length > 20));
    is(honest, "D5 · " + (e.k || "?") + " " +
      (e.disabled ? "refused with its reason: \"" + (e.why || "").slice(0, 60) + "…\""
                  : "live (\"" + e.label + "\")"));
  }
  is(!exps.find((e) => e.k === "deck.exp.wav").disabled &&
     !exps.find((e) => e.k === "deck.exp.mid").disabled,
    "D5 · WAV and MIDI are LIVE buttons");
  is(exps.find((e) => e.k === "deck.exp.mp3").disabled &&
     exps.find((e) => e.k === "deck.exp.als").disabled,
    "D5 · MP3 and Ableton are refusals, not dead controls");

  // ---- D6 — geometry + shots ----------------------------------------------
  fs.mkdirSync(SHOTS, { recursive: true });
  const over1280 = await page.evaluate(() =>
    document.scrollingElement.scrollWidth - window.innerWidth);
  is(over1280 <= 1, "D6 · no horizontal overflow at 1280 (" + over1280 + "px)");
  await page.locator("#scoredeck").screenshot({
    path: path.join(SHOTS, "deck-notation-1280.png") });
  await page.evaluate(() => window.__deckView("roll"));
  await page.waitForTimeout(300);
  await page.locator("#scoredeck").screenshot({
    path: path.join(SHOTS, "deck-roll-1280.png") });
  await page.evaluate(() => window.__deckView("not"));

  // ---- D2 — one clock, two views, and only [data-live] moves ---------------
  await page.click("#play");
  const started = await page.waitForFunction(() =>
    document.getElementById("play").textContent === "stop" &&
    window.__eightScore().step > 0.5, null, { timeout: 45000 })
    .then(() => true).catch(() => false);
  is(started, "D2 · the record started (the deck's clock is running)");
  if (started) {
    const s1 = await page.evaluate(() => window.__eightScore().step);
    await page.evaluate(() => window.__deckView("roll"));
    await page.waitForTimeout(700);
    const s2 = await page.evaluate(() => ({ step: window.__eightScore().step,
      view: window.__deckState().view }));
    await page.evaluate(() => window.__deckView("not"));
    await page.waitForTimeout(700);
    const s3 = await page.evaluate(() => ({ step: window.__eightScore().step,
      view: window.__deckState().view }));
    is(s2.view === "roll" && s3.view === "not",
      "D2 · the tab actually flips (roll → notation)");
    is(s2.step > s1 && s3.step > s2.step,
      "D2 · the clock never lost the place across two flips (" +
      s1.toFixed(1) + " → " + s2.step.toFixed(1) + " → " + s3.step.toFixed(1) + ")");
    // the frozen half of the DECK: with the roll up, watch every mutation for
    // 2.5s of playback — each must land inside a [data-live] subtree
    await page.evaluate(() => window.__deckView("roll"));
    const stray = await page.evaluate(async () => {
      const root = document.getElementById("scoredeck");
      const bad = [];
      const inLive = (n) => {
        for (let e = n; e && e !== root; e = e.parentNode)
          if (e.dataset && e.dataset.live != null) return true;
        return false;
      };
      const mo = new MutationObserver((muts) => {
        for (const m of muts) if (!inLive(m.target))
          bad.push(m.type + ":" + (m.target.className || m.target.nodeName));
      });
      mo.observe(root, { subtree: true, childList: true, attributes: true,
                         characterData: true });
      await new Promise((r) => setTimeout(r, 2500));
      mo.disconnect();
      return bad.slice(0, 5);
    });
    is(stray.length === 0, "D2 · playback mutates the deck ONLY inside " +
      "[data-live] (" + (stray.length ? stray.join(", ") : "0 strays") + ")");
    await page.screenshot({ path: path.join(SHOTS, "deck-roll-playing-1280.png"),
      clip: await page.locator("#scoredeck").boundingBox() });
    await page.evaluate(() => window.__deckView("not"));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, "deck-notation-playing-1280.png"),
      clip: await page.locator("#scoredeck").boundingBox() });
  }
  await page.click("#play");   // stop — the presses below get the whole CPU
  await page.waitForTimeout(800);

  // ---- D4b — the .mid, parsed back against the page's own score fold -------
  const d4 = await page.evaluate(() => {
    const r = window.__deckSmf();
    if (!r) return null;
    const bpb = r.parsed.tracks[0].timesig ? r.parsed.tracks[0].timesig[0] : 4;
    const tps = (r.parsed.division * bpb) / 16;     // ticks per score step
    const want = [], got = [];
    r.score.forEach((v, i) => {
      const perc = /^perc/.test(v.clef || "");
      for (const n of v.notes)
        for (const m of n.midi) {
          const key = typeof m === "number" ? Math.max(0, Math.min(127, m | 0))
            : (perc && r.drumMap[m] != null ? r.drumMap[m] : null);
          if (key != null) want.push((i + 1) + "@" + Math.round(n.at * tps) + ":" + key);
        }
      for (const n of r.parsed.tracks[i + 1].notes)
        got.push((i + 1) + "@" + n.tick + ":" + n.key);
    });
    want.sort(); got.sort();
    let firstDiff = null;
    for (let i = 0; i < Math.max(want.length, got.length); i++)
      if (want[i] !== got[i]) { firstDiff = (want[i] || "∅") + " vs " + (got[i] || "∅"); break; }
    return { n: r.parsed.tracks.length, nv: r.score.length,
             want: want.length, got: got.length, firstDiff,
             tempo: r.parsed.tracks[0].tempo, bytes: r.bytes.length };
  });
  is(!!d4, "D4b · the page folded its score to a .mid (" + (d4 ? d4.bytes : 0) + " bytes)");
  if (d4) {
    is(d4.n === d4.nv + 1, "D4b · SMF type 1, one track per voice + conductor (" +
      d4.n + " tracks for " + d4.nv + " voices)");
    is(d4.want === d4.got && !d4.firstDiff,
      "D4b · parse-back equality: " + d4.got + " notes, every tick position equal " +
      "to the score's own fold" + (d4.firstDiff ? " — first diff " + d4.firstDiff : ""));
    is(d4.tempo != null, "D4b · the conductor track carries the record's tempo");
  }

  // ---- D3 — the WAV press: bytes, duration, determinism --------------------
  console.log("     pressing the record twice (this renders the whole song, offline)…");
  const w1 = await page.evaluate(() => window.__deckPressWav()
    .catch((e) => ({ err: String((e && e.message) || e) })));
  const w2 = await page.evaluate(() => window.__deckPressWav()
    .catch((e) => ({ err: String((e && e.message) || e) })));
  is(!w1.err && !w2.err, "D3 · both presses completed" +
    (w1.err || w2.err ? " — " + (w1.err || w2.err) : ""));
  if (!w1.err && !w2.err) {
    is(w1.head.riff === "RIFF" && w1.head.wave === "WAVE" && w1.head.fmt === 1 &&
       w1.head.ch === 2 && w1.head.sr === 44100 && w1.head.bits === 16,
      "D3 · the bytes decode: canonical 44.1 kHz / 16-bit / stereo PCM");
    is(w1.rms > 0.01, "D3 · the render is not silence (RMS " + w1.rms + ")");
    is(Math.abs(w1.durSec - w1.songSec) < 0.1,
      "D3 · duration matches the score (" + w1.durSec + "s vs " +
      w1.songSec + "s of score)");
    is(w1.sha === w2.sha, "D3 · BYTE-DETERMINISTIC across two presses (sha " +
      w1.sha.slice(0, 16) + "…)");
  }

  is(errors.length === 0, "  · no page errors (" + errors.slice(0, 3).join(" | ") + ")");
  await page.close();

  // ---- 390: the deck exists on a phone and nothing scrolls sideways --------
  const p390 = await (await browser.newContext({
    viewport: { width: 390, height: 844 } })).newPage();
  p390.on("pageerror", (e) => errors.push("390: " + String(e).slice(0, 160)));
  await p390.goto(URL_, { waitUntil: "load", timeout: 60000 });
  await p390.waitForFunction(() => window.__deckState, null, { timeout: 30000 });
  await p390.waitForTimeout(1200);
  const m = await p390.evaluate(() => ({
    over: document.scrollingElement.scrollWidth - window.innerWidth,
    brackets: window.__deckState().brackets.length,
  }));
  is(m.over <= 1, "D6 390 · no horizontal overflow (" + m.over + "px)");
  is(m.brackets > 0, "D6 390 · the brackets survive the phone (" + m.brackets + ")");
  await p390.locator("#scoredeck").screenshot({
    path: path.join(SHOTS, "deck-notation-390.png") });
  await p390.evaluate(() => window.__deckView("roll"));
  await p390.waitForTimeout(300);
  await p390.locator("#scoredeck").screenshot({
    path: path.join(SHOTS, "deck-roll-390.png") });
  await p390.close();

  await browser.close();
  console.log(FAILS ? "\n" + FAILS + " failed" : "\nall checks pass");
  process.exit(FAILS ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
