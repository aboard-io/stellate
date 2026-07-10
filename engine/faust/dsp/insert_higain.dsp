// insert_higain — per-voice INSERT effect (inserts contract, type "higain"):
// a STAGED high-gain amp for the heavy genres — the proper answer to "truly
// distorted heavy effects chain" (insert_distort is one waveshaper; this is
// the amp). Signal path, in order:
//
//   1. TIGHTNESS GATE — a fast downward expander on the INPUT (amp-follower
//      0.4 ms open / 60 ms close, cubic-law expansion below the threshold).
//      This is what gives palm-mute chugs their definition: inter-note noise
//      and drive-hiss collapse instead of smearing. `gate` 0 = the threshold
//      sits at -90 dB (transparent for any real signal); 1 = -35 dB (brutal).
//   2. STAGED DRIVE — three cascaded HAND-ROLLED waveshapers (tanh soft clip
//      -> clamped-cubic -> hard clip+rounding; symmetric transfer functions,
//      NO even-harmonic bias — ef.cubicnl's asymmetry was A/B'd out of
//      lead_fuzz, see VOICES.md) with inter-stage 1-pole highpasses (140/180
//      Hz) so cascaded gain never pumps mud. `stages` 1..3 crossfades the
//      stage taps (piecewise-linear, weights sum to 1) — 1 = crunch,
//      2 = rhythm stack, 3 = full scream. Each tap is loudness-normalized so
//      the morph doesn't ride volume.
//   3. TONE STACK — post-drive 3-band: low shelf 130 Hz, mid peak 650 Hz
//      (the scoop knob), high shelf 3.2 kHz, each 0..1 -> ±12 dB (0.5 flat).
//   4. CAB SIM — fixed 4x12 approximation: HP 80 Hz (2nd order), presence
//      peak +0..7 dB at 2.5 kHz, LP 5.2 kHz (3rd order — the speaker's cliff).
//   5. LEVEL COMPENSATION + DC BLOCKER — drive-tracking makeup pulls the wet
//      path back near dry loudness (mix rides aren't volume rides); `level`
//      is the master trim; fi.dcblocker guarantees no DC ever leaves (three
//      clip stages + shelving EQ can rectify asymmetric program material).
//
// mix 0 is a bit-exact bypass (unity dry path), never a graph disconnect —
// the insert-chain law. Mono in -> mono out, sits between a voice and its
// layer tap / fx sends like every insert.
declare name "insert_higain";
import("stdfaust.lib");

gatek  = hslider("gate", 0.35, 0, 1, 0.001) : si.smoo;
drive  = hslider("drive", 0.65, 0, 1, 0.001) : si.smoo;
stages = hslider("stages", 2, 1, 3, 0.01) : si.smoo;
low    = hslider("low", 0.5, 0, 1, 0.001) : si.smoo;
mid    = hslider("mid", 0.5, 0, 1, 0.001) : si.smoo;
high   = hslider("high", 0.5, 0, 1, 0.001) : si.smoo;
presence = hslider("presence", 0.5, 0, 1, 0.001) : si.smoo;
level  = hslider("level", 0.7, 0, 1, 0.001) : si.smoo;
mix    = hslider("mix", 1, 0, 1, 0.001) : si.smoo;

// ---- 1. tightness gate (downward expander) --------------------------------
// threshold -70 dB (gate 0, transparent) .. -20 dB (gate 1); cubic expansion
// below it. Follower: 0.4 ms open (never clips an attack), 25 ms close (the
// metal-tight release — a chug's tail is CUT, not faded; a slower release
// left the gate held open by note tails, measured in cal-higain.js). env
// floor 1e-7 keeps the ratio finite (no 0/0 NaN in silence).
gthr    = ba.db2linear(-70.0 + gatek * 50.0);
gg(x)   = min(1.0, pow(max(an.amp_follower_ar(0.0004, 0.025, x), 0.0000001) / gthr, 3.0));
gated(x) = x * gg(x);

// ---- 2. staged drive (hand-rolled symmetric shapers + inter-stage HP) -----
// pre-HP 110 Hz tightens the low end BEFORE any clipping (chug, not fart).
clip1(x) = max(-1.0, min(1.0, x));
cub(x)   = clip1(x) - clip1(x)*clip1(x)*clip1(x) / 3.0;   // clamped cubic, odd-only
g1 = 1.0 + drive * 14.0;    // stage gains track `drive`
g2 = 1.0 + drive * 9.0;
g3 = 1.0 + drive * 6.0;
st1(x) = ma.tanh(x * g1);                       // soft valve squash
st2(x) = cub(x * g2) * 1.5;                     // harder knee (cubic saturates at 2/3)
st3(x) = (clip1(x * g3 * 1.6) * 0.72 + cub(x * g3) * 0.42);  // hard clip + rounding blend
pre(x) = fi.highpass(1, 110, x);
a1(x) = st1(pre(x));
a2(x) = st2(fi.highpass(1, 140, a1(x)));
a3(x) = st3(fi.highpass(1, 180, a2(x)));
// per-tap loudness normalization (drive-tracking) so the stage morph and the
// drive knob don't double as volume knobs — calibrated on saw-chug program.
n1 = 0.79 / (1.0 + drive * 1.6);
n2 = 0.256 / (1.0 + drive * 0.9);
n3 = 0.144 / (1.0 + drive * 0.7);
w1 = max(0.0, 1.0 - abs(stages - 1.0));
w2 = max(0.0, 1.0 - abs(stages - 2.0));
w3 = max(0.0, 1.0 - abs(stages - 3.0));
driven(x) = a1(x)*n1*w1 + a2(x)*n2*w2 + a3(x)*n3*w3;

// ---- 3. tone stack (±12 dB; 0.5 = flat) -----------------------------------
tstack = fi.low_shelf((low - 0.5) * 24.0, 130)
       : fi.peak_eq((mid - 0.5) * 24.0, 650, 600)
       : fi.high_shelf((high - 0.5) * 24.0, 3200);

// ---- 4. cab sim (fixed 4x12-ish cascade) ----------------------------------
cab = fi.highpass(2, 80) : fi.peak_eq(presence * 7.0, 2500, 1400) : fi.lowpass(3, 5200);

// ---- 5. level comp + DC blocker -------------------------------------------
// staged shapers land near unit amplitude; the cab LP eats ~2 dB of a bright
// stack. level 0.7 (the default) ~= dry loudness on a -14 dBFS chug stem.
makeup = level * 1.30;

wet(x) = gated(x) : driven : tstack : cab : *(makeup) : fi.dcblocker;

process = _ <: _, wet : si.interpolate(mix);
