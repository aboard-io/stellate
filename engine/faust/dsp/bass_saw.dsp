// bass_saw — imitation of csd-engine.js instr 2 default bass:
//   a1 vco2 saw -> moogladder(cutoff, res)
//   env: linsegr 0, 0.012, iamp, p3-0.05, iamp*0.5, 0.10, 0
declare name "bass_saw";
import("stdfaust.lib");

freq   = hslider("freq", 65, 20, 500, 0.01) : si.smoo;
gate   = button("gate");
cutoff = hslider("cutoff", 700, 60, 6000, 1) : si.smoo;
res    = hslider("res", 0.15, 0, 0.95, 0.01);
release= hslider("release", 0.10, 0.01, 3, 0.005);
fenv   = hslider("fenv", 0, 0, 4, 0.01);   // per-recipe filter zap: cutoff*(1+fenv) -> cutoff
level  = hslider("level", 1, 0, 2, 0.01);
gain   = hslider("gain", 0.35, 0, 2, 0.01);

env  = en.adsr(0.012, 0.4, 0.5, release, gate);
fdec = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(0.024)));   // settles AT ~0.012+0.06
kcut = max(30, min(cutoff*(1 + fenv*fdec), 16000));
// ve.moogLadder in the bundled faustlibraries is broken (see VOICES.md);
// moog_vcf_2bn takes Hz + res 0..1 — the exact csound moogladder semantics
process = os.sawtooth(freq) : ve.moog_vcf_2bn(res, kcut) : *(env*level*gain);
