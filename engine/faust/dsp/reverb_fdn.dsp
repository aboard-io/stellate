// reverb_fdn — dry-ish room (tango / blues / prelude): a room, NOT a wash.
// Schroeder freeverb at a modest room size = tight ambience with a fast tail.
// Reverb COLOR module. 2-in/2-out, `rgain` + `rtone` uniform interface.
declare name "reverb_fdn";
import("stdfaust.lib");
rgain = hslider("rgain", 1, 0, 3.5, 0.01);
rtone = hslider("rtone", 6000, 500, 12000, 1) : si.smoo;
// TRIM equalizes tail energy to the fx_bus zita default (test/probes/reverb.probe.js).
w = fi.lowpass(1, rtone) : *(rgain * 0.055);
// stereo_freeverb(combfeed, allpassfeed, damping, spread)
process = re.stereo_freeverb(0.72, 0.5, 0.4, 0.6) : w, w;
