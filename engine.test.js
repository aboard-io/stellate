// engine.test.js — faust-press smoke test: real offline renders, non-silence gates.
//   node engine.test.js [--quick]
//
// The old csound render matrix (every progression/key/melody through the csound
// CLI) lives on branch legacy-csound. Post FAUST-PORT phase 3 this verifies the
// one true render path — faust/press.js over the same buildEvents states — by
// pressing three very different states and asserting real audio came out.
// The three presses run CONCURRENTLY (independent child processes, one core
// each); result lines print in a fixed order once all land. --quick presses
// 8s instead of 24s — enough for the kit and bed to prove non-silence — and is
// what verify.sh's fast loop uses; the full 24s stays the pre-ship gate.
// Requires: ffmpeg, found/ + found/samples/ (fetch scripts), faust/node_modules.
"use strict";
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const E = require("./csd-engine.js");
const K = require("./genre-kernel.js");

const HERE = __dirname;
const QUICK = process.argv.includes("--quick");
const DUR = QUICK ? 8 : 24;   // seconds pressed per state — enough for drums+bass+found to enter

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
  return new Promise((resolve) => {
    execFile("node", [path.join(HERE, "faust", "press.js"), sj, wav, "--dur", String(DUR)],
      { maxBuffer: 16 * 1024 * 1024 }, (err, _stdout, stderr) => {
        if (err) {
          resolve({ ok: false, line: `FAIL  ${name.padEnd(22)} press error: ${String(stderr || err.message).slice(0, 160)}` });
          return;
        }
        const sz = fs.existsSync(wav) ? fs.statSync(wav).size : 0;
        const rms = sz > 1000 ? wavRms(wav) : 0;
        const ok = sz > 100000 && rms > 0.01;   // real, non-silent audio
        resolve({ ok, line: `${ok ? "PASS" : "FAIL"}  ${name.padEnd(22)} wav=${(sz / 1024 | 0)}KB rms=${rms.toFixed(4)}` });
      });
  });
}

(async () => {
  const presses = [];

  // 0) render-core guard (ZERO-STATIC Stage 3 prereq): the per-unit walk was
  // extracted to faust/render-core.js under a byte-parity gate — assert press
  // still routes through it (so the RMS gates below exercise the shared loop;
  // re-proving byte parity every run would double render time, so we don't).
  {
    const RC = require("./faust/render-core.js");
    const src = fs.readFileSync(path.join(HERE, "faust", "press.js"), "utf8");
    const ok = typeof RC.renderUnit === "function" && typeof RC.mergeIvals === "function"
      && src.includes("render-core.js") && src.includes("RC.renderUnit(");
    presses.push(Promise.resolve({ ok, line: `${ok ? "PASS" : "FAIL"}  ${"render_core_wired".padEnd(22)} press.js drives faust/render-core.js` }));
  }

  // 1) the committed default song (royal road, tokyo bed) — engine's own state
  {
    const s = E.defaultState();   // ids tokyo/tsukiji/asakusa all map to the one real local wav
    s.foundSources.forEach((f) => { f.fsPath = path.join(HERE, "found", "tokyo_station.wav"); });
    presses.push(press("default_song", s));
  }

  // 2) a break-chop genre — slice scheduling + jungle kit + local samples
  presses.push(press("jungle_s2", K.track("jungle", { seed: 2 })));

  // 3) a voice-led genre — granular bed layer + quiet boombap (the spokenword path)
  presses.push(press("spokenword_s3", K.track("spokenword", { seed: 3 })));

  const results = await Promise.all(presses);
  results.forEach((r) => console.log(r.line));
  const allOk = results.every((r) => r.ok);
  console.log(allOk ? "\nALL PASS" : "\nFAILURES");
  process.exit(allOk ? 0 : 1);
})();
