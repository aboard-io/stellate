// lead_fuzz — imitation of csd-engine.js leadSource "fuzz":
//   2 saws (kf, kf*1.006)*0.5
//   -> moogladder(min(9000,cutoff*1.3), res+0.45)
//   -> tanh(*(3.2+drive*4))*0.6  [here: ef.cubicnl pre-clip + tanh ceiling]
//   -> butlp min(11000, cutoff*2.2)
declare name "lead_fuzz";
import("stdfaust.lib");

freq   = hslider("freq", 330, 40, 4000, 0.01) : gsmooth;
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
cutoff = hslider("cutoff", 3000, 200, 12000, 1) : si.smoo;
res    = hslider("res", 0.2, 0, 0.47, 0.01);     // csound caps res+0.45 at 0.92
drive  = hslider("drive", 0, 0, 1, 0.01);
attack = hslider("attack", 0.005, 0.001, 5, 0.001);
sustain= hslider("sustain", 0.85, 0, 1, 0.01);
release= hslider("release", 0.3, 0.01, 3, 0.005);
fenv   = hslider("fenv", 0, 0, 3, 0.01);         // per-note filter zap on the moog stage
vib    = hslider("vibrato", 0, 0, 0.03, 0.0001);
vibRate= hslider("vibRate", 5.2, 0.1, 12, 0.01);
level  = hslider("level", 0.5, 0, 1, 0.01);
gain   = hslider("gain", 0.5, 0, 2, 0.01);

kf  = freq * (1 + vib*os.osc(vibRate));
two = (os.sawtooth(kf) + os.sawtooth(kf*1.006)) * 0.5;

// csound: tanh(asig*(3.2+drive*4))*0.6. ef.cubicnl adds even harmonics the
// csound fuzz doesn't have (A/B'd 84% brighter) — pure tanh is the match.
dirt(x) = ma.tanh(x*(3.2 + drive*4)) * 0.6;

env = en.adsr(attack, 0.06, sustain, release, gate);

// fenv* = SYNTHESIS-DEPTH unified filter envelope (2026-07);
// fenvAmount 0 is a bit-exact bypass (absent-law); it multiplies IN ADDITION to
// the legacy `fenv` zap, inside the existing kcut clamp on the moog stage.
fenvAmount = hslider("fenvAmount", 0, -4, 4, 0.01);       // cutoff env depth, OCTAVES (signed; 0 = off, bit-exact)
fenvAttack = hslider("fenvAttack", 0.005, 0.001, 2, 0.001);
fenvDecay  = hslider("fenvDecay", 0.18, 0.01, 3, 0.005);
fenvC   = en.adsr(fenvAttack, fenvDecay, 0, fenvDecay, gate);   // AD contour (sustain 0), note-on triggered
fenvMul = exp(0.6931472 * fenvAmount * fenvC);                  // 2^(amt*contour); amt 0 -> exactly 1.0

// filter env settles AT attack+0.06 (csound plucky kcf expseg)
fdec = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(max((attack + 0.06)/3, 0.003))));
kcut = max(30, min(min(9000, cutoff*1.3)*(1 + fenv*fdec)*fenvMul, 16000));

// csound moogladder LOSES passband level as res rises; moog_vcf_2bn is
// normalized — put the loss back so the fuzz drive sees the same signal
rloss = 1.0/(1 + min(0.92, res + 0.45)*1.55);

process = two : ve.moog_vcf_2bn(min(0.92, res + 0.45), kcut) : *(rloss)
        : dirt : fi.lowpass(2, min(11000, cutoff*2.2)) : *(env*level*gain);
