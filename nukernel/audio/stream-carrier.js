// audio/stream-carrier.js — THE CARRIER. Rendered segments go in one end; one
// <audio> element plays a single unbroken stream out of the other, and the OS
// sees media the whole time.
//
// This is the consumer half of the two-lane engine contract. A producer hands
// it segments:
//
//   renderSegment({ fromBar, bars, gen }) -> { pcm:[L,R], sampleRate, fromBar,
//                                              bars, gen, overlap, endsSong }
//
// and this file encodes each one to ONE fragmented-MP4 fragment and appends it
// to one SourceBuffer with an explicit baseMediaDecodeTime. It never re-times
// and never resamples what it is handed; the only arithmetic it does to the
// samples is the overlap-add the producer's baked fades are asking for.
//
// THREE FACTS ARE BUILT IN BECAUSE A DEVICE ALREADY PAID FOR THEM. None of
// them is re-litigated here; docs/WAV-FIRST.md v2/v3/v4 is where they were won.
//
//   1. fMP4, NEVER MP3. WebKit's audio/mpeg MSE stitching INFERS each append's
//      timestamp from the frames and drifts — the device report was "the snare
//      and the lead and bass go out of whack over time." Every fragment here
//      carries a tfdt in media timescale (= the render's own sample rate),
//      anchored ONCE at the first encoded chunk's own timestamp (read, never
//      assumed zero — that is the codec-priming handling) and advanced after
//      that by the exact sum of the sample durations muxed so far. Nothing is
//      inferred, so nothing can drift. This repo separately measured 1105
//      samples of MP3 encoder lead-in on WebKit and 1981 through MSE; mp3 is
//      disqualified twice over and there is no mp3 tier below.
//   2. SEGMENTS OVERLAP AND THE CROSSFADE IS BAKED IN. Butt-splicing and
//      swapping on `ended` leaves an audible device gap. Segment k's tail
//      carries a baked fade-out over its last OV samples and segment k+1 begins
//      OV samples BEFORE the cut with the matching fade-in, so the join is an
//      ADDITION of two windows that were designed to sum. This file adds them
//      and holds no opinion about their SHAPE — equal-power across a generation
//      change, unity-summing within one — because the shape is the producer's
//      to bake and the arithmetic is the same either way.
//   3. NEVER STALL WITH ZERO PLAYABLE SEGMENTS. A song change does not flush,
//      does not remove and does not stop appending: the old generation keeps
//      playing out of the buffer while the new generation's first segment is
//      still being rendered, and the two meet at the same overlap-add every
//      other join uses. Backpressure holds at most `ahead` UNPLAYED segments,
//      and it is measured against the element's own currentTime rather than
//      against a timer, so a device that decodes slowly asks for less.
//
// THE RATE IS THE PRODUCER'S, NOT THE CODEC'S. The contract says the PCM
// arrives at ctxRate and that this file never resamples it, and those two
// sentences together decide the codec ladder: a tier is only offered if its
// encoder will run AT the incoming rate. AAC is native at any of them, which is
// the device path. Opus is a 48 kHz codec — a 44.1 kHz track timescale over
// 20 ms frames is a stream the demuxer has to reconcile, and reconciling is
// exactly where samples went the last time this project tried it — so the opus
// tier is offered only when the render is already at 48 kHz, which on both
// chromium and iOS is what an AudioContext gives you anyway. When neither tier
// fits, the fallback below carries the song instead of a resampler smearing it.
//
// Layer graph: this file imports ./fmp4.js and NOTHING ELSE. It is handed its
// element and its producer, which is what lets a probe import it alone and
// drive it with a signal whose every sample is known.

import { loadFmp4 } from "./fmp4.js";

const T_AAC = 'audio/mp4; codecs="mp4a.40.2"';
const T_OPUS = 'audio/mp4; codecs="opus"';
const G = typeof globalThis !== "undefined" ? globalThis : {};

/* ---------- the pure half (the node gate drives these directly) ---------- */

// HOW FAR THE STREAM MOVES per segment. A segment is `overlap` samples longer
// than the ground it covers, because its head re-plays the previous segment's
// last OV samples. The stream therefore advances by N - OV and the tail is held
// back to be added to the next head — which is also why the carrier always sits
// one overlap behind the producer and why that lag is CONSTANT rather than
// cumulative.
export function advanceOf(seg) {
  const n = seg && seg.pcm && seg.pcm[0] ? seg.pcm[0].length : 0;
  return Math.max(0, n - Math.max(0, (seg && seg.overlap) | 0));
}

