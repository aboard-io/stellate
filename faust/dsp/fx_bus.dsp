// fx_bus — the shared FX sends, imitating csd-engine.js instr 99 (reverbsc)
// and instr 98 (feedback delay). TWO mono inputs:
//   in 0 = reverb send bus (gaRevL/R analogue)
//   in 1 = delay send bus  (gaDelL/R analogue)
// Stereo out is 100% wet; the dry paths are native WebAudio GainNode routes.
// A touch of delay feeds the reverb, like the csound delay tail washing.
declare name "fx_bus";
import("stdfaust.lib");

dtime = hslider("dtime", 0.375, 0.02, 1.5, 0.001);  // delay time (s) — dotted 8th at 120
dfb   = hslider("dfb", 0.35, 0, 0.9, 0.01);         // delay feedback
rgain = hslider("rgain", 1, 0, 2, 0.01);            // reverb return level
dgain = hslider("dgain", 0.8, 0, 2, 0.01);          // delay return level

// zita_rev1_stereo(rdel, f1, f2, t60dc, t60m, fsmax) — mid t60 ~2.6s, dark-ish top
process(revin, delin) = ((rin, rin : re.zita_rev1_stereo(40, 200, 5500, 3.2, 2.6, 48000)), (d, d)) :> _, _
with {
  d   = (delin : ef.echo(2.0, dtime, dfb)) * dgain;
  rin = (revin + d*0.25) * rgain;
};
