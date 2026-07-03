// insert_filtersweep — per-voice INSERT effect (inserts contract, type
// "filtersweep"): moog ladder with its cutoff LFO'd exponentially between lo
// and hi over rateBars BARS. The LFO is tempo-synced through `barSec`
// (seconds per 4-beat bar), which the ENGINE sets from state.bpm and updates
// on bpm glides — the module never guesses tempo. Raised-cosine LFO starting
// at lo (phase -90deg) so a fresh insert opens from the floor.
// Full-wet by design (it IS the voice's filter); "bypass" for this type means
// the chain omits the node.
declare name "insert_filtersweep";
import("stdfaust.lib");

rateBars = hslider("rateBars", 4, 0.25, 64, 0.01) : si.smoo;
lo       = hslider("lo",   250, 40, 12000, 1) : si.smoo;
hi       = hslider("hi",  3200, 60, 16000, 1) : si.smoo;
res      = hslider("res", 0.5, 0, 0.95, 0.001) : si.smoo;
barSec   = hslider("barSec", 2, 0.2, 20, 0.0001) : si.smoo;

lfreq = 1.0 / max(0.05, rateBars * barSec);
x     = 0.5 - 0.5 * os.oscp(lfreq, ma.PI/2);    // raised cosine, starts at 0 (=lo)
fc    = max(30, min(lo * pow(max(1.001, hi/lo), x), 16000));

// ve.moogLadder in the bundled faustlibraries is broken (VOICES.md);
// moog_vcf_2bn takes Hz + res 0..1 — same semantics as the voice modules.
process = ve.moog_vcf_2bn(res, fc);
