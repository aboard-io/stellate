// wasm-audio.js — browser glue for running the generated CSD via Csound WASM.
// Loads @csound/browser from a CDN, decodes arbitrary audio URLs into WAVs that
// Csound's ftgen can read (via Web Audio decodeAudioData, so any browser-
// playable format works — mp3/ogg/wav/m4a), plays in real time, and renders
// offline to a downloadable WAV. Shared by builder.html and play.html.
//
// All audio is fetched client-side; nothing is stored. CORS applies — the
// Internet Archive sends permissive headers, arbitrary hosts may not.

(function (root) {
  "use strict";

  const CSOUND_CDN = "https://cdn.jsdelivr.net/npm/@csound/browser@6/+esm";
  const _wavCache = new Map(); // url -> Uint8Array (decoded mono WAV)
  let _audioCtx = null;
  function audioCtx() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return _audioCtx;
  }

  async function boot(options) {
    const mod = await import(/* webpackIgnore: true */ CSOUND_CDN);
    const Csound = mod.Csound || (mod.default && mod.default.Csound);
    if (!Csound) throw new Error("Could not load @csound/browser");
    const cs = await Csound();
    for (const o of (options || [])) await cs.setOption(o);
    return cs;
  }

  // 16-bit PCM mono WAV from a Float32Array
  function encodeWav(samples, sampleRate) {
    const n = samples.length;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const ws = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
    ws(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); ws(8, "WAVE");
    ws(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    ws(36, "data"); v.setUint32(40, n * 2, true);
    let off = 44;
    for (let i = 0; i < n; i++) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2;
    }
    return new Uint8Array(buf);
  }

  async function decodeUrlToWav(url) {
    if (_wavCache.has(url)) return _wavCache.get(url);
    const resp = await fetch(url, { mode: "cors" });
    if (!resp.ok) throw new Error("fetch " + resp.status + " for " + url);
    const arr = await resp.arrayBuffer();
    const audio = await audioCtx().decodeAudioData(arr.slice(0));
    const n = audio.length, ch = audio.numberOfChannels;
    const mono = new Float32Array(n);
    for (let c = 0; c < ch; c++) {
      const d = audio.getChannelData(c);
      for (let i = 0; i < n; i++) mono[i] += d[i] / ch;
    }
    const wav = encodeWav(mono, audio.sampleRate);
    _wavCache.set(url, wav);
    return wav;
  }

  // write each source's audio into Csound's virtual FS at found/<id>.wav
  async function writeFound(cs, sources, onStatus) {
    try { await cs.fs.mkdir("found"); } catch (e) { /* exists */ }
    for (const s of sources) {
      if (onStatus) onStatus("decoding " + (s.label || s.id) + "…");
      const wav = await decodeUrlToWav(s.url);
      await cs.fs.writeFile("found/" + s.id + ".wav", wav);
    }
  }

  function stripOptions(csd) {
    return csd.replace(/<CsOptions>[\s\S]*?<\/CsOptions>\s*/i, "");
  }

  let _live = null;
  async function play(csd, sources, onStatus) {
    await stopLive();
    if (onStatus) onStatus("booting Csound…");
    const cs = await boot(["-odac"]);
    await writeFound(cs, sources, onStatus);
    if (onStatus) onStatus("compiling…");
    const res = await cs.compileCsdText(stripOptions(csd));
    if (res !== 0 && res !== undefined && res !== null) {
      // some builds return 0 on success; non-zero -> surface
    }
    await cs.start();
    _live = cs;
    if (onStatus) onStatus("playing");
    return cs;
  }

  async function stopLive() {
    if (_live) {
      try { await _live.stop(); } catch (e) {}
      try { await _live.destroy && _live.destroy(); } catch (e) {}
      _live = null;
    }
  }

  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  // offline render -> WAV Blob. estSeconds bounds the wait if no event fires.
  async function render(csd, sources, estSeconds, onStatus) {
    if (onStatus) onStatus("booting (offline)…");
    const cs = await boot(["--nosound", "-o", "out.wav", "-W"]);
    await writeFound(cs, sources, onStatus);
    if (onStatus) onStatus("compiling…");
    await cs.compileCsdText(stripOptions(csd));
    let done;
    const ended = new Promise(r => { done = r; });
    try { cs.on && cs.on("renderEnded", () => done()); } catch (e) {}
    if (onStatus) onStatus("rendering…");
    await cs.start();
    await Promise.race([ended, delay(Math.max(3000, (estSeconds || 30) * 1000 + 4000))]);
    let bytes;
    try { bytes = await cs.fs.readFile("out.wav"); } catch (e) { bytes = null; }
    try { await cs.stop(); } catch (e) {}
    try { cs.destroy && (await cs.destroy()); } catch (e) {}
    if (!bytes || bytes.length < 64) throw new Error("render produced no audio");
    if (onStatus) onStatus("done");
    return new Blob([bytes], { type: "audio/wav" });
  }

  root.WasmAudio = { boot, play, stopLive, render, decodeUrlToWav, encodeWav, stripOptions };
})(window);
