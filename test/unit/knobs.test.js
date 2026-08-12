#!/usr/bin/env node
// knobs.test.js — the genre as a bundle of continuous values (engine/knobs.js).
"use strict";
const Kn = require("../../engine/knobs.js");
const E = require("../../engine/csd-engine.js");
const K = require("../../engine/genre-kernel.js");
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log("  FAIL " + m); } };
const head = (s) => console.log("\n" + s);
const st = (g) => JSON.parse(JSON.stringify((function (t) { return t.state || t; })(K.track(g, { seed: 7 }))));

head("1. every knob reads and writes, on every anchor");
{
  let outOfRange = 0, noRound = 0;
  for (const g of Object.keys(K.GENRES)) {
    const s = st(g);
    for (const k of Kn.ALL) {
      const v = k.read(s);
      if (!(v >= k.min && v <= k.max)) { outOfRange++; if (outOfRange < 4) console.log("  " + g + "/" + k.id + " = " + v); }
      // WRITE THEN READ must round-trip, or a knob shows one thing and does another
      const mid = k.min + (k.max - k.min) * 0.37;
      k.write(s, mid);
      if (Math.abs(k.read(s) - mid) > 1e-6) { noRound++; if (noRound < 4) console.log("  " + g + "/" + k.id + " no round-trip"); }
    }
  }
  ok(outOfRange === 0, "every knob reads inside its own range on all 274 (" + outOfRange + " outside)");
  ok(noRound === 0, "and write-then-read round-trips (" + noRound + " failures)");
  ok(Kn.HEADLINE.length === 12, "twelve headline knobs (" + Kn.HEADLINE.length + ")");
  ok(new Set(Kn.ALL.map((k) => k.id)).size === Kn.ALL.length, "ids are unique");
  ok(new Set(Kn.ALL.map((k) => k.path)).size === Kn.ALL.length, "paths are unique — no two knobs fight over one field");
}

head("1b. off is not zero");
{
  // the specific regression: a genre with an open top must read as OPEN
  const cp = st("citypop");
  ok(cp.tone.highcut === 0, "city pop ships tone.highcut 0 — the engine's spelling of open");
  ok(Kn.byId.highcut.read(cp) === 20000, "and the knob reads it as fully open, not as 800 Hz");
  const c2 = st("citypop");
  Kn.byId.highcut.write(c2, 20000);
  ok(c2.tone.highcut === 0, "writing fully open writes 0 back, keeping the engine's idiom");
  Kn.byId.highcut.write(c2, 6000);
  ok(c2.tone.highcut === 6000 && Kn.byId.highcut.read(c2) === 6000, "a real cut round-trips");
}

head("2. a knob moves its own field and nothing else");
{
  const base = st("citypop");
  for (const k of Kn.ALL) {
    const a = JSON.parse(JSON.stringify(base));
    k.write(a, k.read(a) === k.max ? k.min : k.max);
    // diff the two states field-by-field at the top level
    const moved = Object.keys(a).filter((f) => JSON.stringify(a[f]) !== JSON.stringify(base[f]));
    const want = k.path.split(".")[0];
    ok(moved.length <= 1 && (moved.length === 0 || moved[0] === want),
      k.id + " touches only " + want + " (moved: " + moved.join(",") + ")");
  }
}

head("3. submerge is one dimension, and it lands where the family says");
{
  // ABSENT IS IDENTITY. The standing law: a knob at its default changes nothing.
  const z = st("citypop"), z0 = JSON.stringify(z);
  Kn.SUBMERGE.apply(z, 0);
  ok(JSON.stringify(z) === z0, "submerge 0 is byte-identical");

  // MONOTONE in all four projections, which is the claim that makes it one knob
  let last = null, mono = true;
  for (let s = 0; s <= 1.0001; s += 0.25) {
    const c = st("citypop"); Kn.SUBMERGE.apply(c, s);
    // read the EFFECTIVE top cut: the engine spells "open" as 0
    const hc = Kn.byId.highcut.read(c);
    const v = [c.bpm, -c.reverb, hc, -c.crackle];
    if (last) for (let i = 0; i < 4; i++) if (v[i] > last[i] + 1e-9) mono = false;
    last = v;
  }
  ok(mono, "bpm, reverb, top cut and crackle all move together and never turn back");

  // AND IT REPRODUCES THE MEASURED ENDPOINT. citypop submerged fully should land
  // on mallsoft, because that is the pair the constants were read off.
  const full = st("citypop"); Kn.SUBMERGE.apply(full, 1);
  const mall = st("mallsoft");
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  ok(near(full.bpm, mall.bpm, 6), "submerged city pop lands on mallsoft's tempo (" + Math.round(full.bpm) + " vs " + Math.round(mall.bpm) + ")");
  ok(near(full.reverb, mall.reverb, 0.06), "…its reverb (" + full.reverb.toFixed(2) + " vs " + mall.reverb.toFixed(2) + ")");
  ok(near(Kn.byId.highcut.read(full), Kn.byId.highcut.read(mall), 900), "…its top cut (" + Math.round(Kn.byId.highcut.read(full)) + " vs " + Math.round(Kn.byId.highcut.read(mall)) + ")");
  ok(near(full.crackle, mall.crackle, 0.04), "…and its crackle (" + full.crackle.toFixed(2) + " vs " + mall.crackle.toFixed(2) + ")");

  // it must work on ANY anchor, not just the family it was fitted to
  let broke = 0;
  for (const g of Object.keys(K.GENRES)) {
    const c = st(g); Kn.SUBMERGE.apply(c, 1);
    if (!(c.bpm >= 30 && c.bpm <= 220) || !(c.reverb >= 0 && c.reverb <= 1)
      || !(Kn.byId.highcut.read(c) >= 600)) { broke++; continue; }
    try { if (E.buildEvents(c).pitched.length < 1 && E.buildEvents(c).drums.length < 1) broke++; } catch (e) { broke++; }
  }
  ok(broke === 0, "every one of the 274 survives being fully submerged (" + broke + " broke)");
}

