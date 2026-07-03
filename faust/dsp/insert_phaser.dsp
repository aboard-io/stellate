// insert_phaser — per-voice INSERT effect (inserts contract, type "phaser").
// Hand-rolled 4-stage first-order allpass phaser (identical stages -> 2 deep
// notches, the classic small-phaser sound) with feedback, LFO'd exponentially
// between 180 Hz and 3.2 kHz. depth = LFO sweep width, mix = dry/wet
// (mix 0 = unity bypass). Mono in -> mono out.
declare name "insert_phaser";
import("stdfaust.lib");

rate  = hslider("rate",  0.5, 0.01, 8, 0.001) : si.smoo;
depth = hslider("depth", 0.7, 0,    1, 0.001) : si.smoo;
mix   = hslider("mix",   0.7, 0,    1, 0.001) : si.smoo;

fmin = 180; fmax = 3200; fb = 0.5;

// sweep exponent centered geometrically, width scaled by depth
e  = 0.5 * (1 + depth * os.osc(rate));
fc = fmin * pow(fmax/fmin, e);

// first-order allpass, coefficient from bilinear tan warp (shared by 4 stages)
t = tan(ma.PI * min(fc, 0.45*ma.SR) / ma.SR);
c = (t - 1) / (t + 1);
ap = fi.tf1(c, 1, c);
chain = seq(i, 4, ap);

phased(x) = 0.5 * (x + w)
with { w = (x + fb*_) ~ chain; };

process = _ <: _, phased : si.interpolate(mix);
