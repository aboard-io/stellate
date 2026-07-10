// supersaw — the "stack" lead of csd-engine.js melodyStack(), now covering the
// WHOLE recipe surface: runtime voices (1..7), spread, wave (sine/saw/square/
// pulse), sine-octave double (the bell sheen), vibrato, attack/release.
//   det(i) = 1 + spread*((2i/(v-1))-1), summed *0.95/v, + octave sine
//   -> moogladder(cutoff, res); env = linsegr atk / 0.06 / sus / rel
// voices<=2 in csound uses {kf, kf*(1+sp)} — here symmetric ±sp (center off by
// sp/2 ≈ a few cents at recipe spreads; inaudible, noted in VOICES.md).
declare name "supersaw";
import("stdfaust.lib");

freq   = hslider("freq", 440, 20, 8000, 0.01) : si.smoo;
gate   = button("gate");
cutoff = hslider("cutoff", 2600, 80, 18000, 1) : si.smoo;
res    = hslider("res", 0.2, 0, 0.95, 0.01);
detune = hslider("detune", 0.012, 0, 0.05, 0.0001);   // = recipe spread
voices = hslider("voices", 7, 1, 7, 1);
wave   = hslider("wave", 1, 0, 3, 1);                 // 0 sine 1 saw 2 square 3 pulse
octave = hslider("octave", 0.12, 0, 0.4, 0.001);
vib    = hslider("vibrato", 0, 0, 0.03, 0.0001);
vibRate= hslider("vibRate", 5.2, 0.1, 12, 0.01);
attack = hslider("attack", 0.01, 0.001, 2, 0.001);
sustain= hslider("sustain", 0.85, 0, 1, 0.01);
release= hslider("release", 0.30, 0.01, 3, 0.005);
fenv   = hslider("fenv", 0, 0, 3, 0.01);              // per-note filter zap: cutoff*(1+fenv) -> cutoff
level  = hslider("level", 0.5, 0, 1, 0.01);
gain   = hslider("gain", 1, 0, 2, 0.01);

kf = freq * (1 + vib*os.osc(vibRate));

oscw(f) = select2(wave >= 2,
            select2(wave >= 1, os.osc(f), os.sawtooth(f)),
            select2(wave >= 3, os.square(f), pulse(f)))
with { pulse(ff) = (os.lf_sawpos(ff) < 0.22)*2.0 - 1.0; };

N = 7;
den    = max(1.0, voices - 1);
det(i) = 1 + detune*((2.0*float(i)/den) - 1);
on(i)  = float(i) < voices;
stack  = sum(i, N, oscw(kf*det(i)) * on(i)) * (0.95/max(1.0, voices));
oct    = os.osc(kf*2) * octave;

env = en.adsr(attack, 0.06, sustain, release, gate);

// fenv* = SYNTHESIS-DEPTH unified filter envelope (2026-07);
// fenvAmount 0 is a bit-exact bypass (absent-law); it multiplies IN ADDITION to
// the legacy `fenv` zap, inside the existing kcut clamp on the moog cutoff path.
fenvAmount = hslider("fenvAmount", 0, -4, 4, 0.01);       // cutoff env depth, OCTAVES (signed; 0 = off, bit-exact)
fenvAttack = hslider("fenvAttack", 0.005, 0.001, 2, 0.001);
fenvDecay  = hslider("fenvDecay", 0.18, 0.01, 3, 0.005);
fenvC   = en.adsr(fenvAttack, fenvDecay, 0, fenvDecay, gate);   // AD contour (sustain 0), note-on triggered
fenvMul = exp(0.6931472 * fenvAmount * fenvC);                  // 2^(amt*contour); amt 0 -> exactly 1.0

// csound plucky filter env: kcf expseg cutoff*(1+fenv), attack+0.06, cutoff —
// note-on exponential settling AT attack+0.06 (tau = T/3 like the other ports)
fdec = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(max((attack + 0.06)/3, 0.003))));
kcut = max(30, min(cutoff*(1 + fenv*fdec)*fenvMul, 16000));

process = (stack + oct) : ve.moog_vcf_2bn(res, kcut) : *(env*level*gain);
