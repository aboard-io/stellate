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
./render.sh              # csound + ffmpeg -> vaporwave.wav + vaporwave.mp3
./serve.sh               # http://localhost:8777/{play,builder}.html (needs http, not file://)
node engine.test.js      # render-verifies every progression/key/melody via real csound
```

Requires `csound` (tested 6.18), `ffmpeg`, `curl`, `node`.

## Layout

- `royal-road.csd` — the original committed Csound source (CLI render path)
- `csd-engine.js` — same engine, score data-driven; shared by builder, tests, verifier
- `builder.html` — full song builder UI (WASM csound, live edit-while-playing,
  OfflineAudioContext WAV render, lamejs MP3 export)
- `play.html` — simple player
- `song-verifier.js` — `analyzeSong`/`improveSong`: the verifier half of the loop
- `engine.test.js` — offline render verification against real csound
- `found/` — fetched found-sound layers (gitignored except `.gitignore`)
