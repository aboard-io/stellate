// insert_flanger — per-voice INSERT effect (inserts contract, type "flanger"):
// the classic jet-plane sweep. A SHORT modulated delay (0.6 .. ~5.6 ms) with
// SIGNED feedback swept by an LFO; summing the swept delay against the dry
// (si.interpolate) forms the moving comb notches. Distinct from the phaser
// (allpass notches, wider) and chorus (longer un-fed delay, no comb): the
// flanger's short delay + feedback gives the deep metallic zip. Mono in -> out.
//
// Params (smoothed):
//   rate      Hz, 0.01-8   sweep speed
//   depth     0-1          sweep width (delay excursion)
//   feedback  -0.95..0.95  resonance; SIGNED (negative = the hollow through-zero
//                          color, positive = the ringing tone). |fb| < 1 stable
//   mix       0-1          dry/wet; 0 = bit-exact bypass (insert law)
declare name "insert_flanger";
import("stdfaust.lib");

rate  = hslider("rate",     0.4,  0.01, 8,    0.001) : si.smoo;
depth = hslider("depth",    0.8,  0,    1,    0.001) : si.smoo;
fb    = hslider("feedback", 0.5, -0.95, 0.95, 0.001) : si.smoo;
mix   = hslider("mix",      0.6,  0,    1,    0.001) : si.smoo;

// swept delay time in ms -> samples (raised cosine, starts near the floor)
dms   = 0.6 + depth * 5.0 * (0.5 - 0.5 * os.oscp(rate, ma.PI/2));
dsamp = max(1, dms * ma.SR / 1000);

// feedback comb: out = fdelay(x + fb*out). The delayed signal is the wet path.
wet(x) = ((+ : de.fdelay(2048, dsamp)) ~ *(fb)) (x);

process = _ <: _, wet : si.interpolate(mix);
