# WAV-FIRST — the pocket-proof mobile output path

**Decision (Paul, 2026-07-07):** on mobile, the audible path is a real `<audio>`
element playing real rendered media, *throughout* — never a live WebAudio graph.
"Orient the entire final mix around playing the WAV. If it means the system is
less dynamic, fine."

## Why no patch to the current design can work

When iOS interrupts/suspends the AudioContext (app switch, screen lock, pocket),
the **entire live graph stops executing** — worklet, gain ramps, Atomics mute,
everything. The frozen-quantum "chunk loop" happens *below* the graph, at the
MediaStream/CoreAudio boundary, in the window between iOS freezing audio I/O and
the page running any handler. As long as the audible path mirrors a live graph
into a stream, that window exists and cannot be closed from JS. A real media
element playing a real file is first-class media to iOS: it keeps playing in the
background, survives screen lock, and cannot loop-chunk because no live graph is
in the audible path.

## Facts this design stands on (verified 2026-07-07)

- `faust/stream-renderer.js` mixes the **full press-parity mix** when PCM buffers
  are supplied: found via `FP.mixPCM` (whole-song accumulators, ~line 254) and
  sampler via windowed `SP.mixPCM` **even in the live-bar path** (~line 498).
- The current background-WAV producer (`renderWav` in `faust/stream-worker.js`)
  ships `buffers:{}, speech:null` — today's bg WAV is **synth-only** (no found,
  no sampled kits, no vocoder). It must not be the model for this feature.
- The live conductor (`faust/live.js`) already decodes every found source and
  sampler zone on the main thread (`bufCache`, `samplerBufs`, `speechCache`) for
  native scheduling — the PCM the worker needs already exists there.
- The ring conductor's bar-walk (`feed`/`postFeed` + `openLive`) preserves musical
  position across state changes. Reusing it keeps WAV-first **fully dynamic**:
  steering takes effect at the next segment boundary, not at a song restart.

## Architecture

New mode `wavOut` in `FaustLive.exploreLive`:

