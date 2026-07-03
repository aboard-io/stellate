// piano — imitation of csd-engine.js pianoSource (struck string):
//   inharmonic partials 1 / 2.004 / 3.011 / 4.022 at 1/0.5/0.24/0.11
//   kdec transeg 1 -> 0.05 (-3) over note; uppers decay with kdec
//   hammer: noise*0.35 -> buthp 2400, 8ms burst, *0.4
//   asig = (p1 + uppers*kdec)*0.42*kdec + hammer -> butlp cutoff
// Serves pad piano, lead piano AND bass piano (engine maps cutoff*2 / *2.5).
declare name "piano";
import("stdfaust.lib");

freq   = hslider("freq", 262, 20, 4000, 0.01) : si.smoo;
gate   = button("gate");
cutoff = hslider("cutoff", 5000, 200, 14000, 1) : si.smoo;
decay  = hslider("decay", 2.0, 0.1, 8, 0.01);
level  = hslider("level", 0.5, 0, 1, 0.01);
gain   = hslider("gain", 0.4, 0, 2, 0.01);

dec(tau) = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(max(tau, 0.0005))));

kdec = dec(decay/3);                   // transeg 1,p3,-3 ~ tau p3/3 (decay = note dur)
p1 = os.osc(freq);
up = os.osc(freq*2.004)*0.5 + os.osc(freq*3.011)*0.24 + os.osc(freq*4.022)*0.11;

hammer = no.noise*0.35 : fi.highpass(2, 2400) : *(dec(0.002)*0.4);   // transeg -4 over 8ms

env = en.adsr(0.003, 0.06, 0.85, 0.3, gate);

process = ((p1 + up*kdec)*0.42*kdec + hammer) : fi.lowpass(2, cutoff) : *(env*level*gain);
