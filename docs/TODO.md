# TODO — the running queue

Short, durable list of asked-for-but-not-yet-built work. Anything with a real
design behind it lands here in full; anything shipped moves to the DONE list.

## DONE 2026-07-27 — shipped to stellate.app

- **security.txt** contact → `paul.ford@aboard.com`.
- **Attribution** moved to the top of the About card, capitalized, mailto link;
  bottom-left `.credit` line removed from `index.html`. (`.credit` CSS **kept** —
  `embed.html:92` uses the same class.)
- **Region watermarks** alienized (`app/starmap.js:90`); `__REGIONS` hook still
  emits plain labels for the gates.
- **archive.org path deleted.** `localCacheFor` → convention resolver
  (`found/<id>.mp3`); the Range/escalate ladder, `FOUND_MAX_BYTES` and both
  `mode:"cors"` fetches are gone. All 192 sources verified to resolve locally;
  the 79 unmapped ones all followed the convention, so **zero** manifest rows
  were needed. New gate `test/no-remote-sources.test.js` makes it permanent.
- **SW cache split** — `stellate-app-v41` (SWR, swept) + `stellate-media-v1`
  (cache-first, never swept), with one-time salvage of `/found/` out of the old
  v40 cache so this deploy doesn't cost users their media. `engine/faust/dist/`
  moved to the app cache (fixes the stale-wasm skew). 14 KB of stacked release
  notes removed from the VERSION line. **Mutable carve-out honored**: `*.json`
  and `tw_vocal.mp3` stay app-cached (HOSTING.md §5) — without this they would
  have been frozen on every client forever.
- **`app/precache.js` fixed**, not deleted — warms the real demand set
  (`sch.found` ∪ `sampler.zones`, p50 24 files / 3.8 MB) resolved through the
  player's own local resolver, not `s.url` (which is still an archive.org URL).
- **FOUND FADE** replaces the FOUND-AT-90% cliff, and fixes a **pre-existing
  asymmetry**: `genreMeta.t` is the raw blend position, not distance from the
  nearest anchor, so the old test dropped the layer across the entire second
  half of every crossfade — including near-pure B, which its own "top blend
  weight >= 90%" comment said should keep it. Now read as `min(t, 1-t)`.
  Measured vaporwave→techno: was 0 events from t=0.15–0.95; now non-zero
  everywhere except the exact 50/50 midpoint. **Still needs ears** — the ramp
  width (`FOUND_FADE_T=0.5`) is a taste call the matrix cannot gate.
- **Everything is local now.** preact + htm vendored (`vendor/preact`,
  `vendor/htm`), Orbitron + VT323 self-hosted (`vendor/fonts`, 46 KB, latin +
  latin-ext, vietnamese dropped). This fixes the Safari CORP errors AND the
  fact that **the PWA could not boot offline** — `sw.js` never caches
  cross-origin, so esm.sh was a hard runtime dependency. `colophon.html`
  updated; it advertised the CDN as a fact.
- **`test/probe-harness.js`**: added `.mjs` and `.woff2` MIME types. Without
  `.mjs` the vendored modules served as `application/octet-stream`, strict
  module-MIME checking aborted the whole graph, and the app silently never
  booted with an empty console.

Gates: `matrix --no-cache` **274/274**, `verify.sh` all 9 PASS, `meter.test.js`
byte-identity green, `boot-smoke` 14/14 in order, `explorer-ui-test` PASS,
`mp3-bed-decode-run` PASS, `no-remote-sources` 6/6.

- **`verifier-catalog` submodule removed** along with `.gitmodules` and
  `.mcp.json`. Nothing in the app or the gates imported it and CI never checked
  it out, but at 4.9 GB it was the worst thing a new cloner could trip over.
- **Repo made public.** History swept first: no media, no keys, no `.env` ever
  committed (the one rule held), largest blob 2.1 MB of vendored JS.

Review: 12 findings raised, 5 survived adversarial refutation, all 5 fixed.

**Shipped as 9 commits + the vendor `.js` rename.** One production break and
fix: nginx has no `.mjs` MIME mapping, so the first deploy served the vendored
modules as `application/octet-stream` and browsers refused them as modules.
Renamed to `.js` rather than patching nginx — `.js` is mapped everywhere, so it
cannot regress on a new host, and it fixes aboardresearch.com at the same time.

---

## PLAN — LOFO: get a session to ~3 MB, and stop streaming from archive.org

**Asked 2026-07-27 (Paul):** *"Don't stream from archive.org, that's legacy —
cache locally. Don't ship WAV or FLAC ever. Are you compressing everything to
MP3 and making it byte-addressable? We're LOFO. Get it to like 3mb per 10
minute session."*

### Where we are (measured)

| | |
|---|---|
| First page load, no audio | 2.90 MB raw / **~0.78 MB gz**, ~37 requests |
| Per genre, media | p50 **26 req / 5.07 MB**, p90 36 / 7.93 MB, max 147 / 15.47 MB |
| **10-min session (~20 genres)** | ~256 files / **56.3 MB** media + ~7 MB shell ≈ **63 MB** |
| Ceiling, one seed, all 274 genres | 849 files / 154.3 MB |
| Deployed payload | **530 MB / 8,278 files** |
| Droplet headroom | 1 TiB/mo ÷ 69 MB ≈ **~510 sessions/day** |

The good news first: loading is **already genuinely on-demand** — per fed bar,
not per genre or per manifest (`engine/faust/live.js:873-875`), memoised by
srcId through a 4-wide decode gate (`live.js:333-357`, `:627`). No SoundFont
blob is ever served; the 151 MB FluidR3 is exploded at build time into
per-preset zone slices (`engine/faust/extract-gm.js:20,35-39`) and no `.sf2`
reaches the wire. There is no over-fetch to fix. **The problem is purely that
the bytes are uncompressed PCM.**

### Phase 1 — kill the archive.org path outright (do first; pure win)

`decodeUrlToBuffer` (`found-player.js:657`) resolves `localCacheFor`
(`:540-544`), which is a **pure lookup in `found/found-manifest.json`** with no
filesystem fallback. Miss the lookup and the browser streams the source from
archive.org in 1–8 MB `Range` requests (`found-player.js:469`, `:701`,
`:711-740`).

