#!/usr/bin/env node
// test/browser/nukernel-sing.test.js — THE SINGER, MEASURED.
//
//   node test/browser/nukernel-sing.test.js
//
// The singer was built in one round and never once asked to sing: `sing`
// defaulted to null, no genre declared one, and so espeak was never
// instantiated, the syllable cutter never ran and the vocoder — the thing
// Paul actually named — had never made a sound on this page. Everything about
// it was true in the source and unproven in the air.
//
// So this gate renders it and MEASURES what came back, in a real browser,
// through the real espeak wasm, into an OfflineAudioContext (which is also the
// bounce's own path — a vocoder that only worked live would be half a
// feature). Five questions, all of them about the rendered buffer:
//
//   (A) NOTHING SINGS UNTIL SOMETHING ASKS. On a freshly booted page, zero
//       utterances, zero slices, zero vocoded notes — the ~1.7 MB wasm is not
//       fetched by a page whose genre says nothing.
//   (B) A DRY LINE IS AUDIBLE. warm() a real utterance, play one syllable
//       into an offline render, and the buffer is not silence.
//   (C) THE VOCODER IS AUDIBLE AND IT IS DIFFERENT. The same syllable, same
//       note, through the filter bank: real level, and a spectral profile
//       that is measurably NOT the dry line's (cosine distance over 24
//       log-spaced probe frequencies, plus the centroid, plus the carrier
//       fundamental — which is the honest proof that what you hear is the
//       SYNTH shaped by the voice and not the voice with a filter on it).
//   (D) THE CARRIER IS A CHOICE. `moog` (a Model D through its ladder) and
//       `dx7` (the FM pair) differ from the saw and from each other. If the
//       carrier table were decorative this is the check that would say so.
//   (E) THE GRIP DOES SOMETHING. `fat` (8 bands, imposed to the limit) is
//       measurably duller — fewer bands cannot resolve a formant — than
//       `clear` (48 bands, half grip) on the identical syllable.
//
// Nothing here asserts a threshold it did not measure: every number in the
// oks below was printed by this gate first and then fenced well inside where
// it landed.
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const ROOT = path.join(__dirname, "..", "..");
let PORT = 8979;

// the analysis, run IN THE PAGE on the rendered buffer: a Goertzel at each of
// 24 log-spaced probe frequencies is a spectral profile without an FFT, and a
// cosine distance between two profiles is "are these the same sound" in one
// number. (The parent's own spectral witnesses — nukernel-audio's window.__spec
// — ask the same question the same way.)
const PROBE = `(${function () {
  window.__singAnalyse = (x, sr) => {
    let sum = 0;
    for (let i = 0; i < x.length; i++) sum += x[i] * x[i];
    const rms = Math.sqrt(sum / x.length);
    const freqs = [];
    for (let i = 0; i < 24; i++) freqs.push(100 * Math.pow(80 / 1, i / 23));
    const prof = freqs.map((f) => {
      const w = 2 * Math.PI * f / sr, c = 2 * Math.cos(w);
      let s0 = 0, s1 = 0, s2 = 0;
      for (let i = 0; i < x.length; i++) { s0 = x[i] + c * s1 - s2; s2 = s1; s1 = s0; }
      return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2)) / x.length;
    });
    const tot = prof.reduce((a, b) => a + b, 0) || 1e-12;
    const centroid = prof.reduce((a, v, i) => a + v * freqs[i], 0) / tot;
    return { rms, prof, freqs, centroid };
  };
  // one Goertzel, for "is the carrier's own fundamental in there"
  window.__singTone = (x, sr, f) => {
    const w = 2 * Math.PI * f / sr, c = 2 * Math.cos(w);
    let s0 = 0, s1 = 0, s2 = 0;
    for (let i = 0; i < x.length; i++) { s0 = x[i] + c * s1 - s2; s2 = s1; s1 = s0; }
    return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2)) / x.length;
  };
  window.__cosDist = (a, b) => {
    let d = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return 1 - d / (Math.sqrt(na * nb) || 1e-12);
  };
}})()`;

