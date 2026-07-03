// pad_saw — imitation of csd-engine.js instr 1 default pad:
//   a1/a3 = saws at kf*dLo, kf*dHi (detune ~0.6%), a2 at kf; *0.33
//   -> moogladder(cutoff, res~0.1); slow linseg attack from the pad recipe.
// Spec'd here as 2 detuned saws + slow attack env + LPF.
declare name "pad_saw";
import("stdfaust.lib");

freq   = hslider("freq", 220, 20, 4000, 0.01) : si.smoo;
gate   = button("gate");
cutoff = hslider("cutoff", 1400, 80, 12000, 1) : si.smoo;
attack = hslider("attack", 0.8, 0.005, 4, 0.005);
level  = hslider("level", 0.4, 0, 1, 0.01);

s1 = os.sawtooth(freq*0.9965);
s2 = os.sawtooth(freq*1.0035);
two = (s1 + s2) * 0.45;

env = en.asr(attack, 1.0, 1.2, gate);   // slow swell in, long release out
nf  = min(cutoff/(ma.SR/2.0), 0.49);

process = two : ve.moogLadder(nf, 1.2) : *(env*level);
