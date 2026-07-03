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
    loon:         { label:"Common Loon (USFWS, PD)", url:"https://archive.org/download/CommonLoon/loons.mp3" },   // the loonie's bird — Canadian wilderness bed
    // Leacock, "The Dawn of Canadian History" (PD) — four chunks from different chapters
    leacock1:     { label:"Leacock ch.1", url:"https://archive.org/download/aboriginal_canada/aboriginalcanada_01_leacock.mp3" },
    leacock2:     { label:"Leacock ch.2", url:"https://archive.org/download/aboriginal_canada/aboriginalcanada_02_leacock.mp3" },
    leacock3:     { label:"Leacock ch.3", url:"https://archive.org/download/aboriginal_canada/aboriginalcanada_03_leacock.mp3" },
    leacock4:     { label:"Leacock ch.5", url:"https://archive.org/download/aboriginal_canada/aboriginalcanada_05_leacock.mp3" },
    // transitwave beds — train interiors + station ambiences (radio aporee, CC)
    tw_intrain:    { label:"In a train (Hagen Hbf)",      url:"https://archive.org/download/radio_aporee_log_2014_06_02_12_21_50/radio_aporee_log_2014_06_02_12_21_50.mp3" },
    tw_trains:     { label:"Passenger & cargo trains (Divača)", url:"https://archive.org/download/aporee_51245_58484/RailwayStationDivaaSlovenia.mp3" },
    tw_stationhall:{ label:"Station hall (Taoyuan)",     url:"https://archive.org/download/aporee_39219_48146/soundmap201812162.mp3" },
    tw_platform:   { label:"Station approach (Hastings)", url:"https://archive.org/download/aporee_72529_84687/202605291903.mp3" },
    // vx_* — the voice shelf: poets, numbers stations, old radio, time ladies
    // (manifest with licenses: scratchpad voice-sources.json; ND/NC items flagged there)
    vx_burroughs:     { label:"Burroughs reading (Naropa)",            url:"https://archive.org/download/naropa_william_s_burroughs3/naropa_william_s_burroughs3_64kb.mp3" },
    vx_ginsberg:      { label:"Ginsberg & Waldman 1977 (Naropa)",      url:"https://archive.org/download/Allen_Ginsberg_and_Anne_Waldman_reading_April_1977_77C002/Allen_Ginsberg_and_Anne_Waldman_reading_April_1977_77C002_64kb.mp3" },
    vx_waldman:       { label:"Anne Waldman 1978 (Naropa)",            url:"https://archive.org/download/Anne_Waldman_reading_1978_August_1978_78P110/Anne_Waldman_reading_1978_August_1978_78P110_64kb.mp3" },
    vx_conet_poacher: { label:"Conet: Lincolnshire Poacher",           url:"https://archive.org/download/ird059/tcp_d1_06_the_lincolnshire_poacher_mi5_irdial.mp3" },
    vx_conet_swedish: { label:"Conet: Swedish Rhapsody",               url:"https://archive.org/download/ird059/tcp_d1_01_the_swedish_rhapsody_irdial.mp3" },
    vx_blake:         { label:"Blake, Songs of Experience (LibriVox)", url:"https://archive.org/download/songsofinnocenceandexperience_2001_librivox/songsofinnocenceandexperience_02_blake_64kb.mp3" },
    vx_dickinson:     { label:"Dickinson, Because I could not stop (LibriVox)", url:"https://archive.org/download/dickinson_poems_bm_librivox/06-because_i_could_not_stop_dickinson_64kb.mp3" },
    vx_whitman:       { label:"Whitman, Song of Myself (LibriVox)",    url:"https://archive.org/download/leaves_of_grass_librivox/leaves_03.1_whitman_64kb.mp3" },
    vx_xminusone:     { label:"X Minus One countdown (NBC 1956)",      url:"https://archive.org/download/OTRR_X_Minus_One_Singles/XMinusOne56-02-01036TheCaveOfNight.ogg" },
    vx_suspense:      { label:"Suspense w/ Orson Welles (CBS 1942)",   url:"https://archive.org/download/OTRR_Suspense_Singles_By_Year_1942/Suspense%20420902%20011%20The%20Hitch-Hiker%20%28128-44%29%2028018%2029m32s.mp3" },
    vx_fdr:           { label:"FDR fireside chat, Dec 9 1941",         url:"https://archive.org/download/FDRFiresideChatWarOnJapan/President%20Franklin%20D%20Roosevelt%2527s%20Fireside%20Chat%20Following%20the%20Declaration%20of%20War%20on%20Japan%2C%2012-09-1941.mp3" },
    vx_dday:          { label:"CBS D-Day first bulletins (1944)",      url:"https://archive.org/download/Complete_Broadcast_Day_D-Day/Complete_Broadcast_Day_440606_Part_001.mp3" },
    vx_wwvh:          { label:"WWVH time station, 1980s",              url:"https://archive.org/download/sraa-7ov2e9got5ntfl3y4r9mnblppuzdkm/RadioStationWwvh-StationIdBroadcastSample1980s2359UtcfullLength.mp3" },
    vx_apollo:        { label:"Apollo 11 mission audio",               url:"https://archive.org/download/apollo11_highlights/apollo11_filtered.ogg" },
    vx_timelady:      { label:"At The Tone — telephone time ladies",   url:"https://archive.org/download/AtTheTone01/At%20The%20Tone%2001.ogg" },
    // socialist-realist shelf (chinawave / sovietwave) — licenses in voice-sources.json
    vx_cn_east:   { label:"The East Is Red — massed chorus (1967)",        url:"https://archive.org/download/sailing-the-seas-depends-on-the-helmsman-english/The%20East%20is%20Red.mp3" },
    vx_cn_march:  { label:"March of the PLA — band",                       url:"https://archive.org/download/Music_of_the_Chinese_Revolution/March.of.the.Peoples.Liberation.Army.mp3" },
    vx_cn_opera:  { label:"The North Wind Blows — White-Haired Girl",      url:"https://archive.org/download/lp_arias-from-the-opera-the-white-haired-g_china-opera-and-dance-drama-theatre/disc1/01.02.%20The%20North%20Wind%20Blows.mp3" },
    vx_cn_speech: { label:"Radio Peking shortwave, 1963",                  url:"https://archive.org/download/sraa-radio-peking-1963/Radio%20Peking%20%281963%29.mp3" },
    vx_sv_choir:  { label:"Polyushko-Polye — Red Army Ensemble (78rpm)",   url:"https://archive.org/download/78_polushko-polie-my-own-my-beloved-field_a-v-alexandrov-peoples-artist-of-the-u_gbia0060054b/Polushk%20-%20A.%20V.%20Alexandrov%20People%27s%20Artist%20of%20the%20U.S.S.R..mp3" },
    vx_sv_march:  { label:"March of the Tanks — GABT USSR 1941 (78rpm)",   url:"https://archive.org/download/78_march-of-the-tanks_chorus-and-orch-gabt-ussr-elen-senkewich-v-timofeiev-m-bl_gbia0033872b/March%20of%20the%20Tanks%20-%20Chorus%20and%20orch.%20Gabt%20U.S.S.R.%20Elen%20Senkewich.mp3" },
    vx_sv_speech: { label:"Lenin — gramophone speeches 1919-1921",         url:"https://archive.org/download/leninspeeches1919-1921/sideA.mp3" },
    vx_sv_radio:  { label:"Radio Moscow — Soyuz 26 launch, 1977",          url:"https://archive.org/download/sraa-radio-moscow-salyut-6-space-station-coverage-december-10-1977/1977-12-10%20Saturday%20-%20Soyuz%2026%20Launch%20%281%29.mp3" },
  };
  // sample layer: local files under found/samples/ (kind: break|hit|vox)
  const SAMPLES = {
    amen_165:{ file:"breaks/amen_165_02.wav", kind:"break", bpm:165 },
    amen_170:{ file:"breaks/amen_170_04.wav", kind:"break", bpm:170 },
    amen_172:{ file:"breaks/amen_172_07.wav", kind:"break", bpm:172 },
    amen_175:{ file:"breaks/amen_175_01.wav", kind:"break", bpm:175 },
    // big-beat rave arsenal — the underused sample-CD one-shots (dcc12/20/48)
    bb_horn_a:{ file:"hits/dcc12_00.wav", kind:"hit", durSec:2.35 },
    bb_horn_b:{ file:"hits/dcc12_01.wav", kind:"hit", durSec:2.45 },
    bb_stab_a:{ file:"hits/dcc20_00.wav", kind:"hit", durSec:2.43 },
    bb_stab_b:{ file:"hits/dcc20_01.wav", kind:"hit", durSec:2.48 },
    bb_stab_c:{ file:"hits/dcc48_00.wav", kind:"hit", durSec:2.49 },
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
    // paleontologist narration (dino-synth voiceover, glitched at render)
    sp_paleo_welcome: { file:"speech/paleo_welcome.wav",  kind:"speech", durSec:2.51 },
    sp_paleo_mesozoic:{ file:"speech/paleo_mesozoic.wav", kind:"speech", durSec:8.06 },
    sp_paleo_sauropod:{ file:"speech/paleo_sauropod.wav", kind:"speech", durSec:3.75 },
    sp_paleo_rex:     { file:"speech/paleo_rex.wav",      kind:"speech", durSec:5.84 },
    sp_paleo_bones:   { file:"speech/paleo_bones.wav",    kind:"speech", durSec:7.37 },
    sp_paleo_skies:   { file:"speech/paleo_skies.wav",    kind:"speech", durSec:3.30 },
    // canawave — Canadian news narration + the loon call
    ca_loon:      { file:"hits/loon.wav",         kind:"hit",    durSec:24.1 },
    sp_ca_news:   { file:"speech/ca_news.wav",    kind:"speech", durSec:6.11 },
    sp_ca_maple:  { file:"speech/ca_maple.wav",   kind:"speech", durSec:4.45 },
    sp_ca_gold:   { file:"speech/ca_gold.wav",    kind:"speech", durSec:4.89 },
    sp_ca_lights: { file:"speech/ca_lights.wav",  kind:"speech", durSec:2.81 },
    sp_ca_rockies:{ file:"speech/ca_rockies.wav", kind:"speech", durSec:6.02 },
    sp_ca_sorry:  { file:"speech/ca_sorry.wav",   kind:"speech", durSec:4.40 },
    sp_ca_justwatchme:{ file:"speech/ca_justwatchme.wav", kind:"speech", durSec:2.66 },
    sp_ca_cities: { file:"speech/ca_cities.wav",  kind:"speech", durSec:13.30 },   // rhyming-cities poem (chopped texture)
    // hockey, hockey lore, hockey stuff
    sp_ca_hnic:    { file:"speech/ca_hnic.wav",     kind:"speech", durSec:2.60 },
    sp_ca_cup:     { file:"speech/ca_cup.wav",      kind:"speech", durSec:5.31 },
    sp_ca_topshelf:{ file:"speech/ca_topshelf.wav", kind:"speech", durSec:4.10 },
    sp_ca_fivehole:{ file:"speech/ca_fivehole.wav", kind:"speech", durSec:4.02 },
    sp_ca_gretzky: { file:"speech/ca_gretzky.wav",  kind:"speech", durSec:4.38 },
    sp_ca_save:    { file:"speech/ca_save.wav",     kind:"speech", durSec:3.08 },
    sp_ca_overtime:{ file:"speech/ca_overtime.wav", kind:"speech", durSec:5.21 },
    sp_ca_hockey:  { file:"speech/ca_he_shoots.wav",kind:"speech", durSec:3.09 },   // "he shoots, he scores!"
    ca_horn:       { file:"hits/goal_horn.wav",     kind:"hit",    durSec:3.43 },   // NHL goal horn (real)
    horns_78:{ file:"78s/horns_78.wav", kind:"hit", durSec:6 },
    blues_vox_78:{ file:"78s/blues_vox_78.wav", kind:"hit", durSec:6 },
    // transitwave — station-PA train-schedule announcements (espeak, telephone-band) + real train one-shots
    sp_tw_next:      { file:"speech/tw_next.wav",       kind:"speech", durSec:3.34 },
    sp_tw_arriving:  { file:"speech/tw_arriving.wav",   kind:"speech", durSec:5.41 },
    sp_tw_standclear:{ file:"speech/tw_standclear.wav", kind:"speech", durSec:3.71 },   // NYC subway
    sp_tw_express:   { file:"speech/tw_express.wav",    kind:"speech", durSec:6.51 },
    sp_tw_delay:     { file:"speech/tw_delay.wav",      kind:"speech", durSec:2.85 },
    sp_tw_gap:       { file:"speech/tw_gap.wav",        kind:"speech", durSec:4.70 },
    sp_tw_aboard:    { file:"speech/tw_aboard.wav",     kind:"speech", durSec:4.42 },
    sp_tw_local:     { file:"speech/tw_local.wav",      kind:"speech", durSec:6.62 },
    sp_tw_terminus:  { file:"speech/tw_terminus.wav",   kind:"speech", durSec:6.43 },
    sp_tw_tickets:   { file:"speech/tw_tickets.wav",    kind:"speech", durSec:4.35 },
    sp_tw_schedule:  { file:"speech/tw_schedule.wav",   kind:"speech", durSec:16.23 },  // the departures litany (chopped texture)
    tw_arrival:      { file:"hits/train_arrival.wav",   kind:"hit",    durSec:8.0 },   // a train pulling into the platform (Nuremberg field rec)
    tw_pass:         { file:"hits/train_pass.wav",      kind:"hit",    durSec:4.0 },   // a train passing (sparse punctuation)
    tw_ding:         { file:"hits/door_ding.wav",       kind:"hit",    durSec:1.6 },   // the transit door "ding ding" two-tone chime (synthesized)
    // world-metro station names worldwide (buried texture, one under every measure — see buildEvents)
    sp_st_admiralty:{ file:"speech/st_admiralty.wav", kind:"speech", durSec:1.08 },
    sp_st_akiba:{ file:"speech/st_akiba.wav", kind:"speech", durSec:1.22 },
    sp_st_alex:{ file:"speech/st_alex.wav", kind:"speech", durSec:1.65 },
    sp_st_arbat:{ file:"speech/st_arbat.wav", kind:"speech", durSec:1.24 },
    sp_st_astoria:{ file:"speech/st_astoria.wav", kind:"speech", durSec:1.01 },
    sp_st_atlantic:{ file:"speech/st_atlantic.wav", kind:"speech", durSec:1.55 },
    sp_st_atocha:{ file:"speech/st_atocha.wav", kind:"speech", durSec:0.95 },
    sp_st_baker:{ file:"speech/st_baker.wav", kind:"speech", durSec:1.32 },
    sp_st_bank:{ file:"speech/st_bank.wav", kind:"speech", durSec:0.87 },
    sp_st_bastille:{ file:"speech/st_bastille.wav", kind:"speech", durSec:0.96 },
    sp_st_bedford:{ file:"speech/st_bedford.wav", kind:"speech", durSec:1.47 },
    sp_st_belleville:{ file:"speech/st_belleville.wav", kind:"speech", durSec:0.97 },
    sp_st_belmont:{ file:"speech/st_belmont.wav", kind:"speech", durSec:1.01 },
    sp_st_bloor:{ file:"speech/st_bloor.wav", kind:"speech", durSec:1.23 },
    sp_st_brixton:{ file:"speech/st_brixton.wav", kind:"speech", durSec:0.98 },
    sp_st_bugis:{ file:"speech/st_bugis.wav", kind:"speech", durSec:0.91 },
    sp_st_camden:{ file:"speech/st_camden.wav", kind:"speech", durSec:1.41 },
    sp_st_catalunya:{ file:"speech/st_catalunya.wav", kind:"speech", durSec:1.16 },
    sp_st_causeway:{ file:"speech/st_causeway.wav", kind:"speech", durSec:1.39 },
    sp_st_centraal:{ file:"speech/st_centraal.wav", kind:"speech", durSec:1.06 },
    sp_st_central:{ file:"speech/st_central.wav", kind:"speech", durSec:0.99 },
    sp_st_chandni:{ file:"speech/st_chandni.wav", kind:"speech", durSec:1.36 },
    sp_st_chatelet:{ file:"speech/st_chatelet.wav", kind:"speech", durSec:1.02 },
    sp_st_circular:{ file:"speech/st_circular.wav", kind:"speech", durSec:1.37 },
    sp_st_colosseo:{ file:"speech/st_colosseo.wav", kind:"speech", durSec:1.11 },
    sp_st_coney:{ file:"speech/st_coney.wav", kind:"speech", durSec:1.24 },
    sp_st_dam:{ file:"speech/st_dam.wav", kind:"speech", durSec:1.29 },
    sp_st_dupont:{ file:"speech/st_dupont.wav", kind:"speech", durSec:1.42 },
    sp_st_embarcadero:{ file:"speech/st_embarcadero.wav", kind:"speech", durSec:1.36 },
    sp_st_fulton:{ file:"speech/st_fulton.wav", kind:"speech", durSec:1.39 },
    sp_st_gangnam:{ file:"speech/st_gangnam.wav", kind:"speech", durSec:0.99 },
    sp_st_ginza:{ file:"speech/st_ginza.wav", kind:"speech", durSec:0.88 },
    sp_st_grand:{ file:"speech/st_grand.wav", kind:"speech", durSec:1.37 },
    sp_st_granvia:{ file:"speech/st_granvia.wav", kind:"speech", durSec:1.26 },
    sp_st_harvard:{ file:"speech/st_harvard.wav", kind:"speech", durSec:1.03 },
    sp_st_hbf:{ file:"speech/st_hbf.wav", kind:"speech", durSec:1.41 },
    sp_st_hongdae:{ file:"speech/st_hongdae.wav", kind:"speech", durSec:0.97 },
    sp_st_ikebukuro:{ file:"speech/st_ikebukuro.wav", kind:"speech", durSec:1.33 },
    sp_st_itaewon:{ file:"speech/st_itaewon.wav", kind:"speech", durSec:0.90 },
    sp_st_jamsil:{ file:"speech/st_jamsil.wav", kind:"speech", durSec:0.98 },
    sp_st_kadikoy:{ file:"speech/st_kadikoy.wav", kind:"speech", durSec:1.11 },
    sp_st_kiev:{ file:"speech/st_kiev.wav", kind:"speech", durSec:1.15 },
    sp_st_kings:{ file:"speech/st_kings.wav", kind:"speech", durSec:1.37 },
    sp_st_komso:{ file:"speech/st_komso.wav", kind:"speech", durSec:1.43 },
    sp_st_kotti:{ file:"speech/st_kotti.wav", kind:"speech", durSec:1.52 },
    sp_st_lazare:{ file:"speech/st_lazare.wav", kind:"speech", durSec:1.43 },
    sp_st_liverpool:{ file:"speech/st_liverpool.wav", kind:"speech", durSec:1.49 },
    sp_st_marien:{ file:"speech/st_marien.wav", kind:"speech", durSec:1.27 },
    sp_st_metrocenter:{ file:"speech/st_metrocenter.wav", kind:"speech", durSec:1.39 },
    sp_st_mongkok:{ file:"speech/st_mongkok.wav", kind:"speech", durSec:1.29 },
    sp_st_montpar:{ file:"speech/st_montpar.wav", kind:"speech", durSec:1.26 },
    sp_st_mustek:{ file:"speech/st_mustek.wav", kind:"speech", durSec:0.98 },
    sp_st_nakano:{ file:"speech/st_nakano.wav", kind:"speech", durSec:1.01 },
    sp_st_nation:{ file:"speech/st_nation.wav", kind:"speech", durSec:0.97 },
    sp_st_nord:{ file:"speech/st_nord.wav", kind:"speech", durSec:1.36 },
    sp_st_opera:{ file:"speech/st_opera.wav", kind:"speech", durSec:0.88 },
    sp_st_orchard:{ file:"speech/st_orchard.wav", kind:"speech", durSec:0.95 },
    sp_st_oxford:{ file:"speech/st_oxford.wav", kind:"speech", durSec:1.57 },
    sp_st_paddington:{ file:"speech/st_paddington.wav", kind:"speech", durSec:1.11 },
    sp_st_parkst:{ file:"speech/st_parkst.wav", kind:"speech", durSec:1.31 },
    sp_st_paulista:{ file:"speech/st_paulista.wav", kind:"speech", durSec:1.03 },
    sp_st_penn:{ file:"speech/st_penn.wav", kind:"speech", durSec:1.34 },
    sp_st_pigalle:{ file:"speech/st_pigalle.wav", kind:"speech", durSec:0.87 },
    sp_st_pino:{ file:"speech/st_pino.wav", kind:"speech", durSec:1.35 },
    sp_st_potsdamer:{ file:"speech/st_potsdamer.wav", kind:"speech", durSec:1.64 },
    sp_st_powell:{ file:"speech/st_powell.wav", kind:"speech", durSec:1.33 },
    sp_st_raffles:{ file:"speech/st_raffles.wav", kind:"speech", durSec:1.39 },
    sp_st_rajiv:{ file:"speech/st_rajiv.wav", kind:"speech", durSec:1.30 },
    sp_st_retiro:{ file:"speech/st_retiro.wav", kind:"speech", durSec:0.98 },
    sp_st_roppongi:{ file:"speech/st_roppongi.wav", kind:"speech", durSec:1.07 },
    sp_st_rossio:{ file:"speech/st_rossio.wav", kind:"speech", durSec:1.01 },
    sp_st_sadat:{ file:"speech/st_sadat.wav", kind:"speech", durSec:0.96 },
    sp_st_sagrada:{ file:"speech/st_sagrada.wav", kind:"speech", durSec:1.55 },
    sp_st_se:{ file:"speech/st_se.wav", kind:"speech", durSec:0.77 },
    sp_st_shibuya:{ file:"speech/st_shibuya.wav", kind:"speech", durSec:1.02 },
    sp_st_shinagawa:{ file:"speech/st_shinagawa.wav", kind:"speech", durSec:1.13 },
    sp_st_shinjuku:{ file:"speech/st_shinjuku.wav", kind:"speech", durSec:1.14 },
    sp_st_slussen:{ file:"speech/st_slussen.wav", kind:"speech", durSec:0.95 },
    sp_st_sol:{ file:"speech/st_sol.wav", kind:"speech", durSec:1.62 },
    sp_st_spadina:{ file:"speech/st_spadina.wav", kind:"speech", durSec:0.98 },
    sp_st_stephans:{ file:"speech/st_stephans.wav", kind:"speech", durSec:1.41 },
    sp_st_taksim:{ file:"speech/st_taksim.wav", kind:"speech", durSec:1.03 },
    sp_st_tcentralen:{ file:"speech/st_tcentralen.wav", kind:"speech", durSec:1.40 },
    sp_st_termini:{ file:"speech/st_termini.wav", kind:"speech", durSec:1.01 },
    sp_st_times:{ file:"speech/st_times.wav", kind:"speech", durSec:1.48 },
    sp_st_townhall:{ file:"speech/st_townhall.wav", kind:"speech", durSec:1.21 },
    sp_st_ueno:{ file:"speech/st_ueno.wav", kind:"speech", durSec:0.89 },
    sp_st_union:{ file:"speech/st_union.wav", kind:"speech", durSec:1.37 },
    sp_st_victoria:{ file:"speech/st_victoria.wav", kind:"speech", durSec:1.12 },
    sp_st_warschauer:{ file:"speech/st_warschauer.wav", kind:"speech", durSec:1.54 },
    sp_st_waterloo:{ file:"speech/st_waterloo.wav", kind:"speech", durSec:1.00 },
    sp_st_wynyard:{ file:"speech/st_wynyard.wav", kind:"speech", durSec:1.02 },
    sp_st_zocalo:{ file:"speech/st_zocalo.wav", kind:"speech", durSec:1.07 },
    sp_st_zoo:{ file:"speech/st_zoo.wav", kind:"speech", durSec:1.26 },
  };

  // ---------- genre -> found-video clip affinity ----------
  // shared by the live explorer (video-layer.js background) and the offline
  // renderer (render-sample-video.js journey mode). A blend's pool is the
  // union of its parents' pools, dominant genre first. Files: found/video/.
  const GENRE_CLIPS = {
    // 2026-07: merged the Prelinger/city-symphony/abstract/steel/Apollo/Hawaii/soundie
    // batch (pl_/cs_/ab_/ind_/sp_/ns_/dn_/bt_ — credits in found/video/clips.json)
    vaporwave:  ["disc_sunset","bamboo","blue_dinner","sun_riders","sharpest_city","cgi_bird","kaleido","rainbow_rings","tv_room","spacewalk","pl_supermarket","pl_motorama","pl_kitchen","pl_futurama"],
    synthwave:  ["drive_bluehour","drive_dusk","drive_bridge","drive_taillights","night_lines","night_lights","pl_dreamcar","pl_parkinglot","pl_futurama","pl_modelcity","pl_sage"],
    techno:     ["night_lines","phuture_red","dark_face","green_nebula","tv_room","kaleido","pl_sage","cs_manhatta","ind_furnace","ab_diagonale"],
    house:      ["kaleido","rainbow_rings","night_lights","phuture_red","sun_riders","cs_manhatta","cs_marketstreet"],
    jungle:     ["dark_face","phuture_red","night_lines","green_nebula","tw_subway"],
    triphop:    ["deep_face","dark_face","tv_room","night_lights","tw_window","bt_folksinger","ns_octopus"],
    lofi:       ["bamboo","blue_dinner","tv_room","dc_village","disc_sunset","pl_kitchen","pl_americana","pl_lawns","pl_supermarket","pl_parkinglot","bt_folksinger","cs_marketstreet","ab_fantasma"],
    downtempo:  ["earth_orbit","spacewalk","bamboo","green_nebula","disc_sunset","cs_liner","ns_waterfall","ns_hula","ns_rays"],
    ambient:    ["earth_orbit","spacewalk","green_nebula","lw_plateau","dc_rockies","sp_eva","sp_lander","ns_waterfall","ns_rays","ns_octopus"],
    dinosynth:  ["lw_plateau","lw_graze","lw_herd","lw_valley","lw_london","lw_rampage"],
    canawave:   ["dc_vancouver","dc_alberta","dc_rockies","dc_village","dc_skyline","ca_canada","ca_tide","ca_street","pl_lawns","pl_spacefair","dn_schoolyard"],
    transitwave:["tw_platform","tw_interchange","tw_board","tw_subway","tw_terminus","tw_window","tw_express","tw_rails"],
    neoclassical:["earth_orbit","blue_dinner","bamboo","dc_village","spacewalk","cs_manhatta"],
    dancepop:   ["kaleido","rainbow_rings","sun_riders","night_lights","cgi_bird","pl_motorama","pl_kitchen","pl_americana","pl_supermarket","pl_spacefair","pl_worldsfair","dn_schoolyard"],
    edm:        ["phuture_red","kaleido","night_lines","rainbow_rings","cgi_bird","pl_modelcity","pl_sage","ab_diagonale","ab_balletmec","sp_eva"],
    dubstep:    ["dark_face","phuture_red","night_lines","green_nebula","ind_molten","ab_diagonale"],
    blues:      ["tv_room","dc_village","ca_street","disc_sunset","bt_hootenanny","bt_folksinger","cs_liner","dn_soundie"],
    jazz:       ["blue_dinner","tv_room","sharpest_city","night_lights","bt_hootenanny","ab_fantasma","dn_soundie"],
    dub:        ["dark_face","deep_face","night_lines","green_nebula","tv_room","ns_rays","ns_octopus"],
    trance:     ["night_lights","rainbow_rings","kaleido","night_lines","phuture_red","pl_futurama","sp_eva","sp_lander"],
    disco:      ["kaleido","rainbow_rings","night_lights","sun_riders","blue_dinner","pl_motorama","pl_worldsfair","dn_soundie","dn_schoolyard"],
    italo:      ["rainbow_rings","kaleido","sun_riders","night_lights","drive_taillights","cgi_bird","pl_motorama","pl_dreamcar"],
    bigbeat:    ["phuture_red","kaleido","green_nebula","night_lines","dark_face","cs_manhatta","cs_liner","cs_marketstreet","ab_balletmec"],
    garage:     ["night_lights","phuture_red","night_lines","kaleido","drive_taillights","cs_marketstreet"],
    doomdrone:  ["dark_face","deep_face","green_nebula","earth_orbit","lw_plateau","ind_furnace","ind_molten","ns_rays","ns_octopus"],
    newage:     ["earth_orbit","spacewalk","bamboo","dc_rockies","green_nebula","lw_valley","sp_lander","ns_waterfall","ns_hula"],
    exotica:    ["bamboo","lw_valley","lw_graze","dc_village","disc_sunset","ns_waterfall","ns_hula"],
    industrial: ["dark_face","night_lines","tw_subway","phuture_red","tw_rails","pl_sage","ind_furnace","ind_molten","ab_balletmec"],
    spokenword: ["tv_room","deep_face","dark_face","ca_street","sharpest_city","bt_hootenanny","bt_folksinger"],
    chiptune:   ["cgi_bird","kaleido","rainbow_rings","phuture_red","night_lines","sun_riders","ab_diagonale","ab_balletmec","ab_fantasma"],
    // placeholders until dedicated propaganda footage lands (video agent)
    chinawave:  ["bamboo","ns_waterfall","dn_schoolyard","cs_marketstreet","sun_riders","dc_village"],
    sovietwave: ["ind_furnace","ind_molten","cs_manhatta","cs_liner","sp_lander","spacewalk","earth_orbit","tw_rails"],
  };

  // ---------- the anchors ----------
  const GENRES = {
    techno: { label:"Techno", info:"rhythm over harmony: drones, machine four, DJ plateaus",   // SYNTH-FORWARD: samples are texture, not the hook
      bpm:[124,140], swing:[0,0.06], humanize:[0,0.15],
      progressions:["drone_min","deep_two"], kits:["techno","pulse"], fills:["off","riser","cut","hat rush"],
      bass:{patterns:["rolling","stab","sixteenths"], recipe:{model:["acid","saw","reese"],cutoff:[450,800],res:[.2,.35],level:[1.0,1.2],send:[0,.08],dsend:[0,.1]}},
      lead:{patterns:["double","double","arpup","off"], recipe:{model:["pluck","stack"],wave:"square",voices:[1,2],spread:[.002,.006],cutoff:[1500,2600],level:[.3,.42],send:[.15,.3],dsend:[.2,.4],vibrato:[0,.002]}},
      pads:{prob:.3, recipe:{model:["organ","saw"],wave:"saw",cutoff:[550,900],detune:[.004,.01],attack:[1.5,3],level:[.3,.45],send:[.3,.5],dsend:[.1,.2]}},   // dark low pad, mostly ABSENT — no royal-road wash here
      drums:{kickModel:["909"],snareModel:["clap","crack"],hatModel:["metal","noise"],kick:[1.25,1.5],snare:[.55,.8],hat:[.7,1],tune:[.95,1.1],send:[.05,.15],dsend:[.1,.25]},
      fx:{reverb:[.35,.55], delayBeats:[.5,.75], delayFb:[.3,.45], delayCut:[2000,3500], pump:[.4,.65], crackle:[0,.1], lowcut:[35,50], highcut:[0,0], comp:[.5,.7], grit:[.2,.45]},
      found:{role:"chops", vol:[.1,.18], pitch:[.9,1.1], stretch:[.4,.6], cutoff:[1800,3200], sources:["factory","shibuya","vx_wwvh"]},
      stab:["offbeat","offbeat","rave","sparse"], hits:{sources:["vox_b","rave_a","sp_system","sp_energy"], pattern:"sparse", prob:.5},
      form:"dj" },
    house: { label:"House", info:"Chicago house: four-on-floor + claps + open-hat offbeats, warm organ stabs, piano color, min7 sevenths",   // sample-mid: chops present, synths carry
      bpm:[120,126], swing:[.08,.15], humanize:[.05,.18],
      progressions:["house_min7","lofi","deep_two"], kits:["house","house","four"], fills:["off","hat rush","riser"],
      bass:{patterns:["rolling","stab","melodic"], recipe:{model:["saw","sub"],cutoff:[380,700],res:[.15,.3],level:[1.0,1.2],send:[0,.08],dsend:[0,.05]}},
      lead:{patterns:["double","pentaup","arpup","off"], recipe:{model:["piano","fm"],wave:"pulse",voices:[1,3],spread:[.003,.008],cutoff:[2200,3400],level:[.4,.52],send:[.25,.4],dsend:[.2,.35]}},   // piano riffs — the Marshall Jefferson move
      pads:{prob:.9, recipe:{model:["organ"],wave:"saw",cutoff:[1000,1600],detune:[.004,.009],attack:[.15,.4],level:[.5,.65],send:[.25,.4],dsend:[.1,.25]}},   // ORGAN STABS: fast attack = stabby, not washy
      drums:{kickModel:["909","boom"],snareModel:["clap"],hatModel:["noise"],kick:[1.15,1.4],snare:[.6,.85],hat:[1.0,1.3],tune:[.95,1.1],send:[.1,.25],dsend:[.05,.15]},   // hats UP — the open-hat offbeat must be heard
      fx:{reverb:[.4,.6], delayBeats:[.375,.75], delayFb:[.25,.4], delayCut:[2500,4000], pump:[.35,.5], crackle:[0,.15], lowcut:[30,45], highcut:[0,0], comp:[.4,.6]},
      found:{role:"chops", vol:[.1,.18], pitch:[.95,1.1], stretch:[.4,.6], cutoff:[2200,3600], sources:["shibuya","tokyo_station","vx_timelady"]},
      stab:["rave","offbeat"], hits:{sources:["rave_b","rave_c","vox_a","sp_rhythm"], pattern:"offbeat", prob:.55},
      form:"dj" },
    jungle: { label:"Jungle", info:"chopped breaks, sub pressure, rhythm-as-melody, dub space",   // SAMPLE-FORWARD: the amen IS the track
      bpm:[158,172], swing:[0,.08], humanize:[.1,.25],
      progressions:["deep_two","drone_min","minor_run"], kits:["jungle","breaks"], fills:["break fill","break fill","reverse","off"],
      bass:{patterns:["sub","dub"], recipe:{model:["sub","reese"],cutoff:[260,480],res:[.05,.2],level:[1.2,1.45],send:[0,.05],dsend:[0,0]}},
      lead:{patterns:["off","off","sparse","pentaup"], recipe:{model:["pluck","fm"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1600,2800],level:[.3,.42],send:[.3,.5],dsend:[.3,.5]}},
      pads:{prob:.25, recipe:{model:["saw","organ"],wave:"saw",cutoff:[500,850],detune:[.005,.012],attack:[2,3.5],level:[.3,.42],send:[.45,.65],dsend:[.15,.3]}},   // dark, mostly ABSENT — no soft royal-road wash under the amen
      drums:{kickModel:["808"],snareModel:["crack"],hatModel:["noise"],kick:[1.15,1.4],snare:[.6,.85],hat:[.4,.7],tune:[1.0,1.15],send:[.05,.15],dsend:[.35,.6]},
      fx:{reverb:[.35,.55], delayBeats:[.75,1.5], delayFb:[.4,.6], delayCut:[1800,3000], pump:[0,.15], crackle:[.05,.2], lowcut:[25,40], highcut:[0,0], comp:[.35,.55], grit:[.15,.35]},
      found:{role:"break", vol:[.3,.45], pitch:[1,1], stretch:[.5,.5], cutoff:[6000,9000], sources:["amen_165","amen_170","amen_172","amen_175"]},   // the BREAK DOMINATES: loud + wide open, real sampled drums not "light FM"
      stab:["off","sparse"], hits:{sources:["vox_a","rave_d","sp_rewind","sp_pressure"], pattern:"dub", prob:.75},
      form:"dj" },
    triphop: { label:"Trip hop", info:"slowed dusty breaks, jazz color, melancholy, dub weight",   // SAMPLE-FORWARD
      bpm:[72,92], swing:[.15,.3], humanize:[.2,.45],
      progressions:["neosoul","lofi","minor_run","mode_dorian"], kits:["boombap","breaks","halftime"], fills:["off","drum fill","downlift"],
      bass:{patterns:["dub","simple","sub"], recipe:{model:["sub","saw"],cutoff:[300,600],res:[.05,.2],level:[1.0,1.25],send:[.05,.12],dsend:[0,.1]}},
      lead:{patterns:["sparse","wander","off"], recipe:{model:["fm","pluck"],wave:"sine",voices:[1,2],spread:[.002,.006],cutoff:[1800,3000],level:[.4,.52],send:[.4,.6],dsend:[.3,.5],vibrato:[.004,.01]}},
      pads:{prob:.85, recipe:{model:["fm","strings"],wave:"sine",cutoff:[800,1400],detune:[.004,.01],attack:[1,2.5],level:[.5,.68],send:[.45,.65],dsend:[.15,.3]}},
      drums:{kickModel:["808","boom"],snareModel:["noise","crack"],hatModel:["noise"],kick:[1.05,1.3],snare:[.65,.9],hat:[.5,.8],tune:[.8,.95],send:[.15,.3],dsend:[.15,.35]},
      fx:{reverb:[.6,.78], delayBeats:[.75,1.5], delayFb:[.3,.5], delayCut:[1500,2600], pump:[0,.1], crackle:[.35,.6], lowcut:[0,30], highcut:[9000,14000], comp:[.25,.4]},
      found:{role:"break", vol:[.18,.3], pitch:[1,1], stretch:[.5,.5], cutoff:[3800,5500], sources:["amen_165","amen_170"]},
      stab:["off"], hits:{sources:["vox_b","blues_vox_78","sp_slowdown"], pattern:"sparse", prob:.55},
      form:"pop" },
    vaporwave: { label:"Vaporwave", info:"slowed mall nostalgia: maj7 city-pop harmony, drenched reverb, found sound",   // SAMPLE-FORWARD: the bed is the place
      bpm:[62,88], swing:[0,.12], humanize:[.05,.25],
      progressions:["royal_road","dream","pop_1625","neosoul"], kits:["full","open","halftime"], fills:["drum fill","riser","downlift","off"],
      bass:{patterns:["simple","walking","root"], recipe:{model:["saw"],cutoff:[500,900],res:[.1,.25],level:[.9,1.1],send:[.05,.15],dsend:[0,.1]}},
      lead:{patterns:["composed","composed2","arpup","updown"], recipe:{model:["stack"],wave:"sine",voices:[1,2],spread:[.003,.006],cutoff:[2800,4000],level:[.4,.52],send:[.4,.6],dsend:[.2,.4],vibrato:[.004,.009]}},
      pads:{prob:1, recipe:{model:["saw","choir","strings"],wave:"saw",cutoff:[1100,1800],detune:[.004,.009],attack:[1.2,2.4],level:[.6,.8],send:[.5,.7],dsend:[.1,.25]}},
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.9,1.15],snare:[.6,.85],hat:[.75,1.05],tune:[.95,1.1],send:[.15,.3],dsend:[0,.1]},
      fx:{reverb:[.8,.92], delayBeats:[.75,1.5], delayFb:[.25,.4], delayCut:[2200,3200], pump:[0,.1], crackle:[.05,.3], lowcut:[0,0], highcut:[0,0], comp:[0,.15]},
      found:{role:"bed", vol:[.18,.28], pitch:[.7,.85], stretch:[.4,.55], cutoff:[2200,3200], sources:["tokyo_station","shibuya","iriomote","vx_timelady","vx_conet_swedish","vx_wwvh"]},
      stab:["off"], hits:{sources:["sp_plaza","sp_shopping","vox_b"], pattern:"sparse", prob:.5},
      form:"pop" },
    synthwave: { label:"Synthwave", info:"night-drive pulse, supersaw leads, gated drums, minor keys",   // SYNTH-FORWARD: beds distant
      bpm:[88,116], swing:[0,.05], humanize:[.05,.15],
      progressions:["synthwave","epic_min","andalusian","minor_run"], kits:["pulse","four","open"], fills:["tom fill","tom fill","riser","off"],
      bass:{patterns:["drive","octaves","sixteenths"], recipe:{model:["saw","reese"],cutoff:[550,900],res:[.15,.3],level:[1.1,1.3],send:[0,.08],dsend:[0,0]}},
      lead:{patterns:["hero","updown","arpdown"], recipe:{model:["stack"],wave:"saw",voices:[5,7],spread:[.01,.018],cutoff:[2600,3600],level:[.45,.6],send:[.35,.55],dsend:[.25,.4],vibrato:[.002,.005]}},
      pads:{prob:1, recipe:{model:["saw"],wave:"saw",cutoff:[1100,2200],detune:[.01,.018],attack:[1.2,2.4],level:[.65,.85],send:[.45,.65],dsend:[.15,.3]}},
      drums:{kickModel:["909","boom"],snareModel:["noise"],hatModel:["noise"],kick:[1.2,1.45],snare:[.9,1.15],hat:[.4,.65],tune:[.85,1],send:[.45,.65],dsend:[.05,.15]},
      fx:{reverb:[.75,.88], delayBeats:[.5,.75], delayFb:[.25,.4], delayCut:[1800,2800], pump:[.15,.35], crackle:[0,.1], lowcut:[30,45], highcut:[0,0], comp:[.25,.4]},
      found:{role:"bed", vol:[.08,.14], pitch:[.65,.8], stretch:[.45,.6], cutoff:[1000,1800], sources:["highway_night","factory","vx_apollo"]},
      stab:["off","sparse"], hits:{sources:["vox_a","sp_nightdrive"], pattern:"sparse", prob:.3},
      form:"pop" },
    lofi: { label:"Lo-fi", info:"dusty boombap, jazzy 7ths, crackle, everything softened",   // SAMPLE-FORWARD
      bpm:[72,88], swing:[.18,.32], humanize:[.25,.5],
      progressions:["lofi","neosoul","ii_v_i","pop_1625"], kits:["boombap","halftime"], fills:["off","off","drum fill"],
      bass:{patterns:["simple","dub","root"], recipe:{model:["sub","saw"],cutoff:[350,650],res:[.05,.15],level:[.9,1.1],send:[.05,.12],dsend:[0,.05]}},
      lead:{patterns:["pentaup","sparse","wander"], recipe:{model:["fm","pluck"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1800,2800],level:[.4,.52],send:[.35,.5],dsend:[.2,.35],vibrato:[.005,.012]}},
      pads:{prob:.9, recipe:{model:["fm"],wave:"sine",cutoff:[900,1500],detune:[.003,.008],attack:[.8,1.8],level:[.5,.68],send:[.35,.55],dsend:[.1,.2]}},
      drums:{kickModel:["808"],snareModel:["noise"],hatModel:["noise"],kick:[1.0,1.25],snare:[.55,.8],hat:[.55,.85],tune:[.8,.95],send:[.1,.22],dsend:[0,.1]},
      fx:{reverb:[.5,.7], delayBeats:[.5,.75], delayFb:[.2,.35], delayCut:[1800,2800], pump:[0,.1], crackle:[.5,.8], lowcut:[0,25], highcut:[7500,11000], comp:[.15,.3]},
      found:{role:"bed", vol:[.14,.22], pitch:[.75,.9], stretch:[.4,.55], cutoff:[1600,2600], sources:["tokyo_station","shibuya","vx_dday"]},
      stab:["off"], hits:{sources:["vox_c","sp_slowdown"], pattern:"sparse", prob:.35},
      form:"pop" },
    downtempo: { label:"Downtempo", info:"slow warm pulse, long pads, space and patience",
      bpm:[66,84], swing:[.05,.2], humanize:[.15,.35],
      progressions:["neosoul","dream","deep_two","mode_mixo"], kits:["boombap","halftime","kick"], fills:["off","downlift","riser"],
      bass:{patterns:["simple","dub","sub"], recipe:{model:["sub"],cutoff:[300,550],res:[.05,.15],level:[.95,1.15],send:[.05,.12],dsend:[0,.05]}},
      lead:{patterns:["sparse","off","wander"], recipe:{model:["fm","stack"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[2000,3000],level:[.4,.5],send:[.45,.65],dsend:[.3,.45],vibrato:[.003,.008]}},
      pads:{prob:1, recipe:{model:["organ","saw"],wave:"saw",cutoff:[800,1400],detune:[.005,.011],attack:[2,4],level:[.6,.78],send:[.5,.7],dsend:[.15,.3]}},
      drums:{kickModel:["808","boom"],snareModel:["noise"],hatModel:["noise"],kick:[.95,1.2],snare:[.5,.75],hat:[.45,.75],tune:[.85,1],send:[.2,.35],dsend:[.05,.2]},
      fx:{reverb:[.72,.88], delayBeats:[.75,1.5], delayFb:[.3,.5], delayCut:[1800,2800], pump:[0,.15], crackle:[.1,.3], lowcut:[0,25], highcut:[0,0], comp:[.15,.3]},
      found:{role:"bed", vol:[.14,.24], pitch:[.7,.9], stretch:[.45,.6], cutoff:[1800,2800], sources:["iriomote","highway_night","vx_apollo"]},
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
      found:{role:"bed", vol:[.2,.32], pitch:[.6,.8], stretch:[.45,.6], cutoff:[2000,3400], sources:["iriomote","frogs","tokyo_station","vx_wwvh","vx_apollo"]},
      stab:["off"], hits:{sources:["vox_a","sp_herenow"], pattern:"sparse", prob:.15},
      form:"wave" },
    dinosynth: { label:"Dino synth", info:"dinosaur-themed dungeon synth: dark-ambient drones, medieval choir, tribal log-drums, primordial swamp",
      bpm:[72,96], swing:[0,.05], humanize:[.15,.35],
      progressions:["primeval","epic_min","andalusian","minor_run","mode_phrygian"],   // cinematic, moving — no static drone
      kits:["tribal"], fills:["off","off","downlift"],   // full tribal kit carries it; fills mostly off (no fill-reliance)
      bass:{patterns:["root","sub","off"], recipe:{model:["sub","reese"],cutoff:[240,460],res:[.05,.18],level:[.85,1.1],send:[.15,.35],dsend:[0,.1]}},
      lead:{patterns:["wander","updown","pentaup"], recipe:{model:["brass","stack"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1500,2600],level:[.36,.5],send:[.55,.78],dsend:[.3,.5],vibrato:[.004,.01]}},   // warm theme (no inharmonic bell-FM)
      pads:{prob:1, recipe:{model:["choir","strings","saw"],wave:"saw",cutoff:[700,1300],detune:[.006,.014],attack:[2.5,4.5],level:[.62,.82],send:[.6,.82],dsend:[.15,.3]}},
      drums:{kickModel:["boom","808"],snareModel:["noise"],hatModel:["noise"],kick:[1.3,1.6],snare:[.5,.72],hat:[.55,.85],tune:[.78,.95],send:[.25,.45],dsend:[.3,.55]},   // kick hard, snare DOWN, hats up (whole kit), echo on the throws
      fx:{reverb:[.82,.94], delayBeats:[.75,1.5], delayFb:[.5,.68], delayCut:[1500,2500], pump:[0,.05], crackle:[.04,.12], lowcut:[0,25], highcut:[8000,13000], comp:[.4,.62], grit:[.25,.5]},   // crackle way down; compressed + long dub echo
      found:{role:"bed", vol:[.18,.3], pitch:[.6,.78], stretch:[.45,.6], cutoff:[1800,3000], sources:["frogs","iriomote","tokyo_station","factory"]},   // 4 beds rotate — pitched-down city recordings read as tar-pit / geothermal swamp
      vox:{sources:["sp_paleo_welcome","sp_paleo_mesozoic","sp_paleo_sauropod","sp_paleo_rex","sp_paleo_bones","sp_paleo_skies"], vol:0.5, pitch:0.96, cutoff:6500},   // glitched paleontologist narration
      stab:["off"], hits:{sources:["sp_herenow","vox_a"], pattern:"sparse", prob:.15},
      form:"ritual" },   // creature solos + fuzz solo + glitched VO (see buildSections)
    canawave: { label:"Canawave", info:"proud Canadiana pop: bright major anthem, arpeggiated guitar, toms + hi-hats, loon calls and the national news",
      bpm:[108,114], swing:[0,.06], humanize:[.08,.2],
      progressions:["four_chords","doo_wop","sad_pop"],   // anthemic TRIADIC pop — pop_1625's seventh color read as disco (validate-genres gate 2)
      kits:["four","full"], fills:["tom fill","tom fill","riser"],   // toms into every lift, steady bright hats — NOT "open" (open-hat offbeats read as disco; validate-genres gate 2 caught canawave losing its own diagonal on open-kit seeds)
      bass:{patterns:["walking"], recipe:{model:["saw"],cutoff:[600,900],res:[.1,.18],level:[.6,.75],send:[.03,.07],dsend:[0,.04]}},   // walking (diatonic, in key); FAR lower in the mix
      lead:{patterns:["arp16"], recipe:{model:["kpluck"],wave:"saw",drive:.45,cutoff:[3000,3800],level:[.62,.74],send:[.16,.26],dsend:[.46,.56]}},   // THE lead = octave-lower octave-doubled 16th arp, distortion + chorus + 1/4T echo (Edge), BIGGER
      pads:{prob:1, recipe:{model:["organ"],wave:"saw",cutoff:[1500,2200],detune:[.004,.008],attack:[.3,.7],level:[.4,.52],send:[.16,.26],dsend:[0,.06]}},   // organ, supportive (behind)
      drums:{kickModel:["boom","909"],snareModel:["noise","clap"],hatModel:["noise"],kick:[1.1,1.3],snare:[.95,1.15],hat:[1.3,1.6],tom:[.85,1.05],tune:[.95,1.1],send:[.12,.2],dsend:[.03,.07]},   // snare up, hats UP (clearly audible), toms natural + not loud
      fx:{reverb:[.28,.4], delayBeats:[.6667,.6667], delayFb:[.3,.4], delayCut:[3200,4600], pump:[0,.12], crackle:[0,0], lowcut:[30,45], highcut:[0,0], comp:[.25,.4], grit:[0,0]},   // simplified: 1/4T delay kept (for the guitar), less reverb/feedback/comp, no grit/crackle
      found:{role:"narration", vol:[.28,.38], pitch:[.95,.98], stretch:[.45,.6], cutoff:[2600,3800], sources:["leacock1","leacock2","leacock3","leacock4"]},   // Leacock — different chapters rotate
      vox:{sources:["sp_ca_hockey","sp_ca_hnic","sp_ca_cup","sp_ca_topshelf","sp_ca_fivehole","sp_ca_gretzky","sp_ca_save","sp_ca_overtime","sp_ca_news","sp_ca_justwatchme"], vol:0.5, pitch:1, cutoff:8000, clean:true},   // hockey play-by-play + lore
      voxPoem:"sp_ca_cities",   // the rhyming-cities poem, chopped into verse 2
      hits:{sources:["ca_loon"], pattern:"sparse", prob:1, wet:true, glitch:true, vol:0.035},   // the loon — a quiet whisper, verse 1 only
      hornSource:"ca_horn",   // the goal horn — FULL volume opener only
      stab:["off"],
      form:"anthem" },   // pop structure; grand brass swell at the bridge (see buildSections)
    transitwave: { label:"Transitwave", info:"motorik regional-rail vaporwave: a Kraftwerk sequencer arp + 2/3-speed gritty counter-arp, station-PA announcements (harmonized, echo + glitch), a distorted heavy-metal solo, door chimes, and a chugging choo-choo swing",
      bpm:[110,118], swing:[.1,.16], humanize:[.02,.08],   // chugging choo-choo shuffle (the drums chug; the arp stays mostly tight)
      progressions:["synthwave","minor_run","deep_two"],   // hypnotic minor/modal — Trans-Europe Express (motion + the occasional 2-chord vamp)
      kits:["pulse","four"], fills:["tom fill","drum fill","riser","hat rush","impact","break fill","downlift"],   // straight driving kit = clickety-clack; a real spread of fills (see transit form)
      bass:{patterns:["octaves","drive","rolling"], recipe:{model:["saw"],cutoff:[700,1100],res:[.12,.22],level:[1,1.2],send:[.04,.1],dsend:[0,.06]}},   // motorik sequenced bass, up front
      lead:{patterns:["motorik"], recipe:{model:["stack"],wave:"square",voices:[1,2],spread:[.004,.009],cutoff:[2000,2800],res:[.46,.6],octave:0,drive:[.4,.6],attack:.003,release:[.05,.08],sustain:[.55,.68],fenv:[1.2,1.9],level:[.52,.64],send:[.22,.32],dsend:[.36,.5],swellHz:.13,swellDepth:.45,swellPhase:0}},   // Kraftwerk sequencer: RAW square (1-2 osc, pure), MORE BITE (more drive + brighter + sharper filter sweep), staccato 8th notes; breathes up/down via swell; smoothed by delay+reverb
      pads:{prob:.9, recipe:{model:["strings","saw"],wave:"saw",cutoff:[1100,1800],detune:[.006,.012],attack:[.8,1.6],level:[.32,.44],send:[.16,.3],dsend:[.08,.2]}},   // cold platform strings, kept behind the groove (not a wash)
      drums:{kickModel:["909","boom"],snareModel:["noise","clap"],hatModel:["noise","metal"],kick:[1.15,1.35],snare:[.78,1],hat:[1.05,1.45],tune:[.95,1.05],send:[.14,.24],dsend:[.05,.14]},   // hats UP = wheels over rail joints; the groove drives, kit forward
      fx:{reverb:[.24,.36], delayBeats:[.5,.5], delayFb:[.32,.46], delayCut:[2400,3600], pump:[.06,.18], crackle:[0,.08], lowcut:[30,45], highcut:[0,0], comp:[.42,.6], grit:[.12,.26]},   // dry + compressed (NOT ambient): 1/8 echo (announcements ring) + digital grit + light pump = mechanical motorik
      found:{role:"bed", vol:[.13,.22], pitch:[.78,.92], stretch:[.45,.6], cutoff:[2200,3400], sources:["tw_intrain","tw_trains","tw_stationhall","tw_platform"]},   // 4 train/station field recordings rotate — the clatter, as texture under the groove
      vox:{sources:["sp_tw_next","sp_tw_arriving","sp_tw_standclear","sp_tw_express","sp_tw_delay","sp_tw_gap","sp_tw_aboard","sp_tw_local","sp_tw_terminus","sp_tw_tickets"], vol:0.54, pitch:1, cutoff:3800, clean:false},   // station-PA announcements, glitched + echoed
      voxPoem:"sp_tw_schedule",   // the departures litany, chopped into the interchange
      hits:{sources:["tw_pass"], pattern:"sparse", prob:1, wet:true, vol:0.055, cut:1100},   // a train passing — quiet + heavily low-passed so it sits UNDER the mix
      hornSource:"tw_arrival", hornVol:0.13, hornCut:850,   // the opener train: filtered way down (was dominating everything)
      dingSource:"tw_ding", dingVol:0.28,   // the door "ding ding": always low-passed + fed HARD to the ping-pong so it echoes for ~2 measures (see csd-engine)
      snarePP:0.6,   // feed random snare hits to the long rhythmic ping-pong delay
      vocal:true, vocalVol:0.55,   // the 8-bar sung chorus (WORLD-vocoder vocal, generated to match bpm+key at render time)
      stations:["sp_st_admiralty","sp_st_akiba","sp_st_alex","sp_st_arbat","sp_st_astoria","sp_st_atlantic","sp_st_atocha","sp_st_baker","sp_st_bank","sp_st_bastille","sp_st_bedford","sp_st_belleville","sp_st_belmont","sp_st_bloor","sp_st_brixton","sp_st_bugis","sp_st_camden","sp_st_catalunya","sp_st_causeway","sp_st_centraal","sp_st_central","sp_st_chandni","sp_st_chatelet","sp_st_circular","sp_st_colosseo","sp_st_coney","sp_st_dam","sp_st_dupont","sp_st_embarcadero","sp_st_fulton","sp_st_gangnam","sp_st_ginza","sp_st_grand","sp_st_granvia","sp_st_harvard","sp_st_hbf","sp_st_hongdae","sp_st_ikebukuro","sp_st_itaewon","sp_st_jamsil","sp_st_kadikoy","sp_st_kiev","sp_st_kings","sp_st_komso","sp_st_kotti","sp_st_lazare","sp_st_liverpool","sp_st_marien","sp_st_metrocenter","sp_st_mongkok","sp_st_montpar","sp_st_mustek","sp_st_nakano","sp_st_nation","sp_st_nord","sp_st_opera","sp_st_orchard","sp_st_oxford","sp_st_paddington","sp_st_parkst","sp_st_paulista","sp_st_penn","sp_st_pigalle","sp_st_pino","sp_st_potsdamer","sp_st_powell","sp_st_raffles","sp_st_rajiv","sp_st_retiro","sp_st_roppongi","sp_st_rossio","sp_st_sadat","sp_st_sagrada","sp_st_se","sp_st_shibuya","sp_st_shinagawa","sp_st_shinjuku","sp_st_slussen","sp_st_sol","sp_st_spadina","sp_st_stephans","sp_st_taksim","sp_st_tcentralen","sp_st_termini","sp_st_times","sp_st_townhall","sp_st_ueno","sp_st_union","sp_st_victoria","sp_st_warschauer","sp_st_waterloo","sp_st_wynyard","sp_st_zocalo","sp_st_zoo"], stationVol:0.28,   // a (feminine) world-metro station name under every measure — present, not buried
      stab:["off"],
      form:"transit" },   // a commuter journey: platform -> board -> transit -> interchange -> SOLO -> express -> terminus (see buildSections)
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
    dancepop: { label:"Dance pop", info:"New Order-ish: melodic synth bass up high, bright leads, big pop changes",   // SYNTH-FORWARD
      bpm:[116,128], swing:[0,.1], humanize:[.05,.2],
      progressions:["four_chords","sad_pop","doo_wop"], kits:["four","pulse","open"], fills:["drum fill","tom fill","riser"],
      bass:{patterns:["octaves","melodic","drive"], recipe:{model:["saw"],cutoff:[900,1500],res:[.1,.25],level:[1.05,1.25],send:[.05,.15],dsend:[0,.1]}},
      lead:{patterns:["hero","updown","arpup"], recipe:{model:["brass","stack"],wave:"saw",voices:[3,5],spread:[.006,.012],cutoff:[2800,3800],level:[.45,.6],send:[.3,.5],dsend:[.2,.35]}},
      pads:{prob:.85, recipe:{model:["strings","saw"],wave:"saw",cutoff:[1200,2000],detune:[.006,.012],attack:[.8,1.8],level:[.5,.7],send:[.35,.55],dsend:[.1,.25]}},
      drums:{kickModel:["909","boom"],snareModel:["noise","clap"],hatModel:["noise"],kick:[1.1,1.35],snare:[.8,1.05],hat:[.6,.9],tune:[.9,1.05],send:[.25,.45],dsend:[.05,.15]},
      fx:{reverb:[.5,.7], delayBeats:[.5,.75], delayFb:[.2,.35], delayCut:[2400,3600], pump:[.05,.25], crackle:[0,.1], lowcut:[30,45], highcut:[0,0], comp:[.3,.5]},
      found:{role:"bed", vol:[.06,.12], pitch:[.8,1], stretch:[.45,.6], cutoff:[1500,2500], sources:["shibuya","highway_night"]},
      stab:["off","sparse"], hits:{sources:["rave_b","vox_a"], pattern:"sparse", prob:.3},
      form:"pop" },
    edm: { label:"EDM", info:"festival big-room: riser into THE DROP, max pump, supersaw walls",   // SYNTH-FORWARD
      bpm:[124,132], swing:[0,.05], humanize:[0,.1],
      progressions:["epic_min","minor_run","sad_pop","drone_min"], kits:["four","pulse"], fills:["riser","riser","impact","cut"],
      bass:{patterns:["rolling","drive","stab"], recipe:{model:["saw","reese"],cutoff:[500,900],res:[.2,.35],level:[1.15,1.35],send:[0,.08],dsend:[0,0]}},
      lead:{patterns:["hero","updown","double"], recipe:{model:["stack","stack","brass","vocoder"],wave:"saw",voices:[6,8],spread:[.012,.02],cutoff:[3000,4200],level:[.5,.65],send:[.35,.55],dsend:[.2,.35]}},   // rare vocoder drop-voice
      vocSource:"sp_energy",
      pads:{prob:.9, recipe:{model:["saw"],wave:"saw",cutoff:[1400,2600],detune:[.012,.02],attack:[.6,1.6],level:[.6,.8],send:[.4,.6],dsend:[.1,.25]}},
      drums:{kickModel:["909"],snareModel:["clap","noise"],hatModel:["noise","metal"],kick:[1.35,1.6],snare:[.8,1.05],hat:[.5,.8],tune:[.95,1.1],send:[.2,.4],dsend:[.05,.2]},
      fx:{reverb:[.45,.65], delayBeats:[.375,.5], delayFb:[.25,.4], delayCut:[2500,4000], pump:[.55,.8], crackle:[0,0], lowcut:[30,45], highcut:[0,0], comp:[.6,.8], grit:[.2,.4]},
      found:{role:"chops", vol:[.08,.15], pitch:[.95,1.1], stretch:[.4,.6], cutoff:[2500,4000], sources:["shibuya","factory","vx_xminusone"]},
      stab:["rave","offbeat"], hits:{sources:["rave_a","rave_c","sp_energy"], pattern:"offbeat", prob:.6},
      form:"drop" },
    dubstep: { label:"Dubstep", info:"140 halftime: wobble bass, snare on three, cavernous space",
      bpm:[136,146], swing:[0,.08], humanize:[.05,.2],
      progressions:["drone_min","deep_two","minor_run"], kits:["halftime","breaks"], fills:["break fill","riser","impact","off"],
      bass:{patterns:["sub","dub","stab"], recipe:{model:["wobble","reese","sub"],wobbleHz:[1.5,4.5],cutoff:[300,650],res:[.2,.4],level:[1.2,1.45],send:[0,.08],dsend:[0,.1]}},
      lead:{patterns:["off","sparse","pentaup"], recipe:{model:["pluck","fm","vocoder"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1800,3000],level:[.3,.45],send:[.35,.55],dsend:[.3,.5]}},   // rare vocoder: pitched vox stabs
      vocSource:"sp_pressure",
      pads:{prob:.35, recipe:{model:["saw","organ"],wave:"saw",cutoff:[550,950],detune:[.006,.014],attack:[1.5,3],level:[.32,.45],send:[.5,.7],dsend:[.15,.3]}},   // dark, mostly ABSENT — cavern not wash
      drums:{kickModel:["808","909"],snareModel:["crack","clap"],hatModel:["noise","metal"],kick:[1.2,1.45],snare:[.85,1.1],hat:[.4,.7],tune:[.9,1.05],send:[.15,.35],dsend:[.25,.5]},
      fx:{reverb:[.5,.7], delayBeats:[.75,1.5], delayFb:[.35,.55], delayCut:[1800,3000], pump:[.1,.3], crackle:[0,.15], lowcut:[25,40], highcut:[0,0], comp:[.4,.6], grit:[.3,.55]},
      found:{role:"chops", vol:[.1,.18], pitch:[.85,1.1], stretch:[.4,.6], cutoff:[2000,3500], sources:["factory","frogs"]},
      stab:["off","sparse"], hits:{sources:["vox_c","sp_pressure","rave_d"], pattern:"dub", prob:.55},
      form:"drop" },
    blues: { label:"Blues", info:"12-bar dom7 changes, swung shuffle, worn-record air",
      bpm:[78,100], swing:[.24,.42], humanize:[.3,.55],
      progressions:["blues_12"], kits:["boombap","breaks"], fills:["off","drum fill"],
      bass:{patterns:["walking","melodic","root"], recipe:{model:["piano","sub"],cutoff:[500,1000],res:[.05,.15],level:[.9,1.1],send:[.1,.2],dsend:[0,.05]}},
      lead:{patterns:["blues","wander","sparse"], recipe:{model:["piano","pluck"],wave:"sine",voices:[1,2],spread:[.001,.004],cutoff:[2200,3400],level:[.5,.65],send:[.3,.5],dsend:[.1,.25]}},
      pads:{prob:.7, recipe:{model:["organ","piano"],wave:"saw",cutoff:[900,1500],detune:[.003,.007],attack:[.4,1.2],level:[.4,.6],send:[.3,.5],dsend:[.05,.15]}},
      drums:{kickModel:["boom","808"],snareModel:["noise"],hatModel:["noise"],kick:[.9,1.15],snare:[.6,.85],hat:[.5,.8],tune:[.85,1],send:[.15,.3],dsend:[0,.1]},
      fx:{reverb:[.45,.65], delayBeats:[.5,.75], delayFb:[.1,.25], delayCut:[2000,3000], pump:[0,0], crackle:[.25,.55], lowcut:[0,30], highcut:[8000,12000], comp:[.15,.3]},
      found:{role:"bed", vol:[.05,.12], pitch:[.8,1], stretch:[.45,.6], cutoff:[1500,2500], sources:["shibuya","tokyo_station","vx_whitman"]},
      stab:["off"], hits:{sources:["blues_vox_78","horns_78","sp_slowdown"], pattern:"sparse", prob:.4},
      form:"pop" },
    jazz: { label:"Jazz", info:"ii-V-I machinery, walking bass, brushed kit, piano comping",
      bpm:[96,144], swing:[.28,.48], humanize:[.35,.6],
      progressions:["ii_v_i","neosoul","lofi","mode_dorian"], kits:["breaks","boombap"], fills:["off","drum fill"],
      bass:{patterns:["walking","melodic","dub"], recipe:{model:["sub","piano"],cutoff:[400,800],res:[.05,.12],level:[.95,1.15],send:[.1,.2],dsend:[0,.05]}},
      lead:{patterns:["wander","sparse","canon"], recipe:{model:["piano","fm"],wave:"sine",voices:[1,2],spread:[.001,.004],cutoff:[2400,3600],level:[.45,.6],send:[.35,.55],dsend:[.1,.3]}},
      pads:{prob:.8, recipe:{model:["piano","fm"],wave:"sine",cutoff:[1000,1700],detune:[.002,.006],attack:[.2,.8],level:[.4,.6],send:[.35,.55],dsend:[.05,.2]}},
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.6,.9],snare:[.45,.7],hat:[.8,1.15],tune:[.9,1.05],send:[.2,.4],dsend:[0,.1]},
      fx:{reverb:[.5,.7], delayBeats:[.5,.75], delayFb:[.1,.25], delayCut:[2200,3400], pump:[0,0], crackle:[.15,.4], lowcut:[0,25], highcut:[9000,14000], comp:[.1,.25]},
      found:{role:"bed", vol:[.05,.12], pitch:[.8,1], stretch:[.45,.6], cutoff:[1500,2600], sources:["tokyo_station","shibuya","vx_ginsberg"]},
      stab:["off"], hits:{sources:["horns_78","vox_b"], pattern:"sparse", prob:.35},
      form:"pop" },
    dub: { label:"Dub", info:"one-drop riddim: the delay IS the genre — sub pressure, wet skanks, enormous echo tails",   // SAMPLE-FORWARD: wet vox hits + Burroughs in the smoke
      bpm:[68,82], swing:[.02,.1], humanize:[.1,.3],
      progressions:["deep_two","deep_two","drone_min"], kits:["halftime","boombap"], fills:["off","downlift","reverse"],
      bass:{patterns:["dub","sub"], recipe:{model:["sub"],cutoff:[260,460],res:[.05,.15],level:[1.2,1.4],send:[0,.06],dsend:[0,.05]}},
      lead:{patterns:["sparse","off","pentaup"], recipe:{model:["pluck","fm"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1600,2600],level:[.32,.44],send:[.4,.6],dsend:[.5,.7],attack:.004,release:[.06,.1],sustain:[.5,.62]}},
      pads:{prob:.35, recipe:{model:["organ","saw"],wave:"saw",cutoff:[550,900],detune:[.004,.01],attack:[.15,.5],level:[.32,.44],send:[.3,.5],dsend:[.3,.5]}},   // dark organ skank thrown to the echo — NOT a wash
      drums:{kickModel:["808","boom"],snareModel:["crack","noise"],hatModel:["noise"],kick:[1.1,1.35],snare:[.9,1.15],hat:[.45,.75],tune:[.9,1.05],send:[.15,.3],dsend:[.5,.7]},   // the snare rides the delay — dsend IS the one-drop
      fx:{reverb:[.55,.7], delayBeats:[.75,1.5], delayFb:[.5,.7], delayCut:[1600,2600], pump:[0,.1], crackle:[0,.08], lowcut:[25,40], highcut:[0,0], comp:[.3,.5], grit:[.1,.25]},
      found:{role:"bed", vol:[.18,.3], pitch:[.7,.85], stretch:[.45,.6], cutoff:[1800,3000], sources:["frogs","highway_night","vx_burroughs"]},
      stab:["off","sparse"], hits:{sources:["vox_a","vox_b","sp_rewind","sp_pressure"], pattern:"dub", prob:.75, wet:true},
      form:"dj" },
    trance: { label:"Trance", info:"uplifting 138: rolling 16th bass, supersaw hero over a huge wash, hands-up drops",   // SYNTH-FORWARD: beds distant
      bpm:[132,142], swing:[0,.04], humanize:[0,.1],
      progressions:["uplift","epic_min","sad_pop","synthwave"], kits:["four","pulse"], fills:["riser","riser","impact","cut"],
      bass:{patterns:["rolling","sixteenths","drive"], recipe:{model:["saw"],cutoff:[520,850],res:[.15,.3],level:[1.1,1.3],send:[0,.08],dsend:[0,.05]}},
      lead:{patterns:["hero","arpup","updown"], recipe:{model:["stack"],wave:"saw",voices:[6,7],spread:[.012,.02],cutoff:[3000,4200],level:[.5,.62],send:[.4,.6],dsend:[.3,.45],vibrato:[0,.004],attack:.01,release:[.2,.3],sustain:[.8,.9],fenv:[.25,.45]}},
      pads:{prob:1, recipe:{model:["saw"],wave:"saw",cutoff:[1300,2400],detune:[.01,.018],attack:[1,2],level:[.55,.75],send:[.5,.7],dsend:[.15,.3]}},
      drums:{kickModel:["909"],snareModel:["clap","noise"],hatModel:["noise"],kick:[1.3,1.55],snare:[.7,.95],hat:[.7,1],tune:[.95,1.1],send:[.15,.3],dsend:[.1,.25]},
      fx:{reverb:[.6,.75], delayBeats:[.75,.75], delayFb:[.4,.55], delayCut:[2400,3600], pump:[.4,.6], crackle:[0,0], lowcut:[30,45], highcut:[0,0], comp:[.5,.7], grit:[0,.15]},
      found:{role:"bed", vol:[.06,.12], pitch:[.7,.9], stretch:[.45,.6], cutoff:[1500,2500], sources:["highway_night","tokyo_station","vx_apollo"]},
      stab:["off","sparse"], hits:{sources:["rave_c","sp_energy","vox_a"], pattern:"offbeat", prob:.4},
      form:"drop" },
    disco: { label:"Disco", info:"four-on-floor + octave bass + organ glitter, min7 funk vamps, 78rpm horns",   // sample-mid: the horns are dressing
      bpm:[110,122], swing:[.05,.12], humanize:[.1,.25],
      progressions:["funk_vamp","house_min7","pop_1625"], kits:["four","open"], fills:["hat rush","drum fill","riser"],
      bass:{patterns:["octaves","walking"], recipe:{model:["saw"],cutoff:[650,1050],res:[.1,.2],level:[1,1.2],send:[.03,.08],dsend:[0,.05]}},
      lead:{patterns:["updown","pentaup","double"], recipe:{model:["fm","pluck"],wave:"pulse",voices:[1,2],spread:[.002,.005],cutoff:[2600,3600],level:[.42,.54],send:[.3,.45],dsend:[.15,.3],attack:.005,release:[.08,.14],sustain:[.6,.72],fenv:[.3,.5]}},
      pads:{prob:1, recipe:{model:["organ"],wave:"saw",cutoff:[1100,1700],detune:[.004,.009],attack:[.2,.6],level:[.45,.6],send:[.3,.45],dsend:[.05,.15]}},   // organ stabs = the glitter
      drums:{kickModel:["909","boom"],snareModel:["clap","noise"],hatModel:["noise"],kick:[1.1,1.3],snare:[.75,1],hat:[1.1,1.4],tune:[.95,1.1],send:[.15,.3],dsend:[.05,.15]},   // OPEN HATS UP — the offbeat sizzle
      fx:{reverb:[.4,.55], delayBeats:[.375,.5], delayFb:[.15,.3], delayCut:[2600,3800], pump:[0,.15], crackle:[.05,.2], lowcut:[30,45], highcut:[0,0], comp:[.3,.5], grit:[0,0]},
      found:{role:"bed", vol:[.06,.12], pitch:[.85,1], stretch:[.45,.6], cutoff:[1800,2800], sources:["shibuya","tokyo_station","vx_timelady"]},
      stab:["off","sparse"], hits:{sources:["horns_78","sp_rhythm","vox_a"], pattern:"offbeat", prob:.5},
      form:"pop" },
    italo: { label:"Italo disco", info:"sparkling pluck arps over octave bass — brighter and happier than synthwave",   // SYNTH-FORWARD
      bpm:[108,120], swing:[0,.08], humanize:[.02,.12],
      progressions:["sad_pop","synthwave","doo_wop"], kits:["pulse","four"], fills:["tom fill","riser","drum fill"],
      bass:{patterns:["octaves","sixteenths"], recipe:{model:["saw"],cutoff:[750,1150],res:[.12,.22],level:[1.05,1.25],send:[.03,.08],dsend:[0,.05]}},
      lead:{patterns:["arpup","arpdown","updown"], recipe:{model:["pluck","stack"],wave:"square",voices:[1,2],spread:[.002,.006],cutoff:[3200,4200],level:[.5,.6],send:[.3,.45],dsend:[.3,.45],vibrato:[0,.003],attack:.004,release:[.07,.12],sustain:[.6,.7],fenv:[.3,.5]}},
      pads:{prob:.9, recipe:{model:["saw","strings"],wave:"saw",cutoff:[1400,2200],detune:[.006,.012],attack:[.6,1.4],level:[.45,.6],send:[.3,.45],dsend:[.1,.2]}},
      drums:{kickModel:["909"],snareModel:["clap","noise"],hatModel:["noise"],kick:[1.15,1.35],snare:[.8,1.05],hat:[.9,1.2],tune:[.95,1.1],send:[.2,.35],dsend:[.05,.15]},
      fx:{reverb:[.45,.6], delayBeats:[.375,.75], delayFb:[.25,.4], delayCut:[2800,4000], pump:[.1,.3], crackle:[0,.08], lowcut:[30,45], highcut:[0,0], comp:[.3,.5], grit:[0,0]},
      found:{role:"bed", vol:[.06,.12], pitch:[.8,.95], stretch:[.45,.6], cutoff:[1500,2500], sources:["shibuya","highway_night","vx_xminusone"]},
      stab:["off","offbeat"], hits:{sources:["rave_b","vox_a","sp_nightdrive"], pattern:"sparse", prob:.4},
      form:"pop" },
    bigbeat: { label:"Big beat", info:"amen-driven block-rocking beats: acid bass, rave stabs galore, maximum cheek",   // SAMPLE-FORWARD: the break + the sample-CD arsenal
      bpm:[118,136], swing:[0,.1], humanize:[.05,.2],
      progressions:["minor_run","house_min","deep_two"], kits:["breaks","house"], fills:["break fill","riser","impact","cut"],
      bass:{patterns:["stab","rolling","drive"], recipe:{model:["acid"],cutoff:[420,700],res:[.3,.45],level:[1.1,1.3],send:[0,.08],dsend:[0,.1]}},
      lead:{patterns:["double","pentaup","arpup"], recipe:{model:["stack","pluck"],wave:"saw",voices:[2,4],spread:[.006,.012],cutoff:[2600,3800],level:[.42,.55],send:[.25,.4],dsend:[.2,.35],attack:.004,release:[.06,.1],sustain:[.55,.68],fenv:[.5,.9]}},
      pads:{prob:.3, recipe:{model:["organ","saw"],wave:"saw",cutoff:[600,950],detune:[.005,.01],attack:[.3,.8],level:[.32,.45],send:[.25,.4],dsend:[.1,.25]}},   // dark stab pad, mostly ABSENT
      drums:{kickModel:["909","boom"],snareModel:["crack","clap"],hatModel:["noise"],kick:[1.3,1.55],snare:[.85,1.1],hat:[.7,1],tune:[.95,1.1],send:[.1,.25],dsend:[.1,.3]},
      fx:{reverb:[.4,.55], delayBeats:[.5,.75], delayFb:[.3,.45], delayCut:[2200,3400], pump:[.25,.5], crackle:[.05,.2], lowcut:[30,45], highcut:[0,0], comp:[.55,.8], grit:[.3,.6]},
      found:{role:"break", vol:[.3,.42], pitch:[1,1], stretch:[.5,.5], cutoff:[5500,8000], sources:["amen_165","amen_170","amen_172","amen_175"]},   // the break LOUD and open
      stab:["rave","rave","offbeat"], hits:{sources:["bb_horn_a","bb_horn_b","bb_stab_a","bb_stab_b","bb_stab_c"], pattern:"offbeat", prob:.85},   // the dcc12/20/48 shelf finally stars
      form:"drop" },
    garage: { label:"UK garage", info:"2-step shuffle at 130: swung skippy drums, sub weight, chopped vox",   // sample-mid: vox chops as percussion
      bpm:[128,136], swing:[.2,.3], humanize:[.1,.25],
      progressions:["house_min7","deep_two","lofi"], kits:["breaks","house"], fills:["off","hat rush","cut","break fill"],
      bass:{patterns:["sub","dub","stab"], recipe:{model:["sub"],cutoff:[300,500],res:[.05,.18],level:[1.15,1.35],send:[0,.06],dsend:[0,.05]}},
      lead:{patterns:["off","sparse","pentaup"], recipe:{model:["pluck","fm"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[2200,3200],level:[.36,.48],send:[.3,.45],dsend:[.25,.4],attack:.004,release:[.05,.09],sustain:[.55,.65],fenv:[.4,.7]}},
      pads:{prob:.4, recipe:{model:["organ","fm"],wave:"saw",cutoff:[700,1100],detune:[.004,.009],attack:[.2,.6],level:[.34,.46],send:[.25,.4],dsend:[.1,.25]}},   // dark chord stabs, often absent
      drums:{kickModel:["909","808"],snareModel:["crack","clap"],hatModel:["noise","metal"],kick:[1.1,1.3],snare:[.85,1.1],hat:[.8,1.15],tune:[1,1.1],send:[.08,.18],dsend:[.1,.25]},
      fx:{reverb:[.35,.5], delayBeats:[.375,.75], delayFb:[.25,.4], delayCut:[2400,3600], pump:[.15,.35], crackle:[0,.08], lowcut:[30,45], highcut:[0,0], comp:[.4,.6], grit:[.1,.25]},
      found:{role:"chops", vol:[.1,.18], pitch:[.95,1.15], stretch:[.4,.6], cutoff:[2500,4000], sources:["shibuya","tokyo_station","vx_suspense"]},
      stab:["off","sparse"], hits:{sources:["vox_a","vox_c","sp_rhythm"], pattern:"offbeat", prob:.65},
      form:"pop" },
    doomdrone: { label:"Doom drone", info:"glacial fuzz over tectonic drones — the metallurgy plant pitched into the abyss",   // SYNTH-FORWARD (the bed is dread, not hook)
      bpm:[48,62], swing:[0,.04], humanize:[.1,.3],
      progressions:["drone_min","deep_two","mode_phrygian"], kits:["off","kick"], fills:["off"],
      bass:{patterns:["root","sub","off"], recipe:{model:["sub","reese"],cutoff:[200,380],res:[.05,.15],level:[1.1,1.35],send:[.1,.25],dsend:[0,.1]}},
      lead:{patterns:["sparse","double","off"], recipe:{model:["fuzz"],wave:"saw",voices:[1,2],spread:[.003,.008],cutoff:[1200,2000],res:[.2,.35],level:[.45,.55],send:[.5,.7],dsend:[.3,.5],attack:[.1,.3],release:[.5,.9],sustain:[.9,1]}},   // LOW sustained fuzz — a riff exhaling
      pads:{prob:1, recipe:{model:["saw","choir"],wave:"saw",cutoff:[500,900],detune:[.01,.018],attack:[3,5],level:[.7,.9],send:[.7,.85],dsend:[.15,.3]}},
      drums:{kickModel:["boom","808"],snareModel:["noise"],hatModel:["noise"],kick:[1.3,1.6],snare:[.4,.6],hat:[.3,.5],tune:[.78,.9],send:[.3,.5],dsend:[.1,.3]},
      fx:{reverb:[.85,.95], delayBeats:[1,1.5], delayFb:[.45,.6], delayCut:[1200,2200], pump:[0,0], crackle:[0,.1], lowcut:[0,20], highcut:[0,0], comp:[.5,.75], grit:[.5,.8]},
      found:{role:"bed", vol:[.2,.32], pitch:[.5,.65], stretch:[.45,.6], cutoff:[1200,2200], sources:["factory","highway_night","vx_blake","vx_conet_swedish"]},   // the factory WAY down + tyger tyger + the haunted music box
      stab:["off"], hits:{sources:["sp_pressure","vox_c"], pattern:"sparse", prob:.2},
      form:"wave" },
    newage: { label:"New age", info:"luminous major-key drift: choir + strings, gentle sine melody, frogs at dusk",   // sample-mid: nature beds ARE the texture
      bpm:[58,76], swing:[0,.06], humanize:[.2,.4],
      progressions:["dream","mode_lydian","canon"], kits:["off"], fills:["off"],
      bass:{patterns:["root","simple","off"], recipe:{model:["sub"],cutoff:[250,450],res:[.05,.12],level:[.8,1],send:[.15,.3],dsend:[0,.1]}},
      lead:{patterns:["sparse","wander","arpup"], recipe:{model:["stack","fm"],wave:"sine",voices:[1,2],spread:[.002,.004],cutoff:[2200,3400],level:[.4,.5],send:[.5,.7],dsend:[.25,.4],vibrato:[.006,.012],attack:[.15,.4],release:[.5,.8],sustain:[.85,.95]}},   // the melody is PRESENT — distinct from ambient
      pads:{prob:1, recipe:{model:["choir","strings"],wave:"saw",cutoff:[900,1600],detune:[.005,.012],attack:[2.5,4.5],level:[.6,.8],send:[.6,.8],dsend:[.1,.25]}},
      drums:{kickModel:["808"],snareModel:["noise"],hatModel:["noise"],kick:[.5,.8],snare:[.35,.55],hat:[.3,.5],tune:[.9,1.05],send:[.25,.45],dsend:[0,.1]},
      fx:{reverb:[.8,.92], delayBeats:[1,1.5], delayFb:[.35,.5], delayCut:[1800,2800], pump:[0,0], crackle:[0,.05], lowcut:[0,0], highcut:[0,0], comp:[0,.15], grit:[0,0]},
      found:{role:"bed", vol:[.16,.26], pitch:[.75,.9], stretch:[.45,.6], cutoff:[2400,3800], sources:["frogs","iriomote","vx_whitman"]},
      stab:["off"], hits:{sources:["sp_herenow"], pattern:"sparse", prob:.15},
      form:"wave" },
    exotica: { label:"Exotica", info:"tiki-lounge jazz: swung brushes, piano + organ, the birds ARE the percussion color",   // SAMPLE-FORWARD: the aviary up front
      bpm:[85,105], swing:[.12,.22], humanize:[.25,.45],
      progressions:["ii_v_i","lofi","neosoul"], kits:["halftime","boombap"], fills:["off","drum fill"],
      bass:{patterns:["walking","simple","root"], recipe:{model:["piano","sub"],cutoff:[500,900],res:[.05,.12],level:[.9,1.1],send:[.1,.2],dsend:[0,.05]}},
      lead:{patterns:["wander","pentaup","sparse"], recipe:{model:["piano","fm"],wave:"sine",voices:[1,2],spread:[.001,.004],cutoff:[2400,3600],level:[.45,.58],send:[.35,.55],dsend:[.1,.25],vibrato:[.008,.014]}},
      pads:{prob:.85, recipe:{model:["organ","piano"],wave:"sine",cutoff:[1000,1600],detune:[.002,.006],attack:[.3,.9],level:[.42,.56],send:[.35,.5],dsend:[.05,.15]}},
      drums:{kickModel:["boom","808"],snareModel:["noise"],hatModel:["noise"],kick:[.9,1.15],snare:[.5,.75],hat:[.6,.9],tune:[.9,1.05],send:[.2,.35],dsend:[.05,.2]},
      fx:{reverb:[.55,.7], delayBeats:[.5,.75], delayFb:[.2,.35], delayCut:[2200,3200], pump:[0,0], crackle:[0,.15], lowcut:[0,25], highcut:[0,0], comp:[.1,.3], grit:[0,0]},
      found:{role:"bed", vol:[.2,.32], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[3500,5200], sources:["frogs","iriomote","vx_timelady"]},   // birds near natural pitch, bright and present
      stab:["off"], hits:{sources:["horns_78","vox_b"], pattern:"sparse", prob:.35},
      form:"pop" },
    industrial: { label:"Industrial", info:"detuned machine music: metal hats, phrygian drones, the metallurgy plant finally stars",   // SAMPLE-FORWARD: the factory IS the hook (chops role)
      bpm:[100,126], swing:[0,.05], humanize:[0,.15],
      progressions:["mode_phrygian","drone_min","deep_two"], kits:["techno","pulse"], fills:["cut","impact","noise","hat rush"],
      bass:{patterns:["stab","rolling","drive"], recipe:{model:["reese","acid"],cutoff:[300,520],res:[.25,.4],level:[1.1,1.3],send:[0,.08],dsend:[0,.1]}},
      lead:{patterns:["double","sparse","off"], recipe:{model:["fuzz","stack","vocoder"],wave:"saw",voices:[1,2],spread:[.003,.008],cutoff:[1600,2600],res:[.3,.45],level:[.38,.5],send:[.2,.35],dsend:[.3,.5],attack:.004,release:[.06,.1],sustain:[.5,.62],fenv:[.6,1]}},   // rare vocoder: the numbers station sings
      vocSource:"vx_conet_poacher",
      pads:{prob:.3, recipe:{model:["organ","saw"],wave:"saw",cutoff:[550,900],detune:[.006,.012],attack:[.8,2],level:[.3,.42],send:[.25,.4],dsend:[.15,.3]}},   // dark, mostly ABSENT
      drums:{kickModel:["909","808"],snareModel:["crack","clap"],hatModel:["metal"],kick:[1.3,1.55],snare:[.7,.95],hat:[.8,1.15],tune:[.8,.9],send:[.1,.2],dsend:[.15,.35]},   // tuned DOWN — the kit as machinery
      fx:{reverb:[.45,.65], delayBeats:[.5,.75], delayFb:[.35,.5], delayCut:[1800,2800], pump:[.1,.3], crackle:[0,.08], lowcut:[35,50], highcut:[0,0], comp:[.5,.7], grit:[.5,.8]},
      found:{role:"chops", vol:[.16,.26], pitch:[.85,1], stretch:[.4,.6], cutoff:[2500,4000], sources:["factory","factory","vx_conet_poacher"]},   // siderurgia, sliced; the numbers station cuts through
      stab:["offbeat","sparse"], hits:{sources:["sp_system","sp_pressure","rave_d"], pattern:"dub", prob:.55},
      form:"dj" },
    spokenword: { label:"Spoken word", info:"beat poetry over jazz: quiet boombap, piano color, the poets narrating through the dust",   // SAMPLE-FORWARD: the VOICE leads
      bpm:[72,96], swing:[.05,.14], humanize:[.2,.4],
      progressions:["ii_v_i","neosoul","mode_dorian"], kits:["boombap"], fills:["off","off","drum fill"],
      bass:{patterns:["walking","dub","simple"], recipe:{model:["sub","piano"],cutoff:[350,650],res:[.05,.12],level:[.85,1.05],send:[.05,.15],dsend:[0,.05]}},
      lead:{patterns:["sparse","wander","off"], recipe:{model:["piano"],wave:"sine",voices:[1,1],spread:[.001,.003],cutoff:[2400,3400],level:[.45,.55],send:[.35,.5],dsend:[.1,.25]}},
      pads:{prob:.8, recipe:{model:["piano","fm"],wave:"sine",cutoff:[900,1500],detune:[.002,.006],attack:[.3,.9],level:[.4,.55],send:[.35,.5],dsend:[.05,.15]}},
      drums:{kickModel:["boom","808"],snareModel:["noise"],hatModel:["noise"],kick:[.95,1.2],snare:[.35,.55],hat:[.5,.8],tune:[.9,1],send:[.15,.3],dsend:[0,.1]},   // snare QUIET — never over the voice
      fx:{reverb:[.45,.6], delayBeats:[.5,.75], delayFb:[.2,.35], delayCut:[2200,3200], pump:[0,0], crackle:[.3,.5], lowcut:[0,0], highcut:[0,0], comp:[.1,.3], grit:[0,0]},
      found:{role:"bed", vol:[.3,.42], pitch:[.95,1], stretch:[.45,.6], cutoff:[3200,4600], sources:["vx_burroughs","vx_ginsberg","vx_waldman","vx_dickinson","leacock1","leacock4"]},   // the poets lead, Leacock keeps a chair
      stab:["off"], hits:{sources:["sp_herenow","sp_slowdown","sp_rewind"], pattern:"sparse", prob:.6},
      form:"pop" },
    chiptune: { label:"Chiptune", info:"square-wave arps at speed: bright triads, dry mix, zero dust — pure synth",   // SYNTH-FORWARD: no samples to speak of
      bpm:[140,148], swing:[0,.02], humanize:[0,.05],   // pinned under 150 — the engine forces a jungle kit above that
      progressions:["four_chords","sad_pop","minor_run"], kits:["four","pulse"], fills:["hat rush","cut","riser"],
      bass:{patterns:["octaves","sixteenths","drive"], recipe:{model:["saw"],cutoff:[900,1500],res:[.1,.2],level:[1,1.2],send:[0,.05],dsend:[0,.05]}},
      lead:{patterns:["arpup","arpdown","double"], recipe:{model:["pluck","stack"],wave:"square",voices:[1,2],spread:[.001,.003],cutoff:[3500,5000],level:[.5,.62],send:[.15,.3],dsend:[.15,.3],vibrato:[0,.002],attack:.002,release:[.03,.06],sustain:[.5,.6],octave:0}},
      pads:{prob:.5, recipe:{model:["saw"],wave:"square",cutoff:[1500,2500],detune:[.003,.007],attack:[.1,.4],level:[.35,.48],send:[.15,.3],dsend:[.05,.15]}},
      drums:{kickModel:["909"],snareModel:["noise","clap"],hatModel:["noise"],kick:[1.1,1.35],snare:[.7,.95],hat:[.8,1.15],tune:[1,1.15],send:[.05,.12],dsend:[0,.1]},
      fx:{reverb:[.3,.45], delayBeats:[.375,.5], delayFb:[.15,.3], delayCut:[3000,4500], pump:[0,.15], crackle:[0,0], lowcut:[0,0], highcut:[0,0], comp:[.3,.5], grit:[.15,.35]},
      found:{role:"bed", vol:[.04,.08], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[2000,3200], sources:["shibuya","vx_xminusone"]},
      stab:["off","sparse"], hits:{sources:["rave_a","sp_energy"], pattern:"offbeat", prob:.4},
      form:"pop" },
    chinawave: { label:"Chinawave", info:"socialist 1950s China wave: march snare, pentatonic brass over choir, shellac crackle, The East Is Red through the wire recorder",   // SAMPLE-FORWARD: the massed chorus IS the bed
      bpm:[96,118], swing:[0,.04], humanize:[.05,.18],
      progressions:["four_chords","doo_wop","canon"], kits:["four","pulse"], fills:["drum fill","tom fill","riser"],
      bass:{patterns:["root","walking","octaves"], recipe:{model:["saw"],cutoff:[500,850],res:[.08,.16],level:[.85,1.05],send:[.05,.12],dsend:[0,.05]}},
      lead:{patterns:["pentaup","pentaup","updown"], recipe:{model:["brass","brass","vocoder"],wave:"saw",voices:[1,2],spread:[.002,.005],cutoff:[2400,3400],level:[.52,.66],send:[.3,.45],dsend:[.1,.25],vibrato:[.006,.012]}},   // pentatonic brass; sometimes Radio Peking SINGS it (vocoder)
      pads:{prob:1, recipe:{model:["choir","strings"],wave:"saw",cutoff:[1000,1700],detune:[.004,.01],attack:[1,2.2],level:[.5,.68],send:[.4,.55],dsend:[.05,.15]}},
      drums:{kickModel:["boom","909"],snareModel:["noise","crack"],hatModel:["noise"],kick:[.95,1.15],snare:[1.05,1.3],hat:[.6,.9],tune:[.95,1.1],send:[.15,.3],dsend:[0,.1]},   // MARCH SNARE — proud and up front
      fx:{reverb:[.45,.6], delayBeats:[.5,.75], delayFb:[.15,.3], delayCut:[2200,3200], pump:[0,.08], crackle:[.15,.35], lowcut:[0,30], highcut:[0,0], comp:[.2,.4], grit:[0,.1]},
      found:{role:"bed", vol:[.2,.32], pitch:[.9,1], stretch:[.45,.6], cutoff:[2800,4200], sources:["vx_cn_east","vx_cn_march","vx_cn_opera","vx_cn_speech"]},
      vocSource:"vx_cn_speech",   // Radio Peking through the vocoder
      stab:["off"], hits:{sources:["vx_cn_opera","vx_cn_march"], pattern:"sparse", prob:.5},
      form:"pop" },
    sovietwave: { label:"Sovietwave", info:"socialist-realist nostalgia: minor anthems, the Red Army choir through the shortwave, retro arps, Lenin vocoded over the pulse",   // SAMPLE-FORWARD: choir + speeches + Radio Moscow
      bpm:[90,112], swing:[0,.06], humanize:[.05,.2],
      progressions:["epic_min","minor_run","uplift"], kits:["pulse","four"], fills:["riser","tom fill","downlift"],
      bass:{patterns:["drive","octaves"], recipe:{model:["saw"],cutoff:[550,900],res:[.12,.22],level:[1,1.2],send:[0,.08],dsend:[0,.05]}},
      lead:{patterns:["arpup","updown","hero"], recipe:{model:["vocoder","vocoder","stack"],wave:"saw",voices:[2,3],spread:[.004,.009],cutoff:[2400,3400],level:[.6,.72],send:[.35,.5],dsend:[.25,.4],vibrato:[0,.004]}},   // the genre's voice: vocoded speech SINGS the arps
      pads:{prob:1, recipe:{model:["choir","strings"],wave:"saw",cutoff:[900,1500],detune:[.005,.011],attack:[1.5,3],level:[.55,.75],send:[.5,.65],dsend:[.1,.2]}},
      drums:{kickModel:["boom","909"],snareModel:["noise","clap"],hatModel:["noise"],kick:[1.1,1.3],snare:[.7,.95],hat:[.6,.9],tune:[.9,1.05],send:[.2,.35],dsend:[.05,.15]},
      fx:{reverb:[.65,.8], delayBeats:[.5,.75], delayFb:[.25,.4], delayCut:[2000,3000], pump:[0,.15], crackle:[.2,.4], lowcut:[0,30], highcut:[0,0], comp:[.25,.45], grit:[0,.15]},
      found:{role:"bed", vol:[.22,.34], pitch:[.85,.95], stretch:[.45,.6], cutoff:[2400,3600], sources:["vx_sv_choir","vx_sv_speech","vx_sv_radio","vx_sv_march"]},
      vocSource:"vx_sv_speech",   // Lenin 1919, vocoded
      stab:["off","sparse"], hits:{sources:["vx_sv_march","vx_sv_radio"], pattern:"sparse", prob:.5},
      form:"pop" },
  };

  // ---------- per-genre lead ARTICULATION ----------
  // The knob that spreads the catalog ACROSS the space instead of every genre
  // collapsing onto the one default lead voice (the "Royal Road vector"). These set
  // the recipe-driven amp envelope (attack/release/sustain), the sine-octave amount
  // (`octave`: 0 = clean saw/square — no steel-drum), an optional resonant per-note
  // filter sweep (`fenv` = "sawtooth filtering"), and `res`. Merged into each genre's
  // lead recipe so blendRecipe blends them. Genres NOT listed (canawave kpluck guitar;
  // neoclassical/blues/jazz piano; dinosynth brass; transitwave — set inline) keep their
  // own already-distinct voice. Short release = staccato/stab; long = legato/wash.
  const ARTIC = {
    techno:    { octave:0,   attack:.003,     release:[.04,.07], sustain:[.45,.55], fenv:[.8,1.2], res:[.28,.4] },   // tight resonant stab
    house:     { octave:.05, attack:.004,     release:[.07,.12], sustain:[.6,.72],  fenv:[.4,.7] },                  // plucky organ stab
    jungle:    { octave:0,   attack:.003,     release:[.05,.09], sustain:[.5,.62],  fenv:[.5,.8] },                  // bright ragga stab
    triphop:   { octave:.08, attack:.05,      release:[.3,.45],  sustain:[.78,.88], fenv:[.2,.4] },                  // dark filtered legato
    vaporwave: { octave:.2,  attack:.08,      release:[.45,.6],  sustain:[.85,.95] },                                // lush sine wash — OWNS the legato-sine corner
    synthwave: { octave:.08, attack:.02,      release:[.26,.36], sustain:[.82,.9],  fenv:[.15,.35] },                // soaring supersaw
    lofi:      { octave:.06, attack:.025,     release:[.12,.2],  sustain:[.66,.78], fenv:[.15,.3] },                 // mellow dusty
    downtempo: { octave:.1,  attack:.04,      release:[.28,.4],  sustain:[.8,.9],   fenv:[.1,.25] },                 // smooth legato
    ambient:   { octave:.14, attack:[.5,.9],  release:[.7,1.1],  sustain:[.95,1] },                                  // infinite swell — OWNS the drone corner
    dancepop:  { octave:.05, attack:.006,     release:[.16,.24], sustain:[.72,.82], fenv:[.25,.45] },                // punchy bright
    edm:       { octave:.04, attack:.005,     release:[.2,.3],   sustain:[.78,.88], fenv:[.3,.5] },                  // huge supersaw w/ filter pluck
    dubstep:   { octave:0,   attack:.004,     release:[.1,.16],  sustain:[.55,.68], fenv:[.35,.6] },                 // short dark stab
  };
  Object.entries(ARTIC).forEach(([g,a])=>{ if(GENRES[g]&&GENRES[g].lead) Object.assign(GENRES[g].lead.recipe, a); });

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
    // one parent draw per dimension GROUP: fields that must cohere (a vox
    // recipe and its source pool; a found role and its sources; the national-
    // character extras) come from the SAME parent. Calling side() per field
    // could check canawave's .vox then read ambient's — a crash on any
    // vox-genre × plain-genre blend.
    const hitsSide=side(), voxSide=side(), foundSide=side(), extraSide=side();
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
      foundRole: foundSide.found.role,
      foundSource: pick(rng, foundSide.found.sources),
      foundPool: (()=>{ const a=foundSide.found.sources.slice(), o=[], n=Math.min(6,a.length);   // distinct beds/narration chunks to rotate (kills the one-loop repeat)
        while(o.length<n&&a.length) o.push(a.splice(Math.floor(rng()*a.length),1)[0]); return o; })(),
      voxPool: (voxSide.vox ? (()=>{ const a=voxSide.vox.sources.slice(), o=[], n=Math.min(3,a.length);   // VO lines to rotate across sections
        while(o.length<n&&a.length) o.push(a.splice(Math.floor(rng()*a.length),1)[0]); return o; })() : []),
      voxRecipe: voxSide.vox || null,
      voxClean: !!(voxSide.vox && voxSide.vox.clean),
      voxPoem: voxSide.voxPoem || null,
      vocSource: extraSide.vocSource || null,
      hornSource: extraSide.hornSource || null,
      hornVol: extraSide.hornVol, hornCut: extraSide.hornCut,
      dingSource: extraSide.dingSource || null, dingVol: extraSide.dingVol,
      snarePP: extraSide.snarePP || 0,
      stations: extraSide.stations || null, stationVol: extraSide.stationVol,
      vocal: !!extraSide.vocal, vocalVol: extraSide.vocalVol,
      realHats: !!extraSide.realHats,
      foundRecipe: blendRecipe(g=>({vol:g.found.vol,pitch:g.found.pitch,stretch:g.found.stretch,cutoff:g.found.cutoff})),
      stab: pick(rng, side().stab),
      hits: rng()<hitsSide.hits.prob ? {source:pick(rng,hitsSide.hits.sources), pattern:hitsSide.hits.pattern, wet:hitsSide.hits.wet, glitch:hitsSide.hits.glitch, vol:hitsSide.hits.vol, cut:hitsSide.hits.cut} : null,
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
    } else if(c.form==="ritual"){
      // planetarium dinosaur soundtrack: narrated, cinematic, SHORT. The theme melody
      // enters early; two creatures solo (each its own voice); a grungy fuzz solo; the
      // paleontologist VO is glitched throughout. Fixed cycles (no norm) = tight runtime.
      const sauropod={model:"brass",cutoff:900, level:0.6, voices:1};                            // huge low bellow
      const raptor  ={model:"stack",wave:"saw",cutoff:3500,res:0.2,level:0.48,voices:2,spread:0.01,vibrato:0.024}; // wailing cry with bite — saw + resonance (harmonic, not bell-FM)
      const fuzz    ={model:"fuzz", cutoff:2600,level:0.66,voices:2,res:0.3,drive:1};            // noisy distorted solo
      const vox=()=>({sourceId:"vox"});
      secs=[
        S("dawn",   {cycles:1, pads:true, found:fnd("bed"), vox:vox(), sweep:"open"}),                                  // "welcome to the age of dinosaurs"
        S("theme",  {cycles:2, drums:kit, bass, pads:true, melody:lead, found:fnd("bed")}),                             // melody/theme IN early
        S("call",   {cycles:1, drums:kit, bass, pads:true, melody:"roar",   solo:sauropod, soloOctave:-1, found:fnd("bed"), vox:vox()}),
        S("answer", {cycles:1, drums:kit, bass, pads:true, melody:"sparse", solo:raptor,   soloOctave:0,  sweep:"close"}),  // filter dives before the drop
        S("shred",  {cycles:1, drums:kit, bass, pads:true, melody:"hero",   solo:fuzz,     found:fnd("bed"), vox:vox(), sweep:"open"}),  // sweep up into the distorted solo + glitch VO
        S("finale", {cycles:2, drums:kit, bass, pads:true, melody:lead, found:fnd("bed"), vox:vox(), sweep:"open"}),     // theme reprise + swell
      ];
    } else if(c.form==="anthem"){
      // proud Canadian pop, ~3 min: arpeggiated guitar in from the verse, tom fills
      // into every chorus, hi-hats throughout, loon calls + the national news on top.
      const vox=()=>({sourceId:"vox", clean:c.voxClean});    // clean hockey calls / news (intelligible)
      const poem=()=>({sourceId:"poem", clean:false});       // the rhyming-cities poem, cut up as texture
      const horn=()=>({sourceId:"horn"});                    // the goal horn — FULL volume opener
      const swellBrass={model:"brass", cutoff:9000, level:1.9, voices:1};   // big organic brass — high cutoff so it isn't over-filtered (brassSource shapes it)
      // THE lead is the Edge 16th-note arp guitar (lead==="arp16"). One big grand
      // brass swell owns the bridge (midpoint). Structure/length unchanged so the new
      // audio grafts onto the existing video.
      secs=[
        S("intro",    {cycles:1, pads:true, found:fnd(), vox:vox(), hits:horn(), sweep:"open"}),                     // FULL goal horn opener + "hockey night in canada"
        S("verse",    {cycles:2, drums:kit, bass, pads:true, melody:lead, found:fnd(), hits:hit(), fill:"tom fill"}), // Edge arp lead + moving bass; Peart tom fill into chorus
        S("chorus",   {cycles:2, drums:kit, bass, pads:true, melody:lead, stab:c.stab, found:fnd()}),
        S("verse 2",  {cycles:1, drums:kit, bass, pads:true, melody:lead, found:fnd(), vox:poem(), fill:"tom fill"}), // + cities poem
        S("bridge",   {cycles:1, pads:true, bass:"root", melody:"off", counter:{pattern:"anthem", solo:swellBrass, octave:0}, fill:"tom fill", sweep:"open", swell:true}), // GRAND BRASS SWELL — drums/narration DROP OUT so it's exposed: bass drone + swelling pads + loud crescendo brass + Peart fill back in
        S("chorus 2", {cycles:2, drums:kit, bass, pads:true, melody:lead, found:fnd()}),   // final chorus
      ];
    } else if(c.form==="transit"){
      // a commuter journey: the train pulls in (filtered pass + announcement, door chime),
      // doors close and the clatter groove departs, full transit (with a 2/3-speed gritty
      // counter-arp weaving against the main Kraftwerk arp), the schedule litany at the
      // interchange, a DISTORTED heavy-metal solo, the express run, then the terminus. The
      // station-PA voice rides every station; the clatter bed runs throughout; door "ding
      // ding" chimes at the stations.
      const vox=()=>({sourceId:"vox", clean:c.voxClean});   // schedule announcements
      const poem=()=>({sourceId:"poem", clean:false});      // the departures litany, chopped
      const horn=()=>({sourceId:"horn"});                   // the train pulling in (filtered)
      const counter={pattern:"motorik23", solo:{model:"fuzz",wave:"saw",cutoff:2600,res:0.3,drive:0.15,level:0.5,voices:1,send:0.2,dsend:0.44,attack:.004,release:0.09,sustain:0.62,fenv:0.6,swellHz:.13,swellDepth:.6,swellPhase:.5}, octave:-1};   // 2/3-speed mirror counter-arp, an OCTAVE LOWER, gritty, breathing OPPOSITE the main (they trade)
      const metal={model:"fuzz",wave:"saw",cutoff:3400,res:0.26,drive:0.7,level:0.62,voices:1,vibrato:.013,vibRate:5.5};   // the solo: SUSTAINED + grimy (no staccato params -> legacy singing env), wailing vibrato — a proper lead, not noise
      secs=[
        S("platform",   {cycles:1, pads:true, found:fnd("bed"), vox:vox(), hits:horn(), ding:true, sweep:"open"}),                          // train arrives + announcement + door chime
        S("board",      {cycles:2, drums:kit, bass, pads:true, melody:lead, found:fnd("bed"), vox:vox(), ding:true, fill:"tom fill"}),       // doors close, the groove departs -> tom fill
        S("transit",    {cycles:2, drums:kit, bass, pads:true, melody:lead, counter, found:fnd("bed"), stab:c.stab, hits:hit(), fill:F()}),  // full groove + the counter-arp; a random fill
        S("chorus",     {cycles:1, drums:kit, bass, pads:true, melody:lead, found:fnd("bed"), vocal:true, fill:"riser"}),                    // the 8-bar SUNG chorus (WORLD-vocoder vocal over the groove)
        S("interchange",{cycles:1, pads:true, bass:"root", melody:"sparse", found:fnd("bed"), vox:poem(), ding:true, fill:"downlift", sweep:"close"}),   // wind DOWN into the station; the schedule litany
        S("solo",       {cycles:1, drums:kit, bass, pads:true, melody:"blues", solo:metal, soloOctave:1, found:fnd("bed"), fill:"impact", sweep:"open"}),   // the distorted heavy-metal solo — grimy bluesy lead, octave up; impact into it
        S("express",    {cycles:2, drums:kit, bass, pads:true, melody:lead, counter, found:fnd("bed"), vox:vox(), hits:hit(), fill:"break fill", sweep:"open"}),  // the express run + counter-arp -> break fill
        S("terminus",   {cycles:2, drums:kit, bass, pads:true, melody:lead, found:fnd("bed"), vox:vox(), ding:true, fill:F()}),              // arrival, final announcement + door chime; a random fill
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
    // bed role rotates through up to 3 sources (each pitched a hair differently so it
    // reads as a different place); break/chops keep the single tempo-locked source.
    const bedPool=((c.foundRole==="bed"||c.foundRole==="narration")&&c.foundPool&&c.foundPool.length>1)?c.foundPool:[c.foundSource];
    bedPool.forEach((sid,ix)=>{
      const isS=!!SAMPLES[sid];
      const sr=isS?SAMPLES[sid]:(SOURCES[sid]||{});
      const pj=1+(ix*0.06-0.03);
      foundSources.push(Object.assign({id:sid,label:sid,url:sr.url||""},
        isS?{samplePath:"found/samples/"+sr.file,bpm:sr.bpm,durSec:sr.durSec}:{},
        {vol:c.foundRecipe.vol,pitch:c.foundRole==="break"?1:round(c.foundRecipe.pitch*pj,3),
         stretch:c.foundRecipe.stretch,cutoff:Math.round(c.foundRecipe.cutoff)}));
    });
    if(c.hits){
      // hits resolve from SAMPLES (local one-shots) OR SOURCES (remote material
      // used as stabs — e.g. the Radio Moscow interval signal): a SOURCES hit
      // carries its url (browser streams it) and the CLI resolves found/<id>.wav
      // as it does for any SOURCES id. Caught by validate-genres gate 6 —
      // chinawave/sovietwave listed SOURCES ids in hits and silently lost the
      // whole hit layer on those seeds.
      const h=SAMPLES[c.hits.source], hs=!h&&SOURCES[c.hits.source];
      if(h) foundSources.push({id:c.hits.source,label:c.hits.source,url:"",samplePath:"found/samples/"+h.file,
        durSec:h.durSec,vol:(c.hits.vol!=null?c.hits.vol:0.22),pitch:1,stretch:0.5,cutoff:(c.hits.cut||4500),wet:!!c.hits.wet,glitch:!!c.hits.glitch});
      else if(hs) foundSources.push({id:c.hits.source,label:c.hits.source,url:hs.url,
        durSec:4,vol:(c.hits.vol!=null?c.hits.vol:0.22),pitch:1,stretch:0.5,cutoff:(c.hits.cut||4500),wet:!!c.hits.wet,glitch:!!c.hits.glitch});
    }
    if(c.hornSource&&SAMPLES[c.hornSource]){   // FULL-volume opener (intro only); vol/cutoff genre-tunable so a loud field-recording one-shot can be filtered back
      const hh=SAMPLES[c.hornSource];
      foundSources.push({id:c.hornSource,label:c.hornSource,url:"",samplePath:"found/samples/"+hh.file,
        durSec:hh.durSec,vol:(c.hornVol!=null?c.hornVol:0.42),pitch:1,stretch:0.5,cutoff:(c.hornCut||6000),wet:true});
    }
    if(c.dingSource&&SAMPLES[c.dingSource]){   // the transit door "ding ding" chime
      const dd=SAMPLES[c.dingSource];
      foundSources.push({id:c.dingSource,label:c.dingSource,url:"",samplePath:"found/samples/"+dd.file,
        durSec:dd.durSec,vol:(c.dingVol!=null?c.dingVol:0.5),pitch:1,stretch:0.5,cutoff:9000,wet:true});
    }
    const voxIds=(c.voxPool||[]).slice();
    if(c.voxPoem) voxIds.push(c.voxPoem);
    voxIds.forEach(vid=>{   // VO lines (news clean, poem chopped) + the cities poem
      const v=SAMPLES[vid]; if(!v) return;
      foundSources.push({id:vid,label:vid,url:"",samplePath:"found/samples/"+v.file,durSec:v.durSec,
        vol:(c.voxRecipe&&c.voxRecipe.vol)||0.5, pitch:(c.voxRecipe&&c.voxRecipe.pitch)||0.96,
        stretch:0.5, cutoff:(c.voxRecipe&&c.voxRecipe.cutoff)||6500});
    });
    (c.stations||[]).forEach(sid=>{   // world-metro station names — under every measure (see buildEvents)
      const v=SAMPLES[sid]; if(!v) return;
      foundSources.push({id:sid,label:sid,url:"",samplePath:"found/samples/"+v.file,durSec:v.durSec,
        vol:(c.stationVol!=null?c.stationVol:0.26), pitch:1, stretch:0.5, cutoff:5200});
    });
    if(c.vocal){   // the WORLD-sung 8-bar chorus — generated to match bpm+key at render time (sing.py), written here
      foundSources.push({id:"tw_vocal",label:"tw_vocal",url:"",samplePath:"found/tw_vocal.wav",
        durSec:32*60/c.bpm, vol:(c.vocalVol!=null?c.vocalVol:0.52), pitch:1, stretch:0.5, cutoff:9000, vocal:true});
    }
    // the "vocoder" melody/pad model needs a speech table to modulate from:
    // resolve the anchor's vocSource (else first VO line / hit) and make sure
    // that source is IN foundSources (vol 0 = loaded as modulator, never played)
    let vocId=null;
    if(c.leadRecipe.model==="vocoder"||c.padRecipe.model==="vocoder"){
      vocId=c.vocSource||(c.voxPool&&c.voxPool[0])||(c.hits&&c.hits.source)||null;
      if(vocId&&!foundSources.some(s=>s.id===vocId)){
        const isVS=!!SAMPLES[vocId], vsr=isVS?SAMPLES[vocId]:SOURCES[vocId];
        if(vsr) foundSources.push(Object.assign({id:vocId,label:vocId,url:vsr.url||""},
          isVS?{samplePath:"found/samples/"+vsr.file,durSec:vsr.durSec}:{},
          {vol:0,pitch:1,stretch:0.5,cutoff:5000}));
        else vocId=null;
      }
    }
    const state={
      vocoderSourceId: vocId||undefined,
      bpm:c.bpm, keyOffset:opts.keyOffset!=null?opts.keyOffset:0, progression:c.progression,
      reverb:c.fx.reverb, seed:c.seed, swing:c.swing, humanize:c.humanize,
      realHats:!!c.realHats, snarePP:c.snarePP||0, stationPool:(c.stations||[]),
      pump:c.fx.pump>0.05?c.fx.pump:0, crackle:c.fx.crackle>0.05?c.fx.crackle:0,
      comp:c.fx.comp>0.05?c.fx.comp:0, grit:(c.fx.grit||0)>0.05?c.fx.grit:0,
      tone:{lowcut:c.fx.lowcut>10?Math.round(c.fx.lowcut):0, highcut:c.fx.highcut>1000?Math.round(c.fx.highcut):0},
      delay:{beats:c.fx.delayBeats, feedback:c.fx.delayFb, cutoff:Math.round(c.fx.delayCut)},
      instruments:{
        pad:Object.assign(E.defaultInstruments().pad, c.padRecipe),
        bass:Object.assign(E.defaultInstruments().bass, c.bassRecipe),
        melody:Object.assign(E.defaultInstruments().melody, c.leadRecipe, {voices:Math.round(c.leadRecipe.voices||2)}),
        drums:Object.assign(E.defaultInstruments().drums, c.drumRecipe),
      },
      foundSources,
      sections:(()=>{ let bi=0, vi=0; return secs.map(s=>{
        if(s.found&&s.found.sourceId==="src"){ s.found.sourceId=bedPool[bi%bedPool.length]; bi++; }
        if(s.hits&&s.hits.sourceId==="hit")s.hits.sourceId=c.hits?c.hits.source:null;
        if(s.hits&&s.hits.sourceId==="horn")s.hits.sourceId=c.hornSource||null;
        if(s.hits&&!s.hits.sourceId)delete s.hits;
        if(s.vox&&s.vox.sourceId==="vox"){ if(c.voxPool&&c.voxPool.length){ s.vox.sourceId=c.voxPool[vi%c.voxPool.length]; vi++; } else delete s.vox; }
        else if(s.vox&&s.vox.sourceId==="poem"){ if(c.voxPoem) s.vox.sourceId=c.voxPoem; else delete s.vox; }
        if(s.ding===true){ if(c.dingSource) s.ding=c.dingSource; else delete s.ding; }   // doors-closing chime -> the ding source id
        if(s.vocal===true){ if(c.vocal) s.vocal="tw_vocal"; else delete s.vocal; }        // the sung chorus -> the vocal source id
        return s; }); })(),
    };
    state.genreMeta={genres:c.genres,t:c.t,seed:c.seed,form:c.form,kit:c.kit,progression:c.progression,
      bass:c.bassPattern+"("+c.bassRecipe.model+")",lead:c.leadPattern+"("+c.leadRecipe.model+")",
      pad:c.padRecipe.model,drums:c.drumRecipe.kickModel+"/"+c.drumRecipe.snareModel+"/"+c.drumRecipe.hatModel,
      found:c.foundSource+"/"+c.foundRole, stab:c.stab, hits:c.hits?c.hits.source:"-"};
    return state;
  }

  function track(genre, opts){ opts=opts||{}; return toState(resolve(genre, genre, 0, opts.seed!=null?opts.seed:1), opts); }
  function blend(a, b, t, opts){ opts=opts||{}; return toState(resolve(a, b, t, opts.seed!=null?opts.seed:1), opts); }

  // ---------- journeys: playlists along arbitrary paths ----------
  // A waypoint is a genre NAME ("techno") or a POINT in the space
  // ({weights:[{g,w},…]}, e.g. exported from the explorer's drawn path).
  // journey() walks waypoint-to-waypoint, lerping weight vectors between
  // them, with playlist()'s tempo/key/novelty discipline; playlist() is the
  // all-names special case.
  function wpLabel(ws){
    const s=ws.slice().sort((a,b)=>b.w-a.w);
    if(s.length===1||s[0].w>0.9) return s[0].g;
    return s.slice(0,2).map(x=>x.g+Math.round(x.w*100)).join("+");
  }
  function normWaypoint(w){
    if(typeof w==="string"){
      if(!GENRES[w]) throw new Error("unknown genre: "+w);
      return { label:w, weights:[{g:w,w:1}] };
    }
    const ws=(w.weights||[]).filter(x=>GENRES[x.g]&&x.w>0);
    if(!ws.length) throw new Error("waypoint has no valid genre weights");
    const tot=ws.reduce((s,x)=>s+x.w,0);
    return { label:wpLabel(ws), weights:ws.map(x=>({g:x.g,w:x.w/tot})) };
  }
  function lerpWeights(A,B,t){
    const m={};
    A.forEach(x=>m[x.g]=(m[x.g]||0)+x.w*(1-t));
    B.forEach(x=>m[x.g]=(m[x.g]||0)+x.w*t);
    const ws=Object.entries(m).filter(([,w])=>w>0.01).map(([g,w])=>({g,w:round(w,4)}));
    return ws.length?ws:[{g:A[0].g,w:1}];
  }
  function journey(waypoints, opts){
    opts=opts||{};
    const wps=waypoints.map(normWaypoint);
    const hours=opts.hours||2;
    const n=opts.tracks||Math.max(4,Math.round(hours*8));
    const baseSeed=opts.seed!=null?opts.seed:42;
    const rng=mulberry32(baseSeed>>>0);
    const legs=Math.max(1,wps.length-1);
    const perSec=hours*3600/n;
    let key=Math.floor(rng()*12);
    const recent=[], out=[];
    for(let i=0;i<n;i++){
      const pos=legs*(n===1?0:i/(n-1));
      const leg=Math.min(legs-1,Math.floor(pos));
      const A=wps[leg], B=wps[leg+1]||A, t=pos-leg;
      const weights=lerpWeights(A.weights,B.weights,t);
      const targetSec=perSec*(0.75+rng()*0.5);
      key=(key+(rng()<0.5?7:5))%12;
      let state=null, meta=null;
      for(let attempt=0; attempt<6; attempt++){
        const seed=baseSeed+i*101+attempt*1009;
        const cand=toState(resolveMulti(weights.map(w=>({...w})),seed), {targetSec, keyOffset:key});
        const m=cand.genreMeta;
        const sig=[m.kit,m.progression,m.bass,m.lead,m.found];
        const collide=recent.some(r=>sig.filter((v,j)=>v===r[j]).length>=3);
        if(!collide||attempt===5){ state=cand; meta=m; recent.push(sig); if(recent.length>2)recent.shift(); break; }
      }
      const beats=state.sections.reduce((nn,s)=>nn+(s.cycles||1)*(E.PROGRESSIONS[state.progression].chords.length*8),0)+8;
      out.push({ i, from:A.label, to:B.label, t:round(t,3), weights,
        seconds:Math.round(beats*60/state.bpm), bpm:state.bpm, key, meta, state });
    }
    return out;
  }
  function playlist(waypoints, opts){ return journey(waypoints, Object.assign({tracks:12}, opts||{})); }

  function mix(weights, opts){ opts=opts||{}; return toState(resolveMulti(weights, opts.seed!=null?opts.seed:1), opts); }
  const api={ GENRES, SOURCES, SAMPLES, GENRE_CLIPS, resolve, resolveMulti, track, blend, mix, playlist, journey };
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
      // generate the WORLD-sung chorus to match THIS render's tempo + key (sing.py), if used
      const vsrc=state.foundSources.find(s=>s.id==="tw_vocal");
      if(vsrc){
        const vpath=path.join(__dirname,vsrc.samplePath), svpy=path.join(__dirname,".venv-sing","bin","python");
        try{ execFileSync(svpy,[path.join(__dirname,"sing.py"),"--bpm",String(state.bpm),"--transpose",String((state.keyOffset|0)-12),"--out",vpath],{stdio:["ignore","ignore","inherit"]}); }
        catch(e){ console.error("  (sung chorus skipped — .venv-sing/sing.py unavailable)");
          state.foundSources=state.foundSources.filter(s=>s.id!=="tw_vocal");
          state.sections.forEach(s=>{ if(s.vocal) delete s.vocal; }); }
      }
      resolvePaths(state);
      const wav="/tmp/"+path.basename(base)+".wav";
      const csd=E.buildCsd(state).replace("<CsoundSynthesizer>",
        `<CsoundSynthesizer>\n<CsOptions>\n--nosound -o ${wav} -W\n</CsOptions>`);
      fs.writeFileSync("/tmp/"+path.basename(base)+".csd",csd);
      execFileSync("csound",["/tmp/"+path.basename(base)+".csd"],{stdio:["ignore","ignore","ignore"]});
      // fade the ending out instead of stopping abruptly
      const beats=state.sections.reduce((n,s)=>n+(s.cycles||1)*(E.PROGRESSIONS[state.progression]||E.PROGRESSIONS.royal_road).chords.length*8,0)+8;
      const dur=beats*60/state.bpm, fade=Math.min(4,dur*0.1), st=Math.max(0,dur-fade);
      execFileSync("ffmpeg",["-y","-v","error","-i",wav,"-af",`afade=t=out:st=${st.toFixed(2)}:d=${fade.toFixed(2)}`,"-codec:a","libmp3lame","-b:a","160k",base+".mp3"]);
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
    } else if(cmd==="journey"){
      // the bridge: a drawn path (explorer "⤓ path" JSON) or genre names ->
      // hours of tracks -> mp3s -> per-track video -> one long journey.mp3/.mp4 + mix page
      const dashIx=args.findIndex(a=>a.startsWith("--"));
      const posArgs=args.slice(1,dashIx<0?undefined:dashIx);
      let ways, pathSeed=null;
      if(posArgs.length===1 && fs.existsSync(posArgs[0]) && posArgs[0].endsWith(".json")){
        const pj=JSON.parse(fs.readFileSync(posArgs[0],"utf8"));
        if(!Array.isArray(pj.waypoints)||!pj.waypoints.length){ console.error("✗ "+posArgs[0]+" has no waypoints"); process.exit(1); }
        ways=pj.waypoints.map(w=>w.weights?{weights:w.weights}:w);
        if(pj.seed!=null) pathSeed=pj.seed;
      } else {
        ways=posArgs;                                   // genre names, like playlist
        if(ways.length<1){ console.error("usage: genre-kernel.js journey <path.json | genreA genreB ...> [--hours H --tracks N --out DIR --render --video --seed N]"); process.exit(1); }
      }
      const hours=+flag("hours",2);
      const seed=flag("seed",null)!=null?+flag("seed",1):(pathSeed!=null?pathSeed:42);
      const pl=journey(ways,{tracks:flag("tracks",null)!=null?+flag("tracks",12):undefined,hours,seed});
      const dir=flag("out","journey");
      fs.mkdirSync(dir,{recursive:true});
      const manifest=pl.map(({state,...rest})=>rest);
      fs.writeFileSync(path.join(dir,"playlist.json"),JSON.stringify(manifest,null,2));
      pl.forEach(tr=>fs.writeFileSync(path.join(dir,`track-${String(tr.i+1).padStart(2,"0")}.state.json`),JSON.stringify(tr.state,null,2)));
      const total=pl.reduce((s,t)=>s+t.seconds,0);
      console.log(`✓ ${dir}/: ${pl.length} tracks, ${(total/3600).toFixed(2)}h  (${pl[0].from} → ${pl[pl.length-1].to})`);
      pl.forEach(t=>console.log(`  ${String(t.i+1).padStart(2)} ${t.from}→${t.to} t=${t.t} ${t.bpm}bpm key=${t.key} ${Math.round(t.seconds/60)}min ${t.meta.kit} ${t.meta.lead} ${t.meta.progression} ${t.meta.found}`));
      const bases=pl.map(tr=>path.join(dir,"track-"+String(tr.i+1).padStart(2,"0")));
      if(has("render")){
        pl.forEach((tr,i)=>{ console.log(`[render ${i+1}/${pl.length}]`); renderState(tr.state,bases[i]); });
        // one long journey.mp3 (tracks already fade out; straight concat)
        const list=path.join(dir,"concat.txt");
        fs.writeFileSync(list,bases.map(b=>`file '${path.resolve(b+".mp3")}'`).join("\n")+"\n");
        execFileSync("ffmpeg",["-y","-v","error","-f","concat","-safe","0","-i",list,"-c","copy",path.join(dir,"journey.mp3")]);
        console.log("✓ "+path.join(dir,"journey.mp3"));
      }
      if(has("video")){
        bases.forEach((b,i)=>{ console.log(`[video ${i+1}/${pl.length}]`);
          execFileSync("node",[path.join(__dirname,"render-sample-video.js"),"journey",b+".state.json",path.resolve(b+".mp4")],{stdio:["ignore","inherit","inherit"]}); });
        const vlist=path.join(dir,"concat-video.txt");
        fs.writeFileSync(vlist,bases.map(b=>`file '${path.resolve(b+".mp4")}'`).join("\n")+"\n");
        execFileSync("ffmpeg",["-y","-v","error","-f","concat","-safe","0","-i",vlist,"-c","copy",path.join(dir,"journey.mp4")]);
        console.log("✓ "+path.join(dir,"journey.mp4"));
      }
      // mix page LAST so it links whatever exists (track videos, journey.mp3/.mp4)
      if(has("render")||has("video")){
        try{ execFileSync("node",[path.join(__dirname,"make-mix-page.js"),dir],{stdio:"inherit"}); }catch(e){}
      }
    } else {
      console.log("usage: genre-kernel.js anchors | track <genre> | blend <a> <b> <t> | playlist <a> <b> ... | journey <path.json|genres...> [--hours H --tracks N --out DIR --render --video]");
    }
  }
})(typeof window!=="undefined"?window:globalThis);
