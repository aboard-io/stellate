// kick_808 — imitation of csd-engine.js instr 10 kickModel "808":
//   kp expseg 72*dt, 0.09, 45*dt, p3-0.09, 38*dt   (soft, low pitch drop)
//   aenv transeg 1, p3, -2, 0                      (LONG, boomy decay)
//   out tanh(a1*1.15)*0.9
declare name "kick_808";
import("stdfaust.lib");

gate  = button("gate");
decay = hslider("decay", 0.5, 0.05, 2, 0.01);
tune  = hslider("tune", 1, 0.5, 2, 0.01);
level = hslider("level", 1, 0, 2, 0.01);

dec(tau) = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(max(tau, 0.0005))));
oscr(f) = sin(2.0*ma.PI*ph) with { ph = ((_ + f/ma.SR) * (1 - ba.impulsify(gate)) : ma.frac) ~ _; };

kfreq = (39 + 33*dec(0.03)) * tune;     // expseg 72 -> 45 settles AT 0.09s
aenv  = dec(decay/2);                   // transeg -2 ~ tau p3/2
body  = oscr(kfreq) * aenv;             // phase 0 at note-on, like csound

// level scales PRE-tanh, like csound's iamp
process = ma.tanh(body*level*1.15) * 0.9;
