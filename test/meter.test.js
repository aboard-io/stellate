#!/usr/bin/env node
// meter.test.js — ODD-METER gates (state.meter = {beats:3|6, unit:4|8}).
//   node test/meter.test.js [--no-press]
//
// Gates, in order:
//   1  3/4 waltz grid      hand state (waltz kit + oompahpah + waltz melody):
//                          kicks strictly on the boom of every 3-beat measure,
//                          snares dominantly on the chick beats, hats on the
//                          8th grid, chord bar = 6 beats (the meter default)
//   2  6/8 compound lilt   sixeight kit + siciliana + lilt6: kicks on the two
//                          dotted-quarter pulses (0 and 3 mod 6), hats on the
//                          8th (=integer-beat) grid, bass on the lilt grid
//   3  chordEvery:12       the 3-beat cells tile a 12-beat chord bar
//   4  absent-meter        byte-identity vs HEAD (git show): defaultState +
//                          3 kernel tracks, state AND events JSON (skipped
//                          gracefully when git/HEAD is unavailable)
//   5  determinism         meter states build twice byte-identically
//   6  kernel dimension    a synthetic meter anchor resolves meter+chordEvery
//                          +waltz pools; meterless anchors emit NO meter key;
//                          a blend FLIPS meter (parent-pick), never smears
//   7  vocabulary harmless a 4/4 state may request the meter kits/cells
//                          without meter — no crash (tiled as a polymeter)
//   8  press smoke         faust press of the 3/4 state, non-silence RMS
//                          (the engine.test harness pattern; --no-press or a
//                          missing faust/node_modules skips)
"use strict";
const { execFileSync, execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const HERE = __dirname;
const E = require("../engine/csd-engine.js");
const K = require("../engine/genre-kernel.js");

let fails = 0;
const gate = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) fails++;
};
const J = JSON.stringify;
const near = (x, g, eps) => Math.abs(x - g) < (eps || 1e-6);
const onGrid = (x, grid, period) => grid.some((g) => near(((x % period) + period) % period, g, 1e-6));

// a hand meter state: no found files, transforms muted (rate 0) so the drum
// grid asserts see the kit itself; cycles:1 keeps the evolution kicks out.
function handState(meter, kit, bass, melody, seed, chordEvery) {
  const s = E.defaultState();
  s.seed = seed;
  s.foundSources = [];
  s.meter = meter;
  if (chordEvery) s.chordEvery = chordEvery;
  s.transforms = { pool: ["rest"], rate: 0 };
  s.sections = [
    { id: "m1", name: "verse", cycles: 1, pads: true, bass, drums: kit, melody, found: { sourceId: null, role: "bed" }, fill: "off" },
    { id: "m2", name: "chorus", cycles: 1, pads: true, bass, drums: kit, melody, found: { sourceId: null, role: "bed" }, fill: "off" },
  ];
  return s;
}

// ---- 1: 3/4 waltz grid ----
{
  const s = handState({ beats: 3, unit: 4 }, "waltz", "oompahpah", "waltz", 7);
  const ev = E.buildEvents(s);
  const chords = E.getProgression(s.progression).chords.length;
  gate("waltz_chord_bar_6", ev.totalBeats === 2 * chords * 6 + 8, `totalBeats=${ev.totalBeats} (chordEvery defaulted to 6)`);
  const kicks = ev.drums.filter((d) => d.drum === "kick");
  const kickOK = kicks.length > 0 && kicks.every((d) => near(((d.beat % 3) + 3) % 3, 0));
  gate("waltz_kick_boom", kickOK, `${kicks.length} kicks, all ≡0 mod 3 (the boom of every measure)`);
  const snares = ev.drums.filter((d) => d.drum === "snare");
  const chick = snares.filter((d) => onGrid(d.beat, [1, 2], 3)).length;
  gate("waltz_snare_chicks", snares.length > 0 && chick / snares.length >= 0.7,
    `${chick}/${snares.length} snares on beats 2+3 of the measure (snare-law variations allowed)`);
  const hats = ev.drums.filter((d) => d.drum === "hat");
  gate("waltz_hat_8ths", hats.length > 0 && hats.every((d) => near((d.beat * 2) % 1, 0) || near((d.beat * 2) % 1, 1)),
    `${hats.length} hats on the 8th grid`);
  const bassOn = ev.pitched.filter((e) => e.voice === "bass");
  const bassGrid = bassOn.filter((e) => near((e.beat % 1), 0) || near((e.beat % 1), 1)).length;
  gate("waltz_oompah_grid", bassOn.length > 0 && bassGrid / bassOn.length >= 0.8,
    `${bassGrid}/${bassOn.length} bass onsets on the beat (humanity pushes allowed)`);
}

