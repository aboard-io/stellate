// fx_bus — the WHOLE csd-engine.js master section in one stereo module:
//   instr 98 delay (feedback delay, tone lowpass in loop, 0.2 bleed to reverb)
//   instr 95 ping-pong (cross-fed L<->R taps, tone darkening, 0.12 to reverb)
//   instr 99 reverb (reverbsc -> zita_rev1_stereo here)
//   instr 97 crackle (dust2 -> no.sparse_noise + hiss, way under the music)
//   instr 96/100 master: gkCut sweep lowpass (mcut), sidechain pump (phasor
//   duck like csound, optionally blended with an an.amp_follower on the sc
//   input), grit (tanh drive), comp (dam -> co.compressor_stereo +
//   makeup), tone tilt (lowcut/highcut butterworths), then
//   co.limiter_1176_R4_stereo + the 0.95 clip.
// Inputs: 0 dryL, 1 dryR, 2 reverb send, 3 delay send, 4 ping-pong send,
//         5 sidechain source (kick bus; optional, silence = pure phasor pump)
declare name "fx_bus";
import("stdfaust.lib");

// delay (instr 98)
dtime = hslider("dtime", 0.375, 0.02, 1.9, 0.001);
dfb   = hslider("dfb", 0.35, 0, 0.92, 0.01);
dcut  = hslider("dcut", 2600, 300, 9000, 1);
dgain = hslider("dgain", 1, 0, 2, 0.01);
// ping-pong (instr 95)
pptime = hslider("pptime", 0.75, 0.05, 2.4, 0.001);
ppfb   = hslider("ppfb", 0.66, 0, 0.85, 0.01);
pptone = hslider("pptone", 3000, 300, 9000, 1);
// reverb (instr 99)
rgain = hslider("rgain", 1, 0, 3.5, 0.01);
rtone = hslider("rtone", 2000, 500, 6000, 1) : si.smoo;   // return tone (2000 = legacy fixed value; eco-3 dulls it)
// crackle (instr 97)
crackle = hslider("crackle", 0, 0, 1, 0.01);
// master (instr 96 + 100)
mcut    = hslider("mcut", 21000, 180, 21000, 1) : si.smoo;
pump    = hslider("pump", 0, 0, 0.9, 0.01);
bps     = hslider("bps", 2, 0.2, 8, 0.001);
scmix   = hslider("scmix", 0, 0, 1, 0.01);       // 0 = phasor duck (csound), 1 = amp-follower duck
grit    = hslider("grit", 0, 0, 1, 0.01);
comp    = hslider("comp", 0, 0, 1, 0.01);
lowcut  = hslider("lowcut", 10, 10, 400, 1);
highcut = hslider("highcut", 20500, 1000, 20500, 1);
// MASTER AIR SHELF (Paul 2026-07-25: "the high end of the spectrum is VERY
// loud in general on good headphones — adjust the final mix with an EQ to
// bring it down a bit"): a gentle high-shelf CUT in dB above AIR_FC — a
// SHELF, not a lowpass, so the air dims instead of vanishing. Applied
// unconditionally right after the genre tone tilt; the value comes from
// state-engine fxParams (MASTER_AIR_SHELF_DB, -3 dB) on every path (press,
// live ring, wavOut stream). Default mirrors that constant so a host that
// never sets params hears the same master.
shelf   = hslider("shelf", -3, -12, 0, 0.1);
AIR_FC  = 7000;   // shelf corner: midpoint of the cut — puts the >=8 kHz band at ~-3 dB
// THE TAPE (Paul 2026-07-25: "just a bit of saturated tape wobble plus reverb
// in the final mix"). Three always-on master colours — the machine the whole
// catalogue is played back on. Defaults mirror the state-engine constants so a
// host that sets no params hears the same master.
//   wob  — wow & flutter: decorrelated slow LFOs modulate a short fractional
//          delay per channel (wow ~0.6 Hz + flutter ~6 Hz). Tiny depth: the
//          pitch drifts, it never seasicks. Decorrelation gives a little width.
//   tsat — gentle tape saturation: soft knee well under the clip stage, exact
//          bypass at 0, level-preserving for small signals.
//   mrev — a little of the DRY mix into the reverb so the WHOLE mix shares one
//          room (the per-voice sends are untouched — this is the global bleed).
// wob DEFAULT 0 (2026-07-25, same day it landed): the wow/flutter is a
// MODULATED DELAY, i.e. master-bus state, and fx_bus is instantiated fresh at
// every stream open() (stream-renderer.js:379/442). On a travelling path each
// steer opens a new generation, so the LFO restarted at phase 0 while the
// outgoing stream sat elsewhere in its cycle — the master delay time JUMPED at
// every crossfade and the two blended streams were time-offset from each other.
// Paul heard it immediately: "definitely lurching… esp drums". Segment-parity
// never caught it because parity tests ONE generation, never a crossfade.
// Kept as a param (an offline single-instance press can still dial it in);
// re-enabling it live needs a phase source shared across instances.
wob     = hslider("wob", 0, 0, 1, 0.01);
tsat    = hslider("tsat", 0.18, 0, 1, 0.01);
mrev    = hslider("mrev", 0.07, 0, 0.5, 0.01);
WOB_MS  = 1.6;    // base delay; peak deviation is 90% of it at wob=1 (~±0.1% pitch)
TSAT_K  = 1.8;    // saturation drive at tsat=1

