// lead_fuzz — imitation of csd-engine.js leadSource "fuzz":
//   2 saws (kf, kf*1.006)*0.5
//   -> moogladder(min(9000,cutoff*1.3), res+0.45)
//   -> tanh(*(3.2+drive*4))*0.6  [here: ef.cubicnl pre-clip + tanh ceiling]
//   -> butlp min(11000, cutoff*2.2)
declare name "lead_fuzz";
import("stdfaust.lib");

freq   = hslider("freq", 330, 40, 4000, 0.01) : si.smoo;
gate   = button("gate");
cutoff = hslider("cutoff", 3000, 200, 12000, 1) : si.smoo;
res    = hslider("res", 0.2, 0, 0.47, 0.01);     // csound caps res+0.45 at 0.92
drive  = hslider("drive", 0, 0, 1, 0.01);
vib    = hslider("vibrato", 0, 0, 0.03, 0.0001);
vibRate= hslider("vibRate", 5.2, 0.1, 12, 0.01);
level  = hslider("level", 0.5, 0, 1, 0.01);
gain   = hslider("gain", 0.5, 0, 2, 0.01);

kf  = freq * (1 + vib*os.osc(vibRate));
two = (os.sawtooth(kf) + os.sawtooth(kf*1.006)) * 0.5;

// csound: tanh(asig*(3.2+drive*4))*0.6. ef.cubicnl adds even harmonics the
// csound fuzz doesn't have (A/B'd 84% brighter) — pure tanh is the match.
dirt(x) = ma.tanh(x*(3.2 + drive*4)) * 0.6;

env = en.adsr(0.005, 0.06, 0.85, 0.3, gate);

// csound moogladder LOSES passband level as res rises; moog_vcf_2bn is
// normalized — put the loss back so the fuzz drive sees the same signal
rloss = 1.0/(1 + min(0.92, res + 0.45)*1.55);

process = two : ve.moog_vcf_2bn(min(0.92, res + 0.45), min(9000, cutoff*1.3)) : *(rloss)
        : dirt : fi.lowpass(2, min(11000, cutoff*2.2)) : *(env*level*gain);
