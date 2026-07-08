// snare_noise — imitation of csd-engine.js instr 11 default ("noise") snare:
//   anz noise -> butbp 1800 Hz bw 1600  (Q ~ 1.125)
//   at1 oscili 0.5, 300 ; at2 oscili 0.3, 185   (two-mode drum body)
//   asig = (anz + at1 + at2) * transeg(1,p3,-6,0)
declare name "snare_noise";
import("stdfaust.lib");

gate  = button("gate");
decay = hslider("decay", 0.16, 0.02, 1, 0.005);
level = hslider("level", 0.8, 0, 2, 0.01);

dec(tau) = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(max(tau, 0.0005))));

aenv = dec(decay/6);                    // transeg -6 ~ tau p3/6
nz   = no.noise : fi.resonbp(1800, 1.125, 1);
body = os.osc(300)*0.5 + os.osc(185)*0.3;

process = (nz + body) * aenv * level;
