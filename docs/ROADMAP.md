# ROADMAP — the plan for what's next (for Opus to implement)

*Authored 2026-07-11 (Fable capstone session) from a fan-out analysis of the whole
system. This is the forward plan; `docs/NEXT.md` is the short live backlog and now
points here. Read `CLAUDE.md` and `docs/GENRE-SPACE.md` for context first.*

**How to use this doc.** Six workstreams, each self-contained. Workstream 1 (the
genre-intelligence layer) is the marquee — it is where the system is most
under-exploiting what it already computes. Every task names real files, an effort
size (S/M/L/XL), and how it is tested. The **Guardrails** section at the bottom is
non-negotiable law; re-read it before any task.

**Ground truth (verified at runtime this session, correct the docs to match):**
- **249 anchors.** `Object.keys(GENRES).length === Object.keys(TARGETS).length === 249`
  (`engine/genre-kernel.js`, `engine/genre-verifier.js`). The matrix prints
  `diagonal dominant: 249/249`. Docs saying **228** or **240** are all stale.
- The tree is clean; `HEAD == main == origin/main`. Most of NEXT.md's old A–F queue
  is already shipped (see Workstream 6).

---

## Backlog reconciliation (what is actually done vs. open)

NEXT.md's "THE QUEUE" was written at an old commit and is badly stale. Cross-checked
against `git log` + code:

| Item | Real status | Note |
|---|---|---|
| A.1 scratch DSP | **shipped** (f1c9a14/db5dba5) | taste-gated on Paul's ears only |
| A.2 granular repitch | **shipped** (f583c5b) | `recipe granular:<st>` in state-engine |
| A.3 dry granular insert + Faust-fun sweep | **open** | the only unbuilt part of A; low value |
| B synth fonts DX7/MiniMoog | **shipped** (993e33b) | droplet-deploy unconfirmed from this box |
| C.1 Vapor slider | **shipped** (45057a0) | live-only EQ, byte-safe |
| C.2 settings visual cleanup | **open** | no commit; small front-end pass |
| D.1 register-aware voicing | **shipped** (a13703e), taste-gated | verify it covers *all* voices, not just samplers (spec asked for all) |
| D.2 harmonic richness | **partial** (2d8dcdc), taste-gated | applied dominants only; borrowed/chromatic-mediant + 9/11/13 extensions still open → track as **D.3** |
| E offline video (ffmpeg.wasm) | **open** (the big build) | only a realtime MediaRecorder webm v1 shipped; the offline mux is untouched |
| F.1 iOS pinch | **blocked** | needs a real device |
| F.2 reedrush kick | **shipped** best-guess, ear-gated | |
| F.3 async audio export walk | **shipped** (19f44d1) | residual: `loopBars` still caps at 2048 |
| LFB live-feedback backlog | **in progress** | intl genres, GM variety (done), per-genre descriptions, node coloring, sample sourcing — where recent momentum actually went |

**Genuinely open work:** A.3, C.2, **D.3** (harmonic extensions), **E** (offline video),
F.1/F.2 confirmations, the LFB items — plus the two new programs this plan adds
(Workstream 1 genre-intelligence, Workstream 3 modularization).

---

## Workstream 1 — The genre-intelligence layer (MARQUEE)

**The finding.** The "genre as a point in multidimensional space" framing is realized
as *combinatorial typed mixing*, not vector math: a genre is a bundle of ~25 typed
dimensions (scalar ranges, enum pools, recipe bundles) stored as an object literal in
`GENRES`. There is **no single numeric embedding** and `blend()` never computes a
genre-to-genre distance.

**But two real coordinate systems already exist and are thrown away:**
1. **The verifier's 23-feature vector** (`genre-verifier.js features()`) is a genuine,
   measured, *proven-separable* embedding — `validate-genres.js gateGeometry()`
   z-scores it, builds per-genre centroids, and confirms every point sits nearest its
   own centroid. That geometry is computed once per validate run and **discarded**;
   only a raw feature cache persists in `scratch/.verify-cache`.
2. **The 249×249 confusion matrix** (`genre-verifier.js matrix`) is a full asymmetric
   affinity matrix in the *shipped* scoring metric — and it is read only as a
   diagonal-dominance pass/fail. It is never used to recommend blends, order
   playlists, cluster the catalog, or lay out the map.

Meanwhile the navigable 2D map (`app/world.js` POS) is a **baked hand-relaxed layout
disconnected from the feature geometry**, and there are three un-unified notions of
"genre distance" (screen POS, `_genreSim` Jaccard in `app/starmap.js`, confusion
scores). The opportunity is to build a **read-only analysis + search layer** on the
already-deterministic primitives.

