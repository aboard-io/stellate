#!/usr/bin/env node
// test/browser/nukernel-drums.test.js — THE KIT, THE ROOM AND THE REGISTER.
//
//   node test/browser/nukernel-drums.test.js
//
// nukernel-audio.test.js asks whether the page makes a sound out of real
// instruments. This one asks what happens to the sound after that, in the three
// places the mix was measurably wrong:
//
//   (A) THE KIT ARRIVES FROM ONE POINT. Twelve lanes were played at one level,
//       dead centre, into one dry bus, so a tom fill was a mono thump beside
//       the snare. Now every lane has a strip — instruments.js DRUMMIX — and a
//       strip is nodes, so it can be read back off the graph rather than
//       believed.
//   (B) THE DRUMS ARE DRY. There was no ambience anywhere on the page except
//       the section's own reverb chip, which is a musical choice about the
//       whole box, not the room a kit was recorded in. audio/graph.js
//       buildRoomBus is that room; ?dryroom builds the page without it, which
//       is what makes this measurable instead of arguable.
//   (C) A NOTE OUTSIDE ITS INSTRUMENT'S RANGE PLAYS AS A STRETCHED SAMPLE.
//       Measured on the shipped registry before the fix: sludge asked its
//       overdrive guitar for MIDI 12 against a bottom zone root of 40 — a
//       guitar played two and a half octaves down — and ska asked its trumpet
//       for 98. Both played. The witness here is the artifact and nothing else:
//       every AudioBufferSourceNode's playbackRate is captured at start(), and
//       a rate is exactly how far from its own root a zone is being stretched.
//
// WHY A SECOND FILE. nukernel-audio.test.js sweeps 45 genres and takes the
// better part of ten minutes; these three claims need three page loads of two
// composed songs and nothing else. Splitting them keeps this one runnable
// while working on the mixer, which is the only way a gate gets run at all.
//
// WHERE THE HARD READINGS ARE. Two of the four measurements here are taken
// OFFLINE, on an OfflineAudioContext built by the page's own builders — the
// room's impulse response, and one real snare rendered with and without the
// room. That is not a shortcut around "test the artifact": those renders use
// buildRoomBus, buildChannel and playDrum, the same three functions the live
// page and the background bounce use, and they are the only way to get a
// reading that does not move. The live wet-against-dry A/B is taken too and
// PRINTED, with its four measured values in the comment beside it, because it
// swings from 0.927 to 0.984 depending on the genre and where the window lands
// against the loop — evidence, not a bar.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8973;
// The genre under the microscope. Rock is the right subject for a drum gate: a
// power kit playing the widest set of lanes on the page (kick/snare/hat, plus
// the tom fill and the crash the twelve-lane kit added), and a section reverb
// of only 0.1 — so what is being measured wet-against-dry is the DRUM room and
// not the genre's own wash.
const GENRE = "rock";
// ...and the genre that proves the register home, in a second short pass.
// Sludge writes its overdrive guitar at MIDI 12..25 against a bottom zone root
// of 40: the most stretched line in the catalogue, and the one the home exists
// for. Measured statically over all 45 genres, ten chairs move and this is the
// furthest (three octaves).
const HOME_GENRE = "sludge";
const SPEC_SEC = 8;                        // spectrum averaging window per pass

const I = require("../../nukernel/instruments.js");
const REGISTRY = require("../../engine/registry-data.js");

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

// Taps installed before any page script: the analyser on the destination (the
// audio gate's own shape) plus a playbackRate capture on every buffer source.
function taps() {
  window.__rates = [];                    // {rate} at start(), every buffer source
  const AC = window.AudioContext || window.webkitAudioContext;
  window.AudioContext = function (...a) {
    const c = new AC(...a);
    const an = c.createAnalyser(); an.fftSize = 2048;
    const orig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest === c.destination) { try { orig.call(this, an); } catch (e) {} }
      return orig.call(this, dest, ...rest);
    };
    const cbs = c.createBufferSource.bind(c);
    c.createBufferSource = () => {
      const s = cbs();
      const st = s.start.bind(s);
      s.start = (...x) => {
        try { window.__rates.push(s.playbackRate.value); } catch (e) {}
        return st(...x);
      };
      return s;
    };
    window.__spec = () => {
      const n = an.frequencyBinCount, d = new Float32Array(n);
      an.getFloatFrequencyData(d);
      return Array.from(d.slice(0, 512), (db) => Math.pow(10, db / 20));
    };
    window.__rms = () => {
      const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d);
      let s = 0; for (const v of d) s += v * v; return Math.sqrt(s / d.length);
    };
    return c;
  };
}