Measured: **79 of 192 `K.SOURCES` are unmapped, and all 79 have a local twin
already on disk and already deployed** (35.4 MB). **128 of 274 genres (47%)**
hit archive.org at least once. The SW skips cross-origin (`sw.js:44`) so none
of it ever caches — it is re-pulled every session, per user.

**Do:**
1. Add the 79 missing `byUrl` mappings to `found/found-manifest.json`, or
   better, make `localCacheFor` fall back to `found/<id>.mp3` by convention so
   the class of bug cannot recur.
2. Then **delete the remote fetch path entirely** — the Range/escalate ladder
   at `found-player.js:701-740` and `FOUND_MAX_BYTES`. Paul: *"that's legacy."*
   A missing local file should fail loudly in the gates, not silently reach the
   public internet on a listener's behalf.

**Test:** a gate asserting **no `K.SOURCES` entry resolves to a non-`found/`
URL** — cheap, pure node, and it makes the rule permanent.

### Phase 2 — MP3 everywhere, no WAV, no FLAC

**Law: the wire format is MP3.** WAV exists only as a build-time intermediate;
FLAC is rejected (Paul, explicitly) despite being bit-exact.

Targets by crate (transcode settings pending the feasibility measurement —
see `scratchpad/mp3-feasibility.md`):

| crate | now | files |
|---|---|---|
| `found/samples/instruments/` | **102.2 MB** | 644 zone WAVs |
| `found/samples/voxbank/` | 88 MB | 361 |
| `found/samples/stml/` | 27 MB | 80 |
| `found/samples/drums/` + `hits/` | 24 MB | 136 |
| `found/samples/speech/` | 7.2 MB | 244 |
| `found/samples/breaks/` | 4.8 MB | 16 |

**MEASURED 2026-07-27. `docs/HOSTING.md:97` is wrong — fix that doc.**

The loop-point objection does not survive measurement. With ffmpeg's *default*
`-write_xing 1` (the LAME gapless tag), Chromium and Firefox `decodeAudioData`
return **exactly** the source sample count at **offset 0** — sample-exact, loop
points unchanged. WebKit ignores the tag and prepends a **constant 1105
samples**, verified across 10 real zone files × 3 bitrates × 2 sample rates,
never varying. 1105 samples is 25 ms — audible as a seam click, so correcting it
is required, not optional.

The correction is free and needs no probe file, because `zones.json` already
carries `len`:

```js
const scale  = buf.sampleRate / z.sr;
const leadIn = (buf.length > z.len * scale) ? 1105 * scale : 0;
```

Apply at `engine/faust/sampler.js:598-600` (PCM path) and
`engine/faust/live.js:1303` (live `loopStartSec`).

**Byte-addressability works — verified bit-exact in all three engines.** Encode
each zone separately (own Xing tag, no ID3), concatenate into a per-preset
sprite, store `{off,len}`. Range-fetching a zone's byte span, or
`decodeAudioData(sprite.slice(off, off+len))` after one GET, decodes identically
to the standalone file (MSE 0.00e+0, chromium/firefox/webkit). Cutting a *live*
stream mid-file does **not** work — ~4 frames (≈105 ms) of bit-reservoir garbage,
and Firefox rejects misaligned slices outright. Prior art:
`found-player.js:711,718` already does Range with an ignore-Range fallback.

**Two dead levers, so don't plan around them:** **88.8% of zones loop**
(572/644), so "keep the looped few lossless" is not available; and post-loop
tail is **0.1%** because `extract-gm.js` already trims it, so release-tail
trimming buys nothing.

**The setting that makes LOFO cheap: 48 kbps mono @ 22.05 kHz.** Instruments
carry **0.254% mean / 0.001% median** energy above 11.025 kHz, so 48k/22.05k
measures a *higher* SNR (24.7 dB) than 64k/44.1k (24.0 dB) **while being 25%
smaller**. Drums are the opposite — 8.97% above 11 kHz — so keep `drums/` and
`perc/` at 44.1 kHz; it costs 1.1 MB across the whole library.

Whole PCM library **260.8 MB → 18.6 MB**. Instruments 107.2 MB → 7.7 MB.

### Phase 3 — the FREE cuts only

**Decided 2026-07-27 (Paul): "compress + the free cuts only."**

**Good news, measured after that decision: compression alone essentially hits
the 3 MB target.** Two corrections to the earlier estimate in this file —
(a) 48k/22.05k is *better sounding and smaller* than 64k/44.1k for instruments,
and (b) my "20 genres per 10-minute session" was wrong: `app/world.js:149`
`BARS_PER_SEG=256` is ≈8.5 min per leg, so **a 10-minute session is 3-5
genres**, not 20.

| scenario | ~10 min (5 genres) | 20 genres |
|---|---:|---:|
| today | 14.77 MB | 41.38 MB |
| 64k mono 44.1k | 4.46 | 11.68 |
| **48k mono 22.05k ← the plan** | **3.37** | 8.81 |
| + max-zones 3 | 3.15 | 8.04 |
| 32k/22.05k + max-zones 3 | 2.10 | 5.36 |

So **Phase 2 alone lands at ~3.4 MB** with no fidelity-costing cut. The
fidelity levers stay unpulled per the decision, and for the record:
max-zones 6→3 saves 51% of the library, but **6→2 breaks the +16 semitone
`MAX_STRETCH_UP_ST` cap at `sampler.js:495` — 3 is the honest floor**, and
max-zones is a **kernel** change that shifts the confusion matrix and needs
`matrix --no-cache` plus a determinism-fixture re-bake. Not free. Not now.

One unclaimed free-ish lever worth measuring later: **loop-region capping**
(a 1.0 s cap is 11.6%). And **beds are 12.5 MB of the session** (already
92 kbps × 40 s) → 0.13× via 24k + 20 s trim, but re-derive from the `.ogg`
originals to avoid generation loss.

Everything below costs nothing:

- **Drop `zones.json` + `_gm-extract-summary.json` from the deploy** — 135 files
  nothing ever fetches (the browser reads zones from `K.SAMPLERS`).
- **Shrink the eager shell**: `app/starcruise.js` (135 KB/48 KB gz) is an eager
  module at `index.html:164` only to register a view; `engine/genre-verifier.js`
  (108 KB/29 KB gz) is only needed for the `rescore()` readout. Both lazy-load.
