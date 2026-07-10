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

str = pm.guitar(pm.f2l(freq), pluckPos, 0.6, gate);

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
