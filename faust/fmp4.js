// faust/fmp4.js — a hand-rolled audio-only FRAGMENTED-MP4 muxer (WAV-FIRST v4).
//
// Env-agnostic UMD (same shape as faust/mp3-stream.js) so the SAME code runs in
// faust/mp3-worker.js (the dedicated encoder worker) and in node for the box-walk gate
// (faust/fmp4-test.js). Given a codec + its config bytes it emits an ISO-BMFF init
// segment (ftyp + moov) once, then one moof+mdat FRAGMENT per encoded batch.
//
// WHY fMP4 (device diagnosis, WAV-FIRST.md v4): on mms-mp3 the device "lurches… the
// snare and lead and bass go out of whack over time." WebKit's audio/mpeg MSE stitching
// INFERS each append's timestamp from the MP3 frames and drifts. Every fMP4 fragment
// instead carries an EXPLICIT baseMediaDecodeTime (tfdt) in media timescale (= sample
// rate) — nothing is inferred, so nothing can drift. baseMediaDecodeTime is strictly
// monotonic by construction: the FIRST fragment is anchored at the first encoded chunk's
// own timestamp (read, NOT assumed 0 — that is the AAC-priming handling; see below), and
// every later fragment advances by the exact sum of the sample durations muxed so far.
//
// AAC PRIMING. AAC-LC carries ~2112 samples of encoder-delay priming. WebCodecs'
// AudioEncoder reports it through the timestamps of its own output chunks (they are the
// input timeline, delay included), so we do NOT force a 0-origin: the first fragment's
// tfdt = round(firstChunk.timestamp · timescale). We emit no edit list (edts/elst) —
// decoder pre-roll/priming is codec-standard and handled by the AAC decoder from the
// esds config; audio-only continuous playback needs no A/V-sync trim. Opus has no such
// delay (its pre-skip lives in dOps), so its first chunk timestamp is ~0 and tfdt is the
// plain cumulative sample count — exactly what the gate asserts.
//
// Boxes: ftyp, moov(mvhd, trak(tkhd, mdia(mdhd, hdlr, minf(smhd, dinf(dref),
// stbl(stsd(mp4a+esds | Opus+dOps), stts, stsc, stsz, stco)))), mvex(trex)); per fragment
// moof(mfhd, traf(tfhd[default-base-is-moof], tfdt[v1 64-bit], trun[per-sample dur+size]))
// + mdat. trun carries per-sample sizes and durations, so the final partial batch needs
// no special-casing and sum(trun sizes) == mdat payload by construction.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.FaustFmp4 = factory();
})(typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : globalThis), function () {
  "use strict";

  // ── byte helpers ──────────────────────────────────────────────────────────
  function str4(s) { return new Uint8Array([s.charCodeAt(0), s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3)]); }
  function u16(n) { return new Uint8Array([(n >>> 8) & 255, n & 255]); }
  function i16(n) { return u16(n & 0xffff); }
  function u32(n) { n = n >>> 0; return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]); }
  function u64(n) { // n is a JS number < 2^53; write big-endian 64-bit
    const hi = Math.floor(n / 0x100000000), lo = n >>> 0;
    return new Uint8Array([(hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255,
      (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255]);
  }
  function concat(parts) {
    let n = 0; for (const p of parts) n += p.length;
    const out = new Uint8Array(n); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  function box(type, parts) {
    const body = concat(parts);
    return concat([u32(body.length + 8), str4(type), body]);
  }
  function fullbox(type, version, flags, parts) {
    const vf = new Uint8Array([version & 255, (flags >>> 16) & 255, (flags >>> 8) & 255, flags & 255]);
    return box(type, [vf].concat(parts));
  }
  // MPEG-4 descriptor with the common 4-byte "expandable" length (0x80 0x80 0x80 len).
  function descr(tag, parts) {
    const body = concat(parts), len = body.length;
    return concat([new Uint8Array([tag, 0x80, 0x80, 0x80, len & 0x7f]), body]);
  }

  const UNITY_MATRIX = new Uint8Array([
    0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // 0x00010000
    0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0,   // 0x00010000
    0, 0, 0, 0, 0, 0, 0, 0, 0x40, 0, 0, 0 // 0x40000000
  ]);

  // ── AAC ADTS + AudioSpecificConfig helpers (WAV-FIRST v4.1, iOS AAC append repair) ──
  //
  // iOS' AudioEncoder emits ADTS-framed AAC (a 7- or 9-byte header + raw access unit per
  // frame); those bytes muxed raw into an fMP4 sample poison the demux (the device's
  // "SourceBuffer error + appendBuffer InvalidState at first append"). We detect the 0xFFF
  // sync, parse the header, and strip to raw AAC before muxing. Codec-gated to AAC by the
  // caller — Opus has no ADTS analog. All exported so the node unit gate (fmp4-test.js) can
  // check strip fidelity and ASC synthesis without WebCodecs.

  // 4-bit ADTS sampling_frequency_index → Hz (and the inverse used for ASC synthesis).
  const AAC_SR_TABLE = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050,
    16000, 12000, 11025, 8000, 7350];
  function srIndexFor(sr) { const i = AAC_SR_TABLE.indexOf(sr | 0); return i >= 0 ? i : 4; /* default 44100 */ }

  // Synthesize the 2-byte AudioSpecificConfig for AAC-LC. Bit layout:
  //   audioObjectType(5) samplingFrequencyIndex(4) channelConfiguration(4) GASpecific(3=000)
  // AAC-LC=2, 44100→srIndex 4, stereo→2 gives 0x12 0x10 (the value the gate has always used).
  function synthAsc(objectType, srIndex, channels) {
    objectType = objectType || 2;
    srIndex = (srIndex == null ? 4 : srIndex) & 0x0f;
    channels = (channels || 2) & 0x0f;
    const b0 = ((objectType & 0x1f) << 3) | ((srIndex >> 1) & 0x07);
    const b1 = ((srIndex & 0x01) << 7) | (channels << 3);
    return new Uint8Array([b0, b1]);
  }

  // extractAsc — normalize an AudioEncoder decoderConfig.description to the BARE
  // AudioSpecificConfig the esds wants. iOS/WebKit hands back a full MPEG-4
  // ES_Descriptor (~39 bytes, CoreAudio magic-cookie style) instead of the 2-byte
  // ASC; embedding it verbatim makes a malformed esds and the SourceBuffer errors
  // on the init segment (device log 2026-07-08: desc=present:39B → mms-aac dead).
  //   bare ASC (short, plausible AOT)   → use as-is
  //   descriptor chain (tags 03/04/05)  → walk to DecSpecificInfo(0x05), take payload
  //   anything unparseable              → synthesize from the known rate/channels
  function extractAsc(desc, sampleRate, channels) {
    const fallback = () => synthAsc(2, srIndexFor(sampleRate || 44100), channels || 2);
    if (!desc) return fallback();
    const b = desc instanceof Uint8Array ? desc : new Uint8Array(desc.buffer || desc);
    if (!b.length) return fallback();
    if (b.length <= 4) {   // plausibly already a bare ASC (LC family AOT 1..4)
      const aot = b[0] >> 3;
      if (aot >= 1 && aot <= 4) return b.slice();
      return fallback();
    }
    // MPEG-4 descriptor size: per-byte 7-bit varint, MSB = continuation (max 4 bytes)
    const readLen = (o) => { let len = 0, i = o; for (let k = 0; k < 4 && i < b.length; k++) { const v = b[i++]; len = (len << 7) | (v & 0x7f); if (!(v & 0x80)) break; } return { len, next: i }; };
    let o = 0, guard = 0;
    while (o < b.length - 1 && guard++ < 16) {
      const tag = b[o]; const { len, next } = readLen(o + 1);
      if (tag === 0x05) {   // DecSpecificInfo — its payload IS the ASC
        const asc = b.slice(next, Math.min(b.length, next + len));
        if (asc.length >= 2 && (asc[0] >> 3) >= 1 && (asc[0] >> 3) <= 4) return asc;
        break;
      }
      if (tag === 0x03) {   // ES_Descriptor: ES_ID(2) + flags(1) [+ optional fields per flags]
        let p = next + 2; const flags = b[p]; p += 1;
        if (flags & 0x80) p += 2;                       // streamDependenceFlag → dependsOn_ES_ID
        if (flags & 0x40) p += 1 + (b[p] || 0);         // URL_Flag → URLlength + URLstring
        if (flags & 0x20) p += 2;                       // OCRstreamFlag → OCR_ES_Id
        o = p; continue;
      }
      if (tag === 0x04) { o = next + 13; continue; }    // DecoderConfigDescriptor: 13 fixed bytes, then children
      o = next + len;                                    // unknown descriptor — skip wholesale
    }
    return fallback();
  }

  // Parse one ADTS header at offset `o`. Returns null if there is no 0xFFF syncword there.
  function parseAdtsHeader(b, o) {
    o = o || 0;
    if (o + 7 > b.length) return null;
    if (b[o] !== 0xff || (b[o + 1] & 0xf0) !== 0xf0) return null;   // 12-bit syncword
    const protectionAbsent = b[o + 1] & 0x01;                       // 1 → no CRC (7B header), 0 → CRC (9B)
    const profile = (b[o + 2] >> 6) & 0x03;                         // objectType - 1 (AAC-LC profile=1 → OT 2)
    const srIndex = (b[o + 2] >> 2) & 0x0f;
    const chanConfig = ((b[o + 2] & 0x01) << 2) | ((b[o + 3] >> 6) & 0x03);
    const frameLength = ((b[o + 3] & 0x03) << 11) | (b[o + 4] << 3) | ((b[o + 5] >> 5) & 0x07);   // 13 bits, incl. header
    const numFrames = (b[o + 6] & 0x03) + 1;
    return { protectionAbsent, profile, objectType: profile + 1, srIndex, chanConfig,
      frameLength, headerLen: protectionAbsent ? 7 : 9, numFrames };
  }

  // Strip ADTS framing from one encoded chunk → the concatenated raw AAC access unit(s).
  // Handles multiple ADTS frames in one chunk (walks by frame_length) and is defensive
  // about a bad length field. Returns { adts, raw, header } (header = the FIRST frame's,
  // the ASC source). If the chunk is not ADTS-framed, returns it unchanged (adts:false).
  function stripAdts(chunk) {
    const b = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    const first = parseAdtsHeader(b, 0);
    if (!first) return { adts: false, raw: b, header: null };
    const parts = [];
    let o = 0;
    while (o + 7 <= b.length) {
      const h = parseAdtsHeader(b, o);
      if (!h) break;
      if (h.frameLength < h.headerLen || o + h.frameLength > b.length) {
        // malformed frame_length → take the remaining payload after the header and stop.
        parts.push(b.subarray(o + h.headerLen));
        o = b.length;
        break;
      }
      parts.push(b.subarray(o + h.headerLen, o + h.frameLength));
      o += h.frameLength;
    }
    if (!parts.length) return { adts: false, raw: b, header: null };
    let n = 0; for (const p of parts) n += p.length;
    const raw = new Uint8Array(n); let off = 0;
    for (const p of parts) { raw.set(p, off); off += p.length; }
    return { adts: true, raw, header: first };
  }

  function makeFmp4Mux(opts) {
    const codec = opts.codec === "opus" ? "opus" : "aac";
    const TS = opts.sampleRate || 44100;          // media timescale = sample rate
    const CH = opts.channels || 2;
    let cfg = opts.codecConfig ? new Uint8Array(opts.codecConfig) : new Uint8Array(0);
    // AAC with no supplied AudioSpecificConfig (iOS AudioEncoder often omits
    // decoderConfig.description): synthesize a valid ASC so the esds is well-formed rather
    // than empty/garbage. The caller prefers ADTS-derived params; this is the last-resort
    // default (AAC-LC / sampleRate / channels). Opus always carries its OpusHead in cfg.
    if (codec === "aac" && cfg.length === 0) cfg = synthAsc(2, srIndexFor(TS), CH);

    let seq = 0;                                  // moof sequence_number (1-based)
    let baseSet = false, decodeTime = 0;          // running baseMediaDecodeTime in TS units
    let totalSamples = 0;                         // cumulative muxed samples (for emitted())

    // ── stsd audio sample entry ──
    function esdsBox() {
      const dsi = descr(0x05, [cfg]);                          // DecoderSpecificInfo = AudioSpecificConfig
      const dcd = descr(0x04, [                                // DecoderConfigDescriptor
        new Uint8Array([0x40]),                                // objectTypeIndication: Audio ISO/IEC 14496-3 (AAC)
        new Uint8Array([0x15]),                                // streamType(audio=5)<<2 | upStream(0)<<1 | reserved(1)
        new Uint8Array([0, 0, 0]),                             // bufferSizeDB
        u32(0), u32(0),                                        // max / avg bitrate (unknown)
        dsi]);
      const sl = descr(0x06, [new Uint8Array([0x02])]);        // SLConfigDescriptor: predefined
      const es = descr(0x03, [u16(0), new Uint8Array([0]), dcd, sl]);  // ES_Descriptor (ES_ID=0, flags=0)
      return fullbox("esds", 0, 0, [es]);
    }
    function dOpsBox() {
      // map OpusHead (codecConfig, little-endian) -> dOps (big-endian). Defaults if absent.
      let outCh = CH, preSkip = 3840, inSR = 48000, gain = 0, family = 0;
      if (cfg.length >= 19 && cfg[0] === 0x4f /*O*/) {
        outCh = cfg[9];
        preSkip = cfg[10] | (cfg[11] << 8);
        inSR = (cfg[12] | (cfg[13] << 8) | (cfg[14] << 16) | (cfg[15] << 24)) >>> 0;
        gain = cfg[16] | (cfg[17] << 8);
        family = cfg[18];
      }
      const parts = [new Uint8Array([0, outCh]), u16(preSkip), u32(inSR), i16(gain), new Uint8Array([family])];
      return box("dOps", parts);   // dOps is a plain box (Version byte is its first payload byte = 0)
    }
    function sampleEntry() {
      const type = codec === "opus" ? "Opus" : "mp4a";
      const cfgBox = codec === "opus" ? dOpsBox() : esdsBox();
      const body = [
        new Uint8Array(6),          // reserved
        u16(1),                     // data_reference_index
        new Uint8Array(8),          // reserved (2x uint32)
        u16(CH),                    // channelcount
        u16(16),                    // samplesize
        u16(0), u16(0),             // pre_defined, reserved
        u32(TS * 65536),            // samplerate 16.16 fixed
        cfgBox];
      return box(type, body);
    }

    function moovBox() {
      const mvhd = fullbox("mvhd", 0, 0, [
        u32(0), u32(0), u32(TS), u32(0),
        u32(0x00010000), u16(0x0100), u16(0), u32(0), u32(0),
        UNITY_MATRIX, new Uint8Array(24), u32(2)]);
      const tkhd = fullbox("tkhd", 0, 0x000007, [
        u32(0), u32(0), u32(1), u32(0), u32(0), new Uint8Array(8),
        u16(0), u16(0), u16(0x0100), u16(0), UNITY_MATRIX, u32(0), u32(0)]);
      const mdhd = fullbox("mdhd", 0, 0, [u32(0), u32(0), u32(TS), u32(0), u16(0x55c4), u16(0)]);
      const hdlr = fullbox("hdlr", 0, 0, [u32(0), str4("soun"), new Uint8Array(12),
        new Uint8Array([0x53, 0x6f, 0x75, 0x6e, 0x64, 0x00])]);   // "Soun\0" name (minimal)
      const smhd = fullbox("smhd", 0, 0, [u16(0), u16(0)]);
      const dref = fullbox("dref", 0, 0, [u32(1), fullbox("url ", 0, 1, [])]);
      const dinf = box("dinf", [dref]);
      const stsd = fullbox("stsd", 0, 0, [u32(1), sampleEntry()]);
      const stts = fullbox("stts", 0, 0, [u32(0)]);
      const stsc = fullbox("stsc", 0, 0, [u32(0)]);
      const stsz = fullbox("stsz", 0, 0, [u32(0), u32(0)]);
      const stco = fullbox("stco", 0, 0, [u32(0)]);
      const stbl = box("stbl", [stsd, stts, stsc, stsz, stco]);
      const minf = box("minf", [smhd, dinf, stbl]);
      const mdia = box("mdia", [mdhd, hdlr, minf]);
      const trak = box("trak", [tkhd, mdia]);
      const trex = fullbox("trex", 0, 0, [u32(1), u32(1), u32(0), u32(0), u32(0)]);
      const mvex = box("mvex", [trex]);
      return box("moov", [mvhd, trak, mvex]);
    }

    function initSegment() {
      const ftyp = box("ftyp", [str4("isom"), u32(1), str4("isom"), str4("iso6"), str4("mp41")]);
      return concat([ftyp, moovBox()]);
    }

    // pushChunks(chunks): chunks = [{ data:Uint8Array, duration:<samples>, timestamp:<samples> }]
    // → one moof+mdat fragment (Uint8Array). duration/timestamp are in media-timescale
    // (= sampleRate) units; timestamp is only read from the very first ever chunk (priming
    // anchor). Returns an empty Uint8Array for an empty batch.
    function pushChunks(chunks) {
      if (!chunks || !chunks.length) return new Uint8Array(0);
      if (!baseSet) { const t0 = chunks[0].timestamp; decodeTime = (t0 == null ? 0 : Math.round(t0)); baseSet = true; }
      seq++;
      const N = chunks.length;
      let payloadLen = 0, fragSamples = 0;
      for (const c of chunks) { payloadLen += c.data.length; fragSamples += (c.duration | 0); }

      const mfhd = fullbox("mfhd", 0, 0, [u32(seq)]);
      const tfhd = fullbox("tfhd", 0, 0x020000, [u32(1)]);          // default-base-is-moof; track_id=1
      const tfdt = fullbox("tfdt", 1, 0, [u64(decodeTime)]);        // EXPLICIT baseMediaDecodeTime (64-bit)
      // trun: data-offset + per-sample duration + per-sample size (flags 0x000301).
      const trunFields = [u32(N), null /*data_offset patched below*/];
      const samp = new Uint8Array(8 * N);
      for (let i = 0; i < N; i++) { samp.set(u32(chunks[i].duration | 0), i * 8); samp.set(u32(chunks[i].data.length), i * 8 + 4); }
      // moof size is deterministic: 8(moof)+16(mfhd)+8(traf)+16(tfhd)+20(tfdt)+trun.
      // trun = 8 + 4(vf) + 4(count) + 4(data_offset) + 8N.
      const trunLen = 8 + 4 + 4 + 4 + 8 * N;
      const moofLen = 8 + mfhd.length + 8 + tfhd.length + tfdt.length + trunLen;
      const dataOffset = moofLen + 8;                              // moof + mdat header → first sample byte
      trunFields[1] = u32(dataOffset);
      const trun = fullbox("trun", 0, 0x000301, [trunFields[0], trunFields[1], samp]);
      const traf = box("traf", [tfhd, tfdt, trun]);
      const moof = box("moof", [mfhd, traf]);
      const mdatBody = new Uint8Array(payloadLen);
      { let o = 0; for (const c of chunks) { mdatBody.set(c.data, o); o += c.data.length; } }
      const mdat = box("mdat", [mdatBody]);

      decodeTime += fragSamples; totalSamples += fragSamples;
      return concat([moof, mdat]);
    }

    return { initSegment, pushChunks, codec, sampleRate: TS,
      emitted: () => totalSamples, decodeTime: () => decodeTime, sequence: () => seq };
  }

  return { makeFmp4Mux, parseAdtsHeader, stripAdts, synthAsc, extractAsc, srIndexFor, AAC_SR_TABLE };
});