- **Stop fetching `dx7-presets.json` 4× per session** (671 KB raw, `app/main.js:51`
  + `stream-worker.js:168` × 3 workers) — post it from the main thread.
- **`engine/faust/node_modules/@grame` is 28 MB deployed** to serve one 194 KB
  ESM entry (`docs/HOSTING.md:265-268` claims otherwise and is wrong).

Report what each cut buys rather than assuming the total.

### Phase 4 — caching and edge

1. **Split the service-worker cache.** `sw.js:35` deletes every non-current
   cache key on activate, and media lives in the *same* versioned cache as app
   code — so each ship wipes every user's warmed media. `sw.js` has **40
   commits, 13 on 2026-07-25 alone**. Split into `stellate-app-vNN` (versioned,
   SWR) + **never-versioned** `stellate-media-v1` (cache-first). ~10 lines,
   biggest single bandwidth win in the system.
2. **Cloudflare free tier proxying `/found/`.** The `immutable` headers
   (`HOSTING.md:200`) and versioned-by-name media are already correct, so this
   is config, not migration — and it removes the droplet transfer ceiling
   without the R2 work sketched at `HOSTING.md:269-306`.
3. **Fix the SW/server immutability skew**: `sw.js:30` treats
   `engine/faust/dist/` as immutable but the deploy deliberately does not
   (`tools/deploy-stellate.sh:36-39`) — a recompiled `.dsp` under an unchanged
   name serves stale until the next SW bump. Content-hash it or drop it from
   `IMMUTABLE`.
4. **`app/precache.js` is dead code** — it reads `s.file` and
   `instruments.pad.sampler`; the real shapes are `samplePath` and there is no
   `.sampler` key. Union over all 274 genres: **16 files**. Either fix it to key
   off the `sched.found` ∪ `u.sampler.zones` set (~5 MB/genre) or delete it.
   **Do not** naively fix it against `st.foundSources` — that pulls 625 files /
   100 MB per genre, because the resolved state declares the whole crate rather
   than the draw set.

### Also found (small, unrelated)

`index.html:76` loads `fonts.googleapis.com` cross-origin while the page is
COEP `require-corp` (`HOSTING.md:31-40`). Google Fonts sends no CORP header, so
this is very likely blocked in production — meaning **Orbitron/VT323 are
probably not rendering** for anyone. Self-host the two faces.

### Sequencing note

Phase 1 and Phase 4.1 are pure wins and should land before the found-layer
Phase 1 ramp (below), which increases per-session media by turning the found
layer on across whole crossfades instead of only at anchors.

---

## Attribution line → top of About, drop the corner credit

**Asked 2026-07-27 (Paul).**

1. **Remove** the always-on bottom-left standing credit — `index.html:121`
   (`<p class="credit">…`) plus its comment at `index.html:118-120` and the
   `.credit` rules in `app/app.css` (see the block comment at `app/app.css:328`,
   "made by Paul Ford at Aboard, always on screen, never in the way: bottom-LEFT").
   Check nothing else keys off `.credit` before deleting the CSS.
2. **Move** the attribution to the **top** of the About card — currently the
   `<p class="ab-foot">` at `index.html:114-116`, which sits last. It goes
   directly under `<h2>Stellate</h2>` (`index.html:89`), above `.ab-what`.
3. **Capitalize** it: "Made by Paul Ford at Aboard" (today it is lowercase "made by").
4. **Paul Ford** becomes a `mailto:` link instead of the ftrain.com link:

   ```html
   <a href="mailto:paul.ford@aboard.com?subject=I%20have%20a%20strong%20opinion%20about%20Stellate.app">Paul Ford</a>
   ```

   (subject: `I have a strong opinion about Stellate.app` — percent-encode the
   spaces so the href survives HTML attribute parsing and mail clients.)

Keep the Aboard → aboard.com link and the "open source · MIT" tail. The
attribution comment at `index.html:111-113` says the credit appears in three
places (about layer, standing credit line, JSON-LD/OG head) — update that comment
to match, since the standing line is going away. The JSON-LD/OG head attribution
(`index.html:34`, `index.html:71-72`) stays.

