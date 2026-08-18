// stk_guitar — THE STRING IS THE TOOLKIT'S; THE AMPLIFIER IS OURS.
//
// gtr_amp beside this file is a hand-rolled waveguide, and measured at its own
// shipped settings it does not produce the note it is asked for: at MIDI 40 the
// fundamental is 34.6 dB below the loudest partial (which is the SEVENTH), and
// 0.0% of the spectrum's energy sits inside a semitone of 82 Hz. That is the
// "plinky" Paul named — a guitar with no low E in its low E. Its intonation is
// a fitted correction that still runs +37 cents sharp by MIDI 79, and its
// velocity moves the spectral centroid by a factor of 1.05, which is another
// way of saying velocity is a fader.
//
// The string here is the Extended Karplus-Strong from the FAUST Synthesis
// ToolKit (NLFeks.dsp, Julius Smith and Romain Michon, STK-4.3 licence) — the
// Faust companion to "Virtual Electric Guitars", which is what the algorithm
// was written to be. Measured on this repo's own compiler it is in tune to
// 0.0 CENTS at 82, 165, 330 and 659 Hz — not fitted, not corrected, exact,
// because a delay line of P-2 samples plus a LINEAR-PHASE damping filter has a
// loop delay you can write down rather than measure. That is the whole reason
// to take the toolkit's version over ours.
//
// WHAT WE PUT BACK. The published NLFeks has its own dynamic-level filter
// commented out (`// : levelfilter(L,freq)`), and without it the excitation is
// flat-spectrum noise: every harmonic gets the same energy, the fundamental
// lands 20 dB down and the note is bright and bodiless whatever you do to it.
// Smith's own note on the parameter says what it is for — "a lively clavier is
// obtained by tying L to gain (MIDI velocity)" — so it is restored here and
// tied to velocity, which is exactly the thing this lane exists to do. That one
// filter is the difference between a string and a spectrum.
//
// AND THE AMPLIFIER IS KEPT. gtr_amp's pickup, preamp and cabinet were A/B'd
// against the six sampled GM electric zones they stand in for — the coil's
// 3 kHz peak, the highpass that opens with the gain so a driven note does not
// fart, the post-drive mid scoop, the presence bump at 2.4 kHz, the output trim
// per drive setting. None of that was ever the broken half, and none of it is
// in the toolkit. So this module is the STK string wearing our amp.
//
// VELOCITY MEANS, PHYSICALLY: how bright the pluck is (`pick` -> the dynamic
// level L AND the pick-angle lowpass: a fingertip is a slow, round displacement
// and a hard triangle is a fast, sharp one) AND how hot the pickup drives the
// preamp (`gain`, on the INPUT side of the shaper). Both are real.
declare name "stk_guitar";
declare author "Julius Smith and Romain Michon (string); stellate (pickup, amp, cabinet)";
declare licence "STK-4.3"; // Synthesis ToolKit 4.3, MIT-style — see NOTICE
declare reference "https://ccrma.stanford.edu/~jos/pasp/vegf.html";
import("stdfaust.lib");
// instruments.lib IS NOT IMPORTED, and the reason is worth a line: it declares
// `levelfilter` and also imports the deprecated filter.lib, which declares it
// too, so any file that imports instruments.lib cannot NAME the one function
// this module needs — the compiler reports it defined in two places and stops.
// That is almost certainly why the published NLFeks has the call commented out
// rather than deleted. So the filter is written out below, from Smith's own
// page, which is a five-line definition and one citation rather than a fork.

freq   = hslider("freq", 220, 40, 2000, 0.01);
gate   = button("gate");
// glide: SECONDS to slide into the written pitch. A waveguide's pitch IS its
// delay length, so this is a real portamento — the string bends, it does not
// crossfade. 0 = arrive instantly (bit-exact: si.smooth's pole is 0).
glide  = hslider("glide", 0, 0, 0.5, 0.001);
pick   = hslider("pick", 0.5, 0, 1, 0.01);        // plectrum hardness (velocity)
pluckPos = hslider("pluckPos", 0.13, 0.02, 0.5, 0.01);   // where the pick lands
pickup = hslider("pickup", 0.28, 0.05, 0.5, 0.01);       // bridge 0.05 .. neck 0.5
// ring: the string's own -60 dB time in SECONDS, which is what a T60 is. This
// replaces gtr_amp's `damp` loop coefficient — 0.9998 is not a quantity anyone
// can reason about, and the EKS asks for the answer in the unit the ear uses.
// The bottom of the range is the palm mute.
ring   = hslider("ring", 4, 0.05, 12, 0.01);
bright = hslider("bright", 0.5, 0, 1, 0.01);      // the damping filter's tilt
drive  = hslider("drive", 0.18, 0, 1, 0.01);      // preamp gain
cutoff = hslider("cutoff", 5200, 200, 14000, 1) : si.smoo;   // the cab's cliff
level  = hslider("level", 0.5, 0, 1, 0.01);
gain   = hslider("gain", 0.3, 0, 2, 0.01);
release = hslider("release", 0.25, 0.02, 2, 0.005);

// ---- the string (faust-stk NLFeks) ---------------------------------------
sfreq = freq : si.smooth(ba.tau2pole(max(glide, 0.0001)));
Pmax  = 4096;                       // 40 Hz at 44.1k is 1102 samples
P     = ma.SR/max(40.0, sfreq);

