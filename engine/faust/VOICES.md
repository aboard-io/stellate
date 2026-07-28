# VOICES.md — csound model → Faust module map (Phase 1)

Every synthesis model the kernel can emit, ported to a precompiled WASM module
in `dist/` (source in `dsp/`). Verified by the per-voice A/B harness against the
legacy csound engine — both the harness (`ab-render.js`) and the csound codegen
live on branch `legacy-csound` — see `../docs/history/ab-report.md` (**40 PASS /
2 CHECK**, both CHECKs are deliberate substitutions). Rebuild with `node build/build.js`;
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
| vocoder | `robot_choir` | cutoff, res, makeup | ve.vocoder 32-band channel vocoder; speech is an AUDIO INPUT (in 0). Envelope-correlation verified (test/unit/vocoder.test.js) + A/B PASS |

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
its allocation loop. **LIVE (fixed 2026-07, synth-fleet round)**: live.js now
honors `mono` — `ensurePool` forces pool size 1 when `u.mono` (the `pool:1`
hint wins over the POOL_SIZE role table), and `injectChord` schedules mono
units in a dedicated pass that ports press's grouping: all notes route to
node 0, per-note freq/params are set before gate-on (the module slews), and a
note whose `tOn` is within `legatoSec` of the previous note's gate-off HOLDS
the gate (the pending gate-off is cancelled, no new gate-on) so envelopes
single-trigger. `pool._monoOff` carries the pending gate-off across bars.
Verified by `test/probes/modeld.probe.js`: nodes 3→1, all notes on node0, envelope
re-attacks many→1, glide active. (This live fix is what tb303 slide and
synclead legato also ride.)

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
| wah | `insert_wah` | sens, base, range, q, mix | fx wings stage 3: crybaby/Mutron AUTO-WAH — an amp-follower (6 ms/140 ms) drives a resonant `fi.resonbp` exponentially `base → base·2^range`; sens = envelope drive, q = the vowel. No clock needed. Homes: disco/newjack/afrobeat BASS pools (test/probes/wah.probe.js: steady loud opens 1720 Hz vs quiet 709 Hz; the sampler-bass constraint drops it like every insert) |
| higain | `insert_higain` | gate, drive, stages(1-3), tone{low,mid,high}, presence, level, mix | SYNTHESIS-DEPTH: the STAGED heavy amp (see section below) — tightness gate → 3 cascaded hand-rolled shapers w/ inter-stage HP → 3-band tone stack → fixed 4x12 cab → level comp + dcblocker. IDENTITY insert (never shed). NOT excluded on samplers (unlike distort — but a genre declaring higain must not also declare heavy strip distortion) |
| fenv | `insert_fenv` | sens, amount(oct ±), attack, decay, base, res, mix | SYNTHESIS-DEPTH: note-triggered FILTER ENVELOPE for SAMPLED voices — amp-follower contour sweeps a moog_vcf_2bn ±`amount` octaves around `base` (defaults to the voice cutoff; top fenced by cutMaxForRes). Negative amount = reverse squelch. Synth models use the fenv* params instead |

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
| 3-band glue (fx wings stage 4) | **`master_mb` — a separate OPT-IN module AFTER fx_bus**, not baked in: 2nd-order splits at 250 Hz / 2.5 kHz, mid derived by subtraction (sums exactly flat), per-band co.compressor_stereo + wet-only makeup | `mbdrive` ← `state.masterComp` (kernel dim, dominant-parent zero-rng; disco 0.35). Baking it into fx_bus cost EVERY genre ~0.01 live load even at drive 0 (both Faust select paths compute) — live gate 0.977/0.973 PASS → 0.969/0.967 FAIL, so it was extracted (test/probes/mbcomp.probe.js). Press post-passes L/R; live series-inserts fx→master_mb→master under a crossfade against the `fxDirect` unity path; genres without masterComp keep committed fx_bus bytes and never build the node |
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
  `dist/`, so press once (or `node build/build.js dx7_algN`) to materialize new
  algorithms for the browser.

