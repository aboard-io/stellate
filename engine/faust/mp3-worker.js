// faust/mp3-worker.js — the DEDICATED ENCODER worker (WAV-FIRST v3; v4 generalized).
//
// One instance per exploreLiveWav stream, spawned ALONGSIDE the two producer stream-
// workers. It owns the SINGLE encoder for the whole stream lifetime and performs the
// gen-bridge PCM crossfade — because the producers ping-pong per gen and are re-opened on
// every sig change, no producer outlives the stream, so the encoder can't live in one;
// the conductor routes both gens' clean PCM here IN TIMELINE ORDER and this worker
// stitches + encodes them into one continuous bitstream. Encoding is kept OFF the main
// thread so it never janks SourceBuffer updateend serialization / timeupdate / MediaSession.
//
// TWO modes over the SAME blend (faust/mp3-stream.js makePcmStitch — the held-tail /
// gen-bridge / boot machinery, extracted from the encode so both codecs get byte-identical
// PCM + rms/bar accounting):
//   • "mp3" (v3): one lamejs Mp3Encoder → audio/mpeg. Posts {mp3chunk}.
//   • "wc"  (v4): a WebCodecs AudioEncoder (AAC 'mp4a.40.2' for the device, Opus fallback)
//     → the fMP4 muxer (faust/fmp4.js). Posts {mp4init} once, then {mp4seg} mirroring the
//     mp3chunk fields (bytes/encFrames/baseFrame/rmsEnv/rmsHop/bars) so the conductor's
//     growEnv/gBars/appendedSec generalize with no per-codec branching. fMP4 fragments
//     carry an EXPLICIT tfdt — the structural cure for the mms-mp3 device lurch.
//
// MESSAGES in:
//   {type:"init"}                                  -> load deps + probe AudioEncoder, "mp3ready" {enc:{aac,opus}}
//   {type:"mp3open", kbps, overlapSec}             -> new lamejs stream (mp3 mode)
//   {type:"encopen", codec, kbps, overlapSec}      -> new WebCodecs+fMP4 stream (wc mode)
//   {type:"mp3pcm", gen, L, R, n, bridge, boot, barMap}  (L/R transferred ArrayBuffers) — generic PCM feed
//   {type:"mp3flush", gen}                         -> emit encoder tail (stream end)
//   {type:"mp3close"}                              -> drop the stream
// POSTS:
//   {type:"mp3ready", enc} · {type:"mp3fail", error} ·
//   {type:"mp3chunk", gen, bytes, baseFrame, encFrames, rmsEnv, rmsHop, bars, sr, final} (mp3 mode) ·
//   {type:"mp4init", bytes, codec, sr} · {type:"mp4seg", gen, bytes, baseFrame, encFrames, rmsEnv, rmsHop, bars, sr, final} (wc mode)
"use strict";
const SR = 44100;
let MK = null, MKSTITCH = null, MKFMP4 = null, STRIP_ADTS = null, SYNTH_ASC = null, SR_INDEX = null;

async function initDeps() {
  const BASE = new URL(".", self.location.href).href;   // .../faust/
  await import(BASE + "vendor/lamejs.min.js");           // -> self.lamejs
  await import(BASE + "mp3-stream.js");                   // -> self.FaustMp3Stream
  await import(BASE + "fmp4.js");                         // -> self.FaustFmp4
  MK = self.FaustMp3Stream.makeMp3Stream;
  MKSTITCH = self.FaustMp3Stream.makePcmStitch;
  MKFMP4 = self.FaustFmp4.makeFmp4Mux;
  STRIP_ADTS = self.FaustFmp4.stripAdts;
  SYNTH_ASC = self.FaustFmp4.synthAsc;
  SR_INDEX = self.FaustFmp4.srIndexFor;
  if (!self.lamejs || !self.lamejs.Mp3Encoder) throw new Error("lamejs did not load");
}

