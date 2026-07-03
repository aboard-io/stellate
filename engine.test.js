// engine.test.js — faust-press smoke test: real offline renders, non-silence gates.
//   node engine.test.js
//
// The old csound render matrix (every progression/key/melody through the csound
// CLI) lives on branch legacy-csound. Post FAUST-PORT phase 3 this verifies the
// one true render path — faust/press.js over the same buildEvents states — by
// pressing three very different states and asserting real audio came out.
// Requires: ffmpeg, found/ + found/samples/ (fetch scripts), faust/node_modules.
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const E = require("./csd-engine.js");
const K = require("./genre-kernel.js");

const HERE = __dirname;
const DUR = 24;   // seconds pressed per state — enough for drums+bass+found to enter

function resolvePaths(state) {
  for (const s of state.foundSources) {
    s.fsPath = s.fsPath || (s.samplePath ? path.join(HERE, s.samplePath) : path.join(HERE, "found", s.id + ".wav"));
    if (!fs.existsSync(s.fsPath)) {
      console.error(`missing ${s.fsPath} — run ./fetch-found-sound.sh / ./fetch-found-samples.sh`);
      process.exit(2);
    }
  }
}

function wavRms(file) {
  const buf = fs.readFileSync(file);
  let sum = 0, n = 0;
  for (let i = 44; i + 1 < buf.length; i += 2) { const v = buf.readInt16LE(i) / 32768; sum += v * v; n++; }
  return n ? Math.sqrt(sum / n) : 0;
}

function press(name, state) {
  // strip render-time extras the smoke test doesn't need
  state.foundSources = state.foundSources.filter((s) => s.id !== "tw_vocal");
  state.sections.forEach((s) => { if (s.vocal) delete s.vocal; });
  resolvePaths(state);
  const sj = path.join(os.tmpdir(), `eng_${name}.state.json`);
  const wav = path.join(os.tmpdir(), `eng_${name}.wav`);
  fs.writeFileSync(sj, JSON.stringify(state));
  try {
    execFileSync("node", [path.join(HERE, "faust", "press.js"), sj, wav, "--dur", String(DUR)],
      { stdio: ["ignore", "ignore", "pipe"] });
  } catch (e) {
    console.log(`FAIL  ${name.padEnd(22)} press error: ${String(e.stderr || e.message).slice(0, 160)}`);
    return false;
  }
  const sz = fs.existsSync(wav) ? fs.statSync(wav).size : 0;
  const rms = sz > 1000 ? wavRms(wav) : 0;
  const ok = sz > 100000 && rms > 0.01;   // real, non-silent audio
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(22)} wav=${(sz / 1024 | 0)}KB rms=${rms.toFixed(4)}`);
  return ok;
}

let allOk = true;

// 1) the committed default song (royal road, tokyo bed) — engine's own state
{
  const s = E.defaultState();   // ids tokyo/tsukiji/asakusa all map to the one real local wav
  s.foundSources.forEach((f) => { f.fsPath = path.join(HERE, "found", "tokyo_station.wav"); });
  allOk = press("default_song", s) && allOk;
}

// 2) a break-chop genre — slice scheduling + jungle kit + local samples
allOk = press("jungle_s2", K.track("jungle", { seed: 2 })) && allOk;

// 3) a voice-led genre — granular bed layer + quiet boombap (the spokenword path)
allOk = press("spokenword_s3", K.track("spokenword", { seed: 3 })) && allOk;

console.log(allOk ? "\nALL PASS" : "\nFAILURES");
process.exit(allOk ? 0 : 1);