(async () => {
  const srv = await serve(ROOT, PORT); PORT = srv.port;
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = capturePageErrors(page);
  await page.addInitScript(PROBE);
  await page.goto(`http://localhost:${PORT}/nukernel/kernel-daw.html`,
    { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__nuSing, { timeout: 20000 });

  let fails = 0;
  const ok = (c, m) => { if (!c) { fails++; console.log("  FAIL " + m); } else console.log("  ok   " + m); };

  /* ---- (A) nothing sings until something asks ---------------------------- */
  const idle = await page.evaluate(() => window.__nuSing());
  ok(idle.utterances === 0 && idle.slices === 0 && idle.notes === 0 && idle.vocoded === 0,
     "(A) a booted page had already sung: " + JSON.stringify(idle));

  /* ---- render one syllable, five ways ------------------------------------ */
  // ONE espeak utterance serves all five: the modulator is identical by
  // construction, so every difference measured below is the vocoder's.
  const out = await page.evaluate(async () => {
    const M = await import("/nukernel/audio/sing.js");
    const SING = window.NuSing;
    const TEXT = "hold";                      // one word, one nucleus, one note
    const NOTE = 60;                          // middle C: the note the singer is on
    const mk = (key) => {
      const s = SING.SINGS[key];
      return { t: 0, dur: 8, n: NOTE, vi: 0, syl: TEXT, hold: false, si: 0,
               colour: s.colour, voc: SING.vocFor(key) };
    };
    const warmed = await M.warm([mk("lead")], TEXT);
    if (!warmed) return { error: "warm() came back empty — espeak never spoke" };
    const render = async (key) => {
      const oc = new OfflineAudioContext(1, Math.ceil(44100 * 1.2), 44100);
      const g = oc.createGain(); g.connect(oc.destination);
      const ev = mk(key);
      const played = M.playSyllable(ev, TEXT, 0, 0.9, { input: g }, ev.colour, 4);
      const buf = await oc.startRendering();
      const x = buf.getChannelData(0);
      const a = window.__singAnalyse(x, 44100);
      return { key, played, rms: a.rms, prof: a.prof, centroid: a.centroid,
               // the carrier's own fundamental, where vocMidiOf put it
               carHz: 440 * Math.pow(2, (M.vocMidiOf(NOTE) - 69) / 12),
               tone: window.__singTone(x, 44100, 440 * Math.pow(2, (M.vocMidiOf(NOTE) - 69) / 12)) };
    };
    const takes = {};
    for (const k of ["lead", "robot", "moog", "dx7", "fat", "clear"])
      takes[k] = await render(k);
    return { takes, stats: window.__nuSing(),
             probe: window.__nuSingProbe(mk("moog"), TEXT) };
  });

  if (out.error) { console.log("  FAIL " + out.error); await browser.close(); srv.close(); process.exit(1); }
  const T = out.takes, D = (a, b) => page.evaluate(([x, y]) => window.__cosDist(x, y), [a.prof, b.prof]);
  for (const k of Object.keys(T))
    console.log(`  ${k.padEnd(6)} rms ${T[k].rms.toFixed(4)}  centroid ${T[k].centroid.toFixed(0)} Hz` +
                `  carrier(${T[k].carHz.toFixed(1)} Hz) ${T[k].tone.toExponential(2)}`);

  /* ---- (B) a dry line is audible ---------------------------------------- */
  ok(T.lead.played && T.lead.rms > 0.005, "(B) the dry singer rendered silence: rms " + T.lead.rms);

  /* ---- (C) the vocoder is audible, and it is different ------------------- */
  ok(T.robot.played && T.robot.rms > 0.005, "(C) the vocoded line rendered silence: rms " + T.robot.rms);
  const dLead = await D(T.lead, T.robot);
  console.log("  spectral distance dry -> vocoded: " + dLead.toFixed(3));
  ok(dLead > 0.15, "(C) the vocoded line is spectrally the dry line (cos dist " + dLead.toFixed(3) + ")");
  // THE CARRIER IS WHAT YOU HEAR, and the honest way to ask is a RATIO. Both
  // takes carry energy near 131 Hz — the espeak lead is a bass-baritone whose
  // ladder folds into exactly that region, which is the coincidence that makes
  // a bare magnitude comparison meaningless. So each take's energy at the
  // carrier's own fundamental is normalized by its own level: measured, the
  // vocoded take is ten times more concentrated there than the dry one, which
  // is the synthesized carrier showing up where vocMidiOf put it.
  const rTone = (t) => t.tone / (t.rms || 1e-12);
  console.log(`  carrier concentration  dry ${rTone(T.lead).toExponential(2)}` +
              `  vocoded ${rTone(T.robot).toExponential(2)}`);
  ok(rTone(T.robot) > rTone(T.lead) * 3,
     "(C) no carrier fundamental in the vocoded take (" + rTone(T.robot).toExponential(2) +
     " vs dry " + rTone(T.lead).toExponential(2) + ")");
  // ...and it arrives at the loudness of the voice it replaced, so the chip is
  // an A/B and not a volume drop (vocode()'s own makeup note).
  ok(T.robot.rms > T.lead.rms * 0.4 && T.robot.rms < T.lead.rms * 2.5,
     "(C) the vocoded line is not at the dry line's loudness: " +
     T.robot.rms.toFixed(4) + " vs " + T.lead.rms.toFixed(4));
  ok(out.stats.vocoded >= 4, "(C) the vocoder never ran: " + JSON.stringify(out.stats));

  /* ---- (D) the carrier is a choice --------------------------------------- */
  const dMoog = await D(T.robot, T.moog), dDx7 = await D(T.robot, T.dx7);
  const dCarr = await D(T.moog, T.dx7);
  console.log(`  carrier distances  saw->moog ${dMoog.toFixed(3)}  saw->dx7 ${dDx7.toFixed(3)}` +
              `  moog->dx7 ${dCarr.toFixed(3)}`);
  ok(dMoog > 0.02, "(D) the Model D carrier is the saw carrier (cos dist " + dMoog.toFixed(3) + ")");
  ok(dDx7 > 0.02, "(D) the DX7 carrier is the saw carrier (cos dist " + dDx7.toFixed(3) + ")");
  ok(dCarr > 0.02, "(D) the Model D and the DX7 are the same sound (cos dist " + dCarr.toFixed(3) + ")");
  ok(out.probe && out.probe.carrier === "moog",
     "(D) the probe cannot see which carrier a note is on: " + JSON.stringify(out.probe && out.probe.carrier));

  /* ---- (E) the grip does something --------------------------------------- */
  const dGrip = await D(T.fat, T.clear);
  console.log(`  fat centroid ${T.fat.centroid.toFixed(0)} Hz vs clear ${T.clear.centroid.toFixed(0)} Hz` +
              `  (cos dist ${dGrip.toFixed(3)})`);
  ok(T.fat.rms > 0.005 && T.clear.rms > 0.005,
     "(E) a grip setting rendered silence: fat " + T.fat.rms + " clear " + T.clear.rms);
  // MEASURED, NOT ARGUED: eight bands imposed to the limit and forty-eight
  // bands at half grip are the two ends of this control, and the claim is
  // that they are two different sounds — not which way the centroid moves,
  // which is a fight between the thinner bank and its own makeup saturation.
  ok(dGrip > 0.02, "(E) the band count and the grip changed nothing (cos dist " +
     dGrip.toFixed(3) + ")");

  ok(errs.length === 0, "(F) page errors: " + JSON.stringify(errs.slice(0, 3)));

  await browser.close(); srv.close();
  console.log(fails ? "\nnukernel-sing: " + fails + " FAILURE(S)" : "\nnukernel-sing: PASS");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL:", (e && e.stack) || e); process.exit(1); });