// THE JOIN, and it is one line of arithmetic wearing a lot of history. `tail` is
// the previous segment's last OV samples (already faded out by the producer);
// `chs` is this segment's channels, whose first OV samples are already faded in.
// Adding them is the whole crossfade. Everything after the overlap window is
// this segment verbatim; everything from N-OV on is held back as the next tail.
// Returns brand-new arrays: the producer's buffers are not ours to write into.
export function overlapAdd(tail, chs, ov) {
  const N = chs[0].length, ch = chs.length;
  ov = Math.max(0, Math.min(ov | 0, N));
  const emit = N - ov;
  const out = [], nextTail = [];
  for (let c = 0; c < ch; c++) {
    const src = chs[c], o = new Float32Array(emit), t = new Float32Array(ov);
    o.set(src.subarray(0, emit));
    if (tail && tail[c]) {
      const m = Math.min(ov, tail[c].length, emit);
      for (let i = 0; i < m; i++) o[i] += tail[c][i];
    }
    t.set(src.subarray(N - ov, N));
    out.push(o); nextTail.push(t);
  }
  return { out, tail: nextTail, emit };
}

// WebCodecs speaks microseconds; the muxer speaks samples. Converting each
// chunk's timestamp independently would let rounding walk — 1024 samples at
// 44100 is 23219.95 µs, and a stream is a hundred thousand of those — so only
// the FIRST chunk's timestamp is ever read (the priming anchor) and every
// duration is rounded once, in samples, as the quantity the timeline is
// actually made of. The muxer advances its tfdt by the sum of exactly these.
export function frameBatch(chunks, sr) {
  const out = [];
  for (const c of chunks || []) {
    const d = Math.max(1, Math.round((c.durationUs != null ? c.durationUs : c.duration) * sr / 1e6));
    out.push({ data: c.data, duration: d,
               timestamp: Math.round((c.timestampUs != null ? c.timestampUs : c.timestamp) * sr / 1e6) });
  }
  return out;
}
export const batchSamples = b => (b || []).reduce((s, c) => s + (c.duration | 0), 0);

// the RIFF/WAVE the fallback tier plays. Carried here rather than imported from
// audio/bounce.js's wavBytes for one reason: this module has to be importable
// with nothing else on the page (the probe imports it alone), and bounce.js
// sits on top of the whole audio tier. Sixteen-bit, interleaved, and it
// declares exactly the score's frame count — never one byte more.
export function wavBytes(chs, n, sr) {
  const ch = chs.length, bytes = n * ch * 2, buf = new ArrayBuffer(44 + bytes);
  const dv = new DataView(buf);
  let o = 0;
  const w = s => { for (let i = 0; i < s.length; i++) dv.setUint8(o++, s.charCodeAt(i)); };
  w("RIFF"); dv.setUint32(o, 36 + bytes, true); o += 4; w("WAVE");
  w("fmt "); dv.setUint32(o, 16, true); o += 4;
  dv.setUint16(o, 1, true); o += 2; dv.setUint16(o, ch, true); o += 2;
  dv.setUint32(o, sr, true); o += 4; dv.setUint32(o, sr * ch * 2, true); o += 4;
  dv.setUint16(o, ch * 2, true); o += 2; dv.setUint16(o, 16, true); o += 2;
  w("data"); dv.setUint32(o, bytes, true); o += 4;
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, chs[c][i]));
      dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2;
    }
  return buf;
}