// ---- THE HONEST MASTER (2026-08-21) -------------------------------------
// Measured on a real record (nukernel rock/3, 60 s, every on/off combination
// of the desk's four master words): THREE OF THE FOUR RAISE LEVEL IN SERIES
// AND NOTHING COMPENSATES. drive at "warm" is +1.47 LUFS, glue at "glue" is
// +0.87, the two together +2.20 — and every one of those gains costs crest
// (9.61 dB bypassed -> 7.47 dB with drive+glue) and kick transient (6.24 ->
// 5.05 dB). Louder reads as better, so the user keeps stacking, and what they
// are actually stacking is the transient loss. That is a DECEPTION, not a
// range problem: the controls are supposed to choose CHARACTER, not volume.
//
// Five params answer it, and EVERY ONE OF THEM DEFAULTS TO THE IDENTITY, so a
// host that does not write them hears exactly the master it heard before
// (the absent-law: `x + (f(x) - x)*0` is x, `x*1` is x, bit-for-bit).
//
//   gtrim  output trim on the grit stage      — drive stops feeding the
//                                               compressor a hotter signal
//   cpar   PARALLEL GLUE: how much uncompressed signal rides under the
//          compressor's output. 0 = today's fully serial path.
//   ctrim  output trim on the glue stage      — glue stops feeding the clipper
//   ttrim  output trim on the tape stage
//   dtrim  DRY trim in the mix sum            — the `space` crossfade: a send
//                                               that adds a room should not
//                                               also add level
gtrim   = hslider("gtrim", 1, 0.05, 2, 0.001);
cpar    = hslider("cpar", 0, 0, 1, 0.01);
ctrim   = hslider("ctrim", 1, 0.05, 2, 0.001);
ttrim   = hslider("ttrim", 1, 0.05, 2, 0.001);
dtrim   = hslider("dtrim", 1, 0.05, 2, 0.001);

// A KEYED DETECTOR IS NOT THE FIX, AND HERE IS THE MEASUREMENT (2026-08-21).
// The obvious cheap stand-in for a group bus is to high-pass the master
// compressor's SIDECHAIN so the kick's fundamental stops writing the gain the
// vocal is heard through. It was built (a `sckey` mix param, 0 = today's
// full-band `abs(l)+abs(r)` detector bit-for-bit, 1 = the detector through a
// 2nd-order high-pass at 140 Hz) and measured on the same record as everything
// else above. Vocal-band gain dip at kick onsets, median over 69 kicks that
// land under a sung note:
//     comp .95 alone           sckey 0: -1.20 dB     sckey 1: -1.18 dB
//     drive .8 + glue .95 + tape 1.0   -1.45 dB              -1.41 dB
// Nothing. The pumping on this material is NOT the compressor's detector — it
// is the GRIT WAVESHAPER's instantaneous intermodulation: drive alone walks the
// dip -0.51 -> -0.93 -> -1.21 -> -1.46 -> -1.73 dB across its four settings,
// while glue alone only reaches -1.20 at squash. A high-pass on a detector
// cannot touch a memoryless nonlinearity, and a "power kick" has plenty of
// energy above 140 Hz anyway. Faust computes every branch, so the two biquads
// were 0.285 points of realtime (fx_bus 7.93% -> 8.51%; 8.22% without them) —
// master_mb.dsp records the same lesson from the other direction. Removed, and
// written down so the next person costs it from here rather than from scratch.
// What DID move the dip is up in the desk: the push budget (drive and glue
// stop stacking) and the parallel dry path below.

