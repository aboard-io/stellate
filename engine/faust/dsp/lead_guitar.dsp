// lead_guitar — replaces csd-engine.js "guitar" (sfplay GM soundfont, CLI-only)
// with a pm.lib physical string: this is the SUBSTITUTION path, not a port —
// the csound version literally played TimGM6mb.sf2 samples, which don't ship
// to the browser. pm.guitar = nut/bridge waveguide with body coupling.
declare name "lead_guitar";
import("stdfaust.lib");

freq   = hslider("freq", 330, 40, 2000, 0.01);
gate   = button("gate");
cutoff = hslider("cutoff", 4500, 200, 14000, 1) : si.smoo;
pluckPos = hslider("pluckPos", 0.85, 0.02, 0.98, 0.01);
level  = hslider("level", 0.5, 0, 1, 0.01);
gain   = hslider("gain", 0.5, 0, 2, 0.01);

// THE STRING IS A SAMPLE AND A BIT TOO LONG, AND HERE THAT MUST BE PAID FOR
// FROM OUTSIDE. pm.guitar is a waveguide like every other string in this
// engine, so it carries the same fault: the loop is the delay line PLUS the
// nut and bridge filters' own phase delay, and the model sizes the line from
// the length alone. Measured on the shipped module, MIDI 36..84 in whole
// tones, the implied excess is 1.134 samples at the bottom and 1.120 at the
// top — mean 1.1296, sd 0.0041, i.e. A CONSTANT, which is exactly what an
// uncompensated filter delay looks like. A delay d samples too long is
// 1731*d/P cents flat and P is SR/f, so the error tracks the note: -3 c at
// MIDI 36, -12 c at 60, -23 c at 72, -37 c at 80, -46 c at 84.
//
// lead_pluck.dsp and lead_kpluck.dsp got the structural repair — their loop
// filter is written here, so its phase delay can be computed and subtracted
// from the line. This one's loop is inside pm.lib and there is no honest way
// to reach it without vendoring the model, so this is the gtr_amp/stk_piano
// answer instead: a pre-warp on the frequency handed in. It is not a fitted
// cents curve, though — because the error is a constant NUMBER OF SAMPLES the
// correction has a closed form and is exact. The model plays SR/(SR/f' + d);
// setting f' = f/(1 - d*f/SR) makes SR/f' = SR/f - d, so the total is SR/f and
// the note that comes out is f. One line, no fit, no residual.
//
// (The remaining 0.014-sample tilt across the range is the bridge filter's own
// phase-delay curve, and at MIDI 84 it is worth 0.3 cents. It is left alone.)
tuneExcess = 1.1296;   // samples, measured — see above
fw = freq/max(0.25, 1.0 - tuneExcess*freq/ma.SR);
str = pm.guitar(pm.f2l(fw), pluckPos, 0.6, gate);

env = en.asr(0.001, 1, 0.08, gate);

// fenv* = SYNTHESIS-DEPTH unified filter envelope (2026-07);
// fenvAmount 0 is a bit-exact bypass (absent-law). Envelopes the main cutoff
// lowpass on the waveguide output.
fenvAmount = hslider("fenvAmount", 0, -4, 4, 0.01);       // cutoff env depth, OCTAVES (signed; 0 = off, bit-exact)
fenvAttack = hslider("fenvAttack", 0.005, 0.001, 2, 0.001);
fenvDecay  = hslider("fenvDecay", 0.18, 0.01, 3, 0.005);
fenvC   = en.adsr(fenvAttack, fenvDecay, 0, fenvDecay, gate);   // AD contour (sustain 0), note-on triggered
fenvMul = exp(0.6931472 * fenvAmount * fenvC);                  // 2^(amt*contour); amt 0 -> exactly 1.0

process = str : fi.lowpass(2, max(30.0, min(cutoff*fenvMul, 16000.0))) : *(env*level*gain*8);   // waveguide runs ~12dB under the sf2 samples
