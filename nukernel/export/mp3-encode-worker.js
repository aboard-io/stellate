// nukernel/export/mp3-encode-worker.js — the ONE-SHOT MP3 encoder, off the
// main thread (2026-08-29).
//
// WHY A SECOND WORKER, when engine/faust/codec/mp3-worker.js already encodes
// MP3: that one is STREAM-shaped and must stay that way. It owns a single
// encoder for the lifetime of a live stream whose two producer workers
// ping-pong per gen, it crossfades a held tail across the gen bridge, it keeps
// absolute frame accounting for the media element's clock, and it has a second
// WebCodecs/fMP4 mode hanging off the same protocol. None of that is true of a
// press: the press hands over ONE finished stereo buffer, whole, once, and
// wants bytes back. Bending the stream worker into a one-shot would have made
// its protocol lie about what outlives what. What IS shared is the thing worth
// sharing — the vendored encoder and the sample quantization (`f2i` below is
// engine/faust/codec/mp3-stream.js's, quoted) — plus the law both files obey:
// ENCODING NEVER RUNS ON THE MAIN THREAD. The live path keeps it off-thread so
// the media pump never janks; the press keeps it off-thread because a
// multi-minute record is tens of seconds of lame and the page would be a brick
// for all of them (the say-channel below would freeze mid-sentence).
//
// OFFLINE: lamejs is imported from the tree (engine/faust/vendor), never a CDN.
//
// IN:   {type:"encode", L, R (transferred ArrayBuffers of Float32), kbps}
// OUT:  {type:"prog", done, total} · {type:"mp3", bytes (transferred), frames}
//       {type:"fail", error}
"use strict";
const SR = 44100;
const LAME = new URL("../../engine/faust/vendor/lamejs.min.js", self.location.href).href;

// engine/faust/codec/mp3-stream.js f2i, verbatim — the asymmetric float→int16
// the live MP3 already uses, so the same PCM lands on the same lame input on
// both routes. (export/wav.js's WAV writer truncates with `|0` instead; the
// difference is under one LSB and it is the WAV's own long-standing shape.)
function f2i(x) { const v = x < 0 ? x * 32768 : x * 32767; return v < -32768 ? -32768 : v > 32767 ? 32767 : Math.round(v); }

self.onmessage = async (e) => {
  const m = e.data || {};
  if (m.type !== "encode") return;
  try {
    await import(LAME);                                   // -> self.lamejs
    if (!self.lamejs || !self.lamejs.Mp3Encoder) throw new Error("lamejs did not load");
    const L = new Float32Array(m.L), R = new Float32Array(m.R);
    const n = Math.min(L.length, R.length);
    const enc = new self.lamejs.Mp3Encoder(2, SR, m.kbps || 192);

    // 1152 samples is one MPEG-1 Layer III granule pair — the encoder's own
    // frame — so every block is a whole number of frames and nothing is
    // buffered across a progress tick for the wrong reason. 64 of them is
    // ~1.7 s of audio per call: long enough that the per-call overhead is
    // noise, short enough that a long record still says something every few
    // hundred milliseconds.
    const BLOCK = 1152 * 64;
    const l16 = new Int16Array(BLOCK), r16 = new Int16Array(BLOCK);
    const parts = [];
    let bytes = 0, said = -1;
    for (let off = 0; off < n; off += BLOCK) {
      const len = Math.min(BLOCK, n - off);
      for (let i = 0; i < len; i++) { l16[i] = f2i(L[off + i]); r16[i] = f2i(R[off + i]); }
      const out = enc.encodeBuffer(l16.subarray(0, len), r16.subarray(0, len));
      if (out && out.length) {
        parts.push(new Uint8Array(out.buffer, out.byteOffset, out.length).slice());
        bytes += out.length;
      }
      const pct = Math.floor(((off + len) / n) * 100);
      if (pct !== said) { said = pct; self.postMessage({ type: "prog", done: off + len, total: n }); }
    }
    const tail = enc.flush();              // the last partial frame + the encoder's own tail
    if (tail && tail.length) {
      parts.push(new Uint8Array(tail.buffer, tail.byteOffset, tail.length).slice());
      bytes += tail.length;
    }
    const all = new Uint8Array(bytes);
    let o = 0;
    for (const p of parts) { all.set(p, o); o += p.length; }
    self.postMessage({ type: "mp3", bytes: all.buffer, frames: n }, [all.buffer]);
  } catch (err) {
    self.postMessage({ type: "fail", error: String((err && err.message) || err) });
  }
};
