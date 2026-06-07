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
    if (!_audioCtx || _audioCtx.state === "closed") {
      const AC = window.AudioContext || window.webkitAudioContext;
      // match the CSD's sr=44100 so Csound's output isn't resampled/mismatched
      try { _audioCtx = new AC({ sampleRate: 44100, latencyHint: "interactive" }); }
      catch (e) { _audioCtx = new AC(); }
    }
    return _audioCtx;
  }

  async function boot(options, audioContext) {
    const mod = await import(/* webpackIgnore: true */ CSOUND_CDN);
    const Csound = mod.Csound || (mod.default && mod.default.Csound);
    if (!Csound) throw new Error("Could not load @csound/browser");
    // Hand Csound our own (already-resumed) AudioContext for realtime: the
    // single-thread worklet connects to its destination and (unlike SPN) does
    // NOT close a provided context on teardown, so it survives replays.
    const cs = await Csound(audioContext ? { audioContext } : undefined);
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

  // syncgrain only needs a window of the recording, so trim to this many seconds
  // after decode — shrinks the WAV encode and the Csound ftgen table load ~4x.
  const FOUND_MAX_SECONDS = 45;
  const FOUND_CHUNK_BYTES = 1024 * 1024;   // ~1MB ≈ a minute+ of mp3/ogg

  // Fetch only the first chunk via a Range request; fall back to the whole file
  // if the host ignores Range or the truncated stream won't decode.
  async function fetchAudioBytes(url) {
    try {
      const r = await fetch(url, { mode: "cors", headers: { Range: "bytes=0-" + (FOUND_CHUNK_BYTES - 1) } });
      if (r.status === 206 || r.ok) return { buf: await r.arrayBuffer(), partial: r.status === 206 };
    } catch (e) { /* CORS/preflight on Range failed — fall through */ }
    const r2 = await fetch(url, { mode: "cors" });
    if (!r2.ok) throw new Error("fetch " + r2.status + " for " + url);
    return { buf: await r2.arrayBuffer(), partial: false };
  }

  // persistent cache of decoded WAVs across reloads (IndexedDB, not localStorage,
  // which is string-only and ~5MB — these trimmed WAVs are a few MB each).
  const DB_NAME = "vaporwave-found", STORE = "wav";
  function idbOpen(){ return new Promise((res, rej) => {
    try { const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    } catch (e) { rej(e); } }); }
  async function idbGet(key){ try { const db = await idbOpen(); return await new Promise(res => {
    const q = db.transaction(STORE,"readonly").objectStore(STORE).get(key);
    q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch (e) { return null; } }
  async function idbSet(key, val){ try { const db = await idbOpen(); await new Promise(res => {
    const q = db.transaction(STORE,"readwrite").objectStore(STORE).put(val, key);
    q.onsuccess = () => res(); q.onerror = () => res(); }); } catch (e) {} }

  // returns a Promise<Uint8Array>; the promise is cached so concurrent callers
  // (prewarm + a Play click) share one fetch/decode instead of racing.
  function decodeUrlToWav(url) {
    if (_wavCache.has(url)) return _wavCache.get(url);
    const job = (async () => {
      const cached = await idbGet(url);
      if (cached) return cached instanceof Uint8Array ? cached : new Uint8Array(cached);
      let { buf, partial } = await fetchAudioBytes(url);
      let audio;
      try {
        audio = await audioCtx().decodeAudioData(buf.slice(0));
      } catch (e) {
        if (!partial) throw e;               // already had the whole file; genuine decode error
        const r = await fetch(url, { mode: "cors" });  // chunk wouldn't decode → get it all
        buf = await r.arrayBuffer();
        audio = await audioCtx().decodeAudioData(buf.slice(0));
      }
      const ch = audio.numberOfChannels;
      const n = Math.min(audio.length, Math.floor(audio.sampleRate * FOUND_MAX_SECONDS));
      const mono = new Float32Array(n);
      for (let c = 0; c < ch; c++) {
        const d = audio.getChannelData(c);
        for (let i = 0; i < n; i++) mono[i] += d[i] / ch;
      }
      const wav = encodeWav(mono, audio.sampleRate);
      idbSet(url, wav);                       // persist for next reload
      return wav;
    })();
    _wavCache.set(url, job);
    job.catch(() => _wavCache.delete(url));   // don't cache failures
    return job;
  }
  // pre-decode sources in the background so the first Play is instant
  async function prewarm(sources) {
    for (const s of (sources || [])) { try { await decodeUrlToWav(s.url); } catch (e) {} }
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

  let _live = null, _liveTimer = null, _liveAbort = false;
  const _liveLog = [];
  function liveSend(cs, msg){ try { cs.inputMessage(msg); } catch (e) {} if (_liveLog.length < 500) _liveLog.push(msg); }

  // ---- LIVE mode: schedule each section just-in-time, reading current state ----
  // so edits to not-yet-played sections take effect when they play. Csound is
  // kept alive with `f 0`; events use absolute score time (seconds, no t-tempo).
  function injectSection(cs, st, idx, startBeat, spb, E){
    const one = Object.assign({}, st, { sections:[ st.sections[idx] ] });
    const ev = E.buildEvents(one);
    const I={pad:1,bass:2,melody:4}, D={kick:10,snare:11,hat:12};
    const at=(b)=>((startBeat+b)*spb).toFixed(3), du=(d)=>(d*spb).toFixed(3);
    ev.found.forEach(f=>liveSend(cs,`i 3 ${at(f.beat)} ${du(f.dur)} 0 ${f.amp} ${f.tableNum} ${f.pitch} ${f.stretch}`));
    ev.pitched.forEach(p=>liveSend(cs,`i ${I[p.voice]} ${at(p.beat)} ${du(p.dur)} ${p.pch} ${p.amp.toFixed(4)}`));
    ev.drums.forEach(d=>liveSend(cs,`i ${D[d.drum]} ${at(d.beat)} ${du(d.dur)} ${d.amp.toFixed(4)}`));
    ev.sfx.forEach(s=>liveSend(cs,`i 20 ${at(s.beat)} ${du(s.dur)} ${s.type} ${s.amp}`));
  }
  async function playLive(getState, sources, onStatus){
    const E = root.CsdEngine; if(!E) throw new Error("engine missing");
    const ctx = audioCtx(); try { ctx.resume(); } catch(e){}
    await stopLive();
    _liveAbort = false; _liveLog.length = 0;
    const st0 = getState();
    if(onStatus) onStatus("booting Csound…");
    const cs = await boot(["-odac"], ctx);
    _live = cs;
    await writeFound(cs, sources, onStatus);
    if(onStatus) onStatus("compiling…");
    const orc = stripOptions(E.buildCsd(st0)).replace(/<CsScore>[\s\S]*?<\/CsScore>/, "<CsScore>\nf 0 360000\n</CsScore>");
    await cs.compileCsdText(orc);
    await cs.start();
    try { if(ctx.state!=="running") await ctx.resume(); } catch(e){}
    liveSend(cs,"i 98 0 360000"); liveSend(cs,"i 99 0 360000"); liveSend(cs,"i 100 0 360000");
    if(onStatus) onStatus(ctx.state==="running" ? "playing (live)" : "playing (tap again if silent)");
    let scheduled = 0;
    const tick = async () => {
      if(_liveAbort || _live!==cs) return;
      const st = getState();
      const prg = E.PROGRESSIONS[st.progression] || E.PROGRESSIONS.royal_road;
      const cycleBeats = prg.chords.length*8, spb = 60/st.bpm;
      const starts=[]; let cur=0;
      for(const sec of st.sections){ starts.push(cur); cur += (sec.cycles||1)*cycleBeats; }
      let t=0; try { t = await cs.getScoreTime(); } catch(e){}
      while(scheduled < st.sections.length && starts[scheduled]*spb <= t + 1.5){
        injectSection(cs, st, scheduled, starts[scheduled], spb, E);
        scheduled++;
      }
      if(scheduled >= st.sections.length && t > cur*spb + 5){ stopLive(); if(onStatus) onStatus("done"); return; }
      _liveTimer = setTimeout(tick, 150);
    };
    tick();
    return cs;
  }

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
    _liveAbort = true;
    if (_liveTimer) { clearTimeout(_liveTimer); _liveTimer = null; }
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

  root.WasmAudio = { boot, play, playLive, stopLive, render, decodeUrlToWav, encodeWav, stripOptions, ctxState, prewarm, _liveLog };
})(window);
