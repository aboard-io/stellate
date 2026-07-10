// vp330 — Roland VP-330 Vocoder Plus, HUMAN VOICE section: the ghost-choir
// machine. A Solina-style DIVIDE-DOWN source (bright, faintly detuned saws at
// 8'/4' footage — paraphonic, flat organ envelope) pushed through a FIXED
// FORMANT FILTERBANK (four parallel resonbp at vowel-formant frequencies,
// morphing continuously dark 'oo/oh' -> open 'ah' on `vowel`), plus a
// BREATHINESS voice (highpassed noise summed into the same formant bank), all
// widened by the triple-LFO ENSEMBLE CHORUS (three phase-staggered modulated
// fractional delay lines, Solina dual-rate ~0.6/5.9 Hz sway) into a STEREO
// pair. Poly voice (gate/freq per note), unlike the fixed channel-vocoder
// `robot_choir` (which needs a speech input) and the single-formant `choir`.
//
// !! STEREO OUT (outputs=2) — the ONLY pitched voice that is not mono. The
//    ensemble is the whole point; a mono voice can't widen. Mono-sum-safe:
//    L and R share the center tap in-phase, so L+R never cancels. See the
//    integration notes in the handoff for wiring (press/live need a stereo
//    voice path, or sum L+R to mono and keep a narrower ensemble).
declare name "vp330";
import("stdfaust.lib");

freq    = hslider("freq", 220, 20, 4000, 0.01) : si.smoo;
gate    = button("gate");
// IDENTITY params — all smooth, morphable:
vowel   = hslider("vowel", 0.3, 0, 1, 0.001) : si.smoo;   // 0 dark 'oo/oh' .. 1 open 'ah'
breath  = hslider("breath", 0.15, 0, 1, 0.001) : si.smoo; // filtered-noise breath through formants
ensemble= hslider("ensemble", 0.6, 0, 1, 0.001) : si.smoo;// triple-LFO chorus depth + stereo width
detune  = hslider("detune", 0.4, 0, 1, 0.01);             // divide-down saw spread
cutoff  = hslider("cutoff", 4200, 300, 12000, 1) : si.smoo;// post lowpass (darkness / engine brightness map)
attack  = hslider("attack", 0.08, 0.005, 3, 0.001);       // flat paraphonic env
sustain = hslider("sustain", 0.9, 0, 1, 0.01);
release = hslider("release", 0.6, 0.02, 5, 0.005);
level   = hslider("level", 0.5, 0, 1, 0.01);
gain    = hslider("gain", 1, 0, 2, 0.01);

// ---- DIVIDE-DOWN SOURCE: two faintly detuned saws at 8' + a 4' octave ----
det = 0.0025 + detune * 0.004;
s8  = (os.sawtooth(freq * (1.0 - det)) + os.sawtooth(freq * (1.0 + det))) * 0.5;
s4  = os.sawtooth(freq * 2.0) * 0.3;
saws = s8 + s4;

// ---- BREATHINESS: airy highpassed noise, summed into the same formants ----
brth = no.noise : fi.highpass(1, 700);
exc  = saws + brth * breath * 1.5;

// ---- FORMANT FILTERBANK: dark 'oo/oh' (vowel=0) -> open 'ah' (vowel=1) ----
f1 = 350.0  + vowel * (720.0  - 350.0);
f2 = 620.0  + vowel * (1160.0 - 620.0);
f3 = 2500.0 + vowel * (2680.0 - 2500.0);
f4 = 3150.0;
g1 = 1.0;
g2 = 0.55 - vowel * 0.10;
g3 = 0.16;
g4 = 0.08;
formants(x) = x <: fi.resonbp(f1, 10.0, g1),
                   fi.resonbp(f2, 11.0, g2),
                   fi.resonbp(f3, 16.0, g3),
                   fi.resonbp(f4, 18.0, g4) :> _;

// flat, organ-like paraphonic loudness contour (short decay, high sustain)
env  = en.adsr(attack, 0.3, sustain, release, gate);

// fenv* = SYNTHESIS-DEPTH unified filter envelope (2026-07);
// fenvAmount 0 is a bit-exact bypass (absent-law). Applies to the POST cutoff
// lowpass only, NOT the formant resonbp centers (those are the voice's identity).
fenvAmount = hslider("fenvAmount", 0, -4, 4, 0.01);       // cutoff env depth, OCTAVES (signed; 0 = off, bit-exact)
fenvAttack = hslider("fenvAttack", 0.005, 0.001, 2, 0.001);
fenvDecay  = hslider("fenvDecay", 0.18, 0.01, 3, 0.005);
fenvC   = en.adsr(fenvAttack, fenvDecay, 0, fenvDecay, gate);   // AD contour (sustain 0), note-on triggered
fenvMul = exp(0.6931472 * fenvAmount * fenvC);                  // 2^(amt*contour); amt 0 -> exactly 1.0

body = formants(exc) * 0.85 : fi.lowpass(2, max(30.0, min(cutoff*fenvMul, 16000.0))) : *(env * level * gain);

// ---- TRIPLE-LFO ENSEMBLE CHORUS -> STEREO ----
// three phase-staggered dual-rate (0.6 Hz + 5.9 Hz) LFOs, Solina BBD sway
lfo(fr, phase) = sin(2.0 * ma.PI * (os.lf_sawpos(fr) + phase));
modMs(phase)   = 9.0 + (0.4 + ensemble * 3.6)
                       * (lfo(0.6, phase) * 0.7 + lfo(5.9, phase + 0.17) * 0.3);
tap(phase, sig) = sig : de.fdelay(2048, modMs(phase) * ma.SR / 1000.0);

t1 = tap(0.000, body);
t2 = tap(0.333, body);   // shared CENTER tap (keeps the mono sum in phase)
t3 = tap(0.667, body);
wetL = t1 * 0.6 + t2 * 0.4;
wetR = t3 * 0.6 + t2 * 0.4;
wet  = 0.3 + ensemble * 0.6;             // dry->wet grows with ensemble (narrow->wide)
outL = body * (1.0 - wet) + wetL * wet;
outR = body * (1.0 - wet) + wetR * wet;

process = outL, outR;
