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

Status: **BUILT**. The five modules the scaffold sketched are real —
`app/starcruise/` is ~7,300 lines across ten files, with `alien.js` alone at
~2,500. The contracts below are what shipped, not what was planned; the
placeholder scene they originally rendered is long gone.

---

## Architecture

```
index.html
  └─ app/main.js → app/panels.js → app/starcruise-load.js   (~1 KB; the ✦ cycle)
       └─ dynamic import() on FIRST ENTRY to the aliens view:
            app/starcruise.js   (side-effecting: publishes window.__STARCRUISE)
       │  lazy import() on FIRST start():
       ├─ vendor/three/three.module.min.js     (r160 ESM, MIT — NOT in initial load)
       └─ app/starcruise/
            ├─ traits.js    genre 23-vector → TRAITS (band, body, groove, backdrop)  [pure]
            ├─ alien.js     TRAITS + member  → { group, update(dt, beatPhase) }        [pure]
            ├─ backdrop.js  TRAITS           → { group, update(dt) }  (instanced city/farm) [pure]
            ├─ postfx.js    THREE+renderer   → PS1 look (low-res target → nearest upscale) [pure]
            └─ flight.js    { getTravel, getBeat } → state machine + phase events        [pure]
```

**The controller (`app/starcruise.js`)** owns the `WebGLRenderer`, the low-res
`WebGLRenderTarget` (320×240, nearest, upscaled to the display canvas), the
cockpit `PerspectiveCamera`, the `Scene`, and the `requestAnimationFrame` loop. It
wires flight → traits → alien × band → backdrop → postfx, and exposes
`start() / stop() / update(dt) / toggle() / isRunning()`.

**Load law.** Three.js is *not* in `index.html`'s initial `<script>` block. The
controller `import()`s it lazily on the first `start()`. Until the 🛸 chip is
tapped, the zero-dependency initial page load and mobile weight are untouched. The
mode is **opt-in / off by default**; when off the app behaves exactly as before.

**Determinism.** Trait derivation is seeded (`mulberry32` keyed by
`hash(genre) ^ seed`). Same genre + seed → identical alien/band. No `Math.random`
in trait logic. (The controller only *reads* the app store; it never mutates the
audio render path — no engine/render-path file is touched.)

---

## The real hooks (do not fork the travel logic)

The flight follows the **same** travel path / playhead / dominant-genre the
explorer already uses, and syncs dance to the **same** audio beat. The controller
supplies two reader shims to `makeFlight({ getTravel, getBeat })`:

### `getTravel()` — the explorer's current travel state
Reads the shared store (`app/state.js` `S`) — the exact blend the star map + live
audio already maintain. **No forked travel logic.**
| field | source |
|---|---|
| `weights` | `S.weights` (`[{g,w}]`), filtered `w>0`, sorted desc |
| `dominant` | top-weight genre name |
| `position` | `pointOnPath(S.travel)` from `app/share.js` — world coords along the **drawn path** |
| `live` | `S.live` |
| `seed` | `S.seed` |

`S.travel` (`{seg,t}`) and `S.weights` are advanced every bar by `travelStep()` /
the glide in `app/live.js`'s `onBar`. We only read them.

### `getBeat()` — the real audio beat
`onBar` (`app/live.js`) writes `S.barInfo` every bar with
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

**Shim honesty / Integrate-phase upgrade:** the local `performance.now()` clock is
intentionally dependency-free for the scaffold. The Integrate phase can make hits
sample-accurate by reading the `AudioContext` clock + `info.when` off
`faustHandle` (`app/live.js`) instead of wall time — same `getBeat` shape, tighter
lock.

---

## The button

There is **no separate 🛸 chip**: aliens is the third view in the ✦ cycle
(map → viz → aliens → map), driven by `app/panels.js`.

The controller is **not on the boot path**. `index.html` does not load
`app/starcruise.js`; `app/panels.js` imports the ~1 KB `app/starcruise-load.js`,
whose `ensureStarcruise()` dynamic-imports the controller — single-flight, cached
after the first success, cache cleared on failure so a later attempt retries — the
first time the cycle reaches the view. A session that never opens aliens fetches
none of the ~48 KB gz controller nor the ~9 KB gz `starcruise/genre-clusters.js`
it static-imports; Three.js remains one step further out, on first `start()`.

The loader also publishes `window.__ensureStarcruise` so headless gates can arm
the import deterministically instead of racing a ✦ click
(`test/probe-harness.js ensureStarcruise(page)`).

---

## Genre-vector → trait MAPPING TABLE

The 23 features are `V.features(K.track(genre,{seed}))`:
`bpm, offgrid, snareBalance, hatDensity, drumDensity, variation, wash, sub, motion,
seventh, breakUse, chopUse, bedUse, crackle, pump, comp, swing, humanize, acoustic,
rubato, leadVoices, softTop, interlock`.

