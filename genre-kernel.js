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
    // hogcore — 24 Harry Potter character NAMES (espeak-ng, varied voices = a cast;
    // recipe: fetch-found-samples.sh "hogcore speech" block). THE VOICE IS THE GENRE:
    // scheduled as pitched-up vocal CHOPS (found role) + a rotating name under every
    // bar (stationPool) + one-shot name stabs (hits). See GENRES.hogcore.
    hp_harry:{ file:"speech/hp_harry.wav", kind:"speech", durSec:1.10 },
    hp_hermione:{ file:"speech/hp_hermione.wav", kind:"speech", durSec:1.32 },
    hp_ron:{ file:"speech/hp_ron.wav", kind:"speech", durSec:1.22 },
    hp_dumbledore:{ file:"speech/hp_dumbledore.wav", kind:"speech", durSec:0.97 },
    hp_snape:{ file:"speech/hp_snape.wav", kind:"speech", durSec:1.14 },
    hp_draco:{ file:"speech/hp_draco.wav", kind:"speech", durSec:1.53 },
    hp_luna:{ file:"speech/hp_luna.wav", kind:"speech", durSec:0.86 },
    hp_neville:{ file:"speech/hp_neville.wav", kind:"speech", durSec:1.41 },
    hp_mcgonagall:{ file:"speech/hp_mcgonagall.wav", kind:"speech", durSec:1.79 },
    hp_hagrid:{ file:"speech/hp_hagrid.wav", kind:"speech", durSec:1.06 },
    hp_sirius:{ file:"speech/hp_sirius.wav", kind:"speech", durSec:1.40 },
    hp_bellatrix:{ file:"speech/hp_bellatrix.wav", kind:"speech", durSec:1.47 },
    hp_voldemort:{ file:"speech/hp_voldemort.wav", kind:"speech", durSec:1.09 },
    hp_ginny:{ file:"speech/hp_ginny.wav", kind:"speech", durSec:1.18 },
    hp_cho:{ file:"speech/hp_cho.wav", kind:"speech", durSec:1.28 },
    hp_cedric:{ file:"speech/hp_cedric.wav", kind:"speech", durSec:1.46 },
    hp_dobby:{ file:"speech/hp_dobby.wav", kind:"speech", durSec:0.30 },
    hp_hedwig:{ file:"speech/hp_hedwig.wav", kind:"speech", durSec:0.52 },
    hp_buckbeak:{ file:"speech/hp_buckbeak.wav", kind:"speech", durSec:1.22 },
    hp_peeves:{ file:"speech/hp_peeves.wav", kind:"speech", durSec:0.33 },
    hp_nick:{ file:"speech/hp_nick.wav", kind:"speech", durSec:1.80 },
    hp_myrtle:{ file:"speech/hp_myrtle.wav", kind:"speech", durSec:0.95 },
    hp_filch:{ file:"speech/hp_filch.wav", kind:"speech", durSec:1.68 },
    hp_crookshanks:{ file:"speech/hp_crookshanks.wav", kind:"speech", durSec:1.34 },
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
    // round-3 pools — drawn from the existing clip shelf, aesthetic-kin first
    citypop:    ["sharpest_city","night_lights","blue_dinner","drive_taillights","sun_riders","cs_marketstreet","pl_motorama"],
    shibuyakei: ["cgi_bird","rainbow_rings","kaleido","sun_riders","pl_kitchen","pl_supermarket","dn_schoolyard"],
    bossanova:  ["bamboo","disc_sunset","blue_dinner","ns_hula","ns_waterfall","cs_liner","dc_village"],
    idm:        ["ab_diagonale","ab_balletmec","ab_fantasma","green_nebula","kaleido","tv_room","ind_furnace"],
    electro:    ["ab_balletmec","phuture_red","night_lines","kaleido","pl_modelcity","cs_manhatta","sp_eva"],
    miamibass:  ["night_lights","drive_taillights","sun_riders","kaleido","pl_motorama","pl_parkinglot"],
    phonk:      ["dark_face","deep_face","night_lines","drive_taillights","tv_room","ind_molten"],
    witchhouse: ["dark_face","deep_face","green_nebula","tv_room","ab_fantasma","lw_london"],
    mallsoft:   ["pl_supermarket","pl_kitchen","blue_dinner","disc_sunset","tv_room","pl_futurama","kaleido"],
    wintersynth:["lw_plateau","dc_rockies","earth_orbit","green_nebula","sp_lander","dc_alberta"],
    gabber:     ["phuture_red","ind_furnace","ind_molten","night_lines","dark_face","ab_balletmec"],
    psytrance:  ["green_nebula","kaleido","rainbow_rings","night_lines","sp_eva","earth_orbit"],
    minimal:    ["night_lines","tv_room","ab_diagonale","pl_sage","cs_manhatta","dark_face"],
    deephouse:  ["night_lights","deep_face","blue_dinner","kaleido","cs_marketstreet","drive_bluehour"],
    coldwave:   ["tw_window","dark_face","cs_manhatta","night_lines","tw_rails","ind_furnace"],
    ebm:        ["ind_furnace","ind_molten","dark_face","phuture_red","ab_balletmec","tw_subway"],
    krautrock:  ["drive_bridge","drive_dusk","night_lines","tw_rails","cs_manhatta","pl_modelcity","drive_bluehour"],
    newjack:    ["kaleido","rainbow_rings","night_lights","sun_riders","dn_schoolyard","pl_americana"],
    breakcore:  ["dark_face","phuture_red","green_nebula","night_lines","ab_balletmec","tw_subway"],
    acidhouse:  ["kaleido","phuture_red","rainbow_rings","night_lights","cs_marketstreet","pl_sage"],
    surfrock:   ["sun_riders","disc_sunset","ca_tide","ns_hula","dn_soundie","bt_hootenanny","pl_americana"],
    spacelounge:["spacewalk","earth_orbit","sp_eva","sp_lander","ns_rays","blue_dinner","pl_futurama"],
    arabpop:    ["dc_village","sun_riders","cs_marketstreet","bamboo","ns_rays","disc_sunset"],
    tango:      ["blue_dinner","tv_room","ab_fantasma","cs_liner","dn_soundie","bt_folksinger"],
    afrobeat:   ["cs_marketstreet","sun_riders","dn_schoolyard","kaleido","bt_hootenanny","ns_hula"],
    desertblues:["lw_plateau","dc_alberta","disc_sunset","dc_rockies","bt_folksinger","ca_tide"],
    sludgemetal:["ind_molten","ind_furnace","dark_face","lw_rampage","green_nebula","deep_face"],
    industrialmetal:["ind_furnace","ind_molten","ab_balletmec","dark_face","phuture_red","tw_subway"],
    darksynth:  ["drive_taillights","night_lines","phuture_red","dark_face","drive_bluehour","ind_molten"],
    /* genre-tool:prelude:clips */
    prelude:["earth_orbit","blue_dinner","bamboo","dc_village","spacewalk"],
    /* /genre-tool:prelude:clips */
    /* genre-tool:hogcore:clips */
    hogcore:["kaleido","rainbow_rings","cgi_bird","night_lights","sun_riders","phuture_red","pl_kitchen"],
    /* /genre-tool:hogcore:clips */
  };

  // ---------- DX7 patch registry (the genre-space thesis applied to INSTRUMENTS) ----------
  // A patch is a point in a ~144-dim parameter space (per-operator envelopes,
  // levels, tuning — decoded from real cartridge banks by faust/sysex2params.js
  // into faust/dx7-presets.json). Anchors may declare a pad/lead/bass model
  // "dx7" plus a patchPool of names; resolveMulti picks per side() like every
  // other pool, and BLENDING two dx7 parents with the SAME algorithm lerps the
  // param vectors by weight — patch-space morphing, exactly like genre blending.
  // Different algorithms are different topologies: pick a side, never smear.
  // toState emits state.instruments.<voice>.dx7 = {algorithm, params} — the
  // contract the Faust engine consumes; the legacy csound path maps model
  // "dx7" to its closest legacy voice (see csd-engine mergedInstruments).
  const DX7_PATCHES=(()=>{
    let raw={};
    if(isNode){ try{ raw=require("./faust/dx7-presets.json"); }catch(e){} }
    else if(root.DX7_PRESETS) raw=root.DX7_PRESETS;   // browser: page may inline the presets
    const reg={};
    for(const [name,p] of Object.entries(raw||{}))
      if(p&&p.params) reg[name]={algorithm:p.alg, params:p.params};
    return reg;
  })();

  // ---------- per-voice insert FX (a NEW axis of the space) ----------
  // Anchors may give any voice (bass/lead/pads) an `inserts` spec:
  //   inserts:{ prob:.5, max:2, pool:[["distort",{drive:[.2,.5],mix:[.6,.9]}], ...] }
  // pool entries are [type, paramRanges] like every other recipe: ranges sample
  // seeded, scalars pass through. resolveMulti unions pools across parents by
  // weight (combinatorial, like kits/progressions) and BLENDS the param ranges
  // of parents that share a type (weighted, blendRecipe-style), then draws a
  // 0-2 entry chain. toState emits state.instruments.<voice>.inserts =
  // [{type, ...params}] — the Faust engine's contract (see csd-engine
  // defaultInstruments for units). Constraints live in constrain(): no distort
  // on already-fuzz leads, no chorus/phaser on sub bass, no filtersweep on
  // wobble (the wobble IS the sweep).
  const INSERT_DEFAULTS={
    distort:    { drive:0.3, mix:1 },
    phaser:     { rate:0.25, depth:0.6, mix:0.5 },
    chorus:     { rate:0.8,  depth:0.5, mix:0.5 },
    filtersweep:{ rateBars:4, lo:-1, hi:1, res:0.3 },
  };

  // ---------- SAMPLER instruments (real sampled instruments — the sax ask) ----------
  // Zones extracted from FluidR3_GM (Frank Wen, MIT license) by faust/sf2.js
  // at fetch time (fetch-found-samples.sh) into found/samples/instruments/.
  // This IS the answer to "can Faust play soundfonts": Faust's soundfile
  // primitive can't read SF2, so the ENGINE plays them natively — zone wavs
  // ride foundSources (vol 0) into the AudioBufferSourceNode / PCM-mix path
  // (faust/sampler.js), with SF2 loop points for proper sustained notes.
  // root may be fractional (SF2 coarse/fine tune folded in); ls/le = loop
  // start/end in samples at `sr`. Anchors opt in via voice model "sampler"
  // + samplerPool:[ids]; resolveMulti picks per side() like every pool.
  const SAMPLERS={
    // the blues batch (2026-07 "truly acoustic" pass): upright bass for the
    // BASS voice, real organs for comping pads. (GM 16 "DrawbarOrgan" was
    // rejected: FluidR3 gives it ONE zone rooted at C7 — chords would pitch
    // down 3-4 octaves into mud. Percussive Organ is the blues B3 anyway.)
    acoustic_bass: { label:"Acoustic Bass (FluidR3, MIT)", dir:"acoustic_bass", sr:44100, zones:[{file:"z00_r28.wav",root:28,lo:0,hi:28,loop:1,ls:76560,le:78701},{file:"z01_r36.wav",root:36,lo:30,hi:36,loop:1,ls:51742,le:52417},{file:"z02_r46.wav",root:46,lo:42,hi:46,loop:1,ls:43947,le:44705},{file:"z03_r54.wav",root:54,lo:47,hi:50,loop:1,ls:36227,le:36704},{file:"z04_r60.wav",root:60,lo:55,hi:60,loop:1,ls:42151,le:42657},{file:"z05_r72.wav",root:72,lo:67,hi:127,loop:1,ls:24106,le:24696}] },
    percussive_organ: { label:"Percussive Organ (FluidR3, MIT)", dir:"percussive_organ", sr:44100, zones:[{file:"z00_r39.wav",root:39,lo:0,hi:39,loop:0,ls:31226,le:100902},{file:"z01_r49.wav",root:49,lo:49,hi:49,loop:1,ls:19729,le:83951},{file:"z02_r56.wav",root:56,lo:55,hi:56,loop:1,ls:46308,le:114633},{file:"z03_r63.wav",root:63,lo:63,hi:65,loop:1,ls:16220,le:78232},{file:"z04_r80.wav",root:80,lo:77,hi:80,loop:1,ls:37396,le:99327},{file:"z05_r91.wav",root:91,lo:90,hi:108,loop:1,ls:33792,le:93185}] },
    rock_organ: { label:"Rock Organ (FluidR3, MIT)", dir:"rock_organ", sr:44100, zones:[{file:"z00_r44.wav",root:44,lo:0,hi:44,loop:1,ls:32179,le:99235},{file:"z01_r52.wav",root:52,lo:50,hi:52,loop:1,ls:65063,le:134049},{file:"z02_r60.wav",root:60,lo:59,hi:60,loop:1,ls:91800,le:164759},{file:"z03_r73.wav",root:73,lo:71,hi:73,loop:1,ls:64627,le:130198},{file:"z04_r81.wav",root:81,lo:80,hi:82,loop:1,ls:110122,le:237739},{file:"z05_r91.wav",root:91,lo:90,hi:108,loop:1,ls:16963,le:83958}] },
    bandoneon:{ label:"Bandoneon (FluidR3, MIT)", dir:"bandoneon", sr:44100, zones:[{file:"z00_r48.wav",root:48,lo:0,hi:60,loop:1,ls:16175,le:16849},{file:"z01_r66.wav",root:66,lo:61,hi:66,loop:1,ls:87376,le:282128},{file:"z02_r72.wav",root:72,lo:67,hi:72,loop:1,ls:70740,le:199184},{file:"z03_r78.wav",root:78,lo:73,hi:78,loop:1,ls:47466,le:143928},{file:"z04_r84.wav",root:84,lo:79,hi:84,loop:1,ls:15786,le:118880},{file:"z05_r90.wav",root:90,lo:85,hi:108,loop:1,ls:6830,le:49586}] },
    alto_sax: { label:"Alto Sax (FluidR3, MIT)", dir:"alto_sax", sr:44100, zones:[{file:"z00_r50.wav",root:49.75,lo:0,hi:51,loop:1,ls:20457,le:31130},{file:"z01_r56.wav",root:55.73,lo:56,hi:57,loop:1,ls:28825,le:38746},{file:"z02_r62.wav",root:61.68,lo:62,hi:63,loop:1,ls:28129,le:37918},{file:"z03_r68.wav",root:67.96,lo:68,hi:69,loop:1,ls:16586,le:26612},{file:"z04_r74.wav",root:73.92,lo:74,hi:75,loop:1,ls:21234,le:30669},{file:"z05_r80.wav",root:79.77,lo:80,hi:84,loop:1,ls:23480,le:32593}] },
    clarinet: { label:"Clarinet (FluidR3, MIT)", dir:"clarinet", sr:44100, zones:[{file:"z00_r52.wav",root:52.04,lo:0,hi:53,loop:1,ls:26055,le:27123},{file:"z01_r61.wav",root:61.13,lo:60,hi:62,loop:1,ls:14071,le:14387},{file:"z02_r68.wav",root:68.01,lo:66,hi:68,loop:1,ls:9362,le:10105},{file:"z03_r74.wav",root:74.16,lo:73,hi:74,loop:1,ls:5866,le:6238},{file:"z04_r78.wav",root:77.89,lo:77,hi:78,loop:1,ls:1943,le:2003},{file:"z05_r84.wav",root:83.96,lo:83,hi:127,loop:1,ls:3631,le:3800}] },
    flute: { label:"Flute (FluidR3, MIT)", dir:"flute", sr:44100, zones:[{file:"z00_r61.wav",root:61,lo:0,hi:62,loop:1,ls:29084,le:40192},{file:"z01_r67.wav",root:67,lo:66,hi:68,loop:1,ls:28411,le:38401},{file:"z02_r71.wav",root:70.98,lo:69,hi:71,loop:1,ls:16790,le:27137},{file:"z03_r78.wav",root:78.11,lo:76,hi:78,loop:1,ls:19435,le:29952},{file:"z04_r80.wav",root:80.11,lo:79,hi:81,loop:1,ls:11271,le:22016},{file:"z05_r90.wav",root:90.32,lo:85,hi:127,loop:1,ls:18767,le:29952}] },
    nylon_string_guitar: { label:"Nylon String Guitar (FluidR3, MIT)", dir:"nylon_string_guitar", sr:44100, zones:[{file:"z00_r40.wav",root:40.05,lo:0,hi:43,loop:1,ls:192810,le:193345},{file:"z01_r50.wav",root:50,lo:49,hi:53,loop:1,ls:198834,le:200036},{file:"z02_r59.wav",root:59.03,lo:59,hi:62,loop:1,ls:62185,le:62542},{file:"z03_r64.wav",root:63.98,lo:63,hi:67,loop:1,ls:39342,le:39879},{file:"z04_r71.wav",root:71.1,lo:71,hi:75,loop:1,ls:26621,le:27065},{file:"z05_r84.wav",root:84.13,lo:84,hi:127,loop:1,ls:19524,le:19817}] },
    steel_string_guitar: { label:"Steel String Guitar (FluidR3, MIT)", dir:"steel_string_guitar", sr:44100, zones:[{file:"z00_r40.wav",root:39.95,lo:0,hi:43,loop:1,ls:218317,le:220476},{file:"z01_r50.wav",root:49.99,lo:49,hi:53,loop:1,ls:186167,le:187369},{file:"z02_r59.wav",root:59,lo:59,hi:62,loop:1,ls:117803,le:118518},{file:"z03_r64.wav",root:64.03,lo:63,hi:67,loop:1,ls:64535,le:65604},{file:"z04_r71.wav",root:71.04,lo:71,hi:75,loop:1,ls:70810,le:71791},{file:"z05_r84.wav",root:84.13,lo:84,hi:127,loop:1,ls:19524,le:19817}] },
    strings: { label:"Strings (FluidR3, MIT)", dir:"strings", sr:44100, zones:[{file:"z00_r31.wav",root:31,lo:0,hi:31,loop:1,ls:56826,le:150523},{file:"z01_r40.wav",root:40,lo:38,hi:40,loop:1,ls:54138,le:140576},{file:"z02_r49.wav",root:49,lo:48,hi:51,loop:1,ls:75259,le:139523},{file:"z03_r64.wav",root:64,lo:63,hi:65,loop:1,ls:61102,le:159259},{file:"z04_r73.wav",root:73,lo:72,hi:74,loop:1,ls:14601,le:57396},{file:"z05_r83.wav",root:83,lo:82,hi:96,loop:1,ls:27892,le:59980}] },
    tenor_sax: { label:"Tenor Sax (FluidR3, MIT)", dir:"tenor_sax", sr:44100, zones:[{file:"z00_r47.wav",root:47,lo:0,hi:47,loop:1,ls:72330,le:82353},{file:"z01_r52.wav",root:52.1,lo:52,hi:53,loop:1,ls:59086,le:68400},{file:"z02_r58.wav",root:58.02,lo:58,hi:59,loop:1,ls:92132,le:103465},{file:"z03_r62.wav",root:62.13,lo:62,hi:63,loop:1,ls:120744,le:131639},{file:"z04_r69.wav",root:69.06,lo:68,hi:69,loop:1,ls:84884,le:95352},{file:"z05_r75.wav",root:75,lo:74,hi:127,loop:1,ls:83808,le:95073}] },
    trumpet: { label:"Trumpet (FluidR3, MIT)", dir:"trumpet", sr:44100, zones:[{file:"z00_r60.wav",root:64,lo:0,hi:66,loop:1,ls:7185,le:18296},{file:"z01_r60.wav",root:67,lo:67,hi:71,loop:1,ls:8026,le:16794},{file:"z02_r60.wav",root:72,lo:72,hi:75,loop:1,ls:14270,le:23202},{file:"z03_r60.wav",root:79,lo:76,hi:83,loop:1,ls:10629,le:19860},{file:"z04_r60.wav",root:88,lo:84,hi:90,loop:1,ls:11853,le:18555},{file:"z05_r60.wav",root:96,lo:91,hi:108,loop:1,ls:9248,le:18910}] },
    vibraphone: { label:"Vibraphone (FluidR3, MIT)", dir:"vibraphone", sr:44100, zones:[{file:"z00_r57.wav",root:57,lo:0,hi:57,loop:1,ls:14677,le:17684},{file:"z01_r66.wav",root:66,lo:64,hi:66,loop:1,ls:9361,le:9600},{file:"z02_r81.wav",root:81,lo:79,hi:81,loop:1,ls:4376,le:4627},{file:"z03_r88.wav",root:88,lo:86,hi:88,loop:1,ls:4649,le:4716},{file:"z04_r99.wav",root:99,lo:97,hi:99,loop:1,ls:5202,le:5343},{file:"z05_r107.wav",root:107,lo:104,hi:108,loop:1,ls:5894,le:6005}] },
    // the neoclassical batch (2026-07 deep pass): GM 0 "Yamaha Grand Piano"
    // zones, made FELT at extraction (3kHz lowpass baked into the zone wavs —
    // fetch-found-samples.sh); soft velocity/slow attack live in the recipe.
    // 10 zones (not 6): the lead sits exposed, so the midrange keymap is dense
    // enough that no note repitches more than ~6 semitones.
    felt_piano: { label:"Felt Piano (FluidR3 Yamaha Grand, MIT; felt = 3kHz lowpass at extraction)", dir:"felt_piano", sr:44100, zones:[{file:"z00_r26.wav",root:26,lo:0,hi:26,loop:1,ls:235512,le:302497},{file:"z01_r34.wav",root:34,lo:31,hi:34,loop:1,ls:178404,le:227453},{file:"z02_r42.wav",root:42,lo:39,hi:42,loop:1,ls:166050,le:214439},{file:"z03_r50.wav",root:50,lo:47,hi:50,loop:1,ls:106623,le:150964},{file:"z04_r58.wav",root:58,lo:55,hi:58,loop:1,ls:72608,le:120644},{file:"z05_r70.wav",root:70,lo:67,hi:70,loop:1,ls:70933,le:97968},{file:"z06_r78.wav",root:78,lo:75,hi:78,loop:1,ls:65471,le:104349},{file:"z07_r90.wav",root:90,lo:85,hi:90,loop:1,ls:55512,le:83140},{file:"z08_r99.wav",root:99,lo:95,hi:99,loop:1,ls:24558,le:24962},{file:"z09_r108.wav",root:108,lo:105,hi:108,loop:1,ls:16604,le:17548}] },
    // the liberalization batch (2026-07 "use the soundfont liberally"): the
    // orchestral shelf (trombone / muted trumpet / oboe / cello / harp /
    // celesta / french horns), keys (honky-tonk, bright grand, church organ,
    // marimba) and voices (ahh choir, harmonica, fretless bass, jazz guitar).
    // These widen samplerPools across the anchors AND supply the transition
    // micro-lick instruments (LICKS below). Recipe: fetch-found-samples.sh.
    trombone: { label:"Trombone (FluidR3, MIT)", dir:"trombone", sr:44100, zones:[{file:"z00_r43.wav",root:42.9,lo:0,hi:43,loop:1,ls:28139,le:28592},{file:"z01_r48.wav",root:47.84,lo:47,hi:48,loop:1,ls:20650,le:21331},{file:"z02_r58.wav",root:58.06,lo:55,hi:58,loop:1,ls:19822,le:20388},{file:"z03_r63.wav",root:62.92,lo:61,hi:63,loop:1,ls:21423,le:22135},{file:"z04_r70.wav",root:70.06,lo:68,hi:70,loop:1,ls:8944,le:9227},{file:"z05_r75.wav",root:75.23,lo:73,hi:96,loop:1,ls:9562,le:9772}] },
    muted_trumpet: { label:"Muted Trumpet (FluidR3, MIT)", dir:"muted_trumpet", sr:44100, zones:[{file:"z00_r54.wav",root:54,lo:0,hi:59,loop:1,ls:27924,le:29594},{file:"z01_r60.wav",root:60,lo:60,hi:65,loop:1,ls:15449,le:17135},{file:"z02_r66.wav",root:66,lo:66,hi:70,loop:1,ls:19658,le:20850},{file:"z03_r72.wav",root:72,lo:71,hi:74,loop:1,ls:9831,le:10506},{file:"z04_r78.wav",root:78,lo:75,hi:78,loop:1,ls:6908,le:7564},{file:"z05_r84.wav",root:84,lo:79,hi:96,loop:1,ls:13101,le:19557}] },
    oboe: { label:"Oboe (FluidR3, MIT)", dir:"oboe", sr:44100, zones:[{file:"z00_r63.wav",root:63.08,lo:0,hi:63,loop:1,ls:29362,le:38401},{file:"z01_r64.wav",root:64.27,lo:64,hi:65,loop:1,ls:20857,le:29697},{file:"z02_r67.wav",root:67.26,lo:66,hi:68,loop:1,ls:20252,le:28673},{file:"z03_r74.wav",root:74.26,lo:72,hi:75,loop:1,ls:18961,le:26880},{file:"z04_r79.wav",root:79.32,lo:76,hi:79,loop:1,ls:19434,le:28161},{file:"z05_r82.wav",root:81.98,lo:80,hi:96,loop:1,ls:19744,le:28928}] },
    cello: { label:"Cello (FluidR3, MIT)", dir:"cello", sr:44100, zones:[{file:"z00_r37.wav",root:37.1,lo:0,hi:39,loop:1,ls:78629,le:88149},{file:"z01_r46.wav",root:45.91,lo:46,hi:48,loop:1,ls:66854,le:76368},{file:"z02_r58.wav",root:58,lo:58,hi:60,loop:1,ls:52797,le:62449},{file:"z03_r67.wav",root:67,lo:67,hi:69,loop:1,ls:58773,le:66648},{file:"z04_r79.wav",root:78.86,lo:79,hi:81,loop:1,ls:49141,le:57720},{file:"z05_r88.wav",root:87.93,lo:88,hi:117,loop:1,ls:66222,le:74043}] },
    harp: { label:"Harp (FluidR3, MIT)", dir:"harp", sr:44100, zones:[{file:"z00_r34.wav",root:34,lo:0,hi:39,loop:1,ls:52377,le:53889},{file:"z01_r54.wav",root:54,lo:51,hi:55,loop:1,ls:51328,le:52278},{file:"z02_r61.wav",root:61,lo:60,hi:62,loop:1,ls:30340,le:30977},{file:"z03_r70.wav",root:70,lo:69,hi:71,loop:1,ls:25472,le:25851},{file:"z04_r78.wav",root:78,lo:76,hi:81,loop:1,ls:18866,le:19105},{file:"z05_r102.wav",root:102,lo:102,hi:108,loop:1,ls:8909,le:9264}] },
    celesta: { label:"Celesta (FluidR3, MIT)", dir:"celesta", sr:44100, zones:[{file:"z00_r54.wav",root:54,lo:0,hi:59,loop:1,ls:25359,le:26312},{file:"z01_r60.wav",root:60,lo:60,hi:65,loop:1,ls:19225,le:19562},{file:"z02_r72.wav",root:72,lo:72,hi:77,loop:1,ls:22571,le:23245},{file:"z03_r78.wav",root:78,lo:78,hi:83,loop:1,ls:21396,le:21873},{file:"z04_r90.wav",root:90,lo:90,hi:95,loop:1,ls:9497,le:9884},{file:"z05_r96.wav",root:96,lo:96,hi:108,loop:1,ls:11684,le:11705}] },
    ahh_choir: { label:"Ahh Choir (FluidR3, MIT)", dir:"ahh_choir", sr:44100, zones:[{file:"z00_r39.wav",root:39,lo:0,hi:39,loop:1,ls:53350,le:90898},{file:"z01_r48.wav",root:48,lo:46,hi:48,loop:1,ls:62798,le:132963},{file:"z02_r57.wav",root:57,lo:55,hi:57,loop:1,ls:40321,le:115053},{file:"z03_r63.wav",root:63,lo:61,hi:63,loop:1,ls:46393,le:108508},{file:"z04_r72.wav",root:72,lo:70,hi:72,loop:1,ls:24795,le:73216},{file:"z05_r81.wav",root:81,lo:79,hi:96,loop:1,ls:36668,le:102348}] },
    fretless_bass: { label:"Fretless Bass (FluidR3, MIT)", dir:"fretless_bass", sr:44100, zones:[{file:"z00_r28.wav",root:27.96,lo:0,hi:28,loop:1,ls:137065,le:138139},{file:"z01_r31.wav",root:31.03,lo:29,hi:31,loop:1,ls:127123,le:129828},{file:"z02_r38.wav",root:38.14,lo:35,hi:38,loop:1,ls:80403,le:80999},{file:"z03_r44.wav",root:44.15,lo:39,hi:44,loop:1,ls:57712,le:58976},{file:"z04_r62.wav",root:62.12,lo:49,hi:84,loop:1,ls:62040,le:62789},{file:"z05_r76.wav",root:75.96,lo:0,hi:84,loop:1,ls:29,le:96}] },
    harmonica: { label:"Harmonica (FluidR3, MIT)", dir:"harmonica", sr:44100, zones:[{file:"z00_r48.wav",root:48,lo:0,hi:60,loop:1,ls:16175,le:16849},{file:"z01_r64.wav",root:64,lo:61,hi:65,loop:1,ls:16326,le:17664},{file:"z02_r72.wav",root:72,lo:70,hi:72,loop:1,ls:17099,le:17352},{file:"z03_r76.wav",root:76,lo:73,hi:76,loop:1,ls:15704,le:16507},{file:"z04_r84.wav",root:84,lo:81,hi:84,loop:1,ls:16500,le:16879},{file:"z05_r88.wav",root:88,lo:85,hi:96,loop:1,ls:16280,le:16748}] },
    church_organ: { label:"Church Organ (FluidR3, MIT)", dir:"church_organ", sr:44100, zones:[{file:"z00_r36.wav",root:36,lo:0,hi:36,loop:1,ls:49044,le:122496},{file:"z01_r48.wav",root:48,lo:46,hi:48,loop:1,ls:114672,le:219938},{file:"z02_r60.wav",root:60,lo:58,hi:60,loop:1,ls:90944,le:180760},{file:"z03_r72.wav",root:72,lo:70,hi:72,loop:1,ls:27494,le:115968},{file:"z04_r84.wav",root:84,lo:82,hi:84,loop:1,ls:27266,le:109952},{file:"z05_r96.wav",root:96,lo:94,hi:96,loop:1,ls:35788,le:102578}] },
    honky_tonk: { label:"Honky-Tonk Piano (FluidR3, MIT)", dir:"honky_tonk", sr:44100, zones:[{file:"z00_r26.wav",root:26,lo:0,hi:26,loop:1,ls:235512,le:302497},{file:"z01_r42.wav",root:42,lo:39,hi:42,loop:1,ls:166050,le:214439},{file:"z02_r58.wav",root:58,lo:55,hi:58,loop:1,ls:72608,le:120644},{file:"z03_r70.wav",root:70,lo:67,hi:70,loop:1,ls:70933,le:97968},{file:"z04_r90.wav",root:90,lo:85,hi:90,loop:1,ls:55512,le:83140},{file:"z05_r108.wav",root:108,lo:105,hi:108,loop:1,ls:16604,le:17548}] },
    french_horns: { label:"French Horns (FluidR3, MIT)", dir:"french_horns", sr:44100, zones:[{file:"z00_r39.wav",root:39,lo:0,hi:40,loop:1,ls:62667,le:128232},{file:"z01_r45.wav",root:45,lo:41,hi:46,loop:1,ls:53547,le:132097},{file:"z02_r51.wav",root:51,lo:47,hi:52,loop:1,ls:57345,le:186331},{file:"z03_r63.wav",root:63,lo:59,hi:64,loop:1,ls:92753,le:221698},{file:"z04_r69.wav",root:69,lo:65,hi:70,loop:1,ls:50785,le:116044},{file:"z05_r75.wav",root:75,lo:71,hi:96,loop:1,ls:31744,le:136706}] },
    jazz_guitar: { label:"Jazz Guitar (FluidR3, MIT)", dir:"jazz_guitar", sr:44100, zones:[{file:"z00_r40.wav",root:40.12,lo:0,hi:40,loop:1,ls:75946,le:77010},{file:"z01_r45.wav",root:45.26,lo:44,hi:45,loop:1,ls:63390,le:64970},{file:"z02_r50.wav",root:50.22,lo:49,hi:50,loop:1,ls:110634,le:112710},{file:"z03_r59.wav",root:59.25,lo:56,hi:60,loop:1,ls:81598,le:82126},{file:"z04_r69.wav",root:69.45,lo:65,hi:69,loop:1,ls:34360,le:36804},{file:"z05_r79.wav",root:79.42,lo:75,hi:96,loop:1,ls:39496,le:41638}] },
    bright_yamaha_grand: { label:"Bright Grand Piano (FluidR3, MIT)", dir:"bright_yamaha_grand", sr:44100, zones:[{file:"z00_r26.wav",root:26,lo:0,hi:26,loop:1,ls:235512,le:302497},{file:"z01_r42.wav",root:42,lo:39,hi:42,loop:1,ls:166050,le:214439},{file:"z02_r58.wav",root:58,lo:55,hi:58,loop:1,ls:72608,le:120644},{file:"z03_r70.wav",root:70,lo:67,hi:70,loop:1,ls:70933,le:97968},{file:"z04_r90.wav",root:90,lo:85,hi:90,loop:1,ls:55512,le:83140},{file:"z05_r108.wav",root:108,lo:105,hi:108,loop:1,ls:16604,le:17548}] },
    marimba: { label:"Marimba (FluidR3, MIT)", dir:"marimba", sr:44100, zones:[{file:"z00_r48.wav",root:48,lo:0,hi:53,loop:0,ls:8,le:95224},{file:"z01_r60.wav",root:60,lo:54,hi:65,loop:0,ls:8,le:75896},{file:"z02_r66.wav",root:66,lo:66,hi:71,loop:0,ls:8,le:74090},{file:"z03_r72.wav",root:72,lo:72,hi:77,loop:0,ls:8,le:58616},{file:"z04_r78.wav",root:78,lo:78,hi:83,loop:0,ls:8,le:58020},{file:"z05_r84.wav",root:84,lo:84,hi:108,loop:0,ls:8,le:52728}] },
  };

  // ---------- the anchors ----------
  const GENRES = {
    techno: { label:"Techno", info:"rhythm over harmony: drones, machine four, DJ plateaus",   // SYNTH-FORWARD: samples are texture, not the hook
      bpm:[124,140], swing:[0,0.06], humanize:[0,0.15],
      progressions:["drone_min","deep_two"], kits:["techno","pulse"], fills:["off","riser","cut","hat rush"],
      euclid:{hat:[7,16]},   // E(7,16) rotating closed-hat undergrid beneath the machine four (opens survive)
      bass:{patterns:["rolling","stab","sixteenths","pedal"], recipe:{model:["acid","saw","reese"],cutoff:[450,800],res:[.2,.35],level:[1.0,1.2],send:[0,.08],dsend:[0,.1]},
        inserts:{prob:.45, max:2, pool:[["filtersweep",{rateBars:[2,4],lo:[-1.2,-.6],hi:[.8,1.4],res:[.25,.45]}],["distort",{drive:[.15,.35],mix:[.5,.8]}]]}},   // the warehouse: slow acid-line sweeps, a touch of drive
      lead:{patterns:["double","double","arpup","off"], recipe:{model:["pluck","stack"],wave:"square",voices:[1,2],spread:[.002,.006],cutoff:[1500,2600],level:[.3,.42],send:[.15,.3],dsend:[.2,.4],vibrato:[0,.002]}},
      pads:{prob:.3, recipe:{model:["organ","saw"],wave:"saw",cutoff:[550,900],detune:[.004,.01],attack:[1.5,3],level:[.3,.45],send:[.3,.5],dsend:[.1,.2]}},   // dark low pad, mostly ABSENT — no royal-road wash here
      drums:{kickModel:["909"],snareModel:["clap","crack"],hatModel:["metal","noise"],kick:[1.25,1.5],snare:[.55,.8],hat:[.7,1],tune:[.95,1.1],send:[.05,.15],dsend:[.1,.25]},
      fx:{reverb:[.35,.55], delayBeats:[.5,.75], delayFb:[.3,.45], delayCut:[2000,3500], pump:[.4,.65], crackle:[0,.1], lowcut:[35,50], highcut:[0,0], comp:[.5,.7], grit:[.2,.45], jux:[.15,.35]},
      found:{role:"chops", vol:[.1,.18], pitch:[.9,1.1], stretch:[.4,.6], cutoff:[1800,3200], sources:["factory","shibuya","vx_wwvh"]},
      stab:["offbeat","offbeat","rave","sparse"], hits:{sources:["vox_b","rave_a","sp_system","sp_energy"], pattern:"sparse", prob:.5},
      form:"dj" },
    house: { label:"House", info:"Chicago house: four-on-floor + claps + open-hat offbeats, warm organ stabs, piano color, min7 sevenths",   // sample-mid: chops present, synths carry
      bpm:[120,126], swing:[.08,.15], humanize:[.05,.18],
      progressions:["house_min7","lofi","deep_two"], kits:["house","house","four"], fills:["off","hat rush","riser"],
      bass:{patterns:["rolling","stab","melodic","syncopated"], patchPool:["SYN-BASS 2"], recipe:{model:["saw","sub","dx7"],cutoff:[380,700],res:[.15,.3],level:[1.0,1.2],send:[0,.08],dsend:[0,.05]}},   // ~1/3 of seeds: the DX7 SYN-BASS 2 patch (Faust engine; csound maps -> sub); syncopated = the push-pull jack
      lead:{patterns:["double","pentaup","arpup","off"], recipe:{model:["piano","fm"],wave:"pulse",voices:[1,3],spread:[.003,.008],cutoff:[2200,3400],level:[.4,.52],send:[.25,.4],dsend:[.2,.35]},
        inserts:{prob:.4, max:1, pool:[["chorus",{rate:[.6,1.2],depth:[.4,.6],mix:[.35,.55]}]]}},   // piano riffs — the Marshall Jefferson move (the '88 piano got a chorus box)
      pads:{prob:.9, patchPool:["E.ORGAN 1","SYNORGAN 1"], samplerPool:["percussive_organ"], recipe:{model:["organ","organ","dx7","sampler"],wave:"saw",cutoff:[1000,1600],detune:[.004,.009],attack:[.15,.4],level:[.5,.65],send:[.25,.4],dsend:[.1,.25]}},   // ORGAN STABS: fast attack = stabby, not washy; ~1/3 the real DX7 organs
      drums:{kickModel:["909","boom"],snareModel:["clap"],hatModel:["noise"],kick:[1.15,1.4],snare:[.6,.85],hat:[1.0,1.3],tune:[.95,1.1],send:[.1,.25],dsend:[.05,.15]},   // hats UP — the open-hat offbeat must be heard
      fx:{reverb:[.4,.6], delayBeats:[.375,.75], delayFb:[.25,.4], delayCut:[2500,4000], pump:[.35,.5], crackle:[0,.15], lowcut:[30,45], highcut:[0,0], comp:[.4,.6]},
      found:{role:"chops", vol:[.1,.18], pitch:[.95,1.1], stretch:[.4,.6], cutoff:[2200,3600], sources:["shibuya","tokyo_station","vx_timelady"]},
      stab:["rave","offbeat"], hits:{sources:["rave_b","rave_c","vox_a","sp_rhythm"], pattern:"offbeat", prob:.55},
      form:"dj" },
    jungle: { label:"Jungle", info:"chopped breaks, sub pressure, rhythm-as-melody, dub space",   // SAMPLE-FORWARD: the amen IS the track
      bpm:[158,172], swing:[0,.08], humanize:[.1,.25],
      progressions:["deep_two","drone_min","minor_run"], kits:["jungle","breaks"], fills:["break fill","break fill","reverse","off"],
      euclid:{kick:[3,16]},   // E(3,16) tresillo kicks rotating under the amen — breakbeat kick science
      bass:{patterns:["sub","dub"], recipe:{model:["sub","reese"],cutoff:[260,480],res:[.05,.2],level:[1.2,1.45],send:[0,.05],dsend:[0,0]},
        inserts:{prob:.3, max:1, pool:[["distort",{drive:[.15,.35],mix:[.4,.7]}]]}},   // reese seeds get teeth (sub seeds stay clean via constrain)
      lead:{patterns:["off","off","sparse","pentaup"], recipe:{model:["pluck","fm"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1600,2800],level:[.3,.42],send:[.3,.5],dsend:[.3,.5]}},
      pads:{prob:.25, recipe:{model:["saw","organ"],wave:"saw",cutoff:[500,850],detune:[.005,.012],attack:[2,3.5],level:[.3,.42],send:[.45,.65],dsend:[.15,.3]}},   // dark, mostly ABSENT — no soft royal-road wash under the amen
      drums:{kickModel:["808"],snareModel:["crack"],hatModel:["noise"],kick:[1.15,1.4],snare:[.6,.85],hat:[.4,.7],tune:[1.0,1.15],send:[.05,.15],dsend:[.35,.6]},
      fx:{reverb:[.35,.55], delayBeats:[.75,1.5], delayFb:[.4,.6], delayCut:[1800,3000], pump:[0,.15], crackle:[.05,.2], lowcut:[25,40], highcut:[0,0], comp:[.35,.55], grit:[.15,.35], jux:[.25,.5]},
      found:{role:"break", vol:[.3,.45], pitch:[1,1], stretch:[.5,.5], cutoff:[6000,9000], sources:["amen_165","amen_170","amen_172","amen_175"]},   // the BREAK DOMINATES: loud + wide open, real sampled drums not "light FM"
      stab:["off","sparse"], hits:{sources:["vox_a","rave_d","sp_rewind","sp_pressure"], pattern:"dub", prob:.75},
      form:"dj" },
    triphop: { label:"Trip hop", info:"slowed dusty breaks, jazz color, melancholy, dub weight",   // SAMPLE-FORWARD
      bpm:[72,92], swing:[.15,.3], humanize:[.2,.45],
      progressions:["neosoul","lofi","minor_run","mode_dorian"], kits:["boombap","breaks","halftime"], fills:["off","drum fill","downlift"],
      bass:{patterns:["dub","simple","sub"], samplerPool:["acoustic_bass"], recipe:{model:["sub","saw","sampler"],cutoff:[300,600],res:[.05,.2],level:[1.0,1.25],send:[.05,.12],dsend:[0,.1]}},
      lead:{patterns:["sparse","wander","off"], patchPool:["E.PIANO 2"], samplerPool:["muted_trumpet","tenor_sax"], recipe:{model:["fm","dx7","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.006],cutoff:[1800,3000],level:[.4,.52],send:[.4,.6],dsend:[.3,.5],vibrato:[.004,.01]}},   // ~1/3: the tine EP through the dust
      pads:{prob:.85, samplerPool:["strings"], recipe:{model:["fm","strings","sampler"],wave:"sine",cutoff:[800,1400],detune:[.004,.01],attack:[1,2.5],level:[.5,.68],send:[.45,.65],dsend:[.15,.3]},
        inserts:{prob:.35, max:1, pool:[["phaser",{rate:[.06,.18],depth:[.4,.6],mix:[.3,.5]}]]}},   // a slow smoky phase on the strings
      drums:{kickModel:["808","boom"],snareModel:["noise","crack"],hatModel:["noise"],kick:[1.05,1.3],snare:[.65,.9],hat:[.5,.8],tune:[.8,.95],send:[.15,.3],dsend:[.15,.35]},
      fx:{reverb:[.6,.78], delayBeats:[.75,1.5], delayFb:[.3,.5], delayCut:[1500,2600], pump:[0,.1], crackle:[.35,.6], lowcut:[0,30], highcut:[9000,14000], comp:[.25,.4]},
      found:{role:"break", vol:[.18,.3], pitch:[1,1], stretch:[.5,.5], cutoff:[3800,5500], sources:["amen_165","amen_170"]},
      stab:["off"], hits:{sources:["vox_b","blues_vox_78","sp_slowdown"], pattern:"sparse", prob:.55},
      form:"pop" },
    vaporwave: { label:"Vaporwave", info:"slowed mall nostalgia: maj7 city-pop harmony, drenched reverb, found sound",   // SAMPLE-FORWARD: the bed is the place
      bpm:[62,88], swing:[0,.12], humanize:[.05,.25],
      progressions:["royal_road","dream","pop_1625","neosoul"], kits:["full","open","halftime"], fills:["drum fill","riser","downlift","off"],
      bass:{patterns:["simple","walking","root"], recipe:{model:["saw"],cutoff:[500,900],res:[.1,.25],level:[.9,1.1],send:[.05,.15],dsend:[0,.1]}},
      lead:{patterns:["composed","composed2","arpup","wander"], patchPool:["E.PIANO 1","TUB BELLS","E.PIANO 4","SHIMMER"], samplerPool:["alto_sax","tenor_sax"], recipe:{model:["stack","stack","dx7","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.003,.006],cutoff:[2800,4000],level:[.4,.52],send:[.4,.6],dsend:[.2,.4],vibrato:[.004,.009]},
        inserts:{prob:.5, max:1, pool:[["chorus",{rate:[.5,1.1],depth:[.5,.7],mix:[.4,.6]}]]}},   // DX7 shelf all alg 5 -> blends MORPH between them; 1/4: THE mall sax (sampled, real) — the slowed-down smooth-jazz ghost
      pads:{prob:1, samplerPool:["ahh_choir","strings"], recipe:{model:["saw","choir","strings","sampler"],wave:"saw",cutoff:[1100,1800],detune:[.004,.009],attack:[1.2,2.4],level:[.6,.8],send:[.5,.7],dsend:[.1,.25]},
        inserts:{prob:.55, max:1, pool:[["chorus",{rate:[.2,.5],depth:[.5,.75],mix:[.4,.6]}]]}},   // dreampop-wash chorus on the pad bed
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.9,1.15],snare:[.6,.85],hat:[.75,1.05],tune:[.95,1.1],send:[.15,.3],dsend:[0,.1]},
      fx:{reverb:[.8,.92], delayBeats:[.75,1.5], delayFb:[.25,.4], delayCut:[2200,3200], pump:[0,.1], crackle:[.05,.3], lowcut:[0,0], highcut:[0,0], comp:[0,.15]},
      found:{role:"bed", vol:[.18,.28], pitch:[.7,.85], stretch:[.4,.55], cutoff:[2200,3200], sources:["tokyo_station","shibuya","iriomote","vx_timelady","vx_conet_swedish","vx_wwvh"]},
      stab:["off"], hits:{sources:["sp_plaza","sp_shopping","vox_b"], pattern:"sparse", prob:.5},
      form:"pop" },
    synthwave: { label:"Synthwave", info:"night-drive pulse, supersaw leads, gated drums, minor keys",   // SYNTH-FORWARD: beds distant
      bpm:[88,116], swing:[0,.05], humanize:[.05,.15],
      progressions:["synthwave","epic_min","andalusian","minor_run"], kits:["pulse","four","open"], fills:["tom fill","tom fill","riser","off"],
      bass:{patterns:["drive","octaves","sixteenths","pedal"], recipe:{model:["saw","reese"],cutoff:[550,900],res:[.15,.3],level:[1.1,1.3],send:[0,.08],dsend:[0,0]}},
      lead:{patterns:["hero","updown","arpdown","anthem"], recipe:{model:["stack","modeld"],wave:"saw",voices:[5,7],spread:[.01,.018],cutoff:[2600,3600],level:[.45,.6],send:[.35,.55],dsend:[.25,.4],vibrato:[.002,.005],
        glide:[60,150],envAmount:[1,1.8],envDecay:[.15,.3],oscMix:[.15,.5],drift:[4,9],drive:[.1,.3]}},   // half the seeds: THE fat mono Model-D hero lead, gliding between legato notes (stack ignores the modeld keys)
      pads:{prob:1, recipe:{model:["saw"],wave:"saw",cutoff:[1100,2200],detune:[.01,.018],attack:[1.2,2.4],level:[.65,.85],send:[.45,.65],dsend:[.15,.3]},
        inserts:{prob:.6, max:1, pool:[["phaser",{rate:[.08,.25],depth:[.5,.8],mix:[.4,.6]}]]}},   // the night-drive pad breathes through a phaser — the genre's shimmer
      drums:{kickModel:["909","boom"],snareModel:["noise"],hatModel:["noise"],kick:[1.2,1.45],snare:[.9,1.15],hat:[.4,.65],tune:[.85,1],send:[.45,.65],dsend:[.05,.15]},
      fx:{reverb:[.75,.88], delayBeats:[.5,.75], delayFb:[.25,.4], delayCut:[1800,2800], pump:[.15,.35], crackle:[0,.1], lowcut:[30,45], highcut:[0,0], comp:[.25,.4]},
      found:{role:"bed", vol:[.08,.14], pitch:[.65,.8], stretch:[.45,.6], cutoff:[1000,1800], sources:["highway_night","factory","vx_apollo"]},
      stab:["off","sparse"], hits:{sources:["vox_a","sp_nightdrive"], pattern:"sparse", prob:.3},
      form:"pop" },
    lofi: { label:"Lo-fi", info:"dusty boombap, jazzy 7ths, crackle, everything softened",   // SAMPLE-FORWARD
      bpm:[72,88], swing:[.18,.32], humanize:[.25,.5],
      progressions:["lofi","neosoul","ii_v_i","pop_1625"], kits:["boombap","halftime"], fills:["off","off","drum fill"],
      bass:{patterns:["simple","dub","root"], recipe:{model:["sub","saw"],cutoff:[350,650],res:[.05,.15],level:[.9,1.1],send:[.05,.12],dsend:[0,.05]}},
      lead:{patterns:["pentaup","sparse","wander"], patchPool:["E.PIANO 1","E.PIANO 3"], samplerPool:["alto_sax","felt_piano"], recipe:{model:["fm","pluck","dx7","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1800,2800],level:[.4,.52],send:[.35,.5],dsend:[.2,.35],vibrato:[.005,.012]},
        inserts:{prob:.4, max:1, pool:[["chorus",{rate:[.3,.8],depth:[.5,.8],mix:[.35,.55]}]]}},   // ~1/3: DX7 E.PIANO 1 through the dust (csound maps -> fm); deep slow chorus = tape wow; sampler draws split sax / the felt piano (2026-07)
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
      lead:{patterns:["sparse","off","wander"], patchPool:["E.PIANO 3","E.PIANO 4"], samplerPool:["flute","muted_trumpet"], recipe:{model:["fm","dx7","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[2000,3000],level:[.4,.5],send:[.45,.65],dsend:[.3,.45],vibrato:[.003,.008]}},   // warm tine EPs (alg-5 pair -> morphable)
      pads:{prob:1, samplerPool:["strings"], recipe:{model:["organ","saw","sampler"],wave:"saw",cutoff:[800,1400],detune:[.005,.011],attack:[2,4],level:[.6,.78],send:[.5,.7],dsend:[.15,.3]},
        inserts:{prob:.3, max:1, pool:[["phaser",{rate:[.05,.15],depth:[.4,.6],mix:[.3,.5]}]]}},   // barely-moving phase — patience as an effect
      drums:{kickModel:["808","boom"],snareModel:["noise"],hatModel:["noise"],kick:[.95,1.2],snare:[.5,.75],hat:[.45,.75],tune:[.85,1],send:[.2,.35],dsend:[.05,.2]},
      fx:{reverb:[.72,.88], delayBeats:[.75,1.5], delayFb:[.3,.5], delayCut:[1800,2800], pump:[0,.15], crackle:[.1,.3], lowcut:[0,25], highcut:[0,0], comp:[.15,.3]},
      found:{role:"bed", vol:[.14,.24], pitch:[.7,.9], stretch:[.45,.6], cutoff:[1800,2800], sources:["iriomote","highway_night","vx_apollo"]},
      stab:["off"], hits:{sources:["vox_b","sp_herenow"], pattern:"sparse", prob:.2},
      form:"pop" },
    ambient: { label:"Ambient", info:"beatless drift: drones, place recordings, enormous reverb",
      bpm:[58,72], swing:[0,0], humanize:[.1,.3],
      progressions:["dream","deep_two","drone_min","mode_lydian"], kits:["off","off","kick"], fills:["off"],
      bass:{patterns:["off","off","root"], recipe:{model:["sub"],cutoff:[250,450],res:[.05,.1],level:[.7,.95],send:[.2,.4],dsend:[0,.1]}},
      lead:{patterns:["off","sparse"], samplerPool:["harp"], recipe:{model:["fm","stack","sampler"],wave:"sine",voices:[1,2],spread:[.002,.004],cutoff:[2000,3200],level:[.3,.45],send:[.6,.8],dsend:[.3,.5],vibrato:[.002,.006]}},
      pads:{prob:1, patchPool:["TUB BELLS","SHIMMER","WATER GDN"], samplerPool:["ahh_choir","harp"], recipe:{model:["organ","dx7","sampler","sampler"],wave:"saw",cutoff:[600,1200],detune:[.006,.014],attack:[3,5],level:[.65,.85],send:[.65,.85],dsend:[.15,.3]},
        inserts:{prob:.4, max:2, pool:[["chorus",{rate:[.1,.3],depth:[.4,.7],mix:[.3,.5]}],["filtersweep",{rateBars:[8,16],lo:[-.8,-.3],hi:[.5,1],res:[.1,.25]}]]}},   // ~1/3: DX7 TUB BELLS in the enormous reverb (csound maps -> bell); glacial chorus / 8-16-bar sweeps — the drone breathes
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
      lead:{patterns:["wander","updown","pentaup"], patchPool:["HORNS","BRASSHORNS"], samplerPool:["french_horns"], recipe:{model:["brass","dx7","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1500,2600],level:[.36,.5],send:[.55,.78],dsend:[.3,.5],vibrato:[.004,.01]}},   // warm theme (no inharmonic bell-FM); ~1/3 DX7 horns (alg-18 pair -> morphable)
      pads:{prob:1, samplerPool:["ahh_choir"], recipe:{model:["choir","strings","saw","sampler"],wave:"saw",cutoff:[700,1300],detune:[.006,.014],attack:[2.5,4.5],level:[.62,.82],send:[.6,.82],dsend:[.15,.3]}},
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
      lead:{patterns:["arp16"], recipe:{model:["kpluck"],wave:"saw",drive:.45,cutoff:[3000,3800],level:[.62,.74],send:[.16,.26],dsend:[.46,.56]},
        inserts:{prob:.8, max:1, pool:[["chorus",{rate:[.7,1.1],depth:[.45,.65],mix:[.45,.6]}]]}},   // THE lead = octave-lower octave-doubled 16th arp, distortion + chorus + 1/4T echo (Edge), BIGGER — the chorus box is now a real insert
      pads:{prob:1, samplerPool:["church_organ"], recipe:{model:["organ","organ","sampler"],wave:"saw",cutoff:[1500,2200],detune:[.004,.008],attack:[.3,.7],level:[.4,.52],send:[.16,.26],dsend:[0,.06]}},   // organ, supportive (behind)
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
      lead:{patterns:["motorik"], recipe:{model:["stack"],wave:"square",voices:[1,2],spread:[.004,.009],cutoff:[2000,2800],res:[.46,.6],octave:0,drive:[.4,.6],attack:.003,release:[.05,.08],sustain:[.55,.68],fenv:[1.2,1.9],level:[.52,.64],send:[.22,.32],dsend:[.36,.5],swellHz:.13,swellDepth:.45,swellPhase:0},
        inserts:{prob:.4, max:1, pool:[["phaser",{rate:[.15,.4],depth:[.5,.7],mix:[.35,.55]}]]}},   // Kraftwerk sequencer: RAW square (1-2 osc, pure), MORE BITE (more drive + brighter + sharper filter sweep), staccato 8th notes; breathes up/down via swell; smoothed by delay+reverb; sometimes phased — Autobahn's whoosh
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
    neoclassical: { label:"Neoclassical", info:"felt piano, slow counterpoint, strings swelling underneath, key thunks, rubato",
      // 2026-07 deep pass: the genre's VOICE is now a real sampled felt piano
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
      pads:{prob:.7, samplerPool:["strings"], recipe:{model:["sampler","sampler","sampler","piano"],wave:"sine",cutoff:[1000,1800],detune:[.002,.005],attack:[.8,2.5],release:[1.5,3],swell:1,level:[.38,.55],send:[.4,.6],dsend:[0,.1]}},   // sampled strings DOMINANT (3/4), SWELLING per phrase; organ purged
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.5,.8],snare:[.4,.6],hat:[.3,.5],tune:[.9,1],send:[.2,.4],dsend:[0,0]},
      fx:{reverb:[.5,.7], delayBeats:[.75,1.5], delayFb:[.15,.3], delayCut:[2000,3000], pump:[0,0], crackle:[0,.35], lowcut:[0,0], highcut:[0,0], comp:[0,.15]},   // reverb DOWN a notch (was .6-.8): felt piano is a close mic, not a cathedral
      found:{role:"bed", vol:[.06,.14], pitch:[.7,.9], stretch:[.45,.6], cutoff:[1800,2800], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[.02,.04], periodBars:[2,4], prob:1},   // ALWAYS breathes (state.rubato — the beat-warp in csd-engine buildEvents)
      counterpoint:{prob:.66},   // second quiet piano voice, octave below, contrary/oblique (resolveMulti -> wave form)
      thunk:{prob:[.2,.35], amp:[.026,.038]},   // soft key/pedal noise on that fraction of lead notes, ~-30dB
      stab:["off"], hits:{sources:["sp_herenow"], pattern:"sparse", prob:.1},
      form:"wave" },
    dancepop: { label:"Dance pop", info:"New Order-ish: melodic synth bass up high, bright leads, big pop changes",   // SYNTH-FORWARD
      bpm:[116,128], swing:[0,.1], humanize:[.05,.2],
      progressions:["four_chords","sad_pop","doo_wop"], kits:["four","pulse","open"], fills:["drum fill","tom fill","riser","snare roll"],
      bass:{patterns:["octaves","melodic","drive","syncopated"], patchPool:["SYN-BASS 2","BASS    2"], recipe:{model:["saw","saw","dx7"],cutoff:[900,1500],res:[.1,.25],level:[1.05,1.25],send:[.05,.15],dsend:[0,.1]}},   // ~1/3 the DX7 synth-bass pair (alg 17 both -> morphable) — the New Order hook machine
      lead:{patterns:["hero","updown","pentaup","double"], recipe:{model:["brass","stack"],wave:"saw",voices:[3,5],spread:[.006,.012],cutoff:[2800,3800],level:[.45,.6],send:[.3,.5],dsend:[.2,.35]},
        inserts:{prob:.5, max:1, pool:[["chorus",{rate:[.6,1.2],depth:[.4,.65],mix:[.4,.6]}]]}},   // the New Order gloss — big bright chorus on the hook
      pads:{prob:.85, recipe:{model:["strings","saw"],wave:"saw",cutoff:[1200,2000],detune:[.006,.012],attack:[.8,1.8],level:[.5,.7],send:[.35,.55],dsend:[.1,.25]}},
      drums:{kickModel:["909","boom"],snareModel:["noise","clap"],hatModel:["noise"],kick:[1.1,1.35],snare:[.8,1.05],hat:[.6,.9],tune:[.9,1.05],send:[.25,.45],dsend:[.05,.15]},
      fx:{reverb:[.5,.7], delayBeats:[.5,.75], delayFb:[.2,.35], delayCut:[2400,3600], pump:[.05,.25], crackle:[0,.1], lowcut:[30,45], highcut:[0,0], comp:[.3,.5]},
      found:{role:"bed", vol:[.06,.12], pitch:[.8,1], stretch:[.45,.6], cutoff:[1500,2500], sources:["shibuya","highway_night"]},
      stab:["off","sparse"], hits:{sources:["rave_b","vox_a"], pattern:"sparse", prob:.3},
      form:"pop" },
    edm: { label:"EDM", info:"festival big-room: riser into THE DROP, max pump, supersaw walls",   // SYNTH-FORWARD
      bpm:[124,132], swing:[0,.05], humanize:[0,.1],
      progressions:["epic_min","minor_run","sad_pop","drone_min"], kits:["four","pulse"], fills:["riser","riser","impact","cut","dropout"],
      bass:{patterns:["rolling","drive","stab"], recipe:{model:["saw","reese","modeld"],cutoff:[500,900],res:[.2,.35],level:[1.15,1.35],send:[0,.08],dsend:[0,0],
        glide:[20,40],envAmount:[1.5,2.8],envDecay:[.1,.2],oscMix:[.3,.7],drive:[.25,.5]},
        inserts:{prob:.35, max:1, pool:[["filtersweep",{rateBars:[1,2],lo:[-1,-.4],hi:[.8,1.4],res:[.3,.5]}]]}},   // fast festival sweeps under the drop; 1/3 of seeds: a Model-D drop bass, filter env punching every note
      lead:{patterns:["hero","updown","double"], recipe:{model:["stack","stack","brass","vocoder"],wave:"saw",voices:[6,8],spread:[.012,.02],cutoff:[3000,4200],level:[.5,.65],send:[.35,.55],dsend:[.2,.35]}},   // rare vocoder drop-voice
      vocSource:"sp_energy",
      pads:{prob:.9, recipe:{model:["saw"],wave:"saw",cutoff:[1400,2600],detune:[.012,.02],attack:[.6,1.6],level:[.6,.8],send:[.4,.6],dsend:[.1,.25]}},
      drums:{kickModel:["909"],snareModel:["clap","noise"],hatModel:["noise","metal"],kick:[1.35,1.6],snare:[.8,1.05],hat:[.5,.8],tune:[.95,1.1],send:[.2,.4],dsend:[.05,.2]},
      fx:{reverb:[.45,.65], delayBeats:[.375,.5], delayFb:[.25,.4], delayCut:[2500,4000], pump:[.55,.8], crackle:[0,0], lowcut:[30,45], highcut:[0,0], comp:[.6,.8], grit:[.2,.4], jux:[.2,.45]},
      found:{role:"chops", vol:[.08,.15], pitch:[.95,1.1], stretch:[.4,.6], cutoff:[2500,4000], sources:["shibuya","factory","vx_xminusone"]},
      stab:["rave","offbeat"], hits:{sources:["rave_a","rave_c","sp_energy"], pattern:"offbeat", prob:.6},
      form:"drop" },
    dubstep: { label:"Dubstep", info:"140 halftime: wobble bass, snare on three, cavernous space",
      bpm:[136,146], swing:[0,.08], humanize:[.05,.2],
      progressions:["drone_min","deep_two","minor_run"], kits:["halftime","breaks"], fills:["break fill","riser","impact","off","dropout"],
      euclid:{hat:[5,16]},   // E(5,16) sparse uneven hats rotating over the halftime frame
      bass:{patterns:["sub","dub","stab"], recipe:{model:["wobble","reese","sub"],wobbleHz:[1.5,4.5],cutoff:[300,650],res:[.2,.4],level:[1.2,1.45],send:[0,.08],dsend:[0,.1]},
        inserts:{prob:.5, max:1, pool:[["distort",{drive:[.3,.6],mix:[.6,.9]}],["filtersweep",{rateBars:[1,2],lo:[-.8,-.3],hi:[.6,1.2],res:[.3,.5]}]]}},   // grit on the reese; slow sweeps where the wobble isn't already doing it (constrain guards wobble)
      lead:{patterns:["off","sparse","pentaup"], recipe:{model:["pluck","fm","vocoder"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1800,3000],level:[.3,.45],send:[.35,.55],dsend:[.3,.5]}},   // rare vocoder: pitched vox stabs
      vocSource:"sp_pressure",
      pads:{prob:.35, recipe:{model:["saw","organ"],wave:"saw",cutoff:[550,950],detune:[.006,.014],attack:[1.5,3],level:[.32,.45],send:[.5,.7],dsend:[.15,.3]}},   // dark, mostly ABSENT — cavern not wash
      drums:{kickModel:["808","909"],snareModel:["crack","clap"],hatModel:["noise","metal"],kick:[1.2,1.45],snare:[.85,1.1],hat:[.4,.7],tune:[.9,1.05],send:[.15,.35],dsend:[.25,.5]},
      fx:{reverb:[.5,.7], delayBeats:[.75,1.5], delayFb:[.35,.55], delayCut:[1800,3000], pump:[.1,.3], crackle:[0,.15], lowcut:[25,40], highcut:[0,0], comp:[.4,.6], grit:[.3,.55]},
      found:{role:"chops", vol:[.1,.18], pitch:[.85,1.1], stretch:[.4,.6], cutoff:[2000,3500], sources:["factory","frogs"]},
      stab:["off","sparse"], hits:{sources:["vox_c","sp_pressure","rave_d"], pattern:"dub", prob:.55},
      form:"drop" },
    blues: { label:"Blues", info:"12-bar dom7 changes, triplet shuffle, call-and-response guitar, worn-record air",   // ACOUSTIC-forward (2026-07 deep pass: "the whole thing is acoustic")
      bpm:[78,100], swing:[.24,.42], humanize:[.3,.55],
      progressions:["blues_12"], kits:["shuffle","boombap","shuffle"], fills:["off","drum fill"],   // 2/3 the swung-triplet ride kit; boombap keeps a dusty chair
      bass:{patterns:["walking","walking","melodic"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sampler","piano"],cutoff:[500,1000],res:[.05,.15],level:[.9,1.1],send:[.1,.2],dsend:[0,.05],attack:.005,release:[.08,.14]}},   // the UPRIGHT (real, FluidR3) walks 2/3 of seeds; piano the rest — the DX7/sub bass is gone
      lead:{patterns:["blues","blues","wander"], patchPool:["HARMONICA1"], samplerPool:["steel_string_guitar","harmonica"], recipe:{model:["sampler","sampler","sampler","piano","dx7"],wave:"sine",voices:[1,2],spread:[.001,.004],cutoff:[2200,3400],level:[.5,.65],send:[.3,.5],dsend:[.1,.25]}},   // the REAL steel-string leads 3/5 of seeds (blue-note bends live here); piano + DX7 harmonica take the rest
      pads:{prob:.55, samplerPool:["percussive_organ","rock_organ","honky_tonk"], recipe:{model:["sampler","sampler","piano"],wave:"saw",cutoff:[900,1500],detune:[.003,.007],attack:[.02,.08],level:[.3,.42],send:[.2,.35],dsend:[.05,.15]}},   // COMPING, not pads: real sampled B3/rock organ (or barrelhouse honky-tonk piano) stabs on the changes — fast attack, modest level, never a wash (honky_tonk wired 2026-07-04: it was extracted by the liberalization batch but never pooled)
      drums:{kickModel:["boom","808"],snareModel:["noise"],hatModel:["noise"],kick:[.9,1.15],snare:[.5,.7],hat:[.5,.8],tune:[.85,1],send:[.15,.3],dsend:[0,.1]},   // snare tuned brushes-soft under the shuffle ride
      fx:{reverb:[.45,.65], delayBeats:[.5,.75], delayFb:[.1,.25], delayCut:[2000,3000], pump:[0,0], crackle:[.25,.55], lowcut:[0,30], highcut:[8000,12000], comp:[.15,.3]},
      found:{role:"bed", vol:[.05,.12], pitch:[.8,1], stretch:[.45,.6], cutoff:[1500,2500], sources:["shibuya","tokyo_station","vx_whitman"]},
      stab:["off"], hits:{sources:["blues_vox_78","blues_vox_78","horns_78"], pattern:"response", prob:.75},   // the 78rpm singer takes the response bars the guitar rests — and gets answered
      form:"pop" },
    jazz: { label:"Jazz", info:"ii-V-I machinery, walking bass, brushed kit, piano comping",
      bpm:[96,144], swing:[.28,.48], humanize:[.35,.6],
      progressions:["ii_v_i","neosoul","lofi","mode_dorian"], kits:["breaks","boombap"], fills:["off","drum fill"],
      bass:{patterns:["walking","melodic","dub"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sampler","piano"],cutoff:[400,800],res:[.05,.12],level:[.95,1.15],send:[.1,.2],dsend:[0,.05],attack:.005,release:[.08,.14]}},   // the UPRIGHT walks 2/3 of seeds (real, FluidR3); piano the rest
      lead:{patterns:["wander","sparse","canon"], samplerPool:["alto_sax","tenor_sax","bright_yamaha_grand","jazz_guitar"], recipe:{model:["sampler","sampler","sampler","piano"],wave:"sine",voices:[1,2],spread:[.001,.004],cutoff:[2400,3600],level:[.45,.6],send:[.35,.55],dsend:[.1,.3]}},   // THE SAX (real, sampled): 2/3 of seeds the horn leads, else comping piano
      pads:{prob:.8, samplerPool:["bright_yamaha_grand"], recipe:{model:["piano","fm","sampler"],wave:"sine",cutoff:[1000,1700],detune:[.002,.006],attack:[.2,.8],level:[.4,.6],send:[.35,.55],dsend:[.05,.2]}},
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.6,.9],snare:[.45,.7],hat:[.8,1.15],tune:[.9,1.05],send:[.2,.4],dsend:[0,.1]},
      fx:{reverb:[.5,.7], delayBeats:[.5,.75], delayFb:[.1,.25], delayCut:[2200,3400], pump:[0,0], crackle:[.15,.4], lowcut:[0,25], highcut:[9000,14000], comp:[.1,.25]},
      found:{role:"bed", vol:[.05,.12], pitch:[.8,1], stretch:[.45,.6], cutoff:[1500,2600], sources:["tokyo_station","shibuya","vx_ginsberg"]},
      rubato:{depth:[.008,.018], periodBars:[2,3], prob:.35},   // the light option: a third of seeds get a subtle combo-breathing (never as deep as neoclassical)
      stab:["off"], hits:{sources:["horns_78","vox_b"], pattern:"sparse", prob:.35},
      form:"pop" },
    dub: { label:"Dub", info:"one-drop riddim: the delay IS the genre — sub pressure, wet skanks, enormous echo tails",   // SAMPLE-FORWARD: wet vox hits + Burroughs in the smoke
      bpm:[68,82], swing:[.02,.1], humanize:[.1,.3],
      progressions:["deep_two","deep_two","drone_min"], kits:["halftime","boombap"], fills:["off","downlift","reverse"],
      bass:{patterns:["dub","sub"], recipe:{model:["sub"],cutoff:[260,460],res:[.05,.15],level:[1.2,1.4],send:[0,.06],dsend:[0,.05]}},
      lead:{patterns:["sparse","off","pentaup"], samplerPool:["harmonica","trombone"], recipe:{model:["pluck","fm","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1600,2600],level:[.32,.44],send:[.4,.6],dsend:[.5,.7],attack:.004,release:[.06,.1],sustain:[.5,.62]}},
      pads:{prob:.35, recipe:{model:["organ","saw"],wave:"saw",cutoff:[550,900],detune:[.004,.01],attack:[.15,.5],level:[.32,.44],send:[.3,.5],dsend:[.3,.5]}},   // dark organ skank thrown to the echo — NOT a wash
      drums:{kickModel:["808","boom"],snareModel:["crack","noise"],hatModel:["noise"],kick:[1.1,1.35],snare:[.9,1.15],hat:[.45,.75],tune:[.9,1.05],send:[.15,.3],dsend:[.5,.7]},   // the snare rides the delay — dsend IS the one-drop
      fx:{reverb:[.55,.7], delayBeats:[.75,1.5], delayFb:[.5,.7], delayCut:[1600,2600], pump:[0,.1], crackle:[0,.08], lowcut:[25,40], highcut:[0,0], comp:[.3,.5], grit:[.1,.25]},
      found:{role:"bed", vol:[.18,.3], pitch:[.7,.85], stretch:[.45,.6], cutoff:[1800,3000], sources:["frogs","highway_night","vx_burroughs"]},
      stab:["off","sparse"], hits:{sources:["vox_a","vox_b","sp_rewind","sp_pressure"], pattern:"dub", prob:.75, wet:true},
      form:"dj" },
    trance: { label:"Trance", info:"uplifting 138: rolling 16th bass, supersaw hero over a huge wash, hands-up drops",   // SYNTH-FORWARD: beds distant
      bpm:[132,142], swing:[0,.04], humanize:[0,.1],
      progressions:["uplift","epic_min","sad_pop","synthwave"], kits:["four","pulse"], fills:["riser","riser","impact","cut","dropout"],
      bass:{patterns:["rolling","sixteenths","drive","pedal"], recipe:{model:["saw"],cutoff:[520,850],res:[.15,.3],level:[1.1,1.3],send:[0,.08],dsend:[0,.05]},
        inserts:{prob:.7, max:1, pool:[["filtersweep",{rateBars:[4,8],lo:[-1,-.5],hi:[1,1.6],res:[.3,.5]}]]}},   // THE trance move: the rolling 16th line sweeps open over 4-8 bars
      lead:{patterns:["hero","arpup","anthem"], patchPool:["SYNBRASS 1","SYN-LEAD 2"], recipe:{model:["stack","stack","dx7"],wave:"saw",voices:[6,7],spread:[.012,.02],cutoff:[3000,4200],level:[.5,.62],send:[.4,.6],dsend:[.3,.45],vibrato:[0,.004],attack:.01,release:[.2,.3],sustain:[.8,.9],fenv:[.25,.45]}},   // ~1/3: DX7 brass stabs (alg-22 pair -> morphable) — the hands-up hook
      pads:{prob:1, recipe:{model:["saw"],wave:"saw",cutoff:[1300,2400],detune:[.01,.018],attack:[1,2],level:[.55,.75],send:[.5,.7],dsend:[.15,.3]}},
      drums:{kickModel:["909"],snareModel:["clap","noise"],hatModel:["noise"],kick:[1.3,1.55],snare:[.7,.95],hat:[.7,1],tune:[.95,1.1],send:[.15,.3],dsend:[.1,.25]},
      fx:{reverb:[.6,.75], delayBeats:[.75,.75], delayFb:[.4,.55], delayCut:[2400,3600], pump:[.4,.6], crackle:[0,0], lowcut:[30,45], highcut:[0,0], comp:[.5,.7], grit:[0,.15]},
      found:{role:"bed", vol:[.06,.12], pitch:[.7,.9], stretch:[.45,.6], cutoff:[1500,2500], sources:["highway_night","tokyo_station","vx_apollo"]},
      stab:["off","sparse"], hits:{sources:["rave_c","sp_energy","vox_a"], pattern:"offbeat", prob:.4},
      form:"drop" },
    disco: { label:"Disco", info:"four-on-floor + octave bass + organ glitter, min7 funk vamps, 78rpm horns",   // sample-mid: the horns are dressing
      bpm:[110,122], swing:[.05,.12], humanize:[.1,.25],
      progressions:["funk_vamp","house_min7","pop_1625"], kits:["four","open"], fills:["hat rush","drum fill","riser"],
      bass:{patterns:["octaves","walking","syncopated"], recipe:{model:["saw","modeld"],cutoff:[650,1050],res:[.1,.2],level:[1,1.2],send:[.03,.08],dsend:[0,.05],
        glide:[20,35],envAmount:[1,1.8],envDecay:[.07,.14],oscMix:[.2,.5],drift:[3,7]}},   // half the seeds: the funk-vamp Model-D — short punchy filter env on the octave line (Bernard Edwards' synth stand-in)
      lead:{patterns:["pentaup","double","updown","wander"], recipe:{model:["fm","pluck"],wave:"pulse",voices:[1,2],spread:[.002,.005],cutoff:[2600,3600],level:[.42,.54],send:[.3,.45],dsend:[.15,.3],attack:.005,release:[.08,.14],sustain:[.6,.72],fenv:[.3,.5]}},
      pads:{prob:1, patchPool:["E.ORGAN 2","E.ORGAN 3"], samplerPool:["strings","harp"], recipe:{model:["organ","organ","dx7","sampler","sampler"],wave:"saw",cutoff:[1100,1700],detune:[.004,.009],attack:[.2,.6],level:[.45,.6],send:[.3,.45],dsend:[.05,.15]},
        inserts:{prob:.5, max:1, pool:[["phaser",{rate:[.2,.5],depth:[.5,.7],mix:[.4,.6]}]]}},   // organ stabs = the glitter — through the string-machine phaser, 1977-style
      drums:{kickModel:["909","boom"],snareModel:["clap","noise"],hatModel:["noise"],kick:[1.1,1.3],snare:[.75,1],hat:[1.1,1.4],tune:[.95,1.1],send:[.15,.3],dsend:[.05,.15]},   // OPEN HATS UP — the offbeat sizzle
      fx:{reverb:[.4,.55], delayBeats:[.375,.5], delayFb:[.15,.3], delayCut:[2600,3800], pump:[0,.15], crackle:[.05,.2], lowcut:[30,45], highcut:[0,0], comp:[.3,.5], grit:[0,0]},
      found:{role:"bed", vol:[.06,.12], pitch:[.85,1], stretch:[.45,.6], cutoff:[1800,2800], sources:["shibuya","tokyo_station","vx_timelady"]},
      stab:["off","sparse"], hits:{sources:["horns_78","sp_rhythm","vox_a"], pattern:"offbeat", prob:.5},
      form:"pop" },
    italo: { label:"Italo disco", info:"sparkling pluck arps over octave bass — brighter and happier than synthwave",   // SYNTH-FORWARD
      bpm:[108,120], swing:[0,.08], humanize:[.02,.12],
      progressions:["sad_pop","synthwave","doo_wop"], kits:["pulse","four"], fills:["tom fill","riser","drum fill"],
      bass:{patterns:["octaves","sixteenths","pedal"], recipe:{model:["saw","modeld"],cutoff:[750,1150],res:[.12,.22],level:[1.05,1.25],send:[.03,.08],dsend:[0,.05],
        glide:[15,30],envAmount:[1.2,2.2],envDecay:[.06,.12],oscMix:[.2,.5],drift:[2,5]}},   // half the seeds: the Italo octave bass on a real Model-D — tight glide, plucky filter env
      lead:{patterns:["arpup","arpdown","hero","pentaup"], patchPool:["SYN-PIANO","E.PIANO 4"], recipe:{model:["pluck","stack","dx7"],wave:"square",voices:[1,2],spread:[.002,.006],cutoff:[3200,4200],level:[.5,.6],send:[.3,.45],dsend:[.3,.45],vibrato:[0,.003],attack:.004,release:[.07,.12],sustain:[.6,.7],fenv:[.3,.5]},
        inserts:{prob:.4, max:1, pool:[["chorus",{rate:[.6,1.2],depth:[.4,.6],mix:[.4,.55]}]]}},   // sparkle doubled — Juno-chorus plucks
      pads:{prob:.9, recipe:{model:["saw","strings"],wave:"saw",cutoff:[1400,2200],detune:[.006,.012],attack:[.6,1.4],level:[.45,.6],send:[.3,.45],dsend:[.1,.2]},
        inserts:{prob:.6, max:1, pool:[["phaser",{rate:[.1,.3],depth:[.5,.75],mix:[.4,.6]}]]}},   // the Italo string pad phases — happier than synthwave, same box
      drums:{kickModel:["909"],snareModel:["clap","noise"],hatModel:["noise"],kick:[1.15,1.35],snare:[.8,1.05],hat:[.9,1.2],tune:[.95,1.1],send:[.2,.35],dsend:[.05,.15]},
      fx:{reverb:[.45,.6], delayBeats:[.375,.75], delayFb:[.25,.4], delayCut:[2800,4000], pump:[.1,.3], crackle:[0,.08], lowcut:[30,45], highcut:[0,0], comp:[.3,.5], grit:[0,0]},
      found:{role:"bed", vol:[.06,.12], pitch:[.8,.95], stretch:[.45,.6], cutoff:[1500,2500], sources:["shibuya","highway_night","vx_xminusone"]},
      stab:["off","offbeat"], hits:{sources:["rave_b","vox_a","sp_nightdrive"], pattern:"sparse", prob:.4},
      form:"pop" },
    bigbeat: { label:"Big beat", info:"amen-driven block-rocking beats: acid bass, rave stabs galore, maximum cheek",   // SAMPLE-FORWARD: the break + the sample-CD arsenal
      bpm:[118,136], swing:[0,.1], humanize:[.05,.2],
      progressions:["minor_run","house_min","deep_two"], kits:["breaks","house"], fills:["break fill","riser","impact","cut","snare roll"],
      bass:{patterns:["stab","rolling","drive","syncopated"], recipe:{model:["acid"],cutoff:[420,700],res:[.3,.45],level:[1.1,1.3],send:[0,.08],dsend:[0,.1]},
        inserts:{prob:.6, max:2, pool:[["distort",{drive:[.3,.6],mix:[.6,.9]}],["filtersweep",{rateBars:[2,4],lo:[-.8,-.3],hi:[.8,1.4],res:[.35,.5]}]]}},   // the acid line, overdriven AND swept — maximum cheek
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
      euclid:{hat:[7,16]},   // E(7,16) skippy 2-step hats, rotation per chord (swing rides on top)
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
      pads:{prob:1, samplerPool:["church_organ","cello"], recipe:{model:["saw","choir","sampler","sampler"],wave:"saw",cutoff:[500,900],detune:[.01,.018],attack:[3,5],level:[.7,.9],send:[.7,.85],dsend:[.15,.3]},
        inserts:{prob:.5, max:1, pool:[["filtersweep",{rateBars:[8,16],lo:[-1.5,-.8],hi:[.3,.8],res:[.2,.4]}]]}},   // tectonic 8-16-bar sweeps — the drone inhales once a minute
      drums:{kickModel:["boom","808"],snareModel:["noise"],hatModel:["noise"],kick:[1.3,1.6],snare:[.4,.6],hat:[.3,.5],tune:[.78,.9],send:[.3,.5],dsend:[.1,.3]},
      fx:{reverb:[.85,.95], delayBeats:[1,1.5], delayFb:[.45,.6], delayCut:[1200,2200], pump:[0,0], crackle:[0,.1], lowcut:[0,20], highcut:[0,0], comp:[.5,.75], grit:[.5,.8]},
      found:{role:"bed", vol:[.2,.32], pitch:[.5,.65], stretch:[.45,.6], cutoff:[1200,2200], sources:["factory","highway_night","vx_blake","vx_conet_swedish"]},   // the factory WAY down + tyger tyger + the haunted music box
      stab:["off"], hits:{sources:["sp_pressure","vox_c"], pattern:"sparse", prob:.2},
      form:"wave" },
    newage: { label:"New age", info:"luminous major-key drift: choir + strings, gentle sine melody, frogs at dusk",   // sample-mid: nature beds ARE the texture
      bpm:[58,76], swing:[0,.06], humanize:[.2,.4],
      progressions:["dream","mode_lydian","canon"], kits:["off"], fills:["off"],
      bass:{patterns:["root","simple","off"], recipe:{model:["sub"],cutoff:[250,450],res:[.05,.12],level:[.8,1],send:[.15,.3],dsend:[0,.1]}},
      lead:{patterns:["sparse","wander","arpup"], samplerPool:["flute","harp"], recipe:{model:["stack","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.004],cutoff:[2200,3400],level:[.4,.5],send:[.5,.7],dsend:[.25,.4],vibrato:[.006,.012],attack:[.15,.4],release:[.5,.8],sustain:[.85,.95]}},   // the melody is PRESENT — distinct from ambient; 1/3 a real flute over the drift
      pads:{prob:1, patchPool:["TUB BELLS","SHIMMER","CELESTE"], samplerPool:["harp","celesta"], recipe:{model:["choir","strings","dx7","sampler","sampler"],wave:"saw",cutoff:[900,1600],detune:[.005,.012],attack:[2.5,4.5],level:[.6,.8],send:[.6,.8],dsend:[.1,.25]},
        inserts:{prob:.5, max:1, pool:[["chorus",{rate:[.15,.4],depth:[.4,.6],mix:[.3,.5]}]]}},   // ~1/3: DX7 TUB BELLS — luminous new-age chimes (csound maps -> bell); soft shimmer-chorus on the choir
      drums:{kickModel:["808"],snareModel:["noise"],hatModel:["noise"],kick:[.5,.8],snare:[.35,.55],hat:[.3,.5],tune:[.9,1.05],send:[.25,.45],dsend:[0,.1]},
      fx:{reverb:[.8,.92], delayBeats:[1,1.5], delayFb:[.35,.5], delayCut:[1800,2800], pump:[0,0], crackle:[0,.05], lowcut:[0,0], highcut:[0,0], comp:[0,.15], grit:[0,0]},
      found:{role:"bed", vol:[.16,.26], pitch:[.75,.9], stretch:[.45,.6], cutoff:[2400,3800], sources:["frogs","iriomote","vx_whitman"]},
      stab:["off"], hits:{sources:["sp_herenow"], pattern:"sparse", prob:.15},
      form:"wave" },
    exotica: { label:"Exotica", info:"tiki-lounge jazz: swung brushes, piano + organ, the birds ARE the percussion color",   // SAMPLE-FORWARD: the aviary up front
      bpm:[85,105], swing:[.12,.22], humanize:[.25,.45],
      progressions:["ii_v_i","lofi","neosoul"], kits:["halftime","boombap"], fills:["off","drum fill"],
      bass:{patterns:["walking","simple","root"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","piano","sub"],cutoff:[500,900],res:[.05,.12],level:[.9,1.1],send:[.1,.2],dsend:[0,.05],attack:.005,release:[.08,.14]}},   // 1/3 of seeds the real upright anchors the tiki combo
      lead:{patterns:["wander","pentaup","sparse"], patchPool:["VIBE    1","MARIMBA","SAX BC"], samplerPool:["tenor_sax","vibraphone","marimba"], recipe:{model:["sampler","sampler","sampler","piano","dx7"],wave:"sine",voices:[1,2],spread:[.001,.004],cutoff:[2400,3600],level:[.45,.58],send:[.35,.55],dsend:[.1,.25],vibrato:[.008,.014]}},   // the tiki horn/vibes LEAD (real, half the seeds); piano and DX7 mallets comp the rest
      pads:{prob:.85, samplerPool:["vibraphone","marimba"], recipe:{model:["organ","piano","sampler"],wave:"sine",cutoff:[1000,1600],detune:[.002,.006],attack:[.3,.9],level:[.42,.56],send:[.35,.5],dsend:[.05,.15]}},
      drums:{kickModel:["boom","808"],snareModel:["noise"],hatModel:["noise"],kick:[.9,1.15],snare:[.45,.66],hat:[.6,.9],tune:[.9,1.05],send:[.2,.35],dsend:[.05,.2]},   // snare trimmed (2026-07): brushes, not backbeat — keeps snareBalance under the exotica fence with the kit-quote fills
      fx:{reverb:[.55,.7], delayBeats:[.5,.75], delayFb:[.2,.35], delayCut:[2200,3200], pump:[0,0], crackle:[0,.15], lowcut:[0,25], highcut:[0,0], comp:[.1,.3], grit:[0,0]},
      found:{role:"bed", vol:[.2,.32], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[3500,5200], sources:["frogs","iriomote","vx_timelady"]},   // birds near natural pitch, bright and present
      stab:["off"], hits:{sources:["horns_78","vox_b"], pattern:"sparse", prob:.35},
      form:"pop" },
    industrial: { label:"Industrial", info:"detuned machine music: metal hats, phrygian drones, the metallurgy plant finally stars",   // SAMPLE-FORWARD: the factory IS the hook (chops role)
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
      stab:["offbeat","sparse"], hits:{sources:["sp_system","sp_pressure","rave_d"], pattern:"dub", prob:.55},
      form:"dj" },
    spokenword: { label:"Spoken word", info:"beat poetry over jazz: quiet boombap, piano color, the poets narrating through the dust",   // SAMPLE-FORWARD: the VOICE leads
      bpm:[72,96], swing:[.05,.14], humanize:[.2,.4],
      progressions:["ii_v_i","neosoul","mode_dorian"], kits:["boombap"], fills:["off","off","drum fill"],
      bass:{patterns:["walking","dub","simple"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sub","piano"],cutoff:[350,650],res:[.05,.12],level:[.85,1.05],send:[.05,.15],dsend:[0,.05],attack:.005,release:[.08,.14]}},   // 1/3 of seeds the real upright under the poets
      lead:{patterns:["sparse","wander","off"], samplerPool:["tenor_sax","felt_piano"], recipe:{model:["piano","sampler"],wave:"sine",voices:[1,1],spread:[.001,.003],cutoff:[2400,3400],level:[.45,.55],send:[.35,.5],dsend:[.1,.25]}},   // half the seeds a real sampled voice answering the poets: tenor sax or the felt piano (2026-07)
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
      lead:{patterns:["arpup","arpdown","double","hero"], recipe:{model:["pluck","stack"],wave:"square",voices:[1,2],spread:[.001,.003],cutoff:[3500,5000],level:[.5,.62],send:[.15,.3],dsend:[.15,.3],vibrato:[0,.002],attack:.002,release:[.03,.06],sustain:[.5,.6],octave:0}},
      pads:{prob:.5, recipe:{model:["saw"],wave:"square",cutoff:[1500,2500],detune:[.003,.007],attack:[.1,.4],level:[.35,.48],send:[.15,.3],dsend:[.05,.15]}},
      drums:{kickModel:["909"],snareModel:["noise","clap"],hatModel:["noise"],kick:[1.1,1.35],snare:[.7,.95],hat:[.8,1.15],tune:[1,1.15],send:[.05,.12],dsend:[0,.1]},
      fx:{reverb:[.3,.45], delayBeats:[.375,.5], delayFb:[.15,.3], delayCut:[3000,4500], pump:[0,.15], crackle:[0,0], lowcut:[0,0], highcut:[0,0], comp:[.3,.5], grit:[.15,.35], jux:[.25,.45]},   // SID-chip hard-ish channel panning
      found:{role:"bed", vol:[.04,.08], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[2000,3200], sources:["shibuya","vx_xminusone"]},
      stab:["off","sparse"], hits:{sources:["rave_a","sp_energy"], pattern:"offbeat", prob:.4},
      form:"pop" },
    chinawave: { label:"Chinawave", info:"socialist 1950s China wave: march snare, pentatonic brass over choir, shellac crackle, The East Is Red through the wire recorder",   // SAMPLE-FORWARD: the massed chorus IS the bed
      bpm:[96,118], swing:[0,.04], humanize:[.05,.18],
      progressions:["four_chords","doo_wop","canon"], kits:["four","pulse"], fills:["drum fill","tom fill","riser","snare roll","snare roll"],   // the march-snare crescendo IS this genre's fill
      bass:{patterns:["root","walking","octaves"], recipe:{model:["saw"],cutoff:[500,850],res:[.08,.16],level:[.85,1.05],send:[.05,.12],dsend:[0,.05]}},
      lead:{patterns:["pentaup","pentaup","updown"], patchPool:["BR TRUMPET","BRASS   3"], samplerPool:["trumpet"], recipe:{model:["brass","brass","vocoder","dx7","sampler"],wave:"saw",voices:[1,2],spread:[.002,.005],cutoff:[2400,3400],level:[.52,.66],send:[.3,.45],dsend:[.1,.25],vibrato:[.006,.012]}},   // pentatonic brass; sometimes Radio Peking SINGS it (vocoder); DX7 trumpet pair (alg 18 -> morphable) + a real PLA trumpet
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
      lead:{patterns:["arpup","hero","wander","updown"], patchPool:["BRASS   2","BRASS   1","SYNBRASS 1"], samplerPool:["trumpet","trombone","french_horns"], recipe:{model:["vocoder","vocoder","stack","dx7","sampler"],wave:"saw",voices:[2,3],spread:[.004,.009],cutoff:[2400,3400],level:[.6,.72],send:[.35,.5],dsend:[.25,.4],vibrato:[0,.004]},
        inserts:{prob:.35, max:1, pool:[["chorus",{rate:[.4,.9],depth:[.4,.6],mix:[.35,.5]}]]}},   // the genre's voice: vocoded speech SINGS the arps; ~1/4: DX7 BRASS 2, the state-radio fanfare (csound maps -> fm)
      pads:{prob:1, recipe:{model:["choir","strings"],wave:"saw",cutoff:[900,1500],detune:[.005,.011],attack:[1.5,3],level:[.55,.75],send:[.5,.65],dsend:[.1,.2]},
        inserts:{prob:.5, max:1, pool:[["phaser",{rate:[.08,.2],depth:[.5,.7],mix:[.35,.55]}]]}},   // the choir through a slow Soviet tape-phaser
      drums:{kickModel:["boom","909"],snareModel:["noise","clap"],hatModel:["noise"],kick:[1.1,1.3],snare:[.7,.95],hat:[.6,.9],tune:[.9,1.05],send:[.2,.35],dsend:[.05,.15]},
      fx:{reverb:[.65,.8], delayBeats:[.5,.75], delayFb:[.25,.4], delayCut:[2000,3000], pump:[0,.15], crackle:[.2,.4], lowcut:[0,30], highcut:[0,0], comp:[.25,.45], grit:[0,.15]},
      found:{role:"bed", vol:[.22,.34], pitch:[.85,.95], stretch:[.45,.6], cutoff:[2400,3600], sources:["vx_sv_choir","vx_sv_speech","vx_sv_radio","vx_sv_march"]},
      vocSource:"vx_sv_speech",   // Lenin 1919, vocoded
      stab:["off","sparse"], hits:{sources:["vx_sv_march","vx_sv_radio"], pattern:"sparse", prob:.5},
      form:"pop" },
    // ================= ROUND 3 — the big expansion =================
    citypop: { label:"City pop", info:"the royal-road SOURCE genre: bright maj7 boogie, DX7 e-piano gloss, walking bass — Tokyo at night, UNSLOWED",   // SYNTH-FORWARD: vaporwave before the slowdown — city lights, not mall haze
      bpm:[92,106], swing:[.05,.12], humanize:[.08,.2],   // UNDER transitwave/italo tempo — the boogie sits at 100
      progressions:["royal_road","pop_1625","neosoul"], kits:["full","open"], fills:["drum fill","tom fill","riser"],
      bass:{patterns:["walking","melodic","octaves","syncopated"], recipe:{model:["saw"],cutoff:[650,1000],res:[.08,.16],level:[1.0,1.2],send:[.03,.08],dsend:[0,.05]}},
      lead:{patterns:["composed","composed2","updown"], patchPool:["E.PIANO 1","E.PIANO 3"], samplerPool:["alto_sax"], recipe:{model:["dx7","dx7","fm","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[2800,3800],level:[.46,.58],send:[.25,.4],dsend:[.15,.3],vibrato:[.003,.007],attack:.01,release:[.12,.2],sustain:[.7,.8],fenv:[.1,.25]},
        inserts:{prob:.7, max:1, pool:[["chorus",{rate:[.5,1],depth:[.4,.6],mix:[.45,.65]}]]}},   // DX7 E.PIANO 1 as the DEFAULT voice — this is where vaporwave stole it from; E.PIANO + chorus IS the city-pop gloss
      pads:{prob:1, recipe:{model:["strings","saw"],wave:"saw",cutoff:[1400,2100],detune:[.004,.009],attack:[.5,1.2],level:[.45,.6],send:[.2,.35],dsend:[.05,.15]}},
      drums:{kickModel:["boom","909"],snareModel:["noise","clap"],hatModel:["noise"],kick:[1.05,1.25],snare:[.75,1],hat:[.9,1.2],tune:[.95,1.1],send:[.12,.22],dsend:[.03,.1]},
      fx:{reverb:[.35,.5], delayBeats:[.5,.75], delayFb:[.2,.32], delayCut:[2800,4000], pump:[0,.1], crackle:[0,.1], lowcut:[25,40], highcut:[0,0], comp:[.1,.24], grit:[0,0]},   // light-touch master (transitwave is the COMPRESSED one)
      found:{role:"bed", vol:[.07,.13], pitch:[.9,1], stretch:[.45,.6], cutoff:[1800,2800], sources:["shibuya","tokyo_station","highway_night"]},   // the city at NATURAL pitch, way back
      stab:["off"], hits:{sources:["sp_nightdrive","vox_a"], pattern:"sparse", prob:.3},
      form:"pop" },
    shibuyakei: { label:"Shibuya-kei", info:"twee 60s-pop futurism: bells + plucks skipping over doo-wop changes, a real swing, sunshine bright",   // SYNTH-FORWARD: toy orchestration, zero dust
      bpm:[116,128], swing:[.14,.24], humanize:[.1,.25],
      progressions:["doo_wop","doo_wop","pop_1625"], kits:["open","full"], fills:["drum fill","hat rush","riser"],
      bass:{patterns:["walking","octaves","melodic"], recipe:{model:["saw"],cutoff:[700,1100],res:[.08,.16],level:[.95,1.15],send:[.03,.08],dsend:[0,.05]}},
      lead:{patterns:["updown","pentaup","wander","composed"], patchPool:["TUB BELLS","E.PIANO 1"], samplerPool:["vibraphone","flute"], recipe:{model:["bell","pluck","dx7","sampler"],wave:"sine",voices:[1,2],spread:[.001,.004],cutoff:[3000,4200],level:[.48,.6],send:[.25,.4],dsend:[.2,.35],attack:.004,release:[.08,.14],sustain:[.55,.68],fenv:[.2,.4]},
        inserts:{prob:.6, max:1, pool:[["chorus",{rate:[.6,1.2],depth:[.4,.6],mix:[.4,.6]}]]}},   // music-box bells + plucks (TUB BELLS through the sunshine) — chorused twee-wide
      pads:{prob:.9, recipe:{model:["strings"],wave:"saw",cutoff:[1400,2000],detune:[.003,.008],attack:[.3,.8],level:[.42,.56],send:[.2,.35],dsend:[.05,.15]}},
      drums:{kickModel:["boom"],snareModel:["noise","clap"],hatModel:["noise"],kick:[.95,1.15],snare:[.7,.95],hat:[1,1.3],tune:[1,1.15],send:[.15,.25],dsend:[.05,.12]},
      fx:{reverb:[.35,.5], delayBeats:[.375,.5], delayFb:[.15,.3], delayCut:[3000,4200], pump:[0,.08], crackle:[0,.08], lowcut:[20,35], highcut:[0,0], comp:[.15,.35], grit:[0,0]},
      found:{role:"bed", vol:[.06,.12], pitch:[.95,1.05], stretch:[.45,.6], cutoff:[2200,3400], sources:["shibuya","tokyo_station","vx_timelady"]},
      stab:["off"], hits:{sources:["sp_shopping","vox_a","rave_b"], pattern:"sparse", prob:.4},
      form:"pop" },
    bossanova: { label:"Bossa nova", info:"soft Brazilian swing: nylon-string pluck over ii-V changes, rim-click clave, a whisper of a kit",   // acoustic-leaning: the guitar IS the song
      bpm:[84,100], swing:[.08,.18], humanize:[.25,.45],
      progressions:["ii_v_i","neosoul","lofi"], kits:["bossa"], fills:["off","off","drum fill"],
      bass:{patterns:["dub","simple","root"], samplerPool:["acoustic_bass"], recipe:{model:["sampler","sub","piano"],cutoff:[380,700],res:[.05,.12],level:[.85,1.05],send:[.05,.12],dsend:[0,.05],attack:.005,release:[.08,.14]}},   // 1/3 of seeds the real upright under the nylon guitar
      lead:{patterns:["wander","sparse","pentaup"], samplerPool:["nylon_string_guitar","nylon_string_guitar","flute"], recipe:{model:["sampler","sampler","kpluck"],wave:"sine",drive:0,voices:[1,1],spread:[.001,.003],cutoff:[2400,3400],level:[.5,.62],send:[.25,.4],dsend:[.08,.2]}},   // the REAL nylon string (or breathy flute) LEADS 2/3 of seeds; the KS pluck is the fallback color now
      pads:{prob:.8, samplerPool:["nylon_string_guitar"], recipe:{model:["organ","piano","sampler"],wave:"sine",cutoff:[1000,1600],detune:[.002,.005],attack:[.3,.8],level:[.38,.5],send:[.3,.45],dsend:[.05,.12]}},
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.85,1.05],snare:[.5,.7],hat:[.5,.8],tune:[.95,1.1],send:[.12,.25],dsend:[0,.08]},
      fx:{reverb:[.4,.55], delayBeats:[.5,.75], delayFb:[.1,.22], delayCut:[2400,3400], pump:[0,0], crackle:[.08,.25], lowcut:[0,25], highcut:[9000,13000], comp:[.1,.25], grit:[0,0]},
      found:{role:"bed", vol:[.08,.16], pitch:[.85,1], stretch:[.45,.6], cutoff:[2000,3200], sources:["iriomote","frogs","vx_dickinson"]},
      stab:["off"], hits:{sources:["horns_78","vox_b"], pattern:"sparse", prob:.25},
      form:"pop" },
    idm: { label:"IDM", info:"braindance: euclidean drum tangles that never repeat, detuned FM bells, dry close mix — machine precision faking clumsiness",   // SYNTH-FORWARD: the PATTERN is the artist
      bpm:[88,116], swing:[0,.05], humanize:[.3,.5],
      progressions:["deep_two","mode_lydian","neosoul","drone_min"], kits:["breaks","techno","boombap"], fills:["cut","noise","reverse","off","stutter"],
      euclid:{kick:[5,16],hat:[11,16]},   // E(5,16) against E(11,16), both rotating — the tangle
      bass:{patterns:["stab","melodic","sub"], recipe:{model:["sub","reese"],cutoff:[300,560],res:[.1,.25],level:[1,1.2],send:[0,.08],dsend:[0,.1]}},
      lead:{patterns:["wander","sparse","double"], patchPool:["TUB BELLS","ORCH-CHIME"], recipe:{model:["fm","bell","dx7"],wave:"sine",voices:[1,2],spread:[.004,.01],cutoff:[2200,3400],level:[.42,.54],send:[.3,.5],dsend:[.3,.5],vibrato:[0,.004],attack:.005,release:[.1,.2],sustain:[.6,.75],fenv:[.3,.6]},
        inserts:{prob:.5, max:2, pool:[["phaser",{rate:[.2,.6],depth:[.5,.8],mix:[.4,.6]}],["filtersweep",{rateBars:[2,6],lo:[-.8,-.3],hi:[.6,1.2],res:[.25,.45]}]]}},   // braindance: the bells get processed — phase + sweep chains, sometimes both
      pads:{prob:.6, recipe:{model:["fm","saw"],wave:"sine",cutoff:[900,1500],detune:[.008,.016],attack:[1,2.5],level:[.4,.55],send:[.3,.5],dsend:[.1,.25]}},   // detuned, often absent
      drums:{kickModel:["808","909"],snareModel:["crack","noise"],hatModel:["metal","noise"],kick:[1.05,1.3],snare:[.6,.85],hat:[.7,1],tune:[.9,1.1],send:[.05,.15],dsend:[.15,.35]},
      fx:{reverb:[.3,.45], delayBeats:[.375,.75], delayFb:[.3,.45], delayCut:[2200,3400], pump:[0,.1], crackle:[0,.1], lowcut:[25,40], highcut:[0,0], comp:[.3,.5], grit:[.15,.4], jux:[.4,.7]},   // jux MAX — the stereo field disagrees with itself
      found:{role:"chops", vol:[.1,.18], pitch:[.85,1.1], stretch:[.4,.6], cutoff:[2200,3600], sources:["factory","vx_wwvh","vx_conet_poacher"]},
      stab:["off","sparse"], hits:{sources:["sp_system","sp_rewind","vox_c"], pattern:"sparse", prob:.45},
      form:"pop" },
    electro: { label:"Electro", info:"1982 machine funk: 808 boom-bap, euclid tresillo claps, the robot sings through the vocoder",   // SYNTH-FORWARD: the drum machine is the lead instrument
      bpm:[118,130], swing:[0,.06], humanize:[0,.12],
      progressions:["funk_vamp","deep_two","minor_run"], kits:["electro"], fills:["cut","hat rush","impact","off"],
      euclid:{snare:[3,16]},   // E(3,16) tresillo CLAPS rotating per chord over the boom-bap frame
      bass:{patterns:["stab","sixteenths","octaves"], recipe:{model:["saw","acid"],cutoff:[500,850],res:[.15,.3],level:[1.05,1.25],send:[0,.06],dsend:[0,.08]}},
      lead:{patterns:["double","arpup","sparse"], patchPool:["SYN-CLAV 1","PRC SYNTH1"], recipe:{model:["vocoder","stack","fm","dx7"],wave:"square",voices:[1,2],spread:[.002,.006],cutoff:[2400,3400],level:[.44,.56],send:[.2,.35],dsend:[.25,.4],attack:.003,release:[.05,.09],sustain:[.5,.62],fenv:[.5,.9]},
        inserts:{prob:.4, max:1, pool:[["phaser",{rate:[.2,.5],depth:[.5,.7],mix:[.35,.55]}]]}},   // the vocoder IS the genre's voice — the robot phases
      vocSource:"sp_system",
      pads:{prob:.45, recipe:{model:["saw","organ"],wave:"saw",cutoff:[800,1300],detune:[.004,.01],attack:[.3,.9],level:[.34,.46],send:[.2,.35],dsend:[.1,.2]}},
      drums:{kickModel:["808"],snareModel:["clap"],hatModel:["metal","noise"],kick:[1.2,1.4],snare:[.85,1.1],hat:[.8,1.1],tune:[1,1.1],send:[.05,.15],dsend:[.1,.25]},
      fx:{reverb:[.3,.45], delayBeats:[.5,.75], delayFb:[.25,.4], delayCut:[2600,3800], pump:[.05,.2], crackle:[0,.1], lowcut:[30,45], highcut:[0,0], comp:[.4,.6], grit:[.1,.3], jux:[.15,.35]},
      found:{role:"chops", vol:[.08,.15], pitch:[.95,1.1], stretch:[.4,.6], cutoff:[2400,3800], sources:["factory","vx_apollo","vx_wwvh"]},
      stab:["offbeat","sparse"], hits:{sources:["sp_system","sp_energy","rave_a"], pattern:"offbeat", prob:.6},
      form:"pop" },
    miamibass: { label:"Miami bass", info:"808 subs shaking the trunk: fast stuttering hats, chant hits, the low end IS the song",   // SYNTH-FORWARD: the 808 sub is the hook
      bpm:[100,128], swing:[0,.08], humanize:[0,.12],
      progressions:["funk_vamp","deep_two","house_min7"], kits:["trap","electro"], fills:["hat rush","cut","impact"],
      bass:{patterns:["sub","stab","dub"], recipe:{model:["sub"],cutoff:[250,420],res:[.05,.15],level:[1.3,1.5],send:[0,.05],dsend:[0,.05]}},   // the 808 sub LOUD
      lead:{patterns:["double","sparse","off"], recipe:{model:["pluck","fm"],wave:"square",voices:[1,2],spread:[.002,.005],cutoff:[2600,3600],level:[.4,.52],send:[.15,.3],dsend:[.15,.3],attack:.003,release:[.05,.09],sustain:[.5,.62],fenv:[.4,.7]}},
      pads:{prob:.35, recipe:{model:["saw"],wave:"saw",cutoff:[900,1400],detune:[.004,.009],attack:[.2,.6],level:[.32,.44],send:[.15,.3],dsend:[.05,.15]}},   // NO organ — disco keeps its glitter, this is all machine
      drums:{kickModel:["808"],snareModel:["clap","crack"],hatModel:["noise","metal"],kick:[1.35,1.6],snare:[.75,1],hat:[.9,1.2],tune:[1,1.15],send:[.05,.12],dsend:[.05,.15]},
      fx:{reverb:[.25,.4], delayBeats:[.375,.5], delayFb:[.2,.35], delayCut:[2800,4000], pump:[.05,.2], crackle:[0,.08], lowcut:[25,38], highcut:[0,0], comp:[.25,.45], grit:[.1,.25], jux:[.1,.3]},
      found:{role:"bed", vol:[.06,.12], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[1800,3000], sources:["highway_night","shibuya"]},
      stab:["offbeat","sparse"], hits:{sources:["vox_a","vox_c","sp_energy"], pattern:"offbeat", prob:.7},
      form:"pop" },
    phonk: { label:"Phonk", info:"Memphis tape menace: dark cowbell-plucks over 808s, drowned in hiss, pitched-down voices in the smoke",   // SAMPLE-FORWARD: the dusty vox hits + tape filth
      bpm:[126,142], swing:[0,.1], humanize:[.1,.25],
      progressions:["deep_two","drone_min","mode_phrygian"], kits:["trap","boombap"], fills:["cut","off","downlift"],
      bass:{patterns:["sub","dub","stab"], recipe:{model:["sub","reese"],cutoff:[240,420],res:[.05,.18],level:[1.2,1.45],send:[0,.06],dsend:[0,.08]},
        inserts:{prob:.5, max:1, pool:[["distort",{drive:[.3,.6],mix:[.5,.8]}]]}},   // the Memphis 808, clipping the tape
      lead:{patterns:["double","pentaup","sparse"], patchPool:["SYN-CLAV 1"], recipe:{model:["pluck","fm","dx7"],wave:"square",voices:[1,2],spread:[.002,.005],cutoff:[2000,3000],level:[.42,.54],send:[.25,.4],dsend:[.25,.4],attack:.003,release:[.06,.1],sustain:[.5,.62],fenv:[.4,.7]}},   // the cowbell-ish square pluck; ~1/3 DX7 syn-clav menace
      pads:{prob:.4, recipe:{model:["fm","saw"],wave:"sine",cutoff:[700,1200],detune:[.005,.011],attack:[1,2],level:[.36,.48],send:[.35,.5],dsend:[.1,.25]}},
      drums:{kickModel:["808"],snareModel:["crack","clap"],hatModel:["noise"],kick:[1.25,1.5],snare:[.8,1.05],hat:[.7,1],tune:[.85,1],send:[.1,.2],dsend:[.1,.25]},
      fx:{reverb:[.35,.5], delayBeats:[.5,.75], delayFb:[.25,.4], delayCut:[1800,2800], pump:[.05,.2], crackle:[.35,.6], lowcut:[25,40], highcut:[7000,10000], comp:[.35,.6], grit:[.2,.4]},   // TAPE: heavy hiss + soft top
      found:{role:"bed", vol:[.1,.18], pitch:[.7,.82], stretch:[.45,.6], cutoff:[1600,2600], sources:["vx_suspense","highway_night","factory"]},   // pitched-DOWN radio voices — the Memphis tape ghost
      stab:["off","sparse"], hits:{sources:["blues_vox_78","vox_c","sp_slowdown"], pattern:"dub", prob:.7, wet:true},
      form:"pop" },
    witchhouse: { label:"Witch house", info:"drowned rave: slowed 808 crawl, pitched-down voices, choirs in a cathedral of reverb",   // SAMPLE-FORWARD: the slowed voice is the ghost
      bpm:[60,76], swing:[0,.08], humanize:[.1,.3],
      progressions:["deep_two","mode_phrygian","drone_min"], kits:["trap","halftime"], fills:["downlift","off","reverse"],
      bass:{patterns:["sub","root","dub"], recipe:{model:["sub"],cutoff:[240,420],res:[.05,.15],level:[1.15,1.35],send:[.05,.15],dsend:[0,.08]}},
      lead:{patterns:["sparse","off","wander"], patchPool:["SYN-VOX","VOICES"], recipe:{model:["choir","fm","dx7"],wave:"sine",voices:[1,2],spread:[.002,.006],cutoff:[1800,2800],level:[.38,.5],send:[.5,.7],dsend:[.3,.5],vibrato:[.004,.01]}},   // ~1/3 the DX7 ghost-voices in the cathedral
      pads:{prob:1, samplerPool:["ahh_choir"], recipe:{model:["choir","saw","sampler","sampler"],wave:"saw",cutoff:[700,1200],detune:[.008,.016],attack:[2,4],level:[.6,.78],send:[.6,.8],dsend:[.15,.3]},
        inserts:{prob:.5, max:1, pool:[["chorus",{rate:[.1,.3],depth:[.5,.8],mix:[.4,.6]}]]}},   // the drowned choir doubles and smears
      drums:{kickModel:["808"],snareModel:["crack","noise"],hatModel:["noise"],kick:[1.1,1.35],snare:[.6,.85],hat:[.6,.9],tune:[.8,.95],send:[.2,.35],dsend:[.15,.35]},
      fx:{reverb:[.85,.95], delayBeats:[.75,1.5], delayFb:[.4,.6], delayCut:[1500,2500], pump:[0,.1], crackle:[0,.15], lowcut:[0,25], highcut:[0,0], comp:[.2,.4], grit:[.1,.3]},
      found:{role:"bed", vol:[.2,.32], pitch:[.55,.7], stretch:[.45,.6], cutoff:[1800,3000], sources:["vx_conet_swedish","vx_blake","vx_timelady"]},   // the haunted music box + tyger tyger + the time lady, ALL slowed to a crawl
      stab:["off"], hits:{sources:["vox_c","sp_pressure"], pattern:"dub", prob:.5, wet:true},
      form:"pop" },
    mallsoft: { label:"Mallsoft", info:"vaporwave's emptier atrium: slower, wetter, the time-lady and the fountain louder than the band",   // SAMPLE-FORWARD: the bed IS the architecture
      bpm:[48,60], swing:[0,.1], humanize:[.05,.2],   // BELOW vaporwave's floor — the escalator has stopped
      progressions:["royal_road","dream","pop_1625"], kits:["halftime","kick","off"], fills:["off","downlift"],
      bass:{patterns:["root","simple","off"], recipe:{model:["saw","sub"],cutoff:[400,700],res:[.05,.15],level:[.8,1],send:[.1,.2],dsend:[0,.08]}},
      lead:{patterns:["sparse","composed","off"], patchPool:["E.PIANO 4","SHIMMER"], samplerPool:["alto_sax"], recipe:{model:["stack","dx7","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[2400,3400],level:[.36,.48],send:[.5,.7],dsend:[.25,.45],vibrato:[.004,.009],attack:.1,release:[.5,.7],sustain:[.85,.95]}},   // ~1/3: the atrium EP/shimmer (alg-5 pair -> morphable)
      pads:{prob:1, samplerPool:["ahh_choir"], recipe:{model:["saw","choir","sampler"],wave:"saw",cutoff:[900,1500],detune:[.004,.01],attack:[2,4],level:[.6,.8],send:[.6,.8],dsend:[.1,.25]},
        inserts:{prob:.6, max:1, pool:[["chorus",{rate:[.15,.35],depth:[.5,.75],mix:[.4,.6]}]]}},   // the empty-atrium shimmer — dreampool chorus on the wash
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.75,1],snare:[.5,.75],hat:[.6,.9],tune:[.9,1.05],send:[.2,.35],dsend:[0,.1]},
      fx:{reverb:[.88,.96], delayBeats:[.75,1.5], delayFb:[.3,.45], delayCut:[2000,3000], pump:[0,.05], crackle:[.1,.3], lowcut:[0,0], highcut:[0,0], comp:[0,.15]},
      found:{role:"bed", vol:[.28,.4], pitch:[.6,.75], stretch:[.4,.55], cutoff:[2200,3400], sources:["vx_timelady","tokyo_station","vx_conet_swedish","shibuya","vx_wwvh"]},   // the beds PROMINENT — at the tone, the mall will close
      stab:["off"], hits:{sources:["sp_plaza","sp_shopping"], pattern:"sparse", prob:.5},
      form:"pop" },
    wintersynth: { label:"Wintersynth", info:"dungeon synth's snowfield: icy choir + tub bells over frost triads, a slow march through the pines",   // SYNTH-FORWARD: cold pads carry it
      bpm:[64,84], swing:[0,.05], humanize:[.15,.35],
      progressions:["frost","frost","frost","mode_phrygian"], kits:["halftime","halftime","kick"], fills:["off","downlift"],   // frost triads DOMINANT — seventh≈0 is the fence vs vaporwave/newage
      bass:{patterns:["root","sub","simple"], recipe:{model:["sub"],cutoff:[240,420],res:[.05,.15],level:[.85,1.05],send:[.15,.3],dsend:[0,.08]}},
      lead:{patterns:["wander","arpup","sparse"], patchPool:["TUB BELLS","ORCH-CHIME","CELESTE"], recipe:{model:["bell","fm","dx7"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[2200,3200],level:[.4,.52],send:[.5,.7],dsend:[.25,.4],vibrato:[.002,.006]}},   // icicle bells
      pads:{prob:1, recipe:{model:["choir","strings"],wave:"saw",cutoff:[800,1400],detune:[.005,.012],attack:[2.5,4.5],level:[.6,.8],send:[.55,.78],dsend:[.1,.25]},
        inserts:{prob:.4, max:1, pool:[["chorus",{rate:[.1,.25],depth:[.4,.6],mix:[.3,.5]}]]}},   // ice-crystal chorus, barely moving
      drums:{kickModel:["boom","808"],snareModel:["noise"],hatModel:["noise"],kick:[.75,1],snare:[.4,.6],hat:[.4,.7],tune:[.85,1],send:[.25,.4],dsend:[.05,.2]},
      fx:{reverb:[.8,.92], delayBeats:[1,1.5], delayFb:[.4,.6], delayCut:[1600,2600], pump:[0,.05], crackle:[0,.12], lowcut:[0,20], highcut:[0,0], comp:[.1,.3]},
      found:{role:"bed", vol:[.12,.22], pitch:[.6,.78], stretch:[.45,.6], cutoff:[1800,3000], sources:["highway_night","iriomote","vx_conet_swedish"]},   // pitched-down wind stand-ins
      stab:["off"], hits:{sources:["sp_herenow"], pattern:"sparse", prob:.15},
      form:"wave" },
    gabber: { label:"Gabber", info:"Rotterdam hammer: 150-185 distorted 909 four, hoover stabs, zero swing, maximum grit",   // SYNTH-FORWARD: the KICK is the genre
      bpm:[155,185], swing:[0,.03], humanize:[0,.08],
      progressions:["drone_min","deep_two","mode_phrygian"], kits:["four","techno"], fills:["impact","cut","riser","hat rush","stutter","stutter"],   // BRUTAL: the stutter-gate is very gabber
      bass:{patterns:["stab","drive","rolling"], recipe:{model:["acid","reese"],cutoff:[420,700],res:[.25,.4],level:[1.2,1.4],send:[0,.06],dsend:[0,.08]},
        inserts:{prob:.8, max:1, pool:[["distort",{drive:[.5,.9],mix:[.8,1]}]]}},   // everything into the red — the Rotterdam way
      lead:{patterns:["double","off","arpup"], recipe:{model:["stack"],wave:"saw",voices:[3,5],spread:[.008,.015],cutoff:[2200,3200],res:[.3,.45],level:[.46,.58],send:[.2,.35],dsend:[.2,.35],attack:.003,release:[.06,.1],sustain:[.5,.62],fenv:[.7,1.2]}},   // the hoover
      pads:{prob:.2, recipe:{model:["saw"],wave:"saw",cutoff:[600,1000],detune:[.008,.016],attack:[.5,1.5],level:[.3,.42],send:[.25,.4],dsend:[.1,.25]}},
      drums:{kickModel:["909"],snareModel:["clap","crack"],hatModel:["metal","noise"],kick:[1.5,1.8],snare:[.7,.95],hat:[.6,.9],tune:[1.05,1.2],send:[.05,.12],dsend:[.05,.15]},   // the kick DISTORTED LOUD (grit does the rest)
      fx:{reverb:[.25,.4], delayBeats:[.375,.5], delayFb:[.25,.4], delayCut:[2200,3400], pump:[.4,.7], crackle:[0,.05], lowcut:[30,45], highcut:[0,0], comp:[.6,.85], grit:[.6,.9], jux:[.15,.35]},
      found:{role:"chops", vol:[.1,.18], pitch:[.9,1.1], stretch:[.4,.6], cutoff:[2200,3600], sources:["factory","vx_xminusone"]},
      stab:["rave","offbeat"], hits:{sources:["rave_a","rave_c","bb_stab_a","sp_energy"], pattern:"offbeat", prob:.8},
      form:"dj" },
    psytrance: { label:"Psytrance", info:"Goa at 145: the rolling 16th acid bassline that never stops, phrygian squelch, full-power",   // SYNTH-FORWARD: the bassline is the drug
      bpm:[140,148], swing:[0,.03], humanize:[0,.08],
      progressions:["mode_phrygian","drone_min","deep_two"], kits:["four","pulse"], fills:["riser","cut","impact","hat rush"],
      bass:{patterns:["rolling","sixteenths"], recipe:{model:["acid"],cutoff:[380,650],res:[.25,.4],level:[1.2,1.4],send:[0,.05],dsend:[0,.06],release:[.06,.1],fenv:[.8,1.4]},
        inserts:{prob:.8, max:1, pool:[["filtersweep",{rateBars:[2,4],lo:[-1.2,-.6],hi:[1,1.8],res:[.35,.55]}]]}},   // THE rolling line — squelchy, relentless, and SWEPT across 2-4 bars (full-power)
      lead:{patterns:["arpup","sparse","hero","wander"], recipe:{model:["stack","pluck"],wave:"saw",voices:[2,3],spread:[.005,.01],cutoff:[2800,4000],res:[.2,.35],level:[.42,.54],send:[.3,.45],dsend:[.3,.45],attack:.004,release:[.07,.12],sustain:[.55,.68],fenv:[.6,1]}},
      pads:{prob:.7, recipe:{model:["saw"],wave:"saw",cutoff:[1000,1800],detune:[.008,.015],attack:[1,2],level:[.42,.56],send:[.4,.55],dsend:[.15,.3]}},
      drums:{kickModel:["909"],snareModel:["clap","noise"],hatModel:["noise","metal"],kick:[1.3,1.5],snare:[.5,.7],hat:[.8,1.1],tune:[1,1.1],send:[.08,.16],dsend:[.05,.15]},
      fx:{reverb:[.45,.6], delayBeats:[.375,.375], delayFb:[.4,.55], delayCut:[2400,3600], pump:[.35,.6], crackle:[0,.04], lowcut:[30,45], highcut:[0,0], comp:[.5,.7], grit:[.1,.3]},
      found:{role:"bed", vol:[.06,.12], pitch:[.75,.9], stretch:[.45,.6], cutoff:[1800,3000], sources:["frogs","iriomote"]},   // the night jungle behind the rig
      stab:["off","sparse"], hits:{sources:["rave_c","sp_energy"], pattern:"sparse", prob:.35},
      form:"dj" },
    minimal: { label:"Minimal", info:"techno with the air let out: a kick, five tiny percs, a dry room — every event audible",   // SYNTH-FORWARD: subtraction as composition
      bpm:[120,128], swing:[0,.05], humanize:[0,.1],
      progressions:["drone_min","drone_min","deep_two"], kits:["kick","kick","pulse"], fills:["off","cut","hat rush"],
      euclid:{hat:[5,16]},   // E(5,16) tiny rotating percs — the whole topography
      bass:{patterns:["rolling","stab","root"], recipe:{model:["sub","saw"],cutoff:[300,520],res:[.1,.2],level:[1,1.2],send:[0,.05],dsend:[0,.08]},
        inserts:{prob:.4, max:1, pool:[["filtersweep",{rateBars:[4,8],lo:[-.6,-.2],hi:[.3,.7],res:[.15,.3]}]]}},   // a whisper of a sweep — the only event for 8 bars, so it matters
      lead:{patterns:["off","off","sparse"], recipe:{model:["pluck"],wave:"sine",voices:[1,1],spread:[.001,.003],cutoff:[2000,3000],level:[.3,.4],send:[.2,.35],dsend:[.3,.5],attack:.003,release:[.04,.08],sustain:[.4,.55],fenv:[.4,.7]}},   // a blip, mostly absent
      pads:{prob:.25, recipe:{model:["saw","organ"],wave:"saw",cutoff:[600,1000],detune:[.004,.009],attack:[1.5,3],level:[.3,.42],send:[.2,.35],dsend:[.1,.2]}},
      drums:{kickModel:["909"],snareModel:["noise"],hatModel:["metal","noise"],kick:[1.2,1.4],snare:[.35,.55],hat:[.6,.9],tune:[1,1.1],send:[.03,.1],dsend:[.1,.25]},
      fx:{reverb:[.2,.35], delayBeats:[.75,.75], delayFb:[.35,.5], delayCut:[2400,3600], pump:[.08,.22], crackle:[0,.08], lowcut:[35,50], highcut:[0,0], comp:[.25,.4], grit:[.05,.2], jux:[.2,.4]},   // pump + comp BELOW techno's floor — the restraint is the point
      found:{role:"chops", vol:[.06,.12], pitch:[.95,1.1], stretch:[.4,.6], cutoff:[2200,3600], sources:["tokyo_station","vx_wwvh"]},
      stab:["off","sparse"], hits:{sources:["sp_system"], pattern:"sparse", prob:.25},
      form:"dj" },
    deephouse: { label:"Deep house", info:"house after midnight: subby bass, dusky 7th pads, the pump turned down and the lights low",   // SYNTH-FORWARD sibling of house
      bpm:[118,124], swing:[.08,.16], humanize:[.05,.18],
      progressions:["deep_two","house_min7","neosoul"], kits:["four","house"], fills:["off","hat rush","riser"],
      bass:{patterns:["rolling","dub","simple","syncopated"], recipe:{model:["sub"],cutoff:[280,450],res:[.05,.15],level:[1.1,1.3],send:[0,.06],dsend:[0,.05]}},
      lead:{patterns:["sparse","off","pentaup"], samplerPool:["muted_trumpet","vibraphone"], recipe:{model:["fm","pluck","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[1800,2800],level:[.36,.48],send:[.35,.5],dsend:[.25,.4],attack:.01,release:[.15,.25],sustain:[.65,.78]}},
      pads:{prob:1, patchPool:["E.PIANO 3","E.PIANO 4"], recipe:{model:["fm","organ","dx7"],wave:"sine",cutoff:[700,1200],detune:[.004,.01],attack:[.8,1.8],level:[.48,.62],send:[.35,.5],dsend:[.1,.2]},
        inserts:{prob:.4, max:1, pool:[["phaser",{rate:[.06,.18],depth:[.4,.6],mix:[.3,.5]}]]}},   // dusky, warm, BEHIND the groove — a lazy after-midnight phase
      drums:{kickModel:["909","808"],snareModel:["clap"],hatModel:["noise"],kick:[1.15,1.35],snare:[.5,.75],hat:[.7,1],tune:[.95,1.05],send:[.1,.2],dsend:[.05,.15]},
      fx:{reverb:[.5,.65], delayBeats:[.75,.75], delayFb:[.3,.45], delayCut:[2200,3200], pump:[.15,.35], crackle:[.05,.2], lowcut:[30,45], highcut:[0,0], comp:[.35,.55]},
      found:{role:"bed", vol:[.07,.13], pitch:[.85,1], stretch:[.45,.6], cutoff:[1800,2800], sources:["shibuya","tokyo_station","vx_timelady"]},
      stab:["off","sparse"], hits:{sources:["vox_b","sp_herenow"], pattern:"sparse", prob:.35},
      form:"dj" },
    coldwave: { label:"Coldwave", info:"post-punk synth gloom: bass-forward triads, dry drums, cassette hiss, everything at arm's length",   // SYNTH-FORWARD: dry = the aesthetic
      bpm:[100,118], swing:[0,.06], humanize:[.1,.25],
      progressions:["frost","sad_pop"], kits:["pulse","four"], fills:["drum fill","cut","off"],
      bass:{patterns:["drive","octaves","pedal"], recipe:{model:["saw"],cutoff:[600,950],res:[.12,.22],level:[1.2,1.4],send:[.02,.06],dsend:[0,.05]},
        inserts:{prob:.7, max:1, pool:[["chorus",{rate:[.5,.9],depth:[.5,.7],mix:[.5,.7]}]]}},   // the bass LEADS — through the post-punk chorus pedal (the Hook/Cure sound)
      lead:{patterns:["sparse","double","updown"], patchPool:["TUB BELLS","ORCH-CHIME"], recipe:{model:["stack","stack","dx7"],wave:"square",voices:[1,2],spread:[.002,.006],cutoff:[2000,3000],level:[.4,.52],send:[.15,.3],dsend:[.15,.3],attack:.005,release:[.1,.18],sustain:[.6,.72],fenv:[.2,.4]}},   // ~1/3 cold DX7 bells at arm's length (alg-5 pair -> morphable)
      pads:{prob:.7, recipe:{model:["strings","saw"],wave:"saw",cutoff:[900,1400],detune:[.004,.01],attack:[.8,1.8],level:[.35,.48],send:[.15,.3],dsend:[.05,.15]}},
      drums:{kickModel:["boom","909"],snareModel:["noise"],hatModel:["noise"],kick:[1.05,1.25],snare:[.8,1.05],hat:[.7,1],tune:[.9,1.05],send:[.05,.12],dsend:[0,.08]},   // DRY drums — no gated wash
      fx:{reverb:[.18,.32], delayBeats:[.5,.5], delayFb:[.2,.35], delayCut:[2200,3200], pump:[0,.1], crackle:[.15,.35], lowcut:[25,40], highcut:[0,0], comp:[.25,.45], grit:[.05,.2]},   // cassette hiss instead of reverb
      found:{role:"bed", vol:[.06,.12], pitch:[.8,.95], stretch:[.45,.6], cutoff:[1500,2500], sources:["factory","highway_night"]},
      stab:["off"], hits:{sources:["sp_pressure","vox_c"], pattern:"sparse", prob:.3},
      form:"pop" },
    ebm: { label:"EBM", info:"body music: 16th-note bass stabs like pistons, claps that snap, a shout in the machine hall",   // SYNTH-FORWARD: the sequencer is the muscle
      bpm:[118,130], swing:[0,.04], humanize:[0,.1],
      progressions:["deep_two","mode_phrygian","drone_min"], kits:["pulse","techno"], fills:["cut","impact","hat rush","stutter"],
      bass:{patterns:["sixteenths","stab","drive","pedal"], recipe:{model:["reese","acid"],cutoff:[350,560],res:[.2,.35],level:[1.2,1.4],send:[0,.06],dsend:[0,.08],release:[.05,.09],fenv:[.5,.9]},
        inserts:{prob:.7, max:1, pool:[["distort",{drive:[.35,.65],mix:[.7,1]}]]}},   // THE 16th piston line, overdriven — body music muscle
      lead:{patterns:["double","sparse","off"], recipe:{model:["stack","vocoder"],wave:"square",voices:[1,2],spread:[.003,.007],cutoff:[2200,3200],res:[.25,.4],level:[.42,.54],send:[.15,.3],dsend:[.2,.35],attack:.003,release:[.05,.09],sustain:[.5,.62],fenv:[.5,.9]}},   // barked vocoder stabs
      vocSource:"sp_pressure",
      pads:{prob:.3, recipe:{model:["saw"],wave:"saw",cutoff:[700,1100],detune:[.005,.011],attack:[.5,1.5],level:[.3,.42],send:[.2,.35],dsend:[.1,.2]}},
      drums:{kickModel:["909"],snareModel:["clap","crack"],hatModel:["metal"],kick:[1.3,1.5],snare:[.85,1.1],hat:[.7,1],tune:[.9,1.05],send:[.05,.12],dsend:[.1,.25]},
      fx:{reverb:[.3,.45], delayBeats:[.5,.5], delayFb:[.25,.4], delayCut:[2200,3400], pump:[.2,.45], crackle:[0,.06], lowcut:[30,45], highcut:[0,0], comp:[.5,.7], grit:[.4,.7], jux:[.15,.35]},
      found:{role:"bed", vol:[.08,.15], pitch:[.75,.9], stretch:[.45,.6], cutoff:[1800,3000], sources:["factory","vx_conet_poacher"]},   // the plant hums BEHIND (industrial owns the chops)
      stab:["offbeat","sparse"], hits:{sources:["sp_pressure","sp_system","rave_d"], pattern:"dub", prob:.6},
      form:"dj" },
    krautrock: { label:"Krautrock", info:"motorik on the autobahn: organ drones over the eternal pulse, one chord for a very long time",   // SYNTH-FORWARD: repetition is the destination
      bpm:[102,118], swing:[0,.05], humanize:[.05,.18],
      progressions:["funk_vamp","deep_two","mode_mixo"], kits:["pulse","four"], fills:["off","drum fill","riser"],
      bass:{patterns:["drive","root","pedal"], recipe:{model:["saw","modeld"],cutoff:[600,950],res:[.1,.18],level:[1.05,1.25],send:[.03,.08],dsend:[0,.05],
        glide:[20,40],envAmount:[.4,1],envDecay:[.25,.5],oscMix:[.1,.4],drift:[5,10]}},   // half the seeds: a droning Model-D under the motorik — shallow slow filter env, more drift than punch (the eternal pulse breathes)
      lead:{patterns:["motorik","wander","sparse"], recipe:{model:["stack","organ"],wave:"square",voices:[1,2],spread:[.002,.006],cutoff:[2200,3200],level:[.42,.54],send:[.2,.35],dsend:[.25,.4],attack:.005,release:[.08,.14],sustain:[.6,.72]}},   // the sequencer arp borrowed back from transitwave
      pads:{prob:1, patchPool:["E.ORGAN 2","E.ORGAN 3","60-S ORGAN"], samplerPool:["church_organ","percussive_organ"], recipe:{model:["organ","dx7","sampler","sampler"],wave:"saw",cutoff:[800,1300],detune:[.004,.01],attack:[1.5,3],level:[.5,.65],send:[.3,.45],dsend:[.1,.2]},
        inserts:{prob:.6, max:1, pool:[["phaser",{rate:[.1,.3],depth:[.5,.8],mix:[.4,.6]}]]}},   // ORGAN DRONES — the harmonium in the barn, through the kosmische phaser (Autobahn-issue)
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[1.1,1.3],snare:[.55,.8],hat:[.8,1.1],tune:[.95,1.05],send:[.08,.16],dsend:[0,.08]},   // dry live-room motorik
      fx:{reverb:[.3,.45], delayBeats:[.5,.75], delayFb:[.25,.4], delayCut:[2400,3600], pump:[0,.1], crackle:[.1,.25], lowcut:[25,40], highcut:[0,0], comp:[.25,.45], grit:[.05,.2]},
      found:{role:"bed", vol:[.15,.25], pitch:[.85,1], stretch:[.45,.6], cutoff:[2000,3200], sources:["highway_night","factory"]},   // the autobahn ITSELF, near natural pitch
      stab:["off"], hits:{sources:["sp_herenow","vox_a"], pattern:"sparse", prob:.25},
      form:"dj" },
    newjack: { label:"New jack swing", info:"swingbeat: bouncing kicks under HUGE claps, FM synth-bass, everything grinning",   // SYNTH-FORWARD: the drum program is the producer's signature
      bpm:[100,115], swing:[.16,.28], humanize:[.1,.25],
      progressions:["house_min7","funk_vamp","neosoul"], kits:["newjack"], fills:["drum fill","hat rush","riser","snare roll"],
      bass:{patterns:["stab","melodic","dub","syncopated"], patchPool:["SYN-BASS 2","BASS    2"], samplerPool:["fretless_bass"], recipe:{model:["dx7","saw","sampler"],cutoff:[400,540],res:[.1,.2],level:[1.05,1.25],send:[0,.06],dsend:[0,.06]}},   // the DX7 SYN-BASS pair (alg 17 both -> morphable) — Teddy Riley's engine room
      lead:{patterns:["pentaup","double","updown"], patchPool:["CLAV-E.PNO","FUNK CLAV"], samplerPool:["bright_yamaha_grand"], recipe:{model:["fm","dx7","sampler"],wave:"pulse",voices:[1,2],spread:[.002,.005],cutoff:[2600,3600],level:[.44,.56],send:[.25,.4],dsend:[.2,.35],attack:.004,release:[.07,.12],sustain:[.6,.72],fenv:[.3,.6]},
        inserts:{prob:.5, max:1, pool:[["chorus",{rate:[.6,1.1],depth:[.4,.6],mix:[.4,.55]}]]}},   // grinning FM keys, chorused wide
      pads:{prob:.8, recipe:{model:["organ"],wave:"saw",cutoff:[1100,1700],detune:[.003,.008],attack:[.15,.5],level:[.42,.56],send:[.25,.4],dsend:[.05,.15]}},   // stabby ORGAN hits, always — the church chord under the swing (and the fence vs all-synth transitwave)
      drums:{kickModel:["909","boom"],snareModel:["clap"],hatModel:["noise"],kick:[1.1,1.3],snare:[1,1.25],hat:[.8,1.1],tune:[.95,1.1],send:[.15,.25],dsend:[.05,.15]},   // the CLAP is the star
      fx:{reverb:[.35,.5], delayBeats:[.375,.5], delayFb:[.2,.35], delayCut:[2600,3800], pump:[.05,.2], crackle:[0,.12], lowcut:[30,45], highcut:[0,0], comp:[.35,.55]},
      found:{role:"bed", vol:[.06,.12], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[1800,2800], sources:["shibuya","vx_timelady"]},
      stab:["off","sparse"], hits:{sources:["vox_a","sp_rhythm","rave_b"], pattern:"offbeat", prob:.6},
      form:"pop" },
    breakcore: { label:"Breakcore", info:"the amen at 190, shredded: euclid kicks fighting the chops, rave hits everywhere, maximum jux",   // SAMPLE-FORWARD: the break, weaponized
      bpm:[172,198], swing:[0,.06], humanize:[.2,.4],
      progressions:["minor_run","mode_phrygian","deep_two"], kits:["jungle","breaks"], fills:["break fill","impact","cut","noise","stutter"],
      euclid:{kick:[5,16]},   // E(5,16) kicks punching THROUGH the amen
      bass:{patterns:["sub","stab","dub"], recipe:{model:["sub","reese"],cutoff:[240,440],res:[.1,.25],level:[1.2,1.45],send:[0,.05],dsend:[0,.08]},
        inserts:{prob:.5, max:1, pool:[["distort",{drive:[.4,.8],mix:[.6,.9]}]]}},   // the reese shredded along with the break
      lead:{patterns:["off","sparse","double"], recipe:{model:["pluck","fuzz"],wave:"saw",voices:[1,2],spread:[.003,.008],cutoff:[2400,3600],res:[.2,.35],level:[.4,.52],send:[.25,.4],dsend:[.3,.5],attack:.003,release:[.05,.09],sustain:[.5,.62],fenv:[.5,.9]}},
      pads:{prob:.2, recipe:{model:["saw"],wave:"saw",cutoff:[600,1000],detune:[.008,.016],attack:[1,2.5],level:[.3,.42],send:[.35,.5],dsend:[.15,.3]}},
      drums:{kickModel:["909","808"],snareModel:["crack"],hatModel:["noise","metal"],kick:[1.3,1.55],snare:[.8,1.05],hat:[.5,.8],tune:[1.05,1.2],send:[.05,.12],dsend:[.15,.35]},
      fx:{reverb:[.3,.5], delayBeats:[.375,.75], delayFb:[.35,.5], delayCut:[2000,3200], pump:[.05,.25], crackle:[0,.15], lowcut:[25,40], highcut:[0,0], comp:[.55,.8], grit:[.4,.7], jux:[.45,.75]},   // stereo chaos
      found:{role:"break", vol:[.32,.45], pitch:[1,1], stretch:[.5,.5], cutoff:[6000,9000], sources:["amen_165","amen_170","amen_172","amen_175"]},   // the break LOUD, wide open, re-sliced every chord
      stab:["rave","offbeat"], hits:{sources:["rave_a","rave_d","bb_stab_b","sp_rewind"], pattern:"dub", prob:.85},
      form:"drop" },
    acidhouse: { label:"Acid house", info:"1988 Chicago: the 303 squelching over a dusty four-floor, smiley-face simple everything else",   // SYNTH-FORWARD: one machine, misused, forever
      bpm:[118,126], swing:[0,.08], humanize:[.05,.15],
      progressions:["house_min7","drone_min","funk_vamp"], kits:["house","four"], fills:["hat rush","riser","cut"],
      bass:{patterns:["rolling","sixteenths","stab"], recipe:{model:["acid"],cutoff:[420,700],res:[.35,.5],level:[1.15,1.35],send:[0,.06],dsend:[0,.1],release:[.08,.14],fenv:[1,2]},
        inserts:{prob:.75, max:1, pool:[["filtersweep",{rateBars:[1,2],lo:[-.8,-.3],hi:[1,1.6],res:[.4,.6]}]]}},   // THE 303 — resonance and fenv cranked, the squelch; the knob-rider sweeps it every bar or two
      lead:{patterns:["off","sparse","double"], recipe:{model:["pluck"],wave:"square",voices:[1,2],spread:[.002,.005],cutoff:[2400,3400],level:[.36,.48],send:[.2,.35],dsend:[.2,.35],attack:.004,release:[.06,.1],sustain:[.5,.62],fenv:[.4,.7]}},
      pads:{prob:.35, recipe:{model:["organ","saw"],wave:"saw",cutoff:[800,1300],detune:[.004,.009],attack:[.2,.6],level:[.34,.46],send:[.25,.4],dsend:[.1,.2]}},
      drums:{kickModel:["909"],snareModel:["clap"],hatModel:["noise"],kick:[1.15,1.35],snare:[1,1.25],hat:[.9,1.2],tune:[.95,1.1],send:[.1,.2],dsend:[.05,.15]},
      fx:{reverb:[.35,.5], delayBeats:[.5,.75], delayFb:[.25,.4], delayCut:[2400,3600], pump:[.3,.5], crackle:[.1,.28], lowcut:[30,45], highcut:[0,0], comp:[.4,.6]},   // warehouse dust on the record
      found:{role:"bed", vol:[.06,.12], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[1800,2800], sources:["shibuya","tokyo_station"]},
      stab:["rave","offbeat"], hits:{sources:["rave_b","rave_c","sp_rhythm"], pattern:"offbeat", prob:.7},
      form:"dj" },
    surfrock: { label:"Surf rock", info:"reverb-tank twang: tremolo guitar over a fast doo-wop, drums like breakers, 45rpm dust",   // guitar-FORWARD: the spring tank is the room
      bpm:[126,144], swing:[.06,.14], humanize:[.15,.35],
      progressions:["doo_wop","sad_pop","andalusian"], kits:["open","four"], fills:["drum fill","tom fill","hat rush"],
      bass:{patterns:["walking","octaves"], recipe:{model:["saw"],cutoff:[600,950],res:[.08,.16],level:[1,1.2],send:[.03,.08],dsend:[0,.05]}},
      lead:{patterns:["double","updown","hero"], samplerPool:["steel_string_guitar","jazz_guitar"], recipe:{model:["sampler","sampler","sampler","guitar"],wave:"saw",voices:[1,2],spread:[.001,.004],cutoff:[3000,4200],level:[.52,.64],send:[.3,.45],dsend:[.1,.2],vibrato:[.006,.012],vibRate:[6,7.5]}},   // the TWANG — the REAL steel-string leads 2/3; the pm.lib waveguide keeps 1/3 (the A/B lives in the pool)
      pads:{prob:.4, recipe:{model:["organ"],wave:"saw",cutoff:[1200,1800],detune:[.003,.008],attack:[.1,.4],level:[.36,.48],send:[.2,.35],dsend:[.05,.12]}},   // a Farfisa in the corner
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[1,1.2],snare:[.85,1.1],hat:[.8,1.1],tune:[.95,1.1],send:[.2,.32],dsend:[0,.08]},
      fx:{reverb:[.4,.55], delayBeats:[.375,.375], delayFb:[.15,.28], delayCut:[2600,3800], pump:[0,.08], crackle:[.15,.35], lowcut:[25,40], highcut:[0,0], comp:[.2,.4], grit:[0,.1]},   // short slapback = the spring tank
      found:{role:"bed", vol:[.1,.18], pitch:[.9,1], stretch:[.45,.6], cutoff:[2400,3800], sources:["iriomote","frogs"]},   // actual surf, near natural pitch
      stab:["off"], hits:{sources:["vox_a","sp_rhythm"], pattern:"sparse", prob:.4},
      form:"pop" },
    spacelounge: { label:"Space lounge", info:"bachelor-pad cosmos: theremin-vibrato sine over organ chords, Apollo crackle, a very dry martini",   // sample-mid: mission audio as furniture
      bpm:[86,100], swing:[.1,.2], humanize:[.2,.4],   // above downtempo's 60-90 core
      progressions:["dream","mode_lydian","ii_v_i"], kits:["kick","kick","halftime"], fills:["off","downlift"],
      bass:{patterns:["simple","root","walking"], recipe:{model:["sub","piano"],cutoff:[350,650],res:[.05,.12],level:[.85,1.05],send:[.08,.16],dsend:[0,.06]}},
      lead:{patterns:["wander","sparse","pentaup"], samplerPool:["clarinet","flute","vibraphone","celesta"], recipe:{model:["sampler","sampler","sampler","stack","modeld"],wave:"sine",voices:[1,1],spread:[.001,.003],cutoff:[2600,3800],level:[.44,.56],send:[.45,.65],dsend:[.2,.35],vibrato:[.014,.022],vibRate:[5.5,6.5],attack:.06,release:[.3,.5],sustain:[.85,.95],
        glide:[80,150],envAmount:[.5,1.2],envDecay:[.3,.6],oscMix:[0,.3],drift:[6,12],drive:[.05,.2]}},   // a REAL clarinet/flute takes the melody 3/5 of seeds; the theremin-sine keeps its corner, and 1/5: a soft gliding Model-D — the ondes-martenot swoop, long portamento
      pads:{prob:1, recipe:{model:["organ"],wave:"saw",cutoff:[1000,1600],detune:[.003,.008],attack:[1.5,3],level:[.5,.65],send:[.5,.7],dsend:[.1,.2]},
        inserts:{prob:.35, max:1, pool:[["phaser",{rate:[.05,.15],depth:[.4,.6],mix:[.3,.45]}]]}},   // ALWAYS the organ — the acoustic fence vs downtempo/vaporwave; a lava-lamp phase, sometimes
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.7,.95],snare:[.4,.6],hat:[.5,.8],tune:[.95,1.1],send:[.2,.35],dsend:[0,.1]},
      fx:{reverb:[.7,.85], delayBeats:[.75,1], delayFb:[.3,.45], delayCut:[2200,3200], pump:[0,0], crackle:[.08,.22], lowcut:[0,20], highcut:[0,0], comp:[.05,.2]},
      found:{role:"bed", vol:[.18,.3], pitch:[.8,.95], stretch:[.45,.6], cutoff:[2400,3800], sources:["vx_apollo","iriomote","vx_timelady"]},   // Houston, softly, under the vibraphone lights
      stab:["off"], hits:{sources:["sp_herenow","vox_b"], pattern:"sparse", prob:.3},
      form:"pop" },
    // ---- world cluster (honest interpretations; source-shelf gaps noted per anchor) ----
    arabpop: { label:"Arab pop", info:"hijaz color over a darbuka-science kit: MAJOR tonic against bII, ornamental vibrato lead",   // INTERPRETATION: no oud/qanun models — brass+fm ornaments carry the maqam flavor
      bpm:[95,115], swing:[.02,.1], humanize:[.15,.3],
      progressions:["hijaz","hijaz","andalusian","mode_phrygian"], kits:["tribal","breaks"], fills:["drum fill","tom fill","off"],
      euclid:{kick:[5,16]},   // E(5,16) dum-tek placement rotating under the hand drums
      bass:{patterns:["root","simple","octaves"], recipe:{model:["saw","sub"],cutoff:[450,750],res:[.08,.16],level:[.95,1.15],send:[.05,.12],dsend:[0,.06]}},
      lead:{patterns:["wander","pentaup","updown","sparse"], samplerPool:["oboe"], recipe:{model:["fm","brass","sampler","sampler"],wave:"sine",voices:[1,2],spread:[.002,.005],cutoff:[2400,3400],level:[.5,.62],send:[.3,.45],dsend:[.2,.35],vibrato:[.012,.02],vibRate:[6,7.5]}},   // the ORNAMENT: fast deep vibrato = the closest the shelf gets to a mawwal melisma
      pads:{prob:.9, samplerPool:["strings"], recipe:{model:["strings","choir","sampler"],wave:"saw",cutoff:[1000,1600],detune:[.004,.01],attack:[.8,1.8],level:[.45,.6],send:[.3,.45],dsend:[.1,.2]}},
      drums:{kickModel:["808","boom"],snareModel:["crack"],hatModel:["noise"],kick:[1.1,1.3],snare:[.7,.95],hat:[.9,1.2],tune:[1.05,1.2],send:[.1,.2],dsend:[.1,.25]},   // tuned UP = the tek ringing
      fx:{reverb:[.45,.6], delayBeats:[.5,.75], delayFb:[.25,.4], delayCut:[2200,3400], pump:[0,.1], crackle:[.05,.2], lowcut:[25,40], highcut:[0,0], comp:[.25,.45]},
      found:{role:"bed", vol:[.08,.15], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[2000,3200], sources:["shibuya","frogs"]},   // HONESTY: no Arab-world recording on the shelf yet — generic city/night beds sit far back
      stab:["off"], hits:{sources:["vox_b","sp_rhythm"], pattern:"sparse", prob:.4},
      form:"pop" },
    tango: { label:"Tango", info:"the habanera cell as law: sampled bandoneon over staccato piano and dry marcato strings, 78rpm dust, dramatic silence",   // acoustic-FORWARD: 2026-07 ear-fix — the SYNTH voices are out of the front line
      bpm:[100,124], swing:[0,.06], humanize:[.3,.55],
      progressions:["andalusian","andalusian","minor_run"],   // STRICTLY minor. frost PURGED (it was the verifier's triad fence, but it read as wintersynth pads by ear — the human heard it)
      kits:["kick","off"], fills:["off","downlift"],
      bass:{patterns:["habanera"], recipe:{model:["piano"],cutoff:[700,1200],res:[.05,.12],level:[1,1.2],send:[.06,.12],dsend:[0,.05]}},   // DUM..da-DUM-DUM, PIANO only — nothing else matters
      lead:{patterns:["canon","wander","sparse"], samplerPool:["bandoneon"], recipe:{model:["sampler"],wave:"sine",voices:[1,2],spread:[.001,.003],cutoff:[2600,3800],level:[.55,.68],send:[.22,.34],dsend:[.02,.08],attack:.006,release:[.06,.11],sustain:[.5,.62]}},   // THE BANDONEON (FluidR3 GM 23), hard staccato, always — the voice of the genre
      pads:{prob:.3, samplerPool:["strings"], recipe:{model:["sampler","strings"],wave:"saw",cutoff:[1100,1700],detune:[.003,.008],attack:[.1,.3],level:[.28,.38],send:[.18,.3],dsend:[.03,.1]}},   // mostly ABSENT; when present: quiet fast-attack section stabs (sampled ensemble half the time), never a wash
      drums:{kickModel:["boom"],snareModel:["noise"],hatModel:["noise"],kick:[.6,.85],snare:[.4,.6],hat:[.3,.5],tune:[.95,1.1],send:[.1,.2],dsend:[0,.05]},
      fx:{reverb:[.3,.42], delayBeats:[.5,.75], delayFb:[.08,.16], delayCut:[2200,3200], pump:[0,0], crackle:[.15,.35], lowcut:[0,25], highcut:[0,0], comp:[.1,.3]},   // DRY band, no echo wash — the milonga room, not the cathedral
      found:{role:"bed", vol:[.06,.12], pitch:[.8,.95], stretch:[.45,.6], cutoff:[1800,2800], sources:["vx_suspense","tokyo_station"]},   // old-radio air stands in, low (the bandoneon itself is real now)
      rubato:{depth:[.02,.035], periodBars:[2,4], prob:.5},   // half the seeds breathe — tango rubato is real but the habanera stays the law
      stab:["off"], hits:{sources:["horns_78","blues_vox_78"], pattern:"sparse", prob:.35},
      form:"pop" },
    afrobeat: { label:"Afrobeat", info:"the long groove: interlocking euclid percussion, organ stabs on a dorian vamp, horn-section hits — one chord until it means something",   // groove-FORWARD: Fela's arithmetic
      bpm:[100,114], swing:[.04,.12], humanize:[.15,.3],   // below disco's 106-124 core
      progressions:["funk_vamp","mode_dorian","house_min"], kits:["tribal","house"], fills:["drum fill","hat rush","off"],
      euclid:{kick:[3,16],hat:[11,16]},   // tresillo kicks INTERLOCKING with E(11,16) shekere hats — two clocks arguing politely
      bass:{patterns:["melodic","dub","stab","syncopated"], recipe:{model:["saw","sub"],cutoff:[500,850],res:[.08,.16],level:[1.05,1.25],send:[.03,.08],dsend:[0,.05]}},
      lead:{patterns:["double","pentaup","sparse"], samplerPool:["trumpet","tenor_sax"], recipe:{model:["brass","sampler","sampler"],wave:"saw",voices:[1,2],spread:[.002,.005],cutoff:[2800,3800],level:[.5,.62],send:[.25,.4],dsend:[.1,.2],attack:.01}},   // the HORN SECTION — 1/3 of seeds a real trumpet fronts it
      pads:{prob:.9, patchPool:["MARIMBA","LOG DRUM"], recipe:{model:["organ","organ","dx7"],wave:"saw",cutoff:[1100,1700],detune:[.003,.008],attack:[.1,.4],level:[.46,.6],send:[.2,.35],dsend:[.05,.12]}},   // tight organ stabs; ~1/3 DX7 marimba/log-drum comping (the Fela balafon color)
      drums:{kickModel:["boom","808"],snareModel:["noise","crack"],hatModel:["noise"],kick:[1.05,1.25],snare:[.6,.85],hat:[1,1.3],tune:[1,1.1],send:[.08,.16],dsend:[.05,.12]},
      fx:{reverb:[.3,.45], delayBeats:[.5,.75], delayFb:[.2,.35], delayCut:[2600,3800], pump:[0,.1], crackle:[.1,.25], lowcut:[25,40], highcut:[0,0], comp:[.3,.5]},
      found:{role:"bed", vol:[.1,.18], pitch:[.9,1.05], stretch:[.45,.6], cutoff:[2200,3400], sources:["frogs","shibuya"]},   // HONESTY: no Lagos shelf — night chorus + street stand in quietly
      stab:["off","sparse"], hits:{sources:["horns_78","sp_rhythm","vox_a"], pattern:"offbeat", prob:.7},   // the 78rpm horns finally play a section part
      form:"dj" },
    desertblues: { label:"Desert blues", info:"Sahel guitar hypnosis: pentatonic loops over a lope, handclap air, tape-worn top end",   // guitar-FORWARD: one riff, circling
      bpm:[84,104], swing:[.06,.16], humanize:[.2,.4],
      progressions:["funk_vamp","mode_dorian","deep_two"], kits:["shuffle","halftime","boombap"], fills:["off","off","drum fill"],   // the triplet shuffle lopes 1/3 of seeds
      bass:{patterns:["simple","dub","root"], recipe:{model:["sub"],cutoff:[300,520],res:[.05,.12],level:[1,1.2],send:[.03,.08],dsend:[0,.05]}},
      lead:{patterns:["pentaup","blues","wander"], samplerPool:["steel_string_guitar","nylon_string_guitar","harmonica"], recipe:{model:["sampler","sampler","sampler","guitar"],wave:"saw",voices:[1,2],spread:[.001,.004],cutoff:[3000,4200],level:[.52,.64],send:[.25,.4],dsend:[.15,.3],vibrato:[.004,.009]}},   // the circling guitar — the REAL sampled strings lead 2/3; waveguide keeps a chair
      pads:{prob:.5, recipe:{model:["organ"],wave:"saw",cutoff:[900,1400],detune:[.003,.008],attack:[.5,1.2],level:[.36,.48],send:[.25,.4],dsend:[.05,.15]}},
      drums:{kickModel:["808","boom"],snareModel:["noise"],hatModel:["noise"],kick:[1,1.2],snare:[.55,.8],hat:[.6,.9],tune:[.9,1.05],send:[.1,.2],dsend:[.05,.15]},
      fx:{reverb:[.35,.5], delayBeats:[.5,.75], delayFb:[.2,.35], delayCut:[2000,3000], pump:[0,.05], crackle:[.2,.45], lowcut:[0,30], highcut:[8000,12000], comp:[.15,.35]},   // tape-worn: hiss + soft top
      found:{role:"bed", vol:[.12,.2], pitch:[.8,.95], stretch:[.45,.6], cutoff:[1800,3000], sources:["highway_night","frogs"]},   // HONESTY: no Sahara shelf — wind-adjacent beds pitched down
      stab:["off"], hits:{sources:["blues_vox_78","vox_b"], pattern:"sparse", prob:.4},
      form:"pop" },
    // ---- harder cluster (fuzz/grit the engine can voice HONESTLY — riffs, not fake shredding) ----
    sludgemetal: { label:"Sludge metal", info:"downtuned fuzz crawling at 60: halftime stomp, a BIG backbeat, the amp about to die",   // fuzz-FORWARD: the riff exhales, the room shakes
      bpm:[52,70], swing:[0,.06], humanize:[.1,.3],
      progressions:["mode_phrygian","drone_min","deep_two"], kits:["halftime","kick"], fills:["impact","off","downlift"],
      bass:{patterns:["root","sub","dub"], recipe:{model:["reese","sub"],cutoff:[200,360],res:[.05,.15],level:[1.25,1.5],send:[.05,.12],dsend:[0,.06]},
        inserts:{prob:.85, max:1, pool:[["distort",{drive:[.6,1],mix:[.8,1]}]]}},   // downtuned wall — the amp about to die IS the bass tone
      lead:{patterns:["double","blues","sparse"], recipe:{model:["fuzz"],wave:"saw",voices:[1,2],spread:[.003,.008],cutoff:[1400,2200],res:[.25,.4],drive:[.7,1],level:[.5,.62],send:[.3,.45],dsend:[.15,.3],attack:.01,release:[.2,.35],sustain:[.8,.95]}},   // THE RIFF — long sustained fuzz, low
      pads:{prob:.4, recipe:{model:["saw"],wave:"saw",cutoff:[500,900],detune:[.008,.016],attack:[2,4],level:[.4,.55],send:[.35,.5],dsend:[.1,.25]}},
      drums:{kickModel:["boom","808"],snareModel:["noise","crack"],hatModel:["noise"],kick:[1.35,1.6],snare:[.9,1.15],hat:[.4,.7],tune:[.75,.9],send:[.15,.28],dsend:[.05,.15]},   // snare UP — the stomp (vs doomdrone's buried kit)
      fx:{reverb:[.4,.6], delayBeats:[.75,1], delayFb:[.25,.4], delayCut:[1600,2600], pump:[0,.1], crackle:[.05,.2], lowcut:[0,25], highcut:[0,0], comp:[.5,.75], grit:[.65,.95]},   // grit MAXED
      found:{role:"bed", vol:[.15,.25], pitch:[.55,.7], stretch:[.45,.6], cutoff:[1400,2400], sources:["factory","highway_night"]},   // the plant, pitched into the swamp
      stab:["off"], hits:{sources:["sp_pressure","vox_c"], pattern:"sparse", prob:.3},
      form:"pop" },
    industrialmetal: { label:"Industrial metal", info:"the machine with a backbeat: halftime slam, fuzz stabs on the grid, everything quantized and furious",   // fuzz-FORWARD sibling of EBM: SLAM where EBM pistons
      bpm:[100,126], swing:[0,.05], humanize:[0,.12],
      progressions:["mode_phrygian","minor_run","drone_min"], kits:["halftime","breaks"], fills:["impact","cut","noise"],
      bass:{patterns:["stab","drive","sub"], recipe:{model:["reese"],cutoff:[280,480],res:[.15,.3],level:[1.15,1.35],send:[0,.06],dsend:[0,.08]},
        inserts:{prob:.8, max:1, pool:[["distort",{drive:[.5,.9],mix:[.8,1]}]]}},   // quantized fury — the reese through the wall of Marshalls
      lead:{patterns:["double","sparse","off"], recipe:{model:["fuzz","stack"],wave:"saw",voices:[1,2],spread:[.003,.008],cutoff:[1800,2800],res:[.25,.4],drive:[.6,.9],level:[.46,.58],send:[.2,.35],dsend:[.2,.35],attack:.004,release:[.08,.15],sustain:[.5,.65],fenv:[.4,.8]}},   // fuzz STABS, quantized — not a solo
      pads:{prob:.35, recipe:{model:["saw"],wave:"saw",cutoff:[600,1000],detune:[.006,.013],attack:[.8,2],level:[.32,.45],send:[.25,.4],dsend:[.1,.2]}},
      drums:{kickModel:["909","808"],snareModel:["crack","clap"],hatModel:["metal"],kick:[1.3,1.55],snare:[1,1.3],hat:[.5,.8],tune:[.85,1],send:[.1,.2],dsend:[.1,.25]},   // the SLAM snare
      fx:{reverb:[.35,.5], delayBeats:[.5,.5], delayFb:[.25,.4], delayCut:[2000,3000], pump:[.1,.3], crackle:[0,.1], lowcut:[25,40], highcut:[0,0], comp:[.55,.8], grit:[.6,.9], jux:[.2,.45]},
      found:{role:"bed", vol:[.12,.2], pitch:[.7,.85], stretch:[.45,.6], cutoff:[1600,2800], sources:["factory","vx_conet_poacher"]},
      stab:["off","sparse"], hits:{sources:["sp_system","sp_pressure","rave_d"], pattern:"dub", prob:.6},
      form:"pop" },
    darksynth: { label:"Darksynth", info:"synthwave's violent sibling at 140: distorted supersaw + fuzz trading, phrygian menace, the chase scene",   // SYNTH-FORWARD: the night drive turned hostile
      bpm:[122,136], swing:[0,.05], humanize:[0,.12],   // UNDER dubstep's 133-148 core — chase-scene tempo, not halftime wobble
      progressions:["mode_phrygian","andalusian","epic_min"], kits:["pulse","four"], fills:["impact","riser","tom fill","cut"],
      bass:{patterns:["drive","octaves","sixteenths","pedal"], recipe:{model:["reese","modeld"],cutoff:[350,600],res:[.15,.3],level:[1.15,1.35],send:[0,.06],dsend:[0,.06],
        glide:[20,40],envAmount:[1.2,2.2],envDecay:[.08,.16],oscMix:[.5,.9]},
        inserts:{prob:.7, max:1, pool:[["distort",{drive:[.35,.65],mix:[.7,.95]}]]}},   // the chase-scene reese OR a snarling pulse-heavy Model-D, subtle glide (modeld's own drive comes from the lead-shared key below being absent — envelope does the menace)
      lead:{patterns:["hero","double","updown"], recipe:{model:["stack","fuzz","modeld"],wave:"saw",voices:[4,6],spread:[.01,.018],cutoff:[2600,3800],res:[.2,.35],drive:[.4,.7],level:[.48,.6],send:[.3,.45],dsend:[.25,.4],attack:.008,release:[.15,.25],sustain:[.7,.82],fenv:[.3,.6],
        glide:[30,80],envAmount:[1.4,2.4],envDecay:[.08,.18],oscMix:[.4,.8],drift:[2,6]}},   // distorted supersaw / fuzz / hot mono Model-D trade the hook
      pads:{prob:.9, recipe:{model:["saw"],wave:"saw",cutoff:[1000,1900],detune:[.01,.018],attack:[.8,1.8],level:[.5,.68],send:[.35,.5],dsend:[.1,.25]},
        inserts:{prob:.5, max:1, pool:[["phaser",{rate:[.1,.3],depth:[.5,.75],mix:[.4,.6]}]]}},   // synthwave's phaser inherited, turned menacing
      drums:{kickModel:["909"],snareModel:["noise","clap"],hatModel:["noise","metal"],kick:[1.3,1.5],snare:[.95,1.2],hat:[.5,.8],tune:[.9,1.05],send:[.25,.4],dsend:[.05,.15]},   // big gated snare, faster
      fx:{reverb:[.45,.6], delayBeats:[.375,.5], delayFb:[.25,.4], delayCut:[2200,3400], pump:[.1,.3], crackle:[0,.06], lowcut:[30,45], highcut:[0,0], comp:[.45,.65], grit:[.4,.7], jux:[.15,.35]},
      found:{role:"bed", vol:[.06,.12], pitch:[.7,.85], stretch:[.45,.6], cutoff:[1400,2400], sources:["factory","highway_night","vx_xminusone"]},
      stab:["off","sparse"], hits:{sources:["sp_pressure","rave_d","vox_c"], pattern:"sparse", prob:.4},
      form:"drop" },
    /* genre-tool:prelude:genres */
    prelude: { label:"Prelude", info:"Bach-prelude figuration as a genre: continuous broken-chord 16th arpeggiation over a slow harmonic rhythm (chordEvery:16), felt-piano / bright-grand voices, drum kit OFF, even Baroque touch with only the lightest rubato — the WTC Book I C-major prelude, generalized",
      bpm:[62,80],
      swing:[0,0.03],
      humanize:[0.08,0.2],
      progressions:["canon","ii_v_i","dream"],
      kits:["off"],
      fills:["off"],
      chordEvery:16,
      bass:{patterns:["root","pedal","simple"], samplerPool:["felt_piano","bright_yamaha_grand"], recipe:{model:["sampler","sampler","piano"], cutoff:[700,1400], res:[0.05,0.1], level:[0.5,0.7], send:[0.2,0.4], dsend:[0,0.08], attack:[0.01,0.03], release:[0.3,0.6]}},
      lead:{patterns:["arp16","arpup","canon"], samplerPool:["bright_yamaha_grand","felt_piano"], recipe:{model:["sampler","sampler"], wave:"sine", voices:[1,2], spread:[0.001,0.003], cutoff:[2600,3800], level:[0.42,0.56], send:[0.25,0.45], dsend:[0.05,0.18], attack:[0.005,0.02], release:[0.2,0.45]}},
      pads:{prob:0.3, samplerPool:["strings"], recipe:{model:["sampler","strings"], wave:"sine", cutoff:[900,1600], detune:[0.002,0.005], attack:[1,2.5], release:[1.5,3], swell:1, level:[0.32,0.46], send:[0.35,0.55], dsend:[0,0.1]}},
      drums:{kickModel:["boom"], snareModel:["noise"], hatModel:["noise"], kick:[0.5,0.7], snare:[0.4,0.6], hat:[0.3,0.5], tune:[0.9,1], send:[0.15,0.35], dsend:[0,0]},
      fx:{reverb:[0.42,0.6], delayBeats:[0.75,1.5], delayFb:[0.12,0.28], delayCut:[2200,3200], pump:[0,0], crackle:[0,0.12], lowcut:[0,0], highcut:[0,0], comp:[0,0.12]},
      found:{role:"bed", vol:[0.05,0.12], pitch:[0.7,0.9], stretch:[0.45,0.6], cutoff:[1800,2800], sources:["iriomote","tokyo_station"]},
      rubato:{depth:[0.01,0.025], periodBars:[2,4], prob:1},
      hits:{sources:["sp_herenow"], pattern:"sparse", prob:0.05},
      stab:["off"],
      form:"wave" },
    /* /genre-tool:prelude:genres */
    /* genre-tool:hogcore:genres */
    hogcore: { label:"Hogcore", info:"VERY simple hyperpop at 150+: four-on-floor, sidechain pump, bright supersaw hooks, and 24 Harry Potter character NAMES as the hook — pitched-up vocal chops, a name under every bar, name-stabs on the drop",
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
      stations:["hp_harry","hp_hermione","hp_ron","hp_dumbledore","hp_snape","hp_draco","hp_luna","hp_neville","hp_mcgonagall","hp_hagrid","hp_sirius","hp_bellatrix","hp_voldemort","hp_ginny","hp_cho","hp_cedric","hp_dobby","hp_hedwig","hp_buckbeak","hp_peeves","hp_nick","hp_myrtle","hp_filch","hp_crookshanks"],
      stationVol:0.4,
      hits:{sources:["hp_voldemort","hp_snape","hp_harry","hp_bellatrix"], pattern:"offbeat", prob:0.6},
      stab:["off"],
      form:"drop" },
    /* /genre-tool:hogcore:genres */
  };

  // ---------- transition micro-lick soloists (2026-07 musical transitions) ----------
  // Per-genre instrument pools for the "micro lick" transition: a 1-2 bar
  // seeded pickup phrase into the next section's downbeat (csd-engine
  // lickEvents), the MUSICAL replacement for the overused noise sweep.
  // Entries are SAMPLERS ids (real FluidR3 instruments — this is also where
  // synth-forward genres get their only sampler usage) or "@model" synth
  // voices. Genres absent here (ambient, doomdrone, minimal, gabber,
  // breakcore, ebm, wintersynth, neoclassical) keep transitions instrument-
  // free on purpose — silence/drums suit them. resolveMulti assigns one
  // soloist per track (weighted parent pick); toState emits state.lickVoice.
  const LICKS = {
    techno:     ["@pluck","muted_trumpet"],           // a tight blip run; sometimes the Detroit-jazz muted horn
    house:      ["@piano","muted_trumpet"],           // the piano riff — the Marshall Jefferson turn
    jungle:     ["trombone","@pluck"],                // ragga dub-horn slides
    triphop:    ["muted_trumpet","tenor_sax"],        // the Portishead horn, smoky
    vaporwave:  ["alto_sax","@piano"],                // THE mall sax takes the corner
    synthwave:  ["@stack","@piano"],                  // a supersaw run / a DX piano turn
    lofi:       ["felt_piano","alto_sax"],
    downtempo:  ["flute","muted_trumpet"],
    dinosynth:  ["french_horns"],                     // the expedition's horns announce the next age
    canawave:   ["trumpet","@kpluck"],                // a proud little horn or the arp guitar itself
    transitwave:["trombone","@pluck"],                // the platform horn / a sequencer run
    dancepop:   ["@piano","muted_trumpet"],
    edm:        ["@piano"],                           // the big-room piano run
    dubstep:    ["@pluck"],
    blues:      ["harmonica","steel_string_guitar"],  // the harp answers, the guitar turns around
    jazz:       ["tenor_sax","bright_yamaha_grand"],  // the sax pickup / a two-hand run
    dub:        ["trombone","harmonica"],             // the Rico Rodriguez slide / melodica-adjacent reed
    trance:     ["@piano"],
    disco:      ["trumpet","@piano"],                 // the horn-section pickup
    italo:      ["@piano"],
    bigbeat:    ["trumpet","@piano"],
    garage:     ["@organ"],                           // the UKG organ skip
    newage:     ["harp","flute"],                     // a harp gliss-run into the new section
    exotica:    ["vibraphone","marimba"],
    industrial: ["@fuzz"],
    spokenword: ["tenor_sax","felt_piano"],
    chiptune:   ["@stack"],                           // a square arcade run
    chinawave:  ["oboe","@pluck"],                    // the suona-adjacent double reed
    sovietwave: ["trombone","french_horns"],          // the brass of the workers' band takes the turn
    citypop:    ["alto_sax","@piano"],                // the night-drive sax pickup
    shibuyakei: ["flute","vibraphone"],
    bossanova:  ["flute","nylon_string_guitar"],
    idm:        ["celesta"],                          // a music-box aside
    electro:    ["@pluck"],
    miamibass:  ["@pluck"],
    phonk:      ["@pluck"],
    witchhouse: ["ahh_choir"],                        // a ghost-choir rise
    mallsoft:   ["alto_sax"],                         // the mall sax, of course
    psytrance:  ["@pluck"],
    deephouse:  ["@piano","muted_trumpet"],
    coldwave:   ["@pluck"],
    krautrock:  ["flute","@organ"],                   // the kraut flute over the motorik turn
    newjack:    ["bright_yamaha_grand","@piano"],     // the swingbeat piano run
    acidhouse:  ["@piano"],
    surfrock:   ["jazz_guitar","steel_string_guitar"],// the run down the neck
    spacelounge:["vibraphone","celesta","harp"],
    arabpop:    ["oboe"],                             // the mizmar-ish approach run
    tango:      ["bandoneon","@piano"],
    afrobeat:   ["trumpet","tenor_sax"],              // the horn section's two-bar answer
    desertblues:["steel_string_guitar","harmonica"],
    sludgemetal:["@fuzz"],
    industrialmetal:["@fuzz"],
    darksynth:  ["@stack"],
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
    // DX7 patch-space resolution: when a voice resolved to model "dx7", each
    // parent with a patchPool for that voice nominates one patch (per side(),
    // like every other pool). SAME algorithm across nominees -> lerp the
    // ~144-dim param vectors by weight (patch-space morphing); different
    // algorithms are different FM topologies -> pick a side. Returns
    // {algorithm, params, name} or null (no valid patch -> caller falls back).
    const dx7For=(getVoice, recipe)=>{
      if(!recipe||recipe.model!=="dx7") return null;
      const cands=ws.map(x=>({w:x.w, pool:(getVoice(GENRES[x.g])||{}).patchPool}))
        .filter(c=>Array.isArray(c.pool)&&c.pool.length)
        .map(c=>({w:c.w, name:pick(rng,c.pool)}))
        .filter(p=>DX7_PATCHES[p.name]);
      if(!cands.length) return null;
      const algs=new Set(cands.map(p=>DX7_PATCHES[p.name].algorithm));
      if(cands.length>1&&algs.size===1&&new Set(cands.map(p=>p.name)).size>1){
        const tot=cands.reduce((s,p)=>s+p.w,0), P0=DX7_PATCHES[cands[0].name];
        const params={};
        for(const k of Object.keys(P0.params)){
          let v=0; for(const p of cands) v+=(DX7_PATCHES[p.name].params[k]||0)*(p.w/tot);
          params[k]=round(v,2);
        }
        return {algorithm:P0.algorithm, params, name:cands.map(p=>p.name.trim()).join("~")};
      }
      let r=rng()*cands.reduce((s,p)=>s+p.w,0), acc=0, src=cands[cands.length-1];
      for(const p of cands){ acc+=p.w; if(r<=acc){ src=p; break; } }
      const P=DX7_PATCHES[src.name];
      return {algorithm:P.algorithm, params:Object.assign({},P.params), name:src.name.trim()};
    };
    // SAMPLER resolution: when a voice resolved to model "sampler", each
    // parent with a samplerPool for that voice nominates one instrument
    // (per side(), like every pool); weighted pick. Returns an id in
    // SAMPLERS or null (caller falls back to a synth model).
    const samplerFor=(getVoice, recipe)=>{
      if(!recipe||recipe.model!=="sampler") return null;
      const cands=ws.map(x=>({w:x.w, pool:(getVoice(GENRES[x.g])||{}).samplerPool}))
        .filter(c=>Array.isArray(c.pool)&&c.pool.length)
        .map(c=>({w:c.w, id:pick(rng,c.pool)}))
        .filter(c=>SAMPLERS[c.id]);
      if(!cands.length) return null;
      let r=rng()*cands.reduce((s,c)=>s+c.w,0), acc=0, src=cands[cands.length-1];
      for(const c of cands){ acc+=c.w; if(r<=acc){ src=c.id; break; } }
      return typeof src==="string"?src:src.id;
    };
    // per-voice insert-FX chain: pool-union across parents (weighted, like every
    // other pool); parents sharing a type blend its param ranges by weight, then
    // one seeded sample per param. Fire probability is the weighted average of
    // parents' prob (parents WITHOUT inserts dilute it — a techno×vaporwave
    // midpoint sweeps its bass half as often as pure techno). 0-2 entries.
    const insertsFor=(getVoice)=>{
      const cands=ws.map(x=>({w:x.w, cfg:(getVoice(GENRES[x.g])||{}).inserts}))
        .filter(c=>c.cfg&&Array.isArray(c.cfg.pool)&&c.cfg.pool.length);
      if(!cands.length) return [];
      const prob=cands.reduce((s,c)=>s+(c.cfg.prob!=null?c.cfg.prob:0.5)*c.w,0);
      if(rng()>=prob) return [];
      const typeW={};   // type -> [{w, pr}] across parents (the union)
      for(const c of cands) for(const [t,pr] of c.cfg.pool){ if(INSERT_DEFAULTS[t]) (typeW[t]=typeW[t]||[]).push({w:c.w, pr:pr||{}}); }
      const types=Object.keys(typeW);
      if(!types.length) return [];
      const drawType=(exclude)=>{
        const avail=types.filter(t=>t!==exclude);
        if(!avail.length) return null;
        const tot=avail.reduce((s,t)=>s+typeW[t].reduce((a,e)=>a+e.w,0),0);
        let r=rng()*tot, sel=avail[avail.length-1];
        for(const t of avail){ const w=typeW[t].reduce((a,e)=>a+e.w,0); if((r-=w)<=0){ sel=t; break; } }
        return sel;
      };
      const mk=(t)=>{
        const ent=typeW[t], fx={type:t};
        for(const k of Object.keys(INSERT_DEFAULTS[t])){
          let lo=0,hi=0,tw=0;
          for(const e of ent){ const r=e.pr[k]; if(r==null) continue;
            const rr=Array.isArray(r)?r:[r,r]; lo+=rr[0]*e.w; hi+=rr[1]*e.w; tw+=e.w; }
          fx[k]=tw>0 ? round(inRange(rng,[lo/tw,hi/tw]),3) : INSERT_DEFAULTS[t][k];
        }
        return fx;
      };
      const maxN=Math.max(...cands.map(c=>c.cfg.max||1));
      const chain=[], t1=drawType(null);
      if(t1) chain.push(mk(t1));
      if(maxN>=2 && types.length>1 && rng()<0.35){ const t2=drawType(t1); if(t2) chain.push(mk(t2)); }
      return chain;
    };
    let kitSide=null;   // captured so euclid coheres with the KIT parent (same rng draw order as before)
    const choice = {
      genres:ws.map(x=>x.g), weights:ws.map(x=>round(x.w,3)), t:round(1-(ws[0]?ws[0].w:1),3), seed,
      bpm: Math.round(inRange(rng, wRange(g=>g.bpm))),
      swing: round(inRange(rng, wRange(g=>g.swing)),3),
      humanize: round(inRange(rng, wRange(g=>g.humanize)),3),
      progression: pick(rng, side().progressions),
      kit: pick(rng, (kitSide=side()).kits),
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
    // Strudel-borrowed euclid rhythm rides the kit's parent (a kit-level option)
    choice.euclid = kitSide&&kitSide.euclid ? JSON.parse(JSON.stringify(kitSide.euclid)) : null;
    // resolve dx7 patches per voice; a voice that picked "dx7" but found no
    // patch (empty registry, browser without presets) falls back to a legacy
    // model so the state always renders on every engine.
    choice.bassDx7 = dx7For(g=>g.bass, choice.bassRecipe);
    choice.leadDx7 = dx7For(g=>g.lead, choice.leadRecipe);
    choice.padDx7  = dx7For(g=>g.pads, choice.padRecipe);
    if(choice.bassRecipe.model==="dx7"&&!choice.bassDx7) choice.bassRecipe.model="sub";
    if(choice.leadRecipe.model==="dx7"&&!choice.leadDx7) choice.leadRecipe.model="fm";
    if(choice.padRecipe.model==="dx7"&&!choice.padDx7)   choice.padRecipe.model="bell";
    // resolve sampler instruments per voice; no instrument -> synth fallback
    // (empty registry / a blend whose parents carry no samplerPool)
    choice.leadSampler=samplerFor(g=>g.lead, choice.leadRecipe);
    choice.padSampler =samplerFor(g=>g.pads, choice.padRecipe);
    choice.bassSampler=samplerFor(g=>g.bass, choice.bassRecipe);   // upright bass etc — the bass voice is sampler-capable now
    if(choice.leadRecipe.model==="sampler"&&!choice.leadSampler) choice.leadRecipe.model="fm";
    if(choice.padRecipe.model==="sampler"&&!choice.padSampler)   choice.padRecipe.model="strings";
    if(choice.bassRecipe.model==="sampler"&&!choice.bassSampler) choice.bassRecipe.model="saw";
    // per-voice insert-FX chains (drawn LAST so all prior seeded choices keep
    // their historical rng positions; constraint pass prunes bad pairings)
    choice.bassInserts=insertsFor(g=>g.bass);
    choice.leadInserts=insertsFor(g=>g.lead);
    choice.padInserts =insertsFor(g=>g.pads);
    // ---- neoclassical deep-pass dimensions (2026-07), drawn LAST like the
    // inserts: parents WITHOUT these specs consume ZERO rng draws here, so
    // every other genre's states stay byte-identical (regression gate).
    // Weighted like inserts: prob and ranges renormalize over the parents
    // that carry the spec, diluted by the parents that don't.
    const specsOf=(field)=>ws.map(x=>({w:x.w, s:GENRES[x.g][field]})).filter(c=>c.s);
    const specRange=(cands,k,dflt)=>{ let lo=0,hi=0,tw=0;
      for(const c of cands){ const r=c.s[k]!=null?c.s[k]:dflt; const rr=Array.isArray(r)?r:[r,r];
        lo+=rr[0]*c.w; hi+=rr[1]*c.w; tw+=c.w; }
      return inRange(rng,[lo/tw,hi/tw]); };
    const specProb=(cands,dflt)=>cands.reduce((s,c)=>s+(c.s.prob!=null?c.s.prob:dflt)*c.w,0);
    // RUBATO — the time dimension: {depth (tempo sway ±fraction), periodBars,
    // phase (seeded)} -> state.rubato -> ONE beat-warp in csd-engine
    // buildEvents (all engines + layers inherit the same musical clock).
    const rub=specsOf("rubato");
    if(rub.length && rng()<specProb(rub,1))
      choice.rubato={ depth:round(specRange(rub,"depth",[.02,.04]),4),
        periodBars:Math.round(specRange(rub,"periodBars",[2,4])), phase:round(rng(),3) };
    // COUNTERPOINT — a second, quieter instance of the lead instrument (the
    // solo recipe merges over instruments.melody, so a felt-piano lead gets a
    // felt-piano counter voice) an octave below, on a mirrored/oblique
    // pattern: arps answer in contrary motion, moving lines get long tones
    // (oblique), a sparse lead gets a quiet wandering under-voice.
    const cpt=specsOf("counterpoint");
    if(cpt.length && rng()<specProb(cpt,0.66)){
      const mirror={arpup:"arpdown",arpdown:"arpup",canon:"sparse",wander:"sparse",sparse:"wander"};
      choice.counter={ pattern:mirror[choice.leadPattern]||"sparse",
        solo:{ level:round(Math.max(.15,(choice.leadRecipe.level||.5)*.45),3),
               send:round(Math.min(.7,(choice.leadRecipe.send||.4)+.1),3) },   // quieter + a touch wetter = behind the lead
        octave:-1 };
    }
    // MECHANICAL INTIMACY — soft key/pedal thunks on a fraction of lead notes
    // (state.thunk -> whisper-level tom hits in buildEvents, ~-30dB).
    const thk=specsOf("thunk");
    if(thk.length && ws.some(x=>GENRES[x.g].thunk))
      choice.thunk={ prob:round(specRange(thk,"prob",[.2,.35])*thk.reduce((s,c)=>s+c.w,0),3),
        amp:round(specRange(thk,"amp",[.026,.038]),4) };
    // ---- transition micro-lick soloist (2026-07 musical-transition round) ----
    // one tiny soloist per track for the "micro lick" transition, drawn from
    // LICKS by weighted parent pick (parents without a pool contribute
    // nothing — a techno×ambient blend keeps techno's soloist). Drawn after
    // the neoclassical dims so earlier seeded choices keep their positions.
    {
      const cands=ws.map(x=>({w:x.w, pool:LICKS[x.g]})).filter(x=>Array.isArray(x.pool)&&x.pool.length);
      if(cands.length){
        let r=rng()*cands.reduce((s,x)=>s+x.w,0), src=cands[cands.length-1];
        for(const x of cands){ if((r-=x.w)<=0){ src=x; break; } }
        choice.lick=pick(rng, src.pool);
      } else choice.lick=null;
    }
    // ---- harmonic rhythm (KERNEL-V4 Phase 1: chordEvery) — drawn LAST, and
    // ONLY when a parent anchor declares it: absent = ZERO rng draws here, so
    // every current genre stays byte-identical (fixtures.js pins this).
    // chordEvery = beats per chord bar (engine default 8); a blend picks a
    // parent by weight — parents without the key implicitly carry 8.
    if(ws.some(x=>GENRES[x.g].chordEvery)){
      let r=rng(), acc=0, gsel=ws[ws.length-1].g;
      for(const x of ws){ acc+=x.w; if(r<=acc){ gsel=x.g; break; } }
      const ce=Math.round(GENRES[gsel].chordEvery||8);
      if(ce&&ce!==8) choice.chordEvery=ce;
    }
    return constrain(choice);
  }
  function constrain(choice){
    // ---- constraints: keep midpoints songs ----
    const nch=(E.PROGRESSIONS[choice.progression]||{chords:[]}).chords.length;
    if(nch<=2 && ["composed","composed2"].includes(choice.leadPattern)) choice.leadPattern="arpup";
    // above 150 only kits that survive the tempo stay: chopped breaks OR straight
    // machine kits (gabber's distorted four, psytrance's pulse). Loping/swung kits
    // (full/boombap/halftime/...) still snap to jungle.
    if(choice.bpm>=150 && !["jungle","breaks","four","techno","pulse","electro"].includes(choice.kit)) choice.kit="jungle";
    if(choice.kit==="off"){ choice.foundRole="bed"; choice.stab="off"; }
    if(choice.foundRole==="chops" && choice.bpm<70) choice.foundRole="bed";
    if(choice.foundRole==="break" && !(SAMPLES[choice.foundSource]||{}).bpm){
      // break role needs a tempo-known break sample; otherwise fall back
      choice.foundSource="amen_170"; }
    if(choice.foundRole!=="break" && (SAMPLES[choice.foundSource]||{}).kind==="break"){
      choice.foundRole="break"; }
    // insert-FX sanity: some pairings are always wrong regardless of the blend
    const insOk=(chain,recipe,voice)=>(chain||[]).filter(fx=>{
      if(recipe.model==="sampler") return false;  // sampler voices skip inserts (native path renders identically live + press)
      if(fx.type==="distort"&&(recipe.model==="fuzz"||(recipe.drive||0)>=0.3)) return false;  // no distort on already-fuzz/driven voices
      if(voice==="bass"&&(fx.type==="chorus"||fx.type==="phaser")&&recipe.model==="sub") return false;  // the sub stays solid + mono
      if(fx.type==="filtersweep"&&recipe.model==="wobble") return false;  // the wobble IS the sweep
      return true;
    });
    choice.bassInserts=insOk(choice.bassInserts,choice.bassRecipe,"bass");
    choice.leadInserts=insOk(choice.leadInserts,choice.leadRecipe,"lead");
    choice.padInserts =insOk(choice.padInserts, choice.padRecipe, "pad");
    return choice;
  }
  function resolve(aName, bName, t, seed){
    t=Math.max(0,Math.min(1,t||0));
    return resolveMulti([{g:aName,w:1-t},{g:bName||aName,w:t}], seed);
  }

  // ---------- forms ----------
  let _gid=0; const gid=()=>"g"+(++_gid);
  const S=(name,o)=>Object.assign({id:gid(),name,cycles:1,pads:false,bass:"off",drums:"off",melody:"off",found:{sourceId:null,role:"bed"},fill:"off"},o);
  function buildSections(c, opts){
    const cycleBeats=(E.PROGRESSIONS[c.progression]||E.PROGRESSIONS.royal_road).chords.length*(c.chordEvery||8);
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
      // c.counter (neoclassical counterpoint) rides the melody sections; wave
      // genres without a counterpoint spec (ambient…) carry no counter key.
      secs=[
        S("arrive", {cycles:1*norm, pads:true, found:fnd()}),
        S("drift",  {cycles:2*norm, pads:true, melody:lead, ...(c.counter&&lead!=="off"?{counter:c.counter}:{}), found:fnd()}),
        S("swell",  {cycles:2*norm, pads:true, bass, melody:lead, ...(c.counter&&lead!=="off"?{counter:c.counter}:{}), drums:kit, found:fnd(), hits:hit(), sweep:"open"}),
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
    // ---- duration targeting (moved here from toState so the 3-minute pass
    // below sees FINAL section durations) ----
    if(opts&&opts.targetSec){
      const beats=secs.reduce((n,s)=>n+s.cycles*cycleBeats,0)+8;
      const kk=opts.targetSec/(beats*60/c.bpm);
      if(kk>1.15||kk<0.85) secs.forEach(s=>{s.cycles=Math.max(1,Math.round(s.cycles*kk));});
    }
    // ---- THE 3-MINUTE RULE ----
    // Nothing runs past ~2:40-3:00 without EVOLVING: at the first section
    // boundary where the unevolved stretch would pass ~175s the track either
    // (a) MODULATES — sec.keyShift walks +2/-3/+5 semitones (cumulative; the
    //     whole band transposes, samplers included — csd-engine pitch math),
    // (b) RE-ROLLS — remaining sections draw a fresh kit + lead pattern from
    //     the anchor's own pools (the "becomes a new kind of song" feel), or
    // (c) FORM-PIVOTS — remaining sections are redrawn from a DIFFERENT form
    //     (dj/pop/drop/wave only; once per track).
    // Sections that alone outstay the rule (long dj plateaus at --hours
    // durations) are split at cycle boundaries first, so every long track
    // has boundaries to evolve at. All seeded from c.seed; the audit is
    // `node scratchpad/audit.js evolve` (zero tracks >180s unevolved).
    const evolutions=[];
    {
      const spb=60/c.bpm, LIMIT=175;
      const secDur=(s)=>(s.cycles||1)*cycleBeats*spb;
      let eh=0xE0071; for(const ch of (c.genres&&c.genres[0])||"") eh=Math.imul(eh^ch.charCodeAt(0),2654435761);
      const erng=mulberry32((((c.seed??1)>>>0)^eh)>>>0);   // seed x genre: same seed evolves differently per genre
      const A=GENRES[c.genres[0]]||{};
      const KEYWALK=[2,-3,5];
      let acc=0, abs=0, shift=0, pivoted=false;
      for(let i=0;i<secs.length;i++){
        while(secDur(secs[i])>LIMIT&&(secs[i].cycles||1)>1){   // split the plateau
          const maxCyc=Math.max(1,Math.floor(LIMIT/(cycleBeats*spb)));
          const first=Math.max(1,Math.min(maxCyc,Math.ceil(secs[i].cycles/2)));
          const rest=secs[i].cycles-first;
          if(rest<1) break;
          const clone=JSON.parse(JSON.stringify(secs[i]));
          clone.id=gid(); clone.cycles=rest; clone.name=secs[i].name+" ›";
          secs[i].cycles=first; secs[i].fill="off";            // the seam gets an auto transition
          secs.splice(i+1,0,clone);
        }
        if(shift) secs[i].keyShift=shift;
        acc+=secDur(secs[i]); abs+=secDur(secs[i]);
        if(i>=secs.length-1) break;
        if(acc+Math.min(secDur(secs[i+1]),LIMIT)<=LIMIT) continue;
        // EVOLVE at this boundary
        const canKey=!secs.slice(i+1).some(s=>s.vocal);        // the sung chorus can't transpose
        const kits=(A.kits||[]).filter(x=>x&&x!=="off"&&x!==c.kit);
        const leads=((A.lead&&A.lead.patterns)||[]).filter(p=>p&&p!=="off"&&p!==c.leadPattern);
        const canReroll=(c.kit!=="off"&&kits.length>0)||leads.length>0;
        const canPivot=!pivoted&&["dj","pop","drop","wave"].includes(c.form)&&i<secs.length-2;
        const pool2=[]; if(canKey)pool2.push("key","key"); if(canReroll)pool2.push("reroll","reroll"); if(canPivot)pool2.push("pivot");
        const kind=pool2.length?pool2[Math.floor(erng()*pool2.length)]:"key";
        let detail="";
        if(kind==="key"){
          shift+=KEYWALK[Math.floor(erng()*KEYWALK.length)];
          detail="keyShift "+(shift>=0?"+":"")+shift;
        } else if(kind==="reroll"){
          const newKit=kits.length?kits[Math.floor(erng()*kits.length)]:c.kit;
          const newLead=leads.length?leads[Math.floor(erng()*leads.length)]:c.leadPattern;
          for(let j=i+1;j<secs.length;j++){
            const s=secs[j];
            if(s.drums&&s.drums!=="off"&&s.drums!=="kick") s.drums=newKit;
            if(s.melody===c.leadPattern) s.melody=newLead;
          }
          detail=newKit+"/"+newLead;
        } else {   // form pivot: redraw the rest of the track from another form
          const R=secs.slice(i+1).reduce((s,x)=>s+(x.cycles||1),0);
          // never pivot INTO wave: its beatless drift sections would gut a
          // groove genre's kit identity for the rest of the track (afrobeat
          // pivoting to wave lost its own hat-density diagonal)
          const forms2=["dj","pop","drop"].filter(f=>f!==c.form);
          const f2=forms2[Math.floor(erng()*forms2.length)];
          let mk={
            dj:  ()=>[S("plateau",{drums:kit,bass,pads:c.padsOn,found:fnd()}),
                      S("lift²",{drums:kit,bass,pads:c.padsOn,melody:lead,stab:c.stab,hits:hit()}),
                      S("peak²",{drums:kit,bass,pads:c.padsOn,melody:lead,found:fnd(),stab:c.stab})],
            pop: ()=>[S("verse²",{pads:c.padsOn,bass,drums:kit,found:fnd()}),
                      S("chorus²",{pads:c.padsOn,bass,drums:kit,melody:lead,stab:c.stab,hits:hit()}),
                      S("coda",{pads:true,bass,drums:kit,found:fnd()})],   // the coda keeps the groove — density identity survives the pivot
            drop:()=>[S("build²",{drums:"kick",bass,pads:c.padsOn,fill:"riser"}),
                      S("drop²",{drums:kit,bass,pads:c.padsOn,melody:lead,stab:c.stab,hits:hit(),found:fnd()}),
                      S("coda",{pads:c.padsOn,bass,drums:kit,found:fnd()})],
            wave:()=>[S("swell²",{pads:true,bass,melody:lead,drums:kit,found:fnd()}),
                      S("recede²",{pads:true,melody:lead==="off"?"off":"sparse",found:fnd()})],
          }[f2]();
          if(R<mk.length) mk=mk.slice(0,Math.max(1,R));
          const base=Math.max(1,Math.floor(R/mk.length));
          mk.forEach(s=>s.cycles=base);
          mk[mk.length-1].cycles=Math.max(1,R-base*(mk.length-1));
          if(shift) mk.forEach(s=>s.keyShift=shift);
          secs.splice(i+1,secs.length-(i+1),...mk);
          pivoted=true; detail="-> "+f2;
        }
        secs[i].evolveInto=true;                               // the auto pass treats this as a major boundary
        evolutions.push({at:i+1, tSec:Math.round(abs), kind, detail});
        acc=0;
      }
    }
    // ---- automated fills + transitions ----
    // Every MAJOR boundary (into a chorus/drop/peak/lift, out of a
    // breakdown/break, or into an evolution) transitions, without fail; minor
    // boundaries get one ~60% of the time. 2026-07 MUSICAL rework: the
    // vocabulary is weighted — the micro lick (a tiny sax/trombone/piano
    // pickup) and the kit's own mini-fill carry the weight, the genre's
    // curated percussive fills follow, and the sweep family (riser/sweep/
    // downlift/noise/reverse/impact) is rationed down to spice (census gate:
    // sweep and riser each <=15% of auto picks — the loud noise build was
    // "very loud, very disruptive, overused"). Seeded variety: no two
    // consecutive assigned boundaries reuse a type; explicit per-form fills
    // stand and count toward the repeat guard. Auto picks are marked
    // s.autoFill for the census (scratchpad audit.js census).
    {
      const MAJOR_NEXT=/chorus|drop|peak|lift/, MAJOR_FROM=/breakdown|^break/;
      const SWEEPY=new Set(["riser","sweep","downlift","noise","reverse","impact"]);
      const wpool=[];
      const add=(f,w)=>{ if(f&&f!=="off"&&!wpool.some(x=>x.f===f)) wpool.push({f,w}); };
      if(c.lick) add("micro lick",3);
      if(c.kit&&c.kit!=="off") add("kit fill",2);
      for(const f of c.fills) add(f, SWEEPY.has(f)?0.5:2);
      add("riser",0.35); add("downlift",0.35);
      const draw=(excl)=>{
        const av=wpool.filter(x=>x.f!==excl), P=av.length?av:wpool;
        const tot=P.reduce((s,x)=>s+x.w,0);
        let r=c.rng()*tot;
        for(const x of P){ if((r-=x.w)<=0) return x.f; }
        return P[P.length-1].f;
      };
      let lastFill=null;
      for(let i=0;i<secs.length-1;i++){
        const s=secs[i];
        if(s.fill&&s.fill!=="off"){ lastFill=s.fill; continue; }
        const major=MAJOR_NEXT.test(secs[i+1].name)||MAJOR_FROM.test(s.name)||s.evolveInto;
        if(major || c.rng()<0.6){
          s.fill=draw(lastFill);
          s.autoFill=true;
          lastFill=s.fill;
        }
      }
    }
    return {secs, cycleBeats, evolutions};
  }

  // ---------- choice -> engine state ----------
  function toState(c, opts){
    opts=opts||{};
    const {secs, cycleBeats, evolutions}=buildSections(c, opts);
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
    // SAMPLER voices: embed the zone map in the instrument recipe (the engine
    // contract, see faust/state-engine.js case "sampler") and ride each zone
    // wav into foundSources at vol 0 so both engines decode it through the
    // existing found paths (press ffdecode / live fetch+decode).
    const samplerSpec=(id)=>{
      const S=SAMPLERS[id]; if(!S) return null;
      return { id, sr:S.sr, zones:S.zones.map((z,i)=>({srcId:"ins_"+id+"_"+i, root:z.root, lo:z.lo, hi:z.hi,
        loop:!!z.loop, loopStart:z.ls, loopEnd:z.le })) };
    };
    // the transition micro-lick soloist -> state.lickVoice (csd-engine plays
    // it as a first-class solo voice; "@model" = a synth lick, otherwise a
    // SAMPLERS id whose zone wavs ride foundSources below like any sampler).
    // Explicit dx7:null/sampler:null keys matter: the recipe merges over the
    // melody recipe, which may itself be a dx7/sampler voice.
    let lickVoice=null, lickSamplerId=null;
    if(c.lick){
      if(c.lick[0]==="@"){
        const m=c.lick.slice(1);
        const SYN={ piano:{cutoff:3200,level:.5}, pluck:{cutoff:2600,level:.45,release:.12},
          organ:{cutoff:2400,level:.45}, stack:{wave:"saw",voices:3,spread:.008,cutoff:3000,level:.45},
          fuzz:{cutoff:2800,drive:.6,level:.5}, kpluck:{cutoff:3200,drive:.3,level:.5} };
        lickVoice=Object.assign({model:m,send:.3,dsend:.3,voices:1,dx7:null,sampler:null,inserts:[]},SYN[m]||{cutoff:3000,level:.45});
      } else if(SAMPLERS[c.lick]){
        lickSamplerId=c.lick;
        lickVoice={model:"sampler",sampler:samplerSpec(c.lick),level:.52,send:.32,dsend:.28,
          attack:.012,release:.14,voices:1,dx7:null,inserts:[]};
      }
    }
    for(const id of new Set([c.leadSampler, c.padSampler, c.bassSampler, lickSamplerId].filter(Boolean))){
      const S=SAMPLERS[id]; if(!S) continue;
      S.zones.forEach((z,i)=>foundSources.push({id:"ins_"+id+"_"+i,label:S.label,url:"",
        samplePath:"found/samples/instruments/"+S.dir+"/"+z.file, vol:0, pitch:1, stretch:0.5, cutoff:18000}));
    }
    const state={
      ...(lickVoice?{lickVoice}:{}),
      vocoderSourceId: vocId||undefined,
      bpm:c.bpm, keyOffset:opts.keyOffset!=null?opts.keyOffset:0, progression:c.progression,
      reverb:c.fx.reverb, seed:c.seed, swing:c.swing, humanize:c.humanize,
      realHats:!!c.realHats, snarePP:c.snarePP||0, stationPool:(c.stations||[]),
      // rubato/thunk (neoclassical deep pass): absent keys = zero behavior
      // change in buildEvents — unchanged genres press byte-identically
      ...(c.rubato?{rubato:c.rubato}:{}), ...(c.thunk?{thunk:c.thunk}:{}),
      euclid:c.euclid||undefined,                      // kit-level euclidean rhythm spec (csd-engine drumEvents)
      ...(c.chordEvery?{chordEvery:c.chordEvery}:{}),  // harmonic rhythm (KERNEL-V4 Phase 1): beats per chord bar
      jux:(c.fx.jux||0)>0.05?c.fx.jux:0,               // stereo divergence: buildEvents emits per-event pan offsets
      pump:c.fx.pump>0.05?c.fx.pump:0, crackle:c.fx.crackle>0.05?c.fx.crackle:0,
      comp:c.fx.comp>0.05?c.fx.comp:0, grit:(c.fx.grit||0)>0.05?c.fx.grit:0,
      tone:{lowcut:c.fx.lowcut>10?Math.round(c.fx.lowcut):0, highcut:c.fx.highcut>1000?Math.round(c.fx.highcut):0},
      delay:{beats:c.fx.delayBeats, feedback:c.fx.delayFb, cutoff:Math.round(c.fx.delayCut)},
      instruments:{
        // model "dx7" carries its resolved patch: instruments.<voice>.dx7 =
        // {algorithm, params[, name]} — the Faust engine's contract; the
        // legacy csound path maps the model and ignores the blob.
        // inserts: the per-voice insert-FX chain (CONTRACT: [{type,...params}],
        // [] = bypass — see csd-engine defaultInstruments for units)
        pad:Object.assign(E.defaultInstruments().pad, c.padRecipe, {inserts:c.padInserts||[]}, c.padDx7?{dx7:c.padDx7}:{}, c.padSampler?{sampler:samplerSpec(c.padSampler)}:{}),
        bass:Object.assign(E.defaultInstruments().bass, c.bassRecipe, {inserts:c.bassInserts||[]}, c.bassDx7?{dx7:c.bassDx7}:{}, c.bassSampler?{sampler:samplerSpec(c.bassSampler)}:{}),
        melody:Object.assign(E.defaultInstruments().melody, c.leadRecipe, {voices:Math.round(c.leadRecipe.voices||2), inserts:c.leadInserts||[]}, c.leadDx7?{dx7:c.leadDx7}:{}, c.leadSampler?{sampler:samplerSpec(c.leadSampler)}:{}),
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
      bass:c.bassPattern+"("+c.bassRecipe.model+(c.bassDx7?":"+c.bassDx7.name:"")+(c.bassSampler?":"+c.bassSampler:"")+")",
      lead:c.leadPattern+"("+c.leadRecipe.model+(c.leadDx7?":"+c.leadDx7.name:"")+(c.leadSampler?":"+c.leadSampler:"")+")",
      pad:c.padRecipe.model+(c.padDx7?":"+c.padDx7.name:"")+(c.padSampler?":"+c.padSampler:""),drums:c.drumRecipe.kickModel+"/"+c.drumRecipe.snareModel+"/"+c.drumRecipe.hatModel,
      found:c.foundSource+"/"+c.foundRole, stab:c.stab, hits:c.hits?c.hits.source:"-",
      lick:c.lick||"-",
      evolutions,   // the 3-minute-rule audit trail: [{at, tSec, kind, detail}]
      rubato:c.rubato?c.rubato.depth+"x"+c.rubato.periodBars+"bar":"-",
      counter:c.counter?c.counter.pattern+"(oct"+c.counter.octave+")":"-",
      inserts:{bass:(c.bassInserts||[]).map(f=>f.type).join("+")||"-",
               lead:(c.leadInserts||[]).map(f=>f.type).join("+")||"-",
               pad:(c.padInserts||[]).map(f=>f.type).join("+")||"-"}};
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
      const beats=state.sections.reduce((nn,s)=>nn+(s.cycles||1)*(E.PROGRESSIONS[state.progression].chords.length*(state.chordEvery||8)),0)+8;
      out.push({ i, from:A.label, to:B.label, t:round(t,3), weights,
        seconds:Math.round(beats*60/state.bpm), bpm:state.bpm, key, meta, state });
    }
    return out;
  }
  function playlist(waypoints, opts){ return journey(waypoints, Object.assign({tracks:12}, opts||{})); }

  function mix(weights, opts){ opts=opts||{}; return toState(resolveMulti(weights, opts.seed!=null?opts.seed:1), opts); }
  const api={ GENRES, SOURCES, SAMPLES, SAMPLERS, GENRE_CLIPS, DX7_PATCHES, resolve, resolveMulti, track, blend, mix, playlist, journey };
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
      // FAUST-PORT phase 3: the press runs on the Faust engine (legacy csound
      // path preserved on branch legacy-csound)
      const wav="/tmp/"+path.basename(base)+".wav";
      const sj="/tmp/"+path.basename(base)+".state.json";
      fs.writeFileSync(sj,JSON.stringify(state));
      execFileSync("node",[path.join(__dirname,"faust","press.js"),sj,wav],{stdio:["ignore","ignore","inherit"]});
      // fade the ending out instead of stopping abruptly
      const beats=state.sections.reduce((n,s)=>n+(s.cycles||1)*(E.PROGRESSIONS[state.progression]||E.PROGRESSIONS.royal_road).chords.length*(state.chordEvery||8),0)+8;
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
