// insert_delay — per-voice INSERT effect (inserts contract, type "delay"): a
// TAPE-style echo living ON the voice stream (distinct from the global delay
// SEND in fx_bus, which is a shared bus). Feedback echo with a tone lowpass in
// the loop (each repeat darkens, like tape) and a subtle WOW (slow delay-time
// wobble = the capstan flutter). TEMPO-SYNCED: `timeBars` is the delay time as a
// fraction of a 4-beat bar, scaled by `barSec` (seconds/bar) which the ENGINE
// sets from state.bpm and updates on glides — same mechanism as insert_filtersweep.
//
// Params:
//   timeBars  fraction of a bar (0.1875 = a dotted-eighth at 4/4)
//   barSec    seconds per 4-beat bar (engine-set; do not author by hand)
//   feedback  0-0.9   repeat count
//   tone      Hz      lowpass in the feedback loop (tape darkening)
//   wow       0-1     capstan flutter depth (subtle pitch wobble on the repeats)
//   mix       0-1     dry/wet; 0 = bit-exact bypass (insert law)
declare name "insert_delay";
import("stdfaust.lib");

timeBars = hslider("timeBars", 0.1875, 0.01, 4,  0.0001);
barSec   = hslider("barSec",   2,      0.1,  20, 0.0001) : si.smoo;
feedback = hslider("feedback", 0.35,   0,    0.9,0.001)  : si.smoo;
tone     = hslider("tone",     3000,   300,  12000, 1)   : si.smoo;
wow      = hslider("wow",      0.2,    0,    1,  0.001)   : si.smoo;
mix      = hslider("mix",      0.35,   0,    1,  0.001)   : si.smoo;

MAXD  = 65536;   // ~1.49 s at 44.1k
dtSec = max(0.01, timeBars * barSec);
// subtle wow: ~+/-0.35% delay-time flutter at ~0.6 Hz (mean time preserved)
wob   = 1 + wow * 0.0035 * os.osc(0.6);
dsamp = min(MAXD - 2, max(1, dtSec * ma.SR * wob));

// feedback echo train (the delayed+tone-shaped signal is the wet path).
wet(x) = ((+ : de.fdelay(MAXD, dsamp) : fi.lowpass(1, tone)) ~ *(feedback)) (x);

process = _ <: _, wet : si.interpolate(mix);
