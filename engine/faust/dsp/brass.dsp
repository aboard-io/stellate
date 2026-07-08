// brass — imitation of csd-engine.js brassSource (organic section brass):
//   7 saws at dets 0.990/0.996/0.9995/1.004/1.009/0.983/1.017, *0.15
//   5.2 Hz vibrato (0.5%)
//   kbite 0 -> 1 over 0.08s; kcf = 500 + bite*1300 + vel*16000, capped
//   moogladder(kcf, 0.1) ; asig += tanh(asig*1.5)*0.22  (the "bite")
declare name "brass";
import("stdfaust.lib");

freq   = hslider("freq", 220, 20, 4000, 0.01) : si.smoo;
gate   = button("gate");
cutoff = hslider("cutoff", 9000, 500, 12000, 1);   // cap: min(12000, recipe cutoff)
bite   = hslider("bite", 0.1, 0, 1, 0.01);         // csound p5*16000/16000 (velocity brightness)
attack = hslider("attack", 0.08, 0.005, 3, 0.005);
level  = hslider("level", 0.5, 0, 1, 0.01);
gain   = hslider("gain", 0.3, 0, 2, 0.01);

kvb = 1 + 0.005*os.osc(5.2);
kfv = freq * kvb;
sect = (os.sawtooth(kfv*0.990) + os.sawtooth(kfv*0.996) + os.sawtooth(kfv*0.9995)
      + os.sawtooth(kfv*1.004) + os.sawtooth(kfv*1.009) + os.sawtooth(kfv*0.983)
      + os.sawtooth(kfv*1.017)) * 0.15;

kbite = en.asr(0.08, 1, 0.1, gate);
kcf   = max(200, min(cutoff, 500 + kbite*1300 + bite*16000));

flt = sect : ve.moog_vcf_2bn(0.1, min(kcf, 16000));
sig = flt + ma.tanh(flt*1.5)*0.22;

env = en.adsr(attack, 1.0, 0.85, 0.4, gate);

process = sig * env * level * gain;
