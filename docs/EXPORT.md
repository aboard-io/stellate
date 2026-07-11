# EXPORT — download the music (and eventually an hour of it, with video)

Paul's goal: *"generate an hour of music plus video and DOWNLOAD it at high
res — audio, video, or MIDI."* This doc records (1) the shipped first slice —
per-song MIDI + audio downloads straight from the ⚙ panel — and (2) the design
for the hour-scale audio/video pipeline, which is a **server-side render
service on the droplet**, not a browser marathon.

---

## 1. Shipped: the first slice (2026-07-09)

Three new buttons in the ⚙ panel's download cluster (next to ⤓ preset / ⤓
path), all named from the chyron's deterministic NameBank identity, so the
file matches the band card on screen (`The Signalmen — Standard Time.mid`):

| Button | What it does | Where |
|---|---|---|
| **⤓ midi** | `MidiExport.buildMidi(S.playing)` → Standard MIDI File (type 1, 480 ppq: tempo/meter meta + Pads/Bass/Melody + ch-10 GM drums), from the SAME `buildEvents()` walk the audio plays | `engine/midi-export.js` (pre-existing, now loaded by `index.html`), `app/export.js` |
| **⤓ wav** | true **offline in-browser press** of the current song → lossless 44.1k/16 stereo WAV | `app/export.js` + `engine/faust/stream-worker.js` `renderWav` |
| **⤓ mp3** | the same press, then 192 kbps MP3 via the existing encoder worker (lamejs) | `app/export.js` + `engine/faust/mp3-worker.js` |

**The audio choice, and why.** A real browser offline press was reachable, so
the slice ships it (no "render on your machine" consolation button needed).
The pieces already existed:

- `engine/faust/stream-renderer.js` `open()`+`renderChunk()` is the
  whole-song, press-parity render core — gated byte/near-bit against node's
  `engine/faust/press.js` by `test/segment-parity-test.js`.
- `engine/faust/stream-worker.js` already exposed it as the `renderWav`
  message (built for the iOS background-WAV handoff): a dur-capped offline
  render to one WAV ArrayBuffer in a worker.

What was missing: `renderWav` hard-coded `buffers:{}` — no found sound and,
since the sampled-by-default change (2026-07-08), **no pitched sampler voices
either** (SF2 zones ride `foundSources`; an empty buffer table bakes them
silent). The slice therefore:

1. extends `renderWav` to accept `msg.buffers` / `msg.speech` (defaults keep
   the iOS caller byte-identical) and post `{wavprog}` progress;
2. `app/export.js` decodes the schedule's found/sampler/speech PCM on the
   main thread exactly the way the wavOut conductor does
   (`FP.decodeUrlToBuffer` / `SP.decodeUrlRaw` under a small concurrency
   gate, vocoder carrier TOTAL-tiled like `press.js decodeInputs`), spawns a
   **dedicated** stream-worker (the live ring/wavOut producers are never
   touched), and ships the PCM in the open payload;
3. the returned WAV downloads as-is (lossless — 16-bit is the committed press
   format, `faust/wav.js`), or is fed in 8 s slabs through `mp3-worker`'s
   single-encoder stream for the MP3 variant.

Failure posture: sources that fail to decode (e.g. archive.org beds offline)
are skipped with a status note, matching the live app's graceful-degrade;
exports run one at a time; progress rides the chyron status line.

**Gates.** `test/explorer-ui-test.js` section J (all green):
- J1: the three buttons render in the panel;
- J2: clicking ⤓ midi (headless, download suppressed via the
  `window.__EXPORT` hooks) yields a byte-valid SMF — full chunk math parsed in
  node (`parseSmf`: MThd len 6, MTrk lengths tile the file, every track ends
  FF 2F 00), format 1 / 480 ppq / ≥2 tracks;
- J3: an 8 s-capped `exportAudio("wav")` returns a canonical RIFF/WAVE,
  44100 Hz, exactly the capped length, with real sound (rms ≈ 0.057 in the
  gate run).
