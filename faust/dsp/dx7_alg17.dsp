// dx7_alg17 — dx7.lib single-algorithm build (see dsp/DX7-NOTES in report).
// dx.algorithms (runtime 32-algo switch) OOMs the WASM libfaust at 2GB;
// production path = one small artifact per algorithm, picked by the ALG byte.
declare name "dx7_alg17";
import("stdfaust.lib");
process = dx.algorithm(17);
