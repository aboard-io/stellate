// juno60 — Roland Juno-60 emulation: a poly pad/keys voice built around a
// SINGLE DCO (the Juno signature) plus the BBD stereo chorus that is the
// instrument's identity.
//
//   DCO (one digitally-clocked osc, rock-stable pitch) fans out to a mixer of
//     saw + variable-width PULSE (PWM) + SQUARE SUB one octave down + noise.
//   PWM width is modulated by ENV and LFO (the two Juno PWM sources) around a
//     manual base.
//   -> non-resonant HPF (the Juno's "source mixer" high-pass, 4-position feel
//      as a continuous cutoff)
//   -> resonant 24 dB/oct LPF = ve.moog_vcf_2bn (NOT ve.moogLadder — broken,
//      see VOICES.md; moog_vcf_2bn takes Hz + res 0..1, matching moogladder)
//      with a SIGNED filter-env amount (Juno env polarity switch), LFO->cutoff,
//      and keyboard tracking.
//   -> VCA driven by the one ADSR the Juno shares between VCF and VCA.
//   -> BBD CHORUS (the identity feature): two modulated delay lines in
//      ANTIPHASE (L / R), mode I (slow, ~0.5 Hz) .. mode II (faster, ~0.86 Hz)
//      selected by the morphable `chorus` 0..2 param (0 = off/bypass), stereo
//      `spread` controlling the antiphase width.
//
// STEREO OUT (2 channels). The chorus is what makes it wide; channel [0] alone
// is still a complete mono Juno chorus (dry + one modulated tap), so hosts that
// collapse voices to mono still get the characteristic movement.
declare name "juno60";
import("stdfaust.lib");

// --- house params ---
freq   = hslider("freq", 220, 20, 4000, 0.01) : si.smoo;
gate   = button("gate");
level  = hslider("level", 0.4, 0, 1, 0.01);
gain   = hslider("gain", 0.2, 0, 2, 0.01);

// --- DCO mixer (the single-oscillator source, Juno "source mixer") ---
sawLevel   = hslider("sawLevel",   0.6, 0, 1, 0.01) : si.smoo;
pulseLevel = hslider("pulseLevel", 0.5, 0, 1, 0.01) : si.smoo;
subLevel   = hslider("subLevel",   0.3, 0, 1, 0.01) : si.smoo;  // square, -1 oct
noiseLevel = hslider("noiseLevel", 0.0, 0, 1, 0.01) : si.smoo;

// --- PWM (pulse width): manual base + env + LFO (the Juno PWM sources) ---
pwmBase = hslider("pwmBase",  0.5,  0.05, 0.5,  0.001) : si.smoo; // 0.5 = square
pwmEnv  = hslider("pwmEnv",   0.0, -0.4,  0.4,  0.001) : si.smoo; // env -> width
pwmLfo  = hslider("pwmLfo",   0.15, 0,    0.45, 0.001) : si.smoo; // LFO -> width

// --- HPF (non-resonant source high-pass) ---
hpf = hslider("hpf", 30, 20, 1200, 1) : si.smoo;

// --- VCF (resonant 24 dB LPF) ---
cutoff    = hslider("cutoff", 1400, 60, 16000, 1) : si.smoo;
res       = hslider("res", 0.25, 0, 0.95, 0.01);
envAmount = hslider("envAmount", 1.4, -4, 6, 0.01);   // SIGNED, OCTAVES (polarity)
keytrack  = hslider("keytrack", 0.3, 0, 1, 0.01);     // keyboard follow
lfoToFilter = hslider("lfoToFilter", 0.0, 0, 3, 0.01); // LFO -> cutoff, OCTAVES

// --- the one ADSR (shared VCF + VCA) ---
attack  = hslider("attack",  0.6, 0.001, 5, 0.001);
decay   = hslider("decay",   1.2, 0.005, 5, 0.005);
sustain = hslider("sustain", 0.7, 0, 1, 0.01);
release = hslider("release", 1.5, 0.005, 6, 0.005);