The MP3 path was probe-verified the same way (6 s press → 145 KB of
frame-synced MPEG audio, zero page errors).

---

## 1.5 Shipped: the whole-path (loop) audio export (2026-07-11)

Paul: *"export the entire path, not just the current song. The whole mix."* When
a **loop** is drawn (≥2 waypoints), ⤓ wav / ⤓ mp3 render the ENTIRE journey —
every genre it crosses, gapless — instead of the single current song. The route
is one line in `app/panels.js`:

```js
const exportAudioSmart = (fmt) =>
  (S.waypoints.length >= 2 ? exportLoopAudio(fmt) : exportAudio(fmt));
```

so the same two buttons do the right thing with no new UI. The pipeline:

1. **Plan** — `app/journey.js buildLoopPlan(opts)` walks the drawn path
   bar-by-bar at constant pace and groups consecutive bars into
   **topology-stable RUNS**: a run boundary (a crossfade seam) opens wherever
   the Faust unit signature *or* a master-stage module (reverb color, master
   comp) changes — because `openLive` fixes that topology once per session. It
   also enumerates every found / sampler / vocoder / speech source the whole
   loop touches (srcIds are global) so the caller decodes each ONCE. It is
   **async + chunked** (F.3): it yields every 32 bars (`opts.onProgress`) and
   builds runs as it walks, so a long plan can't freeze the page. `loopBars`
   caps the walk at 2048 bars (the residual truncation for huge paths).
2. **Decode** — `app/export.js decodeLoopInputs(plan)` decodes the plan's
   sources on the main thread under a concurrency gate of 4 (speech carriers
   stay RAW — `openLive` loops them, unlike the single-song TOTAL-tiling).
3. **Render + stream** — a **dedicated** `engine/faust/stream-worker.js`
   `renderLoop` message bakes each run in its own `openLive(bakeNative)`
   session, crossfades the 0.12 s seams, and STREAMS int16 PCM back
   block-by-block. It is memory-bounded by construction: the worker never holds
   the whole loop, and the audio producers that feed live playback are never
   touched (a fresh worker is spawned for the export).
4. **Assemble** — for WAV, `exportLoopAudio` builds the file from int16 body
   parts as a `Blob` of parts (no giant contiguous copy); for MP3 it feeds each
   streamed block to `engine/faust/mp3-worker.js` (192 kbps) as it arrives.

Failure posture matches §1 (sources that fail to decode are skipped with a
status note). With no loop drawn, `exportAudioSmart` falls straight back to the
single-song press of §1. Progress rides the chyron status line
("whole-path: planning… / decoding… / rendering N%").

---

## 2. The hour scale: a render service on the droplet

### Why server-side

An hour of 44.1k stereo Float32 is ~1.2 GB per channel-pair in worker memory,
the tab must stay open for the whole render, and hour-scale **offline** video
composition (ffmpeg xfade chains, the VHS fry) does not exist in the browser.
(A realtime browser capture of the *live* visuals now DOES ship — `app/video-export.js`'s
⏺ button records the canvas+audio through `MediaRecorder` → webm; see
`docs/VIDEO-EXPORT.md`. But it captures what one foreground session plays, in
one pass; it does not compose the hour-scale, genre-affine, deterministic reel
— that stays a server-side ffmpeg job.) Meanwhile the
node pipeline already does the ENTIRE job in one command — the same one the ⚙
panel's ⤓ path hint prints:

```
node engine/genre-kernel.js journey stellate-path.json --hours 1 --render --video
```

That consumes the app's ⤓ path JSON (waypoints + weights + seed), plans the
tracks, presses each with `engine/faust/press.js`, DJ-mixes into one
beat-aligned `journey.mp3`, renders per-track MP4s via
`tools/render-sample-video.js journey` (cuts locked to section downbeats),
concatenates to `journey.mp4` (`-c copy`, no re-encode), and writes a mix
page. The render service is a thin queue around this command — no new render
code.

