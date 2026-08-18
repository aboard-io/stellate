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
push    = hslider("push", 0.4, 0, 1, 0.01) : si.smoo;      // the dynamic — VELOCITY
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

// *3.7: the tract's normalizer targets a fixed steady state, so the trim is a
// constant, and it was FITTED — pressed against the sampled `solo_vox` zone
// this stands in for, same music, same recipe level, same master chain, on the
// press's own pre-makeup peak so the normalizer cannot hide the answer.
process = voxTract(voice, vowel, breath, fnom, voxGlottis(push, fsrc), gate)
        : *(voxEnv(attack, release, gate) * level * gain * 3.7)
        : fi.lowpass(2, max(800.0, min(cutoff, 16000.0)))
        : fi.dcblocker;
