// fm2op — parameterized 2-op FM covering csd-engine.js "fm" pad AND "fm" lead:
//   pad : kidx linsegr 2.6, 1.1, 0.9, ...  ratio 2.001, lp min(8000,cutoff*1.7)
//   lead: kidx linsegr 3.5, p3*0.5, 1.0    ratio 1.4,   lp cutoff
// Set (ratio, idx0, idx1, idxTime) per recipe; rhodes-style EPs go to the
// DX7 E.PIANO 1 patch instead (see VOICES.md).
declare name "fm2op";
import("stdfaust.lib");

freq    = hslider("freq", 220, 20, 4000, 0.01) : si.smoo;
gate    = button("gate");
cutoff  = hslider("cutoff", 3000, 200, 14000, 1) : si.smoo;
ratio   = hslider("ratio", 2.001, 0.25, 8, 0.001);
idx0    = hslider("idx0", 2.6, 0, 8, 0.01);       // index at note start
idx1    = hslider("idx1", 0.9, 0, 8, 0.01);       // settled index
idxTime = hslider("idxTime", 1.1, 0.01, 4, 0.01);
attack  = hslider("attack", 0.05, 0.001, 5, 0.005);
decay   = hslider("decay", 0.5, 0.01, 2, 0.005);  // plucky recipes use the csound fixed 0.06
sustain = hslider("sustain", 0.85, 0, 1, 0.01);
release = hslider("release", 0.3, 0.01, 3, 0.005);
fenv    = hslider("fenv", 0, 0, 3, 0.01);         // per-note filter zap: cutoff*(1+fenv) -> cutoff
vib     = hslider("vibrato", 0, 0, 0.03, 0.0001);
vibRate = hslider("vibRate", 5.2, 0.1, 12, 0.01);
level   = hslider("level", 0.5, 0, 1, 0.01);
gain    = hslider("gain", 0.3, 0, 2, 0.01);

dec(tau) = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(max(tau, 0.0005))));

kf   = freq * (1 + vib*os.osc(vibRate));
kidx = idx1 + (idx0 - idx1)*dec(idxTime/3);   // linsegr settles AT idxTime
mod  = os.osc(kf*ratio) * kidx * kf;
car  = os.osc(kf + mod);

env = en.adsr(attack, decay, sustain, release, gate);

// filter env settles AT attack+0.06 (csound: kcf expseg cutoff*(1+fenv), atk+0.06, cutoff)
fdec = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(max((attack + 0.06)/3, 0.003))));
kcut = max(30, min(cutoff*(1 + fenv*fdec), 16000));

process = car : fi.lowpass(2, kcut) : *(env*level*gain);
