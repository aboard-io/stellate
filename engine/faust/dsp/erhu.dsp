// erhu — A BOWED STRING ON A MEMBRANE, WHICH IS THE WHOLE DIFFERENCE.
//
// WHY THIS FILE EXISTS. nukernel/genres.js has refused the `guoyue` cell for
// one reason and stated the price of admission in its own words: "EMPTY until
// the registry holds an erhu, a dizi, a pipa or a sheng". Every one of the
// eleven soundfonts in this tree is GM bank 0 — 128 presets, measured, with no
// Chinese instrument in any of them (GM 111 is the shehnai, 107 the koto, 106
// the shamisen, 104 the sitar) — so the registry cannot get one by sampling
// what it already has. It can only get one by MODELLING it, which is what this
// lane is for.
//
// EVERY STRUCTURAL FACT BELOW IS THE ZIM's, NOT A MEMORY (Wikipedia "Erhu",
// wikipedia_en_all_maxi_2026-02, the only evidence the offline law admits):
//
//   * "a small resonator body (sound box) which is covered with PYTHON SKIN on
//     the front (playing) end" and "the python skin is the primary
//     tone-producing surface of the instrument with either NO BACK or a
//     decorative one, but the violin has a SOUND POST that couples the top and
//     the back's vibrations". So the body here is ONE membrane and there is no
//     second radiator and no coupled cavity. A violin body model is a plate
//     over an air volume; this is a drumhead, and a drumhead's modes are the
//     zeros of a Bessel function — INHARMONIC, in ratios no plate has.
//   * "a small loop of string (qiān jīn) placed around the neck and strings
//     ACTING AS A NUT". The upper termination is a soft cord, not an ebony
//     nut: it is a LOWPASS rather than a leak — it takes the top off every
//     traversal and gives the rest back, which is why its coefficient is
//     higher than the bridge's and not lower.
//   * "Being a FRETLESS instrument, the player has fine control over tuning.
//     Techniques include hua yin (slides)". genres.js's own `cannot` names
//     exactly this as the thing the box could not say — "the erhu's continuous
//     portamento between the notes" — and a waveguide's pitch IS its delay
//     length, so the slide here is the string actually changing length.
//   * "The inside string … is generally tuned to D4 and the outside string to
//     A4, a fifth higher" and "The maximum range of the instrument is three and
//     a half octaves, from D4 up to A7". Those two numbers are the model's
//     floor and ceiling; nothing here plays below its own open string.
//   * "The horse hair bow is NEVER SEPARATED from the strings … it PASSES
//     BETWEEN them", and "the player PUSHES the bow away from the body when
//     bowing the A string (the outside string), and PULLS it inwards when
//     bowing the inside D string". So the bow direction is not a performance
//     choice, it is a function of which string the note is on — `outer` below
//     is derived from the note's own pitch and it flips `bowSign`.
//
// WHAT IS MEASURED HERE AND WHAT IS NOT, SAID OUT LOUD, because a physical
// model is exactly the kind of file that can pass for measured while being
// fitted by ear.
//   MEASURED, and gated in test/erhu.test.js: the tuning (0.0 cents D4-A6,
//   -1.0 at A7), the sustain, the body's fixedness under a moving note, the
//   level fit against stk_guitar, the velocity span, and the comparison
//   against pm.violinModel.
//   COMPUTED, not chosen: the six mode ratios, which are j(m,n)/j(0,1) for a
//   circular membrane. E1 recomputes them from the Bessel zeros and fails if
//   this file drifts, which is why the body cannot be quietly tuned into
//   something else's.
//   CHOSEN, and NOTHING in this tree or in the ZIM article can settle them —
//   there is no erhu recording anywhere here and the article has no acoustics
//   section: `skin` (the membrane's own fundamental, 1180 Hz), the six
//   resonators' relative gains and Qs, the two termination coefficients, the
//   0.22 direct-string leak past the body, and the rosin noise floor. Every
//   one of those is a slider or a named constant rather than a buried literal,
//   and `skin` in particular is on the unit so a recipe can move it. Paul's
//   ears are the backstop for all of them; nothing above claims otherwise.
declare name "erhu";
declare author "stellate (body, terminations, string selection); bow table from Faust physmodels.lib (Romain Michon, Julius Smith)";
declare licence "MIT";
declare reference "https://ccrma.stanford.edu/~jos/pasp/Bowed_Strings.html";
import("stdfaust.lib");

