// faust/live/live.js — the LIVE CONDUCTOR (Phase 5b: continuous ring-buffer engine).
//
//   <script src="csd-engine.js"></script>
//   <script src="faust/voices/state-engine.js"></script>
//   <script src="faust/voices/found-player.js"></script>
//   <script src="faust/live/live.js"></script>
//   const handle = await FaustLive.exploreLive(getState, onStatus, { onBar, onLoad });
//   handle.stop();
//
// This REPLACES the old JIT/pool/eco/stem-cache scheduler outright. The audio is
// now CLICK-FREE BY CONSTRUCTION: a stream renderer (faust/stream-worker.js →
// faust/stream-renderer.js) writes a continuous full-mix stereo PCM stream into a
// SharedArrayBuffer ring; the faust/ring-player.js AudioWorklet reads it one sample
// per output sample. There are no per-bar AudioBufferSourceNode seams to click.
//
// THE MODEL: write audio into a buffer, read from it continuously; when the
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
// Reuses AS-IS: faust/live/ring-player.js, faust/live/stream-worker.js,
// faust/live/stream-renderer.js, voices/found-player.js, voices/sampler.js. The
// state→events fabric is csd-engine + state-engine, the same brain press.js drives,
// so the live stream matches the press gold standard.
(function (root) {
  "use strict";

  const scriptSrc = (typeof document !== "undefined" && document.currentScript && document.currentScript.src)
    || (typeof location !== "undefined" ? location.origin + "/engine/faust/live/live.js" : "engine/faust/live/live.js");
  // BASE is this file's own folder (engine/faust/live/); FAUST is the faust root one
  // up (dist/, node_modules/, voices/, press/, codec/, data/ hang off it); SITE is the
  // web root (found/, found/samples/) — up THREE from engine/faust/live/.
  const BASE = new URL(".", scriptSrc).href;   // .../engine/faust/live/
  const FAUST = new URL("..", BASE).href;      // .../engine/faust/
  const SITE = new URL("../../..", BASE).href; // site root (found/, found/samples/)

  // ── ring control-block layout (must match ring-player.js / stream-worker.js) ──
  const SR = 44100, BS = 64;
  // MASTER TOP: the "off" corner. At/above this the master ceiling filter is
  // transparent (nyquist is 22.05k, so a 2-pole at 20k does nothing audible).
  const TOP_OFF = 20000;
  const C_STATE = 0, C_XFADE = 1, C_ACTIVE = 2, C_READ_LO = 3, C_READ_HI = 4,
        C_UNDERRUN = 5, C_UNDER_CNT = 6;
  const C_RING0 = 8, RING_STRIDE = 4, R_WRITE = 0, R_READ = 1;
  // ARMED crossfade: the conductor writes the output frame the ramp
  // starts on + its length ONCE and ring-player.js runs the equal-power ramp off
  // its own sample clock. See ring-player.js "SAMPLE-EXACT FADE".
  const C_FADE_AT_LO = 16, C_FADE_AT_HI = 17, C_FADE_LEN = 18;
  // the reader's starvation SHAPE (ring-player.js documents the layout)
  const C_UNDER_EPI = 19, C_UNDER_MAX = 20, C_UNDER_RUN = 21,
        C_UNDER_AT_LO = 22, C_UNDER_AT_HI = 23, CTRL_INTS = 24;

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
  // health floor for the RENDERED (ring) runway — see the load reporter. A bar sits
  // fed-but-unrendered for its whole render time, so the ring legitimately BREATHES
  // between roughly one bar and the feed target: measured on a 4-core box at 1.5×
  // oversubscription (house/dub/jungle, 120 s), rendered runway p50 4.14 s, p10 2.52 s,
  // p1 1.44 s, min 0.94 s while the FEED ledger sat at 5.0-5.3 s throughout — that gap
  // is the phantom. The floor is what a single main-thread/worker stall (measured up to
  // 585-623 ms) could swallow: below it, a hiccup is an audible hole.
  const RING_FLOOR_SEC = 0.5;

  // ── MEDIA-SESSION IDENTITY ─────────────────────────────────────────────────
  // THE ENGINE DOES NOT OWN WHAT THE LOCK SCREEN SAYS. It has no access to the
  // kernel's display labels or the star map's cluster names, so it must not
  // pretend to: hardcoding identity here CLOBBERS the app, because these blocks
  // fire AFTER the app's own updateMediaSession and the wavOut one re-asserts
  // every second. So the HOST supplies the strings: opts.mediaMeta() is a
  // callback returning { title, artist, album, artwork? } (app/audio/live.js composes
  // the current genre's label + its cluster). With no callback the engine never
  // overwrites metadata a host has already set, and fills the slot only when it
  // is empty — with something at least TRUE.
  const MEDIA_FALLBACK = { title: "STELLATE", artist: "stellate.app", album: "the genre space" };
  // returns the new signature (the caller keeps it so a 1 Hz poll doesn't re-mint
  // an identical MediaMetadata — some UAs flicker/renotify on every assignment).
  function setMediaMeta(MS, root, opts, last, sink) {
    if (!MS || typeof root.MediaMetadata === "undefined") return last;
    const cb = opts && typeof opts.mediaMeta === "function" ? opts.mediaMeta : null;
    let m = null;
    if (cb) { try { m = cb(); } catch (e) { m = null; } }
    if (!m) {
      if (MS.metadata) return last;   // the host owns this slot — leave it alone
      m = MEDIA_FALLBACK;
    }
    const meta = { title: String(m.title || MEDIA_FALLBACK.title),
      artist: String(m.artist || MEDIA_FALLBACK.artist),
      album: String(m.album || MEDIA_FALLBACK.album) };
    if (m.artwork && m.artwork.length) meta.artwork = m.artwork;
    const sig = meta.title + " | " + meta.artist + " | " + meta.album;
    if (sig === last) return last;
    try { MS.metadata = new root.MediaMetadata(meta); } catch (e) {}
    if (sink) sink(meta);
    return sig;
  }

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
    // ENDLESS-LOOP entrance memory (per voice, persists across bars for this walk):
    // dynPrevOn = was the voice sounding last bar; dynEnded = has a run of it ever
    // finished (so it's an ESTABLISHED voice, not a first appearance); dynSuppressIn
    // = suppress the entrance swell for the current run. See the voiceRun block below.
    const dynPrevOn = {}, dynEnded = {}, dynSuppressIn = {};
    // DROP-IN (the bookmarkable measure): startBar>0 fast-forwards
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
    // burst memo state (see BURST MEMO in stepWalk): valid only for the duration of
    // one synchronous run — the microtask below clears it before any timer, event or
    // await can hand the app a chance to mutate the state object it was derived from.
    let memoSt = null, memoSec = null, memoFill = null, memoSweep = null;
    let memoUnits = null, memoFx = null, memoArmed = false;
    const clearMemo = () => { memoSt = null; memoSec = null; memoUnits = null; memoFx = null; memoArmed = false; };
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
        // ENDLESS-LOOP entrance law. The entrance swell — a voice rising from its
        // floor over the first bars of its run — is a REAL beginning only ONCE, at
        // the voice's first appearance in the session. In press that's the whole
        // story (one play-through has a real start), but the live/journey walk loops
        // the form forever, so re-swelling from the floor every time the voice
        // re-enters (after each breakdown/outro that drops it) is an audible dip.
        // So: an ESTABLISHED voice (one whose run has ended at least once) returns at
        // FULL — only its EXIT fade into the next silence remains. dynSuppressIn is
        // latched at the off→on edge and persists (covering a run that WRAPS the loop
        // seam, where there is no fresh edge). Exit fades and the first entrance are
        // unchanged, so the swell a listener hears when a voice truly arrives stays.
        const wasOn = !!dynPrevOn[v], onNow = !!vAct[v](cur0);
        if (onNow && !wasOn) dynSuppressIn[v] = !!dynEnded[v];   // re-entrance of an established voice → no swell-in
        if (!onNow && wasOn) dynEnded[v] = true;                 // a run just ended → the voice is now established
        dynPrevOn[v] = onNow;
        if (!onNow || secs.every(s => vAct[v](s))) { voiceRun[v] = null; continue; }   // off now, or on the whole loop → no ramp
        let a = secIdx; while (a - 1 >= 0 && vAct[v](secs[a - 1])) a--;
        let b = secIdx; while (b + 1 < secs.length && vAct[v](secs[b + 1])) b++;
        let before = 0; for (let s = a; s < secIdx; s++) before += secBarsOf(secs[s]);
        let runBars = 0; for (let s = a; s <= b; s++) runBars += secBarsOf(secs[s]);
        voiceRun[v] = { i: before + cycIdx * nch + ci, n: runBars, noIn: !!dynSuppressIn[v] };
      }
      // THE SEAM LAW (docs/TIMING-AUDIT-2026-07 finding 1): this walk regenerates the
      // whole collapsed section EVERY bar with a different seed, so the two generations
      // that straddle a chord-bar boundary draw their humanize jitter independently —
      // half-open windowing on the jittered beat dropped ~24% of chord-bar downbeats and
      // doubled ~24%. _seamWin asks buildEvents to stamp e.beat0 (the DRAWLESS musical
      // position: swing + push-pull in, the humanize draw out); SE.mapEvents windows on
      // THAT while the note still plays at its jittered beat, so ownership is decided on
      // a quantity both generations agree on and the groove is untouched. Live-only flag
      // — press never sets it, stamps no beat0, and stays byte-identical.
      const one = Object.assign({}, st, { sections: [sec], seed: ((st.seed || 1) + serial * 7919) >>> 0,
        instrumentSeed: st.instrumentSeed != null ? st.instrumentSeed : (st.seed || 1),   // instrument identity rides the SONG seed, not the per-bar reseed
        _liveEdge: liveEdge, _voiceRun: voiceRun, _seamWin: true });
      const spb = 60 / st.bpm;
      // THE BAR IS AS LONG AS THE STATE SAYS — rounded to a whole beat, because for
      // the parent's own music chordEvery is a grid and a fraction would only ever
      // be a typo. A FOREIGN COMPOSER measures its own bars: nukernel's tempo map
      // warps every one of them by a different ratio, and rounding that back to a
      // beat would put the rubato on the grid it was written to leave. So it may
      // answer `barBeats` per bar, and then the bar is ITS length and the window
      // opens at zero (there is no chord cycle to sit inside).
      const fedCB = (opts && opts.barBeats)
        ? +opts.barBeats({ serial, secIdx, ci, cycIdx, st }) : 0;
      const CBEATS = fedCB > 0 ? fedCB
        : Math.max(2, Math.round(st.chordEvery || (st.meter ? 6 : 8)));
      const lo = fedCB > 0 ? 0 : ci * CBEATS, hi = lo + CBEATS;
      // ...OR EVENTS THE CALLER ALREADY HAS. The parent generates its own music
      // from a state; a caller with its OWN composer does not want that — it wants
      // this engine's scheduler, voice pools, ring and mixer playing ITS notes.
      // stream-renderer.js took exactly this seam for the offline side (`io.sched
      // || SE.buildSchedule(E, state)`), and this is the live half of it: absent
      // opts.events every existing caller is byte-identical, because this is the
      // same call it always made.
      //
      // WHY IT IS ONE LINE AND NOT A PORT: nukernel had grown its own scheduler,
      // mixer, graph and render — about 5,500 lines duplicating what is already
      // here — and every seam between the two engines was a bug (the desk missing
      // from the tape, drums disagreeing across paths, velocity meaning two
      // different things, a render that hangs on WebKit and kills the tab). One
      // engine, one signal path; the app above it keeps its own composer and desk.
      // …AND ITS OWN CAST. voiceUnits below resolves the parent's four chairs off
      // the state; a foreign composer seats a whole band per bar (nukernel gives
      // every voice of every box its own unit), so `events` may answer with
      // { ev, units } and keep the unit table it built in the same breath as the
      // notes. One object, one translator — the two cannot disagree, which is the
      // whole point. Answer with the bare four arrays and the parent seats it.
      const fed = (opts && opts.events) ? opts.events(one, { sec, secIdx, ci, serial, spb }) : null;
      const ev = (fed && (fed.pitched ? fed : fed.ev)) || E.buildEvents(one);
      const fedUnits = (fed && fed.units) || null;
      // SECTION IDENTITY IS THE INDEX, NOT THE NAME. This walk selects secs[secIdx]
      // — the name is only a label — and the app mutates the playing state under it
      // (a glide across a genre boundary replaces st.sections wholesale with a form
      // that names its parts differently). A bar scheduled a runway ahead therefore
      // fires with a section NAME that no longer occurs in the state the ⓘ readout
      // then reads, and a name-keyed lookup there silently fell back to sections[0]
      // — the sparse opener — so the timeline drew one or two lanes while a full
      // arrangement was sounding. Carry the index so a reader can resolve the same
      // section this walk did (app/audio/notefeed.js).
      const meta = { serial, ci, nch, spb, cbeats: CBEATS, chord: (prg.chords[ci] || {}).name || "",
        section: sec.name, secIdx, nsec: secs.length, sec, absBeatLo: absBeat, lo };
      const advance = () => { absBeat += CBEATS; ci++; serial++;
        if (ci >= nch) { ci = 0; cycIdx++; if (cycIdx >= (secs[secIdx].cycles || 1)) { cycIdx = 0; secIdx = (secIdx + 1) % secs.length; } } };
      // LIGHT MIDI WALK (crash fix): the whole-path MIDI export only
      // needs the note events (ev) + timing; skip voiceUnits/mapEvents/fxParams (the
      // expensive AUDIO mapping + the big unit objects) so buildLoopMidi's SYNCHRONOUS
      // main-thread walk over a long loop doesn't block the UI for seconds and get
      // the page killed. Same per-bar seed/section walk => identical MIDI.
      if (opts && opts.midiOnly) { const rl = { one, spb, lo, hi, meta, musicalSec: (hi - lo) * spb, ev }; advance(); return rl; }
      // ── BURST MEMO (audit tier 4: "stepWalk renders the full chord cycle every bar
      // and keeps 1/nch of it"). buildEvents can't be windowed from here (whole-section
      // context + the per-bar reseed), but voiceUnits + fxParams are 22-40% of the walk
      // body and are provably blind to everything the walk varies per bar: measured over
      // all 274 genres x seeds 1/4/7 x 8 bars (822 states), NEITHER output changes when
      // only the per-bar seed / _liveEdge / _voiceRun move — instrument identity rides
      // instrumentSeed by design. What they DO read is the live state, which the app
      // mutates IN PLACE while gliding (app/audio/targeting.js glideStep walks bpm, sends,
      // dx7 params…), so a lasting cache would go stale and change what is heard.
      // The memo is therefore scoped to ONE SYNCHRONOUS BURST: a microtask invalidates
      // it, and nothing can mutate the state without first yielding the thread. So it
      // only ever fires inside a single pumpOnce/priming loop (up to 24 bars back to
      // back — exactly the burst the finding is about) and is a provable no-op in
      // steady state, where one bar is produced per pump tick.
      // (a fed cast is per-bar by construction — the box under the playhead names
      // it — so the burst memo cannot speak for it and is skipped outright.)
      const memoKey = !fedUnits && cur0 === memoSec && sec.fill === memoFill && sec.sweep === memoSweep && st === memoSt;
      let units, fxParams;
      if (fedUnits) { units = fedUnits; fxParams = SE.fxParams(one); }
      else if (memoKey && memoUnits) { units = memoUnits; fxParams = memoFx; }
      else {
        units = SE.voiceUnits(E, one);
        fxParams = SE.fxParams(one);
        memoSt = st; memoSec = cur0; memoFill = sec.fill; memoSweep = sec.sweep;
        memoUnits = units; memoFx = fxParams;
        if (!memoArmed) { memoArmed = true; Promise.resolve().then(clearMemo); }
      }
      // ...AND THE MASTER STAGE, ON THE SAME SEAM (2026-08-28). A foreign
      // composer may answer with `fx` beside `ev`/`units`: per-BAR overrides on
      // the fx_bus params this walk hands the renderer, which feedBar glides
      // onto the persistent proc from the bar's first block (changed keys only).
      // The parent's own state stays the base — `fx` is a delta over it, never
      // a replacement — so a caller naming one slider does not blank the rest.
      // nukernel uses it for a section's echo time (nukernel/audio/plan.js
      // barFx); absent, this line does not run and every existing caller is
      // byte-identical, which is the same law `opts.events` itself took.
      if (fed && fed.fx) fxParams = Object.assign({}, fxParams, fed.fx);
      const m = SE.mapEvents(E, one, ev, { lo, hi, units });
      const barLenFrames = Math.max(BS, Math.round((hi - lo) * spb * SR / BS) * BS);
      const r = { one, song: st, units, sig: sigOf(units), spb, lo, hi, events: m.events, fxParams,
        sweepsRaw: m.sweeps, found: m.found, foundSources: one.foundSources || [], meta,
        barLenFrames, musicalSec: (hi - lo) * spb, ev };   // ev = note-level buildEvents (this bar's collapsed section) for the offline MIDI exporter
      // `song` is the WHOLE-FORM state this bar was collapsed from — `one` carries
      // sections:[sec], so anything asking "what can this song voice across all
      // its sections" (the decode warm set) has to read `song`, not `one`.
      advance();
      return r;
    };
  }

  // ── OVERSIZED-BAR SPLIT (the PRIMING HANG, docs/history/NEXT.md §5). The chord-bar is the
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
  // THE 1-BAR FIRST CHUNK (PHASE 0 — THE TAPE, 2026-08-27). The first window fed
  // to a FRESH stream is cut to ~1 s: measured on the deployed page, the first
  // chord-bar was 4.14 s and took 3,787 ms to render, and the prefill could not
  // begin counting until ALL of it landed — so the ear paid for the whole bar
  // before the ring held a single frame. A short first window puts audio in the
  // ring after ~1 s of render and the prefill/prime ledgers start moving with it.
  // The seam is lawful by the same argument as the oversized-bar split above
  // (persistent procs carry note sustain across window boundaries); the rest of
  // the bar then splits by MAX_FEED_SEC exactly as before.
  const FIRST_FEED_SEC = 1.0;
  function splitFeedWindows(r, firstSec) {
    // cut points, in beats: an optional short first window, then equal windows
    // of at most MAX_FEED_SEC over the remainder (the original split, unchanged
    // when firstSec is 0/absent — same n, same equal steps, same frame math).
    const cuts = [r.lo];
    let pos = r.lo;
    if (firstSec > 0 && r.musicalSec > firstSec * 1.5) { pos = r.lo + firstSec / r.spb; cuts.push(pos); }
    const remSec = (r.hi - pos) * r.spb;
    const n = Math.max(1, Math.ceil(remSec / MAX_FEED_SEC));
    for (let i = 1; i < n; i++) cuts.push(pos + i * (r.hi - pos) / n);
    cuts.push(r.hi);
    if (cuts.length === 2) return [r];
    const out = [];
    for (let i = 0; i + 1 < cuts.length; i++) {
      const first = i === 0, last = i + 2 === cuts.length;
      const lo = cuts[i], hi = cuts[i + 1];
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
    let msDest = null, mediaEl = null, _capDest = null;   // _capDest: lazy audio capture tap for the video exporter (desktop)
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
        // A REFUSED BOOT PLAY ARMS THE REVIVAL. If this open ran outside a live
        // user gesture (a caller that awaited an engine fetch first — the daw's
        // cold boot), iOS refuses this play() and the walk would run over a
        // silent element forever: the stripe moves, no sound (2026-08-19).
        // armGestureResume is this closure's own next-touch revival; the
        // rejection lands async, after its definition initializes.
        const pr = mediaEl.play();
        if (pr && pr.catch) pr.catch(() => {
          try { if (typeof armGestureResume === "function") armGestureResume(); } catch (e) {}
        });
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
    // the media-element route. DESKTOP does not run goHidden on a mere tab-hide (the
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
    const ctrlSab = new SharedArrayBuffer(CTRL_INTS * 4);
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
    // USER MASTER VOLUME, AND IT RIDES THE MASTER BUS'S *INPUT* (2026-08-25).
    //
    // Paul: "Almost everything is once again loud and distorted and there's no
    // way to bring it down." The second half of that sentence is the diagnosis.
    // This node used to sit at the very END of the chain — after the glue
    // compressor, after the make-up, after the brickwall — so every position of
    // the fader delivered the SAME crushed signal at a different volume.
    // Measured on a precomposed Detroit-1965 record before the move: crest 8.2 dB
    // at full, 8.1 dB at a quarter, 7.7 dB at a tenth. The distortion did not
    // move, because the thing making it was upstream of the hand on the knob.
    //
    // It now sits between masterGain and busComp, so turning it down backs the
    // mix OUT of the make-up and out of the limiter. Same record after the move:
    // crest 9.3 / 9.5 / 11.2 / 12.4 / 12.9 dB at 100 / 75 / 50 / 25 / 10, and
    // silence at 0. Bringing it down now brings the DISTORTION down, which is
    // what a listener means by the words.
    //
    // What the move costs, said plainly: the fade/mute automation on masterGain
    // and the duck on voiceGain are still upstream of the fader, so they compose
    // with it exactly as before; and the RMS meters read `analyser`, which is at
    // the end of the chain, so they now read POST-volume rather than pre. That is
    // the honest reading anyway — it is the signal the ear gets. setMasterVol()
    // rides this node; range is the UI's business (0..~1.5).
    const userGain = ctx.createGain();
    userGain.gain.value = (opts.masterVol != null ? Math.max(0, Math.min(4, opts.masterVol)) : 1);
    // MASTER BUS: into a UNITY masterGain with no glue and no makeup, the live ring
    // mix is unmastered — the mastering the PRESS path bakes (fx_bus comp/drive +
    // up to +18 dB peak-normalizing makeup, see press.js computeMakeup) never runs
    // live, so the sampled voices (the default sound) play dry and quiet
    // (~−22 dBFS peak straight to output). This causal
    // master bus restores it: a gentle glue compressor → a makeup lift → a
    // brickwall limiter for peak safety, all on the SUM so it lifts the native
    // sampled/found voices too. Live-only (main-thread graph); the baked export
    // path keeps its own mastering, so segment-parity/fixtures are untouched.
    const busComp = ctx.createDynamicsCompressor();
    busComp.threshold.value = -22; busComp.knee.value = 28; busComp.ratio.value = 2.2; busComp.attack.value = 0.015; busComp.release.value = 0.25;
    // ── THE MAKE-UP IS A TARGET NOW, NOT A CONSTANT (2026-08-25) ────────────
    // It was a fixed x2.6 (+8.3 dB), and the paragraph above says exactly why it
    // was right when it was written: "the sampled voices (the default sound) play
    // dry and quiet (~-22 dBFS peak straight to output)". That is no longer the
    // material. Measured through this very node on 2026-08-25, a precomposed
    // full-band record arrives at masterGain at -9.4 to -11 dBFS RMS with peaks
    // of 1.20 to 1.39 — already at and over full scale — because the NATIVE
    // sampled layer (live-mode samplers are played here, not baked: see the
    // `bakeNative` note in stream-renderer) joins the ring's own fx_bus output,
    // which is itself soft-clipped at 0.7125.
    //
    // A fixed +8.3 dB on top of that does not make it louder; it makes it
    // CRUSHED. Measured: of the 8.3 dB, the brickwall gave 5.7 dB straight back
    // as continuous gain reduction and the remaining 2.6 dB was bought with
    // crest — motown crest 7.9 dB, afrobeats 6.7 dB, against 10.3-12.3 dB for the
    // same box's records the day before. That is the "loud and distorted".
    //
    // So the make-up reads the level ARRIVING at the master bus and rides toward
    // a target. Three properties, each deliberate:
    //   * it reads PRE-FADER, so a listener turning the volume down can never
    //     make this push back up — the fader stays a fader;
    //   * it is CAPPED at the old 2.6, so no record in the catalog can come out
    //     louder than it does today, and the quiet material (the chant: -25 dBFS
    //     at this bus) still gets exactly the +8.3 dB it always got;
    //   * it is FLOORED at 1.0 and moves on a 1.5 s time constant off a smoothed
    //     envelope, so it follows a record and never a bar. This is not a
    //     compressor and must not act like one.
    // Measured after, at the same volume, peak/crest: chant -14.66/14.49
    // (unchanged), reggae -14.09/13.95 (unchanged), metal -9.27/9.10 (was
    // -7.99/8.18), motown -9.56/9.40 (was -7.36/7.92), afrobeats -8.47/8.30 (was
    // -6.36/6.69). Nothing got louder; the hot records came back into the
    // neighbourhood they were in the day before, with their transients.
    // ── ...AND IT ONLY EVER PUSHED (2026-08-28) ────────────────────────────
    // Paul, three rounds running: *"The mix is still too hot"*, and this round
    // *"Bring it down even more, quiet is nice."* Two turn-downs had already
    // been made UPSTREAM of this node — nukernel's LEVEL_LANES went to 0.375 of
    // its 08-26 value (-8.5 dB) and fields.js DRIVES halved — and Paul could
    // still not hear them. This node is why, and the reason is the two numbers
    // on this line, not taste:
    //
    //   MEASURED AT THE LISTENER'S OWN TAP (the `analyser` below, which is the
    //   last node before the ear), 30 s per record, six records whose level
    //   ARRIVING here spans 13 dB (-17.0 dBFS RMS for rock down to -30.2 for
    //   ambient, rendered through the shipped worker):
    //
    //     iranpop -12.96   steely -14.01   rock -12.30
    //     neoclassical -14.19   ambient -21.51   hymn -14.85
    //
    //   Five of the six landed inside 2.6 dB of each other, with peaks pinned
    //   at -0.2 to -0.9 dBFS. A 13 dB spread came in and a 2.6 dB spread went
    //   out: this rider was not riding, it was FLATTENING, and then the
    //   brickwall was holding the top of every one of them. THAT is the "hot
    //   mic" — and it is also why every cut made upstream since 08-26 was
    //   inaudible. A cut a normaliser undoes is not a cut.
    //
    // TWO CHANGES, both on this line:
    //   * THE TARGET IS -20, not -14. Six dB is exactly what Paul keeps asking
    //     for, and this is the one stage in the tree where asking for it is
    //     answered — every stage upstream is handed straight back by the ride.
    //   * THE FLOOR IS 0.35, NOT 1.0, so the leveller can PULL DOWN. It was
    //     floored at unity when it was written (2026-08-25) because the problem
    //     that day was quiet material; the consequence is that a record hotter
    //     than the target could never be brought to it, which is every record
    //     the box makes. 0.35 is -9.1 dB: the leveller may lift a quiet record
    //     by up to 8.3 dB and lean on a loud one by up to 9.1, and past that the
    //     RECORD is what is wrong and the record is where to fix it.
    // MEASURED AFTER, same tap, same 30 s, same six (rms / crest):
    //     iranpop -18.03/17.49 (was -12.96/12.72)   steely -19.13/18.50 (-14.01/13.71)
    //     rock    -15.88/15.56 (-12.30/12.09)   neoclassical -17.88/16.05 (-14.19/13.55)
    //     hymn    -17.96/16.92 (-14.85/13.99)   ambient -21.52/14.02 (-21.51/14.04)
    // 3.1 to 5.1 dB quieter AND 2.5 to 4.8 dB of crest back — the second number
    // is the one that answers "saturated": those dB were being spent on the
    // limiter, and they come back as transient. Ambient is untouched to two
    // decimal places, which is the property to keep: this pulls down only what
    // it was pushing up.
    // The three properties the 08-25 note lists all still hold — pre-fader, so
    // the fader stays a fader; a 1.5 s ride off a smoothed envelope, so it
    // follows a record and not a bar; capped, so nothing gets louder than it
    // did. Only the direction is new.
    const MK_MAX = 2.6, MK_MIN = 0.35, MK_TARGET_DB = -20;
    // ...and it OPENS at unity rather than at MK_MAX. Starting at the ceiling
    // made the first second of every play the loudest moment in the record —
    // +8.3 dB, riding down over 1.5 s — which is the opposite of what the rest
    // of this block is for. Unity is the honest opening: no makeup until the
    // ride has actually read the record.
    const makeup = ctx.createGain(); makeup.gain.value = 1;
    const mkTap = ctx.createAnalyser(); mkTap.fftSize = 2048;
    const mkBuf = new Float32Array(mkTap.fftSize);
    let mkTimer = 0, mkSlow = 0;
    const mkRide = () => {
      try {
        mkTap.getFloatTimeDomainData(mkBuf);
        let acc = 0;
        for (let i = 0; i < mkBuf.length; i++) acc += mkBuf[i] * mkBuf[i];
        const r = Math.sqrt(acc / mkBuf.length);
        if (!(r > 0)) return;
        mkSlow = mkSlow ? mkSlow + (r - mkSlow) * 0.06 : r;   // a record, not a bar
        const want = Math.pow(10, (MK_TARGET_DB - 20 * Math.log10(mkSlow)) / 20);
        makeup.gain.setTargetAtTime(Math.max(MK_MIN, Math.min(MK_MAX, want)), ctx.currentTime, 1.5);
      } catch (e) {}
    };
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1.5; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.12;
    // VOICE DUCK — a gain between the RING and the master, so the engine can pull the
    // instruments down without touching anything else. The ring carries every Faust
    // voice (sampled + synth); the FOUND layer joins at masterGain further down and is
    // deliberately NOT behind this, so a duck lowers the band and leaves the beds and
    // speech holding the room.
    //
    // The point of doing it here rather than in JS scheduling: this is an AudioParam
    // ramp, so it runs on the audio thread. A soundfont swap costs the main thread
    // ~1.9 s of work in chunks up to 233 ms (measured, cold sgm swap on a live
    // engine) — anything JS has to schedule per bar stutters through that, and a gain
    // ramp does not. The duck is smooth even while the thread is busy, which is the
    // whole reason a fade can cover a swap at all.
    const voiceGain = ctx.createGain(); voiceGain.gain.value = 1;
    ringNode.connect(voiceGain);
    voiceGain.connect(masterGain);
    masterGain.connect(userGain); userGain.connect(busComp);   // the fader is the master bus's INPUT
    masterGain.connect(mkTap);                                 // ...and the make-up reads PRE-fader
    mkTimer = setInterval(mkRide, 250);
    busComp.connect(makeup);   // makeup -> topLP -> vaporLP -> limiter, wired below
    // ── THE BRICKWALL (docs/TIMING-AUDIT-2026-07 "the master output
    // clips"). A DynamicsCompressor is not a limiter: at threshold −1.5 dB / ratio 20
    // its 2 ms ATTACK passes a transient's first ~90 samples at full gain, so the
    // output went over full scale (and was hard-clipped by the browser) in 15.7% of
    // loud 100 ms windows, peak 1.166. dsp/master_limit.dsp is a real lookahead
    // limiter — 2 ms of lookahead, gain from the peak about to arrive, sliding-min so
    // the ramp is complete when it lands. Below the ceiling it is bit-transparent, so
    // the compressor above still does all the audible gain riding and this only
    // catches what escaped it. Wired at the END of the chain (analyser, clickmon,
    // vapor and userGain all hang off its output = the listener's actual signal).
    // If it can't be built, the chain falls back to exactly the previous topology.
    let masterLimit = null;
    try {
      const fw = await import(FAUST + "node_modules/@grame/faustwasm/dist/esm/index.js");
      const fac = await fw.FaustWasmInstantiator.loadDSPFactory(
        FAUST + "dist/master_limit-module.wasm", FAUST + "dist/master_limit-meta.json");
      masterLimit = await new fw.FaustMonoDspGenerator().createNode(ctx, "master_limit", fac);
    } catch (e) { errors.push("master_limit: " + (e && e.message || e)); masterLimit = null; }
    const masterOut = masterLimit || limiter;   // the last node of the master chain
    if (masterLimit) limiter.connect(masterLimit);
    // ── AND THE CEILING IS THE LAST WORD NOW (2026-08-25) ───────────────────
    // It was not. master_limit guarantees 0.98 and then TWO lowpass biquads sat
    // downstream of it — `topLP` and `vaporLP`, both parked at 20 000 Hz, which
    // at 44.1 kHz is 0.907 x Nyquist, where a bilinear-warped RBJ lowpass has a
    // passband PEAK. They are meant to be transparent at rest and they are not:
    // measured at the listener's own node, the output came back over full scale
    // at every volume of 100 — motown peak 1.067 with 50 samples past +1.0 in
    // 25 s, afrobeats 1.038 with 35, boombap 1.091 with 75 — and the browser
    // hard-clips every one of them on the way to the device. Detaching the two
    // filters and nothing else: 0.985 and 0.985, zero clipped samples. So it was
    // exactly them, and the ceiling was reaching no sound.
    // They now sit BEFORE the limiter (makeup -> topLP -> vaporLP -> limiter),
    // which is where a master tone control belongs anyway, and masterOut goes
    // straight to the ear.
    masterOut.connect(analyser);
    masterOut.connect(msDest || ctx.destination);
    // VAPOR (C.1, live-only): a global "walking through a mall" EQ on the master —
    // a high-shelf that rolls the top off + a short reverb wash, both scaled by
    // vapor 0..1. Sits AFTER the analyser (the RMS meters stay pre-vapor/pre-volume)
    // and before userGain. LIVE-ONLY (main-thread graph, the classic exploreLive
    // path) — the worker-baked export/WAV mix never sees it, so segment-parity and
    // fixtures are untouched. (The WAV-first mobile path plays a plain <audio> with
    // no WebAudio graph, so vapor rides the classic/desktop path only.)
    // "walking through an empty mall": as vapor 0→1 the master MUFFLES (a lowpass
    // sweeping the top off — heard through walls / over a distant PA), the direct
    // sound RECEDES (dry ducks), and it drenches in a big DIFFUSE hall wash (three
    // lowpassed comb delays + pre-delay = a huge empty concourse). It's a strong,
    // evocative move by design, not a gentle EQ. analyser → vaporLP → {dry + wash}.
    const vaporLP = ctx.createBiquadFilter(); vaporLP.type = "lowpass";
    vaporLP.frequency.value = 20000; vaporLP.Q.value = 0.4;
    const vaporDry = ctx.createGain(); vaporDry.gain.value = 1;
    const vaporWet = ctx.createGain(); vaporWet.gain.value = 0;
    const vaporPre = ctx.createDelay(0.2); vaporPre.delayTime.value = 0.028;   // pre-delay = distance/space
    [[0.113, 0.74], [0.149, 0.71], [0.193, 0.68]].forEach(([t, fb]) => {   // 3 damped combs → diffuse mall wash
      const d = ctx.createDelay(0.5); d.delayTime.value = t;
      const g = ctx.createGain(); g.gain.value = fb;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3000;
      vaporPre.connect(d); d.connect(lp); lp.connect(g); g.connect(d); d.connect(vaporWet);
    });
    // MASTER TOP — a global CEILING over the whole master, independent of vapor.
    //
    // "We lost the LPF over everything; the high bleeps and the extremely high pads are
    // back." Measured before building this: no LPF was lost. The only per-genre master
    // lowpass is state.tone.highcut, and across 274 genres x seeds 1/5/7 it is ABSENT on
    // 681 of 822 draws (82.8%) — identical at every revision back through d09417e, so
    // nothing recent removed it. 83% of the catalogue has simply never had a ceiling, and
    // the only global tone control in the chain is MASTER_AIR_SHELF_DB, a -7 dB SHELF at
    // 4.5 kHz (-3 dB then, at 7 kHz, until Paul's 2026-08-27 "very high tones get shrieky"),
    // which by construction dims the air rather than stopping anything.
    //
    // So this is the missing thing rather than a restored one: one lowpass across the
    // FINAL master — after the limiter, after the found submix, so it catches the field
    // recordings' bleeps and the pads alike — with a gentle default and a slider, because
    // the right corner frequency is an ears question, not a measurement.
    const topLP = ctx.createBiquadFilter(); topLP.type = "lowpass"; topLP.Q.value = 0.5;
    topLP.frequency.value = TOP_OFF;
    const applyTop = (hz) => {
      const f = (+hz > 0 ? +hz : TOP_OFF);
      try { topLP.frequency.setTargetAtTime(Math.max(1200, Math.min(TOP_OFF, f)), ctx.currentTime, 0.08); } catch (e) {}
    };
    applyTop(opts.top);
    makeup.connect(topLP);
    topLP.connect(vaporLP);
    vaporLP.connect(vaporDry); vaporDry.connect(limiter);
    vaporLP.connect(vaporPre); vaporWet.connect(limiter);
    const _expLerp = (a, b, t) => a * Math.pow(b / a, t);
    const applyVapor = (v) => { v = Math.max(0, Math.min(1, +v || 0));
      try {
        vaporLP.frequency.setTargetAtTime(_expLerp(20000, 1400, v), ctx.currentTime, 0.1);   // muffle the top
        vaporDry.gain.setTargetAtTime(1 - 0.45 * v, ctx.currentTime, 0.1);                    // the music recedes
        vaporWet.gain.setTargetAtTime(0.7 * v, ctx.currentTime, 0.1);                         // fill the concourse
      } catch (e) {}
    };
    // VAPOR is now BAKED into the rendered stream (stream-renderer applyVapor), so it rides
    // the mobile WAV segments too and lands over time like a BPM change. The live output-graph
    // vapor is kept at BYPASS (transparent) so it doesn't DOUBLE-apply on desktop; curVapor is
    // the live amount, fed into each bar (feedBar) so a slider move eases in from the next bar.
    let curVapor = Math.max(0, Math.min(1, +opts.vapor || 0));
    applyVapor(0);
    // (masterOut -> msDest||destination is wired above, at the brickwall, so the
    //  ceiling is the last stage on both the live and the media-element route.)

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

    // ── ALWAYS-ON Faust CLICK MONITOR (the production detector) ──
    // dsp/clickmon.dsp tapped off master (passthrough → hard-muted terminal so the
    // browser keeps scheduling it). Its bargraphs (out-param port messages) carry
    // monotonic click/gap counters. This is the acceptance-gate detector, so it is
    // built on the main thread even though all synthesis is in the worker.
    let clickMonState = null;
    try {
      const fw = await import(FAUST + "node_modules/@grame/faustwasm/dist/esm/index.js");
      const { FaustWasmInstantiator, FaustMonoDspGenerator } = fw;
      const gen = new FaustMonoDspGenerator();
      const fac = await FaustWasmInstantiator.loadDSPFactory(FAUST + "dist/clickmon-module.wasm", FAUST + "dist/clickmon-meta.json");
      const cm = await gen.createNode(ctx, "clickmon", fac);
      // TAP POINT (docs/TIMING-AUDIT-2026-07 "the always-on click detector cannot
      // see the clicks it exists to catch"): tapping masterGain instead —
      // BEFORE the ×2.6 makeup and the limiter — blinds it. A measured full-scale
      // dropout (299 ms of digital silence, edges of 0.923/0.884 AT THE OUTPUT)
      // divided back through the makeup read ≈0.35 at that tap, under the detector's
      // 0.5 bar: `clicks` counted 0 through a total dropout. Tap the LISTENER'S
      // signal instead — the master chain's output is exactly what the analyser (and
      // the ear) gets — so the 0.5 threshold means 0.5 of full scale, as documented.
      masterOut.connect(cm);
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
    const bufJobs = new Set();   // in flight — see samplerBufJobs below for why undefined won't do
    function kickBuffer(src) {
      if (!src || bufCache[src.id] !== undefined || bufJobs.has(src.id)) return;
      // SPEECH organ: a synthText source synthesizes (lazy wasm, url-keyed
      // cache inside FP.synthToBuffer via CsdSpeech.key) instead of fetching.
      if (src.synthText) {
        bufJobs.add(src.id);
        decGate.run(() => FP.synthToBuffer(ctx, src.synthText), (b) => !!(b && b.length), () => !abort)
          .then(({ v }) => { bufCache[src.id] = (v && v.length) ? v : null; bufJobs.delete(src.id); });
        return;
      }
      const url = src.url || (src.samplePath ? new URL(src.samplePath, SITE).href : null);
      if (!url || bufFail.has(url)) { bufCache[src.id] = null; return; }
      bufJobs.add(src.id);
      decGate.run(() => FP.decodeUrlToBuffer(ctx, url), (b) => !!(b && b.length), () => !abort)
        .then(({ v }) => { if (v && v.length) bufCache[src.id] = v; else { bufFail.add(url); bufCache[src.id] = null; } bufJobs.delete(src.id); });
    }
    const samplerBufs = {};    // srcId -> AudioBuffer | null (RAW, sampler; null = REAL decode failure only)
    // IN-FLIGHT SET. `samplerBufs[id] = undefined` below does not mark anything —
    // undefined is the same value the guard reads as "never asked" — so a zone
    // still decoding was re-kicked by EVERY later bar that referenced it, and each
    // kick issued its own fetch + decode of the same file. Measured on a throttled
    // ride: 16 requests for 8 zones, i.e. every byte of a 4.7 MB instrument pulled
    // twice, competing with the decodes the next bars actually needed. This set is
    // what "in flight" means; the stream route has always had its own (samplerJobs).
    // A srcId is added only when a decode really starts, so the ABSENT-SOURCE UN-PIN
    // below is untouched: a bar whose foundSources lack the src still records
    // nothing and a later bar that carries it still kicks.
    const samplerBufJobs = new Set();
    function kickSamplerBuf(srcId, foundSources) {
      if (!SP || samplerBufs[srcId] !== undefined || samplerBufJobs.has(srcId)) return false;
      const src = (foundSources || []).find((s) => s.id === srcId);
      // ABSENT-SOURCE UN-PIN (the fugue->reggae total drum silence): caching null
      // for a zone whose SOURCE isn't in THIS bar's foundSources is PERMANENT —
      // the `!== undefined` guard above means that when a later glide flip finally
      // carries the source into the crate the decode is never re-attempted and
      // scheduleNative skips the voice silently forever
      // (probe: 233 fed drum events, 0 note() calls). Leave the slot UNDEFINED so
      // the first bar whose foundSources DO carry the src kicks the decode.
      if (!src) return false;
      const url = src.url || (src.samplePath ? new URL(src.samplePath, SITE).href : null);
      if (!url) { samplerBufs[srcId] = null; return false; }   // a present-but-urlless src is genuinely unplayable
      samplerBufJobs.add(srcId);
      decGate.run(() => SP.decodeUrlRaw(ctx, url), (b) => !!b, () => !abort)
        .then(({ v }) => { samplerBufs[srcId] = v || null; samplerBufJobs.delete(srcId); });
      return true;
    }
    // WARM SET — the sampler zone srcIds this SONG can voice, across every
    // section, memoised so buildSchedule runs once per real instrument change
    // rather than once a bar. Falls back to the bar's own units if the schedule
    // cannot be built (a transitional state mid-flip), which is never worse than
    // the per-bar kick already covering them.
    let _warmKey = null, _warmList = [], _warmLib = null;
    function warmSetFor(r) {
      // the WHOLE-FORM state: `one` is collapsed to a single section, so reading it
      // would see only the instruments THIS bar voices — and the late arrival is
      // exactly the case the warm-ahead exists for.
      const one = (r && (r.song || r.one)) || null; if (!one) return [];
      // Key on the samplerLib OBJECT IDENTITY, not on a string built from
      // `one.instruments` — that stringified to "[object Object]", so the key was
      // really just genre+seed and the set never invalidated when the instruments
      // changed. It has to now: the 32-bar SOUNDFONT ROTATION replaces samplerLib
      // wholesale (app/audio/targeting.js "sample" flip), and a stale warm set
      // would keep pre-fetching the OLD font's zones while the new font's arrived
      // one bar late apiece.
      const key = ((one.genreMeta && one.genreMeta.genres) || [])[0] +
        "|" + (one.instrumentSeed != null ? one.instrumentSeed : one.seed);
      if (key === _warmKey && one.samplerLib === _warmLib) return _warmList;
      _warmKey = key; _warmLib = one.samplerLib;
      const ids = [], seen = new Set();
      const take = (units) => { for (const u of Object.values(units || {}))
        if (u && u.sampler) for (const z of (u.sampler.zones || []))
          if (z.srcId && !seen.has(z.srcId)) { seen.add(z.srcId); ids.push(z.srcId); } };
      try { take(SE.buildSchedule(E, one).units); } catch (e) { take(r.units); }
      if (!ids.length) take(r.units);
      _warmList = ids;
      return ids;
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
      if (!ent) return;
      // F4 (2026-08-27): the player now owns ONE long-lived channel strip per
      // voice (sampler.js SamplerLive stripFor — the per-note buildStripNodes
      // that measured 164 compressors on the lightest record is gone), so a
      // retired player's strip chain is torn down here, on the same drain the
      // insert chain already gets — both call sites of this function are
      // places the player itself is being dropped.
      if (ent.player && ent.player.teardownStrips) { try { ent.player.teardownStrips(); } catch (e) {} }
      if (!ent.chain) return;
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
      // THE DESK MOVES; THE CHAIN IS BUILT ONCE. A chained voice taps its dry/rev/
      // del off the chain OUTPUT through three gains created at build time — so a
      // host that changes a unit's sends per bar (nukernel's desk, whose reverb
      // send is a box field a finger can move) would be heard on every unrouted
      // voice and on none of the chained ones. Re-read them here, where the bar's
      // own unit is in hand; unchanged numbers write the same value and cost
      // nothing.
      if (ent && ent.chain) {
        const want = [u.dry != null ? u.dry : 1, u.rev || 0, u.del || 0];
        for (let i = 0; i < 3; i++) {
          const g = ent.chain.sends[i];
          if (g && g.gain.value !== want[i])
            try { g.gain.setTargetAtTime(want[i], ctx.currentTime, 0.02); } catch (e) { g.gain.value = want[i]; }
        }
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
    // a failed worker init must SETTLE ensureWorker (with this flag set) —
    // resolving only on 'ready' means an initfail (network blip on the ~9 dynamic
    // imports) leaves boot awaiting forever at the spinner and openStream queueing
    // preFeed forever. Callers check the flag.
    const workerFailed = [null, null];
    function ensureWorker(wi) {
      if (workerReadyProm[wi]) return workerReadyProm[wi];
      workerReadyProm[wi] = new Promise((resolve) => {
        readyResolve[wi] = resolve;
        const w = new Worker(BASE + "stream-worker.js", { type: "module" });
        workers[wi] = w;
        w.onmessage = (e) => onMsg(wi, e.data);
        w.onerror = (e) => {
          const msg = "worker" + wi + " error: " + ((e && e.message) || e);
          errors.push(msg);
          // a worker that errors BEFORE 'ready' never becomes ready — settle the boot await
          if (!workerReady[wi]) { if (!workerFailed[wi]) workerFailed[wi] = msg; if (readyResolve[wi]) readyResolve[wi](); }
        };
        w.postMessage({ type: "init" });
      });
      return workerReadyProm[wi];
    }

    let genCounter = 0;
    let cur = null, br = null;              // current + bridging stream objects
    let phase = "idle";                    // idle | bridging | fading  (before RUN: idle, cur priming)
    let running = false, abort = false;
    let fadeStartCursor = 0, swapTimer = 0;
    const fadeLog = [];   // crossfade telemetry (the seam gate + __fades() read this)

    // the onBar playback queue: bars awaiting their read-cursor crossing.
    const playQueue = [];
    let prodLoad = null;            // the producer's last self-timing (see stream-worker prodReport)

    function newStream(ring) {
      // musicFrames = fedFrames MINUS any tail top-ups (see feedTail): the end of
      // the last real bar, which is where the crossfade may anchor. tailRef carries
      // what a tail window needs to continue this stream past that point.
      return { ring, wi: ring, gen: null, sig: null, readyToFeed: false, primed: false,
        fedFrames: 0, musicFrames: 0, tailFrames: 0, tailRef: null,
        fedMusicalSec: 0, startGlobal: null, preFeed: [], pendingBars: [] };
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
        barStartSec: r._base, sweeps: r._sweeps, vapor: curVapor,
        // AUDIT-TRUTH: the bar's serial rides along so the producer can key its
        // per-voice measurement back to this bar. A TAIL window has no meta and so
        // no serial — it is decay, not a bar, and is never audited.
        serial: r.meta ? r.meta.serial : null } });
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
      if (workerReady[stream.wi]) proceed();
      else ensureWorker(stream.wi).then(() => {
        // failed worker init: bail via the openfail path instead of posting the
        // open / queueing preFeed forever (the worker's engine will never exist).
        if (workerFailed[stream.wi]) {
          errors.push("openfail (worker init) gen? ring" + stream.ring + ": " + workerFailed[stream.wi]);
          if (stream === cur && !running) status("engine error: " + workerFailed[stream.wi]);
          return;
        }
        proceed();
      });
    }
    function feed(stream, r) {
      // stream-absolute sweep mapping (sweeps are rare — only section open/close)
      const base = stream.fedMusicalSec;
      r._base = base;
      r._sweeps = (r.sweepsRaw || []).map((sw) => ({ t0: base + (sw.beat - r.lo) * r.spb,
        t1: base + (sw.beat + sw.durB - r.lo) * r.spb, from: sw.from, to: sw.to }));
      // oversized-bar split (the priming hang): the WORKER gets bounded sub-windows;
      // everything below (playQueue bar, native scheduling, onBar) stays whole-bar.
      // A fresh stream's FIRST bar additionally gets the ~1 s first window
      // (FIRST_FEED_SEC above) so the ring holds audio after one second of
      // render, not after one whole chord-bar.
      const pieces = splitFeedWindows(r, stream.fedFrames === 0 ? FIRST_FEED_SEC : 0);
      const wLen = pieces.length === 1 ? r.barLenFrames
        : pieces.reduce((a, p) => a + p.barLenFrames, 0);   // exactly what the worker will write
      const localStart = stream.fedFrames;
      stream.fedFrames += wLen;
      stream.musicFrames = stream.fedFrames;   // real bars only — a tail never moves this
      stream.fedMusicalSec += r.musicalSec;
      // what a TAIL window would need to continue this stream past its last bar
      stream.tailRef = { units: r.units, spb: r.spb, hi: r.hi };
      const barRec = { len: wLen, meta: r.meta, found: r.found, foundSources: r.foundSources,
        spb: r.spb, lo: r.lo, units: r.units, events: r.events, genre: (r.one && r.one.genre) || null };
      if (stream.startGlobal != null) { barRec.globalStart = stream.startGlobal + localStart; playQueue.push(barRec); }
      else { barRec.localStart = localStart; stream.pendingBars.push(barRec); }
      // decode-ahead any found/sampler sources this bar needs (ready by playback)
      for (const f of (r.found || [])) kickBuffer((r.foundSources || []).find((s) => s.id === f.srcId));
      for (const e of (r.events || [])) { const u = r.units[e.unit]; if (u && u.sampler) for (const z of (u.sampler.zones || [])) kickSamplerBuf(z.srcId, r.foundSources); }
      // …AND ONE MORE instrument zone the STATE declares but no bar has asked for
      // yet — a trickle, exactly one per bar.
      //
      // The line above kicks a zone on the first bar that SOUNDS it, which leaves
      // only the runway to fetch and decode it: fine for the lead that enters in
      // bar 1, hopeless for an instrument that arrives mid-form. The transit form's
      // metal solo is the worst case in the catalogue — crunch_guitar is 8 zones /
      // ~4.7 MB that no bar touches until the "solo" section ~29 bars in, so it got
      // a ONE-BAR runway, and on a slow link its first bars measure
      // `melody[ins_crunch_guitar_*]`: the ⓘ paints the lane "✕ missing" and the
      // solo really is silent. toState pushes every zone of every declared sampler
      // into foundSources at vol 0 for exactly this kind of warming.
      //
      // ONE PER BAR, not all of them, and the number was measured rather than
      // guessed. Over the same throttled transitwave ride (~2 Mbps, solo at bar 29),
      // counting audit anomalies and the bar the crunch zones were first requested:
      //   no warm-ahead      1 anomaly   · first request bar 28 (one bar of runway)
      //   warm all, per bar  2 anomalies · bar 1  — the opening's own station-voice
      //                                   decode lost the race to 4.7 MB of guitar
      //   ONE per bar        1 anomaly   · bar 6  — all 8 queued by ~bar 13
      // The trickle is self-throttling: it can never queue more than one extra
      // decode against the bars about to play, it stays that gentle through the
      // burst after every genre flip too, and it still buys ~16 bars of head start.
      // (An `inFlight === 0` idle gate was tried first and almost never came up
      // true — it delayed the warm to bar 26 of 29, i.e. to no effect.)
      // SCOPE: the zones THIS SONG can voice, not every `ins_` row in
      // foundSources. The sampled-by-default pass injects the WHOLE candidate
      // library there so any pick is playable — measured, 629 zone rows / 123
      // instruments / ~105 MB on a single state — so trickling over foundSources
      // would slowly fetch the entire instrument library over a long ride. What
      // the song can actually voice is what buildSchedule resolves across all its
      // sections (the same enumeration the WAV-FIRST route decodes up front), and
      // that is a handful of instruments, including the ones a LATER section
      // brings on — which is the whole point, since the transit form's metal solo
      // is exactly such a late arrival. Memoised on the instruments object +
      // genre, so it is one buildSchedule per genuine instrument change.
      for (const id of warmSetFor(r)) if (kickSamplerBuf(id, r.foundSources)) break;
      for (const p of pieces) { if (stream.readyToFeed) postFeed(stream, p); else stream.preFeed.push(p); }
    }
    function flushPending(stream) {
      for (const pb of stream.pendingBars) { pb.globalStart = stream.startGlobal + pb.localStart; playQueue.push(pb); }
      stream.pendingBars = [];
    }

    // ── THE TAIL (docs/TIMING-AUDIT-2026-07 finding 2) ─────────────────────────
    // The outgoing stream is never fed again once a bridge opens, so its ring
    // ended at its last fed bar — and the fade anchors on a BAR BOUNDARY, which
    // when the play queue is empty (measured: most of the time by the moment the
    // bridge primes) IS that end. Without a tail the old ring is DRY for the
    // entire 400 ms ramp — measured 3437 underrun quanta over a 19-swap ride,
    // 100% of them inside a crossfade window, 16 of 19 landing on exactly
    // 138 quanta = one full ramp of nothing, with the runway reading 3.4–27 s and
    // loadRatio 1.00 the whole time: not behind, just nothing left to play from
    // the old stream.
    //
    // A tail window is a fed bar with NO EVENTS: the renderer's procs are
    // persistent, so it renders exactly the outgoing genre's own decay — reverb,
    // delay, releases — continuing past its last note. That is real audio under
    // the ramp (an equal-power fade needs BOTH sides to have content or it is
    // just a fade to silence), it costs no walk step, and it can't invent a
    // downbeat. Tails never enter the playQueue and never move musicFrames, so
    // the fade still anchors on the last real bar boundary.
    function feedTail(stream, sec) {
      const ref = stream.tailRef;
      if (!ref || !(sec > 0)) return 0;
      const beats = sec / ref.spb;
      const lo = ref.hi, hi = ref.hi + beats;
      const len = Math.max(BS, Math.round((hi - lo) * ref.spb * SR / BS) * BS);   // mirrors feedBar's rounding
      const piece = { units: ref.units, events: [], fxParams: null, spb: ref.spb,
        lo, hi, _base: stream.fedMusicalSec, _sweeps: [] };
      ref.hi = hi;
      stream.fedFrames += len;
      stream.tailFrames += len;
      stream.fedMusicalSec += (hi - lo) * ref.spb;
      if (stream.readyToFeed) postFeed(stream, piece); else stream.preFeed.push(piece);
      return len;
    }
    const TAIL_STEP_SEC = 0.5;             // one tail window
    // ramp + a full second of margin: the tail has to be RENDERED before it is
    // read, and the worker that would render it is competing with the bridge's
    // own priming burst (measured on a 4-core box under load: a bridge can take
    // longer to prime than the outgoing stream's whole 3 s runway, which is the
    // 2.2 s / 1.3 s outlier shape in the audit's per-swap table).
    const TAIL_KEEP_FRAMES = Math.round((XFADE_MS / 1000 + 1.1) * SR);
    // keep the OUTGOING stream wet: fed at least up to `endFrame` (default: a ramp
    // plus a margin ahead of the read cursor). Idempotent, cheap and self-limiting —
    // called from the pump it only ever holds the old ring ~0.75 s ahead of playback,
    // so a bridge that primes promptly renders at most one or two tail windows;
    // called from startFade with the ramp's end it GUARANTEES the coverage up front
    // rather than racing the 25 ms pump for it.
    // CAP: the tail's job is to carry the RAMP. Past a few seconds it is inaudible
    // decay — and rendering it costs the outgoing worker CPU that the BRIDGE needs
    // to prime, which on a loaded box turns into a feedback loop (a slow bridge
    // buys more tail, which slows the bridge). Measured at 3× oversubscription:
    // uncapped, a single bridge grew a 9 s tail.
    const TAIL_MAX_FRAMES = Math.round(3.0 * SR);
    function keepOutgoingWet(endFrame) {
      if (!cur || cur.startGlobal == null || !cur.tailRef) return;
      if (phase !== "bridging" && phase !== "fading") return;
      const need = endFrame != null ? endFrame : read53() + TAIL_KEEP_FRAMES;
      let guard = 0;
      while (cur.startGlobal + cur.fedFrames < need && cur.tailFrames < TAIL_MAX_FRAMES && guard++ < 24)
        feedTail(cur, TAIL_STEP_SEC);
    }

    let bridgeUnder = 0;   // C_UNDER_CNT when the current bridge opened (fade telemetry)
    function beginBridge(r) {
      phase = "bridging";
      bridgeUnder = Atomics.load(ctrl, C_UNDER_CNT);
      br = newStream(cur.ring ^ 1);
      br.sig = r.sig;
      openStream(br, r.one, BRIDGE_PRIME_SEC);
      feed(br, r);
    }
    function repointBridge(r) {   // coalesce a newer target mid-bridge (supersede via new gen)
      br.sig = r.sig; br.primed = false; br.readyToFeed = false;
      br.fedFrames = 0; br.musicFrames = 0; br.tailFrames = 0; br.tailRef = null;
      br.fedMusicalSec = 0; br.pendingBars = []; br.preFeed = [];
      openStream(br, r.one, BRIDGE_PRIME_SEC);
      feed(br, r);
    }
    function startFade() {
      phase = "fading";
      // BAR-ALIGNED CROSSFADE: anchoring the fade at read53() — an arbitrary
      // sample INSIDE the old bar — starts the incoming stream's bar 0 mid-bar
      // while already-scheduled NATIVE notes (drums/samplers/found ride the OLD
      // grid) ring across the new downbeat.
      // Anchor at the old grid's NEXT BAR BOUNDARY instead: the first bar in the
      // queue we can still disown; an empty queue means the old stream is inside
      // its last fed bar, whose END (startGlobal+musicFrames, a bar boundary) is
      // the anchor. The armed ramp holds at 0 until the cursor reaches the anchor
      // — the incoming ring is only consumed from the downbeat, so native lanes
      // and the new stream share one grid.
      const pg = read53();
      const musicEnd = (cur && cur.startGlobal != null) ? cur.startGlobal + cur.musicFrames : pg;
      // A bar whose native notes are ALREADY scheduled (drainDueBars' lookahead —
      // AudioBufferSourceNode.start is a commitment, there is no unschedule) can
      // not be disowned, so the anchor moves to the boundary after it. Without
      // this the pruned bar's drums would ring on top of the incoming bar 0.
      let idx = 0;
      while (idx < playQueue.length && playQueue[idx].nativeAt != null) idx++;
      const nextDown = idx < playQueue.length ? playQueue[idx].globalStart : musicEnd;
      fadeStartCursor = Math.max(pg, Math.min(nextDown, musicEnd));
      // prune NOW, not at commit: bars at/after the anchor belong to the incoming
      // stream — left queued, drainDueBars would fire their native notes on top
      // of the new stream's bar 0 during the ramp (double drums for a bar).
      for (let i = playQueue.length - 1; i >= 0; i--)
        if (playQueue[i].globalStart >= fadeStartCursor && playQueue[i].nativeAt == null) playQueue.splice(i, 1);
      // THE INCOMING GRID, ON TIME (docs/TIMING-AUDIT-2026-07 finding 2b). Doing
      // this in commitFade — AFTER the whole 400 ms ramp has run — publishes
      // the bridge's bar 0 onto an anchor already ~450 ms in the
      // past and drainDueBars fires it instantly: every native note of the
      // incoming genre's first half-second gets start(when-in-the-past) and
      // clumps at `now` instead of landing on its grid. MEASURED: 19 bars over
      // 300 ms late across 19 swaps, one per crossfade, every time. That is the
      // lurch. Publish the anchor HERE, before the ramp, so the bar is scheduled
      // ahead of its instant like any other.
      br.startGlobal = fadeStartCursor;
      flushPending(br);
      // guarantee the outgoing ring has audio across the WHOLE ramp (see feedTail)
      const rampFrames = Math.max(1, Math.round(XFADE_MS / 1000 * SR));
      keepOutgoingWet(fadeStartCursor + rampFrames + Math.round(0.5 * SR));
      // ARM the ramp: ring-player.js runs it off its own sample clock from this
      // exact output frame, so B's frame 0 and the native notes we just published
      // for that frame share one instant no matter what the main thread does.
      Atomics.store(ctrl, C_FADE_AT_LO, fadeStartCursor >>> 0);
      Atomics.store(ctrl, C_FADE_AT_HI, Math.floor(fadeStartCursor / 0x100000000));
      Atomics.store(ctrl, C_FADE_LEN, rampFrames);
      if (fadeLog.length > 256) fadeLog.shift();
      fadeLog.push({ t: now() / 1000, anchor: fadeStartCursor, pg, rampFrames,
        waitSec: +((fadeStartCursor - pg) / SR).toFixed(3),
        wetSec: +((cur.startGlobal + cur.fedFrames - fadeStartCursor) / SR).toFixed(3),
        tailSec: +(cur.tailFrames / SR).toFixed(3),
        // underOpen = the underrun counter when the BRIDGE opened, so a fade's cost
        // covers the whole seam (bridge priming + ramp), not just the ramp
        underOpen: bridgeUnder, under0: Atomics.load(ctrl, C_UNDER_CNT), under1: null });
      waitSwap();
    }
    // pollSwap: has the worklet finished the armed ramp and promoted the incoming
    // ring? Idempotent and safe from any clock — the worker tick drives it too, so
    // a hidden tab (page timers clamped to >=1s) still commits promptly instead of
    // sitting in `fading` with the pump held off.
    function pollSwap() {
      if (!swapTimer || phase !== "fading" || !br) return;
      if (Atomics.load(ctrl, C_ACTIVE) === br.ring && Atomics.load(ctrl, C_FADE_LEN) === 0) {
        clearInterval(swapTimer); swapTimer = 0; commitFade();
      }
    }
    function waitSwap() {
      if (swapTimer) clearInterval(swapTimer);
      swapTimer = setInterval(pollSwap, 3);
    }
    function commitFade() {
      // The anchor was published at startFade (bar 0 is already on the queue with
      // the right globalStart); the ramp has now completed in the worklet, so this
      // is purely the handover: adopt the bridge and retire the old producer.
      const old = cur;
      cur = br; br = null; phase = "idle";
      const f = fadeLog[fadeLog.length - 1];
      if (f && f.under1 == null) {
        f.under1 = Atomics.load(ctrl, C_UNDER_CNT);
        // what the outgoing ring actually held past the anchor, ramp included
        f.wetSec = +((old.startGlobal + old.fedFrames - f.anchor) / SR).toFixed(3);
        f.tailSec = +(old.tailFrames / SR).toFixed(3);
      }
      try { workers[old.wi].postMessage({ type: "stop" }); } catch (e) {}   // retire the old producer / free its ring
    }

    // ── THE PREFILL — DO NOT RELEASE THE FIRST FRAME INTO AN EMPTY RING ──────
    // MEASURED, 2026-08-24 (test/soak-nukernel.js --mins 3 --load 2 --poll 1, the
    // nukernel song box): the ring holds ONE chord bar when the reader is let go.
    // The trace is unambiguous — runway 3.14s at t=7 (the first chunk lands and
    // `primed` fires at PRIME_SEC=2.0), 0.01s at t=10, an 87 ms hole; 3.10s at
    // t=11, 0.06s at t=15, a 272 ms hole; and from t=19 on, never dry again for
    // the remaining 11 minutes. The producer's own number says why: `mean` is
    // 1.036 over the first bars — it renders a 3.1 s bar in 3.2 s — and falls to
    // 0.93 by the sixth. So for the first ~20 s the pipeline is SERIAL and
    // slightly BEHIND: chunk N+1 takes marginally longer to render than chunk N
    // takes to play, the ring can never get more than one bar ahead of the ear,
    // and every bar's residue is a hole. No amount of runway TARGET helps,
    // because the target is a thing the ring is filled TOWARD and the ring is
    // being emptied as fast as it fills.
    //
    // THE ONLY MOMENT THE RING CAN GAIN IS WHILE NOBODY IS LISTENING. So the
    // conductor holds the reader at C_STATE=0 (silence, cursor frozen, no
    // underrun counted — ring-player.js) until the ring holds `opts.prefillSec`
    // of RENDERED audio. Nothing is added to the audio path and nothing races:
    // the pump and the producer are already running flat out; this only declines
    // to start spending. It buys twice — the depth itself, and the fact that the
    // bars rendered during the wait are the ones that take the producer from
    // 1.04x to 0.93x, so the reader starts against a warm producer as well as a
    // full ring.
    //
    // WHAT IT COSTS, PLAINLY, BECAUSE PAUL WILL FEEL IT: the page is SILENT
    // LONGER BEFORE THE FIRST NOTE. A/B on one box, `--load 2`, a minute each,
    // prefillSec 0 then 8: first heard sample at 7.50 s with one 853 ms dropout,
    // versus 9.78 s with none. **2.3 seconds more silence, and no hole.** The
    // wait itself measured 3.48 s — less than the 8 s of audio it produces,
    // because the producer is not sharing the box with the ear yet. The soak
    // gate prints "first note at …s" beside the episode count so the trade is
    // re-judged from numbers rather than argued from memory.
    //
    // A PREFILL MUST NEVER BECOME A SILENCE. Two bounds, both hard: the ask is
    // clamped to what the pump will ever feed (targetFrames()) and to what the
    // worker will ever hold (WORKER_RUNWAY) — asking for more than either is
    // asking for a wait that cannot end — and PREFILL_MAX_MS caps the wait
    // itself, after which the reader starts on whatever is there. A box too slow
    // to fill the ring gets the old behaviour, holes and all; it does not get
    // dead air. `capped` says which happened, and __prefill() reports it.
    const PREFILL_MAX_MS = 12000;
    const prefillAsk = Math.max(0, +(opts && opts.prefillSec) || 0);
    let prefillTimer = 0, prefillT0 = 0, prefillWant = 0, prefillGot = 0,
        prefillMs = 0, prefillCapped = false, prefillSaid = -1;
    // frames of rendered audio to hold before release; 0 = start on `primed`,
    // which is what every caller that does not ask for a prefill still gets.
    function prefillFrames() {
      if (!prefillAsk) return 0;
      return Math.min(prefillAsk, WORKER_RUNWAY) * SR;
    }
    // ── THE HOLD (PHASE 0 — IDLE PRE-RENDER, 2026-08-27). opts.hold keeps the
    // reader frozen (C_STATE stays 0) even after the prefill is satisfied: the
    // pump and producer fill the ring to the prefill depth at page idle, then
    // everything waits for handle.release() — which is what a play GESTURE calls,
    // so the gesture spends nothing but ctx.resume() and the reader release.
    // This is not a rolling tape: the pump's own backpressure (targetFrames())
    // stops the render once the ring is full, and a stopped hold burns only the
    // worker's idle polls. A caller that never says hold gets startRun exactly
    // as before.
    let held = !!(opts && opts.hold), holdReady = false;
    function maybeStart() {
      if (held) { holdReady = true; status("ready (held)"); return; }
      startRun();
    }
    function armRun() {
      if (abort || running || !cur) return;
      // ONE chain, ever: this re-enters from its own timer, and a second entry
      // (a re-`primed`, a resumed poll) would otherwise leave an orphan running
      // that releases the reader a second time.
      if (prefillTimer) { clearTimeout(prefillTimer); prefillTimer = 0; }
      const want = prefillFrames();
      if (!want) return maybeStart();
      if (!prefillT0) { prefillT0 = now(); prefillWant = want / SR; }
      // the pump's own feed ceiling is the other wall: the worker cannot render
      // audio the conductor never handed it (feedRunwayFrames() < targetFrames()
      // is the pump's gate), so a prefill deeper than that would wait forever.
      const cap = Math.min(want, targetFrames());
      const have = ringWritten(cur);
      const waited = now() - prefillT0;
      if (have >= cap || waited >= PREFILL_MAX_MS) {
        prefillCapped = have < cap;
        prefillGot = have / SR; prefillMs = waited;
        prefillTimer = 0;
        return maybeStart();
      }
      const whole = Math.floor(have / SR);
      if (whole !== prefillSaid) {   // a thirteen-second silence with no words is a bug report
        prefillSaid = whole;
        status("filling the buffer… " + whole + "/" + Math.round(cap / SR) + "s");
      }
      prefillTimer = setTimeout(armRun, 50);
    }

    function startRun() {
      running = true;
      cur.startGlobal = 0;
      flushPending(cur);
      Atomics.store(ctrl, C_ACTIVE, cur.ring);
      Atomics.store(ctrl, C_XFADE, 0);
      Atomics.store(ctrl, C_FADE_LEN, 0);   // no fade armed
      Atomics.store(ctrl, C_STATE, 1);   // RUN
      status(ctx.state === "running" ? "live (faust) — drag the space" : "live (tap again if silent)");
      startBarScheduler();
      startLoadReporter();
      ensureWorker(1);   // pre-init the idle worker so the first crossfade is snappy
      // ── A SILENT DETECTOR IS WORSE THAN NONE. clickMon() calls itself "the
      // acceptance-gate detector", and `rms` is a bargraph of the signal the DSP
      // itself sees — so a flat zero two seconds into a run means the READBACK is
      // dead, not that the music is quiet, and every gate that then trusts
      // `clicks: 0` is reading a wire that is not connected. Nothing else in the
      // engine would say so: the node built, so no "clickmon:" string was ever
      // pushed here, and the detector failed by agreeing with everything.
      //
      // WHAT MADE THIS URGENT, AND WHAT IT TURNED OUT TO BE: a 2026-08-24 probe
      // read rms 0 through two soaks including a 583 ms hole and the detector was
      // written off as blind. Re-measured the same day on an UNINSTRUMENTED page
      // (test/soak-nukernel.js, 18 samples), it reads 0.08-0.27 and clicks 0 — the
      // detector is alive, and the zero was the probe's own AudioWorkletNode
      // wrapper, which is the class faustwasm's generated node extends. So this
      // stays as the ALARM rather than as a diagnosis: two seconds is long enough
      // for the first out-param post to have arrived, and cheap enough to leave on
      // for the day the readback really does die. ──
      setTimeout(() => {
        if (abort) return;
        if (clickMonState && clickMonState.latest.rms === 0) errors.push("clickmon: no readback");
      }, 2000);
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
      if (m.type === "initfail") {
        // settle the pending ensureWorker with the failure flag set (never a
        // silent forever-hang at 'loading engine…' — boot/openStream check it).
        errors.push("worker" + wi + " initfail: " + m.error);
        if (!workerFailed[wi]) workerFailed[wi] = "worker" + wi + " initfail: " + m.error;
        if (readyResolve[wi]) readyResolve[wi]();
        return;
      }
      // worker metronome (stream-worker posts ~4Hz per live open): dedicated-worker
      // timers are NOT throttled in hidden tabs, so this keeps the feed pump and the
      // bar scheduler alive when the page's own timers clamp to >=1s (tab in the
      // background but the ctx still running — the desktop keep-playing path).
      if (m.type === "tick") { pollSwap(); pumpOnce(); drainDueBars(); return; }
      const stream = (cur && cur.gen === m.gen) ? cur : (br && br.gen === m.gen) ? br : null;
      if (!stream) return;   // superseded open — ignore
      // AUDIT-TRUTH: the producer's per-bar voice measurement, parked by serial until
      // that bar is HEARD (fireBar). A superseded gen never reaches this line, so a
      // discarded bridge's measurements can never be attributed to what plays.
      if (m.type === "baraudit") { takeAudit(m.serial, m.voices); return; }
      if (m.type === "primed") {
        if (stream === cur && !running) armRun();   // THE PREFILL holds this back; with no prefillSec it IS startRun()
        else if (stream === br && phase === "bridging" && !br.primed) { br.primed = true; startFade(); }
        return;
      }
      if (m.type === "openfail") {
        errors.push("openfail gen" + m.gen + ": " + m.error);
        // never a silent forever-"priming…": a dead current stream is an honest error
        // (the pre-split symptom: a >30s chord-bar overflowed the ring and the app
        // just spun — atlantidrone/chalkvespers, docs/history/NEXT.md §5).
        if (stream === cur && !running) status("engine error: " + m.error);
        return;
      }
      // PRODUCER LOAD — the worker's own measurement of how long a chord bar takes
      // to render against how long it plays. Kept as it arrives (~2 Hz) so
      // __producer() is never stale by more than a bar.
      if (m.type === "status" && m.load) { prodLoad = m.load; return; }
      // openedLive / status / eos / stopped: informational
    }

    // ONE authoritative section/ci/serial walk, shared with the WAV-FIRST path (makeWalk).
    const stepWalk = makeWalk(getState, E, SE, (opts && opts.startBar) | 0, opts);   // drop-in at the bookmarked measure; `opts` carries the foreign-composer seam (opts.events)

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
    // NOTE (the phantom runway): this is the FEED ledger — frames
    // POSTED to the producer worker, not frames the producer has actually RENDERED into
    // the ring. It is the right quantity to gate the pump on (don't over-produce), and
    // the WRONG quantity to report as health: it reads full straight through producer
    // starvation, which is why loadRatio sat at 1.00 through a measured 299 ms dropout.
    // The honest sensor is ringRunwayFrames() below.
    function feedRunwayFrames() {
      if (phase === "bridging" && br) return br.fedFrames;   // bridge not active yet (played 0)
      // BAR-ALIGNED fades wait for the anchor downbeat (up to a bar): the audible
      // runway is the OLD stream's remaining audio up to the anchor PLUS the
      // bridge's fed frames (it owns playback from the anchor on). Reporting only
      // the draining old stream here read as a phantom starve on the load meter
      // (and would over-drive the pump) while nothing was at risk.
      if (phase === "fading" && br && br.startGlobal != null)
        return Math.max(0, br.startGlobal + br.fedFrames - read53());
      if (!cur) return 0;
      const played = cur.startGlobal != null ? Math.max(0, read53() - cur.startGlobal) : 0;
      return cur.fedFrames - played;
    }
    // ── THE HONEST RUNWAY (docs/ENGINE-AUDIT-2026-07 / TIMING-AUDIT "the phantom
    // runway"). Frames of audio that ACTUALLY EXIST in the ring ahead of the read
    // cursor, along the real playback path — R_WRITE is published by the producer
    // only AFTER the samples are in the SAB (stream-worker.js), so this is exactly
    // what the worklet can still read. A bar can sit fed-but-unrendered for its
    // whole render time, so this is normally SMALLER than the feed ledger; that gap
    // IS the producer's backlog, and it is the thing that goes to zero in a dropout.
    const ringWritten = (stream) => Atomics.load(ctrl, C_RING0 + stream.ring * RING_STRIDE + R_WRITE);
    function ringRunwayFrames() {
      if (!cur) return 0;
      const pg = read53();
      // ring frame f of a stream sounds at global frame startGlobal + f
      const aheadA = cur.startGlobal != null ? cur.startGlobal + ringWritten(cur) - pg : ringWritten(cur);
      if (phase === "fading" && br && br.startGlobal != null) {
        const toAnchor = br.startGlobal - pg;
        // before the anchor the OUTGOING ring carries the ramp: a hole there is a hole
        // (this is the dry-ramp failure the tail exists to prevent — it must READ as one)
        if (toAnchor > 0 && aheadA < toAnchor) return Math.max(0, aheadA);
        return Math.max(0, br.startGlobal + ringWritten(br) - pg);
      }
      // bridging: the old ring is still the audible one and the bridge's primed frames
      // will follow it at a bar boundary we haven't picked yet, so the ready audio is
      // the union — but only while the audible ring still HAS something (aheadA<=0 now
      // means the listener is hearing silence no matter how well the bridge is doing).
      if (phase === "bridging" && br) return aheadA <= 0 ? 0 : aheadA + ringWritten(br);
      return Math.max(0, aheadA);
    }
    let pumpTimer = 0;
    // deeper feed target while hidden (background timer throttling; see HIDDEN_TARGET_SEC)
    // deep-runway ALSO while a heavy-GL view is up — FaustLive.deepRunway is the
    // app's hint (set by app/starcruise.js across the cruise + its teardown-GC
    // window) that main-thread stalls / worker CPU contention are expected:
    // survival over steering latency, the same trade as the hidden-tab case.
    // (The post-planet static fix: entry shader compile + dispose-GC stalls
    // breach the 3s runway and the ring zero-fills = audible static.)
    // ...AND DEEPER ONCE THE RING HAS ACTUALLY RUN DRY. The two cases above are
    // PREDICTIONS that stalls are coming (a hidden tab, a GL view). This one is
    // the machine having already said so: a session whose ring has emptied even
    // once is a session on a box that stalls longer than three seconds, and the
    // producer's own timing says why — measured over twelve minutes, its cost is
    // 0.5-0.6 render-seconds per audio second on average and spikes to 2.1-2.5x
    // on a single bar, so one bad bar can outlast a three-second runway. The
    // trade is a bar of extra steering latency for a listener who has ALREADY
    // heard a hole; a session that never starves never pays it and is
    // byte-identical. Sticky on purpose: the box does not get quieter.
    const targetFrames = () => ((typeof document !== "undefined" && document.visibilityState === "hidden")
      || (root.FaustLive && root.FaustLive.deepRunway)
      || Atomics.load(ctrl, C_UNDER_EPI) > 0) ? HIDDEN_TARGET_FRAMES : TARGET_FRAMES;
    // ── THE STARVATION, ON DEMAND (test hook; test/browser/ring-starve.test.js).
    // The failure this engine has to survive is "the producer went away for a few
    // seconds", and the only honest way to gate the behaviour at the seam is to
    // MAKE it happen rather than wait for a busy machine to provide one. Holding
    // the feed pump for `sec` drains the ring exactly the way a stalled worker
    // does — same code path, same counters, same reader. Nothing calls it but a
    // gate, and it cannot fire by itself: the deadline starts in the past.
    let starveUntil = 0;
    // pumpOnce: one idempotent top-up, safe to call from ANY clock (the page timer,
    // the worker tick, goVisible) — never (re)schedules, so no timer chains accumulate.
    function pumpOnce() {
      if (abort) return;
      if (now() < starveUntil) return;
      try {
        keepOutgoingWet();   // the outgoing ring must not run dry under the ramp
        let guard = 0;
        while (!abort && phase !== "fading" && guard < 24 && feedRunwayFrames() < targetFrames()) { produceAndRoute(); guard++; }
      } catch (e) { errors.push("pump: " + (e && e.message || e)); console.error("FaustLive pump", e); }
    }
    function pump() {
      if (abort) return;
      pumpOnce();
      pumpTimer = setTimeout(pump, 25);
    }

    // ── AUDIT-TRUTH ring (ring route) ─────────────────────────────────────────
    // "Expected but silent": a voice the bar has notes for that produced no sound.
    // The ⓘ timeline paints such a lane red, so the measurement has to exist on THIS
    // route too — a paint that can only fire on the mobile route is a readout lying
    // about what it checked. Both halves ride structures that already run once per
    // chord-bar; nothing is added to the audio path (the ring-player worklet) or to
    // any render callback:
    //   • FAUST voices are measured inside the producer's renderChunk (each unit's
    //     dry-send energy → RMS, against the notes fed into that window) and posted
    //     back as {type:"baraudit"} keyed by serial — see stream-worker runLivePump.
    //   • SAMPLED + FOUND voices are not in the stream on this route (the live graph
    //     plays them natively), so the producer cannot see them; they are audited in
    //     scheduleNative, which already walks every note — it counts the notes dropped
    //     because their buffer had not decoded yet, which is exactly the failure the
    //     lane paint exists for (the decode race). rms is null there: the native lane
    //     measures whether a note reached the audio thread, not its amplitude.
    // Both are folded together and recorded at fireBar — the instant the bar is
    // HEARD — mirroring the WAV route's ring, and a bar with NO measurement records
    // nothing at all (no entry ⇒ no paint ⇒ no claim).
    const AUDIT_CAP = 200, AUDIT_PENDING_CAP = 256;
    const auditRing = [];
    const auditBySerial = new Map();     // serial -> ring entry (the ⓘ timeline's lookup)
    const auditPending = new Map();      // serial -> merged producer table, awaiting playback
    let auditAnomTotal = 0;
    // a voice key's ⓘ lane role — mirrors app/panels/inside.js noteRole (and the renderer's
    // auditRole) so the native half and the producer half land in the same lanes.
    // isDrum is the mapped event's own flag: the sampled kits' clap/rim/ride/crash/
    // perc units carry no `role`, so nothing else identifies them as kit pieces.
    function natRole(key, u, isDrum) {
      if (isDrum || key === "kick" || key === "snare" || key === "hat" || key === "tom") return "drums";
      if (key.indexOf("solo:") === 0) return "solo";
      if (u && u.role && u.role !== "drums") return u.role;
      if (key === "melody" || key === "pad" || key === "bass") return key;
      if (key === "stab" || key === "sfx") return "sfx";
      return (u && u.role) || key;
    }
    // merge one sub-window's table into the bar's accumulator. A bar split by
    // splitFeedWindows is rendered as several chunks: a voice is silent FOR THE BAR
    // only if every window that expected notes measured silent (nan poisons the bar
    // outright — a blown-up filter is not fixed by a later clean window).
    function takeAudit(serial, voices) {
      if (serial == null || !voices) return;
      let acc = auditPending.get(serial);
      if (!acc) {
        acc = {};
        auditPending.set(serial, acc);
        while (auditPending.size > AUDIT_PENDING_CAP) auditPending.delete(auditPending.keys().next().value);
      }
      for (const key of Object.keys(voices)) {
        const v = voices[key];
        let p = acc[key];
        if (!p) p = acc[key] = { role: v.role, notes: 0, rms: null, missing: [], nWin: 0, sWin: 0, nan: false };
        p.notes += v.notes || 0;
        if (v.rms != null && (p.rms == null || v.rms > p.rms)) p.rms = v.rms;
        for (const m of (v.missing || [])) if (p.missing.indexOf(m) < 0) p.missing.push(m);
        if (v.reason === "nan") p.nan = true;
        if (v.notes > 0) { p.nWin++; if (v.silent) { p.sWin++; if (!p.reason) p.reason = v.reason; } }
      }
    }
    function recordAudit(b) {
      const serial = b.meta.serial;
      const pend = auditPending.get(serial);
      if (pend) auditPending.delete(serial);
      const nat = b.nativeAudit || null;
      if (!pend && !nat) return;   // measured nothing this bar — claim nothing
      const voices = {};
      if (pend) for (const key of Object.keys(pend)) {
        const p = pend[key];
        const silent = p.nan || (p.nWin > 0 && p.sWin === p.nWin);
        voices[key] = { role: p.role, notes: p.notes, rms: p.rms, missing: p.missing,
          silent, reason: silent ? (p.nan ? "nan" : p.reason || "present-but-silent") : null, lane: "stream" };
      }
      if (nat) for (const key of Object.keys(nat)) {
        const n = nat[key];
        const silent = n.notes > 0 && n.played === 0;
        voices[key] = { role: n.role, notes: n.notes, played: n.played, rms: null, missing: n.missing,
          silent, reason: silent ? (n.missing.length ? "missing" : "present-but-silent") : null, lane: "native" };
      }
      const anomalies = [];
      for (const key of Object.keys(voices)) {
        const v = voices[key];
        if (v.silent) anomalies.push({ key, role: v.role, notes: v.notes, rms: v.rms, reason: v.reason, missing: v.missing });
      }
      auditAnomTotal += anomalies.length;
      // LANE ROLLUP for the ⓘ paint. The timeline draws one row per ROLE, and several
      // voices share a role (a kit is kick+snare+hat+clap+…). A lane may only be
      // painted silent when EVERY voice in it that expected notes measured silent —
      // a dead kick under a live hat is a real anomaly (it is in `voices` and in the
      // summary) but painting the whole drum row red while the hats play is a lie.
      const laneExp = {}, laneSil = {}, laneWhy = {};
      for (const key of Object.keys(voices)) {
        const v = voices[key];
        if (!(v.notes > 0)) continue;
        laneExp[v.role] = (laneExp[v.role] || 0) + 1;
        if (v.silent) {
          laneSil[v.role] = (laneSil[v.role] || 0) + 1;
          if (!laneWhy[v.role]) laneWhy[v.role] = { reason: v.reason, missing: (v.missing || []).slice() };
        }
      }
      const silentRoles = {};
      for (const role of Object.keys(laneExp)) if (laneSil[role] === laneExp[role]) silentRoles[role] = laneWhy[role];
      const entry = { serial, section: b.meta.section || null, ci: b.meta.ci,
        t: +ctx.currentTime.toFixed(3), route: "ring", gen: (cur && cur.gen) || null,
        runwaySec: +(Math.max(0, ringRunwayFrames()) / SR).toFixed(2),
        underruns: Atomics.load(ctrl, C_UNDER_CNT),
        covered: (pend ? "stream" : "") + (pend && nat ? "+" : "") + (nat ? "native" : ""),
        anomalies, silentRoles, voices };
      auditRing.push(entry);
      auditBySerial.set(serial, entry);
      while (auditRing.length > AUDIT_CAP) {
        const old = auditRing.shift();
        if (old && auditBySerial.get(old.serial) === old) auditBySerial.delete(old.serial);
      }
    }
    // compact one-line summary (same shape the WAV route logs, so the ?wavDebug
    // clipboard line reads identically on either route).
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
      return "AUDIT: " + auditAnomTotal + " anomalies over " + anomBars + "/" + total + " bars" +
        (parts.length ? "; " + parts.join("; ") : "");
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
    // UI callback leads.
    //
    // VISIBLE LOOKAHEAD (docs/TIMING-AUDIT-2026-07 finding 3). With a horizon of
    // ZERO on the visible path a bar is only DISCOVERED when the
    // 30 ms poll next runs, and 92.6% of all note events (every sampled voice, every
    // found sound — 254 of 274 genres have a fully sampled kit) are scheduled from
    // here on the main thread. MEASURED anchor lateness `ctx.currentTime - when`:
    // bare engine page p50 17 ms; the real app, whose 7.7% main-thread occupancy
    // the drum scheduler shares, p50 41 ms / p90 80 ms — re-randomised every bar.
    // 5–7% of start() calls landed in the PAST (the downbeat cluster): visible
    // drains are NOT exact, and the HIDDEN path is strictly the more accurate one.
    //
    // So the NATIVE lane now gets a real lookahead while visible too. `when` is
    // absolute and start(future) is sample-accurate, so scheduling a bar early
    // makes it land EXACTLY on the ring's grid — nothing sounds early, it sounds
    // on time. onBar keeps a horizon of 0 while visible: the chyron playhead, the
    // ⓘ timeline and the background cart rotator must not lead the audio.
    const BAR_LOOKAHEAD_FRAMES = Math.round(0.6 * SR);
    const NATIVE_LOOKAHEAD_FRAMES = Math.round(0.25 * SR);
    const barAnchors = [];   // native-lane anchor telemetry (see __barAnchors)
    function drainDueBars() {
      if (abort) return;
      const pg = read53();
      const hidden = (typeof document !== "undefined" && document.visibilityState === "hidden");
      // (1) hand the NATIVE lane its bars early, anchored on absolute ctx time
      const look = pg + (hidden ? BAR_LOOKAHEAD_FRAMES : NATIVE_LOOKAHEAD_FRAMES);
      for (let i = 0; i < playQueue.length; i++) {
        const b = playQueue[i];
        if (b.globalStart > look) break;
        if (b.nativeAt == null) armNative(b, pg);
      }
      // (2) then fire the bar itself (onBar / UI) at its own instant
      const horizon = pg + (hidden ? BAR_LOOKAHEAD_FRAMES : 0);
      while (playQueue.length && playQueue[0].globalStart <= horizon) fireBar(playQueue.shift(), pg);
    }
    function startBarScheduler() {
      if (barTimer) return;
      barTimer = setInterval(drainDueBars, 30);
    }
    // armNative: schedule one bar's native (sampler/found) notes onto the absolute
    // ctx clock. Idempotent per bar via b.nativeAt — a bar armed by the lookahead
    // is never re-armed by fireBar, and a bar already armed can no longer be pruned
    // by startFade (there is no unschedule for an AudioBufferSourceNode).
    function armNative(b, pg) {
      const when = ctx.currentTime + (b.globalStart - pg) / SR;
      b.nativeAt = when;
      if (barAnchors.length > 512) barAnchors.shift();
      barAnchors.push({ serial: b.meta.serial, lateMs: +((ctx.currentTime - when) * 1000).toFixed(2) });
      try { scheduleNative(b, when); } catch (e) { errors.push("found@" + b.meta.serial + ": " + (e && e.message || e)); }
    }
    function fireBar(b, pg) {
      if (b.nativeAt == null) armNative(b, pg);
      const when = b.nativeAt;   // the instant the native lane was anchored on
      lastPlayedLayers = new Set([...Object.keys(b.units)].map(LAYER_OF_UNIT));
      recordAudit(b);            // AUDIT-TRUTH: this bar is being heard now — file what was measured
      if (opts.onBar) try {
        opts.onBar({ serial: b.meta.serial, ci: b.meta.ci, nch: b.meta.nch, when: when,
          spb: b.meta.spb, cbeats: b.meta.cbeats, chord: b.meta.chord,
          section: b.meta.section, secIdx: b.meta.secIdx, nsec: b.meta.nsec, sec: b.meta.sec });
      } catch (e) {}
    }
    // native found (bed/chop/vox) + sampler at playback — the same fabric the old
    // injectChord scheduled, on the ctx clock via at(beat).
    function scheduleNative(b, when) {
      // GENRE MOVED ON: fade the departing genre's live vocal/chop found voices
      // so a long narration/vox LOOP (e.g. termswave's terms&conditions read)
      // doesn't keep blaring at full volume after the mix has left it.
      // Live-only — the baked press mix is a separate path, so the
      // byte-identity gates are untouched. Beds keep their own durSec envelope
      // for ambient continuity; only the loud one-shot/vocal lanes fade here.
      if (b.genre && b.genre !== lastFoundGenre) {
        if (lastFoundGenre != null) { try { foundVox.fadeAll(2.0); foundChops.fadeAll(2.0); } catch (e) {} }
        lastFoundGenre = b.genre;
      }
      const spb = b.spb, lo = b.lo;
      const at = (beat) => when + (beat - lo) * spb;
      const beatAbs = (beat) => b.meta.absBeatLo + (beat - lo);
      // AUDIT-TRUTH (native half): expected vs actually-scheduled, per lane. Every
      // `continue` below is a note that will not be heard; counting them here is the
      // only place on this route the sampler/found layers can be audited at all.
      const nat = b.nativeAudit || (b.nativeAudit = {});
      const natOf = (key, role) => nat[key] || (nat[key] = { role, notes: 0, played: 0, missing: [] });
      const natMiss = (na, id) => { if (id && na.missing.indexOf(id) < 0) na.missing.push(id); };
      // sampler notes (native BufferSource, like found)
      if (SP) for (const e of (b.events || [])) {
        const u = b.units[e.unit]; if (!u || !u.sampler) continue;
        const na = natOf(e.unit, natRole(e.unit, u, !!e.drum));
        na.notes++;
        const ent = samplerOf(e.unit, u, spb);
        const midi = SP.midiOfFreq(e.sets.freq);
        // VELOCITY LAYER: the same SP.selVel(e.amp) press feeds mixPCM. Anything
        // else here (e.g. round(e.sets.gain*127), a mix gain and a different
        // formula from press's) lets the two engines pick different velocity
        // layers for the same note (ENGINE-AUDIT Tier 2).
        const z = SP.zoneFor(u.sampler.zones, midi, SP.selVelOf(e));
        const buf = z && samplerBufs[z.srcId];
        if (!ent || !buf) { natMiss(na, z ? z.srcId : null); continue; }
        na.played++;
        // chained unit (declared inserts): notes enter the chain PRE-SEND —
        // dry 1 / sends 0 here; the unit-level gains tap the chain output.
        const chained = !!ent.chain;
        const zsr = u.sampler.sr || 44100;
        // MP3 DECODER LEAD-IN (sampler.js zoneLeadIn): WebKit hands back the
        // encoder's priming samples, so the buffer's head is 25 ms of padding
        // and every index baked from the source wav is early by that much.
        // Cached per decoded buffer (not per note); 0 on every other decoder,
        // and 0 for a zone without a known length. Seconds are BUFFER seconds
        // (decodeAudioData resampled to the ctx rate) while the loop points are
        // zone seconds — both ends shift together so the loop keeps its length.
        const lead = SP.zoneLeadIn ? SP.zoneLeadIn(buf, z, buf.sampleRate, zsr) : 0;   // guard: a stale sw-cached sampler.js
        const leadSec = lead ? lead / (buf.sampleRate || zsr) : 0;
        // LOOP-POINT OVERRIDES (loopa/loopb/loopon stamped on the zone by
        // state-engine samplerUnit): resolved by the ONE resolver both paths
        // share (sampler.js resolveLoop — zero-cross snapped, so a moved point
        // does not reintroduce the lead-in click documented there). A zone
        // without the keys keeps the exact old arithmetic; SP.resolveLoop is
        // guarded like zoneLeadIn above against a stale sw-cached sampler.js.
        let loopF = { loop: !!z.loop, a: (z.loopStart || 0) / zsr + leadSec, b: (z.loopEnd || 0) / zsr + leadSec };
        if (SP.hasLoopOv && SP.hasLoopOv(z) && SP.resolveLoop) {
          const bufSr = buf.sampleRate || zsr;
          const L = SP.resolveLoop(z, buf.getChannelData(0), bufSr / zsr, lead);
          loopF = { loop: L.loop, a: L.loopStart / bufSr, b: L.loopEnd / bufSr };
        }
        ent.player.note(buf, at(e.beat), { rate: SP.rateFor(z, midi), durSec: e.durB * spb,
          gain: (u.lvl != null ? u.lvl : 0.5) * (e.sets.gain != null ? e.sets.gain : 0.13),
          atk: u.sampler.atk, rel: u.sampler.rel, swell: !!u.sampler.swell, mello: u.sampler.mello || null,
          strip: u.sampler.strip || null,   // per-voice band EQ/comp/saturation/air (SamplerLive builds the node twin)
          songT: beatAbs(e.beat) * spb,
          dry: chained ? 1 : (u.dry != null ? u.dry : 1),
          rsend: chained ? 0 : (u.rev || 0), dsend: chained ? 0 : (u.del || 0),
          bendFrom: e.bend ? e.bend.from : 0, bendMs: e.bend ? e.bend.ms : 0,
          offsetSec: leadSec,
          loop: loopF.loop, loopStartSec: loopF.a, loopEndSec: loopF.b });
      }
      // found chops + beds (bed re-anchored at bar start of chord 0)
      // AUDIT lane for a found event — mirrors the ⓘ timeline's own split (a spoken/
      // vocal CHOP is the "voices" lane, everything else the "found" lane).
      const kindOf = {};
      if (b.found && b.found.length) for (const s of (b.foundSources || [])) if (s && s.id) kindOf[s.id] = s.kind || "";
      const foundRole = (f) => {
        const k = kindOf[f.srcId] || "";
        return (f.type === "chop" && (k === "speech" || k === "vox")) ? "voices" : "found";
      };
      for (const f of (b.found || [])) {
        const buf = bufCache[f.srcId];
        // A chop is expected on every bar it fires; a BED only on the bar it is
        // (re-)anchored (ci 0) — on the bars it sustains through it is already
        // ringing, so it is neither expected nor missing there.
        const fr = foundRole(f);
        const na = (f.type === "chop" || b.meta.ci === 0) ? natOf(fr, fr) : null;
        if (na) na.notes++;
        if (!buf) { if (na) natMiss(na, f.srcId); continue; }
        if (na) na.played++;
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
    // HEALTH IS MEASURED ON THE RING, NOT ON THE FEED LEDGER (the phantom
    // runway). feedRunwayFrames()/TARGET_SEC — frames posted to the worker —
    // reads 1.00 while the producer starves and the ring runs dry, so loadRatio
    // reads the RENDERED runway against RING_FLOOR_SEC, the depth
    // below which a single long task (measured: up to 585 ms on a bare page, 623 ms in
    // the app) can empty the ring: 1.00 = at least a floor of real audio is in the SAB,
    // 0.00 = the ring is dry NOW. The feed ledger is still what the pump is gated on,
    // and is still reported separately by handle.__runway().
    let loadTimer = 0, loadRatio = 1;
    function startLoadReporter() {
      if (loadTimer) return;
      loadTimer = setInterval(() => {
        if (abort) return;
        const runSec = Math.max(0, ringRunwayFrames()) / SR;
        loadRatio = Math.min(1, runSec / RING_FLOOR_SEC);
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
    let disarmGesture = null;   // set while the touch/pointer revive listeners are on `document`
    const armGestureResume = () => {
      if (gestureArmed || typeof document === "undefined") return;
      gestureArmed = true;
      const revive = () => {
        gestureArmed = false;
        disarmGesture = null;
        document.removeEventListener("touchend", revive, true);
        document.removeEventListener("pointerdown", revive, true);
        if (abort) return;
        resumeCtx();
        if (mediaEl && msDest) { try { mediaEl.srcObject = msDest.stream; mediaEl.muted = false; const pr = mediaEl.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {} }
      };
      document.addEventListener("touchend", revive, true);
      document.addEventListener("pointerdown", revive, true);
      // ARMED IS A THING THAT CAN BE DISARMED. `revive` closes over this whole
      // scope, and a stop while it is still armed leaves two document listeners
      // holding the retired engine — the same shape as the click monitor below.
      disarmGesture = () => {
        gestureArmed = false; disarmGesture = null;
        document.removeEventListener("touchend", revive, true);
        document.removeEventListener("pointerdown", revive, true);
      };
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
      resumeCtx();   // unconditional — covers iOS/Safari "interrupted" AND "suspended" (gating on "suspended" alone never resumes after an app switch); no-op while running
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
    // ── visibility routing: THE DESKTOP TAB-SWITCH FIX (a tab switch stopped the
    // audio in desktop Safari). Running goHidden on EVERY hide mutes the live
    // worklet at source; desktop then depends on the bg-WAV <audio>
    // handoff (Safari) or just goes silent (Chrome et al). But every modern desktop
    // engine — including Safari >= 15.4 (webkit.org/b/231105) — keeps a RUNNING
    // AudioContext alive in a hidden tab. So on desktop we KEEP PLAYING: no mute,
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
    // wire transport. The APP owns the identity (app/audio/live.js updateMediaSession) and
    // hands it here through opts.mediaMeta — see setMediaMeta above; with no callback
    // this never overwrites what the host already set. The play/pause action handlers
    // are registered ONLY when explicitly asked (opts.mediaSession) for standalone
    // hosts, since the app registers its own. Guarded. ──
    const MS = (typeof navigator !== "undefined" && navigator.mediaSession) ? navigator.mediaSession : null;
    function bgSetPlaybackState(s) { if (MS) try { MS.playbackState = s; } catch (e) {} }
    let msSig = "", msLastMeta = null;
    function bgSetMetadata() { msSig = setMediaMeta(MS, root, opts, msSig, (m) => { msLastMeta = m; }); }
    if (MS) {
      bgSetMetadata(); bgSetPlaybackState("playing");
      if (opts.mediaSession) {
        try {
          // play cannot be goVisible() alone: its `!survivalMuted && !bgActive`
          // guard returns before restoring, and the pause below mutes at source
          // WITHOUT setting survivalMuted, so a foreground pause would be
          // permanent. play gets a dedicated un-pause that unconditionally
          // restores C_STATE + masterGain; the survival-mute/bg-handoff cases
          // keep goVisible's path.
          MS.setActionHandler("play", () => {
            if (survivalMuted || bgActive) { goVisible(); return; }
            resumeCtx();
            try { Atomics.store(ctrl, C_STATE, 1); } catch (e) {}   // resume from the frozen cursor
            try { const t = ctx.currentTime; masterGain.gain.cancelScheduledValues(t); masterGain.gain.setValueAtTime(0, t); masterGain.gain.linearRampToValueAtTime(1, t + 0.02); } catch (e) {}
            try { pumpOnce(); } catch (e) {}
            bgSetPlaybackState("playing");
          });
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
    if (workerFailed[0]) {
      // fail LOUDLY (goLive catches and shows it) instead of hanging at the spinner.
      abort = true;
      try { if (workers[0]) workers[0].terminate(); } catch (e) {}
      status("engine error: " + workerFailed[0]);
      throw new Error("FaustLive: engine worker failed to initialize — " + workerFailed[0]);
    }
    status("priming…");
    pump();

    const rmsBuf = new Float32Array(analyser.fftSize);
    const analyserRms = () => { analyser.getFloatTimeDomainData(rmsBuf); let s = 0; for (let i = 0; i < rmsBuf.length; i++) s += rmsBuf[i] * rmsBuf[i]; return Math.sqrt(s / rmsBuf.length); };

    const handle = {
      ctx, analyser, errors, mediaEl,
      // VIDEO EXPORT (E): the live master as a MediaStream audio track that the
      // video exporter muxes via MediaRecorder. On the mobile route msDest already
      // exists; on DESKTOP there is no msDest (masterOut → destination directly), so
      // lazily tap masterOut into a dedicated capture destination — otherwise the
      // recorded video has NO AUDIO. It taps `masterOut` and not `userGain` because
      // 2026-08-25 moved the fader to the master bus's INPUT: userGain is now the
      // unmastered ring+found sum, and a take recorded off it would be the record
      // with no glue, no make-up and no ceiling.
      audioStream: () => {
        if (msDest) return msDest.stream;
        try { if (!_capDest) { _capDest = ctx.createMediaStreamDestination(); masterOut.connect(_capDest); } return _capDest.stream; }
        catch (e) { return null; }
      },
      // VIDEO EXPORT cleanup: tear down the lazy DESKTOP capture tap after a take so
      // masterOut isn't left fanned out into an orphan MediaStreamDestination. No-op on
      // the mobile route (msDest is the shared live sink and must stay connected).
      releaseAudioStream: () => {
        if (msDest || !_capDest) return;
        try { masterOut.disconnect(_capDest); } catch (e) {}
        _capDest = null;
      },
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
      // VAPOR — now BAKED into the render (rides mobile + desktop, lands over time). Store the
      // amount; the next fed bar carries it into the stream (see postFeed). The live-graph node
      // stays at bypass, so this no longer touches it.
      setVapor(v) { curVapor = Math.max(0, Math.min(1, +v || 0)); },
      // MASTER TOP — the global ceiling (Hz). >= TOP_OFF is transparent. Rides the live
      // output graph, so a slider move is heard immediately with no rebuild and no retarget.
      setTop(hz) { applyTop(hz); },
      // DUCK THE INSTRUMENTS (not the beds) — `to` 0..1, reached over `sec`. An
      // AudioParam ramp on the audio thread, so it stays smooth through main-thread
      // jank; that is what lets a fade cover a soundfont swap. Returns the deadline so
      // a caller can await the ramp rather than guess at it.
      duckVoices(to, sec) {
        const t = Math.max(0.01, +sec || 0.5);
        const v = Math.max(0, Math.min(1, +to));
        try {
          const now = ctx.currentTime;
          voiceGain.gain.cancelScheduledValues(now);
          voiceGain.gain.setValueAtTime(voiceGain.gain.value, now);
          voiceGain.gain.linearRampToValueAtTime(v, now + t);
        } catch (e) {}
        return t;
      },
      voiceLevel() { try { return voiceGain.gain.value; } catch (e) { return 1; } },
      // how many sampler zones have decoded — the readiness signal a font swap waits
      // on, so the fade-in is driven by the new instruments actually being there
      // rather than by a fixed guess at how long a font takes. (The WAV-first route
      // has its own richer decodeStats(); this is the classic path's zone count, which
      // is all the swap needs: a number that stops climbing.)
      decodeStats() {
        let ok = 0, fail = 0;
        for (const k in samplerBufs) { const v = samplerBufs[k]; if (v === null) fail++; else if (v) ok++; }
        return { sampler: { ok, fail }, inFlight: samplerBufJobs ? samplerBufJobs.size : 0 };
      },
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
      // ── PRODUCER LOAD. `underruns` says the ring ran dry; this says WHY. mean =
      // cumulative render-milliseconds per audio second (1.0 = exactly realtime,
      // and a stream at 1.0 has no headroom for anything); recent = the last
      // sixteen bars; peak = the worst one. A number that CLIMBS over a long
      // listen is an engine getting slower; a number that is flat and high is an
      // engine that was always marginal. ──
      __producer: () => (prodLoad ? Object.assign({}, prodLoad) : null),
      // hold the feed for `sec` so the ring genuinely runs dry (see starveUntil)
      __starve: (sec) => { starveUntil = now() + Math.max(0, +sec || 0) * 1000; return starveUntil; },
      // ── THE SHAPE OF A STARVATION. `underruns` is a total, and a total cannot
      // tell a HOLE from CRACKLE: 400 consecutive dry quanta is one 1.2 s dropout,
      // 400 scattered ones are four hundred 2.9 ms notches. The reader counts both
      // (ring-player.js), so this reports quanta, EPISODES and the longest episode
      // — with the millisecond figures a person can hear, and `dry` = whether the
      // ring is starving right now. ──
      underrunShape: () => {
        const q = Atomics.load(ctrl, C_UNDER_CNT), epi = Atomics.load(ctrl, C_UNDER_EPI),
              mx = Atomics.load(ctrl, C_UNDER_MAX);
        return { quanta: q, episodes: epi, maxRun: mx, dry: Atomics.load(ctrl, C_UNDER_RUN),
          totalMs: +((q * 128 / SR) * 1000).toFixed(1),
          worstMs: +((mx * 128 / SR) * 1000).toFixed(1),
          lastAt: (Atomics.load(ctrl, C_UNDER_AT_HI) * 0x100000000) + (Atomics.load(ctrl, C_UNDER_AT_LO) >>> 0) };
      },
      // ring / underrun telemetry (real — reads the shared control block)
      underruns: () => Atomics.load(ctrl, C_UNDER_CNT),
      underrunFlag: () => Atomics.load(ctrl, C_UNDERRUN),
      // ── CROSSFADE TELEMETRY (test/browser/crossfade-seam.test.js). One record per fade:
      // where it anchored, how long the anchor was in the future, how much OUTGOING
      // audio sits past the anchor (must exceed the ramp — that is finding 2), how
      // much of that is tail, and the underrun counter either side of the ramp. ──
      __fades: () => fadeLog.slice(),
      // ── AUDIT-TRUTH surface (same shape as the WAV route's, so the ⓘ timeline's
      // silent-lane paint and the ?wavDebug download/summary work identically on
      // both routes): the rolling ring, per-serial lookup, and the counters. ──
      audit: () => auditRing.slice(),
      auditFor: (serial) => auditBySerial.get(serial) || null,
      auditSummary,
      auditStats: () => ({ bars: auditRing.length, anomalies: auditAnomTotal, pending: auditPending.size }),
      // ── NATIVE-LANE ANCHOR LATENESS (finding 3). ctx.currentTime - when at the
      // moment the bar's sampler/found notes were scheduled: <=0 means the whole
      // bar was handed to the audio thread ahead of its instant (sample-accurate).
      __barAnchors: () => barAnchors.slice(),
      // the reader's OUTPUT ledger minus the active ring's own consumed count —
      // they diverge by exactly the frames an underrun swallowed, permanently, so
      // this is the standing sensor for "have the native lanes drifted off the
      // stream" (the audit's unfalsifiable worry, made a number).
      ringDeficit: () => {
        const a = Atomics.load(ctrl, C_ACTIVE) & 1;
        return read53() - Atomics.load(ctrl, C_RING0 + a * RING_STRIDE + R_READ)
          - ((cur && cur.startGlobal != null) ? cur.startGlobal : 0);
      },
      // runwaySec = the RENDERED runway (what is actually in the ring ahead of the
      // read cursor). The feed ledger — frames merely POSTED to the producer — is
      // reported alongside it by __runway(); it is the pump's gate, never health.
      runwaySec: () => Math.max(0, ringRunwayFrames()) / SR,
      // the last MediaMetadata this engine actually set (null = it never set one,
      // i.e. the host owns the lock screen). The identity gate reads this.
      __mediaMeta: () => (msLastMeta ? Object.assign({}, msLastMeta) : null),
      // ── RUNWAY TRUTH (audit: "the phantom runway"). Both ledgers plus their gap
      // (the producer's unrendered backlog) and the per-ring cursors, so a probe can
      // tell "the conductor stopped feeding" from "the producer stopped rendering".
      __runway: () => {
        const pg = read53(), a = Atomics.load(ctrl, C_ACTIVE) & 1;
        const rd = (r, off) => Atomics.load(ctrl, C_RING0 + r * RING_STRIDE + off);
        return { ringSec: +(Math.max(0, ringRunwayFrames()) / SR).toFixed(3),
          fedSec: +(Math.max(0, feedRunwayFrames()) / SR).toFixed(3),
          backlogSec: +(Math.max(0, (cur ? cur.fedFrames - ringWritten(cur) : 0)) / SR).toFixed(3),
          phase, active: a, readFrames: pg,
          rings: [0, 1].map((r) => ({ w: rd(r, R_WRITE), r: rd(r, R_READ) })) };
      },
      // WHAT THE PREFILL ACTUALLY COST, for the gate and for anyone re-judging the
      // trade: what was asked, what the ring held when the reader was released, how
      // long that took, and whether PREFILL_MAX_MS ended the wait instead of the ring.
      __prefill: () => ({ askSec: prefillAsk, wantSec: +prefillWant.toFixed(2),
        gotSec: +prefillGot.toFixed(2), ms: Math.round(prefillMs), capped: prefillCapped }),
      // ── THE HOLD's other half (PHASE 0 — IDLE PRE-RENDER, 2026-08-27): the play
      // GESTURE calls this. If the prefill already parked (holdReady), the reader is
      // released in this very call stack; if the ring is still filling, dropping
      // `held` lets the armRun chain start the run the moment it is full. ctx.resume
      // runs here because a context born at idle sits "suspended" until a gesture.
      release() {
        if (!held) return false;
        held = false;
        try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
        if (mediaEl) { try { const p = mediaEl.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
        if (holdReady && !running && !abort && cur) startRun();
        return true;
      },
      __held: () => ({ held, holdReady }),
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
        if (mkTimer) { clearInterval(mkTimer); mkTimer = 0; }   // the make-up rider stops with the engine
        clearTimeout(pumpTimer); if (barTimer) clearInterval(barTimer); if (loadTimer) clearInterval(loadTimer);
        if (prefillTimer) { clearTimeout(prefillTimer); prefillTimer = 0; }   // a stop during the prefill must not start the run afterwards
        if (swapTimer) clearInterval(swapTimer);
        Atomics.store(ctrl, C_FADE_LEN, 0);   // disarm any pending ramp
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
        // ── THE ENGINE HAS TO LET GO OF ITSELF ────────────────────────────────
        // PAUL, ON STAGING: "if I leave it for an hour it warns me of out of
        // memory."
        //
        // MEASURED (test/leak-procs.js, 2026-08-28, headless Chromium, the ring
        // route Paul is on): every engine generation allocates 20.2 MB of ring
        // SharedArrayBuffer here (RING_SEC 30 x 44100 x 2ch x 4B, twice) and NOT
        // ONE BYTE came back. Live ring bytes across four record changes:
        // 20.2 -> 40.4 -> 60.6 -> 80.8 MB, with EVERY AudioContext closed, EVERY
        // worker terminated, and a forced GC before each reading. Same run's
        // whole-agent memory: 70 -> 184 MB. That is the hour.
        //
        // THE RETAINING PATH, off a heap snapshot, is one edge long:
        //     AudioWorkletNode --fOutputHandler--> closure --context--> this scope
        // The always-on click monitor is a Faust worklet node, and
        // `setOutputParamHandler` stores the callback ON THE NODE (faustwasm
        // FaustBaseWebAudioDsp: `this.fOutputHandler = handler`). That callback
        // closes over `clickMonState`, which lives in THIS closure — so the node
        // holds the whole conductor: both rings, the control block, every
        // decoded buffer, every cache. And Blink roots the node itself in its
        // "Pending activities" (ActiveScriptWrappable) list, where closing the
        // AudioContext cannot reach it. faustwasm's own destroy() posts a
        // message and closes the port; it never clears the handler, so destroy()
        // ALONE DOES NOT CUT THIS EDGE. Cut it by hand.
        //
        // The counters stay readable after a stop (a gate may ask what the run
        // measured) — it is the NODE the scope must not be reachable through.
        try {
          if (clickMonState && clickMonState.node) {
            const cm = clickMonState.node;
            try { cm.setOutputParamHandler(null); } catch (e) {}   // the edge
            try { cm.onprocessorerror = null; } catch (e) {}
            try { cm.disconnect(); } catch (e) {}
            try { cm.destroy(); } catch (e) {}
            clickMonState = { node: null, latest: clickMonState.latest };
          }
        } catch (e) {}
        // the other main-thread Faust node, and the ring reader: same class of
        // browser-rooted object, so let go of the graph rather than trusting
        // ctx.close() to do it.
        if (masterLimit) {
          try { masterLimit.onprocessorerror = null; } catch (e) {}
          try { masterLimit.disconnect(); } catch (e) {}
          try { masterLimit.destroy(); } catch (e) {}
          masterLimit = null;
        }
        try { ringNode.port.onmessage = null; } catch (e) {}
        try { ringNode.disconnect(); } catch (e) {}
        // THE CONTEXT'S OWN HANDLER IS THE SECOND EDGE (measured on the heap
        // snapshot after the click monitor's was cut):
        //   closure --context--> V8EventHandlerNonNull --> EventListener
        //     --> AudioContext --> AudioWorkletNode --> Pending activities
        // `ctx.onstatechange` closes over abort/goHidden/goVisible/resumeCtx —
        // this entire scope — and it outlives ctx.close() because the context is
        // held by a worklet node Blink still considers active.
        try { ctx.onstatechange = null; } catch (e) {}
        if (disarmGesture) { try { disarmGesture(); } catch (e) {} }
        // ...AND THE ENGINE MUST STOP PUBLISHING ITSELF. `FaustLive.lastHandle`
        // is a debugging convenience; left set, it pins one whole retired engine
        // (its own `auditSummary` closure is the edge) for as long as the page
        // lives. The NEXT open sets it again — this only drops the dead one.
        try { if (root.FaustLive && root.FaustLive.lastHandle === handle) root.FaustLive.lastHandle = null; } catch (e) {}
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
    // sum tight — it is ALSO the steering/UI latency (8+14 s reads on device as a
    // scheduler that is simply off). Cushion still >=5s for pocket CPU dips.
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
    // so ?wavDebug=1 shows exactly why a layer is missing (on device the symptom is
    // no soundfont/samples at all).
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
      // THE FOREIGN-COMPOSER SEAM, honoured here too: a caller on opts.events
      // hands the walk its own notes, and the parent's composer may not be
      // able to schedule that state at all (no progression — it was never the
      // parent's song). Such a caller NAMES ITS OWN WARM SET via
      // opts.warmSrcs — and it must, because a bar bakes against the buffers
      // held at bake time (the DECODE-THEN-RENDER note below): "warm nothing
      // and stream it in later" left every sampled voice of the daw
      // permanently silent on the phone routes — the record arrived as its
      // synth minority, "like you inverted the mix" (2026-08-19). The bare
      // empty fallback survives only for a caller that neither schedules nor
      // declares.
      if (opts && typeof opts.warmSrcs === "function") {
        try {
          const w = opts.warmSrcs(state) || {};
          return { foundSrcs: w.foundSrcs || [], samplerSrcs: w.samplerSrcs || [],
                   speechSrc: w.speechSrc || null };
        } catch (e) { return { foundSrcs: [], samplerSrcs: [], speechSrc: null }; }
      }
      let sched;
      try { sched = SE.buildSchedule(E, state); }
      catch (e) { return { foundSrcs: [], samplerSrcs: [], speechSrc: null }; }
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
    const stepWalk = makeWalk(getState, E, SE, (opts && opts.startBar) | 0, opts);   // drop-in at the bookmarked measure; `opts` carries the foreign-composer seam (opts.events)

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
    // clean and makes the time-theft imperceptible (at 120ms the groove lurches
    // every ~7s on mms-aac with drift pinned at 0 — the bridges are the cause).
    const BRIDGE_OV_SEC = opts.bridgeOverlapSec > 0 ? opts.bridgeOverlapSec : 0.015;
    // ── DECODE-THEN-RENDER caps (the iOS pitched-voice fix — see reopen()) ──
    // The producer WAITS for this gen's found/sampler PCM to decode (through the shared
    // decGate) BEFORE it opens, so the buffers are present from bar 0 and no pitched-sample
    // bar bakes PERMANENTLY silent (the bakeNative found/sampler layers are filtered/summed
    // against ST.buffers AT bake time — a buffer that lands after its bar is baked is lost
    // for that bar; the ring path never showed the bug because it decodes JIT per bar and
    // won't render a bar until its buffers are ready). The wait is capped so it never hangs:
    // BOOT waits longer (nothing is playing yet — completeness over instant start), a
    // GEN cutover waits less (the OLD gen keeps playing over the wait, so a long stall would
    // gap it). Past the cap, stragglers still stream in via addBuffers (the safety net) and
    // pop into LATER bars — correctness no longer DEPENDS on that pop-in.
    const BOOT_DECODE_CAP_MS = opts.bootDecodeCapMs > 0 ? opts.bootDecodeCapMs : 8000;
    const GEN_DECODE_CAP_MS = opts.genDecodeCapMs > 0 ? opts.genDecodeCapMs : 4000;
    // decode-then-render kill-switch (default ON). false = revert to v3.1 open-immediately.
    const DECODE_THEN_RENDER = opts.decodeThenRender !== false;
    const workers = [null, null], workerReady = [false, false];
    const workerReadyProm = [null, null], readyResolve = [null, null];
    // a failed worker init must SETTLE ensureWorker (with this flag set) so the
    // boot await fails loudly instead of hanging forever.
    const workerFailed = [null, null];
    function ensureWorker(k) {
      if (workerReadyProm[k]) return workerReadyProm[k];
      workerReadyProm[k] = new Promise((resolve) => {
        readyResolve[k] = resolve;
        const w = new Worker(BASE + "stream-worker.js", { type: "module" });
        workers[k] = w;
        w.onmessage = (e) => onMsg(e.data, k);
        w.onerror = (e) => {
          const msg = "wavworker" + k + " error: " + ((e && e.message) || e);
          errors.push(msg);
          // a worker that errors BEFORE 'ready' never becomes ready — settle the boot await
          if (!workerReady[k]) { if (!workerFailed[k]) workerFailed[k] = msg; if (readyResolve[k]) readyResolve[k](); }
        };
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
    // BAKED VAPOR (WAV-first mobile path): the amount rides each fed bar into the worker's
    // stream renderer, which bakes it into the WAV segments — so vapor finally works on mobile
    // and lands over time. Was unreachable before (this path has no live output graph).
    let curVaporWav = Math.max(0, Math.min(1, +(opts && opts.vapor) || 0));
    function postFeed(r) {
      workerOf(curGen).postMessage({ type: "feedBar", bar: {
        units: r.units, events: r.events, fxParams: r.fxParams, spb: r.spb, lo: r.lo, hi: r.hi,
        barStartSec: r._base, sweeps: r._sweeps, found: r.found, foundCi: r.meta.ci, meta: r.meta,
        vapor: curVaporWav } });
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
    // that voice. On device: pad[ins_church_organ_*, ins_ohh_voices_*…] missing on
    // the bars right after an instrument swap, decode count frozen — the decodes
    // were never requested. So: before feeding a
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
      if (m.type === "initfail") {
        // settle the pending ensureWorker with the failure flag set (boot checks it).
        errors.push("wavworker" + k + " initfail: " + m.error);
        if (!workerFailed[k]) workerFailed[k] = "wavworker" + k + " initfail: " + m.error;
        if (readyResolve[k]) readyResolve[k]();
        return;
      }
      if (m.type === "openfail") { errors.push("openfail gen" + m.gen + ": " + m.error); return; }
      if (m.type === "pcmseg") {
        if (!useMp3) return;   // route demoted to segAB mid-flight — drop stale PCM flushes
        // a flush from a gen the encoder has already bridged PAST can never be
        // forwarded (pumpEncoder only ever moves forward), so drop it at the door
        // instead of parking it in a queue that only the NEXT bridge would clear.
        if (encGen >= 0 && m.gen < encGen) return;
        // v3: a clean PCM flush → queue it for the encoder feed (timeline-ordered).
        mark("firstFlush");
        receivedSegs++;
        if (m.gen === curGen) { curGenReceived++; producedSinceOpen += m.durSec; }
        // NOTE: receivedPcmSec is counted in forwardPcm(), NOT here — see the comment
        // there. Counting arrivals leaked every skipped gen's seconds into the runway.
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
    let appendedChunks = 0, appendedSec = 0, receivedPcmSec = 0, pcmPendingSec = 0;
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

    // ── AUDIT-TRUTH ring: track when a node is expected to produce sound and
    // doesn't. The renderer measures each voice's ACTUAL
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

    function putPcm(s) {
      let q = pcmQueues.get(s.gen); if (!q) { q = []; pcmQueues.set(s.gen, q); }
      if (q[s.idx]) pcmPendingSec -= q[s.idx].durSec || 0;   // (never seen; keeps the ledger exact)
      q[s.idx] = s; pcmPendingSec += s.durSec || 0;
    }
    // drop a gen's un-forwarded flushes and release their seconds from the ledger.
    function dropPcmGen(gen) {
      const q = pcmQueues.get(gen);
      if (q) for (const s of q) if (s) pcmPendingSec -= s.durSec || 0;
      pcmQueues.delete(gen);
    }
    function clearPcmQueues() { pcmQueues.clear(); pcmPendingSec = 0; }
    // THE FORWARD RUNWAY: seconds handed to the encoder (which will be appended) plus
    // seconds queued for it, minus what the element has played. The queued term is
    // what keeps the pump bounded while the encoder is still opening; it is exact
    // rather than leaky because a superseded gen's queue is SUBTRACTED when dropped.
    function mp3AheadSec() { const t = mp3El ? (mp3El.currentTime || 0) : 0; return Math.max(0, receivedPcmSec + pcmPendingSec - t); }

    // forward one queued PCM flush to the encoder (transferring its buffers onward).
    // THE FEED-RUNWAY LEDGER LIVES HERE (the mp3 route must not count skipped-gen
    // PCM as buffered). Incrementing receivedPcmSec on every pcmseg ARRIVAL leaks:
    // pumpEncoder bridges to the NEWEST ready gen and deletes the
    // intermediate gens' queues — those never-forwarded seconds (a rapid steer leaks
    // ~2-6 s per superseded gen) stay in the counter forever. mp3AheadSec() =
    // receivedPcmSec − currentTime is the pump's ONLY runway term, so once the leak
    // reaches FEED_CAP_MP3 (5 s) feedRoom pins false, stepWalk is never called
    // again, and the element plays out into permanent silence with the frozen
    // watchdog classifying it as a benign starve forever. Counting here makes the
    // ledger mean what stepDownCodec's own comment says it means: seconds actually
    // handed to the encoder.
    function forwardPcm(gen, idx, flags) {
      const q = pcmQueues.get(gen); const s = q && q[idx]; if (!s) return false;
      q[idx] = null;
      pcmPendingSec -= s.durSec || 0;
      receivedPcmSec += s.durSec || 0;
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
            for (const gen of [...pcmQueues.keys()]) if (gen < g) dropPcmGen(gen);   // drop skipped/old gens (releasing their queued seconds)
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
      clearPcmQueues(); genDone.clear(); encGen = -1; encIdx = 0; encOpened = false;
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
        // "scheduling the first bar" with zero errors.
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
      clearPcmQueues(); genDone.clear(); encGen = -1; encIdx = 0;
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
          spb: meta.spb, cbeats: meta.cbeats, chord: meta.chord,
          section: meta.section, secIdx: meta.secIdx, nsec: meta.nsec, sec: meta.sec });
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
    // This is the path a phone is on. The identity comes from the HOST
    // (opts.mediaMeta — see setMediaMeta at the top of this file); the 1 Hz refresh
    // below picks up a steer within a second, and re-mints nothing when the strings
    // haven't changed. With no callback it leaves the host's own metadata alone
    // instead of stamping the engine's guess over it every second.
    const MS = (typeof navigator !== "undefined" && navigator.mediaSession) ? navigator.mediaSession : null;
    function msState(s) { if (MS) try { MS.playbackState = s; } catch (e) {} }
    let msSig = "", msLastMeta = null;
    function msMeta() {
      msSig = setMediaMeta(MS, root, opts, msSig, (m) => { msLastMeta = m; });
      // AN ENDLESS STREAM HAS NO END. We never set a duration, but the UA derives
      // one from the media element's buffered range, so the lock-screen transport
      // counts down against a fake one (−0:05 against 11:09 elapsed) and draws a
      // track that is always about to finish. Declare the truth instead: an infinite
      // duration is the spec's "live stream" signal and drops the countdown.
      // Guarded — a UA that rejects Infinity simply keeps its own guess.
      if (MS && MS.setPositionState) {
        const el = useMp3 ? mp3El : curEl;
        try { MS.setPositionState({ duration: Infinity, position: el ? (el.currentTime || 0) : 0, playbackRate: 1 }); } catch (e) {}
      }
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
        encWorker = new Worker(FAUST + "codec/mp3-worker.js", { type: "module" });
        encWorker.onmessage = (e) => onEncMsg(e.data);
        encWorker.onerror = (e) => errors.push("mp3 worker error: " + ((e && e.message) || e));
        encWorker.postMessage({ type: "init" });
      } catch (e) { errors.push("mp3 worker spawn: " + (e && e.message || e)); }
    }
    await ensureWorker(0);
    if (workerFailed[0]) {
      // fail LOUDLY (goLive catches and shows it) instead of hanging at the spinner.
      abort = true;
      try { if (workers[0]) workers[0].terminate(); } catch (e) {}
      if (encWorker) { try { encWorker.terminate(); } catch (e) {} encWorker = null; }
      if (metaTimer) { try { clearInterval(metaTimer); } catch (e) {} metaTimer = 0; }
      status("engine error: " + workerFailed[0]);
      throw new Error("FaustLiveWav: engine worker failed to initialize — " + workerFailed[0]);
    }
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
      // VAPOR — baked into the WAV segments via the fed bars (finally works on mobile).
      setVapor(v) { curVaporWav = Math.max(0, Math.min(1, +v || 0)); },
      // MASTER TOP — no-op on the WAV-first mobile route: it plays a plain <audio>
      // element with no WebAudio graph to hang a filter on (the same reason vapor had
      // to be baked into the segments). Declared so callers can set it unconditionally.
      setTop() {},
      // DUCK — also a no-op here, and for once that is the right behaviour rather than
      // a limitation: this route plays PRE-RENDERED segments, so a font swap does not
      // reach the audio already in the queue. There is no seam at this end to cover.
      duckVoices() { return 0; },
      voiceLevel() { return 1; },
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
      // the last MediaMetadata this engine actually set (null = the host owns it)
      __mediaMeta: () => (msLastMeta ? Object.assign({}, msLastMeta) : null),
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
            // the forward-runway ledger, split (audit: "counts skipped-gen PCM as
            // buffered") — forwarded to the encoder vs still queued for it. A probe
            // can now see the pump's runway drift away from the element's reality.
            forwardedSec: +receivedPcmSec.toFixed(2), pendingSec: +pcmPendingSec.toFixed(2),
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
          // decode forensics on the FALLBACK route too — a segAB device log with
          // dec=null hides the missing-samples answer.
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
        // the same unpublish the ring conductor does: a retired engine that is
        // still named by `FaustLive.lastHandle` is a retired engine that is still
        // in memory, decoded buffers and all. The next open re-publishes.
        try { if (root.FaustLive && root.FaustLive.lastHandle === handle) root.FaustLive.lastHandle = null; } catch (e) {}
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
