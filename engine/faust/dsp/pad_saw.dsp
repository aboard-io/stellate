// pad_saw — imitation of csd-engine.js instr 1 default pad:
//   kwow lfo ipch*0.004, 0.3  (slow tape wow)
//   a1/a2/a3 saws at kf*(1-detune) / kf / kf*(1+detune), *0.33
//   -> moogladder(cutoff, res)
//   env: linsegr 0, atk, iamp, p3-atk, iamp*0.8, 2.5, 0  (long 2.5s tail)
declare name "pad_saw";
import("stdfaust.lib");

freq   = hslider("freq", 220, 20, 4000, 0.01) : gsmooth;
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
gate   = button("gate");
cutoff = hslider("cutoff", 1400, 80, 12000, 1) : si.smoo;
res    = hslider("res", 0.15, 0, 0.95, 0.01);
detune = hslider("detune", 0.006, 0, 0.05, 0.0001);
attack = hslider("attack", 1.5, 0.005, 5, 0.005);
level  = hslider("level", 0.4, 0, 1, 0.01);
gain   = hslider("gain", 0.12, 0, 2, 0.01);

kf = freq * (1 + 0.004*os.osc(0.3));
three = (os.sawtooth(kf*(1-detune)) + os.sawtooth(kf) + os.sawtooth(kf*(1+detune))) * 0.33;

env = en.adsr(attack, 1.5, 0.8, 2.5, gate);

// fenv* = SYNTHESIS-DEPTH unified filter envelope (2026-07);
// fenvAmount 0 is a bit-exact bypass (absent-law).
fenvAmount = hslider("fenvAmount", 0, -4, 4, 0.01);       // cutoff env depth, OCTAVES (signed; 0 = off, bit-exact)
fenvAttack = hslider("fenvAttack", 0.005, 0.001, 2, 0.001);
fenvDecay  = hslider("fenvDecay", 0.18, 0.01, 3, 0.005);
fenvC   = en.adsr(fenvAttack, fenvDecay, 0, fenvDecay, gate);   // AD contour (sustain 0), note-on triggered
fenvMul = exp(0.6931472 * fenvAmount * fenvC);                  // 2^(amt*contour); amt 0 -> exactly 1.0

process = three : ve.moog_vcf_2bn(res, max(30, min(cutoff*fenvMul, 16000))) : *(env*level*gain);
