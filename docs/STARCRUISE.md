# STAR-CRUISE — the 🛸 3D genre-flythrough view

A PS1-era-lofi 3D flythrough of the genre star map. The playhead is the pilot's
cockpit view; you fly genre→genre and **land** on planets; the ship opens and
1..N **aliens** greet you and form a **band** that plays **invented, procedural
instruments** — striking / plucking / bowing / drumming / blowing with their
appendages exactly **in time with the music** (hits land ON the beat) — while
grooving. The aliens' bodies/clothes/colours/traits, their instrument + how they
play it, and their groove are all **derived from the genre's 23-float feature
vector**. Behind them are procedural cities or farms.

Everything is **procedural** — no external art / model / texture assets. Low-res
is fine (it's the look). Aesthetic: low-res framebuffer upscaled nearest,
vertex-snapping, affine warp, dithering, flat/vertex-lit low-poly.

Status: **BUILT**. `app/starcruise/` is 9,321 lines across 14 modules —
`alien.js` alone is 2,465 — under a 581-line controller (`app/starcruise.js`)
and a 51-line deferred loader (`app/starcruise-load.js`). The contracts below
are what ships, not what was planned; nothing here is a stub.

---

## Architecture

```
index.html
  └─ app/main.js → app/panels/panels.js → app/starcruise-load.js   (~1 KB; the ✦ cycle)
       └─ dynamic import() on FIRST ENTRY to the aliens view:
            app/starcruise.js   (side-effecting: publishes window.__STARCRUISE)
       │  lazy import() on FIRST start():
       ├─ vendor/three/three.module.min.js     (r160 ESM, MIT — NOT in initial load)
       └─ app/starcruise/
            ├─ traits.js    genre 23-vector → TRAITS (band, body, face, groove, backdrop) [pure]
            ├─ alien.js     TRAITS + member  → { group, update(dt, ctx) } — plays the score [pure]
            ├─ backdrop.js  TRAITS           → { group, update(dt) }  (instanced city/farm) [pure]
            ├─ planet.js    the procedural planet you land on (heightAt, ground, sky)
            ├─ ship.js      the cockpit interior + the console genre display
            ├─ scene.js     the scene graph: what is added/removed in its two lifetimes
            ├─ geom.js      shared procedural geometry + material library (THREE core only)
            ├─ camera.js    where the camera is and who is driving it (orbit, auto-cam, input)
            ├─ postfx.js    THREE+renderer   → PS1 look (low-res target → nearest upscale) [pure]
            ├─ flight.js    { getTravel, getBeat } → state machine + phase events        [pure]
            ├─ bridge.js    the app/engine boundary: store reads + the buildEvents note plan
            ├─ probes.js    the window.__STARCRUISE debug surface the gates read
            ├─ genre-coords.js   GENRE_COORDS — one planet per genre  (generated)
            └─ genre-clusters.js CLUSTER_OF / GENRE_CLUSTERS — star systems (generated)
```

`genre-coords.js` and `genre-clusters.js` are **generated** — `node
tools/build/feature-layout3d.js` and `node tools/build/cluster-genres.js` — and
`test/gates/coords-coverage.test.js` (verify.sh `coordscover`) fails if a genre
is missing from either.

**The controller (`app/starcruise.js`)** owns the `WebGLRenderer`, the render
target, the `requestAnimationFrame` loop and the resize/DPR policy, delegating
the scene graph to `scene.js` and the camera to `camera.js`. It wires flight →
traits → alien × band → backdrop → postfx, and exposes
`start() / stop() / update(dt) / toggle() / isRunning()`, published on
`window.__STARCRUISE` together with the `probes.js` debug surface.

**Load law.** Three.js is *not* in `index.html`'s initial `<script>` block. The
controller `import()`s it lazily on the first `start()`. Until the view is
entered, the zero-dependency initial page load and mobile weight are untouched.
The mode is **opt-in / off by default**; when off the app behaves exactly as
before.

**Determinism.** Trait derivation is seeded (`mulberry32` keyed by
`hash(genre) ^ seed`). Same genre + seed → identical alien/band. No `Math.random`
in trait logic. (The controller only *reads* the app store; it never mutates the
audio render path — no engine/render-path file is touched.)

---

## The real hooks (do not fork the travel logic)

The flight follows the **same** travel path / playhead / dominant-genre the
explorer already uses, and syncs dance to the **same** audio beat.
`app/starcruise/bridge.js` owns the boundary and supplies the two reader shims
to `makeFlight({ getTravel, getBeat })`.

The bridge **never static-imports the app**: `app/core/state.js` pulls preact +
htm from esm.sh at eval time, so importing it would drag the whole module graph
onto this lazily-loaded view and break offline/headless boot. It reads the store
lazily off `window.__S` (falling back to a benign empty store) and inlines its
own `pointOnPath`, matching `share.js`'s implementation exactly.

### `getTravel()` — the explorer's current travel state
Reads the shared store (`window.__S`, published by `app/core/state.js`) — the
exact blend the star map + live audio already maintain. **No forked travel
logic.**
| field | source |
|---|---|
| `weights` | `S.weights` (`[{g,w}]`), filtered `w>0`, sorted desc |
| `dominant` | top-weight genre name |
| `position` | `pointOnPath(S.travel)` over `S.waypoints` — world coords along the **drawn path** |
| `live` | `S.live` |
| `seed` | `S.seed` |

`S.travel` (`{seg,t}`) and `S.weights` are advanced every bar by `travelStep()` /
the glide in `app/audio/live.js`'s `onBar`. We only read them.

### `getBeat()` — the real audio beat
`onBar` (`app/audio/live.js`) writes `S.barInfo` every bar with
`{ serial, ci, nch, when, spb, cbeats, chord, section }`; `S.playing.bpm` is the
tempo. The shim derives a smooth `beatPhase` (0..1 within a beat) from a local
clock that **resets on each new bar `serial`**, so dance hits stay locked to the
bar grid without touching the engine.
| field | source |
|---|---|
| `bpm` | `S.playing.bpm` |
| `spb` | `S.barInfo.spb` (seconds/beat = 60/bpm) |
| `cbeats` | `S.barInfo.cbeats` (beats per chord-bar) |
| `serial` | `S.barInfo.serial` (bar index) |
| `beatPhase` | local clock since the last serial change, mod `spb` → 0..1 |
| `playing` | `S.live` |

**Shim honesty:** the local `performance.now()` clock is deliberately
dependency-free. Hits could be made sample-accurate by reading the
`AudioContext` clock + `info.when` off `faustHandle` (`app/audio/live.js`)
instead of wall time — same `getBeat` shape, tighter lock.

### The score bridge — each alien PLAYS ITS PART
Beat-keeping is not the contract. On landing or a genre change the bridge
resolves the playing state and calls `E.buildEvents` **once for the whole
track**, then buckets every event by voice into a per-bar note plan
`{ bars:[ { voice:{ notes:[{t,pitch,dur,vel}], level, playing } } ] }`. Each
frame the controller picks the current bar (from the audio beat's `serial`) and
the bar-local phase and hands each member its own voice's `ctx` — never
rebuilding per frame; `buildCount()` is exposed so a gate can prove it. Engine
drum ids split into the core kit and the decorative `perc` lane, and per-voice
reference loudness turns event amps into a 0..1 `level`, so a quiet or faded bar
drops below the rest threshold and the player idles.

---

## The button

There is **no separate 🛸 chip**: aliens is the third view in the ✦ cycle
(map → viz → aliens → map), driven by `app/panels/panels.js`.

The controller is **not on the boot path**. `index.html` does not load
`app/starcruise.js`; `app/panels/panels.js` imports the ~1 KB `app/starcruise-load.js`,
whose `ensureStarcruise()` dynamic-imports the controller — single-flight, cached
after the first success, cache cleared on failure so a later attempt retries — the
first time the cycle reaches the view. A session that never opens aliens fetches
none of it: the controller plus the modules it static-imports
(bridge/scene/camera/probes/glyphs and the ~9 KB gz `genre-clusters.js` data)
gzip to roughly 66 KB together. Three.js and the seven build-phase modules
(`traits`, `alien`, `backdrop`, `postfx`, `flight`, `ship`, `planet`) remain one
step further out, behind the dynamic `import()` on first `start()`.

The loader also publishes `window.__ensureStarcruise` so headless gates can arm
the import deterministically instead of racing a ✦ click
(`test/lib/probe-harness.js ensureStarcruise(page)`).

---

## Genre-vector → trait MAPPING TABLE

The 23 features are `V.features(K.track(genre,{seed}))`:
`bpm, offgrid, snareBalance, hatDensity, drumDensity, variation, wash, sub, motion,
seventh, breakUse, chopUse, bedUse, crackle, pump, comp, swing, humanize, acoustic,
rubato, leadVoices, softTop, interlock`.

Every feature is first normalized into 0..1 through `NR`, a table of the
catalog's observed min/max per feature — the raw vector is not 0..1 (bpm
48..219, drumDensity 0..3.06, leadVoices 1..8).

| feature(s) | drives | how |
|---|---|---|
| `bpm` | `groove.tempoBpm`, `groove.energy`, eye-stalk length | faster tempo → faster grooving + more energetic band |
| `sub` | `body.massH`, `groove.bounce`, face family | deep sub → heavier, bouncier aliens |
| `drumDensity` | `body.massH`/`body.segments`, drummer `hitsPerBeat`, `dancers` | denser drums → bigger segmented bodies + a busier drummer |
| `interlock` | `body.limbs`, bass `hitsPerBeat` | interlocked parts → more limbs, a doubling bass |
| `hatDensity` | `body.limbs` (jitter/extra), perc `hitsPerBeat`, `dancers` | busy hats → more/faster appendages, a fuller floor |
| `motion` | palette hue, lead `hitsPerBeat`, `groove.headbob`, instrument family | melodic motion → more head-bob + a busier lead |
| `wash` | `skin` (`glass`), `glow`, lead family, renderStyle bloom | ambient wash → translucent bodies + scene glow |
| `swing` / `humanize` / `rubato` | `groove.sway`, pluck/bow vs. strike | looser feel → more sway, more pluck/bow vs. rigid strike |
| `pump` | `groove.bounce`, renderStyle grade | sidechain pump → whole-body bounce |
| `seventh` | palette hue / iridescence | harmonic colour → hue rotation |
| `acoustic` | `organic` (>0.65), `skin`, instrument family + playStyle, **backdrop** | organic → living skin, gut/reed/horn instruments, **farm**; electronic → chrome/glass, bladders and coils, **city** |
| `softTop` | `cloth.coverage` | brighter/harsher top → clothing coverage |
| `crackle` | `skin` (`matte`), `glow`, renderStyle dither | tape crackle → dusty surfaces + grit |
| `variation` | `cloth` saturation, `groove.energy` | more variation → louder clothes |

**Band composition mirrors the genre's actual parts — structurally, not by
threshold.** `presentVoices(state)` reads the resolved `state.sections` and asks
which engine voices sound anywhere in the track: `drums`, `perc` (the decorative
`state.perc.lanes`, which need a kit), `bass`, `melody` (melody/solo/counter),
`pad`, `found` (a section's found/hits `sourceId`). One alien per sounding
voice, capped at 8, so a drumless drone gets no drummer and a vocal-sample genre
gets a `found` player. `crowd === band.length`. Roles are `drum | perc | bass |
lead | pad | found`, each carrying the engine `voice` it mirrors. `hitsPerBeat`
reflects the part — drummer/perc busy (2–4), bass/pad sparse (1). The designated
`instrument.appendage` limb lands its contact ON the beat.

**Dancers** are separate from the band: a floor forms only when the genre has
drums AND `groove.energy ≥ 0.45`, then scales to 2–8. Hushed or drumless genres
are just the band.

Invented instrument families (procedural, not real), organic ↔ electronic per
role: `hide-sac`/`membrane-sac` ↔ `glitch-pod`/`pulse-bladder` (drum),
`seed-rattle` ↔ `chime-cluster` (perc), `coiled-gut` ↔ `sub-bladder`/
`drone-coil` (bass), `bladder-horn`/`tendril-harp` ↔ `shimmer-frond`/
`bloop-anemone`/`neon-stinger` (lead), `reed-lung` ↔ `gas-veil` (pad),
`voice-polyp` ↔ `echo-conch` (found). Play styles: `strike | pluck | bow | drum
| blow`.

**Whole-screen `renderStyle`.** The same normalized vector derives a post-fx +
surface bag (lofi / driving / washy / harmonic / vapor / metal / warm
archetypes) so each genre renders in its own visual language — computed LAST so
it perturbs no earlier rng draw.

---

## Module contracts (all factories pure: take `THREE` + inputs → plain object)

```js
// traits.js
traitsFromGenre(K, V, genreOrWeights, seed) -> TRAITS
// TRAITS = { palette:{skin,cloth,accent},
//   body:{massH,height,limbs,eyes,segments,bodyShape,armLength,eyeStalk,neck,
//         antennae,crestType,asymmetry,face},
//   skin:'organic'|'chrome'|'glass'|'matte', texture, cloth:{motif,coverage},
//   face:{mouth,brow,snout,teeth,mouthWide},
//   groove:{name,tempoBpm,bounce,sway,headbob,energy},
//   band:[ { role:'drum'|'perc'|'bass'|'lead'|'pad'|'found',
//            voice:'drums'|'perc'|'bass'|'melody'|'pad'|'found',
//            instrument:{ family, playStyle:'strike'|'pluck'|'bow'|'drum'|'blow',
//                         appendage:int, hitsPerBeat:int } } ],
//   dancers:int, crowd:int, backdrop:'city'|'farm', glow:0..1, renderStyle:{…} }
// genreOrWeights = a genre NAME or a weights array [{g,w},…]; same input + seed
// -> identical TRAITS (mulberry32 keyed by hash(name) ^ seed; no Math.random).

// alien.js
makeAlien(THREE, traits, member, seed) -> { group:THREE.Object3D, update(dt, ctx) }
//   ctx = { barPhase 0..1, playing, level, notes } — the member's REAL note
//   onsets ({t,pitch,dur,vel}) for its voice this bar, from bridge.js's
//   buildEvents plan, so a limb strikes where the score has a note and the
//   instrument lowers during rests. Also builds background DANCERS.

// backdrop.js
makeBackdrop(THREE, traits, seed, opts) -> { group:THREE.Object3D, update(dt) }
//   instanced city (buildings) or farm (crop rows / silos) per traits.backdrop;
//   one InstancedMesh per shape family, so the silhouette varies and draws don't.

// postfx.js
makePS1(THREE, renderer, lowResTarget)
//   -> { render(scene,camera), setSize, vertexSnapMaterial(base),
//        setStyle(renderStyle), getStyle(), dispose }
//   render scene→lowResTarget, then upscale nearest to the display canvas.
//   setStyle drives dither/posterize/scanlines/aberration/halftone/bloom/
//   vignette/curvature/grade from traits.renderStyle.

// flight.js
makeFlight({ getTravel, getBeat }) -> { update(dt) -> STATE, events }
//   STATE = { phase:'FLY'|'APPROACH'|'LAND'|'OPEN'|'GREET'|'DANCE'|'DEPART',
//             dominant, weights, cameraPose, landProgress, spaceProgress,
//             beatPhase, imm, dominantWeight, viewportFade, … }
//   events.on('land'|'open'|'greet'|'depart'|'phase', cb)
//   Phase changes are driven by NEARNESS — the dominant genre's weight — through
//   critically-damped descent scalars, so the same (dt, travel, beat) stream in
//   gives the same STATE stream out.
```

---

## Mobile-perf budget

- **Internal resolution:** the 320×240 potato is gone. The `WebGLRenderTarget`
  is DPR-aware and near-native — the long edge is `min(cssLong × dpr, cap)` with
  `cap` 1600 desktop / 1080 coarse-pointer, floored at 320×240 — and the canvas
  backing store is driven to the same size so the blit is ~1:1.
  `renderer.setPixelRatio(1)`; the PS1 look comes from the shader, not from
  starving the framebuffer. Resolution is fill-rate; the geometry stays low-poly.
- **Draw calls:** keep tiny. The backdrop batches one `InstancedMesh` per shape
  family + a ground plane; aliens share materials where possible; the band is
  capped at 8 and dancers at 8.
- **Geometry:** low-poly primitives only (boxes/cylinders/planes), `flatShading`.
  No loaded meshes, no textures (procedural colour only) — zero asset bytes.
- **Loop:** single RAF; `dt` clamped to 50ms so a backgrounded tab doesn't
  explode the step. Lazy Three import keeps the mode off the critical path.
- **Teardown:** `stop()` disposes geometries/materials/targets/renderer and removes
  the canvas — no GL leak when toggled off.

---

## Headless proof

Eight playwright gates drive `index.html` in headless chromium (WebGL via
SwiftShader), arming the controller through `window.__ensureStarcruise()` rather
than racing a ✦ click. 312 assertions across the suite:

| gate | assertions | what it proves |
|---|---|---|
| `test/starcruise/starcruise.test.js` | 80 | the whole contract, below |
| `test/starcruise/alien.test.js` | 94 | the creature rig and that it plays the score |
| `test/starcruise/backdrop.test.js` | 67 | the instanced city/farm world |
| `test/starcruise/alien-face.test.js` | 27 | facial character per genre |
| `test/starcruise/starcruise-nav.test.js` | 13 | camera/navigation input |
| `test/starcruise/alien-dancer.test.js` | 12 | the background dance floor |
| `test/starcruise/starcruise-barcadence.test.js` | 12 | camera cadence across bar boundaries |
| `test/starcruise/postfx.test.js` | 7 | the PS1 low-res/upscale chain |

```
node test/starcruise/starcruise.test.js
```
asserts: off-by-default (controller not on the boot path, Three unloaded, no
canvas) → `start()` lazy-loads Three + mounts the canvas + spawns one alien per
sounding voice → a **non-blank** frame renders (low-res target readback: colour
spread + non-bg pixel body) → the flight machine advances FLY → APPROACH → LAND
→ OPEN → GREET → members receive real note onsets and rest when their voice is
silent → **no** console/page errors → `stop()` tears down cleanly (canvas
removed, `isRunning()` false), twice over. It prints `ALL PASS`.

**One assertion is red.** `starcruise-barcadence.test.js` fails its first check:
*NO LURCH at any BAR BOUNDARY* — the worst boundary camera move measures 6.91×
the local median (frame 112, move 5.3567 vs median 0.7752) against a ≤2.0
ceiling, so the camera spikes at a bar step instead of gliding. Its other 11
assertions pass. The suite is not wired into `verify.sh`, which is why this can
sit red.