/* ---------- feature detection, never a user-agent string ---------- */
// THE REPO HAS A WRITTEN SCAR ABOUT UA SNIFFING (engine/faust/voices/sampler.js
// zoneLeadIn(), which detects a decoder's padding by MEASURING it rather than by
// asking who the browser claims to be). So every question below is asked of the
// platform: does this constructor exist, will this MIME demux, will this encoder
// configure at this rate. Nothing here reads navigator.userAgent, and the route
// a device takes is reported rather than assumed.
const MMSctor = () => G.ManagedMediaSource || null;
const MSctor = () => G.ManagedMediaSource || G.MediaSource || null;
function mseTypeOk(t) {
  const M = MMSctor(), S = G.MediaSource;
  try {
    if (M && M.isTypeSupported) return M.isTypeSupported(t);
    if (S && S.isTypeSupported) return S.isTypeSupported(t);
  } catch (e) {}
  return false;
}
// which tier this browser can both ENCODE at the render's own rate and DEMUX.
// AAC first (it is what iOS has and it is rate-agnostic), opus second and only
// at 48 kHz (see the header). A `false` answer means the fallback tier, with a
// reason, and the reason is what a device log is diagnosed from.
export async function pickCodec(sr) {
  if (!MSctor()) return { ok: false, why: "no MediaSource" };
  if (typeof G.AudioEncoder === "undefined") return { ok: false, why: "no WebCodecs AudioEncoder" };
  const ladder = [["aac", "mp4a.40.2", T_AAC, sr]];
  if (sr === 48000) ladder.push(["opus", "opus", T_OPUS, 48000]);
  const tried = [];
  for (const [name, codec, mime, rate] of ladder) {
    if (!mseTypeOk(mime)) { tried.push(name + ":no-demux"); continue; }
    try {
      const r = await G.AudioEncoder.isConfigSupported(
        { codec, sampleRate: rate, numberOfChannels: 2, bitrate: 192000 });
      if (r && r.supported) return { ok: true, name, codec, mime, rate };
      tried.push(name + ":no-encoder");
    } catch (e) { tried.push(name + ":refused"); }
  }
  if (sr !== 48000) tried.push("opus:render-is-" + sr + "Hz");
  return { ok: false, why: tried.join(" ") || "no tier" };
}

/* ---------- the carrier ---------- */

const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const tick = ms => new Promise(r => setTimeout(r, ms));

