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

> **2026-07-25:** the laserdisc found-video layer (`engine/video-layer.js`,
> `found/video/`, the `<video>` no-cors streaming tier) was **removed from the
> app** — preserved on branch `legacy-download-video`. Every video-specific
> passage below (no-cors `<video>` loads, `stream-catalog.json` bases, the
> found/video payload rows, `deploy-stellate.sh` video excludes) is
> point-in-time record of the era the layer shipped, not current behavior;
> `found/video/` no longer deploys at all.

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
| Essentia models | `models/` | 20 MB | **stays local** | Offline python verifier only (`tools/audio-verifier.py`) |

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
  2026-07-09): manifests (`*.json`) AND `found/tw_vocal.mp3` — tools/sing.py
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

### Content types for the open-web layer (applied 2026-07-25)

nginx 1.24's `mime.types` knows neither `.webmanifest` nor `application/rss+xml`,
and `.xml` is already mapped to `text/xml` — so `default_type` alone is ignored
for the feeds. **An empty `types {}` block is required to clear the map first:**

```nginx
location = /manifest.webmanifest { default_type application/manifest+json; add_header Cache-Control "no-cache"; }
location = /feed.xml          { types {} default_type application/rss+xml;   add_header Cache-Control "no-cache"; }
location = /feed-archive.xml  { types {} default_type application/rss+xml;   add_header Cache-Control "no-cache"; }
location = /feed.json         { types {} default_type application/feed+json; add_header Cache-Control "no-cache"; }
location = /feed-archive.json { types {} default_type application/feed+json; add_header Cache-Control "no-cache"; }
location = /sitemap.xml       { types {} default_type application/xml;       add_header Cache-Control "no-cache"; }
```

(The manifest needs no `types {}` — `.webmanifest` has no mapping at all, so
`default_type` applies. Symptom without this: the PWA install prompt is refused
because the manifest arrives as `application/octet-stream`.)

## Analytics (2026-07-25): self-hosted GoatCounter, cookie-free

Only the most basic aggregate stats (pageviews/visits/referrers/countries) —
no cookies, no persistent identifiers, no consent surface needed, nothing
third-party. Open source (GoatCounter, single Go binary + SQLite).

- **Droplet**: `/usr/local/bin/goatcounter` (v2.6.0) as the `goatcounter`
  user, systemd unit `goatcounter.service`, SQLite at
  `/var/lib/goatcounter/`, listening on **127.0.0.1:8081 only**.
- **nginx**: only `location = /gc/count` proxies through (the beacon); every
  other `/gc/` path 404s — the dashboard/UI (incl. `/user/new`) is never
  publicly reachable. Block lives in sites-enabled/stellate.
- **Client**: `app/analytics.js` (settings shim: pathname only — the query
  string carries seeds/paths, i.e. someone's saved musical location, and
  never leaves the page) + vendored `vendor/goatcounter/count.js` (ISC).
  sw.js passes `/gc/` through uncached.
- **Dashboard is not public**: `ssh -L 8081:127.0.0.1:8081 root@stellate.app`
  then http://localhost:8081 (Host: stellate.app). Password reset:
  `goatcounter db update-user -email ford@ftrain.com -password ... -db
  sqlite3+/var/lib/goatcounter/goatcounter.sqlite3` on the droplet.

## Embedding (2026-07-25): `embed.html`, oEmbed, and the nginx bits

The player is embeddable on other sites — `embed.html` + a static oEmbed
document. The full story for authors is in **docs/EMBED.md**; this section is
only what the *server* has to be told.

### 1. Nothing currently blocks framing — keep it that way

The config in §5 sends no `X-Frame-Options` and no `Content-Security-Policy`,
so `embed.html` frames anywhere today. **Do not add `X-Frame-Options` or a
`frame-ancestors` CSP** without carving `embed.html` out first; either one
turns every embed into a blank box with a console error and no other symptom.

