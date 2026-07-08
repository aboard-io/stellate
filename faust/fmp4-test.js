#!/usr/bin/env node
// faust/fmp4-test.js — the WAV-FIRST v4 muxer unit gate (WAV-FIRST.md v4 gate a).
//
//   node faust/fmp4-test.js
//
// Box-walks faust/fmp4.js output with SIMULATED encoded chunks (no WebCodecs needed —
// the muxer is pure bytes-in/bytes-out). Asserts, for BOTH codecs (aac + opus):
//   • init segment = ftyp + moov, and moov/…/stsd carries the right codec entry
//     (mp4a+esds for aac, Opus+dOps for opus);
//   • across >= 3 fragments INCLUDING a simulated gen bridge, every fragment is
//     moof(mfhd,traf(tfhd,tfdt,trun)) + mdat;
//   • tfdt (baseMediaDecodeTime) is STRICTLY MONOTONIC and equals the cumulative
//     sample count of all prior fragments (the explicit-timestamp property that cures
//     the mp3 lurch);
//   • trun per-sample sizes SUM to the mdat payload size (sample-count conservation).
"use strict";
const path = require("path");
const { makeFmp4Mux, stripAdts, synthAsc, extractAsc: extractAscCfg, srIndexFor, parseAdtsHeader } = require(path.join(__dirname, "fmp4.js"));

// ── a minimal big-endian ISO-BMFF box walker ──
function walk(buf, start, end) {
  const out = [];
  let o = start;
  while (o + 8 <= end) {
    const size = buf.readUInt32BE(o);
    const type = buf.toString("latin1", o + 4, o + 8);
    if (size < 8 || o + size > end) break;
    out.push({ type, start: o, size, dataStart: o + 8, dataEnd: o + size });
    o += size;
  }
  return out;
}
function find(boxes, type) { return boxes.find((b) => b.type === type); }
function children(buf, b) { return walk(buf, b.dataStart, b.dataEnd); }

// find nested box by path (container boxes only), starting from a box list.
function dig(buf, boxes, pathArr) {
  let cur = boxes, box = null;
  for (const t of pathArr) { box = find(cur, t); if (!box) return null; cur = children(buf, box); }
  return box;
}

function fakeChunks(n, frameSamples, tsStart, size0) {
  // n coded frames of `frameSamples` PCM samples each; bytes are arbitrary but
  // size-distinct so the sum test is meaningful. timestamps are cumulative samples.
  const chunks = [];
  let ts = tsStart;
  for (let i = 0; i < n; i++) {
    const len = size0 + (i % 7);
    const data = new Uint8Array(len); for (let j = 0; j < len; j++) data[j] = (i * 31 + j) & 255;
    chunks.push({ data, duration: frameSamples, timestamp: ts });
    ts += frameSamples;
  }
  return chunks;
}