### Design principles (guardrails specific to this workstream)
- **Everything here is offline, read-only tooling** over the existing deterministic
  pipeline (`K.mix`/`V.features`/the feature cache). It never touches the render path,
  so byte-identity is preserved for free. Keep it that way.
- **Honesty about reachability.** Blends are forward-only stochastic parent-picks that
  interpolate *within the catalog's material*. A feature target far from all anchors is
  generally **unreachable** by any blend. So:
  - The search solver returns **"nearest reachable point + residual,"** never "the
    point you asked for."
  - "Empty region" tooling is **diagnostic only** (report the gaps). Auto-*synthesizing*
    a new anchor spec from an empty feature point is **infeasible** — the 23-D space is
    a measured render *output* with no inverse, and filling a true gap needs
    hand-authored new vocabulary (samples/kits/recipes). Do not promise a self-extending
    atlas.
- **`resolveMulti` accepts only existing genre names**, filters `GENRES[x.g] && x.w>0`,
  renormalizes, and has **no negative weights and no inline-spec path.** Any tool that
  wants to render a mutated/novel point must splice it into the global `GENRES` object,
  run `deriveMind` on it, render, then **restore `GENRES` exactly** (key order included)
  — the cleanup contract is the one place these tools could threaten byte-identity.
- **Mine the confusion matrix first.** For neighbors/families/near-duplicate/layout,
  the existing 249×249 affinity matrix is cheaper and more faithful (it *is* the shipped
  metric) than re-deriving Euclidean centroids. Persist it once per verify run.

### Libraries — what to pull in, and (mostly) what not to
The "genre is an embedding" framing invites reaching for vector libraries. Resist most
of it. The embedding is **249 points × 23 dims** — brute-force pairwise is instant and
exact, so a vector DB / ANN index (faiss, hnswlib, pgvector) is 3–4 orders of magnitude
of overkill. And you already *have* the metric: importing a generic cosine/Euclidean lib
for relational tasks just adds a **fourth** un-unified distance that disagrees with the
one users hear — the simplification is to persist and read the **confusion matrix**,
which no library provides. The trivial ops (z-score, centroid, distance, kNN) are 5–15
lines each and half-written already in `gateGeometry`; a library there is negative value.

A library earns its place for exactly two tasks, both offline and node-only:
- **2D sound-space layout** (PCA/MDS of centroids) → `ml-pca` + `ml-matrix` (deterministic
  SVD — stable numerics are the one annoying bit to hand-roll).
- **Sonic-family clustering** → `ml-kmeans` / `ml-hclust`.
- Non-linear layout (`umap-js`/`druid`) is optional and **only** as a one-time, seeded,
  checked-in artifact — never inside a gate.

Rules: these go in a **new `tools/package.json`** (node-only) next to the CLI tools —
**never** in `index.html` (the browser bundle stays zero-dependency, plain-script,
self-contained UMD — there is deliberately no root `package.json`). Anything whose output
is committed (the `POS` layout, the margin baseline) or gates a build must be
**reproducible**: deterministic SVD/agglomerative clustering are fine in gates; stochastic
UMAP/t-SNE/random-init k-means only for frozen one-time artifacts. **Do not** use a hosted
embedding API (breaks the offline/deterministic/zero-network posture) or replace the
symbolic 23-feature extractor with a learned/neural audio embedding — that destroys the
determinism and the human-readable, falsifiable "does this sound like jungle" gate that is
the entire point of the verifier. The symbolic features are a feature, not a limitation.

### STATUS (2026-07-11) — Phases 1.1–1.2 landed + gated GREEN; 1.3–1.4 offline tools landed
The offline genre-intelligence layer was built this session and is in the working tree
(uncommitted). **All of it is offline, read-only, and byte-safe** — proven by the render
guards, which stayed clean after the work: `verify.sh` GREEN (matrix + validate + engine +
prove + matproof), `matrix` prints **diagonal dominant: 249/249**, `node test/fixtures.js`
= 3726 hashes byte-stable (zero drift), `node test/segment-parity-test.js` = ALL byte-equal.
The five new static checks are **wired into `validate-genres.js` as advisory WARN gates
9–13** (`gateAdvisory`, never folded into `hardFail`, degrade to SKIP if a module is
missing/throws), so they run every verify without ever failing the build:
- gate 9 near-duplicate, gate 10 margin sentinel, gate 11 resolveMulti determinism fuzz,
  gate 12 feature-level blend monotonicity, gate 13 dead-axis variance.