// ---- 2: 6/8 compound lilt ----
{
  const s = handState({ beats: 6, unit: 8 }, "sixeight", "siciliana", "lilt6", 11);
  const ev = E.buildEvents(s);
  const kicks = ev.drums.filter((d) => d.drum === "kick");
  const kickOK = kicks.length > 0 && kicks.every((d) => onGrid(d.beat, [0, 3], 6));
  gate("sixeight_kick_pulses", kickOK, `${kicks.length} kicks on the two dotted-quarter pulses (0,3 mod 6)`);
  const hats = ev.drums.filter((d) => d.drum === "hat");
  gate("sixeight_hat_8ths", hats.length > 0 && hats.every((d) => near((d.beat % 1), 0) || near((d.beat % 1), 1)),
    `${hats.length} hats on the compound 8th grid`);
  const bassOn = ev.pitched.filter((e) => e.voice === "bass");
  const lilt = bassOn.filter((e) => onGrid(e.beat, [0, 1.5, 2, 3, 4.5, 5], 6)).length;
  gate("sixeight_siciliana", bassOn.length > 0 && lilt / bassOn.length >= 0.8,
    `${lilt}/${bassOn.length} bass onsets on the siciliana lilt grid`);
  const mel = ev.pitched.filter((e) => e.voice === "melody");
  const melLilt = mel.filter((e) => onGrid(e.beat, [0, 0.5, 1.5, 2, 2.5, 3, 3.5, 4.5, 5, 5.5], 6)).length;
  gate("sixeight_lilt6_melody", mel.length > 0 && melLilt / mel.length >= 0.8,
    `${melLilt}/${mel.length} melody onsets on the lilt grid (humanity pushes allowed)`);
}

// ---- 3: chordEvery 12 tiling ----
{
  const s = handState({ beats: 3, unit: 4 }, "waltz", "waltzroot", "waltz", 3, 12);
  const ev = E.buildEvents(s);
  const chords = E.getProgression(s.progression).chords.length;
  gate("waltz_ce12_beats", ev.totalBeats === 2 * chords * 12 + 8, `totalBeats=${ev.totalBeats}`);
  const kicks = ev.drums.filter((d) => d.drum === "kick");
  gate("waltz_ce12_kicks", kicks.length > 0 && kicks.every((d) => near(((d.beat % 3) + 3) % 3, 0)),
    `${kicks.length} kicks still ≡0 mod 3 across the 12-beat chord bar`);
  const roots = ev.pitched.filter((e) => e.voice === "bass");
  gate("waltz_ce12_roots", roots.length >= chords * 2 * 3, `${roots.length} dotted-half roots (>=1 per measure, minus humanity rests)`);
}

// ---- 4: absent-meter byte-identity vs HEAD ----
{
  let headDir = null;
  try {
    headDir = fs.mkdtempSync(path.join(os.tmpdir(), "meter-head-"));
    fs.mkdirSync(path.join(headDir, "engine", "faust"), { recursive: true });
    const files = ["csd-engine.js", "genre-kernel.js", "theory.js", "pipes.js", "namebank.js", "speech.js"];
    for (const f of files)
      fs.writeFileSync(path.join(headDir, "engine", f),
        execFileSync("git", ["show", "HEAD:engine/" + f], { cwd: path.join(HERE, ".."), maxBuffer: 64 * 1024 * 1024 }));
    fs.writeFileSync(path.join(headDir, "engine", "faust", "dx7-presets.json"),
      execFileSync("git", ["show", "HEAD:engine/faust/dx7-presets.json"], { cwd: path.join(HERE, ".."), maxBuffer: 64 * 1024 * 1024 }));
  } catch (e) { headDir = null; }
  if (!headDir) {
    console.log("SKIP  head_byte_identity  (git/HEAD unavailable)");
  } else {
    const E0 = require(path.join(headDir, "engine", "csd-engine.js"));
    const K0 = require(path.join(headDir, "engine", "genre-kernel.js"));
    let ok = J(E0.buildEvents(E0.defaultState())) === J(E.buildEvents(E.defaultState()));
    const tracks = [["jungle", 2], ["prelude", 3], ["blues", 1]];
    for (const [g, seed] of tracks) {
      const s0 = K0.track(g, { seed }), s1 = K.track(g, { seed });
      if (J(s0) !== J(s1)) { ok = false; console.log(`  state drift: ${g}/s${seed}`); }
      else if (J(E0.buildEvents(s0)) !== J(E.buildEvents(s1))) { ok = false; console.log(`  event drift: ${g}/s${seed}`); }
    }
    gate("head_byte_identity", ok, "defaultState + 3 kernel tracks, state+events JSON vs HEAD");
  }
}

