// bass_acid — imitation of csd-engine.js bassSource "acid":
//   a1 vco2 saw
//   kcut expseg cutoff*4, 0.16, cutoff, p3, cutoff*0.8   (per-note filter zap)
//   moogladder(kcut, res+0.5)
declare name "bass_acid";
import("stdfaust.lib");

freq   = hslider("freq", 65, 20, 500, 0.01) : si.smoo;
gate   = button("gate");
cutoff = hslider("cutoff", 600, 60, 6000, 1);
res    = hslider("res", 0.15, 0, 0.4, 0.01);    // csound caps res+0.5 at 0.9
release= hslider("release", 0.10, 0.01, 3, 0.005);
fenv   = hslider("fenv", 3, 0, 6, 0.01);        // zap depth; 3 = the stock cutoff*4 -> cutoff
level  = hslider("level", 1, 0, 2, 0.01);
gain   = hslider("gain", 0.35, 0, 2, 0.01);

env  = en.adsr(0.012, 0.4, 0.5, release, gate);

// fenv* = SYNTHESIS-DEPTH unified filter envelope (2026-07);
// fenvAmount 0 is a bit-exact bypass (absent-law); it multiplies IN ADDITION to
// the legacy `fenv` acid zap, inside the existing kcut clamp.
fenvAmount = hslider("fenvAmount", 0, -4, 4, 0.01);       // cutoff env depth, OCTAVES (signed; 0 = off, bit-exact)
fenvAttack = hslider("fenvAttack", 0.005, 0.001, 2, 0.001);
fenvDecay  = hslider("fenvDecay", 0.18, 0.01, 3, 0.005);
fenvC   = en.adsr(fenvAttack, fenvDecay, 0, fenvDecay, gate);   // AD contour (sustain 0), note-on triggered
fenvMul = exp(0.6931472 * fenvAmount * fenvC);                  // 2^(amt*contour); amt 0 -> exactly 1.0

fdec = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(0.053)));   // expseg settles AT 0.16s
kcut = max(30, min(cutoff * (1 + fenv*fdec)*fenvMul, 16000));

process = os.sawtooth(freq) : ve.moog_vcf_2bn(min(0.9, res + 0.5), kcut) : *(env*level*gain);
