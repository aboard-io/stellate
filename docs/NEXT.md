# NEXT — the handoff (big feature session)

*Read this whole file, then CLAUDE.md. Everything below is DEPLOYED to
stellate.app unless marked. Paul's active program is in THE PROGRAM section —
work it in order.*

## SHIPPED THIS SESSION (all live on stellate.app + aboardresearch)
- WAVE 3 integrated: beds/hits/forms/clips (4 branches merged, byte-verified);
  bed+hits media fetched (176/176 SOURCE_POOLS members resolve); 9 clips copied;
  world.js PROG_MODE labels for the 6 new progressions.
- Background SUPERIMPOSITION (mode 1 desktop = video + demoscene at once; the
  demo screen-blends through the footage). `?bgMix=1/0` forces on/off (device
  default = UA/cores). GLYPHS bigger + livelier (pool 10, weight 14, size 4.5-34
  vmin, short scheduler return so they layer). Demoscene ~3x slower (speed 0.3).
- STARMAP REGIONS: 10 deterministic k-means territories, energy-ordered goofy
  names + distinct colors, big labels behind the stars, inactive halos tinted by
  region. computeRegions() in starmap.js, wired after computeGenreLayout.
- MASTER VOLUME control (0-150%, userGain after the analyser) + the ⚙ panel
  repositioned to pop up right-aligned ABOVE the settings button.
