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
const E = require("../engine/csd-engine.js");
const K = require("../engine/genre-kernel.js");

const HERE = __dirname;
const QUICK = process.argv.includes("--quick");
const DUR = QUICK ? 8 : 24;   // seconds pressed per state — enough for drums+bass+found to enter

function resolvePaths(state) {
  for (const s of state.foundSources) {
    if (s.synthText) continue;   // SPEECH organ source: no file — press.js synthesizes it
    // beds carry the bitrate in the name; fall back through the pre-rename
    // names so a partially-converted found/ tree still renders.
    s.fsPath = s.fsPath || (s.samplePath ? path.join(HERE, "..", s.samplePath)
      : [".64.mp3", ".mp3", ".wav"].map(e => path.join(HERE, "..", "found", s.id + e)).find(fs.existsSync)
        || path.join(HERE, "..", "found", s.id + ".64.mp3"));
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
    execFile("node", [path.join(HERE, "..", "engine", "faust", "press.js"), sj, wav, "--dur", String(DUR)],
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
    const RC = require("../engine/faust/render-core.js");
    const src = fs.readFileSync(path.join(HERE, "..", "engine", "faust", "press.js"), "utf8");
    const ok = typeof RC.renderUnit === "function" && typeof RC.mergeIvals === "function"
      && src.includes("render-core.js") && src.includes("RC.renderUnit(");
    presses.push(Promise.resolve({ ok, line: `${ok ? "PASS" : "FAIL"}  ${"render_core_wired".padEnd(22)} press.js drives faust/render-core.js` }));
  }

  // 0b) PARAM-ROOT ADDRESSABILITY (2026-07-26, the Pure-FM drone). Every host
  // addresses a module's params as "/" + rootOf(module) + "/" + name. rootOf
  // used to return the DECLARED name, which silently diverges from the real UI
  // path root whenever a dsp wraps its interface in a top-level group — as
  // dx7.lib's dx.algorithm() does ("/DX7/freq", not "/dx7_alg22/freq"). Every
  // freq/gate write for every FM voice went to a path faustwasm does not know
  // and was dropped, for as long as the dx7 modules have existed. Structural,
  // pure JSON, milliseconds: for each compiled artifact, the root render-core
  // derives must actually prefix that module's addresses.
  {
    const RC = require("../engine/faust/render-core.js");
    const dist = path.join(HERE, "..", "engine", "faust", "dist");
    const addressesOf = (node, out) => {
      if (!node) return out;
      if (node.address) out.push(node.address);
      for (const it of (node.items || [])) addressesOf(it, out);
      return out;
    };
    const bad = [];
    let checked = 0;
    for (const f of fs.readdirSync(dist).filter((x) => x.endsWith("-meta.json"))) {
      const json = fs.readFileSync(path.join(dist, f), "utf8");
      const addrs = addressesOf({ items: JSON.parse(json).ui || [] }, []);
      if (!addrs.length) continue;   // paramless module
      const pre = "/" + RC.paramRoot(json) + "/";
      const off = addrs.filter((a) => a.indexOf(pre) !== 0);
      checked++;
      if (off.length) bad.push(`${f}: root ${pre} misses ${off[0]}`);
    }
    const ok = checked > 0 && !bad.length;
    presses.push(Promise.resolve({ ok, line: `${ok ? "PASS" : "FAIL"}  ${"param_root_addressable".padEnd(22)} ${checked} dist modules, ${bad.length} unaddressable${bad.length ? " (" + bad[0] + ")" : ""}` }));
  }

  // 0c) FM VOICES ANSWER TO PITCH. The structural gate above proves the root is
  // right on paper; this proves the write lands: one dx7 proc, gated at two
  // different freqs through the real mkProc/rootOf pair, must produce DIFFERENT
  // audio. Under the drone both renders were bit-identical (the freq write was
  // dropped and the ungated EG sat at its instantiation tail).
  presses.push((async () => {
    const name = "dx7_pitch_answers";
    try {
      const PRESS = require("../engine/faust/press.js");
      const mk = async (freq) => {   // mkProc first: rootOf reads the cached factory
        const proc = await PRESS.mkProc("dx7_alg5");
        const pre = "/" + PRESS.rootOf("dx7_alg5") + "/";
        proc.setParamValue(pre + "freq", freq);
        proc.setParamValue(pre + "gate", 1);
        let e = 0;
        const out = [];
        for (let i = 0; i < 300; i++) { const o = proc.render([], 64)[0]; for (let q = 0; q < 64; q++) { e += o[q] * o[q]; out.push(o[q]); } }
        return { rms: Math.sqrt(e / out.length), pcm: out };
      };
      const a = await mk(220), b = await mk(660);
      let diff = 0;
      for (let i = 0; i < a.pcm.length; i++) diff = Math.max(diff, Math.abs(a.pcm[i] - b.pcm[i]));
      const ok = a.rms > 0.01 && b.rms > 0.01 && diff > 1e-3;
      return { ok, line: `${ok ? "PASS" : "FAIL"}  ${name.padEnd(22)} gated rms ${a.rms.toFixed(3)}/${b.rms.toFixed(3)}, A220-vs-A660 maxΔ ${diff.toExponential(1)}` };
    } catch (err) {
      return { ok: false, line: `FAIL  ${name.padEnd(22)} ${String(err && err.message || err).slice(0, 120)}` };
    }
  })());

  // 1) the committed default song (royal road, tokyo bed) — engine's own state
  {
    const s = E.defaultState();   // ids tokyo/tsukiji/asakusa all map to the one real local wav
    s.foundSources.forEach((f) => { f.fsPath = path.join(HERE, "..", "found", "tokyo_station.64.mp3"); });
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