head("4. the instrument dial is ordered, and it covers what is used");
{
  const axis = Kn.instrumentAxis(K);
  const fams = Object.keys(axis);
  ok(fams.length >= 8, fams.length + " families");
  let unsorted = 0, total = 0;
  for (const f of fams) {
    total += axis[f].length;
    for (let i = 1; i < axis[f].length; i++) if (axis[f][i].bright < axis[f][i - 1].bright - 1e-9) unsorted++;
  }
  ok(unsorted === 0, "every family is sorted dark-to-bright (" + unsorted + " out of order)");
  ok(total >= 90, total + " instruments on the dial");

  // EVERY INSTRUMENT THE CATALOGUE USES must be findable, or a genre would land
  // on a dial position that does not exist
  let missing = 0;
  for (const g of Object.keys(K.GENRES)) {
    const I = st(g).instruments || {};
    for (const slot of ["bass", "melody", "pad"]) {
      const r = I[slot]; if (!r) continue;
      const id = (r.sampler && r.sampler.id) || r.model; if (!id) continue;
      if (!Kn.positionOf(axis, id)) { missing++; if (missing < 4) console.log("  no dial position for " + id); }
    }
  }
  ok(missing === 0, "every instrument in use has a dial position (" + missing + " missing)");

  // the ordering has to be MUSICALLY right, not merely sorted — these are the
  // readings that made it worth deriving rather than hand-writing
  const idx = (f, id) => axis[f] ? axis[f].findIndex((x) => x.id === id) : -1;
  if (idx("lead", "sub") >= 0 && idx("lead", "atmosphere") >= 0)
    ok(idx("lead", "sub") < idx("lead", "atmosphere"), "lead: sub is darker than atmosphere");
  if (idx("string", "cello") >= 0 && idx("string", "violin") >= 0)
    ok(idx("string", "cello") < idx("string", "violin"), "string: cello is below violin");
  if (idx("brass", "tuba") >= 0 && idx("brass", "muted_trumpet") >= 0)
    ok(idx("brass", "tuba") < idx("brass", "muted_trumpet"), "brass: tuba is below muted trumpet");
}

head("5. every dial position actually swaps the sound");
{
  // THE SILENT NO-OP THIS EXISTS FOR. The axis holds sampler ids and SYNTH MODEL
  // ids side by side, because a family is a timbre neighbourhood and both live in
  // it. setInstrument handled only samplers, so dialling onto `pluck` or `tb303`
  // returned false and did nothing — the dial moved, the label changed, the sound
  // did not.
  const axis = Kn.instrumentAxis(K);
  let failed = [], synths = 0, samplers = 0;
  for (const f of Object.keys(axis)) {
    for (const e of axis[f]) {
      const s = st("vaporwave");
      const okSet = Kn.setInstrument(s, "melody", e.id, K);
      if (!okSet || Kn.instrumentOf(s, "melody") !== e.id) { failed.push(e.id); continue; }
      (K.SAMPLERS[e.id] ? samplers++ : synths++);
    }
  }
  ok(failed.length === 0, "every position on every dial changes the instrument (" + failed.length + " no-ops"
    + (failed.length ? ": " + failed.slice(0, 5).join(",") : "") + ")");
  ok(synths > 0 && samplers > 0, "and the axis really does mix synths and samplers (" + synths + " synth, " + samplers + " sampled)");

  // and the result must still render, for both kinds
  let broke = 0;
  for (const id of ["bandoneon", "tb303", "cello", "pluck", "vibraphone"]) {
    if (!Kn.positionOf(axis, id)) continue;
    const s = st("vaporwave");
    Kn.setInstrument(s, "melody", id, K);
    try { if (E.buildEvents(s).pitched.length < 20) broke++; } catch (e) { broke++; }
  }
  ok(broke === 0, "a swapped voice still renders, sampled or synth (" + broke + " broke)");

  // a sampled swap must inject its zones at vol 0, or the decoder never sees them
  const z = st("vaporwave");
  Kn.setInstrument(z, "melody", "bandoneon", K);
  const inj = z.foundSources.filter((f) => f.id.indexOf("ins_bandoneon") === 0);
  ok(inj.length > 0 && inj.every((f) => f.vol === 0), inj.length + " bandoneon zones injected at vol 0");
  // an id the registry does not carry is refused
  ok(Kn.setInstrument(st("vaporwave"), "melody", "../etc/passwd", K) === false, "an unknown id is refused");
}

console.log("\n" + (fails ? "FAIL" : "PASS") + " — " + (checks - fails) + "/" + checks + " checks");
process.exit(fails ? 1 : 0);
