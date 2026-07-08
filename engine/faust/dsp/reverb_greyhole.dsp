// reverb_greyhole — huge diffuse smear (witchhouse / darkambient / wash cluster).
// Reverb COLOR module. 2-in/2-out, `rgain` + `rtone` uniform interface.
declare name "reverb_greyhole";
import("stdfaust.lib");
rgain = hslider("rgain", 1, 0, 3.5, 0.01);
rtone = hslider("rtone", 2600, 500, 12000, 1) : si.smoo;
// TRIM equalizes tail energy to the fx_bus zita default (probe-reverb.js).
w = fi.lowpass(1, rtone) : *(rgain * 0.26);
// greyhole(delaytime, damping, size, earlyDiff, feedback, modDepth, modFreq)
process = re.greyhole(0.5, 0.35, 2.4, 0.7, 0.82, 0.3, 0.5) : w, w;
