# STARCRUISE-LIBS — open-source adoption plan

*Research 2026-07-12 (5 parallel scouts + synthesis) into tiny OSS libraries for the
star-cruise 3D mode. Verdicts verified against real GitHub/npm state.*

**One-line conclusion:** adopt exactly **two tiny MIT single-files** — `simplex-noise`
(planet + terrain) and `THREE.MarchingCubes` (organic alien bodies) — keep the rig on
**Three-core `SkinnedMesh` + the copied `CCDIKSolver` addon**, and **adopt NO physics
engine** (the "physics" needs are kinematic clamps, not dynamics). Net payload to a
phone: **~40–50 KB of JS, zero WASM, zero framework.** Every pick is deterministic
against our mulberry32 seed and drives our own `Object3D`/`BufferGeometry`, so nothing
fights the Three scene we already own.

## The five picks

| Need | Pick | Size | License | Verdict |
|---|---|---|---|---|
| Planet gen | **`simplex-noise` (jwagner)** + our icosphere | ~6 KB ESM | MIT | ADOPT |
| Terrain gen | **same `simplex-noise` file** (heightfield) | (shared) | MIT | ADOPT |
| Alien mesh | **`THREE.MarchingCubes`** (three examples, we already vendor three) | ~40 KB, 1 file | MIT | ADOPT |
| Creature rig | **Three-core `SkinnedMesh/Skeleton/AnimationMixer` + `CCDIKSolver`** | 0 KB + few KB | MIT | ADOPT |
| Collisions/physics | **hand-rolled `collide.js`** (NO engine) | ~200 lines | ours | KEEP HAND-ROLLED |

## Why each

- **Planet/terrain → `simplex-noise` (jwagner), v4, MIT, zero-dep.** There is **no**
  vendorable "planet library" — the space is demo apps that drag in R3F/Tailwind/lil-gui.
  v4 **deliberately removed its built-in PRNG**: `createNoise3D(rng)` takes *our*
  `mulberry32(seed)` → byte-deterministic, seed-scoped planets, no `Date.now`/`Math.random`
  (the cleanest determinism story of any pick). `makePlanet(seed,palette)` ≈ 100 lines:
  icosphere → per-vertex fBm displacement → height-band vertex colors → a ~15-line fresnel
  atmosphere shell. The **same** noise `heightAt(x,z)` serves terrain — one dependency for
  both. Steal dgreenheck's MIT fBm→palette recipe; don't vendor its dep stack. `THREE.Terrain`
  (MIT, r160-native) is a shelf item only if per-genre surface *personality* justifies a
  seed-audit of its `randomness` hook.
- **Alien mesh → `THREE.MarchingCubes`** (`three/examples/jsm/objects/MarchingCubes.js`,
  MIT, ships in the three repo we already vendor — pin to r160). The one thing our
  superquadric + curve-tube rig **cannot** do: limbs that *fuse* into a torso instead of
  clamped-together tubes. Pure function of ball positions/strengths/grid resolution → no
  RNG → byte-stable. Mobile caveat: O(res³) — cap resolution ~28–48 and **bake once to a
  static BufferGeometry at load**, never per-frame. Inline companion (no dep): the Gielis
  **superformula** (~15 lines, 8 seeded params) for shell/spiky/radiolarian aliens.
- **Rig → Three core + copy `CCDIKSolver`.** The "procedural creature *with rigging*"
  niche is **empty** — nothing small/vendorable/deterministic/permissive generates both a
  body and an animatable bone rig. So the rig stays ours, on what's **already bundled**:
  `Bone/Skeleton/SkinnedMesh/AnimationMixer/AnimationClip` (0 KB, MIT, native). Copy one
  file — `CCDIKSolver` (`examples/jsm/animation/CCDIKSolver.js`, pin to r160) — whose
  per-joint `rotationMin/Max` become **principled keep-out** (the real version of our
  ad-hoc limb clamps), and whose IK plants feet on the noise-derived ground and reaches
  hands to instruments. Optional standalone tentacle FABRIK: `FIK` (lo-th, MIT, single-file)
  — only if CCD-on-skeleton doesn't cover tentacles.
