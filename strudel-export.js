#!/usr/bin/env node
// strudel-export.js — third render target for the genre kernel: Strudel
// (strudel.cc, the TidalCycles JS port). Where csd-engine.js renders an engine
// state to audio and midi-export.js to a Standard MIDI File, this maps the
// state at the DIMENSION level to idiomatic, live-codeable Tidal patterns —
// kits become euclids + conditional variation, the humanity rule becomes
// degradeBy/sometimesBy, the mix dimensions become room/delay/lpf chains.
//
// CYCLE MAPPING: the engine's musical bar is 8 beats and the chord changes
// every bar. One Strudel cycle = one 8-beat chord-bar, so tempo is
// setcpm(bpm/8); quarter-grid = 8 steps/cycle, 8th grid = 16, 16th grid = 32.
//
//   toStrudel(state[, opts]) -> string of Strudel code
//   shareUrl(state)          -> https://strudel.cc/#<base64(utf8 code)>
//   node strudel-export.js <state.json | genreName> [--seed N] [--url]
//
// Deterministic: every choice comes from mulberry32(state.seed), like the
// kernel — the same state always exports the same code.

(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const E = isNode ? require("./csd-engine.js") : root.CsdEngine;

  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const pick=(r,arr)=>arr[Math.floor(r()*arr.length)];
  const R2=x=>Math.round(x*100)/100;
  const R3=x=>Math.round(x*1000)/1000;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

  // sample map: relative by default (works from remix.html locally AND in
  // production, both same-origin); the strudel.cc share path uses the absolute
  // URL — the json has no _base, so entries resolve against the json's own URL.
  const SAMPLES_URL_REL="strudel-samples.json";
  const SAMPLES_URL_ABS="https://aboardresearch.com/projects/vaporwave/strudel-samples.json";

  // ---------- kernel sample/source id -> strudel-samples.json name ----------
  const SAMPLE_MAP={
    amen_165:"amen165", amen_170:"amen170", amen_172:"amen172", amen_175:"amen175",
    bb_horn_a:"bbhorn:0", bb_horn_b:"bbhorn:1",
    bb_stab_a:"bbstab:0", bb_stab_b:"bbstab:1", bb_stab_c:"bbstab:2",
    rave_a:"rave:0", rave_b:"rave:1", rave_c:"rave:2", rave_d:"rave:3",
    vox_a:"apollo:0", vox_b:"apollo:1", vox_c:"apollo:2",
    sp_plaza:"plaza", sp_shopping:"shopping", sp_system:"system", sp_energy:"energy",
    sp_rewind:"rewind", sp_pressure:"pressure", sp_rhythm:"rhythm",
    sp_nightdrive:"nightdrive", sp_herenow:"herenow", sp_slowdown:"slowdown",
    sp_paleo_welcome:"paleo:0", sp_paleo_mesozoic:"paleo:1", sp_paleo_sauropod:"paleo:2",
    sp_paleo_rex:"paleo:3", sp_paleo_bones:"paleo:4", sp_paleo_skies:"paleo:5",
    sp_ca_hockey:"hockey:0", sp_ca_hnic:"hockey:1", sp_ca_cup:"hockey:2",
    sp_ca_topshelf:"hockey:3", sp_ca_fivehole:"hockey:4", sp_ca_gretzky:"hockey:5",
    sp_ca_save:"hockey:6", sp_ca_overtime:"hockey:7", sp_ca_news:"hockey:8",
    sp_ca_justwatchme:"hockey:9", sp_ca_cities:"cacities",
    sp_tw_next:"pa:0", sp_tw_arriving:"pa:1", sp_tw_standclear:"pa:2", sp_tw_express:"pa:3",
    sp_tw_delay:"pa:4", sp_tw_gap:"pa:5", sp_tw_aboard:"pa:6", sp_tw_local:"pa:7",
    sp_tw_terminus:"pa:8", sp_tw_tickets:"pa:9", sp_tw_schedule:"twschedule",
    tw_vocal:"twvocal", tw_arrival:"trainarrival", tw_pass:"trainpass", tw_ding:"traindoor",
    ca_loon:"loon", ca_horn:"goalhorn", horns_78:"horns78", blues_vox_78:"bluesvox78",
    leacock1:"leacock:0", leacock2:"leacock:1", leacock3:"leacock:2", leacock4:"leacock:3",
    tokyo_station:"tokyo_station", shibuya:"shibuya", iriomote:"iriomote", frogs:"frogs",
    factory:"factory", highway_night:"highway_night",
    tw_intrain:"tw_intrain", tw_trains:"tw_trains", tw_stationhall:"tw_stationhall",
    tw_platform:"tw_platform",
    vx_burroughs:"vx_burroughs", vx_ginsberg:"vx_ginsberg", vx_waldman:"vx_waldman",
    vx_blake:"vx_blake", vx_dickinson:"vx_dickinson", vx_whitman:"vx_whitman",
    vx_conet_poacher:"vx_conet_poacher", vx_conet_swedish:"vx_conet_swedish",
    vx_timelady:"vx_timelady", vx_wwvh:"vx_wwvh", vx_apollo:"vx_apollo",
    vx_xminusone:"vx_xminusone", vx_suspense:"vx_suspense", vx_fdr:"vx_fdr", vx_dday:"vx_dday",
    vx_cn_east:"vx_cn_east", vx_cn_march:"vx_cn_march", vx_cn_opera:"vx_cn_opera",
    vx_cn_speech:"vx_cn_speech", vx_sv_choir:"vx_sv_choir", vx_sv_march:"vx_sv_march",
    vx_sv_speech:"vx_sv_speech", vx_sv_radio:"vx_sv_radio",
  };

  // ---------- pitch helpers (engine pch "8.00" == middle C == MIDI 60) ----------
  const NN=["c","c#","d","d#","e","f","f#","g","g#","a","a#","b"];
  const mName=m=>NN[((m%12)+12)%12]+(Math.floor(m/12)-1);
  const pch=(p,k)=>E.pchToMidi(p)+k;

  // ---------- timbre dimension: engine synthesis model -> strudel sound ----------
  const LEAD_SOUND={ stack:"sawtooth", pluck:"triangle", fm:"sine", piano:"piano",
    brass:"gm_brass_section", kpluck:"gm_electric_guitar_muted", fuzz:"sawtooth",
    vocoder:"gm_voice_oohs" };
  const PAD_SOUND={ saw:"sawtooth", organ:"gm_drawbar_organ", fm:"sine",
    choir:"gm_choir_aahs", strings:"gm_string_ensemble_1" };
  const BASS_SOUND={ saw:"sawtooth", sub:"sine", acid:"sawtooth", reese:"sawtooth" };
  const BANK={ "909":"RolandTR909", "808":"RolandTR808", boom:"OberheimDMX" };

  // ---------- melody figures ([beatOffset, dur, leadIndex, octaveShift]) ----------
  // same vocabulary as csd-engine's MEL_PHRASES — the melody DIMENSION, re-voiced
  const FIG={
    arpup:   [[0,1,0,0],[1,0.5,1,0],[1.5,0.5,2,0],[2,1,3,0],[3,1,2,0],[4,1,3,0],[5,1,0,1],[6,2,2,1]],
    arpdown: [[0,1.5,3,1],[1.5,0.5,2,1],[2,1,3,0],[3,1,2,0],[4,1,1,0],[5,1,2,0],[6,2,0,0]],
    updown:  [[0,1,0,0],[1,1,2,0],[2,1,3,0],[3,1,2,1],[4,1,3,0],[5,1,2,0],[6,1,1,0],[7,1,0,0]],
    pentaup: [[0,0.5,0,0],[0.5,0.5,2,0],[1,1,3,0],[2,0.5,1,1],[2.5,0.5,3,0],[3,1,0,1],[4.5,0.5,2,0],[5,1,3,0],[6,2,0,1]],
    hero:  [[0,.5,0,0],[.5,.5,1,0],[1,.5,2,0],[1.5,.5,3,0],[2,.75,2,1],[2.75,.25,3,0],[3,.5,1,0],[3.5,.5,2,0],[4,.5,3,1],[4.5,.5,2,0],[5,.75,0,1],[5.75,.25,3,0],[6,.5,2,0],[6.5,.5,1,0],[7,1,0,1]],
    hero2: [[0,.25,3,0],[.25,.25,2,0],[.5,.5,3,0],[1,.5,2,1],[1.5,.5,1,0],[2,.5,2,0],[2.5,.5,3,0],[3,1,2,1],[4,.25,0,1],[4.25,.25,1,0],[4.5,.5,2,0],[5,.5,3,0],[5.5,.5,2,1],[6,.5,1,0],[6.5,.5,3,0],[7,.5,2,0],[7.5,.5,0,1]],
    blues: [[0,.75,3,0],[1,.25,2,0],[1.5,.5,3,0],[2,1.5,0,1],[4,.75,3,0],[5,.25,2,0],[5.5,.5,1,0],[6,1.75,0,0]],
    anthem:  [[0,1.5,0,0],[1.5,.5,1,0],[2,1.5,3,0],[3.5,.5,2,0],[4,2,3,1],[6,1.5,0,1],[7.5,.5,2,0]],
    anthem2: [[0,2,2,0],[2,1,3,0],[3,1,2,0],[4,1.5,0,1],[5.5,.5,1,0],[6,2,3,0]],
    sparse:  [[0,3,2,0],[4,3,3,0]],
    roar:    [[0,5,0,-1],[5.5,2.3,2,-1]],
  };
  // bass lines ([beatOffset, dur, semisFromR5]) — r6=+12, f6=+19, sub=-12
  const BASSFIG={
    root:      [[0,7.5,0]],
    octaves:   [[0,1,0],[1,1,12],[2,1,0],[3,1,12],[4,1,0],[5,1,12],[6,1,0],[7,1,12]],
    sixteenths:null,   // rendered on the 16th grid below
    dub:       [[2.5,1,0],[3.5,0.5,12],[6.5,1,0],[7.5,0.5,19]],
    drive:     null,   // straight 8ths on the root
    rolling:   null,   // offbeat 8ths
    sub:       [[0,3.8,-12],[4,3.8,-12]],
    stab:      [[0,0.3,0],[1.5,0.3,12],[3,0.3,0],[4.5,0.3,12],[6,0.3,0],[7,0.3,19]],
    walking:   [[0,1,0],[1,0.5,12],[1.5,0.5,19],[2.5,0.5,0],[3,1,12],[4,0.5,0],[4.5,0.5,19],[5.5,0.5,12],[6,1,0],[7,0.5,12],[7.5,0.5,19]],
    simple:    [[0,1.5,0],[2,0.5,12],[3,1,19],[4.5,0.5,0],[5,1,12],[6.5,1.5,0]],
    melodic:   [[0,1,0],[1.5,0.5,12],[2,1,19],[3.5,1,3],[5,0.5,12],[5.5,0.5,10],[6,1.5,0]],
  };
  const STAB_STRUCT={ offbeat:"[~ ~ ~ x]*4", rave:"x ~ ~ x ~ ~ x ~ ~ x ~ ~ x ~ x ~", sparse:"~ ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ x ~" };
  const HIT_STRUCT={ sparse:"x ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~", offbeat:"~ ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ ~", dub:"~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ x ~ ~" };
  // break-chop slice rows (16 8th-slots, slice index 0-7, -1 = rest) — engine's tables
  const BREAK_ROWS=[
    [0,1,2,3,4,5,6,7,0,1,2,3,4,5,6,7],
    [0,1,2,3,0,1,4,5,2,3,6,7,4,7,6,7],
    [0,2,1,3,4,4,6,7,0,2,1,3,7,6,5,4],
    [0,-1,2,-1,4,5,-1,7,0,-1,2,3,-1,5,6,7],
  ];

  // ---------- mini-notation renderer: [{o,d,m}] over 8 beats -> "c4@6 ~@2 …" ----------
  // weights are quarter-beat units (bar = 32 units) so every engine duration is exact
  function barMini(evs){
    const toks=[]; let t=0;
    for(const e of evs){
      if(e.o>=8) break;
      const gap=Math.round((e.o-t)*4);
      if(gap>0) toks.push(gap===1?"~":"~@"+gap);
      const u=Math.max(1,Math.round(Math.min(e.d,8-e.o)*4));
      toks.push(u===1?mName(e.m):mName(e.m)+"@"+u);
      t=e.o+u/4;
    }
    const tail=Math.round((8-t)*4);
    if(tail>0) toks.push(tail===1?"~":"~@"+tail);
    return toks.join(" ");
  }

  // ---------- the melody dimension ----------
  function melodyBars(pattern, prg, k, rng){
    const chords=prg.chords;
    // the original composed royal-road lines span 4 chords exactly
    const comp=pattern==="composed"?prg.composed:pattern==="composed2"?prg.composed2:null;
    if(comp&&chords.length===4){
      return chords.map((_,ci)=>barMini(comp
        .filter(([o])=>o>=ci*8&&o<(ci+1)*8)
        .map(([o,d,p])=>({o:o-ci*8,d,m:pch(p,k)}))));
    }
    let gen=(pattern==="composed"||pattern==="composed2")?"arpup":pattern;
    return chords.map((chord,ci)=>{
      const lead=chord.lead.map(p=>pch(p,k));
      if(gen==="double"){
        const idx=[0,1,2,3,0,1,2,3,1,2,3,0,2,3,0,1];
        return idx.map(i=>mName(lead[i])).join(" ");
      }
      if(gen==="arp16"){                       // Edge 16ths tracing a contour (octave-doubled via superimpose)
        const ext=[...lead,lead[0]+12,lead[1]+12,lead[2]+12];
        const motif=[0,2,4,5,4,3,2,4,5,4,2,3,1,2,4,0];
        return motif.concat(motif).map(i=>mName(ext[i]-12)).join(" ");
      }
      if(gen==="motorik"||gen==="motorik23"){  // sequencer weave: note, note+8ve, next…
        const dir=gen==="motorik23"?[3,2,1,0]:[0,1,2,3];
        const out=[]; for(let i=0;i<16;i++){ let m=lead[dir[i%4]]; if(i%2)m+=12; out.push(mName(m)); }
        return out.join(" ");
      }
      let fig=FIG[gen];
      if(gen==="hero") fig=ci%2?FIG.hero2:FIG.hero;
      if(gen==="anthem") fig=ci%2?FIG.anthem2:FIG.anthem;
      if(!fig){                                 // "wander": seeded walk on chord tones
        const rh=[1,0.5,0.5,1,1,2]; let t=0,i=0,prev=Math.floor(rng()*4); fig=[];
        while(t<8){ const d=rh[i%rh.length]; prev=clamp(prev+(Math.floor(rng()*3)-1),0,3);
          fig.push([t,Math.min(d,8-t)*0.92,prev,rng()<0.18?1:0]); t+=d; i++; }
      }
      // humanity: drop / octave-color a few notes per chord, seeded
      const evs=[];
      for(const [o,d,idx,oct] of fig){
        if(rng()<0.08) continue;
        let oc=oct||0; if(rng()<0.09) oc=oc===0?1:0;
        evs.push({o,d,m:lead[clamp(idx,0,lead.length-1)]+12*oc});
      }
      return barMini(evs.length?evs:[{o:0,d:8,m:lead[0]}]);
    });
  }

  // ---------- the bass dimension ----------
  function bassBars(pattern, prg, k, rng){
    // uniform-pulse patterns get the compact idiomatic form: roots + struct
    if(pattern==="drive"||pattern==="rolling"||pattern==="sixteenths"){
      const roots="<"+prg.chords.map(c=>mName(pch(c.bass.r5,k))).join(" ")+">";
      const st=pattern==="drive"?"x*16":pattern==="rolling"?"[~ x]*8":"x*16";
      const add=pattern==="sixteenths"?`.add(note("[0 12 19 12]*4"))`:"";
      return {compact:`note("${roots}").struct("${st}")${add}`};
    }
    return prg.chords.map(chord=>{
      const r5=pch(chord.bass.r5,k);
      const fig=BASSFIG[pattern]||BASSFIG.simple;
      const evs=[];
      for(const [o,d,s] of fig){
        if(rng()<0.05) continue;                                  // breathe
        const oc=rng()<0.05?12:0;                                 // octave pop
        evs.push({o,d,m:r5+s+oc});
      }
      return barMini(evs.length?evs:[{o:0,d:7.5,m:r5}]);
    });
  }

  // ---------- the rhythm dimension: kit name -> idiomatic stack lines ----------
  function kitLines(kit, dr, humanize, rng){
    const kickG=R2(clamp(.55+.3*dr.kick,.3,1.1)), snG=R2(clamp(.5*dr.snare,.1,.9)),
          htG=R2(clamp(.4*dr.hat,.08,.7)), deg=R2(.05+humanize*.2);
    const sn=dr.snareModel==="clap"?"cp":"sd";
    const evN=pick(rng,[4,8]), gh=pick(rng,[3,5]);                // seeded variation amounts
    const L=[];
    const jux=rng()<0.5?".jux(rev)":`.sometimesBy(.2, x=>x.speed(1.02))`;
    switch(kit){
      case "four":
        L.push(`s("bd*8").gain(${kickG})`);
        L.push(`s("~ ~ ${sn} ~ ~ ~ ${sn} ~").gain(${snG})`);
        L.push(`s("[~ hh]*8").gain(${htG}).degradeBy(${deg})`);
        break;
      case "house":
        L.push(`s("bd*8").gain(${kickG})`);
        L.push(`s("~ ~ cp ~ ~ ~ cp ~").gain(${snG}).every(${evN}, x=>x.late(.01))`);
        L.push(`s("[hh oh]*8").gain(${htG}).degradeBy(${deg})${jux}`);
        break;
      case "techno":
        L.push(`s("bd*8").gain(${kickG})`);
        L.push(`s("[~ oh]*8").gain(${R2(htG*1.2)})`);
        L.push(`s("hh*16").gain(${R2(htG*.5)}).degradeBy(${deg})${jux}`);
        L.push(`s("rim(${gh},16,2)").gain(.15).sometimesBy(.3, x=>x.speed(1.5))`);
        break;
      case "pulse":
        L.push(`s("bd*8").gain(${kickG}).sometimesBy(.08, x=>x.ply(2))`);
        L.push(`s("~ ~ ${sn} ~ ~ ~ ${sn} ~").gain(${snG})`);
        L.push(`s("${sn}(${gh},16,3)").gain(.12)`);                 // ghost snares, quiet by law
        L.push(`s("[~ hh]*8").gain(${htG}).degradeBy(${deg}).every(${evN}, x=>x.fast(2))`);
        break;
      case "boombap":
        L.push(`s("bd ~ ~ bd [~ bd] ~ ~ ~").gain(${kickG})`);
        L.push(`s("~ ~ ${sn} ~ ~ ~ ${sn} ~").gain(${snG}).sometimesBy(.15, x=>x.late(.015))`);
        L.push(`s("[~ hh]*8").gain(${htG}).degradeBy(${deg})`);
        break;
      case "halftime":
        L.push(`s("bd ~ ~ ~ ~ ~ ~ ~").gain(${kickG})`);
        L.push(`s("~ ~ ~ ~ ${sn} ~ ~ ~").gain(${snG})`);
        L.push(`s("[~ hh]*8").gain(${htG}).degradeBy(${deg})`);
        break;
      case "breaks":
        L.push(`s("bd ~ [~ bd] ~ ~ bd ~ ~").gain(${kickG})`);
        L.push(`s("~ ~ ${sn} ~ ~ [~ ${sn}] ${sn} ~").gain(${snG}).every(${evN}, x=>x.rev())`);
        L.push(`s("[~ hh]*8").gain(${htG}).degradeBy(${deg})`);
        break;
      case "jungle":
        L.push(`s("bd(3,16,<0 2>)").gain(${kickG})`);
        L.push(`s("~ ~ ~ ${sn} ~ ~ ~ ~ ${sn} ~ ~ [${sn} ${sn}] ~ ~ ${sn}? ~").gain(${snG}).every(${evN}, x=>x.rev())`);
        L.push(`s("hh*16").gain(${R2(htG*.6)}).degradeBy(${R2(deg+.25)})${jux}`);
        break;
      case "tribal":
        L.push(`s("bd [~ bd] bd ~ bd [~ bd] bd ~").gain(${kickG})`);
        L.push(`s("[~ lt]*4, mt(${gh},16,5)").gain(${R2(snG*.9)}).every(${evN}, x=>x.rev())`);
        L.push(`s("[hh hh hh oh]*4").gain(${htG}).degradeBy(${deg})`);
        break;
      case "trap":
        L.push(`s("bd ~ [~ bd] ~ ~ [bd ~] ~ ~").gain(${kickG})`);
        L.push(`s("~ ~ ~ ~ ${sn} ~ ~ ~").gain(${snG})`);
        L.push(`s("hh*16").gain(${htG}).every(${evN}, x=>x.fast(2)).degradeBy(${deg})`);
        break;
      case "kick":
        L.push(`s("bd ~ ~ ~ bd ~ ~ ~").gain(${kickG})`);
        L.push(`s("~ ~ ~ hh ~ ~ ~ hh").gain(${R2(htG*.7)})`);
        break;
      case "open": case "full": default:
        L.push(`s("bd ~ ~ ~ ~ bd ~ ~ bd ~ ~ ~ ~ bd ~ ~").gain(${kickG})`);
        L.push(`s("~ ~ ${sn} ~ ~ ~ ${sn} ~").gain(${snG})`);
        L.push(`s("[~ hh]*8").gain(${htG}).degradeBy(${deg})${kit==="open"?`.every(${evN}, x=>x.fast(2))`:""}`);
        if(kit==="open") L.push(`s("~ ~ ~ oh ~ ~ ~ oh").gain(${R2(htG*.8)})`);
        break;
    }
    return L;
  }

  // ---------- section picking: the fullest groove, like the live picker ----------
  function pickSection(state){
    let best=null,bestScore=-1;
    state.sections.forEach((s,i)=>{
      const sc=(s.drums&&s.drums!=="off"?3:0)+(s.melody&&s.melody!=="off"?2:0)
        +(s.bass&&s.bass!=="off"?2:0)+(s.pads?1:0)
        +(s.stab&&s.stab!=="off"?1:0)+(s.hits?1:0)+(s.vox?1:0)
        +(s.found&&s.found.sourceId?1:0);
      if(sc>=bestScore){ best=s; bestScore=sc; }
    });
    return best;
  }
  function sectionSummary(s){
    const on=[];
    if(s.drums&&s.drums!=="off") on.push("drums:"+s.drums);
    if(s.bass&&s.bass!=="off") on.push("bass:"+s.bass);
    if(s.melody&&s.melody!=="off") on.push("melody:"+s.melody);
    if(s.pads) on.push("pads");
    if(s.found&&s.found.sourceId) on.push(s.found.role+":"+s.found.sourceId);
    if(s.vox) on.push("vox");
    return on.length?on.join(" · "):"tacet (pads/bed only)";
  }

  // ---------- main ----------
  function toStrudel(state, opts){
    opts=opts||{};
    const prg=E.PROGRESSIONS[state.progression]||E.PROGRESSIONS.royal_road;
    const k=state.keyOffset|0, bpm=state.bpm||88;
    const rng=mulberry32(((state.seed??1)^0x5EED)>>>0);
    const I=state.instruments||{}, mel=I.melody||{}, bass=I.bass||{}, pad=I.pad||{}, dr=I.drums||{};
    const sec=pickSection(state);
    const meta=state.genreMeta||{};
    const genres=(meta.genres||["?"]).join("+");
    let dlyRaw=(state.delay?state.delay.beats:0.75)*60/bpm;
    while(dlyRaw>1) dlyRaw/=2;                       // WebAudio delay caps at 1s; halving stays in tempo
    const dlySec=R3(dlyRaw);
    const dlyFb=R2(state.delay?state.delay.feedback:0.3);
    const roomSz=R2(2+(state.reverb||0.5)*6);
    const srcById={}; (state.foundSources||[]).forEach(s=>srcById[s.id]=s);
    const L=[];   // output lines
    const NL="";

    // -- header --
    L.push(`// ${genres} · seed ${state.seed??1} · ${bpm} bpm · key ${k>=0?"+"+k:k} · ${state.progression} (${prg.chords.map(c=>c.name).join(" ")})`);
    L.push(`// generated by CONSTELLATE (aboardresearch.com/projects/vaporwave) — engine state -> Strudel`);
    L.push(`// 1 cycle = one 8-beat chord-bar (the engine's bar); chords change per cycle`);
    L.push(`// main groove = section "${sec?sec.name:"?"}" of the ${meta.form||"pop"} form — variants at the bottom`);
    L.push(`setcpm(${bpm}/8)`);
    L.push(`samples('${opts.samplesUrl||SAMPLES_URL_REL}')`);   // single quotes: not mini-notation
    L.push(NL);

    // -- pads / harmony --
    const chordMini="<"+prg.chords.map(c=>"["+c.pads.map(p=>mName(pch(p,k))).join(",")+"]").join(" ")+">";
    if(sec&&sec.pads!==false&&(sec.pads||true)){}
    if(sec&&sec.pads){
      const pSound=PAD_SOUND[pad.model]||"sawtooth";
      const pG=R2(clamp((pad.level||0.7)*0.55,.15,.6));
      // sidechain pump lives in THEIR algebra: a per-beat gain dip
      const pGain=state.pump>0.25?`.gain("[${R2(pG*(1-state.pump*0.7))} ${pG}]*8")`:`.gain(${pG})`;
      let line=`$: note("${chordMini}")`+`\n   .s("${pSound}").attack(${R2(Math.min(pad.attack||1.5,4))}).release(2)`;
      line+=`\n   .lpf(${Math.round(pad.cutoff||1400)})${pGain}`;
      line+=`\n   .room(${R2(clamp((state.reverb||0.5)*(pad.send??0.5)+0.15,0,0.95))}).size(${roomSz})`;
      L.push(line+"   // pads: "+(pad.model||"saw"));
      L.push(NL);
    }

    // -- bass --
    if(sec&&sec.bass&&sec.bass!=="off"){
      const bSound=BASS_SOUND[bass.model]||"sawtooth";
      const bars=bassBars(sec.bass,prg,k,rng);
      let line;
      if(bars.compact) line=`$: ${bars.compact}`;
      else{
        const one=bars.every(b=>b===bars[0]);
        line="$: note("+(one?`"${bars[0]}"`:`\`<${bars.map(b=>"["+b+"]").join("\n   ")}>\``)+")";
      }
      line+=`\n   .s("${bSound}").lpf(${Math.round(bass.cutoff||700)})`;
      if(bass.model==="acid") line+=`.lpq(${R2(8+(bass.res||0.2)*20)}).lpenv(3)`;
      if(bass.model==="reese") line+=`.add(note("0,.12"))`;
      const bG=R2(clamp((bass.level||1)*0.4,.2,.6));
      line+=state.pump>0.25?`.gain("[${R2(bG*(1-state.pump*0.6))} ${bG}]*8")`:`.gain(${bG})`;
      L.push(line+`   // bass: ${sec.bass} (${bass.model||"saw"})`);
      L.push(NL);
    }

    // -- melody / lead --
    if(sec&&sec.melody&&sec.melody!=="off"){
      const mSound=LEAD_SOUND[mel.model]||"triangle";
      const bars=melodyBars(sec.melody,prg,k,rng);
      const one=bars.length===1;
      const body=one?`"${bars[0]}"`:`\`<${bars.map(b=>"["+b+"]").join("\n   ")}>\``;
      let line=`$: note(${body})`;
      const fx=[`.s("${mSound}")`];
      if(mel.model==="fm") fx.push(`.fm(${R2(2+rng()*4)}).fmh(${pick(rng,[1,2,3])})`);
      if(mel.model==="fuzz") fx.push(`.distort(1.5)`);
      if(mel.model==="pluck") fx.push(`.adsr("0:.12:.3:.1")`);
      if((mel.voices||1)>=4) fx.push(`.add(note("-.1,0,.1"))`);           // supersaw spread
      else if((mel.voices||1)>=2&&mel.model==="stack") fx.push(`.add(note("0,.06"))`);  // gentle detune
      fx.push(`.lpf(${Math.round(mel.cutoff||3000)})`);
      fx.push(`.gain(${R2(clamp((mel.level||0.5)*0.75,.2,.65))})`);
      fx.push(`\n   .delay(${R2(clamp(mel.dsend??0.25,0,0.8))}).delaytime(${dlySec}).delayfeedback(${dlyFb})`);
      fx.push(`.room(${R2(clamp((state.reverb||0.5)*(mel.send??0.4)+0.1,0,0.9))})`);
      if(sec.melody==="arp16") fx.push(`\n   .superimpose(x=>x.add(note(12)).gain(.4))`);   // octave doubling
      L.push(line+"\n   "+fx.join("")+`   // lead: ${sec.melody} (${mel.model||"stack"})`);
      L.push(NL);
    }

    // -- drums --
    if(sec&&sec.drums&&sec.drums!=="off"){
      const lines=kitLines(sec.drums,dr,state.humanize||0,rng);
      const bank=BANK[dr.kickModel]||"RolandTR808";
      let block=`$: stack(\n     ${lines.join(",\n     ")}\n   ).bank("${bank}")`;
      if(state.swing>0.02) block+=`.swingBy(${R2(state.swing)}, 8)`;
      if((dr.send||0)>0.2) block+=`.room(${R2(clamp(dr.send*(state.reverb||0.5),0,0.6))})`;
      if((dr.dsend||0)>0.3) block+=`\n   .delay(${R2(clamp(dr.dsend*0.5,0,0.5))}).delaytime(${dlySec}).delayfeedback(${dlyFb})`;
      L.push(block+`   // kit: ${sec.drums} (${dr.kickModel}/${dr.snareModel}/${dr.hatModel})`);
      L.push(NL);
    }

    // -- found sound: break / chops / bed / narration --
    // if the fullest section dropped the found layer, keep the state's bed anyway
    // (a vaporwave chorus without its mall is not vaporwave)
    let fsec=sec;
    if(!(sec&&sec.found&&sec.found.sourceId)){
      const alt=state.sections.find(s=>s.found&&s.found.sourceId&&
        (s.found.role==="bed"||s.found.role==="narration")&&SAMPLE_MAP[s.found.sourceId]);
      if(alt) fsec=alt;
    }
    const fsrc=fsec&&fsec.found&&fsec.found.sourceId?srcById[fsec.found.sourceId]:null;
    const fname=fsrc?SAMPLE_MAP[fsrc.id]:null;
    if(fsrc&&fname){
      const role=fsec.found.role||"bed";
      if(role==="break"){
        const rows=[pick(rng,BREAK_ROWS),pick(rng,BREAK_ROWS)];
        const rowMini=r=>r.map(x=>x<0?"~":(rng()<0.08?Math.floor(rng()*8):x)).join(" ");
        L.push(`$: s("${fname}").splice(8, \`<[${rowMini(rows[0])}]\n   [${rowMini(rows[1])}]>\`)`
          +`\n   .gain(${R2(clamp((fsrc.vol||0.35)*2,.3,.95))}).every(${pick(rng,[4,8])}, x=>x.rev())`
          +`.sometimesBy(.08, x=>x.ply(2))   // the chopped break`);
      } else if(role==="chops"){
        L.push(`$: s("${fname}").slice(8, "${Array(16).fill(0).map(()=>rng()<0.55?Math.floor(rng()*8):"~").join(" ")}")`
          +`\n   .gain(${R2(clamp((fsrc.vol||0.15)*1.6,.1,.5))}).lpf(${Math.round(fsrc.cutoff||2600)}).degradeBy(.2)   // found-sound chops`);
      } else if(role==="narration"){
        L.push(`$: s("${fname}").slow(8).gain(${R2(clamp((fsrc.vol||0.3)*1.1,.15,.5))})`
          +`.lpf(${Math.round(fsrc.cutoff||3200)}).room(.4).sometimesBy(.15, x=>x.chop(16))   // narration`);
      } else {
        L.push(`$: s("${fname}").slow(8).speed(${R2(fsrc.pitch||0.8)})`
          +`.gain(${R2(clamp(fsrc.vol||0.2,.08,.4))}).lpf(${Math.round(fsrc.cutoff||2800)}).room(.6)   // found bed: ${fsrc.id}`);
      }
      L.push(NL);
    }

    // -- speech / vox layer (quiet bed) --
    const vsrc=sec&&sec.vox&&sec.vox.sourceId?srcById[sec.vox.sourceId]:null;
    const vname=vsrc?SAMPLE_MAP[vsrc.id]:null;
    if(vsrc&&vname){
      L.push(`$: s("${vname}").slow(4).gain(${R2(clamp((vsrc.vol||0.4)*0.7,.15,.45))})`
        +`.lpf(${Math.round(vsrc.cutoff||6500)}).room(.35).sometimesBy(.2, x=>x.chop(8).speed("<1 .8 1.5>"))   // the voice, glitched`);
      L.push(NL);
    }

    // -- one-shot hits --
    const hsrc=sec&&sec.hits&&sec.hits.sourceId?srcById[sec.hits.sourceId]:null;
    const hname=hsrc?SAMPLE_MAP[hsrc.id]:null;
    if(hsrc&&hname){
      const hp=HIT_STRUCT[sec.hits.pattern]||HIT_STRUCT.sparse;
      L.push(`$: s("${hname}").struct("${hp}").degradeBy(.45)`
        +`\n   .gain(${R2(clamp((hsrc.vol||0.22)*1.6,.15,.6))}).speed("<1 1.02 .97>")${hsrc.wet?".room(.5).delay(.3).delaytime("+dlySec+")":""}   // hits: events, never loops`);
      L.push(NL);
    }

    // -- synth stabs --
    if(sec&&sec.stab&&sec.stab!=="off"&&STAB_STRUCT[sec.stab]){
      const roots="<"+prg.chords.map(c=>"["+[0,7,12].map(s=>mName(pch(c.bass.r6,k)+12+s)).join(",")+"]").join(" ")+">";
      L.push(`$: note("${roots}").struct("${STAB_STRUCT[sec.stab]}")`
        +`\n   .s("sawtooth").adsr("0:.15:.25:.06").lpf(2400).gain(.3).degradeBy(.2)`
        +`.room(.3)   // rave stabs: ${sec.stab}`);
      L.push(NL);
    }

    // -- vinyl crackle --
    if((state.crackle||0)>0.05)
      L.push(`$: s("crackle*4").density(${R2(clamp(state.crackle*0.5,.02,.6))}).gain(.5)   // vinyl dust\n`);

    // -- section variants as comments --
    const others=state.sections.filter(s=>s!==sec);
    const seen=new Set(); const variants=[];
    for(const s of others){ const sum=sectionSummary(s); const key=sum;
      if(!seen.has(key)&&variants.length<3){ seen.add(key); variants.push(`//   ${s.name}: ${sum}`); } }
    if(variants.length){
      L.push(`// other sections of this track — mute/solo lines above to play them:`);
      L.push(...variants);
    }
    return L.join("\n").replace(/\n{3,}/g,"\n\n").trim()+"\n";
  }

  // ---------- share URLs (strudel code2hash: utf8 -> base64 -> urlencode) ----------
  function codeHash(code){
    const b64=isNode?Buffer.from(code,"utf8").toString("base64")
      :btoa(String.fromCharCode(...new TextEncoder().encode(code)));
    return encodeURIComponent(b64);
  }
  // our own self-hosted REPL (strudel/vendor + remix.html); base overridable
  // so the mix page can emit ../remix.html#… from a subdirectory
  function shareUrl(state, opts){
    opts=opts||{};
    return (opts.base||"remix.html")+"#"+codeHash(toStrudel(state, opts));
  }
  // the mothership, for people who want it — needs the absolute sample map
  function strudelccUrl(state, opts){
    return "https://strudel.cc/#"+codeHash(toStrudel(state, Object.assign({samplesUrl:SAMPLES_URL_ABS}, opts)));
  }

  const api={ toStrudel, shareUrl, strudelccUrl, codeHash, SAMPLE_MAP,
    SAMPLES_URL_REL, SAMPLES_URL_ABS };
  if(isNode) module.exports=api; else root.StrudelExport=api;

  // ---------- CLI ----------
  if(isNode&&require.main===module){
    const fs=require("fs");
    const args=process.argv.slice(2).filter(a=>!a.startsWith("--"));
    const flags=process.argv.slice(2).filter(a=>a.startsWith("--"));
    const seedF=flags.find(f=>f.startsWith("--seed"));
    const seed=seedF?parseInt((seedF.split("=")[1]||process.argv[process.argv.indexOf(seedF)+1]),10):1;
    if(!args.length){ console.error("usage: strudel-export.js <state.json | genreName> [--seed N] [--url]"); process.exit(1); }
    let state;
    if(fs.existsSync(args[0])) state=JSON.parse(fs.readFileSync(args[0],"utf8"));
    else{
      const K=require("./genre-kernel.js");
      if(!K.GENRES[args[0]]){ console.error("unknown genre or file: "+args[0]); process.exit(1); }
      state=K.track(args[0],{seed:isNaN(seed)?1:seed});
    }
    process.stdout.write(toStrudel(state));
    if(flags.includes("--url")){
      console.log("\n// local:      "+shareUrl(state, {base:"https://aboardresearch.com/projects/vaporwave/remix.html"}));
      console.log("// strudel.cc: "+strudelccUrl(state));
    }
  }
})(typeof window!=="undefined"?window:globalThis);
