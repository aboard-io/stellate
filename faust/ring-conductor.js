// faust/ring-conductor.js — the STATE-CHANGE CONDUCTOR (Phase 4 of the live-engine
// rebuild). A small, environment-light controller that owns the "current state" and
// orchestrates a smooth, click-free crossfade to a NEW state using the two-ring SAB
// layout of faust/ring-player.js + two faust/stream-worker.js producers.
//
// This is NOT live.js (Phase 5). It is the harness-side brain for faust/ring-test.html
// and any headless gate: it does not touch the AudioContext / worklet graph (the
// caller builds those and hands over the ctrl + ring SABs); it only writes the shared
// CONTROL slots (C_STATE / C_XFADE via a ramp) and drives the producer workers.
//
// ── The model ────────────────────────────────────────────────────────────────
// Two producers, one PINNED per ring: worker0↔ring0, worker1↔ring1. At any time one
// ring is ACTIVE (playing) and the other is IDLE. On a state change the conductor:
//   1. opens the NEW state on the idle ring via that ring's worker, priming a SHORT
//      BRIDGE (~1 chord-bar) for low latency — the two workers render in PARALLEL, so
//      the active ring keeps playing while the bridge fills;
//   2. once the bridge is primed, ramps the shared crossfade control C_XFADE 0→10000
//      over `xfadeMs` (300–500 ms). The worklet reads BOTH rings and equal-power
//      mixes them; at 10000 it promotes the incoming ring to active and zeroes C_XFADE
//      (seamless — the output is already purely the new stream);
//   3. retires the OLD producer (posts stop → it abandons its unwritten chunks and
//      frees its ring for the next change). Rings ping-pong on successive changes.
//
// ── Rapid changes (coalescing) ────────────────────────────────────────────────
// At most ONE pending bridge. A newer target while BRIDGING re-points the same
// bridge (stop + re-open on the same idle ring under a new generation; the stale
// open's late messages are ignored by generation). A newer target while FADING is
// held as `pending` and applied as a fresh bridge the instant the fade commits. A
// burst therefore converges on its LAST target without a stuck state or underrun.
//
// Generation (`gen`) tags every open; the worker echoes it on every post, so a
// superseded open's `opened`/`primed`/… are dropped here by a simple gen check.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.RingConductor = factory();
})(typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : globalThis), function () {
  "use strict";

  // control-block layout (must match faust/ring-player.js / stream-worker.js)
  const C_STATE = 0, C_XFADE = 1, C_ACTIVE = 2, C_READ_LO = 3, C_READ_HI = 4,
        C_UNDER_CNT = 6;
  const C_RING0 = 8, RING_STRIDE = 4, R_WRITE = 0, R_READ = 1;

  // make(cfg) -> conductor
  //   cfg.ctrlSab      Int32 control SAB (shared with worklet + workers)
  //   cfg.ringSabs     [ring0 Float32 SAB, ring1 Float32 SAB]
  //   cfg.cap          ring capacity in FRAMES
  //   cfg.SR           sample rate (44100)
  //   cfg.makeWorker   () => Worker           (a fresh stream-worker.js module Worker)
  //   cfg.xfadeMs      crossfade duration ms  (default 400)
  //   cfg.primeSec     initial-stream prime   (default 6)
  //   cfg.bridgePrimeSec  bridge prime         (default 2.5 — low latency)
  //   cfg.runwaySec    steady runway ahead     (default 16)
  //   cfg.ioFor(state) -> {buffers,speech}     (optional; default found-free)
  //   cfg.log / onStarted / onCrossfade / now  (optional callbacks)
  function make(cfg) {
    const ctrl = new Int32Array(cfg.ctrlSab);
    const ringSabs = cfg.ringSabs;
    const cap = cfg.cap | 0;
    const SR = cfg.SR || 44100;
    const xfadeMs = cfg.xfadeMs || 400;
    const primeSec = cfg.primeSec != null ? cfg.primeSec : 6;
    const bridgePrimeSec = cfg.bridgePrimeSec != null ? cfg.bridgePrimeSec : 2.5;
    const runwaySec = cfg.runwaySec != null ? cfg.runwaySec : 16;
    const ioFor = cfg.ioFor || (() => ({ buffers: {}, speech: null }));
    const now = cfg.now || (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
    const log = cfg.log || (() => {});
    const sig = (s) => JSON.stringify(s);

    // per-ring producer state
    const workers = [null, null];
    const readyProm = [null, null];      // Promise<void> resolved on worker "ready"
    const openGen = [0, 0];              // latest gen opened on each ring (msg filter)
    const lastInfo = [null, null];       // latest opened info per ring

    let genCounter = 0;
    let active = 0;                      // ring index currently playing (matches C_ACTIVE)
    let playing = null;                  // { ring, gen, state, sig } of the active stream
    let phase = "boot";                  // boot | idle | bridging | fading
    let bridging = null;                 // { ring, gen|null, state, sig, primed }
    let pending = null;                  // { state, sig } — coalesced next target
    let startPrimed = null;              // one-shot resolver for start()
    let fadeTimer = null, swapTimer = null;
    let fadeStartCursor = 0, fadeStartMs = 0;

    const crossfades = [];               // recorded per-crossfade metadata

    const readCursor = () =>
      (Atomics.load(ctrl, C_READ_HI) * 0x100000000) + (Atomics.load(ctrl, C_READ_LO) >>> 0);

    // ── worker lifecycle ──
    function ensureWorker(ring) {
      if (readyProm[ring]) return readyProm[ring];
      readyProm[ring] = new Promise((resolve) => {
        const w = cfg.makeWorker();
        workers[ring] = w;
        w.onmessage = (e) => onWorkerMsg(ring, e.data, resolve);
        w.onerror = (e) => log(`worker${ring} error: ${(e && e.message) || e}`);
        w.postMessage({ type: "init" });
      });
      return readyProm[ring];
    }

    function postOpen(ring, gen, state, prime) {
      const io = ioFor(state) || {};
      openGen[ring] = gen;
      workers[ring].postMessage({
        type: "open", gen, ringIndex: ring, state,
        buffers: io.buffers || {}, speech: io.speech || null,
        ctrlSab: cfg.ctrlSab, ringSab: ringSabs[ring], cap,
        primeSec: prime, runwaySec, durSec: cfg.streamSec || undefined,
      });
    }
    const postStop = (ring) => { if (workers[ring]) workers[ring].postMessage({ type: "stop" }); };

    function onWorkerMsg(ring, m, resolveReady) {
      if (!m || !m.type) return;
      if (m.type === "ready") { resolveReady(); return; }
      if (m.type === "initfail") { log(`worker${ring} initfail: ${m.error}`); return; }
      // drop messages from a superseded open on this ring
      if (m.gen != null && m.gen !== openGen[ring]) return;
      if (m.type === "opened") { lastInfo[ring] = m.info; log(`ring${ring} opened gen${m.gen} nChunks=${m.info.nChunks} totalSec=${m.info.totalSec.toFixed(1)}`); return; }
      if (m.type === "primed") { onPrimed(ring, m.gen, m.filled); return; }
      if (m.type === "openfail") { log(`ring${ring} openfail gen${m.gen}: ${m.error}`); return; }
      // status / eos / stopped — informational for the soak
      if (m.type === "status" && (m.cursor % 50 === 0)) log(`ring${ring} chunk ${m.cursor}/${m.nChunks} filled=${m.filledSec}s under=${m.underruns}`);
    }

    function onPrimed(ring, gen, filled) {
      // initial stream primed → start playback
      if (phase === "boot" && playing && ring === playing.ring && gen === playing.gen) {
        Atomics.store(ctrl, C_ACTIVE, active);
        Atomics.store(ctrl, C_XFADE, 0);
        Atomics.store(ctrl, C_STATE, 1);        // RUN
        phase = "idle";
        log(`PRIMED initial (${(filled / SR).toFixed(1)}s) → RUNNING ring${active}`);
        if (startPrimed) { const r = startPrimed; startPrimed = null; r(); }
        drive();
        return;
      }
      // bridge primed → either honor a superseding target or start the fade
      if (phase === "bridging" && bridging && ring === bridging.ring && gen === bridging.gen && !bridging.primed) {
        bridging.primed = true;
        if (pending && pending.sig !== bridging.sig) {
          const t = pending; pending = null; repointBridge(t);
          return;
        }
        log(`bridge PRIMED ring${ring} (${(filled / SR).toFixed(1)}s) → fade`);
        startFade();
      }
    }

    // ── the state machine ──
    function requestState(state) {
      const s = sig(state);
      if (phase === "idle" && !bridging && playing && s === playing.sig) return;  // no-op
      pending = { state, sig: s };
      drive();
    }

    function drive() {
      if (phase === "boot" || phase === "fading") return;   // revisited on primed/commit
      if (phase === "bridging") {
        if (bridging && pending && pending.sig !== bridging.sig) {
          const t = pending; pending = null; repointBridge(t);
        }
        return;
      }
      // phase === "idle"
      if (pending && (!playing || pending.sig !== playing.sig)) {
        const t = pending; pending = null; beginBridge(t);
      } else pending = null;
    }

    function beginBridge(target) {
      const incoming = active ^ 1;
      phase = "bridging";
      bridging = { ring: incoming, gen: null, state: target.state, sig: target.sig, primed: false };
      const b = bridging;
      ensureWorker(incoming).then(() => {
        if (bridging !== b) return;              // torn down / superseded before ready
        b.gen = ++genCounter;
        postOpen(incoming, b.gen, b.state, bridgePrimeSec);
        log(`bridge OPEN ring${incoming} gen${b.gen}`);
      });
    }

    // re-point the in-flight bridge to a newer target (coalesce a rapid change)
    function repointBridge(target) {
      const b = bridging;
      b.state = target.state; b.sig = target.sig; b.primed = false;
      if (b.gen == null) return;                 // not opened yet; beginBridge's .then uses new target
      b.gen = ++genCounter;                      // supersede: worker halts old pump on the new open
      postOpen(b.ring, b.gen, b.state, bridgePrimeSec);
      log(`bridge REPOINT ring${b.ring} gen${b.gen}`);
    }

    function startFade() {
      phase = "fading";
      fadeStartCursor = readCursor();
      fadeStartMs = now();
      if (fadeTimer) clearInterval(fadeTimer);
      fadeTimer = setInterval(() => {
        const el = now() - fadeStartMs;
        if (el >= xfadeMs) {
          Atomics.store(ctrl, C_XFADE, 10000);   // terminal write; conductor stops here
          clearInterval(fadeTimer); fadeTimer = null;
          waitSwap();
        } else {
          Atomics.store(ctrl, C_XFADE, Math.min(9999, Math.floor(10000 * el / xfadeMs)));
        }
      }, 5);
    }

    // poll for the worklet's swap (C_ACTIVE→incoming, C_XFADE→0), then commit
    function waitSwap() {
      if (swapTimer) clearInterval(swapTimer);
      swapTimer = setInterval(() => {
        if (Atomics.load(ctrl, C_ACTIVE) === bridging.ring && Atomics.load(ctrl, C_XFADE) === 0) {
          clearInterval(swapTimer); swapTimer = null;
          commitFade();
        }
      }, 3);
    }

    function commitFade() {
      const b = bridging;
      const rec = {
        index: crossfades.length,
        fromSig: playing ? playing.sig : null, toSig: b.sig,
        fromRing: active, toRing: b.ring,
        startCursor: fadeStartCursor, endCursor: readCursor(),
        startMs: fadeStartMs, endMs: now(), xfadeMs,
      };
      crossfades.push(rec);
      const oldRing = active;
      postStop(oldRing);                         // retire the old producer / free its ring
      active = b.ring;
      playing = { ring: b.ring, gen: b.gen, state: b.state, sig: b.sig };
      bridging = null;
      phase = "idle";
      log(`CROSSFADE #${rec.index} committed ring${oldRing}→ring${b.ring} @${rec.endCursor} (${(rec.endMs - rec.startMs).toFixed(0)}ms)`);
      if (cfg.onCrossfade) cfg.onCrossfade(rec);
      drive();                                   // pick up any pending target
    }

    async function start(state0) {
      active = 0;
      await ensureWorker(0);
      const gen = ++genCounter;
      playing = { ring: 0, gen, state: state0, sig: sig(state0) };
      const primedP = new Promise((r) => { startPrimed = r; });
      postOpen(0, gen, state0, primeSec);
      log(`start OPEN ring0 gen${gen}`);
      await primedP;
      if (cfg.onStarted) cfg.onStarted();
    }

    function destroy() {
      if (fadeTimer) clearInterval(fadeTimer);
      if (swapTimer) clearInterval(swapTimer);
      Atomics.store(ctrl, C_STATE, 2);
      for (const w of workers) if (w) { try { w.postMessage({ type: "stop" }); w.terminate(); } catch (e) {} }
    }

    return {
      start, requestState, destroy,
      crossfades,
      activeRing: () => active,
      phase: () => phase,
      playingSig: () => (playing ? playing.sig : null),
      info: () => lastInfo[active],
      underruns: () => Atomics.load(ctrl, C_UNDER_CNT),
      readCursor,
      filled: () => Atomics.load(ctrl, C_RING0 + active * RING_STRIDE + R_WRITE) - Atomics.load(ctrl, C_RING0 + active * RING_STRIDE + R_READ),
    };
  }

  return { make };
});
