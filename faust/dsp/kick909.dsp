// kick909 — imitation of csd-engine.js instr 10, kickModel "909":
//   kp expseg 165, 0.04, 55, p3-0.04, 46   (pitch sweep, scaled by drum tune dt)
//   aenv transeg 1, p3, -6, 0              (tight exp thump)
//   aclk = noise -> buthp 5000, 5ms decay  (the 909 click)
//   out  = tanh((body+click)*1.5)*0.8
declare name "kick909";
import("stdfaust.lib");

gate  = button("gate");
decay = hslider("decay", 0.28, 0.05, 2, 0.01);     // ~p3 of the csound note
tune  = hslider("tune", 1, 0.5, 2, 0.01);          // dt drum-tune multiplier
level = hslider("level", 1, 0, 2, 0.01);           // I.drums.kick

dec(tau) = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(max(tau, 0.0005))));
oscr(f) = sin(2.0*ma.PI*ph) with { ph = ((_ + f/ma.SR) * (1 - ba.impulsify(gate)) : ma.frac) ~ _; };

kfreq = (48 + 117*dec(0.013)) * tune;   // expseg 165 -> 55 settles AT 0.04s
aenv  = dec(decay/6);                   // transeg -6 ~ tau p3/6
body  = oscr(kfreq) * aenv;             // phase 0 at note-on, like csound

// click: highpassed noise, transeg -4 over 0.005s ~ tau 1.3ms
click = no.noise : fi.highpass(2, 5000) : *(dec(0.0013)*0.5);

// level scales PRE-tanh, like csound's iamp
process = ma.tanh((body + click)*level*1.5) * 0.8;
