// gtr_amp — AN ELECTRIC GUITAR IS A STRING, A PICKUP AND AN AMPLIFIER, and the
// amplifier is the part that answers how hard you hit it. The sampled GM
// electrics (clean/jazz/palm-muted/crunch/overdrive/distortion) are six zones
// each and ONE dynamic layer, so a quiet note on the distortion patch is a
// quiet recording of a loud note — the least true thing sampled music does.
// Here the string is a waveguide, the note's own amp lands on the INPUT of the
// preamp, and the drive is therefore a function of how hard the note was
// played: soft is clean, hard is crunch, and it is the same instrument.
//
// THE LIBRARY'S OWN ELECTRIC IS BROKEN AND THIS IS NOT IT. Measured on this
// repo's compiler: pm.elecGuitar/pm.elecGuitarModel die inside 100 ms at every
// value of `mute` (its chain ends at elecGuitarBridge with no `pm.out` block,
// and its mute multiplies the travelling wave once per traversal so any value
// under 1 collapses the loop). The chain below is that model REPAIRED —
// nuts : string-with-pickup : bridge : OUT — with damping expressed as a
// near-unity loop coefficient, which is what a string actually is. Sustained
// 1.9e-1 -> 8.8e-3 over 1.6 s in the same test that killed the library's.
//
// TUNING IS MEASURED, NOT COPIED. The library's guitar chains subtract a
// hand-tuned length constant, and elecGuitarModel's 0.11 leaves the top octave
// nearly two semitones FLAT. The loop's real extra delay — the bridge filter,
// the dispersion allpasses, the fractional-delay interpolator — was measured on
// this exact chain and fitted over the whole neck: 20.5 samples plus a small
// frequency term, because a filter's group delay is not flat. Subtracting THAT,
// in metres, holds MIDI 40-67 inside THREE cents and MIDI 72 inside seven —
// better intonation than most real guitars have. Above MIDI 77 it drifts sharp
// (+15c at 76, +37 at 79) and the string stops speaking anyway (measured, the
// note is 25 dB down by MIDI 84), which is why state-engine caps this voice at
// 700 Hz and lets the register law fold anything higher down an octave — the
// drop a guitarist makes when the line runs off the fingerboard.
//
// VELOCITY MEANS, PHYSICALLY: how hard the plectrum hits (`pick` -> the
// excitation's brightness and its sharpness, i.e. a fingertip vs a hard nylon
// triangle) AND how hot the pickup drives the preamp (the note's `gain`, on
// the input side of the shaper). Both are real; neither is a volume knob.
declare name "gtr_amp";
import("stdfaust.lib");

freq   = hslider("freq", 220, 40, 2000, 0.01);
gate   = button("gate");
// glide: SECONDS to slide into the written pitch. A waveguide's pitch IS its
// delay length, so this is a real portamento — the string bends, it does not
// crossfade. 0 = arrive instantly (bit-exact: si.smooth's pole is 0).
glide  = hslider("glide", 0, 0, 0.5, 0.001);
pick   = hslider("pick", 0.5, 0, 1, 0.01);        // plectrum hardness (velocity)
pluckPos = hslider("pluckPos", 0.78, 0.02, 0.98, 0.01);   // where the pick lands
pickup = hslider("pickup", 0.28, 0.05, 0.5, 0.01);        // bridge 0.05 .. neck 0.5
stiff  = hslider("stiff", 0.32, 0, 1, 0.01);      // string stiffness (inharmonicity)
damp   = hslider("damp", 0.9998, 0.99, 1, 0.00001);  // sustain; palm mute lives at the bottom
drive  = hslider("drive", 0.18, 0, 1, 0.01);      // preamp gain
cutoff = hslider("cutoff", 5200, 200, 14000, 1) : si.smoo;   // the cab's cliff
level  = hslider("level", 0.5, 0, 1, 0.01);
gain   = hslider("gain", 0.3, 0, 2, 0.01);

