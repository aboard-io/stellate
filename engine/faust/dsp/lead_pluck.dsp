// lead_pluck — imitation of csd-engine.js leadSource "pluck":
//   asig pluck 1, kf, ipch, 0, 1  (Karplus-Strong, simple averaging decay)
//   -> butlp cutoff
// Hand-rolled KS: 4ms noise burst into a lowpassed feedback comb.
declare name "lead_pluck";
import("stdfaust.lib");

freq   = hslider("freq", 440, 40, 4000, 0.01);
gate   = button("gate");
cutoff = hslider("cutoff", 3000, 200, 14000, 1) : si.smoo;
res    = hslider("res", 0.05, 0, 0.95, 0.01);    // instr 4 post-moogladder res
damp   = hslider("damp", 2000, 500, 12000, 1);   // KS loop brightness
release= hslider("release", 0.15, 0.01, 3, 0.005);
fenv   = hslider("fenv", 0, 0, 3, 0.01);         // per-note filter zap on the moog stage
level  = hslider("level", 0.5, 0, 1, 0.01);
gain   = hslider("gain", 0.5, 0, 2, 0.01);

dec(tau) = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(tau)));
burst = no.noise * dec(0.004) : fi.lowpass(2, 3500);   // pre-darkened excitation
dl    = max(2, ma.SR/max(freq, 40) - 1.5);
ks(x) = (+(x) : de.fdelay4(4096, dl)) ~ (fi.lowpass(1, damp) : *(0.995));

env = en.asr(0.001, 1, release, gate);   // note-off just shortens the ring

// fenv* = SYNTHESIS-DEPTH unified filter envelope (2026-07);
// fenvAmount 0 is a bit-exact bypass (absent-law); it multiplies IN ADDITION to
// the legacy `fenv` zap, inside the existing kcut clamp on the moog stage.
fenvAmount = hslider("fenvAmount", 0, -4, 4, 0.01);       // cutoff env depth, OCTAVES (signed; 0 = off, bit-exact)
fenvAttack = hslider("fenvAttack", 0.005, 0.001, 2, 0.001);
fenvDecay  = hslider("fenvDecay", 0.18, 0.01, 3, 0.005);
fenvC   = en.adsr(fenvAttack, fenvDecay, 0, fenvDecay, gate);   // AD contour (sustain 0), note-on triggered
fenvMul = exp(0.6931472 * fenvAmount * fenvC);                  // 2^(amt*contour); amt 0 -> exactly 1.0

// per-recipe fenv sweeps the instr-4 moogladder (settle ~ (typ. atk 0.005..0.05)+0.06)
fdec = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(0.022)));
kcut = max(30, min(cutoff*(1 + fenv*fdec)*fenvMul, 16000));

// butlp(cutoff) inside the csound source + instr 4's moogladder(cutoff,res)
process = burst : ks : fi.lowpass(2, cutoff) : ve.moog_vcf_2bn(res, kcut)
        : *(env*level*gain*1.5);
