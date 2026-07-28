# SETUP — standing up stellate from a clean clone

This is the cold-start guide: no context assumed beyond a shell. For what the
project *is*, read the [README](../README.md); for the full layout,
[CLAUDE.md](../CLAUDE.md); for production hosting details, [HOSTING.md](HOSTING.md).

## 0. What you need

- **node** ≥ 18 (tested on 20.x) — engine, tools, gates
- **ffmpeg** + **curl** — the media fetch recipes
- **python3** — the local dev server (`serve.sh`) and the sample-CD classifier
- ~1.5 GB of disk for the fetched media (the repo itself is small — **no audio
  is committed**, ever; see "the one rule" below)

No csound, no bundler, no framework, no build step for the app itself.

## 1. Stand up the site

```bash
git clone https://github.com/aboard-io/stellate && cd stellate
(cd engine/faust && npm ci)          # the WASM engine's node deps (press + tools)
tools/fetch-found-samples.sh         # SoundFont GM + breaks/one-shots/vox  → found/samples/
tools/fetch-found-sound.sh           # field-recording beds                 → found/
tools/fetch-found-bbc.sh             # BBC Sound Effects beds + chimes      → found/  (RemArc licence — see SOURCES.md)
node tools/transcode-samples.js      # REQUIRED last step: instrument zones → mp3
./serve.sh                           # → http://localhost:8777/
```

The fetches are one-time and resumable; they pull from archive.org and the
BBC's public CDN into gitignored directories. The app **runs without them** —
sampled instruments fall back to synths, beds simply don't play — but the
point of the thing is the sampled + found layer, so fetch before judging.

**Don't skip the transcode.** `fetch-found-samples.sh` extracts the instrument
zones from the SoundFont as 44.1 kHz WAVs (~102 MB); the committed `SAMPLERS`
metadata in `engine/genre-kernel.js` names **mp3** files at 22.05 kHz, so
without this step the sampler 404s on every zone and falls back to synths.
`tools/transcode-samples.js` converts each zone (mono, 22.05 kHz, 48 kbps,
gapless-tagged) and re-bakes the metadata that rides with it — `ls`/`le` are
absolute sample indices and halve with the rate, and `len` is the expected
decoded length that lets the player detect and cancel WebKit's constant
1105-sample MP3 lead-in. It is idempotent (already-converted samplers are
skipped), `--dry` encodes to a temp dir and reports the ratio without touching
anything, and a sampler with any failed zone is rolled back whole rather than
left half-converted. Rationale and measurements: [HOSTING.md §3](HOSTING.md).

Optional extras:

```bash
python3 -m venv .venv-verify && .venv-verify/bin/pip install essentia-tensorflow
                                     # only for the empirical audio verifier (tools/audio-verifier.py)
```

**Why `serve.sh` and not `file://` or any old static server:** the page must be
*cross-origin isolated* (COOP `same-origin` + COEP `require-corp` headers) so
SharedArrayBuffer exists and the Faust engine can render in a worker thread
instead of the audio callback. `serve.sh` sends those headers; `file://` and
plain `python3 -m http.server` don't, and the ring engine won't boot.

Smoke-check a working stand:

```bash
node test/engine.test.js                     # offline press renders, non-silent
node engine/genre-verifier.js matrix         # 274/274 diagonal-dominant
node tools/kernel-cli.js track jungle --seed 7 --render   # one mp3, ears-ready
```

## 2. Publish it

The working tree **is** the web root — deploying is copying the tree (plus the
gitignored `found/` media and `engine/faust/node_modules`) to any static host
that can set two response headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

(`require-corp`, not `credentialless` — Safari never shipped credentialless.)
An nginx `location` block that does this — including the long-cache rules for
`found/` — is in [HOSTING.md](HOSTING.md). Hosts that can't set custom headers
(most "static site" PaaS tiers) can serve the page but the SAB engine will
never boot; mobile's WAV-first path still works. Keep all media **same-origin**
(under your own domain, next to the HTML): under COEP require-corp,
cross-origin `<video>`/audio needs `Cross-Origin-Resource-Policy` headers most
media hosts won't send.

`tools/ship.sh` is the reference deploy: gates → push → rsync. It refuses a
dirty tree, because deployed must mean committed.

## 3. Adding audio files

