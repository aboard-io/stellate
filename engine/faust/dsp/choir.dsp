// choir — imitation of csd-engine.js choirSource (fof formant "ah" choir):
//   fundamental at kf*0.5 with 4.7 Hz vibrato (0.7% depth)
//   formants 800/1150/2800 Hz, gains 0.5/0.35/0.18, *0.85 -> butlp cutoff
// fof grains -> here a saw glottal source through a resonbp formant bank
// (same spectral envelope, cheaper and worklet-safe).
declare name "choir";
import("stdfaust.lib");

freq   = hslider("freq", 220, 20, 4000, 0.01) : si.smoo;
gate   = button("gate");
cutoff = hslider("cutoff", 3000, 200, 12000, 1) : si.smoo;   // engine maps min(8-9k, cutoff*2.5)
attack = hslider("attack", 0.8, 0.005, 5, 0.005);
level  = hslider("level", 0.5, 0, 1, 0.01);
gain   = hslider("gain", 0.25, 0, 2, 0.01);

kvib = 1 + 0.007*os.osc(4.7);
f0   = freq * 0.5 * kvib;                 // csound sings an octave below written
src  = os.sawtooth(f0);

frm = src <: fi.resonbp(800, 13.3, 1)*0.5, fi.resonbp(1150, 12.8, 1)*0.35,
             fi.resonbp(2800, 23.3, 1)*0.18 :> _;

env = en.adsr(attack, 1.5, 0.8, 2.5, gate);

// fenv* = SYNTHESIS-DEPTH unified filter envelope (2026-07);
// fenvAmount 0 is a bit-exact bypass (absent-law).
fenvAmount = hslider("fenvAmount", 0, -4, 4, 0.01);       // cutoff env depth, OCTAVES (signed; 0 = off, bit-exact)
fenvAttack = hslider("fenvAttack", 0.005, 0.001, 2, 0.001);
fenvDecay  = hslider("fenvDecay", 0.18, 0.01, 3, 0.005);
fenvC   = en.adsr(fenvAttack, fenvDecay, 0, fenvDecay, gate);   // AD contour (sustain 0), note-on triggered
fenvMul = exp(0.6931472 * fenvAmount * fenvC);                  // 2^(amt*contour); amt 0 -> exactly 1.0

process = frm*0.85 : fi.lowpass(2, max(30.0, min(cutoff*fenvMul, 16000.0))) : *(env*level*gain);