`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` stay exactly as
they are. COOP only governs *top-level* browsing contexts, so it is inert in an
iframe; COEP only constrains our own subresources, which are same-origin. The
one real consequence is that a framed page is **not cross-origin isolated**
(isolation needs the whole ancestor chain), so `SharedArrayBuffer` is undefined
inside the embed and the ring engine cannot run there. That is handled in the
app, not the server: `app/live.js`'s NO-ISOLATION FALLBACK routes to the
WAV-FIRST path automatically. Gate: `node test/embed-audio-run.js`.

### 2. oEmbed: we ship a STATIC document, deliberately

`/oembed.json` is a plain file in the tree, and both `index.html` and
`embed.html` advertise it:

```html
<link rel="alternate" type="application/json+oembed"
      href="https://stellate.app/oembed.json" title="STELLATE">
```

**Why static.** The spec says a consumer calls the endpoint with `?url=` (and
optionally `format`/`maxwidth`/`maxheight`), so a "correct" endpoint is dynamic
— but this site is a working tree behind nginx with no application server, and
adding one for a single JSON document would put a process (and a patch cadence,
and a failure mode) on the deploy path to answer a question whose answer is
almost always the same. The consumers that matter here — Mastodon, WordPress,
Discourse, Notion — all *discover* the endpoint from the `<link>`, fetch it,
and use `html`; every one of them tolerates a response that ignores the query
string, because the returned `html` is a complete embed on its own. The cost is
real but small and precisely bounded: **an unfurl of a deep link (a specific
seed/path/measure) embeds the app's front door instead of that exact mix.**
Anyone who wants the exact mix embedded uses the ⚙ panel's *copy embed* button,
which builds the `<iframe>` from the live share URL.

Serve it as `application/json` — nginx's default `mime.types` already does
(`application/json json;`). One optional nicety, since some consumers fetch it
from the browser:

```nginx
  location = /oembed.json {
    add_header Cross-Origin-Opener-Policy  "same-origin" always;   # add_header does NOT inherit
    add_header Cross-Origin-Embedder-Policy "require-corp" always;
    add_header Access-Control-Allow-Origin "*" always;
    add_header Cache-Control "public, max-age=3600";
    default_type application/json;
  }
```

### 3. IF we ever want per-URL oEmbed: the parameterized endpoint

Drop this in the `server` block. It answers `/oembed?url=…` by echoing the
requested URL back inside the iframe `src`, with **no** application server.

```nginx
  # oEmbed, parameterized. SECURITY: $arg_url is NOT url-decoded by nginx and is
  # interpolated straight into a JSON string, so it is whitelisted first — the
  # regex admits only our own origin plus the characters our share URLs use, and
  # notably excludes " and \ (JSON string escapes) and < > (HTML). Anything else
  # 404s rather than being sanitized, because sanitizing in nginx is a trap.
  location = /oembed {
    default_type application/json;
    add_header Cross-Origin-Opener-Policy  "same-origin" always;
    add_header Cross-Origin-Embedder-Policy "require-corp" always;
    add_header Access-Control-Allow-Origin "*" always;
    add_header Cache-Control "public, max-age=3600";

    if ($arg_url !~ "^https://stellate\.app/[A-Za-z0-9/._~%!$&*+,;=:@?=-]*$") { return 404; }
    # oEmbed says a consumer MAY ask for xml; we only speak json.
    if ($arg_format != "") { set $fmt $arg_format; }
    if ($fmt != "json") { return 501; }

    return 200 '{"version":"1.0","type":"rich","provider_name":"STELLATE","provider_url":"https://stellate.app/","title":"STELLATE — draw a path through genre space","author_name":"Paul Ford","author_url":"https://www.ftrain.com/","width":800,"height":480,"thumbnail_url":"https://stellate.app/assets/og-card.png","thumbnail_width":1200,"thumbnail_height":630,"cache_age":86400,"html":"<iframe src=\'$arg_url\' title=\'STELLATE\' width=\'100%\' height=\'480\' loading=\'lazy\' allow=\'autoplay; clipboard-write\' referrerpolicy=\'strict-origin-when-cross-origin\' style=\'border:0;width:100%;height:480px;min-height:320px\'></iframe>"}';
  }
```

