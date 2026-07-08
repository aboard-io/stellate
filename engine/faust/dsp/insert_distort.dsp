// insert_distort — per-voice INSERT effect (state.instruments.<voice>.inserts
// contract, type "distort"): ef.cubicnl saturation + tone lowpass, dry/wet mix.
// Mono in -> mono out; sits between a voice and its layer tap / fx sends.
// bypass = mix 0 (unity dry path), never a graph disconnect.
//
// cubicnl pregain is 10^(2*drive) — the makeup term pulls the wet path back
// roughly level with the dry so mix rides don't double as volume rides.
declare name "insert_distort";
import("stdfaust.lib");

drive = hslider("drive", 0.5, 0, 1, 0.001) : si.smoo;
mix   = hslider("mix",   1,   0, 1, 0.001) : si.smoo;
tone  = hslider("tone", 4500, 500, 12000, 1) : si.smoo;

makeup = ba.db2linear(0 - drive*14);
wet(x) = x : ef.cubicnl(drive*0.85, 0) : fi.lowpass(1, tone) : *(makeup);

process = _ <: _, wet : si.interpolate(mix);
