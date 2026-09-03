// bass_saw — imitation of csd-engine.js instr 2 default bass:
//   a1 vco2 saw -> moogladder(cutoff, res)
//   env: linsegr 0, 0.012, iamp, p3-0.05, iamp*0.5, 0.10, 0
declare name "bass_saw";
import("stdfaust.lib");

freq   = hslider("freq", 65, 20, 500, 0.01) : gsmooth;
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
cutoff = hslider("cutoff", 700, 60, 6000, 1) : si.smoo;
res    = hslider("res", 0.15, 0, 0.95, 0.01);
release= hslider("release", 0.10, 0.01, 3, 0.005);
fenv   = hslider("fenv", 0, 0, 4, 0.01);   // per-recipe filter zap: cutoff*(1+fenv) -> cutoff
level  = hslider("level", 1, 0, 2, 0.01);
gain   = hslider("gain", 0.35, 0, 2, 0.01);

env  = en.adsr(0.012, 0.4, 0.5, release, gate);

// fenv* = SYNTHESIS-DEPTH unified filter envelope (2026-07);
// fenvAmount 0 is a bit-exact bypass (absent-law); it multiplies IN ADDITION to
// the legacy `fenv` zap, inside the existing kcut clamp.
fenvAmount = hslider("fenvAmount", 0, -4, 4, 0.01);       // cutoff env depth, OCTAVES (signed; 0 = off, bit-exact)
fenvAttack = hslider("fenvAttack", 0.005, 0.001, 2, 0.001);
fenvDecay  = hslider("fenvDecay", 0.18, 0.01, 3, 0.005);
fenvC   = en.adsr(fenvAttack, fenvDecay, 0, fenvDecay, gate);   // AD contour (sustain 0), note-on triggered
fenvMul = exp(0.6931472 * fenvAmount * fenvC);                  // 2^(amt*contour); amt 0 -> exactly 1.0

fdec = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(0.024)));   // settles AT ~0.012+0.06
kcut = max(30, min(cutoff*(1 + fenv*fdec)*fenvMul, 16000));
// ve.moogLadder in the bundled faustlibraries is broken (see VOICES.md);
// moog_vcf_2bn takes Hz + res 0..1 — the exact csound moogladder semantics
process = os.sawtooth(freq) : ve.moog_vcf_2bn(res, kcut) : *(env*level*gain);
