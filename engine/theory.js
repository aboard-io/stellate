// theory.js — CsdTheory: the harmony brain (MUSIC-MIND organ #1).
// Pure, seeded, ZERO dependencies — the 3-line pch math and mulberry32 are
// local copies so this file loads standalone (UMD like every engine file).
// Three layers:
//   1. Key/Scale — MODES + chordFromDegree (diatonic tertian stacking with
//      extensions triad/7/9/11/13 and the sus2/sus4/quartal colors)
//   2. Voice-leading — lead(): minimal-motion 4–6 voice voicings held in the
//      pad register the hand PROGRESSIONS use (abs 84..105 ≈ pch 7.00–8.09);
//      styles close|open|drop2|quartal|cluster shape the FIRST voicing, then
//      total-displacement minimization + common-tone retention takes over.
//   3. progress() — the functional-harmony walk: a T→S→D→T weighted graph on
//      the mode's degrees whose adventure∈[0,1] gates, in order:
//        0–.25  diatonic triads/7ths only
//        .25–.5 + modal interchange (borrowed iv/bVI/bVII in major;
//                 picardy / major IV in minor)
//        .5–.75 + secondary dominants (V/x approaching cadence points)
//        .75–1  + chromatic mediants & tritone subs
//      color∈[0,1] scales extension richness (triads → 13ths) on its own rng
//      stream. Cadence anchoring: first chord IS the tonic and the last bar
//      stays tonic-functional — the listener's handrail (MUSIC-MIND taste
//      constraint). Deterministic: same seed → byte-identical chords.
// toProgression() emits the EXACT shape buildEvents consumes
// ({name, pads[4..6], bass{r5,r6,f6}, lead[4]}); reharmonize() regenerates an
// existing PROGRESSIONS entry at the same length — the buildEvents entry
// point when state.theory.reharm is set.
(function (root) {
  "use strict";

  // ---- pch math + rng (reimplemented locally — zero deps by contract) ----
  function parsePch(s){ const [o,ss]=String(s).split("."); return parseInt(o,10)*12+parseInt(ss,10); }
  function toPch(abs){ const o=Math.floor(abs/12), ss=abs%12; return o+"."+String(ss).padStart(2,"0"); }
  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const clamp01=x=>x<0?0:x>1?1:x;
  const mod12=x=>((x%12)+12)%12;

  // ---- 1. Key/Scale -------------------------------------------------------
  const MODES={
    ionian:        [0,2,4,5,7,9,11],
    dorian:        [0,2,3,5,7,9,10],
    phrygian:      [0,1,3,5,7,8,10],
    lydian:        [0,2,4,6,7,9,11],
    mixolydian:    [0,2,4,5,7,9,10],
    aeolian:       [0,2,3,5,7,8,10],
    locrian:       [0,1,3,5,6,8,10],
    harmonicMinor: [0,2,3,5,7,8,11],
    melodicMinor:  [0,2,3,5,7,9,11],   // ascending form throughout
    hijaz:         [0,1,4,5,7,8,10],   // phrygian dominant — the arab-pop color
    majPent:       [0,2,4,7,9],
    minPent:       [0,3,5,7,10] };
  const NAMES=["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
  const QUAL={maj:[0,4,7],min:[0,3,7],dim:[0,3,6],aug:[0,4,8],
              maj7:[0,4,7,11],min7:[0,3,7,10],dom7:[0,4,7,10],m7b5:[0,3,6,10]};
  const EXT_STEPS={triad:3,"7":4,"9":5,"11":6,"13":7};   // tertian stack heights

  function scaleOf(mode){ const s=Array.isArray(mode)?mode:MODES[mode];
    if(!s) throw new Error("CsdTheory: unknown mode '"+mode+"'"); return s; }
  // interval from scale degree d up k scale steps (wraps with octaves — also
  // makes the 5-note pentatonics stack correctly with the same formula)
  function stepIv(scale,d,k){ const n=scale.length;
    const at=j=>scale[((j%n)+n)%n]+12*Math.floor(j/n);
    return at(d+k)-at(d); }
  function tertian(scale,d,h){ const ivs=[]; for(let k=0;k<h;k++) ivs.push(stepIv(scale,d,2*k)); return ivs; }

  // compact hand-table-flavored chord names from an interval stack
  function qualName(ivs,tag){
    if(tag) return tag;                                  // sus2/sus4/q pass through
    const s=new Set(ivs.map(mod12));
    const third=s.has(4)?4:s.has(3)?3:0, fifth=s.has(7)?7:s.has(6)?6:s.has(8)?8:0;
    const sev=s.has(10)?10:s.has(11)?11:0;
    const ext=ivs.length>=7?"13":ivs.length===6?"11":ivs.length===5?"9":sev?"7":"";
    if(!third) return (sev?"7":"")+(s.has(5)?"sus4":s.has(2)?"sus2":"5");
    if(third===3&&fifth===6) return sev===10?"m7b5":"dim";
    if(third===3) return sev===11?("mMaj"+(ext||"7")):sev?("m"+ext):"m";
    if(fifth===8&&!sev) return "aug";
    return sev===11?("maj"+(ext||"7")):sev?ext:"";
  }
  // one chord literal: absolute root pc + interval stack (+optional sus/q tag)
  function mk(rootPc,ivs,func,degree,tag){ rootPc=mod12(rootPc);
    return { name:NAMES[rootPc]+qualName(ivs,tag), rootPc, ivs:ivs.slice(),
             pcs:ivs.map(iv=>mod12(rootPc+iv)), func:func||"T", degree:degree|0 }; }

  // diatonic chord on a scale degree. opts: {ext:"triad"|"7"|"9"|"11"|"13"|
  // "sus2"|"sus4"|"quartal", quality:"maj"|"min"|"dom7"|...} — quality wins.
  // Key-agnostic (root C=0); progress() transposes into the actual key.
  function chordFromDegree(mode,degree,opts){
    const o=opts||{}, scale=scaleOf(mode), n=scale.length, d=((degree%n)+n)%n;
    let ivs, tag=null;
    if(o.quality) ivs=(QUAL[o.quality]||QUAL.maj).slice();
    else{ const ext=o.ext||"triad";
      if(ext==="sus2"){ ivs=[0,stepIv(scale,d,1),stepIv(scale,d,4)]; tag="sus2"; }
      else if(ext==="sus4"){ ivs=[0,stepIv(scale,d,3),stepIv(scale,d,4)]; tag="sus4"; }
      else if(ext==="quartal"){ ivs=[0,stepIv(scale,d,3),stepIv(scale,d,6),stepIv(scale,d,9)]; tag="q"; }
      else ivs=tertian(scale,d,EXT_STEPS[ext]||3);
    }
    return mk(scale[d],ivs,null,d,tag);
  }

  // shell selection when a chord has more tones than voices: root and color
  // tones first, the fifth last (the jazz-shell priority: 1-3-7-9-13-11-5)
  function shellPcs(rootPc,ivs,maxN){
    const order=[0,1,3,4,6,5,2].filter(i=>i<ivs.length), out=[];
    for(const i of order){ const pc=mod12(rootPc+ivs[i]);
      if(!out.includes(pc)) out.push(pc); if(out.length>=maxN) break; }
    return out;
  }

  // ---- 2. voice leading ---------------------------------------------------
  const REG_LO=84, REG_HI=105;   // hand-table pad register: 7.00..8.09
  function nearestTo(p,pc){ const d=mod12(pc-p); return d<=6? p+d : p+d-12; }
  function clampReg(v){
    for(let i=0;i<v.length;i++){ while(v[i]<REG_LO)v[i]+=12; while(v[i]>REG_HI)v[i]-=12; }
    v.sort((a,b)=>a-b);
    for(let i=1;i<v.length;i++) if(v[i]===v[i-1]&&v[i]+12<=REG_HI) v[i]+=12;  // un-collide unisons upward
    v.sort((a,b)=>a-b); return v;
  }
  // first voicing of a chain — this is where style lives. pcs come in shell
  // priority order (root first); we stack by interval-above-root but banish
  // the 9th-cluster zone (iv 1–2) to the top so seconds don't sit on the root.
  function seedVoicing(pcs,style,voices){
    const sel=pcs.slice(0,voices), rootPc=sel[0];
    const lift=pc=>{ const iv=mod12(pc-rootPc); return iv<3&&iv>0? iv+12: iv; };
    const base=REG_LO+mod12(rootPc-REG_LO);          // root lands in 84..95
    let v=[base];
    if(style==="quartal"){
      for(let i=1;i<voices;i++){ const t=v[i-1]+5; let best=null;  // aim a 4th up, snap to a chord pc
        for(const pc of sel) for(let q=t-mod12(t-pc); q<=t+12; q+=12)
          if(q>v[i-1]&&(best===null||Math.abs(q-t)<Math.abs(best-t))) best=q;
        v.push(best); }
    } else if(style==="cluster"){
      v=sel.map(pc=>base+mod12(pc-rootPc)).sort((a,b)=>a-b);   // one-octave pack, seconds welcome
      while(v.length<voices) v.push(v[v.length-sel.length]+12);
    } else {                                          // close / open / drop2 share the compact stack
      const ord=sel.slice(1).sort((a,b)=>lift(a)-lift(b));
      for(const pc of ord){ const prev=v[v.length-1]; v.push(prev+(mod12(pc-prev)||12)); }
      while(v.length<voices) v.push(v[v.length-sel.length]+12);  // double from the bottom up
      v.sort((a,b)=>a-b);
      if(style==="drop2"&&v.length>=3) v[v.length-2]-=12;        // second-from-top drops an octave
      if(style==="open") for(let i=1;i<v.length;i+=2) if(v[i]+12<=REG_HI) v[i]+=12;
    }
    return clampReg(v);
  }
  // minimal-motion step: each voice takes its nearest chord tone (common tones
  // ride free at cost 0), then a coverage repair moves the cheapest doubled
  // voice onto any pc that went missing — total displacement stays tiny.
  function moveVoices(prev,pcs){
    const out=prev.map(p=>{ let best=p,bd=99;
      for(const pc of pcs){ const q=nearestTo(p,pc), d=Math.abs(q-p); if(d<bd){bd=d;best=q;} }
      return best; });
    for(const pc of pcs){
      const c={}; for(const a of out) c[mod12(a)]=(c[mod12(a)]||0)+1;
      if(c[pc]) continue;
      let bi=-1,bc=1e9,bq=0;
      for(let i=0;i<out.length;i++){ if(c[mod12(out[i])]<2) continue;   // only doubled voices may leave
        const q=nearestTo(prev[i],pc), cost=Math.abs(q-prev[i]);
        if(cost<bc){bc=cost;bi=i;bq=q;} }
      if(bi>=0) out[bi]=bq;
    }
    return clampReg(out);
  }
  // lead(prevVoicing, chordPcs, {style, voices}) → pch strings (sorted).
  // prevVoicing null → seed a fresh voicing in `style`; else minimal motion
  // (style shaped the seed; displacement minimization carries it forward).
  function lead(prevVoicing,chordPcs,opts){
    const o=opts||{}, style=o.style||"close";
    const uniq=[]; for(const pc of chordPcs.map(mod12)) if(!uniq.includes(pc)) uniq.push(pc);
    const voices=Math.max(4,Math.min(6,(o.voices|0)||(prevVoicing&&prevVoicing.length)||uniq.length));
    const pcs=uniq.slice(0,voices);
    if(!prevVoicing||!prevVoicing.length) return seedVoicing(pcs,style,voices).map(toPch);
    return moveVoices(prevVoicing.map(parsePch),pcs).map(toPch);
  }

  // ---- 3. the functional walk --------------------------------------------
  // T→S→D→T transition weights + degree pools (7-note and pentatonic shapes)
  const FUNC_NEXT={T:{T:0.15,S:0.50,D:0.35}, S:{S:0.15,D:0.60,T:0.25}, D:{D:0.10,T:0.75,S:0.15}};
  const POOL7={T:[[0,0.60],[5,0.25],[2,0.15]], S:[[3,0.60],[1,0.40]], D:[[4,0.75],[6,0.25]]};
  const POOL5={T:[[0,1]],                      S:[[1,0.5],[3,0.5]],   D:[[2,0.6],[4,0.4]]};
  // APPLIED_DOM_FLOOR — the floor of the D.2 applied-dominant tier in progress()
  // (was 0.10). 2026-07-25, Paul: "did we get slightly more atonal everywhere?
  // bring it a little bit back." MEASURED: this floor tier adds a uniform ~25% of
  // all secondary dominants across every adventure bucket — the "everywhere"
  // tonicization creep. Halving the floor (0.10→0.05, onset/slope unchanged)
  // removes ~42% of the LOW-adventure (0.25-0.40) floor tonicizations while the
  // HIGH wing (jazz/bebop, 0.55-0.70) keeps ~90% of its spice — a proportional
  // pullback biased to the mild genres, not a revert. (scratch floor.js sweep.)
  const APPLIED_DOM_FLOOR = 0.05;
  // ---- MINED-TABLES BEGIN (tools/mine-theory.js — do not hand-edit) ----
  // Corpus-fit FUNC_NEXT/POOL (MIDIMAN trove via corpus-db, 2026-07-14): 57165+29136
  // deduped files, 3065897+1352325 diatonic root transitions. Held-out mean
  // log-lik (mined vs hand): major -1.6681 vs -1.7982, minor -1.7685 vs -1.9721.
  // OPT-IN via progress({tables:"corpus"}) / state.theory.tables — absent, the
  // hand tables above run byte-identically (test/theory-tables.test.js).
  const MINED={"major":{"FUNC_NEXT":{"T":{"T":0.3021,"S":0.4017,"D":0.2962},"S":{"T":0.5782,"S":0.1031,"D":0.3187},"D":{"T":0.7399,"S":0.2142,"D":0.046}},"POOL":{"T":[[0,0.6037],[2,0.1687],[5,0.2276]],"S":[[1,0.4022],[3,0.5978]],"D":[[4,0.8986],[6,0.1014]]}},"minor":{"FUNC_NEXT":{"T":{"T":0.3975,"S":0.2659,"D":0.3366},"S":{"T":0.6073,"S":0.0591,"D":0.3336},"D":{"T":0.7573,"S":0.1614,"D":0.0813}},"POOL":{"T":[[0,0.5349],[2,0.2219],[5,0.2432]],"S":[[1,0.243],[3,0.757]],"D":[[4,0.5941],[6,0.4059]]}}};
  // ---- MINED-TABLES END ----
  function wpick(pairs,r){ let acc=0; for(const [v,w] of pairs){ acc+=w; if(r<acc) return v; } return pairs[pairs.length-1][0]; }
  function wkey(obj,r){ let acc=0; for(const k in obj){ acc+=obj[k]; if(r<acc) return k; } return "T"; }

  // progress({mode, root, adventure, color, bars, seed, voicing, tables}) → chord[]
  // (each {name, rootPc, ivs, pcs, func, degree, pads}) — one chord per bar.
  // tables:"corpus" swaps FUNC_NEXT/POOL for the MINED block (same walk, same
  // draw count, same handrails); absent → the hand tables, byte-identical.
  function progress(o){
    o=o||{};
    const scale=scaleOf(o.mode||"ionian"), n=scale.length;
    const key=mod12(o.root|0), bars=Math.max(1,(o.bars|0)||4);
    const adv=clamp01(o.adventure==null?0.3:+o.adventure);
    const color=clamp01(o.color==null?0.3:+o.color);
    const style=o.voicing||"close", seed=(o.seed==null?1:o.seed)>>>0;
    // three independent streams so the knobs never disturb each other: the
    // walk ignores adventure/color entirely, and the chromatic pass draws a
    // FIXED 4 numbers per bar — raising adventure only raises thresholds, so
    // chromaticism grows ~monotonically for a fixed seed (test-gated).
    const rngW=mulberry32(seed), rngC=mulberry32((seed+0x9E37)>>>0), rngX=mulberry32((seed+40961)>>>0);
    const majorish=scale.includes(4)&&!scale.includes(3);   // tonic third decides the borrow palette
    // corpus tables (opt-in): 7-note scales only — pentatonic keeps POOL5
    const mined=(o.tables==="corpus"&&typeof MINED!=="undefined"&&n>=6)?MINED[majorish?"major":"minor"]:null;
    const funcNext=mined?mined.FUNC_NEXT:FUNC_NEXT;
    const pool=mined?mined.POOL:(n>=6?POOL7:POOL5);

    // -- the walk (handrail: bar 0 IS the tonic; last bar tonic-functional;
    //    penultimate bar forced dominant — the cadence the ear expects)
    const degs=[0], funcs=["T"];
    for(let i=1;i<bars;i++){
      if(i===bars-1){ const d=rngW()<0.7?0:wpick(pool.T,rngW()); degs.push(d); funcs.push("T"); }
      else if(i===bars-2&&bars>=3){ degs.push(wpick(pool.D,rngW())); funcs.push("D"); }
      else { const f=wkey(funcNext[funcs[i-1]],rngW()); degs.push(wpick(pool[f],rngW())); funcs.push(f); }
    }

    // -- diatonic chords, color-scaled extensions (triad→7→9→11→13)
    const EXTL=["triad","7","9","11","13"];
    const chords=degs.map((d,i)=>{
      const r=rngC();
      let lvl=Math.max(0,Math.min(4,Math.floor(color*4.6+(r-0.5)*1.4)));
      if(funcs[i]==="D"&&i===bars-2&&color>0.3&&lvl<1) lvl=1;   // cadence dominant earns its 7th
      return mk(key+scale[d],tertian(scale,d,EXT_STEPS[EXTL[lvl]]),funcs[i],d);
    });

    // -- the chromatic pass: adventure gates in, most-adventurous first.
    // Bar 0 is never touched; the last bar only ever takes the picardy third
    // (root stays tonic — the handrail holds at both ends).
    const seventh=color>0.35;
    for(let i=1;i<bars;i++){
      const a=rngX(),b=rngX(),c=rngX(),s=rngX();   // fixed draws — see stream note above
      if(i===bars-1){
        if(!majorish&&adv>0.25&&a<(adv-0.25)*1.6&&chords[i].rootPc===key)
          chords[i]=mk(key,seventh?QUAL.maj7:QUAL.maj,"T",0);            // picardy
        continue;
      }
      if(adv>0.75&&c<(adv-0.75)*2.8){
        if(chords[i].func==="D")
          chords[i]=mk(chords[i].rootPc+6,QUAL.dom7,"D",chords[i].degree); // tritone sub
        else{ const m=majorish?[3,8]:[4,9];                                // chromatic mediant, major quality
          chords[i]=mk(key+m[s<0.5?0:1],color>0.5?QUAL.maj7:QUAL.maj,chords[i].func,chords[i].degree); }
      }
      else if(adv>0.5&&b<(adv-0.5)*3.2&&(i===bars-2||(bars>=8&&i===(bars>>1)-1))){
        // secondary dominant approaching a cadence point (V of the next bar;
        // single pass, so it aims at the next bar's pre-substitution root)
        chords[i]=mk(chords[i+1].rootPc+7,QUAL.dom7,"D",chords[i].degree);
      }
      else if(adv>0.32&&b<APPLIED_DOM_FLOOR+(adv-0.32)*1.2&&chords[i+1]&&mod12(chords[i+1].rootPc-key)!==0){
        // BACH-MINUET applied dominant (D.2, Paul: "just a little"): tonicize the
        // NEXT chord whenever it isn't the tonic — a V7/x, the leading-tone
        // accidental of the classical cadence. A low ~5% floor (APPLIED_DOM_FLOOR,
        // trimmed from 10% on 2026-07-25 — see its comment) so a LITTLE chromatic
        // color still appears in mild genres, scaling with adventure
        // (monotone; REUSES `b`, no new draw so the fixed-4-per-bar design holds).
        // The exotic mediant/tritone-sub tiers still own high adventure above.
        chords[i]=mk(chords[i+1].rootPc+7,QUAL.dom7,"D",chords[i].degree);
      }
      else if(adv>0.25&&a<(adv-0.25)*2.2){
        if(majorish)                                                       // borrow from the parallel minor
          chords[i]= s<0.34? mk(key+5,seventh?QUAL.min7:QUAL.min,"S",3)    // iv
                   : s<0.67? mk(key+8,seventh?QUAL.maj7:QUAL.maj,"S",5)    // bVI
                   :         mk(key+10,seventh?QUAL.dom7:QUAL.maj,"S",6);  // bVII
        else chords[i]= chords[i].rootPc===key
                   ? mk(key,QUAL.maj,"T",0)                                // interior picardy flash
                   : mk(key+5,seventh?QUAL.dom7:QUAL.maj,"S",3);           // dorian major IV
      }
    }

    // -- voice-lead the pads: seed in `style`, then minimal motion
    const voices=4+(color>0.55?1:0)+(color>0.8?1:0);
    let prev=null;
    for(const ch of chords) ch.pads=prev=lead(prev,shellPcs(ch.rootPc,ch.ivs,voices),{style,voices});
    return chords;
  }

  // ---- output contract ----------------------------------------------------
  // toProgression(chords, name) → the EXACT shape buildEvents consumes:
  // pads as-is (4..6, register 7.xx–8.xx), lead = bottom-4 pads an octave up
  // (the hand tables are exactly pads+12), bass = voicing()'s convention:
  // r5/r6 the root at octaves 5/6, f6 the fifth ABOVE r6.
  function toProgression(chords,name){
    let prev=null;
    const out=chords.map(ch=>{
      const pads=ch.pads||(prev=lead(prev,ch.pcs||shellPcs(ch.rootPc,ch.ivs,4),{}));
      if(ch.pads) prev=ch.pads;
      const abs=pads.map(parsePch).sort((x,y)=>x-y);
      const r=mod12(ch.rootPc!=null?ch.rootPc:abs[0]);
      return { name:ch.name||NAMES[r],
               pads:abs.map(toPch),
               bass:{ r5:toPch(60+r), r6:toPch(72+r), f6:toPch(72+r+7) },
               lead:abs.slice(0,4).map(a=>toPch(a+12)) };
    });
    return { name:name||"theory", label:name||"theory", chords:out };
  }

  // ---- reharmonize: the buildEvents entry point ---------------------------
  // Take an existing PROGRESSIONS entry as the skeleton: infer key from the
  // first chord's bass root, infer mode by scoring every 7-note mode against
  // the observed pitch-class set (first-chord pcs weighted — that's how
  // blues_12 lands on mixolydian and royal_road on lydian), then regenerate
  // the same NUMBER of chords via progress() + lead().
  const INFER=["ionian","aeolian","dorian","mixolydian","lydian","phrygian",
               "harmonicMinor","melodicMinor","hijaz","locrian"];
  function reharmonize(prg,opts){
    const o=opts||{}, src=prg&&prg.chords;
    if(!src||!src.length) throw new Error("CsdTheory.reharmonize: progression has no chords");
    const key=mod12(parsePch(src[0].bass?src[0].bass.r5:src[0].pads[0]));
    const seen=new Set(); for(const ch of src) for(const p of ch.pads||[]) seen.add(mod12(parsePch(p)));
    const first=new Set((src[0].pads||[]).map(p=>mod12(parsePch(p))));
    let mode="ionian",best=-1e9;
    for(const m of INFER){ const set=new Set(MODES[m].map(iv=>mod12(key+iv)));
      let sc=0; for(const pc of seen) sc+=set.has(pc)?1:-1;
      for(const pc of first) sc+=set.has(pc)?0.5:0;
      if(sc>best){ best=sc; mode=m; } }
    const chords=progress({ mode, root:key, bars:src.length,
      adventure:o.adventure, color:o.color, voicing:o.voicing, tables:o.tables,
      seed:o.seed==null?1:o.seed });
    return toProgression(chords, prg.label||prg.name||"reharm");
  }

  const api={ MODES, NAMES, chordFromDegree, lead, progress, toProgression,
              reharmonize, parsePch, toPch, mulberry32 };
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  else root.CsdTheory=api;
})(typeof window!=="undefined" ? window : globalThis);