- NARRATION FADE: live found VOX/CHOP lanes fade when the mix leaves a genre
  (termswave no longer blares after it's gone). found-player fadeAll + live.js
  genre-change hook. LIVE-ONLY.
- MASTER BUS (the "muted" fix): glue comp -> +8dB makeup -> brickwall limiter on
  the live sum (live.js, after masterGain). RMS 0.48->0.65. LIVE-ONLY (baked
  press mix untouched -> byte-identity safe). Reverb/delay DEPTH on sampled
  voices NOT yet done (see backlog).
- STAB relabel: the constantly-firing "stabs" viz lane is the SYNTH stab voice,
  now labeled "synth stabs" (the sampled one-shot stabs are the found lane).
- PLAYHEAD URL: dragPlayhead now calls urlTick (the ?m= followed the scrub).
  goLive drop-in verified correct — residual "reverts" is grab-vs-waypoint
  hit-test overlap; needs Paul's repro.
- SOUNDFONT SWITCHER (12 fonts): ⚙ "soundfont" dropdown re-voices every sampled
  instrument live, hot-restarts the engine, persists. FluidR3 (default, baked,
  BYTE-IDENTICAL) + SGM/Windows/Yamaha XG/Montego/SC-55/Gravis/GBA/E-mu APS/Diet
  Candy/Blackberry/8-bit. tools/gen-font.js extracts any GM SF2 (full-capture,
  program-matched to FluidR3) -> found/samples/instruments-<key>/ (WAVs
  gitignored) + engine/faust/font-<key>.json (committed, 588KB). VELOCITY-LAYER
  selection wired (zoneFor by velocity; multi-velocity fonts play soft samples).

## THE PROGRAM (Paul: "Do #2, then Faithful, then everything else, then Vapor")
### 1. #2 soundfont — DONE (the switcher above).

### 2. FAITHFUL whole-path renderer — DO THIS NEXT
Export audio/MIDI/video of the ENTIRE LOOP (Paul: "export the entire path, not
just the current song. The whole mix"). User chose: **one full loop**, video
**in-browser from local clips only**. Spadework already done:
- `FaustLive.makeWalk` is EXPORTED (engine/faust/live.js) — drive the SAME
  per-bar walk offline with a getState that walks the loop.
- Add `stateAt(pt)` to app/targeting.js (I reverted it; re-add): the pure state
  builder = `K.mix(weightsAt(pt),{seed:S.seed,keyOffset:keyFor(weights,S.seed)})`
  + `if(S.bpmDelta) target.bpm+=...` + `if(MODE_LOCKS[S.modeLock]) target.progression=...`.
  (`keyFor` is module-local in targeting.js.) NO side effects.
- Offline walk: `total = n*pace` bars (one loop). For bar b: `pt =
  pointOnPath(travelForBar(b))` (share.js exports both) -> `state = stateAt(pt)`
  -> getState returns it -> `stepWalk()` returns per-bar `r = {one, units, events,
  spb, lo, hi, found, foundSources, meta, barLenFrames, musicalSec}`.
- AUDIO: feed the per-bar r payloads to a render worker. The ring path's
  openLive/feedBar/renderChunk (stream-renderer.js) already render per-bar into a
  ring — adapt an OFFLINE mode that dumps PCM + concatenates, then reuse
  encodeMp3 (app/export.js). This worker mode is the biggest single piece.
- MIDI: need note-level events per bar (buildEvents pitched/drums), which
  stepWalk builds internally on a collapsed one-section state — either make
  makeWalk also return `ev`, or re-run buildEvents on that section. Assemble one
  SMF (engine/midi-export.js buildMidi) with a tempo map (per-bar bpm) + beat
  offsets.
- VIDEO: in-browser, LOCAL clips only. archive.org footage is CORS-TAINTED
  (uncapturable — video-layer.js:9-11 plays it without crossorigin). Capture the
  demoscene canvas + viz + local found/video/*.mp4 (same-origin) + the whole-loop
  audio -> MediaRecorder webm; ffmpeg.wasm for MP4.
- app/export.js is the current single-song exporter (downloadMidi/exportAudio);
  extend it or add app/journey.js.

### 3. EVERYTHING ELSE (backlog)
- Master-chain REVERB/DELAY DEPTH on sampled voices (lever b): the found/sampler
  submix routes to a thin single native reverb tap (live.js:383-389) — no real
  delay/ping-pong. Route it through a fuller reverb + a real echo. Ear-check the
  master-bus makeup (2.6) first — it may already be enough now the mix is louder.
- Sampled-stab single-pick balance: genre-kernel:6504 picks ONE hits source,
  ~50% speech vs stab pools. Biasing toward stabs = deterministic render drift +
  taste. Surfaced, not done.
- ARACHNO font: /tmp/newfont2/ has "Arachno …sfArk" (needs sfArkXTc decompression,
  bundled in the zip). Likely has velocity layers. gen-font.js it in if decompressed.
- Old NEXT §3-5 standing items still open: WAV-first mobile split residual,
  stem-parity re-pin (citypop_s7), browser/node rng divergence, dead-range asks,
  VOICES.md completeness, --full 5-seed dominance (7 genres), demoscene surface,
  the VECTOR-KERNEL program (step 2 randomness tape onward), the hour-render
  service, repo public flip (`gh repo edit ftrain/stellate --visibility public`).

### 4. VAPOR SLIDER — DO LAST
New ⚙ "Vapor" slider. Lowest = mix passes straight through. Highest = reverb up
+ HIGHS CUT = "walking through a mall." Implementation: LIVE-ONLY master EQ in
exploreLive's graph (live.js) near the master bus / userGain — a lowpass or high-
shelf cutting highs + a global reverb increase, both scaled by the Vapor amount
(0..1). The found submix already has a native reverb (live.js:385-389) to scale.
Persist like masterVol (state.js `_vapor`, live.js `setVapor`, panels.js slider).
Live-only -> no byte-identity impact. (Wire setMasterVol-style: handle.setVapor.)

## LAWS LEARNED THIS SESSION
- LIVE-ONLY audio changes (master bus, userGain volume, narration fade, the
  coming Vapor EQ) ride the MAIN-THREAD graph AFTER masterGain — they never touch
  the worker-baked press mix, so segment-parity/fixtures stay byte-identical.
  This is THE pattern for live-audio taste changes.
- Soundfont switcher: default "fluidr3" MUST stay byte-identical. `SAMPLERS[id].dir
  != id` for some (tenor_sax -> tenor_sax_fp, immutability law) — samplePath uses
  S.dir, NOT the slug. Font WAVs gitignored; font-*.json committed source.
- Video export: archive.org footage is CORS-tainted (uncapturable in-browser);
  local same-origin clips ARE capturable.
- fixtures.js baseline can lag HEAD -> recapture after intentional drift; verify
  drift is explained (compare pipelines) before assuming a bug. The 71%-drift
  scare this session was a stale baseline, NOT the pool-law landmine.

## GATES before any ship
`tools/ship.sh` = verify.sh (matrix/validate/engine/prove/matproof) +
theory/pipes/speech -> git push -> tools/deploy-stellate.sh (rsync to droplet).
For app/engine changes ALSO the browser battery (explorer-ui, access-ui,
share-url, genre-viz, blend-arrival, transit-arrival, simulate-path-run,
sampler-inserts-live, bg-survival, live-test, wavout;
NODE_PATH=/home/ford/ftrain-2025/node_modules). fixtures.js capture after
intentional drift (name causes). segment-parity BYTE-EQUAL. musicality green,
card-lies=0. Machines verify structure; ears verify taste (Paul's).
