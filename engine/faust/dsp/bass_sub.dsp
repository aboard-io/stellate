// bass_sub — imitation of csd-engine.js bassSource "sub":
//   a1 oscili sine -> tanh(a1*1.6) -> butlp cutoff
declare name "bass_sub";
import("stdfaust.lib");

freq   = hslider("freq", 55, 20, 500, 0.01) : si.smoo;
gate   = button("gate");
cutoff = hslider("cutoff", 400, 60, 6000, 1) : si.smoo;
level  = hslider("level", 1, 0, 2, 0.01);
gain   = hslider("gain", 0.35, 0, 2, 0.01);

env = en.adsr(0.012, 0.4, 0.5, 0.10, gate);

// fenv* = SYNTHESIS-DEPTH unified filter envelope (2026-07);
// fenvAmount 0 is a bit-exact bypass (absent-law).
fenvAmount = hslider("fenvAmount", 0, -4, 4, 0.01);       // cutoff env depth, OCTAVES (signed; 0 = off, bit-exact)
fenvAttack = hslider("fenvAttack", 0.005, 0.001, 2, 0.001);
fenvDecay  = hslider("fenvDecay", 0.18, 0.01, 3, 0.005);
fenvC   = en.adsr(fenvAttack, fenvDecay, 0, fenvDecay, gate);   // AD contour (sustain 0), note-on triggered
fenvMul = exp(0.6931472 * fenvAmount * fenvC);                  // 2^(amt*contour); amt 0 -> exactly 1.0

process = ma.tanh(os.osc(freq)*1.6) : fi.lowpass(2, max(30.0, min(cutoff*fenvMul, 16000.0))) : *(env*level*gain);
