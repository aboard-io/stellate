// robot_choir — CLASSIC channel-vocoder alternative to csd-engine's pvsvoc
// "vocoder" model (pvstanal speech -> pvsvoc -> pvsynth). Here the speech
// modulator arrives as an AUDIO INPUT (offline: decoded found/vx_*.wav;
// live: an AudioBufferSourceNode piped into this node — no soundfile
// primitive needed), and the carrier imitates the csound one exactly:
// 3 detuned saws + quiet octave double. ve.vocoder is the one-liner:
//   ve.vocoder(nBands, att, rel, BWRatio, source, excitation)
// 32 resonbp bands + amp followers — arguably MORE period-authentic for the
// robot-choir genres than the phase-vocoder version.
declare name "robot_choir";
import("stdfaust.lib");

freq   = hslider("freq", 220, 50, 2000, 0.01) : si.smoo;
gate   = button("gate");
makeup = hslider("makeup", 5, 0, 12, 0.1);
level  = hslider("level", 0.8, 0, 2, 0.01);

carrier = (os.sawtooth(freq*0.996) + os.sawtooth(freq) + os.sawtooth(freq*1.004))*0.3
        + os.sawtooth(freq*2)*0.18;

env = en.asr(0.04, 1.0, 0.35, gate);

process(speech) = ma.tanh(ve.vocoder(32, 0.005, 0.025, 0.5, speech, carrier) * makeup) * 0.8 * env * level;