**Test:** `node test/explorer-ui-test.js` (boot smoke — make sure removing
`.credit` doesn't trip a selector), plus eyeball the ? layer at
`http://localhost:8777/` via `./serve.sh`.

---

## PLAN — the found layer is inaudible almost everywhere

**Asked 2026-07-27 (Paul):** *"I rarely hear samples from naropa or BBC and I
hear less speech synthesis than I expected… I was hoping they'd be spread all
over."*

Measured (274 genres × seeds, via `buildEvents` directly — see the diagnosis
below). Three mechanisms compound; the phases are ordered by leverage-over-risk.

### The measurements

| Symptom | Number |
|---|---|
| Playlist tracks rendering ZERO found events | **180/240 (75%)** |
| Crossfade (vaporwave→techno) with found silent | **t=0.15 … 0.95 (~89%)** |
| Genres with `role:"bed"` | **206/274** |
| Median found events / 16 bars, bed role | **1.10** (chops 23, break 75) |
| Genres emitting ≤8 found events for a WHOLE track | **171/274 (62%)** |
| BBC events per track | **0.74** (fires in 28% of runs) |
| Naropa events per track | **0.22** |
| Genres naming a BBC id directly | **0** — pool-only |
| Naropa readings that reached `pool:voices` | **4 of 25** |
| Genres that can trigger LIVE espeak synthesis | **1 of 274** |

---

### Phase 1 — ramp the FOUND-AT-90% cliff (highest leverage, matrix-invisible)

`engine/csd-engine.js:1803` computes
`foundOK = !state.genreMeta || (state.genreMeta.t||0) <= 0.1+1e-9`, and
`:2843` does `if(!foundOK) found=[]`. It is a hard binary: one notch past 90%
dominance and the entire found layer vanishes. This is why playlists and
mid-glide star-map travel are 75%/89% silent.

**Do:** replace the delete with a gain ramp at the same choke point. Sketch:

```js
// FOUND-AT-90% -> FOUND-FADE: the layer thins with distance from the anchor
// instead of vanishing at a cliff (Paul 2026-07-27: "I was hoping they'd be
// spread all over"). t<=0.1 is unchanged => byte-identical fixtures.
const t = state.genreMeta ? (state.genreMeta.t || 0) : 0;
const fg = t <= 0.1 + 1e-9 ? 1 : Math.max(0, 1 - (t - 0.1) / 0.4);   // 0 by t=0.5
if (fg <= 0) found = [];
else if (fg < 1) found = found.filter(e => (e.amp = e.amp * fg) > 0.012);
```

**Why this is safe:**
- `found=[]` already runs AFTER every found event is generated, so all rng
  draws have happened by `:2843`. Scaling amps perturbs **no** rng stream —
  determinism holds exactly.
- Every found event carries `amp` (`csd-engine.js:1823-1948`, `:2399-2470`),
  so one multiply at the choke point covers all four roles.
- At `t <= 0.1` (which includes every single-genre state, `t=0`, and every
  state with no `genreMeta`) the gain is exactly 1 → **byte-identical**. The
  confusion matrix only ever renders anchors at `t=0`, so **the matrix cannot
  move**. Same for the fixtures the `:1798-1802` comment defends.
- The amp floor drops events too quiet to hear rather than scheduling silent
  voices (matters for Phase 1's cost — see the caveat).

**Tune before committing:** the `0.4` width and `0.012` floor are first
guesses. Ramp reaching zero at `t=0.5` means found survives the near half of
every crossfade. Paul's ears decide; try `0.4` vs. a full `0.9` (never fully
silent) — the latter is the literal reading of "spread all over."

**⚠ Cost caveat — coordinate with the media audit.** Turning found on across
the whole crossfade means a glide now fetches found sources for BOTH ends of
the blend, not just at anchors. `live.js:1306-1308` drops any event whose
buffer hasn't decoded (silently, no retry) and found decodes already compete
with 20-29 sampler zone decodes through the shared gate (`live.js:627`,
`makeDecGate` `:333`). **Do not land Phase 1 before the on-demand media
findings are in** — this phase is exactly the thing that multiplies per-session
media bytes.

**Test:** `./verify.sh`; `node engine/genre-verifier.js matrix --no-cache` must
still print `diagonal dominant: 274/274` (it should be untouched);
`node test/meter.test.js` head_byte_identity must NOT trip (t=0 unchanged);
then ears on a star-map glide.

---

### Phase 2 — un-dilute BBC and Naropa in the pools (matrix-RISKY)

BBC reaches the mix **only** through pool tokens — 4 BBC members in each of
~10 pools of 14-20 (`genre-kernel.js:285-334`), then `foundPool` keeps only
`min(6, expanded)` (`genre-kernel.js:7116`), then only sections carrying a bed
draw from it. Net 0.74 events/track. Naropa is worse: **4 of the 25 readings**
made it into `pool:voices` (`genre-kernel.js:302-305`); the other 21 (Corso,
Whalen, McClure, Baraka, Sanders, the second Kyger/diPrima/Snyder readings…)
are reachable essentially only via `spokenword`.

**Do:** raise the draw weight rather than the member count — bumping raw
membership dilutes the non-BBC members symmetrically and shifts every genre
that touches the pool. Options in preference order:
1. Widen `foundPool`'s `min(6, …)` cap so more of an expanded pool survives to
   rotate across sections (fewer repeats AND more crate reach, one number).
2. Rotate Naropa readings as a *family* the way `vb_*`/`sp_st_*` already
   rotate under `governVoiceRepeats` (`csd-engine.js:1409-1452`) — flat `vx_`
   two-token ids are currently **dropped** rather than substituted, which is
   itself a bug-shaped behaviour worth fixing here.
3. Only then consider adding readings to `pool:voices`.

**This one moves single-genre renders, so it moves the matrix.** CLAUDE.md's
matrix-safety rule applies in full: after every batch,
`node engine/genre-verifier.js matrix --no-cache` MUST still print
`diagonal dominant: 274/274`. Do it in small batches, never one big sweep.

---

### Phase 3 — the `hits` all-or-nothing coin (matrix-RISKY)

`genre-kernel.js:7127`: `hits: rng() < hitsSide.hits.prob ? {…} : null` —
mean prob **0.342**, so ~79% of tracks have **no one-shot layer at all**. Most
`sp_*` speech ids live in `hits.sources`, which is why espeak-family clips fire
in only 19.5% of runs. Compounded downstream by a 45% per-slot skip
(`csd-engine.js:1894`) on top of `HIT_PATTERNS` that are already 1-2 slots per
8-beat bar (`:1518`).

**Do:** prefer thinning the *downstream* skip over raising `prob` — a track
that has the layer at low density reads as "spread all over" better than a
coin that gives 34% of tracks a dense layer and the rest nothing. Same matrix
gate as Phase 2.

---

### Phase 4 — the speech ORGAN reaches exactly one genre

Live espeak WASM synthesis has **one** trigger in the whole catalog:
`genre-kernel.js:8396-8422` requires `transitwave` weight `>= 0.35`, placed as
`"opener"` (fires once, at the first section, `csd-engine.js:2417-2426`).
Everything else that reads as "espeak" is **pre-rendered mp3** under
`found/samples/speech/`. The organ in `engine/speech.js` +
`found-player.js:627` is essentially unwired.

**Do:** this is a design question, not a patch — decide which genres should
*speak* (station announcements, hold-music voice, auction calls, the towncrier
family already have the vocabulary) and give `synthText` more than one
producer. Note the governor (`csd-engine.js:1417`, `GOV_CAP=5` per 64 bars per
source, `GOV_MINGAP_BARS=6.4`) will cap density automatically, and is weaker in
the live walk (`:1385-1395`) because each generation is one collapsed section.

**Sequencing:** Phase 1 alone may resolve most of the complaint — it's the
difference between "found exists at 25% of listening" and "found exists
always." Land it, listen, then decide whether 2-4 are still needed.

---

## PLAN — Source cleanup for 1.0

**Asked 2026-07-27 (Paul):** go file by file, strip extraneous comments and
legacy, plain idiomatic code and data everywhere, organic folders, one entry
point fanning out, no direct quotes from sessions, proper 1.0.

Surveyed by five agents against the real tree. **Everything below is measured.**

### The ordering law (read first)

1. **Protect the reorg** — get the load-order gate into CI *before* any file moves.
2. **Delete** what's dead — smaller surface to move.
3. **Strip** comments/text — cheap, file-local, no path churn.
4. **Reorganize** — invalidates every `file:line` anchor in every other plan,
   so it comes after the functional work in this file (LOFO, found layer).
5. **Genre data** — the kernel split and the spec round-trip.
6. **Docs + README + HTML prose** — last, because only then are they true.

---

### Stage A — protect the reorg (do this first, nothing else before it)

**`test/boot-smoke.js` does not run in CI.** It parses `index.html`, replays the
classic `<script>` block in a `vm` sandbox, and fails if a new engine script
appears that isn't in its `EXPECTED` registry (`test/boot-smoke.js:32-50`). It
is the single most important structural gate for this whole plan and it only
lives in `npm run test:pure`, which `.github/workflows/verify.yml` never calls.

- Add `boot-smoke.js` to `verify.sh`.
- **Extend it to `access.html` and `embed.html`.** Both hand-maintain their own
  11-script lists (`access.html:279-289`, `embed.html:95-105`) with **no gate at
  all**, and both omit `engine/midi-export.js` + `engine/demo-layer.js`. Three
  hand-synced lists and one gate covering one of them is how a reorg breaks
  production silently.

The load order is real and documented: `theory`+`pipes` → `csd-engine` →
`genre-kernel`/`genre-verifier`/`midi-export`; and
`state-engine` → `found-player` → `sampler` → `live`. `genre-kernel.js:20` reads
`root.CsdEngine` **at load time**, not call time.

### Stage B — deletions (all verified zero-reference)

| Target | Size | Evidence |
|---|---|---|
| `playlist/` | 31 files, 140 KB | Untouched since 2026-06-11; no code reads it; **currently deploying to stellate.app** (the `/*.state.json` exclude is root-anchored so `playlist/track-*.state.json` isn't matched). Committed derived output — violates the one rule. |
| `tools/fetch-found-voice.sh` | 104 lines | Zero hits repo-wide. Superseded by `fetch-found-naropa.sh` + `gen-voice-bank.js`. |
| `tools/make-mix-page.js` | 104 lines | Zero references. Its output dir is `playlist/`. |
| `test/probe-*.js` (13 files) | 1,864 lines | Unreferenced DSP-tuning instruments, not gates. Move to `test/probes/` with a README, or delete. Keep `probe-harness.js` — 42 files require it. |
| `test/starcruise-*shot.js` + `shot-settings.js` | 451 lines | Produce PNGs, assert nothing. Belong in `tools/`, not `test/`. |
| `engine/checks/` (5 files) | 899 lines | Zero CI reach. `test/margin-baseline.json` (260 lines) is written by nothing. Either promote into `verify.sh` as advisory or retire. |
| `docs/KERNEL-MAP.md` | 66 lines | **All 13 line numbers wrong** (`GENRES` doc 1663 → real 1327; `toState` 7908 → 8198). Keep only its regeneration grep, fold into CLAUDE.md. |
| `docs/STARCRUISE-LIBS.md` | 103 lines | Adoption plan; 2 of 5 picks shipped, 3 never existed. |
| `docs/ROADMAP.md` | 423 lines | 38 items `[DONE]`; its own ground-truth block says 249. References four docs that never existed. Superseded by this file. → `history/` or delete. |
| `docs/history/`: `KERNEL-V4`, `NEXT`, `EVALUATION`, `VALIDATION`, `ab-report`, `MATERIALS` | ~1,044 lines | Reviewed a 61-anchor/1,859-line kernel; 15/15 matrices; csound parity tables. **Before deleting MATERIALS.md, fix `SOURCES.md:632`**, which cites it at an already-broken path. |

**Do NOT delete** `docs/WAV-FIRST.md` — **promote it to `docs/WAV-FIRST.md`**.
It's cited from four live places (`README.md:63`, `CLAUDE.md:281`,
`docs/ARCHITECTURE.md:84`) and describes shipped behavior. Keep `ZERO-STATIC.md`
(the only written rationale for the ring/zombie-worklet law `live.js retirePool`
still enforces) and `FAUST-PORT.md` (43 lines, cited by CLAUDE.md).

**Dead options to remove while in there:** `?forceClassicOut` and `?forceMediaEl`
(`app/live.js:83-89`, ungated escape hatches, zero consumers); `?wavDebug`
(~75 lines of shipped debug UI, `live.js:123-198`, no gate); env vars `SC_PORT`,
`KEEP_MIXWAV`, `REF_FONT` (all orphaned); `FP._legacyBed`
(`found-player.js:1071` — keeps an otherwise-unreachable `startScheduler()`
alive); `opts.elRecycleSec`; flags `--witness`, `--full`, `--expect`, and three
of four `--json`.

### Stage C — the text strip

**Measured:** `app/` 1,875 comment lines of 6,756 (27.8%); engine/tools/test
14,478 of 58,329 (25%). Session-attribution and legacy narration:
**505 lines** in engine/tools/test + ~150 in `app/`. **132 lines name Paul; 580
carry quoted session speech; 331 carry a bare date.**

Rules for the pass — keep the *technical* content of every comment, delete the
provenance:

- No dated attributions (`Paul 2026-07-10:`), no quoted session speech, no
  git SHAs, no branch-name narration.
- No comments describing things that aren't there: `index.html:134` documents a
  background chip that isn't in the file; `app/readouts.js:33` says "feature
  retired"; `app/starcruise.js:1097` narrates a removed `makeShip()`.
- Deduplicate. *"preserved on branch legacy-csound"* appears **five times**
  (`csd-engine.js:2870`, `genre-kernel.js:824`, `:8465`, `:8766`,
  `validate-genres.js:297`) — say it **once**, in CLAUDE.md.
  `app/inside.js` carries the same two quotes **twice each**.
- Delete `app/glyphs.js:4-18`, a 15-line block headed `// ARCHAEOLOGY.`
- Fix 4 stale self-references: `test/audit-gate-test.js`, `hold-verify-run.js`,
  `journey-crash-run.js`, `strip-fuzz-test.js` all still head themselves
  `// faust/…` from before they moved into `test/`.

**`sw.js:21` is the worst single site in the repo** — the `VERSION` constant is
one line carrying 40 stacked release notes (v11→v40), several thousand words
including verbatim quotes, **shipped to every visitor on every load**. Reduce to
a version string; the notes belong in git history.

Expected yield: **~700-900 lines**, concentrated in `genre-kernel.js` (98),
`state-engine.js` (52), `csd-engine.js` (50), `live.js` (49).

**Note:** a scan for commented-out dead *code* in `app/` returned **zero** true
positives, and there are **no dead files** in `app/` — all 29 modules are live
and no export is unreferenced. The dead weight is text, not code.

### Stage D — the reorganization

**`app/` — the shape works.** `app/starcruise/` already proves the pattern.

```
app/
  main.js                ← the one entry point
  core/      state.js world.js share.js
  audio/     live.js targeting.js fonts.js precache.js export.js notefeed.js
  map/       starmap.js glyphs.js
  panels/    panels.js inside.js readouts.js background.js
  entries/   access.js embed.js analytics.js
  starcruise/            (unchanged)
```

**Two pre-existing import cycles must be respected**: `targeting↔live` and
`live↔inside`. They work only because ESM live-bindings are read at call time.
The second becomes a *cross-folder* cycle under this layout — fix by extracting
the note feed (`inside.js:545-604`) into `audio/notefeed.js`, which is the only
part `live.js` needs. That leaves one cycle, contained inside `audio/`.

Also: promote three accidental `window.__` reach-throughs to real imports
(`embed→__ZOOM`, `embed→__X`, `main→__MINSEP`). **Keep** the three at the
starcruise↔app boundary — they exist to keep Three.js and Preact off each
other's load path. Document that as the one sanctioned seam.

**Splits worth doing:** `app/starcruise.js` (2,293 lines → bridge/scene/camera/
probes); `app/starmap.js` (913 → draw/gestures/layout, already banner-separated);
`app/inside.js` (782 → four independent renderers).

**`engine/faust/` is three unrelated things in one folder** — a realtime
runtime, an offline renderer, and extraction one-shots plus ~1.3 MB of JSON:

```
engine/faust/
  live/    live.js ring-player.js sentinel-processor.js stream-*.js stem-worker.js engine.js
  press/   press.js render-core.js offline-render.js
  voices/  state-engine.js sampler.js found-player.js
  codec/   fmp4.js mp3-*.js wav.js
  build/   build.js make-fixture.js extract-gm.js sf2.js sysex2params.js
  data/    font-*.json dx7-presets.json fonts.json fixture.json
  dsp/ dist/   (unchanged)
```

Cost: 4 `<script src>` paths × 3 HTML files + `boot-smoke.js`'s registry.

**`tools/`** → `fetch/` (12) · `mine/` (6) · `genre/` (21) · `build/` (6) ·
`deploy/` (2) · `audit/` (4). Note the `genre/` cohort: **16 tools / ~3,100
lines reachable only through ROADMAP prose**, all single-commit 2026-07-11.
They read as first-class tooling and aren't — give the folder a README saying
"analysis, run by hand," or retire them.

**`test/`** → `gates/` (the 9 `verify.sh` jobs + theory/pipes/boot-smoke/speech)
· `unit/` (~40 pure-node) · `browser/` (~42) · `starcruise/` (~12) · `probes/`
(15) · `lib/`. And **settle the naming**: 18 `*.test.js`, 14 `*-test.js`, 43
`*-run.js` for the same thing. `npm run test:browser` loops over `*-run.js` but
**14 of those 43 need no browser**.

**Top-level HTML: leave the URLs alone.** Moving `how/access/colophon/embed/404`
into a folder is a bad trade and there is already a standing decision against it
(`docs/ROADMAP.md:370`). Blockers: `oembed.json:9` hardcodes
`stellate.app/embed.html` inside iframe HTML **already published and cached** by
Mastodon/WordPress/Notion; `.well-known/security.txt` publishes `colophon.html`
as its RFC 9116 Acknowledgments URI; `404.html` needs an nginx `error_page` edit
on the droplet; `manifest.webmanifest` PWA shortcuts are baked into installed
users' launchers; `feed-archive.xml` (726 KB) holds hundreds of published
`colophon.html` links; plus 6 gates and 2 deploy smoke checks.

**Do this instead** — same benefit, zero production risk: those six pages
duplicate **~110 lines of social-meta head and ~314 lines of inline `<style>`**.
Extract to a linked stylesheet. And move `how.html`'s inline `<script>` out — it
is the **sole** reason the CSP still needs `script-src 'unsafe-inline'`
(`docs/HOSTING.md:632`), so that one edit lets the CSP tighten for 1.0.

**`verifier-catalog/` is GONE (done 2026-07-27).** Paul: *"get rid of the
verifiers dependency, it'll just confuse people."* The submodule, `.gitmodules`
and `.mcp.json` are removed and every reference updated. Nothing in the app or
the gates ever imported it, CI never checked it out, and at 4.9 GB it was the
single most confusing thing a new cloner could hit. The earlier idea of moving
it into `vendor/` is moot. `vendor/` itself is in excellent shape — every dir
used, versioned, and credited. Leave it alone.

### Stage E — the genre data

**E1. Split the kernel.** `engine/genre-kernel.js` is 8,977 lines / 996 KB and
**82% inert data** — `GENRES` alone is 664 KB (66.6%). It also ships a
**243-line node-only CLI** (`fs`, `child_process`, shells to `ffmpeg`) to every
browser.

Emit a generated classic script `engine/genres-data.js`
(`window.__GENRES = {...}`) loaded immediately before the kernel, plus
`engine/registry-data.js` for `SOURCES`/`SAMPLES`/`SAMPLERS`/`VOXBANK`/
`SOURCE_POOLS`/`PERCBANK`. **Not JSON-over-fetch** — that breaks the synchronous
contract `app/access.js:25` and `app/starmap.js:787` rely on at module top
level. Move the CLI to `tools/kernel-cli.js`. Result: ~810 KB of 996 KB becomes
generated data; the kernel drops to ~186 KB a person can read.

**Gate it**: `GENRES` is 99.8% literal, but JSON round-tripping can reorder keys
and normalize numbers, and determinism is the product. Write a hash-equality
check on the serialized `GENRES` before/after. That gate does not exist today.

**E2. `genre-specs/` — the answer to "am I looking at ALL the genres?" is no.**

- **135 specs for 274 genres (49%).** The 139 without one are *all* at `GENRES`
  indices 0–177 — the pre-`genre-tool` era. The missing set is the **core**:
  techno, house, jungle, vaporwave, jazz, dub, citypop, and 20 of the 22
  hand-tuned `MIND_OVERRIDES` genres. The specs cover the periphery.
- **115 of the 135 have already drifted** from the anchor that ships. 20 are
  byte-identical; **all 135 labels are stale** (commit `fc5183f` renamed every
  label and never touched the specs); 40 of 42 `pos` values stale.
- **The folder is one-directional.** Only `tools/genre-tool.js` reads specs;
  every later edit happens in the kernel by hand and is never written back.
  Nothing at runtime reads `genre-specs/` at all.
- **`invented/` is a red herring** — confirmed: **68 of 274 anchors are
  machine-invented**, but only 8 have specs, and those 8 are the folder. It
  means "the one batch where someone passed `--specs`," not "the invented ones."
  **Flatten it.**
- **4 of 10 top-level keys are inert**: `clips` (93 files — `GENRE_CLIPS` was
  deleted 2026-07-25), `materials` (29), `invented` (8), `damp` (4).
- **Formatting**: 8 distinct top-level key orders, 45 distinct anchor key
  orders, 25 files with no trailing newline. `FIELD_ORDER` is applied only to
  the kernel splice, never the JSON, and has itself rotted (2 dead entries,
  11 live keys missing).
- **Expressiveness gap**: the kernel uses **289 distinct anchor paths; specs use
  184 — 105 are unauthorable.** Biggest: the entire music-mind layer (`pipes[]`,
  `theory.tables`), whose only escape hatch is `MIND_OVERRIDES`, a JS literal
  in the kernel — 22 entries, 20 of them genres with no spec. Also
  `timeFeel.pushPullMs` (35 genres), the vocal layer, `snarePP`, `transforms`,
  and `PERC_STYLES` (52 percussion styles keyed by genre name, not an anchor key
  at all).

**A genre is currently seven things** — anchor, mind override, verifier target
row, star position, percussion style, name/blurb, invention provenance. The spec
describes one and a half of them, for half the genres, one-way.

**The one fix that unlocks the rest:** add `genre-tool.js export <genre>|--all`
— serialize a live anchor *back* to spec JSON; teach it `mind`/`perc`/`targets`/
`pos`; run it over all 274; gate in `verify.sh` that every genre has a spec and
every spec round-trips. That turns 135 stale receipts into 274 true files and
makes the format bidirectional. Then one formatter pass gives one formatting.

**E3. The ⓘ view does not read the spec — confirmed, with evidence.**
`app/inside.js` makes exactly five kernel reads and **none touch `.anchor`**:
`label`, `info` (dominant genre only), and `SAMPLERS[].label`. Everything else
is `S.playing` scalars, a re-simulated bar of `buildEvents`, an audio audit, and
**six hard-coded prose tables inside `inside.js`** (`VOICE_CHAR`, `KIT_CHAR`,
`BED_CHAR`…). `progressions` — authored in **135 of 135** specs — never appears
in the readout. Nor do `form`, `fills`, `found.role` (the view *infers* bed vs
chop from event shape), `hits.pattern`, `stab`, `euclid`, `timeFeel.pushPull`.
Decide deliberately: either the ⓘ view starts reading the anchor, or we stop
pretending the spec drives it.

**E4. Descriptions — the floridness is one repeated tic.** Genre prose lives in
`GENRES[].info`, not the specs. **212 of 274 end with an em-dash punchline**;
227 have a colon in the first 45 chars; 241 are lower-case fragments. Three
incompatible voices coexist (poetic fragment / `"X as a genre:"` / `Influences:`
appendix). Median 173 chars. House style: plain declarative sentences, tempo and
instrumentation first, no punchline. Example —

> **before:** `…the building dances and nobody remembers who pressed start`
> **after:** `Machine four-on-the-floor at 128-140. Drone chords that never
> reharmonize, long DJ plateaus instead of verses and choruses.`

### Stage F — docs, README, HTML prose (last)

**The count drift is worse than it looks.** `docs/MUSIC-MIND.md` says 274 in
three places and 249 in five — *in the same file*. `CONTRIBUTING.md` says 274 at
`:48` and 249 at `:76`.

**Must fix (public-facing, wrong on arrival):**
1. **`.github/PULL_REQUEST_TEMPLATE.md:15`** tells every contributor to confirm
   `diagonal dominant: 178/178` — a number that will never print, and the first
   thing an outside contributor sees. → `274/274`.
2. `CONTRIBUTING.md:76` `249/249` → `274/274`; `:122` `index.html:59-80` →
   `index.html:141-159`.
3. **`README.md:104` and `robots.txt:9` publish `github.com/aboard-io/stellate`,
   but the repo is PRIVATE** (`gh repo view` → `isPrivate: true`). Flip it
   public or drop the URLs. **Needs Paul's decision** — see also the open
   verifier-catalog-public question.
4. `docs/STARCRUISE.md:16` — "Status: SCAFFOLD… stubs" against **7,282 lines**
   of shipped code.
5. `README.md:140-142` — "gates live in `test/*-test*.js`"; there are 11 of
   those and **43 `*-run.js`**.

**Mechanical sweep** (`249`→`274`, `102`→`127`): `docs/ARCHITECTURE.md:42,89,90,102`
(its load-order block at `:112-119` is *also* wrong — omits `midi-export.js`,
`speech.js`, `analytics.js`, `count.js`) · `INVARIANTS.md:36,144,148,150,181` ·
`GENRE-SPACE.md:38,52,145` · `ADDING-A-GENRE.md:7,14,26` ·
`GENRE-SPEC-SCHEMA.md:7,40,130` (also documents `voxClean`/`realHats`, which
`validateSpec` now **rejects**) · `MUSIC-MIND.md`. **Derive the count at
doc-build time so this never recurs.**

**`verify.sh`'s own header is stale**: `:5-8` lists 4 suites, the body forks
**9**; `:16` says the cache is in `scratch/.verify-cache/`, it's actually
`engine/scratch/.verify-cache/`.

**Preserve verbatim — legally load-bearing:** `SOURCES.md:1-31` (the three
license tiers, cited normatively by CONTRIBUTING/README/NOTICE/SETUP) and every
per-item table row. The removed video layer's rows at `:324` and `:695` are
**tier-3 unlicensed** material and the ledger is the record that we hold
obligations on it — **do not delete**; add a dated "layer removed, ledger
retained" header. `NOTICE` verified correct in every particular (cart counts,
three.js r160, simplex-noise 4.0.3, the GPL-3.0 espeak carve-out that makes the
served app a combined work). `LICENSE` fine.

