# HOSTING — stellate.app

**Philosophy first:** per the genesis parable (README), the source is the
artifact and everything rendered is derived — so the server is **disposable**.
Any box that can run nginx and hold ~600 MB of derived media can be stood up
from a clean droplet + one rsync; nothing lives on the server that the repo
(plus its fetch scripts) cannot regenerate. Losing the droplet must cost us an
afternoon, not the project.

**The decision (made; this doc is the execution plan):** stellate.app on a
small DigitalOcean droplet running nginx, **all media same-origin**. Cloudflare
R2 + Transform Rules is the documented scale-out path if outbound transfer
ever outgrows the droplet allowance (§6). Facts backing every claim:
`scratchpad/facts-media.md` + `scratchpad/facts-hosting.md` (2026-07-09), or
`file:line` in this tree.

---

## 1. Requirements: cross-origin isolation, and what it does to media

The desktop ring engine **requires** `SharedArrayBuffer` — the page throws
without it (`engine/faust/live.js:269-270`), and SAB requires the page to be
cross-origin isolated:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

`require-corp`, not `credentialless`: **Safari has never shipped
`credentialless`** (no WebKit support, open standards-position, no plan —
facts-hosting recap). `require-corp` works in Safari and is what `serve.sh`
already sends (`serve.sh:23-28`); production must mirror it. The mobile wavOut
path builds no SABs, but it runs on the same page, so COEP constrains its
subresources anyway (facts-media §3).

**What require-corp means for media origins** (facts-media §3, bottom line):

- Audio goes through `fetch(mode:"cors")` + `decodeAudioData`
  (`engine/faust/sampler.js:354`, `found-player.js:543`) → a cross-origin
  media host must send a valid `Access-Control-Allow-Origin`.
- The `<video>` elements are **deliberately no-cors** — no `crossorigin`
  attribute (`engine/video-layer.js:195-204`), because archive.org's redirect
  hops are not CORS-clean (`video-layer.js:9-13`). Under require-corp, no-cors
  media is **blocked unless every response, including every redirect hop,
  carries `Cross-Origin-Resource-Policy: cross-origin`**.
- **Same-origin media needs none of this.** A path under stellate.app is
  exempt from the whole CORP/ACAO question.

That bottom line is the whole architecture: any media host that cannot send
CORP is disqualified by the `<video>` tags alone.

## 2. The recommendation and why

**Droplet + nginx, everything same-origin.** Adapted from the facts-hosting
cross-cutting table:

| Option | COOP/COEP on HTML | CORP on media (the `<video>` requirement) | Verdict |
|---|---|---|---|
| **Droplet + nginx** | Yes (`add_header`) | **Moot — same-origin** | **This.** Proven model: the current aboardresearch.com deploy is exactly this (CLAUDE.md Deployment) |
| DO Spaces (+CDN) | n/a (media only) | **No** — only the standard S3 header set; arbitrary headers is an open feature request | **Disqualified.** Bucket CORS covers the `fetch()` paths but not the no-cors `<video>` loads |
| DO App Platform static | **No** — custom response headers unsupported, open feature request | No | **Disqualified** at the HTML layer; the SAB engine can never boot |
| Cloudflare R2 + custom domain | via Transform Rules | Yes (Transform Rules) | Qualified — held as the **growth path** (§6), not the launch: it adds an account/zone/rules surface the launch doesn't need |

Same-origin also keeps the local/remote code paths identical: the app already
prefers local files everywhere (`found-player.js:464-469` local-first beds,
`video-layer.js:944-949` local tier first), so a droplet serving the working
tree is byte-for-byte the dev topology with two headers added.

## 3. The runtime payload diet

`found/` is 1.4 GB on disk but much of it is **source material the runtime
never fetches** (facts-media §1). What ships to the droplet vs stays local:

