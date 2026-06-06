// csd-engine.js — pure generator for the vaporwave song builder.
// Shared by builder.html, play.html, midi-export.js, and engine.test.js (Node).
//
//   buildEvents(state) -> structured {pitched, drums, found, bpm, totalBeats}
//   buildCsd(state)    -> a complete <CsoundSynthesizer> document (uses buildEvents)
//
// Csound AND MIDI both derive from buildEvents, so they never drift. instr 3
// (found sound) takes its function-table NUMBER as a p-field (p6); table
// numbers must be explicit integers (a named ftgen var passed in the score
// renders silence — learned the hard way).

(function (root) {
  "use strict";

  // ---- pitch helpers (Csound pch: octave.semitone, semitone 00-11) ----
  function parsePch(s){ const [o,ss]=String(s).split("."); return parseInt(o,10)*12+parseInt(ss,10); }
  function toPch(abs){ const o=Math.floor(abs/12), ss=abs%12; return o+"."+String(ss).padStart(2,"0"); }
  function pchAdd(s,semis){ return toPch(parsePch(s)+(semis|0)); }
  // Csound pch -> MIDI note (cpspch(8.00)=261.6Hz=C4=MIDI 60)
  function pchToMidi(s){ const [o,ss]=String(s).split("."); return (parseInt(o,10)-3)*12+parseInt(ss,10); }

  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

  // ---- chord progressions, voiced in C; transposed by state.keyOffset ----
  const PROGRESSIONS = {
    royal_road: {
      label: "Royal Road (IVΔ7-V7-iii7-vi7) — city pop / vaporwave",
      chords: [
        { name:"Fmaj7", pads:["7.05","7.09","8.00","8.04"], bass:{r5:"5.05",r6:"6.05",f6:"6.00"}, lead:["8.05","8.09","9.00","9.04"] },
        { name:"G7",    pads:["7.07","7.11","8.02","8.05"], bass:{r5:"5.07",r6:"6.07",f6:"6.02"}, lead:["8.07","8.11","9.02","9.05"] },
        { name:"Em7",   pads:["7.04","7.07","7.11","8.02"], bass:{r5:"5.04",r6:"6.04",f6:"5.11"}, lead:["8.04","8.07","8.11","9.02"] },
        { name:"Am7",   pads:["7.09","8.00","8.04","8.07"], bass:{r5:"5.09",r6:"6.09",f6:"6.04"}, lead:["8.09","9.00","9.04","9.07"] }
      ],
      composed: [
        [0,1.5,"8.09"],[1.5,0.5,"8.07"],[2,1,"8.09"],[3,2,"9.00"],[5,1.5,"9.04"],[6.5,1.5,"9.02"],
        [8,1,"9.02"],[9,1,"8.11"],[10,2,"8.07"],[12,1,"8.09"],[13,1,"8.11"],[14,2,"9.02"],
        [16,1.5,"9.04"],[17.5,0.5,"9.02"],[18,2,"8.11"],[20,1.5,"8.07"],[21.5,0.5,"8.09"],[22,2,"8.11"],
        [24,1,"9.00"],[25,1,"8.11"],[26,2,"8.09"],[28,1.5,"9.04"],[29.5,0.5,"9.00"],[30,2,"8.09"]
      ],
      composed2: [
        [0,1,"9.00"],[1,1,"9.04"],[2,1,"9.05"],[3,1,"9.04"],[4,2,"9.02"],[6,1,"9.00"],[7,1,"8.11"],
        [8,1.5,"9.02"],[9.5,0.5,"9.04"],[10,1,"9.05"],[11,1,"9.04"],[12,2,"9.02"],[14,2,"8.11"],
        [16,1,"9.04"],[17,1,"9.07"],[18,1,"9.04"],[19,1,"9.02"],[20,2,"8.11"],[22,2,"9.02"],
        [24,1,"9.00"],[25,1,"9.04"],[26,1.5,"9.07"],[27.5,0.5,"9.04"],[28,1,"9.00"],[29,1,"8.09"],[30,2,"8.09"]
      ]
    },
    four_chords: {
      label: "Four chords (I-V-vi-IV) — stadium pop",
      chords: [
        { name:"C",  pads:["7.00","7.04","7.07","8.00"], bass:{r5:"5.00",r6:"6.00",f6:"6.07"}, lead:["8.00","8.04","8.07","9.00"] },
        { name:"G",  pads:["7.07","7.11","8.02","8.07"], bass:{r5:"5.07",r6:"6.07",f6:"6.02"}, lead:["8.07","8.11","9.02","9.07"] },
        { name:"Am", pads:["7.09","8.00","8.04","8.09"], bass:{r5:"5.09",r6:"6.09",f6:"6.04"}, lead:["8.09","9.00","9.04","9.09"] },
        { name:"F",  pads:["7.05","7.09","8.00","8.05"], bass:{r5:"5.05",r6:"6.05",f6:"6.00"}, lead:["8.05","8.09","9.00","9.05"] }
      ]
    },
    sad_pop: {
      label: "Sad pop (vi-IV-I-V)",
      chords: [
        { name:"Am", pads:["7.09","8.00","8.04","8.09"], bass:{r5:"5.09",r6:"6.09",f6:"6.04"}, lead:["8.09","9.00","9.04","9.09"] },
        { name:"F",  pads:["7.05","7.09","8.00","8.05"], bass:{r5:"5.05",r6:"6.05",f6:"6.00"}, lead:["8.05","8.09","9.00","9.05"] },
        { name:"C",  pads:["7.00","7.04","7.07","8.00"], bass:{r5:"5.00",r6:"6.00",f6:"6.07"}, lead:["8.00","8.04","8.07","9.00"] },
        { name:"G",  pads:["7.07","7.11","8.02","8.07"], bass:{r5:"5.07",r6:"6.07",f6:"6.02"}, lead:["8.07","8.11","9.02","9.07"] }
      ]
    },
    doo_wop: {
      label: "'50s doo-wop (I-vi-IV-V)",
      chords: [
        { name:"C",  pads:["7.00","7.04","7.07","8.00"], bass:{r5:"5.00",r6:"6.00",f6:"6.07"}, lead:["8.00","8.04","8.07","9.00"] },
        { name:"Am", pads:["7.09","8.00","8.04","8.09"], bass:{r5:"5.09",r6:"6.09",f6:"6.04"}, lead:["8.09","9.00","9.04","9.09"] },
        { name:"F",  pads:["7.05","7.09","8.00","8.05"], bass:{r5:"5.05",r6:"6.05",f6:"6.00"}, lead:["8.05","8.09","9.00","9.05"] },
        { name:"G",  pads:["7.07","7.11","8.02","8.07"], bass:{r5:"5.07",r6:"6.07",f6:"6.02"}, lead:["8.07","8.11","9.02","9.07"] }
      ]
    },
    ii_v_i: {
      label: "Jazz ii-V-I turnaround",
      chords: [
        { name:"Dm7",   pads:["7.02","7.05","7.09","8.00"], bass:{r5:"5.02",r6:"6.02",f6:"6.09"}, lead:["8.02","8.05","8.09","9.00"] },
        { name:"G7",    pads:["7.07","7.11","8.02","8.05"], bass:{r5:"5.07",r6:"6.07",f6:"6.02"}, lead:["8.07","8.11","9.02","9.05"] },
        { name:"Cmaj7", pads:["7.00","7.04","7.07","7.11"], bass:{r5:"5.00",r6:"6.00",f6:"6.07"}, lead:["8.00","8.04","8.07","8.11"] }
      ]
    }
  };

  const CHORD_BEATS = 8, SOLO_BEATS = 16;

  function defaultState(){
    return {
      bpm:88, keyOffset:0, progression:"royal_road", reverb:0.85,
      padDetune:0.006, padCutoff:1400, seed:1,
      foundSources:[ { id:"tokyo", label:"Tokyo Station (aporee)", url:"https://archive.org/download/aporee_20938_24294/nov19tokyostation1934.ogg", pitch:0.78, stretch:0.45 } ],
      sections:[
        { id:"s1", name:"intro",     type:"solo",   cycles:1, found:{sourceId:"tokyo",role:"solo"}, fillInto:false },
        { id:"s2", name:"A pads",    type:"chords", cycles:1, pads:true, bass:"off",     drums:"off",  melody:"off",       found:{sourceId:"tokyo",role:"bed"}, fillInto:false },
        { id:"s3", name:"B +bass",   type:"chords", cycles:1, pads:true, bass:"simple",  drums:"off",  melody:"off",       found:{sourceId:"tokyo",role:"bed"}, fillInto:false },
        { id:"s4", name:"C +kick",   type:"chords", cycles:1, pads:true, bass:"simple",  drums:"kick", melody:"off",       found:{sourceId:"tokyo",role:"bed"}, fillInto:true },
        { id:"s5", name:"D full",    type:"chords", cycles:1, pads:true, bass:"simple",  drums:"full", melody:"composed",  found:{sourceId:"tokyo",role:"bed"}, fillInto:false },
        { id:"s6", name:"interlude", type:"solo",   cycles:1, found:{sourceId:"tokyo",role:"solo"}, fillInto:true },
        { id:"s7", name:"E reprise", type:"chords", cycles:1, pads:true, bass:"walking", drums:"open", melody:"composed2", found:{sourceId:"tokyo",role:"bed"}, fillInto:false },
        { id:"s8", name:"outro",     type:"solo",   cycles:1, found:{sourceId:"tokyo",role:"solo"}, fillInto:false }
      ]
    };
  }

  // ---------- event generators ----------
  function bassEvents(kind,S,b,k){
    const r5=pchAdd(b.r5,k), r6=pchAdd(b.r6,k), f6=pchAdd(b.f6,k);
    const L = kind==="walking"
      ? [[0,1.0,r5],[1,0.5,r6],[1.5,0.5,f6],[2.5,0.5,r5],[3,1.0,r6],[4,0.5,r5],[4.5,0.5,f6],[5.5,0.5,r6],[6,1.0,r5],[7,0.5,r6],[7.5,0.5,f6]]
      : [[0,1.5,r5],[2,0.5,r6],[3,1.0,f6],[4.5,0.5,r5],[5,1.0,r6],[6.5,1.5,r5]];
    return L.map(([o,d,p])=>({voice:"bass",beat:S+o,dur:d,pch:p,amp:0.22}));
  }
  function drumEvents(kind,S){
    const out=[];
    const k=(o,a)=>out.push({drum:"kick",beat:S+o,dur:0.35,amp:a});
    const s=(o,a)=>out.push({drum:"snare",beat:S+o,dur:0.30,amp:a});
    const h=(o,a,dur)=>out.push({drum:"hat",beat:S+o,dur:dur||0.10,amp:a,open:(dur||0)>0.2});
    if(kind==="kick"){ k(0,0.65);k(4,0.65);h(3.5,0.10);h(7.5,0.10); }
    else if(kind==="full"||kind==="open"){
      k(0,0.65);k(2.5,0.38);k(4,0.65);k(6.5,0.38); s(2,0.42);s(6,0.42);
      const open=kind==="open"; if(open){ s(3.5,0.16); s(7.5,0.16); }
      for(let i=0;i<8;i++){ const o=0.5+i; if(open&&(o===3.5||o===7.5)) h(o,0.16,0.30); else h(o,0.13); }
    }
    return out;
  }
  function fillEvents(S){
    return [
      {drum:"snare",beat:S+0,dur:0.25,amp:0.34},{drum:"snare",beat:S+0.5,dur:0.25,amp:0.36},
      {drum:"snare",beat:S+1,dur:0.22,amp:0.40},{drum:"snare",beat:S+1.25,dur:0.20,amp:0.42},
      {drum:"snare",beat:S+1.5,dur:0.20,amp:0.45},{drum:"snare",beat:S+1.75,dur:0.20,amp:0.48},
      {drum:"kick",beat:S+0,dur:0.30,amp:0.55}
    ];
  }
  function melodyEvents(style,base,prog,chords,k,rng){
    const out=[], cycleBeats=chords.length*CHORD_BEATS;
    const composed = style==="composed"?prog.composed : style==="composed2"?prog.composed2 : null;
    if(composed && cycleBeats===32){
      composed.forEach(([o,d,p])=>out.push({voice:"melody",beat:base+o,dur:d,pch:pchAdd(p,k),amp:0.14}));
      return out;
    }
    const gen=(style==="composed"||style==="composed2")?"arpup":style;
    chords.forEach((chord,ci)=>{
      const S=base+ci*CHORD_BEATS, lead=chord.lead.map(p=>pchAdd(p,k));
      let order;
      if(gen==="arpup") order=[0,1,2,3,2,1,2,3];
      else if(gen==="arpdown") order=[3,2,1,0,1,2,1,0];
      else { order=[]; for(let i=0;i<8;i++) order.push(Math.floor(rng()*4)); }
      for(let i=0;i<8;i++) out.push({voice:"melody",beat:S+i,dur:0.9,pch:lead[order[i]],amp:0.14});
    });
    return out;
  }

  // ---------- the one walk: arrangement -> events ----------
  function buildEvents(state){
    const prog=PROGRESSIONS[state.progression]||PROGRESSIONS.royal_road;
    const chords=prog.chords, k=state.keyOffset|0, cycleBeats=chords.length*CHORD_BEATS;
    const srcById={};
    state.foundSources.forEach((s,i)=>{ srcById[s.id]={id:s.id,tableNum:i+2,fsPath:s.fsPath||("found/"+s.id+".wav"),pitch:s.pitch??0.78,stretch:s.stretch??0.45}; });
    const rng=mulberry32((state.seed??1)>>>0);
    const pitched=[], drums=[], found=[];
    let cur=0;
    for(const sec of state.sections){
      const fsrc = sec.found&&sec.found.sourceId ? srcById[sec.found.sourceId] : null;
      if(sec.type==="solo"){
        const len=(sec.cycles||1)*SOLO_BEATS;
        if(fsrc) found.push({beat:cur,dur:len,amp:0.42,tableNum:fsrc.tableNum,pitch:fsrc.pitch,stretch:fsrc.stretch});
        if(sec.fillInto) fillEvents(cur+len-2).forEach(e=>drums.push(e));
        cur+=len; continue;
      }
      const cycles=sec.cycles||1, secBeats=cycles*cycleBeats;
      if(fsrc){ const amp=(sec.found.role==="solo")?0.42:0.05; found.push({beat:cur,dur:secBeats,amp,tableNum:fsrc.tableNum,pitch:fsrc.pitch,stretch:fsrc.stretch}); }
      for(let c=0;c<cycles;c++){
        const cycleBase=cur+c*cycleBeats;
        chords.forEach((chord,ci)=>{
          const S=cycleBase+ci*CHORD_BEATS;
          if(sec.pads) chord.pads.forEach(p=>pitched.push({voice:"pad",beat:S,dur:CHORD_BEATS,pch:pchAdd(p,k),amp:0.085}));
          if(sec.bass&&sec.bass!=="off") bassEvents(sec.bass,S,chord.bass,k).forEach(e=>pitched.push(e));
          if(sec.drums&&sec.drums!=="off") drumEvents(sec.drums,S).forEach(e=>drums.push(e));
        });
        if(sec.melody&&sec.melody!=="off") melodyEvents(sec.melody,cycleBase,prog,chords,k,rng).forEach(e=>pitched.push(e));
      }
      if(sec.fillInto) fillEvents(cur+secBeats-2).forEach(e=>drums.push(e));
      cur+=secBeats;
    }
    return { bpm:state.bpm, totalBeats:cur+8, pitched, drums, found, srcById };
  }

  // ---------- orchestra ----------
  function orchestra(state, sources){
    const ftgens=sources.map(s=>`gi_src${s.tableNum} ftgen ${s.tableNum}, 0, 0, 1, "${s.fsPath}", 0, 0, 1`).join("\n");
    const dLo=(1-state.padDetune).toFixed(4), dHi=(1+state.padDetune).toFixed(4);
    return `<CsoundSynthesizer>
<CsInstruments>
sr     = 44100
ksmps  = 32
nchnls = 2
0dbfs  = 1

gaRevL init 0
gaRevR init 0
gaMixL init 0
gaMixR init 0

giwin ftgen 1, 0, 16384, 20, 2, 1
${ftgens}

instr 1
  ipch = cpspch(p4)
  iamp = p5
  kwow lfo ipch*0.004, 0.3, 0
  kf   = ipch + kwow
  aenv linsegr 0, 1.5, iamp, p3-1.5, iamp*0.8, 2.5, 0
  a1 vco2 1, kf*${dLo}, 0
  a2 vco2 1, kf, 0
  a3 vco2 1, kf*${dHi}, 0
  asig = (a1+a2+a3)*0.33
  asig moogladder asig, ${state.padCutoff}, 0.15
  asig = asig*aenv
  gaMixL=gaMixL+asig*0.7
  gaMixR=gaMixR+asig*0.7
  gaRevL=gaRevL+asig*0.55
  gaRevR=gaRevR+asig*0.55
endin

instr 2
  ipch = cpspch(p4)
  iamp = p5
  aenv linsegr 0, 0.012, iamp, p3-0.05, iamp*0.5, 0.10, 0
  a1 vco2 1, ipch, 0
  a1 moogladder a1, 700, 0.15
  asig = a1*aenv
  gaMixL=gaMixL+asig
  gaMixR=gaMixR+asig
  gaRevL=gaRevL+asig*0.08
  gaRevR=gaRevR+asig*0.08
endin

instr 3
  iamp = p5
  aenv linsegr 0, 1.5, iamp, p3-3.0, iamp, 1.5, 0
  asig syncgrain iamp, 28, p7, 0.12, p8, p6, giwin, 100
  asig moogladder asig, 2600, 0.1
  asig = asig*aenv
  gaMixL=gaMixL+asig*0.55
  gaMixR=gaMixR+asig*0.55
  gaRevL=gaRevL+asig*0.6
  gaRevR=gaRevR+asig*0.6
endin

instr 4
  ipch = cpspch(p4)
  iamp = p5
  kvib lfo ipch*0.006, 5.2, 0
  kf = ipch + kvib
  aenv linsegr 0, 0.05, iamp, p3-0.12, iamp*0.85, 0.30, 0
  a1 oscili 1, kf
  a2 oscili 1, kf*1.004
  a3 oscili 0.16, kf*2
  asig = (a1+a2)*0.5 + a3
  asig moogladder asig, 3400, 0.05
  asig = asig*aenv
  gaMixL=gaMixL+asig*0.6
  gaMixR=gaMixR+asig*0.6
  gaRevL=gaRevL+asig*0.45
  gaRevR=gaRevR+asig*0.45
endin

instr 10
  iamp = p5
  kp expseg 110, 0.06, 46, p3-0.06, 40
  aenv transeg 1, p3, -4, 0
  a1 oscili iamp*aenv, kp
  a1 = tanh(a1*1.4)*0.8
  gaMixL=gaMixL+a1
  gaMixR=gaMixR+a1
endin

instr 11
  iamp = p5
  aenv transeg 1, p3, -6, 0
  anz noise iamp, 0
  anz butbp anz, 1800, 1600
  at1 oscili iamp*0.5, 300
  at2 oscili iamp*0.3, 185
  asig = (anz+at1+at2)*aenv
  gaMixL=gaMixL+asig
  gaMixR=gaMixR+asig
  gaRevL=gaRevL+asig*0.18
  gaRevR=gaRevR+asig*0.18
endin

instr 12
  iamp = p5
  aenv transeg 1, p3, -8, 0
  anz noise iamp, 0
  anz buthp anz, 7000
  asig = anz*aenv
  gaMixL=gaMixL+asig*0.7
  gaMixR=gaMixR+asig*0.7
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

  // ---------- Csound score from events ----------
  function buildCsd(state){
    const ev=buildEvents(state);
    const used=new Set(ev.found.map(f=>f.tableNum));
    const srcByTable=Object.values(ev.srcById).filter(s=>used.has(s.tableNum)).sort((a,b)=>a.tableNum-b.tableNum);
    const L=[`t 0 ${state.bpm}`, `i 100 0 ${ev.totalBeats}`, `i 99 0 ${ev.totalBeats}`];
    ev.found.forEach(f=>L.push(`i 3 ${f.beat.toFixed(3)} ${f.dur} 0 ${f.amp} ${f.tableNum} ${f.pitch} ${f.stretch}`));
    const inst={pad:1,bass:2,melody:4};
    ev.pitched.forEach(p=>L.push(`i ${inst[p.voice]} ${p.beat.toFixed(3)} ${p.dur} ${p.pch} ${p.amp}`));
    const dinst={kick:10,snare:11,hat:12};
    ev.drums.forEach(d=>L.push(`i ${dinst[d.drum]} ${d.beat.toFixed(3)} ${d.dur} ${d.amp}`));
    return orchestra(state,srcByTable)+"\n<CsScore>\n"+L.join("\n")+"\ne\n</CsScore>\n</CsoundSynthesizer>\n";
  }

  const api={ buildCsd, buildEvents, defaultState, PROGRESSIONS, pchAdd, pchToMidi };
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  else root.CsdEngine=api;
})(typeof window!=="undefined" ? window : globalThis);
