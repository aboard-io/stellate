#!/usr/bin/env node
// genre-kernel.js — genre as a point in a multidimensional space; a song as a
// seeded sample near a point; a playlist as a path. Design: GENRE-SPACE.md.
//
//   node genre-kernel.js anchors
//   node genre-kernel.js track jungle --seed 7 [--render] [--verify]
//   node genre-kernel.js blend techno vaporwave 0.5 [--seed N] [--render]
//   node genre-kernel.js playlist a b c --tracks 30 --hours 6 --out DIR
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

  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const lerp=(a,b,t)=>a+(b-a)*t;
  const pick=(r,arr)=>arr[Math.floor(r()*arr.length)];
  const inRange=(r,[lo,hi])=>lo+r()*(hi-lo);
  const lerpRange=(A,B,t)=>[lerp(A[0],B[0],t),lerp(A[1],B[1],t)];
  const round=(x,p)=>Math.round(x*10**(p||2))/10**(p||2);

  // ---------- found-sound + sample registry (recipes: fetch-found-sound.sh / fetch-found-samples.sh) ----------
  const SOURCES = {
    tokyo_station:{ label:"Tokyo Station",   url:"https://archive.org/download/aporee_20938_24294/nov19tokyostation1934.ogg" },
    highway_night:{ label:"Night Highway",   url:"https://archive.org/download/aporee_44512_50607/soundmap201905198.mp3" },
    factory:      { label:"Metallurgy Plant",url:"https://archive.org/download/aporee_63765_73460/ATA025Antofagastasiderurgiausinacamionesencarretera.mp3" },
    frogs:        { label:"Frog Chorus",     url:"https://archive.org/download/aporee_61056_70186/soundmap202307117.mp3" },
    iriomote:     { label:"Iriomote Island", url:"https://archive.org/download/aporee_30783_35405/iriomoteaporee.ogg" },
    shibuya:      { label:"Shibuya Street",  url:"https://archive.org/download/aporee_20542_23865/nov820131617shibuya.ogg" },
  };
  // sample layer: local files under found/samples/ (kind: break|hit|vox)
  const SAMPLES = {
    amen_165:{ file:"breaks/amen_165_02.wav", kind:"break", bpm:165 },
    amen_170:{ file:"breaks/amen_170_04.wav", kind:"break", bpm:170 },
    amen_172:{ file:"breaks/amen_172_07.wav", kind:"break", bpm:172 },
    amen_175:{ file:"breaks/amen_175_01.wav", kind:"break", bpm:175 },
    rave_a:{ file:"hits/dcc30_00.wav", kind:"hit", durSec:1.2 },
    rave_b:{ file:"hits/dcc30_02.wav", kind:"hit", durSec:1.2 },
    rave_c:{ file:"hits/dcc66_00.wav", kind:"hit", durSec:1.2 },
    rave_d:{ file:"hits/dcc66_02.wav", kind:"hit", durSec:1.2 },
    vox_a:{ file:"vox/apollo_a.wav", kind:"vox", durSec:3.2 },
    vox_b:{ file:"vox/apollo_b.wav", kind:"vox", durSec:2.8 },
    vox_c:{ file:"vox/apollo_c.wav", kind:"vox", durSec:3.0 },
    // speech synthesis as an instrument (espeak-ng, see fetch-found-samples.sh)
    sp_plaza:{ file:"speech/plaza.wav", kind:"speech", durSec:2.4 },
    sp_shopping:{ file:"speech/shopping.wav", kind:"speech", durSec:2.6 },
    sp_system:{ file:"speech/system.wav", kind:"speech", durSec:1.2 },
    sp_energy:{ file:"speech/energy.wav", kind:"speech", durSec:1.6 },
    sp_rewind:{ file:"speech/rewind.wav", kind:"speech", durSec:1.8 },
    sp_pressure:{ file:"speech/pressure.wav", kind:"speech", durSec:1.4 },
    sp_rhythm:{ file:"speech/rhythm.wav", kind:"speech", durSec:1.6 },
    sp_nightdrive:{ file:"speech/nightdrive.wav", kind:"speech", durSec:1.6 },
    sp_herenow:{ file:"speech/herenow.wav", kind:"speech", durSec:1.7 },
    sp_slowdown:{ file:"speech/slowdown.wav", kind:"speech", durSec:1.9 },
  };

  // ---------- the anchors ----------
  const GENRES = {
    techno: { label:"Techno", info:"rhythm over harmony: drones, machine four, DJ plateaus",
      bpm:[124,140], swing:[0,0.06], humanize:[0,0.15],
      progressions:["drone_min","deep_two"], kits:["techno","pulse"], fills:["off","riser","sweep","break fill"],
      bass:{patterns:["rolling","stab","sixteenths"], recipe:{model:["acid","saw","reese"],cutoff:[450,800],res:[.2,.35],level:[1.0,1.2],send:[0,.08],dsend:[0,.1]}},
      lead:{patterns:["double","double","arpup","off"], recipe:{model:["pluck","stack"],wave:"square",voices:[1,2],spread:[.002,.006],cutoff:[1500,2600],level:[.3,.42],send:[.15,.3],dsend:[.2,.4],vibrato:[0,.002]}},
      pads:{prob:.5, recipe:{model:["organ","saw"],wave:"saw",cutoff:[700,1200],detune:[.004,.01],attack:[1.5,3],level:[.35,.5],send:[.3,.5],dsend:[.1,.2]}},
      drums:{kickModel:["909"],snareModel:["clap","crack"],hatModel:["metal","noise"],kick:[1.25,1.5],snare:[.55,.8],hat:[.7,1],tune:[.95,1.1],send:[.05,.15],dsend:[.1,.25]},
      fx:{reverb:[.35,.55], delayBeats:[.5,.75], delayFb:[.3,.45], delayCut:[2000,3500], pump:[.4,.65], crackle:[0,.1], lowcut:[35,50], highcut:[0,0], comp:[.5,.7]},
      found:{role:"chops", vol:[.1,.18], pitch:[.9,1.1], stretch:[.4,.6], cutoff:[1800,3200], sources:["factory","shibuya"]},
      stab:["offbeat","offbeat","rave","sparse"], hits:{sources:["vox_b","rave_a","sp_system","sp_energy"], pattern:"sparse", prob:.5},
      form:"dj" },
    house: { label:"House", info:"four-on-floor + claps, warm 7ths, 8-bar additive builds",
      bpm:[118,126], swing:[.08,.2], humanize:[.05,.2],
      progressions:["house_min7","lofi","deep_two"], kits:["house","four"], fills:["off","drum fill","riser"],
      bass:{patterns:["rolling","stab","dub"], recipe:{model:["saw","sub"],cutoff:[380,700],res:[.15,.3],level:[1.0,1.2],send:[0,.08],dsend:[0,.05]}},
      lead:{patterns:["off","double","pentaup","arpup"], recipe:{model:["fm","stack"],wave:"pulse",voices:[1,3],spread:[.003,.008],cutoff:[1800,3200],level:[.35,.48],send:[.25,.4],dsend:[.2,.35]}},
      pads:{prob:.75, recipe:{model:["fm","organ"],wave:"saw",cutoff:[900,1600],detune:[.004,.009],attack:[.5,1.4],level:[.5,.68],send:[.3,.5],dsend:[.1,.25]}},
      drums:{kickModel:["909","boom"],snareModel:["clap"],hatModel:["noise"],kick:[1.15,1.4],snare:[.6,.85],hat:[.85,1.1],tune:[.95,1.1],send:[.1,.25],dsend:[.05,.15]},
      fx:{reverb:[.4,.6], delayBeats:[.375,.75], delayFb:[.25,.4], delayCut:[2500,4000], pump:[.3,.5], crackle:[0,.15], lowcut:[30,45], highcut:[0,0], comp:[.4,.6]},
      found:{role:"chops", vol:[.1,.18], pitch:[.95,1.1], stretch:[.4,.6], cutoff:[2200,3600], sources:["shibuya","tokyo_station"]},
      stab:["rave","offbeat"], hits:{sources:["rave_b","rave_c","vox_a","sp_rhythm"], pattern:"offbeat", prob:.55},
      form:"dj" },
    jungle: { label:"Jungle", info:"chopped breaks, sub pressure, rhythm-as-melody, dub space",
      bpm:[158,172], swing:[0,.08], humanize:[.1,.25],
      progressions:["deep_two","drone_min","minor_run"], kits:["jungle","breaks"], fills:["break fill","break fill","reverse","off"],
      bass:{patterns:["sub","dub"], recipe:{model:["sub","reese"],cutoff:[260,480],res:[.05,.2],level:[1.2,1.45],send:[0,.05],dsend:[0,0]}},
      lead:{patterns:["off","off","sparse","pentaup"], recipe:{model:["pluck","fm"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1600,2800],level:[.3,.42],send:[.3,.5],dsend:[.3,.5]}},
      pads:{prob:.45, recipe:{model:["saw","organ"],wave:"saw",cutoff:[650,1200],detune:[.005,.012],attack:[2,3.5],level:[.4,.58],send:[.45,.65],dsend:[.15,.3]}},
      drums:{kickModel:["808"],snareModel:["crack"],hatModel:["noise"],kick:[1.15,1.4],snare:[.6,.85],hat:[.4,.7],tune:[1.0,1.15],send:[.05,.15],dsend:[.35,.6]},
      fx:{reverb:[.35,.55], delayBeats:[.75,1.5], delayFb:[.4,.6], delayCut:[1800,3000], pump:[0,.15], crackle:[.05,.2], lowcut:[25,40], highcut:[0,0], comp:[.35,.55]},
      found:{role:"break", vol:[.16,.26], pitch:[1,1], stretch:[.5,.5], cutoff:[4500,6500], sources:["amen_165","amen_170","amen_172","amen_175"]},
      stab:["off","sparse"], hits:{sources:["vox_a","rave_d","sp_rewind","sp_pressure"], pattern:"dub", prob:.6},
      form:"dj" },
    triphop: { label:"Trip hop", info:"slowed dusty breaks, jazz color, melancholy, dub weight",
      bpm:[72,92], swing:[.15,.3], humanize:[.2,.45],
      progressions:["neosoul","lofi","minor_run","mode_dorian"], kits:["boombap","breaks","halftime"], fills:["off","drum fill","downlift"],
      bass:{patterns:["dub","simple","sub"], recipe:{model:["sub","saw"],cutoff:[300,600],res:[.05,.2],level:[1.0,1.25],send:[.05,.12],dsend:[0,.1]}},
      lead:{patterns:["sparse","wander","off"], recipe:{model:["fm","pluck"],wave:"sine",voices:[1,2],spread:[.002,.006],cutoff:[1800,3000],level:[.4,.52],send:[.4,.6],dsend:[.3,.5],vibrato:[.004,.01]}},
      pads:{prob:.85, recipe:{model:["fm","saw"],wave:"sine",cutoff:[800,1400],detune:[.004,.01],attack:[1,2.5],level:[.5,.68],send:[.45,.65],dsend:[.15,.3]}},
      drums:{kickModel:["808","boom"],snareModel:["noise","crack"],hatModel:["noise"],kick:[1.05,1.3],snare:[.65,.9],hat:[.5,.8],tune:[.8,.95],send:[.15,.3],dsend:[.15,.35]},
      fx:{reverb:[.6,.78], delayBeats:[.75,1.5], delayFb:[.3,.5], delayCut:[1500,2600], pump:[0,.1], crackle:[.35,.6], lowcut:[0,30], highcut:[9000,14000], comp:[.25,.4]},
      found:{role:"break", vol:[.12,.2], pitch:[1,1], stretch:[.5,.5], cutoff:[3000,4500], sources:["amen_165","amen_170"]},
      stab:["off"], hits:{sources:["vox_b","sp_slowdown"], pattern:"sparse", prob:.4},
      form:"pop" },
    vaporwave: { label:"Vaporwave", info:"slowed mall nostalgia: maj7 city-pop harmony, drenched reverb, found sound",
      bpm:[62,88], swing:[0,.12], humanize:[.05,.25],
      progressions:["royal_road","dream","pop_1625","neosoul"], kits:["full","open","halftime"], fills:["drum fill","riser","downlift","off"],
      bass:{patterns:["simple","walking","root"], recipe:{model:["saw"],cutoff:[500,900],res:[.1,.25],level:[.9,1.1],send:[.05,.15],dsend:[0,.1]}},
      lead:{patterns:["composed","composed2","arpup","updown"], recipe:{model:["stack"],wave:"sine",voices:[1,2],spread:[.003,.006],cutoff:[2800,4000],level:[.4,.52],send:[.4,.6],dsend:[.2,.4],vibrato:[.004,.009]}},
      pads:{prob:1, recipe:{model:["saw"],wave:"saw",cutoff:[1100,1800],detune:[.004,.009],attack:[1.2,2.4],level:[.6,.8],send:[.5,.7],dsend:[.1,.25]}},
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.9,1.15],snare:[.6,.85],hat:[.75,1.05],tune:[.95,1.1],send:[.15,.3],dsend:[0,.1]},
      fx:{reverb:[.8,.92], delayBeats:[.75,1.5], delayFb:[.25,.4], delayCut:[2200,3200], pump:[0,.1], crackle:[.05,.3], lowcut:[0,0], highcut:[0,0], comp:[0,.15]},
      found:{role:"bed", vol:[.18,.28], pitch:[.7,.85], stretch:[.4,.55], cutoff:[2200,3200], sources:["tokyo_station","shibuya","iriomote"]},
      stab:["off"], hits:{sources:["sp_plaza","sp_shopping","vox_b"], pattern:"sparse", prob:.5},
      form:"pop" },
    synthwave: { label:"Synthwave", info:"night-drive pulse, supersaw leads, gated drums, minor keys",
      bpm:[88,116], swing:[0,.05], humanize:[.05,.15],
      progressions:["synthwave","epic_min","andalusian","minor_run"], kits:["pulse","four","open"], fills:["tom fill","tom fill","riser","off"],
      bass:{patterns:["drive","octaves","sixteenths"], recipe:{model:["saw","reese"],cutoff:[550,900],res:[.15,.3],level:[1.1,1.3],send:[0,.08],dsend:[0,0]}},
      lead:{patterns:["hero","updown","arpdown"], recipe:{model:["stack"],wave:"saw",voices:[5,7],spread:[.01,.018],cutoff:[2600,3600],level:[.45,.6],send:[.35,.55],dsend:[.25,.4],vibrato:[.002,.005]}},
      pads:{prob:1, recipe:{model:["saw"],wave:"saw",cutoff:[1100,2200],detune:[.01,.018],attack:[1.2,2.4],level:[.65,.85],send:[.45,.65],dsend:[.15,.3]}},
      drums:{kickModel:["909","boom"],snareModel:["noise"],hatModel:["noise"],kick:[1.2,1.45],snare:[.9,1.15],hat:[.4,.65],tune:[.85,1],send:[.45,.65],dsend:[.05,.15]},
      fx:{reverb:[.75,.88], delayBeats:[.5,.75], delayFb:[.25,.4], delayCut:[1800,2800], pump:[.15,.35], crackle:[0,.1], lowcut:[30,45], highcut:[0,0], comp:[.25,.4]},
      found:{role:"bed", vol:[.08,.14], pitch:[.65,.8], stretch:[.45,.6], cutoff:[1000,1800], sources:["highway_night","factory"]},
      stab:["off","sparse"], hits:{sources:["vox_a","sp_nightdrive"], pattern:"sparse", prob:.3},
      form:"pop" },
    lofi: { label:"Lo-fi", info:"dusty boombap, jazzy 7ths, crackle, everything softened",
      bpm:[72,88], swing:[.18,.32], humanize:[.25,.5],
      progressions:["lofi","neosoul","ii_v_i","pop_1625"], kits:["boombap","halftime"], fills:["off","off","drum fill"],
      bass:{patterns:["simple","dub","root"], recipe:{model:["sub","saw"],cutoff:[350,650],res:[.05,.15],level:[.9,1.1],send:[.05,.12],dsend:[0,.05]}},
      lead:{patterns:["pentaup","sparse","wander"], recipe:{model:["fm","pluck"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1800,2800],level:[.4,.52],send:[.35,.5],dsend:[.2,.35],vibrato:[.005,.012]}},
      pads:{prob:.9, recipe:{model:["fm"],wave:"sine",cutoff:[900,1500],detune:[.003,.008],attack:[.8,1.8],level:[.5,.68],send:[.35,.55],dsend:[.1,.2]}},
      drums:{kickModel:["808"],snareModel:["noise"],hatModel:["noise"],kick:[1.0,1.25],snare:[.55,.8],hat:[.55,.85],tune:[.8,.95],send:[.1,.22],dsend:[0,.1]},
      fx:{reverb:[.5,.7], delayBeats:[.5,.75], delayFb:[.2,.35], delayCut:[1800,2800], pump:[0,.1], crackle:[.5,.8], lowcut:[0,25], highcut:[7500,11000], comp:[.15,.3]},
      found:{role:"bed", vol:[.1,.18], pitch:[.75,.9], stretch:[.4,.55], cutoff:[1600,2600], sources:["tokyo_station","shibuya"]},
      stab:["off"], hits:{sources:["vox_c","sp_slowdown"], pattern:"sparse", prob:.25},
      form:"pop" },
    downtempo: { label:"Downtempo", info:"slow warm pulse, long pads, space and patience",
      bpm:[66,84], swing:[.05,.2], humanize:[.15,.35],
      progressions:["neosoul","dream","deep_two","mode_mixo"], kits:["boombap","halftime","kick"], fills:["off","downlift","riser"],
      bass:{patterns:["simple","dub","sub"], recipe:{model:["sub"],cutoff:[300,550],res:[.05,.15],level:[.95,1.15],send:[.05,.12],dsend:[0,.05]}},
      lead:{patterns:["sparse","off","wander"], recipe:{model:["fm","stack"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[2000,3000],level:[.4,.5],send:[.45,.65],dsend:[.3,.45],vibrato:[.003,.008]}},
      pads:{prob:1, recipe:{model:["organ","saw"],wave:"saw",cutoff:[800,1400],detune:[.005,.011],attack:[2,4],level:[.6,.78],send:[.5,.7],dsend:[.15,.3]}},
      drums:{kickModel:["808","boom"],snareModel:["noise"],hatModel:["noise"],kick:[.95,1.2],snare:[.5,.75],hat:[.45,.75],tune:[.85,1],send:[.2,.35],dsend:[.05,.2]},
      fx:{reverb:[.72,.88], delayBeats:[.75,1.5], delayFb:[.3,.5], delayCut:[1800,2800], pump:[0,.15], crackle:[.1,.3], lowcut:[0,25], highcut:[0,0], comp:[.15,.3]},
      found:{role:"bed", vol:[.14,.24], pitch:[.7,.9], stretch:[.45,.6], cutoff:[1800,2800], sources:["iriomote","highway_night"]},
      stab:["off"], hits:{sources:["vox_b","sp_herenow"], pattern:"sparse", prob:.2},
      form:"pop" },
    ambient: { label:"Ambient", info:"beatless drift: drones, place recordings, enormous reverb",
      bpm:[58,72], swing:[0,0], humanize:[.1,.3],
      progressions:["dream","deep_two","drone_min","mode_lydian"], kits:["off","off","kick"], fills:["off"],
      bass:{patterns:["off","off","root"], recipe:{model:["sub"],cutoff:[250,450],res:[.05,.1],level:[.7,.95],send:[.2,.4],dsend:[0,.1]}},
      lead:{patterns:["off","sparse"], recipe:{model:["fm","stack"],wave:"sine",voices:[1,2],spread:[.002,.004],cutoff:[2000,3200],level:[.3,.45],send:[.6,.8],dsend:[.3,.5],vibrato:[.002,.006]}},
      pads:{prob:1, recipe:{model:["organ","saw"],wave:"saw",cutoff:[600,1200],detune:[.006,.014],attack:[3,5],level:[.65,.85],send:[.65,.85],dsend:[.15,.3]}},
      drums:{kickModel:["808"],snareModel:["noise"],hatModel:["noise"],kick:[.6,.9],snare:[.4,.65],hat:[.4,.7],tune:[.8,1],send:[.3,.5],dsend:[0,.1]},
      fx:{reverb:[.88,.95], delayBeats:[1,1.5], delayFb:[.4,.6], delayCut:[1500,2500], pump:[0,0], crackle:[0,.2], lowcut:[0,0], highcut:[0,0], comp:[0,.1]},
      found:{role:"bed", vol:[.2,.32], pitch:[.6,.8], stretch:[.45,.6], cutoff:[2000,3400], sources:["iriomote","frogs","tokyo_station"]},
      stab:["off"], hits:{sources:["vox_a","sp_herenow"], pattern:"sparse", prob:.15},
      form:"wave" },
    neoclassical: { label:"Neoclassical", info:"felt piano, slow counterpoint, room air, rubato",
      bpm:[58,82], swing:[0,.1], humanize:[.3,.55],
      progressions:["canon","neosoul","dream","ii_v_i"], kits:["off"], fills:["off"],
      bass:{patterns:["root","off","simple"], recipe:{model:["piano"],cutoff:[800,1600],res:[.05,.1],level:[.7,.95],send:[.25,.45],dsend:[0,.1]}},
      lead:{patterns:["canon","wander","arpup","sparse"], recipe:{model:["piano"],wave:"sine",voices:[1,2],spread:[.001,.003],cutoff:[2400,3600],level:[.5,.65],send:[.35,.55],dsend:[.05,.2]}},
      pads:{prob:.55, recipe:{model:["piano","organ"],wave:"sine",cutoff:[1000,1800],detune:[.002,.005],attack:[.3,1],level:[.4,.6],send:[.4,.6],dsend:[0,.1]}},
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.5,.8],snare:[.4,.6],hat:[.3,.5],tune:[.9,1],send:[.2,.4],dsend:[0,0]},
      fx:{reverb:[.6,.8], delayBeats:[.75,1.5], delayFb:[.15,.3], delayCut:[2000,3000], pump:[0,0], crackle:[0,.35], lowcut:[0,0], highcut:[0,0], comp:[0,.15]},
      found:{role:"bed", vol:[.06,.14], pitch:[.7,.9], stretch:[.45,.6], cutoff:[1800,2800], sources:["iriomote","tokyo_station"]},
      stab:["off"], hits:{sources:["sp_herenow"], pattern:"sparse", prob:.1},
      form:"wave" },
    dancepop: { label:"Dance pop", info:"New Order-ish: melodic synth bass up high, bright leads, big pop changes",
      bpm:[116,128], swing:[0,.1], humanize:[.05,.2],
      progressions:["four_chords","sad_pop","doo_wop"], kits:["four","pulse","open"], fills:["drum fill","tom fill","riser"],
      bass:{patterns:["octaves","drive","rolling"], recipe:{model:["saw"],cutoff:[900,1500],res:[.1,.25],level:[1.05,1.25],send:[.05,.15],dsend:[0,.1]}},
      lead:{patterns:["hero","updown","arpup"], recipe:{model:["stack"],wave:"saw",voices:[3,5],spread:[.006,.012],cutoff:[2800,3800],level:[.45,.6],send:[.3,.5],dsend:[.2,.35]}},
      pads:{prob:.85, recipe:{model:["saw","organ"],wave:"saw",cutoff:[1200,2000],detune:[.006,.012],attack:[.8,1.8],level:[.5,.7],send:[.35,.55],dsend:[.1,.25]}},
      drums:{kickModel:["909","boom"],snareModel:["noise","clap"],hatModel:["noise"],kick:[1.1,1.35],snare:[.8,1.05],hat:[.6,.9],tune:[.9,1.05],send:[.25,.45],dsend:[.05,.15]},
      fx:{reverb:[.5,.7], delayBeats:[.5,.75], delayFb:[.2,.35], delayCut:[2400,3600], pump:[.05,.25], crackle:[0,.1], lowcut:[30,45], highcut:[0,0], comp:[.3,.5]},
      found:{role:"bed", vol:[.06,.12], pitch:[.8,1], stretch:[.45,.6], cutoff:[1500,2500], sources:["shibuya","highway_night"]},
      stab:["off","sparse"], hits:{sources:["rave_b","vox_a"], pattern:"sparse", prob:.3},
      form:"pop" },
    edm: { label:"EDM", info:"festival big-room: riser into THE DROP, max pump, supersaw walls",
      bpm:[124,132], swing:[0,.05], humanize:[0,.1],
      progressions:["epic_min","minor_run","sad_pop","drone_min"], kits:["four","pulse"], fills:["riser","riser","impact","sweep"],
      bass:{patterns:["rolling","drive","stab"], recipe:{model:["saw","reese"],cutoff:[500,900],res:[.2,.35],level:[1.15,1.35],send:[0,.08],dsend:[0,0]}},
      lead:{patterns:["hero","updown","double"], recipe:{model:["stack"],wave:"saw",voices:[6,8],spread:[.012,.02],cutoff:[3000,4200],level:[.5,.65],send:[.35,.55],dsend:[.2,.35]}},
      pads:{prob:.9, recipe:{model:["saw"],wave:"saw",cutoff:[1400,2600],detune:[.012,.02],attack:[.6,1.6],level:[.6,.8],send:[.4,.6],dsend:[.1,.25]}},
      drums:{kickModel:["909"],snareModel:["clap","noise"],hatModel:["noise","metal"],kick:[1.35,1.6],snare:[.8,1.05],hat:[.5,.8],tune:[.95,1.1],send:[.2,.4],dsend:[.05,.2]},
      fx:{reverb:[.45,.65], delayBeats:[.375,.5], delayFb:[.25,.4], delayCut:[2500,4000], pump:[.55,.8], crackle:[0,0], lowcut:[30,45], highcut:[0,0], comp:[.6,.8]},
      found:{role:"chops", vol:[.08,.15], pitch:[.95,1.1], stretch:[.4,.6], cutoff:[2500,4000], sources:["shibuya","factory"]},
      stab:["rave","offbeat"], hits:{sources:["rave_a","rave_c","sp_energy"], pattern:"offbeat", prob:.6},
      form:"drop" },
    dubstep: { label:"Dubstep", info:"140 halftime: wobble bass, snare on three, cavernous space",
      bpm:[136,146], swing:[0,.08], humanize:[.05,.2],
      progressions:["drone_min","deep_two","minor_run"], kits:["halftime","breaks"], fills:["break fill","riser","impact","off"],
      bass:{patterns:["sub","dub","stab"], recipe:{model:["wobble","reese","sub"],wobbleHz:[1.5,4.5],cutoff:[300,650],res:[.2,.4],level:[1.2,1.45],send:[0,.08],dsend:[0,.1]}},
      lead:{patterns:["off","sparse","pentaup"], recipe:{model:["pluck","fm"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1800,3000],level:[.3,.45],send:[.35,.55],dsend:[.3,.5]}},
      pads:{prob:.5, recipe:{model:["saw","choir"],wave:"saw",cutoff:[700,1300],detune:[.006,.014],attack:[1.5,3],level:[.4,.6],send:[.5,.7],dsend:[.15,.3]}},
      drums:{kickModel:["808","909"],snareModel:["crack","clap"],hatModel:["noise","metal"],kick:[1.2,1.45],snare:[.85,1.1],hat:[.4,.7],tune:[.9,1.05],send:[.15,.35],dsend:[.25,.5]},
      fx:{reverb:[.5,.7], delayBeats:[.75,1.5], delayFb:[.35,.55], delayCut:[1800,3000], pump:[.1,.3], crackle:[0,.15], lowcut:[25,40], highcut:[0,0], comp:[.4,.6]},
      found:{role:"chops", vol:[.1,.18], pitch:[.85,1.1], stretch:[.4,.6], cutoff:[2000,3500], sources:["factory","frogs"]},
      stab:["off","sparse"], hits:{sources:["vox_c","sp_pressure","rave_d"], pattern:"dub", prob:.55},
      form:"drop" },
    blues: { label:"Blues", info:"12-bar dom7 changes, swung shuffle, worn-record air",
      bpm:[78,100], swing:[.24,.42], humanize:[.3,.55],
      progressions:["blues_12"], kits:["boombap","breaks"], fills:["off","drum fill"],
      bass:{patterns:["walking","simple","root"], recipe:{model:["piano","sub"],cutoff:[500,1000],res:[.05,.15],level:[.9,1.1],send:[.1,.2],dsend:[0,.05]}},
      lead:{patterns:["blues","wander","sparse"], recipe:{model:["piano","pluck"],wave:"sine",voices:[1,2],spread:[.001,.004],cutoff:[2200,3400],level:[.5,.65],send:[.3,.5],dsend:[.1,.25]}},
      pads:{prob:.7, recipe:{model:["organ","piano"],wave:"saw",cutoff:[900,1500],detune:[.003,.007],attack:[.4,1.2],level:[.4,.6],send:[.3,.5],dsend:[.05,.15]}},
      drums:{kickModel:["boom","808"],snareModel:["noise"],hatModel:["noise"],kick:[.9,1.15],snare:[.6,.85],hat:[.5,.8],tune:[.85,1],send:[.15,.3],dsend:[0,.1]},
      fx:{reverb:[.45,.65], delayBeats:[.5,.75], delayFb:[.1,.25], delayCut:[2000,3000], pump:[0,0], crackle:[.25,.55], lowcut:[0,30], highcut:[8000,12000], comp:[.15,.3]},
      found:{role:"bed", vol:[.05,.12], pitch:[.8,1], stretch:[.45,.6], cutoff:[1500,2500], sources:["shibuya","tokyo_station"]},
      stab:["off"], hits:{sources:["sp_slowdown"], pattern:"sparse", prob:.15},
      form:"pop" },
    jazz: { label:"Jazz", info:"ii-V-I machinery, walking bass, brushed kit, piano comping",
      bpm:[96,144], swing:[.28,.48], humanize:[.35,.6],
      progressions:["ii_v_i","neosoul","lofi","mode_dorian"], kits:["breaks","boombap"], fills:["off","drum fill"],
      bass:{patterns:["walking","walking","dub"], recipe:{model:["sub","piano"],cutoff:[400,800],res:[.05,.12],level:[.95,1.15],send:[.1,.2],dsend:[0,.05]}},
      lead:{patterns:["wander","sparse","canon"], recipe:{model:["piano","fm"],wave:"sine",voices:[1,2],spread:[.001,.004],cutoff:[2400,3600],level:[.45,.6],send:[.35,.55],dsend:[.1,.3]}},
      pads:{prob:.8, recipe:{model:["piano","fm"],wave:"sine",cutoff:[1000,1700],detune:[.002,.006],attack:[.2,.8],level:[.4,.6],send:[.35,.55],dsend:[.05,.2]}},
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.6,.9],snare:[.45,.7],hat:[.8,1.15],tune:[.9,1.05],send:[.2,.4],dsend:[0,.1]},
      fx:{reverb:[.5,.7], delayBeats:[.5,.75], delayFb:[.1,.25], delayCut:[2200,3400], pump:[0,0], crackle:[.15,.4], lowcut:[0,25], highcut:[9000,14000], comp:[.1,.25]},
      found:{role:"bed", vol:[.05,.12], pitch:[.8,1], stretch:[.45,.6], cutoff:[1500,2600], sources:["tokyo_station","shibuya"]},
      stab:["off"], hits:{sources:["vox_b"], pattern:"sparse", prob:.1},
      form:"pop" },
  };

  // ---------- blending: N-way weighted mixing ----------
  // weights: [{g, w}] (normalized inside). Scalars weighted-average; discrete
  // dimensions draw a parent genre proportional to weight, per dimension —
  // standing on one anchor (w=1) is purely that genre.
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
    const blendRecipe = (get) => {
      const out={}, keys=new Set();
      ws.forEach(x=>Object.keys(get(GENRES[x.g])).forEach(k=>keys.add(k)));
      for(const k of keys){
        // parents missing a key sit out; weights renormalize over those that have it
        const have=ws.filter(x=>get(GENRES[x.g])[k]!=null);
        if(!have.length) continue;
        const v=get(have[0].g?GENRES[have[0].g]:GENRES[ws[0].g])[k];
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
    const hitsSide=side();
    const choice = {
      genres:ws.map(x=>x.g), weights:ws.map(x=>round(x.w,3)), t:round(1-(ws[0]?ws[0].w:1),3), seed,
      bpm: Math.round(inRange(rng, wRange(g=>g.bpm))),
      swing: round(inRange(rng, wRange(g=>g.swing)),3),
      humanize: round(inRange(rng, wRange(g=>g.humanize)),3),
      progression: pick(rng, side().progressions),
      kit: pick(rng, side().kits),
      fills: side().fills,
      bassPattern: pick(rng, side().bass.patterns),
      bassRecipe: blendRecipe(g=>g.bass.recipe),
      leadPattern: pick(rng, side().lead.patterns),
      leadRecipe: blendRecipe(g=>g.lead.recipe),
      padsOn: rng() < ws.reduce((s,x)=>s+GENRES[x.g].pads.prob*x.w,0),
      padRecipe: blendRecipe(g=>g.pads.recipe),
      drumRecipe: blendRecipe(g=>g.drums),
      fx: blendRecipe(g=>g.fx),
      foundRole: side().found.role,
      foundSource: pick(rng, side().found.sources),
      foundRecipe: blendRecipe(g=>({vol:g.found.vol,pitch:g.found.pitch,stretch:g.found.stretch,cutoff:g.found.cutoff})),
      stab: pick(rng, side().stab),
      hits: rng()<hitsSide.hits.prob ? {source:pick(rng,hitsSide.hits.sources), pattern:hitsSide.hits.pattern} : null,
      form: side().form,
      rng,
    };
    return constrain(choice);
  }
  function constrain(choice){
    // ---- constraints: keep midpoints songs ----
    const nch=(E.PROGRESSIONS[choice.progression]||{chords:[]}).chords.length;
    if(nch<=2 && ["composed","composed2"].includes(choice.leadPattern)) choice.leadPattern="arpup";
    if(choice.bpm>=150 && choice.kit!=="jungle" && choice.kit!=="breaks") choice.kit="jungle";
    if(choice.kit==="off"){ choice.foundRole="bed"; choice.stab="off"; }
    if(choice.foundRole==="chops" && choice.bpm<70) choice.foundRole="bed";
    if(choice.foundRole==="break" && !(SAMPLES[choice.foundSource]||{}).bpm){
      // break role needs a tempo-known break sample; otherwise fall back
      choice.foundSource="amen_170"; }
    if(choice.foundRole!=="break" && (SAMPLES[choice.foundSource]||{}).kind==="break"){
      choice.foundRole="break"; }
    return choice;
  }
  function resolve(aName, bName, t, seed){
    t=Math.max(0,Math.min(1,t||0));
    return resolveMulti([{g:aName,w:1-t},{g:bName||aName,w:t}], seed);
  }

  // ---------- forms ----------
  let _gid=0; const gid=()=>"g"+(++_gid);
  const S=(name,o)=>Object.assign({id:gid(),name,cycles:1,pads:false,bass:"off",drums:"off",melody:"off",found:{sourceId:null,role:"bed"},fill:"off"},o);
  function buildSections(c){
    const cycleBeats=(E.PROGRESSIONS[c.progression]||E.PROGRESSIONS.royal_road).chords.length*8;
    const norm=Math.max(1,Math.round(32/cycleBeats));
    const F=()=>pick(c.rng,c.fills);
    const fnd=(role)=>({sourceId:"src",role:role||c.foundRole});
    const hit=()=>c.hits?{sourceId:"hit",pattern:c.hits.pattern}:undefined;
    const lead=c.leadPattern, bass=c.bassPattern, kit=c.kit==="off"?"off":c.kit;
    let secs;
    if(c.form==="dj"){
      secs=[
        S("warmup",   {cycles:2*norm, drums:kit, found:fnd()}),
        S("build",    {cycles:2*norm, drums:kit, bass, found:fnd(), fill:F(), sweep:"open"}),
        S("main",     {cycles:2*norm, drums:kit, bass, pads:c.padsOn, found:fnd(), stab:c.stab}),
        S("lift",     {cycles:2*norm, drums:kit, bass, pads:c.padsOn, melody:lead, fill:F(), stab:c.stab, hits:hit()}),
        S("breakdown",{cycles:1*norm, pads:true, melody:lead==="off"?"off":"sparse", found:fnd("bed"), hits:hit(), sweep:"close"}),
        S("rebuild",  {cycles:1*norm, drums:"kick", bass, pads:c.padsOn, fill:F(), sweep:c.rng()<0.6?"open":"off"}),
        S("peak",     {cycles:3*norm, drums:kit, bass, pads:c.padsOn, melody:lead, found:fnd(), stab:c.stab, hits:hit()}),
        S("outro",    {cycles:2*norm, drums:kit, bass, found:fnd()}),
      ];
    } else if(c.form==="drop"){
      secs=[
        S("intro",  {cycles:1*norm, pads:c.padsOn, found:fnd()}),
        S("build",  {cycles:1*norm, drums:"kick", bass, pads:c.padsOn, fill:"riser", sweep:"open"}),
        S("drop",   {cycles:2*norm, drums:kit, bass, pads:c.padsOn, melody:lead, stab:c.stab, hits:hit(), found:fnd()}),
        S("break",  {cycles:1*norm, pads:true, melody:lead==="off"?"off":"sparse", found:fnd("bed"), sweep:"close", hits:hit()}),
        S("build 2",{cycles:1*norm, drums:"kick", bass, fill:"riser", sweep:"open"}),
        S("drop 2", {cycles:2*norm, drums:kit, bass, pads:c.padsOn, melody:lead, stab:c.stab, hits:hit(), found:fnd()}),
        S("outro",  {cycles:1*norm, pads:c.padsOn, found:fnd()}),
      ];
      // the impact lands ON each drop downbeat
      secs[1].fill="impact"; secs[4].fill="impact";
    } else if(c.form==="wave"){
      secs=[
        S("arrive", {cycles:1*norm, pads:true, found:fnd()}),
        S("drift",  {cycles:2*norm, pads:true, melody:lead, found:fnd()}),
        S("swell",  {cycles:2*norm, pads:true, bass, melody:lead, drums:kit, found:fnd(), hits:hit(), sweep:"open"}),
        S("recede", {cycles:2*norm, pads:true, melody:lead==="off"?"off":"sparse", found:fnd(), sweep:"close"}),
        S("depart", {cycles:1*norm, pads:true, found:fnd()}),
      ];
    } else {
      secs=[
        S("intro",      {cycles:1*norm, pads:c.padsOn, found:fnd()}),
        S("verse",      {cycles:1*norm, pads:c.padsOn, bass, drums:kit, found:fnd()}),
        S("pre-chorus", {cycles:1*norm, pads:c.padsOn, bass, drums:kit, fill:F(), sweep:c.rng()<0.7?"open":"off"}),
        S("chorus",     {cycles:1*norm, pads:c.padsOn, bass, drums:kit, melody:lead, stab:c.stab, hits:hit()}),
        S("verse 2",    {cycles:1*norm, pads:c.padsOn, bass, drums:kit, found:fnd()}),
        S("bridge",     {cycles:1*norm, pads:true, bass, melody:lead==="off"?"off":"sparse", found:fnd("bed"), fill:F(), hits:hit(), sweep:c.rng()<0.5?"close":"off"}),
        S("chorus 2",   {cycles:1*norm, pads:c.padsOn, bass, drums:kit, melody:lead, stab:c.stab}),
        S("outro",      {cycles:1*norm, pads:c.padsOn, found:fnd()}),
      ];
    }
    return {secs, cycleBeats};
  }

  // ---------- choice -> engine state ----------
  function toState(c, opts){
    opts=opts||{};
    const {secs, cycleBeats}=buildSections(c);
    if(opts.targetSec){
      const beats=secs.reduce((n,s)=>n+s.cycles*cycleBeats,0)+8;
      const k=opts.targetSec/(beats*60/c.bpm);
      if(k>1.15||k<0.85) secs.forEach(s=>{s.cycles=Math.max(1,Math.round(s.cycles*k));});
    }
    const foundSources=[];
    const isSample=!!SAMPLES[c.foundSource];
    const src=isSample?SAMPLES[c.foundSource]:(SOURCES[c.foundSource]||{});
    foundSources.push(Object.assign({id:c.foundSource,label:c.foundSource,url:src.url||""},
      isSample?{samplePath:"found/samples/"+src.file,bpm:src.bpm,durSec:src.durSec}:{},
      {vol:c.foundRecipe.vol,pitch:c.foundRole==="break"?1:c.foundRecipe.pitch,
       stretch:c.foundRecipe.stretch,cutoff:Math.round(c.foundRecipe.cutoff)}));
    if(c.hits){
      const h=SAMPLES[c.hits.source];
      if(h) foundSources.push({id:c.hits.source,label:c.hits.source,url:"",samplePath:"found/samples/"+h.file,
        durSec:h.durSec,vol:0.22,pitch:1,stretch:0.5,cutoff:4500});
    }
    const state={
      bpm:c.bpm, keyOffset:opts.keyOffset!=null?opts.keyOffset:0, progression:c.progression,
      reverb:c.fx.reverb, seed:c.seed, swing:c.swing, humanize:c.humanize,
      pump:c.fx.pump>0.05?c.fx.pump:0, crackle:c.fx.crackle>0.05?c.fx.crackle:0,
      comp:c.fx.comp>0.05?c.fx.comp:0,
      tone:{lowcut:c.fx.lowcut>10?Math.round(c.fx.lowcut):0, highcut:c.fx.highcut>1000?Math.round(c.fx.highcut):0},
      delay:{beats:c.fx.delayBeats, feedback:c.fx.delayFb, cutoff:Math.round(c.fx.delayCut)},
      instruments:{
        pad:Object.assign(E.defaultInstruments().pad, c.padRecipe),
        bass:Object.assign(E.defaultInstruments().bass, c.bassRecipe),
        melody:Object.assign(E.defaultInstruments().melody, c.leadRecipe, {voices:Math.round(c.leadRecipe.voices||2)}),
        drums:Object.assign(E.defaultInstruments().drums, c.drumRecipe),
      },
      foundSources,
      sections:secs.map(s=>{
        if(s.found&&s.found.sourceId==="src")s.found.sourceId=c.foundSource;
        if(s.hits&&s.hits.sourceId==="hit")s.hits.sourceId=c.hits?c.hits.source:null;
        if(s.hits&&!s.hits.sourceId)delete s.hits;
        return s; }),
    };
    state.genreMeta={genres:c.genres,t:c.t,seed:c.seed,form:c.form,kit:c.kit,progression:c.progression,
      bass:c.bassPattern+"("+c.bassRecipe.model+")",lead:c.leadPattern+"("+c.leadRecipe.model+")",
      pad:c.padRecipe.model,drums:c.drumRecipe.kickModel+"/"+c.drumRecipe.snareModel+"/"+c.drumRecipe.hatModel,
      found:c.foundSource+"/"+c.foundRole, stab:c.stab, hits:c.hits?c.hits.source:"-"};
    return state;
  }

  function track(genre, opts){ opts=opts||{}; return toState(resolve(genre, genre, 0, opts.seed!=null?opts.seed:1), opts); }
  function blend(a, b, t, opts){ opts=opts||{}; return toState(resolve(a, b, t, opts.seed!=null?opts.seed:1), opts); }

  // ---------- playlist ----------
  function playlist(waypoints, opts){
    opts=opts||{};
    const n=opts.tracks||12, hours=opts.hours||2, baseSeed=opts.seed!=null?opts.seed:42;
    const rng=mulberry32(baseSeed>>>0);
    const legs=Math.max(1,waypoints.length-1);
    const perSec=hours*3600/n;
    let key=Math.floor(rng()*12);
    const recent=[], out=[];
    for(let i=0;i<n;i++){
      const pos=legs*(n===1?0:i/(n-1));
      const leg=Math.min(legs-1,Math.floor(pos));
      const a=waypoints[leg], b=waypoints[leg+1]||a, t=pos-leg;
      const targetSec=perSec*(0.75+rng()*0.5);
      key=(key+(rng()<0.5?7:5))%12;
      let state=null, meta=null;
      for(let attempt=0; attempt<6; attempt++){
        const seed=baseSeed+i*101+attempt*1009;
        const cand=toState(resolve(a,b,t,seed), {targetSec, keyOffset:key});
        const m=cand.genreMeta;
        const sig=[m.kit,m.progression,m.bass,m.lead,m.found];
        const collide=recent.some(r=>sig.filter((v,j)=>v===r[j]).length>=3);
        if(!collide||attempt===5){ state=cand; meta=m; recent.push(sig); if(recent.length>2)recent.shift(); break; }
      }
      const beats=state.sections.reduce((nn,s)=>nn+(s.cycles||1)*(E.PROGRESSIONS[state.progression].chords.length*8),0)+8;
      out.push({ i, from:a, to:b, t:round(t,3), seconds:Math.round(beats*60/state.bpm),
        bpm:state.bpm, key, meta, state });
    }
    return out;
  }

  function mix(weights, opts){ opts=opts||{}; return toState(resolveMulti(weights, opts.seed!=null?opts.seed:1), opts); }
  const api={ GENRES, SOURCES, SAMPLES, resolve, resolveMulti, track, blend, mix, playlist };
  if(isNode) module.exports=api; else root.GenreKernel=api;

  // ---------- CLI ----------
  if(isNode && require.main===module){
    const fs=require("fs"), path=require("path"), {execFileSync}=require("child_process");
    const args=process.argv.slice(2);
    const flag=(name,dflt)=>{const ix=args.indexOf("--"+name); return ix>=0?args[ix+1]:dflt;};
    const has=(name)=>args.includes("--"+name);
    const cmd=args[0];
    function resolvePaths(state){
      for(const s of state.foundSources){
        s.fsPath=s.samplePath?path.join(__dirname,s.samplePath):path.join(__dirname,"found",s.id+".wav");
        if(!fs.existsSync(s.fsPath)){ console.error("✗ missing "+s.fsPath+" — run ./fetch-found-sound.sh and ./fetch-found-samples.sh"); process.exit(1); }
      }
    }
    function renderState(state, base){
      resolvePaths(state);
      const wav="/tmp/"+path.basename(base)+".wav";
      const csd=E.buildCsd(state).replace("<CsoundSynthesizer>",
        `<CsoundSynthesizer>\n<CsOptions>\n--nosound -o ${wav} -W\n</CsOptions>`);
      fs.writeFileSync("/tmp/"+path.basename(base)+".csd",csd);
      execFileSync("csound",["/tmp/"+path.basename(base)+".csd"],{stdio:["ignore","ignore","ignore"]});
      execFileSync("ffmpeg",["-y","-v","error","-i",wav,"-codec:a","libmp3lame","-b:a","160k",base+".mp3"]);
      console.log("✓ "+base+".mp3");
    }
    if(cmd==="anchors"){
      for(const [k,g] of Object.entries(GENRES)) console.log(k.padEnd(11),g.bpm.join("-")+"bpm",g.form.padEnd(4),"—",g.info);
    } else if(cmd==="track"||cmd==="blend"){
      const seed=+flag("seed",1);
      const state=cmd==="track"
        ? track(args[1],{seed})
        : blend(args[1],args[2],parseFloat(args[3]||"0.5"),{seed});
      const base=cmd==="track"?`${args[1]}-s${seed}`:`${args[1]}-${args[2]}-${args[3]||"0.5"}-s${seed}`;
      fs.writeFileSync(base+".state.json",JSON.stringify(state,null,2));
      console.log("✓ "+base+".state.json  ("+JSON.stringify(state.genreMeta)+")");
      if(has("verify")){ const V=require("./genre-verifier.js"); console.log(V.report(state)); }
      if(has("render")) renderState(state,base);
      if(has("audio-verify")){
        // empirical gate: Discogs-EffNet on the rendered audio (see audio-verifier.py)
        const py=path.join(__dirname,".venv-verify","bin","python");
        try{ execFileSync(py,[path.join(__dirname,"audio-verifier.py"),base+".mp3","--expect",args[1]],{stdio:"inherit"}); }
        catch(e){ console.error("audio verify: expected genre not in top 3"); }
      }
    } else if(cmd==="playlist"){
      const dashIx=args.findIndex(a=>a.startsWith("--"));
      const ways=args.slice(1,dashIx<0?undefined:dashIx);
      const pl=playlist(ways,{tracks:+flag("tracks",12),hours:+flag("hours",2),seed:+flag("seed",42)});
      const dir=flag("out","playlist");
      fs.mkdirSync(dir,{recursive:true});
      const manifest=pl.map(({state,...rest})=>rest);
      fs.writeFileSync(path.join(dir,"playlist.json"),JSON.stringify(manifest,null,2));
      pl.forEach(tr=>fs.writeFileSync(path.join(dir,`track-${String(tr.i+1).padStart(2,"0")}.state.json`),JSON.stringify(tr.state,null,2)));
      const total=pl.reduce((s,t)=>s+t.seconds,0);
      console.log(`✓ ${dir}/: ${pl.length} tracks, ${(total/3600).toFixed(2)}h`);
      pl.forEach(t=>console.log(`  ${String(t.i+1).padStart(2)} ${t.from}→${t.to} t=${t.t} ${t.bpm}bpm key=${t.key} ${Math.round(t.seconds/60)}min ${t.meta.kit} ${t.meta.bass} ${t.meta.lead} ${t.meta.progression} ${t.meta.found} hits=${t.meta.hits}`));
      const rf=+flag("render-first",0);
      for(let i=0;i<rf&&i<pl.length;i++) renderState(pl[i].state, path.join(dir,"track-"+String(i+1).padStart(2,"0")));
    } else {
      console.log("usage: genre-kernel.js anchors | track <genre> | blend <a> <b> <t> | playlist <a> <b> ... [--tracks N --hours H --out DIR]");
    }
  }
})(typeof window!=="undefined"?window:globalThis);
