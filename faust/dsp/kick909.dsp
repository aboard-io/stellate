// kick909 — imitation of csd-engine.js instr 10, kickModel "909":
//   kp expseg 165, 0.04, 55, p3-0.04, 46   (pitch sweep, scaled by drum tune dt)
//   aenv transeg 1, p3, -6, 0              (convex exp-ish amp decay)
//   aclk = noise -> buthp 5000, 5ms decay  (the 909 click)
//   out  = tanh((body+click)*1.5)*0.8
declare name "kick909";
import("stdfaust.lib");

gate  = button("gate");
decay = hslider("decay", 0.28, 0.05, 2, 0.01);     // ~p3 of the csound note
tune  = hslider("tune", 1, 0.5, 2, 0.01);          // dt drum-tune multiplier
level = hslider("level", 1, 0, 2, 0.01);           // I.drums.kick

trig = gate : ba.impulsify;

// pitch sweep 165 -> 46 Hz, fast exponential (csound expseg 0.04s knee)
psweep = en.are(0.0005, 0.055, gate);
kfreq  = (46 + 119*psweep) * tune;

// amp: exponential decay standing in for transeg -6 over p3
aenv = en.are(0.0005, decay, gate);
body = os.osc(kfreq) * aenv;

// click: highpassed noise, ~5ms exponential decay (transeg -4 over 0.005)
cenv  = en.are(0.0002, 0.005, gate);
click = no.noise : fi.highpass(2, 5000) : *(cenv*0.5);

process = ma.tanh((body + click)*1.5) * 0.8 * level;
