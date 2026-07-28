// genres-data.js — the 274 genre anchors
//
// GENERATED ONCE by tools/split-kernel-data.js, and hand-edited ever since:
// this file is the SOURCE OF TRUTH for the data below, not a build artifact.
// genre-tool.js / invent-genres.js / rm-genre.js splice into it by the same
// /* genre-tool:<name>:genres */ markers they always used.
//
// Object.keys order is load-bearing: it drives the confusion-matrix row order and the star layout. Append, never reorder.
//
// Classic script on purpose, NOT JSON-over-fetch: app/access.js and
// app/starmap.js read the kernel synchronously at module top level, so the data
// has to be present the moment genre-kernel.js runs. Loaded immediately BEFORE
// it in index.html / embed.html / access.html (boot-smoke.js enforces order).
(function (root) {
  "use strict";
  const D = {};
  D.GENRES = {
    techno: { label:"Unblinking Interval", info:"A machine four at 124-140. Acid bass under an organ, with a pluck lead. A two-chord minor drone, a light shuffle, euclidean hats.",   // SYNTH-FORWARD: samples are texture, not the hook
      bpm:[124,140], swing:[0,0.06], humanize:[0,0.15],
      progressions:["drone_min","deep_two"], kits:["techno","pulse"], fills:["off","riser","cut","hat rush"],
      euclid:{hat:[7,16]},   // E(7,16) rotating closed-hat undergrid beneath the machine four (opens survive)
      bass:{patterns:["rolling","stab","sixteenths","pedal"], recipe:{model:["acid","saw","reese"],cutoff:[450,800],res:[.2,.35],level:[1.0,1.2],send:[0,.08],dsend:[0,.1]},
        inserts:{prob:.45, max:2, pool:[["filtersweep",{rateBars:[2,4],lo:[-1.2,-.6],hi:[.8,1.4],res:[.25,.45]}],["distort",{drive:[.15,.35],mix:[.5,.8]}]]}},   // the warehouse: slow acid-line sweeps, a touch of drive
      lead:{patterns:["double","double","arpup","off"], recipe:{model:["pluck","stack"],wave:"square",voices:[1,2],spread:[.002,.006],cutoff:[1500,2600],level:[.3,.42],send:[.15,.3],dsend:[.2,.4],vibrato:[0,.002],octave:0,attack:.003,release:[.04,.07],sustain:[.45,.55],fenv:[.8,1.2],res:[.28,.4]}},   // envelope identity (ex-ARTIC): tight resonant stab
      pads:{prob:.3, recipe:{model:["organ","saw"],wave:"saw",cutoff:[550,900],detune:[.004,.01],attack:[1.5,3],level:[.3,.45],send:[.3,.5],dsend:[.1,.2]}},   // dark low pad, mostly ABSENT — no royal-road wash here
      drums:{kickModel:["909"],snareModel:["clap","crack"],hatModel:["metal","noise"],kick:[1.25,1.5],snare:[.55,.8],hat:[.7,1],tune:[.95,1.1],send:[.05,.15],dsend:[.1,.25]},
      fx:{reverb:[.35,.55], delayBeats:[.5,.75], delayFb:[.3,.45], delayCut:[2000,3500], pump:[.4,.65], crackle:[0,.1], lowcut:[35,50], highcut:[0,0], comp:[.5,.7], grit:[.2,.45], jux:[.15,.35]},
      found:{role:"chops", vol:[.1,.18], pitch:[.9,1.1], stretch:[.4,.6], cutoff:[1800,3200], sources:["factory","shibuya","vx_wwvh","stml_chop_c4","stml_chop_d"]},
      stab:["offbeat","offbeat","rave","sparse"], hits:{sources:["pool:vocal_stab*1","pool:rave_stab*1","sp_system","sp_energy"], pattern:"sparse", prob:.5},
      form:"dj" },
    house: { label:"Congregation Furnace", info:"A four-on-the-floor at 120-126. Saw synth bass under a percussive organ, with a piano. A min7 house vamp, swung.",   // sample-mid: chops present, synths carry
      timeFeel:{ pushPullMs:{ hat:-4 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — HOUSE: the open-hat offbeat rides on top of the four. Hats only — the kick IS the sermon and must not move
      reverbColor:"dattorro",   // fx wings: clean plate on the stabs
      masterComp:0.3,   // effects audit B6: the SSL-buss pump-and-glue on the four-on-floor — the bus-comp argument that earned disco its masterComp applies most directly to Chicago house. Zero rng, dominant-parent
      bpm:[120,126], swing:[.08,.15], humanize:[.05,.18],
      progressions:["house_min7","lofi","deep_two"], kits:["house","house","four"], fills:["off","hat rush","riser"],
      bass:{patterns:["rolling","stab","melodic","syncopated"], patchPool:["SYN-BASS 2"], recipe:{model:["saw","sub","dx7"],cutoff:[380,700],res:[.15,.3],level:[1.0,1.2],send:[0,.08],dsend:[0,.05]}},   // ~1/3 of seeds: the DX7 SYN-BASS 2 patch (Faust engine; csound maps -> sub); syncopated = the push-pull jack
      lead:{patterns:["double","arpup","pentaup","updown"], recipe:{model:["piano","fm"],wave:"pulse",voices:[1,3],spread:[.003,.008],cutoff:[2200,3400],level:[.4,.52],send:[.25,.4],dsend:[.2,.35],octave:.05,attack:.004,release:[.07,.12],sustain:[.6,.72],fenv:[.4,.7]},
        inserts:{prob:.4, max:1, pool:[["chorus",{rate:[.6,1.2],depth:[.4,.6],mix:[.35,.55]}]]}},   // envelope identity (ex-ARTIC): plucky organ stab. piano riffs — the Marshall Jefferson move (the '88 piano got a chorus box)
      pads:{prob:.9, patchPool:["E.ORGAN 1","SYNORGAN 1"], samplerPool:["percussive_organ"], recipe:{model:["juno60","juno60","hammond","hammond","organ","dx7","sampler"],wave:"saw",cutoff:[1000,1600],detune:[.004,.009],attack:[.15,.4],chorus:[1,1.4],chorusSpread:[.8,1],bar513:8,bar4:0,bar1:4,leslie:[.8,.9],perc:[.5,.7],level:[.5,.65],send:[.25,.4],dsend:[.1,.25]}},   // STABS: Juno-60 chord-stab (stereo chorus) or the Hammond B-3 (888000004, Leslie), fast attack = stabby not washy
      drums:{kickModel:["909","boom"],snareModel:["clap"],hatModel:["noise"],kick:[1.15,1.4],snare:[.6,.85],hat:[1.0,1.3],tune:[.95,1.1],send:[.1,.25],dsend:[.05,.15]},   // hats UP — the open-hat offbeat must be heard
      fx:{reverb:[.4,.6], delayBeats:[.375,.75], delayFb:[.25,.4], delayCut:[2500,4000], pump:[.35,.5], crackle:[0,.15], lowcut:[30,45], highcut:[0,0], comp:[.4,.6]},
      found:{role:"chops", vol:[.1,.18], pitch:[.95,1.1], stretch:[.4,.6], cutoff:[2200,3600], sources:["shibuya","tokyo_station","vx_timelady","stml_chop_a","stml_chop_b","stml_chop_c4"]},
      stab:["rave","offbeat"], hits:{sources:["pool:rave_stab*2","pool:vocal_stab*1","sp_rhythm","stml_hit_01","stml_hit_03"], pattern:"offbeat", prob:.55},
      form:"dj" },
    jungle: { label:"Barometric Stampede", info:"A jungle kit at 158-172. Sub bass under a saw synth pad, with a pluck lead. A two-chord vamp, a light shuffle, euclidean hats.",   // SAMPLE-FORWARD: the amen IS the track
      timeFeel:{ pushPullMs:{ bass:-5 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — JUNGLE: the sub placed ahead of the break so it PULLS — the break's own internal timing is sacred, so only the bass moves
      bpm:[158,172], swing:[0,.08], humanize:[.1,.25],
      progressions:["deep_two","drone_min","minor_run"], kits:["jungle","breaks"], fills:["break fill","break fill","reverse","off"],
      euclid:{kick:[3,16]},   // E(3,16) tresillo kicks rotating under the amen — breakbeat kick science
      bass:{patterns:["sub","dub"], recipe:{model:["sub","reese"],cutoff:[260,480],res:[.05,.2],level:[1.2,1.45],send:[0,.05],dsend:[0,0]},
        inserts:{prob:.3, max:1, pool:[["distort",{drive:[.15,.35],mix:[.4,.7]}]]}},   // reese seeds get teeth (sub seeds stay clean via constrain)
      snarePP:0.5,   // effects audit B3: the jungle/DnB snare "rush" — the L/R ping-pong bounce on the amen snare. Below the .65 liberal threshold => legacy >=4-beat/.6 spacing (a THROW, not a smear); matrix-safe (tags existing snares, adds no drum events)
      lead:{patterns:["off","off","sparse","pentaup"], recipe:{model:["pluck","fm"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1600,2800],level:[.3,.42],send:[.3,.5],dsend:[.3,.5],octave:0,attack:.003,release:[.05,.09],sustain:[.5,.62],fenv:[.5,.8]}},   // envelope identity (ex-ARTIC): bright ragga stab
      pads:{prob:.25, recipe:{model:["saw","organ"],wave:"saw",cutoff:[500,850],detune:[.005,.012],attack:[2,3.5],level:[.3,.42],send:[.45,.65],dsend:[.15,.3]}},   // dark, mostly ABSENT — no soft royal-road wash under the amen
      drums:{kickModel:["808"],snareModel:["crack"],hatModel:["noise"],kick:[1.15,1.4],snare:[.6,.85],hat:[.4,.7],tune:[1.0,1.15],send:[.05,.15],dsend:[.35,.6]},
      fx:{reverb:[.35,.55], delayBeats:[.75,1.5], delayFb:[.4,.6], delayCut:[1800,3000], pump:[0,.15], crackle:[.05,.2], lowcut:[25,40], highcut:[0,0], comp:[.35,.55], grit:[.15,.35], jux:[.25,.5]},
      found:{role:"break", scratch:0.45, vol:[.3,.45], pitch:[1,1], stretch:[.5,.5], cutoff:[6000,9000], sources:["amen_165","amen_170","amen_172","amen_175","stml_loop_148a","stml_loop_157a","stml_loop_157b","stml_loop_167a"]},   // the BREAK DOMINATES: loud + wide open, real sampled drums not "light FM"; scratch on the stutter ornament
      stab:["off","sparse"], hits:{sources:["pool:vb_junglist*1","pool:vocal_stab*1","pool:rave_stab*1","sp_rewind","sp_pressure"], pattern:"dub", prob:.75},
      form:"dj" },
    triphop: { label:"Inclement Surveillance", info:"A boom-bap kit at 72-92. Acoustic bass under strings, with a muted trumpet. Neo-soul changes, hard swing, loose timing.",   // SAMPLE-FORWARD
      bpm:[72,92], swing:[.15,.3], humanize:[.2,.45],
      progressions:["neosoul","lofi","minor_run","mode_dorian"], kits:["boombap","breaks","halftime"], fills:["off","drum fill","downlift"],
      bass:{patterns:["dub","simple","sub"], samplerPool:["acoustic_bass"], recipe:{model:["sub","saw","sampler"],cutoff:[300,600],res:[.05,.2],level:[1.0,1.25],send:[.05,.12],dsend:[0,.1]},
        inserts:{prob:.5, max:1, pool:[["distort",{drive:[.1,.22],mix:[.35,.6]}]]}},   // soft tape saturation for the dub-weight bass, less synthy (sampler/upright draws skip inserts via constrain; sub/saw get the warmth)
      snarePP:0.72,   // the trip-hop ping-pong snare (Portishead/Massive Attack) — wet + liberal throw across the slowed break
      timeFeel:{ pushPull:{ bass:.015, hat:-.005 } },   // effects audit A5: the Dilla drag — the slowed break sits behind the beat, hats on top. Sibling of downtempo/lofi; zero-rng dominant-parent, bass/hat timing unread by the verifier. Deliberately half-strength: at double these offsets the timing feel overshoots.
      lead:{patterns:["sparse","wander","off"], patchPool:["E.PIANO 2"], samplerPool:["muted_trumpet","tenor_sax"], recipe:{model:["fm","dx7","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.006],cutoff:[1800,3000],level:[.4,.52],send:[.4,.6],dsend:[.3,.5],vibrato:[.004,.01],octave:.08,attack:.05,release:[.3,.45],sustain:[.78,.88],fenv:[.2,.4]}},   // ~1/3: the tine EP through the dust; envelope identity (ex-ARTIC): dark filtered legato
      pads:{prob:.85, samplerPool:["strings"], recipe:{model:["fm","strings","sampler"],wave:"sine",cutoff:[800,1400],detune:[.004,.01],attack:[1,2.5],level:[.5,.68],send:[.45,.65],dsend:[.15,.3]},
        inserts:{prob:.35, max:1, pool:[["phaser",{rate:[.06,.18],depth:[.4,.6],mix:[.3,.5]}]]}},   // a slow smoky phase on the strings
      drums:{kickModel:["808","boom"],snareModel:["noise","crack"],hatModel:["noise"],kick:[1.05,1.3],snare:[.65,.9],hat:[.5,.8],tune:[.8,.95],send:[.15,.3],dsend:[.15,.35],kit:"room"},   // SAMPLED room kit — the slowed Bristol break (note: sampled snare skips the pp throw)
      fx:{reverb:[.6,.78], delayBeats:[.75,1.5], delayFb:[.3,.5], delayCut:[1500,2600], pump:[0,.1], crackle:[.35,.6], lowcut:[0,30], highcut:[9000,14000], comp:[.25,.4]},
      found:{role:"break", vol:[.18,.3], pitch:[1,1], stretch:[.5,.5], cutoff:[3800,5500], sources:["amen_165","amen_170","stml_loop_81a","stml_loop_85a","stml_loop_89b"]},
      stab:["off"], hits:{sources:["pool:vocal_stab*1","blues_vox_78","sp_slowdown"], pattern:"sparse", prob:.55},
      form:"pop" },
    vaporwave: { label:"Food Court Eternity", info:"A full kit at 62-88. Saw synth bass under ahh choir, with an alto sax. Royal-road changes, a light shuffle.",   // SAMPLE-FORWARD: the bed is the place
      bpm:[62,88], swing:[0,.12], humanize:[.05,.25],
      progressions:["royal_road","dream","pop_1625","neosoul"], kits:["full","open","halftime"], fills:["drum fill","riser","downlift","off"],
      bass:{patterns:["simple","walking","root"], recipe:{model:["saw"],cutoff:[500,900],res:[.1,.25],level:[.9,1.1],send:[.05,.15],dsend:[0,.1]}},
      lead:{patterns:["composed","composed2","arpup","wander"], patchPool:["E.PIANO 1","TUB BELLS","E.PIANO 4","SHIMMER"], samplerPool:["alto_sax","tenor_sax"], recipe:{model:["stack","stack","dx7","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.003,.006],cutoff:[2800,4000],level:[.4,.52],send:[.4,.6],dsend:[.2,.4],vibrato:[.004,.009],octave:.2,attack:.08,release:[.45,.6],sustain:[.85,.95],granular:4},   // granular repitch (A.2): the slowed mall sax keeps its breath/length when dragged far from a zone root instead of chipmunking (sampler-model draws only; stack/dx7 ignore it)
        inserts:{prob:.5, max:1, pool:[["chorus",{rate:[.5,1.1],depth:[.5,.7],mix:[.4,.6]}]]}},   // envelope identity (ex-ARTIC): lush sine wash — OWNS the legato-sine corner   // DX7 shelf all alg 5 -> blends MORPH between them; 1/4: THE mall sax (sampled, real) — the slowed-down smooth-jazz ghost
      pads:{prob:1, samplerPool:["ahh_choir","strings"], recipe:{model:["saw","choir","strings","sampler"],wave:"saw",cutoff:[1100,1800],detune:[.004,.009],attack:[1.2,2.4],mellotron:true,level:[.6,.8],send:[.5,.7],dsend:[.1,.25]},
        inserts:{prob:.55, max:1, pool:[["chorus",{rate:[.2,.5],depth:[.5,.75],mix:[.4,.6]}]]}},   // dreampop-wash chorus on the pad bed, now through the MELLOTRON tape head — the worn-VHS wow/flutter IS the vaporwave move (matrix-invisible flag; the ahh_choir+strings pad is the perfect substrate)
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.9,1.15],snare:[.6,.85],hat:[.75,1.05],tune:[.95,1.1],send:[.15,.3],dsend:[0,.1]},
      fx:{reverb:[.8,.92], delayBeats:[.75,1.5], delayFb:[.25,.4], delayCut:[2200,3200], pump:[0,.1], crackle:[.05,.3], lowcut:[0,0], highcut:[9000,13000], comp:[0,.15]},   // effects audit tier-C soft-top: slowed-VHS tape muffle — a GENTLE soft-top (brighter than lofi's 7500-11k; the mall tape is worn, not crushed). Flips softTop 0->1, re-fenced (see below)
      found:{role:"bed", vol:[.18,.28], pitch:[.7,.85], stretch:[.4,.55], cutoff:[2200,3200], sources:["tokyo_station","pool:city*2","pool:voices*3"]},
      stab:["off"], hits:{sources:["pool:vb_mallsoft_vapor*1","sp_plaza","sp_shopping","pool:vocal_stab*1"], pattern:"sparse", prob:.5},
      autoTune:0.25,   // fx wings stage 2: a GENTLE bend of the slowed mall bed toward the maj7 key — subtle, not hyperpop
      form:"pop" },
    synthwave: { label:"Highway Heat Death", info:"A pulse kit at 88-116. Saw synth bass under a Juno pad, with a stacked saws lead. Synthwave changes, a light shuffle.",   // SYNTH-FORWARD: beds distant
      bpm:[88,116], swing:[0,.05], humanize:[.05,.15],
      progressions:["synthwave","epic_min","andalusian","minor_run"], kits:["pulse","four","open"], fills:["tom fill","tom fill","riser","off"],
      bass:{patterns:["drive","octaves","sixteenths","pedal"], recipe:{model:["saw","reese"],cutoff:[550,900],res:[.15,.3],level:[1.1,1.3],send:[0,.08],dsend:[0,0]}},
      lead:{patterns:["hero","arp16","updown","arpdown","anthem"], recipe:{model:["stack","modeld"],wave:"saw",voices:[5,7],spread:[.01,.018],cutoff:[2600,3600],level:[.45,.6],send:[.35,.55],dsend:[.25,.4],vibrato:[.002,.005],
        glide:[60,150],envAmount:[1,1.8],envDecay:[.15,.3],oscMix:[.15,.5],drift:[4,9],drive:[.1,.3],octave:.08,attack:.02,release:[.26,.36],sustain:[.82,.9],fenvAmount:[1,1.6],fenvAttack:[.25,.5],fenvDecay:[.6,1.2]}},   // envelope identity (ex-ARTIC): soaring supersaw. half the seeds: THE fat mono Model-D hero lead, gliding between legato notes (stack ignores the modeld keys) — BALANCE LOOP 3: the legacy fenv multiplier replaced by the unified surface as a BRASS SWELL (slow fenvAttack opens the filter INTO each held note, long decay settles it — the night-drive filter bloom)
      pads:{prob:1, recipe:{model:["juno60","juno60","juno60","juno60","saw"],wave:"saw",cutoff:[1100,2200],detune:[.01,.018],attack:[1.2,2.4],chorus:[1.3,1.8],chorusSpread:[.85,1],level:[.65,.85],send:[.45,.65],dsend:[.15,.3]},
        inserts:{prob:.6, max:1, pool:[["phaser",{rate:[.08,.25],depth:[.5,.8],mix:[.4,.6]}]]}},   // the Juno-60 night-drive pad (BBD chorus, stereo) — mostly juno60, saw the fallback; the phaser insert shimmers it further
      drums:{kickModel:["909","boom"],snareModel:["noise"],hatModel:["noise"],kick:[1.2,1.45],snare:[.9,1.15],hat:[.4,.65],tune:[.85,1],send:[.45,.65],dsend:[.05,.15]},
      fx:{reverb:[.75,.88], delayBeats:[.5,.75], delayFb:[.25,.4], delayCut:[1800,2800], pump:[.15,.35], crackle:[0,.1], lowcut:[30,45], highcut:[0,0], comp:[.25,.4]},
      found:{role:"bed", vol:[.08,.14], pitch:[.65,.8], stretch:[.45,.6], cutoff:[1000,1800], sources:["pool:road*1","pool:industry*1","pool:voices*1"]},
      stab:["off","sparse"], hits:{sources:["pool:vocal_stab*1","sp_nightdrive"], pattern:"sparse", prob:.3},
      form:"pop" },
    lofi: { label:"Dust Census", info:"A boom-bap kit at 72-88. Acoustic bass under an FM lead pad, with an alto sax. Lo-fi changes, hard swing, loose timing.",   // SAMPLE-FORWARD
      bpm:[72,88], swing:[.18,.32], humanize:[.25,.5],
      progressions:["lofi","neosoul","ii_v_i","pop_1625"], kits:["boombap","halftime"], fills:["off","off","drum fill"],
      bass:{patterns:["simple","dub","root"], samplerPool:["acoustic_bass"], recipe:{model:["sub","saw","sampler"],cutoff:[350,650],res:[.05,.15],level:[.9,1.1],send:[.05,.12],dsend:[0,.05]},
        inserts:{prob:.5, max:1, pool:[["distort",{drive:[.1,.22],mix:[.35,.6]}]]}},   // soft TAPE saturation — warms the DI'd sub/saw, less synthy (cubicnl adds upper harmonics, fundamental intact); distort rides the sub too (constrain only fences chorus/phaser off it). 1/3 of seeds the Dilla/Nujabes UPRIGHT (real, sampler draws skip distort via constrain) — lofi has no sub/acoustic fence, matrix-invisible
      snarePP:0.78,   // the dusty boombap snare THROW — wet + liberal (>=.65 => >=2-beat/.82 spacing in buildEvents): most backbeats tail into the ping-pong. lo-fi's signature move
      timeFeel:{ pushPull:{ bass:.015, hat:-.005 } },   // effects audit A5: the Dilla drag made structural — bass drags behind the grid, hats ride a touch on top (the boombap head-nod). Sibling of downtempo's Bristol lean; zero-rng dominant-parent, bass/hat timing unread by the verifier. Deliberately half-strength: at double these offsets the timing feel overshoots.
      lead:{patterns:["pentaup","sparse","wander"], patchPool:["E.PIANO 1","E.PIANO 3"], samplerPool:["alto_sax","upright_piano","felt_piano","jazz_guitar"], recipe:{model:["fm","pluck","sampler","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1800,2800],level:[.4,.52],send:[.35,.5],dsend:[.2,.35],vibrato:[.005,.012],octave:.06,attack:.025,release:[.12,.2],sustain:[.66,.78],fenv:[.15,.3]},
        inserts:{prob:.4, max:1, pool:[["chorus",{rate:[.3,.8],depth:[.5,.8],mix:[.35,.55]}]]}},   // envelope identity (ex-ARTIC): mellow dusty   // ~1/3: DX7 E.PIANO 1 through the dust; deep slow chorus = tape wow; sampler draws split sax / the pianos, incl. the FreePats Kawai upright — the real dusty-apartment piano under the boombap
      pads:{prob:.9, recipe:{model:["fm"],wave:"sine",cutoff:[900,1500],detune:[.003,.008],attack:[.8,1.8],level:[.5,.68],send:[.35,.55],dsend:[.1,.2]}},
      drums:{kickModel:["808"],snareModel:["noise"],hatModel:["noise"],kick:[1.0,1.25],snare:[.55,.8],hat:[.55,.85],tune:[.8,.95],send:[.1,.22],dsend:[0,.1],kit:"room"},   // SAMPLED room kit — warm/dusty for the lo-fi head-nod (note: sampled snare skips the pp throw)
      fx:{reverb:[.5,.7], delayBeats:[.5,.75], delayFb:[.2,.35], delayCut:[1800,2800], pump:[0,.1], crackle:[.5,.8], lowcut:[0,25], highcut:[7500,11000], comp:[.15,.3]},
      found:{role:"bed", vol:[.14,.22], pitch:[.75,.9], stretch:[.4,.55], cutoff:[1600,2600], sources:["pool:city*2","vx_dday"]},
      stab:["off"], hits:{sources:["pool:vocal_stab*1","sp_slowdown"], pattern:"sparse", prob:.35},
      form:"pop" },
    downtempo: { label:"Benthic Patience", info:"A boom-bap kit at 62-80. Acoustic bass under strings, with a flute. Neo-soul changes, swung.",   // wash-trio deep pass: the BEAT one. Its identity claim ambient/newage can't share is a real swung backbeat (drumDensity + swing floors), leaned laid-back
      bpm:[62,80], swing:[.1,.22], humanize:[.15,.35],   // bpm ceiling 84->80 keeps downtempo clearly SLOWER than exotica's tiki-lounge floor (82) — the swung-acoustic-lounge collision was pre-existing (downtempo's flute lead reads acoustic); the bpm fence breaks it. swing FLOOR up .05->.10 — the groove is never straight, and clearly ABOVE vaporwave's machine-time (renders .03-.08): the two-way fence — downtempo scores off vaporwave's diagonal (vaporwave row caps swing .08) AND the straight-time wash cluster scores off downtempo's (row swing floor .06)
      timeFeel:{ pushPull:{ bass:.011, hat:-.007 } },   // the Bristol lean made structural (drawless per-voice offset) — bass drags behind the grid, hats ride a touch on top: the head-nod that says trip-hop, not machine-time vaporwave. Deliberately half-strength: at double these offsets the timing feel overshoots.
      progressions:["neosoul","dream","deep_two","mode_mixo"], kits:["boombap","halftime","kick"], fills:["off","downlift","riser"],
      bass:{patterns:["simple","dub","sub"], samplerPool:["acoustic_bass"], recipe:{model:["sub","sub","sampler"],cutoff:[300,550],res:[.05,.15],level:[.95,1.15],send:[.05,.12],dsend:[0,.05]},
        inserts:{prob:.45, max:1, pool:[["distort",{drive:[.09,.18],mix:[.3,.5]}]]}},   // gentlest tape warmth on the pure-sub bass — harmonics for body (distort keeps the fundamental where a chorus would comb-hollow it), less synthy but still DEEP. 1/3 the Bristol UPRIGHT under the head-nod; sub kept 2/3 so mean sub stays over the weighted [.5,1,2] fence (MEASURED)
      snarePP:0.66,   // the Bristol head-nod snare feeds the ping-pong too — liberal but the gentlest send of the three (the patient one)
      lead:{patterns:["sparse","off","wander"], patchPool:["E.PIANO 3","E.PIANO 4"], samplerPool:["flute","muted_trumpet","felt_piano"], recipe:{model:["fm","sampler","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[2000,3000],level:[.4,.5],send:[.45,.65],dsend:[.3,.45],vibrato:[.003,.008],octave:.1,attack:.04,release:[.28,.4],sustain:[.8,.9],fenv:[.1,.25]}},   // STRONG-SAMPLE: no DX7 fake — 3/4 real flute/muted-trumpet/felt-piano over the head-nod; the warm fm tine keeps one seed (downtempo has no acoustic fence; bpm/swing floors hold the diagonal)
      pads:{prob:1, samplerPool:["strings"], recipe:{model:["organ","saw","sampler"],wave:"saw",cutoff:[800,1400],detune:[.005,.011],attack:[2,4],level:[.6,.78],send:[.5,.7],dsend:[.15,.3]},
        inserts:{prob:.3, max:1, pool:[["phaser",{rate:[.05,.15],depth:[.4,.6],mix:[.3,.5]}]]}},   // barely-moving phase — patience as an effect
      drums:{kickModel:["808","boom"],snareModel:["noise"],hatModel:["noise"],kick:[.95,1.2],snare:[.5,.75],hat:[.45,.75],tune:[.85,1],send:[.2,.35],dsend:[.05,.2]},
      fx:{reverb:[.72,.88], delayBeats:[.75,1.5], delayFb:[.3,.5], delayCut:[1800,2800], pump:[0,.15], crackle:[.1,.3], lowcut:[0,25], highcut:[0,0], comp:[.15,.3]},
      found:{role:"bed", vol:[.14,.24], pitch:[.7,.9], stretch:[.45,.6], cutoff:[1800,2800], sources:["pool:city*1","pool:road*1","pool:voices*1"]},
      stab:["off"], hits:{sources:["pool:vocal_stab*1","sp_herenow"], pattern:"sparse", prob:.2},
      form:"pop" },
    ambient: { label:"Stationary Weather", info:"Beatless at 58-72. Sub bass under ahh choir, with a harp. A two-chord minor drone, one chord every 32 beats.",   // wash-trio deep pass: the STATIC one. Its identity claim the wash trio can't share is ZERO harmonic motion + ZERO kit + the longest plateau
      bpm:[58,72], swing:[0,0], humanize:[.1,.3],
      progressions:["drone_min","drone_min","deep_two"], kits:["off"], fills:["off"],   // DRONE-ONLY (was dream/deep_two/drone_min/mode_lydian) — motion collapses to 0 (deep_two the rare 2-chord breath, .33); and NO kit EVER (was off/off/kick) — drumDensity strictly 0. This is the structural fence vs downtempo (which now REQUIRES a beat) and newage (which now REQUIRES motion+rubato)
      chordEvery:32,   // the LONGEST harmonic plateau in the catalog (4 bars per chord — twice mallsoft's 16) — the drone holds the length of the room; nothing changes
      bass:{patterns:["off","off","root"], recipe:{model:["sub"],cutoff:[250,450],res:[.05,.1],level:[.7,.95],send:[.2,.4],dsend:[0,.1]}},
      lead:{patterns:["off","sparse"], samplerPool:["harp"], recipe:{model:["fm","stack","sampler"],wave:"sine",voices:[1,2],spread:[.002,.004],cutoff:[2000,3200],level:[.3,.45],send:[.6,.8],dsend:[.3,.5],vibrato:[.002,.006],octave:.14,attack:[.5,.9],release:[.7,1.1],sustain:[.95,1]}},   // envelope identity (ex-ARTIC): infinite swell — OWNS the drone corner
      pads:{prob:1, patchPool:["TUB BELLS","SHIMMER","WATER GDN"], samplerPool:["ahh_choir","harp"], recipe:{model:["organ","dx7","sampler","sampler"],wave:"saw",cutoff:[600,1200],detune:[.006,.014],attack:[3,5],level:[.65,.85],send:[.65,.85],dsend:[.15,.3]},
        inserts:{prob:.4, max:2, pool:[["chorus",{rate:[.1,.3],depth:[.4,.7],mix:[.3,.5]}],["filtersweep",{rateBars:[8,16],lo:[-.8,-.3],hi:[.5,1],res:[.1,.25]}]]}},   // ~1/3: DX7 TUB BELLS in the enormous reverb (csound maps -> bell); glacial chorus / 8-16-bar sweeps — the drone breathes
      drums:{kickModel:["808"],snareModel:["noise"],hatModel:["noise"],kick:[.6,.9],snare:[.4,.65],hat:[.4,.7],tune:[.8,1],send:[.3,.5],dsend:[0,.1]},
      fx:{reverb:[.88,.95], delayBeats:[1,1.5], delayFb:[.4,.6], delayCut:[1500,2500], pump:[0,0], crackle:[0,.2], lowcut:[0,0], highcut:[0,0], comp:[0,.1]},
      found:{role:"bed", vol:[.2,.32], pitch:[.6,.8], stretch:[.45,.6], cutoff:[2000,3400], sources:["pool:road*2","pool:city*1","pool:voices*2"]},
      stab:["off"], hits:{sources:["pool:vocal_stab*1","sp_herenow"], pattern:"sparse", prob:.15},
      form:"wave" },
    dinosynth: { label:"Cretaceous Vespers", info:"A tribal kit at 72-96. Sub bass under ahh choir, with french horns. Primeval fifths, a light shuffle.",
      reverbColor:"greyhole",   // fx wings: the diffuse dark-ambient smear (primordial swamp)
      bpm:[72,96], swing:[0,.05], humanize:[.15,.35],
      progressions:["primeval","epic_min","andalusian","minor_run","mode_phrygian"],   // cinematic, moving — no static drone
      kits:["tribal"], fills:["off","off","downlift"],   // full tribal kit carries it; fills mostly off (no fill-reliance)
      bass:{patterns:["root","sub","off"], recipe:{model:["sub","reese"],cutoff:[240,460],res:[.05,.18],level:[.85,1.1],send:[.15,.35],dsend:[0,.1]}},
      lead:{patterns:["wander","updown","pentaup"], patchPool:["HORNS","BRASSHORNS"], samplerPool:["french_horns"], recipe:{model:["brass","dx7","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1500,2600],level:[.36,.5],send:[.55,.78],dsend:[.3,.5],vibrato:[.004,.01]}},   // warm theme (no inharmonic bell-FM); ~1/3 DX7 horns (alg-18 pair -> morphable)
      pads:{prob:1, samplerPool:["ahh_choir"], recipe:{model:["vp330","vp330","vp330","choir","strings","sampler"],wave:"saw",cutoff:[700,1300],detune:[.006,.014],attack:[2.5,4.5],vowel:[.4,.5],ensemble:[.9,1],mellotron:true,level:[.62,.82],send:[.6,.82],dsend:[.15,.3]}},   // the VP-330 ghost-choir (wide ensemble) haunting the swamp, over real choir + strings — the sampled choir plays through the MELLOTRON tape head (primordial wow/flutter, byte-stable flag)
      drums:{kickModel:["boom","808"],snareModel:["noise"],hatModel:["noise"],kick:[1.3,1.6],snare:[.5,.72],hat:[.55,.85],tune:[.78,.95],send:[.25,.45],dsend:[.3,.55]},   // kick hard, snare DOWN, hats up (whole kit), echo on the throws
      fx:{reverb:[.82,.94], delayBeats:[.75,1.5], delayFb:[.5,.68], delayCut:[1500,2500], pump:[0,.05], crackle:[.04,.12], lowcut:[0,25], highcut:[8000,13000], comp:[.4,.62], grit:[.25,.5]},   // crackle way down; compressed + long dub echo
      found:{role:"bed", vol:[.18,.3], pitch:[.6,.78], stretch:[.45,.6], cutoff:[1800,3000], sources:["pool:water*1","pool:road*1","pool:city*1","pool:industry*1"]},   // 4 beds rotate — pitched-down ocean-column + city recordings read as tar-pit / geothermal swamp
      vox:{sources:["sp_paleo_welcome","sp_paleo_mesozoic","sp_paleo_sauropod","sp_paleo_rex","sp_paleo_bones","sp_paleo_skies"], vol:0.5, pitch:0.96, cutoff:6500},   // glitched paleontologist narration
      stab:["off"], hits:{sources:["sp_herenow","pool:vocal_stab*1"], pattern:"sparse", prob:.15},
      // Phase-4 PILOT: a distant paleontologist RESPONSE — the blues 78rpm
      // call-and-response / the thunk "answer the lead" idea, generalized to a
      // sample role: a glitched utterance answers on the back half of the
      // melodic bars (theme/finale). Additive over the bespoke vox handler;
      // only dinosynth's own fixtures drift.
      sampleEvents:[{ pool:["sp_paleo_skies","sp_paleo_bones"], placement:"response", sections:"theme|finale",
        gain:.5, prob:.4, treatment:{pitch:.9, cutoff:3200, rsend:.4, dsend:.3, glitch:true} }],
      form:"ritual" },   // creature solos + fuzz solo + glitched VO (see buildSections)
    canawave: { label:"Loon Referendum", info:"A four-on-the-floor at 108-114. Saw synth bass under a church organ, with a plucked string lead. Four-chord changes, a light shuffle.",
      bpm:[108,114], swing:[0,.06], humanize:[.08,.2],
      progressions:["four_chords","doo_wop","sad_pop"],   // anthemic TRIADIC pop — pop_1625's seventh color read as disco (validate-genres gate 2)
      kits:["four","full"], fills:["tom fill","tom fill","riser"],   // toms into every lift, steady bright hats — NOT "open" (open-hat offbeats read as disco; validate-genres gate 2 caught canawave losing its own diagonal on open-kit seeds)
      bass:{patterns:["walking"], recipe:{model:["saw"],cutoff:[600,900],res:[.1,.18],level:[.6,.75],send:[.03,.07],dsend:[0,.04]}},   // walking (diatonic, in key); FAR lower in the mix
      lead:{patterns:["arp16"], recipe:{model:["kpluck"],wave:"saw",drive:.45,cutoff:[3000,3800],level:[.62,.74],send:[.16,.26],dsend:[.46,.56]},
        inserts:{prob:.8, max:1, pool:[["chorus",{rate:[.7,1.1],depth:[.45,.65],mix:[.45,.6]}]]}},   // THE lead = octave-lower octave-doubled 16th arp, distortion + chorus + 1/4T echo (Edge), BIGGER — the chorus box is now a real insert
      pads:{prob:1, samplerPool:["church_organ"], recipe:{model:["organ","organ","sampler"],wave:"saw",cutoff:[1500,2200],detune:[.004,.008],attack:[.3,.7],level:[.4,.52],send:[.16,.26],dsend:[0,.06]}},   // organ, supportive (behind)
      drums:{kickModel:["boom","909"],snareModel:["noise","clap"],hatModel:["noise"],kick:[1.1,1.3],snare:[.95,1.15],hat:[1.3,1.6],tom:[.85,1.05],tune:[.95,1.1],send:[.12,.2],dsend:[.03,.07]},   // snare up, hats UP (clearly audible), toms natural + not loud
      fx:{reverb:[.28,.4], delayBeats:[.6667,.6667], delayFb:[.3,.4], delayCut:[3200,4600], pump:[0,.12], crackle:[0,0], lowcut:[30,45], highcut:[0,0], comp:[.25,.4], grit:[0,0]},   // simplified: 1/4T delay kept (for the guitar), less reverb/feedback/comp, no grit/crackle
      found:{role:"narration", vol:[.28,.38], pitch:[.95,.98], stretch:[.45,.6], cutoff:[2600,3800], sources:["leacock1","leacock2","leacock3","leacock4"]},   // Leacock — different chapters rotate
      vox:{sources:["sp_ca_hockey","sp_ca_hnic","sp_ca_cup","sp_ca_topshelf","sp_ca_fivehole","sp_ca_gretzky","sp_ca_save","sp_ca_overtime","sp_ca_news","sp_ca_justwatchme"], vol:0.5, pitch:1, cutoff:8000, clean:true},   // hockey play-by-play + lore
      voxPoem:"sp_ca_cities",   // the rhyming-cities poem, chopped into verse 2
      hits:{sources:["ca_loon"], pattern:"sparse", prob:1, wet:true, glitch:true, vol:0.035},   // the loon — a quiet whisper, verse 1 only
      // the goal horn — FULL-volume opener (was the bespoke `hornSource`/hits path):
      // KERNEL-V4 opener sample-event, one blast on the first section's downbeat.
      // gain 1.8 = the old hits-handler boost; vol 0.42 = the old hornVol default.
      sampleEvents:[{ pool:["ca_horn"], placement:"opener", gain:1.8, treatment:{cutoff:6000, vol:0.42, rsend:0.6, dsend:0.45} },
        // CARD-TRUTH WAVE: the Canadiana anthems (sp_ca_maple/gold/lights/rockies/sorry) were
        // registered speech wired to nothing — the "national news" the card promises. Buried
        // and spaced under the anthem, kept low so it doesn't crowd the hockey vox.
        { pool:["sp_ca_maple","sp_ca_gold","sp_ca_lights","sp_ca_rockies","sp_ca_sorry"], placement:"buried", sections:"all", treatment:{cutoff:4400, vol:0.36, every:4, maxDur:14, rsend:0.16, dsend:0.12} }],
      stab:["off"],
      form:"anthem" },   // pop structure; grand brass swell at the bridge (see buildSections)
    transitwave: { label:"Rail Replacement Rapture", info:"A pulse kit at 110-118. Saw synth bass under strings, with a stacked saws lead. Synthwave changes, swung, quantized tight.",
      bpm:[110,118], swing:[.1,.16], humanize:[.02,.08],   // chugging choo-choo shuffle (the drums chug; the arp stays mostly tight)
      progressions:["synthwave","minor_run","deep_two"],   // hypnotic minor/modal — Trans-Europe Express (motion + the occasional 2-chord vamp)
      kits:["pulse","four"], fills:["tom fill","drum fill","riser","hat rush","impact","break fill","downlift"],   // straight driving kit = clickety-clack; a real spread of fills (see transit form)
      bass:{patterns:["octaves","drive","rolling"], recipe:{model:["saw"],cutoff:[700,1100],res:[.12,.22],level:[1,1.2],send:[.04,.1],dsend:[0,.06]}},   // motorik sequenced bass, up front
      lead:{patterns:["motorik"], recipe:{model:["stack"],wave:"square",voices:[1,2],spread:[.004,.009],cutoff:[2000,2800],res:[.46,.6],octave:0,drive:[.4,.6],attack:.003,release:[.05,.08],sustain:[.55,.68],fenv:[1.2,1.9],level:[.52,.64],send:[.22,.32],dsend:[.36,.5],swellHz:.13,swellDepth:.45,swellPhase:0},
        inserts:{prob:.4, max:1, pool:[["phaser",{rate:[.15,.4],depth:[.5,.7],mix:[.35,.55]}]]}},   // Kraftwerk sequencer: RAW square (1-2 osc, pure), MORE BITE (more drive + brighter + sharper filter sweep), staccato 8th notes; breathes up/down via swell; smoothed by delay+reverb; sometimes phased — Autobahn's whoosh
      pads:{prob:.9, recipe:{model:["strings","saw"],wave:"saw",cutoff:[1100,1800],detune:[.006,.012],attack:[.8,1.6],level:[.32,.44],send:[.16,.3],dsend:[.08,.2]}},   // cold platform strings, kept behind the groove (not a wash)
      drums:{kickModel:["909","boom"],snareModel:["noise","clap"],hatModel:["noise","metal"],kick:[1.15,1.35],snare:[.78,1],hat:[1.05,1.45],tune:[.95,1.05],send:[.14,.24],dsend:[.05,.14]},   // hats UP = wheels over rail joints; the groove drives, kit forward
      fx:{reverb:[.24,.36], delayBeats:[.5,.5], delayFb:[.32,.46], delayCut:[2400,3600], pump:[.06,.18], crackle:[0,.08], lowcut:[30,45], highcut:[0,0], comp:[.42,.6], grit:[.12,.26]},   // dry + compressed (NOT ambient): 1/8 echo (announcements ring) + digital grit + light pump = mechanical motorik
      found:{role:"bed", vol:[.13,.22], pitch:[.78,.92], stretch:[.45,.6], cutoff:[2200,3400], sources:["tw_intrain","tw_trains","tw_stationhall","tw_platform"]},   // 4 train/station field recordings rotate — the clatter, as texture under the groove
      vox:{sources:["sp_tw_next","sp_tw_arriving","sp_tw_standclear","sp_tw_express","sp_tw_delay","sp_tw_gap","sp_tw_aboard","sp_tw_local","sp_tw_terminus","sp_tw_tickets"], vol:0.54, pitch:1, cutoff:3800, clean:false},   // station-PA announcements, glitched + echoed
      voxPoem:"sp_tw_schedule",   // the departures litany, chopped into the interchange
      hits:{sources:["pool:vb_transit*1","tw_pass"], pattern:"sparse", prob:1, wet:true, vol:0.055, cut:1100},   // a train passing — quiet + heavily low-passed so it sits UNDER the mix
      snarePP:0.6,   // feed random snare hits to the long rhythmic ping-pong delay
      vocal:true, vocalVol:0.55,   // the 8-bar sung chorus (WORLD-vocoder vocal, generated to match bpm+key at render time)
      // a (feminine) world-metro station name under every measure — present, not
      // buried. KERNEL-V4 buried sample-event (was the bespoke `stations`/stationVol
      // path): square-LFO gated at stationVol 0.28, downward stutter tail ~70%.
      sampleEvents:[{ pool:["sp_st_admiralty","sp_st_akiba","sp_st_alex","sp_st_arbat","sp_st_astoria","sp_st_atlantic","sp_st_atocha","sp_st_baker","sp_st_bank","sp_st_bastille","sp_st_bedford","sp_st_belleville","sp_st_belmont","sp_st_bloor","sp_st_brixton","sp_st_bugis","sp_st_camden","sp_st_catalunya","sp_st_causeway","sp_st_centraal","sp_st_central","sp_st_chandni","sp_st_chatelet","sp_st_circular","sp_st_colosseo","sp_st_coney","sp_st_dam","sp_st_dupont","sp_st_embarcadero","sp_st_fulton","sp_st_gangnam","sp_st_ginza","sp_st_grand","sp_st_granvia","sp_st_harvard","sp_st_hbf","sp_st_hongdae","sp_st_ikebukuro","sp_st_itaewon","sp_st_jamsil","sp_st_kadikoy","sp_st_kiev","sp_st_kings","sp_st_komso","sp_st_kotti","sp_st_lazare","sp_st_liverpool","sp_st_marien","sp_st_metrocenter","sp_st_mongkok","sp_st_montpar","sp_st_mustek","sp_st_nakano","sp_st_nation","sp_st_nord","sp_st_opera","sp_st_orchard","sp_st_oxford","sp_st_paddington","sp_st_parkst","sp_st_paulista","sp_st_penn","sp_st_pigalle","sp_st_pino","sp_st_potsdamer","sp_st_powell","sp_st_raffles","sp_st_rajiv","sp_st_retiro","sp_st_roppongi","sp_st_rossio","sp_st_sadat","sp_st_sagrada","sp_st_se","sp_st_shibuya","sp_st_shinagawa","sp_st_shinjuku","sp_st_slussen","sp_st_sol","sp_st_spadina","sp_st_stephans","sp_st_taksim","sp_st_tcentralen","sp_st_termini","sp_st_times","sp_st_townhall","sp_st_ueno","sp_st_union","sp_st_victoria","sp_st_warschauer","sp_st_waterloo","sp_st_wynyard","sp_st_zocalo","sp_st_zoo"],
        placement:"buried", sections:"all", treatment:{cutoff:5200, vol:0.28, glitch:true} },
        // the train pulling IN — the opener, filtered way down (was hornSource/hornVol/hornCut):
        // KERNEL-V4 opener sample-event on the first section (platform) downbeat.
        { pool:["tw_arrival"], placement:"opener", gain:1.8, treatment:{cutoff:850, vol:0.13, rsend:0.6, dsend:0.45} },
        // the door "ding ding" (was dingSource/dingVol): low-passed to 2.4k, fed HARD
        // to the ping-pong (ppsend .7) so it echoes ~2 measures. Two per station stop —
        // doors CLOSING on the downbeat (oneShot) and OPENING near the end (cadence).
        { pool:["tw_ding"], placement:"oneShot", sections:"platform|board|interchange|terminus", treatment:{maxDur:2.2, cutoff:2400, vol:0.28, rsend:0.26, dsend:0.04, ppsend:0.7} },
        { pool:["tw_ding"], placement:"cadence", sections:"platform|board|interchange|terminus", treatment:{maxDur:2.2, cutoff:2400, vol:0.28, rsend:0.26, dsend:0.04, ppsend:0.7} }],
      stab:["off"],
      form:"transit" },   // a commuter journey: platform -> board -> transit -> interchange -> SOLO -> express -> terminus (see buildSections)
    neoclassical: { label:"Requiem Appendix", info:"Beatless at 58-82. A felt piano under strings, with a felt piano. A canon, a light shuffle, loose timing, rubato.",
      // deep pass: the genre's VOICE is now a real sampled felt piano
      // (FluidR3 Yamaha Grand, lowpassed at extraction — SAMPLERS.felt_piano):
      // lead AND bass 2/3+ sampled piano, soft velocity, slightly slow attack,
      // close/dry-ish. Pads = sampled string ensemble DOMINANT with per-phrase
      // SWELL envelopes (attack .8-2.5s shaped x², long release); the organ is
      // PURGED from the pad pool (it read as church, not chamber). Plus:
      // rubato (always — the time dimension, see toState/state.rubato),
      // a quiet second piano voice in counterpoint on ~2/3 of draws
      // (counterpoint spec -> wave form's drift/swell sections), and
      // whisper-level key/pedal thunks on a fraction of lead notes (thunk).
      bpm:[58,82], swing:[0,.1], humanize:[.3,.55],
      progressions:["canon","neosoul","dream","ii_v_i"], kits:["off"], fills:["off"],
      bass:{patterns:["root","off","simple"], samplerPool:["felt_piano"], recipe:{model:["sampler","sampler","piano"],cutoff:[800,1600],res:[.05,.1],level:[.55,.75],send:[.25,.45],dsend:[0,.1],attack:[.01,.02],release:[.25,.45]}},   // the left hand: the same felt piano, 2/3 of seeds
      lead:{patterns:["canon","wander","arpup","sparse"], samplerPool:["felt_piano"], recipe:{model:["sampler","sampler","piano"],wave:"sine",voices:[1,2],spread:[.001,.003],cutoff:[2400,3600],level:[.4,.54],send:[.3,.5],dsend:[.05,.2],attack:[.015,.04],release:[.3,.6]}},   // FELT: low gain into the mix + slow-ish attack (the lowpass is baked into the zones)
      pads:{prob:.7, samplerPool:["strings"], recipe:{model:["sampler","sampler","sampler","piano"],wave:"sine",cutoff:[1000,1800],detune:[.002,.005],attack:[.8,2.5],release:[1.5,3],swell:1,mellotron:true,level:[.38,.55],send:[.4,.6],dsend:[0,.1]}},   // sampled strings DOMINANT (3/4), SWELLING per phrase, through the MELLOTRON tape head (subtle wow/flutter + 8s strip cap; modest defaults so buildEvents stays byte-stable); organ purged
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.5,.8],snare:[.4,.6],hat:[.3,.5],tune:[.9,1],send:[.2,.4],dsend:[0,0],kit:"acoustic"},   // SAMPLED acoustic kit (real FluidR3 Standard) — soft/dry, matches the felt piano
      fx:{reverb:[.5,.7], delayBeats:[.75,1.5], delayFb:[.15,.3], delayCut:[2000,3000], pump:[0,0], crackle:[0,.35], lowcut:[0,0], highcut:[0,0], comp:[0,.15]},   // reverb DOWN a notch (was .6-.8): felt piano is a close mic, not a cathedral
      found:{role:"bed", vol:[.06,.14], pitch:[.7,.9], stretch:[.45,.6], cutoff:[1800,2800], sources:["pool:city*2"]},
      rubato:{depth:[.02,.04], periodBars:[2,4], prob:1},   // ALWAYS breathes (state.rubato — the beat-warp in csd-engine buildEvents)
      counterpoint:{prob:.66},   // second quiet piano voice, octave below, contrary/oblique (resolveMulti -> wave form)
      thunk:{prob:[.2,.35], amp:[.026,.038]},   // soft key/pedal noise on that fraction of lead notes, ~-30dB
      stab:["off"], hits:{sources:["pool:vb_classical_chamber*1","sp_herenow"], pattern:"sparse", prob:.1},
      form:"wave" },
    dancepop: { label:"Confetti Escape Velocity", info:"A four-on-the-floor at 116-128. Saw synth bass under strings, with brass. Four-chord changes, a light shuffle.",   // SYNTH-FORWARD
      bpm:[116,128], swing:[0,.1], humanize:[.05,.2],
      progressions:["four_chords","sad_pop","doo_wop"], kits:["four","pulse","open"], fills:["drum fill","tom fill","riser","snare roll"],
      bass:{patterns:["octaves","melodic","drive","syncopated"], patchPool:["SYN-BASS 2","BASS    2"], recipe:{model:["saw","saw","dx7"],cutoff:[900,1500],res:[.1,.25],level:[1.05,1.25],send:[.05,.15],dsend:[0,.1]}},   // ~1/3 the DX7 synth-bass pair (alg 17 both -> morphable) — the New Order hook machine
      lead:{patterns:["hero","updown","pentaup","double"], recipe:{model:["brass","stack"],wave:"saw",voices:[3,5],spread:[.006,.012],cutoff:[2800,3800],level:[.45,.6],send:[.3,.5],dsend:[.2,.35],octave:.05,attack:.006,release:[.16,.24],sustain:[.72,.82],fenv:[.25,.45]},
        inserts:{prob:.5, max:1, pool:[["chorus",{rate:[.6,1.2],depth:[.4,.65],mix:[.4,.6]}]]}},   // envelope identity (ex-ARTIC): punchy bright. the New Order gloss — big bright chorus on the hook
      pads:{prob:.85, recipe:{model:["strings","saw"],wave:"saw",cutoff:[1200,2000],detune:[.006,.012],attack:[.8,1.8],level:[.5,.7],send:[.35,.55],dsend:[.1,.25]}},
      drums:{kickModel:["909","boom"],snareModel:["noise","clap"],hatModel:["noise"],kick:[1.1,1.35],snare:[.8,1.05],hat:[.6,.9],tune:[.9,1.05],send:[.25,.45],dsend:[.05,.15]},
      fx:{reverb:[.5,.7], delayBeats:[.5,.75], delayFb:[.2,.35], delayCut:[2400,3600], pump:[.05,.25], crackle:[0,.1], lowcut:[30,45], highcut:[0,0], comp:[.3,.5]},
      found:{role:"bed", vol:[.06,.12], pitch:[.8,1], stretch:[.45,.6], cutoff:[1500,2500], sources:["pool:city*1","pool:road*1"]},
      stab:["off","sparse"], hits:{sources:["pool:rave_stab*1","pool:vocal_stab*1"], pattern:"sparse", prob:.3},
      form:"pop" },
    edm: { label:"Fireworks Budget", info:"A four-on-the-floor at 124-132. Saw synth bass under a saw synth pad, with a hard-sync lead. Epic minor changes, a light shuffle, quantized tight.",   // SYNTH-FORWARD
      bpm:[124,132], swing:[0,.05], humanize:[0,.1],
      progressions:["epic_min","minor_run","sad_pop","drone_min"], kits:["four","pulse"], fills:["riser","riser","impact","cut","dropout"],
      bass:{patterns:["rolling","drive","stab"], recipe:{model:["saw","reese","modeld"],cutoff:[500,900],res:[.2,.35],level:[1.15,1.35],send:[0,.08],dsend:[0,0],
        glide:[20,40],envAmount:[1.5,2.8],envDecay:[.1,.2],oscMix:[.3,.7],drive:[.25,.5]},
        inserts:{prob:.35, max:1, pool:[["filtersweep",{rateBars:[1,2],lo:[-1,-.4],hi:[.8,1.4],res:[.3,.5]}]]}},   // fast festival sweeps under the drop; 1/3 of seeds: a Model-D drop bass, filter env punching every note
      lead:{patterns:["hero","updown","arpup","double"], recipe:{model:["synclead","synclead","synclead","stack","brass","vocoder"],wave:"saw",voices:[6,8],spread:[.012,.02],cutoff:[3000,4200],level:[.5,.65],send:[.35,.55],dsend:[.2,.35],octave:.04,attack:.005,release:[.2,.3],sustain:[.78,.88],fenv:[.3,.5]}},   // envelope identity (ex-ARTIC): huge supersaw w/ filter pluck. ~1/2 the hard-sync tear lead (state-engine defaults keep the festival scream); stack/brass/vocoder the rest. NB: synclead params left to defaults so edm's rng draws stay identical (extra recipe keys shifted a seed into trance on the 2-seed dominance gate)
      vocSource:"sp_energy",
      pads:{prob:.9, recipe:{model:["saw"],wave:"saw",cutoff:[1400,2600],detune:[.012,.02],attack:[.6,1.6],level:[.6,.8],send:[.4,.6],dsend:[.1,.25]}},
      drums:{kickModel:["909"],snareModel:["clap","noise"],hatModel:["noise","metal"],kick:[1.35,1.6],snare:[.8,1.05],hat:[.5,.8],tune:[.95,1.1],send:[.2,.4],dsend:[.05,.2]},
      fx:{reverb:[.45,.65], delayBeats:[.375,.5], delayFb:[.25,.4], delayCut:[2500,4000], pump:[.55,.8], crackle:[0,0], lowcut:[30,45], highcut:[0,0], comp:[.6,.8], grit:[.2,.4], jux:[.2,.45]},
      found:{role:"chops", vol:[.08,.15], pitch:[.95,1.1], stretch:[.4,.6], cutoff:[2500,4000], sources:["shibuya","factory","vx_xminusone"]},
      stab:["rave","offbeat"], hits:{sources:["pool:rave_stab*2","sp_energy"], pattern:"offbeat", prob:.6},
      form:"drop" },
    dubstep: { label:"Seismic Ultimatum", info:"A half-time kit at 136-146. Wobble bass under a saw synth pad, with a pluck lead. A two-chord minor drone, a light shuffle, euclidean hats.",
      bpm:[136,146], swing:[0,.08], humanize:[.05,.2],
      progressions:["drone_min","deep_two","minor_run"], kits:["halftime","breaks"], fills:["break fill","riser","impact","off","dropout"],
      euclid:{hat:[5,16]},   // E(5,16) sparse uneven hats rotating over the halftime frame
      reverbColor:"greyhole",   // GRIT PASS: the cavernous halftime space made a real diffuse hall
      bass:{patterns:["sub","dub","stab"], recipe:{model:["wobble","reese","sub"],wobbleBars:0.125,cutoff:[300,650],res:[.2,.4],level:[1.2,1.45],send:[0,.08],dsend:[0,.1]},   // BALANCE LOOP 3: the wobble TEMPO-SYNCED at an 1/8 (wobbleBars .125 -> 4.67 Hz at 140) — THE genre feature, was a free-running 1.5-4.5 Hz that never locked to the halftime grid
        inserts:{prob:.7, max:1, pool:[["distort",{drive:[.45,.8],mix:[.7,1]}],["filtersweep",{rateBars:[1,2],lo:[-.8,-.3],hi:[.6,1.2],res:[.3,.5]}]]}},   // grit on the reese, HEAVIER; slow sweeps where the wobble isn't already doing it (constrain guards wobble)
      snarePP:0.5,   // effects audit B4: the big snare on beat 3 thrown/ping-ponged in the cavern. Below the .65 liberal threshold => legacy >=4-beat/.6 spacing (a THROW, not a smear); matrix-safe (softTop stays 0)
      lead:{patterns:["off","sparse","pentaup"], recipe:{model:["pluck","fm","vocoder"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1800,3000],level:[.3,.45],send:[.35,.55],dsend:[.3,.5],octave:0,attack:.004,release:[.1,.16],sustain:[.55,.68],fenv:[.35,.6]},
        inserts:{prob:.5, max:1, pool:[["granular",{pitch:[-12,0],density:[.4,.7],rate:[8,16],mix:[.3,.55]}],["distort",{drive:[.3,.55],mix:[.5,.8]}]]}},   // granular stutter clouds — the dubstep chop; grit on the pluck stab
      vocSource:"sp_pressure",
      pads:{prob:.35, recipe:{model:["saw","organ"],wave:"saw",cutoff:[550,950],detune:[.006,.014],attack:[1.5,3],level:[.32,.45],send:[.5,.7],dsend:[.15,.3]}},   // dark, mostly ABSENT — cavern not wash
      drums:{kickModel:["808","909"],snareModel:["crack","clap"],hatModel:["noise","metal"],kick:[1.2,1.45],snare:[.85,1.1],hat:[.4,.7],tune:[.9,1.05],send:[.15,.35],dsend:[.25,.5]},
      fx:{reverb:[.5,.7], delayBeats:[.75,1.5], delayFb:[.35,.55], delayCut:[1800,3000], pump:[.1,.3], crackle:[0,.15], lowcut:[25,40], highcut:[0,0], comp:[.4,.6], grit:[.3,.55]},
      found:{role:"chops", vol:[.1,.18], pitch:[.85,1.1], stretch:[.4,.6], cutoff:[2000,3500], sources:["factory","highway_night"]},
      stab:["off","sparse"], hits:{sources:["pool:vocal_stab*1","sp_pressure","pool:rave_stab*1"], pattern:"dub", prob:.55},
      form:"drop" },
    blues: { label:"Crossroads Paperwork", info:"A shuffle at 78-100. Acoustic bass under a percussive organ, with a steel string guitar. A twelve-bar blues, hard swing, loose timing.",   // ACOUSTIC-forward (deep pass: "the whole thing is acoustic")
      reverbColor:"fdn",   // fx wings: a dry juke-joint room, not a wash
      timeFeel:{ pushPull:{ bass:.015, snare:.01 } },   // effects audit B7: behind-the-beat by definition — the lazy shuffle. jazz got the walking-upright bass push; blues wants the lazier version, the snare offset kept tiny so offgrid doesn't move. Zero-rng dominant-parent. Deliberately half-strength: at double these offsets the timing feel overshoots.
      bpm:[78,100], swing:[.24,.42], humanize:[.3,.55],
      progressions:["blues_12"], kits:["shuffle","boombap","shuffle"], fills:["off","drum fill"],   // 2/3 the swung-triplet ride kit; boombap keeps a dusty chair
      bass:{patterns:["walking","walking","melodic"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sampler","piano"],cutoff:[500,1000],res:[.05,.15],level:[.9,1.1],send:[.1,.2],dsend:[0,.05],attack:.005,release:[.08,.14]}},   // the UPRIGHT (real, FluidR3) walks 2/3 of seeds; piano the rest — the DX7/sub bass is gone
      lead:{patterns:["blues","blues","wander"], patchPool:["HARMONICA1"], samplerPool:["steel_string_guitar","harmonica"], recipe:{model:["sampler","sampler","sampler","sampler","hammond","piano"],wave:"sine",voices:[1,2],spread:[.001,.004],cutoff:[2200,3400],leslie:[.85,.95],drive:[.3,.4],percHarm:1,level:[.5,.65],send:[.3,.5],dsend:[.1,.25]}},   // STRONG-SAMPLE: the DX7 harmonica fake dropped for the REAL harmonica sampler — 4/6 real steel-string/harmonica leads (blue-note bends), ~1/6 Hammond B-3, piano the rest
      pads:{prob:.55, samplerPool:["percussive_organ","rock_organ","honky_tonk"], recipe:{model:["hammond","hammond","sampler","sampler","piano"],wave:"saw",cutoff:[900,1500],detune:[.003,.007],attack:[.02,.08],bar513:8,bar4:8,bar223:6,bar2:8,bar135:4,bar113:6,bar1:8,leslie:[.85,.95],percHarm:1,drive:[.3,.4],perc:[.4,.6],level:[.3,.42],send:[.2,.35],dsend:[.05,.15]}},   // COMPING, not pads: the real Hammond B-3 (888868468 full drawbars, spinning Leslie, 3rd-harm perc) or sampled organ / honky-tonk piano stabs on the changes — fast attack, modest level, never a wash
      drums:{kickModel:["boom","808"],snareModel:["noise"],hatModel:["noise"],kick:[.9,1.15],snare:[.5,.7],hat:[.5,.8],tune:[.85,1],send:[.15,.3],dsend:[0,.1],kit:"acoustic"},   // snare tuned brushes-soft under the shuffle ride; SAMPLED acoustic kit
      fx:{reverb:[.45,.65], delayBeats:[.5,.75], delayFb:[.1,.25], delayCut:[2000,3000], pump:[0,0], crackle:[.25,.55], lowcut:[0,30], highcut:[8000,12000], comp:[.15,.3]},
      found:{role:"bed", vol:[.05,.12], pitch:[.8,1], stretch:[.45,.6], cutoff:[1500,2500], sources:["pool:city*2","vx_whitman"]},
      stab:["off"], hits:{sources:["pool:vb_jazz_blues*1","blues_vox_78","blues_vox_78","pool:horn_stab*1"], pattern:"response", prob:.75},   // the 78rpm singer takes the response bars the guitar rests — and gets answered
      form:"pop" },
    jazz: { label:"Smoke Arithmetic", info:"A breaks kit at 96-144. Acoustic bass under a bright yamaha grand, with an alto sax. ii-V-I, hard swing, loose timing, rubato.",
      reverbColor:"dattorro",   // effects audit C: the Rudy Van Gelder / Blue Note plate (EMT-140) — the sound of the sessions; zero rng, dominant-parent
      bpm:[96,144], swing:[.28,.48], humanize:[.35,.6],
      progressions:["ii_v_i","neosoul","lofi","mode_dorian"], kits:["breaks","boombap"], fills:["off","drum fill"],
      bass:{patterns:["walking","melodic","dub"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sampler","piano"],cutoff:[400,800],res:[.05,.12],level:[.95,1.15],send:[.1,.2],dsend:[0,.05],attack:.005,release:[.08,.14]}},   // the UPRIGHT walks 2/3 of seeds (real, FluidR3); piano the rest
      lead:{patterns:["jazzline","jazzweave","wander","sparse"], samplerPool:["alto_sax","tenor_sax","bright_yamaha_grand","jazz_guitar"], recipe:{model:["sampler","sampler","sampler","piano"],wave:"sine",voices:[1,2],spread:[.001,.004],cutoff:[2400,3600],level:[.45,.6],send:[.35,.55],dsend:[.1,.3]}},   // THE SAX (real, sampled): 2/3 of seeds the horn leads, else comping piano
      pads:{prob:.8, samplerPool:["bright_yamaha_grand","percussive_organ","rock_organ"], recipe:{model:["piano","fm","sampler"],wave:"sine",cutoff:[1000,1700],detune:[.002,.006],attack:[.2,.8],level:[.4,.6],send:[.35,.55],dsend:[.05,.2]}},   // the organ-trio option (Jimmy Smith / Larry Young B-3) beside the comping grand — a real second home for the near-dead rock/percussive organs; jazz's melody is always acoustic so the pad never drives acoustic (matrix-invisible)
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.6,.9],snare:[.45,.7],hat:[.8,1.15],tune:[.9,1.05],send:[.2,.4],dsend:[0,.1],kit:"brush"},   // SAMPLED brush kit — the real jazz brushes on the ride
      fx:{reverb:[.5,.7], delayBeats:[.5,.75], delayFb:[.1,.25], delayCut:[2200,3400], pump:[0,0], crackle:[.15,.4], lowcut:[0,25], highcut:[9000,14000], comp:[.1,.25]},
      found:{role:"bed", vol:[.05,.12], pitch:[.8,1], stretch:[.45,.6], cutoff:[1500,2600], sources:["vx_ginsberg_mexcityblues","vx_kupferberg_fugs87","pool:city*2","vx_ginsberg","vx_ginsberg_class"]},
      rubato:{depth:[.008,.018], periodBars:[2,3], prob:.35},   // the light option: a third of seeds get a subtle combo-breathing (never as deep as neoclassical)
      blueNote:0.32,   // the SAX SCOOP: when the lead resolves to a sampled sax/guitar, ~32% of held notes gain a blue-note bend (slide up into the b3/b7), mirroring csd-engine's blues pattern. A separate seeded stream => other events byte-identical; only SAMPLER voices render the slide (VOICES.md), and `bend` is not a verifier feature (matrix-invisible)
      timeFeel:{ pushPull:{ bass:0.015 }, pushPullMs:{ ride:-5, snare:4 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — SWING: the ride rides ON TOP of a backbeat that leans back; the two maps SUM per lane, so the walking upright keeps its original tempo-RELATIVE drag while the new lanes are tempo-honest. Phase 3: the upright WALKS behind the beat — bass onsets pushed ~7ms late (a per-voice offset, no verifier feature reads bass timing, so pure feel). Deliberately half-strength: at double these offsets the timing feel overshoots.
      stab:["off"], hits:{sources:["pool:vb_jazz_blues*1","pool:horn_stab*1","pool:vocal_stab*1"], pattern:"sparse", prob:.35},
      form:"aaba" },
    dub: { label:"Echo Ministry", info:"A half-time kit at 68-82. Sub bass under an organ, with a harmonica. A dub vamp, a light shuffle.",   // SAMPLE-FORWARD: wet vox hits + Burroughs in the smoke
      timeFeel:{ pushPullMs:{ bass:13, snare:8, rim:8 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — ONE-DROP: reggae's pocket with the delay promoted to lead. No pad lane — dub's pad is a sustained 8-beat block, not a chop, so moving it would drag the drone, not the skank
      reverbColor:"spring",   // effects audit A2: the spring tank (King Tubby's AKG BX20 "splash") IS dub's ROOM — additive to and distinct from the runaway echo (delayFb .5-.7); surfrock already proves the module. Zero rng, dominant-parent
      bpm:[68,82], swing:[.02,.1], humanize:[.1,.3],
      progressions:["dub_vamp","dub_vamp","deep_two","drone_min"], kits:["halftime","boombap"], fills:["off","downlift","reverse"],   // MIDI-trove calibration: real dub is triadic i-iv on the tonic-subdominant axis (corpus seventh .08 median vs renders 1.0 — mine-midi.js, 108 files) — dub_vamp is the mined progression, weighted to half the pool; deep_two (i-VI) + drone_min keep the old colors
      bass:{patterns:["dub","sub"], recipe:{model:["sub"],cutoff:[260,460],res:[.05,.15],level:[1.2,1.4],send:[0,.06],dsend:[0,.05]}},
      lead:{patterns:["dubline","sparse","off","pentaup"], samplerPool:["harmonica","trombone","clarinet"], recipe:{model:["pluck","sampler","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1600,2600],level:[.32,.44],send:[.4,.6],dsend:[.5,.7],attack:.004,release:[.06,.1],sustain:[.5,.62]}},   // STRONG-SAMPLE: no fm synth — 3/4 real melodica-flavor reeds (harmonica/trombone/clarinet) thrown to the echo; pluck the dry fallback
      pads:{prob:.35, recipe:{model:["organ","saw"],wave:"saw",cutoff:[550,900],detune:[.004,.01],attack:[.15,.5],level:[.32,.44],send:[.3,.5],dsend:[.3,.5]},
        inserts:{prob:.4, max:1, pool:[["phaser",{rate:[.08,.2],depth:[.5,.7],mix:[.35,.55]}]]}},   // effects audit A3: the swept phaser/flanger over the off-beat skank — a core dub-mix signature (Lee Perry, Scientist, "Phase 90 on everything"). Dark organ skank thrown to the echo — NOT a wash
      drums:{kickModel:["808","boom"],snareModel:["crack","noise"],hatModel:["noise"],kick:[1.1,1.35],snare:[.9,1.15],hat:[.45,.75],tune:[.9,1.05],send:[.15,.3],dsend:[.5,.7]},   // the snare rides the delay — dsend IS the one-drop
      fx:{reverb:[.55,.7], delayBeats:[.75,1.5], delayFb:[.5,.7], delayCut:[1600,2600], pump:[0,.1], crackle:[0,.08], lowcut:[25,40], highcut:[0,0], comp:[.3,.5], grit:[.1,.25], jux:[.15,.3]},   // effects audit C: a touch of mixing-desk hard-pan width (small — the echo owns most of the stereo). jux is matrix-safe
      found:{role:"bed", vol:[.18,.3], pitch:[.7,.85], stretch:[.45,.6], cutoff:[1800,3000], sources:["pool:city*1","pool:road*1","vx_burroughs"]},
      stab:["off","sparse"], hits:{sources:["pool:vocal_stab*2","sp_rewind","sp_pressure"], pattern:"dub", prob:.75, wet:true},
      form:"dj" },
    trance: { label:"Sunrise Protocol", info:"A four-on-the-floor at 132-142. Saw synth bass under a saw synth pad, with a stacked saws lead. An uplifting cadence, straight time, quantized tight.",   // SYNTH-FORWARD: beds distant
      bpm:[132,142], swing:[0,.04], humanize:[0,.1],
      progressions:["uplift","epic_min","sad_pop","synthwave"], kits:["four","pulse"], fills:["riser","riser","impact","cut","dropout"],
      bass:{patterns:["rolling","sixteenths","drive","pedal"], recipe:{model:["saw"],cutoff:[520,850],res:[.15,.3],level:[1.1,1.3],send:[0,.08],dsend:[0,.05]},
        inserts:{prob:.7, max:1, pool:[["filtersweep",{rateBars:[4,8],lo:[-1,-.5],hi:[1,1.6],res:[.3,.5]}]]}},   // THE trance move: the rolling 16th line sweeps open over 4-8 bars
      lead:{patterns:["hero","arpup","anthem"], patchPool:["SYNBRASS 1","SYN-LEAD 2"], recipe:{model:["stack","stack","dx7"],wave:"saw",voices:[6,7],spread:[.012,.02],cutoff:[3000,4200],level:[.5,.62],send:[.4,.6],dsend:[.3,.45],vibrato:[0,.004],attack:.01,release:[.2,.3],sustain:[.8,.9],fenv:[.25,.45]},
        inserts:{prob:.5, max:1, pool:[["chorus",{rate:[.5,1],depth:[.4,.6],mix:[.35,.5]}]]}},   // effects audit B12: the uplifting supersaw hero rides chorus/ensemble width beyond the reverb+delay it already has — ~1/3: DX7 brass stabs (alg-22 pair -> morphable), the hands-up hook
      pads:{prob:1, recipe:{model:["saw"],wave:"saw",cutoff:[1300,2400],detune:[.01,.018],attack:[1,2],level:[.55,.75],send:[.5,.7],dsend:[.15,.3]},
        inserts:{prob:.7, max:1, pool:[["tremolo",{rateBars:0.0625,depth:[.75,.9],shape:[.7,1],mix:[.8,.95]}]]}},   // BALANCE LOOP 3: THE TRANCE GATE — the huge wash chopped by a hard-shaped tremolo tempo-synced at a 1/16 (rateBars .0625 -> ~9.2 Hz at 138), the hands-up sidechain illusion
      drums:{kickModel:["909"],snareModel:["clap","noise"],hatModel:["noise"],kick:[1.3,1.55],snare:[.7,.95],hat:[.7,1],tune:[.95,1.1],send:[.15,.3],dsend:[.1,.25]},
      fx:{reverb:[.6,.75], delayBeats:[.75,.75], delayFb:[.4,.55], delayCut:[2400,3600], pump:[.4,.6], crackle:[0,0], lowcut:[30,45], highcut:[0,0], comp:[.5,.7], grit:[0,.15]},
      found:{role:"bed", vol:[.06,.12], pitch:[.7,.9], stretch:[.45,.6], cutoff:[1500,2500], sources:["pool:road*1","pool:city*1","pool:voices*1"]},
      stab:["off","sparse"], hits:{sources:["pool:rave_stab*1","sp_energy","pool:vocal_stab*1"], pattern:"offbeat", prob:.4},
      form:"drop" },
    disco: { label:"Mirrorball Panopticon", info:"A four-on-the-floor at 110-122. Saw synth bass under strings, with an FM lead. A funk vamp, swung.",   // sample-mid: the horns are dressing
      timeFeel:{ pushPullMs:{ hat:-3 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — DISCO: a live drummer riding hats slightly on top of a four-on-the-floor. Small — disco's identity is the metronomic kick
      reverbColor:"dattorro",   // effects audit A1: the EMT-140 PLATE (Sigma Sound) IS the Salsoul/Philly-International disco-string room — the lush strings/horns rode a bright plate, not the generic hall (citypop/house/mallsoft already share it; zero rng, dominant-parent)
      bpm:[110,122], swing:[.05,.12], humanize:[.1,.25],
      progressions:["funk_vamp","house_min7","pop_1625"], kits:["four","open"], fills:["hat rush","drum fill","riser"],
      bass:{patterns:["octaves","rolling","walking","syncopated"], recipe:{model:["saw","modeld"],cutoff:[650,1050],res:[.1,.2],level:[1,1.2],send:[.03,.08],dsend:[0,.05],
        glide:[20,35],envAmount:[1,1.8],envDecay:[.07,.14],oscMix:[.2,.5],drift:[3,7]},   // half the seeds: the funk-vamp Model-D — short punchy filter env on the octave line (Bernard Edwards' synth stand-in)
        inserts:{prob:.45, max:1, pool:[["wah",{sens:[.5,.72],base:[280,420],range:[1.8,2.5],q:[3.5,6],mix:[.6,.7]}]]}},   // fx wings stage 3: the Mutron auto-wah quack on the octave/syncopated bass — the disco-funk envelope filter. BALANCE LOOP 3 wah trim: mix capped at .6-.7 — full-wet wah trims the bass ~3.9 dB
      lead:{patterns:["pentaup","double","updown","arpup"], recipe:{model:["fm","pluck"],wave:"pulse",voices:[1,2],spread:[.002,.005],cutoff:[2600,3600],level:[.42,.54],send:[.3,.45],dsend:[.15,.3],attack:.005,release:[.08,.14],sustain:[.6,.72],fenv:[.3,.5]}},
      pads:{prob:1, patchPool:["E.ORGAN 2","E.ORGAN 3"], samplerPool:["strings","harp"], recipe:{model:["hammond","hammond","organ","dx7","sampler"],wave:"saw",cutoff:[1100,1700],detune:[.004,.009],attack:[.2,.6],bar513:8,bar4:0,bar1:4,leslie:[.8,.9],perc:[.5,.7],level:[.45,.6],send:[.3,.45],dsend:[.05,.15]},
        inserts:{prob:.5, max:1, pool:[["phaser",{rate:[.2,.5],depth:[.5,.7],mix:[.4,.6]}]]}},   // organ stabs = the glitter, 1977-style: the Hammond B-3 chord-stab (888000004 registration = bar16/8 8, bar5⅓ 8, bar1 4, rest 0; spinning Leslie ~.85, 3rd-harm perc) alongside the E.ORGAN dx7 + sampled strings — through the string-machine phaser. Part B re-opened this: genre-verifier now counts hammond as acoustic (tonewheel organ), so a dominant B-3 pad holds disco's acoustic diagonal instead of dropping to acidhouse. SOLINA was NOT wired in: it stays a synth in the verifier (counting it drew italo to a tie), so a dominant Solina disco pad measured OUT (seed 6 → transitwave 100, disco 87); per the brief that margin wouldn't hold, so the string-machine stab is left to italo/newage where solina already lives
      drums:{kickModel:["909","boom"],snareModel:["clap","noise"],hatModel:["noise"],kick:[.82,.98],snare:[.56,.75],hat:[.82,1.05],tune:[.95,1.1],send:[.15,.3],dsend:[.05,.15],kit:"power"},   // DRUMS -25%: the mirrorball kit sat too hot over the octave bass/organ — kick/snare/hat all ×0.75. OPEN HATS still the offbeat sizzle; SAMPLED power kit (real 4-on-the-floor)
      fx:{reverb:[.4,.55], delayBeats:[.375,.5], delayFb:[.15,.3], delayCut:[2600,3800], pump:[0,.15], crackle:[.05,.2], lowcut:[30,45], highcut:[0,0], comp:[.3,.5], grit:[0,0]},
      found:{role:"bed", vol:[.06,.12], pitch:[.85,1], stretch:[.45,.6], cutoff:[1800,2800], sources:["pool:city*2","pool:voices*1"]},
      stab:["off","sparse","charleston"], hits:{sources:["pool:horn_stab*1","sp_rhythm","pool:vocal_stab*1","stml_hit_b3"], pattern:"offbeat", prob:.5},   // VARIETY: + charleston (the syncopated disco/funk chord-stab rhythm — the mirrorball glitter punch)
      masterComp:0.35,   // fx wings stage 4: gentle 3-band glue on the four-on-floor — the disco mix cohered (zero rng, dominant-parent inherited)
      form:"vamp" },
    italo: { label:"Espresso Laser", info:"A pulse kit at 108-120. Saw synth bass under a Juno pad, with a hard-sync lead. A minor pop cycle, a light shuffle.",   // SYNTH-FORWARD
      bpm:[108,120], swing:[0,.08], humanize:[.02,.12],
      progressions:["sad_pop","synthwave","doo_wop"], kits:["pulse","four"], fills:["tom fill","riser","drum fill"],
      bass:{patterns:["octaves","sixteenths","pedal"], recipe:{model:["saw","modeld"],cutoff:[750,1150],res:[.12,.22],level:[1.05,1.25],send:[.03,.08],dsend:[0,.05],
        glide:[15,30],envAmount:[1.2,2.2],envDecay:[.06,.12],oscMix:[.2,.5],drift:[2,5]}},   // half the seeds: the Italo octave bass on a real Model-D — tight glide, plucky filter env
      lead:{patterns:["arpup","arpdown","hero","pentaup"], patchPool:["SYN-PIANO","E.PIANO 4"], recipe:{model:["synclead","synclead","pluck","stack","dx7"],wave:"square",voices:[1,2],spread:[.002,.006],cutoff:[3200,4200],syncRatio:[1.3,1.8],syncSweep:[1,2],syncDecay:[.12,.25],envDecay:[.1,.2],syncDetune:[6,12],level:[.5,.6],send:[.3,.45],dsend:[.3,.45],vibrato:[0,.003],attack:.004,release:[.07,.12],sustain:[.6,.7],fenv:[.3,.5]},
        inserts:{prob:.4, max:1, pool:[["chorus",{rate:[.6,1.2],depth:[.4,.6],mix:[.4,.55]}]]}},   // ~2/5 the gentle sync-tear lead (low ratio, sweeping); sparkle plucks + DX7 the rest
      pads:{prob:.9, recipe:{model:["juno60","juno60","solina","solina","saw","strings"],wave:"saw",cutoff:[1400,2200],detune:[.006,.012],attack:[.6,1.4],chorus:[1.3,1.7],chorusSpread:[.8,1],ensemble:[.75,.9],octave:[.5,.6],pwmBase:[.28,.38],pwmLfo:[.25,.4],level:[.45,.6],send:[.3,.45],dsend:[.1,.2]},   // BALANCE LOOP 3: the Juno-60 PWM claimed — pulse width parked off-square and the pwm LFO swirling it (the Italo shimmer under the BBD chorus); solina/saw/strings ignore the keys
        inserts:{prob:.6, max:1, pool:[["phaser",{rate:[.1,.3],depth:[.5,.75],mix:[.4,.6]}]]}},   // the Italo pad: Juno-60 (stereo BBD chorus) or Solina string cloud — happier than synthwave, same box
      drums:{kickModel:["909"],snareModel:["clap","noise"],hatModel:["noise"],kick:[1.15,1.35],snare:[.8,1.05],hat:[.9,1.2],tune:[.95,1.1],send:[.2,.35],dsend:[.05,.15]},
      fx:{reverb:[.45,.6], delayBeats:[.375,.75], delayFb:[.25,.4], delayCut:[2800,4000], pump:[.1,.3], crackle:[0,.08], lowcut:[30,45], highcut:[0,0], comp:[.3,.5], grit:[0,0]},
      found:{role:"bed", vol:[.06,.12], pitch:[.8,.95], stretch:[.45,.6], cutoff:[1500,2500], sources:["pool:city*1","pool:road*1","vx_xminusone"]},
      stab:["off","offbeat"], hits:{sources:["pool:rave_stab*1","pool:vocal_stab*1","sp_nightdrive"], pattern:"sparse", prob:.4},
      form:"pop" },
    bigbeat: { label:"Airhorn Apocrypha", info:"A breaks kit at 118-136. Acid bass under an organ, with a stacked saws lead. A descending minor run, a light shuffle.",   // SAMPLE-FORWARD: the break + the sample-CD arsenal
      bpm:[118,136], swing:[0,.1], humanize:[.05,.2],
      progressions:["minor_run","house_min","deep_two"], kits:["breaks","house"], fills:["break fill","riser","impact","cut","snare roll"],
      bass:{patterns:["stab","rolling","drive","syncopated"], recipe:{model:["acid"],cutoff:[420,700],res:[.3,.45],level:[1.1,1.3],send:[0,.08],dsend:[0,.1]},
        inserts:{prob:.6, max:2, pool:[["distort",{drive:[.3,.6],mix:[.6,.9]}],["filtersweep",{rateBars:[2,4],lo:[-.8,-.3],hi:[.8,1.4],res:[.35,.5]}]]}},   // the acid line, overdriven AND swept — maximum cheek
      lead:{patterns:["double","pentaup","arpup"], recipe:{model:["stack","pluck"],wave:"saw",voices:[2,4],spread:[.006,.012],cutoff:[2600,3800],level:[.42,.55],send:[.25,.4],dsend:[.2,.35],attack:.004,release:[.06,.1],sustain:[.55,.68],fenv:[.5,.9]}},
      pads:{prob:.3, recipe:{model:["organ","saw"],wave:"saw",cutoff:[600,950],detune:[.005,.01],attack:[.3,.8],level:[.32,.45],send:[.25,.4],dsend:[.1,.25]}},   // dark stab pad, mostly ABSENT
      drums:{kickModel:["909","boom"],snareModel:["crack","clap"],hatModel:["noise"],kick:[1.3,1.55],snare:[.85,1.1],hat:[.7,1],tune:[.95,1.1],send:[.1,.25],dsend:[.1,.3]},
      fx:{reverb:[.4,.55], delayBeats:[.5,.75], delayFb:[.3,.45], delayCut:[2200,3400], pump:[.25,.5], crackle:[.05,.2], lowcut:[30,45], highcut:[0,0], comp:[.55,.8], grit:[.3,.6]},
      found:{role:"break", vol:[.3,.42], pitch:[1,1], stretch:[.5,.5], cutoff:[5500,8000], sources:["amen_165","amen_170","amen_172","amen_175","stml_loop_120a","stml_loop_126a","stml_loop_129a","stml_loop_133a","stml_loop_136a"]},   // the break LOUD and open
      stab:["rave","rave","offbeat"], hits:{sources:["bb_horn_a","bb_horn_b","bb_stab_a","bb_stab_b","bb_stab_c","stml_hit_01","stml_hit_b3","stml_hit_03"], pattern:"offbeat", prob:.85},   // the dcc12/20/48 shelf finally stars
      // Phase-4 PILOT: the rave air-horn OPENER — canawave's goal-horn intro
      // idiom, now catalog-wide vocabulary via the generic sample-event pass
      // (one filtered stab on the first section's downbeat). Additive: the
      // break/hits handlers are untouched; only bigbeat's own fixtures drift.
      sampleEvents:[{ pool:["bb_horn_a","bb_horn_b"], placement:"opener", gain:.6, treatment:{cutoff:7000, dsend:.3} }],
      form:"drop" },
    garage: { label:"Numbers Station Shuffle", info:"A breaks kit at 128-136. Sub bass under an organ, with a pluck lead. A min7 house vamp, hard swing, euclidean hats.",   // sample-mid: vox chops as percussion
      bpm:[128,136], swing:[.2,.3], humanize:[.1,.25],
      progressions:["house_min7","deep_two","lofi"], kits:["breaks","house"], fills:["off","hat rush","cut","break fill"],
      euclid:{hat:[7,16]},   // E(7,16) skippy 2-step hats, rotation per chord (swing rides on top)
      timeFeel:{ grid:"16th", pushPullMs:{ hat:-4, bass:5 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — 2-STEP: hats on top of a sub that lags; the SKIP itself is the 16th swing below, this is the pocket underneath it. Phase 3: the 2-STEP shuffle is a 16th swing — the e/a offbeats slide late (grid "16th"), not the 8th "&"; this is what makes garage skip where house merely bounces
      bass:{patterns:["sub","dub","stab"], recipe:{model:["sub"],cutoff:[300,500],res:[.05,.18],level:[1.15,1.35],send:[0,.06],dsend:[0,.05]}},
      lead:{patterns:["double","sparse","pentaup"], recipe:{model:["pluck","fm"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[2200,3200],level:[.36,.48],send:[.3,.45],dsend:[.25,.4],attack:.004,release:[.05,.09],sustain:[.55,.65],fenv:[.4,.7]}},
      pads:{prob:.4, recipe:{model:["organ","fm"],wave:"saw",cutoff:[700,1100],detune:[.004,.009],attack:[.2,.6],level:[.34,.46],send:[.25,.4],dsend:[.1,.25]}},   // dark chord stabs, often absent
      drums:{kickModel:["909","808"],snareModel:["crack","clap"],hatModel:["noise","metal"],kick:[1.1,1.3],snare:[.85,1.1],hat:[.8,1.15],tune:[1,1.1],send:[.08,.18],dsend:[.1,.25]},
      fx:{reverb:[.35,.5], delayBeats:[.375,.75], delayFb:[.25,.4], delayCut:[2400,3600], pump:[.15,.35], crackle:[0,.08], lowcut:[30,45], highcut:[0,0], comp:[.4,.6], grit:[.1,.25]},
      found:{role:"chops", vol:[.1,.18], pitch:[.95,1.15], stretch:[.4,.6], cutoff:[2500,4000], sources:["shibuya","tokyo_station","vx_suspense"]},
      stab:["off","sparse"], hits:{sources:["pool:vocal_stab*2","sp_rhythm"], pattern:"offbeat", prob:.65},
      form:"pop" },
    doomdrone: { label:"Subduction Hymnal", info:"A bare kick at 48-62. Sub bass under a church organ, with a fuzz lead. A two-chord minor drone, straight time.",   // SYNTH-FORWARD (the bed is dread, not hook)
      bpm:[48,62], swing:[0,.04], humanize:[.1,.3],
      progressions:["drone_min","deep_two","mode_phrygian"], kits:["off","kick"], fills:["off"],
      reverbColor:"greyhole",   // GRIT PASS: the diffuse abyssal smear — the drone drowns in the cavern
      bass:{patterns:["root","sub","off"], recipe:{model:["sub","reese"],cutoff:[200,380],res:[.05,.15],level:[1.15,1.4],send:[.1,.25],dsend:[0,.1]},
        inserts:{prob:.85, max:1, pool:[["distort",{drive:[.55,.85],mix:[.75,1]}]]}},   // tectonic distorted sub
      lead:{patterns:["sparse","double","off"], recipe:{model:["fuzz"],wave:"saw",voices:[1,2],spread:[.003,.008],cutoff:[1200,2000],res:[.2,.35],drive:[.7,1],level:[.48,.58],send:[.5,.7],dsend:[.3,.5],attack:[.1,.3],release:[.5,.9],sustain:[.9,1]}},   // LOW sustained fuzz — a riff exhaling, drive MAXED
      pads:{prob:1, samplerPool:["church_organ","cello"], recipe:{model:["saw","choir","sampler","sampler"],wave:"saw",cutoff:[500,900],detune:[.01,.018],attack:[3,5],mellotron:true,level:[.7,.9],send:[.7,.85],dsend:[.15,.3]},
        inserts:{prob:.5, max:1, pool:[["filtersweep",{rateBars:[8,16],lo:[-1.5,-.8],hi:[.3,.8],res:[.2,.4]}]]}},   // tectonic 8-16-bar sweeps — the drone inhales once a minute. Effects audit C: Sunn/Boris tape drones — the church_organ/cello/choir pad runs through the MELLOTRON tape head (drowned wow/flutter, byte-stable boolean flag)
      drums:{kickModel:["boom","808"],snareModel:["noise"],hatModel:["noise"],kick:[1.3,1.6],snare:[.4,.6],hat:[.3,.5],tune:[.78,.9],send:[.3,.5],dsend:[.1,.3]},
      fx:{reverb:[.85,.95], delayBeats:[1,1.5], delayFb:[.45,.6], delayCut:[1200,2200], pump:[0,0], crackle:[0,.1], lowcut:[0,20], highcut:[0,0], comp:[.5,.75], grit:[.5,.8]},
      found:{role:"bed", vol:[.2,.32], pitch:[.5,.65], stretch:[.45,.6], cutoff:[1200,2200], sources:["vx_cage_studio79","factory","pool:road*1","vx_blake","vx_conet_swedish"]},   // the factory WAY down + tyger tyger + the haunted music box
      stab:["off"], hits:{sources:["sp_pressure","pool:vocal_stab*1"], pattern:"sparse", prob:.2},
      form:"wave" },
    newage: { label:"Chlorophyll Cathedral", info:"Beatless at 58-76. Sub bass under a harp, with a flute. Dream changes, a light shuffle, loose timing, rubato.",   // wash-trio deep pass: the MELODIC one. Its identity claim ambient/downtempo can't share is a PRESENT melody over MOVING harmony that BREATHES — the only wash-cluster genre with rubato
      bpm:[58,76], swing:[0,.06], humanize:[.2,.4],
      rubato:{depth:[.008,.02], periodBars:[3,5], prob:1},   // the melody ALWAYS breathes (state.rubato beat-warp) — gentler than neoclassical (.02-.04) and slower-period (3-5 bars): a devotional new-age drift, not a Romantic-piano rubato. This is the structural fence — every other wash-cluster genre renders rubato 0 (machine/drone time); newage is the one that sways
      progressions:["dream","canon","neosoul"], kits:["off"], fills:["off"],   // MOVING major-7 changes only (was dream/mode_lydian/canon) — dropped mode_lydian (motion .33) so newage renders motion 1 always: the melodic harmony that ambient (drone, motion 0) can never reach
      bass:{patterns:["root","simple","off"], recipe:{model:["sub"],cutoff:[250,450],res:[.05,.12],level:[.8,1],send:[.15,.3],dsend:[0,.1]}},
      lead:{patterns:["sparse","wander","arpup"], samplerPool:["flute","harp","pan_flute"], recipe:{model:["stack","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.004],cutoff:[2200,3400],level:[.4,.5],send:[.5,.7],dsend:[.25,.4],vibrato:[.006,.012],attack:[.15,.4],release:[.5,.8],sustain:[.85,.95]}},   // 2/3 a real flute/harp/pan-flute over the drift; the gentle sine (stack) keeps its 1/3 — newage's stated identity IS a "sine/flute MELODY", and dropping it ties neoclassical (both acoustic). Pool widened (pan_flute) for variety.
      pads:{prob:1, patchPool:["TUB BELLS","SHIMMER","CELESTE"], samplerPool:["harp","celesta"], recipe:{model:["vp330","vp330","solina","solina","choir","strings","dx7","sampler"],wave:"saw",cutoff:[900,1600],detune:[.005,.012],attack:[2.5,4.5],vowel:[.5,.65],breath:[.4,.55],ensemble:[.75,.9],octave:[.5,.6],level:[.6,.8],send:[.6,.8],dsend:[.1,.25]},
        inserts:{prob:.5, max:1, pool:[["chorus",{rate:[.15,.4],depth:[.4,.6],mix:[.3,.5]}]]}},   // the drift: VP-330 ghost-choir (vowel morph, stereo ensemble) or the Solina string cloud; DX7 chimes + real choir the rest
      drums:{kickModel:["808"],snareModel:["noise"],hatModel:["noise"],kick:[.5,.8],snare:[.35,.55],hat:[.3,.5],tune:[.9,1.05],send:[.25,.45],dsend:[0,.1]},
      fx:{reverb:[.8,.92], delayBeats:[1,1.5], delayFb:[.35,.5], delayCut:[1800,2800], pump:[0,0], crackle:[0,.05], lowcut:[0,0], highcut:[0,0], comp:[0,.15], grit:[0,0]},
      found:{role:"bed", vol:[.16,.26], pitch:[.75,.9], stretch:[.45,.6], cutoff:[2400,3800], sources:["frogs","pool:water*1","vx_whitman"]},
      stab:["off"], hits:{sources:["sp_herenow"], pattern:"sparse", prob:.15},
      form:"wave" },
    exotica: { label:"Plastic Volcano", info:"A half-time kit at 85-105. Acoustic bass under a vibraphone, with a tenor sax. ii-V-I, swung, loose timing.",   // SAMPLE-FORWARD: the aviary up front
      bpm:[85,105], swing:[.12,.22], humanize:[.25,.45],
      progressions:["ii_v_i","lofi","neosoul"], kits:["halftime","boombap"], fills:["off","drum fill"],
      bass:{patterns:["walking","simple","root"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sampler","piano"],cutoff:[500,900],res:[.05,.12],level:[.9,1.1],send:[.1,.2],dsend:[0,.05],attack:.005,release:[.08,.14]}},   // STRONG-SAMPLE: the real upright now anchors the tiki combo 2/3 of seeds (no sub target — matrix-invisible)
      lead:{patterns:["wander","pentaup","sparse"], patchPool:["VIBE    1","MARIMBA","SAX BC"], samplerPool:["tenor_sax","vibraphone","marimba","steel_drums","sitar"], recipe:{model:["sampler","sampler","sampler","sampler","piano"],wave:"sine",voices:[1,2],spread:[.001,.004],cutoff:[2400,3600],level:[.45,.58],send:[.35,.55],dsend:[.1,.25],vibrato:[.008,.014]},   // STRONG-SAMPLE: no DX7 fake — 4/5 real tiki instruments (STEEL DRUMS GM 114 + SITAR GM 104 + sax/vibe/marimba) + 1 comping piano, all acoustic-grade in exotica's [.4,1] fence
        inserts:{prob:.45, max:1, pool:[["tremolo",{rate:[3,4.5],depth:[.4,.65],shape:[0,0],wobble:[.3,.6],mix:[.5,.75]}]]}},   // effects audit C (module built d924567): the vibraphone FAN — slow (3-4.5Hz) sinusoidal AM (shape 0, the motor-fan) with wobble (the spinning-disc cents-flutter). Fires on the DX7 "VIBE 1" mallet draw; the sampled vibraphone renders clean, native-path
      pads:{prob:.85, samplerPool:["vibraphone","marimba"], recipe:{model:["organ","piano","sampler"],wave:"sine",cutoff:[1000,1600],detune:[.002,.006],attack:[.3,.9],level:[.42,.56],send:[.35,.5],dsend:[.05,.15]}},
      drums:{kickModel:["boom","808"],snareModel:["noise"],hatModel:["noise"],kick:[.9,1.15],snare:[.45,.66],hat:[.6,.9],tune:[.9,1.05],send:[.2,.35],dsend:[.05,.2],kit:"jazz"},   // snare trimmed ): brushes, not backbeat — keeps snareBalance under the exotica fence with the kit-quote fills; SAMPLED jazz kit (tiki combo)
      fx:{reverb:[.55,.7], delayBeats:[.5,.75], delayFb:[.2,.35], delayCut:[2200,3200], pump:[0,0], crackle:[0,.15], lowcut:[0,25], highcut:[0,0], comp:[.1,.3], grit:[0,0]},
      found:{role:"bed", vol:[.2,.32], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[3500,5200], sources:["pool:water*1","pool:city*1","pool:voices*1"]},   // lagoon water + lounge crowd near natural pitch, bright and present
      stab:["off"], hits:{sources:["pool:horn_stab*1","pool:vocal_stab*1"], pattern:"sparse", prob:.35},
      // exotica deep pass — THE AVIARY MADE LITERAL: the Les Baxter / Martin Denny
      // signature is the band ANSWERING the melodic phrase with an animal call. Now a real
      // sampleEvents "response" layer (a birdcall on the back half of each chord bar, ~40% of
      // bars) instead of only a continuous jungle bed — the birds ARE the percussion color,
      // as the info string promises. Bright (pitch up, cutoff 6k) and fairly DRY (rsend .35) —
      // the intimate tiki room, categorically NOT spacelounge's muffled/drenched Apollo
      // telemetry (its sibling's electronic answer). Additive: found-layer only, no verifier
      // feature moves; only exotica's own fixtures drift.
      sampleEvents:[{ pool:["whale_song","vx_timelady"], placement:"response", sections:"verse|chorus|bridge|hook", prob:.4, gain:.5, treatment:{pitch:1.15, cutoff:6000, rsend:.35, dsend:.12} }],
      form:"pop" },
    industrial: { label:"Annealing Ritual", info:"A machine four at 100-126. Reese bass under an organ, with a fuzz lead. Phrygian, a light shuffle, euclidean hats.",   // SAMPLE-FORWARD: the factory IS the hook (chops role)
      bpm:[100,126], swing:[0,.05], humanize:[0,.15],
      progressions:["mode_phrygian","drone_min","deep_two"], kits:["techno","pulse"], fills:["cut","impact","noise","hat rush","stutter"],
      euclid:{hat:[11,16]},   // E(11,16) relentless uneven metal-hat clatter — the machine's gait
      bass:{patterns:["stab","rolling","drive"], recipe:{model:["reese","acid"],cutoff:[300,520],res:[.25,.4],level:[1.1,1.3],send:[0,.08],dsend:[0,.1]},
        inserts:{prob:.7, max:2, pool:[["distort",{drive:[.4,.7],mix:[.7,1]}],["filtersweep",{rateBars:[2,4],lo:[-1,-.4],hi:[.6,1.2],res:[.3,.5]}]]}},   // the bass IS machinery: driven hard, occasionally swept
      lead:{patterns:["double","sparse","off"], recipe:{model:["fuzz","stack","vocoder"],wave:"saw",voices:[1,2],spread:[.003,.008],cutoff:[1600,2600],res:[.3,.45],level:[.38,.5],send:[.2,.35],dsend:[.3,.5],attack:.004,release:[.06,.1],sustain:[.5,.62],fenv:[.6,1]}},   // rare vocoder: the numbers station sings
      vocSource:"vx_conet_poacher",
      pads:{prob:.3, recipe:{model:["organ","saw"],wave:"saw",cutoff:[550,900],detune:[.006,.012],attack:[.8,2],level:[.3,.42],send:[.25,.4],dsend:[.15,.3]}},   // dark, mostly ABSENT
      drums:{kickModel:["909","808"],snareModel:["crack","clap"],hatModel:["metal"],kick:[1.3,1.55],snare:[.7,.95],hat:[.8,1.15],tune:[.8,.9],send:[.1,.2],dsend:[.15,.35]},   // tuned DOWN — the kit as machinery
      fx:{reverb:[.45,.65], delayBeats:[.5,.75], delayFb:[.35,.5], delayCut:[1800,2800], pump:[.1,.3], crackle:[0,.08], lowcut:[35,50], highcut:[0,0], comp:[.5,.7], grit:[.5,.8], jux:[.3,.55]},
      found:{role:"chops", vol:[.16,.26], pitch:[.85,1], stretch:[.4,.6], cutoff:[2500,4000], sources:["factory","factory","vx_conet_poacher"]},   // siderurgia, sliced; the numbers station cuts through
      stab:["offbeat","sparse"], hits:{sources:["pool:vb_industrial_machine*1","sp_system","sp_pressure","pool:rave_stab*1"], pattern:"dub", prob:.55},
      form:"dj" },
    spokenword: { label:"Dial Tone Prophet", info:"A boom-bap kit at 72-96. Acoustic bass under a piano, with a tenor sax. ii-V-I, swung, loose timing.",   // SAMPLE-FORWARD: the VOICE leads
      timeFeel:{ pushPullMs:{ bass:8, hat:-4 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — DILLA DRAG under a voice: the beat must never crowd the speaker
      bpm:[72,96], swing:[.05,.14], humanize:[.2,.4],
      progressions:["ii_v_i","neosoul","mode_dorian"], kits:["boombap"], fills:["off","off","drum fill"],
      bass:{patterns:["walking","dub","simple"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sampler","piano"],cutoff:[350,650],res:[.05,.12],level:[.85,1.05],send:[.05,.15],dsend:[0,.05],attack:.005,release:[.08,.14]}},   // STRONG-SAMPLE: the real upright now walks 2/3 under the poets (no sub target — matrix-invisible)
      lead:{patterns:["sparse","wander","off"], samplerPool:["tenor_sax","felt_piano","upright_piano"], recipe:{model:["piano","sampler"],wave:"sine",voices:[1,1],spread:[.001,.003],cutoff:[2400,3400],level:[.45,.55],send:[.35,.5],dsend:[.1,.25]}},   // half the seeds a real sampled voice answering the poets: tenor sax or a piano — incl. the FreePats Kawai upright, the coffee-house piano behind the poets
      pads:{prob:.8, recipe:{model:["piano","fm"],wave:"sine",cutoff:[900,1500],detune:[.002,.006],attack:[.3,.9],level:[.4,.55],send:[.35,.5],dsend:[.05,.15]}},
      drums:{kickModel:["boom","808"],snareModel:["noise"],hatModel:["noise"],kick:[.95,1.2],snare:[.35,.55],hat:[.5,.8],tune:[.9,1],send:[.15,.3],dsend:[0,.1]},   // snare QUIET — never over the voice
      fx:{reverb:[.45,.6], delayBeats:[.5,.75], delayFb:[.2,.35], delayCut:[2200,3200], pump:[0,0], crackle:[.3,.5], lowcut:[0,0], highcut:[0,0], comp:[.1,.3], grit:[0,0]},
      found:{role:"bed", vol:[.3,.42], pitch:[.95,1], stretch:[.45,.6], cutoff:[3200,4600], sources:["vx_corso_history75","vx_ginsberg_mexcityblues","vx_burroughs_lecture76","vx_diprima_1987","vx_waldman_crack","vx_baraka_revpoetry94","vx_whalen_reading80","vx_snyder_reading83","vx_burroughs","vx_ginsberg","vx_waldman","vx_dickinson","leacock1","leacock4","vx_ginsberg_class"]},   // the poets lead, Leacock keeps a chair
      stab:["off"], hits:{sources:["pool:vb_spoken_poetic*1","sp_herenow","sp_slowdown","sp_rewind"], pattern:"sparse", prob:.6},
      autoTune:0,   // fx wings stage 2: EXPLICITLY off — never pitch-correct the poets; a spokenword-dominant blend inherits this 0
      form:"duet" },
    chiptune: { label:"Sprite Metabolism", info:"A four-on-the-floor at 140-148. Saw synth bass under a saw synth pad, with a phase-distortion lead. Four-chord changes, straight time, quantized tight.",   // SYNTH-FORWARD: no samples to speak of
      bpm:[140,148], swing:[0,.02], humanize:[0,.05],   // pinned under 150 — the engine forces a jungle kit above that
      progressions:["four_chords","sad_pop","minor_run"], kits:["four","pulse"], fills:["hat rush","cut","riser"],
      bass:{patterns:["octaves","sixteenths","drive"], recipe:{model:["saw"],cutoff:[900,1500],res:[.1,.2],level:[1,1.2],send:[0,.05],dsend:[0,.05]}},
      lead:{patterns:["arpup","arpdown","double","hero"], recipe:{model:["casiocz","casiocz","casiocz","casiocz","pluck"],wave:"square",voices:[1,2],spread:[.001,.003],cutoff:[3500,5000],czWave:[.75,1],dcwAmount:[.5,.8],dcwDecay:[.05,.15],czDetune:[2,8],level:[.5,.62],send:[.15,.3],dsend:[.15,.3],vibrato:[0,.002],attack:.002,release:[.03,.06],sustain:[.5,.6],octave:0}},   // Casio CZ phase-distortion lead (wave .75-1 buzzy, snappy DCW) — the glassy chip arp; pluck the fallback
      pads:{prob:.5, recipe:{model:["saw"],wave:"square",cutoff:[1500,2500],detune:[.003,.007],attack:[.1,.4],level:[.35,.48],send:[.15,.3],dsend:[.05,.15]}},
      drums:{kickModel:["909"],snareModel:["noise","clap"],hatModel:["noise"],kick:[1.1,1.35],snare:[.7,.95],hat:[.8,1.15],tune:[1,1.15],send:[.05,.12],dsend:[0,.1]},
      fx:{reverb:[.3,.45], delayBeats:[.375,.5], delayFb:[.15,.3], delayCut:[3000,4500], pump:[0,.15], crackle:[0,0], lowcut:[0,0], highcut:[0,0], comp:[.3,.5], grit:[.15,.35], jux:[.25,.45]},   // SID-chip hard-ish channel panning
      found:{role:"bed", vol:[.04,.08], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[2000,3200], sources:["pool:city*1","vx_xminusone"]},
      stab:["off","sparse"], hits:{sources:["pool:rave_stab*1","sp_energy"], pattern:"offbeat", prob:.4},
      form:"pop" },
    chinawave: { label:"Harvest Quota Anthem", info:"A four-on-the-floor at 96-118. Saw synth bass under choir, with a trumpet. Four-chord changes, straight time.",   // SAMPLE-FORWARD: the massed chorus IS the bed
      bpm:[96,118], swing:[0,.04], humanize:[.05,.18],
      progressions:["four_chords","doo_wop","canon"], kits:["four","pulse"], fills:["drum fill","tom fill","riser","snare roll","snare roll"],   // the march-snare crescendo IS this genre's fill
      bass:{patterns:["root","walking","octaves"], recipe:{model:["saw"],cutoff:[500,850],res:[.08,.16],level:[.85,1.05],send:[.05,.12],dsend:[0,.05]}},
      lead:{patterns:["pentaup","pentaup","updown"], patchPool:["BR TRUMPET","BRASS   3"], samplerPool:["trumpet"], recipe:{model:["brass","brass","vocoder","dx7","sampler"],wave:"saw",voices:[1,2],spread:[.002,.005],cutoff:[2400,3400],level:[.52,.66],send:[.3,.45],dsend:[.1,.25],vibrato:[.006,.012]}},   // pentatonic brass; sometimes Radio Peking SINGS it (vocoder); DX7 trumpet pair (alg 18 -> morphable) + a real PLA trumpet
      pads:{prob:1, recipe:{model:["choir","strings"],wave:"saw",cutoff:[1000,1700],detune:[.004,.01],attack:[1,2.2],level:[.5,.68],send:[.4,.55],dsend:[.05,.15]}},
      drums:{kickModel:["boom","909"],snareModel:["noise","crack"],hatModel:["noise"],kick:[.95,1.15],snare:[1.05,1.3],hat:[.6,.9],tune:[.95,1.1],send:[.15,.3],dsend:[0,.1]},   // MARCH SNARE — proud and up front
      fx:{reverb:[.45,.6], delayBeats:[.5,.75], delayFb:[.15,.3], delayCut:[2200,3200], pump:[0,.08], crackle:[.15,.35], lowcut:[140,220], highcut:[5000,8000], comp:[.2,.4], grit:[0,.1]},   // effects audit tier-C soft-top: "The East Is Red through the wire recorder" = a BAND-PASS (wire recorders roll off both ends). lowcut + highcut band-limits the mix. Flips softTop 0->1, re-fenced (see below); lowcut is matrix-safe
      found:{role:"bed", vol:[.2,.32], pitch:[.9,1], stretch:[.45,.6], cutoff:[2800,4200], sources:["vx_cn_east","vx_cn_march","vx_cn_opera","vx_cn_speech"]},
      vocSource:"vx_cn_speech",   // Radio Peking through the vocoder
      stab:["off"], hits:{sources:["vx_cn_opera","vx_cn_march"], pattern:"sparse", prob:.5},
      form:"pop" },
    sovietwave: { label:"Cosmodrome Lullaby", info:"A pulse kit at 90-112. Saw synth bass under a vocoder choir pad, with a trumpet. Epic minor changes, a light shuffle.",   // SAMPLE-FORWARD: choir + speeches + Radio Moscow
      bpm:[90,112], swing:[0,.06], humanize:[.05,.2],
      progressions:["epic_min","minor_run","uplift"], kits:["pulse","four"], fills:["riser","tom fill","downlift"],
      bass:{patterns:["drive","octaves"], recipe:{model:["saw"],cutoff:[550,900],res:[.12,.22],level:[1,1.2],send:[0,.08],dsend:[0,.05]}},
      lead:{patterns:["arpup","hero","wander","updown"], patchPool:["BRASS   2","BRASS   1","SYNBRASS 1"], samplerPool:["trumpet","trombone","french_horns"], recipe:{model:["vocoder","vocoder","stack","dx7","sampler"],wave:"saw",voices:[2,3],spread:[.004,.009],cutoff:[2400,3400],level:[.6,.72],send:[.35,.5],dsend:[.25,.4],vibrato:[0,.004]},
        inserts:{prob:.35, max:1, pool:[["chorus",{rate:[.4,.9],depth:[.4,.6],mix:[.35,.5]}]]}},   // the genre's voice: vocoded speech SINGS the arps; ~1/4: DX7 BRASS 2, the state-radio fanfare (csound maps -> fm)
      pads:{prob:1, recipe:{model:["vp330","oberheim","solina","choir","choir","strings"],wave:"saw",cutoff:[900,1500],detune:[.005,.011],attack:[1.5,3],vowel:[.25,.4],ensemble:[.55,.7],octave:[.5,.6],filterMode:[0,.15],envAmount:[1,1.6],level:[.55,.75],send:[.5,.65],dsend:[.1,.2]},
        inserts:{prob:.5, max:1, pool:[["phaser",{rate:[.08,.2],depth:[.5,.7],mix:[.35,.55]}]]}},   // the shortwave choir: VP-330 ghost-choir / Oberheim SEM pad / Solina cloud, over the real choir + strings, through a slow Soviet tape-phaser
      drums:{kickModel:["boom","909"],snareModel:["noise","clap"],hatModel:["noise"],kick:[1.1,1.3],snare:[.7,.95],hat:[.6,.9],tune:[.9,1.05],send:[.2,.35],dsend:[.05,.15]},
      fx:{reverb:[.65,.8], delayBeats:[.5,.75], delayFb:[.25,.4], delayCut:[2000,3000], pump:[0,.15], crackle:[.2,.4], lowcut:[140,220], highcut:[5000,8000], comp:[.25,.45], grit:[0,.15]},   // effects audit tier-C soft-top: "the Red Army choir through the shortwave / Radio Moscow" = a band-limited shortwave passband. lowcut + highcut. Flips softTop 0->1, re-fenced (see below); lowcut is matrix-safe
      found:{role:"bed", vol:[.22,.34], pitch:[.85,.95], stretch:[.45,.6], cutoff:[2400,3600], sources:["vx_sv_choir","vx_sv_speech","vx_sv_radio","vx_sv_march"]},
      vocSource:"vx_sv_speech",   // Lenin 1919, vocoded
      stab:["off","sparse"], hits:{sources:["vx_sv_march","vx_sv_radio"], pattern:"sparse", prob:.5},
      form:"suite" },
    // ================= ROUND 3 — the big expansion =================
    citypop: { label:"Neon Fiscal Year", info:"A full kit at 92-106. Finger bass under a Juno pad, with a jazz guitar. Royal-road changes, swung.",   // SYNTH-FORWARD: vaporwave before the slowdown — city lights, not mall haze
      reverbColor:"dattorro",   // fx wings: clean plate gloss on the maj7 boogie
      bpm:[92,106], swing:[.05,.12], humanize:[.08,.2],   // UNDER transitwave/italo tempo — the boogie sits at 100
      progressions:["royal_road","pop_1625","neosoul"], kits:["full","open"], fills:["drum fill","tom fill","riser"],
      bass:{patterns:["walking","melodic","octaves","syncopated"], samplerPool:["finger_bass"], recipe:{model:["saw","saw","sampler"],cutoff:[650,1000],res:[.08,.16],level:[1.0,1.2],send:[.03,.08],dsend:[0,.05]},
        inserts:{prob:.45, max:1, pool:[["chorus",{rate:[.5,.9],depth:[.2,.35],mix:[.2,.32]}]]}},   // the DI'd 80s bass shimmer (Tats/Anri) — a SUBTLE chorus: low mix keeps the dry (75%) fundamental solid against the mono-comb, only the bright saw mids (cutoff 650-1000, never sub) get the width. 1/3 of seeds the fingered ELECTRIC walking bass (real, Finger Bass GM 33) — the "walking bass" the info promises; bass unread by acoustic, cutoff keeps sub=.2 (matrix-invisible)
      lead:{patterns:["composed","composed2","updown","arpup"], patchPool:["E.PIANO 1","E.PIANO 3"], samplerPool:["jazz_guitar","bright_yamaha_grand","alto_sax"], recipe:{model:["dx7","dx7","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[2800,3800],level:[.46,.58],send:[.25,.4],dsend:[.15,.3],vibrato:[.003,.007],attack:.01,release:[.12,.2],sustain:[.7,.8],fenv:[.1,.25]},
        inserts:{prob:.7, max:1, pool:[["chorus",{rate:[.5,1],depth:[.4,.6],mix:[.45,.65]}]]}},   // DX7 E.PIANO 1 as the DEFAULT voice — this is where vaporwave stole it from; E.PIANO + chorus IS the city-pop gloss
      pads:{prob:1, recipe:{model:["juno60","juno60","juno60","strings","saw"],wave:"saw",cutoff:[1400,2100],detune:[.004,.009],attack:[.5,1.2],chorus:[1,1.4],chorusSpread:[.8,1],level:[.45,.6],send:[.2,.35],dsend:[.05,.15]}},   // the Juno-60 keys/comp (stereo BBD chorus) — the city-pop gloss under the DX7 lead; strings/saw the rest
      drums:{kickModel:["boom","909"],snareModel:["noise","clap"],hatModel:["noise"],kick:[1.05,1.25],snare:[.75,1],hat:[.9,1.2],tune:[.95,1.1],send:[.12,.22],dsend:[.03,.1],kit:"power"},   // SAMPLED power kit — the big 80s city-pop drums
      fx:{reverb:[.35,.5], delayBeats:[.5,.75], delayFb:[.2,.32], delayCut:[2800,4000], pump:[0,.1], crackle:[0,.1], lowcut:[25,40], highcut:[0,0], comp:[.1,.24], grit:[0,0]},   // light-touch master (transitwave is the COMPRESSED one)
      found:{role:"bed", vol:[.07,.13], pitch:[.9,1], stretch:[.45,.6], cutoff:[1800,2800], sources:["shibuya","tokyo_station","pool:road*1"]},   // the city at NATURAL pitch, way back
      stab:["off"], hits:{sources:["pool:vb_mallsoft_vapor*1","sp_nightdrive","pool:vocal_stab*1"], pattern:"sparse", prob:.3},
      form:"pop" },
    shibuyakei: { label:"Parfait Cosmonaut", info:"AN open kit at 116-128. Saw synth bass under strings, with a glockenspiel. Doo-wop changes, hard swing.",   // SYNTH-FORWARD: toy orchestration, zero dust
      reverbColor:"dattorro",   // effects audit C: the bright 60s sunshine-pop plate (EMT-140) over the twee bells — the Pizzicato-Five gloss; zero rng, dominant-parent
      bpm:[116,128], swing:[.14,.24], humanize:[.1,.25],
      progressions:["doo_wop","doo_wop","pop_1625"], kits:["open","full"], fills:["drum fill","hat rush","riser"],
      bass:{patterns:["walking","octaves","melodic"], recipe:{model:["saw"],cutoff:[700,1100],res:[.08,.16],level:[.95,1.15],send:[.03,.08],dsend:[0,.05]}},
      lead:{patterns:["updown","pentaup","wander","composed"], patchPool:["TUB BELLS","E.PIANO 1"], samplerPool:["glockenspiel","vibraphone","flute"], recipe:{model:["bell","sampler","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.001,.004],cutoff:[3000,4200],level:[.48,.6],send:[.25,.4],dsend:[.2,.35],attack:.004,release:[.08,.14],sustain:[.55,.68],fenv:[.2,.4]},   // STRONG-SAMPLE: the toy orchestration made REAL — 3/4 the actual GLOCKENSPIEL (GM 9) / vibraphone / flute (.8), one synth bell keeps the twee sparkle
        inserts:{prob:.6, max:1, pool:[["chorus",{rate:[.6,1.2],depth:[.4,.6],mix:[.4,.6]}]]}},   // music-box bells + plucks (TUB BELLS through the sunshine) — chorused twee-wide
      pads:{prob:.9, recipe:{model:["strings"],wave:"saw",cutoff:[1400,2000],detune:[.003,.008],attack:[.3,.8],level:[.42,.56],send:[.2,.35],dsend:[.05,.15]}},
      drums:{kickModel:["boom"],snareModel:["noise","clap"],hatModel:["noise"],kick:[.95,1.15],snare:[.7,.95],hat:[1,1.3],tune:[1,1.15],send:[.15,.25],dsend:[.05,.12]},
      fx:{reverb:[.35,.5], delayBeats:[.375,.5], delayFb:[.15,.3], delayCut:[3000,4200], pump:[0,.08], crackle:[0,.08], lowcut:[20,35], highcut:[0,0], comp:[.15,.35], grit:[0,0]},
      found:{role:"bed", vol:[.06,.12], pitch:[.95,1.05], stretch:[.45,.6], cutoff:[2200,3400], sources:["shibuya","pool:city*1","pool:voices*1"]},
      stab:["off"], hits:{sources:["pool:vb_mallsoft_vapor*1","sp_shopping","pool:vocal_stab*1","pool:rave_stab*1"], pattern:"sparse", prob:.4},
      form:"aaba" },
    bossanova: { label:"Saudade Observatory", info:"A bossa kit at 84-100. Acoustic bass with a nylon string guitar on both pad and lead. ii-V-I, swung, loose timing.",   // acoustic-leaning: the guitar IS the song
      timeFeel:{ pushPull:{ bass:.01 } },   // effects audit C: a subtle behind-the-beat sway on the bass (the nylon guitar leans back) — swing .08-.18 already carries most of it, this is the gentlest structural nudge. Zero-rng dominant-parent, bass timing unread. Deliberately half-strength: at double these offsets the timing feel overshoots.
      bpm:[84,100], swing:[.08,.18], humanize:[.25,.45],
      progressions:["ii_v_i","neosoul","lofi"], kits:["bossa"], fills:["off","off","drum fill"],
      strum:"bossa",   // STRUM: the nylon-string guitar IS the song — bossa syncope comp on the pad voice
      bass:{patterns:["dub","simple","root"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sampler","piano"],cutoff:[380,700],res:[.05,.12],level:[.85,1.05],send:[.05,.12],dsend:[0,.05],attack:.005,release:[.08,.14]}},   // STRONG-SAMPLE: the real upright walks 2/3 of seeds (bass unread by acoustic, cutoff keeps sub=.2 — matrix-invisible)
      lead:{patterns:["guitarweave","wander","sparse","pentaup"], samplerPool:["nylon_string_guitar","nylon_string_guitar","flute"], recipe:{model:["sampler","sampler","sampler"],wave:"sine",drive:0,voices:[1,1],spread:[.001,.003],cutoff:[2400,3400],level:[.5,.62],send:[.25,.4],dsend:[.08,.2]}},   // STRONG-SAMPLE: no KS-pluck synth — the REAL nylon string / breathy flute IS the song, every seed (.8, in bossa's [.5,1] fence); guitarweave = the mined nylon idiom (classicalguitarmidi corpus) on its native instrument
      pads:{prob:.8, samplerPool:["nylon_string_guitar"], recipe:{model:["organ","piano","sampler"],wave:"sine",cutoff:[1000,1600],detune:[.002,.005],attack:[.3,.8],level:[.38,.5],send:[.3,.45],dsend:[.05,.12]}},
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.85,1.05],snare:[.5,.7],hat:[.5,.8],tune:[.95,1.1],send:[.12,.25],dsend:[0,.08],kit:"acoustic"},   // SAMPLED acoustic kit under the nylon-string bossa combo
      fx:{reverb:[.4,.55], delayBeats:[.5,.75], delayFb:[.1,.22], delayCut:[2400,3400], pump:[0,0], crackle:[.08,.25], lowcut:[0,25], highcut:[9000,13000], comp:[.1,.25], grit:[0,0]},
      found:{role:"bed", vol:[.08,.16], pitch:[.85,1], stretch:[.45,.6], cutoff:[2000,3200], sources:["pool:city*2","vx_dickinson"]},
      stab:["off"], hits:{sources:["pool:vb_jazz_blues*1","pool:horn_stab*1","pool:vocal_stab*1"], pattern:"sparse", prob:.25},
      form:"aaba" },
    idm: { label:"Solder Ballet", info:"A breaks kit at 88-116. Sub bass with a PPG pad on both pad and lead. A two-chord vamp, a light shuffle, loose timing, euclidean hats.",   // SYNTH-FORWARD: the PATTERN is the artist
      bpm:[88,116], swing:[0,.05], humanize:[.3,.5],
      progressions:["deep_two","mode_lydian","neosoul","drone_min","quartal"], kits:["breaks","techno","boombap"], fills:["cut","noise","reverse","off","stutter"],
      euclid:{kick:[5,16],hat:[11,16]},   // E(5,16) against E(11,16), both rotating — the tangle
      transforms:{ pool:["rev","ply","degrade","octflip","rest","rot","stutter"], rate:0.5 },   // Phase 2: the genre v4 exists for — HALF the bars mutate, the FULL pool (rot/stutter added). "drum tangles that never repeat" is now literally true
      bass:{patterns:["stab","melodic","sub"], recipe:{model:["sub","reese"],cutoff:[300,560],res:[.1,.25],level:[1,1.2],send:[0,.08],dsend:[0,.1]}},
      lead:{patterns:["wander","sparse","double"], patchPool:["TUB BELLS","ORCH-CHIME"], recipe:{model:["ppg","ppg","ppg","fm","bell","dx7"],wave:"sine",voices:[1,2],spread:[.004,.01],cutoff:[2200,3400],scan:[.3,.7],scanEnv:[.3,.6],scanLfo:[.05,.2],scanRate:[.2,2],level:[.42,.54],send:[.3,.5],dsend:[.3,.5],vibrato:[0,.004],attack:.005,release:[.1,.2],sustain:[.6,.75],fenv:[.3,.6]},
        inserts:{prob:.5, max:2, pool:[["phaser",{rate:[.2,.6],depth:[.5,.8],mix:[.4,.6]}],["filtersweep",{rateBars:[2,6],lo:[-.8,-.3],hi:[.6,1.2],res:[.25,.45]}]]}},   // braindance: the PPG wavetable-scan lead (scan swept by env+LFO — timbre as the artist), bells the rest; phase + sweep chains on top
      pads:{prob:.6, recipe:{model:["ppg","ppg","fm","saw"],wave:"sine",cutoff:[900,1500],detune:[.008,.016],attack:[1,2.5],scan:[.3,.6],scanEnv:[.2,.5],level:[.4,.55],send:[.3,.5],dsend:[.1,.25]}},   // detuned wavetable pad, often absent
      drums:{kickModel:["808","909"],snareModel:["crack","noise"],hatModel:["metal","noise"],kick:[1.05,1.3],snare:[.6,.85],hat:[.7,1],tune:[.9,1.1],send:[.05,.15],dsend:[.15,.35]},
      fx:{reverb:[.3,.45], delayBeats:[.375,.75], delayFb:[.3,.45], delayCut:[2200,3400], pump:[0,.1], crackle:[0,.1], lowcut:[25,40], highcut:[0,0], comp:[.3,.5], grit:[.15,.4], jux:[.4,.7]},   // jux MAX — the stereo field disagrees with itself
      found:{role:"chops", vol:[.1,.18], pitch:[.85,1.1], stretch:[.4,.6], cutoff:[2200,3600], sources:["vx_cage_studio79","factory","vx_wwvh","vx_conet_poacher"]},
      stab:["off","sparse"], hits:{sources:["sp_system","sp_rewind","pool:vocal_stab*1"], pattern:"sparse", prob:.45},
      form:"pop" },
    electro: { label:"Vocoder Ambassador", info:"AN electro kit at 118-130. Saw synth bass under a saw synth pad, with a phase-distortion lead. A funk vamp, a light shuffle, quantized tight, euclidean hats.",   // SYNTH-FORWARD: the drum machine is the lead instrument
      bpm:[118,130], swing:[0,.06], humanize:[0,.12],
      progressions:["funk_vamp","deep_two","minor_run"], kits:["electro"], fills:["cut","hat rush","impact","off"],
      euclid:{snare:[3,16]},   // E(3,16) tresillo CLAPS rotating per chord over the boom-bap frame
      bass:{patterns:["stab","sixteenths","octaves"], recipe:{model:["saw","acid"],cutoff:[500,850],res:[.15,.3],level:[1.05,1.25],send:[0,.06],dsend:[0,.08],fenvAmount:[1,1.8],fenvDecay:[.07,.13]}},   // BALANCE LOOP 3: the machine-funk bass stab claims the unified fenv — a short octave-scale zap on every hit (bass_saw/bass_acid both map it)
      lead:{patterns:["double","arpup","sparse"], patchPool:["SYN-CLAV 1","PRC SYNTH1"], recipe:{model:["casiocz","casiocz","casiocz","vocoder","stack","fm"],wave:"square",voices:[1,2],spread:[.002,.006],cutoff:[2400,3400],czWave:[.4,.6],dcwAmount:[.7,1],czDetune:[6,16],level:[.44,.56],send:[.2,.35],dsend:[.25,.4],attack:.003,release:[.05,.09],sustain:[.5,.62],fenvAmount:[1.5,2.5],fenvDecay:[.06,.12]},
        inserts:{prob:.4, max:1, pool:[["phaser",{rate:[.2,.5],depth:[.5,.7],mix:[.35,.55]}]]}},   // the vocoder IS the genre's voice — the robot phases
      vocSource:"sp_system",
      pads:{prob:.45, recipe:{model:["saw"],wave:"saw",cutoff:[800,1300],detune:[.004,.01],attack:[.3,.9],level:[.34,.46],send:[.2,.35],dsend:[.1,.2]}},   // dominance fix: "organ" dropped from the pool — an organ pad reads acoustic .6, which put electro dead-center in heavymetal's acoustic[.5,.95]w3 (seed 3 lost 98-99) and fed the funk/wickershimmy acoustic columns. 1982 electro is ALL machine (the robot sings through the vocoder); acoustic now renders 0 on every seed
      drums:{kickModel:["808"],snareModel:["clap"],hatModel:["metal","noise"],kick:[1.2,1.4],snare:[.85,1.1],hat:[.8,1.1],tune:[1,1.1],send:[.05,.15],dsend:[.1,.25]},
      fx:{reverb:[.3,.45], delayBeats:[.5,.75], delayFb:[.25,.4], delayCut:[2600,3800], pump:[.02,.1], crackle:[0,.1], lowcut:[30,45], highcut:[0,0], comp:[.4,.6], grit:[.1,.3], jux:[.15,.35]},   // dominance fix: pump cap .2->.1 — the anchor's own claim ("techno pumps, electro doesn't") rendered up to .19, INSIDE hotsaucecore's pump[.181,.652]w3 floor (seed 5 lost 98-99, seed 2 nearly). Dry machine funk pumps ~0; renders now .03-.09, failing every pump-floor rival (hotsaucecore/ikeacore/aldente) on a weight-3 axis
      found:{role:"chops", vol:[.08,.15], pitch:[.95,1.1], stretch:[.4,.6], cutoff:[2400,3800], sources:["factory","vx_apollo","vx_wwvh","stml_chop_a","stml_chop_c4"]},
      stab:["offbeat","sparse"], hits:{sources:["sp_system","sp_energy","pool:rave_stab*1","stml_hit_03"], pattern:"offbeat", prob:.6},
      form:"dj" },   // dominance fix: pop->dj — the 1982 electro record is a 12" CLUB SINGLE (warmup/build/main/peak plateau), not verse-chorus pop. MEASURED: pop's 3 drumless sections (intro/bridge/outro) diluted whole-track hatDensity to 1.16-1.28 vs electro's own [1.5,2.8] floor (active sections render 1.9/beat) — the self-score sat at 98-99 every seed, inside reach of any 99 rival (heavymetal/hotsaucecore/italo each took a seed). dj's near-full plateau restores the crisp 16th machine hats the kit already plays
    miamibass: { label:"Richter Scale Cookout", info:"A trap kit at 100-128. Sub bass under a saw synth pad, with a pluck lead. A funk vamp, a light shuffle, quantized tight.",   // SYNTH-FORWARD: the 808 sub is the hook
      bpm:[100,128], swing:[0,.08], humanize:[0,.12],
      progressions:["funk_vamp","deep_two","house_min7"], kits:["trap","electro"], fills:["hat rush","cut","impact"],
      bass:{patterns:["sub","stab","dub"], recipe:{model:["sub"],cutoff:[250,420],res:[.05,.15],level:[1.3,1.5],send:[0,.05],dsend:[0,.05]}},   // the 808 sub LOUD
      lead:{patterns:["double","arpup","sparse"], recipe:{model:["pluck","fm"],wave:"square",voices:[1,2],spread:[.002,.005],cutoff:[2600,3600],level:[.4,.52],send:[.15,.3],dsend:[.15,.3],attack:.003,release:[.05,.09],sustain:[.5,.62],fenv:[.4,.7]}},
      pads:{prob:.35, recipe:{model:["saw"],wave:"saw",cutoff:[900,1400],detune:[.004,.009],attack:[.2,.6],level:[.32,.44],send:[.15,.3],dsend:[.05,.15]}},   // NO organ — disco keeps its glitter, this is all machine
      drums:{kickModel:["808"],snareModel:["clap","crack"],hatModel:["noise","metal"],kick:[1.35,1.6],snare:[.75,1],hat:[.9,1.2],tune:[1,1.15],send:[.05,.12],dsend:[.05,.15]},
      fx:{reverb:[.25,.4], delayBeats:[.375,.5], delayFb:[.2,.35], delayCut:[2800,4000], pump:[.05,.2], crackle:[0,.08], lowcut:[25,38], highcut:[0,0], comp:[.25,.45], grit:[.1,.25], jux:[.1,.3]},
      found:{role:"bed", vol:[.06,.12], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[1800,3000], sources:["pool:road*1","pool:city*1"]},
      stab:["offbeat","sparse"], hits:{sources:["pool:vocal_stab*2","sp_energy","stml_hit_01","stml_hit_b3"], pattern:"offbeat", prob:.7},
      form:"vamp" },
    phonk: { label:"Cowbell Exorcism", info:"A trap kit at 126-142. Sub bass under an FM lead pad, with a phase-distortion lead. A two-chord vamp, a light shuffle.",   // SAMPLE-FORWARD: the dusty vox hits + tape filth
      timeFeel:{ pushPullMs:{ bass:6, hat:-3 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — 808 through a tape hiss — the same two-speed feel, dirtier
      bpm:[126,142], swing:[0,.1], humanize:[.1,.25],
      progressions:["deep_two","drone_min","mode_phrygian"], kits:["trap","boombap"], fills:["cut","off","downlift"],
      bass:{patterns:["sub","dub","stab"], recipe:{model:["sub","reese"],cutoff:[240,420],res:[.05,.18],level:[1.2,1.45],send:[0,.06],dsend:[0,.08]},
        inserts:{prob:.5, max:1, pool:[["distort",{drive:[.3,.6],mix:[.5,.8]}]]}},   // the Memphis 808, clipping the tape
      snarePP:0.5,   // effects audit B5: the Memphis triplet ping-pong throw on the hats/snare through the tape. Below the .65 liberal threshold => legacy >=4-beat/.6 spacing (a THROW, not a smear); distinct from the bass distort it already has. Matrix-safe (softTop stays 1 via highcut)
      lead:{patterns:["double","pentaup","sparse"], patchPool:["SYN-CLAV 1"], recipe:{model:["casiocz","casiocz","pluck","fm","dx7"],wave:"square",voices:[1,2],spread:[.002,.005],cutoff:[2000,3000],czWave:[.4,.6],czDetune:[8,20],dcwAmount:[.4,.7],level:[.42,.54],send:[.25,.4],dsend:[.25,.4],attack:.003,release:[.06,.1],sustain:[.5,.62],fenv:[.4,.7]}},   // the CZ phase-distortion cowbell-key (detuned, low cutoff) in the smoke; square pluck + DX7 syn-clav the rest
      pads:{prob:.4, recipe:{model:["fm","saw"],wave:"sine",cutoff:[700,1200],detune:[.005,.011],attack:[1,2],level:[.36,.48],send:[.35,.5],dsend:[.1,.25]}},
      drums:{kickModel:["808"],snareModel:["crack","clap"],hatModel:["noise"],kick:[1.25,1.5],snare:[.8,1.05],hat:[.7,1],tune:[.85,1],send:[.1,.2],dsend:[.1,.25]},
      fx:{reverb:[.35,.5], delayBeats:[.5,.75], delayFb:[.25,.4], delayCut:[1800,2800], pump:[.05,.2], crackle:[.35,.6], lowcut:[25,40], highcut:[7000,10000], comp:[.35,.6], grit:[.2,.4]},   // TAPE: heavy hiss + soft top
      found:{role:"bed", vol:[.1,.18], pitch:[.7,.82], stretch:[.45,.6], cutoff:[1600,2600], sources:["vx_suspense","pool:road*1","pool:industry*1"]},   // pitched-DOWN radio voices — the Memphis tape ghost
      stab:["off","sparse"], hits:{sources:["blues_vox_78","pool:vocal_stab*1","sp_slowdown"], pattern:"dub", prob:.7, wet:true},
      form:"pop" },
    witchhouse: { label:"Chandelier Drowning", info:"A trap kit at 60-76. Sub bass under ahh choir, with a PPG pad lead. A two-chord minor drone, a light shuffle.",   // SAMPLE-FORWARD: the slowed voice is the ghost
      timeFeel:{ pushPullMs:{ bass:12, snare:8 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — 808 at half speed and cursed: 68bpm buys a 15.8 ms budget and the genre's whole claim is DRAG
      reverbColor:"greyhole",   // fx wings: the cathedral-of-reverb smear
      bpm:[60,76], swing:[0,.08], humanize:[.1,.3],
      progressions:["drone_min","drone_min","deep_two","mode_phrygian"], kits:["trap","halftime"], fills:["downlift","off","reverse"],   // wash-trio deep pass: DRONE-DOMINANT (was deep_two/mode_phrygian/drone_min) — the slowed 808 crawls over a single held minor-7 the length of the cathedral (motion collapses to ~0), with the phrygian menace the rare tension. This is the occult-drone identity that fences witchhouse off downtempo (which now REQUIRES moving harmony, motion floor .4/w2) while its DRENCHED wash (.46-.51) fences it off the DRY dub (wash ceiling .34)
      bass:{patterns:["sub","root","dub"], recipe:{model:["sub"],cutoff:[240,420],res:[.05,.15],level:[1.15,1.35],send:[.05,.15],dsend:[0,.08]}},
      lead:{patterns:["sparse","off","wander"], patchPool:["SYN-VOX","VOICES"], recipe:{model:["ppg","ppg","choir","fm","dx7"],wave:"sine",voices:[1,2],spread:[.002,.006],cutoff:[1800,2800],scan:[.3,.6],scanEnv:[.3,.6],scanLfo:[.05,.2],level:[.38,.5],send:[.5,.7],dsend:[.3,.5],vibrato:[.004,.01]}},   // ~2/5 the PPG wavetable ghost-lead in the cathedral; choir/DX7 the rest
      pads:{prob:1, samplerPool:["ahh_choir"], recipe:{model:["vp330","vp330","ppg","ppg","choir","sampler"],wave:"saw",cutoff:[700,1200],detune:[.008,.016],attack:[2,4],vowel:[.1,.2],ensemble:[.85,1],scan:[.3,.6],scanEnv:[.2,.5],mellotron:true,level:[.6,.78],send:[.6,.8],dsend:[.15,.3]},
        inserts:{prob:.5, max:1, pool:[["chorus",{rate:[.1,.3],depth:[.5,.8],mix:[.4,.6]}]]}},   // the drowned choir doubles and smears — the sampled ahh-choir runs through the MELLOTRON tape head (drowned wow/flutter, byte-stable flag)
      drums:{kickModel:["808"],snareModel:["crack","noise"],hatModel:["noise"],kick:[1.1,1.35],snare:[.6,.85],hat:[.6,.9],tune:[.8,.95],send:[.2,.35],dsend:[.15,.35]},
      fx:{reverb:[.85,.95], delayBeats:[.75,1.5], delayFb:[.4,.6], delayCut:[1500,2500], pump:[0,.1], crackle:[0,.15], lowcut:[0,25], highcut:[0,0], comp:[.2,.4], grit:[.1,.3]},
      found:{role:"bed", vol:[.2,.32], pitch:[.55,.7], stretch:[.45,.6], cutoff:[1800,3000], sources:["vx_conet_swedish","vx_blake","vx_timelady"]},   // the haunted music box + tyger tyger + the time lady, ALL slowed to a crawl
      sampleEvents:[{ pool:["vx_blake","vx_conet_swedish"], placement:"response", gain:.42, treatment:{pitch:.42, cutoff:1700, rsend:.62, dsend:.42} }],   // wash-trio deep pass (KERNEL-V4 Phase-4 role): THE GHOST IN THE CATHEDRAL — the pitched-DOWN voice (tyger-tyger / the numbers-station music box dragged to .42, below even the bed's .55 crawl, lowpassed to a moan and drenched) ANSWERS on the back half of each drone bar. This is witchhouse's bespoke identity claim — the slowed voice IS the genre (the audit's "needs pitched-down vox"), now a real sample-event layer, not just a bed
      stab:["off"], hits:{sources:["pool:vb_spoken_poetic*1","pool:vocal_stab*1","sp_pressure"], pattern:"dub", prob:.5, wet:true},
      form:"pop" },
    mallsoft: { label:"Atrium Standing Wave", info:"A half-time kit at 44-56. Saw synth bass under ahh choir, with an alto sax. Royal-road changes, a light shuffle, one chord every 16 beats.",   // SAMPLE-FORWARD: the WASH is the architecture
      reverbColor:"dattorro",   // fx wings: DELIBERATE — the bright tiled-atrium PLATE (a big diffuse hall of hard surfaces), NOT dinosynth/doomdrone's greyhole dark-swamp smear. The mall is reverberant and bright, not murky
      bpm:[44,56], swing:[0,.1], humanize:[.05,.2],   // FURTHER below vaporwave's floor — the escalator has fully stopped (was 48-60)
      chordEvery:16,   // slow harmonic drift — one chord every FOUR bars (muzak, half vaporwave's rate), like walking the length of the concourse before the pad changes
      progressions:["royal_road","dream","pop_1625"], kits:["off","halftime","kick"], fills:["off","downlift"],   // kit mostly OFF now (the band left) — halftime/kick only occasionally
      bass:{patterns:["root","simple","off"], recipe:{model:["saw","sub"],cutoff:[400,700],res:[.05,.15],level:[.8,1],send:[.1,.2],dsend:[0,.08]}},
      lead:{patterns:["sparse","composed","off"], patchPool:["E.PIANO 4","SHIMMER"], samplerPool:["alto_sax"], recipe:{model:["stack","dx7","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[2400,3400],level:[.36,.48],send:[.6,.8],dsend:[.25,.45],vibrato:[.004,.009],attack:.1,release:[.5,.7],sustain:[.85,.95]}},   // ~1/3: the atrium EP/shimmer (alg-5 pair -> morphable); send UP into the atrium
      pads:{prob:1, samplerPool:["ahh_choir"], recipe:{model:["casiocz","casiocz","saw","choir","sampler"],wave:"saw",cutoff:[900,1500],detune:[.004,.01],attack:[2,4],czWave:[0,.25],dcwAttack:[.3,.8],dcwAmount:[.3,.6],mellotron:true,level:[.6,.8],send:[.8,.92],dsend:[.1,.25]},   // the dead-mall tape choir — the ahh_choir plays through the MELLOTRON tape head (the tapeCap "runs out" release fits the stopped-escalator image; matrix-invisible flag)
        inserts:{prob:.6, max:1, pool:[["chorus",{rate:[.15,.35],depth:[.5,.75],mix:[.4,.6]}]]}},   // the empty-atrium shimmer — dreampool chorus on the wash; pad send PUSHED (the wash IS the instrument: .6-.8 -> .8-.92)
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.75,1],snare:[.5,.75],hat:[.6,.9],tune:[.9,1.05],send:[.35,.5],dsend:[0,.1]},   // even the drums drown in the atrium (send .2-.35 -> .35-.5)
      fx:{reverb:[.9,.98], delayBeats:[.75,1.5], delayFb:[.3,.45], delayCut:[2000,3000], pump:[0,.05], crackle:[.1,.3], lowcut:[0,0], highcut:[6000,9000], comp:[0,.15]},   // reverb PUSHED to the ceiling (.88-.96 -> .9-.98) — the cathedral of commerce. Effects audit tier-C soft-top: "heard through two storefronts" = heavily lowpassed (more muffled than vaporwave). Flips softTop 0->1 — safe (mallsoft's 44-56bpm sits below every softTop-positive rival's tempo floor)
      found:{role:"bed", vol:[.28,.4], pitch:[.6,.75], stretch:[.4,.55], cutoff:[2200,3400], sources:["vx_timelady","pool:city*2","pool:voices*2"]},   // the beds PROMINENT — at the tone, the mall will close
      sampleEvents:[{ pool:["vx_timelady","vx_wwvh","sp_plaza"], placement:"buried", gain:.5, treatment:{cutoff:1300, rsend:.55, dsend:.3} }],   // the PA litany BURIED under every measure — announcements muffled through two storefronts (lowpassed 1.3k, drenched), the "heard from two stores away" made literal
      stab:["off"], hits:{sources:["pool:vb_mallsoft_vapor*1","sp_plaza","sp_shopping"], pattern:"sparse", prob:.5},
      form:"wave" },   // WAVE form (was pop) — arrive/drift/swell/recede/depart, drifting past storefronts, no verse/chorus band structure
    wintersynth: { label:"Permafrost Liturgy", info:"A half-time kit at 64-84. Sub bass under an Oberheim pad, with bells. Bare triads, a light shuffle.",   // SYNTH-FORWARD: cold pads carry it
      bpm:[64,84], swing:[0,.05], humanize:[.15,.35],
      progressions:["frost","frost","frost","mode_phrygian"], kits:["halftime","halftime","kick"], fills:["off","downlift"],   // frost triads DOMINANT — seventh≈0 is the fence vs vaporwave/newage
      bass:{patterns:["root","sub","simple"], recipe:{model:["sub"],cutoff:[240,420],res:[.05,.15],level:[.85,1.05],send:[.15,.3],dsend:[0,.08]}},
      lead:{patterns:["wander","arpup","sparse"], patchPool:["TUB BELLS","ORCH-CHIME","CELESTE"], recipe:{model:["bell","fm","dx7"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[2200,3200],level:[.4,.52],send:[.5,.7],dsend:[.25,.4],vibrato:[.002,.006]}},   // icicle bells
      pads:{prob:1, recipe:{model:["oberheim","oberheim","oberheim","choir","strings"],wave:"saw",cutoff:[800,1400],detune:[.005,.012],attack:[2.5,4.5],filterMode:[0,.2],envAmount:[1,1.6],osc2lfo:[.3,.6],obDetune:[8,16],mellotron:true,level:[.6,.8],send:[.55,.78],dsend:[.1,.25]},
        inserts:{prob:.4, max:1, pool:[["chorus",{rate:[.1,.25],depth:[.4,.6],mix:[.3,.5]}]]}},   // the Oberheim SEM snowfield pad (slow poly-mod sweeps), over real choir + strings; ice-crystal chorus barely moving. Effects audit B10: dungeon synth leans hard on tape/mellotron choir — the sampled choir/strings play through the MELLOTRON tape head (icy wow/flutter, byte-stable boolean flag)
      drums:{kickModel:["boom","808"],snareModel:["noise"],hatModel:["noise"],kick:[.75,1],snare:[.4,.6],hat:[.4,.7],tune:[.85,1],send:[.25,.4],dsend:[.05,.2]},
      fx:{reverb:[.8,.92], delayBeats:[1,1.5], delayFb:[.4,.6], delayCut:[1600,2600], pump:[0,.05], crackle:[0,.12], lowcut:[0,20], highcut:[0,0], comp:[.1,.3]},
      found:{role:"bed", vol:[.12,.22], pitch:[.6,.78], stretch:[.45,.6], cutoff:[1800,3000], sources:["pool:road*1","pool:room*1","pool:voices*1"]},   // pitched-down wind stand-ins
      stab:["off"], hits:{sources:["sp_herenow"], pattern:"sparse", prob:.15},
      form:"wave" },
    gabber: { label:"Jackhammer Communion", info:"A four-on-the-floor at 155-185. Acid bass under a saw synth pad, with a hoover stabs lead. A two-chord minor drone, straight time, quantized tight.",   // SYNTH-FORWARD: the KICK is the genre
      bpm:[155,185], swing:[0,.03], humanize:[0,.08],
      progressions:["drone_min","deep_two","mode_phrygian"], kits:["four","techno"], fills:["impact","cut","riser","hat rush","stutter","stutter"],   // BRUTAL: the stutter-gate is very gabber
      bass:{patterns:["stab","drive","rolling"], recipe:{model:["acid","reese"],cutoff:[420,700],res:[.25,.4],level:[1.2,1.4],send:[0,.06],dsend:[0,.08]},
        inserts:{prob:.8, max:1, pool:[["distort",{drive:[.5,.9],mix:[.8,1]}]]}},   // everything into the red — the Rotterdam way
      lead:{patterns:["double","off","arpup"], recipe:{model:["hoover"],wave:"saw",voices:[3,5],spread:[.008,.015],cutoff:[2200,3200],res:[.3,.45],level:[.46,.58],send:[.2,.35],dsend:[.2,.35],attack:.003,release:[.06,.1],sustain:[.5,.62],fenv:[.7,1.2]},
        inserts:{prob:.7, max:2, pool:[["phaser",{rate:[.15,.4],depth:[.5,.7],mix:[.35,.55]}],["distort",{drive:[.5,.85],mix:[.7,1]}]]}},   // the phased Alpha-Juno HOOVER (a SIGNATURE synth model, never sampled — the sampled default would swap a generic stack for a wind fallback), driven into the red — the swirling DISTORTED Rotterdam stab
      pads:{prob:.2, recipe:{model:["saw"],wave:"saw",cutoff:[600,1000],detune:[.008,.016],attack:[.5,1.5],level:[.3,.42],send:[.25,.4],dsend:[.1,.25]}},
      drums:{kickModel:["909"],snareModel:["clap","crack"],hatModel:["metal","noise"],kick:[1.5,1.8],snare:[.7,.95],hat:[.6,.9],tune:[1.05,1.2],send:[.05,.12],dsend:[.05,.15]},   // the kick DISTORTED LOUD (grit does the rest)
      fx:{reverb:[.25,.4], delayBeats:[.375,.5], delayFb:[.25,.4], delayCut:[2200,3400], pump:[.4,.7], crackle:[0,.05], lowcut:[30,45], highcut:[0,0], comp:[.6,.85], grit:[.7,.95], jux:[.15,.35]},
      found:{role:"chops", vol:[.1,.18], pitch:[.9,1.1], stretch:[.4,.6], cutoff:[2200,3600], sources:["factory","vx_xminusone"]},
      stab:["rave","offbeat"], hits:{sources:["pool:vb_rave_hardcore*1","pool:rave_stab*2","bb_stab_a","sp_energy","stml_hit_01","stml_hit_b3"], pattern:"offbeat", prob:.8},
      introMode:"off",   // optional-intro: gabber is brutality — it opens COLD on the machine (drops the dj "warmup" ground node; the solver regrows the groove to still land ~180s). Margin 19 absorbs the bedUse/density shift; matrix-gated.
      form:"dj" },
    psytrance: { label:"Third Eye Turbine", info:"A four-on-the-floor at 140-148. 303 line bass under a saw synth pad, with a sitar. Phrygian, straight time, quantized tight.",   // SYNTH-FORWARD: the bassline is the drug
      bpm:[140,148], swing:[0,.03], humanize:[0,.08],
      progressions:["mode_phrygian","drone_min","deep_two"], kits:["four","pulse"], fills:["riser","cut","impact","hat rush"],
      bass:{patterns:["rolling","sixteenths"], recipe:{model:["tb303","tb303","tb303","tb303","acid"],cutoff:[380,650],res:[.25,.4],envmod:[.55,.8],decay:[.3,.5],waveform:[0,.2],level:[1.2,1.4],send:[0,.05],dsend:[0,.06],release:[.06,.1],fenv:[.8,1.4]},
        inserts:{prob:.8, max:1, pool:[["filtersweep",{rateBars:[2,4],lo:[-1.2,-.6],hi:[1,1.8],res:[.35,.55]}]]}},   // THE rolling line — the true 303 (mono-legato, accent/slide), squelchy and relentless, SWEPT across 2-4 bars (full-power)
      lead:{patterns:["arpup","sparse","hero","wander"], samplerPool:["sitar"], recipe:{model:["stack","stack","pluck","sampler"],wave:"saw",voices:[2,3],spread:[.005,.01],cutoff:[2800,4000],res:[.2,.35],level:[.42,.54],send:[.3,.45],dsend:[.3,.45],attack:.004,release:[.07,.12],sustain:[.55,.68],fenv:[.6,1]},
        inserts:{prob:.5, max:1, pool:[["phaser",{rate:[.1,.3],depth:[.5,.75],mix:[.4,.6]}]]}},   // effects audit A4: Goa/psy leads live on phaser + flanger swirl (the "morning" lead) — the bass already sweeps, now the lead swirls too
      pads:{prob:.7, recipe:{model:["saw"],wave:"saw",cutoff:[1000,1800],detune:[.008,.015],attack:[1,2],level:[.42,.56],send:[.4,.55],dsend:[.15,.3]}},
      drums:{kickModel:["909"],snareModel:["clap","noise"],hatModel:["noise","metal"],kick:[1.3,1.5],snare:[.5,.7],hat:[.8,1.1],tune:[1,1.1],send:[.08,.16],dsend:[.05,.15]},
      fx:{reverb:[.45,.6], delayBeats:[.375,.375], delayFb:[.4,.55], delayCut:[2400,3600], pump:[.35,.6], crackle:[0,.04], lowcut:[30,45], highcut:[0,0], comp:[.5,.7], grit:[.1,.3], jux:[.2,.4]},   // effects audit B11: hard-panned/rotating stereo percussion — psy's signature width. jux is matrix-safe
      found:{role:"bed", vol:[.06,.12], pitch:[.75,.9], stretch:[.45,.6], cutoff:[1800,3000], sources:["pool:road*1","pool:industry*1"]},   // the night road + the generator behind the rig
      stab:["off","sparse"], hits:{sources:["pool:rave_stab*1","sp_energy"], pattern:"sparse", prob:.35},
      form:"dj" },
    minimal: { label:"Anechoic Census", info:"A bare kick at 120-128. Sub bass under a saw synth pad, with a pluck lead. A two-chord minor drone, a light shuffle, quantized tight, euclidean hats.",   // SYNTH-FORWARD: subtraction as composition
      bpm:[120,128], swing:[0,.05], humanize:[0,.1],
      progressions:["drone_min","drone_min","deep_two"], kits:["kick","kick","pulse"], fills:["off","cut","hat rush"],
      euclid:{hat:[5,16]},   // E(5,16) tiny rotating percs — the whole topography
      transforms:{ pool:["rev","degrade","rest","rot"], schedule:"everyN", everyN:8, rate:0.5 },   // Phase 2: subtraction as composition — ONE sparse mutation every 8 bars (never a wall of change), the reductive pool
      bass:{patterns:["rolling","stab","root"], recipe:{model:["sub","saw"],cutoff:[300,520],res:[.1,.2],level:[1,1.2],send:[0,.05],dsend:[0,.08]},
        inserts:{prob:.4, max:1, pool:[["filtersweep",{rateBars:[4,8],lo:[-.6,-.2],hi:[.3,.7],res:[.15,.3]}]]}},   // a whisper of a sweep — the only event for 8 bars, so it matters
      lead:{patterns:["off","off","sparse"], recipe:{model:["pluck"],wave:"sine",voices:[1,1],spread:[.001,.003],cutoff:[2000,3000],level:[.3,.4],send:[.2,.35],dsend:[.3,.5],attack:.003,release:[.04,.08],sustain:[.4,.55],fenv:[.4,.7]}},   // a blip, mostly absent
      pads:{prob:.25, recipe:{model:["saw","organ"],wave:"saw",cutoff:[600,1000],detune:[.004,.009],attack:[1.5,3],level:[.3,.42],send:[.2,.35],dsend:[.1,.2]}},
      drums:{kickModel:["909"],snareModel:["noise"],hatModel:["metal","noise"],kick:[1.2,1.4],snare:[.35,.55],hat:[.6,.9],tune:[1,1.1],send:[.03,.1],dsend:[.1,.25]},
      fx:{reverb:[.2,.35], delayBeats:[.75,.75], delayFb:[.35,.5], delayCut:[2400,3600], pump:[.08,.22], crackle:[0,.08], lowcut:[35,50], highcut:[0,0], comp:[.25,.4], grit:[.05,.2], jux:[.2,.4]},   // pump + comp BELOW techno's floor — the restraint is the point
      found:{role:"chops", vol:[.06,.12], pitch:[.95,1.1], stretch:[.4,.6], cutoff:[2200,3600], sources:["tokyo_station","vx_wwvh"]},
      stab:["off","sparse"], hits:{sources:["sp_system"], pattern:"sparse", prob:.25},
      form:"dj" },
    deephouse: { label:"Benthic Concierge", info:"A four-on-the-floor at 118-124. Sub bass under an FM lead pad, with a muted trumpet. A two-chord vamp, swung.",   // SYNTH-FORWARD sibling of house
      timeFeel:{ pushPullMs:{ hat:-4, bass:6 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — DEEP HOUSE: hats on top, the dub bass sunk behind — the pump turned down to a slow breath
      bpm:[118,124], swing:[.08,.16], humanize:[.05,.18],
      progressions:["deep_two","house_min7","neosoul"], kits:["four","house"], fills:["off","hat rush","riser"],
      bass:{patterns:["rolling","rolling","dub","syncopated"], recipe:{model:["sub"],cutoff:[280,450],res:[.05,.15],level:[1.1,1.3],send:[0,.06],dsend:[0,.05]}},
      lead:{patterns:["pentaup","arpup","sparse"], samplerPool:["muted_trumpet","vibraphone"], recipe:{model:["fm","pluck","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1800,2800],level:[.36,.48],send:[.35,.5],dsend:[.25,.4],attack:.01,release:[.15,.25],sustain:[.65,.78]}},
      pads:{prob:1, patchPool:["E.PIANO 3","E.PIANO 4"], recipe:{model:["fm","organ","dx7"],wave:"sine",cutoff:[700,1200],detune:[.004,.01],attack:[.8,1.8],level:[.48,.62],send:[.35,.5],dsend:[.1,.2]},
        inserts:{prob:.4, max:1, pool:[["phaser",{rate:[.06,.18],depth:[.4,.6],mix:[.3,.5]}]]}},   // dusky, warm, BEHIND the groove — a lazy after-midnight phase
      drums:{kickModel:["909","808"],snareModel:["clap"],hatModel:["noise"],kick:[1.15,1.35],snare:[.5,.75],hat:[.7,1],tune:[.95,1.05],send:[.1,.2],dsend:[.05,.15]},
      fx:{reverb:[.5,.65], delayBeats:[.75,.75], delayFb:[.3,.45], delayCut:[2200,3200], pump:[.15,.35], crackle:[.05,.2], lowcut:[30,45], highcut:[0,0], comp:[.35,.55]},
      found:{role:"bed", vol:[.07,.13], pitch:[.85,1], stretch:[.45,.6], cutoff:[1800,2800], sources:["pool:city*2","pool:voices*1"]},
      stab:["off","sparse"], hits:{sources:["pool:vocal_stab*1","sp_herenow"], pattern:"sparse", prob:.35},
      form:"dj" },
    coldwave: { label:"Unheated Archive", info:"A pulse kit at 100-118. PPG pad bass under a PPG pad, with a stacked saws lead. Bare triads, a light shuffle.",   // SYNTH-FORWARD: dry = the aesthetic
      bpm:[100,118], swing:[0,.06], humanize:[.1,.25],
      progressions:["frost","sad_pop"], kits:["pulse","four"], fills:["drum fill","cut","off"],
      transforms:{ pool:["rest","degrade"], rate:.12 },   // deep pass — MINIMAL-WAVE AUSTERITY: the cheap drum machine is machine-tight (no swing/humanize warp), but ~1/8 of bars the melody sits out (rest) or the hats thin hard (degrade) — the stark subtraction of French coldwave, the arm's-length gap. NOT idm's tangle (no rot/stutter/rev that scramble the grid): coldwave stays rigid and just occasionally goes silent
      bass:{patterns:["drive","octaves","pedal"], recipe:{model:["ppg","ppg","saw","saw","saw"],cutoff:[600,950],res:[.12,.22],scan:[.2,.5],sub:[.3,.6],level:[1.2,1.4],send:[.02,.06],dsend:[0,.05]},
        inserts:{prob:.7, max:1, pool:[["chorus",{rate:[.5,.9],depth:[.5,.7],mix:[.5,.7]}]]}},   // the bass LEADS — ~2/5 the PPG wavetable bass; through the post-punk chorus pedal (the Hook/Cure sound)
      lead:{patterns:["sparse","double","updown"], patchPool:["TUB BELLS","ORCH-CHIME"], recipe:{model:["stack","stack","dx7"],wave:"square",voices:[1,2],spread:[.002,.006],cutoff:[2000,3000],level:[.4,.52],send:[.15,.3],dsend:[.15,.3],attack:.005,release:[.1,.18],sustain:[.6,.72],fenv:[.2,.4]}},   // ~1/3 cold DX7 bells at arm's length (alg-5 pair -> morphable)
      pads:{prob:.7, recipe:{model:["ppg","ppg","ppg","ppg","strings","saw"],wave:"saw",cutoff:[900,1400],detune:[.004,.01],attack:[.8,1.8],scan:[.3,.6],scanEnv:[.2,.5],level:[.35,.48],send:[.15,.3],dsend:[.05,.15]}},   // cold PPG wavetable pad at arm's length; strings/saw the rest
      drums:{kickModel:["boom","909"],snareModel:["noise"],hatModel:["noise"],kick:[1.15,1.35],snare:[.5,.68],hat:[.7,1],tune:[.9,1.05],send:[.05,.12],dsend:[0,.08]},   // DRY drums — no gated wash; deep pass: kick UP + snare recessed = the BASS-FORWARD post-punk mix (the bass leads, the drum machine sits behind it), fencing chinawave's forward "march snare UP" (snareBalance renders .30-.45 vs chinawave's .74-.90)
      fx:{reverb:[.18,.32], delayBeats:[.5,.5], delayFb:[.2,.35], delayCut:[2200,3200], pump:[0,.1], crackle:[.15,.35], lowcut:[25,40], highcut:[0,0], comp:[.25,.45], grit:[.05,.2]},   // cassette hiss instead of reverb
      found:{role:"bed", vol:[.06,.12], pitch:[.8,.95], stretch:[.45,.6], cutoff:[1500,2500], sources:["pool:industry*1","pool:road*1"]},
      stab:["off"], hits:{sources:["sp_pressure","pool:vocal_stab*1"], pattern:"sparse", prob:.3},
      form:"pop" },
    ebm: { label:"Piston Catechism", info:"A pulse kit at 118-130. Reese bass under a saw synth pad, with a stacked saws lead. A two-chord vamp, straight time, quantized tight.",   // SYNTH-FORWARD: the sequencer is the muscle
      bpm:[118,130], swing:[0,.04], humanize:[0,.1],
      progressions:["deep_two","mode_phrygian","drone_min"], kits:["pulse","techno"], fills:["cut","impact","hat rush","stutter"],
      bass:{patterns:["sixteenths","stab","drive","pedal"], recipe:{model:["reese","acid"],cutoff:[350,560],res:[.2,.35],level:[1.2,1.4],send:[0,.06],dsend:[0,.08],release:[.05,.09],fenv:[.5,.9]},
        inserts:{prob:.7, max:1, pool:[["distort",{drive:[.35,.65],mix:[.7,1]}]]}},   // THE 16th piston line, overdriven — body music muscle
      lead:{patterns:["double","sparse","off"], recipe:{model:["stack","vocoder"],wave:"square",voices:[1,2],spread:[.003,.007],cutoff:[2200,3200],res:[.25,.4],level:[.42,.54],send:[.15,.3],dsend:[.2,.35],attack:.003,release:[.05,.09],sustain:[.5,.62],fenv:[.5,.9]}},   // barked vocoder stabs
      vocSource:"sp_pressure",
      pads:{prob:.3, recipe:{model:["saw"],wave:"saw",cutoff:[700,1100],detune:[.005,.011],attack:[.5,1.5],level:[.3,.42],send:[.2,.35],dsend:[.1,.2]}},
      drums:{kickModel:["909"],snareModel:["clap","crack"],hatModel:["metal"],kick:[1.3,1.5],snare:[.85,1.1],hat:[.7,1],tune:[.9,1.05],send:[.05,.12],dsend:[.1,.25]},
      fx:{reverb:[.3,.45], delayBeats:[.5,.5], delayFb:[.25,.4], delayCut:[2200,3400], pump:[.2,.45], crackle:[0,.06], lowcut:[30,45], highcut:[0,0], comp:[.5,.7], grit:[.4,.7], jux:[.15,.35]},
      found:{role:"bed", vol:[.08,.15], pitch:[.75,.9], stretch:[.45,.6], cutoff:[1800,3000], sources:["pool:industry*1","pool:voices*1"]},   // the plant hums BEHIND (industrial owns the chops)
      stab:["offbeat","sparse"], hits:{sources:["pool:vb_industrial_machine*1","sp_pressure","sp_system","pool:rave_stab*1"], pattern:"dub", prob:.6},
      form:"dj" },
    krautrock: { label:"Eternal Merge Lane", info:"A pulse kit at 102-118. Saw synth bass under a church organ, with a stacked saws lead. A funk vamp, a light shuffle.",   // SYNTH-FORWARD: repetition is the destination
      bpm:[102,118], swing:[0,.05], humanize:[.05,.18],
      progressions:["funk_vamp","deep_two","mode_mixo"], kits:["pulse","four"], fills:["off","drum fill","riser"],
      bass:{patterns:["drive","root","pedal"], recipe:{model:["saw","modeld"],cutoff:[600,950],res:[.1,.18],level:[1.05,1.25],send:[.03,.08],dsend:[0,.05],
        glide:[20,40],envAmount:[.4,1],envDecay:[.25,.5],oscMix:[.1,.4],drift:[5,10]}},   // half the seeds: a droning Model-D under the motorik — shallow slow filter env, more drift than punch (the eternal pulse breathes)
      lead:{patterns:["motorik","wander","sparse"], recipe:{model:["stack","organ"],wave:"square",voices:[1,2],spread:[.002,.006],cutoff:[2200,3200],level:[.42,.54],send:[.2,.35],dsend:[.25,.4],attack:.005,release:[.08,.14],sustain:[.6,.72]}},   // the sequencer arp borrowed back from transitwave
      pads:{prob:1, patchPool:["E.ORGAN 2","E.ORGAN 3","60-S ORGAN"], samplerPool:["church_organ","percussive_organ"], recipe:{model:["hammond","hammond","hammond","organ","dx7","sampler"],wave:"saw",cutoff:[800,1300],detune:[.004,.01],attack:[1.5,3],bar513:0,bar4:0,bar135:0,leslie:[.1,.2],perc:0,level:[.5,.65],send:[.3,.45],dsend:[.1,.2]},
        inserts:{prob:.6, max:1, pool:[["phaser",{rate:[.1,.3],depth:[.5,.8],mix:[.4,.6]}]]}},   // ORGAN DRONES — the Hammond B-3 drone (808000000, near-still Leslie), the harmonium in the barn, through the kosmische phaser (Autobahn-issue)
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[1.1,1.3],snare:[.55,.8],hat:[.8,1.1],tune:[.95,1.05],send:[.08,.16],dsend:[0,.08]},   // dry live-room motorik
      fx:{reverb:[.3,.45], delayBeats:[.5,.75], delayFb:[.25,.4], delayCut:[2400,3600], pump:[0,.1], crackle:[.1,.25], lowcut:[25,40], highcut:[0,0], comp:[.25,.45], grit:[.05,.2]},
      found:{role:"bed", vol:[.15,.25], pitch:[.85,1], stretch:[.45,.6], cutoff:[2000,3200], sources:["highway_night","pool:industry*1"]},   // the autobahn ITSELF, near natural pitch
      stab:["off"], hits:{sources:["sp_herenow","pool:vocal_stab*1"], pattern:"sparse", prob:.25},
      form:"dj" },
    newjack: { label:"Chrome Cotillion", info:"A swingbeat kit at 100-115. Fretless bass under an organ, with a clavinet. A min7 house vamp, hard swing.",   // SYNTH-FORWARD: the drum program is the producer's signature
      timeFeel:{ pushPullMs:{ bass:-4, snare:6, clap:6 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — FUNK/swingbeat: FM bass on top, those HUGE claps landing fat and late
      bpm:[100,115], swing:[.16,.28], humanize:[.1,.25],
      progressions:["house_min7","funk_vamp","neosoul"], kits:["newjack"], fills:["drum fill","hat rush","riser","snare roll"],
      bass:{patterns:["stab","melodic","dub","syncopated"], patchPool:["SYN-BASS 2","BASS    2"], samplerPool:["fretless_bass"], recipe:{model:["dx7","saw","sampler"],cutoff:[400,540],res:[.1,.2],level:[1.05,1.25],send:[0,.06],dsend:[0,.06]},   // the DX7 SYN-BASS pair (alg 17 both -> morphable) — Teddy Riley's engine room
        inserts:{prob:.4, max:1, pool:[["wah",{sens:[.5,.7],base:[260,380],range:[1.6,2.4],q:[3.5,5.5],mix:[.6,.7]}]]}},   // fx wings stage 3: auto-wah on the DX7/saw synth-bass stabs — swingbeat funk (dropped on the fretless sampler seeds). BALANCE LOOP 3 wah trim: mix capped at .6-.7 (full-wet wah trims the bass)
      lead:{patterns:["pentaup","double","updown"], patchPool:["CLAV-E.PNO"], samplerPool:["clavinet","clavinet","bright_yamaha_grand"], recipe:{model:["fm","dx7","sampler"],wave:"pulse",voices:[1,2],spread:[.002,.005],cutoff:[2600,3600],level:[.44,.56],send:[.25,.4],dsend:[.2,.35],attack:.004,release:[.07,.12],sustain:[.6,.72],fenv:[.3,.6]},
        inserts:{prob:.5, max:1, pool:[["chorus",{rate:[.6,1.1],depth:[.4,.6],mix:[.4,.55]}]]}},   // grinning FM keys, chorused wide
      pads:{prob:.8, recipe:{model:["organ"],wave:"saw",cutoff:[1100,1700],detune:[.003,.008],attack:[.15,.5],level:[.42,.56],send:[.25,.4],dsend:[.05,.15]}},   // stabby ORGAN hits, always — the church chord under the swing (and the fence vs all-synth transitwave)
      drums:{kickModel:["909","boom"],snareModel:["clap"],hatModel:["noise"],kick:[1.1,1.3],snare:[1,1.25],hat:[.8,1.1],tune:[.95,1.1],send:[.15,.25],dsend:[.05,.15]},   // the CLAP is the star
      fx:{reverb:[.35,.5], delayBeats:[.375,.5], delayFb:[.2,.35], delayCut:[2600,3800], pump:[.05,.2], crackle:[0,.12], lowcut:[30,45], highcut:[0,0], comp:[.35,.55]},
      found:{role:"bed", vol:[.06,.12], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[1800,2800], sources:["pool:city*1","pool:voices*1"]},
      stab:["off","sparse"], hits:{sources:["pool:vocal_stab*1","sp_rhythm","pool:rave_stab*1"], pattern:"offbeat", prob:.6},
      form:"vamp" },
    breakcore: { label:"Shrapnel Lullaby", info:"A jungle kit at 172-198. Sub bass under a saw synth pad, with a pluck lead. A descending minor run, a light shuffle, loose timing, euclidean hats.",   // SAMPLE-FORWARD: the break, weaponized
      bpm:[172,198], swing:[0,.06], humanize:[.2,.4],
      progressions:["minor_run","mode_phrygian","deep_two"], kits:["jungle","breaks"], fills:["break fill","impact","cut","noise","stutter"],
      euclid:{kick:[5,16]},   // E(5,16) kicks punching THROUGH the amen
      transforms:{ pool:["stutter","rot"], rate:.15 },   // effects audit B8: the info string promises "euclid kicks fighting the chops … never repeats" yet the genre only had fills + per-chord re-slicing. A low-rate stutter/rot IS the glitch signature (cf. darksynth .16, idm .5) — kept low so the amen still reads. Matrix-gated (transforms move variation/drumDensity/hatDensity)
      bass:{patterns:["sub","stab","dub"], recipe:{model:["sub","reese"],cutoff:[240,440],res:[.1,.25],level:[1.2,1.45],send:[0,.05],dsend:[0,.08]},
        inserts:{prob:.5, max:1, pool:[["distort",{drive:[.4,.8],mix:[.6,.9]}]]}},   // the reese shredded along with the break
      lead:{patterns:["off","sparse","double"], recipe:{model:["pluck","fuzz"],wave:"saw",voices:[1,2],spread:[.003,.008],cutoff:[2400,3600],res:[.2,.35],level:[.4,.52],send:[.25,.4],dsend:[.3,.5],attack:.003,release:[.05,.09],sustain:[.5,.62],fenv:[.5,.9]}},
      pads:{prob:.2, recipe:{model:["saw"],wave:"saw",cutoff:[600,1000],detune:[.008,.016],attack:[1,2.5],level:[.3,.42],send:[.35,.5],dsend:[.15,.3]}},
      drums:{kickModel:["909","808"],snareModel:["crack"],hatModel:["noise","metal"],kick:[1.3,1.55],snare:[.8,1.05],hat:[.5,.8],tune:[1.05,1.2],send:[.05,.12],dsend:[.15,.35]},
      fx:{reverb:[.3,.5], delayBeats:[.375,.75], delayFb:[.35,.5], delayCut:[2000,3200], pump:[.05,.25], crackle:[0,.15], lowcut:[25,40], highcut:[0,0], comp:[.55,.8], grit:[.4,.7], jux:[.45,.75]},   // stereo chaos
      found:{role:"break", vol:[.32,.45], pitch:[1,1], stretch:[.5,.5], cutoff:[6000,9000], sources:["amen_165","amen_170","amen_172","amen_175","stml_loop_148a","stml_loop_157a","stml_loop_157b","stml_loop_161a","stml_loop_167a"]},   // the break LOUD, wide open, re-sliced every chord
      stab:["rave","offbeat"], hits:{sources:["pool:vb_junglist*1","pool:rave_stab*2","bb_stab_b","sp_rewind"], pattern:"dub", prob:.85},
      introMode:"off",   // optional-intro (drop form): no wind-up — the amen slams in cold (drops the drop "intro" ground node; solver regrows the drops to hold ~180s). Margin +6.2 vs jungle absorbs the -0.2 shift; matrix-gated.
      form:"drop" },
    acidhouse: { label:"Titration Rapture", info:"A four-on-the-floor at 118-126. 303 line bass under an organ, with a 303 line lead. A min7 house vamp, a light shuffle.",   // SYNTH-FORWARD: one machine, misused, forever
      bpm:[118,126], swing:[0,.08], humanize:[.05,.15],
      progressions:["house_min7","drone_min","funk_vamp"], kits:["house","four"], fills:["hat rush","riser","cut"],
      bass:{patterns:["sixteenths","rolling","sixteenths","stab"], recipe:{model:["tb303"],cutoff:[420,700],res:[.55,.75],envmod:[.55,.85],decay:[.35,.6],waveform:[0,.15],level:[1.15,1.35],send:[0,.06],dsend:[0,.1],release:[.08,.14],fenv:[1,2]},
        inserts:{prob:.75, max:1, pool:[["filtersweep",{rateBars:[1,2],lo:[-.8,-.3],hi:[1,1.6],res:[.4,.6]}]]}},   // THE 303 (the true one: mono-legato, per-note accent + slide) — resonance and envmod cranked, the squelch; the knob-rider sweeps it every bar or two
      lead:{patterns:["double","sparse","double","off"], recipe:{model:["tb303","tb303","pluck"],wave:"square",voices:[1,2],spread:[.002,.005],cutoff:[2400,3400],envmod:[.4,.7],decay:[.2,.4],level:[.36,.48],send:[.2,.35],dsend:[.2,.35],attack:.004,release:[.06,.1],sustain:[.5,.62],fenvAmount:[1.4,2.2],fenvDecay:[.1,.16]}},   // ~2/3 the 303 doubling as the acid LEAD line; square pluck the rest — BALANCE LOOP 3: the pluck seeds claim the UNIFIED fenv squelch (octave-scale within-note zap, replaces the legacy multiplier fenv so envelopes never stack; tb303 ignores it — envmod IS its contract)
      pads:{prob:.35, recipe:{model:["organ","saw"],wave:"saw",cutoff:[800,1300],detune:[.004,.009],attack:[.2,.6],level:[.34,.46],send:[.25,.4],dsend:[.1,.2]}},
      drums:{kickModel:["909"],snareModel:["clap"],hatModel:["noise"],kick:[1.15,1.35],snare:[1,1.25],hat:[.9,1.2],tune:[.95,1.1],send:[.1,.2],dsend:[.05,.15]},
      fx:{reverb:[.35,.5], delayBeats:[.5,.75], delayFb:[.25,.4], delayCut:[2400,3600], pump:[.3,.5], crackle:[.1,.28], lowcut:[30,45], highcut:[0,0], comp:[.4,.6]},   // warehouse dust on the record
      found:{role:"bed", vol:[.06,.12], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[1800,2800], sources:["pool:city*2"]},
      stab:["rave","offbeat"], hits:{sources:["pool:rave_stab*2","sp_rhythm"], pattern:"offbeat", prob:.7},
      form:"dj" },
    surfrock: { label:"Undertow Sock Hop", info:"AN open kit at 126-144. Saw synth bass under an organ, with a steel string guitar. Doo-wop changes, swung.",   // guitar-FORWARD: the spring tank is the room
      reverbColor:"spring",   // fx wings: the boing/flutter spring tank IS surf rock's room
      bpm:[126,144], swing:[.06,.14], humanize:[.15,.35],
      progressions:["doo_wop","sad_pop","andalusian"], kits:["open","four"], fills:["drum fill","tom fill","tom cascade","hat rush"],   // VARIETY: + tom cascade (surf drumming loves the hi->lo tom run down the kit)
      bass:{patterns:["walking","octaves"], recipe:{model:["saw"],cutoff:[600,950],res:[.08,.16],level:[1,1.2],send:[.03,.08],dsend:[0,.05]}},
      lead:{patterns:["double","updown","hero"], samplerPool:["steel_string_guitar","jazz_guitar"], recipe:{model:["sampler","sampler","sampler","guitar"],wave:"saw",voices:[1,2],spread:[.001,.004],cutoff:[3000,4200],level:[.52,.64],send:[.35,.5],dsend:[.1,.2],vibrato:[.006,.012],vibRate:[6,7.5]},
        inserts:{prob:.5, max:1, pool:[["tremolo",{rate:[4,7],depth:[.5,.7],shape:[.2,.5],wobble:[0,0],mix:[.6,.85]}]]}},   // effects audit C (module built d924567): the DEFINING Fender-amp tremolo — bias/opto AM at 4-7Hz, moderate-deep, wobble 0 (no fan). Fires on the waveguide "guitar" draw (the amp'd electric); the sampled steel/jazz strings render clean. RING-CLASS pass: only the reverb-send lifted (.3-.45 -> .35-.5, more twang into the spring tank) — surfrock rides an ultra-tight klezmer/perukelotto margin, so no rng-shifting insert/field was added
      pads:{prob:.4, recipe:{model:["organ"],wave:"saw",cutoff:[1200,1800],detune:[.003,.008],attack:[.1,.4],level:[.36,.48],send:[.2,.35],dsend:[.05,.12]},
        inserts:{prob:.6, max:1, pool:[["tremolo",{rate:[4,6],depth:[.4,.6],shape:[.2,.4],wobble:[0,0],mix:[.5,.75]}]]}},   // a Farfisa in the corner — through the same amp tremolo the surf combo ran (the lead-guitar trem fires only on the rarer waveguide-electric draws; this keeps surf's DEFINING amplitude-modulation reliably present, organ isn't sampler-skipped)
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[1,1.2],snare:[.85,1.1],hat:[.8,1.1],tune:[.95,1.1],send:[.2,.32],dsend:[0,.08]},
      fx:{reverb:[.4,.55], delayBeats:[.375,.375], delayFb:[.15,.28], delayCut:[2600,3800], pump:[0,.08], crackle:[.15,.35], lowcut:[25,40], highcut:[0,0], comp:[.2,.4], grit:[0,.1]},   // short slapback = the spring tank
      found:{role:"bed", vol:[.1,.18], pitch:[.9,1], stretch:[.45,.6], cutoff:[2400,3800], sources:["pool:water*1","pool:road*1"]},   // water column + highway wash read as surf, near natural pitch
      stab:["off"], hits:{sources:["pool:vocal_stab*1","sp_rhythm"], pattern:"sparse", prob:.4},
      form:"pop" },
    spacelounge: { label:"Martini Parallax", info:"A bare kick at 86-100. Sub bass under an organ, with a clarinet. Dream changes, swung, loose timing.",   // sample-mid: mission audio as furniture
      reverbColor:"dattorro",   // effects audit B9: space-age bachelor-pad pop (Esquivel, Les Baxter) is drenched in a BRIGHT plate/chamber — the martini cosmos, not a dark generic hall. Zero rng, dominant-parent
      bpm:[86,100], swing:[.1,.2], humanize:[.2,.4],   // above downtempo's 60-90 core
      progressions:["dream","mode_lydian","ii_v_i"], kits:["kick","kick","halftime"], fills:["off","downlift"],
      bass:{patterns:["simple","root","walking"], recipe:{model:["sub","piano"],cutoff:[350,650],res:[.05,.12],level:[.85,1.05],send:[.08,.16],dsend:[0,.06]}},
      lead:{patterns:["wander","sparse","pentaup"], samplerPool:["clarinet","flute","vibraphone","celesta"], recipe:{model:["sampler","sampler","sampler","stack","modeld"],wave:"sine",voices:[1,1],spread:[.001,.003],cutoff:[2600,3800],level:[.44,.56],send:[.45,.65],dsend:[.2,.35],vibrato:[.014,.022],vibRate:[5.5,6.5],attack:.06,release:[.3,.5],sustain:[.85,.95],
        glide:[80,150],envAmount:[.5,1.2],envDecay:[.3,.6],oscMix:[0,.3],drift:[6,12],drive:[.05,.2]}},   // a REAL clarinet/flute takes the melody 3/5 of seeds; the theremin-sine keeps its corner, and 1/5: a soft gliding Model-D — the ondes-martenot swoop, long portamento
      pads:{prob:1, recipe:{model:["organ"],wave:"saw",cutoff:[1000,1600],detune:[.003,.008],attack:[1.5,3],level:[.5,.65],send:[.5,.7],dsend:[.1,.2]},
        inserts:{prob:.35, max:1, pool:[["phaser",{rate:[.05,.15],depth:[.4,.6],mix:[.3,.45]}]]}},   // ALWAYS the organ — the acoustic fence vs downtempo/vaporwave; a lava-lamp phase, sometimes
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.7,.95],snare:[.4,.6],hat:[.5,.8],tune:[.95,1.1],send:[.2,.35],dsend:[0,.1],kit:"jazz"},   // SAMPLED jazz kit — soft lounge combo
      fx:{reverb:[.7,.85], delayBeats:[.75,1], delayFb:[.3,.45], delayCut:[2200,3200], pump:[0,0], crackle:[.08,.22], lowcut:[0,20], highcut:[0,0], comp:[.05,.2]},
      found:{role:"bed", vol:[.18,.3], pitch:[.8,.95], stretch:[.45,.6], cutoff:[2400,3800], sources:["vx_apollo","hvac_hum","pool:voices*1"]},   // Houston + cabin life-support hum, softly, under the vibraphone lights
      stab:["off"], hits:{sources:["pool:vb_cosmic_space*1","sp_herenow","vox_b"], pattern:"sparse", prob:.3},
      // exotica/spacelounge split — THE MISSION-CONTROL ANSWER: where exotica's band
      // answers with bright dry BIRDS, the bachelor-pad-in-orbit answers with muffled, drenched
      // TELEMETRY. Apollo capcom + WWVH time-station beeps surface from the bed as an intermittent
      // "response" whisper (back half of each chord bar, ~30% of bars), radio-banded (cutoff 1.6k)
      // and WIDE-WET (rsend .5 — the orbit's width, the brief's electronics-vs-acoustic fence).
      // Additive found-layer; no verifier feature moves; only spacelounge's own fixtures drift.
      sampleEvents:[{ pool:["vx_apollo","vx_wwvh"], placement:"response", sections:"verse|chorus|bridge|hook", prob:.3, gain:.4, treatment:{pitch:1, cutoff:1600, rsend:.5, dsend:.3} }],
      form:"pop" },
    // ---- world cluster (honest interpretations; source-shelf gaps noted per anchor) ----
    arabpop: { label:"Sirocco Telemetry", info:"A tribal kit at 95-115. Saw synth bass under strings, with an oboe. A hijaz maqam, a light shuffle, euclidean hats.",   // INTERPRETATION: no oud/qanun models — brass+fm ornaments carry the maqam flavor
      bpm:[95,115], swing:[.02,.1], humanize:[.15,.3],
      progressions:["hijaz","hijaz","andalusian","mode_phrygian"], kits:["tribal","breaks"], fills:["drum fill","tom fill","off"],
      euclid:{kick:[5,16]},   // E(5,16) dum-tek placement rotating under the hand drums
      bass:{patterns:["root","simple","octaves"], recipe:{model:["saw","sub"],cutoff:[450,750],res:[.08,.16],level:[.95,1.15],send:[.05,.12],dsend:[0,.06]}},
      lead:{patterns:["wander","updown","wander","sparse"], samplerPool:["oboe","clarinet","sitar"], recipe:{model:["fm","sampler","sampler","sampler"],wave:"sine",voices:[1,1],spread:[.002,.005],cutoff:[2400,3400],level:[.5,.62],send:[.3,.45],dsend:[.2,.35],vibrato:[.014,.024],vibRate:[6,7.5]}},   // STRONG-SAMPLE: the synth "brass" dropped — 3/4 real double-reed/oud-color leads (oboe/clarinet/sitar) carry the maqam; fm keeps one ornament seed   // arabpop deep pass — the ORNAMENTED MONOPHONIC LINE: maqam melody is a SINGLE voice (mizmar/oud), so voices locked to 1 (was [1,2]); vibrato deepened .012-.02 -> .014-.024 = the mawwal melisma (the shelf can't quarter-tone, so a fast deep hand-vibrato carries the microtonal inflection); patterns weighted to the stepwise wander/updown contour (dropped the pentatonic-up leap — maqam moves by conjunct step and ornament, not arpeggio)
      pads:{prob:.9, samplerPool:["strings"], recipe:{model:["strings","choir","sampler"],wave:"saw",cutoff:[1000,1600],detune:[.004,.01],attack:[.8,1.8],level:[.45,.6],send:[.3,.45],dsend:[.1,.2]}},
      drums:{kickModel:["808","boom"],snareModel:["crack"],hatModel:["noise"],kick:[1.1,1.3],snare:[.7,.95],hat:[.9,1.2],tune:[1.05,1.2],send:[.1,.2],dsend:[.1,.25]},   // tuned UP = the tek ringing
      fx:{reverb:[.45,.6], delayBeats:[.5,.75], delayFb:[.25,.4], delayCut:[2200,3400], pump:[0,.1], crackle:[.05,.2], lowcut:[25,40], highcut:[0,0], comp:[.25,.45]},
      found:{role:"bed", vol:[.08,.15], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[2000,3200], sources:["pool:city*1","pool:road*1"]},   // HONESTY: no Arab-world recording on the shelf yet — generic city/night beds sit far back
      stab:["off"], hits:{sources:["pool:vocal_stab*1","sp_rhythm"], pattern:"sparse", prob:.4},
      form:"pop" },
    tango: { label:"Habanera Tribunal", info:"A bare kick at 100-124. Acoustic bass under pizzicato strings, with a bandoneon. An andalusian cadence, a light shuffle, loose timing, rubato.",   // acoustic-FORWARD: ear-fix — the SYNTH voices are out of the front line
      reverbColor:"fdn",   // fx wings: a dry room (freeverb), not a wash — the salon
      bpm:[100,124], swing:[0,.06], humanize:[.3,.55],
      progressions:["andalusian","andalusian","minor_run"],   // STRICTLY minor. frost PURGED (it was the verifier's triad fence, but it read as wintersynth pads by ear — the human heard it)
      kits:["kick","off"], fills:["off","downlift"],
      bass:{patterns:["habanera"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sampler","piano"],cutoff:[700,1200],res:[.05,.12],level:[1,1.2],send:[.06,.12],dsend:[0,.05]}},   // DUM..da-DUM-DUM — the orquesta típica CONTRABASS (real upright, 2/3 of seeds) beside the piano left hand; bass unread by acoustic, cutoff keeps sub=.2 (matrix-invisible)
      lead:{patterns:["canon","wander","sparse"], samplerPool:["bandoneon","bandoneon","nylon_string_guitar"], recipe:{model:["sampler"],wave:"sine",voices:[1,2],spread:[.001,.003],cutoff:[2600,3800],level:[.55,.68],send:[.22,.34],dsend:[.02,.08],attack:.006,release:[.06,.11],sustain:[.5,.62]}},   // THE BANDONEON (FluidR3 GM 23), hard staccato, 2/3 of seeds; the Gardel-quartet nylon guitar leads the rest
      pads:{prob:.3, samplerPool:["pizzicato_strings","strings","nylon_string_guitar"], recipe:{model:["sampler","strings"],wave:"saw",cutoff:[1100,1700],detune:[.003,.008],attack:[.1,.3],level:[.28,.38],send:[.18,.3],dsend:[.03,.1]}},   // mostly ABSENT; when present: quiet fast-attack section stabs — the "dry marcato strings" made LITERAL (real Pizzicato Strings GM 45), sampled ensemble or nylon-guitar comping, never a wash
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.6,.85],snare:[.4,.6],hat:[.3,.5],tune:[.95,1.1],send:[.1,.2],dsend:[0,.05]},
      fx:{reverb:[.3,.42], delayBeats:[.5,.75], delayFb:[.08,.16], delayCut:[2200,3200], pump:[0,0], crackle:[.15,.35], lowcut:[0,25], highcut:[0,0], comp:[.1,.3]},   // DRY band, no echo wash — the milonga room, not the cathedral
      found:{role:"bed", vol:[.06,.12], pitch:[.8,.95], stretch:[.45,.6], cutoff:[1800,2800], sources:["vx_suspense","pool:city*1"]},   // old-radio air stands in, low (the bandoneon itself is real now)
      rubato:{depth:[.02,.035], periodBars:[2,4], prob:.5},   // half the seeds breathe — tango rubato is real but the habanera stays the law
      transforms:{ pool:["rest"], rate:0.05 },   // Phase 2: "dramatic silence" as law — very rarely (5%) the bandoneon line drops out for a bar; the habanera bass carries it
      stab:["off"], hits:{sources:["pool:horn_stab*1","blues_vox_78"], pattern:"sparse", prob:.35},
      form:"pop" },
    afrobeat: { label:"Polyrhythm Senate", info:"A tribal kit at 100-114. Saw synth bass under an organ, with a trumpet. A funk vamp, swung, euclidean hats.",   // groove-FORWARD: Fela's arithmetic
      timeFeel:{ pushPullMs:{ snare:7, hat:-4, perc:-3 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — AFROBEAT: the Tony Allen split — a snare well behind the beat under hats and interlocking percussion that are fractionally ahead of it
      bpm:[100,114], swing:[.04,.12], humanize:[.15,.3],   // below disco's 106-124 core
      progressions:["funk_vamp","mode_dorian","house_min"], kits:["tribal","house"], fills:["drum fill","hat rush","off"],
      euclid:{kick:[3,16],hat:[11,16]},   // tresillo kicks INTERLOCKING with E(11,16) shekere hats — two clocks arguing politely
      bass:{patterns:["melodic","dub","stab","syncopated"], recipe:{model:["saw","sub"],cutoff:[500,850],res:[.08,.16],level:[1.05,1.25],send:[.03,.08],dsend:[0,.05]},
        inserts:{prob:.4, max:1, pool:[["wah",{sens:[.5,.72],base:[260,400],range:[1.8,2.6],q:[4,6.5],mix:[.7,.9]}]]}},   // fx wings stage 3: Fela's wah — the auto-wah envelope filter on the melodic/syncopated bass groove
      lead:{patterns:["double","pentaup","sparse"], samplerPool:["trumpet","tenor_sax","trombone"], recipe:{model:["sampler","sampler","sampler"],wave:"saw",voices:[1,2],spread:[.002,.005],cutoff:[2800,3800],level:[.5,.62],send:[.25,.4],dsend:[.1,.2],attack:.01}},   // STRONG-SAMPLE: the synth "brass" dropped — the HORN SECTION is now real trumpet/sax/trombone every seed (.8, at afrobeat's [.4,.8] cap)
      pads:{prob:.9, patchPool:["MARIMBA","LOG DRUM"], recipe:{model:["organ","organ","dx7"],wave:"saw",cutoff:[1100,1700],detune:[.003,.008],attack:[.1,.4],level:[.46,.6],send:[.2,.35],dsend:[.05,.12]},
        inserts:{prob:.4, max:1, pool:[["phaser",{rate:[.1,.3],depth:[.5,.7],mix:[.35,.55]}]]}},   // effects audit B2: Fela's Africa 70 keys (Farfisa/clavinet) were phaser- and wah-soaked — the bass got the Mutron, now the organ stabs get the phase. Tight organ stabs; ~1/3 DX7 marimba/log-drum comping
      drums:{kickModel:["boom","808"],snareModel:["noise","crack"],hatModel:["noise"],kick:[1.05,1.25],snare:[.6,.85],hat:[1,1.3],tune:[1,1.1],send:[.08,.16],dsend:[.05,.12]},
      fx:{reverb:[.3,.45], delayBeats:[.5,.75], delayFb:[.2,.35], delayCut:[2600,3800], pump:[0,.1], crackle:[.1,.25], lowcut:[25,40], highcut:[0,0], comp:[.3,.5]},
      found:{role:"bed", vol:[.1,.18], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[2200,3400], sources:["pool:road*1","pool:city*1"]},   // HONESTY: no Lagos shelf — night traffic + street stand in quietly
      stab:["off","sparse"], hits:{sources:["pool:horn_stab*1","sp_rhythm","pool:vocal_stab*1"], pattern:"offbeat", prob:.7},   // the 78rpm horns finally play a section part
      form:"vamp" },
    desertblues: { label:"Dune Recursion", info:"A shuffle at 84-104. Sub bass under an organ, with a steel string guitar. A funk vamp, swung, loose timing.",   // guitar-FORWARD: one riff, circling
      timeFeel:{ pushPullMs:{ bass:7, snare:6 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — THE CAMEL LOPE: hypnosis needs a bass that never quite arrives — pentatonic loops that refuse to resolve over a backbeat that refuses to hurry
      bpm:[84,104], swing:[.06,.16], humanize:[.2,.4],
      progressions:["funk_vamp","mode_dorian","deep_two"], kits:["shuffle","halftime","boombap"], fills:["off","off","drum fill"],   // the triplet shuffle lopes 1/3 of seeds
      bass:{patterns:["simple","dub","root"], recipe:{model:["sub"],cutoff:[300,520],res:[.05,.12],level:[1,1.2],send:[.03,.08],dsend:[0,.05]}},
      lead:{patterns:["pentaup","blues","wander"], samplerPool:["steel_string_guitar","nylon_string_guitar","harmonica"], recipe:{model:["sampler","sampler","sampler","guitar"],wave:"saw",voices:[1,2],spread:[.001,.004],cutoff:[3000,4200],level:[.52,.64],send:[.3,.45],dsend:[.15,.3],vibrato:[.004,.009],release:[.3,.5]},
        inserts:{prob:.55, max:2, pool:[["chorus",{rate:[.4,.9],depth:[.35,.55],mix:[.3,.5]}],["delay",{timeBars:[.375,.5],feedback:[.3,.45],tone:[2800,3600],wow:[.15,.3],mix:[.3,.45]}]]}},   // effects audit B1: Tuareg "assouf" electric guitar (Tinariwen, Bombino) runs through chorus — the circling riff's shimmer (fires on the waveguide "guitar" draw; the sampled steel/nylon strings render clean, native-path). RING-CLASS: + a circling tape delay so the pentatonic loop echoes and refuses to resolve
      pads:{prob:.5, recipe:{model:["organ"],wave:"saw",cutoff:[900,1400],detune:[.003,.008],attack:[.5,1.2],level:[.36,.48],send:[.28,.42],dsend:[.05,.15]}},
      drums:{kickModel:["808","boom"],snareModel:["noise"],hatModel:["noise"],kick:[1,1.2],snare:[.55,.8],hat:[.6,.9],tune:[.9,1.05],send:[.1,.2],dsend:[.05,.15]},
      fx:{reverb:[.4,.55], delayBeats:[.5,.75], delayFb:[.2,.35], delayCut:[2000,3000], pump:[0,.05], crackle:[.2,.45], lowcut:[0,30], highcut:[8000,12000], comp:[.15,.35]},   // tape-worn: hiss + soft top
      found:{role:"bed", vol:[.12,.2], pitch:[.8,.95], stretch:[.45,.6], cutoff:[1800,3000], sources:["pool:road*1","pool:room*1"]},   // HONESTY: no Sahara shelf — wind-adjacent beds pitched down
      stab:["off"], hits:{sources:["pool:vb_jazz_blues*1","blues_vox_78","pool:vocal_stab*1"], pattern:"sparse", prob:.4},
      form:"vamp" },
    // ---- harder cluster (fuzz/grit the engine can voice HONESTLY — riffs, not fake shredding) ----
    sludgemetal: { label:"Molasses Avalanche", info:"A half-time kit at 52-70. Reese bass under a saw synth pad, with a crunch guitar. Phrygian, a light shuffle.",   // fuzz-FORWARD: the riff exhales, the room shakes
      bpm:[52,70], swing:[0,.06], humanize:[.1,.3],
      timeFeel:{ pushPull:{ kick:.03, snare:.045, bass:.055 } },   // deep pass — THE DOOM DRAG: the whole band plays BEHIND the beat, the bass draggiest (the amp about to die pulls the riff late). A per-voice offset drawn from timeFeel (pure feel — no verifier feature reads onset timing, so byte-stable to the matrix), it's the crawling lurch that half-time bpm alone can't give: the riff EXHALES between the stomps
      progressions:["mode_phrygian","drone_min","deep_two"], kits:["halftime","kick"], fills:["impact","off","downlift","tape stop"],   // VARIETY: + tape stop (the decelerating pitch-drop drag suits the amp-one-song-from-death crawl)
      reverbColor:"greyhole",   // GRIT PASS: the room shakes — the cavernous smear the amp dies into
      bass:{patterns:["root","sub","dub"], recipe:{model:["reese","sub"],cutoff:[200,360],res:[.05,.15],level:[1.25,1.5],send:[.05,.12],dsend:[0,.06]},
        inserts:{prob:.85, max:1, pool:[["higain",{gate:[.05,.18],drive:[.8,.95],stages:3,low:.7,mid:.55,high:.35,presence:[.2,.35],mix:[.9,1]}]]}},   // BALANCE LOOP 3: doom SATURATED-LOOSE — 3 stages near-max drive, gate nearly OFF (the riff exhales, the amp rings into the room), dark tone stack. NB the mix range is LOAD-BEARING for gate 2: 8 draw keys keeps seed 1's downstream section draws where drumDensity lands >= .8 (the 7-key claim rolled .73 and handed dub the seed)
      lead:{patterns:["double","blues","sparse"], samplerPool:["crunch_guitar"], recipe:{model:["fuzz","fuzz","sampler"],wave:"saw",voices:[1,2],spread:[.003,.008],cutoff:[1400,2200],res:[.25,.4],drive:[.7,1],level:[.5,.62],send:[.3,.45],dsend:[.15,.3],attack:.01,release:[.2,.35],sustain:[.8,.95]}},   // THE RIFF — long sustained fuzz, low. INSTRUMENT-LIBRARY: 1/3 of seeds the FreePats crunch_guitar rides the riff (a real amp dying in a real room; low cutoff keeps it swamp-dark)
      pads:{prob:.3, recipe:{model:["saw"],wave:"saw",cutoff:[420,760],detune:[.01,.02],attack:[2.5,4.5],level:[.34,.46],send:[.28,.42],dsend:[.1,.25]}},   // deep pass: pad prob .3, dark and quiet — the fuzz WALL carries it, not a saw wash; less of the audit's "outro pad" scaffolding, more amp-in-the-room
      drums:{kickModel:["boom","808"],snareModel:["noise","crack"],hatModel:["noise"],kick:[1.35,1.6],snare:[.9,1.15],hat:[.4,.7],tune:[.75,.9],send:[.15,.28],dsend:[.05,.15]},   // snare UP — the stomp (vs doomdrone's buried kit)
      fx:{reverb:[.4,.6], delayBeats:[.75,1], delayFb:[.25,.4], delayCut:[1600,2600], pump:[0,.1], crackle:[.05,.2], lowcut:[0,25], highcut:[0,0], comp:[.5,.75], grit:[.65,.95]},   // grit MAXED
      found:{role:"bed", vol:[.15,.25], pitch:[.55,.7], stretch:[.45,.6], cutoff:[1400,2400], sources:["pool:industry*1","pool:road*1"]},   // the plant, pitched into the swamp
      stab:["off"], hits:{sources:["sp_pressure","pool:vocal_stab*1"], pattern:"sparse", prob:.3},
      form:"vamp" },
    industrialmetal: { label:"Hydraulic Tantrum", info:"A half-time kit at 100-126. Reese bass under a saw synth pad, with a crunch guitar. Phrygian, a light shuffle, quantized tight.",   // fuzz-FORWARD sibling of EBM: SLAM where EBM pistons
      bpm:[100,126], swing:[0,.05], humanize:[0,.12],
      progressions:["mode_phrygian","minor_run","drone_min"], kits:["halftime","breaks"], fills:["impact","cut","noise"],
      reverbColor:"fdn",   // GRIT PASS: a big hard-surfaced industrial slam room behind the machine
      bass:{patterns:["stab","drive","sub"], recipe:{model:["reese"],cutoff:[280,480],res:[.15,.3],level:[1.15,1.35],send:[0,.06],dsend:[0,.08]},
        inserts:{prob:.8, max:1, pool:[["higain",{gate:[.6,.78],drive:[.6,.85],stages:3,low:.55,mid:.45,high:.6,presence:[.55,.7]}]]}},   // BALANCE LOOP 3: quantized fury — the reese through the wall of Marshalls, gate HIGH (everything stops on the grid), 3 stages
      lead:{patterns:["double","sparse","off"], samplerPool:["crunch_guitar"], recipe:{model:["fuzz","stack","sampler"],wave:"saw",voices:[1,2],spread:[.003,.008],cutoff:[1800,2800],res:[.25,.4],drive:[.6,.9],level:[.46,.58],send:[.2,.35],dsend:[.2,.35],attack:.004,release:[.08,.15],sustain:[.5,.65],fenv:[.4,.8]}},   // fuzz STABS, quantized — not a solo. INSTRUMENT-LIBRARY: 1/3 of seeds the stabs are the FreePats crunch_guitar (real pick transients on the grid; short release chops the sustain into the slam)
      pads:{prob:.35, recipe:{model:["saw"],wave:"saw",cutoff:[600,1000],detune:[.006,.013],attack:[.8,2],level:[.32,.45],send:[.25,.4],dsend:[.1,.2]}},
      drums:{kickModel:["909","808"],snareModel:["crack","clap"],hatModel:["metal"],kick:[1.3,1.55],snare:[1,1.3],hat:[.5,.8],tune:[.85,1],send:[.1,.2],dsend:[.1,.25]},   // the SLAM snare
      fx:{reverb:[.35,.5], delayBeats:[.5,.5], delayFb:[.25,.4], delayCut:[2000,3000], pump:[.1,.3], crackle:[0,.1], lowcut:[25,40], highcut:[0,0], comp:[.55,.8], grit:[.6,.9], jux:[.2,.45]},
      found:{role:"bed", vol:[.12,.2], pitch:[.7,.85], stretch:[.45,.6], cutoff:[1600,2800], sources:["pool:industry*1","pool:voices*1"]},
      stab:["off","sparse"], hits:{sources:["pool:vb_industrial_machine*1","sp_system","sp_pressure","pool:rave_stab*1"], pattern:"dub", prob:.6},
      form:"pop" },
    darksynth: { label:"Apex Curfew", info:"A pulse kit at 122-136. Reese bass under an Oberheim pad, with a hard-sync lead. Phrygian, a light shuffle, quantized tight.",   // SYNTH-FORWARD: the night drive turned hostile
      bpm:[122,136], swing:[0,.05], humanize:[0,.12],   // UNDER dubstep's 133-148 core — chase-scene tempo, not halftime wobble
      progressions:["mode_phrygian","andalusian","epic_min"], kits:["pulse","four"], fills:["impact","riser","tom fill","cut"],
      transforms:{ pool:["stutter","rot"], rate:.16 },   // deep pass (v4 transform dimension): the RELENTLESS pulse is machine-tight, but ~1/6 of bars snap into a gated 16th-stutter or a displaced-hat lurch — the John-Carpenter/Perturbator horror gate. Distinct from dubstep's halftime (which mutates via the wobble, not the grid); keeps the drive (low rate, no rev/rest that would open holes)
      bass:{patterns:["drive","octaves","sixteenths","pedal"], recipe:{model:["reese","modeld"],cutoff:[350,600],res:[.15,.3],level:[1.15,1.35],send:[0,.06],dsend:[0,.06],
        glide:[20,40],envAmount:[1.2,2.2],envDecay:[.08,.16],oscMix:[.5,.9]},
        inserts:{prob:.7, max:1, pool:[["distort",{drive:[.35,.65],mix:[.7,.95]}]]}},   // the chase-scene reese OR a snarling pulse-heavy Model-D, subtle glide (modeld's own drive comes from the lead-shared key below being absent — envelope does the menace)
      lead:{patterns:["hero","arp16","double","updown"], recipe:{model:["synclead","synclead","synclead","synclead","stack","fuzz","modeld"],wave:"saw",voices:[4,6],spread:[.01,.018],cutoff:[2600,3800],res:[.4,.5],drive:[.35,.55],syncRatio:[1.5,2.5],syncSweep:[2.5,3.5],syncDecay:[.12,.25],syncDetune:[6,14],level:[.48,.6],send:[.3,.45],dsend:[.25,.4],attack:.008,release:[.15,.25],sustain:[.7,.82],fenv:[.3,.6],
        glide:[30,80],envAmount:[1.4,2.4],envDecay:[.08,.18],oscMix:[.4,.8],drift:[2,6]}},   // the hard-sync tearing lead (syncSweep 2.5-3.5, the darksynth formant scream); distorted supersaw / fuzz / hot Model-D trade the rest
      pads:{prob:.9, recipe:{model:["oberheim","oberheim","saw"],wave:"saw",cutoff:[1000,1900],detune:[.01,.018],attack:[.8,1.8],filterMode:[.4,.7],envAmount:[1,1.8],osc2lfo:[.2,.5],level:[.5,.68],send:[.35,.5],dsend:[.1,.25]},
        inserts:{prob:.5, max:1, pool:[["phaser",{rate:[.1,.3],depth:[.5,.75],mix:[.4,.6]}]]}},   // the Oberheim SEM pad (BP-morphed, slow poly-mod), synthwave's phaser inherited and turned menacing
      drums:{kickModel:["909"],snareModel:["noise","clap"],hatModel:["noise","metal"],kick:[1.3,1.5],snare:[.95,1.2],hat:[.5,.8],tune:[.9,1.05],send:[.25,.4],dsend:[.05,.15]},   // big gated snare, faster
      fx:{reverb:[.45,.6], delayBeats:[.375,.5], delayFb:[.25,.4], delayCut:[2200,3400], pump:[.1,.3], crackle:[0,.06], lowcut:[30,45], highcut:[0,0], comp:[.45,.65], grit:[.4,.7], jux:[.15,.35]},
      found:{role:"bed", vol:[.06,.12], pitch:[.7,.85], stretch:[.45,.6], cutoff:[1400,2400], sources:["pool:industry*1","pool:road*1","vx_xminusone"]},
      stab:["off","sparse"], hits:{sources:["sp_pressure","pool:rave_stab*1","pool:vocal_stab*1"], pattern:"sparse", prob:.4},
      form:"drop" },
    /* genre-tool:prelude:genres */
    prelude: { label:"The Turning Stair", info:"Beatless at 62-80. A harpsichord under strings, with a harpsichord. A canon, rubato, one chord every 16 beats.",
      reverbColor:"fdn",   // fx wings: a dry recital room, not a wash — the close felt-piano
      introMode:"off",   // MUSICALITY balance loop 1 (BLOOM): the WTC prelude opens ON the figuration — bar 1, no curtain. The wave "arrive" node (pads-only) held the first keyboard note out 37-101s at prelude's giant cycles (chordEvery:16 -> 48-128-beat sections); dropping it opens every seed on the drift figuration at 0s, strings swelling UNDER the line, the bass continuo joining at the swell (36-101s). Unhurried stays (the cycles are still long) — DEAD goes. MEASURED across seeds 1-5: every declared part sounds inside a 3-minute listen (worst bass 101s, was 202s on the canon seed)
      bpm:[62,80],
      swing:[0,0.03],
      humanize:[0.08,0.2],
      progressions:["canon","ii_v_i","dream"],
      kits:["off"],
      fills:["off"],
      chordEvery:16,
      bass:{patterns:["root","pedal","simple"], samplerPool:["harpsichord","felt_piano","bright_yamaha_grand"], recipe:{model:["sampler","sampler","piano"], cutoff:[700,1400], res:[0.05,0.1], level:[0.5,0.7], send:[0.2,0.4], dsend:[0,0.08], attack:[0.01,0.03], release:[0.3,0.6]}},   // the continuo now the real HARPSICHORD (GM 6) beside the felt/bright piano
      lead:{patterns:["arp16","arpup","canon"], samplerPool:["harpsichord","harpsichord","felt_piano"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.001,0.003], cutoff:[2600,3800], level:[0.42,0.56], send:[0.25,0.45], dsend:[0.05,0.18], attack:[0.005,0.02], release:[0.2,0.45]}},   // it is literally Bach — the HARPSICHORD dominant (2/3), felt piano the intimate alternate; sampler-grade .8 stays inside prelude's [.66,1] acoustic floor (MEASURED)
      pads:{prob:0.3, samplerPool:["strings"], recipe:{model:["sampler","strings"], wave:"sine", cutoff:[900,1600], detune:[0.002,0.005], attack:[1,2.5], release:[1.5,3], swell:1, level:[0.32,0.46], send:[0.35,0.55], dsend:[0,0.1]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.5,0.7], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.9,1], send:[0.15,0.35], dsend:[0,0]},
      fx:{reverb:[0.42,0.6], delayBeats:[0.75,1.5], delayFb:[0.12,0.28], delayCut:[2200,3200], pump:[0,0], crackle:[0,0.12], lowcut:[0,0], highcut:[0,0], comp:[0,0.12]},
      found:{role:"bed", vol:[0.05,0.12], pitch:[0.7,0.9], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:city*2"]},
      rubato:{depth:[0.01,0.025], periodBars:[2,4], prob:1},
      hits:{sources:["pool:vb_classical_chamber*1","sp_herenow"], pattern:"sparse", prob:0.05},
      stab:["off"],
      form:"wave" },
    /* /genre-tool:prelude:genres */
    fugue: { label:"The Patient Chase", info:"Beatless at 90-106. A church organ under strings, with a harpsichord. A canon.",
      reverbColor:"fdn",   // fx wings: a dry chapel/recital room, not a wash — the close harpsichord+organ
      bpm:[90,106],
      swing:[0,0.02],
      humanize:[0,0.06],
      progressions:["canon","minor_run","dream"],   // canon = the Pachelbel imitation (subject echoed voice-to-voice); all high-motion (5/4 distinct roots -> motion ~1, a faster harmonic tread than prelude's freer figuration)
      kits:["off"],
      fills:["off"],
      bass:{patterns:["pedal","root","walking"], samplerPool:["church_organ","harpsichord"], recipe:{model:["sampler","sampler"], cutoff:[700,1500], res:[0.05,0.1], level:[0.5,0.7], send:[0.2,0.4], dsend:[0,0.08], attack:[0.01,0.03], release:[0.3,0.6]}},   // the pedal-point continuo — church organ (Bach's other instrument) or harpsichord, both real GM samplers
      lead:{patterns:["fugue","fugue","canon"], samplerPool:["harpsichord","harpsichord","church_organ"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[3,4], spread:[0.001,0.003], cutoff:[2600,3800], level:[0.4,0.54], send:[0.25,0.45], dsend:[0.05,0.18], attack:[0.005,0.02], release:[0.2,0.45]}},   // THE FUGUE: 3-4 interweaving voices — the "fugue" pattern is a running-SIXTEENTH subject + imitative answer (semiquaver counterpoint); canon as the slower echo variant. Harpsichord dominant (2/3), church organ the grand alternate. Contrapuntal density is what the verifier reads as leadVoices (prelude is 1-2)
      pads:{prob:0.5, samplerPool:["strings"], recipe:{model:["sampler","strings"], wave:"sine", cutoff:[900,1600], detune:[0.002,0.005], attack:[0.6,1.6], release:[1.2,2.4], swell:1, level:[0.3,0.44], send:[0.35,0.55], dsend:[0,0.1]}},   // sustained strings thicken the counterpoint under the keyboard voices (prob higher than prelude — the fugue is denser)
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.5,0.7], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.9,1], send:[0.15,0.35], dsend:[0,0]},
      fx:{reverb:[0.38,0.55], delayBeats:[0.5,1], delayFb:[0.1,0.24], delayCut:[2200,3200], pump:[0,0], crackle:[0,0.1], lowcut:[0,0], highcut:[0,0], comp:[0,0.12]},
      found:{role:"bed", vol:[0.05,0.12], pitch:[0.7,0.9], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:city*2"]},
      hits:{sources:["pool:vb_classical_chamber*1","sp_herenow"], pattern:"sparse", prob:0.05},
      stab:["off"],
      form:"wave" },   // NB: NO rubato block (unlike prelude) — the fugue is metronomic; the verifier reads rubato 0, which fences it off prelude's rubato-carrying diagonal
    // ======== GENRE-EXPANSION ========
    // 14 canonical additions, uptempo-biased (10 at/above ~140 BPM). Each fenced
    // in genre-verifier.js so the confusion matrix stays diagonal-dominant.
    dnb: { label:"Silken Reentry", info:"A breaks kit at 170-176. Sub bass under strings, with a rhodes ep. Neo-soul changes, straight time.",   // UPTEMPO. distinct from jungle: NO break role (smooth bed), higher wash
      timeFeel:{ pushPullMs:{ bass:-5 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — D&B: same pull, applied to the polished rolling two-step
      bpm:[170,176], swing:[0,.04], humanize:[.05,.14],
      progressions:["neosoul","deep_two","minor_run","dream"], kits:["breaks","jungle"], fills:["off","drum fill","riser","downlift"],
      bass:{patterns:["sub","rolling"], recipe:{model:["sub","reese"],cutoff:[280,520],res:[.05,.2],level:[1.15,1.4],send:[0,.05],dsend:[0,0]}},   // reese stays synth (signature) — the smooth dnb sub
      lead:{patterns:["sparse","off","pentaup"], patchPool:["E.PIANO 2"], samplerPool:["rhodes_ep","electric_piano"], recipe:{model:["fm","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1800,3000],level:[.34,.46],send:[.35,.55],dsend:[.25,.4],octave:.05,attack:.03,release:[.2,.35],sustain:[.7,.82]}},
      pads:{prob:.85, samplerPool:["strings"], recipe:{model:["fm","strings","sampler"],wave:"saw",cutoff:[900,1500],detune:[.004,.01],attack:[1.5,3],level:[.5,.68],send:[.5,.7],dsend:[.15,.3]}},   // smooth liquid pad wash — the separator vs jungle's dry amen
      drums:{kickModel:["808"],snareModel:["crack","noise"],hatModel:["noise"],kick:[1.05,1.3],snare:[.55,.8],hat:[.5,.85],tune:[1,1.12],send:[.1,.2],dsend:[.2,.4]},
      fx:{reverb:[.5,.68], delayBeats:[.75,1.5], delayFb:[.3,.5], delayCut:[2000,3200], pump:[0,.15], crackle:[0,.1], lowcut:[25,40], highcut:[0,0], comp:[.3,.5]},
      found:{role:"bed", vol:[.1,.18], pitch:[.85,1], stretch:[.45,.6], cutoff:[2000,3200], sources:["pool:road*1","pool:city*1","pool:voices*1"]},   // BED not break — this is dnb's whole distinction from jungle
      stab:["off","sparse"], hits:{sources:["pool:vb_junglist*1","pool:vocal_stab*1","pool:rave_stab*1","sp_pressure"], pattern:"sparse", prob:.4},
      form:"dj" },
    footwork: { label:"Ankle Velocity", info:"A trap kit at 155-162. Sub bass under a saw synth pad, with a pluck lead. A two-chord vamp, swung, quantized tight.",   // UPTEMPO
      timeFeel:{ pushPullMs:{ bass:-5 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — FOOTWORK: the 808 triplet sub arrives ahead of the toms — dancers negotiate with the bass, not the kit
      bpm:[155,162], swing:[.06,.16], humanize:[0,.08],
      progressions:["deep_two","drone_min","neosoul"], kits:["trap","electro"], fills:["off","stutter","cut","hat rush"],
      bass:{patterns:["sub","stab"], recipe:{model:["sub","reese"],cutoff:[240,420],res:[.05,.2],level:[1.2,1.45],send:[0,.05],dsend:[0,.05]}},
      lead:{patterns:["off","sparse","pentaup"], recipe:{model:["pluck","fm"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1800,2800],level:[.3,.42],send:[.25,.4],dsend:[.25,.4],attack:.003,release:[.06,.1],sustain:[.5,.62]}},
      pads:{prob:.25, recipe:{model:["saw","organ"],wave:"saw",cutoff:[600,1000],detune:[.005,.012],attack:[1,2.5],level:[.3,.42],send:[.3,.45],dsend:[.1,.2]}},
      drums:{kickModel:["808"],snareModel:["crack","clap"],hatModel:["metal","noise"],kick:[1.2,1.45],snare:[.5,.75],hat:[.7,1],tune:[1,1.15],send:[.05,.14],dsend:[.1,.25]},
      fx:{reverb:[.3,.45], delayBeats:[.375,.75], delayFb:[.3,.45], delayCut:[2000,3200], pump:[.1,.3], crackle:[0,.1], lowcut:[30,45], highcut:[0,0], comp:[.3,.5]},
      found:{role:"chops", vol:[.15,.28], pitch:[.9,1.15], stretch:[.35,.55], cutoff:[2000,3600], sources:["shibuya","vx_wwvh","vox_a"]},   // the chopped vocal stutter IS footwork
      stab:["off","sparse"], hits:{sources:["pool:vb_junglist*1","pool:vocal_stab*2","sp_rhythm"], pattern:"dub", prob:.6},
      form:"dj" },
    happyhardcore: { label:"Serotonin Stampede", info:"A four-on-the-floor at 168-176. Saw synth bass under a saw synth pad, with a bright yamaha grand. An uplifting cadence, a light shuffle.",   // UPTEMPO
      bpm:[168,176], swing:[0,.05], humanize:[.03,.12],
      progressions:["uplift","four_chords","pop_1625","doo_wop","epic_maj"], kits:["four","pulse"], fills:["riser","impact","hat rush","drum fill"],
      bass:{patterns:["drive","octaves","rolling"], recipe:{model:["saw","reese"],cutoff:[500,850],res:[.15,.3],level:[1.1,1.3],send:[0,.08],dsend:[0,0]}},
      lead:{patterns:["hero","anthem","arpup","double"], samplerPool:["bright_yamaha_grand"], recipe:{model:["hoover","hoover","hoover","sampler"],wave:"saw",voices:[4,6],spread:[.008,.015],cutoff:[2600,3600],level:[.46,.58],send:[.35,.55],dsend:[.25,.4],attack:.004,release:[.08,.14],sustain:[.6,.72],fenv:[.4,.8]},
        inserts:{prob:.5, max:1, pool:[["phaser",{rate:[.15,.4],depth:[.5,.7],mix:[.35,.55]}]]}},   // the HOOVER, phased (a SIGNATURE model, never sampled — a generic stack would sample away to a wind fallback) — 3/4 of draws; the other 1/4 the '92 rave PIANO riff (bright grand, the card's other promise) takes the anthem
      pads:{prob:.6, recipe:{model:["saw","juno60"],wave:"saw",cutoff:[1000,1800],detune:[.008,.015],attack:[.8,2],level:[.42,.58],send:[.4,.6],dsend:[.15,.3]}},
      drums:{kickModel:["909","boom"],snareModel:["clap","noise"],hatModel:["noise","metal"],kick:[1.3,1.55],snare:[.75,1],hat:[.7,1],tune:[1,1.1],send:[.15,.3],dsend:[.1,.25]},
      fx:{reverb:[.5,.68], delayBeats:[.375,.75], delayFb:[.3,.45], delayCut:[2400,3600], pump:[.4,.65], crackle:[0,.08], lowcut:[30,45], highcut:[0,0], comp:[.45,.7]},
      found:{role:"bed", vol:[.06,.14], pitch:[.9,1.05], stretch:[.4,.6], cutoff:[2400,3600], sources:["rave_a","rave_b","sp_energy"]},
      // the BREAKBEAT ROLL the card promises: a one-bar
      // amen ROLLS INTO each section cadence — the '92 hardcore move — as COLOR over
      // the four-on-floor, NOT the kit (jungle owns the break-role identity; keeping
      // the kit four/pulse + the rave bed keeps this matrix-invisible: sampleEvents
      // is the zero-rng dominant-parent dim, and no verifier feature reads it).
      sampleEvents:[{pool:["amen_170","amen_172","amen_175"], placement:"cadence", sections:"all", treatment:{cutoff:6000, vol:0.34, maxDur:4}}],
      stab:["rave","offbeat"], hits:{sources:["pool:vb_rave_hardcore*1","pool:rave_stab*3","sp_energy"], pattern:"offbeat", prob:.7},
      form:"dj" },
    hardstyle: { label:"Anvil Euphoria", info:"A four-on-the-floor at 148-156. Reese bass under a saw synth pad, with a stacked saws lead. Epic minor changes, straight time, quantized tight.",   // UPTEMPO
      bpm:[148,156], swing:[0,.03], humanize:[0,.08],
      progressions:["epic_min","minor_run","andalusian"], kits:["four","pulse"], fills:["impact","riser","cut","hat rush"],
      bass:{patterns:["stab","drive","rolling"], recipe:{model:["reese","acid"],cutoff:[420,720],res:[.2,.4],level:[1.2,1.4],send:[0,.06],dsend:[0,.06]},
        inserts:{prob:.6, max:1, pool:[["distort",{drive:[.3,.6],mix:[.6,.9]}]]}},   // the reverse-bass, in the red
      lead:{patterns:["hero","anthem","arpup"], recipe:{model:["stack"],wave:"saw",voices:[4,6],spread:[.01,.018],cutoff:[2400,3400],res:[.2,.35],level:[.46,.58],send:[.3,.5],dsend:[.2,.4],attack:.004,release:[.1,.18],sustain:[.6,.72],fenv:[.5,1]}},
      pads:{prob:.5, recipe:{model:["saw","juno60"],wave:"saw",cutoff:[900,1600],detune:[.01,.018],attack:[1,2.4],level:[.42,.56],send:[.4,.6],dsend:[.15,.3]}},
      drums:{kickModel:["909","boom"],snareModel:["clap","crack"],hatModel:["metal","noise"],kick:[1.4,1.65],snare:[.7,.95],hat:[.6,.9],tune:[1,1.1],send:[.1,.2],dsend:[.08,.18]},
      fx:{reverb:[.4,.58], delayBeats:[.375,.5], delayFb:[.25,.4], delayCut:[2200,3400], pump:[.45,.75], crackle:[0,.06], lowcut:[30,45], highcut:[0,0], comp:[.5,.8]},
      found:{role:"bed", vol:[.05,.12], pitch:[.85,1], stretch:[.4,.6], cutoff:[2000,3200], sources:["rave_c","sp_energy","pool:industry*1"]},
      stab:["rave","offbeat"], hits:{sources:["pool:vb_rave_hardcore*1","pool:rave_stab*2","sp_energy"], pattern:"offbeat", prob:.55},
      form:"dj" },
    eurodance: { label:"Chartbuster Esperanto", info:"A four-on-the-floor at 138-145. Saw synth bass under an electric piano, with a stacked saws lead. Four-chord changes, a light shuffle.",   // UPTEMPO. acoustic = the M1 house-piano/organ pad (all-synth trance/edm can't reach it); pump LOW (a pop track, not a trance gate)
      bpm:[138,145], swing:[0,.05], humanize:[.03,.1],
      progressions:["four_chords","uplift","pop_1625","doo_wop"], kits:["four","pulse"], fills:["riser","hat rush","impact","drum fill"],
      bass:{patterns:["octaves","drive","rolling"], recipe:{model:["saw","reese"],cutoff:[500,820],res:[.15,.3],level:[1.05,1.28],send:[0,.08],dsend:[0,0]}},
      lead:{patterns:["hero","anthem","arpup","updown"], recipe:{model:["stack"],wave:"saw",voices:[4,6],spread:[.008,.015],cutoff:[2600,3600],level:[.44,.56],send:[.3,.5],dsend:[.2,.35],attack:.006,release:[.1,.16],sustain:[.6,.72],fenv:[.3,.6]}},
      pads:{prob:.9, patchPool:["E.ORGAN 1"], samplerPool:["electric_piano","percussive_organ"], recipe:{model:["sampler","sampler"],wave:"saw",cutoff:[1100,1800],detune:[.006,.012],attack:[.2,.6],level:[.5,.66],send:[.35,.55],dsend:[.1,.25]}},   // the M1 house piano/organ = acoustic .6 fence
      drums:{kickModel:["909","boom"],snareModel:["clap"],hatModel:["noise"],kick:[1.25,1.5],snare:[.7,.95],hat:[.9,1.25],tune:[.98,1.08],send:[.12,.24],dsend:[.05,.15]},
      fx:{reverb:[.4,.58], delayBeats:[.375,.75], delayFb:[.25,.4], delayCut:[2400,3600], pump:[.06,.2], crackle:[0,.06], lowcut:[30,45], highcut:[0,0], comp:[.35,.55]},   // pump kept LOW (below trance's .3 floor) — a pop-rave, not a trance gate
      found:{role:"bed", vol:[.05,.12], pitch:[.9,1.05], stretch:[.4,.6], cutoff:[2400,3600], sources:["rave_b","sp_energy","pool:city*1"]},
      stab:["rave","offbeat"], hits:{sources:["pool:rave_stab*2","pool:vocal_stab*1"], pattern:"offbeat", prob:.6},
      form:"dj" },
    singeli: { label:"Hummingbird Overclock", info:"AN electro kit at 200-214. Saw synth bass under a saw synth pad, with a pluck lead. A hijaz maqam, a light shuffle, quantized tight.",   // UPTEMPO (fastest in the catalog)
      bpm:[200,214], swing:[0,.05], humanize:[0,.1],
      progressions:["hijaz","mode_phrygian","minor_run"], kits:["electro","four"], fills:["hat rush","cut","stutter","impact"],
      bass:{patterns:["stab","rolling","drive"], recipe:{model:["saw","acid"],cutoff:[400,700],res:[.2,.35],level:[1.1,1.35],send:[0,.06],dsend:[0,.06]}},
      lead:{patterns:["double","arpup","pentaup"], recipe:{model:["pluck","stack"],wave:"square",voices:[1,2],spread:[.003,.007],cutoff:[2400,3400],level:[.42,.54],send:[.25,.4],dsend:[.2,.35],attack:.003,release:[.05,.1],sustain:[.5,.62]}},   // all-synth: keeps acoustic 0 (fences the same-tempo acoustic bebop)
      pads:{prob:.3, recipe:{model:["saw","organ"],wave:"saw",cutoff:[800,1400],detune:[.006,.012],attack:[.5,1.5],level:[.34,.48],send:[.3,.45],dsend:[.1,.2]}},
      drums:{kickModel:["909","808"],snareModel:["clap","crack"],hatModel:["metal","noise"],kick:[1.2,1.45],snare:[.6,.85],hat:[.9,1.3],tune:[1,1.15],send:[.06,.14],dsend:[.08,.18]},
      fx:{reverb:[.3,.48], delayBeats:[.375,.5], delayFb:[.3,.45], delayCut:[2200,3400], pump:[.2,.45], crackle:[0,.12], lowcut:[30,45], highcut:[0,0], comp:[.4,.65]},
      found:{role:"chops", vol:[.12,.22], pitch:[.9,1.15], stretch:[.35,.55], cutoff:[2200,3600], sources:["shibuya","vx_wwvh","vox_a"]},
      stab:["rave","offbeat"], hits:{sources:["pool:vb_junglist*1","pool:vocal_stab*1","pool:rave_stab*1","sp_energy"], pattern:"dub", prob:.6},
      form:"dj" },
    bebop: { label:"Mercury Interrogation", info:"A shuffle at 196-220. Acoustic bass under a bright yamaha grand, with an alto sax. ii-V-I, hard swing, loose timing.",   // UPTEMPO. jazz's fast acoustic cousin — bpm floor fences it off jazz's [96,148]
      timeFeel:{ pushPullMs:{ ride:-4, snare:3, bass:4 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — SWING at a dead sprint — 220bpm leaves a 5.5 ms budget for 0.02 beat, so the same gesture as jazz at a third the size
      bpm:[196,220], swing:[.28,.5], humanize:[.25,.5],
      progressions:["ii_v_i","neosoul","blues_12","blues_16"], kits:["shuffle","shuffle","boombap"], fills:["off","drum fill","kit fill"],
      bass:{patterns:["walking","walking","root"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sub"],cutoff:[400,700],res:[.05,.15],level:[1,1.2],send:[.05,.12],dsend:[0,.05]}},
      lead:{patterns:["double","arp16","wander"], samplerPool:["alto_sax","tenor_sax","trumpet","muted_trumpet"], recipe:{model:["sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[2400,3600],level:[.42,.54],send:[.3,.45],dsend:[.15,.3],vibrato:[.006,.012],attack:.02,release:[.12,.2],sustain:[.6,.72]}},
      pads:{prob:.4, samplerPool:["bright_yamaha_grand","jazz_guitar"], recipe:{model:["sampler","sampler"],wave:"sine",cutoff:[1400,2400],detune:[.002,.005],attack:[.05,.2],level:[.4,.54],send:[.25,.4],dsend:[.05,.15]}},
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.6,.9],snare:[.55,.8],hat:[.8,1.15],tune:[.9,1.05],send:[.2,.4],dsend:[0,.1],kit:"brush"},
      fx:{reverb:[.4,.6], delayBeats:[.75,1.5], delayFb:[.15,.3], delayCut:[2000,3200], pump:[0,.05], crackle:[.1,.4], lowcut:[0,30], highcut:[0,0], comp:[.2,.4]},
      found:{role:"bed", vol:[.06,.14], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[2000,3200], sources:["vx_baraka_ortiz84","blues_vox_78","horns_78","pool:city*1"]},
      stab:["off"], hits:{sources:["pool:vb_jazz_blues*1","pool:horn_stab*1","bb_horn_a","bb_stab_a"], pattern:"response", prob:.4},
      form:"aaba" },
    bluegrass: { label:"Centrifugal Hymnal", info:"A shuffle at 156-170. Acoustic bass under a steel string guitar, with a banjo. Four-chord changes, swung.",   // UPTEMPO. banjo+fiddle acoustic; bpm floor fences it off surfrock, straight-major seventh fences it off bebop
      timeFeel:{ pushPullMs:{ bass:-5, hat:-4 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — BLUEGRASS DRIVE: the high-lonesome push — the whole string band leans forward; nothing in this music is ever late
      bpm:[156,170], swing:[.04,.14], humanize:[.15,.4],
      progressions:["four_chords","doo_wop","uplift"], kits:["shuffle","boombap"], fills:["off","drum fill","kit fill"],
      strum:"country",   // STRUM: the boom-chick steel-string strum under the banjo roll
      bass:{patterns:["walking","root","simple"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sub"],cutoff:[400,700],res:[.05,.15],level:[1,1.2],send:[.05,.12],dsend:[0,.05]}},
      lead:{patterns:["arp16","pentaup","double","wander"], samplerPool:["banjo","fiddle","banjo"], recipe:{model:["sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[2600,3800],level:[.42,.56],send:[.2,.4],dsend:[.05,.18],attack:.005,release:[.1,.2],sustain:[.55,.68]}},
      pads:{prob:.3, samplerPool:["steel_string_guitar","fiddle"], recipe:{model:["sampler","sampler"],wave:"sine",cutoff:[1400,2400],detune:[.002,.005],attack:[.1,.4],level:[.38,.5],send:[.2,.35],dsend:[.05,.15]}},
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.6,.85],snare:[.5,.72],hat:[.5,.8],tune:[.9,1.05],send:[.1,.25],dsend:[0,.08],kit:"brush"},
      fx:{reverb:[.3,.48], delayBeats:[.5,.75], delayFb:[.1,.25], delayCut:[2200,3400], pump:[0,.05], crackle:[.1,.4], lowcut:[0,30], highcut:[0,0], comp:[.15,.35]},
      found:{role:"bed", vol:[.06,.14], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[2000,3200], sources:["blues_vox_78","pool:city*1"]},
      stab:["off"], hits:{sources:["pool:vb_folk_pastoral*1","blues_vox_78","bb_horn_a"], pattern:"sparse", prob:.2},
      form:"pop" },
    ska: { label:"Checkerboard Escapement", info:"A shuffle at 146-156. Finger bass under a clean guitar, with a brass section. Doo-wop changes, swung.",   // UPTEMPO. brass acoustic + offbeat skank; bpm band sits between surfrock and bluegrass
      timeFeel:{ pushPullMs:{ pad:-5, bass:-4 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — SKA DRIVES where reggae DRAGS — the identical offbeat chop (pad under strum:"skank"), opposite sign. This pair is the clearest demonstration in the catalogue that feel is a direction, not a magnitude
      bpm:[146,156], swing:[.04,.14], humanize:[.1,.3],
      progressions:["doo_wop","four_chords","ii_v_i"], kits:["shuffle","four"], fills:["off","drum fill","kit fill"],
      strum:"skank",   // STRUM: the clean-guitar upstroke on every & IS ska — the skank chop on the pad voice
      bass:{patterns:["walking","octaves","root"], samplerPool:["finger_bass","acoustic_bass"], recipe:{model:["sampler","saw"],cutoff:[450,750],res:[.1,.2],level:[1,1.2],send:[.05,.12],dsend:[0,.05]}},
      lead:{patterns:["anthem","double","hero"], samplerPool:["brass_section","trumpet","trombone"], recipe:{model:["sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[2200,3400],level:[.44,.56],send:[.25,.4],dsend:[.1,.25],attack:.01,release:[.1,.2],sustain:[.6,.72]}},
      pads:{prob:.6, patchPool:["E.ORGAN 1"], samplerPool:["clean_guitar","clean_guitar","percussive_organ","rock_organ"], recipe:{model:["sampler","sampler"],wave:"saw",cutoff:[1000,1700],detune:[.003,.008],attack:[.1,.4],level:[.44,.58],send:[.25,.4],dsend:[.08,.2]}},   // THE SKANK: the choppy offbeat comp layer is GUITAR-FIRST — the clean-guitar upstroke IS ska (half the draws; the 2-tone organ keeps the rest). The card promised "choppy offbeat guitar upstrokes" over an organ-only pool
      drums:{kickModel:["boom"],snareModel:["noise","crack"],hatModel:["noise"],kick:[.9,1.15],snare:[.65,.9],hat:[.7,1],tune:[.95,1.1],send:[.12,.24],dsend:[.05,.15],kit:"acoustic"},
      fx:{reverb:[.35,.52], delayBeats:[.5,.75], delayFb:[.15,.3], delayCut:[2200,3400], pump:[0,.1], crackle:[.05,.25], lowcut:[20,35], highcut:[0,0], comp:[.25,.45]},
      found:{role:"bed", vol:[.05,.12], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[2200,3400], sources:["blues_vox_78","pool:city*1"]},
      stab:["offbeat","rave"], hits:{sources:["bb_horn_a","bb_horn_b","bb_stab_a"], pattern:"offbeat", prob:.6},
      form:"pop" },
    klezmer: { label:"Wedding Comet", info:"A shuffle at 132-144. Acoustic bass under an accordion, with a clarinet. A hijaz maqam, swung.",   // UPTEMPO. clarinet acoustic + hijaz; bpm floor fences it off arabpop's slower hijaz
      timeFeel:{ pushPullMs:{ bass:-5, snare:4 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — WEDDING FRENZY: the klezmer band ACCELERATES into you — bass ahead, the boom-chick answering behind it
      bpm:[132,144], swing:[.04,.16], humanize:[.15,.4],
      progressions:["hijaz","andalusian","minor_run"], kits:["shuffle","four"], fills:["off","drum fill","kit fill"],
      bass:{patterns:["root","walking","octaves"], samplerPool:["acoustic_bass","tuba"], recipe:{model:["sampler","sub"],cutoff:[400,700],res:[.05,.15],level:[1,1.2],send:[.05,.12],dsend:[0,.05]}},
      lead:{patterns:["wander","double","arp16"], samplerPool:["clarinet","clarinet","violin"], recipe:{model:["sampler","sampler"],wave:"sine",voices:[1,1],spread:[.002,.004],cutoff:[2400,3600],level:[.44,.56],send:[.25,.4],dsend:[.1,.25],vibrato:[.008,.016],attack:.02,release:[.12,.22],sustain:[.6,.74]}},
      pads:{prob:.6, samplerPool:["accordion","accordion"], recipe:{model:["sampler","sampler"],wave:"saw",cutoff:[1000,1700],detune:[.003,.008],attack:[.1,.5],level:[.42,.56],send:[.25,.4],dsend:[.08,.2]}},
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.95,1.2],snare:[.6,.85],hat:[.55,.85],tune:[.95,1.1],send:[.12,.24],dsend:[.05,.15],kit:"acoustic"},
      fx:{reverb:[.35,.52], delayBeats:[.5,.75], delayFb:[.15,.3], delayCut:[2200,3400], pump:[0,.1], crackle:[.1,.35], lowcut:[15,30], highcut:[0,0], comp:[.2,.4]},
      found:{role:"bed", vol:[.05,.12], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[2200,3400], sources:["blues_vox_78","pool:city*1"]},
      stab:["off"], hits:{sources:["bb_horn_a","bb_stab_a"], pattern:"sparse", prob:.25},
      form:"pop" },
    funk: { label:"Downbeat Notary", info:"A swingbeat kit at 102-114. Slap bass under a percussive organ, with a clavinet. A funk vamp, swung.",   // clavinet acoustic + horn CHOPS (fences four-on-floor disco, which forbids chops)
      timeFeel:{ pushPullMs:{ bass:-5, snare:5, clap:5 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — FUNK: the bass pops AHEAD of the one while the backbeat answers from behind — the tension that makes a pocket 'deep' rather than merely tight
      bpm:[102,114], swing:[.04,.14], humanize:[.1,.3],
      progressions:["funk_vamp","neosoul","ii_v_i"], kits:["newjack","house","four"], fills:["off","drum fill","kit fill"],
      bass:{patterns:["syncopated","melodic","stab"], samplerPool:["slap_bass","finger_bass"], recipe:{model:["sampler","saw"],cutoff:[500,850],res:[.1,.25],level:[1.05,1.28],send:[.03,.1],dsend:[0,.05]},
        inserts:{prob:.65, max:1, pool:[["fenv",{amount:[1.5,2.5],decay:[.1,.18],res:[.5,.65],sens:[.6,.8]}]]}},   // BALANCE LOOP 3: the popping bass through the note-triggered envelope filter — the fenv INSERT is the sampled-lane squelch (base defaults to the voice cutoff), the Bootsy chew on the slap/finger samplers and the saw alike
      lead:{patterns:["double","pentaup","wander"], samplerPool:["clavinet","clavinet","clean_guitar"], recipe:{model:["sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[2200,3400],level:[.42,.54],send:[.2,.35],dsend:[.1,.25],attack:.005,release:[.08,.14],sustain:[.55,.68]}},
      pads:{prob:.5, patchPool:["E.ORGAN 1"], samplerPool:["percussive_organ","brass_section"], recipe:{model:["sampler","sampler"],wave:"saw",cutoff:[1000,1700],detune:[.003,.008],attack:[.1,.4],level:[.42,.54],send:[.2,.35],dsend:[.08,.2]}},
      drums:{kickModel:["boom","909"],snareModel:["noise","crack"],hatModel:["noise"],kick:[1,1.25],snare:[.7,.95],hat:[.9,1.3],tune:[.95,1.1],send:[.1,.22],dsend:[.03,.12],kit:"acoustic"},
      fx:{reverb:[.28,.44], delayBeats:[.5,.75], delayFb:[.15,.3], delayCut:[2200,3400], pump:[0,.15], crackle:[.05,.25], lowcut:[25,40], highcut:[0,0], comp:[.3,.55]},
      found:{role:"chops", vol:[.08,.16], pitch:[.9,1.1], stretch:[.4,.6], cutoff:[2200,3600], sources:["bb_horn_a","shibuya","stml_chop_a","stml_chop_c","stml_chop_b"]},
      stab:["offbeat","rave"], hits:{sources:["bb_horn_a","bb_horn_b","bb_stab_a","bb_stab_b"], pattern:"offbeat", prob:.55},
      form:"duet" },
    boombap: { label:"Milk Crate Scripture", info:"A boom-bap kit at 88-96. Acoustic bass under strings, with a rhodes ep. Neo-soul changes, swung.",   // hard SNARE-forward break at 90+, bright (softTop 0) — fences the slower, tape-dark lofi/triphop
      timeFeel:{ pushPullMs:{ bass:9, hat:-4, snare:5 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — DILLA DRAG: the genre the template is NAMED after had no push-pull at all — fat sampled bass behind the knock, hats on top, snare a hair late
      bpm:[88,96], swing:[.1,.24], humanize:[.15,.35],
      progressions:["neosoul","lofi","ii_v_i","pop_1625"], kits:["boombap","breaks"], fills:["off","drum fill","downlift"],
      bass:{patterns:["simple","dub","root"], samplerPool:["acoustic_bass","finger_bass"], recipe:{model:["sub","sampler"],cutoff:[350,600],res:[.05,.15],level:[1,1.2],send:[.05,.12],dsend:[0,.05]}},
      snarePP:0.5,
      lead:{patterns:["sparse","pentaup","wander"], samplerPool:["rhodes_ep","electric_piano","jazz_guitar"], recipe:{model:["fm","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1800,2800],level:[.4,.52],send:[.3,.45],dsend:[.15,.3],attack:.02,release:[.12,.2],sustain:[.66,.78]}},
      pads:{prob:.7, samplerPool:["strings"], recipe:{model:["fm","sampler"],wave:"sine",cutoff:[900,1500],detune:[.003,.008],attack:[.8,1.8],level:[.5,.66],send:[.3,.5],dsend:[.1,.2]}},
      drums:{kickModel:["boom","808"],snareModel:["crack","noise"],hatModel:["noise"],kick:[1.1,1.35],snare:[.8,1.05],hat:[.6,.9],tune:[.9,1.05],send:[.12,.25],dsend:[.05,.15],kit:"room"},
      fx:{reverb:[.4,.58], delayBeats:[.5,.75], delayFb:[.2,.35], delayCut:[1800,2800], pump:[0,.1], crackle:[.2,.45], lowcut:[0,25], highcut:[0,0], comp:[.25,.45]},
      found:{role:"break", scratch:0.5, vol:[.2,.32], pitch:[1,1], stretch:[.5,.5], cutoff:[4000,6000], sources:["amen_165","amen_170","stml_loop_86a","stml_loop_89a","stml_loop_92a","stml_loop_94a"]},   // scratch rides only the ~7% stutter ornament (~3.5% of slices) — flourish, not groove-loss
      stab:["off"], hits:{sources:["pool:vb_jazz_blues*1","pool:vocal_stab*2","sp_rewind"], pattern:"sparse", prob:.4},
      form:"pop" },
    amapiano: { label:"Log Drum Diplomacy", info:"A four-on-the-floor at 108-116. Sub bass with a rhodes ep on both pad and lead. A two-chord vamp, swung.",   // sub log-drum + jazzy sevenths + fast shaker hats at 112; bpm cap fences it under deephouse
      timeFeel:{ pushPullMs:{ hat:-4, bass:6 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — AMAPIANO: the log-drum bass is a plucked, late instrument; the shakers ride ahead of it
      bpm:[108,116], swing:[.08,.2], humanize:[.05,.2],
      progressions:["deep_two","house_min7","neosoul"], kits:["house","four"], fills:["off","hat rush","riser"],
      bass:{patterns:["stab","syncopated","rolling"], recipe:{model:["sub","sub"],cutoff:[260,440],res:[.05,.15],level:[1.15,1.4],send:[0,.06],dsend:[0,.05]}},
      lead:{patterns:["sparse","pentaup","wander"], samplerPool:["rhodes_ep","electric_piano","vibraphone"], recipe:{model:["sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[2000,3200],level:[.4,.52],send:[.3,.5],dsend:[.15,.3],attack:.02,release:[.15,.28],sustain:[.68,.8]}},
      pads:{prob:.8, samplerPool:["rhodes_ep","strings"], recipe:{model:["sampler","sampler"],wave:"sine",cutoff:[1000,1700],detune:[.003,.008],attack:[.4,1.2],level:[.5,.66],send:[.35,.55],dsend:[.1,.25]}},
      drums:{kickModel:["boom","808"],snareModel:["clap","noise"],hatModel:["noise"],kick:[1,1.25],snare:[.4,.65],hat:[1.1,1.5],tune:[.95,1.1],send:[.12,.25],dsend:[.08,.2]},
      fx:{reverb:[.5,.68], delayBeats:[.5,.75], delayFb:[.25,.4], delayCut:[2200,3400], pump:[.15,.35], crackle:[0,.12], lowcut:[25,40], highcut:[0,0], comp:[.25,.45]},
      found:{role:"bed", vol:[.06,.14], pitch:[.85,1], stretch:[.45,.6], cutoff:[2000,3200], sources:["pool:city*2"]},
      stab:["offbeat","off"], hits:{sources:["pool:vocal_stab*1","sp_rhythm"], pattern:"offbeat", prob:.4},
      form:"dj" },
    reggae: { label:"Third Beat Gravity", info:"A one-drop at 70-80. Finger bass under a percussive organ, with a clean guitar. A two-chord vamp, swung.",   // the SONG to dub's dubbed-out instrumental: real harmonic motion + skank organ, vs dub's static drone
      timeFeel:{ pushPullMs:{ bass:13, pad:8, snare:7, rim:7 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — ONE-DROP: the whole band in the basement — the bass roundest and latest, the offbeat organ/guitar skank (pad, 100% offbeat under strum:"skank") lazy behind it, the rim-click on 3 fat
      bpm:[70,80], swing:[.04,.14], humanize:[.1,.3],
      strum:"skank",   // STRUM: the offbeat organ-and-guitar skank IS reggae — the & chop on the pad voice (percussive_organ pad = the bubble)
      progressions:["deep_two","neosoul","four_chords","minor_run"], kits:["onedrop"], fills:["off","downlift","drum fill"],   // MUSICALITY balance loop 1: the card says ONE DROP — kick+cross-stick on beat 3, beat 1 empty. A kick/halftime/four pool puts the kick on 1 instead (MEASURED 2-5% kick-on-3). Single-kit pool like bossa/electro/newjack: onedrop IS reggae's kit; variety lives in the kit's own ghost/open draws, and kickOn:[3] is now a written PROMISE (musicality.js) the pool must keep on every seed (a mixed pool drew halftime on 3 of 5 seeds — measured)
      bass:{patterns:["melodic","dub","simple"], samplerPool:["finger_bass","acoustic_bass"], recipe:{model:["sub","sampler"],cutoff:[280,480],res:[.05,.15],level:[1.15,1.4],send:[.03,.1],dsend:[0,.05]}},
      lead:{patterns:["sparse","off","pentaup"], samplerPool:["clean_guitar","rhodes_ep"], recipe:{model:["sampler","fm"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[2000,3000],level:[.38,.5],send:[.3,.45],dsend:[.15,.3],attack:.01,release:[.1,.18],sustain:[.6,.72]}},
      pads:{prob:.7, patchPool:["E.ORGAN 1"], samplerPool:["percussive_organ","rock_organ"], recipe:{model:["sampler","sampler"],wave:"saw",cutoff:[1000,1700],detune:[.003,.008],attack:[.05,.3],level:[.42,.56],send:[.25,.4],dsend:[.1,.25]}},
      drums:{kickModel:["boom"],snareModel:["crack","noise"],hatModel:["noise"],kick:[1.05,1.3],snare:[.6,.85],hat:[.6,.9],tune:[.9,1.05],send:[.15,.3],dsend:[.1,.25],kit:"acoustic"},
      fx:{reverb:[.45,.62], delayBeats:[.75,1.5], delayFb:[.3,.5], delayCut:[2000,3200], pump:[0,.1], crackle:[.05,.25], lowcut:[15,30], highcut:[0,0], comp:[.2,.4]},
      found:{role:"bed", vol:[.08,.16], pitch:[.85,1], stretch:[.45,.6], cutoff:[2000,3200], sources:["blues_vox_78","pool:city*1"]},
      stab:["offbeat"], hits:{sources:["pool:vocal_stab*1","sp_herenow"], pattern:"offbeat", prob:.5},
      form:"pop" },
    heavymetal: { label:"Molten Horsepower", info:"A four-on-the-floor at 130-148. Picked bass under a distortion guitar, with a crunch guitar. Epic minor changes, straight time.",   // distorted guitars front and center; comp+drumDensity+bpm fence it off the halftime industrialmetal, the slow sludgemetal, the clean surfrock
      bpm:[130,148], swing:[0,.04], humanize:[.03,.12],
      progressions:["epic_min","minor_run","andalusian","mode_phrygian"], kits:["four","pulse","electro"], fills:["impact","cut","riser","tom fill","crash choke"],   // VARIETY: + crash choke (the choked stop-crash accent off a two-tom pickup)
      reverbColor:"fdn",   // GRIT PASS: a big bright drum ROOM behind the kit + guitars — "a lot of deep reverb, classic metal effects"
      padDouble:true,      // WALL OF SOUND: the power-chord pad wall doubled to the octave below
      bass:{patterns:["drive","octaves","pedal"], samplerPool:["picked_bass"], recipe:{model:["sampler","saw"],cutoff:[500,850],res:[.1,.25],level:[1.2,1.45],send:[0,.06],dsend:[0,.05]},
        inserts:{prob:1, max:1, pool:[["higain",{gate:[.35,.5],drive:[.6,.8],stages:2,low:.6,mid:.5,high:.55,presence:[.45,.6]}]]}},   // BALANCE LOOP 3: the picked bass through the STAGED amp (was strip distort) — big + thick, moderate gate
      lead:{patterns:["hero","anthem","blues","double"], samplerPool:["crunch_guitar","crunch_guitar","distortion_guitar","overdrive_guitar","di_guitar"], recipe:{model:["sampler","sampler"],wave:"saw",voices:[1,2],spread:[.003,.008],cutoff:[2800,4000],level:[.56,.72],send:[.3,.48],dsend:[.2,.35],attack:.005,release:[.1,.2],sustain:[.6,.75]},
        inserts:{prob:1, max:1, pool:[["higain",{gate:[.4,.55],drive:[.65,.85],stages:3,low:.5,mid:.45,high:.6,presence:[.55,.7]}]]}},   // BALANCE LOOP 3: the SCREAMING riff + solo through 3 cascaded stages — classic full-stack lead, presence up. INSTRUMENT-LIBRARY: 2/5 seeds the FreePats crunch_guitar (a real re-amped Fender, 8s sustains), 1/5 the DI signal through THIS higain (prob 1 — the real amp chain); GM ids kept for pool variety
      pads:{prob:.75, samplerPool:["distortion_guitar"], recipe:{model:["sampler","saw"],wave:"saw",cutoff:[1000,1800],detune:[.006,.014],attack:[.05,.3],level:[.52,.68],send:[.3,.5],dsend:[.1,.25]},
        inserts:{prob:1, max:1, pool:[["higain",{gate:[.35,.5],drive:[.65,.85],stages:2,low:.65,mid:.5,high:.55,presence:[.5,.65]}]]}},   // BALANCE LOOP 3: the HUGE power-chord wall through the staged amp — low shelf up (the doubled sub-octave weight)
      drums:{kickModel:["boom","909"],snareModel:["crack","noise"],hatModel:["metal","noise"],kick:[1.45,1.7],snare:[.9,1.15],hat:[.7,1],tune:[1,1.1],send:[.2,.34],dsend:[.1,.22]},   // galloping double-kick, forward snare, deep room send
      fx:{reverb:[.46,.64], delayBeats:[.375,.5], delayFb:[.2,.35], delayCut:[2400,3600], pump:[.05,.25], crackle:[0,.06], lowcut:[30,45], highcut:[0,0], comp:[.55,.9], grit:[.55,.82]},
      found:{role:"bed", vol:[.05,.12], pitch:[.85,1], stretch:[.4,.6], cutoff:[2000,3200], sources:["pool:industry*1","pool:road*1"]},
      stab:["off","rave"], hits:{sources:["pool:rave_stab*1","sp_energy"], pattern:"sparse", prob:.3},
      form:"pop" },
    budstep: { label:"Amen Monolith", info:"A jungle kit at 138-146. Sub bass with a distortion guitar on both pad and lead. Phrygian, a light shuffle.",   // the amen (breakUse) + the doubled sludge-chord wall + the doubled sub drone: a triple no other break/bass genre carries
      bpm:[138,146], swing:[0,.06], humanize:[.05,.18],
      progressions:["mode_phrygian","minor_run","drone_min","epic_min"], kits:["jungle","breaks"], fills:["break fill","reverse","off","break fill"],
      reverbColor:"greyhole",   // SUNN O))) cathedral: the diffuse cavernous hall the wall drowns in — deep reverb
      bass:{patterns:["sludge","sludge","sub"], recipe:{model:["sub","reese"],cutoff:[240,440],res:[.05,.2],level:[1.35,1.6],send:[0,.05],dsend:[0,.05]},
        inserts:{prob:1, max:1, pool:[["distort",{drive:[.7,.95],mix:[.8,1]}]]}},   // BIG + DOUBLED sub (sludge = root + octave-below, long held) driving the guitar wall
      lead:{patterns:["sludge","sludge","blues"], samplerPool:["distortion_guitar","overdrive_guitar","distortion_guitar"], recipe:{model:["sampler","sampler"],wave:"saw",voices:[1,2],spread:[.003,.008],cutoff:[1600,2600],level:[.58,.74],send:[.36,.56],dsend:[.2,.35],attack:.01,release:[.5,.9],sustain:[.88,.96]},
        inserts:{prob:1, max:1, pool:[["distort",{drive:[.65,.9],mix:[.75,1]}]]}},   // the SLEEP wall: DOUBLED power CHORDS (sludge), LOW register, long release + high sustain = relentless + anthemic, through the heavy metal strip
      pads:{prob:.85, samplerPool:["distortion_guitar"], recipe:{model:["sampler","saw"],wave:"saw",cutoff:[700,1300],detune:[.006,.014],attack:[.1,.5],release:[1.8,3.4],sustain:[.88,.96],level:[.56,.72],send:[.4,.6],dsend:[.1,.25]},
        inserts:{prob:1, max:2, pool:[["distort",{drive:[.6,.85],mix:[.7,.95]}],["phaser",{rate:[.2,.5],depth:[.5,.7],mix:[.4,.6]}]]}},   // the never-relenting DISTORTED guitar drone under the riff — RING-CLASS: MBV-style phasing in/out on the saw draw (distort stays on the sampler wall)
      drums:{kickModel:["808"],snareModel:["crack","noise"],hatModel:["noise"],kick:[1.15,1.4],snare:[.6,.85],hat:[.4,.7],tune:[1,1.12],send:[.14,.26],dsend:[.2,.4]},
      fx:{reverb:[.56,.74], delayBeats:[.75,1.5], delayFb:[.3,.5], delayCut:[1800,3000], pump:[0,.2], crackle:[.05,.2], lowcut:[20,35], highcut:[0,0], comp:[.5,.85], grit:[.55,.82]},
      found:{role:"break", vol:[.28,.42], pitch:[1,1], stretch:[.5,.5], cutoff:[5000,8000], sources:["amen_170","amen_172","amen_175"]},   // the amen chaos over the wall
      sampleEvents:[{ pool:["wd_bluedream","wd_northernlights","wd_purplehaze","wd_sourdiesel","wd_whitewidow","wd_granddaddy","wd_jackherer","wd_pineapple","wd_mauiwowie","wd_acapulco","wd_durban","wd_weddingcake","wd_zkittlez","wd_indica","wd_sativa","wd_hybrid"],
        placement:"buried", sections:"all", treatment:{cutoff:4200, vol:0.42, glitch:true, every:2, maxDur:8} }],   // the deadpan strain-name recital, one per two bars
      hits:{sources:["wd_bluedream","wd_sourdiesel","wd_indica","wd_sativa"], pattern:"dub", prob:.6},
      stab:["off"],
      form:"dj" },
    pixiewave: { label:"Whisper Ordnance", info:"A four-on-the-floor at 131-137. Saw synth bass with a Juno pad on both pad and lead. A descending minor run, a light shuffle.",   // fenced on the juno voice-count (2-4, NOT synthwave's supersaw choir) + a wet chorus-verb + a 130s indie tempo ABOVE dancepop's cap; the LOUDquietLOUD is the anthem-form section dynamic
      bpm:[131,137], swing:[0,.06], humanize:[.05,.18],
      progressions:["minor_run","epic_min","sad_pop","four_chords","interchange"], kits:["four","open","pulse"], fills:["impact","riser","drum fill","downlift"],
      bass:{patterns:["drive","root","octaves"], recipe:{model:["saw","sub"],cutoff:[450,780],res:[.12,.26],level:[1.05,1.3],send:[0,.08],dsend:[0,.05]}},
      lead:{patterns:["hero","anthem","updown","sparse"], recipe:{model:["juno60","stack"],wave:"saw",voices:[2,4],spread:[.008,.016],cutoff:[2200,3400],level:[.42,.58],send:[.3,.5],dsend:[.2,.35],attack:.01,release:[.12,.22],sustain:[.55,.7],fenv:[.3,.7]},
        inserts:{prob:.5, max:1, pool:[["distort",{drive:[.15,.4],mix:[.4,.7]}]]}},   // the chorus scream on the juno lead
      pads:{prob:.9, recipe:{model:["juno60","juno60","saw"],wave:"saw",cutoff:[1000,1900],detune:[.01,.018],attack:[.6,1.8],chorus:[1.3,1.8],chorusSpread:[.8,1],level:[.5,.7],send:[.55,.72],dsend:[.15,.3]}},   // the Juno-60 IS the band, drowned in the wet chorus-verb
      drums:{kickModel:["909","boom"],snareModel:["noise","clap"],hatModel:["noise"],kick:[1.15,1.4],snare:[.85,1.15],hat:[.5,.85],tune:[.95,1.08],send:[.2,.4],dsend:[.05,.15]},
      fx:{reverb:[.7,.86], delayBeats:[.375,.75], delayFb:[.25,.4], delayCut:[2200,3400], pump:[.04,.18], crackle:[0,.12], lowcut:[25,40], highcut:[0,0], comp:[.3,.55]},
      found:{role:"bed", vol:[.06,.14], pitch:[.85,1], stretch:[.45,.6], cutoff:[2000,3200], sources:["pool:road*1","pool:industry*1","pool:voices*1"]},
      stab:["off","sparse"], hits:{sources:["pool:vocal_stab*1","sp_nightdrive"], pattern:"sparse", prob:.35},
      form:"anthem" },
    /* genre-tool:hogcore:genres */
    hogcore: { label:"Perihelion Squeal", info:"A four-on-the-floor at 150-164. Saw synth bass under a saw synth pad, with a stacked saws lead. Four-chord changes, straight time, quantized tight.",
      bpm:[150,164],
      swing:[0,0.03],
      humanize:[0,0.1],
      progressions:["four_chords","sad_pop","doo_wop"],
      kits:["four","pulse"],
      fills:["riser","cut","impact","off"],
      bass:{patterns:["octaves","drive","root","stab"], recipe:{model:["saw","sub"], cutoff:[500,900], res:[0.12,0.24], level:[1.05,1.25], send:[0,0.06], dsend:[0,0.05]}},
      lead:{patterns:["hero","updown","double","pentaup"], recipe:{model:["stack","saw"], wave:"saw", voices:[3,5], spread:[0.008,0.016], cutoff:[3000,4200], level:[0.48,0.62], send:[0.2,0.35], dsend:[0.15,0.3]}},
      pads:{prob:0.55, recipe:{model:["saw"], wave:"saw", cutoff:[1400,2400], detune:[0.012,0.02], attack:[0.4,1.2], level:[0.5,0.68], send:[0.3,0.5], dsend:[0.1,0.25]}},
      drums:{kickModel:["909","boom"], snareModel:["clap"], hatModel:["noise","metal"], kick:[1.25,1.5], snare:[0.7,0.95], hat:[0.6,0.95], tune:[0.95,1.1], send:[0.1,0.25], dsend:[0.05,0.15]},
      fx:{reverb:[0.28,0.45], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[3000,4500], pump:[0.55,0.82], crackle:[0,0], lowcut:[30,45], highcut:[0,0], comp:[0.4,0.65]},
      found:{role:"chops", vol:[0.16,0.26], pitch:[1.15,1.5], stretch:[0.35,0.5], cutoff:[3500,6000], sources:["hp_harry","hp_hermione","hp_ron","hp_snape","hp_draco","hp_voldemort","hp_dumbledore","hp_hagrid"]},
      // a rotating HP character NAME under every bar — KERNEL-V4 buried sample-event
      // (was the bespoke `stations`/stationVol path): square-LFO gated at stationVol
      // 0.4, chased ~70% by the downward stutter tail
      sampleEvents:[{ pool:["hp_harry","hp_hermione","hp_ron","hp_dumbledore","hp_snape","hp_draco","hp_luna","hp_neville","hp_mcgonagall","hp_hagrid","hp_sirius","hp_bellatrix","hp_voldemort","hp_ginny","hp_cho","hp_cedric","hp_dobby","hp_hedwig","hp_buckbeak","hp_peeves","hp_nick","hp_myrtle","hp_filch","hp_crookshanks"],
        placement:"buried", sections:"all", treatment:{cutoff:5200, vol:0.4, glitch:true, every:2, maxDur:8} }],   // full "<name> is trans" phrases (to 2.61s): one per TWO bars, 8-beat cap so the phrase finishes
      hits:{sources:["hp_voldemort","hp_snape","hp_harry","hp_bellatrix"], pattern:"offbeat", prob:0.6},
      stab:["off"],
      autoTune:0.7,   // fx wings stage 2: the pitched-up name chops snap HARD to the key — the hyperpop coherence
      // (optional-intro: DECLINED for hogcore — introMode:"off" tightens its
      // already-fragile gabber pair from +2 to +1. Both are 150+ four-on-floor;
      // a cold open makes them MORE alike. breakcore carries the drop-form pilot
      // instead, where the amen cold-slam is equally iconic and margin-safe.)
      form:"drop" },
    /* /genre-tool:hogcore:genres */
    /* genre-tool:atlantidrone:genres */
    atlantidrone: { label:"Hadal Vespers", info:"Beatless at 52-62. Sub bass under ahh choir, with a church organ. A two-chord minor drone, one chord every 32 beats.",
      bpm:[52,62],
      swing:[0,0.03],
      humanize:[0.05,0.14],
      progressions:["drone_min","deep_two"],
      kits:["off"],
      fills:["off"],
      chordEvery:32,
      bass:{patterns:["pedal","sub","root"], recipe:{model:["sub","organ"], cutoff:[350,600], res:[0.05,0.12], level:[0.6,0.82], send:[0.25,0.45], dsend:[0,0.05]}},
      lead:{patterns:["off","sparse"], recipe:{model:["sampler","organ","dx7"], samplerPool:["church_organ"], patchPool:["PIPES   1"], wave:"sine", voices:[1,2], cutoff:[1600,2600], level:[0.3,0.44], send:[0.4,0.6], dsend:[0.1,0.2]}},
      pads:{prob:1, recipe:{model:["sampler","choir","vp330"], samplerPool:["ahh_choir"], wave:"saw", cutoff:[600,1100], detune:[0.006,0.016], attack:[3,5], level:[0.55,0.75], send:[0.6,0.82], dsend:[0.1,0.25], mellotron:true}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.3,0.5], snare:[0.2,0.35], hat:[0.2,0.35], tune:[0.85,0.98], send:[0.25,0.45], dsend:[0,0]},
      fx:{reverb:[0.55,0.75], delayBeats:[1,2], delayFb:[0.18,0.34], delayCut:[1600,2400], pump:[0,0], crackle:[0,0.1], lowcut:[0,0], highcut:[0,0], comp:[0,0.12]},
      found:{role:"bed", vol:[0.1,0.2], pitch:[0.7,0.9], stretch:[0.55,0.7], cutoff:[1400,2400], sources:["hydrophone","whale_song"]},
      hits:{sources:["pool:vb_maritime_weather*1","sp_herenow"], pattern:"sparse", prob:0.05},
      stab:["off"],
      form:"ritual",
      reverbColor:"greyhole" },
    /* /genre-tool:atlantidrone:genres */
    /* genre-tool:sourdough:genres */
    sourdough: { label:"Mother Culture Vigil", info:"Beatless at 55-64. Sub bass under a vocoder choir pad, with a sine tones lead. A two-chord minor drone, one chord every 32 beats.",
      bpm:[55,64],
      swing:[0,0.03],
      humanize:[0.05,0.14],
      progressions:["drone_min","deep_two"],
      kits:["off"],
      fills:["off"],
      chordEvery:32,
      bass:{patterns:["pedal","sub","root"], recipe:{model:["sub","saw"], cutoff:[350,600], res:[0.05,0.12], level:[0.6,0.8], send:[0.2,0.4], dsend:[0,0.05]}},
      lead:{patterns:["off","sparse"], recipe:{model:["sine","fm"], wave:"sine", voices:[1,1], cutoff:[1200,2000], level:[0.24,0.36], send:[0.4,0.6], dsend:[0.1,0.2]}},
      pads:{prob:1, recipe:{model:["vp330","organ","solina"], wave:"saw", cutoff:[600,1100], detune:[0.006,0.014], attack:[3,5], level:[0.55,0.75], send:[0.55,0.78], dsend:[0.1,0.25], mellotron:true}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.3,0.5], snare:[0.2,0.35], hat:[0.2,0.35], tune:[0.9,1], send:[0.2,0.4], dsend:[0,0]},
      fx:{reverb:[0.5,0.72], delayBeats:[1,2], delayFb:[0.15,0.3], delayCut:[1800,2600], pump:[0,0], crackle:[0.05,0.18], lowcut:[0,0], highcut:[0,0], comp:[0,0.12]},
      found:{role:"bed", vol:[0.1,0.2], pitch:[0.7,0.9], stretch:[0.55,0.7], cutoff:[1600,2600], sources:["ferment_bubble","pool:room*1"]},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.05},
      stab:["off"],
      form:"wave",
      reverbColor:"greyhole" },
    /* /genre-tool:sourdough:genres */
    /* genre-tool:crtwave:genres */
    crtwave: { label:"Phosphor Persistence", info:"A bare kick at 60-72. Sub bass under a string machine pad, with a sine tones lead. A two-chord minor drone, straight time, one chord every 16 beats.",
      bpm:[60,72],
      swing:[0,0.03],
      humanize:[0.04,0.12],
      progressions:["drone_min","deep_two"],
      kits:["off","kick"],
      fills:["off"],
      chordEvery:16,
      bass:{patterns:["pedal","sub","root"], recipe:{model:["sub","saw"], cutoff:[350,600], res:[0.06,0.14], level:[0.6,0.82], send:[0.15,0.35], dsend:[0,0.05]}},
      lead:{patterns:["off","sparse"], recipe:{model:["sine"], wave:"sine", voices:[1,1], cutoff:[3000,4500], level:[0.22,0.34], send:[0.3,0.5], dsend:[0.1,0.2]}},
      pads:{prob:0.9, recipe:{model:["solina","vp330","organ"], wave:"saw", cutoff:[700,1200], detune:[0.006,0.014], attack:[2,4], level:[0.48,0.65], send:[0.5,0.7], dsend:[0.1,0.2], mellotron:true}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.6,0.9], snare:[0.2,0.4], hat:[0.2,0.4], tune:[0.85,0.98], send:[0.2,0.4], dsend:[0,0.1]},
      fx:{reverb:[0.45,0.65], delayBeats:[0.75,1.5], delayFb:[0.15,0.3], delayCut:[1800,2800], pump:[0,0], crackle:[0.1,0.3], lowcut:[0,0], highcut:[0,0], comp:[0,0.15]},
      found:{role:"bed", vol:[0.08,0.18], pitch:[0.85,1], stretch:[0.5,0.7], cutoff:[1600,2600], sources:["pool:road*1","pool:industry*1"]},
      hits:{sources:["tw_ding"], pattern:"sparse", prob:0.1},
      stab:["off"],
      form:"wave",
      reverbColor:"greyhole" },
    /* /genre-tool:crtwave:genres */
    /* genre-tool:whalejazz:genres */
    whalejazz: { label:"Leviathan Turnaround", info:"A bossa kit at 60-72. Acoustic bass under strings, with a tenor sax. ii-V-I, swung, rubato.",
      timeFeel:{ pushPullMs:{ ride:-6, snare:8, bass:11 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — SWING at 66 — the slowest jazz in the space, so the widest budget: long patient phrases over a ride that still sits on top
      bpm:[60,72],
      swing:[0.12,0.2],
      humanize:[0.1,0.22],
      progressions:["ii_v_i","neosoul","mode_dorian"],
      kits:["bossa","off"],
      fills:["micro lick","off"],
      bass:{patterns:["walking","root","melodic"], recipe:{model:["sampler"], samplerPool:["acoustic_bass"], cutoff:[600,1000], level:[0.55,0.72], send:[0.2,0.35], dsend:[0,0.08]}},
      lead:{patterns:["sparse","wander","blues"], recipe:{model:["sampler","dx7"], samplerPool:["tenor_sax","muted_trumpet"], patchPool:["SAX BC"], wave:"sine", voices:[1,1], cutoff:[2000,3200], level:[0.42,0.56], send:[0.4,0.6], dsend:[0.1,0.25], vibrato:[0.004,0.01]}},
      pads:{prob:0.5, recipe:{model:["rhodes","strings","sampler"], samplerPool:["strings"], wave:"sine", cutoff:[900,1500], detune:[0.003,0.008], attack:[1.5,3], level:[0.38,0.52], send:[0.45,0.65], dsend:[0.1,0.2], mellotron:true}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.45,0.65], snare:[0.3,0.5], hat:[0.35,0.55], tune:[0.9,1], send:[0.25,0.45], dsend:[0,0.1], kit:"brush"},   // SAMPLED brush kit — soft ECM-jazz drums
      fx:{reverb:[0.5,0.7], delayBeats:[0.75,1.5], delayFb:[0.12,0.26], delayCut:[2000,3000], pump:[0,0], crackle:[0,0.12], lowcut:[0,0], highcut:[0,0], comp:[0.1,0.3]},
      found:{role:"bed", vol:[0.1,0.2], pitch:[0.8,0.95], stretch:[0.55,0.7], cutoff:[1800,2800], sources:["whale_song","hydrophone"]},
      rubato:{depth:[0.01,0.025], periodBars:[2,4], prob:0.5},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.08},
      stab:["off"],
      form:"wave",
      reverbColor:"dattorro" },
    /* /genre-tool:whalejazz:genres */
    /* genre-tool:termswave:genres */
    termswave: { label:"Hereinafter Forever", info:"Beatless at 60-74. Sub bass under a vocoder choir pad, with a sine tones lead. A two-chord minor drone, one chord every 16 beats.",
      bpm:[60,74],
      swing:[0,0.03],
      humanize:[0.05,0.15],
      progressions:["drone_min","deep_two","dream"],
      kits:["off"],
      fills:["off"],
      chordEvery:16,
      bass:{patterns:["root","pedal","sub"], recipe:{model:["sub","saw"], cutoff:[400,700], res:[0.05,0.12], level:[0.6,0.8], send:[0.2,0.4], dsend:[0,0.06]}},
      lead:{patterns:["off","sparse"], recipe:{model:["sine","fm"], wave:"sine", voices:[1,1], cutoff:[1600,2400], level:[0.28,0.4], send:[0.4,0.6], dsend:[0.1,0.25]}},
      pads:{prob:0.95, recipe:{model:["vp330","solina","strings"], wave:"saw", cutoff:[800,1400], detune:[0.006,0.014], attack:[2,4.5], level:[0.5,0.68], send:[0.5,0.72], dsend:[0.1,0.25], mellotron:true}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.3,0.5], snare:[0.2,0.4], hat:[0.2,0.4], tune:[0.9,1], send:[0.2,0.4], dsend:[0,0]},
      fx:{reverb:[0.5,0.7], delayBeats:[0.75,1.5], delayFb:[0.15,0.3], delayCut:[2000,2800], pump:[0,0], crackle:[0,0.08], lowcut:[0,0], highcut:[0,0], comp:[0,0.15]},
      found:{role:"narration", vol:[0.4,0.6], pitch:[0.98,1.04], stretch:[0.9,1.05], cutoff:[3200,4200], sources:["vx_burroughs","vx_whitman","vx_ginsberg_class"]},
      // CARD-TRUTH WAVE: the EULA reader (sp_eula_*) was registered speech wired to nothing
      // — "a flat, unbroken monotone reading the End User License Agreement". Buried, the
      // drone of consent riding clause after clause under every measure.
      sampleEvents:[{pool:["sp_eula_1","sp_eula_2","sp_eula_3"], placement:"buried", sections:"all", treatment:{cutoff:3800, vol:0.42, every:2, maxDur:8, rsend:0.15, dsend:0.12}}],
      hits:{sources:["pool:vb_spoken_poetic*1","sp_system"], pattern:"sparse", prob:0.05},
      stab:["off"],
      form:"wave",
      reverbColor:"greyhole" },
    /* /genre-tool:termswave:genres */
    /* genre-tool:microwave:genres */
    microwave: { label:"Magnetron Benediction", info:"Beatless at 66-78. A church organ under ahh choir, with a church organ. A canon.",
      bpm:[66,78],
      swing:[0,0.04],
      humanize:[0.06,0.16],
      progressions:["canon","royal_road","ii_v_i"],
      kits:["off"],
      fills:["off"],
      chordEvery:8,
      bass:{patterns:["root","pedal","simple"], recipe:{model:["sampler","organ"], samplerPool:["church_organ"], cutoff:[600,1100], level:[0.5,0.68], send:[0.2,0.4], dsend:[0,0.08]}},
      lead:{patterns:["composed","sparse","arpup"], recipe:{model:["sampler","dx7"], samplerPool:["church_organ","celesta"], patchPool:["PIPES   1"], wave:"sine", voices:[1,2], cutoff:[2000,3000], level:[0.4,0.52], send:[0.35,0.55], dsend:[0.1,0.2]}},
      pads:{prob:0.85, recipe:{model:["sampler","choir","strings"], samplerPool:["ahh_choir"], wave:"saw", cutoff:[900,1500], detune:[0.004,0.01], attack:[1.5,3.5], level:[0.5,0.66], send:[0.5,0.7], dsend:[0.1,0.2], mellotron:true}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.4,0.6], snare:[0.25,0.45], hat:[0.25,0.45], tune:[0.9,1], send:[0.2,0.4], dsend:[0,0]},
      fx:{reverb:[0.5,0.7], delayBeats:[0.75,1.5], delayFb:[0.12,0.26], delayCut:[2000,3000], pump:[0,0], crackle:[0,0.1], lowcut:[0,0], highcut:[0,0], comp:[0,0.15]},
      found:{role:"bed", vol:[0.05,0.12], pitch:[0.9,1.02], stretch:[0.45,0.6], cutoff:[2000,3000], sources:["dw_cycle","pool:city*1"]},
      sampleEvents:[{pool:["tw_ding"], placement:"cadence", sections:"all", treatment:{cutoff:5000, vol:0.5}},
        // CARD-TRUTH WAVE: the grace-before-the-meal recitations (sp_grace_*) were registered
        // speech wired to nothing — this genre IS "Grace Before Microwave", the solemn hymn of
        // thanks. Buried, the blessing murmured over the church organ before the three beeps.
        {pool:["sp_grace_1","sp_grace_2"], placement:"buried", sections:"all", treatment:{cutoff:3800, vol:0.42, every:2, maxDur:8, rsend:0.16, dsend:0.12}}],
      hits:{sources:["pool:vb_domestic_appliance*1","tw_ding","sp_herenow"], pattern:"response", prob:0.3},
      stab:["off"],
      form:"ritual",
      reverbColor:"greyhole" },
    /* /genre-tool:microwave:genres */
    /* genre-tool:airtrafficdrone:genres */
    airtrafficdrone: { label:"Squawk Ineffable", info:"A bare kick at 70-84. Sub bass under a vocoder choir pad, with a sine tones lead. A two-chord minor drone, straight time, one chord every 16 beats.",
      bpm:[70,84],
      swing:[0,0.04],
      humanize:[0.04,0.12],
      progressions:["drone_min","deep_two","dream"],
      kits:["off","kick"],
      fills:["off","dropout"],
      chordEvery:16,
      bass:{patterns:["pedal","sub","root"], recipe:{model:["sub","saw"], cutoff:[380,650], res:[0.06,0.14], level:[0.6,0.82], send:[0.15,0.35], dsend:[0,0.05]}},
      lead:{patterns:["off","sparse"], recipe:{model:["sine","fm"], wave:"sine", voices:[1,1], cutoff:[1400,2200], level:[0.24,0.36], send:[0.35,0.55], dsend:[0.1,0.2]}},
      pads:{prob:0.9, recipe:{model:["vp330","solina","strings"], wave:"saw", cutoff:[800,1400], detune:[0.006,0.014], attack:[2,4], level:[0.48,0.64], send:[0.5,0.7], dsend:[0.1,0.2], mellotron:true}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.4,0.65], snare:[0.25,0.45], hat:[0.25,0.45], tune:[0.9,1], send:[0.2,0.4], dsend:[0,0.05]},
      fx:{reverb:[0.45,0.65], delayBeats:[0.75,1.5], delayFb:[0.15,0.3], delayCut:[2000,3000], pump:[0,0], crackle:[0,0.12], lowcut:[0,0], highcut:[0,0], comp:[0.1,0.3]},
      found:{role:"narration", vol:[0.35,0.55], pitch:[0.98,1.05], stretch:[0.9,1.05], cutoff:[2600,3600], sources:["vx_apollo"]},
      // CARD-TRUTH WAVE: the ATC read-backs (sp_atc_*) were registered speech wired to
      // nothing — "the phonetic alphabet as a lullaby". Buried and sparse (one every 4
      // bars), calm and muffled: unflappable, at the edge of sleep.
      sampleEvents:[{pool:["sp_atc_1","sp_atc_2","sp_atc_3","sp_atc_4","sp_atc_5"], placement:"buried", sections:"all", treatment:{cutoff:3600, vol:0.4, every:4, maxDur:10, rsend:0.2, dsend:0.14}}],
      hits:{sources:["sp_system","tw_ding"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"wave",
      reverbColor:"greyhole" },
    /* /genre-tool:airtrafficdrone:genres */
    /* genre-tool:faxbossa:genres */
    faxbossa: { label:"Thermal Paper Saudade", info:"A bossa kit at 74-86. Acoustic bass under a string machine pad, with a nylon string guitar. ii-V-I, swung, rubato.",
      bpm:[74,86],
      swing:[0.08,0.16],
      humanize:[0.08,0.18],
      progressions:["ii_v_i","neosoul","lofi"],
      kits:["bossa","shuffle"],
      fills:["micro lick","off"],
      bass:{patterns:["walking","root","melodic"], recipe:{model:["sampler","sub"], samplerPool:["acoustic_bass","fretless_bass"], cutoff:[600,1000], level:[0.55,0.72], send:[0.2,0.35], dsend:[0,0.08]}},
      lead:{patterns:["composed","sparse","wander"], recipe:{model:["sampler","dx7"], samplerPool:["nylon_string_guitar","jazz_guitar"], patchPool:["CLAS.GUIT"], wave:"sine", voices:[1,2], cutoff:[2400,3400], level:[0.42,0.55], send:[0.3,0.5], dsend:[0.1,0.25]}},
      pads:{prob:0.55, recipe:{model:["solina","rhodes","vp330"], wave:"saw", cutoff:[900,1500], detune:[0.004,0.01], attack:[1,2.5], level:[0.4,0.55], send:[0.4,0.6], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom"], snareModel:["noise","crack"], hatModel:["noise"], kick:[0.5,0.72], snare:[0.35,0.55], hat:[0.4,0.6], tune:[0.9,1.02], send:[0.2,0.4], dsend:[0,0.1]},
      fx:{reverb:[0.4,0.6], delayBeats:[0.5,0.9], delayFb:[0.12,0.28], delayCut:[2200,3200], pump:[0,0], crackle:[0,0.12], lowcut:[0,0], highcut:[0,0], comp:[0.15,0.35]},
      found:{role:"bed", vol:[0.06,0.14], pitch:[0.9,1.05], stretch:[0.45,0.6], cutoff:[2200,3400], sources:["pool:city*1","fax_tone"]},
      // CARD-TRUTH WAVE: sp_fax_nocarrier ("NO CARRIER") was registered speech wired to
      // nothing — "the handshake that never completes". A single announcement at each
      // section's end: the connection giving up.
      sampleEvents:[{pool:["sp_fax_nocarrier"], placement:"cadence", sections:"all", treatment:{cutoff:4200, vol:0.44, rsend:0.15, dsend:0.12}}],
      rubato:{depth:[0.008,0.018], periodBars:[2,4], prob:0.35},
      hits:{sources:["tw_ding"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"aaba",
      reverbColor:"spring" },
    /* /genre-tool:faxbossa:genres */
    /* genre-tool:crickettempo:genres */
    crickettempo: { label:"Chirp Thermometry", info:"A half-time kit at 76-90. Acoustic bass under a vocoder choir pad, with a kalimba. Neo-soul changes, a light shuffle.",
      bpm:[76,90],
      swing:[0.04,0.1],
      humanize:[0.08,0.18],
      progressions:["neosoul","dream","lofi"],
      kits:["halftime","bossa"],
      fills:["off","micro lick"],
      bass:{patterns:["root","simple","walking"], recipe:{model:["sub","sampler"], samplerPool:["acoustic_bass"], cutoff:[500,900], level:[0.55,0.75], send:[0.15,0.3], dsend:[0,0.08]}},
      lead:{patterns:["sparse","wander","pentaup"], recipe:{model:["sampler","kpluck","dx7"], samplerPool:["kalimba","kalimba","celesta"], wave:"sine", voices:[1,2], cutoff:[2400,3400], level:[0.4,0.52], send:[0.35,0.55], dsend:[0.1,0.25]}},
      pads:{prob:0.6, recipe:{model:["vp330","solina"], wave:"saw", cutoff:[900,1500], detune:[0.005,0.012], attack:[1.5,3], level:[0.4,0.55], send:[0.4,0.6], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom"], snareModel:["noise","crack"], hatModel:["noise"], kick:[0.6,0.85], snare:[0.4,0.6], hat:[0.4,0.65], tune:[0.92,1.02], send:[0.2,0.4], dsend:[0,0.1]},
      fx:{reverb:[0.4,0.6], delayBeats:[0.5,0.9], delayFb:[0.15,0.3], delayCut:[2200,3200], pump:[0,0.1], crackle:[0,0.12], lowcut:[0,0], highcut:[0,0], comp:[0.15,0.35]},
      found:{role:"bed", vol:[0.12,0.22], pitch:[0.9,1.05], stretch:[0.5,0.7], cutoff:[2400,4000], sources:["frogs","crickets"]},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.1},
      stab:["off"],
      form:"wave" },
    /* /genre-tool:crickettempo:genres */
    /* genre-tool:thermostatwave:genres */
    thermostatwave: { label:"Setpoint Schism", info:"A bare kick at 84-96. Sub bass under a string machine pad, with a sine tones lead. A two-chord minor drone, a light shuffle, one chord every 16 beats.",
      bpm:[84,96],
      swing:[0,0.05],
      humanize:[0.03,0.1],
      progressions:["drone_min","deep_two"],
      kits:["off","kick"],
      fills:["off","dropout"],
      chordEvery:16,
      bass:{patterns:["pedal","sub","root"], recipe:{model:["sub","saw"], cutoff:[380,650], res:[0.06,0.14], level:[0.6,0.82], send:[0.1,0.3], dsend:[0,0.06]}},
      lead:{patterns:["off","sparse"], recipe:{model:["sine","organ"], wave:"sine", voices:[1,1], cutoff:[1200,2000], level:[0.26,0.38], send:[0.35,0.55], dsend:[0.1,0.2]}},
      pads:{prob:0.9, recipe:{model:["solina","vp330","organ"], wave:"saw", cutoff:[700,1200], detune:[0.005,0.012], attack:[2,4], level:[0.45,0.62], send:[0.45,0.65], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.4,0.65], snare:[0.25,0.45], hat:[0.25,0.45], tune:[0.9,1], send:[0.15,0.3], dsend:[0,0.05]},
      fx:{reverb:[0.4,0.6], delayBeats:[0.75,1.25], delayFb:[0.15,0.3], delayCut:[1800,2800], pump:[0,0.1], crackle:[0,0.1], lowcut:[0,0], highcut:[0,0], comp:[0.1,0.3]},
      found:{role:"bed", vol:[0.1,0.2], pitch:[0.85,1], stretch:[0.5,0.7], cutoff:[1600,2600], sources:["pool:industry*1","hvac_hum"]},
      // CARD-TRUTH WAVE: the thermostat passive-aggression (sp_therm_*) was registered
      // speech wired to nothing — "in the key of who touched the thermostat". Buried,
      // muffled and quiet: the resentful muttering you can only hear at night.
      sampleEvents:[{pool:["sp_therm_1","sp_therm_2","sp_therm_3"], placement:"buried", sections:"all", treatment:{cutoff:3800, vol:0.38, every:2, maxDur:8, rsend:0.15, dsend:0.12}}],
      hits:{sources:["pool:vb_domestic_appliance*1","sp_system","tw_ding"], pattern:"sparse", prob:0.1},
      stab:["off"],
      form:"wave",
      reverbColor:"greyhole" },
    /* /genre-tool:thermostatwave:genres */
    /* genre-tool:holdmusic:genres */
    holdmusic: { label:"Unresolved In Perpetuity", info:"A shuffle at 96-108. Acoustic bass under Rhodes, with a pan flute. ii-V-I, swung.",
      bpm:[96,108],
      swing:[0.08,0.14],
      humanize:[0.1,0.2],
      progressions:["ii_v_i","lofi","neosoul"],
      kits:["off","shuffle"],
      fills:["off","micro lick"],
      chordEvery:8,
      bass:{patterns:["root","simple","walking"], recipe:{model:["rhodes","sampler","piano"], samplerPool:["acoustic_bass"], cutoff:[600,1100], level:[0.55,0.72], send:[0.2,0.35], dsend:[0,0.1]}},
      lead:{patterns:["sparse","wander","off"], recipe:{model:["sampler","sampler","fm"], samplerPool:["pan_flute","flute"], wave:"sine", voices:[1,2], cutoff:[2200,3200], level:[0.4,0.52], send:[0.3,0.5], dsend:[0.1,0.25], vibrato:[0.004,0.01]}},
      pads:{prob:0.7, recipe:{model:["rhodes","juno60","solina"], wave:"saw", cutoff:[900,1500], detune:[0.004,0.01], attack:[0.4,1.2], level:[0.4,0.55], send:[0.35,0.55], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom"], snareModel:["noise","clap"], hatModel:["noise"], kick:[0.5,0.75], snare:[0.35,0.55], hat:[0.3,0.5], tune:[0.9,1.02], send:[0.2,0.4], dsend:[0,0.1]},
      fx:{reverb:[0.4,0.6], delayBeats:[0.5,0.75], delayFb:[0.15,0.3], delayCut:[2400,3400], pump:[0,0], crackle:[0,0.1], lowcut:[0,0], highcut:[0,0], comp:[0.15,0.35]},
      found:{role:"bed", vol:[0.05,0.12], pitch:[0.9,1.05], stretch:[0.4,0.6], cutoff:[2000,3200], sources:["pool:city*2"]},
      sampleEvents:[{pool:["sp_system","sp_herenow"], placement:"cadence", sections:"all", treatment:{cutoff:3000, vol:0.42}},
        // CARD-TRUTH WAVE: the hold-music apologies (sp_hold_*) were registered speech wired to
        // nothing — "your call is important to us — please continue to hold". Buried and spaced
        // (one every 4 bars) as the periodic interruption the card describes.
        {pool:["sp_hold_1","sp_hold_2","sp_hold_3","sp_hold_4"], placement:"buried", sections:"all", treatment:{cutoff:4000, vol:0.42, every:4, maxDur:10, rsend:0.16, dsend:0.12}}],
      hits:{sources:["sp_system","sp_herenow","sp_slowdown"], pattern:"sparse", prob:0.35},
      stab:["off"],
      form:"wave",
      reverbColor:"spring" },
    /* /genre-tool:holdmusic:genres */
    /* genre-tool:lunapolka:genres */
    lunapolka: { label:"Regolith Oompah", info:"A half-time kit at 96-108. A tuba under an Oberheim pad, with an accordion. Doo-wop changes, swung.",
      bpm:[96,108],
      swing:[0.08,0.16],
      humanize:[0.08,0.2],
      progressions:["doo_wop","canon","royal_road"],
      kits:["halftime","shuffle"],
      fills:["tom fill","micro lick"],
      bass:{patterns:["root","octaves","walking"], recipe:{model:["sampler","sub"], samplerPool:["tuba"], cutoff:[500,900], level:[0.55,0.75], send:[0.15,0.3], dsend:[0,0.08]}},
      lead:{patterns:["composed","wander","updown"], recipe:{model:["sampler","sampler"], samplerPool:["accordion","bandoneon"], wave:"sine", voices:[1,2], cutoff:[2000,3000], level:[0.42,0.55], send:[0.3,0.5], dsend:[0.1,0.25], release:[0.4,0.7]}},
      pads:{prob:0.55, recipe:{model:["oberheim","solina","vp330"], wave:"saw", cutoff:[900,1500], detune:[0.006,0.014], attack:[1,2.5], level:[0.4,0.55], send:[0.4,0.6], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom"], snareModel:["noise","crack"], hatModel:["noise"], kick:[0.6,0.85], snare:[0.4,0.6], hat:[0.35,0.6], tune:[0.9,1.02], send:[0.2,0.4], dsend:[0,0.1]},
      fx:{reverb:[0.45,0.65], delayBeats:[0.75,1.25], delayFb:[0.15,0.3], delayCut:[2200,3200], pump:[0,0], crackle:[0,0.12], lowcut:[0,0], highcut:[0,0], comp:[0.1,0.3]},
      found:{role:"bed", vol:[0.06,0.14], pitch:[0.9,1.05], stretch:[0.5,0.7], cutoff:[2200,3400], sources:["pool:city*2"]},
      // CARD-TRUTH WAVE: the lunar-colony toasts (sp_luna_*) were registered speech wired
      // to nothing — the beer stein rising over the low-gravity oom-pah. Buried, a toast
      // rotating under the dance.
      sampleEvents:[{pool:["sp_luna_1","sp_luna_2"], placement:"buried", sections:"all", treatment:{cutoff:4200, vol:0.4, every:2, maxDur:8, rsend:0.15, dsend:0.12}}],
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.12},
      stab:["off"],
      form:"pop",
      reverbColor:"greyhole" },
    /* /genre-tool:lunapolka:genres */
    /* genre-tool:elevatorcore:genres */
    elevatorcore: { label:"Mezzanine Ascension", info:"A shuffle at 100-112. Acoustic bass under Rhodes, with a vibraphone. Lo-fi changes, swung.",
      bpm:[100,112],
      swing:[0.1,0.16],
      humanize:[0.08,0.18],
      progressions:["lofi","neosoul","doo_wop"],
      kits:["shuffle","bossa"],
      fills:["micro lick","kit fill"],
      bass:{patterns:["walking","root","simple"], recipe:{model:["sampler","rhodes"], samplerPool:["acoustic_bass"], cutoff:[600,1000], level:[0.55,0.72], send:[0.15,0.3], dsend:[0,0.08]}},
      lead:{patterns:["composed","sparse","wander"], recipe:{model:["sampler","rhodes","dx7"], samplerPool:["vibraphone","celesta"], patchPool:["VIBE    1"], wave:"sine", voices:[1,2], cutoff:[2400,3600], level:[0.42,0.55], send:[0.3,0.5], dsend:[0.1,0.25]}},
      pads:{prob:0.6, recipe:{model:["rhodes","juno60"], wave:"saw", cutoff:[1000,1600], detune:[0.004,0.009], attack:[0.5,1.2], level:[0.4,0.55], send:[0.35,0.55], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom"], snareModel:["noise","clap"], hatModel:["noise"], kick:[0.6,0.85], snare:[0.4,0.6], hat:[0.4,0.6], tune:[0.92,1.02], send:[0.15,0.35], dsend:[0,0.1]},
      fx:{reverb:[0.35,0.55], delayBeats:[0.5,0.75], delayFb:[0.12,0.28], delayCut:[2600,3600], pump:[0,0], crackle:[0,0.1], lowcut:[0,0], highcut:[0,0], comp:[0.2,0.4]},
      found:{role:"bed", vol:[0.05,0.12], pitch:[0.95,1.08], stretch:[0.4,0.6], cutoff:[2400,3400], sources:["pool:city*2"]},
      // CARD-TRUTH WAVE: the elevator floor calls (sp_floor_*) were registered speech wired
      // to nothing — "going up: third floor, ladies' outerwear". Buried, the floor
      // announcements riding the endless ascent.
      sampleEvents:[{pool:["sp_floor_1","sp_floor_2","sp_floor_3","sp_floor_4","sp_floor_5","sp_floor_6"], placement:"buried", sections:"all", treatment:{cutoff:4300, vol:0.42, every:2, maxDur:9, rsend:0.15, dsend:0.12}}],
      thunk:{prob:0.6},
      hits:{sources:["tw_ding","sp_shopping"], pattern:"sparse", prob:0.3},
      stab:["off"],
      form:"throughline",
      reverbColor:"spring" },
    /* /genre-tool:elevatorcore:genres */
    /* genre-tool:hotsaucecore:genres */
    hotsaucecore: { label:"Capsaicin Ordeal", info:"A tribal kit at 100-116. 303 line bass under an Oberheim pad, with a trumpet. A funk vamp, a light shuffle.",
      bpm:[100,116],
      swing:[0.02,0.1],
      humanize:[0.05,0.14],
      progressions:["funk_vamp","mode_phrygian","andalusian"],
      kits:["tribal","bossa"],
      fills:["kit fill","riser","impact"],
      bass:{patterns:["syncopated","habanera","walking"], recipe:{model:["tb303","reese","saw"], cutoff:[500,900], res:[0.2,0.35], level:[1,1.2], send:[0,0.08], dsend:[0.05,0.12], inserts:{prob:0.5, max:1, pool:[["distort",{drive:[0.2,0.5], mix:[0.5,0.85]}]]}}},
      lead:{patterns:["blues","wander","hero"], recipe:{model:["sampler","dx7","brass"], samplerPool:["trumpet","muted_trumpet"], patchPool:["BR TRUMPET"], wave:"sine", voices:[1,2], cutoff:[2400,3600], level:[0.44,0.58], send:[0.3,0.5], dsend:[0.1,0.25], inserts:{prob:0.5, max:1, pool:[["distort",{drive:[0.15,0.4], mix:[0.4,0.7]}]]}}},
      pads:{prob:0.4, recipe:{model:["oberheim","organ"], wave:"saw", cutoff:[1000,1700], detune:[0.006,0.012], attack:[0.4,1], level:[0.38,0.52], send:[0.3,0.5], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom","808"], snareModel:["crack","clap"], hatModel:["metal","noise"], kick:[1,1.3], snare:[0.6,0.85], hat:[0.6,0.95], tune:[0.98,1.12], send:[0.1,0.25], dsend:[0.1,0.25]},
      fx:{reverb:[0.3,0.48], delayBeats:[0.375,0.6], delayFb:[0.2,0.35], delayCut:[3000,4500], pump:[0.3,0.55], crackle:[0,0.08], lowcut:[35,50], highcut:[0,0], comp:[0.4,0.6], grit:[0.2,0.5]},
      found:{role:"chops", vol:[0.12,0.22], pitch:[1,1.35], stretch:[0.35,0.55], cutoff:[3500,6000], sources:["horns_78","rave_b"]},
      // CARD-TRUTH WAVE: the scoville dares (sp_scoville_*) were registered speech wired to
      // nothing — "a challenge you regret accepting". Buried, the dares egging on each
      // hotter section.
      sampleEvents:[{pool:["sp_scoville_1","sp_scoville_2","sp_scoville_3","sp_scoville_4","sp_scoville_5"], placement:"buried", sections:"all", treatment:{cutoff:4500, vol:0.4, every:2, maxDur:8, rsend:0.15, dsend:0.12}}],
      hits:{sources:["bb_horn_a","pool:rave_stab*1"], pattern:"offbeat", prob:0.4},
      stab:["offbeat"],
      form:"throughline" },
    /* /genre-tool:hotsaucecore:genres */
    /* genre-tool:ikeacore:genres */
    ikeacore: { label:"Dowel Not Included", info:"AN electro kit at 116-124. Minimoog lead bass under an Oberheim pad, with a phase-distortion lead. A two-chord minor drone, straight time, quantized tight, euclidean hats.",
      bpm:[116,124],
      swing:[0,0.04],
      humanize:[0,0.08],
      progressions:["drone_min","mode_dorian","deep_two"],
      kits:["electro","techno"],
      fills:["off","cut","stutter"],
      euclid:{hat:[5,16]},
      bass:{patterns:["stab","rolling","sixteenths"], recipe:{model:["modeld","saw","reese"], cutoff:[500,850], res:[0.15,0.28], level:[1,1.18], send:[0,0.06], dsend:[0.05,0.12]}},
      lead:{patterns:["double","arpup","off"], recipe:{model:["casiocz","modeld","pluck"], wave:"square", voices:[1,2], cutoff:[1800,2800], level:[0.34,0.48], send:[0.15,0.3], dsend:[0.15,0.3]}},
      pads:{prob:0.35, recipe:{model:["oberheim","organ"], wave:"saw", cutoff:[900,1500], detune:[0.004,0.01], attack:[0.4,1], level:[0.35,0.5], send:[0.25,0.45], dsend:[0.1,0.2]}},
      drums:{kickModel:["808","909"], snareModel:["clap","noise"], hatModel:["metal"], kick:[1,1.25], snare:[0.5,0.7], hat:[0.8,1.1], tune:[1,1.12], send:[0.05,0.15], dsend:[0.1,0.2]},
      fx:{reverb:[0.2,0.38], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[3000,4500], pump:[0.35,0.55], crackle:[0,0.05], lowcut:[35,50], highcut:[0,0], comp:[0.4,0.6]},
      found:{role:"chops", vol:[0.12,0.2], pitch:[1,1.3], stretch:[0.35,0.5], cutoff:[4000,6000], sources:["sp_st_slussen","sp_st_centraal"]},
      // CARD-TRUTH WAVE: the flat-pack step narration (sp_flatpack_*) was registered speech
      // wired to nothing — the six-step instructional voice. Buried, the calm assembly
      // narration over the Nordic pulse.
      sampleEvents:[{pool:["sp_flatpack_1","sp_flatpack_2","sp_flatpack_3","sp_flatpack_4","sp_flatpack_5"], placement:"buried", sections:"all", treatment:{cutoff:4400, vol:0.4, every:2, maxDur:10, rsend:0.15, dsend:0.12}}],
      hits:{sources:["sp_st_slussen","tw_ding"], pattern:"offbeat", prob:0.35},
      stab:["offbeat"],
      form:"dj" },
    /* /genre-tool:ikeacore:genres */
    /* genre-tool:zubrovia:genres */
    zubrovia: { label:"Zubrovian Irredenta", info:"A tribal kit at 112-126. Acoustic bass under ahh choir, with an accordion. A hijaz maqam, a light shuffle.",
      bpm:[112,126],
      swing:[0,0.06],
      humanize:[0.05,0.14],
      progressions:["hijaz","andalusian","epic_min"],
      kits:["tribal","full"],
      fills:["tom fill","kit fill","impact"],
      bass:{patterns:["root","octaves","walking"], recipe:{model:["brass","sampler","dx7"], samplerPool:["acoustic_bass"], patchPool:["BASS    2"], cutoff:[600,1000], level:[0.6,0.82], send:[0.1,0.3], dsend:[0,0.08]}},
      lead:{patterns:["anthem","hero","wander"], recipe:{model:["sampler","sampler","brass"], samplerPool:["accordion","french_horns","trumpet"], patchPool:["BRASS   1"], wave:"sine", voices:[1,2], cutoff:[2200,3400], level:[0.44,0.58], send:[0.3,0.5], dsend:[0.1,0.25], vibrato:[0.003,0.008]}},
      pads:{prob:0.7, recipe:{model:["sampler","choir","strings"], samplerPool:["ahh_choir","strings"], wave:"saw", cutoff:[900,1600], detune:[0.005,0.012], attack:[1,2.5], level:[0.45,0.62], send:[0.4,0.6], dsend:[0.1,0.2], mellotron:true}},
      drums:{kickModel:["boom"], snareModel:["crack","noise"], hatModel:["noise","metal"], kick:[0.8,1.1], snare:[0.5,0.75], hat:[0.4,0.65], tune:[0.94,1.06], send:[0.15,0.35], dsend:[0.05,0.15]},
      fx:{reverb:[0.4,0.6], delayBeats:[0.5,0.9], delayFb:[0.12,0.28], delayCut:[2400,3400], pump:[0,0.1], crackle:[0,0.12], lowcut:[0,0], highcut:[0,0], comp:[0.2,0.4]},
      found:{role:"bed", vol:[0.1,0.2], pitch:[0.92,1.05], stretch:[0.5,0.7], cutoff:[2400,3800], sources:["vx_sv_choir","vx_sv_march"]},
      sampleEvents:[{pool:["vx_sv_choir","vx_sv_march"], placement:"opener", sections:"all", treatment:{cutoff:3600, vol:0.4}},
        // CARD-TRUTH WAVE: the Zubrovian anthems (sp_zubrovia_*) were registered speech wired to
        // nothing — "a choir singing in an invented language, broadcast nightly". Buried and
        // spaced (long clips, one every 4 bars) so each anthem line finishes.
        {pool:["sp_zubrovia_1","sp_zubrovia_2","sp_zubrovia_3"], placement:"buried", sections:"all", treatment:{cutoff:4000, vol:0.4, every:4, maxDur:14, rsend:0.16, dsend:0.12}}],
      hits:{sources:["pool:horn_stab*1","bb_horn_a"], pattern:"response", prob:0.3},
      stab:["off"],
      form:"anthem" },
    /* /genre-tool:zubrovia:genres */
    /* genre-tool:dishwasherwave:genres */
    dishwasherwave: { label:"Heated Dry Eternity", info:"A machine four at 120-126. Sub bass with an organ on both pad and lead. A two-chord minor drone, a light shuffle, quantized tight, euclidean hats.",
      bpm:[120,126],
      swing:[0,0.05],
      humanize:[0,0.1],
      progressions:["drone_min","deep_two"],
      kits:["techno","pulse"],
      fills:["off","cut","dropout"],
      euclid:{hat:[9,16]},
      bass:{patterns:["rolling","sub","pedal"], recipe:{model:["sub","acid"], cutoff:[420,700], res:[0.18,0.32], level:[1,1.2], send:[0,0.08], dsend:[0.05,0.12]}},
      lead:{patterns:["off","double"], recipe:{model:["organ","pluck"], wave:"square", voices:[1,1], cutoff:[1400,2200], level:[0.3,0.42], send:[0.2,0.35], dsend:[0.15,0.3]}},
      pads:{prob:0.5, recipe:{model:["organ","solina"], wave:"saw", cutoff:[700,1200], detune:[0.004,0.01], attack:[1.5,3], level:[0.4,0.55], send:[0.35,0.55], dsend:[0.1,0.2]}},
      drums:{kickModel:["909"], snareModel:["clap","crack"], hatModel:["metal","noise"], kick:[1.15,1.4], snare:[0.5,0.75], hat:[0.7,1], tune:[0.96,1.08], send:[0.05,0.15], dsend:[0.1,0.2]},
      fx:{reverb:[0.3,0.5], delayBeats:[0.5,0.75], delayFb:[0.25,0.4], delayCut:[2400,3600], pump:[0.45,0.68], crackle:[0,0.1], lowcut:[35,50], highcut:[0,0], comp:[0.45,0.65]},
      found:{role:"bed", vol:[0.1,0.2], pitch:[0.9,1.1], stretch:[0.5,0.7], cutoff:[2000,3200], sources:["pool:industry*1","dw_cycle"]},
      // CARD-TRUTH WAVE: sp_dw_done ("cycle complete") was registered speech wired to
      // nothing — the card says it "arrives like a drop at 2 a.m." A single announcement
      // at each section's end.
      sampleEvents:[{pool:["sp_dw_done"], placement:"cadence", sections:"all", treatment:{cutoff:4000, vol:0.46, rsend:0.15, dsend:0.12}}],
      hits:{sources:["pool:vb_domestic_appliance*1","tw_ding","sp_system"], pattern:"sparse", prob:0.25},
      stab:["off"],
      form:"dj" },
    /* /genre-tool:dishwasherwave:genres */
    /* genre-tool:surveywave:genres */
    surveywave: { label:"Ten Being Highest", info:"A four-on-the-floor at 118-126. Juno pad bass under a Juno pad, with a hard-sync lead. Four-chord changes, a light shuffle.",
      bpm:[118,126],
      swing:[0,0.05],
      humanize:[0.03,0.12],
      progressions:["four_chords","pop_1625","doo_wop"],
      kits:["four","pulse"],
      fills:["riser","impact","cut"],
      bass:{patterns:["octaves","drive","root"], recipe:{model:["juno60","saw"], cutoff:[600,1000], res:[0.1,0.2], level:[1,1.2], send:[0,0.06], dsend:[0,0.06]}},
      lead:{patterns:["hero","updown","double"], recipe:{model:["synclead","juno60","stack"], wave:"saw", voices:[2,4], spread:[0.006,0.014], cutoff:[2800,4000], level:[0.46,0.6], send:[0.2,0.35], dsend:[0.1,0.25]}},
      pads:{prob:0.55, recipe:{model:["juno60","saw"], wave:"saw", cutoff:[1400,2200], detune:[0.01,0.018], attack:[0.3,0.9], level:[0.45,0.6], send:[0.3,0.5], dsend:[0.1,0.2]}},
      drums:{kickModel:["909","boom"], snareModel:["clap"], hatModel:["noise","metal"], kick:[1.1,1.35], snare:[0.6,0.85], hat:[0.6,0.9], tune:[0.98,1.1], send:[0.1,0.25], dsend:[0.05,0.15]},
      fx:{reverb:[0.28,0.45], delayBeats:[0.375,0.5], delayFb:[0.18,0.32], delayCut:[3200,4500], pump:[0.4,0.62], crackle:[0,0], lowcut:[30,45], highcut:[0,0], comp:[0.35,0.55]},
      found:{role:"chops", vol:[0.12,0.2], pitch:[1.1,1.4], stretch:[0.35,0.5], cutoff:[3500,6000], sources:["sp_system","tw_ding"]},
      sampleEvents:[{pool:["tw_ding","sp_system"], placement:"response", sections:"all", treatment:{cutoff:5000, vol:0.42}},
        // CARD-TRUTH WAVE: the survey prompts (sp_survey_*) were registered speech wired to
        // nothing — "on a scale of one to ten, how likely are you to recommend us?". Buried,
        // the chirpy questions riding the corporate-pop bounce.
        {pool:["sp_survey_1","sp_survey_2","sp_survey_3","sp_survey_4"], placement:"buried", sections:"all", treatment:{cutoff:4400, vol:0.42, every:2, maxDur:10, rsend:0.15, dsend:0.12}}],
      hits:{sources:["sp_system","tw_ding","sp_shopping"], pattern:"offbeat", prob:0.45},
      stab:["offbeat"],
      form:"duet" },
    /* /genre-tool:surveywave:genres */
    /* genre-tool:aldente:genres */
    aldente: { label:"Rolling Boil Plateau", info:"A machine four at 122-128. Sub bass under an organ, with a pluck lead. A two-chord minor drone, straight time, quantized tight, euclidean hats, one chord every 16 beats.",
      bpm:[122,128],
      swing:[0,0.04],
      humanize:[0,0.08],
      progressions:["drone_min","deep_two"],
      kits:["techno","pulse"],
      fills:["off","cut","dropout"],
      euclid:{hat:[11,16]},
      chordEvery:16,
      bass:{patterns:["rolling","pedal","sub"], recipe:{model:["sub","acid"], cutoff:[400,700], res:[0.18,0.3], level:[1,1.2], send:[0,0.06], dsend:[0.05,0.12]}},
      lead:{patterns:["off","double"], recipe:{model:["pluck","organ"], wave:"square", voices:[1,1], cutoff:[1400,2200], level:[0.28,0.4], send:[0.2,0.35], dsend:[0.15,0.3]}},
      pads:{prob:0.35, recipe:{model:["organ","solina"], wave:"saw", cutoff:[700,1200], detune:[0.004,0.01], attack:[2,4], level:[0.35,0.5], send:[0.35,0.55], dsend:[0.1,0.2]}},
      drums:{kickModel:["909"], snareModel:["clap"], hatModel:["metal"], kick:[1.1,1.35], snare:[0.45,0.7], hat:[0.7,1], tune:[0.98,1.08], send:[0.05,0.15], dsend:[0.1,0.2]},
      fx:{reverb:[0.3,0.5], delayBeats:[0.5,0.75], delayFb:[0.25,0.4], delayCut:[2400,3600], pump:[0.4,0.62], crackle:[0,0.08], lowcut:[35,50], highcut:[0,0], comp:[0.45,0.65]},
      found:{role:"bed", vol:[0.06,0.14], pitch:[0.95,1.1], stretch:[0.5,0.7], cutoff:[2200,3400], sources:["pool:industry*1","ferment_bubble"]},
      sampleEvents:[{pool:["tw_ding"], placement:"cadence", sections:"all", treatment:{cutoff:5000, vol:0.45}}],
      hits:{sources:["tw_ding"], pattern:"sparse", prob:0.2},
      stab:["off"],
      form:"dj" },
    /* /genre-tool:aldente:genres */
    /* genre-tool:umpirehouse:genres */
    umpirehouse: { label:"Full Count Judgment", info:"A four-on-the-floor at 122-128. Saw synth bass under a Hammond, with a rock organ. A min7 house vamp, a light shuffle.",
      bpm:[122,128],
      swing:[0.02,0.08],
      humanize:[0.03,0.12],
      progressions:["house_min7","pop_1625","doo_wop"],
      kits:["house","four"],
      fills:["cut","riser","impact"],
      bass:{patterns:["rolling","octaves","stab"], recipe:{model:["saw","reese"], cutoff:[500,900], res:[0.12,0.24], level:[1,1.2], send:[0,0.06], dsend:[0.05,0.12]}},
      lead:{patterns:["hero","double","anthem"], recipe:{model:["sampler","hammond","dx7"], samplerPool:["rock_organ","percussive_organ"], patchPool:["60-S ORGAN"], wave:"saw", voices:[1,2], cutoff:[2400,3600], leslie:[0.8,0.95], level:[0.44,0.58], send:[0.25,0.45], dsend:[0.1,0.25]}},
      pads:{prob:0.5, recipe:{model:["hammond","organ","juno60"], wave:"saw", cutoff:[1000,1700], detune:[0.005,0.011], attack:[0.3,0.9], leslie:[0.8,0.9], level:[0.42,0.58], send:[0.3,0.5], dsend:[0.1,0.2]}},
      drums:{kickModel:["909"], snareModel:["clap","crack"], hatModel:["noise","metal"], kick:[1.1,1.35], snare:[0.6,0.85], hat:[0.6,0.9], tune:[0.98,1.1], send:[0.1,0.25], dsend:[0.05,0.15]},
      fx:{reverb:[0.3,0.5], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[3000,4500], pump:[0.4,0.62], crackle:[0,0.06], lowcut:[30,45], highcut:[0,0], comp:[0.35,0.55]},
      found:{role:"chops", vol:[0.12,0.22], pitch:[1,1.3], stretch:[0.35,0.55], cutoff:[3500,6000], sources:["ca_horn","rave_a"]},
      // CARD-TRUTH WAVE: the umpire calls (sp_ump_*) were registered speech wired to
      // nothing — "the vocal hook is the umpire: STEE-RIKE THREE, you're OUT". Buried, the
      // calls riding the ballpark-organ house as the hook.
      sampleEvents:[{pool:["sp_ump_1","sp_ump_2","sp_ump_3","sp_ump_4"], placement:"buried", sections:"all", treatment:{cutoff:4600, vol:0.44, every:2, maxDur:8, rsend:0.15, dsend:0.12}}],
      hits:{sources:["ca_horn","bb_horn_a"], pattern:"offbeat", prob:0.4},
      stab:["offbeat"],
      form:"duet",
      reverbColor:"spring" },
    /* /genre-tool:umpirehouse:genres */
    /* genre-tool:pigeonstep:genres */
    pigeonstep: { label:"Rock Dove Doctrine", info:"A four-on-the-floor at 128-134. Sub bass under a Juno pad, with a pan flute. A min7 house vamp, swung.",
      bpm:[128,134],
      swing:[0.12,0.18],
      humanize:[0.05,0.12],
      progressions:["house_min7","mode_dorian","minor_run"],
      kits:["house","newjack","shuffle"],
      fills:["cut","riser","dropout"],
      bass:{patterns:["dub","stab","sub"], recipe:{model:["sub","reese"], cutoff:[420,720], res:[0.15,0.28], level:[1,1.2], send:[0,0.08], dsend:[0.05,0.15]}},
      lead:{patterns:["wander","sparse","double"], recipe:{model:["sampler","dx7","pluck"], patchPool:["VOICE   1"], wave:"sine", voices:[1,2], cutoff:[1600,2600], level:[0.36,0.5], send:[0.25,0.45], dsend:[0.15,0.3], vibrato:[0.004,0.012], samplerPool:["pan_flute"]}},
      pads:{prob:0.4, recipe:{model:["juno60","organ"], wave:"saw", cutoff:[1000,1600], detune:[0.005,0.011], attack:[0.4,1], level:[0.35,0.5], send:[0.3,0.5], dsend:[0.1,0.2]}},
      drums:{kickModel:["909","808"], snareModel:["crack","clap"], hatModel:["noise","metal"], kick:[1.1,1.35], snare:[0.6,0.85], hat:[0.7,1], tune:[0.98,1.1], send:[0.08,0.2], dsend:[0.1,0.25]},
      fx:{reverb:[0.25,0.42], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[3000,4500], pump:[0.35,0.55], crackle:[0,0.06], lowcut:[35,50], highcut:[0,0], comp:[0.35,0.55]},
      found:{role:"bed", vol:[0.08,0.16], pitch:[0.95,1.1], stretch:[0.5,0.7], cutoff:[3000,5000], sources:["pigeon_coo","pool:city*1"]},
      hits:{sources:["tw_ding"], pattern:"offbeat", prob:0.25},
      stab:["offbeat"],
      form:"duet" },
    /* /genre-tool:pigeonstep:genres */
    /* genre-tool:dmvstep:genres */
    dmvstep: { label:"Now Serving Infinity", info:"A four-on-the-floor at 130-136. Sub bass under a Juno pad, with a phase-distortion lead. A min7 house vamp, swung.",
      bpm:[130,136],
      swing:[0.14,0.2],
      humanize:[0.05,0.12],
      progressions:["house_min7","minor_run","deep_two"],
      kits:["house","newjack","shuffle"],
      fills:["cut","riser","dropout"],
      bass:{patterns:["stab","dub","sub"], recipe:{model:["sub","reese","saw"], cutoff:[420,780], res:[0.15,0.3], level:[1,1.2], send:[0,0.08], dsend:[0.05,0.15]}},
      lead:{patterns:["double","sparse","arpup"], recipe:{model:["casiocz","synclead","pluck"], wave:"square", voices:[1,2], cutoff:[1800,2800], level:[0.36,0.5], send:[0.2,0.35], dsend:[0.15,0.35]}},
      pads:{prob:0.4, recipe:{model:["juno60","organ"], wave:"saw", cutoff:[1000,1700], detune:[0.005,0.011], attack:[0.3,0.9], level:[0.35,0.5], send:[0.3,0.5], dsend:[0.1,0.2]}},
      drums:{kickModel:["909","808"], snareModel:["crack","clap"], hatModel:["metal","noise"], kick:[1.1,1.35], snare:[0.6,0.85], hat:[0.7,1], tune:[0.98,1.1], send:[0.08,0.2], dsend:[0.1,0.25]},
      fx:{reverb:[0.25,0.42], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[3000,4500], pump:[0.35,0.55], crackle:[0,0.05], lowcut:[35,50], highcut:[0,0], comp:[0.35,0.55]},
      found:{role:"chops", vol:[0.14,0.24], pitch:[1,1.3], stretch:[0.4,0.6], cutoff:[3500,5500], sources:["vx_conet_poacher","vx_conet_swedish"]},
      sampleEvents:[{pool:["vx_conet_poacher","vx_conet_swedish"], placement:"response", sections:"all", treatment:{cutoff:4500, vol:0.4}},
        // CARD-TRUTH WAVE: the DMV window calls (sp_dmv_*) were registered speech wired to
        // nothing — "now serving number B-47 at window four", the card's melodic hook. Buried,
        // the ticket calls riding the swung 2-step.
        {pool:["sp_dmv_1","sp_dmv_2","sp_dmv_3","sp_dmv_4","sp_dmv_5","sp_dmv_6"], placement:"buried", sections:"all", treatment:{cutoff:4500, vol:0.42, every:2, maxDur:10, rsend:0.15, dsend:0.12}}],
      hits:{sources:["vx_conet_poacher","tw_ding"], pattern:"offbeat", prob:0.4},
      stab:["offbeat"],
      form:"duet" },
    /* /genre-tool:dmvstep:genres */
    /* genre-tool:towncrier:genres */
    towncrier: { label:"Oyez Oblivion", info:"A half-time kit at 138-146. Wobble bass under an Oberheim pad, with an FM lead. A descending minor run, a light shuffle.",
      bpm:[138,146],
      swing:[0,0.06],
      humanize:[0.02,0.1],
      progressions:["minor_run","drone_min","epic_min"],
      kits:["halftime","trap"],
      fills:["riser","impact","cut","dropout"],
      bass:{patterns:["dub","stab","sub"], recipe:{model:["wobble","reese","sub"], cutoff:[400,900], res:[0.2,0.4], level:[1.05,1.28], send:[0,0.06], dsend:[0.05,0.12]}},
      lead:{patterns:["sparse","double","anthem"], recipe:{model:["dx7","bell"], patchPool:["BELLS","TUB BELLS"], wave:"sine", voices:[1,2], cutoff:[2400,3600], level:[0.4,0.54], send:[0.3,0.5], dsend:[0.15,0.3]}},
      pads:{prob:0.4, recipe:{model:["oberheim","choir","strings"], wave:"saw", cutoff:[900,1600], detune:[0.006,0.014], attack:[0.5,1.5], level:[0.38,0.54], send:[0.35,0.55], dsend:[0.1,0.2]}},
      drums:{kickModel:["808","boom"], snareModel:["crack","clap"], hatModel:["metal","noise"], kick:[1.15,1.45], snare:[0.6,0.85], hat:[0.5,0.85], tune:[0.98,1.1], send:[0.08,0.2], dsend:[0.1,0.25]},
      fx:{reverb:[0.3,0.5], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[2800,4200], pump:[0.4,0.62], crackle:[0,0.06], lowcut:[35,50], highcut:[0,0], comp:[0.45,0.65], grit:[0.2,0.5]},
      found:{role:"chops", vol:[0.12,0.22], pitch:[0.9,1.2], stretch:[0.35,0.55], cutoff:[3000,5500], sources:["tw_ding","horns_78"]},
      // CARD-TRUTH WAVE: the town-crier proclamations (sp_crier_*) were registered speech
      // wired to nothing — "the royal decree read over a filthy sub". Buried and spaced
      // (one every 4 bars) so the OYEZ lands and the drop has room.
      sampleEvents:[{pool:["sp_crier_1","sp_crier_2","sp_crier_3"], placement:"buried", sections:"all", treatment:{cutoff:4200, vol:0.42, every:4, maxDur:10, rsend:0.16, dsend:0.12}}],
      hits:{sources:["tw_ding","bb_horn_a"], pattern:"response", prob:0.4},
      stab:["off"],
      form:"drop" },
    /* /genre-tool:towncrier:genres */
    /* genre-tool:chickadeecore:genres */
    chickadeecore: { label:"Fee Bee Augury", info:"A trap kit at 140-150. Saw synth bass under a Juno pad, with a glockenspiel. Four-chord changes, a light shuffle.",
      bpm:[140,150],
      swing:[0,0.05],
      humanize:[0.03,0.1],
      progressions:["four_chords","dream","pop_1625"],
      kits:["trap","pulse"],
      fills:["riser","impact","cut"],
      bass:{patterns:["octaves","root","drive"], recipe:{model:["saw","sub"], cutoff:[600,1000], res:[0.1,0.2], level:[1,1.2], send:[0,0.06], dsend:[0.05,0.12]}},
      lead:{patterns:["double","updown","pentaup"], recipe:{model:["sampler","bell","synclead"], samplerPool:["glockenspiel","celesta"], wave:"sine", voices:[1,2], cutoff:[3000,4200], level:[0.44,0.58], send:[0.25,0.45], dsend:[0.1,0.25]}},
      pads:{prob:0.45, recipe:{model:["juno60","saw"], wave:"saw", cutoff:[1400,2200], detune:[0.008,0.016], attack:[0.3,0.9], level:[0.4,0.55], send:[0.3,0.5], dsend:[0.1,0.2]}},
      drums:{kickModel:["909","808"], snareModel:["clap","crack"], hatModel:["metal","noise"], kick:[1.1,1.35], snare:[0.6,0.85], hat:[0.7,1.05], tune:[1,1.15], send:[0.08,0.2], dsend:[0.05,0.15]},
      fx:{reverb:[0.3,0.48], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[3500,5000], pump:[0.3,0.5], crackle:[0,0], lowcut:[30,45], highcut:[0,0], comp:[0.35,0.55]},
      found:{role:"bed", vol:[0.06,0.14], pitch:[1.1,1.4], stretch:[0.4,0.6], cutoff:[4000,7000], sources:["chickadee","pool:city*1"]},
      hits:{sources:["tw_ding"], pattern:"sparse", prob:0.2},
      stab:["off"],
      form:"duet" },
    /* /genre-tool:chickadeecore:genres */
    /* genre-tool:floppycore:genres */
    floppycore: { label:"Abort Retry Fail", info:"A breaks kit at 142-158. Reese bass under a PPG pad, with a plucked string lead. A descending minor run, a light shuffle.",
      bpm:[142,158],
      swing:[0,0.06],
      humanize:[0.02,0.1],
      progressions:["minor_run","mode_dorian","deep_two"],
      kits:["breaks","electro"],
      fills:["cut","stutter","reverse","dropout"],
      bass:{patterns:["stab","rolling","sixteenths"], recipe:{model:["reese","modeld","saw"], cutoff:[450,800], res:[0.15,0.3], level:[1,1.2], send:[0,0.06], dsend:[0.05,0.12]}},
      lead:{patterns:["double","arpup","off"], recipe:{model:["kpluck","pluck","fm"], wave:"square", voices:[1,2], cutoff:[2000,3200], level:[0.34,0.48], send:[0.2,0.4], dsend:[0.2,0.4]}},
      pads:{prob:0.35, recipe:{model:["ppg","oberheim"], wave:"saw", cutoff:[1000,1700], detune:[0.006,0.014], attack:[0.4,1], level:[0.35,0.5], send:[0.3,0.5], dsend:[0.1,0.2]}},
      drums:{kickModel:["808","909"], snareModel:["crack","noise"], hatModel:["metal","noise"], kick:[1,1.3], snare:[0.55,0.8], hat:[0.7,1.05], tune:[1,1.14], send:[0.05,0.18], dsend:[0.1,0.25]},
      fx:{reverb:[0.25,0.42], delayBeats:[0.25,0.5], delayFb:[0.2,0.4], delayCut:[3000,4800], pump:[0.3,0.55], crackle:[0.05,0.2], lowcut:[35,50], highcut:[0,0], comp:[0.4,0.6]},
      found:{role:"break", vol:[0.16,0.28], pitch:[1,1.15], stretch:[0.8,1], cutoff:[4000,7000], sources:["amen_165","amen_170"]},
      // THE SEEK-CLATTER (card-truth wave): floppy_seek was registered "the break" but
      // wired to nothing (and the bpm-matched `break` role can't take a texture clip).
      // The card says "chopped into an IDM shuffle" — a slice layer chops the seek
      // tick-tick-grind across the beat, riding over the amen.
      sampleEvents:[{pool:["floppy_seek"], placement:"slice", sections:"all", gain:1.0, prob:0.5, treatment:{cutoff:6500, vol:0.3}},
        // CARD-TRUTH WAVE: sp_floppy_save ("saving document") was registered speech wired to
        // nothing — "a ritual with real stakes: do not remove the disk". A single announcement
        // at each section's end, the save committing.
        {pool:["sp_floppy_save"], placement:"cadence", sections:"all", treatment:{cutoff:4200, vol:0.44, rsend:0.15, dsend:0.12}}],
      hits:{sources:["pool:chime*1","pool:rave_stab*1"], pattern:"offbeat", prob:0.4},
      stab:["offbeat"],
      form:"dj" },
    /* /genre-tool:floppycore:genres */
    /* genre-tool:cerealwave:genres */
    cerealwave: { label:"Riboflavin Rapture", info:"A four-on-the-floor at 155-165. Saw synth bass under a Juno pad, with a hard-sync lead. Four-chord changes, straight time, quantized tight.",
      bpm:[155,165],
      swing:[0,0.04],
      humanize:[0,0.08],
      progressions:["four_chords","doo_wop","pop_1625"],
      kits:["four","pulse"],
      fills:["riser","impact","cut","stutter"],
      bass:{patterns:["octaves","drive","stab"], recipe:{model:["saw","sub"], cutoff:[600,1000], res:[0.12,0.24], level:[1.05,1.25], send:[0,0.06], dsend:[0,0.06]}},
      lead:{patterns:["hero","double","pentaup"], recipe:{model:["synclead","kpluck","stack"], wave:"square", voices:[2,3], spread:[0.006,0.014], cutoff:[3200,4400], level:[0.46,0.6], send:[0.2,0.35], dsend:[0.15,0.3]}},
      pads:{prob:0.5, recipe:{model:["juno60","saw"], wave:"saw", cutoff:[1600,2400], detune:[0.01,0.018], attack:[0.2,0.7], level:[0.44,0.6], send:[0.3,0.5], dsend:[0.1,0.2]}},
      drums:{kickModel:["909","boom"], snareModel:["clap"], hatModel:["metal","noise"], kick:[1.2,1.45], snare:[0.65,0.9], hat:[0.7,1.05], tune:[1,1.15], send:[0.1,0.25], dsend:[0.05,0.15]},
      fx:{reverb:[0.28,0.45], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[3500,5500], pump:[0.5,0.75], crackle:[0.4,0.7], lowcut:[30,45], highcut:[0,0], comp:[0.4,0.6]},
      found:{role:"chops", vol:[0.14,0.24], pitch:[1.2,1.5], stretch:[0.35,0.5], cutoff:[4000,7000], sources:["rave_a","rave_b","rave_c"]},
      // CARD-TRUTH WAVE: the cereal ads (sp_cereal_*) were registered speech wired to
      // nothing — "part of this complete breakfast". Buried, the mascot jingle patter
      // riding the sugar-rush hyperpop.
      sampleEvents:[{pool:["sp_cereal_1","sp_cereal_2","sp_cereal_3"], placement:"buried", sections:"all", treatment:{cutoff:4600, vol:0.4, every:2, maxDur:8, rsend:0.15, dsend:0.12}}],
      hits:{sources:["pool:rave_stab*2","bb_horn_a"], pattern:"offbeat", prob:0.5},
      stab:["rave"],
      form:"drop" },
    /* /genre-tool:cerealwave:genres */
    /* genre-tool:laundrycore:genres */
    laundrycore: { label:"Unbalanced Load", info:"A jungle kit at 168-174. Sub bass under a vocoder choir pad, with a pluck lead. A two-chord minor drone, a light shuffle.",
      bpm:[168,174],
      swing:[0,0.06],
      humanize:[0.02,0.1],
      progressions:["drone_min","deep_two","house_min"],
      kits:["jungle","breaks"],
      fills:["break fill","cut","reverse"],
      bass:{patterns:["sub","dub","rolling"], recipe:{model:["sub","reese"], cutoff:[380,650], res:[0.1,0.22], level:[1.05,1.25], send:[0,0.06], dsend:[0.05,0.12]}},
      lead:{patterns:["off","sparse","wander"], recipe:{model:["pluck","fm"], wave:"sine", voices:[1,2], cutoff:[1600,2600], level:[0.3,0.42], send:[0.25,0.45], dsend:[0.2,0.4]}},
      pads:{prob:0.3, recipe:{model:["vp330","solina"], wave:"saw", cutoff:[800,1400], detune:[0.006,0.014], attack:[1.5,3], level:[0.35,0.5], send:[0.35,0.55], dsend:[0.1,0.2]}},
      drums:{kickModel:["808"], snareModel:["crack","noise"], hatModel:["noise","metal"], kick:[1.1,1.35], snare:[0.55,0.8], hat:[0.6,0.9], tune:[0.98,1.1], send:[0.08,0.2], dsend:[0.1,0.25]},
      fx:{reverb:[0.28,0.45], delayBeats:[0.375,0.5], delayFb:[0.2,0.38], delayCut:[3000,4500], pump:[0.3,0.5], crackle:[0,0.08], lowcut:[35,50], highcut:[0,0], comp:[0.35,0.55]},
      found:{role:"break", vol:[0.2,0.35], pitch:[1,1.05], stretch:[0.9,1.05], cutoff:[4000,7000], sources:["amen_170","amen_172","amen_175"]},
      // THE TUMBLE (card-truth wave): dryer_spin was registered "domestic break bed"
      // but wired to nothing. The card's "wash of white noise you mistake for rain" is
      // a sustained bed under the chopped amen — the spin-cycle drone the break rides on.
      sampleEvents:[{pool:["dryer_spin"], placement:"bed", sections:"all", gain:1.0, treatment:{cutoff:5200, vol:0.2, stretch:0.6}},
        // CARD-TRUTH WAVE: the laundry stabs (sp_laundry_*) were registered speech wired to
        // nothing — "tumble dry low as the vocal stab". Buried, the care-label calls riding
        // the chopped amen.
        {pool:["sp_laundry_1","sp_laundry_2"], placement:"buried", sections:"all", treatment:{cutoff:4600, vol:0.42, every:2, maxDur:8, rsend:0.15, dsend:0.12}}],
      hits:{sources:["pool:vb_domestic_appliance*1","tw_ding","sp_system"], pattern:"offbeat", prob:0.35},
      stab:["off"],
      form:"drop" },
    /* /genre-tool:laundrycore:genres */
    /* genre-tool:auctioncore:genres */
    auctioncore: { label:"Going Going Gone", info:"A breaks kit at 168-178. Reese bass under an Oberheim pad, with a fuzz lead. A descending minor run, a light shuffle.",
      bpm:[168,178],
      swing:[0,0.05],
      humanize:[0.02,0.1],
      progressions:["minor_run","drone_min","house_min"],
      kits:["breaks","jungle"],
      fills:["break fill","cut","stutter","reverse"],
      bass:{patterns:["sub","dub","rolling"], recipe:{model:["reese","sub"], cutoff:[400,720], res:[0.12,0.26], level:[1.05,1.25], send:[0,0.06], dsend:[0.05,0.12]}},
      lead:{patterns:["off","sparse","double"], recipe:{model:["fuzz","pluck"], wave:"square", voices:[1,2], cutoff:[1800,2800], level:[0.32,0.46], send:[0.2,0.4], dsend:[0.2,0.4]}},
      pads:{prob:0.3, recipe:{model:["oberheim","saw"], wave:"saw", cutoff:[900,1600], detune:[0.008,0.016], attack:[0.3,0.9], level:[0.35,0.5], send:[0.3,0.5], dsend:[0.1,0.2]}},
      drums:{kickModel:["808"], snareModel:["crack","noise"], hatModel:["noise","metal"], kick:[1.1,1.4], snare:[0.6,0.85], hat:[0.6,0.95], tune:[0.98,1.12], send:[0.08,0.2], dsend:[0.1,0.25]},
      fx:{reverb:[0.25,0.45], delayBeats:[0.25,0.5], delayFb:[0.2,0.4], delayCut:[3000,4800], pump:[0.35,0.6], crackle:[0.05,0.2], lowcut:[35,50], highcut:[0,0], comp:[0.45,0.65]},
      found:{role:"break", vol:[0.2,0.34], pitch:[1,1.08], stretch:[0.85,1], cutoff:[4000,7000], sources:["amen_170","amen_172","amen_175"]},
      // THE CHANT IS THE GENRE: the livestock patter rides under every two bars
      // (hogcore's buried-phrase idiom), the whole "do-I-hear-thirty…" landing
      // before the next; the gavel (tw_ding) is the section cadence — once per
      // section, not every bar (the LIVE cadence rule).
      sampleEvents:[
        {pool:["sp_auction_1","sp_auction_2","sp_auction_3"], placement:"buried", sections:"all", treatment:{cutoff:4200, vol:0.44, every:2, maxDur:9, rsend:0.16, dsend:0.12}},
        {pool:["tw_ding"], placement:"cadence", sections:"all", treatment:{cutoff:5000, vol:0.5}}],
      hits:{sources:["tw_ding","pool:rave_stab*1","sp_auction_2"], pattern:"offbeat", prob:0.4},   // "SOLD to the raver in the back" — a number-stab punctuates the offbeats
      stab:["off"],
      form:"drop" },
    /* /genre-tool:auctioncore:genres */
    /* genre-tool:dialupgabber:genres */
    dialupgabber: { label:"Carrier Lost", info:"A four-on-the-floor at 180-190. Fuzz lead bass under an Oberheim pad, with a fuzz lead. A two-chord minor drone, straight time, quantized tight.",
      bpm:[180,190],
      swing:[0,0.04],
      humanize:[0,0.06],
      progressions:["drone_min","minor_run"],
      kits:["four","pulse"],
      fills:["riser","impact","cut","reverse"],
      bass:{patterns:["stab","drive","root"], recipe:{model:["fuzz","reese"], cutoff:[500,900], res:[0.15,0.3], level:[1.1,1.3], send:[0,0.06], dsend:[0.05,0.12], inserts:{prob:0.6, max:1, pool:[["distort",{drive:[0.3,0.6], mix:[0.6,0.9]}]]}}},
      lead:{patterns:["double","off","hero"], recipe:{model:["fuzz","synclead"], wave:"square", voices:[1,2], cutoff:[2000,3200], level:[0.34,0.48], send:[0.2,0.35], dsend:[0.15,0.3]}},
      pads:{prob:0.3, recipe:{model:["oberheim","saw"], wave:"saw", cutoff:[900,1600], detune:[0.008,0.016], attack:[0.3,0.9], level:[0.35,0.5], send:[0.25,0.45], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom","909"], snareModel:["crack","clap"], hatModel:["metal","noise"], kick:[1.35,1.6], snare:[0.6,0.85], hat:[0.6,0.95], tune:[0.95,1.1], send:[0.05,0.15], dsend:[0.05,0.15]},
      fx:{reverb:[0.25,0.42], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[3000,4500], pump:[0.55,0.8], crackle:[0.1,0.3], lowcut:[35,50], highcut:[0,0], comp:[0.5,0.7], grit:[0.3,0.6]},
      found:{role:"chops", vol:[0.16,0.28], pitch:[1,1.4], stretch:[0.35,0.5], cutoff:[3500,6500], sources:["rave_c","rave_d"]},
      // THE HANDSHAKE IS THE GENRE: the 56k handshake dials up at each section
      // START (opener — once per section via the LIVE cadence rule, the
      // "connection" that opens the breakdown).
      sampleEvents:[{pool:["modem_handshake"], placement:"opener", sections:"all", gain:0.7, treatment:{maxDur:16, cutoff:4600, vol:0.5, rsend:0.12, dsend:0.1}}],
      hits:{sources:["pool:vb_rave_hardcore*1","pool:rave_stab*2","bb_stab_a"], pattern:"offbeat", prob:0.5},
      stab:["rave"],
      form:"drop" },
    /* /genre-tool:dialupgabber:genres */
    /* genre-tool:picnicswing:genres */
    picnicswing: { label:"Gingham Event Horizon", info:"A shuffle at 145-153. Fretless bass under strings, with a muted trumpet. A min7 house vamp, hard swing, loose timing.",
      bpm:[145,153],
      swing:[0.21,0.26],
      humanize:[0.25,0.34],
      progressions:["house_min7","funk_vamp","neosoul"],
      kits:["shuffle","boombap","shuffle"],
      fills:["off","drum fill"],
      bass:{patterns:["stab","melodic","dub","syncopated"], patchPool:["SYN-BASS 2","BASS    2"], samplerPool:["fretless_bass"], recipe:{model:["dx7","saw","sampler"], cutoff:[400,540], res:[0.1,0.2], level:[1.05,1.25], send:[0,0.06], dsend:[0,0.06]}, inserts:{prob:0.4, max:1, pool:[["wah",{sens:[0.5,0.7], base:[260,380], range:[1.6,2.4], q:[3.5,5.5], mix:[0.6,0.7]}]]}},   // BALANCE LOOP 3 wah trim: mix capped at .6-.7 (full-wet wah trims the bass)
      lead:{patterns:["sparse","wander","off"], patchPool:["E.PIANO 2"], samplerPool:["muted_trumpet","tenor_sax"], recipe:{model:["fm","dx7","sampler","sampler"], wave:"sine", voices:[1,3], spread:[0.002,0.006], cutoff:[1800,3000], level:[0.4,0.52], send:[0.4,0.6], dsend:[0.3,0.5], vibrato:[0.004,0.01], octave:0.08, attack:0.05, release:[0.3,0.45], sustain:[0.78,0.88], fenv:[0.2,0.4]}},
      pads:{prob:0.85, samplerPool:["strings"], recipe:{model:["fm","strings","sampler"], wave:"sine", cutoff:[800,1400], detune:[0.004,0.01], attack:[1,2.5], level:[0.5,0.68], send:[0.45,0.65], dsend:[0.15,0.3]}, inserts:{prob:0.35, max:1, pool:[["phaser",{rate:[0.06,0.18], depth:[0.4,0.6], mix:[0.3,0.5]}]]}},
      drums:{kickModel:["boom","808"], snareModel:["noise"], hatModel:["noise"], kick:[0.9,1.15], snare:[0.5,0.7], hat:[0.5,0.8], tune:[0.85,1], send:[0.15,0.3], dsend:[0,0.1], kit:"acoustic"},
      fx:{reverb:[0.39,0.57], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[2600,3800], pump:[0.12,0.34], crackle:[0.19,0.35], lowcut:[30,45], highcut:[2600,3400], comp:[0.25,0.47]},
      found:{role:"bed", vol:[0.2,0.32], pitch:[0.9,1], stretch:[0.45,0.6], cutoff:[2800,4200], sources:["vx_cn_east","vx_cn_march","vx_cn_opera","vx_cn_speech"]},
      hits:{sources:["pool:vocal_stab*1","sp_rhythm","pool:rave_stab*1"], pattern:"offbeat", prob:0.6},
      stab:["off","sparse"],
      form:"vamp" },
    /* /genre-tool:picnicswing:genres */
    /* genre-tool:cerealboxwave:genres */
    cerealboxwave: { label:"Prize Inside", info:"Beatless at 104-112. A church organ under a church organ, with a plucked string lead. A descending minor run, a light shuffle.",
      bpm:[104,112],
      swing:[0,0.044],
      humanize:[0.056,0.146],
      progressions:["minor_run","epic_min","sad_pop","four_chords"],
      kits:["off"],
      fills:["off"],
      bass:{patterns:["pedal","root","walking"], samplerPool:["church_organ","harpsichord"], recipe:{model:["sampler","sampler"], cutoff:[700,1500], res:[0.05,0.1], level:[0.5,0.7], send:[0.2,0.4], dsend:[0,0.08], attack:[0.01,0.03], release:[0.3,0.6]}},
      lead:{patterns:["arp16"], recipe:{model:["kpluck"], wave:"saw", drive:0.45, cutoff:[3000,3800], level:[0.62,0.74], send:[0.16,0.26], dsend:[0.46,0.56], voices:[2,4]}, inserts:{prob:0.8, max:1, pool:[["chorus",{rate:[0.7,1.1], depth:[0.45,0.65], mix:[0.45,0.6]}]]}},
      pads:{prob:1, samplerPool:["church_organ"], recipe:{model:["organ","organ","sampler"], wave:"saw", cutoff:[1500,2200], detune:[0.004,0.008], attack:[0.3,0.7], level:[0.4,0.52], send:[0.16,0.26], dsend:[0,0.06]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.5,0.7], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.9,1], send:[0.15,0.35], dsend:[0,0]},
      fx:{reverb:[0.37,0.55], delayBeats:[0.5,1], delayFb:[0.1,0.24], delayCut:[2200,3200], pump:[0.18,0.4], crackle:[0,0.13], lowcut:[0,0], highcut:[0,0], comp:[0.17,0.39]},
      found:{role:"bed", vol:[0.08,0.14], pitch:[0.65,0.8], stretch:[0.45,0.6], cutoff:[1000,1800], sources:["pool:road*1","pool:industry*1","pool:voices*1"]},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.05},
      stab:["off"],
      form:"wave",
      reverbColor:"fdn" },
    /* /genre-tool:cerealboxwave:genres */
    /* genre-tool:rosinamblelilt:genres */
    rosinamblelilt: { label:"Rosin Parallax", info:"A bare kick at 94-102. Saw synth bass under an organ, with a clarinet. A canon, hard swing, loose timing, rubato.",
      bpm:[94,102],
      swing:[0.17,0.22],
      humanize:[0.323,0.413],
      progressions:["canon","minor_run","dream"],
      kits:["off","kick"],
      fills:["off"],
      bass:{patterns:["root","simple","off"], recipe:{model:["saw","sub"], cutoff:[400,700], res:[0.05,0.15], level:[0.8,1], send:[0.1,0.2], dsend:[0,0.08]}},
      lead:{patterns:["wander","sparse","pentaup"], samplerPool:["clarinet","flute","vibraphone","celesta"], recipe:{model:["sampler","sampler","sampler","stack","modeld"], wave:"sine", voices:[1,3], spread:[0.001,0.003], cutoff:[2600,3800], level:[0.44,0.56], send:[0.45,0.65], dsend:[0.2,0.35], vibrato:[0.014,0.022], vibRate:[5.5,6.5], attack:0.06, release:[0.3,0.5], sustain:[0.85,0.95], glide:[80,150], envAmount:[0.5,1.2], envDecay:[0.3,0.6], oscMix:[0,0.3], drift:[6,12], drive:[0.05,0.2]}},
      pads:{prob:1, recipe:{model:["organ"], wave:"saw", cutoff:[1000,1600], detune:[0.003,0.008], attack:[1.5,3], level:[0.5,0.65], send:[0.5,0.7], dsend:[0.1,0.2]}, inserts:{prob:0.35, max:1, pool:[["phaser",{rate:[0.05,0.15], depth:[0.4,0.6], mix:[0.3,0.45]}]]}},
      drums:{kickModel:["boom","808"], snareModel:["noise"], hatModel:["noise"], kick:[1.3,1.6], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.78,0.9], send:[0.3,0.5], dsend:[0.1,0.3]},
      fx:{reverb:[0.87,1], delayBeats:[0.75,1], delayFb:[0.3,0.45], delayCut:[2200,3200], pump:[0,0.12], crackle:[0.09,0.25], lowcut:[0,20], highcut:[0,0], comp:[0.03,0.25]},
      found:{role:"bed", vol:[0.18,0.3], pitch:[0.8,0.95], stretch:[0.45,0.6], cutoff:[2400,3800], sources:["pool:voices*2","pool:room*1"]},
      rubato:{depth:[0.008,0.02], periodBars:[3,5], prob:1},
      sampleEvents:[{pool:["vx_apollo","vx_wwvh"], placement:"response", sections:"verse|chorus|bridge|hook", prob:0.3, gain:0.4, treatment:{pitch:1, cutoff:1600, rsend:0.5, dsend:0.3}}],
      hits:{sources:["sp_herenow","pool:vocal_stab*1"], pattern:"sparse", prob:0.3},
      stab:["off"],
      form:"suite",
      reverbColor:"dattorro" },
    /* /genre-tool:rosinamblelilt:genres */
    /* genre-tool:subwooferbalm:genres */
    subwooferbalm: { label:"Infrasound Poultice", info:"A four-on-the-floor at 76-84. Sub bass under ahh choir, with an alto sax. A twelve-bar blues, a light shuffle, one chord every 16 beats.",
      bpm:[76,84],
      swing:[0,0.049],
      humanize:[0.128,0.218],
      progressions:["blues_12"],
      kits:["house","four"],
      fills:["cut","riser","impact"],
      chordEvery:16,
      bass:{patterns:["pedal","sub","root"], recipe:{model:["sub","saw"], cutoff:[380,650], res:[0.06,0.14], level:[0.6,0.82], send:[0.15,0.35], dsend:[0,0.05]}},
      lead:{patterns:["composed","composed2","arpup","wander"], patchPool:["E.PIANO 1","TUB BELLS","E.PIANO 4","SHIMMER"], samplerPool:["alto_sax","tenor_sax"], recipe:{model:["stack","stack","dx7","sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.003,0.006], cutoff:[2800,4000], level:[0.4,0.52], send:[0.4,0.6], dsend:[0.2,0.4], vibrato:[0.004,0.009], octave:0.2, attack:0.08, release:[0.45,0.6], sustain:[0.85,0.95]}, inserts:{prob:0.5, max:1, pool:[["chorus",{rate:[0.5,1.1], depth:[0.5,0.7], mix:[0.4,0.6]}]]}},
      pads:{prob:1, samplerPool:["ahh_choir","strings"], recipe:{model:["saw","choir","strings","sampler"], wave:"saw", cutoff:[1100,1800], detune:[0.004,0.009], attack:[1.2,2.4], mellotron:true, level:[0.6,0.8], send:[0.5,0.7], dsend:[0.1,0.25]}, inserts:{prob:0.55, max:1, pool:[["chorus",{rate:[0.2,0.5], depth:[0.5,0.75], mix:[0.4,0.6]}]]}},
      drums:{kickModel:["909"], snareModel:["clap","crack"], hatModel:["noise","metal"], kick:[1.1,1.35], snare:[0.6,0.85], hat:[0.6,0.9], tune:[0.98,1.1], send:[0.1,0.25], dsend:[0.05,0.15]},
      fx:{reverb:[0.87,1], delayBeats:[0.75,1.5], delayFb:[0.15,0.3], delayCut:[2000,3000], pump:[0,0.12], crackle:[0.01,0.17], lowcut:[0,0], highcut:[2600,3400], comp:[0.21,0.43]},
      found:{role:"narration", vol:[0.35,0.55], pitch:[0.98,1.05], stretch:[0.9,1.05], cutoff:[2600,3600], sources:["vx_apollo"]},
      hits:{sources:["pool:vb_mallsoft_vapor*1","sp_system","pool:chime*1"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"wave",
      reverbColor:"greyhole" },
    /* /genre-tool:subwooferbalm:genres */
    /* genre-tool:sepiadrive:genres */
    sepiadrive: { label:"Caravan Redshift", info:"A tribal kit at 132-140. Saw synth bass under ahh choir, with an alto sax. A hijaz maqam, a light shuffle, euclidean hats.",
      bpm:[132,140],
      swing:[0.043,0.093],
      humanize:[0.029,0.119],
      progressions:["hijaz","hijaz","andalusian","mode_phrygian"],
      kits:["tribal","breaks"],
      fills:["drum fill","tom fill","off"],
      euclid:{kick:[5,16]},
      bass:{patterns:["root","simple","octaves"], recipe:{model:["saw","sub"], cutoff:[450,750], res:[0.08,0.16], level:[0.95,1.15], send:[0.05,0.12], dsend:[0,0.06]}},
      lead:{patterns:["composed","composed2","arpup","wander"], patchPool:["E.PIANO 1","TUB BELLS","E.PIANO 4","SHIMMER"], samplerPool:["alto_sax","tenor_sax"], recipe:{model:["stack","stack","dx7","sampler","sampler"], wave:"sine", voices:[1,3], spread:[0.003,0.006], cutoff:[2800,4000], level:[0.4,0.52], send:[0.4,0.6], dsend:[0.2,0.4], vibrato:[0.004,0.009], octave:0.2, attack:0.08, release:[0.45,0.6], sustain:[0.85,0.95]}, inserts:{prob:0.5, max:1, pool:[["chorus",{rate:[0.5,1.1], depth:[0.5,0.7], mix:[0.4,0.6]}]]}},
      pads:{prob:1, samplerPool:["ahh_choir","strings"], recipe:{model:["saw","choir","strings","sampler"], wave:"saw", cutoff:[1100,1800], detune:[0.004,0.009], attack:[1.2,2.4], mellotron:true, level:[0.6,0.8], send:[0.5,0.7], dsend:[0.1,0.25]}, inserts:{prob:0.55, max:1, pool:[["chorus",{rate:[0.2,0.5], depth:[0.5,0.75], mix:[0.4,0.6]}]]}},
      drums:{kickModel:["808","boom"], snareModel:["crack"], hatModel:["noise"], kick:[1.1,1.3], snare:[0.7,0.95], hat:[0.9,1.2], tune:[1.05,1.2], send:[0.1,0.2], dsend:[0.1,0.25]},
      fx:{reverb:[0.3,0.48], delayBeats:[0.5,0.75], delayFb:[0.25,0.4], delayCut:[2200,3400], pump:[0.04,0.26], crackle:[0.14,0.3], lowcut:[25,40], highcut:[2600,3400], comp:[0.26,0.48]},
      found:{role:"chops", vol:[0.1,0.18], pitch:[0.95,1.15], stretch:[0.4,0.6], cutoff:[2500,4000], sources:["shibuya","tokyo_station","vx_suspense"]},
      hits:{sources:["pool:vb_transit*1","pool:vocal_stab*1","sp_rhythm"], pattern:"sparse", prob:0.4},
      stab:["off"],
      form:"pop" },
    /* /genre-tool:sepiadrive:genres */
    /* genre-tool:sparkbreak:genres */
    sparkbreak: { label:"Arc Flash Jubilee", info:"A four-on-the-floor at 127-135. Acid bass under a saw synth pad, with a pluck lead. A descending minor run, a light shuffle, quantized tight.",
      bpm:[127,135],
      swing:[0.001,0.051],
      humanize:[0.001,0.091],
      progressions:["minor_run","house_min","deep_two"],
      kits:["four","pulse"],
      fills:["riser","impact","cut","stutter"],
      bass:{patterns:["stab","rolling","drive","syncopated"], recipe:{model:["acid"], cutoff:[420,700], res:[0.3,0.45], level:[1.1,1.3], send:[0,0.08], dsend:[0,0.1]}, inserts:{prob:0.6, max:2, pool:[["distort",{drive:[0.3,0.6], mix:[0.6,0.9]}],["filtersweep",{rateBars:[2,4], lo:[-0.8,-0.3], hi:[0.8,1.4], res:[0.35,0.5]}]]}},
      lead:{patterns:["off","sparse","pentaup"], recipe:{model:["pluck","fm"], wave:"sine", voices:[2,4], spread:[0.002,0.005], cutoff:[1800,2800], level:[0.5,0.62], send:[0.25,0.4], dsend:[0.25,0.4], attack:0.003, release:[0.06,0.1], sustain:[0.5,0.62]}},   // MUSICALITY balance loop 1 (buried-lead template class): level [0.3,0.42]->[0.5,0.62], the standbylightdrive calibration — same mechanism, pluck/fm template lead sampled-by-default under a heavy mix. Matrix unmoved (level is not a verifier feature).
      pads:{prob:0.25, recipe:{model:["saw","organ"], wave:"saw", cutoff:[600,1000], detune:[0.005,0.012], attack:[1,2.5], level:[0.3,0.42], send:[0.3,0.45], dsend:[0.1,0.2]}},
      drums:{kickModel:["909","boom"], snareModel:["clap"], hatModel:["metal","noise"], kick:[1.2,1.45], snare:[0.65,0.9], hat:[0.7,1.05], tune:[1,1.15], send:[0.1,0.25], dsend:[0.05,0.15]},
      fx:{reverb:[0.3,0.48], delayBeats:[0.5,0.75], delayFb:[0.3,0.45], delayCut:[2200,3400], pump:[0.17,0.39], crackle:[0.04,0.2], lowcut:[30,45], highcut:[0,0], comp:[0.23,0.45], grit:[0.3,0.6]},
      found:{role:"break", vol:[0.32,0.45], pitch:[1,1], stretch:[0.5,0.5], cutoff:[6000,9000], sources:["amen_165","amen_170","amen_172","amen_175","stml_loop_117a","stml_loop_126a","stml_loop_133a","stml_loop_144a"]},
      sampleEvents:[{pool:["bb_horn_a","bb_horn_b"], placement:"opener", gain:0.6, treatment:{cutoff:7000, dsend:0.3}}],
      hits:{sources:["pool:vb_junglist*1","bb_horn_a","bb_horn_b","bb_stab_a","bb_stab_b","bb_stab_c"], pattern:"offbeat", prob:0.85},
      stab:["rave","rave","offbeat"],
      form:"drop" },
    /* /genre-tool:sparkbreak:genres */
    /* genre-tool:hopscotchwave:genres */
    hopscotchwave: { label:"Hopscotch Cosmology", info:"A four-on-the-floor at 103-111. Acid bass under a saw synth pad, with a pluck lead. Epic minor changes, a light shuffle.",
      bpm:[103,111],
      swing:[0.033,0.083],
      humanize:[0.095,0.185],
      progressions:["epic_min","minor_run","andalusian","mode_phrygian"],
      kits:["four","open"],
      fills:["hat rush","drum fill","riser"],
      bass:{patterns:["stab","rolling","drive","syncopated"], recipe:{model:["acid"], cutoff:[420,700], res:[0.3,0.45], level:[1.1,1.3], send:[0,0.08], dsend:[0,0.1]}, inserts:{prob:0.6, max:2, pool:[["distort",{drive:[0.3,0.6], mix:[0.6,0.9]}],["filtersweep",{rateBars:[2,4], lo:[-0.8,-0.3], hi:[0.8,1.4], res:[0.35,0.5]}]]}},
      lead:{patterns:["off","sparse","pentaup"], recipe:{model:["pluck","fm"], wave:"sine", voices:[1,3], spread:[0.002,0.005], cutoff:[1800,2800], level:[0.5,0.62], send:[0.25,0.4], dsend:[0.25,0.4], attack:0.003, release:[0.06,0.1], sustain:[0.5,0.62]}},   // MUSICALITY balance loop 1 (buried-lead template class): level [0.3,0.42]->[0.5,0.62], the standbylightdrive calibration — same mechanism, pluck/fm template lead sampled-by-default under a heavy mix. Matrix unmoved (level is not a verifier feature).
      pads:{prob:0.25, recipe:{model:["saw","organ"], wave:"saw", cutoff:[600,1000], detune:[0.005,0.012], attack:[1,2.5], level:[0.3,0.42], send:[0.3,0.45], dsend:[0.1,0.2]}},
      drums:{kickModel:["909","boom"], snareModel:["clap","noise"], hatModel:["noise"], kick:[1.1,1.3], snare:[0.75,1], hat:[1.1,1.4], tune:[0.95,1.1], send:[0.15,0.3], dsend:[0.05,0.15], kit:"power"},
      fx:{reverb:[0.66,0.84], delayBeats:[0.375,0.5], delayFb:[0.15,0.3], delayCut:[2600,3800], pump:[0.13,0.35], crackle:[0.35,0.51], lowcut:[30,45], highcut:[0,0], comp:[0.26,0.48], grit:[0,0]},
      found:{role:"bed", vol:[0.06,0.12], pitch:[0.85,1], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:city*2","pool:voices*1"]},
      hits:{sources:["pool:horn_stab*1","sp_rhythm","pool:vocal_stab*1"], pattern:"offbeat", prob:0.5},
      stab:["off","sparse"],
      form:"pop",
      reverbColor:"dattorro",
      masterComp:0.35 },
    /* /genre-tool:hopscotchwave:genres */
    /* genre-tool:moltenhouse:genres */
    moltenhouse: { label:"Mantle Plume", info:"A four-on-the-floor at 115-123. Sub bass under an FM lead pad, with an alto sax. A two-chord vamp, a light shuffle.",
      bpm:[115,123],
      swing:[0.04,0.09],
      humanize:[0.06,0.15],
      progressions:["deep_two","deep_two","drone_min"],
      kits:["house","four"],
      fills:["cut","riser","impact"],
      bass:{patterns:["dub","sub"], recipe:{model:["sub"], cutoff:[260,460], res:[0.05,0.15], level:[1.2,1.4], send:[0,0.06], dsend:[0,0.05]}},
      lead:{patterns:["pentaup","sparse","wander"], patchPool:["E.PIANO 1","E.PIANO 3"], samplerPool:["alto_sax","felt_piano","jazz_guitar"], recipe:{model:["fm","pluck","sampler","sampler","sampler"], wave:"sine", voices:[1,3], spread:[0.002,0.005], cutoff:[1800,2800], level:[0.52,0.64], send:[0.35,0.5], dsend:[0.2,0.35], vibrato:[0.005,0.012], octave:0.06, attack:0.025, release:[0.12,0.2], sustain:[0.66,0.78], fenv:[0.15,0.3]}, inserts:{prob:0.4, max:1, pool:[["chorus",{rate:[0.3,0.8], depth:[0.5,0.8], mix:[0.35,0.55]}]]}},   // BURIED LEAD: the reedy oboe was inaudible. The level range was synth-tuned, but the sampled winds sat ~0.44 dry under a 1.2-1.3 sub+kick with reverb .7-.88 (wet ~3x dry), so level goes [0.4,0.52]->[0.52,0.64] — which also self-trims relative wetness (rev gain = send/lvl). Five sibling gap-found anchors share this exact template lead.
      pads:{prob:0.9, recipe:{model:["fm"], wave:"sine", cutoff:[900,1500], detune:[0.003,0.008], attack:[0.8,1.8], level:[0.5,0.68], send:[0.35,0.55], dsend:[0.1,0.2]}},
      drums:{kickModel:["909"], snareModel:["clap","crack"], hatModel:["noise","metal"], kick:[1.1,1.35], snare:[0.6,0.85], hat:[0.6,0.9], tune:[0.98,1.1], send:[0.1,0.25], dsend:[0.05,0.15]},
      fx:{reverb:[0.7,0.88], delayBeats:[0.75,1.5], delayFb:[0.5,0.7], delayCut:[1600,2600], pump:[0.03,0.25], crackle:[0.03,0.19], lowcut:[25,40], highcut:[0,0], comp:[0.12,0.34], grit:[0.1,0.25], jux:[0.15,0.3]},
      found:{role:"chops", vol:[0.1,0.18], pitch:[0.95,1.15], stretch:[0.4,0.6], cutoff:[2500,4000], sources:["shibuya","tokyo_station","vx_suspense","stml_chop_a","stml_chop_b"]},
      hits:{sources:["pool:vocal_stab*2","sp_rewind","sp_pressure"], pattern:"dub", prob:0.75, wet:true},
      stab:["off","sparse"],
      form:"dj",
      reverbColor:"spring" },
    /* /genre-tool:moltenhouse:genres */
    /* genre-tool:magmastrut:genres */
    magmastrut: { label:"Basalt Swagger", info:"A bare kick at 97-105. Sub bass under ahh choir, with an alto sax. A two-chord vamp, a light shuffle, one chord every 16 beats.",
      bpm:[97,105],
      swing:[0.022,0.072],
      humanize:[0.037,0.127],
      progressions:["deep_two","mode_phrygian","drone_min"],
      kits:["off","kick"],
      fills:["off","dropout"],
      chordEvery:16,
      bass:{patterns:["pedal","sub","root"], recipe:{model:["sub","saw"], cutoff:[380,650], res:[0.06,0.14], level:[0.6,0.82], send:[0.15,0.35], dsend:[0,0.05]}},
      lead:{patterns:["composed","composed2","arpup","wander"], patchPool:["E.PIANO 1","TUB BELLS","E.PIANO 4","SHIMMER"], samplerPool:["alto_sax","tenor_sax"], recipe:{model:["stack","stack","dx7","sampler","sampler"], wave:"sine", voices:[1,3], spread:[0.003,0.006], cutoff:[2800,4000], level:[0.52,0.64], send:[0.4,0.6], dsend:[0.2,0.4], vibrato:[0.004,0.009], octave:0.2, attack:0.08, release:[0.45,0.6], sustain:[0.85,0.95]}, inserts:{prob:0.5, max:1, pool:[["chorus",{rate:[0.5,1.1], depth:[0.5,0.7], mix:[0.4,0.6]}]]}},   // MUSICALITY balance loop 1 (buried-lead template class): level [0.4,0.52]->[0.52,0.64], the moltenhouse calibration — synth-tuned template lead remapped onto samplers sat buried under a hot bass/pump mix; raising lvl self-trims relative wetness (rev gain = send/lvl). Level is not a verifier feature (matrix unmoved); state fixtures drift for exactly this class.
      pads:{prob:1, samplerPool:["ahh_choir","strings"], recipe:{model:["saw","choir","strings","sampler"], wave:"saw", cutoff:[1100,1800], detune:[0.004,0.009], attack:[1.2,2.4], mellotron:true, level:[0.6,0.8], send:[0.5,0.7], dsend:[0.1,0.25]}, inserts:{prob:0.55, max:1, pool:[["chorus",{rate:[0.2,0.5], depth:[0.5,0.75], mix:[0.4,0.6]}]]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.4,0.65], snare:[0.25,0.45], hat:[0.25,0.45], tune:[0.9,1], send:[0.2,0.4], dsend:[0,0.05]},
      fx:{reverb:[0.61,0.79], delayBeats:[0.75,1.5], delayFb:[0.15,0.3], delayCut:[2000,3000], pump:[0,0.22], crackle:[0.08,0.24], lowcut:[0,0], highcut:[2600,3400], comp:[0.09,0.31]},
      found:{role:"bed", vol:[0.2,0.32], pitch:[0.9,1], stretch:[0.45,0.6], cutoff:[2800,4200], sources:["vx_cn_east","vx_cn_march","vx_cn_opera","vx_cn_speech"]},
      hits:{sources:["sp_system","pool:chime*1"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"wave",
      reverbColor:"greyhole" },
    /* /genre-tool:magmastrut:genres */
    /* genre-tool:hammerhouse:genres */
    hammerhouse: { label:"Percussive Maintenance", info:"A boom-bap kit at 119-127. Acid bass under a Hammond, with a rock organ. A min7 house vamp, a light shuffle, rubato.",
      bpm:[119,127],
      swing:[0.009,0.059],
      humanize:[0.16,0.25],
      progressions:["house_min7","pop_1625","doo_wop"],
      kits:["boombap","halftime","kick"],
      fills:["off","downlift","riser"],
      bass:{patterns:["stab","rolling","drive","syncopated"], recipe:{model:["acid"], cutoff:[420,700], res:[0.3,0.45], level:[1.1,1.3], send:[0,0.08], dsend:[0,0.1]}, inserts:{prob:0.6, max:2, pool:[["distort",{drive:[0.3,0.6], mix:[0.6,0.9]}],["filtersweep",{rateBars:[2,4], lo:[-0.8,-0.3], hi:[0.8,1.4], res:[0.35,0.5]}]]}},
      lead:{patterns:["hero","double","anthem"], recipe:{model:["sampler","hammond","dx7"], samplerPool:["rock_organ","percussive_organ"], patchPool:["60-S ORGAN"], wave:"saw", voices:[2,4], cutoff:[2400,3600], leslie:[0.8,0.95], level:[0.44,0.58], send:[0.25,0.45], dsend:[0.1,0.25]}},
      pads:{prob:0.5, recipe:{model:["hammond","organ","juno60"], wave:"saw", cutoff:[1000,1700], detune:[0.005,0.011], attack:[0.3,0.9], leslie:[0.8,0.9], level:[0.42,0.58], send:[0.3,0.5], dsend:[0.1,0.2]}},
      drums:{kickModel:["808","boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.95,1.2], snare:[0.5,0.75], hat:[0.45,0.75], tune:[0.85,1], send:[0.2,0.35], dsend:[0.05,0.2]},
      fx:{reverb:[0.4,0.58], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[3000,4500], pump:[0.31,0.53], crackle:[0,0.16], lowcut:[30,45], highcut:[0,0], comp:[0.26,0.48]},
      found:{role:"chops", vol:[0.1,0.18], pitch:[0.95,1.15], stretch:[0.4,0.6], cutoff:[2500,4000], sources:["shibuya","tokyo_station","vx_suspense","stml_chop_c","stml_chop_d"]},
      rubato:{depth:[0.008,0.018], periodBars:[2,3], prob:0.35},
      hits:{sources:["pool:vb_industrial_machine*1","ca_horn","bb_horn_a"], pattern:"offbeat", prob:0.4},
      stab:["offbeat"],
      form:"pop",
      reverbColor:"spring" },
    /* /genre-tool:hammerhouse:genres */
    /* genre-tool:zestgallop:genres */
    zestgallop: { label:"Perihelion Sprint", info:"A boom-bap kit at 140-148. Saw synth bass under strings, with a rhodes ep. Epic minor changes, hard swing.",
      bpm:[140,148],
      swing:[0.156,0.206],
      humanize:[0.201,0.291],
      progressions:["epic_min","minor_run","sad_pop","drone_min"],
      kits:["boombap","breaks"],
      fills:["off","drum fill","downlift"],
      bass:{patterns:["rolling","stab","melodic","syncopated"], patchPool:["SYN-BASS 2"], recipe:{model:["saw","sub","dx7"], cutoff:[380,700], res:[0.15,0.3], level:[1,1.2], send:[0,0.08], dsend:[0,0.05]}},
      lead:{patterns:["sparse","pentaup","wander"], samplerPool:["rhodes_ep","electric_piano","jazz_guitar"], recipe:{model:["fm","sampler","sampler"], wave:"sine", voices:[1,3], spread:[0.002,0.005], cutoff:[1800,2800], level:[0.4,0.52], send:[0.3,0.45], dsend:[0.15,0.3], attack:0.02, release:[0.12,0.2], sustain:[0.66,0.78]}},
      pads:{prob:0.7, samplerPool:["strings"], recipe:{model:["fm","sampler"], wave:"sine", cutoff:[900,1500], detune:[0.003,0.008], attack:[0.8,1.8], level:[0.5,0.66], send:[0.3,0.5], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom","808"], snareModel:["crack","noise"], hatModel:["noise"], kick:[1.1,1.35], snare:[0.8,1.05], hat:[0.6,0.9], tune:[0.9,1.05], send:[0.12,0.25], dsend:[0.05,0.15], kit:"room"},
      fx:{reverb:[0.45,0.63], delayBeats:[0.5,0.75], delayFb:[0.2,0.35], delayCut:[1800,2800], pump:[0.17,0.39], crackle:[0.08,0.24], lowcut:[0,25], highcut:[0,0], comp:[0.29,0.51]},
      found:{role:"break", vol:[0.32,0.45], pitch:[1,1], stretch:[0.5,0.5], cutoff:[6000,9000], sources:["amen_165","amen_170","amen_172","amen_175"]},
      snarePP:0.5,
      hits:{sources:["pool:vocal_stab*2","sp_rewind"], pattern:"sparse", prob:0.4},
      stab:["off"],
      form:"pop" },
    /* /genre-tool:zestgallop:genres */
    /* genre-tool:whittlertrot:genres */
    whittlertrot: { label:"Lagrange Lathe", info:"A bare kick at 95-103. Saw synth bass under an organ, with a clarinet. Dream changes, a light shuffle, rubato.",
      bpm:[95,103],
      swing:[0.016,0.066],
      humanize:[0.194,0.284],
      progressions:["dream","mode_lydian","ii_v_i"],
      kits:["kick","kick","halftime"],
      fills:["off","downlift"],
      bass:{patterns:["rolling","stab","melodic","syncopated"], patchPool:["SYN-BASS 2"], recipe:{model:["saw","sub","dx7"], cutoff:[380,700], res:[0.15,0.3], level:[1,1.2], send:[0,0.08], dsend:[0,0.05]}},
      lead:{patterns:["wander","sparse","pentaup"], samplerPool:["clarinet","flute","vibraphone","celesta"], recipe:{model:["sampler","sampler","sampler","stack","modeld"], wave:"sine", voices:[1,2], spread:[0.001,0.003], cutoff:[2600,3800], level:[0.44,0.56], send:[0.45,0.65], dsend:[0.2,0.35], vibrato:[0.014,0.022], vibRate:[5.5,6.5], attack:0.06, release:[0.3,0.5], sustain:[0.85,0.95], glide:[80,150], envAmount:[0.5,1.2], envDecay:[0.3,0.6], oscMix:[0,0.3], drift:[6,12], drive:[0.05,0.2]}},
      pads:{prob:1, recipe:{model:["organ"], wave:"saw", cutoff:[1000,1600], detune:[0.003,0.008], attack:[1.5,3], level:[0.5,0.65], send:[0.5,0.7], dsend:[0.1,0.2]}, inserts:{prob:0.35, max:1, pool:[["phaser",{rate:[0.05,0.15], depth:[0.4,0.6], mix:[0.3,0.45]}]]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.7,0.95], snare:[0.4,0.6], hat:[0.5,0.8], tune:[0.95,1.1], send:[0.2,0.35], dsend:[0,0.1], kit:"jazz"},
      fx:{reverb:[0.37,0.55], delayBeats:[0.75,1], delayFb:[0.3,0.45], delayCut:[2200,3200], pump:[0,0.2], crackle:[0.03,0.19], lowcut:[0,20], highcut:[0,0], comp:[0.09,0.31]},
      found:{role:"bed", vol:[0.14,0.24], pitch:[0.7,0.9], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:city*1","pool:road*1","pool:voices*1"]},
      rubato:{depth:[0.008,0.02], periodBars:[3,5], prob:1},
      sampleEvents:[{pool:["vx_apollo","vx_wwvh"], placement:"response", sections:"verse|chorus|bridge|hook", prob:0.3, gain:0.4, treatment:{pitch:1, cutoff:1600, rsend:0.5, dsend:0.3}}],
      hits:{sources:["sp_herenow","pool:vocal_stab*1"], pattern:"sparse", prob:0.3},
      stab:["off"],
      form:"pop",
      reverbColor:"dattorro" },
    /* /genre-tool:whittlertrot:genres */
    /* genre-tool:bunkerthump:genres */
    bunkerthump: { label:"Blast Door Liturgy", info:"A pulse kit at 123-131. Sub bass under ahh choir, with an alto sax. A two-chord vamp, a light shuffle.",
      bpm:[123,131],
      swing:[0.013,0.063],
      humanize:[0.091,0.181],
      progressions:["deep_two","mode_phrygian","drone_min"],
      kits:["pulse","techno"],
      fills:["cut","impact","hat rush","stutter"],
      bass:{patterns:["sub","dub"], recipe:{model:["sub","reese"], cutoff:[260,480], res:[0.05,0.2], level:[1.2,1.45], send:[0,0.05], dsend:[0,0]}, inserts:{prob:0.3, max:1, pool:[["distort",{drive:[0.15,0.35], mix:[0.4,0.7]}]]}},
      lead:{patterns:["composed","composed2","arpup","wander"], patchPool:["E.PIANO 1","TUB BELLS","E.PIANO 4","SHIMMER"], samplerPool:["alto_sax","tenor_sax"], recipe:{model:["stack","stack","dx7","sampler","sampler"], wave:"sine", voices:[2,4], spread:[0.003,0.006], cutoff:[2800,4000], level:[0.4,0.52], send:[0.4,0.6], dsend:[0.2,0.4], vibrato:[0.004,0.009], octave:0.2, attack:0.08, release:[0.45,0.6], sustain:[0.85,0.95]}, inserts:{prob:0.5, max:1, pool:[["chorus",{rate:[0.5,1.1], depth:[0.5,0.7], mix:[0.4,0.6]}]]}},
      pads:{prob:1, samplerPool:["ahh_choir","strings"], recipe:{model:["saw","choir","strings","sampler"], wave:"saw", cutoff:[1100,1800], detune:[0.004,0.009], attack:[1.2,2.4], mellotron:true, level:[0.6,0.8], send:[0.5,0.7], dsend:[0.1,0.25]}, inserts:{prob:0.55, max:1, pool:[["chorus",{rate:[0.2,0.5], depth:[0.5,0.75], mix:[0.4,0.6]}]]}},
      drums:{kickModel:["909"], snareModel:["clap","crack"], hatModel:["metal"], kick:[1.3,1.5], snare:[0.85,1.1], hat:[0.7,1], tune:[0.9,1.05], send:[0.05,0.12], dsend:[0.1,0.25]},
      fx:{reverb:[0.58,0.76], delayBeats:[0.5,0.5], delayFb:[0.25,0.4], delayCut:[2200,3400], pump:[0.24,0.46], crackle:[0,0.09], lowcut:[30,45], highcut:[0,0], comp:[0.52,0.74], grit:[0.4,0.7], jux:[0.15,0.35]},
      found:{role:"break", vol:[0.32,0.45], pitch:[1,1], stretch:[0.5,0.5], cutoff:[6000,9000], sources:["amen_165","amen_170","amen_172","amen_175"]},
      vocSource:"sp_pressure",
      hits:{sources:["pool:vb_rave_hardcore*1","sp_pressure","sp_system","pool:rave_stab*1"], pattern:"dub", prob:0.6},
      stab:["offbeat","sparse"],
      form:"dj" },
    /* /genre-tool:bunkerthump:genres */
    /* genre-tool:gumballdrive:genres */
    gumballdrive: { label:"Sucrose Centrifuge", info:"A half-time kit at 119-127. Acoustic bass under a Hammond, with a rock organ. A min7 house vamp, a light shuffle.",
      bpm:[119,127],
      swing:[0.04,0.09],
      humanize:[0.103,0.193],
      progressions:["house_min7","pop_1625","doo_wop"],
      kits:["off","halftime","kick"],
      fills:["off","downlift"],
      bass:{patterns:["dub","simple","sub"], samplerPool:["acoustic_bass"], recipe:{model:["sub","saw","sampler"], cutoff:[300,600], res:[0.05,0.2], level:[1,1.25], send:[0.05,0.12], dsend:[0,0.1]}, inserts:{prob:0.5, max:1, pool:[["distort",{drive:[0.1,0.22], mix:[0.35,0.6]}]]}},
      lead:{patterns:["hero","double","anthem"], recipe:{model:["sampler","hammond","dx7"], samplerPool:["rock_organ","percussive_organ"], patchPool:["60-S ORGAN"], wave:"saw", voices:[1,3], cutoff:[2400,3600], leslie:[0.8,0.95], level:[0.44,0.58], send:[0.25,0.45], dsend:[0.1,0.25]}},
      pads:{prob:0.5, recipe:{model:["hammond","organ","juno60"], wave:"saw", cutoff:[1000,1700], detune:[0.005,0.011], attack:[0.3,0.9], leslie:[0.8,0.9], level:[0.42,0.58], send:[0.3,0.5], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.75,1], snare:[0.5,0.75], hat:[0.6,0.9], tune:[0.9,1.05], send:[0.35,0.5], dsend:[0,0.1]},
      fx:{reverb:[0.53,0.71], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[3000,4500], pump:[0.27,0.49], crackle:[0.02,0.18], lowcut:[30,45], highcut:[0,0], comp:[0.2,0.42]},
      found:{role:"break", vol:[0.32,0.45], pitch:[1,1], stretch:[0.5,0.5], cutoff:[6000,9000], sources:["amen_165","amen_170","amen_172","amen_175","stml_loop_129b","stml_loop_133b"]},
      hits:{sources:["pool:vb_mallsoft_vapor*1","ca_horn","bb_horn_a"], pattern:"offbeat", prob:0.4},
      stab:["offbeat"],
      form:"pop",
      reverbColor:"spring" },
    /* /genre-tool:gumballdrive:genres */
    /* genre-tool:kettlefunk:genres */
    kettlefunk: { label:"Samovar Nebula", info:"A bare kick at 100-108. Saw synth bass under ahh choir, with french horns. Doo-wop changes, hard swing, loose timing.",
      bpm:[100,108],
      swing:[0.179,0.229],
      humanize:[0.304,0.394],
      progressions:["doo_wop","canon","royal_road"],
      kits:["kick","kick","halftime"],
      fills:["off","downlift"],
      bass:{patterns:["root","simple","off"], recipe:{model:["saw","sub"], cutoff:[400,700], res:[0.05,0.15], level:[0.8,1], send:[0.1,0.2], dsend:[0,0.08]}},
      lead:{patterns:["wander","updown","pentaup"], patchPool:["HORNS","BRASSHORNS"], samplerPool:["french_horns"], recipe:{model:["brass","dx7","sampler","sampler"], wave:"sine", voices:[1,3], spread:[0.002,0.005], cutoff:[1500,2600], level:[0.36,0.5], send:[0.55,0.78], dsend:[0.3,0.5], vibrato:[0.004,0.01]}},
      pads:{prob:1, samplerPool:["ahh_choir"], recipe:{model:["vp330","vp330","vp330","choir","strings","sampler"], wave:"saw", cutoff:[700,1300], detune:[0.006,0.014], attack:[2.5,4.5], vowel:[0.4,0.5], ensemble:[0.9,1], mellotron:true, level:[0.62,0.82], send:[0.6,0.82], dsend:[0.15,0.3]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.7,0.95], snare:[0.4,0.6], hat:[0.5,0.8], tune:[0.95,1.1], send:[0.2,0.35], dsend:[0,0.1], kit:"jazz"},
      fx:{reverb:[0.8,0.98], delayBeats:[0.75,1], delayFb:[0.3,0.45], delayCut:[2200,3200], pump:[0,0.12], crackle:[0.13,0.29], lowcut:[0,20], highcut:[0,0], comp:[0.08,0.3]},
      found:{role:"bed", vol:[0.18,0.3], pitch:[0.8,0.95], stretch:[0.45,0.6], cutoff:[2400,3800], sources:["pool:voices*2","pool:room*1"]},
      sampleEvents:[{pool:["vx_apollo","vx_wwvh"], placement:"response", sections:"verse|chorus|bridge|hook", prob:0.3, gain:0.4, treatment:{pitch:1, cutoff:1600, rsend:0.5, dsend:0.3}}],
      hits:{sources:["pool:vb_domestic_appliance*1","sp_herenow","pool:vocal_stab*1"], pattern:"sparse", prob:0.3},
      stab:["off"],
      form:"pop",
      reverbColor:"dattorro" },
    /* /genre-tool:kettlefunk:genres */
    /* genre-tool:glosspump:genres */
    glosspump: { label:"Lacquer Piston", info:"A jungle kit at 124-132. Sub bass under ahh choir, with an alto sax. A two-chord minor drone, a light shuffle.",
      bpm:[124,132],
      swing:[0.031,0.081],
      humanize:[0.137,0.227],
      progressions:["drone_min","deep_two","house_min"],
      kits:["jungle","breaks"],
      fills:["break fill","cut","reverse"],
      bass:{patterns:["sub","dub","rolling"], recipe:{model:["sub","reese"], cutoff:[380,650], res:[0.1,0.22], level:[1.05,1.25], send:[0,0.06], dsend:[0.05,0.12]}},
      lead:{patterns:["composed","composed2","arpup","wander"], patchPool:["E.PIANO 1","TUB BELLS","E.PIANO 4","SHIMMER"], samplerPool:["alto_sax","tenor_sax"], recipe:{model:["stack","stack","dx7","sampler","sampler"], wave:"sine", voices:[1,3], spread:[0.003,0.006], cutoff:[2800,4000], level:[0.4,0.52], send:[0.4,0.6], dsend:[0.2,0.4], vibrato:[0.004,0.009], octave:0.2, attack:0.08, release:[0.45,0.6], sustain:[0.85,0.95]}, inserts:{prob:0.5, max:1, pool:[["chorus",{rate:[0.5,1.1], depth:[0.5,0.7], mix:[0.4,0.6]}]]}},
      pads:{prob:1, samplerPool:["ahh_choir","strings"], recipe:{model:["saw","choir","strings","sampler"], wave:"saw", cutoff:[1100,1800], detune:[0.004,0.009], attack:[1.2,2.4], mellotron:true, level:[0.6,0.8], send:[0.5,0.7], dsend:[0.1,0.25]}, inserts:{prob:0.55, max:1, pool:[["chorus",{rate:[0.2,0.5], depth:[0.5,0.75], mix:[0.4,0.6]}]]}},
      drums:{kickModel:["808"], snareModel:["crack","noise"], hatModel:["noise","metal"], kick:[1.1,1.35], snare:[0.55,0.8], hat:[0.6,0.9], tune:[0.98,1.1], send:[0.08,0.2], dsend:[0.1,0.25]},
      fx:{reverb:[0.43,0.61], delayBeats:[0.375,0.5], delayFb:[0.2,0.38], delayCut:[3000,4500], pump:[0.14,0.36], crackle:[0.23,0.39], lowcut:[35,50], highcut:[0,0], comp:[0.22,0.44]},
      found:{role:"break", vol:[0.32,0.45], pitch:[1,1], stretch:[0.5,0.5], cutoff:[6000,9000], sources:["amen_165","amen_170","amen_172","amen_175"]},
      hits:{sources:["pool:chime*1","sp_system"], pattern:"offbeat", prob:0.35},
      stab:["off"],
      form:"drop" },
    /* /genre-tool:glosspump:genres */
    /* genre-tool:refrigeratorfunk:genres */
    refrigeratorfunk: { label:"Freon Devotional", info:"Beatless at 104-112. Acoustic bass under a harp, with a flute. A minor pop cycle, a light shuffle.",
      bpm:[104,112],
      swing:[0.003,0.053],
      humanize:[0.142,0.232],
      progressions:["sad_pop","synthwave","doo_wop"],
      kits:["off"],
      fills:["off"],
      bass:{patterns:["dub","simple","sub"], samplerPool:["acoustic_bass"], recipe:{model:["sub","saw","sampler"], cutoff:[300,600], res:[0.05,0.2], level:[1,1.25], send:[0.05,0.12], dsend:[0,0.1]}, inserts:{prob:0.5, max:1, pool:[["distort",{drive:[0.1,0.22], mix:[0.35,0.6]}]]}},
      lead:{patterns:["sparse","wander","arpup"], samplerPool:["flute","harp","pan_flute"], recipe:{model:["stack","sampler","sampler"], wave:"sine", voices:[2,4], spread:[0.002,0.004], cutoff:[2200,3400], level:[0.4,0.5], send:[0.5,0.7], dsend:[0.25,0.4], vibrato:[0.006,0.012], attack:[0.15,0.4], release:[0.5,0.8], sustain:[0.85,0.95]}},
      pads:{prob:1, patchPool:["TUB BELLS","SHIMMER","CELESTE"], samplerPool:["harp","celesta"], recipe:{model:["vp330","vp330","solina","solina","choir","strings","dx7","sampler"], wave:"saw", cutoff:[900,1600], detune:[0.005,0.012], attack:[2.5,4.5], vowel:[0.5,0.65], breath:[0.4,0.55], ensemble:[0.75,0.9], octave:[0.5,0.6], level:[0.6,0.8], send:[0.6,0.8], dsend:[0.1,0.25]}, inserts:{prob:0.5, max:1, pool:[["chorus",{rate:[0.15,0.4], depth:[0.4,0.6], mix:[0.3,0.5]}]]}},
      drums:{kickModel:["808"], snareModel:["noise"], hatModel:["noise"], kick:[0.5,0.8], snare:[0.35,0.55], hat:[0.3,0.5], tune:[0.9,1.05], send:[0.25,0.45], dsend:[0,0.1]},
      fx:{reverb:[0.76,0.94], delayBeats:[1,1.5], delayFb:[0.35,0.5], delayCut:[1800,2800], pump:[0.21,0.43], crackle:[0,0.1], lowcut:[0,0], highcut:[0,0], comp:[0.19,0.41], grit:[0,0]},
      found:{role:"bed", vol:[0.08,0.14], pitch:[0.65,0.8], stretch:[0.45,0.6], cutoff:[1000,1800], sources:["pool:road*1","pool:industry*1","pool:voices*1"]},
      hits:{sources:["pool:vb_domestic_appliance*1","sp_herenow"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"wave" },
    /* /genre-tool:refrigeratorfunk:genres */
    /* genre-tool:sherbetchop:genres */
    sherbetchop: { label:"Sorbet Guillotine", info:"A boom-bap kit at 133-141. Saw synth bass under a saw synth pad, with a pluck lead. Epic minor changes, swung.",
      bpm:[133,141],
      swing:[0.099,0.149],
      humanize:[0.123,0.213],
      progressions:["epic_min","minor_run","sad_pop","drone_min"],
      kits:["boombap","breaks"],
      fills:["off","drum fill","downlift"],
      bass:{patterns:["root","simple","off"], recipe:{model:["saw","sub"], cutoff:[400,700], res:[0.05,0.15], level:[0.8,1], send:[0.1,0.2], dsend:[0,0.08]}},
      lead:{patterns:["off","sparse","pentaup"], recipe:{model:["pluck","fm"], wave:"sine", voices:[1,3], spread:[0.002,0.005], cutoff:[1800,2800], level:[0.5,0.62], send:[0.25,0.4], dsend:[0.25,0.4], attack:0.003, release:[0.06,0.1], sustain:[0.5,0.62]}},   // MUSICALITY balance loop 1 (buried-lead template class): level [0.3,0.42]->[0.5,0.62], the standbylightdrive calibration — same mechanism, pluck/fm template lead sampled-by-default under a heavy mix. Matrix unmoved (level is not a verifier feature).
      pads:{prob:0.25, recipe:{model:["saw","organ"], wave:"saw", cutoff:[600,1000], detune:[0.005,0.012], attack:[1,2.5], level:[0.3,0.42], send:[0.3,0.45], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom","808"], snareModel:["crack","noise"], hatModel:["noise"], kick:[1.1,1.35], snare:[0.8,1.05], hat:[0.6,0.9], tune:[0.9,1.05], send:[0.12,0.25], dsend:[0.05,0.15], kit:"room"},
      fx:{reverb:[0.44,0.62], delayBeats:[0.5,0.75], delayFb:[0.2,0.35], delayCut:[1800,2800], pump:[0.29,0.51], crackle:[0.28,0.44], lowcut:[0,25], highcut:[0,0], comp:[0.39,0.61]},
      found:{role:"chops", vol:[0.1,0.18], pitch:[0.95,1.15], stretch:[0.4,0.6], cutoff:[2500,4000], sources:["shibuya","tokyo_station","vx_suspense"]},
      snarePP:0.5,
      hits:{sources:["pool:vocal_stab*2","sp_rewind"], pattern:"sparse", prob:0.4},
      stab:["off"],
      form:"pop" },
    /* /genre-tool:sherbetchop:genres */
    /* genre-tool:pinballchop:genres */
    pinballchop: { label:"Solenoid Rapture", info:"A four-on-the-floor at 109-117. Saw synth bass under an organ, with a pluck lead. A funk vamp, a light shuffle.",
      bpm:[109,117],
      swing:[0.03,0.08],
      humanize:[0.017,0.107],
      progressions:["funk_vamp","house_min7","pop_1625"],
      kits:["four","open"],
      fills:["hat rush","drum fill","riser"],
      bass:{patterns:["rolling","stab","melodic","syncopated"], patchPool:["SYN-BASS 2"], recipe:{model:["saw","sub","dx7"], cutoff:[380,700], res:[0.15,0.3], level:[1,1.2], send:[0,0.08], dsend:[0,0.05]}},
      lead:{patterns:["double","double","arpup","off"], recipe:{model:["pluck","stack"], wave:"square", voices:[1,2], spread:[0.002,0.006], cutoff:[1500,2600], level:[0.3,0.42], send:[0.15,0.3], dsend:[0.2,0.4], vibrato:[0,0.002], octave:0, attack:0.003, release:[0.04,0.07], sustain:[0.45,0.55], fenv:[0.8,1.2], res:[0.28,0.4]}},
      pads:{prob:0.3, recipe:{model:["organ","saw"], wave:"saw", cutoff:[550,900], detune:[0.004,0.01], attack:[1.5,3], level:[0.3,0.45], send:[0.3,0.5], dsend:[0.1,0.2]}},
      drums:{kickModel:["909","boom"], snareModel:["clap","noise"], hatModel:["noise"], kick:[1.1,1.3], snare:[0.75,1], hat:[1.1,1.4], tune:[0.95,1.1], send:[0.15,0.3], dsend:[0.05,0.15], kit:"power"},
      fx:{reverb:[0.42,0.6], delayBeats:[0.375,0.5], delayFb:[0.15,0.3], delayCut:[2600,3800], pump:[0.04,0.26], crackle:[0,0.15], lowcut:[30,45], highcut:[0,0], comp:[0.25,0.47], grit:[0,0]},
      found:{role:"break", vol:[0.32,0.45], pitch:[1,1], stretch:[0.5,0.5], cutoff:[6000,9000], sources:["amen_165","amen_170","amen_172","amen_175"]},
      hits:{sources:["pool:horn_stab*1","sp_rhythm","pool:vocal_stab*1"], pattern:"offbeat", prob:0.5},
      stab:["off","sparse"],
      form:"pop",
      reverbColor:"dattorro",
      masterComp:0.35 },
    /* /genre-tool:pinballchop:genres */
    /* genre-tool:idlingsplice:genres */
    idlingsplice: { label:"Standby Leviathan", info:"A four-on-the-floor at 90-98. Acoustic bass under ahh choir, with french horns. A two-chord vamp, a light shuffle.",
      bpm:[90,98],
      swing:[0.022,0.072],
      humanize:[0.082,0.172],
      progressions:["deep_two","house_min7","neosoul"],
      kits:["four","house"],
      fills:["off","hat rush","riser"],
      bass:{patterns:["dub","simple","sub"], samplerPool:["acoustic_bass"], recipe:{model:["sub","saw","sampler"], cutoff:[300,600], res:[0.05,0.2], level:[1,1.25], send:[0.05,0.12], dsend:[0,0.1]}, inserts:{prob:0.5, max:1, pool:[["distort",{drive:[0.1,0.22], mix:[0.35,0.6]}]]}},
      lead:{patterns:["wander","updown","pentaup"], patchPool:["HORNS","BRASSHORNS"], samplerPool:["french_horns"], recipe:{model:["brass","dx7","sampler","sampler"], wave:"sine", voices:[2,4], spread:[0.002,0.005], cutoff:[1500,2600], level:[0.36,0.5], send:[0.55,0.78], dsend:[0.3,0.5], vibrato:[0.004,0.01]}},
      pads:{prob:1, samplerPool:["ahh_choir"], recipe:{model:["vp330","vp330","vp330","choir","strings","sampler"], wave:"saw", cutoff:[700,1300], detune:[0.006,0.014], attack:[2.5,4.5], vowel:[0.4,0.5], ensemble:[0.9,1], mellotron:true, level:[0.62,0.82], send:[0.6,0.82], dsend:[0.15,0.3]}},
      drums:{kickModel:["909","808"], snareModel:["clap"], hatModel:["noise"], kick:[1.15,1.35], snare:[0.5,0.75], hat:[0.7,1], tune:[0.95,1.05], send:[0.1,0.2], dsend:[0.05,0.15]},
      fx:{reverb:[0.87,1], delayBeats:[0.75,0.75], delayFb:[0.3,0.45], delayCut:[2200,3200], pump:[0.11,0.33], crackle:[0.04,0.2], lowcut:[30,45], highcut:[0,0], comp:[0.27,0.49]},
      found:{role:"break", vol:[0.32,0.45], pitch:[1,1], stretch:[0.5,0.5], cutoff:[6000,9000], sources:["amen_165","amen_170","amen_172","amen_175"]},
      hits:{sources:["pool:vb_transit*1","pool:vocal_stab*1","sp_herenow"], pattern:"sparse", prob:0.35},
      stab:["off","sparse"],
      form:"dj" },
    /* /genre-tool:idlingsplice:genres */
    /* genre-tool:trenchsway:genres */
    trenchsway: { label:"Thermocline Cradle", info:"A four-on-the-floor at 75-83. Sub bass under ahh choir, with french horns. A canon, a light shuffle, one chord every 16 beats.",
      bpm:[75,83],
      swing:[0.006,0.056],
      humanize:[0.22,0.31],
      progressions:["canon","minor_run","dream"],
      kits:["house","four"],
      fills:["cut","riser","impact"],
      chordEvery:16,
      bass:{patterns:["sub","dub"], recipe:{model:["sub","reese"], cutoff:[260,480], res:[0.05,0.2], level:[1.2,1.45], send:[0,0.05], dsend:[0,0]}, inserts:{prob:0.3, max:1, pool:[["distort",{drive:[0.15,0.35], mix:[0.4,0.7]}]]}},
      lead:{patterns:["wander","updown","pentaup"], patchPool:["HORNS","BRASSHORNS"], samplerPool:["french_horns"], recipe:{model:["brass","dx7","sampler","sampler"], wave:"sine", voices:[1,3], spread:[0.002,0.005], cutoff:[1500,2600], level:[0.36,0.5], send:[0.55,0.78], dsend:[0.3,0.5], vibrato:[0.004,0.01]}},
      pads:{prob:1, samplerPool:["ahh_choir"], recipe:{model:["vp330","vp330","vp330","choir","strings","sampler"], wave:"saw", cutoff:[700,1300], detune:[0.006,0.014], attack:[2.5,4.5], vowel:[0.4,0.5], ensemble:[0.9,1], mellotron:true, level:[0.62,0.82], send:[0.6,0.82], dsend:[0.15,0.3]}},
      drums:{kickModel:["909"], snareModel:["clap","crack"], hatModel:["noise","metal"], kick:[1.1,1.35], snare:[0.6,0.85], hat:[0.6,0.9], tune:[0.98,1.1], send:[0.1,0.25], dsend:[0.05,0.15]},
      fx:{reverb:[0.87,1], delayBeats:[0.75,1.5], delayFb:[0.15,0.3], delayCut:[2000,3000], pump:[0,0.12], crackle:[0,0.15], lowcut:[0,0], highcut:[0,0], comp:[0.18,0.4]},
      found:{role:"narration", vol:[0.35,0.55], pitch:[0.98,1.05], stretch:[0.9,1.05], cutoff:[2600,3600], sources:["vx_apollo"]},
      hits:{sources:["sp_system","pool:chime*1"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"wave",
      reverbColor:"greyhole" },
    /* /genre-tool:trenchsway:genres */
    /* genre-tool:tarbreak:genres */
    tarbreak: { label:"Pitch Drop Panic", info:"A tribal kit at 145-153. Acoustic bass under ahh choir, with an alto sax. An uplifting cadence, a light shuffle, euclidean hats.",
      bpm:[145,153],
      swing:[0.004,0.054],
      humanize:[0.098,0.188],
      progressions:["uplift","epic_min","sad_pop","synthwave"],
      kits:["tribal","breaks"],
      fills:["drum fill","tom fill","off"],
      euclid:{kick:[5,16]},
      bass:{patterns:["dub","simple","sub"], samplerPool:["acoustic_bass"], recipe:{model:["sub","saw","sampler"], cutoff:[300,600], res:[0.05,0.2], level:[1,1.25], send:[0.05,0.12], dsend:[0,0.1]}, inserts:{prob:0.5, max:1, pool:[["distort",{drive:[0.1,0.22], mix:[0.35,0.6]}]]}},
      lead:{patterns:["composed","composed2","arpup","wander"], patchPool:["E.PIANO 1","TUB BELLS","E.PIANO 4","SHIMMER"], samplerPool:["alto_sax","tenor_sax"], recipe:{model:["stack","stack","dx7","sampler","sampler"], wave:"sine", voices:[1,3], spread:[0.003,0.006], cutoff:[2800,4000], level:[0.4,0.52], send:[0.4,0.6], dsend:[0.2,0.4], vibrato:[0.004,0.009], octave:0.2, attack:0.08, release:[0.45,0.6], sustain:[0.85,0.95]}, inserts:{prob:0.5, max:1, pool:[["chorus",{rate:[0.5,1.1], depth:[0.5,0.7], mix:[0.4,0.6]}]]}},
      pads:{prob:1, samplerPool:["ahh_choir","strings"], recipe:{model:["saw","choir","strings","sampler"], wave:"saw", cutoff:[1100,1800], detune:[0.004,0.009], attack:[1.2,2.4], mellotron:true, level:[0.6,0.8], send:[0.5,0.7], dsend:[0.1,0.25]}, inserts:{prob:0.55, max:1, pool:[["chorus",{rate:[0.2,0.5], depth:[0.5,0.75], mix:[0.4,0.6]}]]}},
      drums:{kickModel:["808","boom"], snareModel:["crack"], hatModel:["noise"], kick:[1.1,1.3], snare:[0.7,0.95], hat:[0.9,1.2], tune:[1.05,1.2], send:[0.1,0.2], dsend:[0.1,0.25]},
      fx:{reverb:[0.69,0.87], delayBeats:[0.5,0.75], delayFb:[0.25,0.4], delayCut:[2200,3400], pump:[0.09,0.31], crackle:[0.03,0.19], lowcut:[25,40], highcut:[2600,3400], comp:[0.4,0.62]},
      found:{role:"chops", vol:[0.1,0.18], pitch:[0.95,1.15], stretch:[0.4,0.6], cutoff:[2500,4000], sources:["shibuya","tokyo_station","vx_suspense"]},
      hits:{sources:["pool:vocal_stab*1","sp_rhythm"], pattern:"sparse", prob:0.4},
      stab:["off"],
      form:"pop" },
    /* /genre-tool:tarbreak:genres */
    /* genre-tool:cedarskank:genres */
    cedarskank: { label:"Dendrochronology Skank", info:"A shuffle at 118-126. Acoustic bass under an FM lead pad, with an alto sax. Doo-wop changes, hard swing, loose timing.",
      bpm:[118,126],
      swing:[0.197,0.247],
      humanize:[0.282,0.372],
      progressions:["doo_wop","canon","royal_road"],
      kits:["shuffle","boombap","shuffle"],
      fills:["off","drum fill"],
      bass:{patterns:["walking","walking","melodic"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sampler","piano"], cutoff:[500,1000], res:[0.05,0.15], level:[0.9,1.1], send:[0.1,0.2], dsend:[0,0.05], attack:0.005, release:[0.08,0.14]}},
      lead:{patterns:["pentaup","sparse","wander"], patchPool:["E.PIANO 1","E.PIANO 3"], samplerPool:["alto_sax","felt_piano","jazz_guitar"], recipe:{model:["fm","pluck","sampler","sampler","sampler"], wave:"sine", voices:[1,3], spread:[0.002,0.005], cutoff:[1800,2800], level:[0.52,0.64], send:[0.35,0.5], dsend:[0.2,0.35], vibrato:[0.005,0.012], octave:0.06, attack:0.025, release:[0.12,0.2], sustain:[0.66,0.78], fenv:[0.15,0.3]}, inserts:{prob:0.4, max:1, pool:[["chorus",{rate:[0.3,0.8], depth:[0.5,0.8], mix:[0.35,0.55]}]]}},   // MUSICALITY balance loop 1 (buried-lead template class): level [0.4,0.52]->[0.52,0.64], the moltenhouse calibration — synth-tuned template lead remapped onto samplers sat buried under a hot bass/pump mix; raising lvl self-trims relative wetness (rev gain = send/lvl). Level is not a verifier feature (matrix unmoved); state fixtures drift for exactly this class.
      pads:{prob:0.9, recipe:{model:["fm"], wave:"sine", cutoff:[900,1500], detune:[0.003,0.008], attack:[0.8,1.8], level:[0.5,0.68], send:[0.35,0.55], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom","808"], snareModel:["noise"], hatModel:["noise"], kick:[0.9,1.15], snare:[0.5,0.7], hat:[0.5,0.8], tune:[0.85,1], send:[0.15,0.3], dsend:[0,0.1], kit:"acoustic"},
      fx:{reverb:[0.3,0.48], delayBeats:[0.5,0.75], delayFb:[0.1,0.25], delayCut:[2000,3000], pump:[0,0.13], crackle:[0.22,0.38], lowcut:[0,30], highcut:[2600,3400], comp:[0.17,0.39]},
      found:{role:"bed", vol:[0.05,0.12], pitch:[0.8,1], stretch:[0.45,0.6], cutoff:[1500,2500], sources:["pool:city*2","vx_whitman"]},
      hits:{sources:["blues_vox_78","blues_vox_78","pool:horn_stab*1"], pattern:"response", prob:0.75},
      stab:["off"],
      form:"pop",
      reverbColor:"fdn",
      timeFeel:{pushPull:{bass:0.015, snare:0.01}} },
    /* /genre-tool:cedarskank:genres */
    /* genre-tool:bramblestep:genres */
    bramblestep: { label:"Hedge Maze Vespers", info:"A boom-bap kit at 74-82. Saw synth bass under an FM lead pad, with an alto sax. Neo-soul changes, hard swing.",
      bpm:[74,82],
      swing:[0.17,0.22],
      humanize:[0.188,0.278],
      progressions:["neosoul","dream","deep_two","mode_mixo"],
      kits:["boombap","halftime","kick"],
      fills:["off","downlift","riser"],
      bass:{patterns:["rolling","stab","melodic","syncopated"], patchPool:["SYN-BASS 2"], recipe:{model:["saw","sub","dx7"], cutoff:[380,700], res:[0.15,0.3], level:[1,1.2], send:[0,0.08], dsend:[0,0.05]}},
      lead:{patterns:["pentaup","sparse","wander"], patchPool:["E.PIANO 1","E.PIANO 3"], samplerPool:["alto_sax","felt_piano","jazz_guitar"], recipe:{model:["fm","pluck","sampler","sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.002,0.005], cutoff:[1800,2800], level:[0.52,0.64], send:[0.35,0.5], dsend:[0.2,0.35], vibrato:[0.005,0.012], octave:0.06, attack:0.025, release:[0.12,0.2], sustain:[0.66,0.78], fenv:[0.15,0.3]}, inserts:{prob:0.4, max:1, pool:[["chorus",{rate:[0.3,0.8], depth:[0.5,0.8], mix:[0.35,0.55]}]]}},   // MUSICALITY balance loop 1 (buried-lead template class): level [0.4,0.52]->[0.52,0.64], the moltenhouse calibration — synth-tuned template lead remapped onto samplers sat buried under a hot bass/pump mix; raising lvl self-trims relative wetness (rev gain = send/lvl). Level is not a verifier feature (matrix unmoved); state fixtures drift for exactly this class.
      pads:{prob:0.9, recipe:{model:["fm"], wave:"sine", cutoff:[900,1500], detune:[0.003,0.008], attack:[0.8,1.8], level:[0.5,0.68], send:[0.35,0.55], dsend:[0.1,0.2]}},
      drums:{kickModel:["808","boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.95,1.2], snare:[0.5,0.75], hat:[0.45,0.75], tune:[0.85,1], send:[0.2,0.35], dsend:[0.05,0.2]},
      fx:{reverb:[0.7,0.88], delayBeats:[0.75,1.5], delayFb:[0.3,0.5], delayCut:[1800,2800], pump:[0,0.14], crackle:[0.19,0.35], lowcut:[0,25], highcut:[2600,3400], comp:[0.18,0.4]},
      found:{role:"bed", vol:[0.18,0.3], pitch:[0.8,0.95], stretch:[0.45,0.6], cutoff:[2400,3800], sources:["pool:voices*2","pool:room*1"]},
      snarePP:0.66,
      hits:{sources:["pool:vocal_stab*1","sp_herenow"], pattern:"sparse", prob:0.2},
      stab:["off"],
      form:"pop",
      timeFeel:{pushPull:{bass:0.011, hat:-0.007}} },
    /* /genre-tool:bramblestep:genres */
    /* genre-tool:toastercore:genres */
    toastercore: { label:"Nichrome Panic", info:"A tribal kit at 187-195. Saw synth bass under an FM lead pad, with an alto sax. An uplifting cadence, swung, euclidean hats.",
      bpm:[187,195],
      swing:[0.085,0.135],
      humanize:[0.169,0.259],
      progressions:["uplift","epic_min","sad_pop","synthwave"],
      kits:["tribal","breaks"],
      fills:["drum fill","tom fill","off"],
      euclid:{kick:[5,16]},
      bass:{patterns:["rolling","stab","melodic","syncopated"], patchPool:["SYN-BASS 2"], recipe:{model:["saw","sub","dx7"], cutoff:[380,700], res:[0.15,0.3], level:[1,1.2], send:[0,0.08], dsend:[0,0.05]}},
      lead:{patterns:["pentaup","sparse","wander"], patchPool:["E.PIANO 1","E.PIANO 3"], samplerPool:["alto_sax","felt_piano","jazz_guitar"], recipe:{model:["fm","pluck","sampler","sampler","sampler"], wave:"sine", voices:[1,3], spread:[0.002,0.005], cutoff:[1800,2800], level:[0.52,0.64], send:[0.35,0.5], dsend:[0.2,0.35], vibrato:[0.005,0.012], octave:0.06, attack:0.025, release:[0.12,0.2], sustain:[0.66,0.78], fenv:[0.15,0.3]}, inserts:{prob:0.4, max:1, pool:[["chorus",{rate:[0.3,0.8], depth:[0.5,0.8], mix:[0.35,0.55]}]]}},   // MUSICALITY balance loop 1 (buried-lead template class): level [0.4,0.52]->[0.52,0.64], the moltenhouse calibration — synth-tuned template lead remapped onto samplers sat buried under a hot bass/pump mix; raising lvl self-trims relative wetness (rev gain = send/lvl). Level is not a verifier feature (matrix unmoved); state fixtures drift for exactly this class.
      pads:{prob:0.9, recipe:{model:["fm"], wave:"sine", cutoff:[900,1500], detune:[0.003,0.008], attack:[0.8,1.8], level:[0.5,0.68], send:[0.35,0.55], dsend:[0.1,0.2]}},
      drums:{kickModel:["808","boom"], snareModel:["crack"], hatModel:["noise"], kick:[1.1,1.3], snare:[0.7,0.95], hat:[0.9,1.2], tune:[1.05,1.2], send:[0.1,0.2], dsend:[0.1,0.25]},
      fx:{reverb:[0.44,0.62], delayBeats:[0.5,0.75], delayFb:[0.25,0.4], delayCut:[2200,3400], pump:[0.04,0.26], crackle:[0.08,0.24], lowcut:[25,40], highcut:[0,0], comp:[0.42,0.64]},
      found:{role:"chops", vol:[0.1,0.18], pitch:[0.95,1.15], stretch:[0.4,0.6], cutoff:[2500,4000], sources:["shibuya","tokyo_station","vx_suspense"]},
      hits:{sources:["pool:vb_domestic_appliance*1","pool:vocal_stab*1","sp_rhythm"], pattern:"sparse", prob:0.4},
      stab:["off"],
      form:"pop" },
    /* /genre-tool:toastercore:genres */
    /* genre-tool:vendingmachinethump:genres */
    vendingmachinethump: { label:"Coin Return Ritual", info:"A bare kick at 119-127. Saw synth bass under a Juno pad, with a jazz guitar. Royal-road changes, a light shuffle.",
      bpm:[119,127],
      swing:[0,0.048],
      humanize:[0.035,0.125],
      progressions:["royal_road","pop_1625","neosoul"],
      kits:["kick","off"],
      fills:["off","downlift"],
      bass:{patterns:["rolling","stab","melodic","syncopated"], patchPool:["SYN-BASS 2"], recipe:{model:["saw","sub","dx7"], cutoff:[380,700], res:[0.15,0.3], level:[1,1.2], send:[0,0.08], dsend:[0,0.05]}},
      lead:{patterns:["composed","composed2","updown","arpup"], patchPool:["E.PIANO 1","E.PIANO 3"], samplerPool:["jazz_guitar","bright_yamaha_grand","alto_sax"], recipe:{model:["dx7","dx7","sampler","sampler"], wave:"sine", voices:[2,4], spread:[0.002,0.005], cutoff:[2800,3800], level:[0.46,0.58], send:[0.25,0.4], dsend:[0.15,0.3], vibrato:[0.003,0.007], attack:0.01, release:[0.12,0.2], sustain:[0.7,0.8], fenv:[0.1,0.25]}, inserts:{prob:0.7, max:1, pool:[["chorus",{rate:[0.5,1], depth:[0.4,0.6], mix:[0.45,0.65]}]]}},
      pads:{prob:1, recipe:{model:["juno60","juno60","juno60","strings","saw"], wave:"saw", cutoff:[1400,2100], detune:[0.004,0.009], attack:[0.5,1.2], chorus:[1,1.4], chorusSpread:[0.8,1], level:[0.45,0.6], send:[0.2,0.35], dsend:[0.05,0.15]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.6,0.85], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.95,1.1], send:[0.1,0.2], dsend:[0,0.05]},
      fx:{reverb:[0.58,0.76], delayBeats:[0.5,0.75], delayFb:[0.2,0.32], delayCut:[2800,4000], pump:[0,0.22], crackle:[0.01,0.17], lowcut:[25,40], highcut:[0,0], comp:[0.15,0.37], grit:[0,0]},
      found:{role:"bed", vol:[0.07,0.13], pitch:[0.9,1], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:city*2","pool:road*1"]},
      hits:{sources:["sp_nightdrive","pool:vocal_stab*1"], pattern:"sparse", prob:0.3},
      stab:["off"],
      form:"pop",
      reverbColor:"dattorro" },
    /* /genre-tool:vendingmachinethump:genres */
    /* genre-tool:boilercreep:genres */
    boilercreep: { label:"Pressure Vessel Psalm", info:"A bare kick at 65-73. Sub bass under a church organ, with a plucked string lead. A min7 house vamp, a light shuffle, one chord every 16 beats.",
      bpm:[65,73],
      swing:[0.038,0.088],
      humanize:[0.201,0.291],
      progressions:["house_min7","lofi","deep_two"],
      kits:["kick","off"],
      fills:["off","downlift"],
      chordEvery:16,
      bass:{patterns:["sub","dub"], recipe:{model:["sub","reese"], cutoff:[260,480], res:[0.05,0.2], level:[1.2,1.45], send:[0,0.05], dsend:[0,0]}, inserts:{prob:0.3, max:1, pool:[["distort",{drive:[0.15,0.35], mix:[0.4,0.7]}]]}},
      lead:{patterns:["arp16"], recipe:{model:["kpluck"], wave:"saw", drive:0.45, cutoff:[3000,3800], level:[0.62,0.74], send:[0.16,0.26], dsend:[0.46,0.56], voices:[1,2]}, inserts:{prob:0.8, max:1, pool:[["chorus",{rate:[0.7,1.1], depth:[0.45,0.65], mix:[0.45,0.6]}]]}},
      pads:{prob:1, samplerPool:["church_organ"], recipe:{model:["organ","organ","sampler"], wave:"saw", cutoff:[1500,2200], detune:[0.004,0.008], attack:[0.3,0.7], level:[0.4,0.52], send:[0.16,0.26], dsend:[0,0.06]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.6,0.85], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.95,1.1], send:[0.1,0.2], dsend:[0,0.05]},
      fx:{reverb:[0.87,1], delayBeats:[0.75,1.5], delayFb:[0.15,0.3], delayCut:[2000,3000], pump:[0,0.14], crackle:[0.05,0.21], lowcut:[0,0], highcut:[0,0], comp:[0.18,0.4]},
      found:{role:"narration", vol:[0.35,0.55], pitch:[0.98,1.05], stretch:[0.9,1.05], cutoff:[2600,3600], sources:["vx_apollo"]},
      hits:{sources:["sp_system","pool:chime*1"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"wave",
      reverbColor:"greyhole" },
    /* /genre-tool:boilercreep:genres */
    /* genre-tool:fluorescentstrut:genres */
    fluorescentstrut: { label:"Argon Catwalk", info:"A pulse kit at 109-117. Saw synth bass under a saw synth pad, with a pluck lead. Phrygian, a light shuffle.",
      bpm:[109,117],
      swing:[0.004,0.054],
      humanize:[0.082,0.172],
      progressions:["mode_phrygian","andalusian","epic_min"],
      kits:["pulse","four"],
      fills:["impact","riser","tom fill","cut"],
      bass:{patterns:["rolling","stab","melodic","syncopated"], patchPool:["SYN-BASS 2"], recipe:{model:["saw","sub","dx7"], cutoff:[380,700], res:[0.15,0.3], level:[1,1.2], send:[0,0.08], dsend:[0,0.05]}},
      lead:{patterns:["off","off","sparse","pentaup"], recipe:{model:["pluck","fm"], wave:"sine", voices:[4,6], spread:[0.002,0.005], cutoff:[1600,2800], level:[0.3,0.42], send:[0.3,0.5], dsend:[0.3,0.5], octave:0, attack:0.003, release:[0.05,0.09], sustain:[0.5,0.62], fenv:[0.5,0.8]}},
      pads:{prob:0.25, recipe:{model:["saw","organ"], wave:"saw", cutoff:[500,850], detune:[0.005,0.012], attack:[2,3.5], level:[0.3,0.42], send:[0.45,0.65], dsend:[0.15,0.3]}},
      drums:{kickModel:["909"], snareModel:["noise","clap"], hatModel:["noise","metal"], kick:[1.3,1.5], snare:[0.95,1.2], hat:[0.5,0.8], tune:[0.9,1.05], send:[0.25,0.4], dsend:[0.05,0.15]},
      fx:{reverb:[0.81,0.99], delayBeats:[0.375,0.5], delayFb:[0.25,0.4], delayCut:[2200,3400], pump:[0.3,0.52], crackle:[0,0.14], lowcut:[30,45], highcut:[0,0], comp:[0.51,0.73], grit:[0.4,0.7], jux:[0.15,0.35]},
      found:{role:"chops", vol:[0.1,0.18], pitch:[0.95,1.15], stretch:[0.4,0.6], cutoff:[2500,4000], sources:["shibuya","tokyo_station","vx_suspense"]},
      hits:{sources:["sp_pressure","pool:rave_stab*1","pool:vocal_stab*1"], pattern:"sparse", prob:0.4},
      stab:["off","sparse"],
      form:"drop",
      transforms:{pool:["stutter","rot"], rate:0.16} },
    /* /genre-tool:fluorescentstrut:genres */
    /* genre-tool:dialtonehaze:genres */
    dialtonehaze: { label:"Busy Signal Limbo", info:"A bare kick at 69-77. Sub bass under a saw synth pad, with a pluck lead. A two-chord minor drone, swung, one chord every 16 beats.",
      bpm:[69,77],
      swing:[0.09,0.14],
      humanize:[0.148,0.238],
      progressions:["drone_min","deep_two","dream"],
      kits:["off","kick"],
      fills:["off","dropout"],
      chordEvery:16,
      bass:{patterns:["pedal","sub","root"], recipe:{model:["sub","saw"], cutoff:[380,650], res:[0.06,0.14], level:[0.6,0.82], send:[0.15,0.35], dsend:[0,0.05]}},
      lead:{patterns:["off","sparse","pentaup"], recipe:{model:["pluck","fm"], wave:"sine", voices:[1,2], spread:[0.002,0.005], cutoff:[1800,2800], level:[0.3,0.42], send:[0.25,0.4], dsend:[0.25,0.4], attack:0.003, release:[0.06,0.1], sustain:[0.5,0.62]}},
      pads:{prob:0.25, recipe:{model:["saw","organ"], wave:"saw", cutoff:[600,1000], detune:[0.005,0.012], attack:[1,2.5], level:[0.3,0.42], send:[0.3,0.45], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.4,0.65], snare:[0.25,0.45], hat:[0.25,0.45], tune:[0.9,1], send:[0.2,0.4], dsend:[0,0.05]},
      fx:{reverb:[0.76,0.94], delayBeats:[0.75,1.5], delayFb:[0.15,0.3], delayCut:[2000,3000], pump:[0,0.14], crackle:[0.22,0.38], lowcut:[0,0], highcut:[0,0], comp:[0.09,0.31]},
      found:{role:"bed", vol:[0.14,0.24], pitch:[0.7,0.9], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:city*1","pool:road*1","pool:voices*1"]},
      hits:{sources:["pool:vb_spoken_poetic*1","sp_system","pool:chime*1"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"wave",
      reverbColor:"greyhole" },
    /* /genre-tool:dialtonehaze:genres */
    /* genre-tool:breadboxmince:genres */
    breadboxmince: { label:"Crouton Taxonomy", info:"A shuffle at 100-108. Saw synth bass under an organ, with a clarinet. Neo-soul changes, swung.",
      bpm:[100,108],
      swing:[0.056,0.106],
      humanize:[0.213,0.303],
      progressions:["neosoul","lofi","minor_run","mode_dorian"],
      kits:["shuffle","four"],
      fills:["off","drum fill","kit fill"],
      bass:{patterns:["rolling","stab","melodic","syncopated"], patchPool:["SYN-BASS 2"], recipe:{model:["saw","sub","dx7"], cutoff:[380,700], res:[0.15,0.3], level:[1,1.2], send:[0,0.08], dsend:[0,0.05]}},
      lead:{patterns:["wander","sparse","pentaup"], samplerPool:["clarinet","flute","vibraphone","celesta"], recipe:{model:["sampler","sampler","sampler","stack","modeld"], wave:"sine", voices:[2,4], spread:[0.001,0.003], cutoff:[2600,3800], level:[0.44,0.56], send:[0.45,0.65], dsend:[0.2,0.35], vibrato:[0.014,0.022], vibRate:[5.5,6.5], attack:0.06, release:[0.3,0.5], sustain:[0.85,0.95], glide:[80,150], envAmount:[0.5,1.2], envDecay:[0.3,0.6], oscMix:[0,0.3], drift:[6,12], drive:[0.05,0.2]}},
      pads:{prob:1, recipe:{model:["organ"], wave:"saw", cutoff:[1000,1600], detune:[0.003,0.008], attack:[1.5,3], level:[0.5,0.65], send:[0.5,0.7], dsend:[0.1,0.2]}, inserts:{prob:0.35, max:1, pool:[["phaser",{rate:[0.05,0.15], depth:[0.4,0.6], mix:[0.3,0.45]}]]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.95,1.2], snare:[0.6,0.85], hat:[0.55,0.85], tune:[0.95,1.1], send:[0.12,0.24], dsend:[0.05,0.15], kit:"acoustic"},
      fx:{reverb:[0.68,0.86], delayBeats:[0.75,1], delayFb:[0.3,0.45], delayCut:[2200,3200], pump:[0.07,0.29], crackle:[0.08,0.24], lowcut:[0,20], highcut:[0,0], comp:[0.22,0.44]},
      found:{role:"bed", vol:[0.18,0.3], pitch:[0.8,0.95], stretch:[0.45,0.6], cutoff:[2400,3800], sources:["pool:voices*2","pool:room*1"]},
      sampleEvents:[{pool:["vx_apollo","vx_wwvh"], placement:"response", sections:"verse|chorus|bridge|hook", prob:0.3, gain:0.4, treatment:{pitch:1, cutoff:1600, rsend:0.5, dsend:0.3}}],
      hits:{sources:["sp_herenow","pool:vocal_stab*1"], pattern:"sparse", prob:0.3},
      stab:["off"],
      form:"pop",
      reverbColor:"dattorro" },
    /* /genre-tool:breadboxmince:genres */
    /* genre-tool:earthmoversplice:genres */
    earthmoversplice: { label:"Overburden Hymn", info:"A tribal kit at 115-123. Acoustic bass under ahh choir, with an alto sax. A descending minor run, a light shuffle, euclidean hats.",
      bpm:[115,123],
      swing:[0.029,0.079],
      humanize:[0.173,0.263],
      progressions:["minor_run","house_min","deep_two"],
      kits:["tribal","breaks"],
      fills:["drum fill","tom fill","off"],
      euclid:{kick:[5,16]},
      bass:{patterns:["dub","simple","sub"], samplerPool:["acoustic_bass"], recipe:{model:["sub","saw","sampler"], cutoff:[300,600], res:[0.05,0.2], level:[1,1.25], send:[0.05,0.12], dsend:[0,0.1]}, inserts:{prob:0.5, max:1, pool:[["distort",{drive:[0.1,0.22], mix:[0.35,0.6]}]]}},
      lead:{patterns:["composed","composed2","arpup","wander"], patchPool:["E.PIANO 1","TUB BELLS","E.PIANO 4","SHIMMER"], samplerPool:["alto_sax","tenor_sax"], recipe:{model:["stack","stack","dx7","sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.003,0.006], cutoff:[2800,4000], level:[0.4,0.52], send:[0.4,0.6], dsend:[0.2,0.4], vibrato:[0.004,0.009], octave:0.2, attack:0.08, release:[0.45,0.6], sustain:[0.85,0.95]}, inserts:{prob:0.5, max:1, pool:[["chorus",{rate:[0.5,1.1], depth:[0.5,0.7], mix:[0.4,0.6]}]]}},
      pads:{prob:1, samplerPool:["ahh_choir","strings"], recipe:{model:["saw","choir","strings","sampler"], wave:"saw", cutoff:[1100,1800], detune:[0.004,0.009], attack:[1.2,2.4], mellotron:true, level:[0.6,0.8], send:[0.5,0.7], dsend:[0.1,0.25]}, inserts:{prob:0.55, max:1, pool:[["chorus",{rate:[0.2,0.5], depth:[0.5,0.75], mix:[0.4,0.6]}]]}},
      drums:{kickModel:["808","boom"], snareModel:["crack"], hatModel:["noise"], kick:[1.1,1.3], snare:[0.7,0.95], hat:[0.9,1.2], tune:[1.05,1.2], send:[0.1,0.2], dsend:[0.1,0.25]},
      fx:{reverb:[0.22,0.4], delayBeats:[0.5,0.75], delayFb:[0.25,0.4], delayCut:[2200,3400], pump:[0,0.21], crackle:[0.12,0.28], lowcut:[25,40], highcut:[2600,3400], comp:[0.12,0.34]},
      found:{role:"break", vol:[0.32,0.45], pitch:[1,1], stretch:[0.5,0.5], cutoff:[6000,9000], sources:["amen_165","amen_170","amen_172","amen_175"]},
      hits:{sources:["pool:vb_transit*1","pool:vocal_stab*1","sp_rhythm"], pattern:"sparse", prob:0.4},
      stab:["off"],
      form:"pop" },
    /* /genre-tool:earthmoversplice:genres */
    /* genre-tool:butterchurnbounce:genres */
    butterchurnbounce: { label:"Buttermilk Cyclotron", info:"A bare kick at 117-125. Acoustic bass under an FM lead pad, with an alto sax. A hijaz maqam, hard swing, loose timing.",
      bpm:[117,125],
      swing:[0.2,0.25],
      humanize:[0.257,0.347],
      progressions:["hijaz","andalusian","minor_run"],
      kits:["off","kick"],
      fills:["off"],
      bass:{patterns:["walking","walking","melodic"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sampler","piano"], cutoff:[500,1000], res:[0.05,0.15], level:[0.9,1.1], send:[0.1,0.2], dsend:[0,0.05], attack:0.005, release:[0.08,0.14]}},
      lead:{patterns:["pentaup","sparse","wander"], patchPool:["E.PIANO 1","E.PIANO 3"], samplerPool:["alto_sax","felt_piano","jazz_guitar"], recipe:{model:["fm","pluck","sampler","sampler","sampler"], wave:"sine", voices:[1,3], spread:[0.002,0.005], cutoff:[1800,2800], level:[0.52,0.64], send:[0.35,0.5], dsend:[0.2,0.35], vibrato:[0.005,0.012], octave:0.06, attack:0.025, release:[0.12,0.2], sustain:[0.66,0.78], fenv:[0.15,0.3]}, inserts:{prob:0.4, max:1, pool:[["chorus",{rate:[0.3,0.8], depth:[0.5,0.8], mix:[0.35,0.55]}]]}},   // MUSICALITY balance loop 1 (buried-lead template class): level [0.4,0.52]->[0.52,0.64], the moltenhouse calibration — synth-tuned template lead remapped onto samplers sat buried under a hot bass/pump mix; raising lvl self-trims relative wetness (rev gain = send/lvl). Level is not a verifier feature (matrix unmoved); state fixtures drift for exactly this class.
      pads:{prob:0.9, recipe:{model:["fm"], wave:"sine", cutoff:[900,1500], detune:[0.003,0.008], attack:[0.8,1.8], level:[0.5,0.68], send:[0.35,0.55], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom","808"], snareModel:["noise"], hatModel:["noise"], kick:[1.3,1.6], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.78,0.9], send:[0.3,0.5], dsend:[0.1,0.3]},
      fx:{reverb:[0.38,0.56], delayBeats:[0.5,0.75], delayFb:[0.1,0.25], delayCut:[2000,3000], pump:[0.06,0.28], crackle:[0.16,0.32], lowcut:[0,30], highcut:[2600,3400], comp:[0.13,0.35]},
      found:{role:"bed", vol:[0.05,0.12], pitch:[0.8,1], stretch:[0.45,0.6], cutoff:[1500,2500], sources:["pool:city*2","vx_whitman"]},
      hits:{sources:["blues_vox_78","blues_vox_78","pool:horn_stab*1"], pattern:"response", prob:0.75},
      stab:["off"],
      form:"pop",
      reverbColor:"fdn",
      timeFeel:{pushPull:{bass:0.015, snare:0.01}} },
    /* /genre-tool:butterchurnbounce:genres */
    /* genre-tool:furnacestrut:genres */
    furnacestrut: { label:"Slag Promenade", info:"A half-time kit at 92-100. Sub bass under ahh choir, with french horns. Epic minor changes, a light shuffle, one chord every 16 beats.",
      bpm:[92,100],
      swing:[0.012,0.062],
      humanize:[0.176,0.266],
      progressions:["epic_min","minor_run","sad_pop","drone_min"],
      kits:["off","halftime","kick"],
      fills:["off","downlift"],
      chordEvery:16,
      bass:{patterns:["sub","dub"], recipe:{model:["sub","reese"], cutoff:[260,480], res:[0.05,0.2], level:[1.2,1.45], send:[0,0.05], dsend:[0,0]}, inserts:{prob:0.3, max:1, pool:[["distort",{drive:[0.15,0.35], mix:[0.4,0.7]}]]}},
      lead:{patterns:["wander","updown","pentaup"], patchPool:["HORNS","BRASSHORNS"], samplerPool:["french_horns"], recipe:{model:["brass","dx7","sampler","sampler"], wave:"sine", voices:[2,4], spread:[0.002,0.005], cutoff:[1500,2600], level:[0.36,0.5], send:[0.55,0.78], dsend:[0.3,0.5], vibrato:[0.004,0.01]}},
      pads:{prob:1, samplerPool:["ahh_choir"], recipe:{model:["vp330","vp330","vp330","choir","strings","sampler"], wave:"saw", cutoff:[700,1300], detune:[0.006,0.014], attack:[2.5,4.5], vowel:[0.4,0.5], ensemble:[0.9,1], mellotron:true, level:[0.62,0.82], send:[0.6,0.82], dsend:[0.15,0.3]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.75,1], snare:[0.5,0.75], hat:[0.6,0.9], tune:[0.9,1.05], send:[0.35,0.5], dsend:[0,0.1]},
      fx:{reverb:[0.87,1], delayBeats:[0.75,1.5], delayFb:[0.15,0.3], delayCut:[2000,3000], pump:[0.07,0.29], crackle:[0,0.12], lowcut:[0,0], highcut:[0,0], comp:[0.21,0.43]},
      found:{role:"bed", vol:[0.3,0.42], pitch:[0.95,1], stretch:[0.45,0.6], cutoff:[3200,4600], sources:["vx_burroughs","vx_ginsberg","vx_waldman","vx_dickinson","leacock1","leacock4","vx_ginsberg_class"]},
      hits:{sources:["pool:vb_industrial_machine*1","sp_system","pool:chime*1"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"wave",
      reverbColor:"greyhole" },
    /* /genre-tool:furnacestrut:genres */
    /* genre-tool:tectonicdash:genres */
    tectonicdash: { label:"Subduction Stampede", info:"A shuffle at 138-146. Sub bass under strings, with a muted trumpet. A min7 house vamp, hard swing.",
      bpm:[138,146],
      swing:[0.236,0.286],
      humanize:[0.183,0.273],
      progressions:["house_min7","funk_vamp","neosoul"],
      kits:["shuffle","boombap","shuffle"],
      fills:["off","drum fill"],
      bass:{patterns:["sub","dub"], recipe:{model:["sub","reese"], cutoff:[260,480], res:[0.05,0.2], level:[1.2,1.45], send:[0,0.05], dsend:[0,0]}, inserts:{prob:0.3, max:1, pool:[["distort",{drive:[0.15,0.35], mix:[0.4,0.7]}]]}},
      lead:{patterns:["sparse","wander","off"], patchPool:["E.PIANO 2"], samplerPool:["muted_trumpet","tenor_sax"], recipe:{model:["fm","dx7","sampler","sampler"], wave:"sine", voices:[1,3], spread:[0.002,0.006], cutoff:[1800,3000], level:[0.4,0.52], send:[0.4,0.6], dsend:[0.3,0.5], vibrato:[0.004,0.01], octave:0.08, attack:0.05, release:[0.3,0.45], sustain:[0.78,0.88], fenv:[0.2,0.4]}},
      pads:{prob:0.85, samplerPool:["strings"], recipe:{model:["fm","strings","sampler"], wave:"sine", cutoff:[800,1400], detune:[0.004,0.01], attack:[1,2.5], level:[0.5,0.68], send:[0.45,0.65], dsend:[0.15,0.3]}, inserts:{prob:0.35, max:1, pool:[["phaser",{rate:[0.06,0.18], depth:[0.4,0.6], mix:[0.3,0.5]}]]}},
      drums:{kickModel:["boom","808"], snareModel:["noise"], hatModel:["noise"], kick:[0.9,1.15], snare:[0.5,0.7], hat:[0.5,0.8], tune:[0.85,1], send:[0.15,0.3], dsend:[0,0.1], kit:"acoustic"},
      fx:{reverb:[0.51,0.69], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[2600,3800], pump:[0,0.2], crackle:[0.2,0.36], lowcut:[30,45], highcut:[0,0], comp:[0.2,0.42]},
      found:{role:"bed", vol:[0.18,0.3], pitch:[0.8,0.95], stretch:[0.45,0.6], cutoff:[2400,3800], sources:["pool:voices*2","pool:room*1"]},
      hits:{sources:["pool:vocal_stab*1","sp_rhythm","pool:rave_stab*1"], pattern:"offbeat", prob:0.6},
      stab:["off","sparse"],
      form:"pop" },
    /* /genre-tool:tectonicdash:genres */
    /* genre-tool:tundradoom:genres */
    tundradoom: { label:"Permafrost Choir", info:"A shuffle at 51-59. Saw synth bass under an FM lead pad, with an alto sax. Doo-wop changes, a light shuffle, rubato.",
      bpm:[51,59],
      swing:[0.023,0.073],
      humanize:[0.181,0.271],
      progressions:["doo_wop","canon","royal_road"],
      kits:["off","shuffle"],
      fills:["off","micro lick"],
      chordEvery:8,
      bass:{patterns:["rolling","stab","melodic","syncopated"], patchPool:["SYN-BASS 2"], recipe:{model:["saw","sub","dx7"], cutoff:[380,700], res:[0.15,0.3], level:[1,1.2], send:[0,0.08], dsend:[0,0.05]}},
      lead:{patterns:["pentaup","sparse","wander"], patchPool:["E.PIANO 1","E.PIANO 3"], samplerPool:["alto_sax","felt_piano","jazz_guitar"], recipe:{model:["fm","pluck","sampler","sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.002,0.005], cutoff:[1800,2800], level:[0.52,0.64], send:[0.35,0.5], dsend:[0.2,0.35], vibrato:[0.005,0.012], octave:0.06, attack:0.025, release:[0.12,0.2], sustain:[0.66,0.78], fenv:[0.15,0.3]}, inserts:{prob:0.4, max:1, pool:[["chorus",{rate:[0.3,0.8], depth:[0.5,0.8], mix:[0.35,0.55]}]]}},   // MUSICALITY balance loop 1 (buried-lead template class): level [0.4,0.52]->[0.52,0.64], the moltenhouse calibration — synth-tuned template lead remapped onto samplers sat buried under a hot bass/pump mix; raising lvl self-trims relative wetness (rev gain = send/lvl). Level is not a verifier feature (matrix unmoved); state fixtures drift for exactly this class.
      pads:{prob:0.9, recipe:{model:["fm"], wave:"sine", cutoff:[900,1500], detune:[0.003,0.008], attack:[0.8,1.8], level:[0.5,0.68], send:[0.35,0.55], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom"], snareModel:["noise","clap"], hatModel:["noise"], kick:[0.5,0.75], snare:[0.35,0.55], hat:[0.3,0.5], tune:[0.9,1.02], send:[0.2,0.4], dsend:[0,0.1]},
      fx:{reverb:[0.87,1], delayBeats:[0.5,0.75], delayFb:[0.15,0.3], delayCut:[2400,3400], pump:[0,0.12], crackle:[0.04,0.2], lowcut:[0,0], highcut:[0,0], comp:[0.03,0.25]},
      found:{role:"bed", vol:[0.05,0.12], pitch:[0.9,1.05], stretch:[0.4,0.6], cutoff:[2000,3200], sources:["pool:city*2"]},
      rubato:{depth:[0.008,0.02], periodBars:[3,5], prob:1},
      sampleEvents:[{pool:["sp_system","sp_herenow"], placement:"cadence", sections:"all", treatment:{cutoff:3000, vol:0.42}}],
      hits:{sources:["pool:vb_maritime_weather*1","sp_system","sp_herenow","sp_slowdown"], pattern:"sparse", prob:0.35},
      stab:["off"],
      form:"storm",
      reverbColor:"spring" },
    /* /genre-tool:tundradoom:genres */
    /* genre-tool:sodabop:genres */
    sodabop: { label:"Fizz Quorum", info:"A bare kick at 88-96. Acid bass under an organ, with a steel string guitar. A funk vamp, a light shuffle.",
      bpm:[88,96],
      swing:[0,0.048],
      humanize:[0.063,0.153],
      progressions:["funk_vamp","house_min7","pop_1625"],
      kits:["kick","off"],
      fills:["off","downlift"],
      bass:{patterns:["stab","rolling","drive","syncopated"], recipe:{model:["acid"], cutoff:[420,700], res:[0.3,0.45], level:[1.1,1.3], send:[0,0.08], dsend:[0,0.1]}, inserts:{prob:0.6, max:2, pool:[["distort",{drive:[0.3,0.6], mix:[0.6,0.9]}],["filtersweep",{rateBars:[2,4], lo:[-0.8,-0.3], hi:[0.8,1.4], res:[0.35,0.5]}]]}},
      lead:{patterns:["double","updown","hero"], samplerPool:["steel_string_guitar","jazz_guitar"], recipe:{model:["sampler","sampler","sampler","guitar"], wave:"saw", voices:[1,3], spread:[0.001,0.004], cutoff:[3000,4200], level:[0.52,0.64], send:[0.3,0.45], dsend:[0.1,0.2], vibrato:[0.006,0.012], vibRate:[6,7.5]}, inserts:{prob:0.5, max:1, pool:[["tremolo",{rate:[4,7], depth:[0.5,0.7], shape:[0.2,0.5], wobble:[0,0], mix:[0.6,0.85]}]]}},
      pads:{prob:0.4, recipe:{model:["organ"], wave:"saw", cutoff:[1200,1800], detune:[0.003,0.008], attack:[0.1,0.4], level:[0.36,0.48], send:[0.2,0.35], dsend:[0.05,0.12]}, inserts:{prob:0.6, max:1, pool:[["tremolo",{rate:[4,6], depth:[0.4,0.6], shape:[0.2,0.4], wobble:[0,0], mix:[0.5,0.75]}]]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.6,0.85], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.95,1.1], send:[0.1,0.2], dsend:[0,0.05]},
      fx:{reverb:[0.41,0.59], delayBeats:[0.375,0.5], delayFb:[0.15,0.3], delayCut:[2600,3800], pump:[0,0.21], crackle:[0,0.14], lowcut:[30,45], highcut:[0,0], comp:[0.17,0.39], grit:[0,0]},
      found:{role:"bed", vol:[0.06,0.12], pitch:[0.85,1], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:city*2","pool:voices*1"]},
      hits:{sources:["pool:vb_jazz_blues*1","pool:horn_stab*1","sp_rhythm","pool:vocal_stab*1"], pattern:"offbeat", prob:0.5},
      stab:["off","sparse"],
      form:"vamp",
      reverbColor:"dattorro",
      masterComp:0.35 },
    /* /genre-tool:sodabop:genres */
    /* genre-tool:citrushaze:genres */
    citrushaze: { label:"Grapefruit Ionosphere", info:"A bare kick at 84-92. Sub bass under a saw synth pad, with a pluck lead. A two-chord minor drone, a light shuffle, one chord every 16 beats.",
      bpm:[84,92],
      swing:[0.012,0.062],
      humanize:[0.105,0.195],
      progressions:["drone_min","deep_two","dream"],
      kits:["off","kick"],
      fills:["off","dropout"],
      chordEvery:16,
      bass:{patterns:["pedal","sub","root"], recipe:{model:["sub","saw"], cutoff:[380,650], res:[0.06,0.14], level:[0.6,0.82], send:[0.15,0.35], dsend:[0,0.05]}},
      lead:{patterns:["off","off","sparse","pentaup"], recipe:{model:["pluck","fm"], wave:"sine", voices:[1,3], spread:[0.002,0.005], cutoff:[1600,2800], level:[0.3,0.42], send:[0.3,0.5], dsend:[0.3,0.5], octave:0, attack:0.003, release:[0.05,0.09], sustain:[0.5,0.62], fenv:[0.5,0.8]}},
      pads:{prob:0.25, recipe:{model:["saw","organ"], wave:"saw", cutoff:[500,850], detune:[0.005,0.012], attack:[2,3.5], level:[0.3,0.42], send:[0.45,0.65], dsend:[0.15,0.3]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.4,0.65], snare:[0.25,0.45], hat:[0.25,0.45], tune:[0.9,1], send:[0.2,0.4], dsend:[0,0.05]},
      fx:{reverb:[0.6,0.78], delayBeats:[0.75,1.5], delayFb:[0.15,0.3], delayCut:[2000,3000], pump:[0,0.18], crackle:[0.06,0.22], lowcut:[0,0], highcut:[0,0], comp:[0,0.22]},
      found:{role:"bed", vol:[0.18,0.3], pitch:[0.8,0.95], stretch:[0.45,0.6], cutoff:[2400,3800], sources:["pool:voices*2","pool:room*1"]},
      hits:{sources:["sp_system","pool:chime*1"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"wave",
      reverbColor:"greyhole" },
    /* /genre-tool:citrushaze:genres */
    /* genre-tool:confettililt:genres */
    confettililt: { label:"Ticker Tape Seance", info:"A bossa kit at 88-96. Acoustic bass under a string machine pad, with a nylon string guitar. A descending minor run, swung, loose timing.",
      bpm:[88,96],
      swing:[0.144,0.194],
      humanize:[0.278,0.368],
      progressions:["minor_run","drone_min","house_min"],
      kits:["bossa","shuffle"],
      fills:["micro lick","off"],
      bass:{patterns:["walking","root","melodic"], recipe:{model:["sampler","sub"], samplerPool:["acoustic_bass","fretless_bass"], cutoff:[600,1000], level:[0.55,0.72], send:[0.2,0.35], dsend:[0,0.08]}},
      lead:{patterns:["composed","sparse","wander"], recipe:{model:["sampler","dx7"], samplerPool:["nylon_string_guitar","jazz_guitar"], patchPool:["CLAS.GUIT"], wave:"sine", voices:[1,2], cutoff:[2400,3400], level:[0.42,0.55], send:[0.3,0.5], dsend:[0.1,0.25]}},
      pads:{prob:0.55, recipe:{model:["solina","rhodes","vp330"], wave:"saw", cutoff:[900,1500], detune:[0.004,0.01], attack:[1,2.5], level:[0.4,0.55], send:[0.4,0.6], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom"], snareModel:["noise","crack"], hatModel:["noise"], kick:[0.5,0.72], snare:[0.35,0.55], hat:[0.4,0.6], tune:[0.9,1.02], send:[0.2,0.4], dsend:[0,0.1]},
      fx:{reverb:[0.64,0.82], delayBeats:[0.5,0.9], delayFb:[0.12,0.28], delayCut:[2200,3200], pump:[0,0.12], crackle:[0.04,0.2], lowcut:[0,0], highcut:[0,0], comp:[0.26,0.48]},
      found:{role:"bed", vol:[0.18,0.3], pitch:[0.8,0.95], stretch:[0.45,0.6], cutoff:[2400,3800], sources:["pool:voices*2","pool:room*1"]},
      hits:{sources:["pool:chime*1"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"pop",
      reverbColor:"spring" },
    /* /genre-tool:confettililt:genres */
    /* genre-tool:willowmarch:genres */
    willowmarch: { label:"Catkin Procession", info:"A shuffle at 117-125. Saw synth bass under an FM lead pad, with an alto sax. Neo-soul changes, hard swing.",
      bpm:[117,125],
      swing:[0.159,0.209],
      humanize:[0.226,0.316],
      progressions:["neosoul","lofi","minor_run","mode_dorian"],
      kits:["shuffle","four"],
      fills:["off","drum fill","kit fill"],
      bass:{patterns:["rolling","stab","melodic","syncopated"], patchPool:["SYN-BASS 2"], recipe:{model:["saw","sub","dx7"], cutoff:[380,700], res:[0.15,0.3], level:[1,1.2], send:[0,0.08], dsend:[0,0.05]}},
      lead:{patterns:["pentaup","sparse","wander"], patchPool:["E.PIANO 1","E.PIANO 3"], samplerPool:["alto_sax","felt_piano","jazz_guitar"], recipe:{model:["fm","pluck","sampler","sampler","sampler"], wave:"sine", voices:[3,5], spread:[0.002,0.005], cutoff:[1800,2800], level:[0.52,0.64], send:[0.35,0.5], dsend:[0.2,0.35], vibrato:[0.005,0.012], octave:0.06, attack:0.025, release:[0.12,0.2], sustain:[0.66,0.78], fenv:[0.15,0.3]}, inserts:{prob:0.4, max:1, pool:[["chorus",{rate:[0.3,0.8], depth:[0.5,0.8], mix:[0.35,0.55]}]]}},   // MUSICALITY balance loop 1 (buried-lead template class): level [0.4,0.52]->[0.52,0.64], the moltenhouse calibration — synth-tuned template lead remapped onto samplers sat buried under a hot bass/pump mix; raising lvl self-trims relative wetness (rev gain = send/lvl). Level is not a verifier feature (matrix unmoved); state fixtures drift for exactly this class.
      pads:{prob:0.9, recipe:{model:["fm"], wave:"sine", cutoff:[900,1500], detune:[0.003,0.008], attack:[0.8,1.8], level:[0.5,0.68], send:[0.35,0.55], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.95,1.2], snare:[0.6,0.85], hat:[0.55,0.85], tune:[0.95,1.1], send:[0.12,0.24], dsend:[0.05,0.15], kit:"acoustic"},
      fx:{reverb:[0.79,0.97], delayBeats:[0.75,1], delayFb:[0.3,0.45], delayCut:[2200,3200], pump:[0.15,0.37], crackle:[0.12,0.28], lowcut:[0,20], highcut:[0,0], comp:[0.31,0.53]},
      found:{role:"chops", vol:[0.1,0.18], pitch:[0.95,1.15], stretch:[0.4,0.6], cutoff:[2500,4000], sources:["shibuya","tokyo_station","vx_suspense"]},
      sampleEvents:[{pool:["vx_apollo","vx_wwvh"], placement:"response", sections:"verse|chorus|bridge|hook", prob:0.3, gain:0.4, treatment:{pitch:1, cutoff:1600, rsend:0.5, dsend:0.3}}],
      hits:{sources:["pool:vb_folk_pastoral*1","sp_herenow","pool:vocal_stab*1"], pattern:"sparse", prob:0.3},
      stab:["off"],
      form:"pop",
      reverbColor:"dattorro" },
    /* /genre-tool:willowmarch:genres */
    /* genre-tool:standbylightdrive:genres */
    standbylightdrive: { label:"Diode Vigil", info:"Beatless at 130-138. Acid bass under a saw synth pad, with a pluck lead. A descending minor run, a light shuffle.",
      bpm:[130,138],
      swing:[0,0.047],
      humanize:[0.029,0.119],
      progressions:["minor_run","epic_min","sad_pop","four_chords"],
      kits:["off"],
      fills:["off"],
      bass:{patterns:["stab","rolling","drive","syncopated"], recipe:{model:["acid"], cutoff:[420,700], res:[0.3,0.45], level:[1.1,1.3], send:[0,0.08], dsend:[0,0.1]}, inserts:{prob:0.6, max:2, pool:[["distort",{drive:[0.3,0.6], mix:[0.6,0.9]}],["filtersweep",{rateBars:[2,4], lo:[-0.8,-0.3], hi:[0.8,1.4], res:[0.35,0.5]}]]}},
      lead:{patterns:["off","sparse","pentaup"], recipe:{model:["pluck","fm"], wave:"sine", voices:[3,5], spread:[0.002,0.005], cutoff:[1800,2800], level:[0.5,0.62], send:[0.25,0.4], dsend:[0.25,0.4], attack:0.003, release:[0.06,0.1], sustain:[0.5,0.62]}},   // BURIED LEAD: the steel guitar was unhearable. level [0.3,0.42]->[0.5,0.62]. The range was tuned for the hot lead_pluck/fm SYNTHS, but sampled-default remaps this lead onto the guitar-family multisamples, whose dry lane then sat ~7dB under the pad-drone mix while its sends (send/lvl ~1.0-1.5x) drowned it in wash. [0.5,0.62] matches the calibrated explicit steel-lead genres (surfrock/desertblues) and self-trims relative wetness (rev gain = send/lvl). Measured (seed 5, neutral-master stem): dry steel lane RMS -41.7 -> -37.5 dB against a -34 dB mix, wet/dry gap 4.9 -> 2.7 dB; matrix unmoved (level is not a verifier feature).
      pads:{prob:0.25, recipe:{model:["saw","organ"], wave:"saw", cutoff:[600,1000], detune:[0.005,0.012], attack:[1,2.5], level:[0.3,0.42], send:[0.3,0.45], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.5,0.7], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.9,1], send:[0.15,0.35], dsend:[0,0]},
      fx:{reverb:[0.2,0.38], delayBeats:[0.5,1], delayFb:[0.1,0.24], delayCut:[2200,3200], pump:[0.44,0.66], crackle:[0,0.14], lowcut:[0,0], highcut:[0,0], comp:[0.33,0.55]},
      found:{role:"bed", vol:[0.14,0.24], pitch:[0.7,0.9], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:city*1","pool:road*1","pool:voices*1"]},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.05},
      stab:["off"],
      form:"wave",
      reverbColor:"fdn" },
    /* /genre-tool:standbylightdrive:genres */
    /* genre-tool:cairntrot:genres */
    cairntrot: { label:"Barrow Ledger", info:"A bare kick at 105-113. Acoustic bass under ahh choir, with an alto sax. Four-chord changes, swung.",
      bpm:[105,113],
      swing:[0.087,0.137],
      humanize:[0.111,0.201],
      progressions:["four_chords","uplift","pop_1625","doo_wop"],
      kits:["kick","off"],
      fills:["off","downlift"],
      bass:{patterns:["walking","melodic","dub"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sampler","piano"], cutoff:[400,800], res:[0.05,0.12], level:[0.95,1.15], send:[0.1,0.2], dsend:[0,0.05], attack:0.005, release:[0.08,0.14]}},
      lead:{patterns:["composed","composed2","arpup","wander"], patchPool:["E.PIANO 1","TUB BELLS","E.PIANO 4","SHIMMER"], samplerPool:["alto_sax","tenor_sax"], recipe:{model:["stack","stack","dx7","sampler","sampler"], wave:"sine", voices:[3,5], spread:[0.003,0.006], cutoff:[2800,4000], level:[0.4,0.52], send:[0.4,0.6], dsend:[0.2,0.4], vibrato:[0.004,0.009], octave:0.2, attack:0.08, release:[0.45,0.6], sustain:[0.85,0.95]}, inserts:{prob:0.5, max:1, pool:[["chorus",{rate:[0.5,1.1], depth:[0.5,0.7], mix:[0.4,0.6]}]]}},
      pads:{prob:1, samplerPool:["ahh_choir","strings"], recipe:{model:["saw","choir","strings","sampler"], wave:"saw", cutoff:[1100,1800], detune:[0.004,0.009], attack:[1.2,2.4], mellotron:true, level:[0.6,0.8], send:[0.5,0.7], dsend:[0.1,0.25]}, inserts:{prob:0.55, max:1, pool:[["chorus",{rate:[0.2,0.5], depth:[0.5,0.75], mix:[0.4,0.6]}]]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.6,0.85], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.95,1.1], send:[0.1,0.2], dsend:[0,0.05]},
      fx:{reverb:[0.77,0.95], delayBeats:[0.5,0.75], delayFb:[0.2,0.32], delayCut:[2800,4000], pump:[0.26,0.48], crackle:[0,0.1], lowcut:[25,40], highcut:[0,0], comp:[0.3,0.52], grit:[0,0]},
      found:{role:"bed", vol:[0.07,0.13], pitch:[0.9,1], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:city*2","pool:road*1"]},
      hits:{sources:["sp_nightdrive","pool:vocal_stab*1"], pattern:"sparse", prob:0.3},
      stab:["off"],
      form:"pop",
      reverbColor:"dattorro" },
    /* /genre-tool:cairntrot:genres */
    /* genre-tool:dumptruckdub:genres */
    dumptruckdub: { label:"Gross Tonnage Dub", info:"A boom-bap kit at 82-90. Acoustic bass under strings, with a muted trumpet. Neo-soul changes, a light shuffle.",
      bpm:[82,90],
      swing:[0.035,0.085],
      humanize:[0.066,0.156],
      progressions:["neosoul","dream","deep_two","mode_mixo"],
      kits:["boombap","halftime","kick"],
      fills:["off","downlift","riser"],
      bass:{patterns:["simple","dub","sub"], samplerPool:["acoustic_bass"], recipe:{model:["sub","sub","sampler"], cutoff:[300,550], res:[0.05,0.15], level:[0.95,1.15], send:[0.05,0.12], dsend:[0,0.05]}, inserts:{prob:0.45, max:1, pool:[["distort",{drive:[0.09,0.18], mix:[0.3,0.5]}]]}},
      lead:{patterns:["sparse","wander","off"], patchPool:["E.PIANO 2"], samplerPool:["muted_trumpet","tenor_sax"], recipe:{model:["fm","dx7","sampler","sampler"], wave:"sine", voices:[1,3], spread:[0.002,0.006], cutoff:[1800,3000], level:[0.4,0.52], send:[0.4,0.6], dsend:[0.3,0.5], vibrato:[0.004,0.01], octave:0.08, attack:0.05, release:[0.3,0.45], sustain:[0.78,0.88], fenv:[0.2,0.4]}},
      pads:{prob:0.85, samplerPool:["strings"], recipe:{model:["fm","strings","sampler"], wave:"sine", cutoff:[800,1400], detune:[0.004,0.01], attack:[1,2.5], level:[0.5,0.68], send:[0.45,0.65], dsend:[0.15,0.3]}, inserts:{prob:0.35, max:1, pool:[["phaser",{rate:[0.06,0.18], depth:[0.4,0.6], mix:[0.3,0.5]}]]}},
      drums:{kickModel:["808","boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.95,1.2], snare:[0.5,0.75], hat:[0.45,0.75], tune:[0.85,1], send:[0.2,0.35], dsend:[0.05,0.2]},
      fx:{reverb:[0.87,1], delayBeats:[0.75,1.5], delayFb:[0.3,0.5], delayCut:[1800,2800], pump:[0,0.2], crackle:[0.07,0.23], lowcut:[0,25], highcut:[2600,3400], comp:[0.07,0.29]},
      found:{role:"bed", vol:[0.05,0.12], pitch:[0.8,1], stretch:[0.45,0.6], cutoff:[1500,2500], sources:["pool:city*2","vx_whitman"]},
      snarePP:0.66,
      hits:{sources:["pool:vb_transit*1","pool:vocal_stab*1","sp_herenow"], pattern:"sparse", prob:0.2},
      stab:["off"],
      form:"pop",
      timeFeel:{pushPull:{bass:0.011, hat:-0.007}} },
    /* /genre-tool:dumptruckdub:genres */
    /* genre-tool:tallowtrot:genres */
    tallowtrot: { label:"Tallow Bureau", info:"A pulse kit at 112-120. Acid bass under a vocoder choir pad, with a trumpet. A descending minor run, a light shuffle.",
      bpm:[112,120],
      swing:[0.012,0.062],
      humanize:[0.08,0.17],
      progressions:["minor_run","house_min","deep_two"],
      kits:["pulse","four"],
      fills:["riser","tom fill","downlift"],
      bass:{patterns:["rolling","stab","sixteenths","pedal"], recipe:{model:["acid","saw","reese"], cutoff:[450,800], res:[0.2,0.35], level:[1,1.2], send:[0,0.08], dsend:[0,0.1]}, inserts:{prob:0.45, max:2, pool:[["filtersweep",{rateBars:[2,4], lo:[-1.2,-0.6], hi:[0.8,1.4], res:[0.25,0.45]}],["distort",{drive:[0.15,0.35], mix:[0.5,0.8]}]]}},
      lead:{patterns:["arpup","hero","wander","updown"], patchPool:["BRASS   2","BRASS   1","SYNBRASS 1"], samplerPool:["trumpet","trombone","french_horns"], recipe:{model:["vocoder","vocoder","stack","dx7","sampler"], wave:"saw", voices:[2,4], spread:[0.004,0.009], cutoff:[2400,3400], level:[0.6,0.72], send:[0.35,0.5], dsend:[0.25,0.4], vibrato:[0,0.004]}, inserts:{prob:0.35, max:1, pool:[["chorus",{rate:[0.4,0.9], depth:[0.4,0.6], mix:[0.35,0.5]}]]}},
      pads:{prob:1, recipe:{model:["vp330","oberheim","solina","choir","choir","strings"], wave:"saw", cutoff:[900,1500], detune:[0.005,0.011], attack:[1.5,3], vowel:[0.25,0.4], ensemble:[0.55,0.7], octave:[0.5,0.6], filterMode:[0,0.15], envAmount:[1,1.6], level:[0.55,0.75], send:[0.5,0.65], dsend:[0.1,0.2]}, inserts:{prob:0.5, max:1, pool:[["phaser",{rate:[0.08,0.2], depth:[0.5,0.7], mix:[0.35,0.55]}]]}},
      drums:{kickModel:["boom","909"], snareModel:["noise","clap"], hatModel:["noise"], kick:[1.1,1.3], snare:[0.7,0.95], hat:[0.6,0.9], tune:[0.9,1.05], send:[0.2,0.35], dsend:[0.05,0.15]},
      fx:{reverb:[0.72,0.9], delayBeats:[0.5,0.75], delayFb:[0.25,0.4], delayCut:[2000,3000], pump:[0.11,0.33], crackle:[0.12,0.28], lowcut:[140,220], highcut:[2600,3400], comp:[0.37,0.59], grit:[0,0.15]},
      found:{role:"break", vol:[0.32,0.45], pitch:[1,1], stretch:[0.5,0.5], cutoff:[6000,9000], sources:["amen_165","amen_170","amen_172","amen_175"]},
      vocSource:"vx_sv_speech",
      hits:{sources:["vx_sv_march","vx_sv_radio"], pattern:"sparse", prob:0.5},
      stab:["off","sparse"],
      form:"pop" },
    /* /genre-tool:tallowtrot:genres */
    /* genre-tool:fathomarch:genres */
    fathomarch: { label:"Benthic Parade", info:"A trap kit at 131-139. Sub bass under a saw synth pad, with a pluck lead. A funk vamp, a light shuffle.",
      bpm:[131,139],
      swing:[0.02,0.07],
      humanize:[0.162,0.252],
      progressions:["funk_vamp","mode_phrygian","andalusian"],
      kits:["trap","electro"],
      fills:["hat rush","cut","impact"],
      bass:{patterns:["sub","stab","dub"], recipe:{model:["sub"], cutoff:[250,420], res:[0.05,0.15], level:[1.3,1.5], send:[0,0.05], dsend:[0,0.05]}},
      lead:{patterns:["double","arpup","sparse"], recipe:{model:["pluck","fm"], wave:"square", voices:[1,3], spread:[0.002,0.005], cutoff:[2600,3600], level:[0.4,0.52], send:[0.15,0.3], dsend:[0.15,0.3], attack:0.003, release:[0.05,0.09], sustain:[0.5,0.62], fenv:[0.4,0.7]}},
      pads:{prob:0.35, recipe:{model:["saw"], wave:"saw", cutoff:[900,1400], detune:[0.004,0.009], attack:[0.2,0.6], level:[0.32,0.44], send:[0.15,0.3], dsend:[0.05,0.15]}},
      drums:{kickModel:["808"], snareModel:["clap","crack"], hatModel:["noise","metal"], kick:[1.35,1.6], snare:[0.75,1], hat:[0.9,1.2], tune:[1,1.15], send:[0.05,0.12], dsend:[0.05,0.15]},
      fx:{reverb:[0.54,0.72], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[2800,4000], pump:[0.03,0.25], crackle:[0.13,0.29], lowcut:[25,38], highcut:[0,0], comp:[0.19,0.41], grit:[0.1,0.25], jux:[0.1,0.3]},
      found:{role:"bed", vol:[0.06,0.12], pitch:[0.9,1.05], stretch:[0.45,0.6], cutoff:[1800,3000], sources:["pool:road*1","pool:city*1"]},
      hits:{sources:["pool:vb_maritime_weather*1","pool:vocal_stab*2","sp_energy"], pattern:"offbeat", prob:0.7},
      stab:["offbeat","sparse"],
      form:"pop" },
    /* /genre-tool:fathomarch:genres */
    /* genre-tool:masonshuffle:genres */
    masonshuffle: { label:"Mortar Assignation", info:"A bare kick at 95-103. Acoustic bass under pizzicato strings, with a bandoneon. An andalusian cadence, hard swing, loose timing, rubato.",
      bpm:[95,103],
      swing:[0.155,0.205],
      humanize:[0.235,0.325],
      progressions:["andalusian","andalusian","minor_run"],
      kits:["kick","off"],
      fills:["off","downlift"],
      bass:{patterns:["habanera"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sampler","piano"], cutoff:[700,1200], res:[0.05,0.12], level:[1,1.2], send:[0.06,0.12], dsend:[0,0.05]}},
      lead:{patterns:["canon","wander","sparse"], samplerPool:["bandoneon","bandoneon","nylon_string_guitar"], recipe:{model:["sampler"], wave:"sine", voices:[1,3], spread:[0.001,0.003], cutoff:[2600,3800], level:[0.55,0.68], send:[0.22,0.34], dsend:[0.02,0.08], attack:0.006, release:[0.06,0.11], sustain:[0.5,0.62]}},
      pads:{prob:0.3, samplerPool:["pizzicato_strings","strings","nylon_string_guitar"], recipe:{model:["sampler","strings"], wave:"saw", cutoff:[1100,1700], detune:[0.003,0.008], attack:[0.1,0.3], level:[0.28,0.38], send:[0.18,0.3], dsend:[0.03,0.1]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.6,0.85], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.95,1.1], send:[0.1,0.2], dsend:[0,0.05]},
      fx:{reverb:[0.5,0.68], delayBeats:[0.5,0.75], delayFb:[0.08,0.16], delayCut:[2200,3200], pump:[0,0.12], crackle:[0.11,0.27], lowcut:[0,25], highcut:[0,0], comp:[0.02,0.24]},
      found:{role:"bed", vol:[0.06,0.12], pitch:[0.8,0.95], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["vx_suspense","pool:city*1"]},
      rubato:{depth:[0.008,0.02], periodBars:[3,5], prob:1},
      hits:{sources:["pool:horn_stab*1","blues_vox_78"], pattern:"sparse", prob:0.35},
      stab:["off"],
      form:"pop",
      reverbColor:"fdn",
      transforms:{pool:["rest"], rate:0.05} },
    /* /genre-tool:masonshuffle:genres */
    /* genre-tool:boilerroomstomp:genres */
    boilerroomstomp: { label:"Gasket Inquisition", info:"A pulse kit at 124-132. Reese bass under ahh choir, with an alto sax. A descending minor run, a light shuffle.",
      bpm:[124,132],
      swing:[0,0.049],
      humanize:[0.105,0.195],
      progressions:["minor_run","house_min","deep_two"],
      kits:["pulse","techno"],
      fills:["cut","impact","hat rush","stutter"],
      bass:{patterns:["sixteenths","stab","drive","pedal"], recipe:{model:["reese","acid"], cutoff:[350,560], res:[0.2,0.35], level:[1.2,1.4], send:[0,0.06], dsend:[0,0.08], release:[0.05,0.09], fenv:[0.5,0.9]}, inserts:{prob:0.7, max:1, pool:[["distort",{drive:[0.35,0.65], mix:[0.7,1]}]]}},
      lead:{patterns:["composed","composed2","arpup","wander"], patchPool:["E.PIANO 1","TUB BELLS","E.PIANO 4","SHIMMER"], samplerPool:["alto_sax","tenor_sax"], recipe:{model:["stack","stack","dx7","sampler","sampler"], wave:"sine", voices:[2,4], spread:[0.003,0.006], cutoff:[2800,4000], level:[0.4,0.52], send:[0.4,0.6], dsend:[0.2,0.4], vibrato:[0.004,0.009], octave:0.2, attack:0.08, release:[0.45,0.6], sustain:[0.85,0.95]}, inserts:{prob:0.5, max:1, pool:[["chorus",{rate:[0.5,1.1], depth:[0.5,0.7], mix:[0.4,0.6]}]]}},
      pads:{prob:1, samplerPool:["ahh_choir","strings"], recipe:{model:["saw","choir","strings","sampler"], wave:"saw", cutoff:[1100,1800], detune:[0.004,0.009], attack:[1.2,2.4], mellotron:true, level:[0.6,0.8], send:[0.5,0.7], dsend:[0.1,0.25]}, inserts:{prob:0.55, max:1, pool:[["chorus",{rate:[0.2,0.5], depth:[0.5,0.75], mix:[0.4,0.6]}]]}},
      drums:{kickModel:["909"], snareModel:["clap","crack"], hatModel:["metal"], kick:[1.3,1.5], snare:[0.85,1.1], hat:[0.7,1], tune:[0.9,1.05], send:[0.05,0.12], dsend:[0.1,0.25]},
      fx:{reverb:[0.71,0.89], delayBeats:[0.5,0.5], delayFb:[0.25,0.4], delayCut:[2200,3400], pump:[0.16,0.38], crackle:[0,0.15], lowcut:[30,45], highcut:[2600,3400], comp:[0.48,0.7], grit:[0.4,0.7], jux:[0.15,0.35]},
      found:{role:"bed", vol:[0.18,0.3], pitch:[0.8,0.95], stretch:[0.45,0.6], cutoff:[2400,3800], sources:["pool:voices*2","pool:room*1"]},
      vocSource:"sp_pressure",
      hits:{sources:["pool:vb_industrial_machine*1","sp_pressure","sp_system","pool:rave_stab*1"], pattern:"dub", prob:0.6},
      stab:["offbeat","sparse"],
      form:"dj" },
    /* /genre-tool:boilerroomstomp:genres */
    /* genre-tool:brinedub:genres */
    brinedub: { label:"Saltwater Reliquary", info:"A bare kick at 81-89. Acid bass under an organ, with a pluck lead. A descending minor run, straight time.",
      bpm:[81,89],
      swing:[0,0.014],
      humanize:[0.075,0.165],
      progressions:["minor_run","epic_min","sad_pop","four_chords"],
      kits:["kick","off"],
      fills:["off","downlift"],
      bass:{patterns:["stab","rolling","drive","syncopated"], recipe:{model:["acid"], cutoff:[420,700], res:[0.3,0.45], level:[1.1,1.3], send:[0,0.08], dsend:[0,0.1]}, inserts:{prob:0.6, max:2, pool:[["distort",{drive:[0.3,0.6], mix:[0.6,0.9]}],["filtersweep",{rateBars:[2,4], lo:[-0.8,-0.3], hi:[0.8,1.4], res:[0.35,0.5]}]]}},
      lead:{patterns:["double","double","arpup","off"], recipe:{model:["pluck","stack"], wave:"square", voices:[1,2], spread:[0.002,0.006], cutoff:[1500,2600], level:[0.3,0.42], send:[0.15,0.3], dsend:[0.2,0.4], vibrato:[0,0.002], octave:0, attack:0.003, release:[0.04,0.07], sustain:[0.45,0.55], fenv:[0.8,1.2], res:[0.28,0.4]}},
      pads:{prob:0.3, recipe:{model:["organ","saw"], wave:"saw", cutoff:[550,900], detune:[0.004,0.01], attack:[1.5,3], level:[0.3,0.45], send:[0.3,0.5], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.6,0.85], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.95,1.1], send:[0.1,0.2], dsend:[0,0.05]},
      fx:{reverb:[0.78,0.96], delayBeats:[0.375,0.5], delayFb:[0.15,0.3], delayCut:[2600,3800], pump:[0,0.09], crackle:[0.12,0.28], lowcut:[30,45], highcut:[0,0], comp:[0.14,0.36], grit:[0,0]},
      found:{role:"bed", vol:[0.06,0.12], pitch:[0.85,1], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:city*2","pool:voices*1"]},
      hits:{sources:["pool:vb_maritime_weather*1","pool:horn_stab*1","sp_rhythm","pool:vocal_stab*1"], pattern:"offbeat", prob:0.5},
      stab:["off","sparse"],
      form:"pop",
      reverbColor:"dattorro",
      masterComp:0.35 },
    /* /genre-tool:brinedub:genres */
    /* genre-tool:attichouse:genres */
    attichouse: { label:"Dust Mote Discotheque", info:"A pulse kit at 116-124. Acid bass under a vocoder choir pad, with a trumpet. A hijaz maqam, a light shuffle.",
      bpm:[116,124],
      swing:[0.007,0.057],
      humanize:[0.076,0.166],
      progressions:["hijaz","hijaz","andalusian","mode_phrygian"],
      kits:["pulse","four"],
      fills:["riser","tom fill","downlift"],
      bass:{patterns:["rolling","stab","sixteenths","pedal"], recipe:{model:["acid","saw","reese"], cutoff:[450,800], res:[0.2,0.35], level:[1,1.2], send:[0,0.08], dsend:[0,0.1]}, inserts:{prob:0.45, max:2, pool:[["filtersweep",{rateBars:[2,4], lo:[-1.2,-0.6], hi:[0.8,1.4], res:[0.25,0.45]}],["distort",{drive:[0.15,0.35], mix:[0.5,0.8]}]]}},
      lead:{patterns:["arpup","hero","wander","updown"], patchPool:["BRASS   2","BRASS   1","SYNBRASS 1"], samplerPool:["trumpet","trombone","french_horns"], recipe:{model:["vocoder","vocoder","stack","dx7","sampler"], wave:"saw", voices:[2,4], spread:[0.004,0.009], cutoff:[2400,3400], level:[0.6,0.72], send:[0.35,0.5], dsend:[0.25,0.4], vibrato:[0,0.004]}, inserts:{prob:0.35, max:1, pool:[["chorus",{rate:[0.4,0.9], depth:[0.4,0.6], mix:[0.35,0.5]}]]}},
      pads:{prob:1, recipe:{model:["vp330","oberheim","solina","choir","choir","strings"], wave:"saw", cutoff:[900,1500], detune:[0.005,0.011], attack:[1.5,3], vowel:[0.25,0.4], ensemble:[0.55,0.7], octave:[0.5,0.6], filterMode:[0,0.15], envAmount:[1,1.6], level:[0.55,0.75], send:[0.5,0.65], dsend:[0.1,0.2]}, inserts:{prob:0.5, max:1, pool:[["phaser",{rate:[0.08,0.2], depth:[0.5,0.7], mix:[0.35,0.55]}]]}},
      drums:{kickModel:["boom","909"], snareModel:["noise","clap"], hatModel:["noise"], kick:[1.1,1.3], snare:[0.7,0.95], hat:[0.6,0.9], tune:[0.9,1.05], send:[0.2,0.35], dsend:[0.05,0.15]},
      fx:{reverb:[0.5,0.68], delayBeats:[0.5,0.75], delayFb:[0.25,0.4], delayCut:[2000,3000], pump:[0.1,0.32], crackle:[0.13,0.29], lowcut:[140,220], highcut:[2600,3400], comp:[0.35,0.57], grit:[0,0.15]},
      found:{role:"break", vol:[0.32,0.45], pitch:[1,1], stretch:[0.5,0.5], cutoff:[6000,9000], sources:["amen_165","amen_170","amen_172","amen_175","stml_loop_120a","stml_loop_126a"]},
      vocSource:"vx_sv_speech",
      hits:{sources:["vx_sv_march","vx_sv_radio"], pattern:"sparse", prob:0.5},
      stab:["off","sparse"],
      form:"pop" },
    /* /genre-tool:attichouse:genres */
    /* genre-tool:driftrot:genres */
    driftrot: { label:"Mycelial Almanac", info:"A boom-bap kit at 89-97. Saw synth bass under a saw synth pad, with a pluck lead. Neo-soul changes, swung.",
      bpm:[89,97],
      swing:[0.079,0.129],
      humanize:[0.094,0.184],
      progressions:["neosoul","dream","deep_two","mode_mixo"],
      kits:["boombap","halftime","kick"],
      fills:["off","downlift","riser"],
      bass:{patterns:["rolling","stab","melodic","syncopated"], patchPool:["SYN-BASS 2"], recipe:{model:["saw","sub","dx7"], cutoff:[380,700], res:[0.15,0.3], level:[1,1.2], send:[0,0.08], dsend:[0,0.05]}},
      lead:{patterns:["off","sparse","pentaup"], recipe:{model:["pluck","fm"], wave:"sine", voices:[1,3], spread:[0.002,0.005], cutoff:[1800,2800], level:[0.5,0.62], send:[0.25,0.4], dsend:[0.25,0.4], attack:0.003, release:[0.06,0.1], sustain:[0.5,0.62]}},   // MUSICALITY balance loop 1 (buried-lead template class): level [0.3,0.42]->[0.5,0.62], the standbylightdrive calibration — same mechanism, pluck/fm template lead sampled-by-default under a heavy mix. Matrix unmoved (level is not a verifier feature).
      pads:{prob:0.25, recipe:{model:["saw","organ"], wave:"saw", cutoff:[600,1000], detune:[0.005,0.012], attack:[1,2.5], level:[0.3,0.42], send:[0.3,0.45], dsend:[0.1,0.2]}},
      drums:{kickModel:["808","boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.95,1.2], snare:[0.5,0.75], hat:[0.45,0.75], tune:[0.85,1], send:[0.2,0.35], dsend:[0.05,0.2]},
      fx:{reverb:[0.79,0.97], delayBeats:[0.75,1.5], delayFb:[0.3,0.5], delayCut:[1800,2800], pump:[0.01,0.23], crackle:[0.05,0.21], lowcut:[0,25], highcut:[0,0], comp:[0.26,0.48]},
      found:{role:"bed", vol:[0.2,0.32], pitch:[0.9,1], stretch:[0.45,0.6], cutoff:[2800,4200], sources:["vx_cn_east","vx_cn_march","vx_cn_opera","vx_cn_speech"]},
      snarePP:0.66,
      hits:{sources:["pool:vocal_stab*1","sp_herenow"], pattern:"sparse", prob:0.2},
      stab:["off"],
      form:"pop",
      timeFeel:{pushPull:{bass:0.011, hat:-0.007}} },
    /* /genre-tool:driftrot:genres */
    /* genre-tool:ceilingfanchop:genres */
    ceilingfanchop: { label:"Blade Pass Frequency", info:"A half-time kit at 159-167. Saw synth bass under a Juno pad, with a glockenspiel. A hijaz maqam, straight time.",
      bpm:[159,167],
      swing:[0,0.026],
      humanize:[0.061,0.151],
      progressions:["hijaz","hijaz","andalusian","mode_phrygian"],
      kits:["off","halftime","kick"],
      fills:["off","downlift"],
      bass:{patterns:["octaves","root","drive"], recipe:{model:["saw","sub"], cutoff:[600,1000], res:[0.1,0.2], level:[1,1.2], send:[0,0.06], dsend:[0.05,0.12]}},
      lead:{patterns:["double","updown","pentaup"], recipe:{model:["sampler","bell","synclead"], samplerPool:["glockenspiel","celesta"], wave:"sine", voices:[2,4], cutoff:[3000,4200], level:[0.44,0.58], send:[0.25,0.45], dsend:[0.1,0.25]}},
      pads:{prob:0.45, recipe:{model:["juno60","saw"], wave:"saw", cutoff:[1400,2200], detune:[0.008,0.016], attack:[0.3,0.9], level:[0.4,0.55], send:[0.3,0.5], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.75,1], snare:[0.5,0.75], hat:[0.6,0.9], tune:[0.9,1.05], send:[0.35,0.5], dsend:[0,0.1]},
      fx:{reverb:[0.13,0.31], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[3500,5000], pump:[0.56,0.78], crackle:[0.02,0.18], lowcut:[30,45], highcut:[0,0], comp:[0.39,0.61]},
      found:{role:"bed", vol:[0.18,0.3], pitch:[0.8,0.95], stretch:[0.45,0.6], cutoff:[2400,3800], sources:["pool:voices*2","pool:room*1"]},
      hits:{sources:["pool:chime*1"], pattern:"sparse", prob:0.2},
      stab:["off"],
      form:"pop" },
    /* /genre-tool:ceilingfanchop:genres */
    /* genre-tool:strawdub:genres */
    strawdub: { label:"Threshing Vespers", info:"A four-on-the-floor at 79-87. Acoustic bass under a percussive organ, with a piano. A twelve-bar blues, a light shuffle, one chord every 16 beats.",
      bpm:[79,87],
      swing:[0,0.049],
      humanize:[0.148,0.238],
      progressions:["blues_12"],
      kits:["house","four"],
      fills:["cut","riser","impact"],
      chordEvery:16,
      bass:{patterns:["root","simple","walking"], recipe:{model:["sub","sampler"], samplerPool:["acoustic_bass"], cutoff:[500,900], level:[0.55,0.75], send:[0.15,0.3], dsend:[0,0.08]}},
      lead:{patterns:["double","arpup","pentaup","updown"], recipe:{model:["piano","fm"], wave:"pulse", voices:[1,3], spread:[0.003,0.008], cutoff:[2200,3400], level:[0.4,0.52], send:[0.25,0.4], dsend:[0.2,0.35], octave:0.05, attack:0.004, release:[0.07,0.12], sustain:[0.6,0.72], fenv:[0.4,0.7]}, inserts:{prob:0.4, max:1, pool:[["chorus",{rate:[0.6,1.2], depth:[0.4,0.6], mix:[0.35,0.55]}]]}},
      pads:{prob:0.9, patchPool:["E.ORGAN 1","SYNORGAN 1"], samplerPool:["percussive_organ"], recipe:{model:["juno60","juno60","hammond","hammond","organ","dx7","sampler"], wave:"saw", cutoff:[1000,1600], detune:[0.004,0.009], attack:[0.15,0.4], chorus:[1,1.4], chorusSpread:[0.8,1], bar513:8, bar4:0, bar1:4, leslie:[0.8,0.9], perc:[0.5,0.7], level:[0.5,0.65], send:[0.25,0.4], dsend:[0.1,0.25]}},
      drums:{kickModel:["909"], snareModel:["clap","crack"], hatModel:["noise","metal"], kick:[1.1,1.35], snare:[0.6,0.85], hat:[0.6,0.9], tune:[0.98,1.1], send:[0.1,0.25], dsend:[0.05,0.15]},
      fx:{reverb:[0.87,1], delayBeats:[0.75,1.5], delayFb:[0.15,0.3], delayCut:[2000,3000], pump:[0,0.12], crackle:[0.02,0.18], lowcut:[0,0], highcut:[2600,3400], comp:[0.21,0.43]},
      found:{role:"narration", vol:[0.35,0.55], pitch:[0.98,1.05], stretch:[0.9,1.05], cutoff:[2600,3600], sources:["vx_apollo"]},
      hits:{sources:["sp_system","pool:chime*1"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"wave",
      reverbColor:"greyhole" },
    /* /genre-tool:strawdub:genres */
    /* genre-tool:wickershimmy:genres */
    wickershimmy: { label:"Seance Cakewalk", info:"A four-on-the-floor at 116-124. Saw synth bass under a percussive organ, with a steel string guitar. A funk vamp, a light shuffle.",
      bpm:[116,124],
      swing:[0,0.044],
      humanize:[0.068,0.158],
      progressions:["funk_vamp","house_min7","pop_1625"],
      kits:["four","open"],
      fills:["hat rush","drum fill","riser"],
      bass:{patterns:["root","simple","off"], recipe:{model:["saw","sub"], cutoff:[400,700], res:[0.05,0.15], level:[0.8,1], send:[0.1,0.2], dsend:[0,0.08]}},
      lead:{patterns:["blues","blues","wander"], patchPool:["HARMONICA1"], samplerPool:["steel_string_guitar","harmonica"], recipe:{model:["sampler","sampler","sampler","sampler","hammond","piano"], wave:"sine", voices:[1,3], spread:[0.001,0.004], cutoff:[2200,3400], leslie:[0.85,0.95], drive:[0.3,0.4], percHarm:1, level:[0.5,0.65], send:[0.3,0.5], dsend:[0.1,0.25]}},
      pads:{prob:0.55, samplerPool:["percussive_organ","rock_organ","honky_tonk"], recipe:{model:["hammond","hammond","sampler","sampler","piano"], wave:"saw", cutoff:[900,1500], detune:[0.003,0.007], attack:[0.02,0.08], bar513:8, bar4:8, bar223:6, bar2:8, bar135:4, bar113:6, bar1:8, leslie:[0.85,0.95], percHarm:1, drive:[0.3,0.4], perc:[0.4,0.6], level:[0.3,0.42], send:[0.2,0.35], dsend:[0.05,0.15]}},
      drums:{kickModel:["909","boom"], snareModel:["clap","noise"], hatModel:["noise"], kick:[1.1,1.3], snare:[0.75,1], hat:[1.1,1.4], tune:[0.95,1.1], send:[0.15,0.3], dsend:[0.05,0.15], kit:"power"},
      fx:{reverb:[0.27,0.45], delayBeats:[0.375,0.5], delayFb:[0.15,0.3], delayCut:[2600,3800], pump:[0.09,0.31], crackle:[0.13,0.29], lowcut:[30,45], highcut:[0,0], comp:[0.35,0.57], grit:[0,0]},
      found:{role:"chops", vol:[0.1,0.18], pitch:[0.95,1.15], stretch:[0.4,0.6], cutoff:[2500,4000], sources:["shibuya","tokyo_station","vx_suspense"]},
      hits:{sources:["pool:horn_stab*1","sp_rhythm","pool:vocal_stab*1"], pattern:"offbeat", prob:0.5},
      stab:["off","sparse"],
      form:"pop",
      reverbColor:"dattorro",
      masterComp:0.35 },
    /* /genre-tool:wickershimmy:genres */
    /* genre-tool:shellacsplice:genres */
    shellacsplice: { label:"Lacquer Autopsy", info:"A boom-bap kit at 123-131. Sub bass under ahh choir, with an alto sax. A minor pop cycle, swung.",
      bpm:[123,131],
      swing:[0.086,0.136],
      humanize:[0.1,0.19],
      progressions:["sad_pop","synthwave","doo_wop"],
      kits:["boombap","breaks"],
      fills:["off","drum fill","downlift"],
      bass:{patterns:["stab","dub","sub"], recipe:{model:["sub","reese","saw"], cutoff:[420,780], res:[0.15,0.3], level:[1,1.2], send:[0,0.08], dsend:[0.05,0.15]}},
      lead:{patterns:["composed","composed2","arpup","wander"], patchPool:["E.PIANO 1","TUB BELLS","E.PIANO 4","SHIMMER"], samplerPool:["alto_sax","tenor_sax"], recipe:{model:["stack","stack","dx7","sampler","sampler"], wave:"sine", voices:[2,4], spread:[0.003,0.006], cutoff:[2800,4000], level:[0.4,0.52], send:[0.4,0.6], dsend:[0.2,0.4], vibrato:[0.004,0.009], octave:0.2, attack:0.08, release:[0.45,0.6], sustain:[0.85,0.95]}, inserts:{prob:0.5, max:1, pool:[["chorus",{rate:[0.5,1.1], depth:[0.5,0.7], mix:[0.4,0.6]}]]}},
      pads:{prob:1, samplerPool:["ahh_choir","strings"], recipe:{model:["saw","choir","strings","sampler"], wave:"saw", cutoff:[1100,1800], detune:[0.004,0.009], attack:[1.2,2.4], mellotron:true, level:[0.6,0.8], send:[0.5,0.7], dsend:[0.1,0.25]}, inserts:{prob:0.55, max:1, pool:[["chorus",{rate:[0.2,0.5], depth:[0.5,0.75], mix:[0.4,0.6]}]]}},
      drums:{kickModel:["boom","808"], snareModel:["crack","noise"], hatModel:["noise"], kick:[1.1,1.35], snare:[0.8,1.05], hat:[0.6,0.9], tune:[0.9,1.05], send:[0.12,0.25], dsend:[0.05,0.15], kit:"room"},
      fx:{reverb:[0.23,0.41], delayBeats:[0.5,0.75], delayFb:[0.2,0.35], delayCut:[1800,2800], pump:[0.29,0.51], crackle:[0.3,0.46], lowcut:[0,25], highcut:[0,0], comp:[0.27,0.49]},
      found:{role:"break", vol:[0.32,0.45], pitch:[1,1], stretch:[0.5,0.5], cutoff:[6000,9000], sources:["amen_165","amen_170","amen_172","amen_175"]},
      snarePP:0.5,
      hits:{sources:["pool:vocal_stab*2","sp_rewind"], pattern:"sparse", prob:0.4},
      stab:["off"],
      form:"pop" },
    /* /genre-tool:shellacsplice:genres */
    /* genre-tool:gourdscuttle:genres */
    gourdscuttle: { label:"Scarab Two Step", info:"A shuffle at 157-165. Saw synth bass under strings, with a muted trumpet. Doo-wop changes, a light shuffle.",
      bpm:[157,165],
      swing:[0.051,0.101],
      humanize:[0.209,0.299],
      progressions:["doo_wop","four_chords","ii_v_i"],
      kits:["shuffle","four"],
      fills:["off","drum fill","kit fill"],
      bass:{patterns:["rolling","stab","melodic","syncopated"], patchPool:["SYN-BASS 2"], recipe:{model:["saw","sub","dx7"], cutoff:[380,700], res:[0.15,0.3], level:[1,1.2], send:[0,0.08], dsend:[0,0.05]}},
      lead:{patterns:["sparse","wander","off"], patchPool:["E.PIANO 2"], samplerPool:["muted_trumpet","tenor_sax"], recipe:{model:["fm","dx7","sampler","sampler"], wave:"sine", voices:[1,3], spread:[0.002,0.006], cutoff:[1800,3000], level:[0.4,0.52], send:[0.4,0.6], dsend:[0.3,0.5], vibrato:[0.004,0.01], octave:0.08, attack:0.05, release:[0.3,0.45], sustain:[0.78,0.88], fenv:[0.2,0.4]}},
      pads:{prob:0.85, samplerPool:["strings"], recipe:{model:["fm","strings","sampler"], wave:"sine", cutoff:[800,1400], detune:[0.004,0.01], attack:[1,2.5], level:[0.5,0.68], send:[0.45,0.65], dsend:[0.15,0.3]}, inserts:{prob:0.35, max:1, pool:[["phaser",{rate:[0.06,0.18], depth:[0.4,0.6], mix:[0.3,0.5]}]]}},
      drums:{kickModel:["boom"], snareModel:["noise","crack"], hatModel:["noise"], kick:[0.9,1.15], snare:[0.65,0.9], hat:[0.7,1], tune:[0.95,1.1], send:[0.12,0.24], dsend:[0.05,0.15], kit:"acoustic"},
      fx:{reverb:[0.11,0.29], delayBeats:[0.5,0.75], delayFb:[0.15,0.3], delayCut:[2200,3400], pump:[0.28,0.5], crackle:[0.19,0.35], lowcut:[20,35], highcut:[0,0], comp:[0.27,0.49]},
      found:{role:"bed", vol:[0.18,0.3], pitch:[0.8,0.95], stretch:[0.45,0.6], cutoff:[2400,3800], sources:["pool:voices*2","pool:room*1"]},
      hits:{sources:["bb_horn_a","bb_horn_b","bb_stab_a"], pattern:"offbeat", prob:0.6},
      stab:["offbeat","rave"],
      form:"pop" },
    /* /genre-tool:gourdscuttle:genres */
    /* genre-tool:auroragallop:genres */
    auroragallop: { label:"Magnetotail Stampede", info:"A pulse kit at 144-152. Acid bass under a vocoder choir pad, with a trumpet. A funk vamp, a light shuffle.",
      bpm:[144,152],
      swing:[0.003,0.053],
      humanize:[0.035,0.125],
      progressions:["funk_vamp","mode_phrygian","andalusian"],
      kits:["pulse","four"],
      fills:["riser","tom fill","downlift"],
      bass:{patterns:["rolling","stab","sixteenths","pedal"], recipe:{model:["acid","saw","reese"], cutoff:[450,800], res:[0.2,0.35], level:[1,1.2], send:[0,0.08], dsend:[0,0.1]}, inserts:{prob:0.45, max:2, pool:[["filtersweep",{rateBars:[2,4], lo:[-1.2,-0.6], hi:[0.8,1.4], res:[0.25,0.45]}],["distort",{drive:[0.15,0.35], mix:[0.5,0.8]}]]}},
      lead:{patterns:["arpup","hero","wander","updown"], patchPool:["BRASS   2","BRASS   1","SYNBRASS 1"], samplerPool:["trumpet","trombone","french_horns"], recipe:{model:["vocoder","vocoder","stack","dx7","sampler"], wave:"saw", voices:[3,5], spread:[0.004,0.009], cutoff:[2400,3400], level:[0.6,0.72], send:[0.35,0.5], dsend:[0.25,0.4], vibrato:[0,0.004]}, inserts:{prob:0.35, max:1, pool:[["chorus",{rate:[0.4,0.9], depth:[0.4,0.6], mix:[0.35,0.5]}]]}},
      pads:{prob:1, recipe:{model:["vp330","oberheim","solina","choir","choir","strings"], wave:"saw", cutoff:[900,1500], detune:[0.005,0.011], attack:[1.5,3], vowel:[0.25,0.4], ensemble:[0.55,0.7], octave:[0.5,0.6], filterMode:[0,0.15], envAmount:[1,1.6], level:[0.55,0.75], send:[0.5,0.65], dsend:[0.1,0.2]}, inserts:{prob:0.5, max:1, pool:[["phaser",{rate:[0.08,0.2], depth:[0.5,0.7], mix:[0.35,0.55]}]]}},
      drums:{kickModel:["boom","909"], snareModel:["noise","clap"], hatModel:["noise"], kick:[1.1,1.3], snare:[0.7,0.95], hat:[0.6,0.9], tune:[0.9,1.05], send:[0.2,0.35], dsend:[0.05,0.15]},
      fx:{reverb:[0.41,0.59], delayBeats:[0.5,0.75], delayFb:[0.25,0.4], delayCut:[2000,3000], pump:[0.3,0.52], crackle:[0.04,0.2], lowcut:[140,220], highcut:[2600,3400], comp:[0.48,0.7], grit:[0,0.15]},
      found:{role:"chops", vol:[0.1,0.18], pitch:[0.95,1.15], stretch:[0.4,0.6], cutoff:[2500,4000], sources:["shibuya","tokyo_station","vx_suspense"]},
      vocSource:"vx_sv_speech",
      hits:{sources:["pool:vb_cosmic_space*1","vx_sv_march","vx_sv_radio"], pattern:"sparse", prob:0.5},
      stab:["off","sparse"],
      form:"throughline" },
    /* /genre-tool:auroragallop:genres */
    /* genre-tool:atticfanthrashsplice:genres */
    atticfanthrashsplice: { label:"Centrifuge Tantrum", info:"A tribal kit at 151-159. Saw synth bass under ahh choir, with french horns. A descending minor run, swung, loose timing, euclidean hats.",
      bpm:[151,159],
      swing:[0.121,0.171],
      humanize:[0.244,0.334],
      progressions:["minor_run","house_min","deep_two"],
      kits:["tribal","breaks"],
      fills:["drum fill","tom fill","off"],
      euclid:{kick:[5,16]},
      bass:{patterns:["rolling","stab","melodic","syncopated"], patchPool:["SYN-BASS 2"], recipe:{model:["saw","sub","dx7"], cutoff:[380,700], res:[0.15,0.3], level:[1,1.2], send:[0,0.08], dsend:[0,0.05]}},
      lead:{patterns:["wander","updown","pentaup"], patchPool:["HORNS","BRASSHORNS"], samplerPool:["french_horns"], recipe:{model:["brass","dx7","sampler","sampler"], wave:"sine", voices:[1,3], spread:[0.002,0.005], cutoff:[1500,2600], level:[0.36,0.5], send:[0.55,0.78], dsend:[0.3,0.5], vibrato:[0.004,0.01]}},
      pads:{prob:1, samplerPool:["ahh_choir"], recipe:{model:["vp330","vp330","vp330","choir","strings","sampler"], wave:"saw", cutoff:[700,1300], detune:[0.006,0.014], attack:[2.5,4.5], vowel:[0.4,0.5], ensemble:[0.9,1], mellotron:true, level:[0.62,0.82], send:[0.6,0.82], dsend:[0.15,0.3]}},
      drums:{kickModel:["808","boom"], snareModel:["crack"], hatModel:["noise"], kick:[1.1,1.3], snare:[0.7,0.95], hat:[0.9,1.2], tune:[1.05,1.2], send:[0.1,0.2], dsend:[0.1,0.25]},
      fx:{reverb:[0.25,0.43], delayBeats:[0.5,0.75], delayFb:[0.25,0.4], delayCut:[2200,3400], pump:[0.11,0.33], crackle:[0.16,0.32], lowcut:[25,40], highcut:[2600,3400], comp:[0.2,0.42]},
      found:{role:"break", vol:[0.32,0.45], pitch:[1,1], stretch:[0.5,0.5], cutoff:[6000,9000], sources:["amen_165","amen_170","amen_172","amen_175"]},
      hits:{sources:["pool:vocal_stab*1","sp_rhythm"], pattern:"sparse", prob:0.4},
      stab:["off"],
      form:"pop" },
    /* /genre-tool:atticfanthrashsplice:genres */
    /* genre-tool:obelisktrot:genres */
    obelisktrot: { label:"Monolith Errand", info:"A bare kick at 105-113. Acoustic bass under a saw synth pad, with a pluck lead. Epic minor changes, swung.",
      bpm:[105,113],
      swing:[0.118,0.168],
      humanize:[0.176,0.266],
      progressions:["epic_min","minor_run","andalusian","mode_phrygian"],
      kits:["kick","off"],
      fills:["off","downlift"],
      bass:{patterns:["root","simple","walking"], recipe:{model:["sub","sampler"], samplerPool:["acoustic_bass"], cutoff:[500,900], level:[0.55,0.75], send:[0.15,0.3], dsend:[0,0.08]}},
      lead:{patterns:["off","sparse","pentaup"], recipe:{model:["pluck","fm"], wave:"sine", voices:[2,4], spread:[0.002,0.005], cutoff:[1800,2800], level:[0.5,0.62], send:[0.25,0.4], dsend:[0.25,0.4], attack:0.003, release:[0.06,0.1], sustain:[0.5,0.62]}},   // MUSICALITY balance loop 1 (buried-lead template class): level [0.3,0.42]->[0.5,0.62], the standbylightdrive calibration — same mechanism, pluck/fm template lead sampled-by-default under a heavy mix. Matrix unmoved (level is not a verifier feature).
      pads:{prob:0.25, recipe:{model:["saw","organ"], wave:"saw", cutoff:[600,1000], detune:[0.005,0.012], attack:[1,2.5], level:[0.3,0.42], send:[0.3,0.45], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.6,0.85], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.95,1.1], send:[0.1,0.2], dsend:[0,0.05]},
      fx:{reverb:[0.35,0.53], delayBeats:[0.375,0.5], delayFb:[0.15,0.3], delayCut:[2600,3800], pump:[0.21,0.43], crackle:[0.31,0.47], lowcut:[30,45], highcut:[2600,3400], comp:[0.23,0.45], grit:[0,0]},
      found:{role:"bed", vol:[0.06,0.12], pitch:[0.85,1], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:city*2","pool:voices*1"]},
      hits:{sources:["pool:horn_stab*1","sp_rhythm","pool:vocal_stab*1"], pattern:"offbeat", prob:0.5},
      stab:["off","sparse"],
      form:"throughline",
      reverbColor:"dattorro",
      masterComp:0.35 },
    /* /genre-tool:obelisktrot:genres */
    /* genre-tool:oakdublilt:genres */
    oakdublilt: { label:"Xylem Vigil", info:"A shuffle at 80-88. Acoustic bass under a percussive organ, with a steel string guitar. A twelve-bar blues, hard swing, loose timing, rubato.",
      bpm:[80,88],
      swing:[0.17,0.22],
      humanize:[0.365,0.455],
      progressions:["blues_12"],
      kits:["shuffle","boombap","shuffle"],
      fills:["off","drum fill"],
      bass:{patterns:["walking","walking","melodic"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sampler","piano"], cutoff:[500,1000], res:[0.05,0.15], level:[0.9,1.1], send:[0.1,0.2], dsend:[0,0.05], attack:0.005, release:[0.08,0.14]}},
      lead:{patterns:["blues","blues","wander"], patchPool:["HARMONICA1"], samplerPool:["steel_string_guitar","harmonica"], recipe:{model:["sampler","sampler","sampler","sampler","hammond","piano"], wave:"sine", voices:[1,3], spread:[0.001,0.004], cutoff:[2200,3400], leslie:[0.85,0.95], drive:[0.3,0.4], percHarm:1, level:[0.5,0.65], send:[0.3,0.5], dsend:[0.1,0.25]}},
      pads:{prob:0.55, samplerPool:["percussive_organ","rock_organ","honky_tonk"], recipe:{model:["hammond","hammond","sampler","sampler","piano"], wave:"saw", cutoff:[900,1500], detune:[0.003,0.007], attack:[0.02,0.08], bar513:8, bar4:8, bar223:6, bar2:8, bar135:4, bar113:6, bar1:8, leslie:[0.85,0.95], percHarm:1, drive:[0.3,0.4], perc:[0.4,0.6], level:[0.3,0.42], send:[0.2,0.35], dsend:[0.05,0.15]}},
      drums:{kickModel:["boom","808"], snareModel:["noise"], hatModel:["noise"], kick:[0.9,1.15], snare:[0.5,0.7], hat:[0.5,0.8], tune:[0.85,1], send:[0.15,0.3], dsend:[0,0.1], kit:"acoustic"},
      fx:{reverb:[0.48,0.66], delayBeats:[0.5,0.75], delayFb:[0.1,0.25], delayCut:[2000,3000], pump:[0,0.12], crackle:[0.2,0.36], lowcut:[0,30], highcut:[2600,3400], comp:[0.07,0.29]},
      found:{role:"bed", vol:[0.05,0.12], pitch:[0.8,1], stretch:[0.45,0.6], cutoff:[1500,2500], sources:["pool:city*2","vx_whitman"]},
      rubato:{depth:[0.008,0.02], periodBars:[3,5], prob:1},
      hits:{sources:["blues_vox_78","blues_vox_78","pool:horn_stab*1"], pattern:"response", prob:0.75},
      stab:["off"],
      form:"pop",
      reverbColor:"fdn",
      timeFeel:{pushPull:{bass:0.015, snare:0.01}} },
    /* /genre-tool:oakdublilt:genres */
    /* genre-tool:duststrut:genres */
    duststrut: { label:"Particulate Strut", info:"A boom-bap kit at 96-104. Saw synth bass under a saw synth pad, with a pluck lead. Epic minor changes, hard swing.",
      bpm:[96,104],
      swing:[0.164,0.214],
      humanize:[0.161,0.251],
      progressions:["epic_min","minor_run","sad_pop","drone_min"],
      kits:["boombap","breaks"],
      fills:["off","drum fill","downlift"],
      bass:{patterns:["root","simple","off"], recipe:{model:["saw","sub"], cutoff:[400,700], res:[0.05,0.15], level:[0.8,1], send:[0.1,0.2], dsend:[0,0.08]}},
      lead:{patterns:["off","sparse","pentaup"], recipe:{model:["pluck","fm"], wave:"sine", voices:[1,3], spread:[0.002,0.005], cutoff:[1800,2800], level:[0.5,0.62], send:[0.25,0.4], dsend:[0.25,0.4], attack:0.003, release:[0.06,0.1], sustain:[0.5,0.62]}},   // MUSICALITY balance loop 1 (buried-lead template class): level [0.3,0.42]->[0.5,0.62], the standbylightdrive calibration — same mechanism, pluck/fm template lead sampled-by-default under a heavy mix. Matrix unmoved (level is not a verifier feature).
      pads:{prob:0.25, recipe:{model:["saw","organ"], wave:"saw", cutoff:[600,1000], detune:[0.005,0.012], attack:[1,2.5], level:[0.3,0.42], send:[0.3,0.45], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom","808"], snareModel:["crack","noise"], hatModel:["noise"], kick:[1.1,1.35], snare:[0.8,1.05], hat:[0.6,0.9], tune:[0.9,1.05], send:[0.12,0.25], dsend:[0.05,0.15], kit:"room"},
      fx:{reverb:[0.39,0.57], delayBeats:[0.5,0.75], delayFb:[0.2,0.35], delayCut:[1800,2800], pump:[0.2,0.42], crackle:[0.5,0.66], lowcut:[0,25], highcut:[2600,3400], comp:[0.34,0.56]},
      found:{role:"chops", vol:[0.1,0.18], pitch:[0.95,1.15], stretch:[0.4,0.6], cutoff:[2500,4000], sources:["shibuya","tokyo_station","vx_suspense"]},
      snarePP:0.5,
      hits:{sources:["pool:vocal_stab*2","sp_rewind"], pattern:"sparse", prob:0.4},
      stab:["off"],
      form:"pop" },
    /* /genre-tool:duststrut:genres */
    /* genre-tool:reedrush:genres */
    reedrush: { label:"Bulrush Cyclotron", info:"A swingbeat kit at 141-149. Acoustic bass under a church organ, with a plucked string lead. A funk vamp, swung.",
      bpm:[141,149],
      swing:[0.092,0.142],
      humanize:[0.19,0.28],
      progressions:["funk_vamp","neosoul","ii_v_i"],
      kits:["newjack","house","four"],
      fills:["off","drum fill","kit fill"],
      bass:{patterns:["walking","melodic","dub"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sampler","piano"], cutoff:[400,800], res:[0.05,0.12], level:[0.95,1.15], send:[0.1,0.2], dsend:[0,0.05], attack:0.005, release:[0.08,0.14]}},
      lead:{patterns:["arp16"], recipe:{model:["kpluck"], wave:"saw", drive:0.45, cutoff:[3000,3800], level:[0.84,0.98], send:[0.16,0.26], dsend:[0.2,0.32], voices:[1,3]}, inserts:{prob:0.8, max:1, pool:[["chorus",{rate:[0.7,1.1], depth:[0.45,0.65], mix:[0.45,0.6]}]]}},   // LEAD FORWARD (the lead was too quiet): level up + delay send halved (0.46-0.56 dry-drowning wash -> 0.2-0.32) so the kpluck arp sits up front, not buried in its own echo
      pads:{prob:1, samplerPool:["church_organ"], recipe:{model:["organ","organ","sampler"], wave:"saw", cutoff:[1500,2200], detune:[0.004,0.008], attack:[0.3,0.7], level:[0.4,0.52], send:[0.16,0.26], dsend:[0,0.06]}},
      drums:{kickModel:["boom","909"], snareModel:["noise","crack"], hatModel:["noise"], kick:[0.85,1.05], snare:[0.7,0.95], hat:[0.9,1.3], tune:[0.95,1.1], send:[0.1,0.22], dsend:[0.03,0.12], kit:"acoustic"},   // KICK -15% (the bass drum read as processed, with a bad transient click): 1-1.25 slammed the master makeup+limiter; a fast limiter clamping that hot transient is the click — best-guess ear-check
      fx:{reverb:[0.26,0.44], delayBeats:[0.5,0.75], delayFb:[0.15,0.3], delayCut:[2200,3400], pump:[0.13,0.35], crackle:[0.12,0.28], lowcut:[25,40], highcut:[2600,3400], comp:[0.26,0.48]},
      found:{role:"chops", vol:[0.1,0.18], pitch:[0.95,1.15], stretch:[0.4,0.6], cutoff:[2500,4000], sources:["shibuya","tokyo_station","vx_suspense"]},
      hits:{sources:["bb_horn_a","bb_horn_b","bb_stab_a","bb_stab_b"], pattern:"offbeat", prob:0.55},
      stab:["offbeat","rave"],
      form:"pop" },
    /* /genre-tool:reedrush:genres */
    /* genre-tool:hearthsway:genres */
    hearthsway: { label:"The Warm Room", info:"A boom-bap kit at 66-74. Acoustic bass under an FM lead pad, with an alto sax. A two-chord vamp, swung.",
      bpm:[66,74],
      swing:[0.107,0.157],
      humanize:[0.218,0.308],
      progressions:["deep_two","neosoul","four_chords","minor_run"],
      kits:["boombap","halftime","kick"],
      fills:["off","downlift","riser"],
      bass:{patterns:["root","simple","walking"], recipe:{model:["sub","sampler"], samplerPool:["acoustic_bass"], cutoff:[500,900], level:[0.55,0.75], send:[0.15,0.3], dsend:[0,0.08]}},
      lead:{patterns:["pentaup","sparse","wander"], patchPool:["E.PIANO 1","E.PIANO 3"], samplerPool:["alto_sax","felt_piano","jazz_guitar"], recipe:{model:["fm","pluck","sampler","sampler","sampler"], wave:"sine", voices:[1,3], spread:[0.002,0.005], cutoff:[1800,2800], level:[0.4,0.52], send:[0.35,0.5], dsend:[0.2,0.35], vibrato:[0.005,0.012], octave:0.06, attack:0.025, release:[0.12,0.2], sustain:[0.66,0.78], fenv:[0.15,0.3]}, inserts:{prob:0.4, max:1, pool:[["chorus",{rate:[0.3,0.8], depth:[0.5,0.8], mix:[0.35,0.55]}]]}},
      pads:{prob:0.9, recipe:{model:["fm"], wave:"sine", cutoff:[900,1500], detune:[0.003,0.008], attack:[0.8,1.8], level:[0.5,0.68], send:[0.35,0.55], dsend:[0.1,0.2]}},
      drums:{kickModel:["808","boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.95,1.2], snare:[0.5,0.75], hat:[0.45,0.75], tune:[0.85,1], send:[0.2,0.35], dsend:[0.05,0.2]},
      fx:{reverb:[0.84,1], delayBeats:[0.75,1.5], delayFb:[0.3,0.5], delayCut:[1800,2800], pump:[0,0.17], crackle:[0.2,0.36], lowcut:[0,25], highcut:[0,0], comp:[0.13,0.35]},
      found:{role:"bed", vol:[0.14,0.24], pitch:[0.7,0.9], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:city*1","pool:road*1","pool:voices*1"]},
      snarePP:0.66,
      hits:{sources:["pool:vocal_stab*1","sp_herenow"], pattern:"sparse", prob:0.2},
      stab:["off"],
      form:"pop",
      timeFeel:{pushPull:{bass:0.011, hat:-0.007}} },
    /* /genre-tool:hearthsway:genres */
    /* genre-tool:graingroove:genres */
    graingroove: { label:"Emulsion Shuffle", info:"A bossa kit at 96-104. Acoustic bass under an FM lead pad, with an alto sax. A descending minor run, swung.",
      bpm:[96,104],
      swing:[0.117,0.167],
      humanize:[0.172,0.262],
      progressions:["minor_run","drone_min","house_min"],
      kits:["bossa","shuffle"],
      fills:["micro lick","off"],
      bass:{patterns:["dub","simple","sub"], samplerPool:["acoustic_bass"], recipe:{model:["sub","saw","sampler"], cutoff:[300,600], res:[0.05,0.2], level:[1,1.25], send:[0.05,0.12], dsend:[0,0.1]}, inserts:{prob:0.5, max:1, pool:[["distort",{drive:[0.1,0.22], mix:[0.35,0.6]}]]}},
      lead:{patterns:["pentaup","sparse","wander"], patchPool:["E.PIANO 1","E.PIANO 3"], samplerPool:["alto_sax","felt_piano","jazz_guitar"], recipe:{model:["fm","pluck","sampler","sampler","sampler"], wave:"sine", voices:[1,3], spread:[0.002,0.005], cutoff:[1800,2800], level:[0.52,0.64], send:[0.35,0.5], dsend:[0.2,0.35], vibrato:[0.005,0.012], octave:0.06, attack:0.025, release:[0.12,0.2], sustain:[0.66,0.78], fenv:[0.15,0.3]}, inserts:{prob:0.4, max:1, pool:[["chorus",{rate:[0.3,0.8], depth:[0.5,0.8], mix:[0.35,0.55]}]]}},   // MUSICALITY balance loop 1 (buried-lead template class): level [0.4,0.52]->[0.52,0.64], the moltenhouse calibration — synth-tuned template lead remapped onto samplers sat buried under a hot bass/pump mix; raising lvl self-trims relative wetness (rev gain = send/lvl). Level is not a verifier feature (matrix unmoved); state fixtures drift for exactly this class.
      pads:{prob:0.9, recipe:{model:["fm"], wave:"sine", cutoff:[900,1500], detune:[0.003,0.008], attack:[0.8,1.8], level:[0.5,0.68], send:[0.35,0.55], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom"], snareModel:["noise","crack"], hatModel:["noise"], kick:[0.5,0.72], snare:[0.35,0.55], hat:[0.4,0.6], tune:[0.9,1.02], send:[0.2,0.4], dsend:[0,0.1]},
      fx:{reverb:[0.4,0.58], delayBeats:[0.5,0.9], delayFb:[0.12,0.28], delayCut:[2200,3200], pump:[0.03,0.25], crackle:[0.28,0.44], lowcut:[0,0], highcut:[2600,3400], comp:[0.3,0.52]},
      found:{role:"chops", vol:[0.1,0.18], pitch:[0.95,1.15], stretch:[0.4,0.6], cutoff:[2500,4000], sources:["shibuya","tokyo_station","vx_suspense"]},
      hits:{sources:["pool:chime*1"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"pop",
      reverbColor:"spring" },
    /* /genre-tool:graingroove:genres */
    /* genre-tool:hvacbop:genres */
    hvacbop: { label:"Plenum Bop", info:"A bare kick at 102-110. Acoustic bass under ahh choir, with french horns. Epic minor changes, swung.",
      bpm:[102,110],
      swing:[0.075,0.125],
      humanize:[0.148,0.238],
      progressions:["epic_min","minor_run","andalusian","mode_phrygian"],
      kits:["kick","off"],
      fills:["off","downlift"],
      bass:{patterns:["dub","simple","sub"], samplerPool:["acoustic_bass"], recipe:{model:["sub","saw","sampler"], cutoff:[300,600], res:[0.05,0.2], level:[1,1.25], send:[0.05,0.12], dsend:[0,0.1]}, inserts:{prob:0.5, max:1, pool:[["distort",{drive:[0.1,0.22], mix:[0.35,0.6]}]]}},
      lead:{patterns:["wander","updown","pentaup"], patchPool:["HORNS","BRASSHORNS"], samplerPool:["french_horns"], recipe:{model:["brass","dx7","sampler","sampler"], wave:"sine", voices:[2,4], spread:[0.002,0.005], cutoff:[1500,2600], level:[0.36,0.5], send:[0.55,0.78], dsend:[0.3,0.5], vibrato:[0.004,0.01]}},
      pads:{prob:1, samplerPool:["ahh_choir"], recipe:{model:["vp330","vp330","vp330","choir","strings","sampler"], wave:"saw", cutoff:[700,1300], detune:[0.006,0.014], attack:[2.5,4.5], vowel:[0.4,0.5], ensemble:[0.9,1], mellotron:true, level:[0.62,0.82], send:[0.6,0.82], dsend:[0.15,0.3]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.6,0.85], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.95,1.1], send:[0.1,0.2], dsend:[0,0.05]},
      fx:{reverb:[0.81,0.99], delayBeats:[0.375,0.5], delayFb:[0.15,0.3], delayCut:[2600,3800], pump:[0.21,0.43], crackle:[0.21,0.37], lowcut:[30,45], highcut:[0,0], comp:[0.28,0.5], grit:[0,0]},
      found:{role:"bed", vol:[0.06,0.12], pitch:[0.85,1], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:city*2","pool:voices*1"]},
      hits:{sources:["pool:horn_stab*1","sp_rhythm","pool:vocal_stab*1"], pattern:"offbeat", prob:0.5},
      stab:["off","sparse"],
      form:"pop",
      reverbColor:"dattorro",
      masterComp:0.35 },
    /* /genre-tool:hvacbop:genres */
    /* genre-tool:moldcore:genres */
    moldcore: { label:"Hyphal Blitz", info:"A pulse kit at 157-165. Acid bass under a vocoder choir pad, with a trumpet. A hijaz maqam, swung.",
      bpm:[157,165],
      swing:[0.084,0.134],
      humanize:[0.153,0.243],
      progressions:["hijaz","hijaz","andalusian","mode_phrygian"],
      kits:["pulse","four"],
      fills:["riser","tom fill","downlift"],
      bass:{patterns:["rolling","stab","sixteenths","pedal"], recipe:{model:["acid","saw","reese"], cutoff:[450,800], res:[0.2,0.35], level:[1,1.2], send:[0,0.08], dsend:[0,0.1]}, inserts:{prob:0.45, max:2, pool:[["filtersweep",{rateBars:[2,4], lo:[-1.2,-0.6], hi:[0.8,1.4], res:[0.25,0.45]}],["distort",{drive:[0.15,0.35], mix:[0.5,0.8]}]]}},
      lead:{patterns:["arpup","hero","wander","updown"], patchPool:["BRASS   2","BRASS   1","SYNBRASS 1"], samplerPool:["trumpet","trombone","french_horns"], recipe:{model:["vocoder","vocoder","stack","dx7","sampler"], wave:"saw", voices:[3,5], spread:[0.004,0.009], cutoff:[2400,3400], level:[0.6,0.72], send:[0.35,0.5], dsend:[0.25,0.4], vibrato:[0,0.004]}, inserts:{prob:0.35, max:1, pool:[["chorus",{rate:[0.4,0.9], depth:[0.4,0.6], mix:[0.35,0.5]}]]}},
      pads:{prob:1, recipe:{model:["vp330","oberheim","solina","choir","choir","strings"], wave:"saw", cutoff:[900,1500], detune:[0.005,0.011], attack:[1.5,3], vowel:[0.25,0.4], ensemble:[0.55,0.7], octave:[0.5,0.6], filterMode:[0,0.15], envAmount:[1,1.6], level:[0.55,0.75], send:[0.5,0.65], dsend:[0.1,0.2]}, inserts:{prob:0.5, max:1, pool:[["phaser",{rate:[0.08,0.2], depth:[0.5,0.7], mix:[0.35,0.55]}]]}},
      drums:{kickModel:["boom","909"], snareModel:["noise","clap"], hatModel:["noise"], kick:[1.1,1.3], snare:[0.7,0.95], hat:[0.6,0.9], tune:[0.9,1.05], send:[0.2,0.35], dsend:[0.05,0.15]},
      fx:{reverb:[0.4,0.58], delayBeats:[0.5,0.75], delayFb:[0.25,0.4], delayCut:[2000,3000], pump:[0.33,0.55], crackle:[0.32,0.48], lowcut:[140,220], highcut:[2600,3400], comp:[0.45,0.67], grit:[0,0.15]},
      found:{role:"bed", vol:[0.18,0.3], pitch:[0.8,0.95], stretch:[0.45,0.6], cutoff:[2400,3800], sources:["pool:voices*2","pool:room*1"]},
      vocSource:"vx_sv_speech",
      hits:{sources:["vx_sv_march","vx_sv_radio"], pattern:"sparse", prob:0.5},
      stab:["off","sparse"],
      form:"pop" },
    /* /genre-tool:moldcore:genres */
    /* genre-tool:hydracore:genres */
    hydracore: { label:"Headcount Error", info:"A tribal kit at 174-182. Saw synth bass under a saw synth pad, with a pluck lead. An uplifting cadence, a light shuffle, quantized tight, euclidean hats.",
      bpm:[174,182],
      swing:[0.022,0.072],
      humanize:[0.009,0.099],
      progressions:["uplift","epic_min","sad_pop","synthwave"],
      kits:["tribal","breaks"],
      fills:["drum fill","tom fill","off"],
      euclid:{kick:[5,16]},
      bass:{patterns:["root","simple","off"], recipe:{model:["saw","sub"], cutoff:[400,700], res:[0.05,0.15], level:[0.8,1], send:[0.1,0.2], dsend:[0,0.08]}},
      lead:{patterns:["off","off","sparse","pentaup"], recipe:{model:["pluck","fm"], wave:"sine", voices:[3,5], spread:[0.002,0.005], cutoff:[1600,2800], level:[0.5,0.62], send:[0.3,0.5], dsend:[0.3,0.5], octave:0, attack:0.003, release:[0.05,0.09], sustain:[0.5,0.62], fenv:[0.5,0.8]}},   // MUSICALITY balance loop 1 (buried-lead template class): level [0.3,0.42]->[0.5,0.62], the standbylightdrive calibration — same mechanism, pluck/fm template lead sampled-by-default under a heavy mix. Matrix unmoved (level is not a verifier feature).
      pads:{prob:0.25, recipe:{model:["saw","organ"], wave:"saw", cutoff:[500,850], detune:[0.005,0.012], attack:[2,3.5], level:[0.3,0.42], send:[0.45,0.65], dsend:[0.15,0.3]}},
      drums:{kickModel:["808","boom"], snareModel:["crack"], hatModel:["noise"], kick:[1.1,1.3], snare:[0.7,0.95], hat:[0.9,1.2], tune:[1.05,1.2], send:[0.1,0.2], dsend:[0.1,0.25]},
      fx:{reverb:[0.71,0.89], delayBeats:[0.5,0.75], delayFb:[0.25,0.4], delayCut:[2200,3400], pump:[0.06,0.28], crackle:[0.03,0.19], lowcut:[25,40], highcut:[0,0], comp:[0.29,0.51]},
      found:{role:"chops", vol:[0.1,0.18], pitch:[0.95,1.15], stretch:[0.4,0.6], cutoff:[2500,4000], sources:["shibuya","tokyo_station","vx_suspense"]},
      hits:{sources:["pool:vocal_stab*1","sp_rhythm"], pattern:"sparse", prob:0.4},
      stab:["off"],
      form:"throughline" },
    /* /genre-tool:hydracore:genres */
    /* genre-tool:ashfunk:genres */
    ashfunk: { label:"Pyroclastic Slink", info:"A tribal kit at 95-103. Saw synth bass under a saw synth pad, with a pluck lead. A hijaz maqam, swung, euclidean hats.",
      bpm:[95,103],
      swing:[0.107,0.157],
      humanize:[0.195,0.285],
      progressions:["hijaz","hijaz","andalusian","mode_phrygian"],
      kits:["tribal","breaks"],
      fills:["drum fill","tom fill","off"],
      euclid:{kick:[5,16]},
      bass:{patterns:["root","simple","octaves"], recipe:{model:["saw","sub"], cutoff:[450,750], res:[0.08,0.16], level:[0.95,1.15], send:[0.05,0.12], dsend:[0,0.06]}},
      lead:{patterns:["off","sparse","pentaup"], recipe:{model:["pluck","fm"], wave:"sine", voices:[1,3], spread:[0.002,0.005], cutoff:[1800,2800], level:[0.5,0.62], send:[0.25,0.4], dsend:[0.25,0.4], attack:0.003, release:[0.06,0.1], sustain:[0.5,0.62]}},   // MUSICALITY balance loop 1 (buried-lead template class): level [0.3,0.42]->[0.5,0.62], the standbylightdrive calibration — same mechanism, pluck/fm template lead sampled-by-default under a heavy mix. Matrix unmoved (level is not a verifier feature).
      pads:{prob:0.25, recipe:{model:["saw","organ"], wave:"saw", cutoff:[600,1000], detune:[0.005,0.012], attack:[1,2.5], level:[0.3,0.42], send:[0.3,0.45], dsend:[0.1,0.2]}},
      drums:{kickModel:["808","boom"], snareModel:["crack"], hatModel:["noise"], kick:[1.1,1.3], snare:[0.7,0.95], hat:[0.9,1.2], tune:[1.05,1.2], send:[0.1,0.2], dsend:[0.1,0.25]},
      fx:{reverb:[0.39,0.57], delayBeats:[0.5,0.75], delayFb:[0.25,0.4], delayCut:[2200,3400], pump:[0,0.15], crackle:[0.28,0.44], lowcut:[25,40], highcut:[2600,3400], comp:[0.26,0.48]},
      found:{role:"break", vol:[0.32,0.45], pitch:[1,1], stretch:[0.5,0.5], cutoff:[6000,9000], sources:["amen_165","amen_170","amen_172","amen_175"]},
      hits:{sources:["pool:vocal_stab*1","sp_rhythm"], pattern:"sparse", prob:0.4},
      stab:["off"],
      form:"pop" },
    /* /genre-tool:ashfunk:genres */
    /* genre-tool:steamdub:genres */
    steamdub: { label:"Autoclave Lullaby", info:"A pulse kit at 78-86. Sub bass under ahh choir, with french horns. A descending minor run, a light shuffle.",
      bpm:[78,86],
      swing:[0.033,0.083],
      humanize:[0.194,0.284],
      progressions:["minor_run","house_min","deep_two"],
      kits:["pulse","four"],
      fills:["riser","tom fill","downlift"],
      bass:{patterns:["stab","dub","sub"], recipe:{model:["sub","reese","saw"], cutoff:[420,780], res:[0.15,0.3], level:[1,1.2], send:[0,0.08], dsend:[0.05,0.15]}},
      lead:{patterns:["wander","updown","pentaup"], patchPool:["HORNS","BRASSHORNS"], samplerPool:["french_horns"], recipe:{model:["brass","dx7","sampler","sampler"], wave:"sine", voices:[2,4], spread:[0.002,0.005], cutoff:[1500,2600], level:[0.36,0.5], send:[0.55,0.78], dsend:[0.3,0.5], vibrato:[0.004,0.01]}},
      pads:{prob:1, samplerPool:["ahh_choir"], recipe:{model:["vp330","vp330","vp330","choir","strings","sampler"], wave:"saw", cutoff:[700,1300], detune:[0.006,0.014], attack:[2.5,4.5], vowel:[0.4,0.5], ensemble:[0.9,1], mellotron:true, level:[0.62,0.82], send:[0.6,0.82], dsend:[0.15,0.3]}},
      drums:{kickModel:["boom","909"], snareModel:["noise","clap"], hatModel:["noise"], kick:[1.1,1.3], snare:[0.7,0.95], hat:[0.6,0.9], tune:[0.9,1.05], send:[0.2,0.35], dsend:[0.05,0.15]},
      fx:{reverb:[0.87,1], delayBeats:[0.5,0.75], delayFb:[0.25,0.4], delayCut:[2000,3000], pump:[0.05,0.27], crackle:[0.09,0.25], lowcut:[140,220], highcut:[2600,3400], comp:[0.45,0.67], grit:[0,0.15]},
      found:{role:"bed", vol:[0.18,0.3], pitch:[0.8,0.95], stretch:[0.45,0.6], cutoff:[2400,3800], sources:["pool:voices*2","pool:room*1"]},
      vocSource:"vx_sv_speech",
      hits:{sources:["vx_sv_march","vx_sv_radio"], pattern:"sparse", prob:0.5},
      stab:["off","sparse"],
      form:"pop" },
    /* /genre-tool:steamdub:genres */
    /* genre-tool:seraphswing:genres */
    seraphswing: { label:"Ophanim Jitterbug", info:"A shuffle at 165-173. Saw synth bass under strings, with a muted trumpet. A descending minor run, hard swing.",
      bpm:[165,173],
      swing:[0.178,0.228],
      humanize:[0.124,0.214],
      progressions:["minor_run","epic_min","sad_pop","four_chords"],
      kits:["shuffle","four"],
      fills:["off","drum fill","kit fill"],
      bass:{patterns:["rolling","stab","melodic","syncopated"], patchPool:["SYN-BASS 2"], recipe:{model:["saw","sub","dx7"], cutoff:[380,700], res:[0.15,0.3], level:[1,1.2], send:[0,0.08], dsend:[0,0.05]}},
      lead:{patterns:["sparse","wander","off"], patchPool:["E.PIANO 2"], samplerPool:["muted_trumpet","tenor_sax"], recipe:{model:["fm","dx7","sampler","sampler"], wave:"sine", voices:[3,5], spread:[0.002,0.006], cutoff:[1800,3000], level:[0.4,0.52], send:[0.4,0.6], dsend:[0.3,0.5], vibrato:[0.004,0.01], octave:0.08, attack:0.05, release:[0.3,0.45], sustain:[0.78,0.88], fenv:[0.2,0.4]}},
      pads:{prob:0.85, samplerPool:["strings"], recipe:{model:["fm","strings","sampler"], wave:"sine", cutoff:[800,1400], detune:[0.004,0.01], attack:[1,2.5], level:[0.5,0.68], send:[0.45,0.65], dsend:[0.15,0.3]}, inserts:{prob:0.35, max:1, pool:[["phaser",{rate:[0.06,0.18], depth:[0.4,0.6], mix:[0.3,0.5]}]]}},
      drums:{kickModel:["boom"], snareModel:["noise","crack"], hatModel:["noise"], kick:[0.9,1.15], snare:[0.65,0.9], hat:[0.7,1], tune:[0.95,1.1], send:[0.12,0.24], dsend:[0.05,0.15], kit:"acoustic"},
      fx:{reverb:[0.67,0.85], delayBeats:[0.5,0.75], delayFb:[0.15,0.3], delayCut:[2200,3400], pump:[0.02,0.24], crackle:[0.05,0.21], lowcut:[20,35], highcut:[0,0], comp:[0.37,0.59]},
      found:{role:"bed", vol:[0.14,0.24], pitch:[0.7,0.9], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:city*1","pool:road*1","pool:voices*1"]},
      hits:{sources:["bb_horn_a","bb_horn_b","bb_stab_a"], pattern:"offbeat", prob:0.6},
      stab:["offbeat","rave"],
      form:"pop" },
    /* /genre-tool:seraphswing:genres */
    /* genre-tool:androidlament:genres */
    androidlament: { label:"Decommission Hymn", info:"A bare kick at 58-70. Sub bass with brass on both pad and lead. Dream changes, straight time, rubato.",
      bpm:[58,70],
      swing:[0,0.03],
      humanize:[0.15,0.3],
      progressions:["dream","epic_min","frost","mediant"],
      kits:["off","kick"],
      fills:["off"],
      bass:{patterns:["pedal","root"], recipe:{model:["sub","saw"], cutoff:[400,700], res:[0.05,0.15], level:[0.9,1.1], send:[0.05,0.15], dsend:[0,0.05]}},
      lead:{patterns:["wander","anthem","sparse"], patchPool:["BRASS   2","BR TRUMPET"], recipe:{model:["brass","brass","modeld","dx7"], wave:"saw", voices:[1,2], spread:[0.002,0.006], cutoff:[1600,2800], glide:[120,260], envAmount:[0.6,1.2], envDecay:[0.3,0.6], oscMix:[0.2,0.5], drift:[4,9], vibrato:[0.005,0.012], attack:0.15, release:[0.5,0.9], sustain:[0.85,0.95], level:[0.5,0.62], send:[0.5,0.7], dsend:[0.25,0.4]}},
      pads:{prob:1, recipe:{model:["brass","vp330","choir","strings"], wave:"saw", cutoff:[800,1500], detune:[0.006,0.012], attack:[1.5,3], vowel:[0.2,0.4], ensemble:[0.5,0.7], level:[0.6,0.78], send:[0.55,0.75], dsend:[0.1,0.25]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.5,0.75], snare:[0.3,0.5], hat:[0.2,0.4], tune:[0.85,1], send:[0.4,0.6], dsend:[0,0.1]},
      fx:{reverb:[0.85,0.95], delayBeats:[0.75,1.5], delayFb:[0.2,0.35], delayCut:[1800,2800], pump:[0,0], crackle:[0,0.08], lowcut:[25,40], highcut:[0,0], comp:[0.1,0.25]},
      found:{role:"bed", vol:[0.1,0.18], pitch:[0.6,0.75], stretch:[0.5,0.65], cutoff:[1200,2000], sources:["pool:road*1","pool:voices*1","pool:industry*1"]},
      rubato:{depth:[0.015,0.03], periodBars:[2,4], prob:1},
      hits:{sources:["pool:vb_cosmic_space*1","vx_apollo","sp_nightdrive"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"throughline",
      reverbColor:"greyhole",
      theory:{adventure:[0.117,0.227], color:[0.233,0.433], voicing:"open", reharm:true},
      rhythm:[0.025,0.115],
      pipes:[{id:"densityArc", w:0.4, floor:0.6},{id:"harmonize", w:0.45, prob:0.35},{id:"sweepArc", w:0.45, lo:0.7, hi:2}] },
    /* /genre-tool:androidlament:genres */
    /* genre-tool:lasertemple:genres */
    lasertemple: { label:"Collimated Chapel", info:"A pulse kit at 108-116. Saw synth bass under a string machine pad, with a phase-distortion lead. A descending minor run, straight time.",
      bpm:[108,116],
      swing:[0,0.04],
      humanize:[0.03,0.1],
      progressions:["minor_run","epic_min","sad_pop"],
      kits:["pulse","four","electro"],
      fills:["sweep","riser","off"],
      bass:{patterns:["sixteenths","octaves","drive"], recipe:{model:["saw","modeld"], cutoff:[650,1000], res:[0.15,0.3], level:[1.05,1.25], send:[0,0.08], dsend:[0,0.05], glide:[10,25], envAmount:[1,2], envDecay:[0.08,0.15], oscMix:[0.2,0.5], drift:[2,6]}},
      lead:{patterns:["arpup","arp16","arpdown","updown"], recipe:{model:["casiocz","casiocz","stack","ppg"], wave:"saw", voices:[2,4], spread:[0.005,0.01], cutoff:[2800,4000], level:[0.46,0.58], send:[0.35,0.5], dsend:[0.3,0.45], attack:0.005, release:[0.1,0.18], sustain:[0.6,0.72], fenv:[0.3,0.5], envDecay:[0.1,0.2]}, inserts:{prob:0.5, max:1, pool:[["phaser",{rate:[0.15,0.4], depth:[0.5,0.8], mix:[0.4,0.6]}]]}},
      pads:{prob:1, recipe:{model:["solina","solina","ppg","saw"], wave:"saw", cutoff:[1200,2000], detune:[0.008,0.015], attack:[1,2.2], ensemble:[0.7,0.9], octave:[0.4,0.6], level:[0.55,0.72], send:[0.45,0.6], dsend:[0.15,0.3]}},
      drums:{kickModel:["909","boom"], snareModel:["noise","clap"], hatModel:["metal","noise"], kick:[1.05,1.25], snare:[0.6,0.85], hat:[0.7,1], tune:[0.95,1.1], send:[0.3,0.45], dsend:[0.05,0.15]},
      fx:{reverb:[0.6,0.75], delayBeats:[0.375,0.75], delayFb:[0.3,0.45], delayCut:[2500,3800], pump:[0.08,0.2], crackle:[0,0.1], lowcut:[30,45], highcut:[0,0], comp:[0.25,0.4]},
      found:{role:"bed", vol:[0.08,0.15], pitch:[0.7,0.9], stretch:[0.45,0.6], cutoff:[1800,3000], sources:["vx_wwvh","pool:voices*2"]},
      hits:{sources:["pool:vb_cosmic_space*1","vx_wwvh","pool:rave_stab*1"], pattern:"sparse", prob:0.25},
      stab:["off","sparse"],
      form:"ritual",
      reverbColor:"dattorro",
      theory:{adventure:[0.1,0.207], color:[0.133,0.3], voicing:"close", reharm:true},
      rhythm:[0.153,0.313],
      pipes:[{id:"sweepArc", w:0.45, lo:0.7, hi:2},{id:"vibratoSwell", w:0.4, depth:0.25}] },
    /* /genre-tool:lasertemple:genres */
    /* genre-tool:oscillatorminuet:genres */
    oscillatorminuet: { label:"Voltage Curtsy", info:"A bare kick at 84-92. Minimoog lead bass under strings, with a Minimoog lead. A canon, straight time, rubato.",
      bpm:[84,92],
      swing:[0,0.03],
      humanize:[0.06,0.15],
      progressions:["canon","ii_v_i","pop_1625"],
      kits:["off","kick","open"],
      fills:["off"],
      bass:{patterns:["walking","melodic","simple"], recipe:{model:["modeld","saw"], cutoff:[500,850], res:[0.1,0.2], level:[0.95,1.15], send:[0.05,0.15], dsend:[0,0.05], glide:[8,18], envAmount:[0.8,1.5], envDecay:[0.1,0.2], oscMix:[0.3,0.6], drift:[2,5]}},
      lead:{patterns:["canon","fugue","composed","arpup"], recipe:{model:["modeld","modeld","casiocz"], wave:"saw", voices:[1,2], spread:[0.001,0.004], cutoff:[2400,3600], glide:[10,25], envAmount:[1.2,2], envDecay:[0.08,0.15], oscMix:[0.3,0.7], drift:[2,5], level:[0.48,0.6], send:[0.2,0.35], dsend:[0.1,0.25], attack:0.004, release:[0.08,0.15], sustain:[0.55,0.7], fenv:[0.3,0.55]}},
      pads:{prob:0.4, recipe:{model:["strings","solina"], wave:"saw", cutoff:[1000,1700], detune:[0.004,0.009], attack:[0.8,1.8], ensemble:[0.5,0.7], level:[0.35,0.5], send:[0.25,0.4], dsend:[0.05,0.15]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.6,0.85], snare:[0.4,0.6], hat:[0.4,0.65], tune:[0.9,1.05], send:[0.15,0.3], dsend:[0,0.08]},
      fx:{reverb:[0.25,0.4], delayBeats:[0.5,0.75], delayFb:[0.1,0.2], delayCut:[3000,4500], pump:[0,0], crackle:[0.05,0.2], lowcut:[30,50], highcut:[0,0], comp:[0.15,0.3]},
      found:{role:"bed", vol:[0.04,0.09], pitch:[0.8,1], stretch:[0.45,0.6], cutoff:[2000,3200], sources:["crt_whine","pool:voices*1"]},
      rubato:{depth:[0.008,0.018], periodBars:[2,4], prob:0.4},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.08},
      stab:["off"],
      form:"suite",
      reverbColor:"fdn",
      theory:{adventure:[0.217,0.373], color:[0.383,0.6], voicing:"close", reharm:true},
      rhythm:[0.05,0.16],
      pipes:[{id:"echoCanon", w:0.55, prob:0.45, delay:2},{id:"sweepArc", w:0.45, lo:0.7, hi:2},{id:"vibratoSwell", w:0.4, depth:0.25}] },
    /* /genre-tool:oscillatorminuet:genres */
    /* genre-tool:cometwhistle:genres */
    cometwhistle: { label:"Perihelion Aria", info:"AN open kit at 72-82. Sub bass under strings, with a Minimoog lead. Dream changes, straight time, rubato.",
      bpm:[72,82],
      swing:[0,0.04],
      humanize:[0.12,0.25],
      progressions:["dream","mode_lydian"],
      kits:["off","open","kick"],
      fills:["off","sweep"],
      bass:{patterns:["pedal","simple"], recipe:{model:["sub","modeld"], cutoff:[350,600], res:[0.08,0.18], level:[0.9,1.1], send:[0.05,0.15], dsend:[0,0.05], glide:[40,90], envAmount:[0.4,0.9], envDecay:[0.2,0.4], oscMix:[0.1,0.4], drift:[3,7]}},
      lead:{patterns:["wander","composed","sparse"], recipe:{model:["modeld","modeld","sine"], wave:"sine", voices:[1,2], spread:[0.001,0.003], cutoff:[2400,3800], octave:0.2, glide:[100,220], vibrato:[0.008,0.016], envAmount:[0.3,0.8], envDecay:[0.3,0.6], oscMix:[0.05,0.25], drift:[3,7], attack:0.03, release:[0.3,0.5], sustain:[0.85,0.95], level:[0.45,0.58], send:[0.5,0.7], dsend:[0.3,0.45]}},
      pads:{prob:1, recipe:{model:["strings","choir","vp330","ppg"], wave:"saw", cutoff:[900,1600], detune:[0.005,0.011], attack:[1.5,3], vowel:[0.2,0.45], ensemble:[0.5,0.7], level:[0.55,0.72], send:[0.5,0.7], dsend:[0.1,0.25]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.55,0.8], snare:[0.35,0.55], hat:[0.3,0.5], tune:[0.85,1], send:[0.35,0.55], dsend:[0,0.1]},
      fx:{reverb:[0.75,0.9], delayBeats:[0.75,1.5], delayFb:[0.3,0.45], delayCut:[2000,3200], pump:[0,0.08], crackle:[0,0.1], lowcut:[25,40], highcut:[0,0], comp:[0.1,0.25]},
      found:{role:"bed", vol:[0.1,0.18], pitch:[0.65,0.85], stretch:[0.5,0.65], cutoff:[1500,2500], sources:["hydrophone","pool:voices*1"]},
      rubato:{depth:[0.012,0.028], periodBars:[2,4], prob:1},
      hits:{sources:["pool:vb_cosmic_space*1","vx_apollo"], pattern:"sparse", prob:0.1},
      stab:["off"],
      form:"wave",
      theory:{adventure:[0.175,0.315], color:[0.4,0.625], voicing:"quartal", reharm:true},
      rhythm:[0.05,0.16],
      pipes:[{id:"densityArc", w:0.4, floor:0.6},{id:"harmonize", w:0.45, prob:0.35},{id:"sweepArc", w:0.45, lo:0.7, hi:2}] },
    /* /genre-tool:cometwhistle:genres */
    /* genre-tool:chromepiston:genres */
    chromepiston: { label:"Camshaft Litany", info:"A four-on-the-floor at 118-126. Minimoog lead bass under an Oberheim pad, with a Minimoog lead. A two-chord vamp, straight time, quantized tight.",
      bpm:[118,126],
      swing:[0,0.03],
      humanize:[0,0.08],
      progressions:["deep_two","house_min","minor_run"],
      kits:["four"],
      fills:["hat rush","riser","tom fill"],
      bass:{patterns:["octaves","sixteenths"], recipe:{model:["modeld","saw"], cutoff:[600,1000], res:[0.15,0.28], level:[1.1,1.3], send:[0,0.06], dsend:[0,0.05], glide:[8,20], envAmount:[1.5,2.5], envDecay:[0.05,0.1], oscMix:[0.3,0.6], drift:[1,4]}},
      lead:{patterns:["double","arpup","hero"], recipe:{model:["modeld","saw","stack"], wave:"saw", voices:[1,3], spread:[0.004,0.01], cutoff:[2600,3800], glide:[10,25], envAmount:[1.5,2.5], envDecay:[0.05,0.12], oscMix:[0.3,0.6], drift:[1,4], level:[0.45,0.58], send:[0.25,0.4], dsend:[0.2,0.35], attack:0.003, release:[0.06,0.12], sustain:[0.5,0.65], fenv:[0.4,0.6]}},
      pads:{prob:0.6, recipe:{model:["oberheim","saw"], wave:"saw", cutoff:[1200,2000], detune:[0.008,0.015], attack:[0.6,1.4], filterMode:[0.2,0.5], level:[0.45,0.6], send:[0.3,0.45], dsend:[0.1,0.2]}},
      drums:{kickModel:["909"], snareModel:["clap","noise"], hatModel:["noise"], kick:[1.25,1.45], snare:[0.85,1.1], hat:[1,1.3], tune:[0.95,1.05], send:[0.15,0.3], dsend:[0.05,0.12]},
      fx:{reverb:[0.35,0.5], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[3000,4200], pump:[0.35,0.55], crackle:[0.05,0.15], lowcut:[30,45], highcut:[0,0], comp:[0.4,0.6]},
      found:{role:"bed", vol:[0.05,0.1], pitch:[0.75,0.9], stretch:[0.45,0.6], cutoff:[1500,2500], sources:["pool:industry*1","pool:road*1"]},
      hits:{sources:["pool:vb_industrial_machine*1","pool:vocal_stab*1","pool:rave_stab*1","sp_nightdrive"], pattern:"offbeat", prob:0.35},
      stab:["off","offbeat"],
      form:"dj",
      masterComp:0.3,
      theory:{adventure:[0.067,0.16], color:[0.167,0.333], voicing:"close", reharm:false},
      rhythm:[0.08,0.22],
      pipes:[{id:"densityArc", w:0.4, floor:0.6},{id:"sweepArc", w:0.45, lo:0.7, hi:2},{id:"vibratoSwell", w:0.4, depth:0.25}] },
    /* /genre-tool:chromepiston:genres */
    /* genre-tool:patchcordmirage:genres */
    patchcordmirage: { label:"Zeno's Corridor", info:"A pulse kit at 94-102. Minimoog lead bass under choir, with a Minimoog lead. A two-chord minor drone, straight time, one chord every 16 beats.",
      bpm:[94,102],
      swing:[0,0.03],
      humanize:[0.02,0.1],
      progressions:["drone_min","deep_two","mode_dorian"],
      kits:["pulse","open"],
      fills:["off","riser","sweep"],
      chordEvery:16,
      bass:{patterns:["sixteenths","rolling","pedal"], recipe:{model:["modeld","saw"], cutoff:[550,900], res:[0.2,0.35], level:[1.05,1.25], send:[0.02,0.08], dsend:[0,0.06], glide:[12,30], envAmount:[1.2,2.2], envDecay:[0.08,0.16], oscMix:[0.3,0.7], drift:[3,7]}},
      lead:{patterns:["arp16","motorik","arpup","updown"], recipe:{model:["modeld","modeld","stack","ppg"], wave:"saw", voices:[1,2], spread:[0.002,0.006], cutoff:[2000,3200], res:[0.25,0.4], glide:[15,35], envAmount:[1,1.8], envDecay:[0.12,0.25], oscMix:[0.3,0.7], drift:[4,9], level:[0.46,0.58], send:[0.35,0.5], dsend:[0.35,0.5], attack:0.004, release:[0.1,0.16], sustain:[0.6,0.72], fenv:[0.35,0.6]}, inserts:{prob:0.4, max:1, pool:[["phaser",{rate:[0.08,0.25], depth:[0.5,0.75], mix:[0.35,0.55]}]]}},
      pads:{prob:1, recipe:{model:["choir","solina","oberheim","ppg"], wave:"saw", cutoff:[900,1600], detune:[0.006,0.012], attack:[1.5,3], ensemble:[0.55,0.75], filterMode:[0,0.3], level:[0.5,0.68], send:[0.45,0.6], dsend:[0.1,0.25]}},
      drums:{kickModel:["boom","909"], snareModel:["noise"], hatModel:["noise"], kick:[0.9,1.1], snare:[0.5,0.75], hat:[0.6,0.9], tune:[0.9,1.05], send:[0.2,0.35], dsend:[0.05,0.12]},
      fx:{reverb:[0.65,0.8], delayBeats:[0.5,0.75], delayFb:[0.35,0.5], delayCut:[2200,3400], pump:[0,0.12], crackle:[0.05,0.18], lowcut:[28,42], highcut:[0,0], comp:[0.2,0.35]},
      found:{role:"bed", vol:[0.1,0.18], pitch:[0.7,0.85], stretch:[0.5,0.65], cutoff:[1600,2600], sources:["pool:voices*2","pool:road*1"]},
      hits:{sources:["vx_conet_poacher","sp_herenow"], pattern:"sparse", prob:0.2},
      stab:["off"],
      form:"dj",
      theory:{adventure:[0.067,0.15], color:[0.183,0.383], voicing:"open", reharm:false},
      rhythm:[0.09,0.235],
      pipes:[{id:"octavePump", w:0.5, prob:0.4},{id:"densityArc", w:0.4, floor:0.6},{id:"sweepArc", w:0.45, lo:0.7, hi:2}] },
    /* /genre-tool:patchcordmirage:genres */
    /* genre-tool:velourregatta:genres */
    velourregatta: { label:"Marina Heat Death", info:"A full kit at 100-108. FM lead bass with an FM lead on both pad and lead. An uplifting cadence, a light shuffle.",
      bpm:[100,108],
      swing:[0.04,0.1],
      humanize:[0.05,0.15],
      progressions:["uplift","neosoul","pop_1625"],
      kits:["full","open","four"],
      fills:["tom fill","tom fill","drum fill"],
      bass:{patterns:["syncopated","root","simple"], patchPool:["BASS    1","E.BASS  2"], recipe:{model:["dx7","saw"], cutoff:[600,950], res:[0.08,0.18], level:[1,1.2], send:[0.02,0.08], dsend:[0,0.05]}},
      lead:{patterns:["pentaup","composed","hero","sparse"], patchPool:["MARIMBA","E.PIANO 1","VIBE    1"], recipe:{model:["dx7","dx7","dx7","rhodes","stack"], wave:"sine", voices:[1,2], spread:[0.002,0.006], cutoff:[2800,4000], level:[0.46,0.58], send:[0.35,0.5], dsend:[0.2,0.35], vibrato:[0,0.004], attack:0.005, release:[0.15,0.3], sustain:[0.7,0.82]}, inserts:{prob:0.4, max:1, pool:[["chorus",{rate:[0.5,1], depth:[0.4,0.6], mix:[0.35,0.5]}]]}},
      pads:{prob:0.9, patchPool:["SYN-VOX","STRG ENS 1","E.PIANO 2"], recipe:{model:["dx7","juno60","rhodes"], wave:"saw", cutoff:[1200,2000], detune:[0.006,0.012], attack:[0.8,1.8], chorus:[1.2,1.6], chorusSpread:[0.8,1], level:[0.5,0.65], send:[0.35,0.5], dsend:[0.1,0.2]}},
      drums:{kickModel:["909","boom"], snareModel:["noise","clap"], hatModel:["noise"], kick:[1.1,1.3], snare:[1,1.25], hat:[0.6,0.9], tune:[0.9,1.05], send:[0.45,0.65], dsend:[0.05,0.15]},
      fx:{reverb:[0.55,0.7], delayBeats:[0.375,0.5], delayFb:[0.15,0.3], delayCut:[3200,4500], pump:[0.08,0.22], crackle:[0,0.08], lowcut:[35,50], highcut:[0,0], comp:[0.35,0.55]},
      found:{role:"bed", vol:[0.04,0.09], pitch:[0.85,1], stretch:[0.45,0.55], cutoff:[2000,3200], sources:["pool:city*1","pool:road*1"]},
      hits:{sources:["pool:vocal_stab*1","sp_herenow"], pattern:"sparse", prob:0.3},
      stab:["off","sparse"],
      form:"aaba",
      reverbColor:"dattorro",
      theory:{adventure:[0.183,0.323], color:[0.317,0.533], voicing:"close", reharm:true},
      rhythm:[0.1,0.257],
      pipes:[{id:"harmonize", w:0.45, prob:0.35},{id:"sweepArc", w:0.45, lo:0.7, hi:2},{id:"vibratoSwell", w:0.4, depth:0.25}] },
    /* /genre-tool:velourregatta:genres */
    /* genre-tool:sorcerercape:genres */
    sorcerercape: { label:"Grimoire Cadenza", info:"A full kit at 138-148. Minimoog lead bass with a Hammond on both pad and lead. Royal-road changes, a light shuffle.",
      bpm:[138,148],
      swing:[0,0.06],
      humanize:[0.08,0.2],
      progressions:["royal_road","mode_lydian","minor_run"],
      kits:["full","open","shuffle"],
      fills:["drum fill","tom fill","snare roll"],
      bass:{patterns:["drive","melodic","octaves"], recipe:{model:["modeld","saw"], cutoff:[600,950], res:[0.12,0.25], level:[1.05,1.25], send:[0.02,0.08], dsend:[0,0.05], glide:[15,35], envAmount:[1,1.8], envDecay:[0.1,0.2], oscMix:[0.3,0.7], drift:[3,7]}},
      lead:{patterns:["hero","canon","updown","arp16"], recipe:{model:["hammond","organ","modeld","stack"], wave:"square", voices:[1,2], spread:[0.002,0.006], cutoff:[2600,3800], leslie:[0.7,0.9], perc:[0.4,0.7], glide:[20,50], envAmount:[1,1.8], envDecay:[0.1,0.2], oscMix:[0.3,0.6], drift:[3,7], level:[0.5,0.62], send:[0.3,0.45], dsend:[0.2,0.35], attack:0.004, release:[0.1,0.18], sustain:[0.65,0.8]}},
      pads:{prob:1, recipe:{model:["hammond","strings","choir","organ"], wave:"saw", cutoff:[1000,1800], detune:[0.005,0.011], attack:[0.8,2], leslie:[0.2,0.4], ensemble:[0.5,0.7], level:[0.5,0.68], send:[0.35,0.5], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise","metal"], kick:[1.05,1.3], snare:[0.85,1.1], hat:[0.8,1.1], tune:[0.95,1.1], send:[0.2,0.35], dsend:[0.05,0.12]},
      fx:{reverb:[0.45,0.6], delayBeats:[0.5,0.75], delayFb:[0.15,0.3], delayCut:[2800,4000], pump:[0,0.1], crackle:[0.1,0.25], lowcut:[25,40], highcut:[0,0], comp:[0.3,0.5], grit:[0.05,0.2]},
      found:{role:"bed", vol:[0.06,0.12], pitch:[0.75,0.9], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["vx_suspense","pool:voices*1"]},
      hits:{sources:["vx_suspense","pool:vocal_stab*1"], pattern:"sparse", prob:0.25},
      stab:["off","sparse"],
      form:"anthem",
      theory:{adventure:[0.15,0.29], color:[0.333,0.533], voicing:"quartal", reharm:true},
      rhythm:[0.157,0.333],
      pipes:[{id:"echoCanon", w:0.55, prob:0.45, delay:2},{id:"harmonize", w:0.45, prob:0.35},{id:"sweepArc", w:0.45, lo:0.7, hi:2}] },
    /* /genre-tool:sorcerercape:genres */
    /* genre-tool:wizardcape:genres */
    wizardcape: { label:"Lydian Apotheosis", info:"A breaks kit at 120-130. Picked bass under a church organ, with an overdrive guitar. Lydian, a light shuffle, euclidean hats.",
      bpm:[120,130],
      swing:[0,0.06],
      humanize:[0.1,0.25],
      progressions:["mode_lydian","uplift","epic_min","canon","epic_maj"],
      kits:["breaks","full"],
      fills:["tom fill","riser","drum fill","reverse"],
      euclid:{hat:[9,16]},
      bass:{patterns:["melodic","octaves","drive"], samplerPool:["picked_bass","finger_bass"], recipe:{model:["sampler","saw"], cutoff:[600,1000], res:[0.1,0.2], level:[1,1.2], send:[0.05,0.12], dsend:[0,0.06], attack:0.005, release:[0.08,0.15]}},
      lead:{patterns:["hero","canon","updown","anthem"], samplerPool:["overdrive_guitar","church_organ"], recipe:{model:["sampler","sampler","synclead"], wave:"saw", voices:[1,2], spread:[0.002,0.006], cutoff:[2600,3800], level:[0.46,0.6], send:[0.3,0.5], dsend:[0.15,0.3], attack:0.005, release:[0.1,0.2], sustain:[0.6,0.75]}},
      pads:{prob:0.9, samplerPool:["church_organ","strings","ahh_choir"], recipe:{model:["sampler","sampler","solina"], wave:"saw", cutoff:[1200,2000], detune:[0.004,0.01], attack:[0.6,1.8], level:[0.45,0.6], send:[0.35,0.55], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom","909"], snareModel:["noise","crack"], hatModel:["noise"], kick:[1,1.25], snare:[0.7,0.95], hat:[0.7,1], tune:[0.95,1.05], send:[0.15,0.3], dsend:[0.05,0.15]},
      fx:{reverb:[0.4,0.55], delayBeats:[0.375,0.75], delayFb:[0.2,0.35], delayCut:[2600,3800], pump:[0,0.1], crackle:[0,0.12], lowcut:[25,40], highcut:[0,0], comp:[0.25,0.45]},
      found:{role:"bed", vol:[0.06,0.14], pitch:[0.8,0.95], stretch:[0.45,0.6], cutoff:[1800,3000], sources:["vx_blake","pool:city*1"]},
      counterpoint:{prob:0.35},
      hits:{sources:["bb_horn_a","bb_horn_b","pool:horn_stab*1"], pattern:"response", prob:0.45},
      stab:["off"],
      form:"anthem",
      theory:{adventure:[0.138,0.263], color:[0.2,0.4], voicing:"quartal", reharm:true},
      rhythm:[0.37,0.605],
      pipes:[{id:"echoCanon", w:0.55, prob:0.45, delay:2},{id:"strum", w:0.55, step:0.02},{id:"harmonize", w:0.45, prob:0.35}] },
    /* /genre-tool:wizardcape:genres */
    /* genre-tool:meadowmellotron:genres */
    meadowmellotron: { label:"Pollen Archive", info:"AN open kit at 82-94. Fretless bass under a flute, with a steel string guitar. Dorian, a light shuffle, loose timing, rubato.",
      bpm:[82,94],
      swing:[0,0.08],
      humanize:[0.2,0.4],
      progressions:["mode_dorian","dream","canon","royal_road"],
      kits:["open","kick"],
      fills:["off","tom fill","downlift"],
      chordEvery:8,
      bass:{patterns:["pedal","root","melodic"], samplerPool:["fretless_bass","finger_bass"], recipe:{model:["sampler","sub"], cutoff:[400,750], res:[0.05,0.1], level:[0.9,1.1], send:[0.1,0.2], dsend:[0,0.08], attack:0.008, release:[0.15,0.3]}},
      lead:{patterns:["arp16","arpup","wander","composed"], samplerPool:["steel_string_guitar","nylon_string_guitar","harp"], recipe:{model:["sampler","sampler","kpluck"], wave:"sine", voices:[1,2], spread:[0.001,0.004], cutoff:[2600,3800], level:[0.42,0.56], send:[0.35,0.55], dsend:[0.1,0.25], attack:0.005, release:[0.3,0.55]}, inserts:{prob:0.5, max:1, pool:[["delay",{timeBars:[0.375,0.5], feedback:[0.25,0.4], tone:[2800,3800], wow:[0.15,0.3], mix:[0.3,0.42]}]]}},   // RING-CLASS: the twelve-string arpeggios ring on a dotted-8th tape delay (kpluck synth draw)
      pads:{prob:1, samplerPool:["flute","strings","ahh_choir"], recipe:{model:["sampler","sampler","sampler","strings"], wave:"sine", cutoff:[1000,1700], detune:[0.003,0.007], attack:[0.8,2], release:[1.5,3], swell:1, mellotron:true, sustain:[0.85,0.95], level:[0.42,0.58], send:[0.45,0.65], dsend:[0.05,0.18]}, inserts:{prob:0.5, max:1, pool:[["phaser",{rateBars:[4,8], depth:[0.4,0.6], mix:[0.35,0.55]}]]}},   // RING-CLASS: the tape-flute choir swells phase out of the hedgerow (strings synth draw)
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.6,0.9], snare:[0.45,0.7], hat:[0.4,0.7], tune:[0.95,1.05], send:[0.2,0.35], dsend:[0,0.1], kit:"acoustic"},
      fx:{reverb:[0.5,0.68], delayBeats:[0.5,1], delayFb:[0.15,0.3], delayCut:[2200,3200], pump:[0,0], crackle:[0.05,0.2], lowcut:[0,0], highcut:[0,0], comp:[0,0.2]},
      found:{role:"bed", vol:[0.08,0.16], pitch:[0.8,1], stretch:[0.45,0.6], cutoff:[2000,3200], sources:["pool:nature*2","vx_dickinson"]},
      rubato:{depth:[0.008,0.02], periodBars:[2,4], prob:0.6},
      hits:{sources:["pool:chime*1","ca_loon"], pattern:"sparse", prob:0.2},
      stab:["off"],
      form:"ritual",
      theory:{adventure:[0.163,0.308], color:[0.413,0.638], voicing:"close", reharm:true},
      rhythm:[0.075,0.2],
      pipes:[{id:"strum", w:0.55, step:0.02},{id:"harmonize", w:0.45, prob:0.35}] },
    /* /genre-tool:meadowmellotron:genres */
    /* genre-tool:hexagonstampede:genres */
    hexagonstampede: { label:"Benzene Cavalry", info:"A full kit at 130-136. Minimoog lead bass under a rock organ, with a Hammond. A descending minor run, a light shuffle, euclidean hats.",
      bpm:[130,136],
      swing:[0,0.05],
      humanize:[0.08,0.2],
      progressions:["minor_run","frost","ii_v_i"],
      kits:["full","breaks"],
      fills:["tom fill","snare roll","impact","riser"],
      euclid:{kick:[5,16]},
      bass:{patterns:["drive","walking","octaves"], recipe:{model:["modeld","saw"], cutoff:[500,900], res:[0.12,0.25], level:[1.1,1.3], send:[0.03,0.1], dsend:[0,0.06], glide:[15,35], envAmount:[0.5,1.1], envDecay:[0.2,0.4]}},
      lead:{patterns:["fugue","updown","double","hero"], recipe:{model:["hammond","hammond","modeld"], wave:"saw", voices:[1,2], spread:[0.002,0.006], cutoff:[2400,3600], level:[0.5,0.64], send:[0.25,0.4], dsend:[0.15,0.3], leslie:[0.35,0.6], perc:1, attack:0.004, release:[0.08,0.16], sustain:[0.6,0.75]}, inserts:{prob:0.85, max:1, pool:[["distort",{drive:[0.35,0.6], mix:[0.5,0.75]}]]}},
      pads:{prob:0.6, samplerPool:["rock_organ","brass_section"], recipe:{model:["sampler","hammond","saw"], wave:"saw", cutoff:[900,1500], detune:[0.005,0.011], attack:[0.3,1], leslie:[0.15,0.3], level:[0.42,0.56], send:[0.3,0.45], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom","909"], snareModel:["crack","noise"], hatModel:["noise","metal"], kick:[1.1,1.35], snare:[0.7,0.95], hat:[0.6,0.9], tune:[0.95,1.1], send:[0.15,0.28], dsend:[0.05,0.15]},
      fx:{reverb:[0.35,0.5], delayBeats:[0.375,0.5], delayFb:[0.15,0.3], delayCut:[2400,3600], pump:[0,0.15], crackle:[0,0.1], lowcut:[25,40], highcut:[0,0], comp:[0.3,0.5], grit:[0.2,0.4]},
      found:{role:"bed", vol:[0.06,0.14], pitch:[0.8,0.95], stretch:[0.45,0.6], cutoff:[1800,3000], sources:["pool:industry*1","vx_suspense"]},
      hits:{sources:["gavel","sp_energy"], pattern:"sparse", prob:0.3},
      stab:["off"],
      form:"drop",
      theory:{adventure:[0.2,0.34], color:[0.267,0.45], voicing:"quartal", reharm:true},
      rhythm:[0.37,0.605],
      pipes:[{id:"echoCanon", w:0.55, prob:0.45, delay:2},{id:"sweepArc", w:0.45, lo:0.7, hi:2},{id:"vibratoSwell", w:0.4, depth:0.25}] },
    /* /genre-tool:hexagonstampede:genres */
    /* genre-tool:crimsoncourt:genres */
    crimsoncourt: { label:"Non Euclidean Court", info:"A breaks kit at 106-118. Reese bass under ohh voices, with a distorted lead. Phrygian, straight time, euclidean hats.",
      bpm:[106,118],
      swing:[0,0.04],
      humanize:[0.05,0.18],
      progressions:["mode_phrygian","frost","hijaz","minor_run","quartal"],
      kits:["breaks","halftime","electro"],
      fills:["cut","impact","stutter","noise"],
      euclid:{kick:[5,16], hat:[11,16]},
      bass:{patterns:["stab","syncopated","hemiola"], recipe:{model:["reese","saw"], cutoff:[350,650], res:[0.15,0.3], level:[1.1,1.3], send:[0,0.08], dsend:[0,0.08]}, inserts:{prob:0.5, max:1, pool:[["distort",{drive:[0.4,0.7], mix:[0.6,0.85]}]]}},
      lead:{patterns:["sparse","double","composed"], recipe:{model:["metal","fm","ringmod"], wave:"saw", voices:[1,2], spread:[0.002,0.006], cutoff:[2000,3200], res:[0.2,0.35], level:[0.46,0.58], send:[0.25,0.4], dsend:[0.2,0.35], attack:0.004, release:[0.08,0.18], sustain:[0.4,0.6]}},
      pads:{prob:0.5, samplerPool:["ohh_voices","cello"], recipe:{model:["sampler","strings","choir"], wave:"saw", cutoff:[700,1300], detune:[0.008,0.016], attack:[1.5,3.5], mellotron:true, level:[0.4,0.55], send:[0.4,0.6], dsend:[0.1,0.25]}},
      drums:{kickModel:["909","boom"], snareModel:["crack","noise"], hatModel:["metal","noise"], kick:[1.15,1.4], snare:[0.8,1.05], hat:[0.5,0.8], tune:[0.9,1.05], send:[0.1,0.2], dsend:[0.08,0.2]},
      fx:{reverb:[0.3,0.45], delayBeats:[0.375,0.75], delayFb:[0.2,0.35], delayCut:[2000,3000], pump:[0,0.1], crackle:[0.05,0.18], lowcut:[25,40], highcut:[0,0], comp:[0.35,0.55], grit:[0.3,0.55], jux:[0.15,0.35]},
      found:{role:"bed", vol:[0.1,0.2], pitch:[0.7,0.9], stretch:[0.45,0.6], cutoff:[1600,2800], sources:["pool:industry*1","pool:voices*1","vx_suspense"]},
      hits:{sources:["sp_pressure","vx_conet_poacher"], pattern:"offbeat", prob:0.4},
      stab:["sparse","offbeat"],
      form:"wave",
      theory:{adventure:[0.15,0.255], color:[0.188,0.338], voicing:"quartal", reharm:true},
      rhythm:[0.377,0.613],
      pipes:[{id:"densityArc", w:0.4, floor:0.6},{id:"sweepArc", w:0.45, lo:0.7, hi:2}] },
    /* /genre-tool:crimsoncourt:genres */
    /* genre-tool:moonlagoon:genres */
    moonlagoon: { label:"Tidal Locking", info:"A half-time kit at 66-78. Fretless bass under slow strings, with an overdrive guitar. Dream changes, a light shuffle, rubato.",
      bpm:[66,78],
      swing:[0,0.06],
      humanize:[0.15,0.35],
      progressions:["dream","mode_dorian","drone_min","epic_min","mediant","whole_tone"],
      kits:["halftime","kick","open"],
      fills:["off","downlift","dropout"],
      chordEvery:8,
      bass:{patterns:["root","pedal","simple"], samplerPool:["fretless_bass","finger_bass"], recipe:{model:["sampler","sub"], cutoff:[350,650], res:[0.05,0.12], level:[0.95,1.15], send:[0.08,0.16], dsend:[0,0.06], attack:0.008, release:[0.15,0.3]}},
      lead:{patterns:["sparse","wander","blues"], samplerPool:["overdrive_guitar","clean_guitar"], recipe:{model:["sampler","sampler","guitar"], wave:"sine", voices:[1,1], spread:[0.001,0.003], cutoff:[2200,3400], level:[0.46,0.6], send:[0.55,0.72], dsend:[0.35,0.55], vibrato:[0.01,0.018], vibRate:[4.5,5.5], attack:[0.02,0.06], release:[0.5,0.9], sustain:[0.85,0.95]}, inserts:{prob:0.6, max:1, pool:[["delay",{timeBars:[0.5,0.75], feedback:[0.35,0.45], tone:[2600,3600], wow:[0.2,0.3], mix:[0.32,0.45]}]]}},   // RING-CLASS: echoes stacked to the horizon — the guitar-draw slow tape delay (samplers render dry via constrain)
      pads:{prob:1, samplerPool:["slow_strings","ahh_choir","atmosphere"], recipe:{model:["sampler","sampler","solina","choir"], wave:"saw", cutoff:[800,1400], detune:[0.006,0.012], attack:[2,4], release:[2,4], swell:1, sustain:[0.85,0.95], level:[0.5,0.68], send:[0.6,0.78], dsend:[0.15,0.3]}, inserts:{prob:0.6, max:1, pool:[["phaser",{rateBars:[4,8], depth:[0.5,0.7], mix:[0.4,0.6]}]]}},   // RING-CLASS: weather-wide pad phasing in and out (fires on the solina/choir synth draws)
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.8,1.05], snare:[0.5,0.75], hat:[0.4,0.7], tune:[0.9,1], send:[0.25,0.4], dsend:[0.1,0.25], kit:"acoustic"},
      fx:{reverb:[0.6,0.8], delayBeats:[0.75,1.5], delayFb:[0.4,0.6], delayCut:[2400,3600], pump:[0,0], crackle:[0.05,0.18], lowcut:[0,25], highcut:[0,0], comp:[0.1,0.3]},
      found:{role:"bed", vol:[0.12,0.22], pitch:[0.7,0.9], stretch:[0.45,0.6], cutoff:[1600,2800], sources:["pool:water*1","pool:voices*1","pool:road*1"]},
      rubato:{depth:[0.006,0.015], periodBars:[2,4], prob:0.4},
      hits:{sources:["pool:vb_maritime_weather*1","vx_timelady","pool:chime*1"], pattern:"sparse", prob:0.2},
      stab:["off"],
      form:"storm",
      blueNote:0.35,
      timeFeel:{pushPull:{bass:0.02, snare:0.012}},
      theory:{adventure:[0.112,0.218], color:[0.25,0.463], voicing:"close", reharm:true},
      rhythm:[0.1,0.25],
      pipes:[{id:"callResponse", w:0.5, level:0.85},{id:"strum", w:0.55, step:0.02},{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:moonlagoon:genres */
    /* genre-tool:sliderule:genres */
    sliderule: { label:"Logarithm Drill", info:"A breaks kit at 140-152. Minimoog lead bass with an Oberheim pad on both pad and lead. Mixolydian, straight time, quantized tight, euclidean hats.",
      bpm:[140,152],
      swing:[0,0.03],
      humanize:[0,0.1],
      progressions:["mode_mixo","epic_min","uplift"],
      kits:["breaks","full","four"],
      fills:["tom fill","hat rush","snare roll","riser"],
      euclid:{hat:[11,16]},
      bass:{patterns:["syncopated","sixteenths","melodic"], recipe:{model:["modeld","reese"], cutoff:[450,800], res:[0.15,0.3], level:[1.15,1.35], send:[0,0.08], dsend:[0,0.06], glide:[10,25], envAmount:[0.6,1.2], envDecay:[0.15,0.3]}},
      lead:{patterns:["motorik23","hero","anthem","updown"], recipe:{model:["oberheim","stack","synclead"], wave:"saw", voices:[2,3], spread:[0.004,0.01], cutoff:[2800,4000], level:[0.48,0.62], send:[0.25,0.4], dsend:[0.2,0.35], attack:0.004, release:[0.08,0.15], sustain:[0.55,0.7]}},
      pads:{prob:0.7, recipe:{model:["oberheim","juno60","saw"], wave:"saw", cutoff:[1200,2000], detune:[0.006,0.012], attack:[0.4,1.2], level:[0.44,0.58], send:[0.3,0.45], dsend:[0.1,0.2]}},
      drums:{kickModel:["909","boom"], snareModel:["crack","noise"], hatModel:["metal","noise"], kick:[1.2,1.45], snare:[0.85,1.1], hat:[0.8,1.15], tune:[0.95,1.1], send:[0.12,0.24], dsend:[0.05,0.15]},
      fx:{reverb:[0.3,0.45], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[2800,4000], pump:[0,0.12], crackle:[0,0.08], lowcut:[28,42], highcut:[0,0], comp:[0.4,0.6]},
      found:{role:"bed", vol:[0.05,0.12], pitch:[0.85,1], stretch:[0.45,0.6], cutoff:[2000,3200], sources:["pool:road*1","pool:room*1"]},
      hits:{sources:["pool:vocal_stab*1","sp_energy"], pattern:"sparse", prob:0.25},
      stab:["off"],
      form:"suite",
      timeFeel:{pushPull:{hat:-0.005}},
      theory:{adventure:[0.133,0.25], color:[0.167,0.367], voicing:"close", reharm:true},
      rhythm:[0.293,0.503],
      pipes:[{id:"sweepArc", w:0.45, lo:0.7, hi:2},{id:"vibratoSwell", w:0.4, depth:0.25}] },
    /* /genre-tool:sliderule:genres */
    /* genre-tool:crumpetwhirl:genres */
    crumpetwhirl: { label:"Teatime Anomaly", info:"A breaks kit at 96-108. Fretless bass under a rhodes ep, with a flute. ii-V-I, hard swing, loose timing, rubato.",
      bpm:[96,108],
      swing:[0.18,0.32],
      humanize:[0.25,0.45],
      progressions:["ii_v_i","neosoul","mode_dorian","royal_road"],
      kits:["breaks","shuffle"],
      fills:["off","drum fill","micro lick"],
      bass:{patterns:["melodic","walking","syncopated"], samplerPool:["fretless_bass","acoustic_bass"], recipe:{model:["sampler","sampler","sub"], cutoff:[400,750], res:[0.05,0.12], level:[0.95,1.15], send:[0.08,0.16], dsend:[0,0.06], attack:0.005, release:[0.1,0.18]}},
      lead:{patterns:["wander","canon","composed2","pentaup"], samplerPool:["flute","recorder","soprano_sax","rhodes_ep"], recipe:{model:["sampler","sampler","sampler","rhodes"], wave:"sine", voices:[1,2], spread:[0.001,0.004], cutoff:[2400,3600], level:[0.44,0.58], send:[0.35,0.55], dsend:[0.15,0.3], attack:[0.01,0.03], release:[0.2,0.4]}},
      pads:{prob:0.8, samplerPool:["rhodes_ep","reed_organ"], recipe:{model:["rhodes","sampler","dx7"], wave:"sine", cutoff:[1000,1700], detune:[0.003,0.007], attack:[0.3,1], level:[0.42,0.56], send:[0.35,0.5], dsend:[0.08,0.2]}, inserts:{prob:0.4, max:1, pool:[["phaser",{rate:[0.08,0.2], depth:[0.4,0.6], mix:[0.3,0.5]}]]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.7,0.95], snare:[0.5,0.75], hat:[0.7,1], tune:[0.95,1.05], send:[0.15,0.3], dsend:[0,0.1], kit:"brush"},
      fx:{reverb:[0.4,0.55], delayBeats:[0.5,0.75], delayFb:[0.15,0.28], delayCut:[2400,3400], pump:[0,0], crackle:[0.08,0.22], lowcut:[0,25], highcut:[9000,14000], comp:[0.05,0.2]},
      found:{role:"bed", vol:[0.06,0.14], pitch:[0.8,1], stretch:[0.45,0.6], cutoff:[2000,3200], sources:["pool:nature*1","ferment_bubble"]},
      rubato:{depth:[0.006,0.014], periodBars:[2,3], prob:0.35},
      hits:{sources:["timer_ding","pool:vocal_stab*1"], pattern:"sparse", prob:0.25},
      stab:["off"],
      form:"aaba",
      timeFeel:{pushPull:{bass:0.012}},
      theory:{adventure:[0.275,0.45], color:[0.488,0.725], voicing:"drop2", reharm:true},
      rhythm:[0.375,0.6],
      pipes:[{id:"echoCanon", w:0.55, prob:0.45, delay:2}] },
    /* /genre-tool:crumpetwhirl:genres */
    /* genre-tool:polygonforge:genres */
    polygonforge: { label:"Anvil Theorem", info:"A half-time kit at 154-166. Picked bass under an atmosphere, with a palm muted guitar. Phrygian, straight time, quantized tight, euclidean hats.",
      bpm:[154,166],
      swing:[0,0.03],
      humanize:[0,0.08],
      progressions:["mode_phrygian","royal_road","drone_min"],
      kits:["halftime","electro"],
      fills:["impact","cut","stutter","dropout"],
      euclid:{kick:[7,16]},
      bass:{patterns:["sludge","stab","sixteenths"], samplerPool:["picked_bass"], recipe:{model:["sampler","reese"], cutoff:[300,550], res:[0.1,0.25], level:[1.2,1.4], send:[0,0.06], dsend:[0,0.05]}, inserts:{prob:1, max:1, pool:[["distort",{drive:[0.6,0.9], mix:[0.8,1]}]]}},
      lead:{patterns:["sludge","double","sparse"], samplerPool:["palm_muted_guitar","distortion_guitar"], recipe:{model:["sampler","sampler","fuzz"], wave:"saw", voices:[1,2], spread:[0.002,0.006], cutoff:[1800,2800], level:[0.5,0.64], send:[0.15,0.3], dsend:[0.1,0.25], attack:0.003, release:[0.06,0.12], sustain:[0.5,0.65]}, inserts:{prob:1, max:1, pool:[["distort",{drive:[0.55,0.85], mix:[0.7,0.95]}]]}},
      pads:{prob:0.45, samplerPool:["atmosphere","bowed_glass"], recipe:{model:["sampler","ppg","saw"], wave:"sine", cutoff:[1400,2400], detune:[0.004,0.01], attack:[1,2.5], level:[0.36,0.5], send:[0.4,0.6], dsend:[0.1,0.25]}},
      drums:{kickModel:["909","808"], snareModel:["crack","clap"], hatModel:["metal"], kick:[1.35,1.6], snare:[0.95,1.2], hat:[0.5,0.85], tune:[0.9,1.05], send:[0.08,0.18], dsend:[0.08,0.2]},
      fx:{reverb:[0.25,0.4], delayBeats:[0.375,0.5], delayFb:[0.15,0.3], delayCut:[2200,3200], pump:[0.05,0.2], crackle:[0,0.06], lowcut:[30,45], highcut:[0,0], comp:[0.55,0.8], grit:[0.5,0.75]},
      found:{role:"bed", vol:[0.06,0.14], pitch:[0.7,0.85], stretch:[0.45,0.6], cutoff:[1600,2800], sources:["pool:industry*1","crt_whine"]},
      hits:{sources:["sp_system","sp_pressure"], pattern:"dub", prob:0.4},
      stab:["off","sparse"],
      form:"drop",
      theory:{adventure:[0.117,0.213], color:[0.3,0.5], voicing:"close", reharm:true},
      rhythm:[0.285,0.505],
      pipes:[{id:"strum", w:0.55, step:0.02},{id:"sweepArc", w:0.45, lo:0.7, hi:2}] },
    /* /genre-tool:polygonforge:genres */
    /* genre-tool:moptoprattle:genres */
    moptoprattle: { label:"Tea Chest Poltergeist", info:"A shuffle at 142-156. Acoustic bass under a harmonica, with a steel string guitar. Doo-wop changes, swung, loose timing.",
      bpm:[142,156],
      swing:[0.05,0.12],
      humanize:[0.2,0.42],
      progressions:["doo_wop","doo_wop","four_chords","blues_12"],
      kits:["shuffle","four"],
      fills:["drum fill","hat rush","off"],
      bass:{patterns:["walking","root","simple"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sampler","sub"], cutoff:[600,950], res:[0.08,0.14], level:[0.9,1.1], send:[0.05,0.12], dsend:[0,0.05]}},
      lead:{patterns:["double","updown","hero"], samplerPool:["steel_string_guitar","clean_guitar","harmonica"], recipe:{model:["sampler","sampler","sampler","guitar"], wave:"saw", voices:[1,2], spread:[0.001,0.004], cutoff:[2800,4000], level:[0.5,0.62], send:[0.2,0.35], dsend:[0.05,0.15], vibrato:[0.004,0.009], vibRate:[5.5,7]}},
      pads:{prob:0.35, samplerPool:["harmonica","reed_organ"], recipe:{model:["sampler","sampler","organ"], wave:"saw", cutoff:[1100,1700], detune:[0.003,0.007], attack:[0.15,0.5], level:[0.34,0.46], send:[0.15,0.3], dsend:[0.05,0.12]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.85,1.05], snare:[0.8,1.05], hat:[0.7,1], tune:[0.95,1.1], send:[0.15,0.28], dsend:[0,0.08], kit:"acoustic"},
      fx:{reverb:[0.3,0.45], delayBeats:[0.375,0.5], delayFb:[0.1,0.22], delayCut:[2400,3600], pump:[0,0.05], crackle:[0.3,0.5], lowcut:[30,45], highcut:[9000,12000], comp:[0.15,0.32], grit:[0,0.1]},
      found:{role:"bed", vol:[0.06,0.12], pitch:[0.95,1.05], stretch:[0.45,0.6], cutoff:[2400,3600], sources:["leacock1","leacock2"]},
      hits:{sources:["blues_vox_78","pool:horn_stab*1"], pattern:"response", prob:0.4},
      stab:["off"],
      form:"aaba",
      theory:{adventure:[0.163,0.288], color:[0.263,0.45], voicing:"close", reharm:true},
      rhythm:[0.165,0.335],
      pipes:[{id:"callResponse", w:0.5, level:0.85},{id:"strum", w:0.55, step:0.02}] },
    /* /genre-tool:moptoprattle:genres */
    /* genre-tool:meadowjangle:genres */
    meadowjangle: { label:"Tambourine Equinox", info:"AN open kit at 112-124. Finger bass under a percussive organ, with a steel string guitar. A I-vi-ii-V turn, swung, loose timing.",
      bpm:[112,124],
      swing:[0.08,0.16],
      humanize:[0.18,0.38],
      progressions:["pop_1625","four_chords","mode_mixo","interchange"],
      kits:["open","full"],
      fills:["drum fill","tom fill","off"],
      bass:{patterns:["melodic","walking","root"], samplerPool:["finger_bass","acoustic_bass"], recipe:{model:["sampler","sampler","saw"], cutoff:[600,950], res:[0.08,0.14], level:[0.95,1.15], send:[0.04,0.1], dsend:[0,0.05]}},
      lead:{patterns:["updown","composed","arpup","double"], samplerPool:["steel_string_guitar","clean_guitar","jazz_guitar"], patchPool:["FOLK GUIT","GUITAR  1"], recipe:{model:["sampler","sampler","sampler","dx7"], wave:"saw", voices:[1,2], spread:[0.001,0.004], cutoff:[3200,4400], level:[0.48,0.6], send:[0.3,0.45], dsend:[0.08,0.18], vibrato:[0.003,0.007], vibRate:[5,6.5], release:[0.3,0.5]}, inserts:{prob:0.45, max:2, pool:[["chorus",{rate:[0.4,0.8], depth:[0.2,0.35], mix:[0.2,0.35]}],["delay",{timeBars:[0.375,0.5], feedback:[0.2,0.35], tone:[3200,4000], wow:[0.12,0.24], mix:[0.25,0.4]}]]}},   // RING-CLASS: the twelve-string chime ringing out on a dotted-8th delay (fires on the dx7 synth draw; sampled strings render dry)
      pads:{prob:0.55, samplerPool:["percussive_organ","harmonica"], recipe:{model:["sampler","sampler","organ"], wave:"saw", cutoff:[1100,1700], detune:[0.003,0.008], attack:[0.2,0.6], level:[0.36,0.48], send:[0.22,0.36], dsend:[0.05,0.12]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.85,1.05], snare:[0.75,1], hat:[0.9,1.2], tune:[0.95,1.1], send:[0.15,0.28], dsend:[0,0.08], kit:"acoustic"},
      fx:{reverb:[0.35,0.5], delayBeats:[0.5,0.75], delayFb:[0.1,0.22], delayCut:[2800,4000], pump:[0,0.05], crackle:[0.15,0.28], lowcut:[25,40], highcut:[0,0], comp:[0.08,0.2], grit:[0,0.08]},
      found:{role:"bed", vol:[0.05,0.1], pitch:[0.95,1.05], stretch:[0.45,0.6], cutoff:[2600,3800], sources:["pool:nature*1","chickadee"]},
      hits:{sources:["pool:vb_folk_pastoral*1","pool:vocal_stab*1","sp_rhythm"], pattern:"sparse", prob:0.25},
      stab:["off"],
      form:"pop",
      theory:{adventure:[0.133,0.257], color:[0.25,0.433], voicing:"close", reharm:true},
      rhythm:[0.11,0.275],
      pipes:[{id:"strum", w:0.55, step:0.02}] },
    /* /genre-tool:meadowjangle:genres */
    /* genre-tool:strawberryfog:genres */
    strawberryfog: { label:"Doppler Orchard", info:"A half-time kit at 76-90. Saw synth bass under a flute, with a sitar. A two-chord minor drone, a light shuffle.",
      bpm:[76,90],
      swing:[0.02,0.1],
      humanize:[0.15,0.32],
      progressions:["drone_min","mode_mixo","dream"],
      kits:["halftime","open"],
      fills:["reverse","dropout","riser"],
      bass:{patterns:["pedal","root","dub"], recipe:{model:["saw","sub"], cutoff:[450,800], res:[0.1,0.18], level:[0.95,1.15], send:[0.05,0.12], dsend:[0,0.08]}},
      lead:{patterns:["wander","sparse","pentaup"], samplerPool:["sitar","flute","recorder"], patchPool:["SITAR","FLUTE   1"], recipe:{model:["sampler","sampler","sampler","dx7"], wave:"sine", voices:[1,2], spread:[0.002,0.006], cutoff:[2200,3400], level:[0.42,0.56], send:[0.35,0.55], dsend:[0.25,0.45], vibrato:[0.006,0.014], vibRate:[4.5,6]}, inserts:{prob:0.55, max:1, pool:[["phaser",{rate:[0.08,0.25], depth:[0.5,0.8], mix:[0.4,0.6]}]]}},
      pads:{prob:1, samplerPool:["flute","strings","ahh_choir"], recipe:{model:["sampler","sampler","strings","choir"], wave:"saw", cutoff:[1000,1700], detune:[0.008,0.016], attack:[1.2,2.8], level:[0.5,0.66], send:[0.35,0.55], dsend:[0.1,0.25]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.75,0.95], snare:[0.6,0.85], hat:[0.5,0.8], tune:[0.9,1.05], send:[0.25,0.4], dsend:[0.05,0.15], kit:"acoustic"},
      fx:{reverb:[0.5,0.68], delayBeats:[0.75,1], delayFb:[0.35,0.5], delayCut:[2000,3000], pump:[0,0.08], crackle:[0.15,0.3], lowcut:[25,40], highcut:[7000,11000], comp:[0.15,0.32], grit:[0.05,0.18]},
      found:{role:"bed", vol:[0.15,0.25], pitch:[0.75,0.95], stretch:[0.5,0.65], cutoff:[2000,3200], sources:["pool:voices*2","loon","pool:road*1"]},
      hits:{sources:["sp_rewind","pool:vocal_stab*1"], pattern:"sparse", prob:0.3},
      stab:["off"],
      form:"wave",
      reverbColor:"greyhole",
      theory:{adventure:[0.117,0.223], color:[0.3,0.517], voicing:"close", reharm:true},
      rhythm:[0.125,0.3],
      pipes:[{id:"throwFx", w:0.55, prob:0.6},{id:"densityArc", w:0.4, floor:0.6},{id:"harmonize", w:0.45, prob:0.35}] },
    /* /genre-tool:strawberryfog:genres */
    /* genre-tool:octopusminuet:genres */
    octopusminuet: { label:"Cephalopod Gavotte", info:"AN open kit at 90-100. A cello under strings, with a harpsichord. A canon, a light shuffle, rubato.",
      bpm:[90,100],
      swing:[0,0.06],
      humanize:[0.12,0.26],
      progressions:["canon","sad_pop","ii_v_i"],
      kits:["open","halftime"],
      fills:["off","micro lick"],
      bass:{patterns:["walking","melodic","pedal"], samplerPool:["cello","acoustic_bass"], recipe:{model:["sampler","sampler"], cutoff:[550,900], res:[0.06,0.12], level:[0.75,0.95], send:[0.1,0.2], dsend:[0,0.06]}},
      lead:{patterns:["composed","composed2","canon","arpup"], samplerPool:["harpsichord","celesta","oboe"], patchPool:["HARPSICH 1","CELESTE"], recipe:{model:["sampler","sampler","sampler","dx7"], wave:"sine", voices:[1,2], spread:[0.001,0.003], cutoff:[2800,4000], level:[0.46,0.58], send:[0.25,0.4], dsend:[0.1,0.2], attack:0.004, release:[0.08,0.14], sustain:[0.5,0.65]}},
      pads:{prob:0.9, samplerPool:["strings","pizzicato_strings"], recipe:{model:["sampler","sampler","strings"], wave:"saw", cutoff:[1300,1900], detune:[0.003,0.007], attack:[0.4,1], level:[0.42,0.56], send:[0.25,0.4], dsend:[0.05,0.15]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.5,0.7], snare:[0.4,0.6], hat:[0.45,0.7], tune:[0.95,1.1], send:[0.2,0.35], dsend:[0,0.08], kit:"brush"},
      fx:{reverb:[0.4,0.55], delayBeats:[0.5,0.75], delayFb:[0.1,0.2], delayCut:[2600,3800], pump:[0,0], crackle:[0.1,0.25], lowcut:[0,30], highcut:[0,0], comp:[0.1,0.24], grit:[0,0]},
      found:{role:"bed", vol:[0.05,0.1], pitch:[0.95,1.05], stretch:[0.45,0.6], cutoff:[2200,3400], sources:["pigeon_coo","pool:city*1"]},
      rubato:{depth:[0.008,0.02], periodBars:[2,4], prob:0.5},
      counterpoint:{prob:0.5},
      hits:{sources:["pool:chime*2"], pattern:"sparse", prob:0.2},
      stab:["off"],
      form:"aaba",
      reverbColor:"dattorro",
      theory:{adventure:[0.217,0.367], color:[0.333,0.533], voicing:"close", reharm:true},
      rhythm:[0.125,0.3],
      pipes:[{id:"echoCanon", w:0.55, prob:0.45, delay:2},{id:"strum", w:0.55, step:0.02},{id:"harmonize", w:0.45, prob:0.35}] },
    /* /genre-tool:octopusminuet:genres */
    /* genre-tool:walrusfuzz:genres */
    walrusfuzz: { label:"Pinniped Overload", info:"A full kit at 131-138. Picked bass under a rock organ, with a distortion guitar. A twelve-bar blues, a light shuffle.",
      bpm:[131,138],
      swing:[0.03,0.09],
      humanize:[0.15,0.3],
      progressions:["blues_12","minor_run","funk_vamp"],
      kits:["full","four"],
      fills:["drum fill","tom fill","impact"],
      bass:{patterns:["drive","walking","octaves"], samplerPool:["picked_bass"], recipe:{model:["sampler","saw"], cutoff:[600,950], res:[0.1,0.18], level:[1.1,1.3], send:[0.03,0.08], dsend:[0,0.05]}},
      lead:{patterns:["blues","roar","hero","double"], samplerPool:["distortion_guitar","overdrive_guitar"], recipe:{model:["sampler","sampler","fuzz"], wave:"saw", voices:[1,2], spread:[0.002,0.006], cutoff:[2600,3800], level:[0.52,0.66], send:[0.28,0.42], dsend:[0.08,0.18], vibrato:[0.005,0.011], vibRate:[5.5,7], release:[0.25,0.45]}, inserts:{prob:0.6, max:2, pool:[["distort",{drive:[0.3,0.6], mix:[0.6,0.85]}],["delay",{timeBars:[0.375,0.5], feedback:[0.25,0.4], tone:[2600,3600], wow:[0.2,0.35], mix:[0.25,0.4]}]]}},   // RING-CLASS: the fuzz riff into a tape echo (delay fires on the fuzz synth draw; distort folds into the sampler strip)
      pads:{prob:0.6, samplerPool:["rock_organ","overdrive_guitar"], recipe:{model:["sampler","hammond"], wave:"saw", cutoff:[1000,1600], detune:[0.004,0.01], attack:[0.2,0.6], level:[0.42,0.56], send:[0.25,0.4], dsend:[0.05,0.12]}, inserts:{prob:0.6, max:1, pool:[["phaser",{rate:[0.15,0.4], depth:[0.4,0.6], mix:[0.35,0.55]}]]}},   // RING-CLASS: the organ snarl swirls (phaser on the hammond synth draw)
      drums:{kickModel:["boom"], snareModel:["crack","noise"], hatModel:["noise"], kick:[1.15,1.4], snare:[0.9,1.15], hat:[0.7,1], tune:[0.9,1.05], send:[0.15,0.28], dsend:[0,0.08], kit:"power"},
      fx:{reverb:[0.38,0.52], delayBeats:[0.375,0.5], delayFb:[0.12,0.25], delayCut:[2200,3400], pump:[0,0.1], crackle:[0.1,0.25], lowcut:[30,45], highcut:[0,0], comp:[0.4,0.62], grit:[0.35,0.58]},
      found:{role:"bed", vol:[0.08,0.15], pitch:[0.9,1.05], stretch:[0.45,0.6], cutoff:[2200,3400], sources:["pool:industry*1","leacock3"]},
      hits:{sources:["sp_rewind","pool:vocal_stab*1"], pattern:"sparse", prob:0.25},
      stab:["off"],
      form:"pop",
      reverbColor:"fdn",
      theory:{adventure:[0.167,0.307], color:[0.283,0.467], voicing:"close", reharm:true},
      rhythm:[0.1,0.26],
      pipes:[{id:"callResponse", w:0.5, level:0.85},{id:"strum", w:0.55, step:0.02}] },
    /* /genre-tool:walrusfuzz:genres */
    /* genre-tool:rooftopholler:genres */
    rooftopholler: { label:"Fire Escape Psalm", info:"A full kit at 100-110. Finger bass under a rock organ, with a rhodes ep. A funk vamp, swung.",
      bpm:[100,110],
      swing:[0.08,0.16],
      humanize:[0.15,0.32],
      progressions:["funk_vamp","mode_mixo","blues_12"],
      kits:["full","open"],
      fills:["drum fill","kit fill","off"],
      bass:{patterns:["melodic","walking","syncopated"], samplerPool:["finger_bass","picked_bass"], recipe:{model:["sampler","sampler","saw"], cutoff:[600,950], res:[0.08,0.15], level:[1,1.2], send:[0.04,0.1], dsend:[0,0.05]}},
      lead:{patterns:["composed","blues","double","wander"], samplerPool:["rhodes_ep","clean_guitar"], patchPool:["E.PIANO 2","E.PIANO 4"], recipe:{model:["rhodes","dx7","sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.002,0.005], cutoff:[2600,3600], level:[0.46,0.58], send:[0.2,0.35], dsend:[0.1,0.22], attack:0.008, release:[0.1,0.18], sustain:[0.65,0.78]}},
      pads:{prob:0.7, samplerPool:["rock_organ","percussive_organ"], patchPool:["E.ORGAN 2"], recipe:{model:["hammond","rhodes","sampler"], wave:"saw", cutoff:[1000,1600], detune:[0.004,0.009], attack:[0.3,0.8], level:[0.42,0.56], send:[0.2,0.35], dsend:[0.05,0.12]}},
      drums:{kickModel:["boom"], snareModel:["noise","crack"], hatModel:["noise"], kick:[1,1.2], snare:[0.85,1.1], hat:[0.75,1.05], tune:[0.95,1.1], send:[0.12,0.24], dsend:[0,0.08], kit:"acoustic"},
      fx:{reverb:[0.3,0.45], delayBeats:[0.5,0.75], delayFb:[0.1,0.22], delayCut:[2400,3600], pump:[0,0.1], crackle:[0.1,0.22], lowcut:[25,40], highcut:[0,0], comp:[0.3,0.5], grit:[0.05,0.18]},
      found:{role:"bed", vol:[0.08,0.16], pitch:[0.95,1.05], stretch:[0.45,0.6], cutoff:[2200,3400], sources:["pool:road*1","pool:city*1"]},
      hits:{sources:["pool:vocal_stab*1","sp_rhythm"], pattern:"response", prob:0.4},
      stab:["off"],
      form:"pop",
      timeFeel:{pushPull:{bass:0.012}},
      theory:{adventure:[0.2,0.35], color:[0.333,0.533], voicing:"close", reharm:true},
      rhythm:[0.11,0.275],
      pipes:[{id:"callResponse", w:0.5, level:0.85},{id:"strum", w:0.55, step:0.02}] },
    /* /genre-tool:rooftopholler:genres */
    /* genre-tool:submarinelullaby:genres */
    submarinelullaby: { label:"Hadal Hushabye", info:"A half-time kit at 58-70. Contrabass under strings, with a felt piano. A minor pop cycle, a light shuffle, rubato.",
      bpm:[58,70],
      swing:[0,0.06],
      humanize:[0.15,0.3],
      progressions:["sad_pop","canon","dream"],
      kits:["halftime","off"],
      fills:["off","micro lick"],
      bass:{patterns:["root","pedal","simple"], samplerPool:["contrabass","cello"], recipe:{model:["sampler","sampler","sub"], cutoff:[450,750], res:[0.06,0.12], level:[0.7,0.9], send:[0.12,0.25], dsend:[0,0.06]}},
      lead:{patterns:["composed","sparse","canon","wander"], samplerPool:["felt_piano","cello","french_horns"], recipe:{model:["sampler","sampler","sampler","piano"], wave:"sine", voices:[1,2], spread:[0.001,0.003], cutoff:[2200,3200], level:[0.44,0.56], send:[0.35,0.55], dsend:[0.1,0.22], attack:0.006, release:[0.15,0.25], sustain:[0.6,0.75]}},
      pads:{prob:1, samplerPool:["strings","slow_strings","ahh_choir"], recipe:{model:["sampler","sampler","strings"], wave:"saw", cutoff:[1100,1700], detune:[0.003,0.008], attack:[1.5,3], level:[0.48,0.62], send:[0.35,0.55], dsend:[0.08,0.18]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.4,0.6], snare:[0.3,0.5], hat:[0.3,0.5], tune:[0.9,1.05], send:[0.25,0.4], dsend:[0,0.1], kit:"brush"},
      fx:{reverb:[0.55,0.7], delayBeats:[0.75,1], delayFb:[0.1,0.2], delayCut:[2000,3000], pump:[0,0], crackle:[0.08,0.2], lowcut:[0,30], highcut:[0,0], comp:[0.1,0.25], grit:[0,0]},
      found:{role:"bed", vol:[0.08,0.16], pitch:[0.8,0.95], stretch:[0.5,0.65], cutoff:[1800,2800], sources:["whale_song","hydrophone"]},
      rubato:{depth:[0.015,0.03], periodBars:[2,4], prob:0.8},
      counterpoint:{prob:0.4},
      hits:{sources:["pool:vb_maritime_weather*1","pool:chime*1"], pattern:"sparse", prob:0.1},
      stab:["off"],
      form:"wave",
      reverbColor:"dattorro",
      theory:{adventure:[0.133,0.26], color:[0.317,0.517], voicing:"open", reharm:true},
      rhythm:[0.075,0.215],
      pipes:[{id:"echoCanon", w:0.55, prob:0.45, delay:2},{id:"densityArc", w:0.4, floor:0.6},{id:"harmonize", w:0.45, prob:0.35}] },
    /* /genre-tool:submarinelullaby:genres */
    /* genre-tool:tangerinearcade:genres */
    tangerinearcade: { label:"Spare Room Nebula", info:"AN electro kit at 122-132. Saw synth bass under a Juno pad, with an FM lead. Synthwave changes, a light shuffle.",
      bpm:[122,132],
      swing:[0,0.05],
      humanize:[0.04,0.12],
      progressions:["synthwave","pop_1625","sad_pop"],
      kits:["electro","four","pulse"],
      fills:["riser","tom fill","cut"],
      bass:{patterns:["octaves","stab","sixteenths"], recipe:{model:["saw","sub"], cutoff:[550,900], res:[0.1,0.2], level:[1.05,1.25], send:[0,0.06], dsend:[0,0.05]}},
      lead:{patterns:["hero","updown","arpup","double"], patchPool:["SYN-LEAD 1","E.PIANO 1","CALIOPE"], recipe:{model:["dx7","synclead","casiocz"], wave:"square", voices:[1,2], spread:[0.002,0.006], cutoff:[2800,4000], level:[0.46,0.6], send:[0.2,0.35], dsend:[0.15,0.3], attack:0.005, release:[0.08,0.15], sustain:[0.6,0.75]}, inserts:{prob:0.5, max:1, pool:[["chorus",{rate:[0.5,1], depth:[0.35,0.55], mix:[0.35,0.55]}]]}},
      pads:{prob:1, recipe:{model:["juno60","juno60","oberheim","vp330"], wave:"saw", cutoff:[1300,2000], detune:[0.005,0.011], attack:[0.5,1.4], chorus:[0.9,1.3], level:[0.46,0.6], send:[0.22,0.38], dsend:[0.05,0.15]}},
      drums:{kickModel:["909","boom"], snareModel:["clap","noise"], hatModel:["noise","metal"], kick:[1.1,1.3], snare:[0.8,1.05], hat:[0.6,0.9], tune:[0.95,1.1], send:[0.1,0.2], dsend:[0.03,0.1]},
      fx:{reverb:[0.4,0.58], delayBeats:[0.375,0.5], delayFb:[0.18,0.32], delayCut:[2800,4000], pump:[0.3,0.5], crackle:[0,0.08], lowcut:[30,45], highcut:[0,0], comp:[0.25,0.45], grit:[0,0.06]},
      found:{role:"bed", vol:[0.05,0.1], pitch:[0.95,1.05], stretch:[0.45,0.6], cutoff:[2400,3600], sources:["pool:road*1","crt_whine"]},
      hits:{sources:["pool:vocal_stab*1","sp_nightdrive"], pattern:"sparse", prob:0.3},
      stab:["off","sparse"],
      form:"pop",
      theory:{adventure:[0.1,0.207], color:[0.183,0.367], voicing:"close", reharm:true},
      rhythm:[0.153,0.313],
      pipes:[{id:"harmonize", w:0.45, prob:0.35},{id:"sweepArc", w:0.45, lo:0.7, hi:2},{id:"vibratoSwell", w:0.4, depth:0.25}] },
    /* /genre-tool:tangerinearcade:genres */
    /* genre-tool:chalkvespers:genres */
    chalkvespers: { label:"Antiphon Decay", info:"Beatless at 46-55. A church organ under a church organ, with ahh choir. A two-chord minor drone, loose timing, rubato, one chord every 32 beats.",
      bpm:[46,55],
      swing:[0,0.02],
      humanize:[0.3,0.5],
      progressions:["drone_min","mode_phrygian","mode_dorian"],
      kits:["off"],
      fills:["off"],
      chordEvery:32,
      bass:{patterns:["pedal","off","root"], samplerPool:["church_organ","contrabass"], recipe:{model:["sampler","sampler"], cutoff:[500,1000], res:[0.05,0.1], level:[0.4,0.6], send:[0.3,0.5], dsend:[0,0.08], attack:[0.05,0.15], release:[0.6,1.2]}},
      leadOctave:-2,   // MUSICALITY balance loop 1 (REGISTER): the score asked the ahh_choir up to midi 107 vs its natural ceiling 87 (63% of lead notes folded on seed 1 — the fold saved the ear but bent the contour). -2 octaves lands the chant line at midi 47-83, inside the choir's [27..87] window and in an actual chant register (tenor-alto, not whistle-tone soprano)
      lead:{patterns:["wander","sparse","composed"], samplerPool:["ahh_choir","ahh_choir","ohh_voices"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[1,1], spread:[0.001,0.002], cutoff:[1800,2800], level:[0.5,0.62], send:[0.5,0.7], dsend:[0,0.1], attack:[0.08,0.2], release:[0.5,1]}},
      pads:{prob:0.4, samplerPool:["church_organ"], recipe:{model:["sampler","sampler"], wave:"sine", cutoff:[700,1300], detune:[0.001,0.003], attack:[1.5,3], release:[2,4], swell:1, level:[0.3,0.42], send:[0.45,0.65], dsend:[0,0.08]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.4,0.6], snare:[0.3,0.5], hat:[0.2,0.4], tune:[0.9,1], send:[0.2,0.4], dsend:[0,0]},
      fx:{reverb:[0.65,0.85], delayBeats:[1,2], delayFb:[0.1,0.22], delayCut:[1800,2600], pump:[0,0], crackle:[0,0.15], lowcut:[0,0], highcut:[0,0], comp:[0,0.1]},
      found:{role:"bed", vol:[0.05,0.11], pitch:[0.6,0.8], stretch:[0.5,0.65], cutoff:[1500,2400], sources:["pool:city*1","vx_sv_choir"]},
      rubato:{depth:[0.03,0.05], periodBars:[4,8], prob:1},
      hits:{sources:["pool:chime*1"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"ritual",
      reverbColor:"fdn",
      theory:{adventure:[0.133,0.23], color:[0.217,0.4], voicing:"open", reharm:true},
      rhythm:[0,0.08],
      pipes:[] },
    /* /genre-tool:chalkvespers:genres */
    /* genre-tool:salondawdle:genres */
    salondawdle: { label:"Ottoman Heat Death", info:"A waltz kit at 57-65 in 3/4. A felt piano under slow strings, with a felt piano. Dream changes, a light shuffle, loose timing, rubato.",
      bpm:[57,65],
      swing:[0,0.06],
      humanize:[0.35,0.6],
      progressions:["dream","ii_v_i","neosoul"],
      kits:["waltz","waltzswing"],
      fills:["off"],
      chordEvery:12,
      bass:{patterns:["waltzroot"], samplerPool:["felt_piano","upright_piano"], recipe:{model:["sampler","sampler","piano"], cutoff:[700,1400], res:[0.05,0.1], level:[0.5,0.68], send:[0.25,0.45], dsend:[0,0.08], attack:[0.01,0.03], release:[0.35,0.7]}},   // INSTRUMENT-LIBRARY: the GM concert grand -> the FreePats Kawai UPRIGHT (a real living-room piano — furniture music on furniture)
      lead:{patterns:["waltz","sparse","composed"], samplerPool:["felt_piano","felt_piano","upright_piano"], recipe:{model:["sampler","sampler","piano"], wave:"sine", voices:[1,1], spread:[0.001,0.002], cutoff:[2200,3400], level:[0.42,0.55], send:[0.3,0.5], dsend:[0.05,0.15], attack:[0.01,0.03], release:[0.4,0.8]}},   // INSTRUMENT-LIBRARY: upright_piano replaces the grand in the pool (same slot — the dawdling five-note melody on the honest instrument)
      pads:{prob:0.3, samplerPool:["slow_strings"], recipe:{model:["sampler","strings"], wave:"sine", cutoff:[800,1500], detune:[0.002,0.004], attack:[1.2,2.8], release:[1.8,3.5], swell:1, level:[0.28,0.4], send:[0.4,0.6], dsend:[0,0.08]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.4,0.6], snare:[0.3,0.5], hat:[0.2,0.4], tune:[0.9,1], send:[0.15,0.35], dsend:[0,0]},
      fx:{reverb:[0.45,0.62], delayBeats:[1,1.5], delayFb:[0.1,0.22], delayCut:[2000,3000], pump:[0,0], crackle:[0.1,0.4], lowcut:[0,0], highcut:[0,0], comp:[0,0.12]},
      found:{role:"bed", vol:[0.05,0.12], pitch:[0.7,0.9], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:city*1","pool:nature*1"]},
      rubato:{depth:[0.035,0.06], periodBars:[2,4], prob:1},
      thunk:{prob:[0.3,0.5], amp:[0.03,0.045]},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.05},
      stab:["off"],
      form:"wave",
      meter:{beats:3, unit:4},
      theory:{adventure:[0.3,0.477], color:[0.533,0.783], voicing:"drop2", reharm:true},
      rhythm:[0.1,0.3],
      pipes:[{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:salondawdle:genres */
    /* genre-tool:candlegauze:genres */
    candlegauze: { label:"Moonmilk Prism", info:"Beatless at 69-76. A felt piano under strings, with a harp. Dream changes, rubato.",
      bpm:[69,76],
      swing:[0,0.02],
      humanize:[0.12,0.26],
      progressions:["dream","mode_lydian","royal_road"],
      kits:["off"],
      fills:["off"],
      chordEvery:8,
      bass:{patterns:["root","pedal","simple"], samplerPool:["felt_piano","harp"], recipe:{model:["sampler","sampler","piano"], cutoff:[700,1400], res:[0.05,0.1], level:[0.5,0.68], send:[0.25,0.45], dsend:[0,0.08], attack:[0.01,0.03], release:[0.35,0.7]}},
      lead:{patterns:["arpup","updown","arpup"], samplerPool:["harp","felt_piano","celesta"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.001,0.003], cutoff:[2400,3600], level:[0.42,0.55], send:[0.45,0.6], dsend:[0.05,0.2], attack:[0.008,0.025], release:[0.35,0.7]}},
      pads:{prob:0.85, samplerPool:["strings","slow_strings"], recipe:{model:["sampler","sampler","strings"], wave:"sine", cutoff:[900,1700], detune:[0.002,0.005], attack:[1,2.5], release:[1.8,3.5], swell:1, level:[0.36,0.5], send:[0.5,0.68], dsend:[0,0.1]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.4,0.6], snare:[0.3,0.5], hat:[0.2,0.4], tune:[0.9,1], send:[0.15,0.35], dsend:[0,0]},
      fx:{reverb:[0.68,0.82], delayBeats:[0.75,1.5], delayFb:[0.15,0.28], delayCut:[2200,3200], pump:[0,0], crackle:[0.15,0.4], lowcut:[0,0], highcut:[0,0], comp:[0,0.12]},
      found:{role:"bed", vol:[0.05,0.12], pitch:[0.7,0.9], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:city*1","pool:water*1"]},
      rubato:{depth:[0.025,0.045], periodBars:[2,4], prob:1},
      hits:{sources:["pool:chime*1"], pattern:"sparse", prob:0.08},
      stab:["off"],
      form:"wave",
      theory:{adventure:[0.167,0.31], color:[0.45,0.683], voicing:"open", reharm:true},
      rhythm:[0,0.08],
      pipes:[{id:"strum", w:0.55, step:0.02},{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:candlegauze:genres */
    /* genre-tool:cloisterloom:genres */
    cloisterloom: { label:"Swarm Motet", info:"Beatless at 78-87. A church organ with ahh choir on both pad and lead. A canon, rubato.",
      bpm:[78,87],
      swing:[0,0.02],
      humanize:[0.15,0.35],
      progressions:["canon","mode_dorian","dream"],
      kits:["off"],
      fills:["off"],
      chordEvery:8,
      bass:{patterns:["pedal","root","simple"], samplerPool:["church_organ","ahh_choir"], recipe:{model:["sampler","sampler"], cutoff:[600,1200], res:[0.05,0.1], level:[0.45,0.65], send:[0.3,0.5], dsend:[0,0.08], attack:[0.03,0.1], release:[0.5,1]}},
      lead:{patterns:["canon","fugue","wander"], samplerPool:["ahh_choir","ohh_voices","ahh_choir"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[3,4], spread:[0.004,0.009], cutoff:[2000,3200], level:[0.42,0.56], send:[0.4,0.6], dsend:[0.05,0.15], attack:[0.05,0.15], release:[0.4,0.8]}},
      pads:{prob:0.85, samplerPool:["ahh_choir","ohh_voices","strings"], recipe:{model:["sampler","sampler","sampler"], wave:"sine", cutoff:[900,1700], detune:[0.002,0.005], attack:[1,2.5], release:[1.8,3.5], swell:1, level:[0.42,0.58], send:[0.45,0.65], dsend:[0,0.1]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.4,0.6], snare:[0.3,0.5], hat:[0.2,0.4], tune:[0.9,1], send:[0.2,0.4], dsend:[0,0]},
      fx:{reverb:[0.6,0.8], delayBeats:[1,2], delayFb:[0.12,0.25], delayCut:[2000,3000], pump:[0,0], crackle:[0,0.12], lowcut:[0,0], highcut:[0,0], comp:[0,0.1]},
      found:{role:"bed", vol:[0.05,0.11], pitch:[0.7,0.85], stretch:[0.5,0.65], cutoff:[1600,2600], sources:["vx_sv_choir","pool:city*1"]},
      rubato:{depth:[0.01,0.02], periodBars:[2,4], prob:0.6},
      counterpoint:{prob:0.85},
      hits:{sources:["pool:chime*1"], pattern:"sparse", prob:0.1},
      stab:["off"],
      form:"wave",
      reverbColor:"fdn",
      theory:{adventure:[0.167,0.31], color:[0.367,0.583], voicing:"open", reharm:true},
      rhythm:[0,0.08],
      pipes:[{id:"echoCanon", w:0.55, prob:0.45, delay:2},{id:"densityArc", w:0.4, floor:0.6},{id:"harmonize", w:0.45, prob:0.35}] },
    /* /genre-tool:cloisterloom:genres */
    /* genre-tool:miasmarow:genres */
    miasmarow: { label:"Planchette Drift", info:"A bare kick at 89-98. A cello under a tremolo, with a clarinet. Bare triads, straight time, loose timing, rubato.",
      bpm:[89,98],
      swing:[0,0.04],
      humanize:[0.2,0.4],
      progressions:["frost","hijaz","drone_min","quartal"],
      kits:["kick"],
      fills:["off"],
      chordEvery:8,
      bass:{patterns:["pedal","root","off"], samplerPool:["cello","contrabass"], recipe:{model:["sampler","sampler"], cutoff:[500,1100], res:[0.05,0.12], level:[0.5,0.7], send:[0.25,0.45], dsend:[0,0.08], attack:[0.03,0.1], release:[0.5,1]}},
      lead:{patterns:["wander","sparse","arpdown"], samplerPool:["clarinet","viola","celesta"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.001,0.004], cutoff:[2200,3400], level:[0.42,0.55], send:[0.35,0.55], dsend:[0.1,0.25], vibrato:[0.006,0.012], attack:[0.02,0.06], release:[0.3,0.6]}},
      pads:{prob:0.8, samplerPool:["tremolo","strings","bowed_glass"], recipe:{model:["sampler","sampler","sampler"], wave:"sine", cutoff:[900,1700], detune:[0.003,0.006], attack:[1,2.5], release:[1.8,3.5], swell:1, level:[0.36,0.5], send:[0.45,0.65], dsend:[0,0.12]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.4,0.7], snare:[0.3,0.5], hat:[0.2,0.4], tune:[0.85,0.95], send:[0.25,0.45], dsend:[0,0.05]},
      fx:{reverb:[0.6,0.8], delayBeats:[1,2], delayFb:[0.2,0.35], delayCut:[1800,2800], pump:[0,0], crackle:[0.18,0.42], lowcut:[0,0], highcut:[0,0], comp:[0,0.15]},
      found:{role:"bed", vol:[0.06,0.13], pitch:[0.6,0.85], stretch:[0.5,0.65], cutoff:[1600,2600], sources:["pool:voices*1","pool:city*1"]},
      rubato:{depth:[0.03,0.055], periodBars:[2,4], prob:1},
      hits:{sources:["pool:chime*1"], pattern:"sparse", prob:0.12},
      stab:["off"],
      form:"ritual",
      reverbColor:"greyhole",
      theory:{adventure:[0.1,0.18], color:[0.15,0.317], voicing:"quartal", reharm:false},
      rhythm:[0.05,0.15],
      pipes:[] },
    /* /genre-tool:miasmarow:genres */
    /* genre-tool:greasepaintoompah:genres */
    greasepaintoompah: { label:"Actuarial Cabaret", info:"A waltz kit at 103-112 in 3/4. A tuba under an accordion, with a muted trumpet. A descending minor run, swung, loose timing.",
      bpm:[103,112],
      swing:[0.05,0.13],
      humanize:[0.3,0.5],
      progressions:["minor_run","doo_wop","sad_pop"],
      kits:["waltz"],
      fills:["off","drum fill","kit fill"],
      bass:{patterns:["oompahpah"], samplerPool:["tuba","acoustic_bass"], recipe:{model:["sampler","sampler","sub"], cutoff:[400,800], res:[0.05,0.15], level:[0.85,1.05], send:[0.05,0.15], dsend:[0,0.05], attack:[0.01,0.03], release:[0.15,0.35]}},
      lead:{patterns:["composed","wander","double"], samplerPool:["muted_trumpet","clarinet","trombone"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.002,0.005], cutoff:[2200,3400], level:[0.44,0.56], send:[0.25,0.4], dsend:[0.1,0.25], vibrato:[0.008,0.014], attack:[0.02,0.05], release:[0.15,0.3], sustain:[0.6,0.72]}},
      pads:{prob:0.55, samplerPool:["accordion","reed_organ","honky_tonk"], recipe:{model:["sampler","sampler"], wave:"sine", cutoff:[1200,2200], detune:[0.003,0.007], attack:[0.05,0.25], release:[0.3,0.7], level:[0.38,0.52], send:[0.2,0.38], dsend:[0.05,0.15]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.6,0.9], snare:[0.6,0.9], hat:[0.5,0.8], tune:[0.9,1.05], send:[0.15,0.35], dsend:[0,0.08], kit:"room"},
      fx:{reverb:[0.3,0.45], delayBeats:[0.75,1], delayFb:[0.1,0.22], delayCut:[2200,3200], pump:[0,0.05], crackle:[0.3,0.58], lowcut:[0,30], highcut:[0,0], comp:[0.15,0.35]},
      found:{role:"bed", vol:[0.06,0.13], pitch:[0.85,1], stretch:[0.45,0.6], cutoff:[2000,3200], sources:["horns_78","vx_burroughs"]},
      hits:{sources:["pool:horn_stab*1"], pattern:"response", prob:0.3},
      stab:["off"],
      form:"aaba",
      meter:{beats:3, unit:4},
      timeFeel:{pushPull:{bass:-0.01, snare:0.012}},
      theory:{adventure:[0.1,0.207], color:[0.183,0.35], voicing:"close", reharm:true},
      rhythm:[0.1,0.3],
      pipes:[] },
    /* /genre-tool:greasepaintoompah:genres */
    /* genre-tool:urchinmatinee:genres */
    urchinmatinee: { label:"Extinction Matinee", info:"A shuffle at 115-124. Acoustic bass under strings, with a brass section. Doo-wop changes, hard swing, loose timing.",
      timeFeel:{ pushPullMs:{ bass:6, snare:5 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — PIT-BAND SHUFFLE: walking upright and a matchstick backbeat, both leaning back into the big number
      bpm:[115,124],
      swing:[0.15,0.3],
      humanize:[0.25,0.45],
      progressions:["doo_wop","pop_1625","four_chords"],
      kits:["shuffle","full","open"],
      fills:["drum fill","snare roll","kit fill","riser"],
      bass:{patterns:["walking","root","octaves"], samplerPool:["acoustic_bass","tuba"], recipe:{model:["sampler","sampler","sub"], cutoff:[400,750], res:[0.05,0.15], level:[0.9,1.1], send:[0.05,0.12], dsend:[0,0.05], attack:[0.01,0.03], release:[0.15,0.3]}},
      lead:{patterns:["hero","anthem","double","updown"], samplerPool:["brass_section","trumpet","flute","piccolo"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.002,0.005], cutoff:[2600,3800], level:[0.46,0.58], send:[0.25,0.4], dsend:[0.1,0.22], vibrato:[0.006,0.012], attack:[0.015,0.04], release:[0.15,0.3], sustain:[0.6,0.72]}},
      pads:{prob:0.7, samplerPool:["strings","brass_section","yamaha_grand_piano"], recipe:{model:["sampler","sampler"], wave:"sine", cutoff:[1300,2300], detune:[0.002,0.005], attack:[0.2,0.8], release:[0.5,1.2], swell:1, level:[0.4,0.54], send:[0.25,0.42], dsend:[0.05,0.15]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.7,1], snare:[0.65,0.95], hat:[0.6,0.9], tune:[0.95,1.05], send:[0.15,0.32], dsend:[0,0.08], kit:"jazz"},
      fx:{reverb:[0.35,0.5], delayBeats:[0.5,0.75], delayFb:[0.1,0.22], delayCut:[2400,3400], pump:[0,0.08], crackle:[0.05,0.3], lowcut:[0,30], highcut:[0,0], comp:[0.25,0.45]},
      found:{role:"bed", vol:[0.05,0.12], pitch:[0.9,1.05], stretch:[0.45,0.6], cutoff:[2000,3200], sources:["horns_78","vx_suspense"]},
      hits:{sources:["bb_horn_a","pool:horn_stab*1"], pattern:"response", prob:0.4},
      stab:["offbeat","off"],
      form:"aaba",
      masterComp:0.3,
      theory:{adventure:[0.1,0.207], color:[0.233,0.417], voicing:"close", reharm:true},
      rhythm:[0.157,0.333],
      pipes:[] },
    /* /genre-tool:urchinmatinee:genres */
    /* genre-tool:marblefury:genres */
    marblefury: { label:"Tectonic Tantrum", info:"A bare kick at 127-138. A cello with strings on both pad and lead. Epic minor changes, straight time.",
      bpm:[127,138],
      swing:[0,0.04],
      humanize:[0.15,0.35],
      progressions:["epic_min","minor_run","andalusian"],
      kits:["kick","full"],
      fills:["tom fill","impact","drum fill","off"],
      bass:{patterns:["octaves","drive","pedal"], samplerPool:["cello","contrabass"], recipe:{model:["sampler","sampler","sub"], cutoff:[450,900], res:[0.05,0.15], level:[0.95,1.15], send:[0.1,0.2], dsend:[0,0.06], attack:[0.01,0.04], release:[0.2,0.45]}},
      lead:{patterns:["roar","anthem","hero","double"], samplerPool:["strings","french_horns","violin"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[2,3], spread:[0.003,0.007], cutoff:[2400,3600], level:[0.46,0.6], send:[0.3,0.48], dsend:[0.08,0.2], vibrato:[0.006,0.012], attack:[0.03,0.08], release:[0.25,0.5]}},
      pads:{prob:0.8, samplerPool:["strings","french_horns","slow_strings"], recipe:{model:["sampler","sampler"], wave:"sine", cutoff:[1000,1900], detune:[0.002,0.005], attack:[0.6,1.8], release:[1.2,2.6], swell:1, level:[0.42,0.56], send:[0.35,0.55], dsend:[0,0.12]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[1,1.3], snare:[0.5,0.8], hat:[0.3,0.55], tune:[0.85,0.95], send:[0.2,0.4], dsend:[0,0.08], kit:"room"},
      fx:{reverb:[0.45,0.6], delayBeats:[0.75,1.5], delayFb:[0.1,0.22], delayCut:[2000,3000], pump:[0,0.08], crackle:[0,0.2], lowcut:[0,30], highcut:[0,0], comp:[0.2,0.4]},
      found:{role:"bed", vol:[0.05,0.11], pitch:[0.7,0.9], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:city*2"]},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.05},
      stab:["off"],
      form:"anthem",
      theory:{adventure:[0.117,0.24], color:[0.133,0.3], voicing:"close", reharm:true},
      rhythm:[0.085,0.225],
      pipes:[] },
    /* /genre-tool:marblefury:genres */
    /* genre-tool:perukelotto:genres */
    perukelotto: { label:"Aleatoric Wig", info:"AN open kit at 141-151. A harpsichord under strings, with a harpsichord. A canon, straight time.",
      bpm:[141,151],
      swing:[0,0.03],
      humanize:[0.1,0.25],
      progressions:["canon","pop_1625","ii_v_i","doo_wop","four_chords"],
      kits:["off","open","kick"],
      fills:["off","cut","micro lick","drum fill"],
      bass:{patterns:["simple","octaves","walking","root"], samplerPool:["harpsichord","contrabass"], recipe:{model:["sampler","sampler"], cutoff:[600,1300], res:[0.05,0.1], level:[0.55,0.75], send:[0.15,0.32], dsend:[0,0.08], attack:[0.005,0.02], release:[0.15,0.35]}},
      lead:{patterns:["updown","arpdown","double","pentaup","canon","arp16"], samplerPool:["harpsichord","bright_yamaha_grand","flute","violin"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.001,0.003], cutoff:[2600,3800], level:[0.44,0.56], send:[0.2,0.38], dsend:[0.05,0.18], attack:[0.005,0.02], release:[0.12,0.3]}},
      pads:{prob:0.5, samplerPool:["strings","harpsichord"], recipe:{model:["sampler","sampler"], wave:"sine", cutoff:[1100,2000], detune:[0.002,0.004], attack:[0.3,1], release:[0.6,1.5], level:[0.34,0.48], send:[0.25,0.45], dsend:[0,0.1]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.45,0.7], snare:[0.4,0.65], hat:[0.35,0.6], tune:[0.95,1.05], send:[0.15,0.3], dsend:[0,0.05], kit:"acoustic"},
      fx:{reverb:[0.35,0.5], delayBeats:[0.5,1], delayFb:[0.1,0.2], delayCut:[2400,3400], pump:[0,0], crackle:[0,0.25], lowcut:[0,0], highcut:[0,0], comp:[0.05,0.2]},
      found:{role:"bed", vol:[0.04,0.1], pitch:[0.8,0.95], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:city*2"]},
      hits:{sources:["pool:chime*2"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"suite",
      theory:{adventure:[0.17,0.304], color:[0.31,0.51], voicing:"close", reharm:true},
      rhythm:[0.05,0.16],
      pipes:[{id:"echoCanon", w:0.55, prob:0.45, delay:2},{id:"strum", w:0.55, step:0.02},{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:perukelotto:genres */
    /* genre-tool:beakstampede:genres */
    beakstampede: { label:"Theropod Liturgy", info:"A tribal kit at 154-168. Contrabass under a tremolo, with a bassoon. Primeval fifths, straight time, euclidean hats.",
      bpm:[154,168],
      swing:[0,0.02],
      humanize:[0.1,0.3],
      progressions:["primeval","mode_phrygian","minor_run"],
      kits:["tribal","breaks","four"],
      fills:["impact","tom fill","break fill","cut"],
      euclid:{kick:[5,16]},
      bass:{patterns:["stab","syncopated","hemiola"], samplerPool:["contrabass","bassoon"], recipe:{model:["sampler","sampler","sub"], cutoff:[450,900], res:[0.08,0.18], level:[1,1.2], send:[0.05,0.15], dsend:[0,0.05], attack:[0.005,0.02], release:[0.1,0.25]}},
      lead:{patterns:["roar","sparse","wander"], samplerPool:["bassoon","english_horn","piccolo","pizzicato_strings"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.002,0.005], cutoff:[2400,3600], level:[0.44,0.58], send:[0.2,0.38], dsend:[0.08,0.2], vibrato:[0.004,0.01], attack:[0.01,0.04], release:[0.1,0.25]}},
      pads:{prob:0.6, samplerPool:["tremolo","strings","french_horns"], recipe:{model:["sampler","sampler"], wave:"sine", cutoff:[1000,1900], detune:[0.003,0.006], attack:[0.3,1], release:[0.6,1.5], swell:1, level:[0.36,0.5], send:[0.3,0.48], dsend:[0,0.12]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[1.1,1.4], snare:[0.7,1], hat:[0.4,0.7], tune:[0.8,0.95], send:[0.1,0.28], dsend:[0,0.08], kit:"power"},
      fx:{reverb:[0.3,0.45], delayBeats:[0.375,0.75], delayFb:[0.1,0.22], delayCut:[2200,3200], pump:[0,0.1], crackle:[0,0.2], lowcut:[25,40], highcut:[0,0], comp:[0.3,0.5]},
      found:{role:"bed", vol:[0.06,0.13], pitch:[0.8,1], stretch:[0.45,0.6], cutoff:[2000,3200], sources:["frogs","iriomote"]},
      hits:{sources:["gavel"], pattern:"offbeat", prob:0.35},
      stab:["offbeat","sparse"],
      form:"ritual",
      timeFeel:{pushPull:{bass:0.012, snare:0.014}},
      masterComp:0.35,
      theory:{adventure:[0.133,0.24], color:[0.167,0.333], voicing:"close", reharm:true},
      rhythm:[0.37,0.603],
      pipes:[] },
    /* /genre-tool:beakstampede:genres */
    /* genre-tool:velvetconveyor:genres */
    velvetconveyor: { label:"Assembly Line Rapture", info:"A four-on-the-floor at 114-122. Finger bass under strings, with a vibraphone. A I-vi-ii-V turn, swung.",
      bpm:[114,122],
      swing:[0.05,0.11],
      humanize:[0.15,0.32],
      progressions:["pop_1625","doo_wop","four_chords"],
      kits:["four","open"],
      fills:["drum fill","tom fill","off"],
      bass:{patterns:["walking","melodic","octaves"], samplerPool:["finger_bass","picked_bass"], recipe:{model:["sampler","sampler","sub"], cutoff:[450,800], res:[0.05,0.15], level:[1,1.2], send:[0.08,0.16], dsend:[0,0.05], attack:0.005, release:[0.08,0.14]}},
      lead:{patterns:["pentaup","wander","double"], samplerPool:["vibraphone","trumpet","electric_piano"], recipe:{model:["sampler","sampler","piano"], wave:"sine", voices:[1,2], spread:[0.001,0.004], cutoff:[2200,3400], level:[0.46,0.58], send:[0.3,0.45], dsend:[0.1,0.22], attack:0.005, release:[0.1,0.18], sustain:[0.6,0.72]}},
      pads:{prob:0.85, samplerPool:["strings","ahh_choir","slow_strings"], recipe:{model:["sampler","sampler","piano"], wave:"sine", cutoff:[1000,1600], detune:[0.003,0.007], attack:[0.2,0.6], level:[0.42,0.56], send:[0.3,0.45], dsend:[0.05,0.15]}},
      drums:{kickModel:["boom"], snareModel:["noise","crack"], hatModel:["noise"], kick:[0.95,1.15], snare:[1,1.25], hat:[0.55,0.85], tune:[0.9,1.05], send:[0.15,0.28], dsend:[0.03,0.1], kit:"room"},
      fx:{reverb:[0.35,0.5], delayBeats:[0.5,0.75], delayFb:[0.1,0.2], delayCut:[2200,3200], pump:[0,0], crackle:[0.2,0.4], lowcut:[0,30], highcut:[9000,13000], comp:[0.25,0.45]},
      found:{role:"bed", vol:[0.05,0.1], pitch:[0.85,1], stretch:[0.45,0.6], cutoff:[1600,2600], sources:["pool:industry*1","pool:city*2"]},
      hits:{sources:["pool:vb_mallsoft_vapor*1","pool:horn_stab*2","blues_vox_78"], pattern:"response", prob:0.6},
      stab:["off"],
      form:"pop",
      timeFeel:{pushPull:{bass:0.011}},
      theory:{adventure:[0.1,0.207], color:[0.233,0.417], voicing:"close", reharm:true},
      rhythm:[0.09,0.235],
      pipes:[{id:"harmonize", w:0.45, prob:0.35}] },
    /* /genre-tool:velvetconveyor:genres */
    /* genre-tool:talcumcasino:genres */
    talcumcasino: { label:"Centrifuge Ballroom", info:"A four-on-the-floor at 126-136. Picked bass under strings, with a trumpet. A descending minor run, a light shuffle.",
      bpm:[126,136],
      swing:[0.03,0.09],
      humanize:[0.12,0.28],
      progressions:["minor_run","pop_1625","sad_pop"],
      kits:["four","open"],
      fills:["drum fill","tom fill","hat rush"],
      bass:{patterns:["octaves","walking","drive"], samplerPool:["picked_bass","finger_bass"], recipe:{model:["sampler","sampler","saw"], cutoff:[500,900], res:[0.05,0.15], level:[1,1.2], send:[0.05,0.12], dsend:[0,0.05], attack:0.005, release:[0.07,0.12]}},
      lead:{patterns:["double","updown","hero"], samplerPool:["trumpet","brass_section","strings"], recipe:{model:["sampler","sampler","piano"], wave:"sine", voices:[1,2], spread:[0.001,0.004], cutoff:[2400,3600], level:[0.46,0.58], send:[0.3,0.45], dsend:[0.1,0.22], attack:0.005, release:[0.08,0.14], sustain:[0.6,0.72]}},
      pads:{prob:0.9, samplerPool:["strings","slow_strings"], recipe:{model:["sampler","sampler","strings"], wave:"saw", cutoff:[1100,1700], detune:[0.003,0.008], attack:[0.3,0.8], level:[0.44,0.58], send:[0.3,0.45], dsend:[0.05,0.15]}},
      drums:{kickModel:["boom","909"], snareModel:["crack","noise"], hatModel:["noise"], kick:[1.15,1.4], snare:[1,1.25], hat:[0.9,1.2], tune:[0.95,1.1], send:[0.12,0.25], dsend:[0.03,0.1], kit:"power"},
      fx:{reverb:[0.35,0.5], delayBeats:[0.375,0.5], delayFb:[0.1,0.22], delayCut:[2400,3400], pump:[0,0.1], crackle:[0.3,0.5], lowcut:[0,30], highcut:[8500,12000], comp:[0.35,0.55]},
      found:{role:"bed", vol:[0.05,0.1], pitch:[0.85,1], stretch:[0.45,0.6], cutoff:[1600,2600], sources:["pool:city*2","pool:voices*1"]},
      hits:{sources:["pool:horn_stab*1","stml_hit_b3","pool:vocal_stab*1"], pattern:"offbeat", prob:0.55},
      stab:["off","sparse"],
      form:"pop",
      theory:{adventure:[0.1,0.213], color:[0.2,0.367], voicing:"close", reharm:true},
      rhythm:[0.09,0.235],
      pipes:[{id:"harmonize", w:0.45, prob:0.35}] },
    /* /genre-tool:talcumcasino:genres */
    /* genre-tool:capesnap:genres */
    capesnap: { label:"Mantle Snap", info:"A four-on-the-floor at 101-108. Slap bass under a brass section, with a clean guitar. A funk vamp, a light shuffle.",
      bpm:[101,108],
      swing:[0.04,0.09],
      humanize:[0.15,0.35],
      progressions:["funk_vamp","sad_pop","sad_pop"],
      kits:["house","electro"],
      fills:["off","drum fill","kit fill"],
      bass:{patterns:["syncopated","stab","dub"], samplerPool:["slap_bass","picked_bass"], recipe:{model:["sampler","sampler","sub"], cutoff:[450,800], res:[0.08,0.2], level:[1.1,1.3], send:[0.03,0.1], dsend:[0,0.05], attack:0.004, release:[0.06,0.1]}},
      lead:{patterns:["double","sparse","pentaup"], samplerPool:["clean_guitar","palm_muted_guitar","muted_trumpet"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.001,0.004], cutoff:[2200,3400], level:[0.42,0.54], send:[0.15,0.3], dsend:[0.08,0.2], attack:0.003, release:[0.05,0.09], sustain:[0.45,0.58]}, inserts:{prob:0.35, max:1, pool:[["wah",{sens:[0.5,0.7], base:[300,450], range:[1.6,2.4], q:[3.5,5.5], mix:[0.6,0.8]}]]}},
      pads:{prob:0.3, samplerPool:["brass_section","percussive_organ"], recipe:{model:["sampler","sampler"], wave:"saw", cutoff:[1000,1600], detune:[0.003,0.008], attack:[0.02,0.1], level:[0.4,0.52], send:[0.15,0.3], dsend:[0.05,0.15]}},
      drums:{kickModel:["boom"], snareModel:["noise","crack"], hatModel:["noise"], kick:[1.05,1.3], snare:[0.55,0.8], hat:[1.1,1.5], tune:[0.95,1.1], send:[0.08,0.18], dsend:[0.03,0.1], kit:"acoustic"},
      fx:{reverb:[0.22,0.36], delayBeats:[0.5,0.75], delayFb:[0.1,0.2], delayCut:[2200,3400], pump:[0,0.08], crackle:[0.25,0.45], lowcut:[25,40], highcut:[0,0], comp:[0.55,0.75]},
      found:{role:"chops", vol:[0.2,0.3], pitch:[0.95,1.1], stretch:[0.4,0.6], cutoff:[2500,4000], sources:["stml_chop_a","stml_chop_b","stml_chop_c","bb_horn_a"]},
      hits:{sources:["bb_horn_a","bb_horn_b","bb_stab_a","stml_hit_01"], pattern:"offbeat", prob:0.7},
      stab:["offbeat","sparse"],
      form:"vamp",
      timeFeel:{pushPull:{bass:0.011, hat:-0.005}},
      theory:{adventure:[0.083,0.183], color:[0.2,0.367], voicing:"close", reharm:false},
      rhythm:[0.21,0.4],
      pipes:[{id:"strum", w:0.55, step:0.02}] },
    /* /genre-tool:capesnap:genres */
    /* genre-tool:chromeufo:genres */
    chromeufo: { label:"Saucer Diplomacy", info:"A boom-bap kit at 90-98. Minimoog lead bass under ahh choir, with an overdrive guitar. A funk vamp, swung, loose timing.",
      bpm:[90,98],
      swing:[0.09,0.17],
      humanize:[0.3,0.5],
      progressions:["funk_vamp","neosoul","deep_two"],
      kits:["boombap","house"],
      fills:["drum fill","downlift","off"],
      bass:{patterns:["syncopated","dub","melodic"], recipe:{model:["modeld","modeld","sub"], cutoff:[350,650], res:[0.15,0.3], level:[1.15,1.35], send:[0,0.08], dsend:[0,0.05], glide:[25,45], envAmount:[1.5,2.6], envDecay:[0.09,0.16], oscMix:[0.25,0.55], drift:[3,7]}, inserts:{prob:0.65, max:1, pool:[["wah",{sens:[0.55,0.75], base:[240,380], range:[1.8,2.6], q:[4,6], mix:[0.6,0.7]}]]}},   // BALANCE LOOP 3 wah trim: mix capped at .6-.7 (full-wet wah trims the bass)
      lead:{patterns:["wander","blues","sparse"], samplerPool:["overdrive_guitar","distortion_guitar","solo_vox"], recipe:{model:["sampler","sampler","fm"], wave:"sine", voices:[1,2], spread:[0.002,0.005], cutoff:[2000,3200], drive:[0.25,0.4], vibrato:[0.003,0.008], level:[0.42,0.54], send:[0.38,0.52], dsend:[0.2,0.35], attack:0.01, release:[0.2,0.35], sustain:[0.65,0.78]}, inserts:{prob:0.55, max:2, pool:[["wah",{sens:[0.5,0.7], base:[320,460], range:[1.6,2.4], q:[3.5,5.5], mix:[0.6,0.7]}],["delay",{timeBars:[0.375,0.5], feedback:[0.25,0.4], tone:[2600,3400], wow:[0.15,0.3], mix:[0.25,0.4]}]]}},   // BALANCE LOOP 3 wah trim: mix capped at .6-.7. RING-CLASS: + a tape delay so the wah guitar smears across the choir cloud (fires on the fm synth draw)
      pads:{prob:0.75, samplerPool:["ahh_choir","synth_strings_1"], recipe:{model:["sampler","sampler","juno60"], wave:"saw", cutoff:[900,1500], detune:[0.004,0.009], attack:[0.5,1.2], chorus:[1.2,1.6], ensemble:[0.7,0.85], level:[0.45,0.6], send:[0.38,0.52], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom","808"], snareModel:["noise","crack"], hatModel:["noise"], kick:[1.1,1.35], snare:[0.75,1], hat:[0.7,1], tune:[0.9,1.05], send:[0.12,0.25], dsend:[0.05,0.15], kit:"room"},
      fx:{reverb:[0.4,0.55], delayBeats:[0.5,0.75], delayFb:[0.2,0.35], delayCut:[2000,3000], pump:[0,0.12], crackle:[0.1,0.25], lowcut:[25,40], highcut:[0,0], comp:[0.3,0.5], grit:[0.1,0.25]},
      found:{role:"bed", vol:[0.08,0.16], pitch:[0.8,0.95], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["vx_apollo","pool:voices*1","pool:road*1"]},
      hits:{sources:["pool:vb_cosmic_space*1","vox_a","vox_b","sp_energy"], pattern:"offbeat", prob:0.5},
      stab:["off","sparse"],
      form:"dj",
      theory:{adventure:[0.133,0.253], color:[0.333,0.55], voicing:"close", reharm:true},
      rhythm:[0.21,0.4],
      pipes:[{id:"ghost", w:0.55, prob:0.35},{id:"callResponse", w:0.5, level:0.85},{id:"strum", w:0.55, step:0.02}] },
    /* /genre-tool:chromeufo:genres */
    /* genre-tool:mirrorseven:genres */
    mirrorseven: { label:"Heptagram Vamp", info:"A four-on-the-floor at 96-103. Minimoog lead bass under a rhodes ep, with a clavinet. Neo-soul changes, swung.",
      bpm:[96,103],
      swing:[0.12,0.2],
      humanize:[0.18,0.35],
      progressions:["neosoul","ii_v_i","mode_dorian"],
      kits:["house","boombap"],
      fills:["off","drum fill","kit fill"],
      bass:{patterns:["syncopated","melodic","sixteenths"], recipe:{model:["modeld","modeld","sub"], cutoff:[400,700], res:[0.12,0.25], level:[1.1,1.3], send:[0,0.08], dsend:[0,0.05], glide:[20,40], envAmount:[1.2,2], envDecay:[0.08,0.14], oscMix:[0.2,0.5], drift:[2,6]}},
      lead:{patterns:["double","pentaup","updown"], patchPool:["CLAV    1","FUNK CLAV"], samplerPool:["clavinet","clavinet","clavinet","electric_piano"], recipe:{model:["sampler","sampler","sampler","dx7"], wave:"sine", voices:[1,2], spread:[0.001,0.004], cutoff:[2400,3600], level:[0.46,0.58], send:[0.15,0.3], dsend:[0.08,0.2], attack:0.003, release:[0.06,0.1], sustain:[0.5,0.62]}, inserts:{prob:0.5, max:1, pool:[["wah",{sens:[0.5,0.72], base:[300,450], range:[1.8,2.6], q:[4,6], mix:[0.65,0.85]}]]}},
      pads:{prob:0.6, samplerPool:["rhodes_ep","synth_strings_1"], recipe:{model:["sampler","fm"], wave:"sine", cutoff:[900,1500], detune:[0.003,0.008], attack:[0.15,0.5], level:[0.4,0.54], send:[0.25,0.4], dsend:[0.05,0.15]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[1,1.2], snare:[0.8,1.05], hat:[1.15,1.55], tune:[0.9,1.05], send:[0.08,0.18], dsend:[0.03,0.1], kit:"room"},
      fx:{reverb:[0.3,0.45], delayBeats:[0.5,0.75], delayFb:[0.12,0.25], delayCut:[2400,3400], pump:[0,0.1], crackle:[0.12,0.28], lowcut:[25,40], highcut:[9000,13000], comp:[0.42,0.6]},
      found:{role:"bed", vol:[0.05,0.1], pitch:[0.9,1.05], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:city*2"]},
      hits:{sources:["pool:vb_cosmic_space*1","bb_horn_b","bb_stab_b","pool:vocal_stab*1"], pattern:"sparse", prob:0.4},
      stab:["off","sparse"],
      form:"pop",
      timeFeel:{pushPull:{bass:0.013, hat:-0.005}},
      theory:{adventure:[0.317,0.5], color:[0.467,0.7], voicing:"drop2", reharm:true},
      rhythm:[0.21,0.4],
      pipes:[{id:"ghost", w:0.55, prob:0.35},{id:"sweepArc", w:0.45, lo:0.7, hi:2}] },
    /* /genre-tool:mirrorseven:genres */
    /* genre-tool:sundialsyrup:genres */
    sundialsyrup: { label:"Honeyed Entropy", info:"A half-time kit at 66-78. Finger bass under a rhodes ep, with a harmonica. Neo-soul changes, swung, loose timing.",
      bpm:[66,78],
      swing:[0.1,0.2],
      humanize:[0.3,0.5],
      progressions:["neosoul","ii_v_i","lofi"],
      kits:["halftime","boombap"],
      fills:["off","drum fill"],
      bass:{patterns:["melodic","simple","dub"], samplerPool:["finger_bass","fretless_bass"], recipe:{model:["sampler","sampler","sub"], cutoff:[400,750], res:[0.05,0.15], level:[0.9,1.1], send:[0.08,0.16], dsend:[0,0.05], attack:0.006, release:[0.1,0.16]}},
      lead:{patterns:["wander","sparse","blues"], patchPool:["HARMONICA1"], samplerPool:["harmonica","harmonica","rhodes_ep"], recipe:{model:["sampler","sampler","sampler","fm"], wave:"sine", voices:[1,2], spread:[0.001,0.004], cutoff:[2000,3200], vibrato:[0.004,0.01], level:[0.44,0.56], send:[0.35,0.55], dsend:[0.15,0.3], attack:0.02, release:[0.15,0.25], sustain:[0.7,0.82]}},
      pads:{prob:0.95, samplerPool:["rhodes_ep","electric_piano","strings"], recipe:{model:["sampler","sampler","fm"], wave:"sine", cutoff:[850,1400], detune:[0.003,0.008], attack:[0.3,0.9], level:[0.5,0.65], send:[0.35,0.55], dsend:[0.08,0.18]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.7,0.95], snare:[0.55,0.8], hat:[0.4,0.7], tune:[0.85,1], send:[0.2,0.35], dsend:[0.03,0.1], kit:"room"},
      fx:{reverb:[0.5,0.65], delayBeats:[0.5,0.75], delayFb:[0.15,0.3], delayCut:[2000,3000], pump:[0,0], crackle:[0.1,0.25], lowcut:[0,25], highcut:[9000,13000], comp:[0.15,0.3]},
      found:{role:"bed", vol:[0.06,0.12], pitch:[0.8,0.95], stretch:[0.45,0.6], cutoff:[1500,2500], sources:["pool:city*2","vx_dickinson"]},
      hits:{sources:["blues_vox_78","pool:vocal_stab*1"], pattern:"sparse", prob:0.3},
      stab:["off"],
      form:"aaba",
      timeFeel:{pushPull:{bass:0.015, snare:0.008}},
      theory:{adventure:[0.367,0.55], color:[0.533,0.783], voicing:"drop2", reharm:true},
      rhythm:[0.225,0.425],
      pipes:[{id:"ghost", w:0.55, prob:0.35},{id:"callResponse", w:0.5, level:0.85},{id:"harmonize", w:0.45, prob:0.35}] },
    /* /genre-tool:sundialsyrup:genres */
    /* genre-tool:sequinfreight:genres */
    sequinfreight: { label:"Mirrorball Tonnage", info:"A four-on-the-floor at 106-114. Slap bass under strings, with a brass section. A funk vamp, swung.",
      bpm:[106,114],
      swing:[0.06,0.12],
      humanize:[0.12,0.28],
      progressions:["funk_vamp","house_min7","neosoul"],
      kits:["four","open"],
      fills:["hat rush","drum fill","riser"],
      bass:{patterns:["octaves","syncopated","rolling"], samplerPool:["slap_bass"], recipe:{model:["sampler","modeld"], cutoff:[550,950], res:[0.1,0.2], level:[1.05,1.25], send:[0.03,0.08], dsend:[0,0.05], glide:[20,35], envAmount:[1,1.8], envDecay:[0.07,0.14], oscMix:[0.2,0.5], drift:[3,7]}, inserts:{prob:0.5, max:1, pool:[["wah",{sens:[0.5,0.72], base:[280,420], range:[1.8,2.5], q:[3.5,6], mix:[0.7,0.9]}]]}},
      lead:{patterns:["double","pentaup","updown"], samplerPool:["brass_section","trumpet","clean_guitar"], recipe:{model:["sampler","sampler","fm"], wave:"sine", voices:[1,2], spread:[0.002,0.005], cutoff:[2400,3600], level:[0.44,0.56], send:[0.25,0.4], dsend:[0.12,0.25], attack:0.005, release:[0.08,0.14], sustain:[0.58,0.7]}},
      pads:{prob:0.85, samplerPool:["strings","slow_strings"], recipe:{model:["sampler","strings"], wave:"saw", cutoff:[1100,1700], detune:[0.004,0.009], attack:[0.25,0.7], level:[0.44,0.58], send:[0.3,0.45], dsend:[0.05,0.15]}},
      drums:{kickModel:["909","boom"], snareModel:["noise","clap"], hatModel:["noise"], kick:[1.1,1.3], snare:[0.95,1.2], hat:[1,1.3], tune:[0.95,1.1], send:[0.12,0.25], dsend:[0.05,0.15], kit:"power"},
      fx:{reverb:[0.4,0.55], delayBeats:[0.375,0.5], delayFb:[0.15,0.3], delayCut:[2600,3800], pump:[0.22,0.38], crackle:[0.18,0.32], lowcut:[30,45], highcut:[8500,12500], comp:[0.35,0.55]},
      found:{role:"chops", vol:[0.12,0.2], pitch:[0.95,1.1], stretch:[0.4,0.6], cutoff:[2400,3800], sources:["stml_chop_c","stml_chop_d","bb_horn_b"]},
      hits:{sources:["pool:vb_transit*1","pool:horn_stab*1","bb_horn_a","sp_rhythm"], pattern:"offbeat", prob:0.6},
      stab:["offbeat","off"],
      form:"pop",
      theory:{adventure:[0.173,0.317], color:[0.433,0.65], voicing:"close", reharm:true},
      rhythm:[0.09,0.235],
      pipes:[{id:"strum", w:0.55, step:0.02},{id:"sweepArc", w:0.45, lo:0.7, hi:2}] },
    /* /genre-tool:sequinfreight:genres */
    /* genre-tool:rollerlacquer:genres */
    rollerlacquer: { label:"Lacquered Orbit", info:"AN electro kit at 110-118. FM lead bass under a Juno pad, with an FM lead. A funk vamp, swung.",
      bpm:[110,118],
      swing:[0.08,0.15],
      humanize:[0.05,0.18],
      progressions:["funk_vamp","neosoul","house_min7"],
      kits:["electro","four"],
      fills:["hat rush","cut","riser"],
      bass:{patterns:["stab","syncopated","octaves"], patchPool:["SYN-BASS 1","PLUCK BASS"], recipe:{model:["dx7","dx7","fm"], cutoff:[420,650], res:[0.1,0.2], level:[1.05,1.25], send:[0,0.06], dsend:[0,0.06], attack:0.003, release:[0.06,0.1]}},
      lead:{patterns:["pentaup","double","arpup"], patchPool:["E.PIANO 1","SYN-LEAD 2"], recipe:{model:["dx7","fm","synclead"], wave:"pulse", voices:[1,2], spread:[0.002,0.005], cutoff:[2600,3600], syncRatio:[1.3,1.7], syncSweep:[1,2], syncDecay:[0.12,0.22], level:[0.44,0.56], send:[0.25,0.4], dsend:[0.2,0.35], attack:0.004, release:[0.07,0.12], sustain:[0.6,0.72], fenv:[0.3,0.6]}, inserts:{prob:0.5, max:1, pool:[["chorus",{rate:[0.6,1.1], depth:[0.4,0.6], mix:[0.4,0.55]}]]}},
      pads:{prob:0.7, recipe:{model:["juno60","fm"], wave:"saw", cutoff:[1100,1800], detune:[0.005,0.01], attack:[0.3,0.9], chorus:[1.3,1.7], chorusSpread:[0.8,1], ensemble:[0.7,0.85], level:[0.42,0.56], send:[0.25,0.4], dsend:[0.08,0.18]}},
      drums:{kickModel:["909","808"], snareModel:["clap"], hatModel:["noise","metal"], kick:[1.15,1.35], snare:[0.95,1.2], hat:[0.9,1.2], tune:[0.95,1.1], send:[0.1,0.2], dsend:[0.05,0.15]},
      fx:{reverb:[0.3,0.45], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[2800,4000], pump:[0.25,0.45], crackle:[0,0.08], lowcut:[30,45], highcut:[0,0], comp:[0.4,0.6]},
      found:{role:"bed", vol:[0.06,0.12], pitch:[0.9,1.05], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["pool:road*1","pool:city*1","pool:voices*1"]},
      hits:{sources:["sp_rhythm","pool:vocal_stab*1","stml_hit_b3"], pattern:"offbeat", prob:0.6},
      stab:["offbeat","sparse"],
      form:"pop",
      theory:{adventure:[0.173,0.317], color:[0.433,0.65], voicing:"close", reharm:true},
      rhythm:[0.19,0.36],
      pipes:[{id:"sweepArc", w:0.45, lo:0.7, hi:2},{id:"vibratoSwell", w:0.4, depth:0.25}] },
    /* /genre-tool:rollerlacquer:genres */
    /* genre-tool:longshipwhip:genres */
    longshipwhip: { label:"Maelstrom Rowing Club", info:"A four-on-the-floor at 175-190. Picked bass under a palm muted guitar, with a crunch guitar. Phrygian, straight time, quantized tight, euclidean hats.",
      bpm:[175,190],
      swing:[0,0.02],
      humanize:[0,0.1],
      progressions:["mode_phrygian","minor_run","epic_min"],
      kits:["four","pulse"],
      fills:["impact","cut","snare roll","tom fill"],
      euclid:{kick:[7,16]},
      bass:{patterns:["sixteenths","drive","pedal"], samplerPool:["picked_bass"], recipe:{model:["sampler","saw"], cutoff:[480,820], res:[0.1,0.22], level:[1.15,1.4], send:[0,0.05], dsend:[0,0.05]}, inserts:{prob:1, max:1, pool:[["higain",{gate:[0.55,0.7], drive:[0.55,0.75], stages:2, low:0.55, mid:0.4, high:0.6, presence:[0.5,0.65]}]]}},   // BALANCE LOOP 3: thrash TIGHT-GATED — the oar-stroke bass chugs, gate high so the inter-stroke silence is silent
      lead:{patterns:["double","blues","hero"], samplerPool:["crunch_guitar","distortion_guitar","overdrive_guitar","di_guitar"], recipe:{model:["sampler","sampler"], wave:"saw", voices:[1,2], spread:[0.003,0.008], cutoff:[2600,3800], level:[0.54,0.7], send:[0.26,0.42], dsend:[0.1,0.22], attack:0.004, release:[0.3,0.6], sustain:[0.74,0.9]}, inserts:{prob:1, max:1, pool:[["higain",{gate:[0.3,0.45], drive:[0.65,0.85], stages:3, low:0.55, mid:0.4, high:0.6, presence:[0.55,0.7]}]]}},   // DEATH METAL (big reverb + chords, thick, never dry): the riff RINGS OUT — gate eased off the tail-choke, release + sustain up, reverb send up, 3 cascaded stages for a fuller scream
      pads:{prob:0.8, samplerPool:["palm_muted_guitar","distortion_guitar"], recipe:{model:["sampler","sampler"], wave:"saw", cutoff:[850,1500], detune:[0.006,0.014], attack:[0.02,0.1], release:[0.55,1.15], level:[0.64,0.82], send:[0.32,0.48], dsend:[0.08,0.16]}, inserts:{prob:1, max:1, pool:[["higain",{gate:[0.32,0.48], drive:[0.6,0.8], stages:2, low:0.62, mid:0.35, high:0.55, presence:[0.5,0.65]}]]}},   // DEATH METAL WALL: the power-chord wall RINGS — long release, gate eased so the chords sustain, reverb send up, octave-doubled (padDouble below)
      drums:{kickModel:["boom"], snareModel:["crack","noise"], hatModel:["metal","noise"], kick:[1.4,1.65], snare:[0.95,1.2], hat:[0.6,0.9], tune:[1,1.12], send:[0.06,0.14], dsend:[0.04,0.1]},
      fx:{reverb:[0.52,0.7], delayBeats:[0.375,0.5], delayFb:[0.2,0.34], delayCut:[2400,3600], pump:[0,0.08], crackle:[0,0.05], lowcut:[30,45], highcut:[0,0], comp:[0.6,0.85], grit:[0.55,0.8]},   // DEATH METAL: cavernous reverb (was 0.2-0.34 dry) + more delay feedback for the space
      found:{role:"bed", vol:[0.04,0.1], pitch:[0.85,1], stretch:[0.4,0.6], cutoff:[2000,3200], sources:["pool:industry*1","pool:road*1"]},
      hits:{sources:["pool:vb_maritime_weather*1","pool:vocal_stab*1","sp_energy"], pattern:"sparse", prob:0.25},
      stab:["off"],
      form:"pop",
      padDouble:true,   // WALL OF SOUND: octave-below power-chord double (death-metal thickness, like heavymetal)
      pipes:[],
      theory:{adventure:[0.133,0.24], color:[0.167,0.333], voicing:"close", reharm:true},
      rhythm:[0.14,0.3] },
    /* /genre-tool:longshipwhip:genres */
    /* genre-tool:bogironwallow:genres */
    bogironwallow: { label:"Sphagnum Requiem", info:"A half-time kit at 47-57. Reese bass under a cello, with a fuzz lead. A descending minor run, a light shuffle.",
      bpm:[47,57],
      swing:[0,0.05],
      humanize:[0.1,0.28],
      progressions:["minor_run","epic_min","drone_min"],
      kits:["halftime","kick"],
      fills:["off","downlift","impact"],
      bass:{patterns:["root","sub","pedal"], recipe:{model:["reese","sub"], cutoff:[180,330], res:[0.05,0.15], level:[1.25,1.5], send:[0.05,0.12], dsend:[0,0.06]}, inserts:{prob:0.9, max:1, pool:[["higain",{gate:[0.05,0.15], drive:[0.8,0.95], stages:3, low:0.75, mid:0.5, high:0.3, presence:[0.15,0.3]}]]}},   // BALANCE LOOP 3: doom saturated-loose sunk into the peat — max-drive 3-stage, no gate (every note decays into the bog), darkest tone in the wing
      lead:{patterns:["sparse","double","blues"], recipe:{model:["fuzz"], wave:"saw", voices:[1,2], spread:[0.003,0.008], cutoff:[1200,2000], res:[0.2,0.35], drive:[0.7,1], level:[0.5,0.62], send:[0.35,0.5], dsend:[0.15,0.3], attack:[0.02,0.06], release:[0.4,0.7], sustain:[0.85,0.95]}},
      pads:{prob:0.55, samplerPool:["cello","slow_strings"], recipe:{model:["strings","sampler","sampler"], wave:"saw", cutoff:[500,950], detune:[0.007,0.015], attack:[3,5], mellotron:true, level:[0.45,0.6], send:[0.5,0.7], dsend:[0.1,0.25]}},
      drums:{kickModel:["boom","808"], snareModel:["noise"], hatModel:["noise"], kick:[1.35,1.6], snare:[0.7,0.95], hat:[0.3,0.55], tune:[0.72,0.88], send:[0.2,0.35], dsend:[0.05,0.18]},
      fx:{reverb:[0.55,0.72], delayBeats:[0.75,1.5], delayFb:[0.3,0.45], delayCut:[1400,2400], pump:[0,0.05], crackle:[0.05,0.18], lowcut:[0,20], highcut:[0,0], comp:[0.45,0.7], grit:[0.6,0.9]},
      found:{role:"bed", vol:[0.16,0.28], pitch:[0.5,0.65], stretch:[0.45,0.6], cutoff:[1400,2400], sources:["frogs","pool:industry*1"]},
      hits:{sources:["pool:vocal_stab*1","sp_pressure"], pattern:"sparse", prob:0.2},
      stab:["off"],
      form:"storm",
      timeFeel:{pushPull:{kick:0.04, snare:0.06, bass:0.07}},
      reverbColor:"greyhole",
      pipes:[{id:"sweepArc", w:0.45, lo:0.7, hi:2}],
      theory:{adventure:[0.067,0.153], color:[0.117,0.3], voicing:"close", reharm:false},
      rhythm:[0.1,0.25] },
    /* /genre-tool:bogironwallow:genres */
    /* genre-tool:barrowwake:genres */
    barrowwake: { label:"Cairn Respiration", info:"A bare kick at 40-48. Sub bass under a church organ, with bells. A two-chord vamp, straight time.",
      bpm:[40,48],
      swing:[0,0.03],
      humanize:[0.1,0.3],
      progressions:["deep_two","drone_min","minor_run"],
      kits:["kick","kick","off"],
      fills:["off"],
      bass:{patterns:["root","sub","off"], recipe:{model:["sub","reese"], cutoff:[160,300], res:[0.05,0.12], level:[1.15,1.4], send:[0.1,0.25], dsend:[0,0.08]}, inserts:{prob:0.7, max:1, pool:[["distort",{drive:[0.5,0.8], mix:[0.7,0.95]}]]}},
      lead:{patterns:["sparse","off","off"], patchPool:["TUB BELLS","CHIMES"], recipe:{model:["bell","dx7"], wave:"sine", voices:[1,1], spread:[0.002,0.004], cutoff:[1800,2800], level:[0.34,0.46], send:[0.55,0.75], dsend:[0.3,0.45], attack:[0.01,0.05], release:[0.8,1.2], sustain:[0.9,1]}},
      pads:{prob:1, samplerPool:["church_organ","reed_organ"], recipe:{model:["organ","sampler","sampler"], wave:"saw", cutoff:[450,850], detune:[0.008,0.016], attack:[2.5,4.5], mellotron:true, level:[0.7,0.9], send:[0.65,0.85], dsend:[0.15,0.3]}, inserts:{prob:0.85, max:1, pool:[["higain",{gate:[0,0.08], drive:[0.45,0.65], stages:2, low:0.7, mid:0.5, high:0.35, presence:[0.15,0.3], mix:[0.7,0.9]}]]}},   // BALANCE LOOP 3: funeral doom's ORGAN-DREAD — the pipe organ exhaled THROUGH the dying amp: zero gate (the exhale never chokes), moderate saturation, dark, some dry organ bleeding past (mix<1)
      drums:{kickModel:["boom","808"], snareModel:["noise"], hatModel:["noise"], kick:[1.15,1.4], snare:[0.3,0.5], hat:[0.2,0.4], tune:[0.72,0.86], send:[0.3,0.5], dsend:[0.05,0.2]},
      fx:{reverb:[0.86,0.95], delayBeats:[1,1.5], delayFb:[0.45,0.6], delayCut:[1200,2200], pump:[0,0], crackle:[0,0.1], lowcut:[0,20], highcut:[0,0], comp:[0.3,0.55], grit:[0.45,0.75]},
      found:{role:"bed", vol:[0.2,0.32], pitch:[0.5,0.62], stretch:[0.45,0.6], cutoff:[1200,2200], sources:["pool:road*1","pool:room*1"]},
      hits:{sources:["sp_pressure","pool:vocal_stab*1"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"storm",
      timeFeel:{pushPull:{kick:0.05, bass:0.08}},
      reverbColor:"greyhole",
      theory:{adventure:[0.033,0.107], color:[0.133,0.317], voicing:"open", reharm:false},
      rhythm:[0.033,0.127],
      pipes:[{id:"densityArc", w:0.4, floor:0.6},{id:"sweepArc", w:0.45, lo:0.7, hi:2}] },
    /* /genre-tool:barrowwake:genres */
    /* genre-tool:ravensquall:genres */
    ravensquall: { label:"Whiteout Psalter", info:"A pulse kit at 160-174. Reese bass under a saw synth pad, with a fuzz lead. Bare triads, straight time, quantized tight.",
      bpm:[160,174],
      swing:[0,0.02],
      humanize:[0,0.12],
      progressions:["frost","minor_run","mode_phrygian"],
      kits:["pulse","four"],
      fills:["snare roll","cut","impact","off"],
      bass:{patterns:["drive","pedal","root"], recipe:{model:["reese","saw"], cutoff:[260,460], res:[0.1,0.22], level:[1.1,1.35], send:[0.05,0.12], dsend:[0,0.06]}, inserts:{prob:0.8, max:1, pool:[["distort",{drive:[0.5,0.8], mix:[0.75,1]}]]}},
      lead:{patterns:["motorik","arp16","double"], recipe:{model:["fuzz"], wave:"saw", voices:[1,2], spread:[0.004,0.009], cutoff:[1700,2700], res:[0.2,0.35], drive:[0.7,1], level:[0.5,0.62], send:[0.45,0.65], dsend:[0.2,0.35], attack:0.005, release:[0.15,0.3], sustain:[0.85,0.95]}},
      pads:{prob:1, recipe:{model:["saw","saw","strings"], wave:"saw", cutoff:[800,1500], detune:[0.014,0.022], attack:[0.3,0.9], level:[0.6,0.76], send:[0.5,0.7], dsend:[0.1,0.25]}, inserts:{prob:0.9, max:1, pool:[["higain",{gate:[0.1,0.22], drive:[0.6,0.8], stages:2, low:0.45, mid:0.5, high:0.65, presence:[0.55,0.7], mix:[0.8,0.95]}]]}},   // BALANCE LOOP 3: the tremolo-picked WALL — the pad wash driven into a trebly blizzard smear (high/presence up, low shelf cut), gate low so the wall sustains into the frost reverb
      drums:{kickModel:["808","boom"], snareModel:["noise"], hatModel:["noise"], kick:[1.05,1.3], snare:[0.7,0.95], hat:[0.95,1.3], tune:[0.9,1.05], send:[0.25,0.4], dsend:[0.05,0.15]},
      fx:{reverb:[0.7,0.85], delayBeats:[0.5,0.75], delayFb:[0.3,0.45], delayCut:[1800,2800], pump:[0,0.06], crackle:[0.15,0.3], lowcut:[25,40], highcut:[0,0], comp:[0.4,0.65], grit:[0.55,0.8]},
      found:{role:"bed", vol:[0.08,0.16], pitch:[0.6,0.78], stretch:[0.45,0.6], cutoff:[1600,2800], sources:["pool:road*1","pool:voices*1"]},
      hits:{sources:["pool:vb_rave_hardcore*1","sp_pressure","pool:vocal_stab*1"], pattern:"sparse", prob:0.2},
      stab:["off"],
      form:"dj",
      reverbColor:"dattorro",
      theory:{adventure:[0.133,0.24], color:[0.167,0.317], voicing:"quartal", reharm:true},
      rhythm:[0.08,0.22],
      pipes:[{id:"densityArc", w:0.4, floor:0.6},{id:"sweepArc", w:0.45, lo:0.7, hi:2}] },
    /* /genre-tool:ravensquall:genres */
    /* genre-tool:runeromp:genres */
    runeromp: { label:"Wolf Winter Ceilidh", info:"A tribal kit at 100-118. Sub bass under strings, with a fiddle. Primeval fifths, a light shuffle.",
      bpm:[100,118],
      swing:[0.02,0.08],
      humanize:[0.15,0.3],
      progressions:["primeval","mode_dorian","minor_run"],
      kits:["tribal","full"],
      fills:["tom fill","tom fill","downlift"],
      bass:{patterns:["sludge","pedal","root"], recipe:{model:["sub","saw"], cutoff:[240,440], res:[0.08,0.18], level:[1.05,1.3], send:[0.08,0.18], dsend:[0,0.08]}, inserts:{prob:0.5, max:1, pool:[["distort",{drive:[0.3,0.6], mix:[0.6,0.85]}]]}},
      lead:{patterns:["pentaup","updown","hero"], samplerPool:["fiddle","bagpipe"], recipe:{model:["sampler","sampler","kpluck"], wave:"saw", voices:[1,2], spread:[0.002,0.006], cutoff:[2200,3400], level:[0.5,0.64], send:[0.25,0.4], dsend:[0.15,0.3], vibrato:[0.006,0.012]}},
      pads:{prob:0.7, recipe:{model:["strings","choir","saw"], wave:"saw", cutoff:[700,1300], detune:[0.006,0.014], attack:[1.5,3], level:[0.45,0.6], send:[0.35,0.55], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom","808"], snareModel:["noise","crack"], hatModel:["noise"], kick:[1.3,1.55], snare:[0.7,0.95], hat:[0.5,0.8], tune:[0.85,1], send:[0.15,0.3], dsend:[0.1,0.25]},
      fx:{reverb:[0.45,0.62], delayBeats:[0.5,0.75], delayFb:[0.25,0.4], delayCut:[1800,2800], pump:[0,0.1], crackle:[0,0.12], lowcut:[25,40], highcut:[0,0], comp:[0.4,0.62], grit:[0.35,0.6]},
      found:{role:"bed", vol:[0.1,0.2], pitch:[0.7,0.85], stretch:[0.45,0.6], cutoff:[1800,3000], sources:["iriomote","pool:road*1"]},
      hits:{sources:["pool:vocal_stab*1","sp_rhythm"], pattern:"sparse", prob:0.3},
      stab:["off"],
      form:"pop",
      theory:{adventure:[0.133,0.257], color:[0.183,0.367], voicing:"close", reharm:true},
      rhythm:[0.235,0.45],
      pipes:[{id:"strum", w:0.55, step:0.02}] },
    /* /genre-tool:runeromp:genres */
    /* genre-tool:meadhallbellow:genres */
    meadhallbellow: { label:"Diaphragm Muster", info:"A tribal kit at 86-102. Sub bass under ahh choir, with ohh voices. Epic minor changes, a light shuffle.",
      bpm:[86,102],
      swing:[0,0.05],
      humanize:[0.1,0.25],
      progressions:["epic_min","drone_min","minor_run"],
      kits:["tribal","halftime"],
      fills:["tom fill","impact","off"],
      bass:{patterns:["root","pedal","sub"], recipe:{model:["sub","saw"], cutoff:[220,400], res:[0.05,0.15], level:[1.1,1.3], send:[0.1,0.2], dsend:[0,0.08]}, inserts:{prob:0.4, max:1, pool:[["distort",{drive:[0.3,0.55], mix:[0.6,0.85]}]]}},
      lead:{patterns:["anthem","roar","sparse"], samplerPool:["ohh_voices"], recipe:{model:["choir","vocoder","sampler"], wave:"saw", voices:[2,3], spread:[0.004,0.009], cutoff:[1600,2600], level:[0.5,0.64], send:[0.4,0.6], dsend:[0.2,0.35], vibrato:[0.004,0.008], attack:[0.1,0.3], release:[0.4,0.7], sustain:[0.85,0.95]}},
      pads:{prob:1, samplerPool:["ahh_choir"], recipe:{model:["choir","choir","vp330","sampler"], wave:"saw", cutoff:[600,1200], detune:[0.006,0.012], attack:[1.5,3.5], vowel:[0.3,0.45], ensemble:[0.7,0.9], level:[0.6,0.78], send:[0.5,0.7], dsend:[0.1,0.25]}},
      drums:{kickModel:["boom"], snareModel:["crack","noise"], hatModel:["noise"], kick:[1.5,1.75], snare:[1,1.25], hat:[0.3,0.55], tune:[0.8,0.95], send:[0.2,0.35], dsend:[0.1,0.25]},
      fx:{reverb:[0.6,0.78], delayBeats:[0.75,1], delayFb:[0.25,0.4], delayCut:[1600,2600], pump:[0,0.06], crackle:[0,0.08], lowcut:[0,25], highcut:[0,0], comp:[0.4,0.65], grit:[0.25,0.5]},
      found:{role:"bed", vol:[0.2,0.32], pitch:[0.72,0.88], stretch:[0.45,0.6], cutoff:[1600,2800], sources:["vx_sv_choir","vx_sv_march"]},
      hits:{sources:["ca_horn","pool:vocal_stab*1"], pattern:"sparse", prob:0.35},
      stab:["off"],
      form:"anthem",
      reverbColor:"fdn",
      theory:{adventure:[0.067,0.153], color:[0.117,0.3], voicing:"close", reharm:false},
      rhythm:[0.25,0.475],
      pipes:[{id:"harmonize", w:0.45, prob:0.35}] },
    /* /genre-tool:meadhallbellow:genres */
    /* genre-tool:valkyrieswoop:genres */
    valkyrieswoop: { label:"Soprano Ballistics", info:"A four-on-the-floor at 144-156. Picked bass under slow strings, with a solo vox. Epic minor changes, straight time, euclidean hats.",
      bpm:[144,156],
      swing:[0,0.03],
      humanize:[0.03,0.12],
      progressions:["epic_min","canon","minor_run"],
      kits:["four","pulse"],
      fills:["impact","riser","tom fill"],
      euclid:{kick:[7,16]},
      bass:{patterns:["drive","pedal","sixteenths"], samplerPool:["picked_bass"], recipe:{model:["sampler","saw"], cutoff:[500,850], res:[0.1,0.22], level:[1.2,1.4], send:[0,0.06], dsend:[0,0.05]}, inserts:{prob:0.9, max:1, pool:[["higain",{gate:[0.4,0.55], drive:[0.55,0.75], stages:2, low:0.6, mid:0.5, high:0.55, presence:[0.5,0.65]}]]}},   // BALANCE LOOP 3: the IRON WALL under the strings — staged amp on the picked bass, moderate gate (double-kick tight but the strings above stay untouched)
      lead:{patterns:["hero","anthem","updown"], samplerPool:["solo_vox","violin"], recipe:{model:["sampler","sampler","stack"], wave:"saw", voices:[1,2], spread:[0.003,0.008], cutoff:[2600,3800], level:[0.52,0.66], send:[0.35,0.5], dsend:[0.15,0.3], vibrato:[0.006,0.012]}},
      pads:{prob:1, samplerPool:["slow_strings","strings"], recipe:{model:["strings","strings","solina","sampler"], wave:"saw", cutoff:[900,1600], detune:[0.005,0.012], attack:[0.6,1.8], ensemble:[0.7,0.9], level:[0.55,0.72], send:[0.4,0.6], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom","909"], snareModel:["crack","noise"], hatModel:["metal","noise"], kick:[1.4,1.65], snare:[0.85,1.1], hat:[0.6,0.9], tune:[0.95,1.1], send:[0.2,0.35], dsend:[0.08,0.2]},
      fx:{reverb:[0.55,0.72], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[2200,3400], pump:[0,0.1], crackle:[0,0.05], lowcut:[28,42], highcut:[0,0], comp:[0.55,0.8], grit:[0.45,0.7]},
      found:{role:"bed", vol:[0.05,0.12], pitch:[0.8,0.95], stretch:[0.4,0.6], cutoff:[2000,3200], sources:["pool:city*1","pool:road*1"]},
      hits:{sources:["pool:vocal_stab*1","sp_pressure"], pattern:"sparse", prob:0.25},
      stab:["off"],
      form:"pop",
      reverbColor:"dattorro",
      masterComp:0.35,
      theory:{adventure:[0.117,0.24], color:[0.183,0.367], voicing:"close", reharm:true},
      rhythm:[0.14,0.3],
      pipes:[{id:"harmonize", w:0.45, prob:0.35},{id:"sweepArc", w:0.45, lo:0.7, hi:2},{id:"vibratoSwell", w:0.4, depth:0.25}] },
    /* /genre-tool:valkyrieswoop:genres */
    /* genre-tool:permafrostveil:genres */
    permafrostveil: { label:"Glacial Reliquary", info:"Beatless at 54-68. Sub bass under bowed glass, with a music box. Bare triads.",
      bpm:[54,68],
      swing:[0,0.03],
      humanize:[0.1,0.3],
      progressions:["frost","frost","epic_min"],
      kits:["off"],
      fills:["off"],
      bass:{patterns:["off","root"], recipe:{model:["sub"], cutoff:[220,400], res:[0.05,0.12], level:[0.6,0.85], send:[0.2,0.4], dsend:[0,0.1]}},
      lead:{patterns:["sparse","wander","off"], samplerPool:["music_box","celesta","glockenspiel"], recipe:{model:["bell","sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.002,0.005], cutoff:[2400,3600], level:[0.34,0.46], send:[0.55,0.75], dsend:[0.3,0.45], attack:[0.01,0.05], release:[0.5,0.9], sustain:[0.85,0.95]}},
      pads:{prob:1, patchPool:["SHIMMER","ORCH-CHIME","TUB BELLS"], samplerPool:["bowed_glass","ahh_choir"], recipe:{model:["vp330","strings","dx7","sampler"], wave:"saw", cutoff:[800,1500], detune:[0.005,0.012], attack:[3,5], vowel:[0.4,0.55], ensemble:[0.7,0.9], level:[0.6,0.8], send:[0.6,0.8], dsend:[0.15,0.3]}},
      drums:{kickModel:["808"], snareModel:["noise"], hatModel:["noise"], kick:[0.4,0.6], snare:[0.3,0.5], hat:[0.25,0.45], tune:[0.85,1], send:[0.3,0.5], dsend:[0,0.1]},
      fx:{reverb:[0.82,0.92], delayBeats:[1,1.5], delayFb:[0.4,0.55], delayCut:[2000,3200], pump:[0,0], crackle:[0.2,0.38], lowcut:[0,0], highcut:[0,0], comp:[0,0.15]},
      found:{role:"bed", vol:[0.18,0.3], pitch:[0.55,0.72], stretch:[0.45,0.6], cutoff:[1800,3000], sources:["pool:room*1","pool:voices*1"]},
      thunk:{prob:[0.15,0.3], amp:[0.02,0.032]},
      hits:{sources:["pool:chime*1","sp_herenow"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"wave",
      reverbColor:"dattorro",
      theory:{adventure:[0.1,0.2], color:[0.1,0.267], voicing:"open", reharm:true},
      rhythm:[0,0.08],
      pipes:[{id:"densityArc", w:0.4, floor:0.6},{id:"harmonize", w:0.45, prob:0.35}] },
    /* /genre-tool:permafrostveil:genres */
    /* genre-tool:crateflip:genres */
    crateflip: { label:"Shellac Excavation", info:"A boom-bap kit at 94-102. Acoustic bass under strings, with a rhodes ep. Neo-soul changes, swung.",
      timeFeel:{ pushPullMs:{ bass:8, hat:-4 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — DILLA DRAG: the upright walking under a chopped 78 sits behind the knock
      bpm:[94,102],
      swing:[0.08,0.18],
      humanize:[0.12,0.3],
      progressions:["neosoul","ii_v_i","lofi","mode_dorian"],
      kits:["boombap","breaks"],
      fills:["off","drum fill","downlift"],
      bass:{patterns:["simple","walking","dub"], samplerPool:["acoustic_bass","finger_bass"], recipe:{model:["sampler","sub"], cutoff:[320,580], res:[0.05,0.15], level:[1.05,1.3], send:[0.05,0.12], dsend:[0,0.05]}},
      lead:{patterns:["sparse","pentaup","wander"], samplerPool:["rhodes_ep","jazz_guitar","muted_trumpet"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.002,0.005], cutoff:[1900,3000], level:[0.4,0.52], send:[0.3,0.45], dsend:[0.15,0.3], attack:0.02, release:[0.12,0.2], sustain:[0.66,0.78]}},
      pads:{prob:0.6, samplerPool:["strings"], recipe:{model:["sampler","fm"], wave:"sine", cutoff:[900,1500], detune:[0.003,0.008], attack:[0.6,1.5], level:[0.46,0.6], send:[0.3,0.45], dsend:[0.1,0.2]}},
      drums:{kickModel:["boom","808"], snareModel:["crack","noise"], hatModel:["noise"], kick:[1.1,1.35], snare:[0.85,1.1], hat:[0.6,0.9], tune:[0.9,1.05], send:[0.1,0.22], dsend:[0.05,0.15], kit:"room"},
      fx:{reverb:[0.35,0.5], delayBeats:[0.5,0.75], delayFb:[0.2,0.35], delayCut:[1800,2800], pump:[0,0.1], crackle:[0.25,0.5], lowcut:[0,25], highcut:[0,0], comp:[0.3,0.5]},
      found:{role:"chops", scratch:0.18, vol:[0.16,0.28], pitch:[0.95,1.1], stretch:[0.4,0.55], cutoff:[2400,3800], sources:["blues_vox_78","stml_chop_a","stml_chop_b","stml_chop_c","stml_chop_d","vx_timelady"]},   // scratch: the flip IS the art — ~1-in-5 soul-78 chops get the fwd↔back hand
      hits:{sources:["pool:vb_junglist*1","bb_horn_a","bb_horn_b","sp_rewind","pool:vocal_stab*1"], pattern:"sparse", prob:0.5},
      stab:["off"],
      form:"pop",
      theory:{adventure:[0.325,0.5], color:[0.475,0.713], voicing:"drop2", reharm:true},
      rhythm:[0.4,0.625],
      pipes:[{id:"ghost", w:0.55, prob:0.35},{id:"strum", w:0.55, step:0.02}] },
    /* /genre-tool:crateflip:genres */
    /* genre-tool:lowglide:genres */
    lowglide: { label:"Hydraulic Mirage", info:"A boom-bap kit at 88-96. Sub bass under strings, with a saw synth lead. A funk vamp, swung.",
      timeFeel:{ pushPullMs:{ bass:-5, snare:7, hat:-3 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — WEST-COAST FUNK: the g-funk pocket — sub on top, snare dragged, hats riding ahead
      bpm:[88,96],
      swing:[0.06,0.16],
      humanize:[0.1,0.25],
      progressions:["funk_vamp","mode_dorian","minor_run"],
      kits:["boombap","halftime"],
      fills:["off","drum fill","downlift"],
      bass:{patterns:["syncopated","simple","dub"], recipe:{model:["sub"], cutoff:[220,400], res:[0.05,0.15], level:[1.2,1.45], send:[0,0.06], dsend:[0,0.05]}},
      lead:{patterns:["wander","pentaup","sparse"], recipe:{model:["saw","modeld"], wave:"saw", voices:[1,1], spread:[0.001,0.003], cutoff:[2600,3800], level:[0.44,0.56], send:[0.3,0.45], dsend:[0.15,0.3], vibrato:[0.006,0.012], glide:[90,180], octave:0.2, attack:0.015, release:[0.15,0.25], sustain:[0.75,0.85]}},
      pads:{prob:0.8, samplerPool:["strings","rhodes_ep"], recipe:{model:["sampler","saw"], wave:"saw", cutoff:[900,1500], detune:[0.004,0.009], attack:[0.6,1.6], level:[0.48,0.62], send:[0.3,0.48], dsend:[0.1,0.2]}},
      drums:{kickModel:["808","boom"], snareModel:["crack","clap"], hatModel:["noise"], kick:[1.15,1.4], snare:[0.8,1.05], hat:[0.6,0.9], tune:[0.9,1.05], send:[0.12,0.25], dsend:[0.05,0.15]},
      fx:{reverb:[0.35,0.5], delayBeats:[0.5,0.75], delayFb:[0.2,0.35], delayCut:[2000,3000], pump:[0,0.12], crackle:[0.1,0.3], lowcut:[0,25], highcut:[0,0], comp:[0.3,0.5]},
      found:{role:"bed", vol:[0.05,0.12], pitch:[0.85,1], stretch:[0.45,0.6], cutoff:[1800,3000], sources:["pool:road*1","pool:city*1"]},
      hits:{sources:["pool:vocal_stab*1","sp_slowdown","sp_nightdrive"], pattern:"sparse", prob:0.35},
      stab:["off","sparse"],
      form:"vamp",
      theory:{adventure:[0.117,0.24], color:[0.25,0.433], voicing:"close", reharm:true},
      rhythm:[0.225,0.425],
      pipes:[{id:"ghost", w:0.55, prob:0.35},{id:"sweepArc", w:0.45, lo:0.7, hi:2},{id:"vibratoSwell", w:0.4, depth:0.25}] },
    /* /genre-tool:lowglide:genres */
    /* genre-tool:subrattle:genres */
    subrattle: { label:"Infrasound Omen", info:"A trap kit at 136-144. Sub bass under strings, with a kalimba. A two-chord minor drone, straight time.",
      bpm:[136,144],
      swing:[0,0.04],
      humanize:[0.03,0.12],
      progressions:["drone_min","mode_phrygian","deep_two"],
      kits:["trap"],
      fills:["cut","off","downlift","riser"],
      bass:{patterns:["sub","stab","pedal"], recipe:{model:["sub"], cutoff:[170,320], res:[0.05,0.15], level:[1.3,1.55], send:[0,0.05], dsend:[0,0.05]}},
      lead:{patterns:["sparse","pentaup","off"], samplerPool:["kalimba","music_box"], recipe:{model:["sampler","pluck"], wave:"sine", voices:[1,2], spread:[0.002,0.005], cutoff:[1800,3000], level:[0.38,0.5], send:[0.35,0.55], dsend:[0.25,0.45], attack:0.004, release:[0.1,0.18], sustain:[0.55,0.68]}},
      pads:{prob:0.4, samplerPool:["strings"], recipe:{model:["sampler","saw"], wave:"saw", cutoff:[600,1100], detune:[0.005,0.012], attack:[1,2.2], level:[0.38,0.5], send:[0.4,0.6], dsend:[0.1,0.25]}},
      drums:{kickModel:["808"], snareModel:["crack","clap"], hatModel:["noise"], kick:[1.25,1.5], snare:[0.75,1], hat:[1.15,1.5], tune:[0.85,1], send:[0.1,0.22], dsend:[0.08,0.2]},
      fx:{reverb:[0.3,0.45], delayBeats:[0.375,0.75], delayFb:[0.2,0.35], delayCut:[2000,3200], pump:[0.05,0.2], crackle:[0,0.08], lowcut:[20,35], highcut:[0,0], comp:[0.35,0.55]},
      found:{role:"bed", vol:[0.04,0.1], pitch:[0.85,1], stretch:[0.45,0.6], cutoff:[1800,3000], sources:["pool:road*1","pool:industry*1"]},
      hits:{sources:["pool:vocal_stab*1","sp_pressure","sp_rewind"], pattern:"dub", prob:0.5},
      stab:["off"],
      form:"dj",
      theory:{adventure:[0.067,0.133], color:[0.167,0.35], voicing:"open", reharm:false},
      rhythm:[0.35,0.6],
      pipes:[{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:subrattle:genres */
    /* genre-tool:hollerknock:genres */
    hollerknock: { label:"Trunk Poltergeist", info:"A trap kit at 74-82. Sub bass under a saw synth pad, with brass. Phrygian, a light shuffle.",
      bpm:[74,82],
      swing:[0,0.06],
      humanize:[0.04,0.14],
      progressions:["mode_phrygian","drone_min","minor_run"],
      kits:["trap","halftime"],
      fills:["impact","cut","off","riser"],
      bass:{patterns:["sub","stab","root"], recipe:{model:["sub"], cutoff:[180,340], res:[0.05,0.15], level:[1.3,1.55], send:[0,0.05], dsend:[0,0.05]}},
      lead:{patterns:["double","anthem","sparse"], recipe:{model:["brass","saw"], wave:"saw", voices:[2,3], spread:[0.004,0.009], cutoff:[1800,2800], level:[0.48,0.6], send:[0.25,0.4], dsend:[0.15,0.3], attack:0.008, release:[0.12,0.2], sustain:[0.6,0.72]}},
      pads:{prob:0.5, recipe:{model:["saw","strings"], wave:"saw", cutoff:[600,1100], detune:[0.005,0.012], attack:[0.8,1.8], level:[0.4,0.54], send:[0.35,0.55], dsend:[0.1,0.25]}},
      drums:{kickModel:["808"], snareModel:["clap","crack"], hatModel:["noise"], kick:[1.35,1.6], snare:[1,1.25], hat:[0.8,1.1], tune:[0.85,1], send:[0.15,0.3], dsend:[0.08,0.2]},
      fx:{reverb:[0.35,0.5], delayBeats:[0.5,0.75], delayFb:[0.2,0.35], delayCut:[1800,3000], pump:[0.2,0.4], crackle:[0,0.1], lowcut:[20,35], highcut:[0,0], comp:[0.45,0.7]},
      found:{role:"bed", vol:[0.04,0.1], pitch:[0.85,1], stretch:[0.45,0.6], cutoff:[1800,3000], sources:["pool:industry*1","pool:road*1"]},
      hits:{sources:["pool:rave_stab*2","pool:vocal_stab*1","sp_energy"], pattern:"offbeat", prob:0.7},
      stab:["off"],
      form:"dj",
      theory:{adventure:[0.1,0.187], color:[0.167,0.333], voicing:"close", reharm:false},
      rhythm:[0.25,0.475],
      pipes:[{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:hollerknock:genres */
    /* genre-tool:flannelburst:genres */
    flannelburst: { label:"Thrift Store Supernova", info:"A four-on-the-floor at 114-124. Picked bass with a distortion guitar on both pad and lead. A descending minor run, a light shuffle.",
      bpm:[114,124],
      swing:[0,0.05],
      humanize:[0.12,0.3],
      progressions:["minor_run","sad_pop","epic_min","four_chords","interchange"],
      kits:["four","open","halftime"],
      fills:["impact","drum fill","riser","cut"],
      bass:{patterns:["drive","root","simple"], samplerPool:["picked_bass"], recipe:{model:["sampler","saw"], cutoff:[420,750], res:[0.1,0.22], level:[1.15,1.4], send:[0,0.06], dsend:[0,0.05]}, inserts:{prob:1, max:1, pool:[["distort",{drive:[0.45,0.7], mix:[0.7,0.9]}]]}},
      lead:{patterns:["blues","anthem","double","hero"], samplerPool:["distortion_guitar","overdrive_guitar"], recipe:{model:["sampler","sampler"], wave:"saw", voices:[1,2], spread:[0.003,0.008], cutoff:[2400,3600], level:[0.54,0.7], send:[0.28,0.42], dsend:[0.1,0.22], attack:0.006, release:[0.2,0.4], sustain:[0.7,0.85]}, inserts:{prob:1, max:1, pool:[["distort",{drive:[0.55,0.8], mix:[0.8,1]}]]}},   // RING-CLASS tails: fuzz-wall chorus rings out (all-sampler voice — no motion insert survives constrain; send/release/sustain carry the tail). TODO(guitar-library): swap in crunch_guitar (power-chord hits pool) when the parallel sampler batch lands — the FluidR3 guitars through the folded heavy strip (constrain: sampler+distort => heavyDriveOf) are the polite stand-in
      pads:{prob:0.75, samplerPool:["distortion_guitar","palm_muted_guitar"], recipe:{model:["sampler","sampler"], wave:"saw", cutoff:[800,1400], detune:[0.004,0.01], attack:[0.02,0.1], release:[0.25,0.5], level:[0.5,0.66], send:[0.24,0.38], dsend:[0.06,0.16]}, inserts:{prob:1, max:1, pool:[["distort",{drive:[0.5,0.75], mix:[0.7,0.95]}]]}},
      drums:{kickModel:["boom"], snareModel:["crack","noise"], hatModel:["noise"], kick:[1.2,1.45], snare:[1,1.3], hat:[0.5,0.8], tune:[0.95,1.08], send:[0.15,0.3], dsend:[0.05,0.15], kit:"room"},
      fx:{reverb:[0.36,0.5], delayBeats:[0.375,0.5], delayFb:[0.15,0.28], delayCut:[2200,3400], pump:[0,0.08], crackle:[0.05,0.2], lowcut:[25,40], highcut:[0,0], comp:[0.45,0.7], grit:[0.3,0.55]},
      found:{role:"bed", vol:[0.04,0.1], pitch:[0.85,1], stretch:[0.4,0.6], cutoff:[1800,3000], sources:["pool:industry*1","pool:road*1"]},
      hits:{sources:["pool:vocal_stab*1","sp_pressure"], pattern:"sparse", prob:0.2},
      stab:["off"],
      form:"anthem",
      theory:{adventure:[0.1,0.205], color:[0.138,0.3], voicing:"close", reharm:true},
      rhythm:[0.11,0.273],
      pipes:[{id:"callResponse", w:0.5, level:0.85},{id:"strum", w:0.55, step:0.02}] },
    /* /genre-tool:flannelburst:genres */
    /* genre-tool:drywire:genres */
    drywire: { label:"Ohmic Grievance", info:"A four-on-the-floor at 100-112. Picked bass with an overdrive guitar on both pad and lead. A descending minor run, straight time.",
      bpm:[100,112],
      swing:[0,0.04],
      humanize:[0.1,0.25],
      progressions:["minor_run","mode_phrygian","drone_min"],
      kits:["four","open"],
      fills:["cut","impact","off","drum fill"],
      bass:{patterns:["drive","root","octaves"], samplerPool:["picked_bass"], recipe:{model:["sampler"], cutoff:[550,950], res:[0.15,0.3], level:[1.2,1.45], send:[0,0.04], dsend:[0,0.04]}, inserts:{prob:1, max:1, pool:[["distort",{drive:[0.3,0.5], mix:[0.5,0.75]}]]}},
      lead:{patterns:["double","blues","sparse"], samplerPool:["overdrive_guitar","distortion_guitar"], recipe:{model:["sampler","sampler"], wave:"saw", voices:[1,2], spread:[0.003,0.007], cutoff:[2800,4200], level:[0.52,0.66], send:[0.05,0.12], dsend:[0.04,0.1], attack:0.004, release:[0.08,0.16], sustain:[0.5,0.65]}, inserts:{prob:1, max:1, pool:[["distort",{drive:[0.35,0.55], mix:[0.6,0.85]}]]}},   // TODO(guitar-library): swap in di_guitar when the parallel sampler batch lands — the abrasive DI clank is the identity; moderate folded-strip distort is the stand-in
      pads:{prob:0.25, samplerPool:["overdrive_guitar"], recipe:{model:["sampler"], wave:"saw", cutoff:[900,1500], detune:[0.003,0.008], attack:[0.02,0.08], release:[0.1,0.25], level:[0.42,0.56], send:[0.05,0.12], dsend:[0.03,0.08]}},
      drums:{kickModel:["boom"], snareModel:["crack"], hatModel:["noise"], kick:[1.25,1.5], snare:[1.05,1.35], hat:[0.5,0.8], tune:[0.95,1.1], send:[0.04,0.1], dsend:[0.02,0.08], kit:"room"},
      fx:{reverb:[0.08,0.18], delayBeats:[0.375,0.5], delayFb:[0.1,0.2], delayCut:[2400,3600], pump:[0,0.06], crackle:[0,0.1], lowcut:[25,40], highcut:[0,0], comp:[0.25,0.45], grit:[0.2,0.4]},
      found:{role:"bed", vol:[0.03,0.08], pitch:[0.9,1], stretch:[0.4,0.6], cutoff:[2000,3200], sources:["pool:industry*1"]},
      hits:{sources:["pool:vocal_stab*1","sp_pressure"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"pop",
      theory:{adventure:[0.1,0.187], color:[0.167,0.333], voicing:"close", reharm:false},
      rhythm:[0.09,0.235],
      pipes:[{id:"callResponse", w:0.5, level:0.85},{id:"strum", w:0.55, step:0.02}] },
    /* /genre-tool:drywire:genres */
    /* genre-tool:heartsprint:genres */
    heartsprint: { label:"Tachycardia Anthem", info:"A four-on-the-floor at 158-170. Picked bass under a palm muted guitar, with an overdrive guitar. Four-chord changes, straight time.",
      bpm:[158,170],
      swing:[0,0.03],
      humanize:[0.05,0.15],
      progressions:["four_chords","sad_pop","doo_wop"],
      kits:["four","pulse"],
      fills:["drum fill","snare roll","impact","riser"],
      bass:{patterns:["drive","root","octaves"], samplerPool:["picked_bass"], recipe:{model:["sampler","saw"], cutoff:[450,800], res:[0.1,0.22], level:[1.15,1.4], send:[0,0.05], dsend:[0,0.05]}, inserts:{prob:1, max:1, pool:[["distort",{drive:[0.4,0.65], mix:[0.65,0.85]}]]}},
      lead:{patterns:["anthem","hero","double"], samplerPool:["overdrive_guitar","distortion_guitar"], recipe:{model:["sampler","sampler"], wave:"saw", voices:[1,2], spread:[0.003,0.008], cutoff:[2600,3800], level:[0.54,0.7], send:[0.22,0.36], dsend:[0.12,0.24], attack:0.004, release:[0.1,0.18], sustain:[0.6,0.72]}, inserts:{prob:1, max:1, pool:[["distort",{drive:[0.5,0.75], mix:[0.75,0.95]}]]}},   // TODO(guitar-library): swap in crunch_guitar (downstroke power-chord pool) when the parallel sampler batch lands
      pads:{prob:0.8, samplerPool:["palm_muted_guitar","distortion_guitar"], recipe:{model:["sampler","sampler"], wave:"saw", cutoff:[800,1400], detune:[0.004,0.01], attack:[0.01,0.06], release:[0.1,0.24], level:[0.5,0.66], send:[0.18,0.32], dsend:[0.06,0.16]}, inserts:{prob:1, max:1, pool:[["distort",{drive:[0.45,0.7], mix:[0.7,0.9]}]]}},
      drums:{kickModel:["boom","909"], snareModel:["crack","noise"], hatModel:["noise"], kick:[1.25,1.5], snare:[1,1.25], hat:[0.7,1], tune:[0.98,1.1], send:[0.12,0.24], dsend:[0.05,0.15]},
      fx:{reverb:[0.25,0.4], delayBeats:[0.375,0.5], delayFb:[0.15,0.28], delayCut:[2400,3600], pump:[0,0.08], crackle:[0,0.1], lowcut:[25,40], highcut:[0,0], comp:[0.5,0.75], grit:[0.25,0.45]},
      found:{role:"bed", vol:[0.04,0.09], pitch:[0.85,1], stretch:[0.4,0.6], cutoff:[2000,3200], sources:["pool:road*1","pool:city*1"]},
      hits:{sources:["pool:vocal_stab*1","sp_energy"], pattern:"sparse", prob:0.2},
      stab:["off"],
      form:"anthem",
      theory:{adventure:[0.1,0.2], color:[0.183,0.35], voicing:"close", reharm:true},
      rhythm:[0.08,0.22],
      pipes:[{id:"strum", w:0.55, step:0.02}] },
    /* /genre-tool:heartsprint:genres */
    /* genre-tool:bouffantbeat:genres */
    bouffantbeat: { label:"Beehive Antenna", info:"A four-on-the-floor at 116-124. Picked bass under a percussive organ, with a clean guitar. Doo-wop changes, a light shuffle.",
      bpm:[116,124],
      swing:[0.02,0.1],
      humanize:[0.15,0.3],
      progressions:["doo_wop","four_chords","pop_1625"],
      kits:["four","open","full"],
      fills:["drum fill","tom fill","snare roll","off"],
      bass:{patterns:["root","simple","walking"], samplerPool:["picked_bass","finger_bass"], recipe:{model:["sampler","sampler"], cutoff:[380,680], res:[0.05,0.15], level:[1.05,1.3], send:[0.03,0.1], dsend:[0,0.05]}},
      lead:{patterns:["double","pentaup","updown","wander"], samplerPool:["clean_guitar","jazz_guitar"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.002,0.005], cutoff:[2200,3400], level:[0.44,0.56], send:[0.25,0.4], dsend:[0.12,0.24], attack:0.006, release:[0.1,0.18], sustain:[0.6,0.72]}, inserts:{prob:0.8, max:1, pool:[["tremolo",{rate:[4,6.5], depth:[0.5,0.75], shape:[0.2,0.5], mix:[0.6,0.85]}]]}},
      pads:{prob:0.85, samplerPool:["percussive_organ","rock_organ"], recipe:{model:["sampler","sampler"], wave:"saw", cutoff:[1000,1700], detune:[0.003,0.008], attack:[0.04,0.2], level:[0.44,0.58], send:[0.25,0.4], dsend:[0.1,0.22]}},
      drums:{kickModel:["boom"], snareModel:["crack","noise"], hatModel:["noise"], kick:[1,1.25], snare:[0.85,1.1], hat:[0.6,0.9], tune:[0.95,1.1], send:[0.15,0.28], dsend:[0.05,0.15], kit:"acoustic"},
      fx:{reverb:[0.32,0.46], delayBeats:[0.375,0.5], delayFb:[0.12,0.24], delayCut:[2200,3400], pump:[0.1,0.22], crackle:[0,0.06], lowcut:[20,35], highcut:[0,0], comp:[0.25,0.45]},
      found:{role:"bed", vol:[0.04,0.1], pitch:[0.9,1], stretch:[0.45,0.6], cutoff:[2000,3200], sources:["pool:city*2"]},
      hits:{sources:["pool:vocal_stab*1","stml_hit_01","pool:chime*1"], pattern:"sparse", prob:0.3},
      stab:["off","sparse"],
      form:"aaba",
      theory:{adventure:[0.1,0.207], color:[0.233,0.417], voicing:"close", reharm:true},
      rhythm:[0.1,0.257],
      pipes:[{id:"strum", w:0.55, step:0.02},{id:"harmonize", w:0.45, prob:0.35}] },
    /* /genre-tool:bouffantbeat:genres */
    /* genre-tool:chantcircuit:genres */
    chantcircuit: { label:"Agitprop Oscillator", info:"AN electro kit at 122-130. Saw synth bass with a saw synth on both pad and lead. A descending minor run, a light shuffle.",
      bpm:[122,130],
      swing:[0,0.05],
      humanize:[0.03,0.12],
      progressions:["minor_run","sad_pop","drone_min"],
      kits:["electro","pulse","four"],
      fills:["cut","impact","snare roll","off"],
      bass:{patterns:["drive","octaves","stab"], recipe:{model:["saw"], cutoff:[420,760], res:[0.2,0.35], level:[1.1,1.35], send:[0,0.06], dsend:[0,0.05]}, inserts:{prob:0.6, max:1, pool:[["distort",{drive:[0.25,0.45], mix:[0.5,0.75]}]]}},
      lead:{patterns:["double","updown","sparse"], recipe:{model:["saw","vocoder"], wave:"saw", voices:[1,2], spread:[0.002,0.006], cutoff:[2400,3600], level:[0.44,0.56], send:[0.15,0.28], dsend:[0.1,0.22], attack:0.005, release:[0.08,0.16], sustain:[0.55,0.68]}},
      pads:{prob:0.35, recipe:{model:["saw"], wave:"saw", cutoff:[900,1500], detune:[0.005,0.012], attack:[0.2,0.7], level:[0.36,0.5], send:[0.2,0.35], dsend:[0.08,0.18]}},
      drums:{kickModel:["808","909"], snareModel:["clap","noise"], hatModel:["noise"], kick:[1.15,1.4], snare:[0.95,1.2], hat:[0.7,1], tune:[0.95,1.1], send:[0.08,0.18], dsend:[0.05,0.15]},
      fx:{reverb:[0.18,0.32], delayBeats:[0.375,0.5], delayFb:[0.15,0.28], delayCut:[2400,3600], pump:[0.1,0.28], crackle:[0.05,0.18], lowcut:[25,40], highcut:[0,0], comp:[0.4,0.6]},
      found:{role:"bed", vol:[0.04,0.1], pitch:[0.9,1.05], stretch:[0.45,0.6], cutoff:[2200,3400], sources:["pool:industry*1","pool:city*1"]},
      sampleEvents:[{pool:["sp_energy","sp_rhythm","sp_pressure","sp_rewind"], placement:"buried", sections:"all", treatment:{cutoff:5000, vol:0.4, glitch:true, every:2, maxDur:4}}],
      hits:{sources:["pool:vb_spoken_poetic*1","pool:rave_stab*2","pool:vocal_stab*1","sp_energy"], pattern:"offbeat", prob:0.7},
      stab:["off","sparse"],
      form:"pop",
      theory:{adventure:[0.067,0.153], color:[0.133,0.3], voicing:"close", reharm:false},
      rhythm:[0.153,0.313],
      pipes:[] },
    /* /genre-tool:chantcircuit:genres */
    /* genre-tool:halogloss:genres */
    halogloss: { label:"Gated Seraphim", info:"A four-on-the-floor at 116-124. FM lead bass under strings, with brass. Neo-soul changes, a light shuffle.",
      bpm:[116,124],
      swing:[0,0.06],
      humanize:[0.05,0.15],
      progressions:["neosoul","pop_1625","dream"],
      kits:["four","open","full"],
      fills:["snare roll","tom fill","riser","drum fill"],
      bass:{patterns:["octaves","syncopated","melodic"], patchPool:["SYN-BASS 2","BASS    2"], recipe:{model:["dx7","saw"], cutoff:[700,1200], res:[0.1,0.22], level:[1.1,1.3], send:[0.03,0.1], dsend:[0,0.08]}},
      lead:{patterns:["hero","updown","double","pentaup"], recipe:{model:["brass","stack"], wave:"saw", voices:[2,4], spread:[0.005,0.011], cutoff:[2800,3800], level:[0.46,0.6], send:[0.3,0.48], dsend:[0.18,0.32], attack:0.006, release:[0.14,0.24], sustain:[0.7,0.82]}, inserts:{prob:0.5, max:1, pool:[["chorus",{rate:[0.6,1.2], depth:[0.4,0.65], mix:[0.4,0.6]}]]}},
      pads:{prob:0.85, recipe:{model:["strings","saw"], wave:"saw", cutoff:[1100,1900], detune:[0.006,0.012], attack:[0.6,1.5], level:[0.5,0.66], send:[0.35,0.55], dsend:[0.1,0.25]}},
      drums:{kickModel:["909","boom"], snareModel:["noise"], hatModel:["noise"], kick:[1.05,1.28], snare:[1.2,1.45], hat:[0.7,1], tune:[0.92,1.05], send:[0.35,0.55], dsend:[0.05,0.15]},
      fx:{reverb:[0.45,0.6], delayBeats:[0.5,0.75], delayFb:[0.2,0.35], delayCut:[2400,3600], pump:[0.2,0.4], crackle:[0,0.08], lowcut:[28,42], highcut:[0,0], comp:[0.4,0.6]},
      found:{role:"bed", vol:[0.04,0.1], pitch:[0.85,1], stretch:[0.45,0.6], cutoff:[1800,3000], sources:["pool:city*2"]},
      hits:{sources:["pool:vocal_stab*1","pool:rave_stab*1","sp_rhythm"], pattern:"offbeat", prob:0.4},
      stab:["off","sparse"],
      form:"pop",
      theory:{adventure:[0.2,0.35], color:[0.45,0.683], voicing:"close", reharm:true},
      rhythm:[0.1,0.257],
      pipes:[{id:"harmonize", w:0.45, prob:0.35},{id:"sweepArc", w:0.45, lo:0.7, hi:2},{id:"vibratoSwell", w:0.4, depth:0.25}] },
    /* /genre-tool:halogloss:genres */
    /* genre-tool:octanerush:genres */
    octanerush: { label:"Redline Ascension", info:"A four-on-the-floor at 136-142. Saw synth bass with a saw synth on both pad and lead. A descending minor run, straight time, quantized tight.",
      bpm:[136,142],
      swing:[0,0.03],
      humanize:[0,0.02],
      progressions:["minor_run","synthwave","epic_min","sad_pop"],
      kits:["four","pulse"],
      fills:["riser","snare roll","hat rush","impact"],
      bass:{patterns:["octaves","sixteenths","drive"], recipe:{model:["saw"], cutoff:[620,1000], res:[0.12,0.25], level:[1.15,1.35], send:[0,0.06], dsend:[0,0.05]}},
      lead:{patterns:["arp16","arpup","updown","hero"], recipe:{model:["saw","stack"], wave:"saw", voices:[2,4], spread:[0.005,0.011], cutoff:[2800,4000], level:[0.46,0.6], send:[0.3,0.48], dsend:[0.18,0.32], attack:0.005, release:[0.12,0.2], sustain:[0.68,0.8]}},
      pads:{prob:0.8, recipe:{model:["saw","strings"], wave:"saw", cutoff:[1200,2000], detune:[0.007,0.014], attack:[0.5,1.4], level:[0.5,0.66], send:[0.35,0.55], dsend:[0.1,0.25]}},
      drums:{kickModel:["909"], snareModel:["clap","noise"], hatModel:["noise"], kick:[1.2,1.45], snare:[0.85,1.1], hat:[1,1.3], tune:[0.95,1.1], send:[0.15,0.3], dsend:[0.05,0.15]},
      fx:{reverb:[0.35,0.5], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[2600,4000], pump:[0.25,0.45], crackle:[0,0.08], lowcut:[28,42], highcut:[0,0], comp:[0.35,0.55]},
      found:{role:"bed", vol:[0.04,0.1], pitch:[0.9,1.05], stretch:[0.45,0.6], cutoff:[2200,3400], sources:["pool:city*1","pool:road*1"]},
      hits:{sources:["pool:rave_stab*1","pool:vocal_stab*1","sp_energy"], pattern:"offbeat", prob:0.5},
      stab:["offbeat","sparse"],
      form:"dj",
      theory:{adventure:[0.1,0.205], color:[0.125,0.3], voicing:"close", reharm:true},
      rhythm:[0.08,0.22],
      pipes:[{id:"densityArc", w:0.4, floor:0.6},{id:"sweepArc", w:0.45, lo:0.7, hi:2},{id:"vibratoSwell", w:0.4, depth:0.25}] },
    /* /genre-tool:octanerush:genres */
    /* genre-tool:runwaystomp:genres */
    runwaystomp: { label:"Taxonomy Strut", info:"A four-on-the-floor at 124-130. Saw synth bass under strings, with an orchestra hit. A minor house vamp, a light shuffle.",
      bpm:[124,130],
      swing:[0.02,0.1],
      humanize:[0.03,0.12],
      progressions:["house_min","drone_min","minor_run"],
      kits:["house","four"],
      fills:["cut","impact","hat rush","riser"],
      bass:{patterns:["stab","rolling","octaves"], recipe:{model:["saw"], cutoff:[560,900], res:[0.15,0.3], level:[1.1,1.3], send:[0,0.06], dsend:[0,0.05]}},
      lead:{patterns:["double","sparse","updown"], samplerPool:["orchestra_hit"], recipe:{model:["sampler"], wave:"saw", voices:[1,2], spread:[0.002,0.006], cutoff:[2400,3600], level:[0.5,0.64], send:[0.2,0.35], dsend:[0.12,0.25], attack:0.003, release:[0.08,0.16], sustain:[0.5,0.62]}},
      pads:{prob:0.4, samplerPool:["strings"], recipe:{model:["sampler","saw"], wave:"saw", cutoff:[800,1400], detune:[0.005,0.011], attack:[0.4,1.2], level:[0.4,0.54], send:[0.3,0.48], dsend:[0.1,0.22]}},
      drums:{kickModel:["909"], snareModel:["clap"], hatModel:["noise"], kick:[1.25,1.5], snare:[0.9,1.15], hat:[1,1.3], tune:[0.95,1.1], send:[0.1,0.22], dsend:[0.05,0.15]},
      fx:{reverb:[0.3,0.45], delayBeats:[0.375,0.5], delayFb:[0.2,0.35], delayCut:[2400,3600], pump:[0.3,0.5], crackle:[0,0.1], lowcut:[28,42], highcut:[0,0], comp:[0.45,0.65]},
      found:{role:"bed", vol:[0.04,0.1], pitch:[0.9,1.05], stretch:[0.45,0.6], cutoff:[2200,3400], sources:["pool:city*2"]},
      hits:{sources:["pool:rave_stab*1","pool:vocal_stab*1","sp_rhythm","stml_hit_03"], pattern:"offbeat", prob:0.6},
      stab:["rave","offbeat"],
      form:"dj",
      theory:{adventure:[0.067,0.153], color:[0.15,0.317], voicing:"close", reharm:false},
      rhythm:[0.1,0.26],
      pipes:[{id:"octavePump", w:0.5, prob:0.4},{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:runwaystomp:genres */
    /* genre-tool:silkmist:genres */
    silkmist: { label:"Jade Vapor Archive", info:"A bare kick at 68-88. Acoustic bass under strings, with a koto. Mixolydian, a light shuffle.",
      bpm:[68,88],
      swing:[0,0.06],
      humanize:[0.15,0.35],
      progressions:["mode_mixo","mode_dorian","drone_min"],
      kits:["off","kick"],
      fills:["off","downlift"],
      bass:{patterns:["pedal","root","simple"], samplerPool:["acoustic_bass","contrabass"], recipe:{model:["sampler","sub"], cutoff:[300,550], res:[0.05,0.15], level:[0.85,1.05], send:[0.1,0.2], dsend:[0,0.08]}},
      lead:{patterns:["pentaup","pentaup","wander","sparse"], samplerPool:["koto","pan_flute","fiddle","kalimba"], recipe:{model:["sampler"], wave:"sine", voices:[1,1], spread:[0.002,0.005], cutoff:[2400,3600], level:[0.5,0.64], send:[0.35,0.55], dsend:[0.15,0.3], vibrato:[0.008,0.018]}},
      pads:{prob:0.85, samplerPool:["strings","slow_strings","bowed_glass"], recipe:{model:["sampler","strings"], wave:"saw", cutoff:[900,1500], detune:[0.004,0.01], attack:[1.5,3], level:[0.4,0.55], send:[0.45,0.65], dsend:[0.15,0.3]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.4,0.7], snare:[0.3,0.5], hat:[0.3,0.55], tune:[0.9,1.05], send:[0.15,0.3], dsend:[0,0.1]},
      fx:{reverb:[0.5,0.7], delayBeats:[0.5,0.75], delayFb:[0.2,0.35], delayCut:[2400,3400], pump:[0,0.05], crackle:[0.02,0.12], lowcut:[0,25], highcut:[0,0], comp:[0.1,0.3]},
      found:{role:"bed", vol:[0.08,0.16], pitch:[0.8,0.95], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["vx_cn_opera","iriomote"]},
      hits:{sources:["tw_ding"], pattern:"sparse", prob:0.2},
      stab:["off"],
      form:"pop",
      reverbColor:"fdn",
      theory:{adventure:[0.133,0.247], color:[0.233,0.433], voicing:"open", reharm:true},
      rhythm:[0.025,0.115],
      pipes:[{id:"harmonize", w:0.45, prob:0.35}] },
    /* /genre-tool:silkmist:genres */
    /* genre-tool:taqsim:genres */
    taqsim: { label:"Sirocco Sermon", info:"A tribal kit at 66-90. Acoustic bass under strings, with a sitar. A hijaz maqam, a light shuffle, loose timing.",
      bpm:[66,90],
      swing:[0.02,0.1],
      humanize:[0.2,0.4],
      progressions:["hijaz","hijaz","andalusian","mode_phrygian"],
      kits:["tribal","off"],
      fills:["off","tom fill"],
      bass:{patterns:["pedal","root","simple"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sub"], cutoff:[350,600], res:[0.05,0.14], level:[0.85,1.05], send:[0.08,0.16], dsend:[0,0.06]}},
      lead:{patterns:["wander","updown","sparse"], samplerPool:["sitar","oboe","pan_flute","harp"], recipe:{model:["sampler"], wave:"sine", voices:[1,1], spread:[0.002,0.005], cutoff:[2400,3400], level:[0.52,0.66], send:[0.35,0.5], dsend:[0.2,0.35], vibrato:[0.016,0.026], vibRate:[6,7.5]}},
      pads:{prob:0.6, samplerPool:["strings","bowed_glass"], recipe:{model:["sampler","strings"], wave:"saw", cutoff:[900,1500], detune:[0.005,0.011], attack:[1,2.5], level:[0.4,0.55], send:[0.4,0.6], dsend:[0.1,0.25]}},
      drums:{kickModel:["808","boom"], snareModel:["crack"], hatModel:["noise"], kick:[0.7,1], snare:[0.5,0.75], hat:[0.5,0.8], tune:[1,1.15], send:[0.12,0.24], dsend:[0.1,0.25]},
      fx:{reverb:[0.45,0.62], delayBeats:[0.5,0.75], delayFb:[0.2,0.35], delayCut:[2200,3200], pump:[0,0.05], crackle:[0.05,0.18], lowcut:[20,40], highcut:[0,0], comp:[0.15,0.35]},
      found:{role:"bed", vol:[0.07,0.14], pitch:[0.85,1], stretch:[0.45,0.6], cutoff:[1900,3000], sources:["shibuya","tokyo_station"]},
      hits:{sources:["tw_ding"], pattern:"sparse", prob:0.25},
      stab:["off"],
      form:"pop",
      reverbColor:"fdn",
      theory:{adventure:[0.188,0.3], color:[0.225,0.375], voicing:"open", reharm:true},
      rhythm:[0.175,0.34],
      pipes:[{id:"strum", w:0.55, step:0.02}] },
    /* /genre-tool:taqsim:genres */
    /* genre-tool:vespers:genres */
    vespers: { label:"Basalt Antiphon", info:"Beatless at 48-70. Contrabass with ahh choir on both pad and lead. A two-chord minor drone.",
      bpm:[48,70],
      swing:[0,0.04],
      humanize:[0.1,0.3],
      progressions:["drone_min","mode_phrygian","minor_run"],
      kits:["off"],
      fills:["off"],
      bass:{patterns:["pedal","root"], samplerPool:["contrabass","cello"], recipe:{model:["sampler","sub"], cutoff:[250,450], res:[0.05,0.12], level:[0.8,1], send:[0.15,0.3], dsend:[0.05,0.15]}},
      lead:{patterns:["composed","wander","composed"], samplerPool:["ahh_choir","ohh_voices","solo_vox"], recipe:{model:["sampler"], wave:"sine", voices:[1,2], spread:[0.003,0.007], cutoff:[1800,2800], level:[0.5,0.64], send:[0.55,0.75], dsend:[0.1,0.25], attack:[0.1,0.3]}},
      pads:{prob:1, samplerPool:["ahh_choir","strings","slow_strings"], recipe:{model:["sampler","strings"], wave:"saw", cutoff:[800,1400], detune:[0.004,0.01], attack:[2,4], level:[0.55,0.72], send:[0.55,0.75], dsend:[0.15,0.3]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0,0.15], snare:[0,0.1], hat:[0,0.1], tune:[0.9,1], send:[0.2,0.4], dsend:[0,0.1]},
      fx:{reverb:[0.82,0.96], delayBeats:[0.75,1.5], delayFb:[0.3,0.45], delayCut:[1800,2800], pump:[0,0], crackle:[0.02,0.1], lowcut:[0,0], highcut:[0,0], comp:[0,0.12]},
      found:{role:"bed", vol:[0.08,0.16], pitch:[0.7,0.85], stretch:[0.45,0.6], cutoff:[1500,2400], sources:["vx_sv_choir","tokyo_station"]},
      hits:{sources:["tw_ding"], pattern:"sparse", prob:0.15},
      stab:["off"],
      form:"wave",
      reverbColor:"shimmer",
      theory:{adventure:[0.1,0.187], color:[0.167,0.333], voicing:"open", reharm:false},
      rhythm:[0,0.08],
      pipes:[{id:"densityArc", w:0.4, floor:0.6},{id:"harmonize", w:0.45, prob:0.35}] },
    /* /genre-tool:vespers:genres */
    /* genre-tool:rnb:genres */
    rnb: { label:"Quiet Storm Advisory", info:"A swingbeat kit at 62-82. Finger bass under strings, with a solo vox. Neo-soul changes, swung.",
      timeFeel:{ pushPullMs:{ bass:-4, snare:10 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — QUIET STORM: the most laid-back backbeat in the catalogue (10 ms at 72bpm) over a fingered bass that still leads — the slow-jam signature
      bpm:[62,82],
      swing:[0.05,0.12],
      humanize:[0.15,0.35],
      progressions:["neosoul","house_min7","ii_v_i"],
      kits:["newjack","house"],
      fills:["off","drum fill"],
      bass:{patterns:["root","simple","walking"], samplerPool:["finger_bass","fretless_bass"], recipe:{model:["sampler","sub"], cutoff:[350,620], res:[0.05,0.14], level:[0.85,1.05], send:[0.08,0.18], dsend:[0.04,0.12]}},
      lead:{patterns:["composed","sparse","wander"], samplerPool:["solo_vox","rhodes_ep","electric_piano"], recipe:{model:["sampler"], wave:"sine", voices:[1,1], spread:[0.003,0.007], cutoff:[2200,3200], level:[0.5,0.64], send:[0.38,0.56], dsend:[0.18,0.34], vibrato:[0.01,0.02]}},
      pads:{prob:0.9, samplerPool:["strings","slow_strings","rhodes_ep"], recipe:{model:["sampler","strings"], wave:"saw", cutoff:[900,1500], detune:[0.005,0.011], attack:[1,2.5], level:[0.44,0.6], send:[0.4,0.6], dsend:[0.14,0.3]}},
      drums:{kickModel:["boom","808"], snareModel:["clap","noise"], hatModel:["noise"], kick:[0.55,0.8], snare:[0.45,0.7], hat:[0.4,0.65], tune:[0.95,1.05], send:[0.1,0.22], dsend:[0.06,0.16]},
      fx:{reverb:[0.4,0.56], delayBeats:[0.5,0.75], delayFb:[0.22,0.36], delayCut:[2000,3000], pump:[0,0.06], crackle:[0.04,0.12], lowcut:[25,45], highcut:[0,0], comp:[0.2,0.4]},
      found:{role:"bed", vol:[0.06,0.13], pitch:[0.85,1], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["tokyo_station","oslo_ferry_pa"]},
      hits:{sources:["tw_ding"], pattern:"sparse", prob:0.14},
      stab:["off","sparse"],
      form:"duet",
      reverbColor:"dattorro",
      theory:{adventure:[0.29,0.467], color:[0.517,0.75], voicing:"drop2", reharm:true},
      rhythm:[0.235,0.425],
      pipes:[{id:"ghost", w:0.55, prob:0.35},{id:"harmonize", w:0.45, prob:0.35}] },
    /* /genre-tool:rnb:genres */
    /* genre-tool:gospel:genres */
    gospel: { label:"Rapture Logistics", info:"A full kit at 84-102. Finger bass under a church organ, with ahh choir. Doo-wop changes, swung.",
      timeFeel:{ pushPullMs:{ bass:5, snare:7 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — CHURCH POCKET: unlike funk, gospel leans the WHOLE rhythm section back — the choir breathes and the band waits for it
      bpm:[84,102],
      swing:[0.06,0.14],
      humanize:[0.15,0.3],
      progressions:["doo_wop","four_chords","uplift"],
      kits:["full","open"],
      fills:["drum fill","kit fill"],
      bass:{patterns:["walking","root","simple"], samplerPool:["finger_bass","acoustic_bass"], recipe:{model:["sampler","sub"], cutoff:[400,700], res:[0.05,0.14], level:[0.85,1.05], send:[0.1,0.2], dsend:[0.04,0.12]}},
      lead:{patterns:["composed","updown","wander"], samplerPool:["ahh_choir","ohh_voices","church_organ"], recipe:{model:["sampler"], wave:"sine", voices:[1,2], spread:[0.004,0.009], cutoff:[2200,3200], level:[0.5,0.66], send:[0.44,0.64], dsend:[0.16,0.3], attack:[0.05,0.2]}},
      pads:{prob:1, samplerPool:["church_organ","rock_organ","strings","bright_yamaha_grand"], recipe:{model:["sampler","strings"], wave:"saw", cutoff:[1000,1700], detune:[0.004,0.009], attack:[0.4,1.4], level:[0.52,0.68], send:[0.46,0.66], dsend:[0.14,0.3]}},   // GOSPEL PIANO: the card names Hammond organ AND gospel piano as the two keyboard comps, so the comp pool carries both. A bright grand, not felt/upright — gospel piano is percussive and forward. The massed-choir hook stays on lead, untouched
      drums:{kickModel:["boom"], snareModel:["clap","noise"], hatModel:["noise"], kick:[0.72,0.98], snare:[0.7,0.92], hat:[0.62,0.9], tune:[0.95,1.05], send:[0.14,0.26], dsend:[0.05,0.14]},
      fx:{reverb:[0.62,0.8], delayBeats:[0.5,0.75], delayFb:[0.24,0.4], delayCut:[2200,3200], pump:[0,0.05], crackle:[0.02,0.08], lowcut:[20,40], highcut:[0,0], comp:[0.18,0.36]},
      found:{role:"bed", vol:[0.06,0.13], pitch:[0.9,1], stretch:[0.45,0.6], cutoff:[2000,3000], sources:["nevsky_choir","celtic_fans"]},
      hits:{sources:["tw_ding"], pattern:"sparse", prob:0.16},
      stab:["off","sparse"],
      form:"pop",
      reverbColor:"shimmer",
      theory:{adventure:[0.1,0.2], color:[0.167,0.35], voicing:"close", reharm:true},
      rhythm:[0.11,0.275],
      pipes:[{id:"harmonize", w:0.45, prob:0.35}] },
    /* /genre-tool:gospel:genres */
    /* genre-tool:altcountry:genres */
    altcountry: { label:"Tumbleweed Perihelion", info:"A boom-bap kit at 88-104. Finger bass under a rhodes ep, with a clean guitar. Four-chord changes, a light shuffle, loose timing.",
      timeFeel:{ pushPullMs:{ bass:6, hat:-4 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — AMERICANA: dusty lay-back on the bass, brushed hats a touch on top
      bpm:[88,104],
      swing:[0.02,0.07],
      humanize:[0.2,0.4],
      progressions:["four_chords","lofi","mediant"],
      kits:["boombap","open"],
      fills:["off","drum fill"],
      bass:{patterns:["root","simple","walking"], samplerPool:["finger_bass","picked_bass"], recipe:{model:["sampler","sub"], cutoff:[360,640], res:[0.05,0.14], level:[0.85,1.05], send:[0.08,0.18], dsend:[0.04,0.12]}},
      lead:{patterns:["composed","wander","sparse"], samplerPool:["clean_guitar","steel_string_guitar","di_guitar"], recipe:{model:["sampler"], wave:"sine", voices:[1,1], spread:[0.003,0.008], cutoff:[2400,3400], level:[0.5,0.64], send:[0.34,0.52], dsend:[0.16,0.32], vibrato:[0.008,0.018]}},
      pads:{prob:0.75, samplerPool:["rhodes_ep","strings","slow_strings"], recipe:{model:["sampler","strings"], wave:"saw", cutoff:[1000,1600], detune:[0.005,0.011], attack:[0.8,2.2], level:[0.42,0.58], send:[0.42,0.62], dsend:[0.16,0.32]}},
      drums:{kickModel:["boom"], snareModel:["noise","crack"], hatModel:["noise"], kick:[0.5,0.76], snare:[0.5,0.72], hat:[0.42,0.68], tune:[0.95,1.05], send:[0.12,0.24], dsend:[0.06,0.16]},
      fx:{reverb:[0.56,0.72], delayBeats:[0.75,1], delayFb:[0.26,0.42], delayCut:[2000,3000], pump:[0,0.04], crackle:[0.1,0.22], lowcut:[25,45], highcut:[0,0], comp:[0.14,0.32]},
      found:{role:"bed", vol:[0.07,0.14], pitch:[0.85,1], stretch:[0.45,0.6], cutoff:[2000,3000], sources:["coyote_prairie","nj_owls"]},
      hits:{sources:["pool:vb_folk_pastoral*1","tw_ding"], pattern:"sparse", prob:0.12},
      stab:["off"],
      form:"pop",
      reverbColor:"spring",
      theory:{adventure:[0.2,0.333], color:[0.25,0.45], voicing:"close", reharm:true},
      rhythm:[0.2,0.375],
      pipes:[{id:"ghost", w:0.55, prob:0.35},{id:"strum", w:0.55, step:0.02}] },
    /* /genre-tool:altcountry:genres */
    /* genre-tool:yachtrock:genres */
    yachtrock: { label:"Isobar Regatta", info:"A full kit at 104-120. Fretless bass under a rhodes ep, with an alto sax. Neo-soul changes, a light shuffle.",
      bpm:[104,120],
      swing:[0.02,0.06],
      humanize:[0.08,0.2],
      progressions:["neosoul","ii_v_i"],
      kits:["full","open"],
      fills:["drum fill","tom fill"],
      bass:{patterns:["walking","root","simple"], samplerPool:["fretless_bass","finger_bass"], recipe:{model:["sampler","sampler"], cutoff:[400,700], res:[0.05,0.14], level:[0.85,1.05], send:[0.06,0.14], dsend:[0.02,0.08]}},
      lead:{patterns:["composed","wander","updown"], samplerPool:["alto_sax","tenor_sax","rhodes_ep","electric_piano"], recipe:{model:["sampler"], wave:"sine", voices:[1,1], spread:[0.003,0.007], cutoff:[2600,3600], level:[0.5,0.64], send:[0.22,0.36], dsend:[0.08,0.18], vibrato:[0.008,0.016]}},
      pads:{prob:0.85, samplerPool:["rhodes_ep","electric_piano","strings","clean_guitar"], recipe:{model:["sampler","strings"], wave:"saw", cutoff:[1100,1800], detune:[0.004,0.009], attack:[0.6,1.8], level:[0.42,0.58], send:[0.22,0.4], dsend:[0.06,0.16]}},   // CLEAN ELECTRIC GUITAR: the card pairs it with the Rhodes as the comp texture, so both sit in the comp pool. The lyrical alto-sax hook stays on lead, untouched
      drums:{kickModel:["boom"], snareModel:["noise","clap"], hatModel:["noise"], kick:[0.55,0.82], snare:[0.5,0.72], hat:[0.5,0.78], tune:[0.95,1.05], send:[0.08,0.18], dsend:[0.03,0.1]},
      fx:{reverb:[0.3,0.44], delayBeats:[0.375,0.5], delayFb:[0.12,0.24], delayCut:[2600,3600], pump:[0,0.02], crackle:[0.02,0.06], lowcut:[30,50], highcut:[0,0], comp:[0.2,0.4]},
      found:{role:"bed", vol:[0.05,0.1], pitch:[0.9,1], stretch:[0.45,0.6], cutoff:[2400,3400], sources:["oslo_ferry_pa","tokyo_station"]},
      hits:{sources:["tw_ding"], pattern:"sparse", prob:0.1},
      stab:["off","sparse"],
      form:"pop",
      reverbColor:"dattorro",
      theory:{adventure:[0.375,0.575], color:[0.55,0.8], voicing:"drop2", reharm:true},
      rhythm:[0.11,0.275],
      pipes:[{id:"harmonize", w:0.45, prob:0.35}] },
    /* /genre-tool:yachtrock:genres */
    /* genre-tool:honkytonk:genres */
    honkytonk: { label:"Last Call Cosmology", info:"A shuffle at 100-114. Acoustic bass under a honky tonk, with a steel string guitar. Four-chord changes, swung.",
      timeFeel:{ pushPullMs:{ bass:6, snare:6 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — BARROOM SHUFFLE: the opposite of bluegrass — last call, and the band leans back into it
      bpm:[100,114],
      swing:[0.13,0.19],
      humanize:[0.15,0.35],
      progressions:["four_chords","blues_12"],
      kits:["shuffle","boombap"],
      fills:["off","drum fill"],
      bass:{patterns:["walking","root","simple"], samplerPool:["acoustic_bass","contrabass"], recipe:{model:["sampler","sampler"], cutoff:[350,600], res:[0.05,0.14], level:[0.85,1.05], send:[0.06,0.14], dsend:[0,0.06]}},
      lead:{patterns:["composed","updown","wander"], samplerPool:["steel_string_guitar","fiddle","harmonica","banjo"], recipe:{model:["sampler"], wave:"sine", voices:[1,1], spread:[0.002,0.005], cutoff:[2600,3600], level:[0.5,0.64], send:[0.18,0.3], dsend:[0.06,0.16], vibrato:[0.014,0.024]}},
      pads:{prob:0.5, samplerPool:["honky_tonk"], recipe:{model:["sampler"], wave:"saw", cutoff:[1400,2100], detune:[0.002,0.006], attack:[0.1,0.5], level:[0.38,0.52], send:[0.16,0.3], dsend:[0.04,0.12]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.42,0.64], snare:[0.42,0.62], hat:[0.38,0.58], tune:[0.95,1.05], send:[0.08,0.16], dsend:[0.02,0.08]},
      fx:{reverb:[0.24,0.38], delayBeats:[0.375,0.5], delayFb:[0.1,0.22], delayCut:[2800,3800], pump:[0,0.03], crackle:[0.04,0.12], lowcut:[25,45], highcut:[0,0], comp:[0.1,0.26]},
      found:{role:"bed", vol:[0.05,0.1], pitch:[0.9,1], stretch:[0.45,0.6], cutoff:[2400,3400], sources:["coyote_prairie","morning_traffic_ny"]},
      hits:{sources:["pool:vb_folk_pastoral*1","tw_ding"], pattern:"sparse", prob:0.1},
      stab:["off"],
      form:"pop",
      reverbColor:"spring",
      theory:{adventure:[0.225,0.375], color:[0.275,0.45], voicing:"drop2", reharm:true},
      rhythm:[0.275,0.475],
      pipes:[{id:"ghost", w:0.55, prob:0.35},{id:"callResponse", w:0.5, level:0.85},{id:"strum", w:0.55, step:0.02}] },
    /* /genre-tool:honkytonk:genres */
    /* genre-tool:countrypop:genres */
    countrypop: { label:"Rhinestone Singularity", info:"A full kit at 128-146. Pop bass under strings, with a clean guitar. Four-chord changes, a light shuffle.",
      bpm:[128,146],
      swing:[0.02,0.06],
      humanize:[0.08,0.2],
      progressions:["four_chords","uplift"],
      kits:["full","open"],
      fills:["drum fill","riser","tom fill"],
      bass:{patterns:["root","simple"], samplerPool:["pop_bass","picked_bass","finger_bass"], recipe:{model:["sampler","sub"], cutoff:[420,720], res:[0.05,0.14], level:[0.9,1.1], send:[0.05,0.12], dsend:[0.02,0.08]}},
      lead:{patterns:["composed","updown","wander"], samplerPool:["clean_guitar","steel_string_guitar","banjo"], recipe:{model:["sampler"], wave:"sine", voices:[1,1], spread:[0.002,0.006], cutoff:[2800,3800], level:[0.5,0.64], send:[0.16,0.3], dsend:[0.06,0.16], vibrato:[0.008,0.016]}},
      pads:{prob:0.8, samplerPool:["strings","slow_strings"], recipe:{model:["sampler","strings"], wave:"saw", cutoff:[1200,1900], detune:[0.004,0.009], attack:[0.3,1.2], level:[0.4,0.55], send:[0.24,0.4], dsend:[0.06,0.16]}},
      drums:{kickModel:["boom","909"], snareModel:["clap","noise"], hatModel:["noise"], kick:[0.74,1], snare:[0.7,0.94], hat:[0.62,0.9], tune:[0.95,1.05], send:[0.1,0.22], dsend:[0.04,0.12]},
      fx:{reverb:[0.3,0.44], delayBeats:[0.375,0.5], delayFb:[0.12,0.24], delayCut:[2800,3800], pump:[0,0.06], crackle:[0.02,0.06], lowcut:[30,50], highcut:[0,0], comp:[0.24,0.44]},
      found:{role:"bed", vol:[0.05,0.1], pitch:[0.9,1], stretch:[0.45,0.6], cutoff:[2400,3400], sources:["coyote_prairie","leeds_terrace"]},
      hits:{sources:["pool:vb_folk_pastoral*1","tw_ding"], pattern:"sparse", prob:0.1},
      stab:["off","sparse"],
      form:"pop",
      reverbColor:"dattorro",
      theory:{adventure:[0.1,0.2], color:[0.125,0.3], voicing:"close", reharm:true},
      rhythm:[0.11,0.275],
      pipes:[{id:"strum", w:0.55, step:0.02}] },
    /* /genre-tool:countrypop:genres */
    /* genre-tool:folk:genres */
    folk: { label:"Kettle Eschaton", info:"Beatless at 98-116. Acoustic bass under a nylon string guitar, with a steel string guitar. Four-chord changes, a light shuffle, loose timing.",
      bpm:[98,116],
      swing:[0.02,0.06],
      humanize:[0.18,0.4],
      progressions:["four_chords","mode_mixo","mode_dorian"],
      kits:["off"],
      fills:["off"],
      bass:{patterns:["root","simple","walking"], samplerPool:["acoustic_bass","finger_bass"], recipe:{model:["sampler","sub"], cutoff:[340,620], res:[0.05,0.13], level:[0.9,1.1], send:[0.06,0.14], dsend:[0.02,0.08]}},
      lead:{patterns:["folkline","folkweave","pentaup","wander","sparse","composed"], samplerPool:["steel_string_guitar","nylon_string_guitar","guitar_harmonics","harmonica"], recipe:{model:["sampler"], wave:"sine", voices:[1,1], spread:[0.002,0.006], cutoff:[2600,3600], level:[0.5,0.64], send:[0.16,0.3], dsend:[0.06,0.16], attack:0.004, release:[0.1,0.2], sustain:[0.5,0.66], vibrato:[0.006,0.014]}},
      pads:{prob:0.85, samplerPool:["nylon_string_guitar","steel_string_guitar","nylon_string_guitar"], recipe:{model:["sampler","sampler"], wave:"sine", cutoff:[1600,2600], detune:[0.002,0.005], attack:[0.05,0.3], level:[0.4,0.54], send:[0.18,0.32], dsend:[0.05,0.14]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.4,0.62], snare:[0.4,0.6], hat:[0.34,0.56], tune:[0.95,1.05], send:[0.1,0.22], dsend:[0.04,0.12], kit:"brush"},
      fx:{reverb:[0.24,0.38], delayBeats:[0.5,0.75], delayFb:[0.1,0.22], delayCut:[2400,3400], pump:[0,0.04], crackle:[0.04,0.14], lowcut:[25,45], highcut:[0,0], comp:[0.1,0.26]},
      found:{role:"bed", vol:[0.05,0.11], pitch:[0.9,1.05], stretch:[0.45,0.6], cutoff:[2200,3200], sources:["coyote_prairie","nj_owls","kielce_rain"]},
      hits:{sources:["pool:vb_folk_pastoral*1","tw_ding"], pattern:"sparse", prob:0.08},
      stab:["off"],
      form:"pop",
      strum:"folk",
      reverbColor:"spring",
      theory:{adventure:[0.167,0.3], color:[0.25,0.433], voicing:"open", reharm:true},
      rhythm:[0,0.08],
      pipes:[{id:"strum", w:0.55, step:0.02},{id:"harmonize", w:0.45, prob:0.35}] },
    /* /genre-tool:folk:genres */
    /* genre-tool:romanticism:genres */
    romanticism: { label:"Candelabra Anomaly", info:"Beatless at 56-84. A yamaha grand piano under strings, with a yamaha grand piano. Royal-road changes, rubato.",
      bpm:[56,84],
      swing:[0,0.04],
      humanize:[0.14,0.3],
      progressions:["royal_road","mediant","sad_pop","neosoul"],
      kits:["off"],
      fills:["off"],
      chordEvery:8,
      bass:{patterns:["octaves","pedal","melodic","walking"], samplerPool:["yamaha_grand_piano","bright_yamaha_grand"], recipe:{model:["sampler","sampler"], cutoff:[600,1400], res:[0.05,0.1], level:[0.5,0.74], send:[0.28,0.5], dsend:[0,0.08], attack:[0.008,0.03], release:[0.6,1.4]}},
      lead:{patterns:["arpup","updown","canon"], samplerPool:["yamaha_grand_piano","bright_yamaha_grand"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.001,0.004], cutoff:[2400,4200], level:[0.4,0.66], send:[0.3,0.55], dsend:[0.04,0.16], attack:[0.006,0.03], release:[0.5,1.1]}},
      pads:{prob:0.45, samplerPool:["strings","slow_strings"], recipe:{model:["sampler","strings"], wave:"sine", cutoff:[900,1800], detune:[0.002,0.006], attack:[1.2,3], release:[2,4], swell:1, level:[0.3,0.5], send:[0.4,0.62], dsend:[0,0.1]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.5,0.7], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.9,1], send:[0.15,0.35], dsend:[0,0]},
      fx:{reverb:[0.5,0.72], delayBeats:[1,2], delayFb:[0.12,0.26], delayCut:[2000,3000], pump:[0,0], crackle:[0,0.08], lowcut:[0,0], highcut:[0,0], comp:[0,0.1]},
      found:{role:"bed", vol:[0.03,0.09], pitch:[0.7,0.9], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[0.03,0.07], periodBars:[1,3], prob:1},
      hits:{sources:["pool:vb_classical_chamber*1","sp_herenow"], pattern:"sparse", prob:0.03},
      stab:["off"],
      form:"wave",
      theory:{adventure:[0.188,0.338], color:[0.338,0.55], voicing:"open", reharm:true},
      rhythm:[0,0.08],
      pipes:[{id:"echoCanon", w:0.55, prob:0.45, delay:2},{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:romanticism:genres */
    /* genre-tool:chamber:genres */
    chamber: { label:"Rosin Seance", info:"Beatless at 72-100. A cello under strings, with a violin. A canon, rubato.",
      bpm:[72,100],
      swing:[0,0.03],
      humanize:[0.06,0.16],
      progressions:["canon","ii_v_i","four_chords","mode_dorian"],
      kits:["off"],
      fills:["off"],
      chordEvery:8,
      bass:{patterns:["walking","pedal","root","melodic"], samplerPool:["cello","contrabass"], recipe:{model:["sampler","sampler"], cutoff:[500,1200], res:[0.05,0.1], level:[0.46,0.66], send:[0.18,0.36], dsend:[0,0.05], attack:[0.02,0.06], release:[0.4,0.9]}},
      lead:{patterns:["classicalweave","updown","arpup","canon"], samplerPool:["violin","viola"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.001,0.004], cutoff:[2200,3600], level:[0.4,0.58], send:[0.22,0.42], dsend:[0.02,0.1], attack:[0.03,0.09], release:[0.35,0.8]}},   // classicalweave = the mined melody organ fit on The Greats — the violin line from its own repertoire
      pads:{prob:0.5, samplerPool:["strings","slow_strings"], recipe:{model:["sampler","strings"], wave:"sine", cutoff:[1000,1900], detune:[0.001,0.004], attack:[0.5,1.6], release:[1,2.4], swell:1, level:[0.3,0.46], send:[0.28,0.46], dsend:[0,0.06]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.5,0.7], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.9,1], send:[0.15,0.35], dsend:[0,0]},
      fx:{reverb:[0.3,0.48], delayBeats:[0.75,1.5], delayFb:[0.08,0.2], delayCut:[2000,3000], pump:[0,0], crackle:[0,0.06], lowcut:[0,0], highcut:[0,0], comp:[0,0.1]},
      found:{role:"bed", vol:[0.03,0.08], pitch:[0.7,0.9], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[0.006,0.02], periodBars:[2,4], prob:0.7},
      hits:{sources:["pool:vb_classical_chamber*1","sp_herenow"], pattern:"sparse", prob:0.03},
      stab:["off"],
      form:"wave",
      theory:{adventure:[0.213,0.362], color:[0.325,0.525], voicing:"open", reharm:true},
      rhythm:[0,0.08],
      pipes:[{id:"echoCanon", w:0.55, prob:0.45, delay:2},{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:chamber:genres */
    /* genre-tool:impressionism:genres */
    impressionism: { label:"Lavender Uncertainty", info:"Beatless at 58-86. A harp under slow strings, with a celesta. Whole-tone planing, rubato.",
      bpm:[58,86],
      swing:[0,0.04],
      humanize:[0.08,0.2],
      progressions:["whole_tone","quartal","mode_lydian","mediant"],
      kits:["off"],
      fills:["off"],
      chordEvery:8,
      bass:{patterns:["pedal","melodic","root","walking"], samplerPool:["harp","cello"], recipe:{model:["sampler","sampler"], cutoff:[500,1200], res:[0.05,0.1], level:[0.42,0.62], send:[0.3,0.52], dsend:[0,0.08], attack:[0.01,0.04], release:[0.6,1.4]}},
      lead:{patterns:["updown","arpup","arpdown"], samplerPool:["celesta","harp"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.002,0.005], cutoff:[2600,4400], level:[0.38,0.56], send:[0.34,0.58], dsend:[0.04,0.16], attack:[0.004,0.02], release:[0.4,1]}},
      pads:{prob:0.6, samplerPool:["slow_strings","strings"], recipe:{model:["sampler","strings"], wave:"sine", cutoff:[800,1600], detune:[0.003,0.008], attack:[1.5,3.5], release:[2.5,5], swell:1, level:[0.3,0.48], send:[0.45,0.68], dsend:[0,0.1]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.5,0.7], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.9,1], send:[0.15,0.35], dsend:[0,0]},
      fx:{reverb:[0.55,0.78], delayBeats:[1,2], delayFb:[0.14,0.3], delayCut:[1800,2800], pump:[0,0], crackle:[0,0.06], lowcut:[0,0], highcut:[0,0], comp:[0,0.08]},
      found:{role:"bed", vol:[0.04,0.11], pitch:[0.7,0.9], stretch:[0.5,0.65], cutoff:[1600,2600], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[0.015,0.04], periodBars:[2,4], prob:0.9},
      hits:{sources:["pool:vb_classical_chamber*1","sp_herenow"], pattern:"sparse", prob:0.03},
      stab:["off"],
      form:"wave",
      theory:{adventure:[0.138,0.263], color:[0.238,0.438], voicing:"open", reharm:true},
      rhythm:[0,0.08],
      pipes:[{id:"strum", w:0.55, step:0.02},{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:impressionism:genres */
    /* genre-tool:postminimal:genres */
    postminimal: { label:"Tessellation Vigil", info:"Beatless at 80-108. A felt piano under slow strings, with a celesta. Four-chord changes, rubato, one chord every 16 beats.",
      bpm:[80,108],
      swing:[0,0.02],
      humanize:[0.02,0.08],
      progressions:["four_chords","canon","mode_dorian","drone_min"],
      kits:["off"],
      fills:["off"],
      chordEvery:16,
      bass:{patterns:["pedal","root","octaves"], samplerPool:["felt_piano","cello"], recipe:{model:["sampler","sampler"], cutoff:[600,1300], res:[0.05,0.1], level:[0.44,0.62], send:[0.24,0.44], dsend:[0,0.06], attack:[0.006,0.02], release:[0.4,0.9]}},
      lead:{patterns:["arp16","arpup","updown"], samplerPool:["celesta","felt_piano"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.001,0.003], cutoff:[2600,4000], level:[0.4,0.56], send:[0.28,0.48], dsend:[0.02,0.12], attack:[0.003,0.012], release:[0.15,0.4]}},
      pads:{prob:0.45, samplerPool:["slow_strings","strings"], recipe:{model:["sampler","strings"], wave:"sine", cutoff:[900,1700], detune:[0.002,0.005], attack:[1.5,3.5], release:[2.5,5], swell:1, level:[0.28,0.44], send:[0.4,0.6], dsend:[0,0.08]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.5,0.7], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.9,1], send:[0.15,0.35], dsend:[0,0]},
      fx:{reverb:[0.5,0.72], delayBeats:[0.5,1], delayFb:[0.1,0.24], delayCut:[2200,3200], pump:[0,0], crackle:[0,0.06], lowcut:[0,0], highcut:[0,0], comp:[0,0.08]},
      found:{role:"bed", vol:[0.03,0.09], pitch:[0.7,0.9], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[0,0.005], periodBars:[4,8], prob:0.1},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.02},
      stab:["off"],
      form:"wave",
      theory:{adventure:[0.113,0.223], color:[0.213,0.4], voicing:"open", reharm:true},
      rhythm:[0,0.08],
      pipes:[{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:postminimal:genres */
    /* genre-tool:symphony:genres */
    symphony: { label:"Timpani Cosmogenesis", info:"Beatless at 76-122. Contrabass under strings, with a violin. Epic minor changes, rubato.",
      bpm:[76,122],
      swing:[0,0.03],
      humanize:[0.07,0.18],
      progressions:["epic_min","epic_maj","uplift","four_chords"],
      kits:["off"],
      fills:["off"],
      chordEvery:8,
      bass:{patterns:["octaves","walking","pedal"], samplerPool:["contrabass","tuba"], recipe:{model:["sampler","sampler"], cutoff:[500,1300], res:[0.05,0.1], level:[0.52,0.74], send:[0.2,0.4], dsend:[0,0.06], attack:[0.02,0.06], release:[0.4,1]}},
      lead:{patterns:["hero","anthem","updown"], samplerPool:["violin","brass_section"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[2,3], spread:[0.002,0.006], cutoff:[2400,4200], level:[0.44,0.66], send:[0.24,0.46], dsend:[0.02,0.12], attack:[0.02,0.07], release:[0.35,0.9]}},
      pads:{prob:0.7, samplerPool:["strings","brass_section"], recipe:{model:["sampler","strings"], wave:"sine", cutoff:[1000,1900], detune:[0.002,0.006], attack:[0.8,2.2], release:[1.5,3.5], swell:1, level:[0.34,0.54], send:[0.34,0.56], dsend:[0,0.08]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.5,0.7], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.9,1], send:[0.15,0.35], dsend:[0,0]},
      fx:{reverb:[0.45,0.68], delayBeats:[0.75,1.5], delayFb:[0.1,0.24], delayCut:[2000,3000], pump:[0,0], crackle:[0,0.06], lowcut:[0,0], highcut:[0,0], comp:[0,0.1]},
      found:{role:"bed", vol:[0.03,0.09], pitch:[0.7,0.9], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[0.008,0.025], periodBars:[2,4], prob:0.6},
      hits:{sources:["pool:vb_classical_chamber*1","sp_herenow"], pattern:"sparse", prob:0.03},
      stab:["off"],
      form:"wave",
      theory:{adventure:[0.1,0.2], color:[0.113,0.3], voicing:"open", reharm:true},
      rhythm:[0,0.08],
      pipes:[{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:symphony:genres */
    /* genre-tool:punk:genres */
    punk: { label:"Particle Tantrum", info:"A full kit at 156-192. Picked bass under a rock organ, with a distortion guitar. Four-chord changes, straight time, rubato.",
      bpm:[156,192],
      swing:[0,0.02],
      humanize:[0.03,0.1],
      progressions:["four_chords","pop_1625","blues_12","minor_run"],
      kits:["full","four","breaks"],
      fills:["drum fill","hat rush","cut"],
      chordEvery:4,
      bass:{patterns:["root","octaves","simple"], samplerPool:["picked_bass","synth_bass_1"], recipe:{model:["sampler","sampler"], cutoff:[700,1500], res:[0.06,0.14], level:[0.5,0.72], send:[0.05,0.16], dsend:[0,0.04], attack:[0.004,0.014], release:[0.15,0.4]}},
      lead:{patterns:["roar","anthem","double"], samplerPool:["distortion_guitar","crunch_guitar"], recipe:{model:["sampler","sampler"], wave:"saw", voices:[1,2], spread:[0.002,0.006], cutoff:[2600,4600], level:[0.46,0.68], send:[0.06,0.2], dsend:[0,0.06], attack:[0.003,0.012], release:[0.12,0.35]}},
      pads:{prob:0.15, samplerPool:["rock_organ","crunch_guitar"], recipe:{model:["sampler","sampler"], wave:"saw", cutoff:[1400,2400], detune:[0.004,0.01], attack:[0.05,0.3], release:[0.4,1.2], swell:0, level:[0.22,0.4], send:[0.1,0.26], dsend:[0,0.06]}},
      drums:{kickModel:["boom","909"], snareModel:["crack","clap"], hatModel:["metal","noise"], kick:[0.7,0.92], snare:[0.6,0.82], hat:[0.4,0.62], tune:[0.95,1.06], send:[0.05,0.18], dsend:[0,0.04]},
      fx:{reverb:[0.1,0.26], delayBeats:[0.5,0.75], delayFb:[0.05,0.16], delayCut:[2400,3400], pump:[0,0.1], crackle:[0,0.06], lowcut:[0,0.1], highcut:[0,0], comp:[0.2,0.45]},
      found:{role:"bed", vol:[0.02,0.06], pitch:[0.8,1], stretch:[0.3,0.45], cutoff:[2000,3200], sources:["tokyo_station","iriomote"]},
      rubato:{depth:[0,0.004], periodBars:[4,8], prob:0.05},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.03},
      stab:["off"],
      form:"wave",
      theory:{adventure:[0.163,0.298], color:[0.25,0.425], voicing:"close", reharm:true},
      rhythm:[0.233,0.423],
      pipes:[{id:"callResponse", w:0.5, level:0.85},{id:"strum", w:0.55, step:0.02},{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:punk:genres */
    /* genre-tool:indie:genres */
    indie: { label:"Duvet Cosmonaut", info:"A full kit at 104-134. Picked bass under a jazz guitar, with a clean guitar. Four-chord changes, straight time, rubato.",
      bpm:[104,134],
      swing:[0,0.03],
      humanize:[0.06,0.16],
      progressions:["four_chords","royal_road","pop_1625","neosoul"],
      kits:["full","boombap"],
      fills:["off","drum fill","hat rush"],
      chordEvery:4,
      bass:{patterns:["root","walking","melodic"], samplerPool:["picked_bass","fretless_bass"], recipe:{model:["sampler","sampler"], cutoff:[600,1300], res:[0.05,0.12], level:[0.44,0.64], send:[0.1,0.24], dsend:[0,0.05], attack:[0.006,0.02], release:[0.2,0.5]}},
      lead:{patterns:["arpup","updown","canon"], samplerPool:["clean_guitar","steel_string_guitar"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.002,0.005], cutoff:[2600,4400], level:[0.4,0.58], send:[0.14,0.32], dsend:[0.02,0.12], attack:[0.004,0.016], release:[0.2,0.5]}},
      pads:{prob:0.4, samplerPool:["jazz_guitar","rock_organ"], recipe:{model:["sampler","sampler"], wave:"sine", cutoff:[1200,2200], detune:[0.002,0.006], attack:[0.2,0.8], release:[0.8,2], swell:1, level:[0.24,0.42], send:[0.2,0.4], dsend:[0,0.08]}},
      drums:{kickModel:["boom","909"], snareModel:["crack","clap"], hatModel:["metal","noise"], kick:[0.56,0.78], snare:[0.46,0.68], hat:[0.34,0.56], tune:[0.94,1.03], send:[0.1,0.26], dsend:[0,0.05]},
      fx:{reverb:[0.18,0.38], delayBeats:[0.5,1], delayFb:[0.08,0.2], delayCut:[2200,3200], pump:[0,0.08], crackle:[0,0.08], lowcut:[0,0], highcut:[0,0], comp:[0.1,0.3]},
      found:{role:"bed", vol:[0.02,0.07], pitch:[0.8,1], stretch:[0.35,0.5], cutoff:[1800,2800], sources:["tokyo_station","iriomote"]},
      rubato:{depth:[0.004,0.014], periodBars:[2,4], prob:0.3},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.03},
      stab:["off"],
      form:"wave",
      theory:{adventure:[0.175,0.318], color:[0.388,0.6], voicing:"close", reharm:true},
      rhythm:[0.21,0.4],
      pipes:[{id:"ghost", w:0.55, prob:0.35},{id:"echoCanon", w:0.55, prob:0.45, delay:2},{id:"strum", w:0.55, step:0.02}] },
    /* /genre-tool:indie:genres */
    /* genre-tool:grunge:genres */
    grunge: { label:"Flannel Abyss", info:"A full kit at 92-128. Picked bass under a rock organ, with an overdrive guitar. Four-chord changes, straight time, rubato.",
      bpm:[92,128],
      swing:[0,0.04],
      humanize:[0.05,0.14],
      progressions:["four_chords","minor_run","blues_12","andalusian"],
      kits:["full","breaks","halftime"],
      fills:["drum fill","tom fill","cut"],
      chordEvery:4,
      bass:{patterns:["octaves","root","drive"], samplerPool:["picked_bass","synth_bass_1"], recipe:{model:["sampler","sampler"], cutoff:[600,1300], res:[0.06,0.14], level:[0.5,0.72], send:[0.06,0.18], dsend:[0,0.04], attack:[0.005,0.016], release:[0.18,0.45]}},
      lead:{patterns:["sludge","roar","blues"], samplerPool:["overdrive_guitar","crunch_guitar"], recipe:{model:["sampler","sampler"], wave:"saw", voices:[1,2], spread:[0.003,0.008], cutoff:[2200,4000], level:[0.46,0.66], send:[0.08,0.22], dsend:[0,0.08], attack:[0.004,0.014], release:[0.15,0.4]}},
      pads:{prob:0.25, samplerPool:["rock_organ","distortion_guitar"], recipe:{model:["sampler","sampler"], wave:"saw", cutoff:[1200,2200], detune:[0.004,0.01], attack:[0.1,0.5], release:[0.5,1.4], swell:0, level:[0.24,0.42], send:[0.12,0.3], dsend:[0,0.06]}},
      drums:{kickModel:["boom","909"], snareModel:["crack","noise"], hatModel:["metal","noise"], kick:[0.66,0.9], snare:[0.56,0.8], hat:[0.34,0.56], tune:[0.92,1.02], send:[0.08,0.22], dsend:[0,0.05]},
      fx:{reverb:[0.2,0.42], delayBeats:[0.5,0.75], delayFb:[0.06,0.18], delayCut:[2000,3000], pump:[0,0.1], crackle:[0,0.08], lowcut:[0,0.1], highcut:[0,0], comp:[0.2,0.45]},
      found:{role:"bed", vol:[0.02,0.06], pitch:[0.8,1], stretch:[0.3,0.45], cutoff:[1800,2800], sources:["tokyo_station","iriomote"]},
      rubato:{depth:[0,0.008], periodBars:[4,8], prob:0.1},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.03},
      stab:["off"],
      form:"wave",
      theory:{adventure:[0.175,0.318], color:[0.213,0.375], voicing:"close", reharm:true},
      rhythm:[0.257,0.467],
      pipes:[{id:"callResponse", w:0.5, level:0.85},{id:"strum", w:0.55, step:0.02},{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:grunge:genres */
    /* genre-tool:postrock:genres */
    postrock: { label:"Slow Dawn Array", info:"A full kit at 72-106. Fretless bass under strings, with a clean guitar. Four-chord changes, straight time, rubato.",
      bpm:[72,106],
      swing:[0,0.04],
      humanize:[0.05,0.14],
      progressions:["four_chords","canon","epic_min","uplift"],
      kits:["full","halftime","breaks"],
      fills:["drum fill","riser","sweep"],
      chordEvery:8,
      bass:{patterns:["pedal","root","melodic"], samplerPool:["fretless_bass","picked_bass"], recipe:{model:["sampler","sampler"], cutoff:[500,1200], res:[0.05,0.1], level:[0.44,0.64], send:[0.16,0.36], dsend:[0,0.06], attack:[0.01,0.03], release:[0.3,0.8]}},
      lead:{patterns:["arpup","updown","composed"], samplerPool:["clean_guitar","guitar_harmonics"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.002,0.006], cutoff:[2600,4400], level:[0.38,0.56], send:[0.28,0.5], dsend:[0.06,0.2], attack:[0.004,0.02], release:[0.3,0.8]}},
      pads:{prob:0.65, samplerPool:["strings","clean_guitar"], recipe:{model:["sampler","strings"], wave:"sine", cutoff:[1000,1900], detune:[0.003,0.008], attack:[1,3], release:[2,4.5], swell:1, level:[0.3,0.5], send:[0.38,0.6], dsend:[0,0.1]}},
      drums:{kickModel:["boom","909"], snareModel:["crack","noise"], hatModel:["metal","noise"], kick:[0.5,0.74], snare:[0.42,0.64], hat:[0.3,0.52], tune:[0.92,1.02], send:[0.12,0.3], dsend:[0,0.06]},
      fx:{reverb:[0.42,0.66], delayBeats:[1,2], delayFb:[0.16,0.32], delayCut:[2000,3000], pump:[0,0.06], crackle:[0,0.06], lowcut:[0,0], highcut:[0,0], comp:[0.1,0.28]},
      found:{role:"bed", vol:[0.03,0.09], pitch:[0.7,0.9], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[0.004,0.014], periodBars:[2,4], prob:0.3},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.03},
      stab:["off"],
      form:"wave",
      theory:{adventure:[0.112,0.225], color:[0.162,0.35], voicing:"close", reharm:true},
      rhythm:[0.257,0.467],
      pipes:[{id:"strum", w:0.55, step:0.02},{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:postrock:genres */
    /* genre-tool:cryptvespers:genres */
    cryptvespers: { label:"Reliquary Smoke", info:"A boom-bap kit at 59-74. A church organ under a church organ, with ahh choir. A two-chord minor drone, swung, loose timing, rubato, one chord every 32 beats.",
      bpm:[59,74],
      swing:[0.075,0.16],
      humanize:[0.25,0.475],
      progressions:["drone_min","mode_phrygian","mode_dorian","neosoul"],
      kits:["off","boombap","breaks","halftime"],
      fills:["off","drum fill","downlift"],
      chordEvery:32,
      bass:{patterns:["pedal","off","root","dub"], samplerPool:["church_organ","contrabass","acoustic_bass"], recipe:{model:["sampler","sub","saw"], cutoff:[400,800], res:[0.05,0.15], level:[0.7,0.925], send:[0.175,0.31], dsend:[0,0.09], attack:[0.05,0.15], release:[0.6,1.2]}, inserts:{prob:0.5, max:1, pool:[["distort",{drive:[0.1,0.22], mix:[0.35,0.6]}]]}},
      lead:{patterns:["wander","sparse","composed","off"], patchPool:["E.PIANO 2"], samplerPool:["ahh_choir","ohh_voices","muted_trumpet"], recipe:{model:["sampler","fm","dx7"], wave:"sine", voices:[1,2], spread:[0.0015,0.004], cutoff:[1800,2900], level:[0.45,0.57], send:[0.45,0.65], dsend:[0.15,0.3], vibrato:[0.004,0.01], octave:0.08, attack:[0.08,0.2], release:[0.4,0.725], sustain:[0.78,0.88], fenv:[0.2,0.4]}},
      pads:{prob:0.625, samplerPool:["church_organ","strings"], recipe:{model:["sampler","fm","strings"], wave:"sine", cutoff:[750,1350], detune:[0.0025,0.0065], attack:[1.25,2.75], level:[0.4,0.55], send:[0.45,0.65], dsend:[0.075,0.19], release:[2,4], swell:1}, inserts:{prob:0.35, max:1, pool:[["phaser",{rate:[0.06,0.18], depth:[0.4,0.6], mix:[0.3,0.5]}]]}},
      drums:{kickModel:["boom","808"], snareModel:["noise","crack"], hatModel:["noise"], kick:[0.725,0.95], snare:[0.475,0.7], hat:[0.35,0.6], tune:[0.85,0.975], send:[0.175,0.35], dsend:[0.075,0.175], kit:"room"},
      fx:{reverb:[0.625,0.815], delayBeats:[0.875,1.75], delayFb:[0.2,0.36], delayCut:[1650,2600], pump:[0,0.05], crackle:[0.175,0.375], lowcut:[0,15], highcut:[4500,7000], comp:[0.125,0.25]},
      found:{role:"bed", vol:[0.115,0.205], pitch:[0.8,0.9], stretch:[0.5,0.575], cutoff:[2650,3950], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[0.03,0.05], periodBars:[4,8], prob:1},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.12},
      stab:["off"],
      form:"ritual",
      theory:{adventure:[0.188,0.31], color:[0.3,0.5], voicing:"close", reharm:true},
      rhythm:[0.238,0.42],
      pipes:[{id:"ghost", w:0.55, prob:0.35}] },
    /* /genre-tool:cryptvespers:genres */
    /* genre-tool:nocturnesmash:genres */
    nocturnesmash: { label:"Chandelier Shrapnel", info:"A jungle kit at 114-141. A yamaha grand piano under strings, with a yamaha grand piano. Royal-road changes, a light shuffle, rubato.",
      bpm:[114,141],
      swing:[0,0.05],
      humanize:[0.17,0.35],
      progressions:["royal_road","mediant","sad_pop","neosoul"],
      kits:["off","jungle","breaks"],
      fills:["off","break fill","impact","cut"],
      chordEvery:8,
      bass:{patterns:["octaves","pedal","melodic","walking"], recipe:{model:["sampler","sub","reese"], cutoff:[420,920], res:[0.075,0.175], level:[0.85,1.095], send:[0.14,0.275], dsend:[0,0.08], attack:[0.008,0.03], release:[0.6,1.4]}, inserts:{prob:0.5, max:1, pool:[["distort",{drive:[0.4,0.8], mix:[0.6,0.9]}]]}, samplerPool:["yamaha_grand_piano","bright_yamaha_grand"]},
      lead:{patterns:["arpup","updown","canon","off"], recipe:{model:["sampler","pluck","fuzz"], wave:"sine", voices:[1,2], spread:[0.002,0.006], cutoff:[2400,3900], res:[0.2,0.35], level:[0.4,0.59], send:[0.275,0.475], dsend:[0.17,0.33], attack:[0.006,0.03], release:[0.275,0.595], sustain:[0.5,0.62], fenv:[0.5,0.9]}, samplerPool:["yamaha_grand_piano","bright_yamaha_grand"]},
      pads:{prob:0.325, recipe:{model:["sampler","strings","saw"], wave:"sine", cutoff:[750,1400], detune:[0.005,0.011], attack:[1.1,2.75], level:[0.3,0.46], send:[0.375,0.56], dsend:[0.075,0.2], release:[2,4], swell:1}, samplerPool:["strings","slow_strings"]},
      drums:{kickModel:["boom","909","808"], snareModel:["noise","crack"], hatModel:["noise","metal"], kick:[0.9,1.125], snare:[0.6,0.825], hat:[0.4,0.65], tune:[0.975,1.1], send:[0.1,0.235], dsend:[0.075,0.175]},
      fx:{reverb:[0.4,0.61], delayBeats:[0.6875,1.375], delayFb:[0.235,0.38], delayCut:[2000,3100], pump:[0.025,0.125], crackle:[0,0.115], lowcut:[13,20], highcut:[0,0], comp:[0.275,0.45], grit:[0.4,0.7], jux:[0.45,0.75]},
      found:{role:"bed", vol:[0.175,0.27], pitch:[0.85,0.95], stretch:[0.475,0.55], cutoff:[3900,5900], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[0.03,0.07], periodBars:[1,3], prob:1},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.12},
      stab:["off","rave","offbeat"],
      form:"wave",
      theory:{adventure:[0.188,0.338], color:[0.338,0.55], voicing:"close", reharm:true},
      rhythm:[0.35,0.543],
      pipes:[{id:"echoCanon", w:0.55, prob:0.45, delay:2},{id:"densityArc", w:0.4, floor:0.6},{id:"sweepArc", w:0.45, lo:0.7, hi:2}] },
    /* /genre-tool:nocturnesmash:genres */
    /* genre-tool:glacialgabber:genres */
    glacialgabber: { label:"Permafrost Bludgeon", info:"A four-on-the-floor at 107-129. Acid bass under ahh choir, with a harp. A two-chord minor drone, straight time, one chord every 32 beats.",
      bpm:[107,129],
      swing:[0,0.015],
      humanize:[0.05,0.19],
      progressions:["drone_min","deep_two","mode_phrygian"],
      kits:["four","techno","off"],
      fills:["impact","cut","riser","hat rush"],
      chordEvery:32,
      bass:{patterns:["stab","drive","rolling","off"], recipe:{model:["acid","reese","sub"], cutoff:[335,575], res:[0.15,0.25], level:[0.95,1.175], send:[0.1,0.23], dsend:[0,0.09]}, inserts:{prob:0.8, max:1, pool:[["distort",{drive:[0.5,0.9], mix:[0.8,1]}]]}},
      lead:{patterns:["double","off","arpup","sparse"], samplerPool:["harp"], recipe:{model:["hoover","fm","stack","sampler"], wave:"saw", voices:[2,4], spread:[0.005,0.0095], cutoff:[2100,3200], level:[0.38,0.515], send:[0.4,0.575], dsend:[0.25,0.425], vibrato:[0.002,0.006], octave:0.14, attack:0.003, release:[0.38,0.6], sustain:[0.725,0.81], res:[0.3,0.45], fenv:[0.7,1.2]}, inserts:{prob:0.7, max:2, pool:[["phaser",{rate:[0.15,0.4], depth:[0.5,0.7], mix:[0.35,0.55]}],["distort",{drive:[0.5,0.85], mix:[0.7,1]}]]}},
      pads:{prob:0.6, patchPool:["TUB BELLS","SHIMMER","WATER GDN"], samplerPool:["ahh_choir","harp"], recipe:{model:["saw","organ","dx7","sampler"], wave:"saw", cutoff:[600,1100], detune:[0.007,0.015], attack:[1.75,3.25], level:[0.475,0.635], send:[0.45,0.625], dsend:[0.125,0.275]}, inserts:{prob:0.4, max:2, pool:[["chorus",{rate:[0.1,0.3], depth:[0.4,0.7], mix:[0.3,0.5]}],["filtersweep",{rateBars:[8,16], lo:[-0.8,-0.3], hi:[0.5,1], res:[0.1,0.25]}]]}},
      drums:{kickModel:["909","808"], snareModel:["clap","crack","noise"], hatModel:["metal","noise"], kick:[1.05,1.35], snare:[0.55,0.8], hat:[0.5,0.8], tune:[0.925,1.1], send:[0.175,0.31], dsend:[0.025,0.125]},
      fx:{reverb:[0.565,0.675], delayBeats:[0.6875,1], delayFb:[0.325,0.5], delayCut:[1850,2950], pump:[0.2,0.35], crackle:[0,0.125], lowcut:[15,23], highcut:[0,0], comp:[0.3,0.475], grit:[0.7,0.95], jux:[0.15,0.35]},
      found:{role:"bed", vol:[0.15,0.25], pitch:[0.75,0.95], stretch:[0.425,0.6], cutoff:[2100,3500], sources:["iriomote","tokyo_station"]},
      hits:{sources:["pool:vb_rave_hardcore*1","sp_herenow"], pattern:"sparse", prob:0.12},
      stab:["rave","offbeat","off"],
      form:"dj",
      theory:{adventure:[0.067,0.133], color:[0.167,0.35], voicing:"open", reharm:false},
      rhythm:[0.067,0.193],
      pipes:[{id:"strum", w:0.55, step:0.02},{id:"octavePump", w:0.5, prob:0.4},{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:glacialgabber:genres */
    /* genre-tool:breakbop:genres */
    breakbop: { label:"Amen Hypotenuse", info:"A shuffle at 177-196. Acoustic bass under a bright yamaha grand, with an alto sax. ii-V-I, hard swing.",
      bpm:[177,196],
      swing:[0.14,0.29],
      humanize:[0.175,0.375],
      progressions:["ii_v_i","neosoul","blues_12","blues_16"],
      kits:["shuffle","boombap","jungle","breaks"],
      fills:["off","drum fill","kit fill","break fill"],
      bass:{patterns:["walking","root","sub","dub"], recipe:{model:["sampler","sub","reese"], cutoff:[330,590], res:[0.05,0.175], level:[1.1,1.325], send:[0.025,0.085], dsend:[0,0.025]}, inserts:{prob:0.3, max:1, pool:[["distort",{drive:[0.15,0.35], mix:[0.4,0.7]}]]}, samplerPool:["acoustic_bass"]},
      lead:{patterns:["double","arp16","wander","off"], recipe:{model:["sampler","pluck","fm"], wave:"sine", voices:[1,2], spread:[0.002,0.005], cutoff:[2000,3200], level:[0.36,0.48], send:[0.3,0.475], dsend:[0.225,0.4], octave:0, attack:0.0115, release:[0.085,0.145], sustain:[0.55,0.67], fenv:[0.5,0.8], vibrato:[0.006,0.012]}, samplerPool:["alto_sax","tenor_sax","trumpet","muted_trumpet"]},
      pads:{prob:0.325, recipe:{model:["sampler","saw","organ"], wave:"sine", cutoff:[950,1625], detune:[0.0035,0.0085], attack:[1.025,1.85], level:[0.35,0.48], send:[0.35,0.525], dsend:[0.1,0.225]}, samplerPool:["bright_yamaha_grand","jazz_guitar"]},
      drums:{kickModel:["boom","808"], snareModel:["noise","crack"], hatModel:["noise"], kick:[0.875,1.15], snare:[0.575,0.825], hat:[0.6,0.925], tune:[0.95,1.1], send:[0.125,0.275], dsend:[0.175,0.35], kit:"brush"},
      fx:{reverb:[0.375,0.575], delayBeats:[0.75,1.5], delayFb:[0.275,0.45], delayCut:[1900,3100], pump:[0,0.1], crackle:[0.075,0.3], lowcut:[13,35], highcut:[0,0], comp:[0.275,0.475], grit:[0.15,0.35], jux:[0.25,0.5]},
      found:{role:"bed", scratch:0.45, vol:[0.18,0.295], pitch:[0.95,1.025], stretch:[0.475,0.55], cutoff:[4000,6100], sources:["iriomote","tokyo_station"]},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.12},
      stab:["off","sparse"],
      form:"aaba",
      theory:{adventure:[0.363,0.563], color:[0.475,0.7], voicing:"drop2", reharm:true},
      rhythm:[0.4,0.625],
      pipes:[{id:"ghost", w:0.55, prob:0.35},{id:"callResponse", w:0.5, level:0.85},{id:"throwFx", w:0.55, prob:0.6}] },
    /* /genre-tool:breakbop:genres */
    /* genre-tool:atticlament:genres */
    atticlament: { label:"Servo Elegy", info:"A bare kick at 87-97. Sub bass under brass, with a trumpet. Dream changes, a light shuffle, rubato.",
      bpm:[87,97],
      swing:[0.0035,0.0435],
      humanize:[0.113,0.233],
      progressions:["dream","epic_min","frost","mediant"],
      kits:["off","kick","pulse","four"],
      fills:["off","riser","tom fill","downlift"],
      bass:{patterns:["pedal","root","rolling","stab"], recipe:{model:["sub","saw","acid","reese"], cutoff:[425,750], res:[0.125,0.25], level:[0.95,1.15], send:[0.025,0.115], dsend:[0,0.075]}, inserts:{prob:0.45, max:2, pool:[["filtersweep",{rateBars:[2,4], lo:[-1.2,-0.6], hi:[0.8,1.4], res:[0.25,0.45]}],["distort",{drive:[0.15,0.35], mix:[0.5,0.8]}]]}},
      lead:{patterns:["wander","anthem","sparse","arpup"], patchPool:["BRASS   2","BR TRUMPET","BRASS   1","SYNBRASS 1"], samplerPool:["trumpet","trombone","french_horns"], recipe:{model:["brass","modeld","dx7","vocoder"], wave:"saw", voices:[2,3], spread:[0.003,0.0075], cutoff:[2000,3100], level:[0.55,0.67], send:[0.425,0.6], dsend:[0.25,0.4], vibrato:[0.0025,0.008], glide:[120,260], envAmount:[0.6,1.2], envDecay:[0.3,0.6], oscMix:[0.2,0.5], drift:[4,9], attack:0.15, release:[0.5,0.9], sustain:[0.85,0.95]}, inserts:{prob:0.35, max:1, pool:[["chorus",{rate:[0.4,0.9], depth:[0.4,0.6], mix:[0.35,0.5]}]]}},
      pads:{prob:1, recipe:{model:["brass","vp330","choir","strings"], wave:"saw", cutoff:[850,1500], detune:[0.0055,0.0115], attack:[1.5,3], vowel:[0.225,0.4], ensemble:[0.525,0.7], octave:[0.5,0.6], filterMode:[0,0.15], envAmount:[1,1.6], level:[0.575,0.765], send:[0.525,0.7], dsend:[0.1,0.225]}, inserts:{prob:0.5, max:1, pool:[["phaser",{rate:[0.08,0.2], depth:[0.5,0.7], mix:[0.35,0.55]}]]}},
      drums:{kickModel:["boom","909"], snareModel:["noise","clap"], hatModel:["noise"], kick:[0.8,1.025], snare:[0.5,0.725], hat:[0.4,0.65], tune:[0.875,1.025], send:[0.3,0.475], dsend:[0.025,0.125]},
      fx:{reverb:[0.675,0.815], delayBeats:[0.625,1.125], delayFb:[0.225,0.375], delayCut:[1900,2900], pump:[0.05,0.16], crackle:[0.065,0.185], lowcut:[83,130], highcut:[1300,1700], comp:[0.225,0.41], grit:[0,0.15]},
      found:{role:"bed", vol:[0.21,0.315], pitch:[0.8,0.875], stretch:[0.5,0.575], cutoff:[3600,5500], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[0.015,0.03], periodBars:[2,4], prob:1},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.12},
      stab:["off","sparse"],
      form:"throughline",
      theory:{adventure:[0.125,0.245], color:[0.2,0.4], voicing:"quartal", reharm:true},
      rhythm:[0.053,0.167],
      pipes:[{id:"harmonize", w:0.45, prob:0.35},{id:"sweepArc", w:0.45, lo:0.7, hi:2},{id:"vibratoSwell", w:0.4, depth:0.25}] },
    /* /genre-tool:atticlament:genres */
    /* genre-tool:hazebunker:genres */
    hazebunker: { label:"Fallout Watercolor", info:"A pulse kit at 91-109. A harp under slow strings, with a celesta. Whole-tone planing, a light shuffle, rubato.",
      bpm:[91,109],
      swing:[0.0065,0.0515],
      humanize:[0.0855,0.1905],
      progressions:["whole_tone","quartal","mode_lydian","mediant"],
      kits:["off","pulse","techno"],
      fills:["off","cut","impact","hat rush"],
      chordEvery:8,
      bass:{patterns:["pedal","melodic","root","walking"], recipe:{model:["sampler","sub","reese"], cutoff:[380,840], res:[0.05,0.15], level:[0.81,1.035], send:[0.15,0.285], dsend:[0,0.04], attack:[0.01,0.04], release:[0.6,1.4]}, inserts:{prob:0.3, max:1, pool:[["distort",{drive:[0.15,0.35], mix:[0.4,0.7]}]]}, samplerPool:["harp","cello"]},
      lead:{patterns:["updown","arpup","arpdown","composed"], patchPool:["E.PIANO 1","TUB BELLS","E.PIANO 4","SHIMMER"], samplerPool:["celesta","harp","alto_sax"], recipe:{model:["sampler","stack","dx7"], wave:"sine", voices:[2,3], spread:[0.0025,0.0055], cutoff:[2700,4200], level:[0.39,0.54], send:[0.37,0.59], dsend:[0.12,0.28], vibrato:[0.004,0.009], octave:0.2, attack:[0.004,0.02], release:[0.425,0.8], sustain:[0.85,0.95]}, inserts:{prob:0.5, max:1, pool:[["chorus",{rate:[0.5,1.1], depth:[0.5,0.7], mix:[0.4,0.6]}]]}},
      pads:{prob:0.8, samplerPool:["slow_strings","strings","ahh_choir"], recipe:{model:["sampler","strings","saw","choir"], wave:"sine", cutoff:[950,1700], detune:[0.0035,0.0085], attack:[1.35,2.95], mellotron:true, level:[0.45,0.64], send:[0.475,0.69], dsend:[0.05,0.175], release:[2.5,5], swell:1}, inserts:{prob:0.55, max:1, pool:[["chorus",{rate:[0.2,0.5], depth:[0.5,0.75], mix:[0.4,0.6]}]]}},
      drums:{kickModel:["boom","909"], snareModel:["noise","clap","crack"], hatModel:["noise","metal"], kick:[0.9,1.1], snare:[0.625,0.85], hat:[0.5,0.75], tune:[0.9,1.025], send:[0.1,0.235], dsend:[0.05,0.125]},
      fx:{reverb:[0.565,0.77], delayBeats:[0.75,1.25], delayFb:[0.195,0.35], delayCut:[2000,3100], pump:[0.12,0.23], crackle:[0,0.075], lowcut:[15,23], highcut:[0,0], comp:[0.26,0.41], grit:[0.4,0.7], jux:[0.15,0.35]},
      found:{role:"bed", vol:[0.18,0.28], pitch:[0.85,0.95], stretch:[0.5,0.575], cutoff:[3800,5800], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[0.015,0.04], periodBars:[2,4], prob:0.9},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.12},
      stab:["off","offbeat","sparse"],
      form:"wave",
      theory:{adventure:[0.138,0.263], color:[0.238,0.438], voicing:"quartal", reharm:true},
      rhythm:[0.067,0.193],
      pipes:[{id:"strum", w:0.55, step:0.02},{id:"densityArc", w:0.4, floor:0.6},{id:"sweepArc", w:0.45, lo:0.7, hi:2}] },
    /* /genre-tool:hazebunker:genres */
    /* genre-tool:salsa:genres */
    salsa: { label:"Clave Reactor", info:"A full kit at 158-190. Acoustic bass under an electric piano, with a brass section. ii-V-I, a light shuffle, rubato.",
      timeFeel:{ pushPullMs:{ bass:-5, snare:3 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — TUMBAO: the salsa bass ANTICIPATES — it is the one instrument in the band that is supposed to arrive early
      bpm:[158,190],
      swing:[0,0.06],
      humanize:[0.08,0.2],
      progressions:["ii_v_i","minor_run","four_chords","andalusian"],
      kits:["full","tribal","bossa"],
      fills:["off","drum fill","tom fill"],
      chordEvery:4,
      bass:{patterns:["son","tresillo","habanera"], samplerPool:["acoustic_bass","picked_bass"], recipe:{model:["sampler","sampler"], cutoff:[500,1200], level:[0.5,0.72], send:[0.08,0.2], dsend:[0.02,0.1], attack:[0.006,0.03], release:[0.3,0.8]}},
      lead:{patterns:["hero","anthem","blues"], samplerPool:["brass_section","trumpet"], recipe:{model:["sampler","sampler"], cutoff:[2400,4200], level:[0.44,0.64], send:[0.14,0.32], dsend:[0.02,0.1], attack:[0.006,0.03], release:[0.3,0.8], wave:"saw", voices:[1,2]}},
      pads:{prob:0.5, samplerPool:["electric_piano","brass_section"], recipe:{model:["sampler","sampler"], cutoff:[1400,2400], level:[0.28,0.46], send:[0.16,0.34], dsend:[0.02,0.1], attack:[0.02,0.2], release:[0.4,1.2], wave:"saw"}},
      drums:{kickModel:["boom","909"], snareModel:["crack","noise"], hatModel:["metal","noise"], kick:[0.55,0.8], snare:[0.45,0.68], hat:[0.34,0.58], tune:[0.94,1.05], send:[0.1,0.28], dsend:[0,0.05]},
      fx:{reverb:[0.15,0.34], delayBeats:[0.5,0.75], delayFb:[0.06,0.16], delayCut:[2200,3200], pump:[0,0.06], crackle:[0,0.06], lowcut:[0,0], highcut:[0,0], comp:[0.15,0.4]},
      found:{role:"bed", vol:[0.03,0.09], pitch:[0.75,0.95], stretch:[0.4,0.6], cutoff:[1800,2800], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[0,0.01], periodBars:[4,8], prob:0.15},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.04},
      stab:["off"],
      form:"wave",
      theory:{adventure:[0.188,0.33], color:[0.25,0.425], voicing:"close", reharm:true},
      rhythm:[0.223,0.433],
      pipes:[{id:"callResponse", w:0.5, level:0.85},{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:salsa:genres */
    /* genre-tool:samba:genres */
    samba: { label:"Surdo Swarm Theory", info:"A tribal kit at 96-112. Acoustic bass with a nylon string guitar on both pad and lead. ii-V-I, swung, rubato.",
      timeFeel:{ pushPullMs:{ bass:-4, hat:-5 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — SAMBA: the caixa/agogo sit ahead of the surdo (the documented systematic 16th displacement); the bass rides with them
      bpm:[96,112],
      swing:[0.04,0.14],
      humanize:[0.08,0.2],
      progressions:["ii_v_i","four_chords","neosoul","minor_run"],
      kits:["tribal","bossa","full"],
      fills:["off","drum fill","tom fill"],
      chordEvery:4,
      bass:{patterns:["son","tresillo","root"], samplerPool:["acoustic_bass","picked_bass"], recipe:{model:["sampler","sampler"], cutoff:[500,1200], level:[0.48,0.68], send:[0.1,0.24], dsend:[0.02,0.1], attack:[0.006,0.03], release:[0.3,0.8]}},
      lead:{patterns:["wander","double","updown"], samplerPool:["nylon_string_guitar","trumpet"], recipe:{model:["sampler","sampler"], cutoff:[2200,3800], level:[0.42,0.6], send:[0.16,0.34], dsend:[0.02,0.1], attack:[0.006,0.03], release:[0.3,0.8], wave:"saw", voices:[1,2]}},
      pads:{prob:0.4, samplerPool:["nylon_string_guitar","electric_piano"], recipe:{model:["sampler","sampler"], cutoff:[1400,2400], level:[0.26,0.44], send:[0.18,0.36], dsend:[0.02,0.1], attack:[0.02,0.3], release:[0.4,1.2], wave:"saw"}},
      drums:{kickModel:["boom","909"], snareModel:["crack","noise"], hatModel:["metal","noise"], kick:[0.55,0.8], snare:[0.45,0.68], hat:[0.34,0.58], tune:[0.94,1.05], send:[0.1,0.28], dsend:[0,0.05]},
      fx:{reverb:[0.18,0.38], delayBeats:[0.5,0.75], delayFb:[0.08,0.18], delayCut:[2200,3200], pump:[0,0.05], crackle:[0,0.08], lowcut:[0,0], highcut:[0,0], comp:[0.12,0.34]},
      found:{role:"bed", vol:[0.03,0.09], pitch:[0.75,0.95], stretch:[0.4,0.6], cutoff:[1800,2800], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[0,0.012], periodBars:[4,8], prob:0.2},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.04},
      stab:["off"],
      form:"wave",
      theory:{adventure:[0.238,0.393], color:[0.35,0.55], voicing:"drop2", reharm:true},
      rhythm:[0.223,0.433],
      pipes:[{id:"strum", w:0.55, step:0.02},{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:samba:genres */
    /* genre-tool:reggaeton:genres */
    reggaeton: { label:"Dembow Tectonics", info:"A full kit at 88-100. A synth bass 1 with a synth brass 1 on both pad and lead. A descending minor run, a light shuffle, rubato.",
      bpm:[88,100],
      swing:[0,0.05],
      humanize:[0.04,0.12],
      progressions:["minor_run","sad_pop","andalusian","house_min"],
      kits:["full","trap","halftime"],
      fills:["off","drum fill","cut"],
      chordEvery:8,
      bass:{patterns:["sub","root","octaves"], samplerPool:["synth_bass_1","synth_bass_2"], recipe:{model:["sampler","sampler"], cutoff:[400,1000], level:[0.52,0.74], send:[0.05,0.16], dsend:[0.02,0.1], attack:[0.004,0.014], release:[0.15,0.4]}},
      lead:{patterns:["sparse","wander","composed"], samplerPool:["synth_brass_1","celesta"], recipe:{model:["sampler","sampler"], cutoff:[2000,3600], level:[0.4,0.58], send:[0.14,0.32], dsend:[0.02,0.1], attack:[0.006,0.03], release:[0.3,0.8], wave:"saw", voices:[1,2]}},
      pads:{prob:0.35, samplerPool:["synth_brass_1","strings"], recipe:{model:["sampler","strings"], cutoff:[1200,2000], level:[0.24,0.42], send:[0.16,0.34], dsend:[0.02,0.1], attack:[0.1,0.6], release:[0.6,1.6], wave:"saw"}},
      drums:{kickModel:["boom","909"], snareModel:["crack","noise"], hatModel:["metal","noise"], kick:[0.55,0.8], snare:[0.45,0.68], hat:[0.34,0.58], tune:[0.94,1.05], send:[0.1,0.28], dsend:[0,0.05]},
      fx:{reverb:[0.2,0.4], delayBeats:[0.5,1], delayFb:[0.1,0.24], delayCut:[2000,3000], pump:[0,0.12], crackle:[0,0.05], lowcut:[0,0.1], highcut:[0,0], comp:[0.2,0.45]},
      found:{role:"bed", vol:[0.03,0.09], pitch:[0.75,0.95], stretch:[0.4,0.6], cutoff:[1800,2800], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[0,0.006], periodBars:[4,8], prob:0.08},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.04},
      stab:["off"],
      form:"wave",
      theory:{adventure:[0.112,0.23], color:[0.162,0.313], voicing:"close", reharm:true},
      rhythm:[0.207,0.417],
      pipes:[{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:reggaeton:genres */
    /* genre-tool:raga:genres */
    raga: { label:"Tanpura Nebula", info:"A tribal kit at 64-92. Contrabass under strings, with a sitar. A two-chord minor drone, straight time, rubato, one chord every 16 beats.",
      bpm:[64,92],
      swing:[0,0.04],
      humanize:[0.1,0.26],
      progressions:["drone_min","mode_phrygian","hijaz","mode_dorian"],
      kits:["off","tribal","kick"],
      fills:["off"],
      chordEvery:16,
      bass:{patterns:["pedal","root","sub"], samplerPool:["contrabass","cello"], recipe:{model:["sampler","sampler"], cutoff:[400,1000], level:[0.42,0.6], send:[0.2,0.4], dsend:[0.02,0.1], attack:[0.02,0.08], release:[0.6,1.6]}},
      lead:{patterns:["wander","arpup","sparse"], samplerPool:["sitar","sitar"], recipe:{model:["sampler","sampler"], cutoff:[2400,4200], level:[0.44,0.62], send:[0.24,0.46], dsend:[0.02,0.1], attack:[0.01,0.05], release:[0.4,1], wave:"saw", voices:[1,2]}},
      pads:{prob:0.7, samplerPool:["strings","sitar"], recipe:{model:["sampler","strings"], cutoff:[900,1700], level:[0.3,0.5], send:[0.34,0.56], dsend:[0.02,0.1], attack:[1.5,3.5], release:[2.5,5], wave:"saw", swell:1, detune:[0.002,0.006]}},
      drums:{kickModel:["boom","909"], snareModel:["crack","noise"], hatModel:["metal","noise"], kick:[0.55,0.8], snare:[0.45,0.68], hat:[0.34,0.58], tune:[0.94,1.05], send:[0.1,0.28], dsend:[0,0.05]},
      fx:{reverb:[0.4,0.62], delayBeats:[0.75,1.5], delayFb:[0.1,0.24], delayCut:[2000,3000], pump:[0,0], crackle:[0,0.06], lowcut:[0,0], highcut:[0,0], comp:[0,0.12]},
      found:{role:"bed", vol:[0.03,0.09], pitch:[0.75,0.95], stretch:[0.4,0.6], cutoff:[1800,2800], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[0.02,0.05], periodBars:[1,3], prob:0.85},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.04},
      stab:["off"],
      form:"wave",
      theory:{adventure:[0.15,0.247], color:[0.225,0.4], voicing:"quartal", reharm:true},
      rhythm:[0.133,0.277],
      pipes:[{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:raga:genres */
    /* genre-tool:celtic:genres */
    celtic: { label:"Peat Bog Orrery", info:"A 6/8 kit at 108-134. Acoustic bass under strings, with a fiddle. Dorian, a light shuffle, rubato.",
      bpm:[108,134],
      swing:[0.02,0.1],
      humanize:[0.08,0.2],
      progressions:["mode_dorian","mode_mixo","four_chords","canon"],
      kits:["sixeight","full","open"],
      fills:["off","drum fill","hat rush"],
      chordEvery:4,
      bass:{patterns:["root","walking","pedal"], samplerPool:["acoustic_bass","contrabass"], recipe:{model:["sampler","sampler"], cutoff:[500,1200], level:[0.46,0.66], send:[0.12,0.3], dsend:[0.02,0.1], attack:[0.006,0.03], release:[0.3,0.8]}},
      lead:{patterns:["double","updown","hero"], samplerPool:["fiddle","bagpipe"], recipe:{model:["sampler","sampler"], cutoff:[2400,4200], level:[0.44,0.62], send:[0.18,0.38], dsend:[0.02,0.1], attack:[0.006,0.03], release:[0.3,0.8], wave:"saw", voices:[1,2]}},
      pads:{prob:0.45, samplerPool:["strings","fiddle"], recipe:{model:["sampler","strings"], cutoff:[1000,1900], level:[0.28,0.46], send:[0.24,0.44], dsend:[0.02,0.1], attack:[0.4,1.4], release:[1,2.6], wave:"saw", swell:1, detune:[0.002,0.006]}},
      drums:{kickModel:["boom","909"], snareModel:["crack","noise"], hatModel:["metal","noise"], kick:[0.55,0.8], snare:[0.45,0.68], hat:[0.34,0.58], tune:[0.94,1.05], send:[0.1,0.28], dsend:[0,0.05]},
      fx:{reverb:[0.25,0.46], delayBeats:[0.75,1.5], delayFb:[0.08,0.2], delayCut:[2200,3200], pump:[0,0.05], crackle:[0,0.08], lowcut:[0,0], highcut:[0,0], comp:[0.08,0.28]},
      found:{role:"bed", vol:[0.03,0.09], pitch:[0.75,0.95], stretch:[0.4,0.6], cutoff:[1800,2800], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[0.004,0.016], periodBars:[2,4], prob:0.3},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.04},
      stab:["off"],
      form:"wave",
      theory:{adventure:[0.163,0.3], color:[0.263,0.45], voicing:"close", reharm:true},
      rhythm:[0.107,0.283],
      pipes:[{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:celtic:genres */
    /* genre-tool:trap:genres */
    trap: { label:"Locust Arithmetic", info:"A trap kit at 128-152. A synth bass 1 under a synth brass 1, with a celesta. A descending minor run, straight time, rubato.",
      timeFeel:{ pushPullMs:{ bass:6, hat:-3 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — 808: the long-attack sub lands behind the kick while the triplet hat rolls ride on top — the two-speed feel that reads as 'trap' before any note does
      bpm:[128,152],
      swing:[0,0.04],
      humanize:[0.03,0.1],
      progressions:["minor_run","sad_pop","house_min","andalusian"],
      kits:["trap","halftime","full"],
      fills:["off","cut","hat rush"],
      chordEvery:8,
      bass:{patterns:["sub","root","octaves"], samplerPool:["synth_bass_1","synth_bass_2"], recipe:{model:["sampler","sampler"], cutoff:[400,950], level:[0.54,0.76], send:[0.04,0.14], dsend:[0.02,0.1], attack:[0.004,0.014], release:[0.15,0.5]}},
      lead:{patterns:["sparse","wander","composed"], samplerPool:["celesta","synth_brass_1"], recipe:{model:["sampler","sampler"], cutoff:[2200,3800], level:[0.38,0.56], send:[0.16,0.36], dsend:[0.02,0.1], attack:[0.006,0.03], release:[0.3,0.8], wave:"saw", voices:[1,2]}},
      pads:{prob:0.35, samplerPool:["synth_brass_1","strings"], recipe:{model:["sampler","strings"], cutoff:[1100,2000], level:[0.24,0.42], send:[0.2,0.4], dsend:[0.02,0.1], attack:[0.2,0.8], release:[0.8,2], wave:"saw"}},
      drums:{kickModel:["boom","909"], snareModel:["crack","noise"], hatModel:["metal","noise"], kick:[0.55,0.8], snare:[0.45,0.68], hat:[0.34,0.58], tune:[0.94,1.05], send:[0.1,0.28], dsend:[0,0.05]},
      fx:{reverb:[0.2,0.42], delayBeats:[0.5,1], delayFb:[0.1,0.24], delayCut:[2000,3000], pump:[0,0.1], crackle:[0,0.05], lowcut:[0,0.1], highcut:[0,0], comp:[0.2,0.45]},
      found:{role:"bed", vol:[0.03,0.09], pitch:[0.75,0.95], stretch:[0.4,0.6], cutoff:[1800,2800], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[0,0.006], periodBars:[4,8], prob:0.06},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.04},
      stab:["off"],
      form:"wave",
      theory:{adventure:[0.113,0.23], color:[0.163,0.313], voicing:"close", reharm:true},
      rhythm:[0.207,0.417],
      pipes:[{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:trap:genres */
    /* genre-tool:bigband:genres */
    bigband: { label:"Ballroom Leviathan", info:"A shuffle at 122-178. Acoustic bass with a brass section on both pad and lead. ii-V-I, hard swing, rubato.",
      timeFeel:{ pushPullMs:{ hat:-4, snare:4, bass:4 } },   // GROOVE (docs/MUSIC-MIND.md §Micro-timing) — SWING: the shout-chorus pocket. hat, not ride — bigband runs the jungle kit, which has no ride lane
      bpm:[122,178],
      swing:[0.12,0.24],
      humanize:[0.08,0.2],
      progressions:["ii_v_i","blues_12","blues_16","four_chords"],
      kits:["shuffle","full","boombap"],
      fills:["off","drum fill","tom fill"],
      chordEvery:4,
      bass:{patterns:["walking","root","octaves"], samplerPool:["acoustic_bass","contrabass"], recipe:{model:["sampler","sampler"], cutoff:[500,1200], level:[0.48,0.68], send:[0.1,0.26], dsend:[0.02,0.1], attack:[0.006,0.03], release:[0.3,0.8]}},
      lead:{patterns:["hero","anthem","blues"], samplerPool:["brass_section","alto_sax"], recipe:{model:["sampler","sampler"], cutoff:[2400,4200], level:[0.44,0.64], send:[0.16,0.34], dsend:[0.02,0.1], attack:[0.006,0.03], release:[0.3,0.8], wave:"saw", voices:[1,2]}},
      pads:{prob:0.5, samplerPool:["brass_section","tenor_sax"], recipe:{model:["sampler","sampler"], cutoff:[1400,2400], level:[0.28,0.46], send:[0.18,0.36], dsend:[0.02,0.1], attack:[0.05,0.4], release:[0.5,1.4], wave:"saw"}},
      drums:{kickModel:["boom","909"], snareModel:["crack","noise"], hatModel:["metal","noise"], kick:[0.55,0.8], snare:[0.45,0.68], hat:[0.34,0.58], tune:[0.94,1.05], send:[0.1,0.28], dsend:[0,0.05]},
      fx:{reverb:[0.25,0.46], delayBeats:[0.5,1], delayFb:[0.06,0.16], delayCut:[2200,3200], pump:[0,0.05], crackle:[0.05,0.2], lowcut:[0,0], highcut:[0,0], comp:[0.12,0.34]},
      found:{role:"bed", vol:[0.03,0.09], pitch:[0.75,0.95], stretch:[0.4,0.6], cutoff:[1800,2800], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[0,0.01], periodBars:[4,8], prob:0.15},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.04},
      stab:["off"],
      form:"wave",
      theory:{adventure:[0.3,0.475], color:[0.375,0.575], voicing:"drop2", reharm:true},
      rhythm:[0.223,0.417],
      pipes:[{id:"ghost", w:0.55, prob:0.35},{id:"callResponse", w:0.5, level:0.85},{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:bigband:genres */
    /* genre-tool:flamenco:genres */
    flamenco: { label:"Duende Combustion", info:"A tribal kit at 120-176. A nylon string guitar with a nylon string guitar on both pad and lead. An andalusian cadence, a light shuffle, rubato.",
      bpm:[120,176],
      swing:[0,0.06],
      humanize:[0.1,0.26],
      progressions:["andalusian","hijaz","mode_phrygian","minor_run"],
      kits:["tribal","full","off"],
      fills:["off","drum fill"],
      chordEvery:4,
      bass:{patterns:["root","syncopated","pedal"], samplerPool:["nylon_string_guitar","acoustic_bass"], recipe:{model:["sampler","sampler"], cutoff:[500,1200], level:[0.44,0.64], send:[0.12,0.3], dsend:[0.02,0.1], attack:[0.006,0.03], release:[0.3,0.8]}},
      lead:{patterns:["wander","sparse","hero"], samplerPool:["nylon_string_guitar","steel_string_guitar"], recipe:{model:["sampler","sampler"], cutoff:[2400,4200], level:[0.44,0.62], send:[0.16,0.34], dsend:[0.02,0.1], attack:[0.004,0.02], release:[0.25,0.7], wave:"saw", voices:[1,2]}},
      pads:{prob:0.35, samplerPool:["nylon_string_guitar","strings"], recipe:{model:["sampler","strings"], cutoff:[1100,2000], level:[0.24,0.42], send:[0.16,0.34], dsend:[0.02,0.1], attack:[0.2,0.8], release:[0.6,1.6], wave:"saw", detune:[0.002,0.006]}},
      drums:{kickModel:["boom","909"], snareModel:["crack","noise"], hatModel:["metal","noise"], kick:[0.55,0.8], snare:[0.45,0.68], hat:[0.34,0.58], tune:[0.94,1.05], send:[0.1,0.28], dsend:[0,0.05]},
      fx:{reverb:[0.15,0.34], delayBeats:[0.5,1], delayFb:[0.06,0.18], delayCut:[2200,3200], pump:[0,0.05], crackle:[0,0.08], lowcut:[0,0], highcut:[0,0], comp:[0.1,0.3]},
      found:{role:"bed", vol:[0.03,0.09], pitch:[0.75,0.95], stretch:[0.4,0.6], cutoff:[1800,2800], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[0.015,0.04], periodBars:[1,3], prob:0.6},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.04},
      stab:["off"],
      form:"wave",
      theory:{adventure:[0.163,0.28], color:[0.2,0.35], voicing:"quartal", reharm:true},
      rhythm:[0.157,0.327],
      pipes:[{id:"strum", w:0.55, step:0.02},{id:"densityArc", w:0.4, floor:0.6}] },
    /* /genre-tool:flamenco:genres */
    /* genre-tool:ragtime:genres */
    ragtime: { label:"Perforated Afterlife", info:"Beatless at 104-126. A piano with a honky tonk on both pad and lead. The rag cycle, a light shuffle, rubato.",
      bpm:[104,126],
      swing:[0,0.06],
      humanize:[0.04,0.12],
      progressions:["rag_cycle","rag_cycle","doo_wop","canon"],
      kits:["off"],
      fills:["off"],
      chordEvery:4,
      bass:{patterns:["octaves"], recipe:{model:["piano"], cutoff:[700,1400], level:[0.55,0.75], send:[0.04,0.12], dsend:[0,0.04], attack:[0.004,0.012], release:[0.1,0.25]}},
      lead:{patterns:["ragline","ragline","composed","canon"], samplerPool:["honky_tonk","upright_piano","bright_yamaha_grand"], recipe:{model:["sampler","sampler","piano"], cutoff:[2200,3600], level:[0.5,0.68], send:[0.08,0.2], dsend:[0,0.06], attack:[0.002,0.008], release:[0.08,0.2], wave:"sine", voices:[1,2]}},
      pads:{prob:0.25, samplerPool:["honky_tonk","upright_piano"], recipe:{model:["sampler","piano"], cutoff:[1200,2000], level:[0.24,0.38], send:[0.06,0.16], dsend:[0,0.05], attack:[0.01,0.05], release:[0.15,0.4]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.3,0.5], snare:[0.25,0.45], hat:[0.2,0.4], tune:[0.95,1.05], send:[0.05,0.15], dsend:[0,0.04]},
      fx:{reverb:[0.12,0.28], delayBeats:[0.5,0.75], delayFb:[0.02,0.08], delayCut:[2400,3400], pump:[0,0], crackle:[0.3,0.5], lowcut:[40,90], highcut:[7000,10500], comp:[0.05,0.18]},
      found:{role:"bed", vol:[0.03,0.08], pitch:[0.8,1], stretch:[0.45,0.6], cutoff:[1600,2600], sources:["brighton_arcade","schoolyard_break","nyc_subway"]},
      rubato:{depth:[0,0], periodBars:[4,8], prob:0},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.04},
      stab:["off"],
      form:"aaba",
      theory:{adventure:[0.113,0.225], color:[0.238,0.438], voicing:"open", reharm:true},
      rhythm:[0,0.08],
      pipes:[{id:"echoCanon", w:0.55, prob:0.45, delay:2}] },
    /* /genre-tool:ragtime:genres */
  };
  if (typeof module !== "undefined" && module.exports) module.exports = D;
  else root.__GENRES = D;
})(typeof globalThis !== "undefined" ? globalThis : this);