freq  = hslider("freq", 293.665, 40, 3600, 0.01);
gate  = button("gate");
// HUA YIN, the slide. Seconds to arrive at the written pitch. On a fretless
// spike fiddle this is not an effect, it is how the left hand gets anywhere:
// the delay line lengthens and the SAME sounding string bends. 0 = arrive
// instantly (si.smooth's pole is exactly 0 — bit-identical to no glide).
glide = hslider("glide", 0.045, 0, 0.5, 0.001);
// THE BOW, as the two things a bow arm actually does.
// force: how hard the hair is pressed into the string (velocity's home — a
//   loud erhu note is a DIFFERENT note, more rosin-grip, more upper partials,
//   not the same note louder).
// speed: how fast the arm travels. Together they are the whole right hand.
force = hslider("force", 0.88, 0.35, 1, 0.01) : si.smoo;
speed = hslider("speed", 0.22, 0.05, 1, 0.01) : si.smoo;
// WHERE THE HAIR SITS, AS A FRACTION OF THE STRING FROM THE BRIDGE — and
// FROM THE BRIDGE is the whole of it, because the ZIM says where the bow is:
// "the bow rests ON THE BARREL", and the barrel is the resonator at the foot
// of the instrument, under the bridge. Measured with this number read from the
// qian jin end instead — a bow 0.13 of the way DOWN from the nut, which no
// erhu has — the model came out with its fundamental 16 to 83 dB below its own
// loudest partial at every pitch, oscillating on the third and the fifth, and
// 88 cents sharp at A6. Read from the bridge it is within a cent at every
// pitch from D4 to A7 with the fundamental on top. One number, and it was the
// difference between an instrument and a spectrum.
bowPos = hslider("bowPos", 0.13, 0.04, 0.30, 0.005) : si.smoo;
// THE SKIN. The one choice in the file (see the header). Moving it is moving
// to a different instrument's box, not to a different EQ setting.
skin  = hslider("skin", 1180, 500, 2600, 1);
// QIN DIAN, the pad: "a piece of sponge, felt, or cloth placed between the
// strings and skin below the bridge to improve its sound". It damps the skin.
// 0 = no pad (the modes ring long and the note is raw); 1 = a thick felt.
pad   = hslider("pad", 0.42, 0, 1, 0.01);
level = hslider("level", 0.5, 0, 1, 0.01);
gain  = hslider("gain", 0.3, 0, 2, 0.01);
// the bow leaving the string. A bow lifts; it does not damp like a palm.
release = hslider("release", 0.14, 0.02, 1.5, 0.005);
// vibrato is ROU XIAN and it is a left-hand roll on a fretless string, so it
// moves the DELAY LENGTH like the slide does — not an amplitude tremolo.
vib     = hslider("vibrato", 0, 0, 0.05, 0.001);
vibRate = hslider("vibRate", 5.2, 0.1, 12, 0.01);

// ---- the sounding length ------------------------------------------------
// D4 is the instrument's floor (its own inside open string) and A7 its
// ceiling: the ZIM's "from D4 up to A7", which is where a stopping finger
// reaches the bow hair. Below D4 there is no string to stop.
D4 = 293.6648;                       // the inside (nèi xián) open string
A4 = 440.0;                          // the outside (wài xián) open string
A7 = 3520.0;
fClamp = max(D4, min(freq, A7));
sfreq  = fClamp : si.smooth(ba.tau2pole(max(glide, 0.0001)))
       : *(1.0 + vib*os.osc(vibRate));
// WHICH STRING. "the player's left hand in effect plays as if on one string",
// and which one is decided by the pitch: anything from A4 up is stopped on the
// outside string, anything under it on the inside string. This is not cosmetic
// — it sets the bow's DIRECTION (push for the outside, pull for the inside),
// which is the sign of the hair's velocity against the string.
outer   = sfreq >= A4;
bowSign = 2.0*outer - 1.0;           // +1 push (A string), -1 pull (D string)
// and how far up the string the finger is, which is how much of the string is
// left to ring: an open string is the whole length, a high note is a short
// stopped one, and a short stopped string loses more per traversal (the
// finger is FLESH, not a fret — there is nothing hard to reflect off).
openF  = ba.if(outer, A4, D4);
stopped = min(1.0, log(max(sfreq, openF)/openF)/log(4.0));   // 0 open .. 1 two octaves up

