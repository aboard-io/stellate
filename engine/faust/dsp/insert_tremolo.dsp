// insert_tremolo — per-voice INSERT effect (inserts contract, type "tremolo").
// Classic amp tremolo: an LFO amplitude-modulates the signal. This IS the
// defining Fender-amp surf-rock sound (opto/bias trem), and doubles as exotica's
// vibraphone "fan". Mono in -> mono out; mix 0 = bit-exact bypass (insert law).
//
// Params (all smoothed):
//   rate   Hz, 0.5-12   LFO speed (surf sits 4-8; vibraphone fan ~3-4)
//   depth  0-1          modulation depth: gain swings 1 .. (1-depth)
//   shape  0-1          0 = pure sine (opto trem), 1 = hard square-ish (bias
//                       trem) — a tanh hardening of the LFO, so shape adds ODD
//                       harmonics to the amplitude envelope
//   wobble 0-1          exotica's fan pitch flutter: a small modulated delay at
//                       the trem rate adds cents-level vibrato (mean pitch
//                       unchanged — the modulation is periodic). surf: 0.
//   mix    0-1          dry/wet; 0 = unity bypass (bit-exact), like every insert
declare name "insert_tremolo";
import("stdfaust.lib");

rate   = hslider("rate",   5.0, 0.5, 12, 0.001) : si.smoo;
depth  = hslider("depth",  0.7, 0,   1,  0.001) : si.smoo;
shape  = hslider("shape",  0,   0,   1,  0.001) : si.smoo;
wobble = hslider("wobble", 0,   0,   1,  0.001) : si.smoo;
mix    = hslider("mix",    0.8, 0,   1,  0.001) : si.smoo;

// --- LFO, hardened from sine toward square by `shape` --------------------
// tanh(k*x)/tanh(k): k->0 is the identity (sine preserved), k large -> square.
// hardening a sine grows its odd harmonics = the harder bias-trem edge.
k      = 0.001 + shape * 8;
lfo    = os.osc(rate);                 // -1..1 sine, phase 0 at t0 (deterministic)
shaped = ma.tanh(k * lfo) / ma.tanh(k); // -1..1, sine at shape 0 -> square at 1

// AM gain: peaks at unity, dips to (1-depth). depth 1 = full chop.
g = 1 - depth * 0.5 * (1 - shaped);

// --- fan pitch wobble: a small modulated delay (cents-level vibrato) ------
// center ~3 ms, swung +/- up to 0.8 ms by wobble at the trem rate (quadrature
// to the amplitude LFO, like the real fan's disc). Delay stays > 0, so the
// vibrato has zero mean rate-of-change => mean pitch is not detuned.
wLfo   = os.oscp(rate, ma.PI/2);       // cosine (fan leads the AM by 90 deg)
dSamp  = (3.0 + wobble * 0.8 * wLfo) * ma.SR / 1000;
wobbled(x) = de.fdelay(1024, max(1, dSamp), x);

wet(x) = wobbled(x) * g;

process = _ <: _, wet : si.interpolate(mix);