**`serve.sh` stays** — it sends COOP/COEP, without which the SAB ring engine
cannot boot; `python3 -m http.server` does not. Referenced by four docs.

**`.github/` is minimal and correct** — two files, no unused workflows, CI green
on every push. Add `SECURITY.md` for 1.0 (we already publish `security.txt`).
One nit: `verify.yml:3` says stand-ins take "~4s, ~86MB", CLAUDE.md and README
say "~1s".

**`sitemap.xml` is hand-maintained** — 20 frozen `?genre=` deep links with
hardcoded seeds, no `/stats` entry. Either generate it in `gen-feed.js` or add a
comment saying it's a curated sample.

**Then rewrite `README.md`** from what's true after all of the above, and the
prose in `index.html` / `how.html` / `access.html` / `colophon.html` with it.
`how.html`'s numbers need an explicit check — `CLAUDE.md:199` requires its stage
narrative to track engine reality, and the 249→274 drift is everywhere else.

---

## Vendor preact + htm locally (kill the last runtime CDN)

**Reported 2026-07-27 (Paul), Safari console:**

```
[Error] Cancelled load to https://esm.sh/preact@10.19.3/es2022/preact.mjs.map
        because it violates the resource's Cross-Origin-Resource-Policy response header.
[Error] Cannot load https://esm.sh/htm@3.1.1/es2022/htm.mjs.map due to access control checks.
[Error] Source Map loading errors (x2)
```

