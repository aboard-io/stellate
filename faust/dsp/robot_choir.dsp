// robot_choir — CLASSIC channel-vocoder replacement for csd-engine's pvsvoc
// "vocoder" model (pvstanal speech -> pvsvoc -> pvsynth). The speech modulator
// arrives as an AUDIO INPUT (offline: decoded found/ wav; live: an
// AudioBufferSourceNode piped into this node). Carrier imitates csound
// exactly: 3 detuned saws + quiet octave double; then the recipe's own
// moogladder(cutoff,res), matching instr 4's post-filter.
//   ve.vocoder(nBands, att, rel, BWRatio, source, excitation)
declare name "robot_choir";
import("stdfaust.lib");

freq   = hslider("freq", 220, 50, 2000, 0.01) : si.smoo;
gate   = button("gate");
cutoff = hslider("cutoff", 3400, 200, 14000, 1) : si.smoo;
res    = hslider("res", 0.05, 0, 0.95, 0.01);
makeup = hslider("makeup", 5, 0, 12, 0.1);
level  = hslider("level", 0.8, 0, 2, 0.01);
gain   = hslider("gain", 1, 0, 2, 0.01);

carrier = (os.sawtooth(freq*0.996) + os.sawtooth(freq) + os.sawtooth(freq*1.004))*0.3
        + os.sawtooth(freq*2)*0.18;

env = en.adsr(0.04, 0.06, 0.85, 0.30, gate);

process(speech) = ma.tanh(ve.vocoder(32, 0.005, 0.025, 0.5, speech, carrier) * makeup) * 0.8
                : ve.moog_vcf_2bn(res, max(30, min(cutoff, 16000))) : *(env*level*gain);
