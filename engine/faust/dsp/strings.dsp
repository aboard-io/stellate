// strings — imitation of csd-engine.js stringsSource:
//   4 saws at kf*0.995 / kf / kf*1.005 / kf*1.01, *0.24
//   -> butlp cutoff -> butlp cutoff*1.6 (double pole = dark ensemble)
// Shared by pad (slow attack) and lead (faster) via the attack param.
declare name "strings";
import("stdfaust.lib");

freq   = hslider("freq", 220, 20, 4000, 0.01) : si.smoo;
gate   = button("gate");
cutoff = hslider("cutoff", 1400, 80, 12000, 1) : si.smoo;
attack = hslider("attack", 0.8, 0.005, 5, 0.005);
level  = hslider("level", 0.5, 0, 1, 0.01);
gain   = hslider("gain", 0.12, 0, 2, 0.01);

kf = freq * (1 + 0.004*os.osc(0.3));
ens = (os.sawtooth(kf*0.995) + os.sawtooth(kf) + os.sawtooth(kf*1.005)
     + os.sawtooth(kf*1.01)) * 0.24;

env = en.adsr(attack, 1.5, 0.8, 2.5, gate);

// fenv* = SYNTHESIS-DEPTH unified filter envelope (2026-07);
// fenvAmount 0 is a bit-exact bypass (absent-law).
fenvAmount = hslider("fenvAmount", 0, -4, 4, 0.01);       // cutoff env depth, OCTAVES (signed; 0 = off, bit-exact)
fenvAttack = hslider("fenvAttack", 0.005, 0.001, 2, 0.001);
fenvDecay  = hslider("fenvDecay", 0.18, 0.01, 3, 0.005);
fenvC   = en.adsr(fenvAttack, fenvDecay, 0, fenvDecay, gate);   // AD contour (sustain 0), note-on triggered
fenvMul = exp(0.6931472 * fenvAmount * fenvC);                  // 2^(amt*contour); amt 0 -> exactly 1.0
kcu = max(30.0, min(cutoff*fenvMul, 16000.0));

process = ens : fi.lowpass(2, kcu) : fi.lowpass(2, min(19000, kcu*1.6)) : *(env*level*gain);