The source-map errors are the symptom. The disease is that
**`app/state.js:5-6` imports preact and htm from `esm.sh` at runtime** —

```js
import { h, render } from "https://esm.sh/preact@10.19.3";
import htm from "https://esm.sh/htm@3.1.1";
```

This is the **only** remaining third-party runtime dependency. Everything else
is already vendored (`vendor/three`, `vendor/simplex-noise`, `vendor/espeak-ng`,
`vendor/microw8`, `vendor/goatcounter`), each with a `VERSION.txt`, a license
file, and a `NOTICE` paragraph. preact/htm are the odd ones out —
`colophon.html:289` even says so out loud: *"loaded from a CDN, not…"*.

Four reasons this must go before 1.0, beyond the console noise:

1. **The PWA cannot work offline.** `sw.js:44` passes cross-origin requests
   straight through and never caches them. So the service worker can cache the
   entire app and all its media, and the app still won't boot without a live
   connection to `esm.sh`.
2. **Availability.** A third-party CDN outage takes the whole instrument down —
   `state.js` is imported by every entry point except starcruise.
3. **Privacy.** `esm.sh` sees an request from every visitor. The project's own
   posture (`.well-known/security.txt`) is "no accounts, no cookies, no user
   data" — an uncontrolled third-party fetch undercuts that claim.