// --- LFO (sine, with keypress delay fade-in) ---
lfoRate  = hslider("lfoRate", 4.5, 0.05, 12, 0.01);
lfoDelay = hslider("lfoDelay", 0.15, 0, 2, 0.005);    // LFO fade-in after keypress
lfoToPitch = hslider("lfoToPitch", 0, 0, 60, 0.1);    // vibrato, CENTS

// --- BBD chorus (identity feature) ---
chorus  = hslider("chorus", 1, 0, 2, 0.001) : si.smoo; // 0 off .. 1 mode I .. 2 mode II
spread  = hslider("spread", 0.9, 0, 1, 0.01) : si.smoo; // stereo width (antiphase)

// ---------------------------------------------------------------------------
// LFO: sine with a keypress delay ramp (Juno LFO delay swells vibrato in)
lfoRamp = gate : si.smooth(ba.tau2pole(max(lfoDelay, 0.001)));
lfoV    = os.osc(lfoRate) * lfoRamp;

// shared ADSR (Juno's single envelope -> VCF and VCA)
env = en.adsr(attack, decay, sustain, release, gate);

// vibrato (LFO -> DCO pitch), small-cents ratio approximation
cents2r(c) = 1.0 + c * 0.00057779;
kf = freq * cents2r(lfoToPitch * lfoV);

// PWM width: manual base + env + LFO, clamped away from full collapse
pw = max(0.03, min(0.97, pwmBase + pwmEnv * env + pwmLfo * lfoV));

// DCO source mixer: saw + variable-width pulse + square sub (-1 oct) + noise
sawv   = os.sawtooth(kf);
pulsev = (os.lf_sawpos(kf) < pw) * 2.0 - 1.0;
subv   = os.square(kf * 0.5);
noisev = no.noise;
dco = sawv * sawLevel + pulsev * pulseLevel + subv * subLevel + noisev * noiseLevel;

// HPF (non-resonant) then resonant 24 dB ladder with signed env + LFO + keytrk
sourced = dco : fi.highpass(1, hpf);
octAbove = log(max(20, freq) / 261.63) / log(2.0);   // octaves above middle C
fmodOct = envAmount * env + lfoToFilter * lfoV + keytrack * octAbove;
kcut = min(16000.0, max(30.0, cutoff * exp(0.6931472 * fmodOct)));
voice = sourced : ve.moog_vcf_2bn(res, kcut) : *(env * level * gain);

// ---------------------------------------------------------------------------
// BBD stereo chorus. mode morph: wetMix fades 0->1 over chorus 0..1 (mode I),
// then mb morphs mode I -> mode II rate/depth over chorus 1..2.
cmode  = chorus;
wetMix = min(cmode, 1.0);
mb     = max(0.0, min(1.0, cmode - 1.0));
crate  = 0.513 + (0.863 - 0.513) * mb;                 // Hz
cbaseS = 0.005 * ma.SR;                                // ~5 ms center
cdepS  = (0.0016 + 0.0010 * mb) * ma.SR;               // modulation, samples
clfo   = os.osc(crate);
// BBD is dark: gentle lowpass on the wet taps
bbd(x) = x : fi.lowpass(1, 6000);

choruser = _ <: L, R
with {
    dL  = cbaseS + cdepS * clfo;                       // antiphase taps
    dR  = cbaseS - cdepS * clfo;
    tapL(x) = x : de.fdelay(2048, dL) : bbd;
    tapR(x) = x : de.fdelay(2048, dR) : bbd;
    // channel [0] always carries wetL so a mono collapse still choruses;
    // spread cross-blends the two taps (0 = mono, 1 = full antiphase stereo)
    L(x) = x + wetMix * tapL(x);
    R(x) = x + wetMix * (tapL(x) * (1.0 - spread) + tapR(x) * spread);
};

process = voice : choruser;