// linear-magnitude spectral shape correlation — the nukernel-audio (E)
// discipline: two passes of the SAME sound correlate ~0.995, any real treatment
// bends the shape to ~0.94, so 0.98 sits between with margin on both sides
const corr = (a, b) => {
  const ma = a.reduce((x, y) => x + y) / a.length, mb = b.reduce((x, y) => x + y) / b.length;
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] - ma, y = b[i] - mb; n += x * y; da += x * x; db += y * y;
  }
  return n / Math.sqrt(da * db);
};
// share of the energy above 120 Hz. The room bus high-passes at 220 and returns
// early reflections plus a short damped tail, so what it adds lands entirely
// above this line — which makes the direction of the change checkable, not just
// its size.
const above120 = (sp) => {
  const binHz = 44100 / 2 / 1024;
  let hi = 0, tot = 0;
  for (let i = 1; i < sp.length; i++) { const p = sp[i] * sp[i]; tot += p; if (i * binHz >= 120) hi += p; }
  return tot > 0 ? hi / tot : 0;
};

// THE KIT ITSELF, RENDERED TWICE — the strongest form of the room claim, and
// the one the live A/B cannot make. The SAME real snare, fired by the SAME
// playDrum through a channel built by the SAME buildChannel, into an offline
// context: once with a room in the env and once without. Nothing else differs
// and nothing is timing dependent, so the tail after the sample has finished
// IS the room. The per-lane placement is measured the same way, as sound — the
// hat is written right of centre and the low tom left, so if the panners are
// real the rendered channels say so.
//
// RUN ON THE WET PAGE, before the ?dryroom pass navigates: the query flag is
// read once at module scope, so on the dry page buildChannel refuses the room
// for both halves of the A/B and the difference measures 1.00x — which is what
// it did while this was being written, and it looked exactly like a broken room.
async function offlineKit(page) {
  return page.evaluate(async () => {
    const [gm, mx, vx, as] = await Promise.all([
      import("/nukernel/audio/graph.js"), import("/nukernel/audio/mixer.js"),
      import("/nukernel/audio/voices.js"), import("/nukernel/audio/assets.js")]);
    // whichever kit the song just decoded — its buffers are context-free
    // (graph.js's own note: an AudioBuffer belongs to no context), which is
    // what lets a live decode render offline
    const kitName = [...as.drumBufs.keys()].map(k => k.split("|")[0])[0];
    if (!kitName) return { err: "no decoded kit" };
    const SR = 44100, AT = 0.05;
    const render = async (withRoom, lane) => {
      const octx = new OfflineAudioContext(2, SR, SR);
      const master = gm.buildMasterChain(octx);
      const env = { master: master.input, verb: () => master.input, echoIn: master.input,
                    room: withRoom ? gm.buildRoomBus(octx, master.input) : null };
      const chan = mx.buildChannel(octx, { roster: [], fx: [], rev: 0, del: 0,
        verb: "room", lvl: 1, pan: 0, mot: null, auto: [] }, env);
      vx.playDrum(kitName, lane, AT, 1, 9, chan);
      const out = await octx.startRendering();
      const L = out.getChannelData(0), R = out.getChannelData(1);
      const e = (a, from, to) => { let s = 0;
        for (let i = Math.floor(from * SR); i < Math.floor(to * SR) && i < a.length; i++) s += a[i] * a[i];
        return s; };
      return { hit: e(L, AT, AT + 0.05) + e(R, AT, AT + 0.05),
               tail: e(L, AT + 0.25, AT + 0.6) + e(R, AT + 0.25, AT + 0.6),
               left: e(L, AT, AT + 0.6), right: e(R, AT, AT + 0.6) };
    };
    const wetS = await render(true, "s"), dryS = await render(false, "s");
    const hat = await render(true, "h"), tom = await render(true, "l");
    return { kitName, wetS, dryS, hat, tom };
  });
}
// compose a genre, loop its verse, play briefly — enough for the transport to
// compile a timeline and decide its register homes
async function homePass(page, url, genre) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#play", { timeout: 30000 });
  await page.waitForTimeout(1200);
  const slot0 = page.locator(".slot").nth(0);
  if ((await slot0.getAttribute("aria-pressed")) !== "true") await slot0.click();
  await page.selectOption("#composeg", genre);
  await page.click("#compose");
  await page.waitForTimeout(400);
  await page.locator(".box").first().dblclick();
  await page.waitForTimeout(9000);
  const home = await page.evaluate(() => (window.__nuHome ? window.__nuHome() : null));
  const rates = await page.evaluate(() => window.__rates.slice());
  await page.click("#play");
  return { home, rates };
}
// one pass: load, compose GENRE, loop one verse, average the spectrum
async function pass(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#play", { timeout: 30000 });
  await page.waitForTimeout(1200);
  const slot0 = page.locator(".slot").nth(0);
  if ((await slot0.getAttribute("aria-pressed")) !== "true") await slot0.click();
  await page.selectOption("#composeg", GENRE);
  await page.click("#compose");
  await page.waitForTimeout(400);
  // LOOP ONE VERSE, both passes. A composed song opens on a half-length intro
  // at a reduced level and closes on a filtered outro; comparing two passes
  // that happen to sit in different sections measures the arrangement and
  // calls it the room. A verse is the plain case — full kit, no motion chip.
  const roles = await page.locator(".box .role").allTextContents();
  const vi = Math.max(0, roles.findIndex(r => /verse/.test(r)));
  await page.locator(".box").nth(vi).dblclick();               // loops it AND starts it
  await page.waitForTimeout(9000);                             // past the load + first bars
  let acc = null, n = 0, peak = 0;
  for (let i = 0; i < SPEC_SEC * 5; i++) {
    await page.waitForTimeout(200);
    const v = await page.evaluate(() => window.__spec());
    const r = await page.evaluate(() => window.__rms());
    if (r > peak) peak = r;
    acc = acc ? acc.map((x, j) => x + v[j]) : v; n++;
  }
  const mix = await page.evaluate(() => window.__nuMix());
  const rates = await page.evaluate(() => window.__rates.slice());
  const home = await page.evaluate(() => (window.__nuHome ? window.__nuHome() : null));
  const fb = await page.evaluate(() => window.__nuFallback);
  const dropped = await page.evaluate(() => window.__nuDropped);
  await page.click("#play");                                   // stop
  return { spec: acc.map(x => x / n), mix, rates, home, fb, dropped, peak };
}