4. **COEP.** The page is `require-corp` (`docs/HOSTING.md:31-40`); esm.sh does
   not send `Cross-Origin-Resource-Policy`, which is exactly what Safari is
   reporting. Same root cause as the Google Fonts problem noted in the LOFO plan
   above — **fix both together**, and the CSP/COEP posture gets simpler.

**Do:**
- Add `vendor/preact/` and `vendor/htm/` following the existing pattern exactly:
  the ES module build, a `VERSION.txt` recording the exact version
  (preact 10.19.3, htm 3.1.1), the upstream LICENSE file, and a `NOTICE`
  paragraph (preact MIT, htm Apache-2.0).
- Point `app/state.js:5-6` at the local paths.
- Ship the `.map` files locally too, or omit them deliberately — either way the
  console goes quiet, because a same-origin map is not a CORP violation.
- Update `colophon.html:289` — it currently advertises the CDN as a fact about
  the project.
- **Bonus simplification:** `app/starcruise.js:36-37,46` documents that it
  deliberately avoids importing `state.js`/`share.js` *specifically* to stay off
  the esm.sh module graph. Once preact is local that constraint evaporates, and
  the starcruise↔app `window.__` seam can be reconsidered (see the reorg plan's
  Stage D) — though the Three.js-off-the-boot-path reason still stands.

