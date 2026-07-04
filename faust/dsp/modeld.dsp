// modeld — a Minimoog-Model-D-class mono voice (the signature package):
//   3 oscillators saw/saw/pulse (oscMix = osc3 saw->pulse blend), fixed slight
//   detune spread (+6c / -8c) plus slow random DRIFT (lfnoise cents wander —
//   analog instability), gentle tanh DRIVE into a 4-pole ladder
//   (moog_vcf_2bn) with EMPHASIS (res) and a punchy ADS filter envelope
//   (envAmount in OCTAVES — the wah-punch on each note; filter release rides
//   envDecay like the real contour switch), classic fast-attack/singing-
//   sustain loudness contour, and GLIDE: exponential freq slew toward the
//   target note (glide ms ~= time to settle within 1%).
// SCHEDULER CONTRACT (state-engine `mono:true` units): legato notes (gap
// < 30 ms or overlapping) are routed to the SAME voice instance with the
// gate HELD — the freq slider then slews and the envelopes do NOT retrigger
// (single-trigger, like the real thing). Non-legato retriggers still glide
// from the previous note when glide > 0 — also authentic.
declare name "modeld";
import("stdfaust.lib");

freq   = hslider("freq", 220, 20, 4000, 0.01);
gate   = button("gate");
cutoff = hslider("cutoff", 1200, 60, 16000, 1) : si.smoo;
res    = hslider("res", 0.35, 0, 0.95, 0.01);          // EMPHASIS
envAmount = hslider("envAmount", 1.5, 0, 5, 0.01);     // filter env depth, OCTAVES
envAttack = hslider("envAttack", 0.004, 0.001, 0.5, 0.001);
envDecay  = hslider("envDecay", 0.18, 0.01, 2, 0.005);
envSustain= hslider("envSustain", 0.25, 0, 1, 0.01);
glide  = hslider("glide", 0, 0, 500, 1);               // portamento, ms
drive  = hslider("drive", 0.25, 0, 1, 0.01);           // tanh pre-filter
oscMix = hslider("oscMix", 0.5, 0, 1, 0.01);           // osc3: 0 saw .. 1 pulse
drift  = hslider("drift", 6, 0, 25, 0.1);              // random wander, CENTS
attack = hslider("attack", 0.004, 0.001, 2, 0.001);
sustain= hslider("sustain", 0.9, 0, 1, 0.01);
release= hslider("release", 0.25, 0.01, 3, 0.005);
level  = hslider("level", 0.5, 0, 1, 0.01);
gain   = hslider("gain", 1, 0, 2, 0.01);

// GLIDE — exponential slew toward the target note (tau = glide/4.6 so the
// slew lands within 1% at ~glide ms; <=2 ms means OFF -> instant snap)
gsec  = glide * 0.001;
gpole = ba.tau2pole(max(gsec / 4.6, 0.0005)) * (gsec > 0.002);
kf    = freq : si.smooth(gpole);

// DRIFT — slow uncorrelated-ish cents wander per oscillator (different
// lfnoise rates + one mirrored: three distinct trajectories)
cents2r(c) = 1.0 + c * 0.00057779;   // ~2^(c/1200) for |c| <= 25
d1 = cents2r(no.lfnoise(0.37) * drift);
d2 = cents2r(0.0 - no.lfnoise(0.53) * drift);
d3 = cents2r(no.lfnoise(0.71) * drift);

// 3 oscillators: saw / saw(+6c) / saw|pulse(-8c)
pulse(f) = (os.lf_sawpos(f) < 0.26) * 2.0 - 1.0;
o1 = os.sawtooth(kf * d1);
o2 = os.sawtooth(kf * 1.003472 * d2);
f3 = kf * 0.995392 * d3;
o3 = os.sawtooth(f3) * (1.0 - oscMix) + pulse(f3) * oscMix;
stack = (o1 + o2 + o3) * 0.33;

// DRIVE into the filter (gentle tanh, loudness-compensated)
driven = stack * (1.0 + drive * 5.0) : ma.tanh : *(1.0 / (1.0 + drive * 1.2));

// FILTER ENVELOPE — ADS contour in octaves above cutoff (release = envDecay,
// the Model-D decay-switch behavior); ladder = moog_vcf_2bn (Hz + res 0..1,
// the csound moogladder semantics — ve.moogLadder is broken, see VOICES.md)
fenv = en.adsr(envAttack, envDecay, envSustain, envDecay, gate);
kcut = min(16000.0, max(30.0, cutoff * exp(0.6931472 * envAmount * fenv)));

// loudness contour: fast attack, slight settle into the singing sustain
env = en.adsr(attack, 0.08, sustain, release, gate);

process = driven : ve.moog_vcf_2bn(res, kcut) : *(env * level * gain);
