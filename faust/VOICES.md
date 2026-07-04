# VOICES.md — csound model → Faust module map (Phase 1)

Every synthesis model the kernel can emit, ported to a precompiled WASM module
in `dist/` (source in `dsp/`). Verified by `node legacy-tools/ab-render.js`
against the legacy csound engine (runs on branch `legacy-csound`, which keeps
the csound codegen) — see `ab-report.md` (**40 PASS / 2 CHECK**, both CHECKs
are deliberate substitutions). Rebuild with `node build.js`;
`dist/manifest.json` lists every module's IO count + param addresses for the
Phase-2 engine.

Conventions shared by all voice modules:
- `gate` (button) + `freq` (Hz) where pitched; `level` = recipe level,
  `gain` = per-note velocity (csound p5). Drum modules fold velocity into
  `level` and their `decay` = the csound p3.
- csound `transeg 1,p3,-k,0` decays are note-ON-triggered exponentials with
  tau = p3/k (`dec(tau)` in the sources) — NOT gate-release envelopes.
- Tonal drums use phase-reset sines (`oscr`) because csound re-instantiates
  oscillators per note; a free-running osc clicks at note-on.

## Drums

| model | module | params beyond gate/level | notes |
|---|---|---|---|
| kick boom | `kick_boom` | decay, tune | level pre-tanh like csound iamp |
| kick 808 | `kick_808` | decay, tune | |
| kick 909 | `kick909` | decay, tune | pitch 165→55, 5 ms HP click |
| snare noise | `snare_noise` | decay | bp 1800 + 300/185 Hz body |
| snare crack | `snare_crack` | decay | bp 3100, tau p3/9 |
| snare clap | `snare_clap` | decay | 41 Hz amplitude flutter |
| hat noise | `hat_noise` | decay | decay is the open/closed axis |
| hat metal | `hat_metal` | decay | 6317/8429/10781 squares |
| tom | `tom` | pitch, decay | dual-path tanh dirt, clack bp |

## Bass

| model | module | params | notes |
|---|---|---|---|
| saw | `bass_saw` | cutoff, res, release, fenv | moog_vcf_2bn (see "ladder" below); release/fenv only set when the recipe asks |
| sub | `bass_sub` | cutoff | sine → tanh(1.6) → LP |
| acid | `bass_acid` | cutoff, res, release, fenv | fenv default 3 = the stock note-on cutoff×4 zap, settles at 0.16 s; per-recipe override |
| reese | `bass_reese` | cutoff | ±0.6 % saw pair → LP → tanh |
| wobble | `bass_wobble` | cutoff, res, wobbleHz | LFO on ladder cutoff |
| piano | `piano` | (shared module) | engine maps cutoff·2.5 capped 4 k |

## Pads / shared timbres (pad ↔ lead via attack/cutoff mapping)

| model | module | params | engine cutoff mapping (from csd-engine) |
|---|---|---|---|
| saw (default pad) | `pad_saw` | cutoff, res, detune, attack | recipe cutoff as-is; 0.3 Hz wow built in |
| organ | `organ` | cutoff, attack | min(9000, cutoff·2.2) applied inside |
| strings | `strings` | cutoff, attack | butlp(cut) + butlp(cut·1.6) inside |
| choir | `choir` | cutoff, attack | pass min(8–9 k, cutoff·2.5); sings octave below, 4.7 Hz vibrato |
| fm (pad) | `fm2op` | ratio=2.001 idx0=2.6 idx1=0.9 idxTime=1.1 | pass min(8000, cutoff·1.7) |
| fm (lead) | `fm2op` | ratio=1.4 idx0=3.5 idx1=1.0 idxTime=dur/2 (+decay/sustain/release/fenv when the recipe is plucky) | pass recipe cutoff |
| brass | `brass` | cutoff (cap), bite, attack | bite = note velocity (csound p5·16000 brightness) |
| piano | `piano` | cutoff, decay(=note dur) | pad min(8k,c·2) / lead min(9k,c·2) |
| bell | `bell` | cutoff, res, decay(=note dur) | internal butlp(c·2.5 cap 10k) + moog(c) like instr 4 |
| rhodes | **DX7 E.PIANO 1** | — | substitution, see below |

