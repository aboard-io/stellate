// master_limit — the LIVE master BRICKWALL (2026-07-25, docs/TIMING-AUDIT-2026-07
// "the master output clips").
//
// MEASURED at handle.analyser (the listener's signal, post busComp → ×2.6 makeup →
// the DynamicsCompressor "limiter"), 120 s of house/dub/jungle: peak 1.166
// (+1.34 dBFS), 1339 samples over ±1.0 (253 ppm), and **15.7% of loud 100 ms
// windows contained at least one over-full-scale sample** — ~8 samples per affected
// window, i.e. sparse transient TIPS, not sustained overload. Those samples are
// hard-clipped by the browser on the way to the device (userGain → ctx.destination).
//
// A DynamicsCompressor is not a limiter: threshold −1.5 dB / ratio 20 with a 2 ms
// ATTACK means a transient's first ~90 samples pass at full gain. This is the real
// thing — the gain is derived from the peak that is ABOUT TO ARRIVE:
//
//   targ  = ceiling / peak            instantaneous required gain (both channels,
//                                     linked, so the stereo image never shifts)
//   gh    = instant fall, exponential recovery over REL (no gain is ever let back
//           up faster than REL — that is what makes it colourless)
//   gs    = one-pole smoothing (ATT) so the gain has no corners to click on
//   g     = sliding MINIMUM of gs over the whole lookahead window, and the audio is
//           delayed by that same window ⇒ the gain applied to a sample is the
//           minimum of everything the smoother does over the next LD seconds, so
//           the ramp has ALREADY completed when the peak arrives.
//
// That last step is the difference between this and co.limiter_lad_stereo (whose
// one-pole attack cannot converge inside its own lookahead: measured 1.09 out for
// a 1.25 transient, 1.13 for a hard 1.6 onset — it would not have closed this).
//
// Below the ceiling g is exactly 1 and the output is the input, sample for sample
// (verified bit-exact offline) — a safety net, not a loudness stage. The 2 ms
// transport delay moves the WHOLE master (stream and native lanes alike, both
// upstream of it), so no lane skew.
declare name "master_limit";
import("stdfaust.lib");

LDn  = 88;         // lookahead, samples @44.1k (2.0 ms) — also the sliding window
WMAX = 128;        // compile-time max for the sliding min (>= LDn+1)
ATT  = 0.0003;     // gain-smoothing tau (~13 samples): settles ~6.7x inside LDn
REL  = 0.060;      // gain recovery — long enough not to modulate at audio rate,
                   // short enough that a kick tip doesn't duck the following beat

ceiling = hslider("ceiling", 0.98, 0.1, 1.0, 0.001);

process(l, r) = (l @ LDn) * g, (r @ LDn) * g
with {
  pk    = max(abs(l), abs(r));
  targ  = min(1.0, ceiling / max(pk, ma.EPSILON));
  rpole = ba.tau2pole(REL);
  // state is the ATTENUATION (1-g), not the gain, so the feedback's zero initial
  // value means "transparent" — a gain-state formulation starts at 0 and fades the
  // first ~5·REL of the session up from silence.
  gh    = 1 - ((1 - targ) : (max ~ *(rpole)));
  gs    = gh : si.smooth(ba.tau2pole(ATT));
  g     = gs : ba.slidingMin(LDn + 1, WMAX);
};