| feature(s) | drives | how |
|---|---|---|
| `bpm` | `groove.tempoBpm`, limb speed, `groove.energy` | faster tempo → faster grooving + more energetic band |
| `sub` | `body.massH`, `groove.bounce` | deep sub → heavier, bouncier aliens + a **bass** member |
| `drumDensity` | `body.segments`, `crowd`, drummer `hitsPerBeat`, extra **perc** member | denser drums → busier drummer + more perc bodies |
| `interlock` | `body.limbs`, extra **perc** member | interlocked parts → more limbs + a perc player |
| `hatDensity` | `body.limbs` (jitter/extra), perc `hitsPerBeat` | busy hats → more/faster appendages |
| `leadVoices` | a **lead** member | present when `>0.25`; its `playStyle` from `acoustic` |
| `motion` | palette hue, lead `hitsPerBeat`, `groove.headbob` | melodic motion → more head-bob + a busier lead |
| `wash` | a **pad/drone** member, `glow` | ambient wash → a bowed pad player + scene glow |
| `swing` / `humanize` / `rubato` | `groove.sway`, pluck/bow feel | looser feel → more sway, more pluck/bow vs. rigid strike |
| `pump` | `groove.bounce` | sidechain pump → whole-body bounce |
| `seventh` | palette hue / iridescence | harmonic colour → hue rotation |
| `acoustic` | `skin` (organic vs chrome), instrument look, **backdrop** | acoustic → organic skin + `wailhorn`/blow + **farm**; electronic → chrome + `bloopharp`/pluck + **city** |
| `softTop` | `cloth.coverage` | brighter/harsher top → clothing coverage |
| `crackle` | `glow` (secondary) | tape crackle → a little haze |

**Band composition mirrors the genre's actual parts.** Always a **drum** + **bass**
member; a **lead** when `leadVoices>0.25`; a **pad** when `wash>0.3`; an extra
**perc** when `interlock>0.5 || drumDensity>0.6`. `crowd === band.length`.
`hitsPerBeat` reflects the part — drummer/perc are busy (2–4), bass/pad are sparse
(1). The designated `instrument.appendage` limb lands its contact ON the beat;
`hitsPerBeat` sub-hits divide each beat.

Invented instrument family names (procedural, not real): `thumpdrum`,
`buzzstring`, `wailhorn`, `bloopharp`, `glasspad`, `clackshell`. Play styles:
`strike | pluck | bow | drum | blow`.

---

## Module contracts (all factories pure: take `THREE` + inputs → plain object)

```js
// traits.js
traitsFromGenre(K, V, genreOrWeights, seed) -> TRAITS
// TRAITS = { palette:{skin,cloth,accent}, body:{massH,height,limbs,eyes,segments},
//   skin:'organic'|'chrome', cloth:{motif,coverage},
//   groove:{name,tempoBpm,bounce,sway,headbob,energy},
//   band:[ { role:'drum'|'bass'|'lead'|'pad'|'perc',
//            instrument:{ family, playStyle:'strike'|'pluck'|'bow'|'drum'|'blow',
//                         appendage:int, hitsPerBeat:int } } ],
//   crowd:int, backdrop:'city'|'farm', glow:0..1 }

// alien.js
makeAlien(THREE, traits, member, seed) -> { group:THREE.Object3D, update(dt, beatPhase) }
//   beatPhase 0..1 within the current beat; member.instrument.hitsPerBeat sub-hits
//   divide the beat; the playing limb contacts the instrument at each sub-division.

// backdrop.js
makeBackdrop(THREE, traits, seed) -> { group:THREE.Object3D, update(dt) }
//   instanced city (buildings) or farm (crop rows / silos) per traits.backdrop.

// postfx.js
makePS1(THREE, renderer, lowResTarget) -> { render(scene,camera), setSize(w,h), vertexSnapMaterial(base) }
//   render scene→lowResTarget, then upscale nearest to the display canvas.

// flight.js
makeFlight({ getTravel, getBeat }) -> { update(dt) -> STATE, events }
//   STATE = { phase:'FLY'|'APPROACH'|'LAND'|'OPEN'|'GREET'|'DANCE'|'DEPART',
//             dominant, weights, cameraPose, landProgress, beatPhase }
//   events.on('land'|'open'|'greet'|'depart'|'phase', cb)
```

---

## Mobile-perf budget

- **Internal resolution:** render to a 320×240 `WebGLRenderTarget`, nearest-upscaled
  to the display canvas (`image-rendering:pixelated`). `renderer.setPixelRatio(1)`.
- **Draw calls:** keep tiny. Backdrop is a single `InstancedMesh` (≤48 instances) +
  one ground plane. Aliens share materials where possible; cap `crowd` (band size,
  typically 2–5). Target: **< ~20 draw calls** total.
- **Geometry:** low-poly primitives only (boxes/cylinders/planes), `flatShading`.
  No loaded meshes, no textures (procedural colour only) — zero asset bytes.
- **Loop:** single RAF; `dt` clamped to 50ms so a backgrounded tab doesn't
  explode the step. Lazy Three import keeps the mode off the critical path.
- **Teardown:** `stop()` disposes geometries/materials/targets/renderer and removes
  the canvas — no GL leak when toggled off.

---

## Headless proof

`test/starcruise-run.js` (playwright, SwiftShader WebGL):
```
node test/starcruise-run.js
```
Asserts: off-by-default (Three unloaded, no canvas) → `start()` lazy-loads Three +
mounts the canvas + spawns a band → a **non-blank** frame renders (low-res target
readback: colour spread + non-bg pixel body) → the flight machine advances through
phases → **no** console/page errors → `stop()` tears down cleanly (canvas removed,
`isRunning()` false). All 16 assertions PASS in the scaffold.
```
```