| Category | Path | Now | Ships as | Why |
|---|---|---|---|---|
| Beds | `found/*.wav` (53) | 270 MB | **MP3, ~40-50 MB** | Safe to compress: bed paths carry **no sample-aligned metadata** — no loop points, no slice grids — so MP3's ~26 ms encoder-delay prefix just becomes part of the ambience. (Not because the lead-in re-derivation absorbs it: `analyzeActive` works in 0.5 s RMS windows and does not recompute the prefix away.) Mono V2 lands ~100-130 kbps, ~5.5-6.5:1 |
| Speech | `found/samples/speech/` (244) | 47 MB | **MP3, ~8 MB** | Same reason: the vocoder carrier routes through `FP.decodeUrlToBuffer` (`engine/faust/live.js:378-379`) and carries **no loop/slice metadata that depends on sample alignment** — the encoder-delay prefix is inert here too |
| Instrument zones | `found/samples/instruments/` | 87 MB | **WAV** | Loop points are **absolute sample indices** into the decoded buffer (`sampler.js:308,327,494-496`); MP3/AAC encoder delay + browser-varying gapless trim shifts alignment → looped sustains click/detune (facts-media §4). Regenerable from the SF2 anyway |
| Drum kits + perc | `found/samples/drums/`, `perc/` | 13.5 MB | **WAV** | Same extraction, same sample-index metadata |
| Breaks / stml chops / hits / vox / 78s | `found/samples/…` | ~37 MB | **WAV** | Slice boundaries computed as time fractions of bpm/duration; MP3's ~26 ms lead ≈ half a 16th at 165-175 bpm → audibly sloppy chops (facts-media §4) |
| Video clips | `found/video/*.mp4` (231) | ~275 MB | **as-is** | Already MP4, pre-cut loops |
| Faust WASM | `engine/faust/dist/` | 4.1 MB | as-is | |
| Manifests + app + vendor | | ~few MB | as-is | |
| Bed originals | `found/*.ogg` (38) | 211 MB | **stays local** | Raw archive.org downloads; never fetched at runtime — the `.wav` is the runtime twin (`tools/fetch-found-sound.sh:46-48`) |
| Video source reels | `found/video/lib/` | 443 MB | **stays local** | Crate source only; video-layer reads `clips.json`, never `lib/` |
| Essentia models | `models/` | 20 MB | **stays local** | Offline python verifier only (`audio-verifier.py:21-22`) |

**Net server media ≈ 500 MB** (≈ 460 MB by the table, headroom to 500 —
the plan's estimate; the deployed payload measured **608 MB** after the
2026-07-09 diet, §7).

**Why MP3 and not OGG:** facts-media §4 leans Vorbis/Opus (sample-accurate),
but **Safari cannot `decodeAudioData` OGG** — Safari 18.4's Ogg support is
`<audio>`-element playback only; Web Audio decode of Ogg buffers still fails,
and older Safari has zero Ogg support (facts-hosting §6). MP3 is the only
universally decodable compressed choice for the `fetch`+`decodeAudioData`
paths. MP3's alignment slop is exactly why zones/breaks stay WAV.

**Code-change surface for MP3 beds/speech** — decode needs **nothing**
(`decodeAudioData` is format-agnostic, and node's press decodes via ffmpeg —
facts-media §4), but the `.wav` names are data, so the data changes:

1. `found/found-manifest.json` — every `byUrl` value `found/<id>.wav` →
   `found/<id>.mp3` (keys are archive URLs, untouched).
2. `tools/fetch-found-sound.sh` — the ffmpeg output steps (`:46-48` and the
   `getbed` helper) write `found/<name>.mp3` instead of `.wav`
   (`-codec:a libmp3lame -q:a 2`, keep `-ac 1 -ar 44100`).
3. `engine/genre-kernel.js` — the speech/vox sample entries carry literal
   `file:"speech/<name>.wav"` strings (`genre-kernel.js:115-123`, assembled
   into `samplePath` at `:5516`) → `.mp3`.
4. `tools/fetch-found-samples.sh` — the espeak speech recipes write
   `found/samples/speech/<name>.wav` (`:127-208`, `:490-531`) → `.mp3`.
5. **Re-bake determinism fixtures once.** Node press renders from these same
   files; lossy re-encode changes rendered bytes, so segment-parity /
   verify.sh fixtures need one re-bake after conversion (facts-media §4).
6. `engine/genre-kernel.js:5530` — the tw_vocal bed carries a literal
   `samplePath:"found/tw_vocal.wav"` with `url:""` — there is no fallback, so
   after conversion it would 404 silently → `.mp3`.
