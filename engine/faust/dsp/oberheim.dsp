// oberheim — a Prophet-5 poly-mod / Oberheim-SEM pad voice.
//   TWO oscillators (saw). osc2 can morph continuously from an audible detuned
//   partner into a low-frequency modulator (osc2lfo 0..1). POLY-MOD routes
//   osc2 into two destinations, each a smooth morphable amount:
//     pmFM   — osc2 -> osc1 frequency (through-zero-ish exp FM, ±2 oct)
//     pmFilt — osc2 -> filter cutoff (±4 octaves)
//   The tone runs through a SEM-style 12 dB/oct multimode STATE-VARIABLE
//   filter (rolled by hand — TPT / Cytomic-Simper form — NOT ve.moogLadder,
//   which is broken, and NOT ve.oberheim: a self-rolled SVF gives guaranteed
//   Hz-accurate simultaneous LP/BP/HP outputs, which `filterMode` crossfades
//   0=LP .5=BP 1=HP for a continuous filter-mode morph). Lush detuned pad with
//   slow filter-swell + slow amp env by default; poly-mod off at defaults so
//   the stock voice is a clean lush pad. MONO out (matches every pitched voice
//   / the mono voice-pool contract in press.js + live.js). Poly pad.
declare name "oberheim";
import("stdfaust.lib");

// --- params (identity / timbre params smoothed so they morph without zipper)
freq      = hslider("freq", 220, 20, 4000, 0.01) : gsmooth;
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
gate      = button("gate");
cutoff    = hslider("cutoff", 900, 40, 16000, 1) : si.smoo;
res       = hslider("res", 0.15, 0, 1, 0.001) : si.smoo;          // SEM emphasis
filterMode= hslider("filterMode", 0.0, 0, 1, 0.001) : si.smoo;    // 0 LP .5 BP 1 HP
envAmount = hslider("envAmount", 1.3, 0, 5, 0.01);                // filter env, OCTAVES
envAttack = hslider("envAttack", 0.9, 0.001, 5, 0.001);
envDecay  = hslider("envDecay", 1.4, 0.01, 5, 0.005);
envSustain= hslider("envSustain", 0.75, 0, 1, 0.01);
detune    = hslider("detune", 9, 0, 50, 0.1) : si.smoo;           // osc1/osc2 CENTS
osc2tune  = hslider("osc2tune", 0, -36, 24, 0.01) : si.smoo;      // osc2 SEMITONES
osc2lfo   = hslider("osc2lfo", 0.0, 0, 1, 0.001) : si.smoo;       // audio -> LFO morph
lfoRate   = hslider("lfoRate", 4.0, 0.02, 14, 0.01) : si.smoo;    // osc2 rate when LFO
pmFM      = hslider("pmFM", 0.0, 0, 1, 0.001) : si.smoo;          // POLY-MOD osc2->osc1
pmFilt    = hslider("pmFilt", 0.0, 0, 1, 0.001) : si.smoo;        // POLY-MOD osc2->cutoff
drive     = hslider("drive", 0.12, 0, 1, 0.01);                   // gentle tanh pre-filter
attack    = hslider("attack", 0.8, 0.002, 5, 0.002);
sustain   = hslider("sustain", 0.8, 0, 1, 0.01);
release   = hslider("release", 2.4, 0.01, 6, 0.005);
level     = hslider("level", 0.4, 0, 1, 0.01);
gain      = hslider("gain", 0.14, 0, 2, 0.01);

p2(x) = exp(0.6931471805599453 * x);            // 2^x (cents/semis -> ratio, octaves)

// --- SEM 12 dB/oct multimode STATE-VARIABLE filter (TPT / Cytomic-Simper) ---
// fc in Hz, res 0..1 (0 -> Q~0.5 gentle, 1 -> Q~67 near self-osc). 3 outs LP/BP/HP.
svf(fc, rq) = filt
with {
  g  = tan(ma.PI * min(0.49, max(0.0004, fc / ma.SR)));
  k  = 2.0 - 1.985 * rq;                        // damping = 1/Q
  a1 = 1.0 / (1.0 + g * (g + k));
  a2 = g * a1;
  a3 = g * a2;
  // two trapezoidal-integrator states carried around a 1-sample feedback (~);
  // step gets the PREVIOUS states (s1,s2) + input, emits next states + outputs
  step(s1, s2, x) = (s1n, s2n, lp, bp, hp)
  with {
    v3  = x - s2;
    v1  = a1*s1 + a2*v3;
    v2  = s2 + a2*s1 + a3*v3;
    s1n = 2.0*v1 - s1;
    s2n = 2.0*v2 - s2;
    lp  = v2;
    bp  = v1;
    hp  = x - k*v1 - v2;
  };
  // feed s1n,s2n back into s1,s2 (unit delay), keep only lp,bp,hp
  filt = (step ~ si.bus(2)) : (!, !, _, _, _);
};

// --- oscillators + poly-mod ---
wow  = 1.0 + 0.0025 * os.osc(0.27);             // slow analog tape-wow, built in
o1f0 = freq * p2((0.0 - detune*0.5) / 1200.0) * wow;
o2f0 = freq * p2(osc2tune / 12.0) * p2((detune*0.5) / 1200.0) * wow;

// osc2 morphs its frequency from pitch-tracked (audio) toward a fixed low rate
o2f  = o2f0 * (1.0 - osc2lfo) + lfoRate * osc2lfo;
mo2  = os.sawtooth(o2f);                         // osc2 (bipolar): partner AND modulator

// POLY-MOD: osc2 -> osc1 frequency (exp FM, ±2 octaves at full pmFM)
o1f  = o1f0 * p2(pmFM * 2.0 * mo2);
o1   = os.sawtooth(o1f);

// osc2 fades OUT of the audible mix as it becomes an LFO (still modulates)
oscmix = o1 * 0.5 + mo2 * 0.5 * (1.0 - osc2lfo);

driven = oscmix * (1.0 + drive*4.0) : ma.tanh : *(1.0 / (1.0 + drive));

// --- filter envelope + POLY-MOD osc2 -> cutoff (±4 octaves at full pmFilt) ---
fenv = en.adsr(envAttack, envDecay, envSustain, envDecay, gate);
kcut = min(18000.0, max(30.0, cutoff * p2(envAmount*fenv + pmFilt*4.0*mo2)));

// --- filter-mode morph: crossfade LP -> BP -> HP ---
wlp = max(0.0, 1.0 - 2.0*filterMode);
wbp = 1.0 - abs(2.0*filterMode - 1.0);
whp = max(0.0, 2.0*filterMode - 1.0);
morph(lp, bp, hp) = lp*wlp + bp*wbp + hp*whp;

env = en.adsr(attack, 0.4, sustain, release, gate);

process = driven : svf(kcut, res) : morph : *(env * level * gain);