**Still remaining (explicitly deferred):** committing the batch; the app-UI wiring of the
1.4 payoff tools (the `app/starmap.js` layout toggle + explorer neighbors hover — app
front-end, held); taste-gated tuning of any surfaced WARNs (Paul's ears). The offline CLI
tools below all exist and ship with a `test/*-run.js`; the marks are file-landed, not yet
human-taste-reviewed.

### Phase 1.1 — Foundation (expose the primitives) · effort S–M
1. **[DONE]** **Persist the confusion matrix.** `genre-verifier.js matrix` writes
   `scratch/.verify-cache/matrix.json` (verifier ~967). *(S)*
2. **[DONE]** **A shared node-safe geometry lib** `engine/genre-geometry.js`: reads the
   feature cache, z-scores, builds centroids, exposes `centroids()`, `dist(a,b)`,
   `nearest(g,k)`, `matrix()`. The gates + all new tools call this one implementation
   (validate `gateGeometry` unchanged; `test/genre-geometry-run.js`). *(M)*
3. **[DONE]** **Extract `_genreSim`** into node-safe `engine/genre-sim.js` so CLI tools
   share anchor-Jaccard similarity. *(S)*

### Phase 1.2 — Smarter static testing (highest ROI, lowest risk) · effort S–M each
These automate the manual tuning the TARGETS comment history does by hand thousands of
times. All are offline gates/tools; none touch renders.
1. **[DONE]** **`tools/target-lint.js` — TARGET-range linter.** For each genre compare
   `V.TARGETS[g]` `[lo,hi]` to the genre's *actual* measured min/max over seeds (reuse
   the persisted feature cache). Flag (a) ranges that **exclude the genre's own renders**
   and (b) ranges with **rival-admitting slack** beyond the genre's own spread. Emit
   suggested tightened bounds. *(M)* This is the single most-repeated move in the whole
   TARGETS history. **test:** known-good fixture yields zero (a)-flags; applying a
   suggestion keeps the matrix diagonal-dominant.
2. **[DONE — gate 9]** **Near-duplicate detector** (`engine/checks/near-duplicate.js`, wired WARN). Pairwise centroid distances (or confusion-matrix
   affinity); warn on any pair under threshold *before* it becomes a matrix tie. Add as a
   WARN in `validate-genres.js`. *(S)* **test:** historically-fixed near-pairs top the list.
3. **[DONE — gate 10]** **Fragile-margin sentinel** (`engine/checks/margin-sentinel.js` + committed `test/margin-baseline.json`, `--update-baseline`, wired WARN). `validate-genres.js` gate 3 already computes per-genre
   self-minus-rival margins (`result.gates.margin.margins`). Commit a baseline
   `test/margin-baseline.json`; fail when any margin regresses beyond a delta even while
   still 249/249. Add an `--update-baseline` flag mirroring `fixtures.js capture`. *(S)*
4. **[DONE — gate 11]** **`resolveMulti` determinism fuzz** (`engine/checks/determinism-fuzz.js`, seed-fixed N-way battery, wired WARN). Extend `gateDeterminism` with a seed-fixed
   battery of random N-way weight vectors, asserting byte-identical state across two
   calls. The live explorer drives arbitrary N-way blends that anchor-only gates never
   exercise. *(S)*
5. **[DONE — gate 12]** **Property-based blend monotonicity** (`engine/checks/blend-monotonicity.js`, feature-level envelope check, wired WARN). Generalize gate 5 (`computeBlend`, 6 hardcoded
   pairs, scores only) to randomized seed-fixed anchor pairs asserting every
   direction-agreeing *feature* stays between the endpoints (±tol) at every `t`. Catches
   scalar-overshoot lerp bugs score-checks miss. *(M)*
6. **[DONE]** **Confusion-leak attribution** (`scoreRow(...,{contributions:true})` + `tools/leak-attribution.js`). `scoreRow` already computes `w*s` per feature
   (verifier:859–869); return the per-key contributions (backward-compatible). For a
   confused pair, rank features by contribution and suggest the one fence that best breaks
   the tie — the machine version of the TARGETS comment corpus. *(M, S for the enabler)*
7. **[DONE — gate 13]** **Dead-axis / redundancy PCA** (`tools/feature-pca.js` + `engine/checks/dead-axis.js` wired WARN). `tools/feature-pca.js` over the cached feature matrix:
   per-feature variance (dead axes = wasted capacity or silently-broken feature),
   correlation (redundant axes), top PCA components. Wire a dead-dimension WARN into
   `validate-genres.js`. *(M)* **test:** zero a feature across states → the gate flags it.

