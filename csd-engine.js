// csd-engine.js — pure generator for the vaporwave/synthwave/downtempo song builder.
// buildEvents(state) -> {pitched, drums, found, bpm, totalBeats}
// buildCsd(state)    -> full <CsoundSynthesizer> (uses buildEvents)
// Csound AND MIDI derive from buildEvents so they never drift.

(function (root) {
  "use strict";

  function parsePch(s){ const [o,ss]=String(s).split("."); return parseInt(o,10)*12+parseInt(ss,10); }
  function toPch(abs){ const o=Math.floor(abs/12), ss=abs%12; return o+"."+String(ss).padStart(2,"0"); }
  function pchAdd(s,semis){ return toPch(parsePch(s)+(semis|0)); }
  function pchToMidi(s){ const [o,ss]=String(s).split("."); return (parseInt(o,10)-3)*12+parseInt(ss,10); }
  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

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
    blues_12:   prog("12-bar blues (all dom7)",  [["C","dom7"],["C","dom7"],["C","dom7"],["C","dom7"],
                                                  ["F","dom7"],["F","dom7"],["C","dom7"],["C","dom7"],
                                                  ["G","dom7"],["F","dom7"],["C","dom7"],["G","dom7"]])
  });

  const CHORD_BEATS=8;
  const WAVES=["sine","saw","square","pulse"];
  const BASS_PATTERNS=["off","root","simple","walking","octaves","sixteenths","dub","drive","rolling","sub","stab","melodic"];
  const MELODY_PATTERNS=["off","composed","composed2","arpup","arpdown","updown","pentaup","wander","sparse","double","hero","blues","canon","roar"];
  const DRUM_PATTERNS=["off","kick","full","open","four","boombap","halftime","trap","pulse","techno","house","breaks","jungle","tribal"];
  const SFX_NUM={riser:1,sweep:2,downlift:3,impact:4,reverse:5,noise:6};
  // the ⚡ transition control: what happens at the end of a section, into the next
  const TRANSITIONS=["off","drum fill","tom fill","break fill","hat rush","cut","riser","sweep","downlift","impact","reverse","noise"];

  // models: pad saw|organ|fm · bass saw|sub|acid|reese · melody stack|pluck|fm
  // · kick boom|808|909 · snare noise|crack|clap · hat noise|metal
  function defaultInstruments(){
    return {
      pad:    { model:"saw", wave:"saw",  cutoff:1400, res:0.15, detune:0.006, attack:1.5, level:0.7, send:0.55, dsend:0.15 },
      bass:   { model:"saw", wave:"saw",  cutoff:700,  res:0.15, level:1.0, send:0.08, dsend:0.0 },
      melody: { model:"stack", wave:"sine", cutoff:3400, res:0.05, vibrato:0.006, vibRate:5.2, level:0.6, send:0.45, dsend:0.25, voices:2, spread:0.004 },
      drums:  { kickModel:"boom", snareModel:"noise", hatModel:"noise", kick:1.0, snare:1.0, hat:1.0, tune:1.0, send:0.18, dsend:0 }
    };
  }
  function mergedInstruments(state){
    const D=defaultInstruments(), s=state.instruments||{};
    return { pad:{...D.pad,...s.pad}, bass:{...D.bass,...s.bass}, melody:{...D.melody,...s.melody}, drums:{...D.drums,...s.drums} };
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
      default:           L=[[0,1.5,r5],[2,0.5,r6],[3,1.0,f6],[4.5,0.5,r5],[5,1.0,r6],[6.5,1.5,r5]];
    }
    return L.map(([o,d,p])=>({voice:"bass",beat:S+o,dur:d,pch:p,amp:0.22}));
  }
  function drumEvents(kind,S,ci,nc,rng){
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
    if(ci===nc-1 && kind!=="off" && kind!=="halftime" && kind!=="tribal"){ s(6.5,.3);s(7,.34);s(7.25,.38);s(7.5,.42);s(7.75,.46); }
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
    const s=(o,a)=>out.push({drum:"snare",beat:S+o,dur:0.3,amp:a});
    const k=(o,a)=>out.push({drum:"kick",beat:S+o,dur:0.4,amp:a});
    k(0,.60); s(0,.40); s(0.06,.20);                       // flam
    s(1,.44); if(r()<0.4)s(1.5,.22);
    k(2,.62); s(2,.48); s(2.06,.22); s(2.5,.52);
    if(r()<0.5){ s(3,.56); s(3.25,.60); s(3.5,.64); s(3.75,.68); }
    else       { s(3,.56); s(3.33,.61); s(3.67,.67); }     // triplet roll
    k(3.75,.4);
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
    hero2: [[0,.25,3,0],[.25,.25,2,0],[.5,.5,3,0],[1,.5,2,1],[1.5,.5,1,0],[2,.5,2,0],[2.5,.5,3,0],[3,1,2,1],[4,.25,0,1],[4.25,.25,1,0],[4.5,.5,2,0],[5,.5,3,0],[5.5,.5,2,1],[6,.5,1,0],[6.5,.5,3,0],[7,.5,2,0],[7.5,.5,0,1]]
  };
  function melodyEvents(style,base,prg,chords,k,rng){
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
      const note=(o,d,idx,oct)=>{
        if(rng()<0.09) return;
        if(rng()<0.11 && o+0.5+d<=8) o+=0.5;
        if(rng()<0.09) oct=(oct||0)===0?1:0;
        out.push({voice:"melody",beat:Sb+o,dur:d,pch:pchAdd(lead[idx],12*(oct||0)),amp:0.13+rng()*0.025});
      };
      if(gen==="canon"){
        // 2-voice counterpoint: the line + its echo two beats later, a chord tone lower
        const ph=MEL_PHRASES.updown;
        ph.forEach(([o,d,idx,oct])=>note(o,d,idx,oct));
        ph.forEach(([o,d,idx,oct])=>{ if(o+2+d<=8) note(o+2,d,Math.max(0,idx-1),(oct||0)-1); });
        return;
      }
      if(gen==="blues"){ MEL_PHRASES.blues.forEach(([o,d,idx,oct])=>note(o,d,idx,oct)); return; }
      if(gen==="hero"){ (ci%2?MEL_PHRASES.hero2:MEL_PHRASES.hero).forEach(([o,d,idx,oct])=>note(o,d,idx,oct)); return; }
      if(gen==="sparse"){ note(0,3,2,0); note(4,3,3,0); return; }
      if(gen==="roar"){   // a creature bellow: one long held low note, sometimes a second answering call
        out.push({voice:"melody",beat:Sb,dur:5.0,pch:pchAdd(lead[0],-12),amp:0.17});
        if(rng()<0.55) out.push({voice:"melody",beat:Sb+5.4,dur:2.3,pch:pchAdd(lead[2],-12),amp:0.14});
        return; }
      if(gen==="double"){ const pat=[0,1,2,3,0,1,2,3,1,2,3,0,2,3,0,1]; for(let i=0;i<16;i++) out.push({voice:"melody",beat:Sb+i*0.5,dur:0.45,pch:lead[pat[i]],amp:0.12}); return; }
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
  const HIT_PATTERNS={ sparse:[0], offbeat:[3.5], dub:[2.5,6.5] };

  function buildEvents(state){
    const prg=PROGRESSIONS[state.progression]||PROGRESSIONS.royal_road;
    const chords=prg.chords, k=state.keyOffset|0, cycleBeats=chords.length*CHORD_BEATS;
    const srcById={};
    state.foundSources.forEach((s,i)=>{ srcById[s.id]={id:s.id,tableNum:i+2,fsPath:s.fsPath||("found/"+s.id+".wav"),pitch:s.pitch??0.78,stretch:s.stretch??0.45,vol:s.vol??0.22,cutoff:s.cutoff??2600,bpm:s.bpm,durSec:s.durSec}; });
    const rng=mulberry32((state.seed??1)>>>0);
    const pitched=[], drums=[], found=[], sfx=[];
    let cur=0;
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
        } else {
          found.push({beat:cur,dur:secBeats,amp:fsrc.vol,tableNum:fsrc.tableNum,pitch:fsrc.pitch,stretch:fsrc.stretch,cutoff:fsrc.cutoff});
        }
      }
      // one-shot sample hits (stabs/shouts/vox) — separate layer from the bed/break
      if(sec.hits&&sec.hits.sourceId&&srcById[sec.hits.sourceId]){
        const hsrc=srcById[sec.hits.sourceId];
        const pat=HIT_PATTERNS[sec.hits.pattern]||HIT_PATTERNS.sparse;
        const hdur=Math.min(4,(hsrc.durSec||1.2)*state.bpm/60);
        for(let cb=0;cb<secBeats/CHORD_BEATS;cb++){
          for(const o of pat){
            if(rng()<0.45) continue;                                 // hits are events, not loops
            found.push({chop:1,beat:cur+cb*CHORD_BEATS+o,dur:hdur,amp:(hsrc.vol||0.2)*1.8,
              tableNum:hsrc.tableNum,pitch:1+(rng()*0.06-0.03),offset:0,cutoff:hsrc.cutoff||4500});
          }
        }
      }
      // glitched paleontologist voiceover: the phrase plays, then gets stuttered /
      // pitch-jumped "like crazy" — instr 5 slice retriggers with random offset+rate
      if(sec.vox&&sec.vox.sourceId&&srcById[sec.vox.sourceId]){
        const vs=srcById[sec.vox.sourceId];
        const phraseBeats=Math.min(secBeats-1, Math.max(3,(vs.durSec||3)*state.bpm/60));
        // 1) let it TALK: the phrase plays clean and fairly dry up front
        found.push({chop:1,beat:cur+1,dur:phraseBeats,amp:(vs.vol||0.42),tableNum:vs.tableNum,
          pitch:vs.pitch||1,offset:0,cutoff:vs.cutoff||6000,dsend:0.05});
        // 2) only AFTER it has spoken, occasional glitch bursts (sparser) — slow-down
        //    pitches only, with delay swelling in and out burst-to-burst
        let b=phraseBeats+2, burst=0;
        while(b<secBeats-1){
          if(rng()<0.3){
            const off=rng(), pit=[0.5,0.7,0.85,1,1][Math.floor(rng()*5)];           // <=1: only slows down
            const n=2+Math.floor(rng()*4), step=[0.125,0.25][Math.floor(rng()*2)];
            const ds=(burst%2)?0.55:0.06;                                           // delay in / out, burst to burst
            for(let j=0;j<n&&b+j*step<secBeats-0.5;j++)
              found.push({chop:1,beat:cur+b+j*step,dur:step*1.5,amp:(vs.vol||0.42)*0.8,tableNum:vs.tableNum,
                pitch:Math.min(1,pit*(1-rng()*0.06)),offset:Math.min(0.98,off+j*0.03),cutoff:vs.cutoff||7000,dsend:ds});
            burst++; b+=n*step+2+rng()*3;
          } else b+=1+rng()*2;
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
          if(sec.pads) chord.pads.forEach(p=>pitched.push({voice:"pad",beat:Sp,dur:CHORD_BEATS,pch:pchAdd(p,k),amp:0.085}));
          if(sec.bass&&sec.bass!=="off"){
            const be=bassEvents(sec.bass,Sp,chord.bass,k,rng);
            be.forEach(e=>{
              if(rng()<0.05) e.pch=pchAdd(e.pch,12);                  // octave pops
              if(rng()<0.06&&e.beat-Sp>0.4){ e.beat+=0.25; }          // lazy push
              if(rng()<0.05) return;                                  // rest
              pitched.push(e); });
          }
          if(sec.drums&&sec.drums!=="off"){
            let de=drumEvents(sec.drums,Sp,ci,chords.length,rng);
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
          const mel=melodyEvents(sec.melody,cycleBase,prg,chords,k,rng);
          if(sec.solo) mel.forEach(e=>{ e.solo=sec.solo; if(sec.soloOctave) e.pch=pchAdd(e.pch,12*sec.soloOctave); });
          mel.forEach(e=>pitched.push(e));
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
      } else if(SFX_NUM[tr]){
        const hit=(tr==="impact"||tr==="noise");
        const sbeat = hit ? cur+secBeats : cur+secBeats-4;   // hit on next downbeat; build in final bar
        sfx.push({beat:Math.max(0,sbeat), dur:hit?1.5:4, type:SFX_NUM[tr], amp:0.4});
      }
      cur+=secBeats;
    }
    const grng=mulberry32(((state.seed??1)+777)>>>0);
    applyGroove(pitched, state.swing, state.humanize, grng);
    applyGroove(drums,   state.swing, state.humanize, grng);
    return { bpm:state.bpm, totalBeats:cur+8, pitched, drums, found, sfx, srcById };
  }

  // ---------- orchestra ----------
  function waveRHS(wave,f){
    if(wave==="sine")   return `oscili 1, ${f}`;
    if(wave==="square") return `vco2 1, ${f}, 2, 0.5`;
    if(wave==="pulse")  return `vco2 1, ${f}, 2, 0.22`;
    return `vco2 1, ${f}, 0`;
  }
  // ---- per-voice synthesis models (the timbre dimension) ----
  // struck-string piano: inharmonic partials + hammer noise, natural decay
  function pianoSource(freq,cut){
    return `  ah noise 0.35, 0
  ah buthp ah, 2400
  khe transeg 1, 0.008, -4, 0
  kdec transeg 1, p3, -3, 0.05
  ap1 oscili 1, ${freq}
  ap2 oscili 0.5, ${freq}*2.004
  ap3 oscili 0.24, ${freq}*3.011
  ap4 oscili 0.11, ${freq}*4.022
  asig = (ap1 + (ap2+ap3+ap4)*kdec)*0.42*kdec + ah*khe*0.4
  asig butlp asig, ${Math.round(cut)}`;
  }
  // fof formant choir ("ah" vowel) and inharmonic FM bell — shared by pad/lead
  function choirSource(cut){
    return `  kvib oscili kf*0.007, 4.7
  kfu = kf*0.5 + kvib
  af1 fof 0.5, kfu, 800, 0, 60, 0.003, 0.02, 0.007, 14, gisine, gisig, p3
  af2 fof 0.35, kfu, 1150, 0, 90, 0.003, 0.02, 0.007, 14, gisine, gisig, p3
  af3 fof 0.18, kfu, 2800, 0, 120, 0.003, 0.02, 0.007, 14, gisine, gisig, p3
  asig = (af1+af2+af3)*0.85
  asig butlp asig, ${Math.round(cut)}`;
  }
  function bellSource(cut){
    return `  kidx transeg 4, p3, -4, 0.3
  amod oscili kidx*kf, kf*3.53
  asig oscili 1, kf + amod
  kdec transeg 1, p3, -5, 0.04
  asig = asig*kdec
  asig butlp asig, ${Math.round(cut)}`;
  }
  function brassSource(cut){
    return `  kcf expseg 500, 0.09, ${Math.round(cut*1.4)}, p3, ${Math.round(cut*0.6)}
  ab1 vco2 1, kf
  ab2 vco2 1, kf*1.007
  asig = (ab1+ab2)*0.5
  asig moogladder asig, kcf, 0.22`;
  }
  function stringsSource(cut){
    return `  as1 vco2 1, kf*0.995
  as2 vco2 1, kf
  as3 vco2 1, kf*1.005
  as4 vco2 1, kf*1.01
  asig = (as1+as2+as3+as4)*0.24
  asig butlp asig, ${Math.round(cut)}
  asig butlp asig, ${Math.round(cut*1.6)}`;
  }
  function padSource(p){
    if(p.model==="brass")   return brassSource(p.cutoff);
    if(p.model==="strings") return stringsSource(p.cutoff);
    if(p.model==="choir") return choirSource(Math.min(8000,p.cutoff*2.5));
    if(p.model==="bell")  return bellSource(Math.min(9000,p.cutoff*2.5));
    if(p.model==="piano") return pianoSource("kf", Math.min(8000,p.cutoff*2));
    if(p.model==="organ") return `  a1 oscili 0.9, kf
  a2 oscili 0.55, kf*2
  a3 oscili 0.36, kf*3
  a4 oscili 0.27, kf*4
  a5 oscili 0.17, kf*6
  asig = (a1+a2+a3+a4+a5)*0.32
  asig butlp asig, ${Math.round(Math.min(9000,p.cutoff*2.2))}`;
    if(p.model==="fm") return `  kidx linsegr 2.6, 1.1, 0.9, 0.8, 0.3
  amod oscili kidx*kf, kf*2.001
  asig oscili 1, kf + amod
  asig butlp asig, ${Math.round(Math.min(8000,p.cutoff*1.7))}`;
    return null;  // default detuned-saw stack stays inline in the orchestra
  }
  function bassSource(b){
    const c=Math.round(b.cutoff);
    if(b.model==="wobble") return `  a1 vco2 1, ipch, 0
  klfo oscili 0.5, ${(b.wobbleHz||2.4).toFixed(2)}
  kcf = ${c} * (0.5 + (klfo+0.5)*1.1)
  a1 moogladder a1, kcf, ${Math.min(0.85,(b.res||0.2)+0.4).toFixed(2)}
  a1 = tanh(a1*1.5)*0.85`;
    if(b.model==="piano") return pianoSource("ipch", Math.min(4000,c*2.5)).replace(/asig/g,"a1");
    if(b.model==="sub") return `  a1 oscili 1, ipch
  a1 = tanh(a1*1.6)
  a1 butlp a1, ${c}`;
    if(b.model==="acid") return `  a1 vco2 1, ipch, 0
  kcut expseg ${c*4}, 0.16, ${c}, p3, ${Math.max(120,c*0.8)}
  a1 moogladder a1, kcut, ${Math.min(0.9,(b.res||0.15)+0.5).toFixed(2)}`;
    if(b.model==="reese") return `  a1 vco2 1, ipch*0.994, 0
  a2 vco2 1, ipch*1.006, 0
  a1 = (a1+a2)*0.5
  a1 butlp a1, ${c}
  a1 = tanh(a1*1.7)*0.85`;
    return null;
  }
  function leadSource(m){
    if(m.model==="brass")   return brassSource(m.cutoff);
    if(m.model==="strings") return stringsSource(m.cutoff);
    if(m.model==="choir") return choirSource(Math.min(9000,m.cutoff*2.5));
    if(m.model==="bell")  return bellSource(Math.min(10000,m.cutoff*2.5));
    if(m.model==="piano") return pianoSource("kf", Math.min(9000,m.cutoff*2));
    if(m.model==="pluck") return `  asig pluck 1, kf, ipch, 0, 1
  asig butlp asig, ${Math.round(m.cutoff)}`;
    if(m.model==="fm") return `  kidx linsegr 3.5, p3*0.5, 1.0, 0.2, 0
  amod oscili kidx*kf, kf*1.4
  asig oscili 1, kf + amod
  asig butlp asig, ${Math.round(m.cutoff)}`;
    if(m.model==="fuzz") return `  a1 vco2 1, kf
  a2 vco2 1, kf*1.006
  asig=(a1+a2)*0.5
  asig moogladder asig, ${Math.round(Math.min(9000,m.cutoff*1.3))}, ${Math.min(0.92,(m.res||0.2)+0.45).toFixed(2)}
  asig=tanh(asig*${(3.2+(m.drive||0)*4).toFixed(2)})*0.6
  asig butlp asig, ${Math.round(Math.min(11000,m.cutoff*2.2))}`;
    return null;
  }
  // melody oscillator stack — voices<=2 emits the original two-osc code verbatim
  // (so old presets render identically); 3+ builds a detuned unison (supersaw at
  // 6-7 saw voices with spread ~0.012-0.02)
  function melodyStack(m){
    const v=Math.max(1,Math.min(9,(m.voices|0)||2)), sp=(m.spread!=null?m.spread:0.004);
    if(v<=2) return `  a1 ${waveRHS(m.wave,"kf")}
  a2 ${waveRHS(m.wave,`kf*${(1+sp).toFixed(5)}`)}
  a3 oscili 0.16, kf*2
  asig=(a1+a2)*0.5+a3`;
    const L=[];
    for(let i=0;i<v;i++){
      const det=1+sp*((2*i/(v-1))-1);
      L.push(`  a${i+1} ${waveRHS(m.wave,`kf*${det.toFixed(5)}`)}`);
    }
    L.push(`  aoct oscili 0.12, kf*2`);
    L.push(`  asig=(${Array.from({length:v},(_,i)=>"a"+(i+1)).join("+")})*${(0.95/v).toFixed(4)}+aoct`);
    return L.join("\n");
  }
  // Per-section solo voices: any section with a `solo` recipe gets its own melody
  // instrument (instr 7,8,…) so different "dinosaurs" / a fuzz guitar can each take
  // a section. Deterministic from state.sections so codegen + score routing agree.
  function soloVoices(state, baseMel){
    const out=[], seen=new Map(); let num=7;
    baseMel = baseMel || (state.instruments&&state.instruments.melody) || defaultInstruments().melody;
    for(const s of (state.sections||[])){
      if(!s.solo) continue;
      const key=JSON.stringify(s.solo);
      if(seen.has(key)) continue;
      seen.set(key,num);
      out.push({ key, num, recipe:Object.assign({}, baseMel, s.solo) });
      num++;
    }
    return out;
  }
  // codegen splits the orchestra into a HEADER (buses, tables, FX — boot once)
  // and an INSTRUMENT block (recompilable live via csound compileOrc).
  // opts.channels=true makes FX read live control channels:
  //   reverb, ddt, dfb, dcut, pump, crackle, lowcut, highcut
  function codegen(state, sources, opts){
    opts = opts || {};
    const live = !!opts.channels;
    const I=mergedInstruments(state);
    const ft=sources.map(s=>`gi_src${s.tableNum} ftgen ${s.tableNum}, 0, 0, 1, "${s.fsPath}", 0, 0, 1`).join("\n");
    const dLo=(1-I.pad.detune).toFixed(4), dHi=(1+I.pad.detune).toFixed(4), atk=Math.max(0.05,I.pad.attack), dt=I.drums.tune;
    const dl=state.delay||{beats:0.75,feedback:0.3,cutoff:2600};
    const dsec=Math.min(1.9, Math.max(0.02, (dl.beats||0.75)*60/state.bpm));
    const dfb=Math.min(0.92, Math.max(0, dl.feedback==null?0.3:dl.feedback)), dcut=dl.cutoff||2600;
    const hasSweeps=live||(state.sections||[]).some(s=>s.sweep&&s.sweep!=="off");
    // production: sidechain pump, vinyl crackle, master tone tilt (all default-off)
    const pump=Math.min(0.9,Math.max(0,state.pump||0));
    const tone=state.tone||{};
    const masterTone = live
      ? `  klc chnget "lowcut"
  klc limit klc, 10, 400
  aL buthp aL, klc
  aR buthp aR, klc
  khc chnget "highcut"
  khc = (khc < 100 ? 21000 : khc)
  aL butlp aL, khc
  aR butlp aR, khc
`
      : (tone.lowcut ?`  aL buthp aL, ${tone.lowcut}\n  aR buthp aR, ${tone.lowcut}\n`:"") +
        (tone.highcut?`  aL butlp aL, ${tone.highcut}\n  aR butlp aR, ${tone.highcut}\n`:"");
    const masterPump = live
      ? `  kbps chnget "bps"
  kbps = (kbps <= 0 ? 2 : kbps)
  kphs phasor kbps
  kpmp chnget "pump"
  kduck = 1 - kpmp*exp(-6*kphs)
  aL = aL*kduck
  aR = aR*kduck
`
      : pump>0
      ? `  kphs phasor ${(state.bpm/60).toFixed(4)}\n  kduck = 1 - ${pump.toFixed(3)}*exp(-6*kphs)\n  aL = aL*kduck\n  aR = aR*kduck\n`
      : "";
    const grit=Math.min(1,Math.max(0,state.grit||0));
    const masterGrit = live
      ? `  kgrt chnget "grit"
  kgrt limit kgrt, 0, 1
  aL = tanh(aL*(1+kgrt*2.6))*(1/(1+kgrt*0.7))
  aR = tanh(aR*(1+kgrt*2.6))*(1/(1+kgrt*0.7))
`
      : grit>0 ? `  aL = tanh(aL*${(1+grit*2.6).toFixed(3)})*${(1/(1+grit*0.7)).toFixed(3)}
  aR = tanh(aR*${(1+grit*2.6).toFixed(3)})*${(1/(1+grit*0.7)).toFixed(3)}
` : "";
    const comp=Math.min(1,Math.max(0,state.comp||0));
    const masterComp = comp>0
      ? `  aL dam aL, ${(0.55-0.35*comp).toFixed(3)}, ${(1-0.55*comp).toFixed(3)}, 1, 0.01, 0.09\n` +
        `  aR dam aR, ${(0.55-0.35*comp).toFixed(3)}, ${(1-0.55*comp).toFixed(3)}, 1, 0.01, 0.09\n` +
        `  aL = aL*${(1+0.8*comp).toFixed(3)}\n  aR = aR*${(1+0.8*comp).toFixed(3)}\n`
      : "";
    const padSrc = padSource(I.pad) || `  a1 ${waveRHS(I.pad.wave,`kf*${dLo}`)}
  a2 ${waveRHS(I.pad.wave,`kf`)}
  a3 ${waveRHS(I.pad.wave,`kf*${dHi}`)}
  asig = (a1+a2+a3)*0.33
  asig moogladder asig, ${I.pad.cutoff}, ${I.pad.res}`;
    const bassSrc = bassSource(I.bass) || `  a1 ${waveRHS(I.bass.wave,`ipch`)}
  a1 moogladder a1, ${I.bass.cutoff}, ${I.bass.res}`;
    // melody voice block, parameterized so solo sections can each get their own
    // (instr 4 = the main lead; solos get 7,8,… — see soloVoices)
    const melodyVoiceBlock=(num,m)=>`instr ${num}
  ipch=cpspch(p4)
  iamp=p5
  kvib lfo ipch*${m.vibrato}, ${m.vibRate}, 0
  kf=ipch+kvib
  aenv linsegr 0, 0.05, iamp, p3-0.12, iamp*0.85, 0.30, 0
${leadSource(m) || melodyStack(m)}
  asig moogladder asig, ${m.cutoff}, ${m.res}
  asig=asig*aenv
  gaMixL=gaMixL+asig*${m.level}
  gaMixR=gaMixR+asig*${m.level}
  gaRevL=gaRevL+asig*${m.send}
  gaRevR=gaRevR+asig*${m.send}
  gaDelL=gaDelL+asig*${m.dsend}
  gaDelR=gaDelR+asig*${m.dsend}
endin`;
    const soloInstrBlocks = soloVoices(state, I.melody).map(v=>melodyVoiceBlock(v.num, v.recipe)).join("\n\n");
    const ddsend=Math.min(1,Math.max(0,I.drums.dsend||0));
    const drumDel = ddsend>0 ? (v)=>`  gaDelL=gaDelL+${v}*${ddsend.toFixed(3)}\n  gaDelR=gaDelR+${v}*${ddsend.toFixed(3)}\n` : ()=>"";
    const kickSrc = I.drums.kickModel==="808" ? `  kp expseg ${72*dt}, 0.09, ${45*dt}, p3-0.09, ${38*dt}
  aenv transeg 1, p3, -2, 0
  a1 oscili iamp*aenv, kp
  a1 = tanh(a1*1.15)*0.9`
      : I.drums.kickModel==="909" ? `  kp expseg ${165*dt}, 0.04, ${55*dt}, p3-0.04, ${46*dt}
  aenv transeg 1, p3, -6, 0
  a1 oscili iamp*aenv, kp
  aclk noise iamp*0.5, 0
  aclk buthp aclk, 5000
  kce transeg 1, 0.005, -4, 0
  a1 = a1 + aclk*kce
  a1 = tanh(a1*1.5)*0.8`
      : `  kp expseg ${110*dt}, 0.06, ${46*dt}, p3-0.06, ${40*dt}
  aenv transeg 1, p3, -4, 0
  a1 oscili iamp*aenv, kp
  a1 = tanh(a1*1.4)*0.8`;
    const snareSrc = I.drums.snareModel==="crack" ? `  aenv transeg 1, p3, -9, 0
  anz noise iamp, 0
  anz butbp anz, 3100, 2300
  at1 oscili iamp*0.5, 215
  asig=(anz*0.8+at1)*aenv`
      : I.drums.snareModel==="clap" ? `  aenv transeg 1, p3, -6, 0
  anz noise iamp, 0
  anz butbp anz, 1250, 950
  aflut oscili 0.4, 41
  asig=anz*(0.72+aflut)*aenv`
      : `  aenv transeg 1, p3, -6, 0
  anz noise iamp, 0
  anz butbp anz, 1800, 1600
  at1 oscili iamp*0.5, 300
  at2 oscili iamp*0.3, 185
  asig=(anz+at1+at2)*aenv`;
    const hatSrc = I.drums.hatModel==="metal" ? `  aenv transeg 1, p3, -8, 0
  am1 vco2 0.3, 6317, 2, 0.5
  am2 vco2 0.25, 8429, 2, 0.5
  am3 vco2 0.2, 10781, 2, 0.5
  anz noise 0.4, 0
  asig=(am1+am2+am3+anz)*iamp
  asig buthp asig, 7600
  asig=asig*aenv`
      : `  aenv transeg 1, p3, -8, 0
  anz noise iamp, 0
  anz buthp anz, 7000
  asig=anz*aenv`;
    const crkAmp = live ? `kcrk chnget "crackle"` : `kcrk init 0
  kcrk = p4`;
    const header = `<CsoundSynthesizer>
<CsInstruments>
sr=44100
ksmps=32
nchnls=2
0dbfs=1
gaRevL init 0
gaRevR init 0
gaDelL init 0
gaDelR init 0
gaMixL init 0
gaMixR init 0
gkCut init 21000
giwin ftgen 1, 0, 16384, 20, 2, 1
gisine ftgen 0, 0, 8192, 10, 1
gisig ftgen 0, 0, 1024, 19, 0.5, 0.5, 270, 0.5
${ft}

instr 3
  iamp=p5
  aenv linsegr 0, 1.5, iamp, p3-3.0, iamp, 1.5, 0
  icut = (p9 > 0 ? p9 : 2600)
  asig syncgrain 1, 28, p7, 0.12, p8, p6, giwin, 100
  asig moogladder asig, icut, 0.1
  asig=asig*aenv
  gaMixL=gaMixL+asig*0.55
  gaMixR=gaMixR+asig*0.55
  gaRevL=gaRevL+asig*0.6
  gaRevR=gaRevR+asig*0.6
endin

instr 96
  ; master filter sweep: glide gkCut from p4 to p5 over p3 (global persists after)
  gkCut expon p4, p3, p5
endin

instr 97
  ${crkAmp}
  adust dust2 kcrk*0.5, 30 + kcrk*220
  adust butlp adust, 6500
  adust buthp adust, 300
  ahiss noise 0.004, 0
  ahiss = ahiss*kcrk
  ahiss butlp ahiss, 4000
  asig = adust + ahiss
  gaMixL=gaMixL+asig
  gaMixR=gaMixR+asig
endin

instr 20
  itype=p4
  iamp=p5
  if (itype == 1) then
    kc expseg 300, p3, 8000
    ke linseg 0, p3*0.9, iamp, p3*0.1, iamp*1.2
    an noise 1, 0
    an moogladder an, kc, 0.3
    asig = an*ke
  elseif (itype == 2) then
    kf expseg 400, p3, 6000
    an noise 1, 0
    an butbp an, kf, kf*0.4
    asig = an*iamp*1.5
  elseif (itype == 3) then
    kc expseg 8000, p3, 300
    ke linseg iamp, p3*0.8, iamp, p3*0.2, 0
    an noise 1, 0
    an moogladder an, kc, 0.3
    asig = an*ke
  elseif (itype == 4) then
    ke expon iamp, p3, 0.001
    kp expseg 120, 0.3, 40
    aboom oscili 1, kp
    an noise 0.5, 0
    an butlp an, 1200
    asig = (aboom + an)*ke
  elseif (itype == 5) then
    ke linseg 0, p3*0.95, iamp, p3*0.05, 0
    an noise 1, 0
    an buthp an, 3000
    asig = an*ke
  else
    ke expon iamp, p3, 0.001
    an noise 1, 0
    asig = an*ke
  endif
  asig clip asig, 0, 0.9
  gaMixL=gaMixL+asig
  gaMixR=gaMixR+asig
  gaRevL=gaRevL+asig*0.3
  gaRevR=gaRevR+asig*0.3
endin

instr 98
${live?`  kddt chnget "ddt"
  kddt limit kddt, 0.02, 1.9
  kdfb chnget "dfb"
  kdfb limit kdfb, 0, 0.92
  kdcut chnget "dcut"
  kdcut limit kdcut, 300, 9000
  abufL delayr 2.0
  atL deltap kddt
  atL tone atL, kdcut
  delayw gaDelL + atL*kdfb
  abufR delayr 2.0
  atR deltap kddt
  atR tone atR, kdcut
  delayw gaDelR + atR*kdfb`
:`  abufL delayr 2.0
  atL deltap ${dsec}
  atL tone atL, ${dcut}
  delayw gaDelL + atL*${dfb}
  abufR delayr 2.0
  atR deltap ${dsec}
  atR tone atR, ${dcut}
  delayw gaDelR + atR*${dfb}`}
  gaMixL=gaMixL+atL
  gaMixR=gaMixR+atR
  gaRevL=gaRevL+atL*0.2
  gaRevR=gaRevR+atR*0.2
  clear gaDelL, gaDelR
endin

instr 99
${live?`  krev chnget "reverb"
  krev limit krev, 0.3, 0.95
  aL, aR reverbsc gaRevL, gaRevR, krev, 12000`
:`  aL, aR reverbsc gaRevL, gaRevR, ${state.reverb}, 12000`}
  gaMixL=gaMixL+aL
  gaMixR=gaMixR+aR
  clear gaRevL, gaRevR
endin

instr 100
  aL = gaMixL
  aR = gaMixR
${hasSweeps?`  kcc limit gkCut, 180, 21000
  aL butlp aL, kcc
  aR butlp aR, kcc
`:""}${masterPump}${masterGrit}${masterComp}${masterTone}  aL clip aL, 0, 0.95
  aR clip aR, 0, 0.95
  outs aL, aR
  clear gaMixL, gaMixR
endin

</CsInstruments>`;
    const instruments = `instr 1
  ipch=cpspch(p4)
  iamp=p5
  kwow lfo ipch*0.004, 0.3, 0
  kf = ipch+kwow
  aenv linsegr 0, ${atk}, iamp, p3-${atk}, iamp*0.8, 2.5, 0
${padSrc}
  asig = asig*aenv
  gaMixL=gaMixL+asig*${I.pad.level}
  gaMixR=gaMixR+asig*${I.pad.level}
  gaRevL=gaRevL+asig*${I.pad.send}
  gaRevR=gaRevR+asig*${I.pad.send}
  gaDelL=gaDelL+asig*${I.pad.dsend}
  gaDelR=gaDelR+asig*${I.pad.dsend}
endin

instr 2
  ipch=cpspch(p4)
  iamp=p5
  aenv linsegr 0, 0.012, iamp, p3-0.05, iamp*0.5, 0.10, 0
${bassSrc}
  asig=a1*aenv
  gaMixL=gaMixL+asig*${I.bass.level}
  gaMixR=gaMixR+asig*${I.bass.level}
  gaRevL=gaRevL+asig*${I.bass.send}
  gaRevR=gaRevR+asig*${I.bass.send}
  gaDelL=gaDelL+asig*${I.bass.dsend}
  gaDelR=gaDelR+asig*${I.bass.dsend}
endin

instr 5
  itab = p6
  ipit = p7
  ioff = p8
  icut = (p9 > 0 ? p9 : 3500)
  idsend = (p10 > 0 ? p10 : 0.2)        ; per-event delay send (default 0.2; VO modulates it in/out)
  aenv linsegr 0, 0.006, p5, p3-0.04, p5*0.85, 0.03, 0
  andx phasor (sr*ipit)/nsamp(itab)
  asig tablei frac(andx + ioff), itab, 1, 0, 1
  asig moogladder asig, icut, 0.08
  asig = asig*aenv
  gaMixL=gaMixL+asig
  gaMixR=gaMixR+asig
  gaRevL=gaRevL+asig*0.3
  gaRevR=gaRevR+asig*0.3
  gaDelL=gaDelL+asig*idsend
  gaDelR=gaDelR+asig*idsend
endin

${melodyVoiceBlock(4, I.melody)}${soloInstrBlocks?"\n\n"+soloInstrBlocks:""}

instr 10
  iamp=p4*${I.drums.kick}
${kickSrc}
  gaMixL=gaMixL+a1
  gaMixR=gaMixR+a1
  gaRevL=gaRevL+a1*${(I.drums.send*0.35).toFixed(3)}
  gaRevR=gaRevR+a1*${(I.drums.send*0.35).toFixed(3)}
endin

instr 11
  iamp=p4*${I.drums.snare}
${snareSrc}
  gaMixL=gaMixL+asig
  gaMixR=gaMixR+asig
  gaRevL=gaRevL+asig*${I.drums.send}
  gaRevR=gaRevR+asig*${I.drums.send}
${drumDel("asig")}endin

instr 12
  iamp=p4*${I.drums.hat}
${hatSrc}
  gaMixL=gaMixL+asig*0.7
  gaMixR=gaMixR+asig*0.7
  gaRevL=gaRevL+asig*${(I.drums.send*0.3).toFixed(3)}
  gaRevR=gaRevR+asig*${(I.drums.send*0.3).toFixed(3)}
${drumDel("asig*0.5")}endin

instr 6
  ipch=cpspch(p4)
  iamp=p5
  aenv transeg 1, p3, -5, 0
  a1 vco2 1, ipch, 0
  a2 vco2 1, ipch*1.189, 0
  a3 vco2 1, ipch*1.498, 0
  a4 vco2 1, ipch*2.003, 0
  asig=(a1+a2+a3+a4)*0.25
  asig moogladder asig, 3200, 0.2
  asig=asig*aenv*iamp
  gaMixL=gaMixL+asig
  gaMixR=gaMixR+asig
  gaRevL=gaRevL+asig*0.35
  gaRevR=gaRevR+asig*0.35
  gaDelL=gaDelL+asig*0.3
  gaDelR=gaDelR+asig*0.3
endin
`;
    return { header, instruments };
  }
  function orchestra(state, sources){
    const c = codegen(state, sources);
    return c.header.slice(0, c.header.lastIndexOf("</CsInstruments>")) + c.instruments + "\n</CsInstruments>";
  }

  function buildCsd(state){
    const ev=buildEvents(state);
    const used=new Set(ev.found.map(f=>f.tableNum));
    const srcByTable=Object.values(ev.srcById).filter(s=>used.has(s.tableNum)).sort((a,b)=>a.tableNum-b.tableNum);
    const L=[`t 0 ${state.bpm}`, `i 100 0 ${ev.totalBeats}`, `i 99 0 ${ev.totalBeats}`, `i 98 0 ${ev.totalBeats}`];
    if(state.crackle>0) L.push(`i 97 0 ${ev.totalBeats} ${Math.min(1,state.crackle)}`);
    ev.found.forEach(f=>{
      if(f.chop) L.push(`i 5 ${f.beat.toFixed(3)} ${f.dur.toFixed(3)} 0 ${f.amp} ${f.tableNum} ${f.pitch} ${f.offset.toFixed(3)} ${f.cutoff}${f.dsend!=null?" "+f.dsend.toFixed(3):""}`);
      else L.push(`i 3 ${f.beat.toFixed(3)} ${f.dur} 0 ${f.amp} ${f.tableNum} ${f.pitch} ${f.stretch} ${f.cutoff}`);
    });
    const inst={pad:1,bass:2,melody:4};
    const solos=soloVoices(state, state.instruments&&state.instruments.melody);
    ev.pitched.forEach(p=>{
      let n=inst[p.voice];
      if(p.voice==="melody"&&p.solo){ const v=solos.find(x=>x.key===JSON.stringify(p.solo)); if(v) n=v.num; }
      L.push(`i ${n} ${p.beat.toFixed(3)} ${p.dur.toFixed(3)} ${p.pch} ${p.amp.toFixed(4)}`);
    });
    const dinst={kick:10,snare:11,hat:12};
    ev.drums.forEach(d=>L.push(`i ${dinst[d.drum]} ${d.beat.toFixed(3)} ${d.dur.toFixed(3)} ${d.amp.toFixed(4)}`));
    ev.sfx.forEach(s=>{
      if(s.stab) L.push(`i 6 ${s.beat.toFixed(3)} ${s.dur} ${s.pch} ${s.amp.toFixed(3)}`);
      else if(s.sweep) L.push(`i 96 ${s.beat.toFixed(3)} ${s.dur} ${s.from} ${s.to}`);
      else L.push(`i 20 ${s.beat.toFixed(3)} ${s.dur} ${s.type} ${s.amp}`);
    });
    return orchestra(state,srcByTable)+"\n<CsScore>\n"+L.join("\n")+"\ne\n</CsScore>\n</CsoundSynthesizer>\n";
  }

  // live mode: header boots once; instruments recompile via csound compileOrc
  const liveParts=(state,sources)=>codegen(state,sources||[],{channels:true});
  const api={ buildCsd, buildEvents, defaultState, defaultInstruments, generateSong, voicing, liveParts,
    instrumentBlock:(state)=>codegen(state,[],{channels:true}).instruments,
    PROGRESSIONS, STYLES, WAVES, BASS_PATTERNS, MELODY_PATTERNS, DRUM_PATTERNS, TRANSITIONS, pchAdd, pchToMidi };
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  else root.CsdEngine=api;
})(typeof window!=="undefined" ? window : globalThis);
