// tract_voice — A MOUTH THAT IS TRYING. The Kelly-Lochbaum tract in
// dsp/tract.lib, given a glottis, an envelope and a driver that walks
// articulatory targets, so what comes out is SYLLABLES rather than a held tone.
//
// dsp/voice_lead.dsp and dsp/voice_choir.dsp beside this one are the singers:
// one throat, five formant bandpasses, a vowel that can glide. This is the other
// half of what a mouth does. It can shut. Ten of its parameters are articulation
// — where the tongue is, how tight, how long, how open the lips are, whether the
// nose is connected, where the hiss goes — and moving them is the instrument,
// the way moving a bow is a violin's instrument. A held setting is a vowel; a
// setting that moves is a consonant.
//
// EVERY MUSICAL PARAMETER IS A REAL PARAM, and there are three ways in, applied
// in that order:
//
//   `vowel` 0..4 reads tract.lib's fitted table, i, e, a, o, u, continuously
//     interpolated — so a line can diphthong between two of them, which is the
//     same contract voice_lead keeps and the reason a formant model is here
//     instead of a recording.
//   `artic` hands the four tongue-and-lip knobs the wheel instead. This is what
//     build/measure-tract.js drives to put a closure at a particular place, and
//     what a host drives to say something the vowel axis cannot spell.
//   `babble` crossfades to the driver, which is the whole point of the file:
//     seeded, articulatory, consonant-then-vowel, at `rate` syllables a second.
//
// ONE PRECOMPILED WORKLET, NO ALLOCATION PER NOTE. The speech organ in
// engine/speech.js has to build a fresh espeak wasm heap per utterance — that
// is the LAW there, for determinism — and iOS has killed tabs for it. This is
// the other way to do it: the tract is a fixed graph of delays and multiplies,
// the babble is a hash of a syllable counter, and a seed is a sentence. Nothing
// is fetched, nothing is decoded, nothing is built at note time, and the same
// seed renders the same take in the browser and in the offline press.
//
// COMPILE TIME IS A REAL COST HERE and the shape of this file is what pays it:
// see the note at `process` below. 14 seconds, against nearly fourteen minutes
// for the version that read the driver's outputs one at a time.
declare name "tract_voice";
import("stdfaust.lib");
import("tract.lib");
import("voice_tract.lib");

freq    = hslider("freq", 130, 40, 900, 0.01);
gate    = button("gate");
vowel   = hslider("vowel", 2, 0, 4, 0.01) : si.smooth(ba.tau2pole(0.018));
artic   = hslider("artic", 0, 0, 1, 0.01);
tongue  = hslider("tongue", 0.5, 0, 1, 0.001);
tongueD = hslider("tongueD", 1, 0, 1, 0.001);
tongueL = hslider("tongueL", 0.2, 0.05, 0.5, 0.001);
lips    = hslider("lips", 1, 0, 1, 0.001);
velum   = hslider("velum", 0, 0, 1, 0.001);
fric    = hslider("fric", 0, 0, 1, 0.001);
fricX   = hslider("fricX", 0.9, 0, 1, 0.001);
babble  = hslider("babble", 0, 0, 1, 0.01);
rate    = hslider("rate", 3.6, 0.5, 12, 0.01);
seed    = hslider("seed", 1, 0, 4096, 1);
push    = hslider("push", 0.45, 0, 1, 0.01) : si.smoo;
oq      = hslider("open", 0.62, 0.15, 0.95, 0.01) : si.smoo;
breath  = hslider("breath", 0.06, 0, 1, 0.001) : si.smoo;
voiced  = hslider("voiced", 1, 0, 1, 0.01) : si.smoo;
vibrato = hslider("vibrato", 0.010, 0, 0.05, 0.0001);
vibRate = hslider("vibRate", 5.2, 3, 8, 0.01);
vibRise = hslider("vibRise", 0.5, 0.05, 3, 0.01);
glide   = hslider("glide", 0.0005, 0.0005, 0.4, 0.0001);
attack  = hslider("attack", 0.02, 0.002, 2, 0.001);
release = hslider("release", 0.18, 0.02, 3, 0.001);
cutoff  = hslider("cutoff", 7000, 800, 16000, 1) : si.smoo;
level   = hslider("level", 0.6, 0, 1, 0.01);
gain    = hslider("gain", 0.4, 0, 2, 0.01);

fnom = freq : si.smooth(ba.tau2pole(max(0.0005, glide)));
t    = voxSince(gate);
fsrc = fnom * (1.0 + voxVib(vibrato, vibRise, t)*os.osc(vibRate));

xf(a, b, m) = a*(1.0 - m) + b*m;
sm(x) = x : si.smooth(ba.tau2pole(0.008));
rad = _ <: _, mem : -;
// *24: the lip radiation is a DIFFERENCE OF TWO SAMPLES, so at 130 Hz it costs
// the signal a factor of 2*sin(pi*f/SR) = 0.019 before anything else happens —
// which is not a mistake, it is what radiation does, and it is why every level
// downstream of a waveguide tract needs a large constant in front of it. Fitted
// against dsp/voice_lead.dsp through the same defaults: voice_lead peaks 0.39
// and this babbles at 0.33.
TRIM = 24.0;

