// insert_granular — per-voice INSERT effect (inserts contract, type "granular"):
// a grain STUTTER/cloud on the live voice stream. Two overlapping windowed grains
// re-read the incoming signal at a shifted rate (a 2-grain pitch-shift cloud, the
// classic Faust transpose granulator) and an amplitude gate CHOPS the cloud into
// grains at the stutter rate — a modest freeze-stutter that reads as granular.
// The grain WINDOW is a fixed constant (ef.transpose needs a compile-time delay
// length); pitch scatter + stutter density are the live controls. Mono in -> out.
//
// Params (smoothed):
//   pitch    -12..12 semitones — grain re-pitch scatter (0 = cloud at pitch)
//   density  0-1     stutter depth: how hard the grain gate chops the cloud
//   rate     Hz      grain/stutter rate (how fast grains re-trigger)
//   mix      0-1     dry/wet; 0 = bit-exact bypass (insert law)
declare name "insert_granular";
import("stdfaust.lib");

pitch   = hslider("pitch",   0,   -12, 12, 0.01)  : si.smoo;
density = hslider("density", 0.5, 0,   1,  0.001) : si.smoo;
rate    = hslider("rate",    12,  1,   40, 0.01)  : si.smoo;
mix     = hslider("mix",     0.5, 0,   1,  0.001) : si.smoo;

WIN = 2048;   // ~46 ms grain window (constant — ef.transpose delay length)

// 2-grain windowed transpose = a grainy pitch-shift cloud
cloud(x) = x : ef.transpose(WIN, WIN/2, pitch);

// stutter gate: a raised-cosine amplitude chop at the grain rate; density scales
// how deep the dips go (0 = ungated cloud, 1 = fully chopped grains).
gate = 1 - density * (0.5 + 0.5 * os.osc(rate));

wet(x) = cloud(x) * gate;

process = _ <: _, wet : si.interpolate(mix);
