// solina — ARP/Eminent Solina String Ensemble (poly strings voice).
//
// DIVIDE-DOWN CHARACTER: the real Solina derives every note from top-octave
// master oscillators, so all notes are phase-locked and the RAW tone is flat,
// static, organ-like — NO per-note detune, NO per-oscillator drift (that is
// what separates this from strings/pad_saw, which detune). The 8'/4' footings
// are exact, phase-locked octaves (a divide-down, hence `octave` mixes 2*f in
// on the same phase). A thin highpass gives the reedy string body.
//
// PARAPHONIC ENVELOPE: fixed fast attack -> full hold -> short release
// (en.asr, organ-flat, no decay) — the minimal per-note VCA of the original.
//
// IDENTITY FEATURE — the TRIPLE-LFO ENSEMBLE CHORUS: three modulated fractional
// delay lines (the BBD bucket-brigade ensemble), staggered in BOTH phase
// (120 deg apart) and rate, each driven by a slow+fast compound LFO. Summing
// the dry tone with the three detuned taps turns the flat divide-down source
// into the shimmering, beating string cloud. `ensemble` morphs dry->full
// cloud; it is the signature dimension. Output is MONO (the engine's voice
// path sums channel 0 only) — the inter-tap beating shimmers even summed.
declare name "solina";
import("stdfaust.lib");

freq   = hslider("freq", 220, 20, 4000, 0.01) : si.smoo;
gate   = button("gate");
tone   = hslider("tone", 3200, 300, 12000, 1) : si.smoo;   // lowpass brightness
octave = hslider("octave", 0.55, 0, 1, 0.001) : si.smoo;   // 4' footing mix (8'/4' body)
attack = hslider("attack", 0.012, 0.002, 1.5, 0.001);      // fast Solina attack
release= hslider("release", 0.22, 0.02, 3, 0.001);         // short paraphonic release
chorusRate  = hslider("chorusRate", 0.62, 0.05, 4, 0.001) : si.smoo;  // ensemble LFO Hz
chorusDepth = hslider("chorusDepth", 0.9, 0, 1, 0.001) : si.smoo;     // sweep depth
ensemble    = hslider("ensemble", 0.85, 0, 1, 0.001) : si.smoo;       // dry->cloud (IDENTITY)
level  = hslider("level", 0.5, 0, 1, 0.01);
gain   = hslider("gain", 0.16, 0, 2, 0.01);                // per-note velocity

// DIVIDE-DOWN SOURCE — phase-locked 8' + 4' saws (no detune: the flatness is
// the point; the ensemble supplies all the movement), thinned to reedy body.
src = (os.sawtooth(freq) + octave * os.sawtooth(2 * freq)) / (1 + octave)
    : fi.highpass(1, 160);

// PARAPHONIC VCA — fast attack, full hold, short release (organ-flat, no decay)
env = en.asr(attack, 1.0, release, gate);

// fenv* = SYNTHESIS-DEPTH unified filter envelope (2026-07);
// fenvAmount 0 is a bit-exact bypass (absent-law). Envelopes the `tone` lowpass.
fenvAmount = hslider("fenvAmount", 0, -4, 4, 0.01);       // cutoff env depth, OCTAVES (signed; 0 = off, bit-exact)
fenvAttack = hslider("fenvAttack", 0.005, 0.001, 2, 0.001);
fenvDecay  = hslider("fenvDecay", 0.18, 0.01, 3, 0.005);
fenvC   = en.adsr(fenvAttack, fenvDecay, 0, fenvDecay, gate);   // AD contour (sustain 0), note-on triggered
fenvMul = exp(0.6931472 * fenvAmount * fenvC);                  // 2^(amt*contour); amt 0 -> exactly 1.0

voice = src * env : fi.lowpass(2, max(30.0, min(tone*fenvMul, 16000.0)));

// ENSEMBLE CHORUS — three modulated fractional delays. Each LFO is a compound
// slow(120 deg staggered)+fast(9x) sine, and the three SLOW rates are staggered
// (0.93/1.0/1.07x) so the taps drift through each other like the BBD original.
sinp(rate, ph) = sin(2 * ma.PI * os.lf_sawpos(rate) + ph);
lfo(rslow, ph) = 0.78 * sinp(rslow, ph) + 0.22 * sinp(rslow * 9.0, ph * 1.7);

ctr   = 0.0065 * ma.SR;                         // ~6.5 ms BBD center delay
swing = 0.0045 * ma.SR * chorusDepth;           // +/- up to ~4.5 ms sweep
tap(rmul, ph) = de.fdelay(2048, max(1.0, ctr + swing * lfo(chorusRate * rmul, ph)));

// split the source to the three staggered taps and sum (explicit <: ... :> _
// merge, the house idiom — cf. choir.dsp)
cloud = _ <: tap(0.93, 0.0), tap(1.0, 2.0943951), tap(1.07, 4.1887902) :> _;

// dry stays present (it is a CHORUS, not a vibrato); the three taps add the
// shimmering cloud. `ensemble` blends in the cloud; makeup keeps loudness ~flat
// across the morph (dry->1x, full->~0.5x since 3 decorrelated taps ~2x RMS).
ensembled = _ <: _, cloud : _, *(ensemble) : + : *(1.0 / (1.0 + ensemble));

process = voice : ensembled : *(level * gain);