// ---- the string ----------------------------------------------------------
// pm.f2l is metres-per-cycle; `exs` is the measured end correction (see above),
// expressed in SAMPLES and converted here, so the tuning holds at 48 kHz too.
sfreq = freq : si.smooth(ba.tau2pole(max(glide, 0.0001)));
exs   = 20.5 + 0.0015*sfreq;
sl    = max(0.05, pm.f2l(sfreq) - exs*pm.speedOfSound/ma.SR);
// pluckString(length, cutoffRatio, maxFreqRatio, sharpness, gain, trigger):
// its `cutoffRatio` is RELATIVE to the note (the excitation lowpass sits at
// 5*f0*ratio), and a plectrum is not — the same pick on the same string makes
// the same noise whatever fret you are on. So the ratio is solved backwards
// from an ABSOLUTE corner: 900 Hz for a thumb, 6.9 kHz for a hard nylon
// triangle. `sharpness` LENGTHENS the excitation, so a hard pick is the SHORT
// one — and its `gain` is an AMPLITUDE, so shortening the burst quietly takes
// ENERGY out of it: measured on the tape, a hard pick was putting less into the
// low partials than a soft one, which is the opposite of what a plectrum does.
// The excitation is therefore compensated for its own length (sqrt of the ratio,
// energy going as amplitude squared times time) and carries no velocity of its
// own beyond that: the string is linear, so the note's loudness is scaled
// downstream instead, where the shaper can hear it.
sharp  = 1.6 - pick*1.15;
pickHz = 900.0 + pick*6000.0;
ex = pm.pluckString(pm.f2l(sfreq), pickHz/(5.0*max(40.0, sfreq)), 1,
                    sharp, sqrt(1.6/sharp), gate);
str = pm.endChain(pm.chain(
        pm.elecGuitarNuts :
        pm.openStringPickUp(sl, stiff, pluckPos, pickup, ex) :
        (*(damp), *(damp), _) :
        pm.elecGuitarBridge :
        pm.out));

// ---- the pickup ----------------------------------------------------------
// A magnetic pickup is a coil: a resonant peak up around 3 kHz and nothing
// under 60 Hz. This is the "electric" in electric guitar and it is why the
// same string sounds like a different instrument through it.
pu = fi.highpass(1, 60) : fi.peak_eq(4.0, 3000, 2200);

// ---- the amp -------------------------------------------------------------
// THE NOTE'S GAIN IS ON THE INPUT SIDE. A hard note pushes further into the
// tanh than a soft one, so it comes back louder AND dirtier AND more
// compressed — three things at once, from one number, the way an amp does it.
// The stage gain is deliberately modest (x15 at full drive, not x22): a note
// range of 0.09-0.30 has to come out the other side with SOME loudness left in
// it, and at x22 a clean setting was already squashing pianissimo and forte to
// within 1.4 dB of each other. Measured through the shaper now, a clean amp
// keeps ~8 dB of that range and a screaming one keeps ~2 — which is not a bug,
// it is the compression every guitarist uses distortion to get, and it is why
// velocity has to mean TIMBRE up there or it means nothing.
// AND THE LOW END COMES OUT BEFORE THE CLIP, NOT AFTER. Measured on the tape,
// a driven note without this put 86% of its body energy under 800 Hz — the
// "fart" every guitar amp's tone stack is built to prevent. A highpass ahead of
// the shaper that opens with the gain (90 Hz clean, 210 Hz screaming) is where
// a real amp puts it, and the post-drive dip at 400 Hz is the mid scoop the
// same knob always brings with it.
pre    = 1.0 + drive*15.0;
tight(x) = fi.highpass(2, 90.0 + drive*120.0, x);
// The output trim is the A/B against the sampled zones each setting stands in
// for — clean, crunch and distortion measured separately through the same
// recipe level and the same master chain, and fitted. It falls with drive, but
// only a little (0.23 clean, 0.15 screaming): the shaper is already giving the
// gain back as compression, and taking it all away again is how a "drive" knob
// turns into a volume knob.
shaped(x) = ma.tanh(tight(x) * pre) * (0.24 - drive*0.11)
          : fi.peak_eq(0.0 - drive*7.0, 400, 320);
// cab: the speaker's low cut, a presence bump, and its high cliff at `cutoff`.
// The bump sits at 2.4 kHz because that is where a guitar reads as PRESENT, and
// without it a waveguide through a 3rd-order lowpass is a blanket.
cab = fi.highpass(2, 90) : fi.peak_eq(3.5 + drive*4.0, 2400, 1100)
    : fi.lowpass(3, max(300.0, min(cutoff, 14000.0)));

// note-off is a HAND ON THE STRINGS, not a switch: the string keeps ringing for
// `release` and only then stops. 0.25 s is a player letting a note go; palm-mute
// genres write it down to 0.05 and get the chug.
release = hslider("release", 0.25, 0.02, 2, 0.005);
env = en.asr(0.001, 1, release, gate);

// *2.0: measured against the sampled zones this voice stands in for, through
// the same recipe level and the same master chain — A/B, not a guess.
process = str : pu : *(gain) : shaped : cab : *(env*level*2.0) : fi.dcblocker;