## Known gaps / Phase-2 notes

- **The bundled faustlibraries' NORMALIZED-FREQUENCY Zavalishin/TPT ladder
  family is BROKEN — `ve.moogLadder` AND `ve.diodeLadder` (and the korg35*
  siblings).** `ve.moogLadder` measured cutoff ∝ normFreq^~2.5 with ~-60 dB
  passband loss (session A/B round 1). `ve.diodeLadder(normFreq 0-1, Q)` is the
  SAME normalized-freq TPT topology (tb303's commission asked for it; it could
  not be empirically verified and is treated as broken by association — confirmed
  the whole normalized-freq family is off). **Rule: every ladder filter uses
  `ve.moog_vcf_2bn(res 0..1, fcHz)`** — Hz-native, stable, self-oscillating as
  res→1, matches csound moogladder. tb303/synclead/juno60/ppg all use it. The
  FAUST-PORT.md port map's "ve.moogLadder" line is superseded.
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
  buffer path (faust/voices/sampler.js — AudioBufferSourceNode live, PCM mix in
  press), not a Faust module. Contract: `instruments.<voice>.sampler = {id,
  sr, zones:[{srcId, root, lo, hi, loop, loopStart, loopEnd}]}`; zone wavs
  ride `foundSources` at vol 0 (both engines decode through existing paths;
  live decodes RAW — no found-player lead-in trim, which would break loop
  offsets). playbackRate = 2^((midi−root)/12), root may be fractional (SF2
  fine-tune); looped zones sustain under the gate, attack/release from the
  recipe declick. Kernel: `samplerPool` per voice, resolved like patchPool;
  registry + zone tables in genre-kernel.js `SAMPLERS`. Zones are extracted
  from FluidR3_GM (MIT) by **faust/build/sf2.js** at fetch time — that is also the
  answer to "can Faust play soundfonts": Faust's `soundfile` can't read SF2,
  the engine's native sampler plays extracted zones instead. Instruments:
  alto/tenor sax, trumpet, flute, clarinet, vibraphone, string ensemble,
  nylon + steel guitar, bandoneon (tango's voice), upright acoustic bass +
  percussive/rock organ (the 2026-07 blues acoustic pass).
  **INSERTS-ON-SAMPLED-VOICES (2026-07-10):** a genre's EXPLICIT resolved
  insert chain (`instruments.<voice>.inserts`, the kernel's prob/pool axis) is
  HONORED on the native lane — press/stream mix the unit PRE-SEND into a
  unit-local buffer, run the SAME dist/ `insert_*` modules synth units use
  (render-core's insert law: chain whole-song/windowed-persistent, sends
  after), and the live ring path builds per-UNIT Web Audio twins
  (`sampler.js buildInsertNodes`) between the notes and the unit sends.
  Exclusions: `distort` stays folded into the heavy/gritted channel strip
  (never doubled), and the two-per-voice DEFAULT chain never applies to
  sampled voices (the channel strip is their house FX) — a voice with no
  declared inserts renders byte-identically to the pre-insert engine. When a
  declared chain is honored, the hashed voiceFxStage extra strip stage is
  skipped (the genre's own choice wins). Gate: segment-parity trance_s1 /
  citypop_s2 (byte-equal press↔stream), test/browser/sampler-inserts-live.test.js.
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

## Synth fleet — nine classic-synth voices (2026-07)

Nine hand-modelled instruments (`dsp/{juno60,tb303,solina,hammond,synclead,
casiocz,oberheim,ppg,vp330}.dsp`), each probe-verified on real renders. The
kernel resolves them as plain `model` strings (state-engine `pitchedUnit`;
csd-engine `isModel` lists them). Recipe params default to sensible values in
state-engine, so a genre can wire a voice with **model-only** (adding the name
to a `recipe.model` pool) and get a good sound with **zero rng shift** — only
`pick()` (one draw, length-independent) moves. Signature params (`chorus`,
`ensemble`, drawbars, `syncSweep`, `scan`, `vowel`…) are added to a recipe only
where the extra rng draws don't tip a genre off its verifier diagonal.

| voice | module | role | out | pool | signature dims (recipe keys) | genre homes |
|---|---|---|---|---|---|---|
| Juno-60 | `juno60` | pad/keys | **stereo** | 4→3 | chorus 0-2, chorusSpread, saw/pulse/sub/noiseLevel, pwmBase/pwmLfo, SIGNED envAmount, lfoToFilter, keytrack; one shared ADSR | synthwave/italo/citypop/house pads |
| TB-303 | `tb303` | bass/lead | mono | **1** | resonance, envmod, decay, waveform (0 saw→1 sq); per-note accent/slide | acidhouse/psytrance bass (**supersedes bass_acid**), acidhouse lead |
| Solina | `solina` | pad | mono | 6/4→3 | ensemble (identity), chorusRate/Depth, octave; **cutoff→tone**, NO res, inserts dropped (ensemble is the chorus) | sovietwave/italo/newage pads |
| Hammond B-3 | `hammond` | pad/keys | **stereo** | 4→3 | 9 drawbars bar16..bar1 (0-8, THE morph), leslie, perc/percHarm/percDecay, click, leak, drive | house/krautrock/blues (comp) |
| sync lead | `synclead` | lead/solo | mono | **1** | syncRatio, syncSweep (env), syncDecay, syncDetune, envAmount (oct); modeld glide/legato contract | darksynth/edm/italo leads |
| Casio CZ | `casiocz` | keys/lead | mono | 4 | czWave (halfSine→pulse), index, dcwAmount + dcwAttack/Decay/Sustain (DCW contour = identity), czDetune | chiptune/electro/phonk leads, mallsoft pad |
| Oberheim SEM | `oberheim` | pad | mono | 4→3? | filterMode (LP/BP/HP morph), envAmount (oct), osc2lfo, pmFM, pmFilt (poly-mod), obDetune, osc2tune | wintersynth/darksynth/sovietwave pads |
| PPG Wave | `ppg` | pad/lead | mono | 4/3→3 | scan (STAR dim — wavetable position), scanEnv (signed), scanLfo/scanRate, envAmount, sub, drive | witchhouse/coldwave/idm |
| VP-330 | `vp330` | pad | **stereo** | 4→3 | vowel (oo→ah), breath, ensemble (width), vpDetune; dark, cutoff→straight | sovietwave/witchhouse/newage/dinosynth pads |

Engine-level integration this round:
- **Stereo voice branch** (juno60/hammond/vp330, `manifest outputs===2`, unit
  flag `stereo:true`). **press.js**: channel [0]→wide-L, [1]→wide-R buses;
  sends use the mono sum; fx_bus dry-L/R inputs = `dry + wL/wR`. **live.js**: a
  ChannelSplitter on `dryBus` routes ch0→merger-L, ch1→merger-R — mono voices
  up-mix to L=R (centered, unchanged), stereo voices keep width to the fx_bus.
  Every stereo DSP's channel 0 is a full mono signal, so any path that reads
  only [0] degrades gracefully. Confirmed: citypop juno60 render has both
  channels non-silent + a real L−R side signal.
- **Live pool cap 3** for the heavy fleet voices (juno60/hammond/vp330/solina/
  ppg) — a section swap otherwise instantiates 4 heavy worklets at once and
  dipped the load meter; declick voice-steal covers the 4th-note overlap (same
  rationale as the dx7 cap at 2).
- **tb303 accent/slide**: csd-engine `buildEvents` tags acid bass steps with
  `ev.accent`/`ev.slide` (0..1) — ONLY when `instruments.bass.model==="tb303"`,
  on its own rng stream, so every other render is byte-identical. mapEvents
  copies them into per-note `sets` for `u.acid` units; press + the live mono
  pass set them before gate-on. Every non-303 voice ignores accent/slide.
- **DX7 morph caveat** (explorer.html): `timbreId` no longer includes
  `dx7.name` — a same-algorithm patch change is morphed by the glideStep param
  lerp, so the name only queued a redundant one-bar discrete flip (~22% of
  |B−A| snap). Topology changes still flip via `dx7.algorithm`.

## Reverb COLOR family — reverb as a genre dimension (2026-07 fx wings)

Four selectable reverb characters (`dsp/reverb_{dattorro,greyhole,fdn,spring}.dsp`),
exposed per genre via `state.reverbColor` (a string). Absent / `"zita"` /
`"default"` = the fx_bus **internal zita** (byte-identical to pre-wings renders).
A color names an EXTERNAL module that REPLACES the internal zita for that genre.

| module | character | homes | notes |
|---|---|---|---|
| `reverb_dattorro` | clean figure-8 plate (RT≈1.4s, bright) | citypop, house | `re.dattorro_rev` |
| `reverb_greyhole` | huge diffuse smear (RT≥3s) | witchhouse, dinosynth | `re.greyhole` (heavy: ~50KB, 11s compile) |
| `reverb_fdn` | dry room, NOT a wash (RT≈0.5s) | tango, blues, prelude | `re.stereo_freeverb` (Schroeder, small room) |
| `reverb_spring` | boing/flutter spring tank (RT≈1.2s, dark) | surfrock | hand-rolled: dispersive allpass cascade + modulated feedback ring |

- **Uniform interface**: every color is 2-in/2-out with `rgain` (= `reverb*3.2`,
  the same A/B calibration as the default, capped 3.5) + `rtone` (return LP). A
  baked per-module `TRIM` equalizes tail energy to the zita reference
  (test/probes/reverb.probe.js measured E≈3.6e-5) so a genre's `reverb` scalar means the
  same wetness across colors. Trims: dattorro 0.71, greyhole 0.26, fdn 0.055,
  spring 0.52.
- **state-engine** (`reverbColor(state)` + `REVERB_COLORS`): returns
  `{module, rgain, rtone}` or null. `fxParams` sets the internal `rgain: 0`
  whenever a color is active (the internal zita mutes but still runs — it is the
  baseline, so a color is only ONE extra reverb node, honoring the live budget).
- **press.js**: renders the whole (mono) rev-send bus through the color module
  and folds the stereo wet into `dryL/dryR` so it rides the master chain.
  Deterministic (module LFO phases start at 0 → same seed = same bytes).
- **live.js** (`ensureReverbColor`): builds at most ONE external reverb node,
  fed the rev-send bus via a 2-ch merger, wet → `dryBus`. A section/genre change
  crossfades to the new color (old gain→0, retire after 500ms). Called per-bar
  in injectChord.
- **kernel**: anchors carry `reverbColor:"…"`; `resolveMulti` picks the
  DOMINANT parent's color with ZERO rng draw (touched anchors keep every prior
  musical choice byte-for-byte, only gaining the field; a blend inherits its
  dominant parent's color). Untouched genres never declare it → zita default →
  byte-identical (39 untouched genre×seed states verified identical).
- **Gates**: `test/probes/reverb.probe.js` (non-silent + measurably distinct RT/
  centroid across the family); verify.sh 63/63; live smoke exercises the
  dattorro build+swap (jungle→house) with 0 errors.
- **BLEED TAP-OUT** (2026-07 reverb-color round): the delay/ping-pong bleed into
  reverb (`d*0.2 + (ppl+ppr)*0.12`) now feeds the EXTERNAL color node too, so
  colored genres keep the echo-tail-into-reverb glue uncolored genres get from
  the internal zita (which is muted for them). `dsp/rev_bleed.dsp` (2-in del/pp,
  1-out) recomputes that exact bleed term — same delay/pingpong DSP + coefficients
  as fx_bus, driven by the same `SE.fxParams` — and **press** adds it to the color
  node's input (`revColorIn = rev + bleed`). **live** folds it into the color
  node's input merger (`revMerge`) with NATIVE nodes only (a feedback delay +
  cross-fed pingpong) — no extra worklet, so the one-extra-node worklet budget
  (the reverb-color node itself) stands; the graph is built lazily on first
  colored bar and its wet is muted to 0 whenever no color is active. **fx_bus is
  untouched** so uncolored genres stay byte-identical (verified techno s1 / jungle
  s7). The TRIM calibration is unaffected — it equalizes each color's tail energy
  for a given input, and the bleed simply brings the color node's INPUT up to the
  zita reference (probe-reverb tail energies unchanged at ~3.6e-5). Audibly the
  glue is subtle (A/B mallsoft dattorro: ~-25 dB below signal, echo-locked on the
  reverb tail; strongest on the bright dattorro plate, negligible on greyhole's
  wash and low-delay genres like surfrock). test/probes/reverb.probe.js gates the bleed
  (silence pre-delay, an echo at ~dtime). Minor live/press divergence: fx_bus's
  1-pole `fi.lowpass` in the delay loop vs a 2-pole biquad in live.

## Found-vocal AUTO-TUNE — clip-snap to the song key (2026-07 fx wings stage 2)

`state.autoTune` (0..1) bends found VOICE clips toward the song's scale. NOT a
Faust path — the found layer is native (AudioBufferSourceNodes live, pure-JS
mixPCM in press), so `an.pitchTracker`/`ef.transpose` don't apply; instead a
UNIFIED deterministic clip-snap lives in found-player.js:

- **detectMedianHz(buffer, sr)**: offline autocorrelation median-F0 over the
  voiced frames (decimated to ~11 kHz, first-strong-peak lag pick — global-max
  locks onto subharmonics on steady tones — parabolic sub-lag interpolation),
  cached per buffer (WeakMap). A pure function of the decoded audio: no wall
  clock, no rng.
- **autoTuneRate(pitch, detectedHz, pcs, strength)**: bends the event's
  playbackRate so the HEARD median (`detectedHz·pitch`) lands on the nearest
  scale pitch-class, interpolated in cents by `strength`. strength 0 ⇒ ratio
  2^0 = 1 exactly ⇒ bit-identical render (probe-gated).
- **state-engine `autoTune(E, state)`** → `{strength, pcs}` or null; `pcs` =
  the progression's chord-tone pitch classes transposed by keyOffset. mapEvents
  attaches it to found chop/bed events — **never to tempo-synced sources**
  (`src.bpm` set — a break's chop pitch IS the beat-sync ratio; a blend like
  hogcore×jungle would otherwise wreck the amen's tempo). Non-vocal field
  recordings self-gate: no stable F0 → detect 0 → no bend.
- **Kernel**: anchors carry scalar `autoTune`; resolveMulti takes the DOMINANT
  parent's value with zero rng draws (`!= null` so spokenword's explicit 0 —
  never tune the poets — carries through blends it dominates). Wired: hogcore
  0.7 (the name chops snap hard — hyperpop coherence), vaporwave 0.25 (gentle),
  spokenword 0 (explicit off). Everyone else: no field, byte-identical.
- **Gates**: `test/probes/autotune.probe.js` — synthetic mechanism (off-scale sine:
  62¢→0¢ at strength 1, unchanged at 0, strength-0 bit-identity, determinism)
  + real hogcore clips (mean |cents-to-scale| 45.9 → 13.8 at 0.7). Press
  byte-identity for untouched genres (techno s1 + jungle s7 HEAD vs tree);
  hogcore live smoke (chops fire through the bend, 0 errors); verify 63/63.
- **LIMITATIONS**: snaps the clip's MEDIAN pitch (one ratio per event — an
  aesthetic tape-style tune, not per-syllable melodyne); uses the home key
  (per-section keyShift not tracked); live decode (lead-in trim + boost) can
  detect a slightly different median than press's raw ffmpeg decode — each
  engine is internally deterministic, cross-engine parity is approximate (true
  of all found audio).
