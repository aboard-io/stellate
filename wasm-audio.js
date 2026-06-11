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
  // the SAMPLE POOL: decode a whole list (urls or site-relative paths) up front,
  // with progress — cached in memory + IndexedDB, so it persists across visits
  async function prewarmPool(urls, onProgress) {
    let done = 0, ok = 0;
    for (const u of (urls || [])) {
      try { await decodeUrlToWav(u); ok++; } catch (e) {}
      done++;
      if (onProgress) onProgress(done, urls.length, ok);
    }
    return ok;
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
  // NOTE: csound inputMessage schedules p2 as a delay FROM NOW (not absolute
  // score time), so we send p2 = eventAbsoluteSeconds - currentScoreTime(now).
  function injectSection(cs, st, idx, startBeat, spb, E, now){
    const one = Object.assign({}, st, { sections:[ st.sections[idx] ] });
    const ev = E.buildEvents(one);
    const I={pad:1,bass:2,melody:4}, D={kick:10,snare:11,hat:12};
    const at=(b)=>Math.max(0.01,(startBeat+b)*spb - now).toFixed(3), du=(d)=>(d*spb).toFixed(3);
    ev.found.forEach(f=>liveSend(cs,`i 3 ${at(f.beat)} ${du(f.dur)} 0 ${f.amp} ${f.tableNum} ${f.pitch} ${f.stretch} ${f.cutoff}`));
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
    const cs = await boot(["-odac","-m0","-d"], ctx);
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
        injectSection(cs, st, scheduled, starts[scheduled], spb, E, t);
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
    const cs = await boot(["-odac","-m0","-d"], ctx);
    await writeFound(cs, sources, onStatus);
    if (onStatus) onStatus("compiling…");
    await cs.compileCsdText(stripOptions(csd));
    await cs.start();
    try { if (ctx.state !== "running") await ctx.resume(); } catch (e) {}
    _live = cs;
    if (onStatus) onStatus(ctx.state === "running" ? "playing" : "playing (audio suspended — click again)");
    return cs;
  }

  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  // cap how long we wait on a promise (csound stop() can hang and "time out")
  const capped = (pr, ms) => Promise.race([Promise.resolve(pr).catch(()=>{}), delay(ms)]);

  async function stopLive() {
    _liveAbort = true;
    if (_liveTimer) { clearTimeout(_liveTimer); _liveTimer = null; }
    if (_live) {
      const c = _live; _live = null;
      try { await capped(c.stop && c.stop(), 500); } catch (e) {}
      try { await capped(c.destroy && c.destroy(), 500); } catch (e) {}
    }
  }

  // offline render -> WAV Blob. Tears down any live instance first — Csound WASM
  // does not tolerate two concurrent instances (that was the OOB crash).
  async function render(csd, sources, estSeconds, onStatus) {
    await stopLive();
    if (onStatus) onStatus("booting (offline)…");
    const cs = await boot(["--nosound","-m0","-d","-W","--output=render.wav"]);
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
    try { await capped(cs.stop && cs.stop(), 1500); } catch (e) {}   // finalize WAV header
    await delay(150);
    let bytes = null; try { bytes = await cs.fs.readFile("render.wav"); } catch (e) {}
    _live = null; try { await capped(cs.destroy && cs.destroy(), 500); } catch (e) {}
    if (!bytes || bytes.length < 64) throw new Error("render produced no audio");
    if (onStatus) onStatus("done");
    return new Blob([bytes], { type: "audio/wav" });
  }

  // ---- realtime capture export (offline render is realtime in this worklet
  // build, so capture the live output instead — audible, with progress) ----
  function concatF32(bufs){ let n=0; for(const b of bufs) n+=b.length; const o=new Float32Array(n); let p=0; for(const b of bufs){ o.set(b,p); p+=b.length; } return o; }
  function stereoWav(L,R,sr){
    const n=L.length, buf=new ArrayBuffer(44+n*4), v=new DataView(buf);
    const ws=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
    ws(0,"RIFF");v.setUint32(4,36+n*4,true);ws(8,"WAVE");ws(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,sr,true);v.setUint32(28,sr*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);ws(36,"data");v.setUint32(40,n*4,true);
    let off=44; for(let i=0;i<n;i++){ let l=Math.max(-1,Math.min(1,L[i])),r=Math.max(-1,Math.min(1,R[i])); v.setInt16(off,l<0?l*0x8000:l*0x7fff,true); v.setInt16(off+2,r<0?r*0x8000:r*0x7fff,true); off+=4; }
    return new Uint8Array(buf);
  }
  async function captureExport(csd, sources, estSeconds, onStatus){
    const ctx = audioCtx(); try { ctx.resume(); } catch(e){}
    await stopLive();
    const cap = ctx.createScriptProcessor(8192, 2, 2);
    const Ls=[], Rs=[];
    cap.onaudioprocess = e => {
      const iL=e.inputBuffer.getChannelData(0), iR=e.inputBuffer.numberOfChannels>1?e.inputBuffer.getChannelData(1):e.inputBuffer.getChannelData(0);
      Ls.push(new Float32Array(iL)); Rs.push(new Float32Array(iR));
      e.outputBuffer.getChannelData(0).set(iL); e.outputBuffer.getChannelData(1).set(iR);
    };
    cap.connect(ctx.destination);
    const orig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function(d,...a){ if(d===ctx.destination) return orig.call(this, cap); return orig.apply(this,[d,...a]); };
    let cs;
    try {
      if(onStatus) onStatus("starting…");
      cs = await boot(["-odac","-m0","-d"], ctx); _live = cs;
      await writeFound(cs, sources, onStatus);
      if(onStatus) onStatus("compiling…");
      await cs.compileCsdText(stripOptions(csd));
      await cs.start();
    } finally { AudioNode.prototype.connect = orig; }
    try { if(ctx.state!=="running") await ctx.resume(); } catch(e){}
    const total=(estSeconds||30)+1.4, t0=performance.now();
    await new Promise(res=>{ const iv=setInterval(()=>{ const el=(performance.now()-t0)/1000;
      if(onStatus) onStatus("recording "+Math.min(99,Math.round(el/total*100))+"%");
      if(el>=total){ clearInterval(iv); res(); } }, 300); });
    try { cap.disconnect(); } catch(e){}
    await stopLive();
    if(onStatus) onStatus("encoding…");
    const sr=ctx.sampleRate, L=concatF32(Ls), R=concatF32(Rs);
    if(L.length<sr*0.2) throw new Error("captured no audio");
    return new Blob([stereoWav(L,R,sr)], { type:"audio/wav" });
  }

  function bufToWav(buf){
    const L=buf.getChannelData(0), R=buf.numberOfChannels>1?buf.getChannelData(1):buf.getChannelData(0);
    return new Blob([stereoWav(L,R,buf.sampleRate)], { type:"audio/wav" });
  }
  // Fast(er) offline render: drive Csound's worklet inside an OfflineAudioContext,
  // which renders faster than real time and silently. Progress via suspend().
  async function renderOffline(csd, sources, estSeconds, onStatus){
    await stopLive();
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if(!OAC) throw new Error("no OfflineAudioContext");
    const len = Math.max(2, (estSeconds||30) + 1.5);
    const off = new OAC(2, Math.ceil(44100*len), 44100);
    const realAC = window.AudioContext;
    if(onStatus) onStatus("preparing render…");
    let cs;
    window.AudioContext = OAC;                 // make the lib's instanceof check accept the offline ctx
    try { cs = await boot(["-odac","-m0","-d"], off); } finally { window.AudioContext = realAC; }
    _live = cs;
    await writeFound(cs, sources, onStatus);
    await cs.compileCsdText(stripOptions(csd));
    for(let i=1;i<=9;i++){ const t=len*i/10; off.suspend(t).then(()=>{ if(onStatus) onStatus("rendering "+(i*10)+"%"); try{ off.resume(); }catch(e){} }).catch(()=>{}); }
    if(onStatus) onStatus("rendering 0%");
    await cs.start();
    const buf = await off.startRendering();
    _live = null; try { if(cs.destroy) await cs.destroy(); } catch(e){}
    return bufToWav(buf);
  }

  // ---- EXPLORE mode: a persistent live synth. The header (buses/FX) boots
  // once with channel-driven FX; instruments hot-recompile via compileOrc when
  // timbre changes; one chord-bar of the CURRENT state is injected just-in-time
  // (the genre evolves as you drag); sample tables load on demand from the pool.
  async function exploreLive(getState, onStatus, opts) {
    opts = opts || {};
    const E = root.CsdEngine; if (!E) throw new Error("engine missing");
    const ctx = audioCtx(); try { ctx.resume(); } catch (e) {}
    await stopLive();
    _liveAbort = false;
    const st0 = getState();
    if (onStatus) onStatus("booting live engine…");
    const cs = await boot(["-odac", "-m0", "-d"], ctx);
    _live = cs;
    const parts = E.liveParts(st0);
    const csd = parts.header.slice(0, parts.header.lastIndexOf("</CsInstruments>")) +
      parts.instruments + "\n</CsInstruments>\n<CsScore>\nf 0 360000\n</CsScore>\n</CsoundSynthesizer>";
    const rc = await cs.compileCsdText(csd);
    if (rc !== 0) { await stopLive(); throw new Error("live orchestra failed to compile (see console)"); }
    await cs.start();
    try { if (ctx.state !== "running") await ctx.resume(); } catch (e) {}
    liveSend(cs, "i 98 0 360000"); liveSend(cs, "i 99 0 360000");
    liveSend(cs, "i 100 0 360000"); liveSend(cs, "i 97 0 360000");
    const tabs = {}; let nextTab = 50, lastSig = "", ci = 0, serial = 0, nextTime = 0.5;
    async function setChannels(st) {
      const dl = st.delay || { beats: 0.75, feedback: 0.3, cutoff: 2600 };
      const ch = { reverb: st.reverb || 0.7, ddt: Math.min(1.9, (dl.beats || 0.75) * 60 / st.bpm),
        dfb: dl.feedback || 0.3, dcut: dl.cutoff || 2600, pump: st.pump || 0,
        crackle: st.crackle || 0, lowcut: (st.tone && st.tone.lowcut) || 10,
        highcut: (st.tone && st.tone.highcut) || 0, bps: st.bpm / 60 };
      for (const k in ch) { try { await cs.setControlChannel(k, ch[k]); } catch (e) {} }
    }
    async function ensureTable(s) {
      if (tabs[s.id]) return tabs[s.id];
      const wav = await decodeUrlToWav(s.url || s.samplePath);
      await cs.fs.writeFile("found/" + s.id + ".wav", wav);
      const n = nextTab++;
      await cs.compileOrc(`gi_x${n} ftgen ${n}, 0, 0, 1, "found/${s.id}.wav", 0, 0, 1`);
      tabs[s.id] = n;
      return n;
    }
    // the groove: loop the state's fullest section (peak/chorus/drop), not the form
    function grooveSec(st) {
      const score = s => (s.pads ? 1 : 0) + (s.bass && s.bass !== "off" ? 1 : 0) +
        (s.drums && s.drums !== "off" ? 2 : 0) + (s.melody && s.melody !== "off" ? 1 : 0);
      let best = st.sections[0];
      for (const s of st.sections)
        if (score(s) > score(best) || (/peak|chorus|drop|lift|swell/.test(s.name) && score(s) >= score(best))) best = s;
      return best;
    }
    async function injectChord(st, t) {
      const prg = (E.PROGRESSIONS[st.progression] || E.PROGRESSIONS.royal_road);
      const nch = prg.chords.length;
      ci = ci % nch;
      const sec = Object.assign({}, grooveSec(st), { cycles: 1, fill: "off", sweep: "off" });
      const one = Object.assign({}, st, { sections: [sec], seed: ((st.seed || 1) + serial * 7919) >>> 0 });
      for (const s of one.foundSources) await ensureTable(s);
      const ev = E.buildEvents(one);
      const lo = ci * 8, hi = lo + 8, spb = 60 / st.bpm;
      if (opts.onBar) try { opts.onBar({ serial, ci, nch, when: nextTime, spb,
        chord: (prg.chords[ci]||{}).name || "", section: sec.name }); } catch (e) {}
      const at = b => Math.max(0.01, nextTime + (b - lo) * spb - t).toFixed(3);
      const du = d => Math.max(0.05, d * spb).toFixed(3);
      const tabOf = f => tabs[(one.foundSources[f.tableNum - 2] || {}).id] || 0;
      const I = { pad: 1, bass: 2, melody: 4 }, D = { kick: 10, snare: 11, hat: 12 };
      const win = e => e.beat >= lo && e.beat < hi;
      ev.found.filter(f => f.chop ? win(f) : ci === 0).forEach(f => {
        const tn = tabOf(f); if (!tn) return;
        if (f.chop) liveSend(cs, `i 5 ${at(f.beat)} ${du(f.dur)} 0 ${f.amp} ${tn} ${f.pitch} ${f.offset.toFixed(3)} ${f.cutoff}`);
        else liveSend(cs, `i 3 ${at(0)} ${du(f.dur)} 0 ${f.amp} ${tn} ${f.pitch} ${f.stretch} ${f.cutoff}`);
      });
      ev.pitched.filter(win).forEach(p => liveSend(cs, `i ${I[p.voice]} ${at(p.beat)} ${du(p.dur)} ${p.pch} ${p.amp.toFixed(4)}`));
      ev.drums.filter(win).forEach(d => liveSend(cs, `i ${D[d.drum]} ${at(d.beat)} ${du(d.dur)} ${d.amp.toFixed(4)}`));
      ev.sfx.filter(s => s.stab && win(s)).forEach(s => liveSend(cs, `i 6 ${at(s.beat)} ${du(s.dur)} ${s.pch} ${s.amp.toFixed(3)}`));
      nextTime += 8 * spb;
      ci++; serial++;
    }
    const tick = async () => {
      if (_liveAbort || _live !== cs) return;
      try {
        const st = getState();
        await setChannels(st);
        const sig = JSON.stringify(st.instruments);
        if (sig !== lastSig) { await cs.compileOrc(E.instrumentBlock(st)); lastSig = sig; }
        let t = 0; try { t = await cs.getScoreTime(); } catch (e) {}
        if (nextTime < t) nextTime = t + 0.1;          // dropped behind (tab sleep) — resync
        while (nextTime < t + 2.2 && !_liveAbort) await injectChord(st, t);
      } catch (e) { console.error("exploreLive tick", e); }
      _liveTimer = setTimeout(tick, 160);
    };
    if (onStatus) onStatus(ctx.state === "running" ? "live — drag the space" : "live (tap again if silent)");
    tick();
    return cs;
  }

  async function scoreTime(){ try { return _live ? await _live.getScoreTime() : -1; } catch (e) { return -2; } }
  root.WasmAudio = { boot, play, playLive, stopLive, render, captureExport, renderOffline, decodeUrlToWav, encodeWav, stripOptions, ctxState, prewarm, prewarmPool, exploreLive, scoreTime, _liveLog };
})(window);
