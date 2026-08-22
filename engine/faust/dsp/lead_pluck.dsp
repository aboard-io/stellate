// lead_pluck — imitation of csd-engine.js leadSource "pluck":
//   asig pluck 1, kf, ipch, 0, 1  (Karplus-Strong, simple averaging decay)
//   -> butlp cutoff
// Hand-rolled KS: 4ms noise burst into a lowpassed feedback comb.
declare name "lead_pluck";
import("stdfaust.lib");

freq   = hslider("freq", 440, 40, 4000, 0.01);
gate   = button("gate");
cutoff = hslider("cutoff", 3000, 200, 14000, 1) : si.smoo;
res    = hslider("res", 0.05, 0, 0.95, 0.01);    // instr 4 post-moogladder res
damp   = hslider("damp", 2000, 500, 12000, 1);   // KS loop brightness
release= hslider("release", 0.15, 0.01, 3, 0.005);
fenv   = hslider("fenv", 0, 0, 3, 0.01);         // per-note filter zap on the moog stage
level  = hslider("level", 0.5, 0, 1, 0.01);
gain   = hslider("gain", 0.5, 0, 2, 0.01);

dec(tau) = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(tau)));
burst = no.noise * dec(0.004) : fi.lowpass(2, 3500);   // pre-darkened excitation

// THE LOOP WAS THREE SAMPLES TOO LONG, AND THAT WAS THE WHOLE TUNING ERROR.
// A Karplus-Strong string sounds at SR divided by the delay round the WHOLE
// loop, and this loop is three things, not one: the delay line, the damping
// filter's own phase delay, and the single sample Faust's `~` puts in every
// feedback path. The line was `SR/f - 1.5`, which pays for the `~` and half a
// sample of guesswork and pays nothing at all for the filter — and
// `fi.lowpass(1, damp)` is not free. It is filters.lib's bilinear one-pole,
// tf1s(0,1,1,2*PI*damp): a pole at p = (c-1)/(c+1) with c = 1/tan(PI*damp/SR),
// and a zero at Nyquist that carries half a sample of its own. At the default
// damp = 2000 that is a phase delay of 3.49 samples where 0.5 was budgeted, so
// the string ran 2.99 samples long at EVERY pitch.
//
// A delay d samples too long is 1731*d/P cents flat and P is SR/f, so the
// error grows with the note — which is what it did. Measured on the shipped
// module (and the implied d beside it): MIDI 36 -8 c (d 2.98), 48 -15 c
// (2.97), 60 -30 c (2.94), 72 -59 c (2.87), 76 -73 c (2.83). Middle C a third
// of a semitone flat, and the top of the range two thirds.
//
// THE FIX IS stk_guitar's, NOT gtr_amp's: make the loop's total delay right
// rather than fit a pre-warp on top of a wrong one. stk_guitar can afford a
// linear-phase FIR3 whose delay is exactly one sample at every frequency; this
// string cannot, because `damp` is a CUTOFF IN HERTZ the engine writes across
// 500..12000 and a symmetric three-tap FIR has no such knob. So the phase
// delay is computed instead — exactly, at the note's own fundamental, from the
// same bilinear coefficient fi.lowpass derives from — and subtracted from the
// line. Nothing about the damping changes; only the length does. The declining
// d in the measurements above is this function's own curve: the analytic value
// is 2.984 at MIDI 36 and 2.871 at MIDI 76, against 2.98 and 2.83 measured.
//
// `dl` depends only on sliders, so Faust hoists all of it into the block's
// control code — the transcendentals cost nothing per sample.
// The denominator is 1 - p*cos(w) and |p| < 1 always, so it never reaches zero
// and plain `atan` is safe (no quadrant to resolve).
lpPole(fc) = (c - 1.0)/(c + 1.0) with { c = 1.0/tan(ma.PI*fc/ma.SR); };
lpDelay(fc, f0) = 0.5 + atan(p*sin(w)/(1.0 - p*cos(w)))/w
  with { p = lpPole(fc); w = 2.0*ma.PI*f0/ma.SR; };
f0    = max(freq, 40);
// max(2,...) is the pre-existing floor and still the last word: asked for a
// damp far below the note's own fundamental (500 Hz under a 4 kHz string) the
// compensation is longer than the period, and a too-short line is the only
// answer left.
dl    = max(2, ma.SR/f0 - 1.0 - lpDelay(damp, f0));
ks(x) = (+(x) : de.fdelay4(4096, dl)) ~ (fi.lowpass(1, damp) : *(0.995));

env = en.asr(0.001, 1, release, gate);   // note-off just shortens the ring

// fenv* = SYNTHESIS-DEPTH unified filter envelope (2026-07);
// fenvAmount 0 is a bit-exact bypass (absent-law); it multiplies IN ADDITION to
// the legacy `fenv` zap, inside the existing kcut clamp on the moog stage.
fenvAmount = hslider("fenvAmount", 0, -4, 4, 0.01);       // cutoff env depth, OCTAVES (signed; 0 = off, bit-exact)
fenvAttack = hslider("fenvAttack", 0.005, 0.001, 2, 0.001);
fenvDecay  = hslider("fenvDecay", 0.18, 0.01, 3, 0.005);
fenvC   = en.adsr(fenvAttack, fenvDecay, 0, fenvDecay, gate);   // AD contour (sustain 0), note-on triggered
fenvMul = exp(0.6931472 * fenvAmount * fenvC);                  // 2^(amt*contour); amt 0 -> exactly 1.0

// per-recipe fenv sweeps the instr-4 moogladder (settle ~ (typ. atk 0.005..0.05)+0.06)
fdec = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(0.022)));
kcut = max(30, min(cutoff*(1 + fenv*fdec)*fenvMul, 16000));

// butlp(cutoff) inside the csound source + instr 4's moogladder(cutoff,res)
process = burst : ks : fi.lowpass(2, cutoff) : ve.moog_vcf_2bn(res, kcut)
        : *(env*level*gain*1.5);