export function makeStreamCarrier(opts) {
  const el = opts.el;
  const elB = opts.elB || null;                    // the fallback's second element
  const renderSegment = opts.renderSegment;
  const BARS = opts.bars || 4;                     // bars per segment, steady state
  const FIRST_BARS = opts.firstBars || Math.min(BARS, 1);   // time to first sound
  const AHEAD = Math.max(1, opts.ahead || 2);      // at most this many UNPLAYED segments
  const BEHIND = opts.behind || 20;                // seconds of buffer kept behind the head
  const PRIME_SEC = opts.primeSec != null ? opts.primeSec : 1.0;   // runway before the first play()
  const forced = opts.route || null;               // "segAB" for the fallback's own gate

  const st = {
    route: null, why: null, codec: null, mime: null, sr: 0,
    running: false, started: 0,
    // the two accountings that must agree, and the number that catches fact 1
    // coming back: PCM samples handed to the encoder vs sample durations the
    // container declares vs what the demuxer says it can play.
    fedSamples: 0, muxedSamples: 0, pushes: 0, segments: 0, appends: 0,
    firstAppendMs: null, firstSoundMs: null,
    gen: 0, nextBar: 0, loops: 0, endsSong: false,
    errors: [], demoted: null,
  };
  const ledger = [];                               // {t0,dur,fromBar,bars,gen} in STREAM seconds
  let tail = null;                                 // the held-back overlap, per channel
  let busy = false;                                // one renderSegment in flight
  let pendingFrom = null;                          // a retarget's bar, waiting for the next ask
  let stopped = false;

  let ms = null, sb = null, mux = null, enc = null, msUrl = null, wants = true;
  let pickRef = null, desc = null;                 // the chosen tier + the encoder's own config
  let chunkQ = [], anchor = null, pending = [];    // fragments waiting for the SourceBuffer
  let watchdog = null, lastT = -1, lastTAt = 0, playStarted = false;

  const say = (k, v) => { if (opts.onStatus) try { opts.onStatus(k, v); } catch (e) {} };
  const note = e => {
    const m = String((e && e.message) || e).slice(0, 160);
    st.errors.push(m);
    if (st.errors.length > 12) st.errors.shift();
    return m;
  };

  /* ---- MediaSession: the OS transport stays lit, because that is the point ----
     A page whose audible output is a WebAudio graph holds no media, so the OS
     grants it no focus and shows it no transport. Being a stream is the whole
     reason this file exists, and a stream that never tells the OS its name gets
     the focus and loses the lock screen. Metadata is only written when the
     caller supplies it (nukernel's audio/survival.js owns the strings; this is
     for a carrier standing alone), but playbackState is kept true either way —
     writing "playing" while playing cannot fight anyone. */
  function lightSession(state) {
    const nav = G.navigator;
    if (!nav || !("mediaSession" in nav)) return;
    try {
      if (opts.session && G.MediaMetadata && !lightSession.met) {
        nav.mediaSession.metadata = new G.MediaMetadata(opts.session);
        lightSession.met = true;
      }
      nav.mediaSession.playbackState = state;
    } catch (e) {}
  }

  /* ---- the stream's own clock ---------------------------------------------
     currentTime on a stream only ever grows; it is not a phase. Every reader
     that wants "where in the song" asks the ledger, which records the bar each
     segment started on beside the stream second it landed at. */
  const elTime = () => (el && el.currentTime) || 0;
  const streamEnd = () => (ledger.length ? ledger[ledger.length - 1].t0 + ledger[ledger.length - 1].dur : 0);
  // segments the playhead has NOT REACHED YET — strictly ahead of it, so the one
  // currently sounding is not counted as work in hand. That is the sense in
  // which the law reads "at most 2 unplayed segments ahead."
  function unplayed() {
    const t = elTime();
    let n = 0;
    for (const c of ledger) if (c.t0 > t) n++;
    return n;
  }
  function whereIs() {
    const t = elTime();
    for (let i = ledger.length - 1; i >= 0; i--)
      if (t >= ledger[i].t0) return { bar: ledger[i].fromBar, gen: ledger[i].gen,
                                      into: t - ledger[i].t0 };
    return { bar: 0, gen: st.gen, into: 0 };
  }

  /* ---- the pump: ask for the next segment as the queue DRAINS -------------
     Never on a timer. The condition is the element's own playhead against the
     ledger, so a device that decodes slowly is asked for less work and a device
     that is ahead of us is asked for more — which is the same backpressure the
     parent's ring producer runs (engine/faust/live/stream-worker.js), read off
     a media clock instead of a ring's write cursor. */
  async function pump() {
    if (stopped || busy || !st.running) return;
    if (!wants) return;                            // ManagedMediaSource said stop
    if (unplayed() >= AHEAD) return;
    busy = true;
    const askGen = st.gen;
    const askBar = pendingFrom != null ? pendingFrom : st.nextBar;
    pendingFrom = null;
    const askBars = st.segments === 0 ? FIRST_BARS : BARS;
    try {
      const seg = await renderSegment({ fromBar: askBar, bars: askBars, gen: askGen });
      if (stopped || !seg || !seg.pcm || !seg.pcm[0] || !seg.pcm[0].length) { busy = false; return; }
      await consume(seg);
    } catch (e) {
      note(e);
      // a producer that throws must not wedge the pump: the stream keeps
      // playing what it has, and the next drain asks again.
    }
    busy = false;
    if (!stopped) pump();
  }

  // one segment: overlap-add it onto the held tail, hand the emitted samples to
  // the encoder, mux whatever frames come back, queue the fragment.
  async function consume(seg) {
    const ov = Math.max(0, seg.overlap | 0);
    const j = overlapAdd(tail, seg.pcm, ov);
    tail = j.tail;
    const t0 = st.fedSamples / st.sr;
    const dur = j.emit / st.sr;
    st.fedSamples += j.emit;
    st.segments++;
    // WHERE THE PRODUCER GOES NEXT. `endsSong` is the wrap, and the wrap is a
    // bar line by construction, so the stream simply carries on: the next
    // segment starts at bar 0 of the same song and its baked fade-in meets this
    // one's fade-out at the same join everything else uses.
    st.endsSong = !!seg.endsSong;
    st.nextBar = seg.endsSong ? 0 : (seg.fromBar + seg.bars);
    if (seg.endsSong) st.loops++;
    ledger.push({ t0, dur, fromBar: seg.fromBar, bars: seg.bars, gen: seg.gen });
    while (ledger.length > 3 && ledger[0].t0 + ledger[0].dur < elTime() - BEHIND) ledger.shift();

    if (st.route === "segAB") return abQueue(seg);
    await encodeAndQueue(j.out, j.emit);
    // A DEMOTION MID-SEGMENT MUST NOT COST THE SEGMENT. If the fMP4 path died
    // while this one was being encoded, the samples are still in hand: hand them
    // to the fallback instead of dropping them and leaving a hole exactly where
    // the route changed.
    if (st.route === "segAB") return abQueue(seg);
    drain();
  }

  /* ---- ONE encoder for the whole stream lifetime -------------------------
     A codec frame is not independent — its decode depends on the frame before
     it — so an encoder per segment would put a cold frame at every join, which
     this project has already measured as a CLICK where the gap used to be
     (audio/bounce.js, "the warm tail"). One encoder, fed consecutively, never
     flushed: the frames it emits are the steady state of a tape that has been
     running since the transport started, and the partial frame it is holding at
     any moment is simply the next fragment's first frame. Never calling flush()
     is also what keeps encoder PADDING out of the stream entirely. */
  async function encodeAndQueue(chs, n) {
    if (!enc) return;
    const planar = new Float32Array(n * 2);
    planar.set(chs[0].subarray(0, n), 0);
    planar.set((chs[1] || chs[0]).subarray(0, n), n);
    enc.encode(new G.AudioData({
      format: "f32-planar", sampleRate: st.sr, numberOfFrames: n, numberOfChannels: 2,
      timestamp: Math.round((st.fedSamples - n) / st.sr * 1e6), data: planar }));
    // wait for the encoder to have SWALLOWED this input before muxing what came
    // back. Correctness does not depend on it — a frame that arrives late simply
    // rides the next fragment, and the tfdt arithmetic is identical either way —
    // but a fragment that carries its own segment keeps the buffer ahead of the
    // playhead, which is what backpressure is counting.
    const until = nowMs() + 4000;
    while (enc.encodeQueueSize > 0 && nowMs() < until) await tick(4);
    await tick(0);
    if (!chunkQ.length) return;
    const batch = frameBatch(chunkQ, st.sr);
    chunkQ = [];
    // THE INIT SEGMENT WAITS FOR THE ENCODER TO SPEAK. iOS' AudioEncoder hands
    // its AudioSpecificConfig back in the FIRST output's metadata — as a whole
    // ES_Descriptor, which is why the parent muxer carries extractAsc — and an
    // esds built before that arrives is the malformed init segment that killed
    // mms-aac on a real iPhone (WAV-FIRST v4.1). So the moov is built here, from
    // the description the encoder actually produced, and only then is anything
    // appended. Opus wants the same courtesy: its OpusHead is dOps.
    if (!ms) {
      try { await attachMedia(desc); }
      catch (e) { demote("attach: " + note(e)); return; }
    }
    if (!mux) return;
    if (anchor == null) anchor = batch.length ? batch[0].timestamp : 0;
    const frag = mux.pushChunks(batch);
    st.muxedSamples += batchSamples(batch);
    st.pushes++;
    if (frag && frag.length) pending.push(frag);
  }

  // ONE COPY PER CALL — a SourceBuffer takes one operation at a time and calls
  // us back on updateend. Evict behind the playhead first (memory on a phone is
  // the budget), then hand over the next fragment.
  function drain() {
    if (st.route === "segAB" || !sb || !ms || ms.readyState !== "open") return;
    if (sb.updating || !wants) return;              // ManagedMediaSource said stop
    try {
      const t = elTime(), b = sb.buffered;
      if (b.length && t - b.start(0) > BEHIND + 10) { sb.remove(b.start(0), t - BEHIND); return; }
      if (!pending.length) return;
      const frag = pending.shift();
      sb.appendBuffer(frag);
      st.appends++;
      if (st.firstAppendMs == null) st.firstAppendMs = Math.round(nowMs() - st.started);
      maybePlay();
    } catch (e) {
      demote("append: " + note(e));
    }
  }

  /* ---- attach, in two halves and in this order ---------------------------
     The encoder is built and fed FIRST; the MediaSource is attached only once
     the encoder has produced a frame and, with it, the codec description the
     init segment has to carry. See encodeAndQueue above for why. */
  function makeEncoder(pick) {
    enc = new G.AudioEncoder({
      output: (c, meta) => {
        if (!desc && meta && meta.decoderConfig && meta.decoderConfig.description)
          desc = meta.decoderConfig.description;
        const d = new Uint8Array(c.byteLength); c.copyTo(d);
        chunkQ.push({ data: d, durationUs: c.duration, timestampUs: c.timestamp });
      },
      error: e => demote("encoder: " + note(e)) });
    enc.configure({ codec: pick.codec, sampleRate: pick.rate, numberOfChannels: 2, bitrate: 192000 });
  }
  async function attachMedia(config) {
    const pick = pickRef;
    const F = await loadFmp4();
    // the parent's own normalizer does the work: a bare AudioSpecificConfig is
    // used as-is, a CoreAudio-style ES_Descriptor is walked to its
    // DecSpecificInfo, and anything unparseable is synthesized from the rate
    // and channel count. None of that is re-implemented here.
    const cfg = (pick.name === "aac" && config && F.extractAsc)
      ? F.extractAsc(config, pick.rate, 2)
      : (config || null);
    mux = F.makeFmp4Mux({ codec: pick.name === "aac" ? "aac" : "opus",
                          sampleRate: pick.rate, channels: 2, codecConfig: cfg });
    const Ctor = MSctor();
    ms = new Ctor();
    const isMMS = !!(MMSctor() && ms instanceof MMSctor());
    st.route = (isMMS ? "mms-" : "mse-") + pick.name;
    st.codec = pick.name; st.mime = pick.mime;
    // the parent's hard-won order (WAV-FIRST v3.1): remote playback off BEFORE
    // the attach or sourceopen never fires on a ManagedMediaSource, and a
    // background carrier must never be an AirPlay target anyway.
    try { el.disableRemotePlayback = true; } catch (e) {}
    try { el.setAttribute("x-webkit-airplay", "deny"); } catch (e) {}
    el.loop = false;                               // a stream does not loop; it continues
    let attached = false;
    if (isMMS) { try { el.srcObject = ms; attached = true; } catch (e) {} }
    if (!attached) { msUrl = URL.createObjectURL(ms); el.src = msUrl; }
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("sourceopen never fired")), 4000);
      ms.addEventListener("sourceopen", () => { clearTimeout(t); res(); }, { once: true });
    });
    sb = ms.addSourceBuffer(pick.mime);
    sb.mode = "segments";                          // tfdt is explicit; nothing is inferred
    sb.addEventListener("updateend", () => { drain(); pump(); });
    sb.addEventListener("error", () => demote("sourcebuffer error"));
    if (isMMS) {
      try { ms.addEventListener("startstreaming", () => { wants = true; drain(); pump(); }); } catch (e) {}
      try { ms.addEventListener("endstreaming", () => { wants = false; }); } catch (e) {}
      try { wants = ms.streaming !== false; } catch (e) {}
    }
    await new Promise((res, rej) => {
      sb.addEventListener("updateend", res, { once: true });
      sb.addEventListener("error", () => rej(new Error("init segment rejected")), { once: true });
      sb.appendBuffer(mux.initSegment());
    });
    el.muted = false;
  }
  // THE ELEMENT DOES NOT START ON A THIN BUFFER, and that is a measured rule
  // rather than a cautious one. Playing from the first append means the
  // playhead is chasing the producer, and the first time it catches it the
  // decoder rebuffers — measured on this carrier at 48 kHz with a 480 Hz test
  // tone, one 28-sample (0.58 ms) phase slip about two seconds in, and then not
  // one more sample of drift for thirty-four seconds. A rebuffer is not a seam,
  // but a listener cannot tell them apart, so the fix is to owe the decoder a
  // second of runway before asking it for anything: PRIME_SEC of stream on the
  // buffer, then play. It costs a few hundred milliseconds of time-to-first-
  // sound, which WAV-FIRST's firstSegSec already spends deliberately for the
  // same reason.
  function maybePlay() {
    if (playStarted || st.route === "segAB") return;
    // …but never DEADLOCK on the runway: with short segments the backpressure
    // ceiling can be lower than PRIME_SEC, and a playhead that never moves is a
    // pump that never drains. Saturated backpressure is all the runway there is
    // going to be, and three seconds of trying is the backstop under that.
    if (streamEnd() < PRIME_SEC && unplayed() < AHEAD && nowMs() - st.started < 3000) return;
    playStarted = true;
    const p = el.play(); if (p && p.catch) p.catch(() => {});
    lightSession("playing");
  }

  /* ---- the fallback tier: two elements, blobs, and the SAME baked overlap --
     For any platform with no usable MediaSource — no MSE constructor, no
     demuxable fMP4 MIME, no WebCodecs encoder, or a render rate no offered
     codec will take. Detected, never sniffed: every one of those is a question
     asked of the platform in pickCodec() above, and the answer is recorded in
     st.why so a device log says which door it went through.
     The segments still overlap and the fades are still baked, so the join needs
     no volume automation at all: the incoming element simply STARTS while the
     outgoing one still has OV seconds to run, both at full level, and the two
     windows sum exactly as they were designed to. `ended` is the backstop, and
     it is the one event that fires while a page is hidden. */
  const ab = { q: [], cur: null, on: null, off: null, timer: null, urls: [] };
  function abQueue(seg) {
    const n = seg.pcm[0].length;
    const url = URL.createObjectURL(new Blob(
      [wavBytes(seg.pcm, n, seg.sampleRate)], { type: "audio/wav" }));
    ab.urls.push(url);
    while (ab.urls.length > 4) { try { URL.revokeObjectURL(ab.urls.shift()); } catch (e) {} }
    ab.q.push({ url, n, ov: seg.overlap | 0, sr: seg.sampleRate });
    if (!ab.cur) abNext();
    else abPreload();
  }
  function abPreload() {
    const idle = ab.on === el ? elB : el;
    if (!idle || !ab.q.length) return;
    if (idle.src !== ab.q[0].url) { idle.src = ab.q[0].url; try { idle.load(); } catch (e) {} }
  }
  function abNext() {
    const next = ab.q.shift();
    if (!next) return;
    const play = (ab.on === el && elB) ? elB : el;
    play.loop = false;
    if (play.src !== next.url) { play.src = next.url; }
    const p = play.play(); if (p && p.catch) p.catch(() => {});
    ab.off = ab.on; ab.on = play; ab.cur = next;
    if (st.firstAppendMs == null) st.firstAppendMs = Math.round(nowMs() - st.started);
    lightSession("playing");
    // start the NEXT one when this one has exactly its overlap left to run. A
    // setTimeout can be late and never early, so it is trimmed by a few ms and
    // `ended` is left armed underneath it.
    clearTimeout(ab.timer);
    const lead = Math.max(0, (next.n - next.ov) / next.sr * 1000 - 8);
    ab.timer = setTimeout(() => { abPreload(); abNext(); pump(); }, lead);
    play.addEventListener("ended", () => { if (ab.on === play) abNext(); }, { once: true });
    abPreload();
    pump();
  }

  /* ---- the watchdog: a dead primary route must never mean silence ------- */
  function demote(why) {
    if (st.route === "segAB") return;
    st.demoted = why; st.why = why;
    try { if (enc && enc.state !== "closed") enc.close(); } catch (e) {}
    try { if (ms && ms.readyState === "open") ms.endOfStream(); } catch (e) {}
    if (msUrl) { try { URL.revokeObjectURL(msUrl); } catch (e) {} msUrl = null; }
    enc = null; ms = null; sb = null; mux = null; pending = []; chunkQ = []; anchor = null;
    try { el.srcObject = null; } catch (e) {}
    st.route = "segAB";
    console.warn("[nukernel] stream carrier demoted to segAB:", why);
    // the tail is kept: the fallback's segments still overlap, so the join the
    // demotion lands on is the same join every other segment gets.
    pump();
  }
  function watch() {
    if (!st.running) return;
    const t = elTime();
    if (t !== lastT) { lastT = t; lastTAt = nowMs(); }
    if (st.firstSoundMs == null && t > 0.05) st.firstSoundMs = Math.round(nowMs() - st.started);
    if (st.route !== "segAB") {
      if (st.firstAppendMs == null && nowMs() - st.started > 8000) return demote("no first append in 8 s");
      if (st.firstAppendMs != null && lastTAt && nowMs() - lastTAt > 3000 &&
          streamEnd() - t > 1 && !el.paused) return demote("currentTime frozen 3 s");
    }
    maybePlay(); drain(); pump();
  }

  /* ---- the public face -------------------------------------------------- */
  return {
    // START, inside the play gesture. The element is the caller's — created and
    // unlocked in that same gesture and kept for the session, which is
    // audio/bounce.js's element discipline and is already device-proven.
    async start(o) {
      if (st.running) return st.route;
      st.running = true; stopped = false; st.started = nowMs();
      st.gen = (o && o.gen) || 0;
      st.nextBar = (o && o.fromBar) || 0;
      st.sr = (o && o.sampleRate) || opts.sampleRate || 48000;
      const pick = forced === "segAB" ? { ok: false, why: "forced" } : await pickCodec(st.sr);
      if (pick.ok) {
        pickRef = pick; st.codec = pick.name; st.mime = pick.mime;
        // the route is NAMED before the attach because the attach is what may
        // fail, and a device log that says only "segAB" cannot say what it fell
        // from. stats().demoted carries the reason if it does.
        st.route = (MMSctor() ? "mms-" : "mse-") + pick.name;
        try { makeEncoder(pick); }
        catch (e) { st.why = note(e); demote("encoder config: " + st.why); }
      } else {
        st.route = "segAB"; st.why = pick.why;
        console.warn("[nukernel] stream carrier: fMP4 unavailable —", pick.why);
      }
      watchdog = setInterval(watch, 250);
      pump();
      return st.route;
    },
    // THE SONG CHANGED. Nothing is flushed and nothing is removed: the old
    // generation is already in the buffer and keeps playing while the new one
    // renders, and the two meet at the ordinary overlap-add. The only thing
    // that moves is which bar the NEXT ask is for.
    retarget(gen, fromBar) {
      st.gen = gen;
      pendingFrom = fromBar == null ? 0 : fromBar;
      pump();
    },
    stop() {
      stopped = true; st.running = false;
      clearInterval(watchdog); watchdog = null;
      clearTimeout(ab.timer);
      try { if (enc && enc.state !== "closed") enc.close(); } catch (e) {}
      try { if (ms && ms.readyState === "open") ms.endOfStream(); } catch (e) {}
      if (msUrl) { try { URL.revokeObjectURL(msUrl); } catch (e) {} msUrl = null; }
      for (const u of ab.urls) { try { URL.revokeObjectURL(u); } catch (e) {} }
      ab.urls = []; ab.q = []; ab.cur = null;
      try { el.pause(); } catch (e) {}
      lightSession("paused");
    },
    // WHAT THE OUTSIDE READS, and the two numbers that matter are the last two.
    // stitchDriftSec is muxed-sample arithmetic against what the demuxer says it
    // can play: it is the measurement that caught WebKit's mp3 stitching
    // inferring timestamps, and it is what would catch it coming back. aheadSec
    // is honest about the PLAYABLE path only.
    stats() {
      let bufEnd = 0;
      try { if (sb && sb.buffered.length) bufEnd = sb.buffered.end(sb.buffered.length - 1); } catch (e) {}
      const w = whereIs();
      return { route: st.route, why: st.why, demoted: st.demoted, codec: st.codec,
               sampleRate: st.sr, running: st.running,
               segments: st.segments, pushes: st.pushes, appends: st.appends,
               unplayed: unplayed(), loops: st.loops, gen: st.gen, nextBar: st.nextBar,
               primed: playStarted, primeSec: PRIME_SEC,
               bar: w.bar, playingGen: w.gen,
               elTime: elTime(), elPaused: el ? el.paused : null,
               // the priming anchor, READ off the first encoded chunk and never
               // assumed: AAC-LC's ~2112 samples of encoder delay arrive here,
               // and a stream that assumes zero starts 48 ms inside itself
               anchorSamples: anchor,
               fedSec: +(st.fedSamples / (st.sr || 1)).toFixed(6),
               muxedSec: +(st.muxedSamples / (st.sr || 1)).toFixed(6),
               bufferedEnd: +bufEnd.toFixed(6),
               aheadSec: +(streamEnd() - elTime()).toFixed(3),
               stitchDriftSec: bufEnd ? +(st.muxedSamples / (st.sr || 1) - bufEnd).toFixed(6) : 0,
               firstAppendMs: st.firstAppendMs, firstSoundMs: st.firstSoundMs,
               errors: st.errors.slice() };
    },
    // the ledger, for a probe that wants to know where every join landed. Stream
    // seconds, so a decoded capture can be cut at exactly the right samples.
    joins: () => ledger.map(c => ({ t: +(c.t0 + c.dur).toFixed(6), bar: c.fromBar, gen: c.gen })),
  };
}