### Measured costs (dev box, 2026-07-09; node single-process)

| Job | Output | Wall | CPU | xRT (CPU-time / audio-time) |
|---|---|---|---|---|
| `press.js` night-drive (synth-heavy) | 172.2 s WAV | 61 s | 59.5 s @100%, 317 MB RSS | **0.35× (≈2.8× faster than RT)** |
| `render-sample-video.js journey` vaporwave-s3 (audio + video) | 193.2 s MP4 | 296 s | 480 s @162% | **2.5× RT of CPU** (1.53× wall on 2 cores) |

The measured MP4: 640×480 30 fps, x264 crf 23 + AAC 160k = **1.13 Mbps ≈
27.3 MB per 3.2-min track ≈ 0.51 GB/hour**. (The prompt says "720p": the
committed pipeline is 480p — deliberately, the fry is the aesthetic. A 720p
variant at the same crf would land roughly 1–1.5 GB/hour; treat that as an
estimate until measured.)

Scaled to one hour, on the droplet (nyc3 `s-1vcpu-1gb`, 1 GiB RAM / 25 GiB
disk — HOSTING.md §5). A shared DO vCPU runs roughly 1.5–2× slower per core
than this dev box, and everything is serialized on 1 core:

| 1-hour job | Droplet wall estimate | Artifact size |
|---|---|---|
| audio only (`--render`) | **~30–45 min** (0.35× RT × 1.5–2 slowdown) | `journey.mp3` @160k ≈ **72 MB** |
| audio + video (`--render --video`) | **~4–5 h** (2.5× RT CPU × 1.5–2) | mp3 + `journey.mp4` ≈ **0.5–0.6 GB** (480p) |
| MIDI only | seconds | ~15 KB/track ≈ 0.3 MB |

Honesty rule: these are extrapolations. The service's first act on the
droplet is to time one real track and compute ETAs from its OWN measured
history, not this table.

Peak resources per job stay bounded because everything is per-track
(~3 min each): press RSS ~320 MB, per-track WAV ~30 MB, the MJPEG fry
intermediate in `/tmp` ~150–250 MB, plus the final artifacts. That fits 1 GiB
RAM + 25 GiB disk (media payload is 608 MB; OS+payload leave ~20 GB free) —
with `nice -19` so nginx never starves. RAM is the tight one: **never two
renders at once.**

### The service (tools/render-server.js — sketch only, NOT built)

A ~200-line node HTTP server on `127.0.0.1:8790`, proxied by nginx under
`/render/`; artifacts under `/srv/renders/` served by nginx directly
(`X-Accel` or a plain alias). No framework, no DB — a job is a directory.

```
POST /render/queue      body: the ⤓ path JSON + {hours:1, video:true|false}
                        → 429 if queue full (cap ~3), else {id, position, eta}
GET  /render/status/:id → {state: queued|rendering|done|failed, track: "3/14",
                           pct, eta, artifacts:[{name,bytes,url}], expiresAt}
GET  /renders/:id/journey.mp3|.mp4|midi.zip|credits.txt|mix.html
```

