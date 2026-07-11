# GENRE-SPACE — the genre kernel

`genre-kernel.js` treats a *genre* as a **point in a multidimensional space**
and a *song* as a **seeded sample near a point**. Blending genres is movement
through that space; a playlist is a **path** through it. The kernel's job is
twofold: make every point sound like *somewhere* (coherence), and make every
track sound like *itself* (distinctness — the anti-homogeneity rules below are
as load-bearing as the genre vectors).

## The dimensions

A point is not one vector of floats — it's a bundle of typed dimensions, each
with its own blend rule:

| dimension | type | examples | blend rule |
|---|---|---|---|
| **tempo** | scalar range | techno 120-140, jungle 160-172, vaporwave 62-88 | lerp ranges, then sample |
| **meter feel** | enum | straight / swung / halftime / broken | probabilistic pick ∝ t |
| **rhythm** | pool of kits | four-on-floor, pulse, breaks, jungle chop, boombap, none | weighted pool union |
| **rhythm representation** (KERNEL-V4 Phase 1) | data lanes | every kit is a pulse-set lane table (`CsdEngine.KITS`) rendered by one interpreter; a state `euclid` spec is lane *notation* that replaces the matching lane, not an overlay | kits stay a pool; lane tables are the shared vocabulary the verifier/blends can read |
| **harmonic rhythm** (KERNEL-V4 Phase 1) | scalar `chordEvery` | beats per chord bar; default 8 (the legacy CHORD_BEATS). An anchor may declare 4 (jazz-speed changes) or 16/32 (drone plateaus); kit/bass cells tile, melody phrases breathe | parent pick by weight, drawn LAST (zero draws when absent — byte-stable) |
| **meter** (ODD-METER 2026-07) | enum `meter:{beats,unit}` | 4/4 (absent — the default, byte-identical), 3/4 waltz `{beats:3,unit:4}`, compound 6/8 `{beats:6,unit:8}` (the engine beat is the 8th; the pulse is the dotted quarter) | parent-pick by weight, drawn LAST, ZERO draws when no parent declares it. Meters don't lerp — a bar holds an integer beat count, so a blend keeps ONE parent's bar line and a journey crosses an audible meter-FLIP, not a smear. A meter anchor defaults `chordEvery` to 6 (two 3/4 measures / one 6/8 measure) and pools the meter vocabulary: kits `waltz`/`waltzswing`/`sixeight`, bass `oompahpah`/`waltzroot`/`siciliana`, melody `waltz`/`lilt6`. First production anchors: `salondawdle` + `greasepaintoompah` (both 3/4; 6/8 is engine-proven — `test/meter.test.js` — awaiting its first anchor) |
| **harmonic motion** | scalar + pool | techno ≈ 0 (drone), city pop ≈ 1 (changes every 2 bars) | lerp rate, pick progression from pooled candidates compatible with rate |
| **harmonic color** | pool | maj7/9 (vapor, lofi), minor triads (synthwave), single minor drone (techno) | pool union |
| **key** | offset + mode bias | jungle/techno favor minor; vapor favors major-ish IVΔ | walked, not blended (see playlist) |
| **bass** | pool + recipe | sub whole-notes (jungle), rolling offbeat 16ths (house/techno), drive 8ths (synthwave) | pool union; recipe params lerp |
| **lead** | pool + recipe | supersaw hero (synthwave), sparse sine (downtempo), **off** (techno — absence is a choice) | pool union incl. weighted "off" |
| **pads** | prob + recipe | washy saw (vapor), absent (jungle), drone (ambient) | prob lerp, recipe lerp |
| **sound design** | recipe params | voices/spread (supersaw↔pure), cutoffs, attacks, drum tuning/levels | continuous lerp |
| **production** | scalars | reverb size, delay time/feedback, **pump** (sidechain duck), **crackle** (vinyl dust), tone tilt (lo-cut/hi-cut), drum reverb send | continuous lerp |
| **sampling / found sound** | role + source pool | granular **bed** (vapor: stations, malls) vs rhythmic **chops** (jungle, triphop); source pools per genre from archive.org (aporee field recordings, PD items) | role by threshold, source from pooled candidates |
| **form** | enum + params | **pop** (verse/chorus, the current builder shape), **dj** (long additive plateaus, techno/house), **wave** (slow swells, ambient) | pick ∝ t; section count/cycle params lerp |
| **transitions** | pool | tom fill (synthwave), break fill (jungle), riser (everything), **drop-cut** (dj forms), none | pool union |
| **harmonic adventure** (MUSIC-MIND) | scalar ranges + enum | jazz .45-.65 drop2 + reharm (every song rewalks the changes), techno 0-.05 (restraint is identity — no reharm below .15), vaporwave color .6-.8 with reharm OFF (the tape is frozen maj7) | adventure/color lerp via `wRange` then sample; voicing parent-pick; reharm weighted vote — drawn LAST, `state.theory` absent unless reharm survives constrain |
| **pipes** (MUSIC-MIND) | prob-weighted pool | fugue echoCanon (imitation IS the genre), dub throwFx, jungle ghost + throws, techno octavePump + densityArc, blues callResponse | weighted pool union: parent-scaled inclusion probs, dedupe by id, cap 3 — drawn LAST; densityArc evicts echoCanon (mud) |
| **rhythmic complexity** (MUSIC-MIND) | scalar range | jungle .55-.8 (cell mutation + melody rhythm cells), techno .1-.25, ambient 0-.05 | lerp range then sample, drawn LAST; constrain caps ≤.4 above 165bpm (fast genres saturate on their own) |

