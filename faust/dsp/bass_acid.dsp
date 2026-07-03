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
level  = hslider("level", 1, 0, 2, 0.01);
gain   = hslider("gain", 0.35, 0, 2, 0.01);

env  = en.adsr(0.012, 0.4, 0.5, 0.10, gate);
fenv = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(0.053)));   // expseg settles AT 0.16s
kcut = max(30, min(cutoff * (1 + 3*fenv), 16000));

process = os.sawtooth(freq) : ve.moog_vcf_2bn(min(0.9, res + 0.5), kcut) : *(env*level*gain);
