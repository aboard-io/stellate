// faust/ring-player.js — the RING READER (Phase 3 + Phase 4 of the live-engine rebuild).
//
// A plain hand-written AudioWorkletProcessor (NOT Faust) that reads a continuous
// interleaved-stereo Float32 sample stream out of a SharedArrayBuffer ring and
// writes it to its 2-channel output, ONE ring sample per output sample. The
// producer (faust/stream-worker.js) fills the ring ahead of this read cursor
// with the full-mix stream from faust/stream-renderer.js; because the reader
// consumes exactly one sample per output sample and the ring holds a
// byte-continuous stream (segment-parity proven == press.js), buffer-boundary
// discontinuities are impossible BY CONSTRUCTION — there are no per-bar
// AudioBufferSourceNode seams to click.
//
// PHASE 4 — STATE-CHANGE CROSSFADE. The reader holds TWO rings (current + incoming).
// On a state change the conductor opens the new state onto the idle ring via a
// SECOND producer; once that ring is primed it ramps the shared crossfade control
// C_XFADE 0→10000. While C_XFADE>0 the reader reads BOTH rings sample-for-sample
// and mixes them with an EQUAL-POWER gain (gainA=cos θ, gainB=sin θ,
// θ=(C_XFADE/10000)·π/2) so the summed power of two ~uncorrelated streams stays
// flat — no dip, no click. When C_XFADE reaches 10000 the incoming ring is at unity
// and the outgoing ring at zero: the reader flips C_ACTIVE to the incoming ring and
// resets C_XFADE to 0 IN THE SAME QUANTUM (a no-op for the output signal — it is
// already purely B), so the read of B continues with no cursor discontinuity and
// the outgoing ring is left retired for the conductor to reuse.
//
// ────────────────────────────────────────────────────── SAMPLE-EXACT FADE
// The ramp must NOT be driven from the MAIN THREAD (a setInterval polling the
// read cursor, then writing C_XFADE 0→10000 off `performance.now()`).
// Two measured consequences (docs/TIMING-AUDIT-2026-07 finding 2): the ramp's
// start slips by however long the main thread was blocked — and a genre
// swap measures up to 585 ms of long task — so ring B's frame 0 (the incoming
// genre's downbeat) landed late against the native drum lanes, which the
// conductor anchors on the ring cursor; and nothing could be scheduled AHEAD of
// the ramp because the ramp only existed as it was being written.
//
// So the fade is now ARMED, not driven: the conductor writes the output frame
// where the ramp starts (C_FADE_AT) and its length (C_FADE_LEN) once, and this
// processor runs the equal-power ramp itself, per sample, off its own monotonic
// output cursor. B is consumed from EXACTLY the armed frame (never before,
// never after), so the incoming stream's bar 0 and the native notes the
// conductor scheduled for that same frame share one instant to the sample.
// C_XFADE is still published every quantum (it is the readable fade position,
// and a legacy caller may still drive it directly when no fade is armed).
//
// Structure template: faust/sentinel-processor.js (hand-written worklet).
// Wiring template: faust/live.js:339-341 (addModule + new AudioWorkletNode).
//
// ───────────────────────────────────────────────────────── SHARED CONTROL BLOCK
// One `SharedArrayBuffer` viewed as Int32Array `ctrl`. Layout (unchanged from
// Phase 3 — the ring-B slots were reserved there):
//
//   GLOBAL (indices 0..7)
//     [0] C_STATE      0 = idle (silence, cursor frozen, no underrun counted)
//                      1 = running (read + advance)   2 = stopped (silence)
//     [1] C_XFADE      0..10000 fixed-point A→B crossfade (0 ⇒ read active ring only)
//     [2] C_ACTIVE     primary (A) ring index; incoming (B) is the OTHER ring
//     [3] C_READ_LO    monotonic OUTPUT frame counter, low 32 (frames emitted while
//     [4] C_READ_HI    …high bits         running — advances by n every quantum, so
//                       it is strictly monotonic ACROSS ring swaps, never resets)
//     [5] C_UNDERRUN   sticky: 1 if a contributing ring ever ran dry WHILE running
//     [6] C_UNDER_CNT  count of render quanta that underran (≥1 missing sample)
//     [7] —            reserved
//    [16] C_FADE_AT_LO SCHEDULED crossfade: the global OUTPUT frame (53-bit, lo/hi)
//    [17] C_FADE_AT_HI  at which the A→B ramp begins — see "SAMPLE-EXACT FADE" above
//    [18] C_FADE_LEN   ramp length in frames (0 = no scheduled fade armed)
//
//   PER-RING block, base = C_RING0 + ring*RING_STRIDE  (rings 0 and 1):
//     [+0] R_WRITE     frames written by that ring's producer (monotonic)
//     [+1] R_READ      frames consumed from that ring by this reader (monotonic;
//                       reset to 0 ONLY by the producer at an idle-ring handoff)
//     [+2] R_CLOSED    producer finished writing this ring (1)
//     [+3] —           reserved
//
// Each audio ring is its own SharedArrayBuffer of interleaved-stereo Float32:
// frame f lives at [2*(f % cap)] = L, [2*(f % cap)+1] = R. `cap` frames, shared
// by both rings. Monotonic frame counters wrap only after ~13.5 h at 44.1 kHz.
//
// PASS AT CONSTRUCTION via processorOptions:
//   { ctrlSab, ring0Sab, ring1Sab, cap }   (ctrl SAB, both audio SABs, capacity frames)
// ring1Sab is optional (Phase-3 single-ring harness omits it; C_XFADE stays 0 so
// the ring-B path is never entered).

