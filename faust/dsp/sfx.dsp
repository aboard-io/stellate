// sfx — imitation of csd-engine.js instr 20 (the transition-FX family).
// type: 1 riser (noise, moogladder opens 300->8000)
//       2 sweep (bandpass noise rises 400->6000)
//       3 downlift (moogladder closes 8000->300)
//       4 impact (pitch-dropping boom 120->40 + LP noise, exp decay)
//       5 reverse (HP noise swells to a cutoff)
//       6 noise (plain exp-decay noise burst)
// dur = the csound p3; envelopes/sweeps run on a per-trigger clock.
declare name "sfx";
import("stdfaust.lib");

gate  = button("gate");
sfxtype = hslider("type", 1, 1, 6, 1);
dur   = hslider("dur", 4, 0.1, 16, 0.01);
amp   = hslider("amp", 0.4, 0, 1, 0.01);
level = hslider("level", 1, 0, 2, 0.01);

// per-trigger clock: counts seconds while gate is high, resets on gate low
t = ((_ + 1) * (gate > 0)) ~ _ : /(ma.SR);
x = min(1.0, t/max(dur, 0.01));

nz = no.noise;
ml(fc) = ve.moog_vcf_2bn(0.3, max(60, min(fc, 16000)));
// deep-cut variant for the noise-sweep family — human-calibrated 2026-07-04:
// "the filter must cut very deeply" — high resonance, and the whole sweep
// lives 150-2200 Hz (was 300-8000: at 8k open it read as plain white noise).
// Result: a filtered whoosh, never a hiss wall.
mld(fc) = ve.moog_vcf_2bn(0.72, max(60, min(fc, 16000)));

riser    = nz : mld(150*pow(2200/150.0, x))  : *(min(1, x/0.9));
sweep    = nz : fi.resonbp(200*pow(2200/200.0, x), 6, 1) : *(0.5);
downlift = nz : mld(2200*pow(150/2200.0, x)) : *(min(1, (1-x)/0.2));
impact   = (oscr(40 + 80*exp(-t/0.13)) + (nz : fi.lowpass(2, 1200))*0.4) : *(exp(-t*6/max(0.05, dur)))
with { oscr(f) = sin(2.0*ma.PI*(((_ + f/ma.SR) * (1 - ba.impulsify(gate)) : ma.frac) ~ _)); };
reverse  = (nz : fi.highpass(2, 3000)) : *(select2(x < 0.95, max(0.0, (1-x)/0.05), x/0.95));
burst    = nz : *(exp(-t*6.9/max(dur, 0.01)));

sig = riser, sweep, downlift, impact, reverse, burst : ba.selectn(6, int(sfxtype - 1));

// gate is held high for the whole event (the csound p3); all shapes land at ~0
process = sig * amp * level * (gate > 0) : min(0.9) : max(-0.9);
