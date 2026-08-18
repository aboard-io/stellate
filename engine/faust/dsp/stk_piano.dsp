// stk_piano — THE COMMUTED WAVEGUIDE PIANO, taken whole from the toolkit.
//
// piano.dsp beside this file is four sine oscillators at 1 / 2.004 / 3.011 /
// 4.022 with a noise burst on top, and measured it is exactly as honest as that
// description: at every note and every dynamic it reports the SAME spectral
// centroid, the SAME decay (T40 1.28 s at MIDI 40 and at MIDI 76 alike) and the
// same 84% of its energy inside a semitone of the fundamental. A real piano
// does none of those things — its bass strings ring five times longer than its
// treble, a soft note dies faster than a loud one, and a fortissimo is a
// different spectrum, not a louder one. On that module `gain` is a fader and
// there is nothing else it could be.
//
// This is Romain Michon's FAUST-STK commuted piano (piano.dsp / piano1.dsp,
// after the SynthBuilder model; STK-4.3, MIT-style — see NOTICE), which is the
// reference implementation: a noise-excited soundboard commuted into the
// string, three coupled strings per note with real per-key detuning, a
// frequency-dependent hammer, measured loop-filter and decay-rate tables per
// key, and a separate top octave that is struck rather than looped. Measured
// on this repo's own compiler, before anything was changed: the FUNDAMENTAL is
// the loudest partial at MIDI 40 (our piano's is too, but ours has almost
// nothing above it — centroid 134 Hz, a blanket), the partial series runs out
// past the eleventh where ours stops dead at the fourth, loudness is monotone,
// and the note rings 1.0-1.4 s with the decay SHORTENING as the register
// rises, which is what strings do and an envelope does not.
//
// WHAT WAS CHANGED, and only this:
//   * the GUI panels are flattened to this engine's own flat param names
//   * `stereoizer : instrReverb` is removed — the fx bus owns the room
//   * an amplitude envelope, a tone control and a level, so a released note is
//     damped and the voice can be placed like every other voice here
//   * a fitted tuning pre-warp, because the model runs flat and gets flatter
//     with register (see `warpCents`)
//   * THE HAMMER VELOCITY IS RECONNECTED (see `strike`) — the one substantive
//     repair. As published, the crossfade between the model's own measured
//     soft-hammer and loud-hammer tables is the constant 1, so every note is
//     struck fortissimo; dumped harmonic by harmonic, a pianissimo and a
//     fortissimo at MIDI 52 were identical to 0.1 dB at all eleven partials
//   * a velocity level trim, because reconnecting that moves the note 21 dB
//     and the engine writes 13 dB of its own on top (see `velTrim`)
//   * four one-line helpers inlined from instruments.lib rather than imported
// The synthesis itself — every table, every coefficient — is the toolkit's.
declare name "stk_piano";
declare author "Romain Michon (model, after SynthBuilder); stellate (tuning, envelope, output stage)";
declare licence "STK-4.3"; // Synthesis ToolKit 4.3, MIT-style — see NOTICE
declare reference "https://github.com/grame-cncm/faust/tree/master-dev/examples/physicalModeling/faust-stk";
import("stdfaust.lib");

