// insert_chorus — per-voice INSERT effect (inserts contract, type "chorus").
// Single-tap modulated fractional delay: 15 ms center, LFO swings it by up to
// ±9 ms (depth 1) => 6..24 ms, inside the classic 5-25 ms chorus zone.
// mix = dry/wet (0.5 = classic equal blend; mix 0 = unity bypass).
declare name "insert_chorus";
import("stdfaust.lib");

rate  = hslider("rate",  0.8, 0.01, 8, 0.001) : si.smoo;
depth = hslider("depth", 0.5, 0,    1, 0.001) : si.smoo;
mix   = hslider("mix",   0.5, 0,    1, 0.001) : si.smoo;

dSamp = (0.015 + 0.009 * depth * os.osc(rate)) * ma.SR;
wet   = de.fdelay(2048, dSamp);

process = _ <: _, wet : si.interpolate(mix);
