# ENGINE AUDIT — 2026-07-25

A 45-agent adversarially-verified audit of the core audio path (scheduler /
score / render / sampler / found / ring). 37 findings confirmed, 2 refuted.
Every finding below survived a dedicated refutation pass; verifier notes are
preserved in the session record. THE LAW for all fixes: byte-determinism of
events and rendered PCM (test/meter.test.js head gate + ./verify.sh).

Status legend: [ ] open · [x] fixed (date) · [~] superseded/wontfix (why).

## Tier 1 — safe bug fixes (apply first)

### [x] (2026-07-25) Superseded/stopped pumps never eng.close(): a retired gen's whole decoded-PCM buffer table stays live in the worker until the next open on that worker
*engine/faust/stream-worker.js:299 · ring*

runLivePump's stopped exit (stream-worker.js:299), runPump's (:232) and runBarAccumPump's segstopped exit (:356) return without eng.close(); only the natural-EOS paths close. ST — every unit's WASM procs, insert chains, samplerUnits note lists, and (wavOut path) ST.buffers holding ALL of the gen's decoded found/sampler Float32 PCM (a full GM-sampled genre = tens of MB shipped via addBuffers/open) — stays referenced by the module-global eng until the NEXT openLive* on that worker replaces it. With the two-worker ping-pong, worker k holds gen N's full table for the entire lifetime of gen N+1.

**Impact:** Tens of MB of dead PCM + WASM instances held per stale gen — on mobile (the wavOut path, memory-tightest environment) this roughly doubles steady-state audio memory across every cutover; on the ring path it pins the retired ring's proc fleet.

