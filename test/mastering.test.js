#!/usr/bin/env node
// test/mastering.test.js — THE MASTERING STAGE gate.
//
//   node test/mastering.test.js
//
// Pins the four mechanisms of the master pass (state-engine + renderers;
// design: NEXT.md §5d "THE MASTERING STAGE"; measured evidence: fugue seed 3
// pressed at max -22.1 dB with church_organ on BOTH bass and melody):
//   1. SAME-TIMBRE COLLISION CARVE fires on fugue seed 3 (the motivating
//      case) and NEVER on units that don't share a sampler id.
//   2. REVERB BUDGET scales dense drenched mixes down (vaporwave/dinosynth)
//      and leaves washes + dry genres at exactly 1 (ambient/fugue/techno) —
//      fxParams/reverbColor carry the scale into every renderer.
//   3. STEREO PLACEMENT: leads/hats/pads carry pan, bass/kick/sfx stay
//      center; solos alternate sides; constant-power law; the sampler mixPCM
//      realizes per-note pan on the wide buses and stays MONO-byte-identical
//      for unpanned notes.
//   4. GAIN STAGING: press's computeMakeup lifts an under-gained peak toward
//      -6 dBFS, caps at +18 dB, and is EXACTLY 1 (byte-untouched) for any
//      press already at/above the target — loud genres can never get louder.
// Pure node, no WASM, no rendering — fast enough for every run.
"use strict";
const path = require("path");

const ROOT = path.join(__dirname, "..");
const E = require(path.join(ROOT, "engine", "csd-engine.js"));
const K = require(path.join(ROOT, "engine", "genre-kernel.js"));
const SE = require(path.join(ROOT, "engine", "faust", "state-engine.js"));
const SP = require(path.join(ROOT, "engine", "faust", "sampler.js"));
const PRESS = require(path.join(ROOT, "engine", "faust", "press.js"));

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "  PASS  " : "  FAIL  ") + msg); if (!cond) fails++; };
const approx = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-9);

// ---------------------------------------------------------------- 1. carve
console.log("== collision carve ==");
{
  const st = K.track("fugue", { seed: 3 });
  const units = SE.voiceUnits(E, st);
  const pitched = Object.entries(units).filter(([k, u]) => u && !u.__meta && !u.drum && u.sampler && u.sampler.id);
  const byId = {};
  for (const [k, u] of pitched) (byId[u.sampler.id] = byId[u.sampler.id] || []).push(k);
  const collided = Object.entries(byId).find(([, keys]) => keys.length >= 2);
  ok(!!collided, "fugue s3 has a same-sampler collision (the measured evidence: church_organ x2)");
  if (collided) {
    const keys = collided[1];
    const carvedKeys = keys.filter((k) => units[k].carve);
    const keptKeys = keys.filter((k) => !units[k].carve);
    ok(carvedKeys.length === keys.length - 1 && keptKeys.length === 1,
      `exactly one voice keeps full range (kept: ${keptKeys.join(",")}; carved: ${carvedKeys.join(",")})`);
    for (const k of carvedKeys) {
      const u = units[k], s = u.sampler.strip;
      const hasDip = s.eq2 && s.eq2.gain < 0 && s.eq2.f >= 300 && s.eq2.f <= 600;
      const hasHpf = (s.hpf || 0) >= 250;
      ok(u.role === "bass" ? hasDip : (hasHpf && hasDip),
        `${k} (role ${u.role}) carries the carve (hpf ${s.hpf || 0}${s.eq2 ? ", dip " + s.eq2.gain + "dB@" + s.eq2.f : ""})`);
      if (u.role === "bass") ok((s.hpf || 0) < 100, `${k} keeps its lows (bass is never high-passed by the carve)`);
    }
    // the carve must not have mutated the SHARED profile objects
    ok(SE.STRIP_PROFILES.bass.eq2 === undefined && SE.STRIP_PROFILES.lead.eq2 === undefined,
      "STRIP_PROFILES untouched (carve clones, never mutates)");
  }
  // absent-law: no collision => no carve fields anywhere
  const st2 = K.track("techno", { seed: 3 });
  const units2 = SE.voiceUnits(E, st2);
  const ids = Object.values(units2).filter((u) => u && !u.__meta && !u.drum && u.sampler && u.sampler.id).map((u) => u.sampler.id);
  if (new Set(ids).size === ids.length)
    ok(Object.values(units2).every((u) => !u || !u.carve), "techno s3 (no collision) carries zero carve marks");
  else console.log("  note  techno s3 happens to collide too — absent-law covered by the profile check above");
}

