// ppg — a PPG-Wave-class WAVETABLE-SCAN voice (poly). A bank of NF single-cycle
// frames is generated ALGORITHMICALLY at table-fill time by an additive partial
// recipe that evolves with the frame index: frame 0 is nearly a pure sine, the
// middle frames grow a moving resonant/formant (vowel) hump, and the top frames
// open into a bright saw-like buzz. SCAN POSITION is the star morphable param —
// a continuous position through the bank, swept by its own ADS envelope and an
// LFO — so a genre can dial timbre along one axis (idm / coldwave / witchhouse).
// Playback reads the two neighbouring frame tables and crossfades them; the
// tables are NOT band-limited, so bright frames fold a little at high notes —
// the period-correct PPG grit, kept mild. Output runs through an analog-style
// resonant ladder LPF (ve.moog_vcf_2bn — ve.moogLadder is broken, see VOICES.md)
// with a modest filter envelope, plus a gentle sub and tanh drive for weight.
// MONO out per voice (house convention — the engine handles stereo placement;
// every exemplar voice and the press/live pipeline are mono-per-voice).
declare name "ppg";
import("stdfaust.lib");

// ---- identity / standard params (smooth, morphable) ------------------------
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
cutoff  = hslider("cutoff", 3000, 60, 16000, 1) : si.smoo;
res     = hslider("res", 0.25, 0, 0.95, 0.01);

// ---- THE star axis: scan position + its modulators -------------------------
scan    = hslider("scan", 0.35, 0, 1, 0.001) : si.smoo;   // base bank position
scanEnv = hslider("scanEnv", 0.30, -1, 1, 0.01);          // env -> scan (amount)
scanLfo = hslider("scanLfo", 0.0, 0, 0.5, 0.001);         // LFO -> scan (depth)
scanRate= hslider("scanRate", 0.30, 0.01, 12, 0.01);      // scan LFO Hz
scanAtk = hslider("scanAtk", 0.40, 0.001, 4, 0.001);
scanDec = hslider("scanDec", 0.60, 0.01, 6, 0.005);
scanSus = hslider("scanSus", 0.50, 0, 1, 0.01);

// ---- tone shaping ----------------------------------------------------------
envAmount = hslider("envAmount", 0.50, 0, 4, 0.01);       // filter env, OCTAVES
drive   = hslider("drive", 0.12, 0, 1, 0.01);             // tanh pre-filter
sub     = hslider("sub", 0.15, 0, 1, 0.01);               // octave-down sine

// ---- loudness env + gains --------------------------------------------------
attack  = hslider("attack", 0.01, 0.001, 2, 0.001);
sustain = hslider("sustain", 0.85, 0, 1, 0.01);
release = hslider("release", 0.40, 0.01, 3, 0.005);
level   = hslider("level", 0.40, 0, 1, 0.01);
gain    = hslider("gain", 1, 0, 2, 0.01);

// ---- wavetable bank --------------------------------------------------------
NF  = 12;                 // frames in the bank
TS  = 2048;               // samples per single-cycle frame (power of two)
H   = 24;                 // additive partials per frame
TAU = 2.0 * ma.PI;

// per-frame additive recipe (all pure functions of frame k / harmonic n, so the
// whole thing constant-folds into the table fill — no per-sample cost):
frn(k)      = float(k) / float(NF - 1);                    // 0..1 across the bank
prol(k)     = 3.0 - 2.0 * frn(k);                          // harmonic rolloff 3->1
rollo(k, n) = 1.0 / pow(float(n), prol(k));                // dark -> saw
fcen(k)     = 1.5 + 7.0 * frn(k);                          // formant harmonic climbs
resA(k)     = 4.0 * exp(0.0 - pow((frn(k) - 0.5) / 0.28, 2.0)); // vowel hump mid-bank
bwid        = 1.4;
formant(k, n) = 1.0 + resA(k) * exp(0.0 - pow((float(n) - fcen(k)) / bwid, 2.0));
amp(k, n)   = rollo(k, n) * formant(k, n);
norm(k)     = 1.0 / sqrt(sum(hh, H, pow(amp(k, hh + 1), 2.0))); // ~constant RMS/frame

// single-cycle content of frame k, evaluated over the table-fill ramp ba.time
frameSig(k) = sum(hh, H, amp(k, hh + 1) *
                        sin(TAU * float(hh + 1) * float(ba.time) / float(TS)))
              * norm(k);
tblRead(k)  = rdtable(TS, frameSig(k), rdidx);

// read phase (non-band-limited -> the period-correct grit)
rdidx = int(os.lf_sawpos(freq) * float(TS)) & (TS - 1);

// modulated bank position -> frame coordinate fpos in [0, NF-1]
senv = en.adsr(scanAtk, scanDec, scanSus, scanDec, gate);
pos  = scan + scanEnv * senv + os.osc(scanRate) * scanLfo;
fpos = max(0.0, min(1.0, pos)) * float(NF - 1);

// crossfade the two neighbouring frames (triangular weights sum to 1)
wt = sum(k, NF, tblRead(k) * max(0.0, 1.0 - abs(fpos - float(k))));

// ---- voice path ------------------------------------------------------------
sig    = wt + os.osc(freq * 0.5) * sub;
driven = sig * (1.0 + drive * 4.0) : ma.tanh : *(1.0 / (1.0 + drive * 1.5));

fenv = en.adsr(attack, 0.15, 0.4, release, gate);
kcut = max(30.0, min(16000.0, cutoff * pow(2.0, envAmount * fenv)));

env  = en.adsr(attack, 0.08, sustain, release, gate);

process = driven : ve.moog_vcf_2bn(res, kcut) : *(env * level * gain);
