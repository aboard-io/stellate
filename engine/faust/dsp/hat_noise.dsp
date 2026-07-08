// hat_noise — imitation of csd-engine.js instr 12 default ("noise") hat:
//   anz noise*1.7 -> buthp 6500
//   am1 vco2 0.15, 8200 square
//   asig = (anz + am1) * transeg(1,p3,-5,0)
// `decay` doubles as the open/closed dimension (score p5 open -> longer p3).
declare name "hat_noise";
import("stdfaust.lib");

gate  = button("gate");
decay = hslider("decay", 0.06, 0.01, 1, 0.005);
level = hslider("level", 0.7, 0, 2, 0.01);

dec(tau) = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(max(tau, 0.0005))));

aenv = dec(decay/5);                    // transeg -5 ~ tau p3/5
nz   = no.noise*1.7 : fi.highpass(2, 6500);
ring = os.square(8200)*0.15;

process = (nz + ring) * aenv * level;
