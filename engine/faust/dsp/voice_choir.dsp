// voice_choir — SEVERAL PEOPLE SINGING THE SAME NOTE, WHICH IS NOT ONE PERSON
// SINGING IT LOUDER. Four singers over two throats (dsp/voice_tract.lib), the
// same tract the lead beside it is seated at.
//
// This project has learned once already what happens when a "doubled" voice is
// two identical copies: it measured 8.5 dB over its own line and was still one
// voice. A choir is a choir because no two of them agree, and the disagreement
// IS the instrument. Three things are deliberately out of step here:
//
//   PITCH    the four are detuned in cents (`spread`), so they beat.
//   VIBRATO  four rates and four depths, free-running and never reset by the
//            gate — so the wobbles drift in and out of phase with each other
//            forever instead of locking into one wide vibrato.
//   ENTRY    `drift` staggers the second throat's whole gate by up to 52 ms and
//            lengthens its attack, which is a section coming in ragged. Its own
//            clock starts with its own gate, so the late pair swells late too.
//   ...and then they are PLACED at opposite ends of the field (`width`), so all
//            of that arrives as a width and not as a tremolo.
//
// MEASURED, four identical singers against the four as built, 220 Hz, alto,
// 'a', a fresh module each time: L/R correlation 1.000 -> 0.235, and the 50 ms
// envelope stops sitting still (0.5% -> 13.6% wander). The locked stack is also
// 0.7 dB LOUDER than the choir, which is the whole point said as a number —
// identical voices sum coherently and that is all they do.
//
// TWO THROATS AND FOUR VOICES, not four throats: a tract is 15 interpolated
// formant tables and five resonant bandpasses, and four of them measured 1.37x
// the cost of two for a fourth mouth nobody could pick out of the other three.
// The pair inside one throat share a mouth and differ in pitch and wobble,
// which is what two people in the same section actually do.
//
// AND THE TWO THROATS SHARE A VOWEL, which was measured rather than assumed.
// They were 0.22 of a vowel apart for a day, on the theory that a section does
// not agree on the vowel either. It moved the two numbers above by 0.02 and
// 0.1 of a point — nothing an ear could find — and cost 1.8x the whole module
// (6.9 pad_saws against 3.8), because two vowel SIGNALS mean two independent
// walks through the formant tables and one vowel lets the compiler do that walk
// once for both throats. A section is singing the same word; the disagreement
// that is audible is when they come in and where they are standing.
declare name "voice_choir";
import("stdfaust.lib");
import("voice_tract.lib");

freq    = hslider("freq", 220, 50, 1200, 0.01);
gate    = button("gate");
voice   = hslider("voice", 0, 0, 4, 1);          // 0 alto 1 bass 2 countertenor 3 soprano 4 tenor
vowel   = hslider("vowel", 0, 0, 4, 0.01) : si.smooth(ba.tau2pole(0.06));
push    = hslider("push", 0.3, 0, 1, 0.01) : si.smoo;
breath  = hslider("breath", 0.08, 0, 0.6, 0.001) : si.smoo;
spread  = hslider("spread", 1, 0, 2, 0.01);      // how far out of tune with each other
drift   = hslider("drift", 1, 0, 1.5, 0.01);     // how late the second pair is
vibrato = hslider("vibrato", 0.008, 0, 0.04, 0.0001);
attack  = hslider("attack", 0.3, 0.01, 3, 0.001);
release = hslider("release", 0.7, 0.02, 4, 0.001);
cutoff  = hslider("cutoff", 4500, 800, 16000, 1) : si.smoo;
width   = hslider("width", 0.8, 0, 1, 0.01);
level   = hslider("level", 0.6, 0, 1, 0.01);
gain    = hslider("gain", 0.4, 0, 2, 0.01);

// the four singers: cents off centre, vibrato rate, vibrato depth
CENT = (-7.5, 5.0, -3.0, 9.0);
VHZ  = (4.4, 5.9, 5.2, 6.6);
VMUL = (1.00, 0.72, 0.88, 1.15);
// the two throats: gate stagger (seconds), attack multiplier, pan
DLY  = (0.0, 0.052);
AMUL = (1.0, 1.45);
PAN  = (-1.0, 1.0);

fnom  = freq;
// one singer's source: detuned, wobbling on their own clock. `t` is that
// throat's own time since ITS gate, so the pair that comes in late also swells
// its vibrato late.
// (the detune is 2^(c/1200) written as its own tangent, 1 + c*ln2/1200. Over
// the +-18 cents this reaches, the two agree to better than a thousandth of a
// cent, and pow() four times a sample measured 2.7x the cost of the whole
// module for a difference no instrument has.)
singer(i, t) = os.sawtooth(fnom * (1.0 + ba.take(i+1,CENT)*spread*0.00057762)
                              * (1.0 + voxVib(vibrato*ba.take(i+1,VMUL), 0.5 + 0.25*i, t)
                                       * os.osc(ba.take(i+1,VHZ))));

// one throat: two singers into one mouth, on that mouth's own entry
throat(j) = voxTract(voice, vowel, breath, fnom,
                     (singer(2*j, tj) + singer(2*j+1, tj))*0.5 : voxTilt(push), gj)
            : *(voxEnv(attack*ba.take(j+1,AMUL), release, gj))
with {
  gj = gate : de.delay(8192, int(ba.take(j+1,DLY)*drift*ma.SR));
  tj = voxSince(gj);
};

// placed, then summed. *1.4 is the same kind of fitted constant the lead
// carries, A/B'd against the sampled `ahh_choir` zone over the same chords at
// the same recipe level through the same master chain; the pair's own 1/sqrt(2)
// is inside it. Four singers of a chord ARE louder than one recording of it,
// which is why this number is a quarter of the soloist's.
place(j) = _ <: *(1.0 - p), *(p) with { p = (ba.take(j+1,PAN)*width + 1.0)/2.0; };
process = (throat(0) : place(0)), (throat(1) : place(1))
        :> par(i, 2, *(level*gain*1.4)
                   : fi.lowpass(2, max(800.0, min(cutoff, 16000.0)))
                   : fi.dcblocker);
