// insert_fenv — per-voice INSERT effect (inserts contract, type "fenv"): a
// note-triggered FILTER ENVELOPE for voices that have no synth filter to
// envelope — the SAMPLED basses/keys squelch (SYNTHESIS-DEPTH Part B). An
// insert has no gate, so the "note-on" is recovered from the signal itself:
// an amp follower with a pluck-fast attack (`attack`) and a musical release
// (`decay`) rides each onset, and its contour sweeps a resonant ladder
// (ve.moog_vcf_2bn — the one blessed ladder, VOICES.md) around `base` Hz by
// `amount` OCTAVES (SIGNED: positive = classic open-then-close squelch,
// negative = reverse squelch — the filter ducks on each hit and blooms as it
// decays). `sens` scales how hard program level pushes the contour (the wah
// precedent: min(1, 3*sens*env)).
//
// cutoff = base * 2^(amount * contour), clamped [30, 0.45*SR].
// mix 0 is a bit-exact bypass (unity dry path, insert-chain law); the wet
// path ends in a DC blocker (a resonant ladder ringing near self-oscillation
// can wander). Mono in -> mono out.
declare name "insert_fenv";
import("stdfaust.lib");

sens   = hslider("sens",   0.6,  0,     1,    0.001) : si.smoo;
amount = hslider("amount", 2,   -4,     4,    0.01)  : si.smoo;
attack = hslider("attack", 0.004, 0.001, 0.5, 0.001);
decay  = hslider("decay",  0.18, 0.02,  2,    0.005);
base   = hslider("base",   400,  60,    12000, 1)    : si.smoo;
res    = hslider("res",    0.5,  0,     0.95, 0.01);
mix    = hslider("mix",    1,    0,     1,    0.001) : si.smoo;

env(x)  = min(1.0, 3.0 * sens * an.amp_follower_ar(attack, decay, x));
// 2^(amount*env) via exp(ln2 * ...) — the modeld octave idiom
kcut(x) = max(30.0, min(base * exp(0.6931472 * amount * env(x)), 0.45 * ma.SR));
wet(x)  = ve.moog_vcf_2bn(res, kcut(x), x) : fi.dcblocker;

process = _ <: _, wet : si.interpolate(mix);
