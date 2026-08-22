// lead_kpluck — imitation of csd-engine.js "kpluck" (instr-block Karplus-Strong
// guitar): dual detuned plucks + octave string (0.42), pick-noise bandpass
// burst, body resonators at 118/230 Hz, saturation, dual-vdelay chorus, and a
// slow flanger. The csound flanger evolves over absolute song time; here that
// position is the `flangePos` param (0..1) the engine can automate.
declare name "lead_kpluck";
import("stdfaust.lib");

freq      = hslider("freq", 330, 40, 4000, 0.01);
gate      = button("gate");
cutoff    = hslider("cutoff", 3000, 200, 14000, 1);
drive     = hslider("drive", 0, 0, 1, 0.01);
flangePos = hslider("flangePos", 0, 0, 1, 0.01);
level     = hslider("level", 0.5, 0, 1, 0.01);
gain      = hslider("gain", 0.5, 0, 2, 0.01);

dec(tau) = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(tau)));
// csound pluck's per-sample averaging kills HF almost immediately — darken the
// excitation AND the loop hard or the faust string reads 2 octaves brighter
burst = no.noise * dec(0.004) : fi.lowpass(2, 2800);

// THE LOOP WAS THREE SAMPLES TOO LONG — the same error lead_pluck.dsp carried,
// for the same reason, and fixed the same way. `SR/f - 1.5` pays for the one
// sample Faust's `~` puts in the feedback path and half a sample of guesswork,
// and pays nothing for the damping filter, which is not free: fi.lowpass(1,
// 2000) is filters.lib's bilinear one-pole, a pole at p = (c-1)/(c+1) with
// c = 1/tan(PI*2000/SR) plus a Nyquist zero worth half a sample, and its phase
// delay at the bottom of the range is 3.49 samples. So every string ran 2.99
// long, and a delay d samples too long is 1731*d/P cents flat with P = SR/f —
// an error that grows with the note.
//
// Measured on the shipped module (the estimator has three detuned strings, a
// chorus and a flanger to see through, so the low end is noisy and the middle
// is the honest read): MIDI 60 -11 c, 64 -38 c, 66 -44 c, 68 -48 c, 70 -56 c,
// 72 -63 c, 74 -78 c — implied d ~2.9-3.1 through that whole span.
//
// The compensation is computed per STRING at that string's own fundamental,
// which matters here in a way it does not in lead_pluck: `str` below sounds
// f, f*1.0013 and f*2 through this same function, and the octave string was
// running twice as many cents flat as the fundamental one. A pre-warp on
// `freq` could not have fixed that; subtracting each string's own filter delay
// does. Nothing about the damping or the detuning changes, only the lengths.
//
// Every argument is a slider expression, so Faust hoists the transcendentals
// into the block's control code. |p| < 1 always, so 1 - p*cos(w) never reaches
// zero and plain `atan` needs no quadrant.
lpPole(fc) = (c - 1.0)/(c + 1.0) with { c = 1.0/tan(ma.PI*fc/ma.SR); };
lpDelay(fc, f0) = 0.5 + atan(p*sin(w)/(1.0 - p*cos(w)))/w
  with { p = lpPole(fc); w = 2.0*ma.PI*f0/ma.SR; };
ks(f) = (+(burst) : de.fdelay4(4096, max(2, ma.SR/fq - 1.0 - lpDelay(2000, fq))))
        ~ (fi.lowpass(1, 2000) : *(0.996))
  with { fq = max(f, 40); };

// csound: pluck(1) + pluck(0.5)*0.5 + octave pluck(0.34)*0.42 -> 1 / 0.25 / 0.14
str = ks(freq) + ks(freq*1.0013)*0.25 + ks(freq*2)*0.14;

// csound pick rides at fixed 0.42 abs against unit-amp plucks; our waveguides
// run ~3x quieter (hence the *3.2 output trim), so the pick scales down with them
pick = no.noise*0.6 : fi.resonbp(min(8000, cutoff*1.6), 2.7, 1) : *(dec(0.001)*0.22);

raw  = str + pick;
body = raw*0.7 + fi.resonbp(118, 1.475, 1, raw)*0.45 + fi.resonbp(230, 1.64, 1, raw)*0.3;
sat  = body : fi.lowpass(2, min(12000, cutoff*2.4)) : *(2.4 + drive*3.2) : ma.tanh : *(0.72);

// dual chorus: 11ms + 2.6ms@0.7Hz, 13ms + 2.2ms@1.1Hz
ms = ma.SR/1000.0;
ch = sat <: *(0.66),
     de.fdelay(4096, (11 + 2.6*os.osc(0.7))*ms)*0.34,
     de.fdelay(4096, (13 + 2.2*os.osc(1.1))*ms)*0.34 :> _;

// flanger: rate/depth/feedback grow with flangePos (csound ktm/164 ramp)
kfr  = 0.12 + flangePos*0.9;
kdp  = 0.3 + flangePos*0.65;
dflt = (0.0006 + 0.003*kdp*(os.osc(kfr)*0.5 + 0.5)) * ma.SR;
flg(x) = x*0.5 + (x : (+ : de.fdelay(4096, dflt)) ~ *(0.02))*0.62;

env = en.adsr(0.002, 0.4, 0.55, 0.05, gate);

// *2.8: the csound version's body resonators + chorus/flanger unity paths run
// hotter than this waveguide sum (A/B measured ~9 dB)
process = ch : flg : *(env*level*gain*3.6);