### Phase 1.3 — Creative search (the keystone) · effort M–L
1. **[DONE — offline]** **`tools/target-blend.js` — nearest-reachable blend solver (KEYSTONE)** (returns weights + achieved scores + residual; `test/target-blend-run.js`). Given a
   desired score profile (e.g. jungle 0.8 / gospel 0.2) or a 23-feature target, hill-climb
   the weight simplex minimizing distance between `V.analyze(K.mix(weights,{seed})).scores`
   (or `V.features`) and the request; seed from the nearest centroid; return best weights +
   **achieved scores + residual**. Pure offline read of `GENRES`; no state mutation. *(M)*
   Half the marquee asks reduce to this one primitive with different objectives.
   **test:** round-trip (request an anchor's own profile → solver returns weights scoring it
   highest); determinism per seed; objective decreases monotonically.
2. **[DONE — offline]** **Genre arithmetic** `tools/genre-math.js` (`jazz - swing + fouronfloor`). Compute the
   target in z-scored centroid space, feed it to `target-blend`, report `V.analyze` top
   scores. **Frame honestly as nearest-reachable + residual** — no negative weights, no
   extrapolation beyond the blend hull. *(M)* **test:** `A - x + x ≈ A`; out-of-hull
   expressions must report a large residual, not silently snap.
3. **[DONE — offline]** **Surprise-me / maximally-distinct blend** (`tools/surprise.js`). New objective in `target-blend`: maximize
   min-distance-to-centroids subject to a `musicality.auditAll` floor; or pick the parent
   pair with max centroid distance whose midpoint still passes the audit. *(M)*
4. **[DONE — offline, diagnostic]** **Empty-region *diagnosis*** `tools/empty-space.js`: sample many random blends, report
   the emptiest *reachable* cells + neighbors. **Diagnostic only** (see design principles).
   *(M)* Pair with a **reachable-envelope tool** that bounds per-feature achievable ranges
   so the tool can label a request "reachable-but-unpopulated" vs "needs new vocabulary."
5. **[DONE — offline]** **Mutation / breeder** `tools/mutate.js`: perturb one declared dimension, render, run
   `V.analyze` + `musicality.auditAll` + margin check. Requires the temp-anchor
   splice+restore contract (see guardrails). *(L)* **test:** zero perturbation →
   byte-identical track (the determinism guard).

### Phase 1.4 — User-facing payoff · effort S–L
1. **[PARTIAL — tool DONE, app toggle deferred]** **Sound-space map layout** `tools/feature-layout.js` emits the POS table (`test/feature-layout-run.js`); the `app/starmap.js` layout toggle is the deferred app-UI half. Project
   the measured centroids (or, better, the confusion-affinity matrix) to 2D via
   power-iteration PCA or double-centered MDS; emit a POS-shaped table; add it as a
   *toggle* layout source in `app/starmap.js` beside `computeGenreLayout`, reusing the
   existing label relaxation. Makes the map honest (distance = how genres actually
   *sound*). *(L)* **test:** byte-identical POS across runs (pin the sign convention);
   2D nearest-neighbors rank-correlate with 23-D nearest centroids.
2. **[PARTIAL — CLI DONE, hover deferred]** **Genres-adjacent-to-X** (CLI `tools/neighbors.js` DONE; the explorer hover affordance is deferred app-UI). Was: `genre-kernel.js neighbors <g>` + a hover affordance in
   the explorer) using `_genreSim` and/or centroid distance. *(S)*
3. **[DONE — offline]** **Genome-diff card** `tools/genome-diff.js`: declared-side set-diff over `GENRES[a]`
   vs `[b]` (use `state.genreMeta`, the resolved-choice record `toState` already writes)
   + measured feature deltas sorted by magnitude. The static companion to A→B journeys.
   *(S)*
4. **[DONE — offline]** **Interpolation-lesson annotator** (`tools/lesson.js`): along `blend(a,b,t)` detect which dimension flips
   at which `t`; emit a narrated timeline. **Reuse the shipped `journey()`/`lerpWeights`**
   path (it already takes `{weights}` points with novelty-reroll discipline) rather than a
   fresh one-off. *(M)*
5. **[DONE — offline]** **Coverage dashboard** `tools/coverage.js`: per-axis occupancy + empty cells over key
   feature *pairs* (bpm×swing, sub×wash, motion×seventh) → feeds the empty-region tool and
   a `how.html` story. *(M)*
