// faust/mp3-stream.js — the SINGLE-ENCODER continuous MP3 append core (WAV-FIRST v3).
//
// One lamejs Mp3Encoder instance for the WHOLE stream lifetime, fed a single
// continuous stereo PCM timeline. The producers (two stream-workers, ping-ponged
// per gen) each render clean PCM flushes; this core stitches them into ONE timeline
// and encodes it with ONE encoder, so the audio/mpeg SourceBuffer never sees an
// encoder reset or a per-chunk encoder-delay gap. Env-agnostic + injected (lamejs
// arrives via opts), so the SAME code runs in faust/mp3-worker.js (module Worker)
// and in node for the gates (faust/wavout-seam-test.js gate 5).
//
// GEN BRIDGES (the crossfade). The encoder holds the last OV samples of the timeline
// un-encoded (`held`) as lookahead. A NORMAL push continues the same gen: encode
// held++in minus a fresh OV tail. A BRIDGE push (first flush of a new gen) crossfades
// its first OV against `held` (= the OLD gen's tail) constant-gain — g_in[j]=(j+.5)/OV,
// g_out[j]=(OV-.5-j)/OV, sum ≡ 1 — so the blended OV replaces the seam and the stream
// stays sample-continuous THROUGH the gen change (WAV-FIRST v2's bridge, reconstructed
// in PCM before the one encoder instead of at the media layer). BOOT (very first push)
// gets a ~5ms micro fade-in from silence. Because `held` carries the old tail, the
// conductor never manages OV itself — it just tags the first post-switch flush bridge.
//
// Absolute frame accounting: `emittedFrames` counts only actually-encoded frames;
// the logical write head is emittedFrames+held.length. barMap offsets (relative to a
// flush's first sample) are converted to ABSOLUTE timeline frames here, so the
// conductor's rms()/onBar read a single global timeline aligned with element time.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.FaustMp3Stream = factory();
})(typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : globalThis), function () {
  "use strict";

  function f2i(x) { const v = x < 0 ? x * 32768 : x * 32767; return v < -32768 ? -32768 : v > 32767 ? 32767 : Math.round(v); }

  // ── makePcmStitch — the BLEND, extracted from the encode (WAV-FIRST v4). ──────
  // Stitches the two producers' clean PCM flushes into ONE continuous stereo timeline
  // (held-tail lookahead, gen-bridge crossfade, boot micro-fade) and does the absolute-
  // frame accounting (baseFrame, rmsEnv, barMap→absolute frames). It emits NO codec bytes
  // — its output is the blended Float32 window ready for ANY encoder. makeMp3Stream wraps
  // it with lamejs; the WebCodecs (AAC/Opus → fMP4) path feeds the same window to an
  // AudioEncoder, so the bridge/boot/micro-fade semantics + rms/bar accounting are
  // byte-identical across codecs (the seam gate proves the PCM, once, for all of them).
  function makePcmStitch(opts) {
    const SR = opts.SR || 44100;
    const OV = Math.max(1, opts.overlapSamples || Math.round(0.120 * SR));
    const ME = Math.max(1, opts.microFadeSamples || Math.round(0.005 * SR));
    const RMS_HOP = Math.max(1, Math.floor(SR / 10));
    let heldL = null, heldR = null;      // last OV of the timeline, un-emitted (bridge lookahead)
    let emittedFrames = 0;               // frames actually released downstream (encoded)

    function rmsEnvOf(L, R, n) {
      const nEnv = Math.max(1, Math.ceil(n / RMS_HOP)), env = new Float32Array(nEnv);
      for (let k = 0; k < nEnv; k++) {
        const a = k * RMS_HOP, b = Math.min(n, a + RMS_HOP);
        let s = 0; for (let i = a; i < b; i++) { const m = (L[i] + R[i]) * 0.5; s += m * m; }
        env[k] = Math.sqrt(s / Math.max(1, b - a));
      }
      return env;
    }

    // push one clean PCM flush (Float32 L,R of length n) onto the continuous timeline.
    // Returns the blended window { L, R, n } (READ ONLY the first n samples of L/R) plus
    // its accounting. n==0 → nothing to release yet (all held as lookahead).
    // opts: { bridge, boot, barMap:[{off,meta}] } — as before.
    function push(inL, inR, o) {
      o = o || {};
      const n = inL.length;
      const inBaseAbs = o.bridge ? emittedFrames : emittedFrames + (heldL ? heldL.length : 0);

      let combL, combR, combN;
      if (o.bridge && heldL && heldL.length) {
        const bl = Math.min(OV, heldL.length, n);
        combN = n; combL = new Float32Array(combN); combR = new Float32Array(combN);
        for (let j = 0; j < bl; j++) {
          const gin = (j + 0.5) / OV, gout = (OV - 0.5 - j) / OV;
          combL[j] = heldL[j] * gout + inL[j] * gin;
          combR[j] = heldR[j] * gout + inR[j] * gin;
        }
        combL.set(inL.subarray(bl), bl); combR.set(inR.subarray(bl), bl);
      } else {
        const h = heldL ? heldL.length : 0;
        combN = h + n; combL = new Float32Array(combN); combR = new Float32Array(combN);
        if (h) { combL.set(heldL, 0); combR.set(heldR, 0); }
        combL.set(inL, h); combR.set(inR, h);
      }
      if (o.boot) { const m = Math.min(ME, combN); for (let i = 0; i < m; i++) { const g = (i + 0.5) / m; combL[i] *= g; combR[i] *= g; } }

      const combBaseAbs = emittedFrames;                    // combined[0] sits at emittedFrames
      const newHeld = Math.min(OV, combN);
      const encN = combN - newHeld;                         // hold the final OV back as lookahead
      const rmsEnv = encN > 0 ? rmsEnvOf(combL, combR, encN) : new Float32Array([0]);
      heldL = combL.slice(combN - newHeld); heldR = combR.slice(combN - newHeld);
      emittedFrames += encN;

      const barMap = (o.barMap || []).map((e) => ({ frame: inBaseAbs + (e.off | 0), meta: e.meta || null }));
      return { L: combL, R: combR, n: encN, baseFrame: combBaseAbs, rmsEnv, rmsHop: RMS_HOP, bars: barMap };
    }

    // release the held tail (stream end). Returns { L, R, n } (n may be 0).
    function tail() {
      const L = heldL, R = heldR, n = heldL ? heldL.length : 0;
      if (n) emittedFrames += n;
      heldL = heldR = null;
      return { L: L || new Float32Array(0), R: R || new Float32Array(0), n };
    }

    return { push, tail, OV, emitted: () => emittedFrames, sampleRate: SR, RMS_HOP };
  }

  function makeMp3Stream(opts) {
    const lamejs = opts.lamejs;
    const SR = opts.SR || 44100;
    const kbps = opts.kbps || 192;
    const channels = opts.channels || 2;
    if (!lamejs || !lamejs.Mp3Encoder) throw new Error("makeMp3Stream: lamejs.Mp3Encoder missing");

    const enc = new lamejs.Mp3Encoder(channels, SR, kbps);
    const stitch = makePcmStitch(opts);   // the shared blend (byte-identical PCM to the fMP4 path)

    // encode a Float32 stereo window -> Int8 mp3 bytes (one continuous encoder call)
    function encodeWin(L, R, n) {
      const l16 = new Int16Array(n), r16 = new Int16Array(n);
      for (let i = 0; i < n; i++) { l16[i] = f2i(L[i]); r16[i] = f2i(R[i]); }
      const out = enc.encodeBuffer(l16, r16);   // Int8Array (whole MP3 frames; leftover buffered internally)
      return out && out.length ? new Uint8Array(out.buffer, out.byteOffset, out.length).slice() : new Uint8Array(0);
    }

    function push(inL, inR, o) {
      const w = stitch.push(inL, inR, o);
      const bytes = w.n > 0 ? encodeWin(w.L, w.R, w.n) : new Uint8Array(0);
      return { bytes, encFrames: w.n, baseFrame: w.baseFrame, rmsEnv: w.rmsEnv, rmsHop: w.rmsHop, bars: w.bars };
    }

    // encode + return whatever the encoder has buffered plus the held tail (stream end).
    function tail() {
      const t = stitch.tail();
      let out = t.n ? encodeWin(t.L, t.R, t.n) : new Uint8Array(0);
      const f = enc.flush();
      const fb = f && f.length ? new Uint8Array(f.buffer, f.byteOffset, f.length).slice() : new Uint8Array(0);
      if (!out.length) return fb;
      const cat = new Uint8Array(out.length + fb.length); cat.set(out, 0); cat.set(fb, out.length); return cat;
    }

    return { push, tail, OV: stitch.OV, emitted: () => stitch.emitted(), sampleRate: SR };
  }

  return { makeMp3Stream, makePcmStitch };
});