## Leads

| model | module | params | notes |
|---|---|---|---|
| stack | `supersaw` | voices(1–7 runtime), wave(0 sine/1 saw/2 square/3 pulse), detune(=spread), octave, vibrato+vibRate, attack/sustain/release, fenv, cutoff, res | covers 2-osc city-pop stack AND 7-voice supersaw; voices≤2 center off by spread/2 (~3 cents) vs csound |
| pluck | `lead_pluck` | cutoff, res, damp, release, fenv | KS comb; csound `pluck` averaging is darker — damp 2000 default matches |
| kpluck (KS guitar) | `lead_kpluck` | cutoff, drive, flangePos | dual+octave KS, body resonators 118/230, chorus, flanger. csound's flanger sweeps absolute song time; engine automates `flangePos` 0→1 instead |
| fuzz | `lead_fuzz` | cutoff, res, drive, vibrato, attack/sustain/release, fenv | pure tanh drive (ef.cubicnl added even harmonics the csound fuzz lacks — A/B'd out); res-loss trim restores moogladder passband droop |
| brass / strings / choir / bell / piano / fm | shared modules above | | |
| guitar | `lead_guitar` | cutoff, pluckPos | **substitution** — pm.lib waveguide replaces the CLI-only TimGM6mb.sf2 sfplay (samples can't ship to the browser). Darker than the sf2 steel guitar (A/B CHECK, intended) |
| vocoder | `robot_choir` | cutoff, res, makeup | ve.vocoder 32-band channel vocoder; speech is an AUDIO INPUT (in 0). Envelope-correlation verified (vocoder-test.js) + A/B PASS |

## modeld — the Minimoog-Model-D-class MONO voice (2026-07)

`modeld` (dsp/modeld.dsp) is a signature mono package, lead AND bass capable
(state-engine resolves model `"modeld"` for melody/solo/bass; NEVER pads —
mono can't voice chords, kernel pools respect that):

- **3 oscillators** saw / saw(+6c) / saw|pulse(−8c); `oscMix` blends osc3
  saw→pulse (duty 0.26). Fixed detune spread plus `drift` = slow random
  lfnoise cents-wander per osc (analog instability; three distinct
  trajectories via different rates + one mirrored).
- **4-pole ladder** `ve.moog_vcf_2bn` with EMPHASIS (`res`) and a punchy
  **filter envelope**: ADS contour, `envAmount` in OCTAVES above `cutoff`
  (the wah-punch), `envDecay` sets both decay and filter release (the
  Model-D decay-switch behavior). `envAttack`/`envSustain` exposed, defaults
  0.004/0.25.
- **`drive`** = gentle tanh pre-filter (loudness-compensated).
- **GLIDE** (`glide`, ms): exponential freq slew toward the target note —
  tau = glide/4.6, i.e. settles within 1% at ~glide ms. Slew is always
  active when glide > 2 ms (non-legato retriggers glide from the previous
  note too — authentic).
- Loudness contour: fast attack (default 4 ms) → 0.08 settle → singing
  sustain → release. Recipe attack/sustain/release map straight through.

**MONO-LEGATO scheduler contract** (`mono:true, legatoSec:0.03` on the unit
spec): the engine routes ALL of the unit's notes to ONE voice instance and
holds the gate across legato groups — notes whose gap to the previous note is
< 30 ms (or which overlap) join the running group: the pending gate-off is
withdrawn, `freq` slews inside the module, and the envelopes single-trigger
(no retrigger mid-phrase, like the real thing). press.js implements this in
its allocation loop. **LIVE GAP**: live.js's generic pool ignores `mono`
(POOL_SIZE forces melody=3/bass=2 and gates per note) — every note still
plays at the right pitch/time and glide is audible on reused nodes, but
envelopes retrigger on legato notes and overlapping notes may land on a
different node (gliding in from that node's stale freq). The live side needs:
(1) pool size 1 when `u.mono`, (2) merge gate-off/gate-on pairs when the next
event's tOn − prev tOff < `u.legatoSec`. Next round.

Kernel homes: synthwave lead (hero lines, glide 60–150 ms), darksynth
lead+bass, edm bass, krautrock bass drones (shallow slow env, heavy drift),
disco + italo bass options (tight 15–40 ms glide), spacelounge lead option
(the ondes swoop, glide 80–150 ms). Recipe keys: cutoff, res, envAmount,
envDecay, glide, drive, oscMix, drift (+attack/sustain/release).

## SFX / stab

| what | module | params |
|---|---|---|
| riser/sweep/downlift/impact/reverse/noise (instr 20) | `sfx` | type 1–6, dur (=p3; hold gate for dur), amp |
| rave stab (instr 6) | `stab` | freq, decay, gain |
| master filter sweep (instr 96) | `fx_bus` `mcut` param | engine automates exponentially, like `gkCut expon` |

## Per-voice inserts (state.instruments.\<voice\>.inserts)

The kernel may put 0-2 insert effects on any pitched recipe (pad/bass/melody;
solos inherit melody's chain via soloVoices' recipe merge). They are applied
INSERT-style between the voice and its layer tap / fx sends — never on the
shared buses. `state-engine.insertChain` normalizes the contract (rate = Hz,
`rateBars` = sweep period in bars, filtersweep `lo/hi` = OCTAVES relative to
the voice's recipe cutoff → converted to Hz per voice); modules exist only
when a state requests them.

| type | module | params | notes |
|---|---|---|---|
| distort | `insert_distort` | drive, mix (+tone, default 4500) | ef.cubicnl + 1-pole tone; −14 dB/drive makeup keeps mix rides from being volume rides |
| phaser | `insert_phaser` | rate, depth, mix | hand-rolled 4-stage tf1 allpass (shared coeff), fb 0.5, 180–3200 Hz exponential sweep |
| chorus | `insert_chorus` | rate, depth, mix | modulated fdelay 15 ms ±9 ms·depth (6–24 ms) |
| filtersweep | `insert_filtersweep` | rateBars, lo, hi, res, **barSec** | moog_vcf_2bn, raised-cosine LFO starting at lo; the ENGINE sets `barSec` (= 4·spb) from state.bpm and re-sets it on glides — full-wet by design |

mix 0 is a bit-exact bypass (verified) — live never disconnects to bypass.
Live wiring (live.js `ensureInserts`): pool voices sum into `pre` →
chain → `tail` → `post` → pool-level dry/rev/del/pp sends; type changes
rebuild the chain under a ~20 ms crossfade (old tail→0, new tail→1), param
changes glide via setTargetAtTime, and the four processor registrations are
prewarmed ~1.5 s after go-live (a mid-run type swap otherwise stalls the
render thread ~10 ms on audio-thread module setup). Pools with no inserts
keep the original per-node routing — a no-insert state renders byte-identical
to pre-insert builds (regression-gated). Press (press.js): voices accumulate
into a unit buffer, the chain processes it whole-song (continuous LFO phase +
tails), then the unit's dry/rev/del sends apply.

## fx_bus (the whole master section, stereo out)

Inputs: `0 dryL, 1 dryR, 2 reverb send, 3 delay send, 4 ping-pong send,
5 sidechain source`. Unused inputs take silence.

| csound | fx_bus | params |
|---|---|---|
| instr 99 reverbsc | zita_rev1 (f2 2000, t60 5.0/3.5, return tone param) | `rgain` ≈ state.reverb·3.2 (A/B-calibrated); `rtone` return lowpass (default 2000 = legacy fixed value; live eco-3 dulls to 900) |
| instr 98 delay | tone-in-loop feedback delay | `dtime dfb dcut dgain`; bleeds ·0.2 into reverb |
| instr 95 ping-pong | cross-fed letrec pair | `pptime ppfb pptone`; ·0.12 into reverb |
| instr 97 crackle | no.sparse_noise dust + hiss | `crackle` |
| pump | phasor duck `1-pump·e^(-6φ)` blendable with an.amp_follower on input 5 | `pump bps scmix` |
| grit | tanh drive w/ dry-blend bypass at 0 | `grit` |
| comp (dam) | co.compressor_stereo + makeup | `comp` (ratio/thresh derived like dam) |
| tone tilt | butterworth high/lowpass | `lowcut highcut` |
| instr 96 sweep + clip | lowpass `mcut` → Bram-de-Jong soft clip (limit 0.95, knee 0.5 — exact csound `clip` method 0, caps at 0.7125 = -2.9 dB) | `mcut` |

## DX7 patch family

`dx7_alg5 / dx7_alg17 / dx7_alg22` + `sysex2params.js` + `dx7-presets.json`
(E.PIANO 1, TUB BELLS → alg 5; SYN-BASS 2 → alg 17; BRASS 2 → alg 22).
Adopted substitutions and available upgrades:

- **rhodes → E.PIANO 1 (alg 5)** — active substitution (A/B row `pad_rhodes_DX7`).
- **bell → TUB BELLS (alg 5)** — optional; the direct `bell` port PASSes, so the
  DX7 patch is an alternate color, not the default.
- **BRASS 2 (alg 22) / SYN-BASS 2 (alg 17)** — available as solo-lead/bass
  alternates; direct ports PASS so these stay opt-in per genre.
- **GOTCHA:** dx7.lib exposes NO output-gain param — scale DX7 voices with a
  GainNode (they run ~15 dB hotter than the csound pads at recipe levels).
  Per-note velocity is that same external scale: `min(1, extGainPerAmp·amp)`
  (GainNode in live, `@out` pseudo-param in press's PCM mix).
- **state.dx7 contract:** an instrument recipe carrying
  `{dx7:{algorithm:N, params:{"/Operator_…": v, …}}}` (melody/pad/solo/bass)
  plays `dist/dx7_alg<N>` with those params applied at `/DX7<suffix>`
  (full `/DX7/...` addresses also accepted). press.js generates + compiles a
  missing `dsp/dx7_alg<N>.dsp` on first use (per-algorithm builds — the
  runtime 32-algo switch OOMs libfaust-wasm); live loads only what's in
  `dist/`, so press once (or `node build.js dx7_algN`) to materialize new
  algorithms for the browser.

## Known gaps / Phase-2 notes

- **ve.moogLadder in the bundled faustlibraries (faustwasm 0.16.5 / Faust
  2.85.8) is broken** — measured cutoff ∝ normFreq^~2.5 with ~-60 dB passband
  loss (see session A/B round 1). All ladder filters use `ve.moog_vcf_2bn(res,
  fcHz)` instead, which matches csound moogladder semantics (Hz + res 0..1).
  The FAUST-PORT.md port map's "ve.moogLadder" line is superseded.
- `supersaw` computes 7 voices × 4 waves and gates at runtime — pure-param
  timbre morphs, ~28 cheap oscillators. If worklet CPU matters, split
  per-wave variants at build time.
- `piano`/`bell` take `decay` = note duration (csound decays span p3); the
  scheduler must pass it per note. Their attacks are fixed-fast; a pad-slow
  attack param is a possible refinement (pads currently use them rarely).
- kpluck's song-length flanger evolution is a param (`flangePos`), so the
  scheduler owns the 164 s ramp.
- Drum `decay` = csound p3: kick 0.3, snare 0.15, hat 0.06–0.3 (open), tom 0.4
  are the score-typical values used in the A/B.
- `sfx` needs gate HELD for `dur` (the event length), not a trigger tick.
- bass piano / lead strings etc. share modules — the engine maps recipe→params
  per role exactly as csd-engine.js codegen did (mappings in the tables above).
- fx_send A/B passes with `rgain = reverb*3.2`; the old prototype mapping
  (`*2.2` in offline-render.js/engine.js fixtures) is conservative but fine.
- `state.snarePP`: buildEvents tags sparse snare hits with `d.pp`; the engine
  routes it as a per-EVENT ping-pong send (csound instr 11 p5 → gaPPL) — a
  per-node GainNode into the pp bus in live, `@pp` pseudo-param in press.
- per-recipe articulation (csound instr-4 "plucky" opt-in): setting ANY of
  attack/release/fenv on a lead recipe swaps the legacy sustained env for
  attack → 0.06 decay → sustain → release and an optional filter zap
  (`fenv`: cutoff·(1+fenv) settling to cutoff at attack+0.06). Mapped onto
  supersaw / fm2op / lead_pluck / lead_fuzz; bass_saw/bass_acid take
  release/fenv when the recipe sets them. Defaults reproduce the A/B'd
  legacy behavior exactly.
- Found-sound (instr 3/5 syncgrain/table chops) is deliberately NOT ported:
  per FAUST-PORT.md it moves to native AudioBufferSourceNodes + a JS scheduler.

## SAMPLER voice model + the expanded DX7 bank (2026-07 variety round)

- **sampler** (model `"sampler"`): real sampled instruments through the NATIVE
  buffer path (faust/sampler.js — AudioBufferSourceNode live, PCM mix in
  press), not a Faust module. Contract: `instruments.<voice>.sampler = {id,
  sr, zones:[{srcId, root, lo, hi, loop, loopStart, loopEnd}]}`; zone wavs
  ride `foundSources` at vol 0 (both engines decode through existing paths;
  live decodes RAW — no found-player lead-in trim, which would break loop
  offsets). playbackRate = 2^((midi−root)/12), root may be fractional (SF2
  fine-tune); looped zones sustain under the gate, attack/release from the
  recipe declick. Kernel: `samplerPool` per voice, resolved like patchPool;
  registry + zone tables in genre-kernel.js `SAMPLERS`. Zones are extracted
  from FluidR3_GM (MIT) by **faust/sf2.js** at fetch time — that is also the
  answer to "can Faust play soundfonts": Faust's `soundfile` can't read SF2,
  the engine's native sampler plays extracted zones instead. Instruments:
  alto/tenor sax, trumpet, flute, clarinet, vibraphone, string ensemble,
  nylon + steel guitar, bandoneon (tango's voice), upright acoustic bass +
  percussive/rock organ (the 2026-07 blues acoustic pass). Inserts are
  dropped on sampler voices (constrain) so live and press render identically.
  The BASS voice is sampler-capable too (kernel `bass.samplerPool` →
  `instruments.bass.sampler`, same contract; state-engine resolves model
  "sampler" for every role, with a shorter default attack/release on bass so
  looped zones never smear a walking line).
- **Blue-note bend** (per-note, sampler-only): a pitched event may carry
  `bend: {from, ms}` — `from` in SEMITONES (negative = start under pitch,
  the blues slide), `ms` = glide length. The engines map it to a playbackRate
  glide into the target pitch: live = `linearRampToValueAtTime` on
  `source.playbackRate`; press = the same linear-in-rate ramp accumulated
  sample-wise in `sampler.js mixPCM` (unbent notes keep the bit-exact fixed-
  rate path). csd-engine's "blues" lead pattern marks ~30-40% of phrase notes
  (seeded, biased onto thirds/fifths) with `from` −0.5..−1, `ms` 60-140.
  NON-sampler voices ignore `bend` — no Faust module has a matching param.
- **DX7 bank**: dx7-presets.json now carries **114 presets** decoded from the
  eight Yamaha factory ROMs (sysex2params.js; provenance in SOURCES.md), all
  render-audited non-silent. Every algorithm the bank needs is precompiled
  (24 `dx7_algN` modules in dist/). Anchors reference them via `patchPool`;
  same-algorithm pools (the alg-5 E.PIANO/TUB BELLS/SHIMMER family, alg-22
  brass, alg-29 organs, alg-17 basses, alg-18 horns) morph param-space in
  blends.

## Rubato + felt piano + swell + thunks (2026-07 neoclassical deep pass)

- **RUBATO — the time dimension** (`state.rubato = {depth, periodBars,
  phase}`): deterministic slow tempo-breathing, implemented in exactly ONE
  place — a smooth monotonic **beat-warp at the end of csd-engine
  `buildEvents`** (`warp(b) = b + A·(sin(2πb/P + φ) − sinφ)`, `A =
  depth·P/2π`, `P = periodBars·4` beats, φ seeded by the kernel). Every
  consumer maps beat → time linearly with spb, so faust/press, faust/live and
  midi-export all inherit the same warped musical clock and **all layers stay
  sample-locked by construction** (same beat ⇒ same time; live drift-gate
  measured worst co-beat skew 0.15 ms across pad/melody/counter/found).
  Durations warp as intervals (legato stays legato); `warp(0)=0`; strictly
  monotonic for depth < 1. depth .02-.04 ≈ ±2-4% tempo sway. LIVE NOTE: live
  rebuilds per chord-bar with cycle-local beats, so the breathing phase
  restarts each section cycle — still deterministic and layer-locked, just
  not phase-continuous across cycles the way a press is. States without
  `rubato` skip the warp entirely (unchanged genres press byte-identically —
  regression-gated). Kernel: anchors carry `rubato:{depth, periodBars, prob}`
  (neoclassical always, tango .5, jazz light .35), drawn AFTER the insert
  chains so genres without the spec consume zero rng.
- **felt_piano** (SAMPLERS): FluidR3 GM 0 "Yamaha Grand Piano", 10 zones
  (dense midrange — the lead is exposed), with a 3 kHz lowpass BAKED into the
  zone wavs at extraction (fetch-found-samples.sh; sample counts unchanged so
  loop points stay valid). Soft velocity (low recipe level), slightly slow
  attack (.015-.04) and close/dry sends live in the neoclassical recipe.
  Neoclassical lead AND bass are 2/3+ this instrument; lofi/spokenword carry
  it in their lead samplerPools as an option.
- **sampler SWELL mode** (`recipe.swell` ≥ .5 → `sampler.swell`): attack may
  run seconds long (past a zone's loop start — looped zones sustain under
  it; state-engine clamps widened to atk 5 s / rel 6 s) with an x²-shaped
  crescendo ramp rendered identically in both paths (per-sample x² in
  sampler.js mixPCM; a 17-point gain curve via setValueCurveAtTime live).
  Non-swell notes keep the exact original linear declick ramp
  (bit-identical). Used by neoclassical's sampled-strings pads
  (attack .8-2.5 s, release 1.5-3 s) — the per-phrase string swell.
- **COUNTERPOINT** (kernel `counterpoint:{prob}` → `sections[].counter` in
  the wave form's drift/swell): a second, quieter instance of the lead
  instrument (solo recipe merges over instruments.melody — a felt-piano lead
  gets a felt-piano counter voice) an OCTAVE BELOW at ~.45× level, on a
  mirrored/oblique pattern (arpup↔arpdown = contrary; canon/wander → sparse
  long tones = oblique; sparse → quiet wander). Rides the existing
  sec.counter/soloVoices mechanism (transitwave's motorik23 pioneered it).
- **key/pedal THUNKS** (`state.thunk = {prob, amp}`): whisper-level tom hits
  (pitch 90-160 Hz, level ≈ −30 dB) co-located with a seeded fraction of lead
  notes, added in buildEvents AFTER applyGroove so the thunk lands with the
  humanized key strike. Own rng stream; absent = zero behavior change.