6. **[DONE — offline]** **Cross-metric reconciliation audit** (`tools/cross-metric-audit.js`): correlate the three
   distances (POS, `_genreSim`, confusion) and report the biggest disagreements — genres
   adjacent on the map but far in sound, or confusion-rivals placed far apart. Directly
   serves "make the map honest." *(S)*

**Suggested order:** 1.1 → target-lint + the four cheap gates (1.2) → target-blend (1.3.1)
→ sound-space layout + neighbors + genome-diff (1.4) → the rest.

> **[DONE 2026-07-11]** 1.1 foundation + all 1.2 gates + the 1.3/1.4 offline CLI tools are
> built, in-tree (uncommitted), offline + byte-safe, and gated GREEN (see STATUS block
> above). Remaining: commit the batch; the two 1.4 app-UI halves (starmap layout toggle,
> explorer neighbors hover); `docs/GENRE-VECTORS.md`; taste review of surfaced WARNs.

---

## Workstream 2 — Video export: harden the live path, then build the offline path

Two paths: the **shipped** realtime browser capture (`app/video-export.js`,
MediaRecorder → webm) and the **planned** offline whole-loop render (NEXT.md item E,
ffmpeg.wasm). The realtime fix (53c5198) is sound for the desktop-foreground case but
has concrete gaps. Fix these **before** the big E build.

### 2.1 — Correctness fixes (do first)
1. **HIGH — silent canvas taint on cross-origin clips.** `VideoLayer.candidates()`
   (`engine/video-layer.js:959`) still emits remote archive.org sources, and `<video>`
   elements have no `crossOrigin`, so `cx.drawImage(vel,…)` (`app/video-export.js:79`)
   **silently taints the canvas without throwing** — the surrounding try/catch never
   fires, and `captureStream` then yields the exact broken/near-static webm the fix was
   meant to kill. The header comment claiming taint "is caught and skipped" is **false**.
   **Fix:** restrict the export take to **local candidates only** (expose
   `candidate.kind`, skip `drawImage` unless local), and/or probe taint via a 1×1
   `getImageData` after the first draw and drop the video layer if it throws. Fix the
   comment. *(M)*
2. **HIGH — background-tab throttling.** The claim that `setInterval`-driven
   `captureStream(0)`+`requestFrame` is "immune to throttling" is wrong: hidden tabs clamp
   `setInterval` to ≥1s **and** `DemoLayer` stops its RAF on `visibilitychange`
   (`engine/demo-layer.js:350`). Backgrounding mid-take → ~1fps frozen video. **Fix:**
   drive compositing from an OffscreenCanvas in a worker, or refuse/pause recording when
   `document.hidden` with an explicit "keep this tab foreground" warning. Drop the false
   comment. *(M)*
3. **HIGH — no iOS/mobile guard.** `canvas.captureStream`/`requestFrame` are
   unsupported/partial on iOS, and the mobile audio route is a real `<audio>` element (no
   live-graph `msDest`), so `recordVideo()` fails or emits a broken/silent blob. **Fix:**
   feature-detect (`typeof HTMLCanvasElement.prototype.captureStream === 'function'` +
   a working audio track) and disable/hide ⏺ on unsupported devices with a clear message.
   *(S)*
4. **MEDIUM — container/extension mismatch.** `pickMime()` may return `video/mp4`
   (Safari) but the download is hard-coded `.webm` and the Blob defaults to
   `video/webm`. **Fix:** derive extension + Blob type from `rec.mimeType`. *(S)*

### 2.2 — Robustness / smaller fixes
5. **MEDIUM — unbounded chunk buffering.** All slices held in `chunks[]` for the whole
   10-min-capped take → OOM risk; the "hour of video" ambition is unreachable here.
   **Fix:** stream via File System Access API (`showSaveFilePicker` writable), or lower
   the cap on constrained devices; reserve hour-scale for the server-side node render. *(M)*
6. **MEDIUM — video is non-deterministic per seed** (Math.random bursts/clip offsets,
   timing jitter) — unlike the byte-identical audio law, and unlike the node offline path
   which *is* seeded. **Fix:** document that browser capture is a live performance, not a
   reproducible render; give the offline path a seeded RNG so video matches audio's
   guarantee. *(S doc / part of E)*
7. **LOW** — wrap the `captureStream` setup in try/catch that calls `cleanup()` (or it
   leaks the hidden canvas + leaves layers force-enabled); disconnect the desktop audio
   tap (`live.js` `_capDest`) on cleanup; possible A/V drift on long main-thread takes.

