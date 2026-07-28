// invariants.js — FORMAL VERIFICATION over the genre kernel (docs/INVARIANTS.md).
// What can be established about the kernel by formal or verifiable methods?
//
// The centerpiece is a real PROOF, not a sample: every scalar dimension a
// blend can emit is a CONVEX COMBINATION of anchor values —
//
//   resolveMulti's wRange:      lo = Σ wᵢ·loᵢ,  hi = Σ wᵢ·hiᵢ,  Σwᵢ = 1
//   blendRecipe (numeric keys): weighted mean of per-anchor ranges,
//                               renormalized over declaring parents
//   specRange / pushPull / transforms.rate: same weighted-mean shape
//
// so for any weight vector over the 228 anchors — the UNCOUNTABLE space the
// explorer cursor lives in — the value lies inside the convex hull of the
// anchors' declared endpoints. min/max over anchors therefore BOUNDS every
// possible blend. That is interval arithmetic over the whole blend space:
// prove the hull, and you have proven all of it, for all t, all weight
// vectors, all seeds. (Pools don't lerp — they draw MEMBERS — so pool
// dimensions are proven by ENUMERATION against the engine vocabulary instead.)
//
// Post-lerp transforms are accounted honestly, per docs/INVARIANTS.md:
//   • constrain() only CLAMPS or SUBSTITUTES within enumerated sets — it can
//     only strengthen a bound (proveConstrain() below proves the clamps by
//     executing the LIVE constrain, extracted from the kernel source, on
//     boundary inputs — not a mirror, the real function).
//   • applyMacros() is the one path that can push a value OUTSIDE the anchor
//     hull; every macro's declared range/clamp is folded into a second
//     "macro-extended" interval per dimension (the ±1 slider extremes).
//   • pool draws come from enumerable member sets — checked by enumeration.
// A dimension whose macro-extended interval escapes SAFE but is clamped at
// the realization layer (faust/state-engine.js) is reported CLAMPED with the
// clamp cited; a dimension with no closing bound anywhere is OPEN — a
// documented FINDING, never a fudge.
//
// The rest is the CATALOG: seeded exhaustive property sweeps (deterministic,
// zero Math.random) — totality, constrain idempotence, the duration solver's
// ±10% contract, the snare-law's no-three-peat promise re-verified from
// OUTSIDE, harmonize's clash-freedom contract on real genre states, blend
// continuity along paths, and meter tiling safety. Proofs bound; sweeps
// witness. The epistemic ladder is docs/INVARIANTS.md.
//
//   node engine/invariants.js prove [--full] [--json]
//     quick (default): the proof + pools + constrain battery + a seeded
//                      reduced sweep — target < 60s (verify.sh-adjacent).
//     --full:          the proof + an EXHAUSTIVE state-level sweep over every
//                      anchor pair × t ∈ {.25,.5,.75} × seeds {1,2} (~155k
//                      resolutions — idempotence + bounds membership on every
//                      one) + event-level builds over all anchors × seeds 1-5
//                      and a seeded pair-build subsample. Event-level builds
//                      cost ~12-17ms each, so building all 155k combinations
//                      would take ~35 minutes; the full mode instead runs
//                      every combination at the STATE level (where the
//                      convexity proof lives) and samples the build level
//                      honestly — the split is reported, never hidden.
//
// READ-ONLY over the kernel: this file executes the live engine + extracts
// live internals (constrain, INSERT_DEFAULTS, STAB/HIT/TRANSFORM/SWING
// tables) from the source text at run time, so the suite tracks any kernel
// edit automatically; an extraction that no longer matches is itself a
// reported finding, not a silent pass.
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const E = isNode ? require("./csd-engine.js") : root.CsdEngine;
  const K = isNode ? require("./genre-kernel.js") : root.GenreKernel;
  const P = isNode ? require("./pipes.js") : root.CsdPipes;

  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const round=(x,p)=>Math.round(x*10**(p==null?4:p))/10**(p==null?4:p);
  const J=JSON.stringify;
  const EPS=1e-9;

  // ---------------------------------------------------------------- 0. live-source extraction
  // The kernel keeps constrain() and several vocabulary tables module-private.
  // Rather than mirroring them (a mirror drifts silently), we extract the
  // LIVE literal from the source text by bracket matching and evaluate it.
  // If the kernel is edited so an extraction no longer parses, that surfaces
  // as an explicit harness finding — honesty by construction.
  const SRC = {};
  if (isNode) {
    const fs = require("fs"), path = require("path");
    try { SRC.kernel = fs.readFileSync(path.join(__dirname, "genre-kernel.js"), "utf8"); } catch (e) {}
    try { SRC.engine = fs.readFileSync(path.join(__dirname, "csd-engine.js"), "utf8"); } catch (e) {}
    try { SRC.stateEngine = fs.readFileSync(path.join(__dirname, "faust", "voices", "state-engine.js"), "utf8"); } catch (e) {}
  }
  // bracket-match the {...} / [...] / (...) literal at the first opener after
  // `marker`, tracking ALL bracket kinds + strings + comments
  function extractBalanced(src, marker) {
    if (!src) return null;
    const at = src.indexOf(marker);
    if (at < 0) return null;
    let i = src.indexOf("{", at + marker.length);
    const ib = src.indexOf("[", at + marker.length);
    if (ib >= 0 && (i < 0 || ib < i)) i = ib;
    if (i < 0) return null;
    let depth = 0, inStr = null, inLine = false, inBlock = false;
    for (let j = i; j < src.length; j++) {
      const c = src[j], p = src[j - 1];
      if (inLine) { if (c === "\n") inLine = false; continue; }
      if (inBlock) { if (p === "*" && c === "/") inBlock = false; continue; }
      if (inStr) { if (c === "\\") { j++; continue; } if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
      if (c === "/" && src[j + 1] === "/") { inLine = true; continue; }
      if (c === "/" && src[j + 1] === "*") { inBlock = true; continue; }
      if ("{[(".includes(c)) depth++;
      else if ("}])".includes(c)) { depth--; if (depth === 0) return src.slice(i, j + 1); }
    }
    return null;
  }
  function evalLiteral(txt) {
    if (!txt) return null;
    try { return new Function("return (" + txt + ")")(); } catch (e) { return null; }
  }
  const EXTRACTION_FINDINGS = [];
  function extracted(name, src, marker) {
    const v = evalLiteral(extractBalanced(src, marker));
    if (v == null) EXTRACTION_FINDINGS.push("extraction failed: " + name + " (kernel/engine source drifted — the suite needs a marker refresh)");
    return v;
  }
  const INSERT_DEFAULTS = extracted("INSERT_DEFAULTS", SRC.kernel, "const INSERT_DEFAULTS=");
  const STAB_PATTERNS   = extracted("STAB_PATTERNS",   SRC.engine, "const STAB_PATTERNS=");
  const HIT_PATTERNS    = extracted("HIT_PATTERNS",    SRC.engine, "const HIT_PATTERNS=");
  const TRANSFORM_OPS   = extracted("TRANSFORM_OPS",   SRC.engine, "const TRANSFORM_OPS=");
  const SWING_GRIDS     = extracted("SWING_GRIDS",     SRC.engine, "const SWING_GRIDS=");
  const DRUMKITS        = extracted("DRUMKITS",        SRC.kernel, "const DRUMKITS = ");
  const NO_AUTO_FORM    = (()=>{ const a=evalLiteral(extractBalanced(SRC.kernel, "NO_AUTO_FORM=new Set(")); return a?new Set(a):new Set(["ritual","anthem","transit"]); })();
  const NO_SECTION_DROP = (()=>{ const a=evalLiteral(extractBalanced(SRC.kernel, "NO_SECTION_DROP=new Set(")); return a?new Set(a):new Set(["witchhouse"]); })();
  const AUTO_TARGET     = (()=>{ const m=SRC.kernel&&SRC.kernel.match(/AUTO_TARGET\s*=\s*(\d+)/); return m?+m[1]:180; })();
  // the LIVE constrain(), extracted and instantiated with its real free
  // variables (E, SAMPLES) — running the actual clamps, not a mirror of them
  const liveConstrain = (() => {
    const txt = extractBalanced(SRC.kernel, "function constrain(choice)");
    if (!txt) { EXTRACTION_FINDINGS.push("extraction failed: constrain (function body not found)"); return null; }
    try { return new Function("E", "SAMPLES", "return (function constrain(choice)" + txt + ")")(E, K.SAMPLES); }
    catch (e) { EXTRACTION_FINDINGS.push("constrain extraction did not evaluate: " + e.message); return null; }
  })();

  // ---------------------------------------------------------------- 1. the SAFE table
  // Every bound cites the CONSUMER that makes it a bound. Three closure
  // classes: KERNEL (the anchor hull already sits inside SAFE — proven for
  // all blends by convexity), MACRO-CLAMPED (applyMacros itself clamps at
  // SAFE's edge), REALIZATION (faust/state-engine clamps at the param-set
  // point — cited as `clamp:`). A row with none of these that escapes SAFE
  // is OPEN: a finding.
  //   src  — where the SAFE bound comes from
  //   clamp— the downstream realization clamp, when one exists
  const SAFE = {
    bpm:       { lo:40, hi:225, src:"NO hard consumer clamp exists (spb=60/bpm only needs >0, finite — csd-engine/press/live); SAFE = the anchor tempo envelope (GENRE-SPACE.md tempo table) × applyMacros energy ±8% (UNCLAMPED — see finding)", open:"applyMacros EN scales bpm ±8% with no clamp; the closure is the anchor table itself" },
    swing:     { lo:0, hi:0.6, src:"applyMacros feel: clamp(...,0,0.6); csd-engine drumEvents skip saturates at sw/0.3" },
    humanize:  { lo:0, hi:1, src:"applyMacros feel: clamp(...,0,1); applyGroove uses ht*0.04 beats + hl*0.25 amp" },
    "fx.reverb":    { lo:0, hi:1, src:"state-engine realizes rv=state.reverb through rgain=clamp(rv×3.2,0,3.5) — 1.0 is legal full wash (the dub/doom wing declares [.87,1]); applyMacros space clamps its own writes at 0.99" },
    "fx.delayBeats":{ lo:0.05, hi:2, src:"delay time = beats×spb; ≤2 beats keeps the line inside the bar family (anchor hull; no macro touches it)" },
    "fx.delayFb":   { lo:0, hi:0.85, src:"applyMacros space: clamp(...,0,0.85); feedback <1 = stability" },
    "fx.delayCut":  { lo:300, hi:16000, src:"applyMacros bright: cut(fx,'delayCut',300,16000)" },
    "fx.pump":      { lo:0, hi:1, src:"applyMacros energy: clamp(...,0,1); sidechain duck depth is a 0..1 gain" },
    "fx.crackle":   { lo:0, hi:1, src:"applyMacros acoustic+dust: clamp(...,0,1)" },
    "fx.lowcut":    { lo:0, hi:400, src:"state-engine tone wiring: lowcut=clamp(...,10,400) — the AM-radio thin-out family (chinawave/sovietwave/steamdub…) declares [140,220]; toState maps ≤10 → 0" },
    "fx.highcut":   { lo:0, hi:16000, src:"applyMacros dust/bright: ceiling caps at 16000 then FLIPS to 0 (= off); toState maps ≤1000 → 0 — the value set is {0} ∪ (1000,16000]" },
    "fx.comp":      { lo:0, hi:1, src:"applyMacros energy: clamp(...,0,1); mix-bus dam drive 0..1" },
    "fx.grit":      { lo:0, hi:1, src:"applyMacros dust: clamp(...,0,1)" },
    "fx.jux":       { lo:0, hi:1, src:"per-event pan offsets scale by jux; a pan offset is 0..1 (anchor hull ≤ .5; no macro)" },
    level:     { lo:0.001, hi:2, src:"state-engine pitchedUnitRaw: lvl=clamp(L,0.001,1), gmul=max(1,L); mapEvents gain=clamp(amp×gmul,0,2) — with the sweep-proven amp ≤ 1, level ≤ 2 keeps gain inside the clamp instead of ON it", clamp:"state-engine lvl/gain clamps" },
    cutoffBass:{ lo:60, hi:6000, src:"state-engine NOTE_PARAMS bass_* DSP slider range [60,6000]", clamp:"applyMacros bright clamps bass cutoff to [60,14000]; state-engine mp() clamps to the module slider at realization" },
    cutoffPad: { lo:80, hi:12000, src:"state-engine NOTE_PARAMS pad_saw/organ/strings slider range [80,12000]", clamp:"applyMacros bright clamps pad cutoff to [80,18000]; state-engine mp() clamps to the module slider" },
    cutoffLead:{ lo:60, hi:18000, src:"state-engine NOTE_PARAMS lead family: widest slider union [60(modeld),18000(supersaw)]", clamp:"applyMacros bright clamps lead cutoff to [120,18000]; per-model mp() clamp at realization" },
    res:       { lo:0, hi:0.95, src:"state-engine pitchedUnitRaw: res=clamp(...,0,0.95), then easeRes (the shriek guard)" },
    send:      { lo:0, hi:1, src:"applyMacros space: sends clamp(...,0,1); state-engine realizes send/lvl into a (0,6) pool gain", clamp:"state-engine sends clamp(...,0,6)" },
    attack:    { lo:0.005, hi:5, src:"state-engine atk=clamp(max(floor, attack),0.005,5)", clamp:"same clamp — anchors may declare 0.003, floored at realization" },
    release:   { lo:0.01, hi:3, src:"state-engine rel=clamp(...,0.01,3)", clamp:"same clamp" },
    sustain:   { lo:0, hi:1, src:"state-engine sus=clamp(...,0,1)" },
    fenv:      { lo:0, hi:4, src:"state-engine fev=clamp(...,0,3) melody / bassArt fenv clamp(...,0,4)", clamp:"same clamps" },
    voices:    { lo:1, hi:7, src:"applyMacros acoustic/density: voices clamp(...,1,7); the supersaw stack is 7 voices wide", clamp:"state-engine v=clamp(m.voices||2,1,7) — an anchor asking 8 (edm [6,8]) renders 7" },
    spread:    { lo:0, hi:0.05, src:"applyMacros acoustic: spread clamp(...,0,0.05)" },
    detune:    { lo:0, hi:0.05, src:"applyMacros acoustic: detune clamp(...,0,0.05)" },
    vibrato:   { lo:0, hi:0.03, src:"state-engine NOTE_PARAMS vib contract: vibrato 0–0.03" },
    drumLevel: { lo:0, hi:2, src:"applyMacros density/energy: kick/snare/hat/tom clamp(...,0,2)" },
    drumTune:  { lo:0.25, hi:4, src:"pitch-ratio sanity (±2 octaves); anchors declare [0.8,1.15]; no macro touches tune" },
    foundVol:  { lo:0, hi:1, src:"applyMacros vocal: vol clamp(...,0,1); found gains are 0..1 sample gains (buildEvents scales chops ×2.1 into amp — covered by the amp sweep)" },
    foundPitch:{ lo:0.25, hi:4, src:"playback-rate sanity (±2 octaves); break role forces pitch 1 (constrain+toState); anchors declare [0.6,1.15]" },
    foundStretch:{ lo:0, hi:2, src:"found-player syncgrain: pointer advances stretch×0.12s per grain — a scan RATE, not a 0..1 blend (>1 = faster-than-real; the drone wing declares [0.9,1.05]); 2 = double-speed ceiling" },
    foundCutoff:{ lo:300, hi:18000, src:"applyMacros bright: cut(foundRecipe,'cutoff',300,18000)" },
    adventure: { lo:0, hi:0.75, src:"constrain: adventure=min(.75,·) — proven on the live constrain below; theory.js progress() treats adventure as 0..1 appetite" },
    color:     { lo:0, hi:1, src:"theory.js reharmonize contract: color is a 0..1 extension-richness knob" },
    rhythmComplexity:{ lo:0, hi:1, src:"buildEvents rcx=min(1,max(0,complexity)); constrain caps ≤.4 above 165bpm (proven below)" },
    snarePP:   { lo:0, hi:1, src:"buildEvents thresholds at .65 (liberal) — a probability-like send tag" },
    prob:      { lo:0, hi:1, src:"all prob fields are probabilities (rng()<prob consumers throughout)" },
    rubatoDepth:{ lo:0, hi:0.2, src:"buildEvents dep=Math.min(0.2,rb.depth) AND applyMacros feel clamp(...,0,0.2) — monotonic warp needs depth<1; 0.2 is the engine's own cap" },
    rubatoPeriod:{ lo:1, hi:16, src:"buildEvents P=max(4,periodBars*4) beats; anchors declare 2–4 bars; 16 bars is the ambient sweep ceiling" },
    pushPull:  { lo:-0.25, hi:0.25, src:"a push beyond a 16th (0.25 beat) is displacement, not feel; anchors declare ±0.015 (applyGroove adds it raw — the hull is the closure)" },
    pushPullMs:{ lo:-40, hi:40, src:"the TEMPO-HONEST twin (csd-engine resolvePushPull folds it to beats at state.bpm). Past ~40 ms the ear stops hearing a pocket and starts hearing a flam; 40 ms at the catalogue's fastest tempo (209 bpm) is 0.139 beat, so even summed with the largest declared beat-pushPull (0.08) the fold stays inside the ±0.25 pushPull hull" },
    transformsRate:{ lo:0, hi:1, src:"applyMacros density/energy: transforms.rate clamp(...,0,1); buildEvents fires per-bar at rng()<rate" },
    chordEvery:{ lo:2, hi:64, src:"buildEvents CBEATS=max(2,round(chordEvery)); 64 = twice the longest declared plateau (ambient 32)" },
    autoTune:  { lo:0, hi:1, src:"applyMacros vocal: autoTune clamp(...,0,1)" },
    masterComp:{ lo:0, hi:1, src:"3-band glue-comp drive is a 0..1 knob (fx wings stage 4)" },
    blueNote:  { lo:0, hi:1, src:"blue-note bend strength 0..1 (buildEvents separate stream)" },
    leadOctave:{ lo:-3, hi:3, src:"whole-track register shift in octaves; beyond ±3 leaves every sampler window" },
  };
  // insert-FX param taste bounds (per type); the realization layer clamps each
  // param at the Faust module's slider range — these are the AUTHORING bounds.
  const INSERT_SAFE = {
    distort:    { drive:[0,1], mix:[0,1] },
    phaser:     { rate:[0,10], depth:[0,1], mix:[0,1] },
    chorus:     { rate:[0,10], depth:[0,1], mix:[0,1] },
    filtersweep:{ rateBars:[0.25,32], lo:[-3,3], hi:[-3,3], res:[0,0.95] },
    wah:        { sens:[0,1], base:[50,2000], range:[0,6], q:[0.1,20], mix:[0,1] },
    tremolo:    { rate:[0,20], depth:[0,1], shape:[0,1], wobble:[0,1], mix:[0,1] },
  };
  // pipe spec param bounds (pipes.js clamps: A amp (0.005,1], CUT [0.25,4], SEND [0,6])
  const PIPE_SAFE = {
    prob:[0,1], amp:[0,2], delay:[0,8], semis:[-24,24], level:[0,2], off:[0,1],
    lo:[0.25,4], hi:[0.25,4], floor:[0,1], peak:[0.05,1], step:[0,0.09],
    minDur:[0,8], depth:[0,1], rate:[0.1,12], rsend:[0,6], dsend:[0,6], oct:[-2,2], pan:[0,1],
  };

  // ---------------------------------------------------------------- 2. interval helpers
  const asIv=(v)=>{
    if (typeof v === "number") return Number.isFinite(v) ? [v, v] : null;
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === "number" && typeof v[1] === "number"
        && Number.isFinite(v[0]) && Number.isFinite(v[1])) return [v[0], v[1]];
    return null;   // string pools / model arrays / flags are NOT scalar ranges
  };
  const hull=(a,b)=>a?(b?[Math.min(a[0],b[0]),Math.max(a[1],b[1])]:a):b;
  const inside=(iv,safe)=>iv[0]>=safe.lo-EPS && iv[1]<=safe.hi+EPS;
  const fmtIv=(iv)=>iv?"["+round(iv[0])+", "+round(iv[1])+"]":"—";

  // per-dimension macro extension: applyMacros at slider extremes ±1, each
  // formula transcribed WITH its clamp (genre-kernel applyMacros — cited in
  // the SAFE row). `null` = no macro touches the dimension.
  const cl=(x,a,b)=>x<a?a:x>b?b:x;
  const MACRO_EXT = {
    bpm:(iv)=>[Math.floor(iv[0]*0.92), Math.ceil(iv[1]*1.08)],           // energy ±8%, UNCLAMPED
    swing:(iv)=>[0, cl(iv[1]+0.18,0,0.6)],                               // feel: sw*(1-neg)+pos*0.18, clamp 0..0.6
    humanize:(iv)=>[0, cl(iv[1]+0.15,0,1)],                              // feel clamp 0..1
    "fx.reverb":(iv)=>[Math.max(0,iv[0]*0.4), cl(iv[1]*1.5,0,0.99)],     // space ×(1±.5/.6), clamp 0..0.99
    "fx.delayFb":(iv)=>[Math.max(0,iv[0]*0.65), cl(iv[1]*1.3,0,0.85)],   // space ×(1±.3/.35), clamp 0..0.85
    "fx.delayCut":(iv)=>[Math.max(300,Math.round(iv[0]/2)), Math.min(16000,Math.round(iv[1]*2))],  // bright 2^±1, clamp 300..16000
    "fx.pump":(iv)=>[Math.max(0,iv[0]-0.20), cl(iv[1]+0.25,0,1)],        // energy ±.25/.20, clamp 0..1
    "fx.crackle":()=>[0,1],                                              // acoustic ±.35 + dust ±.40 stack → the full clamp range 0..1
    "fx.comp":(iv)=>[Math.max(0,iv[0]-0.25), cl(iv[1]+0.30,0,1)],        // energy, clamp 0..1
    "fx.grit":(iv)=>[Math.max(0,iv[0]-0.30), cl(iv[1]+0.35,0,1)],        // dust, clamp 0..1
    "fx.highcut":()=>[0,16000],                                          // dust sets 4500-9000; bright scales; >16000 flips to 0 (off)
    cutoffBass:(iv)=>[cl(Math.round(iv[0]/2),60,14000), cl(Math.round(iv[1]*2),60,14000)],   // bright 2^±1, clamp 60..14000
    cutoffPad:(iv)=>[cl(Math.round(iv[0]/2),80,18000), cl(Math.round(iv[1]*2),80,18000)],
    cutoffLead:(iv)=>[cl(Math.round(iv[0]/2),120,18000), cl(Math.round(iv[1]*2),120,18000)],
    send:(iv)=>[Math.max(0,iv[0]*0.3), cl(iv[1]*1.6,0,1)],               // space ×(1±.6/.7), clamp 0..1
    voices:(iv)=>[1,7],                                                  // acoustic ±3 / density ±2, clamp 1..7
    spread:(iv)=>[0, cl(iv[1]*2.2,0,0.05)],                              // acoustic ×(1+1.2), clamp 0..0.05
    detune:(iv)=>[0, cl(iv[1]*2.2,0,0.05)],
    drumLevel:(iv)=>[Math.max(0,iv[0]*0.6), cl(iv[1]*1.3,0,2)],          // density/energy ×(1±.3/.4), clamp 0..2
    foundVol:(iv)=>[0, cl(iv[1]*1.6,0,1)],                               // vocal ×(1±.6/.9), clamp 0..1 (narration/vox only, but bound the widest case)
    foundCutoff:(iv)=>[cl(Math.round(iv[0]/2),300,18000), cl(Math.round(iv[1]*2),300,18000)],
    rubatoDepth:(iv)=>[0, cl(iv[1]*1.8,0,0.2)],                          // feel ×(1±.8), clamp 0..0.2
    transformsRate:(iv)=>[0, cl(iv[1]*1.9,0,1)],                         // density ×(1±.5) then energy ×(1±.4), clamp 0..1
    autoTune:()=>[0,1],                                                  // vocal +pos*0.5, clamp 0..1
  };

  // ---------------------------------------------------------------- 3. THE PROOF
  // walk the GENRES table; build the anchor hull per scalar dimension; apply
  // constrain strengthening + macro extension; assert against SAFE.
  function proveBlendBounds() {
    const G = K.GENRES, names = Object.keys(G);
    const rows = [], findings = [];
    const addRow = (dim, baseIv, safeKey, extras) => {
      const safe = SAFE[safeKey];
      if (!baseIv || !safe) { findings.push("NOTE suite lag: no SAFE bound declared for dimension " + dim + " — add its consumer bound (reported loud, non-gating: a missing table row is suite lag, not a kernel violation)"); return; }
      const ext = MACRO_EXT[safeKey] || MACRO_EXT[dim] || null;
      const macroIv = ext ? ext(baseIv.slice()) : null;
      const worst = macroIv ? hull(baseIv, macroIv) : baseIv;
      let status;
      if (inside(worst, safe)) status = "CLOSED";
      else if (safe.clamp) status = "CLAMPED";   // the ask escapes SAFE; the cited realization clamp closes it (the excess is a silently-trimmed ask — reported)
      else if (safe.open) status = "OPEN";
      else status = "VIOLATED";
      if (status === "VIOLATED") findings.push("bound does not close: " + dim + " hull " + fmtIv(worst) + " ⊄ SAFE [" + safe.lo + ", " + safe.hi + "]");
      if (status === "CLAMPED") findings.push("NOTE clamped ask: " + dim + " hull " + fmtIv(worst) + " exceeds SAFE [" + safe.lo + ", " + safe.hi + "] — closed downstream by: " + safe.clamp);
      if (status === "OPEN") findings.push("OPEN dimension (no hard consumer bound): " + dim + " — " + safe.open);
      rows.push(Object.assign({ dim, base: baseIv.map(x=>round(x)), macro: macroIv && macroIv.map(x=>round(x)), safe: [safe.lo, safe.hi], status, src: safe.src }, extras || {}));
    };

    // -- top scalars (wRange convex lerps)
    let bpm=null, sw=null, hz=null, adv=null, col=null, cx=null;
    for (const n of names) {
      const g = G[n];
      bpm = hull(bpm, asIv(g.bpm)); sw = hull(sw, asIv(g.swing)); hz = hull(hz, asIv(g.humanize));
      adv = hull(adv, asIv(g.theory && g.theory.adventure));
      col = hull(col, asIv(g.theory && g.theory.color));
      cx  = hull(cx,  asIv(g.rhythm));
    }
    addRow("bpm", bpm, "bpm");
    addRow("swing", sw, "swing");
    addRow("humanize", hz, "humanize");
    // constrain STRENGTHENS adventure: post-constrain hi = min(hull hi, .75)
    addRow("theory.adventure", [adv[0], Math.min(adv[1], 0.75)], "adventure", { note: "post-constrain: min(.75,·) — hull was " + fmtIv(adv) });
    addRow("theory.color", col, "color");
    addRow("rhythm.complexity", cx, "rhythmComplexity", { note: "constrain caps ≤.4 above 165bpm (strengthens; verified in the sweep)" });

    // -- fx scalars (blendRecipe weighted means; optional keys include 0 — a
    //    blend whose parents all lack the key emits none and toState maps →0)
    const fxHull = {}, fxCount = {};
    for (const n of names) for (const [k, v] of Object.entries(G[n].fx || {})) {
      const iv = asIv(v); if (!iv) continue;
      fxHull[k] = hull(fxHull[k], iv); fxCount[k] = (fxCount[k] || 0) + 1;
    }
    for (const k of Object.keys(fxHull)) {
      const optional = fxCount[k] < names.length;
      const base = optional ? hull(fxHull[k], [0, 0]) : fxHull[k];
      addRow("fx." + k, base, SAFE["fx." + k] ? "fx." + k : k, optional ? { note: "optional key (" + fxCount[k] + "/" + names.length + " anchors) — 0 included in hull" } : undefined);
    }

    // -- recipe scalars per voice: hull over anchors ∪ the engine default
    //    (blendRecipe skips keys no parent declares → E.defaultInstruments())
    const DEF = E.defaultInstruments();
    const VOICES = [
      ["bass",   (g)=>g.bass && g.bass.recipe,  DEF.bass,   { cutoff:"cutoffBass" }],
      ["lead",   (g)=>g.lead && g.lead.recipe,  DEF.melody, { cutoff:"cutoffLead" }],
      ["pad",    (g)=>g.pads && g.pads.recipe,  DEF.pad,    { cutoff:"cutoffPad" }],
    ];
    const KEY_SAFE = { level:"level", cutoff:"cutoffLead", res:"res", send:"send", dsend:"send",
      attack:"attack", release:"release", sustain:"sustain", fenv:"fenv", voices:"voices",
      spread:"spread", detune:"detune", vibrato:"vibrato" };
    for (const [vname, get, dflt, over] of VOICES) {
      const hulls = {}, counts = {};
      for (const n of names) {
        const r = get(G[n]); if (!r) continue;
        for (const [k, v] of Object.entries(r)) {
          const iv = asIv(v); if (!iv) continue;
          hulls[k] = hull(hulls[k], iv); counts[k] = (counts[k] || 0) + 1;
        }
      }
      for (const [k, iv0] of Object.entries(hulls)) {
        const safeKey = (over && over[k]) || KEY_SAFE[k];
        if (!safeKey) continue;   // envelope keys without a declared consumer bound ride the generic finite check below
        const dIv = asIv(dflt[k]);
        const base = counts[k] < names.length && dIv ? hull(iv0, dIv) : iv0;
        addRow(vname + "." + k, base, safeKey, counts[k] < names.length ? { note: "declared by " + counts[k] + "/" + names.length + " anchors; engine default " + (dIv ? fmtIv(dIv) : "—") + " folded in" } : undefined);
      }
      // every numeric recipe key must at least be FINITE (no consumer bound declared = reported, not asserted)
      for (const [k, iv0] of Object.entries(hulls))
        if (!Number.isFinite(iv0[0]) || !Number.isFinite(iv0[1]))
          findings.push("non-finite recipe hull: " + vname + "." + k + " " + fmtIv(iv0));
    }
    // -- drum recipe scalars
    {
      const hulls = {};
      for (const n of names) for (const [k, v] of Object.entries(G[n].drums || {})) {
        const iv = asIv(v); if (!iv) continue; hulls[k] = hull(hulls[k], iv);
      }
      for (const k of ["kick", "snare", "hat", "tom"]) if (hulls[k]) addRow("drums." + k, hulls[k], "drumLevel");
      if (hulls.tune) addRow("drums.tune", hulls.tune, "drumTune");
      if (hulls.send) addRow("drums.send", hulls.send, "send");
      if (hulls.dsend) addRow("drums.dsend", hulls.dsend, "send");
    }
    // -- found recipe
    {
      let vol=null, pit=null, str=null, cut=null;
      for (const n of names) { const f = G[n].found || {};
        vol=hull(vol,asIv(f.vol)); pit=hull(pit,asIv(f.pitch)); str=hull(str,asIv(f.stretch)); cut=hull(cut,asIv(f.cutoff)); }
      addRow("found.vol", vol, "foundVol");
      addRow("found.pitch", pit, "foundPitch", { note: "break role forces pitch=1 (constrain fallback + toState)" });
      addRow("found.stretch", str, "foundStretch");
      addRow("found.cutoff", cut, "foundCutoff");
    }
    // -- the neoclassical/deep-pass scalar specs + dominant-parent scalars
    {
      let rd=null, rp=null, tp=null, ta=null, ppl=null, ppm=null, tr=null, ce=[8,8], spp=null, at=null, mc=null, bn=null, loct=null;
      for (const n of names) {
        const g = G[n];
        if (g.rubato) { rd = hull(rd, asIv(g.rubato.depth || [0.02, 0.04])); rp = hull(rp, asIv(g.rubato.periodBars || [2, 4])); }
        if (g.thunk) { tp = hull(tp, asIv(g.thunk.prob || [0.2, 0.35])); ta = hull(ta, asIv(g.thunk.amp || [0.026, 0.038])); }
        if (g.timeFeel && g.timeFeel.pushPull) for (const v of Object.values(g.timeFeel.pushPull)) ppl = hull(ppl, asIv(v));
        if (g.timeFeel && g.timeFeel.pushPullMs) for (const v of Object.values(g.timeFeel.pushPullMs)) ppm = hull(ppm, asIv(v));
        if (g.transforms) tr = hull(tr, asIv(g.transforms.rate != null ? g.transforms.rate : 0.25));
        if (g.chordEvery) ce = hull(ce, asIv(g.chordEvery));
        if (g.snarePP != null) spp = hull(spp, asIv(g.snarePP));
        if (g.autoTune != null) at = hull(at, asIv(g.autoTune));
        if (g.masterComp != null) mc = hull(mc, asIv(g.masterComp));
        if (g.blueNote != null) bn = hull(bn, asIv(g.blueNote));
        if (g.leadOctave) loct = hull(loct, asIv(g.leadOctave));
      }
      if (rd) addRow("rubato.depth", rd, "rubatoDepth");
      if (rp) addRow("rubato.periodBars", rp, "rubatoPeriod");
      if (tp) addRow("thunk.prob", tp, "prob");
      if (ta) addRow("thunk.amp", ta, "prob", { note: "whisper-level amp — bounded like a probability (≈ -30dB region)" });
      if (ppl) addRow("timeFeel.pushPull", ppl, "pushPull");
      if (ppm) addRow("timeFeel.pushPullMs", ppm, "pushPullMs");
      if (tr) addRow("transforms.rate", hull(tr, [0.25, 0.25]), "transformsRate", { note: "0.25 = the engine default rate folded in" });
      addRow("chordEvery", hull(ce, [6, 6]), "chordEvery", { note: "meter default 6 folded in; constrain snaps meter blends to multiples of 6" });
      if (spp) addRow("snarePP", hull(spp, [0, 0]), "snarePP");
      if (at) addRow("autoTune", hull(at, [0, 0]), "autoTune");
      if (mc) addRow("masterComp", hull(mc, [0, 0]), "masterComp");
      if (bn) addRow("blueNote", hull(bn, [0, 0]), "blueNote");
      if (loct) addRow("leadOctave", loct, "leadOctave");
    }
    // -- insert-FX params: hull over every anchor's pools ∪ INSERT_DEFAULTS
    if (INSERT_DEFAULTS) {
      const acc = {};   // type -> param -> hull
      const eat = (cfg) => { if (!cfg || !Array.isArray(cfg.pool)) return;
        for (const [t, pr] of cfg.pool) for (const [k, v] of Object.entries(pr || {})) {
          const iv = asIv(v); if (!iv) continue;
          acc[t] = acc[t] || {}; acc[t][k] = hull(acc[t][k], iv);
        } };
      for (const n of names) { const g = G[n]; eat(g.bass && g.bass.inserts); eat(g.lead && g.lead.inserts); eat(g.pads && g.pads.inserts); }
      for (const [t, params] of Object.entries(acc)) {
        if (!INSERT_DEFAULTS[t]) continue;   // dead declaration — resolveMulti drops the type; reported by the pool proof, params unreachable
        const safeT = INSERT_SAFE[t];
        if (!safeT) { findings.push("NOTE suite lag: insert type '" + t + "' has no INSERT_SAFE authoring bounds yet — add them (non-gating: the type is live in INSERT_DEFAULTS; only the suite's table lags)"); continue; }
        for (const [k, iv0] of Object.entries(params)) {
          const dflt = INSERT_DEFAULTS[t] && INSERT_DEFAULTS[t][k];
          const base = dflt != null ? hull(iv0, asIv(dflt)) : iv0;
          const s = safeT[k];
          if (!s) { findings.push("NOTE suite lag: insert param " + t + "." + k + " has no SAFE bound yet"); continue; }
          const ok = inside(base, { lo: s[0], hi: s[1] });
          rows.push({ dim: "insert." + t + "." + k, base: base.map(x=>round(x)), macro: null, safe: s, status: ok ? "CLOSED" : "VIOLATED", src: "INSERT_SAFE authoring bounds; realization clamps at the Faust module slider" });
          if (!ok) findings.push("insert bound does not close: " + t + "." + k + " " + fmtIv(base));
        }
      }
    }
    // -- pipe spec params: hull over every anchor's pipes (weights stripped by resolveMulti)
    {
      const acc = {};
      for (const n of names) for (const sp of (G[n].pipes || []))
        for (const [k, v] of Object.entries(sp)) {
          if (k === "id" || k === "w") continue;
          const iv = asIv(v); if (!iv) continue;
          acc[k] = hull(acc[k], iv);
        }
      for (const [k, iv0] of Object.entries(acc)) {
        const s = PIPE_SAFE[k];
        if (!s) { findings.push("NOTE suite lag: pipe param '" + k + "' has no PIPE_SAFE bound yet"); continue; }
        const ok = inside(iv0, { lo: s[0], hi: s[1] });
        rows.push({ dim: "pipe." + k, base: iv0.map(x=>round(x)), macro: null, safe: s, status: ok ? "CLOSED" : "VIOLATED", src: "PIPE_SAFE authoring bounds; pipes.js clamps at write (A/CUT/SEND)" });
        if (!ok) findings.push("pipe bound does not close: " + k + " " + fmtIv(iv0));
      }
    }
    // -- hits / vox scalars
    {
      let prob=null, vol=null;
      for (const n of names) { const h = G[n].hits;
        if (h) { prob = hull(prob, asIv(h.prob != null ? h.prob : 0.5)); if (h.vol != null) vol = hull(vol, asIv(h.vol)); } }
      if (prob) addRow("hits.prob", prob, "prob");
      if (vol) addRow("hits.vol", hull(vol, [0.22, 0.22]), "foundVol", { note: "0.22 = toState default hit vol folded in" });
    }
    const ok = !findings.some(f => !/^(OPEN dimension|NOTE )/.test(f));   // OPEN + NOTE are documented findings; everything else gates
    return { rows, findings, ok,
      lemma: "every scalar above is emitted by resolveMulti as a convex combination of anchor endpoints (wRange / blendRecipe / specRange are weighted means with Σw=1), then sampled INSIDE the combined range — so the anchor hull bounds every blend at every point of the weight simplex, for every seed; constrain only clamps/substitutes (proveConstrain), and applyMacros' declared ranges are folded into the macro column" };
  }

  // ---------------------------------------------------------------- 4. pool enumeration proofs
  function provePools() {
    const G = K.GENRES, names = Object.keys(G);
    const rows = [], findings = [];
    const check = (pool, universeSet, label, srcNote, softNote) => {
      const unknown = [...pool].filter(x => !universeSet.has(x));
      const status = unknown.length ? (softNote ? "DEAD" : "VIOLATED") : "CLOSED";
      rows.push({ pool: label, members: pool.size, universe: universeSet.size, unknown, status, src: srcNote });
      if (unknown.length) {
        if (softNote) for (const u of unknown) findings.push("NOTE dead declaration: " + label + " '" + u + "' (" + declarersOf(u) + ") — " + softNote(u));
        else findings.push("pool members outside the engine vocabulary: " + label + " → " + unknown.join(", "));
      }
    };
    // which anchors declare a given token anywhere in their spec (finding enrichment)
    const declarersOf = (token) => {
      const who = [];
      for (const n of names) if (J(G[n]).includes('"' + token + '"')) { who.push(n); if (who.length >= 4) break; }
      return who.join(",") || "?";
    };
    const S = (arr) => new Set(arr);
    const uKits = new Set([...Object.keys(E.KITS), "off"]);
    const uProg = new Set(Object.keys(E.PROGRESSIONS));
    const uBass = new Set(E.BASS_PATTERNS);
    const uMel  = new Set(E.MELODY_PATTERNS);
    const uFill = new Set([...E.TRANSITIONS, "off"]);
    const uForm = new Set(K.FORM_NAMES);
    const uSrc  = new Set([...Object.keys(K.SOURCES), ...Object.keys(K.SAMPLES)]);
    const uSampler = new Set(Object.keys(K.SAMPLERS));
    const uDx7  = new Set(Object.keys(K.DX7_PATCHES));
    const uPipe = new Set(Object.keys((P && P.REGISTRY) || {}));
    const uModel = new Set(["dx7", "sampler"]);   // + everything isModel accepts, tested per member below
    const uWave = new Set(E.WAVES);

    const kits = new Set(), progs = new Set(), bassP = new Set(), melP = new Set(), fills = new Set(),
      forms = new Set(), srcs = new Set(), hitsSrc = new Set(), samplers = new Set(), dx7s = new Set(),
      pipes = new Set(), models = new Set(), waves = new Set(), stabs = new Set(), hitPats = new Set(),
      insertTypes = new Set(), tfOps = new Set(), grids = new Set(), voicings = new Set(), drumKits = new Set(),
      meters = new Set(), euclidBad = [];
    for (const n of names) {
      const g = G[n];
      (g.kits || []).forEach(k => kits.add(k));
      (g.progressions || []).forEach(p => progs.add(p));
      ((g.bass && g.bass.patterns) || []).forEach(p => bassP.add(p));
      ((g.lead && g.lead.patterns) || []).forEach(p => melP.add(p));
      (g.fills || []).forEach(f => fills.add(f));
      if (g.form) forms.add(g.form);
      // THE POOL LAW (repertoire wave 3): "pool:<class>*N" tokens prove
      // through their SOURCE_POOLS members — the token is sugar for a
      // per-(seed,class) draw over that member list (K.expandPools), so the
      // enumeration proof closes over the members; an unknown or empty class
      // keeps the raw token and stays a violation.
      const expandTok = (s, into) => {
        const mm = typeof s === "string" && /^pool:([a-z][a-z0-9_]*)(?:\*(\d))?$/.exec(s);
        const members = mm && (K.SOURCE_POOLS || {})[mm[1]];
        if (members && members.length) members.forEach(m => into.add(m));
        else into.add(s);
      };
      ((g.found && g.found.sources) || []).forEach(s => expandTok(s, srcs));
      ((g.hits && g.hits.sources) || []).forEach(s => expandTok(s, hitsSrc));
      if (g.hits && g.hits.pattern) hitPats.add(g.hits.pattern);
      (g.stab || []).forEach(s => stabs.add(s));
      for (const v of [g.bass, g.lead, g.pads]) {
        if (!v) continue;
        (v.samplerPool || []).forEach(s => samplers.add(s));
        (v.patchPool || []).forEach(p => dx7s.add(p));
        const m = v.recipe && v.recipe.model;
        (Array.isArray(m) ? m : m ? [m] : []).forEach(x => models.add(x));
        if (v.recipe && v.recipe.wave) waves.add(v.recipe.wave);
        if (v.inserts && Array.isArray(v.inserts.pool)) v.inserts.pool.forEach(([t]) => insertTypes.add(t));
      }
      for (const dm of ["kickModel", "snareModel", "hatModel"]) ((g.drums || {})[dm] || []).forEach(() => {});   // drum voice models are their own engine tables
      if (g.drums && g.drums.kit) drumKits.add(g.drums.kit);
      (g.pipes || []).forEach(sp => pipes.add(sp.id));
      if (g.transforms) (g.transforms.pool || []).forEach(op => tfOps.add(op));
      if (g.timeFeel && g.timeFeel.grid) grids.add(g.timeFeel.grid);
      if (g.theory && g.theory.voicing) voicings.add(g.theory.voicing);
      if (g.meter) meters.add(J([g.meter.beats, g.meter.unit || (g.meter.beats === 3 ? 4 : 8)]));
      for (const [lane, kn] of Object.entries(g.euclid || {}))
        if (!Array.isArray(kn) || !(kn[0] >= 1) || !(kn[1] >= kn[0]) || kn[1] > 32) euclidBad.push(n + "." + lane + "=" + J(kn));
    }
    // constrain's own substitutions join the sets they land in (enumerated escape hatches)
    kits.add("jungle"); melP.add("arpup"); srcs.add("amen_170");
    // buildSections' auto-fill vocabulary
    ["micro lick", "kit fill", "riser", "downlift"].forEach(f => fills.add(f));
    // pipes counterpoint mirror targets
    ["arpdown", "arpup", "sparse", "wander"].forEach(p => melP.add(p));

    check(kits, uKits, "kits (∪ constrain jungle-snap)", "E.KITS ∪ {off}");
    check(progs, uProg, "progressions", "E.PROGRESSIONS");
    check(bassP, uBass, "bass patterns", "E.BASS_PATTERNS");
    check(melP, uMel, "lead patterns (∪ constrain/counter substitutes)", "E.MELODY_PATTERNS");
    check(fills, uFill, "fills (∪ auto-fill vocabulary)", "E.TRANSITIONS ∪ {off}");
    check(forms, uForm, "forms", "K.FORM_NAMES (FORMS graph)");
    check(srcs, uSrc, "found sources (∪ constrain amen_170 fallback)", "K.SOURCES ∪ K.SAMPLES");
    check(hitsSrc, uSrc, "hit sources", "K.SOURCES ∪ K.SAMPLES (validate-genres gate 6 precedent)");
    check(samplers, uSampler, "sampler pools", "K.SAMPLERS");
    check(dx7s, uDx7, "dx7 patch pools", "K.DX7_PATCHES");
    check(pipes, uPipe, "pipe ids", "CsdPipes.REGISTRY");
    if (STAB_PATTERNS) check(stabs, new Set([...Object.keys(STAB_PATTERNS), "off"]), "stab patterns", "csd-engine STAB_PATTERNS ∪ {off} (extracted live)");
    if (HIT_PATTERNS) check(hitPats, new Set(Object.keys(HIT_PATTERNS)), "hit patterns", "csd-engine HIT_PATTERNS (extracted live)");
    if (INSERT_DEFAULTS) check(insertTypes, new Set(Object.keys(INSERT_DEFAULTS)), "insert types", "genre-kernel INSERT_DEFAULTS (extracted live)",
      (t) => "resolveMulti's insertsFor guards on INSERT_DEFAULTS[t] and silently DROPS the type, so the declared insert can NEVER fire"
        + (SRC.stateEngine && SRC.stateEngine.includes("insert_" + t) ? " — even though state-engine ships a working insert_" + t + " module (the ask is one INSERT_DEFAULTS entry away from real)" : ""));
    if (TRANSFORM_OPS) check(tfOps, new Set(Object.keys(TRANSFORM_OPS)), "transform ops", "csd-engine TRANSFORM_OPS (extracted live)");
    if (SWING_GRIDS) check(grids, new Set(Object.keys(SWING_GRIDS)), "timeFeel grids", "csd-engine SWING_GRIDS (extracted live)");
    check(voicings, S(["close", "open", "drop2", "quartal", "cluster"]), "theory voicings", "theory.js voicing styles (close|open|drop2|quartal|cluster)");
    if (DRUMKITS) check(drumKits, new Set(Object.keys(DRUMKITS)), "sampled drum kits", "genre-kernel DRUMKITS (extracted live)");
    check(meters, S([J([3, 4]), J([6, 8])]), "meters", "GENRE-SPACE.md ODD-METER: 3/4 and 6/8 are the proven meters");
    // recipe models: every non-dx7/sampler member must pass the engine's own isModel
    {
      const unknown = [...models].filter(m => !uModel.has(m) && !E.isModel(m));
      rows.push({ pool: "recipe models", members: models.size, universe: "E.isModel ∪ {dx7,sampler}", unknown, status: unknown.length ? "DEAD" : "CLOSED", src: "csd-engine isModel" });
      for (const m of unknown) findings.push("NOTE dead declaration: recipe model '" + m + "' (" + declarersOf(m) + ") — isModel rejects it; state-engine's default case renders the fallback timbre (supersaw lead / pad_saw / bass_saw) for that draw"
        + (SRC.stateEngine && SRC.stateEngine.includes('"' + m + '"') ? " — note state-engine DOES know '" + m + "' as an insert/strip effect, but not as a pitched voice model" : ""));
    }
    check(waves, uWave, "recipe waves", "E.WAVES");
    if (euclidBad.length) { findings.push("malformed euclid specs: " + euclidBad.join("; ")); rows.push({ pool: "euclid specs", unknown: euclidBad, status: "VIOLATED" }); }
    else rows.push({ pool: "euclid specs", members: names.filter(n => G[n].euclid).length, status: "CLOSED", src: "1 ≤ k ≤ n ≤ 32 per lane" });
    // meter anchors: every pooled kit's cell divides the meter chord bar (6)
    {
      const bad = [];
      for (const n of names) { const g = G[n]; if (!g.meter) continue;
        for (const k of g.kits || []) { const cell = (E.KITS[k] || {}).cell || 8; if (6 % cell !== 0) bad.push(n + ":" + k + " cell " + cell); } }
      rows.push({ pool: "meter kit tiling (cell | 6)", unknown: bad, status: bad.length ? "VIOLATED" : "CLOSED", src: "csd-engine drumEvents strides by kit.cell; meter default chordEvery=6" });
      if (bad.length) findings.push("meter anchor pools a kit whose cell does not divide the 6-beat bar: " + bad.join("; "));
    }
    return { rows, findings, ok: !findings.some(f => !/^(OPEN dimension|NOTE )/.test(f)) };   // DEAD declarations are documented findings, not violations
  }

  // ---------------------------------------------------------------- 5. constrain: the live clamps, proven on boundary inputs
  // Executes the EXTRACTED live constrain (not a mirror) against inputs at
  // and beyond each clamp edge — these are the facts the interval table cites.
  function proveConstrain() {
    const results = [], findings = [];
    if (!liveConstrain) return { results, findings: ["constrain could not be extracted — battery skipped"], ok: false };
    const base = () => {
      // a real resolved choice as the substrate (deterministic), then perturbed
      const c = K.resolveMulti([{ g: "techno", w: 1 }], 1);
      return JSON.parse(J(c));   // strips rng; constrain never draws
    };
    const t = (name, mut, verify) => {
      try {
        const c = base(); mut(c);
        const out = liveConstrain(c);
        const ok = !!verify(out);
        results.push({ name, ok });
        if (!ok) findings.push("constrain clamp did not hold: " + name);
      } catch (e) { results.push({ name, ok: false, err: e.message }); findings.push("constrain battery threw on " + name + ": " + e.message); }
    };
    t("adventure caps at .75", c => { c.theory.adventure = 0.99; }, o => o.theory.adventure <= 0.75 + EPS);
    t("reharm dies below .15 adventure", c => { c.theory.adventure = 0.1; c.theory.reharm = true; c.progression = "royal_road"; }, o => o.theory.reharm === false);
    t("drone progressions force restraint", c => { c.progression = "drone_min"; c.theory.adventure = 0.6; c.theory.reharm = true; }, o => o.theory.adventure <= 0.1 + EPS && o.theory.reharm === false);
    t("2-chord progressions drop composed leads", c => { c.progression = "deep_two"; c.leadPattern = "composed"; }, o => o.leadPattern === "arpup");
    t("bpm≥150 snaps loping kits to jungle", c => { c.bpm = 170; c.kit = "boombap"; delete c.meter; }, o => o.kit === "jungle");
    t("bpm≥150 spares machine kits", c => { c.bpm = 170; c.kit = "techno"; delete c.meter; }, o => o.kit === "techno");
    t("meter states keep their kit at speed", c => { c.bpm = 170; c.kit = "waltz"; c.meter = { beats: 3, unit: 4 }; }, o => o.kit === "waltz");
    t("kit off forces bed + no stab", c => { c.kit = "off"; c.foundRole = "chops"; c.stab = "offbeat"; }, o => o.foundRole === "bed" && o.stab === "off");
    t("slow chops fall back to bed", c => { c.foundRole = "chops"; c.bpm = 60; }, o => o.foundRole === "bed");
    t("break role requires a tempo-known sample", c => { c.foundRole = "break"; c.foundSource = "tokyo_station"; c.bpm = 120; }, o => o.foundSource === "amen_170");
    t("break-kind sample forces break role", c => { c.foundRole = "bed"; c.foundSource = "amen_170"; c.bpm = 120; }, o => o.foundRole === "break");
    t("densityArc evicts echoCanon", c => { c.pipes = [{ id: "densityArc", floor: 0.6 }, { id: "echoCanon", prob: 0.5 }]; }, o => !o.pipes.some(p => p.id === "echoCanon"));
    t("fast tracks cap rhythm complexity at .4", c => { c.bpm = 190; c.kit = "jungle"; c.rhythmComplexity = 0.8; }, o => o.rhythmComplexity <= 0.4 + EPS);
    t("distort never rides an already-driven voice", c => { c.leadRecipe.model = "fuzz"; c.leadInserts = [{ type: "distort", drive: 0.3, mix: 0.8 }]; }, o => !o.leadInserts.some(f => f.type === "distort"));
    // (idempotence of these outputs is covered at scale by the sweep's fixed-point check)
    return { results, findings, ok: !findings.length };
  }

  // ---------------------------------------------------------------- 6. the CATALOG (seeded sweeps)
  const PCH_RE = /^\d+\.\d{2}$/;
  // the found lane's amp ceiling DERIVES from the proof: buildEvents scales
  // break-chop amps ×2.1 (and chops ×1.7) over the resolved found vol, whose
  // convex hull over all anchors bounds every blend — so found amp ≤
  // max(volHi)×2.1. Pitched/drums amps keep the strict (0,1] contract
  // (measured full-catalog max: pitched .24, drums .95 — the snare-law's own
  // .95 cap). Discovered by the full sweep: glosspump×trenchsway@.5/s2
  // emits a break chop at amp 1.022 — legal, bounded, documented.
  const FOUND_AMP_CEIL = (() => {
    let hi = 0.45;
    for (const g of Object.values(K.GENRES)) { const v = g.found && g.found.vol; if (v) hi = Math.max(hi, Array.isArray(v) ? v[1] : v); }
    return Math.max(1, hi * 2.1) + 1e-9;
  })();
  function checkEvents(state, ev, ctx, out) {
    const bad = (msg) => out.push(ctx + ": " + msg);
    if (!ev || !Number.isFinite(ev.totalBeats) || ev.totalBeats <= 0) return bad("totalBeats " + (ev && ev.totalBeats));
    // structural law: totalBeats = Σ cycles×cycleBeats + 8 (the tail)
    const CB = Math.max(2, Math.round(state.chordEvery || (state.meter ? 6 : 8)));
    const cyc = E.getProgression(state.progression).chords.length * CB;
    const beats = state.sections.reduce((n, s) => n + (s.cycles || 1) * cyc, 0) + 8;
    if (Math.abs(beats - ev.totalBeats) > 1e-6) bad("totalBeats " + ev.totalBeats + " ≠ sections math " + beats);
    for (const [lane, arr] of [["pitched", ev.pitched], ["drums", ev.drums], ["found", ev.found], ["sfx", ev.sfx]]) {
      if (!Array.isArray(arr)) { bad(lane + " not an array"); continue; }
      for (const e of arr) {
        if (!Number.isFinite(e.beat) || e.beat < -1e-6) { bad(lane + " beat " + e.beat); break; }
        if (e.beat > ev.totalBeats + 8 + 1e-6) { bad(lane + " beat past the tail: " + e.beat + "/" + ev.totalBeats); break; }
        if (e.dur != null && !(e.dur > 0)) { bad(lane + " dur " + e.dur); break; }
        const ampCeil = lane === "found" ? FOUND_AMP_CEIL : 1 + 1e-9;   // break chops ride vol×2.1 by design (see FOUND_AMP_CEIL)
        if (e.amp != null && !(e.amp > 0 && e.amp <= ampCeil)) { bad(lane + " amp " + e.amp); break; }
        if (lane === "pitched") {
          if (!PCH_RE.test(String(e.pch)) || !Number.isFinite(E.pchToMidi(e.pch))) { bad("unparseable pch " + e.pch); break; }
        }
      }
    }
  }
  // ---- snare-law re-verification, from OUTSIDE (mirrors the law's own hash
  // exactly: 1/16-quantized onsets (round·2/2) + 3-level accent buckets +
  // the open flag; bars = the law's spans (sections), rolling window resets
  // on empty bars). The promise: no signature three-peats on the FINAL timeline.
  function checkSnareLaw(state, ev, ctx, out) {
    const CB = Math.max(2, Math.round(state.chordEvery || (state.meter ? 6 : 8)));
    const BARLEN = Math.min(CB, 8);
    const cyc = E.getProgression(state.progression).chords.length * CB;
    const q = (o) => Math.round(o * 2) / 2, bk = (a) => a < 0.14 ? 0 : a < 0.34 ? 1 : 2;
    // bucket on the COMPOSED accent (amp0, stashed by the dynamics envelope before
    // it faded the bar), not the post-envelope loudness: the snare-law is a
    // no-ad-nauseam PATTERN promise, and a fade already varies bar loudness, so
    // pattern-identical bars under one aren't a repeat. amp0 is absent on any bar
    // the envelope didn't touch => d.amp, i.e. byte-identical for un-faded bars.
    const av = (d) => d.amp0 != null ? d.amp0 : d.amp;
    const inBar = (b, b0) => b >= b0 - 1e-6 && b < b0 + BARLEN - 1e-6;
    const snSig = (l, b0) => l.map(d => q(d.beat - b0) + ":" + bk(av(d))).sort().join("|");
    const haSig = (l, b0) => l.map(d => q(d.beat - b0) + ":" + bk(av(d)) + (d.open ? "o" : "")).sort().join("|");
    let cur = 0; const spans = state.sections.map(s => { const sp = { start: cur, beats: (s.cycles || 1) * cyc }; cur += sp.beats; return sp; });
    let s1 = null, s2 = null, h1 = null, h2 = null, viol = 0;
    for (const sp of spans) {
      const nbars = Math.max(1, Math.round(sp.beats / BARLEN));
      for (let bi = 0; bi < nbars; bi++) {
        const b0 = sp.start + bi * BARLEN;
        const sn = ev.drums.filter(d => d.drum === "snare" && inBar(d.beat, b0));
        const ha = ev.drums.filter(d => d.drum === "hat" && inBar(d.beat, b0));
        const sSig = sn.length ? snSig(sn, b0) : null, hSig = ha.length ? haSig(ha, b0) : null;
        if (sSig != null && sSig === s1 && s1 === s2) viol++;
        if (hSig != null && hSig === h1 && h1 === h2) viol++;
        if (sSig != null) { s2 = s1; s1 = sSig; } else { s1 = s2 = null; }
        if (hSig != null) { h2 = h1; h1 = hSig; } else { h1 = h2 = null; }
      }
    }
    if (viol) out.push(ctx + ": snare-law three-peat ×" + viol);
  }
  // ---- harmonize clash-freedom, re-verified from OUTSIDE on real states:
  // every pipe-added harmony note's pitch-class ∈ the pad/bass pc-set sounding
  // at its beat (±0.12 beat slack for post-harmonize strum rolls). Skipped
  // when densityArc runs AFTER harmonize (it may drop the justifying pad note
  // — the pipe's own computation predates the drop; contract order caveat).
  function checkHarmonize(state, ev, ctx, out, stats) {
    const pipes = state.pipes || [];
    const hi = pipes.findIndex(p => p.id === "harmonize");
    if (hi < 0) return;
    if (pipes.some((p, i) => p.id === "densityArc" && i > hi)) { stats.harmSkipped++; return; }
    const SLACK = 0.12;
    const padBass = ev.pitched.filter(e => e.voice === "pad" || e.voice === "bass");
    let checked = 0;
    for (const e of ev.pitched) {
      if (!e.harm || e.echo) continue;
      checked++;
      const pc = ((E.pchToMidi(e.pch) % 12) + 12) % 12;
      const okPc = padBass.some(f => f.beat - SLACK <= e.beat && e.beat < f.beat + (f.dur || 0) + SLACK &&
        (((E.pchToMidi(f.pch) % 12) + 12) % 12) === pc);
      if (!okPc) { out.push(ctx + ": harmonize clash — harm pc " + pc + " not in sounding pad/bass set at beat " + round(e.beat, 2)); return; }
    }
    stats.harmChecked += checked;
  }
  // ---- duration solver contract: within ±10% of the 180s default target,
  // OR genuinely coarse (one harmonic cycle is wider than the ±10% band —
  // the solver's documented floored case). NO_AUTO_FORM forms are exempt
  // (they never receive the default target).
  function checkDuration(state, ctx, out, stats) {
    const form = state.genreMeta && state.genreMeta.form;
    if (NO_AUTO_FORM.has(form)) { stats.durExempt++; return; }
    const CB = Math.max(2, Math.round(state.chordEvery || (state.meter ? 6 : 8)));
    const cyc = E.getProgression(state.progression).chords.length * CB;
    const spb = 60 / state.bpm;
    const dur = (state.sections.reduce((n, s) => n + (s.cycles || 1) * cyc, 0) + 8) * spb;
    const T = AUTO_TARGET;
    if (dur >= T * 0.9 - 1e-6 && dur <= T * 1.1 + 1e-6) { stats.durInBand++; return; }
    const g0 = state.genreMeta && state.genreMeta.genres && state.genreMeta.genres[0];
    if (dur > T * 1.1 && NO_SECTION_DROP.has(g0)) { stats.durIdentity++; return; }   // identity beats the 180s rule (the witchhouse drone bridge — kernel NO_SECTION_DROP)
    const coarse = cyc * spb > T * 0.2;   // one cycle is wider than the whole ±10% band — the documented floored case
    if (coarse && dur > T * 1.1) { stats.durFloored++; stats.durFlooredList.push(ctx + " " + Math.round(dur) + "s (cycle " + Math.round(cyc * spb) + "s)"); return; }
    out.push(ctx + ": duration " + Math.round(dur) + "s outside ±10% of " + T + "s and not cycle-coarse");
  }
  // ---- meter tiling safety on built events
  function checkMeter(state, ev, ctx, out, pure) {
    if (!state.meter) return;
    const CB = Math.max(2, Math.round(state.chordEvery || 6));
    if (CB % 6 !== 0) out.push(ctx + ": meter chordEvery " + CB + " not a multiple of 6");
    const kit = state.genreMeta && state.genreMeta.kit;
    // cell tiling is an ANCHOR law: a meter anchor pools only 3/6-cell kits.
    // A BLEND may legitimately draw the 4/4 parent's kit under the meter
    // parent's bar line — engine-proven harmless polymeter (meter.test gate 7).
    if (pure && kit && kit !== "off" && E.KITS[kit]) {
      const cell = E.KITS[kit].cell || 8;
      if (CB % cell !== 0) out.push(ctx + ": kit " + kit + " cell " + cell + " does not tile chordEvery " + CB);
    }
    // no orphan kit beats outside a kitted section span. Allowances, each a
    // designed engine behavior: ±1.6 covers swing ≤.1 + humanize ≤.02 +
    // pushPull ≤.015 + rubato |Δ|≤.51 + the legal ≤cb spill onto the next
    // downbeat; a kitless span's FINAL 8+1.6 beats are the fill/transition
    // zone (snare rolls, tom fills INTO the next section — csd-engine
    // transitions live at section tails); toms are excluded entirely (the
    // thunk dimension couples them to LEAD notes, kit-independent by design).
    const cyc = E.getProgression(state.progression).chords.length * CB;
    let cur = 0; const spans = state.sections.map(s => { const sp = { start: cur, beats: (s.cycles || 1) * cyc, kit: s.drums }; cur += sp.beats; return sp; });
    const CORE = { kick: 1, snare: 1, hat: 1 };
    for (const e of ev.drums) {
      if (!CORE[e.drum]) continue;   // perc lanes tile their own 8-beat cell as a documented polymeter; toms ride thunk/fills
      const ok = spans.some(sp => {
        const lo = sp.kit && sp.kit !== "off" ? sp.start - 1.6 : sp.start + sp.beats - 9.6;   // kitless: fill zone only
        return e.beat >= lo && e.beat <= sp.start + sp.beats + 1.6;
      });
      if (!ok) { out.push(ctx + ": orphan " + e.drum + " at beat " + round(e.beat, 2) + " outside every kitted span/fill zone"); return; }
    }
  }
  // ---- constrain idempotence on a resolved choice (the fixed-point law)
  function checkIdempotent(choice, ctx, out) {
    if (!liveConstrain) return;
    const a = JSON.parse(J(choice));       // strips rng; constrain is rng-free
    const b = JSON.parse(J(a));
    liveConstrain(b);
    if (J(a) !== J(b)) out.push(ctx + ": constrain not idempotent (constrain∘constrain ≠ constrain)");
  }
  // ---- resolved-choice membership in the PROVEN intervals (the proof,
  // cross-checked empirically on every resolution the sweep touches)
  function mkMembership(proof) {
    const iv = {};
    for (const r of proof.rows) iv[r.dim] = r.base;
    const inIv = (name, v, out, ctx) => {
      const b = iv[name];
      if (!b || v == null) return;
      if (v < b[0] - 1e-6 || v > b[1] + 1e-6) out.push(ctx + ": " + name + "=" + v + " escapes the proven hull " + fmtIv(b));
    };
    return (c, ctx, out) => {
      inIv("bpm", c.bpm, out, ctx); inIv("swing", c.swing, out, ctx); inIv("humanize", c.humanize, out, ctx);
      if (c.theory) { inIv("theory.adventure", c.theory.adventure, out, ctx); inIv("theory.color", c.theory.color, out, ctx); }
      inIv("rhythm.complexity", c.rhythmComplexity, out, ctx);
      for (const [k, v] of Object.entries(c.fx || {})) if (typeof v === "number") inIv("fx." + k, v, out, ctx);
      for (const [vn, r] of [["bass", c.bassRecipe], ["lead", c.leadRecipe], ["pad", c.padRecipe]])
        for (const [k, v] of Object.entries(r || {})) if (typeof v === "number") inIv(vn + "." + k, v, out, ctx);
      for (const k of ["kick", "snare", "hat", "tom", "tune", "send", "dsend"])
        if (c.drumRecipe && typeof c.drumRecipe[k] === "number") inIv("drums." + k, c.drumRecipe[k], out, ctx);
      for (const [k, n2] of [["vol", "found.vol"], ["pitch", "found.pitch"], ["stretch", "found.stretch"], ["cutoff", "found.cutoff"]])
        if (c.foundRecipe && typeof c.foundRecipe[k] === "number") inIv(n2, c.foundRecipe[k], out, ctx);
    };
  }

  // ---------------------------------------------------------------- 7. blend continuity
  // Along seeded anchor-pair paths, adjacent t-steps with an UNCHANGED enum
  // fingerprint must move every scalar by a bounded delta (≤ 25% of that
  // field's whole-path span + integer slack). Enum flips are declared events
  // (pool/parent-pick switches) — counted, not compared across.
  function checkContinuity(nPaths, seed) {
    const names = Object.keys(K.GENRES);
    const rng = mulberry32(seed >>> 0);
    const out = [], pathsRun = [];
    let flips = 0, comparisons = 0;
    const scal = {}, enums = {};
    const flatten = (o, pre, S, En) => {
      for (const [k, v] of Object.entries(o)) {
        if (v == null) continue;
        const p = pre + k;
        if (/sections|foundSources|samplerLib|genreMeta|sampler|zones|euclid|sampleEvents|perc\b/.test(p)) continue;
        if (typeof v === "number") S[p] = v;
        else if (typeof v === "string" || typeof v === "boolean") En[p] = v;
        else if (Array.isArray(v)) { En[p + ".len"] = v.length; v.forEach((x, i) => { if (x && typeof x === "object") flatten(x, p + "." + i + ".", S, En); else En[p + "." + i] = String(x); }); }
        else if (typeof v === "object") flatten(v, p + ".", S, En);
      }
    };
    for (let pi = 0; pi < nPaths; pi++) {
      const a = names[Math.floor(rng() * names.length)];
      let b = names[Math.floor(rng() * names.length)];
      if (b === a) b = names[(names.indexOf(a) + 17) % names.length];
      pathsRun.push(a + "→" + b);
      const steps = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const st = K.blend(a, b, t, { seed: 3 });
        const S = {}, En = {};
        flatten({ bpm: st.bpm, swing: st.swing, humanize: st.humanize, reverb: st.reverb, pump: st.pump,
          crackle: st.crackle, comp: st.comp, grit: st.grit, jux: st.jux, snarePP: st.snarePP,
          delay: st.delay, tone: st.tone, instruments: st.instruments,
          kit: st.genreMeta.kit, prog: st.genreMeta.progression, bass: st.genreMeta.bass,
          lead: st.genreMeta.lead, pad: st.genreMeta.pad, form: st.genreMeta.form,
          found: st.genreMeta.found, meter: st.meter ? J(st.meter) : "4/4",
          pipes: (st.pipes || []).map(p => p.id).join("+") }, "", S, En);
        // chordEvery is a parent-PICK dimension (GENRE-SPACE: harmonic rhythm
        // is drawn by weight, never lerped — 8→16 at a crossover is a
        // designed structural flip, like meter). It fingerprints, not lerps.
        En["chordEvery"] = st.chordEvery || 8;
        // toState's gating thresholds are DECLARED discontinuities, not hidden
        // ones: pump/crackle/comp/grit/jux zero below .05, tone.highcut zeroes
        // ≤1000, tone.lowcut ≤10. Crossing a gate is an enum-grade flip — the
        // on/off state joins the fingerprint so the smooth-delta law applies
        // only while the gate holds (measured: a blend crossing highcut 1000
        // jumps 0→1007 by design).
        for (const k of ["pump", "crackle", "comp", "grit", "jux", "snarePP", "tone.lowcut", "tone.highcut"])
          En["gate:" + k] = (S[k] || 0) > 0;
        steps.push({ t, S, En: J(En) });
      }
      // per-field span over the whole path (comparable steps only)
      const span = {};
      for (const s of steps) for (const [k, v] of Object.entries(s.S)) {
        span[k] = span[k] || [v, v];
        if (v < span[k][0]) span[k][0] = v; if (v > span[k][1]) span[k][1] = v;
      }
      for (let i = 1; i < steps.length; i++) {
        if (steps[i].En !== steps[i - 1].En) { flips++; continue; }   // a declared enum flip — the audible event
        for (const [k, v] of Object.entries(steps[i].S)) {
          const u = steps[i - 1].S[k];
          if (u == null) continue;
          comparisons++;
          const w = span[k] ? span[k][1] - span[k][0] : 0;
          const allow = 0.25 * w + (Number.isInteger(u) && Number.isInteger(v) ? 1.001 : Math.abs(v) > 50 ? 1.5 : 0.02);
          if (Math.abs(v - u) > allow)
            out.push(a + "→" + b + " t=" + steps[i].t + ": " + k + " jumped " + round(u) + " → " + round(v) + " (allow ±" + round(allow) + ", span " + round(w) + ")");
        }
      }
    }
    return { paths: pathsRun, flips, comparisons, failures: out, ok: !out.length };
  }

  // ---------------------------------------------------------------- 8. the sweep driver
  function sweep(opts) {
    opts = opts || {};
    const full = !!opts.full;
    const names = Object.keys(K.GENRES);
    const t0 = Date.now();
    const failures = [];
    const stats = { anchorsBuilt: 0, pairBuilds: 0, resolutions: 0, harmChecked: 0, harmSkipped: 0,
      durInBand: 0, durFloored: 0, durExempt: 0, durIdentity: 0, durFlooredList: [], meterStates: 0 };
    const proof = opts.proof || proveBlendBounds();
    const membership = mkMembership(proof);

    const runBuild = (weights, seed, ctx) => {
      let choice, state, ev;
      try { choice = K.resolveMulti(weights.map(w => ({ ...w })), seed); }
      catch (e) { failures.push(ctx + ": resolveMulti threw — " + e.message); return; }
      checkIdempotent(choice, ctx, failures);
      membership(choice, ctx, failures);
      try {
        state = K.mix(weights.map(w => ({ ...w })), { seed });
        ev = E.buildEvents(state);
      } catch (e) { failures.push(ctx + ": build threw — " + e.message); return; }
      checkEvents(state, ev, ctx, failures);
      checkSnareLaw(state, ev, ctx, failures);
      checkHarmonize(state, ev, ctx, failures, stats);
      checkDuration(state, ctx, failures, stats);
      checkMeter(state, ev, ctx, failures, weights.length === 1);
      if (state.meter) stats.meterStates++;
    };
    const runStateOnly = (weights, seed, ctx) => {
      let choice;
      try { choice = K.resolveMulti(weights.map(w => ({ ...w })), seed); }
      catch (e) { failures.push(ctx + ": resolveMulti threw — " + e.message); return; }
      stats.resolutions++;
      checkIdempotent(choice, ctx, failures);
      membership(choice, ctx, failures);
    };

    // (a) all anchors × seeds — full event builds
    const seeds = full ? [1, 2, 3, 4, 5] : [1, 2];
    for (const g of names) for (const s of seeds) { runBuild([{ g, w: 1 }], s, g + "/s" + s); stats.anchorsBuilt++; }

    // (b) pair resolutions at the STATE level: exhaustive in full mode
    // (every unordered pair × t ∈ {.25,.5,.75} × seeds {1,2}), a seeded
    // subsample in quick mode. This is where the convexity proof is
    // cross-checked over the whole pair lattice.
    const ts = [0.25, 0.5, 0.75];
    if (full) {
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++)
        for (const t of ts) for (const s of [1, 2])
          runStateOnly([{ g: names[i], w: 1 - t }, { g: names[j], w: t }], s, names[i] + "×" + names[j] + "@" + t + "/s" + s);
    } else {
      const rng = mulberry32(20260710);
      for (let k = 0; k < 3000; k++) {
        const i = Math.floor(rng() * names.length); let j = Math.floor(rng() * names.length);
        if (j === i) j = (j + 31) % names.length;
        const t = ts[k % 3], s = 1 + (k % 2);
        runStateOnly([{ g: names[i], w: 1 - t }, { g: names[j], w: t }], s, names[i] + "×" + names[j] + "@" + t + "/s" + s);
      }
    }

    // (c) pair BUILDS (events level): a seeded subsample — the honest
    // sample-down (a full 155k-build sweep costs ~35min at ~13ms/build;
    // the state-level lattice above is exhaustive instead).
    {
      const rng = mulberry32(715);
      const n = full ? 4000 : 300;
      for (let k = 0; k < n; k++) {
        const i = Math.floor(rng() * names.length); let j = Math.floor(rng() * names.length);
        if (j === i) j = (j + 53) % names.length;
        const t = ts[k % 3], s = 1 + (k % 2);
        runBuild([{ g: names[i], w: 1 - t }, { g: names[j], w: t }], s, names[i] + "×" + names[j] + "@" + t + "/s" + s);
        stats.pairBuilds++;
      }
    }

    // (d) meter anchors get a dedicated dense pass (every meter anchor × seeds 1-3)
    for (const g of names) {
      if (!K.GENRES[g].meter) continue;
      for (const s of [1, 2, 3]) runBuild([{ g, w: 1 }], s, "meter:" + g + "/s" + s);
    }

    stats.ms = Date.now() - t0;
    return { failures, stats, ok: !failures.length };
  }

  // ---------------------------------------------------------------- 9. prove — the whole suite
  function prove(opts) {
    opts = opts || {};
    const t0 = Date.now();
    const proof = proveBlendBounds();
    const pools = provePools();
    const battery = proveConstrain();
    const sw = sweep({ full: opts.full, proof });
    const cont = checkContinuity(opts.full ? 20 : 5, 2026);
    const findings = [
      ...EXTRACTION_FINDINGS,
      ...proof.findings, ...pools.findings, ...battery.findings,
      ...sw.failures.slice(0, 40), ...cont.failures.slice(0, 20),
    ];
    // Severity: OPEN dimensions, NOTE clamped-asks and NOTE dead declarations
    // are DOCUMENTED FINDINGS — the product, reported every run, non-gating
    // (the musicality gate-8 soft posture). Everything else is a hard failure:
    // a bound that truly doesn't close, a totality crash, a law violation.
    const hard = findings.filter(f => !/^(OPEN dimension|NOTE )/.test(f));
    const notes = findings.filter(f => /^(OPEN dimension|NOTE )/.test(f));
    return { proof, pools, battery, sweep: sw, continuity: cont, findings, hard, notes,
      ok: !hard.length, ms: Date.now() - t0, mode: opts.full ? "full" : "quick" };
  }

  const api = { proveBlendBounds, provePools, proveConstrain, sweep, checkContinuity, prove, SAFE, MACRO_EXT,
    // internal checkers exported for the test's FALSIFIABILITY gates (a
    // checker that cannot fail proves nothing — the tests feed each one a
    // synthetic violation and assert it fires)
    _checks: { checkEvents, checkSnareLaw, checkHarmonize, checkDuration, checkMeter, checkIdempotent, mkMembership, liveConstrain } };
  if (isNode) module.exports = api; else root.Invariants = api;

  // ---------------------------------------------------------------- CLI
  if (isNode && require.main === module) {
    const args = process.argv.slice(2);
    const cmd = args[0] || "prove";
    const full = args.includes("--full");
    const json = args.includes("--json");
    if (cmd !== "prove") { console.error("usage: node engine/invariants.js prove [--full] [--json]"); process.exit(2); }
    const R = prove({ full });
    if (json) { console.log(J(R, null, 1)); process.exit(R.ok ? 0 : 1); }
    console.log("INVARIANTS — " + R.mode + " mode, " + (R.ms / 1000).toFixed(1) + "s\n");
    console.log("— PROVEN interval bounds (convex-hull proof over the whole blend space) —");
    const pad = (s, n) => (s + "                                            ").slice(0, n);
    for (const r of R.proof.rows)
      console.log("  " + pad(r.dim, 24) + pad(fmtIv(r.base), 20) + pad(r.macro ? "macro " + fmtIv(r.macro) : "", 26) +
        pad("SAFE [" + r.safe[0] + ", " + r.safe[1] + "]", 24) + r.status);
    console.log("\n— pool enumerations —");
    for (const r of R.pools.rows)
      console.log("  " + pad(r.pool, 44) + (r.status === "CLOSED" ? "CLOSED (" + (r.members != null ? r.members + " members" : "ok") + ")" : r.status + ": " + (r.unknown || []).join(",")));
    console.log("\n— constrain battery (the LIVE constrain on boundary inputs) —");
    for (const r of R.battery.results) console.log("  " + (r.ok ? "PASS" : "FAIL") + "  " + r.name + (r.err ? "  (" + r.err + ")" : ""));
    const st = R.sweep.stats;
    console.log("\n— sweep —  " + (st.ms / 1000).toFixed(1) + "s: " + st.anchorsBuilt + " anchor builds, " +
      st.resolutions + " pair resolutions (state-level), " + st.pairBuilds + " pair builds (events), " + st.meterStates + " meter states");
    console.log("  duration: " + st.durInBand + " in ±10% band, " + st.durFloored + " cycle-coarse floored (documented), " + st.durIdentity + " identity-exempt (NO_SECTION_DROP), " + st.durExempt + " video-locked exempt");
    if (st.durFlooredList.length) console.log("    floored: " + st.durFlooredList.slice(0, 12).join("; ") + (st.durFlooredList.length > 12 ? " …+" + (st.durFlooredList.length - 12) : ""));
    console.log("  harmonize: " + st.harmChecked + " harm notes verified clash-free, " + st.harmSkipped + " states skipped (densityArc after harmonize)");
    console.log("  continuity: " + R.continuity.paths.length + " paths, " + R.continuity.comparisons + " scalar comparisons, " + R.continuity.flips + " declared enum flips, " + R.continuity.failures.length + " jumps");
    if (R.notes.length) {
      console.log("\n— DOCUMENTED FINDINGS (the product — real, reported every run, non-gating) —");
      for (const f of R.notes) console.log("  * " + f);
    }
    if (R.hard.length) {
      console.log("\n— HARD FAILURES —");
      for (const f of R.hard) console.log("  * " + f);
    }
    console.log("\n" + (R.ok ? "PASS: every provable bound closes (or is clamped at a cited consumer); every sweep property holds" : "FAIL: see hard failures"));
    process.exit(R.ok ? 0 : 1);
  }
})(typeof window !== "undefined" ? window : globalThis);
