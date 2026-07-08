// faust/all-sampled-test.js — SAMPLED-DEFAULT gate: the sampled render path.
//   node faust/all-sampled-test.js
//
// Sampled mode is now the DEFAULT (Paul, 2026-07: "I want anything to go here and
// be sampled by default. It's much better."). toState applies applySampledOnly to
// every emitted state; the PITCHED voices render from the SF2-derived sample
// library, but ONLY the pitched instrument source changes — the found layer,
// speech/vocoder and synth sfx/stab all play in the full mix. Signature synths
// (tb303/acid/reese/wobble/synclead/modeld/vocoder) stay pure synth. This gate
// proves it end to end:
//
//   A. STRUCTURE (cheap + precise — inspects SE.voiceUnits directly, no audio):
//      • default-ON: K.track(genre,{seed}) (no flag) carries sampledOnly+samplerLib
//      • every pitched unit is sampler-backed OR a signature-exempt synth; NO
//        non-signature Faust synth voice leaks through
//      • every drum voice is sampled; synth sfx/stab units ARE present (full mix)
//      • found beds/chops ARE emitted (the "round layer" is back)
//      • acidhouse keeps its tb303 (a real synth voice, not a sampler)
//      • escape hatch: K.track(genre,{synth:true}) is pure synth (no samplerLib)
//   B. AUDIO: press each genre (8s) and assert real, non-silent audio.
//   C. DETERMINISM: same seed -> byte-identical render (press twice, compare).
//
// Requires ffmpeg + found/samples/ (fetch scripts) + faust/node_modules.
"use strict";
const { execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const E = require("../engine/csd-engine.js");
const SE = require("../engine/faust/state-engine.js");
const K = require("../engine/genre-kernel.js");

const HERE = __dirname;
const ROOT = path.join(HERE, "..");
const PITCHED = (k) => k === "pad" || k === "bass" || k === "melody" || k.startsWith("solo:");
const results = [];
const check = (ok, name, detail) => { results.push({ ok, name, detail }); };

// ---- A. structure ---------------------------------------------------------
// SIGNATURE synths that forceSampled leaves as pure synth even in sampled mode:
// the Faust MODULE each signature recipe model resolves to (state-engine
// SIGNATURE_MODELS -> pitchedUnit). A pitched unit on one of these is NOT a leak.
const SIGNATURE_MODULES = new Set(["tb303", "bass_acid", "bass_reese", "bass_wobble", "synclead", "modeld", "robot_choir"]);
for (const [genre, seed] of [["jungle", 2], ["citypop", 7]]) {
  const st = K.track(genre, { seed });   // DEFAULT: no flag -> sampled
  check(st.sampledOnly === true && !!st.samplerLib, `${genre}: DEFAULT state carries sampledOnly + samplerLib`);
  const units = SE.voiceUnits(E, st);
  let pitchedN = 0, sampledN = 0, sigN = 0, leaks = [], drumN = 0, badDrum = [];
  for (const [key, u] of Object.entries(units)) {
    if (!u || u.__meta) continue;
    if (PITCHED(key)) {
      pitchedN++;
      if (u.sampler) sampledN++;
      else if (SIGNATURE_MODULES.has(u.module)) sigN++;   // signature synth — allowed
      else leaks.push(key + ":" + (u.module || "?"));      // a non-signature synth leak
    } else if (u.drum && (key === "kick" || key === "snare" || key === "hat" || key === "tom")) {
      drumN++; if (!u.sampler) badDrum.push(key + "(" + (u.module || "?") + ")");
    }
  }
  check(pitchedN >= 3 && leaks.length === 0, `${genre}: every pitched unit sampler-backed or signature-synth (${sampledN} sampled, ${sigN} signature of ${pitchedN})`, leaks.join(","));
  check(drumN === 4 && badDrum.length === 0, `${genre}: all 4 drum voices sampled`, badDrum.join(","));
  // FULL MIX: synth sfx/stab present, found beds/chops emitted (the round layer)
  check(!!units.stab && !!units.sfx, `${genre}: synth sfx/stab units present (full mix)`, [!units.stab && "stab-missing", !units.sfx && "sfx-missing"].filter(Boolean).join(","));
  const sched = SE.buildSchedule(E, st);
  check(sched.found.length > 0, `${genre}: found beds/chops present`, sched.found.length + " found events");
}

// acidhouse keeps its 303: the whole point of the signature exemption.
{
  const st = K.track("acidhouse", { seed: 7 });
  const units = SE.voiceUnits(E, st);
  const models = ["pad", "bass", "melody"].map((k) => (units[k] && units[k].module) || "?");
  const has303 = Object.values(units).some((u) => u && u.module === "tb303" && !u.sampler);
  check(has303, `acidhouse s7: renders a real tb303 voice (not a sampler)`, "pad/bass/melody=" + models.join("/"));
}

// escape hatch: {synth:true} -> the historical pure-synth default. On a
// synth-native genre (synthwave uses NO acoustic sampler recipe) forceSampled
// runs for none of the voices, so no pitched unit is sampler-backed. (Genres that
// natively pick model:"sampler" — citypop's sax — legitimately keep it even on
// the synth path; that IS the byte-for-byte old default, so we probe synthwave.)
{
  const st = K.track("synthwave", { synth: true, seed: 7 });
  check(!st.sampledOnly && !st.samplerLib, `synthwave {synth:true}: pure-synth (no sampledOnly/samplerLib)`);
  const units = SE.voiceUnits(E, st);
  const anySampler = Object.entries(units).some(([k, u]) => u && PITCHED(k) && u.sampler);
  check(!anySampler, `synthwave {synth:true}: no pitched voice sampler-backed`);
}

// ---- B + C. audio + determinism ------------------------------------------
function resolvePaths(state) {
  for (const s of state.foundSources) {
    s.fsPath = s.samplePath ? path.join(ROOT, s.samplePath) : path.join(ROOT, "found", s.id + ".wav");
    if (!fs.existsSync(s.fsPath)) { console.error(`missing ${s.fsPath} — run ./fetch-found-samples.sh`); process.exit(2); }
  }
}
function press(name, state) {
  state.foundSources = state.foundSources.filter((s) => s.id !== "tw_vocal");
  state.sections.forEach((s) => { if (s.vocal) delete s.vocal; });
  resolvePaths(state);
  const sj = path.join(os.tmpdir(), `allsamp_${name}.state.json`);
  const wav = path.join(os.tmpdir(), `allsamp_${name}.wav`);
  fs.writeFileSync(sj, JSON.stringify(state));
  execFileSync("node", [path.join(HERE, "..", "engine", "faust", "press.js"), sj, wav, "--dur", "8"], { stdio: ["ignore", "ignore", "inherit"], maxBuffer: 16 * 1024 * 1024 });
  try { fs.unlinkSync(sj); } catch (e) {}
  return wav;
}
function wavRms(file) {
  const buf = fs.readFileSync(file); let sum = 0, n = 0;
  for (let i = 44; i + 1 < buf.length; i += 2) { const v = buf.readInt16LE(i) / 32768; sum += v * v; n++; }
  return n ? Math.sqrt(sum / n) : 0;
}
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

for (const [genre, seed] of [["jungle", 2], ["citypop", 7]]) {
  const w1 = press(genre + "_a", K.track(genre, { seed }));
  const rms = wavRms(w1);
  check(fs.statSync(w1).size > 100000 && rms > 0.01, `${genre}: non-silent audio`, `rms=${rms.toFixed(4)}`);
  const w2 = press(genre + "_b", K.track(genre, { seed }));
  check(sha(w1) === sha(w2), `${genre}: deterministic (same seed -> byte-equal render)`);
}

// ---- report ---------------------------------------------------------------
let allOk = true;
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail && !r.ok ? "  [" + r.detail + "]" : ""}`);
  if (!r.ok) allOk = false;
}
console.log(allOk ? "\nALL PASS" : "\nFAILURES");
process.exit(allOk ? 0 : 1);