- **Predicate:** auto-on when `isMobile`; `?wavOut=1` forces it anywhere (desktop
  Chromium included — that's the headless test hatch), `?wavOut=0` escapes back
  to the ring path. Desktop default (incl. desktop Safari) is UNCHANGED: ring/
  worklet path plus the existing bg-WAV handoff machinery.
- In wavOut mode the conductor boots **no** AudioWorklet, no rings, no
  MediaStream element, no bg-WAV producer. The AudioContext is used only for
  `decodeAudioData` (PCM prep) — it may suspend freely; nothing audible depends
  on it.

### Producer (stream-worker, new sink)

- `{type:"openLiveSegs", gen, state, buffers, speech, segSec, firstSegSec}` —
  same engine open as `openLive` (buffers + speech INCLUDED, so bars carry the
  sampler layer) and the same `feedBar` protocol, but the pump drains rendered
  bars into an in-worker accumulator and posts
  `{type:"seg", gen, idx, wav(ArrayBuffer, transferred), t0Sec, durSec, barMap,
  rmsEnv(Float32Array ~10 Hz)}` per segment instead of writing a SAB ring.
- **Found in live bars:** the live-bar path must ALSO mix found events
  (chops/beds) from `buffers` via windowed `FP.mixPCM`, mirroring how ~line 498
  windows the sampler (`{base,len,total}`). The bed re-anchors at chord 0 of each
  bar exactly like `scheduleNative` does natively. If bed windowing fights back,
  fall back to chops-only in v1 and report; beds are the ambience layer and the
  loss must be called out, not silent.
- Segment cuts land **on chord-bar downbeats** (accumulate whole bars; cut when
  ≥ segSec). Within one open, consecutive segments are sample-continuous by
  construction. Backpressure: at most 2 unplayed segments ahead.
- `firstSegSec` ≈ 4 s (bar-aligned) for time-to-first-sound, then `segSec`
  (default 16 s, `opts.segSec` override).

### Conductor (live.js wavOut branch)

- Ships PCM once per open: found `bufCache` + sampler `samplerBufs` + speech —
  copies (structured clone), NOT transfers of the live caches.
- State-change detection reuses the existing signature machinery (`sigOf`/
  `bgSignature` family). On sig change: `gen++`, re-open with the SAME musical
  cursor semantics the ring path uses (bar-aligned bridge), next segment comes
  from the new open. In-flight segments of the old gen still play out.
- **Playback: two `<audio>` elements (A/B)**, both unlocked inside the goLive
  gesture (muted silent-WAV `play()`, cf. `silentWavDataUri`). Segment k plays on
  A while k+1 is preloaded on B (`src` = blob URL, `load()` as soon as it lands).
  Swap at boundary: foreground = timer + `timeupdate` guard; background = the
  `ended` event (fires during hidden playback; `loop=false`). If `play()` on the
  idle element is refused in background, fall back to src-swap on the single
  playing element at `ended` (always permitted; accept the small gap — it lands
  on a downbeat).
- Old blob URLs revoked once their segment finishes; keep ≤ 3 alive.
- **Handle parity** so explorer.html needs (at most) flag plumbing: `rms()` reads
  the shipped `rmsEnv` at element `currentTime`; `onBar` fires from `barMap` +
  `currentTime` polling (foreground-only concern); `layers()`/`clickMon`/
  telemetry keep their stub shapes; `runwaySec()` = rendered-not-yet-played
  seconds; `outputRoute` = `"wavSeg"`. MediaSession metadata/playbackState
  maintained exactly as today.
- goHidden/goVisible in wavOut mode: **no-ops for audio** (that is the point);
  they only maintain MediaSession state. The survival machinery stays for the
  non-wavOut paths.

## Gates (all must pass before device test)

1. **Seam continuity (node or headless):** across ≥ 3 segment joins of a stable
   state, the boundary sample step `|x_next[0] - x_prev[end]|` is within the
   distribution of intra-segment steps (no discontinuity by construction).
2. **Full-mix presence:** for a found-heavy state (e.g. spokenword/jungle),
   segments rendered WITH buffers differ from synth-only and carry higher RMS;
   sampler-weighted acoustic genres audibly carry the kits (RMS delta gate).
3. **Headless wavOut probe (`?wavOut=1`, chromium):** boots to sound, RMS nonzero
   sampled tightly across ≥ 3 seam crossings, a genre swap mid-run takes effect
   (new-gen segments arrive and play), zero console errors.
4. **Render keeps up:** segment render time < 1/3 segment duration on the dev
   box (log the rate; phones are slower — headroom is the budget).
5. **Existing gates stay green:** `engine.test.js`, `faust/live-test-run.js`
   (desktop ring path), `validate-genres.js --quick`, and the bg-survival probe
   (desktop survival machinery unchanged).

## v2 — seam repair (device feedback, Paul 2026-07-07)

Device test found: (a) pauses/gaps between sections, (b) clicks on kick
transients. Diagnosis (node scan, house/jungle full-mix vs synth-only): the
rendered audio is clean — zero clipped samples, transient profile identical to
the ring path's bytes. Both defects are SEAM MECHANICS: butt-spliced segments
swapped on `ended` leave a device gap, and v1 cut segments exactly ON downbeats,
so every splice error lands on a kick (the "masking" assumption was backwards —
the splice truncates the ring-out and steps into the transient). Section changes
re-open the stream (new gen), and if old-gen segments drain before the new gen's
first segment lands, playback stalls ("pauses").

Fixes:

1. **Baked crossfade overlap at every seam.** Segments overlap by OV ≈ 120 ms of
   identical stream content: segment k's tail carries a baked equal-power fade-out
   over its last OV, segment k+1 begins OV *before* the cut with the matching baked
   fade-in. Alignment: the overlap window sits in the pre-downbeat pocket and ENDS
   exactly at the downbeat — A dies before the kick, B plays the kick clean at
   full level, one element only. Playback starts B early (target `A.duration - OV`
   via `timeupdate` + trimmed `setTimeout`); jitter of ±OV/2 now yields a faded
   flam or a faded dip instead of a full-scale gap+step. `ended` stays as the
   backstop (worst case = v1 gap but with faded edges — no click). Micro-edges
   (~5 ms) baked on every segment head/tail as final insurance.
2. **No-stall gen cutover.** On a sig change (section or steer), the OLD gen keeps
   feeding and playing until the NEW gen's first segment blob is decoded and
   preloaded; only then cut at the next seam, with the same baked-crossfade
   overlap (old tail fade-out over new head fade-in — the ring path's bridge,
   reconstructed at the media layer). A gen change must never leave the pipeline
   with zero playable segments.
3. **Gates updated accordingly:** the seam gate proves the aligned overlap sums to
   unity (linear-domain check within epsilon) and that heads/tails carry the baked
   fades; the headless probe must cross at least one SECTION boundary and one
   steer with no silent run ≥ 300 ms; all v1 gates stay green.

## v3 — one player, continuous append (Paul, 2026-07-07: "feed into the player,
## make it the main out, skip the switching")

v2's element-pair seams still gapped on device. v3 removes switching entirely:
on mobile, the main out is ONE `<audio>` element driven by **ManagedMediaSource**
(iOS 17.1+; fall back to classic `MediaSource` where that's what exists — that is
also the headless-chromium test path), with rendered audio APPENDED continuously.
A synthesized radio station. The v2 A/B element machinery is DEMOTED to the
fallback tier for devices with neither API (or an unsupported codec) — not
deleted.

- **Codec:** source buffers reject PCM/WAV, so the worker encodes **MP3**
  (vendored pure-JS encoder — self-contained, no CDN, deterministic; commit the
  vendored source under `faust/vendor/`). ONE encoder instance per stream
  lifetime feeding `audio/mpeg` in `mode="sequence"` — continuous frames, no
  per-chunk encoder-delay gaps by construction. Feature-detect
  `isTypeSupported("audio/mpeg")`; if absent, fall back (fMP4/AAC via WebCodecs
  is documented follow-up, not v1 of v3). Bitrate ~192–256k CBR; measure encode
  cost in the rate gate (phone budget: render+encode must stay well under
  realtime).
- **Gen changes happen INSIDE the stream.** The two producer workers already
  render old/new gens in parallel; the conductor (or worker pair) crossfades the
  two PCM streams over the bridge window and appends the BLENDED audio to the
  same source buffer. No second element, no playback-side fades, nothing to
  time. Steering latency = append cadence (a bar or two), better than v2's
  segment boundary.
- **Buffer hygiene:** honor MMS `startstreaming`/`endstreaming` (append when the
  UA asks), keep a bounded forward buffer (~30–60 s), `SourceBuffer.remove()`
  behind `currentTime` to bound memory. MediaSession unchanged.
- **Handle parity:** `outputRoute` reports `"mms-mp3"` / `"mse-mp3"` /
  `"segAB"` (fallback) so device state is inspectable; rms/onBar keep working
  off the shipped envelopes/barMaps (now per append batch).
- **Gates:** PCM continuity gates (seam test) still apply pre-encode. The
  headless probe runs the MSE path in chromium (classic MediaSource): single
  element, zero silent runs ≥ 300 ms across seams + a section boundary + a
  steer, buffered ranges bounded, zero errors. v2 fallback path keeps its
  existing probe coverage (force it via a flag, e.g. `?segAB=1`). All prior
  gates stay green.

## v3.1 — boot latency + self-healing (device feedback, Paul 2026-07-07 night)

Device: mobile hung forever at "scheduling the first bar"; desktop eventually
started; both slow. Two stacked causes:

- **MMS deadlock (mobile-never)**: `ManagedMediaSource` requires
  `disableRemotePlayback = true` on the element BEFORE attach or `sourceopen`
  never fires; and `mmsWants` started false with only a `startstreaming` edge to
  raise it. FIXED (2026-07-07): DRP + airplay-deny set pre-attach, `mmsWants`
  synced from `mediaSrc.streaming` at sourceopen, FWD_CAP bounds both routes.
- **Decode-gated boot (slow-everywhere)**: the wav route's producer open waits on
  `decodeFor(state)` — EVERY found/sampler/speech PCM fetched+decoded before bar
  1 renders. The ring path never did this (native layer skips missing buffers
  per bar; they pop in when decoded).

v3.1 contract:

1. **Open immediately, stream buffers in.** Producers open with empty buffers;
   the conductor ships each PCM as it decodes via a new `addBuffers` worker
   message; the renderer merges into its live buffer table so bars baked AFTER
   arrival include the layer (matching ring-path pop-in semantics). The vocoder
   speech carrier keeps its existing non-blocking gate. First sound must not
   wait on any found/sampler fetch.
2. **Boot instrumentation.** status() stage timeline + `handle.bootStats()`
   (decode / worker-init / first-flush / first-append / first-sound ms) so a
   slow stage is visible on-device instead of a mute mystery.
3. **Watchdog + auto-demotion.** The segAB elements are created+unlocked inside
   the gesture on ALL routes (cheap dormant insurance). On the mp3 route:
   sourceopen absent ~4 s after attach, no first append ~8 s after boot, or
   currentTime frozen ~3 s after first append → tear down the mp3 pipeline,
   flip the route to segAB, re-open the current gen through the normal open
   machinery, push the reason into errors, report via `__wavState.demoted` and
   `outputRoute()`. A dead primary route must never again mean silence.
4. **Gate the failure mode.** The chromium probe gains (a) a boot-time
   assertion (first sound within a bound), and (b) a stall-injection pass — a
   shimmed `ManagedMediaSource` whose sourceopen never fires (query-flag
   installed in the test page) must produce automatic demotion to segAB and
   audible sound, zero manual action. All prior gates stay green.

## v4 — fMP4/AAC append (device feedback, Paul 2026-07-07 night: "a little
## lurchy… maybe do the AAC path")

Device on mms-mp3: plays, survives pocket, but "a little lurchy… comes and
goes… as time goes on the snare and the lead and bass go out of whack." Prime
suspect: WebKit's `audio/mpeg` MSE stitching infers timestamps from MP3 frames
per append and drifts. New `__wavState().stitchDriftSec` (appendedSec −
buffered.end) measures exactly this on-device. The structural cure is fMP4,
where every sample block carries an EXPLICIT baseMediaDecodeTime — nothing is
inferred, nothing can drift.

1. **Muxer:** hand-rolled audio-only fragmented-MP4 muxer (`faust/fmp4.js`,
   env-agnostic UMD like mp3-stream.js): init segment (ftyp + moov with mp4a
   esds / Opus dOps), then one moof+mdat per encoded batch with tfdt
   baseMediaDecodeTime in media timescale (= sample rate), monotonic by
   construction. Node-unit-testable (box walker: structure, sample counts, tfdt
   continuity).
2. **Encoder:** WebCodecs `AudioEncoder` in the SAME dedicated encoder worker,
   fed the SAME blended PCM stream (bridges/fades identical): AAC-LC
   (`mp4a.40.2`) for the device. Chromium-on-linux usually lacks AAC encode, so
   the muxer path is ALSO wired for **Opus-in-fMP4** (`audio/mp4;
   codecs="opus"`) — that is the headless gate's route; identical muxer,
   identical append machinery, different codec string.
3. **Route ladder** (feature-detected, existing tiers demoted not deleted):
   mms-aac → mse-aac → mse-opus → mms-mp3/mse-mp3 (lamejs) → segAB. Query
   overrides for testing (`?codec=mp3`, `?codec=opus`, `?segAB=1`). Watchdog
   demotion applies at every tier.
4. **Gates:** (a) node fmp4 unit gate (box structure + tfdt monotonicity +
   sample-count conservation across pushes and a gen bridge); (b) chromium pass
   on the fMP4 route asserting `stitchDriftSec` stays < 0.05 over a 30s+ run
   with a steer (the lurch, measured, gated); (c) every existing pass (mse-mp3
   forced, segAB, mmsStall demotion) stays green. rmsEnv/barMap/appendedSec
   accounting preserved per codec (mind AAC priming ~2112 samples: use the
   encoder chunk timestamps, don't assume 0-origin).

## v4.1 — iOS AAC append repair (device log, Paul 2026-07-08)

First real-device run of v4 (iPhone iOS 18.7): route `mms-aac` selected, then at
first append `SourceBuffer error` + `appendBuffer: The object is in an invalid
state` — the buffer errored on the init/first segment and every later append
throws. Watchdog demoted to segAB at 7.1 s and the session played on (the
self-healing worked; the log panel captured everything). Diagnosis targets, in
likelihood order — classic iOS `AudioEncoder` behaviors Chromium's Opus gate
cannot exercise:

1. **ADTS framing**: iOS AAC encoders commonly emit ADTS-framed packets; muxed
   raw into fMP4 samples they poison the demux. Detect the 0xFFF sync per
   chunk, strip the 7/9-byte ADTS header, mux raw AAC.
2. **Missing `decoderConfig.description`**: if absent, the esds gets no/garbage
   AudioSpecificConfig. Synthesize the 2-byte ASC (AAC-LC, sr index, channels)
   — from the ADTS header when present, else from the configured rate/channels.
3. **Runtime codec step-down**: an init/first-append rejection should walk the
   codec ladder (aac → opus → mp3, fresh MediaSource attach on the SAME
   unlocked element — no gesture needed) before surrendering to segAB. Straight-
   to-segAB remains correct only after the ladder exhausts or for mid-stream
   death after a healthy first append.
4. **Diagnostics for the next device paste**: on SourceBuffer error / append
   failure, push into `errors`: codec string, description present/absent+bytes,
   ADTS detected or not, init-segment length + first-32-bytes hex, first media
   segment length. The wavDebug log then carries a remote-diagnosable record.
5. **aheadSec honesty (segAB)**: superseded gens' queued segments inflated the
   meter to 130 s in the device log; purge/exclude them so the meter reports
   the playable path.

Gates: node unit gate for ADTS strip + ASC synthesis (synthetic ADTS frames,
header variants with/without CRC); all existing passes green; chromium fMP4
pass unchanged (opus has no ADTS analog — the strip must be codec-gated).

## Explicitly out of scope (v1)

- MSE/ManagedMediaSource gapless (revisit if downbeat-masked seams are audible
  on device).
- Element-recycle drift machinery (`elRecycleSec`) — N/A to file playback.
- Making the legacy `renderWav` bg producer full-mix (superseded on mobile by
  wavOut; desktop Safari handoff keeps it as-is for now).
