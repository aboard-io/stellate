// rev_bleed — the fx_bus delay->reverb + pingpong->reverb BLEED, tapped out so
// it can feed an EXTERNAL reverb-color node (dsp/reverb_*). fx_bus mixes
// `rin = rev + d*bleed + (ppl+ppr)*0.12` into its INTERNAL zita, but that zita is
// muted (rgain->0) whenever a genre selects a reverbColor — so colored genres
// used to lose the echo-tail-into-reverb glue. This module recomputes EXACTLY
// that bleed term (same delay/pingpong DSP + coefficients as fx_bus) from the
// del/pp send buses, so press/live can add it to the color node's input.
//   Inputs: 0 delay send, 1 ping-pong send.  Output: d*bleed + (ppl+ppr)*0.12.
// The delay/pingpong params MIRROR fx_bus (dtime/dfb/dcut/dgain, pptime/ppfb/
// pptone); the caller sets them from the same SE.fxParams values. fx_bus itself
// is untouched (uncolored genres byte-identical).
declare name "rev_bleed";
import("stdfaust.lib");

// delay (fx_bus instr 98)
dtime = hslider("dtime", 0.375, 0.02, 1.9, 0.001);
dfb   = hslider("dfb", 0.35, 0, 0.92, 0.01);
dcut  = hslider("dcut", 2600, 300, 9000, 1);
dgain = hslider("dgain", 1, 0, 2, 0.01);
// the delay->reverb bleed — fx_bus's own `bleed` slider, mirrored (series-bus
// round 2026-08-27; default 0.2 = the old literal, caller sets it from the
// same SE.fxParams value it hands fx_bus, so colored genres track the knob)
bleed = hslider("bleed", 0.2, 0, 1, 0.01);
// ping-pong (fx_bus instr 95)
pptime = hslider("pptime", 0.75, 0.05, 2.4, 0.001);
ppfb   = hslider("ppfb", 0.66, 0, 0.85, 0.01);
pptone = hslider("pptone", 3000, 300, 9000, 1);

MAXD = 131072;   // ~3 s at 44.1k (matches fx_bus)

// instr 98: tap -> tone -> out & *fb -> back into the write head (fx_bus fbdel)
fbdel(x) = ((+(x) : de.fdelay(MAXD, dtime*ma.SR) : fi.lowpass(1, dcut)) ~ *(dfb));

// instr 95: cross-feeding stereo taps (fx_bus pingpong)
pingpong(x) = pl, pr letrec {
  'pl = (x + pr*ppfb) : de.delay(MAXD, int(pptime*ma.SR)) : fi.lowpass(1, pptone);
  'pr = (pl*ppfb)     : de.delay(MAXD, int(pptime*ma.SR)) : fi.lowpass(1, pptone);
};

// the EXACT fx_bus bleed term (fx_bus process: rin = rev + d*bleed + (ppl+ppr)*0.12)
process(del, pp) = d*bleed + (ppl + ppr)*0.12
with {
  d   = fbdel(del) * dgain;
  ppl = pingpong(pp) : _, !;   // identical subtrees hash-cons to one pingpong (as in fx_bus)
  ppr = pingpong(pp) : !, _;
};
