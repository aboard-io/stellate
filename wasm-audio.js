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

  async function boot(options, audioContext) {
    const mod = await import(/* webpackIgnore: true */ CSOUND_CDN);
    const Csound = mod.Csound || (mod.default && mod.default.Csound);
    if (!Csound) throw new Error("Could not load @csound/browser");
    // Hand Csound our own (already-resumed) AudioContext for realtime, and use
    // the ScriptProcessor backend (useSPN) — the most compatible path on a plain
    // HTTPS host (no COOP/COEP / SharedArrayBuffer needed). Offline passes none.
    const cs = await Csound(audioContext ? { audioContext, useSPN: true } : undefined);
    for (const o of (options || [])) await cs.setOption(o);
    return cs;
  }
  function ctxState(){ return _audioCtx ? _audioCtx.state : "none"; }

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
    // CRITICAL: resume the AudioContext synchronously, inside the click's
    // user-gesture window, BEFORE any await — otherwise it stays suspended
    // through the async boot/decode and no audio ever comes out.
    const ctx = audioCtx();
    try { ctx.resume(); } catch (e) {}
    await stopLive();
    if (onStatus) onStatus("booting Csound…");
    const cs = await boot(["-odac"], ctx);
    await writeFound(cs, sources, onStatus);
    if (onStatus) onStatus("compiling…");
    await cs.compileCsdText(stripOptions(csd));
    await cs.start();
    try { if (ctx.state !== "running") await ctx.resume(); } catch (e) {}
    _live = cs;
    if (onStatus) onStatus(ctx.state === "running" ? "playing" : "playing (audio suspended — click again)");
    return cs;
  }

  async function stopLive() {
    if (_live) {
      const c = _live; _live = null;
      try { await c.stop(); } catch (e) {}
      try { if (c.destroy) await c.destroy(); } catch (e) {}
    }
  }

  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  // offline render -> WAV Blob. Tears down any live instance first — Csound WASM
  // does not tolerate two concurrent instances (that was the OOB crash).
  async function render(csd, sources, estSeconds, onStatus) {
    await stopLive();
    if (onStatus) onStatus("booting (offline)…");
    const cs = await boot(["--nosound", "-W", "--output=render.wav"]);
    _live = cs;
    await writeFound(cs, sources, onStatus);
    if (onStatus) onStatus("compiling…");
    await cs.compileCsdText(stripOptions(csd));
    if (onStatus) onStatus("rendering…");
    await cs.start();
    // Poll the output until it stops growing (offline render finished writing),
    // then stop() to finalize the WAV header and read it. renderEnded doesn't
    // fire reliably here, and start() may not resolve at score end.
    const cap = Math.max(15000, (estSeconds || 30) * 1000 + 6000);
    const t0 = Date.now(); let last = -1, stable = 0;
    while (Date.now() - t0 < cap) {
      await delay(400);
      let n = 0; try { const b = await cs.fs.readFile("render.wav"); n = b ? b.length : 0; } catch (e) {}
      if (n > 1000 && n === last) { if (++stable >= 2) break; } else { stable = 0; last = n; }
    }
    try { await cs.stop(); } catch (e) {}
    await delay(150);
    let bytes = null; try { bytes = await cs.fs.readFile("render.wav"); } catch (e) {}
    _live = null; try { if (cs.destroy) await cs.destroy(); } catch (e) {}
    if (!bytes || bytes.length < 64) throw new Error("render produced no audio");
    if (onStatus) onStatus("done");
    return new Blob([bytes], { type: "audio/wav" });
  }

  root.WasmAudio = { boot, play, stopLive, render, decodeUrlToWav, encodeWav, stripOptions, ctxState };
})(window);