Caveats, all of them load-bearing:

- `set $fmt json;` must be initialised before the `if` blocks (nginx `if` inside
  `location` is famously sharp — see "If Is Evil"); simplest safe form is to
  `set $fmt "json";` at the top of the location and only override it from
  `$arg_format`. Test with `nginx -t` **and** real requests before shipping.
- The `html` value uses single quotes for the HTML attributes so the JSON string
  needs no escaping — valid HTML, and it keeps the nginx literal readable.
- It answers for `/embed.html?…` URLs too, since those match the whitelist.
- If this lands, **change the discovery `<link>` in `index.html`,
  `embed.html` and `access.html` to `…/oembed?url=…&format=json`**, and update
  `test/social-meta.test.js`, which asserts the static document exists.

### 4. Deploy checklist additions

- `assets/` (og-card.png, icon-32.png, icon-180.png, favicon.ico), `embed.html`,
  `oembed.json` and `app/embed.js` must all be in the rsync — they are tracked
  files in the working tree, so the existing `ship.sh` rsync carries them.
- `tools/.font-cache/` is gitignored *and* must not deploy (it is only input to
  `tools/gen-og-card.js`); confirm the rsync excludes ignored files.
- After a deploy that changes any of the above, **bump `sw.js` `VERSION`** or
  returning visitors keep the cached shell (the standing lesson in that file).

---

## The open-web layer (2026-07-25): feeds, manifest, robots, security.txt, 404, CSP

Everything in this section is static files in the working tree plus a handful
of nginx lines. Nothing here needs a runtime, a database or a third party.

### 1. What was added

| Path | What it is | Committed? |
|---|---|---|
| `tools/gen-feed.js` | the release-notes generator: `git log` → RSS 2.0 + JSON Feed, one **playable** link per entry | yes (the recipe) |
| `feed.xml` / `feed.json` | the live feed, latest 50 releases | **no — derived, gitignored** |
| `feed-archive.xml` / `feed-archive.json` | the complete history, back to the first commit (2026-06-06) | **no — derived, gitignored** |
| `manifest.webmanifest` | PWA manifest (installable, standalone, theme `#0c0a1a`) | yes |
| `robots.txt` | allow everything, AI crawlers named explicitly, points at the repo + sitemap | yes |
| `sitemap.xml` | 5 pages + 22 exemplary deep genre URLs, one per family | yes |
| `.well-known/security.txt` | RFC 9116 contact/expiry/policy | yes |
| `colophon.html` | what the thing is made of, and whose work is in it (zero JS) | yes |
| `404.html` | the empty-space page: the map + six genres to fall into (zero JS) | yes |
| `test/feed-links-run.js` | gate: the feeds validate AND a sample of showcase URLs really lands on the named genre in a real browser | yes |

### 2. The feed is generated ON THE WAY OUT (and why it is gitignored)

`tools/deploy-stellate.sh` runs `node tools/gen-feed.js --historic` immediately
before the rsync, so every deploy publishes notes that include the commit being
deployed. The feeds are **derived artifacts** — the git log is their source — so
they obey the one rule and stay gitignored (`/feed.xml`, `/feed.json`,
`/feed-archive.*`). Three consequences worth knowing:

- **`ship.sh`'s dirty-tree refusal is untouched.** Generation happens inside the
  deploy step, and the outputs are ignored files, so a regenerated feed can
  never make the tree dirty and can never block the next ship. (This is why
  generation is *not* wired before the dirty check: it does not need to be.)
- **A feed is never one commit stale.** Because the artifact is written after
  `git push`, the newest entry is the deploy you are doing.
- **CI and clean clones have no feed** — nothing gates on its presence. Run
  `node tools/gen-feed.js --historic` locally any time; `--dry` prints without
  writing, `--show 10` dumps rendered entries as text for eyeballing the prose.