// a white-noise burst one period long — the toolkit's own excitation, adapted
// there from Faust's karplus.dsp example
noiseburst(g, n) = no.noise : *(g : trigger(n))
  with {
    diffgtz(x) = (x - x') > 0;
    decay(m, x) = x - (x > 0)/m;
    release(m) = + ~ decay(m);
    trigger(m) = diffgtz : release(m) : > (0.0);
  };

// PICK ANGLE. si.smooth's pole IS the plectrum: a thumb drags the string aside
// slowly (a long, round displacement = a low corner) and a hard nylon triangle
// releases it in almost no time (a sharp one). So a soft pick is the HIGH pole.
pickPole = 0.88*(1.0 - pick);
// DYNAMIC LEVEL, in dB at Nyquist, which is the EKS's own way of asking "how
// hard". -42 dB is a fingertip; -6 dB is digging in. This is the filter the
// published NLFeks leaves commented out, and it is the one that puts the
// fundamental back: measured, restoring it moves the energy inside a semitone
// of an 82 Hz fundamental from 0.1% to a real body.
L = ba.db2linear(-42.0 + pick*36.0);
// pick position: a feedforward comb one pick-position down the string, so the
// harmonics with a node under the plectrum are missing. This is why a bridge
// pickup sounds like a bridge pickup and it costs one delay.
pickComb = fi.ffcombfilter(Pmax, pluckPos*P, -1);

// THE DYNAMIC LEVEL LOWPASS, verbatim in behaviour from Smith's derivation
// (ccrma.stanford.edu/realsimple/faust_strings/Dynamic_Level_Lowpass_Filter.html
// and instruments.lib `levelfilter`): a crossfade between the raw excitation
// and a one-pole lowpass cornered at the note's own fundamental, weighted by
// the level wanted at Nyquist. Soft = almost all lowpass, so the pluck is a
// round displacement with its energy at the bottom; hard = almost all dry, so
// every partial is in the burst. One filter, and it is the whole of "how hard".
levelfilter(lin, f0, x) = (lin*pow(lin, 1.0/3.0)*x) + ((1.0 - lin) * lp2out(x))
  with {
    Lw     = ma.PI*f0/ma.SR;
    Lgain  = Lw / (1.0 + Lw);
    Lpole2 = (1.0 - Lw) / (1.0 + Lw);
    lp2out = *(Lgain) : + ~ *(Lpole2);
  };

excitation = noiseburst(gate, P) : si.smooth(pickPole) : pickComb : levelfilter(L, max(40.0, sfreq));

// the loop's -60 dB time, expressed per period. `ring` is seconds, so a low E
// asked to ring 4 s and a high E asked the same both get the coefficient their
// own period needs — which is not what a single `damp` number can do.
rho = pow(0.001, 1.0/(max(40.0, sfreq)*max(0.05, ring)));
// LINEAR-PHASE FIR3 damping. Its delay is exactly one sample at every
// frequency, which is the reason this string is in tune and gtr_amp's — whose
// bridge filter's group delay is not flat — needed a fitted frequency term.
h0 = (1.0 + bright)/2.0;
h1 = (1.0 - bright)/4.0;
loopfilter(x) = rho * (h0*x' + h1*(x + x''));

str = excitation : (+ : de.fdelay4(Pmax, P - 2)) ~ loopfilter;

// ---- the pickup, the amp and the cab (kept from gtr_amp, measured there) ---
// A magnetic pickup is a coil: a resonant peak up around 3 kHz and nothing
// under 60 Hz. `pickup` moves the coil down the string the way the comb above
// moves the plectrum — a neck coil is further from the bridge, so it hears the
// lower harmonics and the upper ones cancel.
coilComb = fi.ffcombfilter(Pmax, pickup*P, -1);
pu = coilComb : fi.highpass(1, 60) : fi.peak_eq(4.0, 3000, 2200);

// THE NOTE'S GAIN IS ON THE INPUT SIDE, so a hard note comes back louder AND
// dirtier AND more compressed — three things at once, from one number, the way
// an amp does it. Every constant below was fitted on gtr_amp against the
// sampled zones through the same recipe level and master chain.
pre    = 1.0 + drive*15.0;
tight(x) = fi.highpass(2, 90.0 + drive*120.0, x);
shaped(x) = ma.tanh(tight(x) * pre) * (0.24 - drive*0.11)
          : fi.peak_eq(0.0 - drive*7.0, 400, 320);
cab = fi.highpass(2, 90) : fi.peak_eq(3.5 + drive*4.0, 2400, 1100)
    : fi.lowpass(3, max(300.0, min(cutoff, 14000.0)));

// note-off is a HAND ON THE STRINGS, not a switch.
env = en.asr(0.001, 1, release, gate);

// TWO TRIMS, AND THEY ARE NOT THE SAME KNOB.
//
// 1.45 on the INPUT is the gain-staging match: measured at MIDI 52 the string
// and pickup here run 5.07e-3 RMS against the old waveguide's 7.4e-3, so the
// shaper would otherwise see a colder signal and the whole fitted drive curve
// above would be reading off the wrong part of its own tanh.
//
// `makeup` on the OUTPUT is the fader, and it has to exist because this string
// answers the plectrum for real. Measured at fixed gain, the excitation's own
// energy moves 5.5:1 from a thumb to a hard triangle — the old waveguide moved
// 1.2:1, which is why its velocity was a fader in everything but name. A 15 dB
// swing that the note's amp did not ask for would make every soft note vanish,
// so it is taken back out HERE, downstream of the shaper, where taking it out
// costs no dirt: a soft pluck still arrives at the amp cold and still comes
// back clean. Fitted against gtr_amp's own level across the pick range at MIDI
// 52 (worst residual 0.9 dB, at pick 0.56), so the two modules are level and
// the swap is not also a volume change.
makeup = 0.43 + 2.15*(1.0 - pick*pick);
process = str : pu : *(gain*1.45) : shaped : cab : *(env*level*2.0*makeup) : fi.dcblocker;