const C_STATE = 0, C_XFADE = 1, C_ACTIVE = 2, C_READ_LO = 3, C_READ_HI = 4,
      C_UNDERRUN = 5, C_UNDER_CNT = 6;
const C_RING0 = 8, RING_STRIDE = 4;
const C_FADE_AT_LO = 16, C_FADE_AT_HI = 17, C_FADE_LEN = 18;
const R_WRITE = 0, R_READ = 1;   // offsets within a per-ring block
const HALF_PI = Math.PI / 2;
const GAIN_EPS = 1e-3;           // a ring below this gain doesn't count toward underrun

class RingPlayer extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.ctrl = new Int32Array(o.ctrlSab);
    this.data = [
      new Float32Array(o.ring0Sab),                          // ring 0 (interleaved L,R)
      o.ring1Sab ? new Float32Array(o.ring1Sab) : null,      // ring 1 (Phase 4; may be absent)
    ];
    this.cap = o.cap | 0;                                    // ring capacity in FRAMES (both rings)
    this.outFrames = 0;                                      // global monotonic output cursor
  }

  // ctrl indices for a ring's write/read cursors
  rW(ring) { return C_RING0 + ring * RING_STRIDE + R_WRITE; }
  rR(ring) { return C_RING0 + ring * RING_STRIDE + R_READ; }

  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length < 2) return true;
    const outL = out[0], outR = out[1];
    const n = outL.length;                        // 128 (one render quantum)
    const ctrl = this.ctrl;

    // idle / stopped: emit pure silence, DON'T advance the cursor and DON'T
    // count an underrun (the ring is intentionally not being consumed yet).
    if (Atomics.load(ctrl, C_STATE) !== 1) { outL.fill(0); outR.fill(0); return true; }

    const cap = this.cap;
    const active = Atomics.load(ctrl, C_ACTIVE) & 1;
    const xfRaw = Atomics.load(ctrl, C_XFADE);
    // ARMED fade (see SAMPLE-EXACT FADE): the ramp is a function of this
    // processor's own output cursor, so it starts on the armed frame no matter
    // what the main thread is doing. len 0 ⇒ fall back to the legacy C_XFADE.
    const fadeLen = Atomics.load(ctrl, C_FADE_LEN);
    const fadeAt = fadeLen > 0
      ? (Atomics.load(ctrl, C_FADE_AT_HI) * 0x100000000) + (Atomics.load(ctrl, C_FADE_AT_LO) >>> 0)
      : 0;
    const p0 = this.outFrames;
    let under = 0;

    if (fadeLen > 0 ? (p0 + n <= fadeAt) : (xfRaw <= 0)) {
      // ── single-ring read (exactly Phase 3): read the active ring only ──
      const data = this.data[active];
      const aWi = this.rW(active), aRi = this.rR(active);
      const write = Atomics.load(ctrl, aWi);
      let read = Atomics.load(ctrl, aRi);
      let avail = write - read;
      for (let i = 0; i < n; i++) {
        if (avail > 0) {
          const b = (read % cap) * 2;
          outL[i] = data[b]; outR[i] = data[b + 1];
          read++; avail--;
        } else {
          // UNDERRUN: ring drained. Emit silence and do NOT advance `read` past
          // what exists — that ring's cursor stays locked to the sample grid.
          outL[i] = 0; outR[i] = 0; under++;
        }
      }
      Atomics.store(ctrl, aRi, read);
    } else {
      // ── crossfade read: mix active (A, fading out) + incoming (B, fading in)
      //    with an EQUAL-POWER gain. B is the ring the conductor primed. ──
      const incoming = active ^ 1;
      const dataA = this.data[active], dataB = this.data[incoming];
      const aWi = this.rW(active), aRi = this.rR(active);
      const bWi = this.rW(incoming), bRi = this.rR(incoming);
      let aRead = Atomics.load(ctrl, aRi), aAvail = Atomics.load(ctrl, aWi) - aRead;
      let bRead = Atomics.load(ctrl, bRi), bAvail = (dataB ? Atomics.load(ctrl, bWi) : 0) - bRead;
      // legacy (unarmed) drive: one constant position for the whole quantum
      const flat = fadeLen > 0 ? -1 : (xfRaw >= 10000 ? 1 : xfRaw / 10000);
      let done = false, lastPos = 0;
      for (let i = 0; i < n; i++) {
        // t = the ramp position at THIS sample. <0 = not started (pure A, B
        // untouched — its cursor must not move before the armed frame);
        // >=1 = complete (pure B).
        const t = flat >= 0 ? flat : (p0 + i - fadeAt) / fadeLen;
        let gA, gB;
        if (t <= 0) { gA = 1; gB = 0; }
        else if (t >= 1) { gA = 0; gB = 1; done = done || fadeLen > 0; }
        else { const th = t * HALF_PI; gA = Math.cos(th); gB = Math.sin(th); }
        lastPos = t < 0 ? 0 : t > 1 ? 1 : t;
        let aL = 0, aR = 0, bL = 0, bR = 0;
        if (t < 1) {   // A still contributes (or is about to stop): keep its cursor on the grid
          if (aAvail > 0) { const b = (aRead % cap) * 2; aL = dataA[b]; aR = dataA[b + 1]; aRead++; aAvail--; }
          else if (gA > GAIN_EPS) under++;
        }
        if (dataB && t >= 0) {   // B is consumed from EXACTLY the armed frame
          if (bAvail > 0) { const b = (bRead % cap) * 2; bL = dataB[b]; bR = dataB[b + 1]; bRead++; bAvail--; }
          else if (gB > GAIN_EPS) under++;
        }
        outL[i] = aL * gA + bL * gB;
        outR[i] = aR * gA + bR * gB;
      }
      Atomics.store(ctrl, aRi, aRead);
      if (dataB) Atomics.store(ctrl, bRi, bRead);

      // COMPLETE: past the ramp the output is already purely B (gB=1, gA=0).
      // Promote B to the sole active ring and disarm IN THIS QUANTUM so the next
      // quantum reads B via the single-ring path with no discontinuity (B's read
      // cursor just advanced; it continues). A is left retired.
      if (done || (flat >= 0 && xfRaw >= 10000)) {
        Atomics.store(ctrl, C_ACTIVE, incoming);
        Atomics.store(ctrl, C_FADE_LEN, 0);
        Atomics.store(ctrl, C_XFADE, 0);
      } else if (fadeLen > 0) {
        // publish the armed ramp's position (the legacy drive owns C_XFADE itself
        // — rewriting a rounded copy of it would walk the value down every quantum)
        Atomics.store(ctrl, C_XFADE, Math.min(9999, Math.floor(lastPos * 10000)));
      }
    }

    // 53-bit strictly-monotonic global OUTPUT cursor (advances by n every running
    // quantum, independent of ring swaps — Phase 5 maps sample→ctx time for onBar).
    this.outFrames += n;
    Atomics.store(ctrl, C_READ_LO, this.outFrames >>> 0);
    Atomics.store(ctrl, C_READ_HI, Math.floor(this.outFrames / 0x100000000));
    if (under) { Atomics.store(ctrl, C_UNDERRUN, 1); Atomics.add(ctrl, C_UNDER_CNT, 1); }
    return true;
  }
}

registerProcessor("ring-player", RingPlayer);
