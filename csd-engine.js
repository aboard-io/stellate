// csd-engine.js — the score brain: pure event generator for the genre space.
// buildEvents(state) -> {pitched, drums, found, sfx, bpm, totalBeats}
// Every backend (the Faust engine in faust/, MIDI export) derives from
// buildEvents so they never drift. The csound codegen that used to live here
// (buildCsd/orchestra) is preserved on branch legacy-csound.

(function (root) {
  "use strict";

  function parsePch(s){ const [o,ss]=String(s).split("."); return parseInt(o,10)*12+parseInt(ss,10); }
  function toPch(abs){ const o=Math.floor(abs/12), ss=abs%12; return o+"."+String(ss).padStart(2,"0"); }
  function pchAdd(s,semis){ return toPch(parsePch(s)+(semis|0)); }
  function pchToMidi(s){ const [o,ss]=String(s).split("."); return (parseInt(o,10)-3)*12+parseInt(ss,10); }
  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  // blues call-and-response: one seeded stream per GLOBAL chord bar, shared by
  // the "blues" lead generator and the hits placer (pattern "response") so
  // "who takes the response bars" — the guitar's answer vs the 78rpm singer —
  // agrees across layers without coupling their rng order. Draw #1 < 0.42 =
  // the lead RESTS the response half and the vox hit is slotted there.
  function crStream(seed,gci){ return mulberry32((((seed??1)>>>0)^Math.imul(gci+1,2654435761))>>>0); }

  const NOTE={C:0,"C#":1,Db:1,D:2,"D#":3,Eb:3,E:4,F:5,"F#":6,Gb:6,G:7,"G#":8,Ab:8,A:9,"A#":10,Bb:10,B:11};
  const QUAL={maj:[0,4,7],min:[0,3,7],maj7:[0,4,7,11],min7:[0,3,7,10],dom7:[0,4,7,10],m7b5:[0,3,6,10],sus4:[0,5,7]};
  // build a chord voicing from root name + quality (consistent with the hand ones)
  function voicing(rootName, quality){
    const r=NOTE[rootName]||0;
    const iv=QUAL[quality]||QUAL.maj;
    const four=iv.length>=4?iv.slice(0,4):[iv[0],iv[1],iv[2],iv[0]+12];
    const pads=four.map(i=>pchAdd(toPch(84+r),i));      // octave 7 base
    const lead=four.map(i=>pchAdd(toPch(96+r),i));      // octave 8 base
    const bass={ r5:toPch(60+r), r6:toPch(72+r), f6:pchAdd(toPch(72+r),7) };
    return { name:rootName+quality, pads, bass, lead };
  }
  const prog=(label,specs)=>({ label, chords: specs.map(([r,q])=>voicing(r,q)) });

  const PROGRESSIONS = {
    royal_road:{ label:"Royal Road (IVΔ7-V7-iii7-vi7) — city pop / vaporwave", chords:[
      {name:"Fmaj7",pads:["7.05","7.09","8.00","8.04"],bass:{r5:"5.05",r6:"6.05",f6:"6.00"},lead:["8.05","8.09","9.00","9.04"]},
      {name:"G7",   pads:["7.07","7.11","8.02","8.05"],bass:{r5:"5.07",r6:"6.07",f6:"6.02"},lead:["8.07","8.11","9.02","9.05"]},
      {name:"Em7",  pads:["7.04","7.07","7.11","8.02"],bass:{r5:"5.04",r6:"6.04",f6:"5.11"},lead:["8.04","8.07","8.11","9.02"]},
      {name:"Am7",  pads:["7.09","8.00","8.04","8.07"],bass:{r5:"5.09",r6:"6.09",f6:"6.04"},lead:["8.09","9.00","9.04","9.07"]}],
      composed:[[0,1.5,"8.09"],[1.5,0.5,"8.07"],[2,1,"8.09"],[3,2,"9.00"],[5,1.5,"9.04"],[6.5,1.5,"9.02"],[8,1,"9.02"],[9,1,"8.11"],[10,2,"8.07"],[12,1,"8.09"],[13,1,"8.11"],[14,2,"9.02"],[16,1.5,"9.04"],[17.5,0.5,"9.02"],[18,2,"8.11"],[20,1.5,"8.07"],[21.5,0.5,"8.09"],[22,2,"8.11"],[24,1,"9.00"],[25,1,"8.11"],[26,2,"8.09"],[28,1.5,"9.04"],[29.5,0.5,"9.00"],[30,2,"8.09"]],
      composed2:[[0,1,"9.00"],[1,1,"9.04"],[2,1,"9.05"],[3,1,"9.04"],[4,2,"9.02"],[6,1,"9.00"],[7,1,"8.11"],[8,1.5,"9.02"],[9.5,0.5,"9.04"],[10,1,"9.05"],[11,1,"9.04"],[12,2,"9.02"],[14,2,"8.11"],[16,1,"9.04"],[17,1,"9.07"],[18,1,"9.04"],[19,1,"9.02"],[20,2,"8.11"],[22,2,"9.02"],[24,1,"9.00"],[25,1,"9.04"],[26,1.5,"9.07"],[27.5,0.5,"9.04"],[28,1,"9.00"],[29,1,"8.09"],[30,2,"8.09"]] },
    four_chords:{ label:"Four chords (I-V-vi-IV)", chords:[
      {name:"C", pads:["7.00","7.04","7.07","8.00"],bass:{r5:"5.00",r6:"6.00",f6:"6.07"},lead:["8.00","8.04","8.07","9.00"]},
      {name:"G", pads:["7.07","7.11","8.02","8.07"],bass:{r5:"5.07",r6:"6.07",f6:"6.02"},lead:["8.07","8.11","9.02","9.07"]},
      {name:"Am",pads:["7.09","8.00","8.04","8.09"],bass:{r5:"5.09",r6:"6.09",f6:"6.04"},lead:["8.09","9.00","9.04","9.09"]},
      {name:"F", pads:["7.05","7.09","8.00","8.05"],bass:{r5:"5.05",r6:"6.05",f6:"6.00"},lead:["8.05","8.09","9.00","9.05"]}] },
    sad_pop:{ label:"Sad pop (vi-IV-I-V)", chords:[
      {name:"Am",pads:["7.09","8.00","8.04","8.09"],bass:{r5:"5.09",r6:"6.09",f6:"6.04"},lead:["8.09","9.00","9.04","9.09"]},
      {name:"F", pads:["7.05","7.09","8.00","8.05"],bass:{r5:"5.05",r6:"6.05",f6:"6.00"},lead:["8.05","8.09","9.00","9.05"]},
      {name:"C", pads:["7.00","7.04","7.07","8.00"],bass:{r5:"5.00",r6:"6.00",f6:"6.07"},lead:["8.00","8.04","8.07","9.00"]},
      {name:"G", pads:["7.07","7.11","8.02","8.07"],bass:{r5:"5.07",r6:"6.07",f6:"6.02"},lead:["8.07","8.11","9.02","9.07"]}] },
    doo_wop:{ label:"'50s doo-wop (I-vi-IV-V)", chords:[
      {name:"C", pads:["7.00","7.04","7.07","8.00"],bass:{r5:"5.00",r6:"6.00",f6:"6.07"},lead:["8.00","8.04","8.07","9.00"]},
      {name:"Am",pads:["7.09","8.00","8.04","8.09"],bass:{r5:"5.09",r6:"6.09",f6:"6.04"},lead:["8.09","9.00","9.04","9.09"]},
      {name:"F", pads:["7.05","7.09","8.00","8.05"],bass:{r5:"5.05",r6:"6.05",f6:"6.00"},lead:["8.05","8.09","9.00","9.05"]},
      {name:"G", pads:["7.07","7.11","8.02","8.07"],bass:{r5:"5.07",r6:"6.07",f6:"6.02"},lead:["8.07","8.11","9.02","9.07"]}] },
    ii_v_i:{ label:"Jazz ii-V-I turnaround", chords:[
      {name:"Dm7",  pads:["7.02","7.05","7.09","8.00"],bass:{r5:"5.02",r6:"6.02",f6:"6.09"},lead:["8.02","8.05","8.09","9.00"]},
      {name:"G7",   pads:["7.07","7.11","8.02","8.05"],bass:{r5:"5.07",r6:"6.07",f6:"6.02"},lead:["8.07","8.11","9.02","9.05"]},
      {name:"Cmaj7",pads:["7.00","7.04","7.07","7.11"],bass:{r5:"5.00",r6:"6.00",f6:"6.07"},lead:["8.00","8.04","8.07","8.11"]}] }
  };
  // generated additions (way more progressions)
  Object.assign(PROGRESSIONS, {
    pop_1625:   prog("Pop I-vi-ii-V",            [["C","maj7"],["A","min7"],["D","min7"],["G","dom7"]]),
    synthwave:  prog("Synthwave i-VI-III-VII",   [["A","min7"],["F","maj7"],["C","maj7"],["G","dom7"]]),
    andalusian: prog("Andalusian i-VII-VI-V",    [["A","min7"],["G","maj"],["F","maj7"],["E","dom7"]]),
    minor_run:  prog("Minor i-iv-VII-III",       [["A","min7"],["D","min7"],["G","dom7"],["C","maj7"]]),
    neosoul:    prog("Neo-soul descending",      [["F","maj7"],["E","min7"],["D","min7"],["C","maj7"]]),
    lofi:       prog("Lo-fi ii-V-I-vi",          [["D","min7"],["G","dom7"],["C","maj7"],["A","min7"]]),
    epic_min:   prog("Epic i-VI-VII",            [["A","min7"],["F","maj7"],["G","dom7"],["G","dom7"]]),
    house_min:  prog("House i-VII-VI-VII",       [["A","min7"],["G","maj"],["F","maj7"],["G","dom7"]]),
    dream:      prog("Dreamy IVΔ-Imaj7",         [["F","maj7"],["C","maj7"],["D","min7"],["G","dom7"]]),
    canon:      prog("Pachelbel canon",          [["C","maj"],["G","maj"],["A","min7"],["E","min7"],["F","maj7"],["C","maj"],["F","maj7"],["G","dom7"]]),
    // genre-kernel additions — low/zero harmonic motion for techno/dj forms
    drone_min:  prog("Drone (i, no motion)",     [["A","min7"]]),
    primeval:   prog("Primeval i-bVII-bIII-bVI",  [["A","min7"],["G","dom7"],["C","maj7"],["F","maj7"]]),   // cinematic lift — planetarium grandeur
    deep_two:   prog("Deep two-chord (i-VI)",    [["A","min7"],["F","maj7"]]),
    house_min7: prog("House stabs (i-i-iv-v)",   [["A","min7"],["A","min7"],["D","min7"],["E","min7"]]),
    // modal colors — the MODE dimension (tonic stays A/C-relative; keyOffset moves it)
    mode_dorian:    prog("Dorian i7-IV7 vamp",      [["A","min7"],["D","dom7"],["A","min7"],["G","maj7"]]),
    mode_phrygian:  prog("Phrygian i-bII",          [["A","min"],["Bb","maj7"],["A","min"],["G","min7"]]),
    mode_lydian:    prog("Lydian IΔ-II",            [["C","maj7"],["D","dom7"],["C","maj7"],["D","dom7"]]),
    mode_mixo:      prog("Mixolydian I7-bVII",      [["C","dom7"],["Bb","maj7"],["F","maj7"],["C","dom7"]]),
    // genre-kernel additions — trance lift + disco/funk vamp
    uplift:     prog("Uplift (i-VI-VII-i)",      [["A","min7"],["F","maj7"],["G","maj"],["A","min7"]]),
    funk_vamp:  prog("Funk vamp (i7-IV7)",       [["A","min7"],["D","dom7"]]),
    // round-3 genre-kernel additions — plain-triad minor (coldwave/wintersynth/tango:
    // the verifier's "seventh" feature needs a 0-seventh minor home) + phrygian
    // DOMINANT (arab pop's hijaz color: MAJOR tonic against bII)
    frost:      prog("Frost (i-VI-III-VII triads)", [["A","min"],["F","maj"],["C","maj"],["G","maj"]]),
    hijaz:      prog("Hijaz (I-bII, phrygian dominant)", [["A","maj"],["Bb","maj7"],["A","maj"],["G","min7"]]),
    blues_12:   prog("12-bar blues (all dom7)",  [["C","dom7"],["C","dom7"],["C","dom7"],["C","dom7"],
                                                  ["F","dom7"],["F","dom7"],["C","dom7"],["C","dom7"],
                                                  ["G","dom7"],["F","dom7"],["C","dom7"],["G","dom7"]])
  });

  // (KERNEL-V4 §3.7) progression resolution is now HARD: gate 6 proves every
  // anchor's progression names resolve, so at runtime an unknown name is a bug,
  // not a reason to silently render royal_road city-pop harmony. Replaces the
  // four `PROGRESSIONS[x]||PROGRESSIONS.royal_road` fallbacks (engine + kernel +
  // verifier). Byte-stable: never fires on a valid state.
  function getProgression(name){
    const p=PROGRESSIONS[name];
    if(!p) throw new Error("csd-engine: unknown progression '"+name+"' (no royal_road fallback — see gate 6)");
    return p;
  }

  const CHORD_BEATS=8;
  const WAVES=["sine","saw","square","pulse"];
  const BASS_PATTERNS=["off","root","simple","walking","octaves","sixteenths","dub","drive","rolling","sub","stab","melodic","habanera","syncopated","pedal"];
  const MELODY_PATTERNS=["off","composed","composed2","arpup","arpdown","updown","pentaup","wander","sparse","double","hero","blues","canon","roar","anthem","arp16","motorik","motorik23"];
  const DRUM_PATTERNS=["off","kick","full","open","four","boombap","halftime","trap","pulse","techno","house","breaks","jungle","tribal","bossa","electro","newjack","shuffle"];
  // KERNEL-V4 Phase 5 (§3.5) — the form as a graph of TYPED NODES. Every
  // section, whatever a form names it, classifies to one of six node types:
  //   ground  arrival / low-energy opener   (intro, arrive, dawn, platform, warmup)
  //   build   rising groove / verse         (verse, build, theme, drift, board, plateau, transit…)
  //   peak    the payoff                     (chorus, drop, peak, lift, main, express, swell, solo-call…)
  //   release the drop-out / breakdown       (breakdown, break, recede, interchange, answer)
  //   exposed the stripped moment            (bridge, solo)
  //   cadence the ending                     (outro, depart, terminus, finale, coda)
  // This is the grammar's external contract: sample-event roles attach to
  // node types (Phase-4 handoff #1) so a renamed section keeps its layers, and
  // openers/cadences find natural attach points. Derived from the name (no
  // state field -> byte-stable; sec.tag, if a caller ever sets one, wins).
  function sectionTag(name){
    const n=String(name||"").toLowerCase();
    if(/intro|arrive|\bdawn|platform|warm/.test(n))                 return "ground";
    if(/outro|depart|terminus|finale|\bcoda\b/.test(n))             return "cadence";
    if(/breakdown|^break|recede|interchange|\banswer\b/.test(n))    return "release";
    if(/bridge|\bsolo\b|exposed/.test(n))                           return "exposed";
    if(/chorus|drop|\bpeak|\blift|shred|\bcall\b|\bmain\b|express|swell/.test(n)) return "peak";
    return "build";   // verse / build / theme / drift / rebuild / pre-chorus / plateau / transit / board
  }
  const SFX_NUM={riser:1,sweep:2,downlift:3,impact:4,reverse:5,noise:6};
  // the ⚡ transition control: what happens at the end of a section, into the next
  // (2026-07: + "snare roll" march-crescendo, "stutter" last-half-bar gate,
  //  "dropout" kick-drop silence beat — see buildEvents transition chain)
  // (2026-07 MUSICAL-transition round: + "micro lick" — a 1-2 bar seeded
  //  sax/trombone/flute/piano pickup phrase into the next downbeat, voiced by
  //  state.lickVoice; + "kit fill" — a half-bar mini-fill that QUOTES the
  //  section's own drum pattern. The noise/sweep/riser SFX are demoted -8dB
  //  and rationed by the kernel's auto-transition pass.)
  const TRANSITIONS=["off","drum fill","tom fill","break fill","hat rush","cut","riser","sweep","downlift","impact","reverse","noise","snare roll","stutter","dropout","micro lick","kit fill"];
  // synthesis-model vocabulary. FAUST-PORT: the voices themselves live in
  // faust/state-engine.js (pitchedUnit) + faust/dist/ modules; this predicate is
  // the engine-side canon anchors and validators check against — keep it in sync
  // when a new .dsp lands. (validate-genres scrapes these model==="…"
  // comparisons from source, exactly like the pattern tables above.)
  const isModel=(model)=>
    // pitched: pad/bass/lead
    model==="saw"||model==="stack"||model==="sine"||model==="sub"||model==="acid"||
    model==="reese"||model==="wobble"||model==="piano"||model==="organ"||model==="strings"||
    model==="choir"||model==="bell"||model==="brass"||model==="fm"||model==="rhodes"||
    model==="pluck"||model==="kpluck"||model==="fuzz"||model==="guitar"||model==="vocoder"||
    model==="modeld"||   // Minimoog-Model-D mono voice (dsp/modeld.dsp)
    // synth fleet (2026-07): nine classic-synth Faust voices (faust/dsp/*.dsp)
    model==="juno60"||model==="tb303"||model==="solina"||model==="hammond"||model==="synclead"||
    model==="casiocz"||model==="oberheim"||model==="ppg"||model==="vp330"||
    model==="dx7"||model==="sampler"||   // sampler: native pitched sample zones (found/samples/instruments/)
    // drums: kick boom|808|909 · snare noise|crack|clap · hat noise|metal
    model==="boom"||model==="808"||model==="909"||model==="noise"||model==="crack"||
    model==="clap"||model==="metal";

  // ---------- SOURCE-CLASS taxonomy (KERNEL-V4 §3.6 — the primary timbre axis) ----------
  // Every pitched model classified by its SYNTHESIS SOURCE CLASS — the first
  // choice §3.6 makes per voice, formerly implicit in each anchor's `model:[…]`
  // pool. Classes:
  //   analog       subtractive / analog-modelled oscillator voices (the space's
  //                default synth timbre) — incl. the emulation fleet (juno60,
  //                tb303, solina, oberheim, ppg, casiocz, synclead, modeld) and
  //                the additive/wavetable string/choir/brass/bell/vp330 pads,
  //                which are synths, not sampled instruments.
  //   fm           phase-modulation voices — the built-in `fm` and the DX7
  //                cartridge engine (`dx7`); a DX7's acoustic-ness is a property
  //                of the loaded PATCH name, not the class (see verifier).
  //   sampler      real recorded multisamples (found/samples/instruments/) —
  //                acoustic by construction.
  //   electromech  tonewheel/tine/pipe electro-mechanical instruments modelled
  //                as their own voices (hammond, organ, rhodes, piano) — the
  //                genuinely-acoustic-adjacent tier.
  //   mechanical   noise/distortion-defined voices (fuzz).
  // `ac` = the acoustic MEMBERSHIP grade this source contributes to the
  // verifier's `acoustic` feature (0 = pure synth). It lives HERE now so the
  // feature READS the axis rather than re-deriving it from an inline list
  // (piano 1, sampler .8, organ/hammond .6 — the historical grades, unchanged).
  // Silence ("off") is a first-class source the anchors already weight in-pool.
  const SOURCE_CLASS = {
    saw:{class:"analog",ac:0}, stack:{class:"analog",ac:0}, sine:{class:"analog",ac:0},
    sub:{class:"analog",ac:0}, acid:{class:"analog",ac:0}, reese:{class:"analog",ac:0},
    wobble:{class:"analog",ac:0}, pluck:{class:"analog",ac:0}, kpluck:{class:"analog",ac:0},
    modeld:{class:"analog",ac:0}, juno60:{class:"analog",ac:0}, tb303:{class:"analog",ac:0},
    solina:{class:"analog",ac:0}, synclead:{class:"analog",ac:0}, casiocz:{class:"analog",ac:0},
    oberheim:{class:"analog",ac:0}, ppg:{class:"analog",ac:0}, vp330:{class:"analog",ac:0},
    strings:{class:"analog",ac:0}, choir:{class:"analog",ac:0}, bell:{class:"analog",ac:0},
    brass:{class:"analog",ac:0}, vocoder:{class:"analog",ac:0}, guitar:{class:"analog",ac:0},
    fm:{class:"fm",ac:0}, dx7:{class:"fm",ac:0},
    sampler:{class:"sampler",ac:0.8},
    piano:{class:"electromech",ac:1}, rhodes:{class:"electromech",ac:0.6},
    organ:{class:"electromech",ac:0.6}, hammond:{class:"electromech",ac:0.6},
    fuzz:{class:"mechanical",ac:0},
  };
  const sourceClassOf=(model)=>(SOURCE_CLASS[model]&&SOURCE_CLASS[model].class)||null;

  // models: pad saw|organ|fm · bass saw|sub|acid|reese · melody stack|pluck|fm
  // · kick boom|808|909 · snare noise|crack|clap · hat noise|metal
  // `inserts` — per-voice insert-FX chain (0-2 entries), a first-class state
  // dimension resolved by the genre kernel. CONTRACT (Faust engine consumes):
  //   inserts: [{type:"distort",drive,mix} | {type:"phaser",rate,depth,mix} |
  //             {type:"chorus",rate,depth,mix} |
  //             {type:"filtersweep",rateBars,lo,hi,res}]
  //   rate in Hz; rateBars = sweep period in BARS; lo/hi = octaves relative to
  //   the voice's cutoff; drive/depth/mix/res in 0..1. Empty array = bypass.
  function defaultInstruments(){
    return {
      pad:    { model:"saw", wave:"saw",  cutoff:1400, res:0.15, detune:0.006, attack:1.5, level:0.7, send:0.55, dsend:0.15, inserts:[] },
      bass:   { model:"saw", wave:"saw",  cutoff:700,  res:0.15, level:1.0, send:0.08, dsend:0.0, inserts:[] },
      melody: { model:"stack", wave:"sine", cutoff:3400, res:0.05, vibrato:0.006, vibRate:5.2, level:0.6, send:0.45, dsend:0.25, voices:2, spread:0.004, inserts:[] },
      drums:  { kickModel:"boom", snareModel:"noise", hatModel:"noise", kick:1.0, snare:1.0, hat:1.0, tom:1.0, tune:1.0, send:0.18, dsend:0 }
    };
  }
  // (KERNEL-V4 §3.7 deletion) the STYLES whole-song presets AND generateSong
  // (the 2026-05 builder's whole-song codegen) are gone — the FORM GRAMMAR in
  // genre-kernel.js (buildSections/buildForm) is the one composer now. The only
  // survivor was defaultState's demo section list; it is inlined below as a
  // static royal-road pop song (value-identical to the old
  // generateSong({foundIds:["tokyo","tsukiji","asakusa"],bass:"simple",
  // drums:"full",melody:"composed"}) output — the committed default_song the
  // engine.test press and the legacy A/B harness render). The engine can't reach
  // the kernel grammar (kernel requires engine, not vice versa), so a literal
  // list is the honest form here; genre tracks come from genre-kernel.track().
  const DEFAULT_SONG=[
    { id:"s1", name:"intro",      cycles:1, pads:true, bass:"off",     drums:"off",  melody:"off",      found:{sourceId:"tokyo",  role:"bed"}, fill:"off" },
    { id:"s2", name:"verse",      cycles:1, pads:true, bass:"simple",  drums:"off",  melody:"off",      found:{sourceId:"tsukiji",role:"bed"}, fill:"off" },
    { id:"s3", name:"pre-chorus", cycles:1, pads:true, bass:"root",    drums:"kick", melody:"off",      found:{sourceId:null,     role:"bed"}, fill:"riser" },
    { id:"s4", name:"chorus",     cycles:1, pads:true, bass:"simple",  drums:"full", melody:"composed", found:{sourceId:null,     role:"bed"}, fill:"off" },
    { id:"s5", name:"verse 2",    cycles:1, pads:true, bass:"walking", drums:"full", melody:"off",      found:{sourceId:"asakusa",role:"bed"}, fill:"off" },
    { id:"s6", name:"bridge",     cycles:1, pads:true, bass:"root",    drums:"off",  melody:"composed", found:{sourceId:"tokyo",  role:"bed"}, fill:"drum fill" },
    { id:"s7", name:"chorus 2",   cycles:1, pads:true, bass:"walking", drums:"full", melody:"composed", found:{sourceId:null,     role:"bed"}, fill:"off" },
    { id:"s8", name:"outro",      cycles:1, pads:true, bass:"off",     drums:"off",  melody:"off",      found:{sourceId:"tsukiji",role:"bed"}, fill:"off" },
  ];

  function defaultState(){
    return {
      bpm:88, keyOffset:0, progression:"royal_road", reverb:0.85, seed:1, swing:0, humanize:0,
      delay:{ beats:0.75, feedback:0.30, cutoff:2600 },
      instruments: defaultInstruments(),
      foundSources:[
        { id:"tokyo",   label:"Tokyo Station",   url:"https://archive.org/download/aporee_20938_24294/nov19tokyostation1934.ogg", pitch:0.78, stretch:0.45 },
        { id:"tsukiji", label:"Tsukiji Market",  url:"https://archive.org/download/aporee_35166_40406/201714020750tsukijifishmarket01.mp3", pitch:0.8, stretch:0.5 },
        { id:"asakusa", label:"Asakusa Noodles", url:"https://archive.org/download/aporee_21091_24510/nov92013asakusaNoodleSoupRest1910.mp3", pitch:0.72, stretch:0.45 }
      ],
      // fresh deep-copy each call: callers (render-sample-video, legacy A/B) mutate sections
      sections: JSON.parse(JSON.stringify(DEFAULT_SONG))
    };
  }

  // ---------- event generators ----------
  // bass patterns are 8-beat cells; chordEvery (cb) tiles them across the
  // chord bar (>8) or truncates (<8). cb=8 (every genre today) is one cell,
  // byte-identical to the pre-lane engine.
  function bassEvents(kind,S,b,k,rng,cb){
    cb=cb||CHORD_BEATS;
    const r5=pchAdd(b.r5,k), r6=pchAdd(b.r6,k), f6=pchAdd(b.f6,k);
    const cell=()=>{
    let L;
    switch(kind){
      case "root":       L=[[0,7.5,r5]]; break;
      case "octaves":    L=[[0,1,r5],[1,1,r6],[2,1,r5],[3,1,r6],[4,1,r5],[5,1,r6],[6,1,r5],[7,1,r6]]; break;
      case "sixteenths": L=[]; for(let i=0;i<16;i++) L.push([i*0.5,0.45,[r5,r6,f6,r6][i%4]]); break;
      case "dub":        L=[[2.5,1.0,r5],[3.5,0.5,r6],[6.5,1.0,r5],[7.5,0.5,f6]]; break;
      case "drive":      L=[]; for(let i=0;i<16;i++) L.push([i*0.5,0.42,r5]); break;   // straight 8ths on the root — the night-drive pulse
      case "rolling":    L=[]; for(let i=0;i<8;i++)  L.push([i+0.5,0.4,r5]);  break;   // offbeat 8ths — house/techno roll
      case "sub":        L=[[0,3.8,pchAdd(r5,-12)],[4,3.8,pchAdd(r5,-12)]];   break;   // long sub pressure — jungle/dub
      case "stab":       L=[[0,0.3,r5],[1.5,0.3,r6],[3,0.3,r5],[4.5,0.3,r6],[6,0.3,r5],[7,0.3,f6]]; break;   // syncopated stabs
      case "melodic": {  // generative: walks chord tones with approach/passing notes — never the same bar twice
        L=[]; const rr=rng||(()=>0.5); const tones=[r5,r6,f6,pchAdd(r5,3),pchAdd(r6,-2)];
        let t=0;
        while(t<7.5){
          const d=[0.5,0.5,1,1,1.5,2][Math.floor(rr()*6)];
          let p=tones[Math.floor(rr()*tones.length)];
          if(rr()<0.22) p=pchAdd(p, rr()<0.5?-1:2);
          if(rr()<0.12){ t+=d; continue; }                    // breathe
          L.push([t, Math.min(d,7.6-t)*0.9, p]); t+=d;
        } break; }
      case "walking":    L=[[0,1.0,r5],[1,0.5,r6],[1.5,0.5,f6],[2.5,0.5,r5],[3,1.0,r6],[4,0.5,r5],[4.5,0.5,f6],[5.5,0.5,r6],[6,1.0,r5],[7,0.5,r6],[7.5,0.5,f6]]; break;
      case "habanera":   L=[[0,1.4,r5],[1.5,0.5,f6],[2,1,r6],[3,1,r5],[4,1.4,r5],[5.5,0.5,f6],[6,1,r6],[7,1,f6]]; break;   // DUM..da-DUM-DUM ×2 — the tango/milonga cell IS the groove
      case "syncopated": // push-pull funk line: downbeat anchor, then off-beat pushes that land early
        L=[[0,0.7,r5],[1.5,0.45,r5],[2.5,0.7,r6],[3.75,0.45,r5],[4.5,0.7,r5],[5.75,0.45,f6],[6.5,0.7,r6],[7.25,0.45,r5]]; break;
      case "pedal":      // pedal-octave 8ths with chromatic passing tones into the bar turns
        L=[[0,0.42,r5],[0.5,0.42,r5],[1,0.42,r6],[1.5,0.42,r5],[2,0.42,r5],[2.5,0.42,r6],[3,0.42,r5],[3.5,0.42,pchAdd(r5,2)],
           [4,0.42,r5],[4.5,0.42,r5],[5,0.42,r6],[5.5,0.42,r5],[6,0.42,r5],[6.5,0.42,pchAdd(r6,-1)],[7,0.42,r6],[7.5,0.42,pchAdd(r5,-1)]]; break;
      default:           L=[[0,1.5,r5],[2,0.5,r6],[3,1.0,f6],[4.5,0.5,r5],[5,1.0,r6],[6.5,1.5,r5]];
    }
    return L;
    };
    const out=[];
    for(let t0=0;t0<cb;t0+=CHORD_BEATS)
      for(const [o,d,p] of cell()){ if(t0+o>cb) continue; out.push({voice:"bass",beat:S+t0+o,dur:d,pch:p,amp:0.22}); }
    return out;
  }
  // E(k,n,rot) — euclidean rhythm (Bjorklund/Toussaint): the Strudel bd(3,16)
  // notation as a KIT dimension (FAUST-PORT.md "Strudel borrowings"). Returns
  // beat offsets across the 8-beat chord bar. `rot` rotates by whole PULSES —
  // the downbeat always keeps a hit while the internal long/short spacing
  // shifts — so the placement evolves per chord, deterministically (no rng).
  function euclidBeats(k,n,rot,cb){
    n=Math.max(1,n|0); k=Math.max(1,Math.min(n,k|0));
    const steps=[]; for(let i=0;i<n;i++) if((i*k)%n < k) steps.push(i);
    const base=steps[(((rot||0)%steps.length)+steps.length)%steps.length];
    return steps.map(s=>((s-base+n)%n)*((cb||CHORD_BEATS)/n)).sort((a,b)=>a-b);
  }
  // ---------- pulse-set rhythm lanes (KERNEL-V4 Phase 1) ----------
  // The 18 procedural kit bodies are now DATA: each kit is an ordered list of
  // lane ops interpreted by drumEvents in op order. ORDER IS LAW: downstream
  // humanity/transform passes consume rng per event, so emission order and
  // rng-draw order are part of the deterministic contract — these tables
  // transcribe the old procedural kits hit-for-hit, draw-for-draw (pinned
  // byte-identical by fixtures.js). Euclid is no longer an overlay that fights
  // the kit: a state euclid spec is lane NOTATION that replaces the matching
  // lane inside the same interpreter (open hats survive as accent identity).
  //
  // Op vocabulary (d: kick|snare|hat; a hit is [offset, amp, dur?]; dur>0.2
  // voices a hat as OPEN, exactly like the old h() helper):
  //   hits:[...]            static hits
  //   alt:[A,B]             ci odd ? A : B      (the old ci%2 ternaries)
  //   cyc:[...]             hits list picked by ci % length
  //   last:[A,B]            last chord of the cycle ? A : B
  //   pick:[A,B]            ONE rng draw chooses A (r<.5) or B
  //   p:X                   whole-op gate: one rng draw, emit only if r<X
  //   grid:{n,step=.5,from=0,amps,opens,open,sp}
  //                         lane grid: offset=from+i*step, amp=amps[i%len];
  //                         opens:{offs,a,dur} re-voices those steps as open
  //                         hats; open:DUR makes EVERY step open; sp gates
  //                         each step on its own rng draw.
  //   ride:{n,amps,skipAmp} the shuffle pair-loop: h(i), h(i+skip) — the skip
  //                         lands ON the swung-triplet grid (see below)
  //   skip:true             every offset in this op adds the triplet skip
  // Kit flag turn:false suppresses the end-of-cycle snare turn (halftime/
  // tribal/bossa/shuffle keep their own cells clean, as before).
  const KITS={
    kick:{ ops:[
      {d:"kick",hits:[[0,.65],[4,.65]]},
      {d:"hat",hits:[[3.5,.1],[7.5,.1]]} ]},
    full:{ ops:[
      {d:"kick",hits:[[0,.65],[2.5,.38],[4,.65],[6.5,.38]]},
      {d:"snare",hits:[[2,.42],[6,.42]]},
      {d:"hat",grid:{n:8,step:1,from:.5,amps:[.13]}} ]},
    open:{ ops:[
      {d:"kick",hits:[[0,.65],[2.5,.38],[4,.65],[6.5,.38]]},
      {d:"snare",hits:[[2,.42],[6,.42],[3.5,.16],[7.5,.16]]},
      {d:"hat",grid:{n:8,step:1,from:.5,amps:[.13],opens:{offs:[3.5,7.5],a:.16,dur:.3}}} ]},
    four:{ ops:[
      {d:"kick",hits:[[0,.6],[2,.6],[4,.6],[6,.6]]},
      {d:"snare",hits:[[2,.4],[6,.4]]},
      {d:"hat",grid:{n:8,step:1,from:.5,amps:[.12]}} ]},
    boombap:{ ops:[
      {d:"kick",hits:[[0,.62],[3,.4],[4.5,.45]]},
      {d:"snare",hits:[[2,.5],[6,.5]]},
      {d:"hat",grid:{n:8,step:1,from:.5,amps:[.12,.08]}} ]},
    halftime:{ turn:false, ops:[
      {d:"kick",hits:[[0,.66]]},
      {d:"snare",hits:[[4,.55]]},
      {d:"hat",grid:{n:8,step:1,from:.5,amps:[.12]}} ]},
    trap:{ ops:[
      {d:"kick",hits:[[0,.6],[2.5,.45],[5,.45]]},
      {d:"snare",hits:[[4,.5]]},
      {d:"hat",grid:{n:16,amps:[.1]}},
      {d:"hat",hits:[[6,.09],[6.25,.09],[6.5,.09],[6.75,.09]]} ]},
    pulse:{ ops:[   // driving four with ghost snares + wandering push-kick; varies per chord
      {d:"kick",hits:[[0,.62],[2,.62],[4,.62],[6,.62]]},
      {d:"snare",hits:[[2,.5],[6,.5]]},
      {d:"snare",alt:[[[5.5,.14]],[[3.75,.14]]]},
      {d:"snare",last:[[[7.25,.11]],[[1.75,.11]]]},
      {d:"kick",alt:[[[7.75,.3]],[[3.5,.26]]]},
      {d:"hat",grid:{n:16,amps:[.13,.07],opens:{offs:[3.5,7.5],a:.16,dur:.3}}} ]},
    techno:{ ops:[   // machine four: offbeat opens, minimal snare, rotating ghost perc
      {d:"kick",hits:[[0,.66],[2,.66],[4,.66],[6,.66]]},
      {d:"hat",grid:{n:8,step:1,from:1,amps:[.17],open:.28}},       // offbeat open hats
      {d:"hat",grid:{n:16,amps:[.09,.05]}},                         // 16th ride bed
      {d:"snare",p:.7,hits:[[2,.22],[6,.22]]},                      // snare is optional color
      {d:"hat",cyc:[[[1.75,.2]],[[3.25,.2]],[[5.75,.2]],[[7.25,.2]]]},   // the rotating ghost
      {d:"kick",p:.35,hits:[[7.5,.3]]} ]},
    house:{ ops:[   // four + claps on 2/4, skipping hats
      {d:"kick",hits:[[0,.62],[2,.62],[4,.62],[6,.62]]},
      {d:"snare",hits:[[2,.46],[6,.46]]},                           // claps
      {d:"hat",grid:{n:16,amps:[.11,.06,.16,.06]}},
      {d:"hat",alt:[[[4.5,.18,.3]],[[0.5,.18,.3]]]},                // open hat skips around
      {d:"snare",alt:[[[7.75,.13]],[]]} ]},
    breaks:{ ops:[   // mid-tempo broken beat — displaced kicks, dragged snares
      {d:"kick",hits:[[0,.68]]},
      {d:"kick",alt:[[[2.75,.46]],[[2.5,.46]]]},
      {d:"kick",pick:[[[4.5,.5]],[[5,.5]]]},
      {d:"snare",hits:[[2,.38],[6,.38]]},
      {d:"snare",alt:[[[5.25,.13]],[[3.75,.13]]]},
      {d:"snare",p:.4,hits:[[7.5,.15]]},
      {d:"hat",grid:{n:8,step:1,from:.5,amps:[.13,.08]}},
      {d:"hat",alt:[[[6.5,.15,.3]],[[2.5,.15,.3]]]} ]},
    jungle:{ ops:[   // chopped-break feel: the pattern itself mutates every chord
      {d:"kick",hits:[[0,.68],[2.75,.5]]},
      {d:"kick",alt:[[[5.5,.52]],[[6.25,.46]]]},
      {d:"snare",hits:[[1.5,.32],[4,.35]]},                         // displaced backbeats
      {d:"snare",cyc:[[[3.25,.15],[3.5,.19]],[[5.75,.15],[6,.19]],[[7,.15],[7.25,.19]],[[2.25,.15],[6.75,.19]]]},   // double-hit chop pair
      {d:"snare",p:.5,hits:[[7.75,.22]]},                           // edge-of-bar push
      {d:"hat",grid:{n:16,amps:[.09,.05],sp:.55}},                  // broken 16th hats (sparser)
      {d:"hat",alt:[[[3.5,.13,.3]],[[7.5,.13,.3]]]} ]},
    tribal:{ turn:false, ops:[   // full ritual kit: galloping kicks, BUSY hand-hats + open-hat swells, quiet tom accents
      {d:"kick",hits:[[0,.66],[0.75,.32],[2,.5],[2.5,.28],[4,.62],[4.75,.32],[6,.5]]},   // dense galloping low toms
      {d:"snare",hits:[[1.5,.26],[5.5,.26]]},                       // toms = snare voice, kept QUIET
      {d:"snare",alt:[[[3.5,.18]],[[7,.18]]]},
      {d:"hat",grid:{n:16,amps:[.12,.05,.09,.05],opens:{offs:[3.5,7.5],a:.16,dur:.32}}},   // 16th hand-hat bed + open swells
      {d:"hat",cyc:[[[1.25,.13,.26]],[[3.25,.13,.26]],[[5.25,.13,.26]],[[7.25,.13,.26]]]},   // rotating ghost open-hat
      {d:"hat",alt:[[[2.75,.10]],[[6.25,.10]]]},                    // extra syncopated shaker
      {d:"kick",p:.5,hits:[[7.5,.32]]} ]},                          // occasional pickup kick
    bossa:{ turn:false, ops:[   // surdo-soft kick with pickups, rim-click clave, gentle 8th hats
      {d:"kick",hits:[[0,.55],[3.5,.28],[4,.55],[7.5,.28]]},
      {d:"snare",alt:[[[1,.2],[2.5,.2],[4,.2],[5.5,.2],[7,.2]],[[0.5,.2],[2,.2],[4.5,.2],[6,.2],[7.5,.2]]]},   // 3-2 / 2-3 rim clave flips per chord
      {d:"hat",grid:{n:8,step:1,from:.5,amps:[.11,.07]}},
      {d:"hat",p:.3,hits:[[6.5,.13,.28]]} ]},                       // occasional soft open shaker
    electro:{ ops:[   // 1982 machine boom-bap: syncopated 808 kicks, claps 2+4, crisp accented 16th hats
      {d:"kick",hits:[[0,.66],[3.5,.42],[6,.5]]},
      {d:"kick",alt:[[[7.5,.3]],[]]},
      {d:"snare",hits:[[2,.5],[6,.5]]},
      {d:"snare",p:.35,hits:[[7.75,.14]]},                          // clap ghosts push the bar
      {d:"hat",grid:{n:16,amps:[.11,.06,.14,.06]}},
      {d:"hat",alt:[[[3.5,.15,.28]],[[7.5,.15,.28]]]} ]},           // the open accent flips per chord
    shuffle:{ turn:false, ops:[   // blues shuffle: swung-TRIPLET ride line, rimshot-light 2/4, sparse kick.
      // The skip lands ON the triplet grid (beat + 2/3) scaled by state.swing —
      // at blues swing (.24-.42) it sits .63-.667 into the beat, a true shuffle.
      // These offbeats are NOT at f=0.5, so applyGroove never double-swings them.
      {d:"hat",ride:{n:8,amps:[.14,.11],skipAmp:.07}},              // ding ... ding-a ride
      {d:"snare",hits:[[2,.3],[6,.3]]},                             // light rim backbeat (brushes-soft)
      {d:"snare",skip:true,alt:[[[3,.09]],[[7,.09]]]},              // ghost drag into the turn
      {d:"kick",hits:[[0,.55],[4,.5]]},
      {d:"kick",p:.4,alt:[[[6,.3]],[[2,.3]]]},                      // sparse kick, occasional push
      {d:"hat",p:.3,skip:true,hits:[[7,.13,.3]]} ]},                // open let-ring into the next bar
    newjack:{ ops:[   // swingbeat: bouncing kicks, HUGE claps on 2/4, skippy 16th hats
      {d:"kick",hits:[[0,.64],[2.75,.4],[4.5,.5]]},
      {d:"kick",alt:[[[6.75,.34]],[[5.75,.34]]]},
      {d:"snare",hits:[[2,.58],[6,.58]]},
      {d:"snare",alt:[[[3.75,.16]],[[7.25,.16]]]},                  // ghost clap skips around
      {d:"hat",grid:{n:16,amps:[.12,.07],sp:.8}},                   // hats drop pulses — the skip
      {d:"hat",alt:[[[2.5,.16,.3]],[[6.5,.16,.3]]]} ]},
  };
  // Euclid lanes as DATA (KERNEL-V4 §3.1 — "euclid stops being an overlay that
  // fights the kit; it is the kit's notation"). A state.euclid spec
  // {kick:[k,n], hat:[k,n], snare:[k,n]} REPLACES that drum's kit lane with an
  // E(k,n) onset set (euclidBeats is the onset math). This table is the
  // notation: per euclid-able drum, the amp shape — `head` is the downbeat
  // accent (pulse j===0) when non-null, otherwise `amps` cycles by pulse index
  // j — and `keepOpen` says the kit's OPEN hats survive the replace (they're
  // the kit's accent identity; euclid re-places only the closed grid / the kick
  // / the clap line). Interpreted by the same k/s/h emit helpers as the kits.
  const EUCLID_LANES=[
    { drum:"kick",  keepOpen:false, head:.64, amps:[.48] },
    { drum:"hat",   keepOpen:true,  head:null, amps:[.12,.07] },   // closed 16th grid; opens survive
    { drum:"snare", keepOpen:false, head:.50, amps:[.36] },        // electro E(3,16) tresillo CLAPS
  ];
  const euclidAmp=(lane,j)=>(j===0&&lane.head!=null)?lane.head:lane.amps[j%lane.amps.length];
  // the ~40-line lane interpreter (replaces ~100 lines of per-kit JS).
  // cb = beats per chord bar (state.chordEvery; default CHORD_BEATS=8). Kits
  // are 8-beat cells: chordEvery>8 tiles the cell across the bar, <8 truncates
  // (draws still happen — determinism is draw-count law, emission is a filter).
  function drumEvents(kind,S,ci,nc,rng,eu,sw,cb){
    cb=cb||CHORD_BEATS;
    const R=rng||(()=>0.5);   // static kits never call R; conditional lanes vary per chord + seed
    const out=[];
    const k=(o,a)=>out.push({drum:"kick",beat:S+o,dur:0.35,amp:a});
    const s=(o,a)=>out.push({drum:"snare",beat:S+o,dur:0.30,amp:a});
    const h=(o,a,dur)=>out.push({drum:"hat",beat:S+o,dur:dur||0.10,amp:a,open:(dur||0)>0.2});
    const EM={kick:k,snare:s,hat:h};
    const kit=KITS[kind];
    if(kit){
      const skip=0.5+(2/3-0.5)*Math.max(0,Math.min(1,(sw||0)/0.3));
      for(let t0=0;t0<cb;t0+=CHORD_BEATS){
        for(const op of kit.ops){
          if(op.p!=null && R()>=op.p) continue;                     // whole-op gate: exactly one draw
          const em=EM[op.d];
          const put=(o,a,d)=>{ if(op.skip)o+=skip; if(t0+o<=cb) em(t0+o,a,d); };   // <=: legacy cells spill onto the next downbeat (techno opens end at o=8)
          if(op.ride){ const rd=op.ride;
            for(let i=0;i<rd.n;i++){ if(t0+i<=cb) em(t0+i, rd.amps[i%rd.amps.length]);
              if(t0+i+skip<=cb) em(t0+i+skip, rd.skipAmp); }
            continue; }
          if(op.grid){ const g=op.grid, st=g.step!=null?g.step:0.5, fr=g.from||0;
            for(let i=0;i<g.n;i++){
              if(g.sp!=null && R()>=g.sp) continue;                 // per-step gate: one draw per step
              const o=fr+i*st;
              if(g.open) put(o,g.amps[i%g.amps.length],g.open);
              else if(g.opens && g.opens.offs.indexOf(o)>=0) put(o,g.opens.a,g.opens.dur);
              else put(o,g.amps[i%g.amps.length]);
            }
            continue; }
          const hs = op.alt ? op.alt[ci%2?0:1]
                   : op.cyc ? op.cyc[ci%op.cyc.length]
                   : op.last ? op.last[ci===nc-1?0:1]
                   : op.pick ? op.pick[R()<0.5?0:1]
                   : op.hits;
          for(const hh of hs) put(hh[0],hh[1],hh[2]);
        }
      }
    }
    // euclid = lane NOTATION over the kit, driven by the EUCLID_LANES data table.
    // WHY THIS STAYS A ONCE-PER-BAR POST-PASS AND NOT AN INLINE OP (the one
    // justified-procedural remnant of kit-as-data): a euclid spec REPLACES an
    // already-emitted kit lane, and byte-identity pins three things an inline op
    // can't give — (a) it must preserve every kit rng draw for the lane it
    // shadows (the kit's p/sp/pick gates already fired in the op loop above, and
    // their draws are law even when their hits get replaced); (b) it drops only
    // CLOSED hats while keeping OPEN ones, a per-EVENT distinction an op-level
    // skip can't see; (c) its onsets must land at the END of `out` in
    // kick→hat→snare order (array order = downstream rng-draw order). All three
    // are naturally a filter-then-append over the finished kit output. Rotation
    // advances per global chord (gci) — DETERMINISTIC, no rng draw.
    if(eu&&kind!=="off"){
      const gci=Math.round(S/cb);
      for(const lane of EUCLID_LANES){
        const spec=eu[lane.drum];
        if(!spec||!spec.length) continue;
        for(let i=out.length-1;i>=0;i--)
          if(out[i].drum===lane.drum&&(!lane.keepOpen||!out[i].open)) out.splice(i,1);
        euclidBeats(spec[0],spec[1],gci,cb).forEach((o,j)=>EM[lane.drum](o,euclidAmp(lane,j)));
      }
    }
    if(ci===nc-1 && kind!=="off" && (!kit || kit.turn!==false)){   // end-of-cycle snare turn
      const tb=cb-CHORD_BEATS;
      [[6.5,.3],[7,.34],[7.25,.38],[7.5,.42],[7.75,.46]].forEach(([o,a])=>{ if(tb+o>=0) s(tb+o,a); });
    }
    return out;
  }
  function fillEvents(S){
    return [{drum:"snare",beat:S+0,dur:0.25,amp:0.34},{drum:"snare",beat:S+0.5,dur:0.25,amp:0.36},
      {drum:"snare",beat:S+1,dur:0.22,amp:0.40},{drum:"snare",beat:S+1.25,dur:0.20,amp:0.42},
      {drum:"snare",beat:S+1.5,dur:0.20,amp:0.45},{drum:"snare",beat:S+1.75,dur:0.20,amp:0.48},
      {drum:"kick",beat:S+0,dur:0.30,amp:0.55}];
  }
  // the big one — four beats, halves into quarters into a crescendo roll
  // ("In the Air Tonight" energy; crank instruments.drums.send to gate-wash it).
  // rng varies the roll (straight 16ths vs triplets) and adds flams, so no two
  // fills in a song are identical.
  function bigFillEvents(S,rng){
    const r=rng||Math.random;
    const out=[];
    // dur is always < the spacing so toms never overlap/stumble
    const t=(o,a,p,d)=>out.push({drum:"tom",beat:S+o,dur:d,amp:a,pitch:p});
    const k=(o,a)=>out.push({drum:"kick",beat:S+o,dur:0.4,amp:a});
    const s=(o,a)=>out.push({drum:"snare",beat:S+o,dur:0.3,amp:a});
    const T=[152,130,112,95,80,66];                        // deep toms, hi -> lo
    k(0,.6);
    const v=Math.floor(r()*4);                             // four variants -> each fill differs
    if(v===0){                                             // LINEAR snare<->tom 16ths, descending (Peart-ish)
      const seq=[1,0,2,0, 0,3,4,0, 2,3,0,4, 5,5,0,5];      // 0 = snare, else tom index
      for(let i=0;i<16;i++){ const o=i*0.25, x=seq[i];
        if(x===0) s(o,.5+r()*0.18); else t(o,.76+r()*0.14,T[x],0.2); }
      k(2,.5);
    } else if(v===1){                                      // tom doubles answered by snare, syncopated
      s(0,.6); t(0.5,.8,T[1],0.22); t(0.75,.8,T[2],0.22);
      s(1.25,.58); t(1.75,.82,T[3],0.22); t(2,.84,T[3],0.22);
      s(2.5,.6); t(2.75,.84,T[4],0.22); t(3,.86,T[4],0.2); t(3.25,.86,T[5],0.2); s(3.5,.6); t(3.75,.9,T[5],0.2);
      k(2,.45);
    } else if(v===2){                                      // triplet tom roll w/ snare accents
      const tr=2.0/3;
      for(let i=0;i<6;i++){ const o=i*tr; (i%3===0)?s(o,.6):t(o,.8+r()*0.1,T[Math.min(1+i,5)],tr*0.8); }
      for(let i=0;i<3;i++){ const o=2+i*tr; t(o,.84,T[Math.min(3+i,5)],tr*0.8); }
      s(3.34,.6); t(3.67,.9,T[5],0.2);
    } else {                                               // snare buzz building into a deep tom tumble
      let o=0,a=.34; while(o<1.75){ s(o,a); a=Math.min(.62,a+0.03); o+=0.25; }
      t(2,.8,T[1],0.22); s(2.25,.55); t(2.5,.82,T[2],0.22); t(2.75,.84,T[3],0.22);
      s(3,.6); t(3.25,.86,T[4],0.2); t(3.5,.88,T[5],0.2); t(3.75,.9,T[5],0.2);
    }
    k(3.75,.62);
    return out;
  }
  // snare-roll crescendo — a full bar of straight 16ths swelling into the next
  // downbeat (the march/big-band build; rng breathes the individual hit levels)
  function snareRollEvents(S,rng){
    const r=rng||Math.random, out=[];
    out.push({drum:"kick",beat:S,dur:0.3,amp:0.5});
    for(let i=0;i<16;i++) out.push({drum:"snare",beat:S+i*0.25,dur:0.16,amp:0.1+(i/16)*0.38+r()*0.04});
    out.push({drum:"kick",beat:S+3.75,dur:0.3,amp:0.6});
    return out;
  }
  // transition MICRO-LICK — the musical alternative to the noise sweep: a
  // 1-2 bar seeded pickup phrase (pentatonic climb, chromatic approach run,
  // enclosure turn…) that lands ON the next section's downbeat root, played
  // by state.lickVoice (a tiny sax/trombone/trumpet/flute/piano/guitar solo
  // voice the kernel assigns per genre). kNext = the NEXT section's key
  // (keyShift-aware) so the run resolves into the new key, not the old one.
  // The landing note may carry a blue-note bend (sampler voices slide in;
  // Faust-module voices ignore `bend` per the VOICES.md contract).
  function lickEvents(endBeat, chord, kNext, rng, lickVoice){
    const out=[];
    const minor=/min/.test(chord.name)&&!/maj/.test(chord.name);
    const tgt=pchAdd(chord.lead[0],kNext);         // the next downbeat's root
    const third=minor?3:4;
    const RUNS=[
      [-12,third-12,-5,-3,-1],                     // pentatonic climb into the root
      [-5,-4,-3,-2,-1],                            // chromatic approach run
      [third-12,-5,2,1],                           // enclosure turn (under, over, in)
      [7,third,2,-2],                              // fall from the fifth, slip under, resolve
      [-12,-10,-8,-7,-5,-3,-2,-1],                 // the long two-bar walkup
    ];
    const run=RUNS[Math.floor(rng()*RUNS.length)];
    const step=run.length>5?0.5:[0.5,0.5,0.75][Math.floor(rng()*3)];
    const start=endBeat-run.length*step;
    run.forEach((semi,i)=>{
      if(rng()<0.08&&i>0) return;                                  // licks breathe too
      out.push({voice:"melody",beat:start+i*step,dur:step*0.92,pch:pchAdd(tgt,semi),
        amp:0.14+0.05*(i/run.length)+rng()*0.015,solo:lickVoice});
    });
    const land={voice:"melody",beat:endBeat,dur:1.4,pch:tgt,amp:0.19,solo:lickVoice};
    if(rng()<0.45) land.bend={from:-(0.5+rng()*0.5),ms:Math.round(70+rng()*70)};
    out.push(land);
    return out;
  }
  // transition KIT FILL — a half-bar mini-fill that QUOTES the section's own
  // drum pattern (not generic toms): the kit's final two beats crescendo and
  // each hit may gain a double (ply of the pattern's own hits) into the turn.
  function miniFillEvents(drums, endBeat, rng){
    const from=endBeat-2, out=[];
    const win=drums.filter(d=>d.beat>=from&&d.beat<endBeat);
    if(!win.length) return;   // beatless section: silence IS the transition (no generic snares here)
    for(const d of win){
      const pos=(d.beat-from)/2;
      d.amp=Math.min(1,d.amp*(1+0.32*pos));                      // crescendo the quote itself (gentle — the QUOTE is the fill)
      if(rng()<0.6&&d.beat+0.25<endBeat)
        out.push(Object.assign({},d,{beat:d.beat+0.25,dur:Math.min(d.dur,0.14),
          amp:Math.min(1,d.amp*(0.5+0.25*pos)),open:false}));    // the double-hit echo
    }
    if(rng()<0.7) out.push({drum:"kick",beat:endBeat-0.25,dur:0.3,amp:0.42});  // pickup into the downbeat
    out.forEach(e=>drums.push(e));
  }
  // jungle-style chop fill — two beats of 32nd-flavored snare stutter
  function breakFillEvents(S,rng){
    const r=rng||Math.random, out=[];
    const s=(o,a)=>out.push({drum:"snare",beat:S+o,dur:0.18,amp:a});
    out.push({drum:"kick",beat:S+0,dur:0.3,amp:0.6});
    let o=0,a=0.17;
    while(o<2){ s(o,a); a=Math.min(0.4,a+0.03); o+=(r()<0.4?0.125:0.25); }
    return out;
  }
  // generative melody phrases: [beatOffset, dur, leadIndex, octaveShift] over an
  // 8-beat chord — each style has a distinct rhythm + contour (not just chord arps).
  const MEL_PHRASES={
    arpup:   [[0,1,0,0],[1,0.5,1,0],[1.5,0.5,2,0],[2,1,3,0],[3,1,2,0],[4,1,3,0],[5,1,0,1],[6,2,2,1]],
    arpdown: [[0,1.5,3,1],[1.5,0.5,2,1],[2,1,3,0],[3,1,2,0],[4,1,1,0],[5,1,2,0],[6,2,0,0]],
    updown:  [[0,1,0,0],[1,1,2,0],[2,1,3,0],[3,1,2,1],[4,1,3,0],[5,1,2,0],[6,1,1,0],[7,1,0,0]],
    pentaup: [[0,0.5,0,0],[0.5,0.5,2,0],[1,1,3,0],[2,0.5,1,1],[2.5,0.5,3,0],[3,1,0,1],[4.5,0.5,2,0],[5,1,3,0],[6,2,0,1]],
    // "hero" — 16th-note runs, syncopation, octave leaps; A/B variants alternate
    // per chord so the line evolves across the progression (supersaw fuel)
    hero:  [[0,.5,0,0],[.5,.5,1,0],[1,.5,2,0],[1.5,.5,3,0],[2,.75,2,1],[2.75,.25,3,0],[3,.5,1,0],[3.5,.5,2,0],[4,.5,3,1],[4.5,.5,2,0],[5,.75,0,1],[5.75,.25,3,0],[6,.5,2,0],[6.5,.5,1,0],[7,1,0,1]],
    // blues lick: leans on the b7 (idx 3 of a dom7 voicing) with swung phrasing
    blues: [[0,.75,3,0],[1,.25,2,0],[1.5,.5,3,0],[2,1.5,0,1],[4,.75,3,0],[5,.25,2,0],[5.5,.5,1,0],[6,1.75,0,0]],
    hero2: [[0,.25,3,0],[.25,.25,2,0],[.5,.5,3,0],[1,.5,2,1],[1.5,.5,1,0],[2,.5,2,0],[2.5,.5,3,0],[3,1,2,1],[4,.25,0,1],[4.25,.25,1,0],[4.5,.5,2,0],[5,.5,3,0],[5.5,.5,2,1],[6,.5,1,0],[6.5,.5,3,0],[7,.5,2,0],[7.5,.5,0,1]],
    // anthemic, hymn-like: fewer notes that work harder — dotted/syncopated rhythm,
    // held notes, octave-leap payoff, space. A/B alternate per chord for variation.
    anthem:  [[0,1.5,0,0],[1.5,.5,1,0],[2,1.5,3,0],[3.5,.5,2,0],[4,2,3,1],[6,1.5,0,1],[7.5,.5,2,0]],
    anthem2: [[0,2,2,0],[2,1,3,0],[3,1,2,0],[4,1.5,0,1],[5.5,.5,1,0],[6,2,3,0]]
  };
  // arpeggiation direction for the motorik sequencer — cycles as the song plays, advancing
  // each chord (gci). `random` is a deterministic shuffle seeded by gci so the main arp and
  // its counter (which plays the REVERSE = contrary motion) agree on the same base order.
  const ARP_DIRS=["up","down","updown","random","up","downup","down","random"];
  function arpDir(mode,gci){
    if(mode==="up") return [0,1,2,3];
    if(mode==="down") return [3,2,1,0];
    if(mode==="updown") return [0,1,2,3,2,1];
    if(mode==="downup") return [3,2,1,0,1,2];
    const s=mulberry32((0x9e3779b1 ^ (gci*2654435761))>>>0), a=[0,1,2,3];
    for(let i=3;i>0;i--){ const j=Math.floor(s()*(i+1)); const t=a[i]; a[i]=a[j]; a[j]=t; }
    return a;
  }
  // melody phrases are 8-beat cells too; with chordEvery (cb) ≠ 8 the phrase
  // takes the front of the chord bar (long harmony breathes) or truncates.
  // cb=8 (every genre today) is byte-identical to the pre-lane engine.
  function melodyEvents(style,base,prg,chords,k,rng,seed,cb){
    cb=cb||CHORD_BEATS;
    const out=[], cycleBeats=chords.length*cb;
    const comp = style==="composed"?prg.composed : style==="composed2"?prg.composed2 : null;
    if(comp && cycleBeats===32){
      comp.forEach(([o,d,p])=>{ if(rng()<0.06) return;            // composed lines breathe too
        out.push({voice:"melody",beat:base+o,dur:d,pch:pchAdd(p,k),amp:0.135+rng()*0.015}); });
      return out;
    }
    let gen=style; if(style==="composed"||style==="composed2") gen="arpup";
    chords.forEach((chord,ci)=>{
      const Sb=base+ci*cb, lead=chord.lead.map(p=>pchAdd(p,k));
        // humanity: every chord's phrase mutates a little — drops, pushes, octave color
      const note=(o,d,idx,oct,bd)=>{
        if(rng()<0.09) return;
        if(rng()<0.11 && o+0.5+d<=8) o+=0.5;
        if(rng()<0.09) oct=(oct||0)===0?1:0;
        if(o>=cb) return;                                          // chordEvery<8 truncation (never fires at cb=8)
        out.push({voice:"melody",beat:Sb+o,dur:d,pch:pchAdd(lead[idx],12*(oct||0)),amp:0.13+rng()*0.025,...(bd?{bend:bd}:{})});
      };
      if(gen==="canon"){
        // 2-voice counterpoint: the line + its echo two beats later, a chord tone lower
        const ph=MEL_PHRASES.updown;
        ph.forEach(([o,d,idx,oct])=>note(o,d,idx,oct));
        ph.forEach(([o,d,idx,oct])=>{ if(o+2+d<=8) note(o+2,d,Math.max(0,idx-1),(oct||0)-1); });
        return;
      }
      if(gen==="blues"){
        // CALL-AND-RESPONSE (2 bars call / 2 bars response across the 8-beat
        // chord): the call is the front half of the classic lick; the response
        // half either ANSWERS it — a seeded transposed/abbreviated variant, a
        // chord tone lower — or RESTS while the 78rpm singer takes those bars
        // (hits pattern "response" slots the vox there; the guitar answers the
        // singer on the next call). ~30-40% of notes gain a blue-note BEND
        // ({from:-(0.5..1) semitones, ms:60-140}), biased onto thirds/fifths —
        // only SAMPLER leads render the slide (VOICES.md contract).
        const gci=Math.round(Sb/cb);
        const cr=crStream(seed,gci);
        const rest=cr()<0.42;                              // draw #1 — the hits placer flips the same coin
        const bend=(idx)=>((idx===1||idx===2)?cr()<0.55:cr()<0.22)
          ? {from:-(0.5+cr()*0.5), ms:Math.round(60+cr()*80)} : null;
        const call=[[0,.75,3,0],[1,.25,2,0],[1.5,.5,3,0],[2,1.5,0,1]];
        call.forEach(([o,d,idx,oct])=>note(o,d,idx,oct,bend(idx)));
        if(!rest){                                         // (a) the answer: down a chord tone, abbreviated
          const drop=Math.floor(cr()*call.length);
          call.forEach(([o,d,idx,oct],j)=>{ if(j===drop) return;
            const ai=Math.max(0,idx-1);
            note(o+4,d*0.9,ai,0,bend(ai)); });
        }
        return;
      }
      if(gen==="hero"){ (ci%2?MEL_PHRASES.hero2:MEL_PHRASES.hero).forEach(([o,d,idx,oct])=>note(o,d,idx,oct)); return; }
      if(gen==="anthem"){ (ci%2?MEL_PHRASES.anthem2:MEL_PHRASES.anthem).forEach(([o,d,idx,oct])=>note(o,d,idx,oct)); return; }
      if(gen==="sparse"){ note(0,3,2,0); note(4,3,3,0);
        if(rng()<0.3) note(7,0.75,1,0);                               // occasional pickup into the next bar — sparse breathes across cycles
        return; }
      if(gen==="roar"){   // a creature bellow: one long held low note, sometimes a second answering call
        out.push({voice:"melody",beat:Sb,dur:5.0,pch:pchAdd(lead[0],-12),amp:0.17});
        if(rng()<0.55&&5.4<cb) out.push({voice:"melody",beat:Sb+5.4,dur:2.3,pch:pchAdd(lead[2],-12),amp:0.14});
        return; }
      if(gen==="double"){ // 8th-note double-time riff — ROTATES per chord (verbatim loops were the arp fatigue) + humanity drops/octave pops
        const pat=[0,1,2,3,0,1,2,3,1,2,3,0,2,3,0,1];
        const rot=(Math.round(Sb/cb)%4)*4;                            // pattern phase advances each chord/cycle
        for(let i=0;i<Math.round(cb*2);i++){
          if(rng()<0.07) continue;                                    // breathe
          let p=lead[pat[(i+rot)%16]];
          if(rng()<0.06) p=pchAdd(p,12);                              // octave pop
          out.push({voice:"melody",beat:Sb+i*0.5,dur:0.45,pch:p,amp:0.115+rng()*0.01});
        } return; }
      if(gen==="motorik"||gen==="motorik23"){
        // Kraftwerk sequencer, octave-INTERLEAVED — each cell note is followed half a step
        // later by the same note an octave up (note, note+8ve, next…), a relentless weaving arp.
        // The arpeggiation DIRECTION cycles as the song plays (up, down, up-down, random),
        // advancing each chord. `motorik23` is the COUNTER: 2/3 the speed and the MIRROR of the
        // main's direction, so as one arp climbs the other descends (contrary motion).
        const slow=gen==="motorik23";
        const gci=Math.round(Sb/cb);                                            // global chord index — the direction varies across the whole song
        const base=arpDir(ARP_DIRS[gci%ARP_DIRS.length], gci);
        const cell=slow?base.slice().reverse():base;                            // the counter mirrors the main = contrary motion
        const step=slow?0.75:0.5, n=Math.floor(cb/step);                        // EIGHTH notes (main), dotted-8th (counter at 2/3 speed)
        for(let i=0;i<n;i++){
          let p=lead[cell[i%cell.length]];
          if(i%2===1) p=pchAdd(p,12);                                           // octave weave on alternate 8ths (the Kraftwerk weave, now at 8th-note rate)
          out.push({voice:"melody",beat:Sb+i*step,dur:step*0.45,pch:p,amp:0.12});   // staccato — more bite
        }
        return;
      }
      if(gen==="arp16"){   // 16th-note arp that traces a MELODIC contour (not just the chord) — Edge-style
        const ext=[lead[0],lead[1],lead[2],lead[3],pchAdd(lead[0],12),pchAdd(lead[1],12),pchAdd(lead[2],12)];
        const motif=[0,2,4,5, 4,3,2,4, 5,4,2,3, 1,2,4,0];   // a rising-to-a-peak melodic figure, resolves
        for(let i=0;i<Math.round(cb*4);i++){ const p=ext[motif[i%16]];
          out.push({voice:"melody",beat:Sb+i*0.25,dur:0.24,pch:pchAdd(p,-12),amp:0.12});   // melodic arp, octave lower (main)
          out.push({voice:"melody",beat:Sb+i*0.25,dur:0.22,pch:p,amp:0.05}); }              // octave doubling
        return; }
      const ph=MEL_PHRASES[gen];
      if(ph){ ph.forEach(([o,d,idx,oct])=>note(o,d,idx,oct)); return; }
      // wander: rhythmic random walk over chord tones, occasional octave leap
      const span=Math.min(8,cb);
      const rh=[1,0.5,0.5,1,1,2]; let t=0,i=0,prev=Math.floor(rng()*4);
      while(t<span){ const d=rh[i%rh.length]; prev=Math.max(0,Math.min(3,prev+(Math.floor(rng()*3)-1))); note(t,Math.min(d,span-t)*0.92,prev,rng()<0.18?1:0); t+=d; i++; }
    });
    return out;
  }
  // ---------- unified time-feel (KERNEL-V4 Phase 3) ----------
  // Swing / humanize / rubato / push-pull were three unintegrated timing
  // systems (applyGroove's global swing+humanize, the rubato beat-warp, and the
  // shuffle kit's own triplet placement). They are now ONE dimension family,
  // resolved to a single spec by resolveTimeFeel and applied through two engine
  // stages that share that spec:
  //   grid stage  (applyGroove, below): grid-swing + per-voice push-pull +
  //               per-event humanize — the per-note warp, at the pre-`thunk`
  //               position (thunk lands WITH the humanized strike).
  //   section stage (the rubato beat-warp near the end of buildEvents): the
  //               smooth monotonic tempo breathing, applied last so every
  //               layer (found/sfx included) inherits one musical clock.
  // Swing is grid-parameterised (SWING_GRIDS): "8th" is the historical default
  // (the "&" at f=0.5, +sw*0.16) — grid was previously HARDCODED, the one bit
  // of "applyGroove special-casing" this phase deletes; "16th" swings the e/a
  // 16th-offbeats, "triplet" slides the "&" toward 2/3 (the generalised shuffle
  // — which is why the blues shuffle kit, already placing on the triplet grid,
  // keeps grid "8th" and is left untouched: no double-swing, no bespoke dance).
  // ABSENT state.timeFeel => grid "8th", no push-pull, humanize timing==level==
  // state.humanize — draw-for-draw and value-for-value identical to the old
  // applyGroove (fixtures.js pins it).
  const SWING_GRIDS={
    "8th":     { at:(f)=>Math.abs(f-0.5)<0.001, push:0.16 },
    "16th":    { at:(f)=>Math.abs(f-0.25)<0.001||Math.abs(f-0.75)<0.001, push:0.08 },
    "triplet": { at:(f)=>Math.abs(f-0.5)<0.001, push:(2/3-0.5) },   // full swing lands the "&" on 2/3
  };
  function resolveTimeFeel(state){
    const tf=state.timeFeel||{};
    const hz=state.humanize||0;
    const hum=tf.humanize||null;   // new anchors may split timing vs level; legacy scalar drives both
    return {
      swing:{ amount:state.swing||0, grid:(tf.grid&&SWING_GRIDS[tf.grid])?tf.grid:"8th" },
      humanize:{ timing:hum&&hum.timing!=null?hum.timing:hz, level:hum&&hum.level!=null?hum.level:hz },
      pushPull:(tf.pushPull&&Object.keys(tf.pushPull).length)?tf.pushPull:null,   // { voice|drum : ±beats } — laid-back bass / on-top hats
      rubato:(state.rubato&&state.rubato.depth>0)?state.rubato:null,
    };
  }
  // grid stage: grid-swing (no draw), then humanize (timing draw always, amp
  // draw only when e.amp!=null — the historical draw shape), then push-pull
  // (drawless per-voice offset). Called once per lane (pitched, then drums),
  // sharing one rng stream — draw ORDER is the byte-stability contract.
  function applyGroove(events, tfeel, rng){
    const sw=tfeel.swing.amount, grid=SWING_GRIDS[tfeel.swing.grid];
    const ht=tfeel.humanize.timing, hl=tfeel.humanize.level, pp=tfeel.pushPull;
    if(!sw && !ht && !hl && !pp) return;
    for(const e of events){
      let b=e.beat; const f=b-Math.floor(b);
      if(sw && grid.at(f)) b += sw*grid.push;
      if(ht||hl){ b += (rng()*2-1)*ht*0.04; if(e.amp!=null) e.amp=Math.max(0.01, e.amp*(1+(rng()*2-1)*hl*0.25)); }
      if(pp){ const o=pp[e.voice||e.drum]; if(o) b+=o; }
      e.beat=Math.max(0,b);
    }
  }

  // break-chop slice sequences: 16 8th-slots per chord, slice index 0-7 or -1 rest
  const BREAK_PATTERNS=[
    [0,1,2,3,4,5,6,7,0,1,2,3,4,5,6,7],
    [0,1,2,3,0,1,4,5,2,3,6,7,4,7,6,7],
    [0,2,1,3,4,4,6,7,0,2,1,3,7,6,5,4],
    [0,-1,2,-1,4,5,-1,7,0,-1,2,3,-1,5,6,7],
  ];
  const STAB_PATTERNS={ offbeat:[1.5,3.5,5.5,7.5], rave:[0,1.5,3,4.5,6,7], sparse:[3.5,7] };
  const HIT_PATTERNS={ sparse:[0], offbeat:[3.5], dub:[2.5,6.5], response:[4] };   // response: the vox takes the blues response bars the lead rests (crStream)

  // ---------- pattern-transform algebra (KERNEL-V4 Phase 2) ----------
  // The Strudel per-cycle transform pass is now a genre-addressable DIMENSION
  // (state.transforms) instead of a hardcoded switch. Each op is a lane-tagged
  // per-bar mutation over the {pitched, drums} fabric; a state's `transforms`
  // declares which ops are in the pool, how often they fire, and how they're
  // scheduled. buildEvents runs ONE generic pass (below); when state.transforms
  // is ABSENT it uses TF_DEFAULT_POOL at rate .25 — draw-for-draw identical to
  // the old switch (the 5 core ops in this exact order), pinned byte-stable by
  // fixtures.js. Blend (genre-kernel resolveMulti) = pool union + rate lerp.
  //   X = { b0, b1, cb, trng, pitched, drums, dropT }   (per-bar context)
  //   op.lane = the layer it touches (a genre's targets:{drums,melody,bass}
  //             gate can disable a lane; op body is skipped, draws still spent).
  const TRANSFORM_OPS={
    // rev: mirror the melody phrase in time within the bar (Strudel rev; solos exempt)
    rev:{ lane:"melody", fn(X){
      for(const e of X.pitched) if(e.voice==="melody"&&!e.solo&&e.beat>=X.b0&&e.beat<X.b1)
        e.beat=X.b0+Math.max(0, X.cb-((e.beat-X.b0)+Math.min(e.dur,X.cb))); } },
    // ply: double-hit one seeded beat of drums (Strudel ply 2)
    ply:{ lane:"drums", fn(X){
      const at=X.b0+Math.floor(X.trng()*X.cb), extra=[];
      for(const d of X.drums) if(d.beat>=at&&d.beat<at+1&&d.drum!=="tom")
        extra.push(Object.assign({},d,{beat:d.beat+0.25,dur:Math.min(d.dur,0.2),amp:d.amp*0.75}));
      extra.forEach(x=>X.drums.push(x)); } },
    // degrade: hats thin out hard this bar (Strudel degradeBy)
    degrade:{ lane:"drums", fn(X){
      for(const d of X.drums) if(d.drum==="hat"&&d.beat>=X.b0&&d.beat<X.b1&&X.trng()<0.45) X.dropT.add(d); } },
    // octflip: the whole bass bar jumps an octave
    octflip:{ lane:"bass", fn(X){
      for(const e of X.pitched) if(e.voice==="bass"&&e.beat>=X.b0&&e.beat<X.b1) e.pch=pchAdd(e.pch,12); } },
    // rest: the melody sits this bar out (silence is a choice; solos exempt)
    rest:{ lane:"melody", fn(X){
      for(const e of X.pitched) if(e.voice==="melody"&&!e.solo&&e.beat>=X.b0&&e.beat<X.b1) X.dropT.add(e); } },
    // --- Phase-2 additions: available to genres that opt into a richer pool ---
    // rot: rotate the CLOSED-hat lane within the bar by a seeded 1-3 beat shift
    //      (wrapping inside the bar) — displaces the ride, kick/snare stay put
    rot:{ lane:"drums", fn(X){
      const shift=1+Math.floor(X.trng()*3);
      for(const d of X.drums) if(d.drum==="hat"&&!d.open&&d.beat>=X.b0&&d.beat<X.b1)
        d.beat=X.b0+(((d.beat-X.b0)+shift)%X.cb); } },
    // stutter: retrigger the loudest drum of the bar's last beat as four 16ths
    //          (the braindance/breakcore machine-gun) — one seeded pick, ramped
    stutter:{ lane:"drums", fn(X){
      const from=X.b1-1; let proto=null;
      for(const d of X.drums) if(d.beat>=from&&d.beat<X.b1&&d.drum!=="tom"&&(!proto||d.amp>proto.amp)) proto=d;
      if(!proto) return;
      for(let i=0;i<4;i++) X.drums.push({drum:proto.drum,beat:from+i*0.25,dur:0.12,amp:Math.min(1,proto.amp*(0.6+0.12*i))}); } },
  };
  const TF_DEFAULT_POOL=["rev","ply","degrade","octflip","rest"];   // the historical global 5 (order = the old t=0..4 mapping)
  const STABLE_SECTION=/chorus|hook|drop|peak|refrain/i;            // formAware schedule: transforms rest on these (the section is the hook — leave it alone)

  function buildEvents(state){
    const prg=getProgression(state.progression);
    // KERNEL-V4 Phase 1: harmonic rhythm is a state dimension. chordEvery =
    // beats per chord bar (absent = the legacy CHORD_BEATS=8, byte-stable).
    const CBEATS=Math.max(2,Math.round(state.chordEvery||CHORD_BEATS));
    const chords=prg.chords, k0=state.keyOffset|0, cycleBeats=chords.length*CBEATS;
    const srcById={};
    state.foundSources.forEach((s,i)=>{ srcById[s.id]={id:s.id,tableNum:i+2,fsPath:s.fsPath||("found/"+s.id+".wav"),pitch:s.pitch??0.78,stretch:s.stretch??0.45,vol:s.vol??0.22,cutoff:s.cutoff??2600,bpm:s.bpm,durSec:s.durSec,wet:!!s.wet,glitch:!!s.glitch,distant:!!s.distant}; });
    const rng=mulberry32((state.seed??1)>>>0);
    let pitched=[], drums=[];
    const found=[], sfx=[], spans=[];   // spans: section extents for the per-bar transform pool
    let cur=0, narrOffset=0;   // narration plays through the clip across sections (always playing)
    for(const sec of state.sections){
      // THE 3-MINUTE RULE (sec.keyShift): a section may carry a semitone
      // shift on top of the global keyOffset — the kernel's evolution pass
      // modulates long tracks at section boundaries. Every pitched voice
      // (pads/bass/melody/counter/solos/stabs — synth, dx7 AND sampler) goes
      // through this k, so the whole band transposes together.
      const k=k0+(sec.keyShift|0);
      const fsrc = sec.found&&sec.found.sourceId ? srcById[sec.found.sourceId] : null;
      const cycles=sec.cycles||1, secBeats=cycles*cycleBeats;
      if(fsrc){
        const role=sec.found.role||"bed";
        if(role==="chops"){
          // rhythmic slice hits on a seeded 8th grid instead of one long bed
          for(let b=0;b<secBeats;b++){
            if(rng()<0.55) found.push({chop:1,beat:cur+b+(rng()<0.3?0.5:0),dur:0.35+rng()*0.5,
              amp:fsrc.vol*1.7,tableNum:fsrc.tableNum,pitch:fsrc.pitch,offset:rng(),cutoff:fsrc.cutoff});
          }
        } else if(role==="break"){
          // beat-synced break chopping: slice patterns rotate per chord, mutate per seed
          const sync=fsrc.bpm?state.bpm/fsrc.bpm:1;
          for(let cb=0;cb<secBeats/CBEATS;cb++){
            const pat=BREAK_PATTERNS[(cb+Math.floor(rng()*2))%BREAK_PATTERNS.length];
            for(let i8=0;i8<Math.round(CBEATS*2);i8++){
              let sl=pat[i8%16];
              if(sl<0||rng()<0.08) continue;
              if(rng()<0.1) sl=Math.floor(rng()*8);                  // surprise slice
              const beat=cur+cb*CBEATS+i8*0.5;
              found.push({chop:1,beat,dur:0.52,amp:fsrc.vol*2.1,tableNum:fsrc.tableNum,
                pitch:sync,offset:sl/8,cutoff:fsrc.cutoff||5000});
              if(rng()<0.07) found.push({chop:1,beat:beat+0.25,dur:0.26,amp:fsrc.vol*1.6,
                tableNum:fsrc.tableNum,pitch:sync,offset:sl/8,cutoff:fsrc.cutoff||5000});  // stutter
            }
          }
        } else if(role==="narration" && !sec.vox){
          // recognizable spoken Leacock — but NEVER over a synth voice (no overlay).
          // A chunk from a RANDOM point in the clip (picks more, varied), then glitched.
          const pit=0.94+(rng()*0.05-0.025);
          const cut=Math.round((fsrc.cutoff||3200)*(0.8+rng()*0.5));
          found.push({chop:1,beat:cur,dur:secBeats,amp:(fsrc.vol||0.3)*1.5,tableNum:fsrc.tableNum,
            pitch:pit,offset:rng()*0.5,cutoff:cut,rsend:0.4,dsend:0.3,fade:0.2});
          // glitch it: random stutter clusters across the section
          let gb=2+rng()*2;
          while(gb<secBeats-2){
            if(rng()<0.6){
              const off=rng(), n=2+Math.floor(rng()*4), step=[0.0625,0.125][Math.floor(rng()*2)];
              for(let j=0;j<n&&gb+j*step<secBeats-1;j++)
                found.push({chop:1,beat:cur+gb+j*step,dur:step*1.7,amp:(fsrc.vol||0.3)*1.3,tableNum:fsrc.tableNum,
                  pitch:[0.85,1,1,1.5][Math.floor(rng()*4)],offset:Math.min(0.98,off+j*0.03),cutoff:cut,rsend:0.4,dsend:0.45});
              gb+=n*step+1+rng()*2;
            } else gb+=1+rng()*1.5;
          }
        } else if(role==="narration"){
          // narration skipped here because a synth voice speaks this section
        } else {
          found.push({beat:cur,dur:secBeats,amp:fsrc.vol,tableNum:fsrc.tableNum,pitch:fsrc.pitch,stretch:fsrc.stretch,cutoff:fsrc.cutoff});
        }
      }
      // one-shot sample hits (stabs/shouts/vox) — separate layer from the bed/break
      if(sec.hits&&sec.hits.sourceId&&srcById[sec.hits.sourceId]){
        const hsrc=srcById[sec.hits.sourceId];
        if(hsrc.glitch){
          // the LOON, glitched a ton + faded in/out: long pitched swells (slow fade)
          // interleaved with rapid stutter clusters, all soaked in reverb + echo
          for(let cb=0;cb<secBeats/CBEATS;cb++){
            const base=cur+cb*CBEATS;
            if(rng()<0.6){                                            // a fading swell (gentle)
              found.push({chop:1,beat:base+rng()*3,dur:3+rng()*4,amp:(hsrc.vol||0.2)*1.4,tableNum:hsrc.tableNum,
                pitch:0.55+rng()*0.7,offset:rng(),cutoff:hsrc.cutoff||4500,rsend:0.32,dsend:0.3,fade:1+rng()*1.5});
            }
            if(rng()<0.6){                                           // a stutter cluster
              const off=rng(), n=2+Math.floor(rng()*4), step=[0.0625,0.125,0.1875][Math.floor(rng()*3)], sb=base+rng()*5;
              for(let j=0;j<n&&sb+j*step<base+CBEATS;j++)
                found.push({chop:1,beat:sb+j*step,dur:step*1.7,amp:(hsrc.vol||0.2)*1.3,tableNum:hsrc.tableNum,
                  pitch:[0.5,0.75,1,1.5,2][Math.floor(rng()*5)],offset:Math.min(0.98,off+j*0.05),cutoff:hsrc.cutoff||5500,rsend:0.3,dsend:0.3});
            }
          }
        } else {
        const pat=HIT_PATTERNS[sec.hits.pattern]||HIT_PATTERNS.sparse;
        const hdur=Math.min(4,(hsrc.durSec||1.2)*state.bpm/60);
        for(let cb=0;cb<secBeats/CBEATS;cb++){
          for(const o of pat){
            if(sec.hits.pattern==="response"){
              // response slotting: the singer ONLY takes the response bars the
              // blues lead rests (crStream draw #1 — the same seeded coin)
              if(crStream(state.seed,Math.round((cur+cb*CBEATS)/CBEATS))()>=0.42) continue;
            } else if(rng()<0.45) continue;                          // hits are events, not loops
            const ev={chop:1,beat:cur+cb*CBEATS+o,dur:hdur,amp:(hsrc.vol||0.2)*1.8,
              tableNum:hsrc.tableNum,pitch:1+(rng()*0.06-0.03),offset:0,cutoff:hsrc.cutoff||4500};
            if(hsrc.distant){ ev.amp*=0.32; ev.rsend=0.9; ev.dsend=0.72; ev.fade=0.4; }  // across the lake: way down, drenched, muffled
            else if(hsrc.wet){ ev.rsend=0.6; ev.dsend=0.45; }        // rides reverb + echo
            found.push(ev);
          }
        }
        }
      }
      // glitched paleontologist voiceover: the phrase plays, then gets stuttered /
      // pitch-jumped "like crazy" — instr 5 slice retriggers with random offset+rate.
      // RETAINED (found-handler retirement round): stations/horn/ding ported cleanly
      // to sampleEvents, but the glitched-narration idiom does NOT — its glitch is
      // an UPWARD-biased pitch set [.8,1,1,1.5] (not the downward stations/loon tail),
      // its burst count is gated by a per-line `clean` flag, each cluster lands at a
      // random in-section position, and the phrase length is min(secBeats-1,max(3,…))
      // not a chop cap. A faithful port would mean inventing a bespoke "narration"
      // placement that re-inlines this whole body — and, worse, this handler draws
      // the SHARED rng mid-section-loop, so removing it reshuffles the entire event
      // fabric of its three users (dinosynth/canawave/transitwave), all VIDEO_LOCKED
      // A-grade genres. Poor risk/reward; kept as the compat layer. (dinosynth also
      // has an ADDITIVE sampleEvents `response` layer over this — Phase 4.)
      if(sec.vox&&sec.vox.sourceId&&srcById[sec.vox.sourceId]){
        const vs=srcById[sec.vox.sourceId];
        const phraseBeats=Math.min(secBeats-1, Math.max(3,(vs.durSec||3)*state.bpm/60));
        // the phrase plays ONCE (no looping/double-speak), treated with reverb + delay
        found.push({chop:1,beat:cur+1,dur:phraseBeats,amp:(vs.vol||0.42),tableNum:vs.tableNum,
          pitch:vs.pitch||1,offset:0,cutoff:vs.cutoff||6500,rsend:0.32,dsend:0.26,fade:0.12});
        // glitch the voice: a couple of stutter clusters (more if it's the chopped poem)
        const nbursts=sec.vox.clean?1:2;
        for(let bi=0;bi<nbursts;bi++){
          if(rng()<0.85){
            const off=rng()*0.85, n=2+Math.floor(rng()*3), step=[0.0625,0.125][Math.floor(rng()*2)], b=1+rng()*Math.max(1,secBeats-4);
            for(let j=0;j<n&&b+j*step<secBeats-0.5;j++)
              found.push({chop:1,beat:cur+b+j*step,dur:step*1.6,amp:(vs.vol||0.42)*0.85,tableNum:vs.tableNum,
                pitch:[0.8,1,1,1.5][Math.floor(rng()*4)],offset:Math.min(0.98,off+j*0.03),cutoff:vs.cutoff||7000,rsend:0.35,dsend:0.4});
          }
        }
      }
      // the sung CHORUS: a pre-rendered WORLD-vocoder vocal (generated to match this bpm+key),
      // played once from the section downbeat at natural pitch, with space (reverb + delay).
      // RETAINED (found-handler retirement round): the PLACEMENT is a plain bed, but the
      // MECHANISM is three cross-cutting couplings the sampleEvents vocabulary can't hold:
      // (1) tw_vocal is a render-time SYNTHESIZED source (sing.py, generated per bpm+key),
      // carried as a foundSource with a `vocal:true` provider flag — not a pool id on disk;
      // (2) the kernel's evolution pass reads `s.vocal` to FORBID keyShift on the sung
      // section (canKey, genre-kernel ~L1997) — a fixed-pitch sample can't transpose with
      // the band; (3) the press guard strips tw_vocal + `s.vocal` when sing is unavailable.
      // Moving it to a spec would force the evolution pass + press guard to introspect
      // sampleEvents selectors to re-find the locked section — fragile, for no gain. Kept.
      if(sec.vocal&&srcById[sec.vocal]){
        const vc=srcById[sec.vocal], vdur=Math.min(secBeats-0.25,(vc.durSec||16)*state.bpm/60);
        found.push({chop:1,beat:cur+0.02,dur:vdur,amp:(vc.vol||0.5),tableNum:vc.tableNum,
          pitch:1,offset:0,cutoff:vc.cutoff||9000,rsend:0.34,dsend:0.2});
      }
      // (the bespoke door "ding ding" chime retired in the found-handler retirement
      //  round — now oneShot+cadence sampleEvents placements, see state.sampleEvents.)
      // synth stabs (rave chords on the chord root)
      if(sec.stab&&sec.stab!=="off"&&STAB_PATTERNS[sec.stab]){
        for(let cb=0;cb<secBeats/CBEATS;cb++){
          const chord=chords[cb%chords.length];
          for(const o of STAB_PATTERNS[sec.stab]){
            if(rng()<0.2) continue;
            sfx.push({stab:1,beat:cur+cb*CBEATS+o,dur:0.32,pch:pchAdd(chord.bass.r6,k+12),amp:0.16+rng()*0.05});
          }
        }
      }
      for(let c=0;c<cycles;c++){
        const cycleBase=cur+c*cycleBeats;
        chords.forEach((chord,ci)=>{
          const Sp=cycleBase+ci*CBEATS;
          if(sec.pads){ const padAmp=sec.swell ? 0.085*(0.5+1.9*((Sp-cur)/Math.max(1,secBeats))) : 0.085;
            chord.pads.forEach(p=>pitched.push({voice:"pad",beat:Sp,dur:CBEATS,pch:pchAdd(p,k),amp:padAmp})); }
          if(sec.bass&&sec.bass!=="off"){
            const be=bassEvents(sec.bass,Sp,chord.bass,k,rng,CBEATS);
            be.forEach(e=>{
              if(rng()<0.05) e.pch=pchAdd(e.pch,12);                  // octave pops
              if(rng()<0.06&&e.beat-Sp>0.4){ e.beat+=0.25; }          // lazy push
              if(rng()<0.05) return;                                  // rest
              pitched.push(e); });
          }
          if(sec.drums&&sec.drums!=="off"){
            let de=drumEvents(sec.drums,Sp,ci,chords.length,rng,state.euclid,state.swing,CBEATS);
            // humanity pass: hats drop out, levels breathe, ghost snares stay QUIET
            de=de.filter(e=>!(e.drum==="hat"&&rng()<0.09));
            de.forEach(e=>{ if(rng()<0.25) e.amp=Math.max(0.03,e.amp*(0.85+rng()*0.3)); });
            if(rng()<0.4) de.push({drum:"snare",beat:Sp+[1.75,3.25,5.75,6.75][Math.floor(rng()*4)],dur:0.15,amp:0.06+rng()*0.04});
            // evolution: later cycles of a section get busier (density rises with c)
            if(c>0&&rng()<Math.min(0.5,0.18*c)){
              de.push({drum:"hat",beat:Sp+Math.floor(rng()*16)*0.5,dur:0.08,amp:0.07+rng()*0.05});
              if(rng()<0.4) de.push({drum:"kick",beat:Sp+[3.5,7.5,5.75][Math.floor(rng()*3)],dur:0.3,amp:0.25+rng()*0.1});
            }
            de.forEach(e=>drums.push(e));
          }
        });
        if(sec.melody&&sec.melody!=="off"){
          const mel=melodyEvents(sec.melody,cycleBase,prg,chords,k,rng,state.seed,CBEATS);
          if(sec.solo) mel.forEach(e=>{ e.solo=sec.solo; if(sec.soloOctave) e.pch=pchAdd(e.pch,12*sec.soloOctave); });
          mel.forEach(e=>pitched.push(e));
        }
        if(sec.counter&&sec.counter.pattern){              // countermelody layer (e.g. a brass section) over the main melody
          const cm=melodyEvents(sec.counter.pattern,cycleBase,prg,chords,k,rng,state.seed,CBEATS);
          cm.forEach(e=>{ e.solo=sec.counter.solo; if(sec.counter.octave) e.pch=pchAdd(e.pch,12*sec.counter.octave);
            if(sec.swell) e.amp *= 0.3 + 1.9*((e.beat-cur)/Math.max(1,secBeats)); });   // crescendo build across the section
          cm.forEach(e=>pitched.push(e));
        }
      }
      // master filter sweep across this section
      if(sec.sweep==="open"){
        sfx.push({sweep:1,beat:cur,dur:secBeats,from:260,to:18000});
      } else if(sec.sweep==="close"){
        sfx.push({sweep:1,beat:cur,dur:secBeats,from:16000,to:380});
        sfx.push({sweep:1,beat:cur+secBeats,dur:0.05,from:21000,to:21000});   // the drop: snap open
      }
      // ⚡ transition into the next section
      const tr = sec.fill || (sec.fillInto ? "drum fill" : "off");
      if(tr==="drum fill"){
        fillEvents(cur+secBeats-2).forEach(e=>drums.push(e));
      } else if(tr==="tom fill"){
        bigFillEvents(cur+secBeats-4,rng).forEach(e=>drums.push(e));
      } else if(tr==="break fill"){
        breakFillEvents(cur+secBeats-2,rng).forEach(e=>drums.push(e));
      } else if(tr==="hat rush"){
        let o=0,st=0.5;
        while(o<2){ drums.push({drum:"hat",beat:cur+secBeats-2+o,dur:0.08,amp:0.08+o*0.06}); o+=st; st=Math.max(0.125,st*0.8); }
      } else if(tr==="cut"){
        const cutFrom=cur+secBeats-2;        // the cut: drums vanish, the drop hits harder
        for(let i=drums.length-1;i>=0;i--) if(drums[i].beat>=cutFrom&&drums[i].beat<cur+secBeats) drums.splice(i,1);
      } else if(tr==="snare roll"){
        snareRollEvents(cur+secBeats-4,rng).forEach(e=>drums.push(e));
      } else if(tr==="stutter"){
        // stutter-gate the last half-bar: existing hits are replaced by a 16th-grid
        // retrigger of the loudest survivor, amp ramping up into the downbeat
        const from=cur+secBeats-2, upto=cur+secBeats;
        let proto=null;
        for(let i=drums.length-1;i>=0;i--) if(drums[i].beat>=from&&drums[i].beat<upto){
          if(!proto||drums[i].amp>proto.amp) proto=drums[i];
          drums.splice(i,1);
        }
        const dr=proto?proto.drum:"snare";
        for(let i=0;i<8;i++) drums.push({drum:dr,beat:from+i*0.25,dur:0.12,amp:0.14+i*0.045+rng()*0.02});
      } else if(tr==="dropout"){
        // kick-drop silence: the final beat empties completely (drums AND any
        // pitched note that starts inside it) so the next downbeat slams
        const from=cur+secBeats-1, upto=cur+secBeats;
        for(let i=drums.length-1;i>=0;i--) if(drums[i].beat>=from&&drums[i].beat<upto) drums.splice(i,1);
        pitched=pitched.filter(e=>!(e.beat>=from&&e.beat<upto&&!e.solo));
      } else if(tr==="micro lick"){
        // the tiny soloist takes the turn — resolve into the NEXT section's key
        const nx=state.sections[state.sections.indexOf(sec)+1];
        const kNext=k0+((nx?nx.keyShift:sec.keyShift)|0);
        if(state.lickVoice) lickEvents(cur+secBeats, chords[0], kNext, rng, state.lickVoice).forEach(e=>pitched.push(e));
        else fillEvents(cur+secBeats-2).forEach(e=>drums.push(e));   // no lick voice in state: degrade musically
      } else if(tr==="kit fill"){
        miniFillEvents(drums, cur+secBeats, rng);
      } else if(SFX_NUM[tr]){
        const hit=(tr==="impact"||tr==="noise");
        const sbeat = hit ? cur+secBeats : cur+secBeats-4;   // hit on next downbeat; build in final bar
        // 2026-07: the sweep family is DEMOTED (-8dB; the loud noise build was
        // "very loud, very disruptive, overused") — impact keeps its slam.
        // 2026-07-04 human-calibrated law: "if you're going to use a filter
        // sweep over noise it must be much quieter and the filter must cut
        // very deeply" — a further ~-9dB here (0.16->0.055, 0.2->0.07) plus
        // the deep resonant filter ranges in faust/dsp/sfx.dsp.
        const amp = tr==="impact"?0.4 : (tr==="reverse"||tr==="downlift")?0.07 : 0.055;
        sfx.push({beat:Math.max(0,sbeat), dur:hit?1.5:4, type:SFX_NUM[tr], amp});
      }
      spans.push({start:cur,beats:secBeats,name:sec.name});
      cur+=secBeats;
    }
    // ---- pattern-transform algebra (KERNEL-V4 Phase 2) ----
    // ONE generic per-cycle pass over the transform pool (TRANSFORM_OPS above),
    // parameterised by state.transforms = { pool, rate, schedule, everyN,
    // targets }. Own rng stream (seed+31337) so the base fabric is untouched;
    // same seed -> same transforms. Applied ON TOP of the humanity rules, never
    // on the first bar of a section. ABSENT transforms = TF_DEFAULT_POOL @ .25,
    // the historical global switch draw-for-draw (fixtures.js pins it).
    //   schedule "prob"      (default): each non-first bar fires with prob `rate`
    //   schedule "everyN"    : fire on bars where bi % everyN === 0 (sparse, no
    //                          rate draw — minimal's "one mutation every 8 bars")
    //   schedule "formAware" : like prob, but STABLE sections (the hook/chorus)
    //                          are left untouched — mutate the verses, hold the drop
    {
      const tf=state.transforms;
      const pool=(tf&&tf.pool&&tf.pool.length)?tf.pool:TF_DEFAULT_POOL;
      const rate=(tf&&tf.rate!=null)?tf.rate:0.25;
      const sched=(tf&&tf.schedule)||"prob";
      const everyN=Math.max(1,(tf&&tf.everyN)||8);
      const targets=(tf&&tf.targets)||null;
      const trng=mulberry32(((state.seed??1)+31337)>>>0);
      const dropT=new Set();
      const X={ b0:0, b1:0, cb:CBEATS, trng, pitched, drums, dropT };
      for(const sp of spans){
        const nbars=Math.floor(sp.beats/CBEATS);
        const stable=sched==="formAware"&&STABLE_SECTION.test(sp.name||"");
        for(let bi=1;bi<nbars;bi++){
          if(sched==="everyN"){ if(bi%everyN!==0) continue; }
          else { if(stable) continue; if(trng()>=rate) continue; }
          X.b0=sp.start+bi*CBEATS; X.b1=X.b0+CBEATS;
          const op=TRANSFORM_OPS[pool[Math.floor(trng()*pool.length)]];
          if(op && (!targets || targets[op.lane]!==false)) op.fn(X);
        }
      }
      if(dropT.size){ pitched=pitched.filter(e=>!dropT.has(e)); drums=drums.filter(e=>!dropT.has(e)); }
    }
    // ---- jux stereo divergence (production dimension; state.jux in [0,1]) ----
    // Events gain a `pan` offset in [-1,1] (absent/0 = center). Engines MAY
    // ignore it: the Faust engine reads it; the legacy csound path renders
    // center-summed exactly as before. Hats alternate L/R, toms spread by
    // pitch, melody alternates sides, pads scatter; kick/snare/bass stay
    // center (the low end never leaves the middle).
    {
      const jux=Math.min(1,Math.max(0,state.jux||0));
      if(jux>0){
        const jrng=mulberry32(((state.seed??1)+424242)>>>0);
        let hi=0, mi=0;
        for(const d of drums){
          if(d.drum==="hat") d.pan=+(((hi++%2)?0.4:-0.4)*jux).toFixed(3);
          else if(d.drum==="tom") d.pan=+((((d.pitch||100)-100)/100)*jux).toFixed(3);
        }
        for(const e of pitched){
          if(e.voice==="melody") e.pan=+((((mi++%2)?0.35:-0.35)*(0.6+0.4*jrng()))*jux).toFixed(3);
          else if(e.voice==="pad") e.pan=+(((jrng()*2-1)*0.5)*jux).toFixed(3);
        }
      }
    }
    const grng=mulberry32(((state.seed??1)+777)>>>0);
    const tfeel=resolveTimeFeel(state);   // KERNEL-V4 Phase 3: one resolved time-feel spec for both stages
    applyGroove(pitched, tfeel, grng);
    applyGroove(drums,   tfeel, grng);
    // ---- MECHANICAL INTIMACY (state.thunk = {prob, amp}) ----
    // Soft key/pedal noise on a fraction of LEAD notes: a whisper-level tom
    // "thump" (pitch 90-160Hz, amp ~-30dB) exactly at the grooved note onset
    // (after applyGroove so the thunk lands WITH the humanized key strike).
    // Own rng stream; states without thunk skip entirely (zero change).
    if(state.thunk&&state.thunk.prob>0){
      const trng=mulberry32(((state.seed??1)+8181)>>>0);
      for(const e of pitched){
        if(e.voice!=="melody"||e.solo) continue;
        if(trng()<state.thunk.prob)
          drums.push({drum:"tom",beat:e.beat,dur:0.09,amp:(state.thunk.amp||0.03)*(0.8+0.4*trng()),pitch:90+Math.round(trng()*70)});
      }
    }
    // feed individual snare hits to the long ping-pong delay — the classic dusty
    // snare THROW that tails across the bar. Liberality scales with the send
    // amount: a genre that wants a wetter throw (snarePP>=.65) wants it thrown
    // MORE often and closer together (>=2 beats, prob .82 — most backbeats echo);
    // the moderate legacy send (transitwave .6, the sparse motorik ding under a
    // PA) keeps its untouched >=4-beat/.6 spacing. grng is TERMINAL here (no
    // downstream consumer — see line 1217), so the extra draws tag only WHICH
    // snares echo; no other rng stream shifts (only the snare pp field drifts).
    if(state.snarePP>0){ let last=-99;
      const lib=state.snarePP>=0.65, gap=lib?2:4, prob=lib?0.82:0.6;   // liberal throw for the high-send dusty genres; low users untouched
      for(const d of drums){ if(d.drum==="snare" && d.beat-last>=gap && grng()<prob){ d.pp=state.snarePP; last=d.beat; } } }
    // ---- ACID accent/slide (the tb303 voice) ----
    // The 303's two per-note behaviors, tagged onto the bass notes: ACCENT
    // (louder + squelchier — its own env in the module) and SLIDE (legato glide
    // INTO this note from the previous one; the mono-legato scheduler holds the
    // gate when the notes are close). ONLY the tb303 bass module reads accent/
    // slide — bass_acid and every other voice ignore them — so this tags nothing
    // audible elsewhere, and its OWN rng stream (seeded off state.seed) leaves
    // every existing render byte-identical.
    if((state.instruments&&state.instruments.bass&&state.instruments.bass.model)==="tb303"){
      const arng=mulberry32(((state.seed??1)+3030)>>>0);
      const bassN=pitched.filter(e=>e.voice==="bass").sort((a,b)=>a.beat-b.beat);
      for(let i=0;i<bassN.length;i++){
        const e=bassN[i], prev=bassN[i-1];
        e.accent = arng()<0.34 ? +(0.7+0.3*arng()).toFixed(3) : 0;            // ~1/3 of steps accented
        const gap = prev ? (e.beat-(prev.beat+(prev.dur||0))) : 99;           // note-off -> next-on, in beats
        e.slide = (prev && gap<0.3 && arng()<0.45) ? +(0.55+0.45*arng()).toFixed(3) : 0;  // glide into legato-close steps
      }
    }
    // (the bespoke every-measure `stationPool` litany retired in the found-handler
    //  retirement round — it is now a `buried` sampleEvents placement, below.)
    // ---- generalized SAMPLE-EVENT ROLES (KERNEL-V4 Phase 4) ----
    // bed/chops/break/hits/vox/horn/ding/stations/vocal were each a bespoke
    // SAMPLE placement wired through the whole stack (the handlers above +
    // stationPool). state.sampleEvents is the ONE dimension that generalizes
    // them: an array of role specs, each a POOL of source ids + a PLACEMENT
    // algorithm + a section filter + treatment. This pass emits the SAME
    // `found` event shapes the bed/chop handlers already emit (see
    // faust/state-engine.js §found — {chop,beat,dur,amp,tableNum,pitch,offset,
    // cutoff,rsend,dsend,ppsend,fade,sqRate,sqDepth} for hits/slices, and
    // {beat,dur,amp,tableNum,pitch,stretch,cutoff} for beds), so the Faust
    // voice layer renders them with ZERO engine-side change. Placed BEFORE the
    // rubato warp so its events inherit the same musical clock as every other
    // layer. Own rng stream (seed+9091) so an adopting genre perturbs nothing
    // but its own new layer; ABSENT/empty state.sampleEvents => the pass never
    // runs => byte-identical (fixtures.js pins it). The transitwave inventions
    // (opener horn, sectionEdge ding, buried station litany) are now
    // catalog-wide vocabulary any genre can request.
    //   spec = { pool:[srcId...], placement, sync, sections, treatment, gain, prob }
    //   placement  bed      one sustained source spanning each matching section
    //              slice    beat-synced chop hits across the section (chops role)
    //              oneShot  one chop at each matching section's downbeat
    //              opener   oneShot on the FIRST matching section only (goal horn)
    //              cadence  oneShot at each matching section's END (door "ding")
    //              buried   one source under every measure, rotating (stations)
    //              response one source on the ANSWER half of each chord bar (the
    //                       blues 78rpm call-and-response / thunk "answer the
    //                       lead" idea, generalized to bar granularity)
    //   sections   "all" | "first" | "quiet"(no drums) | <regex string on name>
    //   treatment  pitch,stretch,cutoff,rsend,dsend,ppsend,fade,sqRate,sqDepth,
    //              maxDur (one-shot length cap in beats; default 4),
    //              vol (amp base override, replaces the source's own vol),
    //              glitch(bool) — the narration/loon stutter-down tail — and
    //              glitchBursts (shot-glitch cluster count, the vox clean=1/
    //              chopped=2 idiom; buried glitch is the fixed stations tail)
    //   gain       amp multiplier over the source's vol; prob per-placement gate
    if(Array.isArray(state.sampleEvents) && state.sampleEvents.length){
      const serng=mulberry32(((state.seed??1)+9091)>>>0);
      const secs=state.sections||[];
      const matchSec=(sel,i,sec)=>{
        if(!sel||sel==="all") return true;
        if(sel==="first") return i===0;
        if(sel==="quiet") return !sec.drums||sec.drums==="off";
        // typed-node selector (Phase 5): "tag:peak" or "tag:peak,cadence" —
        // matches the section's form-graph node type, resilient to renames.
        if(sel.slice(0,4)==="tag:"){
          const want=sel.slice(4).split(",").map(s=>s.trim()).filter(Boolean);
          return want.includes(sec.tag||sectionTag(sec.name));
        }
        try{ return new RegExp(sel,"i").test(sec.name||""); }catch(e){ return (sec.name||"")===sel; }
      };
      for(const spec of state.sampleEvents){
        const pool=(spec.pool||[]).map(id=>srcById[id]).filter(Boolean);
        if(!pool.length) continue;
        const tr=spec.treatment||{}, gain=spec.gain!=null?spec.gain:1, prob=spec.prob!=null?spec.prob:1;
        const place=spec.placement||"oneShot", sync=spec.sync||null;
        // treatment.vol OVERRIDES the source's own vol as the amp base (zero-rng;
        // absent => the source's vol, i.e. every pre-existing spec byte-identical).
        // Needed because sampleEvents pool ids ride foundSources at a generic vol
        // (toState); a station litany wants its own stationVol, a filtered horn its
        // own gain — expressed here rather than through a per-id foundSource vol.
        const vbase=(src,dflt)=>tr.vol!=null?tr.vol:(src.vol||dflt);
        // seeded pool rotation — each source used once before any repeat (stations law)
        const order=pool.slice();
        for(let i=order.length-1;i>0;i--){ const j=Math.floor(serng()*(i+1)); const t=order[i]; order[i]=order[j]; order[j]=t; }
        let pi=0; const nextSrc=()=>order[pi++%order.length];
        // one-shot length = the source clip in beats, capped (treatment.maxDur
        // shortens the cap for a tight chime like the door "ding"; default 4)
        const chopDur=(src)=>Math.min(tr.maxDur!=null?tr.maxDur:4,(src.durSec||1.2)*state.bpm/60);
        // dress a base found-event with the spec's treatment
        const dress=(ev,src)=>{
          ev.tableNum=src.tableNum;
          ev.cutoff=tr.cutoff!=null?tr.cutoff:(src.cutoff||3500);
          if(tr.rsend!=null) ev.rsend=tr.rsend;
          if(tr.dsend!=null) ev.dsend=tr.dsend;
          if(tr.ppsend!=null) ev.ppsend=tr.ppsend;
          if(tr.fade!=null) ev.fade=tr.fade;
          if(tr.sqRate!=null) ev.sqRate=tr.sqRate;
          if(tr.sqDepth!=null) ev.sqDepth=tr.sqDepth;
          return ev;
        };
        const shot=(src,beat)=>{
          found.push(dress({chop:1,beat,dur:chopDur(src),amp:vbase(src,0.3)*gain,
            pitch:tr.pitch!=null?tr.pitch:1,offset:0},src));
          if(tr.glitch){                                             // downward stutter tail (narration/loon idiom)
            // treatment.glitchBursts (default 1): the narration VO fires 1-2 stutter
            // CLUSTERS each ~85% (the old vox handler's clean=1 / chopped=2 shape);
            // a plain 1-burst glitch reproduces the loon/response tail unchanged.
            const bursts=tr.glitchBursts!=null?tr.glitchBursts:1;
            for(let bi=0;bi<bursts;bi++){
              if(bursts>1 && serng()>=0.85) continue;               // each cluster fires ~85% (vox idiom)
              const base=bursts>1 ? beat+serng()*Math.max(1,chopDur(src)) : beat+chopDur(src)*0.5;
              const n=2+Math.floor(serng()*3), step=0.125;
              for(let j=0;j<n;j++) found.push(dress({chop:1,beat:base+j*step,dur:step*1.6,
                amp:vbase(src,0.3)*gain*0.8,pitch:[0.5,0.6,0.7,0.8][Math.floor(serng()*4)],
                offset:Math.min(0.9,serng()*0.5)},src));
            }
          }
        };
        let firstDone=false;
        for(let si=0;si<spans.length;si++){
          const sp=spans[si], sec=secs[si]||{};
          if(!matchSec(spec.sections,si,sec)) continue;
          const S=sp.start, B=sp.beats;
          if(place==="bed"){
            if(prob>=1||serng()<prob){ const src=nextSrc();
              found.push(dress({beat:S,dur:B,amp:vbase(src,0.22)*gain,
                pitch:tr.pitch!=null?tr.pitch:(src.pitch??0.78),
                stretch:tr.stretch!=null?tr.stretch:(src.stretch??0.45)},src)); }
          } else if(place==="slice"){
            for(let b=0;b<B;b++){ if(serng()>=(prob<1?prob:0.55)) continue;
              const src=nextSrc();
              found.push(dress({chop:1,beat:S+b+(serng()<0.3?0.5:0),dur:0.35+serng()*0.5,
                amp:vbase(src,0.3)*1.6*gain,pitch:tr.pitch!=null?tr.pitch:(src.pitch??1),
                offset:serng()},src)); }
          } else if(place==="opener"){
            if(firstDone) continue; firstDone=true;
            if(prob>=1||serng()<prob) shot(nextSrc(),S+0.25);
          } else if(place==="oneShot"){
            if(prob>=1||serng()<prob){ const src=nextSrc();
              shot(src, sync==="sectionEdge"?Math.max(S,S+B-chopDur(src)-0.5):S+0.25); }
          } else if(place==="cadence"){
            if(prob>=1||serng()<prob){ const src=nextSrc();
              shot(src, Math.max(S,S+B-chopDur(src)-0.5)); }
          } else if(place==="buried"){
            // the world-metro station litany: one name under every measure (4 beats),
            // rotating, square-LFO amplitude-gated at varying intensity; with
            // treatment.glitch the name is chased ~70% by a mostly-DOWNWARD stutter
            // tail (2-3 hits at .5-.8 pitch) — the exact bespoke `stations` shape.
            // treatment.every (measures between drops, default 1) and treatment.
            // maxDur (beat cap, default the historical 2.6) are zero-rng opt-ins:
            // absent => byte-identical. hogcore's full "<name> is trans" phrases
            // (up to 2.61s > one 150-164bpm bar) ride every:2 + maxDur:8 so the
            // whole phrase lands before the next name starts.
            for(let b=0;b<B-2;b+=4*(tr.every||1)){                   // one under every `every` measures
              if(prob<1&&serng()>=prob) continue;
              const src=nextSrc(), sqd=[0.3,0.55,0.75,0.92][Math.floor(serng()*4)], sqr=[3,5,8,12][Math.floor(serng()*4)];
              found.push(dress({chop:1,beat:S+b+0.5,dur:Math.min(tr.maxDur!=null?tr.maxDur:2.6,(src.durSec||1)*state.bpm/60),
                amp:vbase(src,0.26)*gain,pitch:tr.pitch!=null?tr.pitch:1,offset:0,
                rsend:tr.rsend!=null?tr.rsend:0.3,dsend:tr.dsend!=null?tr.dsend:0.22,
                sqRate:tr.sqRate!=null?tr.sqRate:sqr,sqDepth:tr.sqDepth!=null?tr.sqDepth:sqd},src));
              if(tr.glitch&&serng()<0.7){                            // glitch mostly DOWNWARD
                const nb=2+Math.floor(serng()*2), stp=0.125;
                for(let j=0;j<nb;j++) found.push(dress({chop:1,beat:S+b+0.85+j*stp,dur:stp*1.5,
                  amp:vbase(src,0.12)*gain*0.8,pitch:[0.5,0.6,0.7,0.8][Math.floor(serng()*4)],
                  offset:Math.min(0.9,serng()*0.5),rsend:0.3,dsend:0.3},src)); }
            }
          } else if(place==="response"){
            const nbars=Math.max(1,Math.round(B/CBEATS));
            for(let bar=0;bar<nbars;bar++){ if(prob<1&&serng()>=prob) continue;
              shot(nextSrc(), S+bar*CBEATS+CBEATS/2); }
          }
        }
      }
    }
    // ---- RUBATO — the SECTION stage of the unified time-feel (Phase 3) ----
    // (state.rubato = {depth, periodBars, phase}; resolved into tfeel.rubato)
    // Deterministic slow breathing of tempo, implemented ONCE here as a
    // smooth monotonic BEAT-WARP so every consumer (faust press, faust live,
    // midi-export — anything that maps beat -> time linearly with spb)
    // inherits the exact same musical clock and all layers stay sample-locked
    // BY CONSTRUCTION (the drift-gate invariant: same beat => same time).
    //   tempo(b)/tempo0 = 1 + depth·cos(2πb/P + φ)
    //   warp(b) = b + A·(sin(2πb/P + φ) − sin φ),  A = depth·P/2π
    // P = periodBars·4 beats; warp(0)=0 (the first downbeat holds), |Δ| ≤ 2A,
    // strictly monotonic for depth < 1. Durations warp as intervals so legato
    // stays legato. depth .02-.04 ≈ ±2-4% tempo sway over 2-4 bars.
    // Live note: the live engine rebuilds per chord-bar with cycle-local
    // beats, so the breathing phase restarts each section cycle — still
    // deterministic, still layer-locked (documented in faust/VOICES.md).
    if(tfeel.rubato){
      const rb=tfeel.rubato;
      const dep=Math.min(0.2,rb.depth), P=Math.max(4,(rb.periodBars||3)*4);
      const ph=2*Math.PI*(rb.phase||0), A=dep*P/(2*Math.PI);
      const W=(b)=>b + A*(Math.sin(2*Math.PI*b/P+ph)-Math.sin(ph));
      for(const arr of [pitched,drums,found,sfx]) for(const e of arr){
        const d0=e.dur||0, b1=W(e.beat+d0);
        e.beat=W(e.beat); if(d0) e.dur=Math.max(0.02,b1-e.beat);
      }
    }
    return { bpm:state.bpm, totalBeats:cur+8, pitched, drums, found, sfx, srcById };
  }

  // ---------- solo voices (deterministic per-section recipes) ----------
  // (The csound orchestra/codegen that used to live here — waveRHS through
  //  buildCsd/liveParts — is preserved on branch legacy-csound. The Faust
  //  engine consumes buildEvents + these solo-voice assignments directly.)
  // Per-section solo voices: any section with a `solo` recipe gets its own melody
  // instrument (instr 7,8,…) so different "dinosaurs" / a fuzz guitar can each take
  // a section. Deterministic from state.sections so codegen + score routing agree.
  function soloVoices(state, baseMel){
    const out=[], seen=new Map(); let num=7;
    baseMel = baseMel || (state.instruments&&state.instruments.melody) || defaultInstruments().melody;
    for(const s of (state.sections||[])){
      for(const recipe of [s.solo, s.counter&&s.counter.solo]){   // solo voices + countermelody voices
        if(!recipe) continue;
        const key=JSON.stringify(recipe);
        if(seen.has(key)) continue;
        seen.set(key,num);
        out.push({ key, num, recipe:Object.assign({}, baseMel, recipe) });
        num++;
      }
    }
    // the transition micro-lick soloist (state.lickVoice): a first-class solo
    // voice so every engine allocates it exactly like section solos. The
    // recipe should carry explicit model/sampler/dx7 keys — it merges over
    // the melody recipe, which may itself be a dx7/sampler voice.
    if(state.lickVoice){
      const key=JSON.stringify(state.lickVoice);
      if(!seen.has(key)) out.push({ key, num:num++, recipe:Object.assign({}, baseMel, state.lickVoice) });
    }
    return out;
  }
  const api={ buildEvents, defaultState, defaultInstruments, voicing, soloVoices, euclidBeats,
    KITS,   // pulse-set kit lanes (KERNEL-V4 Phase 1): kits are data; drumEvents is the one interpreter
    sectionTag,   // form-graph typed-node classifier (Phase 5)
    PROGRESSIONS, getProgression, WAVES, BASS_PATTERNS, MELODY_PATTERNS, DRUM_PATTERNS, TRANSITIONS,
    isModel, SOURCE_CLASS, sourceClassOf, pchAdd, pchToMidi };
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  else root.CsdEngine=api;
})(typeof window!=="undefined" ? window : globalThis);