// probe WebCodecs AudioEncoder support IN THE WORKER (what actually matters — the
// conductor picks the route from this, not from a main-thread typeof). AAC is the device
// target, Opus the linux-chromium gate route.
async function probeEncoders() {
  const caps = { aac: false, opus: false };
  if (typeof AudioEncoder === "undefined") return caps;
  const chk = async (codec) => { try { const r = await AudioEncoder.isConfigSupported({ codec, sampleRate: SR, numberOfChannels: 2, bitrate: 192000 }); return !!(r && r.supported); } catch (e) { return false; } };
  caps.aac = await chk("mp4a.40.2");
  caps.opus = await chk("opus");
  return caps;
}

// ── mode state ──
let mode = null;          // "mp3" | "wc"
let stream = null;        // mp3 mode: makeMp3Stream
let stitch = null, encoder = null, mux = null, codecName = null;   // wc mode
let outQ = [], pendingAccts = [], decoderConfig = null, frameCounter = 0, curGen = 0, frameUs = 20000;
let curEpoch = 0;                    // encoder-stream generation (bumped per encopen/mp3open);
                                     // echoed on every output so a stale post from a superseded
                                     // codec (after a runtime step-down) can be dropped upstream.
let adtsSeen = false, adtsHeader = null;   // wc/aac: set once an ADTS-framed chunk is seen +
                                     // stripped; adtsHeader is the ASC source (profile/sr/ch).
let drainTimer = 0;       // periodic drain: AudioEncoder output is async, so a fragment must
                          // be flushed on a timer, NOT only when the next push arrives (the
                          // producer stops feeding under backpressure → a push-only drain
                          // would strand the final frames and never make a first append).

function resetWc() { if (drainTimer) { clearInterval(drainTimer); drainTimer = 0; } try { if (encoder && encoder.state !== "closed") encoder.close(); } catch (e) {} encoder = null; stitch = null; mux = null; outQ = []; pendingAccts = []; decoderConfig = null; frameCounter = 0; codecName = null; adtsSeen = false; adtsHeader = null; }

// wc: collect one encoded frame. decoderConfig (init-segment source) rides the FIRST output.
// AAC only: iOS emits ADTS-framed packets — detect the 0xFFF sync and strip the 7/9-byte
// header(s) to the raw access unit before muxing (Opus has no ADTS framing, so it is left
// untouched). The first ADTS header seen is remembered as the ASC source for the esds.
function onEncoded(chunk, meta) {
  if (meta && meta.decoderConfig && !decoderConfig) decoderConfig = meta.decoderConfig;
  let buf = new Uint8Array(chunk.byteLength); chunk.copyTo(buf);
  if (codecName === "aac" && STRIP_ADTS) {
    const s = STRIP_ADTS(buf);
    if (s.adts) { buf = s.raw; adtsSeen = true; if (!adtsHeader) adtsHeader = s.header; }
  }
  const durUs = chunk.duration != null ? chunk.duration : frameUs;
  const tsUs = chunk.timestamp != null ? chunk.timestamp : 0;
  outQ.push({ data: buf, duration: Math.round(durUs * SR / 1e6), timestamp: Math.round(tsUs * SR / 1e6) });
}