Everything under `found/` and the feeds are the only files nginx serves that
aren't in git; `rsync` ships the working tree, not a git ref, so they deploy
normally.

### 3. nginx additions

```nginx
  # ── the open-web layer ──────────────────────────────────────────────────
  # 404: the styled empty-space page (internal, so the URL is preserved)
  error_page 404 /404.html;
  location = /404.html { internal; add_header Cache-Control "no-cache"; }

  # .well-known must be reachable. certbot usually adds a location for
  # /.well-known/acme-challenge/ — that is FINE, but check the config for a
  # blanket dotfile deny, which is the classic reason security.txt 404s:
  #     location ~ /\.  { deny all; }        # <- if this exists, carve it out:
  #     location ^~ /.well-known/ { allow all; }
  location ^~ /.well-known/ {
    default_type text/plain;
    add_header Cache-Control "public, max-age=86400";
  }

  # correct content types (nginx 1.24's mime.types has neither)
  location = /manifest.webmanifest { default_type application/manifest+json;
                                     add_header Cache-Control "no-cache"; }
  location ~ ^/feed(-archive)?\.xml$  { default_type application/rss+xml;
                                        add_header Cache-Control "no-cache"; }
  location ~ ^/feed(-archive)?\.json$ { default_type application/feed+json;
                                        add_header Cache-Control "no-cache"; }
  location = /robots.txt  { add_header Cache-Control "public, max-age=86400"; }
  location = /sitemap.xml { add_header Cache-Control "public, max-age=86400"; }
```

Remember the standing nginx trap in §5: `add_header` does **not** inherit into a
`location` that sets its own, so any location block above that must also carry
COOP/COEP has to repeat them. None of these files needs cross-origin isolation
(they are documents and text, not SAB consumers), but `/404.html` is rendered
inside the app's origin — if a 404 ever needs to boot the engine, repeat the two
isolation headers there.

The same additions belong in the `aboardresearch.com/projects/stellate/` alias
block, except `error_page`, which that site owns globally.

### 4. Content-Security-Policy

Derived from the code, not from a template. **Ship it as
`Content-Security-Policy-Report-Only` first**, watch the browser console (and
your own smoke run: play live on desktop and mobile, open the aliens view, run
the demoscene backdrop, load an embed on a third-party page), and only then
promote it to the enforcing header. One wrong token here silences the whole
instrument.

```nginx
  # REPORT-ONLY first — violations print to the console and nothing breaks.
  add_header Content-Security-Policy-Report-Only "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline' https://esm.sh; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob: data: https://archive.org https://*.archive.org; connect-src 'self' https://archive.org https://*.archive.org; worker-src 'self'; manifest-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors *" always;

  # …then, once it is quiet, the identical policy as the enforcing header:
  # add_header Content-Security-Policy "…same string…" always;
```

Per-directive, with the evidence and how sure we are:

| Directive | Why | Confidence |
|---|---|---|
| `default-src 'self'` | everything the app loads is same-origin except the two hosts below | **high** |
| `script-src 'self' https://esm.sh` | `app/state.js` imports preact + htm from `https://esm.sh` on *every* page; all other scripts are same-origin | **high** |
| `script-src 'wasm-unsafe-eval'` | Faust DSP modules, the espeak build and MicroW8 carts all `WebAssembly.compile()` **fetched bytes**, on the main thread *and* inside module workers (workers inherit the document policy). No string eval anywhere, so plain `'unsafe-eval'` is **not** needed | **high** |
| `script-src 'unsafe-inline'` | `how.html` carries the site's only inline `<script>` (the starfield + matrix diagram). Two better endings: move it to `app/how.js`, or pin its hash — `printf '%s' "$(sed -n '/<script>/,/<\/script>/p' how.html)"` is not good enough, use the browser's own console message, which prints the exact `'sha256-…'` to allow. Once it is gone, delete this token | **medium — remove it when how.html's script moves out** |
| `style-src 'unsafe-inline'` | inline `<style>` blocks in `access.html`, `how.html`, `colophon.html`, `404.html`; `style="…"` attributes in the HTML; injected `<style>` text in `app/starcruise.js` and `engine/demo-layer.js`. (Element-level `el.style.x = …` is CSSOM and unaffected.) No practical nonce path for the injected keyframes | **high — required** |
| `style-src https://fonts.googleapis.com` + `font-src https://fonts.gstatic.com` | the Orbitron/VT323 `<link>` on every page; the CSS it returns fetches the woff2 from gstatic | **high** |
| `img-src 'self' data:` | `engine/demo-layer.js` uses a `data:image/svg+xml` turbulence texture as a CSS background. `blob:` is precautionary (canvas snapshots in the 3D view) and costs nothing | **high / medium on `blob:`** |
| `media-src 'self' blob: data:` | the WAV-first mobile path plays `URL.createObjectURL(new Blob([wav]))` through a real `<audio>`; a silent `data:` WAV primes the element; found media is same-origin | **high** |
| `media-src`/`connect-src` `https://archive.org https://*.archive.org` | `engine/faust/found-player.js` falls back to streaming the original archive.org item when a local `found/` cache file is missing. Production ships all media same-origin (§3), so this should never fire — but omitting it turns a rare degraded case into a hard failure, and archive.org redirects through `ia*.us.archive.org`, which is why the wildcard is there | **medium — keep unless the fallback is deliberately retired** |
| `connect-src 'self'` | every other fetch is same-origin: manifests, `dist/*.wasm`, found media, and the cookie-free GoatCounter beacon at `/gc/count` (same origin, `sendBeacon`) | **high** |
| `worker-src 'self'` | `new Worker(BASE + "stream-worker.js", {type:"module"})`, the mp3 worker, `audioWorklet.addModule(BASE + "ring-player.js")`, `navigator.serviceWorker.register("sw.js")` — all same-origin paths, no blob workers | **high** |
| `manifest-src 'self'` | the new `manifest.webmanifest` | **high** |
| `frame-src 'none'`, `object-src 'none'` | the app frames nothing and has no `<object>`/`<embed>` | **high** |
| `base-uri 'self'`, `form-action 'self'` | no `<base>`, no `<form>` anywhere | **high** |
| **`frame-ancestors *`** | `embed.html` exists to be embedded in **other people's pages** (docs/EMBED.md). Do not tighten this, and do not add `X-Frame-Options` — either one silently kills every embed in the wild. If a future policy needs framing locked down, carve `embed.html` out **first** | **high — load-bearing** |

Notes:

- **No `report-uri`/`report-to`.** There is no collector and no wish to run one;
  report-only mode prints to the console, which is where a one-person deploy
  actually reads it.
- **CSP does not replace COOP/COEP** and does not interact with them. The
  cross-origin subresources (esm.sh, Google Fonts) already satisfy
  `require-corp` today; CSP only decides whether they are *allowed*, not
  whether they are *embeddable*.
- **The service worker inherits nothing.** `sw.js` is fetched under
  `worker-src 'self'`, and requests it makes on the page's behalf are governed
  by the page's policy.
- **Test the embed path explicitly.** `node test/embed-audio-run.js` plays
  `embed.html` inside a genuinely cross-origin parent — the one gate that would
  catch a `frame-ancestors` mistake.

### 5. Deploy checklist additions

- `manifest.webmanifest`, `robots.txt`, `sitemap.xml`, `colophon.html`,
  `404.html` and `.well-known/security.txt` are tracked files — the existing
  rsync carries them. **Check that rsync is not filtering the dot-directory**:
  `.well-known/` is not in the exclude list, and `--exclude '/.claude*'` does
  not match it, so it ships.
- The feeds are written by the deploy script itself, just before the rsync.
- After adding `<link rel="manifest">` (or any other `<head>` change) to
  `index.html`, **bump `sw.js` `VERSION`** — otherwise returning visitors keep
  the cached shell and never see it.
- `security.txt` has an `Expires` date. **It is 2027-07-25.** Renew it before
  then or it is formally invalid.