// ---- 5: determinism of meter states ----
{
  const s = () => handState({ beats: 3, unit: 4 }, "waltzswing", "oompahpah", "waltz", 42);
  gate("meter_determinism", J(E.buildEvents(s())) === J(E.buildEvents(s())), "same seed -> byte-identical events");
}

// ---- 6: kernel meter dimension (synthetic anchor — the integrator recipe) ----
{
  const g = JSON.parse(JSON.stringify(K.GENRES.lofi));   // clone carries the deriveMind axes
  g.meter = { beats: 3, unit: 4 };
  g.kits = ["waltz", "waltzswing"];
  g.bass.patterns = ["oompahpah", "waltzroot"];
  g.lead.patterns = ["waltz", "sparse"];
  delete g.euclid;
  K.GENRES.__waltzprobe = g;
  const st = K.track("__waltzprobe", { seed: 5 });
  gate("kernel_meter_emitted", !!st.meter && st.meter.beats === 3 && st.meter.unit === 4 && st.chordEvery === 6,
    `meter=${J(st.meter)} chordEvery=${st.chordEvery}`);
  gate("kernel_meter_pools", ["waltz", "waltzswing"].includes(st.genreMeta.kit)
    && /^(oompahpah|waltzroot)\(/.test(st.genreMeta.bass),
    `kit=${st.genreMeta.kit} bass=${st.genreMeta.bass}`);
  gate("kernel_meter_deterministic", J(st) === J(K.track("__waltzprobe", { seed: 5 })));
  const evOK = (() => { try { return E.buildEvents(st).drums.length > 0; } catch (e) { return false; } })();
  gate("kernel_meter_renders", evOK, "buildEvents on the resolved meter track");
  // meterless anchors emit NO meter key (the absent = byte-identical law)
  gate("kernel_meterless_clean", !("meter" in K.track("lofi", { seed: 5 })) && !("meter" in K.track("techno", { seed: 1 })));
  // blends FLIP the meter (parent-pick), never smear: deep on the 4/4 side
  // the meter key vanishes; deep on the waltz side it survives whole.
  const bA = K.blend("__waltzprobe", "techno", 0.2, { seed: 9 });
  const bB = K.blend("__waltzprobe", "techno", 0.8, { seed: 9 });
  gate("kernel_meter_flips", !!bA.meter && bA.meter.beats === 3 && !("meter" in bB),
    `t=.2 meter=${J(bA.meter)}; t=.8 meter absent`);
  delete K.GENRES.__waltzprobe;
}

// ---- 7: meter vocabulary is harmless without meter ----
{
  const s = handState(undefined, "waltz", "oompahpah", "waltz", 2);
  delete s.meter;
  const ev = E.buildEvents(s);
  const chords = E.getProgression(s.progression).chords.length;
  gate("vocab_harmless_4_4", ev.totalBeats === 2 * chords * 8 + 8 && ev.drums.length > 0,
    `meterless waltz-kit state renders on the 8-beat bar (totalBeats=${ev.totalBeats})`);
}

// ---- 7b: full-surface stress under CBEATS=6 — fills/transitions/euclid/
// perc/groove/rubato/rhythm-knob/theory all riding a 3/4 bar. The gate is
// "builds, deterministic, sane beats": these passes are 4/4-authored
// decorations (perc tiles its own 8-beat cell as a polymeter lane; euclid is
// lane notation over whatever bar it's given) and must never crash or emit
// negative/NaN beats on a 6-beat chord bar.
{
  const mk = () => {
    const s = handState({ beats: 3, unit: 4 }, "waltz", "oompahpah", "waltz", 13);
    delete s.transforms;                        // let the default transform pool run on 6-beat bars
    s.swing = 0.2; s.humanize = 0.3; s.snarePP = 0.7; s.jux = 0.5;
    s.euclid = { kick: [3, 8] };
    s.perc = { lanes: [{ p: "tambourine", lvl: 0.2 }, { p: "shaker8", lvl: 0.15 }] };
    s.rhythm = { complexity: 0.6 };
    s.rubato = { depth: 0.03, periodBars: 3, phase: 0.2 };
    s.theory = { adventure: 0.4, color: 0.5, voicing: "close", reharm: true };
    s.sections[0].fill = "tom fill";
    s.sections[1].fill = "stutter";
    s.sections.push({ id: "m3", name: "bridge", cycles: 2, pads: true, bass: "waltzroot", drums: "waltzswing", melody: "sparse", found: { sourceId: null, role: "bed" }, fill: "dropout" });
    return s;
  };
  let ev = null, ok = true, why = "";
  try { ev = E.buildEvents(mk()); } catch (e) { ok = false; why = String(e.message).slice(0, 80); }
  if (ev) {
    const all = [...ev.pitched, ...ev.drums, ...ev.found, ...ev.sfx];
    if (!all.every((e) => Number.isFinite(e.beat) && e.beat >= 0)) { ok = false; why = "bad beat"; }
    if (!(ev.drums.length > 0 && ev.pitched.length > 0)) { ok = false; why = "empty lanes"; }
    if (J(ev) !== J(E.buildEvents(mk()))) { ok = false; why = "nondeterministic"; }
  }
  gate("meter_stress_surface", ok, why || `fills+euclid+perc+rubato+rhythm+theory on 6-beat bars (${ev.drums.length} drums)`);
  // verifier features stay well-defined on a meter state (no NaN — the 8-beat
  // feature windows simply frame the 3/4 fabric; targets for future meter
  // genres must be MEASURED against these 4/4-framed features)
  let feats = null;
  try { feats = require("../engine/genre-verifier.js").features(mk()); } catch (e) {}
  gate("meter_verifier_sane", !!feats && Object.values(feats).every((v) => typeof v !== "number" || Number.isFinite(v)),
    feats ? `hatDensity=${feats.hatDensity} drumDensity=${feats.drumDensity} variation=${feats.variation}` : "features threw");
}

// ---- 8: faust press smoke (engine.test harness pattern) ----
(async () => {
  const noPress = process.argv.includes("--no-press");
  const faustDeps = fs.existsSync(path.join(HERE, "..", "engine", "faust", "node_modules"));
  if (noPress || !faustDeps) {
    console.log(`SKIP  meter_press_rms  (${noPress ? "--no-press" : "faust/node_modules missing"})`);
  } else {
    const s = handState({ beats: 3, unit: 4 }, "waltz", "oompahpah", "waltz", 7);
    const sj = path.join(os.tmpdir(), "meter_press.state.json");
    const wav = path.join(os.tmpdir(), "meter_press.wav");
    fs.writeFileSync(sj, J(s));
    const rms = await new Promise((resolve) => {
      execFile("node", [path.join(HERE, "..", "engine", "faust", "press.js"), sj, wav, "--dur", "8"],
        { maxBuffer: 16 * 1024 * 1024 }, (err) => {
          if (err || !fs.existsSync(wav)) return resolve(0);
          const buf = fs.readFileSync(wav);
          let sum = 0, n = 0;
          for (let i = 44; i + 1 < buf.length; i += 2) { const v = buf.readInt16LE(i) / 32768; sum += v * v; n++; }
          resolve(n ? Math.sqrt(sum / n) : 0);
        });
    });
    gate("meter_press_rms", rms > 0.01, `rms=${rms.toFixed(4)} (8s waltz press, non-silent)`);
  }
  console.log(fails ? `FAIL: ${fails} meter gate(s) failed` : "PASS: all meter gates green");
  process.exit(fails ? 1 : 0);
})();
