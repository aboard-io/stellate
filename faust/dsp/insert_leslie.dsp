// insert_leslie — per-voice INSERT effect (inserts contract, type "leslie"): a
// MONO rotary-speaker cabinet, cribbed from the hammond voice's internal Leslie
// but collapsed to one mic (the insert chain is mono in -> mono out). An 800 Hz
// crossover splits the voice into a treble HORN rotor and a bass DRUM rotor;
// each rotor spins at its own inertial rate with amplitude modulation (tremolo)
// AND a doppler-ish fractional-delay pitch shimmer (FM). The two rotors spin at
// different speeds so the beating between them is the Leslie swirl even in mono.
//
// Params (all smoothed except `speed`, which carries rotor INERTIA of its own):
//   speed  0..1   0 = chorale (slow) .. 1 = tremolo (fast). The horn spins up
//                 faster than the heavy bass drum, so speed changes audibly ramp
//   depth  0..1   AM + doppler amount (the swirl intensity)
//   mix    0..1   dry/wet; 0 = bit-exact bypass (the insert law)
declare name "insert_leslie";
import("stdfaust.lib");

speed = hslider("speed", 0.85, 0, 1, 0.001);
depth = hslider("depth", 0.8,  0, 1, 0.001) : si.smoo;
mix   = hslider("mix",   0.7,  0, 1, 0.001) : si.smoo;

// rotor speed morph with INERTIA (horn light, bass drum heavy) — the two rates
// cross-fade at different time constants, so the swirl accelerates realistically.
spH   = speed : si.smooth(ba.tau2pole(0.9));
spD   = speed : si.smooth(ba.tau2pole(1.9));
hRate = 0.80 + spH * (6.70 - 0.80);   // horn 0.8 Hz chorale -> 6.7 Hz tremolo
dRate = 0.66 + spD * (5.50 - 0.66);   // bass drum a touch slower
hs    = os.osc(hRate);                 // -1..1 rotor phase (sine)
ds    = os.osc(dRate);

wet(x) = (hornOut + drumOut) * 0.9    // gentle makeup — AM peaks at +3.5 dB
with {
  horn = x : fi.highpass(2, 800);
  drum = x : fi.lowpass(2,  800);
  // doppler FM: the rotor's approach/recede swings a short fractional delay,
  // pitch-shimmering each band (stays > 0 samples for depth <= 1).
  hD = horn : de.fdelay(256, 34 + depth * 30 * hs);
  dD = drum : de.fdelay(256, 14 + depth *  8 * ds);
  // AM tremolo, centered on unity
  hornOut = hD * (1 + depth * 0.50 * hs);
  drumOut = dD * (1 + depth * 0.28 * ds);
};

process = _ <: _, wet : si.interpolate(mix);
