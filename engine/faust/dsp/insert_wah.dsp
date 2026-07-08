// insert_wah — per-voice INSERT effect (inserts contract, type "wah"): a
// crybaby / Mutron-style AUTO-WAH. An envelope follower on the input drives the
// center frequency of a resonant bandpass — the louder the note, the higher the
// "quack" opens (the funk-bass envelope filter). Params: `sens` = how hard the
// envelope pushes the sweep, `base` = the floor frequency (Hz), `range` = sweep
// width in OCTAVES above base, `q` = bandpass resonance (the vowel sharpness),
// `mix` = dry/wet (mix 0 = unity bypass, like the other insert effects). The
// bandpass removes body, so the dry blend keeps the sub — funk bass wants ~0.8.
// Mono in -> mono out. Attack/release of the follower are fixed fast/medium
// (a plucked-bass envelope); everything tempo-independent (no clock needed).
declare name "insert_wah";
import("stdfaust.lib");

sens  = hslider("sens",  0.6, 0,   1,     0.001) : si.smoo;
base  = hslider("base",  320, 80,  1200,  1)     : si.smoo;
range = hslider("range", 2.2, 0,   4,     0.01)  : si.smoo;
q     = hslider("q",     4.0, 0.5, 12,    0.01)  : si.smoo;
mix   = hslider("mix",   0.85, 0,  1,     0.001) : si.smoo;

att = 0.006; rel = 0.14;   // pluck-fast attack, medium decay = the wah "wow"

// envelope follower (0..~1) -> exponential frequency sweep, base -> base*2^range
env(x)   = an.amp_follower_ar(att, rel, x);
sweep(x) = base * pow(2, range * min(1, 3 * sens * env(x)));
// resonant bandpass with a signal-varying center (recomputed per sample); unity
// gain, so `mix` alone sets the wet level. clamp fc well under Nyquist.
wet(x)   = fi.resonbp(min(sweep(x), 0.45 * ma.SR), q, 1, x);

process = _ <: _, wet : si.interpolate(mix);
