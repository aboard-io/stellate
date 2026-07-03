// snare_clap — imitation of csd-engine.js instr 11 snareModel "clap":
//   anz noise -> butbp 1250 Hz bw 950  (Q ~ 1.32)
//   aflut oscili 0.4, 41              (41 Hz amplitude flutter = the multi-clap)
//   asig = anz*(0.72 + aflut) * transeg(1,p3,-6,0)
declare name "snare_clap";
import("stdfaust.lib");

gate  = button("gate");
decay = hslider("decay", 0.18, 0.02, 1, 0.005);
level = hslider("level", 0.8, 0, 2, 0.01);

dec(tau) = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(max(tau, 0.0005))));

aenv = dec(decay/6);                    // transeg -6 ~ tau p3/6
nz   = no.noise : fi.resonbp(1250, 1.32, 1);
flut = 0.72 + os.osc(41)*0.4;

process = nz * flut * aenv * level;
