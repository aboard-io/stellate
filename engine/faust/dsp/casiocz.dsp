// casiocz — Casio CZ phase-distortion voice (poly keys / lead).
//   Phase distortion (PD): a 0..1 phase RAMP (os.lf_sawpos, the CZ "fund"
//   input) is warped by a distortion INDEX before the wave lookup, morphing a
//   soft glassy tone into a bright buzzy one. IDENTITY = the DCW envelope: an
//   ADSR on that distortion index (Casio's Digitally-Controlled-Waveform
//   contour) so every note sweeps glassy->buzzy (or the reverse) on its own.
//   `wave` continuously morphs across the CZ index-family oscillators
//   (halfSine -> sinePulse -> saw -> square -> pulse), a smooth timbre axis.
//   A gentle two-oscillator detune fattens it for keys/lead; a post lowpass
//   (`cutoff`) tames the buzzy end for mallsoft. Poly (chord-capable) — 1
//   mono output like every pooled voice; the engine places it in the stereo
//   field. Target genres: electro, phonk, chiptune, mallsoft.
declare name "casiocz";
import("stdfaust.lib");

freq    = hslider("freq", 220, 20, 4000, 0.01) : gsmooth;
// GLIDE — portamento, MILLISECONDS, and it is a TAKEOVER of a slew this module
// already had rather than a new one. `freq` has always run through `si.smoo` =
// si.smooth(0.999): a FIXED pole, ~21 ms tau, ~96 ms to settle within 1% at
// 48 kHz. So every reused pool voice in this fleet has been sliding into its
// next note all along, at a time nobody could name, turn down or turn up — the
// pitch bend you can hear on a fast synth line. This names it, and the three
// readings are chosen so the bottom of the slider is not a lie:
//   glide == 0   the module's OWN smoother, the 0.999 pole, untouched. A state
//                that never writes the key renders BIT-IDENTICAL to before —
//                that is why this is a select2 over two whole smoothers and
//                not one smoother with a computed pole: a signal-rate 0.999f
//                is NOT the constant-folded 0.999, and the saw phasors drift
//                (measured: max |diff| 1.3e-3 across a 0.9 s render).
//   glide == 1   a SNAP. tau 0.2 ms, settled inside a millisecond — the one
//                thing this fleet could never do, since si.smoo was mandatory.
//   glide  > 2   the named portamento: tau = glide/4.6, landing within 1% at
//                ~glide ms, exactly the contract modeld and synclead keep.
glide  = hslider("glide", 0, 0, 500, 1);
glPole = ba.tau2pole(max(glide * 0.001 / 4.6, 0.0000001));
gsmooth(x) = select2(glide > 0, x : si.smoo, x : si.smooth(glPole));
gate    = button("gate");

// --- morphable identity params ---
wave    = hslider("wave", 0.5, 0, 1, 0.001) : si.smoo;   // halfSine..sinePulse..saw..square..pulse
index   = hslider("index", 0.25, 0, 1, 0.001) : si.smoo; // base DCW distortion index
dcwAmount = hslider("dcwAmount", 0.6, 0, 1, 0.001);      // DCW env depth added to index
detune  = hslider("detune", 4, 0, 40, 0.1);              // 2-osc spread, CENTS
cutoff  = hslider("cutoff", 12000, 200, 16000, 1) : si.smoo; // post tone lowpass

// --- DCW (distortion-index) envelope: the CZ signature contour ---
dcwAttack  = hslider("dcwAttack", 0.005, 0.001, 2, 0.001);
dcwDecay   = hslider("dcwDecay", 0.35, 0.005, 3, 0.001);
dcwSustain = hslider("dcwSustain", 0.35, 0, 1, 0.01);

// --- amplitude envelope (house ADSR) ---
attack  = hslider("attack", 0.005, 0.001, 3, 0.001);
decay   = hslider("decay", 0.12, 0.005, 3, 0.001);
sustain = hslider("sustain", 0.85, 0, 1, 0.01);
release = hslider("release", 0.3, 0.005, 4, 0.001);

level   = hslider("level", 0.4, 0, 1, 0.01);   // recipe level
gain    = hslider("gain", 1, 0, 2, 0.01);      // per-note velocity

// effective distortion index = base + DCW env, clamped to the CZ 0..1 domain
dcwEnv = en.adsr(dcwAttack, dcwDecay, dcwSustain, release, gate);
idx    = max(0.0, min(1.0, index + dcwAmount * dcwEnv));

// continuous crossfade across the CZ index-family oscillators (triangular
// weights over positions 0..4 = halfSine..sinePulse..saw..square..pulse); all
// share ONE phase ramp per oscillator line (the CZ "fund" input)
czmix(f) = os.CZhalfSine(fnd, idx)  * w(0)
         + os.CZsinePulse(fnd, idx) * w(1)
         + os.CZsaw(fnd, idx)       * w(2)
         + os.CZsquare(fnd, idx)    * w(3)
         + os.CZpulse(fnd, idx)     * w(4)
    with {
        fnd = os.lf_sawpos(f);          // 0..1 phase ramp = CZ fund
        s   = wave * 4.0;
        w(i) = max(0.0, 1.0 - abs(s - i));
    };

// two detuned oscillator lines for keys/lead width (CZ's dual DCO)
dc  = detune * 0.0005778;               // cents -> +/- ratio (small-angle)
sig = (czmix(freq * (1.0 - dc)) + czmix(freq * (1.0 + dc))) * 0.5;

env = en.adsr(attack, decay, sustain, release, gate);

// fenv* = SYNTHESIS-DEPTH unified filter envelope (2026-07);
// fenvAmount 0 is a bit-exact bypass (absent-law). Envelopes the POST tone
// lowpass only; the DCW contour (dcw*) is the voice's identity and is untouched.
fenvAmount = hslider("fenvAmount", 0, -4, 4, 0.01);       // cutoff env depth, OCTAVES (signed; 0 = off, bit-exact)
fenvAttack = hslider("fenvAttack", 0.005, 0.001, 2, 0.001);
fenvDecay  = hslider("fenvDecay", 0.18, 0.01, 3, 0.005);
fenvC   = en.adsr(fenvAttack, fenvDecay, 0, fenvDecay, gate);   // AD contour (sustain 0), note-on triggered
fenvMul = exp(0.6931472 * fenvAmount * fenvC);                  // 2^(amt*contour); amt 0 -> exactly 1.0

process = sig : fi.lowpass(2, max(30.0, min(cutoff*fenvMul, 16000.0))) : *(env * level * gain);
