// reverb_spring — surfrock's identity: the boing/flutter of a real spring tank.
// Hand-rolled (no re.lib spring): a dispersive allpass cascade gives the
// metallic chirp, a modulated feedback delay line gives the ringing "boing",
// and a slow LFO fluttering the delay length is the tank's characteristic
// warble. L/R use slightly different travel times for a stereo tank pair.
// Reverb COLOR module. 2-in/2-out, `rgain` + `rtone` uniform interface.
declare name "reverb_spring";
import("stdfaust.lib");
rgain = hslider("rgain", 1, 0, 3.5, 0.01);
rtone = hslider("rtone", 3400, 500, 9000, 1) : si.smoo;

// dispersive Schroeder-allpass cascade — the metallic chirp
ap(n, g) = fi.allpass_comb(4096, n, g);
disp = ap(149, 0.62) : ap(211, 0.60) : ap(97, 0.58) : ap(263, 0.56) : ap(181, 0.55);

// modulated feedback ring: fractional delay ~ spring travel time, slow flutter,
// tone lowpass + dispersion inside the loop, feedback g = decay.
spring(baseDel, lfoHz, g) =
  (+ ~ (de.fdelay(8192, baseDel + os.osc(lfoHz) * 6.0) : fi.lowpass(2, 4200) : disp : *(g)));

// TRIM equalizes tail energy to the fx_bus zita default (test/probes/reverb.probe.js).
w = fi.lowpass(1, rtone) : *(rgain * 0.52);
// sum to mono, split to two slightly detuned tanks (stereo spring pair)
process = _, _ :> *(0.5) <: (spring(1367, 0.70, 0.80) : w), (spring(1523, 0.53, 0.80) : w);