function testCodec(codec, cfg, entryType, cfgBoxType) {
  const SR = 44100, FRAME = codec === "opus" ? 882 : 1024;
  const mux = makeFmp4Mux({ codec, sampleRate: SR, channels: 2, codecConfig: cfg });

  // ── init segment structure ──
  const init = Buffer.from(mux.initSegment());
  const top = walk(init, 0, init.length);
  const ftyp = find(top, "ftyp"), moov = find(top, "moov");
  if (!ftyp || !moov) return { ok: false, why: `${codec}: init missing ftyp/moov` };
  const stsd = dig(init, top, ["moov", "trak", "mdia", "minf", "stbl", "stsd"]);
  if (!stsd) return { ok: false, why: `${codec}: no stsd` };
  const entries = walk(init, stsd.dataStart + 8, stsd.dataEnd);   // skip version/flags + entry_count
  const entry = find(entries, entryType);
  if (!entry) return { ok: false, why: `${codec}: stsd entry ${entryType} absent (got ${entries.map((e) => e.type).join(",")})` };
  const entryKids = walk(init, entry.dataStart + 28, entry.dataEnd);   // AudioSampleEntry header is 28 bytes
  const cfgBox = find(entryKids, cfgBoxType);
  if (!cfgBox) return { ok: false, why: `${codec}: ${entryType} missing ${cfgBoxType}` };
  const mvex = dig(init, top, ["moov", "mvex", "trex"]);
  if (!mvex) return { ok: false, why: `${codec}: no mvex/trex` };

  // ── fragments (>= 3, including a simulated gen bridge at fragment 2) ──
  const batches = [
    fakeChunks(20, FRAME, 0, 400),                 // gen A boot batch
    fakeChunks(20, FRAME, 20 * FRAME, 420),        // gen A normal batch
    fakeChunks(20, FRAME, 40 * FRAME, 380),        // gen B BRIDGE batch (timeline continuous — muxer is bridge-agnostic)
    fakeChunks(13, FRAME, 60 * FRAME, 440),        // gen B partial final batch
  ];
  let cumulative = 0, prevTfdt = -1, allOk = true, why = "";
  let fragCount = 0;
  for (const batch of batches) {
    const frag = Buffer.from(mux.pushChunks(batch));
    const fb = walk(frag, 0, frag.length);
    const moof = find(fb, "moof"), mdat = find(fb, "mdat");
    if (!moof || !mdat) { allOk = false; why = `${codec}: fragment missing moof/mdat`; break; }
    const traf = dig(frag, fb, ["moof", "traf"]);
    const tfhd = traf && find(children(frag, traf), "tfhd");
    const tfdtBox = traf && find(children(frag, traf), "tfdt");
    const trun = traf && find(children(frag, traf), "trun");
    if (!tfhd || !tfdtBox || !trun) { allOk = false; why = `${codec}: traf missing tfhd/tfdt/trun`; break; }

    // tfdt: version(1)+flags(3) then 64-bit baseMediaDecodeTime
    const ver = frag[tfdtBox.dataStart];
    const bmdtOff = tfdtBox.dataStart + 4;
    const bmdt = ver === 1
      ? frag.readUInt32BE(bmdtOff) * 0x100000000 + frag.readUInt32BE(bmdtOff + 4)
      : frag.readUInt32BE(bmdtOff);
    if (bmdt !== cumulative) { allOk = false; why = `${codec}: tfdt ${bmdt} != cumulative ${cumulative}`; break; }
    if (bmdt <= prevTfdt) { allOk = false; why = `${codec}: tfdt not strictly monotonic (${bmdt} <= ${prevTfdt})`; break; }
    prevTfdt = bmdt;

    // trun: version/flags(4), sample_count(4), data_offset(4), then per-sample [dur(4),size(4)]
    const sc = frag.readUInt32BE(trun.dataStart + 4);
    let sizeSum = 0, durSum = 0;
    for (let i = 0; i < sc; i++) {
      const so = trun.dataStart + 12 + i * 8;
      durSum += frag.readUInt32BE(so);
      sizeSum += frag.readUInt32BE(so + 4);
    }
    const mdatPayload = mdat.size - 8;
    if (sizeSum !== mdatPayload) { allOk = false; why = `${codec}: trun size sum ${sizeSum} != mdat payload ${mdatPayload}`; break; }
    if (sc !== batch.length) { allOk = false; why = `${codec}: trun sample_count ${sc} != batch ${batch.length}`; break; }
    cumulative += durSum; fragCount++;
  }
  if (allOk && fragCount < 3) { allOk = false; why = `${codec}: only ${fragCount} fragments`; }
  return { ok: allOk, why, fragCount, finalTfdt: prevTfdt, cumulative };
}

// ── v4.1 ADTS + ASC gate helpers ──
const eqBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// build a synthetic ADTS frame around `payload`. crc:true → protection_absent=0 (9-byte
// header + a 2-byte CRC placeholder); else 7-byte header. AAC-LC profile (objectType 2).
function makeAdtsFrame(payload, opts) {
  opts = opts || {};
  const crc = !!opts.crc;
  const srIndex = opts.srIndex == null ? 4 : opts.srIndex;
  const chan = opts.chan == null ? 2 : opts.chan;
  const profile = opts.profile == null ? 1 : opts.profile;   // AAC-LC → profile 1 → objectType 2
  const headerLen = crc ? 9 : 7;
  const frameLength = headerLen + payload.length;
  const h = new Uint8Array(headerLen);
  h[0] = 0xff;
  h[1] = 0xf0 | (crc ? 0 : 1);                                // sync + MPEG-4 + layer0 + protection_absent
  h[2] = (profile << 6) | (srIndex << 2) | ((chan >> 2) & 1);
  h[3] = ((chan & 3) << 6) | ((frameLength >> 11) & 0x03);
  h[4] = (frameLength >> 3) & 0xff;
  h[5] = ((frameLength & 0x07) << 5) | 0x1f;                  // frame_length low + buffer_fullness hi (0x7ff)
  h[6] = 0xfc;                                                // buffer_fullness lo + num_frames_minus1=0
  const out = new Uint8Array(frameLength);
  out.set(h, 0); out.set(payload, headerLen);
  return out;
}
const concatBytes = (arrs) => { let n = 0; for (const a of arrs) n += a.length; const o = new Uint8Array(n); let k = 0; for (const a of arrs) { o.set(a, k); k += a.length; } return o; };