**Test:** `node test/explorer-ui-test.js` and `node test/boot-smoke.js`; then
load the page with the network throttled to offline after a warm cache and
confirm it still boots — which it cannot do today.

---

## Region watermarks should wear the alien alphabet

**Asked 2026-07-27 (Paul):** *"the background galaxy text ('Escalator Eschaton')
should also be suffused with glyphs."*

The big faint territory names washed behind the star map — `REGION_NAMES` at
`app/starmap.js:652-654` ("The Sleeping Instrument", "Escalator Eschaton",
"The Anvil Singularity", …) — are drawn **raw** at `app/starmap.js:90`
(`t.textContent=rg.label`). Genre labels already go through `alienize()`
(`app/starmap.js:117`, `app/glyphs.js:228`); region labels were missed.

**Do:** run region labels through `alienize()` at the draw site, same as
`glabel`. Use `alienize()` **as it stands** — Paul 2026-07-27: *"alienize() is
fine"*. No density argument, no fork: the existing 1-2 homoglyph swaps per name
are the look. One-line change at the draw site.

**Keep plain:** the `window.__REGIONS` debug hook (`app/starmap.js:695-696`)
feeds the headless gates — it must keep emitting **real** labels, exactly like
the `PLAIN` inverse map exists so gates can match drawn genre labels back
(`app/glyphs.js:258+`). Alienize at draw time only, never in the data.

**Test:** `node test/explorer-ui-test.js` (it measures `.region` watermark
rects at `test/explorer-ui-test.js:171`), plus eyeball at zoom-out where the
region names are largest.