**Resolved axes note (MUSIC-MIND, 2026-07).** The three new axes are not 249
hand edits: `deriveMind()` runs at load and infers each anchor's
`theory`/`pipes`/`rhythm` from what the anchor already declares (progression
pool → harmonic appetite and extension color; kit pool + euclid → complexity;
models/patterns → which pipes fit), with a small curated `MIND_OVERRIDES`
table where inference reads a flagship wrong — explicit always wins
(`MIND_OVERRIDES` is applied inside `deriveMind` itself since 2026-07-10, so
genre-tool's create-time measurement, serialization, and load all agree). The
resolved values ride the state as `state.theory` / `state.pipes` /
`state.rhythm`, consumed by the CsdTheory/CsdPipes organs and the rhythm-cell
passes in `buildEvents`; an absent knob is byte-identical output by law. The
organs, the taste constraints ("locked in"), and the derivation rationale live
in docs/MUSIC-MIND.md.

Genres are **anchors** (249 of them as of 2026-07 — 178 at the expansion's
dawn, grown in four themed integration cycles: the synth gods, prog + the
Liverpool eras, the classical wing incl. the first real 3/4 waltzes, and
motown/funk + metal/nordic): named points with curated
values on every dimension, grounded in the genre literature (techno: rhythm-over-harmony, drones, DJ
form; house: 4-floor + claps, 8-bar additive builds; jungle: chopped breaks,
sub pressure, rhythm-as-melody; trip hop: slowed dusty breaks, jazz color,
melancholy; plus vaporwave, synthwave, lofi, downtempo, ambient, neoclassical,
dancepop, edm, dubstep, blues, jazz, dinosynth — dinosaur-themed dungeon
synth: dark-ambient drones, medieval choir, tribal log-drums, primordial swamp —
and canawave — proud Canadiana pop: bright major anthem, arpeggiated guitar,
toms + hi-hats, loon calls and the national news).

## Blending

`blend(a, b, t, rng)` is **not** naive lerp across the board:

- **Scalars** (bpm, reverb, pump, recipe params) lerp, then snap to feasible
  values.
- **Pools** (kits, progressions, basslines, fills, sources) form a weighted
  union: at t=0.3 you draw from A's pool with p=0.7, B's with p=0.3. You get
  *house drums under vaporwave harmony*, not a smeared average of two kits —
  hybrid identity comes from **combinatorial mixing, not averaging**.
- **Enums** (form, found role) switch probabilistically near the midpoint, so
  a journey has a *moment where the form flips* — an audible event, which is
  what makes the in-between space interesting rather than mushy.
- **Constraints** run last: drone progressions force lead density down;
  jungle-side tempo forces halftime pads; chops role requires a choppable
  source. Constraints are what keep midpoints *songs* instead of noise.

## Playlists as paths

`playlist(waypoints, nTracks, hours)` walks waypoint-to-waypoint (techno →
vaporwave → synthwave → jungle), placing each track at a position along the
path, then:

- **Tempo arcs** monotonically within a leg (with jitter) — a 6-hour set has
  DJ-shaped tempo geography, not random jumps.
- **Key walks** the circle of fifths ±1 step per track (never blended —
  adjacent tracks are mix-compatible, distant tracks genuinely far).
- **Novelty memory**: the generator remembers the last 2 tracks' kit,
  progression, bass, lead pattern, and found source, and *rerolls* any track
  matching ≥3 of those 5 fields (up to 6 attempts). This is the direct fix for "same
  drum fill and same effects across all songs" — repetition is rejected at
  generation time, not hoped away.
- **Duration** targets are met by scaling section counts and cycle counts per
  form (a 12-minute techno track is a long dj-form plateau; a 4-minute
  synthwave track is a pop form).

## Why this teaches genre

Every track ships with its coordinates: the state JSON records the blend
position and every resolved choice (kit, progression, recipe, source). A→B
playlists are *audible lessons* in what actually separates two genres — you
hear exactly which dimension flips when, because the kernel flips them one at
a time, not all at once.

## Timbre, mixing, sampling (v2)

Three lessons from listening, now structural:

- **Timbre is a dimension.** Every voice has a synthesis *model* chosen per
  anchor: pads saw/organ/FM, bass saw/sub/acid/reese, lead stack/pluck/FM,
  drums kick boom/808/909 · snare noise/crack/clap · hat noise/metal. Jungle's
  hiss-wall was three shared noise generators; now its snare is a tight crack,
  its kick an 808 sub, its hats sparse — and house claps while techno's 909
  clicks.
- **Mixing is a dimension.** Per-anchor compression (mix-bus `dam`), drum
  reverb sends (jungle/techno nearly dry — the wash was vaporwave leaking into
  everything), drum DELAY sends (dub throws on the snare), sidechain pump,
  crackle, tone tilt. The snare LEVEL is explicitly disciplined: ghost snares
  are quiet by construction and anchors keep snare under kick almost
  everywhere.
- **Sampling is a layer, not a bed.** `fetch-found-samples.sh` pulls real
  material: four Amen variants (source bpm in filename → chops beat-sync by
  pitch ratio), silence-split rave one-shots from a 1990s sample CD, and
  public-domain Apollo radio voice clips. Roles: `break` (slice-sequenced,
  patterns rotate per chord and mutate per seed), `hits` (one-shot
  stabs/shouts/vox as events, never loops), plus the granular `bed` and `chops`.
  Synth rave stabs (instr 6) ride chord roots on off-beat patterns.

**Humanity rule:** nothing loops verbatim. Melody phrases drop/push/octave-color
notes per chord; drum patterns vary per chord AND get a per-cycle pass (hats
drop out, levels breathe); fills resolve differently each time; break chops
re-slice every chord. All seeded — same seed, same song.

## The verifier loop

`genre-verifier.js` extracts 23 symbolic features from `buildEvents` (syncopation,
snare/kick balance, hat density, harmonic motion, seventh color, reverb wash,
sub presence, break usage, swing, compression, variation ratio) and scores any
state against per-genre target ranges. `node engine/genre-verifier.js matrix` builds a
**confusion matrix** over all anchors — the kernel is tuned until every genre
scores highest as itself (currently 249/249 diagonal-dominant). That's the
falsifiable answer to "does this actually sound like jungle?", and the loop to
re-run after every kernel change. Adding the `dinosynth` anchor (dinosaur-themed
dungeon synth) is a worked example: its tribal log-drum pulse + low swing are
what the matrix needs to keep it off ambient's and trip-hop's diagonals.

## Engine support (csd-engine.js)

The kernel emits ordinary engine states. New engine vocabulary added for it:
kits `techno`, `house`, `breaks`, `jungle`; bass `rolling`, `sub`, `stab`;
progressions `drone_min`, `deep_two`, `house_min7`; fill `break fill`;
production state fields `pump` (mix-bus sidechain duck), `crackle` (dust2
vinyl noise), `tone` {lowcut, highcut}; found role `"chops"` (slice
player) alongside the granular `"bed"`. All defaults preserve
existing renders.

## CLI

```bash
node engine/genre-kernel.js anchors                        # list genres + dimensions
node engine/genre-kernel.js track jungle --seed 7          # one track state -> json
node engine/genre-kernel.js blend techno vaporwave 0.5     # a midpoint state
node engine/genre-kernel.js playlist techno vaporwave synthwave jungle \
     --tracks 30 --hours 6 --out playlist/          # the full journey (json)
node engine/genre-kernel.js track jungle --seed 7 --render # faust press + ffmpeg -> mp3
node engine/genre-kernel.js journey genre-space-path.json \
     --hours 4 --out journey/ --render --video      # a DRAWN path -> hours of
                                                    # mp3s + genre-affine video +
                                                    # journey.mp3/.mp4 + mix page
```

## Journeys (drawn paths → hours of music + video)

The explorer's **⤓ path** button exports the drawn waypoints as
`genre-space-path.json` — each waypoint carries its blend weights
(`[{g,w},…]`), so a point *between* anchors is a first-class waypoint.
`journey()` generalizes `playlist()`: waypoints may be genre names **or**
weight vectors; weights lerp along each leg and every track resolves via the
same N-way `resolveMulti` the live explorer uses, with playlist discipline
(key walks the circle of fifths, novelty memory rerolls repeats, duration
targets met by section/cycle scaling). `--render` produces per-track mp3s,
one gapless `journey.mp3`, and the mix page; `--video` renders each track's
mp4 (`render-sample-video.js journey <state>`) with clips drawn from a
per-genre affinity pool — a blend's pool is the union of its parents' pools,
dominant genre first, cuts locked to section downbeats — then concatenates
`journey.mp4`.

## Simulating a path

Three fidelity levels, fastest first — pick by the question you're asking:

1. **Virtual ride** — `node tools/simulate-path.js <default|path.json|genreA,genreB,…>
   [--seed N] [--pace 256] [--bars auto|N] [--json]`. Drives the REAL app
   headless (the explorer's own `travelStep()`/`glideStep()`, no forked logic)
   but with **no audio clock**: a bar is an iteration, so a full pace-256
   default loop (768 bars) simulates in ~8s. Per virtual bar it samples the
   blend weights, flip queue, and the playing state's identity (kit / lead /
   bass / bpm / meter / progression); per dominant-genre segment it checks the
   transit-arrival contract (identity within ≤8 bars of dominance) and runs
   the musicality audit on the segment's most-settled state. Answers: *does
   this path's every crossing actually arrive and hold musical law, at the
   state level?* Cannot answer anything about sound. Gated by
   `test/simulate-path-run.js` (default loop, deterministic per seed).
2. **Headless live gates** — `test/transit-arrival-run.js`,
   `test/explorer-ui-test.js`'s ride, `test/blend-arrival-run.js`: the real
   Faust engine in headless chromium, realtime, real RMS and real
   `note()` scheduling. Answers: *does it SOUND — do the promised instruments
   reach the graph?* Minutes per ride, so used on pinned slices.
3. **Journey CLI full render** — `node engine/genre-kernel.js journey
   <path.json> --hours 4 --render --video`: the offline press. Answers:
   *ship it* — hours of mp3/mp4 for human ears.

