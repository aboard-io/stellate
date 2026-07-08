// snare_crack — imitation of csd-engine.js instr 11, snareModel "crack":
//   aenv transeg 1, p3, -9, 0        (very fast exp decay = the "crack")
//   anz  noise -> butbp 3100 Hz, bw 2300
//   at1  oscili 0.5, 215             (tonal body)
//   asig = (anz*0.8 + at1)*aenv
declare name "snare_crack";
import("stdfaust.lib");

gate  = button("gate");
decay = hslider("decay", 0.12, 0.02, 1, 0.005);
level = hslider("level", 0.8, 0, 2, 0.01);

dec(tau) = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(max(tau, 0.0005))));

aenv = dec(decay/9);                    // transeg -9 ~ tau p3/9

// butbp center 3100, bandwidth 2300  ->  Q = 3100/2300 ~= 1.35
nz   = no.noise : fi.resonbp(3100, 1.35, 1);
body = os.osc(215) * 0.5;

process = (nz*0.8 + body) * aenv * level;
