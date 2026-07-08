// tom — imitation of csd-engine.js instr 13 (low grungy tom):
//   kp expseg ipt*1.14, 0.03, ipt  (pitch dip)
//   body = osc(kp) + 0.5*osc(1.5kp) + 0.4*osc(0.5kp), transeg(-3)
//   clack = noise -> butbp(ipt*2.4, bw ipt*1.5), 12ms burst, *0.6
//   dirt  = tanh(body*3.4);  out = (body*0.35 + dirt*0.75)*0.72
declare name "tom";
import("stdfaust.lib");

gate  = button("gate");
pitch = hslider("pitch", 105, 40, 400, 1);
decay = hslider("decay", 0.4, 0.05, 2, 0.01);
level = hslider("level", 1, 0, 2, 0.01);

dec(tau) = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(max(tau, 0.0005))));
oscr(f) = sin(2.0*ma.PI*ph) with { ph = ((_ + f/ma.SR) * (1 - ba.impulsify(gate)) : ma.frac) ~ _; };

kp   = pitch * (1 + 0.14*dec(0.01));    // expseg dip settles AT 0.03s
aenv = dec(decay/3);                    // transeg -3 ~ tau p3/3
oscs = oscr(kp) + oscr(kp*1.5)*0.5 + oscr(kp*0.5)*0.4;   // phase 0 at note-on

clack = no.noise*0.85 : fi.resonbp(pitch*2.4, 1.6, 1) : *(dec(0.0017)*0.6);  // expseg 1->0.001 over 12ms

body = oscs*aenv + clack;
dirt = ma.tanh(body*3.4);

process = (body*0.35 + dirt*0.75) * 0.72 * level;