// ---- the string, as a bowed waveguide -----------------------------------
// One period of round trip, split at the bow: `dBrgI` samples of round trip
// DOWN to the bridge, `dNut` UP to the qian jin, dBrgI + dNut + 4 = P exactly.
// Each side carries its termination's LINEAR-PHASE loss filter, whose delay is
// exactly one sample at every frequency — the same reason stk_guitar.dsp
// beside this file is in tune to under a cent with no fitted correction term
// at all.
Pmax = 2048;                          // 293.6 Hz at 44.1k is 150 samples; the floor is the D string
P    = ma.SR/max(D4*0.5, sfreq);
// EACH SIDE IS CHARGED TWO SAMPLES FOR ITS OWN HARDWARE — one for its
// termination filter (a symmetric three-tap FIR: exactly one sample at every
// frequency) and one for the feedback wire Faust's `~` puts a unit delay on.
// So the bridge side's round trip is `floor(P*bowPos)` and its delay line is
// that minus 2; the nut side takes whatever is left of P after both. bowPos
// therefore still means exactly what it says, and the loop is exactly P.
// Measured before this accounting existed, D4 came out 25.1 CENTS FLAT — which
// is precisely two unpaid samples in a 150-sample period, and is the same
// class of bug the old hand-rolled guitar waveguide shipped for months.
// THE FRACTION LIVES ON ONE SIDE ONLY, and on the long one. A Lagrange
// interpolator's delay droops with frequency and two of them in a loop is
// twice the droop: with the fraction split across both, A5 came out 17.7 cents
// flat while D4 was exact — the error scales with how much of the period sits
// up at the top of the band. The bridge side is a whole number of samples
// (de.delay, no interpolation at all) and the nut side carries the remainder.
dBrgI = max(2.0, floor(P*bowPos) - 2.0);
dNut  = max(1.6, P - dBrgI - 4.0);