7. `engine/faust/press.js:117,128` — node press falls back to
   `path.join(SITE,"found", s.id+".wav")` when a source has no
   `fsPath`/`samplePath` — hardcoded `.wav`; make it try `.mp3` then `.wav`
   at conversion time.

This list is a snapshot, not the law. The true surface is
`grep -rn 'found/.*\.wav' engine/ tools/ test/` — run it before converting and
again after, and chase every hit to zero.

Convert in the repo, not on the server — local tree and droplet stay twins.

## 4. Why not blob-packing / slicing

The considered alternative — pack the per-genre sample set into one blob and
slice client-side — is rejected. The request profile (facts-media §2): boot is
3-4 JSON manifests; the first genre is **40-80 GETs**, each genre switch ~30-60
more, files mostly 50 KB–2 MB. Over HTTP/2 that is one connection and cheap
multiplexed streams; the decode side is already paced by the shared **4-wide,
3-retry decode gate** (`engine/faust/live.js:143-144`), so request count is not
the bottleneck — decode concurrency is, and it's governed. Every cache is
URL-keyed (`sampler.js:349` promise cache, found-player's `_bufCache`), so
repeats are free in-session, and `immutable` media (§5) makes revisits free
across sessions.

Packing would buy little and cost real structure: cache invalidation couples
(one changed zone re-fetches the pack), the sampler grows an unpack/offset
layer on top of a decode path that deliberately decodes each zone verbatim
(`decodeUrlRaw` exists precisely to protect zone integrity —
`sampler.js:345-349`), and the URL-keyed caches lose their keying.

**If request overhead ever shows up in the field:** the first optimization is
**per-instrument zone packs** — one GET per instrument directory (~20 files
instead of ~600), unpacked at the zone boundary where `zones.json` metadata
already lives. Noted; not built.

## 5. The droplet recipe

**Size: $6/mo Basic** (1 GiB RAM / 25 GiB disk / 1 TiB transfer). The $4 tier's
10 GiB disk technically fits today's ~500 MB media + OS, but leaves no room for
media growth, logs, journal, and staged deploys — $2/mo buys 2.5× disk and 2×
transfer (facts-hosting §3). Transfer overage is $0.01/GiB; a heavy fresh
session is roughly 100-300 MB, so 1 TiB ≈ 3,500-10,000 heavy first visits a
month before §6 matters.

**nginx** (sketch — the two isolation headers are the load-bearing part;
remember `add_header` does **not** inherit into a `location` that sets its
own, so repeat them or use an `include`):

```nginx
server {
  listen 443 ssl http2;    # Ubuntu 24.04 ships nginx 1.24 — the `http2 on;`
                           # directive needs 1.25.1+; on 1.24 the listen flag
                           # is correct (learned in the 2026-07-09 deploy)
  server_name stellate.app;
  root /srv/stellate;

  # compress the text payloads — genre-kernel.js alone is 667 KB
  gzip on;
  gzip_types application/javascript application/json application/wasm;
  # (brotli is better still if the module is installed; same types)

  # cross-origin isolation — SAB ring engine (engine/faust/live.js:269)
  # NOTE: worker scripts (engine/faust/stream-worker.js, stem-worker.js) must
  # receive the COEP header on their OWN responses — the server-wide add_header
  # covers them here, but keep it in mind if locations are ever split.
  add_header Cross-Origin-Opener-Policy  "same-origin" always;
  add_header Cross-Origin-Embedder-Policy "require-corp" always;
  add_header Cache-Control "no-cache";          # HTML/JS/JSON — same as today

  location /found/ {
    add_header Cross-Origin-Opener-Policy  "same-origin" always;
    add_header Cross-Origin-Embedder-Policy "require-corp" always;
    add_header Cache-Control "public, max-age=31536000, immutable";
    location ~* \.json$ {                       # manifests map names — never immutable
      add_header Cross-Origin-Opener-Policy  "same-origin" always;
      add_header Cross-Origin-Embedder-Policy "require-corp" always;
      add_header Cache-Control "no-cache";
    }
  }
}
```

Notes:
- **Port 80 stays open:** certbot's HTTP-01 renewal needs plain HTTP reachable
  — keep the port-80 server block (redirect-to-https is fine; the ACME
  challenge path must answer).
- **MP4 ranges:** nginx serves byte ranges on static files natively — this
  closes the known gap where `serve.sh`'s python server can't do Range and
  only works because clips are small (facts-media §2).
- **`immutable` is safe because media is versioned by name:** a bed/zone/clip
  never changes content under the same filename — if content must change, the
  id changes. Enforce this with a **MEDIA_MANIFEST**: generate at deploy time
  (`find found engine/faust/dist -type f | xargs sha256sum > MEDIA_MANIFEST`),
  rsync it last. It makes drift auditable (`rsync -c` spot-checks) and is a
  ready object inventory for the §6 migration. A changed hash under an
  unchanged name is a deploy bug.
- Client behavior already matches: beds fetch `cache:"force-cache"`
  (`found-player.js:521`), manifests fetch `cache:"no-cache"`
  (`found-player.js:488`, `video-layer.js:1092-1093`).
- **The mutable class** (learned when the invariant fired for real,
  2026-07-09): manifests (`*.json`) AND `found/tw_vocal.mp3` — sing.py
  re-sings the transitwave vocal on every offline render under a fixed
  name — are mutable by design: excluded from MEDIA_MANIFEST and served
  `no-cache` (dedicated nginx `location =` block). Everything else under
  `found/` is versioned-by-name and immutable.

**TLS: Let's Encrypt, mandatory before anything else.** `.app` is
**HSTS-preloaded at the TLD level** in every browser — plain HTTP will not
connect, ever, and there is no removal from the preload list (facts-hosting
§5). Get the cert (`certbot --nginx -d stellate.app`) before the first smoke
test; there is no HTTP debugging fallback.

**Deploy = rsync of the working tree minus a deny-list** (the tree is the web
root, same as today — CLAUDE.md Deployment):

```bash
rsync -av --delete --delay-updates \
  --exclude '.git' \
  --exclude 'found/*.ogg' \
  --exclude 'found/video/lib/' \
  --exclude 'models/' \
  --exclude 'scratch/' \
  --include 'engine/faust/node_modules/@grame/' \
  --include 'engine/faust/node_modules/@grame/faustwasm/***' \
  --exclude 'engine/faust/node_modules/*' \
  ./  stellate:/srv/stellate/
sha256-manifest-step   # regenerate MEDIA_MANIFEST; diff against the deployed
                       # one and ABORT if any hash changed under an unchanged
                       # name (one diff line) — this ENFORCES the §5 immutable
                       # invariant, not just audits it; push the manifest last
```

`--delay-updates` stages every transferred file and swaps them in at the end,
so a mid-deploy visitor never sees a half-updated tree (a release-dir +
symlink flip is the fully atomic upgrade if this ever matters).

The node_modules carve-out: only faustwasm's ESM entry is imported at runtime
(`engine/faust/stem-worker.js:419`); the other 28 MB of node_modules is dev
tooling. If the include/exclude dance ever bites, shipping all of
node_modules is 28 MB of harmless slack — prefer boring over clever.

## 6. The growth path: Cloudflare R2 + Transform Rules

If transfer outgrows the droplet's 1 TiB, media moves to R2 behind a custom
domain (e.g. `media.stellate.app`, a zone in the same Cloudflare account); the
droplet keeps serving the app shell with COOP/COEP. R2 qualifies where Spaces
failed because **Transform Rules can set any response header** on a
custom-domain bucket (facts-hosting §4).

**Transform Rules to set on the media hostname:**

- `Cross-Origin-Resource-Policy: cross-origin` — on **every** media response;
  this is what admits the no-cors `<video>` loads under require-corp. R2
  custom domains serve 200-direct, so there are no header-less redirect hops
  (the exact archive.org failure mode, `video-layer.js:9-13`).
- `Access-Control-Allow-Origin: https://stellate.app` — covers the
  `mode:"cors"` fetch+decode audio paths (bucket CORS policy also works;
  Transform Rule is one fewer moving part).
- `Cache-Control: public, max-age=31536000, immutable` — same contract as §5.

**Code changes — the media base URL has three choke points** (facts-media §2):

1. **Sampler/speech/most audio:** `urlOf = s.url || new URL(s.samplePath, SITE)`
   (`engine/faust/live.js:1120`; `SITE` derived from the script's own URL at
   `live.js:36`). Point `SITE` at the media base, or emit absolute
   `samplePath` values — `new URL(abs, base)` ignores the base, so absolute
   URLs work through the existing funnel unchanged.
2. **Beds:** `found-manifest.json` values are site-root-relative and
   string-concatenated to `SITE_ROOT` (`found-player.js:503`) — either make
   the values absolute (needs the small concat change) or give found-player
   its own base constant.
3. **Video:** the remote tier is **already manifest-driven** —
   `stream-catalog.json` carries `base` (`video-layer.js:94`, read at
   `:1095`); the **local tier is hardcoded** `"found/video/" + name + ".mp4"`
   (`video-layer.js:946`) and needs the same base prefix.

**Cost: $0 at this scale.** R2 free tier is 10 GB storage + free egress on
every path, no expiry; ~1 GB of stellate media never leaves the free tier
(facts-hosting §4). The migration is: sync from MEDIA_MANIFEST, set the three
base URLs, set the Transform Rules, smoke §7 again.

## 7. Cost summary + launch checklist

| Item | Cost |
|---|---|
| stellate.app registration | ~$15-20/yr (registrar-dependent — not fact-checked, confirm at purchase) |
| Droplet (Basic, 1 GiB / 25 GiB / 1 TiB) | $6/mo |
| Let's Encrypt TLS | $0 |
| Transfer overage (if ever) | $0.01/GiB past 1 TiB |
| R2 growth path | $0 to ~1 GB (free tier: 10 GB storage, free egress) |

**Deployed 2026-07-09:** droplet `stellate-app` (nyc3, s-1vcpu-1gb,
159.89.38.37), DO DNS zone (A @ + www CNAME), Let's Encrypt cert,
the §5 nginx config live, payload rsynced from the aboardresearch box
(datacenter-local). `tools/deploy-stellate.sh` is the repeatable deploy —
manifest check → rsync deny-list → manifest push → header smoke.
**`tools/ship.sh` is the one deploy command** — clean-tree check (the rsync
ships the working tree, so deployed must mean committed) → gates (verify.sh +
theory/pipes/speech) → `git push` → deploy-stellate.sh. aboardresearch.com
needs no deploy step: the working tree is its web root, saves are live. The MP3
bed/speech diet (§3) executed 2026-07-09: server payload is now **608 MB**
(beds 270→35 MB, speech 47→8 MB); the diet's first deploy also exercised the
MEDIA_MANIFEST invariant for real (renames pass; the two mutable *manifests*
were correctly excluded from the immutable set — .json never belonged in it).
Production-verified: headless chromium rode vaporwave on stellate.app, MP3
beds fetched 200 + decoded, maxRms 0.207, zero errors
(test/mp3-bed-decode-run.js is the committed local twin of that probe).

**Launch checklist:**

1. Register **stellate.app**.
2. Create the $6 droplet; install nginx + certbot.
3. DNS A/AAAA → droplet.
4. **Cert first** (`certbot --nginx -d stellate.app`) — .app is HSTS-preloaded;
   nothing loads until TLS works (§5).
5. Apply the nginx config (§5); confirm both isolation headers on `/` **and**
   on a `found/` media response (`curl -sI`), **and** on a worker script —
   `curl -sI https://stellate.app/engine/faust/stream-worker.js` — so
   worker-script COEP is pinned.
6. Run the MP3 bed/speech conversion + touchpoint renames (§3) in the repo;
   re-bake determinism fixtures; commit.
7. rsync deploy with the deny-list; generate + push MEDIA_MANIFEST.
8. **Smoke — SAB path:** run the live-resilience browser gate against staging.
   Its base URL is localhost-hardcoded (`test/live-resilience-test.js:240`) —
   point it at `https://stellate.app` for the run, or at minimum confirm
   `crossOriginIsolated === true` in devtools and ride a genre on the desktop
   ring engine (which throws loudly if isolation is missing, `live.js:269`).
9. **Smoke — Safari:** play a bed-heavy genre (MP3 `decodeAudioData` path) and
   a sampled genre (WAV zones) in Safari.
10. **Smoke — mobile:** Media Session lock-screen check on a phone (the
    wavOut `<audio>` path), plus video background toggle (no-cors `<video>`
    same-origin under require-corp).