- **Physics → NONE; hand-roll `collide.js`.** Every stated need (aliens on floor, limbs
  not through bodies, camera/floor clamps, "simple collisions") is a **kinematic constraint**
  (clamp + keep-out + IK), not rigid-body dynamics. A real engine (a) adds a determinism-config
  surface to defend against our seeded-render law, (b) wants to *own* transforms we compute
  procedurally, and (c) ships **0–1.5 MB WASM to a phone** for one-line clamps. Instead,
  ~200 lines of pure `THREE.Vector3` functions (stateless → deterministic, matrix-invisible,
  zero payload): `capsulePlane`/`spherePlane` (floor), `sphereSphere`/`capsuleCapsule`
  closest-point push-out (limb/body keep-out), `segmentCapsule` (limb-vs-torso during FABRIK),
  `clampToAABB` + critically-damped smoothing (`MathUtils.damp`) for the camera.
  **Escalation ladder** if real dynamics ever appear: cannon-es (MIT, ~35 KB gzip, no WASM,
  seedable) → Rapier (Apache-2, best engine, but ~1.4 MB WASM + the specific
  `@dimforge/rapier3d-deterministic` build) → Jolt (bit-exact cross-platform determinism,
  heaviest). Skip Oimo (dead), Ammo (obsolete), planck/p2 (2D).

## Sequenced rollout (highest value / lowest risk first)

1. **`simplex-noise` planet + terrain** — one 6 KB MIT file, `createNoise3D(mulberry32(seed))`,
   no interop friction. Unlocks a **CPU-samplable ground height** so we *delete* the ad-hoc
   floor clamp instead of patching it. Foundational for the rig's foot-plant. Risk ≈ 0
   (keep icosphere subdivisions ≤4–5 on mobile; recompute normals after displacement).
2. **`collide.js`** — ~200 lines, no dep, no payload. Real keep-out + the damped camera
   controller. Do before rigging so IK has clean constraints. Risk: none (pure functions).
3. **Rigging: `SkinnedMesh` + `CCDIKSolver`** — 0-KB foundation + one pinned addon.
   Turns clamped-tube rigs into skinned, IK-reactive bodies (feet plant on the surface,
   hands reach instruments). Keep bone counts + bones/vertex modest for mobile.
4. **Alien bodies: `THREE.MarchingCubes` (bake once)** — biggest *visual* upgrade, slightly
   higher mobile risk (O(res³)), most new code → comes after the structural wins. Cap
   resolution, bake to static geometry at load. Add the inline superformula.
5. **(optional/deferred)** tentacle `FIK` and/or `THREE.Terrain` escalation. Physics engines
   stay shelved unless real dynamics appear.

## The current pain points (smoothness / scene-cut) — important

**A physics/game engine will NOT fix these and would likely make them worse** (a stepped
fixed-dt world adds its own timing seam and fights our seeded tape). The lurch/cut/jitter
are **scene-structure and camera problems, not dynamics:**
- **Camera smoothness:** `clampToAABB` + critically-damped smoothing of camera position/target
  in `collide.js`. The honest fix for "camera clamps feel ad-hoc."
- **Foot/floor jitter:** the analytic `heightAt` (step 1) + CCDIK foot-plant (step 3) removes
  the popping the ad-hoc y-clamps cause on an approaching planet.
- **Scene structure / the cut:** we don't need a game-engine scene graph — **Three's own
  `Object3D` hierarchy IS the unified scene.** The win is *organizing* it: one root rig per
  creature, the planet as one displaced mesh with CPU height data, and a **single owned
  camera controller**. The galaxy→surface "cut" is a transition/easing concern in our own
  render loop (unify the regions, crossfade/ease the constant-pace travel we already have).
  A structural refactor, deterministic and hand-rolled — no engine.

## Vendoring / license
All adopted picks are **MIT**, single-file, no WASM, no framework, no CDN/runtime fetch
(satisfies strict-CSP/offline): `simplex-noise` (~6 KB), `THREE.MarchingCubes` (~40 KB, pin
r160), `CCDIKSolver` (few KB, pin r160), Three-core skinning (0 KB). Optional `FIK` (MIT) and
`THREE.Terrain` (MIT) are shelf items. No GPL/AGPL anywhere.