// descriptor reader for the esds (expandable length, 1- or 4-byte).
function readDescr(buf, o) {
  const tag = buf[o++]; let b, size = 0, cnt = 0;
  do { b = buf[o++]; size = (size << 7) | (b & 0x7f); cnt++; } while ((b & 0x80) && cnt < 4);
  return { tag, size, dataStart: o, dataEnd: o + size };
}
// pull the AudioSpecificConfig (DecoderSpecificInfo, tag 0x05) out of an esds box.
function extractAsc(buf, esdsBox) {
  const es = readDescr(buf, esdsBox.dataStart + 4);      // skip fullbox version/flags
  if (es.tag !== 0x03) return null;
  const dcd = readDescr(buf, es.dataStart + 3);          // ES_ID(2) + flags(1)
  if (dcd.tag !== 0x04) return null;
  const dsi = readDescr(buf, dcd.dataStart + 13);        // OTI(1)+streamType(1)+bufSize(3)+max(4)+avg(4)
  if (dsi.tag !== 0x05) return null;
  return buf.slice(dsi.dataStart, dsi.dataEnd);
}

function testAdtsAsc() {
  const fails = [];
  // 1) ASC synthesis: AAC-LC / 44100 / stereo == 0x12 0x10 (the canonical value).
  if (!eqBytes(synthAsc(2, 4, 2), new Uint8Array([0x12, 0x10]))) fails.push("synthAsc(2,4,2) != 0x12 0x10");
  if (srIndexFor(44100) !== 4 || srIndexFor(48000) !== 3) fails.push("srIndexFor wrong");

  // 2) strip — single frame, no CRC (7-byte header).
  const p1 = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0x11, 0x22]);
  const s1 = stripAdts(makeAdtsFrame(p1));
  if (!s1.adts || !eqBytes(s1.raw, p1)) fails.push("single/no-crc strip payload mismatch");
  if (!s1.header || s1.header.headerLen !== 7 || s1.header.objectType !== 2 || s1.header.srIndex !== 4 || s1.header.chanConfig !== 2) fails.push("single/no-crc header parse wrong");

  // 2.5) extractAsc (v4.1.1): iOS AudioEncoder hands back a full ES_Descriptor
  // (~39B CoreAudio-cookie shape), not the bare ASC — the walker must dig out the
  // DecSpecificInfo payload; bare ASCs pass through; garbage falls back to synth.
  if (!eqBytes(extractAscCfg(new Uint8Array([0x12, 0x10]), 44100, 2), new Uint8Array([0x12, 0x10]))) fails.push("extractAsc bare passthrough");
  const esDesc = new Uint8Array([
    0x03, 0x22, 0x00, 0x01, 0x00,                                     // ES_Descriptor: ES_ID=1, flags=0
    0x04, 0x14, 0x40, 0x15, 0,0,0, 0,0,0,0, 0,0,0,0,                  // DecoderConfigDescriptor: 13 fixed bytes
    0x05, 0x02, 0x12, 0x10,                                           // DecSpecificInfo: the bare ASC
    0x06, 0x01, 0x02]);                                               // SLConfigDescriptor (trailing sibling)
  if (!eqBytes(extractAscCfg(esDesc, 44100, 2), new Uint8Array([0x12, 0x10]))) fails.push("extractAsc ES_Descriptor walk");
  const esLong = new Uint8Array([                                      // long-form 4-byte varint lengths
    0x03, 0x80, 0x80, 0x80, 0x22, 0x00, 0x01, 0x00,
    0x04, 0x80, 0x80, 0x80, 0x14, 0x40, 0x15, 0,0,0, 0,0,0,0, 0,0,0,0,
    0x05, 0x80, 0x80, 0x80, 0x02, 0x12, 0x10]);
  if (!eqBytes(extractAscCfg(esLong, 44100, 2), new Uint8Array([0x12, 0x10]))) fails.push("extractAsc long-varint walk");
  if (!eqBytes(extractAscCfg(new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x99, 0x99]), 44100, 2), new Uint8Array([0x12, 0x10]))) fails.push("extractAsc garbage fallback");
  if (!eqBytes(extractAscCfg(null, 44100, 2), new Uint8Array([0x12, 0x10]))) fails.push("extractAsc null fallback");

  // 3) strip — single frame WITH CRC (9-byte header).
  const p2 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const s2 = stripAdts(makeAdtsFrame(p2, { crc: true }));
  if (!s2.adts || !eqBytes(s2.raw, p2)) fails.push("single/crc strip payload mismatch");
  if (!s2.header || s2.header.headerLen !== 9) fails.push("single/crc header length wrong");

  // 4) strip — MULTIPLE ADTS frames in one chunk → concatenated raw payloads, in order.
  const pa = new Uint8Array([0x10, 0x20, 0x30]), pb = new Uint8Array([0x40, 0x50, 0x60, 0x70]), pc = new Uint8Array([0x80, 0x90]);
  const multi = concatBytes([makeAdtsFrame(pa), makeAdtsFrame(pb, { crc: true }), makeAdtsFrame(pc)]);
  const s3 = stripAdts(multi);
  if (!s3.adts || !eqBytes(s3.raw, concatBytes([pa, pb, pc]))) fails.push("multi-frame strip payload mismatch");

  // 5) non-ADTS bytes pass through untouched (codec-gating safety — opus/raw AAC survive).
  const raw = new Uint8Array([0x21, 0x00, 0x03, 0x40]);   // no 0xFFF sync
  const s4 = stripAdts(raw);
  if (s4.adts || !eqBytes(s4.raw, raw)) fails.push("non-ADTS chunk was altered");

  // 6) ASC derived from a parsed ADTS header (44100/mono here) is self-consistent.
  const h = parseAdtsHeader(makeAdtsFrame(new Uint8Array([9]), { srIndex: 4, chan: 1 }), 0);
  if (!eqBytes(synthAsc(h.objectType, h.srIndex, h.chanConfig), new Uint8Array([0x12, 0x08]))) fails.push("ASC from ADTS header (44100/mono) wrong");

  // 7) muxer with ABSENT codecConfig synthesizes the ASC into the esds, and box-walks clean.
  const synth = testCodec("aac", new Uint8Array(0), "mp4a", "esds");
  if (!synth.ok) fails.push("synthesized-ASC mux box-walk: " + synth.why);
  else {
    const mux = makeFmp4Mux({ codec: "aac", sampleRate: 44100, channels: 2, codecConfig: new Uint8Array(0) });
    const init = Buffer.from(mux.initSegment());
    const top = walk(init, 0, init.length);
    const esds = dig(init, top, ["moov", "trak", "mdia", "minf", "stbl", "stsd"]);
    const entries = walk(init, esds.dataStart + 8, esds.dataEnd);
    const mp4a = find(entries, "mp4a");
    const esdsBox = find(walk(init, mp4a.dataStart + 28, mp4a.dataEnd), "esds");
    const asc = extractAsc(init, esdsBox);
    if (!asc || !eqBytes(new Uint8Array(asc), new Uint8Array([0x12, 0x10]))) fails.push("esds ASC not the synthesized 0x12 0x10 (got " + (asc ? [...asc] : "null") + ")");
  }

  return { ok: fails.length === 0, fails };
}

