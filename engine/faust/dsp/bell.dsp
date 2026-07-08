// bell — imitation of csd-engine.js bellSource (inharmonic FM bell):
//   kidx transeg 4 -> 0.3 over p3 (-4 convex)
//   amod oscili kidx*kf, kf*3.53 ; asig oscili 1, kf+amod
//   kdec transeg 1 -> 0.04 (-5) ; -> butlp cutoff
// (DX7 TUB BELLS on alg 5 is the documented substitution when a genre wants
// the real Lately Bass-era metal — see VOICES.md.)
declare name "bell";
import("stdfaust.lib");

freq   = hslider("freq", 440, 20, 4000, 0.01) : si.smoo;
gate   = button("gate");
cutoff = hslider("cutoff", 6000, 200, 14000, 1) : si.smoo;
res    = hslider("res", 0.05, 0, 0.95, 0.01);   // instr 4 post-moogladder res
decay  = hslider("decay", 1.4, 0.1, 6, 0.01);
level  = hslider("level", 0.5, 0, 1, 0.01);
gain   = hslider("gain", 0.3, 0, 2, 0.01);

dec(tau) = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(max(tau, 0.0005))));

kidx = 0.3 + 3.7*dec(decay/4);         // transeg -4 ~ tau p3/4 (decay = note dur)
mod  = os.osc(freq*3.53) * kidx * freq;
car  = os.osc(freq + mod);

kdec = dec(decay/5);                   // transeg -5 ~ tau p3/5
env  = en.adsr(0.005, 0.06, 0.85, 0.3, gate);      // outer note env

// csound leads run bellSource's butlp AND instr 4's moogladder — both here
process = car * kdec : fi.lowpass(2, min(cutoff*2.5, 10000)) : ve.moog_vcf_2bn(res, max(30, min(cutoff, 16000)))
        : *(env*level*gain);
