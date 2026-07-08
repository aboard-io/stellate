// clickmon — the ALWAYS-ON master CLICK MONITOR: the Faust production sibling
// of sentinel-processor.js (the hand-written JS click sentinel). Where that
// one is an OPT-IN debug node, this is Paul's standing detector — live.js taps
// it off `master` on EVERY session so the TRAVEL clicks can finally be located.
//
// SINK-style monitor: `process = _ <: attach(_, monitor)` passes the input
// through UNCHANGED (the audio is never touched — `attach` outputs its first
// arg and merely FORCES the monitor branch to be computed) so live.js can wire
// it as a tap (master.connect(clickmon)) and route its output to a muted sink.
//
// It exposes four OUTPUT bargraphs. NOTE on reading them: faustwasm surfaces
// bargraphs NOT as AudioParams (node.getParamValue/node.parameters see only
// sliders/buttons) but as `out-param` port messages pushed to the handler set
// via node.setOutputParamHandler(fn) — emitted every ~6 render blocks (~16ms).
// live.js installs that handler and polls the cached values every ~220ms.
//   clicks   — running COUNT of sample-to-sample discontinuities |x-x'| > thr.
//              A monotonic integrator: it only ever rises, so the poller reads
//              a DELTA between polls (a per-window click rate).
//   peakjump — running PEAK discontinuity magnitude (a monotonic max), so a
//              single sharp click's severity survives to the next 220ms poll.
//   gaps     — running COUNT of DROPOUTS: a >=128-sample run of ~zero samples
//              while the recent RMS was loud (silence inside loud program is a
//              starved render path, not a rest — the exact test the JS sentinel
//              uses; the JS one still runs, this is additive corroboration).
//   rms      — current short-window (~50ms) RMS, for context in the log line.
//
// Cost: a few ops/sample — two subtracts, an abs, two compares, two 1-sample
// accumulators, one resettable counter, one one-pole. Mono in -> mono out
// (a stereo master down-mixes to mono at the node's single input, fine for
// discontinuity detection — the JS sentinel likewise judges the summed edge).
declare name "clickmon";
import("stdfaust.lib");

// discontinuity threshold — a KNOB so the live poller can retune sensitivity
// (or drop it to prove the detector fires). NOT smoothed: it is a comparison
// bar, not an audio parameter. Default 0.5 = the JS sentinel's fixed floor;
// ordinary program clears it, program edges (303/break onsets) can beat it —
// the logged metadata is how we tell a real glitch from an edgy transient.
thr = hslider("thr", 0.5, 0.02, 2, 0.01);

// near-zero floor for dropout detection: the fx bus dithers around zero, only
// a killed/starved render path emits (essentially) exact zeros.
eps = 0.0000001;   // 1e-7
// recent-loudness gate for a gap to count (matches the JS sentinel's rmsSq>1e-4).
loudFloor = 0.01;

// ---- per-sample metrics off the input x ----
// discontinuity magnitude |x[n] - x[n-1]|  (x' = one-sample delay of x)
jump(x) = abs(x - x');

// short-window RMS: one-pole (~50ms) over x^2, then sqrt. Also the gap
// loudness gate — over a 128-sample (~2.7ms) dropout it barely decays, so it
// still reads the pre-gap program level.
rmsSig(x) = x * x : si.smooth(ba.tau2pole(0.05)) : sqrt;

// running CLICK count: integrate a 0/1 discontinuity flag (monotonic).
// `(flag) : + ~ _` — the ~ feeds the delayed sum back into +'s first input,
// the flag feeds the second: out = flag + out'.
clicks(x) = (jump(x) > thr) : + ~ _;

// running PEAK discontinuity magnitude (monotonic max): out = max(jump, out').
peakj(x) = jump(x) : max ~ _;

// dropout RUN length — a resettable counter: run[n] = isZero ? run[n-1]+1 : 0.
// `~ _` feeds the delayed output into the FIRST lambda input (prev); the `:`
// feeds isZero into the second (z). z=1 -> prev+1 (climb); z=0 -> 0 (reset).
zrun(x) = (abs(x) < eps) : \(prev, z).(z * (prev + 1)) ~ _;
// count a gap ONCE, exactly at its 128th consecutive ~zero sample, and only if
// the program was loud just before it (a dropout, not a scored rest).
gaps(x) = ((zrun(x) == 128) & (rmsSig(x) > loudFloor)) : + ~ _;

// ---- the four OUTPUT bargraphs, force-computed, audio passed through ----
// monitor splits x to the four metric+bargraph chains and merges (sums) them
// to one signal; attach() forces that signal's computation while outputting
// the untouched passthrough copy. Nothing here reaches the audio output.
process = _ <: attach(_, monitor)
with {
  monitor = _ <: ( (clicks : hbargraph("clicks",   0, 1000000000)),
                   (peakj  : hbargraph("peakjump",  0, 2)),
                   (rmsSig : hbargraph("rms",       0, 1)),
                   (gaps   : hbargraph("gaps",      0, 1000000000)) ) :> _;
};
