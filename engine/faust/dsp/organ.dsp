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

process = harms*0.32 : fi.lowpass(2, lp) : *(env*level*gain);