MAXD = 131072;   // ~3 s at 44.1k

// instr 98: tap -> tone -> out & *fb -> back into the write head
fbdel(x) = ((+(x) : de.fdelay(MAXD, dtime*ma.SR) : fi.lowpass(1, dcut)) ~ *(dfb));

// instr 95: cross-feeding stereo taps (mono gaPPL feed, like the csound bus)
pingpong(x) = pl, pr letrec {
  'pl = (x + pr*ppfb) : de.delay(MAXD, int(pptime*ma.SR)) : fi.lowpass(1, pptone);
  'pr = (pl*ppfb)     : de.delay(MAXD, int(pptime*ma.SR)) : fi.lowpass(1, pptone);
};

// instr 97: dust2(kcrk*0.5, 30+kcrk*220) + hiss, band-limited.
// Output scale 0.15 (was 0.3): human-calibrated 2026-07-04 — "always make
// crackle half as loud as you are setting it now". This is THE authoritative
// crackle gain; anchor crackle ranges are identity data and stay untouched.
crk = (no.sparse_noise(30 + crackle*220)*crackle*0.5
        : fi.lowpass(2, 6500) : fi.highpass(2, 300))
    + (no.noise*0.004*crackle : fi.lowpass(2, 4000)) : *(0.15);

// master chain (instr 100 order: sweep, pump, grit, comp, tone, clip)
duckenv(sc) = (1-scmix)*exp(-6*os.lf_sawpos(bps)) + scmix*min(1.0, an.amp_follower(0.12, sc)*3);
gritfx(x) = ma.tanh(x*(1 + grit*2.6)) * (1.0/(1 + grit*0.7));
gritmix(x) = x + (gritfx(x) - x)*min(1.0, grit*8);
cratio  = 1.0/max(0.45, 1 - 0.55*comp);
cthresh = 20*log10(max(0.2, 0.55 - 0.35*comp));
makeup  = 1 + 0.8*comp;
// --- the tape transport (see the wob/tsat sliders above) ---
// wow (slow, dominant) + flutter (fast, quarter-weight); L/R run at different
// rates so the drift decorrelates into width instead of shifting the image.
wowL = os.osc(0.61)*0.75 + os.osc(5.70)*0.25;
wowR = os.osc(0.53)*0.75 + os.osc(6.30)*0.25;
wobble(lfo, x) = de.fdelay(1024, dly, x)
  with { base = WOB_MS*0.001*ma.SR; dly = base*(1 + 0.9*wob*lfo); };
// level-preserving soft knee; exact bypass at tsat=0 (the (…-x)*tsat term dies)
tapesat(x) = x + (ma.tanh(x*k)/k - x)
  with { k = 1 + TSAT_K*tsat; };
