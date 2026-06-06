// song-verifier.js — the VERIFIER half of the good loop.
//
// The builder is a generator; on its own it has good_loop_signal but no gate.
// This is the gate: a music-theory + arrangement heuristic that scores a song
// on banger-relevant dimensions and returns actionable feedback (the
// feedback_path). It is NOT a learned model — genre/"banger" is irreducibly
// taste (catalog verifiers 12.33 genre-conformance, 17.43 no-formal-verifier).
// A trained discriminator would be the next rung; this is the honest, runnable
// gate that catches the obvious ways an arrangement fails to land.
//
//   analyzeSong(state) -> { score, grade, dimensions[], suggestions[] }
//   improveSong(state) -> a new state with the highest-leverage fixes applied

(function (root) {
  "use strict";
  const Eng = (typeof CsdEngine !== "undefined") ? CsdEngine
            : (typeof require !== "undefined") ? require("./csd-engine.js") : null;

  const drumEnergy = (d) => d==="off"||!d ? 0 : d==="kick"?0.8 : d==="halftime"?1.0 : 1.6;
  function energyOf(s){
    let e=0;
    if(s.pads) e+=1;
    if(s.bass && s.bass!=="off") e+=1.2;
    e += drumEnergy(s.drums);
    if(s.melody && s.melody!=="off") e+=1.2;
    if(s.found && s.found.sourceId) e+=0.5;
    return e;
  }

  function analyzeSong(state){
    const ev = Eng.buildEvents(state);
    const prog = Eng.PROGRESSIONS[state.progression] || Eng.PROGRESSIONS.royal_road;
    const secs = state.sections || [];
    const dims = [], sugg = [];
    const energy = secs.map(energyOf);
    const maxE = Math.max(0.001, ...energy), minE = secs.length?Math.min(...energy):0;
    const peak = Math.max(0, energy.indexOf(maxE));
    const chorus = secs[peak] || {};

    // 1 — build & dynamics
    const contrast = (maxE - minE) / maxE;
    dims.push({ name:"Build & dynamics", w:1.3, score: Math.round(Math.min(1, contrast/0.6)*100),
      note: contrast<0.3 ? "sections too similar" : "good contrast" });
    if(contrast<0.3) sugg.push("Sections are all similar energy — strip the intro/bridge (drop drums & bass) so the chorus hits harder.");

    // 2 — harmony
    const nch = prog.chords.length;
    dims.push({ name:"Harmony", w:1.0, score: Math.round(Math.min(1,nch/4)*80+20), note: nch+" chords" });
    if(nch<3) sugg.push("Very few chords — pick a richer progression for more movement.");

    // 3 — the drop (is the loudest section actually full?)
    let drop=100; const miss=[];
    if(!(chorus.drums&&chorus.drums!=="off")){ drop-=40; miss.push("no drums"); sugg.push("Your peak section has no drums — give the chorus a full kit."); }
    if(!(chorus.bass&&chorus.bass!=="off")){ drop-=30; miss.push("no bass"); sugg.push("No bass under the peak — add a bassline so the low end lands."); }
    if(!(chorus.melody&&chorus.melody!=="off")){ drop-=20; miss.push("no hook"); sugg.push("No melodic hook in the chorus — add a lead."); }
    dims.push({ name:"The drop", w:1.5, score: Math.max(0,drop), note: miss.length?miss.join(", "):"full" });

    // 4 — hook / repetition
    const highs = energy.filter(e=>e>=maxE*0.85).length;
    dims.push({ name:"Hook / repetition", w:1.3, score: highs>=2?100:highs===1?60:30, note: highs+" chorus-level" });
    if(highs<2) sugg.push("Repeat the chorus at least once — a banger needs a hook you hear again.");

    // 5 — groove
    let groove=75;
    if(ev.drums.length===0){ groove=10; sugg.push("No drums anywhere — add a groove."); }
    if((state.swing||0)===0 && (state.humanize||0)===0){ groove-=15; sugg.push("Add a little swing or humanize so the groove breathes."); }
    dims.push({ name:"Groove", w:1.2, score: Math.max(0,groove), note: ev.drums.length+" hits" });

    // 6 — fullness / spectrum
    const hasPads=secs.some(s=>s.pads), hasBass=secs.some(s=>s.bass&&s.bass!=="off"),
          hasMel=secs.some(s=>s.melody&&s.melody!=="off"), hasDr=ev.drums.length>0;
    const spec=[hasPads,hasBass,hasMel,hasDr].filter(Boolean).length;
    dims.push({ name:"Fullness", w:1.0, score: spec*25, note: spec+"/4 layers" });
    if(!hasBass) sugg.push("No bass anywhere — the mix will feel thin.");
    if(!hasMel) sugg.push("No melody anywhere — add a lead somewhere.");

    // 7 — space / texture
    const space = Math.min(100, Math.round(Math.min(1,((state.reverb||0)-0.4)/0.5)*50
      + ((state.delay&&state.delay.feedback>0)?25:0)
      + (secs.some(s=>s.found&&s.found.sourceId)?25:0)));
    dims.push({ name:"Space / texture", w:0.8, score: Math.max(0,space), note:"" });

    // 8 — tension & release
    const fills = secs.filter(s=>s.fillInto).length;
    dims.push({ name:"Tension & release", w:0.8, score: fills>=1?100:50, note: fills+" fills" });
    if(fills===0) sugg.push("Add a drum fill (⚡) into the chorus for lift.");

    // 9 — form / length
    dims.push({ name:"Form", w:0.8, score: secs.length>=6?100:secs.length>=4?75:40, note: secs.length+" sections" });
    if(secs.length<4) sugg.push("Song is short — add sections (verse / chorus / bridge).");

    let tw=0, ts=0; dims.forEach(d=>{ tw+=d.w; ts+=d.w*d.score; });
    const score = Math.round(ts/Math.max(1,tw));
    const grade = score>=85?"🔥 banger" : score>=70?"strong" : score>=55?"decent" : "needs work";
    return { score, grade, dimensions: dims, suggestions: sugg.slice(0,6) };
  }

  // apply the highest-leverage fixes (the feedback acted upon)
  function improveSong(state){
    const s = JSON.parse(JSON.stringify(state));
    const secs = s.sections || [];
    if(!secs.length) return s;
    const energy = secs.map(energyOf);
    const peak = Math.max(0, energy.indexOf(Math.max(...energy)));
    const c = secs[peak];
    c.pads = true;
    if(!c.bass || c.bass==="off") c.bass = "simple";
    if(!c.drums || c.drums==="off") c.drums = "full";
    if(!c.melody || c.melody==="off") c.melody = (s.progression==="royal_road")?"composed":"arpup";
    if(peak>0) secs[peak-1].fillInto = true;           // fill into the drop
    // ensure a second chorus-level section (a repeated hook)
    const hi = energy.map(e=>e>=Math.max(...energy)*0.85).filter(Boolean).length;
    if(hi<2 && secs.length>peak+2){
      const t = secs[secs.length-2];
      t.pads=true; t.bass=t.bass&&t.bass!=="off"?t.bass:"walking"; t.drums="open";
      t.melody=t.melody&&t.melody!=="off"?t.melody:(s.progression==="royal_road"?"composed2":"updown");
    }
    if((s.swing||0)===0) s.swing = 0.08;               // a touch of groove
    return s;
  }

  const api = { analyzeSong, improveSong };
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  else root.SongVerifier=api;
})(typeof window!=="undefined" ? window : globalThis);
