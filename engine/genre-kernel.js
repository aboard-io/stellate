#!/usr/bin/env node
// genre-kernel.js — genre as a point in a multidimensional space; a song as a
// seeded sample near a point; a playlist as a path. Design: GENRE-SPACE.md.
//
// A LIBRARY, not a program: the command line that drives it is
// tools/kernel-cli.js (it used to live down the bottom of this file behind
// require.main===module, which meant every browser parsed 243 lines of fs and
// child_process it could never run).
//
// v2: timbre, mixing, and sampling are first-class dimensions. Every anchor
// specifies synthesis MODELS (pad organ/fm/saw, bass sub/acid/reese/saw, lead
// stack/pluck/fm, drum kick/snare/hat models), mix discipline (compression,
// drum reverb/delay sends, snare LEVEL — the snare never dominates), and a
// sample plan (breaks chopped beat-synced, one-shot hits, vocal hooks).
// Blending stays combinatorial: discrete dimensions draw from either parent.

(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const E = isNode ? require("./csd-engine.js") : root.CsdEngine;
  // THE DATA (Stage E1). 810 KB of inert literals live in generated classic
  // scripts so this file stays a thing a person can read. Same synchronous
  // contract as the engine handle above: present before the first statement
  // that needs it, in node by require and in the browser by load order.
  const DATA = isNode
    ? Object.assign({}, require("./genres-data.js"), require("./registry-data.js"))
    : Object.assign({}, root.__GENRES, root.__REGISTRY);

  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const lerp=(a,b,t)=>a+(b-a)*t;
  const pick=(r,arr)=>arr[Math.floor(r()*arr.length)];
  const inRange=(r,[lo,hi])=>lo+r()*(hi-lo);
  const lerpRange=(A,B,t)=>[lerp(A[0],B[0],t),lerp(A[1],B[1],t)];
  const round=(x,p)=>Math.round(x*10**(p||2))/10**(p||2);

  // ---------- found-sound + sample registry (recipes: fetch-found-sound.sh / fetch-found-samples.sh) ----------
  const SOURCES = DATA.SOURCES;
  // ---------- SOURCE POOLS (the repertoire law) ----------
  // No found sound is locked into one genre. A sources list may
  // name a CLASS instead of a raw id — "pool:city" (3 seeded members) or
  // "pool:city*2" (2) — and expandPools swaps the token for members drawn on a
  // DEDICATED per-(seed,class) stream: zero draws on the shared rng, so every
  // genre without a token is byte-identical, and the same seed always draws the
  // same members (determinism law). IDENTITY beds stay raw ids in their anchors
  // (the loon is canawave's; the whale is whalejazz's — the bird-rarity law
  // keeps birds out of the general pools). Wave 3 fills these classes from the
  // bed-curation register (scratch/bed-curation/BEDS.md, 79 verified beds).
  const SOURCE_POOLS = DATA.SOURCE_POOLS;
  // id -> declared voice family (registry VOICE_FAMILIES). Stamped onto the
  // foundSources entry so the repeat governor can substitute inside a curated
  // cast whose family is not spelled in the id; absent for every other id.
  const VOICE_FAM = (()=>{ const m={}; const F=DATA.VOICE_FAMILIES||{};
    for(const f in F) for(const id of F[f]) m[id]=f; return m; })();
  const fnv1a = (str)=>{ let h=2166136261>>>0; for(const ch of String(str)) h=Math.imul(h^ch.charCodeAt(0),16777619); return h>>>0; };
  // `widen` adds members to every pool token without changing the ones already
  // there: the dedicated stream draws in a fixed order, so the first N ids of a
  // widened expansion are byte-identical to the unwidened one and only the TAIL
  // is new. Used by the bed rotation (foundPool) alone — foundSource / voxPool /
  // hits expand unwidened, so the primary source a genre opens on never moves.
  function expandPools(list, seed, widen){
    if(!Array.isArray(list) || !list.some(x=>typeof x==="string" && x.slice(0,5)==="pool:")) return list;
    const out=[];
    for(const m of list){
      const mm=typeof m==="string" ? /^pool:([a-z][a-z0-9_]*)(?:\*(\d))?$/.exec(m) : null;
      if(!mm){ out.push(m); continue; }
      const pool=(SOURCE_POOLS[mm[1]]||[]).slice();
      const n=Math.min(pool.length, +(mm[2]||3)+(widen||0));
      const r=mulberry32((((seed??1)>>>0) ^ fnv1a(mm[1]) ^ 0x9E00D5) >>> 0);   // dedicated stream: the shared rng never moves
      for(let i=0;i<n && pool.length;i++) out.push(pool.splice(Math.floor(r()*pool.length),1)[0]);
    }
    return out;
  }
  const FOUND_POOL_WIDEN=3, FOUND_POOL_CAP=12;
  // the one-shot layer is an ALL-OR-NOTHING coin per track (`hits` below), and the
  // authored probabilities average 0.34 — most tracks got no one-shots whatsoever,
  // which is also why the sp_* speech ids parked in hits.sources rarely fired.
  // HITS_LIFT reshapes the coin: 1-(1-p)^k keeps the endpoints and the per-genre
  // ordering (a rare-hits genre stays the rarest) while lifting the mean to ~0.75.
  // The density that a track WITH the layer gets is thinned to match in
  // csd-engine.js (HIT_SLOT_SKIP): across 274 genres x 8 seeds the share of
  // tracks carrying the layer goes 30% -> 70% while the mean one-shots per track
  // moves only 2.4 -> 3.0 (8.0 -> 4.3 on the tracks that have it). The same
  // amount of material, spread across the catalog instead of pooled in a third
  // of it — which is the point: a thin layer everywhere reads better than a
  // dense layer in one track out of three and silence in the other two.
  const HITS_LIFT=5, hitsProb=p=>1-Math.pow(1-p,HITS_LIFT);
  // sample layer: local files under found/samples/ (kind: break|hit|vox)
  const SAMPLES = DATA.SAMPLES;
  // ---------- THE SYNTHESIZED VOICE BANK (voxbank) ----------
  // 12 families x 30 espeak-ng phrases (tools/build/voxbank-phrases.json — the committed
  // source text; tools/build/gen-voice-bank.js renders them deterministically). The wavs
  // live gitignored under found/samples/voxbank/<family>/vb_<family>_NN.wav; only
  // the per-clip `dur` is mirrored here (baked from the manifest, exactly the way
  // DRUMKITS mirrors `len` and SAMPLERS mirrors zones — committed source, derived
  // audio). Expanded below into SAMPLES {kind:"vox"} entries + one SOURCE_POOLS
  // pool per family (vb_<family>). License-free (synthesized), tier 1 in SOURCES.md.
  const VOXBANK = DATA.VOXBANK;
  // expand the voxbank into SAMPLES (vb_<family>_NN, kind:"vox") + SOURCE_POOLS
  // (one pool per family). Mutates the already-defined const objects — same as any
  // other registry, just baked from the compact table above.
  (function expandVoxbank(){
    for(const fam of Object.keys(VOXBANK)){
      const v=VOXBANK[fam], ids=[];
      for(let i=0;i<v.n;i++){
        const nn=String(i+1).padStart(2,"0"), id="vb_"+fam+"_"+nn;
        SAMPLES[id]={ file:"voxbank/"+fam+"/"+id+".wav", kind:"vox", durSec:v.dur[i] };
        ids.push(id);
      }
      SOURCE_POOLS["vb_"+fam]=ids;
    }
  })();

  // ---------- DX7 patch registry (the genre-space thesis applied to INSTRUMENTS) ----------
  // A patch is a point in a ~144-dim parameter space (per-operator envelopes,
  // levels, tuning — decoded from real cartridge banks by faust/sysex2params.js
  // into faust/dx7-presets.json). Anchors may declare a pad/lead/bass model
  // "dx7" plus a patchPool of names; resolveMulti picks per side() like every
  // other pool, and BLENDING two dx7 parents with the SAME algorithm lerps the
  // param vectors by weight — patch-space morphing, exactly like genre blending.
  // Different algorithms are different topologies: pick a side, never smear.
  // toState emits state.instruments.<voice>.dx7 = {algorithm, params} — the
  // contract the Faust engine consumes.
  const DX7_PATCHES=(()=>{
    let raw={};
    if(isNode){ try{ raw=require("./faust/data/dx7-presets.json"); }catch(e){} }
    else if(root.DX7_PRESETS) raw=root.DX7_PRESETS;   // browser: page may inline the presets
    const reg={};
    for(const [name,p] of Object.entries(raw||{}))
      if(p&&p.params) reg[name]={algorithm:p.alg, params:p.params};
    // SILENT-ROM REMAP (measured by tools/audit/font-coverage.js
    // --dx7-rms): 8 of the 114 converted ROM patches render < -60 dBFS — dead
    // conversions, and "TUB BELLS" alone was wired into 23 anchors' patchPools
    // as a silently-dead voice option. Each remaps to its nearest AUDIBLE
    // sibling (bells->celeste, plucked->the working guitar/harpsi/koto,
    // timpani->vibe) so every reference — anchor pools, dx7-font family
    // fallbacks — lands on a patch that speaks. The names stay: a patchPool
    // asking for "TUB BELLS" gets the celeste params under that name.
    const SILENT_REMAP={ "TUB BELLS":"CELESTE", "BELLS":"CELESTE", "TIMPANI":"VIBE    1",
      "GUITAR  3":"GUITAR  1", "SPANISHGTR":"GUITAR  1", "LUTE":"HARPSICH 1",
      "LOG DRUM":"MARIMBA", "PIZZ STGS":"KOTO" };
    for(const [dead,alive] of Object.entries(SILENT_REMAP))
      if(reg[dead]&&reg[alive]) reg[dead]={algorithm:reg[alive].algorithm, params:reg[alive].params};
    return reg;
  })();

  // ---------- per-voice insert FX (a NEW axis of the space) ----------
  // Anchors may give any voice (bass/lead/pads) an `inserts` spec:
  //   inserts:{ prob:.5, max:2, pool:[["distort",{drive:[.2,.5],mix:[.6,.9]}], ...] }
  // pool entries are [type, paramRanges] like every other recipe: ranges sample
  // seeded, scalars pass through. resolveMulti unions pools across parents by
  // weight (combinatorial, like kits/progressions) and BLENDS the param ranges
  // of parents that share a type (weighted, blendRecipe-style), then draws a
  // 0-2 entry chain. toState emits state.instruments.<voice>.inserts =
  // [{type, ...params}] — the Faust engine's contract (see csd-engine
  // defaultInstruments for units). Constraints live in constrain(): no distort
  // on already-fuzz leads, no chorus/phaser on sub bass, no filtersweep on
  // wobble (the wobble IS the sweep).
  const INSERT_DEFAULTS={
    distort:    { drive:0.3, mix:1 },
    phaser:     { rate:0.25, depth:0.6, mix:0.5 },
    chorus:     { rate:0.8,  depth:0.5, mix:0.5 },
    filtersweep:{ rateBars:4, lo:-1, hi:1, res:0.3 },
    wah:        { sens:0.6, base:320, range:2.2, q:4, mix:0.85 },   // fx wings stage 3: auto-wah (funk/disco bass)
    tremolo:    { rate:5, depth:0.7, shape:0, wobble:0, mix:0.8, rateBars:null },   // amp tremolo (surf) + vibraphone fan (exotica wobble); rateBars = tempo-synced division (SYNTHESIS-DEPTH Part C; null default => key omitted, the free-Hz path — trance's 1/16 gate claims it)
    granular:   { pitch:0, density:0.5, rate:12, mix:0.5 },   // grain stutter/cloud — was a DEAD declaration (dubstep's clouds never fired; invariants finding, SYNTHESIS-DEPTH fix)
    delay:      { timeBars:0.1875, feedback:0.35, tone:3000, wow:0.2, mix:0.35 },   // per-voice TAPE echo (state-engine case "delay", barSec) — RING-CLASS: registered so guitar/pad leads can draw a tempo-synced delay INSERT (was a state-engine module with no kernel pool entry, so pool-declared delays were silently dropped at the INSERT_DEFAULTS filter); tone/wow color the loop like the per-model default chains
    // SYNTHESIS-DEPTH anchor wiring (balance loop 3): the staged heavy amp and
    // the sampled-voice filter envelope join the drawable pool. ALL defaults
    // null: an anchor consumes rng only for the keys it declares; unspecified
    // keys stay ABSENT from the drawn chain so state-engine's own defaults
    // (and the fenv base=voice-cutoff law) apply — same absent-law as recipes.
    higain:     { gate:null, drive:null, stages:null, low:null, mid:null, high:null, presence:null, level:null, mix:null },
    fenv:       { sens:null, amount:null, attack:null, decay:null, base:null, res:null, mix:null },
  };

  // ---------- SAMPLER instruments (real sampled instruments — the sax ask) ----------
  // Zones extracted from FluidR3_GM (Frank Wen, MIT license) by faust/sf2.js
  // at fetch time (fetch-found-samples.sh) into found/samples/instruments/.
  // This IS the answer to "can Faust play soundfonts": Faust's soundfile
  // primitive can't read SF2, so the ENGINE plays them natively — zone wavs
  // ride foundSources (vol 0) into the AudioBufferSourceNode / PCM-mix path
  // (faust/sampler.js), with SF2 loop points for proper sustained notes.
  // root may be fractional (SF2 coarse/fine tune folded in); ls/le = loop
  // start/end in samples at `sr`. Anchors opt in via voice model "sampler"
  // + samplerPool:[ids]; resolveMulti picks per side() like every pool.
  const SAMPLERS = DATA.SAMPLERS;

  // ---------- SOUNDFONT SWITCHER ----------
  // The default sampled instruments above are FluidR3 (baked). Alternate fonts —
  // extracted by tools/build/gen-font.js into found/samples/instruments-<key>/ + a
  // font-<key>.json {base, instr:{slug:{sr,zones}}} — register at runtime; the
  // active font re-voices every sampled instrument it covers, falling back to
  // FluidR3 per-instrument for anything the font lacks. Presentational: default
  // "fluidr3" is untouched, so fixtures / segment-parity stay byte-identical.
  let ACTIVE_FONT="fluidr3";
  const FONTS=Object.create(null);
  function registerFont(key,data){ if(key && data && data.instr) FONTS[key]={base:data.base||("instruments-"+key), instr:data.instr}; }
  function setFont(key){ ACTIVE_FONT=(key && FONTS[key])?key:"fluidr3"; }
  function activeFont(){ return ACTIVE_FONT; }
  function fontList(){ return ["fluidr3", ...Object.keys(FONTS)]; }

  // ---------- SYNTH FONTS (DX7 / MiniMoog) ----------
  // A NON-sample font: picking it routes the sampler lane to a Faust synth voice
  // per GM instrument instead of samples (Wendy-Carlos "Switched-On Bach"). No
  // assets — pure params, registered built-in. OPT-IN + presentational: the
  // default fluidr3 is untouched, so every deterministic gate stays byte-identical
  // (state.samplerLib only differs when a synth font is ACTIVE). The kernel
  // resolves each instrument id to {synth, params}; state-engine's forceSampled
  // sees `spec.synth` and builds a modeld/dx7 unit through its EXISTING dispatch.
  // Family classifier: map a GM instrument id to a tonal family, then to a MiniMoog
  // (modeld: 3 osc + ladder + filter-env + glide) voice — cutoff/res/env/attack/
  // sustain/drive/oscMix/drift are the analog palette.
  function instrFamily(id){
    // ORDER + WORD-SHAPE MATTER (gated by test/unit/font-coverage.test.js):
    // "nylon_STRING_guitar" matches the string rule before the pluck rule if
    // string comes first — guitars then land on the slow-attack juno60 pad
    // voice and lead lines all but vanish. And a bare /bass/ swallows
    // "bassoon". Pluck outranks string, and bass must not eat the reed.
    if(/guitar|banjo|sitar|harp\b|koto|shamisen|clav|harpsichord/.test(id)) return "pluck";
    if(/bass(?!oon)/.test(id)) return "bass";
    if(/organ/.test(id)) return "organ";   // before reed: reed_organ IS an organ (comparator's catch)
    if(/piccolo|flute|recorder|pan_flute|ocarina|whistle/.test(id)) return "flute";
    if(/sax|clarinet|oboe|bassoon|english_horn|harmonica|bagpipe|accordion|bandoneon|reed/.test(id)) return "reed";
    if(/trumpet|trombone|tuba|horn|brass/.test(id)) return "brass";
    if(/violin|viola|cello|contrabass|fiddle|string|pizzicato|bowed_glass/.test(id)) return "string";
    if(/glocken|celesta|music_box|vibraphone|marimba|xylophone|steel_drum|kalimba|tubular/.test(id)) return "mallet";
    if(/choir|voice|vox|solo_vox/.test(id)) return "voice";
    if(/piano|rhodes|electric_piano|honky|epiano|grand/.test(id)) return "key";   // "grand" catches bright_yamaha_grand (was falling to generic lead — the comparator's catch)
    return "lead";
  }
  // MiniMoog voice per family (modeld params). Osc waveform is fixed in modeld.dsp;
  // character comes from cutoff/env/attack/sustain/drive/oscMix/drift + glide.
  const MINIMOOG_FAMILY={
    bass:  { cutoff:820,  res:0.30, envAmount:1.8, envDecay:0.16, attack:0.004, sustain:0.80, drive:0.40, oscMix:0.68, drift:5,  glide:16, release:0.14, levelMul:1.35 },   // makeup gain: measured 35% under fluidr3 in the live mix
    flute: { cutoff:2600, res:0.08, envAmount:0.5, envDecay:0.30, attack:0.06,  sustain:0.92, drive:0.10, oscMix:0.15, drift:5,  glide:0,  release:0.22 },
    reed:  { cutoff:1750, res:0.24, envAmount:1.1, envDecay:0.24, attack:0.03,  sustain:0.85, drive:0.22, oscMix:0.42, drift:5,  glide:0,  release:0.20 },
    brass: { cutoff:1450, res:0.20, envAmount:2.6, envDecay:0.26, attack:0.03,  sustain:0.80, drive:0.36, oscMix:0.50, drift:5,  glide:6,  release:0.24 },
    string:{ cutoff:1650, res:0.16, envAmount:1.0, envDecay:0.40, attack:0.16,  sustain:0.88, drive:0.16, oscMix:0.50, drift:11, glide:0,  release:0.45 },
    mallet:{ cutoff:3000, res:0.12, envAmount:1.5, envDecay:0.30, attack:0.002, sustain:0.10, drive:0.14, oscMix:0.30, drift:6,  glide:0,  release:0.30 },
    organ: { cutoff:2800, res:0.10, envAmount:0.3, envDecay:0.20, attack:0.01,  sustain:0.95, drive:0.18, oscMix:0.50, drift:5,  glide:0,  release:0.10 },
    voice: { cutoff:1500, res:0.22, envAmount:0.5, envDecay:0.30, attack:0.12,  sustain:0.90, drive:0.12, oscMix:0.35, drift:8,  glide:0,  release:0.30 },
    pluck: { cutoff:2200, res:0.20, envAmount:2.0, envDecay:0.24, attack:0.003, sustain:0.34, drive:0.30, oscMix:0.40, drift:5,  glide:0,  release:0.22, levelMul:2.6 },   // sf-dropout fix: a .15s-decay-to-.2 plink measures rms .004 as a LEAD (5x under fluidr3 — the guitar vanishes); still plucky, but it speaks
    key:   { cutoff:2000, res:0.14, envAmount:1.2, envDecay:0.42, attack:0.004, sustain:0.42, drive:0.15, oscMix:0.45, drift:5,  glide:0,  release:0.28 },
    lead:  { cutoff:2000, res:0.25, envAmount:1.5, envDecay:0.22, attack:0.01,  sustain:0.85, drive:0.25, oscMix:0.50, drift:6,  glide:8,  release:0.20 },
  };
  // Role-aware voice pick: modeld is a MONO lead/bass voice, so a chordal PAD
  // routes to the poly juno60 instead (chords survive) — the mono Moog lead over a
  // poly-analog pad, the honest "analog ensemble". Returns {voice, params}.
  function minimoogVoiceFor(id, role){
    const fam=instrFamily(id);
    // SUSTAINED / POLYPHONIC families (voice/choir, strings, organ) — and any PAD —
    // route to the POLY juno60 so chords and "hovering voices" don't collapse onto
    // the MONO modeld (hovering voices don't survive a mono voice). Attacky/mono
    // families (lead/brass/reed/flute/pluck/mallet/key/bass) keep the mono Moog.
    if(role==="pad" || fam==="voice" || fam==="string" || fam==="organ"){
      // ROLE-AWARE ATTACK (sf-dropout fix): the pad's slow swell (.35-.55s) on
      // a MELODY role playing short notes ends the note before the envelope
      // opens — measured rms .004 vs .02-.03 on the other fonts. A melody/solo
      // on the poly juno keeps the hovering TIMBRE but speaks immediately;
      // pads keep the swell.
      const padAtk = fam==="voice"?0.55 : fam==="string"?0.35 : fam==="organ"?0.01 : 0.5;
      const attack = role==="pad" ? padAtk : Math.min(padAtk, fam==="organ"?0.01:0.06);
      return { voice:"juno60", params:{ cutoff:{voice:1500,string:1650,organ:2600}[fam]||1500,
        res:0.16, envAmount:1.0, keytrack:0.3, attack, decay:1.3, sustain:0.85,
        release: fam==="organ"?0.14 : (role==="pad"?1.6:0.5), chorus:1.4 } };
    }
    return { voice:"modeld", params: MINIMOOG_FAMILY[fam] };
  }
  // DX7 (FM) font: every GM instrument → a Yamaha DX7 patch (the 114-patch ROM
  // bank in DX7_PATCHES, {algorithm, params} = exactly the dx7-unit recipe). Per-
  // instrument patch where the ROM has a name for it, else the family patch. The
  // FM sound IS the identity across all roles (dx7 is poly, pool-capped at 2 for
  // cost → pads read as FM dyads; the honest DX7-in-this-engine limit).
  // QUIET-PATCH REMAP. The flute + reed family DEFAULTS were the
  // two alg-16 ROM patches "FLUTE   1" (-41.5 dBFS) and "CALIOPE" (-44.4) —
  // audible but ~18-25 dB UNDER the sampled instruments they stand in for
  // (measured: sampled flute -20.3, sampled reed -22.6), so under the FM font
  // the whole flute/reed block (every flute/piccolo/recorder + every sax/
  // clarinet/oboe/harmonica/bagpipe — ~17 GM instruments) sat inaudible beneath
  // the full-level synth drums — the FM font read as sparse/missing.
  // dx7's per-note @out is already
  // clamped to 1.0 (render-core/stream-renderer), so a gain makeup can't lift
  // them — the quietness is intrinsic to those two patches. Remapped to the
  // loudest SAME-TIMBRE siblings the sweep found (tools/audit/font-coverage.js
  // --dx7-rms + candidate sweep): flute -> "FLUTE   2" (alg18, -23.5, +18 dB),
  // reed -> "CLARINET" (alg17, -23.5, +21 dB) — both now at sampled parity.
  // The remaining families (string/mallet/key ~6-9 dB under, brass/organ/voice/
  // bass ~3-4 dB) are the residual FM-vs-multisample RMS gap; that needs the
  // dx7 output-gain ceiling raised (state-engine, tracked separately).
  const DX7_FAMILY_PATCH={ flute:"FLUTE   2", reed:"CLARINET", brass:"BRASS   1", string:"STRINGS 1",
    pluck:"GUITAR  1", bass:"BASS    1", mallet:"VIBE    1", organ:"E.ORGAN 1", voice:"VOICE   1",
    key:"E.PIANO 1", lead:"SYN-LEAD 1" };
  const DX7_ID_PATCH={ sitar:"SITAR", banjo:"KOTO", accordion:"ACCORDION", bandoneon:"ACCORDION",
    celesta:"CELESTE", music_box:"CELESTE", glockenspiel:"CELESTE", marimba:"MARIMBA", steel_drums:"STEEL DRUM",
    harpsichord:"HARPSICH 1", clavinet:"CLAV    1", bassoon:"BASSOON", vibraphone:"VIBE    1",
    orchestra_hit:"ORCHESTRA", strings:"STRINGS 1", slow_strings:"STRINGS 3" };
  function dx7VoiceFor(id, _role){
    const name=DX7_ID_PATCH[id] || DX7_FAMILY_PATCH[instrFamily(id)] || "E.PIANO 1";
    const patch=DX7_PATCHES[name] || DX7_PATCHES["E.PIANO 1"];
    return { voice:"dx7", params:{}, dx7:patch };
  }
  // the synth-font registry (built-in; registered into FONTS at init so setFont +
  // fontList see them). kind:"synth" flips the instrument resolvers to the synth
  // path; voiceFor(id, role) -> {voice, params[, dx7]}.
  const SYNTH_FONTS={
    minimoog: { label:"Pure Analog", voiceFor:minimoogVoiceFor },
    dx7:      { label:"Pure FM",     voiceFor:dx7VoiceFor },
  };
  for(const k of Object.keys(SYNTH_FONTS)) FONTS[k]={ kind:"synth", voiceFor:SYNTH_FONTS[k].voiceFor };
  function activeSynthFont(){ const F=FONTS[ACTIVE_FONT]; return (F&&F.kind==="synth")?F:null; }
  // resolve an instrument's {sr, zones (raw font shape: file/root/lo/hi/vlo/vhi/
  // loop/ls/le), base sample dir} for the ACTIVE font, per-instrument fallback.
  function fontInstr(id){
    const F=ACTIVE_FONT!=="fluidr3" && FONTS[ACTIVE_FONT];
    if(F && F.instr && F.instr[id]) return { sr:F.instr[id].sr, zones:F.instr[id].zones, base:F.base, dir:id };   // gen-font.js writes to <base>/<slug>/ (SYNTH fonts have no .instr — fall through to default samples for any residual sample callers)
    const S=SAMPLERS[id]; return S ? { sr:S.sr, zones:S.zones, base:"instruments", dir:S.dir } : null;   // default dir may be a renamed dir (tenor_sax -> tenor_sax_fp, immutability law)
  }

  // ---------- SAMPLED DRUM KITS ----------
  // Real recorded drum kits (GM percussion, FluidR3 bank 128, MIT) extracted per
  // hit by faust/sf2.js `drumkit` into found/samples/drums/<dir>/ (wavs gitignored
  // like the instrument zones; `len` mirrored here — the committed source, same as
  // SAMPLERS). ADDITIVE to the three Faust synth kicks (boom/808/909 …): a genre
  // opts in with `drums:{kit:"acoustic",…}` and its kick/snare/hat/tom voices play
  // the real one-shots (drumKitSpec below -> instruments.drums.<x>Sampler ->
  // faust/state-engine drumSamp). Electronic-identity genres (techno/trap/…) keep
  // their synth kicks — 808/909 ARE those genres. Only kick/snare/hatClosed/
  // hatOpen/tomMid are wired (the engine's four drum voices); the other extracted
  // hits (rim/clap/crash/ride) ride the manifest for future use. `len` = sample
  // frames at sr (44100); the tom repitches from a 105Hz base per hit.
  const DRUMKITS = {
    // clap/rim/crash/ride ARE extracted per kit (faust/sf2.js drumkit; kit.json)
    // and shared byte-for-byte across the six presets (GM notes 39/37/49/51 aren't
    // kit-specific) — wired here so the per-genre PERC LANE can trigger the REAL
    // recorded hits.
    acoustic:   { label:"Acoustic Kit (FluidR3 Standard, MIT)",   dir:"acoustic",   sr:44100, hits:{ kick:{file:"kick.wav",len:12462}, snare:{file:"snare.wav",len:20640}, hatClosed:{file:"hatClosed.wav",len:31360}, hatOpen:{file:"hatOpen.wav",len:139670}, tom:{file:"tomMid.wav",len:44544}, clap:{file:"clap.wav",len:16896}, rim:{file:"rim.wav",len:64000}, crash:{file:"crash.wav",len:375830}, ride:{file:"ride.wav",len:113920} } },
    room:       { label:"Room Kit (FluidR3 Room, MIT)",           dir:"room",       sr:44100, hits:{ kick:{file:"kick.wav",len:19950}, snare:{file:"snare.wav",len:20640}, hatClosed:{file:"hatClosed.wav",len:31360}, hatOpen:{file:"hatOpen.wav",len:139670}, tom:{file:"tomMid.wav",len:44544}, clap:{file:"clap.wav",len:16896}, rim:{file:"rim.wav",len:64000}, crash:{file:"crash.wav",len:375830}, ride:{file:"ride.wav",len:113920} } },
    power:      { label:"Power Kit (FluidR3 Power, MIT)",          dir:"power",      sr:44100, hits:{ kick:{file:"kick.wav",len:36224}, snare:{file:"snare.wav",len:56110}, hatClosed:{file:"hatClosed.wav",len:31360}, hatOpen:{file:"hatOpen.wav",len:139670}, tom:{file:"tomMid.wav",len:45343}, clap:{file:"clap.wav",len:16896}, rim:{file:"rim.wav",len:64000}, crash:{file:"crash.wav",len:375830}, ride:{file:"ride.wav",len:113920} } },
    electronic: { label:"Electronic Kit (FluidR3 Electronic, MIT)",dir:"electronic", sr:44100, hits:{ kick:{file:"kick.wav",len:13712}, snare:{file:"snare.wav",len:30976}, hatClosed:{file:"hatClosed.wav",len:31360}, hatOpen:{file:"hatOpen.wav",len:139670}, tom:{file:"tomMid.wav",len:37351}, clap:{file:"clap.wav",len:16896}, rim:{file:"rim.wav",len:64000}, crash:{file:"crash.wav",len:375830}, ride:{file:"ride.wav",len:113920} } },
    jazz:       { label:"Jazz Kit (FluidR3 Jazz, MIT)",            dir:"jazz",       sr:44100, hits:{ kick:{file:"kick.wav",len:16768}, snare:{file:"snare.wav",len:15488}, hatClosed:{file:"hatClosed.wav",len:31360}, hatOpen:{file:"hatOpen.wav",len:139670}, tom:{file:"tomMid.wav",len:44544}, clap:{file:"clap.wav",len:16896}, rim:{file:"rim.wav",len:64000}, crash:{file:"crash.wav",len:375830}, ride:{file:"ride.wav",len:113920} } },
    brush:      { label:"Brush Kit (FluidR3 Brush, MIT)",          dir:"brush",      sr:44100, hits:{ kick:{file:"kick.wav",len:16768}, snare:{file:"snare.wav",len:14900}, hatClosed:{file:"hatClosed.wav",len:31360}, hatOpen:{file:"hatOpen.wav",len:139670}, tom:{file:"tomMid.wav",len:44544}, clap:{file:"clap.wav",len:16896}, rim:{file:"rim.wav",len:64000}, crash:{file:"crash.wav",len:375830}, ride:{file:"ride.wav",len:113920} } },
  };
  const DRUM_TOM_ROOT = 69 + 12*Math.log2(105/440);   // must match faust/state-engine DRUM_TOM_ROOT (105Hz => rate 1)
  // ---------- SHARED GM PERCUSSION BANK (the "million elements") ----------
  // The wide GM bank-128 percussion map beyond the kit backbone: hand percussion
  // (congas/bongos), latin (timbale/agogo/cowbell/claves/guiro), shakers
  // (shaker/cabasa/maracas), and sparkle (tambourine/triangle/woodblock). Extracted
  // by faust/sf2.js `percbank` into found/samples/perc/<dir>/<name>.wav + perc.json
  // (mirrored here; wavs gitignored like the kit + instrument zones). ONE shared
  // multi-zone native sampler (percSampler below): each element sits at its GM note
  // as a natural-pitch one-shot, selected per PERC-LANE event by that note. Feeds
  // the per-genre perc lane; NOT a verifier feature (perc is timbral color — the
  // symbolic drumDensity/interlock fabric measures the core kit only).
  const PERCBANK = DATA.PERCBANK;
  const PERC_ELEMENTS = Object.keys(PERCBANK.hits);
  // ---------- PER-GENRE PERCUSSION LANE ----------
  // The kit alone is mostly hat/kick/snare; this lane puts the rest of the GM
  // percussion bank (claps &c) to work. Each genre that wants it gets a lane
  // list; a lane is {p:pattern, lvl,
  // s?:percElement}. The csd-engine PERC PASS (buildEvents, near the rubato warp)
  // reads state.perc and lays these OVER the kit — additive, tasteful, NOT every
  // genre (techno/gabber/metal/minimal stay tight). Verifier-INVISIBLE: perc is
  // timbral color, so the symbolic drumDensity/interlock fabric (genre-verifier
  // core-kit filter) is untouched and the confusion matrix does not move.
  // pattern voices: clap24/→clap · crashDown/→crash · ride8,rideq/→ride ·
  // rim34/→rim · shaker8/16,conga,cowbell,tambourine,agogo,guiro,clave,triangle,
  // woodblock/→perc (the shared GM bank). Deterministic (no rng at resolve time).
  const PERC_STYLES = {
    // house/disco/funk/soul — the CLAP on 2 & 4, + color
    house:      { lanes:[{p:"clap24",lvl:.34}] },
    deephouse:  { lanes:[{p:"clap24",lvl:.3}] },
    garage:     { lanes:[{p:"clap24",lvl:.3}] },
    acidhouse:  { lanes:[{p:"clap24",lvl:.3}] },
    disco:      { lanes:[{p:"clap24",lvl:.3},{p:"tambourine",lvl:.15},{p:"crashDown",lvl:.4}] },
    funk:       { lanes:[{p:"clap24",lvl:.24},{p:"cowbell",lvl:.13},{p:"tambourine",lvl:.13}] },
    boombap:    { lanes:[{p:"clap24",lvl:.26}] },
    newjack:    { lanes:[{p:"clap24",lvl:.32},{p:"tambourine",lvl:.15},{p:"crashDown",lvl:.36}] },
    eurodance:  { lanes:[{p:"clap24",lvl:.3},{p:"crashDown",lvl:.4}] },
    dancepop:   { lanes:[{p:"clap24",lvl:.28},{p:"tambourine",lvl:.15},{p:"crashDown",lvl:.4}] },
    amapiano:   { lanes:[{p:"clap24",lvl:.3},{p:"shaker16",lvl:.13},{p:"conga",lvl:.2}] },
    ska:        { lanes:[{p:"clap24",lvl:.2},{p:"woodblock",lvl:.16},{p:"crashDown",lvl:.34}] },
    reggae:     { lanes:[{p:"rim34",lvl:.22},{p:"shaker8",lvl:.13}] },
    dub:        { lanes:[{p:"rim34",lvl:.2},{p:"shaker8",lvl:.12}] },
    // jazz/bebop/lounge/ballad — RIDE (swung 8ths) + RIM cross-stick
    jazz:       { lanes:[{p:"ride8",lvl:.2},{p:"rim34",lvl:.15}] },
    bebop:      { lanes:[{p:"ride8",lvl:.22},{p:"rim34",lvl:.15}] },
    blues:      { lanes:[{p:"rideq",lvl:.15}] },
    spacelounge:{ lanes:[{p:"rideq",lvl:.13},{p:"rim34",lvl:.11},{p:"shaker8",lvl:.1}] },
    whalejazz:  { lanes:[{p:"ride8",lvl:.16},{p:"rim34",lvl:.12}] },
    holdmusic:  { lanes:[{p:"rideq",lvl:.12},{p:"shaker8",lvl:.1}] },
    // afro/latin/tropical — SHAKER + CONGAS + claves/guiro/agogo/woodblock
    afrobeat:   { lanes:[{p:"shaker16",lvl:.15},{p:"conga",lvl:.24},{p:"agogo",lvl:.13},{p:"clave",lvl:.12}] },
    bossanova:  { lanes:[{p:"rim34",lvl:.2},{p:"shaker8",lvl:.13},{p:"clave",lvl:.12}] },
    faxbossa:   { lanes:[{p:"rim34",lvl:.18},{p:"shaker8",lvl:.12}] },
    tango:      { lanes:[{p:"rim34",lvl:.2},{p:"clave",lvl:.12}] },
    exotica:    { lanes:[{p:"conga",lvl:.2},{p:"shaker8",lvl:.12},{p:"woodblock",lvl:.11},{p:"rideq",lvl:.1}] },
    desertblues:{ lanes:[{p:"shaker8",lvl:.15},{p:"conga",lvl:.16}] },
    surfrock:   { lanes:[{p:"tambourine",lvl:.16},{p:"crashDown",lvl:.36}] },
    arabpop:    { lanes:[{p:"clave",lvl:.14},{p:"tambourine",lvl:.15}] },
    klezmer:    { lanes:[{p:"woodblock",lvl:.14},{p:"tambourine",lvl:.14}] },
    bluegrass:  { lanes:[{p:"woodblock",lvl:.14}] },
    // citypop/shibuyakei/synth-pop sheen
    citypop:    { lanes:[{p:"shaker16",lvl:.12},{p:"crashDown",lvl:.34}] },
    shibuyakei: { lanes:[{p:"tambourine",lvl:.15},{p:"shaker16",lvl:.1}] },
    // latin-percussion-forward electronic
    miamibass:  { lanes:[{p:"cowbell",lvl:.15},{p:"clap24",lvl:.2}] },
    electro:    { lanes:[{p:"cowbell",lvl:.13},{p:"clap24",lvl:.22}] },
    krautrock:  { lanes:[{p:"cowbell",lvl:.13}] },
    // rock/pop CRASH on the downbeat
    heavymetal: { lanes:[{p:"crashDown",lvl:.44}] },
    transitwave:{ lanes:[{p:"crashDown",lvl:.34},{p:"tambourine",lvl:.11}] },
    dinosynth:  { lanes:[{p:"crashDown",lvl:.38}] },
    budstep:    { lanes:[{p:"crashDown",lvl:.36}] },
    // downtempo/lounge SPARKLE — light triangle/shaker
    downtempo:  { lanes:[{p:"shaker8",lvl:.1},{p:"triangle",lvl:.08}] },
    triphop:    { lanes:[{p:"shaker8",lvl:.1}] },
    lofi:       { lanes:[{p:"shaker8",lvl:.09}] },
    // new-spaces wing (hip hop cosmos / rock / pop / floor) — same
    // verifier-invisible color rule as everything above
    crateflip:  { lanes:[{p:"clap24",lvl:.26}] },
    lowglide:   { lanes:[{p:"tambourine",lvl:.12}] },
    hollerknock:{ lanes:[{p:"clap24",lvl:.3}] },
    flannelburst:{ lanes:[{p:"crashDown",lvl:.4}] },
    heartsprint:{ lanes:[{p:"crashDown",lvl:.4}] },
    bouffantbeat:{ lanes:[{p:"tambourine",lvl:.16},{p:"clap24",lvl:.18}] },
    chantcircuit:{ lanes:[{p:"clap24",lvl:.26}] },
    halogloss:  { lanes:[{p:"clap24",lvl:.28},{p:"tambourine",lvl:.14},{p:"crashDown",lvl:.38}] },
    octanerush: { lanes:[{p:"clap24",lvl:.28},{p:"crashDown",lvl:.38}] },
    runwaystomp:{ lanes:[{p:"clap24",lvl:.3},{p:"crashDown",lvl:.44}] },
  };
  const PERC_STYLE_GENRES = Object.keys(PERC_STYLES);
  // which GM perc-bank elements each perc-VOICE pattern plays (mirrors csd-engine
  // percBar). Patterns NOT listed (clap24/crashDown/ride8/rideq/rim34) use the
  // dedicated clap/crash/ride/rim voices — the kit sampler / synth fallback — and
  // touch the perc bank not at all.
  const PERC_PATTERN_ELEMENTS = {
    clave:["claves"], shaker8:["shaker"], shaker16:["shaker"],
    conga:["congaLo","congaMuteHi","congaOpenHi"], cowbell:["cowbell"],
    tambourine:["tambourine"], agogo:["agogoHi","agogoLo"],
    guiro:["guiroLong","guiroShort"], triangle:["triangleOpen","triangleMute"],
    woodblock:["woodblockHi"] };
  const percBankElements = (lanes) => {
    const set=new Set();
    for(const l of (lanes||[])) for(const e of (PERC_PATTERN_ELEMENTS[l.p]||[])) set.add(e);
    return [...set];
  };
  // dominant-parent resolution — NO rng draw (pure of the main stream, so every
  // existing seeded state stays byte-identical; perc rides on top).
  const resolvePercStyle = (genres, weights) => {
    if(!genres || !genres.length) return null;
    let best=null, bw=-1;
    genres.forEach((g,i)=>{ const w=weights?weights[i]:1; if(PERC_STYLES[g] && w>bw){ bw=w; best=g; } });
    return best ? { genre:best, lanes:PERC_STYLES[best].lanes.map(l=>({...l})) } : null;
  };

  // ---------- the anchors ----------
  const GENRES = DATA.GENRES;

  // ---------- MUSIC-MIND anchor axes (docs/MUSIC-MIND.md §"The vector space grows new axes") ----------
  // Every anchor gains three optional-organ axes — theory:{adventure:[lo,hi],
  // color:[lo,hi], voicing, reharm}, pipes:[{id, w, ...params}], rhythm:[lo,hi]
  // — DERIVED at load from what the anchor already says about itself
  // (progression pool → harmonic appetite; kit pool → rhythmic complexity;
  // models/patterns → which pipes fit), not 178 hand edits. deriveMind() is
  // pure and deterministic (zero rng — the kernel rng law starts at resolve
  // time); explicit declarations WIN (an anchor or MIND_OVERRIDES entry that
  // carries a field is never overwritten — curation beats inference).
  //
  // adventure per progression pool — the pool IS the anchor's stated harmonic
  // appetite: jazz pools walk ii-V-I with substitutions in the literature,
  // modal pools color inside one scale, pop loops are safe, drones are
  // RESTRAINT (an identity, not an absence — MUSIC-MIND: "techno/minimal near
  // zero"). Ranges are [lo,hi] like bpm; unknown names read as pop.
  const PROG_ADV = {
    ii_v_i:[.4,.6],   neosoul:[.35,.55], lofi:[.35,.5],   blues_12:[.35,.55],   // the jazz family: substitution is idiom
    mode_dorian:[.2,.35], mode_mixo:[.2,.35], mode_lydian:[.2,.35],             // modal: interchange-adjacent color,
    mode_phrygian:[.2,.3], hijaz:[.2,.3],  andalusian:[.15,.3], canon:[.15,.3], // but the scale is the handrail
    royal_road:[.15,.3], dream:[.15,.28], house_min7:[.12,.25],                 // seventh-pop: color yes, risk mild
    four_chords:[.1,.2], pop_1625:[.1,.22], doo_wop:[.1,.2], sad_pop:[.1,.2],   // pop loops: the loop is the point
    uplift:[.1,.2], synthwave:[.1,.2], epic_min:[.1,.2], minor_run:[.1,.22],
    house_min:[.1,.2], frost:[.1,.2], primeval:[.1,.2], funk_vamp:[.05,.15],    // a vamp riffs, it doesn't modulate
    drone_min:[0,.04], deep_two:[0,.06],                                        // drones: restraint is identity
    // REPERTOIRE wave 3 additions (csd-engine PROGRESSIONS grew six entries)
    blues_16:[.35,.55], interchange:[.2,.35], mediant:[.15,.3],                 // 16-bar blues = the jazz family; interchange/mediant = modal-borrowing color
    whole_tone:[.1,.2], quartal:[.1,.2], epic_maj:[.1,.2] };                    // planing/sus/anthem loops: the loop is the point
  // color per pool — extension richness (triads → 13ths). Seventh-rich pools
  // (royal road maj7s, neosoul 9ths, ii-V-I shells) sit high; the triadic
  // anthem/drone pools sit low. Mirrors the verifier's `seventh` feature
  // (which reads the NAMED table, so color itself is matrix-invisible).
  const PROG_COL = {
    royal_road:[.55,.8], neosoul:[.55,.8], ii_v_i:[.55,.8], dream:[.5,.75],
    lofi:[.5,.75], house_min7:[.45,.65], blues_12:[.4,.6],
    mode_dorian:[.3,.5], mode_mixo:[.3,.5], mode_lydian:[.3,.5], canon:[.3,.5],
    pop_1625:[.3,.5], funk_vamp:[.3,.5], mode_phrygian:[.25,.4], hijaz:[.25,.4],
    doo_wop:[.25,.45], house_min:[.2,.35], deep_two:[.15,.35],
    four_chords:[.15,.3], sad_pop:[.15,.3], minor_run:[.15,.3], andalusian:[.15,.3],
    uplift:[.1,.3], synthwave:[.1,.3], epic_min:[.1,.3], primeval:[.1,.3],
    frost:[.1,.25], drone_min:[.1,.3],
    // REPERTOIRE wave 3 additions
    blues_16:[.4,.6], interchange:[.4,.6], whole_tone:[.3,.5],                  // dom7 bars / borrowed maj7s / aug shimmer carry real extension color
    quartal:[.25,.45], mediant:[.1,.3], epic_maj:[.1,.3] };                     // sus stasis mid; triadic mediant/epic low like their minor kin
  // rhythm.complexity per kit — how much the anchor's own drums already
  // syncopate: chopped breaks invite pushed/mutated bass+melody cells; a
  // machine four wants the grid; beatless wants stillness.
  const KIT_CX = {
    jungle:[.55,.8], breaks:[.5,.75], trap:[.35,.6], tribal:[.35,.6],
    newjack:[.35,.55], boombap:[.3,.5], electro:[.3,.5], shuffle:[.25,.45],
    bossa:[.2,.4], halftime:[.15,.35], techno:[.12,.28], house:[.12,.3],
    full:[.12,.3], open:[.1,.25], four:[.08,.22], pulse:[.08,.22],
    kick:[.05,.15], off:[0,.08] };
  // curated overrides — the SMALL table where inference reads a flagship
  // wrong (MUSIC-MIND: "derived heuristically … then spot-curated"). Each
  // entry is a normal anchor declaration (explicit wins); `bassCells` appends
  // the new BASS_PATTERNS cells (tresillo/son/hemiola/charleston) to the
  // anchor's bass pattern pool.
  const MIND_OVERRIDES = {
    techno:      { theory:{adventure:[0,.05], color:[.1,.25], voicing:"close", reharm:false}, rhythm:[.1,.25],
                   pipes:[{id:"octavePump",w:.55,prob:.4},{id:"sweepArc",w:.5,lo:.7,hi:2},{id:"densityArc",w:.45,floor:.6}] },   // restraint IS techno: the drone never reharmonizes; drive comes from the pump and the arc, not new notes
    house:       { pipes:[{id:"octavePump",w:.55,prob:.4},{id:"ghost",w:.35,prob:.3}] },   // NO densityArc: the open-hat offbeat must be heard (verifier hatDensity floor 1.2 — an arc that thins hats attacks the identity)
    jungle:      { rhythm:[.55,.8], pipes:[{id:"throwFx",w:.6,prob:.6},{id:"ghost",w:.4,prob:.3},{id:"densityArc",w:.4,floor:.6}] },   // the amen IS the melody — complexity floor .55; dub-space throws punctuate the chop
    vaporwave:   { theory:{adventure:[.05,.14], color:[.6,.8], voicing:"open", reharm:false}, rhythm:[0,.1],
                   pipes:[{id:"vibratoSwell",w:.5,depth:.25},{id:"harmonize",w:.35,prob:.3}] },   // the slowed tape does NOT reharmonize (machine time, frozen maj7 nostalgia); color stays maxed — the royal-road 7ths ARE the genre
    lofi:        { theory:{adventure:[.3,.45], color:[.55,.75], voicing:"drop2", reharm:true, tables:"corpus"},
                   pipes:[{id:"ghost",w:.5,prob:.35},{id:"strum",w:.5,step:.02},{id:"harmonize",w:.35,prob:.3}], bassCells:["charleston"] },   // the head-nod pocket: ghosted bass + rolled felt chords; charleston comp cell joins the pool (space is the groove)
    jazz:        { theory:{adventure:[.45,.65], color:[.55,.8], voicing:"drop2", reharm:true, tables:"corpus"}, rhythm:[.35,.55],   // tables:"corpus" = the MIDI-trove MINED walk (theory.js) — the first wired genre; matrix-gated
                   pipes:[{id:"ghost",w:.55,prob:.4},{id:"echoCanon",w:.4,prob:.4,delay:2}], bassCells:["charleston"] },   // the harmony brain's home: every song rewalks the changes (drop2 shells, real substitutions); approach-note bass, imitative answers
    bebop:       { theory:{adventure:[.55,.75], color:[.6,.85], voicing:"drop2", reharm:true, tables:"corpus"} },   // maximum substitution appetite (constrain caps .75; the bpm>165 law caps complexity — fast genres saturate on their own)
    blues:       { theory:{adventure:[.3,.45], color:[.4,.6], voicing:"close", reharm:false},
                   pipes:[{id:"callResponse",w:.7,level:.85},{id:"ghost",w:.45,prob:.35}] },   // the 12-bar IS the form — never reharmonized; call-and-response is the genre's engine
    fugue:       { theory:{adventure:[.2,.35], color:[.35,.55], voicing:"close", reharm:true, tables:"corpus"},   // second wired genre: the corpus is baroque-heavy — fugue's walk comes from its own repertoire (minor table esp.: hand prior was worse than uniform)
                   pipes:[{id:"echoCanon",w:.9,prob:.7,delay:4,semis:-12,amp:.55}] },   // imitation IS the genre: the canon pipe near-always fires, a 4-beat answer at the lower octave; adventure modest (Bach modulates by rule, not risk)
    neoclassical:{ theory:{adventure:[.25,.45], color:[.4,.6], voicing:"close", reharm:true, tables:"corpus"},
                   pipes:[{id:"echoCanon",w:.5,prob:.45,delay:4},{id:"strum",w:.4,step:.015}] },   // the felt piano rewalks its progressions gently; rolled chords are pianism, not effect
    dub:         { theory:{adventure:[0,.05], color:[.2,.4], voicing:"close", reharm:false}, rhythm:[.25,.45],
                   pipes:[{id:"throwFx",w:.85,prob:.75,rsend:3,dsend:3},{id:"ghost",w:.4,prob:.3},{id:"accentProfile",w:.8,profile:"dub",amount:.8}], bassCells:["tresillo"] },   // the throw IS dub — two chords, enormous sends, zero reharm; tresillo joins the riddim pool; accentProfile = the MINED skank velocity lean (mine-groove.js)
    acidhouse:   { pipes:[{id:"sweepArc",w:.75,lo:.6,hi:2.4},{id:"octavePump",w:.5,prob:.4}] },   // the 303 filter IS the gesture — sweepArc rides the acid line hard
    electro:     { pipes:[{id:"sweepArc",w:.45,lo:.7,hi:2},{id:"vibratoSwell",w:.4,prob:.4,depth:.25}] },   // NO densityArc (same reason as house): form:"dj" would derive one, but the crisp 16th machine hats ARE the identity (verifier hatDensity floor 1.5) — an arc that thins hats attacks it. Keeps the two synth-expression pipes the pre-dj derivation already chose
    minimal:     { theory:{adventure:[0,.03], color:[.1,.25], voicing:"close", reharm:false}, rhythm:[.05,.2],
                   pipes:[{id:"densityArc",w:.7,floor:.65}] },   // ONE pipe: the additive plateau is the whole argument; everything else stays out of the way
    ambient:     { theory:{adventure:[0,.03], color:[.2,.45], voicing:"open", reharm:false}, rhythm:[0,.05],
                   pipes:[{id:"vibratoSwell",w:.5,minDur:2,depth:.2,rate:4.5}] },   // nothing moves — except the sustains, which learn to sing
    citypop:     { theory:{adventure:[.2,.4], color:[.55,.8], voicing:"close", reharm:true, tables:"corpus"},   // corpus-tables batch 2: lofi/bebop/neoclassical/citypop (jazz+fugue were batch 1) — one matrix run gates the batch
                   pipes:[{id:"strum",w:.5,step:.02},{id:"harmonize",w:.4,prob:.35}] },   // royal-road maj7 sheen: strummed guitar-pop chords, parallel-3rd gloss
    afrobeat:    { rhythm:[.4,.6], bassCells:["tresillo","son"] },   // Fela's interlock earns the clave-locked cells; complexity mid (the lock is tight, not busy)
    miamibass:   { bassCells:["tresillo"] },   // the 808 tresillo backbone joins the pool
    breakcore:   { rhythm:[.6,.8] },   // maximum chop appetite on paper — the bpm>165 constrain law caps the render at .4 (the amen at 190 saturates alone)
    sludgemetal: { rhythm:[.05,.2], pipes:[] },   // gate-loop damping (iter 1: fell to dub on a drumDensity knife-edge — baseline was already a 100-100 tie there): sludge is a slow CRUSH, not a conversation — the derived callResponse (via its "blues" lead pattern) read wrong, and the wall needs no plumbing at all; zero pipe candidates also means zero extra draws, keeping its fill/sweep stream nearest the proven baseline roll
    longshipwhip:{ pipes:[] },   // the sludgemetal precedent: a crush genre, not a conversation — derivation read callResponse off the "blues" lead pattern and strum off the guitar pool, but the 180bpm palm-muted wall answers nobody and never rolls a chord
    bogironwallow:{ pipes:[{id:"sweepArc",w:.45,lo:.7,hi:2}] },   // crush, not conversation (callResponse leaked in via the "blues" lead pattern); the reese bass DOES earn sweepArc — the slow filter swell is the doom gesture, so keep exactly that one
  };
  // deriveMind(name, g) — attach the three axes to one anchor. Weighted
  // averages over the anchor's own pools (pool repetition IS weighting, the
  // kit/progression convention); every rule below cites what it reads.
  // MIND_OVERRIDES is applied HERE (not only in the load loop) so genre-tool's
  // create-time measurement path (which calls K.deriveMind on an injected
  // anchor) sees the same curated axes the kernel loads. Applied anywhere else,
  // the tool derives, measures AND SERIALIZES conversational pipes onto crush
  // anchors, and the serialized field then beats the override forever
  // (explicit-wins reads the tool's own inference as curation).
  function deriveMind(name, g){
    const ov=MIND_OVERRIDES[name];
    if(ov){ for(const k of ["theory","pipes","rhythm"]) if(ov[k]&&!g[k]) g[k]=ov[k];
            if(ov.bassCells) for(const c of ov.bassCells) if(!g.bass.patterns.includes(c)) g.bass.patterns.push(c); }
    const avgR=(names,tbl,dflt)=>{ let lo=0,hi=0;
      for(const n of names){ const r=tbl[n]||dflt; lo+=r[0]; hi+=r[1]; }
      return [round(lo/names.length,3), round(hi/names.length,3)]; };
    const share=(names,pred)=>names.filter(pred).length/names.length;
    if(!g.theory){
      const adv=avgR(g.progressions, PROG_ADV, [.1,.2]);
      const col=avgR(g.progressions, PROG_COL, [.2,.4]);
      // voicing (spec order, first match wins): jazz-family → drop2; drone/
      // beatless → open; frosty/lydian/hijaz color → quartal; else close.
      // cluster is NEVER derived — an anchor must opt in explicitly (taste).
      const jazzShare=share(g.progressions, p=>PROG_ADV[p]&&PROG_ADV[p][0]>=.3);
      const droneShare=share(g.progressions, p=>p==="drone_min"||p==="deep_two");
      const offShare=share(g.kits, k=>k==="off");
      const voicing = jazzShare>=.5 ? "drop2"
                    : (droneShare>=.5||offShare>=.5) ? "open"
                    : g.progressions.some(p=>/^(frost|mode_lydian|hijaz)$/.test(p)) ? "quartal"
                    : "close";
      // reharm only when the derived appetite reaches .2 — and never below
      // .15 (constrain re-asserts this on every blend: restraint is identity)
      g.theory={ adventure:adv, color:col, voicing, reharm:adv[1]>=.2 };
    }
    // THE TABLES LAW (MIDI-trove): a genre that reharmonizes walks
    // the CORPUS tables (theory.js MINED block — 86k songs, held-out-gated
    // better than the hand priors in both modes) unless the anchor opts out
    // with tables:"hand". Applied post-derivation so create-time measurement
    // (genre-tool) matches load; non-reharm genres never ship state.theory, so
    // the field is inert there. Fleet gated by the matrix + the paired
    // self-score sweep (corpus vs hand per reharm genre).
    if(g.theory.reharm && !g.theory.tables) g.theory.tables="corpus";
    if(!g.rhythm){
      const r=avgR(g.kits, KIT_CX, [.1,.3]);
      // a declared euclid undergrid is stated syncopation appetite: bump both ends
      g.rhythm = g.euclid ? [round(Math.min(.85,r[0]+.06),3), round(Math.min(.9,r[1]+.08),3)] : r;
    }
    if(!g.pipes){
      const leadPat=g.lead.patterns||[], bassPat=g.bass.patterns||[];
      const leadM=g.lead.recipe.model||[], bassM=g.bass.recipe.model||[];
      const leadSamp=g.lead.samplerPool||[];
      const SYNTH_ID=/^(tb303|acid|reese|wobble|stack|modeld|synclead|hoover)$/;   // samplers ignore expression annotations — sweep/vibrato slots are wasted on them (hoover is listed so the ex-stack hoover leads keep their derived sweep/vibrato pipes)
      const p=[];
      // priority order = identity first (groove pockets and conversational
      // forms before generic sweetening); the ≤3 cap slices from the top.
      if(g.kits.some(k=>k==="boombap"||k==="newjack"))                 p.push({id:"ghost",w:.55,prob:.35});           // the funk/boombap pocket lives in approach notes
      if(g.progressions.includes("blues_12")||leadPat.includes("blues")) p.push({id:"callResponse",w:.5,level:.85});  // blues/gospel/soul: the answer phrase
      if(leadPat.includes("canon")||leadPat.includes("fugue")||g.counterpoint) p.push({id:"echoCanon",w:.55,prob:.45,delay:2}); // stated imitation (canon/fugue patterns, counterpoint dim)
      if(leadM.includes("guitar")||leadM.includes("kpluck")||leadSamp.some(s=>/guitar|banjo|bandoneon|harp/.test(s))) p.push({id:"strum",w:.55,step:.02}); // plucked-string identity: roll the chords
      if(bassPat.includes("dub")&&g.fx.delayFb[1]>=.45)                p.push({id:"throwFx",w:.55,prob:.6});          // dub family: bassline + hot delay = the throw
      if(bassPat.includes("rolling")&&g.form==="dj")                   p.push({id:"octavePump",w:.5,prob:.4});        // house/techno rolling bass: drive without new notes
      if(g.form==="dj"||g.form==="wave")                               p.push({id:"densityArc",w:.4,floor:.6});       // long-plateau forms earn the long-range shape (vamp deliberately NOT here — REPERTOIRE wave 3 measured funk losing a dominance seed to the extra arc; the vamp graph already IS the plateau)
      if((g.pads.prob||0)>=.85&&leadPat.some(x=>/composed|anthem|hero|wander/.test(x))) p.push({id:"harmonize",w:.45,prob:.35}); // pad-lush + melodic lead: safe parallel 3rds
      if(bassM.some(m=>SYNTH_ID.test(m))||leadM.some(m=>SYNTH_ID.test(m))){              // synth-identity voices only (see SYNTH_ID note)
        p.push({id:"sweepArc",w:.45,lo:.7,hi:2});
        if(leadM.some(m=>SYNTH_ID.test(m)))                            p.push({id:"vibratoSwell",w:.4,depth:.25});
      }
      g.pipes=p.slice(0,3);   // the taste cap: ≤3 candidates per anchor
    }
  }
  // load-time pass: overrides first (they ARE explicit declarations — applied
  // inside deriveMind, so the tool's measurement path agrees),
  // then the heuristic fills every gap. After this loop every anchor carries
  // all three axes — resolveMulti can blend without presence guards.
  for(const name of Object.keys(GENRES)) deriveMind(name, GENRES[name]);

  // ---------- transition micro-lick soloists ----------
  // Per-genre instrument pools for the "micro lick" transition: a 1-2 bar
  // seeded pickup phrase into the next section's downbeat (csd-engine
  // lickEvents), the MUSICAL replacement for the overused noise sweep.
  // Entries are SAMPLERS ids (real FluidR3 instruments — this is also where
  // synth-forward genres get their only sampler usage) or "@model" synth
  // voices. Genres absent here (ambient, doomdrone, minimal, gabber,
  // breakcore, ebm, wintersynth, neoclassical) keep transitions instrument-
  // free on purpose — silence/drums suit them. resolveMulti assigns one
  // soloist per track (weighted parent pick); toState emits state.lickVoice.
  const LICKS = {
    techno:     ["@pluck","muted_trumpet"],           // a tight blip run; sometimes the Detroit-jazz muted horn
    house:      ["@piano","muted_trumpet"],           // the piano riff — the Marshall Jefferson turn
    jungle:     ["trombone","@pluck"],                // ragga dub-horn slides
    triphop:    ["muted_trumpet","tenor_sax"],        // the Portishead horn, smoky
    vaporwave:  ["alto_sax","@piano"],                // THE mall sax takes the corner
    synthwave:  ["@stack","@piano"],                  // a supersaw run / a DX piano turn
    lofi:       ["felt_piano","alto_sax"],
    downtempo:  ["flute","muted_trumpet"],
    dinosynth:  ["french_horns"],                     // the expedition's horns announce the next age
    canawave:   ["trumpet","@kpluck"],                // a proud little horn or the arp guitar itself
    transitwave:["trombone","@pluck"],                // the platform horn / a sequencer run
    dancepop:   ["@piano","muted_trumpet"],
    edm:        ["@piano"],                           // the big-room piano run
    dubstep:    ["@pluck"],
    blues:      ["harmonica","steel_string_guitar"],  // the harp answers, the guitar turns around
    jazz:       ["tenor_sax","bright_yamaha_grand"],  // the sax pickup / a two-hand run
    dub:        ["trombone","harmonica"],             // the Rico Rodriguez slide / melodica-adjacent reed
    trance:     ["@piano"],
    disco:      ["trumpet","@piano"],                 // the horn-section pickup
    italo:      ["@piano"],
    bigbeat:    ["trumpet","@piano"],
    garage:     ["@organ"],                           // the UKG organ skip
    newage:     ["harp","flute"],                     // a harp gliss-run into the new section
    exotica:    ["vibraphone","marimba"],
    industrial: ["@fuzz"],
    spokenword: ["tenor_sax","felt_piano"],
    chiptune:   ["@stack"],                           // a square arcade run
    chinawave:  ["oboe","@pluck"],                    // the suona-adjacent double reed
    sovietwave: ["trombone","french_horns"],          // the brass of the workers' band takes the turn
    citypop:    ["alto_sax","@piano"],                // the night-drive sax pickup
    shibuyakei: ["flute","vibraphone"],
    bossanova:  ["flute","nylon_string_guitar"],
    idm:        ["celesta"],                          // a music-box aside
    electro:    ["@pluck"],
    miamibass:  ["@pluck"],
    phonk:      ["@pluck"],
    witchhouse: ["ahh_choir"],                        // a ghost-choir rise
    mallsoft:   ["alto_sax"],                         // the mall sax, of course
    psytrance:  ["@pluck"],
    deephouse:  ["@piano","muted_trumpet"],
    coldwave:   ["@pluck"],
    krautrock:  ["flute","@organ"],                   // the kraut flute over the motorik turn
    newjack:    ["bright_yamaha_grand","@piano"],     // the swingbeat piano run
    acidhouse:  ["@piano"],
    surfrock:   ["jazz_guitar","steel_string_guitar"],// the run down the neck
    spacelounge:["vibraphone","celesta","harp"],
    arabpop:    ["oboe"],                             // the mizmar-ish approach run
    tango:      ["bandoneon","@piano"],
    afrobeat:   ["trumpet","tenor_sax"],              // the horn section's two-bar answer
    desertblues:["steel_string_guitar","harmonica"],
    sludgemetal:["@fuzz"],
    industrialmetal:["@fuzz"],
    darksynth:  ["@stack"],
    // ---- genre-expansion licks ----
    dnb:        ["rhodes_ep","@pluck"],
    footwork:   ["@pluck"],
    happyhardcore:["@stack","@piano"],
    hardstyle:  ["@stack"],
    eurodance:  ["@piano","@stack"],
    singeli:    ["@pluck","sitar"],
    bebop:      ["tenor_sax","trumpet"],          // the bebop head
    bluegrass:  ["banjo","fiddle"],               // the break trades
    ska:        ["brass_section","trombone"],     // the horn stab pickup
    klezmer:    ["clarinet","violin"],            // the wailing clarinet run
    funk:       ["clavinet","brass_section"],     // the clav lick / horn hit
    boombap:    ["rhodes_ep","jazz_guitar"],
    amapiano:   ["rhodes_ep","vibraphone"],
    reggae:     ["percussive_organ","clean_guitar"],   // the skank organ turn
    heavymetal: ["distortion_guitar","@fuzz"],    // the guitar solo run
    budstep:    ["distortion_guitar","@fuzz"],
    pixiewave:  ["@stack","@pluck"],
  };

  // (KERNEL-V4 §3.6) per-genre lead ARTICULATION — the amp-envelope / sine-octave
  // / filter-sweep fields that spread the catalog ACROSS the space instead of
  // collapsing every genre onto the default lead voice — used to be a load-time
  // patch (an ARTIC table Object.assign'd onto GENRES[g].lead.recipe here). It
  // is now ABSORBED into each anchor's own lead.recipe (grep "ex-ARTIC"): the
  // twelve genres (techno/house/jungle/triphop/vaporwave/synthwave/lofi/
  // downtempo/ambient/dancepop/edm/dubstep) carry their envelope identity inline
  // like every deep-passed anchor (blues/tango/neoclassical/dinosynth), so
  // "instrument identity as the primary timbre axis" lives in the anchor, not a
  // global monkey-patch. Byte-identical: same fields, same key-append order.

  // ---------- blending: N-way weighted mixing ----------
  // weights: [{g, w}] (normalized inside). Scalars weighted-average; discrete
  // dimensions draw a parent genre proportional to weight, per dimension —
  // standing on one anchor (w=1) is purely that genre.
  // Pattern-energy ladders (0-8) for the energy-preserving pattern inheritance
  // inside resolveMulti (patSide): how much MOTION a bass/melody pattern puts
  // in the ear. Ordering is musical, not alphabetical: silence < held roots <
  // walking/dub < riffs and offbeat drive < 16th-note runs and motorik arps.
  const BASS_ENERGY={off:0,root:1,simple:2,pedal:2,sub:2,dub:3,charleston:3,walking:4,hemiola:4,habanera:5,melodic:5,syncopated:5,stab:5,tresillo:5,son:5,octaves:6,rolling:7,drive:7,sixteenths:8,waltzroot:1,oompahpah:3,siciliana:4};   // MUSIC-MIND cells slot by MOTION: charleston is spacious comping, hemiola a slow cross-pulse, tresillo/son clave-locked riffing (habanera's rung); ODD-METER cells slot the same way (waltzroot = held roots, oompahpah = comping, siciliana = a walking lilt)
  const LEAD_ENERGY={off:0,sparse:1,wander:2,composed:3,composed2:3,canon:3,blues:4,roar:4,pentaup:5,updown:5,double:6,arpup:6,arpdown:6,anthem:6,hero:7,arp16:8,motorik:8,motorik23:8,waltz:3,lilt6:4};
  function resolveMulti(weights, seed){
    const ws = weights.filter(x=>GENRES[x.g] && x.w>0);
    if(!ws.length) throw new Error("no valid genres in weights");
    const tot = ws.reduce((s,x)=>s+x.w,0);
    ws.forEach(x=>x.w/=tot);
    const rng = mulberry32(seed>>>0);
    const side = () => { let r=rng(), acc=0;
      for(const x of ws){ acc+=x.w; if(r<=acc) return GENRES[x.g]; }
      return GENRES[ws[ws.length-1].g]; };
    const wRange = (get) => { let lo=0,hi=0;
      for(const x of ws){ const r=get(GENRES[x.g]); lo+=r[0]*x.w; hi+=r[1]*x.w; }
      return [lo,hi]; };
    // ---- ENERGY-PRESERVING PATTERN INHERITANCE ---- Without this the whole
    // space reads as exclusively, uniformly downtempo. The explorer cursor lives BETWEEN
    // stars, so blends are most of what the ear hears; a proportional side()
    // draw let the wash-heavy neighborhood dilute every dancey parent's bass
    // riffs and arps away. For the bass/lead PATTERN draws only, a blend keeps
    // the groove of a parent that is CLEARLY the dancier one (pattern-pool
    // energy >= 1.25 rungs above the runner-up on the 0-8 ladders below) once
    // it has real presence (weight >= .35). Deterministic: weights + static
    // energy tables decide the parent, the in-pool pick is the only rng; pure
    // single-genre resolves (ws.length===1) never enter the branch, so every
    // anchor's seeded draws stay byte-identical. Everything else (kit, form,
    // recipes, fx) still blends proportionally — the takeover moves the
    // PATTERN, not the genre's timbral identity.
    const patSide = (getVoice, tbl) => {
      if(ws.length>1){
        const es=ws.map(x=>{ const pool=(getVoice(GENRES[x.g])||{}).patterns||[];
          const e=pool.length?pool.reduce((s,p)=>s+(tbl[p]||0),0)/pool.length:0;
          return {g:x.g,w:x.w,e}; }).sort((a,b)=>b.e-a.e||b.w-a.w);
        if(es[0].w>=0.35 && es[0].e>=es[1].e+1.25) return GENRES[es[0].g];
      }
      return side();
    };
    const RECIPE_PASSTHROUGH = new Set(["granular", "grainSec"]);   // render-only sampler flags — never draw
    const blendRecipe = (get) => {
      const out={}, keys=new Set();
      ws.forEach(x=>Object.keys(get(GENRES[x.g])).forEach(k=>keys.add(k)));
      for(const k of keys){
        // parents missing a key sit out; weights renormalize over those that have it
        const have=ws.filter(x=>get(GENRES[x.g])[k]!=null);
        if(!have.length) continue;
        const v=get(have[0].g?GENRES[have[0].g]:GENRES[ws[0].g])[k];
        // RENDER-ONLY numeric flags (granular threshold &c): pass the dominant
        // parent's literal through with ZERO rng draws, so opting a genre in
        // perturbs no downstream draw — the COMPOSITION is byte-identical and only
        // the sampler render changes. (A plain scalar would else hit the numeric
        // branch below and burn an inRange draw, rewriting the whole track.)
        if(RECIPE_PASSTHROUGH.has(k)){ out[k]=v; continue; }
        if(Array.isArray(v)&&typeof v[0]==="string"){                 // model pool: draw a parent that has it
          let r=rng()*have.reduce((s,x)=>s+x.w,0), acc=0, src=have[have.length-1];
          for(const x of have){ acc+=x.w; if(r<=acc){ src=x; break; } }
          out[k]=pick(rng, get(GENRES[src.g])[k]);
        } else if(Array.isArray(v)||typeof v==="number"){
          let lo=0,hi=0,tw=0;
          for(const x of have){ const r=get(GENRES[x.g])[k]; const rr=Array.isArray(r)?r:[r,r];
            lo+=rr[0]*x.w; hi+=rr[1]*x.w; tw+=x.w; }
          out[k]=round(inRange(rng,[lo/tw,hi/tw]),4);
        } else out[k]=v;
      }
      return out;
    };
    // one parent draw per dimension GROUP: fields that must cohere (a vox
    // recipe and its source pool; a found role and its sources; the national-
    // character extras) come from the SAME parent. Calling side() per field
    // could check canawave's .vox then read ambient's — a crash on any
    // vox-genre × plain-genre blend.
    const hitsSide=side(), voxSide=side(), foundSide=side(), extraSide=side();
    // DX7 patch-space resolution: when a voice resolved to model "dx7", each
    // parent with a patchPool for that voice nominates one patch (per side(),
    // like every other pool). SAME algorithm across nominees -> lerp the
    // ~144-dim param vectors by weight (patch-space morphing); different
    // algorithms are different FM topologies -> pick a side. Returns
    // {algorithm, params, name} or null (no valid patch -> caller falls back).
    const dx7For=(getVoice, recipe)=>{
      if(!recipe||recipe.model!=="dx7") return null;
      const cands=ws.map(x=>({w:x.w, pool:(getVoice(GENRES[x.g])||{}).patchPool}))
        .filter(c=>Array.isArray(c.pool)&&c.pool.length)
        .map(c=>({w:c.w, name:pick(rng,c.pool)}))
        .filter(p=>DX7_PATCHES[p.name]);
      if(!cands.length) return null;
      const algs=new Set(cands.map(p=>DX7_PATCHES[p.name].algorithm));
      if(cands.length>1&&algs.size===1&&new Set(cands.map(p=>p.name)).size>1){
        const tot=cands.reduce((s,p)=>s+p.w,0), P0=DX7_PATCHES[cands[0].name];
        const params={};
        for(const k of Object.keys(P0.params)){
          let v=0; for(const p of cands) v+=(DX7_PATCHES[p.name].params[k]||0)*(p.w/tot);
          params[k]=round(v,2);
        }
        return {algorithm:P0.algorithm, params, name:cands.map(p=>p.name.trim()).join("~")};
      }
      let r=rng()*cands.reduce((s,p)=>s+p.w,0), acc=0, src=cands[cands.length-1];
      for(const p of cands){ acc+=p.w; if(r<=acc){ src=p; break; } }
      const P=DX7_PATCHES[src.name];
      return {algorithm:P.algorithm, params:Object.assign({},P.params), name:src.name.trim()};
    };
    // SAMPLER resolution: when a voice resolved to model "sampler", each
    // parent with a samplerPool for that voice nominates one instrument
    // (per side(), like every pool); weighted pick. Returns an id in
    // SAMPLERS or null (caller falls back to a synth model).
    const samplerFor=(getVoice, recipe)=>{
      if(!recipe||recipe.model!=="sampler") return null;
      const cands=ws.map(x=>({w:x.w, pool:(getVoice(GENRES[x.g])||{}).samplerPool}))
        .filter(c=>Array.isArray(c.pool)&&c.pool.length)
        .map(c=>({w:c.w, id:pick(rng,c.pool)}))
        .filter(c=>SAMPLERS[c.id]);
      if(!cands.length) return null;
      let r=rng()*cands.reduce((s,c)=>s+c.w,0), acc=0, src=cands[cands.length-1];
      for(const c of cands){ acc+=c.w; if(r<=acc){ src=c.id; break; } }
      return typeof src==="string"?src:src.id;
    };
    // per-voice insert-FX chain: pool-union across parents (weighted, like every
    // other pool); parents sharing a type blend its param ranges by weight, then
    // one seeded sample per param. Fire probability is the weighted average of
    // parents' prob (parents WITHOUT inserts dilute it — a techno×vaporwave
    // midpoint sweeps its bass half as often as pure techno). 0-2 entries.
    const insertsFor=(getVoice)=>{
      const cands=ws.map(x=>({w:x.w, cfg:(getVoice(GENRES[x.g])||{}).inserts}))
        .filter(c=>c.cfg&&Array.isArray(c.cfg.pool)&&c.cfg.pool.length);
      if(!cands.length) return [];
      const prob=cands.reduce((s,c)=>s+(c.cfg.prob!=null?c.cfg.prob:0.5)*c.w,0);
      if(rng()>=prob) return [];
      const typeW={};   // type -> [{w, pr}] across parents (the union)
      for(const c of cands) for(const [t,pr] of c.cfg.pool){ if(INSERT_DEFAULTS[t]) (typeW[t]=typeW[t]||[]).push({w:c.w, pr:pr||{}}); }
      const types=Object.keys(typeW);
      if(!types.length) return [];
      const drawType=(exclude)=>{
        const avail=types.filter(t=>t!==exclude);
        if(!avail.length) return null;
        const tot=avail.reduce((s,t)=>s+typeW[t].reduce((a,e)=>a+e.w,0),0);
        let r=rng()*tot, sel=avail[avail.length-1];
        for(const t of avail){ const w=typeW[t].reduce((a,e)=>a+e.w,0); if((r-=w)<=0){ sel=t; break; } }
        return sel;
      };
      const mk=(t)=>{
        const ent=typeW[t], fx={type:t};
        for(const k of Object.keys(INSERT_DEFAULTS[t])){
          let lo=0,hi=0,tw=0;
          for(const e of ent){ const r=e.pr[k]; if(r==null) continue;
            const rr=Array.isArray(r)?r:[r,r]; lo+=rr[0]*e.w; hi+=rr[1]*e.w; tw+=e.w; }
          // null default = OPTIONAL key (higain/fenv/tremolo.rateBars): an anchor
          // that doesn't declare it emits NO key (absent-law), not a null. Types
          // with non-null defaults are byte-identical to the pre-null-era draw;
          // optional keys round at 4 (no history to preserve, and a tempo-sync
          // division like 1/16 = .0625 must survive the draw EXACTLY — .063
          // would precess a trance gate off the grid).
          if(tw>0) fx[k]=round(inRange(rng,[lo/tw,hi/tw]),INSERT_DEFAULTS[t][k]==null?4:3);
          else if(INSERT_DEFAULTS[t][k]!=null) fx[k]=INSERT_DEFAULTS[t][k];
        }
        return fx;
      };
      const maxN=Math.max(...cands.map(c=>c.cfg.max||1));
      const chain=[], t1=drawType(null);
      if(t1) chain.push(mk(t1));
      if(maxN>=2 && types.length>1 && rng()<0.35){ const t2=drawType(t1); if(t2) chain.push(mk(t2)); }
      return chain;
    };
    let kitSide=null;   // captured so euclid coheres with the KIT parent (same rng draw order as before)
    const choice = {
      genres:ws.map(x=>x.g), weights:ws.map(x=>round(x.w,3)), t:round(1-(ws[0]?ws[0].w:1),3), seed,
      bpm: Math.round(inRange(rng, wRange(g=>g.bpm))),
      swing: round(inRange(rng, wRange(g=>g.swing)),3),
      humanize: round(inRange(rng, wRange(g=>g.humanize)),3),
      progression: pick(rng, side().progressions),
      kit: pick(rng, (kitSide=side()).kits),
      fills: side().fills,
      bassPattern: pick(rng, patSide(g=>g.bass, BASS_ENERGY).bass.patterns),
      bassRecipe: blendRecipe(g=>g.bass.recipe),
      leadPattern: pick(rng, patSide(g=>g.lead, LEAD_ENERGY).lead.patterns),
      leadRecipe: blendRecipe(g=>g.lead.recipe),
      padsOn: rng() < ws.reduce((s,x)=>s+GENRES[x.g].pads.prob*x.w,0),
      padRecipe: blendRecipe(g=>g.pads.recipe),
      drumRecipe: blendRecipe(g=>g.drums),
      fx: blendRecipe(g=>g.fx),
      foundRole: foundSide.found.role,
      // SCRATCH probability. Anywhere a vocal chop / synth sample / instrumental
      // is looped, it can scratch — so the CHOPS role (looped vocal/instrumental/
      // synth-sample slices) scratches BY DEFAULT catalog-wide; a genre can still
      // override with an explicit `scratch:` (incl 0 to opt out). BREAK (drum
      // loops) is NOT defaulted — it stays per-genre opt-in (boombap/jungle set it
      // explicitly, and there the scratch rides only the stutter ornament).
      foundScratch: foundSide.found.scratch != null ? foundSide.found.scratch
        : (foundSide.found.role === "chops" ? 0.14 : 0),
      foundSource: pick(rng, expandPools(foundSide.found.sources, seed)),
      // distinct beds/narration chunks to rotate (kills the one-loop repeat).
      // Cap and widen answer two symptoms at once: 202 of 259
      // `pool:x*N` tokens ask for a single member, so a class pool's minority
      // crates (the 4 BBC ids in a pool of 14-20, the Naropa readings in
      // `voices`) reached only ~17% of tracks and the sections that did have a
      // bed kept repeating the same two. Widening the expansion and raising the
      // cap rotates a real slice of the crate across the sections; sources are
      // decoded per-event (live.js kicks a buffer only when an event names it),
      // so the media cost tracks the SECTION count, not the pool size.
      // ONLY the roles that rotate: break/chops lock to the single tempo-matched
      // foundSource (toState's bedPool), so widening their pool would move their
      // rng stream for no audible gain — they keep the old width exactly.
      foundPool: (()=>{ const rot=foundSide.found.role==="bed"||foundSide.found.role==="narration";
        const a=expandPools(foundSide.found.sources, seed, rot?FOUND_POOL_WIDEN:0).slice(), o=[], n=Math.min(rot?FOUND_POOL_CAP:6,a.length);
        while(o.length<n&&a.length) o.push(a.splice(Math.floor(rng()*a.length),1)[0]); return o; })(),
      voxPool: (voxSide.vox ? (()=>{ const a=expandPools(voxSide.vox.sources, seed).slice(), o=[], n=Math.min(3,a.length);   // VO lines to rotate across sections
        while(o.length<n&&a.length) o.push(a.splice(Math.floor(rng()*a.length),1)[0]); return o; })() : []),
      voxRecipe: voxSide.vox || null,
      voxClean: !!(voxSide.vox && voxSide.vox.clean),
      voxPoem: voxSide.voxPoem || null,
      vocSource: extraSide.vocSource || null,
      snarePP: extraSide.snarePP || 0,
      vocal: !!extraSide.vocal, vocalVol: extraSide.vocalVol,
      realHats: !!extraSide.realHats,
      foundRecipe: blendRecipe(g=>({vol:g.found.vol,pitch:g.found.pitch,stretch:g.found.stretch,cutoff:g.found.cutoff})),
      stab: pick(rng, side().stab),
      hits: rng()<hitsProb(hitsSide.hits.prob) ? {source:pick(rng,expandPools(hitsSide.hits.sources, seed)), pattern:hitsSide.hits.pattern, wet:hitsSide.hits.wet, glitch:hitsSide.hits.glitch, vol:hitsSide.hits.vol, cut:hitsSide.hits.cut} : null,
      form: side().form,
      rng,
    };
    // Strudel-borrowed euclid rhythm rides the kit's parent (a kit-level option)
    choice.euclid = kitSide&&kitSide.euclid ? JSON.parse(JSON.stringify(kitSide.euclid)) : null;
    // resolve dx7 patches per voice; a voice that picked "dx7" but found no
    // patch (empty registry, browser without presets) falls back to a legacy
    // model so the state always renders on every engine.
    choice.bassDx7 = dx7For(g=>g.bass, choice.bassRecipe);
    choice.leadDx7 = dx7For(g=>g.lead, choice.leadRecipe);
    choice.padDx7  = dx7For(g=>g.pads, choice.padRecipe);
    if(choice.bassRecipe.model==="dx7"&&!choice.bassDx7) choice.bassRecipe.model="sub";
    if(choice.leadRecipe.model==="dx7"&&!choice.leadDx7) choice.leadRecipe.model="fm";
    if(choice.padRecipe.model==="dx7"&&!choice.padDx7)   choice.padRecipe.model="bell";
    // resolve sampler instruments per voice; no instrument -> synth fallback
    // (empty registry / a blend whose parents carry no samplerPool)
    choice.leadSampler=samplerFor(g=>g.lead, choice.leadRecipe);
    choice.padSampler =samplerFor(g=>g.pads, choice.padRecipe);
    choice.bassSampler=samplerFor(g=>g.bass, choice.bassRecipe);   // upright bass etc — the bass voice is sampler-capable now
    if(choice.leadRecipe.model==="sampler"&&!choice.leadSampler) choice.leadRecipe.model="fm";
    if(choice.padRecipe.model==="sampler"&&!choice.padSampler)   choice.padRecipe.model="strings";
    if(choice.bassRecipe.model==="sampler"&&!choice.bassSampler) choice.bassRecipe.model="saw";
    // per-voice insert-FX chains (drawn LAST so all prior seeded choices keep
    // their historical rng positions; constraint pass prunes bad pairings)
    choice.bassInserts=insertsFor(g=>g.bass);
    choice.leadInserts=insertsFor(g=>g.lead);
    choice.padInserts =insertsFor(g=>g.pads);
    // ---- neoclassical deep-pass dimensions, drawn LAST like the
    // inserts: parents WITHOUT these specs consume ZERO rng draws here, so
    // every other genre's states stay byte-identical (regression gate).
    // Weighted like inserts: prob and ranges renormalize over the parents
    // that carry the spec, diluted by the parents that don't.
    const specsOf=(field)=>ws.map(x=>({w:x.w, s:GENRES[x.g][field]})).filter(c=>c.s);
    const specRange=(cands,k,dflt)=>{ let lo=0,hi=0,tw=0;
      for(const c of cands){ const r=c.s[k]!=null?c.s[k]:dflt; const rr=Array.isArray(r)?r:[r,r];
        lo+=rr[0]*c.w; hi+=rr[1]*c.w; tw+=c.w; }
      return inRange(rng,[lo/tw,hi/tw]); };
    const specProb=(cands,dflt)=>cands.reduce((s,c)=>s+(c.s.prob!=null?c.s.prob:dflt)*c.w,0);
    // RUBATO — the time dimension: {depth (tempo sway ±fraction), periodBars,
    // phase (seeded)} -> state.rubato -> ONE beat-warp in csd-engine
    // buildEvents (all engines + layers inherit the same musical clock).
    const rub=specsOf("rubato");
    if(rub.length && rng()<specProb(rub,1))
      choice.rubato={ depth:round(specRange(rub,"depth",[.02,.04]),4),
        periodBars:Math.round(specRange(rub,"periodBars",[2,4])), phase:round(rng(),3) };
    // COUNTERPOINT — a second, quieter instance of the lead instrument (the
    // solo recipe merges over instruments.melody, so a felt-piano lead gets a
    // felt-piano counter voice) an octave below, on a mirrored/oblique
    // pattern: arps answer in contrary motion, moving lines get long tones
    // (oblique), a sparse lead gets a quiet wandering under-voice.
    const cpt=specsOf("counterpoint");
    if(cpt.length && rng()<specProb(cpt,0.66)){
      const mirror={arpup:"arpdown",arpdown:"arpup",canon:"sparse",wander:"sparse",sparse:"wander"};
      choice.counter={ pattern:mirror[choice.leadPattern]||"sparse",
        solo:{ level:round(Math.max(.15,(choice.leadRecipe.level||.5)*.45),3),
               send:round(Math.min(.7,(choice.leadRecipe.send||.4)+.1),3) },   // quieter + a touch wetter = behind the lead
        octave:-1 };
    }
    // MECHANICAL INTIMACY — soft key/pedal thunks on a fraction of lead notes
    // (state.thunk -> whisper-level tom hits in buildEvents, ~-30dB).
    const thk=specsOf("thunk");
    if(thk.length && ws.some(x=>GENRES[x.g].thunk))
      choice.thunk={ prob:round(specRange(thk,"prob",[.2,.35])*thk.reduce((s,c)=>s+c.w,0),3),
        amp:round(specRange(thk,"amp",[.026,.038]),4) };
    // ---- transition micro-lick soloist ----
    // one tiny soloist per track for the "micro lick" transition, drawn from
    // LICKS by weighted parent pick (parents without a pool contribute
    // nothing — a techno×ambient blend keeps techno's soloist). Drawn after
    // the neoclassical dims so earlier seeded choices keep their positions.
    {
      const cands=ws.map(x=>({w:x.w, pool:LICKS[x.g]})).filter(x=>Array.isArray(x.pool)&&x.pool.length);
      if(cands.length){
        let r=rng()*cands.reduce((s,x)=>s+x.w,0), src=cands[cands.length-1];
        for(const x of cands){ if((r-=x.w)<=0){ src=x; break; } }
        choice.lick=pick(rng, src.pool);
      } else choice.lick=null;
    }
    // ---- harmonic rhythm (KERNEL-V4 Phase 1: chordEvery) — drawn LAST, and
    // ONLY when a parent anchor declares it: absent = ZERO rng draws here, so
    // every current genre stays byte-identical (fixtures.js pins this).
    // chordEvery = beats per chord bar (engine default 8); a blend picks a
    // parent by weight — parents without the key implicitly carry 8.
    if(ws.some(x=>GENRES[x.g].chordEvery)){
      let r=rng(), acc=0, gsel=ws[ws.length-1].g;
      for(const x of ws){ acc+=x.w; if(r<=acc){ gsel=x.g; break; } }
      const ce=Math.round(GENRES[gsel].chordEvery||8);
      if(ce&&ce!==8) choice.chordEvery=ce;
    }
    // ---- pattern-transform algebra (KERNEL-V4 Phase 2): the per-cycle
    // transform pass is a blendable DIMENSION now. state.transforms = {pool,
    // rate, schedule, everyN, targets} -> csd-engine's one generic pass.
    // Blend = POOL UNION + RATE LERP, with ZERO rng draws (like reverbColor's
    // dominant-parent inherit): parents WITHOUT `transforms` sit out entirely,
    // so untouched anchors keep every prior seeded choice AND render the
    // engine's historical default (rate .25, the 5 core ops) byte-identically.
    // Only declaring genres (idm/minimal/tango…) carry the field; a blend
    // unions their pools and lerps the fire-rate, so a techno×idm midpoint
    // inherits idm's braindance vocabulary at half the density.
    {
      const tcands=ws.map(x=>({w:x.w, t:GENRES[x.g].transforms})).filter(c=>c.t);
      if(tcands.length){
        const tw=tcands.reduce((s,c)=>s+c.w,0);
        const ordered=tcands.slice().sort((a,b)=>b.w-a.w);   // weight-ordered = deterministic union order
        const pool=[]; for(const c of ordered) for(const op of (c.t.pool||[])) if(pool.indexOf(op)<0) pool.push(op);
        let rate=0; for(const c of tcands){ const r=c.t.rate; const rr=Array.isArray(r)?(r[0]+r[1])/2:(r!=null?r:0.25); rate+=rr*c.w; }
        const dom=ordered[0].t;   // schedule/everyN/targets are structural — from the dominant declaring parent (no lerp)
        choice.transforms={ pool, rate:round(rate/tw,3) };
        if(dom.schedule) choice.transforms.schedule=dom.schedule;
        if(dom.everyN)   choice.transforms.everyN=dom.everyN;
        if(dom.targets)  choice.transforms.targets=dom.targets;
      }
    }
    // ---- unified time-feel (KERNEL-V4 Phase 3): swing amount + humanize are
    // already blended scalars (state.swing/state.humanize above); this block
    // resolves the FAMILY's new members — state.timeFeel = { grid, pushPull }
    // -> csd-engine resolveTimeFeel. Blend is ZERO-rng (the reverbColor/
    // transforms dominant-parent law): `grid` (the swing subdivision, enum)
    // comes from the dominant DECLARING parent; `pushPull` (per-voice ±beats,
    // laid-back bass / on-top hats) is UNIONed over voices and value-LERPed by
    // weight across declaring parents. Parents WITHOUT `timeFeel` sit out, so
    // untouched anchors keep grid "8th" + no push-pull and press byte-identically.
    {
      const fcands=ws.map(x=>({w:x.w, f:GENRES[x.g].timeFeel})).filter(c=>c.f);
      if(fcands.length){
        const ordered=fcands.slice().sort((a,b)=>b.w-a.w);   // weight-ordered = deterministic dominant + union order
        const tfl={};
        const gdom=ordered.find(c=>c.f.grid);   // grid: dominant declaring parent (structural enum, no lerp)
        if(gdom) tfl.grid=gdom.f.grid;
        // pushPull (BEATS) and pushPullMs (MILLISECONDS, tempo-honest — see
        // csd-engine resolvePushPull) blend the SAME way and independently: union
        // the lanes over declaring parents, value-LERP by weight. They stay in
        // separate maps through the blend because they carry different units; the
        // engine sums them at the choke point against the blend's own bpm. Lerping
        // a ms lane is exactly right for a blend — the resulting mixed tempo folds
        // the mixed millisecond value, which is the whole point of the unit.
        const ppBlend=(key)=>{
          const cs=fcands.filter(c=>c.f[key]);
          if(!cs.length) return;
          const w=cs.reduce((s,c)=>s+c.w,0), pp={};
          for(const c of ordered) for(const v of Object.keys(c.f[key]||{})) if(!(v in pp)) pp[v]=0;
          for(const c of cs) for(const v of Object.keys(c.f[key])) pp[v]+=c.f[key][v]*c.w;
          for(const v of Object.keys(pp)) pp[v]=round(pp[v]/w, key==="pushPullMs"?2:4);
          tfl[key]=pp;
        };
        ppBlend("pushPull"); ppBlend("pushPullMs");
        if(Object.keys(tfl).length) choice.timeFeel=tfl;
      }
    }
    // ---- generalized SAMPLE-EVENT ROLES (KERNEL-V4 Phase 4): the bespoke
    // sample placements (horn/ding/stations/vocal/…) generalize into
    // state.sampleEvents = [ { pool, placement, sync, sections, treatment,
    // gain, prob } ] -> csd-engine's one sample-event pass. Resolved by the
    // DOMINANT-parent law (the reverbColor/transforms structural-dimension
    // precedent): ZERO rng draws, so untouched anchors keep every prior seeded
    // choice AND render no sample-event layer (byte-identical, fixtures.js pins
    // it); a blend inherits its dominant parent's role list (whose foundSources
    // dominate the mix anyway — pool-union across parents stays deferred with
    // the rest of the full-adoption vision). toState injects each spec's pool
    // ids into foundSources so buildEvents' srcById can resolve them.
    // ---- dominant-parent PURE-COPY dims (the reverbColor/transforms structural
    // law): ZERO rng draws, each copied WHOLE from the genuinely dominant parent
    // when it declares the dim; absent => no field => untouched anchors press
    // byte-identically. ONE registry loop over ONE hoisted `top` (assignment
    // order preserved for state-hash stability); the presence guard differs per
    // dim (see each):
    //   sampleEvents (Phase-4 sample-event roles) — array+length; the dominant
    //     parent's role list (toState injects the pool ids into foundSources so
    //     buildEvents' srcById resolves them). A blend inherits the dominant
    //     parent's list (its foundSources dominate the mix anyway).
    //   reverbColor  — names an external dist/reverb_* module replacing the
    //     fx_bus internal zita; truthy (a blend into uncolored territory drops
    //     the color at the crossover, an audible flip).
    //   autoTune     — bends only the found-VOICE layer's pitch (buildEvents/
    //     verifier never read it); != null so an explicit 0 (spokenword: don't
    //     tune the poet) still carries.
    //   masterComp   — 3-band master glue-comp drive; != null (absent => 0 =>
    //     fx_bus master byte-identical).
    //   introMode    — "off"|"short"|"full" optional-intro; truthy (absent =>
    //     full intro => buildSections byte-identical).
    {
      const top=ws.slice().sort((a,b)=>b.w-a.w)[0], G=top&&GENRES[top.g];
      const declared={ sampleEvents:v=>Array.isArray(v)&&v.length, reverbColor:v=>!!v,
        autoTune:v=>v!=null, masterComp:v=>v!=null, introMode:v=>!!v, blueNote:v=>v>0, padDouble:v=>!!v,
        leadOctave:v=>!!v, strum:v=>!!v };   // strum: the dominant parent's rhythm-guitar comp survives the blend (absent = flat pad = byte-identical)
      if(G) for(const d of ["sampleEvents","reverbColor","autoTune","masterComp","introMode","blueNote","padDouble","leadOctave","strum"])
        if(declared[d](G[d])) choice[d]=G[d];
    }
    // ---- MUSIC-MIND axes (organ wiring): theory / pipes / rhythm —
    // drawn LAST, dead last (the chordEvery precedent: new dimensions draw
    // after every historical choice so the only stream consequence is the
    // tail into buildSections — re-proven by the matrix gate, never assumed).
    // Unlike chordEvery these draws are UNCONDITIONAL (deriveMind attached
    // the axes to all 178 anchors at load), but the draw count is fixed per
    // parent set, so every resolve stays seed-stable (gate 1 determinism).
    {
      // adventure / color / complexity: scalar ranges lerp via the standing
      // wRange weighted blend (the bpm/swing law), then one sample each.
      const adv=round(inRange(rng, wRange(g=>g.theory.adventure)),3);
      const col=round(inRange(rng, wRange(g=>g.theory.color)),3);
      // voicing: enum → side() parent pick (the form/kit law: a blend keeps
      // ONE parent's voicing hand, it doesn't smear drop2 into quartal).
      const vSide=side();
      // reharm: zero-rng weighted vote — a blend reharmonizes only when the
      // reharming parents carry at least half the weight (constrain below
      // re-fences it against low adventure and drone plateaus).
      const reharmShare=ws.reduce((s,x)=>s+(GENRES[x.g].theory.reharm?x.w:0),0);
      choice.theory={ adventure:adv, color:col, voicing:vSide.theory.voicing, reharm:reharmShare>=.5,
        ...(vSide.theory.tables?{tables:vSide.theory.tables}:{}) };   // corpus tables follow the dominant parent, like voicing (conditional spread — tableless blends byte-identical)
      // pipes: weighted pool UNION (the transforms union order — weight-
      // ordered parents, dedupe by id keeping the dominant parent's params);
      // inclusion prob = Σ spec.w × parent weight, so a techno×ambient
      // midpoint pumps its bass half as often as pure techno (the insertsFor
      // dilution law). ONE rng draw per candidate, ALWAYS taken (stable
      // stream); the first 3 passers ride (the ≤3 taste cap).
      const ordered=ws.slice().sort((a,b)=>b.w-a.w), seen={}, cands=[];
      for(const x of ordered) for(const sp of (GENRES[x.g].pipes||[])){
        if(!seen[sp.id]){ seen[sp.id]={spec:sp, w:0}; cands.push(seen[sp.id]); }
        seen[sp.id].w+=(sp.w!=null?sp.w:.5)*x.w;
      }
      const pipes=[];
      for(const cd of cands){
        const r=rng();
        if(pipes.length>=3||r>=cd.w) continue;
        const spec={}; for(const k of Object.keys(cd.spec)) if(k!=="w") spec[k]=cd.spec[k];   // strip the inclusion weight; the rest IS the state pipe
        pipes.push(spec);
      }
      choice.pipes=pipes;
      choice.rhythmComplexity=round(inRange(rng, wRange(g=>g.rhythm)),3);
    }
    // ---- ODD METER ): meter as an anchor dimension — drawn LAST,
    // dead last, and ONLY when a parent declares it (the chordEvery
    // precedent: no meter parent = ZERO rng draws here, so every existing
    // genre resolves byte-identically). Anchor field: meter:{beats:3,unit:4}
    // (a waltz) or {beats:6,unit:8} (compound 6/8; the engine beat is the
    // 8th). METERS DON'T LERP: a bar holds an integer number of beats, and
    // there is no music halfway between 3/4 and 4/4 — a weighted average
    // would land on no meter at all. So the blend rule is parent-PICK by
    // weight (the form/voicing enum law): a blend keeps ONE parent's bar
    // line, and the crossover on a journey is an audible meter-flip — an
    // event, which is what makes the in-between space interesting rather
    // than mushy. A pick that lands on a meterless parent emits nothing
    // (the blend fell to the 4/4 side).
    if(ws.some(x=>GENRES[x.g].meter)){
      let r=rng(), acc=0, gsel=ws[ws.length-1].g;
      for(const x of ws){ acc+=x.w; if(r<=acc){ gsel=x.g; break; } }
      const m=GENRES[gsel].meter;
      if(m&&(m.beats===3||m.beats===6)){
        choice.meter={beats:m.beats, unit:m.unit||(m.beats===3?4:8)};
        // meter-fitting harmonic rhythm: a meter anchor without chordEvery
        // gets the engine's meter default (6 = two 3/4 measures / one 6/8
        // measure per chord) EXPLICITLY, so buildSections' beat math
        // (cycleBeats, the duration solver, the evolution pass) agrees with
        // buildEvents; a blend that inherited a 4/4 parent's chordEvery
        // (8/16/32) snaps to the nearest multiple of 6 so kit/bass cells
        // stay on the measure grid. Zero rng either way.
        if(!choice.chordEvery) choice.chordEvery=6;
        else if(choice.chordEvery%6) choice.chordEvery=Math.max(6,Math.round(choice.chordEvery/6)*6);
      }
    }
    return constrain(choice);
  }
  function constrain(choice){
    // ---- constraints: keep midpoints songs ----
    const nch=(E.PROGRESSIONS[choice.progression]||{chords:[]}).chords.length;
    if(nch<=2 && ["composed","composed2"].includes(choice.leadPattern)) choice.leadPattern="arpup";
    // above 150 only kits that survive the tempo stay: chopped breaks OR straight
    // machine kits (gabber's distorted four, psytrance's pulse). Loping/swung kits
    // (full/boombap/halftime/...) still snap to jungle. METER states are exempt:
    // a fast 3/4 or 6/8 (a Viennese one-two-three, a 6/8 tarantella at speed)
    // keeps its bar line — snapping to the 4/4 jungle chop would break the meter
    // the anchor declared. Zero-rng, fires only on meter-carrying resolves.
    if(choice.bpm>=150 && !choice.meter && !["jungle","breaks","four","techno","pulse","electro"].includes(choice.kit)) choice.kit="jungle";
    if(choice.kit==="off"){ choice.foundRole="bed"; choice.stab="off"; }
    if(choice.foundRole==="chops" && choice.bpm<70) choice.foundRole="bed";
    if(choice.foundRole==="break" && !(SAMPLES[choice.foundSource]||{}).bpm){
      // break role needs a tempo-known break sample; otherwise fall back
      choice.foundSource="amen_170"; }
    if(choice.foundRole!=="break" && (SAMPLES[choice.foundSource]||{}).kind==="break"){
      choice.foundRole="break"; }
    // insert-FX sanity: some pairings are always wrong regardless of the blend
    const insOk=(chain,recipe,voice)=>(chain||[]).filter(fx=>{
      // sampler voices render on the NATIVE path (no Faust insert chain) — but a
      // declared DISTORT is FOLDED into the voice's channel strip (state-engine
      // heavyDriveOf/aggressiveStrip): a heavy tanh fuzz + metal EQ. So keep the
      // distort on samplers (that is how budstep's guitar wall gets its grit).
      // HIGAIN and FENV also pass (balance loop 3): their SYNTHESIS-DEPTH
      // contract explicitly includes the sampled lane (VOICES.md — higain "NOT
      // excluded on samplers"; fenv IS the squelch "for SAMPLED voices"), and
      // 79c7da2 honors explicit chains there via the real insert_* modules.
      // Every other insert type the native strip can't run is still dropped.
      if(recipe.model==="sampler") return fx.type==="distort"||fx.type==="higain"||fx.type==="fenv";
      if(fx.type==="distort"&&(recipe.model==="fuzz"||(recipe.drive||0)>=0.3)) return false;  // no distort on already-fuzz/driven voices
      if(voice==="bass"&&(fx.type==="chorus"||fx.type==="phaser")&&recipe.model==="sub") return false;  // the sub stays solid + mono
      if(fx.type==="filtersweep"&&recipe.model==="wobble") return false;  // the wobble IS the sweep
      return true;
    });
    choice.bassInserts=insOk(choice.bassInserts,choice.bassRecipe,"bass");
    choice.leadInserts=insOk(choice.leadInserts,choice.leadRecipe,"lead");
    choice.padInserts =insOk(choice.padInserts, choice.padRecipe, "pad");
    // ---- MUSIC-MIND taste caps (docs/MUSIC-MIND.md §"What locked-in means") ----
    if(choice.theory){
      choice.theory.adventure=Math.min(.75,choice.theory.adventure);   // never full chaos — the cadence handrail survives every macro/blend
      if(nch<=2){ choice.theory.adventure=Math.min(.1,choice.theory.adventure); choice.theory.reharm=false; }   // drone/plateau progressions (drone_min, deep_two, funk_vamp): restraint is identity — a blend that landed on the drone keeps the drone
      if(choice.theory.adventure<.15) choice.theory.reharm=false;      // below .15 a reharm is indistinguishable noise: don't spend the stream
    }
    if(choice.pipes&&choice.pipes.some(p=>p.id==="densityArc")&&choice.pipes.some(p=>p.id==="echoCanon"))
      choice.pipes=choice.pipes.filter(p=>p.id!=="echoCanon");         // the arc thins what the canon thickens = mud; the arc wins (form-level shape beats phrase-level ornament)
    if(choice.bpm>165&&choice.rhythmComplexity>.4) choice.rhythmComplexity=.4;   // fast genres saturate on their own — a 190bpm amen needs no extra push
    return choice;
  }
  function resolve(aName, bName, t, seed){
    t=Math.max(0,Math.min(1,t||0));
    return resolveMulti([{g:aName,w:1-t},{g:bName||aName,w:t}], seed);
  }

  // ---------- forms ----------
  let _gid=0; const gid=()=>"g"+(++_gid);
  const S=(name,o)=>Object.assign({id:gid(),name,cycles:1,pads:false,bass:"off",drums:"off",melody:"off",found:{sourceId:null,role:"bed"},fill:"off"},o);

  // ---------- FORM GRAPH (KERNEL-V4 §3.5) ----------
  // The seven forms are DATA: each is an ordered array of typed nodes (the
  // sectionTag vocabulary — ground/build/peak/release/exposed/cadence —
  // classified from the name by csd-engine.sectionTag), interpreted by ONE
  // generic walker (buildForm below). This retires the old seven-branch
  // if/else chain. HARD CONSTRAINT (why Phase 5/6 deferred it): the walk is
  // BYTE-IDENTICAL to the chain — same names, same cycle counts, same rng
  // draws in the same order, every genre × seed. Verified at ZERO fixture
  // drift. Mechanism: a node's dynamic values are TOKENS (Tok) resolved in
  // object-key insertion order, so the only draw-bearing tokens (FILL, SWEEP)
  // fire in exactly the source order; every other value is a deterministic
  // context lookup or an inline data literal (deep-cloned per emission to
  // match the chain's fresh-object-per-call semantics). Node key order is
  // transcribed verbatim from the old literals so the emitted section objects
  // serialize identically (fixtures hash JSON.stringify, key order included).
  // The three bespoke forms (ritual/anthem/transit) are video-locked and
  // hand-authored — transcribed exactly, recipes inlined as data.
  class Tok{ constructor(t,a){ this.t=t; this.a=a; } }
  const OMIT=Symbol("omit");
  const NN=(k)=>new Tok("n",k);           // k*norm cycle count
  const KIT=new Tok("kit");               // c.kit ("off"->"off")
  const LEAD=new Tok("lead");             // c.leadPattern
  const LEADSP=new Tok("leadSparse");     // lead==="off"?"off":"sparse"
  const BASS=new Tok("bass");             // c.bassPattern
  const PADS=new Tok("pads");             // c.padsOn
  const STAB=new Tok("stab");             // c.stab
  const HIT=new Tok("hit");               // hit()
  const FND=(role)=>new Tok("fnd",role);  // fnd(role)  (no draw)
  const FILL=new Tok("fill");             // F() = pick(c.rng,c.fills)   [DRAWS]
  const SWEEP=(p,on)=>new Tok("sweep",{p,on}); // c.rng()<p?on:"off"    [DRAWS]
  const COUNTEROPT=new Tok("counterOpt"); // wave: (c.counter&&lead!=="off")?c.counter:OMIT
  const VOXCLEAN=new Tok("voxClean");     // {sourceId:"vox", clean:c.voxClean}
  const POEM=new Tok("poem");             // {sourceId:"poem", clean:false}
  // bespoke recipe literals (transcribed verbatim from the old bespoke branches)
  const R_SAUROPOD={model:"brass",cutoff:900, level:0.6, voices:1};
  const R_RAPTOR  ={model:"stack",wave:"saw",cutoff:3500,res:0.2,level:0.48,voices:2,spread:0.01,vibrato:0.024};
  const R_FUZZ    ={model:"fuzz", cutoff:2600,level:0.66,voices:2,res:0.3,drive:1};
  const R_SWELLBRASS={model:"brass", cutoff:9000, level:1.9, voices:1};
  const R_TW_COUNTER={pattern:"motorik23", solo:{model:"fuzz",wave:"saw",cutoff:2600,res:0.3,drive:0.15,level:0.5,voices:1,send:0.2,dsend:0.44,attack:.004,release:0.09,sustain:0.62,fenv:0.6,swellHz:.13,swellDepth:.6,swellPhase:.5}, octave:-1};
  // INSTRUMENT-LIBRARY: the transit form's "distorted heavy-metal solo" is the
  // REAL crunch_guitar (FreePats FSBS, CC0) rather than the fuzz synth.
  // The zone map is embedded here (solo recipes merge over instruments.melody in
  // soloVoices); the zone WAVs ride foundSources via the form==="transit" claim in
  // toState (ins_crunch_guitar_* at vol 0, like every sampler voice).
  const R_TW_METAL={model:"sampler",sampler:{id:"crunch_guitar",sr:SAMPLERS.crunch_guitar.sr,zones:SAMPLERS.crunch_guitar.zones.map((z,i)=>({srcId:"ins_crunch_guitar_"+i,root:z.root,lo:z.lo,hi:z.hi,loop:!!z.loop,loopStart:z.ls,loopEnd:z.le,len:z.len,sr:SAMPLERS.crunch_guitar.sr}))},wave:"saw",cutoff:3400,res:0.26,drive:0.7,level:0.62,voices:1,vibrato:.013,vibRate:5.5};
  const VOXPLAIN={sourceId:"vox"};        // ritual VO (no clean field)
  // The graphs. Node = [name, orderedSpec]. Key order in each spec is verbatim
  // from the retired literal so the emitted object's JSON is byte-identical.
  const FORMS={
    dj:[
      ["warmup",   {cycles:NN(2), drums:KIT, found:FND()}],
      ["build",    {cycles:NN(2), drums:KIT, bass:BASS, found:FND(), fill:FILL, sweep:"open"}],
      ["main",     {cycles:NN(2), drums:KIT, bass:BASS, pads:PADS, found:FND(), stab:STAB}],
      ["lift",     {cycles:NN(2), drums:KIT, bass:BASS, pads:PADS, melody:LEAD, fill:FILL, stab:STAB, hits:HIT}],
      ["breakdown",{cycles:NN(1), pads:true, melody:LEADSP, found:FND("bed"), hits:HIT, sweep:"close"}],
      ["rebuild",  {cycles:NN(1), drums:"kick", bass:BASS, pads:PADS, fill:FILL, sweep:SWEEP(0.6,"open")}],
      ["peak",     {cycles:NN(3), drums:KIT, bass:BASS, pads:PADS, melody:LEAD, found:FND(), stab:STAB, hits:HIT}],
      ["outro",    {cycles:NN(2), drums:KIT, bass:BASS, found:FND()}],
    ],
    drop:[
      // the impact lands ON each drop downbeat — folded in verbatim (the old
      // branch set fill:"riser" then overwrote secs[1]/secs[4].fill="impact")
      ["intro",  {cycles:NN(1), pads:PADS, found:FND()}],
      ["build",  {cycles:NN(1), drums:"kick", bass:BASS, pads:PADS, fill:"impact", sweep:"open"}],
      ["drop",   {cycles:NN(2), drums:KIT, bass:BASS, pads:PADS, melody:LEAD, stab:STAB, hits:HIT, found:FND()}],
      ["break",  {cycles:NN(1), pads:true, melody:LEADSP, found:FND("bed"), sweep:"close", hits:HIT}],
      ["build 2",{cycles:NN(1), drums:"kick", bass:BASS, fill:"impact", sweep:"open"}],
      ["drop 2", {cycles:NN(2), drums:KIT, bass:BASS, pads:PADS, melody:LEAD, stab:STAB, hits:HIT, found:FND()}],
      ["outro",  {cycles:NN(1), pads:PADS, found:FND()}],
    ],
    wave:[
      // c.counter (neoclassical counterpoint) rides the melody sections via
      // COUNTEROPT (omits the key when absent — the old conditional spread)
      ["arrive", {cycles:NN(1), pads:true, found:FND()}],
      ["drift",  {cycles:NN(2), pads:true, melody:LEAD, counter:COUNTEROPT, found:FND()}],
      ["swell",  {cycles:NN(2), pads:true, bass:BASS, melody:LEAD, counter:COUNTEROPT, drums:KIT, found:FND(), hits:HIT, sweep:"open"}],
      ["recede", {cycles:NN(2), pads:true, melody:LEADSP, found:FND(), sweep:"close"}],
      ["depart", {cycles:NN(1), pads:true, found:FND()}],
    ],
    ritual:[
      // planetarium dinosaur soundtrack: narrated, cinematic, SHORT. Fixed
      // cycles (no norm). creature solos each their own voice; glitched VO.
      ["dawn",   {cycles:1, pads:true, found:FND("bed"), vox:VOXPLAIN, sweep:"open"}],
      ["theme",  {cycles:2, drums:KIT, bass:BASS, pads:true, melody:LEAD, found:FND("bed")}],
      ["call",   {cycles:1, drums:KIT, bass:BASS, pads:true, melody:"roar",   solo:R_SAUROPOD, soloOctave:-1, found:FND("bed"), vox:VOXPLAIN}],
      ["answer", {cycles:1, drums:KIT, bass:BASS, pads:true, melody:"sparse", solo:R_RAPTOR,   soloOctave:0,  sweep:"close"}],
      ["shred",  {cycles:1, drums:KIT, bass:BASS, pads:true, melody:"hero",   solo:R_FUZZ,     found:FND("bed"), vox:VOXPLAIN, sweep:"open"}],
      ["finale", {cycles:2, drums:KIT, bass:BASS, pads:true, melody:LEAD, found:FND("bed"), vox:VOXPLAIN, sweep:"open"}],
    ],
    anthem:[
      // proud Canadian pop, ~3 min. Edge 16th arp lead (lead==="arp16"); one
      // grand brass swell owns the bridge; length fixed so it grafts on video.
      ["intro",    {cycles:1, pads:true, found:FND(), vox:VOXCLEAN, sweep:"open"}],
      ["verse",    {cycles:2, drums:KIT, bass:BASS, pads:true, melody:LEAD, found:FND(), hits:HIT, fill:"tom fill"}],
      ["chorus",   {cycles:2, drums:KIT, bass:BASS, pads:true, melody:LEAD, stab:STAB, found:FND()}],
      ["verse 2",  {cycles:1, drums:KIT, bass:BASS, pads:true, melody:LEAD, found:FND(), vox:POEM, fill:"tom fill"}],
      ["bridge",   {cycles:1, pads:true, bass:"root", melody:"off", counter:{pattern:"anthem", solo:R_SWELLBRASS, octave:0}, fill:"tom fill", sweep:"open", swell:true}],
      ["chorus 2", {cycles:2, drums:KIT, bass:BASS, pads:true, melody:LEAD, found:FND()}],
    ],
    transit:[
      // a commuter journey, video-locked. counter const shared by transit+express;
      // sung WORLD-vocoder chorus (vocal:true); distorted metal solo.
      ["platform",   {cycles:1, pads:true, found:FND("bed"), vox:VOXCLEAN, sweep:"open"}],
      ["board",      {cycles:2, drums:KIT, bass:BASS, pads:true, melody:LEAD, found:FND("bed"), vox:VOXCLEAN, fill:"tom fill"}],
      ["transit",    {cycles:2, drums:KIT, bass:BASS, pads:true, melody:LEAD, counter:R_TW_COUNTER, found:FND("bed"), stab:STAB, hits:HIT, fill:FILL}],
      ["chorus",     {cycles:1, drums:KIT, bass:BASS, pads:true, melody:LEAD, found:FND("bed"), vocal:true, fill:"riser"}],
      ["interchange",{cycles:1, pads:true, bass:"root", melody:"sparse", found:FND("bed"), vox:POEM, fill:"downlift", sweep:"close"}],
      ["solo",       {cycles:1, drums:KIT, bass:BASS, pads:true, melody:"blues", solo:R_TW_METAL, soloOctave:1, found:FND("bed"), fill:"impact", sweep:"open"}],
      ["express",    {cycles:2, drums:KIT, bass:BASS, pads:true, melody:LEAD, counter:R_TW_COUNTER, found:FND("bed"), vox:VOXCLEAN, hits:HIT, fill:"break fill", sweep:"open"}],
      ["terminus",   {cycles:2, drums:KIT, bass:BASS, pads:true, melody:LEAD, found:FND("bed"), vox:VOXCLEAN, fill:FILL}],
    ],
    pop:[
      ["intro",      {cycles:NN(1), pads:PADS, found:FND()}],
      ["verse",      {cycles:NN(1), pads:PADS, bass:BASS, drums:KIT, found:FND()}],
      ["pre-chorus", {cycles:NN(1), pads:PADS, bass:BASS, drums:KIT, fill:FILL, sweep:SWEEP(0.7,"open")}],
      ["chorus",     {cycles:NN(1), pads:PADS, bass:BASS, drums:KIT, melody:LEAD, stab:STAB, hits:HIT}],
      ["verse 2",    {cycles:NN(1), pads:PADS, bass:BASS, drums:KIT, found:FND()}],
      ["bridge",     {cycles:NN(1), pads:true, bass:BASS, melody:LEADSP, found:FND("bed"), fill:FILL, hits:HIT, sweep:SWEEP(0.5,"close")}],
      ["chorus 2",   {cycles:NN(1), pads:PADS, bass:BASS, drums:KIT, melody:LEAD, stab:STAB}],
      ["outro",      {cycles:NN(1), pads:PADS, found:FND()}],
    ],
    // ---- REPERTOIRE wave 3: six NEW ARCS — the deepest de-clone.
    // The census showed pop = 127/240: half the catalog walked one 8-node arc.
    // Each arc below is a genuinely different dramatic shape, authored in the
    // same Tok vocabulary and walked by the same buildForm walker. Section
    // names are chosen to classify correctly under csd-engine sectionTag
    // (ground/build/peak/release/exposed/cadence) — that grammar is how sample
    // roles, the GROW tie-break, and the drop lever read the node's energy.
    // FORM_ENTRY derives from these graphs automatically (the BLOOM design
    // floor); none are in NO_AUTO_FORM (they take the 180s target) and none
    // join the evolution form-pivot pool (their shape IS the identity).
    aaba:[
      // the 32-bar song form: A A B A with a REAL bridge (the B keeps time —
      // jazz bridges don't drop the band — but strips the lead to sparse over
      // a bed). SOLO_IDIOM genres (jazz/bebop) splice their solo before
      // "head 3": head -> bridge -> SOLO -> head out. tags: ground/build x2/
      // exposed/build/cadence.
      ["head",   {cycles:NN(1), drums:KIT, bass:BASS, pads:PADS, melody:LEAD, found:FND()}],
      ["head 2", {cycles:NN(1), drums:KIT, bass:BASS, pads:PADS, melody:LEAD, hits:HIT, fill:FILL}],
      ["bridge", {cycles:NN(1), drums:KIT, bass:BASS, pads:true, melody:LEADSP, found:FND("bed"), fill:FILL}],
      ["head 3", {cycles:NN(1), drums:KIT, bass:BASS, pads:PADS, melody:LEAD, stab:STAB, hits:HIT}],
      ["coda",   {cycles:NN(1), pads:PADS, bass:BASS, found:FND()}],
    ],
    vamp:[
      // the funk/afrobeat shape: ONE long groove plateau — layers add in, a
      // rhythm-section breakdown, layers out. Drums in EVERY node (the groove
      // never stops — that's the form); no ground opener (funk opens cold on
      // the one). SOLO_IDIOM (funk) splices before "layer out".
      ["groove",    {cycles:NN(1), drums:KIT, bass:BASS, found:FND()}],
      ["layer in",  {cycles:NN(1), drums:KIT, bass:BASS, pads:PADS, stab:STAB, found:FND()}],
      ["cook",      {cycles:NN(2), drums:KIT, bass:BASS, pads:PADS, melody:LEAD, stab:STAB, hits:HIT, fill:FILL}],
      ["peak vamp", {cycles:NN(2), drums:KIT, bass:BASS, pads:PADS, melody:LEAD, stab:STAB, hits:HIT, found:FND()}],
      ["breakdown", {cycles:NN(1), drums:KIT, bass:BASS, found:FND("bed"), hits:HIT}],
      ["layer out", {cycles:NN(1), drums:KIT, bass:BASS, pads:PADS, melody:LEADSP, found:FND()}],
      ["outro",     {cycles:NN(1), drums:KIT, bass:BASS, found:FND()}],
    ],
    storm:[
      // the doom/post-rock shape: a slow gathering, one huge peak, then a LONG
      // decay — the release ("long recede") is as long as the climb was.
      ["dawn",        {cycles:NN(1), pads:true, found:FND("bed")}],
      ["gather",      {cycles:NN(2), pads:true, bass:BASS, melody:LEADSP, found:FND("bed")}],
      ["rise",        {cycles:NN(2), drums:KIT, bass:BASS, pads:true, melody:LEADSP, found:FND(), fill:FILL}],
      ["surge",       {cycles:NN(1), drums:KIT, bass:BASS, pads:PADS, melody:LEAD, fill:FILL, sweep:SWEEP(0.5,"open")}],
      ["peak storm",  {cycles:NN(2), drums:KIT, bass:BASS, pads:true, melody:LEAD, stab:STAB, hits:HIT, found:FND()}],
      ["long recede", {cycles:NN(2), pads:true, bass:BASS, melody:LEADSP, found:FND("bed"), sweep:"close"}],
      ["outro",       {cycles:NN(1), pads:true, found:FND("bed")}],
    ],
    throughline:[
      // through-composed: NO repeated section — a continuous build with a dark
      // turn (keyShift -3) and a two-step ascent (+2) it never walks back.
      // Section keyShift literals ride the same csd-engine transpose the
      // 3-minute rule uses (an evolution on a long journey leg may overwrite
      // them — accepted; at the 180s default no evolution fires).
      ["arrive",     {cycles:NN(1), pads:true, found:FND()}],
      ["unfold",     {cycles:NN(1), pads:true, bass:BASS, melody:LEADSP, found:FND()}],
      ["deepen",     {cycles:NN(1), pads:true, bass:BASS, melody:LEAD, drums:KIT, found:FND()}],
      ["turn",       {cycles:NN(1), drums:KIT, bass:BASS, pads:PADS, melody:LEAD, hits:HIT, fill:FILL, keyShift:-3}],
      ["ascend",     {cycles:NN(1), drums:KIT, bass:BASS, pads:PADS, melody:LEAD, stab:STAB, fill:FILL, keyShift:2, sweep:SWEEP(0.5,"open")}],
      ["high swell", {cycles:NN(2), drums:KIT, bass:BASS, pads:true, melody:LEAD, stab:STAB, hits:HIT, found:FND(), keyShift:2}],
      ["depart",     {cycles:NN(1), pads:true, melody:LEADSP, found:FND("bed"), keyShift:2}],
    ],
    duet:[
      // call-and-response alternation: lead-forward "call" nodes (peak) trade
      // with pad-forward "answer" nodes (release), then both sing at once.
      ["intro",      {cycles:NN(1), pads:true, found:FND()}],
      ["call",       {cycles:NN(1), drums:KIT, bass:BASS, melody:LEAD, found:FND()}],
      ["answer",     {cycles:NN(1), drums:KIT, bass:BASS, pads:true, melody:LEADSP, found:FND("bed"), hits:HIT}],
      ["call 2",     {cycles:NN(1), drums:KIT, bass:BASS, melody:LEAD, stab:STAB, fill:FILL}],
      ["answer 2",   {cycles:NN(1), drums:KIT, bass:BASS, pads:true, melody:LEADSP, found:FND("bed"), hits:HIT, fill:FILL}],
      ["duet swell", {cycles:NN(2), drums:KIT, bass:BASS, pads:PADS, melody:LEAD, stab:STAB, hits:HIT, found:FND()}],
      ["outro",      {cycles:NN(1), pads:true, found:FND()}],
    ],
    suite:[
      // three contrasting movements: a full first, a stripped dark second
      // (kick pulse, keyShift -3), a driving third resolved UP (+2) into the
      // finale. "bridge interlude" (exposed) is the palate cleanse between
      // movements; names classify build/build/build so the grammar reads the
      // movements as the groove they are (never "movement ii" -> misclass).
      ["arrive",           {cycles:NN(1), pads:true, found:FND()}],
      ["first movement",   {cycles:NN(2), drums:KIT, bass:BASS, pads:PADS, melody:LEAD, found:FND()}],
      ["bridge interlude", {cycles:NN(1), pads:true, bass:BASS, melody:LEADSP, found:FND("bed"), fill:FILL}],
      ["second movement",  {cycles:NN(2), drums:"kick", bass:BASS, pads:true, melody:LEADSP, found:FND("bed"), keyShift:-3}],
      ["third movement",   {cycles:NN(2), drums:KIT, bass:BASS, pads:PADS, melody:LEAD, stab:STAB, hits:HIT, fill:FILL, keyShift:2}],
      ["finale",           {cycles:NN(1), drums:KIT, bass:BASS, pads:true, melody:LEAD, found:FND(), hits:HIT, keyShift:2}],
    ],
  };
  // FORM_ENTRY (MUSICALITY balance loop 2): each form's DESIGNED entry point
  // per part, as a fraction of the arc's base cycles — derived from the graphs
  // above, so it can never drift from them. The musicality BLOOM law reads
  // this as its on-design floor: a part that arrives within ONE CYCLE of
  // designFraction x totalBeats is exactly where the arc placed it — the form
  // is the genre's identity, and cycle quantization (the solver rounds to
  // whole cycles) can push a realized arrival up to a cycle past the exact
  // fraction. The absolute per-form beat tables in musicality.js remain the
  // patience cap for drag the form never asked for; this floor only clears
  // the fast/long-cycle geometry outliers that are ON design (standbylight-
  // drive's swell at 38.5% of a 137bpm wave = beat 160; singeli's lift at
  // 42.9% of a 214bpm dj set; walrusfuzz's chorus at exactly 3/8 of a floored
  // 96-beat-cycle blues — all measured, all the graph's own proportions).
  // A key counts as the design's entry even when it holds a token — tokens
  // resolve per track (KIT may be "off"), but the NODE is where the form
  // FIRST OFFERS the part; parts that resolve off everywhere are simply not
  // declared and never measured.
  const FORM_ENTRY=(()=>{
    const DECL={ drums:(s)=>s.drums!=null&&s.drums!=="off", bass:(s)=>s.bass!=null,
                 melody:(s)=>s.melody!=null&&s.melody!=="off", pads:(s)=>s.pads!=null&&s.pads!==false,
                 found:(s)=>s.found!=null, counter:(s)=>s.counter!=null };
    const cyc=(v)=>(v instanceof Tok&&v.t==="n")?v.a:(typeof v==="number"?v:1);
    const out={};
    for(const [form,nodes] of Object.entries(FORMS)){
      const total=nodes.reduce((n,[,spec])=>n+cyc(spec.cycles),0);
      const entry={};
      for(const part of Object.keys(DECL)){
        let before=0, found=false;
        for(const [,spec] of nodes){ if(DECL[part](spec)){ found=true; break; } before+=cyc(spec.cycles); }
        if(found) entry[part]=before/total;
      }
      out[form]=entry;
    }
    return out;
  })();

  // The one generic walker. ctx carries the per-track resolvers (norm/kit/
  // lead/bass and the drawing F()). Tokens resolve in key-insertion order so
  // the only draw-bearing tokens (FILL/SWEEP) fire in exactly source order;
  // literals deep-clone so a module-level graph template is never shared into
  // (or mutated through) an emitted section — matching the old branch which
  // built fresh objects each call.
  function buildForm(form, c, ctx){
    const nodes=FORMS[form]||FORMS.pop;
    const cloneLit=(v)=>(v&&typeof v==="object")?JSON.parse(JSON.stringify(v)):v;
    const resolveVal=(v)=>{
      if(v instanceof Tok){
        switch(v.t){
          case "n": return v.a*ctx.norm;
          case "kit": return ctx.kit;
          case "lead": return ctx.lead;
          case "leadSparse": return ctx.lead==="off"?"off":"sparse";
          case "bass": return ctx.bass;
          case "pads": return c.padsOn;
          case "stab": return c.stab;
          case "hit": return ctx.hit();
          case "fnd": return ctx.fnd(v.a);
          case "fill": return ctx.F();                       // DRAWS
          case "sweep": return c.rng()<v.a.p?v.a.on:"off";   // DRAWS
          case "counterOpt": return (c.counter&&ctx.lead!=="off")?cloneLit(c.counter):OMIT;
          case "voxClean": return {sourceId:"vox", clean:c.voxClean};
          case "poem": return {sourceId:"poem", clean:false};
        }
      }
      return cloneLit(v);
    };
    return nodes.map(([name,spec])=>{
      const o={};
      for(const k of Object.keys(spec)){          // insertion order = source order
        const r=resolveVal(spec[k]);
        if(r!==OMIT) o[k]=r;
      }
      return S(name,o);
    });
  }

  function buildSections(c, opts){
    _gid=0;   // KERNEL-V4 determinism fix ): section ids are PER-TRACK (g1..gN), reset each build so they never depend on how many genres were resolved earlier in the same process. The old global counter made a track's section `id` labels a function of resolution ORDER — so changing one genre's section COUNT silently renumbered every genre declared after it (a Phase-0 fixture false-positive: state hash drift with byte-identical events+features). Section .id is consumed only by order (live/press iterate; no cross-track id key — journeys keep per-track section arrays), so per-track g1.. is safe and makes the fixture state-hash order-independent.
    const cycleBeats=E.getProgression(c.progression).chords.length*(c.chordEvery||8);
    const norm=Math.max(1,Math.round(32/cycleBeats));
    const F=()=>pick(c.rng,c.fills);
    const fnd=(role)=>({sourceId:"src",role:role||c.foundRole});
    const hit=()=>c.hits?{sourceId:"hit",pattern:c.hits.pattern}:undefined;
    const lead=c.leadPattern, bass=c.bassPattern, kit=c.kit==="off"?"off":c.kit;
    // The seven-branch if/else chain is now the FORMS graph (module scope,
    // above) walked by buildForm — byte-identical, verified at zero fixture
    // drift. ctx carries the per-track resolvers the tokens read.
    const form=FORMS[c.form]?c.form:"pop";
    let secs=buildForm(form, c, {norm, kit, lead, bass, F, fnd, hit});
    // ---- OPTIONAL INTRO ----
    // A four-bar intro almost everywhere is a tic, so it is optional per
    // genre. c.introMode is a zero-rng, dominant-parent anchor dimension:
    //   "full"  (or absent) — current behavior, byte-identical
    //   "off"   — drop the leading ground node entirely (open cold on the groove)
    //   "short" — keep the intro but floor it to a single cycle (a quick breath)
    // Only the FIRST node, and only when it is a `ground`-tagged opener (so a
    // bespoke non-ground opener is never silently dropped), is affected. No rng
    // is consumed, so every downstream draw (duration solver is rng-free; the
    // evolution + fills passes) is untouched for the sections that remain — a
    // genre that keeps its intro is bit-for-bit identical. Dropping a section
    // DOES move the duration/role() math; pilots are matrix-gated, see report.
    let coldOpen=false;
    if(c.introMode && c.introMode!=="full" && secs.length>1){
      const first=secs[0];
      if(E.sectionTag(first.name)==="ground"){
        if(c.introMode==="off"){ secs.shift(); coldOpen=true; }   // the ground drop ACTUALLY happened — the track opens cold
        else if(c.introMode==="short") first.cycles=1;
      }
    }
    // ---- SOLO ): idiomatic genres get an improvised solo section ----
    // A CsdTheory-driven line over the changes (csd-engine melodyEvents "solo"),
    // backing ducked (soloDuck lowers the comp), spliced before the final head so
    // the arc reads head -> SOLO -> head. Opt-in by the per-genre SOLO_IDIOM map;
    // the genre's OWN lead voice takes it (the sax that comps also solos). Injected
    // BEFORE the duration solver so it's balanced into the ±10% length target, and
    // the drop pass exempts a melody:"solo" section (it IS the identity here). The
    // 3-minute evolution reshape can still shed it on a floored genre (blues) — an
    // accepted edge, its call-response "blues" lead already solos. Matrix-gated: a
    // new dense-melody section moves the melody/motion features on purpose.
    const SOLO_IDIOM={ bebop:"bop", jazz:"bop", blues:"blues", funk:"funk", bluegrass:"roll" };
    const soloIdiom=SOLO_IDIOM[(c.genres&&c.genres[0])];
    if(soloIdiom && secs.length>=3){
      const at=Math.max(1, secs.length-2);   // before the final head + outro
      secs.splice(at, 0, S("solo", { cycles:1, drums:kit, bass:bass, pads:true, melody:"solo", soloIdiom, soloDuck:true, fill:"off" }));
      // NO MASTER SWEEPS in an acoustic combo — a huge filter sweep arriving
      // mid-bebop is absurd. The pop form's pre-chorus open sweep
      // (260->18k over a whole section) is an EDM gesture with no place in a
      // jazz/blues/funk/bluegrass room. Stripped AFTER token resolution, so the
      // SWEEP draw already happened — rng order untouched, all other genres
      // byte-identical.
      for(const s of secs) if(s.sweep && s.sweep!=="off") s.sweep="off";
    }
    // ---- duration SOLVER (KERNEL-V4 Phase 5, §3.5) ----
    // Land the track within ±10% of opts.targetSec. track()/blend()/mix()
    // default targetSec to 180 (the 3-minute rule); journeys pass a per-leg
    // targetSec. The solver adjusts section CYCLE counts ONLY — never the
    // section COUNT — so every symbolic feature (all densities/ratios and the
    // role() section fractions the verifier reads) is length-invariant and the
    // confusion matrix is untouched; only the state/events byte-hashes move.
    // Fully deterministic (no rng): a proportional pre-scale by kk, then a
    // shape-preserving residual correction (each ±1-cycle nudge lands on the
    // section furthest from its proportional ideal share) until in-band or the
    // 1-cycle floor is hit — so it always terminates. When one cycle is a
    // coarse fraction of the target (blues' 12-bar bars, the
    // prelude's long figuration, dubwise lengths) the best landing can still be
    // outside ±10%; the solver never DROPS a section to force it (that would
    // move role() features), and the 3-minute evolution pass below still
    // guarantees such tracks EVOLVE rather than drone. Runs before that pass so
    // it sees final durations. Bespoke video-locked forms (ritual/anthem/
    // transit) are exempted from the DEFAULT target upstream (track()); an
    // explicit journey targetSec still scales them, as before.
    if(opts&&opts.targetSec>0){
      const spb=60/c.bpm, tail=8*spb, target=opts.targetSec;
      const dur=()=>secs.reduce((n,s)=>n+s.cycles*cycleBeats,0)*spb+tail;
      const nat=dur();
      if(nat<target*0.9||nat>target*1.1){
        // Proportional pre-scale, then a SHAPE-PRESERVING residual correction:
        // each ±1 nudge lands on the section furthest from its proportional
        // ideal share, so the form's cycle proportions are preserved and every
        // density feature (drumDensity/hatDensity/offgrid — all per-total-beat)
        // moves uniformly with length instead of being skewed by a lopsided
        // section. (An early local-search-on-biggest ballooned no-drum intros
        // and diluted the drum densities — flipping industrialmetal's razor
        // margin vs darksynth. This keeps every symbolic feature stable.)
        const kk=Math.max(0.05,(target-tail)/Math.max(spb,nat-tail));
        const ideal=secs.map(s=>Math.max(1,s.cycles*kk));
        secs.forEach((s,i)=>{ s.cycles=Math.max(1,Math.round(ideal[i])); });
        // MUSICALITY balance loop 1 ): the grow tie-break is ENERGY-
        // AWARE. The old first-index tie-break stacked ALL residual growth at
        // the FRONT of the form (intro 2, verse 2, pre-chorus 2 — MEASURED:
        // dancepop's hook pushed from the form's designed 37.5% to 54% of the
        // track; the whole worst-10 bloom wall was this one line). Growth
        // still lands on the section furthest below its proportional share
        // (shape preserved), but exact TIES now resolve by node energy —
        // peak > build > exposed/release > cadence > ground — so a longer
        // track means MORE PAYOFF, not a longer drumless intro. Zero rng;
        // deterministic; fixtures re-captured for the genres whose growth
        // pattern moved (matrix-gated 228/228).
        // Balance loop 2: ties WITHIN an energy class resolve by LATER index.
        // Loop 1's rank left the first-index bias alive inside the class —
        // pre-chorus and chorus are both `peak`, so the residual cycle landed
        // on the PRE-chorus and pushed the first hook past the bloom bound
        // (toastercore: chorus 192 -> 224, MEASURED; the dancepop bug one
        // level down). Growth is anticipation when it lands before the hook
        // and payoff when it lands after — equal share, equal energy, grow
        // the LATER node.
        const GROW_PRI={peak:0,build:1,exposed:2,release:2,cadence:3,ground:4};
        const priOf=(s)=>GROW_PRI[s.tag||E.sectionTag(s.name)];
        for(let guard=0; guard<4000; guard++){
          const e=dur()-target;
          if(Math.abs(e)<=target*0.1) break;
          if(e<0){                                   // too short: grow the section furthest BELOW its proportional share
            let bi=0,bd=1/0,bp=1/0; for(let i=0;i<secs.length;i++){ const d=secs[i].cycles-ideal[i], p=priOf(secs[i]);
              if(d<bd-1e-9 || (d<bd+1e-9 && p<=bp)){bd=d;bi=i;bp=p;} }
            secs[bi].cycles++;
          } else {                                   // too long: shrink the section furthest ABOVE its share (with room)
            let bi=-1,bd=-1/0; for(let i=0;i<secs.length;i++){ if(secs[i].cycles<=1) continue; const d=secs[i].cycles-ideal[i]; if(d>bd){bd=d;bi=i;} }
            if(bi<0) break;                          // floored: every section at 1 cycle (blues/mallsoft/prelude — reported)
            secs[bi].cycles--;
          }
        }
      }
      // ---- SECTION-DROP lever (KERNEL-V4 Phase 5's DEFERRED duration lever) ----
      // When the cycle solver above FLOORS over-band (every section already at
      // 1 cycle, still > target*1.1 because one cycle is a coarse fraction of
      // the target), the remaining lever is to DROP optional low-energy nodes.
      // Rules (the charter's constraints, why this was deferred):
      //  • never a hook: only ground/cadence/release/exposed tags are droppable
      //    — build (the groove/verse) and peak (chorus/drop/lift/pre-chorus) stay;
      //  • SURGICAL: greedily drop the highest-priority droppable node whose
      //    removal keeps dur >= target*0.9, and COMMIT only if the result lands
      //    in [target*0.9, target*1.1]. If no drop sequence lands it (cycles too
      //    coarse — blues' 96-beat 12-bar, prelude's chordEvery:16 64-128-beat
      //    cycles, newage's + chinawave's 64-beat canon), REVERT untouched: those
      //    stay byte-identical and genuinely floored (documented). So the lever
      //    only ever fires where it can actually land a genre in-band — bounding
      //    the blast radius to the listed genres and keeping every un-landable
      //    floored genre stable.
      //    DISPOSITION for the remaining floored seeds: leave them floored,
      //    documented. The last seeds the drop lever can't land, all measured:
      //    chinawave s5 (canon cb=64, slow bpm 98, 7-section form -> 318s; drop
      //    lands only 201s, 3s over the ceiling), newage s1 (canon cb=64 -> 262s;
      //    reachable drops are 262/211/160 — the band [162,198] falls in the
      //    64-beat GAP), prelude s2 (dream cb=64 -> 252s, same gap) and prelude s3
      //    (canon cb=128 -> 512s; one cycle is 56% of target — structurally
      //    un-landable). A shorter pool member EXISTS for each (four_chords/dream/
      //    ii_v_i) and a deterministic post-resolve swap WOULD land them at self
      //    100 — but that (1) trades the deliberate long-figuration identity
      //    (canon IS long — Pachelbel at tempo; the prelude's chordEvery:16 is its
      //    whole figuration) and (2) shifts the motion/seventh/variation features
      //    of THREE matrix seeds (newage s1, prelude s2/s3), disturbing the 63/63
      //    confusion matrix. Per "identity beats the 180s rule", they stay
      //    floored; the 3-minute evolution pass below still guarantees they EVOLVE
      //    (modulate/re-roll/pivot) rather than drone. (blues stays floored too —
      //    settled: the 12-bar form is 96-beat-coarse and the deep pass is fixed.)
      //  • zero rng; runs before the evolution pass so it sees final durations.
      // Dropping a node moves role()/bedUse + the density features (a bed intro/
      // outro/breakdown leaves the mix), so every genre it fires on is matrix-
      // gated (63/63 diagonal-dominant held) and its fixtures regenerated/listed.
      //
      // NO_SECTION_DROP — genres whose IDENTITY lives in the droppable node.
      // witchhouse: its whole genre is the cathedral-of-reverb
      // DRONE — the low-motion "exposed" bridge (pads/leadSparse/found-bed, no
      // moving lead) is where that drone lives. On seed 2 the floored track ran
      // over-band and the lever dropped that bridge, which yanked the rendered
      // motion up to .67 (the surrounding verse/chorus move) — landing witchhouse
      // squarely in the wash-cluster (wintersynth scored 100, vaporwave/downtempo
      // 99, self 99: a lost quick-gate seed, latent since d4b1671). MEASURED:
      // keeping the bridge holds motion inside witchhouse's own drone home and
      // its self-diagonal, at the cost of that one seed running ~long (a floored
      // outcome, like blues/prelude — identity beats the 180s rule). Dominant-
      // genre gated (blends inherit the exemption only while witchhouse leads),
      // matrix-gated (63/63 held), fixtures for the moved seeds re-blessed.
      const dropExempt=NO_SECTION_DROP.has(c.genres&&c.genres[0]);
      if(!dropExempt && dur()>target*1.1){
        const DROP_TAGS=["release","exposed","ground","cadence"];   // priority; never build/peak
        const tagOf=(s)=>s.tag||E.sectionTag(s.name);
        const secSec=(s)=>s.cycles*cycleBeats*spb;
        let trial=secs.slice();                                     // section objects are shared, but we only splice (never mutate) the trial
        const tdur=()=>trial.reduce((n,s)=>n+s.cycles*cycleBeats,0)*spb+tail;
        let changed=false;
        for(let guard=0; guard<trial.length && tdur()>target*1.1; guard++){
          let idx=-1;
          for(const tag of DROP_TAGS){
            for(let i=0;i<trial.length;i++){
              if(tagOf(trial[i])!==tag) continue;
              if(trial[i].melody==="solo") continue;                     // the improvised solo IS the identity here — never drop it (cf. witchhouse's drone bridge)
              if(tdur()-secSec(trial[i])>=target*0.9){ idx=i; break; }   // removal keeps us above the floor
            }
            if(idx>=0) break;
          }
          if(idx<0) break;                                          // no safe drop
          trial.splice(idx,1); changed=true;
        }
        if(changed && tdur()>=target*0.9 && tdur()<=target*1.1){    // landed -> commit; else leave floored (byte-identical)
          secs.length=0; Array.prototype.push.apply(secs, trial);
        }
      }
    }
    // introMode:"short" pin — the proportional solver above would otherwise
    // regrow a shortened intro back to its share, so clamp the ground intro to
    // one cycle AFTER solving (the track lands a bar or two under target — a
    // punchy short opener). "off" needs no pin: a dropped section can't regrow.
    // No rng; only fires for a genre that opted in, so all others byte-stable.
    if(c.introMode==="short" && secs.length>1 && E.sectionTag(secs[0].name)==="ground") secs[0].cycles=1;
    // ---- THE 3-MINUTE RULE ----
    // Nothing runs past ~2:40-3:00 without EVOLVING: at the first section
    // boundary where the unevolved stretch would pass ~175s the track either
    // (a) MODULATES — sec.keyShift walks +2/-3/+5 semitones (cumulative; the
    //     whole band transposes, samplers included — csd-engine pitch math),
    // (b) RE-ROLLS — remaining sections draw a fresh kit + lead pattern from
    //     the anchor's own pools (the "becomes a new kind of song" feel), or
    // (c) FORM-PIVOTS — remaining sections are redrawn from a DIFFERENT form
    //     (dj/pop/drop/wave only; once per track).
    // Sections that alone outstay the rule (long dj plateaus at --hours
    // durations) are split at cycle boundaries first, so every long track
    // has boundaries to evolve at. All seeded from c.seed; the audit is
    // `node scratchpad/audit.js evolve` (zero tracks >180s unevolved).
    const evolutions=[];
    {
      const spb=60/c.bpm, LIMIT=175;
      const secDur=(s)=>(s.cycles||1)*cycleBeats*spb;
      let eh=0xE0071; for(const ch of (c.genres&&c.genres[0])||"") eh=Math.imul(eh^ch.charCodeAt(0),2654435761);
      const erng=mulberry32((((c.seed??1)>>>0)^eh)>>>0);   // seed x genre: same seed evolves differently per genre
      const A=GENRES[c.genres[0]]||{};
      const KEYWALK=[2,-3,5];
      let acc=0, abs=0, shift=0, pivoted=false;
      for(let i=0;i<secs.length;i++){
        while(secDur(secs[i])>LIMIT&&(secs[i].cycles||1)>1){   // split the plateau
          const maxCyc=Math.max(1,Math.floor(LIMIT/(cycleBeats*spb)));
          const first=Math.max(1,Math.min(maxCyc,Math.ceil(secs[i].cycles/2)));
          const rest=secs[i].cycles-first;
          if(rest<1) break;
          const clone=JSON.parse(JSON.stringify(secs[i]));
          clone.id=gid(); clone.cycles=rest; clone.name=secs[i].name+" ›";
          secs[i].cycles=first; secs[i].fill="off";            // the seam gets an auto transition
          secs.splice(i+1,0,clone);
        }
        if(shift) secs[i].keyShift=shift;
        acc+=secDur(secs[i]); abs+=secDur(secs[i]);
        if(i>=secs.length-1) break;
        if(acc+Math.min(secDur(secs[i+1]),LIMIT)<=LIMIT) continue;
        // EVOLVE at this boundary
        const canKey=!secs.slice(i+1).some(s=>s.vocal);        // the sung chorus can't transpose
        const kits=(A.kits||[]).filter(x=>x&&x!=="off"&&x!==c.kit);
        const leads=((A.lead&&A.lead.patterns)||[]).filter(p=>p&&p!=="off"&&p!==c.leadPattern);
        const canReroll=(c.kit!=="off"&&kits.length>0)||leads.length>0;
        const canPivot=!pivoted&&["dj","pop","drop","wave"].includes(c.form)&&i<secs.length-2;
        const pool2=[]; if(canKey)pool2.push("key","key"); if(canReroll)pool2.push("reroll","reroll"); if(canPivot)pool2.push("pivot");
        const kind=pool2.length?pool2[Math.floor(erng()*pool2.length)]:"key";
        let detail="";
        if(kind==="key"){
          shift+=KEYWALK[Math.floor(erng()*KEYWALK.length)];
          detail="keyShift "+(shift>=0?"+":"")+shift;
        } else if(kind==="reroll"){
          const newKit=kits.length?kits[Math.floor(erng()*kits.length)]:c.kit;
          const newLead=leads.length?leads[Math.floor(erng()*leads.length)]:c.leadPattern;
          for(let j=i+1;j<secs.length;j++){
            const s=secs[j];
            if(s.drums&&s.drums!=="off"&&s.drums!=="kick") s.drums=newKit;
            if(s.melody===c.leadPattern) s.melody=newLead;
          }
          detail=newKit+"/"+newLead;
        } else {   // form pivot: redraw the rest of the track from another form
          const R=secs.slice(i+1).reduce((s,x)=>s+(x.cycles||1),0);
          // never pivot INTO wave: its beatless drift sections would gut a
          // groove genre's kit identity for the rest of the track (afrobeat
          // pivoting to wave lost its own hat-density diagonal)
          const forms2=["dj","pop","drop"].filter(f=>f!==c.form);
          const f2=forms2[Math.floor(erng()*forms2.length)];
          let mk={
            dj:  ()=>[S("plateau",{drums:kit,bass,pads:c.padsOn,found:fnd()}),
                      S("lift²",{drums:kit,bass,pads:c.padsOn,melody:lead,stab:c.stab,hits:hit()}),
                      S("peak²",{drums:kit,bass,pads:c.padsOn,melody:lead,found:fnd(),stab:c.stab})],
            pop: ()=>[S("verse²",{pads:c.padsOn,bass,drums:kit,found:fnd()}),
                      S("chorus²",{pads:c.padsOn,bass,drums:kit,melody:lead,stab:c.stab,hits:hit()}),
                      S("coda",{pads:true,bass,drums:kit,found:fnd()})],   // the coda keeps the groove — density identity survives the pivot
            drop:()=>[S("build²",{drums:"kick",bass,pads:c.padsOn,fill:"riser"}),
                      S("drop²",{drums:kit,bass,pads:c.padsOn,melody:lead,stab:c.stab,hits:hit(),found:fnd()}),
                      S("coda",{pads:c.padsOn,bass,drums:kit,found:fnd()})],
            wave:()=>[S("swell²",{pads:true,bass,melody:lead,drums:kit,found:fnd()}),
                      S("recede²",{pads:true,melody:lead==="off"?"off":"sparse",found:fnd()})],
          }[f2]();
          if(R<mk.length) mk=mk.slice(0,Math.max(1,R));
          const base=Math.max(1,Math.floor(R/mk.length));
          mk.forEach(s=>s.cycles=base);
          mk[mk.length-1].cycles=Math.max(1,R-base*(mk.length-1));
          if(shift) mk.forEach(s=>s.keyShift=shift);
          secs.splice(i+1,secs.length-(i+1),...mk);
          pivoted=true; detail="-> "+f2;
        }
        secs[i].evolveInto=true;                               // the auto pass treats this as a major boundary
        evolutions.push({at:i+1, tSec:Math.round(abs), kind, detail});
        acc=0;
      }
    }
    // ---- automated fills + transitions ----
    // Every MAJOR boundary (into a chorus/drop/peak/lift, out of a
    // breakdown/break, or into an evolution) transitions, without fail; minor
    // boundaries get one ~60% of the time. The
    // vocabulary is weighted — the micro lick (a tiny sax/trombone/piano
    // pickup) and the kit's own mini-fill carry the weight, the genre's
    // curated percussive fills follow, and the sweep family (riser/sweep/
    // downlift/noise/reverse/impact) is rationed down to spice (census gate:
    // sweep and riser each <=15% of auto picks — the loud noise build was
    // "very loud, very disruptive, overused"). Seeded variety: no two
    // consecutive assigned boundaries reuse a type; explicit per-form fills
    // stand and count toward the repeat guard. Auto picks are marked
    // s.autoFill for the census (scratchpad audit.js census).
    {
      const MAJOR_NEXT=/chorus|drop|peak|lift/, MAJOR_FROM=/breakdown|^break/;
      const SWEEPY=new Set(["riser","sweep","downlift","noise","reverse","impact"]);
      const wpool=[];
      const add=(f,w)=>{ if(f&&f!=="off"&&!wpool.some(x=>x.f===f)) wpool.push({f,w}); };
      if(c.lick) add("micro lick",3);
      if(c.kit&&c.kit!=="off") add("kit fill",2);
      for(const f of c.fills) add(f, SWEEPY.has(f)?0.5:2);
      add("riser",0.35); add("downlift",0.35);
      const draw=(excl)=>{
        const av=wpool.filter(x=>x.f!==excl), P=av.length?av:wpool;
        const tot=P.reduce((s,x)=>s+x.w,0);
        let r=c.rng()*tot;
        for(const x of P){ if((r-=x.w)<=0) return x.f; }
        return P[P.length-1].f;
      };
      let lastFill=null;
      for(let i=0;i<secs.length-1;i++){
        const s=secs[i];
        if(s.fill&&s.fill!=="off"){ lastFill=s.fill; continue; }
        const major=MAJOR_NEXT.test(secs[i+1].name)||MAJOR_FROM.test(s.name)||s.evolveInto;
        if(major || c.rng()<0.6){
          s.fill=draw(lastFill);
          s.autoFill=true;
          lastFill=s.fill;
        }
      }
    }
    return {secs, cycleBeats, evolutions, coldOpen};
  }

  // ---------- MACROS: eight global slider axes (the keyOffset altitude) --------
  // opts.macros = {acoustic, density, dust, space, bright, feel, energy, vocal},
  // each a slider in [-1,+1] with 0 = neutral. A POST-RESOLUTION transform: it
  // scales/biases the ALREADY-resolved choice `c` deterministically, drawing
  // ZERO rng (macros never pick — they only push resolved values toward an
  // extreme). Absent macros, or an all-neutral bundle, is a strict NO-OP, so
  // states are byte-identical to the macro-less path (fixtures.js gate). Same
  // seed + same slider positions => same bytes. Applied in place on the fresh
  // per-call choice (track/blend/mix/journey each resolve a new one); it runs
  // before buildSections so bpm/section geometry pick up the energy nudge.
  //   axis            -1 pole          +1 pole      (slider label order = sign)
  //   acoustic        acoustic     <-> synthesized
  //   density         simple       <-> layered
  //   dust            dusty        <-> clean
  //   space           dry          <-> drenched
  //   bright          dark         <-> bright
  //   feel            tight        <-> loose
  //   energy          calm         <-> intense
  //   vocal           instrumental <-> vocal
  const AC_LEAD={supersaw:"rhodes",stack:"rhodes",saw:"rhodes",fm:"rhodes",juno60:"rhodes",
    solina:"rhodes",oberheim:"rhodes",ppg:"rhodes",casiocz:"rhodes",vp330:"rhodes",
    reese:"guitar",synclead:"guitar",acid:"guitar",wobble:"guitar"};
  const AC_PAD={pad_saw:"strings",saw:"strings",stack:"strings",juno60:"strings",solina:"strings",
    oberheim:"strings",ppg:"strings",vp330:"choir",fm:"strings",casiocz:"strings"};
  const SY_LEAD={piano:"supersaw",rhodes:"supersaw",organ:"supersaw",guitar:"supersaw",
    bell:"supersaw",brass:"supersaw",strings:"supersaw",choir:"supersaw",hammond:"supersaw"};
  const SY_PAD={piano:"saw",strings:"saw",organ:"saw",choir:"saw",bell:"saw",hammond:"saw",rhodes:"saw"};
  function applyMacros(c, M){
    if(!M) return;
    const clamp=(x,lo,hi)=>x<lo?lo:x>hi?hi:x, pos=v=>v>0?v:0, neg=v=>v<0?-v:0, scl=(v,s)=>v*(1+s);
    const A=+M.acoustic||0, D=+M.density||0, U=+M.dust||0, SP=+M.space||0,
          BR=+M.bright||0, FE=+M.feel||0, EN=+M.energy||0, VO=+M.vocal||0;
    if(!(A||D||U||SP||BR||FE||EN||VO)) return;   // all-neutral -> byte-identical no-op
    const fx=c.fx, dr=c.drumRecipe;
    // -- acoustic <-> synthesized: timbre proxies + curated model swaps at the
    //    extremes. Range-limited: a genre already on the target family barely
    //    moves (no swap map entry; the proxies are already near their floor/ceiling).
    if(A){
      fx.crackle=clamp(fx.crackle + neg(A)*0.35 - pos(A)*0.15, 0, 1);
      c.humanize=clamp(c.humanize + neg(A)*0.18 - pos(A)*0.10, 0, 1);
      c.leadRecipe.spread=clamp((c.leadRecipe.spread!=null?c.leadRecipe.spread:0.004)*(1+pos(A)*1.2-neg(A)*0.7),0,0.05);
      c.padRecipe.detune=clamp((c.padRecipe.detune!=null?c.padRecipe.detune:0.006)*(1+pos(A)*1.2-neg(A)*0.7),0,0.05);
      c.leadRecipe.voices=clamp(Math.round((c.leadRecipe.voices||2)+pos(A)*3-neg(A)*2),1,7);
      if(A<=-0.6){   // hard acoustic: swap the synth fleet for its acoustic cousin where one exists
        if(AC_LEAD[c.leadRecipe.model]){ c.leadRecipe.model=AC_LEAD[c.leadRecipe.model]; c.leadDx7=null; c.leadSampler=null; }
        if(AC_PAD[c.padRecipe.model]){ c.padRecipe.model=AC_PAD[c.padRecipe.model]; c.padDx7=null; c.padSampler=null; }
      } else if(A>=0.6){   // hard synth: pull acoustic voices onto the supersaw/pad_saw
        if(SY_LEAD[c.leadRecipe.model]){ c.leadRecipe.model=SY_LEAD[c.leadRecipe.model]; c.leadDx7=null; c.leadSampler=null; }
        if(SY_PAD[c.padRecipe.model]){ c.padRecipe.model=SY_PAD[c.padRecipe.model]; c.padDx7=null; c.padSampler=null; }
      }
    }
    // -- simple <-> layered: pad on/off threshold, lead voice count, insert
    //    stacking, secondary percussion, per-cycle transform density, counter-voice.
    if(D){
      if(D<=-0.5) c.padsOn=false; else if(D>=0.5) c.padsOn=true;
      c.leadRecipe.voices=clamp(Math.round((c.leadRecipe.voices||2)+pos(D)*2-neg(D)*2),1,7);
      dr.hat=clamp((dr.hat!=null?dr.hat:1)*(1+pos(D)*0.30-neg(D)*0.35),0,2);
      dr.tom=clamp((dr.tom!=null?dr.tom:1)*(1+pos(D)*0.30-neg(D)*0.40),0,2);
      if(neg(D)>=0.6){   // strong simple: shed the second insert per voice
        c.bassInserts=(c.bassInserts||[]).slice(0,1);
        c.leadInserts=(c.leadInserts||[]).slice(0,1);
        c.padInserts =(c.padInserts ||[]).slice(0,1);
      }
      if(neg(D)>=0.5 && c.counter) c.counter=null;
      if(c.transforms) c.transforms.rate=clamp(round(scl(c.transforms.rate, pos(D)*0.5-neg(D)*0.5),3),0,1);
    }
    // -- dusty <-> clean: crackle/grit and the soft-top ceiling. Positive (clean)
    //    scrubs dust and OPENS the top; negative (dusty) adds grit and rolls it off.
    //    highcut is shared with `bright` — dust SETS/lowers the ceiling here, bright
    //    scales whatever ceiling survives (below), both clamped.
    if(U){
      fx.crackle=clamp(fx.crackle + neg(U)*0.40 - pos(U)*0.30, 0, 1);
      fx.grit=clamp((fx.grit||0) + neg(U)*0.35 - pos(U)*0.30, 0, 1);
      let hc=fx.highcut;
      if(neg(U)>0){ const target=9000-neg(U)*4500; hc = hc>1000 ? Math.min(hc,target) : target; }
      if(pos(U)>0 && hc>1000){ hc=hc*(1+pos(U)*0.8); if(hc>14000) hc=0; }
      fx.highcut=hc>0?Math.round(hc):0;
    }
    // -- dry <-> drenched: bus reverb, per-voice reverb sends, mild delay feedback.
    if(SP){
      fx.reverb=clamp(scl(fx.reverb, pos(SP)*0.5-neg(SP)*0.6),0,0.99);
      const sSend=(r,k)=>{ if(r&&r[k]!=null) r[k]=clamp(scl(r[k], pos(SP)*0.6-neg(SP)*0.7),0,1); };
      sSend(c.padRecipe,"send"); sSend(c.bassRecipe,"send"); sSend(c.leadRecipe,"send"); sSend(dr,"send");
      fx.delayFb=clamp(scl(fx.delayFb, pos(SP)*0.3-neg(SP)*0.35),0,0.85);
    }
    // -- dark <-> bright: cutoffs log-scaled (a power-of-two per unit slider), plus
    //    a gentler scale of the surviving soft-top ceiling (the dust interaction).
    if(BR){
      const mul=Math.pow(2, BR);
      const cut=(r,k,lo,hi)=>{ if(r&&r[k]!=null) r[k]=clamp(Math.round(r[k]*mul),lo,hi); };
      cut(c.padRecipe,"cutoff",80,18000); cut(c.bassRecipe,"cutoff",60,14000);
      cut(c.leadRecipe,"cutoff",120,18000); cut(fx,"delayCut",300,16000); cut(c.foundRecipe,"cutoff",300,18000);
      if(fx.highcut>1000){ let hc=fx.highcut*Math.pow(2,BR*0.6); fx.highcut = hc>16000?0:Math.round(hc); }
    }
    // -- tight <-> loose: swing depth, timing humanize, rubato sway. Negative pulls
    //    each toward its rigid floor (0); positive opens them up.
    if(FE){
      c.swing=clamp(c.swing*(1-neg(FE)) + pos(FE)*0.18, 0, 0.6);
      c.humanize=clamp(c.humanize*(1-neg(FE)*0.9) + pos(FE)*0.15, 0, 1);
      if(c.rubato) c.rubato.depth=clamp(round(scl(c.rubato.depth, pos(FE)*0.8-neg(FE)*0.8),4),0,0.2);
    }
    // -- calm <-> intense: drum drive, glue-comp, sidechain pump, ±8% bpm, transform rate.
    if(EN){
      dr.kick=clamp(scl(dr.kick!=null?dr.kick:1, pos(EN)*0.30-neg(EN)*0.35),0,2);
      dr.snare=clamp(scl(dr.snare!=null?dr.snare:1, pos(EN)*0.30-neg(EN)*0.40),0,2);
      fx.comp=clamp((fx.comp||0) + pos(EN)*0.30 - neg(EN)*0.25, 0, 1);
      fx.pump=clamp((fx.pump||0) + pos(EN)*0.25 - neg(EN)*0.20, 0, 1);
      c.bpm=Math.round(c.bpm*(1+EN*0.08));
      if(c.transforms) c.transforms.rate=clamp(round(scl(c.transforms.rate, pos(EN)*0.4-neg(EN)*0.4),3),0,1);
    }
    // -- instrumental <-> vocal: found VOICE layers only (vox lines, sung chorus,
    //    spoken-word narration bed) + auto-tune strength. Never touches non-voice
    //    found beds (field recordings, station hiss). Range-limited: an instrumental
    //    genre with no voice layer is unaffected (honest no-op on that axis).
    if(VO){
      if(c.voxRecipe&&c.voxRecipe.vol!=null) c.voxRecipe.vol=clamp(scl(c.voxRecipe.vol, pos(VO)*0.6-neg(VO)*0.9),0,1);
      if(c.vocalVol!=null) c.vocalVol=clamp(scl(c.vocalVol, pos(VO)*0.6-neg(VO)*0.9),0,1);
      if(c.foundRole==="narration") c.foundRecipe.vol=clamp(scl(c.foundRecipe.vol, pos(VO)*0.4-neg(VO)*0.7),0,1);
      if(pos(VO)>0 || c.autoTune!=null) c.autoTune=clamp(round((c.autoTune||0)+pos(VO)*0.5-neg(VO)*0.4,3),0,1);
    }
  }

  // ---------- choice -> engine state ----------
  function toState(c, opts){
    opts=opts||{};
    if(opts.macros) applyMacros(c, opts.macros);
    const {secs, cycleBeats, evolutions, coldOpen}=buildSections(c, opts);
    const foundSources=[];
    // bed role rotates through the whole foundPool (each pitched a hair differently
    // so it reads as a different place); break/chops keep the single tempo-locked
    // source. A section that carries a bed takes the next pool entry, so the number
    // of DISTINCT beds a track actually decodes is min(bed sections, pool length).
    // The rotation's STARTING index is seeded (see sections below) so the intro
    // isn't always foundPool[0] — every genre used to open on the same bed.
    const bedPool=((c.foundRole==="bed"||c.foundRole==="narration")&&c.foundPool&&c.foundPool.length>1)?c.foundPool:[c.foundSource];
    bedPool.forEach((sid,ix)=>{
      const isS=!!SAMPLES[sid];
      const sr=isS?SAMPLES[sid]:(SOURCES[sid]||{});
      const pj=1+(ix*0.06-0.03);
      foundSources.push(Object.assign({id:sid,label:sid,url:sr.url||"",kind:sr.kind},
        isS?{samplePath:"found/samples/"+sr.file,bpm:sr.bpm,durSec:sr.durSec}:{},
        {vol:c.foundRecipe.vol,pitch:c.foundRole==="break"?1:round(c.foundRecipe.pitch*pj,3),
         stretch:c.foundRecipe.stretch,cutoff:Math.round(c.foundRecipe.cutoff)},
        c.foundScratch?{scratch:c.foundScratch}:{}));   // scratch key present ONLY on opted genres => others byte-identical
    });
    if(c.hits){
      // hits resolve from SAMPLES (local one-shots) OR SOURCES (remote material
      // used as stabs — e.g. the Radio Moscow interval signal): a SOURCES hit
      // carries its url (browser streams it) and the CLI resolves found/<id>.mp3
      // as it does for any SOURCES id. Caught by validate-genres gate 6 —
      // chinawave/sovietwave listed SOURCES ids in hits and silently lost the
      // whole hit layer on those seeds.
      const h=SAMPLES[c.hits.source], hs=!h&&SOURCES[c.hits.source];
      if(h) foundSources.push({id:c.hits.source,label:c.hits.source,url:"",kind:h.kind,samplePath:"found/samples/"+h.file,
        durSec:h.durSec,vol:(c.hits.vol!=null?c.hits.vol:0.22),pitch:1,stretch:0.5,cutoff:(c.hits.cut||4500),wet:!!c.hits.wet,glitch:!!c.hits.glitch});
      else if(hs) foundSources.push({id:c.hits.source,label:c.hits.source,url:hs.url,kind:hs.kind,
        durSec:4,vol:(c.hits.vol!=null?c.hits.vol:0.22),pitch:1,stretch:0.5,cutoff:(c.hits.cut||4500),wet:!!c.hits.wet,glitch:!!c.hits.glitch});
    }
    const voxIds=(c.voxPool||[]).slice();
    if(c.voxPoem) voxIds.push(c.voxPoem);
    voxIds.forEach(vid=>{   // VO lines (news clean, poem chopped) + the cities poem
      const v=SAMPLES[vid]; if(!v) return;
      foundSources.push({id:vid,label:vid,url:"",kind:v.kind,samplePath:"found/samples/"+v.file,durSec:v.durSec,
        vol:(c.voxRecipe&&c.voxRecipe.vol)||0.5, pitch:(c.voxRecipe&&c.voxRecipe.pitch)||0.96,
        stretch:0.5, cutoff:(c.voxRecipe&&c.voxRecipe.cutoff)||6500});
    });
    (c.sampleEvents||[]).forEach(se=>{   // KERNEL-V4 Phase 4: ride each role's pool ids into foundSources so buildEvents' srcById resolves them (like hits above)
      (se.pool||[]).forEach(id=>{
        if(foundSources.some(s=>s.id===id)) return;
        const isS=!!SAMPLES[id], sr=isS?SAMPLES[id]:SOURCES[id]; if(!sr) return;
        foundSources.push(Object.assign({id,label:id,url:sr.url||"",kind:sr.kind},
          isS?{samplePath:"found/samples/"+sr.file,durSec:sr.durSec,bpm:sr.bpm}:{durSec:4},
          {vol:0.3,pitch:1,stretch:0.5,cutoff:5000}));
      });
    });
    if(c.vocal){   // the WORLD-sung 8-bar chorus — generated to match bpm+key at render time (sing.py), written here
      foundSources.push({id:"tw_vocal",label:"tw_vocal",url:"",samplePath:"found/tw_vocal.mp3",
        durSec:32*60/c.bpm, vol:(c.vocalVol!=null?c.vocalVol:0.52), pitch:1, stretch:0.5, cutoff:9000, vocal:true});
    }
    // the "vocoder" melody/pad model needs a speech table to modulate from:
    // resolve the anchor's vocSource (else first VO line / hit) and make sure
    // that source is IN foundSources (vol 0 = loaded as modulator, never played)
    let vocId=null;
    if(c.leadRecipe.model==="vocoder"||c.padRecipe.model==="vocoder"){
      vocId=c.vocSource||(c.voxPool&&c.voxPool[0])||(c.hits&&c.hits.source)||null;
      if(vocId&&!foundSources.some(s=>s.id===vocId)){
        const isVS=!!SAMPLES[vocId], vsr=isVS?SAMPLES[vocId]:SOURCES[vocId];
        if(vsr) foundSources.push(Object.assign({id:vocId,label:vocId,url:vsr.url||""},
          isVS?{samplePath:"found/samples/"+vsr.file,durSec:vsr.durSec}:{},
          {vol:0,pitch:1,stretch:0.5,cutoff:5000}));
        else vocId=null;
      }
    }
    // SAMPLER voices: embed the zone map in the instrument recipe (the engine
    // contract, see faust/state-engine.js case "sampler") and ride each zone
    // wav into foundSources at vol 0 so both engines decode it through the
    // existing found paths (press ffdecode / live fetch+decode).
    const samplerSpec=(id)=>{
      const S=fontInstr(id); if(!S) return null;
      // len + sr ride ALONG to the state zone: loopStart/loopEnd are absolute
      // sample indices in the zone FILE, so a consumer decoding at another rate
      // (press.js always decodes 44100) must scale by sr, and the decoder-padding
      // correction needs len to spot a padded buffer. Both are undefined for wav
      // zones, which is exactly when no correction should happen.
      return { id, sr:S.sr, zones:S.zones.map((z,i)=>({srcId:"ins_"+id+"_"+i, root:z.root, lo:z.lo, hi:z.hi,
        vlo:z.vlo, vhi:z.vhi, loop:!!z.loop, loopStart:z.ls, loopEnd:z.le, len:z.len, sr:S.sr })) };
    };
    // SYNTH FONT (B): the recipe fragment to MERGE for a resolved sampler instrument.
    // Default → {model:"sampler", sampler:zones}. Under an active synth font →
    // {model:modeld/dx7 + analog params, sampler:null}, overriding the recipe's
    // "sampler" model so state-engine builds the synth voice. Merged LAST in toState
    // so it wins. Opt-in => default fluidr3 returns the exact old sampler fragment.
    const instrMerge=(id,role)=>{
      const SF=activeSynthFont();
      if(SF){ const v=SF.voiceFor(id,role); return { model:v.voice, ...v.params, sampler:null, dx7:v.voice==="dx7"?v.dx7:null }; }
      return { model:"sampler", sampler:samplerSpec(id) };
    };
    // SAMPLED DRUM KIT resolution (drums.kit -> per-drum native sampler specs on
    // instruments.drums; faust/state-engine drumSamp overlays them onto the
    // kick/snare/hat/tom voices). Each hit is one UNLOOPED one-shot zone; the hat
    // carries closed+open zones selected by trigger freq (see state-engine). The
    // wavs ride foundSources (vol 0) like instrument zones. Returns the drums-
    // instrument overlay {kickSampler,snareSampler,hatSampler,tomSampler} + the
    // foundSources to inject, or null (unknown/absent kit -> synth kit unchanged).
    const drumKitSpec=(name)=>{
      const K=DRUMKITS[name]; if(!K) return null;
      const H=K.hits, srcs=[];
      const one=(hit,zones)=>{
        const push=(h)=>{ if(H[h]) srcs.push({id:"drum_"+name+"_"+h, file:H[h].file}); };
        if(hit==="hat"){ push("hatClosed"); push("hatOpen"); } else push(hit==="tom"?"tom":hit);
        return zones;
      };
      const overlay={};
      if(H.kick)  overlay.kickSampler ={ id:"drum_"+name+"_kick",  sr:K.sr, oneShotSec:H.kick.len/K.sr,  zones: one("kick", [{srcId:"drum_"+name+"_kick",  root:60, lo:0, hi:127, loop:0}]) };
      if(H.snare) overlay.snareSampler={ id:"drum_"+name+"_snare", sr:K.sr, oneShotSec:H.snare.len/K.sr, zones: one("snare",[{srcId:"drum_"+name+"_snare", root:60, lo:0, hi:127, loop:0}]) };
      if(H.hatClosed&&H.hatOpen) overlay.hatSampler={ id:"drum_"+name+"_hat", sr:K.sr, oneShotSec:H.hatOpen.len/K.sr,
        zones: one("hat", [{srcId:"drum_"+name+"_hatClosed", root:60, lo:0, hi:65, loop:0},
                           {srcId:"drum_"+name+"_hatOpen",   root:72, lo:66, hi:127, loop:0}]) };
      if(H.tom)   overlay.tomSampler  ={ id:"drum_"+name+"_tom",   sr:K.sr, oneShotSec:H.tom.len/K.sr,   zones: one("tom", [{srcId:"drum_"+name+"_tom", root:DRUM_TOM_ROOT, lo:0, hi:127, loop:0}]) };
      // perc-lane wiring: the real recorded clap/rim/ride/crash (fixed
      // pitch, one zone each). Fed by state.perc lanes; synth fallback in state-engine.
      for(const h of ["clap","rim","ride","crash"]) if(H[h])
        overlay[h+"Sampler"]={ id:"drum_"+name+"_"+h, sr:K.sr, oneShotSec:H[h].len/K.sr, zones: one(h, [{srcId:"drum_"+name+"_"+h, root:60, lo:0, hi:127, loop:0}]) };
      return { overlay, srcs, dir:K.dir, label:K.label };
    };
    // the shared GM perc bank -> instruments.drums.percSampler (multi-zone: each
    // element at its GM note, natural pitch). Built with ONLY the elements the
    // genre's lanes actually play (percBankElements) so a genre decodes/injects
    // nothing it won't hit (a ride/rim/clap-only genre gets NO perc bank at all —
    // keeps the live steer's decode footprint minimal). Independent of the kit
    // (afrobeat's shaker rides it even with a synth kick).
    const percBankSpec=(elements)=>{
      const K=PERCBANK, srcs=[], zones=[]; let maxLen=1;
      for(const name of elements){ const h=K.hits[name]; if(!h) continue;
        srcs.push({id:"perc_"+name, file:h.file});
        zones.push({srcId:"perc_"+name, root:h.note, lo:h.note, hi:h.note, loop:0});
        if(h.len>maxLen) maxLen=h.len;
      }
      if(!zones.length) return null;
      return { spec:{ id:"percbank", sr:K.sr, oneShotSec:maxLen/K.sr, zones }, srcs, dir:K.dir };
    };
    // the transition micro-lick soloist -> state.lickVoice (csd-engine plays
    // it as a first-class solo voice; "@model" = a synth lick, otherwise a
    // SAMPLERS id whose zone wavs ride foundSources below like any sampler).
    // Explicit dx7:null/sampler:null keys matter: the recipe merges over the
    // melody recipe, which may itself be a dx7/sampler voice.
    let lickVoice=null, lickSamplerId=null;
    if(c.lick){
      if(c.lick[0]==="@"){
        const m=c.lick.slice(1);
        const SYN={ piano:{cutoff:3200,level:.5}, pluck:{cutoff:2600,level:.45,release:.12},
          organ:{cutoff:2400,level:.45}, stack:{wave:"saw",voices:3,spread:.008,cutoff:3000,level:.45},
          fuzz:{cutoff:2800,drive:.6,level:.5}, kpluck:{cutoff:3200,drive:.3,level:.5} };
        lickVoice=Object.assign({model:m,send:.3,dsend:.3,voices:1,dx7:null,sampler:null,inserts:[]},SYN[m]||{cutoff:3000,level:.45});
      } else if(SAMPLERS[c.lick]){
        lickSamplerId=c.lick;
        lickVoice={model:"sampler",sampler:samplerSpec(c.lick),level:.52,send:.32,dsend:.28,
          attack:.012,release:.14,voices:1,dx7:null,inserts:[]};
      }
    }
    const samplerIds=[c.leadSampler, c.padSampler, c.bassSampler, lickSamplerId].filter(Boolean);
    if(c.form==="transit") samplerIds.push("crunch_guitar");   // the transit form's metal-solo section (R_TW_METAL) rides the crunch sampler
    for(const id of new Set(samplerIds)){
      const S=fontInstr(id); if(!S) continue;
      S.zones.forEach((z,i)=>foundSources.push({id:"ins_"+id+"_"+i,label:(SAMPLERS[id]&&SAMPLERS[id].label)||id,url:"",
        samplePath:"found/samples/"+S.base+"/"+S.dir+"/"+z.file, vol:0, pitch:1, stretch:0.5, cutoff:18000}));
    }
    // sampled drum kit: resolve the genre's drums.kit and ride each hit wav into
    // foundSources at vol 0 (decoded through the same paths as instrument zones).
    // SYNTH FONT: a synth font drops the SAMPLED drum kit so the drums are
    // synthesized by minimoog/dx7 too — the engine's own SYNTHESIZED
    // voices (analog kick boom/808/909 + noise/crack snare + noise/metal hats), an
    // all-synth kit under the analog/FM font. Default (fluidr3) keeps its sampled kit.
    const drumKit = (c.drumRecipe && c.drumRecipe.kit && !activeSynthFont()) ? drumKitSpec(c.drumRecipe.kit) : null;
    if(drumKit) for(const s of drumKit.srcs)
      foundSources.push({id:s.id, label:drumKit.label, url:"",
        samplePath:"found/samples/drums/"+drumKit.dir+"/"+s.file, vol:0, pitch:1, stretch:0.5, cutoff:18000});
    // PERC LANE: resolve the dominant parent's perc style + inject the shared GM
    // perc bank (percSampler) so the lane's congas/shaker/cowbell/… render sampled
    // regardless of the kit. clap/rim/ride/crash ride the kit sampler above when
    // present, synth fallback otherwise (state-engine).
    const percStyle = resolvePercStyle(c.genres, c.weights);
    let percOverlay = {};
    if(percStyle){
      const pb = percBankSpec(percBankElements(percStyle.lanes));   // null when no perc-voice lane (ride/rim/clap/crash only)
      if(pb){
        percOverlay.percSampler = pb.spec;
        const have = new Set(foundSources.map(s=>s.id));
        for(const s of pb.srcs){ if(have.has(s.id)) continue; have.add(s.id);
          foundSources.push({id:s.id, label:"GM Percussion (FluidR3, MIT)", url:"",
            samplePath:"found/samples/perc/"+pb.dir+"/"+s.file, vol:0, pitch:1, stretch:0.5, cutoff:18000}); }
      }
    }
    // ---- SPEECH organ worked example (engine/speech.js): the transit PA
    // announces THIS seed's namebank act. When the resolved genre carries real
    // transitwave presence (weight >= .35 — the standing "real presence"
    // threshold, see resolveMulti's dx7 rule), ONE extra speech-role source
    // rides foundSources with `synthText` (no file: both engines synthesize it
    // through CsdSpeech — byte-identical PCM by the artifact's fresh-instance
    // guarantee) plus one appended sampleEvents opener spec. The text derives
    // PURELY from (seed, genre) via NameBank.hash/identity — the chyron
    // derivation (app/readouts.js), ZERO rng draws on the resolve stream, so
    // every other seeded choice is untouched (the bed-rotation-start
    // precedent). The spec APPENDS after the anchor's own sampleEvents, so on
    // the shared seed+9091 stream every earlier spec's draws are byte-
    // identical (drawn-last convention). The canned saytransit vox pool
    // (sp_tw_*) stays untouched. ABSENT for every other genre and for
    // transitwave-light blends: no field, byte-identical (the standing law).
    let paSpec=null;
    {
      const NB=isNode?require("./namebank.js"):root.NameBank;
      // ---------- THE SPEECH ORGAN'S CAST ----------
      // engine/speech.js synthesizes these live (espeak WASM in the browser,
      // the same artifact in press) — no file, no fetch, no licence. For a long
      // time it had exactly ONE producer, so the organ was effectively unwired
      // and everything that SOUNDED like espeak was a pre-rendered mp3.
      //
      // Every genre below already carried the vocabulary in its own card: the
      // ATC read-back, the OYEZ, the livestock chant, "now serving". The text
      // is what the card always promised; the voice is what makes them
      // different people rather than one narrator in twelve hats — variant,
      // pitch and speed are chosen per speaker (m1 grave, f2/f3 bright, croak
      // for the ones that should sound wrong).
      //
      // THE LAWS THIS KEEPS, all inherited from the transit PA it generalizes:
      //   · text derives PURELY from (seed, genre) through NameBank.hash /
      //     identity — the chyron derivation. ZERO rng draws on the resolve
      //     stream, so every other seeded choice is untouched.
      //   · the spec APPENDS after the anchor's own sampleEvents, so on the
      //     shared seed+9091 stream every earlier spec's draws stay identical.
      //   · a genre NOT in this table gets no field at all => byte-identical.
      //   · the 0.35 weight floor is the standing "real presence" threshold, so
      //     a light blend never puts words in a genre's mouth.
      //   · csd-engine's voice-repeat governor (GOV_CAP 5 per 64 bars) caps the
      //     density from above, so a speaker cannot become a loop.
      const SPEAKERS={
        transitwave:    {tag:"PA",       variant:"f3",    pitch:60, speed:165,
          say:(w,h)=>(h&1)?"Now arriving: "+w.artist+"." : w.artist+", with service to "+w.album+"."},
        airtrafficdrone:{tag:"ATC",      variant:"m3",    pitch:30, speed:190,
          say:(w,h)=>(h&1)?w.artist+", descend and maintain flight level "+(180+(h%9)*10)+"." : w.artist+", cleared to land, runway "+(1+h%36)+"."},
        towncrier:      {tag:"CRIER",    variant:"m1",    pitch:15, speed:120,
          say:(w,h)=>(h&1)?"Oyez! Oyez! "+w.album+", this "+(1+h%28)+"th day!" : "Hear ye! "+w.artist+" proclaims "+w.title+"!"},
        auctioncore:    {tag:"AUCTION",  variant:"m2",    pitch:70, speed:260,
          say:(w,h)=>(h&1)?"Do I hear "+(20+h%60)+", "+(20+h%60)+", now "+(30+h%60)+"?" : "Sold! To "+w.artist+" for "+(40+h%200)+" dollars!"},
        dmvstep:        {tag:"COUNTER",  variant:"f2",    pitch:45, speed:150,
          say:(w,h)=>(h&1)?"Now serving ticket "+(100+h%800)+" at window "+(1+h%12)+"." : "Ticket "+(100+h%800)+". Window "+(1+h%12)+". Thank you."},
        elevatorcore:   {tag:"LIFT",     variant:"f1",    pitch:55, speed:155,
          say:(w,h)=>(h&1)?"Floor "+(2+h%30)+". Going up." : "Mezzanine. Doors opening."},
        holdmusic:      {tag:"HOLD",     variant:"f2",    pitch:50, speed:145,
          say:(w,h)=>(h&1)?"Your call is important to us. Please continue to hold." : "All of our agents are currently assisting other customers."},
        microwave:      {tag:"KITCHEN",  variant:"m4",    pitch:40, speed:135,
          say:(w,h)=>(h&1)?"For that which we are about to reheat, let us be thankful." : "Two minutes. On high. Amen."},
        thermostatwave: {tag:"DOMESTIC", variant:"m5",    pitch:48, speed:150,
          say:(w,h)=>(h&1)?"The setpoint is "+(64+h%12)+" degrees. It was not agreed." : "Someone has changed the thermostat again."},
        dishwasherwave: {tag:"CYCLE",    variant:"croak", pitch:35, speed:140,
          say:(w,h)=>(h&1)?"Heated dry. Cycle complete." : "Rinse. Hold. Rinse. Hold."},
        garage:         {tag:"NUMBERS",  variant:"f5",    pitch:52, speed:170,
          say:(w,h)=>{const d=[];for(let i=0;i<5;i++)d.push((h>>(i*3))%10);return "Group "+(10+h%89)+". "+d.join(" ")+".";}},
        mallsoft:       {tag:"MALL",     variant:"f4",    pitch:58, speed:150,
          say:(w,h)=>(h&1)?"Attention shoppers. "+w.label+" closes in "+(5+h%25)+" minutes." : "The owner of a "+w.artist+" sedan, your lights are on."},
      };
      // Pick the DOMINANT speaking genre rather than the first one found, so a
      // blend of two speakers gets one voice (the louder) instead of two people
      // talking over each other.
      // ---------- THE DERIVED TIER ----------
      // The bespoke cast above is twelve genres that had a voice waiting in
      // their own card — the OYEZ, the ATC read-back, the auction chant. That
      // does not scale: writing 90 more idioms by hand is 90 chances to write a
      // bad one, and most genres have no such line in them.
      //
      // So genres whose FORM is a mix — dj, drop, vamp: the ones built to be
      // beat-matched and announced over — get a STATION IDENT instead, spoken
      // over their own NameBank identity. That is the idiom those forms already
      // live in (the pirate-radio drop, the DJ tag), so it is characterful
      // rather than generic, and it is picked by a structural property of the
      // genre rather than by a hand-picked list: 65 genres carry one of those
      // three forms, three of which the bespoke cast above already claims, so
      // 62 speak an ident.
      //
      // The VOICE is hashed from the genre name, so every station sounds like a
      // different station, and it is stable: the same genre always gets the same
      // announcer. Deterministic like everything else here — NameBank.hash, no
      // rng on the resolve stream.
      const IDENT_FORMS=new Set(["dj","drop","vamp"]);
      const D_VARIANT=["m1","m2","m3","m4","m5","f1","f2","f3","f4","f5","croak","whisper"];
      // THE LINES. An announcer says a FRAMED sentence — a verb, an address,
      // a hand-off. Two earlier forms had no frame at all ("<label>. <album>."
      // and "<artist>, <title>.") and read as a discography entry recited, not
      // an ident; they also owned every defect in the realized corpus:
      //   · "<label>. <album>." put the label sentence-final, and two imprints
      //     already end in a period, so it said "Laserdisc Ltd..";
      //   · the album slot recites catalogue furniture — "(Deluxe Reissue)",
      //     "Greatest Hits Vol. 4", "Self Titled", "Untitled";
      //   · NameBank.identity upper-cases `title`, so "<artist>, <title>." was
      //     the only ALL-CAPS text this tier fed espeak;
      //   · title and band are drawn from the same per-genre bank, so they
      //     collide on their own key word ("Pirate Signal, PIRATE RADIO
      //     SKYLINE", "Velvet Sub Club, VELVET PRESSURE") — a name said twice.
      // Cut. The back-announce below replaces both: it is the station move the
      // set was missing, and it stays grammatical under every name in the bank.
      // Two imprints in the pool END in a period ("Laserdisc Ltd."), so any
      // frame that puts the label last has to drop the sentence stop or it
      // doubles — the exact defect the cut forms shipped.
      const stop=(s)=>String(s).replace(/\.$/,"")+".";
      const IDENT_SAY=[
        (w)=>"You're listening to "+stop(w.artist),
        (w)=>"That was "+w.artist+", right here on "+stop(w.label),
        (w)=>"Next up: "+stop(w.artist),
        (w)=>"This is "+w.label+" radio.",
      ];
      // Most ident genres have no per-genre bank in NameBank, so their act is
      // one of the eight GENERIC bands — Cassette, Analog, Half Light, The
      // Drift. Those are too thin to BE a station: "You're listening to
      // Analog." is a placeholder read aloud. The imprint pool is hand-written
      // and always specific, so a bankless genre gets the LABEL-led frames
      // only; the generic act still speaks, in the supporting slot where a
      // vague name is unremarkable.
      const IDENT_SAY_GENERIC=[IDENT_SAY[1],IDENT_SAY[3]];
      function derivedSpeaker(g){
        const A=GENRES[g]; if(!A||!IDENT_FORMS.has(A.form||"pop")) return null;
        const NBx=isNode?require("./namebank.js"):root.NameBank; if(!NBx) return null;
        const h=NBx.hash(0,g,"voice")>>>0;                       // seed 0: the voice is the GENRE's, not the track's
        // UNSIGNED shifts: `>>` is a SIGNED 32-bit op, so any hash above 2^31
        // goes negative and drags the modulo with it — jungle came out at pitch
        // -4 and house at speed 69, which espeak either clamps or refuses.
        // Ranges are espeak's usable middle: pitch 25-74 of 0-99, speed 130-199.
        const lines=NBx.NAMEBANK&&NBx.NAMEBANK[g]?IDENT_SAY:IDENT_SAY_GENERIC;
        return { tag:"IDENT", variant:D_VARIANT[h%D_VARIANT.length],
          pitch:25+((h>>>4)%50), speed:130+((h>>>9)%70),
          say:(w,hh)=>lines[hh%lines.length](w) };
      }
      const speakerFor=(g)=>SPEAKERS[g]||derivedSpeaker(g);      // a bespoke voice always beats an ident
      let sp=null, spW=0, spName=null;
      (c.genres||[]).forEach((g,i)=>{
        const w=c.weights?c.weights[i]:1;
        if(w>=0.35 && w>spW){ const s=speakerFor(g); if(s){ sp=s; spW=w; spName=g; } }
      });
      if(NB&&sp){
        const h=NB.hash(c.seed,spName,"pa");
        const who=NB.identity(spName,h);
        const text=sp.say(who,h);
        foundSources.push({id:"sp_pa_namebank",label:sp.tag+": "+text,url:"",kind:"speech",
          synthText:{text,voice:"en-us",variant:sp.variant,pitch:sp.pitch,speed:sp.speed},
          // deterministic HEARD-length estimate: espeak at rate 165 measures
          // ~0.42s + 0.049s/char (fit slightly UNDER so the chop never wraps),
          // SCALED by 165/speed because the speakers below run 120 (the crier,
          // slow and grand) to 260 (the auctioneer) — an estimate pinned to 165
          // would cut the crier off mid-word. Then /0.82 because kind:"speech"
          // plays at SPEECH_RATE_CAP (state-engine) — durSec only sizes the chop
          // event, so it must cover the stretched utterance or the line loses
          // its last syllable.
          durSec:round((0.42+0.049*text.length*(165/sp.speed))/0.82,2),
          vol:0.5,pitch:1,stretch:0.5,cutoff:3800});
        // opener = the always-safe slot: ONE shot at the first matching
        // section's downbeat (live rebuilds per-section, so it recurs at
        // section starts — the PA idiom), treated like the canned vox lines
        // (telephone-band cutoff, echoed into the 1/8 delay). maxDur 10 (the
        // hogcore full-phrase precedent) clears the default 4-beat cap for
        // the longer "with service to" announcements.
        paSpec={pool:["sp_pa_namebank"],placement:"opener",
          treatment:{maxDur:10,cutoff:3800,vol:0.5,rsend:0.25,dsend:0.35}};
      }
    }
    // LIVE SPEECH CARRY. A registry entry with synthText is SAID by the engine
    // (engine/speech.js) instead of fetched — all 230 espeak clips are declared
    // that way now. The per-source constructors above each build an explicit
    // object literal and pick fields by hand, so every one of them dropped it
    // silently: the registry said "synthesize me" and the state never mentioned
    // it. Carry it once, here, after every push, rather than threading the same
    // line through six constructors that will drift apart.
    // The PA organ sets its own synthText and is left alone (!s.synthText).
    for(const s of foundSources){
      const reg=SAMPLES[s.id]||SOURCES[s.id];
      if(reg&&reg.synthText&&!s.synthText) s.synthText=reg.synthText;
      // declared rotation cast (registry VOICE_FAMILIES) — same "carry it once,
      // after every push" reason as synthText. Key absent for unlisted ids.
      if(VOICE_FAM[s.id] && !s.fam) s.fam=VOICE_FAM[s.id];
    }
    const state={
      ...(lickVoice?{lickVoice}:{}),
      vocoderSourceId: vocId||undefined,
      bpm:c.bpm, keyOffset:opts.keyOffset!=null?opts.keyOffset:0, progression:c.progression,
      reverb:c.fx.reverb, seed:c.seed, swing:c.swing, humanize:c.humanize,
      ...(c.reverbColor?{reverbColor:c.reverbColor}:{}),   // fx wings: per-genre reverb character (absent = fx_bus zita default; byte-identical)
      ...(c.padDouble?{padDouble:true}:{}),                // WALL OF SOUND: octave-below pad double (heavymetal); absent = byte-identical
      ...(c.strum?{strum:c.strum}:{}),                     // RHYTHM-GUITAR STRUM: pattern name (or {pattern,spread}); pad chord struck rhythmically on a dedicated stream. Absent = flat pad block, byte-identical
      ...(c.autoTune!=null?{autoTune:c.autoTune}:{}),       // fx wings stage 2: found-vocal auto-tune strength 0..1 (absent = no bend; byte-identical)
      ...(c.masterComp?{masterComp:c.masterComp}:{}),       // fx wings stage 4: 3-band master glue-comp drive (absent/0 = bypass; byte-identical)
      ...(c.blueNote?{blueNote:c.blueNote}:{}),             // blue-note bend strength for a sampled sax/guitar lead (absent/0 = no bends; a separate stream in buildEvents keeps all other events byte-identical)
      ...(c.leadOctave?{leadOctave:c.leadOctave|0}:{}),     // whole-track lead register shift in octaves (zero-rng, dominant parent; absent = byte-identical) — the anchor-level REGISTER fix: the score asks inside the sampler's natural window
      realHats:!!c.realHats, snarePP:c.snarePP||0,
      // rubato/thunk (neoclassical deep pass): absent keys = zero behavior
      // change in buildEvents — unchanged genres press byte-identically
      ...(c.rubato?{rubato:c.rubato}:{}), ...(c.thunk?{thunk:c.thunk}:{}),
      ...(c.transforms?{transforms:c.transforms}:{}),  // pattern-transform algebra (Phase 2): absent = engine's historical default, byte-identical
      ...(c.timeFeel?{timeFeel:c.timeFeel}:{}),         // unified time-feel (Phase 3): grid + push-pull; absent = grid "8th" + no push-pull, byte-identical
      // MUSIC-MIND organs (docs/MUSIC-MIND.md): each absent key = ZERO draws
      // and byte-identical events in buildEvents (the absent-knob law). theory
      // is emitted ONLY when reharm survived constrain — adventure/color/
      // voicing are reharmonize() opts, dead weight without it (the truly-
      // absent rule: no {} husks). pipes/rhythm likewise vanish at zero/empty.
      ...(c.theory&&c.theory.reharm?{theory:{adventure:c.theory.adventure,color:c.theory.color,voicing:c.theory.voicing,reharm:true,
        ...(c.theory.tables?{tables:c.theory.tables}:{})}}:{}),   // MIDI-trove MINED tables (theory.js) — opt-in per anchor, conditional so tableless states are byte-identical
      ...(c.pipes&&c.pipes.length?{pipes:c.pipes}:{}),
      ...(c.rhythmComplexity>.02?{rhythm:{complexity:c.rhythmComplexity}}:{}),
      ...((c.sampleEvents||paSpec)?{sampleEvents:[...(c.sampleEvents||[]),...(paSpec?[paSpec]:[])]}:{}),  // generalized sample-event roles (Phase 4) + the SPEECH-organ PA opener appended last: absent = no sample-event layer, byte-identical
      ...(coldOpen?{coldOpen:true}:{}),                 // OPTIONAL INTRO: the leading ground node was actually dropped (introMode "off" + ground opener). buildEvents ignores it; djMix reads it for the cold-open seam law. Absent for every genre that keeps its intro (byte-identical); present only on gabber/breakcore.
      euclid:c.euclid||undefined,                      // kit-level euclidean rhythm spec (csd-engine drumEvents)
      ...(c.chordEvery?{chordEvery:c.chordEvery}:{}),  // harmonic rhythm (KERNEL-V4 Phase 1): beats per chord bar
      ...(c.meter?{meter:c.meter}:{}),                 // ODD METER: {beats:3|6, unit:4|8} — absent = 4/4, byte-identical (resolveMulti emits it only when a parent anchor declares it)
      jux:(c.fx.jux||0)>0.05?c.fx.jux:0,               // stereo divergence: buildEvents emits per-event pan offsets
      pump:c.fx.pump>0.05?c.fx.pump:0, crackle:c.fx.crackle>0.05?c.fx.crackle:0,
      comp:c.fx.comp>0.05?c.fx.comp:0, grit:(c.fx.grit||0)>0.05?c.fx.grit:0,
      tone:{lowcut:c.fx.lowcut>10?Math.round(c.fx.lowcut):0, highcut:c.fx.highcut>1000?Math.round(c.fx.highcut):0},
      delay:{beats:c.fx.delayBeats, feedback:c.fx.delayFb, cutoff:Math.round(c.fx.delayCut)},
      instruments:{
        // model "dx7" carries its resolved patch: instruments.<voice>.dx7 =
        // {algorithm, params[, name]} — the Faust engine's contract.
        // inserts: the per-voice insert-FX chain (CONTRACT: [{type,...params}],
        // [] = bypass — see csd-engine defaultInstruments for units)
        pad:Object.assign(E.defaultInstruments().pad, c.padRecipe, {inserts:c.padInserts||[]}, c.padDx7?{dx7:c.padDx7}:{}, c.padSampler?instrMerge(c.padSampler,"pad"):{}),
        bass:Object.assign(E.defaultInstruments().bass, c.bassRecipe, {inserts:c.bassInserts||[]}, c.bassDx7?{dx7:c.bassDx7}:{}, c.bassSampler?instrMerge(c.bassSampler,"bass"):{}),
        melody:Object.assign(E.defaultInstruments().melody, c.leadRecipe, {voices:Math.round(c.leadRecipe.voices||2), inserts:c.leadInserts||[]}, c.leadDx7?{dx7:c.leadDx7}:{}, c.leadSampler?instrMerge(c.leadSampler,"melody"):{}),
        drums:Object.assign(E.defaultInstruments().drums, c.drumRecipe, drumKit?drumKit.overlay:{}, percOverlay),
      },
      ...(percStyle?{perc:{lanes:percStyle.lanes}}:{}),
      foundSources,
      sections:(()=>{
        // bird-rarity round: seed the bed-rotation START (Knuth-hash of
        // state.seed — a pure function, NO rng draw consumed, so every other
        // seeded choice is untouched and gate 1 determinism holds byte-for-byte).
        let bi=bedPool.length>1?(((c.seed>>>0)*2654435761)>>>0)%bedPool.length:0, vi=0; return secs.map(s=>{
        if(s.found&&s.found.sourceId==="src"){ s.found.sourceId=bedPool[bi%bedPool.length]; bi++; }
        if(s.hits&&s.hits.sourceId==="hit")s.hits.sourceId=c.hits?c.hits.source:null;
        if(s.hits&&!s.hits.sourceId)delete s.hits;
        if(s.vox&&s.vox.sourceId==="vox"){ if(c.voxPool&&c.voxPool.length){ s.vox.sourceId=c.voxPool[vi%c.voxPool.length]; vi++; } else delete s.vox; }
        else if(s.vox&&s.vox.sourceId==="poem"){ if(c.voxPoem) s.vox.sourceId=c.voxPoem; else delete s.vox; }
        if(s.vocal===true){ if(c.vocal) s.vocal="tw_vocal"; else delete s.vocal; }        // the sung chorus -> the vocal source id
        return s; }); })(),
    };
    state.genreMeta={genres:c.genres,t:c.t,seed:c.seed,form:c.form,kit:c.kit,progression:c.progression,
      bass:c.bassPattern+"("+c.bassRecipe.model+(c.bassDx7?":"+c.bassDx7.name:"")+(c.bassSampler?":"+c.bassSampler:"")+")",
      lead:c.leadPattern+"("+c.leadRecipe.model+(c.leadDx7?":"+c.leadDx7.name:"")+(c.leadSampler?":"+c.leadSampler:"")+")",
      pad:c.padRecipe.model+(c.padDx7?":"+c.padDx7.name:"")+(c.padSampler?":"+c.padSampler:""),drums:c.drumRecipe.kickModel+"/"+c.drumRecipe.snareModel+"/"+c.drumRecipe.hatModel,
      found:c.foundSource+"/"+c.foundRole, stab:c.stab, hits:c.hits?c.hits.source:"-",
      lick:c.lick||"-",
      ...(c.meter?{meter:c.meter.beats+"/"+c.meter.unit}:{}),   // ODD METER audit line — conditional spread so meterless genres' state hashes are untouched
      evolutions,   // the 3-minute-rule audit trail: [{at, tSec, kind, detail}]
      rubato:c.rubato?c.rubato.depth+"x"+c.rubato.periodBars+"bar":"-",
      counter:c.counter?c.counter.pattern+"(oct"+c.counter.octave+")":"-",
      inserts:{bass:(c.bassInserts||[]).map(f=>f.type).join("+")||"-",
               lead:(c.leadInserts||[]).map(f=>f.type).join("+")||"-",
               pad:(c.padInserts||[]).map(f=>f.type).join("+")||"-"},
      // MUSIC-MIND audit line: the RESOLVED axes even when the state key is
      // absent (adventure interpolates on every blend; reharm gates whether
      // state.theory ships) — "!reharm" marks a resolved-but-ungated theory.
      mind:(c.theory?"adv"+c.theory.adventure+"/col"+c.theory.color+"/"+c.theory.voicing+(c.theory.reharm?"":" !reharm"):"-")
           +" | "+((c.pipes&&c.pipes.length)?c.pipes.map(p=>p.id).join("+"):"-")
           +" | "+(c.rhythmComplexity>.02?"cx"+c.rhythmComplexity:"-")};
    // SAMPLED BY DEFAULT: anything that can be sampled is, because it sounds
    // much better than the synth path. Every emitted state renders its
    // pitched voices from the SF2 sample library unless the caller opts out:
    //   • opts.synth === true        (CLI --synth; explicit pure-synth)
    //   • opts.sampledOnly === false (a caller asking for the old synth default)
    // The pure-synth path is byte-for-byte the historical default (applySampledOnly
    // never runs). Signature synths (tb303 acid line, reese/wobble/acid bass,
    // synclead, modeld, vocoder) stay pure synth even when sampled — see
    // state-engine SIGNATURE_MODELS.
    const wantSynth = opts.synth === true || opts.sampledOnly === false;
    if(!wantSynth) applySampledOnly(state, c.seed);
    // SAMPLER REGISTER HOME pin (MUSICALITY balance loop 2, docs/MUSICALITY.md
    // REGISTER law): one measurement build; buildEvents decides the whole-line
    // octave home for any misregistered sampled slot (the lead voicing's
    // octave 8-9 synth convention vs a wind/guitar/choir sampler's natural
    // window — zero-rng, event-measured over the FULL track). Pinning the
    // decision on the state makes it a whole-track constant: the press and
    // every live per-bar rebuild (reseeded, one section at a time) apply the
    // SAME shift — no per-bar octave flapping, no live/press divergence. A
    // state whose sampled slots all fit returns no decision: no key, and the
    // state (and its events) are byte-identical to before this pass existed.
    {
      const iv=state.instruments||{};
      const hasSampler=["melody","pad","bass"].some(s=>{ const m=iv[s];
        return m&&m.model==="sampler"&&m.sampler&&Array.isArray(m.sampler.zones)&&m.sampler.zones.length; });
      if(hasSampler){
        const ev=E.buildEvents(state);
        if(ev&&ev.regHome) state.regHome=ev.regHome;
      }
    }
    return state;
  }

  // Single tracks default to the 3-minute target (180s); the buildSections
  // solver lands them within ±10%. VIDEO_LOCKED forms (ritual/anthem/transit)
  // opt out of the DEFAULT — their section cycles are hand-authored so the
  // regenerated audio grafts onto committed videos. They still honour an
  // explicit journey targetSec; journeys aren't gated.
  //
  // Length-normalising an anchor tips the window-count-sensitive `variation`
  // feature, so any anchor sitting at an exact 100/100 verifier tie with a
  // rival has to stay at its natural length until the rival rows are tightened.
  // No anchor is in that position now: the last two (witchhouse, afrobeat)
  // graduated on deep passes, afrobeat once the verifier gained the `interlock`
  // feature it was missing (Fela's E(3,16)xE(11,16) tresillo/shekere lock,
  // which the whole four-on-floor cluster lacks).
  const AUTO_TARGET=180;
  const NO_AUTO_FORM=new Set(["ritual","anthem","transit"]);
  // Genres exempt from the section-DROP lever (buildSections): the droppable
  // node carries their identity, so a floored-over-band track keeps it and runs
  // long rather than losing its diagonal. See the lever's NO_SECTION_DROP note.
  const NO_SECTION_DROP=new Set(["witchhouse"]);
  const withTarget=(c,opts)=>{
    const o=Object.assign({},opts);
    if(o.targetSec==null && !NO_AUTO_FORM.has(c.form)) o.targetSec=AUTO_TARGET;
    return toState(c,o);
  };
  function track(genre, opts){ opts=opts||{}; return withTarget(resolve(genre, genre, 0, opts.seed!=null?opts.seed:1), opts); }
  function blend(a, b, t, opts){ opts=opts||{}; return withTarget(resolve(a, b, t, opts.seed!=null?opts.seed:1), opts); }

  // ---------- journeys: playlists along arbitrary paths ----------
  // A waypoint is a genre NAME ("techno") or a POINT in the space
  // ({weights:[{g,w},…]}, e.g. exported from the explorer's drawn path).
  // journey() walks waypoint-to-waypoint, lerping weight vectors between
  // them, with playlist()'s tempo/key/novelty discipline; playlist() is the
  // all-names special case.
  function wpLabel(ws){
    const s=ws.slice().sort((a,b)=>b.w-a.w);
    if(s.length===1||s[0].w>0.9) return s[0].g;
    return s.slice(0,2).map(x=>x.g+Math.round(x.w*100)).join("+");
  }
  function normWaypoint(w){
    if(typeof w==="string"){
      if(!GENRES[w]) throw new Error("unknown genre: "+w);
      return { label:w, weights:[{g:w,w:1}] };
    }
    const ws=(w.weights||[]).filter(x=>GENRES[x.g]&&x.w>0);
    if(!ws.length) throw new Error("waypoint has no valid genre weights");
    const tot=ws.reduce((s,x)=>s+x.w,0);
    return { label:wpLabel(ws), weights:ws.map(x=>({g:x.g,w:x.w/tot})) };
  }
  function lerpWeights(A,B,t){
    const m={};
    A.forEach(x=>m[x.g]=(m[x.g]||0)+x.w*(1-t));
    B.forEach(x=>m[x.g]=(m[x.g]||0)+x.w*t);
    const ws=Object.entries(m).filter(([,w])=>w>0.01).map(([g,w])=>({g,w:round(w,4)}));
    return ws.length?ws:[{g:A[0].g,w:1}];
  }
  function journey(waypoints, opts){
    opts=opts||{};
    const wps=waypoints.map(normWaypoint);
    const hours=opts.hours||2;
    const n=opts.tracks||Math.max(4,Math.round(hours*8));
    const baseSeed=opts.seed!=null?opts.seed:42;
    const rng=mulberry32(baseSeed>>>0);
    const legs=Math.max(1,wps.length-1);
    const perSec=hours*3600/n;
    let key=Math.floor(rng()*12);
    const recent=[], out=[];
    for(let i=0;i<n;i++){
      const pos=legs*(n===1?0:i/(n-1));
      const leg=Math.min(legs-1,Math.floor(pos));
      const A=wps[leg], B=wps[leg+1]||A, t=pos-leg;
      const weights=lerpWeights(A.weights,B.weights,t);
      const targetSec=perSec*(0.75+rng()*0.5);
      key=(key+(rng()<0.5?7:5))%12;
      let state=null, meta=null;
      for(let attempt=0; attempt<6; attempt++){
        const seed=baseSeed+i*101+attempt*1009;
        const cand=toState(resolveMulti(weights.map(w=>({...w})),seed), {targetSec, keyOffset:key, macros:opts.macros, synth:opts.synth, sampledOnly:opts.sampledOnly});
        const m=cand.genreMeta;
        const sig=[m.kit,m.progression,m.bass,m.lead,m.found];
        const collide=recent.some(r=>sig.filter((v,j)=>v===r[j]).length>=3);
        if(!collide||attempt===5){ state=cand; meta=m; recent.push(sig); if(recent.length>2)recent.shift(); break; }
      }
      const beats=state.sections.reduce((nn,s)=>nn+(s.cycles||1)*(E.PROGRESSIONS[state.progression].chords.length*(state.chordEvery||8)),0)+8;
      out.push({ i, from:A.label, to:B.label, t:round(t,3), weights,
        seconds:Math.round(beats*60/state.bpm), bpm:state.bpm, key, meta, state });
    }
    return out;
  }
  function playlist(waypoints, opts){ return journey(waypoints, Object.assign({tracks:12}, opts||{})); }

  function mix(weights, opts){ opts=opts||{}; return withTarget(resolveMulti(weights, opts.seed!=null?opts.seed:1), opts); }
  // ========== SAMPLED MODE (state.sampledOnly — ON BY DEFAULT) ==============
  // Anything that can be sampled is sampled: it sounds much better than the
  // synth path. toState applies this to every emitted state (opt out with
  // opts.synth / opts.sampledOnly:false). This enricher makes a resolved state
  // render its pitched mix from the SF2-
  // derived sample library instead of Faust synthesis. It does NOT decide which
  // instrument each voice plays — that deterministic (role, model, seed) mapping
  // lives in faust/state-engine.js voiceUnits (the one place shared by press +
  // live). This just makes the raw material available on the state:
  //   1. state.sampledOnly = true            (state-engine's switch)
  //   2. state.samplerLib = {id -> spec}      (zone maps for ALL 40 instruments;
  //      state-engine picks from it per voice)
  //   3. every instrument zone wav -> foundSources at vol 0 (both engines lazily
  //      decode ONLY the zones the picked units reference — press usedSrc / live
  //      kickSamplerBuf — so injecting all 40 is cheap)
  //   4. force a sampled drum kit when the genre runs a SYNTH kit (a genre that
  //      already carries a sampled kit — jazz/blues/… — keeps its own).
  // Idempotent: safe to call every live bar on the same state object (explorer
  // ?allSampled=1 applies it as a getState transform so it survives retargets/
  // glides). Never touched on the default path — genres press byte-identically.
  const _sampledOnlySpec=(id)=>{
    const SF=activeSynthFont();
    // SYNTH FONT: a synth voice per instrument (no sample zones). Bake BOTH a lead
    // and a pad voice so state-engine forceSampled can pick role-aware (this path
    // runs on EVERY track via applySampledOnly, so pads must get the poly voice or
    // hovering voices collapse on mono modeld).
    if(SF){ const lead=SF.voiceFor(id,"melody"), pad=SF.voiceFor(id,"pad");
      return { id, synth:lead.voice, params:lead.params, dx7:lead.dx7,
        padSynth:pad.voice, padParams:pad.params, padDx7:pad.dx7 }; }
    const S=fontInstr(id); if(!S) return null;
    return { id, sr:S.sr, zones:S.zones.map((z,i)=>({srcId:"ins_"+id+"_"+i, root:z.root, lo:z.lo, hi:z.hi,
      vlo:z.vlo, vhi:z.vhi, loop:!!z.loop, loopStart:z.ls, loopEnd:z.le, len:z.len, sr:S.sr })) };
  };
  // mirrors toState's inner drumKitSpec (kept separate so toState stays byte-exact)
  const _sampledOnlyKit=(name)=>{
    const K=DRUMKITS[name]; if(!K) return null;
    const H=K.hits, srcs=[];
    const one=(hit,zones)=>{ const push=(h)=>{ if(H[h]) srcs.push({id:"drum_"+name+"_"+h, file:H[h].file}); };
      if(hit==="hat"){ push("hatClosed"); push("hatOpen"); } else push(hit==="tom"?"tom":hit); return zones; };
    const overlay={};
    if(H.kick)  overlay.kickSampler ={ id:"drum_"+name+"_kick",  sr:K.sr, oneShotSec:H.kick.len/K.sr,  zones: one("kick", [{srcId:"drum_"+name+"_kick",  root:60, lo:0, hi:127, loop:0}]) };
    if(H.snare) overlay.snareSampler={ id:"drum_"+name+"_snare", sr:K.sr, oneShotSec:H.snare.len/K.sr, zones: one("snare",[{srcId:"drum_"+name+"_snare", root:60, lo:0, hi:127, loop:0}]) };
    if(H.hatClosed&&H.hatOpen) overlay.hatSampler={ id:"drum_"+name+"_hat", sr:K.sr, oneShotSec:H.hatOpen.len/K.sr,
      zones: one("hat", [{srcId:"drum_"+name+"_hatClosed", root:60, lo:0, hi:65, loop:0},
                         {srcId:"drum_"+name+"_hatOpen",   root:72, lo:66, hi:127, loop:0}]) };
    if(H.tom)   overlay.tomSampler  ={ id:"drum_"+name+"_tom",   sr:K.sr, oneShotSec:H.tom.len/K.sr,   zones: one("tom", [{srcId:"drum_"+name+"_tom", root:DRUM_TOM_ROOT, lo:0, hi:127, loop:0}]) };
    for(const h of ["clap","rim","ride","crash"]) if(H[h])
      overlay[h+"Sampler"]={ id:"drum_"+name+"_"+h, sr:K.sr, oneShotSec:H[h].len/K.sr, zones: one(h, [{srcId:"drum_"+name+"_"+h, root:60, lo:0, hi:127, loop:0}]) };
    return { overlay, srcs, dir:K.dir, label:K.label };
  };
  function applySampledOnly(state, seed){
    if(!state || (state.sampledOnly && state.samplerLib)) return state;   // idempotent
    seed = seed!=null ? seed : (state.seed!=null ? state.seed : 1);
    state.sampledOnly=true;
    state.foundSources=state.foundSources||[];
    const have=new Set(state.foundSources.map(s=>s.id));
    // (2) library of every sampled instrument + (3) ride each zone wav in at vol 0
    const lib={}, synthFont=activeSynthFont();
    for(const id of Object.keys(SAMPLERS)){
      lib[id]=_sampledOnlySpec(id);
      if(synthFont) continue;   // SYNTH FONT: pure synth voices, no zone wavs to inject
      const S=fontInstr(id); if(!S) continue;
      S.zones.forEach((z,i)=>{ const sid="ins_"+id+"_"+i; if(have.has(sid)) return; have.add(sid);
        state.foundSources.push({id:sid,label:(SAMPLERS[id]&&SAMPLERS[id].label)||id,url:"",samplePath:"found/samples/"+S.base+"/"+S.dir+"/"+z.file,vol:0,pitch:1,stretch:0.5,cutoff:18000}); });
    }
    state.samplerLib=lib;
    // (4) force a sampled kit when the genre runs a synth kit (no *Sampler overlay)
    // — UNLESS a synth font is active: then the drums stay SYNTHESIZED too, by
    // the same minimoog/dx7 voices. This is the real gate — the
    // "sampled by default" pass runs on every track() and would otherwise re-add a
    // kit after toState dropped it.
    const D=state.instruments&&state.instruments.drums;
    if(D && !D.kickSampler && !activeSynthFont()){
      const kits=Object.keys(DRUMKITS);
      const spec=_sampledOnlyKit(kits[(((seed>>>0)*2654435761)>>>0)%kits.length]);
      if(spec){ Object.assign(D, spec.overlay);
        for(const s of spec.srcs){ if(have.has(s.id)) continue; have.add(s.id);
          state.foundSources.push({id:s.id,label:spec.label,url:"",samplePath:"found/samples/drums/"+spec.dir+"/"+s.file,vol:0,pitch:1,stretch:0.5,cutoff:18000}); } }
    }
    return state;
  }

  const api={ GENRES, SOURCES, SAMPLES, SAMPLERS, SOURCE_POOLS, expandPools, DX7_PATCHES, FORM_NAMES:Object.keys(FORMS), FORM_ENTRY, PERC_STYLES, PERC_STYLE_GENRES, PERC_ELEMENTS, resolve, resolveMulti, track, blend, mix, playlist, journey, applySampledOnly, deriveMind, registerFont, setFont, activeFont, fontList, instrFamily };
  if(isNode) module.exports=api; else root.GenreKernel=api;

})(typeof window!=="undefined"?window:globalThis);
