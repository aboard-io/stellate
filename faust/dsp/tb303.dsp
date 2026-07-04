// tb303 — a TRUE Roland TB-303 mono-legato voice (the real thing, superseding
// bass_acid). Single oscillator (saw<->square morph), a self-oscillating
// resonant ladder lowpass, and the two behaviors that MAKE it a 303:
//
//   ACCENT (per-note, ONE param -> three simultaneous effects, like the real
//     accent circuit): boosts the VCA, SHARPENS the filter-env decay (accented
//     steps squelch faster) AND adds the RESONANCE KICK (a short extra push of
//     both resonance and cutoff-env depth — the "wowww" on accented steps). It
//     rides its own short envelope (~200 ms accent-cap RC), independent of the
//     DECAY knob.
//   SLIDE (per-note): legato ~60 ms exponential pitch glide with NO envelope
//     retrigger. The mono-legato scheduler holds the gate across a slide group;
//     this module just slews `freq` when slide>0 (slide 0 = instant snap).
//
// FILTER — trap check (see faust/VOICES.md): the commission asked for
// ve.diodeLadder, but the faustwasm 0.16.5 / Faust 2.85.8 bundle's normalized-
// frequency Zavalishin ladders (moogLadder/diodeLadder/korg35*) are the KNOWN-
// BROKEN family (moogLadder measured cutoff proportional to normFreq^~2.5 with
// ~-60 dB passband loss). diodeLadder(normFreq 0-1, Q 0.707..25) is the same
// normalized-freq TPT family and could not be empirically verified in-session
// (node/build blocked). Following the project's standing rule ("All ladder
// filters use ve.moog_vcf_2bn") and the commission's fallback clause, the voice
// uses ve.moog_vcf_2bn(res 0..1, fcHz) — verified, Hz-native, stable, and
// self-oscillating as res -> 1 (the squelch). Swap to diodeLadder (normFreq =
// fc/(SR/2), Q = 0.707+res*24) only once that family is re-verified.
declare name "tb303";
import("stdfaust.lib");

freq     = hslider("freq", 55, 20, 1000, 0.01);
gate     = button("gate");
cutoff   = hslider("cutoff", 500, 60, 6000, 1);        // CUT OFF FREQ knob (base fc, Hz)
resonance= hslider("resonance", 0.7, 0, 1, 0.01);      // RESONANCE knob
envmod   = hslider("envmod", 0.55, 0, 1, 0.01);        // ENV MOD depth (0..~4 oct of sweep)
decay    = hslider("decay", 0.4, 0.03, 2.5, 0.005);    // DECAY knob (filter-env decay, s)
accent   = hslider("accent", 0, 0, 1, 0.01);           // per-note ACCENT amount
slide    = hslider("slide", 0, 0, 1, 0.01);            // per-note SLIDE amount (glide on)
wave     = hslider("waveform", 0, 0, 1, 0.01);         // 0 saw .. 1 square (`waveform` is a reserved Faust keyword)
level    = hslider("level", 1, 0, 2, 0.01);
gain     = hslider("gain", 0.9, 0, 2, 0.01);           // per-note velocity

// --- SLIDE: exponential portamento toward the target note. slide>0 engages a
// ~60 ms glide (tau = 60ms/4.6 -> settles within 1% at ~60 ms); slide<=0 snaps.
gsec  = slide * 0.060;
gpole = ba.tau2pole(max(gsec / 4.6, 0.0004)) * (slide > 0.02);
kf    = freq : si.smooth(gpole);

// --- OSCILLATOR: saw <-> square morph (the two 303 waveforms). os.sawtooth /
// os.square are band-limited (no aliasing on bass slides).
osc = os.sawtooth(kf) * (1.0 - wave) + os.square(kf) * wave;

// --- ACCENT dynamics: a short spike that DECAYS WHILE THE GATE IS HELD (adsr
// with sustain 0 = a decay-to-zero contour, the accent-cap discharge). Scaled
// by the accent amount so accent 0 is bit-for-bit "no accent".
accEnv = en.adsr(0.002, 0.20, 0.0, 0.04, gate) * accent;

// --- FILTER ENVELOPE (the squelch): a note-on decay-to-zero contour (adsr,
// sustain 0) — the 303 filter closes down over DECAY even while the note is
// held. Accented notes decay FASTER.
fdecay = max(0.02, decay * (1.0 - 0.45 * accent));
fEnv   = en.adsr(0.003, fdecay, 0.0, 0.05, gate);

// cutoff sweep in OCTAVES above the base fc: envmod depth + the accent kick
// adds up to ~1.5 extra octaves of momentary sweep on top.
sweepOct = envmod * 4.0 * fEnv + accEnv * 1.5;
kcut  = min(16000.0, max(40.0, cutoff * exp(0.6931472 * sweepOct)));

// RESONANCE -> ladder res (0..1). Base + accent kick; clamp below 1.0 so the
// ladder self-oscillates hot but never blows up.
qres  = min(0.98, resonance * 0.92 + accEnv * 0.30);
// moog_vcf_2bn droops the passband as res rises — gentle makeup so squelchy
// high-res notes stay audible (cf. lead_fuzz's res-loss trim).
makeup = 1.0 + qres * 1.3;

// --- VCA: the 303 gate contour. Fast attack, quick settle to a high sustain,
// fast release so staccato steps separate. Accent lifts the whole note.
amp   = en.adsr(0.003, 0.09, 0.9, 0.008, gate);
vca   = amp * (1.0 + accEnv * 1.7);

filtered = osc : ve.moog_vcf_2bn(qres, kcut);

// final tanh = the gentle 303 output grit / soft limit
process = filtered * (vca * level * gain * makeup * 0.5) : ma.tanh;
