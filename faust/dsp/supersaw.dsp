// supersaw — imitation of csd-engine.js melodyStack() with voices>=3:
//   N detuned vco2 saws, det = 1 + spread*((2i/(N-1))-1), summed *0.95/N
//   + quiet sine octave double (the "bell" sheen, octave=0.12)
//   -> moogladder cutoff/res  (per-note fenv handled by sweeping cutoff live)
//   env: linsegr 0, atk, 1, 0.06, sus, rel, 0   (the "plucky" branch)
// voices fixed at 7 at compile time; detune/cutoff/res are LIVE params —
// the whole point: timbre glides are setParamValue, not orchestra recompiles.
declare name "supersaw";
import("stdfaust.lib");

freq   = hslider("freq", 440, 20, 8000, 0.01) : si.smoo;
gate   = button("gate");
cutoff = hslider("cutoff", 2600, 80, 18000, 1) : si.smoo;
res    = hslider("res", 0.2, 0, 0.95, 0.01);
detune = hslider("detune", 0.012, 0, 0.05, 0.0001);
level  = hslider("level", 0.5, 0, 1, 0.01);

N = 7;
det(i) = 1 + detune*((2*float(i)/(N-1)) - 1);
saws = par(i, N, os.sawtooth(freq*det(i))) :> *(0.95/N);
oct  = os.osc(freq*2) * 0.12;

// csound: aenv linsegr 0, atk, 1, 0.06, 0.85, rel, 0  (atk=0.01, rel=0.30)
env = en.adsr(0.01, 0.06, 0.85, 0.30, gate);

// csound moogladder res 0..1 -> Q; ve.moogLadder takes normalized freq + Q
q  = 0.707 + res*7;
nf = min(cutoff/(ma.SR/2.0), 0.49);

process = (saws + oct) : ve.moogLadder(nf, q) : *(env*level);
