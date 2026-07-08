// hat_metal — imitation of csd-engine.js instr 12 hatModel "metal":
//   3 squares at 6317/8429/10781 (inharmonic cluster) + noise 0.4
//   -> buthp 7600, transeg(1,p3,-8,0) fast decay
declare name "hat_metal";
import("stdfaust.lib");

gate  = button("gate");
decay = hslider("decay", 0.05, 0.01, 1, 0.005);
level = hslider("level", 0.7, 0, 2, 0.01);

dec(tau) = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(max(tau, 0.0005))));

aenv = dec(decay/8);                    // transeg -8 ~ tau p3/8
mtl  = os.square(6317)*0.3 + os.square(8429)*0.25 + os.square(10781)*0.2;
sig  = (mtl + no.noise*0.4) : fi.highpass(2, 7600);

process = sig * aenv * level;
