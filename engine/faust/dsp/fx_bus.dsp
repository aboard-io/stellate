// fx_bus — the WHOLE csd-engine.js master section in one stereo module:
//   instr 98 delay (feedback delay, tone lowpass in loop, `bleed` slider —
//   default 0.2, the old literal — into reverb; series-bus round 2026-08-27)
//   instr 95 ping-pong (cross-fed L<->R taps, tone darkening, 0.12 to reverb)
//   instr 99 reverb (reverbsc -> zita_rev1_stereo here)
//   instr 97 crackle (dust2 -> no.sparse_noise + hiss, way under the music)
//   instr 96/100 master: mid/side width trim (mswidth), gkCut sweep lowpass
//   (mcut), sidechain pump (phasor duck like csound, optionally blended with
//   an an.amp_follower on the sc input), grit (tanh drive), comp (dam ->
//   co.compressor_stereo + makeup), tone (lowcut/highcut butterworths), the
//   master TILT (mtilt), the tape head, the AIR shelf and the soft clip
//   (clipl — 0.95 by default, 0 = no clip stage; `push` was measured and NOT
//   wired — see the block at the mswidth slider).
//   EVERY ONE OF THOSE STAGES HAS AN OFF NOW (2026-08-28); see the block at
//   the mswidth slider for what that cost and why it was owed.
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
// THE DELAY -> REVERB BLEED HAS A HAND ON IT, 2026-08-27 (the series-bus
// round: "one bus for genre specific effects, into a delay bus, into reverb,
// into main"). This was the literal `d*0.2` in rin below since instr 98 was
// ported — the one series edge nothing could move. Default 0.2 = the literal,
// so a state that never writes it renders byte-identical; 0 severs the
// delay->reverb feed entirely (the series-bus gate proves both on samples).
bleed = hslider("bleed", 0.2, 0, 1, 0.01);
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
//   DEEPENED AND DROPPED 2026-08-27 (Paul: "very high tones get shrieky").
// The same ear and the same complaint a month later, so the 2026-07-25 answer
// was simply too gentle: -3 dB starting at 7 kHz leaves the shriek band (4-8
// kHz, where a bright lead's upper partials and a cymbal's body sit) almost
// untouched — at 5 kHz the old shelf was down 0.9 dB. Corner 7000 -> 4500 and
// depth -3 -> -7: the midpoint now lands at 4.5 kHz (-3.5 dB there) and the cut
// is fully -7 dB by ~9 kHz. MEASURED on the rendered artifact (8 bars, seed 1,
// hyperpop / bleeptechno / iranpop through nukernel/export/_satpress.js): the
// 8-16 kHz band falls 4.31/4.35/4.44 dB and 4-8 kHz falls 2.37/2.39/3.09 dB
// against the old shelf, with the peak moving 0.00/+0.13/+0.17 dB. An
// intermediate -6/5000 was rendered first and bought only 3.3 dB up top, which
// is why the numbers are these and not those. Still a SHELF — the air dims, it does not stop.
shelf   = hslider("shelf", -7, -12, 0, 0.1);
AIR_FC  = 4500;   // shelf corner: midpoint of the cut — -3.5 dB at 4.5 kHz, -7 dB above ~9 kHz
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
// ---- THE MASTER HAS AN OFF, 2026-08-28 ----------------------------------
// Paul, listening to the Iranian pop record: *"Everything is hot and needs more
// filtering. Everything sounds like it was recorded on very hot mic or amp.
// Turning that stuff down doesn't do enough in the final mix. There doesn't
// seem to be a way to even turn the final mix off — the minimum amount of
// things is soft, not none."*
//
// He is describing THIS FILE. Three stages in master() below ran on every
// record ever rendered and no state could remove any of them:
//   · the Bram de Jong soft clip at 0.95, applied unconditionally as the last
//     line of the chain — measured 2026-08-28, all four probe records peaked
//     -3.3 to -4.0 dBFS, above its knee (0.475) and against its cap (0.7125).
//     THAT is the hot mic. It is `clipl` now, and 0 means the stage is not in
//     the signal.
//   · `tapesat`, whose own comment claimed "exact bypass at tsat=0 (the
//     (…-x)*tsat term dies)" over an expression that HAS NO SUCH TERM:
//       x + (ma.tanh(x*k)/k - x)   with k = 1 + TSAT_K*tsat
//     at tsat=0 is k=1, i.e. plain ma.tanh(x) — a second full-strength soft
//     clip, one stage above the first. The comment was the bug report.
//   · `mswidth` / `mtilt` did not exist at all: the board's `width` and `tilt`
//     words drew, saved and reached nothing (audio/desk.js said so out loud).
//     `tilt` is the direct answer to "needs more filtering", so it is built.
//
// A `mpush` SLIDER WAS BUILT IN THIS ROUND AND THEN TAKEN BACK OUT, and the
// measurement is why. The board's CEILING vocabulary carries a `push` column
// (loud 1.7, louder 2.6) that had never reached anything, and a gain INTO the
// clip stage is where it obviously belongs. Rendered both ways on the two
// families that draw those words (8 bars, seed 1):
//     house  (loud,   push 1.7)   RMS -11.71 -> -8.14   crest 8.72 -> 5.20
//     techno (louder, push 2.6)   RMS -27.31 -> -19.15  crest 21.02 -> 16.21
// +3.6 and +8.2 dB of level, bought with 3.5 and 4.8 dB of crest, with the
// peak pinned on the clipper the whole way — which is the EXACT deception the
// 2026-08-21 honest-master round above was written to end, arriving through a
// new door in the round whose brief was "everything is hot". So it is not
// shipped: `push` stays an unreached column, named as one, next to `thr`. A
// push belongs in front of dsp/master_limit.dsp's fixed threshold, which this
// chain does not instantiate offline. Nothing is declared here that does not
// arrive.
//
// MEASURED, 8 bars, seed 1, four records through nukernel/export/_satpress.js
// (float PCM, so a peak over 1.0 is visible instead of encoder-clamped). Five
// columns: [1] the master as it stood before this round, [2] the same records
// as they ship after it, [3] ceiling `none` ONLY (the clip out, the tape head
// still in), [4] tape `none` only (the head out, the clip still in), [5] all
// seven words at `none`.
//
//   crest dB      [1]     [2]     [3]     [4]     [5]
//   iranpop      8.48   10.27   10.75    9.93   15.09
//   rock        11.28   10.52   11.32   10.22   20.37
//   steely      14.34   15.02   18.51   14.49   22.56
//   hymn        12.45   12.65   13.09   12.87   18.12
//   peak dBFS
//   iranpop     -3.98   -3.24   -2.76   -2.50   +4.13
//   rock        -3.91   -3.35   -2.53   -2.94   +6.43
//   steely      -3.33   -2.50   +1.00   -2.50   +5.23
//   hymn        -3.50   -3.30   -2.86   -2.50   +2.89
//
// READ COLUMNS [3] AND [4] TOGETHER AND PAUL'S SENTENCE IS EXPLAINED. Removing
// the clipper alone buys 0.44 to 3.49 dB of crest; removing the tape head alone
// buys LESS THAN NOTHING on three of the four. Removing both buys 5.5 to 9.9 dB.
// They are two brickwalls in series doing the same job, and whichever one you
// open, the other one closes over the transient — which is exactly *"turning
// that stuff down doesn't do enough in the final mix"*. Note the peaks in [3]
// and [4]: -2.5 dBFS over and over, because 0.75 is the Bram de Jong cap at
// limit 1.0 AND ma.tanh(x*1.324)/1.324 at the default tsat 0.18 saturates at
// 0.755. Two independent stages, the same ceiling, neither of them announced.
//
// AND WHAT THE RAW RECORD IS, which is the thing nobody has been able to hear:
// column [5] peaks at +2.9 to +6.4 dBFS with 198 to 5,869 samples at or over
// full scale. The live path is safe (dsp/master_limit.dsp, after fx_bus in
// engine/faust/live/live.js, a real 2 ms-lookahead brickwall at 0.98); the
// OFFLINE press and the wav export end at this file, so a bypassed master there
// will clip in the encoder. Stated, not hidden: raw means raw.
//
// EVERY BYPASS HERE IS A select2, NEVER A FORMULA THAT HAPPENS TO EQUAL ONE.
// `x + (f(x) - x)*0` is exact, but `(l+r)*0.5 + (l-r)*0.5` is NOT bit-identical
// to `l` in float and `lo*1 + (x-lo)*1` is not bit-identical to `x`. A select2
// picks the untouched sample, so the identity is the sample and not a
// re-derivation of it — which is what lets a record that says nothing about
// width or tilt render byte-for-byte what it rendered before.
mswidth = hslider("mswidth", 1, 0, 2.4, 0.01);   // mid/side SIDE gain; 1 = the image as recorded
mtilt   = hslider("mtilt", 0, -12, 12, 0.1);     // dB: lows -mtilt, highs +mtilt, about TILT_FC
TILT_FC = 1000;
// the soft clip's own limit. 0 = NO CLIP STAGE (the ceiling word `none`, and
// the only thing in this file that was never optional). 0.95 = the csound
// literal every record has been rendered through.
clipl   = hslider("clipl", 0.95, 0, 1.5, 0.01);

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
// level-preserving soft knee. THE BYPASS AT tsat=0 IS REAL NOW (2026-08-28):
// this comment used to say "exact bypass at tsat=0 (the (…-x)*tsat term dies)"
// and there was no such term — at tsat=0, k=1 and the expression is plain
// ma.tanh(x), a full-strength saturator nothing could switch off. select2 picks
// the untouched sample instead. At tsat>0 the arithmetic is unchanged, so every
// record that carries the shipped 0.18 head renders bit-for-bit as before.
tapesat(x) = select2(tsat > 0, x, x + (ma.tanh(x*k)/k - x))
  with { k = 1 + TSAT_K*tsat; };
