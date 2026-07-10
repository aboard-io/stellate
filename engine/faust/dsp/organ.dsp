// organ — imitation of csd-engine.js padSource "organ":
//   additive partials 1,2,3,4,6 at 0.9/0.55/0.36/0.27/0.17, *0.32
//   -> butlp min(9000, cutoff*2.2)
// Pad env (instr 1): attack -> hold *0.8 -> long 2.5s release; plus 0.3Hz wow.
declare name "organ";
import("stdfaust.lib");

freq   = hslider("freq", 220, 20, 4000, 0.01) : si.smoo;
gate   = button("gate");
cutoff = hslider("cutoff", 1200, 80, 12000, 1) : si.smoo;
attack = hslider("attack", 0.3, 0.005, 5, 0.005);
level  = hslider("level", 0.5, 0, 1, 0.01);
gain   = hslider("gain", 0.12, 0, 2, 0.01);

kf = freq * (1 + 0.004*os.osc(0.3));
harms = os.osc(kf)*0.9 + os.osc(kf*2)*0.55 + os.osc(kf*3)*0.36
      + os.osc(kf*4)*0.27 + os.osc(kf*6)*0.17;

env = en.adsr(attack, 1.5, 0.8, 2.5, gate);
lp  = min(9000, cutoff*2.2);

// fenv* = SYNTHESIS-DEPTH unified filter envelope (2026-07);
// fenvAmount 0 is a bit-exact bypass (absent-law).
fenvAmount = hslider("fenvAmount", 0, -4, 4, 0.01);       // cutoff env depth, OCTAVES (signed; 0 = off, bit-exact)
fenvAttack = hslider("fenvAttack", 0.005, 0.001, 2, 0.001);
fenvDecay  = hslider("fenvDecay", 0.18, 0.01, 3, 0.005);
fenvC   = en.adsr(fenvAttack, fenvDecay, 0, fenvDecay, gate);   // AD contour (sustain 0), note-on triggered
fenvMul = exp(0.6931472 * fenvAmount * fenvC);                  // 2^(amt*contour); amt 0 -> exactly 1.0

process = harms*0.32 : fi.lowpass(2, max(30.0, min(lp*fenvMul, 16000.0))) : *(env*level*gain);
