// stab — imitation of csd-engine.js instr 6 (rave chord stab):
//   4 saws at ipch * 1 / 1.189 / 1.498 / 2.003  (minor-ish cluster + octave)
//   *0.25 -> moogladder(3200, 0.2) -> transeg(-5) decay
declare name "stab";
import("stdfaust.lib");

freq  = hslider("freq", 220, 40, 2000, 0.01);
gate  = button("gate");
decay = hslider("decay", 0.32, 0.05, 2, 0.01);
level = hslider("level", 1, 0, 2, 0.01);
gain  = hslider("gain", 0.2, 0, 2, 0.01);

chord = (os.sawtooth(freq) + os.sawtooth(freq*1.189)
       + os.sawtooth(freq*1.498) + os.sawtooth(freq*2.003)) * 0.25;

aenv = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(decay/5)));   // transeg -5, runs from note ON

process = chord : ve.moog_vcf_2bn(0.2, 3200) : *(aenv*level*gain);
