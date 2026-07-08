#!/usr/bin/env node
// faust/probe-mbcomp.js — fx wings STAGE 4 gate: the 3-band MASTER glue-comp
// (`dist/master_mb`, kernel dimension `state.masterComp`, OPT-IN external node).
//
// ARCHITECTURE (why not inside fx_bus): the mband branch ran even at drive 0
// (Faust computes both select paths — 3 always-on stereo compressors) and cost
// EVERY genre ~0.01 live load ratio; the live gate went 0.977/0.973 PASS with
// the committed fx_bus vs 0.969/0.967 FAIL with it baked in. As a separate
// module it exists only when a genre opts in (disco): press post-passes the
// fx_bus output, live series-inserts it under a crossfade (reverb-color law).
//
//   Part A (mechanism, offline master_mb):
//     - mbdrive 0 is a BIT-EXACT dry pass (x*(1-0) + wet*0)
//     - MULTIBAND proof: a loud low band (kick, over threshold) is gain-reduced
//       while a quiet high band (air, under threshold) passes with less
//       reduction — per-band independence, not a volume ride
//     - determinism
//   Part B (integration): disco carries masterComp (0.35) -> SE.masterMb;
//     untouched genres return null; a disco press with masterComp differs from
//     the same state without it, and logs the master-mb pass.
//
//   node faust/probe-mbcomp.js
"use strict";
const fs = require("fs");
const path = require("path");
const K = require(path.join(__dirname, "..", "engine", "genre-kernel.js"));
const SE = require(path.join(__dirname, "..", "engine", "faust", "state-engine.js"));
const FP = require(path.join(__dirname, "..", "engine", "faust", "found-player.js"));
const SR = 44100, BS = 64;
let fail = 0;
const ok = (c, msg) => { console.log((c ? "  ok  " : "  FAIL") + " " + msg); if (!c) fail++; };

let _gen = null;
async function mkProc(mod) {
  const code = fs.readFileSync(path.join(__dirname, "..", "engine", "faust", "dist", `${mod}-module.wasm`));
  const json = fs.readFileSync(path.join(__dirname, "..", "engine", "faust", "dist", `${mod}-meta.json`), "utf8");
  const f = { cfactory: 0, code: new Uint8Array(code), module: await WebAssembly.compile(code), json, poly: false };
  if (!_gen) {
    const { FaustMonoDspGenerator } = await import(path.join(__dirname, "..", "engine", "faust", "node_modules/@grame/faustwasm/dist/esm/index.js"));
    _gen = new FaustMonoDspGenerator();
  }
  return await _gen.createOfflineProcessor(SR, BS, f);
}
function runMb(proc, L, R) {
  const n = L.length, oL = new Float32Array(n);
  for (let s = 0; s < n; s += BS) {
    const len = Math.min(BS, n - s);
    const o = proc.render([L.subarray(s, s + len), R.subarray(s, s + len)], len);
    oL.set(o[0].subarray(0, len), s);
  }
  return oL;
}
const rms = (x, a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / (b - a)); };

(async () => {
  console.log("Part A — master_mb mechanism:");
  // dynamic program: pumping 100 Hz kick-ish bursts (loud) + steady 5 kHz air (quiet)
  const DUR = Math.floor(SR * 3), inp = new Float32Array(DUR);
  for (let i = 0; i < DUR; i++) {
    const t = i / SR, ph = t % 0.5;
    inp[i] = Math.sin(2 * Math.PI * 100 * t) * 0.55 * Math.exp(-ph / 0.12)
           + Math.sin(2 * Math.PI * 5000 * t) * 0.03;
  }
  const set = async (drive) => {
    const p = await mkProc("master_mb");
    p.setParamValue("/master_mb/mbdrive", drive);
    return p;
  };
  const dry0 = runMb(await set(0), inp, inp);
  let bit = true; for (let i = 0; i < DUR; i++) if (dry0[i] !== inp[i]) { bit = false; break; }
  ok(bit, "mbdrive 0 is a bit-exact dry pass (the untouched-genre law)");

  const wet = runMb(await set(0.5), inp, inp);
  const A = Math.floor(SR * 1.0), B = DUR;   // skip smoo/attack settle
  const band = (x, mode) => {
    const c = x.slice(A, B);
    if (mode === "lo") return FP.lp24(c, 250, SR);
    const lp = FP.lp24(x.slice(A, B), 2500, SR);   // hi = x - lp(2.5k)
    for (let i = 0; i < c.length; i++) c[i] -= lp[i];
    return c;
  };
  const r = (x) => rms(x, 0, x.length);
  const loRatio = r(band(wet, "lo")) / (r(band(dry0, "lo")) + 1e-12);
  const hiRatio = r(band(wet, "hi")) / (r(band(dry0, "hi")) + 1e-12);
  console.log(`  band RMS wet/dry at drive 0.5: low ${loRatio.toFixed(3)} (${(20 * Math.log10(loRatio)).toFixed(1)} dB), high ${hiRatio.toFixed(3)} (${(20 * Math.log10(hiRatio)).toFixed(1)} dB)`);
  ok(loRatio < 0.98, "loud low band is gain-reduced (the glue compresses where the energy is)");
  ok(hiRatio > loRatio * 1.02, "quiet high band is reduced LESS than the loud low band (per-band independence = multiband)");
  const wet2 = runMb(await set(0.5), inp, inp);
  let det = true; for (let i = 0; i < DUR; i++) if (wet[i] !== wet2[i]) { det = false; break; }
  ok(det, "two renders are byte-identical (deterministic)");

  console.log("\nPart B — kernel + engine integration:");
  const disco = K.track("disco", { seed: 2 });
  ok(disco.masterComp === 0.35, `disco carries masterComp (${disco.masterComp})`);
  const mb = SE.masterMb(disco);
  ok(mb && mb.module === "master_mb" && mb.mbdrive === 0.35, "SE.masterMb resolves {master_mb, 0.35} for disco");
  const untouched = ["techno", "jungle", "vaporwave", "citypop"].map(g => K.track(g, { seed: 1 }));
  ok(untouched.every(s => s.masterComp === undefined), "untouched genres carry NO masterComp");
  ok(untouched.every(s => SE.masterMb(s) === null), "SE.masterMb null for untouched genres (module never built)");
  // full press: disco with masterComp vs without must differ, and log the pass
  const { execFileSync } = require("child_process");
  const os = require("os");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mb-"));
  const on = path.join(tmp, "on.json"), off = path.join(tmp, "off.json");
  fs.writeFileSync(on, JSON.stringify(disco));
  const stripped = JSON.parse(JSON.stringify(disco)); delete stripped.masterComp;
  fs.writeFileSync(off, JSON.stringify(stripped));
  const press = (a, b) => execFileSync(process.execPath, [path.join(__dirname, "..", "engine", "faust", "press.js"), a, b, "--dur", "30"], { stdio: "pipe" }).toString();
  const logOn = press(on, path.join(tmp, "on.wav"));
  press(off, path.join(tmp, "off.wav"));
  ok(/master mb: master_mb, mbdrive=0.35/.test(logOn), "press logs the master-mb post-pass");
  const wOn = fs.readFileSync(path.join(tmp, "on.wav")), wOff = fs.readFileSync(path.join(tmp, "off.wav"));
  ok(!wOn.equals(wOff), "disco press with masterComp differs from the same state without it");
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(fail ? `\nPROBE FAIL (${fail})` : "\nPROBE PASS");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
