# vendor/espeak-ng — trimmed eSpeak NG WASM (English-only)

[eSpeak NG](https://github.com/espeak-ng/espeak-ng) speech synthesizer
compiled to WebAssembly, trimmed to English-only data. Synthesizes text to
raw Int16 PCM at **22050 Hz**, in both node and the browser, fully
same-origin (no CDN, per docs/HOSTING.md).

**License: GPL-3.0** (see `COPYING` here and the combined-work note in the
repo-root `NOTICE`). This is the one GPL component in the served bundle —
the decision to accept that is recorded in NOTICE.

## Provenance

- Upstream npm package: `@echogarden/espeak-ng-emscripten@0.3.5`
  - tarball: <https://registry.npmjs.org/@echogarden/espeak-ng-emscripten/-/espeak-ng-emscripten-0.3.5.tgz>
  - integrity: `sha512-Izbkm7NWccwb//RKgOp1/0k21StKN1DFIn+K7GU1XN7n6pmSi4bsk/0tYUsgQbysC4GVyrVompNmLInU/BFE+A==`
  - built by the Echogarden project from their espeak-ng fork
    (<https://github.com/echogarden-project/espeak-ng>, branch `fork`) with
    emscripten `SINGLE_FILE` (the wasm is base64-embedded in the glue JS).
- `COPYING` is the GPL-3.0 text shipped verbatim in that package (same text
  as upstream espeak-ng's COPYING).
- Upstream ships `espeak-ng.data` with **all** languages (24,014,553 bytes).
  We ship an English-only repack (879,346 bytes; 452 KB gzipped). The glue
  is upstream's with only the embedded file manifest patched (`trim.mjs`).

## Rebuild / re-trim recipe

```sh
cd "$(mktemp -d)"
npm pack @echogarden/espeak-ng-emscripten@0.3.5
tar xf echogarden-espeak-ng-emscripten-0.3.5.tgz
node /path/to/stellate/vendor/espeak-ng/trim.mjs ./package /path/to/stellate/vendor/espeak-ng
cp package/COPYING /path/to/stellate/vendor/espeak-ng/
node /path/to/stellate/vendor/espeak-ng/prove.js   # must print ALL GREEN
```

`trim.mjs` parses the emscripten file_packager manifest embedded in
`espeak-ng.js` (`loadPackage({files:[{filename,start,end}...]})`; the .data
file is a plain concatenation), keeps only the English set — `phontab`,
`phonindex`, `phondata`, `intonations`, `en_dict`, `lang/gmw/en*`, and the
tiny `voices/!v/*` variants — rewrites offsets, and patches the manifest +
`remote_package_size` in the glue. No emsdk required. The trimmed build
produces byte-identical PCM to the full one (verified by sha256).

## Files

| file | size | gzipped |
|---|---|---|
| `espeak-ng.js` (glue, wasm embedded) | 814,415 | 242 KB |
| `espeak-ng.data` (en-only preload) | 879,346 | 452 KB |

## API surface (what the organ calls)

The glue is an ES module whose default export is an emscripten module
factory. `locateFile` is baked in: it resolves `espeak-ng.data` **next to
the glue file** via `import.meta.url`, in both node and the browser — so
keep the two files siblings and no hook is needed.

```js
import initEspeak from './vendor/espeak-ng/espeak-ng.js';

const m = await initEspeak();            // fetches+mounts espeak-ng.data
const worker = new m.eSpeakNGWorker();
worker.set_voice('en-us', 'en', 0, 0);   // rc 0 = OK (name, lang, gender, age)
worker.get_samplerate();                 // 22050
worker.set_rate(140); worker.set_pitch(50); worker.set_range(50); // optional

worker.synthesize(text, (samples, events) => {
  // samples: Int16Array chunk COPY of PCM (already sliced from the heap)
  // events:  [{type:'word'|'sentence'|'end'|..., text_position, word_length,
  //            audio_position (ms), id}]
  chunks.push(samples);   // safe to keep; it's a heap slice, not a view
  return false;           // falsy = continue, truthy = abort synthesis
});
```

Also available: `synthesize_ipa(text)`, `convert_to_phonemes(text, useIpa)`,
`text_to_phonemes`, `get_voices`.

## Determinism (read this before caching by text hash)

`espeak_ng_SetRandSeed` is **not exported** by this build, and espeak's
wavegen consumes libc `rand()` for voicing noise, so **repeat synthesis on
the same instance is NOT byte-identical** (even sample counts drift).

What IS guaranteed (proved by `prove.js`): a **fresh module instance
replaying the same call sequence produces byte-identical PCM**, across runs
and across runtimes (node and Chromium produce the same sha256). So the
organ re-inits per utterance:

- module init + worker + set_voice: **~70–250 ms** (node; ~210 ms Chromium)
- synthesis speed: ~8 s of speech in **~440 ms** (node)

## Proof harnesses

```sh
node vendor/espeak-ng/prove.js                      # node: synthesis, hashes,
                                                    # determinism model, timings
NODE_PATH=/home/ford/ftrain-2025/node_modules \
  node vendor/espeak-ng/prove-browser.js            # headless chromium, served
                                                    # with COOP/COEP require-corp
```

Both must print ALL GREEN. The browser harness serves the repo root
same-origin with the production headers and confirms
`crossOriginIsolated === true` — the artifact needs no CORP/ACAO handling
because it is same-origin (the whole point, per docs/HOSTING.md).
