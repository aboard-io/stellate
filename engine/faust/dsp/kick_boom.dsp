// kick_boom — imitation of csd-engine.js instr 10 default ("boom") kick:
//   kp expseg 110*dt, 0.06, 46*dt, p3-0.06, 40*dt   (pitch drop)
//   aenv transeg 1, p3, -4, 0                       (convex decay)
//   out tanh(a1*1.4)*0.8
// dec(tau): note-ON-triggered exponential — csound transeg/expseg decays run
// from the note start, NOT from gate release (en.are gets this wrong).
declare name "kick_boom";
import("stdfaust.lib");

gate  = button("gate");
decay = hslider("decay", 0.32, 0.05, 2, 0.01);
tune  = hslider("tune", 1, 0.5, 2, 0.01);
level = hslider("level", 1, 0, 2, 0.01);

dec(tau) = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(max(tau, 0.0005))));
// phase-reset sine: csound re-instantiates oscili at phase 0 per note; a
// free-running os.osc would step mid-cycle at note-on = a click that isn't there
oscr(f) = sin(2.0*ma.PI*ph) with { ph = ((_ + f/ma.SR) * (1 - ba.impulsify(gate)) : ma.frac) ~ _; };

kfreq = (43 + 67*dec(0.02)) * tune;     // expseg 110 -> 46 settles AT 0.06s
aenv  = dec(decay/4);                   // transeg 1,p3,-4,0 ~ tau p3/4
body  = oscr(kfreq) * aenv;

// level scales PRE-tanh, like csound's iamp (drive follows the hit level)
process = ma.tanh(body*level*1.4) * 0.8;