// THE DRIVER IS EVALUATED ONCE, and it has to be written this way to be. Naming
// it (`b = ktBabble(...)`) and then reading `b : (_,!,!,!,!,!,!,!)` eight times
// re-evaluates the whole driver eight times at box level, and leaves the
// signal-level CSE to unify eight copies of a graph containing three recursions
// — while each of those copies is also being pushed into nineteen scattering
// junctions by the normalizer. Measured: 822 SECONDS to compile. Piping the
// driver into one eight-input block is byte-for-byte the same DSP and compiles
// in 14. The same trap is why every articulation below leaves through si.smooth:
// a one-pole is a barrier the normalizer will not push past, and without it the
// compiler asserts outright (mterm.cpp:533) on a tract whose areas are folded
// constants.
process = ktBabble(seed, rate, gate) : throat;

throat(b_tp, b_td, b_tl, b_lp, b_ve, b_tx, b_tb, b_vo) =
  ktTube(a_tp, a_td, a_tl, a_lp, a_ve, a_tx, hiss, src)
  : rad : fi.dcblocker
  : fi.lowpass(2, max(800.0, min(cutoff, 16000.0)))
  // ...AND THE GRIT (voice_tract.lib `voxGrit`, where the argument and the
  // numbers are): the singer's formant band lifted 2.5 dB at Q 1.6 and a soft
  // knee over it, the same stage voice_lead.dsp takes, so the two mouths are
  // grittier in the same way. 9.4 IS THE DRIVE AND IT IS THIS MODULE'S OWN:
  // the tube arrives here BEFORE `TRIM`, at about a fifth of the level a
  // normalized formant singer does, so the number that puts this signal on the
  // knee is not the number that puts that one there. Fitted so the peak comes
  // off by about 1.5 dB, which is a fold under more pressure; at voice_lead's
  // 1.9 this module limited outright and the talking records measured 4 dB
  // down on their own 200 Hz-1 kHz tone.
  : voxGrit(9.4)
  : *(voxEnv(attack, release, gate) * level * gain * TRIM)
with {
  a_tp = sm(xf(xf(ktVowTp(vowel), tongue,  artic), b_tp, babble));
  a_td = sm(xf(xf(ktVowTd(vowel), tongueD, artic), b_td, babble));
  a_tl = sm(xf(xf(ktVowTl(vowel), tongueL, artic), b_tl, babble));
  a_lp = sm(xf(xf(ktVowLp(vowel), lips,    artic), b_lp, babble));
  a_ve = sm(max(velum, b_ve*babble));
  a_tx = sm(xf(fricX, b_tx, babble));
  /* IT IS OKAY TO HAVE A CONTINUOUS TONE INSTEAD OF SIBILANCE (2026-09-02).
     Paul, in as many words: *"It's okay to have a continuous tone instead of
     sibilance."* The driver devoices outright on the two fricatives — tract.lib
     ktConVo is 0.00 for /s/ and /f/ — so the glottis switched off for the whole
     consonant and what came out was hiss with no voice under it, which at
     syllable rate is the ticking Paul heard as clicks between the words.
     `VOICEFLOOR` is a floor and not a table edit: the phonetic rows stay what
     they were measured to be, and what changes is that this instrument never
     lets the tone go all the way out. What it makes is a VOICED fricative —
     /z/ for /s/, /v/ for /f/ — which is a real consonant, and a mouth that
     hums through its own sibilants rather than stopping to hiss.
       IT IS SCALED BY `voiced`, so the whisper a genre can still ask for
     (mouth `voiced: 0`, documented on to-engine's mouthForInstr) is a whisper:
     a floor under a zero is zero. */
  VOICEFLOOR = 0.45;
  a_vo = max(VOICEFLOOR*voiced, xf(voiced, b_vo, babble));
  // TURBULENCE. Two shapings and one balance, all measured. The (1-dia)^2 term
  // is that a tighter constriction makes a faster jet; the min() takes it back
  // to nothing at a full closure, because a sealed tract has no flow to be
  // turbulent. 0.15 is the balance: lip radiation differentiates, so it hands
  // broadband hiss +6 dB/oct all the way to 5 kHz while a 130 Hz glottal pulse
  // is attenuated by the same slope — unscaled, an /s/ measured 28 dB over a
  // held /a/, which is a mouth that whispers louder than it sings. And it rides
  // a 1 ms smoother: fast enough to keep a release burst sharp, slow enough to
  // be the one-pole barrier the normalizer will not push into all nineteen
  // injection points.
  // ...AND 0.15 IS 0.09 SINCE 2026-09-02, for the sentence above: with the tone
  // now standing under every fricative, the hiss is a colour on a voice instead
  // of the whole of one, and at the old balance it simply sat on top of it. The
  // shape is untouched — this is one number, and it is the amount.
  turbG = max(fric, b_tb*babble) * ktSq(1.0 - a_td) * min(1.0, a_td*12.0 + 0.25) * 0.09
        : si.smooth(ba.tau2pole(0.001));
  // TURBULENCE IS NOT WHITE. Jet noise off an edge rolls off at both ends;
  // left flat, and then differentiated by the lip radiation, an /s/ measured a
  // 11.3 kHz centroid — a hiss with no place in it.
  hiss  = no.noise : fi.highpass(1, 600) : fi.lowpass(2, 4500) : *(turbG);
  src   = ktGlottis(fsrc, push, oq, breath) * a_vo;
};
