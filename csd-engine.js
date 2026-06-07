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
    canon:      prog("Pachelbel canon",          [["C","maj"],["G","maj"],["A","min7"],["E","min7"],["F","maj7"],["C","maj"],["F","maj7"],["G","dom7"]])
  });

  const CHORD_BEATS=8;
  const WAVES=["sine","saw","square","pulse"];
  const BASS_PATTERNS=["off","root","simple","walking","octaves","sixteenths","dub"];
  const MELODY_PATTERNS=["off","composed","composed2","arpup","arpdown","updown","pentaup","wander","sparse","double"];
  const DRUM_PATTERNS=["off","kick","full","open","four","boombap","halftime","trap"];
  const SFX_NUM={riser:1,sweep:2,downlift:3,impact:4,reverse:5,noise:6};
  // the ⚡ transition control: what happens at the end of a section, into the next
  const TRANSITIONS=["off","drum fill","riser","sweep","downlift","impact","reverse","noise"];

  function defaultInstruments(){
    return {
      pad:    { wave:"saw",  cutoff:1400, res:0.15, detune:0.006, attack:1.5, level:0.7, send:0.55, dsend:0.15 },
      bass:   { wave:"saw",  cutoff:700,  res:0.15, level:1.0, send:0.08, dsend:0.0 },
      melody: { wave:"sine", cutoff:3400, res:0.05, vibrato:0.006, vibRate:5.2, level:0.6, send:0.45, dsend:0.25 },
      drums:  { kick:1.0, snare:1.0, hat:1.0, tune:1.0 }
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
  function bassEvents(kind,S,b,k){
    const r5=pchAdd(b.r5,k), r6=pchAdd(b.r6,k), f6=pchAdd(b.f6,k);
    let L;
    switch(kind){
      case "root":       L=[[0,7.5,r5]]; break;
      case "octaves":    L=[[0,1,r5],[1,1,r6],[2,1,r5],[3,1,r6],[4,1,r5],[5,1,r6],[6,1,r5],[7,1,r6]]; break;
      case "sixteenths": L=[]; for(let i=0;i<16;i++) L.push([i*0.5,0.45,[r5,r6,f6,r6][i%4]]); break;
      case "dub":        L=[[2.5,1.0,r5],[3.5,0.5,r6],[6.5,1.0,r5],[7.5,0.5,f6]]; break;
      case "walking":    L=[[0,1.0,r5],[1,0.5,r6],[1.5,0.5,f6],[2.5,0.5,r5],[3,1.0,r6],[4,0.5,r5],[4.5,0.5,f6],[5.5,0.5,r6],[6,1.0,r5],[7,0.5,r6],[7.5,0.5,f6]]; break;
      default:           L=[[0,1.5,r5],[2,0.5,r6],[3,1.0,f6],[4.5,0.5,r5],[5,1.0,r6],[6.5,1.5,r5]];
    }
    return L.map(([o,d,p])=>({voice:"bass",beat:S+o,dur:d,pch:p,amp:0.22}));
  }
  function drumEvents(kind,S,ci,nc){
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
    if(ci===nc-1 && kind!=="off" && kind!=="halftime"){ s(6.5,.3);s(7,.34);s(7.25,.38);s(7.5,.42);s(7.75,.46); }
    return out;
  }
  function fillEvents(S){
    return [{drum:"snare",beat:S+0,dur:0.25,amp:0.34},{drum:"snare",beat:S+0.5,dur:0.25,amp:0.36},
      {drum:"snare",beat:S+1,dur:0.22,amp:0.40},{drum:"snare",beat:S+1.25,dur:0.20,amp:0.42},
      {drum:"snare",beat:S+1.5,dur:0.20,amp:0.45},{drum:"snare",beat:S+1.75,dur:0.20,amp:0.48},
      {drum:"kick",beat:S+0,dur:0.30,amp:0.55}];
  }
  // generative melody phrases: [beatOffset, dur, leadIndex, octaveShift] over an
  // 8-beat chord — each style has a distinct rhythm + contour (not just chord arps).
  const MEL_PHRASES={
    arpup:   [[0,1,0,0],[1,0.5,1,0],[1.5,0.5,2,0],[2,1,3,0],[3,1,2,0],[4,1,3,0],[5,1,0,1],[6,2,2,1]],
    arpdown: [[0,1.5,3,1],[1.5,0.5,2,1],[2,1,3,0],[3,1,2,0],[4,1,1,0],[5,1,2,0],[6,2,0,0]],
    updown:  [[0,1,0,0],[1,1,2,0],[2,1,3,0],[3,1,2,1],[4,1,3,0],[5,1,2,0],[6,1,1,0],[7,1,0,0]],
    pentaup: [[0,0.5,0,0],[0.5,0.5,2,0],[1,1,3,0],[2,0.5,1,1],[2.5,0.5,3,0],[3,1,0,1],[4.5,0.5,2,0],[5,1,3,0],[6,2,0,1]]
  };
  function melodyEvents(style,base,prg,chords,k,rng){
    const out=[], cycleBeats=chords.length*CHORD_BEATS;
    const comp = style==="composed"?prg.composed : style==="composed2"?prg.composed2 : null;
    if(comp && cycleBeats===32){ comp.forEach(([o,d,p])=>out.push({voice:"melody",beat:base+o,dur:d,pch:pchAdd(p,k),amp:0.14})); return out; }
    let gen=style; if(style==="composed"||style==="composed2") gen="arpup";
    chords.forEach((chord,ci)=>{
      const Sb=base+ci*CHORD_BEATS, lead=chord.lead.map(p=>pchAdd(p,k));
      const note=(o,d,idx,oct)=>out.push({voice:"melody",beat:Sb+o,dur:d,pch:pchAdd(lead[idx],12*(oct||0)),amp:0.14});
      if(gen==="sparse"){ note(0,3,2,0); note(4,3,3,0); return; }
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

  function buildEvents(state){
    const prg=PROGRESSIONS[state.progression]||PROGRESSIONS.royal_road;
    const chords=prg.chords, k=state.keyOffset|0, cycleBeats=chords.length*CHORD_BEATS;
    const srcById={};
    state.foundSources.forEach((s,i)=>{ srcById[s.id]={id:s.id,tableNum:i+2,fsPath:s.fsPath||("found/"+s.id+".wav"),pitch:s.pitch??0.78,stretch:s.stretch??0.45,vol:s.vol??0.22,cutoff:s.cutoff??2600}; });
    const rng=mulberry32((state.seed??1)>>>0);
    const pitched=[], drums=[], found=[], sfx=[];
    let cur=0;
    for(const sec of state.sections){
      const fsrc = sec.found&&sec.found.sourceId ? srcById[sec.found.sourceId] : null;
      const cycles=sec.cycles||1, secBeats=cycles*cycleBeats;
      if(fsrc){ found.push({beat:cur,dur:secBeats,amp:fsrc.vol,tableNum:fsrc.tableNum,pitch:fsrc.pitch,stretch:fsrc.stretch,cutoff:fsrc.cutoff}); }
      for(let c=0;c<cycles;c++){
        const cycleBase=cur+c*cycleBeats;
        chords.forEach((chord,ci)=>{
          const Sp=cycleBase+ci*CHORD_BEATS;
          if(sec.pads) chord.pads.forEach(p=>pitched.push({voice:"pad",beat:Sp,dur:CHORD_BEATS,pch:pchAdd(p,k),amp:0.085}));
          if(sec.bass&&sec.bass!=="off") bassEvents(sec.bass,Sp,chord.bass,k).forEach(e=>pitched.push(e));
          if(sec.drums&&sec.drums!=="off") drumEvents(sec.drums,Sp,ci,chords.length).forEach(e=>drums.push(e));
        });
        if(sec.melody&&sec.melody!=="off") melodyEvents(sec.melody,cycleBase,prg,chords,k,rng).forEach(e=>pitched.push(e));
      }
      // ⚡ transition into the next section
      const tr = sec.fill || (sec.fillInto ? "drum fill" : "off");
      if(tr==="drum fill"){
        fillEvents(cur+secBeats-2).forEach(e=>drums.push(e));
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
  function orchestra(state, sources){
    const I=mergedInstruments(state);
    const ft=sources.map(s=>`gi_src${s.tableNum} ftgen ${s.tableNum}, 0, 0, 1, "${s.fsPath}", 0, 0, 1`).join("\n");
    const dLo=(1-I.pad.detune).toFixed(4), dHi=(1+I.pad.detune).toFixed(4), atk=Math.max(0.05,I.pad.attack), dt=I.drums.tune;
    const dl=state.delay||{beats:0.75,feedback:0.3,cutoff:2600};
    const dsec=Math.min(1.9, Math.max(0.02, (dl.beats||0.75)*60/state.bpm));
    const dfb=Math.min(0.92, Math.max(0, dl.feedback==null?0.3:dl.feedback)), dcut=dl.cutoff||2600;
    return `<CsoundSynthesizer>
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
giwin ftgen 1, 0, 16384, 20, 2, 1
${ft}

instr 1
  ipch=cpspch(p4)
  iamp=p5
  kwow lfo ipch*0.004, 0.3, 0
  kf = ipch+kwow
  aenv linsegr 0, ${atk}, iamp, p3-${atk}, iamp*0.8, 2.5, 0
  a1 ${waveRHS(I.pad.wave,`kf*${dLo}`)}
  a2 ${waveRHS(I.pad.wave,`kf`)}
  a3 ${waveRHS(I.pad.wave,`kf*${dHi}`)}
  asig = (a1+a2+a3)*0.33
  asig moogladder asig, ${I.pad.cutoff}, ${I.pad.res}
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
  a1 ${waveRHS(I.bass.wave,`ipch`)}
  a1 moogladder a1, ${I.bass.cutoff}, ${I.bass.res}
  asig=a1*aenv
  gaMixL=gaMixL+asig*${I.bass.level}
  gaMixR=gaMixR+asig*${I.bass.level}
  gaRevL=gaRevL+asig*${I.bass.send}
  gaRevR=gaRevR+asig*${I.bass.send}
  gaDelL=gaDelL+asig*${I.bass.dsend}
  gaDelR=gaDelR+asig*${I.bass.dsend}
endin

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

instr 4
  ipch=cpspch(p4)
  iamp=p5
  kvib lfo ipch*${I.melody.vibrato}, ${I.melody.vibRate}, 0
  kf=ipch+kvib
  aenv linsegr 0, 0.05, iamp, p3-0.12, iamp*0.85, 0.30, 0
  a1 ${waveRHS(I.melody.wave,`kf`)}
  a2 ${waveRHS(I.melody.wave,`kf*1.004`)}
  a3 oscili 0.16, kf*2
  asig=(a1+a2)*0.5+a3
  asig moogladder asig, ${I.melody.cutoff}, ${I.melody.res}
  asig=asig*aenv
  gaMixL=gaMixL+asig*${I.melody.level}
  gaMixR=gaMixR+asig*${I.melody.level}
  gaRevL=gaRevL+asig*${I.melody.send}
  gaRevR=gaRevR+asig*${I.melody.send}
  gaDelL=gaDelL+asig*${I.melody.dsend}
  gaDelR=gaDelR+asig*${I.melody.dsend}
endin

instr 10
  iamp=p4*${I.drums.kick}
  kp expseg ${110*dt}, 0.06, ${46*dt}, p3-0.06, ${40*dt}
  aenv transeg 1, p3, -4, 0
  a1 oscili iamp*aenv, kp
  a1 = tanh(a1*1.4)*0.8
  gaMixL=gaMixL+a1
  gaMixR=gaMixR+a1
endin

instr 11
  iamp=p4*${I.drums.snare}
  aenv transeg 1, p3, -6, 0
  anz noise iamp, 0
  anz butbp anz, 1800, 1600
  at1 oscili iamp*0.5, 300
  at2 oscili iamp*0.3, 185
  asig=(anz+at1+at2)*aenv
  gaMixL=gaMixL+asig
  gaMixR=gaMixR+asig
  gaRevL=gaRevL+asig*0.18
  gaRevR=gaRevR+asig*0.18
endin

instr 12
  iamp=p4*${I.drums.hat}
  aenv transeg 1, p3, -8, 0
  anz noise iamp, 0
  anz buthp anz, 7000
  asig=anz*aenv
  gaMixL=gaMixL+asig*0.7
  gaMixR=gaMixR+asig*0.7
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
  abufL delayr 2.0
  atL deltap ${dsec}
  atL tone atL, ${dcut}
  delayw gaDelL + atL*${dfb}
  abufR delayr 2.0
  atR deltap ${dsec}
  atR tone atR, ${dcut}
  delayw gaDelR + atR*${dfb}
  gaMixL=gaMixL+atL
  gaMixR=gaMixR+atR
  gaRevL=gaRevL+atL*0.2
  gaRevR=gaRevR+atR*0.2
  clear gaDelL, gaDelR
endin

instr 99
  aL, aR reverbsc gaRevL, gaRevR, ${state.reverb}, 12000
  gaMixL=gaMixL+aL
  gaMixR=gaMixR+aR
  clear gaRevL, gaRevR
endin

instr 100
  aL clip gaMixL, 0, 0.95
  aR clip gaMixR, 0, 0.95
  outs aL, aR
  clear gaMixL, gaMixR
endin

</CsInstruments>`;
  }

  function buildCsd(state){
    const ev=buildEvents(state);
    const used=new Set(ev.found.map(f=>f.tableNum));
    const srcByTable=Object.values(ev.srcById).filter(s=>used.has(s.tableNum)).sort((a,b)=>a.tableNum-b.tableNum);
    const L=[`t 0 ${state.bpm}`, `i 100 0 ${ev.totalBeats}`, `i 99 0 ${ev.totalBeats}`, `i 98 0 ${ev.totalBeats}`];
    ev.found.forEach(f=>L.push(`i 3 ${f.beat.toFixed(3)} ${f.dur} 0 ${f.amp} ${f.tableNum} ${f.pitch} ${f.stretch} ${f.cutoff}`));
    const inst={pad:1,bass:2,melody:4};
    ev.pitched.forEach(p=>L.push(`i ${inst[p.voice]} ${p.beat.toFixed(3)} ${p.dur.toFixed(3)} ${p.pch} ${p.amp.toFixed(4)}`));
    const dinst={kick:10,snare:11,hat:12};
    ev.drums.forEach(d=>L.push(`i ${dinst[d.drum]} ${d.beat.toFixed(3)} ${d.dur.toFixed(3)} ${d.amp.toFixed(4)}`));
    ev.sfx.forEach(s=>L.push(`i 20 ${s.beat.toFixed(3)} ${s.dur} ${s.type} ${s.amp}`));
    return orchestra(state,srcByTable)+"\n<CsScore>\n"+L.join("\n")+"\ne\n</CsScore>\n</CsoundSynthesizer>\n";
  }

  const api={ buildCsd, buildEvents, defaultState, defaultInstruments, generateSong, voicing,
    PROGRESSIONS, STYLES, WAVES, BASS_PATTERNS, MELODY_PATTERNS, DRUM_PATTERNS, TRANSITIONS, pchAdd, pchToMidi };
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  else root.CsdEngine=api;
})(typeof window!=="undefined" ? window : globalThis);