### 2.3 — Test hardening (this is how the 1-frame regression shipped green)
8. **MEDIUM — the CI probe skips all assertions when MediaRecorder is absent** (headless),
   so this path is effectively unguarded. **Fix:** run `test/video-export-probe.js` in a
   headful-capable Chromium and **hard-fail** if MediaRecorder is missing; add a **taint
   regression case** (composite a cross-origin clip, assert the exporter degrades to a
   non-empty, non-static, demo-only file); assert container/extension match. *(M)*

### 2.4 — The offline path (NEXT.md item E, the largest build) · effort XL, multi-session
Frame-step `DemoLayer.renderFrame(dt)` off the clock (de-risked — it is steppable) +
deterministic local clip seeks + composite per frame → faster-than-realtime capture →
**ffmpeg.wasm** mux with the whole-loop WAV. **Before committing to ffmpeg.wasm, resolve
these:**
- **SharedArrayBuffer needs COOP/COEP cross-origin isolation**, which the site does not
  set — and enabling it **breaks the cross-origin archive.org `<video>` streams**. Scope
  any header change so it doesn't break streaming (or go local-clip-only under isolation).
- **x264/mp4 ffmpeg.wasm builds are GPL**; distributing muxed mp4 imposes GPL on the
  combined work. Prefer an **LGPL VP9/webm-only build**, and do x264/mp4 muxing
  **server-side** in the existing `tools/render-sample-video.js` (node + ffmpeg) pipeline.
- **Vendor** ffmpeg.wasm (~30MB) rather than CDN-fetch (availability + perf).
See `docs/HOSTING.md` (COOP/COEP) and `SOURCES.md` (distributed-artifact media tiers).

---

## Workstream 3 — Modularize for many contributors

**Constraints (hard):** renders stay **byte-identical** (fixtures + `segment-parity`
gate) and `index.html` loads `engine/*.js` + `app/*.js` as **plain, ordered `<script>`**
(no bundler). `app/` is already well-modularized (ES modules, `main.js` = 74 lines) — it
is the model. `engine/` is classic IIFE globals in 9 ordered script tags; the **one true
monolith is `engine/genre-kernel.js` (940KB; 63% is the inlined `GENRES` literal**,
lines 1664–6388).

### 3.1 — Quick wins (do-now, low risk) · effort S each
1. **[DONE]** **`docs/KERNEL-MAP.md`** — publish the existing section-header line numbers of
   `genre-kernel.js` as a clickable index (registries :30/:265/:675, GENRES :1664, blend
   :6643, forms :7156, macros :7786, choice→state :7908, CLI :8444). Instantly navigable.
2. **[DONE]** **`tools/render-diff.sh <state.json>`** (+ `tools/render-diff-harness.js`) — render on HEAD vs a ref/stash and report
   BYTE-EQUAL / drift. Turns the scariest invariant into a one-command green check for
   nervous contributors.
3. **[REMAINING]** **Fix the `NODE_PATH` clean-clone blocker.** The browser test battery hard-codes
   `NODE_PATH=/home/ford/ftrain-2025/node_modules` (NEXT.md:115, `test/*`), so half the
   gates are un-runnable on a fresh clone. Add a local `test/package.json` (or reuse
   `engine/faust/node_modules`), drop the absolute path, document it.
4. **[DONE — boot smoke landed as `test/boot-smoke.js`; CONTRIBUTING section updated]** **CONTRIBUTING.md: an "engine load order & the global namespace" section** (the rules
   live only in `index.html` comments today) + a headless **boot smoke-test** asserting
   each global (`CsdEngine`, `GenreKernel`, `CsdTheory`, …) exists after load.
5. **`genre-tool.js init <name>`** scaffolder (clone the nearest genre's spec) + a "your
   first genre in 5 commands" recipe using the 102 existing `genre-specs/*.json` as
   templates.

### 3.2 — The data/code split (byte-safe, sequenced) · effort M–L
**Do it as a source split with a trivial concat, NOT a runtime JSON load.** A runtime
`fetch('genres.json')` is async (the kernel reads `GENRES` synchronously at module-eval,
and `deriveMind` runs over every anchor at load), and `JSON.parse` can re-serialize
floats differently (`-0`, precision) — either would risk byte drift. Keep the served
artifact a plain evaluated script; move the *editing surface* only.

Sequence lowest-risk first (each PR's acceptance test = render N states on `main` vs the
branch, require **BYTE-EQUAL**):
1. **Pure-data, offline-only literals first** (zero render-path risk, proves the seam):
   split `genre-verifier.js` `TARGETS` (:162) into `verify/targets.js`; split kernel
   registries (`SAMPLES`/`SOURCES`/`SAMPLERS`/`DX7_PATCHES`/kits) into
   `engine/kernel/registries/*.js`. *(M)*
2. **The big win — split the `GENRES` literal into per-family fragments**
   (`engine/kernel/genres/electronic.js`, `ambient.js`, `acoustic.js`, …), each a plain
   `<script>` that runs after the kernel and calls `GenreKernel._addAnchors({...})`.
   Generate the fragments from the *current literal by verbatim byte-range copy* (not
   re-serialized through JSON) so evaluated objects are identical. Update
   `genre-tool.js`'s splice to target the family fragment (same marker mechanism, smaller
   file). *(M, reversible — concat back if it drifts)*