**Fix:** Call eng.close() on the post-open stopped/segstopped exits (opChain serializes pumps, so no newer open's ST can exist yet when a superseded pump reaches its exit; the pre-open bails can also close safely since the previous pump has already exited). Also clear liveBuffers/liveSpeech on 'stop'.

**Verifier:** Confirmed with one impact misattribution. The core mechanism holds: all stopped/superseded pump exits (stream-worker.js:173/192/232 runPump, :245/263/299 runLivePump, :312/356 runBarAccumPump) return without eng.close(); close() is just ST=null (stream-renderer.js:790), so the module-global eng pins the retired ST (fx/rev/master procs, unit proc pools, insert chains, ingest queues, ST.bars, ST.buffers) until the next open on that worker. This bites the RING path on every crossfade: commitFade (live.js:805) retires the old producer with 'stop' (not feedEos), so runLivePump always takes the no-close exit, and the worker isn't reopened until the next-next crossfade — indefinite if the user parks. Measured pinned WASM per retired gen: fx_bus 8.0MB + rev_bleed 4.0MB + color reverb 0.3-4MB + master + voice pools (0.1-0.5MB each) ≈ 13-25MB, plus the uncleaned liveBars module-global (the whole gen's bar specs). The fix is safe (opChain serializes pumps; the newer open's ST cannot exist yet) and touches no rendered bytes, so determinism is preserved. CAVEAT: the headline mobile/wavOut claim ('tens of MB decoded PCM retained, doubles steady-state memory') is a real phenomenon but the wrong mechanism — at wavOut cutover the old worker gets feedEos (live.js:1717) and exits via segeos (stream-worker.js:355) which DOES close; the gen-N PCM survives via the module-globals liveBuffers/liveSpeech (same object as ST.buffers), and the suggested 'clear on stop' would miss it since the old wavOut worker never receives stop at cutover — the clear must also happen on the eos/segeos exit. Ring opens ship buffers:{} (live.js:688), so no PCM on that path; full stopLive terminates workers, so that case was never a leak.

### [x] (2026-07-25) Worker-global liveBars (and renderer ST.bars) retain every bar spec ever fed — unbounded ~15KB/bar leak on a long-playing stream
*engine/faust/stream-worker.js:494 · ring*

liveBars is append-only ({type:'feedBar'} handler, stream-worker.js:494); runLivePump/runBarAccumPump read liveBars[cursor] and only ever advance cursor — entries are never released until the next openLive* resets the array. Each retained bar carries the full morphed units spec + the bar's events (measured for house_s7: units JSON 10,061 bytes for 16 units incl. 33 sampler zones + ~34 events ≈ 4,752 bytes ⇒ ~15KB serialized, more as live JS objects). stream-renderer.js:580 has the same pattern (ST.bars.push, indexed by n in renderChunk, never nulled), plus ST.sweeps.

**Impact:** At a ~4s chord-bar that is ~13,500 bars ≈ 200+ MB retained in the producer worker over the 13.5h play horizon the ring counters are designed for (~15-40MB/h); the app's core use case is exactly the hours-long ambient session on one genre (no reopen ever resets it). Same leak on the mobile wavOut path per gen.

**Fix:** In runLivePump/runBarAccumPump: const barSpec = liveBars[cursor]; … liveBars[cursor] = null; after renderChunk (indexing is preserved; repoint already replaces the whole array). In stream-renderer renderChunk live mode: ST.bars[n] = null after use (order is enforced by ST.cursor), and drop consumed ST.sweeps below ST.swi periodically.

**Verifier:** Append-only retention confirmed on both sides: stream-worker.js liveBars (push at :494, reads only at [cursor] :277/:341, released only by openLive/openWav resets at :438/:448/:459 — never during a session) and stream-renderer.js ST.bars/:580 + ST.sweeps/:579 (indexed read :596, ST.swi only advances :695, never nulled). Every fed bar is a distinct structured-cloned object carrying the full units spec + events (live.js postFeed :692/:1658), and live.js produceAndRoute (:859) feeds the same stream indefinitely while the chain signature is unchanged — a stationary hours-long session (the app's core use case) never resets. Not by-design: renderer :628 already prunes su.notes citing the 'unbounded live stream', proving this retention class was meant to be bounded. Suggested fix (null consumed slots) preserves indexing, liveBars.length (used for nChunks status), and byte-determinism since entries are never re-read.

### [x] (2026-07-25) Archive fallback re-downloads the prefix on each escalation and the partial-decode fallback fetches the whole file uncapped
*engine/faust/found-player.js:594 · found*

In the no-local-cache path, the lead-in escalation refetches from byte 0 each round (1MB, then 4MB, then 8MB = 13MB transferred for an 8MB budget, each prefix fully re-decoded and re-scanned by analyzeActive). Worse, when a partial buffer fails decodeAudioData (line 592-596), the retry is a full un-Ranged fetch of the entire file with no FOUND_MAX_BYTES cap — a large archive.org FLAC/WAV (these items often carry 100MB+ derivatives) gets pulled whole on a phone.

**Impact:** Only hits sources missing from found-manifest.json (it already warns), but when it hits: up to ~1.6x wasted transfer on escalation, and a potentially unbounded download + decode on the partial-decode-failure path — seconds of stall and real data cost on mobile.

**Fix:** Escalate with `Range: bytes=<prev>-<next-1>` and concatenate ArrayBuffers before decode (decode still needs the prefix, but transfer isn't repeated), and cap the full-file fallback fetch with a Range of FOUND_MAX_BYTES (a container that won't decode from an 8MB prefix should fail over to skip, not download whole).

**Verifier:** Confirmed in code: the escalation loop at engine/faust/found-player.js:578-606 always fetches Range bytes=0-(N-1), re-transferring and re-decoding the prefix each round (1MB+4MB+8MB = 13MB for the 8MB FOUND_MAX_BYTES budget, analyzeActive re-scans each time); and the partial-decode fallback at line 594 (plus the fetch-error fallback at 587) does an un-Ranged full-file fetch with no cap, silently defeating FOUND_MAX_BYTES — significant on Safari/iOS where decodeAudioData commonly rejects truncated streams. Path only triggers without a local cache (guarded by `if (!pick)`, warned at line 575) as the finding states, and it is reachable live (live.js:530/624/1551/1572). Not by-design (the byte cap exists to bound exactly this), well above 2% waste, and the fix (range concatenation + capped fallback) leaves the decoded PCM and all seeded score generation byte-identical.

### [x] (2026-07-25) live.chop leaks the ppsend GainNode; live.bed never disconnects its bus gains on natural end
*engine/faust/found-player.js:770 · found*

chop's onended disconnects dry/rev/del but not the pp gain created at line 765 (`tail.connect(pp); pp.connect(dests.pp)`) — inconsistent with its siblings, so every chop with ppsend leaves a GainNode attached to dests.pp until the engine GCs the source-less subgraph. Similarly, a bed that plays to natural completion only runs `setTimeout(() => live.beds.delete(handle), ...)` (line 874) — out/dry/rev are disconnected only via the explicit stop()/fade() paths, never on natural end.

**Impact:** Gradual audio-graph node accumulation on long rides in vox/chop-heavy genres (pp is the vocal lane's send); mostly cleaned by browser GC eventually, but the explicit-disconnect pattern the code already uses shows the intent — and on engines that keep connected nodes alive, this grows the graph the mixer must traverse.

**Fix:** Add `pp.disconnect()` (when created) to chop's onended, and have the bed's natural-end setTimeout call the same cleanup as stop() minus the source stop (try { out.disconnect(); } catch {} before deleting the handle).

**Verifier:** Both mechanisms hold exactly as described in engine/faust/found-player.js. (1) live.chop line 765 creates a ppsend GainNode connected to dests.pp, but the onended handler at line 770 disconnects only dry/rev/del — grep confirms no other disconnect site in the file touches pp, and stopAll/fadeAll disconnect nothing — so every ppsend chop leaves a GainNode on the pp bus until JS GC collects the source-less subgraph. (2) live.bed's natural-end path (line 874) is only a live.beds.delete setTimeout; out.disconnect() exists solely in stop() (864) and fade() (871), so a bed playing to completion leaves out/dry/rev (plus lp/schedBus on the scheduler leg) attached to the dests until GC; fadeAll only runs on genre transitions and never reaches a naturally-completed bed. Severity is modest (spec-wise the subgraphs are GC-eligible since downstream connections don't keep upstream nodes alive), but between GCs the dead nodes are live mixer inputs each render quantum, and the file's own pervasive explicit-disconnect pattern (lines 770, 826, 857, 864, 871 — the ZERO-STATIC node-churn discipline) shows the omissions are unintended, not design. The suggested fix is audio-graph teardown only and cannot affect buildEvents byte-determinism.

### [x] (2026-07-25) decodeUrlRaw zone cache is unbounded — decoded instrument PCM accumulates for the whole session
*engine/faust/sampler.js:440-451 · sampler*

The browser zone decoder caches every fetched zone wav as a decoded AudioBuffer promise in a module-level Map keyed by URL, with eviction only on fetch failure. A journey/exploration session that visits many genres (each pulling several multi-zone instruments, ~10-40 zones each of seconds-long 44.1k float PCM ≈ 0.2-1MB per zone) monotonically accumulates buffers; switching soundfonts via the switcher (11 alternate font sets shipped) multiplies the key space. Nothing ever frees a buffer no longer referenced by the current state's instruments. Code-trace finding (browser-only path, not node-reachable).

**Impact:** Long live sessions can pin hundreds of MB of decoded PCM — a real jetsam/OOM risk on the mobile WAV-first lane where memory pressure kills the tab (the exact background-survival scenario bg-survival guards).

**Fix:** Evict cache entries whose URLs are not referenced by the active state's instrument zones on state change (or a simple LRU with a byte budget). Safe with in-flight notes: playing AudioBufferSourceNodes hold their own references to the buffer; deleting the Map entry only allows future GC.

**Verifier:** Confirmed: sampler.js:440-451 module-level Map caches every decoded zone AudioBuffer promise keyed by URL with deletion only on fetch/decode failure; no clear/evict/cap anywhere, and being module-scoped it survives stopLive/goLive. Both browser lanes hit it (live.js:548 desktop ring, live.js:1555 mobile WAV-first — where the AudioBuffer stays pinned even though only a mono Float32Array copy is used, doubling mobile cost). Scale verified: 644 zone wavs / 102MB on disk in the fluidr3 set alone (avg 162KB 16-bit mono, ~325KB decoded float32; ~204MB full-set), plus 11 alternate instruments-* font dirs whose switcher-minted URLs form disjoint keyspaces that pin the old font's buffers. Fix is determinism-safe (browser-only path; press/node never calls decodeUrlRaw; playing source nodes hold their own buffer refs). Only nit: the finding's 0.2-1MB/zone is a bit high — measured avg ~0.33MB decoded.

### [x] (2026-07-25) Verification volumedetect runs ffmpeg twice; the first pass's result is always discarded on success
*engine/faust/press.js:443 · render*

The first execFileSync('ffmpeg', ..., {stdio:['ignore','ignore','pipe']}) can only yield stderr via the catch path (e.stderr) — execFileSync returns stdout, and volumedetect prints to stderr. ffmpeg with '-f null -' exits 0, so on every normal press vd stays "" and the `if (!vd)` fallback re-runs the identical ffmpeg via sh -c 2>&1. The first full decode pass of the output wav (measured 360ms for a 90s wav, scales linearly with song length) is pure waste, every press.

**Impact:** ~0.4s wasted per 90s press, ~1s per 4-minute press; multiplied across journey/playlist renders and validate --audio probe batches. Also a correctness trap: if ffmpeg ever DID fail, the error-path stderr (attempt 1) and stdout (attempt 2) captures disagree.

**Fix:** Replace both attempts with one child_process.spawnSync('ffmpeg', [...], {encoding:'utf8'}) and read .stderr — available on success and failure. No audio bytes involved; output wav untouched.

**Verifier:** Confirmed dead first ffmpeg pass: press.js:443 pipes volumedetect stderr but only reads it in the catch path, while execFileSync returns stdout (ignored) — on the normal exit-0 press vd is always "" and line 445 re-runs the identical full-decode ffmpeg via sh -c 2>&1. Measured 555ms of pure waste per ~178s press (~2.2% of the 25.3s press wall time), scaling linearly with song length and multiplying across journey/playlist/validate --audio batches. The suggested single spawnSync fix was probe-verified (stderr available on success, status 0). The code runs after writeWav and feeds only logging/returned stats, so the fix cannot affect audio bytes or byte-determinism. Minor caveat: the "error captures disagree" sub-claim is overstated (attempt 2's 2>&1 merge makes e.stdout valid), but the core double-run waste holds.

### [x] (2026-07-25) MediaSession play handler cannot un-pause the ring path (opts.mediaSession hosts)
*engine/faust/live.js:1258 · scheduler*

The pause action handler (live.js:1258-1262) stores C_STATE=2 and zeroes masterGain but does NOT set survivalMuted. The play handler is goVisible (live.js:1257), whose guard `if (!survivalMuted && !bgActive) return;` (live.js:1169) exits before restoring C_STATE=1 or ramping masterGain back up. So on any standalone host that passes opts.mediaSession, lock-screen/notification pause works once and play is then permanently dead (worklet muted at source, gain 0) until a full stop/start.

**Impact:** Audible: transport play button silently does nothing after a pause on opts.mediaSession hosts (headphone button, lock screen); main explorer app is unaffected (it owns its own handlers).

**Fix:** Set survivalMuted = true inside the pause handler (making goVisible's restore path run), or give play a dedicated resume that unconditionally stores C_STATE=1 and re-ramps masterGain.

**Verifier:** Code trace confirms the exact mechanism: the ring-path MediaSession pause handler (live.js:1258-1262) sets C_STATE=2 and masterGain=0 without setting survivalMuted or suspending the ctx; the play handler is goVisible (1257), whose guard at 1169 (`if (!survivalMuted && !bgActive) return;`) early-returns — the pause handler even forces bgActive=false at 1260 — so the restore path (C_STATE=1 at 1186, gain ramp at 1187) never runs and no ctx.onstatechange rescue fires. Play is audibly dead after a foreground pause; the WAV path (2547-2551) has a correct symmetric pair, proving the asymmetry is a defect, and the guard's comment shows it was written for refocus gain-dip avoidance, not to disable transport. Fix is transport-only, no determinism impact. Caveats: on mobile a background/foreground cycle incidentally revives it (goHidden sets survivalMuted), and the bug is latent in-repo — no shipped host passes opts.mediaSession — both consistent with the finding's own scoping.

### [x] (2026-07-25) Worker initfail never resolves ensureWorker — exploreLive/exploreLiveWav await hangs forever with no surfaced error
*engine/faust/live.js:832 · scheduler*

ensureWorker (live.js:654-665, wav twin 1624-1635) resolves its promise only on the 'ready' message. On 'initfail' (live.js:832, wav 1857) the error is pushed into `errors` but readyResolve is never called, so `await ensureWorker(0)` at boot (live.js:1268, wav 2576) never settles: exploreLive never returns a handle, goLive's await hangs, status stays 'loading engine…'/'priming…', and the errors array is unreachable because the handle it rides on was never constructed. The same dangling promise hits openStream's `ensureWorker(stream.wi).then(proceed)` for the bridge worker (a failed worker1 init makes every future crossfade silently queue forever). initDeps failures are real on flaky networks (it fetches faustwasm + dist wasm + dx7 presets).

**Impact:** Audible/UX: a single failed worker boot (network blip on the wasm/module fetches) = the app permanently stuck at the boot spinner with zero diagnostics, requiring a reload; no honest 'engine error' status despite the machinery existing for openfail.

**Fix:** On 'initfail', resolve (or reject-and-catch) the pending workerReadyProm with a failure flag, surface status('engine error: ...'), and make openStream/boot check the flag and bail with the openfail path instead of queueing preFeed forever.

**Verifier:** Confirmed dangling promise: ensureWorker's promise (live.js:654-665, wav twin 1624-1635) resolves only on the 'ready' message (831/1856); the 'initfail' handler (832/1857) and w.onerror (661/1631) only push into `errors` and never settle it. Boot `await ensureWorker(0)` (1268/2576) precedes handle construction, so exploreLive/exploreLiveWav never return, goLive's await in app/live.js:241 hangs with no timeout, and the errors array is unreachable (it rides on the never-built handle). openStream (712) chains `.then(proceed)` on the same promise, so a failed worker-1 pre-init (818) makes all future crossfades queue in preFeed forever. initfail is genuinely reachable: stream-worker.js:419-420 posts it when initDeps' ~9 network dynamic imports (theory/pipes/csd-engine/faustwasm ESM, etc.) throw. Not by-design — the openfail path (845-851) deliberately surfaces status("engine error: …") with the comment "never a silent forever-'priming…'", proving intent to avoid exactly this hang. The suggested fix is boot/error plumbing only and cannot affect byte-determinism of buildEvents output.

### [x] (2026-07-25) stream-worker retains every fed bar forever (liveBars) — 10-40MB/hour worker leak on any long live session
*engine/faust/stream-worker.js:588 · scheduler*

Every conductor postFeed appends to `liveBars` (stream-worker.js:588) and the pumps only advance `cursor` over it (runLivePump:356-371, runBarAccumPump:421-435); entries are never nulled or spliced until the next openLive resets the array — which on a stable genre (radio/journey hold, the primary use-case) is never. Measured payloads (node probe, JSON-equivalent of the postFeed bar {units, events, fxParams,...}): jazz 16.6KB/bar at 908 bars/h ≈ 15.4MB/h, jungle 11.9KB ≈ 15.1MB/h, ragtime 8.8KB ≈ 15.5MB/h — structured-clone JS object overhead makes the real retained heap 2-3x that. stream-renderer's ST.bars grows in parallel (small entries) and ST.sweeps likewise; su.notes IS pruned (stream-renderer.js:628) so the fix pattern already exists one level down. Both the ring path and the mobile wavOut path go through this queue.

**Impact:** Measurable: ~10-45MB/hour unbounded worker heap growth per live open; an all-day session accumulates hundreds of MB — GC pressure on the render thread (feed-pump hiccups) and eventual mobile tab eviction.

**Fix:** In both pump loops, release consumed bars: `liveBars[cursor] = null` after renderChunk (reads are strictly cursor-ordered), or switch to a shift()-based queue with a monotonically offset index; also cap/trim ST.bars in stream-renderer for live mode (only bars[n >= cursor] are ever read).

**Verifier:** Confirmed unbounded retention: stream-worker.js pushes every fed bar into module-level liveBars (line 494) and both pumps (runLivePump 270-298, runBarAccumPump 337-354) only advance cursor over it — no null/splice/shift anywhere; the only reset is at the next openLive*/openLiveSegs/openLivePcm (438/448/459), which never fires on a stable genre hold, and "stop" (496) does not clear it. Each fed bar carries the full {units, events, fxParams,...} payload (live.js postFeed 692/1652). Probe reproduces the magnitude: jazz 12.1KB/bar x 1815 bars/h = 21.4 MB/h, jungle 24.5 MB/h, ragtime 13.3 MB/h JSON-equivalent (real heap higher). Both ring and mobile WAV paths are affected; ST.bars/ST.sweeps in stream-renderer.js also grow unpruned (580/579) while su.notes IS pruned at 628 with an explicit "unbounded live stream" comment — proving this retention is an oversight, not design. The suggested fix (liveBars[cursor]=null after renderChunk) changes no rendered sample — reads are strictly once in cursor order — so byte-determinism is preserved. Only defects in the finding are drifted line numbers (push is at 494, not 588; file is 497 lines) and ~2x-low bars/h estimates, neither of which changes the verdict.

## Tier 2 — careful bug fixes (each needs its own gate attention)

### [x] (2026-07-25) mp3 route counts skipped-gen PCM as buffered — feed pump starves the element into permanent silence after rapid steering
*engine/faust/live.js:1865 · scheduler*

onMsg 'pcmseg' does `receivedPcmSec += m.durSec` for EVERY gen's flush, but pumpEncoder (live.js:2048-2052) bridges to the NEWEST ready gen and deletes intermediate gens' queues without ever forwarding them to the encoder. Those dropped seconds stay in receivedPcmSec forever (it is only reset in stepDownCodec). mp3AheadSec() = receivedPcmSec - currentTime (live.js:2024) is the feed gate (feedRoom, live.js:1795, cap FEED_CAP_MP3=5s), so every skipped gen (each rapid steer that supersedes a gen before the encoder bridges to it leaks ~2-6s: its MP3_FIRST_SEC=2s first flush plus fed bars) makes the pump think the element has more runway than it does. Once cumulative dropped seconds reach ~5s the pump idles at the cap while the element's real buffer is empty: currentTime freezes at buffered.end, so mp3AheadSec stays pinned >= 5, feedRoom stays false, stepWalk is never called, and no reopen can happen. The frozen watchdog (live.js:2320) classifies exactly this state (readyState<3, bufferedAhead<2) as a 'benign starve' and re-arms forever — no demotion, no recovery. Permanent silence on the default mobile route.

**Impact:** Audible: total, unrecoverable silence on the mobile (wav-first mms/mse) path after a handful of quick genre steers or a fast map drag/journey transition burst; before full deadlock, each leaked gen silently shrinks the real forward buffer, raising underrun ('waiting') stalls.

**Fix:** Account received seconds only for PCM actually forwarded to the encoder: move the `receivedPcmSec += durSec` into forwardPcm(), or when pumpEncoder deletes a skipped gen's queue, subtract the durSec of its never-forwarded flushes. Alternatively compute mp3AheadSec from appendedSec + encoder-queued seconds instead of receivedPcmSec.

**Fixed (2026-07-25):** `receivedPcmSec` is now incremented in `forwardPcm()` — seconds
actually handed to the encoder — and never on arrival, so a skipped gen can no longer
leak. The runway keeps its old bound while the encoder is still opening by adding a
LIVE `pcmPendingSec` term (queued-but-unforwarded seconds), which is *subtracted* when a
gen's queue is dropped (`dropPcmGen`) or cleared (`clearPcmQueues`), so it self-corrects
instead of accumulating; a flush that arrives for a gen the encoder has already bridged
past is dropped at the door (`m.gen < encGen`) rather than parked in a queue only the
next bridge would clear. `__wavState()` now reports `forwardedSec`/`pendingSec`.
MEASURED (headless mse-mp3, 16 steers at 900 ms, HEAD served side-by-side via
page.route): the fixed build's ledger equals the element's reality — `forwardedSec`
66.02 s vs the SourceBuffer's `buffered.end` 66.0 s, and the pump's believed runway
tracks the element's true forward buffer to p50 0.06 s / final 0.09 s. NOTE, honestly:
these runs never made HEAD skip a gen (the encoder bridged through all 16), so the
permanent-silence END STATE was not reproduced empirically — what is proven is the
accounting identity and the mechanism's removal. The ~28 s transient spike both builds
show right after a steer storm is NOT this leak: it is forwarded-but-not-yet-encoded PCM
sitting in the JS encoder (see the mse-mp3 realtime-margin entry below).

**Verifier:** Confirmed. live.js:1865 counts every gen's pcmseg durSec into receivedPcmSec, but pumpEncoder (2047-2052) bridges to the NEWEST ready gen, deleting skipped gens' queues, and never forwards any gen < encGen (late-arriving flushes of superseded gens leak too — stream-worker's feedEos drain guarantees superseded-but-opened gens flush real PCM). Leaked seconds inflate mp3AheadSec (2024), the sole runway term of feedRoom (1795, cap FEED_CAP_MP3=5); receivedPcmSec is reset only in stepDownCodec (2170), whose own comment (2167-2169) proves the counter is meant to equal encoder-fed seconds. Once cumulative leak >= 5s, feedRoom pins false, stepWalk/reopen never run (pump loop 1831-1839 is the only call site), the element plays out, and the frozen watchdog (2320) re-arms forever on the readyState<3 && ahead<2 'benign starve' branch — permanent silence, no demotion. Fix is playback accounting only; determinism unaffected.

### [x] (2026-07-25 timing pass) Crossfade ramp runs on a throttled 5ms page setInterval — hidden-tab fades become a hard jump-cut and skew the native/onBar grid up to ~1s
*engine/faust/live.js:779 · scheduler*

startFade's fadeTimer (setInterval 5ms) is the ONLY driver of C_XFADE, and ring-player only begins consuming the incoming ring when C_XFADE > 0 (ring-player.js:100/135). The first past-anchor tick stores xfade=0 (el=0), so ring B's bar 0 actually starts one-plus tick AFTER the read cursor crosses the anchor — while commitFade re-bases br.startGlobal to the anchor exactly (live.js:801), and drainDueBars/fireBar schedule native sampler/found notes and onBar from that anchor grid. Visible that skew is ~5-10ms; in a hidden tab page timers clamp to >=1s, so (a) the incoming stream starts up to ~1s late relative to every native lane and onBar for the rest of that stream's life, and (b) the 400ms equal-power ramp collapses to one 0-to-10000 store — a hard cut, the exact click the two-ring design exists to prevent. The worker 'tick' (stream-worker.js:74) deliberately keeps pumpOnce/drainDueBars alive while hidden but does NOT drive the fade, and hidden-tab playback with auto-steering is a supported contract (desktop keep-playing + journey glide; bg-survival-run). waitSwap's 3ms interval delays commitFade similarly (benign but adds to the window where the pump is halted at phase==='fading').

**Impact:** Audible: after any topology change while the tab is hidden, drums/samplers/found play up to ~1s ahead of the stream until the next crossfade, and the genre switch lands as an abrupt cut instead of a 400ms fade; ~5-10ms per-fade native-vs-stream skew even when visible.

**Fix:** Move the ramp into ring-player: conductor writes the anchor cursor (53-bit) and fade-length-in-frames into the reserved ctrl slots; the worklet computes gain from its own outFrames so the fade is sample-accurate and starts exactly at the anchor regardless of page-timer throttling. Minimum patch: also drive the fadeTimer body from the worker tick handler and store a nonzero first step.

**Verifier:** Confirmed by code trace. C_XFADE has exactly three writers (live.js:783/784, live.js:813 init, ring-player.js:149 reset) — the 5ms page setInterval at live.js:779 is the only ramp driver, and the throttle-proof worker tick (stream-worker.js:74 → live.js:837) drives only pumpOnce/drainDueBars, not the fade. ring-player.js:100/135 consumes the incoming ring only when C_XFADE>0, and the first past-anchor tick stores 0 (el=0 at live.js:781-784), so ring B provably starts ≥1 tick after the anchor while commitFade (live.js:801) re-bases br.startGlobal to the anchor exactly and fireBar (live.js:928) locks native sampler/found/onBar to that grid via the always-advancing output cursor (ring-player.js:155) — a persistent native-vs-stream skew (~5-10ms visible). In a hidden tab the codebase's own documented model (live.js:833-836: page timers clamp to >=1s; the worker metronome exists for exactly this) plus XFADE_MS=400 (live.js:52) means the ramp collapses to a single 0→10000 store (hard cut, gA=0/gB=1 in one quantum) and the stream starts up to ~1-2s behind the natives for the stream's life. Not by-design: startFade's own comment (live.js:766-768) states the incoming ring must be consumed from the downbeat so natives and stream share one grid; hidden-tab fades are reachable (startFade fires off the worker 'primed' message, live.js:842; hidden keep-playing is a gated contract). Determinism law unaffected — live gain timing only, buildEvents untouched. Only nit: worst-case hidden skew is ~2s, not ~1s (finding is conservative).

### [x] (2026-07-25 timing pass) Queue-empty crossfade anchors at fedEnd — old ring is dry for the whole 400ms ramp: new genre swells from silence and ~140 false underrun quanta are counted per fade
*engine/faust/live.js:770 · scheduler*

startFade anchors at playQueue[0].globalStart, falling back to fedEnd = cur.startGlobal + cur.fedFrames when the queue is empty. The old stream has NO audio past fedEnd (it stops being fed the moment bridging begins — produceAndRoute routes all bars to br), so during the 400ms ramp the A-side of ring-player's crossfade loop reads an empty ring: it emits silence for A and increments under/C_UNDER_CNT every quantum where gA > GAIN_EPS (ring-player.js:133-134, 158). Result: the transition is output = B * sin(ramp) — the new genre fades in from silence at the downbeat instead of an equal-power crossfade — and underruns()/underrunFlag() telemetry (the acceptance-gate detector surface) records ~138 fake underrun quanta per such fade. This is the COMMON case, not an edge: TARGET_SEC=3.0 is shorter than most chord-bars (measured 2.9-6.4s for jungle/vaporwave/jazz/dub, 29.5s ambient), so the pump keeps at most one bar queued and the queue is empty whenever the cursor sits early-to-mid inside the last fed bar at prime time.

**Impact:** Audible: a 400ms dip/swell instead of a crossfade on a large fraction of live genre changes; measurable: underrun counters (read by the live/resilience probes and the ?wavDebug overlay) spike on healthy transitions, masking real underruns.

**Fix:** When the queue is empty, keep feeding cur one more bar before beginning the bridge (so nextDown always exists), or clamp the ramp to complete by fedEnd (start XFADE_MS early so gA reaches 0 exactly at the boundary); independently, suppress underrun counting for a ring whose producer has been retired/stopped (a 'retiring' flag in the per-ring ctrl block).

**Verifier:** Verified in code: with playQueue empty, startFade (engine/faust/live.js:770-772) anchors the crossfade at fedEnd — the exact sample where the old ring exhausts (cur is never fed after bridging begins per produceAndRoute lines 864-869, and the pump halts during fading). The ramp holds until the cursor reaches that anchor (line 780), so for the entire 400ms XFADE_MS ramp ring A is dry: ring-player.js:131-137 outputs B·sin(θ) only (fade-in from silence, contradicting the file's documented equal-power no-dip contract) and lines 133-134/158 count an underrun quantum whenever gA>1e-3 with aAvail=0 — cos(θ)>1e-3 for 99.94% of the ramp, giving 0.4s×44100/128 ≈ 138 false quanta per fade plus a permanently latched sticky C_UNDERRUN. The common-case claim holds: queue-nonempty at pump time implies runway > queued bar length, and the pump only produces when runway < TARGET_SEC=3.0s, so the queue is provably empty at beginBridge for any chord-bar >3s — measured 241/274 genres (88%) qualify (jungle 2.91s, jazz 4.0s, vaporwave/dub 6.4s, ambient 29.5s, matching the finding). Not by-design: the startFade comment only proves no underrun BEFORE the anchor; the guaranteed post-anchor dry ramp is unacknowledged and defeats the GAIN_EPS guard's intent. No determinism impact (live playback path, not buildEvents). One overstatement: no test currently asserts on underruns()/underrunFlag() (only the ?wavDebug overlay reads it), so nothing gates on the polluted telemetry today — the audible fade-from-silence and false counters are still real. Fix caveat: 'feed cur one more bar' interacts with the shared walk's serial/seed law and the ramp-clamp variant would break bar alignment; the retiring-flag underrun suppression is the safe independent piece.

### [x] (2026-07-25 timing pass) Decoded-sample caches are never evicted — ~10-20MB per visited genre accumulates across a journey (mobile OOM risk)
*engine/faust/live.js:515 · scheduler*

The ring path caches every decoded found AudioBuffer (bufCache, live.js:515) and every GM sampler zone (samplerBufs, live.js:533) forever; the wav path does the same with mono Float32 copies (foundPCM/samplerPCM/speechPCM, live.js:1496) plus the jobs maps. Sampled-by-default means ~20-29 zones per genre at 44.1k mono float (~176KB/s of material, typically several hundred KB per zone) → roughly 10-20MB of decoded PCM per genre. A multi-hour journey or an evening of map exploration touching dozens of the 274 genres pins hundreds of MB of AudioBuffers/Float32Arrays on the main thread — on iOS (the wav path's own target) this is jetsam territory, and each addBuffers ship also re-copies (pcm.slice()) into the worker whose engine holds its own table.

**Impact:** Measurable: unbounded main-thread memory growth proportional to distinct genres visited (~10-20MB each); on mobile long sessions this risks page kill (total silence + reload), on desktop steady GC pressure.

**Fix:** LRU-evict cache entries not referenced by the last N fed bars' foundSources/zone sets (the per-bar kick sites already enumerate exactly what is live); keep bufFail/permanent-failure markers so eviction never turns a decode failure into a retry storm.

**Verifier:** Mechanism fully confirmed: bufCache (live.js:515), samplerBufs (533), foundPCM/samplerPCM/speechPCM + jobs maps (1496-1497) are never evicted for the life of an exploreLive session (which spans a whole journey), and two module-global caches the finding missed — sampler.js:440 _cache and found-player.js:517 _bufCache (beds up to 90s ≈ 16MB each) — survive even stop/restart; the wav path additionally holds pcm.slice() copies in the worker (live.js:1662/1729, stream-worker.js:482), so mobile keeps up to 3 copies per zone. Not by-design (found-player already LRU-bounds its bed-loop cache, BED_CACHE_MAX=6) and eviction cannot break byte-determinism (decode caches feed live playback only; buildEvents/press untouched; re-decode yields identical PCM). Magnitude corrected: srcIds are instrument-keyed so genres dedup — measured ~85MB single-copy over a 30-genre journey (first-visit genres 3-15MB, ~2.8MB/genre average), ~200-250MB on the mobile path with copies, ceiling = full library (~210MB default font decoded) not truly unbounded. The '10-20MB per genre' figure overstates typical increments, but multi-hour mobile sessions pinning 200-500MB of PCM is real iOS jetsam risk, and the suggested LRU (keep bufFail/null-pin semantics, key on live per-bar sets) is compatible with all existing invariants.

### [x] (2026-07-25) jux stereo dimension is audibly dead: no Faust consumer reads per-event pan (and callResponse's pan mirror uses the wrong convention)
*engine/csd-engine.js:2021 · score*

The jux pass (lines 2021-2035) stamps `pan` in [-1,1] on hats/toms/melody/pads, and the header comment claims "the Faust engine reads it". Code-trace of the whole backend says otherwise: state-engine.js never reads event.pan (mapEvents translates cutoffMul/vib/pw only); press.js builds note pan exclusively from SE.notePan(unit,freq); render-core.js/stream-renderer.js/stem-worker.js read only unit-level u.pan (MASTER_PAN); sampler.js's n.pan comes from notePan; live.js/ring-player.js/stream-worker.js contain no per-event pan handling at all. So dozens of anchors tuned with fx.jux (breakcore "maximum jux", "jux MAX — the stereo field disagrees with itself") render with zero per-event stereo divergence — only the static unit pans sound. Secondary: pipes.js:159 callResponse "pan mirror" computes 1-e.pan (a 0..1-convention mirror) against jux's signed [-1,1] pans, so if per-event pan is ever wired up, every response note lands ~hard right (1-(-0.35)=1.35, clamped to 1 by panGains) instead of mirrored; the correct mirror in the engine's convention is -e.pan.

**Impact:** A whole committed state dimension (jux) and one pipe behavior (callResponse pan flip) are silent on the only backend; kernel FX tuning ranges like jux:[.45,.75] do nothing audible. When someone wires it, the pipes convention clash will slam responses to one side.

**Fix:** Either wire per-event pan through mapEvents → note.pan (sampler already honors n.pan; press/stream paths need the per-note pan on the wide buses, live-ring stays mono as documented) or delete the jux event-stamping and its rng stream as dead code and route jux into unit-level MASTER_PAN spread. Fix pipes.js:159 to `e.pan = e.pan==null ? dflt : -e.pan` in the same change. Wiring changes rendered audio for jux genres — gate with ears + the wavout probes, not just the matrix (pan is verifier-invisible).

**Verifier:** Confirmed dead state dimension: the jux pass (csd-engine.js:2016-2035) stamps event.pan in [-1,1] and its comment claims "the Faust engine reads it," but no code in the Faust backend consumes event-level pan — state-engine.js mapEvents translates only cutoffMul/vib/pw (lines 1800-1815); all per-note pan comes from SE.notePan(unit,freq) (unit pan + pad panSpread); render-core/stream-renderer/stem-worker/press read only unit-level u.pan; live.js/ring-player/stream-worker have zero per-event pan handling; grep for "jux" across engine/faust/ and app/ finds nothing. 28 kernel anchors tune fx.jux ranges with comments promising audible width ("jux MAX — the stereo field disagrees with itself"), so this is a stale-contract dead feature, not by-design. Secondary claim also holds: pipes.js:159 callResponse mirrors pan as 1-e.pan with default 0.72 (0..1 csound convention) against the signed [-1,1] convention of jux and panGains(clamp(pan,-1,1)); if wired, mirrored responses would clamp hard-right — correct mirror in the signed convention is -e.pan. Additionally the jux pass runs after pipes and unconditionally overwrites callResponse melody pans.

**Fixed (2026-07-25) — HALF, honestly:** the render half lives in
`engine/faust/` (owned by another agent this round), so it ships as a patch
spec: `scratchpad/jux-per-event-pan.patch.md` (mapEvents carries `p.pan`/`d.pan`
onto unit events; `notePan(u,freq,evPan)` folds it in; the three press/stream
call sites pass it; `anyStereo` learns about event pan — sampler `mixPCM`
already honours `n.pan`). Landed here: pipes.js `callResponse` now mirrors in
the engine's SIGNED convention (`-e.pan`, was `1-e.pan` — the hard-right bug),
the csd-engine jux pass no longer claims "the Faust engine reads it" and
carries a HONEST STATUS note, and docs/MUSIC-MIND.md gains "The dead knob:
`jux`". Score-side stamping kept byte-identical (it is the correct half and the
hook the wiring needs). Byte drift: 1 catalog state (breakbop@4 — the only one
pooling callResponse with jux>0), pan field only, inaudible until wiring lands.

### [x] (2026-07-25) strum pipe is dead vocabulary: it groups pads by exact beat AFTER applyGroove humanize jitter
*engine/pipes.js:126 · score*

The strum pipe forms chords by grouping pad events on `e.beat.toFixed(6)` and only rolls groups of >=2. But CsdPipes.apply runs at the buildEvents choke point AFTER applyGroove, whose humanize pass shifts every event by an independent ±ht·0.04-beat draw — so with any humanize>0 no two pad notes share a 6-dp beat and the pipe no-ops. Demonstrated: on real kernel output (moonlagoon seed 3) only 1 of 111 pad onset groups had >=2 members; a synthetic A/B shows the pipe rolls exact-equal chords (0/.02/.04/.06) and leaves 1e-4-jittered chords untouched. Every catalog genre that pools {id:"strum"} carries humanize>0 (moonlagoon seeds 1/5 humanize .27/.29, moptoprattle seeds 3/6 humanize .31/.20 — strum pipe ACTIVE in the resolved state, inert in effect), so the promised "humanity on pads" roll never sounds anywhere.

**Impact:** An entire pipe (wired into ~10 anchors' pipe pools) produces zero audible output; the guitar-ish genres it was written for get flat pad blocks instead of rolled chords.

**Fix:** Group on a quantized key that survives humanize jitter, e.g. Math.round(e.beat*8)/8 (humanize maxes at ±0.04·hz beats, far under a 16th), or tag pad chord-mates with a shared chord id at emission time in buildEvents and group on that. Deterministic (the pipe is drawless); bytes change only for seeds whose state actually pools strum — that drift is the fix working. Re-run matrix (pipe annotations are matrix-neutral but the roll moves beats — verify motion features hold) and pipes.test.js.

**Verifier:** Confirmed dead vocabulary. CsdPipes.apply runs at csd-engine.js:2321, after applyGroove (line 2038) has shifted every pitched event's beat by an independent ±ht*0.04 draw; the strum pipe (pipes.js:121-136) then groups pads on e.beat.toFixed(6) and skips groups <2, so with any humanize>0 it no-ops. Every strum-active resolved kernel state carries humanize>0 (286/286 across 73 genres pooling strum — wider than the finding's ~10 — seeds 1-8), so the promised pad roll never sounds anywhere. Not by-design (the pipe's own doc promises the roll); the pipe is drawless so the quantized-grouping fix preserves determinism, with byte drift only where the pipe correctly starts firing.

**Fixed (2026-07-25):** pads are now clustered by a TOLERANCE window (0.1 beat
from the cluster's first onset, param `tol`) instead of an exact
`beat.toFixed(6)` key, so humanize jitter (±0.04/event) and the rubato warp no
longer atomize every chord; each cluster rolls from its own earliest onset with
release edges preserved. Drawless, so determinism/seeding unchanged. The pipe
stands down when the SCORE already rakes the pads (`state.strum`) rather than
fighting the stroke direction. Drift: 95 of 822 catalog builds (274 genres ×
seeds 1/4/7), all pooling `strum` and carrying pads — the pipe finally firing
(1 of them, butterchurnbounce@7, also shifts `state.regHome` because the moved
pad onsets change `harmonize`'s sounding-pc set → melody register measurement).

### [x] (2026-07-25) PERC pass tiles bars at hardcoded CHORD_BEATS=8, ignoring chordEvery/meter — latent event spill past section ends
*engine/csd-engine.js:2266 · score*

The percussion lane computes `nbars=Math.max(1,Math.round(sp.beats/CHORD_BEATS))` and places bars at `sp.start+bi*CHORD_BEATS` — always the 8-beat 4/4 stride, even when the state's chord bar is 4/6/12 beats. When sp.beats ≡ 4 (mod 8) (e.g. a 3-chord progression like ii_v_i under chordEvery 4 or 12: 36-beat sections → Math.round(4.5)=5 bars), the last perc bar extends up to ~4 beats past the section boundary — perc keeps clattering into a section whose kit is "off" (and past a "cut"/dropout transition, which also never clears perc since perc is added after the transition chain). No stock ANCHOR currently hits it (verified: the chordEvery:4 genres punk/indie/grunge pool only 4- and 12-chord progressions; the meter and chordEvery:12 anchors carry no perc styles), but blends can combine a perc-dominant parent with another parent's chordEvery (resolveMulti picks chordEvery from one declaring parent, perc style from the dominant), and any future perc wiring of a meter genre misaligns 8-beat perc cells against 6-beat bars.

**Impact:** In the reachable blend cases: percussion hits sounding 1-4 beats into kit-off/breakdown sections — an audible groove leak at exactly the moments the form empties; silently wrong for any future waltz/6-8 perc wiring.

**Fix:** Clamp emission to the span (`if(e.beat < sp.start+sp.beats) percArr.push(e)`) as the minimal byte-safe-for-all-current-anchors fix, and/or use nbars=floor. A fuller fix strides by min(CBEATS, CHORD_BEATS) like the snare-law's BARLEN. rng discipline: the prng draws happen per emitted event inside the loop, so a clamp BEFORE the draw changes draw counts — clamp after the draws (filter at push) to keep existing genres byte-identical.

**Verifier:** Confirmed. engine/csd-engine.js:2266 tiles perc bars at hardcoded CHORD_BEATS=8 while sp.beats is a multiple of CBEATS (chordEvery/meter), not 8; Math.round rounds 4.5 up, so a 36-beat span (ii_v_i x chordEvery 12) gets 5 bars and the last spills up to 4 beats past the section boundary into a following kit-off span (the pass only checks the emitting span's kit, and runs after the transition chain so cut/dropout never clears it). Reachable via the public blend API, not just synthetic states: perc comes from the dominant PERC_STYLES parent (resolvePercStyle, no rng) while chordEvery is a weighted draw from any declaring parent. Not by-design (the pass's own comment promises perc only on kit!=="off" spans), and the suggested clamp-after-draw fix preserves both determinism and byte-identity for all non-spilling genres.

**Fixed (2026-07-25):** the pass strides `PCELL = min(CBEATS, CHORD_BEATS)` and
emission is a FILTER applied AFTER both prng draws (draw counts, hence bytes,
untouched): nothing lands past the cell or past the span end, and `nbars` is
`ceil(sp.beats/PCELL)` so the span is covered without a `round()` overshoot.
Probe (3-chord ii_v_i + perc into a kit-"off" span): chordEvery 12 spilled 5
events past the section end and chordEvery 4 spilled 8 — both now 0, with the
legacy chordEvery-8 case byte-identical. Catalog drift: zero (no stock state
pairs perc with a non-8 chord bar, exactly as the finding predicted).

### [x] (2026-07-25 performance pass) Segment walk double-renders a 64-sample block when a non-merged gap lands inside one block (confirmed live: floppycore seed 1)
*engine/faust/render-core.js:151 · render*

renderUnit's per-segment block walk renders past the segment end `to` up to the next 64-sample boundary (line 154: `for (s = from; s < to; s += BS)` with len unclamped to `to`), while the NEXT segment's start is block-aligned DOWN (`from = Math.floor(a / BS) * BS`, line 151). mergeIvals only merges touching intervals, so when the gap between one interval's end and the next interval's start (s-BS) is 1..63 samples and both fall in the same 64-block, that block is rendered twice: its output is accumulated into the buses twice AND the Faust voice's internal state (envelopes/LFO/filter history) advances 64 extra samples. Demonstrated through the REAL renderUnit with a ramp-tap probe (unit marked vocoder, speech[i]=i, mock proc recording ins[0][0] block starts): floppycore seed 1's bass unit (bass_reese, pool 2, 439 events, 157 bpm) double-renders 5 blocks at sample starts 2081344, 2131904, 2182464 (both procs), 7710400. A 274-genre x 2-seed schedule sweep found this is the only state currently hit (geometry needs inter-onset ~= tail+13.8ms within a 1.4ms window), but any new genre/bpm/tail combination can trip it.

**Impact:** Audible: a 1.45ms doubled-amplitude splice (click/step) in the pressed bass, plus the voice's DSP timeline shifted 64 samples for the rest of that merged segment. Deterministic, so it is silently baked into any fixture covering an affected state. Also inherited by the stream renderer via the shared renderUnit.

**Fix:** Track a per-proc renderedEnd across segments and clamp: `const from = Math.max(0, Math.floor(a/BS)*BS, renderedEnd)` (renderedEnd = last block start + BS after each segment). Blocks stay 64-aligned and identical for every state that doesn't currently overlap (byte-identical for 547/548 probed states); floppycore/1 changes bytes because it was wrong. Re-run the segment-parity gate and any determinism fixtures.

**Verifier:** Real bug, mechanism and live repro both confirmed. In engine/faust/render-core.js renderUnit, each merged segment's block walk starts at Math.floor(a/BS)*BS (line 151) and renders full 64-sample blocks past the segment end because len clamps only to TOTAL, never to `to` (lines 154-155); mergeIvals merges only touching/overlapping intervals, so a 1-63-sample gap landing inside one 64-block leaves that block in both segments — it is rendered twice, accumulating doubled output into the buses and advancing the Faust voice's internal DSP state 64 extra samples. Not by-design (the header's 'keep the walk exactly' note is the press/render-core byte-parity contract, not an endorsement), not an eco-mode/absent-knob case, and the bug is deterministic so it silently bakes into fixtures. The suggested renderedEnd clamp preserves determinism and is byte-identical for every state without an intra-block gap. Minor correction: the stream renderer inherits the same pattern via its verbatim renderUnitWindow copy (stream-renderer.js ~line 206), not via a literal call to the shared renderUnit.

**Fixed (2026-07-25):** `renderUnit` now carries a per-proc `renderedEnd` (the first
sample that voice has NOT rendered) and starts each segment at
`max(0, floor(a/BS)*BS, renderedEnd)`, so a 1..63-sample gap inside one block can no
longer put that block in two segments. The stream renderer's verbatim copy
(`renderUnitWindow`) got the same clamp on `v.renderedEnd`, persisted across windows
(chunk bases are BS-aligned, so the cross-window walk is unaffected) — otherwise press
and the stream would disagree on exactly the states this fixes. A 274-genre × 3-seed
sweep of the real segment geometry finds the clamp firing in **1 state of 822**:
floppycore seed 1, 5 blocks (bass pool voices 0/1 at 2081344, 2131904, 2182464, plus
7710400) — precisely the audit's repro. Everything else is byte-identical (press sha256
unchanged on 6 tracks, `segment-parity` 10/10 byte-equal). floppycore/1's pre-makeup
float master now first differs at sample 2081478 = the first clamped block, and its peak
drops 0.5797 -> 0.5717: the doubled-amplitude splice WAS the loudest thing in the press.

### [x] (2026-07-25) Per-note tape-delay strip truncates its echoes: audible click at note end, zero echo on short notes
*engine/faust/sampler.js:205-211 · sampler*

mixPCM renders a note for exactly outN = holdN + relN samples (line 320), but the strip's tape delay (S.dly, buffer sized to timeSec = clamp(0.75*spb, 0.05, 1.4) — up to 1.4s) still holds near-full-level echo when the loop breaks. Probe: a 1.0s note (gain 0.4, lead strip + delay 0.35s/fb 0.28/mix 0.2) measures -24.4 dBFS in the 50 samples before the cut and exact 0 after — a single-sample step. Worse: a note shorter than the delay time emits NO echo at all — the first echo emerges ds samples after note start, past outN (a 0.25s eighth-note lead at 120bpm vs a 0.375s delay: outN=0.34s < 0.375s). voiceFxStage assigns this delay to ALL non-organ/non-guitar sampled leads and half the guitar leads (state-engine.js:246-249), so for typical staccato lead lines the declared echo is effectively silent, and for sustained notes it clicks. The live path has the same truncation: SamplerLive's onended (sampler.js:842) disconnects the buildStripNodes delay feedback loop at note end + 50ms.

**Impact:** Audible: a -24 dBFS single-sample step (tick) at the end of every sustained delay-strip lead note in press/wavOut renders, and the delay effect is inaudible on notes shorter than the echo time — the per-song lead 'air' stage is broken for most melodic material.

**Fix:** When the strip carries S.dly (or S.fla with high feedback), extend the render loop past outN by ~3x the delay time feeding x=0 (envelope already zero), so echoes decay naturally; in SamplerLive, defer teardown of delay-bearing strip nodes by the same tail. Bytes change only for delay-strip notes; gate with segment-parity + ears.

**Landed (2026-07-25):** sampler.js grows `stripTailN(strip, sr)` (3 delay times, capped 3.0s, 0 for any strip without a delay) and mixPCM rings the strip out past every note's end — the first 60ms through the full strip (so the chorus/leslie/biquad history empties into the delay continuously) then through a delay+flanger+trim-only `stripTailStep`, which measured byte-identical at 16 bit for a fraction of the CPU. SamplerLive defers its node teardown by the same tail. Probe (real vaporwave lead strip, 0.517s delay): the single-sample step at the cut falls -25.7 → -66.4 dBFS on a 1.0s note, and a 0.25s note goes from ZERO echo to a -36.4 dBFS ring-out; in-note samples bit-identical. **Requires a 4-line stream-renderer.js hunk** (`n._end = … + SP.stripTailN(u.sampler.strip, SR)` at both note-spec sites) or a tail crossing a chord-bar seam is dropped from the windowed render: without it segment-parity FAILS jungle_s2/darksynth_s7/jazz_s3, with it all 10 states are byte-equal.

**Verifier:** Confirmed on both paths. Press: mixPCM renders exactly outN=holdN+relN samples (sampler.js:320,414) while the per-note strip delay (S.dly, stripStep lines 205-211; buffer sized to up to 1.4s in makeStrip:130-135) still carries echo — probe shows a 1.0s lead-strip note cut from -26.4 dBFS to exact 0 in one sample (audible tick), and a 0.25s note vs a 0.375s delay (120bpm eighth) emits ZERO echo samples while its dry is attenuated to exactly 0.800x by the (1-mix) term — the effect is pure signal loss on short notes. voiceFxStage (state-engine.js:240-249) puts this delay on all non-organ sampled melody/solo leads plus half of guitar leads, the default sampled sound. Live has the same truncation: src.stop(when+hold+rel+0.05) then onended disconnects the buildStripNodes delay feedback loop (sampler.js:835,840-842). Not by-design (the per-note-buffer comment is about window parity, not tail amputation; voiceFxStage declares the delay as lead 'air') and the suggested tail-extension fix is deterministic + window-parity-safe, so no law is broken.

### [x] (2026-07-25) Velocity-layer zone selection is fed a mix gain, not a velocity — multi-velocity fonts can never reach their loud layers, and press/live disagree
*engine/faust/sampler.js:224-240 · sampler*

zoneFor picks a velocity layer via v = round(n.gain*127). But press feeds n.gain = (u.lvl||0.5) * e.sets.gain (press.js:226) — a MIX gain. Probe over 8 genres (jazz/citypop/vaporwave/heavymetal/dub/folk/ragtime/bossanova, seed 7): 10,109 sampler notes, max gain 0.484 → max velocity 61. So on any multi-velocity font, layers above ~vlo 61 (the forte samples that FULL CAPTURE in sf2.js exists to keep — 'upright piano, sax…' per the comment) are unreachable. live.js:957 computes round(e.sets.gain*127) WITHOUT u.lvl — press and live would select different layers for the same note. Additionally gain>1 (possible: sets.gain clamps at 2, lvl can exceed 1) gives v>127, which fails every vhi<=127 check and falls to covers[0] — the SOFTEST layer, since extraction sorts zones velLo-ascending (sf2.js:151). Verified currently latent: all 133 shipped zones.json and all 11 font-*.json switcher manifests have exactly one velocity layer, so nothing audible today — the feature is dead on arrival for the first real multi-vel font.

**Impact:** The velocity-layer feature (FULL CAPTURE extraction + byVel selection) silently never works as designed; first multi-velocity font added will play only its soft layers, differently in press vs live.

**Fix:** Derive the selection velocity from the musical amplitude before mix staging (e.sets.gain normalized by the unit's gmul/lvl calibration, or carry e's amp through the note spec), use the SAME formula in press.js:226 and live.js:957, and clamp to 0..127 inside zoneFor. Single-layer fonts are unaffected (byte-identical).

**Verifier:** Real latent bug, exactly as described. zoneFor's velocity-layer selection (sampler.js:224-240, called at :308 with round(n.gain*127)) is fed the press MIX gain (u.lvl*sets.gain, press.js:226 and stream-renderer.js:338/555), which the re-run probe shows never exceeds 0.484 across 10,109 sampler notes in 8 genres (seed 7) — velocity caps at ~61, so forte layers of any multi-velocity font are unreachable, defeating zoneFor's own stated purpose and sf2.js's FULL CAPTURE extraction. live.js:957 uses a different formula (round(sets.gain*127), no u.lvl), so press and live would select different layers for the same note. The missing 0..127 clamp plus sets.gain's 0..2 clamp (state-engine.js:1781) means gain>1 yields v>127, failing all vhi checks and falling to covers[0] — the softest layer, since sf2.js:151 sorts velLo-ascending. Not by-design (comments prove contrary intent), and the fix is determinism-safe: all 133 zones.json instruments have no velocity fields and all 1,107 font-manifest instruments have exactly one layer spanning 0:127/1:127, so current output is byte-identical either way — which also means the bug is purely latent today, with zero audible impact until the first multi-velocity font ships.

### [ ] wavOut/segs path truncates multi-bar found beds to their first chord bar (with a click at the cut)
*engine/faust/stream-renderer.js:570 · found*

In the bakeNative (WAV-FIRST mobile segs + background-WAV) path, a bed event is attached ONLY to the bar record where bar.foundCi === 0 (stream-renderer.js:566-571), then renderChunk:618 calls FP.mixPCM with win={base,len:LEN,total} for that one bar. mixPCM's windowed contract (found-player.js:339-347,364-367) writes only the slice landing in [base,base+LEN) and later chunks never re-pass the event — unlike sampler notes, which persist in su.notes and are re-filtered per window (stream-renderer.js:628-629). A live-walk bed's durB is the full collapsed-section length (nch*chordEvery beats, csd-engine bed dur=B), so the bed's tail past its first chord bar is never written. Live mode (live.js scheduleNative:983-986) and press play the full duration. Demonstrated with a node probe driving mixPCM exactly as renderChunk does: 8s bed over 4x2s bars → press per-bar dry RMS -40/-37/-37/-40 dB vs segs -40/-240/-240/-240 dB, and the bar-0 boundary steps 0.0040 → 0.0000 (a discontinuity click), since the bed is at full amp there (its fade-out lives at the end of the full durSec).

**Impact:** On the mobile WAV-first path and the background WAV, every bed-carrying genre loses ~ (nch-1)/nch (typically 3/4) of its ambient bed, and gets a small step-discontinuity click at the end of each chord-0 bar. Beds are the found layer's main texture (intro/verse sections of many genres).

**Fix:** Persist found bed events across chunks the way sampler notes persist: keep them on ST (with absolute tSec/_s0/_end), filter per window (_s0 < end && _end > base), and re-pass them to the windowed FP.mixPCM with the SAME tSec each overlapping chunk (the windowed write already handles mid-event windows correctly). Prune fully-played events like su.notes. Gate with segment-parity/wavout tests; live/press paths untouched.

**Verifier:** Confirmed: on the bakeNative (WAV-segs/background-WAV) path, a multi-bar found bed is attached only to its foundCi===0 bar (stream-renderer.js:566-571, and mapEvents' beat-window filter already omits it from later bars since live.js:1658 passes no bedAll) and mixed once via windowed FP.mixPCM (renderChunk:617-618), whose write clamps to [base,base+len) (found-player.js:364-366). Unlike sampler notes (persisted in su.notes and re-filtered per window, lines 628-629), the bed is never re-passed, so everything past the first chord bar is silent. Live mode (live.js:989-991) and press play the full durSec — this is a parity break, not design (the code comment itself claims scheduleNative parity). Beds span whole sections (csd-engine.js:2193 dur:B), so typically (nch-1)/nch of the bed is lost plus a step-discontinuity click at the chord-0 bar boundary. The suggested fix (persist and re-pass with same tSec per window) is byte-exact vs press, preserving determinism.

### [x] (2026-07-25) _bufCache is unbounded — decoded found AudioBuffers (up to ~16MB each) are retained forever
*engine/faust/found-player.js:517 · found*

The url → Promise<AudioBuffer> map is only ever deleted on decode FAILURE (line 625); success entries live for the session. Each entry is up to FOUND_MAX_SECONDS=90s of mono 44.1k float32 ≈ 15.9MB, plus speech-synth entries share the same map. The repo ships 168 found mp3s; a multi-hour journey ride that crosses many genres steadily accumulates every touched source.

**Impact:** Hundreds of MB of retained Float32Array/AudioBuffer on a long ride (e.g. 20 sources ≈ 250-320MB) — exactly the mobile WAV-first environment where iOS kills tabs over memory. The bed-loop cache next door already has an LRU bound (BED_CACHE_MAX=6); the far larger decode cache has none.

**Fix:** Give _bufCache an LRU with a sample-count budget (e.g. ~12-20 buffers / ~200MB, refreshed on get). Evict only settled entries; an evicted URL simply re-decodes from the local cache file on next use. Note _bedLoopCache/_pitchCache key off the buffer objects, so eviction also releases their derived data naturally (WeakMap).

**Verifier:** _bufCache (found-player.js:517) is a module-scoped Map of url -> Promise<AudioBuffer> with zero eviction on success — the only deletes (lines 543, 625) fire on decode failure, and _bufCache is not exported, so nothing can ever clear it. Every found bed/break/chop/narration source and every speech-synth utterance decoded during a live session is retained until page unload. With 168 found mp3s averaging 46s (measured: 7759s total), each entry averages ~8MB mono float32 (capped at 15.9MB by FOUND_MAX_SECONDS=90), and 124 distinct found-source refs span all 274 genres, so a multi-hour glide/journey ride realistically retains hundreds of MB — on the mobile WAV-first path (live.js:1542-1572 uses the same cache) where iOS memory kills are the documented threat. Not by-design: the adjacent _bedLoopCache is deliberately LRU-bounded (BED_CACHE_MAX=6, lines 640/700), showing bounded-cache intent that the far larger decode cache lacks. The suggested LRU fix preserves byte-determinism: eviction never touches buildEvents; re-decoding the same local file through the deterministic analyzeActive/speech-gate pipeline yields identical PCM, and the WeakMap _pitchCache regenerates identically. Minor overstatements only: 20 sources averages ~160MB (not 250-320MB, which assumes near-max-length sources), and the failure-delete also exists at line 543 for the speech path.

### [x] (2026-07-25 timing pass) Crossfade ramp runs on a throttled page timer: hidden-tab steer = ~1s silence gap, hard cut instead of fade, and a PERMANENT native-lane/stream desync
*engine/faust/live.js:779 · ring*

The whole fade protocol is clocked by page-side setInterval(…,5) (fadeTimer, live.js:779-785) and setInterval(…,3) (waitSwap:787-793). Hidden tabs clamp page timers to >=1s — the project already hardened pumpOnce/drainDueBars against exactly this by moving them to the worker 4Hz tick (stream-worker.js:74, onMsg 'tick' live.js:837), but the fade timer was left behind. Hidden sequence: first tick at/after the anchor sets fadeStartMs with el=0 and stores C_XFADE=0; the NEXT tick lands >=1s later with el>=1000>XFADE_MS(400) and stores 10000 directly. So (a) ring B is first consumed ~1s after the anchor (ring-player.js:100 reads B only when C_XFADE>0), during which ring A — fed only up to fedEnd>=anchor — runs dry: up to ~1s of counted-underrun silence; (b) the 400ms equal-power ramp degenerates to a single 0→10000 step, a hard splice between two uncorrelated streams; (c) worst: commitFade (live.js:801) re-bases br.startGlobal = fadeStartCursor (the anchor), but ring B's frame 0 actually PLAYED at the read cursor of the first nonzero-xfade quantum — every subsequent playQueue globalStart, i.e. all native drum/sampler/found scheduling and onBar timing for the entire life of the new stream, leads the stream audio by that ~1s lag.

**Impact:** Any state change while the tab is hidden (desktop keep-playing contract, bg-survival) produces an audible dropout + pop at the transition and leaves the sampled drums/found layer up to ~1s out of sync with the synth stream until the NEXT crossfade. Even visible, the reader consumes B up to one 5ms tick + quantum late relative to the anchor the conductor commits.

**Fix:** Move the ramp out of page timers: write the anchor frame and fade length (frames) into the reserved ctrl slot(s) (index 7 is reserved; a second slot fits in RING_STRIDE padding) and let ring-player itself hold at 0 until outFrames >= anchor, then ramp C_XFADE sample-accurately per quantum, promoting at completion exactly as today. The conductor then only polls for completion (its existing waitSwap), and br.startGlobal := anchor becomes exactly true. Minimal alternative: also drive the fadeTimer body from the worker 'tick' message so hidden ramps advance at 4Hz instead of 1Hz, and set br.startGlobal to the read cursor observed at the first nonzero C_XFADE store.

**Verifier:** Confirmed: the crossfade ramp is clocked only by page-side setInterval(5)/setInterval(3) (live.js:779-793) while the project's own hidden-tab hardening (stream-worker.js:67-74 4Hz tick, live.js:837) covers only pumpOnce/drainDueBars — the fade was left behind. Under the project's documented >=1s hidden clamp: the first post-anchor tick stores C_XFADE=0 (el=0), the next tick ~1s later stores 10000 directly, so ring-player (ring-player.js:100,147-150) flips from pure A to pure B in one quantum — a hard splice, no 400ms equal-power ramp. Worse, commitFade (live.js:801) re-bases br.startGlobal to the anchor while ring B's frame 0 actually played ~1-2s later (at the 10000-store cursor); since the reader consumes one ring sample per output sample, every subsequent playQueue globalStart and fireBar `when` (live.js:730,934) leads the stream audio by that offset for the life of the stream — permanent native drum/sampler/found vs synth-stream desync, violating the code's own one-grid contract at live.js:757-768. Even visible, B starts ~5-13ms after the committed anchor. One sub-claim is overstated: the "~1s counted-underrun silence" only occurs in the empty-playQueue edge (anchor==fedEnd); normally anchor=nextDown < fedEnd so ring A keeps playing old-state audio past the anchor during the gap — the real defects are the hard cut and the lasting desync. Not by-design, no determinism impact (live scheduling only; buildEvents/press untouched), and the hidden path matters (bg-survival desktop keep-playing contract with path auto-steer triggering crossfades while backgrounded).

### [x] (2026-07-25 timing pass) During bridging the OLD stream is never fed again, and the bridge open can block for seconds on a first-time speech decode — old ring drains dry (3s budget) before the new one primes
*engine/faust/live.js:864 · ring*

produceAndRoute (live.js:859-870): once phase==='bridging' every produced bar routes to br; cur is never topped up again, so the old ring drains from its TARGET_SEC=3.0s runway. The new stream only takes over after openStream → prime (1.2s of rendered audio, ~1s wall on a state that renders ~1.2-3.5x realtime — measured below) → startFade. Critically, openStream (live.js:706-711) GATES the openLive post on the vocoder speech carrier decode: first steer into any vocoder genre runs kickSpeech (fetch/espeak-synth + decodeAudioData, with up to 3 retries × 500ms+ backoff in makeDecGate) before the worker even opens. Total bridge latency can easily exceed the 3s of audio the old ring still holds; the reader then emits underrun silence (ring-player.js:113-116) while native lanes also run out (playQueue only holds fed bars).

**Impact:** Steering into a vocoder/speech genre (spokenword, termswave family) on the ring path: several seconds of near-silence between the old groove dying and the new one arriving, plus C_UNDER_CNT pollution. Reproducible on first visit to any speech genre (cold speechCache); dense genres on slow machines hit it even without speech.

**Fix:** Keep feeding cur while bridging: in produceAndRoute's bridging branch, when the old stream's own runway (cur.fedFrames - played) falls below ~2 bars, feed cur one bar from a cur-sig continuation walk (or simply don't reroute until br has actually opened). Cheaper targeted fix: don't gate the bridge openLive on the speech decode — open with speech:null immediately (the worker already supports late setSpeech, stream-worker.js:488-492, and the wavOut path already works this way 'the open no longer blocks on the speech decode').

**Verifier:** Code trace confirms every link: during phase==="bridging" produceAndRoute (live.js:864-867) routes all bars to br and feedRunwayFrames (874) counts only br.fedFrames, so cur's ~3s runway (TARGET_SEC=3.0) is never topped up and drains with no watchdog; openStream (696-712) defers the bridge's openLive behind kickSpeech (fetch/espeak + decodeAudioData via the shared makeDecGate, 3 retries × 500ms backoff, NO time cap on the ring path), and the bridge only takes over after 1.2s (BRIDGE_PRIME_SEC) of audio renders and startFade fires; meanwhile ring-player emits underrun zeros and bumps the underrun counter once the old ring drains, and native lanes stop (playQueue holds only fed bars; br's bars are pendingBars until commitFade). Not by-design: the in-file comment claiming the gate 'never blocks the crossfade' (line 606) is contradicted by the code, and the WAV-first conductor in the same file was explicitly fixed for this exact symptom (shipSpeech/setSpeech, lines 1671-1678, 1706-1765; stream-worker.js:487-492 handles late setSpeech gen-guarded) — the ring path never got that fix. Not a determinism violation (live wall-clock scheduling only; buildEvents untouched). Caveats: the fix must keep the voxSpeechOpens/voxNullOpens verification contract in mind (open-with-null was the old hum bug — use late setSpeech, and eng.setSpeech already rebinds the carrier); the secondary no-speech slow-machine scenario is marginal (1.2s prime fits a 3s runway at ≥0.5x realtime), but the primary speech-gated mechanism is unconditional on a cold per-session speechCache.

### [x] (2026-07-25 timing pass) Fade with an empty playQueue anchors at fedEnd: the outgoing ring is dry for the entire 400ms ramp — level dip + ~34 false underruns per fade
*engine/faust/live.js:771 · ring*

startFade: nextDown = playQueue.length ? playQueue[0].globalStart : fedEnd (live.js:770-772). In the empty-queue case (old stream inside its last fed bar — exactly the starved-pump situation of the bridging finding) the anchor equals the old ring's fed end, so from the first ramp quantum ring A has aAvail=0: the reader mixes silence at gA≈1 while B fades in from 0 (ring-player.js:133-134), producing a ~400ms fade-in-from-quiet instead of an equal-power crossfade, and increments C_UNDER_CNT once per quantum (~138 quanta at 128f/44.1k over 400ms with gA>GAIN_EPS for most of it) — polluting the underruns() telemetry live.js:1355 exposes as genuine ring starvation.

**Impact:** Audible dip at crossfades that happen under feed pressure, and underrun counters that can no longer distinguish real starvation from this by-construction dry ramp (bg-survival/load reporting reads them).

**Fix:** When playQueue is empty, skip the equal-power ramp and do a short (~30ms) fade-up of B only (or clamp XFADE_MS down), and/or suppress underrun counting on the outgoing ring once its R_CLOSED/fed-end is known: producer already publishes R_CLOSED — reader can treat a-drained-and-closed as 'ended', not underrun.

**Verifier:** Confirmed. With playQueue empty at startFade (live.js:771), the fade anchor is fedEnd — the exact frame where ring A's data ends (bridging stopped feeding cur at live.js:864, so nothing is ever written past fedEnd), and the ramp holds until the cursor reaches that frame (:780). So ring A is dry for the entire 400ms ramp: the reader mixes silence at gA≈1 (ring-player.js:133-134), turning the promised bar-aligned crossfade into a 400ms fade-in-from-silence (incoming stream at -14dB at 50ms, -5dB at 150ms), and counts a false underrun every quantum since countA = gA > GAIN_EPS (137/137 quanta per fade at 44.1k — the title's "~34" is wrong, the detail's ~138 is right). Not by-design: startFade's own comment claims the old ring "can never underrun before the anchor" while guaranteeing it underruns throughout the ramp, and GAIN_EPS exists specifically to exempt non-contributing rings from the counter. Determinism unaffected (live gain/telemetry only, not buildEvents). One overstatement: no test reads underruns() — the polluted consumer is the ?wavDebug telemetry (app/live.js:166 starves), not a gate.

### [ ] (2026-07-25, gate observation) The mse-mp3 tier has no realtime margin: one post-steer `waiting` underrun in 4 of 6 runs on a loaded 4-core box — mse-opus never
*engine/faust/live.js:2269 · scheduler · found by triaging the wavout gate, NOT fixed here*

`test/wavout-test-run.js`'s mse-mp3 leg fails `noStall` (segStats().zeroPlayable == 1) after its single `swapTo("house")` steer. zeroPlayable on the append routes counts GENUINE mid-stream underruns only — the element's `waiting` event with `currentTime > 0.3` and `bufferedAhead() < 0.15` (live.js:2269) — so the element really did reach its buffer edge at the gen cutover.

**Evidence (6 runs, 2026-07-25, 4 cores, other agents rendering concurrently; 1-min load 6.58-8.32):**

| leg | runs | post-steer zeroPlayable | firstSound |
|---|---|---|---|
| mse-opus (WebCodecs native encode) | 2 full-gate | 0, 0 | 2.9-3.4s |
| mse-mp3 (lamejs, JS encode) | 2 full-gate + 4 isolated | 1, 1, 1, 0, 0, 1 | 3.0s, 4.8s, 6.6s, 6.7s, 8.7s, 14.9s |
| segAB | 2 full-gate | 0, 0 | 4.6s |

Every mp3 run reported a HEALTHY buffer either side of the event (max buffered 14-22s) and NO audible gap: 100% nonzero RMS at 100ms sampling, longest silent run 0. So the stall is a momentary buffer-edge starve at the cutover, not silence — and it happens only on the tier whose encoder is JavaScript. `firstSound` on the same leg ranged 3.0s → 14.9s across runs of identical code, which is the same story: the mp3 tier is the one with no headroom when the CPU is contended.

**Relationship to the open finding above** ("mp3 route counts skipped-gen PCM as buffered"): that entry predicts exactly this symptom ("before full deadlock, each leaked gen silently shrinks the real forward buffer, raising underrun ('waiting') stalls") but by a mechanism that needs a SKIPPED gen — a single steer with a healthy encoder should not skip one. So this is either (a) a milder second path to the same starve (the encoder falls behind, the pump's runway estimate is optimistic anyway), or (b) the first observable edge of that leak at one steer. Whoever fixes the accounting bug should re-run this leg on an IDLE box first, record the baseline, and use it as the fix's gate.

**Impact:** Fallback-tier only, and no audible gap was ever measured — but it is the tier a device drops to when AAC/opus encode is unavailable, and the ENGINE-AUDIT entry above says this same starve becomes permanent silence after rapid steering.

**Fix:** Not attempted here (engine territory). Candidates: forward-buffer accounting (see the entry above), a deeper pre-roll on the mp3 tier before the cutover completes, or dropping the tier's segment size when encode wall-time approaches realtime.

**Re-measured after the accounting fix (2026-07-25).** Still open — the accounting bug
above was a different failure and fixing it does not buy this tier any margin. Isolated
mse-mp3 leg, 4 runs, 1-min load 7.7-11.1 (1.9-2.8x cores): post-steer `zeroPlayable`
1, 1, 1, 0 — statistically the same as the pre-fix table (1,1,1,0,0,1 at load 6.6-8.3),
and the full wavout gate's mse-mp3 leg passed with 0 at load 12.3. The mechanism is now
visible in a number: after a 16-steer storm the conductor had forwarded ~28 s of PCM to
the encoder while the element's real forward buffer was **0.09 s** — the JS encoder, not
the producer, is the queue that matters, and nothing paces against it.

**Proposal (NOT implemented — needs a decision).** A demotion policy wants a
throughput signal the conductor does not have today: have `mp3-worker.js` report
encode wall-time per flush, keep an EWMA of `encodeSec / audioSec`, and (a) when it
exceeds ~0.7 for several flushes, halve `MP3_FLUSH_SEC` so the element gets fed in
smaller, earlier pieces, and (b) when it exceeds 1.0 sustained — the tier genuinely
cannot hold realtime — step down to segAB (which never showed a stall at any load)
rather than riding a buffer that only ever shrinks. The same EWMA would give the
feed pump a second, honest term: seconds of PCM in flight *inside* the encoder.

**Gate handling meanwhile:** `noStall` and `firstSound` are the gate's only realtime-MARGIN assertions. wavout-test-run.js now measures the 1-min load at start and, when the box is oversubscribed (>1.5x cores), reports those two as loud NOTICES instead of failures; route/continuity/section/steer/single/bounded/errors stay hard at every load. An idle box still holds the full contract.

### [x] (2026-07-25 correctness pass) THE PHANTOM RUNWAY: loadRatio/runwaySec counted frames POSTED to the producer, not frames rendered into the ring — the health sensor read 1.00 straight through a measured dropout
*engine/faust/live.js:1028 · ring · carried over from docs/TIMING-AUDIT-2026-07*

`feedRunwayFrames()` returns `cur.fedFrames - played` — the conductor's FEED ledger.
`fedFrames` advances when a bar is POSTED to the worker (`feed()`), not when the worker
has rendered it into the SAB, so the number says nothing about whether there is audio to
play. It fed both `loadRatio` (`min(1, runSec/TARGET_SEC)`) and `handle.runwaySec()`,
which is why the timing audit could watch 3437 underrun quanta and a 299 ms hole in the
output with `runwaySec` reading 3.4-27.7 s and `loadRatio` reading **1.00 throughout**.
A sensor that lies is worse than no sensor: this one certified the engine healthy during
the only audible dropout in the audit.

**Fixed (2026-07-25):** the feed ledger stays exactly as it was — it is the right thing
to gate the PUMP on (don't over-produce), and nothing about bar production changed — but
health is now measured on the RING. `ringRunwayFrames()` reads the producer's own
`R_WRITE` (published only after the samples are in the SAB) and walks the real playback
path: normally `cur.startGlobal + written - readCursor`; while FADING it is the incoming
ring's coverage, unless the outgoing ring runs out before the armed anchor, in which case
the hole IS the runway (the dry-ramp failure now reads as one); while BRIDGING it is the
union of the sounding ring's remainder and the bridge's primed frames, and zero the
moment the sounding ring is empty. `handle.runwaySec()` reports it; `handle.__runway()`
adds the feed ledger, the producer's unrendered `backlogSec`, phase and both rings'
cursors, so a probe can tell "the conductor stopped feeding" from "the producer stopped
rendering". `loadRatio` = `min(1, ringSec / RING_FLOOR_SEC)` with a 0.5 s floor.

MEASURED (headless, house/dub/jungle, 120 s, 4-core box at ~1.5x oversubscription): the
rendered runway breathes between the feed target and roughly one bar — p50 4.14 s, p10
2.52 s, p1 1.44 s, **min 0.94 s** — while the feed ledger sat at 5.0-5.3 s the entire
time. That gap is the phantom, and it is not an anomaly: a bar sits fed-but-unrendered
for its whole render time by construction. The floor is set at 0.5 s because that is the
depth a single measured main-thread stall (585-623 ms) can swallow. Behaviour of the
existing gates on the honest number: `live-test-run` loadRatio 1.00 throughout (PASS),
`crossfade-seam-run` PASS with the sensor correctly printing `runway>=0s load>=0` for the
one steer where the box really did starve the producer (271 quanta), `bg-survival-run`
hidden runway 8.67 s. `handle.ringDeficit()` — the audit's recommended
`read53() - R_READ(active)` readout, which turns "has ring B ever underrun and silently
desynced the native lanes" into a number — is present and read 0 across the rides.

### [x] (2026-07-25 correctness pass) The master output goes over full scale in 11.5-16% of loud windows: the "limiter" is a 2 ms-attack DynamicsCompressor
*engine/faust/live.js:443 · master · carried over from docs/TIMING-AUDIT-2026-07 "adjacent findings"*

`masterGain -> busComp -> makeup x2.6 -> limiter(DynamicsCompressor) -> analyser`, and
`userGain` feeds `ctx.destination` directly, so anything past +-1.0 is hard-clipped by
the browser. A DynamicsCompressor at threshold -1.5 dB / ratio 20 with a 2 ms attack
passes a transient's first ~90 samples at full gain, so transients walked straight
through: measured 11.5% (steady) to 16.0% (steering) of loud 100 ms windows containing an
over-full-scale sample, peak 1.213.

**Fixed (2026-07-25):** a real lookahead brickwall — `engine/faust/dsp/master_limit.dsp`,
built to `dist/`, instantiated as a Faust worklet at the END of the live master chain
(analyser, clickmon, vapor and userGain all hang off it, so the tap points still see the
listener's signal). 2 ms lookahead; gain = ceiling/peak with instant fall and 60 ms
recovery, one-pole smoothed, then a **sliding minimum over the whole lookahead window**
with the audio delayed to match — so the gain ramp has already completed when the peak
lands. `co.limiter_lad_stereo` was tried first and rejected on measurement: its one-pole
attack cannot converge inside its own lookahead (1.25 in -> 1.09 out, a hard 1.6 onset ->
1.13), i.e. it would not have closed this. Offline proof of the shipped module: amplitude
sweep to 2.0 -> peak 0.988; sustained 1.6 square -> 0.980; below the ceiling the output is
the input delayed, bit-exact (max |err| 3e-7 = float32 rounding). The 2 ms delay moves the
whole master, natives and stream alike, so no lane skew. Fails safe: if the factory can't
load, the chain falls back to exactly the previous topology.

MEASURED live A/B, same box back to back, 90 s of house/dub/jungle (the "before" leg made
the module fetch fail so the same build ran both ways), repeated in reverse order:

| | DynamicsCompressor only | + brickwall |
|---|---|---|
| loud 100 ms windows containing a sample over 1.0 | **14.34%** | **0.00%** |
| samples over 1.0 (of 4.0 M) | 784 | **0** |
| peak | 1.107 (+0.88 dBFS) | 0.983 (-0.15 dBFS) |
| integrated RMS | -9.94 dBFS | -10.04 dBFS |
| mean loud-window RMS | -10.49 dBFS | -10.50 dBFS |
| p90 window RMS | 0.5136 | 0.5105 |

So the clipping is gone and the mix is **0.01-0.10 dB** quieter — it is not squashing
anything, because below the ceiling it is transparent. Spectral check (average spectrum
over loud moments, octave bands): every band from 40 Hz to 5 kHz within +-0.52 dB, with
the top two bands measuring +1.4 / +2.8 dB — i.e. no dulling in either direction; those
bands sit at -78/-86 dB where run-to-run variance dominates. Cost: the reversed-order A/B
found 29 ring-underrun quanta WITH the brickwall vs 348 without on the same box minutes
apart, so it adds no measurable audio-thread pressure. `crossfade-seam-run` output tap:
0 zero-runs, max sample jump 0.890, PASS.

## Tier 3 — safe speedups (byte-identical contracts)

### [x] (2026-07-25) mixGrains recomputes Math.cos per sample and pays 2-3 modulos per read — 2.9x speedup, bit-identical
*engine/faust/found-player.js:319 · found*

The inner grain loop evaluates the hann window `0.5 - 0.5*Math.cos(2πi/gLen)` for every sample of every grain (gLen ≈ 5292 samples, identical across all grains of a call), and readLerp (lines 72-77) does `idx % N` plus `(i0+1) % N` on every sample even though the read pointer is in-range almost always. Benchmarked in node (24s bed, 90s source, GRAIN_HZ 28): shipped 255ms; hann precomputed into a Float64Array (same expression, cached — bit-identical) 153ms; plus an in-range fast path that skips the modulos when 0 <= idx < N-1 (idx % N === idx there, so still bit-identical — verified sample-for-sample float equality) 87ms. 2.9x total.

**Impact:** Everywhere grains render: (1) renderBedLoopPCM's main-thread idle slices — BED_SLICE_GRAINS=42 grains ≈ 16ms per slice measured, a full frame budget, → ~5.5ms; (2) the wavOut worker's per-bar bed bake (each bed fire currently costs mixGrains over its full durSec inside the render loop that must beat realtime); (3) press found layer 1.8s → ~0.6s (2.1% of an 85s vaporwave press, measured by wrapping FP.mixPCM).

**Fix:** In mixGrains, precompute the hann table once per call into a Float64Array (Float64 keeps byte-identity; Float32 does not — verified) and inline a no-modulo fast path in the read for 0 <= idx < N-1, falling back to the wrapping readLerp at the edges. Gate with test/engine.test.js byte determinism.

**Verifier:** Confirmed: mixGrains (engine/faust/found-player.js:311-325) recomputes the hann cos per sample with gLen constant per call, and readLerp (lines 72-77) pays 2 modulos per sample; a per-call Float64Array hann table plus an in-range no-modulo fast path is bit-identical (verified sample-for-sample across 7 pitch/stretch/wrap cases including heavy-wrap) and gives 3.28x on this machine (shipped 215.6ms vs 65.7ms for a 24s bed render; per 42-grain live idle slice 12.0ms -> 4.2ms, a real main-thread frame-budget win). Float32 table indeed breaks identity (first diff at sample 1), so the finding's Float64 caveat is correct. Paths are real: renderBedLoopPCM live idle slices, wavOut per-bar bed bake inside the must-beat-realtime stream render, and press mixPCM beds. Byte-determinism preserved; ~3x of its path, far above the 2% bar.

### [x] (2026-07-25) Cold f0Profile (~130-190ms synchronous) runs at bar-fire time on the main thread for autoTune'd found sources
*engine/faust/found-player.js:619 · found*

decodeUrlToBuffer only pre-seeds the F0 cache when gain > NONSPEECH_GAIN_CAP (line 619's && short-circuits the f0Profile call when gain <= 2 — which is the common case for local cache files already loudnorm'ed to -18 LUFS). For genres declaring state.autoTune, the first live.bed/live.chop for each buffer then calls tunedPitch (lines 738, 787) → cold _computeF0Profile, a synchronous O(frames·lags·frame) scan. Measured in node: 130-190ms for 10-90s buffers at 44.1k. This runs inside fireBar/scheduleNative, i.e. on the main thread from the 30ms bar-scheduler interval (live.js:925-930), exactly when the bar is due.

**Impact:** A 130-190ms main-thread stall at the first bed/chop fire of each autoTune'd source — right at genre arrival, when the scheduler is busiest; can push bar scheduling past its window (late grains/chops, UI jank). Repeats per source per genre entry until the WeakMap warms; if any browser returns a fresh array from getChannelData(0), the WeakMap misses EVERY fire and the stall becomes per-bar.

**Fix:** Pre-seed unconditionally at decode time: call f0Profile(d, sampleRate) inside the async decode job for every buffer (it is scale-invariant and already keyed on that exact channel array), ideally behind requestIdleCallback so it never lands mid-bar. Optionally also cache buffer.getChannelData(0) per AudioBuffer at decode so the WeakMap key is guaranteed stable.

**Verifier:** Mechanism holds exactly as claimed: for loudnorm'ed local-cache sources gain<=NONSPEECH_GAIN_CAP=2 is the universal case (measured 1.00-1.39 on 12 real files), so line 619 never pre-seeds the F0 cache; the first live chop/bed of each autoTune'd source then pays a 67-204ms synchronous _computeF0Profile inside fireBar on the main thread, at the bar's playback instant, delaying its own srcN.start past `when`. Not by-design (the code comment states pre-seeding was the intent — the && defeats it), well above the 2% bar (67-204ms vs a 30ms scheduler tick), and the suggested fix is determinism-safe: f0Profile is a pure scale-invariant function of (data,sr) the gain>2 path already pre-computes, so pre-seeding at decode changes timing only, zero rendered bytes. Minor caveats: measured range is 67-204ms (slightly wider than the claimed 130-190ms), and the per-bar WeakMap-miss amplification is browser-dependent (spec acquire-the-contents semantics) — but the unconditional first-fire stall alone makes the finding real.

### [x] (2026-07-25) writeWav does 16M bounds-checked Buffer.writeInt16LE calls plus a full Buffer.concat copy
*engine/faust/press.js:46 · render*

writeWav writes each stereo frame with two Buffer.writeInt16LE calls (bounds-checked JS per call) into a 4n-byte buffer, then Buffer.concat copies the entire data block again to prepend the 44-byte header. Profile: 325ms for a 90s press (7.9M frames); a 4-minute press pays ~0.9s. 

**Impact:** ~1% of press time, pure CPU + one redundant ~30MB copy; scales with song length across journey renders.

**Fix:** Allocate one Buffer of 44+n*4 upfront, write the header in place, and fill samples via an Int16Array view (or buf.writeInt16LE replaced by direct typed-array stores): int16 values from the SAME WAV.toInt16(x,'trunc') quantizer, so bytes are identical on little-endian (the only supported platforms here).

**Verifier:** Mechanism confirmed in press.js:46-53 (per-frame bounds-checked writeInt16LE x2 plus a full Buffer.concat re-copy to prepend the header). The suggested fix (single 44+n*4 allocation, header written in place, Int16Array view fed by the same WAV.toInt16(x,'trunc') quantizer) was probed and produces byte-identical output (Buffer.equals true over 15.9MB), so byte-determinism is preserved on the little-endian platforms this repo supports; alignment is safe (Buffer.alloc>poolSize gives offset 0, 44 is even). Measured magnitude exceeds the finding's own claim on this machine: at the correct 90s frame count (3.97M frames — the finding's '7.9M frames for 90s' is actually 180s), old writer costs 415-470ms vs new 82-95ms (~350ms saved, ~5x on the function), against a measured 12s render for a real 90s jungle press — ~2.8-3% of the press path, above the ~2% bar, scaling linearly with song length and across journey renders. Sole caveat: heavier-voiced genres render slower, which would dilute the fraction somewhat, but on the measured representative press it clears the threshold.

### [x] (2026-07-25) Found/zone decode spawns ffmpeg serially, ~130ms per spawn; parallelizing measured 4.0s -> 1.35s
*engine/faust/press.js:39 · render*

ffdecode uses execFileSync, and decodeInputs (press.js:147-160) loops sources one at a time. A real disco track state decodes 25 sources (mostly tiny drum/GM-zone wavs) — measured 4.0s serial, 1.35s with 8-way async execFile on the identical file set; process startup dominates (avg ~130ms/spawn for a small wav). Profile shows spawnSync = 3.7s = 10% of the 36.9s press. Two compounding wastes: (a) usedSrc is built from the FULL schedule (sched.found unfiltered by opts.dur), so --dur-capped presses (engine.test presses 8-24s) decode sources whose events all fall past the cap; (b) sampler units decode all their zones even when the unit has zero in-window events.

**Impact:** ~2.6s per full press (~7%); a much larger fraction of short --dur presses (engine.test runs 3 presses, so ~8s of test wall time is serial spawn overhead). Byte-identical output: buffers are keyed by srcId and mixing order is unchanged — only decode scheduling changes.

**Fix:** decodeInputs is already async: decode with a small concurrency pool (async execFile, ~8 workers), and filter usedSrc by event time < totalSec when opts.dur is set. Optional further win (careful, gate with byte-compare): read plain 16-bit/44.1k mono WAVs directly in JS (x/32768 matches ffmpeg s16->flt) and reserve ffmpeg for mp3/other formats — drops decode to near zero.

**Verifier:** Mechanism confirmed in code and by re-measurement. press.js ffdecode (line 39) is execFileSync and decodeInputs (147-160) loops sources serially; probe on a real disco state (32 sources) measured 4.5-6.0s serial vs 1.5-2.0s with an 8-way async execFile pool (~141-189ms/spawn, spawn-dominated), matching the claimed 4.0s->1.35s. Pooled buffers verified byte-identical to serial, and buffers are consumed only by srcId lookup with mix order unchanged, so the pressed WAV stays byte-deterministic. The waste claims hold: usedSrc (line 142) ignores opts.dur and lines 144-145 decode all sampler zones, while assemble filters events at tSec<totalSec — at --dur 8 (verify.sh quick gate) 18 of 32 decoded sources have zero in-window use, and serial decode is ~65% of the 6.9s capped press. Full press measured 53.3s wall, so pooling alone saves ~5.7% of the full-press path — above the 2% floor, and far more on the dur-capped test path. The dur filter is provably output-identical (byUnit excludes units with no in-window events; foundSec drops out-of-window events; missing unused buffers change nothing). One sub-claim is overstated: engine.test's 3 presses run concurrently (engine.test.js:8,51), so suite wall saving is ~one press's decode (~2-4s), not ~8s — this doesn't affect the verdict. The optional raw-WAV-reading fix is riskier and correctly flagged for byte-compare gating; the core fix (decode pool + dur filter) is safe.

### [x] (2026-07-25) Pitch-as-string math (parsePch/toPch/pchAdd/pchToMidi) costs ~5% of every build
*engine/csd-engine.js:10 · score*

Events carry pitch as "8.04" strings; every pass that touches pitch (voicing transposition, register-home fit measurement at lines 2393/2412, pipes harmonize/echo, weave connectors, tb303 sort) re-splits and re-parses the string. Profiled at 5.3% of the 8-section blues process (pchToMidi/parsePch/toPch/pchAdd frames combined), concentrated in the register pass and melody generators. Related smaller quadratic: pipes.js harmonize calls soundingPcs(ev.pitched, m.beat) — a full pitched scan per melody note, O(melody × pitched) — for harmonize-pooling genres.

**Impact:** A few ms per build across all gates; low single-digit percent of matrix/validate wall time.

**Fix:** Cheap local wins without changing the event contract: memoize parsePch with a Map (the pch vocabulary is tiny — a few dozen distinct strings per song), and have harmonize pre-index pad/bass events sorted by beat once per apply. A full numeric-pitch refactor is not worth the byte-identity risk.

**Verifier:** Mechanism, magnitude, and fix all hold. Pitch really is carried as "8.04" strings and re-parsed everywhere (engine/csd-engine.js:10-13; register pass at 2392/2412/2415; pipes.js:92 harmonize does a full pitched scan per melody note). Re-profiling reproduced the claimed cost: 5.40% of the buildEvents subtree self time (claimed 5.3%), pchToMidi dominant in the register pass. The vocabulary is tiny (38 distinct strings across 1112 pitched events), so a Map memo is 7.9x faster than split+parseInt on the real event stream — recovering ~4% of each 34ms build — and returns identical values, so byte-determinism is preserved. Caveat: the memo must cover pchToMidi (74% of the samples), not just parsePch as the suggestedFix emphasizes. It is ~5% of the build path (above the 2% bar) but, as the finding itself admits, only low single-digit percent of matrix/validate wall time.

### [x] (2026-07-25) applyVoiceDynamics (press path) runs a full-array mask per bar per lane — O(bars × events) + per-bar Float64Array churn
*engine/csd-engine.js:1471 · score*

dynRuns invokes the ramp callback once per bar; each invocation does `C.where(pc.beat, b=>b>=lo && b<lo+CBEATS)` over the ENTIRE pitched column (once per lane × 3) and, for drums (line 1480-1487), allocates wM + scal + sM (three arrays of dc.n) and runs a full C.map/C.and/C.scale per bar. Profiled at 8.8% of the 8-section blues process and ~10-22% of a 64-section build (the anon node at csd-engine.js:1480 alone is 21.8% of node hits there), plus 2-3.5% GC attributable to the per-bar allocations. The scalar twin applyVoiceDynamicsScalar (lines 1512-1521) has the same per-bar full-array loops.

**Impact:** Another ~10-20% off long buildEvents calls and measurable GC relief; combined with the snare-law fix the 64-section build drops an estimated 65-75%.

**Fix:** Compute each event's bar index once per pass (one O(n) sweep; bars tile [lo, lo+CBEATS) disjointly so each event is scaled at most once per run, exactly as today), then apply rampScalar per bucket. Multiplication order per event is unchanged, so doubles stay bit-equal. Apply the same restructure to BOTH the columnar and scalar twins so the CSD_SCALAR_PASSES A/B (test/columns.test.js) still proves byte-identity.

**Verifier:** The hotspot is real and even larger than claimed, but the suggested fix's core premise is false and would break byte-determinism as written; a corrected fix is available. VERIFIED: applyVoiceDynamics's press path does O(bars x events) work with per-bar allocations — the drums dynRuns callback (csd-engine.js:1480-1487) runs ~6 full-array sweeps (C.where + Float64Array alloc + C.map + C.where + C.and + amp0 loop + C.scale) over the entire drums column EVERY bar, even interior bars where every rampScalar is 1. CPU profile of a 64-section build: anon@csd-engine.js:1480 = 21.1% of self hits (finding claimed 21.8%), applyVoiceDynamics subtree = 24.7% of process; A/B via voiceDynamics:false shows the pass is ~31-50% of an 8-section blues buildEvents and ~12-44% of 64-section builds. REFUTED PREMISE: 'bars tile [lo,lo+CBEATS) disjointly so each event is scaled at most once per run, exactly as today' is false — dynRuns passes lo = spans[s].start + b where start is in BEATS but b is a BAR INDEX (csd-engine.js:1431, spans built at :1974), so consecutive bar windows step 1 beat while spanning CBEATS beats and OVERLAP; empirically in an 8-section blues 33/1112 pitched and 29/2118 drum events are scaled by TWO bar windows in the current code. A bucket-per-event/apply-once restructure changes those amps and trips meter.test.js head_byte_identity. SAFE FIX INSTEAD: early-out non-edge bars before any array work (rb = min(DYN_RAMP_BARS, floor(runBars/2)); skip when barInRun >= rb && runBars-1-barInRun >= rb — provably scalar==1 for all events regardless of per-drum floors), keeping the existing per-bar window sweeps in bar order for the few edge bars; apply to both columnar and scalar twins. Interior bars dominate long builds, so this captures nearly all the claimed 10-20% win with provable byte-identity. Note also the pitched loop (1471-1474) already guards O(n) work behind scal<1, so its cost is edge-bars only; the drums loop is the real offender.

### [x] (2026-07-25) Snare-law scans the whole drums array twice per bar — O(bars × drums), ~40-53% of buildEvents
*engine/csd-engine.js:2546 · score*

The no-three-peat pass iterates every bar of every span and, per bar, runs two full-array scans: `drums.filter(d=>d.drum==="snare"&&!dropD.has(d)&&inBar(d.beat,b0))` and the hat twin (lines 2546-2547). drums.length grows linearly with song length, and so does bar count, so the pass is quadratic. CPU-profiled (node --cpu-prof, mulberry-seeded kernel states): on a stock 8-section blues track (2118 drums, 872 beats) lines 2540-2556 take 39.6% of total process samples; on a 64-section song (journey/long-form scale) they take 53% and buildEvents balloons from 93ms to 4270ms (per-section cost 11.7ms → 66.7ms, clean O(n²) scaling). Every matrix run (274 genres × 3 seeds = 822 builds), validate-genres (3 builds/genre/seed), kernel track-resolve measurement builds, and journey rendering pay this.

**Impact:** ~30-40% off a typical buildEvents call and ~2x on long songs (64-section build 4.3s → ~2s). Directly speeds `genre-verifier matrix`, `validate-genres`, journey generation, and the in-browser offline press for long paths.

**Fix:** Bucket snare and hat events into per-bar lists in one O(drums) pass before the bar loop (bar index = the same tiling the loop uses: span-relative floor with the existing ±1e-6 epsilon, identical to inBar). Bars tile spans contiguously so each event lands in exactly one bucket; keep array order inside buckets (filter preserves it today) and apply the !dropD.has() check at consumption time. The scan is drawless — srng draws only fire on a three-peat — so a faithful bucketing is byte-identical; pin with fixtures.js + test/meter.test.js head_byte_identity.

**Verifier:** Mechanism, magnitude, and fix all hold. engine/csd-engine.js:2546-2547 filters the entire drums array twice per bar inside the per-span bar loop — O(bars × drums), quadratic in song length. CPU profile reproduces the claim: 55.6% of samples on those two lines at 64 sections (finding said 53%), with clean superlinear buildEvents scaling (316ms @ 8 sections → 4914ms @ 64 on this machine). The suggested bucketing fix, implemented in a scratchpad copy (per-span single-pass buckets, dropD applied at consumption), is byte-identical across ALL 274 genres × 3 seeds = 822 builds (full JSON compare of the event bundle, meter genres included) and delivers 2.14x on a stock 8-section track and 4.64x at 64 sections — at/above the claimed impact, well above the 2% threshold. Determinism preserved: the scan is drawless (srng only fires on an actual three-peat) so the RNG stream is unchanged. One caveat for the fixer: bucket per SPAN, not globally — round(sp.beats/BARLEN) lets a span's last bar overhang into the next span, and per-span bucketing reproduces the original filter semantics exactly there.

## Tier 4 — careful/redesign speedups (programs, not patches)

### [x] (2026-07-25, interim — the buildEvents half is still open) stepWalk renders the full chord cycle every bar and keeps 1/nch of it — 2-4x waste on the per-bar walk
*engine/faust/live.js:192 · scheduler*

Each stepWalk builds a one-section, one-cycle song (nch chord-bars long) via E.buildEvents(one), then SE.mapEvents slices only [lo,hi) = one chord-bar of it (live.js:192-204). Node measurement (replicating the exact per-bar body over kernel track states): jazz builds 171 events/bar and uses 43 (nch=4), ragtime 56→14, vaporwave 16→4; per-bar main-thread cost 1.9-3.6ms of which buildEvents+voiceUnits ≈ 60-75%. The cost repeats on the main thread every bar for both conductors and bursts during priming/pumpOnce (guard up to 24 iterations) inside the goLive gesture; on low-end mobile (where the same 40ms pump shares the thread with decode copies) the per-bar cost is several times the desktop numbers. The midiOnly escape hatch (live.js:202, added because a synchronous whole-path walk 'got the page killed') is existing evidence this walk is the hot spot.

**Impact:** Speedup: up to nch× (typically 2-4×) reduction of walk cost — ~1-2.5ms/bar saved on desktop, likely 5-15ms/bar on mobile; smooths the priming burst and reduces pump jank alongside decode storms.

**Fix:** Not safely sliceable today: buildEvents' fills/sweeps/sampleEvents read whole-section context, and the per-bar reseed (seed + serial*7919) prevents cross-bar caching — so this needs an engine-level windowed build (buildEvents(one, {beatLo, beatHi}) that provably emits the identical [lo,hi) subset, gated by a byte-identity test against the unwindowed slice across all 274 genres) before the walk can use it. Cheaper interim: skip voiceUnits/fxParams recompute when the produced bar's `one` is shallow-equal on the fields they read (verify with a fingerprint gate first).

**Verifier:** Mechanism verified in code: stepWalk (live.js:133-212) builds a full one-cycle song via buildEvents(one) then mapEvents keeps only [lo,hi) = one chord-bar (state-engine.js:1730/1739 drops the rest); per-bar reseed seed+serial*7919 (live.js:186) blocks caching as claimed. Probe replicated the numbers: jazz 151 built/38 kept (25%), ragtime 52/13, vaporwave 97/24; per-bar body 2.2-3.4ms with buildEvents+voiceUnits at 72-76%. 196/274 genres have nch=4 and 18 have nch=8-16, so 2-4x (up to 16x) build waste is typical. Burst confirmed: pumpOnce loops produceAndRoute up to guard<24 synchronously (live.js:895) and both conductors call stepWalk (lines 861, 1837); the midiOnly hatch comment documents the walk already killed a page once. Well above 2% of its path (~30-40% of the per-bar walk body is recoverable). Not by-design (reseed is design, whole-cycle-build-then-slice is an artifact) and the suggested fix explicitly gates on byte-identity, so determinism is preserved. Minor caveat: only the buildEvents portion scales with nch (voiceUnits/fxParams need the separate memoize interim), and steady-state absolute cost is small — the win is the priming burst and low-end mobile, as the finding itself frames it. Risk correctly labeled redesign.

**Interim landed (2026-07-25) — the memoize half, not the windowed build.** The
`buildEvents` waste stands: windowing it needs `buildEvents(one, {beatLo,beatHi})` in
`engine/csd-engine.js`, which is another workstream's file this round, so it stays open.
What landed in `live.js` is the finding's own cheaper half — `SE.voiceUnits` +
`SE.fxParams` are no longer recomputed per bar inside one synchronous burst. Measured
split of the per-bar walk body (node, 4-core box under load): house 6.25 ms = build 63% /
units 24% / map 13%, jazz 6.24 = 51/30/20, ragtime 4.45 = 53/23/23, disco 4.05 = 42/21/37,
vaporwave 1.21 = 31/35/33 — so this removes **22-40% of the body** wherever the burst
runs more than one bar (priming, and `pumpOnce`'s up-to-24-bar catch-up loop, which is
where the finding says the cost actually hurts).

SAFETY, which is the whole question here: the app MUTATES the live state object in place
while gliding (`app/targeting.js glideStep` walks bpm, sends, dx7 params, found levels),
so a cache with any lifetime would go stale and change what is heard. This one cannot:
the memo is invalidated by a **microtask**, so it is only ever reused inside a single
synchronous run of the walk — nothing can mutate the state without first yielding the
thread. Its key additionally pins the state object, the section object, and the bar's
fill/sweep flags. The remaining assumption — that `voiceUnits`/`fxParams` are blind to
the per-bar reseed and to `_liveEdge`/`_voiceRun` — was measured, not assumed: 822 states
(274 genres x seeds 1/4/7) x 8 bars, **0 differences** in either output. Byte parity was
then proven end-to-end by replaying `makeWalk` twice — once as a tight burst (memo
active), once yielding to a macrotask between bars (memo provably cold) — over all 274
genres x 2 seeds x 16 bars: **8768 bars compared, 0 mismatches** (units, events, fxParams,
sig, found, meta). `test/live-walk-parity.test.js` (which drives makeWalk in exactly such
a burst) stays green.

### [x] (2026-07-25 performance pass) Per-64-sample render() calls pay a fresh output allocation each — batching change-free spans is byte-identical and kills ~5% of press time
*engine/faust/press.js:250 · render*

faustwasm's FaustOfflineProcessor.render allocates new Float32Array(length) per output per CALL (index.js:4055) and internally chunks at fBufferSize=64 anyway. press/render-core call render(len=64) per block: the disco press makes ~530k render calls (hammond pool 295.5s voiced = 203k, fx_bus/rev_bleed/reverb-color/master_mb 62k each, insert chains 2x62k). Profile: 1.93s in the allocator lambda + 0.61s render self + 0.79s GC ~= 9% of the press. Verified byte-parity empirically: rendering 441037 samples of insert_delay and fx_bus per-64-block vs one render(N) call produced 0 differing samples (compute sequence is identical because the internal loop chunks at the same 64), with a ~20% per-pass win for 1-input modules. Whole-song fixed-param passes (both insert-chain loops press.js:250/render-core.js:198, rev_bleed press.js:310, reverb color press.js:323, master_mb press.js:373, fx_bus when no sweep is active press.js:347) can be single or few calls; render-core's voice walk can batch runs of change-free blocks (changes cluster at note boundaries), preserving the change-application block exactly.

**Impact:** ~1.5-2s (4-6%) of a 90s press from allocation/GC/call overhead, measured 3.3us/call saved in the microbench; also removes ~600k short-lived Float32Array allocations per press.

**Fix:** In the fixed-param loops, call proc.render(ins, span) over the longest change-free span (whole song where no setParamValue occurs; for fx_bus, spans between blocks where mcut actually changes). In render-core, extend the block loop to render up to the block containing the next pending change. Bonus: faustwasm zero-fills missing inputs, so fx_bus's `zero` input array can simply be omitted. Gate with faust/segment-parity-test.js — parity already demonstrated at the module level.

**Verifier:** Mechanism, parity, and magnitude all hold. faustwasm's FaustOfflineProcessor.render (esm/index.js:4054) allocates fresh Float32Array outputs per call and internally chunks compute at fBufferSize=64 (the same BS press passes to createOfflineProcessor), so per-64 calls vs one render(N) execute an identical compute-slice sequence; start()/stop() per call only toggle fProcessing (no state reset), so batching is state-safe. My independent probe showed 0 differing samples in all cases: fixed-param insert pass, 6-input fx_bus, fx_bus with a mid-stream setParamValue split at the 64-aligned change block, and a gated hammond voice with spans cut at change blocks (the exact shape render-core batching needs — its segment starts are already 64-aligned and changes apply before the containing block, so change-boundary cuts reproduce application order exactly). Byte-determinism is preserved because output bytes are unchanged, not merely equivalent. Magnitude: an instrumented full disco press (seed 7, 169.7s) made 1,067,780 render calls, 54.8s total, 66% inside render(); microbench deltas (insert_delay 26% pass win = 3.6us/call, hammond 13.8% = 4.9us/call) scale to ~2-4s ≈ 4-7% of the press — above the 2% bar and consistent with the finding. Caveat worth carrying into the fix: fx_bus's own pass won only ~0.5% (heavy DSP + internal per-slice input subarrays remain), so the payoff concentrates in the 0/1-input passes — the voice walk and the whole-song insert/rev_bleed/reverb-color/master_mb loops. The zero-input-omission bonus is also verified (render zero-fills missing inputs).

**Fixed (2026-07-25):** `render-core.SPAN_MAX` (64 × 1024 samples) is the new batching
unit. The voice walk extends each render call over the following blocks until the next
pending change would apply (changes cluster at note boundaries, and the change-application
block is preserved exactly); the whole-song fixed-param passes — both insert chains,
`rev_bleed`, the reverb color node, `master_mb` — now run in SPAN_MAX calls; and `fx_bus`
renders one call per run of blocks that set the SAME mcut (i.e. everything outside a live
sweep, and the whole song when a state has no sweeps), since `setParamValue` with an
unchanged value is a no-op write. The unused 6th `fx_bus` input and the vocoder's
zero-input array are simply omitted — faustwasm zero-fills a missing input. Byte-identity
is structural: faustwasm chunks its compute at `fBufferSize` = BS and slices inputs the
same way, so render(ins, k·BS) *is* k render(ins, BS) calls. Measured (interleaved, CPU
ms, pinned engine): citypop_s7 -15.5%, trance_s3 -6.0%, salondawdle_s3 -4.6%,
vaporwave_s1 -4.2% of the whole press — the batching share dominates on synth-heavy
states, the strip fusion below on sampled ones. All 6 A/B tracks sha256-identical.

### [x] (2026-07-25 performance pass — closed byte-identically; the CONTROL-RATE fix REJECTED) Per-sample LFO/coefficient math makes channel strips 87% of sampler time (~30% of a whole press)
*engine/faust/sampler.js:148-222 · sampler*

stripStep runs per sample per note. Measured on a real press (citypop, seed 7, 30s, node probe wrapping SP.mixPCM): mixPCM = 4954ms of a 14488ms press with strips, but only 663ms with sends.strip nulled — the strips are 87% of sampler time and ~30% of the entire press. The cost is transcendental control math recomputed at audio rate for sub-Hz modulators: chorus computes 1-2 Math.sin per sample (lines 161, 175) for LFOs at 0.45-0.8 Hz; the phaser recomputes Math.sin + Math.pow + Math.tan PER SAMPLE (lines 185-186) for a 0.22 Hz sweep; leslie/flanger each add 1-2 sin/cos per sample (194, 213). A probe reimplementing stripStep with the LFO delay/allpass coefficient updated every 32 samples (keyed on note-relative i, so window parity is preserved — each window re-renders the note from i=0) cut the pad strip from 21.3 to 12.7 ms per audio-second (-40%). Negative result also measured: making makeStrip emit uniform-shape state objects (monomorphic ICs) wins only ~3% — the cost is intrinsic math, not V8 shape polymorphism.

**Impact:** ~1.5-1.7s off a 14.5s press (~12%), and the same code runs per bar in stream-worker for the wavOut/mobile live lane — direct battery/CPU win on phones. A 0.22 Hz phaser coefficient stepped at 1378 Hz instead of 44100 Hz is inaudible.

**Fix:** In stripStep, update chorus/phaser/leslie/flanger LFO values and the phaser allpass coefficient at a 32-sample control rate (cache on the strip state, recompute when (i & 31) === 0 with i passed in note-relative), keeping all buffer reads/writes per-sample. Output bytes change (inaudibly), so segment-parity/strip-fuzz gates must be re-blessed and ears consulted; window parity holds because i restarts at 0 per note in every window.

**Verifier:** Confirmed. stripStep (sampler.js:148-222) recomputes transcendental LFO/coefficient math (chorus sin x2, phaser sin+pow+tan, leslie 2x sin, flanger cos) per audio sample for sub-Hz modulators, and shipped STRIP_PROFILES put chorus/phaser/leslie on every sampled pad and lead. Re-ran the probe: on a citypop seed-7 30s press, mixPCM = 8306ms of a 21613ms press with strips vs 673ms of 10244ms with sends.strip nulled — strips are 92% of sampler time and ~35% of the whole press (finding claimed 87%/~30%). A faithful 32-sample control-rate reimplementation cut the pad strip 31.2→16.3 ms/audio-sec (-48%) and lead+leslie -31%, confirming the mechanism is control math, not buffer work. Fix is legal under the laws: run-to-run byte determinism is preserved; window parity holds because strip state is per-note ("window-independent", line 335) and each stream window re-bakes notes from i=0 (lines 262-264); the mobile/wavOut lane really does run this code (stream-renderer.js SP.mixPCM per window). One-time output-byte change requiring gate re-bless + ears is honestly flagged in the finding. Implementation caveat: zero-order-hold staircases the leslie fast rotor (~6.7 Hz; measured -16.7 dB rel delta on noise vs -27 dB for pad) — interpolate control values between update points or keep the leslie horn LFO smooth.


**Closed the other way (2026-07-25).** The diagnosis is right — strips are the single
biggest engine cost — but the suggested fix (LFO/coefficient math at a 32-sample control
rate) MOVES OUTPUT BYTES, and this pass ran under a hard byte-identity law, so it was not
shipped. What shipped instead is the fused per-shape kernel (see the stripStep entry
below), which takes 10-53% off the strip depending on profile with bit-identical output.
The control-rate idea is therefore recorded as a STANDING PROPOSAL, not a bug: measured
~-40 to -48% of strip time on top of what fusion already saves (pad 31.2 -> 16.3 ms per
audio-second in the audit's own probe), at the cost of one re-bless of every byte gate
(segment-parity, press fixtures, strip-fuzz) plus ears — and with the verifier's caveat
that zero-order-hold staircases the ~6.7 Hz leslie horn rotor (-16.7 dB rel delta), so
that LFO needs interpolation or must stay per-sample. Whoever takes it needs an explicit
waiver of the byte law, which is exactly why it is not taken here.

### [x] (2026-07-25 performance pass) Stream renderer re-renders every multi-bar sampler note from sample 0 in each window — O(P²) work for P-bar notes
*engine/faust/stream-renderer.js:631 · sampler*

renderChunk selects win = su.notes.filter(nt => nt._s0 < end && nt._end > base) and calls SP.mixPCM with {base, len, total}; mixPCM (sampler.js:306+) always iterates i from 0 at the note's start, computing full strip/loop state and discarding output where j<0 (documented as the window-parity contract, sampler.js:61-69). A pad/lead note spanning P bar-windows is therefore rendered ~P(P+1)/2 bar-lengths instead of P — and with strips measured at 87% of mixPCM cost (finding 1), the wasted pre-window computation is nearly all strip DSP. Pads under chordEvery hold 2-4+ bars, so the sampler cost of the wavOut/mobile live lane and the offline stream is ~1.5-2.5x what a stateful render would pay.

**Impact:** Roughly 1.5-2.5x excess sampler CPU per bar on the stream/wavOut path (the pocket-proof mobile lane where CPU = battery and render deadlines), growing quadratically with note length.

**Fix:** Checkpoint per-note running state (strip biquad/comp/chorus/delay/flanger state, posAcc, loop position) at each window boundary and resume in the next window: resuming from deterministically-computed state replays the identical float operation sequence, so output stays byte-identical — verify with faust/segment-parity-test.js before trusting. Purely additive to mixPCM's API (an optional resume handle per note).

**Verifier:** Mechanism confirmed in code: stream-renderer.js:629-653 calls SP.mixPCM per chord-bar window with {base,len,total}, and sampler.js mixPCM (lines 284-431) always iterates from the note's i=0 doing full interp+envelope+strip work, discarding all output where j<0 (the documented window-parity contract, sampler.js:61-69) — O(P^2) work for a note spanning P windows. Empirical probe (wrapping the injected SP.mixPCM, real media, offline stream path across 8 genre states): mixPCM is 60-82% of the whole stream render wall time on sampled genres, with iteration excess factors x1.29-x1.79, i.e. wasted pre-window work is ~8-35% of the ENTIRE stream/wavOut render path per state (~22% aggregate) — far above the 2% threshold. The finding's 1.5-2.5x excess-sampler-CPU claim is slightly high vs my measured 1.3-1.8x at a 40s cap, but directionally correct and grows with note length. Not by-design: the sampler comment forbids per-window-FRESH strip state (which would break bytes), not checkpoint-resume; resuming deterministically-saved per-note state (plain JS numbers, chunks enforced strictly in-order at stream-renderer.js:592) replays the identical float-op sequence, so byte-determinism is preservable and is gated by test/segment-parity-test.js as the suggested fix specifies. Minor immaterial inaccuracy: the "87% strip" attribution doesn't matter — the whole iteration body is wasted regardless.

**Fixed (2026-07-25):** `sampler.mixPCM` takes `win.resume`. A note that runs past the
window parks its COMPLETE mutable state on itself (`n._rs`: sample index, rate
accumulator, mellotron head-EQ memory, the per-note strip object, and — new — the
ring-out cursor + quiet counter, since the delay tail crosses seams too) and the next
window picks it up, so every sample is computed exactly once. One ordering change was
required and is output-neutral: the window-edge test moved ABOVE the sample work in all
three note loops (body/mellotron/granular) and in `ringOut`, because the old order
computed a sample it then threw away — which would have parked state one sample ahead.
The resume is GUARDED, not assumed: the record carries the absolute sample it stopped at
and is honoured only if this window starts exactly there, so an out-of-order, repeated or
mid-song-start window silently falls back to the full re-render. Proof: `segment-parity`
10/10 byte-equal with resume live, plus a chunk-level A/B against the HEAD renderer
(identical real DSP + real media, every chunk memcmp'd) BYTE-EQUAL on 10 states.
Measured render-loop win on that harness: citypop_s7 -42%, vaporwave_s1 -45%, jazz_s3
-38%, salondawdle_s3 -34%, vaporwave 30s -29%, house_s7 -25%, spokenword_s3 -25%,
trance_s1 -23%, mallsoft_s3 -6%, jungle_s7 -5% (break-heavy = almost no sampler).

### [x] (2026-07-25 performance pass) Windowed mixPCM rebuilds each bed's FULL multi-bar segment (grains + lp24) to write one bar's slice
*engine/faust/found-player.js:352 · found*

Under a win, mixPCM still builds the entire event segment — for a bed, mixGrains over the full durSec plus lp24 over the full length (lines 349-356) — then the write loop discards everything outside [base, base+len). Today the truncation bug hides most of this (the bed is only passed once), but the correct fix for that bug (re-passing the event per overlapping window) makes this O(cycleLen) work per bar: a chordEvery-32 drone's ~77s bed would cost ~0.9s of mixGrains+lp24 in the worker for EVERY bar it spans (~4x-nch x redundancy).

**Impact:** In the wavOut worker each bar render must beat realtime to keep the runway; a multi-second full-segment rebuild per bar per bed eats most of that margin on mobile-class cores. Fixing it alongside the truncation fix keeps the segs path realtime-safe; estimated ~nch-fold (typically 4x, up to ~16x for long drones) reduction of the found bake cost per bar.

**Fix:** mixGrains already takes gFrom/gTo: render only the grains whose [floor(g*hop), +gLen) span intersects the window (pointer = gFrom*advance reconstructs phase exactly). For lp24 parity, run the filter from segment start OR carry per-event biquad state across chunks (or use a renderBedLoopPCM-style primed warmup region); the segs path is not byte-gated against press, but gate with segment-parity/wavout RMS tests.

**Verifier:** Mechanism confirmed in code: under a win, mixPCM (found-player.js:339-370) builds the event's FULL segment — new Float32Array(durSec*sr) (unclamped in live mode since total=0x7fffffff, stream-renderer.js:287), mixGrains over grains 0..Infinity, lp24 over the whole length — then writes only the [base, base+len) slice. Beds really span cycles (dur=secBeats, csd-engine.js:1654; 128 beats @100bpm = 76.8s ≈ the claimed ~77s). The truncation premise is accurate: live-mode mapEvents includes a bed only in its start bar (state-engine.js:1924, bedAll is press-only, the 'bedWin' comment is stale), so the correct truncation fix re-passes the bed per overlapping bar, making the full rebuild O(cycleLen) per bar (16x for 8-beat bars under a 128-beat bed). The path is live code (bakeNative set by stream-worker.js:316 — the mobile WAV-FIRST playback path), not part of the in-flight export/video deletion. Determinism safe: press passes no win (byte-identical), the segs path is not byte-gated against press, mixGrains already supports exact [gFrom,gTo) slicing (pointer = gFrom*advance, line 313), and lp24 chunked-state/primed-warmup has an in-file precedent (renderBedLoopPCM lines 653-673).

**Fixed (2026-07-25, byte-identically):** rather than slicing grains by `[gFrom,gTo)`
(which cannot keep lp24 byte-identical without carrying filter state), the segment build
is TRUNCATED at the window's end: `nEff = min(n, winBase + busLen - s0)`, with the
envelope math still keyed on the full `n`. Everything in the event bake is causal — grain
overlap-add writes forward, `lp24` is a forward IIR, the envelope is per-sample — so the
samples that get written are computed with the identical arithmetic. `mixGrains` needs no
change at all: it already stops at `dst.length`. Measured on real windowed bakes (the
event's own bar, HEAD vs new, byte-compared): mallsoft_s3 -74%, ambient_s2 -79%,
vaporwave_s1 -6% (short beds), all four buses byte-equal. Residual, unfixed and now
harmless-by-comparison: a window that starts LATER than the event still builds from the
segment start (the lp24 state demands it) — that only arises once the Tier-2 bed
truncation bug is fixed, and the fix for it is per-event filter-state carry, not slicing.

### [x] (2026-07-25 performance pass) Live stream renders only 1.2-3.5x realtime; the dominant JS cost is the per-sample native sampler strip (stripStep) — ~25% of the render loop
*engine/faust/sampler.js:147 · ring*

Measured with a node probe driving makeStreamEngine exactly as the ring producer does (scratchpad probe, house_s7): chunks render at 712ms-2.0s per 3.9s bar (1.9-5.5x rt), whole-song 1.2-3.5x rt, cost tracking event density (26→56 ev/bar). CPU profile of the run: sampler.js stripStep 13.3% + sampler mixPCM 3.7% + found mixPCM 1.1% of whole-process samples vs ~20% wasm and 4.3% renderChunk self; excluding the ffmpeg decode phase (spawnSync 41.9%) the native-PCM layer is ~30% and stripStep alone ~24% of the render loop. stripStep (sampler.js:147) is a per-note, per-sample megamorphic dispatch: 10+ 'if (S.x)' feature tests and property loads per sample per note, called from the stream path at stream-renderer.js:639/653.

**Impact:** The live ring's headroom IS this render speed: every % here directly widens the margin before eco-mode/underruns on weak machines (a dense bar at 1.9x rt leaves ~2s of a 3s runway consumed per bar rendered). A specialized strip loop is worth an estimated 10-20% of total chunk render time (stripStep is ~24% of the loop; halving its dispatch overhead is realistic).

**Fix:** Compile a per-note strip kernel once in makeStrip: build the chain as a small array of monomorphic stage closures (or generate a fused function) so the per-sample loop is a tight for-of over active stages with locals, instead of re-testing all ~12 feature flags per sample. Determinism-safe if the arithmetic and stage order are unchanged (per-note state law preserved); gate with segment-parity byte-equality.

**Verifier:** Confirmed with one implementation caveat. stripStep (sampler.js:148) really is a per-sample per-note chain of 11 feature-flag guards over polymorphic strip-state objects, called from every mixPCM loop (lines 375/407/427) on the stream path (stream-renderer.js:641/654). A fresh CPU profile of the ring-producer probe reproduces the claimed share: stripStep self = 15.4% of process, ~23% of the render loop excluding the ffmpeg decode phase (finding said ~24%). The suggested fix works ONLY in its fused form: an array of per-stage closures (the first option named) is byte-equal but 6% SLOWER; a generated fused kernel per strip shape (the second option named — cached by presence-flag key, stage bodies verbatim) is byte-identical on every chunk and speeds the whole render loop by 11.1% (house_s7), 4.5% (jungle_s7), 12.1% (citypop_s7) — above the 2% bar and inside the estimated 10-20% band for strip-heavy genres (top end optimistic). Determinism preserved: per-note strip state and global-song-time LFOs untouched, proven by chunk-level byte equality against the unmodified stream renderer on 3 genres, so segment parity holds. Any landing must use the fused-kernel form and gate with segment-parity byte-equality as the finding says.

**Fixed (2026-07-25) in the FUSED-KERNEL form the verifier prescribed:** the eleven
stage bodies now live in `STAGE_SRC` as source text (verbatim the arithmetic the guarded
blocks held) and `kernelFor(S)` fuses the stages a strip actually has into ONE generated
function, cached by shape key and baked onto the state by `makeStrip`. No feature tests
per sample, no polymorphic dispatch. The guarded stepper survives as `stripStepRef` for
two reasons: it is the CSP fallback (HOSTING.md §4 proposes a policy without
`'unsafe-eval'`; `kernelFor` catches the Function-constructor failure and returns it), and
it is the DRIFT GATE — `test/strip-fuzz-test.js` now replays all 15 strips × 8 signals
through both and requires bit-identical output, so an edit to one that misses the other
fails a gate instead of moving pressed bytes. Microbench per shipped profile (min-of-7,
alternating, identical accumulated sum): bass -13.9%, pad -10.2%, lead -53.0%, drum
-19.7%. Whole-render-loop effect and the realtime ratios it buys are in the O(P²) entry
above (the two land together): 2.4-5.1x rt -> 3.8-6.8x rt on the sampled genres.

## Refuted (kept so nobody re-finds them)

- **28% of press time is wasm-to-JS trampolines: all transcendental math is imported from JS (Math.sin/pow/tanh per sample)** (render): The profile diagnosis is genuine (re-ran it: wasm-to-js trampolines = 25.7% of a 90s disco press vs 23.3% wasm compute; dist modules import _sinf/_powf/_tanhf/_expf/_tanf from env, wired to Math.* in faustwasm createWasmImport), but the finding's mechanism for the speedup is false: prototyped '-ftz 2 -fm def' on hammond.dsp and faust's wasm backend does NOT inline math under -fm — it merely renames the imports to _fast_expf/_fast_powf/_fast_sinf/etc., so every call still crosses the wasm-JS boundary and the trampoline cost is untouched. Worse, faustwasm 0.16.5 provides no _fast_* symbols at all, so the rebuilt module fails to instantiate (WebAssembly.instantiate: import env._fast_expf requires a callable) — the suggested fleet rebuild would break press and the live AudioWorklet outright. Eliminating the trampolines for real requires a different toolchain (linking/inlining a wasm libm), a redesign the suggested fix does not deliver; additionally the ~25% impact is inflated since trampoline self-time includes the Math builtin work itself and press wall time includes ~19% ffmpeg spawnSync.

- **Live vocoder carrier reader allocates a fresh Float32Array and does two modulos per sample for every 64-sample block** (ring): Mechanism confirmed (per-block Float32Array alloc + redundant double-modulo at stream-renderer.js:509/:785, called per voice per 64-sample block from :211; suggested fix verified bit-identical incl. loop wrap), but the speedup is below the ~2%-of-path threshold: measured against the real robot_choir vocoder WASM, the closure saving is ~2.5 ms per vocoder-voice per 4s bar vs ~234 ms for that voice's own WASM render — 1.07% of the vocoder unit alone, and well under 1% of the full producer bar path (which also renders all other units, fx bus, mixing, and sampler bake). Interleaved end-to-end A/B delta (1.18%) was within run-to-run noise. GC pressure is real but minor (~0.7 MB/bar/voice of short-lived nursery garbage). A safe, deterministic micro-cleanup, not a material speedup.