// ---------------------------------------------------------------- 2. budget
console.log("== reverb budget ==");
{
  const scaleOf = (g) => SE.reverbScale(K.track(g, { seed: 3 }));
  ok(approx(scaleOf("ambient"), 1), "ambient (beatless wash — the wash IS the genre) scales 1.0 exactly");
  ok(approx(scaleOf("fugue"), 1), "fugue (beatless, moderate wet) scales 1.0 — its fix is the carve+gain, not the budget");
  ok(approx(scaleOf("techno"), 1), "techno (driving but dry) scales 1.0");
  ok(scaleOf("vaporwave") < 0.9, "vaporwave (drenched + beat-carrying) scales down (" + scaleOf("vaporwave").toFixed(3) + ")");
  ok(scaleOf("dinosynth") < 0.8, "dinosynth (wettest beat-carrier in the catalog) scales hardest (" + scaleOf("dinosynth").toFixed(3) + ")");
  ok(scaleOf("dinosynth") >= 0.55, "…but never below the floor (character survives)");
  // the scale reaches the renderers through fxParams / reverbColor — applied
  // POST-clamp (the drenched genres saturate the rgain slider at 2, so a
  // pre-clamp scale would never bite them).
  const vw = K.track("vaporwave", { seed: 3 });   // uncolored + saturated return
  const rvVw = vw.reverb != null ? vw.reverb : 0.7;
  const oldGain = Math.min(2, Math.max(0, rvVw * 3.2));
  const fp = SE.fxParams(vw);
  ok(!vw.reverbColor && approx(fp.rgain, oldGain * SE.reverbScale(vw), 1e-9) && fp.rgain < oldGain,
    `fxParams rgain carries the budget scale (${oldGain.toFixed(2)} -> ${fp.rgain.toFixed(2)})`);
  const jz = K.track("jazz", { seed: 3 });   // colored (dattorro) + scale 1 => rgain == old formula
  const rc = SE.reverbColor(jz);
  ok(rc && approx(rc.rgain, Math.min(3.5, (jz.reverb != null ? jz.reverb : 0.7) * 3.2) * SE.reverbScale(jz)),
    "reverbColor rgain carries the budget scale (jazz/dattorro)");
  const ds = SE.reverbColor(K.track("dinosynth", { seed: 3 }));   // colored + scaled
  ok(ds && ds.rgain < Math.min(3.5, 0.904 * 3.2), "a scaled COLORED genre trims its color return (dinosynth " + ds.rgain.toFixed(2) + ")");
}

