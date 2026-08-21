// voice_lead — A SINGER FOLLOWING THE TUNE. One throat (dsp/voice_tract.lib),
// seated on a line.
//
// What separates this from the choir beside it is not the sound of the tract —
// it is the same tract — but what the tract is asked to do with a MELODY:
//
//   THE VOWEL MOVES ALONG THE LINE. `vowel` is written per note by the host
//   (state-engine mapEvents walks the genre's own vowel string) and si.smoo
//   glides between them over ~20 ms, so a phrase diphthongs the way a sung word
//   does. That is the whole reason a formant model is here and a recording of
//   an "aah" is not: the sample has one vowel and can never leave it.
//   THE SLIDE IS A REAL PORTAMENTO. `glide` is a one-pole on the pitch, so a
//   slid note bends into the next instead of two notes crossfading — the same
//   contract gtr_amp's `glide` keeps, and the same `slideParam` wiring.
//   THE VIBRATO GROWS (voxVib): a singer arrives straight and widens.
//   THE DYNAMIC OPENS THE VOICE. `push` is velocity's knob (MODEL_DYN) and it
//   is the glottal tilt, not a fader — soft is closed and dark, loud is bright
//   and edged, at the same loudness.
//   AND THE FOLD DRIFTS (`sway`). A held note out of a formant bank is the one
//   thing this model does worse than a recording: the tables do not move, so a
//   long note is the same spectrum for its whole length. `sway` is a slow LFO
//   ADDED TO `push` — the singer's breath support wandering, not a wobble on
//   the pitch and not a tremolo on the fader.
//   IT ONLY EVER FIRMS THE FOLD. The LFO is a raised cosine, so the drift runs
//   from the note's own `push` UP to push+sway and back, never under it. That
//   is one-sided on purpose: a fold driven SOFTER is a fold whose harmonics
//   fall away while the breath noise stays broadband, so a symmetric drift
//   would spend half its cycle airier than sitting still — measured, a +-0.22
//   swing put the trough 2.2 dB above the aperiodic/harmonic ratio it was
//   asked to fix. One-sided, no setting of `sway` can be breathier than
//   `sway` 0, and "let it swell and fade" is a swell rather than a sag.
//   IT MOVES THE MOUTH AS WELL AS THE FOLD (`vowelSway`), and that is where
//   most of the movement actually is: `sway` opens the glottis, `vowelSway`
//   drifts the FILTERBANK — the five formant centres themselves — so the vowel
//   wanders the way a held syllable does instead of standing still under it.
//   Both ride the same slow LFO, because they are the same gesture: more
//   pressure is a more open mouth.
//   IT IS THE VOICE'S OWN FILTER AND NOT A FILTER AFTER IT, and that was
//   measured rather than preferred. The alternative was free: `insert_filtersweep`
//   already exists, is tempo-synced, and rides the unit's `inserts` array with
//   no DSP at all. Held note, 24 s, 0.5 s frames, the same voice, spectral
//   centroid spread against level wobble:
//     insert_filtersweep, moog ladder over the voice   x1.07   1.6 dB
//     ...opened wide enough to reach                   x1.18   7.4 dB
//     sway alone (the fold)                            x1.05   0.0 dB
//     sway + vowelSway (the mouth)                     x1.40   0.7 dB
//   A ladder over a voice takes the LOUDNESS — the first formant carries most
//   of the energy and sits either side of the corner — where moving the
//   filterbank moves the COLOUR, which is the thing that was static.
//   THE DRIFT ONLY EVER FIRMS THE FOLD. The LFO is a raised cosine running
//   from the note's own `push` UP to push+sway and back, never under it. One-
//   sided on purpose: a fold driven SOFTER loses harmonics while the breath
//   noise stays broadband, so a symmetric drift spends half its cycle airier
//   than sitting still — measured, a +-0.22 swing put the trough 2.2 dB above
//   the aperiodic/harmonic ratio it was there to fix. One-sided, no setting of
//   `sway` is breathier than `sway` 0, and "swell and fade" is a swell.
//   AT ZERO IT IS NOT THERE. sway 0 renders sample-for-sample against the
//   module without it (checked), so every existing caller — the parent's 274
//   anchors included — is byte-identical.
//
// `cutoff` is the room and the mic, and it is the ONE place the genre's tone
// block lands: a crooner an inch off a ribbon is dark, a pop vocal through a
// condenser is not.
declare name "voice_lead";
import("stdfaust.lib");
import("voice_tract.lib");

