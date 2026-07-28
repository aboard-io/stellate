// reverb_dattorro — clean plate (citypop / house). Dattorro figure-8 plate.
// Reverb COLOR module (fx wings round): a per-genre-selectable reverb node.
// Uniform interface across the color family: 2-in/2-out, `rgain` output scale
// (= reverb*3.2, the fx_bus calibration) + `rtone` return lowpass.
declare name "reverb_dattorro";
import("stdfaust.lib");
rgain = hslider("rgain", 1, 0, 3.5, 0.01);
rtone = hslider("rtone", 5200, 500, 12000, 1) : si.smoo;
// TRIM equalizes tail energy to the fx_bus zita default (test/probes/reverb.probe.js) so
// a given per-genre `reverb` scalar gives comparable wetness across colors.
w = fi.lowpass(1, rtone) : *(rgain * 0.71);
// dattorro_rev(pre_delay, bw, i_diff1, i_diff2, decay, d_diff1, d_diff2, damping)
process = re.dattorro_rev(0.004, 0.72, 0.75, 0.625, 0.65, 0.7, 0.5, 0.45) : w, w;
