// insert_ringmod — per-voice INSERT effect (inserts contract, type "ringmod"):
// a ring modulator — multiply the voice by a sine carrier to graft metallic,
// clangorous inharmonic sidebands (sum/difference tones). Cheap and unmistakable
// (Dalek voices, bell-metal leads, sci-fi textures). Mono in -> mono out;
// mix 0 = bit-exact bypass (the insert law).
//
// Params:
//   freq  Hz, 20-4000   carrier frequency (low = tremolo-ish AM, high = clangor)
//   mix   0-1           dry/wet; 0 = bit-exact bypass
declare name "insert_ringmod";
import("stdfaust.lib");

freq = hslider("freq", 220, 20, 4000, 0.01) : si.smoo;
mix  = hslider("mix",  0.4, 0,  1,    0.001) : si.smoo;

wet(x) = x * os.osc(freq);

process = _ <: _, wet : si.interpolate(mix);