// WIDTH: a mid/side trim on the whole master. Four multiplies, and select2'd
// out at 1 so "no width word" is the recorded image untouched, not a rebuild
// of it that rounds differently.
widthfx(l, r) = select2(mswidth != 1, l, ml + sd), select2(mswidth != 1, r, ml - sd)
  with { ml = (l + r)*0.5; sd = (l - r)*0.5*mswidth; };
// TILT: ONE first-order split about TILT_FC — the low half takes -mtilt dB and
// the high half +mtilt, so one number rocks the spectrum about its middle.
// A shelf PAIR would be two biquads per channel; this is one 1-pole, and the
// earlier sidechain-keying round costed two biquads here at 0.285 points of
// realtime, which is why the cheap spelling is the one that got built.
tiltfx(x) = select2(mtilt != 0, x, lo*ba.db2linear(0 - mtilt) + (x - lo)*ba.db2linear(mtilt))
  with { lo = fi.lowpass(1, TILT_FC, x); };
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
  : widthfx                                                       // the image, before anything colours it
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
  : (tiltfx, tiltfx)                                               // the master TILT (the board's `tilt` word)
  : (fi.high_shelf(shelf, AIR_FC), fi.high_shelf(shelf, AIR_FC))   // master AIR shelf (see hslider above)
  : (clip, clip)