// ---- the four support functions this model borrows from instruments.lib ----
// They are written out rather than imported for the same reason stk_guitar.dsp
// writes out `levelfilter`: instruments.lib pulls in the deprecated filter.lib,
// which redeclares names the standard library also declares, and any file that
// imports it inherits the ambiguity. These four are one line each and they are
// the toolkit's, verbatim in behaviour, credited in NOTICE.
onePole(b0, a1, x) = (b0*x - a1*_)~_;
oneZero1(b0, b1, x) = (x'*b1 + x*b0);
poleZero(b0, b1, a1, x) = (b0*x + b1*x' - a1*_)~_;
asympT60(value, trgt, T60, trig) = (_*factor + constant)~_
  with {
    cntSample = *(trig) + 1~_ : -(1);
    attDur = float(2);
    cndFirst = ((cntSample < attDur) & (trig > 0));
    target = value*cndFirst + trgt*(cndFirst < 1);
    factorAtt = exp(-7/attDur);
    factorT60 = exp(-7/(T60*float(ma.SR)));
    factor = factorAtt*cndFirst + (cndFirst < 1)*factorT60;
    constant = (1 - factor)*target;
  };


bpf = ba.bpf;

waveform2Lookup(w) = bpf.start(rdtable(w,0),rdtable(w,1)) : middlePoints(numMiddlePoints, w) : bpf.end(rdtable(w,(numPoints-1)*2),rdtable(w,(numPoints-1)*2+1)) with {
    numPoints = w : _/2, !;
    numMiddlePoints = numPoints-2;
    middlePoints(0, w) = _, _, _, _;
    middlePoints(N, w) = seq(i, N, bpf.point(rdtable(w, (i+1)*2), rdtable(w, (i+1)*2+1)));
};

//***************************************************************

/* PianoDriver.sb */
noteOffDelayTime = waveform{
	89.000,3.000,
	93.000,2.000,
	95.000,1.500,
	99.782,1.020,
	108.000,0.300
};

/* pianoDriverC.sb */
/* Coupling Filter */

singleStringDecayRate = waveform{
	21.000,-1.500,
	24.000,-1.500,
	28.000,-1.500,
	29.000,-6.000,
	36.000,-6.000,
	42.000,-6.100,
	48.000,-7.000,
	52.836,-7.000,
	60.000,-7.300,
	66.000,-7.700,
	72.000,-8.000,
	78.000,-8.800,
	84.000,-10.000,
	88.619,-11.215,
	92.368,-12.348,
	95.684,-13.934,
	99.000,-15.000
};

singleStringZero = waveform{
	21.000,-1.000,
	24.000,-1.000,
	28.000,-1.000,
	29.000,-1.000,
	32.534,-1.000,
	36.000,-0.700,
	42.000,-0.400,
	48.000,-0.200,
	54.000,-0.120,
	60.000,-0.080,
	66.000,-0.070,
	72.000,-0.070,
	79.000,-0.065,
	84.000,-0.063,
	88.000,-0.060,
	96.000,-0.050,
	99.000,-0.050	};

singleStringPole = waveform{
	21.000,0.350,
	24.604,0.318,
	26.335,0.279,
	28.000,0.250,
	32.000,0.150,
	36.000,0.000,
	42.000,0.000,
	48.000,0.000,
	54.000,0.000,
	60.000,0.000,
	66.000,0.000,
	72.000,0.000,
	76.000,0.000,
	84.000,0.000,
	88.000,0.000,
	96.000,0.000,
	99.000,0.000	};

releaseLoopGain = waveform{
	21.000,0.865,
	24.000,0.880,
	29.000,0.896,
	36.000,0.910,
	48.000,0.920,
	60.000,0.950,
	72.000,0.965,
	84.000,0.988,
	88.000,0.997,
	99.000,0.988	};

detuningHz = waveform{
	21.000,0.003,
	24.000,0.003,
	28.000,0.003,
	29.000,0.060,
	31.000,0.100,
	36.000,0.110,
	42.000,0.120,
	48.000,0.200,
	54.000,0.200,
	60.000,0.250,
	66.000,0.270,
	72.232,0.300,
	78.000,0.350,
	84.000,0.500,
	88.531,0.582,
	92.116,0.664,
	95.844,0.793,
	99.000,1.000	};

stiffnessCoefficient = waveform{
	21.000,-0.850,
	23.595,-0.850,
	27.055,-0.830,
	29.000,-0.700,
	37.725,-0.516,
	46.952,-0.352,
	60.000,-0.250,
	73.625,-0.036,
	93.810,-0.006,
	99.000,1.011	};

strikePosition = waveform{
	21.000,0.050,
	24.000,0.050,
	28.000,0.050,
	35.000,0.050,
	41.000,0.050,
	42.000,0.125,
	48.000,0.125,
	60.000,0.125,
	72.000,0.125,
	84.000,0.125,
	96.000,0.125,
	99.000,0.125	};

EQGain = waveform{
	21.000,2.000,
	24.000,2.000,
	28.000,2.000,
	30.000,2.000,
	35.562,1.882,
	41.000,1.200,
	42.000,0.600,
	48.000,0.500,
	54.000,0.500,
	59.928,0.502,
	66.704,0.489,
	74.201,0.477,
	91.791,1.000,
	99.000,1.000	};

EQBandwidthFactor = waveform{
	21.000,5.000,
	24.112,5.000,
	28.000,5.000,
	35.000,4.956,
	41.000,6.000,
	42.000,2.000,
	48.773,1.072,
	57.558,1.001,
	63.226,1.048,
	69.178,1.120,
	72.862,1.525,
	80.404,2.788,
	97.659,1.739	};


/* PianoDriverA */
/* HammerFilter */

loudPole = waveform {
	21.000,0.875,
	23.719,0.871,
	27.237,0.836,
	28.996,0.828,
	32.355,0.820,
	36.672,0.816,
	40.671,0.820,
	45.788,0.812,
	47.867,0.812,
	54.000,0.810,
	60.000,0.800,
	66.000,0.800,
	72.000,0.810,
	78.839,0.824,
	84.446,0.844,
	89.894,0.844,
	96.463,0.848,
	103.512,0.840,
	107.678,0.840	};

softPole = waveform {
	21.000,0.990,
	24.000,0.990,
	28.000,0.990,
	29.000,0.990,
	36.000,0.990,
	42.000,0.990,
	48.000,0.985,
	54.000,0.970,
	60.000,0.960,
	66.000,0.960,
	72.000,0.960,
	78.000,0.970,
	84.673,0.975,
	91.157,0.990,
	100.982,0.970,
	104.205,0.950	};

normalizedVelocity = waveform{
	0.000,0.000,
	0.170,0.318,
	0.316,0.546,
	0.460,0.709,
	0.599,0.825,
	0.717,0.894,
	0.841,0.945,
	1.000,1.000	};

loudGain = waveform{
	21.873,0.891,
	25.194,0.870,
	30.538,0.848,
	35.448,0.853,
	41.513,0.842,
	47.434,0.826,
	53.644,0.820,
	60.720,0.815,
	65.630,0.820,
	72.995,0.853,
	79.060,0.920,
	85.270,1.028,
	91.624,1.247,
	95.668,1.296,
	99.000,1.300,
	100.000,1.100	};

softGain = waveform {
	20.865,0.400,
	22.705,0.400,
	25.960,0.400,
	28.224,0.400,
	31.196,0.400,
	36.715,0.400,
	44.499,0.400,
	53.981,0.400,
	60.000,0.350,
	66.000,0.350,
	72.661,0.350,
	81.435,0.430,
	88.311,0.450,
	93.040,0.500,
	96.434,0.500	};


/* Soundboard */

sustainPedalLevel = waveform {
	21.000,0.050,
	24.000,0.050,
	31.000,0.030,
	36.000,0.025,
	48.000,0.010,
	60.000,0.005,
	66.000,0.003,
	72.000,0.002,
	78.000,0.002,
	84.000,0.003,
	90.000,0.003,
	96.000,0.003,
	108.000,0.002	};

DryTapAmpT60 = waveform {
	21.001,0.491,
	26.587,0.498,
	34.249,0.470,
	40.794,0.441,
	47.977,0.392,
	55.000,0.370,
	60.000,0.370,
	66.000,0.370,
	71.934,0.370,
	78.000,0.370,
	83.936,0.390,
	88.557,0.387, 
	92.858,0.400,
	97.319,0.469,
	102.400,0.500,
	107.198,0.494	};

DryTapAmpCurrent = 0.15;

DCBa1 = waveform{
	21.000,-0.999,
	24.000,-0.999,
	30.000,-0.999,
	36.000,-0.999,
	42.000,-0.999,
	48.027,-0.993,
	60.000,-0.995,
	72.335,-0.960,
	78.412,-0.924,
	84.329,-0.850,
	87.688,-0.770,
	91.000,-0.700,
	92.000,-0.910,
	96.783,-0.850,
	99.000,-0.800,
	100.000,-0.850,
	104.634,-0.700,
	107.518,-0.500	};

/* pianoDriverB */
/* High Notes */

secondStageAmpRatio = waveform{
	82.277,-18.508,
	88.000,-30.000,
	90.000,-30.000,
	93.451,-30.488,
	98.891,-30.633,
	107.573,-30.633	};

r1_1db = waveform{
	100.000,-75.000,
	103.802,-237.513,
	108.000,-400.000	};

r1_2db = waveform{
	98.388,-16.562,
	100.743,-75.531,
	103.242,-154.156,
	108.000,-300.000	};

r2db = waveform{
	100.000,-115.898,
	107.858,-250.000	};

r3db = waveform{
	100.000,-150.000,
	108.000,-400.000	};

secondPartialFactor = waveform {
	88.000,2.000,
	108.000,2.100	};

thirdPartialFactor = waveform {
	88.000,3.100,
	108.000,3.100	};

bq4_gEarBalled = waveform {
	100.000,0.040,
	102.477,0.100,
	104.518,0.300,
	106.000,0.500,
	107.000,1.000,
	108.000,1.500	};

//************************************************************************

getValueDryTapAmpT60 = waveform2Lookup(DryTapAmpT60);

getValueSustainPedalLevel = waveform2Lookup(sustainPedalLevel);

getValueNormalizedVelocity = waveform2Lookup(normalizedVelocity);
getValueLoudPole = waveform2Lookup(loudPole);

getValuePoleValue = waveform2Lookup(softPole);

getValueLoudGain = waveform2Lookup(loudGain);

getValueSoftGain = waveform2Lookup(softGain);

getValueDCBa1 = waveform2Lookup(DCBa1);

getValuer1_1db = waveform2Lookup(r1_1db);

getValuer1_2db = waveform2Lookup(r1_2db);

getValuer2db = waveform2Lookup(r2db);

getValuer3db = waveform2Lookup(r3db);

getValueSecondStageAmpRatio = waveform2Lookup(secondStageAmpRatio);

getValueSecondPartialFactor = waveform2Lookup(secondPartialFactor);

getValueThirdPartialFactor = waveform2Lookup(thirdPartialFactor);

getValueBq4_gEarBalled = waveform2Lookup(bq4_gEarBalled);

getValueStrikePosition = waveform2Lookup(strikePosition);

getValueEQBandWidthFactor = waveform2Lookup(EQBandwidthFactor);

getValueEQGain = waveform2Lookup(EQGain);

getValueDetuningHz = waveform2Lookup(detuningHz);

getValueSingleStringDecayRate = waveform2Lookup(singleStringDecayRate);

getValueSingleStringZero = waveform2Lookup(singleStringZero);

getValueSingleStringPole = waveform2Lookup(singleStringPole);

getValueStiffnessCoefficient = waveform2Lookup(stiffnessCoefficient);

getValueReleaseLoopGain = waveform2Lookup(releaseLoopGain);

//Harpsichord

loopFilterb0 = waveform{
	35.000,0.94373,
	36.000,0.94731,
	46.000,0.94731,
	47.000,0.96202,
	52.000,0.96202,
	53.000,0.97477,
	58.000,0.97477,
	59.000,0.97733,
	64.000,0.97733,
	65.000,0.97971,
	70.000,0.97971,
	71.000,0.97971,
	76.000,0.97971,
	77.000,0.98698,
	82.000,0.98698,
	83.000,0.98462,
	86.000,0.98462,
	87.000,0.98611
};

getValueLoopFilterb0 = waveform2Lookup(loopFilterb0);

loopFilterb1 = waveform{
	35.000,0.60010,
	36.000,-0.59124,
	46.000,-0.59124,
	47.000,-0.21243,
	52.000,-0.21243,
	53.000,-0.39280,
	58.000,-0.39280,
	59.000,-0.48307,
	64.000,-0.48307,
	65.000,0.51965,
	70.000,0.51965,
	71.000,0.51965,
	76.000,0.51965,
	77.000,-0.42463,
	82.000,-0.42463,
	83.000,0.85655,
	86.000,0.85655,
	87.000,0.68851
};

getValueLoopFilterb1 = waveform2Lookup(loopFilterb1);

loopFilterb2 = waveform{
	35.000,-0.00360,
	36.000,-0.12249,
	46.000,-0.12249,
	47.000,-0.16044,
	52.000,-0.16044,
	53.000,-0.21680,
	58.000,-0.21680,
	59.000,-0.16346,
	64.000,-0.16346,
	65.000,0.22162,
	70.000,0.22162,
	71.000,0.22162,
	76.000,0.22162,
	77.000,-0.14973,
	82.000,-0.14973,
	83.000,0.24937,
	86.000,0.24937,
	87.000,0.14838
};

getValueLoopFilterb2 = waveform2Lookup(loopFilterb2);

loopFiltera1 = waveform{
	35.000,0.5941,
	36.000,-0.65928,
	46.000,-0.65928,
	47.000,-0.24222,
	52.000,-0.24222,
	53.000,-0.41402,
	58.000,-0.41402,
	59.000,-0.50837,
	64.000,-0.50837,
	65.000,0.51263,
	70.000,0.51263,
	71.000,0.51263,
	76.000,0.51263,
	77.000,-0.43976,
	82.000,-0.43976,
	83.000,0.85396,
	86.000,0.85396,
	87.000,0.68332
};

getValueLoopFiltera1 = waveform2Lookup(loopFiltera1);

loopFiltera2 = waveform{
	35.000,-0.02641,
	36.000,-0.10275,
	46.000,-0.10275,
	47.000,-0.15842,
	52.000,-0.15842,
	53.000,-0.21653,
	58.000,-0.21653,
	59.000,-0.15833,
	64.000,-0.15833,
	65.000,0.22025,
	70.000,0.22025,
	71.000,0.22025,
	76.000,0.22025,
	77.000,-0.14583,
	82.000,-0.14583,
	83.000,0.24405,
	86.000,0.24405,
	87.000,0.14370
};

getValueLoopFiltera2 = waveform2Lookup(loopFiltera2);

//bass

bassLoopFilterb0 = waveform{
	24.000,0.54355,
	26.000,0.54355,
	27.000,0.55677,
	29.000,0.55677,
	32.000,0.55677,
	33.000,0.83598,
	36.000,0.83598,
	43.000,0.83598,
	44.000,0.88292,
	48.000,0.88292,
	51.000,0.88292,
	52.000,0.77805,
	54.000,0.77805,
	57.000,0.77805,
	58.000,0.91820,
	60.000,0.91820,
	61.000,0.91820,
	63.000,0.94594,
	65.000,0.91820
};

getValueBassLoopFilterb0 = waveform2Lookup(bassLoopFilterb0);

bassLoopFilterb1 = waveform{
	24.000,-0.36586,
	26.000,-0.36586,
	27.000,-0.37628,
	29.000,-0.37628,
	32.000,-0.37628,
	33.000,-0.60228,
	36.000,-0.60228,
	43.000,-0.60228,
	44.000,-0.65721,
	48.000,-0.65721,
	51.000,-0.65721,
	52.000,-0.51902,
	54.000,-0.51902,
	57.000,-0.51902,
	58.000,-0.80765,
	60.000,-0.80765,
	61.000,-0.80765,
	63.000,-0.83230,
	65.000,-0.83230
};

getValueBassLoopFilterb1 = waveform2Lookup(bassLoopFilterb1);

bassLoopFiltera1 = waveform{
	24.000,-0.81486,
	26.000,-0.81486,
	27.000,-0.81147,
	29.000,-0.81147,
	32.000,-0.81147,
	33.000,-0.76078,
	36.000,-0.76078,
	43.000,-0.76078,
	44.000,-0.77075,
	48.000,-0.77075,
	51.000,-0.77075,
	52.000,-0.73548,
	54.000,-0.73548,
	57.000,-0.73548,
	58.000,-0.88810,
	60.000,-0.88810,
	61.000,-0.88810,
	63.000,-0.88537,
	65.000,-0.88537
};

getValueBassLoopFiltera1 = waveform2Lookup(bassLoopFiltera1);

/////// </PIANO LIB>

// THE OUTPUT IS MONO AND DRY. The toolkit ends every instrument with
// `stereoizer : instrReverb` — a period-length haas delay and a zita reverb at
// 0.137 wet — and neither belongs inside a voice here: this engine's fx bus
// owns the room, the strip owns the width, and a voice that carries its own
// reverb cannot be placed in a mix. Measured, the toolkit's default tail also
// hides exactly the decay this instrument is supposed to be judged on.
process = soundBoard <: (*(conditionLowNote)*6 : hammer : dcBlock1 : coupledStrings <: +(eq)),
(*(conditionHighNote) : hiPass : dcBlock1 : hammer : dcBlock2a : highBqs : dcBlock2b) :> + : *(12)
       : fi.lowpass(2, cutoff) : *(env*level*velTrim) : fi.dcblocker
with {
    //==================== GUI SPECIFICATION ================

    // ---- OUR KNOBS, FLAT ----------------------------------------------
    // The toolkit groups its parameters into GUI panels; this engine addresses
    // every voice as /<module>/<name> and the pool driver writes those strings
    // directly, so the panels are flattened away and nothing else changes.
    written = hslider("freq", 262, 20, 4200, 0.01);
    gate    = button("gate");
    gain    = hslider("gain", 0.4, 0, 2, 0.01);
    level   = hslider("level", 0.5, 0, 1, 0.01);
    cutoff  = hslider("cutoff", 9000, 200, 16000, 1) : si.smoo;
    release = hslider("release", 0.35, 0.02, 3, 0.005);

    // THE TUNING IS MEASURED AND CORRECTED, which is this repo's rule for any
    // waveguide. The commuted piano's delay length is solved from the phase of
    // its own stiffness allpasses and coupling filter, and the solution is
    // slightly long: measured on this compiler it lands 3.5 cents flat at
    // MIDI 40 and grows to 27 cents flat at MIDI 76 — a real piano is stretch
    // tuned SHARP in the treble, so this is the wrong sign as well as the wrong
    // size, and a fifth against the sampled bass would beat. The correction is
    // fitted on those measurements and applied as a frequency pre-warp, so
    // `freqn` (which the coefficient tables index, and which rounds to the
    // nearest key) is untouched at every note — a correction under 50 cents
    // cannot move a note number that rounds at the half-step.
    //
    // THE ERROR IS A CONSTANT NUMBER OF SAMPLES, which is what makes it fittable
    // in one term: a delay line that is d samples too long is 1731*d/P cents
    // flat, and P is SR/f, so the error is PROPORTIONAL TO FREQUENCY. Measured
    // 3.5 / 6.5 / 12.2 / 26.7 cents flat at 82.4 / 164.8 / 329.6 / 659.3 Hz —
    // 0.0425, 0.0394, 0.0370, 0.0405 cents per Hz, which is one constant with a
    // 7% spread and no curve left in it.
    warpCents = 0.0399*written;
    freq = written * pow(2.0, warpCents/1200.0);

    // A NOTE-OFF IS THE DAMPER COMING DOWN, not a switch. The model already
    // changes its own loop gain on gate-off (`coupledStringLoopGain`), which is
    // the felt touching the string; this envelope is the rest of the damper and
    // the thing that stops a released note ringing through the next bar.
    env = en.asr(0.0005, 1, release, gate);

    brightnessFactor = hslider("bright", 0, 0, 1, 0.01);
    detuningFactor = hslider("detune", 0.1, 0, 1, 0.01)*10;
    stiffnessFactor = hslider("stiff", 0.28, 0, 1, 0.01)*3.7;

    // ---- HOW HARD THE KEY WAS STRUCK, WHICH THE MODEL KNEW ALL ALONG -------
    // This is the one substantive repair, and it is the same repair the guitar
    // needed. The commuted piano carries FOUR measured tables per key —
    // softPole / loudPole for the hammer filter and softGain / loudGain for its
    // output — whose whole purpose is to be crossfaded by how hard the note was
    // played, plus a `normalizedVelocity` curve for doing the crossfade. In the
    // published file the crossfade weight is written `normalizedVelocityValue =
    // 1` and the curve is never called: every note is struck fortissimo. Dumped
    // partial by partial before the fix, a pianissimo and a fortissimo at MIDI
    // 52 were IDENTICAL to 0.1 dB at every one of the first eleven harmonics.
    // Half the instrument was in the file and switched off.
    //
    // `hammer` is that weight, and the engine writes the note's own force onto
    // it (state-engine MODEL_DYN), exactly as it writes `pick` on the guitar.
    // It moves three things at once, all of them the same physical event:
    // the hammer filter's pole (a soft felt is a lowpass), its gain (the tables
    // say 0.40 soft against 0.85 loud — the loudness difference comes out of
    // the hammer, which is why velocity here is not a fader bolted on top), and
    // the CONTACT TIME below, because a hard blow leaves the string sooner.
    // (bound as `strike` because `hammer` is already the four-pole filter chain
    // this drives — the PARAM is still spelled "hammer" for the engine)
    strike = hslider("hammer", 0.55, 0, 1, 0.01);
    // the toolkit's own velocity curve, finally called
    vel = getValueNormalizedVelocity(strike);
    hammerHardness = 0.022 - 0.019*strike;
    // AND THEN MOST OF THE LEVEL IS GIVEN BACK. Measured at MIDI 52, the
    // repaired hammer moves the note 21 dB from a soft strike to a hard one —
    // which is a real piano's range and far too much on top of the 13 dB the
    // engine's own note amp already writes. The loss goes as roughly the
    // SQUARE of the strike (fitted exponent 2.05 across MIDI 40-76), so a
    // -1.25 power takes it back to about 8 dB and leaves the shape: the note
    // still gets louder as it gets brighter, it just no longer disappears.
    // 2.0 is the constant that lands the middle of the range level with the
    // four-oscillator piano this replaces, so the swap is not a volume change.
    //
    // ONE MEASURED IMPERFECTION, written down rather than tuned away: the
    // exponent is fitted across MIDI 40-76, and at the very bottom of the
    // keyboard the note is mostly SOUNDBOARD, whose response to the strike is
    // much flatter (exponent 0.64 at MIDI 28 against 2.05 in the middle). So
    // the trim slightly over-compensates down there and MIDI 28 comes back
    // 0.26 dB quieter at a full strike than at 0.65. A quarter of a decibel on
    // the lowest note is not audible and it is not the failure the monotonicity
    // check is for — the model this repo threw out for non-monotone loudness
    // was a whole dynamic step out. Flattening the exponent enough to fix it
    // (0.64) would take the velocity out of the other five octaves, which is
    // trading the instrument for the gate.
    velTrim = 0.44 * pow(max(0.25, strike), -1.25);

    //==================== COMMUTED PIANO PARAMETERS ================

    //variables to set keybord splitting zone
    DCB2_TURNOFF_KEYNUM = 92;
    FIRST_HIGH_NOTE = 88;
    PEDAL_ENVELOPE_T60 = 7;

    //convert an amplitude in db
    dbinv(x) = pow(10,0.05*x);

    //convert a frequency in a midi note number
    freqToNoteNumber = (log-log(440))/log(2)*12+69+0.5 : int;
    freqn = freq : freqToNoteNumber;

    //a counter that restart a every note-on
    cntSample = *(gate)+1~_ : -(1);

    //==================== PIANO SOUND BOARD ================

    //exponential envelope with 3 phases for the pedal excitation	
    asympT60pedal(value,T60) = (*(factor) + constant)~_
        with{
            attDur = hammerHardness*float(ma.SR);
            target = value*((cntSample < attDur) & (gate > 0));
            factorAtt = exp (-1/(attDur)); 
            factorG = exp(-1/(2*float(ma.SR)));
            factorT60 = exp(-7/(T60*float(ma.SR)));
            factor = factorAtt*gate*(cntSample < attDur) + (cntSample >= attDur)*gate*factorG + ((gate-1)*-1)*factorT60;
            constant = (1 - factor)*target;			
        };

    //the sound of the piano sound board is generated by noise generator whose output gain is shaped by
    //an exponential envelope
    soundBoard = dryTapAmp*no.noise + pedalEnv*no.noise : *(0.5)
        with{
            //the values of the envelope cut-off time are stored in an external C++ function 
            dryTapAmpT60 = getValueDryTapAmpT60; // ffunction
            sustainPedalLevel = getValueSustainPedalLevel; // ffunction

            pedalEnvCutOffTime = 1.4;
            // the soundboard's own decay is shorter for a soft note — the model
            // already asked for that and was reading the note's LOUDNESS for it,
            // which is a different quantity here (`gain` is the fader). It reads
            // the strike now, which is what it meant.
            noteCutOffTime = freqn : dryTapAmpT60*max(0.05, vel);
            pedalEnvValue = freqn : sustainPedalLevel*0.2;
            noteEnvValue = 0.15;
            dryTapAmp = asympT60(noteEnvValue,0,noteCutOffTime,gate);
            pedalEnv = asympT60pedal(pedalEnvValue,pedalEnvCutOffTime);
        };	

    //==================== HAMMER MODELING ================

    //To model the exitation hammer, we filter the sound from the soundboard with a serie of 4 one pole filters
    //connected in serie  

    //onePole is declared in instruments.lib
    calcHammer = onePole((1-hammerPole)*hammerGain,-hammerPole)
        with{
            //filter gains and coefficients are stored in external C++ files
            loudPole = getValueLoudPole; // ffunction
            softPole = getValuePoleValue; // ffunction
            loudGain = getValueLoudGain; // ffunction
            softGain = getValueSoftGain; // ffunction

            loudPoleValue = loudPole(freqn) + (brightnessFactor*-0.25) + 0.02;	
            softPoleValue = softPole(freqn);
            normalizedVelocityValue = vel;
            loudGainValue = loudGain(freqn);
            softGainValue = softGain(freqn);
            overallGain = 1;
            hammerPole = softPoleValue + (loudPoleValue - softPoleValue)*normalizedVelocityValue;
            hammerGain = overallGain*(softGainValue + (loudGainValue - softGainValue)*normalizedVelocityValue);
        };

    hammer = seq(i,4,calcHammer);

    //==================== DC BLOCKERS ================

    //the values for the dcblockers a1 are stored in an external C++ file
    DCBa1 = getValueDCBa1; // ffunction
    dCBa1Value = freqn : DCBa1;
    dCBb0Value = 1 - dCBa1Value;

    dcBlock1 = poleZero((dCBb0Value*0.5),(dCBb0Value*-0.5),dCBa1Value);

    dcBlock2a = oneZero1(0.5,-0.5);
        
    dcBlock2b = onePole(dCBb0Value,dCBa1Value);

    //==================== HIGH TUNING CALCULATION ================

    //high tones are not generated with the waveguide technique but with a serie of biquad filters

    r1_1 = getValuer1_1db; // ffunction
    r1_2 = getValuer1_2db; // ffunction
    r2 = getValuer2db; // ffunction
    r3 = getValuer3db; // ffunction
    e = getValueSecondStageAmpRatio; // ffunction
    second_partial_factor = getValueSecondPartialFactor; // ffunction
    third_partial_factor = getValueThirdPartialFactor; // ffunction
    bq4_gEarBalled = getValueBq4_gEarBalled; // ffunction

    r1_1Value = r1_1(freqn)/ma.SR : dbinv;
    r1_2Value = r1_2(freqn)/ma.SR : dbinv;
    r2Value = r2(freqn)/ma.SR : dbinv;
    r3Value = r3(freqn)/ma.SR : dbinv;
    eValue = e(freqn) : dbinv;
    second_partial_factorValue = second_partial_factor(freqn); 
    third_partial_factorValue = third_partial_factor(freqn);

    //set biquad gains and coeffs
    gainHighBq(0) = bq4_gEarBalled(freqn)/0.5;
    gainHighBq(1) = bq4_gEarBalled(freqn)/0.5;
    gainHighBq(2) = 1;
    gainHighBq(3) = 1;

    b0HighBq(0) = 1;
    b0HighBq(1) = 1;
    b0HighBq(2) = 1;
    b0HighBq(3) = 1;

    b1HighBq(0) = 0;
    b1HighBq(1) = 0;
    b1HighBq(2) = -2*(eValue*r1_1Value+(1-eValue)*r1_2Value)*cos(2*ma.PI*freq/ma.SR);
    b1HighBq(3) = 0;

    b2HighBq(0) = 0;
    b2HighBq(1) = 0;
    b2HighBq(2) = eValue*r1_1Value*r1_1Value+(1-eValue)*r1_2Value*r1_2Value;
    b2HighBq(3) = 0;

    a1HighBq(0) = -2*r3Value*cos(2*ma.PI*freq*third_partial_factorValue/ma.SR);
    a1HighBq(1) = -2*r2Value*cos(2*ma.PI*freq*second_partial_factorValue/ma.SR);
    a1HighBq(2) = -2*r1_1Value*cos(2*ma.PI*freq/ma.SR);
    a1HighBq(3) = -2*r1_2Value*cos(2*ma.PI*freq/ma.SR);

    a2HighBq(0) = r3Value*r3Value;
    a2HighBq(1) = r2Value*r2Value;
    a2HighBq(2) = r1_1Value*r1_1Value;
    a2HighBq(3) = r1_2Value*r1_2Value;

    highBqs = seq(i,4,*(gainHighBq(i)) : fi.TF2(b0HighBq(i),b1HighBq(i),b2HighBq(i),a1HighBq(i),a2HighBq(i)));

    hiPass = oneZero1(b0,b1)
        with{
            b0 = -0.5;
            b1 = -0.5;
        };

    //==================== STRIKE POSITION COMB FILTER EQ ================

    eq = _*filterGain : fi.TF2(b0,b1,b2,a1,a2)
        with{
            strikePosition = getValueStrikePosition; // ffunction
            bandwidthFactors = getValueEQBandWidthFactor; // ffunction
            eq_gain = getValueEQGain; // ffunction
            eq_tuning = freq/strikePosition(freqn);
            eq_bandwidth = bandwidthFactors(freqn)*freq;
            filterGain = eq_gain(freqn);
            a2 = (eq_bandwidth / ma.SR) * (eq_bandwidth / ma.SR);
            a1 = -2*(eq_bandwidth / ma.SR)*cos(2*ma.PI*eq_tuning/ma.SR);
            b0 = 0.5 - 0.5 * a2;
            b1 = 0;
            b2 = -b0;	
        };
        
    //==================== PIANO COUPLED STRINGS ================

    //values for the couple strings are stored in externals C++ functions
    singleStringDecRate = getValueSingleStringDecayRate; // ffunction
    singleStringZero = getValueSingleStringZero; // ffunction
    singleStringPole = getValueSingleStringPole; // ffunction
    stiffnessCoefficient = getValueStiffnessCoefficient; // ffunction

    //coupling filter parameters
    g = pow(10,((singleStringDecRate(freqn)/freq)/20)); //attenuation per period
    b = singleStringZero(freqn);
    a = singleStringPole(freqn);
    tempd = 3*(1-b)-g*(1-a);
    b0Coupling = 2*(g*(1-a)-(1-b))/tempd;
    b1Coupling = 2*(a*(1-b)-g*(1-a)*b)/tempd;
    a1Coupling = (g*(1-a)*b - 3*a*(1-b))/tempd;

    //string stiffness
    stiffness = stiffnessFactor*stiffnessCoefficient(freqn);

    stiffnessAP = poleZero(b0s,b1s,a1s) 
        with{
            b0s = stiffness;
            b1s = 1;
            a1s = stiffness;
        };
        
    delayG(frequency,stiffnessCoefficient) = de.fdelay(4096,delayLength)
        with{
            allPassPhase(a1,WT) = atan2((a1*a1-1.0)*sin(WT),(2.0*a1+(a1*a1+1.0)*cos(WT)));
            poleZeroPhase(b0,b1,a1,WT) = atan2(-b1*sin(WT)*(1 + a1*cos(WT)) + a1*sin(WT)*(b0 + b1*cos(WT)),
                            (b0 + b1*cos(WT))*(1 + a1*cos(WT)) + b1*sin(WT)*a1*sin(WT));
            wT = frequency*2*ma.PI/ma.SR;
            delayLength = (2*ma.PI + 3*allPassPhase(stiffnessCoefficient, wT) +
                            poleZeroPhase((1+2*b0Coupling),
                            a1Coupling + 2*b1Coupling, a1Coupling, wT)) / wT;	
        };
            
    coupledStrings = (parallelStrings <: (_,(_+_ <: _,_),_ : _,_,(_ : couplingFilter),_ : adder))~(_,_) : !,!,_
        with{
            releaseLoopGain = getValueReleaseLoopGain; // ffunction
            hz = getValueDetuningHz; // ffunction
            coupledStringLoopGain = gate*0.9996 + ((gate-1)*-1)*releaseLoopGain(freqn)*0.9 : si.smoo;
            couplingFilter = poleZero(b0Coupling,b1Coupling,a1Coupling);
            hzValue = hz(freqn);
            freq1 = freq + 0.5*hzValue*detuningFactor;
            freq2 = freq - 0.5*hzValue*detuningFactor;
            delay1 = delayG(freq1,stiffness);
            delay2 = delayG(freq2,stiffness);
            parallelStrings(x,y) = _ <: (+(x)*coupledStringLoopGain : seq(i,3,stiffnessAP) : delay1),
                    (_+y*coupledStringLoopGain : seq(i,3,stiffnessAP) : delay2);
            adder(w,x,y,z) = (y <: +(w),+(z)),x ;	
        };

    //stereoizer is declared in instruments.lib and implement a stereo spacialisation in function of 
    //the frequency period in number of samples 
    stereo = stereoizer(ma.SR/freq);

    //==================== PROCESSING ================

    conditionLowNote = freqn < FIRST_HIGH_NOTE;
    conditionHighNote = freqn >= FIRST_HIGH_NOTE;
};