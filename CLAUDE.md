# CLAUDE.md — Royal Road vaporwave

A self-contained vaporwave generator: a Csound sketch (`royal-road.csd`), a
browser song builder (`builder.html` + `csd-engine.js` via `@csound/browser`
WASM), and a heuristic song verifier (`song-verifier.js`). Extracted from the
verifier-catalog repo in 2026-06 with full history; it is a worked example of
that catalog's generator → verifier → feedback-loop thesis.

## The one rule

**Source is committed; audio is derived and gitignored.** `royal-road.csd` /
`csd-engine.js` are the capability; every `.wav`/`.mp3` is regenerable and must
never be committed. (The project exists because we once kept the renders and
lost the `.csd` — see README "What happened".)

## The catalog submodule

`verifier-catalog/` is a git submodule (`git submodule update --init` after
clone). Two roles:

- **Reference data**: `verifier-catalog/gen_data/k_music.py` holds the
  `generate_symbolic_music` generator whose vaporwave/city-pop `domain_notes`
  this project implements. `song-verifier.js` cites catalog verifiers 12.33
  (genre-conformance) and 17.43 (no-formal-verifier).
- **MCP reference tool**: `.mcp.json` launches the catalog's stdio MCP server
  from the submodule (`search_methods`, `get_method`, `neighbors`,
  `plan_architecture`). Needs `uv` on PATH; self-provisions on first use.

Don't edit anything inside `verifier-catalog/` from this repo — make catalog
changes in the catalog's own checkout and bump the submodule pointer.

## Run / test

```bash
./fetch-found-sound.sh   # one-time: Internet Archive field recordings -> found/
./fetch-found-video.sh   # one-time: Internet Archive laserdisc clips -> found/video/
./render.sh              # csound + ffmpeg -> vaporwave.wav + vaporwave.mp3
./serve.sh               # http://localhost:8777/{play,builder}.html (needs http, not file://)
node engine.test.js      # render-verifies every progression/key/melody via real csound
node render-sample-video.js  # sample.mp4: song + video layer, cuts locked to section downbeats
node genre-kernel.js journey genre-space-path.json --hours 4 --out journey/ --render --video
                         # explorer-drawn path (⤓ path) -> mp3s + genre-affine videos
                         # + gapless journey.mp3/.mp4 + mix page (see GENRE-SPACE.md)
```

Requires `csound` (tested 6.18), `ffmpeg`, `curl`, `node`.

## Layout

- `royal-road.csd` — the original committed Csound source (CLI render path)
- `csd-engine.js` — same engine, score data-driven; shared by builder, tests, verifier
- `builder.html` — full song builder UI (WASM csound, live edit-while-playing,
  OfflineAudioContext WAV render, lamejs MP3 export)
- `play.html` — simple player
- `genre-kernel.js` — genre as a point in multidimensional space; blend/track/
  playlist generators emitting engine states (design: GENRE-SPACE.md)
- `genre-verifier.js` — symbolic genre-conformance scoring + confusion matrix
  (`node genre-verifier.js matrix` must stay diagonal-dominant)
- `audio-verifier.py` — EMPIRICAL gate: Essentia Discogs-EffNet genre model on
  rendered audio. Setup: `python3 -m venv .venv-verify && .venv-verify/bin/pip
  install essentia-tensorflow`, then download to `models/`:
  `discogs-effnet-bs64-1.pb` (essentia.upf.edu/models/feature-extractors/discogs-effnet/)
  and `genre_discogs400-discogs-effnet-1.{pb,json}` (…/classification-heads/genre_discogs400/).
  Use via `node genre-kernel.js track jungle --render --audio-verify`.
- `fetch-found-samples.sh` — breaks/one-shots/vox from archive.org + espeak-ng
  speech synthesis as an instrument; manifest in found/samples/
- `make-mix-page.js` — mix/index.html + mix.m3u from a rendered playlist dir
- `song-verifier.js` — `analyzeSong`/`improveSong`: the verifier half of the loop
- `engine.test.js` — offline render verification against real csound
- `video-layer.js` — laserdisc background video: dual-<video> crossfade, switches
  on section changes during playback, ambient cycling when idle
- `found/` — fetched found-sound + found-video layers (gitignored except `.gitignore`;
  recipes: `fetch-found-sound.sh`, `fetch-found-video.sh`, credits in SOURCES.md)

## Deployment

The working tree **is** the web root: nginx serves it at
`https://aboardresearch.com/projects/vaporwave/` (alias block in
`/etc/nginx/sites-enabled/aboardresearch`, `Cache-Control: no-cache`). File
moves/renames here are production changes; gitignored-but-present files
(`found/`, `found/video/`) are required for the live site.
