# faustwasm patches

`faustwasm-soundfile-wav-samplerate.patch` — SoundfileReader learns to decode
WAV files directly (RIFF sniff → WavDecoder) instead of always going through
`decodeAudioData`, preserving the file's own sample rate for soundfile
primitives. Kept tracked here for LGPL modification-visibility and provenance
(`@grame/faustwasm` is LGPL-2.1+; see NOTICE).

**Status: already applied upstream — no action needed.** The fix ships inside
the published `@grame/faustwasm@0.16.5` npm tarball (both `src/` and the built
`dist/`; the tarball even includes this .patch file), so a plain `npm ci` in
`engine/faust/` installs the fixed package. Verified 2026-07-09 by diffing a
fresh registry install against the working copy: byte-identical.

**If a future faustwasm upgrade regresses it** (grep the installed
`dist/esm/index.js` for `isWaveFile` — 2+ hits means it's in): re-apply with

```bash
cd engine/faust/node_modules/@grame/faustwasm
patch -p1 < ../../../patches/faustwasm-soundfile-wav-samplerate.patch
```

then rebuild the package's `dist/` per its own build instructions (the patch
targets `src/SoundfileReader.ts`; the runtime imports `dist/esm/`), or port
the equivalent change into `dist/` directly. And re-check NOTICE: a locally
modified LGPL package means the modification must remain published — this
directory is where it lives.