// THE GLUE STAGE, opened up. It was `co.compressor_stereo(...) : *(makeup)`,
// which is EXACTLY what the lines below compute when cpar and ctrim sit
// at their defaults — compressor_stereo is `cgm*x, cgm*y with { cgm =
// compression_gain_mono(ratio,thresh,att,rel, abs(x)+abs(y)) }` (compressors.lib,
// Julius O. Smith III), so writing the detector out by hand is a re-spelling,
// not a re-design, and the multiply order is preserved.
// What the spelling buys is the thing a serial bus compressor cannot do: a DRY
// PATH underneath (cpar). MEASURED AT MATCHED LOUDNESS, which is the only way
// this comparison means anything — a compressor's level change is not a gain,
// so crest read at two different loudnesses reads two different questions:
//   glue  (comp .35)   crest 9.57 -> 9.57   kick attack 6.50 -> 6.42
//                      vocal-band dip at kicks  -0.85 -> -0.75 dB
//   squash(comp .95)   crest 9.65 -> 9.60   kick attack 7.07 -> 6.99
//                      vocal-band dip at kicks  -1.29 -> -0.90 dB
// So the honest reading is: the compressor was never the transient thief on
// this material (crest and attack move by 0.05-0.08 dB, i.e. not at all), and
// what the dry path actually buys is the PUMPING — 0.39 dB less kick-synchronous
// ducking of the vocal band at squash, 0.10 dB at glue. That is the whole of
// what a single shared bus can give back without a group bus under it.
glue(x, y) = (wl + (x - wl)*cpar) * ctrim, (wr + (y - wr)*cpar) * ctrim
with {
  cgm = co.compression_gain_mono(cratio, cthresh, 0.01, 0.09, abs(x) + abs(y));
  wl = cgm * x * makeup;
  wr = cgm * y * makeup;
};
master(sc, l, r) = l, r
  : (wobble(wowL), wobble(wowR))                                  // the transport, before everything downstream
  : (fi.lowpass(2, min(mcut, 20500)), fi.lowpass(2, min(mcut, 20500)))
  : (*(duck), *(duck))
  : (gritmix, gritmix)
  : (*(gtrim), *(gtrim))                                           // drive pays for its own level
  : glue                                                           // compressor + makeup, with the parallel dry path and its trim
  : (fi.highpass(2, lowcut), fi.highpass(2, lowcut))
  : (fi.lowpass(2, highcut), fi.lowpass(2, highcut))
  : (tapesat, tapesat)                                             // tape saturation, under the clip stage
  : (*(ttrim), *(ttrim))                                           // tape pays for its own level
  : (fi.high_shelf(shelf, AIR_FC), fi.high_shelf(shelf, AIR_FC))   // master AIR shelf (see hslider above)
  : (clip, clip)
with {
  duck = 1 - pump*duckenv(sc);
  // csound `clip aL, 0, 0.95` = Bram de Jong soft clip (method 0, iarg 0.5):
  // linear below 0.5*limit, saturating knee, hard cap at (0.5+1)/2*limit =
  // 0.7125 (the csound renders' exact -2.9 dB max). The 1176 limiter that
  // used to sit here gain-reduced hot mixes ~5 dB below the csound render —
  // replaced during the Phase-2 six-genre A/B gate.
  clip(x) = ma.signum(x)*0.95*bdj(min(abs(x)/0.95, 1.0)) with {
    a = 0.5;
    bdj(v) = ba.if(v < a, v, a + (v-a)/(1.0 + ((v-a)/(1.0-a))^2));
  };
};

process(dl, dr, rev, del, pp, sc) = master(sc, mixL, mixR)
with {
  d   = fbdel(del) * dgain;
  ppl = pingpong(pp) : _, !;      // identical subtrees are hash-consed:
  ppr = pingpong(pp) : !, _;      // one ping-pong, one zita instance
  // + mrev: a little of the DRY mix joins the sends, so every voice shares one
  // room even when its own send is 0 (the global bleed — see the mrev slider)
  rin = (rev + d*0.2 + (ppl + ppr)*0.12 + (dl + dr)*0.5*mrev) * rgain;
  // dark crossover/return + LONG t60: reverbsc at fb 0.85 has a much longer,
  // darker tail than stock zita — this is what pulls the A/B centroid in line
  rl  = (rin, rin) : re.zita_rev1_stereo(40, 200, 2000, 5.0, 3.5, 48000) : fi.lowpass(1, rtone), ! ;
  rr  = (rin, rin) : re.zita_rev1_stereo(40, 200, 2000, 5.0, 3.5, 48000) : !, fi.lowpass(1, rtone);
  // dtrim: the SPACE crossfade. mrev sends the dry mix to the room; pulling the
  // dry back by the same energy is what makes "more room" a choice about the
  // room rather than a choice about loudness. The SEND above is untrimmed on
  // purpose — the wet amount is mrev's job alone.
  mixL = dl*dtrim + rl + d + ppl + crk;
  mixR = dr*dtrim + rr + d + ppr + crk;
};
