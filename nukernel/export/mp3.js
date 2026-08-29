// nukernel/export/mp3.js — the MP3 writer over the SAME press (2026-08-29).
//
// export/wav.js `pressPcm` renders the record once, whole, to 44.1k stereo
// float; this file hands that buffer to a worker that encodes it with the
// vendored lamejs (engine/faust/vendor/lamejs.min.js, LGPL-3.0, in the tree —
// nothing is fetched from a network at runtime). FUTURE.md's shape: "one
// extraction with four writers". The record is never pressed twice, and the
// choreography that drives the stream worker lives in ONE file, not two.
//
// THE BITRATE: 192 kbps, CBR, 44.1 kHz, stereo — and every word of that is
// forced or argued, not defaulted by accident.
//   • 192 because this is a LISTENING COPY, not a master. The WAV button on
//     the same row is the master (16-bit, lossless, ~10 MB/min); the MP3 is
//     the one you mail somebody or put on a phone, at ~1.4 MB/min. 192 CBR is
//     the rate where lame stops being audibly busy on dense synthetic stereo
//     — and this box makes dense synthetic stereo — while 320 would cost 66%
//     more bytes for a difference the WAV already covers for anyone who
//     cares. It is also the rate the phone's live stream already runs at
//     (engine/faust/codec/mp3-worker.js `m.kbps || 192`), so a record sounds
//     the same coming out of the box as it did going through it.
//   • CBR because lamejs GIVES US NO CHOICE, and that is worth saying plainly
//     rather than implying a decision. `lamejs.Mp3Encoder(channels, sr, kbps)`
//     is the whole of the 1.2.1 API surface; inside it the build fixes
//     `brate=kbps`, `mode=STEREO`, `quality=3`, `bWriteVbrTag=false` and
//     `disable_reservoir=true`. There is no exposed `lame_set_VBR`, so VBR
//     (which is what one would otherwise prefer for a listening copy — same
//     quality, fewer bytes) is not reachable without editing vendored LGPL
//     source, which this repo does not do. Two consequences are honest to
//     name: the stream is FULL stereo, not joint stereo, so it spends bits on
//     L/R independence a joint-stereo encoder would save; and it carries no
//     Xing/Info header, which is harmless for CBR (players compute duration
//     from the constant rate) but means no gapless delay/padding tags — see
//     the frames note below.
//   • The card on the export row says exactly this, because a card that says
//     "320 kbps" over a 192 kbps encoder is the same lie as a dead button.
//
// FRAMES: MP3 is framed in 1152-sample granule pairs and lame's encoder delay
// is not tagged (no Xing/LAME header, above), so a decoded MP3 is a little
// LONGER than the PCM that went in — the delay at the head plus padding out to
// the last whole frame. test/mp3.test.js measures that difference against the
// WAV press and states its tolerance in frames rather than pretending it is
// zero.
import { pressPcm } from "./wav.js";

const SR = 44100;
export const KBPS = 192;                       // see THE BITRATE, above
const WORKER = new URL("./mp3-encode-worker.js", import.meta.url).href;

/**
 * pressMp3(onSay?) -> Promise<{ bytes: ArrayBuffer, frames, durSec, songSec, kbps }>
 * Presses the CURRENT record once and writes it as one MP3. `onSay` is the
 * same channel the WAV button reports on, so the card can keep talking
 * through both halves of the job (the press, then the encode).
 */
export async function pressMp3(onSay) {
  const say = (t) => { try { if (onSay) onSay(t); } catch (e) {} };
  const { L, R, frames, songSec } = await pressPcm(onSay);

  say("encoding " + KBPS + " kbps MP3 — 0%");
  const worker = new Worker(WORKER, { type: "module" });
  try {
    const bytes = await new Promise((resolve, reject) => {
      worker.onerror = (e) => reject(new Error("mp3 worker: " + ((e && e.message) || e)));
      worker.onmessage = (e) => {
        const m = e.data || {};
        if (m.type === "prog") {
          say("encoding " + KBPS + " kbps MP3 — " +
              Math.floor((m.done / Math.max(1, m.total)) * 100) + "%");
        } else if (m.type === "mp3") { resolve(m.bytes); }
        else if (m.type === "fail") { reject(new Error(m.error)); }
      };
      // TRANSFERRED, not copied: `pressPcm` allocates these two arrays fresh
      // per press and this writer is their only reader, so handing the memory
      // over costs nothing and saves a second copy of a multi-minute record.
      worker.postMessage({ type: "encode", L: L.buffer, R: R.buffer, kbps: KBPS },
                         [L.buffer, R.buffer]);
    });
    return { bytes, frames, durSec: frames / SR, songSec, kbps: KBPS };
  } finally { worker.terminate(); }
}