3. **Split the kernel *logic*** (blend / forms / macros / choice→state / Node-only CLI)
   into `engine/kernel/*.js`, replacing the one script tag with the ordered set (or a
   commit-time `tools/build-kernel.js` concat run in `verify.sh`). *(L)*
4. **Later, if wanted:** `csd-engine.js` vocabulary tables, `faust/live.js`
   (scheduler/master-chain/voice-lane), `faust/state-engine.js` (tables vs mapping),
   `app/starmap.js` (layout/zoom/waypoints). All large-but-coherent; split with the same
   byte-equal gate. *(L each)*

**Do NOT** convert `engine/` to ES modules (CONTRIBUTING.md standing rule) and **do NOT**
move `app/*.js` or `engine/*.js` file locations — they're pinned in `index.html`,
`sw.js`'s cache regex, and the deploy smoke test; blast radius is high, gain is zero.

---

## Workstream 4 — Docs

### 4.1 — [DONE] Fix the pervasive count drift (safe, mechanical) — **228/240 → 249**
> Live-count docs updated (README/CLAUDE/CONTRIBUTING/GENRE-SPACE/MUSIC-MIND/INVARIANTS/NEXT).
> `docs/MUSICALITY.md`'s `228` figures are point-in-time audit-log records, left as history.
`README.md` (×2), `CLAUDE.md` (line 3, 119), `CONTRIBUTING.md` (44–47, 70),
`docs/GENRE-SPACE.md` (38, 52, 145), `docs/MUSICALITY.md`, `docs/MUSIC-MIND.md` (12, 94,
159), `docs/INVARIANTS.md` (36, 144–150, 181 — also re-derive `228×227/2` → `249×248/2`),
`docs/NEXT.md:117` (`240/240` → `249/249`). **Recommendation:** make the anchor count a
single computed value (or a generated snippet) to stop the recurring drift. *Leave
`docs/history/*` counts alone — they are point-in-time records.*

### 4.2 — [DONE] Fix stale claims
> EXPORT.md/GENRE-SPACE.md updated; FAUST-PORT.md + MATERIALS.md moved to `docs/history/`.
- `docs/GENRE-SPACE.md` CLI block calls bare `genre-kernel.js`/`genre-verifier.js`; the
  files are under `engine/` — prefix the commands. (partly already correct; verify)
- `docs/EXPORT.md` says browser video "does not exist at all" — **false** (video-export.js
  shipped); add the whole-loop **audio** export section too (undocumented).
- Move completed migration docs to `docs/history/`: `docs/FAUST-PORT.md` (Faust is the
  sole backend) and `genre-specs/MATERIALS.md` (a completed work order referencing the
  deleted `explorer.html`).

### 4.3 — [MOSTLY DONE] New docs contributors need (created as part of this plan or by Opus)
> Created: ARCHITECTURE.md, ADDING-A-GENRE.md, GENRE-SPEC-SCHEMA.md, VIDEO-EXPORT.md, KERNEL-MAP.md.
> Remaining: `docs/GENRE-VECTORS.md` (the W1 home doc).
- **`docs/ARCHITECTURE.md`** — one pipeline overview: genre-kernel (space) → csd-engine
  `buildEvents` (score brain) → theory/pipes (music mind) → faust/state-engine
  (voices+fx) → live vs press vs WAV-first paths, plus the determinism/matrix laws.
- **`docs/ADDING-A-GENRE.md`** — spec → `genre-tool.js create` → matrix-safe wiring →
  `deriveMind`/`MIND_OVERRIDES` → re-baking `app/world.js` POS.
- **`docs/GENRE-SPEC-SCHEMA.md`** — the `genre-specs/*.json` schema reference.
- **`docs/VIDEO-EXPORT.md`** — the shipped ⏺ live capture + the planned offline path.
- **`docs/GENRE-VECTORS.md`** — the Workstream 1 program (this section, expanded), so the
  genre-intelligence layer has a home doc as it's built.