freq    = hslider("freq", 220, 50, 1600, 0.01);
gate    = button("gate");
voice   = hslider("voice", 4, 0, 4, 1);          // 0 alto 1 bass 2 countertenor 3 soprano 4 tenor
vowel   = hslider("vowel", 0, 0, 4, 0.01) : si.smooth(ba.tau2pole(0.02));
// how far the mouth wanders off the written vowel, in vowel-table units (1 is a
// whole step of the a-e-i-o-u walk). Held well under 1 by every caller: this is
// a syllable drifting, not the genre's mouth being overruled.
vowelSway = hslider("vowelSway", 0, 0, 2, 0.001) : si.smoo;
push    = hslider("push", 0.4, 0, 1, 0.01) : si.smoo;      // the dynamic — VELOCITY
sway    = hslider("sway", 0, 0, 0.5, 0.001) : si.smoo;     // the fold's slow drift
// slow enough to be a singer and not a machine: 0.13 Hz is ~7.7 s a cycle, so a
// four-bar phrase at 100 bpm sees a third of one and no two notes in it are the
// same colour. Wall-clock rather than bar-synced on purpose — breath support is
// a fact about a person, not about the tempo.
swayRate= hslider("swayRate", 0.13, 0.01, 2, 0.001) : si.smoo;
breath  = hslider("breath", 0.05, 0, 0.6, 0.001) : si.smoo;
glide   = hslider("glide", 0.0005, 0.0005, 0.4, 0.0001);
vibrato = hslider("vibrato", 0.012, 0, 0.05, 0.0001);
vibRate = hslider("vibRate", 5.4, 3, 8, 0.01);
vibRise = hslider("vibRise", 0.6, 0.05, 3, 0.01);
attack  = hslider("attack", 0.05, 0.005, 2, 0.001);
release = hslider("release", 0.25, 0.02, 3, 0.001);
cutoff  = hslider("cutoff", 5000, 800, 16000, 1) : si.smoo;
level   = hslider("level", 0.6, 0, 1, 0.01);
gain    = hslider("gain", 0.4, 0, 2, 0.01);

fnom = freq : si.smooth(ba.tau2pole(max(0.0005, glide)));
t    = voxSince(gate);
fsrc = fnom * (1.0 + voxVib(vibrato, vibRise, t)*os.osc(vibRate));

// the fold as it is actually driven: velocity's setting, drifting. Clamped
// rather than trusted — `push` is already 0..1 and min/max over that range is
// the identity, which is what keeps sway 0 byte-identical.
// ONE GESTURE, TWO PLACES. A raised cosine starting at 0 — the same idiom
// insert_filtersweep uses — so a voice taken fresh out of the pool starts on
// its own `push` and its own vowel and rises off them.
swayLfo = 0.5 - 0.5*os.oscp(swayRate, ma.PI/2);
pushM   = min(1.0, max(0.0, push  + sway      * swayLfo));
vowelM  = min(4.0, max(0.0, vowel + vowelSway * swayLfo));

// *3.7: the tract's normalizer targets a fixed steady state, so the trim is a
// constant, and it was FITTED — pressed against the sampled `solo_vox` zone
// this stands in for, same music, same recipe level, same master chain, on the
// press's own pre-makeup peak so the normalizer cannot hide the answer.
process = voxTract(voice, vowelM, breath, fnom, voxGlottis(pushM, fsrc), gate)
        : *(voxEnv(attack, release, gate) * level * gain * 3.7)
        : fi.lowpass(2, max(800.0, min(cutoff, 16000.0)))
        : fi.dcblocker;