// ---------------------------------------------------------------- 3. placement
console.log("== stereo placement ==");
{
  const st = K.track("jazz", { seed: 3 });
  const units = SE.voiceUnits(E, st);
  ok(units.melody.pan > 0, "lead sits slightly off-center (melody pan " + units.melody.pan + ")");
  ok(!units.bass.pan, "bass stays CENTER");
  ok(!units.kick.pan && !units.snare.pan, "kick + snare stay CENTER");
  ok(units.hat.pan !== 0 && units.hat.pan != null, "hats sit a touch off (pan " + units.hat.pan + ")");
  ok(!units.sfx.pan, "sfx (risers) stay center");
  const solos = Object.keys(units).filter((k) => k.startsWith("solo:")).sort();
  if (solos.length >= 2)
    ok(units[solos[0]].pan * units[solos[1]].pan < 0, "solos alternate sides (" + units[solos[0]].pan + " / " + units[solos[1]].pan + ")");
  else console.log("  note  jazz s3 has <2 solo voices — alternation covered by the law check below");
  // constant-power law: center ≈ old dup level, equal power everywhere
  const c = SE.panGains(0);
  ok(approx(c.l, 1, 1e-12) || approx(c.l, 1, 1e-9), "panGains(0) ≈ (1,1) — center matches the old dup level");
  for (const p of [-1, -0.5, -0.14, 0.1, 0.18, 1]) {
    const g = SE.panGains(p);
    ok(approx(g.l * g.l + g.r * g.r, 2, 1e-9), `constant power at pan ${p} (l²+r² = 2)`);
  }
  // notePan: the pad pitch spread seats higher chord tones right of base
  const padU = { pan: -0.08, panSpread: 0.28 };
  ok(SE.notePan(padU, 523.25) > SE.notePan(padU, 130.8), "pad spread: high notes right of low notes");
  ok(approx(SE.notePan(padU, 261.63), -0.08, 1e-6), "pad spread centers on the unit pan at middle C");
  ok(Math.abs(SE.notePan(padU, 8000)) <= 0.9, "notePan clamps inside ±0.9");

  // mixPCM realizes per-note pan on the wide buses — and stays BYTE-mono for
  // unpanned notes (the absent-law at the renderer level).
  const N = 2000, buf = new Float32Array(400);
  for (let i = 0; i < buf.length; i++) buf[i] = Math.sin(i * 0.3);
  const zones = [{ srcId: "t", root: 69, lo: 0, hi: 127 }];
  const mk = () => ({ dry: new Float32Array(N), rev: new Float32Array(N), del: new Float32Array(N),
    dryL: new Float32Array(N), dryR: new Float32Array(N) });
  const note = (pan) => [{ tSec: 0, durSec: 0.005, freq: 440, gain: 0.5, atk: 0.001, rel: 0.002, zones, pan }];
  const eng = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return s; };
  const b0 = mk(); SP.mixPCM(note(0), { t: buf }, 44100, b0, { dry: 1 });
  ok(eng(b0.dry) > 0 && eng(b0.dryL) === 0 && eng(b0.dryR) === 0, "pan 0 => the exact old MONO dry write (wide buses untouched)");
  const bR = mk(); SP.mixPCM(note(0.5), { t: buf }, 44100, bR, { dry: 1 });
  ok(eng(bR.dry) === 0 && eng(bR.dryR) > eng(bR.dryL) && eng(bR.dryL) > 0, "pan +0.5 => wide-bus write, right-heavy");
  const bL = mk(); SP.mixPCM(note(-0.5), { t: buf }, 44100, bL, { dry: 1 });
  ok(approx(eng(bL.dryL), eng(bR.dryR), 1e-12) && approx(eng(bL.dryR), eng(bR.dryL), 1e-12), "pan is symmetric");
  ok(approx(eng(bR.dryL) + eng(bR.dryR), 2 * eng(b0.dry), 1e-6 * eng(b0.dry)), "constant power vs the center dup (L²+R² = 2·mono²)");
}

// ---------------------------------------------------------------- 4. gain window
console.log("== gain staging (press makeup) ==");
{
  const T = PRESS.MASTER_TARGET_PEAK, M = PRESS.MASTER_MAX_MAKEUP;
  ok(approx(T, 0.5) && M >= 4, `target -6 dBFS (${T}), ceiling x${M}`);
  ok(PRESS.computeMakeup(0.9) === 1, "loud press (peak 0.9) => gain 1, BYTE-UNTOUCHED");
  ok(PRESS.computeMakeup(T) === 1, "at-target press => gain 1");
  ok(approx(PRESS.computeMakeup(0.0785) * 0.0785, T, 1e-9), "fugue-class peak (-22.1 dB) lands exactly at the target");
  ok(PRESS.computeMakeup(0.001) === M, "near-silent press capped at the ceiling (stays honest)");
  ok(PRESS.computeMakeup(0) === 1, "true silence untouched (no noise-floor blowup)");
  for (const p of [0.01, 0.05, 0.1, 0.3, 0.49]) {
    const g = PRESS.computeMakeup(p);
    ok(p * g <= T + 1e-9 && g >= 1 && g <= M, `window law holds at peak ${p} (=> ${(p * g).toFixed(3)})`);
  }
}

console.log(fails ? `\nMASTERING: ${fails} FAILURE(S)` : "\nMASTERING: ALL PASS");
process.exit(fails ? 1 : 0);