**The one rule: source is committed; audio is derived and gitignored.** You
never commit a `.wav`/`.mp3` — you commit the *recipe* that fetches or
synthesizes it, the *registry entry* that names it, and the *ledger line* that
credits it. (The repo exists because we once kept the renders and lost the
generator.)

### a. A found-sound bed (ambience under a genre)

1. **Recipe** — add a fetch line to `tools/fetch-found-sound.sh` (or a new
   `tools/fetch-*.sh`): download, trim a usable window, normalize to mono
   44.1 kHz MP3 at `found/<id>.mp3`. The `getbed` helper in that script is the
   pattern (ffmpeg `-ss`/`-t` + `loudnorm=I=-18:TP=-1.5`).
2. **Registry** — add the id to `SOURCES` in `engine/genre-kernel.js` with a
   label and url. Local-file url (`found/<id>.mp3`) if the origin can't be
   streamed; the origin URL if it's archive.org (then also add a row to
   `found/found-manifest.json` mapping that URL → the local file).
3. **Wire it** — either add the id to a class in `SOURCE_POOLS` (city / road /
   industry / voices / nature / water / room / weather / smalltown /
   shortwave), which makes it *randomly available* to every genre that draws
   from that pool — or name it raw in one genre's existing `found.sources`
   list if it's an identity bed (the loon belongs to canawave; don't pool it).
4. **Stay matrix-safe** — add to **existing** `found.sources` pools or
   `hits.sources` only. Never add a `found:{role:…}` block to a genre that
   lacks one, never change a role or a scored field (bpm, swing, …) — those
   shift the genre-confusion matrix.
5. **Credit it** — add the item to `SOURCES.md` with its license. PD/CC0 is
   tier 1; anything NC/ND/SA (or the BBC's RemArc terms) is tier 2:
   fetch-only, flagged, never redistributed in a packaged build.
6. **Gate it** — `node engine/genre-verifier.js matrix --no-cache` must still
   print `diagonal dominant: 274/274`; `node test/engine.test.js` must stay
   non-silent. Then listen in the app (`?genre=<something that pools it>`).

House taste rules you will hit: **the bird-rarity law** (bird-forward
recordings join no general pool — birds are for the genres that earned them)
and **the tempo lock** (break loops join only the `break_*` pool matching
their measured BPM, so time-stretch stays under ~15%).

### b. One-shot hits (chimes, stabs, percussion)

Same shape, smaller: the file lands under `found/samples/<dir>/….wav`, the
entry goes in `SAMPLES` in `engine/genre-kernel.js` (`kind:"hit"`, plus
`note:` if tonal), and the id joins a one-shot pool (`chime`, `perc_hit`, …)
or a genre's `hits.sources` (always matrix-safe).

### c. A whole sample CD

There's a dedicated pipeline for archive.org sample CDs (a zip of WAVs, even
generically named): `tools/fetch-sample-cd.sh` downloads/trims, and
`tools/classify-sample-cd.py` recovers pitch/BPM/class per sample and emits a
ready-to-paste `SAMPLES` snippet. Full walkthrough in
[CLAUDE.md § Incorporating a sample CD](../CLAUDE.md).

## 4. Sharing audio publicly — and why not git-lfs

Tempting: put the fetched media in git-lfs so a clone Just Works. Don't.

- **GitHub LFS free tier is 1 GiB storage + 1 GiB/month bandwidth**, and every
  clone of a public repo bills the *repo owner's* bandwidth. The media layer
  here is ~1.3 GB — roughly **one** stranger's clone per month before
  downloads start failing for everyone, or you start paying for data packs.
- LFS files don't ship in GitHub's "Download ZIP"/source archives, so the
  no-git path breaks anyway.
- Half the ledger is material we may cache but **not redistribute** (NC/ND
  Creative Commons items, the BBC RemArc sounds, tier-3 unlicensed material).
  Mirroring it in LFS would republish it under our name.

The fetch-recipe model *is* the answer: archive.org and the BBC already host
the bytes for free, at CDN scale, under each item's own license, and the repo
commits the ~2 KB recipe instead of the 1.3 GB payload. If you need to share
*derived* audio (rendered journeys, mixes), use GitHub **Releases** (free for
public repos, no LFS quota) or an object store with free egress (Cloudflare
R2) — but check `SOURCES.md` first: a render that includes tier-2 material
inherits its obligations.