- **Queue: strictly one render at a time** (an in-memory FIFO + a lockfile so
  a crashed server can't double-run). Each job:
  `spawn("nice", ["-19", "node", "engine/genre-kernel.js", "journey",
  jobDir+"/path.json", "--hours", h, "--out", jobDir, "--render",
  ...(video?["--video"]:[])])` — progress parsed from the child's stdout
  (`[render i/N]` / `[video i/N]` lines the CLI already prints).
- **Validation**: the path JSON is checked the same way `⤒ path` checks it
  (waypoints array, finite x/y) before anything spawns; hours capped (≤2 with
  video, ≤4 audio-only); one job per IP in flight.
- **Auto-expiry**: artifacts deleted 48 h after completion AND whenever
  `/srv/renders` exceeds a 5 GB budget (oldest first) — a 10-line sweep on a
  timer, also run at boot. 25 GB disk minus the 608 MB payload makes 5 GB a
  comfortable ceiling (~8 finished video hours).
- **The app side** (later, small): the ⤓ path button grows a sibling
  "render on the server" that POSTs the same JSON and polls status into the
  chyron status line; the download links are ordinary `<a href>`s.
- **MIDI for the whole journey**: per-track SMFs, zipped — NOT one
  concatenated file. `buildMidi` is per-state; a journey is N states with
  different tempi/keys/instrument banks, and stitching them into one type-1
  file means re-ticking every event against a merged tempo map for zero
  musical benefit (DAWs import a zip of `01 Artist — Title.mid` … files more
  usefully than one 60-minute blob). The journey CLI grows a `--midi` flag:
  for each track state, `MidiExport.buildMidi(state)` → `NN <identity>.mid`,
  plus `playlist.json` already written today. (If a single file is ever truly
  wanted, it's a follow-up that inserts FF 51 tempo changes at each seam —
  possible, just not the default.)

### Licensing: distributed renders inherit the sample tiers

The live site *performs*; a downloadable render *distributes*. SOURCES.md's
three bright-line tiers apply to every artifact this service hands out:

1. **PD / CC0 / MIT** (NASA, LibriVox, FluidR3 GM instrument zones, espeak
   output, lavfi-synthesized beds) — no restriction.
2. **Attribution / NC / SA CC material** (most aporee field-recording beds
   are **CC BY-NC-SA**; `chickadee` is CC BY) — a render containing them is
   attribution-required and non-commercial, and SA can reach the whole mix.
   The service must say so, not silently imply "yours to use."
3. **Unlicensed commercial material** (the `stml/` "Skip to My Loops" chops,
   the LaserDisc/Video Drug video reels) — **never in a distributed render,
   in any form** (SOURCES.md's own words: "never redistributed in any form,
   never in a distributed render").

Mechanics:

- **`credits.txt` stamped per job**: walk every track state's
  `foundSources[]` (+ sampler zone `srcId`s from `SE.buildSchedule`), map ids
  to the SOURCES.md ledger, and emit one line per source — label, origin URL,
  license — plus the FluidR3/MIT and engine credits, and a plain-language
  tier-2 summary ("this mix contains CC BY-NC-SA field recordings; the file
  is for personal, non-commercial use, credit as listed"). Ship it inside the
  job dir next to the artifacts and link it from the mix page.
- **Machine-readable tiers are the prerequisite**: the ledger is prose today.
  Add a `license`/`tier` field to the kernel's `SOURCES`/`SAMPLES` tables (or
  a generated `sources-license.json` checked against SOURCES.md) so the
  service can (a) build credits.txt without regexing markdown and (b)
  **refuse or strip tier-3 sources** before rendering: prefer strip —
  re-resolve the track with the tier-3 pool excluded (the kernel already
  degrades gracefully when a source pool is empty), and note the substitution
  in credits.txt. Video: journey mode's clip pools must likewise exclude the
  tier-3 reels (the `found/video/lib/` sources flagged in SOURCES.md).
- The mix page (`tools/make-mix-page.js`) already exists per job dir; add the
  credits link there so the human-facing page carries the attribution, not
  just a buried text file.

### Rejected alternatives

- **Hour-long render in the browser** — memory (≥1.2 GB of PCM before
  encode), tab-lifetime fragility, and no video path. The per-song slice
  (§1) is the right ceiling for in-browser pressing (~3–6 min songs, ~40 MB
  WAVs, a minute of worker time).
- **Streaming segment downloads from the live session** (record what you
  hear) — duplicates the wavOut machinery for a worse artifact (lossy,
  seam-managed, only as long as you listen); the offline press is exact and
  reproducible from seed+path.
- **A bigger droplet / GPU box** — nothing here needs it; the queue is the
  product decision (renders are slow and that's fine, they're honest), and
  HOSTING.md's $6 posture stands.
