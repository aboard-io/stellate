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

process = str : fi.lowpass(2, cutoff) : *(env*level*gain*8);   // waveguide runs ~12dB under the sf2 samples
