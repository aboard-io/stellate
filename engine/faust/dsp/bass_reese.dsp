// bass_reese — imitation of csd-engine.js bassSource "reese":
//   two saws at ipch*0.994 / ipch*1.006, *0.5 -> butlp cutoff -> tanh(*1.7)*0.85
declare name "bass_reese";
import("stdfaust.lib");

freq   = hslider("freq", 55, 20, 500, 0.01) : si.smoo;
gate   = button("gate");
cutoff = hslider("cutoff", 500, 60, 6000, 1) : si.smoo;
level  = hslider("level", 1, 0, 2, 0.01);
gain   = hslider("gain", 0.35, 0, 2, 0.01);

env = en.adsr(0.012, 0.4, 0.5, 0.10, gate);
two = (os.sawtooth(freq*0.994) + os.sawtooth(freq*1.006)) * 0.5;

process = two : fi.lowpass(2, cutoff) : *(1.7) : ma.tanh : *(0.85*env*level*gain);
