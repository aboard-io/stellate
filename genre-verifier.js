// genre-verifier.js — does this state actually sound like the genre it claims?
// The verifier half of the genre kernel's loop (catalog 12.33 genre-conformance).
//
// Features are extracted SYMBOLICALLY from buildEvents(state) — rhythm
// syncopation, snare/kick balance, hat density, harmonic motion, seventh-chord
// color, reverb wash, sub presence, break/chop usage, production scalars,
// per-chord variation — then scored against per-genre target ranges.
//
//   analyze(state)            -> {features, scores:{genre:0-100}, best}
//   report(state)             -> printable report
//   node genre-verifier.js matrix          confusion matrix over all anchors
//   node genre-verifier.js <state.json>    score one state

(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const E = isNode ? require("./csd-engine.js") : root.CsdEngine;

  function features(state){
    const ev=E.buildEvents(state);
    const beats=Math.max(1,ev.totalBeats);
    const drums=ev.drums;
    const kicks=drums.filter(d=>d.drum==="kick"), snares=drums.filter(d=>d.drum==="snare"), hats=drums.filter(d=>d.drum==="hat");
    const Iv=(state.instruments&&state.instruments.drums)||{};
    const lev={kick:Iv.kick??1,snare:Iv.snare??1,hat:Iv.hat??1};
    const sum=(a)=>a.reduce((s,e)=>s+e.amp*(lev[e.drum]||1),0);   // what you HEAR: amp × kit level
    const offgrid=drums.length?drums.filter(d=>{const f=d.beat*2-Math.round(d.beat*2);return Math.abs(f)>0.08;}).length/drums.length:0;
    // per-8-beat-window drum signatures: how much does the pattern actually vary?
    const wins={};
    drums.forEach(d=>{const w=Math.floor(d.beat/8);(wins[w]=wins[w]||[]).push((Math.round((d.beat%8)*4)/4)+d.drum[0]+Math.round(d.amp*10));});
    const sigs=Object.values(wins).map(w=>w.sort().join(","));
    const variation=sigs.length?new Set(sigs).size/sigs.length:0;
    const I=state.instruments||E.defaultInstruments();
    const prog=E.PROGRESSIONS[state.progression]||E.PROGRESSIONS.royal_road;
    const roots=new Set(prog.chords.map(c=>c.name.replace(/[^A-G#b]/g,"").slice(0,2)));
    const secs=state.sections||[];
    const role=(r)=>secs.filter(s=>s.found&&s.found.sourceId&&(s.found.role||"bed")===r).length/Math.max(1,secs.length);
    return {
      bpm: state.bpm,
      offgrid: +offgrid.toFixed(3),
      snareBalance: +(sum(snares)/(sum(kicks)+0.001)).toFixed(2),
      hatDensity: +(hats.length/beats).toFixed(2),
      drumDensity: +(drums.length/beats).toFixed(2),
      variation: +variation.toFixed(2),
      wash: +(((state.reverb||0)*(0.55*(I.pad.send||0)+0.45*(I.drums.send||0)))).toFixed(3),
      sub: I.bass.model==="sub"||I.bass.model==="reese" ? 1 : (I.bass.cutoff<550?0.6:0.2),
      motion: +(Math.min(1,(roots.size-1)/3)).toFixed(2),
      seventh: +(prog.chords.filter(c=>/7/.test(c.name)).length/prog.chords.length).toFixed(2),
      breakUse: +role("break").toFixed(2),
      chopUse: +role("chops").toFixed(2),
      bedUse: +role("bed").toFixed(2),
      crackle: state.crackle||0, pump: state.pump||0, comp: state.comp||0,
      swing: state.swing||0,
      leadVoices: I.melody.voices||2,
      softTop: state.tone&&state.tone.highcut>0?1:0,
    };
  }

  // per-genre target ranges: [lo, hi, weight]
  const TARGETS = {
    techno:   { bpm:[120,145,3], offgrid:[0,.3,1], snareBalance:[0,.6,2], wash:[0,.32,2], motion:[0,.4,2],
                pump:[.3,1,2], comp:[.4,1,1], drumDensity:[1.4,4.5,1], breakUse:[0,.15,1], variation:[.3,1,1],
                swing:[0,.07,2] },
    house:    { bpm:[114,130,3], offgrid:[.05,.5,1], snareBalance:[0,.7,2], pump:[.2,1,1], comp:[.3,1,1],
                motion:[.15,.8,1], wash:[0,.4,1], hatDensity:[1.2,3,1], chopUse:[.2,1,1], swing:[.08,.3,2] },
    jungle:   { bpm:[150,180,3], offgrid:[.22,.75,2], snareBalance:[0,.95,2], sub:[.6,1,2], wash:[0,.35,2],
                breakUse:[.35,1,3], drumDensity:[1.8,6,1], variation:[.4,1,1] },
    triphop:  { bpm:[66,96,3], crackle:[.25,1,2], breakUse:[.15,1,2], offgrid:[.12,.65,1], wash:[.18,.6,1],
                swing:[.1,.4,1], snareBalance:[0,.9,1], softTop:[1,1,1] },
    vaporwave:{ bpm:[58,92,3], wash:[.35,1,3], motion:[.5,1,2], seventh:[.5,1,2], breakUse:[0,.1,1],
                snareBalance:[0,.85,1], comp:[0,.25,1], bedUse:[.4,1,2] },
    synthwave:{ bpm:[84,120,3], leadVoices:[4,9,2], wash:[.25,.7,1], motion:[.3,1,1], pump:[.05,.6,1],
                snareBalance:[.4,1.4,1], sub:[0,.8,1], bedUse:[.3,1,1] },
    lofi:     { bpm:[66,92,3], crackle:[.4,1,3], swing:[.14,.4,2], seventh:[.5,1,1], softTop:[1,1,2],
                snareBalance:[0,.8,1], wash:[.1,.5,1] },
    downtempo:{ bpm:[60,90,3], wash:[.28,.8,2], drumDensity:[.2,2.2,2], motion:[.3,1,1], comp:[0,.4,1],
                snareBalance:[0,.8,1], bedUse:[.4,1,1] },
    ambient:  { bpm:[52,76,2], drumDensity:[0,.6,3], wash:[.4,1,3], motion:[0,.9,1], pump:[0,.1,1],
                snareBalance:[0,1,0.5], bedUse:[.6,1,2] },
  };

  function scoreAgainst(f, genre){
    const T=TARGETS[genre]; if(!T) return {score:0,notes:["unknown genre"]};
    let tw=0, ts=0; const notes=[];
    for(const [k,[lo,hi,w]] of Object.entries(T)){
      const v=f[k]; if(v==null) continue;
      let s;
      if(v>=lo&&v<=hi) s=1;
      else { const width=Math.max(hi-lo,0.001), d=v<lo?lo-v:v-hi; s=Math.max(0,1-d/width); }
      if(s<0.65) notes.push(`${k}=${v} wants [${lo},${hi}]`);
      tw+=w; ts+=w*s;
    }
    return {score:Math.round(100*ts/tw), notes};
  }

  function analyze(state){
    const f=features(state);
    const scores={}; let best=null;
    for(const g of Object.keys(TARGETS)){ scores[g]=scoreAgainst(f,g).score; if(!best||scores[g]>scores[best]) best=g; }
    return {features:f, scores, best};
  }

  function report(state){
    const a=analyze(state);
    const claimed=(state.genreMeta&&state.genreMeta.genres)||[];
    const lines=["genre scores: "+Object.entries(a.scores).sort((x,y)=>y[1]-x[1]).slice(0,4).map(([g,s])=>`${g}:${s}`).join(" ")];
    for(const g of new Set(claimed)){
      const r=scoreAgainst(a.features,g);
      lines.push(`vs ${g}: ${r.score}` + (r.notes.length?`  — ${r.notes.slice(0,4).join("; ")}`:""));
    }
    return lines.join("\n");
  }

  const api={ features, scoreAgainst, analyze, report, TARGETS };
  if(isNode) module.exports=api; else root.GenreVerifier=api;

  if(isNode && require.main===module){
    const fs=require("fs");
    const cmd=process.argv[2];
    if(cmd==="matrix"){
      const K=require("./genre-kernel.js");
      const genres=Object.keys(TARGETS);
      const rows=[];
      console.log("            "+genres.map(g=>g.slice(0,7).padStart(8)).join(""));
      let diagOk=0;
      for(const g of genres){
        const cells=[];
        for(const tgt of genres){
          let s=0;
          for(const seed of [1,2,3]) s+=scoreAgainst(features(K.track(g,{seed})),tgt).score;
          cells.push(Math.round(s/3));
        }
        const diag=cells[genres.indexOf(g)];
        const maxOff=Math.max(...cells.filter((_,i)=>i!==genres.indexOf(g)));
        if(diag>=maxOff) diagOk++;
        console.log(g.padEnd(11)+(cells.map((c,i)=>String(c).padStart(8-(i===genres.indexOf(g)?1:0))+(i===genres.indexOf(g)?"*":"")).join("")));
        rows.push({g,cells,diag,maxOff});
      }
      console.log(`\ndiagonal dominant: ${diagOk}/${genres.length}`);
      for(const r of rows) if(r.diag<r.maxOff)
        console.log(`  ✗ ${r.g}: self=${r.diag} < best-other=${r.maxOff} (${genres[r.cells.indexOf(r.maxOff)]})`);
      process.exit(diagOk===genres.length?0:1);
    } else if(cmd){
      const state=JSON.parse(fs.readFileSync(cmd,"utf8"));
      console.log(report(state));
    } else {
      console.log("usage: genre-verifier.js matrix | <state.json>");
    }
  }
})(typeof window!=="undefined"?window:globalThis);