// wc: emit ONE moof+mdat fragment from whatever encoded frames have accumulated, plus the
// PCM-side accounting collected since the last fragment (merged; contiguous by construction).
function drainFragment(final) {
  if (!outQ.length) return;
  if (!mux) {
    const desc = decoderConfig && decoderConfig.description;
    const descBytes = desc ? new Uint8Array(desc.buffer || desc) : null;
    const descPresent = !!(descBytes && descBytes.length);
    // ASC/config bytes preference: (1) the encoder's decoderConfig.description — for AAC
    // normalized through extractAsc (iOS hands back a ~39-byte ES_Descriptor, not the bare
    // 2-byte ASC; embedding it verbatim kills the mms-aac SourceBuffer on device);
    // (2) for AAC with no description, synthesize the ASC from the parsed ADTS header when
    // we saw one, else from the configured rate/channels; (3) Opus always ships its dOps
    // from the OpusHead description, so an absent one falls through to the muxer default.
    let cfgBytes;
    if (codecName === "aac" && self.FaustFmp4.extractAsc) cfgBytes = self.FaustFmp4.extractAsc(
      descPresent ? descBytes : (adtsHeader ? SYNTH_ASC(adtsHeader.objectType, adtsHeader.srIndex, adtsHeader.chanConfig) : null), SR, 2);
    else if (descPresent) cfgBytes = descBytes;
    else cfgBytes = new Uint8Array(0);
    mux = MKFMP4({ codec: codecName, sampleRate: SR, channels: 2, codecConfig: cfgBytes });
    const initSeg = mux.initSegment();
    const ib = initSeg.buffer.slice(initSeg.byteOffset, initSeg.byteOffset + initSeg.byteLength);
    // diagnostics (WAV-FIRST v4.1 item 4): the conductor builds the mp4diag line from these.
    self.postMessage({ type: "mp4init", bytes: ib, codec: codecName, sr: SR, epoch: curEpoch,
      descPresent, descBytes: descBytes ? descBytes.length : 0, adts: !!adtsSeen,
      ascBytes: cfgBytes ? cfgBytes.length : 0 }, [ib]);
  }
  const chunks = outQ; outQ = [];
  const frag = mux.pushChunks(chunks);
  let muxSamples = 0; for (const c of chunks) muxSamples += c.duration;
  // accounting: merge the pending pushes' envelopes/bars (usually exactly one).
  const accts = pendingAccts; pendingAccts = [];
  let baseFrame = 0, rmsHop = Math.floor(SR / 10), rmsEnv = new Float32Array(0), bars = [];
  if (accts.length) {
    baseFrame = accts[0].baseFrame; rmsHop = accts[0].rmsHop;
    let tot = 0; for (const a of accts) tot += a.rmsEnv.length;
    rmsEnv = new Float32Array(tot); let o = 0;
    for (const a of accts) { rmsEnv.set(a.rmsEnv, o); o += a.rmsEnv.length; if (a.bars.length) bars = bars.concat(a.bars); }
  }
  const fb = frag.buffer.slice(frag.byteOffset, frag.byteOffset + frag.byteLength);
  self.postMessage({ type: "mp4seg", gen: curGen, bytes: fb, baseFrame, encFrames: muxSamples,
    rmsEnv, rmsHop, bars, sr: SR, final: !!final, epoch: curEpoch }, [fb, rmsEnv.buffer]);
}

