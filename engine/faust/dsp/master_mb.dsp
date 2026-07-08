// master_mb — fx wings stage 4: 3-band MASTER glue-comp as an OPT-IN external
// node (the reverb-color architecture), NOT inside fx_bus. Measured: baking it
// into fx_bus cost every genre ~0.01 live load ratio even at drive 0 (Faust
// computes both select branches; 3 stereo compressors always run) — the live
// gate went 0.977/0.973 PASS -> 0.969/0.967 FAIL on the reference box. As a
// separate 2-in/2-out module it exists ONLY when state.masterComp > 0 (disco):
// press post-passes the fx_bus output through it; live series-inserts it
// between fx_bus and master under a crossfade. Genres without masterComp keep
// the committed fx_bus bytes and pay zero.
//
// Crossovers 250 Hz / 2.5 kHz; lo/hi are 2nd-order butterworths and MID IS
// DERIVED BY SUBTRACTION (x - lo - hi), so the split sums EXACTLY flat
// pre-compression (4 biquads stereo total). Each band gets the same gentle
// compressor, ratio/threshold scaled by mbdrive; wet-only makeup keeps the
// glue loudness-neutral. mbdrive 0 = bit-exact dry pass (x*(1-0) + wet*0).
declare name "master_mb";
import("stdfaust.lib");

mbdrive = hslider("mbdrive", 0, 0, 1, 0.01) : si.smoo;

process(l, r) = l*(1 - mbdrive) + wl*mbdrive, r*(1 - mbdrive) + wr*mbdrive
with {
  xlo = 250; xhi = 2500;
  mbc = co.compressor_stereo(1 + 2*mbdrive, -12 - 12*mbdrive, 0.008, 0.12);
  lol = l : fi.lowpass(2, xlo);   lor = r : fi.lowpass(2, xlo);
  hil = l : fi.highpass(2, xhi);  hir = r : fi.highpass(2, xhi);
  mk  = 1 + 0.9*mbdrive;   // wet-only makeup (bypass stays exact at 0)
  wet = ((lol, lor) : mbc), ((l - lol - hil, r - lor - hir) : mbc), ((hil, hir) : mbc) :> _, _;
  wl  = (wet : _, !) * mk;
  wr  = (wet : !, _) * mk;
};
