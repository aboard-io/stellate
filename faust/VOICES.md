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

## SFX / stab

| what | module | params |
|---|---|---|
| riser/sweep/downlift/impact/reverse/noise (instr 20) | `sfx` | type 1–6, dur (=p3; hold gate for dur), amp |
| rave stab (instr 6) | `stab` | freq, decay, gain |
| master filter sweep (instr 96) | `fx_bus` `mcut` param | engine automates exponentially, like `gkCut expon` |

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