---

## Workstream 5 — Repo hygiene (mostly done this session)

- **DONE:** moved the 4 orphan root render artifacts (`longshipwhip-s3.*`,
  `walrusfuzz-s6.*`) into `scratch/` — they were already gitignored but *still deploying*
  (`deploy-stellate.sh` rsyncs the whole tree; `scratch/` is the only folder both
  gitignored **and** rsync-excluded). Fixed a real deploy-bloat leak; zero references, no
  breakage.
- **Optional, needs 1 edit:** `night-drive-preset.json` is tracked but write-only
  (`tools/render-sample-video.js:248` writes it, nothing reads it). To relocate: edit
  `render-sample-video.js:55` `presetJson` to `examples/night-drive-preset.json`, then
  `git mv`. Low value — leave it unless doing a broader tools pass.
- **Leave at root** (all referenced by served/gated paths): `index.html`, `sw.js`,
  `access.html`, `how.html`, `serve.sh`, `verify.sh`, the standard project docs, and the
  repo-root-anchored `audio-verifier.py`/`sing.py` (companions of `.venv-*`, referenced
  by `genre-kernel.js`/`validate-genres.js`/`render-sample-video.js`).
- **.gitignore:** add `.DS_Store`; optionally `/night-drive-preset.json` if not relocated.

---

## Workstream 6 — Backlog remainder & live feedback

Pick from these once the above workstreams are moving:
- **A.3** revive the dry granular INSERT (`state-engine.js:587/1196` passes dry on the
  live ring path) → wire to vaporwave/plunderphonic; then the broad Faust-fun voice/effect
  sweep. *Low value.*
- **C.2** settings-panel visual pass (`panels.js` rows/sliders/labels + `app.css`).
  *Small, front-end only.*
- **D.1 verification** — confirm the register-fold covers *all* voices in
  `csd-engine buildEvents`, not just samplers (spec asked for all). Then **D.3**:
  borrowed/chromatic-mediant chords + richer 9/11/13 extensions in `theory.js` (D.2
  shipped applied-dominants only). *Taste-gated on Paul.*
- **F.1** iOS pinch — real-device confirm. **F.2** reedrush kick — ear confirm; else dig
  into the acoustic-kit kick sample / master-limiter transient.
- **F.3 residual** — `loopBars` still caps at 2048; a worker export could un-truncate huge
  paths.
- **LFB** (where recent momentum is): more international genres, per-genre descriptions,
  mixing-graph node coloring, better sample sourcing.

---

## Guardrails (LAW — re-read before any task)

1. **Byte-identical renders.** Same state → byte-identical `buildEvents`. Every
   engine/kernel change is gated by `fixtures` + `segment-parity` (BYTE-EQUAL). New
   optional dimensions must be **drawn LAST in `resolveMulti` and consume ZERO rng when
   absent** — that is why the space grows without regressing fixtures.
2. **Live-only audio** (master bus, `userGain`, the Vapor EQ) rides the main-thread graph
   *after* `masterGain` → never touches the worker-baked press mix → segment-parity stays
   byte-identical. The pattern for live taste changes.
3. **Opt-in DSP** (`n.granular`, `f.scratch`, recipe `fenv`) is byte-identical when absent.
4. **Plain-script load model.** `index.html` loads `engine/*.js` + `app/*.js` as ordered
   `<script>`; `engine/` stays classic globals (no ES modules). Refactors reorganize
   *source*, never the *evaluated program* or the served file paths.
5. **The tree is the deployed web root.** `deploy-stellate.sh` rsyncs the whole tree
   (deny-list); moving a served/gated file is a production change. Verify move-safety by
   grepping `index.html`/`sw.js`/`serve.sh`/`deploy-stellate.sh`/`verify.sh`.
6. **Whole-path exports materialize bars → cap + async-yield** or they OOM/freeze.
7. **Genre-intelligence tools are offline & read-only.** Any temp-anchor injection must
   splice into `GENRES`, run `deriveMind`, render, then **restore `GENRES` exactly**.
   Never run these during a normal render.
8. **Machines verify structure; Paul's ears verify taste.** Every genre/mix change is a
   best-guess pending his ear; the prod-deploy auto-guard blocks taste-gated items until
   his explicit word. Ship law: `tools/ship.sh` (verify.sh + theory/pipes/speech → push →
   deploy), refuses a dirty tree; app/engine changes also run the browser battery and a
   `node test/fixtures.js capture` re-bake after intentional drift (name the cause).