(async () => {
  // ---- (0) THE TABLES AGREE, before a browser is even started -------------
  // A lane the kernel can write and the mix cannot place is a drum with no
  // level, no pan and no room — silently, at whatever the defaults were. The
  // sound-source map is the reference (instruments.js DRUMFILE, itself held
  // against kernel.js LANES by the unit gate), so this closes the chain.
  {
    const lanes = Object.keys(I.DRUMFILE);
    const missing = lanes.filter(d => !I.DRUMMIX[d]);
    const extra = Object.keys(I.DRUMMIX).filter(d => !I.DRUMFILE[d]);
    if (missing.length) fail(`DRUMMIX has no strip for lane(s) ${missing.join(",")} — ` +
      `they play at the default level, dead centre, with no room`);
    else if (extra.length) fail(`DRUMMIX places lane(s) ${extra.join(",")} that no kit file names`);
    else ok(`every one of the ${lanes.length} kit lanes has a mix entry`);
    const flat = lanes.every(d => I.DRUMMIX[d].pan === I.DRUMMIX[lanes[0]].pan);
    if (flat) fail("every lane has the same pan — the kit is a point source again");
    else ok(`the kit is spread: hats ${I.DRUMMIX.h.pan}, ride ${I.DRUMMIX.r.pan}, ` +
            `toms ${I.DRUMMIX.t.pan}/${I.DRUMMIX.m.pan}/${I.DRUMMIX.l.pan}, kick ${I.DRUMMIX.k.pan}`);
    // and the range table names instruments that exist
    const bad = Object.keys(I.RANGES).filter(id => !REGISTRY.SAMPLERS[id]);
    if (bad.length) fail(`RANGES names ${bad.join(",")}, which no sampler in the registry has`);
    else ok(`all ${Object.keys(I.RANGES).length} instrument ranges name a real sampler`);
    const narrow = Object.entries(I.RANGES).filter(([, r]) => r[1] - r[0] < 12);
    if (narrow.length) fail(`range(s) narrower than an octave: ${narrow.map(x => x[0]).join(",")} — ` +
      `a fold into one would start refusing notes that are in key`);
    else ok("every range is at least an octave wide");
  }

  const srv = await serve(ROOT, PORT); PORT = srv.port;
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = capturePageErrors(page);
  await page.addInitScript(taps);
  // ?nobounce ON BOTH PASSES. The background bounce renders the whole song
  // into an OfflineAudioContext while the graph plays, and an offline render
  // competing for the machine is CPU the live spectrum feels — the two passes
  // have to differ by the room and by nothing else. (It also stops a
  // half-finished render from holding the next navigation, which is what timed
  // this measurement out while it was being written.)
  const base = `http://localhost:${PORT}/nukernel/kernel-daw.html?nobounce`;

  const wet = await pass(page, base);
  const kit = await offlineKit(page);       // on the WET page — see offlineKit
  const dry = await pass(page, base + "&dryroom");

  // ---- (A) THE LANE STRIPS ARE NODES --------------------------------------
  {
    const chans = wet.mix.channels.filter(c => c.drums && c.drums.length);
    if (!chans.length) fail("no channel reports a single drum lane — __nuMix cannot see the kit");
    else {
      const all = new Map();
      for (const c of chans) for (const d of c.drums) all.set(d.lane, d);
      const lanes = [...all.keys()].sort().join("");
      if (all.size < 3) fail(`only ${all.size} lane(s) sounded (${lanes}) — too few to prove a kit`);
      else ok(`${all.size} lanes built a strip and sounded: ${lanes}`);
      // the numbers on the nodes ARE the table's, per lane
      const wrong = [...all.values()].filter(d =>
        Math.abs(d.level - I.DRUMMIX[d.lane].lvl) > 1e-3 ||
        Math.abs(d.pan - I.DRUMMIX[d.lane].pan) > 1e-3);
      if (wrong.length) fail(`lane strip(s) ${wrong.map(d => d.lane).join(",")} carry values the ` +
        `table does not declare (e.g. ${JSON.stringify(wrong[0])}) — the mix was built from ` +
        `something other than DRUMMIX`);
      else ok(`every lane's gain and panner carry its DRUMMIX numbers ` +
              `(${[...all.values()].map(d => d.lane + "@" + d.pan).join(" ")})`);
      const pans = new Set([...all.values()].map(d => d.pan));
      if (pans.size < 2) fail(`every sounding lane is at pan ${[...pans][0]} — the kit is mono again`);
      else ok(`the sounding lanes occupy ${pans.size} different places in the field`);
    }
  }

  // ---- (B) THE DRUM ROOM ---------------------------------------------------
  {
    if (!wet.mix.room) fail("__nuMix.room is false — the drum room bus was never built");
    else ok("the drum room bus exists");
    const sends = wet.mix.channels.filter(c => c.drums && c.drums.length).map(c => c.droom);
    if (sends.some(x => !(x > 0)))
      fail(`a channel with drums has no room send (${JSON.stringify(sends)})`);
    else ok(`every drum-carrying channel sends to the room (${sends.join(", ")})`);
    // per-lane wetness is the RATIO that makes it a room rather than a wash:
    // a kick barely goes, a snare goes plenty
    const l = new Map();
    for (const c of wet.mix.channels) for (const d of (c.drums || [])) l.set(d.lane, d.room);
    if (l.has("k") && l.has("s") && !(l.get("s") > l.get("k") * 2))
      fail(`the snare (${l.get("s")}) is not meaningfully wetter than the kick (${l.get("k")}) — ` +
           `a kit sent to a room at one level is a wash, not a room`);
    else ok(`the room is a ratio: kick ${l.get("k")}, snare ${l.get("s")}, hat ${l.get("h")}`);
    if (dry.mix.channels.some(c => c.droom))
      fail("?dryroom still built a room send — the two passes are not comparable");
    else ok("?dryroom builds the same song with no room send at all");

    // THE LIVE A/B IS EVIDENCE, NOT A GATE. Same music, same box, same loop,
    // the only difference being the room — and the shape correlation measured
    // 0.927, 0.943, 0.962 on boom bap and 0.984 on rock across four pairs of
    // passes on this machine. The spread is not noise in the measurement, it is
    // the mix: a genre whose kit carries the record moves a long way, a wall of
    // distorted guitar swamps it, and the master glue compressor trades back
    // whatever level the room adds. "Above 120 Hz", the obvious directional
    // claim (the room high-passes at 220, so it can only add up there), came
    // out 1.31x on one pair and 0.95x on the next for the same reason. Neither
    // number is stable enough to fail a build on, and both are worth seeing —
    // so they are printed, and the two claims that ARE asserted below are made
    // where nothing can drift: offline, on the room's own output.
    const r = corr(wet.spec, dry.spec);
    const aw = above120(wet.spec), ad = above120(dry.spec);
    console.log(`  live A/B (evidence)   : shape corr ${r.toFixed(4)}, ` +
                `above-120 Hz ${ad.toFixed(4)} dry -> ${aw.toFixed(4)} wet ` +
                `(peaks ${dry.peak.toFixed(3)} / ${wet.peak.toFixed(3)})`);

    // ...AND IT IS A SHORT STEREO ROOM. Render the room's own impulse response
    // offline, through the SAME builder the page and the bounce use: one
    // sample in, and what comes back is the room, in full, with nothing else
    // in it. Deterministic — no music, no compressor, no loop phase.
    const ir = await page.evaluate(async () => {
      const mod = await import("/nukernel/audio/graph.js");
      const SR = 44100;
      const octx = new OfflineAudioContext(2, SR, SR);          // 1 second
      const room = mod.buildRoomBus(octx, octx.destination);
      const b = octx.createBuffer(1, 2, SR);
      b.getChannelData(0)[0] = 1;                                // the click
      const s = octx.createBufferSource(); s.buffer = b;
      s.connect(room); s.start(0);
      const out = await octx.startRendering();
      const L = out.getChannelData(0), R = out.getChannelData(1);
      // energy per 10 ms window, summed across the pair
      const win = SR / 100, e = [];
      for (let w = 0; w * win < L.length; w++) {
        let s2 = 0;
        for (let i = w * win; i < (w + 1) * win && i < L.length; i++) s2 += L[i] * L[i] + R[i] * R[i];
        e.push(s2);
      }
      const peak = Math.max(...e);
      let last = 0;
      for (let i = 0; i < e.length; i++) if (e[i] > peak * 1e-3) last = i;   // -30 dB
      let diff = 0, tot = 0;
      for (let i = 0; i < L.length; i++) { diff += (L[i] - R[i]) * (L[i] - R[i]); tot += L[i] * L[i] + R[i] * R[i]; }
      let early = 0;
      for (let i = 3; i < 12 && i < e.length; i++) early += e[i];            // 30..120 ms
      return { rt30ms: last * 10, sides: tot > 0 ? diff / tot : 0,
               early: peak > 0 ? early / peak : 0 };
    });
    console.log(`  room impulse          : -30 dB at ${ir.rt30ms} ms, ` +
                `reflections 30-120 ms ${ir.early.toFixed(2)}x peak, ` +
                `L-R difference ${ir.sides.toFixed(3)}`);
    if (ir.rt30ms >= 120 && ir.rt30ms <= 700)
      ok(`the room is a SHORT room: -30 dB at ${ir.rt30ms} ms`);
    else fail(`the drum room decays to -30 dB at ${ir.rt30ms} ms — a kit ambience is ` +
              `a couple of hundred milliseconds, not a hall and not a click`);
    if (ir.early > 0.02)
      ok(`it has real reflections after the first 30 ms (${ir.early.toFixed(2)}x the peak window)`);
    else fail(`nothing comes back between 30 and 120 ms (${ir.early.toFixed(3)}x peak) — ` +
              `that is a delay, not a room`);
    if (ir.sides > 0.05) ok(`and it is stereo: L-R difference ${ir.sides.toFixed(3)} of the energy`);
    else fail(`the room returns the same signal to both channels (L-R ${ir.sides.toFixed(3)}) — ` +
              `a mono ambience puts the whole kit back on one point`);

    // ---- THE KIT ITSELF, RENDERED TWICE (offlineKit, above) ----------------
    if (kit.err) fail(`the offline kit render could not run: ${kit.err}`);
    else {
      const tailRatio = kit.wetS.tail / Math.max(1e-12, kit.dryS.tail);
      console.log(`  offline kit (${kit.kitName})`.padEnd(24) + `: snare tail 250-600 ms ` +
                  `dry ${kit.dryS.tail.toExponential(2)} -> wet ${kit.wetS.tail.toExponential(2)} ` +
                  `(${tailRatio.toFixed(1)}x), hit window ${(kit.wetS.hit / kit.dryS.hit).toFixed(2)}x`);
      if (tailRatio > 3)
        ok(`the room is audible on the kit itself: ${tailRatio.toFixed(1)}x the energy a quarter ` +
           `of a second after the snare, from the same sample through the same channel`);
      else fail(`with the room the snare's 250-600 ms tail carries ${tailRatio.toFixed(2)}x the ` +
                `energy it does without — that is not a room, that is a rounding difference`);
      // and the placement is in the rendered channels, not only in the params
      const bal = (x) => (x.right - x.left) / (x.right + x.left);
      console.log(`  lane placement        : hat R-L ${bal(kit.hat).toFixed(3)}, ` +
                  `low tom R-L ${bal(kit.tom).toFixed(3)}`);
      if (bal(kit.hat) > 0.05 && bal(kit.tom) < -0.05)
        ok(`the lanes render where the table places them: the hat is right of centre ` +
           `(${bal(kit.hat).toFixed(3)}) and the low tom left (${bal(kit.tom).toFixed(3)})`);
      else fail(`the hat rendered at R-L ${bal(kit.hat).toFixed(3)} and the low tom at ` +
                `${bal(kit.tom).toFixed(3)} — the lane panners are not reaching the output`);
    }
  }

  // ---- (C) THE REGISTER LAW ------------------------------------------------
  {
    // THE ARTIFACT, not the intention: a buffer source's playbackRate is
    // exactly how far its zone is being stretched (2^(st/12)), and the law says
    // no pitched note may be stretched further than the parent's own limits
    // (instruments.js STRETCH_UP/STRETCH_DOWN) plus the soft edge the per-note
    // fold tolerates. Drums fire at rate 1 and drop out of this by construction.
    const LIM_UP = I.STRETCH_UP + 6, LIM_DOWN = I.STRETCH_DOWN + 6;
    const st = (x) => 12 * Math.log2(x);
    const pitched = wet.rates.filter(x => Math.abs(x - 1) > 1e-6);
    if (pitched.length < 20) fail(`only ${pitched.length} pitched sample(s) played — ` +
      `not enough to say anything about their register`);
    else {
      const hi = Math.max(...pitched.map(st)), lo = Math.min(...pitched.map(st));
      const over = pitched.filter(x => st(x) > LIM_UP || st(x) < -LIM_DOWN);
      console.log(`  zone stretch          : ${pitched.length} pitched notes, ` +
                  `${lo.toFixed(1)}st .. +${hi.toFixed(1)}st from their own roots`);
      if (over.length) fail(`${over.length} note(s) played a zone stretched beyond ` +
        `[-${LIM_DOWN}, +${LIM_UP}] semitones (worst ${st(over.reduce((a, b) =>
          Math.abs(st(a)) > Math.abs(st(b)) ? a : b)).toFixed(1)}st) — that is not the ` +
        `instrument any more, and the register law is supposed to fold or drop it`);
      else ok(`no zone is stretched past the honest window ` +
              `(${lo.toFixed(1)}..+${hi.toFixed(1)} st, limit -${LIM_DOWN}..+${LIM_UP})`);
    }
    if (wet.home == null) fail("window.__nuHome is missing — the register home cannot be checked");
    else {
      console.log(`  register home         : ${JSON.stringify(wet.home)}`);
      const bad = wet.home.filter(h => Math.abs(h.oct) > 3);
      if (bad.length) fail(`a chair was moved ${bad[0].oct} octaves — the home is supposed to be ` +
        `the smallest move that fits, not a transposition`);
      else ok(`the register home moved ${wet.home.length} chair(s), none more than 3 octaves`);
    }
    // ...AND IT FIRES WHERE IT MUST. A home that never moves anything passes
    // every check above by doing nothing, so one genre is named: sludge's
    // guitar, the most stretched line on the page.
    const hp = await homePass(page, base, HOME_GENRE);
    console.log(`  ${HOME_GENRE} home${" ".repeat(Math.max(1, 16 - HOME_GENRE.length))}: ` +
                `${JSON.stringify(hp.home)}`);
    const up = (hp.home || []).filter(h => h.chair.startsWith(HOME_GENRE + "|") && h.oct > 0);
    if (!up.length)
      fail(`${HOME_GENRE} moved no chair up — its guitar is written two and a half octaves ` +
           `below its lowest zone root, so either the home stopped working or the genre changed`);
    else ok(`${HOME_GENRE} lifted ${up.length} chair(s) out of the mud ` +
            `(${up.map(h => h.chair + " +" + h.oct).join(", ")})`);
    const hpitched = hp.rates.filter(x => Math.abs(x - 1) > 1e-6).map(st);
    if (hpitched.length) {
      const lo2 = Math.min(...hpitched);
      if (lo2 < -LIM_DOWN)
        fail(`${HOME_GENRE} still plays a zone ${lo2.toFixed(1)} semitones down — the home ran ` +
             `but the note reached the sampler unfolded`);
      else ok(`${HOME_GENRE}'s lowest zone stretch is ${lo2.toFixed(1)} st (was −28 before the law)`);
    }
    // and the law's failure mode is SILENCE, COUNTED — never a beep
    if (wet.fb) fail(`${wet.fb} fallback voice(s) fired — a note the register law could not ` +
      `place came out of the oscillator instead of being dropped`);
    else ok("no fallback voice fired");
    console.log(`  notes dropped         : ${wet.dropped}`);
    if (wet.dropped > 40) fail(`${wet.dropped} notes were dropped in one pass — the drop law is ` +
      `silencing music rather than catching the unplayable`);
    else ok(`drops stayed rare (${wet.dropped})`);
  }

  // ---- (D) NOTHING ELSE MOVED ---------------------------------------------
  {
    // the shape the OTHER gate reads. Both files walk the same __nuMix; keeping
    // the old keys is a contract, and adding to them is the only allowed change.
    const c = wet.mix.channels[0];
    const need = ["fx", "stages", "motion", "rev", "del", "level", "pan", "verb", "key", "auto"];
    const gone = need.filter(k => !(k in c));
    if (gone.length) fail(`__nuMix channels lost key(s) ${gone.join(",")} — ` +
      `nukernel-audio.test.js reads every one of them`);
    else ok("__nuMix still carries the keys the audio gate reads");
    if (wet.peak < 0.01) fail(`the song is silent (peak RMS ${wet.peak.toFixed(4)})`);
    else ok(`the song plays with the treatment on: peak RMS ${wet.peak.toFixed(4)}`);
    if (errs.length) fail(`page errors: ${errs.slice(0, 3).join(" | ")}`);
    else ok("no page errors");
  }

  await browser.close(); await srv.close();
  console.log(`\nnukernel-drums: ${checks} checks` +
              (process.exitCode ? " — FAILURES ABOVE" : " pass"));
})().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
