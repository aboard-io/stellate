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

  const CHORD_BEATS=8;
  const WAVES=["sine","saw","square","pulse"];
  const BASS_PATTERNS=["off","root","simple","walking","octaves","sixteenths","dub","drive","rolling","sub","stab","melodic","habanera","syncopated","pedal"];
  const MELODY_PATTERNS=["off","composed","composed2","arpup","arpdown","updown","pentaup","wander","sparse","double","hero","blues","canon","roar","anthem","arp16","motorik","motorik23"];
  const DRUM_PATTERNS=["off","kick","full","open","four","boombap","halftime","trap","pulse","techno","house","breaks","jungle","tribal","bossa","electro","newjack","shuffle"];
  const SFX_NUM={riser:1,sweep:2,downlift:3,impact:4,reverse:5,noise:6};
  // the ⚡ transition control: what happens at the end of a section, into the next
  // (2026-07: + "snare roll" march-crescendo, "stutter" last-half-bar gate,
  //  "dropout" kick-drop silence beat — see buildEvents transition chain)
  const TRANSITIONS=["off","drum fill","tom fill","break fill","hat rush","cut","riser","sweep","downlift","impact","reverse","noise","snare roll","stutter","dropout"];
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
    model==="dx7"||model==="sampler"||   // sampler: native pitched sample zones (found/samples/instruments/)
    // drums: kick boom|808|909 · snare noise|crack|clap · hat noise|metal
    model==="boom"||model==="808"||model==="909"||model==="noise"||model==="crack"||
    model==="clap"||model==="metal";

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
  // style presets — pick one to recast the whole song
  const STYLES = {
    vaporwave:{ label:"Vaporwave", bpm:88, reverb:0.85, delay:{beats:0.75,feedback:0.30,cutoff:2600},
      progression:"royal_road", song:{bass:"simple",drums:"full",melody:"composed"},
      instruments:{ pad:{wave:"saw",cutoff:1400,detune:0.006,dsend:0.15}, bass:{wave:"saw",cutoff:700}, melody:{wave:"sine",cutoff:3400,dsend:0.25} } },
    synthwave:{ label:"Synthwave", bpm:112, reverb:0.5, delay:{beats:0.5,feedback:0.35,cutoff:4200},
      progression:"synthwave", song:{bass:"octaves",drums:"four",melody:"updown"},
      instruments:{ pad:{wave:"saw",cutoff:2800,res:0.2,detune:0.012,dsend:0.2}, bass:{wave:"saw",cutoff:1400,level:1.0}, melody:{wave:"saw",cutoff:4000,vibrato:0.004,dsend:0.3} } },
    downtempo:{ label:"Downtempo", bpm:76, reverb:0.8, delay:{beats:0.75,feedback:0.28,cutoff:2200},
      progression:"neosoul", song:{bass:"simple",drums:"boombap",melody:"sparse"},
      instruments:{ pad:{wave:"saw",cutoff:1100,detune:0.008,dsend:0.2}, bass:{wave:"sine",cutoff:500}, melody:{wave:"sine",cutoff:2600,dsend:0.3} } },
    lofi:{ label:"Lo-fi", bpm:82, reverb:0.6, delay:{beats:0.5,feedback:0.22,cutoff:2000},
      progression:"lofi", song:{bass:"simple",drums:"boombap",melody:"pentaup"},
      instruments:{ pad:{wave:"sine",cutoff:1200,dsend:0.18}, bass:{wave:"saw",cutoff:600}, melody:{wave:"sine",cutoff:2400,dsend:0.25} } }
  };

  let _sid=0; const sid=()=>"s"+(++_sid);
  // a whole song with named sections; rotates found sources; pads always paired
  // with found (never soloed); a fill leads into each chorus.
  function generateSong(opts){
    opts=opts||{};
    const fids=(opts.foundIds&&opts.foundIds.length)?opts.foundIds.slice():[null];
    let fi=0; const nextF=()=>{ const id=fids[fi%fids.length]; fi++; return id; };
    const bass=opts.bass||"simple", drums=opts.drums||"full", melody=opts.melody||"composed";
    const altBass={simple:"walking",walking:"octaves",octaves:"simple",root:"simple",sixteenths:"dub",dub:"walking"}[bass]||"walking";
    const S=(name,o)=>Object.assign({id:sid(),name,cycles:1,pads:true,bass:"off",drums:"off",melody:"off",found:{sourceId:null,role:"bed"},fill:"off"},o);
    return [
      S("intro",      {found:{sourceId:nextF(),role:"bed"}}),
      S("verse",      {bass, found:{sourceId:nextF(),role:"bed"}}),
      S("pre-chorus", {bass:"root", drums:"kick", fill:"riser"}),
      S("chorus",     {bass, drums, melody}),
      S("verse 2",    {bass:altBass, drums:(drums==="off"?"kick":"full"), found:{sourceId:nextF(),role:"bed"}}),
      S("bridge",     {bass:"root", melody, found:{sourceId:nextF(),role:"bed"}, fill:"drum fill"}),
      S("chorus 2",   {bass:altBass, drums, melody}),
      S("outro",      {found:{sourceId:nextF(),role:"bed"}})
    ];
  }

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
      sections: generateSong({ foundIds:["tokyo","tsukiji","asakusa"], bass:"simple", drums:"full", melody:"composed" })
    };
  }

  // ---------- event generators ----------
  function bassEvents(kind,S,b,k,rng){
    const r5=pchAdd(b.r5,k), r6=pchAdd(b.r6,k), f6=pchAdd(b.f6,k);
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
    return L.map(([o,d,p])=>({voice:"bass",beat:S+o,dur:d,pch:p,amp:0.22}));
  }
  // E(k,n,rot) — euclidean rhythm (Bjorklund/Toussaint): the Strudel bd(3,16)
  // notation as a KIT dimension (FAUST-PORT.md "Strudel borrowings"). Returns
  // beat offsets across the 8-beat chord bar. `rot` rotates by whole PULSES —
  // the downbeat always keeps a hit while the internal long/short spacing
  // shifts — so the placement evolves per chord, deterministically (no rng).
  function euclidBeats(k,n,rot){
    n=Math.max(1,n|0); k=Math.max(1,Math.min(n,k|0));
    const steps=[]; for(let i=0;i<n;i++) if((i*k)%n < k) steps.push(i);
    const base=steps[(((rot||0)%steps.length)+steps.length)%steps.length];
    return steps.map(s=>((s-base+n)%n)*(CHORD_BEATS/n)).sort((a,b)=>a-b);
  }
  function drumEvents(kind,S,ci,nc,rng,eu,sw){
    const R=rng||(()=>0.5);   // older kits never call R; new kits vary per chord + seed
    const out=[];
    const k=(o,a)=>out.push({drum:"kick",beat:S+o,dur:0.35,amp:a});
    const s=(o,a)=>out.push({drum:"snare",beat:S+o,dur:0.30,amp:a});
    const h=(o,a,dur)=>out.push({drum:"hat",beat:S+o,dur:dur||0.10,amp:a,open:(dur||0)>0.2});
    if(kind==="kick"){ k(0,.65);k(4,.65);h(3.5,.1);h(7.5,.1); }
    else if(kind==="full"){ k(0,.65);k(2.5,.38);k(4,.65);k(6.5,.38);s(2,.42);s(6,.42); for(let i=0;i<8;i++)h(.5+i,.13); }
    else if(kind==="open"){ k(0,.65);k(2.5,.38);k(4,.65);k(6.5,.38);s(2,.42);s(6,.42);s(3.5,.16);s(7.5,.16); for(let i=0;i<8;i++){const o=.5+i; if(o===3.5||o===7.5)h(o,.16,.3); else h(o,.13);} }
    else if(kind==="four"){ for(let i=0;i<8;i+=2)k(i,.6); s(2,.4);s(6,.4); for(let i=0;i<8;i++)h(.5+i,.12); }
    else if(kind==="boombap"){ k(0,.62);k(3,.4);k(4.5,.45); s(2,.5);s(6,.5); for(let i=0;i<8;i++)h(.5+i,(i%2?.08:.12)); }
    else if(kind==="halftime"){ k(0,.66); s(4,.55); for(let i=0;i<8;i++)h(.5+i,.12); }
    else if(kind==="trap"){ k(0,.6);k(2.5,.45);k(5,.45); s(4,.5); for(let i=0;i<16;i++)h(i*.5,.1); h(6,.09);h(6.25,.09);h(6.5,.09);h(6.75,.09); }
    else if(kind==="pulse"){ // driving four with ghost snares + wandering push-kick; varies per chord
      for(let i=0;i<8;i+=2)k(i,.62);
      s(2,.5);s(6,.5);
      s(ci%2?5.5:3.75,.14); s(ci===nc-1?7.25:1.75,.11);
      if(ci%2)k(7.75,.3); else k(3.5,.26);
      for(let i=0;i<16;i++){const o=i*.5; if(o===3.5||o===7.5)h(o,.16,.3); else h(o,i%2?.07:.13);}
    }
    else if(kind==="techno"){ // machine four: offbeat opens, minimal snare, rotating ghost perc
      for(let i=0;i<8;i+=2)k(i,.66);
      for(let i=0;i<8;i++)h(i+1,.17,.28);                          // offbeat open hats
      for(let i=0;i<16;i++)h(i*.5,i%2?.05:.09);                    // 16th ride bed
      if(R()<0.7){s(2,.22);s(6,.22);}                              // snare is optional color
      const g=[1.75,3.25,5.75,7.25][ci%4]; h(g,.2);                // the rotating ghost
      if(R()<0.35)k(7.5,.3);
    }
    else if(kind==="house"){ // four + claps on 2/4, skipping hats
      for(let i=0;i<8;i+=2)k(i,.62);
      s(2,.46);s(6,.46);                                           // claps
      for(let i=0;i<16;i++){const o=i*.5; h(o,i%4===2?.16:(i%2?.06:.11));}
      h(ci%2?4.5:0.5,.18,.3);                                      // open hat skips around
      if(ci%2)s(7.75,.13);
    }
    else if(kind==="breaks"){ // mid-tempo broken beat — displaced kicks, dragged snares
      k(0,.68); k(ci%2?2.75:2.5,.46); k(R()<0.5?4.5:5,.5);
      s(2,.38); s(6,.38); s(ci%2?5.25:3.75,.13); if(R()<0.4)s(7.5,.15);
      for(let i=0;i<8;i++)h(.5+i,(i%2?.08:.13));
      h(ci%2?6.5:2.5,.15,.3);
    }
    else if(kind==="jungle"){ // chopped-break feel: the pattern itself mutates every chord
      k(0,.68); k(2.75,.5); if(ci%2)k(5.5,.52); else k(6.25,.46);
      s(1.5,.32); s(4,.35);                                        // displaced backbeats
      const chops=[[3.25,3.5],[5.75,6],[7,7.25],[2.25,6.75]][ci%4];
      chops.forEach((o,j)=>s(o,.15+j*.04));                        // double-hit chop pair
      if(R()<0.5)s(7.75,.22);                                      // edge-of-bar push
      for(let i=0;i<16;i++){if(R()<0.55)h(i*.5,(i%2?.05:.09));}    // broken 16th hats (sparser)
      h(ci%2?3.5:7.5,.13,.3);
    }
    else if(kind==="tribal"){ // full ritual kit: galloping kicks, BUSY hand-hats + open-hat swells, quiet tom accents (no snare roll)
      k(0,.66); k(0.75,.32); k(2,.5); k(2.5,.28); k(4,.62); k(4.75,.32); k(6,.5);   // dense galloping low toms
      s(1.5,.26); s(5.5,.26); s(ci%2?3.5:7,.18);                   // toms = snare voice, kept QUIET
      for(let i=0;i<16;i++){ const o=i*.5;                         // the whole kit: 16th hand-hat bed
        if(o===3.5||o===7.5) h(o,.16,.32);                         //   open-hat swells
        else h(o, i%4===0?.12 : i%2?.05:.09); }                    //   accented closed hats
      h([1,3,5,7][ci%4]+0.25,.13,.26);                             // rotating ghost open-hat per chord
      h(ci%2?2.75:6.25,.10);                                       // extra syncopated shaker
      if(R()<0.5) k(7.5,.32);                                      // occasional pickup kick (not a snare fill)
    }
    else if(kind==="bossa"){ // bossa nova: surdo-soft kick with pickups, rim-click clave (QUIET snare voice), gentle 8th hats
      k(0,.55); k(3.5,.28); k(4,.55); k(7.5,.28);
      const clave=ci%2?[1,2.5,4,5.5,7]:[0.5,2,4.5,6,7.5];          // 3-2 / 2-3 rim pattern flips per chord
      clave.forEach(o=>s(o,.2));                                   // rim clicks, never a backbeat
      for(let i=0;i<8;i++)h(.5+i,(i%2?.07:.11));
      if(R()<0.3)h(6.5,.13,.28);                                   // occasional soft open shaker
    }
    else if(kind==="electro"){ // 1982 machine boom-bap (Planet Rock): syncopated 808 kicks, claps 2+4, crisp accented 16th hats
      k(0,.66); k(3.5,.42); k(6,.5); if(ci%2)k(7.5,.3);
      s(2,.5); s(6,.5); if(R()<0.35)s(7.75,.14);                   // clap ghosts push the bar
      for(let i=0;i<16;i++){const o=i*.5; h(o,i%4===2?.14:(i%2?.06:.11));}
      h(ci%2?3.5:7.5,.15,.28);                                     // the open accent flips per chord
    }
    else if(kind==="shuffle"){ // blues shuffle: swung-TRIPLET ride line, rimshot-light 2/4, sparse kick
      // the skip lands ON the triplet grid (beat + 2/3) scaled by state.swing —
      // at blues swing (.24-.42) it sits .63-.667 into the beat, a true shuffle.
      // These offbeats are NOT at f=0.5, so applyGroove never double-swings them.
      const skip=0.5+(2/3-0.5)*Math.max(0,Math.min(1,(sw||0)/0.3));
      for(let i=0;i<8;i++){ h(i,(i%2?0.11:0.14)); h(i+skip,0.07); }   // ding ... ding-a ride
      s(2,.3); s(6,.3);                                              // light rim backbeat (brushes-soft)
      s(ci%2?3+skip:7+skip,.09);                                     // ghost drag into the turn
      k(0,.55); k(4,.5); if(R()<0.4)k(ci%2?6:2,.3);                  // sparse kick, occasional push
      if(R()<0.3)h(7+skip,.13,.3);                                   // open let-ring into the next bar
    }
    else if(kind==="newjack"){ // swingbeat: bouncing kicks, HUGE claps on 2/4, skippy 16th hats (the swing knob rides on top)
      k(0,.64); k(2.75,.4); k(4.5,.5); k(ci%2?6.75:5.75,.34);
      s(2,.58); s(6,.58); s(ci%2?3.75:7.25,.16);                   // ghost clap skips around
      for(let i=0;i<16;i++){if(R()<0.8)h(i*.5,(i%2?.07:.12));}     // hats drop pulses — the skip
      h(ci%2?2.5:6.5,.16,.3);
    }
    // euclid overlay (state.euclid = {kick:[k,n], hat:[k,n], snare:[k,n]}): the spec REPLACES
    // that drum line with E(k,n) placement, rotation advancing per global chord
    // (open hats survive — they're the kit's accent identity; euclid re-places
    // the closed-hat grid / the kick line only).
    if(eu&&kind!=="off"){
      const gci=Math.round(S/CHORD_BEATS);
      const place=(spec,drum,mk)=>{
        if(!spec||!spec.length) return;
        for(let i=out.length-1;i>=0;i--) if(out[i].drum===drum&&(drum!=="hat"||!out[i].open)) out.splice(i,1);
        euclidBeats(spec[0],spec[1],gci).forEach((o,j)=>mk(o,j));
      };
      place(eu.kick,"kick",(o,j)=>k(o, j===0?.64:.48));
      place(eu.hat, "hat", (o,j)=>h(o, j%2?.07:.12));
      place(eu.snare,"snare",(o,j)=>s(o, j===0?.5:.36));           // euclid CLAPS (electro): E(3,16) tresillo replaces the backbeat
    }
    if(ci===nc-1 && kind!=="off" && kind!=="halftime" && kind!=="tribal" && kind!=="bossa" && kind!=="shuffle"){ s(6.5,.3);s(7,.34);s(7.25,.38);s(7.5,.42);s(7.75,.46); }
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
  function melodyEvents(style,base,prg,chords,k,rng,seed){
    const out=[], cycleBeats=chords.length*CHORD_BEATS;
    const comp = style==="composed"?prg.composed : style==="composed2"?prg.composed2 : null;
    if(comp && cycleBeats===32){
      comp.forEach(([o,d,p])=>{ if(rng()<0.06) return;            // composed lines breathe too
        out.push({voice:"melody",beat:base+o,dur:d,pch:pchAdd(p,k),amp:0.135+rng()*0.015}); });
      return out;
    }
    let gen=style; if(style==="composed"||style==="composed2") gen="arpup";
    chords.forEach((chord,ci)=>{
      const Sb=base+ci*CHORD_BEATS, lead=chord.lead.map(p=>pchAdd(p,k));
        // humanity: every chord's phrase mutates a little — drops, pushes, octave color
      const note=(o,d,idx,oct,bd)=>{
        if(rng()<0.09) return;
        if(rng()<0.11 && o+0.5+d<=8) o+=0.5;
        if(rng()<0.09) oct=(oct||0)===0?1:0;
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
        const gci=Math.round(Sb/CHORD_BEATS);
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
        if(rng()<0.55) out.push({voice:"melody",beat:Sb+5.4,dur:2.3,pch:pchAdd(lead[2],-12),amp:0.14});
        return; }
      if(gen==="double"){ // 8th-note double-time riff — ROTATES per chord (verbatim loops were the arp fatigue) + humanity drops/octave pops
        const pat=[0,1,2,3,0,1,2,3,1,2,3,0,2,3,0,1];
        const rot=(Math.round(Sb/CHORD_BEATS)%4)*4;                   // pattern phase advances each chord/cycle
        for(let i=0;i<16;i++){
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
        const gci=Math.round(Sb/CHORD_BEATS);                                   // global chord index — the direction varies across the whole song
        const base=arpDir(ARP_DIRS[gci%ARP_DIRS.length], gci);
        const cell=slow?base.slice().reverse():base;                            // the counter mirrors the main = contrary motion
        const step=slow?0.75:0.5, n=Math.floor((CHORD_BEATS)/step);             // EIGHTH notes (main), dotted-8th (counter at 2/3 speed)
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
        for(let i=0;i<32;i++){ const p=ext[motif[i%16]];
          out.push({voice:"melody",beat:Sb+i*0.25,dur:0.24,pch:pchAdd(p,-12),amp:0.12});   // melodic arp, octave lower (main)
          out.push({voice:"melody",beat:Sb+i*0.25,dur:0.22,pch:p,amp:0.05}); }              // octave doubling
        return; }
      const ph=MEL_PHRASES[gen];
      if(ph){ ph.forEach(([o,d,idx,oct])=>note(o,d,idx,oct)); return; }
      // wander: rhythmic random walk over chord tones, occasional octave leap
      const rh=[1,0.5,0.5,1,1,2]; let t=0,i=0,prev=Math.floor(rng()*4);
      while(t<8){ const d=rh[i%rh.length]; prev=Math.max(0,Math.min(3,prev+(Math.floor(rng()*3)-1))); note(t,Math.min(d,8-t)*0.92,prev,rng()<0.18?1:0); t+=d; i++; }
    });
    return out;
  }
  function applyGroove(events, swing, humanize, rng){
    const sw=swing||0, hz=humanize||0; if(!sw && !hz) return;
    for(const e of events){
      let b=e.beat; const f=b-Math.floor(b);
      if(sw && Math.abs(f-0.5)<0.001) b += sw*0.16;
      if(hz){ b += (rng()*2-1)*hz*0.04; if(e.amp!=null) e.amp=Math.max(0.01, e.amp*(1+(rng()*2-1)*hz*0.25)); }
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

  function buildEvents(state){
    const prg=PROGRESSIONS[state.progression]||PROGRESSIONS.royal_road;
    const chords=prg.chords, k=state.keyOffset|0, cycleBeats=chords.length*CHORD_BEATS;
    const srcById={};
    state.foundSources.forEach((s,i)=>{ srcById[s.id]={id:s.id,tableNum:i+2,fsPath:s.fsPath||("found/"+s.id+".wav"),pitch:s.pitch??0.78,stretch:s.stretch??0.45,vol:s.vol??0.22,cutoff:s.cutoff??2600,bpm:s.bpm,durSec:s.durSec,wet:!!s.wet,glitch:!!s.glitch,distant:!!s.distant}; });
    const rng=mulberry32((state.seed??1)>>>0);
    let pitched=[], drums=[];
    const found=[], sfx=[], spans=[];   // spans: section extents for the per-bar transform pool
    let cur=0, narrOffset=0;   // narration plays through the clip across sections (always playing)
    for(const sec of state.sections){
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
          for(let cb=0;cb<secBeats/CHORD_BEATS;cb++){
            const pat=BREAK_PATTERNS[(cb+Math.floor(rng()*2))%BREAK_PATTERNS.length];
            for(let i8=0;i8<16;i8++){
              let sl=pat[i8];
              if(sl<0||rng()<0.08) continue;
              if(rng()<0.1) sl=Math.floor(rng()*8);                  // surprise slice
              const beat=cur+cb*CHORD_BEATS+i8*0.5;
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
          for(let cb=0;cb<secBeats/CHORD_BEATS;cb++){
            const base=cur+cb*CHORD_BEATS;
            if(rng()<0.6){                                            // a fading swell (gentle)
              found.push({chop:1,beat:base+rng()*3,dur:3+rng()*4,amp:(hsrc.vol||0.2)*1.4,tableNum:hsrc.tableNum,
                pitch:0.55+rng()*0.7,offset:rng(),cutoff:hsrc.cutoff||4500,rsend:0.32,dsend:0.3,fade:1+rng()*1.5});
            }
            if(rng()<0.6){                                           // a stutter cluster
              const off=rng(), n=2+Math.floor(rng()*4), step=[0.0625,0.125,0.1875][Math.floor(rng()*3)], sb=base+rng()*5;
              for(let j=0;j<n&&sb+j*step<base+CHORD_BEATS;j++)
                found.push({chop:1,beat:sb+j*step,dur:step*1.7,amp:(hsrc.vol||0.2)*1.3,tableNum:hsrc.tableNum,
                  pitch:[0.5,0.75,1,1.5,2][Math.floor(rng()*5)],offset:Math.min(0.98,off+j*0.05),cutoff:hsrc.cutoff||5500,rsend:0.3,dsend:0.3});
            }
          }
        } else {
        const pat=HIT_PATTERNS[sec.hits.pattern]||HIT_PATTERNS.sparse;
        const hdur=Math.min(4,(hsrc.durSec||1.2)*state.bpm/60);
        for(let cb=0;cb<secBeats/CHORD_BEATS;cb++){
          for(const o of pat){
            if(sec.hits.pattern==="response"){
              // response slotting: the singer ONLY takes the response bars the
              // blues lead rests (crStream draw #1 — the same seeded coin)
              if(crStream(state.seed,Math.round((cur+cb*CHORD_BEATS)/CHORD_BEATS))()>=0.42) continue;
            } else if(rng()<0.45) continue;                          // hits are events, not loops
            const ev={chop:1,beat:cur+cb*CHORD_BEATS+o,dur:hdur,amp:(hsrc.vol||0.2)*1.8,
              tableNum:hsrc.tableNum,pitch:1+(rng()*0.06-0.03),offset:0,cutoff:hsrc.cutoff||4500};
            if(hsrc.distant){ ev.amp*=0.32; ev.rsend=0.9; ev.dsend=0.72; ev.fade=0.4; }  // across the lake: way down, drenched, muffled
            else if(hsrc.wet){ ev.rsend=0.6; ev.dsend=0.45; }        // rides reverb + echo
            found.push(ev);
          }
        }
        }
      }
      // glitched paleontologist voiceover: the phrase plays, then gets stuttered /
      // pitch-jumped "like crazy" — instr 5 slice retriggers with random offset+rate
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
      // played once from the section downbeat at natural pitch, with space (reverb + delay)
      if(sec.vocal&&srcById[sec.vocal]){
        const vc=srcById[sec.vocal], vdur=Math.min(secBeats-0.25,(vc.durSec||16)*state.bpm/60);
        found.push({chop:1,beat:cur+0.02,dur:vdur,amp:(vc.vol||0.5),tableNum:vc.tableNum,
          pitch:1,offset:0,cutoff:vc.cutoff||9000,rsend:0.34,dsend:0.2});
      }
      // door "ding ding": the chime one-shot at the section downbeat (doors closing as the
      // train departs) and again near the end (doors opening at the next stop)
      if(sec.ding&&srcById[sec.ding]){
        const dg=srcById[sec.ding], ddur=Math.min(2.2,(dg.durSec||1)*state.bpm/60);
        for(const at of [0.25, secBeats-ddur-0.5]){
          if(at<0) continue;
          // always low-passed (soft chime) and fed to the long ping-pong so it repeats for a
          // couple measures; little of the short delay (let the ping-pong carry the tail)
          found.push({chop:1,beat:cur+at,dur:ddur,amp:(dg.vol||0.4),tableNum:dg.tableNum,
            pitch:1,offset:0,cutoff:Math.min(dg.cutoff||2400,2400),rsend:0.26,dsend:0.04,ppsend:0.7});
        }
      }
      // synth stabs (rave chords on the chord root)
      if(sec.stab&&sec.stab!=="off"&&STAB_PATTERNS[sec.stab]){
        for(let cb=0;cb<secBeats/CHORD_BEATS;cb++){
          const chord=chords[cb%chords.length];
          for(const o of STAB_PATTERNS[sec.stab]){
            if(rng()<0.2) continue;
            sfx.push({stab:1,beat:cur+cb*CHORD_BEATS+o,dur:0.32,pch:pchAdd(chord.bass.r6,k+12),amp:0.16+rng()*0.05});
          }
        }
      }
      for(let c=0;c<cycles;c++){
        const cycleBase=cur+c*cycleBeats;
        chords.forEach((chord,ci)=>{
          const Sp=cycleBase+ci*CHORD_BEATS;
          if(sec.pads){ const padAmp=sec.swell ? 0.085*(0.5+1.9*((Sp-cur)/Math.max(1,secBeats))) : 0.085;
            chord.pads.forEach(p=>pitched.push({voice:"pad",beat:Sp,dur:CHORD_BEATS,pch:pchAdd(p,k),amp:padAmp})); }
          if(sec.bass&&sec.bass!=="off"){
            const be=bassEvents(sec.bass,Sp,chord.bass,k,rng);
            be.forEach(e=>{
              if(rng()<0.05) e.pch=pchAdd(e.pch,12);                  // octave pops
              if(rng()<0.06&&e.beat-Sp>0.4){ e.beat+=0.25; }          // lazy push
              if(rng()<0.05) return;                                  // rest
              pitched.push(e); });
          }
          if(sec.drums&&sec.drums!=="off"){
            let de=drumEvents(sec.drums,Sp,ci,chords.length,rng,state.euclid,state.swing);
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
          const mel=melodyEvents(sec.melody,cycleBase,prg,chords,k,rng,state.seed);
          if(sec.solo) mel.forEach(e=>{ e.solo=sec.solo; if(sec.soloOctave) e.pch=pchAdd(e.pch,12*sec.soloOctave); });
          mel.forEach(e=>pitched.push(e));
        }
        if(sec.counter&&sec.counter.pattern){              // countermelody layer (e.g. a brass section) over the main melody
          const cm=melodyEvents(sec.counter.pattern,cycleBase,prg,chords,k,rng,state.seed);
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
      } else if(SFX_NUM[tr]){
        const hit=(tr==="impact"||tr==="noise");
        const sbeat = hit ? cur+secBeats : cur+secBeats-4;   // hit on next downbeat; build in final bar
        sfx.push({beat:Math.max(0,sbeat), dur:hit?1.5:4, type:SFX_NUM[tr], amp:0.4});
      }
      spans.push({start:cur,beats:secBeats});
      cur+=secBeats;
    }
    // ---- Strudel-borrowed per-cycle transform pool (FAUST-PORT.md) ----
    // Per chord-bar, one seeded pick from {reverse melody phrase, ply (double-
    // hit) a beat, degrade hats harder, octave-flip the bass bar, rest the
    // melody bar}, applied ON TOP of the humanity rules — subtle (p=0.25/bar),
    // never on the first bar of a section. Own rng stream (seed+31337) so the
    // base event fabric is untouched; same seed -> same transforms.
    {
      const trng=mulberry32(((state.seed??1)+31337)>>>0);
      const dropT=new Set();
      for(const sp of spans){
        const nbars=Math.floor(sp.beats/CHORD_BEATS);
        for(let bi=1;bi<nbars;bi++){
          if(trng()>=0.25) continue;
          const b0=sp.start+bi*CHORD_BEATS, b1=b0+CHORD_BEATS;
          const t=Math.floor(trng()*5);
          if(t===0){        // rev: mirror the melody phrase in time (Strudel rev; solos exempt)
            for(const e of pitched) if(e.voice==="melody"&&!e.solo&&e.beat>=b0&&e.beat<b1)
              e.beat=b0+Math.max(0, CHORD_BEATS-((e.beat-b0)+Math.min(e.dur,CHORD_BEATS)));
          } else if(t===1){ // ply: double-hit one beat of drums (Strudel ply 2)
            const at=b0+Math.floor(trng()*CHORD_BEATS), extra=[];
            for(const d of drums) if(d.beat>=at&&d.beat<at+1&&d.drum!=="tom")
              extra.push(Object.assign({},d,{beat:d.beat+0.25,dur:Math.min(d.dur,0.2),amp:d.amp*0.75}));
            extra.forEach(x=>drums.push(x));
          } else if(t===2){ // degrade: hats thin out hard this bar (Strudel degradeBy)
            for(const d of drums) if(d.drum==="hat"&&d.beat>=b0&&d.beat<b1&&trng()<0.45) dropT.add(d);
          } else if(t===3){ // octave-flip: the bass bar jumps an octave
            for(const e of pitched) if(e.voice==="bass"&&e.beat>=b0&&e.beat<b1) e.pch=pchAdd(e.pch,12);
          } else {          // rest: the melody sits this bar out (silence is a choice; solos exempt)
            for(const e of pitched) if(e.voice==="melody"&&!e.solo&&e.beat>=b0&&e.beat<b1) dropT.add(e);
          }
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
    applyGroove(pitched, state.swing, state.humanize, grng);
    applyGroove(drums,   state.swing, state.humanize, grng);
    // feed individual snare hits to the long ping-pong delay at random (>=4 beats apart)
    if(state.snarePP>0){ let last=-99;
      for(const d of drums){ if(d.drum==="snare" && d.beat-last>=4 && grng()<0.6){ d.pp=state.snarePP; last=d.beat; } } }
    // EVERY measure, without fail: a world-metro station name, BURIED, glitched mostly
    // downward, with a square-LFO amplitude gate at varying intensity (audio interest).
    if(state.stationPool&&state.stationPool.length){
      const sp=state.stationPool.map(id=>srcById[id]).filter(Boolean);
      for(let i=sp.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); const t=sp[i]; sp[i]=sp[j]; sp[j]=t; }   // shuffle: random global order, each used once before any repeat
      if(sp.length){ let si=0;
        for(let b=0;b<cur-2;b+=4){                                   // every measure (4 beats)
          const st=sp[si%sp.length]; si++;
          const sdur=Math.min(2.6,(st.durSec||1)*state.bpm/60);
          const sqd=[0.3,0.55,0.75,0.92][Math.floor(rng()*4)];       // varying square-LFO intensity
          const sqr=[3,5,8,12][Math.floor(rng()*4)];                 // varying rate
          found.push({chop:1,beat:b+0.5,dur:sdur,amp:(st.vol||0.26),tableNum:st.tableNum,pitch:1,offset:0,
            cutoff:st.cutoff||5200,rsend:0.3,dsend:0.22,sqRate:sqr,sqDepth:sqd});
          if(rng()<0.7){ const nb=2+Math.floor(rng()*2), stp=0.125;  // glitch mostly DOWNWARD
            for(let j=0;j<nb;j++) found.push({chop:1,beat:b+0.85+j*stp,dur:stp*1.5,amp:(st.vol||0.12)*0.8,
              tableNum:st.tableNum,pitch:[0.5,0.6,0.7,0.8][Math.floor(rng()*4)],offset:Math.min(0.9,rng()*0.5),
              cutoff:st.cutoff||2600,rsend:0.3,dsend:0.3}); }
        }
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
    return out;
  }
  const api={ buildEvents, defaultState, defaultInstruments, generateSong, voicing, soloVoices, euclidBeats,
    PROGRESSIONS, STYLES, WAVES, BASS_PATTERNS, MELODY_PATTERNS, DRUM_PATTERNS, TRANSITIONS, isModel, pchAdd, pchToMidi };
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  else root.CsdEngine=api;
})(typeof window!=="undefined" ? window : globalThis);