self.onmessage = async (e) => {
  const m = e.data; if (!m || !m.type) return;
  if (m.type === "init") {
    try { await initDeps(); const enc = await probeEncoders(); self.postMessage({ type: "mp3ready", enc }); }
    catch (err) { self.postMessage({ type: "mp3fail", error: String(err && err.message || err) }); }
    return;
  }
  if (m.type === "mp3open") {
    try {
      resetWc();
      curEpoch = m.epoch | 0;
      const OV = Math.max(1, Math.round((m.overlapSec > 0 ? m.overlapSec : 0.120) * SR));
      stream = MK({ lamejs: self.lamejs, SR, kbps: m.kbps || 192, channels: 2, overlapSamples: OV });
      mode = "mp3";
    } catch (err) { self.postMessage({ type: "mp3fail", error: String(err && err.message || err) }); }
    return;
  }
  if (m.type === "encopen") {
    try {
      stream = null; resetWc();
      curEpoch = m.epoch | 0;
      const OV = Math.max(1, Math.round((m.overlapSec > 0 ? m.overlapSec : 0.120) * SR));
      codecName = m.codec === "aac" ? "aac" : "opus";
      frameUs = codecName === "aac" ? Math.round(1024 / SR * 1e6) : 20000;
      stitch = MKSTITCH({ SR, overlapSamples: OV });
      encoder = new AudioEncoder({ output: onEncoded, error: (err) => self.postMessage({ type: "mp3fail", error: "AudioEncoder: " + String(err && err.message || err) }) });
      encoder.configure({ codec: codecName === "aac" ? "mp4a.40.2" : "opus", sampleRate: SR, numberOfChannels: 2, bitrate: (m.kbps || 192) * 1000 });
      mode = "wc";
      drainTimer = setInterval(() => { if (mode === "wc" && outQ.length) drainFragment(false); }, 120);
    } catch (err) { self.postMessage({ type: "mp3fail", error: "encopen: " + String(err && err.stack || err) }); }
    return;
  }
  if (m.type === "mp3pcm") {
    try {
      const L = new Float32Array(m.L), R = new Float32Array(m.R);
      curGen = m.gen | 0;
      if (mode === "mp3") {
        if (!stream) return;
        const r = stream.push(L, R, { bridge: !!m.bridge, boot: !!m.boot, barMap: m.barMap || [] });
        const bytes = r.bytes.buffer.slice(r.bytes.byteOffset, r.bytes.byteOffset + r.bytes.byteLength);
        self.postMessage({ type: "mp3chunk", gen: m.gen | 0, bytes, baseFrame: r.baseFrame, encFrames: r.encFrames,
          rmsEnv: r.rmsEnv, rmsHop: r.rmsHop, bars: r.bars, sr: SR, epoch: curEpoch }, [bytes, r.rmsEnv.buffer]);
      } else if (mode === "wc") {
        if (!stitch || !encoder) return;
        const w = stitch.push(L, R, { bridge: !!m.bridge, boot: !!m.boot, barMap: m.barMap || [] });
        if (w.n > 0) {
          const inter = new Float32Array(2 * w.n);
          inter.set(w.L.subarray(0, w.n), 0); inter.set(w.R.subarray(0, w.n), w.n);
          const ts = Math.round(frameCounter / SR * 1e6);
          const ad = new AudioData({ format: "f32-planar", sampleRate: SR, numberOfFrames: w.n, numberOfChannels: 2, timestamp: ts, data: inter });
          encoder.encode(ad); try { ad.close(); } catch (e) {}
          frameCounter += w.n;
          pendingAccts.push({ baseFrame: w.baseFrame, rmsEnv: w.rmsEnv, rmsHop: w.rmsHop, bars: w.bars });
        }
        // drain the PRIOR push's now-available encoded frames into a fragment (natural
        // one-push lag; no per-fragment flush → no re-primed encoder-delay gaps).
        drainFragment(false);
      }
    } catch (err) { self.postMessage({ type: "mp3fail", error: String(err && err.stack || err) }); }
    return;
  }
  if (m.type === "mp3flush") {
    try {
      if (mode === "mp3") {
        if (!stream) return;
        const t = stream.tail();
        const bytes = t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength);
        self.postMessage({ type: "mp3chunk", gen: m.gen | 0, bytes, baseFrame: stream.emitted(), encFrames: 0,
          rmsEnv: new Float32Array(0), rmsHop: Math.floor(SR / 10), bars: [], sr: SR, final: true, epoch: curEpoch }, [bytes]);
      } else if (mode === "wc") {
        if (!stitch || !encoder) return;
        const t = stitch.tail();
        if (t.n > 0) {
          const inter = new Float32Array(2 * t.n);
          inter.set(t.L.subarray(0, t.n), 0); inter.set(t.R.subarray(0, t.n), t.n);
          const ts = Math.round(frameCounter / SR * 1e6);
          const ad = new AudioData({ format: "f32-planar", sampleRate: SR, numberOfFrames: t.n, numberOfChannels: 2, timestamp: ts, data: inter });
          encoder.encode(ad); try { ad.close(); } catch (e) {}
          frameCounter += t.n;
        }
        try { await encoder.flush(); } catch (e) {}
        drainFragment(true);
      }
    } catch (err) { self.postMessage({ type: "mp3fail", error: String(err && err.stack || err) }); }
    return;
  }
  if (m.type === "mp3close") { stream = null; resetWc(); mode = null; return; }
};
