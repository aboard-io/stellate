// speech.js — the SPEECH organ: deterministic text-to-speech over the vendored
// espeak-ng WASM artifact (vendor/espeak-ng/ — the trimmed English-only build,
// GPL-3.0, see its README + the repo NOTICE). Shared by the browser live path
// (found-player synthToBuffer -> live.js) and the node press (press.js
// decodeInputs), so a foundSource that carries `synthText` instead of a
// samplePath hears the SAME utterance on both engines.
//
// THE DETERMINISM MODEL of this artifact (vendor/espeak-ng/README.md, proved
// by prove.js + prove-browser.js): espeak_ng_SetRandSeed is NOT exported by
// this build and espeak's wavegen consumes libc rand() for voicing noise, so
// repeat synthesis on ONE instance is NOT byte-identical (even sample counts
// drift). What IS guaranteed: a FRESH module instance replaying the same call
// sequence produces byte-identical PCM, across runs AND across runtimes (node
// and Chromium hash the same). So synth() builds a FRESH module + worker per
// utterance and NEVER reuses one — that is the law of the artifact, not an
// optimization choice. Calls serialize through a single-flight queue: one wasm
// instance alive at a time (bounded memory, and the per-instance call sequence
// stays exactly "set_voice, set_pitch, set_rate, synthesize(text)").
//
// UMD like namebank.js (node require -> module.exports; browser classic
// script -> window.CsdSpeech). The vendored glue is an ES MODULE (its baked-in
// locateFile resolves espeak-ng.data next to the glue via import.meta.url), so
// it is loaded LAZILY via dynamic import() — legal from CJS node AND from a
// classic browser script — and the ~1.7MB wasm+data cost nothing until the
// first synthText source actually arms.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.CsdSpeech = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const SR = 44100;              // output rate (the engine's one true SR)
  const ESPEAK_SR = 22050;       // the artifact's fixed synthesis rate
  const TARGET_PEAK = 0.89;      // light peak-normalize target (~ -1 dBFS)
  const MAX_GAIN = 4;            // "light": never haul silence up more than +12 dB

  const IS_NODE = typeof module !== "undefined" && !!module.exports &&
    typeof require === "function" && typeof __dirname !== "undefined";

  // the glue's URL, resolved ONCE at load:
  //   node    file:// URL beside this file: ../vendor/espeak-ng/espeak-ng.js
  //   browser relative to THIS script's src (engine/speech.js -> site root ->
  //           vendor/espeak-ng/espeak-ng.js — the live.js SITE derivation), so
  //           the app works from any mount point (aboardresearch.com/projects/…);
  //           falls back to page-relative when currentScript is unavailable.
  const GLUE_URL = (() => {
    if (IS_NODE) {
      const path = require("path"), url = require("url");
      return url.pathToFileURL(path.join(__dirname, "..", "vendor", "espeak-ng", "espeak-ng.js")).href;
    }
    try {
      if (typeof document !== "undefined" && document.currentScript && document.currentScript.src)
        return new URL("../vendor/espeak-ng/espeak-ng.js", document.currentScript.src).href;
    } catch (e) {}
    return (typeof location !== "undefined")
      ? new URL("vendor/espeak-ng/espeak-ng.js", location.href).href
      : "vendor/espeak-ng/espeak-ng.js";
  })();

  // ---- canonical options + cache key -------------------------------------
  const DEF = { voice: "en-us", pitch: 50, speed: 175 };
  function normOpts(o) {
    o = o || {};
    return {
      voice: o.voice || DEF.voice,
      variant: o.variant || "",   // espeak !v variant, e.g. "f3" -> "en-us+f3"
      pitch: o.pitch != null ? Math.round(o.pitch) : DEF.pitch,
      speed: o.speed != null ? Math.round(o.speed) : DEF.speed,
    };
  }
  // the ONE cache key every consumer shares (found-player's url-keyed buffer
  // cache, press-side memoization, the headless gate's window.__SPEECH.keys):
  //   "speech:v=en-us;p=50;s=175;<text>"  (variant rides the voice: en-us+f3)
  function key(text, opts) {
    const n = normOpts(opts);
    return "speech:v=" + n.voice + (n.variant ? "+" + n.variant : "") +
      ";p=" + n.pitch + ";s=" + n.speed + ";" + String(text);
  }

  // ---- artifact reachability (never throws) -------------------------------
  let _avail = null;
  function available() {
    if (_avail) return _avail;
    _avail = (async () => {
      try {
        if (IS_NODE) {
          const fs = require("fs"), path = require("path");
          const dir = path.join(__dirname, "..", "vendor", "espeak-ng");
          return fs.existsSync(path.join(dir, "espeak-ng.js")) &&
                 fs.existsSync(path.join(dir, "espeak-ng.data"));
        }
        if (typeof fetch !== "function") return false;
        const r = await fetch(GLUE_URL, { method: "HEAD" });
        return !!(r && r.ok);
      } catch (e) { return false; }
    })();
    return _avail;
  }

  // ---- EXACT 2:1 upsampler, 22050 -> 44100 --------------------------------
  // Midpoint linear interpolation done in the INT16 domain:
  //   out[2i] = x[i];  out[2i+1] = (x[i] + x[i+1]) / 2;  out[2N-1] = x[N-1].
  // WHY this is byte-stable everywhere: the midpoint of two int16s is an
  // integer or integer+0.5 — both exactly representable in float32 (needs at
  // most 17 mantissa bits of float32's 24) — and the later /32768 scale is a
  // power of two, also exact. No resampler state, no windowed sinc, no
  // platform-dependent rounding: the same Int16 input yields the same Float32
  // bytes in node and every browser. (Sonically a midpoint interpolator is a
  // gentle lowpass at the top octave — right for telephone-band PA speech.)
  // The final sample HOLDS (espeak utterances end in silence anyway).
  function up2(x) {
    const N = x.length, out = new Float32Array(N * 2);
    for (let i = 0; i < N - 1; i++) {
      out[2 * i] = x[i];
      out[2 * i + 1] = (x[i] + x[i + 1]) / 2;
    }
    if (N > 0) { out[2 * N - 2] = x[N - 1]; out[2 * N - 1] = x[N - 1]; }
    return out;
  }

  // ---- one utterance on one FRESH instance --------------------------------
  async function synthOnce(text, n) {
    const mod = await import(/* the vendored ESM glue */ GLUE_URL);
    const m = await mod.default();          // FRESH module: mounts espeak-ng.data
    const w = new m.eSpeakNGWorker();       // FRESH worker — the determinism law
    try {
      const name = n.voice + (n.variant ? "+" + n.variant : "");
      const rc = w.set_voice(name, "en", 0, 0);
      if (rc !== 0) throw new Error("espeak set_voice(" + name + ") rc " + rc);
      w.set_pitch(n.pitch);
      w.set_rate(n.speed);
      if (w.get_samplerate() !== ESPEAK_SR)
        throw new Error("espeak samplerate " + w.get_samplerate() + " != " + ESPEAK_SR);
      const chunks = [];
      w.synthesize(String(text), (samples) => {
        if (samples && samples.length > 0) chunks.push(samples.slice());
        return false;                       // falsy = continue synthesis
      });
      let total = 0; for (const c of chunks) total += c.length;
      const pcm16 = new Int16Array(total);
      let o = 0; for (const c of chunks) { pcm16.set(c, o); o += c.length; }

      const up = up2(pcm16);                // int16-domain floats, 2x length
      // light peak normalize to a FIXED target: gain is a pure function of the
      // integer peak (midpoints never exceed their neighbors, so the upsampled
      // peak IS the int16 peak) — deterministic, no adaptive per-machine math.
      let peak = 0;
      for (let i = 0; i < pcm16.length; i++) {
        const v = pcm16[i]; if (v > peak) peak = v; else if (-v > peak) peak = -v;
      }
      const g = (peak > 0 ? Math.min(MAX_GAIN, TARGET_PEAK * 32768 / peak) : 1) / 32768;
      const out = new Float32Array(up.length);
      for (let i = 0; i < up.length; i++) out[i] = up[i] * g;
      return { pcm: out, sr: SR };
    } finally {
      try { if (w.__destroy__) w.__destroy__(); } catch (e) {}
    }
  }

  // ---- single-flight queue -------------------------------------------------
  // One instance at a time: serializes memory (each utterance inits its own
  // ~few-MB wasm heap) and keeps every instance's call sequence canonical. A
  // failed synth must not wedge the queue (the tail swallows, callers see the
  // rejection on their own handle).
  let _q = Promise.resolve();
  function synth(text, opts) {
    const n = normOpts(opts);
    const job = _q.then(() => synthOnce(text, n));
    _q = job.then(() => undefined, () => undefined);
    return job.then((r) => {
      // headless-verification hook: the browser gate (test/browser/speech-live.test.js)
      // reads window.__SPEECH to prove a synthText source really synthesized.
      if (typeof window !== "undefined") {
        const S = window.__SPEECH || (window.__SPEECH = { synths: 0, keys: [] });
        S.synths++; S.keys.push(key(text, n));
      }
      return r;
    });
  }

  return { SR, available, synth, key,
    // exposed for direct tests (the FP._mixGrains pattern)
    _up2: up2, _normOpts: normOpts, _GLUE_URL: GLUE_URL };
});
