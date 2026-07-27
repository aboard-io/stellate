// faust/sentinel-processor.js — the CLICK SENTINEL (Stage 0.B output truth).
//
// A plain hand-written AudioWorkletProcessor — NOT Faust — that sits as a
// pure SINK tapped off the master gain (live.js, opts.debugSentinel). It
// measures the rendered signal ON the audio thread, per 1-second window:
//   clicks — sample-to-sample deltas beyond an ADAPTIVE threshold:
//            max(0.5, 3 × edgeBar), where edgeBar is an INSTANT-ATTACK /
//            SLOW-RELEASE (~4s) peak hold over the per-128-sample-block max
//            |delta| — the program's own "edge character". The fixed 0.5 bar
//            was useless as a zero-gate on edgy program (303 / jungle breaks
//            fired it ~1400 times in 2 minutes of ordinary music); a
//            symmetric slow EMA fails too (break transients are SPARSE, the
//            mean sat ~0.15 and jungle onsets at |delta| ~0.7 beat the 0.5
//            floor, ~600/leg), and even a fast-attack τ0.25s follower left
//            acidhouse's isolated kick/accent onsets firing ~200/leg (both
//            measured over a soak). Peak hold makes it a NOVELTY
//            detector: the FIRST edgy block of a phrase is judged against
//            the OLD bar (a genuinely isolated discontinuity in smooth
//            program still counts), every repeat inside the ~4s release
//            window is recognized as program. Smooth/pad program decays back
//            to the sensitive 0.5 floor in seconds.
//            TRADEOFF, stated plainly: on edge-heavy program the click
//            detector's sensitivity degrades by construction (a real glitch
//            hides under a 3× bar that squares/breaks have pushed up) — there
//            the gaps + renderCapacity-underrun channels carry the gate;
//            clicks remain the sharp instrument on the smooth program where
//            they were trustworthy to begin with.
//   gaps   — runs of EXACT-zero samples >= 128 long while the recent program
//            was loud (250ms running RMS > 0.01): silence inside loud music
//            is a dropout, not a rest. Exact zero matters: real audio through
//            the fx bus dithers around zero, only a starved/killed render
//            path emits true zeros.
//   peak   — running |sample| max (clip forensics come free).
// Every ~1s it posts {clicks, gaps, peak} on the port and resets. Per-sample
// work is a handful of compares + one multiply-add (the RMS EMA); nothing
// allocates in process(). Clicks/peak scan every channel — mono taps lie, as a
// hard-left bug will demonstrate; the gap/RMS detector reads ch 0
// (a dropout starves all channels together).
class GlitchSentinel extends AudioWorkletProcessor {
  constructor() {
    super();
    this.lastCh = [0, 0, 0, 0, 0, 0, 0, 0];   // per-channel previous sample
    this.clicks = 0; this.gaps = 0; this.peak = 0;
    this.edgeEma = 0;                          // peak HOLD over per-block max |delta| (instant attack, ~4s release)
    this.zeroRun = 0;
    this.rmsSq = 0;                            // EMA of x^2, ~250ms time constant
    this.alpha = 1 / (0.25 * sampleRate);
    this.winSamples = 0;
    this.winLen = sampleRate;                  // 1-second reporting window
  }
  process(inputs) {
    const chans = inputs[0];
    if (!chans || !chans.length) return true;  // no input this block: nothing to judge
    const n = chans[0].length;
    // adaptive click bar for THIS block, from the EMA as of the previous
    // block (the lag is the point: a glitch spike must not raise its own bar)
    const thr = this.edgeEma * 3 > 0.5 ? this.edgeEma * 3 : 0.5;
    let blockMax = 0;
    for (let c = 0; c < chans.length; c++) {
      const buf = chans[c];
      let last = this.lastCh[c];
      for (let i = 0; i < n; i++) {
        const x = buf[i];
        const d = x - last;
        const ad = d < 0 ? -d : d;
        if (ad > thr) this.clicks++;
        if (ad > blockMax) blockMax = ad;
        const ax = x < 0 ? -x : x;
        if (ax > this.peak) this.peak = ax;
        last = x;
      }
      this.lastCh[c] = last;
    }
    // peak hold: jump to a louder transient ceiling instantly (the block that
    // did it was already judged against the OLD bar above — novelty counts),
    // release over ~4s as the program calms down
    if (blockMax > this.edgeEma) this.edgeEma = blockMax;
    else this.edgeEma += (n / (4 * sampleRate)) * (blockMax - this.edgeEma);
    const ch0 = chans[0];
    let rmsSq = this.rmsSq;
    const a = this.alpha;
    for (let i = 0; i < n; i++) {
      const x = ch0[i];
      if (x === 0) {
        // count each gap ONCE, at the 128th zero — while the pre-gap program
        // was loud (the EMA barely decays across 128 samples ≈ 3ms)
        if (++this.zeroRun === 128 && rmsSq > 1e-4) this.gaps++;
      } else this.zeroRun = 0;
      rmsSq += a * (x * x - rmsSq);
    }
    this.rmsSq = rmsSq;
    this.winSamples += n;
    if (this.winSamples >= this.winLen) {
      this.port.postMessage({ clicks: this.clicks, gaps: this.gaps, peak: this.peak });
      this.clicks = 0; this.gaps = 0; this.peak = 0; this.winSamples = 0;
    }
    return true;
  }
}
registerProcessor("glitch-sentinel", GlitchSentinel);
