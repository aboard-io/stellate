// bass_wobble — imitation of csd-engine.js bassSource "wobble":
//   a1 vco2 saw
//   klfo oscili 0.5, wobbleHz ; kcf = cutoff*(0.5 + (klfo+0.5)*1.1)
//   moogladder(kcf, min(0.85, res+0.4)) -> tanh(*1.5)*0.85
declare name "bass_wobble";
import("stdfaust.lib");

freq     = hslider("freq", 55, 20, 500, 0.01) : gsmooth;
// GLIDE — portamento, MILLISECONDS, and it is a TAKEOVER of a slew this module
// already had rather than a new one. `freq` has always run through `si.smoo` =
// si.smooth(0.999): a FIXED pole, ~21 ms tau, ~96 ms to settle within 1% at
// 48 kHz. So every reused pool voice in this fleet has been sliding into its
// next note all along, at a time nobody could name, turn down or turn up — the
// pitch bend you can hear on a fast synth line. This names it, and the three
// readings are chosen so the bottom of the slider is not a lie:
//   glide == 0   the module's OWN smoother, the 0.999 pole, untouched. A state
//                that never writes the key renders BIT-IDENTICAL to before —
//                that is why this is a select2 over two whole smoothers and
//                not one smoother with a computed pole: a signal-rate 0.999f
//                is NOT the constant-folded 0.999, and the saw phasors drift
//                (measured: max |diff| 1.3e-3 across a 0.9 s render).
//   glide == 1   a SNAP. tau 0.2 ms, settled inside a millisecond — the one
//                thing this fleet could never do, since si.smoo was mandatory.
//   glide  > 2   the named portamento: tau = glide/4.6, landing within 1% at
//                ~glide ms, exactly the contract modeld and synclead keep.
glide  = hslider("glide", 0, 0, 500, 1);
glPole = ba.tau2pole(max(glide * 0.001 / 4.6, 0.0000001));
gsmooth(x) = select2(glide > 0, x : si.smoo, x : si.smooth(glPole));
gate     = button("gate");
cutoff   = hslider("cutoff", 500, 60, 6000, 1);
res      = hslider("res", 0.2, 0, 0.45, 0.01);
wobbleHz = hslider("wobbleHz", 2.4, 0.1, 16, 0.01);
level    = hslider("level", 1, 0, 2, 0.01);
gain     = hslider("gain", 0.35, 0, 2, 0.01);

env  = en.adsr(0.012, 0.4, 0.5, 0.10, gate);
klfo = os.osc(wobbleHz)*0.5;

// fenv* = SYNTHESIS-DEPTH unified filter envelope (2026-07);
// fenvAmount 0 is a bit-exact bypass (absent-law); *fenvMul sits inside the
// existing kcf clamp so amt 0 leaves the wobble sweep untouched.
fenvAmount = hslider("fenvAmount", 0, -4, 4, 0.01);       // cutoff env depth, OCTAVES (signed; 0 = off, bit-exact)
fenvAttack = hslider("fenvAttack", 0.005, 0.001, 2, 0.001);
fenvDecay  = hslider("fenvDecay", 0.18, 0.01, 3, 0.005);
fenvC   = en.adsr(fenvAttack, fenvDecay, 0, fenvDecay, gate);   // AD contour (sustain 0), note-on triggered
fenvMul = exp(0.6931472 * fenvAmount * fenvC);                  // 2^(amt*contour); amt 0 -> exactly 1.0
kcf  = max(40, min(cutoff * (0.5 + (klfo + 0.5)*1.1) * fenvMul, 16000));

process = os.sawtooth(freq) : ve.moog_vcf_2bn(min(0.85, res + 0.4), kcf) : *(1.5) : ma.tanh : *(0.85*env*level*gain);
