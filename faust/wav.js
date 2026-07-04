"use strict";
// faust/wav.js — shared RIFF/WAVE (16-bit PCM) header builder + float->int16
// quantizer for the two node-side WAV writers: press.js (whole-song write) and
// genre-kernel djMix (streaming mix writer, header backpatched on close).
//
// THE TWO QUANTIZERS DELIBERATELY DIFFER AND ARE NOT UNIFIED. press.js has
// always truncated toward zero (`* 32767 | 0`), djMix has always rounded to
// nearest (Math.round) with a hard int16 clamp. Both feed determinism gates /
// committed fixtures, so a silent unification would move rendered bytes for one
// of them. `mode` selects between them — keep both, on purpose.

const CLAMP_LO = -32768, CLAMP_HI = 32767;

// float sample in [-1,1] (clamped) -> int16 sample value.
//   mode "trunc": truncate toward zero — press.js's legacy `*32767|0`.
//   mode "round": round to nearest + hard int16 clamp — djMix's writer.
function toInt16(v, mode) {
  const s = Math.max(-1, Math.min(1, v));
  return mode === "round"
    ? Math.max(CLAMP_LO, Math.min(CLAMP_HI, Math.round(s * 32767)))
    : (s * 32767) | 0;
}

// canonical 44-byte PCM header for `dataLength` bytes of 16-bit `channels`-ch
// audio at `sampleRate`. Streaming writers pass dataLength 0 and backpatch the
// RIFF size (@4) and data size (@40) on close.
function header(sampleRate, channels, dataLength) {
  const blockAlign = channels * 2;   // 16-bit samples
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + dataLength, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * blockAlign, 28);
  h.writeUInt16LE(blockAlign, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(dataLength, 40);
  return h;
}

module.exports = { toInt16, header };
