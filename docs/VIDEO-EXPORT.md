# VIDEO-EXPORT — the shipped live capture + the planned offline path

Two video paths, one shipped and one planned:

1. **Shipped — realtime browser capture** (`app/video-export.js`): the ⏺ button
   records the live visuals + live audio to a `.webm` via the browser's built-in
   `MediaRecorder`. A live *performance* of one session, not a reproducible
   render.
2. **Planned — offline whole-loop render** (NEXT.md item E): frame-step the
   visuals off the clock, composite deterministically, mux with the whole-loop
   WAV via **ffmpeg.wasm**. Not built; the hard prerequisites (COOP/COEP + GPL)
   are below.

For AUDIO downloads (per-song and whole-path), see `docs/EXPORT.md`.

## 1. Shipped: realtime capture (`app/video-export.js`)

`recordVideo({ seconds })` records for `seconds` of the journey as it plays:

- **Video track** — `canvas.captureStream()` of a composite canvas: the found
  `VideoLayer` clip with the demoscene `DemoLayer` screen-blended on top (the
  live look). Both layers are force-enabled for the take and restored after, and
  the recorder waits (polls up to ~3s + a 500ms settle) until the demoscene is
  actually RENDERING before rolling — a blank/loading demo was why an earlier
  take was a static frame.
- **Audio track** — the live master (`faustHandle.audioStream()`, the `msDest`
  tap); falls back to the media element's `captureStream()` on the mobile
  `<audio>` route.
- **Mux** — `MediaRecorder` with the best supported MIME
  (`pickMime()`: vp9/opus → vp8/opus → webm → mp4), no ffmpeg.wasm dependency.

**CORS safety.** The found-video clips are all LOCAL now (`found/video/*.mp4`,
same-origin — 243 committed), so the front clip composites into the capture
canvas without tainting it. A rare remote-fallback clip that would taint is
meant to be skipped (demo-only frame).

### Known limits / honesty (ROADMAP §2.1–2.3)
These are the concrete gaps the roadmap flags for the realtime path — treat them
as the fix backlog, not as solved:

- **Cross-origin taint is silent.** `drawImage` of a tainted `<video>` does not
  throw; the surrounding try/catch never fires, so a remote clip can still yield
  a broken/near-static webm. Fix: restrict the export take to LOCAL candidates,
  and/or probe taint with a 1×1 `getImageData` after the first draw.
- **Background-tab throttling.** Hidden tabs clamp `setInterval` to ≥1s and
  `DemoLayer` stops its RAF on `visibilitychange` → ~1fps frozen video if you
  background mid-take. Fix: OffscreenCanvas-in-worker compositing, or refuse/pause
  when `document.hidden` with a "keep this tab foreground" warning.
- **No iOS/mobile guard.** `captureStream`/`requestFrame` are unsupported/partial
  on iOS, and the mobile audio route is a real `<audio>` element (no live-graph
  `msDest`), so ⏺ can fail or emit a broken/silent blob. Fix: feature-detect and
  hide ⏺ on unsupported devices.
- **Container/extension mismatch.** `pickMime()` can return `video/mp4` (Safari)
  while the download is hard-coded `.webm`. Fix: derive extension + Blob type
  from `rec.mimeType`.
- **Unbounded chunk buffering.** Slices held in `chunks[]` for the whole
  10-min-capped take → OOM risk; hour-scale is out of reach here (that's the
  server-side render, `docs/EXPORT.md §2`).
- **Non-deterministic per seed.** Unlike the byte-identical audio law, browser
  capture has `Math.random` bursts / timing jitter — it is a live performance,
  not a reproducible render. The offline path (below) gets a seeded RNG so video
  can match audio's guarantee.

### Verification
`test/video-export-probe.js`. NOTE (ROADMAP §2.3): the CI probe currently skips
all assertions when `MediaRecorder` is absent (headless), so this path is
effectively unguarded — the hardening ask is to run it in a headful-capable
Chromium and hard-fail if `MediaRecorder` is missing, plus a taint-regression
case and a container/extension-match assertion. Like the iOS-pinch fix, real
confidence is a real-browser check.

## 2. Planned: the offline whole-loop render (ROADMAP §2.4, effort XL)

Frame-step `DemoLayer.renderFrame(dt)` off the clock (de-risked — it is
steppable) + deterministic local clip seeks + composite per frame →
faster-than-realtime capture → **ffmpeg.wasm** mux with the whole-loop WAV
(`journey.buildLoopPlan` → `stream-worker renderLoop`, the same audio the ⤓
whole-path export bakes). **Resolve these before committing to ffmpeg.wasm:**

- **SharedArrayBuffer needs COOP/COEP cross-origin isolation**, which the site
  does not set — and enabling it **breaks the cross-origin archive.org `<video>`
  streams**. Scope any header change so it doesn't break streaming, or go
  local-clip-only under isolation. See `docs/HOSTING.md` (COOP/COEP).
- **x264/mp4 ffmpeg.wasm builds are GPL**; distributing muxed mp4 imposes GPL on
  the combined work. Prefer an **LGPL VP9/webm-only build** in-browser, and do
  x264/mp4 muxing **server-side** in the existing
  `tools/render-sample-video.js` (node + ffmpeg) pipeline instead. See
  `SOURCES.md` (distributed-artifact media tiers).
- **Vendor ffmpeg.wasm (~30MB)** rather than CDN-fetch (availability + perf +
  the zero-network/offline posture).

The server-side pipeline already renders whole journeys to mp4 today
(`node engine/genre-kernel.js journey <path.json> --render --video`); the
in-browser offline path is the additive, deterministic complement, gated on the
isolation/licensing decisions above.

## See also
- `docs/EXPORT.md` — audio downloads (per-song + whole-path) and the droplet
  render service.
- `docs/HOSTING.md` — the COOP/COEP posture.
- `SOURCES.md` — the media-license tiers a distributed render inherits.
- `engine/video-layer.js` / `engine/demo-layer.js` — the composited visual
  sources.