// TERMINATIONS, and they are the erhu's, not a violin's.
// The QIAN JIN is a loop of silk cord around the neck, and it is the QUIET end:
// it reflects almost everything back into the string (0.990) and only takes the
// top off, because a soft cord is a lowpass and not a leak. Where this
// instrument's energy actually goes is the other end, which is the next
// paragraph and is the whole difference.
nut(x)    = -0.990 * (0.62*x' + 0.19*(x + x''));
// THE BRIDGE SITS ON A DRUMHEAD. A violin's bridge stands on a stiff spruce
// plate braced by a sound post; this one stands on a stretched skin with an
// open box behind it, which is a far lighter, far lossier load — so LESS comes
// back into the string and MORE goes into the body. That single fact is why an
// erhu does not ring like a violin and why its body is so loud in its own
// sound. The pad (qin dian) sits right here and takes more still.
brgLoss   = 0.962 - 0.030*pad - 0.022*stopped;
bridge(x) = -brgLoss * (0.70*x' + 0.15*(x + x''));

// THE BOW. Faust physmodels.lib's own table, which is the STK/Smith friction
// curve: pow(|v|+0.75, -4), clipped at 1 — GRIP when the relative velocity is
// small (the hair carries the string along) and SLIP when it is large, and the
// alternation between the two is the Helmholtz motion. `force` sets the table's
// SLOPE, inversely: more force is a shallower slope, so the hair holds on over
// a wider band of relative velocity, which is what pressing in does.
slope    = 5.0 - 4.0*force;
bowVel   = bowSign * speed * en.asr(0.012, 1.0, release, gate);
// the noise floor of rosin on hair. A bow is not a clean velocity source — the
// hair is thousands of separate contacts and each one lets go on its own — and
// this is that, at -56 dB, scaled by force because pressing in scrapes more. It
// is a small deliberate imperfection, not a measured spectrum: no erhu
// recording exists anywhere in this tree to fit it against.
scrape   = no.noise * 0.0016 * force;

// two travelling waves meeting at the hair; the injection goes BOTH ways.
// THE TAP IS THE BRIDGE, AND ONLY THE BRIDGE. The bridge is the one place the
// string touches the skin, so it is the only thing that radiates — but the
// reason this line is not a matter of taste is measured: summing the two
// travelling waves instead put a comb between two taps 112 samples apart at
// D4, whose second null landed at 295 Hz, and the model came out with its
// FUNDAMENTAL MISSING and its third harmonic as the loudest thing in the note.
// That is the exact failure mode the old hand-rolled guitar waveguide shipped
// with (stk_guitar.dsp's header: "0.0% of the spectrum's energy inside a
// semitone of 82 Hz"), arrived at by a different road.
str = (cell ~ si.bus(2)) : !, _
with {
  cell(rn, rb) = wn, wb
  with {
    d   = (bowVel + scrape) - (rn + rb);
    inj = d * (d : pm.bowTable(0, slope));
    wn  = (rb + inj) : de.fdelay4(Pmax, dNut) : nut;
    wb  = (rn + inj) : de.delay(Pmax, dBrgI) : bridge;
  };
};

// ---- the body: a python skin, and nothing else --------------------------
// A CIRCULAR MEMBRANE'S MODES ARE THE ZEROS OF A BESSEL FUNCTION, so the ratios
// are 1, j(1,1)/j(0,1), j(2,1)/j(0,1), j(0,2)/j(0,1), … — not 1, 2, 3, and not
// a plate's either. They are computed, not chosen (test/erhu.test.js recomputes
// them from the Bessel zeros and fails on drift), which is the difference
// between a membrane and a bandpass somebody liked the sound of.
//   j(0,1)=2.404826  j(1,1)=3.831706  j(2,1)=5.135622  j(0,2)=5.520078
//   j(3,1)=6.380162  j(1,2)=7.015587
m1 = 1.000000; m2 = 1.593341; m3 = 2.135549;
m4 = 2.295417; m5 = 2.653066; m6 = 2.917295;
// the pad and the open back both eat Q. A drumhead is a heavily damped
// radiator — that is why it is loud and short rather than quiet and long.
q(k)  = k * (1.0 - 0.45*pad);
bodyM = _ <: fi.resonbp(skin*m1, q(9.0), 1.00),
             fi.resonbp(skin*m2, q(7.0), 0.72),
             fi.resonbp(skin*m3, q(6.0), 0.50),
             fi.resonbp(skin*m4, q(6.0), 0.42),
             fi.resonbp(skin*m5, q(5.0), 0.30),
             fi.resonbp(skin*m6, q(5.0), 0.22) :> _;
// NO SOUND POST, NO BACK, so no second body path: the direct string signal a
// violin gets through its coupled back does not exist here. What leaves the
// instrument is the bridge load into the skin, plus the small amount that
// radiates off the string itself. 0.22 is that string leak, and it is small on
// purpose — the ZIM: the skin "is the primary tone-producing surface".
body = _ <: *(0.22), (bodyM : *(1.55)) :> _;
// the skin is a thin stretched membrane over an OPEN box: nothing under it
// radiates, so the bottom goes. This is the same fact as "no back" said in the
// frequency domain.
skinHP = fi.highpass(2, 150);
// and rosin/hair noise above the skin's own reach is not a thing the box can
// project either.
skinLP(x) = fi.lowpass(2, min(14000.0, skin*8.0), x);

env = en.asr(0.012, 1.0, release, gate);
// LEVEL, AND WHY THERE ARE TWO NUMBERS. The body is six resonators summed, so
// the raw model runs about 300x hotter than the modules beside it: measured at
// A4 with the defaults, `str : body : skinHP : skinLP` comes back at 1.107 RMS
// with a peak of 3.056, against stk_guitar's 0.0039 / 0.0231 and stk_piano's
// 0.0037 / 0.0194 at THEIR defaults. The mix lane's per-model amps are fitted
// against that neighbourhood, so a module that arrives 300x hot is not louder,
// it is unmixable.
//   0.12 in front of the tanh is the SAFETY placement: at the defaults it puts
//   the peak around 0.37, where tanh is within a few percent of a straight
//   wire, so the shaper is doing nothing to the tone and is there only to catch
//   a transient that would otherwise leave the module above 1.
//   0.20 after it is the fader, and it is where `level` and `gain` land.
process = str : body : skinHP : skinLP : *(0.12) : ma.tanh
        : *(env*level*gain*0.20) : fi.dcblocker;
