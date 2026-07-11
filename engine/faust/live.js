// faust/live.js — the LIVE CONDUCTOR (Phase 5b: continuous ring-buffer engine).
//
//   <script src="csd-engine.js"></script>
//   <script src="faust/state-engine.js"></script>
//   <script src="faust/found-player.js"></script>
//   <script src="faust/live.js"></script>
//   const handle = await FaustLive.exploreLive(getState, onStatus, { onBar, onLoad });
//   handle.stop();
//
// This REPLACES the old JIT/pool/eco/stem-cache scheduler outright. The audio is
// now CLICK-FREE BY CONSTRUCTION: a stream renderer (faust/stream-worker.js →
// faust/stream-renderer.js) writes a continuous full-mix stereo PCM stream into a
// SharedArrayBuffer ring; the faust/ring-player.js AudioWorklet reads it one sample
// per output sample. There are no per-bar AudioBufferSourceNode seams to click.
//
// THE MODEL (Paul's): write audio into a buffer, read from it continuously; when the
// TIMBRE/PARAMS change, GLIDE within the one stream (per-bar feedBar into never-reset
// persistent procs — the DSP's own si.smooth ramps every change); when the TOPOLOGY
// changes (genre / model swap / unit add-remove), render the new state into a SECOND
// ring and equal-power CROSSFADE between the two rings (the ring-player mixes both).
//
// The conductor here owns TWO stream-worker producers ping-ponging on ring0/ring1,
// one authoritative per-bar section/ci/serial walk (lifted from the old injectChord),
// a runway-gated feed pump, a read-cursor→ctx-clock onBar scheduler, and NATIVE found
// (+ sampler) playback (found is never baked — it stays gapless BufferSource audio).
//
// Reuses AS-IS: faust/ring-player.js, faust/stream-worker.js, faust/stream-renderer.js,
// found-player.js, sampler.js. The state→events fabric is csd-engine + state-engine,
// the same brain press.js drives, so the live stream matches the press gold standard.
(function (root) {
  "use strict";

  const scriptSrc = (typeof document !== "undefined" && document.currentScript && document.currentScript.src)
    || (typeof location !== "undefined" ? location.origin + "/engine/faust/live.js" : "engine/faust/live.js");
  const BASE = new URL(".", scriptSrc).href;   // .../engine/faust/
  const SITE = new URL("../..", BASE).href;    // site root (found/, found/samples/) — up TWO from engine/faust/

  // ── ring control-block layout (must match ring-player.js / stream-worker.js) ──
  const SR = 44100, BS = 64;
  const C_STATE = 0, C_XFADE = 1, C_ACTIVE = 2, C_READ_LO = 3, C_READ_HI = 4,
        C_UNDERRUN = 5, C_UNDER_CNT = 6;
  const C_RING0 = 8, RING_STRIDE = 4, R_WRITE = 0, R_READ = 1;

  const RING_SEC = 30, RING_FRAMES = RING_SEC * SR;    // each ring holds ~30s
  const TARGET_SEC = 3.0, TARGET_FRAMES = TARGET_SEC * SR;  // runway we keep filled ahead (short = responsive steering)
  // hidden-tab runway: background pages clamp setTimeout/setInterval to >=1s (and
  // worse under pressure), so while hidden the feed target deepens — steering
  // latency doesn't matter when nobody's steering, survival does. The worker tick
  // (stream-worker.js "tick", workers are NOT timer-throttled) is the main feed
  // clock in the background; this deeper runway is the belt to that suspender.
  const HIDDEN_TARGET_SEC = 8.0, HIDDEN_TARGET_FRAMES = HIDDEN_TARGET_SEC * SR;
  const XFADE_MS = 400;                                // equal-power state-change crossfade
  const PRIME_SEC = 2.0, BRIDGE_PRIME_SEC = 1.2;       // fill before a stream is "primed"
  const WORKER_RUNWAY = 8;                             // worker self-backpressure ceiling (> TARGET; live.js is the limiter)

  // tiny browser-safe silent-WAV data URI — used to UNLOCK the background <audio>
  // element inside the play gesture, so a later programmatic play() (fired from
  // visibilitychange, which is NOT a user gesture) is permitted by iOS.
  function silentWavDataUri(ms) {
    const sr = 8000, n = Math.max(1, Math.round(sr * (ms || 120) / 1000)), dataLen = n * 2;
    const buf = new ArrayBuffer(44 + dataLen), dv = new DataView(buf);
    let o = 0;
    const w = (s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o++, s.charCodeAt(i)); };
    w("RIFF"); dv.setUint32(o, 36 + dataLen, true); o += 4; w("WAVE");
    w("fmt "); dv.setUint32(o, 16, true); o += 4; dv.setUint16(o, 1, true); o += 2; dv.setUint16(o, 1, true); o += 2;
    dv.setUint32(o, sr, true); o += 4; dv.setUint32(o, sr * 2, true); o += 4; dv.setUint16(o, 2, true); o += 2; dv.setUint16(o, 16, true); o += 2;
    w("data"); dv.setUint32(o, dataLen, true); o += 4;   // data stays zero → silence
    const bytes = new Uint8Array(buf); let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return "data:audio/wav;base64," + (typeof btoa !== "undefined" ? btoa(bin) : "");
  }

  // ── WAV-FIRST predicate (see WAV-FIRST.md) ──────────────────────────────────
  // The pocket-proof mobile audible path: a real <audio> element playing rendered
  // WAV segments throughout, never a live WebAudio graph. tri-state opts.wavOut:
  // true = force (the ?wavOut=1 headless hatch / any device), false = escape to the
  // ring path (?wavOut=0), undefined = auto (on when isMobile). Desktop default is
  // UNCHANGED (ring/worklet path + the existing bg-WAV handoff machinery).
  function wavOutWanted(opts) {
    if (opts && opts.wavOut != null) return !!opts.wavOut;
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    return /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua) ||
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ""));
  }

  // ================================================================ THE WALK
  // ONE authoritative section/ci/serial bar walk (lifted from the old injectChord),
  // shared by both conductors — the ring path and the WAV-FIRST path. Polls getState()
  // each bar (retarget/glide = mutating what getState returns): seed+serial*7919 per bar,
  // collapsed single-cycle sections, fills only on the last cycle, sweeps only on first/
  // last, chordEvery-aware CBEATS. Each makeWalk() owns its own cursor state.
  function makeWalk(getState, E, SE, startBar, opts) {
    let ci = 0, serial = 0, secIdx = 0, cycIdx = 0, absBeat = 0;
    // DROP-IN (the bookmarkable measure, 2026-07-10): startBar>0 fast-forwards
    // the walk's indices as if that many bars had already played — same
    // per-bar seed law ((seed + serial*7919)), same section arithmetic, so
    // measure N sounds byte-identical to having reached it live. Uses the
    // boot state's sections (constant at start; glides only mutate later).
    if (startBar > 0) {
      const st0 = getState();
      if (st0) {
        const prg0 = (E.PROGRESSIONS[st0.progression] || E.PROGRESSIONS.royal_road);
        const nch0 = prg0.chords.length;
        const secs0 = st0.sections && st0.sections.length ? st0.sections : [null];
        const CB0 = Math.max(2, Math.round(st0.chordEvery || (st0.meter ? 6 : 8)));
        for (let b = 0; b < startBar; b++) {
          absBeat += CB0; ci++; serial++;
          if (ci >= nch0) { ci = 0; cycIdx++;
            const cur = secs0[secIdx] || {};
            if (cycIdx >= (cur.cycles || 1)) { cycIdx = 0; secIdx = (secIdx + 1) % secs0.length; } }
        }
      }
    }
    function grooveSec(st) {
      const score = (s) => (s.pads ? 1 : 0) + (s.bass && s.bass !== "off" ? 1 : 0) +
        (s.drums && s.drums !== "off" ? 2 : 0) + (s.melody && s.melody !== "off" ? 1 : 0);
      let best = st.sections[0];
      for (const s of st.sections) if (score(s) > score(best) || (/peak|chorus|drop|lift|swell/.test(s.name) && score(s) >= score(best))) best = s;
      return best;
    }
    // topology signature over the FAUST (worker-rendered) units only — found/sampler are
    // native and don't affect stream topology. A change here = a crossfade (ring path).
    function sigOf(units) {
      const keys = [];
      for (const k of Object.keys(units)) { const u = units[k]; if (u && !u.sampler) keys.push(k + ":" + (u.module || "")); }
      return keys.sort().join("|");
    }
    return function stepWalk() {
      const st = getState();
      const prg = (E.PROGRESSIONS[st.progression] || E.PROGRESSIONS.royal_road);
      const nch = prg.chords.length;
      ci = ci % nch;
      const secs = st.sections && st.sections.length ? st.sections : [grooveSec(st)];
      secIdx = secIdx % secs.length;
      const cur0 = secs[secIdx], lastCyc = cycIdx >= (cur0.cycles || 1) - 1;
      const sec = Object.assign({}, cur0, { cycles: 1,
        fill: lastCyc ? (cur0.fill || "off") : "off",
        sweep: (cycIdx === 0 && cur0.sweep === "open") || (lastCyc && cur0.sweep === "close") ? cur0.sweep : "off" });
      // LIVE section-boundary flags (the cadence-amplifier fix). stepWalk feeds the
      // engine a ONE-SECTION, one-cycle song per chord-bar, so buildEvents' sampleEvents
      // pass sees every bar as both the FIRST section (opener) and a section END
      // (cadence/sectionEdge oneShot) — point-events meant to sound once per real
      // section fired on EVERY bar (auctioncore's gavel 34/34 bars live vs ~1/section
      // press). Thread the walk's real structure through so those placements gate to
      // genuine edges. Only set here (the live walk) — absent on the press path, where
      // the pass keeps its full-song behavior => press stays byte-identical. Continuous
      // placements (bed/buried/response/slice) are untouched; they run every bar by design.
      const liveEdge = { start: (cycIdx === 0 && ci === 0), end: (lastCyc && ci === nch - 1) };
      // MUSICAL DYNAMICS (voices swell in / fade out): buildEvents renders this ONE
      // section in isolation and can't see where the bar sits in a voice's run, so
      // the walk — which knows the real form — hands it (barInRun, runBars) per
      // voice. A voice on across the ENTIRE looping form gets no ramp (null) so
      // there's no dip at the loop seam; genuine entrances/exits within the form do.
      const vAct = { pad: s => !!s.pads, bass: s => s.bass && s.bass !== "off", melody: s => s.melody && s.melody !== "off", drums: s => s.drums && s.drums !== "off" };
      const secBarsOf = s => Math.max(1, (s.cycles || 1) * nch);
      const voiceRun = {};
      for (const v of ["pad", "bass", "melody", "drums"]) {
        if (!vAct[v](cur0) || secs.every(s => vAct[v](s))) { voiceRun[v] = null; continue; }   // off now, or on the whole loop → no ramp
        let a = secIdx; while (a - 1 >= 0 && vAct[v](secs[a - 1])) a--;
        let b = secIdx; while (b + 1 < secs.length && vAct[v](secs[b + 1])) b++;
        let before = 0; for (let s = a; s < secIdx; s++) before += secBarsOf(secs[s]);
        let runBars = 0; for (let s = a; s <= b; s++) runBars += secBarsOf(secs[s]);
        voiceRun[v] = { i: before + cycIdx * nch + ci, n: runBars };
      }
      const one = Object.assign({}, st, { sections: [sec], seed: ((st.seed || 1) + serial * 7919) >>> 0,
        instrumentSeed: st.instrumentSeed != null ? st.instrumentSeed : (st.seed || 1),   // instrument identity rides the SONG seed, not the per-bar reseed
        _liveEdge: liveEdge, _voiceRun: voiceRun });
      const spb = 60 / st.bpm;
      const CBEATS = Math.max(2, Math.round(st.chordEvery || (st.meter ? 6 : 8)));   // meter default mirrors buildEvents (kernel states carry explicit chordEvery; this covers hand states — ODD-METER 2026-07-09)
      const lo = ci * CBEATS, hi = lo + CBEATS;
      const ev = E.buildEvents(one);
      const meta = { serial, ci, nch, spb, cbeats: CBEATS, chord: (prg.chords[ci] || {}).name || "",
        section: sec.name, absBeatLo: absBeat, lo };
      const advance = () => { absBeat += CBEATS; ci++; serial++;
        if (ci >= nch) { ci = 0; cycIdx++; if (cycIdx >= (secs[secIdx].cycles || 1)) { cycIdx = 0; secIdx = (secIdx + 1) % secs.length; } } };
      // LIGHT MIDI WALK (2026-07-11 crash fix): the whole-path MIDI export only
      // needs the note events (ev) + timing; skip voiceUnits/mapEvents/fxParams (the
      // expensive AUDIO mapping + the big unit objects) so buildLoopMidi's SYNCHRONOUS
      // main-thread walk over a long loop doesn't block the UI for seconds and get
      // the page killed. Same per-bar seed/section walk => identical MIDI.
      if (opts && opts.midiOnly) { const rl = { one, spb, lo, hi, meta, musicalSec: (hi - lo) * spb, ev }; advance(); return rl; }
      const units = SE.voiceUnits(E, one);
      const m = SE.mapEvents(E, one, ev, { lo, hi, units });
      const fxParams = SE.fxParams(one);
      const barLenFrames = Math.max(BS, Math.round((hi - lo) * spb * SR / BS) * BS);
      const r = { one, units, sig: sigOf(units), spb, lo, hi, events: m.events, fxParams,
        sweepsRaw: m.sweeps, found: m.found, foundSources: one.foundSources || [], meta,
        barLenFrames, musicalSec: (hi - lo) * spb, ev };   // ev = note-level buildEvents (this bar's collapsed section) for the offline MIDI exporter
      advance();
      return r;
    };
  }

  // ── OVERSIZED-BAR SPLIT (the PRIMING HANG, docs/NEXT.md §5). The chord-bar is the
  // worker's feed/render QUANTUM: runLivePump renders one fed bar as ONE blocking
  // renderChunk and only posts "primed" after that first chunk lands — and a chunk
  // larger than the SAB ring is a hard openfail ("chunk > ring"). Slow-drone anchors
  // with chordEvery 32 LEGALLY produce such bars (chalkvespers 38.4s, atlantidrone
  // 33.7s, sourdough 32.5s vs the 30s ring — instant silent death; ambient 29.5s
  // squeaked under the cap but gated priming on one giant first render). So: split
  // any bar longer than MAX_FEED_SEC into contiguous sub-WINDOWS [lo..hi) for the
  // WORKER only. The renderer already tiles arbitrary windows (feedBar) and notes
  // sustain across window seams by construction (persistent procs + ingest's carry
  // intervals), so this is a transport change, not a musical one — the conductor's
  // own bookkeeping (playQueue bar, onBar, native found/sampler scheduling) stays
  // WHOLE-BAR. Frame math mirrors feedBar's rounding on the same doubles, so the
  // conductor's fed-frames ledger equals what the worker writes, piece by piece.
  const MAX_FEED_SEC = 6;
  function splitFeedWindows(r) {
    const n = Math.ceil(r.musicalSec / MAX_FEED_SEC);
    if (!(n > 1)) return [r];
    const step = (r.hi - r.lo) / n, out = [];
    for (let i = 0; i < n; i++) {
      const first = i === 0, last = i === n - 1;
      const lo = first ? r.lo : r.lo + i * step, hi = last ? r.hi : r.lo + (i + 1) * step;
      // half-open ownership; first/last pieces also absorb any out-of-window strays
      const events = (r.events || []).filter((e) => (first || e.beat >= lo) && (last || e.beat < hi));
      out.push(Object.assign({}, r, { lo, hi, events,
        barLenFrames: Math.max(BS, Math.round((hi - lo) * r.spb * SR / BS) * BS),
        musicalSec: (hi - lo) * r.spb,
        _sweeps: first ? r._sweeps : [],   // stream-absolute; registered once
        _sub: i }));
    }
    return out;
  }

  // makeDecGate(limit, retries, retryMs) — the SHARED decode throttle + bounded retry used
  // by BOTH conductors (ring + wavOut). The sampled-by-default change made every pitched
  // voice depend on heavy multi-zone GM sample decodes (~20-29 zones/genre). iOS
  // decodeAudioData is slow + strict: firing them all at once chokes the decoder (a
  // melody/pad/lead never ships while tiny drum one-shots + the decode-free synth 303/bass
  // survive — the reported bug) AND floods the main thread with big Float32 copies, starving
  // the feed pump so the stream dies out for many bars then recovers. Cap concurrency to a
  // few; RETRY a transient failure (a throw OR a null/empty decode) so one flaky decode never
  // permanently strands a voice. One gate instance per live handle throttles all its decodes.
  function makeDecGate(limit, retries, retryMs) {
    limit = limit > 0 ? limit : 4; retries = retries != null ? retries : 3; retryMs = retryMs > 0 ? retryMs : 500;
    let inFlight = 0, maxInFlight = 0; const waiters = [];
    const acquire = () => new Promise((res) => { if (inFlight < limit) { inFlight++; if (inFlight > maxInFlight) maxInFlight = inFlight; res(); } else waiters.push(res); });
    const release = () => { if (waiters.length) waiters.shift()(); else inFlight--; };
    const napms = (ms) => new Promise((r) => setTimeout(r, ms));
    // run(fn, ok, alive) — decode under the gate; retry with linear backoff until ok(v) or
    // retries spent. `alive()` (optional) short-circuits retries once the stream is torn down.
    // The underlying SP.decodeUrlRaw clears its own cache on rejection, so a retry re-fetches.
    async function run(fn, ok, alive) {
      alive = alive || (() => true);
      let lastErr = null;
      for (let attempt = 0; attempt <= retries; attempt++) {
        await acquire();
        let v = null;
        try { v = await fn(); } catch (e) { v = null; lastErr = e; }
        release();
        if (ok(v)) return { v, err: null };
        if (lastErr == null) lastErr = "decoded empty";
        if (!alive() || attempt >= retries) break;
        await napms(retryMs * (attempt + 1));
        if (!alive()) break;
      }
      return { v: null, err: lastErr };
    }
    return { run, acquire, release, stats: () => ({ maxInFlight, inFlight, limit }) };
  }

  async function exploreLive(getState, onStatus, opts) {
    opts = opts || {};
    if (wavOutWanted(opts)) return exploreLiveWav(getState, onStatus, opts);
    const E = root.CsdEngine, SE = root.FaustStateEngine, FP = root.FoundPlayer, SP = root.FaustSampler;
    if (!E || !SE || !FP) throw new Error("FaustLive needs csd-engine.js, faust/state-engine.js, faust/found-player.js loaded first");
    const status = (m) => { if (onStatus) try { onStatus(m); } catch (e) {} };
    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    const errors = [];

    // ── AudioContext (44100 so the ring reader is 1:1 with the render rate) ──
    const AC = root.AudioContext || root.webkitAudioContext;
    let ctx;
    try { ctx = new AC({ sampleRate: SR, latencyHint: "playback" }); } catch (e) { ctx = new AC(); }
    try { ctx.resume(); } catch (e) {}

    // ── MEDIA-ELEMENT OUTPUT ROUTE (mobile background survival) — MOBILE ONLY ──
    // iOS/Android silence a bare WebAudio graph on screen-lock but keep a *playing*
    // <audio> element alive. Route the master through a MediaStreamAudioDestinationNode
    // and play its stream from a real element (created INSIDE the play gesture). Desktop
    // uses classic ctx.destination (drift-free). Ported from the old engine.
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    const isMobile = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua) ||
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ""));
    // Desktop Safari HISTORY: pre-15.4 WebKit suspended the AudioContext on tab/
    // window background (webkit.org/b/231105, removed in r291267, 2022-03) — a bare
    // ctx.destination graph froze the ring-player mid-buffer and CoreAudio repeated
    // that last quantum forever. Modern desktop Safari keeps a running ctx alive in
    // hidden tabs, but tab-group switches / odd interruptions can still land the ctx
    // in "suspended"/"interrupted" (handled by onstatechange below). The media-
    // element route (an <audio> playing a MediaStream) is treated as MEDIA PLAYBACK
    // that Safari keeps alive across focus changes AND it marks the tab audible
    // (audible tabs are exempt from aggressive timer throttling / page suspension),
    // so route through it on Safari too — belt for old WebKits, throttle shield now.
    const isSafari = /^((?!chrome|crios|chromium|android|fxios|edg).)*safari/i.test(ua) &&
      /Apple/.test((typeof navigator !== "undefined" && navigator.vendor) || "");
    let msDest = null, mediaEl = null;
    const canMediaEl = !opts.directOut && !opts.forceClassicOut && (opts.forceMediaEl || isMobile || isSafari) &&
      typeof document !== "undefined" &&
      typeof ctx.createMediaStreamDestination === "function" && typeof root.Audio !== "undefined";
    if (canMediaEl) {
      try {
        msDest = ctx.createMediaStreamDestination();
        mediaEl = new root.Audio();
        mediaEl.autoplay = true;
        mediaEl.setAttribute("playsinline", "");
        mediaEl.playsInline = true;
        mediaEl.srcObject = msDest.stream;
        if (typeof document.body !== "undefined" && document.body) { mediaEl.style.display = "none"; document.body.appendChild(mediaEl); }
        const pr = mediaEl.play(); if (pr && pr.catch) pr.catch(() => {});
      } catch (e) { msDest = null; mediaEl = null; }
    }
    // periodic element recycle (opt-in: opts.elRecycleSec > 0) — resets the media
    // element's playback-clock drift by handing off to a fresh element gaplessly.
    let elRecycleTimer = 0;
    if (mediaEl && opts.elRecycleSec > 0) {
      elRecycleTimer = setInterval(() => {
        try {
          const fresh = new root.Audio();
          fresh.autoplay = true; fresh.muted = true;
          fresh.setAttribute("playsinline", ""); fresh.playsInline = true;
          fresh.srcObject = msDest.stream; fresh.style.display = "none";
          if (document.body) document.body.appendChild(fresh);
          const old = mediaEl;
          fresh.addEventListener("playing", () => {
            fresh.muted = false;
            try { old.muted = true; old.pause(); old.srcObject = null; old.remove(); } catch (e) {}
            mediaEl = fresh; try { handle.mediaEl = fresh; } catch (e) {}
          }, { once: true });
          const pr = fresh.play(); if (pr && pr.catch) pr.catch(() => { try { fresh.remove(); } catch (e) {} });
        } catch (e) {}
      }, opts.elRecycleSec * 1000);
    }

    // ── BACKGROUND-WAV HANDOFF setup (iOS background survival) — MOBILE/SAFARI ──
    // iOS SUSPENDS the AudioContext when hidden, so WebAudio can't sound in the
    // background — but an <audio> element playing a REAL media resource keeps going.
    // So we keep a rolling, deterministic ~BG_WAV_SEC WAV of the CURRENT genre's faust
    // mix ready (rendered OFF the ring by a dedicated stream-worker) and, on background,
    // hand off to a hidden looping <audio> playing it while the live worklet is muted at
    // source; on foreground we hand back. Gated to the SAME mobile/Safari predicate as
    // the media-element route. DESKTOP no longer runs goHidden on a mere tab-hide (the
    // live stream keeps playing — see onVisChange); on desktop Safari this producer is
    // kept as the FALLBACK carrier for a REAL ctx suspension (onstatechange → goHidden).
    // Desktop Chrome et al: wantBg stays false, nothing here runs.
    const wantBg = !opts.directOut && (opts.forceMediaEl || opts.forceBgWav || isMobile || isSafari) &&
      typeof document !== "undefined" && typeof root.Audio !== "undefined";
    const BG_WAV_SEC = opts.bgWavSec > 0 ? opts.bgWavSec : 32;
    let bgAudio = null;
    if (wantBg) {
      try {
        bgAudio = new root.Audio();
        bgAudio.loop = true;
        bgAudio.setAttribute("playsinline", ""); bgAudio.playsInline = true;
        bgAudio.preload = "auto"; bgAudio.style.display = "none";
        if (document.body) document.body.appendChild(bgAudio);
        // UNLOCK within the gesture (exploreLive runs from goLive's click): a muted
        // silent-WAV play so the later handoff play() (on visibilitychange) is allowed.
        bgAudio.muted = true; bgAudio.src = silentWavDataUri(150);
        const pr0 = bgAudio.play(); if (pr0 && pr0.catch) pr0.catch(() => {});
      } catch (e) { bgAudio = null; }
    }

    // ── SharedArrayBuffer rings + control block ──
    if (typeof SharedArrayBuffer === "undefined")
      throw new Error("FaustLive: SharedArrayBuffer unavailable (page must be cross-origin isolated: COOP:same-origin + COEP:require-corp)");
    const ctrlSab = new SharedArrayBuffer(16 * 4);
    const ctrl = new Int32Array(ctrlSab);
    const ringSabs = [new SharedArrayBuffer(RING_FRAMES * 2 * 4), new SharedArrayBuffer(RING_FRAMES * 2 * 4)];
    const read53 = () => (Atomics.load(ctrl, C_READ_HI) * 0x100000000) + (Atomics.load(ctrl, C_READ_LO) >>> 0);
    const ringFilled = (r) => Atomics.load(ctrl, C_RING0 + r * RING_STRIDE + R_WRITE) - Atomics.load(ctrl, C_RING0 + r * RING_STRIDE + R_READ);

    // ── output graph: ring-player → masterGain → analyser → (mediaEl | destination) ──
    status("loading engine…");
    await ctx.audioWorklet.addModule(BASE + "ring-player.js");
    const ringNode = new AudioWorkletNode(ctx, "ring-player",
      { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
        processorOptions: { ctrlSab, ring0Sab: ringSabs[0], ring1Sab: ringSabs[1], cap: RING_FRAMES } });
    const masterGain = ctx.createGain(); masterGain.gain.value = 1;
    const analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
    // USER MASTER VOLUME (Paul): a dedicated monitor gain AFTER the analyser, so
    // the listener's volume never collides with the engine's fade/mute automation
    // on masterGain, and the RMS meters read PRE-volume (stable). setMasterVol()
    // rides this node; range is the UI's business (0..~1.5).
    const userGain = ctx.createGain();
    userGain.gain.value = (opts.masterVol != null ? Math.max(0, Math.min(4, opts.masterVol)) : 1);
    // MASTER BUS (Paul: "everything sounds very muted"): the live ring mix used to
    // hit a UNITY masterGain with no glue and no makeup — the mastering the PRESS
    // path bakes (fx_bus comp/drive + up to +18 dB peak-normalizing makeup, see
    // press.js computeMakeup) never ran live, so the sampled voices (the default
    // sound) played dry and quiet (~−22 dBFS peak straight to output). This causal
    // master bus restores it: a gentle glue compressor → a makeup lift → a
    // brickwall limiter for peak safety, all on the SUM so it lifts the native
    // sampled/found voices too. Live-only (main-thread graph); the baked export
    // path keeps its own mastering, so segment-parity/fixtures are untouched.
    const busComp = ctx.createDynamicsCompressor();
    busComp.threshold.value = -22; busComp.knee.value = 28; busComp.ratio.value = 2.2; busComp.attack.value = 0.015; busComp.release.value = 0.25;
    const makeup = ctx.createGain(); makeup.gain.value = 2.6;   // ~+8 dB — the loudness the causal live path was missing
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1.5; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.12;
    ringNode.connect(masterGain);
    masterGain.connect(busComp); busComp.connect(makeup); makeup.connect(limiter);
    limiter.connect(analyser);
    // VAPOR (C.1, live-only): a global "walking through a mall" EQ on the master —
    // a high-shelf that rolls the top off + a short reverb wash, both scaled by
    // vapor 0..1. Sits AFTER the analyser (the RMS meters stay pre-vapor/pre-volume)
    // and before userGain. LIVE-ONLY (main-thread graph, the classic exploreLive
    // path) — the worker-baked export/WAV mix never sees it, so segment-parity and
    // fixtures are untouched. (The WAV-first mobile path plays a plain <audio> with
    // no WebAudio graph, so vapor rides the classic/desktop path only.)
    const vaporShelf = ctx.createBiquadFilter();
    vaporShelf.type = "highshelf"; vaporShelf.frequency.value = 1500; vaporShelf.gain.value = 0;
    const vaporSend = ctx.createGain(); vaporSend.gain.value = 0;   // mall-wash reverb send
    const vpDelay = ctx.createDelay(0.5); vpDelay.delayTime.value = 0.17;
    const vpFb = ctx.createGain(); vpFb.gain.value = 0.5;
    const vpLp = ctx.createBiquadFilter(); vpLp.type = "lowpass"; vpLp.frequency.value = 2600;
    analyser.connect(vaporShelf);
    vaporShelf.connect(userGain);
    vaporShelf.connect(vaporSend); vaporSend.connect(vpDelay);
    vpDelay.connect(vpLp); vpLp.connect(vpFb); vpFb.connect(vpDelay); vpLp.connect(userGain);
    const applyVapor = (v) => { v = Math.max(0, Math.min(1, +v || 0));
      try { vaporShelf.gain.setTargetAtTime(-16 * v, ctx.currentTime, 0.05);   // roll off up to -16 dB of top
            vaporSend.gain.setTargetAtTime(0.6 * v, ctx.currentTime, 0.05); } catch (e) {} };   // add the mall wash
    applyVapor(opts.vapor);
    userGain.connect(msDest || ctx.destination);

    // ── found routing: a small submix into master. dry → master; rev/del/pp → a
    // light native reverb (short feedback delay + lowpass) → master. Found stays
    // NATIVE (BufferSource, gapless); it is never baked into the worker stream. ──
    const foundDry = ctx.createGain(); foundDry.connect(masterGain);
    const foundRev = ctx.createGain(), foundDel = ctx.createGain(), foundPp = ctx.createGain();
    const fvDelay = ctx.createDelay(0.5); fvDelay.delayTime.value = 0.14;
    const fvFb = ctx.createGain(); fvFb.gain.value = 0.42;
    const fvLp = ctx.createBiquadFilter(); fvLp.type = "lowpass"; fvLp.frequency.value = 3200;
    foundRev.connect(fvDelay); foundDel.connect(fvDelay); foundPp.connect(fvDelay);
    fvDelay.connect(fvLp); fvLp.connect(fvFb); fvFb.connect(fvDelay); fvLp.connect(masterGain);
    const foundDests = { dry: foundDry, rev: foundRev, del: foundDel, pp: foundPp };
    const foundBeds = FP.FoundLive(ctx, foundDests);
    const foundChops = FP.FoundLive(ctx, foundDests);
    const foundVox = FP.FoundLive(ctx, foundDests);
    const VOXISH = /^(sp_|vx_|vox_|tw_)/;

    // ── ALWAYS-ON Faust CLICK MONITOR (Paul's production detector) ──
    // dsp/clickmon.dsp tapped off master (passthrough → hard-muted terminal so the
    // browser keeps scheduling it). Its bargraphs (out-param port messages) carry
    // monotonic click/gap counters. This is the acceptance-gate detector, so it is
    // built on the main thread even though all synthesis is in the worker.
    let clickMonState = null;
    try {
      const fw = await import(BASE + "node_modules/@grame/faustwasm/dist/esm/index.js");
      const { FaustWasmInstantiator, FaustMonoDspGenerator } = fw;
      const gen = new FaustMonoDspGenerator();
      const fac = await FaustWasmInstantiator.loadDSPFactory(BASE + "dist/clickmon-module.wasm", BASE + "dist/clickmon-meta.json");
      const cm = await gen.createNode(ctx, "clickmon", fac);
      masterGain.connect(cm);
      const cmSink = ctx.createGain(); cmSink.gain.value = 0;
      cm.connect(cmSink); cmSink.connect(ctx.destination);
      clickMonState = { node: cm, latest: { clicks: 0, peakjump: 0, rms: 0, gaps: 0 } };
      cm.setOutputParamHandler((path, value) => {
        const L = clickMonState.latest;
        if (path.endsWith("/clicks")) L.clicks = value;
        else if (path.endsWith("/peakjump")) L.peakjump = value;
        else if (path.endsWith("/rms")) L.rms = value;
        else if (path.endsWith("/gaps")) L.gaps = value;
      });
    } catch (e) { errors.push("clickmon: " + (e && e.message || e)); }

    // ── found / sampler decode caches (decode-ahead at feed; tolerate failures) ──
    // ALL decodes route through this shared throttle+retry gate so a sampled-genre's ~20+
    // instrument-zone decodes don't flood iOS decodeAudioData at once (which drops/hangs
    // most, stranding melody/pad/lead while tiny drum one-shots + the synth 303/bass survive).
    const decGate = makeDecGate(opts.decodeConcurrency, opts.decodeRetries, opts.decodeRetryMs);
    const bufCache = {};       // srcId -> AudioBuffer | null | undefined
    const bufFail = new Set();
    function kickBuffer(src) {
      if (!src || bufCache[src.id] !== undefined) return;
      // SPEECH organ: a synthText source synthesizes (lazy wasm, url-keyed
      // cache inside FP.synthToBuffer via CsdSpeech.key) instead of fetching.
      if (src.synthText) {
        bufCache[src.id] = undefined;
        decGate.run(() => FP.synthToBuffer(ctx, src.synthText), (b) => !!(b && b.length), () => !abort)
          .then(({ v }) => { bufCache[src.id] = (v && v.length) ? v : null; });
        return;
      }
      const url = src.url || (src.samplePath ? new URL(src.samplePath, SITE).href : null);
      if (!url || bufFail.has(url)) { bufCache[src.id] = null; return; }
      bufCache[src.id] = undefined;
      decGate.run(() => FP.decodeUrlToBuffer(ctx, url), (b) => !!(b && b.length), () => !abort)
        .then(({ v }) => { if (v && v.length) bufCache[src.id] = v; else { bufFail.add(url); bufCache[src.id] = null; } });
    }
    const samplerBufs = {};    // srcId -> AudioBuffer | null (RAW, sampler; null = REAL decode failure only)
    function kickSamplerBuf(srcId, foundSources) {
      if (!SP || samplerBufs[srcId] !== undefined) return;
      const src = (foundSources || []).find((s) => s.id === srcId);
      // ABSENT-SOURCE UN-PIN (the fugue->reggae total drum silence): a zone whose
      // SOURCE isn't in THIS bar's foundSources used to cache null here — and the
      // `!== undefined` guard above made that null PERMANENT, so when a later
      // glide flip finally carried the source into the crate the decode was never
      // re-attempted and scheduleNative skipped the voice silently forever
      // (probe: 233 fed drum events, 0 note() calls). Leave the slot UNDEFINED so
      // the first bar whose foundSources DO carry the src kicks the decode.
      if (!src) return;
      const url = src.url || (src.samplePath ? new URL(src.samplePath, SITE).href : null);
      if (!url) { samplerBufs[srcId] = null; return; }   // a present-but-urlless src is genuinely unplayable
      samplerBufs[srcId] = undefined;
      decGate.run(() => SP.decodeUrlRaw(ctx, url), (b) => !!b, () => !abort)
        .then(({ v }) => { samplerBufs[srcId] = v || null; });
    }
    // ── sampler players, one per unit key. INSERTS-ON-SAMPLED-VOICES (ring
    // path): a sampled unit whose resolved state declares an insert chain gets
    // ONE long-lived Web Audio twin chain (SP.buildInsertNodes) between its
    // notes and its unit-level dry/rev/del sends — per VOICE, mirroring how
    // synth units carry inserts (render-core law: sends POST-chain, so notes
    // enter the chain at dry 1 / sends 0 and the unit gains tap the output).
    // The wavOut/mobile lane renders the REAL Faust insert modules in the
    // worker (stream-renderer bakeNative); this twin keeps the ring path in
    // character. Keyed by a chain signature: a glide/crossfade that changes
    // the declared chain rebuilds the routing; the OLD chain is torn down on
    // a delay so in-flight note tails drain through it (no click).
    const samplerPlayers = new Map();   // key -> { sig, player, chain|null }
    function teardownSamplerChain(ent) {
      if (!ent || !ent.chain) return;
      for (const o of ent.chain.ch.oscs) { try { o.stop(); } catch (e) {} }
      for (const n of ent.chain.ch.nodes) { try { n.disconnect(); } catch (e) {} }
      for (const g of ent.chain.sends) { try { g.disconnect(); } catch (e) {} }
    }
    const samplerOf = (key, u, spb) => {
      if (!SP) return null;
      const ins = (u && u.inserts && u.inserts.length) ? u.inserts : null;
      const sig = ins ? JSON.stringify(ins) : "";
      let ent = samplerPlayers.get(key);
      if (ent && ent.sig !== sig) {
        const old = ent;
        setTimeout(() => teardownSamplerChain(old), 8000);   // drain tails, then free
        samplerPlayers.delete(key); ent = null;
      }
      if (!ent) {
        let dests = foundDests, chain = null;
        if (ins && SP.buildInsertNodes) {
          try {
            const ch = SP.buildInsertNodes(ctx, ins, 4 * (spb || 0.5));
            const dryG = ctx.createGain(); dryG.gain.value = u.dry != null ? u.dry : 1;
            const revG = ctx.createGain(); revG.gain.value = u.rev || 0;
            const delG = ctx.createGain(); delG.gain.value = u.del || 0;
            ch.output.connect(dryG); dryG.connect(foundDests.dry);
            ch.output.connect(revG); revG.connect(foundDests.rev);
            ch.output.connect(delG); delG.connect(foundDests.del);
            chain = { ch, sends: [dryG, revG, delG], types: ins.map((i) => i.type) };
            dests = { dry: ch.input, rev: ch.input, del: ch.input };
          } catch (e) { errors.push("samplerChain " + key + ": " + (e && e.message || e)); chain = null; dests = foundDests; }
        }
        ent = { sig, player: SP.SamplerLive(ctx, dests), chain };
        samplerPlayers.set(key, ent);
      }
      return ent;
    };

    // ── VOCODER speech carrier (robot_choir has one audio input) — decode the
    // speech source PCM ONCE per source id and hand it to the worker's openLive so
    // the live vocIns can modulate it (looping). Without a carrier the vocoder
    // drones/hums. Source selection MIRRORS press.js decodeInputs: the state's
    // vocoderSourceId, else the first speech-ish (sp_/vx_/vox_) found source. The
    // decode is main-thread (FP.decodeUrlToBuffer resolves the LOCAL cache) → mono
    // Float32; it's async + gated at openStream so it never blocks the crossfade.
    const speechCache = {};    // srcId -> Float32Array | null   (resolved; null = failed/none)
    const speechJobs = {};     // srcId -> Promise<Float32Array|null>  (in-flight or done)
    function speechSourceOf(state) {
      const fs = (state && state.foundSources) || [];
      return fs.find((s) => s.id === state.vocoderSourceId) ||
             fs.find((s) => /^(sp_|vx_|vox_)/.test(s.id || "")) || null;
    }
    function kickSpeech(src) {
      if (!src) return Promise.resolve(null);
      const id = src.id;
      if (speechJobs[id]) return speechJobs[id];
      // SPEECH organ: synthText carrier synthesizes through the shared cache
      const dec = src.synthText
        ? () => FP.synthToBuffer(ctx, src.synthText)
        : null;
      const url = dec ? null : (src.url || (src.samplePath ? new URL(src.samplePath, SITE).href : null));
      if (!dec && !url) return (speechJobs[id] = Promise.resolve((speechCache[id] = null)));
      const job = decGate.run(dec || (() => FP.decodeUrlToBuffer(ctx, url)), (b) => !!(b && b.length), () => !abort)
        .then(({ v }) => (speechCache[id] = (v && v.length ? Float32Array.from(v.getChannelData(0)) : null)));   // copy out of the AudioBuffer
      speechJobs[id] = job;
      return job;
    }
    // headless-verification counters: prove the wiring FEEDS speech (non-null) into a
    // vocoder stream's openLive rather than the old speech:null (which hummed).
    let voxSpeechOpens = 0, voxNullOpens = 0, lastSpeechLen = 0;

    // ── mixer layers (buried feature: a baked full-mix can't be de-mixed live, so
    // gain/mute/solo are no-ops; rms/active are coarse from the overall meter + the
    // last played bar's unit table). Shape preserved for explorer's mixer panel. ──
    const LAYER_DEFS = [
      ["pad", "pads"], ["bass", "bass"], ["lead", "lead"], ["kick", "kick"], ["snare", "snare"],
      ["hats", "hats/toms"], ["fx", "stabs/sfx"], ["beds", "found bed"], ["chops", "found chops"], ["vox", "hits/vox"],
    ];
    const LAYER_OF_UNIT = (key) =>
      key === "pad" ? "pad" : key === "bass" ? "bass"
      : key === "melody" || key.slice(0, 5) === "solo:" ? "lead"
      : key === "kick" ? "kick" : key === "snare" ? "snare"
      : key === "hat" || key === "tom" ? "hats"
      : key === "stab" || key === "sfx" ? "fx" : "fx";
    let lastPlayedLayers = new Set();

    // ================================================================ CONDUCTOR
    // Two stream-worker producers, one PINNED per ring (worker0↔ring0, worker1↔ring1).
    const workers = [null, null];
    const workerReady = [false, false];
    const workerReadyProm = [null, null];
    const readyResolve = [null, null];
    function ensureWorker(wi) {
      if (workerReadyProm[wi]) return workerReadyProm[wi];
      workerReadyProm[wi] = new Promise((resolve) => {
        readyResolve[wi] = resolve;
        const w = new Worker(BASE + "stream-worker.js", { type: "module" });
        workers[wi] = w;
        w.onmessage = (e) => onMsg(wi, e.data);
        w.onerror = (e) => errors.push("worker" + wi + " error: " + ((e && e.message) || e));
        w.postMessage({ type: "init" });
      });
      return workerReadyProm[wi];
    }

    let genCounter = 0;
    let cur = null, br = null;              // current + bridging stream objects
    let phase = "idle";                    // idle | bridging | fading  (before RUN: idle, cur priming)
    let running = false, abort = false;
    let fadeStartCursor = 0, fadeStartMs = 0, fadeTimer = 0, swapTimer = 0;

    // the onBar playback queue: bars awaiting their read-cursor crossing.
    const playQueue = [];

    function newStream(ring) {
      return { ring, wi: ring, gen: null, sig: null, readyToFeed: false, primed: false,
        fedFrames: 0, fedMusicalSec: 0, startGlobal: null, preFeed: [], pendingBars: [] };
    }
    function postOpenLive(stream, one, primeSec, speech) {
      stream.gen = ++genCounter;
      // COPY the cached carrier and TRANSFER the copy — a bare transfer of the cached
      // Float32Array would detach it and break the next re-open of the same source.
      const sp = speech && speech.length ? speech.slice() : null;
      if (sp) { voxSpeechOpens++; lastSpeechLen = sp.length; }
      else if (speechSourceOf(one)) voxNullOpens++;
      workers[stream.wi].postMessage({ type: "openLive", gen: stream.gen, ringIndex: stream.ring, state: one,
        buffers: {}, speech: sp, ctrlSab, ringSab: ringSabs[stream.ring], cap: RING_FRAMES,
        primeSec: primeSec, runwaySec: WORKER_RUNWAY }, sp ? [sp.buffer] : []);
    }
    function postFeed(stream, r) {
      workers[stream.wi].postMessage({ type: "feedBar", bar: {
        units: r.units, events: r.events, fxParams: r.fxParams, spb: r.spb, lo: r.lo, hi: r.hi,
        barStartSec: r._base, sweeps: r._sweeps } });
    }
    function openStream(stream, one, primeSec) {
      const go = (speech) => {
        postOpenLive(stream, one, primeSec, speech);
        stream.readyToFeed = true;
        const pf = stream.preFeed; stream.preFeed = [];
        for (const rr of pf) postFeed(stream, rr);
      };
      // gate the openLive on the speech carrier decode (non-blocking): if this state
      // needs a vocoder carrier and it isn't decoded yet, defer the open until it is
      // (bars queue in preFeed meanwhile). If there's no vocoder source, open now.
      const proceed = () => {
        const src = speechSourceOf(one);
        if (!src) return go(null);
        if (speechCache[src.id] !== undefined) return go(speechCache[src.id]);   // decoded or failed(null)
        kickSpeech(src).then((sp) => go(sp || null));
      };
      if (workerReady[stream.wi]) proceed(); else ensureWorker(stream.wi).then(proceed);
    }
    function feed(stream, r) {
      // stream-absolute sweep mapping (sweeps are rare — only section open/close)
      const base = stream.fedMusicalSec;
      r._base = base;
      r._sweeps = (r.sweepsRaw || []).map((sw) => ({ t0: base + (sw.beat - r.lo) * r.spb,
        t1: base + (sw.beat + sw.durB - r.lo) * r.spb, from: sw.from, to: sw.to }));
      // oversized-bar split (the priming hang): the WORKER gets bounded sub-windows;
      // everything below (playQueue bar, native scheduling, onBar) stays whole-bar.
      const pieces = splitFeedWindows(r);
      const wLen = pieces.length === 1 ? r.barLenFrames
        : pieces.reduce((a, p) => a + p.barLenFrames, 0);   // exactly what the worker will write
      const localStart = stream.fedFrames;
      stream.fedFrames += wLen;
      stream.fedMusicalSec += r.musicalSec;
      const barRec = { len: wLen, meta: r.meta, found: r.found, foundSources: r.foundSources,
        spb: r.spb, lo: r.lo, units: r.units, events: r.events, genre: (r.one && r.one.genre) || null };
      if (stream.startGlobal != null) { barRec.globalStart = stream.startGlobal + localStart; playQueue.push(barRec); }
      else { barRec.localStart = localStart; stream.pendingBars.push(barRec); }
      // decode-ahead any found/sampler sources this bar needs (ready by playback)
      for (const f of (r.found || [])) kickBuffer((r.foundSources || []).find((s) => s.id === f.srcId));
      for (const e of (r.events || [])) { const u = r.units[e.unit]; if (u && u.sampler) for (const z of (u.sampler.zones || [])) kickSamplerBuf(z.srcId, r.foundSources); }
      for (const p of pieces) { if (stream.readyToFeed) postFeed(stream, p); else stream.preFeed.push(p); }
    }
    function flushPending(stream) {
      for (const pb of stream.pendingBars) { pb.globalStart = stream.startGlobal + pb.localStart; playQueue.push(pb); }
      stream.pendingBars = [];
    }

    function beginBridge(r) {
      phase = "bridging";
      br = newStream(cur.ring ^ 1);
      br.sig = r.sig;
      openStream(br, r.one, BRIDGE_PRIME_SEC);
      feed(br, r);
    }
    function repointBridge(r) {   // coalesce a newer target mid-bridge (supersede via new gen)
      br.sig = r.sig; br.primed = false; br.readyToFeed = false;
      br.fedFrames = 0; br.fedMusicalSec = 0; br.pendingBars = []; br.preFeed = [];
      openStream(br, r.one, BRIDGE_PRIME_SEC);
      feed(br, r);
    }
    function startFade() {
      phase = "fading";
      // BAR-ALIGNED CROSSFADE (Paul's "out of sync"): the fade used to anchor at
      // read53() — an arbitrary sample INSIDE the old bar — so the incoming
      // stream's bar 0 (and the whole new beat grid: commitFade re-bases
      // br.startGlobal here) began mid-bar while already-scheduled NATIVE notes
      // (drums/samplers/found ride the OLD grid) rang across the new downbeat.
      // Anchor at the old grid's NEXT BAR BOUNDARY instead: playQueue[0] is the
      // next unfired bar (its audio is provably fed, so the old ring can never
      // underrun before the anchor); empty queue means the old stream is inside
      // its last fed bar, whose END (startGlobal+fedFrames, a bar boundary) is
      // the anchor. The xfade ramp holds at 0 until the cursor crosses the
      // anchor — the incoming ring is only consumed from the downbeat, so
      // native lanes and the new stream share one grid.
      const pg = read53();
      const fedEnd = (cur && cur.startGlobal != null) ? cur.startGlobal + cur.fedFrames : pg;
      const nextDown = playQueue.length ? playQueue[0].globalStart : fedEnd;
      fadeStartCursor = Math.max(pg, Math.min(nextDown, fedEnd));
      // prune NOW, not at commit: bars at/after the anchor belong to the incoming
      // stream — left queued, drainDueBars would fire their native notes on top
      // of the new stream's bar 0 during the ramp (double drums for a bar).
      for (let i = playQueue.length - 1; i >= 0; i--) if (playQueue[i].globalStart >= fadeStartCursor) playQueue.splice(i, 1);
      fadeStartMs = 0;   // ramp clock starts when the read cursor reaches the anchor
      if (fadeTimer) clearInterval(fadeTimer);
      fadeTimer = setInterval(() => {
        if (read53() < fadeStartCursor) return;   // hold at 0 until the downbeat
        if (!fadeStartMs) fadeStartMs = now();
        const el = now() - fadeStartMs;
        if (el >= XFADE_MS) { Atomics.store(ctrl, C_XFADE, 10000); clearInterval(fadeTimer); fadeTimer = 0; waitSwap(); }
        else Atomics.store(ctrl, C_XFADE, Math.min(9999, Math.floor(10000 * el / XFADE_MS)));
      }, 5);
    }
    function waitSwap() {
      if (swapTimer) clearInterval(swapTimer);
      swapTimer = setInterval(() => {
        if (Atomics.load(ctrl, C_ACTIVE) === br.ring && Atomics.load(ctrl, C_XFADE) === 0) {
          clearInterval(swapTimer); swapTimer = 0; commitFade();
        }
      }, 3);
    }
    function commitFade() {
      // startFade already pruned the superseded old-stream bars at the anchor
      // (kept here as a safety sweep), so just re-base the bridge's fed bars onto
      // the BAR-ALIGNED anchor and adopt it — the new stream's bar 0 IS the old
      // grid's downbeat, one grid for native lanes and stream alike.
      for (let i = playQueue.length - 1; i >= 0; i--) if (playQueue[i].globalStart >= fadeStartCursor) playQueue.splice(i, 1);
      br.startGlobal = fadeStartCursor;
      flushPending(br);
      const old = cur;
      cur = br; br = null; phase = "idle";
      try { workers[old.wi].postMessage({ type: "stop" }); } catch (e) {}   // retire the old producer / free its ring
    }

    function startRun() {
      running = true;
      cur.startGlobal = 0;
      flushPending(cur);
      Atomics.store(ctrl, C_ACTIVE, cur.ring);
      Atomics.store(ctrl, C_XFADE, 0);
      Atomics.store(ctrl, C_STATE, 1);   // RUN
      status(ctx.state === "running" ? "live (faust) — drag the space" : "live (tap again if silent)");
      startBarScheduler();
      startLoadReporter();
      ensureWorker(1);   // pre-init the idle worker so the first crossfade is snappy
      // spin up the background-WAV producer (mobile/Safari only) shortly after run so
      // its worker init + first offline render never contends with the priming burst.
      if (wantBg) setTimeout(() => {
        if (abort) return;
        bgEnsureWorker();
        if (!bgPollTimer) bgPollTimer = setInterval(bgPoll, 1000);
        bgPoll();
      }, 1200);
    }

    function onMsg(wi, m) {
      if (!m || !m.type) return;
      if (m.type === "ready") { workerReady[wi] = true; if (readyResolve[wi]) readyResolve[wi](); return; }
      if (m.type === "initfail") { errors.push("worker" + wi + " initfail: " + m.error); return; }
      // worker metronome (stream-worker posts ~4Hz per live open): dedicated-worker
      // timers are NOT throttled in hidden tabs, so this keeps the feed pump and the
      // bar scheduler alive when the page's own timers clamp to >=1s (tab in the
      // background but the ctx still running — the desktop keep-playing path).
      if (m.type === "tick") { pumpOnce(); drainDueBars(); return; }
      const stream = (cur && cur.gen === m.gen) ? cur : (br && br.gen === m.gen) ? br : null;
      if (!stream) return;   // superseded open — ignore
      if (m.type === "primed") {
        if (stream === cur && !running) startRun();
        else if (stream === br && phase === "bridging" && !br.primed) { br.primed = true; startFade(); }
        return;
      }
      if (m.type === "openfail") {
        errors.push("openfail gen" + m.gen + ": " + m.error);
        // never a silent forever-"priming…": a dead current stream is an honest error
        // (the pre-split symptom: a >30s chord-bar overflowed the ring and the app
        // just spun — atlantidrone/chalkvespers, docs/NEXT.md §5).
        if (stream === cur && !running) status("engine error: " + m.error);
        return;
      }
      // openedLive / status / eos / stopped: informational
    }

    // ONE authoritative section/ci/serial walk, shared with the WAV-FIRST path (makeWalk).
    const stepWalk = makeWalk(getState, E, SE, (opts && opts.startBar) | 0);   // drop-in at the bookmarked measure

    // decide glide (feedBar into the one stream) vs crossfade (new stream + ring)
    function produceAndRoute() {
      const r = stepWalk();
      if (!cur) { cur = newStream(0); cur.sig = r.sig; openStream(cur, r.one, PRIME_SEC); feed(cur, r); return; }
      if (phase === "fading") return;   // hold: the fade is ~400ms, bars are seconds — nothing due
      if (phase === "bridging") {
        if (r.sig === br.sig) feed(br, r); else repointBridge(r);
        return;
      }
      // idle
      if (r.sig === cur.sig) feed(cur, r); else beginBridge(r);
    }

    // ── feed pump: keep the feed-target runway filled to TARGET, gated on playback ──
    function feedRunwayFrames() {
      if (phase === "bridging" && br) return br.fedFrames;   // bridge not active yet (played 0)
      // BAR-ALIGNED fades wait for the anchor downbeat (up to a bar): the audible
      // runway is the OLD stream's remaining audio up to the anchor PLUS the
      // bridge's fed frames (it owns playback from the anchor on). Reporting only
      // the draining old stream here read as a phantom starve on the load meter
      // (and would over-drive the pump) while nothing was at risk.
      if (phase === "fading" && br) return Math.max(0, fadeStartCursor - read53() + br.fedFrames);
      if (!cur) return 0;
      const played = cur.startGlobal != null ? Math.max(0, read53() - cur.startGlobal) : 0;
      return cur.fedFrames - played;
    }
    let pumpTimer = 0;
    // deeper feed target while hidden (background timer throttling; see HIDDEN_TARGET_SEC)
    const targetFrames = () => (typeof document !== "undefined" && document.visibilityState === "hidden")
      ? HIDDEN_TARGET_FRAMES : TARGET_FRAMES;
    // pumpOnce: one idempotent top-up, safe to call from ANY clock (the page timer,
    // the worker tick, goVisible) — never (re)schedules, so no timer chains accumulate.
    function pumpOnce() {
      if (abort) return;
      try {
        let guard = 0;
        while (!abort && phase !== "fading" && guard < 24 && feedRunwayFrames() < targetFrames()) { produceAndRoute(); guard++; }
      } catch (e) { errors.push("pump: " + (e && e.message || e)); console.error("FaustLive pump", e); }
    }
    function pump() {
      if (abort) return;
      pumpOnce();
      pumpTimer = setTimeout(pump, 25);
    }

    // ── onBar scheduler: fire opts.onBar (+ schedule native found/sampler) at each
    // bar's PLAYBACK instant, derived from the ring-player read cursor → ctx clock. ──
    let barTimer = 0;
    let lastFoundGenre = null;   // the genre whose live found voices are currently ringing (fade on change)
    // drainDueBars: fire every bar whose playback instant has arrived. Idempotent,
    // driven by BOTH the 30ms page interval (exact while visible) and the worker
    // tick (unthrottled while hidden). HIDDEN LOOKAHEAD: background pages clamp
    // timers to >=1s, which would schedule native found/sampler starts up to a
    // second LATE (start(when-in-the-past) clumps at now). While hidden we fire
    // bars up to ~0.6s EARLY instead — fireBar computes an absolute ctx-clock
    // `when`, so early scheduling is sample-accurate; only the (invisible) onBar
    // UI callback leads. Visible drains stay exact, as before.
    const BAR_LOOKAHEAD_FRAMES = Math.round(0.6 * SR);
    function drainDueBars() {
      if (abort) return;
      const pg = read53();
      const horizon = pg + ((typeof document !== "undefined" && document.visibilityState === "hidden") ? BAR_LOOKAHEAD_FRAMES : 0);
      while (playQueue.length && playQueue[0].globalStart <= horizon) fireBar(playQueue.shift(), pg);
    }
    function startBarScheduler() {
      if (barTimer) return;
      barTimer = setInterval(drainDueBars, 30);
    }
    function fireBar(b, pg) {
      const when = ctx.currentTime + (b.globalStart - pg) / SR;   // ≈ ctx.currentTime (bar just reached playback)
      lastPlayedLayers = new Set([...Object.keys(b.units)].map(LAYER_OF_UNIT));
      try { scheduleNative(b, when); } catch (e) { errors.push("found@" + b.meta.serial + ": " + (e && e.message || e)); }
      if (opts.onBar) try {
        opts.onBar({ serial: b.meta.serial, ci: b.meta.ci, nch: b.meta.nch, when: when,
          spb: b.meta.spb, cbeats: b.meta.cbeats, chord: b.meta.chord, section: b.meta.section });
      } catch (e) {}
    }
    // native found (bed/chop/vox) + sampler at playback — the same fabric the old
    // injectChord scheduled, on the ctx clock via at(beat).
    function scheduleNative(b, when) {
      // GENRE MOVED ON: fade the departing genre's live vocal/chop found voices
      // so a long narration/vox LOOP (e.g. termswave's terms&conditions read)
      // doesn't keep blaring at full volume after the mix has left it (Paul,
      // 2026-07-10). Live-only — the baked press mix is a separate path, so the
      // byte-identity gates are untouched. Beds keep their own durSec envelope
      // for ambient continuity; only the loud one-shot/vocal lanes fade here.
      if (b.genre && b.genre !== lastFoundGenre) {
        if (lastFoundGenre != null) { try { foundVox.fadeAll(2.0); foundChops.fadeAll(2.0); } catch (e) {} }
        lastFoundGenre = b.genre;
      }
      const spb = b.spb, lo = b.lo;
      const at = (beat) => when + (beat - lo) * spb;
      const beatAbs = (beat) => b.meta.absBeatLo + (beat - lo);
      // sampler notes (native BufferSource, like found)
      if (SP) for (const e of (b.events || [])) {
        const u = b.units[e.unit]; if (!u || !u.sampler) continue;
        const ent = samplerOf(e.unit, u, spb);
        const midi = SP.midiOfFreq(e.sets.freq);
        const z = SP.zoneFor(u.sampler.zones, midi, e.sets.gain != null ? Math.round(e.sets.gain * 127) : 100);
        const buf = z && samplerBufs[z.srcId];
        if (!ent || !buf) continue;
        // chained unit (declared inserts): notes enter the chain PRE-SEND —
        // dry 1 / sends 0 here; the unit-level gains tap the chain output.
        const chained = !!ent.chain;
        const zsr = u.sampler.sr || 44100;
        ent.player.note(buf, at(e.beat), { rate: SP.rateFor(z, midi), durSec: e.durB * spb,
          gain: (u.lvl || 0.5) * (e.sets.gain != null ? e.sets.gain : 0.13),
          atk: u.sampler.atk, rel: u.sampler.rel, swell: !!u.sampler.swell, mello: u.sampler.mello || null,
          strip: u.sampler.strip || null,   // per-voice band EQ/comp/saturation/air (SamplerLive builds the node twin)
          songT: beatAbs(e.beat) * spb,
          dry: chained ? 1 : (u.dry != null ? u.dry : 1),
          rsend: chained ? 0 : (u.rev || 0), dsend: chained ? 0 : (u.del || 0),
          bendFrom: e.bend ? e.bend.from : 0, bendMs: e.bend ? e.bend.ms : 0,
          loop: !!z.loop, loopStartSec: (z.loopStart || 0) / zsr, loopEndSec: (z.loopEnd || 0) / zsr });
      }
      // found chops + beds (bed re-anchored at bar start of chord 0)
      for (const f of (b.found || [])) {
        const buf = bufCache[f.srcId];
        if (!buf) continue;
        if (f.type === "chop") {
          const lane = VOXISH.test(f.srcId) ? foundVox : foundChops;
          lane.chop(buf, at(f.beat), { durSec: f.durB * spb, amp: f.amp, pitch: f.pitch, offset: f.offset,
            cutoff: f.cutoff, rsend: f.rsend, dsend: f.dsend, ppsend: f.ppsend, fade: f.fade,
            sqRate: f.sqRate, sqDepth: f.sqDepth, autoTune: f.autoTune });
        } else if (b.meta.ci === 0) {
          foundBeds.bed(buf, at(lo), { durSec: f.durB * spb, amp: f.amp, pitch: f.pitch,
            stretch: f.stretch, cutoff: f.cutoff, autoTune: f.autoTune });
        }
      }
    }

    // ── onLoad reporter (~250ms): r = runway health, e = 0 (eco deleted) ──
    let loadTimer = 0, loadRatio = 1;
    function startLoadReporter() {
      if (loadTimer) return;
      loadTimer = setInterval(() => {
        if (abort) return;
        const runSec = Math.max(0, feedRunwayFrames()) / SR;
        loadRatio = Math.min(1, runSec / TARGET_SEC);
        if (opts.onLoad) try { opts.onLoad(loadRatio, 0); } catch (e) {}
      }, 250);
    }

    // ── ROLLING BACKGROUND-WAV PRODUCER (wantBg only) ──
    // A DEDICATED stream-worker (not an audio producer — owns no ring) renders a
    // deterministic ~BG_WAV_SEC whole-song WAV of the CURRENT genre off the audio path.
    // We refresh it (debounced ~1s) when the genre/topology signature changes and keep
    // the same blob while a genre is stable; a render in flight is superseded by the
    // newest target. The ready blob becomes an object URL the background <audio> plays;
    // old URLs are revoked. Holding one ~32s stereo int16 WAV ≈ a few MB.
    let bgWorker = null, bgWorkerReady = false, bgWorkerReadyProm = null, bgWorkerResolve = null;
    let bgUrl = null, bgReadySig = null, bgInflightSig = null, bgWantSig = null;
    let bgGen = 0, bgDebounceTimer = 0, bgPollTimer = 0, bgActive = false;
    function bgEnsureWorker() {
      if (bgWorkerReadyProm) return bgWorkerReadyProm;
      bgWorkerReadyProm = new Promise((resolve) => {
        bgWorkerResolve = resolve;
        const w = new Worker(BASE + "stream-worker.js", { type: "module" });
        bgWorker = w;
        w.onmessage = (e) => onBgMsg(e.data);
        w.onerror = (e) => errors.push("bgworker error: " + ((e && e.message) || e));
        w.postMessage({ type: "init" });
      });
      return bgWorkerReadyProm;
    }
    function onBgMsg(m) {
      if (!m || !m.type) return;
      if (m.type === "ready") { bgWorkerReady = true; if (bgWorkerResolve) bgWorkerResolve(); return; }
      if (m.type === "initfail") { errors.push("bgworker initfail: " + m.error); return; }
      if (m.type === "wav") {
        if (m.gen !== bgGen) { bgInflightSig = null; }   // superseded render — discard the bytes
        else {
          try {
            const blob = new root.Blob([m.wav], { type: "audio/wav" });
            const url = root.URL.createObjectURL(blob);
            if (bgUrl && bgUrl !== url) { try { root.URL.revokeObjectURL(bgUrl); } catch (e) {} }
            bgUrl = url; bgReadySig = bgInflightSig; bgInflightSig = null;
            // PRELOAD the blob into the element NOW, while the page is alive: assigning
            // src at hidden-time (bgHandoff) races the iOS page freeze, and a blob that
            // never finishes loading is silence. Preloaded, the handoff is just play().
            if (bgAudio && !bgActive) { try { bgAudio.src = bgUrl; bgAudio.load(); } catch (e) {} }
            // if we went hidden AND MUTED before a blob was ready (mute-only fallback
            // took over), hand off to the <audio> now that the WAV has landed. Gated on
            // survivalMuted: on desktop a hidden tab keeps the LIVE stream playing —
            // starting the WAV loop alongside it would double the audio.
            if (typeof document !== "undefined" && document.visibilityState === "hidden" && survivalMuted && !bgActive && bgAudio) bgHandoff();
          } catch (e) { errors.push("bgwav blob: " + (e && e.message || e)); bgInflightSig = null; }
        }
        if (bgWantSig && bgWantSig !== bgReadySig) bgKick();   // coalesce to the newest target
        return;
      }
      if (m.type === "wavcancel" || m.type === "wavfail") {
        bgInflightSig = null;
        if (m.type === "wavfail") errors.push("bgwav fail: " + m.error);
        if (bgWantSig && bgWantSig !== bgReadySig) bgKick();
        return;
      }
    }
    // signature over the FAUST topology (cur.sig) + salient genre fields: a change here
    // = a new genre/timbre, so the background WAV is re-rendered; stable = same blob.
    function bgSignature() {
      try {
        const st = getState(); if (!st) return null;
        const g = st.genre || st.name || (st.genreMeta && st.genreMeta.form) || "";
        return [(cur && cur.sig) || "", g, st.bpm, st.progression, st.chordEvery].join("~");
      } catch (e) { return null; }
    }
    function bgKick() {
      if (!wantBg || abort) return;
      const sig = bgWantSig;
      if (!sig || sig === bgReadySig || bgInflightSig) return;   // have it / already rendering
      let st; try { st = getState(); } catch (e) { return; }
      if (!st) return;
      bgInflightSig = sig; bgGen++;
      const gen = bgGen;
      const go = () => { try { bgWorker.postMessage({ type: "renderWav", state: JSON.parse(JSON.stringify(st)), durSec: BG_WAV_SEC, gen }); } catch (e) { bgInflightSig = null; errors.push("bgwav post: " + (e && e.message || e)); } };
      if (bgWorkerReady) go(); else bgEnsureWorker().then(go);
    }
    function bgPoll() {
      if (!wantBg || abort) return;
      const sig = bgSignature();
      if (sig && sig !== bgWantSig) {
        bgWantSig = sig;
        bgSetMetadata();   // reflect the new genre on the lock screen
        if (bgDebounceTimer) clearTimeout(bgDebounceTimer);
        bgDebounceTimer = setTimeout(() => { bgDebounceTimer = 0; bgKick(); }, 1000);
      }
    }

    // best-effort JS volume fade for the <audio> element (AudioParam ramps don't
    // advance while the ctx is suspended; a JS timer still does). Degrades to a
    // near-instant set if background timers are throttled — never a gap.
    function fadeEl(el, to, ms) {
      if (!el) return;
      try {
        const from = el.volume, steps = Math.max(1, Math.round(ms / 20)); let i = 0;
        if (el.__fade) clearInterval(el.__fade);
        el.__fade = setInterval(() => {
          i++; const x = Math.min(1, i / steps);
          try { el.volume = Math.max(0, Math.min(1, from + (to - from) * x)); } catch (e) {}
          if (x >= 1) { clearInterval(el.__fade); el.__fade = 0; }
        }, 20);
      } catch (e) { try { el.volume = to; } catch (e2) {} }
    }
    // hand the sound off to the background <audio> playing the ready WAV. Returns
    // true if a blob was ready (so the caller can leave the mute-only fallback).
    function bgHandoff() {
      if (!bgAudio || !bgUrl) return false;
      try {
        if (bgAudio.src !== bgUrl) bgAudio.src = bgUrl;
        bgAudio.muted = false; bgAudio.volume = 0;
        const pr = bgAudio.play(); if (pr && pr.catch) pr.catch(() => {});
        fadeEl(bgAudio, 1, 150);   // soft entrance (the WAV isn't sample-aligned with the live stream)
      } catch (e) { return false; }
      bgActive = true; bgSetPlaybackState("playing");
      return true;
    }

    // ── background survival state machine: iOS/Safari SUSPEND the AudioContext when
    // the page is hidden, freezing the ring-player mid-buffer so CoreAudio repeats that
    // last real quantum forever. So on hidden we MUTE the live worklet at source FIRST
    // (C_STATE=2 → silence + frozen cursor) so the frozen-repeat is SILENCE, then hand
    // off to the background <audio> WAV if one is ready (music keeps playing via a real
    // media element iOS won't suspend). If no blob is ready we stay MUTE-ONLY (today's
    // fallback) and pick up the handoff when the WAV lands (see onBgMsg). On return we
    // pause the <audio>, resume the ctx, unmute the worklet with the 20ms fade-in. ──
    let survivalMuted = false;   // goHidden ran (visibility OR interruption) and goVisible hasn't yet
    // iOS reports "interrupted" (non-standard, NOT "suspended") after an app switch or
    // audio-session interruption, so resume() must be unconditional — it's a no-op
    // while running, and awaiting/catching keeps a rejected promise silent.
    const resumeCtx = () => { try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {} };
    // one-shot gesture fallback: iOS sometimes refuses a non-gesture resume() after an
    // interruption; if the ctx still isn't running shortly after return, the next touch
    // anywhere revives it (touch handlers ARE user gestures).
    let gestureArmed = false;
    const armGestureResume = () => {
      if (gestureArmed || typeof document === "undefined") return;
      gestureArmed = true;
      const revive = () => {
        gestureArmed = false;
        document.removeEventListener("touchend", revive, true);
        document.removeEventListener("pointerdown", revive, true);
        if (abort) return;
        resumeCtx();
        if (mediaEl && msDest) { try { mediaEl.srcObject = msDest.stream; mediaEl.muted = false; const pr = mediaEl.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {} }
      };
      document.addEventListener("touchend", revive, true);
      document.addEventListener("pointerdown", revive, true);
    };
    const goHidden = () => {
      if (abort) return;
      survivalMuted = true;
      // mute the worklet SYNCHRONOUSLY (background timers throttle on iOS — can't defer)
      try { Atomics.store(ctrl, C_STATE, 2); } catch (e) {}   // worklet → silence, cursor frozen
      try { masterGain.gain.cancelScheduledValues(ctx.currentTime); masterGain.gain.value = 0; } catch (e) {}
      // MUTE + PAUSE the media-element route. It plays the LIVE MediaStream; when iOS
      // suspends the ctx it loops that stream's last buffer — the "loop chunk"
      // that played ALONGSIDE the background WAV. A paused element emits nothing
      // regardless of the frozen stream, so only the bg <audio> sounds. (gain=0
      // above races the suspend and isn't enough on its own — this is the fix.
      // muted=true too: mute takes effect ahead of pause in some WebKit paths.)
      if (mediaEl) { try { mediaEl.muted = true; mediaEl.pause(); } catch (e) {} }
      if (wantBg && bgAudio && bgUrl) bgHandoff();             // hand off if the WAV is ready
    };
    const goVisible = () => {
      if (abort) return;
      resumeCtx();   // unconditional — covers iOS/Safari "interrupted" AND "suspended" (goVisible used to gate on "suspended" and never resumed after an app switch); no-op while running
      // never survival-muted (desktop tab switch / plain window refocus): the live
      // stream never stopped — the resume poke above is all a refocus needs. Running
      // the restore machinery would dip masterGain (0→1 ramp) on every focus event.
      if (!survivalMuted && !bgActive) return;
      if (bgActive && bgAudio) {                               // hand back: fade + pause the WAV
        try { fadeEl(bgAudio, 0, 120); } catch (e) {}
        setTimeout(() => { try { bgAudio.pause(); } catch (e) {} }, 150);
        bgActive = false;
      }
      if (mediaEl) {
        try {
          // re-latch the stream when coming back from a goHidden pause: WebKit keeps a
          // pause()d MediaStream element SILENT on a bare play() after the ctx was
          // suspended — reassigning srcObject re-binds the (same) live track.
          if (survivalMuted && msDest) mediaEl.srcObject = msDest.stream;
          mediaEl.muted = false;
          const pr = mediaEl.play(); if (pr && pr.catch) pr.catch(() => {});
        } catch (e) {}
      }
      survivalMuted = false;
      try { Atomics.store(ctrl, C_STATE, 1); } catch (e) {}    // resume from the frozen cursor
      try { const t = ctx.currentTime; masterGain.gain.cancelScheduledValues(t); masterGain.gain.setValueAtTime(0, t); masterGain.gain.linearRampToValueAtTime(1, t + 0.02); } catch (e) {}   // fade in — no click on return
      try { pumpOnce(); } catch (e) {}                          // refill now, don't wait for the throttled timer (pumpOnce: never forks a second timer chain)
      // if iOS refused the non-gesture resume, the next touch revives the session
      setTimeout(() => {
        if (!abort && ctx.state !== "running" &&
            (typeof document === "undefined" || document.visibilityState !== "hidden")) { resumeCtx(); armGestureResume(); }
      }, 400);
      bgSetPlaybackState("playing");
    };
    // ── visibility routing: THE DESKTOP TAB-SWITCH FIX (Paul: "switching tabs stops
    // the audio" in desktop Safari). Hiding the tab used to run goHidden EVERYWHERE,
    // muting the live worklet at source; desktop then depended on the bg-WAV <audio>
    // handoff (Safari) or just went silent (Chrome et al). But every modern desktop
    // engine — including Safari >= 15.4 (webkit.org/b/231105) — keeps a RUNNING
    // AudioContext alive in a hidden tab. So on desktop we now KEEP PLAYING: no mute,
    // no handoff; just top the runway before background timer throttling sets in
    // (the worker tick carries the feed from there). The preemptive mute remains for
    // MOBILE, where the ctx genuinely suspends ("interrupted") on backgrounding. If a
    // desktop WebKit DOES suspend the ctx while hidden (old Safari, tab-group quirks),
    // ctx.onstatechange below still runs goHidden — mute-at-source + bg-WAV handoff —
    // and goVisible/focus resume() covers "suspended" AND "interrupted" on return. ──
    const onVisChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        if (isMobile) goHidden();
        else pumpOnce();   // desktop: keep playing; deepen the runway now (targetFrames() is hidden-aware)
      } else goVisible();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisChange);
      root.addEventListener("pagehide", goHidden);
      root.addEventListener("pageshow", goVisible);
      root.addEventListener("focus", goVisible);
    }
    // ── audio-session interruptions (Siri, calls, timers) suspend/interrupt the ctx
    // with NO visibility change — and on an app switch the ctx statechange often fires
    // BEFORE the (late) visibilitychange, which is the "tiny chunk repeats for a
    // second" window. React to the ctx itself: leave "running" → mute at source
    // immediately (idempotent with goHidden); return to "running" after a survival
    // mute while visible → come back. Gated on survivalMuted so the boot-time
    // resume()'s statechange can't un-idle an unprimed ring. ──
    try {
      ctx.onstatechange = () => {
        if (abort) return;
        const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
        if (ctx.state === "running") { if (survivalMuted && !hidden) goVisible(); }
        else if (ctx.state !== "closed") {
          goHidden();
          if (!hidden) resumeCtx();   // visible suspension = interruption; poke it (revives when iOS releases the session)
        }
      };
    } catch (e) {}

    // ── MediaSession: show WHAT is playing on the iOS lock screen during handoff and
    // wire transport. explorer.html ALREADY owns the action handlers (play→goLive /
    // pause→stopLive) and a richer blend title, so — to NOT regress the deployed app —
    // live.js here only MAINTAINS metadata/playbackState (a host that reasserts a nicer
    // title simply wins, since it fires after) and registers its own play/pause handlers
    // ONLY when explicitly asked (opts.mediaSession) for standalone hosts. Guarded. ──
    const MS = (typeof navigator !== "undefined" && navigator.mediaSession) ? navigator.mediaSession : null;
    function bgSetPlaybackState(s) { if (MS) try { MS.playbackState = s; } catch (e) {} }
    function bgSetMetadata() {
      if (!MS || typeof root.MediaMetadata === "undefined") return;
      let title = "Royal Road";
      try { const st = getState(); if (st) title = st.genre || st.name || (st.genreMeta && st.genreMeta.form) || title; } catch (e) {}
      try { MS.metadata = new root.MediaMetadata({ title: String(title), artist: "Royal Road / aboardresearch", album: "the genre space" }); } catch (e) {}
    }
    if (MS) {
      bgSetMetadata(); bgSetPlaybackState("playing");
      if (opts.mediaSession) {
        try {
          MS.setActionHandler("play", () => goVisible());
          MS.setActionHandler("pause", () => {
            try { Atomics.store(ctrl, C_STATE, 2); masterGain.gain.value = 0; } catch (e) {}
            if (bgActive && bgAudio) { try { bgAudio.pause(); } catch (e) {} bgActive = false; }
            bgSetPlaybackState("paused");
          });
        } catch (e) {}
      }
    }

    // ── boot: init worker0, then let the pump fill the runway; RUN on primed ──
    await ensureWorker(0);
    status("priming…");
    pump();

    const rmsBuf = new Float32Array(analyser.fftSize);
    const analyserRms = () => { analyser.getFloatTimeDomainData(rmsBuf); let s = 0; for (let i = 0; i < rmsBuf.length; i++) s += rmsBuf[i] * rmsBuf[i]; return Math.sqrt(s / rmsBuf.length); };

    const handle = {
      ctx, analyser, errors, mediaEl,
      // VIDEO EXPORT (E): the live master as a MediaStream audio track — the same
      // msDest that feeds the mobile <audio>. video-export.js muxes it with a
      // canvas.captureStream via MediaRecorder. Null on paths without msDest (the
      // exporter falls back to mediaEl.captureStream).
      audioStream: () => (msDest && msDest.stream) || null,
      // ── background-WAV handoff debug hooks (headless verification) ──
      __bgWavReady: () => !!bgUrl,
      __bgUrl: () => bgUrl,
      __bgState: () => ({ enabled: !!wantBg, ready: !!bgUrl, active: bgActive,
        audioSrc: bgAudio ? bgAudio.src : null, audioPaused: bgAudio ? bgAudio.paused : null,
        cstate: (function () { try { return Atomics.load(ctrl, C_STATE); } catch (e) { return null; } })(),
        wantSig: bgWantSig, readySig: bgReadySig }),
      // REAL mixer view — but a baked full-mix can't be de-mixed live: gain/mute/solo
      // are no-ops (buried feature), rms/active are coarse (overall meter + last bar).
      layers() {
        const rms = analyserRms();
        return LAYER_DEFS.map(([id, label]) => {
          const active = lastPlayedLayers.has(id);
          return { id, label, gain: 1, muted: false, solo: false, active,
            rms() { return active ? rms : 0; }, setGain() {}, setMute() {}, setSolo() {} };
        });
      },
      // pre-open the idle worker so a later crossfade is snappy (real speedup proxy)
      prepare(targetState) { try { ensureWorker(cur ? (cur.ring ^ 1) : 1); } catch (e) {} },
      // USER MASTER VOLUME — smooth (click-free) ride of the post-analyser gain.
      setMasterVol(v) { try { userGain.gain.setTargetAtTime(Math.max(0, Math.min(4, +v || 0)), ctx.currentTime, 0.02); } catch (e) {} },
      // VAPOR — live-only master EQ (high-shelf cut + reverb wash), 0..1.
      setVapor(v) { applyVapor(v); },
      // real proxy: runway health ("am I keeping up"); the rest are stubs (deleted machinery)
      loadRatio: () => loadRatio,
      ecoLevel: () => 0,
      nodeCount: () => (cur && cur.sig ? cur.sig.split("|").filter(Boolean).length : 0),
      awakeCount: () => (cur && cur.sig ? cur.sig.split("|").filter(Boolean).length : 0),
      awakeCost: () => 0, costCeiling: () => 0, costStealCount: () => 0,
      poolCount: () => 0, reapCount: () => 0, harvestCount: () => 0, maxWorklets: () => 0, preparedCount: () => 0,
      outputRoute: msDest ? "mediaEl" : "direct",
      workletTruth: () => ({ created: 0, destroyed: 0, alive: 0, counted: 0 }),
      stemStats: () => null,
      journal: () => [],
      sentinel: () => null,
      renderCapacity: () => null,
      // ALWAYS-ON click monitor readout (the acceptance-gate detector). clicks/gaps
      // are the DSP's monotonic counters; null only if the clickmon node failed.
      clickMon: () => clickMonState ? {
        clicks: clickMonState.latest.clicks, gaps: clickMonState.latest.gaps,
        peakjump: clickMonState.latest.peakjump, rms: clickMonState.latest.rms, logs: 0,
      } : null,
      clickMonThr: (v) => { if (clickMonState) try { clickMonState.node.setParamValue("/clickmon/thr", v); } catch (e) {} },
      // ── vocoder speech-carrier wiring debug (headless verification): counts
      // openLive sends that carried a non-null speech buffer vs. null-carrier opens
      // of a vocoder-needing state, and the last carrier length in samples. ──
      __voxSpeech: () => ({ speechOpens: voxSpeechOpens, nullOpens: voxNullOpens, lastLen: lastSpeechLen }),
      // ── INSERTS-ON-SAMPLED-VOICES debug (headless verification): the live
      // per-unit insert-chain twins currently in the graph — declared types,
      // stages actually built, and any types passing dry (no native twin). ──
      __samplerInserts: () => {
        const out = [];
        for (const [k, ent] of samplerPlayers) out.push(ent && ent.chain
          ? { unit: k, types: ent.chain.types.slice(), stages: ent.chain.ch.stages.slice(), skipped: ent.chain.ch.skipped.slice() }
          : { unit: k, types: [], stages: [], skipped: [] });   // chainless sampled unit (no declared inserts)
        return out;
      },
      // ring / underrun telemetry (real — reads the shared control block)
      underruns: () => Atomics.load(ctrl, C_UNDER_CNT),
      underrunFlag: () => Atomics.load(ctrl, C_UNDERRUN),
      runwaySec: () => Math.max(0, feedRunwayFrames()) / SR,
      readCursor: () => read53(),
      rms() { return analyserRms(); },
      balance() {
        if (!this._balTap) {
          const sp = ctx.createChannelSplitter(2);
          const mk = () => { const a = ctx.createAnalyser(); a.fftSize = 2048; return a; };
          const aL = mk(), aR = mk();
          sp.connect(aL, 0); sp.connect(aR, 1);
          masterGain.connect(sp);
          this._balTap = { aL, aR, buf: new Float32Array(2048) };
        }
        const t = this._balTap, r = (a) => { a.getFloatTimeDomainData(t.buf); let s = 0; for (let i = 0; i < t.buf.length; i++) s += t.buf[i] * t.buf[i]; return Math.sqrt(s / t.buf.length); };
        return { l: r(t.aL), r: r(t.aR) };
      },
      stop() {
        abort = true;
        clearTimeout(pumpTimer); if (barTimer) clearInterval(barTimer); if (loadTimer) clearInterval(loadTimer);
        if (fadeTimer) clearInterval(fadeTimer); if (swapTimer) clearInterval(swapTimer);
        if (elRecycleTimer) clearInterval(elRecycleTimer);
        if (bgPollTimer) clearInterval(bgPollTimer); if (bgDebounceTimer) clearTimeout(bgDebounceTimer);
        Atomics.store(ctrl, C_STATE, 2);   // stopped — ring-player emits silence
        for (const w of workers) if (w) { try { w.postMessage({ type: "stop" }); } catch (e) {} }
        if (bgWorker) { try { bgWorker.postMessage({ type: "stop" }); } catch (e) {} }
        if (typeof document !== "undefined") {
          document.removeEventListener("visibilitychange", onVisChange);
          root.removeEventListener("pagehide", goHidden);
          root.removeEventListener("pageshow", goVisible);
          root.removeEventListener("focus", goVisible);
        }
        const tNow = ctx.currentTime;
        try { masterGain.gain.cancelScheduledValues(tNow); masterGain.gain.setValueAtTime(masterGain.gain.value, tNow); masterGain.gain.linearRampToValueAtTime(0, tNow + 0.06); } catch (e) {}
        if (mediaEl) { try { mediaEl.pause(); mediaEl.srcObject = null; mediaEl.remove(); } catch (e) {} }
        if (bgAudio) { try { bgAudio.pause(); bgAudio.src = ""; bgAudio.remove(); } catch (e) {} }
        if (bgUrl) { try { root.URL.revokeObjectURL(bgUrl); } catch (e) {} bgUrl = null; }
        try { foundBeds.stopAll(); foundChops.stopAll(); foundVox.stopAll(); } catch (e) {}
        for (const [, ent] of samplerPlayers) { try { ent.player.stopAll(); } catch (e) {} try { teardownSamplerChain(ent); } catch (e) {} }
        setTimeout(() => { for (const w of workers) if (w) { try { w.terminate(); } catch (e) {} } if (bgWorker) { try { bgWorker.terminate(); } catch (e) {} } try { ctx.close(); } catch (e) {} }, 1200);
        status("stopped");
      },
    };
    root.FaustLive.lastHandle = handle;
    return handle;
  }

  // ============================================================ WAV-FIRST CONDUCTOR
  // The mobile audible path (WAV-FIRST.md). NO AudioWorklet, NO rings, NO MediaStream,
  // NO bg-WAV producer. The AudioContext exists ONLY for decodeAudioData (PCM prep)
  // and may suspend freely — nothing audible depends on it. A single stream-worker in
  // the openLiveSegs sink renders the FULL press-parity mix (found + sampler + synth,
  // baked) into consecutive WAV segments cut on chord-bar downbeats; two <audio>
  // elements (A/B, both unlocked in the goLive gesture) play them back-to-back. Steering
  // takes effect at the next segment boundary — fully dynamic, just coarser than the ring.
  async function exploreLiveWav(getState, onStatus, opts) {
    opts = opts || {};
    const E = root.CsdEngine, SE = root.FaustStateEngine, FP = root.FoundPlayer, SP = root.FaustSampler;
    if (!E || !SE || !FP) throw new Error("FaustLive needs csd-engine.js, faust/state-engine.js, faust/found-player.js loaded first");
    const status = (m) => { if (onStatus) try { onStatus(m); } catch (e) {} };
    const errors = [];
    const SEG_SEC = opts.segSec > 0 ? opts.segSec : 16;
    const FIRST_SEG_SEC = opts.firstSegSec > 0 ? opts.firstSegSec : 4;

    // ── boot instrumentation (WAV-FIRST v3.1 item 2): stage timeline so a slow boot
    // stage is visible on-device instead of a mute mystery. Each mark() records ms from
    // the goLive gesture and emits a status(); handle.bootStats() exposes the timeline. ──
    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    const t0Boot = now();
    const bootStats = { workerInit: 0, decodeDone: 0, firstFlush: 0, firstAppend: 0, firstSound: 0 };
    function mark(stage) {
      if (bootStats[stage]) return;
      bootStats[stage] = Math.round(now() - t0Boot);
      status("boot:" + stage + " " + bootStats[stage] + "ms");
    }

    // ── v3 route selection (WAV-FIRST.md v3): ONE <audio> element fed a continuous
    // MP3 stream via (Managed)MediaSource — the "synthesized radio station". Falls back
    // to the v2 A/B element pair (segAB) where the API/codec is absent OR ?segAB=1 forces
    // it. outputRoute reports "mms-mp3" (iOS 17.1+) / "mse-mp3" (chromium test path) /
    // "segAB" so the device state is inspectable. ──
    const forceSegAB = !!opts.segAB;
    // ── v4 CODEC LADDER (WAV-FIRST.md v4): mms-aac → mse-aac → mse-opus → mms-mp3 /
    // mse-mp3 → segAB. AAC-in-fMP4 is the device target (explicit tfdt cures the mms-mp3
    // lurch); Opus-in-fMP4 is the linux-chromium gate route (identical muxer/append, only
    // the codec string differs); mp3 (lamejs) and the segAB A/B pair remain as lower tiers.
    // ?codec=mp3|opus|aac overrides for testing. ──
    const codecOverride = (opts.codec === "mp3" || opts.codec === "opus" || opts.codec === "aac") ? opts.codec : null;
    const MMS = root.ManagedMediaSource, MSC = root.MediaSource, MSctor = MMS || MSC;
    const T_AAC = 'audio/mp4; codecs="mp4a.40.2"', T_OPUS = 'audio/mp4; codecs="opus"', T_MP3 = "audio/mpeg";
    function mseTypeOk(t) { try { if (MMS && MMS.isTypeSupported) return MMS.isTypeSupported(t); if (MSC && MSC.isTypeSupported) return MSC.isTypeSupported(t); } catch (e) {} return false; }
    const canAudioEl = typeof document !== "undefined" && typeof root.Audio !== "undefined";
    // synchronous CONTAINER support (the MSE demuxer); the ENCODER half is confirmed async
    // by the worker's AudioEncoder probe (round-trip), since worker support is what matters.
    const contAac = mseTypeOk(T_AAC), contOpus = mseTypeOk(T_OPUS), contMp3 = mseTypeOk(T_MP3);
    function containerOk(c) { return c === "aac" ? contAac : c === "opus" ? contOpus : c === "mp3" ? contMp3 : false; }
    // provisional codec (in-gesture, before the worker caps land — the media element +
    // MediaSource attach must happen in the gesture; the SourceBuffer codec string is only
    // committed at addSourceBuffer, deferred until finalizeCodec confirms the encoder).
    function provisionalCodec() {
      if (codecOverride) return containerOk(codecOverride) ? codecOverride : null;
      for (const c of ["aac", "opus", "mp3"]) if (containerOk(c)) return c;
      return null;
    }
    // authoritative pick once the worker reports {aac,opus} encoder caps.
    function pickCodec(caps) {
      caps = caps || {};
      const viable = (c) => containerOk(c) && (c === "mp3" ? true : c === "aac" ? !!caps.aac : c === "opus" ? !!caps.opus : false);
      if (codecOverride) return viable(codecOverride) ? codecOverride : null;
      for (const c of ["aac", "opus", "mp3"]) if (viable(c)) return c;
      return null;
    }
    // Route state is MUTABLE (WAV-FIRST v3.1/v4): the worker probe finalizes the codec and
    // the watchdog can demote to segAB at runtime, so useMp3/codec/isFmp4/isMMS/outRoute are
    // `let` and every read site reads them LIVE. `useMp3` = "encoded MSE append route active"
    // (any of aac/opus/mp3 — the continuous-append pipeline, vs. the segAB A/B fallback).
    let codec = (canAudioEl && !forceSegAB && !!MSctor) ? provisionalCodec() : null;
    let useMp3 = !!codec;
    let isFmp4 = codec === "aac" || codec === "opus";
    let isMMS = useMp3 && !!MMS;
    let outRoute = useMp3 ? ((isMMS ? "mms-" : "mse-") + codec) : "segAB";
    // MP3 append tunables: small flush = ~append cadence = steering latency (a bar or two).
    const MP3_FLUSH_SEC = opts.mp3FlushSec > 0 ? opts.mp3FlushSec : 2;
    const MP3_FIRST_SEC = opts.mp3FirstSec > 0 ? opts.mp3FirstSec : (opts.firstSegSec > 0 ? opts.firstSegSec : 2);
    const MP3_KBPS = opts.mp3Kbps > 0 ? opts.mp3Kbps : 192;
    // MP3 buffer hygiene. FEED_CAP_MP3 = forward render/buffer depth ≈ steering latency
    // (a modest few seconds: responsive steer + a pocket cushion, not a 30s+ backlog the
    // walk can't see a steer past). KEEP_BEHIND bounds the played tail. FWD_CAP caps the
    // appended-ahead so the buffered range stays bounded even if a producer bursts.
    // heard-lag = render backlog (FEED_CAP_MP3) + appended-ahead (FWD_CAP): keep the
    // sum tight — it is ALSO the steering/UI latency (device feedback 2026-07-07:
    // 8+14 read as "the scheduler is off"). Cushion still >=5s for pocket CPU dips.
    const KEEP_BEHIND = 12, FWD_CAP = 10, FEED_CAP_MP3 = 5;

    // AudioContext for DECODE ONLY (44100 so decoded PCM is 1:1 with the render rate).
    const AC = root.AudioContext || root.webkitAudioContext;
    let ctx;
    try { ctx = new AC({ sampleRate: SR, latencyHint: "playback" }); } catch (e) { ctx = new AC(); }
    try { ctx.resume(); } catch (e) {}

    // ── decode caches (main thread → mono Float32 shipped to the worker as COPIES) ──
    const foundPCM = {}, samplerPCM = {}, speechPCM = {};
    const foundJobs = {}, samplerJobs = {}, speechJobs = {};
    const monoOf = (b) => {
      if (!b || !b.length) return null;
      if (b.numberOfChannels <= 1) return Float32Array.from(b.getChannelData(0));
      const n = b.length, a = b.getChannelData(0), c = b.getChannelData(1), o = new Float32Array(n);
      for (let i = 0; i < n; i++) o[i] = (a[i] + c[i]) * 0.5;
      return o;
    };
    const urlOf = (s) => s && (s.url || (s.samplePath ? new URL(s.samplePath, SITE).href : null));
    // decode-failure telemetry: on-device (iOS decodeAudioData is strict) a failed or
    // empty decode is SILENT sample-lessness — count outcomes + keep the first reasons
    // so ?wavDebug=1 shows exactly why a layer is missing (device report 2026-07-07:
    // "no soundfont or samples at all really").
    const decFails = [];
    const noteFail = (kind, id, e) => { if (decFails.length < 8) decFails.push(kind + ":" + id + " " + String((e && e.message) || e || "null")); };
    // ── decode CONCURRENCY GATE + bounded RETRY (WAV-FIRST resilience). The sampled-by-
    // default change made every pitched voice depend on heavy multi-zone GM sample decodes
    // (~20-29 zones/genre). iOS decodeAudioData is slow + strict: firing them all at once
    // (a) chokes the decoder (slow + spurious failures, so a melody/pad/lead never becomes
    // audible) and (b) floods the MAIN THREAD with big Float32 copies, starving the 40ms
    // feed pump so the whole stream dies out for many bars, then recovers. Cap the burst to
    // a few in flight; RETRY a transient failure a bounded number of times (a null/empty
    // decode counts as failure) so ONE flaky decode never permanently silences a voice.
    const decGate = makeDecGate(opts.decodeConcurrency, opts.decodeRetries, opts.decodeRetryMs);
    // run one decode through the shared gate; a throw OR a null/empty result is retried,
    // and only a final failure is noted (for the ?wavDebug forensics). Retries stop on abort.
    async function decWithRetry(kind, id, fn, ok) {
      const { v, err } = await decGate.run(fn, ok, () => !abort);
      if (!ok(v)) noteFail(kind, id, err);
      return v;
    }
    function decodeStats() {
      const c = (m) => { let ok = 0, fail = 0; for (const k of Object.keys(m)) { if (m[k] === null) fail++; else if (m[k]) ok++; } return { ok, fail }; };
      return { found: c(foundPCM), sampler: c(samplerPCM), speech: c(speechPCM), fails: decFails.slice(), ...decGate.stats() };
    }
    function decFound(s) {
      const id = s.id; if (foundJobs[id]) return foundJobs[id];
      if (s.synthText)   // SPEECH organ: synthesize instead of fetch (shared url-keyed cache)
        return foundJobs[id] = decWithRetry("found", id,
          () => FP.synthToBuffer(ctx, s.synthText).then((b) => (b && b.length ? Float32Array.from(b.getChannelData(0)) : null)),
          (p) => !!p).then((p) => foundPCM[id] = p);
      // ABSENT-SOURCE UN-PIN (same class as the ring path's kickSamplerBuf): a
      // urlless stub marks null WITHOUT pinning a job, so a later state carrying
      // the same id WITH a real url still gets its decode (null + no job = stub,
      // retryable; null + job = a REAL decode failure after retries, final).
      const url = urlOf(s); if (!url) { foundPCM[id] = null; return Promise.resolve(null); }
      if (foundPCM[id] === null) delete foundPCM[id];   // stub null superseded by a real url: back to "in flight"
      return foundJobs[id] = decWithRetry("found", id,
        () => FP.decodeUrlToBuffer(ctx, url).then((b) => (b && b.length ? Float32Array.from(b.getChannelData(0)) : null)),
        (p) => !!p).then((p) => foundPCM[id] = p);
    }
    function decSampler(s) {
      const id = s.id; if (samplerJobs[id]) return samplerJobs[id];
      const url = urlOf(s);
      if (!SP) return samplerJobs[id] = Promise.resolve(samplerPCM[id] = null);
      if (!url) { samplerPCM[id] = null; return Promise.resolve(null); }   // stub: null but UNPINNED (see decFound)
      if (samplerPCM[id] === null) delete samplerPCM[id];   // stub null superseded by a real url: back to "in flight"
      return samplerJobs[id] = decWithRetry("sampler", id,
        () => SP.decodeUrlRaw(ctx, url).then((b) => monoOf(b)),
        (p) => !!p).then((p) => samplerPCM[id] = p);
    }
    function decSpeech(s) {
      const id = s.id; if (speechJobs[id]) return speechJobs[id];
      if (s.synthText)   // SPEECH organ: synthesize instead of fetch (shared url-keyed cache)
        return speechJobs[id] = decWithRetry("speech", id,
          () => FP.synthToBuffer(ctx, s.synthText).then((b) => (b && b.length ? Float32Array.from(b.getChannelData(0)) : null)),
          (p) => !!p).then((p) => speechPCM[id] = p);
      const url = urlOf(s); if (!url) return speechJobs[id] = Promise.resolve(speechPCM[id] = null);
      return speechJobs[id] = decWithRetry("speech", id,
        () => FP.decodeUrlToBuffer(ctx, url).then((b) => (b && b.length ? Float32Array.from(b.getChannelData(0)) : null)),
        (p) => !!p).then((p) => speechPCM[id] = p);
    }
    function speechSourceOf(state) {
      const fs = (state && state.foundSources) || [];
      return fs.find((s) => s.id === state.vocoderSourceId) || fs.find((s) => /^(sp_|vx_|vox_)/.test(s.id || "")) || null;
    }
    // enumerate the found/sampler/speech SOURCES a state needs (mirrors press.decodeInputs),
    // WITHOUT decoding — v3.1 opens producers immediately with whatever PCM is already
    // cached and streams the rest in as it decodes (never awaits the fetch before bar 1).
    function neededBuffers(state) {
      const sched = SE.buildSchedule(E, state);
      const byId = {}; for (const s of (state.foundSources || [])) byId[s.id] = s;
      const foundSrcs = [], samplerSrcs = [];
      const seenF = new Set(), seenS = new Set();
      for (const f of sched.found) if (byId[f.srcId] && !seenF.has(f.srcId)) { seenF.add(f.srcId); foundSrcs.push(byId[f.srcId]); }
      for (const u of Object.values(sched.units)) if (u && u.sampler) for (const z of u.sampler.zones)
        if (byId[z.srcId] && !seenS.has(z.srcId)) { seenS.add(z.srcId); samplerSrcs.push(byId[z.srcId]); }
      const needVoc = Object.values(sched.units).some((u) => u && u.vocoder);
      const speechSrc = needVoc ? speechSourceOf(state) : null;
      return { foundSrcs, samplerSrcs, speechSrc };
    }

    // ── THE WALK: the one authoritative section/ci/serial walk, shared with the ring
    // conductor (makeWalk). Polls getState() each bar; steering takes effect next bar. ──
    const stepWalk = makeWalk(getState, E, SE, (opts && opts.startBar) | 0);   // drop-in at the bookmarked measure

    // ── the producer workers: TWO, ping-ponged per gen (gen%2) so a new gen renders
    // its first segment IN PARALLEL with the OLD gen still feeding+playing (the ring
    // path's two-producer pattern). One worker = one isolated engine; a single worker
    // can't run two opens at once (opChain + activeToken supersede), so parallel gen
    // cutover REQUIRES the second worker. ──
    const OVERLAP_SEC = opts.seamOverlapSec > 0 ? opts.seamOverlapSec : 0.120;
    // Bridge overlap for the APPEND routes. The stitch's gen-bridge consumes its
    // overlap window from MUSICAL time (old tail and new head sound simultaneously),
    // so every instrument-handoff reopen pulls the next downbeat OV early. At the
    // segAB tier 120ms is right — it masks real element-swap gaps. In continuous
    // PCM there is no gap to mask, only a click to guard: 15ms keeps the splice
    // clean and makes the time-theft imperceptible (device log 2026-07-08: groove
    // "lurching" every ~7s on mms-aac with drift pinned at 0 — the bridges were it).
    const BRIDGE_OV_SEC = opts.bridgeOverlapSec > 0 ? opts.bridgeOverlapSec : 0.015;
    // ── DECODE-THEN-RENDER caps (the iOS pitched-voice fix — see reopen()) ──
    // The producer WAITS for this gen's found/sampler PCM to decode (through the shared
    // decGate) BEFORE it opens, so the buffers are present from bar 0 and no pitched-sample
    // bar bakes PERMANENTLY silent (the bakeNative found/sampler layers are filtered/summed
    // against ST.buffers AT bake time — a buffer that lands after its bar is baked is lost
    // for that bar; the ring path never showed the bug because it decodes JIT per bar and
    // won't render a bar until its buffers are ready). The wait is capped so it never hangs:
    // BOOT waits longer (nothing is playing yet — completeness over instant start, Paul), a
    // GEN cutover waits less (the OLD gen keeps playing over the wait, so a long stall would
    // gap it). Past the cap, stragglers still stream in via addBuffers (the safety net) and
    // pop into LATER bars — correctness no longer DEPENDS on that pop-in.
    const BOOT_DECODE_CAP_MS = opts.bootDecodeCapMs > 0 ? opts.bootDecodeCapMs : 8000;
    const GEN_DECODE_CAP_MS = opts.genDecodeCapMs > 0 ? opts.genDecodeCapMs : 4000;
    // decode-then-render kill-switch (default ON). false = revert to v3.1 open-immediately.
    const DECODE_THEN_RENDER = opts.decodeThenRender !== false;
    const workers = [null, null], workerReady = [false, false];
    const workerReadyProm = [null, null], readyResolve = [null, null];
    function ensureWorker(k) {
      if (workerReadyProm[k]) return workerReadyProm[k];
      workerReadyProm[k] = new Promise((resolve) => {
        readyResolve[k] = resolve;
        const w = new Worker(BASE + "stream-worker.js", { type: "module" });
        workers[k] = w;
        w.onmessage = (e) => onMsg(e.data, k);
        w.onerror = (e) => errors.push("wavworker" + k + " error: " + ((e && e.message) || e));
        w.postMessage({ type: "init" });
      });
      return workerReadyProm[k];
    }

    // ── gen / feed state. Only the NEWEST gen (curGen) is fed; on a sig change the OLD
    // gen is told to drain (feedEos) and keeps PLAYING its already-emitted segments while
    // the new gen renders ahead on the other worker — no-stall cutover. ──
    let genCounter = 0, curGen = 0, curSig = null, abort = false, started = false, firstSound = false;
    let opening = false, ready = false, preFeed = [], lastOne = null;
    let fedSinceOpen = 0, producedSinceOpen = 0;   // per-curGen musical-second accounting
    let receivedSegs = 0;
    let curGenReceived = 0, curGenPlayed = 0;      // curGen backpressure (unplayed-ahead bound)

    function workerOf(gen) { return workers[gen % 2]; }
    function postFeed(r) {
      workerOf(curGen).postMessage({ type: "feedBar", bar: {
        units: r.units, events: r.events, fxParams: r.fxParams, spb: r.spb, lo: r.lo, hi: r.hi,
        barStartSec: r._base, sweeps: r._sweeps, found: r.found, foundCi: r.meta.ci, meta: r.meta } });
    }
    // stream the not-yet-cached found/sampler PCM of gen `gen` in as it decodes: each
    // decode posts an addBuffers to that gen's worker, whose engine merges it into the
    // live buffer table so bars baked after arrival carry the layer (ring-path pop-in).
    function shipBuffer(gen, id, pcm) {
      if (abort || curGen !== gen || !pcm) return;
      const c = pcm.slice();   // COPY: a transfer would detach the main-thread cache
      try { workerOf(gen).postMessage({ type: "addBuffers", gen, buffers: { [id]: c } }, [c.buffer]); } catch (e) {}
    }
    // ship a late-decoded vocoder speech CARRIER into gen `gen`'s worker (mirrors shipBuffer):
    // the engine rebinds its vocoder unit's carrier so the robot sings once the carrier lands,
    // instead of the open blocking on it (the whole stream was silent until speech decoded).
    function shipSpeech(gen, sp) {
      if (abort || curGen !== gen || !sp || !sp.length) return;
      const c = sp.slice();
      try { workerOf(gen).postMessage({ type: "setSpeech", gen, speech: c }, [c.buffer]); } catch (e) {}
    }
    function streamBuffers(gen, need, initial) {
      const rest = (srcs, dec, cache, jobs) => {
        for (const s of srcs) {
          if (initial[s.id]) continue;                 // already shipped at open
          // null + a pinned job = a REAL decode failure (final); null WITHOUT a
          // job is an absent-source stub — retry it, this state may carry the url
          if (cache[s.id] === null && jobs[s.id]) continue;
          if (cache[s.id] != null) { shipBuffer(gen, s.id, cache[s.id]); continue; }  // cached since open — ship now
          dec(s).then((pcm) => shipBuffer(gen, s.id, pcm));
        }
      };
      rest(need.foundSrcs, decFound, foundPCM, foundJobs);
      rest(need.samplerSrcs, decSampler, samplerPCM, samplerJobs);
    }

    // reopen(state) — DECODE-THEN-RENDER (the iOS pitched-voice fix). The producer bakes a
    // bar's sampler/found layer against the buffer table it holds AT bake time and drops any
    // buffer that isn't there yet (bakeNative in stream-renderer), so a bar baked+encoded+
    // appended before its sample decoded is PERMANENTLY silent for that voice — and on iOS
    // decodeAudioData is slow enough that the v3.1 "open empty, pop-in later" model baked
    // most pitched-sample bars silent (the reported "only drums+bass"). The proven-good ring
    // path decodes JIT and never renders a bar until its buffers are ready; we mirror that
    // here: decode this gen's needed found/sampler PCM through the shared gate BEFORE opening
    // the producer, and SHIP the decoded buffers in the open payload so bar 0 already carries
    // them. The wait is capped (BOOT longer, GEN cutover shorter — the old gen covers it) so
    // a truly stuck decode never hangs; anything still missing past the cap streams in via
    // addBuffers (the secondary safety net) — correctness no longer DEPENDS on the pop-in.
    // The vocoder speech carrier keeps its NON-BLOCKING gate (open with whatever carrier is
    // cached, ship it later via setSpeech) so robot_choir doesn't hum and first sound never
    // waits on the ONE slow carrier decode.
    function reopen(state) {
      const prevGen = curGen;
      const gen = ++genCounter; curGen = gen; opening = true; ready = false; preFeed = [];
      fedSinceOpen = 0; producedSinceOpen = 0; curGenReceived = 0; curGenPlayed = 0;
      if (!firstSound) status("decoding…");
      const bridge = started;   // first-ever open boots from silence; later opens bridge a prior gen's tail
      // old gen: stop feeding, drain its partial + close. Its ALREADY-EMITTED segments keep
      // playing while THIS gen decodes its buffers — that is the no-gap gen-cutover cover.
      if (started && prevGen && prevGen !== gen) { try { workerOf(prevGen).postMessage({ type: "feedEos" }); } catch (e) {} }
      const stateCopy = JSON.parse(JSON.stringify(state));
      const wIdx = gen % 2;
      const need = neededBuffers(state);
      // boot decode timeline: mark when ALL of gen0's inputs have finished decoding.
      if (!bootStats.decodeDone) {
        const jobs = [];
        for (const s of need.foundSrcs) jobs.push(decFound(s));
        for (const s of need.samplerSrcs) jobs.push(decSampler(s));
        if (need.speechSrc) jobs.push(decSpeech(need.speechSrc));
        Promise.all(jobs).then(() => mark("decodeDone"), () => mark("decodeDone"));
      }

      const doOpen = (speech, initial) => {
        if (abort || curGen !== gen) return;
        // retire whatever the ping-pong twin (gen-2) left on this worker before opening.
        try { workers[wIdx].postMessage({ type: "stop" }); } catch (e) {}
        const buffers = {}, transfer = [];
        for (const id of Object.keys(initial)) { const c = initial[id].slice(); buffers[id] = c; transfer.push(c.buffer); }
        const sp = speech && speech.length ? speech.slice() : null;
        if (sp) transfer.push(sp.buffer);
        if (useMp3) {
          // v3: producer posts CLEAN PCM flushes; the encoder worker owns the seam
          // blend + the single encoder, so no per-producer fade/bridge here.
          workers[wIdx].postMessage({ type: "openLivePcm", gen, state: stateCopy, buffers, speech: sp,
            segSec: MP3_FLUSH_SEC, firstSegSec: MP3_FIRST_SEC }, transfer);
        } else {
          workers[wIdx].postMessage({ type: "openLiveSegs", gen, state: stateCopy, buffers, speech: sp,
            segSec: SEG_SEC, firstSegSec: FIRST_SEG_SEC, overlapSec: OVERLAP_SEC, bridgeIn: bridge }, transfer);
        }
        if (curGen !== gen) return;
        ready = true; opening = false;
        for (const r of preFeed) postFeed(r); preFeed = [];
        streamBuffers(gen, need, initial);   // stream anything STILL uncached (cap timeout) in as it lands
      };

      // open once this gen's found/sampler PCM is decoded (or the cap elapses): snapshot every
      // buffer decoded BY NOW and ship them ALL in the open, so the bars bake with them present.
      const openNow = () => {
        if (abort || curGen !== gen) return;
        const initial = {};
        for (const s of need.foundSrcs) if (foundPCM[s.id]) initial[s.id] = foundPCM[s.id];
        for (const s of need.samplerSrcs) if (samplerPCM[s.id]) initial[s.id] = samplerPCM[s.id];
        // speech stays NON-BLOCKING: open with whatever carrier is cached (null on cold boot →
        // the vocoder unit renders silence, no hum), ship the decoded carrier later via setSpeech.
        const sp0 = (need.speechSrc && speechPCM[need.speechSrc.id]) ? speechPCM[need.speechSrc.id] : null;
        if (workerReady[wIdx]) doOpen(sp0, initial); else ensureWorker(wIdx).then(() => doOpen(sp0, initial));
        if (need.speechSrc && speechPCM[need.speechSrc.id] === undefined)
          decSpeech(need.speechSrc).then((sp) => shipSpeech(gen, sp));
      };

      // kick the found/sampler decodes through the gate (idempotent — a cached/failed source
      // returns its resolved job) and await them, CAPPED. BOOT waits longer; a gen cutover
      // waits less (the old gen keeps playing). All-cached → resolves next microtask (an
      // instant cutover within a genre region); genuinely-new samples → the brief decode wait.
      const decCap = firstSound ? GEN_DECODE_CAP_MS : BOOT_DECODE_CAP_MS;
      const decJobs = [];
      for (const s of need.foundSrcs) decJobs.push(decFound(s));
      for (const s of need.samplerSrcs) decJobs.push(decSampler(s));
      // DECODE_THEN_RENDER default ON. `?decodeFirst=0` (opts.decodeThenRender===false) restores
      // the v3.1 open-immediately behaviour — the kill-switch AND the live-resilience repro's
      // "before": under slow decode it opens with empty buffers so pitched-sample bars bake
      // silent, which the repro asserts against the ON path (same shipped code, both modes).
      if (DECODE_THEN_RENDER === false || !decJobs.length) { openNow(); return; }
      Promise.race([Promise.all(decJobs), new Promise((res) => setTimeout(res, decCap))]).then(openNow, openNow);
    }
    function feedSeg(r) {
      r._base = fedSinceOpen;
      r._sweeps = (r.sweepsRaw || []).map((sw) => ({ t0: r._base + (sw.beat - r.lo) * r.spb,
        t1: r._base + (sw.beat + sw.durB - r.lo) * r.spb, from: sw.from, to: sw.to }));
      fedSinceOpen += r.musicalSec;
      if (ready) postFeed(r); else preFeed.push(r);
    }

    // ── feed pump: keep ~MAX_UNPLAYED segments of the current gen in flight ──
    const MAX_UNPLAYED = 3;
    const FEED_CAP = FIRST_SEG_SEC + 1.6 * SEG_SEC;
    // route-aware backpressure. segAB: bound unplayed segments + rendered-ahead seconds.
    // mp3: bound the forward runway (received-not-yet-played seconds) so the buffered
    // range and memory stay bounded (the encoder/append pipeline drains what we feed).
    function feedRoom() {
      // mp3: bound BOTH the forward buffer (received − currentTime) AND how far feeding
      // runs ahead of production, so the pump keeps stepping the walk near real time and
      // sees a steer within ~a flush instead of idling behind a huge backlog.
      if (useMp3) return mp3AheadSec() < FEED_CAP_MP3 && (fedSinceOpen - producedSinceOpen) < (2 * MP3_FLUSH_SEC + 1);
      return (curGenReceived - curGenPlayed) < MAX_UNPLAYED && (fedSinceOpen - producedSinceOpen) < FEED_CAP;
    }
    // ── PER-BAR DECODE-AHEAD (the ring path's lesson, one level deeper). An
    // instrument swap WITHIN a gen (holdUntil churn: sampler→sampler keeps the
    // topology sig, so no reopen — and only reopen decoded buffers) leaves bars
    // referencing zones the worker was never shipped; those bars BAKE silent for
    // that voice. Device audit 2026-07-09 caught it exactly: pad[ins_church_organ_*,
    // ins_ohh_voices_*…] missing on the bars right after "new hands on the pads",
    // decode count frozen — the decodes were never requested. So: before feeding a
    // bar, kick any missing PCM through the decode gate and HOLD that bar briefly
    // until it lands (the 5-8s forward runway absorbs the hold inaudibly); past the
    // cap, feed anyway (addBuffers pop-in + the audit catch the residual). ──
    const BAR_DECODE_CAP_MS = opts.barDecodeCapMs > 0 ? opts.barDecodeCapMs : 2500;
    const wallNow = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    let heldBar = null, heldUntil = 0;
    function barMissing(r) {
      const byId = {}; for (const s of ((r.one && r.one.foundSources) || [])) byId[s.id] = s;
      const out = [], seen = new Set();
      // only DECODABLE sources may hold a bar (url or speech-organ synthText):
      // a malformed src would otherwise re-hold every bar for the full cap.
      const need = (id, kind) => { const s = byId[id];
        if (!seen.has(id) && s && (s.synthText || urlOf(s))) { seen.add(id); out.push({ id, src: s, kind }); } };
      // undefined = never requested; null WITHOUT a job = an absent-source stub
      // null (see decSampler) — re-request it now that the bar may carry the src.
      const miss = (cache, jobs, id) => cache[id] === undefined || (cache[id] === null && !jobs[id]);
      for (const u of Object.values(r.units || {})) if (u && u.sampler)
        for (const z of (u.sampler.zones || [])) if (miss(samplerPCM, samplerJobs, z.srcId)) need(z.srcId, "s");
      for (const f of (r.found || [])) if (miss(foundPCM, foundJobs, f.srcId)) need(f.srcId, "f");
      return out;
    }
    let pumpTimer = 0;
    function pump() {
      if (abort) return;
      try {
        let guard = 0;
        while (!abort && guard < 64 && !opening && feedRoom()) {
          if (heldBar) {   // waiting on this bar's PCM: feed when decoded (or past the cap)
            if (barMissing(heldBar).length && wallNow() < heldUntil) break;
            const r2 = heldBar; heldBar = null;
            feedSeg(r2); guard++; continue;
          }
          const r = stepWalk();
          lastOne = r.one;   // remembered so a watchdog demotion can re-open the CURRENT gen
          if (!started || r.sig !== curSig) { curSig = r.sig; reopen(r.one); started = true; }
          const miss = DECODE_THEN_RENDER ? barMissing(r) : [];   // same kill-switch as the open-time decode (?decodeFirst=0 = the old fire-and-hope behavior, kept for the A/B gate)
          if (miss.length) {
            const gen = curGen;
            for (const m of miss) (m.kind === "s" ? decSampler(m.src) : decFound(m.src))
              .then((pcm) => shipBuffer(gen, m.id, pcm));
            heldBar = r; heldUntil = wallNow() + BAR_DECODE_CAP_MS;
            break;
          }
          feedSeg(r); guard++;
        }
      } catch (e) { errors.push("wavpump: " + (e && e.message || e)); console.error("FaustLiveWav pump", e); }
      pumpTimer = setTimeout(pump, 40);
    }

    function onMsg(m, k) {
      if (!m || !m.type) return;
      if (m.type === "ready") { workerReady[k] = true; if (readyResolve[k]) readyResolve[k](); return; }
      if (m.type === "initfail") { errors.push("wavworker" + k + " initfail: " + m.error); return; }
      if (m.type === "openfail") { errors.push("openfail gen" + m.gen + ": " + m.error); return; }
      if (m.type === "pcmseg") {
        if (!useMp3) return;   // route demoted to segAB mid-flight — drop stale PCM flushes
        // v3: a clean PCM flush → queue it for the encoder feed (timeline-ordered).
        mark("firstFlush");
        receivedSegs++;
        if (m.gen === curGen) { curGenReceived++; producedSinceOpen += m.durSec; }
        receivedPcmSec += m.durSec || 0;
        putPcm({ gen: m.gen, idx: m.idx, L: m.L, R: m.R, n: m.n, durSec: m.durSec, barMap: m.barMap || [] });
        pumpEncoder();
        return;
      }
      if (m.type === "seg") {
        mark("firstFlush");
        let url = null;
        try { url = root.URL.createObjectURL(new root.Blob([m.wav], { type: "audio/wav" })); }
        catch (e) { errors.push("wavseg blob: " + (e && e.message || e)); return; }
        const seg = { url, gen: m.gen, idx: m.idx, durSec: m.durSec, bodySec: m.bodySec != null ? m.bodySec : m.durSec,
          overlapSec: m.overlapSec != null ? m.overlapSec : OVERLAP_SEC, rmsEnv: m.rmsEnv, barMap: m.barMap || [] };
        receivedSegs++;
        if (m.gen === curGen) { curGenReceived++; producedSinceOpen += seg.bodySec; }
        onSeg(seg);
        return;
      }
      if (m.type === "segeos" || m.type === "segstopped") { if (useMp3) { genDone.set(m.gen, true); pumpEncoder(); } return; }
      // openedSegs: informational
    }

    // a hidden, inline-playing <audio> element attached to the page (shared by the A/B
    // segAB elements and the single MP3 element).
    function mkHiddenAudio() {
      const el = new root.Audio();
      el.autoplay = false; el.loop = false; el.preload = "auto";
      el.setAttribute("playsinline", ""); el.playsInline = true; el.style.display = "none";
      if (typeof document !== "undefined" && document.body) document.body.appendChild(el);
      return el;
    }
    // ── A/B <audio> playback (both unlocked in the goLive gesture) ──
    function mkEl() {
      const el = mkHiddenAudio();
      try { el.muted = true; el.src = silentWavDataUri(120); const pr = el.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {}
      return el;
    }
    // v3.1: the segAB A/B elements are created + unlocked IN THE GESTURE on ALL routes
    // (cheap dormant insurance) so a watchdog demotion from mp3 has playable, unlocked
    // elements ready with no second gesture. On the mp3 route they simply stay idle.
    const canEls = canAudioEl;
    const els = canEls ? [mkEl(), mkEl()] : [null, null];

    // ══════════════════════════════════ v3 MP3 APPEND PIPELINE (mms-mp3 / mse-mp3)
    // ONE <audio> element fed a continuous MP3 bitstream through (Managed)MediaSource.
    // The two producer workers post CLEAN PCM flushes (both gens, in parallel); the
    // dedicated encoder worker (faust/mp3-worker.js) owns the SINGLE encoder + the seam
    // crossfade and hands back mp3 chunks; here we serialize appends under `updateend`,
    // evict behind currentTime, and honor MMS start/endstreaming. No element switching,
    // no playback-side fades — the gen bridge is a PCM crossfade inside the one encoder.
    let encWorker = null, encReady = false, encOpened = false, encCaps = null;
    let encEpoch = 0;                     // bumped per encoder (re)open; stamped on every
                                          // encopen/mp3open so stale cross-codec posts from a
                                          // superseded encoder (after a step-down) are dropped.
    let mp3El = null, mediaSrc = null, srcBuf = null, sbOpen = false;
    let msOpened = false, codecFinalized = false;                 // v4: source open / codec committed
    let pendingInit = null, initAppended = false, appendingInit = false;   // v4: fMP4 init segment (ftyp+moov)
    let mmsWants = !isMMS;                 // plain MSE: append proactively; MMS: only when asked
    const appendQ = [];                   // Uint8Array media chunks (mp3 frames | fMP4 fragments) awaiting appendBuffer
    let appendedChunks = 0, appendedSec = 0, receivedPcmSec = 0;
    let retryTimer = 0, mp3FirstAppend = false, mp3Waiting = 0;
    let retiering = false;                // guards the codec step-down teardown/reopen against re-entry
    // ── failure diagnostics (v4.1 item 4): captured from the encoder's mp4init + first
    // fragment so a SourceBuffer error / append throw can push ONE rich mp4diag line per
    // tier attempt. diagPushed is reset per attempt (initial + each step-down). ──
    let diagPushed = false, diagInitLen = 0, diagInitHex = "", diagSeg0Len = 0;
    let diagDescPresent = false, diagDescBytes = 0, diagAdts = false, diagAscBytes = 0;
    // ── watchdog + auto-demotion state (v3.1 item 3) ──
    // A dead primary (mp3) route must NEVER again mean silence: if sourceopen / the first
    // append / a live currentTime don't materialize, demote to segAB and re-open the gen.
    // WD_FIRSTAPPEND includes the boot decode budget: decode-then-render holds the FIRST open
    // until this gen's found/sampler PCM decodes (up to BOOT_DECODE_CAP_MS), so a legitimately
    // slow boot must not trip the "no first append" detector and spuriously demote to segAB.
    const WD_SOURCEOPEN_MS = 4000, WD_FIRSTAPPEND_MS = 8000 + BOOT_DECODE_CAP_MS, WD_FROZEN_MS = 3000;
    let woSourceOpen = 0, woFirstAppend = 0, woFrozen = 0;
    let demoted = false, demoteReason = null;
    // encoder feed state (timeline-ordered forward of both gens' PCM to the one encoder)
    const pcmQueues = new Map();          // gen -> [pcmseg by idx]
    const genDone = new Map();            // gen -> true once its producer posts segeos/segstopped
    let encGen = -1, encIdx = 0;
    // global (whole-timeline) envelope + barMap, keyed by ABSOLUTE stream seconds, so
    // rms()/onBar read one continuous timeline aligned with the element's currentTime.
    let gEnv = new Float32Array(0), gEnvLen = 0, gEnvCap = 0, gEnvHz = 10;
    const gBars = [];                     // { tSec, meta } sorted by tSec; onBar walks it
    let barCursor = 0;

    // ── AUDIT-TRUTH ring (Paul: "track when a node is expected to produce sound and
    // doesn't; give me data to download"). The renderer measures each voice's ACTUAL
    // per-bar RMS + missing srcIds and rides it on the bar meta (meta.audit); here we
    // capture, at the moment a bar is HEARD (fireBar), the anomalies + playback context
    // (route/gen/currentTime/buffered). Downloadable JSON + a compact clipboard summary
    // via the ?wavDebug panel; the ⓘ timeline paints a lane RED when it was silent here.
    const AUDIT_CAP = 200;
    const auditRing = [];
    const auditBySerial = new Map();      // serial -> latest ring entry (ⓘ timeline lookup)
    let auditAnomTotal = 0;
    // DOUBLE-PLAYBACK watch: how many media elements are audibly playing at once.
    // The segAB seam overlaps two elements for ~OVERLAP_SEC (~120ms); anything SUSTAINED
    // past 300ms means a teardown/demote path left a second element playing = two tracks
    // at once. Tracked in the bar poll, surfaced in __wavState + the audit ring.
    let audibleNow = 0, audibleMax = 0, doublePlayAnoms = 0, dblSince = 0, dblFlagged = false;
    function elAudible(el) {
      if (!el) return false;
      try {
        if (el.paused || el.muted) return false;
        if (el.volume != null && el.volume <= 0) return false;
        const ct = el.currentTime || 0;
        if (ct <= 0) return false;
        if (el.duration && isFinite(el.duration) && ct >= el.duration - 0.002) return false;   // played out
        return true;
      } catch (e) { return false; }
    }
    function countAudible() {
      let n = 0;
      if (typeof mp3El !== "undefined" && elAudible(mp3El)) n++;
      if (typeof els !== "undefined" && els) for (const e of els) if (elAudible(e)) n++;
      return n;
    }
    function bufferedAheadSafe() { try { return typeof bufferedAhead === "function" ? bufferedAhead() : 0; } catch (e) { return 0; } }
    // record one HEARD bar into the ring with its anomalies + playback context.
    function recordAudit(meta) {
      if (!meta || !meta.audit || !meta.audit.voices) return;
      const el = useMp3 ? mp3El : curEl;
      const ct = el ? (el.currentTime || 0) : 0;
      const voices = meta.audit.voices;
      const anomalies = [];
      for (const key of Object.keys(voices)) {
        const v = voices[key];
        if (v && v.silent) anomalies.push({ key, role: v.role, notes: v.notes, rms: v.rms, reason: v.reason, missing: v.missing || [] });
      }
      auditAnomTotal += anomalies.length;
      const entry = { serial: meta.serial != null ? meta.serial : null, section: meta.section || null,
        ci: meta.ci != null ? meta.ci : null, t: +ct.toFixed(3), route: outRoute, gen: curGen,
        aheadSec: +aheadSec().toFixed(2), bufferedSec: +bufferedAheadSafe().toFixed(2),
        audible: audibleNow, anomalies, voices };
      auditRing.push(entry);
      if (meta.serial != null) auditBySerial.set(meta.serial, entry);
      while (auditRing.length > AUDIT_CAP) { const old = auditRing.shift(); if (old && old.serial != null && auditBySerial.get(old.serial) !== entry) auditBySerial.delete(old.serial); }
    }
    // compact one-line summary for the clipboard log (iOS-friendly — the proven path).
    function auditSummary() {
      const total = auditRing.length;
      let anomBars = 0; const roleMiss = {};
      for (const e of auditRing) {
        if (!e.anomalies.length) continue;
        anomBars++;
        for (const a of e.anomalies) {
          const tag = a.reason === "missing" ? (a.role + "[" + (a.missing || []).join(",") + "]") : (a.role + "(" + a.reason + ")");
          (roleMiss[tag] = roleMiss[tag] || []).push(e.serial);
        }
      }
      const parts = Object.keys(roleMiss).slice(0, 8).map((k) => {
        const ss = roleMiss[k]; const lo = ss[0], hi = ss[ss.length - 1];
        return k + " bars " + (lo === hi ? lo : lo + "-" + hi);
      });
      return "AUDIT: " + auditAnomTotal + " anomalies over " + anomBars + "/" + total + " bars; dblPlay=" + doublePlayAnoms +
        (parts.length ? "; " + parts.join("; ") : "");
    }

    function putPcm(s) { let q = pcmQueues.get(s.gen); if (!q) { q = []; pcmQueues.set(s.gen, q); } q[s.idx] = s; }
    function mp3AheadSec() { const t = mp3El ? (mp3El.currentTime || 0) : 0; return Math.max(0, receivedPcmSec - t); }

    // forward one queued PCM flush to the encoder (transferring its buffers onward).
    function forwardPcm(gen, idx, flags) {
      const q = pcmQueues.get(gen); const s = q && q[idx]; if (!s) return false;
      q[idx] = null;
      try { encWorker.postMessage({ type: "mp3pcm", gen, L: s.L, R: s.R, n: s.n,
        bridge: !!flags.bridge, boot: !!flags.boot, barMap: s.barMap }, [s.L, s.R]); }
      catch (e) { errors.push("mp3 forward: " + (e && e.message || e)); }
      return true;
    }
    // drain PCM to the encoder IN ORDER: the current gen until exhausted, then — once
    // that gen is done — BRIDGE (crossfade) to the newest ready gen. One continuous feed.
    function pumpEncoder() {
      if (!encReady || !encOpened || abort) return;
      for (let guard = 0; guard < 256; guard++) {
        if (encGen < 0) {
          let g = -1; for (const gen of pcmQueues.keys()) { const q = pcmQueues.get(gen); if (q[0] && (g < 0 || gen < g)) g = gen; }
          if (g < 0) return;
          forwardPcm(g, 0, { boot: true }); encGen = g; encIdx = 1; continue;
        }
        const q = pcmQueues.get(encGen);
        if (q && q[encIdx]) { forwardPcm(encGen, encIdx, {}); encIdx++; continue; }
        if (genDone.get(encGen)) {
          let g = -1; for (const gen of pcmQueues.keys()) { const qq = pcmQueues.get(gen); if (gen > encGen && qq[0] && gen > g) g = gen; }
          if (g >= 0) {
            forwardPcm(g, 0, { bridge: true });
            for (const gen of [...pcmQueues.keys()]) if (gen < g) pcmQueues.delete(gen);   // drop skipped/old gens
            encGen = g; encIdx = 1; continue;
          }
        }
        return;   // nothing ready — wait for more flushes / gen completion
      }
    }

    function growEnv(baseFrame, env, hop) {
      const base = Math.round(baseFrame / hop), need = base + env.length;
      if (need > gEnvCap) { const cap = Math.max(need, gEnvCap * 2, 1024); const n = new Float32Array(cap); n.set(gEnv.subarray(0, gEnvLen)); gEnv = n; gEnvCap = cap; }
      for (let k = 0; k < env.length; k++) gEnv[base + k] = env[k];
      if (need > gEnvLen) gEnvLen = need;
    }

    // encoder worker → conductor: one encoded chunk (mp3 frame batch | fMP4 fragment) of
    // the continuous stream. mp3chunk and mp4seg carry IDENTICAL fields — one code path.
    function onEncMsg(m) {
      if (!m || !m.type) return;
      if (m.type === "mp3ready") { encReady = true; encCaps = m.enc || {}; finalizeCodec(encCaps); return; }
      if (m.type === "mp3fail") { errors.push("mp3enc: " + m.error); return; }
      // drop posts from a superseded encoder codec (after a runtime step-down) — appending
      // e.g. an opus fragment to the new mp3 SourceBuffer would itself error.
      if (m.epoch != null && m.epoch !== encEpoch) return;
      if (m.type === "mp4init") {
        pendingInit = new Uint8Array(m.bytes);
        diagInitLen = pendingInit.length; diagInitHex = hex32(pendingInit);
        diagDescPresent = !!m.descPresent; diagDescBytes = m.descBytes || 0; diagAdts = !!m.adts;
        diagAscBytes = m.ascBytes || 0;
        tryAppend(); return;
      }
      if (m.type === "mp3chunk" || m.type === "mp4seg") {
        if (m.rmsEnv && m.rmsEnv.length && m.encFrames > 0) growEnv(m.baseFrame, m.rmsEnv, m.rmsHop);
        if (m.bars && m.bars.length) { for (const b of m.bars) gBars.push({ tSec: b.frame / SR, meta: b.meta }); gBars.sort((a, b) => a.tSec - b.tSec); }
        if (m.encFrames > 0) appendedSec += m.encFrames / SR;
        const bytes = new Uint8Array(m.bytes);
        if (isFmp4 && !diagSeg0Len && bytes.length) diagSeg0Len = bytes.length;
        if (bytes.length) { appendQ.push(bytes); tryAppend(); }
        return;
      }
    }
    function hex32(u8) { let s = ""; const n = Math.min(32, u8.length); for (let i = 0; i < n; i++) s += (u8[i] < 16 ? "0" : "") + u8[i].toString(16); return s; }
    // finalizeCodec(caps) — commit the codec once the worker reports its AudioEncoder caps.
    // Walks the ladder to the best codec with BOTH container + encoder support (honoring
    // ?codec override); opens the encoder stream in the matching mode; if none is viable,
    // demote to segAB. Idempotent.
    function finalizeCodec(caps) {
      if (!useMp3 || codecFinalized || demoted) return;
      const c = pickCodec(caps);
      if (!c) { demoteToSegAB("no encoder for " + outRoute + " (caps " + JSON.stringify(caps || {}) + ")"); return; }
      codec = c; isFmp4 = (c === "aac" || c === "opus");
      outRoute = (isMMS ? "mms-" : "mse-") + c;
      codecFinalized = true;
      openEncoder(c);
      pumpEncoder();
      if (msOpened && !sbOpen) addSrcBuf();   // sourceopen already fired while we waited on caps
    }
    // (re)open the encoder-worker stream in codec `c`, stamping a fresh epoch so any post
    // from the PRIOR codec is dropped upstream once it lands.
    function openEncoder(c) {
      encEpoch++;
      try {
        if (c === "aac" || c === "opus") encWorker.postMessage({ type: "encopen", codec: c, kbps: MP3_KBPS, overlapSec: BRIDGE_OV_SEC, epoch: encEpoch });
        else encWorker.postMessage({ type: "mp3open", kbps: MP3_KBPS, overlapSec: BRIDGE_OV_SEC, epoch: encEpoch });
        encOpened = true;
      } catch (e) { errors.push("enc open: " + (e && e.message || e)); }
    }
    // the next viable codec tier below `cur` (aac → opus → mp3), honoring the container
    // (isTypeSupported) AND the worker's probed encoder caps. null once the ladder is spent.
    function nextCodec(cur, caps) {
      caps = caps || {};
      const order = ["aac", "opus", "mp3"];
      const viable = (c) => containerOk(c) && (c === "mp3" ? true : c === "aac" ? !!caps.aac : c === "opus" ? !!caps.opus : false);
      for (let j = order.indexOf(cur) + 1; j < order.length; j++) if (viable(order[j])) return order[j];
      return null;
    }
    // push ONE rich diagnostic line per tier attempt on an MSE fault (v4.1 item 4). fMP4
    // routes get the full mp4diag (codec/desc/adts/init+hex/seg0); the mp3 route has no
    // init/desc, so its reason is logged by the caller instead.
    function pushMp4Diag() {
      if (diagPushed || !isFmp4) return; diagPushed = true;
      const desc = diagDescPresent ? ("present:" + diagDescBytes + " bytes") : "absent";
      const seg0 = diagSeg0Len || (appendQ.length ? appendQ[0].length : 0);
      errors.push("mp4diag codec=" + codec + " desc=" + desc + " asc=" + diagAscBytes + "B adts=" + (diagAdts ? "yes" : "no")
        + " init=" + diagInitLen + "B [" + diagInitHex + "] seg0=" + seg0 + "B");
    }
    // an MSE-level fault (SourceBuffer 'error' or an appendBuffer throw). Before the first
    // successful append it walks the codec ladder; after a healthy first append (mid-stream
    // death) or once the ladder is spent, stepDownCodec surrenders to segAB.
    function onMseFault(reason) { pushMp4Diag(); stepDownCodec(reason); }

    // stepDownCodec (v4.1 item 3): retry the SAME unlocked element with the next codec tier
    // (fresh MediaSource attach + fresh encoder stream, no gesture needed) BEFORE segAB.
    function stepDownCodec(reason) {
      if (demoted || !useMp3 || retiering) return;
      if (mp3FirstAppend) { demoteToSegAB(reason); return; }   // healthy first append → mid-stream death
      const next = nextCodec(codec, encCaps || {});
      if (!next) { demoteToSegAB("codec ladder exhausted after " + codec + ": " + reason); return; }
      retiering = true;
      errors.push("codec step-down " + codec + "->" + next + ": " + reason);
      status("codec step-down " + codec + "->" + next);
      // clear the per-attempt watchdogs + retry (re-armed fresh for the new tier below).
      if (woSourceOpen) { clearTimeout(woSourceOpen); woSourceOpen = 0; }
      if (woFirstAppend) { clearTimeout(woFirstAppend); woFirstAppend = 0; }
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = 0; }
      // tear down the MediaSource + SourceBuffer but KEEP the unlocked/playing element and
      // the encoder worker — only the source/codec change.
      try { if (mediaSrc && mediaSrc.readyState === "open") mediaSrc.endOfStream(); } catch (e) {}
      try { if (mp3El) { mp3El.removeAttribute("src"); mp3El.srcObject = null; mp3El.load(); } } catch (e) {}
      mediaSrc = null; srcBuf = null; sbOpen = false; msOpened = false;
      appendQ.length = 0; pendingInit = null; initAppended = false; appendingInit = false;
      mmsWants = !isMMS;
      // halt producers + drop stale PCM so the new codec re-encodes from a clean gen open.
      for (const w of workers) if (w) { try { w.postMessage({ type: "stop" }); } catch (e) {} }
      pcmQueues.clear(); genDone.clear(); encGen = -1; encIdx = 0; encOpened = false;
      // RESET the absolute append-timeline accounting: the new codec re-encodes from scratch
      // on a fresh MediaSource whose currentTime restarts at 0. Leaving receivedPcmSec stale
      // pins mp3AheadSec above FEED_CAP (the element never advances), so the feed pump would
      // never feed the new gen and no first append could ever land (self-inflicted stall).
      receivedPcmSec = 0; appendedSec = 0; appendedChunks = 0; mp3Waiting = 0;
      gEnv = new Float32Array(0); gEnvLen = 0; gEnvCap = 0; gBars.length = 0; barCursor = 0;
      // reset per-attempt diagnostics for the new tier.
      diagPushed = false; diagInitLen = 0; diagInitHex = ""; diagSeg0Len = 0;
      diagDescPresent = false; diagDescBytes = 0; diagAdts = false; diagAscBytes = 0;
      // flip the codec (all read sites are live off these `let`s) and re-open everything.
      codec = next; isFmp4 = (next === "aac" || next === "opus"); outRoute = (isMMS ? "mms-" : "mse-") + next; codecFinalized = true;
      openEncoder(next);
      setupMediaEl();      // re-attach a fresh MediaSource on the SAME element
      startWatchdogs();    // re-arm the per-tier sourceopen / first-append detectors
      opening = false;
      retiering = false;
      try { reopen(lastOne || getState()); } catch (e) { errors.push("re-tier reopen: " + (e && e.message || e)); }
    }

    // ── MediaSource / SourceBuffer wiring (element created + play()'d IN the gesture) ──
    // The <audio> element is created + unlocked ONCE; a codec step-down re-attaches a fresh
    // MediaSource to the SAME element (no second gesture needed — the element stays unlocked).
    function setupMediaEl() {
      if (!useMp3) return;
      if (!mp3El) {
        mp3El = mkHiddenAudio();
        // ManagedMediaSource REQUIRES AirPlay disabled on the element BEFORE attach
        // (iOS 17.1+): without it sourceopen NEVER fires — the boot hangs silently at
        // "scheduling the first bar" with zero errors (device-found 2026-07-07).
        try { mp3El.disableRemotePlayback = true; } catch (e) {}
        try { mp3El.setAttribute("x-webkit-airplay", "deny"); } catch (e) {}
        // count only GENUINE mid-stream underruns (playhead at the buffer edge), not the
        // one-time startup buffering — this is the append pipeline's zeroPlayable analog.
        mp3El.addEventListener("waiting", () => { if (mp3FirstAppend && mp3El && (mp3El.currentTime || 0) > 0.3 && bufferedAhead() < 0.15) mp3Waiting++; });
      }
      attachMediaSource();
      try { mp3El.muted = false; const pr = mp3El.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {}
    }
    function attachMediaSource() {
      try { mediaSrc = new MSctor(); } catch (e) { errors.push("MediaSource ctor: " + (e && e.message || e)); return; }
      // MMS prefers srcObject (drives start/endstreaming); classic MSE uses an object URL.
      let attached = false;
      if (isMMS) { try { mp3El.srcObject = mediaSrc; attached = true; } catch (e) {} }
      if (!attached) { try { mp3El.src = root.URL.createObjectURL(mediaSrc); } catch (e) { errors.push("MediaSource attach: " + (e && e.message || e)); } }
      mediaSrc.addEventListener("sourceopen", onSourceOpen);
      if (isMMS) {
        try { mediaSrc.addEventListener("startstreaming", () => { mmsWants = true; tryAppend(); }); } catch (e) {}
        try { mediaSrc.addEventListener("endstreaming", () => { mmsWants = false; }); } catch (e) {}
      }
    }
    function codecTypeStr() { return codec === "aac" ? T_AAC : codec === "opus" ? T_OPUS : T_MP3; }
    function onUpdateEnd() {
      if (appendingInit) { appendingInit = false; initAppended = true; pendingInit = null; }
      if (!evictBehind()) tryAppend();
    }
    // add the SourceBuffer with the FINALIZED codec string. fMP4 uses mode "segments"
    // (explicit tfdt timestamps — the whole point of v4); mp3 keeps "sequence".
    function addSrcBuf() {
      if (sbOpen || !mediaSrc || !codecFinalized) return;
      try { srcBuf = mediaSrc.addSourceBuffer(codecTypeStr()); }
      catch (e) { onMseFault("addSourceBuffer(" + codec + "): " + (e && e.message || e)); return; }
      try { srcBuf.mode = isFmp4 ? "segments" : "sequence"; } catch (e) {}
      srcBuf.addEventListener("updateend", onUpdateEnd);
      // SourceBuffer 'error' (the device's first-append symptom): step down the codec ladder
      // before the first append, else demote (mid-stream death). onMseFault routes both.
      srcBuf.addEventListener("error", () => onMseFault("SourceBuffer error event"));
      if (isMMS && mediaSrc.streaming !== false) mmsWants = true;
      sbOpen = true; tryAppend();
    }
    function onSourceOpen() {
      if (msOpened || !mediaSrc) return;
      msOpened = true;
      if (woSourceOpen) { clearTimeout(woSourceOpen); woSourceOpen = 0; }   // sourceopen fired — cancel its watchdog
      // sync the MMS appetite from the source itself: if .streaming is already true (or
      // the property is absent in this WebKit) append eagerly — waiting on a
      // startstreaming edge that already passed deadlocks the boot. FWD_CAP still bounds us.
      if (isMMS && mediaSrc.streaming !== false) mmsWants = true;
      if (codecFinalized) addSrcBuf();   // else finalizeCodec calls addSrcBuf once caps land
    }
    function bufferedAhead() {
      try { if (srcBuf && srcBuf.buffered.length) return srcBuf.buffered.end(srcBuf.buffered.length - 1) - (mp3El.currentTime || 0); } catch (e) {}
      return 0;
    }
    function evictBehind() {
      if (!srcBuf || srcBuf.updating) return false;
      try {
        if (!srcBuf.buffered.length) return false;
        const start = srcBuf.buffered.start(0), keepFrom = Math.max(0, (mp3El.currentTime || 0) - KEEP_BEHIND);
        if (keepFrom > start + 1) { srcBuf.remove(start, keepFrom); return true; }   // fires another updateend
      } catch (e) {}
      return false;
    }
    function tryAppend() {
      if (abort || !sbOpen || !srcBuf || srcBuf.updating) return;
      if (isMMS && !mmsWants) return;
      // fMP4: the init segment (ftyp+moov) MUST land before any media fragment.
      if (isFmp4 && pendingInit && !initAppended) {
        try { srcBuf.appendBuffer(pendingInit); appendingInit = true; }
        catch (err) { onMseFault("append init: " + (err && err.message || err)); }   // step down before segAB
        return;
      }
      if (!appendQ.length) return;
      if (bufferedAhead() > FWD_CAP) { scheduleRetry(); return; }   // bound the forward buffer (all routes)
      const bytes = appendQ[0];
      try {
        srcBuf.appendBuffer(bytes); appendQ.shift(); appendedChunks++;
        if (!mp3FirstAppend) {
          mp3FirstAppend = true; mark("firstAppend");
          if (woFirstAppend) { clearTimeout(woFirstAppend); woFirstAppend = 0; }
          startFrozenWatch();
          if (!firstSound) { firstSound = true; mark("firstSound"); status("live (faust wav) — drag the space"); }
          msPlaying();
        }
      } catch (err) {
        if (err && err.name === "QuotaExceededError") { evictBehind(); scheduleRetry(); }
        else if (!mp3FirstAppend) { onMseFault("appendBuffer: " + (err && err.message || err)); }   // pre-first-append fault → step down
        else { errors.push("appendBuffer: " + (err && err.message || err)); appendQ.shift(); }      // mid-stream transient → log + skip
      }
    }
    function scheduleRetry() { if (retryTimer) return; retryTimer = setTimeout(() => { retryTimer = 0; tryAppend(); }, 60); }

    // ── WATCHDOG (v3.1 item 3): arm the mp3-route failure detectors inside the gesture.
    //   • sourceopen absent ~4s after attach  → the MMS/MSE never opened (the iOS deadlock)
    //   • no first append ~8s after boot       → the encode/append pipeline never produced
    //   • currentTime frozen ~3s after 1st append → the element attached but won't advance
    // Any trigger demotes to segAB exactly once. ──
    function startWatchdogs() {
      // sourceopen / first-append never materializing walks the codec ladder BEFORE segAB
      // (v4.1 item 3); the timers are re-armed per tier attempt (stepDownCodec → startWatchdogs).
      woSourceOpen = setTimeout(() => { woSourceOpen = 0; if (!abort && useMp3 && !sbOpen) stepDownCodec("no sourceopen within " + WD_SOURCEOPEN_MS + "ms of attach"); }, WD_SOURCEOPEN_MS);
      woFirstAppend = setTimeout(() => { woFirstAppend = 0; if (!abort && useMp3 && !mp3FirstAppend) stepDownCodec("no first append within " + WD_FIRSTAPPEND_MS + "ms of boot"); }, WD_FIRSTAPPEND_MS);
    }
    function startFrozenWatch() {
      if (woFrozen) return;
      let lastCt = -1, lastMove = now();
      woFrozen = setInterval(() => {
        if (abort || demoted || !useMp3 || !mp3El) return;
        const ct = mp3El.currentTime || 0;
        if (ct > lastCt + 1e-3) { lastCt = ct; lastMove = now(); return; }
        if (now() - lastMove <= WD_FROZEN_MS) return;
        // stalled: only a fault if the element has genuinely playable data it refuses to
        // advance through. An underrun at the buffered EDGE is BENIGN: when the forward
        // runway drains (e.g. a steer's decode-then-render wait outlasting the ~5s mp3
        // runway under an iOS-grade decode storm), the element parks with readyState <=
        // HAVE_CURRENT_DATA and strands a sub-frame sliver (~0.09-0.15s, mp3-frame-
        // boundary dependent) it cannot play until the next append lands — measured in
        // the live-resilience storm: ct frozen 3.8s at buffered.end-0.088 with rs=2,
        // then auto-resumed (rs 2->4) the instant the new gen's append arrived. That
        // sliver made bufferedAhead()>0.1 a coin flip, spuriously demoting a healthy
        // mse-mp3 route to segAB. Dead-element criteria instead: frozen AND (the UA
        // itself claims playable future data (rs>=3) OR a healthy multi-second buffer
        // sits ahead regardless of rs). A starving element re-arms the full window so
        // the post-append resume isn't judged on a clock that ran out mid-starve.
        const ahead = bufferedAhead();
        if ((mp3El.readyState || 0) < 3 && ahead < 2) { lastMove = now(); return; }   // benign starve
        if (ahead > 0.1)
          demoteToSegAB("currentTime frozen " + WD_FROZEN_MS + "ms after first append");
      }, 500);
    }
    // demoteToSegAB(reason) — tear the mp3 pipeline down, flip the route to segAB, and
    // re-open the CURRENT gen through the normal open machinery so segAB segments flow.
    // Exactly-once; the reason is pushed into errors and surfaced via __wavState().demoted.
    function demoteToSegAB(reason) {
      if (demoted || !useMp3) return;   // exactly-once, and only from the mp3 route
      demoted = true; demoteReason = reason;
      errors.push("demote->segAB: " + reason);
      status("demote->segAB: " + reason);
      // stop all watchdogs
      if (woSourceOpen) { clearTimeout(woSourceOpen); woSourceOpen = 0; }
      if (woFirstAppend) { clearTimeout(woFirstAppend); woFirstAppend = 0; }
      if (woFrozen) { clearInterval(woFrozen); woFrozen = 0; }
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = 0; }
      // halt BOTH producers so no stale pcmseg keeps arriving mid-teardown.
      for (const w of workers) if (w) { try { w.postMessage({ type: "stop" }); } catch (e) {} }
      // tear down the mp3 element + MediaSource + encoder worker cleanly.
      try { if (mp3El) mp3El.pause(); } catch (e) {}
      try { if (mediaSrc && mediaSrc.readyState === "open") mediaSrc.endOfStream(); } catch (e) {}
      try { if (mp3El) { mp3El.removeAttribute("src"); mp3El.srcObject = null; mp3El.load(); mp3El.remove(); } } catch (e) {}
      mp3El = null; mediaSrc = null; srcBuf = null; sbOpen = false; appendQ.length = 0;
      pendingInit = null; initAppended = false; appendingInit = false; msOpened = false;
      if (encWorker) { try { encWorker.postMessage({ type: "mp3close" }); } catch (e) {} try { encWorker.terminate(); } catch (e) {} encWorker = null; }
      pcmQueues.clear(); genDone.clear(); encGen = -1; encIdx = 0;
      // FLIP the route (all read sites are live off these `let`s).
      useMp3 = false; isMMS = false; isFmp4 = false; codec = null; codecFinalized = false; outRoute = "segAB";
      // re-open the CURRENT gen via the normal open machinery — now on the segAB path.
      opening = false;   // let reopen re-arm cleanly
      try { reopen(lastOne || getState()); } catch (e) { errors.push("demote reopen: " + (e && e.message || e)); }
    }

    if (useMp3) { setupMediaEl(); startWatchdogs(); }   // ← element + play() + watchdogs live INSIDE the goLive gesture

    // Per-gen segment queues (idx-addressed). Playback walks one gen's queue until a
    // NEWER gen's seg0 is ready+preloaded, then cuts to it at the next SEAM — the
    // baked overlap crossfades old-tail-out over new-head-in (no-stall gen cutover).
    const segQueues = new Map();   // gen -> [seg,...] by seg.idx
    function putSeg(seg) { let q = segQueues.get(seg.gen); if (!q) { q = []; segQueues.set(seg.gen, q); } q[seg.idx] = seg; }
    function segAt(gen, idx) { const q = segQueues.get(gen); return q ? q[idx] : null; }

    let curSeg = null, curEl = null, singleEl = false;
    let playGen = -1, playIdx = -1, playSeq = 0;   // playSeq: monotonic played count (A/B parity + seam count)
    let awaiting = false, zeroPlayableEvents = 0;
    let segFired = new Set();
    const played = new Set();      // "gen:idx" already started (for one-shot arming)
    const revokeQ = [];            // urls in play order, revoked ≤3 behind
    const REVOKE_KEEP = 3;

    // choose the segment to play AFTER (playGen,playIdx): cut to the newest ready gen
    // strictly newer than playGen, else the next idx of the current gen.
    function pickNext() {
      let best = -1;
      for (const gen of segQueues.keys()) { if (gen > playGen) { const s = segAt(gen, 0); if (s && s.url && gen > best) best = gen; } }
      if (best >= 0) return { gen: best, idx: 0 };
      const nxt = segAt(playGen, playIdx + 1);
      if (nxt && nxt.url) return { gen: playGen, idx: playIdx + 1 };
      return null;
    }
    function elFor(seq) { return singleEl ? els[0] : els[seq % 2]; }
    function preloadNext() {
      if (singleEl) return;
      const nx = pickNext(); if (!nx) return;
      const s = segAt(nx.gen, nx.idx); if (!s || !s.url) return;
      const el = els[playSeq % 2];   // the element NOT currently playing (curEl is els[(playSeq-1)%2])
      try { if (el.src !== s.url) { el.src = s.url; el.load(); } } catch (e) {}
    }
    function revokeOld() {
      while (revokeQ.length > REVOKE_KEEP) {
        const s = revokeQ.shift(); if (s && s.url) { try { root.URL.revokeObjectURL(s.url); } catch (e) {} s.url = null; }
      }
    }
    // drop abandoned older-gen queues after a cutover (keep playGen and its immediate
    // predecessor — whose finishing segment may still be mid-overlap on the other element).
    function purgeGens() {
      for (const gen of [...segQueues.keys()]) {
        if (gen >= playGen - 1) continue;
        for (const s of segQueues.get(gen)) if (s && s.url) { try { root.URL.revokeObjectURL(s.url); } catch (e) {} }
        segQueues.delete(gen);
      }
    }
    function onSeg(seg) {
      putSeg(seg);
      if (playGen < 0) { startFirst(); return; }
      if (awaiting) { const nx = pickNext(); if (nx) { awaiting = false; playSegment(nx.gen, nx.idx); return; } }
      preloadNext();
    }
    function startFirst() {
      if (playGen >= 0 || !els[0]) return;
      let g = -1; for (const gen of segQueues.keys()) { const s = segAt(gen, 0); if (s && s.url && (g < 0 || gen < g)) g = gen; }
      if (g < 0) return;
      playSegment(g, 0);
    }
    function playSegment(gen, idx) {
      const seg = segAt(gen, idx); if (!seg || !seg.url) return;
      playGen = gen; playIdx = idx; curSeg = seg;
      const el = elFor(playSeq); curEl = el; playSeq++;
      played.add(gen + ":" + idx);
      try { if (el.src !== seg.url) el.src = seg.url; el.muted = false; if ((el.currentTime || 0) > 0.01) el.currentTime = 0; } catch (e) {}
      let pr = null; try { pr = el.play(); } catch (e) {}
      if (pr && pr.catch) pr.catch(() => {
        // background refusal of an idle element → single-element fallback (src-swap on ended;
        // small gap but faded edges, lands in the pre-downbeat pocket → no click).
        if (!singleEl && el !== els[0]) {
          singleEl = true; curEl = els[0];
          try { els[0].src = seg.url; els[0].muted = false; els[0].currentTime = 0; const p2 = els[0].play(); if (p2 && p2.catch) p2.catch(() => {}); } catch (e) {}
        }
      });
      if (gen === curGen) curGenPlayed = Math.max(curGenPlayed, idx + 1);
      segFired = new Set();
      mark("firstAppend");   // segAB analog of the first mp3 append: the first element play
      if (!firstSound) { firstSound = true; mark("firstSound"); status("live (faust wav) — drag the space"); }
      msPlaying();
      revokeQ.push(seg); revokeOld(); purgeGens();
      armAdvance(el, seg);
      preloadNext();
    }
    // start the next element EARLY at durSec-OV (trimmed setTimeout, primary) + a
    // timeupdate guard (for coarse/throttled timers); `ended` is the backstop. The
    // finishing element plays out its baked OV fade-out and ends on its own.
    function armAdvance(el, seg) {
      el.__adv = false;
      const ov = seg.overlapSec || OVERLAP_SEC;
      const earlyAt = Math.max(0, seg.durSec - ov);
      const advance = () => {
        if (el.__adv) return; el.__adv = true;
        if (el.__tt) { clearTimeout(el.__tt); el.__tt = 0; }
        if (el.__tick) { try { el.removeEventListener("timeupdate", el.__tick); } catch (e) {} el.__tick = null; }
        const nx = pickNext();
        if (nx) playSegment(nx.gen, nx.idx);
        else { awaiting = true; zeroPlayableEvents++; }   // underrun — onSeg() resumes when a seg lands
      };
      const tick = () => { if (!el.__adv && (el.currentTime || 0) >= earlyAt) advance(); };
      el.__tick = tick;
      el.addEventListener("timeupdate", tick);
      el.__tt = setTimeout(advance, Math.max(30, earlyAt * 1000));
      el.addEventListener("ended", advance, { once: true });   // backstop
    }

    // ── onBar poll: fire opts.onBar off the playing element's currentTime + barMap ──
    let barPollTimer = 0;
    function fireBar(meta) {
      if (!meta) return;
      try { recordAudit(meta); } catch (e) {}   // AUDIT-TRUTH: capture the heard bar + context
      if (!opts.onBar) return;
      try {
        opts.onBar({ serial: meta.serial, ci: meta.ci, nch: meta.nch, when: ctx.currentTime,
          spb: meta.spb, cbeats: meta.cbeats, chord: meta.chord, section: meta.section });
      } catch (e) {}
    }
    function startBarPoll() {
      if (barPollTimer) return;
      barPollTimer = setInterval(() => {
        if (abort) return;
        // DOUBLE-PLAYBACK watch: count audibly-playing elements; a sustained (>300ms)
        // overlap of two is a teardown/demote leak (two tracks at once).
        audibleNow = countAudible();
        if (audibleNow > audibleMax) audibleMax = audibleNow;
        if (audibleNow >= 2) {
          if (!dblSince) dblSince = now();
          else if (!dblFlagged && now() - dblSince > 300) {
            dblFlagged = true; doublePlayAnoms++;
            errors.push("double-playback: " + audibleNow + " elements audible >300ms (route " + outRoute + ")");
          }
        } else { dblSince = 0; dblFlagged = false; }
        if (useMp3) {   // one continuous timeline: fire bars whose absolute tSec has passed currentTime
          const t = mp3El ? (mp3El.currentTime || 0) : 0;
          while (barCursor < gBars.length && gBars[barCursor].tSec <= t) fireBar(gBars[barCursor++].meta);
          return;
        }
        if (!curSeg || !curEl) return;
        const t = curEl.currentTime || 0, bm = curSeg.barMap || [];
        for (let k = 0; k < bm.length; k++) {
          if (segFired.has(k)) continue;
          if (t >= bm[k].off / SR) { segFired.add(k); fireBar(bm[k].meta); }
        }
      }, 30);
    }

    // ── runway / load reporter ──
    function aheadSec() {
      if (useMp3) return mp3AheadSec();
      let s = 0;
      if (curSeg && curEl) s += Math.max(0, (curSeg.bodySec || curSeg.durSec) - (curEl.currentTime || 0));
      // PLAYABLE PATH ONLY (v4.1 item 5): pickNext() cuts to the NEWEST ready gen at the next
      // seam, ABANDONING the current gen's remaining segments and every middle gen. Those are
      // not on the path that will play, so counting them inflated the device meter to 130s.
      // If a newer gen is ready, only its queued segments (from idx 0) are ahead; otherwise
      // the current gen's segments past the play cursor are.
      let newest = -1;
      for (const gen of segQueues.keys()) if (gen > playGen) { const s0 = segAt(gen, 0); if (s0 && s0.url && gen > newest) newest = gen; }
      if (newest >= 0) {
        const q = segQueues.get(newest) || [];
        for (let i = 0; i < q.length; i++) { const sg = q[i]; if (sg && sg.url) s += sg.bodySec || sg.durSec || 0; }
      } else {
        const q = segQueues.get(playGen) || [];
        for (let i = playIdx + 1; i < q.length; i++) { const sg = q[i]; if (sg && sg.url) s += sg.bodySec || sg.durSec || 0; }
      }
      return s;
    }
    let loadRatio = 1, loadTimer = 0;
    function startLoadReporter() {
      if (loadTimer) return;
      loadTimer = setInterval(() => {
        if (abort) return;
        loadRatio = Math.min(1, aheadSec() / SEG_SEC);
        if (opts.onLoad) try { opts.onLoad(loadRatio, 0); } catch (e) {}
      }, 250);
    }

    // ── MediaSession (metadata/playbackState only, as WAV-FIRST specifies) ──
    const MS = (typeof navigator !== "undefined" && navigator.mediaSession) ? navigator.mediaSession : null;
    function msState(s) { if (MS) try { MS.playbackState = s; } catch (e) {} }
    function msMeta() {
      if (!MS || typeof root.MediaMetadata === "undefined") return;
      let title = "Royal Road";
      try { const st = getState(); if (st) title = st.genre || st.name || (st.genreMeta && st.genreMeta.form) || title; } catch (e) {}
      try { MS.metadata = new root.MediaMetadata({ title: String(title), artist: "Royal Road / aboardresearch", album: "the genre space" }); } catch (e) {}
    }
    function msPlaying() { msMeta(); msState("playing"); }
    let metaTimer = 0;
    if (MS) {
      msMeta(); msState("playing");
      metaTimer = setInterval(() => { if (!abort) msMeta(); }, 1000);
      if (opts.mediaSession) {
        try {
          MS.setActionHandler("play", () => { const pe = useMp3 ? mp3El : curEl; if (pe) { try { const p = pe.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} } msState("playing"); });
          MS.setActionHandler("pause", () => { const pe = useMp3 ? mp3El : curEl; if (pe) { try { pe.pause(); } catch (e) {} } msState("paused"); });
        } catch (e) {}
      }
    }
    // goHidden/goVisible: NO-OP for audio (the media element keeps playing in the
    // background — the whole point); only MediaSession state is maintained.
    const onVis = () => { msState("playing"); if (typeof document !== "undefined" && document.visibilityState !== "hidden") msMeta(); };
    if (typeof document !== "undefined") { document.addEventListener("visibilitychange", onVis); }

    // ── layer table (buried feature, shape preserved for explorer's mixer panel) ──
    const LAYER_DEFS = [
      ["pad", "pads"], ["bass", "bass"], ["lead", "lead"], ["kick", "kick"], ["snare", "snare"],
      ["hats", "hats/toms"], ["fx", "stabs/sfx"], ["beds", "found bed"], ["chops", "found chops"], ["vox", "hits/vox"],
    ];

    // ── boot ── init BOTH producers up front (gen0 renders on worker[0]; the first
    // sig change / steer opens gen1 on worker[1] in parallel — no cold-start stall).
    status("loading engine…");
    if (useMp3) {
      try {
        encWorker = new Worker(BASE + "mp3-worker.js", { type: "module" });
        encWorker.onmessage = (e) => onEncMsg(e.data);
        encWorker.onerror = (e) => errors.push("mp3 worker error: " + ((e && e.message) || e));
        encWorker.postMessage({ type: "init" });
      } catch (e) { errors.push("mp3 worker spawn: " + (e && e.message || e)); }
    }
    await ensureWorker(0);
    mark("workerInit");
    ensureWorker(1);
    status("priming…");
    startBarPoll();
    startLoadReporter();
    pump();

    let wavMasterVol = (opts.masterVol != null ? Math.max(0, Math.min(1, opts.masterVol)) : 1);   // <audio>.volume can't exceed 1 (no boost on the media path)
    const applyWavVol = () => { for (const e of [els[0], els[1], mp3El]) { if (e) try { e.volume = wavMasterVol; } catch (x) {} } };
    applyWavVol();
    const handle = {
      ctx, analyser: null, errors,
      // USER MASTER VOLUME — the media path can only attenuate (element.volume ≤ 1).
      setMasterVol(v) { wavMasterVol = Math.max(0, Math.min(1, +v || 0)); applyWavVol(); },
      // GETTERS so they reflect a runtime route demotion (mp3 → segAB), not the boot route.
      get mediaEl() { return useMp3 ? mp3El : els[0]; },
      get outputRoute() { return outRoute; },
      bootStats: () => ({ ...bootStats }),
      // AUDIT-TRUTH surface: the rolling ring (download), per-serial lookup (ⓘ timeline
      // paint), a compact clipboard line, and live counters.
      audit: () => auditRing.slice(),
      auditFor: (serial) => auditBySerial.get(serial) || null,
      auditSummary,
      auditStats: () => ({ bars: auditRing.length, anomalies: auditAnomTotal, doublePlay: doublePlayAnoms, audible: audibleNow, audibleMax }),
      rms() {
        if (useMp3) {   // read the global 10 Hz envelope at the element's currentTime
          if (!mp3El || !mp3FirstAppend || !gEnvLen) return 0;
          const i = Math.floor((mp3El.currentTime || 0) * gEnvHz);
          return gEnv[Math.max(0, Math.min(gEnvLen - 1, i))] || 0;
        }
        if (!curSeg || !curEl) return 0;
        const env = curSeg.rmsEnv; if (!env || !env.length) return 0;
        const i = Math.floor((curEl.currentTime || 0) * 10);
        return env[Math.max(0, Math.min(env.length - 1, i))] || 0;
      },
      layers() {
        const rms = this.rms(), active = rms > 0.0005;
        return LAYER_DEFS.map(([id, label]) => ({ id, label, gain: 1, muted: false, solo: false, active,
          rms() { return active ? rms : 0; }, setGain() {}, setMute() {}, setSolo() {} }));
      },
      prepare() { try { ensureWorker(0); ensureWorker(1); } catch (e) {} },
      loadRatio: () => loadRatio,
      ecoLevel: () => 0,
      nodeCount: () => (curSig ? curSig.split("|").filter(Boolean).length : 0),
      awakeCount: () => (curSig ? curSig.split("|").filter(Boolean).length : 0),
      awakeCost: () => 0, costCeiling: () => 0, costStealCount: () => 0,
      poolCount: () => 0, reapCount: () => 0, harvestCount: () => 0, maxWorklets: () => 0, preparedCount: () => 0,
      workletTruth: () => ({ created: 0, destroyed: 0, alive: 0, counted: 0 }),
      stemStats: () => null, journal: () => [], sentinel: () => null, renderCapacity: () => null,
      clickMon: () => null, clickMonThr: () => {},
      underruns: () => (useMp3 ? mp3Waiting : 0),
      underrunFlag: () => 0,
      runwaySec: () => aheadSec(),
      readCursor: () => { const e = useMp3 ? mp3El : curEl; return e ? Math.floor((e.currentTime || 0) * SR) : 0; },
      balance() { const r = this.rms(); return { l: r, r: r }; },
      // gen-cutover telemetry: prove a gen change never leaves zero playable audio.
      segStats: () => {
        if (useMp3) {
          const t = mp3El ? (mp3El.currentTime || 0) : 0;
          let curSection = null; for (const b of gBars) { if (b.tSec <= t && b.meta) curSection = b.meta.section; }
          let bufStart = 0, bufEnd = 0; try { if (srcBuf && srcBuf.buffered.length) { bufStart = srcBuf.buffered.start(0); bufEnd = srcBuf.buffered.end(srcBuf.buffered.length - 1); } } catch (e) {}
          return { gens: [...pcmQueues.keys()], encGen, curGen, curGenReceived, curGenPlayed,
            received: receivedSegs, appendedChunks, queued: appendQ.length, awaiting: false,
            zeroPlayable: mp3Waiting, singleEl: true, aheadSec: aheadSec(), curSection,
            bufferedSec: Math.max(0, bufEnd - bufStart), currentTime: t };
        }
        let queued = 0; for (const q of segQueues.values()) for (const s of q) if (s && s.url) queued++;
        const curSection = (() => { const bm = curSeg && curSeg.barMap; if (!bm || !bm.length || !curEl) return null;
          const t = (curEl.currentTime || 0) * SR; let sec = null; for (const e of bm) { if (e.off <= t && e.meta) sec = e.meta.section; } return sec; })();
        return { gens: [...segQueues.keys()], playGen, playIdx, playSeq, curGen,
          curGenReceived, curGenPlayed, received: receivedSegs, queued, awaiting, zeroPlayable: zeroPlayableEvents,
          singleEl, aheadSec: aheadSec(), curSection };
      },
      // headless-verification hooks (wavout probe). For mp3, playCursor = appended chunks
      // (advances as the continuous stream flows); singleEl is always true.
      __wavState: () => {
        if (useMp3) {
          let bufStart = 0, bufEnd = 0; try { if (srcBuf && srcBuf.buffered.length) { bufStart = srcBuf.buffered.start(0); bufEnd = srcBuf.buffered.end(srcBuf.buffered.length - 1); } } catch (e) {}
          return { receivedSegs, playedSegs: appendedChunks, playCursor: appendedChunks, singleEl: true, curGen,
            zeroPlayable: mp3Waiting, aheadSec: aheadSec(), outputRoute: outRoute, demoted, demoteReason,
            currentTime: mp3El ? (mp3El.currentTime || 0) : 0, bufferedSec: Math.max(0, bufEnd - bufStart),
            bufferedStart: bufStart, bufferedEnd: bufEnd,
            // LURCH METER (device): we appended appendedSec seconds of encoded stream; in
            // sequence mode buffered.end must track it exactly. A growing gap = the UA is
            // stitching appends short/long (the WebKit MP3 timestamp suspicion) — the
            // audible "lurch" made a number. (evict trims the FRONT; end is unaffected.)
            appendedSec: +appendedSec.toFixed(2), stitchDriftSec: +(appendedSec - bufEnd).toFixed(3),
            audibleElements: audibleNow, audibleMax, doublePlayAnoms, auditAnoms: auditAnomTotal, auditBars: auditRing.length,
            decode: decodeStats() };
        }
        return { receivedSegs, playedSegs: playSeq, playCursor: playSeq, singleEl, curGen,
          zeroPlayable: zeroPlayableEvents, aheadSec: aheadSec(), outputRoute: outRoute, demoted, demoteReason,
          audibleElements: audibleNow, audibleMax, doublePlayAnoms, auditAnoms: auditAnomTotal, auditBars: auditRing.length,
          curSeg: curSeg ? { gen: curSeg.gen, idx: curSeg.idx, durSec: curSeg.durSec } : null,
          // decode forensics on the FALLBACK route too — the 2026-07-07 device log ran
          // segAB and showed dec=null, hiding the missing-samples answer.
          decode: decodeStats() };
      },
      __segCount: () => receivedSegs,
      stop() {
        abort = true;
        if (pumpTimer) clearTimeout(pumpTimer);
        if (barPollTimer) clearInterval(barPollTimer);
        if (loadTimer) clearInterval(loadTimer);
        if (metaTimer) clearInterval(metaTimer);
        if (retryTimer) clearTimeout(retryTimer);
        if (woSourceOpen) clearTimeout(woSourceOpen);
        if (woFirstAppend) clearTimeout(woFirstAppend);
        if (woFrozen) clearInterval(woFrozen);
        for (const w of workers) if (w) { try { w.postMessage({ type: "stop" }); } catch (e) {} }
        if (encWorker) { try { encWorker.postMessage({ type: "mp3close" }); } catch (e) {} }
        if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVis);
        for (const el of els) if (el) { try { if (el.__tt) clearTimeout(el.__tt); if (el.__tick) el.removeEventListener("timeupdate", el.__tick); el.pause(); el.src = ""; el.remove(); } catch (e) {} }
        if (mp3El) { try { mp3El.pause(); } catch (e) {} try { if (mediaSrc && mediaSrc.readyState === "open") mediaSrc.endOfStream(); } catch (e) {} try { mp3El.removeAttribute("src"); mp3El.srcObject = null; mp3El.load(); mp3El.remove(); } catch (e) {} }
        for (const q of segQueues.values()) for (const s of q) if (s && s.url) { try { root.URL.revokeObjectURL(s.url); } catch (e) {} }
        setTimeout(() => { for (const w of workers) if (w) { try { w.terminate(); } catch (e) {} } if (encWorker) { try { encWorker.terminate(); } catch (e) {} } try { ctx.close(); } catch (e) {} }, 400);
        msState("paused");
        status("stopped");
      },
    };
    root.FaustLive.lastHandle = handle;
    return handle;
  }

  // makeWalk exposed so the OFFLINE whole-path exporter drives the exact same
  // per-bar walk the live conductors use (feed it a getState that walks the loop).
  root.FaustLive = { exploreLive, makeWalk, BASE, SITE };
})(typeof window !== "undefined" ? window : globalThis);