function main() {
  const adts = testAdtsAsc();

  // aac: a plausible AudioSpecificConfig (AAC-LC, 44100, stereo) = 0x12 0x10
  const aac = testCodec("aac", new Uint8Array([0x12, 0x10]), "mp4a", "esds");
  // opus: a plausible OpusHead (19 bytes): "OpusHead",ver=1,ch=2,preSkip=312,inSR=48000,gain=0,family=0
  const opusHead = new Uint8Array([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64, 1, 2,
    0x38, 0x01, 0x80, 0xbb, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const opus = testCodec("opus", opusHead, "Opus", "dOps");

  console.log(`aac : ${aac.ok ? "PASS" : "FAIL " + aac.why} (frags ${aac.fragCount}, final tfdt ${aac.finalTfdt}, cumulative ${aac.cumulative})`);
  console.log(`opus: ${opus.ok ? "PASS" : "FAIL " + opus.why} (frags ${opus.fragCount}, final tfdt ${opus.finalTfdt}, cumulative ${opus.cumulative})`);
  console.log(`adts+asc (v4.1): ${adts.ok ? "PASS" : "FAIL\n  " + adts.fails.join("\n  ")}`);
  const pass = aac.ok && opus.ok && adts.ok;
  console.log(`FMP4 MUX (box structure + tfdt monotonicity + sample-count conservation + ADTS strip/ASC synth): ${pass ? "PASS" : "FAIL"}`);
  process.exit(pass ? 0 : 1);
}
main();
