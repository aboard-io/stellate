// reverb_shimmer — a NEW reverb COLOR (fx wings future-work, flagged by the mix
// pass): an ethereal ambient wash whose feedback tail is pitch-shifted an OCTAVE
// UP, so the reverb slowly blooms into a shimmering choir of octaves above the
// source (the Eno/Valhalla "shimmer"). Reverb COLOR module — same uniform
// interface as reverb_dattorro/spring: 2-in/2-out, `rgain` (= reverb*3.2) + `rtone`
// return lowpass. Wired into the reverbColor system (state-engine REVERB_COLORS),
// selected per genre via state.reverbColor = "shimmer".
declare name "reverb_shimmer";
import("stdfaust.lib");
rgain = hslider("rgain", 1, 0, 3.5, 0.01);
rtone = hslider("rtone", 4200, 500, 12000, 1) : si.smoo;

// octave-up pitch shift (2-grain transpose) for the shimmer feedback path
shift = ef.transpose(1024, 256, 12);

// a diffuse feedback tank: fractional delay -> tone lowpass -> Schroeder allpass
// diffusion -> a feedback that BLENDS the plain tail with an octave-up copy, so
// each pass climbs an octave and the reverb rains upward. Damping (lowpass +
// allpass losses + g < 1) keeps the shifted feedback from running away.
diff = fi.allpass_comb(4096, 149, 0.62) : fi.allpass_comb(4096, 211, 0.58);
shimFB = _ <: *(0.62), (shift : *(0.38)) :> _;
// long ambient wash: high feedback g gives RT ~2-3 s; the lowpass in the loop +
// allpass diffusion + the modest shimmer blend keep the octave-up feedback stable.
tank(baseDel, g) = (+ ~ (de.fdelay(16384, baseDel) : fi.lowpass(2, 6500) : diff : shimFB : *(g)));

// TRIM equalizes tail energy to the fx_bus zita reference (probe-reverb.js);
// set from the probe measurement so `reverb` means the same wetness as the
// other colors.
TRIM = 0.64;
w = fi.lowpass(1, rtone) : *(rgain * TRIM);
process = _, _ :> *(0.5) <: (tank(2131, 0.94) : w), (tank(2437, 0.94) : w);