with {
  duck = 1 - pump*duckenv(sc);
  // csound `clip aL, 0, 0.95` = Bram de Jong soft clip (method 0, iarg 0.5):
  // linear below 0.5*limit, saturating knee, hard cap at (0.5+1)/2*limit =
  // 0.7125 (the csound renders' exact -2.9 dB max). The 1176 limiter that
  // used to sit here gain-reduced hot mixes ~5 dB below the csound render —
  // replaced during the Phase-2 six-genre A/B gate.
  // …AND IT IS DEFEATABLE NOW (2026-08-28, the ceiling word). `clipl` is the
  // limit; 0 removes the stage from the signal entirely and select2 hands the
  // untouched sample through, so this is a bypass and not a very high ceiling.
  // WHAT PROTECTS THE LISTENER WITH THE CLIP OFF, stated rather than assumed:
  // on the LIVE path, dsp/master_limit.dsp — a real 2 ms-lookahead brickwall
  // guaranteeing 0.98, wired after fx_bus in engine/faust/live/live.js and
  // untouched by any of this. On the OFFLINE press and the wav export the
  // chain ENDS at fx_bus, so with clipl 0 nothing catches peaks and a hot
  // record can exceed full scale — the 16-bit encoder is then the hard clip.
  // That is the honest state of it: raw means raw, and only offline.
  clip(x) = select2(clipl > 0, x, ma.signum(x)*L*bdj(min(abs(x)/L, 1.0))) with {
    L = max(clipl, 0.000001);
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
  rin = (rev + d*bleed + (ppl + ppr)*0.12 + (dl + dr)*0.5*mrev) * rgain;
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
