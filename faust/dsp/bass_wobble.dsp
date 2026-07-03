// bass_wobble — imitation of csd-engine.js bassSource "wobble":
//   a1 vco2 saw
//   klfo oscili 0.5, wobbleHz ; kcf = cutoff*(0.5 + (klfo+0.5)*1.1)
//   moogladder(kcf, min(0.85, res+0.4)) -> tanh(*1.5)*0.85
declare name "bass_wobble";
import("stdfaust.lib");

freq     = hslider("freq", 55, 20, 500, 0.01) : si.smoo;
gate     = button("gate");
cutoff   = hslider("cutoff", 500, 60, 6000, 1);
res      = hslider("res", 0.2, 0, 0.45, 0.01);
wobbleHz = hslider("wobbleHz", 2.4, 0.1, 16, 0.01);
level    = hslider("level", 1, 0, 2, 0.01);
gain     = hslider("gain", 0.35, 0, 2, 0.01);

env  = en.adsr(0.012, 0.4, 0.5, 0.10, gate);
klfo = os.osc(wobbleHz)*0.5;
kcf  = max(40, min(cutoff * (0.5 + (klfo + 0.5)*1.1), 16000));

process = os.sawtooth(freq) : ve.moog_vcf_2bn(min(0.85, res + 0.4), kcf) : *(1.5) : ma.tanh : *(0.85*env*level*gain);
